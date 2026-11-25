import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WPS_KEYS,
  WPS_PROVIDER_ROW_HREF,
  WPS_TABLES,
  wpsLineFix,
  wpsLineLabel,
  wpsLineText,
  wpsProviderRowLabel,
  wpsSteps,
} from '../src/i18n/wiskey-pairing-status';

// WISKEY-PAIRING-I18N-2520: the pairing lines of "חיבור Arx ל-WisKey", their fixes and the steps outside Arx say themselves in the page's
// language from stable codes. The code lists are read from the BACKEND SOURCE (services/wiskey_pairing.py: LABEL, TEXT, FIX, STEP,
// EVENT_GAP_WHY, ERROR_TEXT), so a line, fix or step added there without its words here fails this spec (the backend test
// test_wiskey_pairing_i18n_2520.py holds the Hebrew equal). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-pairing-i18n-2520.spec.ts
const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../smplwise_vms/backend/smplwise/services/wiskey_pairing.py');
const SRC = fs.readFileSync(BACKEND, 'utf8');
const HEB = /[֐-׿]/;
const he = WPS_TABLES.he as Record<string, string>;
const en = WPS_TABLES.en as Record<string, string>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** The keys of the module-level dict `name = {` of the backend (one `"key":` per entry at the start of a line inside the block). */
function dictKeys(name: string): string[] {
  const start = SRC.indexOf(`\n${name} = {`);
  expect(start, `${name} is in the backend module`).toBeGreaterThan(0);
  const end = SRC.indexOf('\n}\n', start);
  const block = SRC.slice(start, end);
  const inline = /^\n\w+ = \{"/.test(block) ? [...block.matchAll(/(?:\{|, |\n\s+)"(\w+)": "/g)].map((m) => m[1]) : [];
  const lines = [...block.matchAll(/^ {4}"(\w+)": /gm)].map((m) => m[1]);
  return [...new Set([...inline, ...lines])];
}

/** Every `_line(..., "<reason>"` of the backend, and every reason built as "key_" + state. */
function emittedReasons(): string[] {
  const out = new Set<string>();
  for (const m of SRC.matchAll(/_line\("\w+", \w+, "(\w+)"(\s*\+)?/g)) {
    if (m[2]) for (const st of ['missing', 'unreadable', 'rotated']) out.add(`${m[1]}${st}`);
    else out.add(m[1]);
  }
  for (const m of SRC.matchAll(/_line\("\w+", \w+, "(\w+)" if [^,]+ else "(\w+)"/g)) [m[1], m[2]].forEach((r) => out.add(r));
  return [...out];
}

test.describe('WISKEY-PAIRING-I18N-2520: the words of the pairing lines per language', () => {
  test('every label, line, fix, step, gap reason and error code of the backend has its Hebrew and its English', () => {
    const groups: Array<[string, string]> = [['LABEL', 'lbl_'], ['TEXT', 'l_'], ['FIX', 'x_'], ['STEP', 's_'], ['EVENT_GAP_WHY', 'v_why_'], ['ERROR_TEXT', 'v_code_']];
    for (const [dict, prefix] of groups) {
      const keys = dictKeys(dict);
      expect(keys.length, `${dict} has entries`).toBeGreaterThan(3);
      for (const k of keys) {
        expect(he[`${prefix}${k}`], `he ${prefix}${k}`).toBeTruthy();
        expect(en[`${prefix}${k}`], `en ${prefix}${k}`).toBeTruthy();
        expect(placeholders(en[`${prefix}${k}`]), `${prefix}${k} has the same values`).toEqual(placeholders(he[`${prefix}${k}`]));
      }
    }
    const texts = new Set(dictKeys('TEXT'));
    for (const r of emittedReasons()) expect(texts.has(r), `_line reason ${r} is in TEXT`).toBe(true);
    expect(SRC).toContain(`PROVIDER_ROW = {"href": "${WPS_PROVIDER_ROW_HREF}"`);
  });

  test('the two tables carry the same keys, and English carries no Hebrew', () => {
    expect(Object.keys(en).sort()).toEqual([...WPS_KEYS].sort());
    for (const k of WPS_KEYS) expect(en[k], k).not.toMatch(HEB);
  });

  test('Hebrew is the server text, unchanged', () => {
    const l = { key: 'bridge', label: 'תווית', reason: 'bridge_ok', text: 'טקסט', fix: 'תיקון', fix_code: 'bridge_silent', params: { version: '0.10.9' } };
    expect(wpsLineLabel(l, 'he')).toBe('תווית');
    expect(wpsLineText(l, 'he')).toBe('טקסט');
    expect(wpsLineFix(l, 'he')).toBe('תיקון');
    expect(wpsSteps(['א', 'ב'], ['entry_single', 'check_again'], {}, 'he')).toEqual(['א', 'ב']);
    expect(wpsProviderRowLabel({ href: WPS_PROVIDER_ROW_HREF, label: 'מקור' }, 'he')).toBe('מקור');
  });

  test('English: the sentence of the code, filled with the server values and words', () => {
    const ok = { key: 'bridge', label: 'x', reason: 'bridge_ok', text: 'x', fix: null, fix_code: null, params: { version: '0.10.9' } };
    expect(wpsLineLabel(ok, 'en')).toBe('Arx bridge in the system infrastructure');
    expect(wpsLineText(ok, 'en')).toBe('The bridge is installed (0.10.9) and paired; it sends a signed update every minute.');
    expect(wpsLineFix(ok, 'en')).toBeNull();
    const feed = { key: 'discovery', label: 'x', reason: 'discovery_feed', text: 'x', fix: 'y', fix_code: 'discovery_talk_missing',
      params: { video: 'כן', talk: 'לא', video_code: 'yes', talk_code: 'no' } };
    expect(wpsLineText(feed, 'en')).toBe('By the service channel: video yes, talk no (not checked on the direct connection).');
    expect(wpsLineFix(feed, 'en')).toBe(en.x_discovery_talk_missing);
    const silent = { key: 'bridge', label: 'x', reason: 'bridge_silent', text: 'x', fix: 'y', fix_code: 'bridge_silent', params: { since: 'הצימוד', since_code: 'pairing' } };
    expect(wpsLineText(silent, 'en')).toContain('since the pairing.');
    const events = { key: 'events', label: 'x', reason: 'events_ok', text: 'x', fix: null, fix_code: null,
      params: { at: 'T1', delivered: 3, duplicates: 0, caught: 'עברית', caught_at: 'T2', caught_code: 'until' } };
    expect(wpsLineText(events, 'en')).toBe('Last resume T1: 3 new events, 0 duplicates filtered. Arx is up to date until T2.');
    const gap = { key: 'events', label: 'x', reason: 'events_gap', text: 'x', fix: 'y', fix_code: 'events_gap',
      params: { start: 'לא ידוע', end: 'T2', why: 'עברית', start_code: 'unknown', why_code: 'retention_gap' } };
    expect(wpsLineText(gap, 'en')).toBe(`A gap in the door events: unknown to T2 (${en.v_why_retention_gap}). The events in this range did not reach Arx - the history there is incomplete.`);
    const err = { key: 'last_error', label: 'x', reason: 'error', text: 'x', fix: 'y', fix_code: 'error', params: { code: 'עברית', code_code: 'probe_timeout' } };
    expect(wpsLineText(err, 'en')).toBe('The check did not finish in time.');
    const raw = { key: 'last_error', label: 'x', reason: 'error', text: 'x', fix: 'y', fix_code: 'error', params: { code: 'media_x_failed' } };
    expect(wpsLineText(raw, 'en')).toBe('media_x_failed');
    expect(wpsSteps(['א', 'ב', 'ג', 'ד'], ['manual_delete', 'manual_add', 'manual_url', 'check_again'], { url: 'http://arx-addon.test:8099' }, 'en')).toEqual([
      en.s_manual_delete, 'Add integration › SMPLWISE Bridge.', 'Address: http://arx-addon.test:8099 · pairing code: the code shown here.', en.s_check_again,
    ]);
    expect(wpsProviderRowLabel({ href: WPS_PROVIDER_ROW_HREF, label: 'מקור' }, 'en')).toBe('Video and talk source');
  });

  test('English falls back to the server text: unknown reason / fix / step / word, missing values, an older server', () => {
    expect(wpsLineText({ key: 'bridge', label: 'x', reason: 'a_new_reason', text: 'חדש', fix: null }, 'en')).toBe('חדש');
    expect(wpsLineLabel({ key: 'a_new_line', label: 'שורה' }, 'en')).toBe('שורה');
    expect(wpsLineFix({ key: 'bridge', label: 'x', reason: 'r', text: 'x', fix: 'תיקון', fix_code: 'a_new_fix' }, 'en')).toBe('תיקון');
    // an older server: no fix_code - the server's fix; no params - a sentence without values still has its words
    expect(wpsLineFix({ key: 'bridge', label: 'x', reason: 'bridge_silent', text: 'x', fix: 'תיקון' }, 'en')).toBe('תיקון');
    expect(wpsLineText({ key: 'bridge', label: 'x', reason: 'bridge_not_paired', text: 'עברית', fix: null }, 'en')).toBe(en.l_bridge_not_paired);
    expect(wpsLineText({ key: 'bridge', label: 'x', reason: 'bridge_ok', text: 'עברית', fix: null }, 'en')).toBe('עברית');
    // a word the page has no English for: the whole line stays the server's
    expect(wpsLineText({ key: 'events', label: 'x', reason: 'events_gap', text: 'עברית', fix: null,
      params: { start: 'a', end: 'b', why: 'עברית', why_code: 'a_new_gap' } }, 'en')).toBe('עברית');
    expect(wpsSteps(['א', 'ב'], ['entry_single', 'a_new_step'], {}, 'en')).toEqual([en.s_entry_single, 'ב']);
    expect(wpsSteps(['א', 'ב'], ['entry_single'], {}, 'en')).toEqual(['א', 'ב']);
    expect(wpsSteps(['א'], undefined, {}, 'en')).toEqual(['א']);
    expect(wpsSteps(['כתובת'], ['manual_url'], {}, 'en')).toEqual(['כתובת']);
    expect(wpsProviderRowLabel({ href: '#/other', label: 'אחר' }, 'en')).toBe('אחר');
  });
});
