import{ViewerCollisionBridge}from'../estate-collision-test/collision/viewer-bridge.mjs';
/** Demand-only bounded admission. Do not enlarge the worker budget or silently
 * drop catalogue owners. An unindexable demand stays unaccepted. Reload resets
 * the cache; bounded eviction requires separate swept-path qualification. */
export class ProtectedDemandBridge extends ViewerCollisionBridge{
 constructor(options){super(options);this.maxDemandTriangles=400000;this.maxDemandPackedBytes=33554432;this.demandCounts=new Map();this.entriesById=new Map(options.entries.map(e=>[e.id,e]));}
 async addDecoded(entry,parts,signal){
  if(!this.ids.has(entry.id)||this.indexed.has(entry.id))return;
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const pinned=this.entriesById.get(entry.id);if(!pinned||pinned.sha256!==entry.sha256||pinned.triangles!==entry.triangles)throw Error('Navigation source identity mismatch');
  const count=parts.reduce((n,p)=>n+p.count/3,0);if(count!==entry.triangles||!Number.isInteger(count))throw Error('Navigation triangle count mismatch');
  const total=[...this.demandCounts.values()].reduce((a,b)=>a+b,0)+count;
  if(total>this.maxDemandTriangles||total*76>this.maxDemandPackedBytes)throw Error('Navigation cache budget reached; current camera retained. Reload to reset navigation cache.');
  await super.addDecoded(entry,parts,signal);
  if(this.indexed.has(entry.id))this.demandCounts.set(entry.id,count);
 }
}
