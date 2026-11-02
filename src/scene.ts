import { linearTerrainPositions } from "./terrain-mesh";
import {
  DoubleSide,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Shape,
  Path,
  ShapeUtils,
  Vector2,
  Vector3,
  ExtrudeGeometry,
} from "three";
import {
  inside,
  createHeightSampler,
  type Point,
  type SiteData,
} from "./model";
/** Uniform triangle subdivision retains the exact semantic boundary, without raster clipping. */
export function terrainPositions(data: SiteData, depth = 4): number[] {
  const heightAt = createHeightSampler(data);
  const positions: number[] = [];
  let flatHeight: number | undefined = undefined;
  const append = (a: Point, b: Point, c: Point, remaining: number): void => {
    if (remaining) {
      const ab: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const bc: Point = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
      const ca: Point = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
      append(a, ab, ca, remaining - 1);
      append(ab, b, bc, remaining - 1);
      append(ca, bc, c, remaining - 1);
      append(ab, bc, ca, remaining - 1);
      return;
    }
    // XZ polygon winding reversed to produce upward-facing +Y normals.
    for (const p of [a, c, b])
      positions.push(p[0], flatHeight ?? heightAt(p[0], p[1]), p[1]);
  };
  if (!Number.isInteger(depth) || depth < 0 || depth > 6)
    throw new Error("Terrain subdivision outside safe budget");
  if (data.interpolation === "linear")
    for (const value of linearTerrainPositions(data)) positions.push(value);
  else
    for (const region of data.landRegions ?? [data.boundary]) {
      const outline = region.map((p) => new Vector2(...p));
      for (const face of ShapeUtils.triangulateShape(outline, []))
        append(region[face[0]!]!, region[face[1]!]!, region[face[2]!]!, depth);
    }
  flatHeight = data.seaHeight;
  for (const region of data.seaRegions ?? []) {
    const outline = region.map((p) => new Vector2(...p));
    for (const face of ShapeUtils.triangulateShape(outline, []))
      append(region[face[0]!]!, region[face[1]!]!, region[face[2]!]!, 0);
  }
  return positions;
}
export function createSiteScene(data: SiteData) {
  const heightAt = createHeightSampler(data);
  const scene = new Scene();
  scene.background = new Color("#e9e7e1");
  scene.add(new AmbientLight(0xffffff, 2));
  const sun = new DirectionalLight(0xffffff, 3);
  sun.position.set(-300, 600, 200);
  scene.add(sun);
  const clay = new MeshStandardMaterial({
    color: "#d4c8b4",
    roughness: 1,
    metalness: 0,
  });
  const contextClay = new MeshStandardMaterial({
    color: "#bcb7ad",
    roughness: 1,
    metalness: 0,
  });
  const groundClay = new MeshStandardMaterial({
    color: "#a9aaa0",
    roughness: 1,
    metalness: 0,
  });
  const terrainGeometry = new BufferGeometry();
  terrainGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(terrainPositions(data), 3),
  );
  terrainGeometry.computeVertexNormals();
  const terrain = new Mesh(terrainGeometry, groundClay);
  terrain.name = "Simplified terrain — approximate";
  scene.add(terrain);
  // Presentation shell is not geology: semantic region walls to a documented datum.
  const shellPositions: number[] = [];
  const bottom = data.presentationBottom;
  if (bottom !== undefined) {
    const regions = [
      ...(data.landRegions ?? [data.boundary]).map((points) => ({
        points,
        sea: false,
      })),
      ...(data.seaRegions ?? []).map((points) => ({ points, sea: true })),
    ];
    for (const { points, sea } of regions)
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        for (let j = 0; j < 16; j++) {
          const x1 = a[0] + ((b[0] - a[0]) * j) / 16;
          const z1 = a[1] + ((b[1] - a[1]) * j) / 16;
          const x2 = a[0] + ((b[0] - a[0]) * (j + 1)) / 16;
          const z2 = a[1] + ((b[1] - a[1]) * (j + 1)) / 16;
          const h1 = sea ? data.seaHeight! : heightAt(x1, z1);
          const h2 = sea ? data.seaHeight! : heightAt(x2, z2);
          shellPositions.push(
            x1,
            h1,
            z1,
            x2,
            h2,
            z2,
            x1,
            bottom,
            z1,
            x2,
            h2,
            z2,
            x2,
            bottom,
            z2,
            x1,
            bottom,
            z1,
          );
        }
      }
    for (const face of ShapeUtils.triangulateShape(
      data.boundary.map((p) => new Vector2(...p)),
      [],
    ))
      for (const index of face) {
        const p = data.boundary[index]!;
        shellPositions.push(p[0], bottom, p[1]);
      }
  }
  const shellGeometry = new BufferGeometry();
  shellGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(shellPositions, 3),
  );
  shellGeometry.computeVertexNormals();
  const shellMaterial = new MeshStandardMaterial({
    color: "#98998f",
    roughness: 1,
    side: DoubleSide,
  });
  const shell = new Mesh(shellGeometry, shellMaterial);
  shell.name = "Presentation shell — not geology";
  scene.add(shell);
  const buildings = new Group();
  buildings.name = "Reference-derived basic massing";
  scene.add(buildings);
  for (const building of data.buildings) {
    // Extrusion is generated from a short footprint, never from source mesh triangles.
    const shape = new Shape(
      building.footprint.map((p) => new Vector2(p[0], -p[1])),
    );
    for (const hole of building.holes ?? [])
      shape.holes.push(new Path(hole.map((p) => new Vector2(p[0], -p[1]))));
    const geometry = new ExtrudeGeometry(shape, {
      depth: building.height,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, building.base, 0);
    const mesh = new Mesh(
      geometry,
      building.category === "context" ? contextClay : clay,
    );
    mesh.name = building.name;
    mesh.userData = {
      id: building.id,
      reviewId: building.sourceId ?? building.id,
      category: building.category ?? "estate",
    };
    buildings.add(mesh);
  }
  const points = [...data.boundary, data.boundary[0]!].map(
    (p) =>
      new Vector3(
        p[0],
        ((data.seaRegions ?? []).some((region) => inside(p, region))
          ? data.seaHeight!
          : heightAt(p[0], p[1])) + 0.8,
        p[1],
      ),
  );
  const boundary = new Line(
    new BufferGeometry().setFromPoints(points),
    new LineBasicMaterial({ color: "#444e4b" }),
  );
  boundary.name = "Approved site boundary";
  scene.add(boundary);
  const dispose = () => {
    terrainGeometry.dispose();
    shellGeometry.dispose();
    shellMaterial.dispose();
    clay.dispose();
    contextClay.dispose();
    groundClay.dispose();
    boundary.geometry.dispose();
    boundary.material.dispose();
    for (const child of buildings.children)
      if (child instanceof Mesh) (child.geometry as BufferGeometry).dispose();
  };
  return { scene, buildings, terrain, boundary, shell, dispose };
}
