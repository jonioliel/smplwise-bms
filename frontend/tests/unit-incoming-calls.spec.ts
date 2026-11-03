import { test, expect } from '@playwright/test';
import type { ActiveCalls, CallLogRow, IncomingCall } from '../src/api/intercom-calls';
import type { StationMedia } from '../src/api/station-media';
import { answerPlan, callSeconds, clockText, doorLabel, elapsedNow, logLine, pollDelay, shouldRing, talkReason, visibleCalls } from '../src/components/incoming-call-logic';
import { enIncomingCallText, heIncomingCallText } from '../src/i18n/incoming-calls';
import { parseRoute } from '../src/router';

// WISKEY-INBOUND-CALLS-2382: the pure rules of the incoming-call banner and the station call log (no browser, no backend).
//   npx playwright test -c playwright.unit.config.ts tests/unit-incoming-calls.spec.ts

const he = heIncomingCallText;

function call(over: Partial<IncomingCall> = {}): IncomingCall {
  return {
    call_id: 'c1', station_id: 'gate', station_name: 'שער ראשי', state: 'ringing', rang_at: '2026-11-03T08:00:00.000Z', answered_at: null, answered_by_me: false,
    elapsed_s: 5, online: true, has_camera: true, still: true, can_open_door: true, locks: [{ physical_index: 1, name: 'שער' }], ...over,
  };
}

function active(calls: IncomingCall[], over: Partial<ActiveCalls> = {}): ActiveCalls {
  return { enabled: true, mode: 'everyone', feed: 'ready', sound: 'ring', sound_reason: null, server_time_ms: 0, calls, ...over };
}

function media(over: Partial<StationMedia> = {}): StationMedia {
  return { station_id: 'gate', mode: 'video_talk', state: 'ready', reason: null, video: null, talk: { available: true, reason: null, codec: 'pcmu' }, listen: false, expires_at: null, ...over };
}

function row(over: Partial<CallLogRow> = {}): CallLogRow {
  return {
    id: 'r1', station_id: 'gate', station_name: 'שער ראשי', rang_at: '2026-11-03T08:00:00.000Z', observed: 'ringing', state: 'ended', outcome: 'answered', answered_at: '2026-11-03T08:00:04.000Z',
    answered_via: 'arx', answered_by_name: 'דנה', answered_by_me: false, ended_at: '2026-11-03T08:01:39.000Z', ended_by_name: null, door_opened_at: null, door_opened_by_name: null,
    updated_at: '2026-11-03T08:01:39.000Z', ...over,
  };
}

test.describe('which calls the banner shows', () => {
  test('nothing while the banner is off for this user, or before the first answer', () => {
    expect(visibleCalls(null, new Set(), null)).toEqual([]);
    expect(visibleCalls(active([call()], { enabled: false }), new Set(), null)).toEqual([]);
  });

  test('ringing calls newest first; my answered call in front of them', () => {
    const a = call({ call_id: 'a', rang_at: '2026-11-03T08:00:00.000Z' });
    const b = call({ call_id: 'b', station_id: 'lobby', rang_at: '2026-11-03T08:00:09.000Z' });
    const mine = call({ call_id: 'm', station_id: 'lab', state: 'in_call', answered_by_me: true, rang_at: '2026-11-03T07:59:00.000Z' });
    expect(visibleCalls(active([a, b, mine]), new Set(), null).map((c) => c.call_id)).toEqual(['m', 'b', 'a']);
  });

  test('a hidden call stays hidden; a call whose station drawer is open is left to the drawer', () => {
    const a = call({ call_id: 'a' });
    const b = call({ call_id: 'b', station_id: 'lobby' });
    expect(visibleCalls(active([a, b]), new Set(['a']), null).map((c) => c.call_id)).toEqual(['b']);
    const drawer = parseRoute('#/wiskey/devices?station=lobby');
    expect(visibleCalls(active([a, b]), new Set(), drawer).map((c) => c.call_id)).toEqual(['a']);
    // another screen: both
    expect(visibleCalls(active([a, b]), new Set(), parseRoute('#/explore/floors/f0')).length).toBe(2);
  });

  test('the call this screen is talking on stays, even hidden or with its drawer open', () => {
    const a = call({ call_id: 'a' });
    const drawer = parseRoute('#/wiskey/devices?station=gate');
    expect(visibleCalls(active([a]), new Set(['a']), drawer, new Set(['a'])).map((c) => c.call_id)).toEqual(['a']);
  });
});

test.describe('the ring', () => {
  test('rings only when the server allows it, a ringing call is shown and the user did not silence it', () => {
    const shown = [call()];
    expect(shouldRing(active(shown), shown, false)).toBe(true);
    expect(shouldRing(active(shown), shown, true)).toBe(false);
    expect(shouldRing(active(shown, { sound: 'silent', sound_reason: 'quiet_hours' }), shown, false)).toBe(false);
    expect(shouldRing(active(shown), [], false)).toBe(false);
    const inCall = [call({ state: 'in_call', answered_by_me: true })];
    expect(shouldRing(active(inCall), inCall, false)).toBe(false);
    expect(shouldRing(null, shown, false)).toBe(false);
  });
});

test.describe('answer: talk from here, or open the station with the reason', () => {
  test('talk is offered: answer and talk', () => {
    expect(answerPlan(media())).toEqual({ kind: 'talk' });
    expect(talkReason(media())).toBeNull();
  });

  test('talk is not offered: the drawer, with why', () => {
    expect(answerPlan(media({ mode: 'off', state: 'off', talk: null }))).toEqual({ kind: 'drawer', reason: 'off' });
    expect(answerPlan(media({ mode: 'video', talk: { available: false, reason: 'off' } }))).toEqual({ kind: 'drawer', reason: 'off' });
    expect(answerPlan(media({ talk: { available: false, reason: 'unsupported' } }))).toEqual({ kind: 'drawer', reason: 'unsupported' });
    expect(answerPlan(media({ talk: { available: false, reason: 'forbidden' } }))).toEqual({ kind: 'drawer', reason: 'forbidden' });
    expect(answerPlan(media({ state: 'unavailable', talk: { available: false, reason: 'busy_somewhere' } }))).toEqual({ kind: 'drawer', reason: 'unknown' });
    // the descriptor could not be read: never assume talk works
    expect(answerPlan(null)).toEqual({ kind: 'drawer', reason: 'unknown' });
  });
});

test.describe('clocks, polling and labels', () => {
  test('mm:ss and the clock moving on from the server answer', () => {
    expect(clockText(0)).toBe('00:00');
    expect(clockText(75)).toBe('01:15');
    expect(clockText(-3)).toBe('00:00');
    expect(elapsedNow(call({ elapsed_s: 5 }), 1_000, 4_500)).toBe(8);
    expect(elapsedNow(call({ elapsed_s: 5 }), 4_500, 1_000)).toBe(5);
  });

  test('fast while a call is shown or the socket is down; once a minute while off', () => {
    expect(pollDelay(false, true, false)).toBe(60_000);
    expect(pollDelay(true, true, true)).toBe(3_000);
    expect(pollDelay(true, false, false)).toBe(4_000);
    expect(pollDelay(true, true, false)).toBe(20_000);
  });

  test('door buttons are named only when the station has more than one', () => {
    expect(doorLabel({ physical_index: 1, name: 'שער' }, 1, he)).toBe('פתיחת דלת');
    expect(doorLabel({ physical_index: 2, name: 'מחסום' }, 2, he)).toBe('פתיחת מחסום');
    expect(doorLabel({ physical_index: 2, name: null }, 2, he)).toBe('פתיחת 2');
  });
});

test.describe('the call log line', () => {
  test('answered here, by me, elsewhere; declined; missed; unknown; live', () => {
    expect(logLine(row(), he)).toEqual({ text: 'נענתה ע״י דנה', tone: 'ok' });
    expect(logLine(row({ answered_by_me: true }), he).text).toBe('נענתה על ידך');
    expect(logLine(row({ answered_via: 'elsewhere', answered_by_name: null }), he).text).toBe('נענתה במקום אחר');
    expect(logLine(row({ outcome: 'rejected', answered_at: null, answered_via: null, ended_by_name: 'עומר' }), he)).toEqual({ text: 'נדחתה ע״י עומר', tone: 'muted' });
    expect(logLine(row({ outcome: 'rejected', answered_at: null, answered_via: null }), he).text).toBe('נדחתה');
    expect(logLine(row({ outcome: 'missed', answered_at: null, answered_via: null }), he)).toEqual({ text: 'לא נענתה', tone: 'warn' });
    expect(logLine(row({ outcome: 'unknown', answered_at: null, answered_via: null }), he).text).toBe('לא ידוע איך הסתיימה');
    expect(logLine(row({ state: 'ringing', outcome: null, ended_at: null, answered_at: null }), he)).toEqual({ text: 'מצלצלת עכשיו', tone: 'live' });
  });

  test('length from the answer to the end; none for an unanswered call', () => {
    expect(callSeconds(row())).toBe(95);
    expect(callSeconds(row({ answered_at: null }))).toBeNull();
    expect(callSeconds(row({ ended_at: null }))).toBeNull();
  });
});

test.describe('strings', () => {
  const flat = (o: unknown, p = ''): Record<string, string> =>
    Object.entries(o as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => (typeof v === 'string' ? { ...acc, [p + k]: v } : { ...acc, ...flat(v, `${p}${k}.`) }), {});

  test('Hebrew and English have the same keys, and no platform name appears on the screen', () => {
    const h = flat(heIncomingCallText);
    const e = flat(enIncomingCallText);
    expect(Object.keys(h).sort()).toEqual(Object.keys(e).sort());
    const banned = /home\s*assistant|wiskey|hikvision|isapi|\bHA\b/i;
    for (const [k, v] of Object.entries({ ...h, ...e })) expect(banned.test(v), k).toBe(false);
  });
});
