import { test, expect } from '@playwright/test';
import type { AlertsPage, AuditPage, FleetAlert, HealthSample, PolicyVersions, StatusStation, SyncConflict, SyncStatus } from '../src/api/access-status';
import {
  actionKey,
  age,
  alertKindKey,
  alertTone,
  appendAlerts,
  appendAudit,
  appendVersions,
  auditFields,
  auditResult,
  auditTarget,
  conflictKindKey,
  conflictWho,
  dailyHealth,
  driftTone,
  duration,
  errorKey,
  fieldFlags,
  fieldKey,
  fieldTypeKey,
  groupRule,
  headline,
  historyTone,
  clockTone,
  kpis,
  optionsLine,
  panelKind,
  POLICY_DEFAULT,
  POLICY_KEYS,
  policyValue,
  stationDot,
  streamTone,
  suppressionKey,
  syncPill,
  syncRows,
  versionActionKey,
  versionsLeft,
  whenOf,
  wordKey,
  zoneOfStation,
  STREAMS,
} from '../src/access-control/status-logic';
import {
  actionText,
  ageText,
  alertDetail,
  alertTitle,
  clockText,
  countsText,
  driftText,
  durationText,
  errorText,
  fieldText,
  modelLine,
  msText,
  secondsText,
  streamText,
  syncText,
  versionActionText,
  whenText,
  yesNo,
} from '../src/access-control/status-text';
import { st } from '../src/i18n/access-status';

// CR-036 S10: the pure logic and the words of the Settings page "בקרת כניסה". Node only: no browser, no backend. The clock is fixed
// (2026-09-27 13:29:30 in Jerusalem, UTC+03:00) so every "ago" below is exact.
const NOW = new Date('2026-09-27T10:29:30Z');
const JER = { kind: 'iana', name: 'Asia/Jerusalem' } as const;

test('a station dot is green only for a station that is online AND synced; an unknown state is never green', () => {
  expect(stationDot({ online: true, sync_state: 'synced' })).toBe('ok');
  expect(stationDot({ online: true, sync_state: 'pending' })).toBe('warn');
  expect(stationDot({ online: true, sync_state: 'syncing' })).toBe('warn');
  expect(stationDot({ online: true, sync_state: 'error' })).toBe('err');
  expect(stationDot({ online: true, sync_state: 'offline' })).toBe('off');
  expect(stationDot({ online: false, sync_state: 'synced' })).toBe('off');
  expect(stationDot({ online: true, sync_state: 'unknown' })).toBe('unk');
  expect(stationDot({ online: true, sync_state: 'something new' })).toBe('unk');
});

test('the sync pill: a kind and a word per state, an offline station says so first, any other value is "unknown"', () => {
  expect(syncPill('synced')).toEqual({ kind: 'live', word: 'synced' });
  expect(syncPill('pending')).toEqual({ kind: 'stale', word: 'pending' });
  expect(syncPill('syncing')).toEqual({ kind: 'recorded', word: 'syncing' });
  expect(syncPill('error')).toEqual({ kind: 'error', word: 'error' });
  expect(syncPill('conflict')).toEqual({ kind: 'error', word: 'conflict' });
  expect(syncPill('delete_pending')).toEqual({ kind: 'stale', word: 'delete_pending' });
  expect(syncPill('synced', false)).toEqual({ kind: 'offline', word: 'offline' });
  expect(syncPill('whatever')).toEqual({ kind: 'unknown', word: 'unknown' });
  expect(syncPill(null)).toEqual({ kind: 'unknown', word: 'unknown' });
  expect(syncText('synced')).toBe('מסונכרן');
  expect(syncText('delete_pending')).toBe('ממתין למחיקה');
});

test('age: the words of the status page, with the zone\'s own day boundaries', () => {
  const at = (iso: string) => age(iso, NOW, JER);
  expect(at('2026-09-27T10:29:10Z')).toEqual({ key: 'now' });
  expect(at('2026-09-27T10:28:30Z')).toEqual({ key: 'minute' });
  expect(at('2026-09-27T10:17:30Z')).toEqual({ key: 'minutes', n: 12 });
  expect(at('2026-09-27T08:29:30Z')).toEqual({ key: 'hours', n: 2 });
  expect(at('2026-09-27T03:00:00Z')).toEqual({ key: 'today', time: '06:00' }); // 7.5 h ago: the day's own time
  expect(at('2026-09-26T16:02:00Z')).toEqual({ key: 'yesterday', time: '19:02' });
  expect(at('2026-09-20T08:11:00Z')).toEqual({ key: 'date', date: '20.9', time: '11:11' });
  expect(at('2026-09-27T10:29:50Z')).toEqual({ key: 'now' }); // a clock a little ahead is "now", never a negative age
  expect(age(null, NOW, JER)).toEqual({ key: 'none' });
  expect(age('', NOW, JER)).toEqual({ key: 'none' });
  expect(age('2026-09-27T10:00:00', NOW, JER)).toEqual({ key: 'none' }); // no zone suffix: not an instant
  expect(age('nonsense', NOW, JER)).toEqual({ key: 'none' });
  // the zone decides the day: 22:30 UTC on the 26th is already the 27th (01:30) in Jerusalem, and still the 26th in UTC
  expect(age('2026-09-26T22:30:00Z', new Date('2026-09-27T10:29:30Z'), JER)).toEqual({ key: 'today', time: '01:30' });
  expect(age('2026-09-26T22:30:00Z', new Date('2026-09-27T10:29:30Z'), { kind: 'iana', name: 'UTC' })).toEqual({ key: 'yesterday', time: '22:30' });
});

test('whenOf names an instant against the calendar, forward as well as back', () => {
  expect(whenOf('2026-09-27T14:00:00Z', NOW, JER)).toEqual({ key: 'today', time: '17:00' });
  expect(whenOf('2026-09-28T03:00:00Z', NOW, JER)).toEqual({ key: 'tomorrow', time: '06:00' });
  expect(whenOf('2026-09-26T16:02:00Z', NOW, JER)).toEqual({ key: 'yesterday', time: '19:02' });
  expect(whenOf('2026-10-02T07:00:00Z', NOW, JER)).toEqual({ key: 'date', date: '2.10', time: '10:00' });
  expect(whenOf(null, NOW, JER)).toEqual({ key: 'none' });
  expect(whenOf('2026-09-28', NOW, JER)).toEqual({ key: 'none' });
});

test('duration: minutes below an hour (never zero), hours below a day, then days', () => {
  expect(duration(20)).toEqual({ key: 'minutes', n: 1 });
  expect(duration(720)).toEqual({ key: 'minutes', n: 12 });
  expect(duration(2100)).toEqual({ key: 'minutes', n: 35 });
  expect(duration(55_200)).toEqual({ key: 'hours', n: 15 });
  expect(duration(200_000)).toEqual({ key: 'days', n: 2 });
  expect(duration(null)).toBeNull();
  expect(duration(-5)).toBeNull();
});

test('the page headline: the version, whether the integration is connected, and when it was last asked', () => {
  expect(headline({ wiskey_version: '4.2.0', connected: true, fetched_at: '2026-09-27T10:29:10Z' }, NOW, JER)).toEqual({ version: '4.2.0', connected: true, checked: { key: 'now' } });
  expect(headline({ wiskey_version: '', connected: false, fetched_at: null }, NOW, JER)).toEqual({ version: null, connected: false, checked: { key: 'none' } });
  expect(headline(null, NOW, JER)).toEqual({ version: null, connected: null, checked: { key: 'none' } });
  expect(headline({ wiskey_version: '4.2.0', connected: 'yes' as unknown as boolean }, NOW, JER).connected).toBeNull();
});

const station = (id: string, online: boolean, sync_state = 'synced', extra: Partial<StatusStation> = {}): StatusStation => ({ id, name: id, online, call_state: 'idle', sync_state, last_seen: null, zone: null, technical: null, errors: null, ...extra });
const zeroOps = { pending: 0, failed: 0, verified: 0, settled: 0 };
const syncStatus = (rows: Array<Partial<SyncStatus['stations'][number]> & { station_id: string }>): SyncStatus => ({
  stations: rows.map((r) => ({ name: null, sync_state: 'synced', reconciled_at: null, operations: zeroOps, pending_users: 0, managed_users: 0, revocations_pending: 0, card_removals_pending: 0, pin_removals_pending: 0, deletions_pending: 0, last_error: null, ...r })),
  totals: { pending_users: rows.reduce((n, r) => n + (r.pending_users ?? 0), 0), managed_users: 0, revocations_pending: 0, card_removals_pending: 0, pin_removals_pending: 0, deletions_pending: 0, operations: zeroOps },
});

test('the four tiles: stations online of all, people waiting, conflicts (only when the caller sees them), the newest sync', () => {
  const stations = [station('a', true), station('b', true, 'pending'), station('c', false, 'offline')];
  const sync = syncStatus([
    { station_id: 'a', reconciled_at: '2026-09-27T08:11:00+00:00' },
    { station_id: 'b', reconciled_at: '2026-09-27T10:21:00+00:00', pending_users: 3 },
    { station_id: 'c', reconciled_at: '2026-09-26T19:00:00+00:00' },
  ]);
  const conflicts: SyncConflict[] = [{ kind: 'person', station_id: 'c', sync_state: 'error', last_error: 'device_unavailable', person: null }];
  expect(kpis(stations, sync, conflicts)).toEqual({ online: 2, total: 3, pending: 3, conflicts: 1, lastSync: '2026-09-27T10:21:00+00:00' });
  // a read that is not there is "not known", never zero
  expect(kpis(stations, null, null)).toEqual({ online: 2, total: 3, pending: null, conflicts: null, lastSync: null });
  expect(kpis(null, null, null)).toEqual({ online: 0, total: 0, pending: null, conflicts: null, lastSync: null });
  expect(kpis(stations, syncStatus([{ station_id: 'a', reconciled_at: 'not a time' }]), []).lastSync).toBeNull();
});

test('the sync table: counts only, removals summed, a zero stays a zero, the station\'s own name wins over the lookup', () => {
  const rows = syncRows(
    syncStatus([
      { station_id: 'entry-c', name: 'חניון', sync_state: 'offline', pending_users: 1, managed_users: 12, revocations_pending: 1, pin_removals_pending: 1, operations: { pending: 1, failed: 1, verified: 4, settled: 0 }, last_error: 'device_unavailable' },
      { station_id: 'entry-x', name: null, managed_users: null },
    ]),
    (id) => `תחנה ${id}`,
  );
  expect(rows[0]).toMatchObject({ id: 'entry-c', name: 'חניון', managed: 12, pending: 1, removals: 2, failed: 1, state: 'offline', error: 'device_unavailable' });
  expect(rows[1]).toMatchObject({ name: 'תחנה entry-x', managed: null, pending: 0, removals: 0, failed: 0 });
  expect(syncRows(null, () => '')).toEqual([]);
});

test('codes are looked up and an unknown one stays the code: errors, actions, fields, alert kinds, suppression reasons, versions', () => {
  expect(errorKey('device_unavailable')).toBe('err_device_unavailable');
  expect(errorKey('brand_new_code')).toBeNull();
  expect(errorText('revision_conflict')).toBe('התנגשות גרסה');
  expect(errorText('brand_new_code')).toBe('שגיאה (brand_new_code)');
  expect(errorText(null)).toBe('');
  expect(actionKey('users/update')).toBe('act_users_update');
  expect(actionKey('profiles/settings_update')).toBe('act_profiles_settings_update');
  expect(actionKey('x/y')).toBeNull();
  expect(actionText('users/create')).toBe('יצירת אדם');
  expect(actionText('x/y')).toBe('x/y'); // the technical truth, not an invented sentence
  expect(actionText(null)).toBe('');
  expect(fieldKey('valid_until')).toBe('fld_valid_until');
  expect(fieldText('valid_until')).toBe('תוקף');
  expect(fieldText('shoe_size')).toBe('shoe_size');
  expect(alertKindKey('sync_stalled')).toBe('alert_sync_stalled');
  expect(alertKindKey('unknown')).toBe('alert_other');
  expect(alertKindKey(null)).toBe('alert_other');
  expect(suppressionKey('network_work')).toBe('sup_network_work');
  expect(suppressionKey('unknown')).toBe('sup_other');
  expect(versionActionKey('bulk/group_policy')).toBe('ver_bulk_group_policy');
  expect(versionActionKey('something')).toBe('ver_other');
  expect(versionActionText('baseline')).toBe('בסיס');
  expect(versionActionText('something')).toBe('אחר');
  expect(conflictKindKey('revocation')).toBe('conflict_revocation');
  expect(conflictKindKey('mystery')).toBe('conflict_other');
});

const alert = (id: string, extra: Partial<FleetAlert> = {}): FleetAlert => ({ id, station_id: 'entry-c', station_name: 'חניון', kind: 'offline', severity: 'error', observed_since: null, observed_seconds: null, online: false, sync_state: 'offline', suppressed: false, suppression: null, ...extra });
const alertsPage = (items: FleetAlert[], extra: Partial<AlertsPage> = {}): AlertsPage => ({ items, total: items.length, active_count: items.length, suppressed_count: 0, offset: 0, limit: 50, next_offset: null, complete: true, thresholds_seconds: null, station_thresholds_seconds: null, generated_at: null, ...extra });

test('an alert: muted whatever its severity when suppressed, an unknown severity is a warning (never an error), the title names the station', () => {
  expect(alertTone({ severity: 'error', suppressed: false })).toBe('err');
  expect(alertTone({ severity: 'warning', suppressed: false })).toBe('warn');
  expect(alertTone({ severity: 'surprise', suppressed: false })).toBe('warn');
  expect(alertTone({ severity: 'error', suppressed: true })).toBe('muted');
  expect(alertTitle(alert('a', { station_name: 'לובי', kind: 'sync_stalled' }))).toBe('לובי: סנכרון תקוע');
  expect(alertTitle(alert('a', { station_name: null, station_id: 'entry-b', kind: 'clock_drift' }))).toBe('entry-b: סטיית שעון');
  expect(alertTitle(alert('a', { station_name: null, station_id: null, kind: 'mystery' }))).toBe('התרעה');
});

test('the alert detail line: since when and for how long; a muted alert says why and until when', () => {
  const offline = alert('entry-c/offline', { observed_since: '2026-09-26T19:10:55+00:00', observed_seconds: 55_200 });
  expect(alertDetail(offline, NOW, JER)).toBe('מאז אתמול 22:10 · 15 שע׳');
  const stalled = alert('entry-b/sync_stalled', { kind: 'sync_stalled', severity: 'warning', observed_since: '2026-09-27T09:55:00+00:00', observed_seconds: 2100 });
  expect(alertDetail(stalled, NOW, JER)).toBe('מאז לפני 35 דק׳'); // a recent start already says how long: no second number
  expect(alertDetail(alert('x', { observed_since: null, observed_seconds: 7200 }), NOW, JER)).toBe('2 שע׳'); // only a length is known
  const muted = alert('entry-a/clock_drift', {
    kind: 'clock_drift',
    severity: 'warning',
    suppressed: true,
    suppression: { kind: 'clock_drift', reason: 'investigating', until: '2026-09-28T03:00:00+00:00', created_at: '2026-09-26T08:00:00+00:00' },
  });
  expect(alertDetail(muted, NOW, JER)).toBe('מושתקת · בבדיקה · עד מחר 06:00');
  expect(alertDetail({ ...muted, suppression: { ...muted.suppression!, until: null }, observed_since: null }, NOW, JER)).toBe('מושתקת · בבדיקה');
  expect(alertDetail(alert('x'), NOW, JER)).toBe('');
});

test('paging: a page already shown is not repeated, and the counts and the cursor are the new page\'s', () => {
  const first = alertsPage([alert('a'), alert('b')], { next_offset: 2, total: 3, active_count: 3 });
  const second = alertsPage([alert('b'), alert('c')], { offset: 2, next_offset: null, total: 3, active_count: 3 });
  const merged = appendAlerts(first, second);
  expect(merged.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  expect(merged.next_offset).toBeNull();
  expect(appendAlerts(null, second)).toBe(second);

  const rec = (sequence: number) => ({ sequence, time: null, action: 'users/update', actor_name: null, fields: [], revision_before: null, revision_after: null, reason_code: null, stations: [], person: { id: null, display_name: null, employee_no: null } });
  const a1: AuditPage = { records: [rec(31), rec(30)], next_cursor: 30, total: 33, retention_days: 30 };
  const a2: AuditPage = { records: [rec(30), rec(29)], next_cursor: null, total: 33, retention_days: 30 };
  expect(appendAudit(a1, a2).records.map((r) => r.sequence)).toEqual([31, 30, 29]);
  expect(appendAudit(a1, a2).next_cursor).toBeNull();

  const v = (revision: number) => ({ revision, saved_at: null, action: 'system', origin: 'saved', field_changes: 0, group_changes: 0 });
  const v1: PolicyVersions = { records: [v(7), v(6)], total: 5, offset: 0, next_offset: 2, previous_offset: null, current_revision: 7, retained_from_revision: 1 };
  const v2: PolicyVersions = { records: [v(6), v(5)], total: 5, offset: 2, next_offset: null, previous_offset: 0, current_revision: 7, retained_from_revision: 1 };
  expect(appendVersions(v1, v2).records.map((r) => r.revision)).toEqual([7, 6, 5]);
  expect(versionsLeft(v1)).toBe(3);
  expect(versionsLeft(v2)).toBe(0);
  expect(versionsLeft(null)).toBe(0);
});

test('a conflict names the person as far as the server said, and nobody else', () => {
  expect(conflictWho({ person: { id: 'u7', display_name: 'אלי פרץ', employee_no: '1066' } })).toEqual({ kind: 'name', text: 'אלי פרץ' });
  expect(conflictWho({ person: { id: 'u7', display_name: null, employee_no: '1066' } })).toEqual({ kind: 'employee', text: '1066' });
  expect(conflictWho({ person: { id: 'u9', display_name: null, employee_no: null } })).toEqual({ kind: 'unnamed' });
  expect(conflictWho({ person: null })).toEqual({ kind: 'unnamed' });
});

test('an action of the intercom log: the person, else the stations touched (two and a count), else nothing; the result; the fields', () => {
  const blank = { id: null, display_name: null, employee_no: null };
  expect(auditTarget({ person: { id: 'u1', display_name: 'דנה כהן', employee_no: '1001' }, stations: ['a'] })).toEqual({ kind: 'person', name: 'דנה כהן', employee: '1001' });
  expect(auditTarget({ person: { id: 'u6', display_name: null, employee_no: '1090' }, stations: [] })).toEqual({ kind: 'person', name: null, employee: '1090' });
  expect(auditTarget({ person: blank, stations: ['a', 'b', 'c', 'd'] })).toEqual({ kind: 'stations', ids: ['a', 'b'], more: 2 });
  expect(auditTarget({ person: blank, stations: ['a'] })).toEqual({ kind: 'stations', ids: ['a'], more: 0 });
  expect(auditTarget({ person: blank, stations: [] })).toEqual({ kind: 'none' });
  expect(auditResult({ reason_code: null })).toEqual({ kind: 'done' });
  expect(auditResult({ reason_code: 'revision_conflict' })).toEqual({ kind: 'failed', code: 'revision_conflict' });
  expect(auditFields({ fields: ['valid_until', null, '', 'display_name'] })).toEqual(['valid_until', 'display_name']);
});

test('the station rule of a group: every station, none, not stated, or the named ones', () => {
  const known = ['a', 'b', 'c'];
  expect(groupRule({ station_ids: ['a', 'b', 'c'] }, known)).toEqual({ kind: 'all' });
  expect(groupRule({ station_ids: ['c', 'b', 'a', 'z'] }, known)).toEqual({ kind: 'all' });
  expect(groupRule({ station_ids: ['a', 'b'] }, known)).toEqual({ kind: 'stations', ids: ['a', 'b'] });
  expect(groupRule({ station_ids: [] }, known)).toEqual({ kind: 'none' });
  expect(groupRule({ station_ids: null }, known)).toEqual({ kind: 'unknown' });
  // with no stations known (the list did not load) a named list is shown as named - "all" is never guessed
  expect(groupRule({ station_ids: ['a'] }, [])).toEqual({ kind: 'stations', ids: ['a'] });
});

test('a profile field: its type word, its flags and its options on one line', () => {
  expect(fieldTypeKey('select')).toBe('ftype_select');
  expect(fieldTypeKey('unknown')).toBe('ftype_unknown');
  expect(fieldTypeKey(null)).toBe('ftype_unknown');
  expect(fieldFlags({ required: true, unique: false, depends_on: null, enabled: true })).toEqual(['required']);
  expect(fieldFlags({ required: false, unique: true, depends_on: { field_id: 'department', value: 'x' }, enabled: false })).toEqual(['unique', 'depends', 'disabled']);
  expect(fieldFlags({ required: false, unique: false, depends_on: null, enabled: true })).toEqual([]);
  expect(optionsLine(['a', 'b', 'c'])).toEqual({ shown: ['a', 'b', 'c'], more: 0 });
  expect(optionsLine(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual({ shown: ['a', 'b', 'c', 'd'], more: 2 });
  expect(optionsLine([])).toEqual({ shown: [], more: 0 });
});

test('health tones: a state the server named maps to a tone; an unknown word is "unknown", never "ok"', () => {
  expect(streamTone('connected')).toBe('ok');
  expect(streamTone('connecting')).toBe('warn');
  expect(streamTone('disconnected')).toBe('err');
  expect(streamTone('stopped')).toBe('off');
  expect(streamTone('new_state')).toBe('unk');
  expect(historyTone('recovered')).toBe('ok');
  expect(historyTone('incomplete')).toBe('err');
  expect(historyTone(null)).toBe('unk');
  expect(driftTone('within_tolerance')).toBe('ok');
  expect(driftTone('uncertain')).toBe('warn');
  expect(driftTone('repeated_behind')).toBe('err');
  expect(clockTone('ready')).toBe('ok');
  expect(clockTone('stale')).toBe('warn');
  expect(clockTone('unavailable')).toBe('err');
  expect(clockTone(undefined)).toBe('unk');
  expect(wordKey('stream_', 'connected', STREAMS)).toBe('stream_connected');
  expect(wordKey('stream_', 'wild', STREAMS)).toBe('stream_unknown');
  expect(streamText('connected')).toBe('מחובר');
  expect(streamText('wild')).toBe('לא ידוע');
  expect(driftText('ahead')).toBe('מקדים');
  expect(clockText('stale')).toBe('לא עדכני');
});

test('the seven-day strip: today last, the day of the zone, online share, mean poll time, and one tone', () => {
  const s = (at: string, online: boolean | null, poll_ms: number | null, sync: string | null = 'synced'): HealthSample => ({ at, online, poll_ms, sync, events: 'connected' });
  const records: HealthSample[] = [
    s('2026-09-21T06:00:00+00:00', true, 40),
    s('2026-09-21T18:00:00+00:00', true, 44),
    s('2026-09-23T06:00:00+00:00', false, null, 'unknown'),
    s('2026-09-23T18:00:00+00:00', true, 50),
    s('2026-09-24T06:00:00+00:00', false, null, 'unknown'),
    s('2026-09-25T06:00:00+00:00', true, 60, 'error'),
    s('2026-09-27T05:00:00+00:00', true, 30),
    s('2026-09-14T06:00:00+00:00', true, 99), // older than the seven days: not shown
  ];
  const days = dailyHealth(records, JER, NOW);
  expect(days.map((d) => d.date)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  expect(days[0]).toEqual({ date: '2026-09-21', samples: 2, onlinePct: 100, pollMs: 42, tone: 'ok' });
  expect(days[1]).toEqual({ date: '2026-09-22', samples: 0, onlinePct: null, pollMs: null, tone: 'none' });
  expect(days[2]).toMatchObject({ onlinePct: 50, pollMs: 50, tone: 'warn' }); // up half the day
  expect(days[3]).toMatchObject({ onlinePct: 0, pollMs: null, tone: 'err' });
  expect(days[4]).toMatchObject({ onlinePct: 100, tone: 'warn' }); // online all day, but its sync was in error
  expect(days[5].tone).toBe('none');
  expect(days[6]).toMatchObject({ onlinePct: 100, pollMs: 30, tone: 'ok' });
  expect(dailyHealth([], JER, NOW, 3).map((d) => d.tone)).toEqual(['none', 'none', 'none']);
  // a sample at 23:30 UTC belongs to the NEXT day in Jerusalem
  expect(dailyHealth([s('2026-09-26T23:30:00+00:00', true, 10)], JER, NOW, 2).map((d) => d.samples)).toEqual([0, 1]);
});

test('how a read that did not answer is spoken of: one panel per state, rate limits calm, an unknown failure an error', () => {
  expect(panelKind('ha_not_configured', 'ha_not_configured')).toBe('not_configured');
  expect(panelKind('connecting', null)).toBe('connecting');
  expect(panelKind('not_installed', 'not_installed')).toBe('not_installed');
  expect(panelKind('unsupported', 'not_listed')).toBe('unsupported');
  expect(panelKind('forbidden', null)).toBe('forbidden');
  expect(panelKind('error', 'rate_limited')).toBe('rate');
  expect(panelKind('error', 'busy')).toBe('rate');
  expect(panelKind('ha_unavailable', 'ha_unavailable')).toBe('unavailable');
  expect(panelKind('error', 'something')).toBe('unavailable');
  expect(panelKind('ready', null)).toBe('error'); // "ready" without a payload is a failure of the answer, not a state
});

test('the words: ages, whens, durations and the health card\'s numbers', () => {
  expect(ageText({ key: 'now' })).toBe('עכשיו');
  expect(ageText({ key: 'minute' })).toBe('לפני דקה');
  expect(ageText({ key: 'minutes', n: 12 })).toBe('לפני 12 דק׳');
  expect(ageText({ key: 'hours', n: 3 })).toBe('לפני 3 שע׳');
  expect(ageText({ key: 'today', time: '06:00' })).toBe('היום 06:00');
  expect(ageText({ key: 'yesterday', time: '19:02' })).toBe('אתמול 19:02');
  expect(ageText({ key: 'date', date: '20.9', time: '11:11' })).toBe('20.9 11:11');
  expect(ageText({ key: 'none' })).toBe('—');
  expect(whenText({ key: 'tomorrow', time: '06:00' })).toBe('מחר 06:00');
  expect(whenText({ key: 'none' })).toBe('—');
  expect(durationText({ key: 'minutes', n: 35 })).toBe('35 דק׳');
  expect(durationText({ key: 'hours', n: 15 })).toBe('15 שע׳');
  expect(durationText({ key: 'days', n: 1 })).toBe('יום');
  expect(durationText({ key: 'days', n: 3 })).toBe('3 ימים');
  expect(durationText(null)).toBe('');
  expect(modelLine('DS-KD8003', 'V2.2.62')).toBe('DS-KD8003 V2.2.62');
  expect(modelLine(null, 'V2.2.62')).toBe('V2.2.62');
  expect(modelLine(null, null)).toBe('');
  expect(secondsText(1)).toBe('1 שנ׳');
  expect(secondsText(-3.26)).toBe('-3.3 שנ׳');
  expect(secondsText(42.4)).toBe('42 שנ׳');
  expect(secondsText(null)).toBe('—');
  expect(msText(96.4)).toBe('96 מ״ש');
  expect(msText(null)).toBe('—');
  expect(yesNo(true)).toBe('כן');
  expect(yesNo(false)).toBe('לא');
  expect(yesNo(null)).toBe('—');
  expect(countsText({ synced: 38, pending: 2 }, (k) => k)).toBe('synced 38 · pending 2');
  expect(st('kpiOnlineOf', { total: 6 })).toBe('מתוך 6');
});

test('a station\'s zone: its own clock zone, else the installation\'s default, else UTC', () => {
  const stations = [station('a', true, 'synced', { zone: { kind: 'iana', name: 'Europe/Berlin' } }), station('b', true)];
  expect(zoneOfStation(stations, 'a', JER).name).toBe('Europe/Berlin');
  expect(zoneOfStation(stations, 'b', JER).name).toBe('Asia/Jerusalem');
  expect(zoneOfStation(stations, 'z', null).name).toBe('UTC');
  expect(zoneOfStation(null, null, null).name).toBe('UTC');
});

test('the four administrator settings: "true" / "false" (or a boolean), and a value the server cannot read is the SAFE choice it acts on', () => {
  expect(POLICY_KEYS).toEqual(['access.event_portrait_audit', 'access.event_portrait_sensitive', 'access.employee_no_sensitive', 'access.sync_errors_everyone']);
  expect(POLICY_DEFAULT).toEqual({ 'access.event_portrait_audit': true, 'access.event_portrait_sensitive': false, 'access.employee_no_sensitive': false, 'access.sync_errors_everyone': false });
  expect(policyValue({ 'access.employee_no_sensitive': 'true' }, 'access.employee_no_sensitive')).toBe(true);
  expect(policyValue({ 'access.employee_no_sensitive': 'false' }, 'access.employee_no_sensitive')).toBe(false);
  expect(policyValue({ 'access.event_portrait_audit': false }, 'access.event_portrait_audit')).toBe(false);
  expect(policyValue({ 'access.event_portrait_audit': true }, 'access.event_portrait_audit')).toBe(true);
  // unreadable or missing: the audit row stays on, a field stays sensitive, error texts stay hidden (what the server does)
  expect(policyValue({ 'access.event_portrait_audit': 'maybe' }, 'access.event_portrait_audit')).toBe(true);
  expect(policyValue({}, 'access.event_portrait_sensitive')).toBe(true);
  expect(policyValue(null, 'access.employee_no_sensitive')).toBe(true);
  expect(policyValue({ 'access.sync_errors_everyone': 1 }, 'access.sync_errors_everyone')).toBe(false);
  expect(policyValue(undefined, 'access.sync_errors_everyone')).toBe(false);
});
