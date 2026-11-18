/** Serial cooperative upload admission. A throttled animation frame cannot
 * hold the queue indefinitely; whichever scheduled callback runs first wins.
 */
export function createAdmissionQueue({requestFrame=fn=>globalThis.requestAnimationFrame(fn),cancelFrame=id=>globalThis.cancelAnimationFrame(id),setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id),fallbackMs=250}={}){
 let tail=Promise.resolve();
 const abort=()=>new DOMException('Request cancelled','AbortError');
 return signal=>{
  const turn=tail.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
   if(signal.aborted){reject(abort());return;}let frame=null,timer=null,settled=false;
   const finish=trigger=>{if(settled)return;settled=true;if(frame!==null)cancelFrame(frame);if(timer!==null)clearTimer(timer);signal.removeEventListener('abort',stop);signal.aborted?reject(abort()):resolve(trigger);};
   const stop=()=>finish('cancelled');signal.addEventListener('abort',stop,{once:true});frame=requestFrame(()=>finish('render-frame'));timer=setTimer(()=>finish('timer-fallback'),fallbackMs);if(signal.aborted)stop();
  }));tail=turn;return turn;
 };
}
