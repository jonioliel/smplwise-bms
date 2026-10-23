/**
 * CR-WATER78 slices 1 and 2: the ONE module that talks to the water meters API (`/api/v1/infra/water/...`): meters, candidates, series,
 * consumption (+ CSV), manual readings, the alert log (ack, snooze), the leak rules / snooze settings. Billing lives in water-billing.ts.
 * Wire contract: smplwise_vms/backend/smplwise/routers/water.py. Volumes travel in litres (`*_l`); the screens show m³ with three decimals.
 *
 * Without a backend (`!isApi()`) the reads answer empty lists - the pages show their empty states, never invented data.
 */
import { apiUrl, del, get, patch, post, put } from './client';
import { isApi } from './session';
import type { SnoozeSettings } from './water-billing';

export type MeterKind = 'main' | 'sub' | 'irrigation' | 'cooling' | 'pool' | 'other';
export type MeterState = 'reporting' | 'not_reporting' | 'paused' | 'retired';

export interface Meter {
  id: string;
  display_name: string;
  medium: string;
  kind: MeterKind;
  unit: string;
  device_name: string | null;
  area_id: string | null;
  area_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  status: 'active' | 'paused' | 'retired';
  status_reason: string | null;
  max_flow_lph: number;
  revision: number;
  created_at: string;
  retired_at: string | null;
  muted_until: string | null;
  state: MeterState;
  last_report_at: string | null;
  value_l: number | null;
  today_l: number | null;
  month_l: number | null;
  /** water.manage only */
  source_ref?: string;
  rules?: Record<string, unknown>;
}

export interface Epoch {
  id: string;
  started_at: string;
  ended_at: string | null;
  start_reading_l: number | null;
  end_reading_l: number | null;
  reason: 'first' | 'replaced' | 'source_changed' | string;
  note: string | null;
}

export interface MeterDetail extends Meter {
  epochs: Epoch[];
}

export interface Candidate {
  ref: string;
  name: string;
  device_name: string | null;
  area_id: string | null;
  area_name: string | null;
  floor_name: string | null;
  unit: string | null;
  verdict: 'accepted' | 'warning' | 'rejected';
  code: string;
  message: string;
  already_meter_id: string | null;
}

export interface SeriesItem {
  start: string;
  end: string;
  date?: string;
  litres: number | null;
}

export interface ConsumptionItem {
  meter_id: string;
  display_name: string;
  kind: MeterKind;
  area_name: string | null;
  floor_name: string | null;
  litres: number | null;
  previous_litres: number | null;
  share: number | null;
  coverage: string;
}

export interface Consumption {
  from: string;
  to: string;
  items: ConsumptionItem[];
  total_litres: number | null;
  previous_total_litres: number | null;
  bucket?: '1h' | '1d';
  series?: SeriesItem[];
}

export type EventKind = 'night_flow' | 'abnormal' | 'burst' | 'offline' | 'health';

export interface WaterEvent {
  id: string;
  meter_id: string;
  meter_name: string;
  meter_kind: MeterKind;
  area_name: string | null;
  floor_name: string | null;
  kind: EventKind;
  severity: 'warning' | 'alarm';
  opened_at: string;
  closed_at: string | null;
  close_reason: string | null;
  value: Record<string, unknown>;
  suppressed: string | null;
  ack_at: string | null;
  ack_by_display: string | null;
  can_ack: boolean;
  snoozed_until: string | null;
  can_snooze: boolean;
}

export interface EventsSummary {
  open: number;
  acked: number;
  last_7d: number;
  open_leaks: number;
  snoozed: number;
}

export interface LeakRules {
  night_from: string;
  night_to: string;
  night_min_lph: number;
  night_min_intervals: number;
  [k: string]: unknown;
}

export interface AlertsConfig {
  rules: LeakRules;
  snooze: SnoozeSettings;
  snooze_limits: { min: number; max: number; count: number };
  row_version: number;
  can_edit: boolean;
}

export interface ManualReading {
  id: string;
  read_at: string;
  litres: number | null;
  typed_value: string;
  typed_unit: 'L' | 'm3';
  effect: string;
  effect_reason: string | null;
  note: string | null;
  created_at: string;
  voided_at: string | null;
}

const W = 'infra/water/';
const qs = (o: Record<string, string | number | boolean | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** The installation default night window (owner Q8), used when the viewer may not read the rules. */
export const DEFAULT_RULES: LeakRules = { night_from: '01:00', night_to: '05:00', night_min_lph: 6, night_min_intervals: 8 };
export const DEFAULT_SNOOZE: SnoozeSettings = { durations: [15, 60, 240, 1440], default: 60, max: 10080 };

export const water = {
  listMeters: async (): Promise<Meter[]> => (isApi() ? (await get<{ items: Meter[] }>(`${W}meters`)).items : []),
  meter: (id: string) => get<MeterDetail>(`${W}meters/${encodeURIComponent(id)}`),
  candidates: async (q = ''): Promise<Candidate[]> => (isApi() ? (await get<{ items: Candidate[] }>(`${W}candidates${qs({ q, include_rejected: true })}`)).items : []),
  createMeter: (body: { source_ref: string; display_name?: string; kind?: MeterKind }) => post<MeterDetail & { warning: string | null }>(`${W}meters`, body),
  patchMeter: (m: Pick<Meter, 'id' | 'revision'>, body: Partial<Pick<Meter, 'display_name' | 'kind' | 'area_id' | 'max_flow_lph'>> & { status?: 'active' | 'paused' }) =>
    patch<MeterDetail>(`${W}meters/${encodeURIComponent(m.id)}`, { revision: m.revision, ...body }),
  retireMeter: (m: Pick<Meter, 'id' | 'revision'>) => del(`${W}meters/${encodeURIComponent(m.id)}${qs({ revision: m.revision })}`),
  replaceMeter: (m: Pick<Meter, 'id' | 'revision'>, body: { old_final_reading_l?: number; new_start_reading_l?: number; note?: string }) =>
    post<MeterDetail>(`${W}meters/${encodeURIComponent(m.id)}/replace`, { revision: m.revision, ...body }),
  series: async (id: string, bucket: '15m' | '1h' | '1d', from: string, to: string): Promise<SeriesItem[]> =>
    isApi() ? (await get<{ items: SeriesItem[] }>(`${W}meters/${encodeURIComponent(id)}/series${qs({ from, to, bucket })}`)).items : [],
  consumption: async (from: string, to: string, bucket?: '1h' | '1d'): Promise<Consumption> =>
    isApi() ? get<Consumption>(`${W}consumption${qs({ from, to, bucket })}`) : { from, to, items: [], total_litres: null, previous_total_litres: null, series: [] },
  consumptionCsvUrl: (from: string, to: string, lang: 'he' | 'en') => apiUrl(`${W}consumption.csv${qs({ from, to, lang })}`),
  manualReadings: async (id: string): Promise<ManualReading[]> => (isApi() ? (await get<{ items: ManualReading[] }>(`${W}meters/${encodeURIComponent(id)}/manual-readings`)).items : []),
  addManual: (id: string, body: { read_at: string; value: string; unit: 'L' | 'm3'; note?: string }) =>
    post<{ effect: string; reason: string | null; litres: number | null; id?: string }>(`${W}meters/${encodeURIComponent(id)}/manual-readings`, body),
  undoManual: (id: string, readingId: string) => post<ManualReading>(`${W}meters/${encodeURIComponent(id)}/manual-readings/${encodeURIComponent(readingId)}/undo`, {}),
  events: async (state: 'open' | 'all', meterId?: string): Promise<{ items: WaterEvent[]; summary: EventsSummary }> => {
    if (!isApi()) return { items: [], summary: { open: 0, acked: 0, last_7d: 0, open_leaks: 0, snoozed: 0 } };
    const r = await get<{ items: WaterEvent[]; summary: EventsSummary }>(`${W}events${qs({ state, meter_id: meterId })}`);
    if (!meterId) setOpenAlertCount(r.summary.open);
    return r;
  },
  ack: (id: string) => post<WaterEvent>(`${W}events/${encodeURIComponent(id)}/ack`, {}),
  snooze: (id: string, minutes?: number) => post<WaterEvent>(`${W}events/${encodeURIComponent(id)}/snooze`, minutes === undefined ? {} : { minutes }),
  unsnooze: (id: string) => del(`${W}events/${encodeURIComponent(id)}/snooze`),
  /** water.manage reads (403 otherwise): the rules and the snooze settings. */
  alerts: async (): Promise<AlertsConfig | null> => (isApi() ? get<AlertsConfig>(`${W}alerts`) : { rules: DEFAULT_RULES, snooze: DEFAULT_SNOOZE, snooze_limits: { min: 5, max: 43200, count: 12 }, row_version: 0, can_edit: true }),
  saveSnooze: (snooze: SnoozeSettings, rowVersion?: number) => put<AlertsConfig>(`${W}alerts`, { snooze, row_version: rowVersion }),
};

// ---------------------------------------------------------------- the open-alert count of the page row ("התראות (n)")

let openCount = 0;
const countListeners = new Set<(n: number) => void>();
export const openAlertCount = (): number => openCount;
export function setOpenAlertCount(n: number): void {
  if (n === openCount) return;
  openCount = n;
  for (const l of countListeners) l(n);
}
export function onOpenAlertCount(fn: (n: number) => void): () => void {
  countListeners.add(fn);
  return () => countListeners.delete(fn);
}

// ---------------------------------------------------------------- the rules any viewer sees (the default window without water.manage)

let rulesCache: { at: number; cfg: AlertsConfig | null } | null = null;
/** The alert settings when readable (water.manage), else null; cached a minute. */
export async function readableAlerts(force = false): Promise<AlertsConfig | null> {
  if (!force && rulesCache && Date.now() - rulesCache.at < 60_000) return rulesCache.cfg;
  let cfg: AlertsConfig | null = null;
  try {
    cfg = await water.alerts();
  } catch {
    cfg = null;
  }
  rulesCache = { at: Date.now(), cfg };
  return cfg;
}

// ---------------------------------------------------------------- night flow ("ספיקת לילה", litres per hour)

const hm = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** The last completed (or running) night window as two instants in the browser's zone: today's when it has started, else last night's. */
export function lastNightWindow(rules: Pick<LeakRules, 'night_from' | 'night_to'>, now = new Date()): { from: Date; to: Date } {
  const f = hm(rules.night_from);
  const t = hm(rules.night_to);
  const at = (base: Date, min: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(min / 60), min % 60);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const day = new Date(now);
  // the window that ends today has started when now is past its start; a window across midnight (22:00-05:00) starts yesterday
  if (nowMin < f && !(t < f && nowMin < t)) day.setDate(day.getDate() - 1);
  const from = at(day, f);
  const end = new Date(from);
  if (t <= f) end.setDate(end.getDate() + 1);
  const to = at(end, t);
  return { from, to: to > now ? now : to };
}

/** The lowest hourly flow inside a night window (litres per hour), or null without readings. */
export function nightFloor(items: SeriesItem[]): number | null {
  const v = items.map((i) => i.litres).filter((x): x is number => x !== null && x !== undefined);
  return v.length ? Math.round(Math.min(...v) * 10) / 10 : null;
}

/** Whether the night rule is off for the meter: an irrigation meter by default (owner Q9), or its own override. */
export function nightRuleOff(m: Pick<Meter, 'kind' | 'rules'>): boolean {
  const own = m.rules?.night_rule;
  if (typeof own === 'boolean') return !own;
  return m.kind === 'irrigation';
}

const nightCache = new Map<string, { at: number; v: number | null }>();
/** The night flow of each meter (litres per hour; 'off' for a meter whose night rule is off). One series read per meter, cached 10 minutes. */
export async function nightFlows(meters: Meter[], rules: Pick<LeakRules, 'night_from' | 'night_to'>): Promise<Record<string, number | null | 'off'>> {
  const out: Record<string, number | null | 'off'> = {};
  const w = lastNightWindow(rules);
  await Promise.all(
    meters.map(async (m) => {
      if (nightRuleOff(m)) return void (out[m.id] = 'off');
      if (m.status === 'retired' || m.value_l === null) return void (out[m.id] = null);
      const hit = nightCache.get(m.id);
      if (hit && Date.now() - hit.at < 600_000) return void (out[m.id] = hit.v);
      try {
        const v = nightFloor(await water.series(m.id, '1h', w.from.toISOString(), w.to.toISOString()));
        nightCache.set(m.id, { at: Date.now(), v });
        out[m.id] = v;
      } catch {
        out[m.id] = null;
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- the areas tree (floors and areas with counts), as electricity's

export interface AreaNode {
  floor_id: string;
  name: string;
  count: number;
  areas: { area_id: string; name: string; count: number }[];
}

/** The tree's key of a meter's area ('_none' for a meter without one). */
export const areaKey = (m: Pick<Meter, 'area_id'>): string => m.area_id ?? '_none';

export function buildWaterAreaTree(meters: Meter[], noFloor = 'ללא קומה', noArea = 'ללא אזור'): AreaNode[] {
  const floors = new Map<string, AreaNode>();
  for (const m of meters) {
    const fid = m.floor_id ?? '';
    const f = floors.get(fid) ?? { floor_id: fid, name: m.floor_name ?? noFloor, count: 0, areas: [] };
    f.count++;
    const aid = areaKey(m);
    const a = f.areas.find((x) => x.area_id === aid);
    if (a) a.count++;
    else f.areas.push({ area_id: aid, name: m.area_name ?? noArea, count: 1 });
    floors.set(fid, f);
  }
  return [...floors.values()];
}
