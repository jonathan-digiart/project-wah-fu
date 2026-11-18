import type { AuthoredCellSurface } from "./cell-surface";
/** Authoring inputs, not saved triangles. Coordinates are metres, +Y up, -Z north. */
export type PlanPoint = readonly [x: number, z: number];
export type Position = readonly [x: number, y: number, z: number];
export interface ComponentIdentity {
  id: string;
  label: string;
  source: string;
  confidence: "reference-derived" | "inferred" | "synthetic";
}
export interface Footprint extends ComponentIdentity {
  kind: "footprint";
  outline: readonly PlanPoint[];
  holes?: readonly (readonly PlanPoint[])[];
  base: number;
  height: number;
  /** Hidden bottoms are omitted by default. Enable for free-standing objects. */
  bottom?: boolean;
}
export interface RoadStation {
  left: Position;
  right: Position;
}
export interface RoadStrip extends ComponentIdentity {
  kind: "road-strip";
  /** Paired edge stations preserve variable width, crossfall and bridge levels. */
  stations: readonly RoadStation[];
}
export type Component =
  | Footprint
  | RoadStrip
  | HeightPatch
  | ControlSurface
  | AuthoredCellComponent
  | ConstructionSurface;
export interface GeometryData {
  positions: number[];
  indices: number[];
}
/** Sparse editable height controls, not mesh connectivity. Axes map parameters to XZ. */
export interface HeightPatch extends ComponentIdentity {
  kind: "height-patch";
  origin: PlanPoint;
  uAxis: PlanPoint;
  vAxis: PlanPoint;
  uKnots: readonly number[];
  vKnots: readonly number[];
  /** Row-major semantic elevations: heights[v][u]. */
  heights: readonly (readonly number[])[];
  tolerance: number;
  maxTriangles: number;
}
export interface ControlSurface extends ComponentIdentity {
  kind: "control-surface";
  outline: readonly PlanPoint[];
  controls: readonly { x: number; z: number; height: number }[];
  maxTriangles: number;
}

export interface AuthoredCellComponent
  extends ComponentIdentity, AuthoredCellSurface {
  kind: "authored-cells";
}

/** Code-defined authoring recipe loaded on demand; never a decoded mesh asset. */
export interface ConstructionSurface extends ComponentIdentity {
  kind: "construction-surface";
  generate: () => GeometryData;
  /** Local coordinate origin preserves small features in Float32 buffers. */
  origin?: Position;
}
