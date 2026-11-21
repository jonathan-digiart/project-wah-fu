# Experimental adjacent tile geometry

Dependency-free engineering fixtures only. Not a geographic terrain model, validated site reconstruction, production renderer or release change.

Run `npm test` from this directory. The experiment has its own package scripts and does not alter repository-root checks. Node 22+ is required; no dependency installation is needed.

`src/geometry.mjs` builds indexed Float32 surface arrays from an explicit bounded synthetic plane or wave. All levels share a canonical integer perimeter lattice; sparse interior centre fans stitch to that perimeter. Shared edges and four-way corners coincide without making every tile fully dense. Height queries interpolate those same canonical triangles. Out-of-domain sampling is rejected.

`src/lod-policy.mjs` is a pure projected-radius selector with caller-supplied entry/exit thresholds, previous selections and an optional fine-tile cap. Hysteresis prevents threshold oscillation. No thresholds are represented as established performance targets.

`test/geometry-policy.node.mjs` runs independently of the asynchronous manager. It checks coarse/fine seams, corners, winding, area, render/query agreement, coverage, domain rejection and hysteresis.

This experiment does not validate geographic accuracy, materials/shading, browser frame rate, GPU memory, camera collision or real-scene integration. Positions and query heights share Float32 precision; a renderer must use these same arrays without independently rebuilding edges.

An optional follow-on change adds asynchronous worker generation and lifecycle management. Its adapter contract is documented separately.
