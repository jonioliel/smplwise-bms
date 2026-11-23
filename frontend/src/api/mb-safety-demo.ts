/**
 * MULTI-BUILDING-SAFETY-2500: the static demo's stand-ins for the floor-move preview and the check before turning multi-building on (no
 * backend), so both dialogs can be reviewed without a server. `?mbcheck=block` shows a blocking finding; `?mbmove=clean` a move that
 * nobody loses access by. Fetched on the first demo call only (api/mb-safety.ts), never with a backend. Hebrew demo data, like the other
 * demo stores.
 */
import type { MovePreview, MultiCheck, MultiFinding } from './mb-safety';

type MovePerson = MovePreview['people']['items'][number];

export interface DemoMoveContext {
  floorName: string;
  floorLevel: number;
  fromId: string;
  fromName: string;
  toName: string;
}

function demoParam(name: string): string | null {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

export function demoPreview(floorId: string, buildingId: string, ctx?: DemoMoveContext): MovePreview {
  const clean = demoParam('mbmove') === 'clean';
  const loses: MovePerson[] = clean ? [] : [
    { user_id: 'u1', name: 'דנה לוי', change: 'loses', lost: ['map.read', 'devices.read', 'devices.control'], gained: [] },
    { user_id: 'u2', name: 'יוסי כהן', change: 'loses', lost: ['map.read', 'devices.read'], gained: [] },
    { user_id: 'u3', name: 'צוות ניקיון א', change: 'loses', lost: ['map.read'], gained: [] },
  ];
  const gains: MovePerson[] = [
    { user_id: 'u4', name: 'מירב אברהם', change: 'gains', lost: [], gained: ['map.read', 'devices.read'] },
    { user_id: 'u5', name: 'אבי מזרחי', change: 'gains', lost: [], gained: ['map.read'] },
  ];
  const items = [...loses, ...gains];
  return {
    floor: { id: floorId, name: ctx?.floorName ?? 'קומה', level: ctx?.floorLevel ?? 0 },
    from_building: { id: ctx?.fromId ?? 'from', name: ctx?.fromName ?? '' },
    to_building: { id: buildingId, name: ctx?.toName ?? '' },
    people: { loses: loses.length, gains: gains.length, changes: 0, total: items.length, items },
    moves_with: { floor_bindings: 1, cameras: 6, anchors: 10, plans: 2, areas: 4, records: { tickets: 3, ticket_rfqs: 0, maint_tasks: 1, notices: 0, incidents: 0 } },
    blockers: [],
    warnings: clean ? [] : [{ code: 'people_lose_access', items: loses.map((p) => ({ id: p.user_id, name: p.name })) }],
    can_move: true,
    digest: 'demo',
  };
}

export function demoCheck(): MultiCheck {
  const block = demoParam('mbcheck') === 'block';
  const findings: MultiFinding[] = [];
  if (block)
    findings.push({ code: 'entity_cross_building', severity: 'blocking', count: 1, items: [{ id: 'light.lobby_b', name: 'תאורת לובי', building: 'בניין א', placed_in: 'בניין ב', area: 'א · לובי' }] });
  findings.push(
    { code: 'reach_gain', severity: 'warning', count: 14, items: [
      { id: 'b1', name: 'בניין א', devices: 9, sensitive: 1, holders: 3, holder_names: ['דנה לוי', 'דיירי בניין א', 'יוסי כהן'], sensitive_names: ['מנעול חדר אשפה'] },
      { id: 'b2', name: 'בניין ב', devices: 5, sensitive: 0, holders: 1, holder_names: ['מירב אברהם'], sensitive_names: [] },
    ] },
    { code: 'unmapped_areas', severity: 'warning', count: 2, items: [{ id: 'a1', name: 'מחסן', devices: 2 }, { id: 'a2', name: 'גג', devices: 1 }] },
    { code: 'versions_since', severity: 'info', count: 1, items: [{ site_id: 'site1', number: 3, kind: 'apply', created_at: '2026-11-22T18:40:00Z', by: 'הדגמה' }] },
  );
  return { digest: 'demo', reach_mode: 'map_and_mapping', review_mode: 'required', buildings: 4, blocking: block ? 1 : 0, warnings: 2, last_on: null, findings };
}
