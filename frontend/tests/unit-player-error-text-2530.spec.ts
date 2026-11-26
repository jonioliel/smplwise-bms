import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DENIAL_CODES, streamErrorHint, streamErrorText, type StreamKind } from '../src/api/stream-errors';
import { VIDEO_SERVICE_DOWN_HE, VIDEO_SERVICE_HINT_OTHER } from '../src/api/video-service';
import { installLangPack } from '../src/i18n/lang-packs';
import { PACK as EN_PACK } from '../src/i18n/lang/en';

// PLAYER-ERROR-TEXT-2530 (VIDEO-SECFIX-2520 question 1 a): since 2.52 the relay sends fixed error codes, never go2rtc's text; the
// player says each as a sentence (src/api/stream-errors.ts), with a retry hint, and an unknown code as the generic sentence - never the
// code. The codes are read from the BACKEND SOURCE, so a code added there without its sentence here fails this spec. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-player-error-text-2530.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '../../smplwise_vms/backend/smplwise');
const src = (rel: string) => readFileSync(path.join(BACKEND, rel), 'utf8');
const HEB = /[֐-׿]/;
const GENERIC = 'שגיאה בזרם הווידאו';

type Doc = { documentElement: { lang: string } };
const g = globalThis as unknown as { document?: Doc };
function withLang<T>(lang: string, fn: () => T): T {
  const prev = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}

/** Every fixed `value` of an error frame the relay routes can send a viewer, read from the backend source. */
function backendCodes(): Set<string> {
  const out = new Set<string>();
  const add = (text: string, re: RegExp) => {
    for (const m of text.matchAll(re)) out.add(m[1]);
  };
  const relay = src('services/relay.py');
  add(relay, /^UPSTREAM_ERROR = "(\w+)"/gm);
  add(src('services/ha_camera_streams.py'), /^LIVE_ERROR_VALUE = "(\w+)"/gm);
  for (const f of ['routers/media.py', 'routers/playback.py', 'routers/intercom_media.py']) {
    const t = src(f);
    add(t, /\{"type": "error", "value": "(\w+)"/g); // a dict frame
    add(t, /'\{"type":"error","value":"(\w+)"\}'/g); // a literal frame (access_lost)
    add(t, /_json_dumps_error\("(\w+)"/g); // the relay's "cannot reach go2rtc" frame
    add(t, /refuse_media\(websocket, settings, "(\w+)"\)/g);
    add(t, /_refuse_choice\(websocket, "(\w+)"/g);
  }
  add(src('routers/media.py'), /^MEDIA_DOWN_CODES = frozenset\(\{(.*)\}\)/gm);
  // the socket refused for its caller (routers/media._refuse_socket forwards the ApiError's code): presence and service accounts
  if (src('services/presence.py').includes('"presence_required"')) out.add('presence_required');
  if (src('services/service_identity.py').includes('"service_account"')) out.add('service_account');
  return new Set([...out].flatMap((c) => c.split(',').map((x) => x.trim().replace(/"/g, ''))).filter(Boolean));
}

/** Codes the player shows in a state of its own before it asks this table (cap view, H.265 notices, the video service watch). */
const OWN_STATE = new Set(['remote_live_cap', 'h265_unsupported', 'transcode_cap']);

test('the backend sends the codes this spec expects (the source reader works)', () => {
  const codes = backendCodes();
  for (const c of ['upstream_error', 'upstream_unavailable', 'access_lost', 'remote_live_cap', 'h265_unsupported', 'transcode_cap', 'media_unavailable', 'media_not_configured', 'presence_required', 'service_account'])
    expect([...codes], c).toContain(c);
});

test('every fixed code the relay can send has its own sentence, never the code and never the generic one', () => {
  for (const code of backendCodes()) {
    if (OWN_STATE.has(code)) continue;
    for (const kind of ['live', 'recording'] as StreamKind[]) {
      const text = streamErrorText(code, kind);
      expect(text, `${code} (${kind})`).not.toBe(GENERIC);
      expect(text, `${code} (${kind}) shows no code`).not.toContain(code);
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
      expect(text, 'Hebrew in a Hebrew page').toMatch(HEB);
    }
  }
});

test('upstream_error says what failed: the camera live, the recorder for a recording', () => {
  expect(streamErrorText('upstream_error', 'live')).toBe('שרת הווידאו לא הצליח לקבל את השידור מהמצלמה');
  expect(streamErrorText('upstream_error', 'recording')).toBe('שרת הווידאו לא הצליח לקבל את ההקלטה מהמקליט');
  expect(streamErrorText('upstream_error')).toBe(streamErrorText('upstream_error', 'live'));
});

test('"cannot reach the video service" keeps the one wording of the service-down state; a denial keeps its own', () => {
  for (const c of ['upstream_unavailable', 'media_unavailable', 'media_not_configured']) expect(streamErrorText(c)).toBe(VIDEO_SERVICE_DOWN_HE);
  expect(streamErrorText('access_lost')).toBe('ההרשאה לצפייה במצלמה הזו הוסרה');
  expect(streamErrorText('presence_required')).toBe('כדי לצפות בווידאו מהאפליקציה יש להפעיל את שיתוף הנתונים הנדרש');
  expect(streamErrorText('service_account')).toBe('חשבון שירות אינו יכול לצפות בווידאו');
});

test('an unknown, empty or raw value gets the generic sentence - the value itself is never shown', () => {
  const raw = ['something_new', '', 'dial tcp 192.0.2.7:554: i/o timeout', 'rtsp://user:secret@cam/stream', 'Stream error', '<b>x</b>'];
  for (const v of raw) {
    const text = streamErrorText(v, 'live');
    expect(text, JSON.stringify(v)).toBe(GENERIC);
    if (v) expect(text).not.toContain(v);
  }
  expect(streamErrorText(undefined)).toBe(GENERIC);
  expect(streamErrorText(null)).toBe(GENERIC);
});

test('the retry hint follows whether the player retries by itself, and names what to check', () => {
  expect(streamErrorHint('upstream_error', 'live', true)).toBe('ננסה שוב אוטומטית; אם זה נמשך, בדקו שהמצלמה מחוברת ופועלת');
  expect(streamErrorHint('upstream_error', 'live', false)).toBe('נסו שוב בעוד רגע; אם זה נמשך, בדקו שהמצלמה מחוברת ופועלת');
  expect(streamErrorHint('upstream_error', 'recording', true)).toBe('ננסה שוב אוטומטית; אם זה נמשך, בדקו שהמקליט מחובר ופועל');
  expect(streamErrorHint('upstream_error', 'recording', false)).toBe('נסו שוב בעוד רגע; אם זה נמשך, בדקו שהמקליט מחובר ופועל');
  expect(streamErrorHint('something_new', 'live', true), 'the service-down hint wording for an unknown error').toBe(VIDEO_SERVICE_HINT_OTHER);
  expect(streamErrorHint('something_new', 'recording', false)).toBe('נסו שוב בעוד רגע; אם זה נמשך, פנו למנהל המערכת');
});

test('no retry hint for a denial or for "the video service is down" (that state has its own hint and button)', () => {
  for (const c of DENIAL_CODES) for (const auto of [true, false]) expect(streamErrorHint(c, 'live', auto), c).toBe('');
  for (const c of ['upstream_unavailable', 'media_unavailable']) expect(streamErrorHint(c, 'live', true), c).toBe('');
  expect([...DENIAL_CODES].sort()).toEqual(['access_lost', 'presence_required', 'service_account']);
});

test('in English every sentence and hint is English (the language pack has them all)', () => {
  installLangPack('en', EN_PACK);
  withLang('en', () => {
    // the service-down codes return VIDEO_SERVICE_DOWN_HE itself, a constant read when its module loads (in the app the page's
    // language is set before that; here it loaded in Hebrew) - its English is the language pack's own entry
    const DOWN = new Set(['upstream_unavailable', 'media_unavailable', 'media_not_configured']);
    for (const c of DOWN) expect(streamErrorText(c)).toBe(VIDEO_SERVICE_DOWN_HE);
    const codes = [...backendCodes()].filter((c) => !OWN_STATE.has(c) && !DOWN.has(c));
    for (const code of [...codes, 'something_new']) {
      for (const kind of ['live', 'recording'] as StreamKind[]) {
        expect(streamErrorText(code, kind), `${code} ${kind}`).not.toMatch(HEB);
        for (const auto of [true, false]) expect(streamErrorHint(code, kind, auto), `${code} ${kind} hint`).not.toMatch(HEB);
      }
    }
    expect(streamErrorText('upstream_error', 'live')).toBe('The video server could not get the stream from the camera');
    expect(streamErrorText('upstream_error', 'recording')).toBe('The video server could not get the recording from the recorder');
    expect(streamErrorText('nope')).toBe('Video stream error');
    expect(streamErrorHint('upstream_error', 'live', true)).toBe('We will try again automatically; if it continues, check that the camera is connected and working');
  });
});

test('the player never builds an on-screen text from the frame value', () => {
  const player = readFileSync(path.resolve(HERE, '../src/components/sw-live-player.ts'), 'utf8');
  expect(player).not.toContain("tr('שגיאת זרם");
  expect(player, 'a raw value as a failure reason').not.toMatch(/Failed\(msg\.value/);
  expect(player, 'a raw value as the error').not.toMatch(/this\.fail\(msg\.value/);
});
