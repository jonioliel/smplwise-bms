import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TICKET_NAMES, NAME_MAX, definite, nameProblem, onTicketNames, renderName, setTicketNames, ticketNames, tn } from '../src/tickets/naming';
import { TICKET_TEXT_EN_KEYS, TICKET_TEXT_KEYS, template, tt } from '../src/tickets/text';
import { AREA_TABS, NAV_A, TICKETS_SETTINGS_HREF, applyTicketsHidden, visibleAreas, visibleTabs, type Can } from '../src/shell/nav';
import { SETTINGS_GROUPS, searchSettings, visibleGroups } from '../src/screens/system-index';

// CR-038, owner decision D33 (2026-10-13): the tickets module's user-facing name is configurable; internal ids stay "tickets". These are the
// node-only checks of the ONE helper (tickets/naming.ts), the text catalogue (tickets/text.ts) and the places of the shell that name the
// module (the rail, the scope tabs, the settings tab and the settings index) - and the lint that fails when a tickets screen, the
// navigation or the settings index writes the default name instead of the tokens.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-naming.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const ALL: Can = () => true;
const MAINT = { one: 'תקלה', many: 'תקלות', gender: 'f' };
const MASC = { one: 'אירוע', many: 'אירועים', gender: 'm' };

test.afterEach(() => {
  setTicketNames(null);
  applyTicketsHidden(null);
});

test('the defaults per language, and the tokens render with gender agreement', () => {
  // owner rename 2026-10-14: the module "ניהול השירות", the item "בקשת שירות" / "בקשות שירות" (feminine)
  expect(DEFAULT_TICKET_NAMES.he).toEqual({ one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f', module: 'ניהול השירות' });
  expect(DEFAULT_TICKET_NAMES.en).toEqual({ one: 'Ticket', many: 'Tickets', gender: '', module: 'Tickets' });
  expect(renderName('{module} · סגירת {the_ticket} · כל {the_tickets}', DEFAULT_TICKET_NAMES.he)).toBe('ניהול השירות · סגירת בקשת השירות · כל בקשות השירות');
  expect(['בקשת שירות', 'ניהול השירות', 'הזמנה', 'Work-order'].map(definite)).toEqual(['בקשת השירות', 'ניהול השירות', 'ההזמנה', 'Work-order']);
  expect(renderName('{module}', MAINT), 'no module name: the plural').toBe('תקלות');
  expect(Object.keys(DEFAULT_TICKET_NAMES).sort()).toEqual(['ar', 'en', 'he', 'ru']);
  expect(renderName('{ticket} {f:חדשה|m:חדש}', MAINT)).toBe('תקלה חדשה');
  expect(renderName('{ticket} {f:חדשה|m:חדש}', MASC)).toBe('אירוע חדש');
  expect(renderName('{the_tickets} {f:פתוחות|m:פתוחים}', MASC)).toBe('האירועים פתוחים');
  expect(renderName('{f:a|m:b|n:c}', { one: 'x', many: 'y', gender: 'n' })).toBe('c');
  expect(renderName('{f:a|m:b}', { one: 'x', many: 'y', gender: 'n' }), 'a neuter name without a neuter form takes the first').toBe('a');
  expect(renderName('{ticket} {other} {f:only}', MAINT), 'unknown tokens are text').toBe('תקלה {other} {f:only}');
});

test('setTicketNames keeps a default for a missing or broken language and tells the listeners only on a change', () => {
  let calls = 0;
  const off = onTicketNames(() => calls++);
  setTicketNames({ he: MAINT, en: { one: '', many: 'x' }, ar: 'nonsense' });
  expect(ticketNames('he')).toEqual({ ...MAINT, module: 'תקלות' });
  expect(ticketNames('en')).toEqual(DEFAULT_TICKET_NAMES.en);
  expect(ticketNames('ar')).toEqual(DEFAULT_TICKET_NAMES.ar);
  expect(calls).toBe(1);
  setTicketNames({ he: MAINT });
  expect(calls, 'the same names: no redraw').toBe(1);
  setTicketNames({ he: { ...MAINT, gender: 'x' } });
  expect(ticketNames('he').gender, 'an unknown gender reads as the default').toBe('f');
  off();
});

test('the client-side name check mirrors the server rules', () => {
  expect(NAME_MAX).toBe(30);
  expect(nameProblem('תקלה')).toBe('');
  expect(nameProblem('בקשת שירות')).toBe('');
  expect(nameProblem('צ׳ק-אין (מהיר)')).toBe('');
  expect(nameProblem('   ')).toBe('required');
  expect(nameProblem('א'.repeat(31))).toBe('too_long');
  expect(nameProblem('<b>x</b>')).toBe('character');
  expect(nameProblem('a&b')).toBe('character');
  expect(nameProblem('123')).toBe('no_letter');
  expect(nameProblem('ab‮cd')).toBe('control_character');
  expect(nameProblem('ab\u0007')).toBe('control_character');
});

test('tt renders the configured name, then the variables - a value is never read as a token', () => {
  setTicketNames({ he: MAINT });
  expect(tt('area')).toBe('תקלות');
  expect(tt('newTitle')).toBe('תקלה חדשה');
  expect(tt('created', { n: 1043 })).toBe('התקלה נפתחה · #1043');
  expect(tt('e_assigned', { name: '{ticket} {tickets}' })).toBe('שיוך ל{ticket} {tickets}');
  setTicketNames({ he: MASC });
  expect(tt('moduleOff')).toBe('האירועים כבויים');
  expect(tn('{ticket}')).toBe('אירוע');
});

test('the catalogue: every Hebrew text has an English one (the language names excepted); every text naming the module uses the tokens', () => {
  const en = new Set(TICKET_TEXT_EN_KEYS);
  const missing = TICKET_TEXT_KEYS.filter((k) => !en.has(k) && !k.startsWith('lang_'));
  expect(missing, missing.join(', ')).toEqual([]);
  for (const k of TICKET_TEXT_KEYS) {
    for (const lang of ['he', 'en'] as const) {
      const s = template(k, lang);
      expect(s, `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
      expect(s.trim(), `${lang}.${k}`).not.toBe('');
    }
  }
});

test('the rail, the scope tabs, the settings tab and the settings index carry the configured name, live', () => {
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  const area = () => NAV_A.find((n) => n.id === 'tickets')!;
  expect(area().label).toBe('ניהול השירות');
  setTicketNames({ he: MAINT });
  expect(area().label).toBe('תקלות');
  expect(visibleAreas(true, ALL).find((a) => a.id === 'tickets')?.label).toBe('תקלות');
  expect(AREA_TABS.system.find((t) => t.href === TICKETS_SETTINGS_HREF)?.label).toBe('תקלות');
  const entry = SETTINGS_GROUPS.flatMap((g) => g.entries).find((e) => e.href === TICKETS_SETTINGS_HREF);
  expect(entry?.label).toBe('תקלות');
  const groups = visibleGroups(true, ALL);
  expect(searchSettings(groups, 'תקלות').map((r) => r.entry.href)).toContain(TICKETS_SETTINGS_HREF);
  expect(searchSettings(groups, 'מחלקות').map((r) => r.entry.href)).toContain('#/system/tickets?tab=departments');
  // slice 6 adds the manager board; owner 2026-10-14 the fifth entry "מטפלים וספקים"; TKRFQ2 "בקשות הצעת מחיר"; TK258 "חשבון ספקים" last
  expect(visibleTabs(AREA_TABS.tickets, true, ALL).map((t) => t.label)).toEqual(['שלי', 'המחלקה', 'לוח מנהל', 'הכול', 'מטפלים וספקים', 'בקשות הצעת מחיר', 'חשבון ספקים']);
});

test('the module switch: the area is hidden until the session says it is on; the settings tab stays (it is where the switch is)', () => {
  const ids = () => visibleAreas(true, ALL).map((a) => a.id);
  expect(ids()).not.toContain('tickets');
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  expect(ids().at(-1)).toBe('tickets');
  applyTicketsHidden({ 'tickets.enabled': 'false' });
  expect(ids()).not.toContain('tickets');
  expect(visibleTabs(AREA_TABS.system, true, ALL).some((t) => t.href === TICKETS_SETTINGS_HREF)).toBe(true);
  // permissions still decide: no ticket permission -> no area even when on; "הכול" needs tickets.all_departments
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  expect(visibleAreas(true, (p) => !p.startsWith('tickets.')).map((a) => a.id)).not.toContain('tickets');
  expect(visibleTabs(AREA_TABS.tickets, true, (p) => p === 'tickets.view').map((t) => t.id)).toEqual(['mine', 'department']);
  expect(visibleTabs(AREA_TABS.tickets, true, (p) => p === 'tickets.create').map((t) => t.id)).toEqual(['mine']);
  // the settings tab needs system.configure or tickets.configure at the installation
  expect(visibleTabs(AREA_TABS.system, true, (p, inst) => p === 'tickets.configure' && !!inst).some((t) => t.href === TICKETS_SETTINGS_HREF)).toBe(true);
  expect(visibleTabs(AREA_TABS.system, true, (p, inst) => p === 'tickets.configure' && !inst).some((t) => t.href === TICKETS_SETTINGS_HREF)).toBe(false);
});

// ---------------------------------------------------------------- the D33 lint

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');

/** The source without comments (a URL's `//` inside a string is kept). */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
}

/** The old default (owner rename 2026-10-14) and the current Hebrew defaults - a screen writes neither; naming.ts holds the defaults. */
const HE_DEFAULT = /קריא(ה|ות|ת)|בקש(ת|ות) ה?שירות|ניהול השירות/;
/** The words the owner retired on 2026-10-14: they appear in NO file of the module, comments included (naming.ts too). */
const OLD_WORDS = /קריא(ה|ות|ת)/;
/** "Ticket" / "Tickets" as a word INSIDE a string literal (identifiers such as TicketItem are code, not text). */
const EN_DEFAULT = /(['"`])(?:(?!\1).)*\bTickets?\b(?:(?!\1).)*\1/;

/** The files a tickets screen is made of (owned by the module) - every line counts. naming.ts is the single home of the defaults. */
const OWNED = walk(SRC).map(rel).filter((r) => (/^tickets\//.test(r) || /^api\/tickets/.test(r) || /^screens\/(tickets-|ticket-|system-tickets|system-messaging-accounts)/.test(r)) && r !== 'tickets/naming.ts');
/** Shared files that name the module: only their lines about tickets count (elsewhere the same Hebrew word means "a reading"). */
const SHARED = ['shell/nav.ts', 'screens/system-index.ts', 'shell/sw-app.ts', 'router.ts'];

test('no tickets screen, the navigation or the settings index writes the default name (D33: the tokens and tt() only)', () => {
  expect(OWNED.length).toBeGreaterThanOrEqual(10);
  for (const f of ['tickets/text.ts', 'tickets/ticket-card.ts', 'tickets/ticket-detail.ts', 'screens/tickets-list.ts', 'screens/system-tickets.ts', 'api/tickets.ts']) expect(OWNED).toContain(f);
  const bad: string[] = [];
  for (const r of OWNED) {
    code(readFileSync(path.join(SRC, r), 'utf8')).split('\n').forEach((line, i) => {
      if (HE_DEFAULT.test(line) || EN_DEFAULT.test(line)) bad.push(`${r}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  for (const r of SHARED) {
    code(readFileSync(path.join(SRC, r), 'utf8')).split('\n').forEach((line, i) => {
      if (/ticket/i.test(line) && (HE_DEFAULT.test(line) || EN_DEFAULT.test(line))) bad.push(`${r}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  expect(bad, `write the module's name with {ticket} / {tickets} and render it with tt() / tn() (tickets/naming.ts):\n${bad.join('\n')}`).toEqual([]);
});

test('the lint itself catches a hard-coded name (a planted line is found)', () => {
  const planted = ["const x = 'קריאה חדשה';", 'const y = `Open Ticket`;', "html`<b>הקריאות</b>`"];
  for (const p of planted) expect(HE_DEFAULT.test(code(p)) || EN_DEFAULT.test(code(p)), p).toBe(true);
  for (const ok of ['// הקריאה: a comment', "const t: TicketItem = x;", "tt('newTitle')", "'ticket-card'"]) expect(HE_DEFAULT.test(code(ok)) || EN_DEFAULT.test(code(ok)), ok).toBe(false);
});

test('owner rename 2026-10-14: the retired words are in no file of the module (the vendor page and naming.ts included, comments too)', () => {
  // the vendor page (its own bundle, its own fallback names in claim-text.ts) counts here too
  const files = [...OWNED, 'tickets/naming.ts', ...walk(path.join(SRC, 'public-ticket')).map(rel)];
  expect(files.some((r) => r.startsWith('public-ticket/'))).toBe(true);
  const bad: string[] = [];
  for (const r of files) {
    readFileSync(path.join(SRC, r), 'utf8').split('\n').forEach((line, i) => {
      if (OLD_WORDS.test(line)) bad.push(`${r}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  expect(bad, `the item is "בקשת שירות" / "בקשות שירות" and the module "ניהול השירות":\n${bad.join('\n')}`).toEqual([]);
  for (const p of ['הקריאות', "'קריאת שירות'"]) expect(OLD_WORDS.test(p), p).toBe(true);
  for (const p of ["const x = 'בקשת שירות חדשה';", "html`<b>ניהול השירות</b>`"]) expect(HE_DEFAULT.test(code(p)), p).toBe(true);
});

test('no text writes the article in front of a name token ("ה{ticket}" would read "הבקשת שירות"; {the_ticket} is the way)', () => {
  const article = /(?<![א-ת])ה\{tickets?\}/;
  const files = [...OWNED, ...SHARED, ...walk(path.join(SRC, 'public-ticket')).map(rel)];
  const bad: string[] = [];
  for (const r of files) readFileSync(path.join(SRC, r), 'utf8').split('\n').forEach((line, i) => { if (article.test(line)) bad.push(`${r}:${i + 1}`); });
  expect(bad, bad.join('\n')).toEqual([]);
  expect(article.test("'ה{ticket} נפתחה'")).toBe(true);
  expect(article.test("'{the_ticket}'")).toBe(false);
});
