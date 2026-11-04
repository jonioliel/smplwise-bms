/**
 * WisKey conflicts and fleet alerts from Arx (WISKEY-CONFLICTS-2400; backend routers/access_control_triage.py). The LISTS are the status
 * page's reads (access-status.ts `getConflicts` / `getAlerts`); this module adds the page's facts and the three steps that act:
 *   GET  access-control/triage                                      who may act, the notification setting, recent outcomes
 *   POST access-control/stations/{s}/conflicts/{p}/review           WisKey's preview of one conflict (a read of the station)
 *   POST access-control/triage/reviews/{id}/resolve                 the reviewed resolution, confirmed (sent once)
 *   POST access-control/stations/{s}/alerts/{kind}/{snooze|restore} a fleet alert snoozed / restored, confirmed (sent once)
 *   PUT  access-control/triage/settings                             new alerts -> the notification centre (system.configure)
 * The browser never names a WisKey command and never sees WisKey's review token. Nothing here retries, queues or runs by itself.
 *
 * The pure helpers below (outcome reading, what a conflict row may do, the wording keys) are what tests/unit-wiskey-triage-2400.spec.ts runs.
 */
import { ApiError, get, post, put } from './client';
import { commandId } from './request-id';
import { serverNow } from './intercom';
import type { FleetAlert, SyncConflict } from './access-status';

export const DIRECTIONS = ['central', 'device', 'delete'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const DURATIONS = [15, 60, 240, 1440, 10080] as const;
export const REASONS = ['planned_maintenance', 'network_work', 'investigating'] as const;
export type SnoozeReason = (typeof REASONS)[number];
export type AlertAction = 'snooze' | 'restore';

/** sending / sent: the screen's own while a request is out (or an attempt row with no outcome yet); acknowledged: WisKey accepted the
 * resolution and QUEUED the sync; completed: the snooze is saved; failed (WisKey refused), not_sent, unknown (sent, no clear answer). */
export type TriageStatus = 'sending' | 'sent' | 'acknowledged' | 'completed' | 'failed' | 'not_sent' | 'unknown' | 'stale';

export interface RecentOutcome {
  status: TriageStatus;
  at: string;
  code: string | null;
  direction?: Direction | null;
  action?: AlertAction | null;
}

export interface TriageView {
  may_resolve: boolean;
  may_act_alerts: boolean;
  feed: string;
  notify: { enabled: boolean; can_edit: boolean; last: { at: string | null; state: string; emitted: number; resolved: number } | null };
  review_ttl_s: number;
  durations: number[];
  reasons: string[];
  /** `<station>:<person>` / `<station>:<kind>` -> the newest outcome of the last 7 days (any operator); null without the right to see it. */
  recent: { conflicts: Record<string, RecentOutcome>; alerts: Record<string, RecentOutcome> } | null;
}

export interface RecordSide {
  present: boolean;
  display_name: string | null;
  user_type: string | null;
  validity: { timed: boolean | null; from: string | null; until: string | null; time_type: string | null };
  door_rights: number[];
  pin_configured: boolean | null;
  card_count: number;
  schedule_configured: boolean | null;
  privileged: boolean | null;
  other_credentials: boolean | null;
}

export interface Impact {
  user_id: string | null;
  station_id: string | null;
  revision: number | null;
  reviewed_at: string | null;
  absent: boolean;
  deletion_pending: boolean;
  active: boolean;
  central: RecordSide | null;
  device: RecordSide | null;
  differences: string[];
  plan: { person: string | null; pin: string | null; cards_add: number | null; cards_remove: number | null; cards_update: number | null } | null;
  unverified_fields: string[];
  affected_stations: string[];
  actions: Record<Direction, { allowed: boolean; reason: string | null }>;
  names_hidden: boolean;
}

export interface Review {
  review_id: string;
  expires_at: string;
  kind: 'person' | 'removal';
  station_id: string;
  person_id: string;
  impact: Impact;
}

export interface ResolveReply {
  review_id: string;
  station_id: string;
  person_id: string;
  direction: Direction;
  status: 'acknowledged';
  command_id: string;
  at: string | null;
  data: { revision?: number; station_states?: Record<string, string>; accepted?: boolean };
  affected_stations: string[];
}

export interface AlertReply {
  station_id: string;
  kind: string;
  action: AlertAction;
  status: 'completed';
  command_id: string;
  at: string | null;
  data: { revision: number };
}

/** What the screen shows after a step: the status, the server's / WisKey's code and the server's own sentence. */
export interface StepOutcome {
  status: TriageStatus;
  code: string | null;
  message: string;
  retry_after_s: number | null;
}

const TTL_MS = 15_000;
const envelope = () => ({ client_request_id: commandId(), expires_at: new Date(serverNow() + TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z') });
const enc = encodeURIComponent;

export const getTriage = () => get<TriageView>('access-control/triage');
export const postReview = (stationId: string, personId: string, kind: 'person' | 'removal') =>
  post<Review>(`access-control/stations/${enc(stationId)}/conflicts/${enc(personId)}/review`, { kind });
export const postResolve = (reviewId: string, direction: Direction) =>
  post<ResolveReply>(`access-control/triage/reviews/${enc(reviewId)}/resolve`, { direction, confirmed: true, ...envelope() });
export const postAlertAction = (stationId: string, kind: string, action: AlertAction, duration?: number, reason?: SnoozeReason) =>
  post<AlertReply>(`access-control/stations/${enc(stationId)}/alerts/${enc(kind)}/${action}`, {
    confirmed: true,
    ...(action === 'snooze' ? { duration_minutes: duration, reason } : {}),
    ...envelope(),
  });
export const putTriageSettings = (notify: boolean) => put<{ notify: TriageView['notify'] }>('access-control/triage/settings', { notify });

/** A failed step: the server's `details.outcome` (`not_sent` / `refused` / `unknown`); a 403 / 404 / 409 / 415 / 422 / 429 refusal before
 * sending is `not_sent`; WisKey's stale / revision refusal is `stale` (the record changed since the review: review again); a network
 * failure is `unknown` (the request may have reached the server). */
export function outcomeOf(err: unknown): StepOutcome {
  if (err instanceof ApiError) {
    const d = (err.body?.details ?? {}) as Record<string, unknown>;
    const raw = String(d.outcome ?? '');
    let status: TriageStatus =
      raw === 'refused' ? 'failed' : raw === 'not_sent' ? 'not_sent' : raw === 'unknown' ? 'unknown' : [403, 404, 409, 415, 422, 429].includes(err.status) ? 'not_sent' : 'unknown';
    if (err.code === 'triage_stale') status = 'stale';
    const retry = Number(d.retry_after_s);
    return {
      status,
      code: String(d.wiskey_code ?? err.code ?? '') || null,
      message: err.body?.user_message || '',
      retry_after_s: Number.isFinite(retry) && retry >= 0 ? retry : null,
    };
  }
  return { status: 'unknown', code: 'network', message: '', retry_after_s: null };
}

/** Which conflict rows can be reviewed here: a person's conflict / error on a station, and a removal (a deletion WisKey holds). A
 * revocation follows the person's own sync and has no resolution of its own. */
export function reviewKind(row: Pick<SyncConflict, 'kind'>): 'person' | 'removal' | null {
  return row.kind === 'person' ? 'person' : row.kind === 'removal' ? 'removal' : null;
}

/** The resolutions a review offers, in the order shown: a removal only continues the deletion; a person may keep the managed record or
 * adopt the device's. Each with WisKey's verdict. */
export function choices(review: Pick<Review, 'kind' | 'impact'>): { direction: Direction; allowed: boolean; reason: string | null }[] {
  const dirs: Direction[] = review.kind === 'removal' ? ['delete'] : ['central', 'device'];
  return dirs.map((d) => ({ direction: d, allowed: !!review.impact.actions?.[d]?.allowed, reason: review.impact.actions?.[d]?.reason ?? null }));
}

/** Seconds left on a review (negative once expired), against the server's clock. */
export function reviewSecondsLeft(review: Pick<Review, 'expires_at'>, now = serverNow()): number {
  return Math.floor((Date.parse(review.expires_at) - now) / 1000);
}

export const conflictKey = (row: Pick<SyncConflict, 'station_id' | 'person'>) => `${row.station_id}:${row.person?.id ?? ''}`;
export const alertKey = (a: Pick<FleetAlert, 'station_id' | 'kind'>) => `${a.station_id ?? ''}:${a.kind}`;

/** The alert actions offered for one row: snooze while active, restore while snoozed (WisKey has no acknowledge and no close). */
export function alertActions(a: Pick<FleetAlert, 'suppressed' | 'suppression' | 'kind'>): AlertAction[] {
  return a.suppressed ? (a.suppression?.kind ? ['restore'] : []) : ['snooze'];
}

/** The kind a restore addresses: the snooze's own kind (`maintenance` silences every kind of the station). */
export function restoreKind(a: Pick<FleetAlert, 'suppression' | 'kind'>): string {
  return a.suppression?.kind || a.kind;
}

/** Who may open the conflicts screen: the status page's reader (`access.admin.read`) or a station manager / system administrator, at any
 * scope (the server decides the rest: the lists need `access.admin.read`, acting needs the manage rule at installation scope). The same
 * three permissions are the deep-link map's `need` for the native screen (wiskey/deep-links.ts). */
export const TRIAGE_NEED: readonly string[] = ['access.admin.read', 'access.stations.manage', 'system.configure'];
export function mayOpenTriage(can: (p: string) => boolean): boolean {
  return TRIAGE_NEED.some((p) => can(p));
}

/** A validity bound as the station keeps it (its own local wall time, `YYYY-MM-DDTHH:MM:SS`, no zone): shown as written - date and
 * minutes, never converted (the device's clock is the reference). Anything else is shown as is; absent is '…'. */
export function deviceTime(v: string | null | undefined): string {
  if (!v) return '…';
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]} ${m[4]}:${m[5]}` : v;
}
