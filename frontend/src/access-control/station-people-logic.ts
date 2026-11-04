/**
 * WISKEY-PEOPLE-COMPLETE-2390: the pure part of the "people on stations only" view - one row per station user number across the
 * stations read so far, which stations an action goes to, the typed confirmation, and how a per-station result reads. No DOM, no
 * fetch (tests/unit-station-people-2390.spec.ts).
 */
import type { DuplicateGroup, StationUser, StepResult } from '../api/station-people';

export interface StationEntry extends StationUser {
  station_id: string;
  station_name: string;
}

export interface MergedRow {
  employee_no: string;
  /** The first non-empty name the stations report ('' when none does). */
  display_name: string;
  /** Every distinct non-empty name (a user number with two names on two stations is worth a look). */
  names: string[];
  stations: StationEntry[];
  first_seen_at: string;
  /** Every station of the row is ignored. */
  ignored: boolean;
  /** PIN on at least one station: true; on none: false; not shown on any: null. */
  pin: boolean | null;
  cards: number | null;
  biometric: boolean | null;
}

export type StationAction = 'adopt' | 'ignore' | 'unignore' | 'delete';

function presence(values: (boolean | null)[]): boolean | null {
  const shown = values.filter((v): v is boolean => v !== null);
  return shown.length ? shown.some(Boolean) : null;
}

/** One row per user number, stations in the order they were read; rows by name (unnamed last), then number. */
export function mergeStationUsers(perStation: { station: { id: string; name: string }; people: StationUser[] | null }[]): MergedRow[] {
  const rows = new Map<string, MergedRow>();
  for (const { station, people } of perStation) {
    for (const p of people ?? []) {
      const entry: StationEntry = { ...p, station_id: station.id, station_name: station.name };
      const row = rows.get(p.employee_no);
      if (!row) {
        rows.set(p.employee_no, {
          employee_no: p.employee_no, display_name: p.display_name, names: p.display_name ? [p.display_name] : [], stations: [entry],
          first_seen_at: p.first_seen_at, ignored: p.ignored, pin: p.pin, cards: p.cards, biometric: p.biometric,
        });
        continue;
      }
      row.stations.push(entry);
      if (!row.display_name && p.display_name) row.display_name = p.display_name;
      if (p.display_name && !row.names.includes(p.display_name)) row.names.push(p.display_name);
      if (p.first_seen_at < row.first_seen_at) row.first_seen_at = p.first_seen_at;
      row.ignored = row.ignored && p.ignored;
      row.pin = presence(row.stations.map((s) => s.pin));
      row.biometric = presence(row.stations.map((s) => s.biometric));
      const counts = row.stations.map((s) => s.cards).filter((c): c is number => c !== null);
      row.cards = counts.length ? counts.reduce((a, b) => a + b, 0) : null;
    }
  }
  return [...rows.values()].sort((a, b) => {
    if (!a.display_name !== !b.display_name) return a.display_name ? -1 : 1;
    return a.display_name.localeCompare(b.display_name, 'he') || a.employee_no.localeCompare(b.employee_no);
  });
}

/** The rows the view shows: ignored ones only when asked; a free-text filter on name or number. */
export function visibleRows(rows: MergedRow[], showIgnored: boolean, query = ''): MergedRow[] {
  const q = query.trim().toLocaleLowerCase('he');
  return rows.filter((r) => (showIgnored || !r.ignored) && (!q || r.employee_no.toLowerCase().includes(q) || r.names.some((n) => n.toLocaleLowerCase('he').includes(q))));
}

/** The stations an action on the row goes to: adopt - the stations where it can be adopted as is and is not ignored; ignore - those
 * not ignored yet; unignore - those ignored; delete - every station of the row (each is confirmed by the typed number). */
export function actionStations(row: MergedRow, action: StationAction): StationEntry[] {
  if (action === 'adopt') return row.stations.filter((s) => s.adoptable && !s.ignored);
  if (action === 'ignore') return row.stations.filter((s) => !s.ignored);
  if (action === 'unignore') return row.stations.filter((s) => s.ignored);
  return row.stations;
}

/** Why a row cannot be adopted as is (the first station's reason), or '' when at least one station can. */
export function adoptBlock(row: MergedRow): string {
  if (actionStations(row, 'adopt').length) return '';
  const reason = row.stations.find((s) => s.import_error)?.import_error;
  return reason ?? (row.stations.every((s) => s.ignored) ? 'ignored' : 'review_stale');
}

/** The typed confirmation of a delete: the user number exactly (surrounding spaces ignored). */
export function typedMatches(typed: string, employeeNo: string): boolean {
  return typed.trim() === employeeNo;
}

export type ResultTone = 'ok' | 'partial' | 'failed' | 'unknown';

/** How a per-station reply reads as a whole: every station ok; some ok and some not; none ok; or nothing is known for sure. */
export function resultTone(results: StepResult[]): ResultTone {
  if (!results.length) return 'failed';
  const ok = results.filter((r) => r.outcome === 'ok').length;
  if (ok === results.length) return 'ok';
  if (results.some((r) => r.outcome === 'unknown')) return 'unknown';
  return ok ? 'partial' : 'failed';
}

/** The duplicate groups worth a warning, the name groups first, and how many people they name. */
export function duplicateSummary(groups: DuplicateGroup[] | null | undefined): { groups: DuplicateGroup[]; people: number } {
  const list = groups ?? [];
  return { groups: list, people: new Set(list.flatMap((g) => g.people.map((p) => p.id))).size };
}

/** A typed PIN worth asking about: digits only, at least 4 (the check is rate limited per person; a shorter draft is not spent on). */
export function pinWorthChecking(pin: string | null | undefined): boolean {
  return typeof pin === 'string' && /^[0-9]{4,128}$/.test(pin);
}
