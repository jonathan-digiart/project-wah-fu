// Isolated preparatory contract. No group is installed without exact source pins.
const keys=['id','file','sha256','bytes','triangles','mode','layer'];
export const exactGeometryIdentity=(a,b)=>keys.every(k=>a?.[k]!==undefined&&a[k]===b?.[k]);
export function createAtomicGeometryGroup(id,members){
 if(typeof id!=='string'||!id||!Array.isArray(members)||members.length<2)throw Error('Invalid atomic geometry group');
 if(new Set(members.map(x=>x.id)).size!==members.length)throw Error('Duplicate atomic member');
 for(const e of members)if(!keys.every(k=>e[k]!==undefined)||!Number.isSafeInteger(e.bytes)||e.bytes<=0||!Number.isSafeInteger(e.triangles)||e.triangles<=0||!['roads','terrain'].includes(e.layer)||!/^[a-f0-9]{64}$/.test(e.sha256))throw Error('Invalid exact atomic member pin');
 return Object.freeze({id,members:Object.freeze(members.map(e=>Object.freeze(Object.fromEntries(keys.map(k=>[k,e[k]]))))) });
}
export function atomicGeometryReady(group,resident){
 return !!group&&group.members.every(pin=>{const v=resident.get(pin.id);return exactGeometryIdentity(pin,v?.entry)&&Array.isArray(v.parts)&&v.parts.length>0&&v.parts.every(p=>Number.isFinite(p.count)&&p.count>0&&(p.data?.byteLength>0||p.buffer));});
}
// Demand closure is independent of readiness: no member waits for another to draw
// before being requested. Caller must account all members within unchanged limits.
export function expandAtomicDemand(entries,allEntries,groups){
 const by=new Map(allEntries.map(e=>[e.id,e])),wanted=new Map(entries.map(e=>[e.id,e]));let changed=true;
 while(changed){changed=false;for(const group of groups){if(!group.members.some(p=>wanted.has(p.id)))continue;for(const pin of group.members){const e=by.get(pin.id);if(!exactGeometryIdentity(pin,e))throw Error('Atomic demand source mismatch: '+pin.id);if(!wanted.has(pin.id)){wanted.set(pin.id,e);changed=true;}}}}
 return [...wanted.values()];
}
export function atomicBlockedIds(groups,resident){return new Set(groups.filter(g=>!atomicGeometryReady(g,resident)).flatMap(g=>g.dependentOnlyId&&g.members.some(p=>p.id===g.dependentOnlyId)?[g.dependentOnlyId]:g.members.map(p=>p.id)));}

// One-way restored-road readiness: demand all exact members, withhold only the new dependent.
export function createDependentGeometryGroup(id,members,dependentId){const g=createAtomicGeometryGroup(id,members);if(!g.members.some(p=>p.id===dependentId))throw Error('Dependent geometry member missing');return Object.freeze({...g,dependentOnlyId:dependentId});}
