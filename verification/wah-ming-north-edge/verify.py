"""Offline-only v128 overlay. Requires Python with NumPy and Shapely 2.x."""
import gzip
import hashlib
import json
import struct
import subprocess
from pathlib import Path

import numpy as np
import shapely as s

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "release/public-v128/estate-refined"


def input_glb(name, expected):
    path = ASSETS / name
    packed = path.read_bytes()
    assert hashlib.sha256(packed).hexdigest() == expected, path
    data = gzip.decompress(packed)
    assert data[:4] == b"glTF"
    size = struct.unpack_from("<I", data, 12)[0]
    layout = json.loads(data[20:20 + size])
    result = []
    for mesh in layout["meshes"]:
        primitive, = mesh["primitives"]
        assert primitive["mode"] == 4 and "indices" not in primitive
        position = layout["accessors"][primitive["attributes"]["POSITION"]]
        view = layout["bufferViews"][position["bufferView"]]
        assert position["componentType"] == 5126 and position["type"] == "VEC3"
        assert not view.get("byteStride")
        offset = 28 + size + view.get("byteOffset", 0) + position.get("byteOffset", 0)
        result.append(np.frombuffer(data, "<f4", position["count"] * 3, offset)
                      .reshape(-1, 3, 3).astype(float))
    return result


def runtime_triangles():
    js = """
    import { createServer } from "vite";
    const server = await createServer({configFile: "procedural.config.ts", server: {watch: null, middlewareMode: true, ws: false}});
    try {
      const edge = await server.ssrLoadModule("/src/procedural/wah-ming-north-edge.ts");
      const input = await server.ssrLoadModule("/src/procedural/wah-ming-authored.ts");
      const cells = await server.ssrLoadModule("/src/procedural/cell-surface.ts");
      console.log(JSON.stringify([edge.wahMingNorthWall(), edge.wahMingNorthBank(), cells.authoredCellGeometry(input.WAH_MING_AUTHORED_OPTIMISED)]));
    } finally { await server.close(); }
    """
    out = subprocess.check_output(["node", "--input-type=module", "-e", js], cwd=ROOT)
    result = []
    for data in json.loads(out):
        pos = np.array(data["positions"], dtype=np.float32).astype(float).reshape(-1, 3)
        result.append(pos[np.array(data["indices"]).reshape(-1, 3)])
    return result


def continuous_overlay(candidate, source):
    # At vertices of a triangle intersection both planes are evaluated.
    # Their difference is affine, so a vertex attains the maximum.
    worst = 0.0
    polygons = []
    for ct in candidate:
        cp = s.Polygon(ct[:, [0, 2]])
        cc = np.linalg.solve(np.c_[ct[:, [0, 2]], np.ones(3)], ct[:, 1])
        for st in source:
            sp = s.Polygon(st[:, [0, 2]])
            if sp.area < 1e-12:
                continue
            inter = cp.intersection(sp)
            if inter.area < 1e-12:
                continue
            sc = np.linalg.solve(np.c_[st[:, [0, 2]], np.ones(3)], st[:, 1])
            coords = np.array(inter.exterior.coords)[:-1]
            worst = max(worst, max(abs(np.c_[coords, np.ones(len(coords))] @ (cc - sc))))
            polygons.append(inter)
    union = s.union_all(polygons)
    target = s.union_all([s.Polygon(t[:, [0, 2]]) for t in candidate])
    return worst, target.difference(union).area, sum(q.area for q in polygons) - union.area


_, wall_ref = input_glb("cumulative-context-roads-wahming-north-provisional.glb.gz",
                        "5dadbe64d7bf519870247d708fade51d18a443bbbb5497693718367fa1f1623a")
bank_ref, = input_glb("cumulative-context-terrain-C-x0-z-3.glb.gz",
                      "326e8fc08b528783bc8ec6861befc0fc844f44bbf4c5f3dd726618770d23f07e")
wall, bank, paving = runtime_triangles()
lo, _, northing = wall.min(axis=(0, 1))
hi = wall[:, :, 0].max()
support = wall_ref[(wall_ref[:, :, 2] == northing).all(1)
                   & (wall_ref[:, :, 0].min(1) >= lo)
                   & (wall_ref[:, :, 0].max(1) <= hi)]
# At this slice, reconstructing the fixed stations reproduces the six published triangles bit for bit.
canon = lambda faces: sorted(tuple(sorted(map(tuple, tri))) for tri in faces)
assert canon(wall) == canon(support)
bank_ref = bank_ref[(bank_ref[:, :, 0].max(1) >= lo) & (bank_ref[:, :, 0].min(1) <= hi)
                   & (bank_ref[:, :, 2].max(1) >= northing - 1)
                   & (bank_ref[:, :, 2].min(1) <= northing)]
bank_error, missing, overlap = continuous_overlay(bank, bank_ref)
assert bank_error <= 0.01 and abs(missing) < 1e-8 and abs(overlap) < 1e-8
assert paving[:, :, 2].min() == northing and bank[:, :, 2].max() == northing
assert set(map(tuple, bank[bank[:, :, 2] == northing])).issubset(set(map(tuple, wall.reshape(-1, 3))))

# Compare the paving and lower wall profiles over all source and runtime breakpoints.
foot = {}
for x, y, _ in wall.reshape(-1, 3):
    foot[x] = min(y, foot.get(x, float("inf")))
fx = np.array(sorted(foot))
fy = np.array([foot[x] for x in fx])
err = 0.0
seam_segments = []
for tri in paving:
    for a, b in zip(tri, np.roll(tri, -1, axis=0)):
        if a[2] != northing or b[2] != northing or a[0] == b[0]:
            continue
        a, b = sorted((a, b), key=lambda q: q[0])
        x0, x1 = max(lo, a[0]), min(hi, b[0])
        if x1 <= x0:
            continue
        seam_segments.append(s.LineString([(x0, 0), (x1, 0)]))
        knots = np.r_[x0, fx[(fx > x0) & (fx < x1)], x1]
        py = np.interp(knots, [a[0], b[0]], [a[1], b[1]])
        wy = np.interp(knots, fx, fy)
        err = max(err, max(abs(py - wy - 0.025)))
assert abs(s.union_all(seam_segments).length - (hi - lo)) < 1e-9
assert err < 0.00001

print(json.dumps({
    "reference": "public v128 compressed published files, SHA-256 verified",
    "xRangeM": [lo, hi],
    "zM": northing,
    "wallLengthM": hi - lo,
    "wallTriangles": len(wall),
    "wallExactFloat32Faces": True,
    "bankTriangles": len(bank),
    "bankWidthM": 1,
    "bankMaxContinuousHeightErrorMm": float(bank_error * 1000),
    "bankUncoveredAreaM2": float(missing),
    "bankReferenceOverlapAreaM2": float(overlap),
    "exactRuntimeWallBankSeam": True,
    "pavingLengthVerifiedM": s.union_all(seam_segments).length,
    "pavingWallFootNominalVerticalOverlapMm": 25,
    "pavingWallFootMaximumOffsetDeviationMm": float(err * 1000),
    "pavingTriangles": len(paving),
}, indent=2))
