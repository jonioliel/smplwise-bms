/**
 * CR-038, owner decision D33 (2026-10-13): the tickets module's USER-FACING name is configurable (Settings › the module › general).
 * Internal identifiers (routes `#/tickets`, the API, permission keys, the `tickets.enabled` switch) stay "tickets"; every text a
 * person reads that names the module is written as a TEMPLATE and rendered here - the twin of the server's
 * services/tickets/naming.py (same tokens, same defaults).
 *
 * THE CONTRACT (every slice that adds a screen, a tab, a menu item or a message naming the module):
 *   {ticket}            the singular        ("בקשת שירות")
 *   {tickets}           the plural          ("בקשות שירות")
 *   {the_ticket}        the singular with the Hebrew article ("בקשת השירות" - write it instead of "ה" + {ticket})
 *   {the_tickets}       the plural with the Hebrew article ("בקשות השירות")
 *   {module}            the module's own name ("ניהול השירות": the area, the page titles, the settings tab)
 *   {f:<text>|m:<text>} a word that agrees with the name's grammatical gender ("חדשה" / "חדש"); Russian may add |n:<text>
 * Owner rename 2026-10-14: the default Hebrew names are the module "ניהול השירות" and the item "בקשת שירות" / "בקשות שירות"
 * (feminine). The article tokens put "ה" before the LAST word of a Hebrew construct ("בקשת השירות"; a last word already starting
 * with "ה" is kept) or in front of a single word; a name without Hebrew letters is returned as it is (services/tickets/naming.py
 * `definite`). `module` is optional: absent, it is the default module name while the item names are the defaults, else the plural.
 * Write the text with the tokens in tickets/text.ts (or next to the screen) and render it with `tn(text)`; never write the default
 * word. tests/unit-tickets-naming.spec.ts fails when a tickets screen, the nav or the settings index carries the default name.
 *
 * The names arrive with the session (`/me` › `modules.tickets_name`) and after a rename in Settings (`setTicketNames`); listeners
 * (`onTicketNames`) re-render the shell's navigation and every open screen at once ("shown live").
 */

export type TicketLang = 'he' | 'en' | 'ar' | 'ru';
export interface TicketName {
  one: string;
  many: string;
  /** 'f' | 'm' (he, ar), 'f' | 'm' | 'n' (ru), '' (en) */
  gender: string;
  /** the module's own name (owner rename 2026-10-14); absent = derived (see moduleName) */
  module?: string;
}
export type TicketNameDoc = Record<TicketLang, TicketName> & { revision?: number };

export const TICKET_LANGS: readonly TicketLang[] = ['he', 'en', 'ar', 'ru'];
export const DEFAULT_TICKET_NAMES: Readonly<Record<TicketLang, TicketName>> = {
  he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f', module: 'ניהול השירות' },
  en: { one: 'Ticket', many: 'Tickets', gender: '', module: 'Tickets' },
  ar: { one: 'بلاغ', many: 'بلاغات', gender: 'm', module: 'بلاغات' },
  ru: { one: 'Заявка', many: 'Заявки', gender: 'f', module: 'Заявки' },
};
export const TICKET_GENDERS: Readonly<Record<TicketLang, readonly string[]>> = { he: ['f', 'm'], ar: ['f', 'm'], ru: ['f', 'm', 'n'], en: [''] };
export const NAME_MAX = 30;

let names: Record<TicketLang, TicketName> = { ...DEFAULT_TICKET_NAMES };
const listeners = new Set<() => void>();

const TOKEN = /\{(the_tickets|the_ticket|tickets|ticket|module)\}|\{f:([^{}|]*)\|m:([^{}|]*)(?:\|n:([^{}|]*))?\}/g;

/** One language entry as the client accepts it (the server validated it; this only refuses a malformed shape). */
function entryOf(lang: TicketLang, raw: unknown): TicketName {
  const r = raw as Partial<TicketName> | null | undefined;
  if (!r || typeof r.one !== 'string' || typeof r.many !== 'string' || !r.one.trim() || !r.many.trim()) return { ...DEFAULT_TICKET_NAMES[lang] };
  const gender = typeof r.gender === 'string' && TICKET_GENDERS[lang].includes(r.gender) ? r.gender : DEFAULT_TICKET_NAMES[lang].gender;
  const module = typeof r.module === 'string' && r.module.trim() ? r.module : moduleDefault(lang, r.one, r.many);
  return { one: r.one, many: r.many, gender, module };
}

/** The module's name when none is set: the default while the item names are the defaults, else the plural. */
export function moduleDefault(lang: TicketLang, one: string, many: string): string {
  const d = DEFAULT_TICKET_NAMES[lang];
  return one === d.one && many === d.many ? (d.module ?? d.many) : many;
}

/** The Hebrew definite form: "ה" before the last word of a construct ("בקשת שירות" -> "בקשת השירות"), in front of a single word;
 * a last word already starting with "ה" and a name without Hebrew letters are kept (the server's naming.definite). */
export function definite(name: string): string {
  if (!/[א-ת]/.test(name)) return name;
  const words = name.split(' ');
  if (words.length > 1 && words[words.length - 1].startsWith('ה')) return name;
  words[words.length - 1] = `ה${words[words.length - 1]}`;
  return words.join(' ');
}

/** Take the names the server sent (a missing or broken language keeps its default) and tell every listener. */
export function setTicketNames(doc: Partial<Record<TicketLang, unknown>> | null | undefined): void {
  const next = {} as Record<TicketLang, TicketName>;
  for (const lang of TICKET_LANGS) next[lang] = entryOf(lang, doc?.[lang]);
  const changed = TICKET_LANGS.some((l) => next[l].one !== names[l].one || next[l].many !== names[l].many || next[l].gender !== names[l].gender || next[l].module !== names[l].module);
  names = next;
  if (changed) for (const l of listeners) l();
}

export function onTicketNames(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ticketNames(lang: TicketLang = 'he'): TicketName {
  return names[lang];
}

/** Render a template with one language's names (pure: the unit tests and the settings preview call it directly). */
export function renderName(template: string, n: TicketName): string {
  return template.replace(TOKEN, (_m, word: string | undefined, f: string | undefined, m: string | undefined, neuter: string | undefined) => {
    if (word === 'tickets') return n.many;
    if (word === 'ticket') return n.one;
    if (word === 'the_tickets') return definite(n.many);
    if (word === 'the_ticket') return definite(n.one);
    if (word === 'module') return n.module || n.many;
    if (n.gender === 'm') return m ?? '';
    if (n.gender === 'n' && neuter !== undefined) return neuter;
    return f ?? '';
  });
}

/** THE helper of the screens: a template rendered with the current Hebrew names (the product's UI language). */
export function tn(template: string, lang: TicketLang = 'he'): string {
  return renderName(template, names[lang]);
}

export function hasNameTokens(text: string): boolean {
  return new RegExp(TOKEN.source).test(text);
}

/** The client-side check of a name the settings form is about to save (the server's rules: 1-30 characters, letters / marks / digits /
 * spaces and a few typographic signs, no markup, no control characters, at least one letter). Returns an error code or ''. */
export function nameProblem(value: string): '' | 'required' | 'too_long' | 'character' | 'no_letter' | 'control_character' {
  if (/[\p{Cc}\p{Cf}]/u.test(value)) return 'control_character';
  const text = value.split(/\s+/).filter(Boolean).join(' ');
  if (!text) return 'required';
  if ([...text].length > NAME_MAX) return 'too_long';
  if (!/^[\p{L}\p{M}\p{Nd} \-'"׳״.()]+$/u.test(text)) return 'character';
  if (!/\p{L}/u.test(text)) return 'no_letter';
  return '';
}
