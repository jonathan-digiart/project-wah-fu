# Base model review gate

This is an implementation candidate, not approval of the estate reconstruction.

## Issue sequence

1. Coordinate convention and accepted boundary: one unit per metre, +Y up, −Z north, +X east. Grid conversion round trips are tested. Reference-boundary acceptance must be checked separately.
2. Simplified terrain: generated algorithmically from sparse semantic height controls; land and illustrative sea are separate. **Provisional: significant reference height errors remain.** It is not yet adequate to approve ground connections or walkability.
3. Building massing: short footprint envelopes extruded between reference minimum/maximum elevations. An envelope can include a roof/podium projection; uniform extrusion does not preserve stepped roof levels. It is not a measured ground-floor footprint.
4. Review navigation: orbit, pan, zoom, reset, north-up top view, building focus, responsive sidebar and readable failure state. A flat presentation underside is not geology.
5. Regression/owner gate: typed schema, unit geometry checks, no asset-loader regression, browser tests and owner comparison. Browser visual/performance tests must pass on a WebGL-enabled device before making corresponding claims.

No textures, facade fittings, imported meshes, photographic material or weathering in this phase. No automatic public release, merge or approval.

## Owner review order

- Verify crop outline, north, overall scale and relative building placement.
- Review supplied simplified forms against the authorised reference; record roof/podium exceptions.
- Review terrain only as an approximation. Do not sign off access routes, stairs or building-ground contacts until terrain refinement is tested.
- Try repeated building focus → top → reset, pinch/wheel zoom and two-finger/right-drag pan, in a small/mobile viewport.

## Private/public separation

The engine and synthetic tests are independent of private reference data. `public/site-data.json` is intentionally ignored by Git, but **is included in a local/private build when present**. Therefore a private `dist` must never be reused for a public deployment. Create public builds in a clean checkout without private parameters. Retain provenance and rights review outside the public repository. No licence has been selected for the project.
