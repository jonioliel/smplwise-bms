/**
 * CAL-ATTENDEES-2343: the pure part of the attendee picker (unit-tested in node: tests/unit-calendars-attendees-2343.spec.ts). Hebrew labels,
 * the guest validation that mirrors the server (services/calendar/attendees.py - the server still decides), the chips' texts and the
 * payload a new entry / a desired list sends.
 */
import type { Attendee, AttendeeInput, AttendeeKind, AttendeeRole, DirectoryHit, InviteStatus } from '../api/calendar-attendees';

export const KIND_LABEL: Record<AttendeeKind, string> = { user: 'משתמש', resident: 'דייר', guest: 'אורח' };
export const ROLE_LABEL: Record<AttendeeRole, string> = { required: 'חובה', optional: 'רשות' };
export const STATUS_LABEL: Record<InviteStatus, string> = { invited: 'הוזמן', accepted: 'מגיע', declined: 'לא מגיע', tentative: 'אולי' };
export const RESPONSE_LABEL: Record<Exclude<InviteStatus, 'invited'>, string> = { accepted: 'מגיע/ה', tentative: 'אולי', declined: 'לא מגיע/ה' };
export const CONTACT_NOTE = 'פרטי הקשר של אורחים גלויים רק למארגן ולמנהלי היומן.';

/** A chip of the picker before it is saved (a new entry) or after (an existing one: `id` is the attendee id). */
export interface AttendeeDraft {
  key: string;
  id?: string;
  kind: AttendeeKind;
  ref_id?: string;
  name: string;
  role: AttendeeRole;
  phone?: string;
  email?: string;
  status?: InviteStatus;
}

const PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s<>"',;]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** The server's normalisation: separators out, 00 -> +, a local 0 -> +972 (an Israeli number). */
export function normalisePhone(raw: string): string {
  let d = raw.replace(/[\s\-().]/g, '');
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  else if (d.startsWith('0')) d = `+972${d.slice(1)}`;
  return d;
}

export interface GuestErrors { name?: string; phone?: string; email?: string }

/** The guest form's messages (Hebrew), per field; an empty object = valid. Name + (phone OR e-mail). */
export function validateGuest(name: string, phone: string, email: string): GuestErrors {
  const out: GuestErrors = {};
  const n = name.trim();
  if (!n) out.name = 'חסר שם האורח.';
  else if (n.length > 80) out.name = 'השם ארוך מדי.';
  const p = phone.trim();
  const e = email.trim();
  if (p && !PHONE.test(normalisePhone(p))) out.phone = 'מספר הטלפון אינו תקין.';
  if (e && (e.length > 254 || !EMAIL.test(e))) out.email = 'כתובת הדוא״ל אינה תקינה.';
  if (!p && !e) out.phone = 'לאורח צריך טלפון או דוא״ל.';
  return out;
}

export const hasErrors = (e: GuestErrors) => Object.keys(e).length > 0;

let seq = 0;
const nextKey = () => `d${++seq}`;

export function draftOfHit(h: DirectoryHit, role: AttendeeRole = 'required'): AttendeeDraft {
  return { key: `${h.kind}:${h.ref_id}`, kind: h.kind, ref_id: h.ref_id, name: h.name, role };
}

export function draftOfGuest(name: string, phone: string, email: string, role: AttendeeRole = 'required'): AttendeeDraft {
  const p = phone.trim();
  return { key: nextKey(), kind: 'guest', name: name.trim(), role, ...(p ? { phone: normalisePhone(p) } : {}), ...(email.trim() ? { email: email.trim().toLowerCase() } : {}) };
}

export function draftOfAttendee(a: Attendee): AttendeeDraft {
  return { key: a.ref_id ? `${a.kind}:${a.ref_id}` : `id:${a.id}`, id: a.id, kind: a.kind, ref_id: a.ref_id ?? undefined, name: a.name, role: a.role, status: a.status,
    phone: a.contact?.phone || undefined, email: a.contact?.email || undefined };
}

/** Adds a directory hit unless that person is already a chip (a user / resident is never doubled). */
export function addHit(list: AttendeeDraft[], h: DirectoryHit): AttendeeDraft[] {
  return list.some((d) => d.kind === h.kind && d.ref_id === h.ref_id) ? list : [...list, draftOfHit(h)];
}

export const toggleRole = (r: AttendeeRole): AttendeeRole => (r === 'required' ? 'optional' : 'required');

/** The `attendees` of POST /calendar/events (and a desired list): guests carry their contact, the others a reference. */
export function payloadOf(list: AttendeeDraft[]): AttendeeInput[] {
  return list.map((d) => d.kind === 'guest'
    ? { kind: 'guest' as const, name: d.name, role: d.role, ...(d.phone ? { phone: d.phone } : {}), ...(d.email ? { email: d.email } : {}) }
    : { kind: d.kind, ref_id: d.ref_id as string, role: d.role });
}

/** The chip's accessible name: "נועה לוי, משתמש, חובה, מגיע". */
export function chipLabel(d: AttendeeDraft): string {
  return [d.name || KIND_LABEL[d.kind], KIND_LABEL[d.kind], ROLE_LABEL[d.role], d.status ? STATUS_LABEL[d.status] : ''].filter(Boolean).join(', ');
}

/** "3 מוזמנים" / "מוזמן אחד" / "אין מוזמנים" (the count a viewer gets when the list is not his to see). */
export function countText(n: number | null): string {
  if (n === null) return '';
  if (n === 0) return 'אין מוזמנים';
  if (n === 1) return 'מוזמן אחד';
  return `${n} מוזמנים`;
}

/** The hits not yet chosen (the search list hides who is already in). */
export function freshHits(hits: DirectoryHit[], list: AttendeeDraft[]): DirectoryHit[] {
  return hits.filter((h) => !list.some((d) => d.kind === h.kind && d.ref_id === h.ref_id));
}

/** Summary line of the statuses: "2 מגיעים · 1 לא מגיע · 1 טרם ענה". */
export function statusSummary(list: { status?: InviteStatus }[]): string {
  const n = (s: InviteStatus) => list.filter((d) => d.status === s).length;
  const parts: string[] = [];
  if (n('accepted')) parts.push(`${n('accepted')} מגיעים`);
  if (n('tentative')) parts.push(`${n('tentative')} אולי`);
  if (n('declined')) parts.push(`${n('declined')} לא מגיעים`);
  if (n('invited')) parts.push(`${n('invited')} טרם ענו`);
  return parts.join(' · ');
}
