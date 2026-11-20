# Inclined terrain pilot

Two non-flat grade recipes reproduce 1,300 m² of disjoint accepted v128
terrain. Ten domains cover 1,058 m² of a roughly 9.54% northern incline;
three cover 242 m² of a roughly 1.55% lower coastal grade. A plane is
represented by a datum and two grade derivatives, and each domain by its
plan bounds. All 26 triangles are generated at runtime. No source geometry
or asset is embedded in the recipe.

The independent offline sampler seeded candidate domains; verification
then clipped every intersecting reference face against the accepted
rectangles. Area residual and pairwise projected overlap are below 1e-7 m²
in each included domain, and the maximum continuous height difference on
the positive-area clipped surfaces is 9.512 mm, independently verified
by clipping against the actual generated Float32 triangles. A low coastal candidate outside these domains
was not accepted because its projected-overlap measure exceeded that
numerical threshold. This is a height-surface comparison, not a vertical
retaining face certificate.

Two touching coastal tiles are generated separately from the same grade
parameters; their shared edge at X=256 has identical endpoint coordinates
and thus identical interpolated edge heights. The other tested domains
are separated by unfinished terrain; this does not certify their external
joins. No viewer or public release integration.
