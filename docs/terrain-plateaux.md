# Flat terrain coverage experiment

The experimental module generates 16 nonoverlapping flat patches from plan
extents and one editable elevation each. Together they cover **158,266 m² of
new area**, including 148,042 m² of low coastal context and 10,224 m² of
higher-elevation patches. These are selected flat areas, not reconstructed
shoreline slopes, retaining cuts or estate-wide terrain. The existing
4,410 m² coastal pilot is excluded from the area.

The output is 32 triangles. The accepted v128 reference contains 1,055
positive-area face/patch intersections over the same rectangles (one source
face may occur in several patches; this is not a unique source-face total or a
whole-scene count).

An offline verifier intersected every potentially overlapping accepted terrain
triangle with each rectangle. For positive-area intersections, the vertical
difference against a flat candidate is affine, so its absolute maximum occurs
at a clipped polygon vertex. Maximum double-precision difference across all
patches was 4.995 mm including the 63.35 m patches; converting the datums to
Float32 adds less than 0.004 mm. Per-patch coverage area residual was below
1e-7 m² and pairwise projected overlap below 1e-7 m². This comparison is for
positive-area height surfaces only, not zero-projected-area vertical faces.
Where these patches touch each other or the existing pilot, their datums
match; joins to the surrounding unfinished terrain have not been verified.

No candidate source-face indices, imagery or mesh assets are used at runtime.
The experiment is not wired into the published viewer.
