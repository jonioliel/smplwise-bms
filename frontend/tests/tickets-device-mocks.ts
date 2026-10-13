import type { Page, Route } from '@playwright/test';
import { installDevhistMock, DH_NOW, type DevhistState } from './devhist-mocks';
import { AREA_PERMS } from './bubble-mocks';

// CR-038 slice 3: the mocked backend of the device integration, layered over tests/devhist-mocks.ts (the area screen of the "living" area,
// the activity feed, the schedules). The routes here answer first: /me with the tickets module flags (D17 mode), the product settings with
// the module switch, and the tickets routes the device window calls (by-entity, meta, module, POST /tickets). Synthetic names only; no
// person name ever appears in a history line (the server keeps none).

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string) => json(route, { code, user_message: code, retryable: false, correlation_id: 'mock', details: {} }, status);

export interface DeviceMockOptions {
  enabled?: boolean;
  mode?: 'sheet' | 'menu';
  perms?: string[];
}

export interface DeviceMock {
  devhist: DevhistState;
  calls: { method: string; path: string; body: unknown }[];
  created: Record<string, unknown>[];
}

export const TICKET_PERMS = ['tickets.view', 'tickets.create', 'tickets.manage'];
const ago = (h: number) => new Date(Date.parse(DH_NOW) - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');

function item(id: string, number: number, title: string, status: string, hours: number, assignee: string | null, entity: string) {
  return {
    id, number, title, excerpt: '', status, origin: 'device', entity_id: entity,
    department: { id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', icon: null, color: null }, category: null,
    priority: { id: 'p-high', key: 'high', name: 'גבוהה', rank: 1, severity: 'alert' }, place_text: 'קומת קרקע · סלון', device_name: 'תאורה מרכזית',
    created_by: { id: 'u-1', name: 'רונית לוי' }, created_at: ago(hours), last_activity_at: ago(hours / 2),
    assignee: assignee ? { kind: 'user', id: 'u-2', name: assignee, since: ago(hours), acknowledged_at: null } : null, last_assignee_name: null,
    eta_at: null, waiting_on: assignee ? 'assignee' : 'manager', waiting_reason: null, reopen_count: 0, external_stale: false,
    closed_at: status === 'closed' ? ago(hours / 3) : null, revision: 2, view: 'full',
  };
}

const HISTORY = {
  source: 'device_activity', window_hours: 24, window_from: ago(24), window_to: ago(0), count: 3, truncated: false, withheld: null,
  lines: [
    { at: ago(0.3), kind: 'power', from: { state: 'on' }, to: { state: 'off' }, changed: ['state'], actor: { type: 'person' } },
    { at: ago(2.3), kind: 'power', from: { state: 'off' }, to: { state: 'on' }, changed: ['state'], actor: { type: 'schedule', name: 'תאורת ערב' } },
    { at: ago(20), kind: 'power', from: { state: 'on' }, to: { state: 'off' }, changed: ['state'], actor: { type: 'scene', name: 'לילה טוב' } },
  ],
};

export async function installTicketsDeviceMock(page: Page, o: DeviceMockOptions = {}): Promise<DeviceMock> {
  const enabled = o.enabled ?? true;
  const perms = o.perms ?? [...AREA_PERMS, ...TICKET_PERMS];
  const devhist = await installDevhistMock(page, { perms });
  const st: DeviceMock = { devhist, calls: [], created: [] };
  const allPerms = [...perms, 'schedule.view', 'schedule.manage'];
  const byEntity: Record<string, ReturnType<typeof item>[]> = {
    'light.living_main': [item('0000000000000b01', 1061, 'הנורה מהבהבת', 'waiting_part', 30, 'אבי כהן', 'light.living_main'), item('0000000000000b02', 1032, 'החלפת שנאי', 'closed', 400, null, 'light.living_main')],
  };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') {
      return json(route, {
        user: { id: 'u-1', username: 'ronit', display_name: 'רונית לוי', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
        permissions_installation: allPerms, permissions_any: allPerms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
        modules: { tickets: enabled, tickets_long_press: o.mode ?? 'sheet' },
      });
    }
    if (p === 'settings' && method === 'GET') {
      return json(route, { settings: { 'ui.design': 'a', 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'tickets.enabled': String(enabled) }, can_edit: false });
    }
    if (!p.startsWith('tickets')) return route.fallback();
    const body: unknown = method === 'GET' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    st.calls.push({ method, path: p, body });
    if (p === 'tickets/module') return json(route, { enabled, public_ready: false, name: {}, name_revision: 0, ui: { detail: 'drawer_fullscreen', new_ticket: 'sheet' } });
    if (!enabled) return err(route, 404, 'feature_disabled');
    const be = /^tickets\/by-entity\/(.+)$/.exec(p);
    if (be) {
      const id = decodeURIComponent(be[1]);
      const items = byEntity[id] ?? [];
      return json(route, {
        entity: { entity_id: id, name: id, domain: id.split('.')[0], tracked: !id.startsWith('media_player.') && !id.startsWith('sensor.') },
        items, open_count: items.filter((x) => !['closed', 'cancelled'].includes(x.status)).length, can_create: perms.includes('tickets.create'),
        place_text: 'קומת קרקע · סלון', history: perms.includes('tickets.create') ? HISTORY : null,
      });
    }
    if (p === 'tickets/meta') {
      return json(route, {
        departments: [{ id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', icon: null, color: null, my_role: 'manager', can_create: true, can_manage: false, open_to_all: true,
          categories: [{ id: 'cat-elec', name: 'חשמל', parent_id: null, default_priority_id: null, domains: ['light'] }, { id: 'cat-hvac', name: 'מיזוג', parent_id: null, default_priority_id: null, domains: ['climate'] }],
          priorities: [{ id: 'p-high', key: 'high', name: 'גבוהה', rank: 1, severity: 'alert', is_default: false }, { id: 'p-normal', key: 'normal', name: 'רגילה', rank: 2, severity: 'alert', is_default: true }] }],
        can: { view: true, create: true, manage: false, all_departments: false, external: false, configure: false },
      });
    }
    if (p === 'tickets' && method === 'POST') {
      const b = body as { entity_id?: string; title: string };
      st.created.push(b as unknown as Record<string, unknown>);
      const t = item(`00000000000000c${st.created.length}`, 1070 + st.created.length, b.title, 'new', 0, null, b.entity_id ?? '');
      if (b.entity_id) (byEntity[b.entity_id] ??= []).unshift(t);
      return json(route, { ...t, description: '', events: [], attachments: [], close_note: null, closed_by_name: null, duplicate_of: null, reopen_until: null,
        can: { edit_fields: [], assign: false, assign_external: false, note: true, note_external: false, attach: true, attach_external: false, eta: false, return: false, manage: false },
        transitions: [], assignments: [], device_context: null, result: 'created', open_for_entity: [] }, 201);
    }
    return err(route, 404, 'not_found');
  });
  return st;
}
