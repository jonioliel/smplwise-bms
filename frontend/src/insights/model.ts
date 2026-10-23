/**
 * CR-INSIGHT215: the pure logic of the insight screens (no DOM, no network) - month arithmetic, durations, the report's figures and
 * "not included" rows, the places tree of the door / waste lists, and the settings form with the server's bounds. Unit-tested.
 */
import type { DoorItem, DoorRow, DoorsAnswer, InsightSettings, OmitReason, RangeId, ReportModel, SectionId, WasteAnswer, WasteItem } from '../api/insights';
import { ix, type IxKey, type IxLang } from '../i18n/insights';

// ---------------------------------------------------------------- months

const MONTH = /^(\d{4})-(\d{2})$/;

/** `YYYY-MM` of a date in the given zone (the installation's zone when known, else the browser's). */
export function monthOf(d: Date, zone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit' }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${y}-${m}`;
}

/** The month the report opens on: the previous local month (the server's default). */
export function defaultMonth(now: Date, zone?: string): string {
  return shiftMonth(monthOf(now, zone), -1);
}

export function shiftMonth(month: string, delta: number): string {
  const m = MONTH.exec(month);
  if (!m) return month;
  const idx = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  return `${String(Math.floor(idx / 12)).padStart(4, '0')}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** The server refuses a month that has not started: the next-month button stops at the current month. */
export const canGoNext = (month: string, now: Date, zone?: string): boolean => shiftMonth(month, 1) <= monthOf(now, zone);

export function monthLabel(month: string, lang: IxLang = 'he'): string {
  const m = MONTH.exec(month);
  if (!m) return month;
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)));
}

// ---------------------------------------------------------------- numbers and durations

/** Minutes as `h:mm` ("2:45"); 0 and nothing read "-". */
export function fmtHM(minutes: number | null | undefined): string {
  if (!minutes || minutes < 0) return '-';
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Seconds as `m:ss` ("0:48"). */
export function fmtMS(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** `22.10 23:41` of an ISO instant in the zone (browser zone when none). */
export function fmtWhen(iso: string, zone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('day')}.${g('month')} ${g('hour').replace('24', '00')}:${g('minute')}`;
}

export function fmtClock(iso: string, zone?: string, seconds = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined, hour12: false }).formatToParts(d);
  return p.filter((x) => x.type !== 'literal' || x.value === ':').map((x) => (x.type === 'hour' ? x.value.replace('24', '00') : x.value)).join('');
}

/** The change in percent as the mockup writes it: the sign after the number in Hebrew ("6%-"), plain in English. */
export function fmtChange(pct: number | null | undefined, lang: IxLang): string {
  if (pct === null || pct === undefined) return '-';
  const n = `${Math.abs(pct).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
  if (pct === 0) return n;
  return lang === 'he' ? `${n}${pct < 0 ? '-' : '+'}` : `${pct < 0 ? '-' : '+'}${n}`;
}

// ---------------------------------------------------------------- the report

export const REASON_ICON: Record<OmitReason, 'lock' | 'power' | 'layers'> = { not_permitted: 'lock', switch_off: 'power', module_off: 'layers' };

export interface Figure {
  id: string;
  label: IxKey;
  value: string;
  unit?: IxKey;
  note?: string;
  tone?: 'up' | 'down' | 'muted';
}

/** The summary tiles of the preview: up to four, drawn from the sections the report holds, in a fixed order. */
export function reportFigures(model: ReportModel, lang: IxLang = model.lang): Figure[] {
  const d = model.data;
  const out: Figure[] = [];
  if (d.energy?.available && d.energy.total_kwh !== undefined) {
    const ch = d.energy.change_pct;
    out.push({ id: 'energy', label: 'fEnergy', value: fmtNum(d.energy.total_kwh), unit: 'kwh', note: ch === null || ch === undefined ? undefined : fmtChange(ch, lang), tone: ch === null || ch === undefined ? undefined : ch > 0 ? 'up' : ch < 0 ? 'down' : 'muted' });
  }
  if (d.tickets) out.push({ id: 'tickets', label: 'fTickets', value: fmtNum(d.tickets.opened), note: ix('closedOf', { n: d.tickets.closed }, lang), tone: 'muted' });
  if (d.doors?.configured) out.push({ id: 'doors', label: 'fDoors', value: fmtNum(d.doors.total.unexplained), note: ix('openings', undefined, lang) + ' ' + fmtNum(d.doors.total.openings), tone: 'muted' });
  if (d.temperature) out.push({ id: 'temp', label: 'fTemp', value: fmtNum(d.temperature.alarms), tone: d.temperature.alarms ? 'up' : 'muted' });
  if (out.length < 4 && d.elevators) out.push({ id: 'elevators', label: 'fElevators', value: fmtHM(d.elevators.down_min), tone: 'muted' });
  if (out.length < 4 && d.generator?.runs) out.push({ id: 'genRuns', label: 'fGenRuns', value: fmtNum(d.generator.runs.runs), note: `${fmtNum(d.generator.runs.hours, 1)} ${ix('hoursShort', undefined, lang)}`, tone: 'muted' });
  else if (out.length < 4 && d.generator) out.push({ id: 'generator', label: 'fGenerator', value: fmtNum(d.generator.total), tone: d.generator.critical ? 'up' : 'muted' });
  if (out.length < 4 && d.cameras) out.push({ id: 'cameras', label: 'fCameras', value: fmtNum(d.cameras.events), tone: 'muted' });
  return out.slice(0, 4);
}

/** Sections the user may pick: the ones the server did not leave out (those are listed, greyed, with their reason). */
export function pickable(all: readonly SectionId[], omitted: ReportModel['omitted'] | null): SectionId[] {
  const out = new Set((omitted ?? []).map((o) => o.section));
  return all.filter((s) => !out.has(s));
}

/** The sections that are drawn and downloaded: picked, and not left out by the server. */
export function chosen(all: readonly SectionId[], picked: ReadonlySet<SectionId>, omitted: ReportModel['omitted'] | null): SectionId[] {
  return pickable(all, omitted).filter((s) => picked.has(s));
}

/** A model with nothing in it: no section holds a number (the month has no data at all). */
export function reportEmpty(model: ReportModel): boolean {
  if (!model.sections.length) return true;
  const d = model.data;
  const any =
    (d.tickets && d.tickets.opened + d.tickets.closed + d.tickets.open_end > 0) ||
    (d.energy?.available && (d.energy.total_kwh ?? 0) > 0) ||
    (d.elevators && d.elevators.items.some((i) => i.has_data)) ||
    (d.generator && (d.generator.devices.length > 0 || (d.generator.runs?.devices.length ?? 0) > 0)) ||
    (d.temperature && d.temperature.units.length > 0) ||
    (d.doors?.configured && d.doors.total.openings > 0) ||
    (d.cameras && d.cameras.events > 0) ||
    (d.waste && (d.waste.minutes.empty_room + d.waste.minutes.after_hours + d.waste.anomalies > 0));
  return !any;
}

export const storedPicks = (raw: string | null, all: readonly SectionId[]): Set<SectionId> => {
  try {
    const list = JSON.parse(raw ?? 'null') as unknown;
    if (Array.isArray(list)) {
      const set = new Set(list.filter((s): s is SectionId => all.includes(s as SectionId)));
      if (set.size) return set;
    }
  } catch {
    /* unreadable: every section */
  }
  return new Set(all);
};

// ---------------------------------------------------------------- doors

export type DoorFilter = 'all' | 'unexplained' | 'unverifiable' | 'explained';
export interface DoorLine extends DoorItem {
  door: string;
  doorKey: string;
  area: string | null;
  floor: string | null;
  judgeable: boolean;
  id: string;
}

export function doorLines(a: DoorsAnswer, place: string): DoorLine[] {
  const out: DoorLine[] = [];
  for (const d of a.doors) {
    if (!inPlace(d, place)) continue;
    d.items.forEach((it, i) => out.push({ ...it, door: d.name, doorKey: d.key, area: d.area, floor: d.floor, judgeable: d.judgeable, id: `${d.key}:${i}:${it.at}` }));
  }
  return out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
}

export function doorCounts(a: DoorsAnswer, place: string): { unexplained: number; unverifiable: number; explained: number; all: number } {
  const rows = a.doors.filter((d) => inPlace(d, place));
  const sum = (k: 'unexplained' | 'unverifiable' | 'explained') => rows.reduce((n, d) => n + d[k], 0);
  const u = sum('unexplained');
  const v = sum('unverifiable');
  return { unexplained: u, unverifiable: v, explained: sum('explained'), all: u + v };
}

export const doorsConfigured = (a: DoorsAnswer): boolean => a.configured && a.doors.length > 0;

/** Where on the timeline strip the opening sits: `start` and `width` as percentages of [-before, duration + after]. */
export function timelineSpan(beforeS: number, afterS: number, durationS: number): { start: number; width: number; total: number } {
  const dur = Math.max(1, durationS);
  const total = beforeS + dur + afterS;
  return { start: (beforeS / total) * 100, width: Math.max(2, (dur / total) * 100), total };
}

// ---------------------------------------------------------------- the places tree of the lists

export interface PlaceNode {
  id: string;
  kind: 'all' | 'floor' | 'area' | 'none';
  name: string;
  depth: 0 | 1;
  count: number;
  dot: null;
  open?: boolean;
}
interface Placed {
  /** How much the row weighs in the tree's counts (default 1). */
  w?: number;
  floor: string | null;
  area: string | null;
}
const cnt = (xs: readonly Placed[]): number => xs.reduce((n, r) => n + (r.w ?? 1), 0);
export const ALL_PLACES = 'all';
const NONE = 'none';
const floorId = (f: string) => `floor:${f}`;
const areaId = (f: string | null, a: string) => `area:${f ?? ''}|${a}`;

/** The tree of the list: "all", then the floors (collapsible) with their areas, then rows with no place. Places that hold no row are left out. */
export function placeTree(rows: readonly Placed[], collapsed: ReadonlySet<string> = new Set(), allLabel = ix('allBuilding'), noneLabel = ix('noPlace')): PlaceNode[] {
  if (!rows.length) return [];
  const out: PlaceNode[] = [{ id: ALL_PLACES, kind: 'all', name: allLabel, depth: 0, count: cnt(rows), dot: null }];
  const floors = [...new Set(rows.filter((r) => r.floor).map((r) => r.floor as string))];
  for (const f of floors) {
    const inFloor = rows.filter((r) => r.floor === f);
    const id = floorId(f);
    out.push({ id, kind: 'floor', name: f, depth: 0, count: cnt(inFloor), dot: null, open: !collapsed.has(id) });
    if (collapsed.has(id)) continue;
    for (const a of [...new Set(inFloor.filter((r) => r.area).map((r) => r.area as string))]) {
      out.push({ id: areaId(f, a), kind: 'area', name: a, depth: 1, count: cnt(inFloor.filter((r) => r.area === a)), dot: null });
    }
  }
  const noFloor = rows.filter((r) => !r.floor);
  for (const a of [...new Set(noFloor.filter((r) => r.area).map((r) => r.area as string))]) {
    out.push({ id: areaId(null, a), kind: 'area', name: a, depth: 0, count: cnt(noFloor.filter((r) => r.area === a)), dot: null });
  }
  const none = noFloor.filter((r) => !r.area);
  if (none.length) out.push({ id: NONE, kind: 'none', name: noneLabel, depth: 0, count: cnt(none), dot: null });
  return out;
}

export function inPlace(r: Placed, place: string): boolean {
  if (place === ALL_PLACES) return true;
  if (place === NONE) return !r.floor && !r.area;
  if (place.startsWith('floor:')) return r.floor === place.slice(6);
  if (place.startsWith('area:')) return areaId(r.floor, r.area ?? '') === place;
  return true;
}

export const placeLabel = (tree: readonly PlaceNode[], place: string): string => tree.find((n) => n.id === place)?.name ?? ix('allBuilding');

// ---------------------------------------------------------------- waste

export type WasteFilter = 'all' | 'empty_room' | 'after_hours' | 'night';
export function wasteLines(a: WasteAnswer, place: string, filter: WasteFilter): WasteItem[] {
  if (filter === 'night') return [];
  return a.devices.items.filter((i) => inPlace(i, place) && (filter === 'all' || i.kind === filter)).sort((x, y) => y.minutes - x.minutes);
}
export function wasteCounts(a: WasteAnswer, place: string): Record<WasteFilter, number> {
  const rows = a.devices.items.filter((i) => inPlace(i, place));
  const e = rows.filter((i) => i.kind === 'empty_room').length;
  const h = rows.filter((i) => i.kind === 'after_hours').length;
  const n = a.energy.items.length;
  return { all: e + h, empty_room: e, after_hours: h, night: n };
}
export const deviceLabel = (domain: string): IxKey => (domain === 'climate' ? 'dom_climate' : domain === 'fan' ? 'dom_fan' : domain === 'switch' ? 'dom_switch' : 'dom_light');

/** The local range an insight asks for: a preset, or a custom `from`/`to` of whole days in UTC. */
export function customRange(from: string, to: string): { range: RangeId; from?: string; to?: string } {
  if (!from) return { range: '7d' };
  const f = new Date(`${from}T00:00:00`).toISOString();
  const t = to ? new Date(`${to}T23:59:59`).toISOString() : undefined;
  return { range: 'custom', from: f, ...(t ? { to: t } : {}) };
}

// ---------------------------------------------------------------- the settings form

export type NumKey = 'before_s' | 'after_s' | 'min_open_s' | 'empty_after_min' | 'min_waste_min' | 'night_min_min' | 'energy_factor' | 'energy_min_kwh' | 'baseline_weeks' | 'baseline_min_coverage' | 'min_run_s';
/** The server's bounds (insights_common._NUM), so a field can say its range before and after a 422. */
export const BOUNDS: Record<NumKey, { group: 'doors' | 'waste' | 'generator'; lo: number; hi: number }> = {
  before_s: { group: 'doors', lo: 5, hi: 300 },
  after_s: { group: 'doors', lo: 0, hi: 120 },
  min_open_s: { group: 'doors', lo: 0, hi: 60 },
  empty_after_min: { group: 'waste', lo: 5, hi: 240 },
  min_waste_min: { group: 'waste', lo: 5, hi: 720 },
  night_min_min: { group: 'waste', lo: 10, hi: 720 },
  energy_factor: { group: 'waste', lo: 1.1, hi: 10 },
  energy_min_kwh: { group: 'waste', lo: 0.1, hi: 1000 },
  baseline_weeks: { group: 'waste', lo: 2, hi: 8 },
  baseline_min_coverage: { group: 'waste', lo: 0.5, hi: 1 },
  min_run_s: { group: 'generator', lo: 0, hi: 3600 },
};

export interface SettingsForm {
  nums: Record<NumKey, string>;
  nightFrom: string;
  nightTo: string;
  domains: string[];
  pairs: InsightSettings['doors']['pairs'];
}

export function toForm(s: InsightSettings): SettingsForm {
  const nums = {} as Record<NumKey, string>;
  for (const [k, b] of Object.entries(BOUNDS) as [NumKey, (typeof BOUNDS)[NumKey]][]) nums[k] = String((s[b.group] as unknown as Record<string, number>)[k]);
  return { nums, nightFrom: s.waste.night_from, nightTo: s.waste.night_to, domains: [...s.waste.domains], pairs: s.doors.pairs.map((p) => ({ ...p, rex_entity_ids: [...p.rex_entity_ids] })) };
}

/** The document the server validates whole. A non-numeric field is left as NaN so the server names it (422) like any other bad value. */
export function fromForm(f: SettingsForm, base: InsightSettings): InsightSettings {
  const doc: InsightSettings = { doors: { ...base.doors, pairs: f.pairs }, waste: { ...base.waste, domains: f.domains, night_from: f.nightFrom, night_to: f.nightTo }, generator: { ...base.generator }, report: base.report };
  for (const [k, b] of Object.entries(BOUNDS) as [NumKey, (typeof BOUNDS)[NumKey]][]) {
    const raw = f.nums[k].trim().replace(',', '.');
    (doc[b.group] as unknown as Record<string, number>)[k] = raw === '' ? Number.NaN : Number(raw);
  }
  return doc;
}

/** Fields a 422 named that belong to one input: `doors.min_open_s` -> 'min_open_s'. */
export function numErrors(fields: readonly string[]): Set<NumKey> {
  const out = new Set<NumKey>();
  for (const f of fields) {
    const k = f.split('.')[1] as NumKey | undefined;
    if (k && k in BOUNDS && BOUNDS[k].group === f.split('.')[0]) out.add(k);
  }
  return out;
}

export const fieldHint = (k: NumKey): string => ix('fieldRange', { lo: BOUNDS[k].lo, hi: BOUNDS[k].hi });
export const hasField = (fields: readonly string[], prefix: string): boolean => fields.some((f) => f === prefix || f.startsWith(`${prefix}.`) || f.startsWith(`${prefix}[`));

/** True when a door row came back with nothing to list (used by the unit specs and the empty state). */
export const doorRowQuiet = (d: DoorRow): boolean => d.unexplained === 0 && d.unverifiable === 0;
