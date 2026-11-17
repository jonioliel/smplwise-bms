import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { tr as mapTr } from '../src/i18n/msg/map';
import { tr as wizardTr } from '../src/i18n/msg/plan-wizard';
import { objectsSummary, outsideMainSummary, type CandidateSet } from '../src/map/candidates';
import { circuitAction } from '../src/map/circuit-action';
import { stairCaption } from '../src/map/geometry';
import { daysText } from '../src/map/history-replay';
import { openWords, pillAria, type RoomSummary } from '../src/map/room-pills';
import { skippedTwinsMessage } from '../src/map/studio-controller';
import { detectedText } from '../src/plan-wizard/wizard-model';

// CR-I18N-MAP / CR-I18N-PLANWIZARD (code review 08:F11): the texts of src/map/* and src/plan-wizard/* go through tr() of their
// source-text tables (i18n/msg/map.ts, i18n/msg/plan-wizard.ts). Node-only:
//   1. no Hebrew literal is left outside tr() in the two folders, but for the listed data (keywords, demo data, stored names);
//   2. every tr() text has its English, with the same placeholders;
//   3. the sentences that were string templates read in Hebrew exactly as before, and in English from the table.
//   npx playwright test -c playwright.unit.config.ts tests/unit-i18n-map-wizard-2441.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const HEBREW = /[֐-׿]/;
const AREAS = [
  { dir: 'map', table: mapTr.en },
  { dir: 'plan-wizard', table: wizardTr.en },
] as const;

/** Hebrew that is data, not interface text. `file` alone = the whole file; with `inside` = only literals within that declaration. */
const DATA: { file: string; inside?: string; why: string }[] = [
  { file: 'map/material-resolve.ts', inside: 'ROOM_FLOOR_RULES', why: 'keywords matched against a room use / name' },
  { file: 'plan-wizard/wizard-demo.ts', why: 'the demo house: sample names, as a server would send them' },
  { file: 'plan-wizard/wizard-model.ts', inside: 'words', why: 'keywords matched against area names' },
  { file: 'plan-wizard/wizard-model.ts', inside: 'fallbackRoomName', why: 'the name the server also gives a room without one' },
  { file: 'plan-wizard/wizard-backend.ts', inside: 'WIZARD_NOTE', why: 'the note stored on the version; the resume check compares it' },
  { file: 'plan-wizard/plan-wizard.ts', inside: 'demoTo', why: 'the demo file name' },
];

interface Found { file: string; line: number; text: string; inTr: boolean; owners: string[] }

/** Every string / template piece with Hebrew in a file, whether it is the first argument of tr(), and the named declarations around it. */
function hebrewLiterals(rel: string): Found[] {
  const sf = ts.createSourceFile(rel, readFileSync(path.join(SRC, rel), 'utf8'), ts.ScriptTarget.Latest, true);
  const out: Found[] = [];
  const visit = (node: ts.Node): void => {
    const literal = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
    if (literal && HEBREW.test(node.text)) {
      const call = node.parent;
      const inTr = ts.isStringLiteral(node) && ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === 'tr' && call.arguments[0] === node;
      const owners: string[] = [];
      for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
        const name = (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name && ts.isIdentifier(p.name) ? p.name.text : null;
        if (name) owners.push(name);
      }
      out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: node.text, inTr, owners });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const filesOf = (dir: string): string[] => readdirSync(path.join(SRC, dir)).filter((f) => f.endsWith('.ts')).map((f) => `${dir}/${f}`);

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

test('no Hebrew literal outside tr() in src/map and src/plan-wizard, but for the listed data', () => {
  const left: string[] = [];
  const dataSeen = new Set<string>();
  for (const { dir } of AREAS) {
    for (const rel of filesOf(dir)) {
      for (const f of hebrewLiterals(rel)) {
        if (f.inTr) continue;
        const d = DATA.find((x) => x.file === f.file && (!x.inside || f.owners.includes(x.inside)));
        if (d) dataSeen.add(`${d.file}:${d.inside ?? ''}`);
        else left.push(`${f.file}:${f.line} ${f.text.trim().slice(0, 60)}`);
      }
    }
  }
  expect(left).toEqual([]);
  // an exception that no longer matches anything is removed from the list, not kept
  expect([...dataSeen].sort()).toEqual(DATA.map((d) => `${d.file}:${d.inside ?? ''}`).sort());
});

test('every tr() text of the two folders has its English, with the same placeholders; no table entry is unused', () => {
  const names = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const { dir, table } of AREAS) {
    const used = new Set<string>();
    for (const rel of filesOf(dir)) for (const f of hebrewLiterals(rel)) if (f.inTr) used.add(f.text);
    expect(used.size, dir).toBeGreaterThan(100);
    expect([...used].filter((k) => !(k in table)), `${dir}: no English`).toEqual([]);
    expect(Object.keys(table).filter((k) => !used.has(k)), `${dir}: unused`).toEqual([]);
    for (const [he, en] of Object.entries(table)) expect(names(en), he).toEqual(names(he));
    // English is English, but for the one sentence that quotes the stored room name
    const quoted = 'חדר בלי שם יקבל "חדר 7", ואפשר לשנות אחר כך';
    expect(Object.entries(table).filter(([he, en]) => HEBREW.test(en) && he !== quoted).map(([he]) => he), dir).toEqual([]);
  }
});

test('every tr() call in the two folders takes a plain string literal (i18n/msg.ts rule: values go through {name})', () => {
  const bad: string[] = [];
  for (const { dir } of AREAS) {
    for (const rel of filesOf(dir)) {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      if (!/from '\.\.\/i18n\/msg\//.test(src)) continue;
      for (const m of src.matchAll(/(?<![\w.$])tr\((?!')/g)) bad.push(`${rel}: ${src.slice(m.index, m.index + 40)}`);
    }
  }
  expect(bad).toEqual([]);
});

const walls = (n: number): CandidateSet => ({ walls: Array.from({ length: n }, (_, i) => ({ id: `w${i}` })), openings: [], objects: [], outsideMain: Array.from({ length: n }, (_, i) => `w${i}`) }) as unknown as CandidateSet;
const objects = (...ids: string[]): CandidateSet => ({ walls: [], openings: [], objects: ids.map((item_id, i) => ({ id: `o${i}`, item_id })) }) as unknown as CandidateSet;
const room = (over: Partial<RoomSummary>): RoomSummary => ({ id: 'z', name: '', open: 0, presence: false, lit: 0, temp: null, devices: [], ...over }) as unknown as RoomSummary;

test('Hebrew: the sentences that were string templates read exactly as before', () => {
  withLang('he', () => {
    expect(outsideMainSummary(walls(1))).toBe('קיר אחד מחוץ למבנה הראשי - בדוק לפני קבלה');
    expect(outsideMainSummary(walls(3))).toBe('3 קירות מחוץ למבנה הראשי - בדוק לפני קבלה');
    expect(objectsSummary(objects('tribune.a', 'column.a', 'column.b'), 'detect' as never)).toBe('3 עצמים שזוהו (טריבונה, 2 עמודים)');
    expect(objectsSummary(objects('tribune.a', 'tribune.b', 'column.a'), 'detect' as never)).toBe('3 עצמים שזוהו (2 טריבונות, עמוד)');
    expect(objectsSummary(objects('sofa.a'), 'detect' as never)).toBe('עצם אחד שזוהו');
    expect(objectsSummary(objects('sofa.a', 'sofa.b'), 'dxf' as never)).toBe('2 עצמים מהקובץ');
    expect([1, 2, 7, 10, 11, 30].map(daysText)).toEqual(['יום אחד', 'יומיים', '7 ימים', '10 ימים', '11 יום', '30 יום']);
    expect(stairCaption({ flights: [{ steps: 12 }, { steps: 12 }], shape: 'u' } as never)).toBe('12+12 מדרגות · פודסט');
    expect(stairCaption({ flights: [{ steps: 16 }], shape: 'straight' } as never)).toBe('16 מדרגות');
    expect([openWords(1), openWords(4)]).toEqual(['פתוח 1', '4 פתוחים']);
    expect(pillAria(room({ open: 2, presence: true, lit: 1 }))).toBe('חדר, 2 פתוחים, נוכחות, אור אחד דולק');
    expect(pillAria(room({ name: 'לובי', lit: 3 }))).toBe('לובי, 3 אורות דולקים');
    expect(skippedTwinsMessage([{ name: 'קומה 1' }, { name: 'קומה 2' }, { name: 'קומה 1' }])).toBe('המדרגות בקומה 1 ובקומה 2 לא עודכנו - אין לך הרשאת עריכה שם');
    const refused = circuitAction({ state: 'off', can_control: true, available: true, actions: [{ id: 'switch.turn_on', granted: false, grant: 'ha.breaker' }] } as never, { busy: false, stale: false });
    expect(refused.why).toBe('נדרשת הרשאה נפרדת: ha.breaker');
    expect(detectedText({ walls: [], openings: [{ id: 'o', kind: 'window' }], objects: [] } as unknown as CandidateSet, 'o')).toBe('זוהה כחלון');
    expect(detectedText({ walls: [{ id: 'w', kind: 'railing' }], openings: [], objects: [] } as unknown as CandidateSet, 'w')).toBe('זוהה כמעקה');
  });
});

test('English: the same sentences come from the tables', () => {
  withLang('en', () => {
    expect(outsideMainSummary(walls(3))).toBe('3 walls outside the main structure - check before accepting');
    expect(objectsSummary(objects('tribune.a', 'column.a', 'column.b'), 'detect' as never)).toBe('3 objects detected (Tribune, 2 columns)');
    expect([1, 2, 7, 30].map(daysText)).toEqual(['1 day', '2 days', '7 days', '30 days']);
    expect(stairCaption({ flights: [{ steps: 12 }, { steps: 12 }], shape: 'u' } as never)).toBe('12+12 steps · landing');
    expect([openWords(1), openWords(4)]).toEqual(['1 open', '4 open']);
    expect(pillAria(room({ name: 'Lobby', lit: 3 }))).toBe('Lobby, 3 lights on');
    expect(skippedTwinsMessage([{ name: 'Floor 1' }, { name: 'Floor 2' }])).toBe('The stairs on Floor 1 and Floor 2 were not updated - you have no edit permission there');
    expect(wizardTr('שלב {step} מתוך 7', { step: 3 })).toBe('Step 3 of 7');
    expect(mapTr('עבר ל{rung} — קצב הפריימים היה נמוך', { rung: mapTr('סכמטי') })).toBe('Switched to Schematic — the frame rate was low');
  });
});
