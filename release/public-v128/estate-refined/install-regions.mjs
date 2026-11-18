import{validateBootstrapOwners}from'./bootstrap-fine-owner.mjs';
import{validatePartialRoadFallback,PARTIAL_ROAD_FALLBACK_NOTE}from'./validate-partial-road-fallback.mjs';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export async function installRegions(catalogue,bytes,manifest,allowedFineOnly=[]){
 if(await hash(bytes)!==manifest.sourceCatalogueSha256)throw Error('Region fallback does not match source catalogue');
 const partial=validatePartialRoadFallback(catalogue,manifest,{roadId:'context-roads-B-king-pokfu-spatial',requirePartial:false});
 const ownerIds=validateBootstrapOwners(catalogue,manifest),owners=new Set(ownerIds);
 const source=catalogue.chunks.filter(e=>['context','shared'].includes(e.mode)&&!e.layer.startsWith('bootstrap')),regions=new Map(manifest.sourceRegions.map(r=>[r.id,r]));
 const fineOnly=new Set(allowedFineOnly);
 if((manifest.fineOnlyRegions?.length??0)!==fineOnly.size||fineOnly.size!==allowedFineOnly.length||manifest.sourceRegions.length!==regions.size||regions.size+fineOnly.size+owners.size!==source.length||source.some(e=>Number(regions.has(e.id))+Number(fineOnly.has(e.id))+Number(owners.has(e.id))!==1)||[...fineOnly].some(id=>!source.some(e=>e.id===id)))throw Error('Region fallback source identities differ');
 if(fineOnly.size)for(const e of source.filter(e=>e.layer==='roads')){
  const expected=source.filter(t=>t.layer==='terrain'&&[0,2].every(i=>e.bounds.min[i]<=t.bounds.max[i]&&e.bounds.max[i]>=t.bounds.min[i])).map(t=>t.id);
  if(JSON.stringify(regions.get(e.id)?.requiredTerrainIds)!==JSON.stringify(expected))throw Error('Fine-only road support coverage mismatch');
 }
 const chunks=catalogue.chunks.filter(e=>!e.layer.startsWith('bootstrap')).map(e=>e.layer==='roads'?{...e,requiredTerrainIds:regions.get(e.id)?.requiredTerrainIds}:e);
 const descriptor={...manifest.descriptor,file:'../estate-region-lod/region-fallback.wfr.gz',regionIds:[...regions.keys()],bootstrapFineDependencyIds:ownerIds,fineOnlyRegionIds:[...fineOnly]};
 if(descriptor.layer!=='bootstrapRegions'||descriptor.triangles*72!==descriptor.geometryBytes||descriptor.geometryBytes>16*1024*1024)throw Error('Invalid region fallback budget');
 return{...catalogue,partialRoadFallback:partial,partialRoadFallbackNote:partial?PARTIAL_ROAD_FALLBACK_NOTE:null,chunks:[descriptor,...chunks],regionalFallback:true};
}
export function shouldDrawPart(part,stage){return !part.regionId||stage.fallbackRegionIds?.has(part.regionId);}
