/** Full-detail lossless WFTC v1 decoder. Does not own GPU resources or fetch requests. */
const MAX_BYTES = 64 * 1024 * 1024;
const abortError = () => new DOMException('Request cancelled', 'AbortError');
const checkAbort = signal => { if (signal?.aborted) throw abortError(); };
const integer = (x, lo, hi, name) => { if (!Number.isInteger(x) || x < lo || x > hi) throw Error(`Invalid ${name}`); return x; };
export function supportsCompactTerrain() { try { return typeof DecompressionStream === 'function' && !!new DecompressionStream('gzip'); } catch { return false; } }
/** Bounded decompression: abort reader on cancellation; reject rather than allocate unbounded output. */
export async function inflateCompactTerrain(bytes, {signal, expectedBytes, maxBytes = MAX_BYTES} = {}) {
  checkAbort(signal); integer(maxBytes, 16, MAX_BYTES, 'max decoded size');
  if (expectedBytes !== undefined) integer(expectedBytes, 16, maxBytes, 'expected decoded size');
  if (!supportsCompactTerrain()) throw Error('gzip decompression unsupported; use original GLB fallback');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader(); const chunks = []; let length = 0;
  const cancel = () => { void reader.cancel(abortError()).catch(() => {}); };
  signal?.addEventListener('abort', cancel, {once:true});
  try {
    for (;;) {
      checkAbort(signal); const {done,value} = await reader.read(); checkAbort(signal); if (done) break;
      length += value.byteLength;
      if (length > maxBytes || (expectedBytes !== undefined && length > expectedBytes)) { await reader.cancel(); throw Error('Compact decompression exceeds declared limit'); }
      chunks.push(value);
    }
    if (expectedBytes !== undefined && length !== expectedBytes) throw Error('Compact decoded byte count mismatch');
    const result = new Uint8Array(length); let at = 0;
    for (const c of chunks) { result.set(c,at); at += c.byteLength; }
    checkAbort(signal); return result.buffer;
  } finally { signal?.removeEventListener('abort', cancel); reader.releaseLock(); }
}
/** Decode exact Float32 corner attributes into renderer-ready typed arrays, never nested face arrays.
 * origin reproduces v62's (Float32 world position -> JS double subtraction -> Float32 GPU buffer).
 * normalizeNormals=true reproduces v62 GLB-reader normal-matrix normalization exactly.
 * includeUV=false skips the unused UV output allocation only, without modifying stored UV data.
 */
export function decodeCompactTerrain(buffer, {origin = [0,0,0], includeUV = true, normalizeNormals = false, signal, expectedId, expectedTriangles} = {}) {
  checkAbort(signal);
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 16 || buffer.byteLength > MAX_BYTES) throw Error('Invalid compact terrain buffer');
  if (!Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) throw Error('Invalid terrain origin');
  const d = new DataView(buffer);
  if (d.getUint32(0,true) !== 0x43544657 || d.getUint32(4,true) !== 1) throw Error('Unsupported compact terrain format');
  const headerLength = integer(d.getUint32(8,true),4,1024*1024,'header size'), payloadLength = d.getUint32(12,true), base = 16 + headerLength;
  if (headerLength % 4 || base + payloadLength !== buffer.byteLength) throw Error('Compact terrain size mismatch');
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,16,headerLength)));
  if (h.schema !== 'wah-fu.lossless-compact-terrain/1' || h.payloadBytes !== payloadLength || typeof h.id !== 'string') throw Error('Invalid compact terrain header');
  integer(h.triangles,1,1000000,'triangle count');
  if (expectedId !== undefined && h.id !== expectedId) throw Error('Compact terrain ID mismatch');
  if (expectedTriangles !== undefined && h.triangles !== expectedTriangles) throw Error('Compact terrain triangle count mismatch');
  if (!Array.isArray(h.primitives) || h.primitives.length < 1 || h.primitives.length > 64 || !Array.isArray(h.materials) || h.materials.length > 64) throw Error('Invalid compact primitive/material list');
  const parts=[]; let triangles=0;
  for (const p of h.primitives) {
    checkAbort(signal); integer(p.count,3,3000000,'corner count');
    if (p.count % 3 || triangles + p.count/3 > h.triangles) throw Error('Invalid primitive corner total');
    integer(p.material,0,h.materials.length-1,'material');
    const read = (name, components) => {
      const a = p.attributes?.[name]; if (!a || a.components !== components || ![2,4].includes(a.indexBytes)) throw Error('Invalid compact attribute');
      integer(a.count,1,3000000,'attribute count'); integer(a.tableOffset,0,payloadLength,'table offset'); integer(a.indexOffset,0,payloadLength,'index offset');
      if (a.tableOffset % 4 || a.indexOffset % a.indexBytes || a.tableOffset+a.count*components*4>payloadLength || a.indexOffset+p.count*a.indexBytes>payloadLength) throw Error('Compact attribute out of bounds');
      const values = new Float32Array(buffer,base+a.tableOffset,a.count*components);
      for (const v of values) if (!Number.isFinite(v)) throw Error('Non-finite compact attribute');
      const indices = a.indexBytes === 2 ? new Uint16Array(buffer,base+a.indexOffset,p.count) : new Uint32Array(buffer,base+a.indexOffset,p.count);
      for (const i of indices) if (i >= a.count) throw Error('Compact attribute index out of bounds');
      return {values,indices};
    };
    const position=read('POSITION',3),normal=read('NORMAL',3),texcoord=read('TEXCOORD_0',2);
    const data = new Float32Array(p.count*6), uv = includeUV ? new Float32Array(p.count*2) : null;
    for (let i=0;i<p.count;i++) {
      const pi=position.indices[i]*3,ni=normal.indices[i]*3,k=i*6;
      data[k]=position.values[pi]-origin[0]; data[k+1]=position.values[pi+1]-origin[1]; data[k+2]=position.values[pi+2]-origin[2];
      if (normalizeNormals) {
        // Exact identity normal-matrix arithmetic of the v62 GLB reader, including JS double normalization.
        const a=normal.values[ni],b=normal.values[ni+1],c=normal.values[ni+2];
        const nx=1*a+0*b+0*c,ny=0*a+1*b+0*c,nz=0*a+0*b+1*c,length=Math.hypot(nx,ny,nz);
        data[k+3]=length?nx/length:0; data[k+4]=length?ny/length:1; data[k+5]=length?nz/length:0;
      } else { data[k+3]=normal.values[ni]; data[k+4]=normal.values[ni+1]; data[k+5]=normal.values[ni+2]; }
      if (uv) { const ti=texcoord.indices[i]*2; uv[i*2]=texcoord.values[ti]; uv[i*2+1]=texcoord.values[ti+1]; }
    }
    parts.push({data,uv,material:p.material,count:p.count,origin:origin.slice(),sourcePrimitive:p.sourcePrimitive}); triangles+=p.count/3;
  }
  if (triangles !== h.triangles) throw Error('Compact terrain triangle count mismatch');
  checkAbort(signal); return {id:h.id,triangles,parts,materials:h.materials,bounds:h.bounds,sourceSha256:h.sourceSha256,fullDetail:true};
}
