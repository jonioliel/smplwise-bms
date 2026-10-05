/**
 * K88: room ↔ area links. A plan room may point at one area of the device tree; the settings table proposes matches
 * by name and applies the ticked ones in one call; the editor's room panel sets one room. Local link only - the
 * platform's registry is never written.
 */
import { get, post } from './client';

export interface PlanArea {
  area_id: string;
  name: string;
  floor_id: string | null;
  floor_name: string | null;
}

export interface AreaLinkRow {
  zone_id: string;
  zone_name: string;
  kind: string;
  revision: number;
  floor_id: string;
  floor_name: string;
  floor_level: number | null;
  building_name: string;
  area_id: string | null;
  area_name: string | null;
  /** The stored link names an area the registry no longer has. */
  dangling: boolean;
  suggestion: { area_id: string; area_name: string; score: number } | null;
  status: 'linked' | 'suggested' | 'none';
}

export interface AreaLinksTable {
  rows: AreaLinkRow[];
  areas: PlanArea[];
  counts: { linked: number; suggested: number; none: number; dangling: number };
}

export interface AreaLinkChange {
  zone_id: string;
  /** null / '' clears the link. */
  area_id: string | null;
  revision?: number;
}

export const getPlanAreas = (floorId?: string) => get<{ areas: PlanArea[] }>(floorId ? `plan/areas?floor_id=${encodeURIComponent(floorId)}` : 'plan/areas');
export const getAreaLinks = (floorId?: string) => get<AreaLinksTable>(floorId ? `plan/area-links?floor_id=${encodeURIComponent(floorId)}` : 'plan/area-links');
export const applyAreaLinks = (links: AreaLinkChange[]) => post<AreaLinksTable & { changed: number }>('plan/area-links', { links });

/** The map route that shows a linked room: the plan floor with the room focused. */
export const mapHrefForArea = (link: { floor_id: string; zone_id: string } | null | undefined): string | null =>
  link ? `#/explore/floors/${encodeURIComponent(link.floor_id)}?zone=${encodeURIComponent(link.zone_id)}` : null;
