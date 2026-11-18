/** Only the complete, unchanged opening scene may reuse its preserved pixels.
 * Final detail always redraws so missing/failure bounds stay current. */
export function bootstrapRenderKey({ mode, bootstrapActive, bootstrapReady, veil,
  camera, width, height, pixelRatio, draw, shown }) {
  if (mode !== 'context' || !bootstrapActive || !bootstrapReady || veil) return null;
  return JSON.stringify([mode, camera, width, height, pixelRatio, draw.map(e => e.id), shown]);
}
export function canReuseBootstrap({ key, previousKey, preserved, width, height, backingWidth, backingHeight, pixelRatio }) {
  return key !== null && key === previousKey && preserved === true
    && backingWidth === Math.max(1, Math.round(width * pixelRatio))
    && backingHeight === Math.max(1, Math.round(height * pixelRatio));
}
