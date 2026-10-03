import type { Page, Route } from '@playwright/test';
import { fixtureCandidates, fixtureEpochs, fixtureMeters, fixtureSeries, fixtureSettings } from '../src/electricity/fixtures';
import type { Meter, EnergySettings } from '../src/api/electricity-meters';

// CR-023 electricity UI: the mock layer of the Playwright specs. It answers the CR/PLAN contract of the meters endpoints from the same fake fixtures the
// static demo uses (src/electricity/fixtures.ts) - invented building, no real device. When the real server's shapes differ (ELECTRICITY_INTERFACES.md),
// the adapter in src/api/electricity-meters.ts and this file change together. The whole app runs against it through page.route: `/me` carries the
// permissions, so the navigation, the screens and the money hiding are the real ones.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, user_message: string) => json(route, { code, user_message, retryable: false, correlation_id: 'mock', details: {} }, status);

export const PERMS = {
  /** operator: meters and kWh, no money, no management */
  view: ['energy.view'],
  /** site administrator: everything of the module except the retention */
  bills: ['energy.view', 'energy.bills', 'energy.manage'],
  /** system administrator */
  admin: ['energy.view', 'energy.bills', 'energy.manage', 'system.configure', 'rbac.assign', 'rbac.roles.manage', 'identity.directory.read'],
  none: [] as string[],
};

export interface ElectricityMock {
  meters: Meter[];
  settings: EnergySettings;
  /** Every request to /energy/*: method, path (after energy/), body. */
  calls: { method: string; path: string; body: unknown }[];
}

export interface MockOptions {
  perms?: string[];
  /** meters list: ready (default), empty, error (500), slow (answers after 1.5 s) */
  meters?: 'ready' | 'empty' | 'error' | 'slow';
  /** the settings answer: ready (default), error */
  settings?: 'ready' | 'error';
  skin?: string;
}

function me(perms: string[]) {
  return {
    user: { id: 'u-elec', username: 'elec', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
    permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
  };
}

const ROLES = {
  roles: [
    { id: 'viewer', name: 'צופה', permissions: ['map.read'], sensitive_included: [], sensitive_missing: ['energy.bills'], system_role: false },
    { id: 'operator', name: 'מפעיל', permissions: ['map.read', 'energy.view'], sensitive_included: [], sensitive_missing: ['energy.bills'], system_role: false },
    { id: 'site_admin', name: 'מנהל אתר', permissions: ['map.read', 'energy.view', 'energy.manage'], sensitive_included: ['energy.bills'], sensitive_missing: [], system_role: false },
    { id: 'system_admin', name: 'מנהל מערכת', permissions: ['map.read', 'energy.view', 'energy.manage', 'system.configure'], sensitive_included: ['energy.bills'], sensitive_missing: [], system_role: true },
  ],
  labels: { 'map.read': 'צפייה במפה', 'energy.view': 'צפייה במונים ובצריכה', 'energy.bills': 'חיובים: סכומים, לקוחות, הפקה וביטול', 'energy.manage': 'ניהול מונים, חשבונות, לקוחות ומחירים' },
  sensitive: ['energy.bills'],
  can_manage_roles: false,
};

export async function installElectricityMock(page: Page, opts: MockOptions = {}): Promise<ElectricityMock> {
  const perms = opts.perms ?? PERMS.bills;
  const st: ElectricityMock = { meters: opts.meters === 'empty' ? [] : fixtureMeters(), settings: fixtureSettings(), calls: [] };
  const epochs = new Map<string, ReturnType<typeof fixtureEpochs>>();
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, me(perms));
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', ...(opts.skin ? { 'ui.skin': opts.skin } : {}) }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'identity/users') return json(route, { users: [], directory: { paired: false, last_directory_at: null, users: 0 }, revision: 1, can_assign: false, members: [], bindings: [] });
    if (p === 'access/roles') return json(route, ROLES);
    if (p === 'access/groups') return json(route, { groups: [], can_manage: false, delegated: false });
    if (!p.startsWith('energy/')) return err(route, 404, 'not_found', 'לא נמצא');
    const e = p.slice('energy/'.length);
    const body = method === 'GET' || method === 'DELETE' ? null : req.postDataJSON();
    st.calls.push({ method, path: e + url.search, body });
    if (e === 'meters' && method === 'GET') {
      if (!perms.includes('energy.view')) return err(route, 403, 'forbidden', 'אין הרשאה');
      if (opts.meters === 'error') return err(route, 500, 'internal', 'השרת לא ענה');
      if (opts.meters === 'slow') await new Promise((r) => setTimeout(r, 1500));
      return json(route, { meters: st.meters });
    }
    if (e === 'candidates') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      return json(route, { candidates: fixtureCandidates().filter((c) => !q || c.name.toLowerCase().includes(q)) });
    }
    if (e === 'meters' && method === 'POST') {
      const c = fixtureCandidates().find((x) => x.entity_id === (body as { entity_id: string }).entity_id);
      if (!c) return err(route, 404, 'not_found', 'החיישן לא נמצא');
      if (c.verdict === 'rejected') return err(route, 422, 'meter_unit_rejected', 'החיישן שנבחר מודד הספק רגעי (קילוואט), לא צריכה מצטברת. לחשבון חשמל צריך מונה שמציג קוט״ש.');
      const m: Meter = { id: `m${st.meters.length + 1}`, name: c.name, entity_name: c.entity_id, area_id: c.area_id, area_name: c.area_name, floor_id: null, floor_name: c.floor_name, status: 'reporting', reading_kwh: 1204.5, last_report_at: '2026-10-04T18:49:00Z', today_kwh: 0, month_kwh: 0, accounts: [], revision: 1 };
      st.meters.push(m);
      return json(route, m, 201);
    }
    const one = /^meters\/([^/?]+)(\/(series|replace))?/.exec(e);
    if (one) {
      const id = decodeURIComponent(one[1]);
      const m = st.meters.find((x) => x.id === id);
      if (!m) return err(route, 404, 'not_found', 'המונה לא נמצא');
      if (one[3] === 'series') return json(route, { points: fixtureSeries(id, url.searchParams.get('step') === '1h' ? 24 : 30, url.searchParams.get('step') === '1h' ? 3_600_000 : 86_400_000) });
      if (one[3] === 'replace') {
        const b = body as { start_reading_kwh: number; note?: string };
        const list = epochs.get(id) ?? fixtureEpochs(id);
        list.push({ started_at: '2026-10-04T18:49:00Z', ended_at: null, start_reading_kwh: b.start_reading_kwh, reason: 'replace', note: b.note ?? '' });
        epochs.set(id, list);
        m.revision += 1;
        return json(route, { ...m, epochs: list });
      }
      if (method === 'GET') return json(route, { ...m, epochs: epochs.get(id) ?? fixtureEpochs(id) });
      if (method === 'PATCH') {
        m.status = (body as { status: string }).status === 'paused' ? 'paused' : 'reporting';
        m.revision += 1;
        return json(route, m);
      }
      if (method === 'DELETE') {
        if (m.accounts.length) return err(route, 409, 'meter_in_use', 'המונה משמש בחשבון ולכן אי אפשר להסיר אותו');
        st.meters = st.meters.filter((x) => x.id !== id);
        return route.fulfill({ status: 204 });
      }
    }
    if (e === 'settings') {
      if (opts.settings === 'error') return err(route, 500, 'internal', 'השרת לא ענה');
      if (method === 'PATCH') {
        const b = body as Record<string, number>;
        const range: Record<string, [number, number]> = { raw_retention_days: [7, 366], interval_retention_months: [3, 120], bill_retention_years: [1, 15], draft_retention_days: [7, 365] };
        for (const [k, v] of Object.entries(b)) if (!range[k] || v < range[k][0] || v > range[k][1]) return err(route, 422, 'retention_out_of_range', `הערך חייב להיות בין ${range[k]?.[0]} ל-${range[k]?.[1]}`);
        Object.assign(st.settings, b);
      }
      return json(route, { ...st.settings, can_edit_retention: perms.includes('system.configure'), can_edit_drafts: perms.includes('energy.manage'), meter_count: st.meters.length });
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}

export const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;

/** The URL of a screen: skin and scheme as the dev query, the route as the hash. */
export const url = (hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#${hash}`;
