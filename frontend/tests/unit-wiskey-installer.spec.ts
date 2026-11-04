import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/api/client';
import { diffRows, envelope, hasChanges, ntpErrors, outcomeOf, skewTone, validServer } from '../src/api/installer';
import { fill, installerText, lifecycleText, platformText, technicalText } from '../src/i18n/wiskey-installer';

// WISKEY-INSTALLER-NATIVE-2400: the pure logic and the words of the intercom installer tools - how a write's answer is read (completed /
// refused / not sent / unknown: never "done" without the server saying so), the diff a confirmation shows, the NTP rules the server
// applies again, the envelope (confirmed + typed phrase only when asked), and the Hebrew-only, no-"Home Assistant" text. Runs in Node:
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-installer.spec.ts

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const err = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message: 'm', retryable: false, correlation_id: 'c', details });

function leaves(o: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'string') out[prefix + k] = v;
    else if (v && typeof v === 'object') Object.assign(out, leaves(v, `${prefix}${k}.`));
  }
  return out;
}

test('an answer is read honestly: refused, not sent, unknown - never done', () => {
  expect(outcomeOf(err(502, 'installer_refused', { outcome: 'refused', wiskey_code: 'revision_conflict' }))).toMatchObject({ status: 'refused', code: 'revision_conflict' });
  expect(outcomeOf(err(409, 'typed_confirmation_required', { outcome: 'not_sent', expected: 'Main gate' }))).toMatchObject({ status: 'not_sent', expected: 'Main gate' });
  expect(outcomeOf(err(429, 'installer_cooldown', { outcome: 'not_sent', retry_after_s: 12.5 }))).toMatchObject({ status: 'not_sent', retryAfterS: 12.5 });
  expect(outcomeOf(err(504, 'installer_outcome_unknown', { outcome: 'unknown', wiskey_code: 'readback_mismatch' }))).toMatchObject({ status: 'unknown', code: 'readback_mismatch' });
  // a 403 before the body is a refusal before sending; a 500 without an outcome is unknown; a network failure is unknown
  expect(outcomeOf(err(403, 'forbidden')).status).toBe('not_sent');
  expect(outcomeOf(err(500, 'internal')).status).toBe('unknown');
  expect(outcomeOf(new TypeError('Failed to fetch'))).toMatchObject({ status: 'unknown', code: 'network' });
});

test('the diff marks only what changes, in the given order', () => {
  const rows = diffRows({ server: 'time.windows.com', port: 123, interval: 60 }, { interval: 30, server: 'time.windows.com', port: 123 }, ['server', 'port', 'interval']);
  expect(rows.map((r) => r.key)).toEqual(['server', 'port', 'interval']);
  expect(rows.map((r) => r.changed)).toEqual([false, false, true]);
  expect(hasChanges(rows)).toBe(true);
  expect(hasChanges(diffRows({ a: 1 }, { a: 1 }))).toBe(false);
  expect(diffRows(null, { a: 1 })[0]).toMatchObject({ before: undefined, changed: true });
});

test('the NTP rules are WisKey\'s own', () => {
  for (const ok of ['time.windows.com', 'pool.ntp.org', '192.0.2.10', 'ntp-1', 'a']) expect(validServer(ok), ok).toBe(true);
  for (const bad of ['', '1.2.3', '0.0.0.0', '224.0.0.1', '300.1.1.1', '-bad.com', 'bad-.com', 'a'.repeat(65), 'a..b', 'with space']) expect(validServer(bad), bad).toBe(false);
  expect(ntpErrors({ server: 'pool.ntp.org', port: 123, interval: 60 })).toEqual([]);
  expect(ntpErrors({ server: 'x y', port: 1, interval: 0 })).toEqual(['server', 'port', 'interval']);
  expect(ntpErrors({ server: 'ntp', port: 65536, interval: 10081 })).toEqual(['port', 'interval']);
  expect(ntpErrors({ server: 'ntp', port: 1.5, interval: 2 })).toEqual(['port']);
});

test('the skew tone follows WisKey\'s 5 s verification bound', () => {
  expect(skewTone(0.4)).toBe('ok');
  expect(skewTone(-5)).toBe('ok');
  expect(skewTone(-7)).toBe('warn');
  expect(skewTone(61)).toBe('err');
  expect(skewTone(null)).toBe('unknown');
});

test('the envelope confirms, and carries a typed phrase only when one is asked', () => {
  const plain = envelope();
  expect(plain.confirmed).toBe(true);
  expect(String(plain.client_request_id)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  expect(String(plain.expires_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const ahead = Date.parse(String(plain.expires_at)) - Date.now();
  expect(ahead).toBeGreaterThan(5_000);
  expect(ahead).toBeLessThanOrEqual(60_000);
  expect('typed_confirmation' in plain).toBe(false);
  expect(envelope('Main gate').typed_confirmation).toBe('Main gate');
});

test('the words: Hebrew, filled placeholders, no "Home Assistant"', () => {
  const all = { ...leaves(installerText), ...leaves(technicalText, 'technical.'), ...leaves(lifecycleText, 'lifecycle.'), ...leaves(platformText, 'platform.') };
  for (const [key, text] of Object.entries(all)) {
    expect(text, key).not.toMatch(/home\s*assistant/i);
    if (!key.startsWith('clock.modes.')) expect(text, key).toMatch(/[֐-׿]|^—$|^\{/);
  }
  expect(fill(installerText.clock.syncHeading, { name: 'Main gate' })).toBe('כתיבת הגדרות השעון לעמדה Main gate');
  for (const file of ['screens/system-intercom-installer.ts', 'screens/installer-clock.ts', 'components/wk-installer-confirm.ts', 'api/installer.ts', 'screens/installer-technical.ts', 'screens/installer-lifecycle.ts', 'screens/installer-platform.ts']) {
    expect(readFileSync(path.join(SRC, file), 'utf8'), file).not.toMatch(/home\s*assistant/i);
  }
});

test('a door edit sends only what changed, inside the advertised bounds; the relay needs the typed name', async () => {
  const { doorChanges, doorErrors, needsTyped } = await import('../src/api/installer');
  const before = { doorName: 'כניסה', openDuration: 5, relayReverseEnabled: false };
  expect(doorChanges(before, { ...before })).toEqual({});
  expect(doorChanges(before, { ...before, openDuration: 8 })).toEqual({ openDuration: 8 });
  const c = { doorName: { type: 'text' as const, min: 1, max: 4 }, openDuration: { type: 'integer' as const, min: 1, max: 30 }, relayReverseEnabled: { type: 'boolean' as const } };
  expect(doorErrors({ doorName: 'abcd', openDuration: 30, relayReverseEnabled: true }, c)).toEqual([]);
  expect(doorErrors({ doorName: 'abcde', openDuration: 31 }, c)).toEqual(['doorName', 'openDuration']);
  expect(doorErrors({ doorName: '', openDuration: NaN }, null)).toEqual(['doorName', 'openDuration']);
  expect(needsTyped({ openDuration: 8 }, ['relayReverseEnabled'])).toBe(false);
  expect(needsTyped({ relayReverseEnabled: true }, ['relayReverseEnabled'])).toBe(true);
});

test('the wizard input has closed keys and sends the password only when typed; a job has one next step', async () => {
  const { connectionInput, connectionErrors, nextAction, jobProgress } = await import('../src/api/installer');
  const form = { name: ' לובי ', host: 'lobby.local', username: 'admin', password: '', scheme: 'https', port: '80', verify_ssl: true, rtsp_port: '554' };
  const re = connectionInput(form, 'reconfigure');
  expect(re).toEqual({ name: 'לובי', host: 'lobby.local', username: 'admin', scheme: 'https', port: 80, verify_ssl: true, rtsp_port: 554 });
  expect(connectionErrors(re, 'reconfigure')).toEqual([]);
  const add = connectionInput(form, 'user');
  expect(add.password).toBe('');
  expect(connectionErrors(add, 'user')).toEqual(['password']);
  expect(connectionErrors(connectionInput({ ...form, host: 'a b', port: '0' }, 'reconfigure'), 'reconfigure')).toEqual(['host', 'port']);
  const job = (state: string) => ({ state }) as never;
  expect(nextAction(job('prepared'))).toBe('apply');
  expect(nextAction(job('applied'))).toBe('verify');
  expect(nextAction(job('verified'))).toBe('remove');
  expect(nextAction(job('removed'))).toBeNull();
  expect(jobProgress('removed')).toBe(3);
  expect(jobProgress('expired')).toBe(-1);
});

test('the platform rules: maintenance window, webhook, and a per-station result that never hides a failure', async () => {
  const { windowErrors, webhookErrors, receiptSummary } = await import('../src/api/installer');
  const w = { enabled: true, days: [0, 1], start: '02:00', end: '05:00', timezone: 'Asia/Jerusalem' };
  expect(windowErrors(w)).toEqual([]);
  expect(windowErrors({ ...w, days: [] })).toEqual(['days']);
  expect(windowErrors({ ...w, start: '06:00' })).toEqual(['end']);
  expect(windowErrors({ ...w, start: '25:00', timezone: 'bad zone' })).toEqual(['start', 'timezone']);
  const hook = { enabled: true, url: 'https://hooks.example/arx', kinds: ['access_event'] };
  expect(webhookErrors(hook)).toEqual([]);
  expect(webhookErrors({ ...hook, url: 'http://hooks.example/arx' })).toEqual(['url']);
  expect(webhookErrors({ ...hook, url: 'https://u:p@hooks.example/arx' })).toEqual(['url']);
  expect(webhookErrors({ ...hook, url: 'https://hooks.example/arx?token=1' })).toEqual(['url']);
  expect(webhookErrors({ ...hook, url: 'https://hooks.example:9443/arx' })).toEqual(['url']);
  expect(webhookErrors({ ...hook, kinds: [] })).toEqual(['kinds']);
  expect(webhookErrors({ enabled: false, url: '', kinds: [] })).toEqual([]);
  const r = (state: 'verified' | 'failed') => ({ at: null, station_id: 'x', state, code: null });
  expect(receiptSummary([r('verified'), r('failed')])).toEqual({ verified: 1, failed: 1, partial: true });
  expect(receiptSummary([r('verified')])).toEqual({ verified: 1, failed: 0, partial: false });
});
