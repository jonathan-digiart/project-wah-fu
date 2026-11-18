/** A temporary opaque image above an already opaque detailed frame.
 * Images are composited, never overlapping meshes in a shared depth buffer.
 * A changed view cancels the cover so no stale camera image follows input.
 */
export class TransitionCover {
 constructor(element,{requestFrame=fn=>globalThis.requestAnimationFrame(fn),cancelFrame=id=>globalThis.cancelAnimationFrame(id)}={}){this.element=element;this.requestFrame=requestFrame;this.cancelFrame=cancelFrame;this.active=false;this.frame=null;this.animation=null;this.serial=0;this.bytes=0;}
 capture(source){
  this.cancel();const e=this.element;if(!source.width||!source.height)return false;
  try{e.width=source.width;e.height=source.height;const ctx=e.getContext('2d',{alpha:false});if(!ctx)throw Error('Snapshot canvas unavailable');ctx.drawImage(source,0,0);e.hidden=false;e.style.opacity='1';e.style.transition='none';this.active=true;this.bytes=e.width*e.height*4;return true;}
  catch{this.cancel();return false;}
 }
 dissolve(duration,complete){
  if(!this.active){complete();return;}const serial=this.serial,e=this.element;
  this.frame=this.requestFrame(()=>{this.frame=null;if(serial!==this.serial||!this.active)return;
   if(typeof e.animate==='function'){
    try{this.animation=e.animate([{opacity:1},{opacity:0}],{duration,easing:'ease-in-out',fill:'forwards'});const finished=this.animation?.finished;if(finished&&typeof finished.then==='function')finished.then(()=>{if(serial===this.serial&&this.active)complete();}).catch(()=>{});}
    catch{this.animation?.cancel?.();this.animation=null;e.style.transition=`opacity ${duration}ms ease-in-out`;e.style.opacity='0';}
   }else{e.style.transition=`opacity ${duration}ms ease-in-out`;e.style.opacity='0';}
  });
 }
 cancel(){this.serial++;if(this.frame!==null)this.cancelFrame(this.frame);this.frame=null;this.animation?.cancel?.();this.animation=null;this.active=false;this.bytes=0;this.element.hidden=true;this.element.style.transition='none';this.element.style.opacity='1';this.element.width=0;this.element.height=0;}
}
