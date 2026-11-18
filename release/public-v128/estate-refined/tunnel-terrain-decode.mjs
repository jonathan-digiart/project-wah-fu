/** Exact target-only raw GLB adapter. Other terrain must use its existing path. */
import {decodeGLB} from './tunnel-glb.mjs';
export const TUNNEL_TERRAIN_ID='context-terrain-B-x6-z-4-tunnel-carved';
export const TUNNEL_TERRAIN_SHA='f41bc5b918d6c151a556d34602301a447a413c7b5b3405421f2a00b950215311';
export const TUNNEL_TERRAIN_LOCAL_ORIGIN=Object.freeze([630,56,-345]);
export const PROFILE_TERRAIN_SHA="cc0bd20ac97c2792221cab80936ad633bc9fcb1138be4ce994b448e4beb45386";
const eq=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((x,i)=>x===b[i]);
export async function decodeTunnelTerrain(request,signal){
 const start=performance.now(),fail=()=>{throw Error('Tunnel terrain identity/frame mismatch');};
 if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');
 if(request.format!=='glb'||request.entry?.id!==TUNNEL_TERRAIN_ID||request.entry.layer!=='terrain'||request.entry.triangles!==9752||!eq(request.origin,[244,32,-37]))fail();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.bytes)),b=>b.toString(16).padStart(2,'0')).join('');const profile=digest===PROFILE_TERRAIN_SHA;if(request.entry.sha256!==undefined&&request.entry.sha256!==digest)fail();if(request.entry.bytes!==undefined&&request.entry.bytes!==request.bytes.byteLength)fail();if(digest!==TUNNEL_TERRAIN_SHA&&!profile)fail();if(request.bytes.byteLength!==(profile?2040208:1224200))fail();
 const g=decodeGLB(request.bytes);if(g.triangles!==9752)fail();const groups=[[],[]];
 for(const f of g.faces){const i=eq(f.nodeOrigin,profile?[0,32,0]:[0,0,0])?0:eq(f.nodeOrigin,TUNNEL_TERRAIN_LOCAL_ORIGIN)?1:-1;if(i<0||f.material!==0||!f.n)fail();groups[i].push(f);}
 if(groups[0].length!==7275||groups[1].length!==2477)fail();
 const parts=groups.map((faces,i)=>{const origin=i?[...TUNNEL_TERRAIN_LOCAL_ORIGIN]:[...request.origin],data=new Float32Array(faces.length*18);let n=0;for(const f of faces)for(let j=0;j<3;j++){for(let k=0;k<3;k++)data[n++]=f.p[j][k]-origin[k];for(let k=0;k<3;k++)data[n++]=f.n[j][k];}return{origin,data,count:data.length/6,material:0};});
 if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');return{parts,triangles:9752,timing:{decodeDurationMs:performance.now()-start,totalDecodeDurationMs:performance.now()-start}};
}
