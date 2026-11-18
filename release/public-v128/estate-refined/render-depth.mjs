/** Render-only near fit. Camera pose/near, collision, source vertices and far remain unchanged. */
const EPS=1e-7;
const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function clip(poly,plane){
 const output=[],cuts=[];const distance=p=>dot(plane,p)+plane[3];
 for(const face of poly){const out=[];for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],da=distance(a),db=distance(b),ia=da>=-EPS,ib=db>=-EPS;if(ia)out.push(a);if(ia!==ib){const t=da/(da-db);if(!Number.isFinite(t)||t< -EPS||t>1+EPS)throw Error('Uncertain clipping intersection');const p=a.map((v,k)=>v+(b[k]-v)*Math.max(0,Math.min(1,t)));out.push(p);cuts.push(p);}}if(out.length>=3)output.push(out);}
 const unique=[];for(const p of cuts)if(!unique.some(q=>Math.hypot(...p.map((v,i)=>v-q[i]))<EPS))unique.push(p);
 if(unique.length>=3){const center=[0,1,2].map(i=>unique.reduce((s,p)=>s+p[i],0)/unique.length),n=plane.slice(0,3),axis=Math.abs(n[0])<.8?[1,0,0]:[0,1,0],u=[n[1]*axis[2]-n[2]*axis[1],n[2]*axis[0]-n[0]*axis[2],n[0]*axis[1]-n[1]*axis[0]],v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];unique.sort((a,b)=>Math.atan2(dot(v,a.map((x,i)=>x-center[i])),dot(u,a.map((x,i)=>x-center[i])))-Math.atan2(dot(v,b.map((x,i)=>x-center[i])),dot(u,b.map((x,i)=>x-center[i]))));output.push(unique);}
 return output;
}
export function fitRenderNear(entries,camera,aspect,m){
 const original=camera.near,base={near:original,originalNear:original,far:camera.far,strategy:'original',reason:'not-perspective'};
 if(camera.projection!=='perspective')return base;
 if(!entries.length||!Number.isFinite(original)||original<=0||!Number.isFinite(camera.far)||camera.far<=original||!Number.isFinite(camera.distance)||!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(camera.fov)||camera.fov<=0||camera.fov>=179||!camera.pivot?.every(Number.isFinite)||m?.length!==9||!m.every(Number.isFinite))return{...base,reason:'invalid-or-empty-bounds'};
 const ty=Math.tan(camera.fov*Math.PI/360),tx=ty*aspect,planes=[[1,0,tx,0],[-1,0,tx,0],[0,1,ty,0],[0,-1,ty,0],[0,0,1,-original],[0,0,-1,camera.far]];let closest=Infinity,intersections=0;
 try{for(const e of entries){const b=e.bounds;if(!b||!['min','max'].every(k=>b[k]?.length===3&&b[k].every(Number.isFinite))||b.min.some((v,i)=>v>b.max[i]))throw Error('Invalid bounds');
 const points=Array.from({length:8},(_,j)=>{const q=[0,1,2].map(i=>b[(j>>i)&1?'max':'min'][i]-camera.pivot[i]);return[dot([m[0],m[3],m[6]],q),dot([m[1],m[4],m[7]],q),camera.distance-dot([m[2],m[5],m[8]],q)];});
 const minDepth=Math.min(...points.map(p=>p[2])),maxDepth=Math.max(...points.map(p=>p[2]));if(maxDepth<original-EPS||minDepth>camera.far+EPS)continue;if(minDepth>original){closest=Math.min(closest,minDepth);intersections++;continue;}
 let poly=faces.map(f=>f.map(i=>points[i]));for(const plane of planes){poly=clip(poly,plane);if(!poly.length)break;}if(!poly.length)continue;intersections++;for(const face of poly)for(const p of face){if(!p.every(Number.isFinite))throw Error('Invalid clipped point');closest=Math.min(closest,p[2]);}
 }}catch{return{...base,reason:'uncertain-bounds'};}
 if(!Number.isFinite(closest)||closest<=original*2)return{...base,reason:intersections?'geometry-near-camera':'no-visible-bounds',closestDepth:Number.isFinite(closest)?closest:null};
 // Half the conservative nearest bound leaves a large margin for Float32 math,
 // tiny source quantization and geometry intersecting the original frustum edge.
 const near=Math.max(original,Math.min(camera.far*.5,(closest-Math.max(.001,closest*1e-5))*.5));
 return{...base,near,strategy:near>original?'fitted-render-near':'original',reason:'clipped-drawn-bounds',closestDepth:closest,intersections};
}
export function depthStepMetres(depth,near,far,bits=24){return depth*depth*(far-near)/(far*near*(2**bits-1));}
