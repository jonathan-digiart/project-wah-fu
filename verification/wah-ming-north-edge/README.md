# Wah Ming straight north kerb

A reconstructed section against the **published v128** model, not a survey.
The whole straight north kerb is covered from X = 73.010002 to 92.800003 m.
The retaining curtain and bank crest share one set of Float32 stations. Five
editable foot stations and ten crest stations generate thirteen wall triangles,
down from 44 source faces. The crest and rear points of ten named grade
breaklines define nine planar bank zones, generated as 18 faces. The two-metre
rear crop ends within the bounded reference coverage, not at the top of the
wider slope. No other edges or adjacent terrain are claimed.

The accepted paving footprint and geometry are unchanged. The existing 25 mm
below-paving wall foot is retained within 1 mm; direct overlay verifies that the
paving meets the wall along the entire 19.79 m. The view draws 1,291 triangles
(1,260 paving + 13 wall + 18 bank). No model or image is loaded at runtime.

From the repository root with its locked Node environment and offline Python
dependencies NumPy and Shapely 2.x:

```sh
python verification/wah-ming-north-edge/verify.py
npm test
npm run build:procedural
```

The offline verifier independently parses SHA-pinned compressed assets and
compares their full intersecting domains to generated Float32 geometry. Error
bounds use affine extrema across every overlay or profile interval, not sample
points alone. The model-to-model tolerance is not real-world survey accuracy.
