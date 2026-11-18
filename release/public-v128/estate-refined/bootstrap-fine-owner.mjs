/** Exact reviewed house + associated A/C owners. No arbitrary manifest owners or shared-buffer retirement. */
export const BOOTSTRAP_HOUSE=Object.freeze({id:'shared-houses-estate-house-B321481231301063C0',file:'../estate-foundation/buildings/chunks/estate-house-B321481231301063C0.glb',bytes:764300,triangles:16175,sha256:'91c0ea96550236911fd84ae1fb3795263df458152abf62a1b3d7bec9d3445046',bounds:Object.freeze({min:Object.freeze([219.51611328125,25.85599708557129,-19.522964477539062]),max:Object.freeze([311.35888671875,82.16099548339844,0.8984354734420776])}),mode:'shared',layer:'houses'});
export const OWNER_GEOMETRY_BYTES=1164600;
export const OWNER_GEOMETRY_SHA='fc8f5722bab94032455805e96e86d6579b5e499498f24d0346705efe0c813a5a';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const BOOTSTRAP_OWNERS=freeze([{"source":{"id":"shared-houses-estate-house-B321481231301063C0","file":"../estate-foundation/buildings/chunks/estate-house-B321481231301063C0.glb","bytes":764300,"triangles":16175,"sha256":"91c0ea96550236911fd84ae1fb3795263df458152abf62a1b3d7bec9d3445046","bounds":{"min":[219.51611328125,25.85599708557129,-19.522964477539062],"max":[311.35888671875,82.16099548339844,0.8984354734420776]},"mode":"shared","layer":"houses"},"geometryBytes":1164600,"geometrySha256":"fc8f5722bab94032455805e96e86d6579b5e499498f24d0346705efe0c813a5a","policy":"single-owner-fine-house","count":48525,"material":0,"origin":[244,32,-37]},{"source":{"id":"shared-estate-associated-a-original","file":"connected/associated-a-original.glb","bytes":398404,"sha256":"26392833498a0f798b8aabfefc888da0ccfa2e5ef3113f01e603ee79789eb2f1","triangles":3462,"bounds":{"min":[259.43115234375,24.996999740600586,-155.73828125],"max":[331.318359375,54.47600173950195,-18.51123046875]},"mode":"shared","layer":"estateAssociated","sourceIds":["B321551240701063C0","B321661239102063C0"],"namedHouse":false,"detailStatus":"Original Government forms restored; photo-based architectural detail incomplete","confirmedGroup":"A"},"geometryBytes":249264,"geometrySha256":"ce7afbeb26d2bc42ccb4dc3bc62eb38415973a02b00e3d3b059a158d437abf70","policy":"fixed-owner-fine-associated","count":10386,"material":0,"origin":[244,32,-37]},{"source":{"id":"shared-estate-associated-c-original","file":"connected/associated-c-original.glb","bytes":392932,"sha256":"fb8634fb86f24730250df50bd00a2bb2aa295ff02d3e740aee25c40dc3f36af4","triangles":3414,"bounds":{"min":[164.53564453125,46.80500030517578,-519.4560546875],"max":[280.95068359375,72.12799835205078,-428.66162109375]},"mode":"shared","layer":"estateAssociated","sourceIds":["B320751277502063C0","B321241275202063C0"],"namedHouse":false,"detailStatus":"Original Government forms restored; photo-based architectural detail incomplete","confirmedGroup":"C"},"geometryBytes":245808,"geometrySha256":"534af87ce163e36ec1b356a7acabe8393fb9ad96a90732315f6afceff65ef622","policy":"fixed-owner-fine-associated","count":10242,"material":0,"origin":[244,32,-37]},{"source":{"id":"shared-estate-associated-b-original","file":"connected/associated-b-original.glb","bytes":220344,"sha256":"a94cb981f151ad00d8d771a8b0c5f693c421c5821b742b5413bde4d8e1d2807e","triangles":1900,"bounds":{"min":[181.35400390625,45.71799850463867,-451.66748046875],"max":[228.89599609375,84.91300201416016,-367.45751953125]},"mode":"shared","layer":"estateAssociated","sourceIds":["B320681271701063C0","B320791270602063C0"],"namedHouse":false,"detailStatus":"Original Government forms restored; photo-based architectural detail incomplete","confirmedGroup":"B"},"geometryBytes":136800,"geometrySha256":"55022c1d444dc0a676b83ca0b148c4580e1023581631e349acae998191712c99","policy":"fixed-owner-fine-associated","count":5700,"material":0,"origin":[244,32,-37]},{"source":{"id":"shared-houses-estate-house-B322241247801063C0","file":"../estate-foundation/buildings/chunks/estate-house-B322241247801063C0.glb","bytes":133612,"triangles":1683,"sha256":"a3a2c68bbe056a3a040c55d800fec664b7ff5126217851c3498901c9378361b5","bounds":{"min":[318.375,36.90301227979257,-243.9375013332746],"max":[511,75.67298591371036,-144.5625116455503]},"mode":"shared","layer":"houses"},"geometryBytes":121176,"geometrySha256":"409e447881789756e088e403be5c876fffa9ede0fa7680d8806abef6407d3090","policy":"fixed-owner-fine-house-secondary","count":5049,"material":0,"origin":[244,32,-37]}]);
export const BOOTSTRAP_OWNER_IDS=Object.freeze(BOOTSTRAP_OWNERS.map(o=>o.source.id));
/** Bounded one-shot QA selection only. Legacy "1" remains the existing house. */
export function bootstrapOwnerFailureId(value){
 if(value==='1'||value==='house')return BOOTSTRAP_HOUSE.id;
 if(value==='a')return BOOTSTRAP_OWNERS[1].source.id;
 if(value==='c')return BOOTSTRAP_OWNERS[2].source.id;
 if(value==='b')return BOOTSTRAP_OWNERS[3].source.id;
 if(value==='secondary-house')return BOOTSTRAP_OWNERS[4].source.id;
 return null;
}


const tokens=new WeakMap(),admitted=new WeakMap(),gpuOwners=new WeakMap();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ownerFor=id=>BOOTSTRAP_OWNERS.find(o=>o.source.id===id);
export function verifyOwnerDescriptor(e){
 const owner=ownerFor(e?.id);
 if(!owner||Object.keys(owner.source).some(k=>!same(e[k],owner.source[k])))throw Error('Bootstrap fine source identity mismatch');
 return e;
}
export function validateBootstrapOwners(catalogue,manifest){
 const ds=manifest.bootstrapFineDependencies??[];
 if(!Array.isArray(ds))throw Error('Invalid bootstrap dependencies');
 // Synthetic/legacy catalogues with no fixed sources have no owner protocol.
 // A real fixed source can never silently opt out by dropping its declaration.
 if(!ds.length&&!catalogue.chunks.some(e=>ownerFor(e.id)))return [];
 if(ds.length!==BOOTSTRAP_OWNERS.length)throw Error('Exactly five reviewed bootstrap dependencies required');
 for(const [i,owner]of BOOTSTRAP_OWNERS.entries()){
  const d=ds[i];
  if(!d||d.policy!==owner.policy||d.geometryBytes!==owner.geometryBytes||d.geometrySha256!==owner.geometrySha256||!same(d.source,owner.source))throw Error('Bootstrap dependency proof mismatch');
  const es=catalogue.chunks.filter(e=>e.id===owner.source.id);
  if(es.length!==1)throw Error('Duplicate or missing bootstrap fine source');
  verifyOwnerDescriptor(es[0]);
  for(const rs of [manifest.sourceRegions,manifest.regions])if(!Array.isArray(rs)||rs.some(r=>r.id===owner.source.id))throw Error('Bootstrap dependency also claims fallback');
  if((manifest.fineOnlyRegions??[]).some(r=>r.id===owner.source.id))throw Error('Bootstrap dependency falsely fine-only');
 }
 return [...BOOTSTRAP_OWNER_IDS];
}
export function selectBootstrapOwners(entries,camera,aspect,limits,ordinary,bounds,estimate){
 const bundles=entries.filter(e=>e.layer==='bootstrapRegions'),declared=bundles.filter(e=>e.bootstrapFineDependencyIds?.length);
 if(!declared.length){if(bundles.length&&entries.some(e=>ownerFor(e.id)))throw Error('Missing fixed bootstrap dependency declaration');return ordinary(entries,camera,aspect,limits);}
 if(bundles.length!==1||declared.length!==1||!same(declared[0].bootstrapFineDependencyIds,BOOTSTRAP_OWNER_IDS))throw Error('Invalid fixed-owner bootstrap bundle');
 const bundle=declared[0],owners=BOOTSTRAP_OWNER_IDS.map(id=>{
  const es=entries.filter(e=>e.id===id);
  if(es.length!==1||bundle.regionIds?.includes(id)||bundle.fineOnlyRegionIds?.includes(id))throw Error('Duplicate or missing bootstrap ownership');
  return verifyOwnerDescriptor(es[0]);
 });
 const forced=[bundle,...owners].map(e=>({...e,view:bounds(e.bounds,camera,aspect)})),cost=forced.reduce((n,e)=>n+estimate(e),0);
 if(cost>limits.gpuBytes||limits.residentChunks<forced.length)throw Error('Bootstrap dependencies exceed capacity');
 const forcedIds=new Set(forced.map(e=>e.id));
 const rest=ordinary(entries.filter(e=>!forcedIds.has(e.id)),camera,aspect,{...limits,gpuBytes:limits.gpuBytes-cost,residentChunks:limits.residentChunks-forced.length});
 return {...rest,selected:[...forced,...rest.selected],requiredVisible:[...forced.filter(e=>e.view.visible&&!e.bootstrapOwnerHidden),...rest.requiredVisible],gpuBytes:cost+rest.gpuBytes,eligible:rest.eligible+forced.length,visible:rest.visible+forced.filter(e=>e.view.visible).length};
}
function sourcePartMatches(p,owner){return p&&p.count===owner.count&&p.material===owner.material&&same(p.origin,owner.origin)&&p.data instanceof Float32Array&&p.data.byteLength===owner.geometryBytes&&p.data.byteOffset===0&&p.data.buffer.byteLength===owner.geometryBytes;}
export async function verifyBootstrapOwnerGeometry(entry,parts,signal){
 const owner=ownerFor(entry.id);if(!owner)return null;verifyOwnerDescriptor(entry);
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 if(parts.length!==1)throw Error('Bootstrap owner part mismatch');const p=parts[0];
 if(!sourcePartMatches(p,owner))throw Error('Bootstrap owner geometry metadata mismatch');
 const digest=await crypto.subtle.digest('SHA-256',p.data.buffer);
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 if([...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')!==owner.geometrySha256)throw Error('Bootstrap owner decoded geometry mismatch');
 const token=Object.freeze({});tokens.set(token,{owner,entry,data:p.data});return token;
}
/** Tokens hold decode buffers only until this exact load admits or exits. */
export function releaseBootstrapOwnerToken(token){if(token)tokens.delete(token);}
export function admitBootstrapOwner(entry,value,token,gl){
 const proof=tokens.get(token);releaseBootstrapOwnerToken(token);
 const owner=ownerFor(entry.id);if(!owner){if(token)throw Error('Bootstrap owner admission mismatch');return value;}
 verifyOwnerDescriptor(entry);
 if(!proof||proof.owner!==owner||proof.entry!==entry||value.entry!==entry||value.parts.length!==1||value.geometryBytes!==owner.geometryBytes)throw Error('Bootstrap owner admission mismatch');
 const p=value.parts[0];
 if(p.count!==owner.count||p.material!==owner.material||!same(p.origin,owner.origin)||(gl?(!p.buffer||!gl.isBuffer(p.buffer)||p.data!==null||gpuOwners.has(p.buffer)):p.data!==proof.data||!sourcePartMatches(p,owner)))throw Error('Bootstrap owner upload mismatch');
 if(gl){
  // Query the actual standalone GPU allocation, never claim credit for aliases.
  const previous=gl.getParameter(gl.ARRAY_BUFFER_BINDING);gl.bindBuffer(gl.ARRAY_BUFFER,p.buffer);
  let bytes;try{bytes=gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE);}finally{gl.bindBuffer(gl.ARRAY_BUFFER,previous);}
  if(bytes!==owner.geometryBytes)throw Error('Bootstrap owner GPU allocation mismatch');
  gpuOwners.set(p.buffer,value);
 }
 admitted.set(value,{owner,entry,part:p,data:p.data,buffer:p.buffer,gl});return value;
}
export function bootstrapOwnerReady(value,expectedId){
 const a=admitted.get(value);if(!a||expectedId&&expectedId!==a.owner.source.id)return false;
 const p=value.parts?.[0],o=a.owner;
 try{verifyOwnerDescriptor(value.entry);}catch{return false;}
 return value.entry===a.entry&&value.parts.length===1&&p===a.part&&p.count===o.count&&p.material===o.material&&same(p.origin,o.origin)&&value.geometryBytes===o.geometryBytes&&p.data===a.data&&p.buffer===a.buffer&&(a.gl?a.gl.isBuffer(p.buffer)&&gpuOwners.get(p.buffer)===value:sourcePartMatches(p,o));
}
/** Observable resident renderer allocations, not browser heap or worker/collider memory. */
export function rendererOwnership(resident){const cpu=new Set(),gpu=new Map();let viewBytes=0,aliases=0;for(const v of resident.values())for(const p of v.parts??[]){if(p.data){cpu.add(p.data.buffer);viewBytes+=p.data.byteLength;}if(p.buffer){if(gpu.has(p.buffer))aliases++;else gpu.set(p.buffer,p.count*24);}}return{cpuBackingAllocations:cpu.size,cpuBackingBytes:[...cpu].reduce((s,b)=>s+b.byteLength,0),cpuViewBytes:viewBytes,gpuBuffers:gpu.size,gpuGeometryBytes:[...gpu.values()].reduce((s,n)=>s+n,0),gpuAliases:aliases,scope:'Resident renderer allocations only; excludes transient decode/inflate/upload staging, collision worker, framebuffer and browser overhead.'};}
export function unavailableDetailNote(stage){
 const ids=stage?.unavailableRegionIds;if(!ids?.size)return '';
 const buildings=[...ids].filter(id=>ownerFor(id)).length,terrain=ids.size-buildings;
 return [buildings?'Required building detail is unavailable; the regional view waits for its exact geometry. Retry any failed request.':'',terrain?terrain+' corrected terrain region(s) unavailable until fine detail loads; gaps remain visible. Retry any failed requests.':''].filter(Boolean).join(' ');
}
/** Drop proof-held CPU/context references synchronously on disposal, not only at GC. */
export function releaseBootstrapOwner(value){const a=admitted.get(value);if(a?.buffer&&gpuOwners.get(a.buffer)===value)gpuOwners.delete(a.buffer);admitted.delete(value);}
