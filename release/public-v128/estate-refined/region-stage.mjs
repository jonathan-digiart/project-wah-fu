import{atomicBlockedIds}from'./atomic-geometry-group.mjs';
import{adjacentRoadsDrawable}from'./road-join-readiness.mjs';
import{bootstrapOwnerReady}from'./bootstrap-fine-owner.mjs';
/** Select exactly one geometry representation per source region. No global swap. */
export function regionStage(selected,resident,mode,bootstrapActive,budgetSkipped=0,required=selected){
 if(mode!=='context')return {fineReady:false,bootstrapReady:false,buffering:false,veil:false,draw:selected.filter(e=>!e.retirementHidden&&resident.has(e.id)&&!e.layer.startsWith('bootstrap')),fallbackRegionIds:new Set()};
 const visible=required.filter(e=>e.view?.visible!==false&&!e.retirementHidden&&!e.bootstrapOwnerHidden&&!e.layer.startsWith('bootstrap'));
 const bundle=selected.find(e=>e.layer==='bootstrapRegions');
 const dependenciesReady=!(bundle?.bootstrapFineDependencyIds?.length)||bundle.bootstrapFineDependencyIds.every(id=>bootstrapOwnerReady(resident.get(id),id));
 const fallback=!!bundle&&resident.has(bundle.id)&&dependenciesReady,fallbackRegionIds=new Set(),unavailableRegionIds=new Set();
 if(!dependenciesReady)for(const id of bundle.bootstrapFineDependencyIds)if(!bootstrapOwnerReady(resident.get(id),id))unavailableRegionIds.add(id);
 const available=fallback?new Set((resident.get(bundle.id).parts||[]).map(p=>p.regionId).filter(Boolean)):new Set(),fineOnly=new Set(bundle?.fineOnlyRegionIds??[]);
 const visibleTerrain=new Set(visible.filter(e=>e.layer==='terrain').map(e=>e.id));
 const groups=[...new Map(required.filter(e=>e.atomicGeometryGroup).map(e=>[e.atomicGeometryGroup.id,e.atomicGeometryGroup])).values()];
 const atomicBlocked=atomicBlockedIds(groups,resident);
 const drawn=[],blockedRoadJoinIds=new Set();
 for(const e of visible){
  if(atomicBlocked.has(e.id)){unavailableRegionIds.add(e.id);if(e.layer==='roads')blockedRoadJoinIds.add(e.id);continue;}
  // Retained fallback road parts are exact fine-source parts; a declared
  // partial bundle can omit appended roads. Neither representation is shown
  // over simplified support terrain (only ~30 mm source clearance).
  const supportReady=e.layer!=='roads'||Array.isArray(e.requiredTerrainIds)&&e.requiredTerrainIds.length>0&&e.requiredTerrainIds.every(id=>!visibleTerrain.has(id)||resident.has(id));
  const fallbackTerrain=e.r05FallbackRequiredTerrainIds??e.requiredTerrainIds;
  const fallbackSupportReady=e.layer!=='roads'||Array.isArray(fallbackTerrain)&&fallbackTerrain.length>0&&fallbackTerrain.every(id=>!visibleTerrain.has(id)||resident.has(id));
  if(!supportReady&&!fallbackSupportReady)continue;
  const joinReady=adjacentRoadsDrawable(e,resident,visible,visibleTerrain);if(e.requiredRoadSources&&(!supportReady||!joinReady))blockedRoadJoinIds.add(e.id);
  if(resident.has(e.id)&&supportReady&&joinReady)drawn.push(e);else if(fallback&&fallbackSupportReady&&(!available||available.has(e.id)))fallbackRegionIds.add(e.id);else if(fineOnly.has(e.id)||bundle?.regionIds?.includes(e.id))unavailableRegionIds.add(e.id);
 }
 if(fallbackRegionIds.size)drawn.push(bundle);
 const fineReady=dependenciesReady&&!atomicBlocked.size&&!blockedRoadJoinIds.size&&visible.length>0&&visible.every(e=>resident.has(e.id))&&!budgetSkipped;
 return{atomicBlockedIds:atomicBlocked,fineReady,bootstrapReady:fallback,buffering:!!(fallbackRegionIds.size||unavailableRegionIds.size),incomplete:!fineReady,blockedRoadJoinIds,unavailableRegionIds,veil:!drawn.length&&!fineReady,draw:drawn,fallbackRegionIds};
}
