import {decodeGeometry} from './geometry-decode.mjs';
const cancelled=()=>new DOMException('Request cancelled','AbortError');
/** Bounded pool. Aborting terminates active decode, including synchronous legacy parsing. */
export class DecodePool {
 constructor({size=3,onFallback=()=>{},onReset=()=>{}}={}) {
  this.onReset=onReset;this.size=size;this.slots=[];this.sequence=0;this.onFallback=onFallback;
  this.unavailable=typeof Worker!=='function';
  this.fallbackReason=this.unavailable?'worker-unavailable':null;
 }
 markUnavailable(reason) {
  this.unavailable=true;
  this.fallbackReason??=reason;
  try { this.onFallback(this.fallbackReason); } catch { /* diagnostics must not affect cleanup */ }
 }
 async run(request,signal,{onPhase=()=>{}}={}) {
  if(signal.aborted)throw cancelled();
  if(this.unavailable){
   try { this.onFallback(this.fallbackReason); } catch { /* diagnostics must not block retry */ }
   // Preserve the existing one-event-loop-turn yield before main-thread decode.
   await new Promise(resolve=>setTimeout(resolve,0));
   if(signal.aborted)throw cancelled();
   onPhase('decode');return decodeGeometry(request,signal);
  }
  let slot=this.slots.find(s=>!s.busy);
  if(!slot){if(this.slots.length>=this.size)throw Error('Decoder concurrency bound exceeded');slot={worker:null,busy:false,ready:false};this.slots.push(slot);}
  if(!slot.worker){
   try{slot.ready=false;slot.worker=new Worker(new URL('./decode-worker-ready.mjs',import.meta.url),{type:'module'});}
   catch{this.markUnavailable('worker-construction-error');return this.run(request,signal,{onPhase});}
  }
  return new Promise((resolve,reject)=>{
   const id=++this.sequence;slot.busy=true;let done=false;
   const finish=(error,result,terminate=false)=>{
    if(done)return;done=true;signal.removeEventListener('abort',abort);slot.busy=false;
    const worker=slot.worker;
    if(worker)worker.onmessage=worker.onerror=worker.onmessageerror=null;
    if(terminate){try{this.onReset(error?.name==='AbortError'?'decode-cancel':'decode-error')}catch{}worker?.terminate();if(slot.worker===worker){slot.worker=null;slot.ready=false;}}
    error?reject(error):resolve(result);
   };
   const abort=()=>finish(cancelled(),null,true);
   const failWorker=(reason,message)=>{this.markUnavailable(reason);finish(Error(message),null,true);};
   signal.addEventListener('abort',abort,{once:true});
   const send=()=>{try{onPhase('decode');if(signal.aborted){abort();return;}}catch(error){finish(error,null,true);return;}try{slot.worker.postMessage({id,request},[request.bytes]);}catch{failWorker('worker-postmessage-error','Background decoder could not send a request. Retry uses the compatibility decoder.');}};
   slot.worker.onmessage=({data})=>{
    if(data?.type==='decoder-ready'){if(!slot.ready){slot.ready=true;send();}return;}
    // A request deserialization failure in the dedicated worker has no usable
    // request ID. The slot has at most one active job; terminate it, fail this
    // attempt and let explicit Retry fetch new bytes for the compatibility path.
    if(data?.type==='worker-input-messageerror'){
     failWorker('worker-input-messageerror','Background decoder could not receive a request. Retry uses the compatibility decoder.');return;
    }
    if(data?.id!==id)return;
    finish(data.error?Error(data.error):null,data.result);
   };
   slot.worker.onerror=()=>failWorker('worker-error','Background decoder unavailable. Retry uses the compatibility decoder.');
   slot.worker.onmessageerror=()=>failWorker('worker-output-messageerror','Background decoder result could not be read. Retry uses the compatibility decoder.');
   if(slot.ready)send();else try{onPhase('decode-worker-startup');}catch(error){finish(error,null,true);}
   if(signal.aborted)abort();
  });
 }
 dispose(){for(const slot of this.slots)slot.worker?.terminate();this.slots=[];}
}
