/** Exact target-only raw GLB adapter. Other terrain must use its existing path. */
import {decodeGLB,sub,cross,unit} from './tunnel-glb.mjs';
export const TUNNEL_BD_TERRAIN_ID='context-terrain-B-x6-z-4-join-bd-16.4-tunnel';
export const TUNNEL_BD_TERRAIN_SHA='f8522038915536f3f15251fa11b6b214815d2f130cdfd6e4807c85f1af416470';
export const TUNNEL_BD_TERRAIN_LOCAL_ORIGIN=Object.freeze([630,56,-345]);
const eq=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((x,i)=>x===b[i]);
async function decodeOriginalTerrain(request,signal){
 const start=performance.now(),fail=()=>{throw Error('Tunnel terrain identity/frame mismatch');};
 if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');
 if(request.bytes?.byteLength!==1631056||request.format!=='glb'||request.entry?.id!==TUNNEL_BD_TERRAIN_ID||request.entry.layer!=='terrain'||request.entry.triangles!==18080||!eq(request.origin,[244,32,-37]))fail();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==TUNNEL_BD_TERRAIN_SHA)fail();
 const g=decodeGLB(request.bytes);if(g.triangles!==18080)fail();const groups=[[],[],[]];
 for(const f of g.faces){const i=eq(f.nodeOrigin,[0,0,0])?0:eq(f.nodeOrigin,TUNNEL_BD_TERRAIN_LOCAL_ORIGIN)?1:eq(f.nodeOrigin,[675,50,-300])?2:-1;if(i<0||f.material!==0)fail();groups[i].push(f);}
 if(groups[0].length!==7156||groups[1].length!==2477||groups[2].length!==8447)fail();
 const parts=groups.map((faces,i)=>{const origin=i===2?[675,50,-300]:i?[...TUNNEL_BD_TERRAIN_LOCAL_ORIGIN]:[...request.origin],data=new Float32Array(faces.length*18);let n=0;for(const f of faces)for(let j=0;j<3;j++){for(let k=0;k<3;k++)data[n++]=f.p[j][k]-origin[k];for(let k=0;k<3;k++)data[n++]=(f.n?.[j]||unit(cross(sub(f.p[1],f.p[0]),sub(f.p[2],f.p[0]))))[k];}return{origin,data,count:data.length/6,material:0};});
 if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');return{parts,triangles:18080,timing:{decodeDurationMs:performance.now()-start,totalDecodeDurationMs:performance.now()-start}};
}

export async function decodeTunnelBDTerrain(request,signal){if(request.bytes?.byteLength!==1773460)return decodeOriginalTerrain(request,signal);if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(request.format!=='glb'||request.entry?.id!==TUNNEL_BD_TERRAIN_ID||request.entry.layer!=='terrain'||request.entry.triangles!==18080||!eq(request.origin,[244,32,-37]))throw Error('Paired overpass terrain identity mismatch');const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(sha!=='7c52822a90863c10516902c63efdf0f100aef1d0b4a75416dd2daa186fd97fda')throw Error('Paired overpass terrain source hash mismatch');const g=decodeGLB(request.bytes),origins=[[0,0,0],[630,56,-345],[675,50,-300],[0,32,0]],counts=[7078,2477,8447,78],groups=origins.map(()=>[]);for(const f of g.faces){const i=origins.findIndex(o=>eq(o,f.nodeOrigin));if(i<0||f.material!==(i===3?2:0))throw Error('Paired terrain frame mismatch');groups[i].push(f);}if(groups.some((g,i)=>g.length!==counts[i]))throw Error('Paired terrain part counts');const parts=groups.map((faces,i)=>{const origin=i?origins[i]:[...request.origin],data=new Float32Array(faces.length*18);let n=0;for(const f of faces)for(let j=0;j<3;j++){for(let k=0;k<3;k++)data[n++]=f.p[j][k]-origin[k];for(let k=0;k<3;k++)data[n++]=(f.n?.[j]||unit(cross(sub(f.p[1],f.p[0]),sub(f.p[2],f.p[0]))))[k];}return{origin,data,count:data.length/6,material:0};});if(signal?.aborted)throw new DOMException('Cancelled','AbortError');return{parts,triangles:18080};}
