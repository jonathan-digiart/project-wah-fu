/** Deliberately bounded experimental tile protocol, not arbitrary estate meshes. */
export const LIMITS = Object.freeze({
  vertices: 100000,
  triangles: 32768,
  nodes: 16383,
  depth: 32,
  coordinate: 10000000,
});
function check(ok, message) {
  if (!ok) throw Error(message);
}
const finite = (n) => Number.isFinite(n) && Math.abs(n) <= LIMITS.coordinate;
export function validateGeometry(data) {
  check(
    data && data.positions instanceof Float32Array,
    "Expected Float32 positions",
  );
  check(data.indices instanceof Uint32Array, "Expected Uint32 indices");
  const power2 = (n) =>
    Number.isInteger(n) && n > 0 && n <= 256 && (n & (n - 1)) === 0;
  check(
    Number.isSafeInteger(data.x) && Number.isSafeInteger(data.z),
    "Invalid tile address",
  );
  check(
    Number.isInteger(data.tileSize) &&
      data.tileSize > 0 &&
      data.tileSize <= LIMITS.coordinate,
    "Invalid tile size",
  );
  check(
    Array.isArray(data.origin) &&
      data.origin.length === 2 &&
      data.origin.every(finite),
    "Invalid origin",
  );
  check(
    power2(data.latticeSegments) &&
      power2(data.interiorSegments) &&
      data.interiorSegments <= data.latticeSegments,
    "Invalid grid subdivisions",
  );
  for (const [axis, address] of [
    [0, data.x],
    [1, data.z],
  ]) {
    check(
      finite(data.origin[axis] + address * data.tileSize) &&
        finite(data.origin[axis] + (address + 1) * data.tileSize),
      "Tile outside coordinate bounds",
    );
  }
  check(
    data.positions.length > 0 &&
      data.positions.length % 3 === 0 &&
      data.positions.length <= LIMITS.vertices * 3,
    "Position size limit",
  );
  check(
    data.indices.length > 0 &&
      data.indices.length % 3 === 0 &&
      data.indices.length <= LIMITS.triangles * 3,
    "Triangle size limit",
  );
  for (const p of data.positions) check(finite(p), "Invalid coordinate");
  for (const i of data.indices)
    check(i < data.positions.length / 3, "Index outside positions");
  check(
    data.cells instanceof Uint32Array &&
      data.cells.length === data.interiorSegments * data.interiorSegments * 2,
    "Invalid cells",
  );
  check(
    data.edges &&
      Object.keys(data.edges).length === 4 &&
      ["west", "east", "north", "south"].every(
        (k) =>
          data.edges[k] instanceof Uint32Array &&
          data.edges[k].length === data.latticeSegments + 1,
      ),
    "Invalid edges",
  );
  let cursor = 0;
  for (let i = 0; i < data.cells.length; i += 2) {
    const start = data.cells[i],
      end = data.cells[i + 1];
    check(
      start === cursor &&
        start % 3 === 0 &&
        end % 3 === 0 &&
        end > start &&
        end <= data.indices.length,
      "Invalid cell triangle range",
    );
    cursor = end;
  }
  check(cursor === data.indices.length, "Cells do not cover all triangles");
  for (const edge of Object.values(data.edges))
    for (const index of edge)
      check(index < data.positions.length / 3, "Edge index outside positions");
  const byteCount =
    data.positions.byteLength +
    data.indices.byteLength +
    data.cells.byteLength +
    Object.values(data.edges).reduce((sum, edge) => sum + edge.byteLength, 0);
  check(
    Number.isSafeInteger(data.bytes) && data.bytes === byteCount,
    "Invalid geometry byte accounting",
  );
  for (const a of [
    data.positions,
    data.indices,
    data.cells,
    ...Object.values(data.edges),
  ])
    check(
      a.buffer instanceof ArrayBuffer &&
        a.byteOffset === 0 &&
        a.buffer.byteLength === a.byteLength,
      "Expected dedicated array buffer",
    );
  check(
    data.positions.buffer instanceof ArrayBuffer &&
      data.indices.buffer instanceof ArrayBuffer,
    "Shared buffers unsupported",
  );
}
export function validateCompiled(solids) {
  check(
    Array.isArray(solids) && solids.length === 1,
    "Expected one compiled tile root",
  );
  for (const s of solids) {
    const positions = s?.data?.positions;
    check(
      positions instanceof Float64Array &&
        positions.buffer instanceof ArrayBuffer &&
        positions.byteOffset === 0 &&
        positions.buffer.byteLength === positions.byteLength,
      "Expected packed Float64 positions",
    );
    check(
      positions.length > 0 &&
        positions.length % 9 === 0 &&
        positions.length <= LIMITS.triangles * 9,
      "Packed size limit",
    );
    for (const p of positions) check(finite(p), "Invalid packed coordinate");
    let indexBuffer = null;
    const seen = new Set(),
      ids = new Set(),
      stack = [[s.tree, 0, null]];
    while (stack.length) {
      const [node, depth, parent] = stack.pop();
      check(
        node && typeof node === "object" && !seen.has(node),
        "Cyclic or missing tree",
      );
      seen.add(node);
      check(
        seen.size <= LIMITS.nodes && depth <= LIMITS.depth,
        "Tree size limit",
      );
      const box = node.box;
      check(box?.min && box?.max, "Missing box");
      for (const axis of ["x", "y", "z"]) {
        check(
          finite(box.min[axis]) &&
            finite(box.max[axis]) &&
            box.min[axis] <= box.max[axis],
          "Invalid box",
        );
        if (parent)
          check(
            box.min[axis] >= parent.min[axis] &&
              box.max[axis] <= parent.max[axis],
            "Child outside parent",
          );
      }
      if (node.indices) {
        check(
          !node.left && !node.right && node.data === s.data,
          "Invalid leaf",
        );
        check(
          node.indices instanceof Uint32Array &&
            node.indices.buffer instanceof ArrayBuffer &&
            node.indices.length > 0 &&
            node.indices.length <= 12,
          "Invalid leaf indices",
        );
        check(
          node.indices.buffer.byteLength === (positions.length / 9) * 4,
          "Unexpected index backing size",
        );
        if (indexBuffer === null) indexBuffer = node.indices.buffer;
        check(
          node.indices.buffer === indexBuffer,
          "Expected shared packed index buffer",
        );
        for (const id of node.indices) {
          check(
            id < positions.length / 9 && !ids.has(id),
            "Invalid or duplicate triangle id",
          );
          ids.add(id);
          for (let k = 0; k < 9; k++) {
            const axis = ["x", "y", "z"][k % 3],
              v = positions[id * 9 + k];
            check(
              v >= box.min[axis] && v <= box.max[axis],
              "Triangle outside leaf bounds",
            );
          }
        }
      } else {
        check(node.left && node.right, "Incomplete branch");
        stack.push([node.left, depth + 1, box], [node.right, depth + 1, box]);
      }
    }
    check(ids.size === positions.length / 9, "Missing triangle ids");
  }
  return solids;
}
