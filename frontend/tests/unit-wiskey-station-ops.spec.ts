import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import {
  STATION_OPS,
  authNow,
  authToShow,
  bulkTargets,
  outcomeOf,
  reasonText,
  runOnStations,
  runOp,
  statusText,
  statusTone,
  stepText,
  tally,
  type MaintenanceView,
  type OpReply,
  type StationOp,
} from '../src/api/station-ops';
import { enStationOpsText, heStationOpsText } from '../src/i18n/wiskey-station-ops';

// WISKEY-STATION-OPS-2390: the pure logic and the words of a station's maintenance (sync now, rescan, health refresh, clock check):
// how an answer is read (acknowledged / completed / failed / not sent / unknown - never "done" without the server saying so), the list
// action's loop (once per station, one after the other, a failure never stops the rest and is never repeated), the stations it goes
// to, and the sign-in failure line. Runs in Node (no page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-station-ops.spec.ts

const he = heStationOpsText;
const err = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message: 'x', retryable: false, correlation_id: 'c', details });

function leaves(o: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'string') out[prefix + k] = v;
    else if (v && typeof v === 'object') Object.assign(out, leaves(v, `${prefix}${k}.`));
  }
  return out;
}

test('both languages have the same words and placeholders, and no text names the platform', () => {
  const h = leaves(heStationOpsText);
  const e = leaves(enStationOpsText);
  expect(Object.keys(e).sort()).toEqual(Object.keys(h).sort());
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of Object.keys(h)) {
    expect(h[k].trim().length, k).toBeGreaterThan(0);
    expect(ph(e[k]), k).toBe(ph(h[k]));
  }
  const all = [...Object.values(h), ...Object.values(e)].join(' ');
  expect(all).not.toMatch(/home\s*assistant|wiskey|hikvision|\bHA\b|add-on|ingress|supervisor/i);
  for (const op of STATION_OPS) {
    expect(he.actions[op]).toBeTruthy();
    expect(he.confirm[op].one).toContain('{name}');
  }
  expect(he.actions.sync).toBe('סנכרן עכשיו');
  expect(he.actions.rescan).toBe('סריקה מחדש');
});

test('a server error is read by its outcome; refusals before sending are not_sent; a lost connection is unknown', () => {
  expect(outcomeOf(err(502, 'station_ops_failed', { outcome: 'refused', wiskey_code: 'authentication_failed' }), 's', 'rescan')).toMatchObject({ status: 'failed', code: 'authentication_failed' });
  expect(outcomeOf(err(504, 'station_ops_outcome_unknown', { outcome: 'unknown', wiskey_code: 'timeout' }), 's', 'sync')).toMatchObject({ status: 'unknown', code: 'timeout' });
  expect(outcomeOf(err(429, 'station_ops_cooldown', { outcome: 'not_sent', retry_after_s: 12.5 }), 's', 'sync')).toMatchObject({ status: 'not_sent', code: 'station_ops_cooldown', retry_after_s: 12.5 });
  expect(outcomeOf(err(403, 'forbidden'), 's', 'sync').status).toBe('not_sent');
  expect(outcomeOf(err(404, 'intercom_station_not_found'), 's', 'sync').status).toBe('not_sent');
  expect(outcomeOf(err(500, 'http_error'), 's', 'sync').status).toBe('unknown');
  expect(outcomeOf(new TypeError('fetch failed'), 's', 'sync')).toMatchObject({ status: 'unknown', code: 'network' });
});

test('a success is exactly what the server said: acknowledged for a sync, completed for the reads', async () => {
  const ok = (status: 'acknowledged' | 'completed') => async (id: string, action: StationOp): Promise<OpReply> => ({ station_id: id, action, status, command_id: 'c1', at: null, data: { accepted: true } });
  expect(await runOp('a', 'sync', ok('acknowledged'))).toMatchObject({ status: 'acknowledged', code: null, data: { accepted: true } });
  expect(await runOp('a', 'clock_refresh', ok('completed'))).toMatchObject({ status: 'completed' });
});

test('the list action sends once per station, in order, a failure does not stop the rest and nothing is repeated', async () => {
  const calls: string[] = [];
  const waits: number[] = [];
  const send = async (id: string, action: StationOp): Promise<OpReply> => {
    calls.push(`${id}:${action}`);
    if (id === 'b') throw err(502, 'station_ops_failed', { outcome: 'refused', wiskey_code: 'device_busy' });
    if (id === 'c') throw err(504, 'station_ops_outcome_unknown', { outcome: 'unknown' });
    return { station_id: id, action, status: 'acknowledged', command_id: 'x', at: null, data: { accepted: true } };
  };
  const seen: string[] = [];
  const out = await runOnStations(['a', 'b', 'c', 'd'], 'sync', (o, i) => seen.push(`${i}:${o.station_id}:${o.status}`), send, 250, async (ms) => {
    waits.push(ms);
  });
  expect(calls).toEqual(['a:sync', 'b:sync', 'c:sync', 'd:sync']);
  expect(seen).toEqual(['0:a:acknowledged', '1:b:failed', '2:c:unknown', '3:d:acknowledged']);
  expect(waits).toEqual([250, 250, 250]);
  expect(tally(out)).toEqual({ ok: 2, failed: 1, not_sent: 0, unknown: 1 });
});

test('device reads leave offline stations out; a sync may still be queued for them', () => {
  const st = [
    { id: 'a', online: true },
    { id: 'b', online: false },
    { id: 'c', online: true },
  ];
  const chosen = new Set(['a', 'b']);
  expect(bulkTargets(st, chosen, 'sync')).toEqual(['a', 'b']);
  expect(bulkTargets(st, chosen, 'rescan')).toEqual(['a']);
  expect(bulkTargets(st, chosen, 'health_refresh')).toEqual(['a']);
  expect(bulkTargets(st, new Set(), 'sync')).toEqual([]);
});

test('the result words: failed and not sent carry the reason; an unknown code is shown as the code', () => {
  expect(statusText('failed', 'authentication_failed', he)).toBe('נכשל: העמדה דחתה את פרטי ההתחברות');
  expect(statusText('not_sent', 'station_ops_cooldown', he)).toBe('לא נשלח: נשלח לפני רגע');
  expect(statusText('acknowledged', null, he)).toBe('התקבל - הסנכרון בתור');
  expect(statusText('completed', null, he)).toBe('הושלם');
  expect(statusText('unknown', 'timeout', he)).toContain('ייתכן שבוצע');
  expect(reasonText('weird_new_code', he)).toBe('weird_new_code');
  expect(statusTone('completed')).toBe('ok');
  expect(statusTone('failed')).toBe('err');
  expect(statusTone('unknown')).toBe('warn');
  expect(stepText('inventory', he)).toBe('קריאת משתמשים מהעמדה');
  expect(stepText('brand_new_step', he)).toBe('שלב אחר');
});

test('the sign-in failure shown is the newer of the memo and the report; "now" lists what fails at the moment', () => {
  const base = {
    station_id: 's', online: true, feed: 'ready', health_hidden: false, actions: {} as MaintenanceView['actions'], last_runs: null,
    technical: { reconciled_at: null, scanned_at: null, scanning: false, last_error: null, scan_error: null, event_status: { stream: 'authentication_failed', history: null, last_frame_at: null }, clock: null, last_poll_ms: null },
  };
  const memo = { source: 'sync', step: 'identity', at: '2026-11-03T05:10:00+00:00', status_code: 4, sub_status: null };
  const report = { source: 'sync', step: 'inventory', at: '2026-11-03T06:41:00+00:00', status_code: 4, sub_status: 'unauthorized' };
  const auth = { last_failure: report, retained: 2, steps: {}, sync_now: true, event_stream_now: false, event_history_now: false, last_sync_ok_at: null, retention: null };
  const v = { ...base, report: { state: 'ready', fresh: true, fetched_at: null, last_error: null, health: null, auth }, auth_seen: memo } as MaintenanceView;
  expect(authToShow(v)?.step).toBe('inventory');
  expect(authToShow({ ...v, report: null } as MaintenanceView)?.step).toBe('identity');
  expect(authToShow({ ...v, auth_seen: null, report: null } as MaintenanceView)).toBeNull();
  expect(authNow(v, he)).toEqual(['סנכרון', 'זרם האירועים']);
});
