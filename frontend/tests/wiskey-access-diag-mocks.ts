import type { Page, Route } from '@playwright/test';
import { installAccessMock, type AccessMock, type Persona } from './access-control-mocks';

// WISKEY-ACCESS-DIAG-2400: the "אבחון הרשאות" screen's mock, layered over tests/access-control-mocks.ts (a route registered later answers
// first). The wire follows routers/access_control_diag.py (the backend test tests/test_wiskey_access_diag.py pins the server side). Every
// person, group and station here is INVENTED sample data; nothing reaches the access-control system, a station or a door.

export interface DiagOptions {
  persona?: Persona;
  /** the decision's answer: ok (saved), stale (refused: the review changed), unsupported (the system does not offer it to the Arx identity) */
  decide?: 'ok' | 'stale' | 'unsupported';
  /** views the installed system does not offer */
  unsupported?: string[];
  /** the scenario's answer: no (outside the schedule, the default) or yes */
  answer?: 'yes' | 'no';
}

export interface DiagMock {
  access: AccessMock;
  posts: { path: string; body: Record<string, unknown> }[];
  reads: string[];
}

const T = '2026-09-27T10:30:00Z';
const ZONE = { kind: 'iana', name: 'Asia/Jerusalem' };
export const DIAG_STATIONS = [
  { id: 'entry-a', name: 'כניסה ראשית', online: true, zone: ZONE, doors: [{ lock_id: 1, name: null }] },
  { id: 'entry-b', name: 'חניון', online: true, zone: ZONE, doors: [{ lock_id: 1, name: 'שער' }, { lock_id: 2, name: 'מחסום' }] },
  { id: 'entry-c', name: 'דלת אחורית', online: false, zone: ZONE, doors: [{ lock_id: 1, name: null }] },
];
const PEOPLE = [
  { id: 'p1', name: 'דנה לוי', archived: false },
  { id: 'p2', name: 'יוסי כהן', archived: false },
  { id: 'p3', name: 'מיכל בר', archived: false },
  { id: 'p4', name: 'רון אבידן', archived: true },
];
const GROUPS = [
  { id: 'staff', name: 'צוות', archived: false },
  { id: 'night', name: 'משמרת לילה', archived: false },
];
const FEATURES = ['pickers', 'scenario', 'compare', 'compare_doors', 'reviews', 'review_decide', 'quality', 'lifecycle', 'sync', 'permission_audit'];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number, code: string, message: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: message, retryable: false, correlation_id: 'mock', details }, status);
const head = { state: 'ready', last_error: null, fetched_at: T };
const side = (source: string, granted = true, groups: { id: string; name: string }[] = [], override: string | null = null) =>
  ({ granted, configured: granted || source !== 'none', source, groups, override, sources_known: true });
const central = (granted = true) => ({ active: true, archived: false, valid_from: null, valid_until: '2026-12-31T22:00:00Z', assignment_enabled: true, granted, timing_mode: 'ha',
                                       schedule: { mode: 'weekly', timezone: 'Asia/Jerusalem', days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'], dates: [], periods: [{ start: '07:00', end: '19:00' }] } });

export async function installDiagMock(page: Page, o: DiagOptions = {}): Promise<DiagMock> {
  const persona = o.persona ?? 'admin';
  const access = await installAccessMock(page, { persona });
  const mock: DiagMock = { access, posts: [], reads: [] };
  const people = ['admin', 'siteAdmin', 'operator'].includes(persona);
  const manage = persona === 'admin' || persona === 'siteAdmin';
  const installation = !['scoped', 'scopedAdmin', 'nobody'].includes(persona);
  const receipts: Record<string, unknown>[] = [];
  const unsupported = new Set(o.unsupported ?? []);
  if (o.decide === 'unsupported') unsupported.add('review_decide');

  await page.route('**/api/v1/access-control/diag**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\/access-control\/diag/, '') || '/';
    const q = u.searchParams;
    if (req.method() !== 'GET') mock.posts.push({ path: p, body: (req.postDataJSON() as Record<string, unknown>) ?? {} });
    else mock.reads.push(p + u.search);
    if (!installation) return fail(route, 403, 'forbidden', 'אין הרשאה (בדיקה).', { permission: 'access.read', reason: 'station_scoped' });
    if (p === '/') {
      return json(route, {
        feed: 'ready', doors: DIAG_STATIONS, default_zone: ZONE,
        features: Object.fromEntries(FEATURES.map((f) => [f, unsupported.has(f) ? { available: false, reason: 'not_listed' } : { available: true, reason: null }])),
        can: { people, decide: people && manage, sensitive: manage, employee_no: people },
      });
    }
    if (!people && p !== '/sync') return fail(route, 403, 'forbidden', 'אין הרשאה (בדיקה).', { permission: 'access.people.read' });
    if (p === '/options') {
      const list = q.get('kind') === 'group' ? GROUPS : PEOPLE;
      const text = q.get('query') ?? '';
      const records = list.filter((x) => x.name.includes(text));
      return json(route, { ...head, options: { records, total: records.length, offset: 0, limit: 8, next_offset: null, previous_offset: null } });
    }
    if (p === '/scenario') {
      const yes = o.answer === 'yes';
      const station = DIAG_STATIONS.find((s) => s.id === q.get('station_id'))!;
      const lock = Number(q.get('lock_id') ?? 1);
      return json(route, {
        ...head,
        scenario: {
          person_revision: 6, station_id: station.id, lock_id: lock, at: q.get('at') ?? T,
          desired: { allowed: yes, reason: yes ? 'allowed' : 'outside_schedule', timing_mode: 'ha', draft_ignored: false },
          observed: { sync_state: 'synced', last_sync_at: '2026-09-27T09:58:00Z', revision_matches: true,
                      timing: { status: 'historical', mode: 'ha', checked_at: '2026-09-27T05:00:00Z', valid_from: '2026-09-27T04:00:00Z', valid_until: '2026-09-27T16:00:00Z', interval_contains_target: null } },
          station_status: 'online', physical_result: 'not_verified',
          source: side('inherited', true, [{ id: 'staff', name: 'צוות' }]),
          person: { kind: 'person', id: q.get('user_id'), name: PEOPLE.find((x) => x.id === q.get('user_id'))?.name ?? '', active: true, archived: false, valid_from: null,
                    valid_until: '2026-12-31T22:00:00Z', timing_mode: 'ha' },
        },
        station: { id: station.id, name: station.name, online: station.online, door_name: station.doors.find((d) => d.lock_id === lock)?.name ?? null },
      });
    }
    if (p === '/compare') {
      const kind = q.get('left_kind');
      const name = (id: string | null) => (kind === 'group' ? GROUPS : PEOPLE).find((x) => x.id === id)?.name ?? '';
      const label = (id: string | null) => (kind === 'group' ? { kind, id, name: name(id), enabled: true }
        : { kind, id, name: name(id), active: true, archived: false, valid_from: null, valid_until: null, timing_mode: 'ha' });
      return json(route, { ...head, compare: {
        left: label(q.get('left_id')), right: label(q.get('right_id')),
        rows: [
          { station_id: 'entry-a', station_name: 'כניסה ראשית', lock_id: 1, relation: 'shared', left: side('inherited', true, [{ id: 'staff', name: 'צוות' }]), right: side('inherited', true, [{ id: 'staff', name: 'צוות' }]) },
          { station_id: 'entry-b', station_name: 'חניון', lock_id: 1, relation: 'left_only', left: side('personal_allow', true, [], 'allow'), right: side('none', false) },
          { station_id: 'entry-b', station_name: 'חניון', lock_id: 2, relation: 'right_only', left: side('personal_deny', false, [], 'deny'), right: side('assignment', true) },
          { station_id: 'entry-c', station_name: 'דלת אחורית', lock_id: 1, relation: 'neither', left: side('none', false), right: side('none', false) },
        ],
        summary: { shared: 1, left_only: 1, right_only: 1, neither: 1 }, physical_result: 'not_verified' } });
    }
    if (p === '/compare-doors') {
      return json(route, { ...head, doors: { complete: true, physical_result: 'not_verified', summary: { shared: 1, left_only: 1, right_only: 1, neither: 0 }, rows: [
        { user_id: 'p1', display_name: 'דנה לוי', relation: 'shared', left: true, right: true, left_assigned: true, right_assigned: true, archived: false },
        { user_id: 'p3', display_name: 'מיכל בר', relation: 'right_only', left: false, right: true, left_assigned: false, right_assigned: true, archived: false },
        { user_id: 'p2', display_name: 'יוסי כהן', relation: 'left_only', left: true, right: false, left_assigned: true, right_assigned: true, archived: false },
      ] } });
    }
    if (p === '/reviews') {
      const latest = receipts.length ? receipts[receipts.length - 1] : { id: 'b'.repeat(32), decision: 'keep', reason: 'נבדק ברבעון הקודם', cadence_days: 90, at: '2026-06-01T08:00:00Z',
                                                                         due_at: '2026-08-30T08:00:00Z', person_revision: 5, arx_actor: 'מנהל אתר' };
      const rows = [
        { user_id: 'p1', display_name: 'דנה לוי', person_revision: 6, status: receipts.length ? 'completed' : 'due', central: central(), latest, sync_state: 'synced' },
        { user_id: 'p2', display_name: 'יוסי כהן', person_revision: 3, status: 'pending', central: central(), latest: null, sync_state: 'synced' },
        { user_id: 'p3', display_name: 'מיכל בר', person_revision: 2, status: 'stale', central: central(false), latest: { id: 'c'.repeat(32), decision: 'followup', reason: 'לבדוק עם מנהל המשמרת',
          cadence_days: 30, at: '2026-09-01T08:00:00Z', due_at: '2026-10-01T08:00:00Z', person_revision: 1, arx_actor: null }, sync_state: 'pending' },
      ];
      const state = q.get('state') ?? 'all';
      const records = rows.filter((r) => state === 'all' || r.status === state);
      return json(route, { ...head, reviews: { snapshot: 'd'.repeat(64), stale: false, total: records.length, offset: 0, limit: 50, next_offset: null, previous_offset: null, records,
        summary: { pending: 1, due: receipts.length ? 0 : 1, stale: 1, completed: receipts.length ? 1 : 0, followup: 0, archived: 0 }, access_changed: false } });
    }
    if (p === '/reviews/preview') {
      return json(route, { ...head, decide: { available: !unsupported.has('review_decide'), reason: unsupported.has('review_decide') ? 'not_listed' : null, allowed: manage },
        preview: { user_id: q.get('user_id'), station_id: q.get('station_id'), lock_id: Number(q.get('lock_id')), person_revision: 6, fingerprint: 'e'.repeat(64),
          latest_id: 'b'.repeat(32), central: central(), access_changed: false,
          history: [{ id: 'b'.repeat(32), decision: 'keep', reason: 'נבדק ברבעון הקודם', cadence_days: 90, at: '2026-06-01T08:00:00Z', due_at: '2026-08-30T08:00:00Z', person_revision: 5, arx_actor: 'מנהל אתר' }] } });
    }
    if (p === '/reviews/decide') {
      if (!manage) return fail(route, 403, 'forbidden', 'אין הרשאה לנהל אנשים בעמדה הזו.', { outcome: 'not_sent' });
      if (o.decide === 'stale') return fail(route, 409, 'diag_review_stale', 'הנתונים השתנו מאז שנפתחה הסקירה (בדיקה).', { outcome: 'refused', wiskey_code: 'access_review_stale' });
      const body = mock.posts[mock.posts.length - 1].body;
      const receipt = { id: 'f'.repeat(32), decision: body.decision, reason: body.reason, cadence_days: body.cadence_days, at: T, due_at: '2026-12-26T10:30:00Z', person_revision: 6, arx_actor: 'מנהל מערכת' };
      receipts.push(receipt);
      return json(route, { status: 'saved', command_id: 'a'.repeat(32), receipt, access_changed: false, at: T });
    }
    if (p === '/quality') {
      return json(route, { ...head, quality: { snapshot: 'f'.repeat(24), stale: false, coverage: { scanned: 48, archived: 3, unknown_fields: 0 },
        summary: { people: 3, missing: 2, invalid: 1, duplicate: 2 }, total: 3, offset: 0, limit: 50, next_offset: null, previous_offset: null,
        records: [
          { id: 'p1', display_name: 'דנה לוי', employee_no: 'E-100', revision: 6, archived: false, issues: [{ kind: 'missing', code: 'missing_phone', field_id: null, label: '', related_count: 0, related_people: [] }] },
          { id: 'p2', display_name: 'יוסי כהן', employee_no: 'E-101', revision: 3, archived: false, issues: [
            { kind: 'duplicate', code: 'duplicate_display_name', field_id: null, label: '', related_count: 1, related_people: [{ id: 'p5', display_name: 'יוסי כהן', archived: false, employee_no: 'E-140' }] },
            { kind: 'missing', code: 'profile_required', field_id: 'department', label: 'מחלקה', related_count: 0, related_people: [] }] },
          { id: 'p3', display_name: 'מיכל בר', employee_no: 'E-102', revision: 2, archived: false, issues: [{ kind: 'invalid', code: 'invalid_phone', field_id: null, label: '', related_count: 0, related_people: [] }] },
        ] } });
    }
    if (p === '/lifecycle') {
      const days = Number(q.get('days') ?? 30);
      const row = (id: string, name: string, until: string, extra: Record<string, unknown>): Record<string, unknown> => ({ id, display_name: name, employee_no: `E-${id.slice(1)}0`, access_category: 'contractor',
        active: true, valid_from: null, valid_until: until, assignment_count: 2, ...extra });
      const expirations = [
        row('p6', 'אבי שמעון', '2026-09-30T21:00:00Z', { state: 'expiring', seconds_remaining: 297000 }),
        row('p7', 'נועה גל', '2026-10-09T21:00:00Z', { state: 'expiring', seconds_remaining: 1074600 }),
        row('p8', 'עידו פרץ', '2026-09-20T21:00:00Z', { state: 'expired', seconds_remaining: -566999 }),
      ].filter((r) => r.state === 'expired' || (r.seconds_remaining as number) <= days * 86400);
      return json(route, { ...head, lifecycle: {
        generated_at: T, warning_days: days,
        summary: { total: 48, active: 44, scheduled: 1, expired: 1, expiring: expirations.filter((r) => r.state === 'expiring').length, without_credentials: 2, duplicate_groups: 1, duplicate_users: 2 },
        expirations,
        temporary: { summary: { total: 2, active: 2, upcoming: 0, expired: 0, inactive: 0, expiring: 1 },
                     users: [row('p6', 'אבי שמעון', '2026-09-30T21:00:00Z', { state: 'active', expiring_soon: true, timing_policy_configured: true })] },
        duplicates: [{ reason: 'display_name', users: [{ id: 'p2', display_name: 'יוסי כהן' }, { id: 'p5', display_name: 'יוסי כהן' }] }],
        without_credentials: manage ? [row('p9', 'שירן דוד', '2027-01-31T22:00:00Z', { access_category: 'staff' })] : null,
        truncated: { expirations: false, duplicates: false, without_credentials: false, temporary_access: false } } });
    }
    if (p === '/sync') {
      return json(route, { ...head, diagnostics: { integration_version: '2.0.1', retention: 'last_200_stages_since_start',
        stations: [
          { station_ref: 'a1b2c3d4e5f6', state: 'synced', last_error: null, loaded: true, managed_lock: true, worker_active: false, pending_request: false, reconciliation_targets: 0 },
          { station_ref: '0f9e8d7c6b5a', state: 'error', last_error: 'authentication_failed', loaded: true, managed_lock: true, worker_active: true, pending_request: true, reconciliation_targets: 3 },
        ],
        recent: [
          { at: '2026-09-27T10:20:00Z', station_ref: 'a1b2c3d4e5f6', step: 'complete', outcome: 'succeeded', error: null, status_code: null, sub_status: null },
          { at: '2026-09-27T10:12:00Z', station_ref: '0f9e8d7c6b5a', step: 'inventory', outcome: 'failed', error: 'authentication_failed', status_code: 4, sub_status: 'unauthorized' },
        ],
        failures: { authentication_failed: 1 } } });
    }
    const audit = /^\/stations\/([^/]+)\/permission-audit$/.exec(p);
    if (audit) {
      return json(route, { ...head, audit: { station_id: audit[1], checked_at: T, device_writes: 0, complete: true, total_candidates: 4,
        counts: { matched: 2, drift: 1, unmanaged: 1, unverified: 0 },
        rows: [
          { user_id: 'p1', display_name: 'דנה לוי', employee_no: 'E-100', status: 'matched', differences: [], error: null },
          { user_id: 'p2', display_name: 'יוסי כהן', employee_no: 'E-101', status: 'drift', differences: ['cards', 'validity'], error: null },
          { user_id: 'p3', display_name: 'מיכל בר', employee_no: 'E-102', status: 'matched', differences: [], error: null },
          { user_id: null, display_name: null, employee_no: '9001', status: 'unmanaged', differences: [], error: null },
        ] } });
    }
    return fail(route, 404, 'not_found', 'לא נמצא (בדיקה).');
  });
  return mock;
}
