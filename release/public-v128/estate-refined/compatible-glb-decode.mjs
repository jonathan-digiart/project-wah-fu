/** Isolated compatibility successor. Original inputs retain the original decoder API;
 * replacement inputs require their explicit variant and immutable content identity. */
import {sets} from './sets.mjs';
import {originalCompactPins} from './compatible-original-pins.mjs';
import {decodeGeometry as replacementDecode} from './replacement-geometry-decode.mjs';
import {decodeGeometry as refinedDecode} from './source-geometry-decode.mjs';
const checkAbort = signal => {if(signal?.aborted) throw new DOMException('Cancelled','AbortError');};
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const descriptorMatches = (entry,pin) => ['id','layer','triangles'].every(k=>entry[k]===pin[k]) && ['file','sha256','bytes','mode','bounds'].every(k=>entry[k]===undefined||same(entry[k],pin[k]));
async function sourceDecode(request,signal){
 if(request.runtimeBase==='estate-road-trial') return (await import('./source-geometry-decode.mjs')).decodeGeometry(request,signal);
 return refinedDecode(request,signal);
}
export async function decodeGeometry(request,signal){
 checkAbort(signal);
 if(request.format==null&&request.m04Variant==null&&request.entry?.m04BlendVariant==null&&!request.entry?.isolatedReplacement)request={...request,format:'glb'};
 const base=request.runtimeBase??'estate-refined';
 if(!['estate-refined','estate-road-trial'].includes(base)) throw Error('Unsupported runtime base');
 const candidates=Object.values(sets).flat().filter(p=>p.id===request.entry?.id);
 if(!candidates.length) return sourceDecode(request,signal);
 const byteLength=request.bytes?.byteLength;
 const replacementPins=candidates.filter(p=>request.format==='glb'&&p.bytes===byteLength&&p.triangles===request.entry.triangles);
 const originals=candidates.map(p=>p.sourceIdentity).filter(p=>descriptorMatches(request.entry,p));
 const compactPins=(originalCompactPins[base]??[]).filter(p=>p.catalogueId===request.entry.id&&p.bytes===byteLength&&p.triangles===request.entry.triangles&&originals.some(o=>o.sha256===p.fine.sha256&&o.bytes===p.fine.bytes));
 const originalGLB=originals.filter(p=>request.format==='glb'&&p.bytes===byteLength);
 if(!replacementPins.length&&!originalGLB.length&&!(request.format==='compact'&&compactPins.length)) throw Error('M04 input identity mismatch');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 checkAbort(signal);
 const replacement=replacementPins.find(p=>p.sha256===hash);
 if(replacement){
  if(request.m04Disabled===true||request.m04Variant!==replacement.m04BlendVariant||!descriptorMatches(request.entry,replacement)||(request.entry.m04BlendVariant!==undefined&&request.entry.m04BlendVariant!==replacement.m04BlendVariant)) throw Error('Missing or wrong M04 route variant or replacement descriptor');
  return replacementDecode(request,signal);
 }
 // Shape-compatible replacement bytes with no known source hash are corruption,
 // not an original-input labelling error. A genuine original hash still takes
 // the original validation path, even if a future encoding shares a size.
 if(replacementPins.length&&!originalGLB.some(p=>p.sha256===hash)&&!compactPins.some(p=>p.sha256===hash)) throw Error('M04 replacement SHA mismatch');
 // A caller must not label original bytes as an installed replacement.
 if(request.m04Variant!=null||request.entry.m04BlendVariant!=null||request.entry.isolatedReplacement===true) throw Error('Original input labelled as M04 replacement');
 if(originalGLB.some(p=>p.sha256===hash)) return sourceDecode(request,signal);
 const compact=request.format==='compact'&&compactPins.find(p=>p.sha256===hash);
 if(compact){
  if((request.compactId!==undefined&&request.compactId!==compact.id)||(request.decodedBytes!==undefined&&request.decodedBytes!==compact.decodedBytes)) throw Error('Original compact metadata mismatch');
  return sourceDecode({...request,compactId:compact.id,decodedBytes:compact.decodedBytes},signal);
 }
 throw Error('M04 input identity SHA mismatch');
}
