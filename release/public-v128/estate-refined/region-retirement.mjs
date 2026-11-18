import{atomicGeometryReady,expandAtomicDemand}from'./atomic-geometry-group.mjs';
import{adjacentRoadSourcesReady}from'./road-join-readiness.mjs';
import{bootstrapOwnerReady,verifyOwnerDescriptor}from'./bootstrap-fine-owner.mjs';
import{selectChunksWithCosts,estimatedResidencyBytes,LIMITS,cameraBounds}from'./stream-core.mjs';
const identity=(a,b)=>['id','file','sha256','bytes','triangles','layer','mode'].every(k=>a?.[k]===b?.[k]);
const pendingGpu=new WeakMap();
const backing=parts=>new Set(parts.filter(p=>p.data).map(p=>p.data.buffer));
function gpuSize(gl,parts){const old=gl.getParameter(gl.ARRAY_BUFFER_BINDING),seen=new Set();let n=0;try{for(const p of parts){if(!Number.isInteger(p.count)||p.count<=0||!p.buffer||!gl.isBuffer(p.buffer))throw Error('Missing admitted GPU part');if(seen.has(p.buffer))throw Error('Aliased GPU parts');seen.add(p.buffer);if(!gl.isBuffer(p.buffer))throw Error('Unverified live renderer handle');gl.bindBuffer(gl.ARRAY_BUFFER,p.buffer);const size=gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE);if(size!==p.count*24)throw Error('GPU part size mismatch');n+=size;}}finally{gl.bindBuffer(gl.ARRAY_BUFFER,old);}return n;}
export function measureRendererValue(v,gl){if(gl){if(gl.isContextLost())throw Error('Context lost');return gpuSize(gl,v.parts);}return[...backing(v.parts)].reduce((s,b)=>s+b.byteLength,0);}
/** Only trusted live cache records enter this path; no total-process memory claim. */
export function retireReadyRegions({entries,resident,gl=null,invalidate=()=>{},drawableRoadIds=null}){
 if(gl?.isContextLost())return{retired:0,held:'context-lost'};const by=new Map(entries.map(e=>[e.id,e]));let retired=0;
 for(const bundle of entries.filter(e=>e.layer==='bootstrapRegions')){
  const value=resident.get(bundle.id);if(!value||!identity(bundle,value.entry))continue;
  if((bundle.bootstrapFineDependencyIds||[]).some(id=>!bootstrapOwnerReady(resident.get(id),id)))continue;
  for(const id of bundle.regionIds||[]){const fine=resident.get(id),entry=by.get(id);if(!fine||!entry||!identity(entry,fine.entry))continue;
   if(entry.atomicGeometryGroup&&!atomicGeometryReady(entry.atomicGeometryGroup,resident))continue;
   if(entry.layer==='roads'&&(!entry.requiredTerrainIds?.length||entry.requiredTerrainIds.some(t=>!resident.has(t)||!identity(by.get(t),resident.get(t).entry))))continue;
   if(entry.requiredRoadSources&&(!adjacentRoadSourcesReady(entry,resident)||!drawableRoadIds||entry.requiredRoadSources.some(source=>!drawableRoadIds.has(source.id))))continue;
   const old=value.parts.filter(p=>p.regionId===id);if(!old.length)continue;const keep=value.parts.filter(p=>p.regionId!==id),owned=backing(old),other=backing([...keep,...fine.parts]);if([...owned].some(b=>other.has(b)))continue;
   // Fine representation must be admitted and genuinely renderer-owned before retirement.
   if(!fine.parts.length||(!gl&&fine.parts.some(p=>!p.data)))continue;
   if(gl){try{gpuSize(gl,fine.parts);}catch{continue;}if(gl.isContextLost())continue;
    let records=pendingGpu.get(value);if(!records){records=new Map();pendingGpu.set(value,records);}let record=records.get(id);
    if(!record){try{gpuSize(gl,old);}catch{continue;}const handles=new Set(old.map(p=>p.buffer).filter(Boolean)),others=new Set([...keep,...fine.parts].map(p=>p.buffer).filter(Boolean));if([...handles].some(h=>others.has(h)))continue;record={handles};records.set(id,record);}
    let failed=false;for(const handle of record.handles){try{if(gl.isContextLost()){failed=true;break;}if(gl.isBuffer(handle))gl.deleteBuffer(handle);if(gl.isBuffer(handle))failed=true;}catch{failed=true;}}
    // No credit or destructive CPU clearing on partial failure. Original handles survive callback mutation in record.
    if(failed||gl.isContextLost())continue;records.delete(id);
   }
   value.parts.splice(0,value.parts.length,...keep);for(const p of old){p.data=null;p.buffer=null;}retired++;
  }
  if(retired){try{const bytes=measureRendererValue(value,gl);value.geometryBytes=bytes;value.gpuBytes=gl?bytes:0;value.renderGeometryBytes=value.parts.reduce((s,p)=>s+p.count*24,0);value.retainedSourceBytes=gl?0:Math.max(0,bytes-value.renderGeometryBytes);}catch{/* Preserve previous conservative charge. */}}
 }
 if(retired)invalidate();return{retired};
}
/** Never evict loaded fine merely because camera changed after its fallback retired. */
export function selectRetainedRegions(entries,camera,aspect,resident,limits=LIMITS,allEntries=entries){
 const by=new Map(allEntries.map(e=>[e.id,e])),visibleIds=new Set(entries.map(e=>e.id)),forced=new Set(entries.filter(e=>e.layer==='bootstrapRegions').flatMap(e=>e.bootstrapFineDependencyIds||[]));
 const retained=[...resident].filter(([id,v])=>by.has(id)&&!by.get(id).layer.startsWith('bootstrap')&&!forced.has(id)&&identity(by.get(id),v.entry));
 const keptIds=new Set(retained.map(([id])=>id));let bytes=0;for(const[,v]of retained){if(!Number.isSafeInteger(v.geometryBytes)||v.geometryBytes<0)throw Error('Unverified retained charge');bytes+=v.geometryBytes;}
 if(bytes>limits.gpuBytes||retained.length>limits.residentChunks)throw Error('Retained fine exceeds capacity');
 const cost=e=>{const v=resident.get(e.id);return v&&identity(e,v.entry)?v.geometryBytes:estimatedResidencyBytes(e);};
 const criticalReady=[...forced].every(id=>bootstrapOwnerReady(resident.get(id),id));const loadable=criticalReady?entries:entries.filter(e=>e.layer.startsWith('bootstrap')||forced.has(e.id));
 const groups=[...new Map(entries.filter(e=>e.atomicGeometryGroup&&(cameraBounds(e.bounds,camera,aspect).visible||keptIds.has(e.id))).map(e=>[e.atomicGeometryGroup.id,e.atomicGeometryGroup])).values()];
 const groupMembers=criticalReady?expandAtomicDemand(groups.flatMap(g=>g.members.map(pin=>by.get(pin.id))),allEntries,groups):[];
 const groupIds=new Set(groupMembers.map(e=>e.id)),pendingGroup=groupMembers.filter(e=>!keptIds.has(e.id));
 const groupBytes=pendingGroup.reduce((n,e)=>n+cost(e),0),criticalCost=[...forced].filter(id=>!keptIds.has(id)).reduce((n,id)=>n+cost(by.get(id)),0)+loadable.filter(e=>e.layer==='bootstrapRegions').reduce((n,e)=>n+cost(e),0),groupFits=groupBytes<=limits.gpuBytes-bytes-criticalCost&&pendingGroup.length<=limits.residentChunks-retained.length-forced.size-loadable.filter(e=>e.layer==='bootstrapRegions').length;
 const forcedGroup=groupFits?pendingGroup.map(e=>({...e,view:cameraBounds(e.bounds,camera,aspect)})):[];
 const selected=selectChunksWithCosts(loadable.filter(e=>!keptIds.has(e.id)&&!groupIds.has(e.id)),camera,aspect,{...limits,gpuBytes:limits.gpuBytes-bytes-(groupFits?groupBytes:0),residentChunks:limits.residentChunks-retained.length-forcedGroup.length},cost);
 selected.selected.push(...forcedGroup);selected.gpuBytes+=groupFits?groupBytes:0;selected.atomicBudgetBlocked=groupFits?[]:groups.map(g=>g.id);selected.budgetSkipped+=groupFits?0:pendingGroup.length;
 const keep=retained.map(([id])=>({...by.get(id),retirementHidden:!visibleIds.has(id),view:visibleIds.has(id)?cameraBounds(by.get(id).bounds,camera,aspect):{visible:false,near:false,distance:Infinity}}));
 return{...selected,selected:[...selected.selected,...keep],requiredVisible:[...new Map([...entries.map(e=>({...e,view:cameraBounds(e.bounds,camera,aspect)})).filter(e=>e.view.visible),...keep.filter(e=>e.view.visible)].map(e=>[e.id,e])).values()],deferredForCriticalOwners:criticalReady?0:entries.filter(e=>!loadable.includes(e)).length,gpuBytes:selected.gpuBytes+bytes,eligible:selected.eligible+keep.length,visible:selected.visible+keep.filter(e=>e.view.visible).length};
}
/** Retained renderer + promised return backing only, NOT decode/worker/process memory. */
export class RendererAdmission{
 constructor({resident,cap=48*1024*1024,criticalEntries=[],quarantine,criticalActive=()=>true}){if(typeof quarantine!=='function')throw Error('Explicit cleanup quarantine binding required');this.resident=resident;this.quarantine=quarantine;this.cap=cap;this.criticalActive=criticalActive;this.critical=new Map(criticalEntries.map(e=>{verifyOwnerDescriptor(e);return[e.id,Object.freeze({...e})];}));if(this.critical.size!==criticalEntries.length)throw Error('Duplicate critical owner');if([...this.critical.values()].reduce((s,e)=>s+estimatedResidencyBytes(e),0)>cap)throw Error('Critical owners exceed capacity');this.pending=new Set();this.queue=[];this.peak=0;}
 usage(){return[...this.resident().values()].reduce((s,v)=>s+v.geometryBytes,0)+[...this.quarantine().values()].reduce((s,q)=>s+q.bytes,0);}
 reserved(){return[...this.pending].reduce((s,p)=>s+p.bytes,0);}
 criticalReady(){return!this.criticalActive()||[...this.critical.keys()].every(id=>bootstrapOwnerReady(this.resident().get(id),id));}
 criticalReserved(except){if(!this.criticalActive())return 0;return[...this.critical].filter(([id])=>id!==except&&!bootstrapOwnerReady(this.resident().get(id),id)&&![...this.pending].some(p=>p.id===id)).reduce((s,[,e])=>s+estimatedResidencyBytes(e),0);}
 acquire(e,signal){const bytes=estimatedResidencyBytes(e);if(bytes>this.cap||!Number.isSafeInteger(bytes))return Promise.reject(Error('Renderer owner exceeds capacity'));return new Promise((resolve,reject)=>{const q={id:e.id,bytes,signal,resolve,reject};q.abort=()=>{const i=this.queue.indexOf(q);if(i>=0){this.queue.splice(i,1);reject(new DOMException('Cancelled','AbortError'));}};if(signal.aborted)return q.abort(),reject(new DOMException('Cancelled','AbortError'));signal.addEventListener('abort',q.abort,{once:true});this.queue.push(q);this.drain();});}
 drain(){for(let i=0;i<this.queue.length;){const q=this.queue[i];if(this.usage()+this.reserved()+this.criticalReserved(q.id)+q.bytes>this.cap){i++;continue;}this.queue.splice(i,1);q.signal.removeEventListener('abort',q.abort);this.pending.add(q);this.peak=Math.max(this.peak,this.usage()+this.reserved()+this.criticalReserved());let released=false;q.resolve(()=>{if(released)return;released=true;this.pending.delete(q);this.drain();});}}
 snapshot(){return{resident:this.usage(),reserved:this.reserved(),criticalReserved:this.criticalReserved(),criticalReady:this.criticalReady(),queued:this.queue.length,peak:this.peak,scope:'Retained renderer backing plus promised return backing; transient decode/worker/process memory excluded'};}
}

/** Pending retirement handles must also participate in reset/eviction disposal. */
export function disposePendingRetirement(value,gl){const records=pendingGpu.get(value);if(!records?.size)return;if(!gl||gl.isContextLost())throw Error('Pending retirement cleanup awaits live restored context');for(const record of records.values())for(const handle of record.handles){if(gl.isContextLost())throw Error('Context lost during pending retirement cleanup');if(gl.isBuffer(handle))gl.deleteBuffer(handle);if(gl.isContextLost()||gl.isBuffer(handle))throw Error('Pending retirement handle cleanup not verified');}records.clear();pendingGpu.delete(value);}
