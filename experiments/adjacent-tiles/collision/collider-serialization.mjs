import { Box3, Vector3 } from "three";
export function serializeSolids(solids) {
  return solids.map(({ data, tree }) => ({ data, tree }));
}
export function colliderTransfers(solids) {
  const buffers = new Set();
  function visit(n) {
    if (n.indices) buffers.add(n.indices.buffer);
    if (n.data) buffers.add(n.data.positions.buffer);
    if (n.left) visit(n.left);
    if (n.right) visit(n.right);
  }
  for (const s of solids) {
    buffers.add(s.data.positions.buffer);
    visit(s.tree);
  }
  return [...buffers];
}
import { validateCompiled, validateCompiledGeometry } from "./validation.mjs";
export function hydrateSolids(solids, root, geometryData = null) {
  if (geometryData) validateCompiledGeometry(geometryData, solids);
  else validateCompiled(solids);
  if (!root?.isObject3D) throw Error("Invalid root");
  function visit(n) {
    n.box = new Box3(
      new Vector3(n.box.min.x, n.box.min.y, n.box.min.z),
      new Vector3(n.box.max.x, n.box.max.y, n.box.max.z),
    );
    if (n.left) visit(n.left);
    if (n.right) visit(n.right);
  }
  return solids.map((s) => {
    visit(s.tree);
    return { ...s, root };
  });
}
