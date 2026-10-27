/**
 * ACCESSREQ-293: the pure logic of the manual "request external access" form (owner-approved mockup
 * private/planning/mockup_access_request_2026-10-20): the form state, the field checks (mirrors of the server's rules - the server
 * decides), "I approve now" and why it is blocked (owner decision a: only a system administrator approves his own request), the
 * door choice (owner decision b comes from the server's `may_request`), the window in the installation's IANA zone (DST-safe) and the
 * timing payload. No DOM, no network: unit-tested.
 */
import type { Contact } from '../api/tickets-s4';
import type { GrantableDoors, RequestBody, Timing } from '../api/access-grants';
import { instantInZone } from '../api/recordings';
import type { RtKey } from '../i18n/access-request';

export const MAX_WINS = 8;
export const PURPOSE_MAX = 200;
export const NOTES_MAX = 1000;
export const PRESETS: [string, string][] = [['07:00', '12:00'], ['07:00', '16:00'], ['08:00', '17:00'], ['12:00', '20:00'], ['07:00', '20:00'], ['00:00', '24:00']];
/** WisKey's weekday names (intercom_writes.DAYS); index 0 = Sunday, as the form's pills. */
export const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const LANGS = ['he', 'en', 'ar', 'ru'] as const;
export type Lang = (typeof LANGS)[number];

export interface Win {
  s: string;
  e: string;
}

export interface RequestForm {
  mode: 'dir' | 'new';
  q: string;
  contactId: string | null;
  np: { name: string; company: string; phone: string; lang: Lang };
  ticketId: string;
  purpose: string;
  /** `${station_id}:${relay}` */
  doors: Set<string>;
  dq: string;
  from: string;
  until: string;
  dmode: 'weekly' | 'dates';
  days: Set<number>;
  dates: Set<string>;
  wins: Win[];
  cred: 'pin' | 'none' | 'card'; // GRANTS3-295: 'card' only while the cards switch is on (a vendor's technician; the server decides)
  /** EXTERNALBUILD-297: a window code (default) or a one-time code - only with a PIN */
  once: boolean;
  notes: string;
  told: boolean;
  path: 'self' | 'send';
  tried: boolean;
}

export function freshForm(): RequestForm {
  return {
    mode: 'dir', q: '', contactId: null, np: { name: '', company: '', phone: '', lang: 'he' }, ticketId: '', purpose: '', doors: new Set(), dq: '',
    from: '', until: '', dmode: 'weekly', days: new Set([0, 1, 2, 3, 4]), dates: new Set(), wins: [{ s: '07:00', e: '16:00' }], cred: 'pin', once: false, notes: '',
    told: false, path: 'send', tried: false,
  };
}

// ---------------------------------------------------------------- the person

export type Eligibility = 'ok' | 'company' | 'user' | 'inactive' | 'employee';

/** Why a directory row cannot hold a grant (services/access_grants.subject_problem): only an active `person` that is not an Arx user. */
export function eligibility(c: Pick<Contact, 'kind' | 'user_linked' | 'active' | 'erased'>): Eligibility {
  if (c.kind === 'vendor') return 'company';
  if (c.kind === 'employee') return 'employee';
  if (c.user_linked) return 'user';
  if (!c.active || c.erased) return 'inactive';
  return 'ok';
}

/** A number the person confirmed himself (by the code or his own action) - never a manager's mark (access_grants.number_problem). */
export function confirmedNumber(c: Pick<Contact, 'phone_confirmed' | 'phone_confirmed_via' | 'has_phone'> | null | undefined): boolean {
  return !!c && !!c.has_phone && !!c.phone_confirmed && (c.phone_confirmed_via === 'user' || c.phone_confirmed_via === 'code');
}

/** An Israeli mobile number as typed (05X-XXXXXXX or 9725XXXXXXXX), digits only. */
export function phoneOk(text: string): boolean {
  return /^(05\d{8}|9725\d{8})$/.test(text.replace(/\D/g, ''));
}

// ---------------------------------------------------------------- doors

export const doorKey = (sid: string, relay: number) => `${sid}:${relay}`;
export function splitDoor(k: string): [string, number] {
  const i = k.lastIndexOf(':');
  return [k.slice(0, i), Number(k.slice(i + 1))];
}

export function doorsBody(doors: Set<string>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const k of doors) {
    const [s, r] = splitDoor(k);
    (out[s] ??= []).push(r);
  }
  for (const s of Object.keys(out)) out[s].sort((a, b) => a - b);
  return out;
}

export const chosenStations = (doors: Set<string>): string[] => [...new Set([...doors].map((k) => splitDoor(k)[0]))].sort();

/** Drop the doors the caller may no longer request (a ticket change moves owner decision b's "ticket's station"). */
export function keepRequestable(doors: Set<string>, g: GrantableDoors | null): Set<string> {
  if (!g) return doors;
  const ok = new Set(g.stations.filter((s) => s.may_request).map((s) => s.station_id));
  return new Set([...doors].filter((k) => ok.has(splitDoor(k)[0])));
}

// ---------------------------------------------------------------- dates and times

const mins = (t: string) => (t === '24:00' ? 1440 : Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));

function addDays(date: string, n: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + n * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Inclusive number of calendar days. */
export function daySpan(from: string, until: string): number {
  return Math.round((Date.UTC(+until.slice(0, 4), +until.slice(5, 7) - 1, +until.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400_000) + 1;
}

/** Every day of the range (at most 31, for the "specific dates" pills). */
export function rangeDates(from: string, until: string): string[] {
  if (!from || !until || until < from || daySpan(from, until) > 31) return [];
  const out: string[] = [];
  for (let d = from; d <= until; d = addDays(d, 1)) out.push(d);
  return out;
}

export const dm = (d: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : '');

/**
 * The window the server stores: local 00:00 of the first day .. local 24:00 of the last day, resolved in the installation's zone.
 * The server caps a window at `maxDays` x 24 h; a window that crosses a DST change by an hour is ended an hour earlier rather than refused.
 */
export function windowOf(from: string, until: string, tz: string, maxDays: number): { valid_from: string; valid_until: string } {
  const vf = instantInZone(from, 0, tz);
  let vu = instantInZone(addDays(until, 1), 0, tz);
  const cap = vf.getTime() + maxDays * 86400_000;
  if (vu.getTime() > cap) vu = new Date(cap);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { valid_from: iso(vf), valid_until: iso(vu) };
}

export function timingOf(f: RequestForm, tz: string): Timing {
  const periods = [...f.wins].sort((a, b) => mins(a.s) - mins(b.s)).map((w) => ({ start: w.s, end: w.e }));
  return f.dmode === 'weekly'
    ? { mode: 'weekly', timezone: tz, days: [...f.days].sort().map((i) => WEEKDAY[i]), dates: [], periods }
    : { mode: 'dates', timezone: tz, days: [], dates: [...f.dates].sort(), periods };
}

/** When the code leaves (owner answer 4): `codeHour`:00 the evening before the first day; null = at once on activation. */
export function codeDue(from: string, today: string, codeHour: number, nowMinutes: number): string | null {
  if (!from) return null;
  const eve = addDays(from, -1);
  if (eve < today || (eve === today && nowMinutes >= codeHour * 60)) return null;
  return `${dm(eve)} ${String(codeHour).padStart(2, '0')}:00`;
}

// ---------------------------------------------------------------- "I approve now" (owner decision a)

export type BlockKey = 'blk_second' | 'blk_offline' | 'blk_doors' | 'blk_pin' | 'blk_numberNew' | 'blk_number';

export interface Ctx {
  today: string;
  maxDoors: number;
  maxDays: number;
  grantable: GrantableDoors | null;
  contact: Contact | null;
  approvers: number | null;
}

/** Why "I approve now" is not offered (null = it is): a second person approves unless the caller is a system administrator. */
export function selfBlock(f: RequestForm, ctx: Ctx): BlockKey | null {
  const g = ctx.grantable;
  if (!g?.system_admin) return 'blk_second';
  if (!g.reachable) return 'blk_offline';
  const by = new Map(g.stations.map((s) => [s.station_id, s]));
  const st = chosenStations(f.doors);
  if (st.some((s) => !by.get(s)?.may_approve)) return 'blk_doors';
  if (f.cred === 'pin' && st.some((s) => !by.get(s)?.may_approve_pin)) return 'blk_pin';
  if (f.cred === 'pin' && f.mode === 'new') return 'blk_numberNew';
  if (f.cred === 'pin' && f.mode === 'dir' && f.contactId && !confirmedNumber(ctx.contact)) return 'blk_number';
  return null;
}

// ---------------------------------------------------------------- the checks

export type ErrKey = 'person' | 'npName' | 'npPhone' | 'purpose' | 'doors' | 'dates' | 'days' | 'wins' | 'told' | 'path';
export type Errs = Partial<Record<ErrKey, { key: RtKey; vars?: Record<string, string | number> }>>;

export function validate(f: RequestForm, ctx: Ctx): Errs {
  const e: Errs = {};
  if (f.mode === 'dir') {
    if (!f.contactId) e.person = { key: 'err_person' };
  } else {
    if (f.np.name.trim().length < 2) e.npName = { key: 'err_npName' };
    if (!phoneOk(f.np.phone)) e.npPhone = { key: 'err_npPhone' };
  }
  if (f.purpose.length > PURPOSE_MAX || /\n/.test(f.purpose)) e.purpose = { key: 'err_purpose' };
  const n = f.doors.size;
  if (n === 0) e.doors = { key: 'err_doorsNone' };
  else if (n > ctx.maxDoors) e.doors = { key: 'err_doorsMany', vars: { max: ctx.maxDoors, n: n - ctx.maxDoors } };
  if (!f.from || !f.until) e.dates = { key: 'err_datesPick' };
  else if (f.until < f.from) e.dates = { key: 'err_datesOrder' };
  else if (f.until < ctx.today) e.dates = { key: 'err_datesPast' };
  else if (daySpan(f.from, f.until) > ctx.maxDays) e.dates = { key: 'err_datesLong', vars: { max: ctx.maxDays } };
  if (f.dmode === 'weekly' && f.days.size === 0) e.days = { key: 'err_days' };
  if (f.dmode === 'dates' && f.dates.size === 0) e.days = { key: 'err_datesNone' };
  if (f.wins.some((w) => !w.s || !w.e || mins(w.s) >= mins(w.e))) e.wins = { key: 'err_winsOrder' };
  else {
    const s = [...f.wins].sort((a, b) => mins(a.s) - mins(b.s));
    if (s.some((w, i) => i > 0 && mins(s[i - 1].e) > mins(w.s))) e.wins = { key: 'err_winsOverlap' };
  }
  if (!f.told) e.told = { key: 'err_told' };
  if (n && ctx.approvers === 0) e.path = { key: 'err_pathNone' };
  if (f.path === 'self') {
    const b = selfBlock(f, ctx);
    if (b) e.path = e.path ?? { key: b };
  }
  return e;
}

/** The body of POST /access-grants for a chosen (or just created) contact. */
export function bodyOf(f: RequestForm, contactId: string, tz: string, maxDays: number): RequestBody {
  return {
    contact_id: contactId,
    ticket_id: f.ticketId || null,
    doors: doorsBody(f.doors),
    ...windowOf(f.from, f.until, tz, maxDays),
    timing: timingOf(f, tz),
    credential: f.cred,
    purpose: f.purpose.trim() || null,
    notes: f.notes.trim() || null,
    told: f.told,
    approve_now: f.path === 'self',
    ...(f.cred === 'pin' && f.once ? { code_mode: 'single_entry' as const } : {}),
  };
}
