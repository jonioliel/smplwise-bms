/**
 * CR-031 GEN1 generator screen: the pure logic (no DOM, no network). Everything the screens draw is derived here from the capability set - the roles
 * the detected controller actually exposes - so that a gauge, a tile, a table column or a diagram card exists only when its role does (owner decision
 * 2026-10-05: capability-driven, no holes). Unit-tested in tests/unit-generator.spec.ts.
 */
import type { Availability, GenAlert, GenDevice, GenRange, GenValues, HistoryPoint, HistoryResponse, PolicyItem, Severity, ViewMode } from '../api/generator';

export const GEN_V = ['gen_v_l1', 'gen_v_l2', 'gen_v_l3'] as const;
export const GEN_A = ['gen_a_l1', 'gen_a_l2', 'gen_a_l3'] as const;
export const MAINS_V = ['mains_v_l1', 'mains_v_l2', 'mains_v_l3'] as const;
export const RANGES: GenRange[] = ['1h', '24h', '7d', '30d', 'custom'];

export type EngineState = 'running' | 'stopped' | 'starting' | 'cooling' | 'fault' | 'unknown';
export type Tone = 'ok' | 'warn' | 'err' | '';

/** The role set of a device (the `capabilities.roles` of the API, or the keys of a live payload). */
export class Caps {
  readonly roles: ReadonlySet<string>;
  constructor(roles: Iterable<string>) {
    this.roles = new Set(roles);
  }
  has(...r: string[]): boolean {
    return r.every((x) => this.roles.has(x));
  }
  any(...r: string[]): boolean {
    return r.some((x) => this.roles.has(x));
  }
  /** Phase indexes (0..2) whose generator voltage is exposed. */
  get phases(): number[] {
    return GEN_V.flatMap((r, i) => (this.roles.has(r) ? [i] : []));
  }
  get core(): boolean {
    return this.has('engine_state') && this.phases.length > 0;
  }
  get size(): number {
    return this.roles.size;
  }
}
export const capsOf = (d: Pick<GenDevice, 'capabilities'> | string[]): Caps => new Caps(Array.isArray(d) ? d : d.capabilities.roles);

export function num(values: GenValues | undefined, role: string): number | null {
  const v = values?.[role];
  return v && v.available && typeof v.value === 'number' ? v.value : null;
}
export function str(values: GenValues | undefined, role: string): string | null {
  const v = values?.[role];
  return v && v.available && v.value !== null && v.value !== undefined ? String(v.value) : null;
}
export function flag(values: GenValues | undefined, role: string): boolean | null {
  const v = values?.[role];
  return v && v.available && typeof v.value === 'boolean' ? v.value : null;
}

export function engineOf(values: GenValues | undefined, availability: Availability): EngineState {
  if (availability === 'offline') return 'unknown';
  const s = str(values, 'engine_state');
  if (s === 'running' || s === 'stopped' || s === 'starting' || s === 'cooling' || s === 'fault') return s;
  const run = flag(values, 'generator_running');
  if (run !== null) return run ? 'running' : 'stopped';
  return 'unknown';
}

export const toneOfEngine = (e: EngineState): 'ok' | 'off' | 'warn' | 'err' => (e === 'running' ? 'ok' : e === 'stopped' ? 'off' : e === 'starting' || e === 'cooling' ? 'warn' : 'err');

// ---------------------------------------------------------------- the power-flow plan

export interface FlowPlan {
  /** 'full' = grid + transfer switch + generator + load; 'compact' = generator + load only (neither mains nor transfer switch exposed). */
  layout: 'full' | 'compact';
  showMains: boolean;
  showAts: boolean;
  engine: EngineState;
  stale: boolean;
  genRun: boolean;
  /** The generator feeds the site (transfer switch on the generator; without a switch role a running generator is assumed to feed its load). */
  onGen: boolean;
  /** null = unknown. */
  mainsOn: boolean | null;
  /** Where the blade of the switch points. */
  atsTarget: 'gen' | 'grid' | null;
  /** The site load in kW when known (only the generator's own kW is exposed). */
  kw: number | null;
  kwKnown: boolean;
  loadOn: boolean;
  loadPct: number | null;
  rpm: number | null;
  hz: number | null;
  volts: number | null;
  mode: string | null;
  mainsVolts: number | null;
  mainsHz: number | null;
}

export function flowPlan(values: GenValues | undefined, caps: Caps, availability: Availability): FlowPlan {
  const engine = engineOf(values, availability);
  const stale = engine === 'unknown';
  const genRun = engine === 'running';
  const mainsV = MAINS_V.map((r) => num(values, r)).filter((x): x is number => x !== null);
  const showMains = caps.any('mains_available', 'mains_breaker_closed', 'load_on_mains', ...MAINS_V);
  const showAts = caps.any('ats_position', 'supply_source');
  let mainsOn: boolean | null = flag(values, 'mains_available');
  if (mainsOn === null && mainsV.length) mainsOn = mainsV.some((v) => v > 100);
  if (mainsOn === null) mainsOn = flag(values, 'mains_breaker_closed');
  const ats = str(values, 'ats_position') ?? str(values, 'supply_source');
  const onLoadFlag = flag(values, 'on_load');
  const loadOnMains = flag(values, 'load_on_mains');
  const genBreaker = flag(values, 'generator_breaker_closed');
  let onGen: boolean;
  if (!showAts) onGen = genRun;
  else if (ats === 'generator') onGen = true;
  else if (ats === 'mains') onGen = false;
  else if (onLoadFlag !== null) onGen = onLoadFlag && genRun;
  else if (genBreaker !== null) onGen = genBreaker && genRun;
  else if (loadOnMains !== null) onGen = !loadOnMains && genRun;
  else onGen = false;
  const kw = num(values, 'gen_kw');
  const atsTarget: 'gen' | 'grid' | null = !showAts ? null : onGen ? 'gen' : mainsOn ? 'grid' : null;
  const loadOn = onGen ? kw === null || kw > 0 || genRun : mainsOn === true;
  const pick = (a: readonly string[]) => a.map((r) => num(values, r)).find((x) => x !== null) ?? null;
  return {
    layout: !showMains && !showAts ? 'compact' : 'full', showMains, showAts, engine, stale, genRun, onGen, mainsOn, atsTarget, kw: onGen ? kw : null, kwKnown: caps.has('gen_kw'),
    loadOn, loadPct: num(values, 'load_pct'), rpm: num(values, 'rpm'), hz: num(values, 'gen_hz'), volts: pick(GEN_V), mode: str(values, 'controller_mode'),
    mainsVolts: mainsV.length ? mainsV.reduce((a, b) => a + b, 0) / mainsV.length : null, mainsHz: num(values, 'mains_hz'),
  };
}

// ---------------------------------------------------------------- gauges

export interface Gauge {
  role: string;
  value: number;
  unit: string;
  /** 0..100 of the dial. */
  pct: number;
  tone: Tone;
  /** The threshold line under the dial, as numbers for the screen to phrase. */
  limit: { kind: 'min' | 'max' | 'range' | 'idle'; a?: number; b?: number } | null;
  digits: number;
}

const clampPct = (x: number) => Math.max(0, Math.min(100, x));

/** The dials the controller can feed, in order: fuel, battery, coolant, oil, and the load only when there is no fuel dial (the mockup's rule). */
export function gaugeList(values: GenValues | undefined, caps: Caps, th: Record<string, number>, engine: EngineState, ratedKw: number | null): Gauge[] {
  const out: Gauge[] = [];
  const fuel = num(values, 'fuel_pct');
  if (caps.has('fuel_pct') && fuel !== null) {
    const low = th.fuel_low_pct ?? 25;
    out.push({ role: 'fuel_pct', value: fuel, unit: '%', pct: clampPct(fuel), tone: fuel < low ? 'err' : fuel < low + 15 ? 'warn' : 'ok', limit: { kind: 'min', a: low }, digits: 0 });
  }
  const batt = num(values, 'battery_v');
  if (caps.has('battery_v') && batt !== null) {
    const v24 = batt > 18;
    const lo = v24 ? 20 : 10;
    const hi = v24 ? 30 : 15;
    const min = v24 ? th.battery_min_24v ?? 23.2 : th.battery_min_12v ?? 11.6;
    out.push({ role: 'battery_v', value: batt, unit: 'V', pct: clampPct(((batt - lo) / (hi - lo)) * 100), tone: batt < min ? 'err' : batt < min + 1.2 ? 'warn' : 'ok', limit: { kind: 'min', a: min }, digits: 1 });
  }
  const cool = num(values, 'coolant_temp');
  if (caps.has('coolant_temp') && cool !== null) {
    const max = th.coolant_max_c ?? 95;
    out.push({ role: 'coolant_temp', value: cool, unit: '°C', pct: clampPct((cool / 110) * 100), tone: cool > max ? 'err' : cool > max - 6 ? 'warn' : 'ok', limit: { kind: 'max', a: max }, digits: 0 });
  }
  const oil = num(values, 'oil_pressure');
  if (caps.has('oil_pressure') && oil !== null) {
    const min = th.oil_min_bar ?? 1;
    const run = engine === 'running';
    out.push({ role: 'oil_pressure', value: oil, unit: 'bar', pct: clampPct((oil / 6) * 100), tone: !run ? 'ok' : oil < min ? 'err' : oil < min + 1 ? 'warn' : 'ok', limit: run ? { kind: 'min', a: min } : { kind: 'idle' }, digits: 1 });
  }
  const pct = num(values, 'load_pct');
  if (!caps.has('fuel_pct') && caps.has('load_pct') && pct !== null) {
    const over = th.overload_pct ?? 100;
    out.push({ role: 'load_pct', value: pct, unit: '%', pct: clampPct(pct), tone: pct > over ? 'err' : pct > over * 0.8 ? 'warn' : 'ok', limit: ratedKw ? { kind: 'max', a: ratedKw } : null, digits: 0 });
  }
  return out;
}

// ---------------------------------------------------------------- phase table

export type PhaseCol = 'v' | 'a' | 'kw' | 'bar';
export interface PhaseRow {
  label: number | null;
  v: number | null;
  a: number | null;
  kw: number | null;
  /** Share of the rated phase current, 0..100+. */
  pct: number | null;
}
export interface PhaseTable {
  cols: PhaseCol[];
  rows: PhaseRow[];
  multi: boolean;
  avgV: number | null;
  sumA: number | null;
  totalKw: number | null;
  hz: number | null;
  pf: number | null;
}

/** The phase table: its columns and rows follow the roles (one voltage or L1/L2/L3; current, kW and the load bar only when they can be known). Null = nothing to draw. */
export function phaseTable(values: GenValues | undefined, caps: Caps, ratedKva: number | null): PhaseTable | null {
  const ph = caps.phases;
  if (!ph.length) return null;
  const multi = ph.length > 1;
  const hasA = ph.some((i) => caps.has(GEN_A[i]));
  const pf = num(values, 'pf');
  const canKw = hasA && caps.has('pf');
  const ratedA = ratedKva ? (ratedKva * 1000) / (3 * 230) : null;
  const cols: PhaseCol[] = ['v'];
  if (hasA) cols.push('a');
  if (canKw) cols.push('kw');
  if (hasA && ratedA) cols.push('bar');
  const rows: PhaseRow[] = ph.map((i) => {
    const v = num(values, GEN_V[i]);
    const a = num(values, GEN_A[i]);
    return { label: multi ? i + 1 : null, v, a, kw: v !== null && a !== null && pf !== null ? (v * a * pf) / 1000 : null, pct: a !== null && ratedA ? (a / ratedA) * 100 : null };
  });
  const vs = rows.map((r) => r.v).filter((x): x is number => x !== null);
  const as = rows.map((r) => r.a).filter((x): x is number => x !== null);
  return { cols, rows, multi, avgV: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null, sumA: as.length ? as.reduce((a, b) => a + b, 0) : null, totalKw: num(values, 'gen_kw'), hz: num(values, 'gen_hz'), pf };
}

// ---------------------------------------------------------------- engine card rows and phone KPIs

export type EngineRowKey = 'state' | 'mode' | 'hours' | 'rpm' | 'last_start' | 'last_test' | 'next_test' | 'service';
export function engineRows(caps: Caps): EngineRowKey[] {
  const r: EngineRowKey[] = ['state'];
  if (caps.has('controller_mode')) r.push('mode');
  if (caps.has('run_hours')) r.push('hours');
  if (caps.has('rpm')) r.push('rpm');
  if (caps.has('last_start_at')) r.push('last_start');
  if (caps.has('last_test_at')) r.push('last_test');
  if (caps.has('next_test_at')) r.push('next_test');
  if (caps.has('service_hours_left')) r.push('service');
  return r;
}

export interface Kpi {
  role: string;
  value: number;
  unit: string;
  digits: number;
}
export function phoneKpis(values: GenValues | undefined, caps: Caps): Kpi[] {
  const k: Kpi[] = [];
  const add = (role: string, unit: string, digits = 0) => {
    const v = num(values, role);
    if (caps.has(role) && v !== null) k.push({ role, value: v, unit, digits });
  };
  add('load_pct', '%');
  add('gen_kw', 'kW');
  if (caps.has('fuel_pct') && num(values, 'fuel_pct') !== null) add('fuel_pct', '%');
  else add('battery_v', 'V', 1);
  return k;
}

// ---------------------------------------------------------------- charts

export interface MetricDef {
  /** The history role this metric reads. */
  role: string;
  unit: string;
  digits: number;
  /** Fixed y domain, else derived from the data. */
  fixed?: [number, number];
}
const METRICS: MetricDef[] = [
  { role: 'load_pct', unit: '%', digits: 0, fixed: [0, 100] },
  { role: 'gen_kw', unit: 'kW', digits: 0 },
  { role: 'gen_v_l1', unit: 'V', digits: 0 },
  { role: 'fuel_pct', unit: '%', digits: 0, fixed: [0, 100] },
  { role: 'battery_v', unit: 'V', digits: 1 },
  { role: 'coolant_temp', unit: '°C', digits: 0 },
  { role: 'oil_pressure', unit: 'bar', digits: 1 },
];
/** The chartable metrics of a device: only those whose role is mapped. The generator voltage is the first phase the controller exposes. */
export function metricsOf(caps: Caps): MetricDef[] {
  const out: MetricDef[] = [];
  for (const m of METRICS) {
    if (m.role === 'gen_v_l1') {
      const first = GEN_V.find((r) => caps.has(r));
      if (first) out.push({ ...m, role: first });
    } else if (caps.has(m.role)) out.push(m);
  }
  return out;
}
export const historyRoles = (ms: MetricDef[]): string[] => ms.map((m) => m.role);

export function viewModeOf(v: unknown): ViewMode {
  return v === 'charts' ? 'charts' : 'gauges';
}

export interface Plot {
  /** One path per run of points; a gap larger than 2.5 buckets starts a new run (the chart draws a break). */
  lines: string[];
  areas: string[];
  lo: number;
  hi: number;
  min: number | null;
  avg: number | null;
  max: number | null;
  last: number | null;
  n: number;
}

export function niceDomain(min: number, max: number, fixed?: [number, number]): [number, number] {
  if (fixed) return fixed;
  if (!(max > min)) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.12;
  const raw = (max - min + 2 * pad) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  return [Math.floor((min - pad) / step) * step, Math.ceil((max + pad) / step) * step];
}

/** Chart geometry for a series: x from time, y from the (fixed or padded) domain. `w`/`h` are the viewBox size. */
export function plotSeries(points: HistoryPoint[], from: number, to: number, stepS: number, w: number, h: number, fixed?: [number, number], pad = 8): Plot {
  if (!points.length) return { lines: [], areas: [], lo: fixed?.[0] ?? 0, hi: fixed?.[1] ?? 1, min: null, avg: null, max: null, last: null, n: 0 };
  const vmin = Math.min(...points.map((p) => p.min));
  const vmax = Math.max(...points.map((p) => p.max));
  const [lo, hi] = niceDomain(vmin, vmax, fixed);
  const span = Math.max(1, to - from);
  const x = (t: number) => pad + ((t - from) / span) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (h - 2 * pad);
  const runs: HistoryPoint[][] = [];
  let cur: HistoryPoint[] = [];
  for (const p of points) {
    if (cur.length && p.t - cur[cur.length - 1].t > stepS * 2.5) {
      runs.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length) runs.push(cur);
  const f = (n: number) => n.toFixed(1);
  const lines = runs.map((r) => (r.length === 1 ? `M${f(x(r[0].t) - 1)} ${f(y(r[0].v))} L${f(x(r[0].t) + 1)} ${f(y(r[0].v))}` : r.map((p, i) => `${i ? 'L' : 'M'}${f(x(p.t))} ${f(y(p.v))}`).join(' ')));
  const areas = runs.filter((r) => r.length > 1).map((r) => `${r.map((p, i) => `${i ? 'L' : 'M'}${f(x(p.t))} ${f(y(p.v))}`).join(' ')} L${f(x(r[r.length - 1].t))} ${f(h - pad)} L${f(x(r[0].t))} ${f(h - pad)} Z`);
  const vals = points.map((p) => p.v);
  return { lines, areas, lo, hi, min: vmin, avg: vals.reduce((a, b) => a + b, 0) / vals.length, max: vmax, last: points[points.length - 1].v, n: points.length };
}

/** The range request: the four presets, or a custom span validated against the history retention (the server answers 422 beyond it). */
export function customRangeError(from: string, to: string, retentionDays: number, now = Date.now()): 'missing' | 'order' | 'future' | 'span' | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 'missing';
  if (b <= a) return 'order';
  if (a > now) return 'future';
  if (b - a > retentionDays * 86400_000) return 'span';
  return null;
}

export function toCsv(h: HistoryResponse, roles: string[]): string {
  const times = new Set<number>();
  for (const r of roles) for (const p of h.series[r] ?? []) times.add(p.t);
  const head = ['time', ...roles.map((r) => `${h.labels[r] ?? r} (${h.units[r] ?? ''})`)];
  const lines = [...times].sort((a, b) => a - b).map((t) => [new Date(t * 1000).toISOString(), ...roles.map((r) => h.series[r]?.find((p) => p.t === t)?.v ?? '')].join(','));
  return [head.map((c) => `"${c.replace(/"/g, '""')}"`).join(','), ...lines].join('\n');
}

// ---------------------------------------------------------------- alerts

export const SEV_ORDER: Record<Severity, number> = { critical: 0, alert: 1, info: 2 };

export interface AlertCounts {
  open: number;
  unacked: number;
  acked: number;
}
export function alertCounts(list: GenAlert[]): AlertCounts {
  const open = list.filter((a) => a.state === 'open');
  const unacked = open.filter((a) => !a.acknowledged).length;
  return { open: open.length, unacked, acked: open.length - unacked };
}
/** Open alerts: unacknowledged first, then by severity, then the newest. */
export function sortOpen(list: GenAlert[]): GenAlert[] {
  return [...list].sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged) || SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.raised_at.localeCompare(a.raised_at));
}

export interface HistoryFilter {
  window: 'today' | '7d' | '30d' | 'custom';
  severity: Severity | '';
  type: string;
  ack: '' | 'yes' | 'no';
  state: '' | 'open' | 'closed';
  from: string;
  to: string;
  text: string;
}
export const EMPTY_FILTER: HistoryFilter = { window: '30d', severity: '', type: '', ack: '', state: '', from: '', to: '', text: '' };

export function windowStart(w: HistoryFilter['window'], now = new Date()): Date {
  const d = new Date(now);
  if (w === 'today') d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - (w === '7d' ? 7 : 30));
  return d;
}
export function filterQuery(f: HistoryFilter, deviceId: string | undefined, now = new Date()) {
  return {
    device_id: deviceId,
    severity: f.severity || undefined,
    type: f.type || undefined,
    ack: f.ack === 'yes' ? true : f.ack === 'no' ? false : undefined,
    state: f.state || undefined,
    from: f.window === 'custom' ? (f.from ? new Date(f.from).toISOString() : undefined) : windowStart(f.window, now).toISOString(),
    to: f.window === 'custom' && f.to ? new Date(f.to).toISOString() : undefined,
    limit: 100,
  };
}
export const activeFilters = (f: HistoryFilter): number => [f.severity, f.type, f.ack, f.state].filter(Boolean).length;
/** Free-text filter on the loaded page (title and the acknowledger's note). */
export const matchesText = (a: GenAlert, text: string): boolean => !text.trim() || `${a.title} ${a.ack_note ?? ''}`.toLowerCase().includes(text.trim().toLowerCase());

/** How long an alert lasted (open ones: until `now`), in whole minutes. */
export function durationMin(a: Pick<GenAlert, 'raised_at' | 'cleared_at'>, now = Date.now()): number {
  const end = a.cleared_at ? Date.parse(a.cleared_at) : now;
  return Math.max(0, Math.round((end - Date.parse(a.raised_at)) / 60000));
}

// ---------------------------------------------------------------- routing and message templates

export interface RouteGroup {
  key: string;
  title: string;
  items: PolicyItem[];
}
/** Routing rows by group: a group with no available type is hidden; an unavailable type stays inside a visible group, greyed with its need. */
export function routeGroups(groups: { key: string; title: string }[], items: PolicyItem[]): RouteGroup[] {
  return groups.map((g) => ({ ...g, items: items.filter((i) => i.group === g.key) })).filter((g) => g.items.some((i) => i.available));
}
/** No recipient chosen anywhere: the routing starts empty (owner decision) and the screen says so. */
export const routingEmpty = (items: PolicyItem[]): boolean => items.filter((i) => i.available).every((i) => !i.policy || (i.policy.recipients.roles.length === 0 && i.policy.recipients.users.length === 0));
export const hasRecipients = (p: PolicyItem['policy']): boolean => !!p && (p.recipients.roles.length > 0 || p.recipients.users.length > 0);

export const TEMPLATE_VARS = ['device', 'name', 'detail', 'time', 'battery', 'fuel', 'load', 'site'] as const;
export type TemplateVar = (typeof TEMPLATE_VARS)[number];
/** The roles a variable needs; a variable whose role is missing is dropped from the sentence. */
const VAR_ROLES: Partial<Record<TemplateVar, string[]>> = { battery: ['battery_v'], fuel: ['fuel_pct', 'fuel_l'], load: ['load_pct', 'gen_kw'] };
export const availableVars = (caps: Caps): TemplateVar[] => TEMPLATE_VARS.filter((v) => !VAR_ROLES[v] || caps.any(...VAR_ROLES[v]!));

/** Fills `{var}` tokens; a clause (text up to the next comma, period or semicolon) holding a missing variable is dropped whole. */
export function renderTemplate(tpl: string, vars: Partial<Record<TemplateVar, string>>): string {
  const parts = tpl.split(/([,.;])/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const seg = parts[i];
    const delim = parts[i + 1] ?? '';
    const names = [...seg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (names.some((n) => !vars[n as TemplateVar])) continue;
    out.push(seg.replace(/\{(\w+)\}/g, (_m, n: string) => vars[n as TemplateVar] ?? '') + delim);
  }
  return out.join('').replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim().replace(/,$/, '.');
}

// ---------------------------------------------------------------- formatting

export function fmtNum(v: number | null | undefined, digits = 0): string {
  return v === null || v === undefined || Number.isNaN(v) ? '-' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtClock(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '-';
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}
export function fmtDateTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const same = d.toDateString() === now.toDateString();
  return same ? fmtClock(iso) : `${d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} ${fmtClock(iso)}`;
}
export function fmtDuration(min: number): string {
  if (min < 1) return '<1';
  if (min < 60) return `${min}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}:${String(m).padStart(2, '0')}` : `${h}`;
}
/** "N seconds ago" style age of a timestamp, as a [value, unit] pair for the screen to phrase. */
export function ageOf(iso: string | null | undefined, now = Date.now()): ['s' | 'm' | 'h' | 'd', number] | null {
  if (!iso) return null;
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (Number.isNaN(s)) return null;
  return s < 90 ? ['s', s] : s < 5400 ? ['m', Math.round(s / 60)] : s < 129600 ? ['h', Math.round(s / 3600)] : ['d', Math.round(s / 86400)];
}

/** Fills `{name}` placeholders of a Hebrew string. */
export const fill = (tpl: string, vars: Record<string, string | number>): string => tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));
export function agoText(a: ReturnType<typeof ageOf>, ago: { s: string; m: string; h: string; d: string }): string {
  return a ? fill(ago[a[0]], { n: a[1] }) : '';
}
