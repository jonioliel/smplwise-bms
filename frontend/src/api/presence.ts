/**
 * CR-027: the phone app's presence settings and device list (backend routers/presence.py; the app-facing half of the
 * contract is docs/api/mobile-presence-contract.md). Everything here is the administrator's side: the master switch, the
 * sensors the installation allows, the employee notice with its version, the required-sensors policy, retention, and
 * everyone's registered devices. A device token never reaches the page.
 */
import { get, post, put } from './client';

export type SensorKey = 'location' | 'activity' | 'steps' | 'altitude' | 'battery' | 'network' | 'beacon' | 'app_state';
export const SENSOR_KEYS: readonly SensorKey[] = ['location', 'activity', 'steps', 'altitude', 'battery', 'network', 'beacon', 'app_state'];
export const SENSOR_LABEL: Record<SensorKey, string> = {
  location: 'מיקום', activity: 'פעילות (הליכה, נסיעה)', steps: 'צעדים', altitude: 'שינוי גובה (קומה)', battery: 'סוללה', network: 'רשת ו-Wi-Fi',
  beacon: 'קרבה לנקודות בבניין', app_state: 'פעילות האפליקציה',
};
export const RETENTION_CHOICES: readonly number[] = [7, 14, 30, 60, 90, 180, 365];

export interface RequiredSensorsPolicy {
  enabled: boolean;
  sensors: SensorKey[];
  hardware_required?: SensorKey[];
  apply_to_web: boolean;
  max_stale_hours: number;
  roles: string[];
  users: string[];
  exempt_users: string[];
}

/** WHOIN034-295: a geofence (the app monitors it as a region). */
export interface PresenceSite { id: string; name: string; lat: number; lon: number; radius_m: number }
/** WHOIN034-295: a beacon, optionally placed on a floor and an area (spatial zone) of the catalogue. */
export interface PresenceBeacon { id: string; name: string; uuid: string; major: number | null; minor: number | null; site_id: string; floor_id: string | null; zone_id: string | null }
/** WHOIN034-295: a Wi-Fi site. Only hashes are kept; `add_ssids` is write-only (the server hashes the names with the salt). */
export interface PresenceWifiSite { id: string; name: string; site_id: string; floor_id: string | null; ssid_hash_salt: string; ssid_hashes: string[]; add_ssids?: string[] }
export type Proximity = 'immediate' | 'near' | 'far';
export const PROXIMITIES: readonly Proximity[] = ['immediate', 'near', 'far'];
/** WHOIN034-295: every threshold of the "who is in the building" screen (backend PEOPLE_DEFAULTS / PEOPLE_RANGES). */
export interface PeopleSettings {
  stale_minutes: number;
  beacon_max_age_minutes: number;
  wifi_max_age_minutes: number;
  min_proximity: Proximity;
  show_names: boolean;
  refresh_seconds: number;
}
export const PEOPLE_DEFAULTS: PeopleSettings = { stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near', show_names: true, refresh_seconds: 30 };
export const PEOPLE_RANGES: Record<'stale_minutes' | 'beacon_max_age_minutes' | 'wifi_max_age_minutes' | 'refresh_seconds', [number, number]> = {
  stale_minutes: [5, 1440], beacon_max_age_minutes: [1, 240], wifi_max_age_minutes: [1, 240], refresh_seconds: [10, 300],
};

export interface PresenceSettings {
  enabled: boolean;
  mode: 'continuous';
  interval_s: number;
  distance_filter_m: number;
  notice_text: string;
  notice_version: number;
  sensors_allowed: SensorKey[];
  intervals_s: Record<string, number>;
  sites: PresenceSite[];
  beacons: PresenceBeacon[];
  wifi_sites: PresenceWifiSite[];
  /** PRESENCE307: who decides "connected to a site network": the phone (default) or the server (hash match). */
  wifi_match_mode: 'phone' | 'server';
  retention_days: number;
  required_sensors: RequiredSensorsPolicy;
  break_glass: { until: string | null; reason: string; by: string | null };
  people?: PeopleSettings;
  people_opt_out_count?: number;
}

export interface SensorInfo { key: SensorKey; name_he: string; purpose_he: string }

export interface PresenceSettingsResponse { settings: PresenceSettings; sensors: SensorInfo[]; devices: number }

export interface PresenceDevice {
  device_id: string;
  name: string;
  platform: 'ios' | 'android';
  app_version: string | null;
  registered_at: string;
  last_seen_at: string;
  last_event_at: string | null;
  notice_ack_version: number;
  status: { location_auth: string; precise: boolean; sharing: boolean; sensors: Record<SensorKey, 'on' | 'off'> };
  presence: { inside?: boolean | null; site_id?: string | null; at?: string };
  push: { registered: boolean; platform: string | null; muted: string[]; last_ok_at: string | null; failures: number };
  user?: { id: string; username: string; display_name: string; active: boolean };
}

/** What `/me` carries once a required-sensors policy was ever written (backend services/presence.gate_for). */
export interface PresenceGate {
  required: SensorKey[];
  missing: SensorKey[];
  blocked: boolean;
  applies: boolean;
  channel: 'app' | 'web';
  break_glass_until: string | null;
  reason: 'presence_disabled' | 'exempt' | 'not_in_scope' | 'web_not_covered' | 'break_glass' | 'missing_sensors' | null;
}

export type PresenceSettingsPatch = Partial<Pick<PresenceSettings, 'enabled' | 'notice_text' | 'sensors_allowed' | 'retention_days' | 'interval_s' | 'distance_filter_m' | 'wifi_match_mode'>> & {
  required_sensors?: Partial<RequiredSensorsPolicy>;
  sites?: Partial<PresenceSite>[];
  beacons?: Partial<PresenceBeacon>[];
  wifi_sites?: Partial<PresenceWifiSite>[];
  people?: Partial<PeopleSettings>;
};

/** WHOIN034-295: GET presence/people - who the phone app currently places inside (backend services/presence_people.py). */
export type PeopleSource = 'beacon' | 'wifi' | 'geofence';
export interface PersonInside {
  user_id: string;
  name: string;
  source: PeopleSource;
  at: string;
  site_id: string | null;
  site_name: string;
  floor_id: string | null;
  floor_name: string;
  zone_id: string | null;
  zone_name: string;
}
export interface PeopleFloor { floor_id: string; name: string; level: number; building: string; count: number; zones: { zone_id: string; name: string; count: number }[] }
export interface PeopleResponse {
  enabled: boolean;
  generated_at: string;
  configured: { sites: number; beacons: number; wifi_sites: number };
  settings: Pick<PeopleSettings, 'show_names' | 'refresh_seconds' | 'stale_minutes' | 'beacon_max_age_minutes' | 'wifi_max_age_minutes' | 'min_proximity'>;
  people: PersonInside[];
  floors: PeopleFloor[];
  sites: { site_id: string; name: string; count: number }[];
  totals: { inside: number; named: number; hidden: number; on_floors: number; site_only: number };
}

export const getPresencePeople = () => get<PeopleResponse>('presence/people');
export const getMyPeopleVisibility = () => get<{ opted_out: boolean; enabled: boolean }>('presence/people/me');
export const setMyPeopleVisibility = (optedOut: boolean) => put<{ opted_out: boolean }>('presence/people/me', { opted_out: optedOut });

/** Pure: the people a list shows for a floor filter ('' = all, '-' = placed on a site only) and a search text. */
export function filterPeople(list: PersonInside[], floor: string, query: string): PersonInside[] {
  const q = query.trim().toLowerCase();
  return list.filter((p) => (floor === '' || (floor === '-' ? !p.floor_id : p.floor_id === floor)) && (!q || `${p.name} ${p.zone_name} ${p.floor_name} ${p.site_name}`.toLowerCase().includes(q)));
}

/** Pure: a zone's label on the floor map with its count ("לובי · 3"); the colour scales with the share of the floor's people. */
export function zoneOccupancy(floor: PeopleFloor | undefined): Map<string, number> {
  return new Map((floor?.zones ?? []).map((z) => [z.zone_id, z.count]));
}

/** Pure: what the place editors would send is valid (the same rules the server applies; the server stays the authority). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function placeProblems(sites: PresenceSite[], beacons: PresenceBeacon[], wifi: PresenceWifiSite[]): string[] {
  const out: string[] = [];
  const ids = new Set(sites.map((s) => s.id));
  for (const s of sites) {
    if (!(s.lat >= -90 && s.lat <= 90) || !(s.lon >= -180 && s.lon <= 180)) out.push(`site:${s.id}:coords`);
    if (!(s.radius_m >= 30 && s.radius_m <= 5000)) out.push(`site:${s.id}:radius`);
  }
  for (const b of beacons) {
    if (!UUID_RE.test(b.uuid)) out.push(`beacon:${b.id}:uuid`);
    if (!ids.has(b.site_id)) out.push(`beacon:${b.id}:site`);
    if (b.zone_id && !b.floor_id) out.push(`beacon:${b.id}:zone`);
  }
  for (const w of wifi) {
    if (!ids.has(w.site_id)) out.push(`wifi:${w.id}:site`);
    if (!w.ssid_hashes.length && !(w.add_ssids ?? []).some((s) => s.trim())) out.push(`wifi:${w.id}:ssid`);
  }
  if (sites.length > 20) out.push('sites:max');
  if (beacons.length > 100) out.push('beacons:max');
  if (wifi.length > 20) out.push('wifi:max');
  return out;
}

export const getPresenceSettings = () => get<PresenceSettingsResponse>('presence/settings');
export const putPresenceSettings = (body: PresenceSettingsPatch) => put<PresenceSettingsResponse>('presence/settings', body);
export const breakGlass = (hours: number, reason: string) => post<{ break_glass: PresenceSettings['break_glass'] }>('presence/settings/break-glass', { hours, reason });
export const listPresenceDevices = () => get<{ devices: PresenceDevice[] }>('presence/devices');
export const myPresenceGate = () => get<{ gate: PresenceGate | null }>('presence/gate');

/** Pure: the policy the save sends - the sensors a policy requires must be allowed, or the phone could never satisfy it. */
export function policyProblem(s: PresenceSettings): string | null {
  const p = s.required_sensors;
  if (!p.enabled) return null;
  if (!p.sensors.length) return 'בחרו לפחות חיישן אחד שנדרש.';
  const notAllowed = p.sensors.filter((k) => !s.sensors_allowed.includes(k));
  if (notAllowed.length) return `חיישן נדרש חייב להיות מאושר: ${notAllowed.map((k) => SENSOR_LABEL[k]).join(', ')}`;
  if (!s.enabled) return 'הדרישה תחול רק כשהשיתוף פעיל.';
  return null;
}
