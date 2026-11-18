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
export type Component = Footprint | RoadStrip;
export interface GeometryData {
  positions: number[];
  indices: number[];
}
