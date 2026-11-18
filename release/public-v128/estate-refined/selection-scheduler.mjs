/** Offline candidate. Does not change camera integration or retain extra geometry.
 * Selection requests keep their original deadline, so continuous input cannot
 * postpone work forever. The caller must flush when the final pointer ends.
 */
export function createSelectionScheduler({commit,setTimer=setTimeout,clearTimer=clearTimeout,delayMs=80}) {
 if(!Number.isFinite(delayMs)||delayMs<0)throw new RangeError('Invalid selection delay');
 let timer=null, pending=false, generation=0;
 function flush(){if(timer!==null)clearTimer(timer);timer=null;if(!pending)return false;pending=false;generation++;commit();return true;}
 function request(){pending=true;if(timer!==null)return;const token=++generation;timer=setTimer(()=>{if(token!==generation)return;timer=null;flush();},delayMs);}
 function cancel(){generation++;pending=false;if(timer!==null)clearTimer(timer);timer=null;}
 return {request,flush,cancel,state:()=>({pending,scheduled:timer!==null})};
}
