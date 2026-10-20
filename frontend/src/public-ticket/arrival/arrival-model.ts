/**
 * GRANTS3-295: the arrival step's pure logic (unit-tested in tests/unit-public-arrival.spec.ts). The server decides everything again;
 * this only keeps the vendor from sending what it would refuse and maps its answers to words.
 */
import type { ArrivalKey } from './arrival-text';

export interface ArrivalPerson { id: string; label: string }
export interface AccessView {
  doors: string[];
  from: string | null;
  to: string | null;
  hours: string | null;
  credential: 'pin' | 'card' | 'none';
  code?: { state: 'scheduled' | 'sent' | 'not_delivered'; at: string | null; to: string | null };
  card?: { state: 'ready' | 'preparing' };
}
export interface ArrivalCurrent { state: 'waiting' | 'approved' | 'ending' | string; person: string; pending_change: boolean; access?: AccessView }
export interface ArrivalView {
  available: boolean;
  persons: ArrivalPerson[];
  can_add: boolean;
  window: { from: string | null; to: string | null };
  hours: string[];
  max_days: number;
  notice: { version: string; text: string; attest: string; lang: string };
  current: ArrivalCurrent | null;
}
export interface ArrivalDraft { personId: string | null; newName: string; newPhone: string; from: string; to: string; hours: string; ack: boolean }

const DAY = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayMs(d: string): number {
  return Date.parse(`${d}T00:00:00Z`);
}

/** The first draft: the agreed window when the server gave one (clipped to today / max_days), else today .. today. */
export function firstDraft(v: ArrivalView, today: string): ArrivalDraft {
  const from = v.window.from && v.window.from > today ? v.window.from : today;
  let to = v.window.to && v.window.to >= from ? v.window.to : from;
  if ((dayMs(to) - dayMs(from)) / DAY + 1 > v.max_days) to = new Date(dayMs(from) + (v.max_days - 1) * DAY).toISOString().slice(0, 10);
  return { personId: v.persons.length === 1 ? v.persons[0].id : null, newName: '', newPhone: '', from, to,
    hours: v.hours.includes('08:00-17:00') ? '08:00-17:00' : v.hours[0] ?? '00:00-24:00', ack: false };
}

/** What is wrong with the draft before sending (null = sendable). */
export function draftProblem(d: ArrivalDraft, v: ArrivalView, today: string): ArrivalKey | null {
  const person = d.personId === 'new' ? d.newName.trim().length >= 2 && d.newPhone.replace(/\D/g, '').length >= 9 : !!d.personId;
  if (!person || !d.ack) return 'errRequired';
  if (!ISO_DAY.test(d.from) || !ISO_DAY.test(d.to) || d.from < today || d.to < d.from) return 'errDates';
  if ((dayMs(d.to) - dayMs(d.from)) / DAY + 1 > v.max_days) return 'errDates';
  if (!v.hours.includes(d.hours)) return 'errDates';
  return null;
}

/** Whether the chosen dates leave the agreed window (shown, not refused - the server flags it for the manager). */
export function outsideWindow(d: ArrivalDraft, v: ArrivalView): boolean {
  return (!!v.window.from && d.from < v.window.from) || (!!v.window.to && d.to > v.window.to);
}

/** The POST body (exactly one of person_id / new_person). */
export function bodyOf(d: ArrivalDraft, v: ArrivalView, crid: string): Record<string, unknown> {
  const who = d.personId === 'new' ? { new_person: { name: d.newName.trim(), phone: d.newPhone.trim() } } : { person_id: d.personId };
  return { ...who, date_from: d.from, date_to: d.to, hours: d.hours, notice_ack: d.ack, notice_version: v.notice.version, client_request_id: crid };
}

/** A refusal of the POST, in words. */
export function refusalKey(status: number, code: string | undefined): ArrivalKey {
  if (status === 0) return 'offline';
  if (status === 422) return 'errDates';
  if (code === 'arrival_other_person') return 'errOther';
  if (code === 'arrival_other_ticket') return 'errOtherTicket';
  if (code === 'no_doors_suggested') return 'errNoDoors';
  return 'errGeneric';
}

/** "22.10" / "22.10 18:00" from the server's local `YYYY-MM-DD` / `YYYY-MM-DDTHH:MM` (already in the installation's zone). */
export function shortDay(s: string | null): string {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?$/.exec(s);
  if (!m) return '';
  return `${m[3]}.${m[2]}${m[4] ? ` ${m[4]}` : ''}`;
}

/** The code line's key for an approved access. */
export function codeKey(a: AccessView): ArrivalKey | null {
  if (a.credential === 'card') return a.card?.state === 'ready' ? 'cardReady' : 'cardPreparing';
  if (a.credential !== 'pin' || !a.code) return null;
  return a.code.state === 'sent' ? 'codeSent' : a.code.state === 'not_delivered' ? 'codeFailed' : 'codeScheduled';
}
