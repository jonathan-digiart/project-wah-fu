/** Pure projected-size selector; thresholds are caller-supplied provisional pixels, not site facts.
 * A previously coarse tile enters fine at enterFinePixels; a fine tile leaves at exitFinePixels.
 * maxFine explicitly caps fine selections; largest projected tiles win, stable tile key breaks ties.
 */
export function selectTileLods(
  tiles,
  previous = new Map(),
  { enterFinePixels, exitFinePixels, maxFine = tiles.length } = {},
) {
  if (
    !Number.isFinite(enterFinePixels) ||
    !Number.isFinite(exitFinePixels) ||
    exitFinePixels < 0 ||
    enterFinePixels <= exitFinePixels ||
    !Number.isInteger(maxFine) ||
    maxFine < 0
  )
    throw Error("Invalid LOD policy");
  const keys = new Set();
  const selected = tiles.map((t) => {
    const key = `${t.x},${t.z}`;
    if (
      !Number.isSafeInteger(t.x) ||
      !Number.isSafeInteger(t.z) ||
      !Number.isFinite(t.projectedRadiusPixels) ||
      t.projectedRadiusPixels < 0 ||
      keys.has(key)
    )
      throw Error("Invalid projected tile");
    keys.add(key);
    const wasFine = previous.get(key) === "fine";
    const fine = wasFine
      ? t.projectedRadiusPixels > exitFinePixels
      : t.projectedRadiusPixels >= enterFinePixels;
    return { ...t, key, lod: fine ? "fine" : "coarse" };
  });
  const fineKeys = new Set(
    selected
      .filter((t) => t.lod === "fine")
      .sort(
        (a, b) =>
          b.projectedRadiusPixels - a.projectedRadiusPixels ||
          a.key.localeCompare(b.key),
      )
      .slice(0, maxFine)
      .map((t) => t.key),
  );
  return selected.map(({ x, z, key }) => ({
    x,
    z,
    lod: fineKeys.has(key) ? "fine" : "coarse",
  }));
}
