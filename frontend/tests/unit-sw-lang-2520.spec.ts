import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFLINE_HTML, offlineHtml } from '../src/pwa/offline-page';
import { LABELS, parsePush, swLang } from '../src/pwa/push-v2';

// I18N-RUNTIME-ERRORS-2520: the service worker's own words (the offline page, the notification buttons) follow the user's interface
// language, which the app tells the worker in its context message; Hebrew until it does, and the Hebrew is what it was before.

const here = path.dirname(fileURLToPath(import.meta.url));
const HEB = /[֐-׿]/;
const golden = JSON.parse(fs.readFileSync(path.resolve(here, 'fixtures/push-v2.json'), 'utf8')) as Record<string, Record<string, unknown>>;

test('the offline page: Hebrew unchanged, English with no Hebrew, anything else Hebrew', () => {
  expect(offlineHtml('he')).toBe(OFFLINE_HTML);
  expect(OFFLINE_HTML).toContain('<html lang="he" dir="rtl">');
  expect(OFFLINE_HTML).toContain('<h1>אין חיבור לשרת</h1>');
  const en = offlineHtml('en');
  expect(en).toContain('<html lang="en" dir="ltr">');
  expect(en).toContain('<title>SmplWise Arx · No connection</title>');
  expect(en).toContain('<a href="./">Try again</a>');
  expect(en).not.toMatch(HEB);
  for (const other of [undefined, null, 'fr', 'EN']) expect(offlineHtml(other)).toBe(OFFLINE_HTML);
  // the same page otherwise: only the words and the direction differ
  const shape = (html: string) => html.replace(/<title>[^<]*<\/title>|<h1>[^<]*<\/h1>|<p>[^<]*<\/p>|<a href="\.\/">[^<]*<\/a>|lang="\w+" dir="\w+"/g, '');
  expect(shape(en)).toBe(shape(OFFLINE_HTML));
});

test('the notification buttons: Hebrew keeps the server words, English uses the worker table', () => {
  expect(swLang('en')).toBe('en');
  for (const v of ['he', undefined, null, 'fr', 1]) expect(swLang(v)).toBe('he');
  const raw = golden.ack_snooze;
  const he = parsePush(raw, 2);
  expect(parsePush(raw, 2, 'he')).toEqual(he);
  expect(he.actions.map((a) => a.title)).toEqual(((raw.actions as { title: string }[]) ?? []).slice(0, 2).map((a) => a.title));
  const en = parsePush(raw, 2, 'en');
  expect(en.actions.map((a) => a.title)).toEqual(en.actions.map((a) => LABELS.en[a.action]));
  expect(en.actions.map((a) => a.token)).toEqual(he.actions.map((a) => a.token)); // the same buttons, only their words
  for (const a of en.actions) expect(a.title).not.toMatch(HEB);
  const door = parsePush(golden.doorbell_open_door, 3, 'en');
  expect(door.actions.find((a) => a.action === 'open_door')?.title).toBe('Open the door');
  // no title from the server: the table's word in either language
  const bare = { v: 2, id: 'n1', title: 't', body: 'b', actions: [{ a: 'ack', t: 'tok_abcdefgh' }] };
  expect(parsePush(bare, 2).actions[0].title).toBe(LABELS.he.ack);
  expect(parsePush(bare, 2, 'en').actions[0].title).toBe('Acknowledge');
});

test('the app tells the worker the language; the worker keeps it and uses it for both', () => {
  const sw = fs.readFileSync(path.resolve(here, '../src/pwa/sw.ts'), 'utf8');
  const reg = fs.readFileSync(path.resolve(here, '../src/pwa/register.ts'), 'utf8');
  expect(reg).toMatch(/postMessage\(\{ type: 'arx-context', openUrl: hostPage\(\), lang: currentUiLang\(\) \}\)/);
  expect(sw).toMatch(/data\.lang === 'he' \|\| data\.lang === 'en'/);
  expect(sw).toMatch(/putMeta\('lang', \{ lang: data\.lang \}\)/);
  expect(sw).toMatch(/new Response\(offlineHtml\(await workerLang\(\)\)/);
  expect(sw).toMatch(/parsePush\(raw, [^)]*, lang\)/);
  expect(sw).not.toMatch(/OFFLINE_HTML/);
});
