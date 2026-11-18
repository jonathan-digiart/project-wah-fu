import{validatePartialRoadFallback}from'./validate-partial-road-fallback.mjs';
import{installRegions}from'./install-regions.mjs';
/** Bind to the deterministic composed catalogue, before adding runtime cameras. */
export async function installApprovedRegions(composedCatalogue,manifest){
 if(manifest.sourceCatalogueBinding!=='JSON.stringify(applyApprovedTerrain(originalCatalogue))')throw Error('Approved region fallback binding is invalid');
 const partial=validatePartialRoadFallback(composedCatalogue,manifest);
 const bytes=new TextEncoder().encode(JSON.stringify(composedCatalogue));
 const cfg=await installRegions(composedCatalogue,bytes,manifest);
 return{...cfg,partialRoadFallback:partial,partialRoadFallbackNote:partial?'Additional roads appear with fine detail; their fallback is intentionally omitted to preserve the memory cap.':null,chunks:cfg.chunks.map(e=>e.layer==='bootstrapRegions'?{...e,file:'../estate-approved-region-lod/region-fallback.wfr.gz'}:e)};
}
