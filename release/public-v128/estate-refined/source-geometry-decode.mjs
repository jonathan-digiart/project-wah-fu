import{roadFinishRole,ROAD_FINISH_ROLE}from'./road-finish.mjs';
import{inflateRegionFallback,decodeRegionFallback}from'./decode-region-fallback.mjs';
import{decodeGLB,cross,sub,unit}from'./glb.mjs';
import{inflateCompactTerrain,decodeCompactTerrain}from'./decode-compact-terrain.mjs';
import{BOOTSTRAP_TERRAIN_LAYOUT}from'./appearance.mjs';
export async function decodeGeometry(request,signal){
 if(request.entry?.id==='context-terrain-B-x6-z-4-tunnel-carved')return(await import('./tunnel-terrain-decode.mjs')).decodeTunnelTerrain(request,signal);
 if(request.entry?.id==='context-terrain-B-x6-z-4-join-bd-16.4-tunnel')return(await import('./tunnel-bd-terrain-decode.mjs')).decodeTunnelBDTerrain(request,signal);
 if(['context-terrain-A-x3-z-4-directed-ab-b','context-terrain-C-x3-z-3-directed-cd-d'].includes(request.entry?.id))return(await import('./directed-other-decode.mjs')).decodeDirectedOther(request,signal);
 if(['context-terrain-C-x2-z-1-wah-mei-west-building','context-terrain-C-x2-z0-wah-mei-west-building'].includes(request.entry?.id))return(await import('./wah-mei-west-decode.mjs')).decodeWahMeiWest(request,signal);
 if(request.entry?.id==='context-terrain-C-x3-z-1-join-6.287')return(await import('./join-variant-decode.mjs')).decodeJoinVariant(request,signal);
 if(request.entry?.id==='context-terrain-A-x3-z-5-join-ab-21.5')return(await import('./wider-join-decode.mjs')).decodeWiderJoin(request,signal);
 if(request.entry.layer==='bootstrapRegions'){const begin=performance.now(),raw=await inflateRegionFallback(request.bytes,{signal,expectedBytes:request.decodedBytes}),parsed=decodeRegionFallback(raw,{signal,expectedGeometryBytes:request.entry.geometryBytes,expectedRegionIds:request.entry.regionIds});return{parts:parsed.parts,triangles:parsed.geometryBytes/72,timing:{totalDecodeDurationMs:performance.now()-begin}};}
 if(['context-terrain-C-x-2-z-4-directed-ac-a','context-terrain-C-x-2-z-3-directed-ac-a'].includes(request.entry?.id))return(await import('./directed-ac-decode.mjs')).decodeDirectedAC(request,signal);
 if(['context-terrain-C-x-2-z-4-join-ac-4.98','context-terrain-C-x-2-z-3-join-ac-4.98'].includes(request.entry?.id))return(await import('./ac-join-decode.mjs')).decodeACJoin(request,signal);
 if(request.entry?.id==='context-terrain-C-x3-z-3-join-cd-10.5')return(await import('./cd-next-join-decode.mjs')).decodeCDNext(request,signal);
 if(request.entry?.id==='context-terrain-A-x3-z-4-join-ab-1.25')return(await import('./ab-next-join-decode.mjs')).decodeABNext(request,signal);
 if(request.entry?.id==='context-terrain-A-x3-z-6-join-ab-2.4')return(await import('./ab-north-join-decode.mjs')).decodeABNorth(request,signal);
 if(request.entry?.id==='context-terrain-B-x5-z-4-join-bd-7.1')return(await import('./bd-next-join-decode.mjs')).decodeBDNext(request,signal);
 if(request.entry?.id==='context-terrain-B-x6-z-4-join-bd-16.4')return(await import('./bd-east-join-decode.mjs')).decodeBDEast(request,signal);
 const begin=performance.now();let parsed,parts;
 if(request.format==='compact'){
  const raw=await inflateCompactTerrain(request.bytes,{signal,expectedBytes:request.decodedBytes}),inflateEnd=performance.now();
  parsed=decodeCompactTerrain(raw,{origin:request.origin,includeUV:false,normalizeNormals:true,signal,expectedId:request.compactId,expectedTriangles:request.entry.triangles});
  return{parts:parsed.parts,triangles:parsed.triangles,timing:{inflateDurationMs:inflateEnd-begin,decodeDurationMs:performance.now()-inflateEnd,totalDecodeDurationMs:performance.now()-begin}};
 }
 if(request.entry.layer==='bootstrapTerrain'){
  const digest=await crypto.subtle.digest('SHA-256',request.bytes);
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');
  const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==BOOTSTRAP_TERRAIN_LAYOUT.sha256||request.entry.triangles!==BOOTSTRAP_TERRAIN_LAYOUT.triangles)throw Error('Unverified temporary terrain layout');
 }
 parsed=decodeGLB(request.bytes);if(parsed.triangles!==request.entry.triangles)throw Error('Chunk triangle count does not match catalogue');
 const roadRoles=request.entry.layer==='roads'?parsed.materials.map(roadFinishRole):[];
 const groups=new Map();for(const [index,f]of parsed.faces.entries()){const finishRole=request.entry.layer==='roads'?roadRoles[f.material]:null;const k=finishRole?'road-finish:'+f.nodeOrigin.join(','):request.entry.layer==='bootstrapTerrain'?(index<BOOTSTRAP_TERRAIN_LAYOUT.landTriangles?0:1):request.entry.layer==='roads'?'road:'+f.nodeOrigin.join(','):(request.entry.layer==='terrain'||request.entry.layer.startsWith('bootstrap'))?(f.material??0):0;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(f);}
 parts=[];for(const [material,faces]of groups){const origin=request.entry.layer==='roads'?faces[0].nodeOrigin:request.origin,data=new Float32Array(faces.length*18);let i=0;for(const f of faces){const flat=unit(cross(sub(f.p[1],f.p[0]),sub(f.p[2],f.p[0])));for(let j=0;j<3;j++){for(let k=0;k<3;k++)data[i++]=f.p[j][k]-origin[k];for(let k=0;k<3;k++)data[i++]=(f.n?.[j]||flat)[k];}}parts.push({origin,data,count:data.length/6,material:typeof material==='string'&&material.startsWith('road-finish:')?ROAD_FINISH_ROLE:material});}
 return{parts,triangles:parsed.triangles,timing:{decodeDurationMs:performance.now()-begin,totalDecodeDurationMs:performance.now()-begin}};
}
