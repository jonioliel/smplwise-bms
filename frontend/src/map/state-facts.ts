/**
 * The structure facts the room state layer (room-state.ts) reads from a published structure: the openings (gap midpoints,
 * normalised, with the entity bound to each) and the lamp objects (with their circuit and their own entity). Shared by the
 * live floor map and the historical map's time scrub, so the past and the present are drawn by one algorithm
 * (CR-TIMESCRUB101 section 4.1). Pure: the same document, size and catalogue give the same facts.
 */
import { buildPrimitives, type CatalogLookup, type GeometryDoc } from './geometry';
import { panelStateId } from './glass-wall';
import type { StateEntity, StateOpening } from './room-state';

export interface StateFactLamp {
  x: number;
  y: number;
  level_id: string;
  circuit: string | null;
  entity: string | null;
}
export interface StateFacts {
  openings: StateOpening[];
  lamps: StateFactLamp[];
}

/** The openings and lamp objects of `doc` drawn at `width` x `height` plan pixels. */
export function stateFactsOf(doc: GeometryDoc, width: number, height: number, catalog?: CatalogLookup | null): StateFacts {
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const byId = new Map(doc.openings.map((o) => [o.id, o]));
  const openings: StateOpening[] = [];
  const lamps: StateFactLamp[] = [];
  for (const p of buildPrimitives(doc, width, height, null, catalog ?? undefined)) {
    if (p.kind === 'door' || p.kind === 'window' || p.kind === 'passage') {
      const o = byId.get(p.id);
      const w = o ? walls.get(o.wall_id) : undefined;
      if (!o || !w) continue;
      openings.push({ id: o.id, kind: p.kind, x: (p.gap[0][0] + p.gap[1][0]) / 2 / width, y: (p.gap[0][1] + p.gap[1][1]) / 2 / height, level_id: w.level_id, entity_id: o.anchor_ref?.resource_type === 'ha_entity' ? o.anchor_ref.resource_id : null });
    } else if (p.kind === 'glazing') {
      // a window wall's panels that open (document 2.1): each is an opening of the state layer under its own id, bound
      // to its entity when it has one; a fixed panel is glass, not an opening
      const w = walls.get(p.id);
      if (!w) continue;
      for (const q of p.panels) {
        if (!q.operation) continue;
        openings.push({ id: panelStateId(p.id, q.index), kind: 'window', x: (q.a[0] + q.b[0]) / 2 / width, y: (q.a[1] + q.b[1]) / 2 / height, level_id: w.level_id,
          entity_id: q.anchor?.startsWith('ha_entity:') ? q.anchor.slice('ha_entity:'.length) : null });
      }
    } else if (p.kind === 'object' && (p.color === 'light' || p.circuit_id !== null)) {
      lamps.push({ x: p.cx / width, y: p.cy / height, level_id: p.level_id, circuit: p.circuit_id, entity: p.anchor?.startsWith('ha_entity:') ? p.anchor.slice('ha_entity:'.length) : null });
    }
  }
  return { openings, lamps };
}

/** The parts of a map bundle's anchor the state entities are built from (api/types Anchor). */
export interface StateAnchor {
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
  position: { x: number; y: number };
  level_id?: string | null;
  layer_id?: string | null;
  entity?: { domain?: string | null; device_class?: string | null; last_changed?: string | null; attributes?: Record<string, unknown> | null } | null;
}

/** The room-state entities of a floor's anchors with the given states (null = unknown, contributes nothing). `lastChanged`
 * overrides the anchor's own last_changed (a replay passes the change time of the instant); `withAttributes: false` drops
 * the attributes (the history does not record them: a past room must never show today's climate temperature). */
export function stateEntitiesOf(anchors: readonly StateAnchor[], states: Readonly<Record<string, string | null>>, opts: { lastChanged?: Readonly<Record<string, string | null>>; withAttributes?: boolean } = {}): StateEntity[] {
  const out: StateEntity[] = [];
  const withAttrs = opts.withAttributes !== false;
  for (const a of anchors) {
    if (a.resource_type !== 'ha_entity') continue;
    const e = a.entity;
    out.push({
      id: a.resource_id, domain: e?.domain ?? a.resource_id.split('.')[0] ?? '', device_class: e?.device_class ?? null, state: states[a.resource_id] ?? null,
      last_changed: opts.lastChanged ? opts.lastChanged[a.resource_id] ?? null : e?.last_changed ?? null, attributes: withAttrs ? e?.attributes ?? null : null,
      x: a.position.x, y: a.position.y, level_id: a.level_id ?? null, layer_id: a.layer_id ?? null,
    });
  }
  return out;
}
