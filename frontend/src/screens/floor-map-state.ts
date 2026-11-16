/**
 * The pure state rules of the live floor map (screens/explore-floor-map.ts), apart from the element so a node unit can
 * test them (code review 06:RACE-1, MAP-1, PERF-6 - CR-FLOORMAP-STATE-2440):
 *
 * - `LoadGeneration`: the shell re-uses the element when only the floor in the address changes, so two loads can be in
 *   flight; only the latest may write the screen (T15 pattern, as `geomSeq` already did for the structure).
 * - `restoredLayers`: the layer set of a floor from this browser's storage, or the DEFAULT set - never the set of the
 *   floor shown before.
 * - `stateFactsMemo`: the openings and lamps of a structure, keyed on everything the result reads - the document, the
 *   plan size AND the object library (a lamp is a lamp by its library item's colour).
 * - `RefMemo`: one value kept while the things it was computed from are the same objects.
 */
import type { CatalogLookup, GeometryDoc } from '../map/geometry';
import { stateFactsOf, type StateFacts } from '../map/state-facts';

// ---- the load generation -------------------------------------------------------------------------------------------

export class LoadGeneration {
  private seq = 0;

  /** Starts a load. The answer says whether a NEWER load started since: check it after every `await` and before every
   * write of a late answer. */
  begin(): () => boolean {
    const mine = ++this.seq;
    return () => mine !== this.seq;
  }
}

// ---- the layer set ---------------------------------------------------------------------------------------------------

/** The layers of the floor map, in the order of the layers panel. */
export const FLOOR_LAYER_IDS = ['cameras', 'doors', 'lights', 'sensors', 'zones', 'structure', 'objects', 'connectors', 'states', 'photo'] as const;
export type FloorLayer = (typeof FLOOR_LAYER_IDS)[number];

/** Layers added after the first stored lists: a list saved before a layer existed must not hide it. A layer that was
 * switched off is stored as "-<id>". */
export const LATE_FLOOR_LAYERS: readonly FloorLayer[] = ['structure', 'objects', 'connectors', 'states', 'photo'];

const isLayer = (l: unknown): l is FloorLayer => (FLOOR_LAYER_IDS as readonly unknown[]).includes(l);

/** The layer set of a floor: what `raw` (the stored JSON list) says, with the late layers on unless it switched them
 * off; every layer when nothing usable is stored (a floor never visited, blocked storage, a damaged value). */
export function restoredLayers(raw: string | null | undefined): Set<FloorLayer> {
  if (raw) {
    try {
      const arr: unknown = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const next = new Set<FloorLayer>(arr.filter(isLayer));
        for (const id of LATE_FLOOR_LAYERS) if (!arr.includes(`-${id}`)) next.add(id);
        return next;
      }
    } catch {
      /* a damaged value: the defaults */
    }
  }
  return new Set<FloorLayer>(FLOOR_LAYER_IDS);
}

// ---- the state facts ---------------------------------------------------------------------------------------------------

export interface StateFactsMemo extends StateFacts {
  geometry: GeometryDoc;
  w: number;
  h: number;
  catalog: CatalogLookup | null;
}

/** The openings and lamp objects of `doc` at `w` x `h`: `prev` while the document, the size and the library are the
 * same objects, else built again (map/state-facts.ts - the helper the historical map's time scrub uses too). */
export function stateFactsMemo(prev: StateFactsMemo | null, doc: GeometryDoc, w: number, h: number, catalog: CatalogLookup | null): StateFactsMemo {
  if (prev && prev.geometry === doc && prev.w === w && prev.h === h && prev.catalog === catalog) return prev;
  return { geometry: doc, w, h, catalog, ...stateFactsOf(doc, w, h, catalog) };
}

// ---- identity memo -----------------------------------------------------------------------------------------------------

/** A value computed from objects that are replaced, never mutated (the bundle, the tree, the layer set): kept while
 * every reference (and every primitive) in `refs` is the same as last time. */
export class RefMemo<T> {
  private refs: readonly unknown[] | null = null;
  private value!: T;

  get(refs: readonly unknown[], make: () => T): T {
    const r = this.refs;
    if (r && r.length === refs.length && r.every((x, i) => Object.is(x, refs[i]))) return this.value;
    this.value = make();
    this.refs = refs;
    return this.value;
  }
}
