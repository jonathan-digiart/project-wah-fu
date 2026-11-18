import{validateFineOnlyRegions,FINE_ONLY_FALLBACK_NOTE}from'./validate-fine-only-regions.mjs';
import{validatePartialRoadFallback}from'./validate-partial-road-fallback.mjs';
import{installRegions}from'./install-regions.mjs';
/** Bind to the deterministic composed catalogue, before adding runtime cameras. */
export async function installCombinedRegions(composedCatalogue,manifest){
 if(manifest.sourceCatalogueBinding!=='JSON.stringify(applyCombinedJoins(originalCatalogue))')throw Error('Combined region fallback binding is invalid');
 const partial=validatePartialRoadFallback(composedCatalogue,manifest);
 const bytes=new TextEncoder().encode(JSON.stringify(composedCatalogue));
 const fineOnly=validateFineOnlyRegions(composedCatalogue,manifest);
 const cfg=await installRegions(composedCatalogue,bytes,manifest,fineOnly);
 return{...cfg,fineOnlyFallbackNote:fineOnly.length?FINE_ONLY_FALLBACK_NOTE:null,partialRoadFallback:partial,partialRoadFallbackNote:partial?'Additional roads appear with fine detail; their fallback is intentionally omitted to preserve the memory cap.':null,chunks:cfg.chunks.map(e=>e.layer==='bootstrapRegions'?{...e,file:'../estate-combined-region-lod/region-fallback.wfr.gz'}:e)};
}
