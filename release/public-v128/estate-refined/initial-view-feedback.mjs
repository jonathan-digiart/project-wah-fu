/** Startup error is visible outside diagnostics. Retry restarts the full guarded flow. */
export function updateInitialViewFeedback(doc,{waiting,blocked},reload){
 let retry=doc.querySelector('#retry-initial-view');
 if(!retry){retry=doc.createElement('button');retry.id='retry-initial-view';retry.type='button';retry.textContent='Retry starting view';retry.addEventListener('click',()=>{if(!retry.hidden&&!retry.disabled)reload();});doc.querySelector('.statusbar').append(retry);}
 const failed=waiting&&!!blocked;retry.hidden=!failed;retry.disabled=!failed;
 const status=doc.querySelector('#status');
 if(waiting){status.textContent=failed?'Starting view blocked: '+blocked+'. Retry starting view after the required source is available. Geometry remains hidden.':'Validating the initial view; geometry remains hidden.';status.setAttribute('role',failed?'alert':'status');doc.querySelector('.statusbar').classList.toggle('warn',failed);}
 else{status.setAttribute('role','status');doc.querySelector('.statusbar').classList.remove('warn');}
}
