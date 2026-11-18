/** WFRB1: bounded display-only per-region fallback. Does not fetch, upload, or own GPU state. */
const MAX_BYTES=32*1024*1024,MAX_PARTS=2048,MAX_REGIONS=512;
const abort=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export async function inflateRegionFallback(bytes,{expectedBytes,maxBytes=MAX_BYTES,signal}={}){
 abort(signal);if(!integer(expectedBytes,16,maxBytes)||!integer(maxBytes,16,MAX_BYTES))throw Error('Invalid fallback decoded size');
 const result=new Uint8Array(expectedBytes),reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let size=0;
 const cancel=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{for(;;){abort(signal);const{done,value}=await reader.read();abort(signal);if(done)break;size+=value.byteLength;if(size>expectedBytes||size>maxBytes){await reader.cancel();throw Error('Fallback decompression exceeds declared size');}result.set(value,size-value.byteLength);}if(size!==expectedBytes)throw Error('Fallback decoded size mismatch');return result.buffer;}finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
}
export function decodeRegionFallback(buffer,{expectedGeometryBytes,expectedRegionIds,signal}={}){
 abort(signal);if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<16||buffer.byteLength>MAX_BYTES)throw Error('Invalid fallback buffer');const d=new DataView(buffer),headerBytes=d.getUint32(8,true),payloadBytes=d.getUint32(12,true);
 if(d.getUint32(0,true)!==0x42524657||d.getUint32(4,true)!==1||!integer(headerBytes,4,1024*1024)||headerBytes%4||16+headerBytes+payloadBytes!==buffer.byteLength||payloadBytes%24)throw Error('Invalid fallback header');
 const h=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,16,headerBytes)));if(h.schema!=='wah-fu.region-fallback/1'||h.geometryBytes!==payloadBytes||!Array.isArray(h.parts)||!integer(h.parts.length,1,MAX_PARTS)||!Array.isArray(h.regions)||!integer(h.regions.length,1,MAX_REGIONS))throw Error('Invalid fallback metadata');if(expectedGeometryBytes!==undefined&&expectedGeometryBytes!==payloadBytes)throw Error('Fallback geometry size mismatch');
 const regions=new Map();for(const r of h.regions){if(typeof r.id!=='string'||r.id.length>160||regions.has(r.id)||!['terrain','houses','surroundings','estateAssociated','base','sea','roads'].includes(r.layer)||!['context','shared'].includes(r.mode)||!integer(r.triangles,1,1000000)||!integer(r.geometryBytes,72,MAX_BYTES)||!r.bounds||!['min','max'].every(k=>Array.isArray(r.bounds[k])&&r.bounds[k].length===3&&r.bounds[k].every(Number.isFinite))||r.bounds.min.some((v,i)=>v>r.bounds.max[i]))throw Error('Invalid fallback region');regions.set(r.id,{...r,parts:[]});}
 if(expectedRegionIds){const ids=new Set(expectedRegionIds);if(ids.size!==regions.size||[...ids].some(id=>!regions.has(id)))throw Error('Fallback region identity mismatch');}
 for(const r of regions.values())if(r.requiredTerrainIds!==undefined&&(!Array.isArray(r.requiredTerrainIds)||r.requiredTerrainIds.some(id=>regions.get(id)?.layer!=='terrain')))throw Error('Invalid fallback road support');
 let offset=0;const parts=[];for(const p of h.parts){abort(signal);const r=regions.get(p.regionId);if(!r||p.layer!==r.layer||!integer(p.count,3,3000000)||p.count%3||p.byteOffset!==offset||p.byteLength!==p.count*24||offset+p.byteLength>payloadBytes||!Array.isArray(p.origin)||p.origin.length!==3||!p.origin.every(Number.isFinite)||!(typeof p.material==='string'&&p.material.length<=160||integer(p.material,0,1024)||p.material===null))throw Error('Invalid fallback part');const data=new Float32Array(buffer,16+headerBytes+offset,p.count*6);for(const v of data)if(!Number.isFinite(v))throw Error('Nonfinite fallback geometry');const part={regionId:p.regionId,layer:p.layer,material:p.material,origin:p.origin,count:p.count,data};parts.push(part);r.parts.push(part);offset+=p.byteLength;}
 if(offset!==payloadBytes)throw Error('Incomplete fallback payload');for(const r of regions.values())if(r.parts.reduce((s,p)=>s+p.count/3,0)!==r.triangles||r.parts.reduce((s,p)=>s+p.data.byteLength,0)!==r.geometryBytes)throw Error('Fallback region count mismatch');// Isolated region-owned prototype: validate all input first, then copy per region.
 abort(signal);
 for(const region of regions.values()){
  const owned=new ArrayBuffer(region.geometryBytes);let at=0;
  for(const part of region.parts){abort(signal);const data=new Float32Array(owned,at,part.data.length);data.set(part.data);part.data=data;at+=data.byteLength;}
  if(at!==owned.byteLength)throw Error('Region ownership size mismatch');
 }
 abort(signal);
 return{parts,regions:[...regions.values()],geometryBytes:payloadBytes};
}
