import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// I18N-ARRU-2550: Arabic / Russian completeness of the catalogues that offer those languages. The missing-keys report
// (scripts/i18n_missing_keys.mjs --lang ar / --lang ru) is run as it is and compared with docs/i18n/ARRU_COMPLETENESS.json:
//   - the catalogues with an Arabic and a Russian table are exactly the listed `fourLanguage` ones (a catalogue does not lose a
//     language silently; a new four-language catalogue is listed by hand). Every other catalogue is Hebrew / English only on purpose;
//   - in a four-language catalogue every Hebrew key has its Arabic and its Russian text (no key shows Hebrew there), with the same
//     `{placeholders}` as the Hebrew, and no text in the other language's letters - except the listed keys, each with its reason
//     under "why"; a listed key that no longer is one fails too, so the lists only shrink.
// A new key in such a catalogue therefore fails here until its ar / ru words are written (or it is listed with a reason).
//   npx playwright test -c playwright.unit.config.ts tests/unit-i18n-arru-completeness-2550.spec.ts --workers=1

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');

type Lang = 'ar' | 'ru';
interface Row { name: string; hasTable: boolean; keys: number; gapKeys: string[]; placeholderKeys: string[]; scriptKeys?: string[] }
interface Report { catalogues: Row[] }
interface Lists {
  why: Record<string, string>;
  fourLanguage: string[];
  gapKeys: Record<Lang, string[]>;
  placeholderKeys: Record<Lang, string[]>;
  scriptKeys: Record<Lang, string[]>;
}

test.describe.configure({ timeout: 300_000 });

const reports = {} as Record<Lang, Row[]>;
let lists: Lists;
test.beforeAll(() => {
  for (const lang of ['ar', 'ru'] as const) {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'i18n_missing_keys.mjs'), '--json', '--lang', lang], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    reports[lang] = (JSON.parse(out) as Report).catalogues;
  }
  lists = JSON.parse(readFileSync(path.join(ROOT, 'docs', 'i18n', 'ARRU_COMPLETENESS.json'), 'utf8')) as Lists;
});

const withTable = (lang: Lang): Row[] => reports[lang].filter((r) => r.hasTable);
const listOf = (rows: Row[], f: 'gapKeys' | 'placeholderKeys' | 'scriptKeys'): string[] => rows.flatMap((r) => (r[f] ?? []).map((k) => `${r.name}: ${k}`)).sort();

test('the four-language catalogues are the listed ones, each with an Arabic and a Russian table', () => {
  for (const lang of ['ar', 'ru'] as const) {
    const now = withTable(lang).map((r) => r.name).sort();
    expect(now.filter((n) => !lists.fourLanguage.includes(n)), `catalogues with a ${lang} table that are not listed: add them to fourLanguage`).toEqual([]);
    expect(lists.fourLanguage.filter((n) => !now.includes(n)), `listed catalogues without a ${lang} table`).toEqual([]);
  }
  expect(lists.fourLanguage.length).toBeGreaterThan(30);
});

for (const lang of ['ar', 'ru'] as const) {
  test(`${lang}: every key of a four-language catalogue has its ${lang} text (only the listed, explained keys may show Hebrew)`, () => {
    const now = listOf(withTable(lang), 'gapKeys');
    expect(now.filter((k) => !lists.gapKeys[lang].includes(k)), `keys that show Hebrew on a ${lang} page: write their ${lang} words in src/i18n/lang/${lang}/`).toEqual([]);
    expect(lists.gapKeys[lang].filter((k) => !now.includes(k)), 'listed keys that are fixed: remove them from ARRU_COMPLETENESS.json').toEqual([]);
    expect(lists.gapKeys[lang].filter((k) => !lists.why[k]), 'every listed key says why').toEqual([]);
    expect(withTable(lang).reduce((a, r) => a + r.keys, 0)).toBeGreaterThan(3000);
  });

  test(`${lang}: every ${lang} text names the same {placeholders} as the Hebrew and uses no other language's letters`, () => {
    for (const f of ['placeholderKeys', 'scriptKeys'] as const) {
      const now = listOf(withTable(lang), f);
      expect(now.filter((k) => !lists[f][lang].includes(k)), `${lang} texts (${f}) to fix`).toEqual([]);
      expect(lists[f][lang].filter((k) => !now.includes(k)), 'listed keys that are fixed: remove them from ARRU_COMPLETENESS.json').toEqual([]);
      expect(lists[f][lang].filter((k) => !lists.why[k]), 'every listed key says why').toEqual([]);
    }
  });
}
