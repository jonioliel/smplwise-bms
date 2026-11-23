import { test, expect } from '@playwright/test';
import { CD_KEYS, CD_TABLES, cdt } from '../src/i18n/camera-discovery';
import {
  addFailureText,
  addSummary,
  authState,
  cidrSize,
  clockNote,
  defaultName,
  discoveryErrorText,
  identifyBlock,
  identifySummary,
  identifyTargets,
  mergeDevices,
  needsH265Note,
  offersRecorder,
  pageSize,
  pageSlice,
  pairKey,
  profileLabel,
  progressPct,
  rangeCheck,
  readyToAdd,
  retryAllowed,
  rowClass,
  rowMark,
  runningScan,
  selectable,
  streamsLine,
  suggestedPair,
} from '../src/screens/camera-discovery-logic';
import type { FoundDevice, MediaProfile } from '../src/api/camera-discovery';
import { ApiError } from '../src/api/client';
import { ltrIsolate } from '../src/i18n/bidi';

// ONVIF-UI-2500: the pure rules of "חיפוש מצלמות ברשת" - the words (he / en), the range check (Q56: up to 1,024 addresses), the kinds and
// marks of a found device (Q58 behind the recorder / already added: never selectable; Q59 a recorder offers the recorder wizard), the
// one-attempt rule (Q57), the streams, the default name, the refusal words and the pages (control screens never scroll).
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-camera-discovery-2500.spec.ts

const prof = (token: string, width: number, height: number, codec: MediaProfile['codec'] = 'h264', stream: MediaProfile['stream'] = 'ok'): MediaProfile => ({
  token, name: token, codec, width, height, fps: 25, stream, uri_masked: stream === 'ok' ? `rtsp://192.0.2.9/${token}` : null,
});

function dev(over: Partial<FoundDevice> = {}): FoundDevice {
  return {
    id: 'd1', address: '192.0.2.21', port: 80, engines: ['unicast'], kind: 'camera', known: 'none', addable: true, manufacturer: null, model: null,
    name: null, firmware: null, clock_offset_s: 0, auth: 'not_tried', has_service: true, media: 'none', profiles: [], suggested: { main: null, sub: null },
    snapshot: false, ...over,
  };
}

const identified = (over: Partial<FoundDevice> = {}) =>
  dev({
    auth: 'ok', manufacturer: 'Vantis', model: 'DC-4K21', media: 'media2',
    profiles: [prof('p0', 2688, 1520, 'h265'), prof('p1', 1920, 1080), prof('p2', 640, 360)], suggested: { main: 'p0', sub: 'p2' }, ...over,
  });

const err = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message: 'server text', retryable: false, correlation_id: 'x', details });

test('every key exists in he and en, non-empty, with the same placeholders', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const k of CD_KEYS) {
      const v = CD_TABLES[lang][k];
      expect(typeof v === 'string' && v.trim().length > 0, `${lang}.${k}`).toBe(true);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(v), `${lang}.${k} placeholders`).toBe(ph(CD_TABLES.he[k]));
    }
  }
  expect(Object.keys(CD_TABLES.en).sort()).toEqual([...CD_KEYS].sort());
});

test('no internal code, permission name, credential word or home platform on the face', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const k of CD_KEYS) {
      const v = CD_TABLES[lang][k];
      expect(/system\.configure|scan_running|range_|same_for_all|wrong_password|locked_guard|go2rtc|smplwise_|home assistant|\bHA\b|rtsp:\/\//i.test(v), `${lang}.${k}`).toBe(false);
    }
  }
});

test('the range check: up to the cap (1,024), an IPv4 a.b.c.d/len only, empty = the suggestion', () => {
  expect(cidrSize('192.0.2.0/24')).toBe(256);
  expect(cidrSize(' 10.1.0.0/22 ')).toBe(1024);
  expect(cidrSize('10.1.0.0/21')).toBe(2048);
  expect(cidrSize('10.1.0.7/32')).toBe(1);
  for (const bad of ['10.1.0.0', '10.1.0.0/33', '256.1.1.1/24', 'fe80::/64', 'camera.lan/24', '']) expect(cidrSize(bad), bad).toBeNull();
  expect(rangeCheck('', 1024)).toEqual({ ok: true, text: '', tone: 'muted' });
  expect(rangeCheck('10.1.0.0/22', 1024)).toEqual({ ok: true, text: cdt('rangeCount', { n: '1,024' }), tone: 'muted' });
  expect(rangeCheck('10.1.0.0/21', 1024)).toEqual({ ok: false, text: cdt('rangeTooLarge', { n: '2,048', max: '1,024' }), tone: 'bad' });
  const bad = rangeCheck('10.1.0.0', 1024);
  expect(bad.ok).toBe(false);
  expect(bad.text).toContain(ltrIsolate('192.0.2.0/24')); // the example is a documentation range, drawn left to right
  // a narrower administrator setting (/24) is the server's cap too
  expect(rangeCheck('10.1.0.0/23', 256).ok).toBe(false);
});

test('progress: checked of total while running, full once the sweep ended', () => {
  const job = (state: 'running' | 'done', checked: number, total: number) => ({ state, progress: { checked, total } });
  expect(progressPct(null)).toBe(0);
  expect(progressPct(job('running', 0, 0))).toBe(0);
  expect(progressPct(job('running', 158, 254))).toBe(62);
  expect(progressPct(job('running', 300, 254))).toBe(100);
  expect(progressPct(job('done', 3, 254))).toBe(100);
});

test('kinds and marks: behind the recorder and already added are marked and never selectable (Q58); a recorder offers the wizard (Q59)', () => {
  const cam = dev();
  expect([rowClass(cam), selectable(cam), rowMark(cam)]).toEqual(['camera', true, null]);
  const behind = dev({ known: 'behind_recorder', addable: false, known_ref: 'cam-7' });
  expect(selectable(behind)).toBe(false);
  expect(rowMark(behind)?.key).toBe('markBehind');
  const added = dev({ known: 'standalone', addable: false });
  expect(selectable(added)).toBe(false);
  expect(rowMark(added)?.key).toBe('markStandalone');
  const looks = dev({ kind: 'nvr', addable: false, recorder_prefill: { host: '192.0.2.10', http_port: 80, vendor: 'hikvision' } });
  expect([rowClass(looks), selectable(looks), rowMark(looks)?.key, offersRecorder(looks)]).toEqual(['recorder', false, 'markLooksRecorder', true]);
  const own = dev({ kind: 'nvr', known: 'recorder', addable: false, recorder_prefill: { host: '192.0.2.11', http_port: 80 } });
  expect([rowClass(own), rowMark(own)?.key, offersRecorder(own)]).toEqual(['recorder', 'markOwnRecorder', false]);
  expect(offersRecorder(dev({ kind: 'nvr', addable: false }))).toBe(false); // no pre-fill: nothing to open
  const unknown = dev({ kind: 'unknown' });
  expect([rowClass(unknown), selectable(unknown)]).toEqual(['unknown', true]);
  const noService = dev({ has_service: false, addable: false });
  expect([selectable(noService), rowMark(noService)?.key]).toEqual([false, 'noService']);
  // a client flag cannot make a device selectable: the server's `addable` decides
  expect(selectable(dev({ addable: false }))).toBe(false);
});

test('Q57 one attempt: a camera that refused a pair is not sent that pair again; the lockout stop is never pressed', () => {
  const pair = pairKey('viewer', 'secret-1');
  const devs = [
    dev({ id: 'a' }),
    dev({ id: 'b', auth: 'wrong_password' }),
    dev({ id: 'c', auth: 'locked_guard' }),
    identified({ id: 'd' }),
    dev({ id: 'e', known: 'behind_recorder', addable: false }),
    dev({ id: 'f' }),
    dev({ id: 'g', auth: 'no_answer' }),
    dev({ id: 'h', auth: 'not_onvif' }),
  ];
  const selected = new Set(['a', 'b', 'c', 'd', 'e', 'g', 'h']); // f not ticked
  const tried = new Map([['b', pair]]);
  expect(identifyTargets(devs, selected, tried, pair)).toEqual(['a', 'g']);
  // the typed password changed: the refusing camera gets one new attempt
  expect(identifyTargets(devs, selected, tried, pairKey('viewer', 'secret-2'))).toEqual(['a', 'b', 'g']);
  expect(identifyBlock([], 'viewer', 'x', true)).toBe('none');
  expect(identifyBlock(['a'], ' ', 'x', true)).toBe('creds');
  expect(identifyBlock(['a'], 'viewer', '', true)).toBe('creds');
  expect(identifyBlock(['a', 'g'], 'viewer', 'x', false)).toBe('same');
  expect(identifyBlock(['a'], 'viewer', 'x', false)).toBe('');
  expect(identifyBlock(['a', 'g'], 'viewer', 'x', true)).toBe('');
  // the row's own retry: only with a different password, never for the guard's stop
  const b = devs[1];
  expect(retryAllowed(b, 'viewer', '', tried)).toBe(false);
  expect(retryAllowed(b, 'viewer', 'secret-1', tried)).toBe(false);
  expect(retryAllowed(b, 'viewer', 'secret-3', tried)).toBe(true);
  expect(retryAllowed(devs[2], 'viewer', 'secret-3', tried)).toBe(false);
  expect(retryAllowed(dev({ auth: 'wrong_password', known: 'standalone', addable: false }), 'viewer', 'secret-3', tried)).toBe(false);
});

test('the state line of a press: identified with streams, wrong password, the lockout guard, no stream', () => {
  const ok = authState(identified());
  expect(ok.tone).toBe('ok');
  expect(ok.text).toBe(cdt('authOk', { n: 3 }));
  expect(ok.note).toBe(streamsLine(identified()));
  expect(authState(dev({ auth: 'wrong_password' }))).toEqual({ text: cdt('authWrong'), tone: 'bad', note: cdt('authWrongNote') });
  expect(authState(dev({ auth: 'locked_guard' }))).toEqual({ text: cdt('authLocked'), tone: 'bad', note: cdt('authLockedNote') });
  expect(authState(identified({ profiles: [prof('p0', 1920, 1080, 'h264', 'other_host')] })).text).toBe(cdt('noStream'));
  expect(authState(dev()).text).toBe(cdt('authNotTried'));
  for (const a of ['digest_required', 'busy', 'no_answer', 'not_onvif', 'skipped'] as const) expect(authState(dev({ auth: a })).text.length).toBeGreaterThan(0);
});

test('streams: the suggestion when usable, the resolution left to right, H.265 noted', () => {
  const d = identified();
  expect(suggestedPair(d)).toEqual({ main: 'p0', sub: 'p2' });
  expect(profileLabel(d.profiles[0])).toBe(`${ltrIsolate('2688×1520')} · H.265`);
  expect(streamsLine(d)).toBe(cdt('mainSub', { main: profileLabel(d.profiles[0]), sub: profileLabel(d.profiles[2]) }));
  expect(needsH265Note(d, 'p0')).toBe(true);
  expect(needsH265Note(d, 'p1')).toBe(false);
  // a suggestion on an unusable stream falls back to the first usable one; a sub equal to the main is dropped
  const odd = identified({ profiles: [prof('p0', 2688, 1520, 'h265', 'other_host'), prof('p1', 1280, 720)], suggested: { main: 'p0', sub: 'p1' } });
  expect(suggestedPair(odd)).toEqual({ main: 'p1', sub: null });
  expect(streamsLine(odd)).toBe(cdt('mainOnly', { main: profileLabel(odd.profiles[1]) }));
  expect(readyToAdd(identified())).toBe(true);
  expect(readyToAdd(odd)).toBe(true);
  expect(readyToAdd(identified({ profiles: [prof('x', 1, 1, 'h264', 'not_rtsp')] }))).toBe(false);
  expect(readyToAdd(identified({ known: 'standalone', addable: false }))).toBe(false);
});

test('default name, clock evidence', () => {
  expect(defaultName(identified())).toBe('Vantis DC-4K21 - 21');
  expect(defaultName(dev({ name: 'Gate' }))).toBe('Gate - 21');
  expect(defaultName(dev())).toBe(`${cdt('kindCamera')} - 21`);
  expect(clockNote(null)).toBe('');
  expect(clockNote(90)).toBe('');
  expect(clockNote(-660)).toBe(cdt('clockOff', { min: 11 }));
});

test('pages: a slice per page, clamped; the page sizes keep the dialog without scrolling', () => {
  const list = Array.from({ length: 11 }, (_, i) => i);
  expect(pageSlice(list, 1, 5)).toEqual({ items: [0, 1, 2, 3, 4], page: 1, pages: 3 });
  expect(pageSlice(list, 3, 5)).toEqual({ items: [10], page: 3, pages: 3 });
  expect(pageSlice(list, 9, 5).page).toBe(3);
  expect(pageSlice([], 1, 5)).toEqual({ items: [], page: 1, pages: 1 });
  expect(pageSize('identify', false, 900)).toBe(5);
  expect(pageSize('identify', false, 768)).toBe(3); // tablet 1024x768: 4 rows overflowed the body (security-review capture)
  expect(pageSize('identify', false, 820)).toBe(4);
  expect(pageSize('identify', true, 844)).toBe(3);
  expect(pageSize('add', false, 900)).toBe(4);
  expect(pageSize('add', false, 768)).toBe(3);
  expect(pageSize('add', true, 844)).toBe(1);
});

test('refusals in words: never the code; 429 says when; the add step names each camera', () => {
  expect(discoveryErrorText(err(409, 'scan_running'))).toBe(cdt('errRunning'));
  expect(discoveryErrorText(err(422, 'range_too_large'), 1024)).toBe(cdt('errRangeTooLarge', { max: '1,024' }));
  expect(discoveryErrorText(err(422, 'range_refused'))).toBe(cdt('errRangeRefused'));
  expect(discoveryErrorText(err(409, 'discovery_off'))).toBe(cdt('errOff'));
  expect(discoveryErrorText(err(429, 'rate_limited', { retry_after_s: 42 }))).toBe(cdt('errRate', { s: 42 }));
  expect(discoveryErrorText(err(429, 'rate_limited'))).toBe(cdt('errRateSoon'));
  expect(discoveryErrorText(err(403, 'forbidden'))).toBe(cdt('errForbidden'));
  expect(discoveryErrorText(err(500, 'internal'))).toBe(cdt('errGeneric'));
  expect(discoveryErrorText(new Error('x'))).toBe(cdt('errGeneric'));
  expect(addFailureText({ code: 'behind_recorder', message: 'x' })).toBe(cdt('failBehind'));
  expect(addFailureText({ code: 'standalone_limit', message: 'x' })).toBe(cdt('failLimit'));
  expect(addFailureText({ code: 'something_new', message: 'טקסט השרת' })).toBe('טקסט השרת');
  expect(addSummary({ added: [{ device_id: 'a', camera_id: 'c1' }], failed: [] })).toEqual({ tone: 'ok', title: cdt('doneTitle', { n: 1 }) });
  expect(addSummary({ added: [{ device_id: 'a', camera_id: 'c1' }], failed: [{ device_id: 'b', code: 'no_stream', message: '' }] })).toEqual({ tone: 'warn', title: cdt('partialTitle', { added: 1, total: 2 }) });
  expect(addSummary({ added: [], failed: [{ device_id: 'b', code: 'no_stream', message: '' }] }).tone).toBe('bad');
});

test('merging an identification answer, the summary line, finding a running scan again', () => {
  const list = [dev({ id: 'a' }), dev({ id: 'b' }), dev({ id: 'c', known: 'behind_recorder', addable: false })];
  const merged = mergeDevices(list, [identified({ id: 'b' })]);
  expect(merged.map((d) => [d.id, d.auth])).toEqual([['a', 'not_tried'], ['b', 'ok'], ['c', 'not_tried']]);
  expect(identifySummary(merged, new Set(['a', 'b', 'c']))).toEqual({ ok: 1, waiting: 1, bad: 0 });
  const s = (id: string, state: string, started_at: string) => ({ id, state, started_at });
  expect(runningScan([s('1', 'done', '2026-11-23T10:00:00Z'), s('2', 'running', '2026-11-23T09:00:00Z'), s('3', 'running', '2026-11-23T09:30:00Z')])?.id).toBe('3');
  expect(runningScan([s('1', 'done', '2026-11-23T10:00:00Z')])).toBeNull();
});
