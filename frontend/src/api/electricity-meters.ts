/**
 * CR-023 electricity module, meters and retention: the ONLY module of the frontend that talks to the meters endpoints
 * (`/api/v1/energy/...`, CR-023 section 16). With a backend the HTTP adapter calls the routes; without one (static preview, design review)
 * an in-memory demo answers from src/electricity/fixtures.ts. Until the real server ships (pilot/elec-server, ELECTRICITY_INTERFACES.md)
 * the shapes below are the CR/PLAN contract; wiring the real backend means changing the `wire*` mappers and the paths in THIS file only.
 *
 * Energy is kWh here (the server stores Wh; the conversion is the server's). Money never appears in these types.
 */
import { ApiError, del, get, patch, post } from './client';
import { isApi } from './session';
import { FIXTURE_NOW, fixtureCandidates, fixtureEpochs, fixtureMeters, fixtureSeries, fixtureSettings } from '../electricity/fixtures';

/** reporting = מדווח, stale = לא מדווח (no reading within `energy.stale_after_minutes`), paused = מושהה. */
export type MeterStatus = 'reporting' | 'stale' | 'paused';

export interface Meter {
  id: string;
  /** The operator's name for the meter (editable); never an entity id. */
  name: string;
  /** The source's own name (the infrastructure sensor), shown small in the card. */
  entity_name: string | null;
  area_id: string | null;
  area_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  status: MeterStatus;
  reading_kwh: number | null;
  last_report_at: string | null;
  today_kwh: number | null;
  month_kwh: number | null;
  /** Names of the accounts that use the meter. */
  accounts: string[];
  revision: number;
}

export interface MeterEpoch {
  started_at: string;
  ended_at: string | null;
  start_reading_kwh: number;
  reason: 'install' | 'reset' | 'replace' | 'source_change';
  note: string;
}

export interface MeterDetail extends Meter {
  epochs: MeterEpoch[];
}

export type CandidateVerdict = 'ok' | 'warn' | 'rejected';
/** kw = power sensor, unit = another unit, measurement = instantaneous value, total = daily / two-way counter (warning),
 * returned = energy returned to the grid, duplicate_device = same device already used (warning), not_sensor = another domain. */
export type CandidateReason = 'kw' | 'unit' | 'measurement' | 'total' | 'returned' | 'duplicate_device' | 'not_sensor';

export interface MeterCandidate {
  entity_id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  floor_name: string | null;
  /** The current value with its unit as the infrastructure reports it ("14.2 kW"). */
  value: string | null;
  verdict: CandidateVerdict;
  reason_code: CandidateReason | null;
  /** The server's operator-language sentence for the verdict; the screen falls back to REASON_TEXT. */
  message: string | null;
  already_added: boolean;
}

export interface SeriesPoint {
  t: string;
  kwh: number;
}
export type SeriesStep = '15m' | '1h' | '1d';

export interface EnergySettings {
  raw_retention_days: number;
  interval_retention_months: number;
  bill_retention_years: number;
  draft_retention_days: number;
  /** Bytes used per data class. */
  usage: { raw_bytes: number; interval_bytes: number; bill_bytes: number; draft_bytes: number };
  meter_count: number;
  can_edit_retention: boolean;
  can_edit_drafts: boolean;
}
export type RetentionKey = 'raw_retention_days' | 'interval_retention_months' | 'bill_retention_years' | 'draft_retention_days';
export type RetentionPatch = Partial<Record<RetentionKey, number>>;

/** Allowed ranges (CR-023 section 15). The server checks them again (422). */
export const RETENTION_RANGES: Record<RetentionKey, { min: number; max: number; unit: string }> = {
  raw_retention_days: { min: 7, max: 366, unit: 'ימים' },
  interval_retention_months: { min: 3, max: 120, unit: 'חודשים' },
  bill_retention_years: { min: 1, max: 15, unit: 'שנים' },
  draft_retention_days: { min: 7, max: 365, unit: 'ימים' },
};

/** Operator wording for a verdict (CR-023 section 5), used when the server sends no sentence of its own. */
export const REASON_TEXT: Record<CandidateReason, string> = {
  kw: 'החיישן שנבחר מודד הספק רגעי (קילוואט), לא צריכה מצטברת. לחשבון חשמל צריך מונה שמציג קוט״ש.',
  unit: 'יחידת המידה של החיישן אינה קוט״ש. אפשר לבחור רק מונה שמודד קוט״ש, וואט־שעה או מגוואט־שעה.',
  measurement: 'החיישן מציג ערך רגעי ולא מונה מצטבר. בחרו מונה צריכה.',
  total: 'המונה מתאפס כל יום. מתאים, אבל מונה מצטבר עדיף.',
  returned: 'מונה של אנרגיה מוחזרת לרשת. לא נתמך בחשבון צריכה.',
  duplicate_device: 'כבר נבחר מונה מאותו מכשיר. ודאו שהצריכה לא תיספר פעמיים.',
  not_sensor: 'ההתקן אינו חיישן צריכה.',
};

export function candidateMessage(c: MeterCandidate): string {
  if (c.message) return c.message;
  return c.reason_code ? REASON_TEXT[c.reason_code] : '';
}

export interface AddMeterBody {
  entity_id: string;
  name?: string;
}
export interface ReplaceMeterBody {
  /** The old counter's final reading (typed or the last seen). */
  final_reading_kwh: number;
  /** The new counter's start reading. */
  start_reading_kwh: number;
  note?: string;
}

/** The adapter surface: what the screens call. */
export interface MeterAdapter {
  list(): Promise<Meter[]>;
  detail(id: string): Promise<MeterDetail>;
  candidates(q: string, area?: string): Promise<MeterCandidate[]>;
  add(body: AddMeterBody): Promise<Meter>;
  setStatus(id: string, status: 'active' | 'paused', revision: number): Promise<Meter>;
  remove(id: string, revision: number): Promise<void>;
  replace(id: string, body: ReplaceMeterBody): Promise<MeterDetail>;
  series(id: string, step: SeriesStep, from: string, to: string): Promise<SeriesPoint[]>;
  getSettings(): Promise<EnergySettings>;
  patchSettings(p: RetentionPatch): Promise<EnergySettings>;
}

// ------------------------------------------------------------------------------------------------ HTTP adapter (the CR/PLAN contract)

const arr = <T>(v: unknown, key: string): T[] => (Array.isArray(v) ? (v as T[]) : (((v as Record<string, unknown> | null)?.[key] as T[] | undefined) ?? []));

const http: MeterAdapter = {
  async list() {
    return arr<Meter>(await get<unknown>('energy/meters'), 'meters');
  },
  detail: (id) => get<MeterDetail>(`energy/meters/${encodeURIComponent(id)}`),
  async candidates(q, area) {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (area) p.set('area', area);
    return arr<MeterCandidate>(await get<unknown>(`energy/candidates${p.toString() ? `?${p}` : ''}`), 'candidates');
  },
  add: (body) => post<Meter>('energy/meters', body),
  setStatus: (id, status, revision) => patch<Meter>(`energy/meters/${encodeURIComponent(id)}`, { status, revision }),
  remove: (id, revision) => del(`energy/meters/${encodeURIComponent(id)}?revision=${revision}`),
  replace: (id, body) => post<MeterDetail>(`energy/meters/${encodeURIComponent(id)}/replace`, body),
  async series(id, step, from, to) {
    const p = new URLSearchParams({ from, to, step });
    return arr<SeriesPoint>(await get<unknown>(`energy/meters/${encodeURIComponent(id)}/series?${p}`), 'points');
  },
  getSettings: () => get<EnergySettings>('energy/settings'),
  patchSettings: (p) => patch<EnergySettings>('energy/settings', p),
};

// ------------------------------------------------------------------------------------------------ demo adapter (no backend)

function demoError(status: number, code: string, user_message: string): never {
  throw new ApiError(status, { code, user_message, retryable: false, correlation_id: 'demo', details: {} });
}

let demoMeters: Meter[] | null = null;
let demoSettings: EnergySettings | null = null;
const demoEpochs = new Map<string, MeterEpoch[]>();
const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 60));

function dm(): Meter[] {
  demoMeters ??= fixtureMeters();
  return demoMeters;
}
function find(id: string): Meter {
  const m = dm().find((x) => x.id === id);
  return m ?? demoError(404, 'not_found', 'המונה לא נמצא');
}

const demo: MeterAdapter = {
  list: () => delay(dm().map((m) => ({ ...m }))),
  detail: (id) => delay({ ...find(id), epochs: demoEpochs.get(id) ?? fixtureEpochs(id) }),
  candidates: (q) => {
    const needle = q.trim().toLowerCase();
    return delay(fixtureCandidates().filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.area_name ?? '').toLowerCase().includes(needle)));
  },
  add: (body) => {
    const c = fixtureCandidates().find((x) => x.entity_id === body.entity_id);
    if (!c) return demoError(404, 'not_found', 'החיישן לא נמצא');
    if (c.verdict === 'rejected') return demoError(422, 'meter_unit_rejected', c.message ?? REASON_TEXT[c.reason_code ?? 'unit']);
    if (dm().some((m) => m.entity_name === body.entity_id)) return demoError(409, 'meter_duplicate', 'המונה כבר נוסף');
    const m: Meter = { id: `m${dm().length + 1}`, name: body.name?.trim() || c.name, entity_name: c.entity_id, area_id: c.area_id, area_name: c.area_name, floor_id: null, floor_name: c.floor_name, status: 'reporting', reading_kwh: parseFloat((c.value ?? '0').replace(/,/g, '')) || 0, last_report_at: FIXTURE_NOW, today_kwh: 0, month_kwh: 0, accounts: [], revision: 1 };
    dm().push(m);
    return delay({ ...m });
  },
  setStatus: (id, status) => {
    const m = find(id);
    m.status = status === 'paused' ? 'paused' : 'reporting';
    m.revision += 1;
    return delay({ ...m });
  },
  remove: (id) => {
    const m = find(id);
    if (m.accounts.length) return demoError(409, 'meter_in_use', 'המונה משמש בחשבון ולכן אי אפשר להסיר אותו');
    demoMeters = dm().filter((x) => x.id !== id);
    return delay(undefined);
  },
  replace: (id, body) => {
    const m = find(id);
    const list = demoEpochs.get(id) ?? fixtureEpochs(id);
    const open = list.find((e) => !e.ended_at);
    if (open) open.ended_at = FIXTURE_NOW;
    list.push({ started_at: FIXTURE_NOW, ended_at: null, start_reading_kwh: body.start_reading_kwh, reason: 'replace', note: body.note ?? '' });
    demoEpochs.set(id, list);
    m.reading_kwh = body.start_reading_kwh;
    m.revision += 1;
    return delay({ ...m, epochs: list });
  },
  series: (id, step, from, to) => delay(fixtureSeries(id, step === '1h' ? 24 : Math.max(1, Math.min(400, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000))), step === '1h' ? 3_600_000 : 86_400_000)),
  getSettings: () => {
    demoSettings ??= fixtureSettings();
    demoSettings.meter_count = dm().length;
    return delay({ ...demoSettings });
  },
  patchSettings: (p) => {
    demoSettings ??= fixtureSettings();
    for (const [k, v] of Object.entries(p) as [RetentionKey, number][]) {
      const r = RETENTION_RANGES[k];
      if (!Number.isInteger(v) || v < r.min || v > r.max) return demoError(422, 'retention_out_of_range', `הערך חייב להיות בין ${r.min} ל-${r.max}`);
      demoSettings[k] = v;
    }
    return delay({ ...demoSettings });
  },
};

/** The adapter in force: HTTP with a backend session, the in-memory demo without one. */
export const meters = (): MeterAdapter => (isApi() ? http : demo);

export const listMeters = () => meters().list();
export const getMeter = (id: string) => meters().detail(id);
export const meterCandidates = (q: string, area?: string) => meters().candidates(q, area);
export const addMeter = (body: AddMeterBody) => meters().add(body);
export const pauseMeter = (m: Pick<Meter, 'id' | 'revision'>) => meters().setStatus(m.id, 'paused', m.revision);
export const resumeMeter = (m: Pick<Meter, 'id' | 'revision'>) => meters().setStatus(m.id, 'active', m.revision);
export const removeMeter = (m: Pick<Meter, 'id' | 'revision'>) => meters().remove(m.id, m.revision);
export const replaceMeter = (id: string, body: ReplaceMeterBody) => meters().replace(id, body);
export const meterSeries = (id: string, step: SeriesStep, from: string, to: string) => meters().series(id, step, from, to);
export const getRetention = () => meters().getSettings();
export const putRetention = (p: RetentionPatch) => meters().patchSettings(p);

/** Add several sensors one by one; returns the failures so the screen can say which ones did not go in. */
export async function addMeters(bodies: AddMeterBody[]): Promise<{ added: Meter[]; failed: { entity_id: string; message: string }[] }> {
  const added: Meter[] = [];
  const failed: { entity_id: string; message: string }[] = [];
  for (const b of bodies) {
    try {
      added.push(await addMeter(b));
    } catch (err) {
      failed.push({ entity_id: b.entity_id, message: err instanceof ApiError ? err.body.user_message || err.body.code : 'ההוספה נכשלה' });
    }
  }
  return { added, failed };
}

/** The area tree of the meters screen: floors with their areas and the number of meters, built from the list. */
export interface AreaNode {
  area_id: string;
  name: string;
  count: number;
}
export interface FloorNode {
  floor_id: string;
  name: string;
  count: number;
  areas: AreaNode[];
}
export function buildAreaTree(list: Meter[]): FloorNode[] {
  const floors = new Map<string, FloorNode>();
  for (const m of list) {
    const fid = m.floor_id ?? m.floor_name ?? '_none';
    const f = floors.get(fid) ?? { floor_id: fid, name: m.floor_name ?? 'ללא קומה', count: 0, areas: [] };
    f.count += 1;
    const aid = m.area_id ?? '_none';
    let a = f.areas.find((x) => x.area_id === aid);
    if (!a) {
      a = { area_id: aid, name: m.area_name ?? 'ללא אזור', count: 0 };
      f.areas.push(a);
    }
    a.count += 1;
    floors.set(fid, f);
  }
  return [...floors.values()];
}

export interface MeterSummary {
  today_kwh: number;
  month_kwh: number;
  reporting: number;
  stale: number;
  paused: number;
  total: number;
}
export function summarize(list: Meter[]): MeterSummary {
  const s: MeterSummary = { today_kwh: 0, month_kwh: 0, reporting: 0, stale: 0, paused: 0, total: list.length };
  for (const m of list) {
    s.today_kwh += m.today_kwh ?? 0;
    s.month_kwh += m.month_kwh ?? 0;
    if (m.status === 'reporting') s.reporting += 1;
    else if (m.status === 'stale') s.stale += 1;
    else s.paused += 1;
  }
  return s;
}

/** Estimated size of the retention choices for `n` meters (CR-023 section 15: ~0.045 MB per meter per raw day, ~0.0013 MB per meter per interval day). */
export function estimateBytes(key: RetentionKey, value: number, meterCount: number): number {
  const MB = 1_048_576;
  const n = Math.max(meterCount, 1);
  if (key === 'raw_retention_days') return value * n * 0.045 * MB;
  if (key === 'interval_retention_months') return value * 30.4 * n * 0.0013 * MB;
  if (key === 'bill_retention_years') return value * n * 0.5 * MB;
  return 0;
}
