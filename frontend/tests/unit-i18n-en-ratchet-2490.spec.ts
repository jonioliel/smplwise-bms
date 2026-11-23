import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// I18N-EN-2490 (owner O5): the English completeness ratchet. The missing-keys report (scripts/i18n_missing_keys.mjs) is run as it is
// and compared with docs/i18n/EN_RATCHET.json:
//   - no catalogue key shows Hebrew in English, and no English text differs from the Hebrew in its `{placeholders}`, except the
//     listed keys (each with its reason under "why"); a listed key that no longer is one fails too, so the lists only shrink;
//   - the hard-coded Hebrew literals outside the catalogues (they ignore the interface language) are at most the listed count per
//     module, and a module that is not listed has none.
// When a count goes down, lower the file with `node scripts/i18n_missing_keys.mjs --ratchet` (it refuses to raise a count).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');

interface Row { name: string; gapKeys: string[]; placeholderKeys: string[] }
interface Report { totals: { hardcodedLiterals: number }; catalogues: Row[]; hardcoded: { module: string; kind: string; literals: number }[] }
interface Ratchet { why: Record<string, string>; gapKeys: string[]; placeholderKeys: string[]; hardcodedTotal: number; hardcoded: Record<string, number> }

test.describe.configure({ timeout: 180_000 });

let report: Report;
let ratchet: Ratchet;
test.beforeAll(() => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'i18n_missing_keys.mjs'), '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  report = JSON.parse(out) as Report;
  ratchet = JSON.parse(readFileSync(path.join(ROOT, 'docs', 'i18n', 'EN_RATCHET.json'), 'utf8')) as Ratchet;
});

const listOf = (rows: Row[], f: 'gapKeys' | 'placeholderKeys'): string[] => rows.flatMap((r) => r[f].map((k) => `${r.name}: ${k}`)).sort();

test('every catalogue key has its English (only the listed, explained keys may show Hebrew)', () => {
  const now = listOf(report.catalogues, 'gapKeys');
  expect(now.filter((k) => !ratchet.gapKeys.includes(k)), 'new keys that show Hebrew in English: write their English in the en pack').toEqual([]);
  expect(ratchet.gapKeys.filter((k) => !now.includes(k)), 'listed keys that are fixed: run i18n_missing_keys.mjs --ratchet').toEqual([]);
  expect(ratchet.gapKeys.filter((k) => !ratchet.why[k]), 'every listed key says why').toEqual([]);
});

test('every English text names the same {placeholders} as the Hebrew (only the listed, explained keys differ)', () => {
  const now = listOf(report.catalogues, 'placeholderKeys');
  expect(now.filter((k) => !ratchet.placeholderKeys.includes(k)), 'English texts whose placeholders differ from the Hebrew').toEqual([]);
  expect(ratchet.placeholderKeys.filter((k) => !now.includes(k)), 'listed keys that are fixed: run i18n_missing_keys.mjs --ratchet').toEqual([]);
  expect(ratchet.placeholderKeys.filter((k) => !ratchet.why[k]), 'every listed key says why').toEqual([]);
});

test('hard-coded Hebrew outside the catalogues only goes down, per module', () => {
  const app = report.hardcoded.filter((r) => r.kind === 'app');
  const over = app.filter((r) => r.literals > (ratchet.hardcoded[r.module] ?? 0)).map((r) => `${r.module}: ${ratchet.hardcoded[r.module] ?? 0} -> ${r.literals}`);
  expect(over, 'new Hebrew text outside a catalogue: read it through tr() / the module catalogue and write its English').toEqual([]);
  expect(report.totals.hardcodedLiterals).toBeLessThanOrEqual(ratchet.hardcodedTotal);
  expect(ratchet.hardcodedTotal).toBe(Object.values(ratchet.hardcoded).reduce((a, n) => a + n, 0));
});

// the two label modules that became catalogues in this row: Hebrew as before, English once the page is in English
test.describe('event codes and neutral device labels follow the interface language', () => {
  type G = { document?: { documentElement: { lang: string } } };
  const g = globalThis as unknown as G;
  const withLang = async <T>(lang: string, fn: () => T | Promise<T>): Promise<T> => {
    const prev = g.document;
    g.document = { documentElement: { lang } };
    try {
      return await fn();
    } finally {
      if (prev === undefined) delete g.document;
      else g.document = prev;
    }
  };
  const A = '2026-10-06T08:00:00Z';
  const at = (s: number) => new Date(Date.parse(A) + s * 1000).toISOString();

  test('Hebrew is unchanged', async () => {
    const ec = await import('../src/i18n/event-codes');
    const el = await import('../src/i18n/entity-label');
    await withLang('he', () => {
      expect(ec.rawCodeLabel('VMD')).toBe('זיהוי תנועה');
      expect(ec.rawCodeLabel('constructor')).toBeNull();
      expect(ec.describeDeviceText('linedetection alarm')).toBe('התראת חציית קו');
      expect(ec.precisionLabel('verified')).toBe('מאומת');
      expect(ec.precisionLabel('toString')).toBeNull();
      expect([ec.spanText(A, at(49)), ec.spanText(A, at(185)), ec.spanText(A, at(3720)), ec.spanText(A, at(7200))]).toEqual(['49 שנ׳', '3 דק׳ 5 שנ׳', '1 שע׳ 2 דק׳', '2 שע׳']);
      expect(el.neutralLabel('light.hall')).toBe('תאורה ללא שם');
      expect(el.neutralLabel('weird.x')).toBe(el.NEUTRAL_LABEL);
      expect(el.neutralLabel('any.x')).toBe(el.NEUTRAL_LABEL);
      expect(el.entityLabel({ entity_id: 'lock.door', name: 'lock.door' })).toBe('מנעול ללא שם');
    });
  });

  test('English reads the en pack', async () => {
    const { installLangPack } = await import('../src/i18n/lang-packs');
    const { PACK } = await import('../src/i18n/lang/en');
    installLangPack('en', PACK);
    const ec = await import('../src/i18n/event-codes');
    const el = await import('../src/i18n/entity-label');
    await withLang('en-GB', () => {
      expect(ec.rawCodeLabel('VMD')).toBe('Motion detection');
      expect(ec.describeDeviceText('Motion alarm')).toBe('Motion detection alert');
      expect(ec.precisionLabel('keyframe_limited')).toBe('From a key frame');
      expect([ec.spanText(A, at(49)), ec.spanText(A, at(185)), ec.spanText(A, at(3720)), ec.spanText(A, at(7200))]).toEqual(['49 s', '3 min 5 s', '1 h 2 min', '2 h']);
      expect(el.neutralLabel('light.hall')).toBe('Unnamed light');
      expect(el.neutralLabel(undefined)).toBe('Unnamed device');
      expect(el.friendlyLabel(['', 'sensor.x'])).toBe('Unnamed device');
      expect(el.entityLabel({ entity_id: 'lock.door', name: 'lock.door' })).toBe('Unnamed lock');
    });
  });
});
