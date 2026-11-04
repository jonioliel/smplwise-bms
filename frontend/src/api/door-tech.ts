/**
 * Door technical writes (WISKEY-DOOR-TECH-2390; owner Q5 = a: system administrators only, each with a confirmation and an audit row;
 * backend routers/access_control_door_tech.py): a door's hold-open schedule (add / edit / delete), a public door code (set / clear;
 * the value is typed, sent once and never shown again - the screen only ever shows "set" / "not set"), and the door's hold-open program
 * (apply / resume / pause / remove). The browser never names a device command: each write is one typed POST with the command envelope
 * of the physical actions (`client_request_id`, `expires_at`) and `confirmed: true`, which only the confirmation step sends. Nothing
 * here retries, queues or runs by itself.
 *
 * The pure helpers (the schedule editor's model, the outcome reading, the wording) are what the unit spec checks.
 */
import { ApiError, get, post } from './client';
import { commandId } from './request-id';
import { serverNow } from './intercom';
import type { Period, StationPolicy, WeekdayName } from './access-stations';
import { fill } from '../i18n/wiskey-stations';
import type { DoorTechText } from '../i18n/wiskey-door-tech';

export type DoorTechKind = 'hold_save' | 'hold_delete' | 'code_write' | 'program_save' | 'program_action';
export const DOOR_TECH_KINDS: readonly DoorTechKind[] = ['hold_save', 'hold_delete', 'code_write', 'program_save', 'program_action'];

/** `acknowledged` / `partial`: the server's success; `refused` (WisKey answered a refusal - its reason in `code`), `not_sent`, `unknown`
 * (sent, no clear answer); `sending` is the screen's own while a request is out, `sent` an attempt row with no outcome yet. */
export type DoorTechStatus = 'sending' | 'sent' | 'acknowledged' | 'partial' | 'refused' | 'not_sent' | 'unknown';

export interface DoorTechHistory {
  kind: DoorTechKind;
  at: string;
  status: DoorTechStatus;
  code: string | null;
  door: number | null;
  slot: number | null;
  code_action: 'set' | 'clear' | null;
  program_action: 'pause' | 'remove' | null;
  enabled: boolean | null;
}

export interface DoorTechView {
  station_id: string;
  allowed: boolean;
  reason: string;
  online: boolean | null;
  feed: string;
  locks: { door: number; name: string | null }[];
  commands: Record<DoorTechKind, { available: boolean | null; reason: string | null }>;
  confirm_phrase: string;
  limits: { code_window_s: number; code_max: number };
  history: DoorTechHistory[];
}

export interface HoldDraft {
  door: number | null;
  revision: number | null;
  policy: StationPolicy | null;
}
export interface HoldReply {
  state: string;
  last_error: string | null;
  hold: { draft: HoldDraft | null; active: boolean; blocker: string | null; timezone: string | null } | null;
}

export interface DoorTechReply {
  station_id: string;
  kind: DoorTechKind;
  status: 'acknowledged' | 'partial';
  partial: string | null;
  command_id: string;
  at: string | null;
  data: Record<string, unknown>;
}

export interface DoorTechOutcome {
  kind: DoorTechKind;
  status: DoorTechStatus;
  /** WisKey's code (`details.wiskey_code`) or the server's code; null for a success. */
  code: string | null;
  retry_after_s: number | null;
  data: Record<string, unknown> | null;
}

/** The editor's schedule (the server's `policy` body): every weekday present, periods `HH:MM`-`HH:MM` (end up to 24:00). */
export interface PolicyBody {
  timezone: string;
  name: string;
  weekly: Record<WeekdayName, Period[]>;
  holidays: { name: string; start: string; end: string; periods: Period[] }[];
}

export const WEEK: readonly WeekdayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const one = (id: string) => `access-control/stations/${encodeURIComponent(id)}`;
const TTL_MS = 15_000;
const envelope = () => ({ confirmed: true, client_request_id: commandId(), expires_at: new Date(serverNow() + TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z') });

export const getDoorTech = (stationId: string) => get<DoorTechView>(`${one(stationId)}/door-tech`);
export const getHold = (stationId: string, door: number) => get<HoldReply>(`${one(stationId)}/doors/${door}/hold`);

export const saveHold = (stationId: string, door: number, revision: number, policy: PolicyBody) =>
  post<DoorTechReply>(`${one(stationId)}/doors/${door}/hold`, { ...envelope(), revision, policy });
export const deleteHold = (stationId: string, door: number, revision: number) => post<DoorTechReply>(`${one(stationId)}/doors/${door}/hold/delete`, { ...envelope(), revision });
export const saveProgram = (stationId: string, door: number, revision: number, policy: PolicyBody, enabled: boolean) =>
  post<DoorTechReply>(`${one(stationId)}/doors/${door}/program`, { ...envelope(), revision, policy, enabled });
export const programAction = (stationId: string, door: number, revision: number, action: 'pause' | 'remove') =>
  post<DoorTechReply>(`${one(stationId)}/doors/${door}/program/${action}`, { ...envelope(), revision });

export interface CodeRequest {
  slot: number;
  action: 'set' | 'clear';
  door: number;
  expected: boolean;
  newCode?: string;
  currentCode?: string;
  compatibility?: boolean;
  confirmText: string;
}
/** The code write's body without the envelope: `new_code` only for a set, `current_code` only when the slot is set now. */
export function codeBody(r: CodeRequest): Record<string, unknown> {
  return {
    action: r.action,
    door: r.door,
    expected: r.expected,
    ...(r.action === 'set' ? { new_code: r.newCode ?? '' } : {}),
    ...(r.expected ? { current_code: r.currentCode ?? '' } : {}),
    compatibility: !!r.compatibility,
    confirm_text: r.confirmText,
  };
}

/** The code write. The values travel in this one request body only; the caller clears its fields right after. */
export const writeCode = (stationId: string, r: CodeRequest) => post<DoorTechReply>(`${one(stationId)}/codes/${r.slot}`, { ...envelope(), ...codeBody(r) });

/** What a failed POST says: the server's `details.outcome`; a 403 / 404 / 409 / 415 / 422 / 429 refusal before sending is `not_sent`
 * (but a 409 `door_tech_refused` is WisKey's refusal); a network failure is `unknown` (the request may have reached the server). */
export function outcomeOf(err: unknown, kind: DoorTechKind): DoorTechOutcome {
  if (err instanceof ApiError) {
    const d = (err.body?.details ?? {}) as Record<string, unknown>;
    const raw = String(d.outcome ?? '');
    const status: DoorTechStatus =
      raw === 'refused' ? 'refused' : raw === 'not_sent' ? 'not_sent' : raw === 'unknown' ? 'unknown' : [403, 404, 409, 415, 422, 429].includes(err.status) ? 'not_sent' : 'unknown';
    const retry = Number(d.retry_after_s);
    const code = String(d.wiskey_code ?? '') || String(d.reason ?? '') || err.code || '';
    return { kind, status, code: code || null, retry_after_s: Number.isFinite(retry) && retry >= 0 ? retry : null, data: null };
  }
  return { kind, status: 'unknown', code: 'network', retry_after_s: null, data: null };
}

/** One write, once. */
export async function runWrite(kind: DoorTechKind, send: () => Promise<DoorTechReply>): Promise<DoorTechOutcome> {
  try {
    const r = await send();
    return { kind, status: r.status, code: r.partial, retry_after_s: null, data: r.data ?? null };
  } catch (err) {
    return outcomeOf(err, kind);
  }
}

// ---------------------------------------------------------------- the schedule editor's model

/** A policy the server served (`{timezone, name, weekly, holidays}`, every field possibly null) as the editor's body: unknown days
 * are empty, periods and holidays with a missing part are dropped (the editor never invents a value). */
export function toBody(p: StationPolicy | null | undefined, zone: string): PolicyBody {
  const weekly = Object.fromEntries(WEEK.map((d) => [d, (p?.weekly?.[d] ?? []).filter((x) => !!x?.start && !!x?.end).map((x) => ({ start: x.start, end: x.end }))])) as Record<WeekdayName, Period[]>;
  return {
    timezone: p?.timezone || zone,
    name: p?.name ?? '',
    weekly,
    holidays: (p?.holidays ?? [])
      .filter((h) => !!h.start && !!h.end)
      .map((h) => ({ name: h.name ?? '', start: h.start!, end: h.end!, periods: (h.periods ?? []).map((x) => ({ start: x.start, end: x.end })) })),
  };
}

export const emptyBody = (zone: string, name = ''): PolicyBody => toBody({ timezone: zone, name, weekly: {}, holidays: [] }, zone);

const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minute = (v: string, end = false): number | null => (HHMM.test(v) ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3)) : end && v === '24:00' ? 1440 : null);

export type PolicyProblem = { field: string; key: 'name' | 'time' | 'order' | 'overlap' | 'tooMany' | 'date' | 'dateOrder' | 'dateOverlap' | 'zone' };

function periodProblems(list: Period[], field: string): PolicyProblem[] {
  if (list.length > 8) return [{ field, key: 'tooMany' }];
  const out: PolicyProblem[] = [];
  list.forEach((p, i) => {
    const a = minute(p.start);
    const b = minute(p.end, true);
    if (a === null || b === null) out.push({ field: `${field}.${i}`, key: 'time' });
    else if (a >= b) out.push({ field: `${field}.${i}`, key: 'order' });
  });
  if (out.length) return out;
  const sorted = [...list].sort((x, y) => x.start.localeCompare(y.start));
  for (let i = 1; i < sorted.length; i++) if ((minute(sorted[i - 1].end, true) ?? 0) > (minute(sorted[i].start) ?? 0)) return [{ field, key: 'overlap' }];
  return [];
}

/** The editor's own check (the server checks the same rules again): what is wrong, per field; empty = sendable. */
export function policyProblems(b: PolicyBody): PolicyProblem[] {
  const out: PolicyProblem[] = [];
  const name = b.name.trim();
  if (!name || name.length > 32) out.push({ field: 'name', key: 'name' });
  if (!b.timezone || b.timezone.length > 64) out.push({ field: 'timezone', key: 'zone' });
  for (const d of WEEK) out.push(...periodProblems(b.weekly[d] ?? [], `weekly.${d}`));
  if (b.holidays.length > 64) out.push({ field: 'holidays', key: 'tooMany' });
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  b.holidays.forEach((h, i) => {
    if (!h.name.trim() || h.name.trim().length > 32) out.push({ field: `holidays.${i}.name`, key: 'name' });
    if (!DAY.test(h.start) || !DAY.test(h.end)) out.push({ field: `holidays.${i}`, key: 'date' });
    else if (h.start > h.end) out.push({ field: `holidays.${i}`, key: 'dateOrder' });
    out.push(...periodProblems(h.periods, `holidays.${i}.periods`));
  });
  const ranges = b.holidays.filter((h) => DAY.test(h.start) && DAY.test(h.end)).sort((x, y) => x.start.localeCompare(y.start));
  for (let i = 1; i < ranges.length; i++) if (ranges[i - 1].end >= ranges[i].start) out.push({ field: 'holidays', key: 'dateOverlap' });
  return out;
}

/** The body as the server takes it: names trimmed, periods sorted. */
export function normalized(b: PolicyBody): PolicyBody {
  const sort = (l: Period[]) => [...l].map((p) => ({ start: p.start, end: p.end })).sort((x, y) => x.start.localeCompare(y.start));
  return {
    timezone: b.timezone,
    name: b.name.trim(),
    weekly: Object.fromEntries(WEEK.map((d) => [d, sort(b.weekly[d] ?? [])])) as Record<WeekdayName, Period[]>,
    holidays: b.holidays.map((h) => ({ name: h.name.trim(), start: h.start, end: h.end, periods: sort(h.periods) })).sort((x, y) => x.start.localeCompare(y.start)),
  };
}

/** One line per weekday with hours ("א׳ 07:00–19:00, 20:00–22:00", the hours isolated left-to-right); days without hours are left out. */
export function weekLines(b: PolicyBody | null, t: DoorTechText): string[] {
  if (!b) return [];
  // the hours are a left-to-right isolate inside the Hebrew line (never shown reversed, as the drawer's program rows)
  return WEEK.filter((d) => (b.weekly[d] ?? []).length).map((d) => `${t.days[d]} ⁦${(b.weekly[d] ?? []).map((p) => `${p.start}–${p.end}`).join(', ')}⁩`);
}

// ---------------------------------------------------------------- codes

export const DIGITS = /^\d{4,16}$/;

/** Whether the code form may be sent, and the first reason it may not (never a value in it). */
export function codeFormProblem(f: { action: 'set' | 'clear'; expected: boolean; newCode: string; repeatCode: string; currentCode: string; typed: string; phrase: string }):
  | null
  | 'newCode'
  | 'repeat'
  | 'currentCode'
  | 'typed' {
  if (f.action === 'set') {
    if (!DIGITS.test(f.newCode)) return 'newCode';
    if (f.newCode !== f.repeatCode) return 'repeat';
  }
  if (f.expected && !DIGITS.test(f.currentCode)) return 'currentCode';
  if (f.typed.trim() !== f.phrase) return 'typed';
  return null;
}

export const phraseFor = (template: string, slot: number) => fill(template, { slot });

// ---------------------------------------------------------------- wording

export function reasonText(code: string | null, t: DoorTechText): string {
  if (!code) return '';
  return (t.reasons as Record<string, string>)[code] ?? (code.startsWith('schedule_') ? t.reasons.schedule_invalid : code);
}

/** The result line of one write. `refused` is WisKey's refusal and says so with its reason (the task's "WisKey refused: <reason>"). */
export function statusText(o: Pick<DoorTechOutcome, 'status' | 'code'>, t: DoorTechText): string {
  const why = reasonText(o.code, t);
  switch (o.status) {
    case 'sending':
      return t.status.sending;
    case 'sent':
      return t.status.sent;
    case 'acknowledged':
      return t.status.acknowledged;
    case 'partial':
      return t.status.partial;
    case 'refused':
      return fill(t.status.refused, { reason: why || t.reasons.unknown_reason });
    case 'not_sent':
      return why ? fill(t.status.notSentWhy, { reason: why }) : t.status.notSent;
    default:
      return why && o.code !== 'network' ? fill(t.status.unknownWhy, { reason: why }) : t.status.unknown;
  }
}

export function statusTone(s: DoorTechStatus): 'ok' | 'err' | 'warn' | 'busy' {
  if (s === 'acknowledged') return 'ok';
  if (s === 'refused' || s === 'not_sent') return 'err';
  if (s === 'sending' || s === 'sent') return 'busy';
  return 'warn';
}
