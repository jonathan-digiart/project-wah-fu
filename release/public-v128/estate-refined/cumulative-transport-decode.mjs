/** Explicit gzip transport; does not rely on HTTP Content-Encoding. */
const abortError = () => new DOMException('Gzip transport cancelled','AbortError');
const checkAbort = signal => {if(signal?.aborted) throw abortError();};
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
const fields=['file','bytes','sha256','rawBytes','rawSha256'];
export function createCumulativeGzipDecoder({pins,decodeGeometry,createDecompressionStream=()=>new DecompressionStream('gzip')}={}){
 if(!Array.isArray(pins)||typeof decodeGeometry!=='function') throw TypeError('Gzip decoder requires fixed pins and delegate');
 const pinned=pins.map(p=>Object.freeze({...p}));
 for(const p of pinned){if(!p.id||p.variant!=='review-cumulative'||!['roads','terrain'].includes(p.layer)||!p.file||![p.bytes,p.rawBytes,p.triangles].every(n=>Number.isSafeInteger(n)&&n>0)||p.rawBytes>64*1024*1024||! /^[a-f0-9]{64}$/.test(p.sha256)||! /^[a-f0-9]{64}$/.test(p.rawSha256))throw Error('Invalid gzip transport pin');}
 if(new Set(pinned.map(p=>p.id+'\0'+p.variant)).size!==pinned.length)throw Error('Duplicate gzip transport pin');
 return async function decodeTransport(request,signal){
  checkAbort(signal);
  const pin=pinned.find(p=>p.id===request.entry?.id&&p.variant===request.m04Variant);
  if(!pin||request.format!=='glb-gzip'||request.entry.layer!==pin.layer||request.entry.triangles!==pin.triangles||request.transport?.encoding!=='gzip'||['id','variant','triangles'].some(k=>request.transport[k]!==undefined&&request.transport[k]!==pin[k])||fields.some(k=>request.transport[k]!==pin[k])||Object.prototype.toString.call(request.bytes)!=='[object ArrayBuffer]'||request.bytes?.byteLength!==pin.bytes)throw Error('Gzip transport identity or variant mismatch');
  // Both immutable wire identity and bounded output size are established before allocation.
  if(await hash(request.bytes)!==pin.sha256)throw Error('Gzip transport SHA mismatch');
  checkAbort(signal);
  let decompressor;
  try{decompressor=createDecompressionStream();}catch(cause){throw new Error('Gzip decompression unavailable; use explicit original-geometry fallback',{cause});}
  const ledger={compressedInputBytes:pin.bytes,rawBufferBytes:pin.rawBytes,maximumReadChunkBytes:0,peakKnownInflateBytes:pin.bytes+pin.rawBytes,rawAllocatedBuffers:1,bytesWritten:0,rendererOutputBytes:pin.triangles*72,conservativeKnownDecodeBytes:pin.bytes+2*pin.rawBytes+pin.triangles*72,scope:'Known compressed input, one raw buffer, observed output chunk; decode estimate additionally allows one raw-sized GLB slice and renderer output. Excludes stream/crypto engine internals, JS objects, GPU and process memory.'};
  const raw=new Uint8Array(pin.rawBytes);
  const input=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(request.bytes));controller.close();}});
  let reader;
  try{reader=input.pipeThrough(decompressor).getReader();}catch(cause){throw new Error('Gzip decompression unavailable; use explicit original-geometry fallback',{cause});}
  let cancelPromise=null,completed=false;
  const cancel=()=>{cancelPromise??=reader.cancel(abortError()).catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
   for(;;){
    checkAbort(signal);
    const {done,value}=await reader.read();
    checkAbort(signal);
    if(done){completed=true;break;}
    if(!ArrayBuffer.isView(value))throw Error('Invalid gzip output chunk');
    ledger.maximumReadChunkBytes=Math.max(ledger.maximumReadChunkBytes,value.byteLength);
    ledger.peakKnownInflateBytes=Math.max(ledger.peakKnownInflateBytes,pin.bytes+pin.rawBytes+value.byteLength);
    if(value.byteLength>pin.rawBytes-ledger.bytesWritten)throw Error('Gzip raw output exceeds pinned size');
    raw.set(new Uint8Array(value.buffer,value.byteOffset,value.byteLength),ledger.bytesWritten);
    ledger.bytesWritten+=value.byteLength;
   }
   if(ledger.bytesWritten!==pin.rawBytes)throw Error('Gzip raw output truncated');
  }catch(error){
   if(!completed){try{await reader.cancel(error);}catch{}}
   throw signal?.aborted?abortError():error;
  }finally{
   signal?.removeEventListener('abort',cancel);
   if(cancelPromise)await cancelPromise;
   reader.releaseLock();
  }
  checkAbort(signal);
  if(await hash(raw.buffer)!==pin.rawSha256)throw Error('Inflated GLB identity SHA mismatch');
  checkAbort(signal);
  const decoded=await decodeGeometry({...request,format:'glb',bytes:raw.buffer},signal);
  return {...decoded,transportAllocation:ledger};
 };
}
