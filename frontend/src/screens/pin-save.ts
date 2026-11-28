// FIX-MAPS2-2570 (deep review 2.57 MH2-03): the plan editor's pin save (explore-plan-editor.ts save()), out of the editor so it runs in
// node (tests/unit-fix-maps2-2570.spec.ts). Pure: the editor hands in its unsaved set, its pins and the PATCH.
import { ApiError } from '../api/client';

/** What the save reads from and writes back to the editor. */
export interface PinSaveIo<A> {
  /** The ids of the pins with unsaved changes (the editor replaces the set on every edit). */
  dirty(): ReadonlySet<string>;
  /** The pin as it is now. */
  anchor(id: string): A | undefined;
  /** `PATCH /map-anchors/{id}` with the pin's values; answers its new revision. */
  send(a: A): Promise<number>;
  /** A pin's save landed: its new revision. */
  landed(id: string, revision: number): void;
  setDirty(next: Set<string>): void;
}

/** One save of the unsaved pins, one PATCH after another. `conflict`: a pin changed meanwhile on the server (stale revision). */
export async function savePinsOnce<A>(io: PinSaveIo<A>): Promise<{ conflict: boolean }> {
  let conflict = false;
  for (const id of io.dirty()) {
    const a = io.anchor(id);
    if (!a) continue;
    try {
      io.landed(id, await io.send(a));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'stale_revision') conflict = true;
      else throw err;
    }
  }
  if (conflict) return { conflict };
  io.setDirty(new Set());
  return { conflict };
}

/** The save button and Ctrl+S: each call runs a save. */
export class PinSaveFlight {
  run(save: () => Promise<boolean>, _pending: () => boolean): Promise<boolean> {
    return save();
  }
}
