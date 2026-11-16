/**
 * Identity memo keys for render-time getters (0.1.89 list, item 3). A getter read several times per render (the history
 * map's and the event page's 3D scene) first compares the objects it reads by identity - the screens replace their
 * bundle, structure, library and recordings, never mutate them - and only when one of them changed pays for the full
 * signature (the anchor list and its JSON key). Pure, so it runs in node (tests/unit-scene-memo.spec.ts).
 */

// The identity check ASSUMES the screens never mutate what they pass in place: a bundle, a structure document, a library
// or a recordings map is always replaced by a new object when it changes (a push, a reload, a new instant). A future
// in-place edit (e.g. `bundle.anchors[i].x = ...`) would leave a stale 3D scene until another key changes.

/** Whether two key lists hold the same values, compared with `===` (NaN never equals itself: a NaN key always rebuilds). */
export function sameRefs(a: readonly unknown[] | null | undefined, b: readonly unknown[]): boolean {
  return !!a && a.length === b.length && a.every((k, i) => k === b[i]);
}

/**
 * CR-INV-PLAYBACK-2440 (review 06:PERF-1, 06:PERF-2): a few identity memos for one element, by name. A render-time list that is handed
 * to a child (`.segments`, `.events`) must be the SAME array while what it is built from did not change - a fresh array per render
 * makes the child see a changed property every tick of a playing clock. `get(slot, refs, make)` returns the value made for `slot`
 * the last time unless one of `refs` changed (compared with `===`, see `sameRefs`).
 */
export class RefMemo {
  private slots = new Map<string, { refs: readonly unknown[]; value: unknown }>();

  get<T>(slot: string, refs: readonly unknown[], make: () => T): T {
    const hit = this.slots.get(slot);
    if (hit && sameRefs(hit.refs, refs)) return hit.value as T;
    const value = make();
    this.slots.set(slot, { refs, value });
    return value;
  }
}
