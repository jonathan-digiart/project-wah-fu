import{regionStage}from'./region-stage.mjs';
/** Stage gating: never mix provisional terrain/base/sea/roads with final terrain. */
export function stageState(selected,resident,mode,bootstrapActive,budgetSkipped=0,allowZoomOutBuffer=false,required=selected){
 if(selected.some(e=>e.layer==='bootstrapRegions'))return regionStage(selected,resident,mode,bootstrapActive,budgetSkipped,required);
 const visible=selected.filter(e=>e.view?.visible!==false),final=visible.filter(e=>!e.layer.startsWith('bootstrap'));
 const fineReady=final.length>0&&final.every(e=>resident.has(e.id))&&!budgetSkipped;
 const terrainPreview=visible.find(e=>e.layer==='bootstrapTerrain'),bootstrapReady=!!terrainPreview&&visible.filter(e=>e.layer.startsWith('bootstrap')).every(e=>resident.has(e.id));
 const buffering=allowZoomOutBuffer&&mode==='context'&&!bootstrapActive&&!fineReady&&bootstrapReady;
 const coarse=mode==='context'&&(bootstrapActive||buffering);
 const hidden=new Set(coarse?['terrain','base','sea','roads','houses','estateAssociated','surroundings']:['bootstrapTerrain','bootstrapBase','bootstrapBuildings']);
 const draw=visible.filter(e=>resident.has(e.id)&&!hidden.has(e.layer));
 return{fineReady,bootstrapReady,buffering,veil:mode==='context'&&bootstrapActive&&!bootstrapReady,draw:mode==='context'&&bootstrapActive&&!bootstrapReady?[]:draw};
}
