import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { hebrewOutsideTr } from './helpers/i18n-source-scan';

// CR-I18N-CAL-ELEC-2441 (MASTER_PLAN rows CR-I18N-CALENDARS / CR-I18N-ELECTRICITY, code review 08:F11): the lint of the two areas.
// A Hebrew string or template text in src/calendars/* or src/electricity/* must be the first argument of `tr(...)`, whose English
// lives in the catalogue file (src/i18n/msg/calendars.ts, src/i18n/msg/electricity.ts). A new Hebrew literal anywhere else fails
// here. Comments are not read. What stays Hebrew on purpose is listed below, with the reason; an entry that no longer matches a
// literal fails too, so the lists only shrink.

const AREAS = ['calendars', 'electricity'] as const;

/** Whole files that stay Hebrew. */
const HEBREW_FILES: Record<string, string> = {
  'calendars/demo.ts': 'demo data and the demo server\'s answers (never shown outside the demo mode)',
  'electricity/fixtures.ts': 'demo data',
  'electricity/elec-bill-paper.ts': 'the A4 bill: a Hebrew document, kept word for word with the Hebrew PDF the server prints',
};

/** Single literals that stay Hebrew: file -> the texts (each as many times as it is written). */
const HEBREW_LITERALS: Record<string, { why: string; texts: string[] }> = {
  'calendars/event-drawer.ts': { why: 'a title sent to the server (the preview of an untitled event)', texts: ['בדיקה'] },
  'calendars/resident.ts': { why: 'the default title saved with a booking', texts: ['הזמנת חדר', 'הזמנת חדר'] },
  'calendars/view-approvals.ts': { why: 'the note saved with a rejection', texts: ['החלון נשאר להזמנה שאושרה קודם'] },
  'calendars/view-calendar.ts': { why: 'default titles saved with an event', texts: ['בדיקה', 'הזמנת חדר', 'אירוע', 'הזמנה'] },
  'calendars/view-manage.ts': { why: 'the demo mode\'s roles; the member label saved to the server', texts: ['מפעיל', 'צופה', 'מנהל אתר', 'כל מי שיש לו צפייה ביומנים'] },
  'electricity/elec-bill-page.ts': { why: 'the watermark of the Hebrew bill paper (the paper compares it)', texts: ['טיוטה', 'בוטל'] },
  'electricity/elec-settings.ts': {
    why: 'the sample bill of the preview: content of the Hebrew bill paper',
    texts: ['חשבון צריכת חשמל ודרישת תשלום', 'אינו חשבונית מס', 'לקוח לדוגמה', 'רחוב הדוגמה 12, עיר לדוגמה', 'חשבון לדוגמה', 'תעריף', '[מונה]', 'מונה לדוגמה', 'מונה לדוגמה'],
  },
  'electricity/elec-tou-editor.ts': { why: 'the name saved for a new season / band (name_he)', texts: ['עונה חדשה', 'פס חדש'] },
  'electricity/elec-tou.ts': { why: 'the names saved with the Israeli tariff template (name_he)', texts: ['קיץ', 'חורף', 'מעבר', 'ימי חול', 'שישי וערבי חג', 'שבת וחג', 'שפל', 'פסגה'] },
};

const dirOf = (area: string): URL => new URL(`../src/${area}/`, import.meta.url);
const filesOf = (area: string): string[] => readdirSync(dirOf(area)).filter((f) => f.endsWith('.ts')).sort();

/** The Hebrew literals of a file that are neither a `tr()` text nor listed; and the listed texts that were not found. */
function check(rel: string, source: string): { extra: string[]; stale: string[] } {
  const left = [...(HEBREW_LITERALS[rel]?.texts ?? [])];
  const extra: string[] = [];
  for (const lit of hebrewOutsideTr(rel, source)) {
    const i = left.indexOf(lit.text);
    if (i >= 0) left.splice(i, 1);
    else extra.push(`${rel}:${lit.line}: ${lit.text.slice(0, 70)}`);
  }
  return { extra, stale: left.map((t) => `${rel}: ${t}`) };
}

for (const area of AREAS) {
  test(`${area}: no Hebrew literal outside tr() and the catalogue file`, () => {
    const extra: string[] = [];
    const stale: string[] = [];
    for (const f of filesOf(area)) {
      const rel = `${area}/${f}`;
      if (rel in HEBREW_FILES) continue;
      const r = check(rel, readFileSync(new URL(f, dirOf(area)), 'utf8'));
      extra.push(...r.extra);
      stale.push(...r.stale);
    }
    expect(extra, 'wrap the text in tr() and add its English to src/i18n/msg/' + area + '.ts').toEqual([]);
    expect(stale, 'the literal is gone: remove it from HEBREW_LITERALS').toEqual([]);
  });
}

test('the lists name real files, and a listed whole file still holds Hebrew', () => {
  const all = new Set(AREAS.flatMap((a) => filesOf(a).map((f) => `${a}/${f}`)));
  for (const rel of [...Object.keys(HEBREW_FILES), ...Object.keys(HEBREW_LITERALS)]) expect(all.has(rel), rel).toBe(true);
  for (const rel of Object.keys(HEBREW_FILES)) {
    expect(rel in HEBREW_LITERALS, `${rel} is listed twice`).toBe(false);
    expect(hebrewOutsideTr(rel, readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8')).length, `${rel}: no Hebrew left - remove it from HEBREW_FILES`).toBeGreaterThan(0);
  }
});

test('the lint catches a new literal: plain string, template text, attribute, a second copy of a listed text; comments and tr() pass', () => {
  const src = (body: string): string => `import { tr } from '../i18n/msg/calendars';\n// הערה בעברית\n/** עוד הערה */\n${body}\n`;
  const found = (body: string, rel = 'calendars/new-file.ts'): string[] => check(rel, src(body)).extra;
  expect(found("export const a = tr('שלום');")).toEqual([]);
  expect(found("export const a = tr('עוד {n} פריטים', { n: 3 });")).toEqual([]);
  expect(found("export const a = 'שלום';")).toHaveLength(1);
  expect(found('export const a = `שלום`;')).toHaveLength(1);
  expect(found('export const a = (n: number) => `עוד ${n} פריטים`;')).toHaveLength(2); // both static parts
  expect(found('export const a = (h: (s: TemplateStringsArray) => unknown) => h`<b title="כותרת">טקסט</b>`;')).toHaveLength(1);
  expect(found("export const a = tr('שלום') + 'עולם';")).toHaveLength(1);
  expect(found("export const a = tr(`עוד ${1} פריטים`);")).toHaveLength(2); // a template with a value is not a catalogue key
  expect(found("export const a = other('שלום');")).toHaveLength(1);
  // a listed text passes as many times as it is listed, not once more
  expect(found("export const a = 'בדיקה';", 'calendars/event-drawer.ts')).toEqual([]);
  expect(found("export const a = ['בדיקה', 'בדיקה'];", 'calendars/event-drawer.ts')).toHaveLength(1);
  expect(check('calendars/event-drawer.ts', src('export const a = 1;')).stale).toHaveLength(1);
});
