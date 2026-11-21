# Bounded lighter-terrain comparison

## Conclusion

The three predeclared variants save about **7% of terrain triangles and position-buffer bytes**. They do not establish a meaningful mobile-speed improvement, resolve the exterior **0.25 m MAE target**, or remove the large local errors. **No winner is selected and no deployment follows from this experiment.**

The same previously evaluated reference points were reused. Both the former held-out and confirmation sets are now descriptive comparison evidence, **not fresh independent acceptance evidence for selecting a variant**. Analytic coefficients, mapped controls, source data and sampling design remained unchanged. No residual-directed tuning or additional configurations were introduced after seeing results.

## Predeclared configurations

| Variant  | Global minimum depth | Geometry-only local floor                                                |
| -------- | -------------------: | ------------------------------------------------------------------------ |
| Baseline |                    6 | None; frozen candidate reproduced exactly                                |
| L1       |                    5 | None                                                                     |
| L2       |                    4 | Depth 6 along mapped boundary blend skirts and station transition strips |
| L3       |                    3 | Same depth-6 guards as L2                                                |

All retain the **0.075 m nominal refinement tolerance**, maximum depth **11**, hard cap **100,000 triangles**, quarter-grid analytic probes and conforming centre-fan topology. Guards use only frozen model geometry and its declared blend widths, never reference residuals. The existing estimator may refine beyond the local floor.

L2 and L3 produce **byte-identical meshes**. Lowering the global floor again therefore brings no further geometry saving in this bounded experiment.

## Geometry and construction work

| Variant  | Terrain triangles | Reduction | Float32 terrain bytes | Analytic evaluations during construction |
| -------- | ----------------: | --------: | --------------------: | ---------------------------------------: |
| Baseline |            76,716 |         — |             2,761,776 |                                  297,697 |
| L1       |            71,214 |     7.17% |             2,563,704 |                                  274,945 |
| L2 / L3  |            71,379 |     6.96% |             2,569,644 |                                  275,593 |

These are terrain-only counts, excluding buildings and the presentation shell. The complete collision proxy uses 78,784 triangles for baseline, 73,246 for L1 and 73,417 for L2/L3. Its reported packed-buffer bytes are respectively 5,987,584, 5,566,696 and 5,579,692; these figures exclude other JavaScript/BVH/renderer overhead.

## Same-point source-relative errors

All errors below are metres. Smaller means under coarser tessellation do not indicate a better analytic model: the analytic model is unchanged, and approximation can move residuals in either direction.

Previously held-out set, now reused for comparison: **3,000 full points; 2,089 exterior points**.

| Variant  | Full MAE | Exterior MAE | Full absolute p95 | Exterior absolute p95 | Maximum absolute, both scopes |
| -------- | -------: | -----------: | ----------------: | --------------------: | ----------------------------: |
| Baseline | 0.242745 |     0.264302 |          0.854292 |              0.932299 |                      3.016476 |
| L1       | 0.242065 |     0.263567 |          0.857134 |              0.929504 |                      3.016476 |
| L2 / L3  | 0.241735 |     0.263444 |          0.857134 |              0.929504 |                      3.016476 |

Former confirmation set, now reused for comparison: **3,050 full points; 2,128 exterior points**.

| Variant  | Full MAE | Exterior MAE | Full absolute p95 | Exterior absolute p95 | Maximum absolute, both scopes |
| -------- | -------: | -----------: | ----------------: | --------------------: | ----------------------------: |
| Baseline | 0.240784 |     0.260711 |          0.859840 |              0.888123 |                      3.826422 |
| L1       | 0.240177 |     0.259903 |          0.859613 |              0.888123 |                      3.826422 |
| L2 / L3  | 0.239868 |     0.259831 |          0.859613 |              0.888123 |                      3.826422 |

**Every exterior MAE remains above 0.25 m.** The first set's full p95 becomes slightly worse for the lighter meshes. The second set's exterior p95 and both sets' maxima are unchanged. No maximum-error acceptance threshold is invented, and the unchanged tails are not concealed by the small mean differences.

## Approximation, coverage and topology

- The worst additional analytic probe discrepancy remains **0.104336 m**, above the nominal 0.075 m estimator tolerance. Two maximum-depth cells remain unresolved in every configuration. The number of probed triangles exceeding tolerance is 12 baseline, 16 L1 and 12 L2/L3. Finite probes are not an error guarantee.
- On the reused confirmation points, mean facet-versus-analytic discrepancy increases from **0.006966 m** baseline to **0.010861 m** L1 and **0.011150 m** L2/L3. The meshes are lighter, but their average approximation of the frozen function is less close.
- Independent audit finds no sampled coverage gaps or multiple rendered heights across either reference set. Difficult points were retained, including the original multi-height reference observations and steep strata.
- Independent exact-float edge-incidence, upward-orientation and projected-area checks pass: no nonmanifold edges or projected-degenerate facets, boundary edges lie on the rectangle perimeter and boundary vertices have degree two. A separate 15,617-point deterministic coverage grid also has no gaps. These checks are not a formal all-pairs intersection proof or survey guarantee.

## Timing methodology and limitations

Each declared export was generated once with offline approximation auditing, then rebuilt twice without auditing; all repetitions reproduced its exact geometry hash. A separate instrumentation-only pass used three interleaved repetitions per unique mesh in the order baseline/L1/L2, L2/baseline/L1, L1/L2/baseline. L3 needs no separate unique-mesh profile because it is identical to L2.

The table reports medians from that interleaved pass in one cloud process. Total construction excludes offline approximation auditing, rendering and collision construction. Evaluator time is measured within refinement; “other refinement” excludes it. Component medians need not sum to the total median. Instrumentation overhead, JIT, allocation/GC and shared-machine noise remain included.

| Unique mesh | Construction median (range), s | Analytic evaluator, ms | Other refinement, ms | Mesh assembly, ms | Height-query BVH, ms | Collision build, ms |
| ----------- | -----------------------------: | ---------------------: | -------------------: | ----------------: | -------------------: | ------------------: |
| Baseline    |            3.888 (3.730–5.203) |                  2,958 |                  538 |               219 |                  189 |                 420 |
| L1          |            3.806 (3.408–4.088) |                  2,849 |                  533 |               229 |                  161 |                 380 |
| L2 / L3     |            3.843 (3.543–3.972) |                  2,935 |                  540 |               220 |                  185 |                 399 |

The run ranges overlap substantially; no material construction-time gain is demonstrated. Roughly three quarters of construction time is spent evaluating the analytic function; raw mesh assembly is a smaller cost. Headless collision sweeps passed during profiling, but this does not replace browser navigation review.

**No physical phone, mobile GPU, frame-rate, power or thermal measurements were made.** A 7% triangle reduction must not be presented as a proven mobile responsiveness improvement. A future optimization study should focus on avoiding repeated analytic work, evaluating safe evaluator optimizations, or moving construction off the main thread, with geometry-equivalence checks and real-device measurements. No such optimization is implemented or approved by this comparison.

## Frozen identities

- Baseline commit: `e51b564a9707c4c806ce6708646ad4265dc7b673`.
- Analytic model SHA-256: `2b6193dab3d7fdf31de264f237af228fd7830609c8650f82e8d3127147902b02`.
- Unchanged site-data SHA-256: `b9c535b5c5b46275db6fc9b0eaf201af4206e02df905bb42e4d1323112830670`.
- Predeclared protocol SHA-256: `a6d5a57eba266c4c0e9e062547cbb31b60a87c422a329bc0dc65660ef8253c25`.
- Baseline terrain SHA-256: `8d1fda23c1c3050f2ece704ab4233b8e3f0d1e4948e6995b5dd4b80608115ca6`.
- L1 terrain SHA-256: `f6f01aa7e54cbf248bb641031a2697916cdf4d728875d8978067dc5712946177`.
- L2 and L3 terrain SHA-256: `1b8262f2c4c6ae5e9e90cfd93f7c069a49d6870181c7e24b4a03280b90bdebd3`.

The original frozen checkout was not modified. Raw reference coordinates stayed with the auditor; only aggregate results were shared. No public push or deployment was made for this experiment.
