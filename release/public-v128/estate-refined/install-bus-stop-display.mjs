import{createDependentGeometryGroup,exactGeometryIdentity}from'./atomic-geometry-group.mjs';
export const BUS_STOP_DISPLAY={"id":"context-roads-bus-stop-paved-strips-v126","file":"roads/bus-stop-paved-strips-v126.glb","sha256":"078654504b64ef1450b6f598aedfb6eb5930c9446a7878dd244fa58f87431234","bytes":15392,"triangles":199,"mode":"context","layer":"roads","bounds":{"min":[220.67302989959717,42.57918930053711,-214.04398155212402],"max":[241.97002983093262,43.00551223754883,-187.02801990509033]},"meaning":"Source-exact paved boarding/lane-dividing strips, aerial-supported surface classification; .035m display-only lift, no measured kerb-height or collision claim."};
export const BUS_STOP_TERRAIN_PINS=[{"id":"context-terrain-C-x2-z-3","file":"../estate-foundation/terrain/processed-context/terrain-context-C-x2-z-3.glb","sha256":"b36b6d6617676399698ccfa278870c99bdedacad3677aaf07bb11c90c7941622","bytes":1018044,"triangles":9283,"mode":"context","layer":"terrain"},{"id":"context-terrain-C-x2-z-2","file":"../estate-foundation/terrain/processed-context/terrain-context-C-x2-z-2.glb","sha256":"b9e776207919e45643608d9c31648fd420686d3229a4636997845bfacd4f8b5a","bytes":732288,"triangles":6710,"mode":"context","layer":"terrain"}];

export function installBusStopDisplay(cfg){
 if(cfg.chunks.some(e=>e.id===BUS_STOP_DISPLAY.id))throw Error('Duplicate bus-stop display');
 for(const p of BUS_STOP_TERRAIN_PINS){const es=cfg.chunks.filter(e=>e.id===p.id);if(es.length!==1||!exactGeometryIdentity(es[0],p))throw Error('Bus-stop terrain source mismatch: '+p.id);}
 const target={...BUS_STOP_DISPLAY,requiredTerrainIds:BUS_STOP_TERRAIN_PINS.map(e=>e.id),busStopDisplayPins:BUS_STOP_TERRAIN_PINS,atomicGeometryGroup:createDependentGeometryGroup('bus-stop-paved-strips-source-dependencies',[BUS_STOP_DISPLAY,...BUS_STOP_TERRAIN_PINS],BUS_STOP_DISPLAY.id)};
 return {...cfg,busStopDisplay:{enabled:true,displayOnly:true,collisionAccepted:false,sourceMarginIds:[1103278880,1103278894,1103278889]},chunks:[...cfg.chunks,target]};
}
export function guardBusStopDisplay(stage,resident,mode){
 const e=stage.draw.find(e=>e.id===BUS_STOP_DISPLAY.id);if(!e)return stage;
 const drawn=new Set(stage.draw.map(e=>e.id));
 const ready=mode==='context'&&[BUS_STOP_DISPLAY,...BUS_STOP_TERRAIN_PINS].every(p=>{const v=resident.get(p.id);return drawn.has(p.id)&&exactGeometryIdentity(v?.entry,p)&&v.parts?.length>0;});
 return ready?stage:{...stage,draw:stage.draw.filter(e=>e.id!==BUS_STOP_DISPLAY.id),fineReady:false,incomplete:true,buffering:true,busStopDisplayBlocked:true};
}
