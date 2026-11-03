# Wah Mei pilot: reference and sampling proposal

Status: proposed reference and extent for owner review. Supports #9 and prepares #10; no runtime geometry change or public deployment. Baseline runtime is commit `348b19d7166fbee2ef01b6fb6bf6b048b3bf5e4b`; this report starts from documentation main `f2da5a7d42679d40fb50867f79ef893f3643d4ee`.

## Proposed scope and reference

Use the preserved original Lands Department 3D Visualisation Map (Non-textured models), tile 11-SW-22C, terrain object T31500120000106E10, as reference **WM-TERRAIN-01**. Wah Mei House is original building B321481231301063C0, not the later photo-derived model. The terrain and building occupy the same tile and coordinate system.

Proposed pilot: Wah Mei's approximate projected envelope bounding box expanded by 30 metres on each side. In the existing local x/z coordinates: x 189.52–341.36 m, z −49.52–30.90 m, a 151.84 m × 80.42 m area. It is wholly within the accepted site crop and reference tile. This does not change the whole-estate crop or claim that the buffer is a meaningful historical/physical boundary.

Official source uses Hong Kong 1980 Grid (EPSG:2326), metre heights above Hong Kong Principal Datum. Source glTF node transforms must be applied before local conversion; the terrain node includes a +1.291288 m height offset. Direct independent binary decoding agrees with existing Wah Mei bounds to centimetre rounding. This verifies the transform, not floor or entrance levels.

Source records identify a 2025–2026 publication/revision period; individual file-production timestamps are not observation dates. Exact capture epoch, local surveyed accuracy and current physical condition are unknown. Dataset-level accuracy statements are absolute ±0.30 m horizontal/±0.50 m vertical and relative ±0.20 m, with no local confidence assessment supplied.

## Source comparison

- **Preserved non-textured terrain, preferred for this pilot:** matches the legacy basis, known source identity/transform and full pilot coverage. Suitable for measuring fidelity to that source. Ground/road/podium semantics still require interpretation.
- **LandsD 5 m-grid DTM, not a replacement:** official metadata states ±5 m at 90% confidence, derived from 2014/2015 imagery; may include elevated structures and vegetation. It cannot substantiate the requested 0.5 m source-relative pilot target as a better ground reference.
- **iB1000 topographic mapping, possible supporting evidence:** separately coded features, 2 m contours and spot heights may clarify mapped roads/levels. No pilot feature extract or aligned local comparison is available yet. Published metadata contains differing usage statements; exact acquisition terms require checking before incorporating any new extracts.
- **CEDD 2020 LiDAR, possible later independent comparison:** official metadata records 2019-12 to 2020-02 acquisition, EPSG:2326 and HKPD. No pilot point cloud, classifications or validated local ground accuracy have been acquired. Older epoch, occlusion and above-ground returns must be assessed before choosing it.

## Frozen sampling plan

Before any pilot fitting, freeze two disjoint 2 m grids in the proposed extent, clipped to the accepted crop:

- Calibration: x,z=2k+0.5 m.
- Held-out fit check: x,z=2k+1.5 m.

Intersect only the original terrain category vertically; apply the complete source transform. Merge duplicate equal-height triangle-edge intersections at 0.00001 m. Retain all distinct hits and report the highest as the defined top surface. Report no-hit, multi-height, steep (>60°) and degenerate/zero-projection cases explicitly. Do not interpret a top terrain hit as a verified entrance or accessible path.

Report all points and strata outside all approximate building envelopes, under Wah Mei, and under other envelopes. Envelopes include possible overhangs/podium projections; these strata do not establish actual accessible ground. Raw source mesh, supporting samples and audit records remain private.

These are spatially disjoint samples from the same source, not independent survey truth. Calibration controls must not use held-out points. Because baseline summaries guide development, predeclare a separate final confirmation scheme before tuning, then evaluate it only after freezing the candidate. Never pick samples after seeing errors to improve a reported score.

## Baseline result: target not met

All held-out samples are retained in the full result. Heights compare the baseline runtime height sampler minus chosen source, in metres. This audit executes the actual TypeScript sampler. A separate offline intersection of the actual generated scene’s 1,293 terrain triangles at the same 3,000 held-out positions confirms complete coverage, no multiple hits, and a maximum sampler discrepancy of 0.000003268 m. Reported metrics are unchanged at the precision shown below; this is geometry verification, not browser visual QA.

| Stratum                                    |    n | Mean absolute difference | Signed bias | p95 absolute | Maximum absolute |
| ------------------------------------------ | ---: | -----------------------: | ----------: | -----------: | ---------------: |
| Full proposed pilot                        | 3000 |                    1.720 |      −1.122 |        4.818 |           10.337 |
| Outside all approximate building envelopes | 2089 |                    1.541 |      −0.738 |        4.111 |            6.833 |

There are no reference-coverage gaps in these samples; two multi-height points and 25 steep points are retained and flagged. The full maximum lies under another building envelope. Excluding steep samples does not explain the failure. These pilot values must not be compared numerically with the historical whole-estate 256-probe summary as if the sampling scope were identical.

Working target: mean absolute vertical difference ≤0.5 m against WM-TERRAIN-01, with 0.1 m stretch. Neither is met by this baseline. No numeric tail threshold has been adopted; local errors remain review findings regardless of a future mean. Source accuracy, physical ground correctness and procedural fidelity remain separate claims.

## What #10 can and cannot use

Source-only cross-sections show:

- An east-side near-level run around 25.762 m HKPD.
- Long north/south near-building runs around 32 m.
- A northern transition dropping about 5.58 m in 1.25 m.

These are source-observed samples, not yet validated two-dimensional platforms, wall topology, entrances or road identities. The original building minimum 25.856 m is not a uniform ground-floor/entrance elevation. Do not flatten surrounding terrain to it.

Next: review the reference and pilot extent; investigate bounded planes, slopes and transition locations from calibration/source evidence; assign stable feature IDs with observed/inferred/unknown status. Entrances, stair/ramp endpoints and route usability remain unknown until supported. Only then propose a bounded procedural terrain change, with the same held-out audit, preserved estate seams and camera tests.

## Sources and attribution

Source data: Lands Department, HKSAR Government, through the CSDI Portal. Government and relevant organisations retain source-data rights. Preserved acquisition terms and current CSDI terms permit conditional reuse with attribution/IP acknowledgement; no unrelated photographs or original meshes are published here. No Government endorsement.

- [Official non-textured dataset](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1742809441342_98380)
- [CSDI terms](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)
- [5 m-grid DTM features](https://www.landsd.gov.hk/en/spatial-data/open-data/kf_dtm.html)
- [iB1000 dataset](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1637223748322_25497)
- [iB1000 metadata](https://www.hkmapmeta.gov.hk/mcs/home/web/data/lands/iB1000.html)
- [CEDD LiDAR source and metadata](https://www.ginfo.cedd.gov.hk/geoopendata/eng/LIDAR.aspx)

## Verification and gates

Source archive/member identities, node transform, coordinate bounds and frozen split verified independently. Four offline regression checks cover transform, disjoint split, source hashes and sample retention/metrics. No runtime terrain replacement, browser regression run, mobile performance measurement or final fidelity pass is claimed. Owner review of this proposal and subsequently supported levels remains open.
