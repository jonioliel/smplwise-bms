/**
 * Identity memo keys for render-time getters (0.1.89 list, item 3). A getter read several times per render (the history
 * map's and the event page's 3D scene) first compares the objects it reads by identity - the screens replace their
 * bundle, structure, library and recordings, never mutate them - and only when one of them changed pays for the full
 * signature (the anchor list and its JSON key). Pure, so it runs in node (tests/unit-scene-memo.spec.ts).
 */

/** Whether two key lists hold the same values, compared with `===` (NaN never equals itself: a NaN key always rebuilds). */
export function sameRefs(a: readonly unknown[] | null | undefined, b: readonly unknown[]): boolean {
  return !!a && a.length === b.length && a.every((k, i) => k === b[i]);
}
