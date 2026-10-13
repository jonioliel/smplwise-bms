import type { TicketDetail } from '../api/tickets';
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';

/**
 * CR-038 slice 7 (option B, spec 10.5): the pure logic of the manager's "נעילת קוד" card (tickets/code-lock.ts renders it).
 * Node-testable: no DOM, no network. Texts in Hebrew + English; none of them names the module (D33).
 */

/** The `link` block of the ticket detail (services/tickets/handler_links.link_block) - the fields the card reads. */
export interface TicketLinkBlock {
  state: 'live' | 'grace' | 'expired' | 'revoked';
  current: boolean;
  generation: number;
  require_code: boolean;
  code_locked: boolean;
  code_locked_until?: string | null;
  can: { copy: boolean; new: boolean; revoke: boolean; resend: boolean };
}

export const LOCK_TEXT = {
  he: { title: 'נעילת קוד', until: 'נעול עד {when}', newLink: 'שלח קישור חדש', done: 'נוצר קישור חדש' },
  en: { title: 'Code locked', until: 'Locked until {when}', newLink: 'Send a new link', done: 'A new link was created' },
} as const;
export type CodeLockTextKey = keyof (typeof LOCK_TEXT)['he'];

export function lockText(key: CodeLockTextKey, vars?: Record<string, string>, lang: 'he' | 'en' = ticketsLang()): string {
  const named = tn(LOCK_TEXT[lang][key] ?? LOCK_TEXT.he[key], lang as TicketLang);
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m)) : named;
}

/** The link block of a detail answer (absent before slice 4's backend, null for tickets that never went outside). */
export function linkOf(t: Pick<TicketDetail, 'id'> & { link?: unknown }): TicketLinkBlock | null {
  const link = t.link;
  return link && typeof link === 'object' ? (link as TicketLinkBlock) : null;
}

export interface CodeLockCard {
  show: boolean;
  until: string | null; // ISO, while the lock lasts
  canNew: boolean;
}

/** The card shows when the CURRENT assignment's link is code-locked, or the ticket still waits for the manager because of a lock
 * that has meanwhile ended (the manager decides); the one tap is offered when the server allows a new link. */
export function codeLockCard(t: Pick<TicketDetail, 'id' | 'waiting_on' | 'waiting_reason'> & { link?: unknown }, now: number = Date.now()): CodeLockCard {
  const link = linkOf(t);
  if (!link || !link.current) return { show: false, until: null, canNew: false };
  const until = link.code_locked && link.code_locked_until && Date.parse(link.code_locked_until) > now ? link.code_locked_until : null;
  const waiting = t.waiting_on === 'manager' && t.waiting_reason === 'code_locked';
  return { show: Boolean(link.code_locked) || waiting, until, canNew: Boolean(link.can?.new) };
}
