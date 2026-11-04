/**
 * WISKEY-ACCESS-DIAG-2400: the pure part of the "אבחון הרשאות" screen (screens/wiskey-access-diag.ts) - the views and their route, the door
 * choices, the scenario's explanation lines, the comparison and quality texts, the time texts in the installation's zone. No DOM, no
 * network: tests/unit-wiskey-access-diag.spec.ts runs it in node.
 */
import type {
  CompareRow, DiagHome, DiagStation, GrantSide, LifeRow, QualityIssue, Relation, Scenario, ReviewStatus,
} from '../api/access-diag';
import type { DisplayZone } from '../api/intercom';
import { offsetAt, UTC_ZONE } from '../screens/wiskey-format';
import { dt, dtDyn, type DiagKey } from '../i18n/access-diag';

export const VIEWS = ['scenario', 'compare', 'reviews', 'quality', 'lifecycle', 'audit', 'sync'] as const;
export type DiagView = (typeof VIEWS)[number];

/** The view of the route (`?view=`); an unknown or absent value is the scenario. */
export function viewOf(params: URLSearchParams | null | undefined): DiagView {
  const v = params?.get('view') ?? '';
  return (VIEWS as readonly string[]).includes(v) ? (v as DiagView) : 'scenario';
}

export const DIAG_ROUTE = '/wiskey/access-diag';
export const diagHref = (view: DiagView): string => `#${DIAG_ROUTE}${view === 'scenario' ? '' : `?view=${view}`}`;

/** The features a view needs (GET /access-control/diag `features`); the server's names. */
export const VIEW_FEATURE: Record<DiagView, string> = {
  scenario: 'scenario', compare: 'compare', reviews: 'reviews', quality: 'quality', lifecycle: 'lifecycle', audit: 'permission_audit', sync: 'sync',
};
/** The views that show people (need `can.people`). */
export const PEOPLE_VIEWS: readonly DiagView[] = ['scenario', 'compare', 'reviews', 'quality', 'lifecycle', 'audit'];

/** Whether a view can be used: offered by the installed system (unknown = try) and, for a people view, the caller may see people. */
export function viewState(home: DiagHome | null, view: DiagView): 'ok' | 'unsupported' | 'people' {
  if (!home) return 'ok';
  if (home.features[VIEW_FEATURE[view] as keyof DiagHome['features']]?.available === false) return 'unsupported';
  if (PEOPLE_VIEWS.includes(view) && !home.can.people) return 'people';
  return 'ok';
}

// ---------------------------------------------------------------- doors

export interface DoorChoice {
  key: string;
  station_id: string;
  lock_id: 1 | 2;
  label: string;
  online: boolean;
}

export const doorKey = (stationId: string, lockId: number): string => `${stationId}:${lockId}`;

export function parseDoorKey(key: string): { station_id: string; lock_id: 1 | 2 } | null {
  const m = /^(.+):([12])$/.exec(key);
  return m ? { station_id: m[1], lock_id: Number(m[2]) as 1 | 2 } : null;
}

/** Every door of every station, in the stations' order: "<station> · <door name>" or "<station> · דלת <n>" (a single unnamed door: the
 * station name alone). */
export function doorChoices(stations: DiagStation[] | null | undefined): DoorChoice[] {
  const out: DoorChoice[] = [];
  for (const s of stations ?? []) {
    for (const d of s.doors) {
      const label = d.name ? dt('doorNamed', { station: s.name, door: d.name }) : s.doors.length === 1 ? s.name : dt('doorLabel', { station: s.name, n: d.lock_id });
      out.push({ key: doorKey(s.id, d.lock_id), station_id: s.id, lock_id: d.lock_id, label, online: s.online });
    }
  }
  return out;
}

export function doorLabel(stations: DiagStation[] | null | undefined, stationId: string | null, lockId: number | null): string {
  if (!stationId) return '—';
  return doorChoices(stations).find((c) => c.key === doorKey(stationId, lockId ?? 1))?.label ?? stationId;
}

// ---------------------------------------------------------------- time

/** `dd.mm.yyyy HH:MM` of an aware instant in `zone` (never a fixed offset); '' for anything else. */
export function instantText(iso: string | null | undefined, zone: DisplayZone | null = UTC_ZONE): string {
  if (!iso || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(iso)) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const local = new Date(ms + offsetAt(ms, zone ?? UTC_ZONE) * 1000).toISOString();
  return `${Number(local.slice(8, 10))}.${Number(local.slice(5, 7))}.${local.slice(0, 4)} ${local.slice(11, 16)}`;
}

/** The day part only (`dd.mm.yyyy`). */
export function dayText(iso: string | null | undefined, zone: DisplayZone | null = UTC_ZONE): string {
  return instantText(iso, zone).split(' ')[0] ?? '';
}

/** How long until an expiry, from WisKey's `seconds_remaining`: "היום", "בעוד N שעות", "בעוד N ימים", "לפני N ימים". */
export function remainingText(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '';
  if (seconds < 0) {
    const d = Math.floor(-seconds / 86_400);
    return d >= 1 ? dt('agoDays', { n: d }) : dt('today');
  }
  if (seconds < 86_400) {
    const h = Math.max(1, Math.round(seconds / 3600));
    return h >= 24 ? dt('inDays', { n: 1 }) : dt('inHours', { n: h });
  }
  return dt('inDays', { n: Math.round(seconds / 86_400) });
}

export function validityText(from: string | null | undefined, until: string | null | undefined, zone: DisplayZone | null): string {
  const f = dayText(from, zone);
  const u = dayText(until, zone);
  if (f && u) return dt('validityRange', { from: f, until: u });
  if (u) return dt('validityUntil', { t: u });
  if (f) return dt('validityFrom', { t: f });
  return dt('validityAlways');
}

// ---------------------------------------------------------------- the scenario's explanation

export type LineTone = 'ok' | 'bad' | 'warn' | 'info';
export interface Line {
  id: string;
  tone: LineTone;
  label: string;
  text: string;
}

export function sourceText(side: GrantSide | null | undefined): string {
  if (!side) return dt('src_unknown');
  if (side.source === 'inherited') return dt('src_inherited', { groups: side.groups.map((g) => g.name || g.id).join(', ') || '—' });
  return dtDyn(`src_${side.source}`, 'src_unknown');
}

/** The explanation of "can X open door Y": the answer's reason first (WisKey's), then each factor it weighed - where the grant comes
 * from (group / personal / none), the person's state and validity, the schedule, holidays (not computed by WisKey rc.10), the station and
 * the sync evidence. Each line is a fact from the answer; nothing is inferred about the physical door. */
export function scenarioLines(s: Scenario, station: { name: string; online: boolean } | null, zone: DisplayZone | null): Line[] {
  const reason = s.desired.reason;
  const lines: Line[] = [{ id: 'reason', tone: s.desired.allowed ? 'ok' : 'bad', label: dt('why'), text: dtDyn(`r_${reason}`, 'r_unknown') }];
  if (s.source) {
    const denied = s.source.source === 'personal_deny' || s.source.source === 'none';
    lines.push({ id: 'source', tone: s.source.granted ? 'ok' : denied ? 'bad' : 'warn', label: dt('group'), text: sourceText(s.source) });
  }
  const p = s.person;
  if (p) {
    const state = p.archived ? dt('person_archived') : p.active === false ? dt('person_inactive') : '';
    const validity = validityText(p.valid_from, p.valid_until, zone);
    const bad = reason === 'outside_validity' || reason === 'archived' || reason === 'inactive';
    lines.push({ id: 'validity', tone: bad ? 'bad' : 'info', label: dt('validity'), text: state ? `${state} · ${validity}` : validity });
  }
  lines.push({
    id: 'schedule', tone: reason === 'outside_schedule' ? 'bad' : 'info', label: dt('schedule'),
    text: dtDyn(`t_${s.desired.timing_mode}`, 't_unknown') + (s.desired.draft_ignored ? ` · ${dt('draftIgnored')}` : ''),
  });
  lines.push({ id: 'holidays', tone: 'info', label: dt('holidays'), text: dt('holidaysNote') });
  if (station) lines.push({ id: 'station', tone: station.online ? 'info' : 'warn', label: dt('station'), text: `${station.name} · ${station.online ? dt('stationOnline') : dt('stationOffline')}` });
  const sync = s.observed;
  const syncParts = [dtDyn(`sync_${sync.sync_state}`, 'sync_unknown')];
  if (!sync.revision_matches && sync.sync_state !== 'unknown') syncParts.push(dt('syncBehind'));
  if (sync.last_sync_at) syncParts.push(dt('lastSync', { t: instantText(sync.last_sync_at, zone) }));
  lines.push({ id: 'sync', tone: sync.sync_state === 'synced' && sync.revision_matches ? 'info' : 'warn', label: dt('sync'), text: syncParts.join(' · ') });
  const t = sync.timing;
  if (t.status !== 'unavailable' && t.checked_at && (t.valid_from || t.valid_until)) {
    const range = `${instantText(t.valid_from, zone) || '…'} – ${instantText(t.valid_until, zone) || '…'}`;
    lines.push({ id: 'evidence', tone: t.interval_contains_target === false ? 'warn' : 'info', label: dt('schedule'), text: dt('evidence', { t: instantText(t.checked_at, zone), range }) });
  }
  return lines;
}

// ---------------------------------------------------------------- comparisons, reviews, quality, audit

export function relationText(rel: Relation, left: string, right: string): string {
  if (rel === 'left_only') return dt('rel_left_only', { name: left });
  if (rel === 'right_only') return dt('rel_right_only', { name: right });
  return dtDyn(`rel_${rel}`, 'rel_unknown');
}

export function relationTone(rel: Relation): 'ok' | 'warn' | 'neutral' {
  return rel === 'shared' ? 'ok' : rel === 'neither' || rel === 'unknown' ? 'neutral' : 'warn';
}

/** Rows grouped by station (one heading per station, its doors under it), in the answer's order. */
export function rowsByStation(rows: CompareRow[]): { station_id: string; station_name: string; rows: CompareRow[] }[] {
  const out: { station_id: string; station_name: string; rows: CompareRow[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.station_id === r.station_id) last.rows.push(r);
    else out.push({ station_id: r.station_id, station_name: r.station_name || r.station_id, rows: [r] });
  }
  return out;
}

export const REVIEW_STATES: readonly (ReviewStatus | 'all')[] = ['all', 'pending', 'due', 'stale', 'followup', 'completed', 'archived'];

export function reviewTone(s: ReviewStatus): 'ok' | 'warn' | 'bad' | 'neutral' {
  return s === 'completed' ? 'ok' : s === 'due' || s === 'stale' ? 'bad' : s === 'pending' || s === 'followup' ? 'warn' : 'neutral';
}

export const CADENCES: readonly number[] = [30, 90, 180, 365];

/** The decision's reason as the server will accept it: one line (whitespace collapsed), 1..500 characters, no control characters. */
export function cleanReason(text: string): string | null {
  const one = text.split(/\s+/).filter(Boolean).join(' ');
  // eslint-disable-next-line no-control-regex
  if (!one || one.length > 500 || /[\u0000-\u001f]/.test(one)) return null;
  return one;
}

export function issueText(i: QualityIssue): string {
  const label = i.label || i.field_id || '—';
  if (i.code.startsWith('duplicate_profile')) return dt('c_duplicate_profile', { label });
  if (i.code === 'profile_required') return dt('c_profile_required', { label });
  if (i.code.startsWith('profile_')) return dt('c_profile', { label });
  return dtDyn(`c_${i.code}`, 'c_other', { label });
}

export function diffText(d: string): string {
  return dtDyn(`diff_${d}`, 'diff_other');
}

/** The lifecycle rows a window shows: expiring first (soonest first), then already expired (most recent first). */
export function expiringFirst(rows: LifeRow[]): LifeRow[] {
  const exp = rows.filter((r) => r.state === 'expiring').sort((a, b) => (a.seconds_remaining ?? 0) - (b.seconds_remaining ?? 0));
  const gone = rows.filter((r) => r.state !== 'expiring').sort((a, b) => (b.seconds_remaining ?? 0) - (a.seconds_remaining ?? 0));
  return [...exp, ...gone];
}

export const WINDOWS: readonly number[] = [7, 14, 30, 60, 90];

/** A known text key (for templates that pick one at run time). */
export const key = (k: string, fallback: DiagKey): string => dtDyn(k, fallback);
