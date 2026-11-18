/** Target-only three-frame terrain adapter; ordinary terrain keeps its existing decode path. */
import{decodeGLB,sub,cross,unit}from'./glb.mjs';
import{inflateCompactTerrain,decodeCompactTerrain}from'./decode-compact-terrain.mjs';
const EXPECTED_ID='context-terrain-C-x3-z-1-join-6.287',COMPACT_ID='C-x3-z-1-join-6.287';
const GLB_SHA='c2dc711f2e7808bc800696ae1b9fc6b5d910804c5fcf655255307c2a2fedc29e',COMPACT_SHA='86651bb2992a280ac543d3347df4e417e3428a81ac6dacee9e5411ba8ce3d84b',TOTAL=5981,SOURCE_TRIANGLES=3348,REMAINDER_TRIANGLES=168,PATCH_TRIANGLES=2465;
const PATCH_ORIGIN=Object.freeze([375,11,-70]),REMAINDER_ORIGIN=Object.freeze([488,0,0]),SOURCE_ORIGIN=Object.freeze([244,32,-37]);
const same=(a,b)=>Array.isArray(a)&&a.length===3&&a.every((x,i)=>x===b[i]);
const fail=()=>{throw Error('Bounded-join geometry identity or local frame mismatch');};
const check=signal=>{if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')};
export async function decodeJoinVariant(request,signal){
 const begin=performance.now();check(signal);
 if(request.entry?.id!==EXPECTED_ID||request.entry.layer!=='terrain'||request.entry.triangles!==TOTAL||!same(request.origin,SOURCE_ORIGIN)||!['glb','compact'].includes(request.format))fail();
 const got=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.bytes)),n=>n.toString(16).padStart(2,'0')).join('');check(signal);if(got!==(request.format==='glb'?GLB_SHA:COMPACT_SHA))fail();
 if(request.format==='compact'){
  if(request.compactId!==COMPACT_ID)fail();const raw=await inflateCompactTerrain(request.bytes,{signal,expectedBytes:request.decodedBytes}),inflateEnd=performance.now();
  // Two bounded decodes, of this one small variant chunk only, avoid changing
  // the established WFTC decoder or ordinary chunk data/normal arithmetic.
  const options={includeUV:false,normalizeNormals:true,signal,expectedId:COMPACT_ID,expectedTriangles:TOTAL};
  const source=decodeCompactTerrain(raw,{...options,origin:SOURCE_ORIGIN}),local=decodeCompactTerrain(raw,{...options,origin:[0,0,0]});
  if(source.parts.length!==3||local.parts.length!==3||source.parts.some((p,i)=>p.sourcePrimitive!==i||p.material!==0)||local.parts.some((p,i)=>p.sourcePrimitive!==i||p.material!==0)||source.parts[0].count!==SOURCE_TRIANGLES*3||local.parts[1].count!==REMAINDER_TRIANGLES*3||local.parts[2].count!==PATCH_TRIANGLES*3)fail();
  const remainder={...local.parts[1],origin:[...REMAINDER_ORIGIN]},patch={...local.parts[2],origin:[...PATCH_ORIGIN]},parts=[source.parts[0],remainder,patch];
  return{parts,triangles:TOTAL,timing:{inflateDurationMs:inflateEnd-begin,decodeDurationMs:performance.now()-inflateEnd,totalDecodeDurationMs:performance.now()-begin}};
 }
 const parsed=decodeGLB(request.bytes);if(parsed.triangles!==TOTAL||parsed.faces.length!==TOTAL)fail();
 const groups=[[],[],[]];for(const f of parsed.faces){if(f.material!==0||!f.n)fail();const i=same(f.nodeOrigin,[0,0,0])?0:same(f.nodeOrigin,REMAINDER_ORIGIN)?1:same(f.nodeOrigin,PATCH_ORIGIN)?2:-1;if(i<0)fail();groups[i].push(f);}
 if(groups[0].length!==SOURCE_TRIANGLES||groups[1].length!==REMAINDER_TRIANGLES||groups[2].length!==PATCH_TRIANGLES)fail();
 const parts=groups.map((faces,i)=>{const origin=i===0?[...SOURCE_ORIGIN]:i===1?[...REMAINDER_ORIGIN]:[...PATCH_ORIGIN],data=new Float32Array(faces.length*18);let q=0;for(const f of faces){const flat=unit(cross(sub(f.p[1],f.p[0]),sub(f.p[2],f.p[0])));for(let j=0;j<3;j++){for(let k=0;k<3;k++)data[q++]=f.p[j][k]-origin[k];for(let k=0;k<3;k++)data[q++]=(f.n?.[j]||flat)[k];}}return{origin,data,count:data.length/6,material:0};});
 return{parts,triangles:TOTAL,timing:{decodeDurationMs:performance.now()-begin,totalDecodeDurationMs:performance.now()-begin}};
}
