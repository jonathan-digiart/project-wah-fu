/** Explicit estimated appearance only. Renderer partition; original collision input is untouched. */
export const BRIDGE_APPEARANCE=Object.freeze({query:'bridge-coping',id:'shared-estate-arrow-associated-source',glbSHA:'653cae0592995a733b5f24525fa95fb87131f28bd6d7c6c8f773f272fed692f9',dataSHA:'10af116b66fdcc9a1c6619f2126a5354e7f9140a1ee0fdd093d603de6b8e413d',faces:Object.freeze([1092,1093]),estimatedHeightM:.15});
const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
export function bridgeDisplayStyle(part,base){return part.bridgeAppearance==='estimated-green-coping'?{...base,color:[62/255,112/255,106/255]}:base;}
export async function decorateBridgeParts(entry,parts,selected,signal){
 if(!selected)return parts;const check=()=>{if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');};check();let matches=0;const out=[];out.retainedSourceBytes=0;
 for(const p of parts){const fine=entry.id===BRIDGE_APPEARANCE.id,fallback=p.regionId===BRIDGE_APPEARANCE.id;
  if(!fine&&!fallback){out.push(p);continue;}matches++;if(parts.some(other=>other!==p&&other.data?.buffer===p.data?.buffer))out.retainedSourceBytes+=p.data.byteLength;
  if(fine&&(entry.sha256!==BRIDGE_APPEARANCE.glbSHA||entry.layer!=='estateAssociated'))throw Error('Bridge appearance source descriptor mismatch');
  if(fallback&&(entry.layer!=='bootstrapRegions'||p.layer!=='estateAssociated'))throw Error('Bridge appearance fallback identity mismatch');
  if(matches!==1||p.material!==0||p.count!==3990||(!Array.isArray(p.origin)||p.origin.length!==3||p.origin.some((v,k)=>v!==[244,32,-37][k]))||p.data?.length!==23940)throw Error('Bridge appearance part layout mismatch');
  const bytes=p.data.buffer.slice(p.data.byteOffset,p.data.byteOffset+p.data.byteLength);if(await digest(bytes)!==BRIDGE_APPEARANCE.dataSHA)throw Error('Bridge appearance decoded source mismatch');check();
  const selectedFaces=BRIDGE_APPEARANCE.faces,top=Math.max(...selectedFaces.flatMap(i=>[0,1,2].map(j=>p.data[i*18+j*6+1]))),cut=top-.15,neutral=[],green=[];
  function clip(poly,sign){const a=[];for(let i=0;i<poly.length;i++){const v=poly[i],w=poly[(i+1)%poly.length],dv=(v[1]-cut)*sign,dw=(w[1]-cut)*sign;if(dv>=0)a.push(v);if(dv*dw<0){const t=dv/(dv-dw),q=v.map((x,k)=>x+(w[k]-x)*t),n=Math.hypot(...q.slice(3));for(let k=3;k<6;k++)q[k]/=n||1;a.push(q);}}return a;}
  for(let i=0;i<1330;i++){const raw=Array.from(p.data.subarray(i*18,i*18+18));if(!selectedFaces.includes(i)){neutral.push(...raw);continue;}const tri=[raw.slice(0,6),raw.slice(6,12),raw.slice(12,18)];for(const[sign,target]of[[-1,neutral],[1,green]]){const poly=clip(tri,sign);for(let j=1;j<poly.length-1;j++)target.push(...poly[0],...poly[j],...poly[j+1]);}}
  for(const[data,role]of[[neutral,'source-neutral'],[green,'estimated-green-coping']])out.push({...p,data:Float32Array.from(data),count:data.length/6,bridgeAppearance:role});
 }
 if(entry.id===BRIDGE_APPEARANCE.id&&matches!==1)throw Error('Bridge appearance source region missing');check();return matches?out:parts;
}
export function installBridgeAppearanceUI(selected,document){
 const box=document.querySelector('#bridge-appearance-option');if(!box)return;const u=new URL(location.href);u.searchParams.set('appearance','bridge-coping');document.querySelector('#bridge-appearance-on').href=u.href;u.searchParams.delete('appearance');document.querySelector('#bridge-appearance-off').href=u.href;document.querySelector('#bridge-appearance-status').textContent=selected?'Estimated bridge coping appearance ON in both fallback and detailed stages. Original collision geometry retained; decorative partition adds no physical recess.':'Original appearance selected. The optional bridge coping is an estimated material detail, not a completed façade.';
}

export function bridgeBudgetEntry(e,selected,cpu){if(!selected)return e;const fine=e.id===BRIDGE_APPEARANCE.id,fallback=e.layer==='bootstrapRegions'&&e.regionIds?.includes(BRIDGE_APPEARANCE.id);if(!fine&&!fallback)return e;return{...e,appearanceResidentBytes:e.triangles*72+288+(cpu&&fallback?95760:0)};}

export const BRIDGE_INSPECTION_CAMERA=Object.freeze({projection:'perspective',yaw:0,pitch:.16,pivot:Object.freeze([252.94,43.15,-77.19]),distance:30,fov:45,near:.1,far:3000,halfSpan:12.5,publicHome:false});

export function recordBridgeAppearance(previous,entry,displayParts,gpu){return{selected:true,estimatedStripHeightM:.15,scope:'Latest display preparation per entry; historical ledger, not live aggregate residency',collision:'Exact original decoded geometry, not renderer partition',fallbackAndFine:true,entries:{...(previous?.entries||{}),[entry.id]:{entryId:entry.id,stage:entry.layer==='bootstrapRegions'?'regional-fallback':'fine',renderExtraTriangles:4,renderExtraBytes:288,retainedSourceBytes:gpu?0:displayParts.retainedSourceBytes||0,transientSourceBytes:95760}}};}
