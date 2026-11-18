import {TUNNEL_TERRAIN_DESCRIPTOR} from './tunnel-terrain.mjs';
/** Assembly delta only; coordinator activates after independent gate. */
export function applyTunnelBDEast(catalogue){
 const id='context-terrain-B-x6-z-4-tunnel-carved',alias='context-terrain-B-x6-z-4-join-bd-16.4-tunnel',entries=catalogue?.chunks?.filter(e=>e.id===id);
 if(entries?.length!==1||Object.keys(TUNNEL_TERRAIN_DESCRIPTOR).some(k=>JSON.stringify(entries[0][k])!==JSON.stringify(TUNNEL_TERRAIN_DESCRIPTOR[k]))||entries[0].sha256!=='f41bc5b918d6c151a556d34602301a447a413c7b5b3405421f2a00b950215311'||entries[0].bytes!==1224200||entries[0].file!=='terrain-tunnel/terrain.glb'||entries[0].triangles!==9752||entries[0].layer!=='terrain'||catalogue.chunks.some(e=>e.id===alias))throw Error('Combined tunnel/BD requires exact reviewed local-carve source');
 const replacement={...entries[0],id:alias,file:'terrain-tunnel-bd/terrain.glb',sha256:'f8522038915536f3f15251fa11b6b214815d2f130cdfd6e4807c85f1af416470',bytes:1631056,triangles:18080};
 return{...catalogue,chunks:catalogue.chunks.map(e=>e.id===id?replacement:e)};
}
