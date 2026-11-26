import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/api/client';
import type { IncomingCall } from '../src/api/intercom-calls';
import { physicalOutcome } from '../src/api/physical-outcome';
import { DOOR_HOLD_FALLBACK_MS, FRONT_SETTLE_MS, doorFailure, frontCall, frontSettled, visibleCalls } from '../src/components/incoming-call-logic';
import { continueAfter, needsConfirm, recordOutcome, worstOutcome } from '../src/screens/automation-device-test-logic';
import { enIncomingCallText, heIncomingCallText } from '../src/i18n/incoming-calls';

// PHYSICAL-CONFIRM-2540 (deep review 2520: SCR-11, SCR-12, SCR-14, SCR-15, SCR-16, SCR-18, SCR-43). Node only (playwright.unit.config.ts):
// the pure rules (how an unanswered physical command is read, which call is in front, the device-test outcomes) and source guards that
// the screens use them (every physical action behind its confirmation, focus on cancel, no auto-repeated Enter).
//   npx playwright test -c playwright.unit.config.ts tests/unit-physical-confirm-2540.spec.ts

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');
const apiErr = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message: code, retryable: false, correlation_id: '', details });

function call(over: Partial<IncomingCall> = {}): IncomingCall {
  return {
    call_id: 'c1', station_id: 'gate', station_name: 'שער ראשי', state: 'ringing', rang_at: '2026-11-03T08:00:00.000Z', answered_at: null, answered_by_me: false,
    elapsed_s: 5, online: true, has_camera: true, still: true, can_open_door: true, locks: [{ physical_index: 1, name: 'שער' }], ...over,
  };
}

test.describe('a physical command that did not answer with success', () => {
  test('a refusal before anything happened is a failure: 4xx, a structured not_sent / refused, the recorder refusing the account', () => {
    expect(physicalOutcome(apiErr(403, 'forbidden'))).toBe('refused');
    expect(physicalOutcome(apiErr(409, 'nvr_rejected'))).toBe('refused');
    expect(physicalOutcome(apiErr(409, 'nvr_writes_off'))).toBe('refused');
    expect(physicalOutcome(apiErr(422, 'validation'))).toBe('refused');
    expect(physicalOutcome(apiErr(503, 'source_forbidden'))).toBe('refused');
    expect(physicalOutcome(apiErr(502, 'x', { outcome: 'not_sent' }))).toBe('refused');
  });

  test('everything else is unknown - never "failed", never "done"', () => {
    expect(physicalOutcome(new TypeError('Failed to fetch'))).toBe('unknown');
    expect(physicalOutcome(apiErr(502, 'http_502'))).toBe('unknown');
    expect(physicalOutcome(apiErr(504, 'nvr_timeout'))).toBe('unknown');
    expect(physicalOutcome(apiErr(500, 'internal'))).toBe('unknown');
    expect(physicalOutcome(apiErr(409, 'x', { outcome: 'unknown' }))).toBe('unknown');
  });
});

test.describe('the incoming-call banner (SCR-11 / SCR-12)', () => {
  test('the front call is held by its id: a newer station ringing does not take its place', () => {
    const a = call({ call_id: 'a', station_id: 'gate', rang_at: '2026-11-03T08:00:00.000Z' });
    const b = call({ call_id: 'b', station_id: 'lobby', rang_at: '2026-11-03T08:00:09.000Z' });
    const before = visibleCalls({ enabled: true, mode: 'everyone', feed: 'ready', sound: 'ring', sound_reason: null, server_time_ms: 0, calls: [a] }, new Set(), null);
    expect(frontCall(before, null)?.call_id).toBe('a');
    const after = visibleCalls({ enabled: true, mode: 'everyone', feed: 'ready', sound: 'ring', sound_reason: null, server_time_ms: 0, calls: [a, b] }, new Set(), null);
    expect(after[0].call_id).toBe('b'); // the list is still newest first ...
    expect(frontCall(after, 'a')?.call_id).toBe('a'); // ... but the sheet keeps the call the operator is looking at
    expect(frontCall(after, null)?.call_id).toBe('b'); // a first look shows the newest, as before
  });

  test('when the front call leaves, the first shown one takes over and waits a moment before it takes taps', () => {
    const b = call({ call_id: 'b' });
    expect(frontCall([b], 'a')?.call_id).toBe('b');
    expect(frontCall([], 'a')).toBeNull();
    expect(frontSettled(1000, 1000)).toBe(false);
    expect(frontSettled(1000, 1000 + FRONT_SETTLE_MS - 1)).toBe(false);
    expect(frontSettled(1000, 1000 + FRONT_SETTLE_MS)).toBe(true);
    expect(frontSettled(0, Date.now())).toBe(true); // "next" (the operator's own choice) settles at once
  });

  test('a door release that did not succeed: only a structured not_sent / refused is "not opened"; the rest is unknown and holds the door', () => {
    expect(doorFailure(apiErr(409, 'intercom_station_offline', { outcome: 'not_sent' }))).toEqual({ unknown: false, holdMs: 0 });
    expect(doorFailure(apiErr(403, 'forbidden'))).toEqual({ unknown: false, holdMs: 0 });
    expect(doorFailure(apiErr(504, 'door_outcome_unknown', { outcome: 'unknown', retry_after_s: 12 }))).toEqual({ unknown: true, holdMs: 12_000 });
    expect(doorFailure(new TypeError('Failed to fetch'))).toEqual({ unknown: true, holdMs: DOOR_HOLD_FALLBACK_MS });
    expect(doorFailure(apiErr(502, 'http_502'))).toEqual({ unknown: true, holdMs: DOOR_HOLD_FALLBACK_MS });
    // an earlier release of this door still unresolved: a refusal, but the door waits as the backend says
    expect(doorFailure(apiErr(409, 'intercom_release_in_progress', { outcome: 'not_sent', retry_after_s: 8 }))).toEqual({ unknown: false, holdMs: 8_000 });
  });

  test('the unknown door outcome and the held button have their words in Hebrew and English (never "the door did not open")', () => {
    expect(heIncomingCallText.banner.doorUnknown).toContain('לא ידוע');
    expect(heIncomingCallText.banner.doorUnknown).not.toContain('לא נפתחה');
    expect(enIncomingCallText.banner.doorUnknown).toMatch(/not known/);
    expect(enIncomingCallText.banner.doorUnknown).not.toMatch(/did not open/);
    expect(heIncomingCallText.banner.doorHeld).toBeTruthy();
    expect(enIncomingCallText.banner.doorHeld).toMatch(/[a-z]/);
  });

  test('source: the banner reads the outcome through doorFailure, has its own busy state per door and scopes the door question to its call', () => {
    const s = src('components/sw-incoming-call.ts');
    const open = s.slice(s.indexOf('protected async openDoor('), s.indexOf('protected hold('));
    expect(open).toContain('doorFailure(err)');
    expect(open).toContain('t.banner.doorUnknown');
    expect(open).toMatch(/if \(this\.doorSending\.has\(key\) \|\| this\.isHeld\(key\)\) return;/);
    expect(open).not.toContain('setBusy('); // the release never wipes an answer in flight
    expect(s).not.toMatch(/\?disabled=\$\{sending \|\| !!this\.doorAsk\}/); // another call's question no longer disables these doors
    expect(s).not.toMatch(/shown\[Math\.min\(this\.front/);
    expect(src('home/sw-home-call.ts')).not.toMatch(/shown\[Math\.min\(this\.front/);
    expect(src('home/sw-home-call.ts')).toContain('frontCall(shown, this.frontId)');
  });
});

test.describe('the automation device test (SCR-18)', () => {
  test('a record is done only when confirmed; failed / denied are errors; unknown or still pending is unknown', () => {
    expect(recordOutcome({ status: 'confirmed' })).toBe('done');
    expect(recordOutcome({ status: 'failed' })).toBe('error');
    expect(recordOutcome({ status: 'denied' })).toBe('error');
    expect(recordOutcome({ status: 'unknown' })).toBe('unknown');
    expect(recordOutcome({ status: 'pending' })).toBe('unknown');
  });

  test('a step is its worst device; a refused device stops the step; only a sensitive step with devices asks', () => {
    expect(worstOutcome([])).toBe('done');
    expect(worstOutcome(['done', 'done'])).toBe('done');
    expect(worstOutcome(['done', 'unknown'])).toBe('unknown');
    expect(worstOutcome(['unknown', 'error', 'done'])).toBe('error');
    expect(continueAfter('done')).toBe(true);
    expect(continueAfter('unknown')).toBe(true);
    expect(continueAfter('error')).toBe(false);
    expect(needsConfirm({ sensitive: true, entity_ids: ['lock.front'] })).toBe(true);
    expect(needsConfirm({ sensitive: false, entity_ids: ['light.a'] })).toBe(false);
    expect(needsConfirm({ sensitive: true, entity_ids: [] })).toBe(false);
  });

  test('source: each record is followed, a sensitive step and a sensitive restore ask first (focus on cancel)', () => {
    const s = src('screens/automation-ext-dialogs.ts');
    expect(s).toContain('awaitAction(rec.id');
    expect(s).toContain('recordOutcome(rec)');
    const run = s.slice(s.indexOf('private async runStep('), s.indexOf('private async restore('));
    expect(run.indexOf('needsConfirm(s)')).toBeGreaterThan(0);
    expect(run.indexOf('confirmDialog(')).toBeLessThan(run.indexOf('this.sendOne('));
    expect(run).toContain('focusCancel: true');
    expect(run).not.toMatch(/st: 'done', note: tr\('הופעל'\)/); // no unconditional "done" any more
    const restore = s.slice(s.indexOf('private async restore('), s.indexOf('private async close('));
    expect(restore).toContain('confirmDialog(');
    expect(restore).not.toMatch(/this\.restored = true; this\.asking = false;\s*return true;/);
  });
});

test.describe('the NVR system card (SCR-14 / SCR-15)', () => {
  test('source: the output pulse runs only from a confirmation that names it, opens on cancel and goes to the confirmed recorder', () => {
    const s = src('screens/system-setup.ts');
    expect(s).toMatch(/data-nvr-pulse=\$\{o\.id\} @click=\$\{\(\) => void this\.pulse\(o\)\}/);
    expect(s).not.toMatch(/data-nvr-pulse=[^\n]*this\.sysApi\.pulseNvrOutput/);
    const pulse = s.slice(s.indexOf('private async pulse('), s.indexOf('/** One NVR system action'));
    expect(pulse).toContain('confirmDialog(');
    expect(pulse).toContain('focusCancel: true');
    expect(pulse).toContain('danger: true');
    expect(pulse).toMatch(/if \(!ok \|\| rid !== this\.sysRecorder\) return;/);
    expect(pulse).toContain('nvrSystemApi(rid).pulseNvrOutput(o.id)');
    // a late answer for another recorder is dropped
    const load = s.slice(s.indexOf('private async loadSystem('), s.indexOf('private recorderName('));
    expect(load).toMatch(/if \(rid !== this\.sysRecorder\) return;/);
    // an unknown outcome of a physical action is amber, through the shared rule
    expect(s).toContain("physical && physicalOutcome(err) === 'unknown'");
  });
});

test.describe('the shared confirmation and the map dialogs (SCR-16 / SCR-43)', () => {
  test('source: a physical confirmation can open on cancel; an auto-repeated Enter never answers', () => {
    const s = src('components/confirm-dialog.ts');
    expect(s).toContain('focusCancel?: boolean;');
    expect(s).toContain("this.options.focusCancel ? '[data-confirm-cancel]' : '[data-confirm-ok]'");
    const enter = s.slice(s.indexOf("} else if (e.key === 'Enter') {"), s.indexOf('const answer = enterAnswer'));
    expect(enter).toMatch(/if \(e\.repeat\) \{\s*e\.preventDefault\(\);\s*return;\s*\}/);
  });

  test('source: both map confirmations put cancel first, with autofocus', () => {
    const s = src('screens/explore-floor-map.ts');
    expect(s).toMatch(/<div slot="footer"><sw-button variant="ghost" autofocus data-action-confirm-cancel[^\n]*<sw-button variant="danger" data-action-confirm-run/);
    expect(s).toMatch(/<div slot="footer"><sw-button variant="ghost" autofocus data-room-confirm-cancel[^\n]*<sw-button variant="primary" data-room-confirm-run/);
  });
});
