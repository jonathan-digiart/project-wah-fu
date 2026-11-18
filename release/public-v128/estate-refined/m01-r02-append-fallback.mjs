const rawPins={"base": {"file": "../estate-road-trial/roads-upper-gaps.glb", "sha256": "8b0b9c80406664a69554d4be0fbfc0c0f99f4d0ff0a352cbf335a7b95a80597a", "bytes": 5933264, "jsonBytes": 50224, "binaryBytes": 5883012}, "sidecar": {"file": "M01-R02-COMBINED.append", "sha256": "10fb44318e77448c7e077028b1119490e83e560d0b5c51c088d2f83cb8826abf", "bytes": 169100, "targetJsonBytes": 56836, "appendedBinaryBytes": 112248}, "target": {"sha256": "1ac8ac56187c127f2cfa47d972bc6811fee12050855947bd78ed16d8433b3204", "bytes": 6052124, "binaryBytes": 5995260, "triangles": 65852}};
export const M01_APPEND_PINS=Object.freeze(Object.fromEntries(Object.entries(rawPins).map(([k,v])=>[k,Object.freeze(v)])));
const abort=()=>new DOMException('M01 append transport cancelled','AbortError');
const check=s=>{if(s?.aborted)throw abort();};
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export const M01_APPEND_WIRE_BYTES=rawPins.base.bytes+rawPins.sidecar.bytes;
// Caller must hold one existing source permit for this complete operation.
// No nested gate and no decoder/admission/owner mutation in this helper.
export function createM01AppendTransport({fetch,readResponseBytes}={}){
 if(typeof fetch!=='function'||typeof readResponseBytes!=='function')throw TypeError('Production fetch and bounded reader required');
 return async function fetchM01Target(entry,guard,{cache='default',onProgress,onStreamSupport}={}){
  if(!guard?.signal||typeof guard.phase!=='function'||typeof guard.throwIfAborted!=='function')throw TypeError('Production load guard required');
  if(entry?.id!=='context-roads-B-king-pokfu-spatial'||entry.layer!=='roads'||entry.sha256!==rawPins.target.sha256||entry.bytes!==rawPins.target.bytes||entry.triangles!==rawPins.target.triangles)throw Error('M01 target descriptor identity mismatch');
  if(!['default','no-store'].includes(cache))throw Error('Unsupported M01 cache policy');
  if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Invalid M01 progress callback');
  if(onStreamSupport!==undefined&&typeof onStreamSupport!=='function')throw TypeError('Invalid M01 stream callback');
  let lastBodyCompletedMs=null;const streamSupport={};let completedWire=0;const signal=guard.signal;check(signal);
  const get=async(pin,name)=>{
   check(signal);guard.phase('m01-'+name+'-headers');check(signal);
   const response=await fetch(pin.file,{signal,cache});check(signal);if(!response.ok)throw Error('M01 '+name+' HTTP '+response.status);streamSupport[name]=typeof response.body?.getReader==='function';onStreamSupport?.({...streamSupport});
   guard.phase('m01-'+name+'-body',{deadlineMs:300000});const bytes=await readResponseBytes(response,{...guard,expectedBytes:pin.bytes,onProgress:n=>onProgress?.(completedWire+n)});check(signal);lastBodyCompletedMs=performance.now();
   guard.phase('m01-'+name+'-hash');if(await hash(bytes)!==pin.sha256)throw Error('M01 '+name+' SHA mismatch');check(signal);completedWire+=pin.bytes;return bytes;
  };
  const base=await get(rawPins.base,'base'),delta=await get(rawPins.sidecar,'delta');check(signal);
  guard.phase('m01-reconstruct');const bd=new DataView(base),dd=new DataView(delta),p=rawPins;
  if(bd.getUint32(0,true)!==0x46546c67||bd.getUint32(4,true)!==2||bd.getUint32(8,true)!==p.base.bytes||bd.getUint32(12,true)!==p.base.jsonBytes||bd.getUint32(16,true)!==0x4e4f534a||bd.getUint32(20+p.base.jsonBytes,true)!==p.base.binaryBytes||bd.getUint32(24+p.base.jsonBytes,true)!==0x004e4942)throw Error('M01 base GLB layout mismatch');
  if(dd.getUint32(0,true)!==0x4431304d||dd.getUint32(4,true)!==1||dd.getUint32(8,true)!==p.sidecar.targetJsonBytes||dd.getUint32(12,true)!==p.sidecar.appendedBinaryBytes||16+p.sidecar.targetJsonBytes+p.sidecar.appendedBinaryBytes!==delta.byteLength)throw Error('M01 delta layout mismatch');
  const target=new Uint8Array(p.target.bytes),td=new DataView(target.buffer),json=p.sidecar.targetJsonBytes;
  td.setUint32(0,0x46546c67,true);td.setUint32(4,2,true);td.setUint32(8,p.target.bytes,true);td.setUint32(12,json,true);td.setUint32(16,0x4e4f534a,true);
  target.set(new Uint8Array(delta,16,json),20);td.setUint32(20+json,p.target.binaryBytes,true);td.setUint32(24+json,0x004e4942,true);
  target.set(new Uint8Array(base,28+p.base.jsonBytes,p.base.binaryBytes),28+json);target.set(new Uint8Array(delta,16+json,p.sidecar.appendedBinaryBytes),28+json+p.base.binaryBytes);
  check(signal);guard.phase('m01-target-hash');if(await hash(target.buffer)!==p.target.sha256)throw Error('M01 reconstructed target SHA mismatch');check(signal);
  const output=p.target.triangles*72,slices=p.target.bytes-28;
  return{bytes:target.buffer,timing:{fetchEnd:lastBodyCompletedMs,hashEnd:performance.now(),scope:'Fetch interval includes base verification between sequential requests; final hash interval includes sidecar verification, reconstruction and target verification.'},streamSupport,transportAllocation:{baseInputBytes:p.base.bytes,sidecarInputBytes:p.sidecar.bytes,wireBytes:M01_APPEND_WIRE_BYTES,targetBytes:p.target.bytes,knownReconstructionBytes:M01_APPEND_WIRE_BYTES+p.target.bytes,glbSliceBytes:slices,rendererOutputBytes:output,conservativeKnownDecodeBytes:M01_APPEND_WIRE_BYTES+p.target.bytes+slices+output,scope:'Conservatively retains both wire inputs plus reconstructed target, GLB chunk slices and renderer output. Excludes stream/crypto internals, JS objects, GPU/driver and process memory; does not assume GC.'}};
 };
}
