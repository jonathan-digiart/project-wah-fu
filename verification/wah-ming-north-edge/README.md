# Wah Ming north-edge pilot

An isolated reconstructed section against the **published v128** model, not a
survey and not a complete carpark edge. It extends along north kerb stations
X = 76, 77.5, 79 and 80.5 m. The retained footprint and generated paving
are unchanged. Three profiled wall panels reproduce six Float32 reference
triangles exactly. A shared crest ties the curtain to a measured 1 m-deep
uphill bank; it stops before a source breakline. The 25 mm vertical overlap
below the paving is the original retaining-foot convention, not a visible
gap. No geometries are claimed beyond the stated span and width.

The isolated viewer renders the existing 1,260 paving triangles, six wall
triangles and six bank triangles. The camera initially frames the measured
join. Distant terrain, other carpark slopes, structures and public v128
are unchanged. Both new geometries use editable station and grade controls,
not a model or image. Published GLBs are used **only** in offline verification.

From the repository root with its locked Node environment and offline
Python dependencies NumPy and Shapely 2.x:

```sh
python verification/wah-ming-north-edge/verify.py
npm test
npm run build:procedural
```

The offline script independently parses pinned compressed assets and compares
them with the actual generated Float32 geometry. Bank height discrepancies
are evaluated continuously by plane overlay, not inferred from finite probes.
The model-to-model tolerance is 10 mm; it is not real-world accuracy.
