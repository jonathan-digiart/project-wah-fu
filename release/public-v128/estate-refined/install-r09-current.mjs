import{createDependentGeometryGroup}from'./atomic-geometry-group.mjs';
export const TARGET={"id": "context-roads-r09-continuation", "mode": "context", "layer": "roads", "file": "roads/r09-supported.glb", "sha256": "358a8f66aea3aed38d9eb3dd6bbf002afb6873ae9b36888e2005f79ab606f820", "bytes": 33380, "triangles": 451, "bounds": {"min": [688.8937497735023, 57.1442537009716, -230.0], "max": [695.0, 57.88084077835083, -208.54858016967773]}, "requiredTerrainIds": ["context-terrain-D-x6-z-3"], "meaning": "Approved bounded R09 continuation with inferred far level and thin 30\u2013154 mm modelled support; terrain unchanged. 191 top and 260 side faces, no duplicate bottom. Residual crease 1.786 degrees. Not surveyed or browser accepted."};
export const PINS={"false":[{"id":"context-terrain-D-x6-z-3","file":"../estate-foundation/terrain/processed-context/terrain-context-D-x6-z-3.glb","sha256":"c82d962fd36e98aa253dae993069b3bfe6afecd0bbb658f962b35cc66e9b4bc6","bytes":667196,"triangles":6175,"mode":"context","layer":"terrain"},{"id":"context-roads-B-king-pokfu-spatial","file":"roads/OVERPASS-final-off.glb","sha256":"3d1867919e41d3806e5c77e3744885d06b1856cca6c3306f4b48b0b49ae3de84","bytes":14607788,"triangles":133535,"mode":"context","layer":"roads"}],"true":[{"id":"context-terrain-D-x6-z-3","file":"../estate-foundation/terrain/processed-context/terrain-context-D-x6-z-3.glb","sha256":"c82d962fd36e98aa253dae993069b3bfe6afecd0bbb658f962b35cc66e9b4bc6","bytes":667196,"triangles":6175,"mode":"context","layer":"terrain"},{"id":"context-roads-B-king-pokfu-spatial","file":"roads/OVERPASS-final-enabled.glb","sha256":"70072cde75a1affd88634cff92688a1065fdc6c137ed611f692a77f46dd4d0f9","bytes":15151032,"triangles":139330,"mode":"context","layer":"roads"}]};
const keys=['id','file','sha256','bytes','triangles','mode','layer'];
const matches=(e,p)=>e&&keys.every(k=>e[k]===p[k]);
export function installR09Current(cfg,{enabled=false,m04Enabled,route}={}){
 if(!enabled)return cfg;
 if(route!=='estate-combined-region-lod'||typeof m04Enabled!=='boolean')throw Error('R09 explicit current combined route/variant required');
 const pins=PINS[String(m04Enabled)];for(const p of pins){const es=cfg.chunks.filter(e=>e.id===p.id);if(es.length!==1||!matches(es[0],p))throw Error('R09 current source mismatch: '+p.id);}
 if(cfg.chunks.some(e=>e.id===TARGET.id))throw Error('Duplicate R09');
 const bundles=cfg.chunks.filter(e=>e.layer==='bootstrapRegions');if(bundles.length!==1)throw Error('R09 fallback owner mismatch');
 const source=pins.find(e=>e.layer==='roads');
 return {...cfg,r09CurrentRecovery:{enabled:true,browserAccepted:false,collisionAccepted:false},chunks:[...cfg.chunks.map(e=>e===bundles[0]?{...e,fineOnlyRegionIds:[...new Set([...(e.fineOnlyRegionIds||[]),TARGET.id])]}:e),{...TARGET,requiredRoadSources:[source],r09CurrentPins:pins,atomicGeometryGroup:createDependentGeometryGroup('r09-exact-source-dependent',[TARGET,...pins],TARGET.id)}]};
}
export function guardR09Current(stage,resident,mode,required){
 const e=stage.draw.find(e=>e.id===TARGET.id);if(!e)return stage;
 const drawn=new Set(stage.draw.map(e=>e.id)),visible=new Set((required??e.r09CurrentPins).filter(x=>x.view?.visible!==false).map(x=>x.id));
 const ready=mode==='context'&&Array.isArray(e.r09CurrentPins)&&[TARGET,...e.r09CurrentPins].every(p=>{const v=resident.get(p.id);return (drawn.has(p.id)||!visible.has(p.id))&&matches(v?.entry,p)&&v.parts?.length>0;});
 return ready?stage:{...stage,draw:stage.draw.filter(x=>x.id!==TARGET.id),fineReady:false,incomplete:true,buffering:true,r09CurrentBlocked:true};
}
