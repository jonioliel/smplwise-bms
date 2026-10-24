import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TALK_MAX_DEFAULT_S, TALK_MAX_KEY, TALK_MAX_MAX_S, TALK_MAX_MIN_S, parseTalkMax, talkMaxInput } from '../src/api/station-media';
import { PARITY_HE } from '../src/i18n/access-parity';

// WKDIRECT-295: the "longest talk" row of the stations display card (`access.station_media_max_talk_s`). WisKey publishes
// `station_media_max_talk_seconds` per station as a whole number 1..86400 (default 300, no 180 s clamp); Arx's setting takes the same
// range and the talk ends at the smaller of the two. Plain node: the range agrees with the server, the reader and the input rule, the
// words, and a source guard that the row shows only while talk is on.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wkdirect-talk-max.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(HERE, rel), 'utf8');

test.describe('WKDIRECT-295: the longest talk setting', () => {
  test('the key, the default and the range are the server\'s (1..86400, default 300)', () => {
    expect(TALK_MAX_KEY).toBe('access.station_media_max_talk_s');
    expect([TALK_MAX_MIN_S, TALK_MAX_MAX_S, TALK_MAX_DEFAULT_S]).toEqual([1, 86400, 300]);
    const server = read('../../smplwise_vms/backend/smplwise/routers/settings.py');
    const field = /access_station_media_max_talk_s: int \| None = Field\(default=None, ge=(\d+), le=(\d+), alias="access\.station_media_max_talk_s"\)/.exec(server);
    expect(field, 'the server declares the setting with bounds').not.toBeNull();
    expect([Number(field![1]), Number(field![2])]).toEqual([TALK_MAX_MIN_S, TALK_MAX_MAX_S]);
    expect(server).toMatch(/"access\.station_media_max_talk_s": "300"/);
  });

  test('the reader keeps a value in range and shows the default for anything else', () => {
    expect(parseTalkMax({ [TALK_MAX_KEY]: 600 })).toBe(600);
    expect(parseTalkMax({ [TALK_MAX_KEY]: '45' })).toBe(45);
    expect(parseTalkMax({ [TALK_MAX_KEY]: 86400 })).toBe(86400);
    for (const bad of [undefined, null, 0, 86401, 30.5, -1, 'x', '', true]) {
      expect(parseTalkMax({ [TALK_MAX_KEY]: bad as unknown })).toBe(300);
    }
    expect(parseTalkMax(undefined)).toBe(300);
  });

  test('only a whole number 1..86400 is saved', () => {
    expect(talkMaxInput('1')).toBe(1);
    expect(talkMaxInput(' 300 ')).toBe(300);
    expect(talkMaxInput('86400')).toBe(86400);
    for (const bad of ['0', '86401', '', '1.5', '-5', '1e3', 'abc', '123456']) expect(talkMaxInput(bad)).toBeNull();
  });

  test('Hebrew words, no internal code, and the row appears only while talk is on', () => {
    expect(PARITY_HE.dispTalkMax).toBe('משך דיבור מרבי');
    expect(PARITY_HE.dispTalkMaxUnit).toBe('שניות');
    expect(`${PARITY_HE.dispTalkMax}${PARITY_HE.dispTalkMaxUnit}${PARITY_HE.dispTalkMaxInvalid}`).not.toMatch(/WisKey|Home Assistant|HA\b|max_talk|W10/);
    const card = read('../src/screens/system-access-display.ts');
    expect(card).toMatch(/this\.value\(STATION_MEDIA_KEY\) === 'video_talk' \? this\.talkMax\(\) : nothing/);
    expect(card).toMatch(/min=\$\{TALK_MAX_MIN_S\} max=\$\{TALK_MAX_MAX_S\}/);
  });
});
