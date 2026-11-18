import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { registeredCatalogues } from '../src/i18n/core';
import type { Translator } from '../src/i18n/msg';
import { tr as trAutomation } from '../src/i18n/msg/api-automation';
import { tr as trCore } from '../src/i18n/msg/api-core';
import { tr as trDevices } from '../src/i18n/msg/api-devices';
import { tr as trElectricity } from '../src/i18n/msg/api-electricity';
import { tr as trHome } from '../src/i18n/msg/api-home';
import { tr as trMedia } from '../src/i18n/msg/api-media';
import { tr as trNotify } from '../src/i18n/msg/api-notify';
import { tr as trSystem } from '../src/i18n/msg/api-system';
import { tr as trTime } from '../src/i18n/msg/time';
import { tr as trVideo } from '../src/i18n/msg/api-video';
import { warningsHeading } from '../src/api/automations-ext';
import { describeError } from '../src/api/client';
import { elecErrorText } from '../src/api/electricity-billing';
import { hasHebrew, hebrewOutsideTr, trCalls, trModule } from './helpers/i18n-source-scan';

// CR-I18N-API-2442: the texts built in src/api/* (labels, error sentences, summaries the screens show as they are).
// Lint: a Hebrew string or template text in src/api/*.ts is the first argument of `tr(...)`, whose English lives in one of the
// tables src/i18n/msg/api-*.ts; a new Hebrew literal anywhere else fails here (comments are not read). What stays Hebrew on
// purpose is listed below with its reason; a listed text or count that no longer matches fails too, so the lists only shrink.
// Completeness: every `tr()` text has its English, the tables hold nothing else, both sides name the same `{placeholders}`, and
// the Hebrew interface shows the text exactly as written (the Hebrew is the key, so a Hebrew screen cannot move).
// CR-I18N-COMBINED-B-2442: the relative-time and weekday words of five api files are read from the shared table src/i18n/msg/time.ts
// (CR-I18N-DATES-2442) under the alias `trTime`; the lint accepts both translators, and the lists below lost the texts that moved.
// CR-I18N-UNITS-2442: the durations, the weekday letters and the weather units moved to the same table (73 literals left the lists,
// 107 -> 34); what is still listed as a format text is the Hebrew calendar date of api/home-config.ts.

const DIR = new URL('../src/api/', import.meta.url);
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.ts')).sort();
const read = (f: string): string => readFileSync(new URL(f, DIR), 'utf8');

const TABLES: Record<string, Translator> = {
  'msg/api-automation': trAutomation,
  'msg/api-core': trCore,
  'msg/api-devices': trDevices,
  'msg/api-electricity': trElectricity,
  'msg/api-home': trHome,
  'msg/api-media': trMedia,
  'msg/api-notify': trNotify,
  'msg/api-system': trSystem,
  'msg/api-video': trVideo,
};

/** Whole files that stay Hebrew: the demo stores (never shown outside the demo mode). */
const DEMO_FILE = /-mock\.ts$|-demo\.ts$|^messaging-fake\.ts$/;
/** Whole files that stay as they are, with the reason. */
const OWN_FILES: Record<string, string> = {
  'closed-errors.ts': 'carries its own he / en pair per code and picks by the document language (UI2122)',
};

const DEMO = 'the demo store of the module (fake data and the demo server\'s answers, never shown outside the demo mode)';
/** The second translator of an api file: the shared time words (`import { tr as trTime } from '../i18n/msg/time'`). */
const TRANSLATORS = ['tr', 'trTime'];
const HEBREW_DATE = 'the Hebrew calendar date, Hebrew in both languages until the owner decides otherwise (docs/changes/CR-I18N-UNITS-2442.md, owner question 1): the letters of gematria 29, its geresh / gershayim 2, the two particles of hebrewDate 2, the word of parshaText 1';
// CR-I18N-CONFIRM-WORDS-2442 (owner decision 17.11): the typed confirmation words left src/api - they live, with their English
// counterparts, in src/i18n/confirm-words.ts (tests/unit-confirm-words-2442.spec.ts), so the four entries that listed them are gone.

/**
 * Literals that stay Hebrew in a file that is otherwise translated. `texts` are named one by one (each as many times as it is
 * written); `count` is the number of further literals of the stated kind (a block of demo data or a format helper).
 */
const KEPT: Record<string, { why: string; count?: number; texts?: string[] }> = {
  'automations.ts': { why: 'the maqaf the verb table is tested for', texts: ['־'] },
  'calendar-attendees.ts': { why: DEMO, count: 5 },
  'door-automations.ts': { why: DEMO, count: 4 },
  'electricity-meters.ts': { why: DEMO, count: 6 },
  'electricity-readings.ts': { why: DEMO, count: 25 },
  'ha-users.ts': { why: DEMO, count: 14 },
  'home-config.ts': { why: HEBREW_DATE, count: 34 },
  'incidents.ts': { why: DEMO, count: 39 },
  'mapping-engine.ts': { why: 'data: the building marker of the naming rule and the name saved for a new building', texts: ['בניין', 'משותף', 'בניין'] },
  'mapping.ts': { why: DEMO, count: 3 },
  'media-admin.ts': { why: DEMO, count: 39 },
  'messaging-accounts.ts': { why: DEMO, count: 11 },
  'messaging-policy.ts': { why: DEMO, count: 2 },
  'notify-whatsapp.ts': { why: DEMO, count: 9 },
  'nvr-settings.ts': { why: DEMO, count: 25 },
  'readiness.ts': { why: DEMO, count: 48 },
  'setup.ts': { why: DEMO, count: 82 },
  'tickets-board.ts': { why: DEMO, count: 6 },
  'tickets-locations.ts': { why: DEMO, count: 15 },
  'tickets-messages.ts': { why: `${DEMO}; its starter message templates are texts sent to people`, count: 14 },
  'tickets-rules.ts': { why: DEMO, count: 20 },
  'tts-default.ts': { why: 'the name of the Hebrew language in Hebrew (each language is listed in its own script)', texts: ['עברית', 'עברית'] },
};

const translated = (f: string): boolean => !DEMO_FILE.test(f) && !(f in OWN_FILES);

/** The Hebrew literals of a file that are neither a `tr()` text nor named; and the named texts that were not found. */
function check(rel: string, source: string): { extra: string[]; stale: string[] } {
  const left = [...(KEPT[rel]?.texts ?? [])];
  const extra: string[] = [];
  for (const lit of hebrewOutsideTr(rel, source, TRANSLATORS)) {
    const i = left.indexOf(lit.text);
    if (i >= 0) left.splice(i, 1);
    else extra.push(`${rel}:${lit.line}: ${lit.text.slice(0, 70)}`);
  }
  return { extra, stale: left.map((t) => `${rel}: ${t}`) };
}

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
const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('lint: no Hebrew literal in src/api/* outside tr(), the demo stores and the lists', () => {
  const extra: string[] = [];
  const stale: string[] = [];
  const counts: string[] = [];
  for (const f of FILES.filter(translated)) {
    const r = check(f, read(f));
    stale.push(...r.stale);
    const allowed = KEPT[f]?.count ?? 0;
    if (r.extra.length !== allowed) {
      counts.push(`${f}: ${r.extra.length} Hebrew literals outside tr(), the list allows ${allowed}`);
      if (r.extra.length > allowed) extra.push(...r.extra);
    }
  }
  expect(counts, `wrap the text in tr() and add its English to src/i18n/msg/api-*.ts (or lower the count in KEPT)\n${extra.join('\n')}`).toEqual([]);
  expect(stale, 'the literal is gone: remove it from KEPT').toEqual([]);
});

test('lint: the lists name real files that still hold Hebrew, and no demo store calls tr()', () => {
  for (const f of [...Object.keys(KEPT), ...Object.keys(OWN_FILES)]) expect(FILES.includes(f), f).toBe(true);
  for (const f of Object.keys(KEPT)) expect(translated(f), `${f} is listed twice`).toBe(true);
  for (const f of Object.keys(OWN_FILES)) expect(hebrewOutsideTr(f, read(f)).length, `${f}: no Hebrew left - remove it from OWN_FILES`).toBeGreaterThan(0);
  for (const f of FILES.filter((x) => DEMO_FILE.test(x))) expect(trModule(read(f)), `${f}: a demo store stays Hebrew`).toBeNull();
});

test('lint: catches a new literal - plain string, template text, a second copy of a named text; comments and tr() pass', () => {
  const src = (body: string): string => `import { tr } from '../i18n/msg/api-core';\n// הערה בעברית\n/** עוד הערה */\n${body}\n`;
  const found = (body: string, rel = 'new-file.ts'): string[] => check(rel, src(body)).extra;
  expect(found("export const a = tr('שלום');")).toEqual([]);
  expect(found("export const a = tr('עוד {n} פריטים', { n: 3 });")).toEqual([]);
  expect(found("export const a = 'שלום';")).toHaveLength(1);
  expect(found('export const a = `שלום`;')).toHaveLength(1);
  expect(found('export const a = (n: number) => `עוד ${n} פריטים`;')).toHaveLength(2); // both static parts
  expect(found("export const a = tr('שלום') + 'עולם';")).toHaveLength(1);
  expect(found('export const a = tr(`עוד ${1} פריטים`);')).toHaveLength(2); // a template with a value is not a catalogue key
  expect(found("export const a: Record<string, string> = { x: 'שלום' };")).toHaveLength(1);
  expect(found("export const a = 'עברית';", 'tts-default.ts')).toEqual([]);
  expect(found("export const a = ['עברית', 'עברית', 'עברית'];", 'tts-default.ts')).toHaveLength(1);
  expect(check('tts-default.ts', src('export const a = 1;')).stale).toHaveLength(2);
});

interface Used {
  /** text -> the first file that uses it */
  keys: Map<string, string>;
  files: string[];
}
function usedBy(module: string): Used {
  const out: Used = { keys: new Map(), files: [] };
  for (const f of FILES) {
    const source = read(f);
    if (trModule(source) !== module) continue;
    out.files.push(f);
    for (const k of trCalls(f, source).keys) if (!out.keys.has(k)) out.keys.set(k, f);
  }
  return out;
}

test('completeness: every api file that calls tr() takes it from one api table, with a plain literal', () => {
  const wrong: string[] = [];
  const notLiteral: string[] = [];
  let files = 0;
  for (const f of FILES) {
    const source = read(f);
    const calls = trCalls(f, source);
    if (!calls.keys.length && !calls.notLiteral.length) continue;
    files++;
    const m = trModule(source);
    if (!m || !(m in TABLES)) wrong.push(`${f}: tr comes from ${m ?? 'somewhere else'}`);
    notLiteral.push(...calls.notLiteral.map((x) => `${f}:${x}`));
  }
  expect(wrong).toEqual([]);
  expect(notLiteral, 'the first argument of tr() is a plain literal; values go through {name}').toEqual([]);
  expect(files).toBeGreaterThan(50);
});

for (const [module, tr] of Object.entries(TABLES)) {
  test(`completeness: ${module} - every tr() text has its English, and the table holds no text the api files do not use`, () => {
    const used = usedBy(module);
    expect(used.files.length, `no api file reads ${module}`).toBeGreaterThan(0);
    const missing = [...used.keys].filter(([k]) => !(k in tr.en)).map(([k, f]) => `${f}: ${k}`);
    expect(missing, `add the English to src/i18n/${module}.ts`).toEqual([]);
    const unused = Object.keys(tr.en).filter((k) => !used.keys.has(k));
    expect(unused, `not used by src/api/*: remove from src/i18n/${module}.ts`).toEqual([]);
  });

  test(`completeness: ${module} - the English is English, with the same placeholders; Hebrew shows the source text`, () => {
    const hebrewLeft: string[] = [];
    const empty: string[] = [];
    const names: string[] = [];
    for (const [he, en] of Object.entries(tr.en)) {
      if (hasHebrew(en)) hebrewLeft.push(`${he} -> ${en}`);
      if (!en.trim()) empty.push(he);
      if (placeholders(he) !== placeholders(en)) names.push(`${he} -> ${en}`);
    }
    expect(hebrewLeft).toEqual([]);
    expect(empty).toEqual([]);
    expect(names).toEqual([]);
    const keys = Object.keys(tr.en);
    const vars = { n: 3, name: 'א', v: 'x', v2: 'y', v3: 'z', to: 't', total: 9, status: 500 };
    const legacyFill = (raw: string): string => raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String((vars as Record<string, unknown>)[k]) : m));
    withLang('he', () => {
      for (const k of keys) {
        expect(tr(k)).toBe(k);
        expect(tr(k, vars)).toBe(legacyFill(k));
      }
    });
    withLang('en', () => {
      for (const k of keys) {
        expect(tr(k)).toBe(tr.en[k]);
        expect(tr(k, vars)).toBe(legacyFill(tr.en[k]));
      }
      expect(tr('טקסט שאין בטבלה')).toBe('טקסט שאין בטבלה'); // a text without English stays Hebrew, it never disappears
    });
    const cat = registeredCatalogues().find((c) => c.name === module);
    expect(cat, `${module} is registered for the missing-keys report`).toBeTruthy();
    expect(Object.keys(cat!.tables.en ?? {})).toHaveLength(keys.length);
  });
}

test('the shared time words: an api file reads them as trTime from msg/time, every text has its English, and the lists hold no moved text', () => {
  const readers: string[] = [];
  const missing: string[] = [];
  const notLiteral: string[] = [];
  for (const f of FILES) {
    const source = read(f);
    const calls = trCalls(f, source, ['trTime']);
    if (!calls.keys.length && !calls.notLiteral.length) continue;
    readers.push(f);
    expect(source, `${f}: trTime is the translator of msg/time`).toMatch(/import \{ tr as trTime \} from '\.\.\/i18n\/msg\/time';/);
    missing.push(...calls.keys.filter((k) => !(k in trTime.en)).map((k) => `${f}: ${k}`));
    notLiteral.push(...calls.notLiteral.map((x) => `${f}:${x}`));
  }
  expect(readers).toEqual(['automations.ts', 'frigate.ts', 'health.ts', 'home-config.ts', 'notifications.ts', 'remote.ts', 'rules.ts', 'schedules.ts']);
  expect(missing, 'add the English to src/i18n/msg/time.ts').toEqual([]);
  expect(notLiteral).toEqual([]);
  // what DATES moved is read through trTime and is no longer allow-listed: seen by `tr` alone, each of these files would hold more
  // Hebrew literals than its list allows (remote.ts has no list at all)
  for (const f of readers) expect(hebrewOutsideTr(f, read(f)).length, f).toBeGreaterThan(hebrewOutsideTr(f, read(f), TRANSLATORS).length);
  for (const f of ['frigate.ts', 'health.ts', 'notifications.ts', 'remote.ts', 'rules.ts']) expect(f in KEPT, `${f} holds no Hebrew outside its translators`).toBe(false);
  // CR-I18N-UNITS-2442: the allow-list of format texts is the Hebrew calendar date alone - 34 literals in one file
  expect(Object.entries(KEPT).filter(([, k]) => k.why === HEBREW_DATE).map(([f, k]) => [f, k.count])).toEqual([['home-config.ts', 34]]);
});

test('completeness: no table carries a key twice in its source (a later line would silently win)', () => {
  let all = 0;
  for (const module of Object.keys(TABLES)) {
    const source = readFileSync(new URL(`../src/i18n/${module}.ts`, import.meta.url), 'utf8');
    const seen = new Set<string>();
    const twice: string[] = [];
    for (const m of source.matchAll(/^\s*'((?:\\.|[^'\\])+)'\s*:/gm)) {
      if (seen.has(m[1])) twice.push(`${module}: ${m[1]}`);
      seen.add(m[1]);
    }
    expect(twice).toEqual([]);
    expect(seen.size).toBe(Object.keys(TABLES[module].en).length);
    all += seen.size;
  }
  expect(all).toBeGreaterThan(1500);
});

test('behaviour: the helpers answer in the document language at call time; Hebrew reads exactly as before', () => {
  withLang('he', () => {
    expect(warningsHeading(1)).toBe('אזהרה אחת');
    expect(warningsHeading(3)).toBe('3 אזהרות');
    expect(describeError(new TypeError('x'))).toBe('אין חיבור לשרת.');
    expect(elecErrorText(new TypeError('x'))).toBe('אין חיבור לשרת.');
  });
  withLang('en', () => {
    expect(warningsHeading(1)).toBe('1 warning');
    expect(warningsHeading(3)).toBe('3 warnings');
    expect(describeError(new TypeError('x'))).toBe('No connection to the server.');
    expect(elecErrorText(new TypeError('x'))).toBe('No connection to the server.');
  });
});
