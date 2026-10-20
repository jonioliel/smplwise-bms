import type { SceneDescription } from './scene-builder';

/**
 * PERF3D-295: whether two scene descriptions are equal in content (plain JSON: numbers, strings, booleans, null, arrays, plain
 * objects - what buildScene returns). The live floor map builds a new description for every HA push that touches the floor's
 * entities; most pushes in a home are readings that the 3D never draws (a power meter's watts, a humidity: an entity pill shows
 * the name and an on / off / open / locked word only), so the new description equals the shown one. The host keeps the shown
 * object then and the 3D view does nothing - it used to realise the whole scene again, redraw the shadow map and re-lay the
 * labels. A key present with `undefined` on one side and absent on the other counts as a difference (a rebuild, as before).
 */
export function sameScene(a: SceneDescription, b: SceneDescription): boolean {
  return a === b || equalJson(a, b);
}

function equalJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!equalJson(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  const ob = b as Record<string, unknown>;
  const oa = a as Record<string, unknown>;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(ob, k) || !equalJson(oa[k], ob[k])) return false;
  }
  return true;
}
