import{atomicGeometryReady}from'./atomic-geometry-group.mjs';
const keys=['id','file','sha256','bytes','triangles','mode','layer'];
export function adjacentRoadSourcesReady(entry,resident){
 if(!entry.requiredRoadSources)return true;
 return entry.requiredRoadSources.length>0&&entry.requiredRoadSources.every(source=>{
  const value=resident.get(source.id);
  return value?.parts?.length>0&&keys.every(k=>JSON.stringify(value.entry?.[k])===JSON.stringify(source[k]));
 });
}
export function adjacentRoadsDrawable(entry,resident,visible,visibleTerrain){
 if(!entry.requiredRoadSources)return true;
 return adjacentRoadSourcesReady(entry,resident)&&entry.requiredRoadSources.every(source=>{
  const e=visible.find(x=>x.id===source.id);
  return e&&(!e.atomicGeometryGroup||atomicGeometryReady(e.atomicGeometryGroup,resident))&&e.layer==='roads'&&!e.requiredRoadSources&&Array.isArray(e.requiredTerrainIds)&&e.requiredTerrainIds.length>0&&e.requiredTerrainIds.every(id=>!visibleTerrain.has(id)||resident.has(id));
 });
}
