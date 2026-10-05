import type { Page, Route } from '@playwright/test';
import { fixtureCandidates, fixtureEpochs, fixtureMeters, fixtureSeries } from '../src/electricity/fixtures';
import { fixtureReadingLog, type ReadingLog } from '../src/api/electricity-readings';

// CR-023 electricity UI: the mock layer of the Playwright specs. It speaks the WIRE contract of pilot/elec-server
// (docs/architecture/ELECTRICITY_INTERFACES.md section 3: `items`, `display_name`, `value_kwh`, `state`, candidates with `ref` / `verdict` / `code`, settings
// with `values` / `editable` / `ranges` / `storage`), built from the same fake fixtures the static demo uses (src/electricity/fixtures.ts): an invented building,
// no real device. The whole app runs against it through page.route: `/me` carries the permissions, so the navigation, the screens and the money hiding are the
// real ones, and the adapter in src/api/electricity-meters.ts is exercised exactly as against the real server.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, user_message: string, details: Record<string, unknown> = {}) => json(route, { code, user_message, retryable: false, correlation_id: 'mock', details }, status);

export const PERMS = {
  /** operator: meters and kWh, no money, no management */
  view: ['energy.view'],
  /** site administrator: everything of the module except the retention */
  bills: ['energy.view', 'energy.bills', 'energy.manage'],
  /** system administrator */
  admin: ['energy.view', 'energy.bills', 'energy.manage', 'system.configure', 'rbac.assign', 'rbac.roles.manage', 'identity.directory.read'],
  none: [] as string[],
};

interface WireEpochM {
  id: string;
  started_at: string;
  ended_at: string | null;
  start_reading_wh: number | null;
  reason: string;
  note: string | null;
}
interface WireMeterM {
  id: string;
  display_name: string;
  device_id?: string | null;
  device_name?: string | null;
  entity_name?: string | null;
  source_ref: string;
  unit: string;
  area_id: string | null;
  area_name: string | null;
  status: 'active' | 'paused' | 'retired';
  status_reason: string | null;
  revision: number;
  state: 'reporting' | 'not_reporting' | 'paused' | 'retired';
  last_report_at: string | null;
  value_kwh: number | null;
  today_kwh: number | null;
  used_in: { account_id: string; name: string }[];
  month_kwh: number;
  floor: { id: string; name: string };
}

export interface ElectricityMock {
  meters: WireMeterM[];
  settings: Record<string, number>;
  /** Every request to /energy/*: method, path (after energy/), body. */
  calls: { method: string; path: string; body: unknown }[];
  /** EL6: the manual-reading logs served so far, by meter id. */
  readingLogs?: Map<string, ReadingLog>;
}

export interface MockOptions {
  perms?: string[];
  /** meters list: ready (default), empty, error (500), slow (answers after 1.5 s) */
  meters?: 'ready' | 'empty' | 'error' | 'slow';
  /** the settings answer: ready (default), error */
  settings?: 'ready' | 'error';
  /** the month-to-date read fails (the screen shows dashes) */
  consumptionFails?: boolean;
  /** the devices tree (the floors of the areas) is refused */
  noFloors?: boolean;
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

const CODE: Record<string, string> = { kw: 'power_unit', unit: 'unit_rejected', total: 'warn_total', returned: 'returned_energy', measurement: 'measurement' };
const MSG: Record<string, string> = {
  power_unit: 'החיישן שנבחר מודד הספק רגעי (קילוואט), לא צריכה מצטברת. לחשבון חשמל צריך מונה שמציג קוט״ש.',
  unit_rejected: 'יחידת המידה היא וולט. אפשר לבחור רק מונה שמודד קוט״ש, וואט־שעה או מגוואט־שעה.',
  warn_total: 'המונה מתאפס כל יום. מתאים, אבל מונה מצטבר עדיף.',
  returned_energy: 'מונה של אנרגיה מוחזרת לרשת. לא נתמך בחשבון צריכה.',
};

/** The device each of the first meters belongs to (the others have none: a sensor without a device must keep working). */
const DEVICES: Record<string, string> = { m5: 'מונה חכם גל-טק', m6: 'מונה חכם מאפייה', m7: 'מונה חכם מאפייה' };

function wireMeters(): WireMeterM[] {
  return fixtureMeters().map((m) => ({
    id: m.id,
    display_name: m.name,
    source_ref: `sensor.${m.id}_energy`,
    device_id: DEVICES[m.id] ? `dev_${m.id}` : null,
    device_name: DEVICES[m.id] ?? null,
    entity_name: m.name,
    unit: 'kWh',
    area_id: m.area_id,
    area_name: m.area_name,
    status: m.status === 'paused' ? 'paused' : 'active',
    status_reason: m.status === 'paused' ? 'manual' : null,
    revision: 1,
    state: m.status === 'stale' ? 'not_reporting' : m.status === 'paused' ? 'paused' : 'reporting',
    last_report_at: m.last_report_at,
    value_kwh: m.reading_kwh,
    today_kwh: m.today_kwh,
    used_in: m.accounts.map((name, i) => ({ account_id: `a${i}`, name })),
    month_kwh: m.month_kwh ?? 0,
    floor: { id: m.floor_id ?? 'f', name: m.floor_name ?? '' },
  }));
}

/** The wire form of a meter: the bookkeeping fields the screens must not see are dropped. */
const out = (m: WireMeterM) => ({ id: m.id, display_name: m.display_name, device_id: m.device_id ?? null, device_name: m.device_name ?? null, entity_name: m.entity_name ?? null, source_ref: m.source_ref, unit: m.unit, area_id: m.area_id, area_name: m.area_name, status: m.status, status_reason: m.status_reason, revision: m.revision, state: m.state, last_report_at: m.last_report_at, value_kwh: m.value_kwh, today_kwh: m.today_kwh });

export async function installElectricityMock(page: Page, opts: MockOptions = {}): Promise<ElectricityMock> {
  const perms = opts.perms ?? PERMS.bills;
  const st: ElectricityMock = { meters: opts.meters === 'empty' ? [] : wireMeters(), settings: { 'energy.raw_retention_days': 90, 'energy.interval_retention_months': 26, 'energy.bill_retention_years': 7, 'energy.draft_retention_days': 30 }, calls: [] };
  const epochs = new Map<string, WireEpochM[]>();
  const epochsOf = (id: string): WireEpochM[] => {
    if (!epochs.has(id)) epochs.set(id, fixtureEpochs(id).filter((e) => e.reason !== 'reset').map((e, i) => ({ id: `e${i}`, started_at: e.started_at, ended_at: e.ended_at, start_reading_wh: (e.start_reading_kwh ?? 0) * 1000, reason: 'first', note: e.note })));
    return epochs.get(id)!;
  };
  const logs = new Map<string, ReadingLog>();
  const logOf = (id: string, kwh: number): ReadingLog => {
    if (!logs.has(id)) logs.set(id, fixtureReadingLog(id, kwh));
    return logs.get(id)!;
  };
  st.readingLogs = logs;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, me(perms));
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'identity/users') return json(route, { users: [], directory: { paired: false, last_directory_at: null, users: 0 }, revision: 1, can_assign: false, members: [], bindings: [] });
    if (p === 'access/roles') return json(route, ROLES);
    if (p === 'access/groups') return json(route, { groups: [], can_manage: false, delegated: false });
    if (p === 'devices/tree') {
      if (opts.noFloors) return err(route, 403, 'forbidden', 'אין הרשאה');
      const floors = new Map<string, { floor_id: string; name: string; level: number; icon: null; areas: { area_id: string; name: string }[] }>();
      for (const m of wireMeters()) {
        const f = floors.get(m.floor.id) ?? { floor_id: m.floor.id, name: m.floor.name, level: 0, icon: null, areas: [] };
        if (m.area_id && !f.areas.some((a) => a.area_id === m.area_id)) f.areas.push({ area_id: m.area_id, name: m.area_name ?? '' });
        floors.set(m.floor.id, f);
      }
      return json(route, { floors: [...floors.values()], unassigned: { area_id: 'unassigned', name: 'ללא שיוך' }, scoped: false, can_bulk: false });
    }
    if (!p.startsWith('energy/')) return err(route, 404, 'not_found', 'לא נמצא');
    const e = p.slice('energy/'.length);
    const body = method === 'GET' || method === 'DELETE' ? null : req.postDataJSON();
    st.calls.push({ method, path: e + url.search, body });
    if (e === 'meters' && method === 'GET') {
      if (!perms.includes('energy.view')) return err(route, 403, 'forbidden', 'אין הרשאה');
      if (opts.meters === 'error') return err(route, 500, 'internal', 'השרת לא ענה');
      if (opts.meters === 'slow') await new Promise((r) => setTimeout(r, 1500));
      return json(route, { items: st.meters.filter((m) => m.status !== 'retired').map(out), stale_after_minutes: 60 });
    }
    if (e === 'consumption') {
      if (opts.consumptionFails) return err(route, 500, 'internal', 'השרת לא ענה');
      const ids = (url.searchParams.get('meter_ids') ?? '').split(',').filter(Boolean);
      return json(route, { from: url.searchParams.get('from'), to: url.searchParams.get('to'), items: st.meters.filter((m) => ids.includes(m.id)).map((m) => ({ meter_id: m.id, wh: Math.round(m.month_kwh * 1000), kwh: m.month_kwh, coverage: 'full', covered_seconds: 1, total_seconds: 1, last_report_at: m.last_report_at })) });
    }
    if (e.startsWith('candidates')) {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const items = fixtureCandidates()
        .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.device_name ?? '').toLowerCase().includes(q))
        .map((c) => {
          const code = c.verdict === 'ok' ? 'ok' : CODE[c.reason_code ?? 'unit'];
          const [state, unit] = (c.value ?? '').split(' ');
          return { ref: c.entity_id, name: c.name, device_id: c.device_id, device_name: c.device_name, entity_name: c.entity_name, area_id: c.area_id, area_name: c.area_name, unit: unit ?? null, device_class: null, state_class: null, state: state?.replace(/,/g, ''), verdict: c.verdict === 'warn' ? 'warning' : c.verdict, code, message: c.verdict === 'ok' ? null : MSG[code], already_meter_id: c.already_added ? 'm2' : null };
        });
      return json(route, { items });
    }
    if (e === 'meters' && method === 'POST') {
      const ref = (body as { source_ref: string }).source_ref;
      const c = fixtureCandidates().find((x) => x.entity_id === ref);
      if (!c) return err(route, 404, 'not_found', 'החיישן לא נמצא');
      if (c.verdict === 'rejected') return err(route, 422, 'meter_unit_rejected', MSG[CODE[c.reason_code ?? 'unit']], { code: CODE[c.reason_code ?? 'unit'] });
      const typed = ((body as { display_name?: string }).display_name ?? '').trim();
      if (st.meters.some((o) => o.status !== 'retired' && o.display_name.trim().toLowerCase() === (typed || c.name).toLowerCase())) return err(route, 409, 'meter_name_taken', 'קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם');
      const m: WireMeterM = { id: `m${st.meters.length + 1}`, display_name: typed || c.name, device_id: c.device_id, device_name: c.device_name, entity_name: c.entity_name, source_ref: ref, unit: 'kWh', area_id: c.area_id, area_name: c.area_name, status: 'active', status_reason: null, revision: 1, state: 'reporting', last_report_at: '2026-10-04T18:49:00Z', value_kwh: 1204.5, today_kwh: 0, used_in: [], month_kwh: 0, floor: { id: 'f-p', name: 'חניון' } };
      st.meters.push(m);
      return json(route, out(m), 201);
    }
    // EL6: manual readings and calibrations (wire: docs/changes/EL6-MANUAL-READING-CALIBRATION.md)
    const rd = /^meters\/([^/?]+)\/(manual-readings|calibrations)(?:\/([^/?]+)\/undo)?$/.exec(e.split('?')[0]);
    if (rd) {
      const id = decodeURIComponent(rd[1]);
      const m = st.meters.find((x) => x.id === id);
      if (!m) return err(route, 404, 'not_found', 'המונה לא נמצא');
      const log = logOf(id, m.value_kwh ?? 0);
      if (method === 'GET') return perms.includes('energy.view') ? json(route, log) : err(route, 403, 'forbidden', 'אין הרשאה');
      if (!perms.includes('energy.manage')) return err(route, 403, 'forbidden', 'אין הרשאה');
      if (rd[3]) {
        const list: { id: string | null; voided_at: string | null; can_undo: boolean; voided_by_name: string | null; in_force?: boolean }[] = rd[2] === 'manual-readings' ? log.items : log.calibrations;
        const it = list.find((x) => x.id === rd[3]);
        if (!it) return err(route, 404, 'not_found', 'לא נמצא');
        if (!it.can_undo) return err(route, 409, 'undo_window_passed', 'עבר הזמן שבו אפשר לבטל (24 שעות).');
        Object.assign(it, { voided_at: '2026-10-04T18:50:00Z', voided_by_name: 'דנה', can_undo: false, in_force: false });
        return json(route, log);
      }
      if (rd[2] === 'manual-readings') {
        const b = body as { read_at: string; value: string; unit: 'kWh' | 'Wh' | 'MWh'; note?: string; dry_run?: boolean };
        const kwh = (Number(b.value) * { kWh: 1000, Wh: 1, MWh: 1_000_000 }[b.unit]) / 1000;
        if (!Number.isFinite(kwh) || kwh < 0) return err(route, 422, 'validation', 'הערך אינו מספר.', { fields: ['value'] });
        const prev = log.items.filter((x) => !x.voided_at && x.read_at < b.read_at).sort((x, y) => (x.read_at < y.read_at ? 1 : -1))[0];
        if (prev && kwh < prev.value_kwh) return err(route, 422, 'reading_not_monotonic', 'הקריאה נמוכה מקריאה ידנית קודמת של אותו מונה.', { fields: ['value'] });
        const stale = m.state === 'not_reporting';
        const sys = stale ? null : m.value_kwh ?? 0;
        const reason = stale ? 'open_gap' : 'reported';
        const r = { id: b.dry_run ? null : `r${log.items.length + 10}`, read_at: b.read_at, value_kwh: kwh, value_wh: Math.round(kwh * 1000), typed_value: b.value, typed_unit: b.unit,
          system_kwh: sys, system_exact: sys != null, deviation_kwh: sys == null ? null : Math.round((kwh - sys) * 1000) / 1000, effect: stale ? 'allocation' : 'record', effect_reason: reason,
          message: stale ? 'הקריאה השלימה את הפער מאז הדיווח האחרון. הצריכה עד הקריאה חולקה לפי זמן.' : 'המונה דיווח בזמן הזה. הקריאה נשמרה להשוואה בלבד.', note: b.note ?? null,
          created_at: '2026-10-04T18:49:00Z', created_by_name: 'דנה', voided_at: null, voided_by_name: null, void_reason: null, can_undo: true, undo_until: '2026-10-05T18:49:00Z' } as const;
        if (b.dry_run) return json(route, { dry_run: true, reading: r });
        log.items = [r, ...log.items].sort((x, y) => (x.read_at < y.read_at ? 1 : -1)) as typeof log.items;
        return json(route, { dry_run: false, reading: r, log });
      }
      const b = body as { effective_date: string; factor: string; offset_kwh?: string; anchor_reading_id?: string; note?: string; dry_run?: boolean };
      const f = Number(b.factor);
      if (!(f >= 0.5 && f <= 2)) return err(route, 422, 'validation', 'המקדם חייב להיות בין 0.5 ל-2.', { fields: ['factor'] });
      if (log.first_calibration_date && b.effective_date < log.first_calibration_date) return err(route, 409, 'calibration_billed', 'התקופה עד 01.10.2026 כבר חויבה. אפשר לכייל רק מהתאריך הזה והלאה.', { fields: ['effective_date'] });
      const anchor = log.items.find((x) => x.id === b.anchor_reading_id);
      const offset = anchor && anchor.system_kwh != null ? Math.round((anchor.value_kwh - f * anchor.system_kwh) * 1000) / 1000 : Number(b.offset_kwh ?? 0);
      const c = { id: b.dry_run ? null : `c${log.calibrations.length + 10}`, effective_date: b.effective_date, effective_from: `${b.effective_date}T00:00:00Z`, factor: b.factor, offset_kwh: offset,
        anchor_reading_id: b.anchor_reading_id ?? null, note: b.note ?? null, in_force: false, created_at: '2026-10-04T18:49:00Z', created_by_name: 'דנה', voided_at: null, voided_by_name: null,
        void_reason: null, can_undo: true, undo_until: '2026-10-05T18:49:00Z' };
      if (b.dry_run) return json(route, { dry_run: true, calibration: c });
      log.calibrations = [c, ...log.calibrations];
      return json(route, { dry_run: false, calibration: c, log });
    }
    const one = /^meters\/([^/?]+)(\/(series|replace))?/.exec(e);
    if (one) {
      const id = decodeURIComponent(one[1]);
      const m = st.meters.find((x) => x.id === id);
      if (!m) return err(route, 404, 'not_found', 'המונה לא נמצא');
      if (one[3] === 'series') {
        const hourly = url.searchParams.get('step') === '1h';
        const pts = fixtureSeries(id, hourly ? 24 : 30, hourly ? 3_600_000 : 86_400_000);
        return json(route, { meter_id: id, step: url.searchParams.get('step'), unit: 'kWh', items: pts.map((x) => ({ start: x.t, end: x.t, kwh: x.kwh, wh: Math.round(x.kwh * 1000), coverage: 'full' })) });
      }
      if (one[3] === 'replace') {
        const b = body as { revision: number; new_start_reading_kwh: number; note?: string };
        if (b.revision !== m.revision) return err(route, 409, 'revision_conflict', 'המונה שונה בינתיים');
        const list = epochsOf(id);
        const open = list.find((x) => !x.ended_at);
        if (open) open.ended_at = '2026-10-04T18:49:00Z';
        list.push({ id: `e${list.length}`, started_at: '2026-10-04T18:49:00Z', ended_at: null, start_reading_wh: b.new_start_reading_kwh * 1000, reason: 'replaced', note: b.note ?? null });
        m.revision += 1;
        return json(route, { ...out(m), epochs: list, used_in: m.used_in });
      }
      if (method === 'GET') return json(route, { ...out(m), epochs: epochsOf(id), used_in: m.used_in });
      if (method === 'PATCH') {
        const b = body as { revision: number; status?: 'active' | 'paused'; display_name?: string };
        if (b.revision !== m.revision) return err(route, 409, 'revision_conflict', 'המונה שונה בינתיים');
        if (b.display_name !== undefined) {
          const nm = b.display_name.trim();
          if (!nm || nm.length > 120) return err(route, 422, 'validation', 'שם המונה אינו תקין', { fields: ['display_name'] });
          if (nm !== m.display_name && st.meters.some((o) => o.id !== m.id && o.status !== 'retired' && o.display_name.trim().toLowerCase() === nm.toLowerCase())) return err(route, 409, 'meter_name_taken', 'קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם');
          m.display_name = nm;
        }
        if (b.status) {
          m.status = b.status;
          m.state = b.status === 'paused' ? 'paused' : 'reporting';
        }
        m.revision += 1;
        return json(route, out(m));
      }
      if (method === 'DELETE') {
        if (m.used_in.length) return err(route, 409, 'meter_in_use', 'המונה משמש בחשבון ולכן אי אפשר להסיר אותו', { accounts: m.used_in.map((u) => u.name) });
        m.status = 'retired';
        m.state = 'retired';
        return json(route, out(m));
      }
    }
    if (e === 'settings') {
      if (opts.settings === 'error') return err(route, 500, 'internal', 'השרת לא ענה');
      if (method === 'PATCH') {
        const range: Record<string, [number, number]> = { 'energy.raw_retention_days': [7, 366], 'energy.interval_retention_months': [3, 120], 'energy.bill_retention_years': [1, 15], 'energy.draft_retention_days': [7, 365] };
        for (const [k, v] of Object.entries(body as Record<string, number>)) if (!range[k] || v < range[k][0] || v > range[k][1]) return err(route, 422, 'validation', `הערך חייב להיות בין ${range[k]?.[0]} ל-${range[k]?.[1]}`);
        Object.assign(st.settings, body);
      }
      const sys = perms.includes('system.configure');
      const mgr = perms.includes('energy.manage');
      return json(route, {
        values: { ...st.settings, 'energy.stale_after_minutes': 60 },
        editable: { 'energy.raw_retention_days': sys, 'energy.interval_retention_months': sys, 'energy.bill_retention_years': sys, 'energy.draft_retention_days': mgr },
        ranges: { 'energy.raw_retention_days': { min: 7, max: 366 }, 'energy.interval_retention_months': { min: 3, max: 120 }, 'energy.bill_retention_years': { min: 1, max: 15 }, 'energy.draft_retention_days': { min: 7, max: 365 } },
        storage: { energy_db_bytes: 308 * 1_048_576, classes: { raw: { rows: 1, bytes_estimate: 212 * 1_048_576 }, intervals: { rows: 1, bytes_estimate: 96 * 1_048_576 }, daily: { rows: 1, bytes_estimate: 2 * 1_048_576 } }, estimate: { meters: st.meters.length } },
      });
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}

export const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;

/** The URL of a screen: skin and scheme as the dev query, the route as the hash. */
export const url = (hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#${hash}`;
