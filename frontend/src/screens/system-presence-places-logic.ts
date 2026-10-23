/** WHOIN034-295: the pure parts of the place editors and the "מי במבנה" thresholds (screens/system-presence-places.ts), free of Lit. */
import { PEOPLE_RANGES, type PeopleSettings, type PresenceBeacon, type PresenceSite, type PresenceWifiSite } from '../api/presence';

export type PlaceKind = 'site' | 'beacon' | 'wifi';

/** Pure: the problem keys of one item (`site:<id>:coords` -> 'coords'). */
export function problemsOf(all: string[], kind: PlaceKind, id: string): string[] {
  return all.filter((p) => p.startsWith(`${kind}:${id}:`)).map((p) => p.split(':')[2]);
}

/** Pure: the body one save sends - the three lists whole (the server replaces them) with the write-only SSIDs trimmed. */
export function placesBody(sites: PresenceSite[], beacons: PresenceBeacon[], wifi: PresenceWifiSite[]) {
  return {
    sites: sites.map((s) => ({ id: s.id, name: s.name.trim(), lat: Number(s.lat), lon: Number(s.lon), radius_m: Math.round(Number(s.radius_m)) })),
    beacons: beacons.map((b) => ({ ...b, name: b.name.trim(), uuid: b.uuid.trim().toLowerCase(), major: b.major ?? null, minor: b.minor ?? null, floor_id: b.floor_id || null, zone_id: b.zone_id || null })),
    wifi_sites: wifi.map((w) => {
      const add = (w.add_ssids ?? []).map((s) => s.trim()).filter(Boolean);
      const { add_ssids: _drop, ...rest } = w;
      return { ...rest, name: w.name.trim(), floor_id: w.floor_id || null, ...(add.length ? { add_ssids: add } : {}) };
    }),
  };
}

/** Pure: a threshold draft is valid (each number inside its range). */
export function peopleProblems(p: PeopleSettings): string[] {
  return (Object.keys(PEOPLE_RANGES) as (keyof typeof PEOPLE_RANGES)[]).filter((k) => !(Number.isInteger(p[k]) && p[k] >= PEOPLE_RANGES[k][0] && p[k] <= PEOPLE_RANGES[k][1]));
}

