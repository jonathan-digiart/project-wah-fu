/** Estate-associated source forms are not additional named houses. */
export function descriptorsForScope(chunks,mode,shown,bootstrapActive){
 const owners=new Set(mode==='context'?chunks.filter(e=>e.layer==='bootstrapRegions').flatMap(e=>e.bootstrapFineDependencyIds??[]):[]);
 return chunks.filter(e=>(e.mode===mode||e.mode==='shared')&&(owners.has(e.id)||e.layer==='terrain'||e.layer==='bootstrapRegions'||(e.layer==='bootstrapTerrain')||(e.layer==='bootstrapBase'&&shown.base)||(e.layer==='bootstrapBuildings'&&(shown.houses||shown.surroundings))||(e.layer==='estateAssociated'?shown.houses:shown[e.layer]))).map(e=>owners.has(e.id)?{...e,bootstrapOwnerHidden:!shown.houses}:e);
}

export function collisionEntriesForScope(chunks){return chunks.filter(e=>['context','shared'].includes(e.mode)&&['terrain','houses','estateAssociated','surroundings','base'].includes(e.layer)).map(e=>({...e,kind:e.layer==='terrain'||e.layer==='bootstrapRegions'||e.layer==='estateAssociated'?'surface':'solid',...(e.layer==='estateAssociated'?{surfaceOnlyReason:'Original non-watertight source form; triangle-clearance only, no interior/solid inference'}:{})}));}
