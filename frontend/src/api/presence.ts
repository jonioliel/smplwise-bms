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
  apply_to_web: boolean;
  max_stale_hours: number;
  roles: string[];
  users: string[];
  exempt_users: string[];
}

export interface PresenceSettings {
  enabled: boolean;
  mode: 'continuous';
  interval_s: number;
  distance_filter_m: number;
  notice_text: string;
  notice_version: number;
  sensors_allowed: SensorKey[];
  intervals_s: Record<string, number>;
  sites: { id: string; name: string; lat: number; lon: number; radius_m: number }[];
  beacons: Record<string, unknown>[];
  wifi_sites: Record<string, unknown>[];
  retention_days: number;
  required_sensors: RequiredSensorsPolicy;
  break_glass: { until: string | null; reason: string; by: string | null };
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

export type PresenceSettingsPatch = Partial<Pick<PresenceSettings, 'enabled' | 'notice_text' | 'sensors_allowed' | 'retention_days' | 'interval_s' | 'distance_filter_m'>> & {
  required_sensors?: Partial<RequiredSensorsPolicy>;
};

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
