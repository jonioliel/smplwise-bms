/**
 * DEVTYPE (owner 2026-10-09): the pure logic of הגדרות › חשמל והתקנים › סוגי התקנים - the Hebrew names of the types, the filters, what a
 * group change sends and the result line. The server owns the rule (GET /devices/device-types lists the switch-wired devices with the
 * types each may take); this module never guesses a type from a name. No Lit and no DOM, so the unit specs import it directly.
 */
export type FixedKind = 'switch' | 'outlet' | 'light' | 'fan' | 'heater' | 'water_heater' | 'valve';
export type TypeSetting = FixedKind | 'auto';

export interface DeviceTypeRow {
  entity_id: string;
  name: string;
  domain: string;
  device_class: string | null;
  area_id: string | null;
  area_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  state: string | null;
  available: boolean;
  /** The type now: the fixed one, else the automatic one. */
  kind: FixedKind;
  /** The type the name (or the outlet device class) gives. */
  auto: FixedKind;
  /** The administrator's fixed type, or null = automatic. */
  set: FixedKind | null;
  /** The types this device may take (a virtual helper is never an outlet). */
  options: FixedKind[];
  set_by: string | null;
  set_at: string | null;
}

export const KIND_ORDER: readonly FixedKind[] = ['switch', 'outlet', 'light', 'fan', 'heater', 'water_heater', 'valve'];
export const KIND_HE: Record<FixedKind, string> = {
  switch: 'מתג',
  outlet: 'שקע',
  light: 'תאורה',
  fan: 'מאוורר',
  heater: 'תנור חימום',
  water_heater: 'דוד מים',
  valve: 'ברז / השקיה',
};

export type SourceFilter = '' | 'auto' | 'manual';
export interface TypeFilters {
  q: string;
  kind: '' | FixedKind;
  source: SourceFilter;
  floor: string;
  area: string;
}
export const NO_TYPE_FILTERS: TypeFilters = { q: '', kind: '', source: '', floor: '', area: '' };

export const typeFiltersActive = (f: TypeFilters): boolean => Boolean(f.q.trim() || f.kind || f.source || f.floor || f.area);

/** The rows the filters leave, in the server's order (by name). The search reads the name, the place and the id. */
export function applyTypeFilters(rows: readonly DeviceTypeRow[], f: TypeFilters): DeviceTypeRow[] {
  const q = f.q.trim().toLocaleLowerCase();
  return rows.filter((r) => {
    if (f.kind && r.kind !== f.kind) return false;
    if (f.source === 'manual' && r.set === null) return false;
    if (f.source === 'auto' && r.set !== null) return false;
    if (f.floor && r.floor_id !== f.floor) return false;
    if (f.area && r.area_id !== f.area) return false;
    if (q && ![r.name, r.entity_id, r.area_name ?? '', r.floor_name ?? ''].some((s) => s.toLocaleLowerCase().includes(q))) return false;
    return true;
  });
}

/** What a group change sends: the selected rows that would change. `auto` reaches the fixed ones only; a type reaches the rows that may
 * take it and do not have it fixed already. `skipped` = selected rows that cannot take the type (a virtual helper and "שקע"). */
export function bulkTargets(rows: readonly DeviceTypeRow[], selected: ReadonlySet<string>, kind: TypeSetting): { ids: string[]; skipped: number } {
  const chosen = rows.filter((r) => selected.has(r.entity_id));
  if (kind === 'auto') return { ids: chosen.filter((r) => r.set !== null).map((r) => r.entity_id), skipped: 0 };
  const able = chosen.filter((r) => r.options.includes(kind));
  return { ids: able.filter((r) => r.set !== kind).map((r) => r.entity_id), skipped: chosen.length - able.length };
}

/** Shift+click: every row between the last clicked one and this one (in the filtered order). */
export function rangeIds(list: readonly DeviceTypeRow[], last: string | null, id: string): string[] {
  const a = last ? list.findIndex((r) => r.entity_id === last) : -1;
  const b = list.findIndex((r) => r.entity_id === id);
  if (a < 0 || b < 0) return [id];
  return list.slice(Math.min(a, b), Math.max(a, b) + 1).map((r) => r.entity_id);
}

export const CHUNK = 500;
export function chunks<T>(ids: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export const settingLabel = (kind: TypeSetting): string => (kind === 'auto' ? 'אוטומטי' : KIND_HE[kind]);

export function confirmQuestion(kind: TypeSetting, count: number): string {
  return kind === 'auto' ? `להחזיר ${count} התקנים לסוג אוטומטי (לפי השם)?` : `לקבוע את הסוג "${KIND_HE[kind]}" ל־${count} התקנים?`;
}

export function resultLine(kind: TypeSetting, changed: number, refused: number): string {
  const head = kind === 'auto' ? `${changed} התקנים חזרו לסוג אוטומטי` : `נקבע הסוג "${KIND_HE[kind]}" ל־${changed} התקנים`;
  return refused ? `${head}. ${refused} לא שונו.` : `${head}.`;
}
