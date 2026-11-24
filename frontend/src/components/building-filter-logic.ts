// MULTI-BUILDING-NEXT-2500 (owner 22.11, Q67 and Q69 "then the filtering"; T119 design row MB-SCREENS-FILTER): the building filter of the
// full interface's lists on a multi-building site - the energy meters, the schedules, the calendar's shared rooms, the plan editor's
// device search and the global search. DOM-free (tests/unit-mb-next-2500.spec.ts).
//
// The server decides everything that matters (services/building_filter.py): a list answers `building_filter` (the buildings the caller's
// items sit in, the chosen one) ONLY while the multi-building switch and the filter setting are on and those items sit in two or more
// buildings - otherwise the answer is the one of before and no control is drawn. Each item then names the buildings it serves
// (`buildings`): its areas' / floor's buildings, every building for an item of the shared building ("בניין משותף"). The filter is
// DISPLAY only: it narrows what the caller already sees and never grants anything.
import { tr } from '../i18n/msg/components';

interface BfChoice { id: string; name: string; is_shared: boolean }
/** The `building_filter` key of a list answer (wire/building_filter.py). */
export interface BuildingFilterMeta { buildings: BfChoice[]; building: string | null }

/** "כל האתר": no building chosen. */
export const BF_ALL = '';
const KEY = 'sw.building_filter';

/** The building last chosen on this device (shared by the lists: a manager of one tower keeps it across screens). */
export function readChosen(): string {
  try { return localStorage.getItem(KEY) ?? BF_ALL; } catch { return BF_ALL; }
}

export function saveChosen(id: string): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* storage off: the list opens on the whole site next time */ }
}

/** The building a list opens on: the device's last choice when this list offers it, else the whole site. '' with no filter. */
export function pickChosen(meta: BuildingFilterMeta | null | undefined, remembered: string): string {
  if (!meta || meta.buildings.length < 2) return BF_ALL;
  return meta.buildings.some((b) => b.id === remembered) ? remembered : BF_ALL;
}

/** Whether an item serving `served` shows under the chosen building: everything under "כל האתר"; an item in no building (the mapping
 * places it nowhere) shows under every building, as on the server. */
export function shows(served: readonly string[] | null | undefined, chosen: string): boolean {
  return !chosen || !served || served.length === 0 || served.includes(chosen);
}

/** Narrow a list (items carrying `buildings`) to the chosen building. */
export function keepBuilding<T extends { buildings?: readonly string[] | null }>(items: readonly T[], chosen: string): T[] {
  return chosen ? items.filter((i) => shows(i.buildings, chosen)) : [...items];
}

/** Q67: the other buildings an item serves, by name ('' when it serves only the chosen one, or under "כל האתר"). */
export function alsoNote(served: readonly string[] | null | undefined, chosen: string, meta: BuildingFilterMeta | null | undefined): string {
  if (!chosen || !served || !meta || !served.includes(chosen)) return '';
  const names = served.filter((id) => id !== chosen).map((id) => meta.buildings.find((b) => b.id === id)?.name).filter((n): n is string => !!n);
  return names.length ? tr('גם ב{names}', { names: names.join(tr(' וב')) }) : '';
}

/** The keys of the control: "כל האתר" then the buildings (the server's order: the shared building last). */
export function filterKeys(meta: BuildingFilterMeta): { value: string; label: string }[] {
  return [{ value: BF_ALL, label: tr('כל האתר') }, ...meta.buildings.map((b) => ({ value: b.id, label: b.name }))];
}

/** The query parameter of a list read on the server (the plan editor's search, the global search): '' = none. */
export function buildingParam(chosen: string): Record<string, string> {
  return chosen ? { building: chosen } : {};
}
