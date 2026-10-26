import type { Page, Route } from '@playwright/test';
import { GROUPS, deviceFor, typesFor, valuesFor, type Level, type Scenario } from './generator-fixtures';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';

// CR-031 GEN1: the mock layer of the generator specs - the wire contract of routers/generator.py, fake data only. The whole app runs against it through page.route.
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string) => json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details: {} }, status);

export const PERMS = {
  view: ['generator.view'],
  manage: ['generator.view', 'generator.manage', 'notify.manage'],
  none: [] as string[],
};

export interface GenMockOptions {
  perms?: string[];
  /** the session's optional modules (`/me` modules) - e.g. { tickets: true } (TICKGATE-295: absent = the tickets module is off) */
  modules?: { tickets: boolean };
  level?: Level;
  scenario?: Scenario;
  /** generators detected: 0 = none, 1, 2 (picker) or many */
  count?: number;
  alerts?: 'some' | 'none';
  slowLive?: boolean;
  viewMode?: 'gauges' | 'charts';
  /** GENLOG092-295: the run-log switch (absent = off, like the server's default) */
  log?: boolean;
}
export interface GenMock {
  calls: { method: string; path: string; body: unknown }[];
  viewMode: string;
}

const NAMES = ['גנרטור ראשי', 'גנרטור גיבוי', 'גנרטור מרתף', 'גנרטור משרדים', 'גנרטור מחסן', 'גנרטור חצר', 'גנרטור גג', 'גנרטור חניון'];
const NOW = '2026-10-05T11:00:00Z';

function alertsFor(device: string, none: boolean) {
  if (none) return [];
  const mk = (id: string, key: string, title: string, severity: string, raised: string, ack: boolean, closed: string | null = null) => ({
    id, device_id: device, device_name: NAMES[0], key, group: 'engine', title, severity, state: closed ? 'closed' : 'open', raised_at: raised, cleared_at: closed, last_at: raised, count: 1,
    acknowledged: ack, acked_by: ack ? 'u1' : null, acked_at: ack ? raised : null, ack_note: null,
  });
  return [
    mk('al1', 'battery_low', 'מתח מצבר נמוך', 'alert', '2026-10-05T10:02:00Z', false),
    mk('al2', 'mains_lost', 'אובדן רשת חשמל', 'alert', '2026-10-05T09:30:00Z', true),
    mk('al3', 'low_fuel', 'מפלס דלק נמוך', 'info', '2026-10-05T08:00:00Z', false),
    mk('al4', 'fail_to_start', 'כשל התנעה', 'critical', '2026-09-28T09:00:00Z', true, '2026-09-28T09:20:00Z'),
  ];
}

/** GENLOG092-295: a fake run log - 11 runs over 30 days (tests, a mains failure, a run in progress), two fuel events. */
function runsFor(page: number, size: number) {
  const base = Date.parse(NOW);
  const run = (i: number, kind: string, why: string, hAgo: number, min: number, open = false, load: number | null = null) => ({
    id: `r${i}`, kind, kind_reason: why, started_at: new Date(base - hAgo * 3600_000).toISOString(), ended_at: open ? null : new Date(base - hAgo * 3600_000 + min * 60_000).toISOString(), open,
    end_reason: open ? null : 'stopped', duration_s: min * 60, hours: Math.round(min / 60 * 100) / 100, hours_from_counter: true, took_load: load !== null, fuel_used_pct: Math.round(min / 15), fuel_used_l: Math.round(min / 4),
    fuel_start_pct: 80, fuel_end_pct: 80 - Math.round(min / 15), peak_load_pct: load, peak_kw: load, short: kind === 'test' && min < 10 });
  const all = [run(0, 'mains_failure', 'mains_lost', 0.5, 30, true, 62), run(1, 'test', 'mode_test', 50, 15), run(2, 'mains_failure', 'mains_lost', 120, 95, false, 58), run(3, 'test', 'unloaded', 218, 8),
    ...Array.from({ length: 7 }, (_x, k) => run(4 + k, k % 3 ? 'test' : 'other', k % 3 ? 'mode_test' : 'none', 260 + k * 60, 12 + k))];
  const runs = all.slice((page - 1) * size, page * size);
  return { runs, total: all.length, page, page_size: size, pages: Math.ceil(all.length / size), range: '30d',
    fuel_events: [{ id: 'f1', kind: 'refill', started_at: '2026-09-30T08:00:00Z', ended_at: '2026-09-30T08:20:00Z', from_pct: 31, to_pct: 92, delta_pct: 61 },
      { id: 'f2', kind: 'drop', started_at: '2026-09-22T02:00:00Z', ended_at: '2026-09-22T05:00:00Z', from_pct: 70, to_pct: 63, delta_pct: -7 }],
    summary: { runs: all.length, by_kind: { test: 6, mains_failure: 2, manual: 0, other: 3 }, run_s: 0, hours: 5.4, fuel_used_pct: 21, fuel_used_l: 78, refills: 1, refilled_pct: 61, drops: 1, short_tests: 1,
      last_test: all[1], last_mains_failure: all[0], test_interval_days: 7, next_test_due: '2026-10-10T09:00:00Z', test_overdue: false, current: all[0],
      counters: { run_hours: 1284.5, starts: 212, fuel_pct: 74, fuel_l: 520 } } };
}

export async function installGeneratorMock(page: Page, o: GenMockOptions = {}): Promise<GenMock> {
  const perms = o.perms ?? PERMS.manage;
  const level = o.level ?? 'typical';
  const sc = o.scenario ?? 'run';
  const count = o.count ?? 1;
  const st: GenMock = { calls: [], viewMode: o.viewMode ?? 'gauges' };
  const alerts = alertsFor('g1', o.alerts === 'none');
  const open = alerts.filter((a) => a.state === 'open').length;
  const devs = Array.from({ length: count }, (_, i) => deviceFor(`g${i + 1}`, NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${i + 1}` : ''), level, sc, i === 0 ? open : 0, false));
  const policies = new Map<string, unknown>();
  const sevDefaults: Record<string, unknown> = { critical: null, alert: null, info: null };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    if (p === 'me') return json(route, { user: { id: 'u1', username: 'gen', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', ...(o.modules ? { modules: o.modules } : {}) });
    if (p === 'me/prefs') {
      if (method === 'PUT') {
        st.calls.push({ method, path: p, body });
        st.viewMode = (body as Record<string, string>)['generator.view_mode'] ?? st.viewMode;
      }
      return json(route, { prefs: { 'nav.order': [], 'generator.view_mode': st.viewMode }, stored: [], updated_at: null });
    }
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', ...(o.modules?.tickets ? { 'tickets.enabled': 'true' } : {}) }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'identity/users') return json(route, { users: [{ id: 'u2', name: 'יוסי', username: 'yossi', is_admin: false, active: true, source: 'vms', sync_status: 'verified', groups: [], bindings: [], is_self: false }], directory: { paired: false, last_directory_at: null, users: 1 }, revision: 1, can_assign: false, members: [], bindings: [] });
    if (p === 'access/roles') return json(route, { roles: [], labels: {}, sensitive: [], can_manage_roles: false });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: false, delegated: false });
    if (p === 'devices/tree') return json(route, { floors: [], unassigned: { area_id: 'unassigned', name: 'ללא שיוך' }, scoped: false, can_bulk: false });
    if (p === 'energy/meters') return json(route, { items: [], stale_after_minutes: 60 });
    if (!p.startsWith('generator/')) return err(route, 404, 'not_found', 'לא נמצא');
    const g = p.slice('generator/'.length);
    st.calls.push({ method, path: g + url.search, body });
    if (!perms.includes('generator.view')) return err(route, 403, 'forbidden', 'אין הרשאה');
    if (g === 'devices' && method === 'GET') return json(route, { devices: devs, detected: devs.length, partial: 0, open_alerts: open, last_detect_at: '2026-10-05T09:30:00Z', ...(o.log ? { log_enabled: true } : {}) });
    if (g === 'devices/detect') return json(route, { found: [], count: devs.length, last_detect_at: NOW });
    const m = /^devices\/([^/]+)(?:\/([\w-]+))?(?:\/(.+))?$/.exec(g);
    if (m && method === 'GET' && !m[2]) {
      const i = devs.findIndex((d) => d.id === m[1]);
      return i < 0 ? err(route, 404, 'generator_not_found', 'לא נמצא') : json(route, deviceFor(devs[i].id, devs[i].name, level, sc, devs[i].open_alerts));
    }
    if (m && m[2] === 'live') {
      if (o.slowLive) await new Promise((r) => setTimeout(r, 1500));
      return json(route, { id: m[1], availability: sc === 'unavail' ? 'offline' : 'online', stale: sc === 'unavail', values: valuesFor(level, sc), at: NOW });
    }
    if (m && m[2] === 'history') {
      const roles = (url.searchParams.get('roles') ?? '').split(',').filter(Boolean);
      const to = 1759665600;
      const rng = url.searchParams.get('range');
      const span = rng === '1h' ? 3600 : rng === '7d' ? 7 * 86400 : rng === '30d' ? 30 * 86400 : 86400;
      const step = span / 96;
      const series: Record<string, unknown[]> = {};
      for (const r of roles) {
        series[r] = [];
        for (let i = 0; i < 96; i++) {
          if (i > 40 && i < 46) continue;
          const v = 50 + 30 * Math.sin(i / 9 + r.length);
          series[r].push({ t: to - span + i * step, v, min: v - 4, max: v + 4 });
        }
      }
      return json(route, { step_s: step, source: 'rollup_5m', from: to - span, to, series, units: Object.fromEntries(roles.map((r) => [r, r.includes('temp') ? '°C' : r.includes('_v') ? 'V' : '%'])), labels: Object.fromEntries(roles.map((r) => [r, r])), range: rng });
    }
    if (m && m[2] === 'runs') return o.log ? json(route, runsFor(Number(url.searchParams.get('page') ?? 1), Number(url.searchParams.get('page_size') ?? 8))) : err(route, 409, 'generator_log_off', 'יומן ההפעלות כבוי בהגדרות.');
    if (m && m[2] === 'policies' && /\/preview$/.test(m[3] ?? '')) {
      const t = ((body as { template_he?: string | null })?.template_he ?? '{name}: {detail}.');
      const bad = [...t.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).filter((x) => !['name', 'detail', 'type', 'severity'].includes(x));
      if (bad.length) return json(route, { code: 'template_invalid', user_message: 'תבנית לא מוכרת', retryable: false, correlation_id: 'mock', details: { unknown: bad, allowed: ['name', 'detail', 'type', 'severity'] } }, 400);
      return json(route, { text: t.replace('{name}', 'גנרטור ראשי').replace('{detail}', 'מתח מצבר 23.1 V').replace('{type}', 'מתח מצבר נמוך').replace('{severity}', 'התראה') });
    }
    if (m && m[2] === 'severity-routing' && method === 'PUT') {
      const next = { recipients: { roles: [], users: [] }, channels: [], ...(body as object), row_version: 1 };
      sevDefaults[m[3]!] = next;
      return json(route, next);
    }
    if (m && m[2] === 'policies') {
      if (method === 'PUT') {
        const key = m[3]!;
        const cur = (policies.get(key) as Record<string, unknown>) ?? {};
        const next = { enabled: true, severity: 'alert', recipients: { roles: [], users: [] }, channels: [], quiet_mode: 'matrix', escalate: false, after_s: 0, escalate_after_s: 0, ...cur, ...(body as object), row_version: 1 };
        policies.set(key, next);
        return json(route, next);
      }
      if (method === 'POST') {
        policies.clear();
        for (const k of Object.keys(sevDefaults)) sevDefaults[k] = null;
        return json(route, { reset: 3 });
      }
      const items = typesFor(level).map((t) => ({ key: t.key, group: t.group, title: t.title, title_en: t.key, default_severity: t.key === 'fail_to_start' ? 'critical' : 'alert', event: '', available: t.available, needs: t.needs, message: '{name}: {detail}.', message_sample: 'גנרטור ראשי: מתח מצבר 23.1 V.', policy: policies.get(t.key) ?? null }));
      return json(route, { groups: GROUPS, items, available: items.filter((i) => i.available).length, total: items.length, channels: ['push', 'app', 'email'], channels_reserved: ['whatsapp', 'ha_mobile'], quiet_modes: ['pass', 'matrix', 'hold'], severity_defaults: sevDefaults, severity_channels: ['push', 'app', 'email'], critical_escalate_after_min: 5, note: '', template_max: 500, placeholders: { name: 'שם הגנרטור', detail: 'פירוט האירוע', type: 'סוג ההתראה', severity: 'חומרה' }, roles: [{ id: 'operator', label: 'מפעילים' }, { id: 'site_admin', label: 'מנהלי אתר' }, { id: 'system_admin', label: 'מנהלי מערכת' }] });
    }
    if (m && m[2] === 'roles') {
      const names = ['engine_state', 'gen_v_l1', 'fuel_pct', 'battery_v'];
      return json(route, { items: names.map((r, i) => ({ role: r, label: r, kind: 'num', unit: '', core: i < 2, mapped: i !== 2, entity_id: i !== 2 ? `x.${r}` : null, entity_name: i !== 2 ? r : null, mapped_by: 'auto', unmapped_by_user: false, disabled_in_source: false, candidates: [{ entity_id: `x.${r}`, name: r, unit: null, score: 2 }] })) });
    }
    if (g.startsWith('device-candidates')) return json(route, { items: [{ ha_device_id: 'd1', name: 'בקר מבחן', entities: 12, mapped_roles: 7, registered: false }] });
    if (g === 'settings') return json(route, { integration_domains: [], known_domains: [], thresholds: {}, threshold_defaults: { fuel_low_pct: 25, oil_min_bar: 1 }, threshold_limits: { fuel_low_pct: [1, 90], oil_min_bar: [0, 10] }, thresholds_set: [], alert_retention_days: 365, history_retention_days: 35, stale_after_s: 300, critical_escalate_after_min: 5, limits: { alert_retention_days: [30, 1825, 365], history_retention_days: [7, 90, 35], stale_after_s: [60, 3600, 300] },
      ...(o.log ? { log_enabled: true, log: { min_run_s: 60, test_interval_days: 7, classify_unloaded_as_test: true }, log_specs: { min_run_s: { type: 'int', default: 60, min: 10, max: 900 }, test_interval_days: { type: 'int', default: 7, min: 0, max: 90 }, classify_unloaded_as_test: { type: 'bool', default: true, min: null, max: null } } } : {}) });
    if (g.startsWith('alerts') && method === 'GET' && g === 'alerts' || g.startsWith('alerts?')) {
      const state = url.searchParams.get('state');
      const sev = url.searchParams.get('severity');
      const rows = alerts.filter((a) => (!state || a.state === state) && (!sev || a.severity === sev));
      return json(route, { alerts: rows, next_before: null, open_count: open });
    }
    const a = /^alerts\/(\w+)(?:\/(ack|mute))?$/.exec(g);
    if (a) {
      const row = alerts.find((x) => x.id === a[1]);
      if (!row) return err(route, 404, 'not_found', 'לא נמצא');
      if (a[2] === 'ack') {
        row.acknowledged = true;
        row.acked_at = NOW;
      }
      if (a[2] === 'mute') return json(route, { muted_until: '2026-10-06T11:00:00Z' });
      return json(route, { ...row, snapshot: { battery_v: 23.1, fuel_pct: 58, coolant_temp: 84, load_pct: 62 }, timeline: [{ at: row.raised_at, kind: 'raised' }, ...(row.acknowledged ? [{ at: NOW, kind: 'acknowledged', by: 'u1', note: null }] : [])], muted_until: null });
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}
export const url = (hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#${hash}`;
export const SKINS = SKIN_IDS;
