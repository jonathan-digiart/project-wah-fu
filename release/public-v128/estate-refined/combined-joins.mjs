import{applyCombinedRoadSnapshot,COMBINED_ROAD_SNAPSHOT_NOTE}from'./combined-road-snapshot.mjs';
import{applyTunnelTerrain}from'./tunnel-terrain.mjs';
import{applyTunnelBDEast}from'./apply-tunnel-bd.mjs';
import{applyWahMeiWest,WAH_MEI_WEST_ENTRIES,WAH_MEI_WEST_CAMERA}from'./wah-mei-west.mjs';
import{applyABNorth,AB_NORTH_CAMERA,AB_NORTH_ID}from'./ab-north-join.mjs';
import{applyWiderJoin,WIDER_CAMERA,WIDER_ID}from'./wider-join.mjs';
import{applyDirectedAC,DIRECTED_AC_CAMERA,DIRECTED_AC_ENTRIES}from'./directed-ac.mjs';
import{applyCDNext,CD_NEXT_CAMERA,CD_NEXT_ID}from'./cd-next-join.mjs';
import{applyABNext,AB_NEXT_CAMERA,AB_NEXT_ID}from'./ab-next-join.mjs';
import{applyBDNext,BD_NEXT_CAMERA,BD_NEXT_ID}from'./bd-next-join.mjs';
import{applyBDEast,BD_EAST_CAMERA,BD_EAST_ID}from'./bd-east-join.mjs';
export const COMBINED_QUERY='joins-reviewed';
export const COMBINED_FOCI=Object.freeze({
 'joins-all-wah-mei':{label:'Wah Mei western landing',camera:WAH_MEI_WEST_CAMERA},
 'joins-all':{label:'Overview',camera:{yaw:-.35,pitch:.8,pivot:[260,45,-350],halfSpan:480,publicHome:false}},
 'joins-all-wah-mei':{label:'Western Wah Mei landing',camera:WAH_MEI_WEST_CAMERA},
 'joins-all-ab':{label:'A/B 21.5 m',camera:WIDER_CAMERA},
 'joins-all-ac':{label:'Approved A/C Sheet A + prior 4.98 m',camera:DIRECTED_AC_CAMERA},
 'joins-all-cd':{label:'C/D 10.5 m',camera:CD_NEXT_CAMERA},
 'joins-all-ab-next':{label:'A/B 1.25 m',camera:AB_NEXT_CAMERA},
 'joins-all-bd':{label:'B/D 7.1 m',camera:BD_NEXT_CAMERA},
 'joins-all-ab-north':{label:'A/B north 2.4 m',camera:AB_NORTH_CAMERA},
 'joins-all-bd-east':{label:'B/D east 16.4 m',camera:BD_EAST_CAMERA}
});
export const COMBINED_IDS=Object.freeze([WIDER_ID,...DIRECTED_AC_ENTRIES.map(e=>e.id),CD_NEXT_ID,AB_NEXT_ID,BD_NEXT_ID,'context-terrain-B-x6-z-4-join-bd-16.4-tunnel',AB_NORTH_ID,...WAH_MEI_WEST_ENTRIES.map(e=>e.id)]);
export function applyCombinedJoins(catalogue){let out=applyCombinedRoadSnapshot(catalogue);for(const apply of[applyWiderJoin,applyDirectedAC,applyCDNext,applyABNext,applyBDNext,applyTunnelTerrain,applyTunnelBDEast,applyABNorth,applyWahMeiWest])out=apply(out);const ids=out.chunks.map(e=>e.id);if(new Set(ids).size!==ids.length||COMBINED_IDS.some(id=>ids.filter(v=>v===id).length!==1))throw Error('Combined join source identities are not unique');return{...out,contextNote:COMBINED_ROAD_SNAPSHOT_NOTE+' Seven bounded join areas, the western Wah Mei landing correction and the source-bounded tunnel carve across ten source chunks, including the approved A/C Sheet-A correction and its preserved prior patch. Original geometry elsewhere preserved; the tunnel carve retains the source floor, walls and deck. New road surfaces are visual geometry, not new walking support. This is not whole-estate completion, an exact weld, surveyed ground, physical clearance or collision approval. B/D east boundary residual is sampled, not exhaustive analytic proof. This comparison has camera protection OFF. Approved A/C and western Wah Mei corrections are composed separately for the protected default after its collision gate. Wah Mei uses micrometre-scale clipping, not an exact watertight weld; eastern frontage is excluded.'};}
export function combinedComparisonURL(href,treated,focus='joins-all'){if(!Object.hasOwn(COMBINED_FOCI,focus))throw Error('Unknown combined focus');const u=new URL(href);u.searchParams.delete('appearance');u.searchParams.set('camera','unprotected');u.searchParams.set('encoding','glb');u.searchParams.set('focus',focus);if(treated)u.searchParams.set('terrain',COMBINED_QUERY);else u.searchParams.delete('terrain');return u.href;}
export function installCombinedUI(document,href){const host=document.querySelector('#combined-join-links');if(!host)return;const p=new URL(href).searchParams,selected=p.get('terrain')===COMBINED_QUERY;for(const[focus,value]of Object.entries(COMBINED_FOCI)){const row=document.createElement('p');row.textContent=value.label+': ';for(const treated of[false,true]){const a=document.createElement('a');a.href=combinedComparisonURL(href,treated,focus);a.textContent=treated?'Reviewed terrain · v113 roads':'Original terrain · current roads';if(p.get('focus')===focus&&selected===treated)a.setAttribute('aria-current','true');row.append(a,document.createTextNode(' · '));}host.append(row);}}
