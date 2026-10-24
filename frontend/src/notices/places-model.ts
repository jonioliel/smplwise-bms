import type { Notice } from '../api/notices';
import { nt } from '../i18n/notices';

/**
 * NOTICEPAGE-295 (CR-NOTICE106 section 9, the owner's standing rule "keep the area tree in every design"): the places tree of the
 * notices page - the whole building, then the floors (grouped by building when the installation has more than one), each floor
 * collapsible over its named areas, with the number of notices tagged to it. A node filters the list; on the phone the same nodes
 * are one select. A notice belongs to the places its audience names (a floor, or an area which also counts for its floor); a notice
 * "for everyone" or for groups / roles belongs to the whole building only (the audience reaches people, not rooms).
 */

export type PlaceKind = 'all' | 'building' | 'floor' | 'area';
export type PlaceLook = 'ok' | 'warn' | 'alarm' | 'acc';

export interface PlaceNode {
  id: string;
  name: string;
  kind: PlaceKind;
  depth: 0 | 1 | 2;
  count: number;
  /** the loudest severity among the notices of an area (the mockup's dot) */
  look?: PlaceLook;
  /** the node has children that can be folded away */
  foldable: boolean;
  parent: string;
}

export interface FloorOpt { id: string; name: string; building: string }
export interface AreaOpt { id: string; name: string; floor: string }

export const PLACE_ALL = 'all';
const RANK: Record<PlaceLook, number> = { acc: 1, ok: 1, warn: 2, alarm: 3 };
const LOOK_OF: Record<Notice['severity'], PlaceLook> = { info: 'acc', alert: 'warn', critical: 'alarm' };

/** The place ids a notice is tagged to: the floors and areas of its audience, the floor of each area, and (when there are several) the building of each floor. */
export function placesOfNotice(n: Notice, floors: readonly FloorOpt[], areas: readonly AreaOpt[], multiBuilding: boolean): Set<string> {
  const out = new Set<string>();
  const a = n.audience;
  if (!a) return out;
  for (const f of a.floors ?? []) out.add('f:' + f);
  for (const id of a.areas ?? []) {
    out.add('a:' + id);
    const fl = areas.find((x) => x.id === id)?.floor;
    if (fl) out.add('f:' + fl);
  }
  if (multiBuilding) {
    for (const f of floors) if (out.has('f:' + f.id)) out.add('b:' + f.building);
  }
  return out;
}

/** Whether a notice shows under the chosen node (`all` shows everything). */
export function inPlace(n: Notice, place: string, floors: readonly FloorOpt[], areas: readonly AreaOpt[]): boolean {
  if (place === PLACE_ALL) return true;
  const multi = new Set(floors.map((f) => f.building)).size > 1;
  return placesOfNotice(n, floors, areas, multi).has(place);
}

/** The tree for the notices that are listable at all (the caller passes the base set, not the filtered rows). */
export function buildPlaces(notices: readonly Notice[], floors: readonly FloorOpt[], areas: readonly AreaOpt[]): PlaceNode[] {
  const buildings = [...new Set(floors.map((f) => f.building))];
  const multi = buildings.length > 1;
  const tags = notices.map((n) => ({ n, set: placesOfNotice(n, floors, areas, multi) }));
  const count = (id: string) => tags.filter((t) => t.set.has(id)).length;
  const look = (id: string): PlaceLook | undefined => {
    let best: PlaceLook | undefined;
    for (const t of tags) {
      if (!t.set.has(id)) continue;
      const l = LOOK_OF[t.n.severity];
      if (!best || RANK[l] > RANK[best]) best = l;
    }
    return best;
  };
  const out: PlaceNode[] = [{ id: PLACE_ALL, name: nt('allPlaces'), kind: 'all', depth: 0, count: notices.length, foldable: false, parent: '' }];
  const floorNodes = (list: readonly FloorOpt[], depth: 0 | 1, parent: string) => {
    for (const f of list) {
      const kids = areas.filter((a) => a.floor === f.id);
      out.push({ id: 'f:' + f.id, name: f.name, kind: 'floor', depth, count: count('f:' + f.id), foldable: kids.length > 0, parent });
      for (const a of kids) out.push({ id: 'a:' + a.id, name: a.name, kind: 'area', depth: (depth + 1) as 1 | 2, count: count('a:' + a.id), look: look('a:' + a.id), foldable: false, parent: 'f:' + f.id });
    }
  };
  if (multi) {
    for (const b of buildings) {
      out.push({ id: 'b:' + b, name: b, kind: 'building', depth: 0, count: count('b:' + b), foldable: true, parent: '' });
      floorNodes(floors.filter((f) => f.building === b), 1, 'b:' + b);
    }
  } else {
    floorNodes(floors, 0, '');
  }
  return out;
}

/** The nodes drawn now: a folded node hides every descendant. */
export function visibleNodes(nodes: readonly PlaceNode[], folded: ReadonlySet<string>): PlaceNode[] {
  const hidden = new Set<string>();
  return nodes.filter((n) => {
    if (n.parent && (folded.has(n.parent) || hidden.has(n.parent))) {
      hidden.add(n.id);
      return false;
    }
    return true;
  });
}
