/** Keep permits until underlying non-cancellable work settles, even when its
 * caller's outer load guard has already rejected. Does not make WebCrypto
 * cancellable. Hung underlying work occupies a permit indefinitely by design:
 * fail closed, expose diagnostics/Retry; never spawn an unbounded replacement.
 */
export function createNoncancellableGate({limit=3,onChange=()=>{}}={}){
 if(!Number.isInteger(limit)||limit<1)throw new RangeError('Invalid gate limit');
 let active=0,peakActive=0,started=0;const queue=[],running=new Set(),idleWaiters=new Set();
 const notify=()=>{if(active===0&&queue.length===0){for(const w of [...idleWaiters])w.finish();}try{onChange()}catch{}};
 const aborted=()=>new DOMException('Request cancelled','AbortError');
 function pump(){while(active<limit&&queue.length){const job=queue.shift();job.signal.removeEventListener('abort',job.cancel);if(job.signal.aborted){job.reject(aborted());continue;}active++;running.add(job);started++;peakActive=Math.max(peakActive,active);Promise.resolve().then(()=>{if(job.signal.aborted)throw aborted();return job.work();}).then(job.resolve,job.reject).finally(()=>{active--;running.delete(job);pump();notify();});}notify();}
 function run(work,signal,expectedBytes=0){if(!Number.isSafeInteger(expectedBytes)||expectedBytes<0)return Promise.reject(new RangeError('Invalid expected bytes'));if(signal.aborted)return Promise.reject(aborted());return new Promise((resolve,reject)=>{const job={work,signal,resolve,reject,expectedBytes};job.cancel=()=>{const i=queue.indexOf(job);if(i>=0){queue.splice(i,1);reject(aborted());notify();}};queue.push(job);signal.addEventListener('abort',job.cancel,{once:true});pump();});}
 function waitIdle(signal){if(signal.aborted)return Promise.reject(aborted());if(active===0&&queue.length===0)return Promise.resolve();return new Promise((resolve,reject)=>{const w={finish(){idleWaiters.delete(w);signal.removeEventListener('abort',cancel);resolve();}};const cancel=()=>{idleWaiters.delete(w);reject(aborted());};idleWaiters.add(w);signal.addEventListener('abort',cancel,{once:true});});}
 return{run,waitIdle,snapshot:()=>({active,idleWaiters:idleWaiters.size,queued:queue.length,peakActive,started,limit,activeCancelled:[...running].filter(j=>j.signal.aborted).length,activeExpectedBytes:[...running].reduce((n,j)=>n+j.expectedBytes,0),queuedExpectedBytes:queue.reduce((n,j)=>n+j.expectedBytes,0),byteScope:"Catalogue source sizes, not measured allocations. Queued work has not fetched/allocated body bytes. Hash/browser copies and decode/GPU memory excluded."})};
}
