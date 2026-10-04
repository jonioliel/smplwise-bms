/**
 * CR-023 electricity module, meters and retention: the ONLY module of the frontend that talks to the meters endpoints (`/api/v1/energy/...`,
 * docs/architecture/ELECTRICITY_INTERFACES.md section 3, owned by pilot/elec-server). With a backend the HTTP adapter calls the routes and maps the wire
 * shapes to the screen types below; without one (static preview, design review) an in-memory demo answers from src/electricity/fixtures.ts.
 * A change of the real contract is a change of the `wire*` mappers and the paths in THIS file (and tests/electricity-mocks.ts, which speaks the wire).
 *
 * Energy is kWh here. Money never appears in these types.
 */
import { ApiError, del, get, patch, post } from './client';
import { isApi } from './session';
import { getDevicesTree } from './devices';
import { FIXTURE_NOW, fixtureCandidates, fixtureEpochs, fixtureMeters, fixtureSeries, fixtureSettings } from '../electricity/fixtures';

/** reporting = מדווח, stale = לא מדווח (no reading within `energy.stale_after_minutes`), paused = מושהה. */
export type MeterStatus = 'reporting' | 'stale' | 'paused';

export interface Meter {
  id: string;
  /** The operator's name for the meter (editable); never an entity id. */
  name: string;
  area_id: string | null;
  area_name: string | null;
  /** The device the sensor belongs to, as the platform shows it (the user's device name, else its own); null = the sensor has no device. */
  device_id: string | null;
  device_name: string | null;
  /** The sensor's own name (the registered `name` may be the operator's own). */
  entity_name: string | null;
  /** The floor of the area (from the devices tree; the meters endpoint has none). null = unknown. */
  floor_id: string | null;
  floor_name: string | null;
  status: MeterStatus;
  reading_kwh: number | null;
  last_report_at: string | null;
  today_kwh: number | null;
  /** Month to date (from /energy/consumption); null when that read failed. */
  month_kwh: number | null;
  /** Names of the accounts that use the meter (the detail only). */
  accounts: string[];
  /** How many accounts use it, when the server says (list); null = not known, the column is not drawn. */
  accounts_count: number | null;
  revision: number;
}

export interface MeterEpoch {
  started_at: string;
  ended_at: string | null;
  start_reading_kwh: number | null;
  reason: 'install' | 'reset' | 'replace' | 'source_change';
  note: string;
}

export interface MeterDetail extends Meter {
  epochs: MeterEpoch[];
}

export type CandidateVerdict = 'ok' | 'warn' | 'rejected';
/** kw = power sensor, unit = another unit, measurement = instantaneous value, total = daily / two-way counter (warning),
 * returned = energy returned to the grid, duplicate_device = same device already used (warning), not_sensor = another domain, other = see the message. */
export type CandidateReason = 'kw' | 'unit' | 'measurement' | 'total' | 'returned' | 'duplicate_device' | 'not_sensor' | 'other';

export interface MeterCandidate {
  /** The source reference (the infrastructure sensor); what POST /energy/meters takes as `source_ref`. */
  entity_id: string;
  name: string;
  /** The device the sensor belongs to (the user's device name, else its own); null = no device. */
  device_id: string | null;
  device_name: string | null;
  /** The sensor's own name. */
  entity_name: string | null;
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

export type RetentionKey = 'raw_retention_days' | 'interval_retention_months' | 'bill_retention_years' | 'draft_retention_days';
export type RetentionPatch = Partial<Record<RetentionKey, number>>;

export interface EnergySettings {
  raw_retention_days: number;
  interval_retention_months: number;
  bill_retention_years: number;
  draft_retention_days: number;
  /** Bytes in use per data class; null = the server does not say (the bills' size belongs to the billing side). */
  usage: { raw_bytes: number | null; interval_bytes: number | null; bill_bytes: number | null; draft_bytes: number | null };
  meter_count: number;
  /** Per key: may this caller change it (retention classes need system.configure, drafts energy.manage). */
  editable: Record<RetentionKey, boolean>;
  ranges: Record<RetentionKey, { min: number; max: number }>;
}

/** Allowed ranges (CR-023 section 15) and the unit word of each value; the server's own `ranges` win when it sends them. */
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
  other: 'החיישן אינו מתאים כמונה צריכה.',
};

export function candidateMessage(c: MeterCandidate): string {
  if (c.message) return c.message;
  return c.reason_code ? REASON_TEXT[c.reason_code] : '';
}

export interface AddMeterBody {
  /** The candidate's `entity_id` (the source reference). */
  entity_id: string;
  name?: string;
}
export interface ReplaceMeterBody {
  /** The old counter's final reading (typed or the last seen). */
  final_reading_kwh: number;
  /** The new counter's start reading. */
  start_reading_kwh: number;
  note?: string;
  /** The meter's revision (optimistic concurrency). */
  revision?: number;
}

/** The adapter surface: what the screens call. */
export interface MeterAdapter {
  list(): Promise<Meter[]>;
  detail(id: string): Promise<MeterDetail>;
  candidates(q: string, area?: string): Promise<MeterCandidate[]>;
  add(body: AddMeterBody): Promise<Meter>;
  setStatus(id: string, status: 'active' | 'paused', revision: number): Promise<Meter>;
  rename(id: string, name: string, revision: number): Promise<Meter>;
  remove(id: string, revision: number): Promise<void>;
  replace(id: string, body: ReplaceMeterBody): Promise<MeterDetail>;
  series(id: string, step: SeriesStep, from: string, to: string): Promise<SeriesPoint[]>;
  getSettings(): Promise<EnergySettings>;
  patchSettings(p: RetentionPatch): Promise<EnergySettings>;
}

// ------------------------------------------------------------------------------------------------ wire shapes (ELECTRICITY_INTERFACES.md section 3)

interface WireEpoch {
  id?: string;
  started_at: string;
  ended_at: string | null;
  start_reading_wh: number | null;
  reason: string;
  note: string | null;
}
interface WireMeter {
  id: string;
  display_name: string;
  device_id?: string | null;
  device_name?: string | null;
  entity_name?: string | null;
  area_id: string | null;
  area_name: string | null;
  status: string;
  state?: string;
  revision: number;
  last_report_at: string | null;
  value_kwh: number | null;
  today_kwh: number | null;
  /** Not in the contract yet: the list may carry it (asked of pilot/elec-server). */
  accounts_count?: number;
  used_in?: { account_id: string; name: string }[];
  epochs?: WireEpoch[];
}
interface WireCandidate {
  ref: string;
  name: string;
  device_id?: string | null;
  device_name?: string | null;
  entity_name?: string | null;
  area_id: string | null;
  area_name: string | null;
  unit: string | null;
  state: string | number | null;
  verdict: 'ok' | 'warning' | 'rejected';
  code: string;
  message: string | null;
  already_meter_id: string | null;
}
interface WireSettings {
  values: Record<string, number | string | boolean>;
  editable?: Record<string, boolean>;
  ranges?: Record<string, { min?: number; max?: number } | [number, number]>;
  storage?: {
    energy_db_bytes?: number;
    classes?: Record<string, { rows?: number; bytes_estimate?: number }>;
    estimate?: { meters?: number };
  };
}

const CODE_REASON: Record<string, CandidateReason> = {
  power_unit: 'kw',
  unit_rejected: 'unit',
  unit_missing: 'unit',
  measurement: 'measurement',
  returned_energy: 'returned',
  warn_total: 'total',
  warn_same_device: 'duplicate_device',
  domain_rejected: 'not_sensor',
};
const EPOCH_REASON: Record<string, MeterEpoch['reason']> = { first: 'install', replaced: 'replace', source_changed: 'source_change', reset: 'reset' };

export function wireMeter(w: WireMeter, floors: Map<string, { id: string; name: string }>, month: Map<string, number>): Meter {
  const st = w.state ?? (w.status === 'paused' ? 'paused' : 'reporting');
  const floor = w.area_id ? floors.get(w.area_id) : undefined;
  return {
    id: w.id,
    name: w.display_name,
    device_id: w.device_id ?? null,
    device_name: w.device_name ?? null,
    entity_name: w.entity_name ?? null,
    area_id: w.area_id,
    area_name: w.area_name,
    floor_id: floor?.id ?? null,
    floor_name: floor?.name ?? null,
    status: st === 'paused' ? 'paused' : st === 'not_reporting' ? 'stale' : 'reporting',
    reading_kwh: w.value_kwh,
    last_report_at: w.last_report_at,
    today_kwh: w.today_kwh,
    month_kwh: month.get(w.id) ?? null,
    accounts: (w.used_in ?? []).map((u) => u.name),
    accounts_count: w.accounts_count ?? (w.used_in ? w.used_in.length : null),
    revision: w.revision,
  };
}

function wireDetail(w: WireMeter, floors: Map<string, { id: string; name: string }>): MeterDetail {
  return {
    ...wireMeter(w, floors, new Map()),
    epochs: (w.epochs ?? []).map((e) => ({ started_at: e.started_at, ended_at: e.ended_at, start_reading_kwh: e.start_reading_wh == null ? null : e.start_reading_wh / 1000, reason: EPOCH_REASON[e.reason] ?? 'install', note: e.note ?? '' })),
  };
}

function wireCandidate(c: WireCandidate): MeterCandidate {
  return {
    entity_id: c.ref,
    name: c.name,
    device_id: c.device_id ?? null,
    device_name: c.device_name ?? null,
    entity_name: c.entity_name ?? null,
    area_id: c.area_id,
    area_name: c.area_name,
    floor_name: null,
    value: c.state == null ? null : `${c.state}${c.unit ? ` ${c.unit}` : ''}`,
    verdict: c.verdict === 'warning' ? 'warn' : c.verdict,
    reason_code: c.code === 'ok' ? null : (CODE_REASON[c.code] ?? 'other'),
    message: c.verdict === 'ok' ? null : c.message,
    already_added: !!c.already_meter_id,
  };
}

const KEYS: RetentionKey[] = ['raw_retention_days', 'interval_retention_months', 'bill_retention_years', 'draft_retention_days'];

function wireSettings(w: WireSettings, meterCount: number): EnergySettings {
  const val = (k: RetentionKey): number => Number(w.values[`energy.${k}`] ?? w.values[k] ?? RETENTION_RANGES[k].min);
  const range = (k: RetentionKey) => {
    const r = w.ranges?.[`energy.${k}`] ?? w.ranges?.[k];
    const lo = Array.isArray(r) ? r[0] : r?.min;
    const hi = Array.isArray(r) ? r[1] : r?.max;
    return { min: lo ?? RETENTION_RANGES[k].min, max: hi ?? RETENTION_RANGES[k].max };
  };
  const classes = w.storage?.classes ?? {};
  return {
    raw_retention_days: val('raw_retention_days'),
    interval_retention_months: val('interval_retention_months'),
    bill_retention_years: val('bill_retention_years'),
    draft_retention_days: val('draft_retention_days'),
    usage: { raw_bytes: classes.raw?.bytes_estimate ?? null, interval_bytes: classes.intervals?.bytes_estimate ?? null, bill_bytes: classes.daily?.bytes_estimate ?? null, draft_bytes: null },
    meter_count: w.storage?.estimate?.meters ?? meterCount,
    editable: Object.fromEntries(KEYS.map((k) => [k, !!(w.editable?.[`energy.${k}`] ?? w.editable?.[k])])) as EnergySettings['editable'],
    ranges: Object.fromEntries(KEYS.map((k) => [k, range(k)])) as EnergySettings['ranges'],
  };
}

const items = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : (((v as { items?: T[] } | null)?.items) ?? []));

/** area id -> floor, from the devices tree. A caller without the devices permission gets an empty map (the tree then has no floors). */
async function floorsByArea(): Promise<Map<string, { id: string; name: string }>> {
  const out = new Map<string, { id: string; name: string }>();
  try {
    const tree = await getDevicesTree();
    for (const f of tree.floors) for (const a of f.areas) out.set(a.area_id, { id: f.floor_id, name: f.name });
  } catch {
    /* no floors: the area tree is flat */
  }
  return out;
}

/** Month-to-date kWh per meter in one call (`/energy/consumption`); an empty map when it fails (the column shows a dash). */
async function monthToDate(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  try {
    const q = new URLSearchParams({ meter_ids: ids.join(','), from: from.toISOString(), to: now.toISOString() });
    for (const it of items<{ meter_id: string; kwh: number | null }>(await get<unknown>(`energy/consumption?${q}`))) if (it.kwh != null) out.set(it.meter_id, it.kwh);
  } catch {
    /* partial: the month column is empty */
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ HTTP adapter

const http: MeterAdapter = {
  async list() {
    const [raw, floors] = await Promise.all([get<unknown>('energy/meters'), floorsByArea()]);
    const list = items<WireMeter>(raw);
    const month = await monthToDate(list.map((m) => m.id));
    return list.map((m) => wireMeter(m, floors, month));
  },
  async detail(id) {
    const [w, floors] = await Promise.all([get<WireMeter>(`energy/meters/${encodeURIComponent(id)}`), floorsByArea()]);
    return wireDetail(w, floors);
  },
  async candidates(q, area) {
    const p = new URLSearchParams({ include_rejected: 'true' });
    if (q.trim()) p.set('q', q.trim());
    if (area) p.set('area_id', area);
    return items<WireCandidate>(await get<unknown>(`energy/candidates?${p}`)).map(wireCandidate);
  },
  async add(body) {
    const w = await post<WireMeter>('energy/meters', { source_ref: body.entity_id, ...(body.name ? { display_name: body.name } : {}) });
    return wireMeter(w, new Map(), new Map());
  },
  async setStatus(id, status, revision) {
    return wireMeter(await patch<WireMeter>(`energy/meters/${encodeURIComponent(id)}`, { revision, status }), new Map(), new Map());
  },
  async rename(id, name, revision) {
    return wireMeter(await patch<WireMeter>(`energy/meters/${encodeURIComponent(id)}`, { revision, display_name: name }), new Map(), new Map());
  },
  async remove(id, revision) {
    await del(`energy/meters/${encodeURIComponent(id)}?revision=${revision}`);
  },
  async replace(id, body) {
    const cur = body.revision ?? (await get<WireMeter>(`energy/meters/${encodeURIComponent(id)}`)).revision;
    const w = await post<WireMeter>(`energy/meters/${encodeURIComponent(id)}/replace`, { revision: cur, old_final_reading_kwh: body.final_reading_kwh, new_start_reading_kwh: body.start_reading_kwh, ...(body.note ? { note: body.note } : {}) });
    return wireDetail(w, new Map());
  },
  async series(id, step, from, to) {
    const p = new URLSearchParams({ from, to, step });
    return items<{ start: string; kwh: number | null }>(await get<unknown>(`energy/meters/${encodeURIComponent(id)}/series?${p}`)).map((i) => ({ t: i.start, kwh: i.kwh ?? 0 }));
  },
  async getSettings() {
    return wireSettings(await get<WireSettings>('energy/settings'), 0);
  },
  async patchSettings(p) {
    const body = Object.fromEntries(Object.entries(p).map(([k, v]) => [`energy.${k}`, v]));
    return wireSettings(await patch<WireSettings>('energy/settings', body), 0);
  },
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
    return delay(fixtureCandidates().filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.device_name ?? '').toLowerCase().includes(needle) || (c.area_name ?? '').toLowerCase().includes(needle)));
  },
  add: (body) => {
    const c = fixtureCandidates().find((x) => x.entity_id === body.entity_id);
    if (!c) return demoError(404, 'not_found', 'החיישן לא נמצא');
    if (c.verdict === 'rejected') return demoError(422, 'meter_unit_rejected', c.message ?? REASON_TEXT[c.reason_code ?? 'unit']);
    const m: Meter = { id: `m${dm().length + 1}`, name: body.name?.trim() || c.name, device_id: c.device_id, device_name: c.device_name, entity_name: c.entity_name, area_id: c.area_id, area_name: c.area_name, floor_id: null, floor_name: c.floor_name, status: 'reporting', reading_kwh: parseFloat((c.value ?? '0').replace(/,/g, '')) || 0, last_report_at: FIXTURE_NOW, today_kwh: 0, month_kwh: 0, accounts: [], accounts_count: 0, revision: 1 };
    dm().push(m);
    return delay({ ...m });
  },
  setStatus: (id, status) => {
    const m = find(id);
    m.status = status === 'paused' ? 'paused' : 'reporting';
    m.revision += 1;
    return delay({ ...m });
  },
  rename: (id, name, revision) => {
    const m = find(id);
    if (m.revision !== revision) return demoError(409, 'revision_conflict', 'המונה השתנה בינתיים. רעננו ונסו שוב.');
    m.name = name;
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
    return delay(JSON.parse(JSON.stringify(demoSettings)) as EnergySettings);
  },
  patchSettings: (p) => {
    demoSettings ??= fixtureSettings();
    for (const [k, v] of Object.entries(p) as [RetentionKey, number][]) {
      const r = RETENTION_RANGES[k];
      if (!Number.isInteger(v) || v < r.min || v > r.max) return demoError(422, 'validation', `הערך חייב להיות בין ${r.min} ל-${r.max}`);
      demoSettings[k] = v;
    }
    return delay(JSON.parse(JSON.stringify(demoSettings)) as EnergySettings);
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
export const renameMeter = (m: Pick<Meter, 'id' | 'revision'>, name: string) => meters().rename(m.id, name, m.revision);
export const removeMeter = (m: Pick<Meter, 'id' | 'revision'>) => meters().remove(m.id, m.revision);
export const replaceMeter = (m: Pick<Meter, 'id' | 'revision'>, body: Omit<ReplaceMeterBody, 'revision'>) => meters().replace(m.id, { ...body, revision: m.revision });
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

/** Estimated size of a retention choice for `n` meters: the server's formula (ELECTRICITY_INTERFACES.md section 6; worst case, a change every minute). */
export function estimateBytes(key: RetentionKey, value: number, meterCount: number): number {
  const n = Math.max(meterCount, 1);
  if (key === 'raw_retention_days') return n * 1440 * value * 32;
  if (key === 'interval_retention_months') return n * 96 * 30.44 * value * 24;
  if (key === 'bill_retention_years') return n * 365 * value * 40;
  return 0;
}
