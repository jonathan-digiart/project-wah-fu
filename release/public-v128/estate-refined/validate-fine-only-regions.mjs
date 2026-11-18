/** Only this reviewed, source-bound pair may omit combined fallback geometry. */
export const WAH_MEI_FINE_ONLY=Object.freeze([
 Object.freeze({id:'context-terrain-C-x2-z-1-wah-mei-west-building',sha256:'9236ed7e1a4cb07428769f8690522242a385c1f9a1044a7564589a0fab43c71b',triangles:4851}),
 Object.freeze({id:'context-terrain-C-x2-z0-wah-mei-west-building',sha256:'049258c3ce6ea3f35ed5051a76f11dbcf7d92e14fa919eec3f6676803c4daa12',triangles:7453})
]);
export function validateFineOnlyRegions(catalogue,manifest){
 const declared=manifest.fineOnlyRegions??[];
 if(!Array.isArray(declared))throw Error('Invalid fine-only coverage');
 const present=WAH_MEI_FINE_ONLY.filter(t=>catalogue.chunks.some(e=>e.id===t.id));
 if(!present.length&&!declared.length)return [];
 if(present.length!==2||declared.length!==2||new Set(declared.map(e=>e.id)).size!==2)throw Error('Incomplete fine-only terrain coverage');
 for(const t of WAH_MEI_FINE_ONLY){
  const sources=catalogue.chunks.filter(e=>e.id===t.id),d=declared.find(e=>e.id===t.id);
  if(sources.length!==1||!d||sources[0].sha256!==t.sha256||sources[0].triangles!==t.triangles||sources[0].layer!=='terrain'||sources[0].mode!=='context'||d.sourceSha256!==t.sha256||d.sourceTriangles!==t.triangles||d.policy!=='fine-only-terrain'||d.layer!=='terrain')throw Error('Fine-only terrain source identity mismatch');
  if(manifest.sourceRegions.some(e=>e.id===t.id)||manifest.regions?.some(e=>e.id===t.id))throw Error('Fine-only region also claims fallback');
 }
 return WAH_MEI_FINE_ONLY.map(t=>t.id);
}
export const FINE_ONLY_FALLBACK_NOTE='The two corrected Wah Mei terrain regions have no coarse fallback in this combined review. Gaps remain until their fine geometry loads; failed requests require Retry.';
/** Gaps must remain marked even while other regions have usable fallback. */
export function showFineOnlyGapMarker(stage,id){return stage?.unavailableRegionIds?.has(id)===true;}
