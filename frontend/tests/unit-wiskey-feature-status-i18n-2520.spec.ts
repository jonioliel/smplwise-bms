import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WFS_GROUP_SLUG,
  WFS_KEYS,
  WFS_LINK_SLUG,
  WFS_TABLES,
  wfsGroupLabel,
  wfsLinkLabel,
  wfsReasonFix,
  wfsReasonText,
  wfsRowLabel,
} from '../src/i18n/wiskey-feature-status';

// WISKEY-STATUS-I18N-2520: the "מצב WisKey" rows say their reasons in the page's language from the stable reason CODE. The list of codes,
// row keys, groups and links is read from the BACKEND SOURCE (services/wiskey_feature_status.py), so a reason added there without its
// words here fails this spec. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-feature-status-i18n-2520.spec.ts
const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../smplwise_vms/backend/smplwise/services/wiskey_feature_status.py');
const SRC = fs.readFileSync(BACKEND, 'utf8');
const HEB = /[\u0590-\u05FF]/;
const PH = /\{(\w+)\}/g;
const he = WFS_TABLES.he as Record<string, string>;
const en = WFS_TABLES.en as Record<string, string>;
const placeholders = (s: string) => [...s.matchAll(PH)].map((m) => m[1]).sort();
/** A Python double-quoted literal's body -> its value (the module uses only \" and \\ escapes). */
const unpy = (s: string) => s.replace(/\\(["\\])/g, '$1');

/** `R` of the backend: code -> [kind, text, fix]. Fails when an entry is not the plain shape `"code": ("KIND", "text", "fix"),`. */
function backendReasons(): Map<string, [string, string, string]> {
  const start = SRC.indexOf('\nR: dict[');
  expect(start, 'the R table is in the backend module').toBeGreaterThan(0);
  const end = SRC.indexOf('\n}\n', start);
  const block = SRC.slice(start, end);
  const codes = [...block.matchAll(/^ {4}"([a-z0-9_]+)": \(/gm)].map((m) => m[1]);
  const lit = '"((?:[^"\\\\]|\\\\.)*)"';
  const entry = new RegExp(`^ {4}"([a-z0-9_]+)": \\(${lit},\\s*${lit},\\s*${lit}\\),?`, 'gm');
  const out = new Map<string, [string, string, string]>();
  for (const m of block.matchAll(entry)) out.set(m[1], [m[2], unpy(m[3]), unpy(m[4])]);
  expect([...out.keys()], 'every R entry is parsed (a single literal per text and fix)').toEqual(codes);
  return out;
}

/** Every reason code the backend can emit: R, plus the literal codes built outside `_reason` (`check_failed`). */
function emittedCodes(r: Map<string, unknown>): string[] {
  const called = [...SRC.matchAll(/_reason\("([a-z0-9_]+)"/g)].map((m) => m[1]);
  for (const c of called) expect(r.has(c), `_reason("${c}") is in R`).toBe(true);
  const literal = [...SRC.matchAll(/"code": "([a-z0-9_]+)"/g)].map((m) => m[1]);
  return [...new Set([...r.keys(), ...literal])];
}

test.describe('WISKEY-STATUS-I18N-2520: the words of "מצב WisKey" per language', () => {
  test('every reason code the backend can emit has its Hebrew (equal to the server) and its English', () => {
    const r = backendReasons();
    const codes = emittedCodes(r);
    expect(codes.length).toBeGreaterThanOrEqual(34);
    expect(codes).toEqual(expect.arrayContaining(['listen_unknown', 'listen_offer_rejected', 'listen_no_downlink', 'check_failed']));
    for (const code of codes) {
      const heText = he[`r_${code}`];
      const enText = en[`r_${code}`];
      expect(heText, `he r_${code}`).toBeTruthy();
      expect(enText, `en r_${code}`).toBeTruthy();
      expect(enText, `en r_${code} has no Hebrew`).not.toMatch(HEB);
      expect(placeholders(enText), `en r_${code} has the same values`).toEqual(placeholders(heText));
      const b = r.get(code);
      if (b) {
        expect(heText, `he r_${code} is the server's sentence`).toBe(b[1]);
        expect(he[`f_${code}`], `he f_${code} is the server's fix`).toBe(b[2]);
        expect(en[`f_${code}`], `en f_${code}`).toBeTruthy();
        expect(en[`f_${code}`]).not.toMatch(HEB);
        expect(placeholders(en[`f_${code}`])).toEqual(placeholders(b[2]));
      }
    }
    // check_failed is built in rows() with the same sentence
    expect(SRC).toContain('f"לא ניתן לבדוק כרגע ({type(exc).__name__})."');
    expect(he.r_check_failed).toBe('לא ניתן לבדוק כרגע ({error}).');
  });

  test('every row, group and link of the backend has its words', () => {
    const rows = [...SRC.matchAll(/^ {4}\((\d+), "([a-z0-9_]+)", "([^"]+)", "([^"]+)",/gm)].map((m) => ({ key: m[2], group: m[3], label: m[4] }));
    expect(rows.length).toBeGreaterThanOrEqual(25);
    for (const row of rows) {
      expect(he[`row_${row.key}`], `he row_${row.key}`).toBe(row.label);
      expect(en[`row_${row.key}`], `en row_${row.key}`).toBeTruthy();
      expect(en[`row_${row.key}`]).not.toMatch(HEB);
      const slug = WFS_GROUP_SLUG[row.group];
      expect(slug, `group "${row.group}" has a slug`).toBeTruthy();
      expect(he[`grp_${slug}`]).toBe(row.group);
      expect(en[`grp_${slug}`]).toBeTruthy();
    }
    const links = [...SRC.matchAll(/^([A-Z_]+) = \{"href": "([^"]+)", "label": "([^"]+)"\}/gm)].map((m) => ({ href: m[2], label: m[3] }));
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const l of links) {
      const slug = WFS_LINK_SLUG[l.href];
      expect(slug, `link ${l.href} has a slug`).toBeTruthy();
      expect(he[`link_${slug}`]).toBe(l.label);
      expect(en[`link_${slug}`]).not.toMatch(HEB);
    }
  });

  test('the two tables carry the same keys, and English carries no Hebrew', () => {
    expect(Object.keys(en).sort()).toEqual([...WFS_KEYS].sort());
    for (const k of WFS_KEYS) expect(en[k], k).not.toMatch(HEB);
  });

  test('Hebrew is the server text, unchanged (even when the page has its own copy)', () => {
    const r = { code: 'listen_unknown', text: 'טקסט השרת', fix: 'תיקון השרת', params: {} };
    expect(wfsReasonText(r, 'he')).toBe('טקסט השרת');
    expect(wfsReasonFix(r, 'he')).toBe('תיקון השרת');
    expect(wfsRowLabel({ key: 'listen', label: 'תווית השרת' }, 'he')).toBe('תווית השרת');
    expect(wfsGroupLabel('מדיה ודיבור', 'he')).toBe('מדיה ודיבור');
    expect(wfsLinkLabel({ href: '#/system/setup', label: 'הגדרות › הקמה' }, 'he')).toBe('הגדרות › הקמה');
  });

  test('English: the sentence of the code, filled with the server values', () => {
    const listen = { code: 'listen_offer_rejected', text: 'עברית', fix: 'עברית', params: {} };
    expect(wfsReasonText(listen, 'en')).toBe(en.r_listen_offer_rejected);
    expect(wfsReasonFix(listen, 'en')).toBe(en.f_listen_offer_rejected);
    expect(wfsReasonText({ code: 'doors_unmapped', text: 'x', fix: 'y', params: { count: 3 } }, 'en')).toBe(
      '3 WisKey doors are not mapped to a relay on a station, and opening them is refused.',
    );
    expect(wfsReasonText({ code: 'direct_no_media', text: 'x', fix: 'y', params: { missing: 'media/talk_open, media/talk_close' } }, 'en')).toContain(
      ': media/talk_open, media/talk_close.',
    );
    expect(wfsReasonText({ code: 'join_starting', text: 'x', fix: 'y', params: { what: 'מתחבר', state: 'connecting' } }, 'en')).toBe(
      'The direct connection is connecting right now.',
    );
    expect(wfsReasonText({ code: 'check_failed', text: 'x', fix: null, params: { error: 'KeyError' } }, 'en')).toBe('It cannot be checked right now (KeyError).');
    expect(wfsReasonFix({ code: 'check_failed', text: 'x', fix: null, params: { error: 'KeyError' } }, 'en')).toBeNull();
    expect(wfsRowLabel({ key: 'listen', label: 'האזנה' }, 'en')).toBe('Listen to a station without a call');
    expect(wfsGroupLabel('דלתות', 'en')).toBe('Doors');
    expect(wfsLinkLabel({ href: '#/system/diagnostics?tab=access-control', label: 'x' }, 'en')).toBe('Settings › Entrance screen switches');
  });

  test('English falls back to the server text: unknown code, missing values, an older server, an unknown key / group / link', () => {
    expect(wfsReasonText({ code: 'a_new_code', text: 'חדש', fix: 'תיקון', params: {} }, 'en')).toBe('חדש');
    expect(wfsReasonFix({ code: 'a_new_code', text: 'חדש', fix: 'תיקון', params: {} }, 'en')).toBe('תיקון');
    // the values did not arrive: never a sentence with a hole in it
    expect(wfsReasonText({ code: 'doors_unmapped', text: '3 דלתות', fix: 'y', params: {} }, 'en')).toBe('3 דלתות');
    expect(wfsReasonText({ code: 'doors_unmapped', text: '3 דלתות', fix: 'y' }, 'en')).toBe('3 דלתות');
    expect(wfsReasonText({ code: 'doors_unmapped', text: '3 דלתות', fix: 'y', params: { count: null } as never }, 'en')).toBe('3 דלתות');
    expect(wfsReasonText({ code: 'join_starting', text: 'עברית', fix: 'y', params: { what: 'מתחבר' } }, 'en')).toBe('עברית');
    expect(wfsReasonText({ code: 'join_starting', text: 'עברית', fix: 'y', params: { what: 'x', state: 'weird' } }, 'en')).toBe('עברית');
    // an older server without `params`: a sentence without values still has its English
    expect(wfsReasonText({ code: 'listen_off', text: 'עברית', fix: 'y' }, 'en')).toBe(en.r_listen_off);
    expect(wfsRowLabel({ key: 'a_new_row', label: 'שורה' }, 'en')).toBe('שורה');
    expect(wfsGroupLabel('קבוצה חדשה', 'en')).toBe('קבוצה חדשה');
    expect(wfsLinkLabel({ href: '#/new', label: 'קישור' }, 'en')).toBe('קישור');
  });
});
