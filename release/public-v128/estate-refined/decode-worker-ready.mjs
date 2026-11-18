import {decodeGeometry} from './geometry-decode.mjs';
// A deserialization failure does not provide the request ID. This worker has
// only one job per pool slot, so the owner can fail that job and terminate it.
self.onmessageerror=()=>{self.postMessage({type:'worker-input-messageerror'});};
self.onmessage=async({data:{id,request}})=>{
 try{const result=await decodeGeometry(request);self.postMessage({id,result},[...new Set(result.parts.map(p=>p.data.buffer))]);}
 catch(error){self.postMessage({id,error:error?.message||'Background decoder failed.'});}
};

self.postMessage({type:'decoder-ready'});
