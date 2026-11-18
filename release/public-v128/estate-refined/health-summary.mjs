/** Small visible snapshot for native accessibility clients; no telemetry/upload. */
export function healthSummary({churnCounts={},sourceAdmission={},loader={}}={}) {
 const n=value=>Number.isFinite(value)&&value>=0&&Number.isInteger(value)?(value>9999999?'~'+value.toExponential(2):String(value)):'?';
 const c=key=>n(churnCounts[key]);
 return [
  `Load requests ${c('request')} | guard complete ${c('complete')} | aborts ${c('abort')}`,
  `Guard errors ${c('error')} | guard timeouts ${c('timeout')} | decode resets ${c('worker-reset')} | WebGL losses ${c('context-loss')}`,
  `Source gate active ${n(sourceAdmission.active)} | queued ${n(sourceAdmission.queued)} | peak ${n(sourceAdmission.peakActive)} / limit ${n(sourceAdmission.limit)}`,
  `Render cache resident ${n(loader.resident)} | in flight ${n(loader.inflight)} | current-view failures ${Array.isArray(loader.failed)?n(loader.failed.length):'?'}`,
  'Page-session snapshot; not live/console/GPU-error coverage. ? unavailable.'
 ].join('\n');
}
