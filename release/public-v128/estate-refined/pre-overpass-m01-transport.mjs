import{createTinWanTransport}from'./tinwan-transport.mjs';
import{pins,targets}from'./tinwan-pins.mjs';
import{createM01AppendTransport as priorFactory,M01_APPEND_PINS as priorPins,M01_APPEND_WIRE_BYTES as priorWire}from'./m01-r02-append-fallback.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const match=(e,t)=>e&&Object.keys(t).every(k=>equal(e[k],t[k]));
const priorMatch=e=>e?.id==='context-roads-B-king-pokfu-spatial'&&e.layer==='roads'&&['sha256','bytes','triangles'].every(k=>e[k]===priorPins.target[k]);
export function m01AppendWireBytes(e){for(const route of['enabled','off'])if(match(e,targets[route]))return pins[route].base.bytes+pins[route].wire.bytes;if(priorMatch(e))return priorWire;throw Error('Unsupported exact Tin Wan transport identity');}
export const M01_APPEND_PINS=pins.enabled;
export const M01_APPEND_WIRE_BYTES=pins.enabled.base.bytes+pins.enabled.wire.bytes;
export function createM01AppendTransport(options){const enabled=createTinWanTransport({...options,pins:pins.enabled}),off=createTinWanTransport({...options,pins:pins.off}),prior=priorFactory(options);return(e,...args)=>{m01AppendWireBytes(e);if(match(e,targets.enabled))return enabled(e,...args);if(match(e,targets.off))return off(e,...args);return prior(e,...args);};}
