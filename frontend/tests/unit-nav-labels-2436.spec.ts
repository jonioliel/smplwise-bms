import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../src/i18n/nav-labels';
import { navGeneratorPage, navRfqTitle } from '../src/i18n/nav-label-bridges';
import { tt, ticketsSectionLabel, TICKET_TEXT_KEYS } from '../src/tickets/text';
import { bt } from '../src/tickets/board-text';
import { ot } from '../src/tickets/overview-text';
import { ct } from '../src/tickets/cost-text';
import { rt } from '../src/tickets/rfq-text';
import { xt, XT_TABLES } from '../src/i18n/access-external';
import { dwt } from '../src/i18n/door-windows';
import { announceText } from '../src/i18n/announce';
import { tst, TST_KEYS } from '../src/i18n/tab-sections';
import { mt } from '../src/i18n/maintenance';
import { ix } from '../src/i18n/insights';
import { tr } from '../src/i18n/transit';
import { xt as xsText } from '../src/i18n/xsection';
import { pt } from '../src/i18n/presence';
import { it as incText } from '../src/i18n/incidents';
import { he } from '../src/i18n/he';
import * as model from '../src/elevators/model';
import * as personal from '../src/elevators/personal-mode';

// CR-NAV-LABELS-2436 (review 07:F3, 08:F02): the shell reads its tab labels from i18n/nav-labels.ts, not from fifteen whole dictionaries.
// Node-only: the import graph is read from the source, the labels are compared getter by getter in every column of every family.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string): string => readFileSync(path.join(SRC, rel), 'utf8');

/** The runtime imports of a module (type-only imports carry no code into a chunk), as src-relative paths ('lit' etc. stay bare). */
function runtimeImports(rel: string): string[] {
  const out: string[] = [];
  for (const m of read(rel).matchAll(/^import\s+(?:(type)\s+)?([\s\S]*?)\s+from\s+'([^']+)';/gm)) {
    if (m[1]) continue;
    const names = /^\{([\s\S]*)\}$/.exec(m[2].trim());
    if (names && names[1].split(',').map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith('type '))) continue;
    out.push(resolve(rel, m[3]));
  }
  for (const m of read(rel).matchAll(/^import\s+'([^']+)';/gm)) out.push(resolve(rel, m[1]));
  return out;
}
function resolve(from: string, to: string): string {
  return to.startsWith('.') ? `${path.posix.normalize(path.posix.join(path.posix.dirname(from), to)).replace(/\.ts$/, '')}.ts` : to;
}
/** A dictionary module: a table of words (every i18n/ module but the two shell ones, every tickets text catalogue). */
const isDictionary = (r: string): boolean => (/^i18n\//.test(r) && !/^i18n\/nav-label(s|-bridges)\.ts$/.test(r)) || /^tickets\/([\w-]+-)?text(-[\w-]+)?\.ts$/.test(r);

test('the classifier knows a dictionary from a shell label module', () => {
  for (const r of ['i18n/he.ts', 'i18n/access-external.ts', 'tickets/text.ts', 'tickets/text-s4.ts', 'tickets/rfq-text.ts', 'tickets/board-text.ts']) expect(isDictionary(r), r).toBe(true);
  for (const r of ['i18n/nav-labels.ts', 'i18n/nav-label-bridges.ts', 'tickets/naming.ts', 'tickets/gate.ts', 'shell/nav-capabilities.ts']) expect(isDictionary(r), r).toBe(false);
});

test('nav.ts imports no dictionary module (its labels come from i18n/nav-labels.ts)', () => {
  const imps = runtimeImports('shell/nav.ts');
  expect(imps.filter(isDictionary)).toEqual([]);
  expect(imps).toContain('i18n/nav-labels.ts');
});

test('nav-labels.ts is a leaf (only tickets/naming.ts, which imports nothing); the bridges read exactly the two dictionaries this branch leaves alone', () => {
  expect(runtimeImports('i18n/nav-labels.ts')).toEqual(['tickets/naming.ts']);
  expect(runtimeImports('tickets/naming.ts')).toEqual([]);
  expect(runtimeImports('i18n/nav-label-bridges.ts').sort()).toEqual(['i18n/he.ts', 'tickets/rfq-text.ts']);
});

test('the notifications client and the personal home sheet import no feature text or model for one name', () => {
  expect(runtimeImports('api/notifications.ts').filter((r) => /^tickets\/([\w-]+-)?text/.test(r))).toEqual([]);
  expect(runtimeImports('shell/sw-home-personal.ts')).not.toContain('elevators/model.ts');
  expect(runtimeImports('shell/sw-home-personal.ts')).toContain('elevators/personal-mode.ts');
  expect(model.MODE_KEY).toBe(personal.MODE_KEY);
  expect(model.personalHidden).toBe(personal.personalHidden);
  expect(model.toggled).toBe(personal.toggled);
  expect(personal.personalHidden(['a'], 'b', false)).toEqual(['a', 'b']);
  expect(personal.personalHidden(['a', 'b'], 'b', true)).toEqual(['a']);
});

/** Run `fn` with the document language set to `lang` (the getters read `document.documentElement.lang`). */
function withLang<T>(lang: string, fn: () => T): T {
  const g = globalThis as { document?: unknown };
  const prev = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}
const LANGS4 = ['he', 'en', 'ar', 'ru'] as const;
const DOC_LANGS = ['he', 'en', 'ar', 'ru', 'en-GB', ''];

test('every label reads the same through nav-labels as through its dictionary, in every document language', () => {
  const vars = { name: 'NAME', section: 'SECTION' };
  for (const doc of DOC_LANGS) {
    withLang(doc, () => {
      for (const k of Object.keys(L.NAV_TT.he) as L.NavTtKey[]) expect(L.navTt(k), `${doc} tt ${k}`).toBe(tt(k));
      for (const s of ['requests', 'maintenance', 'vendors', 'reports', 'other']) for (const short of [false, true]) expect(L.ticketsSectionLabel(s, short)).toBe(ticketsSectionLabel(s, short));
      expect(L.navBt('tabBoard')).toBe(bt('tabBoard'));
      expect(L.navOt('tab')).toBe(ot('tab'));
      expect(L.navCt('vaTitle')).toBe(ct('vaTitle'));
      expect(L.navXt('tab')).toBe(xt('tab'));
      expect(L.navDwt('tab')).toBe(dwt('tab'));
      expect(L.navAnnounce('title')).toBe(announceText().title);
      for (const k of Object.keys(L.NAV_TST.he) as L.NavTstKey[]) expect(L.navTst(k, vars), `${doc} tst ${k}`).toBe(tst(k, vars));
      expect(L.navMt('section')).toBe(mt('section'));
      expect(L.navIx('pageBuilding')).toBe(ix('pageBuilding'));
      expect(L.navTr('tab')).toBe(tr('tab'));
      expect(L.navXs('synTab')).toBe(xsText('synTab'));
      expect(L.navPt('tab')).toBe(pt('tab'));
      expect(L.navIt('tab')).toBe(incText('tab'));
      expect(navRfqTitle()).toBe(rt('navTitle'));
      for (const id of ['live', 'alerts', 'charts', 'history', 'log'] as const) expect(navGeneratorPage(id)).toBe(he.generator.pages[id]);
    });
  }
  for (const lang of LANGS4) {
    expect(L.navXt('tab', undefined, lang)).toBe(xt('tab', undefined, lang));
    expect(L.navXt('tab', undefined, lang)).toBe(XT_TABLES[lang].tab);
    expect(L.navDwt('tab', undefined, lang)).toBe(dwt('tab', undefined, lang));
    expect(L.navAnnounce('title', lang)).toBe(announceText(lang).title);
    expect(L.navMt('section', undefined, lang)).toBe(mt('section', undefined, lang));
    for (const k of Object.keys(L.NAV_TST.he) as L.NavTstKey[]) expect(L.navTst(k, vars, lang)).toBe(tst(k, vars, lang));
  }
  // the moved keys are still keys of their dictionaries (completeness tests and key lists unchanged)
  for (const k of Object.keys(L.NAV_TT.he)) expect(TICKET_TEXT_KEYS).toContain(k);
  for (const k of Object.keys(L.NAV_TST.he)) expect(TST_KEYS).toContain(k);
});

test('no string exists twice: each moved value is a reference in its dictionary, its one literal lives in nav-labels.ts', () => {
  const FAMILIES: [string, string, string[]][] = [
    ['TT', 'tickets/text.ts', ['he', 'en']],
    ['BT', 'tickets/board-text.ts', ['he', 'en']],
    ['OT', 'tickets/overview-text.ts', ['he', 'en']],
    ['CT', 'tickets/cost-text.ts', ['he', 'en']],
    ['XT', 'i18n/access-external.ts', [...LANGS4]],
    ['DWT', 'i18n/door-windows.ts', [...LANGS4]],
    ['ANNOUNCE', 'i18n/announce.ts', [...LANGS4]],
    ['TST', 'i18n/tab-sections.ts', [...LANGS4]],
    ['MT', 'i18n/maintenance.ts', ['he', 'en']],
    ['IX', 'i18n/insights.ts', ['he', 'en']],
    ['TR', 'i18n/transit.ts', ['he', 'en']],
    ['XS', 'i18n/xsection.ts', ['he', 'en']],
    ['PT', 'i18n/presence.ts', ['he', 'en']],
    ['IT', 'i18n/incidents.ts', ['he', 'en']],
  ];
  const tables = L as unknown as Record<string, Record<string, Record<string, string>>>;
  for (const [fam, file, langs] of FAMILIES) {
    const table = tables[`NAV_${fam}`];
    expect(Object.keys(table).sort(), fam).toEqual([...langs].sort());
    const src = fam === 'TT' ? read(file) + read('tickets/text-s4.ts') : read(file);
    for (const lang of langs) {
      for (const key of Object.keys(table[lang])) {
        const ref = `${key}: NAV_${fam}.${lang}.${key},`;
        expect(src.split(ref).length - 1, `${file} ${lang}.${key} reads NAV_${fam} once`).toBe(1);
      }
    }
  }
});
