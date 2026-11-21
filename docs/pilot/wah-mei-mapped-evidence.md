# Wah Mei pilot: mapped-feature evidence

Status: supporting evidence for issues #9–#10, not acceptance of a terrain candidate. No runtime geometry, approved estate crop, public deployment or selected elevation reference is changed by this report.

## Source and registration

The inspected source is Lands Department iB1000 FGDB sheet **T11-SW-22C**, listed in HKMS with revision date **30 July 2026**. Package SHA-256: `91e779fc966d6200ce1637e87f56be757c6cd125d1b10df3c98493ae03f7eaba`.

The geodatabase declares Hong Kong 1980 Grid (EPSG:2326). Provider metadata specifies Hong Kong Principal Datum for heights. Local conversion remains x = E − 831875, z = 812300 − N, with height along +Y. The approved pilot envelope is E 832064.52–832216.36, N 812269.10–812349.52. Feature intersection was tested geometrically, not only against bounding boxes.

The source is useful for mapped feature boundaries. It is **not a replacement for WM-TERRAIN-01**, the original non-textured 3D terrain chosen for fidelity measurement. Product revision, file timestamps and feature last-update dates are not necessarily survey/capture dates.

## Actual pilot coverage

- Twelve spot heights: nine ground (`SHG`) and three elevated (`SHE`). All elevated points are excluded from ground-level controls. Eight ground points have display status 0; the remaining display-status-99 ground point is withheld pending clarification.
- Eighteen relief lines: three slope-top (`ST`) and fifteen mixed cutting/retaining/small-slope (`VC`) lines.
- Ten artificial-slope (`UNC`) polygons and twelve cutting/retaining (`VCP`) polygons.
- No contour, slope-bottom (`SB`) or berm feature intersects this pilot.
- None of the selected full features touches the nominal sheet edge within 0.01 m. Thirteen selected line/polygon features extend beyond the pilot envelope; clipping them does not establish physical endpoints.

Most relevant records were last updated on 3 September 2023. Two selected slope polygons, 1107024178 and 1107024190, were updated on 17 October 2025. Their survey epochs and local uncertainty remain unresolved.

## Field interpretation safeguards

Geometry Z is effectively zero for the inspected spot/contour content; use the documented height attributes, not geometry Z, for elevations. `SLOPEANGLE` and `SLOPESIZE` are symbol/display attributes, not physical slope gradients. Keep raw precision/source/display codes where their meaning is not verified. Do not assign entrances, slab levels, stairs or accessible routes from these attributes.

A `VC` feature is a mixed class. Its presence supports a mapped boundary; it does not alone establish a vertical wall, wall height or discontinuity. Slope polygons have no elevation attribute.

## Boundaries that improve the model evidence

- The eastern cutting chain, VC 1106983585/1106983583 and VCP 1107013607/1107013605, follows approximately local x = 307.14 m from z = −18.95 to −37.53 m. VC 1106983582/VCP 1107013604 adds an eastward branch near z = −25.65 m. Original 3D sections still show a varying-width transition; a uniform vertical wall would be unsupported.
- Northwestern slope-top ST 1107001187 and artificial-slope polygon 1810038096 provide evidence for a nonrectangular northern region division.
- Western slope polygon 1107024178 and adjacent cutting features identify a coherent western region that the previous broad rectangular fit did not represent adequately.
- Southern slope polygons 1107024189/1107024190 and the smaller 1107024182 distinguish mapped slope bands. Internal relief and crest/toe elevations still require modelling evidence.
- Far-eastern slope/cutting features continue outside the pilot; their clipped ends must not be treated as closed physical features.

Simplified outlines are modelling candidates, not accepted geometry. Record simplification tolerance and measured displacement; preserve original feature IDs and full-versus-clipped distinctions. Original GIS geometries and raw source meshes are not included in this documentation change.

## Source-to-source height check

At the eight display-status-0 ground spot positions, original 3D terrain versus mapped height attributes differs by **0.289 m mean absolute difference**, with **0.631 m maximum**. Including the separately flagged ground point gives 0.349 m mean and 0.829 m maximum across nine points. Three elevated points are excluded from both results.

These sparse comparisons are not a global accuracy estimate. They show why mapped ground heights must remain consistency checks rather than being snapped into the model while claiming unchanged 3D-source fidelity. There is no evidence for a constant datum correction.

## Current modelling status and gates

The approved target remains mean absolute vertical difference **≤0.25 m**, aiming for **0.10 m**, against WM-TERRAIN-01. Always report full and exterior-building strata, signed bias, p95, maximum, coverage and steep/multiple-surface cases. This is source-relative fidelity, not surveyed accuracy.

Mapped-feature fitting has improved the available representation, but no candidate is accepted. Finer boundary simplification alone did not remove the remaining northern-transition and southern-relief errors. Failed calibration experiments are not runtime releases; reserved held-out/final points have not been used to fit them.

Next: resolve specific feature-supported shape gaps; freeze a bounded mathematical candidate; measure generated-surface approximation and joins to unchanged exterior terrain; run independent fidelity, camera and device-performance checks. Do not close the pilot issues, claim route usability, merge or deploy based on this evidence report alone.

The pilot itself is covered by 22C. For subsequent full-estate continuity, neighbouring sheet coverage must be verified separately against the accepted land boundary; neighbouring downloads do not change the pilot reference or extent.

## Attribution and official sources

Map data: Lands Department, Government of the Hong Kong SAR, through HKMS/CSDI. Government and relevant organisations retain intellectual-property rights. Reuse is subject to the linked CSDI terms, including attribution, indemnity and warranty exclusions. No Government endorsement or blanket relicensing is implied.

- [Official iB1000 product search](https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB1000)
- [Exact FGDB product page](https://open.hkmapservice.gov.hk/OpenData/productView?productName=iB1000&sheetName=T11-SW-22C&productFormat=FGDB&locale=en)
- [CSDI Terms and Conditions](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)
- [iB1000 metadata](https://www.hkmapmeta.gov.hk/mcs/home/web/data/lands/iB1000.html)
- [Official FGDB feature specification](https://www.landsd.gov.hk/doc/en/mapping/digital-map/common/feature/ib1_fgdb_mf.pdf)
