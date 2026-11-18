/** One current load, latest intent only; new render work preempts via AbortSignal. */
export class CollisionDemandScheduler {
 constructor({load,isRenderIdle,isCurrent,retry,onStatus=()=>{},delayMs=20}){Object.assign(this,{load,isRenderIdle,isCurrent,retry,onStatus,delayMs});this.latest=null;this.running=false;this.controller=null;this.disposed=false;}
 request(ids,intent){this.latest={ids:[...new Set(ids)],intent};this.controller?.abort();this.pump();}
 preempt(){this.controller?.abort();}
 async pump(){if(this.running||this.disposed)return;this.running=true;try{while(this.latest&&!this.disposed){const job=this.latest;this.latest=null;const controller=new AbortController();this.controller=controller;try{for(const id of job.ids){while(!this.isRenderIdle()){if(controller.signal.aborted||!this.isCurrent(job.intent))throw new DOMException('Superseded','AbortError');await new Promise(r=>setTimeout(r,this.delayMs));}if(controller.signal.aborted||!this.isCurrent(job.intent))throw new DOMException('Superseded','AbortError');this.onStatus({state:'Preparing navigation surfaces',id});await this.load(id,controller.signal);}if(!controller.signal.aborted&&this.isCurrent(job.intent))this.retry(job.intent);}catch(e){if(e.name==='AbortError'||controller.signal.aborted||!this.isCurrent(job.intent)||this.disposed){if(!this.latest&&this.isCurrent(job.intent)&&!this.disposed)this.latest=job;await new Promise(r=>setTimeout(r,this.delayMs));}else this.onStatus({state:'Navigation surface unavailable',error:e.message});}finally{if(this.controller===controller)this.controller=null;}}}finally{this.running=false;}}
 cancel(){this.latest=null;this.controller?.abort();}
 dispose(){this.disposed=true;this.latest=null;this.controller?.abort();}
}
