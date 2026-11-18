/** Plan panning translates the camera target horizontally; it never rotates it. */
import {rotation} from './stream-core.mjs';
export function panDisplacement(camera,dx,dy,width,height){
 if(![dx,dy,width,height].every(Number.isFinite)||width<=0||height<=0)return [0,0,0];
 const top=camera.pitch>=PLAN_EXIT_PITCH;
 const span=top&&camera.projection==='perspective'?camera.distance*Math.tan(camera.fov*Math.PI/360):camera.halfSpan;
 const scale=2*span/(top&&camera.projection==='perspective'?height:Math.min(width,height));
 if(!Number.isFinite(scale)||scale<=0)return [0,0,0];
 if(top){const c=Math.cos(camera.yaw),s=Math.sin(camera.yaw);return[(-dx*c-dy*s/Math.sin(camera.pitch))*scale,0,(dx*s-dy*c/Math.sin(camera.pitch))*scale];}
 const m=rotation(camera.yaw,camera.pitch);return [0,1,2].map(i=>-dx*scale*m[i*3]+dy*scale*m[i*3+1]);
}

export const PLAN_ENTER_PITCH=85*Math.PI/180;
export const PLAN_EXIT_PITCH=80*Math.PI/180;
/** Settle only at gesture end, never change interpretation halfway through a drag. */
export function createPlanNavigation(){
 let automatic=false,orbitOverride=false;
 return{
  choose(mode,camera){automatic=false;orbitOverride=mode==='orbit'&&camera.pitch>=PLAN_EXIT_PITCH;},
  settle(camera,mode){
   if(camera.pitch<PLAN_EXIT_PITCH){orbitOverride=false;if(automatic){automatic=false;return'orbit';}return null;}
   if(!automatic&&!orbitOverride&&mode==='orbit'&&camera.pitch>=PLAN_ENTER_PITCH){automatic=true;return'pan';}
   return null;
  },
  snapshot:()=>({automatic,orbitOverride})
 };
}
