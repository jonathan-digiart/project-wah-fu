// Explicit software fallback; not used to claim GPU or device performance.
// Clip only the existing surface, in camera coordinates [x, y, depth].
// The caller reuses 12 doubles: one triangle can produce at most four vertices.
// Intersections use inside-to-outside order so shared edges agree in both windings.
export function clipTriangleNear(points,near,out){
  let count=0;
  for(let i=0;i<3;i++){
    const a=points[i],b=points[(i+1)%3],insideA=a[2]>=near,insideB=b[2]>=near;
    if(insideA!==insideB&&a[2]!==near&&b[2]!==near){
      const inside=insideA?a:b,outside=insideA?b:a,t=(near-inside[2])/(outside[2]-inside[2]);
      out[count*3]=inside[0]+t*(outside[0]-inside[0]);
      out[count*3+1]=inside[1]+t*(outside[1]-inside[1]);out[count*3+2]=near;count++;
    }
    if(insideB){out[count*3]=b[0];out[count*3+1]=b[1];out[count*3+2]=b[2];count++;}
  }
  return count;
}
export function drawCPU(ctx,canvas,items,camera,m,origin){const maxWidth=650,maxHeight=420,ratio=Math.min(1,maxWidth/canvas.clientWidth,maxHeight/canvas.clientHeight),w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const image=ctx.createImageData(w,h),pix=image.data,depth=new Float32Array(w*h).fill(-Infinity),scale=Math.min(w,h)/(2*camera.halfSpan);for(let i=0;i<w*h;i++){pix[i*4]=221;pix[i*4+1]=227;pix[i*4+2]=216;pix[i*4+3]=255;}let calls=0,triangles=0;const light=[.482,.82,.338],nearScratch=new Float64Array(12);for(const item of items)for(const part of item.parts){calls++;const d=part.data,pivot=camera.pivot.map((v,i)=>v-part.origin[i]);for(let k=0;k<d.length;k+=18){const points=[];for(let j=0;j<3;j++){const q=[d[k+j*6]-pivot[0],d[k+j*6+1]-pivot[1],d[k+j*6+2]-pivot[2]],vx=m[0]*q[0]+m[3]*q[1]+m[6]*q[2],vy=m[1]*q[0]+m[4]*q[1]+m[7]*q[2],vz=m[2]*q[0]+m[5]*q[1]+m[8]*q[2];if(camera.projection==='perspective'){points.push([vx,vy,camera.distance-vz]);}else points.push([w/2+vx*scale,h/2-vy*scale,vz]);}if(camera.projection==='perspective'){
// Keep the existing far-plane policy; fix only partial near-plane rejection.
if(points.some(p=>p[2]>camera.far))continue;
if(points.some(p=>p[2]<camera.near)){
const count=clipTriangleNear(points,camera.near,nearScratch);if(count<3)continue;
points.length=0;for(let i=0;i<count;i++)points.push([nearScratch[i*3],nearScratch[i*3+1],nearScratch[i*3+2]]);
}
const s=h/(2*Math.tan(camera.fov*Math.PI/360));for(let i=0;i<points.length;i++){const[vx,vy,depth]=points[i];points[i]=[w/2+vx*s/depth,h/2-vy*s/depth,1/depth];}
}
// Count accepted source triangles, not temporary fan pieces. No retained mesh or caps.
triangles++;for(let fan=1;fan<points.length-1;fan++){const a=points[0],b=points[fan],c=points[fan+1],den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-10)continue;const sign=den<0?1:-1,lum=.48+.52*Math.max(0,sign*(d[k+3]*light[0]+d[k+4]*light[1]+d[k+5]*light[2])),col=part.publicClay?publicColor(part.color,[d[k+3]*sign,d[k+4]*sign,d[k+5]*sign]):part.color.map(x=>Math.round(x*lum*255)),x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,t=1-u-v;if(u<0||v<0||t<0)continue;const z=u*a[2]+v*b[2]+t*c[2],i=y*w+x;if(z>=depth[i]){depth[i]=z;pix[i*4]=col[0];pix[i*4+1]=col[1];pix[i*4+2]=col[2];}}}}}ctx.putImageData(image,0,0);return{calls,triangles,framebufferBytes:w*h*8};}

function publicColor(color,n){const length=Math.hypot(...n)||1,light=[-3/7,6/7,2/7],illumination=(2+3*Math.max(0,n.reduce((s,v,i)=>s+v*light[i]/length,0)))/Math.PI;return color.map(c=>{const linear=c<=.04045?c/12.92:((c+.055)/1.055)**2.4,v=linear*illumination;return Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));});}
