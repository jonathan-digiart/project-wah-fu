import {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
} from "three";
import { expect, test } from "vitest";
import { BUILDING_ENVELOPES } from "./building-envelopes";
import { buildingRole, V128_PALETTE, v128Material } from "./palette";
import { ComponentRegistry } from "./registry";
import { wahMingPlan } from "./wah-ming";

test("maps v128-linked estate buildings separately from surrounding shells", () => {
  expect(
    BUILDING_ENVELOPES.filter((b) => buildingRole(b.id) === "estateBuilding"),
  ).toHaveLength(33);
  expect(buildingRole("B319321253701063C0")).toBe("estateBuilding");
  expect(buildingRole("B319111249101063C0")).toBe("contextBuilding");
  const estate = v128Material("estateBuilding", true);
  const context = v128Material("contextBuilding", true);
  if (!(
    estate instanceof MeshStandardMaterial &&
    context instanceof MeshStandardMaterial
  ))
    throw new Error("Buildings require the existing Three material");
  expect(estate.color.getHexString("srgb")).toBe("d4c8b4");
  expect(context.color.getHexString("srgb")).toBe("bcb7ad");
  estate.dispose();
  context.dispose();
});

test("v128 paved faces and retaining wall share the road input; the bank is land", () => {
  expect(V128_PALETTE.paving).toEqual([0.35, 0.38, 0.34]);
  expect(V128_PALETTE.retainingWall).toEqual(V128_PALETTE.paving);
  expect(V128_PALETTE.bank).toEqual([0.54, 0.6, 0.48]);
  const material = v128Material("bank", false);
  if (!(material instanceof ShaderMaterial))
    throw new Error("Non-clay colours use v128 display-space shading");
  const colour: unknown = material.uniforms.displayColor!.value;
  if (!(colour instanceof Vector3)) throw new Error("Expected palette vector");
  expect(colour.toArray()).toEqual(V128_PALETTE.bank);
  expect(material.toneMapped).toBe(false);
  material.dispose();
});

test("changing a material role does not change generated positions, indices or statistics", () => {
  const registry = new ComponentRegistry();
  const component = wahMingPlan(0);
  const originalStats = registry.replace(component, "estateBuilding");
  const first = registry.group.children[0]!;
  const data = (object: typeof first) => {
    if (
      !(object instanceof Mesh) ||
      !(object.geometry instanceof BufferGeometry)
    )
      throw new Error("Expected mesh geometry");
    return object.geometry.toJSON();
  };
  const original = data(first).data;
  expect(registry.replace(component, "paving")).toEqual(originalStats);
  expect(data(registry.group.children[0]!).data).toEqual(original);
  registry.dispose();
});
