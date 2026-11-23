import type { Page, Route } from '@playwright/test';
import { mockHome, overview, type HomeMock } from './home-simple-mocks';

// HOME-FAVORITES-2500: the mock layer of the favourites / scene specs, on top of the home-interface mocks (home-simple-mocks.ts). The
// person's favourites of the living room are fixed so the landscape tablet grid (6 x 3) has a hole: the fourth tile (a wide light)
// ends row 1 one cell short, the fifth (wide) cannot fit there. Optional: an unlocked back door (Q79's "לנעול דלתות?"), the alarm's
// arm code rule, a home manager whose scene.manage is bound to a floor only (Q75), and scenes the caller may edit.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const LIVING_FAVS = [
  { t: 'scene', id: 'cinema' }, { t: 'scene', id: 'reading' }, { t: 'switch', id: 'switch.l_heater' }, { t: 'light', id: 'light.l_main', w: 2 },
  { t: 'light', id: 'light.l_read', w: 2 }, { t: 'climate', id: 'climate.living' }, { t: 'shade', id: 'cover.l_win' }, { t: 'light', id: 'light.l_corner', w: 1 },
];

export interface FavOpts {
  /** an unlocked, non-WisKey back door in the entry (the leaving scene offers to lock it) */
  backDoor?: boolean;
  /** the alarm's arm code rule ('pin' = the personal code pad) */
  armCode?: 'none' | 'pin';
  /** scene.manage only at a floor scope (permissions_any, not permissions_installation) */
  sceneManager?: boolean;
  /** the scenes the server marks `can.edit` */
  editable?: string[];
  layout?: Record<string, unknown>;
  policy?: Record<string, unknown>;
}

export async function mockFavs(page: Page, o: FavOpts = {}): Promise<HomeMock> {
  const mock = await mockHome(page, { layout: o.layout, policy: o.policy });
  const prefs = { favourites: { living: LIVING_FAVS } as Record<string, unknown>, layout: { welcomed: true, ...(o.layout ?? {}) } as Record<string, unknown>, seed: {} };
  await page.route('**/api/v1/home/prefs', (r) => {
    if (r.request().method() === 'PUT') {
      const b = r.request().postDataJSON() as { favourites?: Record<string, unknown>; layout?: Record<string, unknown> };
      mock.calls.push({ method: 'PUT', path: 'home/prefs', body: b });
      Object.assign(prefs.favourites, b.favourites ?? {});
      Object.assign(prefs.layout, b.layout ?? {});
    }
    return json(r, prefs);
  });
  if (o.backDoor) {
    const ov = overview('demo', o.policy ?? {});
    const entry = ov.rooms.find((x) => x.id === 'entry')!;
    entry.locks = [...(entry.locks as unknown[]), { entity_id: 'lock.back', name: 'הדלת האחורית', domain: 'lock', state: 'unlocked', available: true, active: false, can_control: true, locked: false, wiskey_door: false, unlock_reason: 'ok', can_unlock: true }];
    for (const r of ov.rooms) for (const l of r.locks as { entity_id: string; unlock_reason?: string; can_unlock?: boolean }[]) { l.unlock_reason ??= 'ok'; l.can_unlock ??= true; }
    await page.route('**/api/v1/home/overview', (r) => json(r, ov));
  }
  if (o.armCode) {
    await page.route('**/api/v1/alarm/panels', (r) => json(r, { panels: [{
      entity_id: 'alarm_control_panel.house', name: 'אזעקת הבית', platform: null, integration: '', integration_note: '', config_entry_id: null, state: 'disarmed', available: true, fresh: true,
      last_changed: null, changed_by: null, arm_modes: ['arm_home', 'arm_away', 'arm_night'], features_reported: true, code_format: 'number', code_arm_required: o.armCode === 'pin', needs_code_arm: o.armCode === 'pin',
      needs_code_disarm: true, area_name: null, open_sensors: [], bypassed_sensors: [], zones: [], unpaired_controls: [], ready: { ready: true, open: [], faults: [] },
      can: { arm: true, disarm: true, bypass: false, restore: false }, panel_code_set: false, code: { arm: o.armCode, disarm: 'pin', bypass: 'none' },
    }], counts: { panels: 1, zones: 0, open: 0, bypassed: 0, faults: 0 }, channel: 'local', remote: { control: true, disarm: true, codeless: false }, code_mode: 'personal_pin',
      me: { arm_policy: o.armCode === 'pin' ? 'code_required' : 'no_code', disarm_policy: 'code_required', pin_set: true }, can_configure: false }));
  }
  if (o.sceneManager !== undefined) {
    const base = ['alarm.view', 'alarm.arm', 'alarm.disarm', 'devices.read', 'devices.control', 'ha.entity.control', 'devices.control_bulk', 'video.live', 'map.read', 'energy.view', 'access.call', 'access.doors.open'];
    const any = o.sceneManager ? [...base, 'scene.manage'] : base;
    const me = {
      user: { id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', source: 'ingress' }, channel: 'local', remote: null,
      bindings: [{ id: 'b1', role_id: 'custom', role_name: 'מנהלת הבית', scope_type: 'floor', scope_id: 'g', effect: 'allow' }],
      permissions_installation: base, permissions_any: any, has_access: true, permission_revision: 1, permissions_fingerprint: 'f', permissions_changed: false, bootstrap_state: 'done',
      active: true, mode: 'full', interface: overview('demo', o.policy ?? {}).policy, modules: { notices: false, tickets: false, incidents: false, announce: false },
    };
    await page.route('**/api/v1/me?**', (r) => json(r, me));
    await page.route('**/api/v1/me', (r) => json(r, me));
  }
  if (o.editable?.length) {
    const ed = new Set(o.editable);
    const sc = (id: string, name: string, areas: { id: string; name: string }[] = [], description = '') => ({
      kind: 'scene', id, config_id: id, entity_id: `scene.${id}`, name, description, icon: null, source: 'ui', state: 'scene', sentence: '', floors: [], areas, targets: [], sensitive: false, sensitive_classes: [], locked_count: 0,
      unknown_effects: false, mode: null, extras: [], labels: [], category: null, last_run: null, runs_7d: null, created_via: 'arx', owner: null, updated_at: null, revision: 'r1', pinned: false, favourite: false, hidden: false,
      can: { edit: ed.has(id), code_view: false, toggle: false, run: true, delete: ed.has(id), copy: false }, read_only: null, warnings: [],
    });
    const items = [sc('morning', 'בוקר', [], 'פותח תריסים'), sc('leave', 'יציאה מהבית', [], 'מכבה הכל'), sc('evening', 'ערב', [], 'אור רך'), sc('night', 'לילה', [], 'מכבה הכל'),
      sc('cinema', 'קולנוע', [{ id: 'living', name: 'סלון' }]), sc('reading', 'קריאה', [{ id: 'living', name: 'סלון' }])];
    await page.route('**/api/v1/automations?**', (r) => json(r, { items, total: items.length }));
    await page.route('**/api/v1/automations/scene/*', (r) => {
      const id = new URL(r.request().url()).pathname.split('/').pop()!;
      const item = items.find((x) => x.id === id);
      if (!item) return json(r, { code: 'item_not_found' }, 404);
      if (r.request().method() === 'PUT') {
        mock.calls.push({ method: 'PUT', path: `automations/scene/${id}`, body: r.request().postDataJSON() });
        return json(r, { item, revision: 'r2' });
      }
      return json(r, { ...item, draft: { name: item.name, icon: null, members: [{ entity_id: 'light.l_main', state: 'on', attributes: { brightness: 120 } }] }, versions: 1, trash_restore_of: null });
    });
    await page.route('**/api/v1/automations/scene/*/delete', (r) => { mock.calls.push({ method: 'POST', path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON() }); return json(r, { trash_id: 't1', expires_at: '2026-12-23T00:00:00Z' }); });
    await page.route('**/api/v1/automations/scene/capture', (r) => { mock.calls.push({ method: 'POST', path: 'automations/scene/capture', body: r.request().postDataJSON() }); return json(r, { members: [{ entity_id: 'light.l_main', state: 'off', attributes: {} }] }); });
  }
  return mock;
}
