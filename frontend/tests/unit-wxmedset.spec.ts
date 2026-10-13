import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mediaOptions } from '../src/access-control/parity-logic';
import { STATION_MEDIA_KEY, STATION_MEDIA_MODES, parseMediaMode } from '../src/api/station-media';
import { PARITY_HE } from '../src/i18n/access-parity';

// WXMEDSET (owner 2026-10-13): the Settings row for `access.station_media` (off / video / video + talk) in the existing display card of
// Settings > "מתגי מסכי כניסה". Plain node: the choices, their words in both languages, the agreement with the server's pattern, and the
// owner's "a clean control, nothing explained beside it" as a source guard.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wxmedset.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(HERE, rel), 'utf8');

/** The words depend on the document language (the same switch every i18n module here uses); node has no document, so a stub carries `lang`. */
function inLanguage<T>(lang: string, fn: () => T): T {
  const g = globalThis as unknown as { document?: unknown };
  const before = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (before === undefined) delete g.document;
    else g.document = before;
  }
}

test.describe('WXMEDSET: the live video and talk row', () => {
  test('three choices in the order off, video, video + talk, with the owner\'s words', () => {
    expect(mediaOptions()).toEqual([
      ['off', 'כבוי'],
      ['video', 'וידאו'],
      ['video_talk', 'וידאו ודיבור'],
    ]);
    expect(PARITY_HE.dispMedia).toBe('וידאו ודיבור במסך התחנות');
  });

  test('English follows the document language, and the choices stay the same three values', () => {
    const en = inLanguage('en', () => mediaOptions());
    expect(en.map(([v]) => v)).toEqual(['off', 'video', 'video_talk']);
    expect(en.map(([, label]) => label)).toEqual(['Off', 'Video', 'Video and talk']);
    expect(inLanguage('en-US', () => mediaOptions())[1][1]).toBe('Video');
    expect(inLanguage('he', () => mediaOptions())[1][1]).toBe('וידאו');
  });

  test('the key and the values are the server\'s: the three values are exactly what PATCH /settings accepts', () => {
    expect(STATION_MEDIA_KEY).toBe('access.station_media');
    expect([...STATION_MEDIA_MODES]).toEqual(['off', 'video', 'video_talk']);
    const server = read('../../smplwise_vms/backend/smplwise/routers/settings.py');
    const pattern = /access_station_media: str \| None = Field\(default=None, pattern="\^\(([a-z_|]+)\)\$", alias="access\.station_media"\)/.exec(server);
    expect(pattern, 'the server declares the setting with a pattern').not.toBeNull();
    expect(pattern![1].split('|')).toEqual([...STATION_MEDIA_MODES]);
    expect(server).toMatch(/"access\.station_media": "off"/); // default off
  });

  test('an unreadable value is "off": the stations screen keeps the still and the classic panel', () => {
    expect(parseMediaMode(undefined)).toBe('off');
    expect(parseMediaMode({})).toBe('off');
    expect(parseMediaMode({ [STATION_MEDIA_KEY]: 'Video' })).toBe('off');
    expect(parseMediaMode({ [STATION_MEDIA_KEY]: '' })).toBe('off');
    expect(parseMediaMode({ [STATION_MEDIA_KEY]: 'video' })).toBe('video');
    expect(parseMediaMode({ [STATION_MEDIA_KEY]: 'video_talk' })).toBe('video_talk');
  });

  test('the row is a bare control: a label and a select, no hint line and no paragraph beside it', () => {
    const src = read('../src/screens/system-access-display.ts');
    const row = /<div class="row" data-access-display-media>([\s\S]*?)<\/div>/.exec(src);
    expect(row, 'the media row is in the display card').not.toBeNull();
    const body = row![1];
    expect(body).toContain(`this.select(STATION_MEDIA_KEY, mediaOptions())`);
    expect(body).not.toMatch(/class="muted"|<p[ >]|class="hint"|<sw-badge/);
    expect(body.match(/\$\{pt\(/g)).toHaveLength(1); // exactly one string: the label
  });

  test('every string of the row has an English counterpart', () => {
    const src = read('../src/i18n/access-parity.ts');
    const en = /const en: Partial<Record<PtKey, string>> = \{([\s\S]*?)\n\};/.exec(src)![1];
    for (const key of ['dispMedia', 'dispMediaOff', 'dispMediaVideo', 'dispMediaTalk']) expect(en, key).toMatch(new RegExp(`\\b${key}:`));
  });

  test('the live picture is never a choice of this row: the player offers WebRTC or MSE only', () => {
    const server = read('../../smplwise_vms/backend/smplwise/services/intercom_media.py');
    expect(server).toMatch(/^VIDEO_TRANSPORTS = \("webrtc", "mse"\)$/m);
    expect(read('../src/api/media.ts')).toMatch(/^export type Transport = 'auto' \| 'webrtc' \| 'mse';$/m);
    expect(read('../src/api/station-media.ts')).not.toMatch(/hls|rtsp|\.m3u8/i);
  });
});
