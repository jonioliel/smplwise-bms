/**
 * Home Assistant entities (chapters 8 and 22): the synced catalogue, entity state on the map, safe actions through
 * the SMPLWISE bridge integration, pairing status and the push socket.
 */
import { apiUrl, get, post } from './client';
import type { StateKind } from '../components/sw-badge';
import type { MarkerKind } from '../map/sw-plan-canvas';

export interface HaActionArgSpec {
  name: string;
  type: 'int' | 'float' | 'enum' | 'str';
  min?: number;
  max?: number;
  min_len?: number;
  max_len?: number;
  choices?: string[];
}

export interface HaActionSpec {
  id: string;
  label: string;
  sensitive: boolean;
  /** T040 risk class: routine runs at once, attention asks for a confirmation, sensitive also needs its own grant. */
  risk?: 'routine' | 'attention' | 'sensitive';
  risk_label?: string;
  arguments: string[];
  argument_specs?: HaActionArgSpec[];
  /** A separate permission the action needs on top of entity control (T079), and whether this caller holds it. */
  grant?: string | null;
  granted?: boolean;
}

export interface HaPlacement {
  floor_id: string;
  floor_name: string;
}

/** State of an entity at an instant, from the local history (T041); `known` false carries the reason. */
export interface HaStateAt {
  state: string | null;
  changed_at: string | null;
  known: boolean;
  reason: string | null;
  /** S2: where the state came from - the local history or the Home Assistant recorder (secondary). */
  source?: 'vms' | 'ha_recorder';
}

export interface HaEntity {
  entity_id: string;
  /** Present only in a historical map bundle (`?at=`); the live `state` is null there. */
  state_at?: HaStateAt;
  registry_id: string | null;
  platform: string | null;
  device_id: string | null;
  area_id: string | null;
  area_name: string | null;
  ha_floor_id: string | null;
  ha_floor_name: string | null;
  name: string | null;
  original_name: string | null;
  domain: string;
  device_class: string | null;
  unit: string | null;
  icon: string | null;
  entity_category: string | null;
  disabled: boolean;
  hidden: boolean;
  supported_features: number | null;
  state: string | null;
  attributes: Record<string, unknown>;
  last_changed: string | null;
  last_updated: string | null;
  state_seen_at: string | null;
  available: boolean;
  removed_at: string | null;
  fresh: boolean;
  placements?: HaPlacement[];
  actions?: HaActionSpec[];
  recent_actions?: HaActionRecord[];
  can_control?: boolean;
}

export type HaActionStatus = 'pending' | 'confirmed' | 'unknown' | 'failed' | 'denied';

export interface HaActionRecord {
  id: string;
  entity_id: string;
  action_id: string;
  status: HaActionStatus;
  error: string | null;
  requested_at: string;
  responded_at?: string | null;
  confirmed_at: string | null;
  expected_state?: string | null;
  observed_state?: string | null;
  principal_username?: string | null;
  note?: string | null;
}

export interface HaSyncState {
  connected: boolean;
  last_snapshot_at: string | null;
  last_event_at: string | null;
  last_registry_at: string | null;
  last_error: string | null;
  reconnects: number;
  sequence: number;
  entities: number;
  started_at: string | null;
  ha_version: string | null;
}

export interface HaStatus {
  configured: boolean;
  sync: HaSyncState;
  bridge: { paired: boolean; paired_at: string | null; directory_users: number; last_directory_at: string | null; integration_version?: string | null };
  integration?: HaIntegrationStatus;
}

/** The integration copy the add-on maintains inside Home Assistant's config directory. */
export interface HaIntegrationStatus {
  state: 'not_available' | 'not_installed' | 'installed_pending' | 'active' | 'update_pending' | 'error';
  source_version: string | null;
  installed_version: string | null;
  active_version: string | null;
  installed_at: string | null;
  config_dir: string | null;
  last_error: string | null;
  discovery_posted_at: string | null;
  addon_url: string;
  up_to_date: boolean;
}

export interface HaCatalogue {
  entities: HaEntity[];
  domains: Record<string, number>;
  areas: { area_id: string; area_name: string | null }[];
  sync: HaSyncState;
  can_control: boolean;
}

export function listEntities(opts: { domain?: string; q?: string; area?: string; placed?: boolean; includeDisabled?: boolean; limit?: number } = {}) {
  const p = new URLSearchParams();
  if (opts.domain) p.set('domain', opts.domain);
  if (opts.q) p.set('q', opts.q);
  if (opts.area) p.set('area', opts.area);
  if (opts.placed !== undefined) p.set('placed', String(opts.placed));
  if (opts.includeDisabled) p.set('include_disabled', 'true');
  if (opts.limit) p.set('limit', String(opts.limit));
  const qs = p.toString();
  return get<HaCatalogue>(`ha/entities${qs ? `?${qs}` : ''}`);
}
export const getEntity = (entityId: string) => get<HaEntity>(`ha/entities/${encodeURIComponent(entityId)}`);
export const haStatus = () => get<HaStatus>('ha/status');
export const bridgePairing = (regenerate = false) => get<{ pairing_code: string; addon_host: string; addon_url: string; paired_at: string | null }>(`ha/bridge/pairing${regenerate ? '?regenerate=true' : ''}`);
export const getAction = (id: string) => get<HaActionRecord>(`ha/actions/${id}`);
export const installBridge = () => post<HaIntegrationStatus>('ha/bridge/install');

/** Entity-action request (contracts/entity-action.request.schema.json): one client id per click, short expiry. */
export function runAction(entityId: string, actionId: string, args: Record<string, unknown> = {}, confirmed = false) {
  const body = {
    allowed_action_id: actionId,
    arguments: args,
    expected_state_version: null,
    confirmation_grant: confirmed ? 'confirmed' : null,
    client_request_id: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  return post<HaActionRecord>(`ha/entities/${encodeURIComponent(entityId)}/actions`, body);
}

/** Poll a pending action until Home Assistant confirms (or the add-on gives up after ~20 s). */
export async function awaitAction(id: string, onUpdate: (a: HaActionRecord) => void, signal?: { stopped: boolean }): Promise<HaActionRecord> {
  let a = await getAction(id);
  onUpdate(a);
  for (let i = 0; i < 16 && a.status === 'pending' && !signal?.stopped; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    a = await getAction(id);
    onUpdate(a);
  }
  return a;
}

/** Why an action ended denied or failed, in words (the code stays in the record for the audit). */
export const ACTION_ERROR_LABEL: Record<string, string> = {
  ha_unauthorized: 'Home Assistant דחה את הפעולה: למשתמש שלך אין הרשאה לישות זו ב־Home Assistant',
  ha_unknown_user: 'Home Assistant אינו מכיר את המשתמש שמאחורי ההפעלה הזו',
  bridge_not_paired: 'גשר SMPLWISE אינו מצומד',
  bridge_error: 'הגשר החזיר שגיאה',
  ha_unavailable: 'Home Assistant אינו זמין',
  service_not_allowed: 'הגשר סירב: השירות אינו ברשימת הפעולות המאושרות (גשר ישן? מאז 0.2.1 נוספו climate / media / number / select / alarm — הפעל את Home Assistant מחדש כדי לטעון את הגרסה החדשה)',
  unknown_user: 'Home Assistant אינו מכיר את המשתמש',
};

export const ACTION_STATUS_LABEL: Record<HaActionStatus, string> = {
  pending: 'נשלח · ממתין לעדכון מ־Home Assistant',
  confirmed: 'אושר · המצב התעדכן',
  unknown: 'לא ידוע · לא התקבל עדכון מצב',
  failed: 'נכשל',
  denied: 'נדחה · אין הרשאה ב־Home Assistant',
};

const ACTIVE = new Set(['on', 'open', 'opening', 'unlocked', 'unlocking', 'playing', 'home', 'heat', 'cool', 'heat_cool', 'dry', 'fan_only', 'cleaning', 'active', 'detected', 'problem', 'running']);

const STATE_HE: Record<string, string> = {
  on: 'דולק',
  off: 'כבוי',
  locked: 'נעול',
  unlocked: 'פתוח',
  locking: 'נועל…',
  unlocking: 'פותח…',
  jammed: 'תקוע',
  open: 'פתוח',
  closed: 'סגור',
  opening: 'נפתח…',
  closing: 'נסגר…',
  unavailable: 'לא זמין',
  unknown: 'לא ידוע',
  idle: 'לא פעיל',
  home: 'בבית',
  not_home: 'מחוץ לבית',
  playing: 'מנגן',
  paused: 'מושהה',
  standby: 'המתנה',
  heat: 'חימום',
  cool: 'קירור',
  auto: 'אוטומטי',
  dry: 'ייבוש',
  fan_only: 'מאוורר',
  docked: 'בתחנה',
  cleaning: 'מנקה',
  returning: 'חוזר',
};

const BINARY_HE: Record<string, [string, string]> = {
  motion: ['תנועה', 'ללא תנועה'],
  occupancy: ['נוכחות', 'ללא נוכחות'],
  presence: ['נוכח', 'לא נוכח'],
  door: ['פתוחה', 'סגורה'],
  window: ['פתוח', 'סגור'],
  opening: ['פתוח', 'סגור'],
  garage_door: ['פתוח', 'סגור'],
  lock: ['פתוח', 'נעול'],
  connectivity: ['מחובר', 'מנותק'],
  power: ['פועל', 'כבוי'],
  problem: ['תקלה', 'תקין'],
  safety: ['לא בטוח', 'בטוח'],
  smoke: ['עשן', 'ללא עשן'],
  moisture: ['רטוב', 'יבש'],
  battery: ['סוללה חלשה', 'סוללה תקינה'],
  running: ['פועל', 'לא פועל'],
  sound: ['רעש', 'שקט'],
  vibration: ['רטט', 'ללא רטט'],
  update: ['עדכון זמין', 'מעודכן'],
};

/** Hebrew state text with the unit for numeric sensors. Unknown states are shown as-is. */
export function stateLabel(e: Pick<HaEntity, 'domain' | 'state' | 'unit' | 'device_class' | 'attributes'>): string {
  const s = e.state;
  if (s === null || s === undefined) return 'לא ידוע';
  if (s === 'unavailable' || s === 'unknown') return STATE_HE[s];
  if (e.domain === 'binary_sensor') {
    const pair = BINARY_HE[e.device_class ?? ''];
    if (pair) return s === 'on' ? pair[0] : pair[1];
    return s === 'on' ? 'פעיל' : 'לא פעיל';
  }
  if (e.domain === 'sensor' || e.domain === 'number' || e.domain === 'input_number') {
    const n = Number(s);
    if (!Number.isNaN(n) && s.trim() !== '') return `${Number.isInteger(n) ? n : n.toFixed(Math.min(2, (s.split('.')[1] ?? '').length))}${e.unit ? ` ${e.unit}` : ''}`;
    return s;
  }
  if (e.domain === 'light' && s === 'on' && typeof e.attributes.brightness === 'number') return `דולק · ${Math.round((e.attributes.brightness / 255) * 100)}%`;
  if (e.domain === 'cover' && typeof e.attributes.current_position === 'number' && (s === 'open' || s === 'closed')) return `${STATE_HE[s]} · ${e.attributes.current_position}%`;
  if (e.domain === 'climate' && typeof e.attributes.current_temperature === 'number') return `${STATE_HE[s] ?? s} · ${e.attributes.current_temperature}°`;
  return STATE_HE[s] ?? s;
}

/** Marker/badge tone: offline when HA says unavailable, stale when the sync is down, live when the entity is "active". */
export function entityTone(e: Pick<HaEntity, 'state' | 'fresh' | 'available' | 'removed_at'> | null | undefined): StateKind {
  if (!e || e.removed_at) return 'unknown';
  if (e.state === 'unavailable' || !e.available) return 'offline';
  if (!e.fresh) return 'stale';
  if (e.state === null || e.state === 'unknown') return 'unknown';
  return ACTIVE.has(e.state) ? 'live' : 'neutral';
}

export function entityMarkerKind(layerId: string, domain?: string): MarkerKind {
  if (layerId === 'doors' || domain === 'lock' || domain === 'cover') return 'lock';
  if (layerId === 'lights' || domain === 'light' || domain === 'switch' || domain === 'fan') return 'light';
  return 'binary_sensor';
}

export function domainLabel(domain: string): string {
  const m: Record<string, string> = {
    light: 'תאורה',
    switch: 'מתג',
    lock: 'מנעול',
    cover: 'תריס / שער',
    binary_sensor: 'חיישן בינארי',
    sensor: 'חיישן',
    fan: 'מאוורר',
    climate: 'אקלים',
    camera: 'מצלמת HA',
    button: 'כפתור',
    script: 'סקריפט',
    scene: 'סצנה',
    automation: 'אוטומציה',
    media_player: 'נגן',
    event: 'אירוע',
    number: 'מספר',
    select: 'בחירה',
    input_boolean: 'דגל',
    alarm_control_panel: 'אזעקה',
    siren: 'צופר',
    vacuum: 'שואב',
    weather: 'מזג אוויר',
    sun: 'שמש',
  };
  return m[domain] ?? domain;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'medium' });
}

export type HaPush = { type: 'entity_state_changed'; entity: HaEntity } | { type: 'ha_sync_state'; connected: boolean } | { type: 'heartbeat'; sync: HaSyncState };

/** Subscribe to entity state pushes scoped to what the user may see; returns a stop function. */
export function subscribeHa(onMessage: (m: HaPush) => void, onSocket?: (connected: boolean) => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let delay = 2000;
  const url = (() => {
    const u = new URL(apiUrl('ha/ws'));
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.toString();
  })();
  const open = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    ws.onopen = () => {
      delay = 2000;
      onSocket?.(true);
    };
    ws.onmessage = (m) => {
      try {
        const env = JSON.parse(m.data as string) as { type: string; payload: Record<string, unknown> };
        if (env.type === 'entity_state_changed') onMessage({ type: 'entity_state_changed', entity: env.payload.entity as HaEntity });
        else if (env.type === 'ha_sync_state') onMessage({ type: 'ha_sync_state', connected: Boolean(env.payload.connected) });
        else if (env.type === 'heartbeat') onMessage({ type: 'heartbeat', sync: env.payload.sync as HaSyncState });
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (ev) => {
      onSocket?.(false);
      if (!stopped && ev.code !== 4403 && ev.code !== 4401) {
        window.setTimeout(open, delay);
        delay = Math.min(30000, delay * 2);
      }
    };
  };
  open();
  return () => {
    stopped = true;
    ws?.close();
  };
}
