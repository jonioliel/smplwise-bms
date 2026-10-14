/**
 * CR-038 slice 5b: the pure logic of the message lines - the delivery line of a message (D14), its purpose label, which rows the
 * ticket page shows, and the timeline line of a message / reply / link event. No DOM, no Lit, no API: the node unit tests
 * (tests/unit-tickets-messages.spec.ts) read it directly. The product never says "delivered" or "read" (D14).
 */
import type { TicketEvent } from '../api/tickets';
import type { AssignPreviewExtra, TicketMessage } from '../api/tickets-messages';
import { shortDateTime, statusLabel, type EventLine } from './model';
import { mtt, type MessageTextKey } from './messages-text';

const sameDay = (d: Date, now: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

/** "14:02" today, else "14:02 13/10" (the browser's zone, the screens' rule). */
export function when(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return sameDay(d, now) ? `${p(d.getHours())}:${p(d.getMinutes())}` : shortDateTime(iso);
}

export interface MessageLine {
  text: string;
  tone: 'ok' | 'run' | 'bad' | '';
}

/** The one line of a delivery row (D14). */
export function messageLine(m: Pick<TicketMessage, 'state' | 'channel' | 'held_reason' | 'not_before' | 'sent_at' | 'created_at'>, now: Date = new Date()): MessageLine {
  const at = when(m.sent_at ?? m.created_at, now);
  switch (m.state) {
    case 'sent':
      return { text: mtt(m.channel === 'email' ? 'st_sent_email' : 'st_sent_whatsapp', { when: at }), tone: 'ok' };
    case 'unknown':
      return { text: mtt('st_unknown', { when: at }), tone: 'run' };
    case 'not_sent':
    case 'refused':
      return { text: mtt('st_failed'), tone: 'bad' };
    case 'held':
      if (m.held_reason === 'send_hours') return { text: mtt('st_held_hours', { when: when(m.not_before, now) }), tone: 'run' };
      if (m.held_reason === 'channel_down') return { text: mtt('st_held_down'), tone: 'bad' };
      if (m.held_reason === 'account_unmapped') return { text: mtt('st_held_unmapped'), tone: 'bad' };
      return { text: mtt('st_held_off'), tone: 'run' };
    case 'sending':
      return { text: mtt('st_sending'), tone: 'run' };
    default:
      return { text: mtt('st_queued'), tone: 'run' };
  }
}

const PURPOSE_KEYS: Record<string, MessageTextKey> = {
  assign: 'p_assign', reminder: 'p_reminder', code: 'p_code', closed: 'p_closed', reassigned: 'p_reassigned', reopened: 'p_reopened',
  update: 'p_update', test: 'p_test',
};

export function purposeLabel(p: string): string {
  return PURPOSE_KEYS[p] ? mtt(PURPOSE_KEYS[p]) : p;
}

export interface AssignLines {
  /** "יישלח בוואטסאפ · <account>" / "יישלח במייל" */
  via: string;
  /** the WhatsApp account cannot send now: the message waits, then falls back (9.9.4) - '' when it can (or the server did not say) */
  down: string;
  /** outside the send hours: when it would leave - '' inside them */
  hours: string;
  /** "שלח עכשיו" preselected (a critical priority, D29) */
  sendNowDefault: boolean;
}

/** The assign dialog's lines for a message to an outside contact (slice 4's dialog, the preview's slice-5b fields); null for the
 * manager's own copy (slice 4 shows its line). `account` undefined = a server without these fields: no warning. */
export function assignLines(p: { channel: string } & AssignPreviewExtra, now: Date = new Date()): AssignLines | null {
  if (p.channel !== 'whatsapp' && p.channel !== 'email') return null;
  const acc = p.account;
  const via = p.channel === 'email' ? mtt('asgEmail') : acc ? mtt('asgWhatsapp', { account: acc.label }) : mtt('asgWhatsappPlain');
  const down = p.channel === 'whatsapp' && acc !== undefined && (!acc || !acc.sendable) ? mtt(p.fallback === 'email' ? 'asgDownEmail' : 'asgDownManual') : '';
  const sh = p.send_hours;
  const out = !!sh && !sh.open_now;
  return { via, down, hours: out ? mtt('asgHours', { when: when(sh?.next_opening, now) }) : '', sendNowDefault: out && !!sh?.send_now_default };
}

/** The rows the ticket page shows: newest first (the server's order), no test sends, at most 6 (the timeline keeps the history). */
export function visibleMessages<T extends Pick<TicketMessage, 'purpose'>>(list: T[] | undefined): T[] {
  return (list ?? []).filter((m) => m.purpose !== 'test').slice(0, 6);
}

/** The timeline line of a message / reply / link event (slices 4 and 5b), or null for a kind this module does not know. */
export function messageEventLine(e: TicketEvent): EventLine | null {
  const d = e.data ?? {};
  const account = typeof d.account === 'string' && d.account ? ` · ${mtt('e_via_account', { account: d.account })}` : '';
  switch (e.kind) {
    case 'link_sent':
      return { icon: 'check', text: e.via === 'email' ? mtt('e_sent_email') : `${mtt('e_sent_whatsapp')}${account}` };
    case 'update_sent':
      return { icon: 'check', text: `${mtt('e_update_sent')}${e.via === 'email' ? '' : account}` };
    case 'reminder':
      return { icon: 'clock', text: `${mtt('e_reminder_sent')}${e.via === 'email' ? '' : account}` };
    case 'code_sent':
      return { icon: 'lock', text: mtt('e_code_sent') };
    case 'message_unknown':
      return { icon: 'clock', text: mtt('e_message_unknown') };
    case 'message_failed':
      return { icon: 'x', text: mtt('e_message_failed') };
    case 'message_fallback':
      return { icon: 'refresh', text: mtt(d.step === 'email' ? 'e_fallback_email' : d.step === 'code_unavailable' ? 'e_fallback_code' : 'e_fallback_nobody') };
    case 'inbound':
      return { icon: 'note', text: mtt('e_inbound') };
    case 'late_reply':
      return { icon: 'clock', text: mtt('e_late_reply') };
    case 'link_opened':
      return { icon: 'check', text: mtt('e_link_opened') };
    case 'link_copied':
      return { icon: 'copy', text: mtt('e_link_copied') };
    case 'link_new':
      return { icon: 'refresh', text: mtt('e_link_new') };
    case 'link_revoked':
      return { icon: 'x', text: mtt('e_link_revoked') };
    case 'status':
      return e.actor.kind === 'inbound' ? { icon: 'check', text: mtt('e_inbound_status', { status: e.to ? statusLabel(e.to) : '' }) } : null;
    default:
      return null;
  }
}
