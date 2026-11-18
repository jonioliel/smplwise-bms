import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  CLIENT_CONFIRM_WORDS, CONFIRM_WORDS, confirmWord, confirmWordKeyOf, confirmWordLang, confirmWordMatches, confirmWordTyped, serverWordMatches,
  shownConfirmWord, type ConfirmWordKey,
} from '../src/i18n/confirm-words';
import { phraseMatches } from '../src/api/wiskey-managed';
import { codeFormProblem, phraseFor, shownPhraseFor } from '../src/api/door-tech';

// CR-I18N-CONFIRM-WORDS-2442 (owner decision 17.11): the words an operator types before a dangerous action. The server accepts the
// Hebrew word or its one fixed English counterpart; each interface language shows its own word and the screen sends what was typed.
// This spec proves: the word per language, the matcher (the server's rule - nothing looser), that the table is the server's table
// (smplwise_vms/backend/smplwise/services/confirm_words.py, read as text), and that no screen keeps a copy of a word.

type Doc = { documentElement: { lang: string } };
const g = globalThis as { document?: Doc };
function withLang<T>(lang: string, fn: () => T): T {
  const before = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (before === undefined) delete g.document;
    else g.document = before;
  }
}

const KEYS = Object.keys(CONFIRM_WORDS) as ConfirmWordKey[];
const VARS = { slot: 7 };
const HEBREW = /[֐-׿]/;

test('each interface language shows its own word: Hebrew in Hebrew, English in English, Hebrew in every other language', () => {
  for (const key of KEYS) {
    const { he, en } = CONFIRM_WORDS[key];
    const fill = (s: string) => s.replace('{slot}', '7');
    expect(withLang('he', () => confirmWord(key, VARS)), key).toBe(fill(he));
    expect(withLang('en', () => confirmWord(key, VARS)), key).toBe(fill(en));
    expect(withLang('en-GB', () => confirmWord(key, VARS)), key).toBe(fill(en));
    expect(withLang('ar', () => confirmWord(key, VARS)), key).toBe(fill(he)); // the server knows two words: Hebrew is the fallback
    expect(withLang('ru', () => confirmWord(key, VARS)), key).toBe(fill(he));
    expect(withLang('', () => confirmWord(key, VARS)), key).toBe(fill(he));
    expect(HEBREW.test(en), key).toBe(false);
    expect(HEBREW.test(he), key).toBe(true);
  }
  expect(withLang('he', () => confirmWordLang())).toBe('he');
  expect(withLang('en', () => confirmWordLang())).toBe('en');
  // the five words of the owner decision
  expect(withLang('en', () => [confirmWord('nvr_save_untested'), confirmWord('nvr_remove'), confirmWord('schedules_allow_disarm'), confirmWord('capture_lookup_wide'), confirmWord('installer_pulse')]))
    .toEqual(['save', 'remove', 'allow disarm', 'widen lookup', 'open door for test']);
  expect(withLang('he', () => [confirmWord('nvr_save_untested'), confirmWord('nvr_remove'), confirmWord('schedules_allow_disarm'), confirmWord('capture_lookup_wide'), confirmWord('installer_pulse')]))
    .toEqual(['שמור', 'הסר', 'אפשר נטרול', 'הרחב בירור', 'פתיחת דלת לבדיקה']);
  expect(withLang('en', () => confirmWord('door_code', { slot: 3 }))).toBe('code 3');
  expect(withLang('he', () => confirmWord('door_code', { slot: 3 }))).toBe('קוד 3');
  // the word only the browser compares
  expect(withLang('en', () => confirmWord('calendar_guest_purge'))).toBe('delete');
  expect(withLang('he', () => confirmWord('calendar_guest_purge'))).toBe('מחיקה');
});

test('the matcher takes the Hebrew word or the English word in EITHER interface language, and says which', () => {
  for (const lang of ['he', 'en']) {
    withLang(lang, () => {
      for (const key of KEYS) {
        const he = confirmWord(key, VARS, 'he');
        const en = confirmWord(key, VARS, 'en');
        expect(confirmWordTyped(key, he, VARS), key).toBe('he');
        expect(confirmWordTyped(key, `  ${he} `, VARS), key).toBe('he');
        expect(confirmWordTyped(key, en, VARS), key).toBe('en');
        expect(confirmWordTyped(key, ` ${en.toUpperCase()}  `, VARS), key).toBe('en');
        expect(confirmWordMatches(key, en[0].toUpperCase() + en.slice(1), VARS), key).toBe(true);
      }
    });
  }
});

test('a wrong word and every near-miss are refused', () => {
  for (const key of KEYS) {
    const he = confirmWord(key, VARS, 'he');
    const en = confirmWord(key, VARS, 'en');
    const other = KEYS.find((k) => k !== key && !CONFIRM_WORDS[k].he.includes('{') && CONFIRM_WORDS[k].he !== CONFIRM_WORDS[key].he)!;
    const bad: unknown[] = [
      'yes', '', '   ', null, undefined, 1, true, [en],
      `${en}s`, en.slice(0, -1), `${en}.`, he.slice(0, -1), `${he} ${en}`, `${en} ${he}`,
      en.replace(/[a-z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)), // full-width letters
      en.replace(/e/g, 'е').replace(/o/g, 'о').replace(/a/g, 'а'), // Cyrillic look-alikes
      CONFIRM_WORDS[other].en, CONFIRM_WORDS[other].he,
    ];
    if (en.includes(' ')) bad.push(en.replace(/ /g, ''), en.replace(' ', '  '), en.replace(/ /g, '-'), en.replace(' ', ' '), en.replace(' ', '\t'));
    for (const text of bad) {
      if (text === he || text === en) continue;
      expect(confirmWordTyped(key, text, VARS), `${key}: ${String(text)}`).toBeNull();
    }
  }
  expect(confirmWordMatches('nvr_save_untested', 'ſave')).toBe(false); // U+017F upper-cases to S: not ASCII, refused
  expect(confirmWordMatches('access_delete_person', 'deleted')).toBe(false);
  expect(confirmWordMatches('access_gone', 'delete')).toBe(false);
  expect(confirmWordMatches('door_code', 'code 2', { slot: 3 })).toBe(false);
  expect(confirmWordMatches('door_code', 'קוד 2', { slot: 3 })).toBe(false);
  expect(confirmWordMatches('door_code', 'Code 3', { slot: 3 })).toBe(true);
});

test('a word the server sends is shown in the interface language; a text that is not a fixed word is shown and compared as it is', () => {
  expect(withLang('en', () => shownConfirmWord('אשר'))).toBe('confirm');
  expect(withLang('he', () => shownConfirmWord('אשר'))).toBe('אשר');
  expect(withLang('en', () => shownConfirmWord('קוד {slot}', { slot: 4 }))).toBe('code 4');
  expect(withLang('he', () => shownConfirmWord('קוד {slot}', { slot: 4 }))).toBe('קוד 4');
  expect(withLang('en', () => shownConfirmWord('Main gate'))).toBe('Main gate');
  expect(withLang('en', () => shownConfirmWord('שער ראשי'))).toBe('שער ראשי'); // a station's name is data
  expect(confirmWordKeyOf('שעון השרת')).toBe('installer_host_clock');
  expect(confirmWordKeyOf('Main gate')).toBeUndefined();
  expect(confirmWordKeyOf(null)).toBeUndefined();
  expect(serverWordMatches('אשר', ' Confirm ')).toBe(true);
  expect(serverWordMatches('אשר', 'אשר')).toBe(true);
  expect(serverWordMatches('אשר', 'confirmed')).toBe(false);
  expect(serverWordMatches('Main gate', 'Main gate ')).toBe(true);
  expect(serverWordMatches('Main gate', 'main gate')).toBe(false); // a name is exact: no case folding
  expect(serverWordMatches('Main gate', 'server clock')).toBe(false);
  expect(serverWordMatches('', '')).toBe(false);
});

test('the screens helpers follow the same rule: the managed-install phrase and the door-code form', () => {
  const p = 'מאשר ניהול התקנה';
  expect(phraseMatches(p, p)).toBe(true);
  expect(phraseMatches(p.normalize('NFD'), p)).toBe(true); // the Hebrew comparison of that screen is kept (trimmed, NFC)
  expect(phraseMatches(' Approve Managed Install ', p)).toBe(true);
  expect(phraseMatches('approve managed', p)).toBe(false);
  expect(phraseMatches('approve environment risk', p)).toBe(false); // each switch its own phrase
  expect(phraseMatches('approve environment risk', 'מאשר סיכון סביבה')).toBe(true);
  const form = { action: 'clear' as const, expected: false, newCode: '', repeatCode: '', currentCode: '', phrase: phraseFor('קוד {slot}', 3), template: 'קוד {slot}', slot: 3 };
  expect(codeFormProblem({ ...form, typed: 'קוד 3' })).toBeNull();
  expect(codeFormProblem({ ...form, typed: ' CODE 3 ' })).toBeNull();
  expect(codeFormProblem({ ...form, typed: 'code 2' })).toBe('typed');
  expect(codeFormProblem({ ...form, typed: 'code3' })).toBe('typed');
  expect(withLang('en', () => shownPhraseFor('קוד {slot}', 3))).toBe('code 3');
  expect(withLang('he', () => shownPhraseFor('קוד {slot}', 3))).toBe('קוד 3');
});

test('the table is the server table: the same keys and the same two words (backend services/confirm_words.py)', () => {
  const py = readFileSync(new URL('../../smplwise_vms/backend/smplwise/services/confirm_words.py', import.meta.url), 'utf8');
  const rows = [...py.matchAll(/^\s+"(\w+)": Word\("([^"]+)", "([^"]+)"\),/gm)].map((m) => [m[1], { he: m[2], en: m[3] }] as const);
  expect(rows.length).toBeGreaterThanOrEqual(22);
  expect(Object.fromEntries(rows)).toEqual(CONFIRM_WORDS);
  expect(rows.map((r) => r[0])).toEqual(KEYS); // the same order, so a diff of the two files reads line by line
  for (const { he, en } of [...Object.values(CONFIRM_WORDS), ...Object.values(CLIENT_CONFIRM_WORDS)]) {
    expect(en).toBe(en.toLowerCase());
    expect(en).toMatch(/^[a-z]+( [a-z]+)*( \{slot\})?$/);
    expect(he).toBe(he.trim());
    expect(/[A-Za-z]/.test(he.replace('{slot}', ''))).toBe(false);
  }
});

test('no screen keeps its own copy of a word: the five words of the api layer come from the table', () => {
  const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  for (const [file, word] of [['api/nvr-connection.ts', 'שמור'], ['api/nvr-connection.ts', 'הסר'], ['api/schedules.ts', 'אפשר נטרול'], ['api/capture-lease.ts', 'הרחב בירור'], ['api/installer.ts', 'פתיחת דלת לבדיקה'],
    ['screens/access-external.ts', 'בטל הכל'], ['components/wk-door-tech.ts', 'קוד {slot}']] as const) {
    expect(read(file).includes(`'${word}'`), `${file}: ${word}`).toBe(false);
  }
  // the screens show the interface's word and compare with the matcher - never with a Hebrew constant
  for (const file of ['components/nvr-connection-form.ts', 'screens/system-lookup-scope.ts', 'screens/system-schedules.ts', 'screens/access-external.ts', 'access-external/identity-card.ts',
    'screens/wiskey-relay-map.ts', 'components/wk-installer-confirm.ts', 'screens/system-calendars.ts']) {
    const src = read(file);
    expect(/confirmWord|shownConfirmWord/.test(src), file).toBe(true);
    expect(/\.trim\(\) *[!=]== *(\w+\.)?(\w*_WORD|\w*_PHRASE|confirm_word|w)\b/.test(src), file).toBe(false);
  }
  // what is sent is what was typed
  expect(read('components/nvr-connection-form.ts')).toContain('confirm_text: this.word.trim()');
  expect(read('screens/access-external.ts')).toContain('revokeAll(this.word.trim())');
});
