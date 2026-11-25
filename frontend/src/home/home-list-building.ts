// MULTI-BUILDING-FILTER-2520 (2.52, T119 MB-HOME-IFACE step 7): the building filter of the home interface's lists - the notice board and
// the calendar's shared rooms - on a multi-building site. DOM-free (tests/unit-mb-filter-2520.spec.ts).
//
// The same filter as the full interface's lists (components/building-filter-logic.ts, MULTI-BUILDING-NEXT-2500): the server answers
// `building_filter` (the buildings the caller's items sit in, the shared building last) ONLY while the multi-building switch and the filter
// setting are on and the caller's items sit in two or more buildings - otherwise no control is drawn and the list is the list of before.
// Each item then names the buildings it serves; an item in no building (a notice for everyone) shows under every building. DISPLAY only:
// it narrows what the person already sees and never grants anything.
//
// The home's own rule (design step 7): a list opens on the building the home interface shows (its building button; "כל הבניינים" = every
// building), when the list offers it; else on the device's last choice of a list (one key with the full interface's lists); else on every
// building. A wall panel locked to its room draws no control: its lists follow the panel's building (when offered), never another choice
// made on the device.
import { BF_ALL, filterKeys, pickChosen, saveChosen, type BuildingFilterMeta } from '../components/building-filter-logic';
import { ALL } from './home-buildings';

/** The building a home list opens on ('' = every building, or no filter). `homeBld` is the home interface's chosen building ('' / ALL = none). */
export function homeListChoice(meta: BuildingFilterMeta | null | undefined, homeBld: string, locked: boolean, remembered: string): string {
  if (!meta || meta.buildings.length < 2) return BF_ALL;
  const offered = (id: string) => !!id && meta.buildings.some((b) => b.id === id);
  if (homeBld === ALL) return BF_ALL; // the home shows every building: so does the list
  if (offered(homeBld)) return homeBld;
  if (locked) return BF_ALL;
  return pickChosen(meta, remembered);
}

/** One home list's filter: the server's meta and the choice a person made in it (kept while the home stays on the same building). */
export class HomeListFilter {
  meta: BuildingFilterMeta | null = null;
  private pick: { home: string; value: string } | null = null;

  /** The list's answer arrived: its `building_filter` (absent = no filter). */
  set(meta: BuildingFilterMeta | null | undefined): void {
    this.meta = meta && meta.buildings.length >= 2 ? meta : null;
  }

  /** The chosen building ('' = every building). A choice made in the list holds until the home's building changes or it is no longer offered. */
  value(homeBld: string, locked: boolean, remembered: string): string {
    const m = this.meta;
    if (!m) return BF_ALL;
    const p = this.pick;
    if (!locked && p && p.home === homeBld && (p.value === BF_ALL || m.buildings.some((b) => b.id === p.value))) return p.value;
    return homeListChoice(m, homeBld, locked, remembered);
  }

  /** A press on the list's control: kept for this list and remembered on the device (the full interface's key). */
  choose(homeBld: string, value: string): void {
    this.pick = { home: homeBld, value };
    saveChosen(value);
  }

  /** Whether the control is drawn: a filter answered and not a locked wall panel. */
  drawn(locked: boolean): boolean {
    return !!this.meta && !locked;
  }

  /** The control's keys: every building (the home's own words) then the buildings in the server's order. */
  keys(allLabel: string): [string, string][] {
    if (!this.meta) return [];
    return filterKeys(this.meta).map((k): [string, string] => [k.value, k.value === BF_ALL ? allLabel : k.label]);
  }
}
