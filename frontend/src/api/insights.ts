/**
 * CR-INSIGHT215 (2.15.0): the ONLY module of the frontend that talks to `/api/v1/insights/...` and `/api/v1/reports/building...`
 * (smplwise_vms/backend/smplwise/routers/insights.py). Read-only: nothing here is ever sent to a device. A switched-off part answers the
 * uniform 404 - `isOff()` tells that apart from a real failure. Door and waste rows carry names, never entity ids; the settings route (for
 * its managers) is the one exception: the door pairs are entity ids by nature.
 */
import { ApiError, apiUrl, get, put, type ApiErrorBody } from './client';
import { dispositionName, saveBlob } from './tickets-costs';

export type SectionId = 'summary' | 'tickets' | 'energy' | 'elevators' | 'generator' | 'temperature' | 'doors' | 'cameras' | 'waste';
export const SECTION_IDS: readonly SectionId[] = ['summary', 'tickets', 'energy', 'elevators', 'generator', 'temperature', 'doors', 'cameras', 'waste'];
export type OmitReason = 'not_permitted' | 'module_off' | 'switch_off';
export type SwitchKey = 'insights.doors.enabled' | 'insights.waste.enabled' | 'reports.building.enabled';
export const SWITCH_KEYS: readonly SwitchKey[] = ['insights.doors.enabled', 'insights.waste.enabled', 'reports.building.enabled'];
export type RangeId = '24h' | '7d' | '30d' | 'custom';

// ---------------------------------------------------------------- navigation status

export interface InsightsStatus {
  doors: boolean;
  waste: boolean;
  report: boolean;
}
export const getStatus = () => get<InsightsStatus>('insights/status');

// ---------------------------------------------------------------- settings

export interface DoorPair {
  sensor_entity_id: string;
  lock_entity_id: string | null;
  rex_entity_ids: string[];
  invert: boolean;
}
export interface InsightSettings {
  doors: { before_s: number; after_s: number; min_open_s: number; pairs: DoorPair[] };
  waste: {
    empty_after_min: number;
    min_waste_min: number;
    night_min_min: number;
    energy_factor: number;
    energy_min_kwh: number;
    baseline_weeks: number;
    baseline_min_coverage: number;
    domains: string[];
    night_from: string;
    night_to: string;
  };
  report: { sections: SectionId[] };
}
export interface SettingsAnswer {
  settings: InsightSettings;
  switches: Record<SwitchKey, boolean>;
  can_switch: boolean;
  sections: SectionId[];
  domains: string[];
}
export const getSettings = () => get<SettingsAnswer>('insights/settings');
export const putSettings = (body: { settings?: InsightSettings; switches?: Partial<Record<SwitchKey, boolean>> }) => put<SettingsAnswer>('insights/settings', body);

/** The fields a 422 names (`details.fields`: `doors.min_open_s`, `doors.pairs[0].lock_entity_id`, ...); [] for any other error. */
export function fieldErrors(err: unknown): string[] {
  if (!(err instanceof ApiError) || err.status !== 422) return [];
  const f = err.body.details?.fields;
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === 'string') : [];
}

/** The uniform 404 of a switched-off part. */
export const isOff = (err: unknown): boolean => err instanceof ApiError && err.status === 404;

// ---------------------------------------------------------------- doors

export type Verdict = 'explained' | 'unexplained' | 'unverifiable';
export type EvidenceReason = 'lock' | 'unlocked' | 'command' | 'rex' | 'window';
export interface DoorItem {
  at: string;
  duration_s: number;
  open_at_end: boolean;
  verdict: Exclude<Verdict, 'explained'>;
  why: 'no_lock_or_exit' | 'lock_unknown' | null;
}
export interface DoorRow {
  key: string;
  name: string;
  area: string | null;
  floor: string | null;
  openings: number;
  explained: number;
  unexplained: number;
  unverifiable: number;
  by_reason: Record<EvidenceReason, number>;
  judgeable: boolean;
  items: DoorItem[];
  items_more: number;
}
export interface DoorsAnswer {
  from: string;
  to: string;
  window: { before_s: number; after_s: number };
  doors: DoorRow[];
  total: { openings: number; explained: number; unexplained: number; unverifiable: number };
  ranking: { key: string; name: string; unexplained: number }[];
  configured: boolean;
}

export interface RangeQuery {
  range: RangeId;
  from?: string;
  to?: string;
}
const rangeQs = (q: RangeQuery) => {
  const p = new URLSearchParams({ range: q.range });
  if (q.range === 'custom') {
    if (q.from) p.set('from', q.from);
    if (q.to) p.set('to', q.to);
  }
  return p.toString();
};
export const getDoors = (q: RangeQuery) => get<DoorsAnswer>(`insights/doors?${rangeQs(q)}`);

// ---------------------------------------------------------------- waste

export type WasteKind = 'empty_room' | 'after_hours';
export interface WasteItem {
  key: string;
  kind: WasteKind;
  name: string;
  area: string | null;
  floor: string | null;
  domain: string;
  minutes: number;
  segments: number;
  longest_min: number;
  first_at: string;
  last_at: string;
}
export interface EnergyAnomaly {
  key: string;
  kind: 'energy';
  name: string;
  night: string;
  from: string;
  to: string;
  kwh: number;
  baseline_kwh: number;
  ratio: number | null;
  baseline_nights: number;
}
export interface WasteAnswer {
  from: string;
  to: string;
  zone: string;
  night: { from: string; to: string };
  devices: { items: WasteItem[]; items_more: number; judged: number; truncated: boolean; minutes: { empty_room: number; after_hours: number } };
  energy: { available: boolean; items: EnergyAnomaly[]; items_more?: number; meters: number };
}
export const getWaste = (q: RangeQuery) => get<WasteAnswer>(`insights/waste?${rangeQs(q)}`);

// ---------------------------------------------------------------- the building report

export interface OmittedSection {
  section: SectionId;
  reason: OmitReason;
}
export interface ReportData {
  summary?: { section: SectionId; title: string; text: string }[];
  tickets?: {
    opened: number;
    closed: number;
    open_end: number;
    overdue: number;
    median_close_h: number | null;
    by_department: { name: string; opened: number; closed: number }[];
    oldest_open: { number: number | string; department: string; age_days: number }[];
    truncated: boolean;
  };
  energy?: {
    available: boolean;
    meters: { name: string; kwh: number | null; prev_kwh: number | null; last_year_kwh: number | null; coverage: number }[];
    total_kwh?: number;
    prev_total_kwh?: number;
    change_pct?: number | null;
  };
  elevators?: { items: { name: string; fault_min: number; out_min: number; fire_min: number; history_from: string | null; has_data: boolean }[]; down_min: number };
  generator?: { devices: { name: string; critical: number; alert: number; info: number; total: number; top: { key: string; count: number }[] }[]; total: number; critical: number };
  temperature?: { units: { name: string; alarms: number; warnings: number; out_min: number; offline: number }[]; alarms: number; out_min: number };
  doors?: {
    configured: boolean;
    total: { openings: number; explained: number; unexplained: number; unverifiable: number };
    ranking: { key: string; name: string; unexplained: number }[];
    doors: { name: string; openings: number; unexplained: number; unverifiable: number }[];
  };
  cameras?: { events: number; minutes: number; top: { name: string | null; count: number; minutes: number }[] };
  waste?: {
    minutes: { empty_room: number; after_hours: number };
    top: WasteItem[];
    anomalies: number;
    anomaly_top: EnergyAnomaly[];
  };
}
export interface ReportModel {
  v: number;
  lang: 'he' | 'en';
  month: string;
  zone: string;
  from: number;
  to: number;
  generated: number;
  sections: SectionId[];
  omitted: OmittedSection[];
  data: ReportData;
  digest: string;
  filename: string;
}
export interface ReportQuery {
  month?: string;
  sections?: readonly SectionId[];
  lang: 'he' | 'en';
}
const reportQs = (q: ReportQuery) => {
  const p = new URLSearchParams({ lang: q.lang });
  if (q.month) p.set('month', q.month);
  if (q.sections) p.set('sections', q.sections.join(','));
  return p.toString();
};
export const getReport = (q: ReportQuery) => get<ReportModel>(`reports/building/preview?${reportQs(q)}`);

/** The PDF through the browser's own download. A failure throws the server's ApiError (503 `pdf_*`, 422 too large, 404 off, 403). */
export async function downloadReportPdf(q: ReportQuery): Promise<void> {
  const res = await fetch(apiUrl(`reports/building.pdf?${reportQs(q)}`), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(res.status, body ?? { code: `http_${res.status}`, user_message: res.statusText, retryable: false, correlation_id: '', details: {} });
  }
  saveBlob(await res.blob(), dispositionName(res.headers.get('Content-Disposition'), `building-report-${q.month ?? 'last'}.pdf`));
}
