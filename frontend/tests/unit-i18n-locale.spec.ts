import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-I18N-DATES-2442: one locale for dates, times, weekday / month names, numbers and currency, driven by the interface
// language (src/i18n/locale.ts): Hebrew -> he-IL, English -> en-GB. Hebrew output is the output the hard-coded 'he-IL' calls gave
// (compared below, old expression against the new function, for a fixed instant); the time zone of every call is untouched.

type G = { document?: { documentElement: { lang: string; dir: string } } };
const g = globalThis as unknown as G;
const page = (lang: 'he' | 'en') => {
  g.document = { documentElement: { lang, dir: lang === 'he' ? 'rtl' : 'ltr' } };
};
test.afterEach(() => {
  delete g.document;
});

/** Tuesday 17.11.2026 14:05:09 in Asia/Jerusalem. */
const AT = new Date('2026-11-17T12:05:09Z');
const ISO = '2026-11-17T12:05:09Z';
const TZ = 'Asia/Jerusalem';
const ZONE = { kind: 'iana' as const, name: TZ };

/** The option sets the call sites pass (one of each shape found in src/). */
const DATE_OPTIONS: Intl.DateTimeFormatOptions[] = [
  { timeZone: TZ },
  { timeZone: TZ, hour: '2-digit', minute: '2-digit' },
  { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false },
  { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' },
  { timeZone: TZ, day: 'numeric', month: 'numeric' },
  { timeZone: TZ, day: '2-digit', month: '2-digit' },
  { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' },
  { timeZone: TZ, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' },
  { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' },
  { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' },
  { timeZone: TZ, weekday: 'short' },
  { timeZone: TZ, weekday: 'long' },
  { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' },
  { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' },
  { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false },
  { timeZone: 'UTC', month: 'long', year: 'numeric' },
  { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' },
  { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' },
  { timeZone: TZ, dateStyle: 'short' },
];
const NUMBER_OPTIONS: Intl.NumberFormatOptions[] = [
  {},
  { maximumFractionDigits: 1 },
  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  { minimumFractionDigits: 3, maximumFractionDigits: 3 },
  { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 },
];

test('the rule: he -> he-IL, en -> en-GB, read from <html lang> at call time', async () => {
  const { uiLocale, localeFor, UI_LOCALE } = await import('../src/i18n/locale');
  expect(uiLocale()).toBe('he-IL'); // no document at all (a Node spec, a worker)
  page('he');
  expect(uiLocale()).toBe('he-IL');
  page('en');
  expect(uiLocale()).toBe('en-GB');
  g.document!.documentElement.lang = 'en-US';
  expect(uiLocale()).toBe('en-GB');
  g.document!.documentElement.lang = 'ar'; // not offered by the switch: the interface language is Hebrew
  expect(uiLocale()).toBe('he-IL');
  expect(UI_LOCALE).toEqual({ he: 'he-IL', en: 'en-GB', ar: 'ar', ru: 'ru-RU' });
  expect([localeFor('he'), localeFor('en'), localeFor('EN-us'), localeFor('ar'), localeFor('ru'), localeFor(''), localeFor(null), localeFor(undefined), localeFor('fr')]).toEqual(
    ['he-IL', 'en-GB', 'en-GB', 'ar', 'ru-RU', 'he-IL', 'he-IL', 'he-IL', 'he-IL'],
  );
});

test('Hebrew: every option shape gives the text the hard-coded he-IL call gave (also where the old call passed "he")', async () => {
  const { uiLocale, localeFor } = await import('../src/i18n/locale');
  page('he');
  for (const o of DATE_OPTIONS) {
    const old = new Intl.DateTimeFormat('he-IL', o).format(AT);
    expect(new Intl.DateTimeFormat(uiLocale(), o).format(AT), JSON.stringify(o)).toBe(old);
    expect(AT.toLocaleString(uiLocale(), o), JSON.stringify(o)).toBe(AT.toLocaleString('he-IL', o));
    // the sites that passed `document.documentElement.lang || 'he-IL'` formatted with the bare tag "he"
    expect(new Intl.DateTimeFormat('he', o).format(AT), JSON.stringify(o)).toBe(old);
    expect(new Intl.DateTimeFormat(localeFor('he'), o).format(AT)).toBe(old);
  }
  for (const o of NUMBER_OPTIONS) {
    for (const n of [0, 7, 1284, 1234.5, 0.125, 9876543.21]) {
      expect(new Intl.NumberFormat(uiLocale(), o).format(n), `${n} ${JSON.stringify(o)}`).toBe(new Intl.NumberFormat('he-IL', o).format(n));
      expect(n.toLocaleString(uiLocale(), o)).toBe(n.toLocaleString('he-IL', o));
    }
  }
  expect(new Intl.DisplayNames([uiLocale()], { type: 'region' }).of('IL')).toBe(new Intl.DisplayNames(['he'], { type: 'region' }).of('IL'));
  expect(new Intl.DisplayNames([uiLocale()], { type: 'region' }).of('US')).toBe(new Intl.DisplayNames(['he'], { type: 'region' }).of('US'));
});

test('Hebrew: the moved functions return what their old expressions returned', async () => {
  page('he');
  const people = await import('../src/access-control/people-logic');
  const wk = await import('../src/screens/wiskey-format');
  const insights = await import('../src/insights/model');
  const cost = await import('../src/tickets/cost-model');
  const presence = await import('../src/api/building-presence-logic');

  // access-control/people-logic.ts formatDay / formatClock
  const shifted = new Date(AT.getTime() + wk.offsetAt(AT.getTime(), ZONE) * 1000);
  expect(people.formatDay(ISO, ZONE)).toBe(shifted.toLocaleDateString('he-IL', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '.'));
  expect(people.formatDay(ISO, ZONE)).toBe('17.11.2026');
  expect(people.formatClock(ISO, ZONE, AT.getTime())).toBe('14:05');
  expect(people.formatClock(ISO, ZONE, AT.getTime() + 3 * 86_400_000)).toBe('17.11.2026 14:05');
  // screens/wiskey-format.ts formatTime / formatLocalTime (default locale = the interface's)
  expect(wk.formatTime(ISO, undefined, ZONE)).toBe(wk.formatTime(ISO, 'he-IL', ZONE));
  expect(wk.formatLocalTime(ISO, undefined, ZONE)).toBe(wk.formatLocalTime(ISO, 'he-IL', ZONE));
  expect(wk.formatTime(ISO, undefined, ZONE)).toBe(`${shifted.toLocaleString('he-IL', { timeZone: 'UTC' })} · UTC+02:00`);
  // insights/model.ts monthLabel
  expect(insights.monthLabel('2026-11', 'he')).toBe(new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 10, 15))));
  expect(insights.monthLabel('2026-11', 'he')).toBe('נובמבר 2026');
  // tickets/cost-model.ts formatMoney
  expect(cost.formatMoney(123450, 'ILS', 'he')).toBe(new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.5));
  expect(cost.formatMoney(123450, 'ILS')).toBe(cost.formatMoney(123450, 'ILS', 'he'));
  // api/building-presence-logic.ts clockText
  expect(presence.clockText(ISO, TZ)).toBe('14:05');
});

test('Hebrew: the relative-time and weekday words are the texts that were written in the sources', async () => {
  page('he');
  const notif = await import('../src/api/notifications');
  const auto = await import('../src/api/automations');
  const sched = await import('../src/api/schedules');
  const home = await import('../src/api/home-config');
  const now = AT.getTime();
  expect(notif.relativeTime(now - 20_000, now, TZ)).toBe('עכשיו');
  expect(notif.relativeTime(now - 12 * 60_000, now, TZ)).toBe('לפני 12 דק׳');
  expect(notif.relativeTime(now - 3 * 3_600_000, now, TZ)).toBe('11:05');
  expect(notif.relativeTime(now - 86_400_000, now, TZ)).toBe('אתמול 14:05');
  expect(notif.relativeTime(now - 3 * 86_400_000, now, TZ)).toBe('לפני 3 ימים');
  expect(notif.dayLabel(now, now, TZ)).toBe('היום');
  expect(notif.dayLabel(now - 86_400_000, now, TZ)).toBe('אתמול');
  expect(notif.dayLabel(now - 2 * 86_400_000, now, TZ)).toBe('יום ראשון 15.11');
  const run = (minutes: number, result: 'ok' | 'running' = 'ok') => auto.lastRunText({ at: new Date(now - minutes * 60_000).toISOString(), result }, AT);
  expect([run(0), run(12), run(60), run(180), run(1440), run(3 * 1440), run(5, 'running')]).toEqual(['עכשיו', 'לפני 12 דק׳', 'לפני שעה', 'לפני 3 שע׳', 'אתמול', 'לפני 3 ימים', 'רץ עכשיו']);
  expect(sched.DAY_SHORT).toEqual({ sun: 'א׳', mon: 'ב׳', tue: 'ג׳', wed: 'ד׳', thu: 'ה׳', fri: 'ו׳', sat: 'ש׳' });
  expect(sched.DAY_LONG).toEqual({ sun: 'ראשון', mon: 'שני', tue: 'שלישי', wed: 'רביעי', thu: 'חמישי', fri: 'שישי', sat: 'שבת' });
  const local = (addDays: number) => new Date(AT.getFullYear(), AT.getMonth(), AT.getDate() + addDays, 7, 30).toISOString();
  expect(sched.whenLabel(local(0), AT)).toBe('היום 07:30');
  expect(sched.whenLabel(local(1), AT)).toBe('מחר 07:30');
  expect(sched.whenLabel(local(2), AT)).toBe('יום ה׳ 07:30');
  expect(sched.whenLabel(local(20), AT)).toBe('7.12 07:30');
  const since = (minutes: number) => home.sinceText(new Date(now - minutes * 60_000).toISOString(), AT);
  expect([since(1), since(12), since(60), since(180), since(1440), since(3 * 1440)]).toEqual(['שונה עכשיו', 'שונה לפני 12 דקות', 'שונה לפני שעה', 'שונה לפני 3 שעות', 'שונה אתמול', 'שונה לפני 3 ימים']);
});

test('English: day before month, a 24-hour clock, English weekday and month names, the shekel sign first', async () => {
  const { uiLocale } = await import('../src/i18n/locale');
  page('en');
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(uiLocale(), { timeZone: TZ, ...o }).format(AT);
  expect(f({})).toBe('17/11/2026');
  expect(f({ day: '2-digit', month: '2-digit' })).toBe('17/11');
  expect(f({ hour: '2-digit', minute: '2-digit' })).toBe('14:05'); // not "02:05 PM"
  expect(f({ hour: '2-digit', minute: '2-digit', second: '2-digit' })).toBe('14:05:09');
  expect(f({ weekday: 'long' })).toBe('Tuesday');
  expect(f({ weekday: 'short' })).toBe('Tue');
  expect(f({ weekday: 'long', day: 'numeric', month: 'long' })).toMatch(/^Tuesday,? 17 November$/);
  expect(f({ month: 'long', year: 'numeric' })).toBe('November 2026');
  expect(f({ dateStyle: 'short', timeStyle: 'short' })).toMatch(/^17\/11\/2026,? 14:05$/);
  expect(new Intl.NumberFormat(uiLocale()).format(1284)).toBe('1,284');
  expect(new Intl.NumberFormat(uiLocale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(12.5)).toBe('12.500');
  expect(new Intl.DisplayNames([uiLocale()], { type: 'region' }).of('IL')).toBe('Israel');
});

test('English: the moved functions follow the interface language; the zone does not move', async () => {
  page('en');
  const people = await import('../src/access-control/people-logic');
  const wk = await import('../src/screens/wiskey-format');
  const insights = await import('../src/insights/model');
  const cost = await import('../src/tickets/cost-model');
  const presence = await import('../src/api/building-presence-logic');
  expect(people.formatClock(ISO, ZONE, AT.getTime())).toBe('14:05');
  expect(people.formatDay(ISO, ZONE)).toBe('17.11.2026'); // this helper writes dots in every language
  expect(wk.formatTime(ISO, undefined, ZONE)).toMatch(/^17\/11\/2026,? 14:05:09 · UTC\+02:00$/);
  expect(wk.formatLocalTime(ISO, undefined, ZONE)).toMatch(/^17\/11\/2026,? 14:05:09$/);
  expect(insights.monthLabel('2026-11', 'en')).toBe('November 2026');
  expect(cost.formatMoney(123450, 'ILS', 'en')).toBe('₪1,234.50');
  expect(presence.clockText(ISO, TZ)).toBe('14:05');
  // a summer instant: the zone's daylight offset is still the zone's (UTC+3), whatever the language
  expect(presence.clockText('2026-07-01T12:05:00Z', TZ)).toBe('15:05');
  expect(wk.formatTime('2026-07-01T12:05:00Z', undefined, ZONE)).toMatch(/15:05:00 · UTC\+03:00$/);
});

test('English: the relative-time and weekday words', async () => {
  page('en');
  const notif = await import('../src/api/notifications');
  const auto = await import('../src/api/automations');
  const sched = await import('../src/api/schedules');
  const home = await import('../src/api/home-config');
  const now = AT.getTime();
  expect(notif.relativeTime(now - 20_000, now, TZ)).toBe('Now');
  expect(notif.relativeTime(now - 12 * 60_000, now, TZ)).toBe('12 min ago');
  expect(notif.relativeTime(now - 86_400_000, now, TZ)).toBe('Yesterday 14:05');
  expect(notif.relativeTime(now - 3 * 86_400_000, now, TZ)).toBe('3 days ago');
  expect(notif.dayLabel(now, now, TZ)).toBe('Today');
  expect(notif.dayLabel(now - 2 * 86_400_000, now, TZ)).toBe('Sunday 15.11');
  const run = (minutes: number, result: 'ok' | 'running' = 'ok') => auto.lastRunText({ at: new Date(now - minutes * 60_000).toISOString(), result }, AT);
  expect([run(0), run(12), run(60), run(180), run(1440), run(3 * 1440), run(5, 'running')]).toEqual(['Now', '12 min ago', 'An hour ago', '3 h ago', 'Yesterday', '3 days ago', 'Running now']);
  const local = (addDays: number) => new Date(AT.getFullYear(), AT.getMonth(), AT.getDate() + addDays, 7, 30).toISOString();
  expect(sched.whenLabel(local(0), AT)).toBe('Today 07:30');
  expect(sched.whenLabel(local(1), AT)).toBe('Tomorrow 07:30');
  const since = (minutes: number) => home.sinceText(new Date(now - minutes * 60_000).toISOString(), AT);
  expect([since(1), since(12), since(60), since(180), since(1440), since(3 * 1440)]).toEqual(
    ['Changed just now', 'Changed 12 minutes ago', 'Changed an hour ago', 'Changed 3 hours ago', 'Changed yesterday', 'Changed 3 days ago'],
  );
  const { tr } = await import('../src/i18n/msg/time');
  for (const [he, en] of Object.entries(tr.en)) {
    expect(en, he).not.toMatch(/[֐-׿]/);
    for (const name of he.match(/\{\w+\}/g) ?? []) expect(en, he).toContain(name);
  }
});

// ---------------------------------------------------------------- the guard: no new hard-coded locale

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(SRC, p).split(sep).join('/');

/** Where the literal tag stays, and why. An entry that no longer matches fails too, so the list only shrinks. */
const HE_IL_ALLOWED: Record<string, string> = {
  'i18n/locale.ts': 'the rule itself',
  'api/day-format.ts': 'dateInputLangFor: the same he-IL / en-GB rule for the lang attribute of date inputs (takes the language as an argument)',
  'api/home-config.ts': 'a probe: is the zone name valid (nothing is printed)',
  'home/home-api.ts': 'a same-day comparison of two instants (nothing is printed)',
  'home/home-diary.ts': 'a same-day comparison (nothing is printed)',
  'home/home-intercom.ts': 'a same-day comparison (nothing is printed)',
};
/** Their own pages with their own language (the display language of a board, the visitor's language): not the interface language. */
const OWN_LANGUAGE = ['notice-tv/', 'public-ticket/'];

test('guard: no hard-coded he-IL in src/ outside the listed places; display code reads i18n/locale.ts', () => {
  const found = new Map<string, number>();
  for (const p of walk(SRC)) {
    const r = rel(p);
    if (OWN_LANGUAGE.some((d) => r.startsWith(d))) continue;
    const code = readFileSync(p, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n');
    const n = (code.match(/['"`]he-IL['"`]/g) ?? []).length;
    if (n) found.set(r, n);
  }
  expect([...found.keys()].filter((r) => !(r in HE_IL_ALLOWED)), 'a formatting call with a hard-coded locale: use uiLocale() / localeFor() from src/i18n/locale.ts').toEqual([]);
  expect(Object.keys(HE_IL_ALLOWED).filter((r) => !found.has(r)), 'stale entries of HE_IL_ALLOWED').toEqual([]);
  // the language-of-the-document read is not a locale either: `toLocaleString(document.documentElement.lang ...)` printed en-US in English
  const viaDocLang = walk(SRC).filter((p) => /(toLocale\w*String|Intl\.\w+)\(\s*\[?document\.documentElement\.lang/.test(readFileSync(p, 'utf8'))).map(rel);
  expect(viaDocLang).toEqual([]);
});
