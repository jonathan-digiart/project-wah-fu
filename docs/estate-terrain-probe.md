# Estate terrain feasibility: regular level grids

This is an exploratory offline comparison, not a replacement terrain or a
survey accuracy claim. The reference is the accepted composed fine terrain:
98 context chunks, 352,818 triangles. Four diagnostic chunks and bootstrap
fallback are excluded. Source meshes were read only for offline comparisons;
the runtime generator takes scalar elevations and station axes, not assets.

Using 207,460 staggered plan probes, 169,457 had reference terrain. The upper
source height was used where multiple source faces cover the same plan point;
16 holdout probes encountered more than 10 mm of conflicting source heights.
Counts below are candidate triangles before any further boundary processing.
Error is on the common covered probes, not a continuous bound.

| Station spacing | Triangles | Missing reference probes | Median error | P95 error | Max error |
| --------------- | --------: | -----------------------: | -----------: | --------: | --------: |
| 16 m            |     5,139 |                    5,090 |        97 mm |    2.23 m |   13.66 m |
| 8 m             |    20,851 |                    2,695 |        21 mm |    1.07 m |   16.09 m |
| 4 m             |    84,193 |                    1,114 |       3.8 mm |    473 mm |    9.17 m |
| 2 m             |   337,919 |                      530 |     0.095 mm |    198 mm |   10.07 m |

A finer uniform grid does not preserve sharp changes or source boundaries.
Reject all four as fidelity candidates. Preserve explicit ownership at
source overlaps, the shoreline and terrain edge, slopes and retaining
breaklines, and shared road/terrain edge levels before adaptive refinement.
The next verification needs both missing/extra-area and seam checks, and a
continuous height bound on declared equivalent regions.

## Recovered C-side ownership pilot

The old C/D analytic trial lies in a 0.4 m × 15.72 m footprint. Its adaptive
version reproduces its own synthetic dense reference, but differs from accepted
v128 by up to 53.68 mm on 39,375 holdouts. The old processed-C control matches
v128 to floating-point tolerance over those probes. At the exact eastern seam
the higher D face can own the point, so interpolating its level over the C
side would change that surface.

The procedural pilot generates 512 triangles from 297 scalar elevation
stations on the accepted C side. In the actual TypeScript Float32 output,
all 39,375 independent holdouts were covered and within 10 mm of v128:
p95 1.189 mm, maximum 4.581 mm. This uses 79% fewer triangles than the
2,440-triangle processed-C export for this footprint, not than the whole
estate terrain. The pilot stops 0.1 mm before the east ownership seam and
does not establish a joined patch, continuous error bound, or visual parity.

## Discovered low coastal plane

An error-driven rectangular search over the southwest coastal pilot found
a 4,410 m² accepted low-plane region (X 200–305, Z 78–120). The training
lattice required an unambiguous source height within 5 mm of 1.3 m.
A separate shifted lattice covered all 106,480 probes, with maximum sampled
error 0.0161 mm and no source height conflicts. Clipping each accepted
source face to the rectangle gave 20 positive-area faces, projected area
sum 4,410 m² and maximum affine height difference 0.0161 mm.
The area sum and staggered probes are not a formal planar-union proof.

Two independent procedural tiles use a shared exact datum and boundary at
X 300, four triangles total. The accepted reference showed no material
height step across the 421 paired seam samples. The 20 source faces count
intersections before clipping rather than generated facets, so it is a
local complexity proxy. This verifies neither the curved shoreline nor
any land-side road or retaining surface.
