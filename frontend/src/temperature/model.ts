/**
 * CR-INFRA-TEMPERATURE 2.9.1: the presentation logic of תשתיות › טמפרטורות - pure functions (no DOM), driven by the unit spec
 * (tests/unit-temperature.spec.ts). The server decides every status; these only shape it for the screen: the chips of a card, the KPI row,
 * the gauge geometry, the sparkline / chart paths, the 24-hour ring, the timeline runs and the wizard's draft and checks.
 */
import type { DefrostWindow, ManagedUnit, TempEvent, TempUnit, UnitBody, UnitKind, UnitStatus } from '../api/temperature';
import { tt, type TtKey } from '../i18n/temperature';

export const TEMPERATURE_HREF = '#/infra/temperature';
export const MIN = 60_000;

export type Look = 'ok' | 'warn' | 'alarm' | 'off' | 'idle' | 'unk';
export const LOOK_OF: Record<UnitStatus, Look> = { ok: 'ok', warning: 'warn', alarm: 'alarm', offline: 'off', off: 'idle', unknown: 'unk' };
export const STATUS_KEY: Record<UnitStatus, TtKey> = { ok: 'stOk', warning: 'stWarning', alarm: 'stAlarm', offline: 'stOffline', off: 'stOff', unknown: 'stUnknown' };
export const STATUS_ICON: Record<UnitStatus, string> = { ok: 'check', warning: 'warning', alarm: 'bell', offline: 'offline', off: 'power', unknown: 'help' };

/** Climate units: the words of the HVAC mode and action (unknown values are shown as they come, never guessed). */
const MODE_KEY: Record<string, TtKey> = { off: 'hmOff', heat: 'hmHeat', cool: 'hmCool', heat_cool: 'hmHeatCool', auto: 'hmAuto', dry: 'hmDry', fan_only: 'hmFan' };
const ACTION_KEY: Record<string, TtKey> = { cooling: 'haCooling', heating: 'haHeating', idle: 'haIdle', off: 'haOff', drying: 'haDrying', fan: 'haFan', preheating: 'haHeating', defrosting: 'haDefrosting' };
export function hvacText(mode: string | null, action: string | null): string {
  const a = action ? (ACTION_KEY[action] ? tt(ACTION_KEY[action]) : action) : '';
  const m = mode ? (MODE_KEY[mode] ? tt(MODE_KEY[mode]) : mode) : '';
  if (mode === 'off') return m;
  return a && m ? `${m} · ${a}` : a || m;
}
export const KIND_KEY: Record<UnitKind, TtKey> = { fridge: 'kindFridge', freezer: 'kindFreezer', coldroom: 'kindColdroom', pharma: 'kindPharma', server: 'kindServer', room: 'kindRoom' };

/** The temperature with one decimal and a real minus sign (−18.4). */
export function fmt1(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const r = Math.round(v * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toFixed(1).replace('-', '−');
}
/** A number inside running Hebrew / Arabic text: isolated left-to-right (U+2066 .. U+2069) so "−22°–−16°" never reorders. */
export function bidi(s: string): string {
  return `⁦${s}⁩`;
}
export function degT(v: number | null | undefined): string {
  return bidi(deg(v));
}
export function deg(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${fmt1(v).replace(/\.0$/, '')}°`;
}

export function durationText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return tt('durMin', { n: m });
  if (m < 1440) return m % 60 ? tt('durHourMin', { h: Math.floor(m / 60), m: m % 60 }) : tt('durHour', { h: Math.floor(m / 60) });
  return tt('durDays', { n: Math.floor(m / 1440) });
}

export function agoText(iso: string | null, now: number): string {
  if (!iso) return '';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 10) return tt('now');
  if (s < 60) return tt('agoSec', { n: s });
  if (s < 3600) return tt('agoMin', { n: Math.round(s / 60) });
  if (s < 86400) return tt('agoHour', { n: Math.round(s / 3600) });
  return tt('agoDay', { n: Math.round(s / 86400) });
}

export function minutesSince(iso: string | null, now: number): number {
  return iso ? Math.max(0, (now - Date.parse(iso)) / MIN) : 0;
}

export function hhmm(ms: number, lang = 'he-IL'): string {
  return new Date(ms).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function minOfDay(m: number): string {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

export function windowText(w: Pick<DefrostWindow, 'start_min' | 'minutes'>): string {
  return `${minOfDay(w.start_min)}–${minOfDay(w.start_min + w.minutes)}`;
}

// ---------------------------------------------------------------- chips of a card / the detail head

export type ChipTone = 'err' | 'warn' | 'door' | 'doorOpen' | 'off' | 'acc' | 'ok' | 'mut';
export interface Chip {
  tone: ChipTone;
  icon: string;
  text: string;
  id: string;
}

export function chipsOf(u: TempUnit, now: number, lang = 'he-IL'): Chip[] {
  const out: Chip[] = [];
  const stale = u.stale;
  if (u.hvac) {
    const h = hvacText(u.hvac.hvac_mode, u.hvac.hvac_action);
    if (h) out.push({ tone: u.hvac.hvac_mode === 'off' ? 'mut' : u.hvac.hvac_action === 'heating' ? 'warn' : 'acc', icon: u.hvac.hvac_mode === 'off' ? 'power' : u.hvac.hvac_action === 'heating' ? 'flame' : 'snow', text: h, id: 'hvac' });
    if (u.hvac.setpoint !== null && u.hvac.hvac_mode !== 'off') {
      const sp = u.hvac.hvac_mode === 'heat_cool' && u.hvac.setpoint_low !== null && u.hvac.setpoint_high !== null ? bidi(`${deg(u.hvac.setpoint_low)}–${deg(u.hvac.setpoint_high)}`) : degT(u.hvac.setpoint);
      out.push({ tone: 'mut', icon: 'target', text: tt('setpointChip', { v: sp }), id: 'setpoint' });
    }
  }
  if (u.door) {
    if (stale || u.door.open === null) out.push({ tone: 'off', icon: 'door', text: tt('doorUnknown'), id: 'door' });
    else if (u.door.open) out.push({ tone: 'doorOpen', icon: 'doorOpen', text: tt('doorOpenFor', { d: durationText(minutesSince(u.door.since, now)) }), id: 'door' });
    else out.push({ tone: 'door', icon: 'door', text: tt('doorClosedFor', { d: durationText(minutesSince(u.door.since, now)) }), id: 'door' });
  }
  for (const e of u.events) {
    if (e.kind === 'door' && e.severity === 'alarm') {
      out.push({ tone: 'err', icon: 'doorOpen', text: tt('doorAlarm', { d: durationText(minutesSince(e.started_at, now)), x: e.threshold ?? '' }), id: `ev-${e.id}` });
    } else if (e.kind === 'high' || e.kind === 'low') {
      const base = tt(e.kind === 'high' ? 'aboveFor' : 'belowFor', { v: degT(e.value), t: degT(e.threshold), d: durationText(minutesSince(e.started_at, now)) });
      const left = e.severity === 'warning' && e.alarm_at ? Math.ceil((Date.parse(e.alarm_at) - now) / MIN) : null;
      out.push({ tone: e.severity === 'alarm' ? 'err' : 'warn', icon: e.kind === 'high' ? 'arrowUp' : 'snow', text: left !== null && left > 0 ? `${base} · ${tt('alarmIn', { m: left })}` : base, id: `ev-${e.id}` });
    } else if (e.kind === 'offline') {
      out.push({ tone: 'off', icon: 'offline', text: tt('noReport', { d: durationText(minutesSince(e.started_at, now)) }), id: `ev-${e.id}` });
    }
    if (e.ack_at && e.ack_by_name && (e.severity === 'alarm' || e.severity === 'warning')) out.push({ tone: 'ok', icon: 'check', text: tt('ackedBy', { name: e.ack_by_name }), id: `ack-${e.id}` });
  }
  if (!stale && u.defrost.in_window) out.push({ tone: 'acc', icon: 'snow', text: tt('inDefrost'), id: 'defrost' });
  else if (!stale && u.defrost.next_at && u.status !== 'offline') out.push({ tone: 'acc', icon: 'snow', text: tt('nextDefrost', { t: hhmm(Date.parse(u.defrost.next_at), lang) }), id: 'defrost' });
  else if (!stale && u.defrost.mode === 'learn' && u.defrost.state === 'learning') out.push({ tone: 'mut', icon: 'snow', text: tt('learning'), id: 'defrost' });
  if (u.muted_until) out.push({ tone: 'mut', icon: 'bellOff', text: tt('mutedUntil', { t: hhmm(Date.parse(u.muted_until), lang) }), id: 'mute' });
  return out;
}

// ---------------------------------------------------------------- KPI row

export interface Kpis {
  total: number;
  ok: number;
  warning: number;
  alarm: number;
  door: number;
  offline: number;
}
export type KpiKey = keyof Kpis;

export function kpisOf(list: TempUnit[], stale: boolean): Kpis {
  const k: Kpis = { total: list.length, ok: 0, warning: 0, alarm: 0, door: 0, offline: 0 };
  for (const u of list) {
    const s = stale ? 'unknown' : u.status === 'off' ? 'ok' : u.status; // a climate unit switched off counts with the healthy ones
    if (s === 'ok' || s === 'warning' || s === 'alarm' || s === 'offline') k[s] += 1;
    if (!stale && u.door?.open === true) k.door += 1;
  }
  return k;
}

export function matchesKpi(u: TempUnit, k: KpiKey | null, stale: boolean): boolean {
  if (!k || k === 'total') return true;
  if (k === 'door') return !stale && u.door?.open === true;
  const s = stale ? 'unknown' : u.status === 'off' ? 'ok' : u.status;
  return s === k;
}

/** Page edit mode (owner 2026-10-19, like the elevators): the add affordances exist only for a manager, only in edit mode. */
export function addAffordances(manage: boolean, editing: boolean): { newButton: boolean; addCard: boolean; doneButton: boolean } {
  const on = manage && editing;
  return { newButton: on, addCard: on, doneButton: on };
}

// ---------------------------------------------------------------- the gauge (240 degree arc)

export interface GaugeGeo {
  gmin: number;
  gmax: number;
  frac: (v: number) => number;
}

export function gaugeRange(low: number, high: number, values: number[] = []): GaugeGeo {
  const span = Math.max(4, high - low);
  let gmin = low - span * 1.2;
  let gmax = high + span * 1.6;
  for (const v of values) {
    if (Number.isFinite(v)) {
      gmin = Math.min(gmin, v - 1);
      gmax = Math.max(gmax, v + 1);
    }
  }
  return { gmin, gmax, frac: (v: number) => Math.max(0, Math.min(1, (v - gmin) / (gmax - gmin))) };
}

/** A point on the gauge arc (210 degrees at 0, -30 at 1; y down) in a 120 x 120 box. */
export function arcPoint(fr: number, r = 48, cx = 60, cy = 60): [number, number] {
  const a = ((210 - 240 * fr) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

export function arcPath(f1: number, f2: number, r = 48): string {
  const [x1, y1] = arcPoint(f1, r);
  const [x2, y2] = arcPoint(f2, r);
  const large = (f2 - f1) * 240 > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// ---------------------------------------------------------------- line paths (sparkline and the big chart)

export interface Frame {
  t0: number;
  t1: number;
  lo: number;
  hi: number;
  w: number;
  h: number;
  ml: number;
  mr: number;
  mt: number;
  mb: number;
}

export function frameOf(points: [number, number][], low: number, high: number, t0: number, t1: number, w: number, h: number, m: Partial<Frame> = {}): Frame {
  const vs = points.map((p) => p[1]).filter((v) => Number.isFinite(v));
  const pad = Math.max(1, (high - low) * 0.25);
  const lo = Math.floor(Math.min(low - pad, ...vs));
  const hi = Math.ceil(Math.max(high + pad, ...vs));
  return { t0, t1, lo, hi, w, h, ml: m.ml ?? 0, mr: m.mr ?? 0, mt: m.mt ?? 3, mb: m.mb ?? 3 };
}

export const xOf = (f: Frame, t: number) => f.ml + ((t - f.t0) / Math.max(1, f.t1 - f.t0)) * (f.w - f.ml - f.mr);
export const yOf = (f: Frame, v: number) => f.mt + ((f.hi - v) / Math.max(1e-9, f.hi - f.lo)) * (f.h - f.mt - f.mb);

/** The setpoint of a climate unit as a STEP line (it changes in steps, never a slope); points [ts, setpoint | null]. */
export function stepPath(points: [number, number | null][], f: Frame, gapS: number): string {
  let d = '';
  let prev: [number, number] | null = null;
  for (const [t, v] of points) {
    if (v === null || !Number.isFinite(v)) {
      prev = null;
      continue;
    }
    if (prev !== null && t - prev[0] <= gapS) d += `H${xOf(f, t).toFixed(1)}V${yOf(f, v).toFixed(1)}`;
    else d += `M${xOf(f, t).toFixed(1)} ${yOf(f, v).toFixed(1)}`;
    prev = [t, v];
  }
  return d;
}

/** The line through the points; a gap longer than `gapS` seconds lifts the pen (a gap is never drawn as data). */
export function linePath(points: [number, number][], f: Frame, gapS: number): string {
  let d = '';
  let prev: number | null = null;
  for (const [t, v] of points) {
    if (!Number.isFinite(v)) {
      prev = null;
      continue;
    }
    const pen = prev !== null && t - prev <= gapS;
    d += `${pen ? 'L' : 'M'}${xOf(f, t).toFixed(1)} ${yOf(f, v).toFixed(1)}`;
    prev = t;
  }
  return d;
}

export function niceTicks(lo: number, hi: number, n = 5): number[] {
  const step = Math.max(1, Math.round((hi - lo) / n));
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

// ---------------------------------------------------------------- the 24-hour ring and the timeline runs

export type HourState = 'ok' | 'warn' | 'alarm' | 'none' | 'defrost';

/** Per local hour of the last 24 (oldest first): the worst state measured. An hour mostly inside a defrost window is `defrost` unless it went
 * above the hard maximum. `alarm` = more than one degree outside the band. */
export function hoursOf(points: [number, number][], low: number, high: number, now: number, defrost: [number, number][] = [], hardMax = Infinity): { hour: number; start: number; state: HourState }[] {
  const out: { hour: number; start: number; state: HourState }[] = [];
  const end = Math.floor(now / 3600_000) * 3600_000 + 3600_000;
  for (let i = 23; i >= 0; i--) {
    const a = end - (i + 1) * 3600_000;
    const b = a + 3600_000;
    const vs = points.filter((p) => p[0] * 1000 >= a && p[0] * 1000 < b).map((p) => p[1]);
    const inDef = defrost.some(([x, y]) => x * 1000 < b && y * 1000 > a);
    let st: HourState = 'none';
    if (vs.length) {
      const mx = Math.max(...vs);
      const mn = Math.min(...vs);
      st = mx > high + 1 || mn < low - 1 ? 'alarm' : mx > high || mn < low ? 'warn' : 'ok';
      if (inDef && st !== 'ok' && mx <= hardMax && mn >= low) st = 'defrost';
    }
    out.push({ hour: new Date(a).getHours(), start: a, state: st });
  }
  return out;
}

export interface Run {
  k: HourState | 'open';
  pct: number;
}

/** The temperature state as runs over lo..hi (ms) for the timeline bar. */
export function stateRuns(points: [number, number][], low: number, high: number, lo: number, hi: number, defrost: [number, number][], stepS = 300): Run[] {
  const runs: { k: HourState; n: number }[] = [];
  const push = (k: HourState, n: number) => {
    const last = runs[runs.length - 1];
    if (last && last.k === k) last.n += n;
    else runs.push({ k, n });
  };
  let cursor = lo;
  for (const [t, v] of points) {
    const ms = t * 1000;
    if (ms < lo || ms > hi) continue;
    if (ms - cursor > stepS * 1500) push('none', ms - cursor);
    const inDef = defrost.some(([a, b]) => t >= a && t <= b);
    const k: HourState = inDef && v > high ? 'defrost' : v > high + 1 || v < low - 1 ? 'alarm' : v > high || v < low ? 'warn' : 'ok';
    push(k, stepS * 1000);
    cursor = ms + stepS * 1000;
  }
  if (hi > cursor) push('none', hi - cursor);
  const total = runs.reduce((s, r) => s + r.n, 0) || 1;
  return runs.map((r) => ({ k: r.k, pct: (r.n / total) * 100 }));
}

/** Door openings as runs (none / open) over lo..hi (ms); intervals in unix seconds. */
export function doorRuns(intervals: [number, number][], lo: number, hi: number): Run[] {
  const out: Run[] = [];
  const span = Math.max(1, hi - lo);
  let cursor = lo;
  for (const [a0, b0] of [...intervals].sort((x, y) => x[0] - y[0])) {
    const a = Math.max(a0 * 1000, lo);
    const b = Math.min(b0 * 1000, hi);
    if (b <= a) continue;
    if (a > cursor) out.push({ k: 'none', pct: ((a - cursor) / span) * 100 });
    out.push({ k: 'open', pct: Math.max(0.4, ((b - Math.max(a, cursor)) / span) * 100) });
    cursor = Math.max(cursor, b);
  }
  if (hi > cursor) out.push({ k: 'none', pct: ((hi - cursor) / span) * 100 });
  return out;
}

// ---------------------------------------------------------------- the alert log rows

export function eventText(e: TempEvent): string {
  switch (e.kind) {
    case 'high':
      return e.detail.hard_max ? tt('evHardMax') : tt('evHigh', { t: degT(e.threshold) });
    case 'low':
      return tt('evLow', { t: degT(e.threshold) });
    case 'door':
      return tt('evDoor', { m: e.threshold ?? '' });
    case 'offline':
      return tt('evOffline');
    case 'defrost':
      return tt('evDefrost');
    case 'ack':
      return tt('evAck', { name: e.ack_by_name ?? '' });
    case 'mute':
      return tt('evMute', { d: durationText(e.detail.minutes ?? 0), name: e.ack_by_name ?? '' });
    default:
      return e.kind;
  }
}

export function eventValue(e: TempEvent): string {
  if (e.kind === 'door') return tt('valueOpen');
  if (e.kind === 'offline') return e.value === null ? '—' : tt('lastValue', { v: degT(e.value) });
  if (e.kind === 'defrost') return tt('peak', { v: degT(e.peak) });
  if (e.kind === 'ack' || e.kind === 'mute') return '—';
  return deg(e.ended_at ? e.peak : e.value);
}

export function eventDuration(e: TempEvent, now: number): string {
  if (e.kind === 'ack' || e.kind === 'mute') return '—';
  const end = e.ended_at ? Date.parse(e.ended_at) : now;
  return durationText((end - Date.parse(e.started_at)) / MIN);
}

export function heldText(e: TempEvent): string {
  return e.suppressed === 'quiet' ? tt('heldQuiet') : e.suppressed === 'mute' ? tt('heldMute') : e.suppressed === 'off' ? tt('heldOff') : '';
}

// ---------------------------------------------------------------- the wizard's draft

export interface Draft {
  id: string | null;
  revision?: number;
  name: string;
  area_id: string | null;
  kind: UnitKind;
  temp_entity_id: string;
  door_entity_id: string | null;
  door_invert: boolean;
  low: number;
  high: number;
  band_mode: 'fixed' | 'setpoint';
  rules: Record<string, boolean | number | string>;
  ownRecipients: boolean;
  recipients: { roles: string[]; users: string[]; groups: string[] };
  defrost_mode: 'fixed' | 'learn' | 'none';
  defrost_windows: { start: string; minutes: number }[];
  enabled: boolean;
}

export function newDraft(): Draft {
  return {
    id: null, name: '', area_id: null, kind: 'fridge', temp_entity_id: '', door_entity_id: null, door_invert: false, low: 2, high: 6, band_mode: 'fixed', rules: {},
    ownRecipients: false, recipients: { roles: [], users: [], groups: [] }, defrost_mode: 'learn', defrost_windows: [], enabled: true,
  };
}

export function draftOf(m: ManagedUnit): Draft {
  return {
    id: m.id, revision: m.revision, name: m.name, area_id: m.area_id, kind: m.kind, temp_entity_id: m.temp_entity_id, door_entity_id: m.door_entity_id,
    door_invert: m.door_invert, low: m.low, high: m.high, band_mode: m.band_mode, rules: { ...(m.rules as Record<string, boolean | number | string>) }, ownRecipients: !!m.recipients,
    recipients: m.recipients ? { ...m.recipients } : { roles: [], users: [], groups: [] }, defrost_mode: m.defrost_mode,
    defrost_windows: m.defrost_windows.map((w) => ({ ...w })), enabled: m.enabled,
  };
}

/** The first problem of a step (null = fine); step 0 = everything (the save). */
export function problemOf(d: Draft, step: number): TtKey | null {
  if ((step === 1 || step === 0) && !d.name.trim()) return 'needName';
  if ((step === 1 || step === 0) && !d.temp_entity_id) return 'needSensor';
  if ((step === 2 || step === 0) && !(Number.isFinite(d.low) && Number.isFinite(d.high) && d.low < d.high)) return 'bandInvalid';
  if ((step === 3 || step === 0) && d.defrost_mode === 'fixed' && !d.defrost_windows.length) return 'needWindow';
  return null;
}

export function bodyOf(d: Draft): UnitBody {
  return {
    name: d.name.trim(), area_id: d.area_id, kind: d.kind, temp_entity_id: d.temp_entity_id, door_entity_id: d.door_entity_id, door_invert: !!d.door_entity_id && d.door_invert,
    low: d.low, high: d.high, band_mode: d.temp_entity_id.startsWith('climate.') ? d.band_mode : 'fixed', rules: d.rules, recipients: d.ownRecipients ? d.recipients : null, defrost_mode: d.defrost_mode,
    defrost_windows: d.defrost_mode === 'fixed' ? d.defrost_windows : [], enabled: d.enabled, ...(d.revision !== undefined ? { revision: d.revision } : {}),
  };
}

/** A rule's value for this unit: its own override, else the installation default. */
export function ruleOf<T extends boolean | number | string>(d: Draft, defaults: Record<string, boolean | number | string>, key: string): T {
  return (key in d.rules ? d.rules[key] : defaults[key]) as T;
}

/** Sets an override; a value equal to the installation default removes it (the unit follows later changes of the default). */
export function setRule(d: Draft, defaults: Record<string, boolean | number | string>, key: string, v: boolean | number | string): Draft {
  const rules = { ...d.rules };
  if (defaults[key] === v) delete rules[key];
  else rules[key] = v;
  return { ...d, rules };
}

export const TEMPLATE_KEYS: [UnitKind, TtKey][] = [['fridge', 'kindFridge'], ['freezer', 'kindFreezer'], ['pharma', 'kindPharma'], ['server', 'kindServer']];
