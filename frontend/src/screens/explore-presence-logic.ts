/** WHOIN034-295: the pure parts of "מי במבנה" (screens/explore-presence.ts), kept free of Lit so the unit specs import them in Node. */
import type { PlanZone } from '../map/sw-plan-canvas';
import type { MapBundle } from '../api/maps';
import { zoneOccupancy, type PeopleFloor } from '../api/presence';
import { pt } from '../i18n/presence';

/** "now" / "N min ago" / "N h ago" (the list's freshness column). */
export function agoLabel(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(min) || min < 1) return pt('agoNow');
  return min < 60 ? pt('agoMin', { n: min }) : pt('agoHour', { n: Math.round(min / 60) });
}

/** The floor the map opens on: the one asked for when it is listed, else the busiest, else the first. */
export function pickFloor(floors: PeopleFloor[], wanted: string | null): string | null {
  if (wanted && floors.some((f) => f.floor_id === wanted)) return wanted;
  if (!floors.length) return null;
  return [...floors].sort((a, b) => b.count - a.count)[0].floor_id;
}

/** The plan's areas with their counts in the label; an occupied area takes the accent, an empty one stays neutral. */
export function occupancyZones(bundle: Pick<MapBundle, 'zones'> | null, floor: PeopleFloor | undefined): PlanZone[] {
  if (!bundle) return [];
  const counts = zoneOccupancy(floor);
  return bundle.zones.map((z) => {
    const n = counts.get(z.id) ?? 0;
    return { id: z.id, name: n ? pt('zoneCount', { name: z.name, n }) : z.name, kind: z.kind, color: n ? 'var(--sw-accent)' : 'var(--sw-border-strong, var(--sw-border))', polygon: z.polygon, labelPos: z.label_pos };
  });
}
