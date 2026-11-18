/** Preserve the original public export surface; keep new pins separate from
 * BOUNDED_FINE_TERRAIN so original consumers retain their exact source list. */
export * from './source-bounded-fine-terrain.mjs';
import {requiresBoundedFineGLB as sourceRequires} from './source-bounded-fine-terrain.mjs';
import {sets} from './sets.mjs';
export function requiresBoundedFineGLB(entry){
 if(!entry.isolatedReplacement) return sourceRequires(entry);
 const expected=sets[entry.m04BlendVariant]?.find(e=>e.id===entry.id);
 if(!expected||['id','file','sha256','bytes','triangles','mode','layer','bounds'].some(k=>JSON.stringify(entry[k])!==JSON.stringify(expected[k]))) throw Error('Unified M04 bounded identity mismatch');
 return true;
}
