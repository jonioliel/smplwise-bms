import type { Page, Route } from '@playwright/test';

// WXUNBLK: a mocked backend for the REAL Connections page (#/system/setup) with the new card "חסימות פתיחת דלתות" (sw-door-blocks) behind the real
// shell. Every name is synthetic (an invented house); no Home Assistant, no WisKey, no station, no door. The two door endpoints answer the way
// routers/doors.py does (checked against the real routes by backend/tests/test_wiskey_door_overrides.py): the list is computed from the state of the
// mock - an entity is blocked until it is released, an item is blocked while it has a door step or uses a device nobody released - and the write
// refuses what the server refuses (no confirmation, no note, a door). Writes are recorded so a spec asserts exactly what was sent.
// Used by evidence-wxunblk.spec.ts and layout-wxunblk.spec.ts. Needs the Vite DEV server or the preview (`page.route` over /api/v1).

export const NOW = new Date('2026-10-13T09:30:00Z');
export const SETUP = '/system/setup';
const ADMIN = ['video.live', 'map.read', 'map.edit', 'entity.state.read', 'access.read', 'devices.read', 'events.read', 'system.configure', 'rbac.assign'];
const SITE_ADMIN = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'events.read'];

export interface MockEntity {
  entity_id: string;
  name: string;
  domain: string;
  platform: 'template' | 'universal';
  area: string | null;
  /** mapped to an intercom door by the administrator: never released here */
  door?: boolean;
}

export interface MockItem {
  key: string;
  kind: 'automation' | 'script' | 'scene' | 'schedule' | 'launcher';
  kind_text: string;
  name: string;
  state: string;
  /** a real WisKey door step */
  door_steps: number;
  /** the entities its steps touch */
  uses: string[];
  reasons?: string[];
}

export const ENTITIES: MockEntity[] = [
  { entity_id: 'switch.gate', name: 'שער חצר', domain: 'switch', platform: 'template', area: 'חצר' },
  { entity_id: 'light.hall', name: 'מנורת מבואה', domain: 'light', platform: 'template', area: 'מבואה' },
  { entity_id: 'lock.virtual', name: 'מנעול וירטואלי', domain: 'lock', platform: 'template', area: 'כניסה' },
  { entity_id: 'cover.shutter', name: 'Roller Shutter', domain: 'cover', platform: 'template', area: 'Living Room' },
  { entity_id: 'media_player.uni', name: 'נגן הסלון', domain: 'media_player', platform: 'universal', area: 'סלון' },
  { entity_id: 'lock.mapped', name: 'מנעול ממופה', domain: 'lock', platform: 'template', area: null, door: true },
];

export const ITEMS: MockItem[] = [
  { key: 'script:open_gate', kind: 'script', kind_text: 'סקריפט', name: 'פתיחת שער', state: 'ready', door_steps: 0, uses: ['switch.gate'] },
  { key: 'automation:evening', kind: 'automation', kind_text: 'אוטומציה', name: 'מבואה בערב', state: 'disabled', door_steps: 0, uses: ['light.hall', 'switch.gate'] },
  { key: 'script:virtual_door', kind: 'script', kind_text: 'סקריפט', name: 'מנעול וירטואלי', state: 'ready', door_steps: 0, uses: ['lock.virtual'] },
  { key: 'automation:entrance', kind: 'automation', kind_text: 'אוטומציה', name: 'פתיחת הכניסה בבוקר', state: 'enabled', door_steps: 1, uses: [] },
  { key: 'automation:entrance_and_gate', kind: 'automation', kind_text: 'אוטומציה', name: 'כניסה ושער', state: 'disabled', door_steps: 1, uses: ['switch.gate'] },
];

export interface BlocksMock {
  perms: string[];
  /** A WisKey door exists in this installation (else nothing is blocked and the list says so). */
  present: boolean;
  entities: MockEntity[];
  items: MockItem[];
  /** entity id -> the release */
  released: Record<string, { note: string; by: string; at: string }>;
  gets: number;
  puts: { entity_id: string; body: Record<string, unknown> }[];
  /** The list read answers with this status instead (a failure to look at). */
  getStatus: number | null;
  /** The next write answers with this (once), instead of the normal answer. */
  putFail: { status: number; code: string; message: string } | null;
  /** A delay (ms) before a write answers. */
  putDelay: number;
}

export const newBlocksMock = (over: Partial<BlocksMock> = {}): BlocksMock => ({
  perms: ADMIN,
  present: true,
  entities: ENTITIES.map((e) => ({ ...e })),
  items: ITEMS.map((i) => ({ ...i, uses: [...i.uses] })),
  released: {},
  gets: 0,
  puts: [],
  getStatus: null,
  putFail: null,
  putDelay: 0,
  ...over,
});

export const siteAdminPerms = SITE_ADMIN;

/** `n` more ordinary template lights with their own names, to see the list page (50 at a time) and search a long list. */
export const manyEntities = (n: number): MockEntity[] =>
  Array.from({ length: n }, (_, i) => ({ entity_id: `light.tpl_${String(i + 1).padStart(3, '0')}`, name: `תאורה ${String(i + 1).padStart(3, '0')}`, domain: 'light', platform: 'template' as const, area: i % 2 ? 'קומה 1' : 'קומה 2' }));

const clean = (s: unknown) => (typeof s === 'string' ? s.split(/\s+/).filter(Boolean).join(' ') : '');

/** What the server's `door_blocks.listing` answers for the state of the mock. */
export function listing(m: BlocksMock) {
  const names = new Map(m.entities.map((e) => [e.entity_id, e.name]));
  const blockedItems = m.items.filter((i) => i.door_steps > 0 || i.uses.length > 0);
  const stillBlocked = (i: MockItem) => i.door_steps > 0 || i.uses.some((u) => !m.released[u]);
  const entities = !m.present
    ? []
    : m.entities.map((e) => {
        const names5 = blockedItems.filter((i) => i.uses.includes(e.entity_id)).map((i) => i.name).sort();
        const rel = m.released[e.entity_id];
        return {
          entity_id: e.entity_id, name: e.name, domain: e.domain, platform: e.platform, area: e.area,
          state: e.door ? 'door' : rel ? 'unblocked' : 'blocked', overridable: !e.door, stale: false, override: rel ?? null,
          used_by: names5.slice(0, 5), used_more: Math.max(0, names5.length - 5),
        };
      });
  const items = !m.present
    ? []
    : blockedItems.map((i) => {
        const devs = i.uses.map((u) => ({ name: names.get(u) ?? u, state: m.released[u] ? 'unblocked' : 'blocked' })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
        return {
          key: i.key, kind: i.kind, kind_text: i.kind_text, name: i.name, state: i.state, blocked: stillBlocked(i), opens_door: i.door_steps > 0,
          guard: i.door_steps > 0 ? 'הרצה מ-Arx נחסמת: יש בפריט פתיחת דלת שלא הוסבה' : 'הרצה מ-Arx נחסמת: לא ניתן לזהות את הדלתות בפריט',
          why: i.door_steps > 0 ? 'פתיחת דלתות מאוטומציה עדיין לא נתמכת' : null,
          reasons: i.reasons ?? (i.door_steps > 0 ? [] : ['התקן וירטואלי שפעולתו אינה ידועה']),
          devices: devs.slice(0, 5), devices_more: Math.max(0, devs.length - 5),
        };
      });
  return {
    wiskey_present: m.present, generated_at: NOW.toISOString().replace('.000Z', 'Z'), entities, items,
    counts: {
      entities: entities.length, blocked: entities.filter((e) => e.state === 'blocked').length, unblocked: entities.filter((e) => e.state === 'unblocked').length,
      items: items.length, items_blocked: items.filter((i) => i.blocked).length,
    },
    truncated: false,
  };
}

const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: 'mock', details });

const HEALTH = {
  status: 'ok', version: 'test', db: { ok: true, permission_revision: 1 }, data_dir_writable: true, nvr_configured: true, go2rtc_configured: true, mode: 'full',
  discovery: { cameras_last_ok: '2026-10-13T08:00:00Z', cameras_last_error: null, cameras_last_run: null, streams_last_ok: null, streams_last_error: null, last_reason: null, cameras: 4, interval_s: 600 },
  events: { ingest: { connected: true, last_heartbeat_at: null, last_event_at: '2026-10-13T08:00:00Z', last_error: null, reconnects: 0, events_stored: 3, started_at: null }, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 }, stored: 3 },
  home_assistant: { configured: true, connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 10, started_at: null, ha_version: '2026.9' },
  identity_source: 'ingress', renderer: 'fake',
};

export async function installBlocksMock(page: Page, m: BlocksMock): Promise<BlocksMock> {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const admin = m.perms.includes('system.configure');
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: m.perms, permissions_any: m.perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem' }, can_edit: admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-13T00:00:00Z', version: 'test' });
    if (p === 'health') return json(HEALTH);
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    // the neighbours of the new card on the same page
    if (p === 'intercom/door-map') return json({ state: 'ready', has_copy: true, stations: [], locks: [], sites: [], buildings: [] });
    if (p === 'doors/settings') return json({ trusted_path: 'off', trusted_path_available: false, editor_block: 'blocked', editor_allowed_available: false, lock_jobs: [] });
    if (p === 'intercom/door-path-inventory') return json({ wiskey_present: true, generated_at: '2026-10-13T09:30:00Z', counts: { items: 0, door_steps: 0, unresolvable: 0, arx_authored: 0, external: 0, disable_required: 0 }, items: [] });
    // the new card
    if (p === 'doors/blocks' && req.method() === 'GET') {
      m.gets += 1;
      if (!admin) return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
      if (m.getStatus) return json(ENVELOPE('internal', 'הקריאה נכשלה (בדיקה)'), m.getStatus);
      return json(listing(m));
    }
    const put = /^doors\/blocks\/entities\/(.+)$/.exec(p);
    if (put && req.method() === 'PUT') {
      const entityId = decodeURIComponent(put[1]);
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      m.puts.push({ entity_id: entityId, body });
      if (m.putDelay) await new Promise((r) => setTimeout(r, m.putDelay));
      if (!admin) return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
      if (m.putFail) {
        const f = m.putFail;
        m.putFail = null;
        return json(ENVELOPE(f.code, f.message), f.status);
      }
      if (body.confirmed !== true) return json(ENVELOPE('confirmation_required', 'השינוי דורש אישור מפורש.'), 409);
      const ent = m.entities.find((e) => e.entity_id === entityId);
      if (body.unblocked === true) {
        if (!ent) return json(ENVELOPE('entity_not_found', 'ההתקן לא נמצא.', { reason: 'unknown_entity' }), 404);
        if (ent.door) return json(ENVELOPE('not_overridable', 'ההתקן משויך לדלת אינטרקום ואינו ניתן לשחרור. אפשר לבטל קודם את השיוך.', { reason: 'door_mapped' }), 409);
        const note = clean(body.note);
        if (note.length < 3) return json(ENVELOPE('validation', 'נדרשת סיבה לשחרור (לפחות 3 תווים).', { field: 'note', reason: 'note_required' }), 422);
        if (note.length > 300) return json(ENVELOPE('validation', 'הסיבה ארוכה מדי (עד 300 תווים).', { field: 'note', reason: 'note_too_long' }), 422);
        m.released[entityId] = { note, by: 'יוני', at: NOW.toISOString().replace('.000Z', 'Z') };
        return json({ entity_id: entityId, state: 'unblocked', override: m.released[entityId], changed: true });
      }
      const had = !!m.released[entityId];
      delete m.released[entityId];
      return json({ entity_id: entityId, state: 'blocked', override: null, changed: had });
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return m;
}

/** Open the Connections page with the card on it (the shell's own sign-in state is the mock's `/me`). */
export async function openSetup(page: Page, o: { skin?: string; scheme?: 'light' | 'dark'; hash?: string } = {}): Promise<void> {
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#${o.hash ?? SETUP}`);
  await page.waitForSelector('sw-app');
}
