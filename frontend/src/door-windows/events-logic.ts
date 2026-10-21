/**
 * DOORWIN3-295: the pure logic of the event-rule editor, the holiday list and the "open for N hours" dialog - no DOM, no fetch, so the unit
 * specs test it directly. The server decides everything; this module only shapes: the draft and its client-side checks (a mirror of
 * `validate_trigger`, the server's answer wins), the body of a save, the simulate / armed words, the holiday grouping, the hour choices.
 */
import type { DoorRow, HolidayRow, Rule, RuleBody, RuleTrigger, TriggerLogRow, TriggerSource, WindowsState } from '../api/door-windows';
import { HM_RE, minutes, type Tone } from './logic';
import type { DweKey } from '../i18n/door-windows-events';

/** The rate rule the server applies to every source over the last hour (`STORM_PER_HOUR`); the screen shows it, the server enforces it. */
export const STORM_PER_HOUR = 20;
export const MIN_DURATION_MIN = 1;
export const RULE_SOURCES: readonly TriggerSource[] = ['ha_event', 'arx_automation'];
export const AUTOMATION_RE = /^automation\.[a-z0-9_]{1,80}$/;

export interface Limits {
  maxHours: number;
  maxPerDay: number;
  quiet: [string, string];
}

/** The limits from the state's settings (keys without the `doors.windows.` prefix), with the server's defaults when a key is missing. */
export function limitsOf(settings: Record<string, string>): Limits {
  const n = (k: string, d: number) => (/^\d+$/.test(settings[k] ?? '') ? Number(settings[k]) : d);
  return { maxHours: n('max_hours', 4), maxPerDay: n('max_per_day_per_door', 3), quiet: [settings.quiet_from ?? '22:00', settings.quiet_to ?? '06:00'] };
}

export interface EventDraft {
  id: string | null;
  revision: number | null;
  name: string;
  source: TriggerSource;
  doors: Set<string>;
  durationMin: string;
  limitHours: boolean;
  from: string;
  to: string;
  maxPerDay: string;
  cooldownMin: string;
  automationId: string;
  regenerate: boolean;
  calendar: Rule['calendar_policy'];
}

export function emptyEventDraft(): EventDraft {
  return { id: null, revision: null, name: '', source: 'ha_event', doors: new Set(), durationMin: '60', limitHours: false, from: '08:00', to: '18:00',
           maxPerDay: '1', cooldownMin: '15', automationId: '', regenerate: false, calendar: 'skip_holidays' };
}

export function eventDraftOf(rule: Rule): EventDraft {
  const d = emptyEventDraft();
  const t = rule.trigger;
  d.id = rule.id;
  d.revision = rule.revision;
  d.name = rule.name;
  d.doors = new Set(rule.doors.map((x) => x.key));
  d.calendar = rule.calendar_policy;
  if (t) {
    d.source = t.source;
    d.durationMin = String(Math.round(t.duration_s / 60));
    d.limitHours = !!(t.allowed_from && t.allowed_to);
    d.from = t.allowed_from ?? d.from;
    d.to = t.allowed_to ?? d.to;
    d.maxPerDay = String(t.max_per_day);
    d.cooldownMin = String(Math.round(t.cooldown_s / 60));
    d.automationId = t.automation_id ?? '';
  }
  return d;
}

const touchesQuiet = (s: string, e: string, quiet: [string, string]): boolean => {
  const qf = minutes(quiet[0]);
  const qt = minutes(quiet[1]);
  if (qf === qt) return false;
  const ranges: [number, number][] = qf < qt ? [[qf, qt]] : [[qf, 1440], [0, qt]];
  return ranges.some(([a, b]) => minutes(s) < b && a < minutes(e));
};

export type Problem = { scope: 'dwt' | 'dwe'; key: string; vars?: Record<string, number | string> };

const wholeNumber = (v: string): number | null => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

/** The first problem of a draft, or null. */
export function eventProblem(d: EventDraft, lim: Limits): Problem | null {
  if (!d.name.trim()) return { scope: 'dwt', key: 'errName' };
  if (!d.doors.size) return { scope: 'dwt', key: 'errDoors' };
  if (!RULE_SOURCES.includes(d.source)) return { scope: 'dwe', key: 'errSource' };
  if (d.source === 'arx_automation' && !AUTOMATION_RE.test(d.automationId.trim())) return { scope: 'dwe', key: 'errAutomation' };
  const dur = wholeNumber(d.durationMin);
  if (dur === null || dur < MIN_DURATION_MIN || dur > lim.maxHours * 60) return { scope: 'dwe', key: 'errDuration', vars: { h: lim.maxHours } };
  if (d.limitHours) {
    if (!HM_RE.test(d.from) || !(HM_RE.test(d.to) || d.to === '24:00') || minutes(d.to) <= minutes(d.from)) return { scope: 'dwe', key: 'errAllowed' };
    if (touchesQuiet(d.from, d.to, lim.quiet)) return { scope: 'dwe', key: 'errQuiet' };
  }
  const cap = wholeNumber(d.maxPerDay);
  if (cap === null || cap < 1 || cap > lim.maxPerDay) return { scope: 'dwe', key: 'errCap', vars: { n: lim.maxPerDay } };
  const cool = wholeNumber(d.cooldownMin);
  if (cool === null || cool > 1440) return { scope: 'dwe', key: 'errCooldown' };
  return null;
}

/** The request body of a draft (doors as keys "station:relay"; the relay is after the last ":"). An `event` rule has no periods. */
export function eventBodyOf(d: EventDraft, enable: boolean): RuleBody {
  const doors = [...d.doors].map((k) => {
    const i = k.lastIndexOf(':');
    return { station_id: k.slice(0, i), relay: Number(k.slice(i + 1)) };
  });
  return {
    name: d.name.trim(), kind: 'event', calendar_policy: d.calendar, notes: '', doors, periods: [],
    trigger: {
      source: d.source, duration_s: Number(d.durationMin.trim()) * 60,
      allowed_from: d.limitHours ? d.from : null, allowed_to: d.limitHours ? d.to : null,
      max_per_day: Number(d.maxPerDay.trim()), cooldown_s: Number(d.cooldownMin.trim()) * 60,
      automation_id: d.source === 'arx_automation' ? d.automationId.trim() : null,
      ...(d.id && d.source === 'ha_event' && d.regenerate ? { regenerate_token: true } : {}),
    },
    ...(d.revision !== null ? { revision: d.revision } : {}), enable,
  };
}

// ---------------------------------------------------------------- simulate / armed

export interface ArmView {
  /** the word of the current state: `arm_simulate` | `arm_armed` */
  state: 'arm_simulate' | 'arm_armed';
  tone: Tone;
  /** a second chip, shown only when arming cannot happen today */
  unavailable: boolean;
  /** the action the person can take: arm (only when the server says it can), disarm, or none */
  action: 'arm' | 'disarm' | null;
}

/** What an event rule shows about simulation. A rule is SIMULATED unless a person armed it; arming is refused while the server reports no
 * automation actor, so the screen says that plainly (a chip) and offers no arming button then. */
export function armView(t: Pick<RuleTrigger, 'arm_state' | 'can_arm'>, manageable: boolean, actor: boolean | undefined): ArmView {
  const armed = t.arm_state === 'armed';
  const can = t.can_arm && actor !== false;
  return {
    state: armed ? 'arm_armed' : 'arm_simulate', tone: armed ? 'ok' : 'warn', unavailable: !armed && !can,
    action: !manageable ? null : armed ? 'disarm' : can ? 'arm' : null,
  };
}

export function eventRules(rules: Rule[]): Rule[] {
  return rules.filter((r) => r.kind === 'event' && !!r.trigger);
}

/** "Short numbers" of a trigger for the card: length, hours, per-day cap, cooldown. */
export function triggerFacts(t: RuleTrigger): { key: DweKey; vars: Record<string, string | number> }[] {
  return [
    { key: 'capLength', vars: { n: Math.round(t.duration_s / 60) } },
    ...(t.allowed_from && t.allowed_to ? [{ key: 'capHours' as DweKey, vars: { from: t.allowed_from, to: t.allowed_to } }] : []),
    { key: 'capDay', vars: { n: t.max_per_day } },
    { key: 'capCooldown', vars: { n: Math.round(t.cooldown_s / 60) } },
  ];
}

export const DECISION_TONE: Record<TriggerLogRow['decision'], Tone> = { started: 'ok', extended: 'ok', simulated: 'warn', refused: 'err' };

/** The words key of a refusal reason (`reason_<code>`); an unknown code falls back in the screen with `dweDynamic`. */
export const reasonKey = (code: string | null | undefined): string => `reason_${code ?? 'other'}`;

// ---------------------------------------------------------------- holidays

export type DayKind = HolidayRow['kind'];
export const DAY_KINDS: readonly DayKind[] = ['holiday', 'holiday_eve', 'regular', 'closed'];

export const KIND_TONE: Record<DayKind, Tone> = { holiday: 'acc', holiday_eve: 'acc', regular: 'off', closed: 'warn' };

/** The list grouped by local month ("YYYY-MM"), dates ascending; days before `fromDay` (the local today) drop out. */
export function holidayMonths(rows: HolidayRow[], fromDay: string): { month: string; rows: HolidayRow[] }[] {
  const out = new Map<string, HolidayRow[]>();
  for (const r of [...rows].filter((x) => x.date >= fromDay).sort((a, b) => (a.date < b.date ? -1 : 1))) out.set(r.date.slice(0, 7), [...(out.get(r.date.slice(0, 7)) ?? []), r]);
  return [...out.entries()].map(([month, list]) => ({ month, rows: list }));
}

/** The request for "put this day back to the generated default": a manual row is removed (`none`). A row that is only generated has nothing to reset. */
export const canReset = (r: HolidayRow): boolean => r.source === 'manual';

/** The kinds a manager may set on a day. A generated day can be cancelled (`regular`) or changed; any date can become `closed` or a holiday. */
export function kindChoices(r: HolidayRow | null): DayKind[] {
  return r?.generated_kind || r?.source === 'generated' ? [...DAY_KINDS] : DAY_KINDS.filter((k) => k !== 'regular');
}

export const validDay = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

// ---------------------------------------------------------------- open for N hours

/** 1 .. max whole hours (the server also clamps at `max_hours` for event windows; the state's setting is the same number). */
export function hourChoices(maxHours: number): number[] {
  return Array.from({ length: Math.max(1, Math.min(12, maxHours)) }, (_, i) => i + 1);
}

/** The doors a person may start an "open for" on: managed, and not exterior unless the installation allows it. */
export function openableDoors(state: Pick<WindowsState, 'doors' | 'settings' | 'enabled'>): DoorRow[] {
  const exteriorOk = state.settings.exterior_allowed === 'true';
  return state.enabled ? state.doors.filter((d) => d.manage && (exteriorOk || !d.exterior)) : [];
}

/** The planned end for display only (the server returns the real one): the next whole minute plus the hours. */
export function plannedEnd(nowIso: string, hours: number): string {
  return new Date(Math.ceil(Date.parse(nowIso) / 60000) * 60000 + hours * 3600000).toISOString();
}

/** The reason code a refused open-for carries (`details.reason`), or null. */
export function refusalReason(err: unknown): string | null {
  const body = (err as { body?: { details?: Record<string, unknown> } } | null)?.body;
  const r = body?.details?.reason;
  return typeof r === 'string' ? r : null;
}
