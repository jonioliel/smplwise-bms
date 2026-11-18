import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PACK_LANGS,
  ensureLangPack,
  installLangPack,
  langPackReady,
  packLangOf,
  packTable,
  setLangPackLoadersForTests,
  withEntries,
  type LangPack,
} from '../src/i18n/lang-packs';
import { elt, ELT_TABLES } from '../src/i18n/elevators';
import { t } from '../src/i18n/he';
import { en as heEn } from '../src/i18n/en';
import { PACK as EN_PACK } from '../src/i18n/lang/en';
import { PACK as AR_PACK } from '../src/i18n/lang/ar';
import { PACK as RU_PACK } from '../src/i18n/lang/ru';

// CR-I18N-LAZY-LANG-2443 (code review 07:F11, owner O4 = a): English / Arabic / Russian tables are language packs, one chunk per
// language, fetched only when the page is in that language; Hebrew stays in the modules. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-i18n-lang-packs-2443.spec.ts --workers=1

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const LANG_DIR = path.join(SRC, 'i18n', 'lang');

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/');

test.afterEach(async () => {
  setLangPackLoadersForTests(null);
  await Promise.all(PACK_LANGS.map(ensureLangPack)); // the real packs back in, for the next spec of this worker
});

test('packLangOf: the pack languages by <html lang> prefix; Hebrew and anything else have none', () => {
  expect(packLangOf('en')).toBe('en');
  expect(packLangOf('EN-gb')).toBe('en');
  expect(packLangOf('ar')).toBe('ar');
  expect(packLangOf('ru-RU')).toBe('ru');
  expect(packLangOf('he')).toBeNull();
  expect(packLangOf('')).toBeNull();
  expect(packLangOf('fr')).toBeNull();
  expect([...PACK_LANGS]).toEqual(['en', 'ar', 'ru']);
});

test('packTable is a live table: the same object before and after its pack, filled in place; kept entries are there at once', () => {
  const mod = 'spec/live-table';
  const table = packTable<{ a?: string; b?: string }>('en', mod, 'en');
  const before = withEntries(table, { tab: 'Tab' });
  expect(before).toBe(table);
  expect(before).toEqual({ tab: 'Tab' }); // the module's own entries, before any pack
  const kept = { en: before }; // a module's TABLES / registerCatalogue keep the reference
  installLangPack('en', { [mod]: { en: { a: 'A', b: 'B' } } });
  expect(kept.en).toBe(before);
  expect(before).toEqual({ tab: 'Tab', a: 'A', b: 'B' });
  expect(packTable('en', mod, 'en')).toBe(before);
  expect(packTable('ar', mod, 'en')).not.toBe(before); // per language
});

test('ensureLangPack: one request per language however many callers, installs the pack, and is ready afterwards', async () => {
  let calls = 0;
  const mod = 'spec/ensure';
  const pack: LangPack = { [mod]: { ru: { hello: 'Привет' } } };
  setLangPackLoadersForTests({ ru: async () => (calls++, { PACK: pack }) });
  expect(langPackReady('ru')).toBe(false);
  const table = packTable<{ hello?: string }>('ru', mod, 'ru');
  expect(table.hello).toBeUndefined();
  const [a, b] = await Promise.all([ensureLangPack('ru'), ensureLangPack('ru')]);
  expect([a, b]).toEqual([true, true]);
  expect(calls).toBe(1);
  expect(langPackReady('ru')).toBe(true);
  expect(table.hello).toBe('Привет');
  expect(await ensureLangPack('ru')).toBe(true);
  expect(calls).toBe(1);
});

test('ensureLangPack: a failed fetch answers false, leaves the page in Hebrew words and is tried again next time', async () => {
  let calls = 0;
  setLangPackLoadersForTests({
    ar: async () => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return { PACK: {} };
    },
  });
  expect(await ensureLangPack('ar')).toBe(false);
  expect(langPackReady('ar')).toBe(false);
  expect(await ensureLangPack('ar')).toBe(true);
  expect(calls).toBe(2);
});

test('the real packs: in Node every pack is installed while lang-packs.ts is evaluated, so the catalogues read as before', () => {
  for (const l of PACK_LANGS) expect(langPackReady(l), l).toBe(true);
  expect(ELT_TABLES.en.title).toBe('Elevators');
  expect(elt('title', undefined, 'en')).toBe('Elevators');
  expect(elt('title', undefined, 'he')).toBe('מעליות');
  expect(ELT_TABLES.ar.title).toBeTruthy();
  expect(ELT_TABLES.ar.title).not.toBe(ELT_TABLES.he.title);
  expect(heEn.app?.search).toBeTruthy();
  expect(heEn.frigate?.vendor).toBe('Frigate'); // the Frigate section is an extra of the base table, itself a live pack table
  expect(t('app.search')).toMatch(/[֐-׿]/); // Node has no <html lang>: Hebrew
});

test('the generated packs list every file under src/i18n/lang/<lang>/, and each file is pure data (imports only its own pack)', () => {
  const packs: Record<string, LangPack> = { en: EN_PACK, ar: AR_PACK, ru: RU_PACK };
  for (const l of PACK_LANGS) {
    const files = walk(path.join(LANG_DIR, l)).map((p) => path.relative(path.join(LANG_DIR, l), p).split(path.sep).join('/').replace(/\.ts$/, ''));
    expect(Object.keys(packs[l]).sort(), l).toEqual(files.sort());
    for (const f of walk(path.join(LANG_DIR, l))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)) {
        const target = path.resolve(path.dirname(f), m[1]);
        expect(target.startsWith(LANG_DIR + path.sep), `${rel(f)} imports ${m[1]}`).toBe(true);
      }
    }
    const index = readFileSync(path.join(LANG_DIR, `${l}.ts`), 'utf8');
    for (const m of index.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)) expect(m[1].startsWith(`./${l}/`), m[1]).toBe(true);
  }
});

test('no module of the application imports a pack file or a pack statically (it would put the words back in the entry chunk)', () => {
  const offenders: string[] = [];
  for (const f of walk(SRC)) {
    const r = rel(f);
    if (r.startsWith('i18n/lang/')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)) {
      const target = rel(path.resolve(path.dirname(f), m[1]));
      if (target.startsWith('i18n/lang/') || target === 'i18n/lang') offenders.push(`${r} -> ${m[1]}`);
    }
  }
  expect(offenders).toEqual([]);
  // the loader reaches them by dynamic import only
  const loader = readFileSync(path.join(SRC, 'i18n', 'lang-packs.ts'), 'utf8');
  for (const l of PACK_LANGS) expect(loader).toContain(`import('./lang/${l}')`);
});

test('no non-Hebrew table is written inline any more: a catalogue reads its English / Arabic / Russian through packTable', () => {
  // the declarations scripts/i18n-split-langs.mjs moves: `const en = {`, `export const PF_EN: X = {`, `msgCatalogue('msg/x', {`
  const INLINE = /^(?:export\s+)?const\s+(?:en|ar|ru|EN|AR|RU|[a-z]+(?:En|Ar|Ru)|en[A-Z]\w*|[A-Z0-9_]+_(?:EN|AR|RU))\s*(?::[^=]+)?=\s*\{/m;
  const offenders: string[] = [];
  for (const f of walk(SRC)) {
    const r = rel(f);
    if (r.startsWith('i18n/lang/') || r.startsWith('public-ticket/') || r.startsWith('notice-tv/') || r.startsWith('pwa/')) continue;
    if (r === 'format/bytes.ts') continue; // shared with the public pages (four unit names; see the next test)
    const src = readFileSync(f, 'utf8');
    if (INLINE.test(src) || /msgCatalogue\(\s*'[^']+',\s*\{/.test(src)) offenders.push(r);
  }
  expect(offenders).toEqual([]);
});

test('the public pages, the TV board and the service worker never reach the pack loader (their builds have no top-level await)', async () => {
  const esbuild = createRequire(path.resolve(HERE, '../package.json'))('esbuild') as typeof import('esbuild');
  for (const entry of ['public-ticket/main.ts', 'notice-tv/main.ts', 'pwa/sw.ts']) {
    const r = await esbuild.build({
      entryPoints: [path.join(SRC, entry)],
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      splitting: true,
      outdir: path.join(HERE, '.esbuild-unused'),
      logLevel: 'silent',
      loader: { '.css': 'text', '.svg': 'text', '.png': 'dataurl', '.woff2': 'dataurl' },
    });
    const reached = Object.keys(r.metafile.inputs).filter((p) => p.includes('i18n/lang-packs') || p.includes('i18n/lang/'));
    expect(reached, entry).toEqual([]);
  }
});

test('main.ts: the boot language first, then the pack wait, before any other module', () => {
  const lines = readFileSync(path.join(SRC, 'main.ts'), 'utf8').split('\n').filter((l) => l.startsWith('import '));
  expect(lines[0]).toContain("import './i18n/ui-lang-boot'");
  expect(lines[1]).toContain("import './i18n/lang-packs'");
});
