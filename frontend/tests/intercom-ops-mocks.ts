import type { Page, Route } from '@playwright/test';
import { installAccessMock, type Persona } from './access-control-mocks';

// WISKEY-OPS-VIEWS-2400: the mocked backend of הגדרות › תפעול האינטרקום, layered over the access-control mock (tests/access-control-mocks.ts:
// the session, the settings, the shell; routes registered later win). Invented answers only - no station, no intercom. It answers like
// routers/access_control_ops.py (the reads, the cancel with its envelope, the CSV files) and RECORDS every cancel and export so a spec can
// assert exactly what was sent, once.

export type CancelResult = 'ok' | 'refused' | 'unknown';

export interface OpsMock {
  persona: Persona;
  /** Views that answer 503 (an error part) or 501 (this intercom does not offer it). */
  fail: Set<string>;
  unsupported: Set<string>;
  /** The investigations timeline hides the person fields (a caller without the people permissions). */
  hidePeople: boolean;
  cancel: CancelResult;
  cancels: { path: string; body: Record<string, unknown> }[];
  exports: string[];
  /** Every read, as `<path>?<query>` (what the screen asked the server for). */
  requests: string[];
  jobState: string;
  empty: boolean;
}

export const newOpsMock = (over: Partial<OpsMock> = {}): OpsMock => ({
  persona: 'admin',
  fail: new Set(),
  unsupported: new Set(),
  hidePeople: false,
  cancel: 'ok',
  cancels: [],
  exports: [],
  requests: [],
  jobState: 'paused',
  empty: false,
  ...over,
});

const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

const AT = '2026-09-27T10:29:00Z';
const ZONE = { kind: 'iana', name: 'Asia/Jerusalem' };

export const STATIONS = [
  { id: 'entry-a', name: 'שער ראשי', online: true, loaded: true, sync_state: 'synced', last_error: null, pending_users: 0, managed_users: 120, unmanaged_users: 0, users: 120, cards: 96, max_users: 500, max_cards: 500, peak_use_percent: 24, last_seen: AT, reconciled_at: AT },
  { id: 'entry-b', name: 'דלת צדדית', online: false, loaded: true, sync_state: 'error', last_error: 'authentication_failed', pending_users: 3, managed_users: 40, unmanaged_users: 2, users: 42, cards: 30, max_users: 500, max_cards: 500, peak_use_percent: 8.4, last_seen: '2026-09-27T09:10:00Z', reconciled_at: null },
  { id: 'entry-c', name: 'רציף פריקה', online: true, loaded: true, sync_state: 'synced', last_error: null, pending_users: 0, managed_users: 458, unmanaged_users: 0, users: 460, cards: 300, max_users: 500, max_cards: 500, peak_use_percent: 92, last_seen: AT, reconciled_at: AT },
];

function overview(m: OpsMock) {
  const stations = m.empty ? [] : STATIONS;
  const kpis = { stations: stations.length, online: stations.filter((s) => s.online).length, offline: stations.filter((s) => !s.online).length,
    pending_users: stations.reduce((n, s) => n + s.pending_users, 0), sync_problems: stations.filter((s) => s.sync_state === 'error').length,
    near_capacity: stations.filter((s) => s.peak_use_percent >= 80).length };
  const admin = m.persona === 'admin' || m.persona === 'siteAdmin';
  const summary = m.fail.has('summary') ? { state: 'error', code: 'ops_unavailable', message: 'החיבור למערכת האינטרקום אינו זמין כרגע.' } : { state: 'ready', data: { kpis, stations, zone: ZONE }, fetched_at: AT };
  const views = Object.fromEntries(['summary', 'operations', 'investigations', 'jobs', 'job_errors', 'capacity', 'inventory', 'audit_export', 'events_report', 'cancel'].map((v) => [v, !m.unsupported.has(v)]));
  return { summary, views, can: { admin, export: admin, cancel: admin, names: !m.hidePeople, employee_numbers: !m.hidePeople && admin, actors: admin } };
}

const page = <T,>(records: T[], extra: Record<string, unknown>) => ({ records, total: records.length, offset: 0, limit: 25, next_offset: null, previous_offset: null, snapshot: 's', stale: false, ...extra });

function operations(m: OpsMock, q: URLSearchParams) {
  const rows = m.empty ? [] : [
    { id: 'op-sync-1', kind: 'sync', action: 'sync/user_station', state: 'failed', created_at: '2026-09-27T09:00:00Z', updated_at: '2026-09-27T09:02:00Z', changed: 1, user_ids: ['u-1'], station_ids: ['entry-b'],
      progress: { total: 1, pending: 0, failed: 1, verified: 0, settled: 0 }, errors: ['authentication_failed'] },
    { id: 'op-bulk-1', kind: 'bulk', action: 'bulk/enable', state: 'verified', created_at: '2026-09-27T08:00:00Z', updated_at: '2026-09-27T08:03:00Z', changed: 4, user_ids: ['u-1', 'u-2', 'u-3', 'u-4'], station_ids: ['entry-a', 'entry-c'],
      progress: { total: 4, pending: 0, failed: 0, verified: 4, settled: 0 }, errors: [] },
    { id: 'op-csv-1', kind: 'csv', action: 'bulk/csv_import', state: 'pending', created_at: '2026-09-27T07:00:00Z', updated_at: '2026-09-27T07:10:00Z', changed: 12, user_ids: ['u-5'], station_ids: ['entry-a'],
      progress: { total: 12, pending: 5, failed: 0, verified: 7, settled: 0 }, errors: [] },
  ];
  const state = q.get('state') ?? 'all';
  const shown = rows.filter((r) => state === 'all' || r.state === state);
  return { data: page(shown, { summary: { pending: 1, failed: 1, verified: 1, settled: 0, saved: 0 } }), fetched_at: AT };
}

function jobs(m: OpsMock) {
  const admin = m.persona === 'admin' || m.persona === 'siteAdmin';
  const records = m.empty ? [] : [
    { id: 'job-1', kind: 'csv', state: m.jobState, revision: 3, created_at: '2026-09-27T08:00:00Z', updated_at: '2026-09-27T08:05:00Z', total: 40, saved: 31, failed: 2, pending: 7, approval: null,
      errors: [{ row: 12, code: 'duplicate_card' }, { row: 27, code: 'invalid_pin' }], cancellable: ['paused', 'running', 'completed_with_errors'].includes(m.jobState) },
    { id: 'job-2', kind: 'bulk', state: 'completed', revision: 7, created_at: '2026-09-26T08:00:00Z', updated_at: '2026-09-26T08:09:00Z', total: 18, saved: 18, failed: 0, pending: 0, approval: null, errors: [], cancellable: false },
  ];
  return { data: { records, pending_reviews: 0, dual_approval: false }, fetched_at: AT, can_cancel: admin };
}

function timeline(m: OpsMock) {
  const hide = m.hidePeople;
  const rows = [
    { id: 'access/e1', source: 'access', time: '2026-09-27T10:12:00Z', time_source: 'device', station_ids: ['entry-a'], action: 'access_granted', status: 'granted', evidence: 'device_event',
      user_id: hide ? null : 'u-1', person_name: hide ? null : 'דנה כהן', employee_no: hide ? null : '1001', actor: null, door: 1, identity_basis: 'observed_station_owner', fields: [] },
    { id: 'sync/s1', source: 'sync', time: '2026-09-27T10:05:00Z', time_source: 'system', station_ids: ['entry-a'], action: 'sync/user_station', status: 'verified', evidence: 'device_readback',
      user_id: hide ? null : 'u-1', person_name: hide ? null : 'דנה כהן', employee_no: hide ? null : '1001', actor: null, door: null, identity_basis: null, fields: [] },
    { id: 'change/12', source: 'change', time: '2026-09-27T10:01:00Z', time_source: 'system', station_ids: ['entry-a'], action: 'users/update', status: 'saved', evidence: 'desired_state_saved',
      user_id: hide ? null : 'u-1', person_name: hide ? null : 'דנה כהן', employee_no: hide ? null : '1001', actor: hide ? null : 'ha-admin-1', door: null, identity_basis: null, fields: ['valid_until'] },
    { id: 'access/e0', source: 'access', time: '2026-09-27T09:41:00Z', time_source: 'device', station_ids: ['entry-b'], action: 'access_denied', status: 'denied', evidence: 'device_event',
      user_id: null, person_name: null, employee_no: null, actor: null, door: 1, identity_basis: 'device_record_only', fields: [] },
  ];
  return { data: page(m.empty ? [] : rows, { summary: { access: 2, change: 1, sync: 1 }, actors: hide ? {} : { 'ha-admin-1': 'מנהל המערכת' }, access_available: true, access_storage_failed: false, retention_days: 30,
    fields_hidden: hide ? ['person_name', 'employee_no', 'actor'] : [] }), fetched_at: AT };
}

function capacity(m: OpsMock, days: number) {
  const v = (count: number, limit: number, alert: string, growth: number | null) => ({ count, limit, used_percent: Math.round((1000 * count) / limit) / 10, remaining: limit - count,
    growth_per_day: growth, days_to_limit: growth ? Math.round(((limit - count) / growth) * 10) / 10 : null, alert });
  const records = m.empty ? [] : [
    { station_id: 'entry-c', name: 'רציף פריקה', sampled_at: AT, fresh: true, sample_count: 12, span_days: 20, users: v(460, 500, 'near_limit', 2.5), cards: v(300, 500, 'observed', 1) },
    { station_id: 'entry-a', name: 'שער ראשי', sampled_at: AT, fresh: true, sample_count: 12, span_days: 20, users: v(120, 500, 'observed', 0.4), cards: v(96, 500, 'observed', null) },
    { station_id: 'entry-b', name: 'דלת צדדית', sampled_at: '2026-09-27T06:00:00Z', fresh: false, sample_count: 3, span_days: 2, users: v(42, 500, 'stale', null), cards: v(30, 500, 'stale', null) },
  ];
  const series = (from: number, step: number) => Array.from({ length: 10 }, (_, i) => ({ at: new Date(Date.parse('2026-09-07T10:00:00Z') + i * 2 * 86_400_000).toISOString().replace('.000Z', 'Z'),
    users: Math.round(from + i * step + (i % 3 === 1 ? 3 : 0)), cards: null, max_users: 500, max_cards: 500 }));
  return { data: { records, forecast_is_estimate: true }, fetched_at: AT, trend: { days, series: m.empty ? {} : { 'entry-c': series(410, 5.5), 'entry-a': series(112, 0.9) }, stored_now: 0 } };
}

function report() {
  const c = (g: number, d: number, o = 0) => ({ records: g + d + o, authentication: g + d, granted: g, denied: d, unknown: 0, other: o, recovered: 0 });
  const days = [[34, 2], [41, 1], [28, 5], [12, 0], [9, 1], [37, 3], [44, 2]];
  return { data: { generated_at: AT, day_timezone: 'station', oldest: '2026-09-21T05:00:00Z', newest: '2026-09-27T10:12:00Z', totals: c(205, 14, 6),
    methods: { card: 160, pin: 59, unknown: 0 }, anomalies: { access_denied: 14, attempt_limit: 1, unlock_exception: 0, door_not_closed: 3 },
    anomaly_by_station: [{ station_id: 'entry-b', total: 11, counts: { access_denied: 9, attempt_limit: 1, unlock_exception: 0, door_not_closed: 1 } }],
    by_station: [{ station_id: 'entry-a', ...c(150, 3, 2) }, { station_id: 'entry-b', ...c(30, 9, 4) }, { station_id: 'entry-c', ...c(25, 2) }],
    by_day: days.map(([g, d], i) => ({ day: `2026-09-${String(21 + i).padStart(2, '0')}`, ...c(g, d) })), retention_days: 30, storage_failed: false }, fetched_at: AT };
}

export async function installOpsMock(page: Page, m: OpsMock = newOpsMock()): Promise<OpsMock> {
  await installAccessMock(page, { persona: m.persona });
  const admin = () => m.persona === 'admin' || m.persona === 'siteAdmin';
  const reader = () => m.persona !== 'nobody' && m.persona !== 'scoped' && m.persona !== 'scopedAdmin';
  await page.route('**/api/v1/access-control/operations/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\/access-control\/operations\//, '');
    const method = route.request().method();
    m.requests.push(`${p}?${url.searchParams.toString()}`);
    if (!reader()) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'c', details: {} }, 403);
    const view = p === 'overview' ? 'summary' : p.startsWith('jobs') && p.endsWith('/cancel') ? 'cancel' : p.startsWith('jobs') && p.endsWith('errors.csv') ? 'job_errors' : p === 'jobs' ? 'jobs'
      : p === 'events-report' ? 'events_report' : p === 'exports/fleet-inventory.csv' ? 'inventory' : p === 'exports/audit.csv' ? 'audit_export' : p;
    if (view !== 'summary' && m.unsupported.has(view)) return json(route, { code: 'ops_unsupported', user_message: 'גרסת מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו.', retryable: false, correlation_id: 'c', details: { state: 'unsupported' } }, 501);
    if (view !== 'summary' && m.fail.has(view)) return json(route, { code: 'ops_unavailable', user_message: 'החיבור למערכת האינטרקום אינו זמין כרגע.', retryable: true, correlation_id: 'c', details: { state: 'ha_unavailable' } }, 503);
    if (p === 'overview') return json(route, overview(m));
    if (p === 'operations') return json(route, operations(m, url.searchParams));
    if (p === 'investigations') return json(route, timeline(m));
    if (p === 'jobs') return json(route, jobs(m));
    if (p === 'capacity') return json(route, capacity(m, Number(url.searchParams.get('days') ?? 30)));
    if (p === 'events-report') return json(route, report());
    if (view === 'cancel' && method === 'POST') {
      if (!admin()) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'c', details: {} }, 403);
      const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      m.cancels.push({ path: p, body });
      if (m.cancel === 'refused') return json(route, { code: 'ops_cancel_refused', user_message: 'המשימה כבר הסתיימה או בוטלה, ולכן לא בוטלה שוב. לא בוצע שינוי.', retryable: false, correlation_id: 'c', details: { outcome: 'refused', wiskey_code: 'job_finished' } }, 409);
      if (m.cancel === 'unknown') return json(route, { code: 'ops_cancel_unknown', user_message: 'הביטול נשלח, אך לא התקבלה תשובה ברורה (timeout). ייתכן שהמשימה בוטלה - טענו מחדש את הרשימה לפני שמנסים שוב.', retryable: false, correlation_id: 'c', details: { outcome: 'unknown', wiskey_code: 'timeout' } }, 504);
      m.jobState = 'cancelled';
      const job = jobs(m).data.records[0];
      return json(route, { status: 'completed', command_id: 'cmd-1', at: AT, job: { ...job, revision: 4 } });
    }
    if (p.endsWith('.csv')) {
      if (!admin()) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'c', details: {} }, 403);
      m.exports.push(p);
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="intercom-export.csv"', 'X-Export-Rows': '3', 'Cache-Control': 'private, no-store' },
        body: '﻿"name"\r\n"\'=1+1"\r\n' });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'c', details: {} }, 404);
  });
  return m;
}
