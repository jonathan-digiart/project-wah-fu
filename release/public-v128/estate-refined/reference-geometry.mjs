// Zero-length point contacts are not artificial line cuts. Preserve them in
// the reference data, but render only actual line components.
export function referenceLinePaths(g){if(!g)return[];if(g.type==='LineString')return[g.coordinates];if(g.type==='MultiLineString')return g.coordinates;if(g.type==='GeometryCollection')return g.geometries.flatMap(referenceLinePaths);return[];}
