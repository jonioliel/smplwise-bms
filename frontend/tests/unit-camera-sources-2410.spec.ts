import { test, expect } from '@playwright/test';
import { CS_KEYS, CS_TABLES, cst } from '../src/i18n/camera-sources';
import { draftReady, healthLine, isMasked, recorderActions, sourceErrorText, sourceSummary, testLine, urlProblem } from '../src/screens/camera-source-logic';
import { ApiError } from '../src/api/client';
import { ltrIsolate } from '../src/i18n/bidi';

// CAMERA-STREAM-SOURCES-2410: a camera's video source and the cameras without a recorder - the words (he / en), the rough address check,
// the words of a refusal (never the server's code), the stream-test line, the health line and what a camera without a recorder can do.
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-camera-sources-2410.spec.ts

const err = (status: number, code: string) => new ApiError(status, { code, user_message: 'server text', retryable: false, correlation_id: 'x', details: {} });

test('every key exists in he and en, non-empty, with the same placeholders', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const k of CS_KEYS) {
      const v = CS_TABLES[lang][k];
      expect(typeof v === 'string' && v.trim().length > 0, `${lang}.${k}`).toBe(true);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(v), `${lang}.${k} placeholders`).toBe(ph(CS_TABLES.he[k]));
    }
  }
});

test('no internal code, permission name or home platform on the face', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const k of CS_KEYS) {
      const v = CS_TABLES[lang][k];
      expect(/system\.configure|source_not|password_reenter|go2rtc|smplwise_|home assistant|\bHA\b/i.test(v), `${lang}.${k}`).toBe(false);
    }
  }
});

test('the rough address check: rtsp / rtsps only, empty is fine, at least one address to save', () => {
  expect(urlProblem('')).toBe('');
  expect(urlProblem('rtsp://u:p@cam.lan:554/stream')).toBe('');
  expect(urlProblem('RTSPS://cam.local/x')).toBe('');
  expect(urlProblem('http://cam/x.mjpg')).toBe(cst('urlBad'));
  expect(urlProblem('rtsp://a b')).toBe(cst('urlBad'));
  expect(draftReady('', '')).toEqual({ ok: false, reason: cst('urlRequired') });
  expect(draftReady('', 'rtsp://h/2').ok).toBe(true);
  expect(draftReady('ftp://x', 'rtsp://h/2').ok).toBe(false);
  expect(isMasked('rtsp://u:***@h/1')).toBe(true);
  expect(isMasked('rtsp://u:p@h/1')).toBe(false);
});

test('a refusal is said in words, never as the server code', () => {
  expect(sourceErrorText(err(422, 'password_reenter'))).toBe(cst('errPasswordReenter'));
  expect(sourceErrorText(err(422, 'source_not_allowed'))).toBe(cst('errNotAllowed'));
  expect(sourceErrorText(err(422, 'source_not_supported'))).toBe(cst('errNotSupported'));
  expect(sourceErrorText(err(409, 'stale'))).toBe(cst('errStale'));
  expect(sourceErrorText(err(409, 'media_not_configured'))).toBe(cst('errMedia'));
  expect(sourceErrorText(err(429, 'rate_limited'))).toBe(cst('errRate'));
  expect(sourceErrorText(err(403, 'forbidden'))).toBe(cst('errForbidden'));
  expect(sourceErrorText(err(500, 'something_else'))).toBe(cst('errGeneric'));
  expect(sourceErrorText(new Error('boom'))).toBe(cst('errGeneric'));
});

test('the stream test line: resolution and codec, or the server fixed text', () => {
  expect(testLine({ ok: true, width: 1920, height: 1080, codec: 'h264', codec_label: 'H.264', preview: 'data:' })).toBe(cst('testOk', { res: ltrIsolate('1920×1080'), codec: ' · H.264' }));
  expect(testLine({ ok: true, width: 640, height: 360, codec: null, codec_label: null, preview: 'data:' })).toBe(cst('testOk', { res: ltrIsolate('640×360'), codec: '' }));
  expect(testLine({ ok: false, code: 'auth_failed', message: 'המצלמה דחתה' })).toBe('המצלמה דחתה');
});

test('a camera without a recorder records nothing; a recorder camera keeps everything', () => {
  expect(recorderActions({ standalone: true })).toEqual({ recording: false, reason: cst('noRecording') });
  expect(recorderActions({ standalone: false })).toEqual({ recording: true, reason: '' });
  expect(recorderActions(null).recording).toBe(true);
});

test('the summary and the health line of the source', () => {
  expect(sourceSummary({ mode: 'nvr', standalone: false })).toBe(cst('current', { mode: cst('fromNvr') }));
  expect(sourceSummary(null, { video_source: 'manual', standalone: true })).toBe(cst('current', { mode: cst('manual') }));
  expect(healthLine({ mode: 'nvr', health: null })).toBeNull();
  const h = (state: 'ok' | 'failing' | 'unknown') => healthLine({ mode: 'manual', health: { state, code: null, checked_at: null, ok_at: null, since: null } });
  expect(h('ok')).toEqual({ text: cst('healthOk'), tone: 'ok' });
  expect(h('failing')).toEqual({ text: cst('healthFailing'), tone: 'bad' });
  expect(h('unknown')).toEqual({ text: cst('healthUnknown'), tone: 'muted' });
});
