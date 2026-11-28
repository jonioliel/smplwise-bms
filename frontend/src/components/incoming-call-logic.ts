/**
 * WISKEY-INBOUND-CALLS-2382: the pure rules of the incoming-call banner (sw-incoming-call.ts) and the station call log
 * (wk-call-history.ts), with no browser in them so the unit specs pin them (tests/unit-incoming-calls.spec.ts).
 *
 * The server decides WHO sees a call and WHETHER it may ring (routers/intercom_calls.py: the banner setting, access.call on the
 * station's chain, the quiet hours); these helpers only decide what this screen shows of that answer: a hidden call stays
 * hidden on this device, a ringing call whose station drawer is already open is left to the drawer, the call this user answered
 * keeps its controls, and "answer" talks from here only when the station's media offers talk - otherwise it opens the station.
 */
import { ApiError } from '../api/client';
import { actionOutcome } from '../api/intercom';
import type { ActiveCalls, CallLogRow, IncomingCall } from '../api/intercom-calls';
import type { StationMedia } from '../api/station-media';
import type { RouteState } from '../router';
import { fill, type IncomingCallText } from '../i18n/incoming-calls';

/** The calls the banner shows, the first one in front: the calls this user answered first (their controls must stay at hand), then
 * the ringing ones newest first. A ringing call the user hid on this device, or whose station drawer is open right now, is left out -
 * unless this screen acted on it (`keep`: it talks on it, or "answer" opened its station with the reason talk is not offered here). */
export function visibleCalls(active: ActiveCalls | null, hidden: ReadonlySet<string>, route: Pick<RouteState, 'mode' | 'segments' | 'params'> | null, keep: ReadonlySet<string> = new Set()): IncomingCall[] {
  if (!active || !active.enabled) return [];
  const drawer = route && route.mode === 'wiskey' && route.segments[1] === 'devices' ? route.params.get('station') : null;
  const mine = active.calls.filter((c) => c.answered_by_me || keep.has(c.call_id));
  const ringing = active.calls.filter((c) => c.state === 'ringing' && !c.answered_by_me && !keep.has(c.call_id) && !hidden.has(c.call_id) && c.station_id !== drawer);
  return [...mine, ...ringing.sort((a, b) => (a.rang_at < b.rang_at ? 1 : a.rang_at > b.rang_at ? -1 : 0))];
}

/** Whether the ring tone plays now: the server allows it, a ringing call is shown, the user did not silence it on this screen. */
export function shouldRing(active: ActiveCalls | null, shown: readonly IncomingCall[], muted: boolean): boolean {
  return !!active && active.sound === 'ring' && !muted && shown.some((c) => c.state === 'ringing' && !c.answered_by_me);
}

export type TalkReason = 'off' | 'unsupported' | 'forbidden' | 'unknown';

/** Why this screen cannot talk to the station (null = it can): the station's media descriptor as the drawer reads it. */
export function talkReason(media: StationMedia | null | undefined): TalkReason | null {
  const t = media?.talk;
  if (t && t.available) return null;
  if (!media) return 'unknown'; // the descriptor could not be read: never guess that talk works
  if (media.mode === 'off' || media.state === 'off') return 'off';
  const r = t?.reason ?? media.reason;
  if (r === 'off' || r === 'unsupported' || r === 'forbidden') return r;
  return 'unknown';
}

export function talkReasonText(reason: TalkReason, t: IncomingCallText): string {
  return { off: t.banner.talkReasonOff, unsupported: t.banner.talkReasonUnsupported, forbidden: t.banner.talkReasonForbidden, unknown: t.banner.talkReasonUnknown }[reason];
}

/** What "answer" does: `talk` = answer the call and open the talk session from here; `drawer` = open the station, with the reason. */
export function answerPlan(media: StationMedia | null | undefined): { kind: 'talk' } | { kind: 'drawer'; reason: TalkReason } {
  const reason = talkReason(media);
  return reason === null ? { kind: 'talk' } : { kind: 'drawer', reason };
}

/** mm:ss (LTR digits) for the ring / call clock. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds since the ring (or since this user answered), moved on from the server's answer by this device's own clock. */
export function elapsedNow(call: IncomingCall, fetchedAtMs: number, nowMs: number): number {
  return call.elapsed_s + Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
}

/** How often the banner asks again: fast while a call is shown or the change socket is down, slow otherwise; once a minute while off. */
export function pollDelay(enabled: boolean, socketUp: boolean, anyCall: boolean): number {
  if (!enabled) return 60_000;
  if (anyCall) return 3_000;
  return socketUp ? 20_000 : 4_000;
}

/** The doors a banner offers (named when a station has more than one). */
export function doorLabel(lock: { physical_index: number; name: string | null }, count: number, t: IncomingCallText): string {
  return count > 1 ? fill(t.banner.doorNamed, { name: lock.name || String(lock.physical_index) }) : t.banner.door;
}

// ---------------------------------------------------------------- the call log

type LogTone = 'ok' | 'warn' | 'muted' | 'live';

/** One line of the call log: what happened, in one phrase, and its tone (missed = warn). Never a visitor: the station never says who. */
export function logLine(row: CallLogRow, t: IncomingCallText): { text: string; tone: LogTone } {
  const l = t.log;
  if (row.state === 'ringing') return { text: l.ringing, tone: 'live' };
  if (row.state === 'in_call') return { text: row.answered_via === 'arx' ? (row.answered_by_me ? l.answeredMe : fill(l.answeredBy, { name: row.answered_by_name || '' })) : l.inCall, tone: 'live' };
  switch (row.outcome) {
    case 'answered':
      if (row.answered_via === 'arx') return { text: row.answered_by_me ? l.answeredMe : fill(l.answeredBy, { name: row.answered_by_name || '' }), tone: 'ok' };
      return { text: l.answeredElsewhere, tone: 'ok' };
    case 'rejected':
      return { text: row.ended_by_name ? fill(l.rejectedBy, { name: row.ended_by_name }) : l.rejected, tone: 'muted' };
    case 'missed':
      return { text: l.missed, tone: 'warn' };
    default:
      return { text: l.unknown, tone: 'muted' };
  }
}

/** The call's length (answered calls only): from the answer to the end; null when not known. */
export function callSeconds(row: CallLogRow): number | null {
  if (!row.answered_at || !row.ended_at) return null;
  const s = (Date.parse(row.ended_at) - Date.parse(row.answered_at)) / 1000;
  return Number.isFinite(s) && s >= 0 ? Math.round(s) : null;
}

// ---------------------------------------------------------------- PHYSICAL-CONFIRM-2540: the front call and the door outcome

/** How long a call that moved to the front by itself (the front call ended, or was hidden) ignores taps on its answer / decline /
 * door controls: a tap aimed at the call that just left never lands on the one that took its place. "Next" (the operator's own
 * choice) has no settle time. */
export const FRONT_SETTLE_MS = 800;

/** Review SCR-11: the call in front is tracked by its id, not by its place in the list. It stays in front while it is shown, even
 * when a newer station rings (the newer one waits one tap away, "עוד 1"); only when it leaves does the first shown call take over. */
export function frontCall(shown: readonly IncomingCall[], frontId: string | null): IncomingCall | null {
  if (!shown.length) return null;
  return shown.find((c) => c.call_id === frontId) ?? shown[0];
}

/** Whether the front call takes taps now: not within FRONT_SETTLE_MS of moving to the front by itself (both on a monotonic clock). */
export function frontSettled(changedAt: number, now: number): boolean {
  return now - changedAt >= FRONT_SETTLE_MS;
}

/** As the stations screen (screens/wiskey-stations-logic.ts `UNKNOWN_HOLD_FALLBACK_MS`): the longest the backend holds a relay. */
export const DOOR_HOLD_FALLBACK_MS = 70_000;

/** Review SCR-12: how a banner door release that did not succeed is read - the rule of the stations screen
 * (screens/wiskey-stations-actions.ts `failure()` / `holdMs()`). Only a structured "not sent" / "refused" from the backend is a
 * failure ("the door was not opened: why"); anything else (a time-out, a proxy error, a dropped connection after the server forwarded
 * the release) is "unknown, check on site" in amber. After an unknown outcome, or "an earlier release of this door is still
 * unresolved", the door's button waits as long as the backend holds that relay. */
export function doorFailure(err: unknown): { unknown: boolean; holdMs: number } {
  const unknown = actionOutcome(err) === 'unknown';
  const inProgress = err instanceof ApiError && err.code === 'intercom_release_in_progress';
  if (!unknown && !inProgress) return { unknown, holdMs: 0 };
  const s = err instanceof ApiError ? Number(err.body?.details?.retry_after_s) : NaN;
  return { unknown, holdMs: Number.isFinite(s) && s >= 0 ? Math.ceil(s * 1000) : DOOR_HOLD_FALLBACK_MS };
}

/** FIX-WISKEY-2570 (review SCR-51): what a failed read of the call list means. A 403 (the call right was removed): every call it showed
 * ends here, talk sessions included. Anything else (no answer, a time-out, 5xx, another refusal): the last list stays with its buttons
 * (owner 26.11, LOWS-FRONTEND-2550 question 2 a - the server refuses an answer or a door for a call that ended, and a talk session keeps
 * its own server-side expiry) and the banner says that it shows the last state read. Nothing is sent again because of it. */
export function pollFailure(err: unknown): 'forbidden' | 'unread' {
  return err instanceof ApiError && err.status === 403 ? 'forbidden' : 'unread';
}
