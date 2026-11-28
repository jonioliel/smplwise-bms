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

/** A pin's values as sent, without its revision (the save itself moves the revision). */
const valuesOf = (a: unknown): string => JSON.stringify({ ...(a as Record<string, unknown>), revision: null });

/**
 * One save of the unsaved pins, one PATCH after another. `conflict`: a pin changed meanwhile on the server (stale revision).
 *
 * MH2-03: the set is read once at the start, and at the end only the pins saved WITH THE VALUES THEY HAVE NOW leave the unsaved set - a
 * pin moved while the save ran (a new one, or one already sent and moved again) stays unsaved and keeps its mark.
 */
export async function savePinsOnce<A>(io: PinSaveIo<A>): Promise<{ conflict: boolean }> {
  let conflict = false;
  const sent = new Map<string, string>();
  for (const id of [...io.dirty()]) {
    const a = io.anchor(id);
    if (!a) {
      sent.set(id, '');
      continue;
    }
    try {
      const values = valuesOf(a);
      io.landed(id, await io.send(a));
      sent.set(id, values);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'stale_revision') conflict = true;
      else throw err;
    }
  }
  if (conflict) return { conflict };
  io.setDirty(new Set([...io.dirty()].filter((id) => {
    if (!sent.has(id)) return true;
    const now = io.anchor(id);
    return now !== undefined && valuesOf(now) !== sent.get(id);
  })));
  return { conflict };
}

/**
 * The save button and Ctrl+S share one save at a time (MH2-03: a second Ctrl+S during a save sent the same pins with the same revision and
 * reported a conflict with itself). A call while a save runs waits for it, then saves again only if something is still unsaved.
 */
export class PinSaveFlight {
  private running: Promise<boolean> | null = null;

  run(save: () => Promise<boolean>, pending: () => boolean): Promise<boolean> {
    if (this.running) return this.running.then((ok) => (ok && pending() ? this.run(save, pending) : ok));
    const p = save().finally(() => {
      if (this.running === p) this.running = null;
    });
    this.running = p;
    return p;
  }
}
