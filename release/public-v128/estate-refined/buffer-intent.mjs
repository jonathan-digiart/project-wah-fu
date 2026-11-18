/** Whole-view approximation is restricted to a pure zoom-out, never orbit/pan.
 * Compare accepted poses so speculative collision proposals cannot change display policy.
 */
export function zoomOutBufferIntent(previous,current,enabled=false){
 if(!previous)return false;
 const close=(a,b)=>Math.abs((a??0)-(b??0))<1e-7;
 const samePose=previous.projection===current.projection&&close(previous.yaw,current.yaw)&&close(previous.pitch,current.pitch)&&previous.pivot.every((v,i)=>close(v,current.pivot[i]));
 if(!samePose)return false;
 const oldScale=previous.projection==='perspective'?previous.distance:previous.halfSpan,newScale=current.projection==='perspective'?current.distance:current.halfSpan;
 if(close(oldScale,newScale))return enabled;
 return newScale>oldScale;
}
