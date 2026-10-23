/**
 * CR-LIVEEVENT100: the live event mode against the add-on backend (routers/incidents.py). Read-mostly: the only writes are the incident's
 * own (open, acknowledge, note, close) and its settings (system.configure). Nothing here operates a door, an alarm or a camera.
 * Without a backend (the static demo) every call answers fake data in the shape of the API, so the screen can be reviewed.
 */
import { get, post, put } from './client';
import { isApi } from './session';

export type IncidentStatus = 'open' | 'closed';
export type IncidentSource = 'alarm' | 'event' | 'notification' | 'manual';
export type StepKind = 'opened' | 'notified' | 'acked' | 'door_open' | 'door_state' | 'note' | 'event_added' | 'closed';

export interface IncidentStep {
  at: string;
  kind: StepKind;
  actor: string | null;
  actor_kind: 'user' | 'system' | 'access_control';
  ref_type: string | null;
  ref_id: string | null;
  text: string | null;
  recipients?: string[];
  unconfirmed?: boolean;
}

export interface IncidentSettings {
  'incident.enabled': boolean;
  'incident.auto_open.alarm': boolean;
  'incident.merge_window_s': number;
  'incident.max_live': number;
  'incident.max_live_phone': number;
  'incident.snapshot_refresh_s': number;
  'incident.refresh_s': number;
  'incident.hidden_stop_s': number;
  'incident.door_window_s': number;
  'incident.near_radius_pct': number;
  'incident.red_dot': 'active' | 'off';
  'incident.header_clock': boolean;
  'incidents.retention_days': number;
}
export type IncidentSettingKey = keyof IncidentSettings;
export type SettingBound = { kind: 'int'; min: number; max: number; default: number } | { kind: 'enum'; choices: string[]; default: string } | { kind: 'bool'; default: boolean };

export interface Incident {
  id: string;
  status: IncidentStatus;
  source: IncidentSource;
  source_ref: string | null;
  source_label: string;
  title: string;
  building_id: string | null;
  building_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  anchor_id: string | null;
  x: number | null;
  y: number | null;
  zone: string | null;
  opened_at: string;
  opened_by: string;
  opened_by_name: string | null;
  acked_at: string | null;
  acked_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  close_note: string | null;
  event_label: string | null;
}

export interface IncidentDetail extends Incident {
  steps: IncidentStep[];
  pending: string[];
  can_ack: boolean;
  can_case: boolean;
  can_audit: boolean;
  can_configure: boolean;
  settings: IncidentSettings;
  policy: string;
}

export interface IncidentCamera { camera_id: string; name: string; relation: string; relation_label: string; distance: number }
export interface IncidentCameras { cameras: IncidentCamera[]; withheld: boolean; max_live: number; max_live_phone: number; snapshot_refresh_s: number }
export interface IncidentDoor {
  entity_id: string; name: string; area_name: string | null; domain: string; state: string | null; open: boolean | null; since: string | null;
  available: boolean | null; station_id?: string; door?: number;
}
export interface IncidentDoors { doors: IncidentDoor[]; state_visible: boolean; window: { from: string; to: string }; window_s: number }
export interface IncidentSummary { enabled: boolean; open: number; latest_id: string | null; latest_title?: string | null; red_dot: 'active' | 'off' }
export interface IncidentList { incidents: Incident[]; retention_days: number; can_open: boolean; can_configure: boolean; settings: Partial<IncidentSettings> }
export interface SettingsAnswer { settings: IncidentSettings; bounds: Record<IncidentSettingKey, SettingBound>; can_edit: boolean; notify_source?: string; policy?: string }

export const DEFAULT_SETTINGS: IncidentSettings = {
  'incident.enabled': false, 'incident.auto_open.alarm': false, 'incident.merge_window_s': 300, 'incident.max_live': 4, 'incident.max_live_phone': 1,
  'incident.snapshot_refresh_s': 10, 'incident.refresh_s': 10, 'incident.hidden_stop_s': 30, 'incident.door_window_s': 600, 'incident.near_radius_pct': 20,
  'incident.red_dot': 'active', 'incident.header_clock': true, 'incidents.retention_days': 365,
};
export const DEFAULT_BOUNDS: Record<IncidentSettingKey, SettingBound> = {
  'incident.enabled': { kind: 'bool', default: false },
  'incident.auto_open.alarm': { kind: 'bool', default: false },
  'incident.merge_window_s': { kind: 'int', min: 0, max: 3600, default: 300 },
  'incident.max_live': { kind: 'int', min: 1, max: 6, default: 4 },
  'incident.max_live_phone': { kind: 'int', min: 1, max: 2, default: 1 },
  'incident.snapshot_refresh_s': { kind: 'int', min: 5, max: 120, default: 10 },
  'incident.refresh_s': { kind: 'int', min: 5, max: 120, default: 10 },
  'incident.hidden_stop_s': { kind: 'int', min: 5, max: 600, default: 30 },
  'incident.door_window_s': { kind: 'int', min: 60, max: 3600, default: 600 },
  'incident.near_radius_pct': { kind: 'int', min: 5, max: 60, default: 20 },
  'incident.red_dot': { kind: 'enum', choices: ['active', 'off'], default: 'active' },
  'incident.header_clock': { kind: 'bool', default: true },
  'incidents.retention_days': { kind: 'int', min: 30, max: 3650, default: 365 },
};

// ---------------------------------------------------------------- the static demo (no backend): fake data, never a real name or place

const DEMO_NOW = Date.now();
const ago = (s: number) => new Date(DEMO_NOW - s * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const DEMO_ID = 'demo-incident';
let demoSettings: IncidentSettings = { ...DEFAULT_SETTINGS, 'incident.enabled': true };
const demoIncident = (): IncidentDetail => ({
  id: DEMO_ID, status: 'open', source: 'alarm', source_ref: 'alarm_control_panel.demo', source_label: 'אזעקת פריצה', title: 'פריצה · דלת חניון -1',
  building_id: 'b0', building_name: 'בניין א', floor_id: 'f0', floor_name: 'קומה -1', anchor_id: null, x: 0.3, y: 0.55, zone: 'אזור 3 · חניון',
  opened_at: ago(252), opened_by: 'system', opened_by_name: 'המערכת', acked_at: ago(200), acked_by: 'דנה כהן', closed_at: null, closed_by: null, close_note: null,
  event_label: 'אזעקת פריצה',
  steps: [
    { at: ago(262), kind: 'opened', actor: null, actor_kind: 'system', ref_type: 'alarm', ref_id: null, text: 'אזעקת פריצה · אזור 3' },
    { at: ago(247), kind: 'notified', actor: null, actor_kind: 'system', ref_type: 'notification', ref_id: 'n1', text: '3', recipients: ['דנה כהן', 'מיכל בר', 'יוסי לוי'] },
    { at: ago(219), kind: 'door_open', actor: 'יוסי לוי', actor_kind: 'user', ref_type: 'door', ref_id: 'lock.demo_parking', text: 'דלת חניון -1' },
    { at: ago(200), kind: 'acked', actor: 'דנה כהן', actor_kind: 'user', ref_type: null, ref_id: null, text: 'first' },
    { at: ago(124), kind: 'event_added', actor: null, actor_kind: 'system', ref_type: 'alarm', ref_id: null, text: 'יציאת חירום מרתף נפתחה' },
    { at: ago(92), kind: 'note', actor: 'דנה כהן', actor_kind: 'user', ref_type: null, ref_id: null, text: 'שומר בדרך לחניון' },
  ],
  pending: ['מיכל בר', 'יוסי לוי'], can_ack: true, can_case: true, can_audit: true, can_configure: true, settings: demoSettings,
  policy: 'מצב אירוע חי מציג מידע בלבד.',
});
const DEMO_CAMERAS: IncidentCameras = {
  cameras: [
    { camera_id: 'c1', name: 'חניון -1 מזרח', relation: 'same_zone', relation_label: 'אותו חדר', distance: 0.05 },
    { camera_id: 'c2', name: 'מסדרון מרתף', relation: 'adjacent_zone', relation_label: 'חדר סמוך', distance: 0.2 },
    { camera_id: 'c3', name: 'חדר מכונות', relation: 'adjacent_zone', relation_label: 'חדר סמוך', distance: 0.3 },
    { camera_id: 'c4', name: 'כניסה M1', relation: 'nearby', relation_label: 'בקרבת מקום', distance: 0.4 },
  ],
  withheld: false, max_live: 4, max_live_phone: 1, snapshot_refresh_s: 10,
};
const DEMO_DOORS: IncidentDoors = {
  doors: [
    { entity_id: 'lock.demo_parking', name: 'דלת חניון -1', area_name: 'חניון', domain: 'lock', state: 'unlocked', open: true, since: ago(219), available: true },
    { entity_id: 'binary_sensor.demo_exit', name: 'יציאת חירום מרתף', area_name: 'מסדרון', domain: 'binary_sensor', state: 'on', open: true, since: ago(124), available: true },
    { entity_id: 'lock.demo_machine', name: 'דלת חדר מכונות', area_name: 'חדר מכונות', domain: 'lock', state: 'locked', open: false, since: ago(1600), available: true },
  ],
  state_visible: true, window: { from: ago(852), to: ago(0) }, window_s: 600,
};
const DEMO_CLOSED: Incident[] = [
  { ...demoIncident(), id: 'd2', status: 'closed', source: 'manual', source_label: 'פתיחה ידנית', title: 'תרגיל · חניון -1', opened_at: ago(4 * 86400), closed_at: ago(4 * 86400 - 1320), x: null, y: null },
  { ...demoIncident(), id: 'd3', status: 'closed', source: 'event', source_label: 'מרכז האירועים', title: 'חדירה לאזור · יציאת חירום 2', opened_at: ago(6 * 86400), closed_at: ago(6 * 86400 - 1020), x: null, y: null },
];
let demoOpen = true;

// ---------------------------------------------------------------- calls

export async function incidentSummary(): Promise<IncidentSummary> {
  if (!isApi()) return { enabled: true, open: demoOpen ? 1 : 0, latest_id: demoOpen ? DEMO_ID : null, latest_title: demoIncident().title, red_dot: demoSettings['incident.red_dot'] };
  return get<IncidentSummary>('incidents/summary');
}

export async function listIncidents(status: 'open' | 'closed' | 'all' = 'all'): Promise<IncidentList> {
  if (!isApi()) {
    const all = [...(demoOpen ? [demoIncident()] : []), ...DEMO_CLOSED];
    return { incidents: all.filter((i) => status === 'all' || i.status === status), retention_days: 365, can_open: true, can_configure: true, settings: demoSettings };
  }
  return get<IncidentList>(`incidents?status=${status}`);
}

export async function getIncident(id: string): Promise<IncidentDetail> {
  if (!isApi()) return { ...demoIncident(), status: demoOpen ? 'open' : 'closed', settings: demoSettings };
  return get<IncidentDetail>(`incidents/${encodeURIComponent(id)}`);
}

export async function incidentCameras(id: string): Promise<IncidentCameras> {
  if (!isApi()) return { ...DEMO_CAMERAS, max_live: demoSettings['incident.max_live'], max_live_phone: demoSettings['incident.max_live_phone'] };
  return get<IncidentCameras>(`incidents/${encodeURIComponent(id)}/cameras`);
}

export async function incidentDoors(id: string): Promise<IncidentDoors> {
  if (!isApi()) return DEMO_DOORS;
  return get<IncidentDoors>(`incidents/${encodeURIComponent(id)}/doors`);
}

export async function openIncident(body: { event_id?: string; floor_id?: string; x?: number; y?: number; title?: string }): Promise<{ incident: IncidentDetail; merged: boolean }> {
  if (!isApi()) {
    demoOpen = true;
    return { incident: demoIncident(), merged: false };
  }
  return post<{ incident: IncidentDetail; merged: boolean }>('incidents', body);
}

export async function ackIncident(id: string): Promise<IncidentDetail> {
  if (!isApi()) return demoIncident();
  return post<IncidentDetail>(`incidents/${encodeURIComponent(id)}/ack`);
}

export async function noteIncident(id: string, text: string): Promise<IncidentDetail> {
  if (!isApi()) return demoIncident();
  return post<IncidentDetail>(`incidents/${encodeURIComponent(id)}/note`, { text });
}

export async function closeIncident(id: string, note?: string): Promise<IncidentDetail> {
  if (!isApi()) {
    demoOpen = false;
    return { ...demoIncident(), status: 'closed', closed_at: new Date().toISOString() };
  }
  return post<IncidentDetail>(`incidents/${encodeURIComponent(id)}/close`, note ? { note } : {});
}

export async function incidentSettings(): Promise<SettingsAnswer> {
  if (!isApi()) return { settings: demoSettings, bounds: DEFAULT_BOUNDS, can_edit: true, notify_source: 'incident.opened' };
  return get<SettingsAnswer>('incidents/settings');
}

export async function saveIncidentSettings(changes: Partial<IncidentSettings>): Promise<SettingsAnswer> {
  if (!isApi()) {
    demoSettings = { ...demoSettings, ...changes };
    return { settings: demoSettings, bounds: DEFAULT_BOUNDS, can_edit: true };
  }
  return put<SettingsAnswer>('incidents/settings', { settings: changes });
}

/** Elapsed time `hh:mm:ss` between two instants (never negative). */
export function elapsed(fromIso: string, toMs: number = Date.now()): string {
  const s = Math.max(0, Math.floor((toMs - new Date(fromIso).getTime()) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
