/**
 * CR-036 S11: the pure logic of the person writes on the native people screen - no DOM, no fetch - unit-tested in Node
 * (tests/unit-people-writes-logic.spec.ts):
 *   - which actions a person's page offers (the server decides again: absence-based, from what it sent - `editable`, `level`,
 *     the archive state, the access category);
 *   - how a write's answer reads: `sync` = saved (the stations follow), `unknown_effect` = SENT and PENDING until a read shows
 *     it, a failure by its code - "not sent" / "refused" / "unknown" are never mixed up and an unknown is never success;
 *   - the delete's confirmation by the read model (the person's page no longer found);
 *   - the timing form of the editor and the patch it sends (WisKey's own rules, mirrored: services/intercom_writes.py);
 *   - the photo budget (WisKey's JPEG rule: at most 512 x 512 and 32 KB) and the card number rule.
 */
import type { AcPerson } from '../api/access-people';
import type { IntercomEditorPerson, IntercomTimingSchedule } from '../api/intercom';
import type { WritesKey } from '../i18n/access-writes';

// ---------------------------------------------------------------- the actions a person's page offers

export type PersonAction = 'edit' | 'deactivate' | 'activate' | 'temporary_cancel' | 'cards' | 'photo' | 'archive' | 'restore' | 'delete';

export interface WriteAccess {
  /** access.people.manage somewhere (the server checks every station of the person). */
  manage: boolean;
}

/** The actions offered on a person's page, in their order. Nothing without `access.people.manage` or on a person the server says
 * the caller may not change (`editable: false` - shared with a station outside their chain). Cards and the photo need the
 * sensitive level the server served (`level`); the photo also the installation's photo switch. */
export function personActions(p: Pick<AcPerson, 'editable' | 'level' | 'archived' | 'active' | 'access_category'> | null, access: WriteAccess, opts: { photoEnabled: boolean }): PersonAction[] {
  if (!p || !access.manage || !p.editable) return [];
  const out: PersonAction[] = ['edit'];
  if (!p.archived) out.push(p.active ? 'deactivate' : 'activate');
  if (!p.archived && p.active && (p.access_category === 'visitor' || p.access_category === 'contractor')) out.push('temporary_cancel');
  if (p.level === 'sensitive') {
    out.push('cards');
    if (opts.photoEnabled) out.push('photo');
  }
  out.push(p.archived ? 'restore' : 'archive', 'delete');
  return out;
}

/** The actions that ask a one-line question first (every one that changes access; the editor and the two dialogs ask their own). */
export const CONFIRMED: ReadonlySet<PersonAction> = new Set(['deactivate', 'activate', 'temporary_cancel', 'archive', 'restore', 'delete']);

// ---------------------------------------------------------------- how an answer reads

export type WriteState = 'saved' | 'pending' | 'not_sent' | 'refused' | 'unknown';

/** A success answer: `pending` (an UNKNOWN_EFFECT command - sent, the result is not known yet) or `saved`. A reply that does not
 * say its effect is read as pending (the safe side: never shown as done without the server saying so). */
export function stateOfReply(reply: { pending?: boolean; effect?: string } | null | undefined): 'saved' | 'pending' {
  return reply && reply.pending === false && reply.effect !== 'unknown_effect' ? 'saved' : 'pending';
}

/** What a failed write's error carries (an ApiError's status, code and `details.outcome`; a network failure has no code). */
export interface FailureFacts {
  status: number | null;
  code: string | null;
  outcome: string | null;
}

const REASONS: Record<string, WritesKey> = {
  intercom_person_scope: 'err.scope',
  intercom_field_level: 'err.field',
  intercom_person_not_found: 'err.gone',
  intercom_revision_conflict: 'err.revision',
  intercom_archive_state_changed: 'err.archive_state',
  intercom_person_archived: 'err.archived',
  intercom_not_temporary: 'err.not_temporary',
  intercom_already_inactive: 'err.already_inactive',
  intercom_card_conflict: 'err.card_conflict',
  intercom_card_not_found: 'err.card_gone',
  intercom_approval_required: 'err.approval',
  intercom_pin_interactive_only: 'err.pin_interactive',
  intercom_busy: 'err.busy',
  intercom_rate_limited: 'err.busy',
  intercom_unavailable: 'err.unavailable',
  intercom_duplicate_command: 'err.duplicate',
  intercom_responsible_required: 'err.guest',
  intercom_photo_disabled: 'err.photo_disabled',
  expired: 'err.expired',
  forbidden: 'err.forbidden',
  validation: 'err.invalid',
  intercom_invalid_request: 'err.invalid',
};

/** A failure as the screen says it. Only a structured answer of the server saying so is "not sent" / "refused" (a permission 403
 * is "not sent"); anything else - a dropped connection, a proxy's bare 502 / 504, the server's own `unknown` - is UNKNOWN: it may or
 * may not have happened, and it is never retried by the screen. */
export function failureOf(f: FailureFacts): { state: Exclude<WriteState, 'saved' | 'pending'>; reason: WritesKey } {
  const reason = (f.code && REASONS[f.code]) || 'err.generic';
  if (f.outcome === 'not_sent' || (f.status === 403 && f.code === 'forbidden')) return { state: 'not_sent', reason };
  if (f.outcome === 'refused') return { state: 'refused', reason };
  return { state: 'unknown', reason: 'err.generic' };
}

/** The delete's result by the read model: the person's page answered 404 = removed (confirmed); still there = still pending. */
export function deleteSettled(readStatus: number): 'confirmed' | 'pending' {
  return readStatus === 404 ? 'confirmed' : 'pending';
}

/** How long and how often a pending delete is checked against the read model (then the screen offers "בדיקה חוזרת"). */
export const PENDING_CHECK_MS = 3000;
export const PENDING_CHECKS = 10;

// ---------------------------------------------------------------- cards

export const CARD_NUMBER = /^[A-Za-z0-9_-]{1,32}$/;
export const validCardNumber = (value: string): boolean => CARD_NUMBER.test(value.trim());

// ---------------------------------------------------------------- the photo (WisKey's JPEG rule)

export const PHOTO_MAX_SIDE = 512;
export const PHOTO_MAX_BYTES = 32_768;
export const PHOTO_MAX_CHARS = 44_000;
export const PHOTO_PREFIX = 'data:image/jpeg;base64,';
/** The JPEG qualities tried, best first, until the picture fits the budget. */
export const PHOTO_QUALITIES: readonly number[] = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38];

/** The size a picture is drawn at: within `max` x `max`, the aspect kept, never enlarged, at least 1 px. */
export function fitSize(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The bytes a base64 data URL carries. */
export function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Within WisKey's budget: a JPEG data URL, at most 44 000 characters and 32 768 bytes (the server checks the frame size too). */
export function photoFits(dataUrl: string): boolean {
  return dataUrl.startsWith(PHOTO_PREFIX) && dataUrl.length <= PHOTO_MAX_CHARS && dataUrlBytes(dataUrl) <= PHOTO_MAX_BYTES;
}

// ---------------------------------------------------------------- the timing form (the editor)

/** WisKey's day names, Monday first (access/schedules.py DAYS); the form shows them Sunday first (the local week). */
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const WEEK_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MAX_PERIODS = 8;
export const MAX_DATES = 64;

export type TimingMode = 'none' | 'weekly' | 'dates';
/** `draft` = a proposal (never a grant); `ha` = enforced by the system; `native` = enforced by the device (shown, not edited here). */
export type TimingEnforce = 'draft' | 'ha' | 'native';

export interface TimingForm {
  mode: TimingMode;
  enforce: TimingEnforce;
  timezone: string;
  days: string[];
  dates: string[];
  periods: { start: string; end: string }[];
}

export type TimingSchedule = { mode: 'weekly' | 'dates'; timezone: string; days: string[]; dates: string[]; periods: { start: string; end: string }[] };

const HHMM = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function minute(value: string, end = false): number | null {
  if (end && value === '24:00') return 1440;
  if (!HHMM.test(value)) return null;
  const [h, m] = value.split(':');
  return Number(h) * 60 + Number(m);
}

function realDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y >= 2000 && y <= 2037;
}

/** The form a person's timing opens with: the enforced policy if there is one (its schedule), else the proposal, else "always". */
export function timingFormOf(p: Pick<IntercomEditorPerson, 'timing_draft' | 'timing_policy'> | null, defaultZone: string): TimingForm {
  const policy = p?.timing_policy ?? null;
  const schedule: IntercomTimingSchedule | null = policy?.schedule ?? p?.timing_draft ?? null;
  const enforce: TimingEnforce = policy?.mode === 'native' ? 'native' : policy?.mode === 'ha' ? 'ha' : 'draft';
  if (!schedule || (schedule.mode !== 'weekly' && schedule.mode !== 'dates')) {
    return { mode: 'none', enforce: enforce === 'native' ? 'native' : 'draft', timezone: defaultZone, days: [], dates: [], periods: [{ start: '08:00', end: '17:00' }] };
  }
  return {
    mode: schedule.mode,
    enforce,
    timezone: schedule.timezone || defaultZone,
    days: [...schedule.days],
    dates: [...schedule.dates],
    periods: schedule.periods.length ? schedule.periods.map((x) => ({ ...x })) : [{ start: '08:00', end: '17:00' }],
  };
}

/** The first problem of a form (a key of i18n/access-writes.ts), or null. `validZone` is the browser's own check of the zone name. */
export function timingProblem(f: TimingForm, validZone: (zone: string) => boolean = () => true): WritesKey | null {
  if (f.mode === 'none' || f.enforce === 'native') return null;
  if (!f.timezone || !validZone(f.timezone)) return 'timing.err.zone';
  if (f.mode === 'weekly') {
    const days = new Set(f.days);
    if (days.size === 0 || [...days].some((d) => !(DAYS as readonly string[]).includes(d))) return 'timing.err.days';
  } else {
    const dates = new Set(f.dates);
    if (dates.size === 0 || dates.size > MAX_DATES || [...dates].some((d) => !realDate(d))) return 'timing.err.dates';
  }
  if (!f.periods.length || f.periods.length > MAX_PERIODS) return 'timing.err.periods';
  const spans = f.periods.map((x) => [minute(x.start), minute(x.end, true)] as const);
  if (spans.some(([a, b]) => a === null || b === null || a >= b)) return 'timing.err.order';
  const sorted = [...spans].sort((a, b) => (a[0] as number) - (b[0] as number));
  for (let i = 1; i < sorted.length; i++) if ((sorted[i - 1][1] as number) > (sorted[i][0] as number)) return 'timing.err.overlap';
  return null;
}

/** WisKey's normal form of a valid form's schedule: the days in WisKey's order (Monday first), the dates sorted and unique, the
 * windows sorted by start. */
export function timingSchedule(f: TimingForm): TimingSchedule | null {
  if (f.mode === 'none') return null;
  return {
    mode: f.mode,
    timezone: f.timezone,
    days: f.mode === 'weekly' ? DAYS.filter((d) => f.days.includes(d)) : [],
    dates: f.mode === 'dates' ? [...new Set(f.dates)].sort() : [],
    periods: [...f.periods].map((x) => ({ start: x.start, end: x.end })).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)),
  };
}

/** The timing part of an update: nothing when the form says what the person already has (or the enforcement is the device's - the
 * screen does not edit it); otherwise exactly one of the two - the proposal, or the system-enforced policy - and the other cleared. */
export function timingPatch(f: TimingForm, original: Pick<IntercomEditorPerson, 'timing_draft' | 'timing_policy'> | null, defaultZone: string): {
  access_timing_draft?: TimingSchedule | null;
  access_timing_policy?: { mode: 'ha'; schedule: TimingSchedule; bindings: Record<string, never> } | null;
} {
  if (f.enforce === 'native') return {};
  const before = timingFormOf(original, defaultZone);
  const same = before.enforce !== 'native' && JSON.stringify([before.mode, before.mode === 'none' ? null : before.enforce, timingSchedule(before)]) ===
    JSON.stringify([f.mode, f.mode === 'none' ? null : f.enforce, timingSchedule(f)]);
  if (same) return {};
  const schedule = timingSchedule(f);
  if (!schedule) return { access_timing_draft: null, access_timing_policy: null };
  if (f.enforce === 'ha') return { access_timing_draft: null, access_timing_policy: { mode: 'ha', schedule, bindings: {} } };
  return { access_timing_draft: schedule, access_timing_policy: null };
}

// ---------------------------------------------------------------- the access category (the editor)

export type Category = 'staff' | 'visitor' | 'contractor';

/** A visitor or a contractor needs a responsible person and an end date (WisKey's own rule; the server refuses it otherwise). */
export function categoryProblem(category: Category, responsible: string, hasEnd: boolean): WritesKey | null {
  if (category === 'staff') return null;
  return responsible.trim() && hasEnd ? null : 'err.guest';
}
