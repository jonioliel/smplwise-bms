/**
 * Home Assistant entities (chapters 8 and 22): the synced catalogue, entity state on the map, safe actions through
 * the SMPLWISE bridge integration, pairing status and the push socket.
 */
import { apiUrl, get, post } from './client';
import { commandId } from './request-id';
import type { StateKind } from '../components/sw-badge';
import type { MarkerKind } from '../map/sw-plan-canvas';
import type { MediaLive } from './media-screens';
import type { PlayerLive } from './media-players';

export interface HaActionArgSpec {
  name: string;
  type: 'int' | 'float' | 'enum' | 'str' | 'bool';
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
  /** CR-010 review B1: owned by the alarm section (the panel, a zone's bypass control) - operated only from אבטחה › אזעקה. */
  alarm_managed?: boolean;
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
  /** How the add-on confirms it (CR-007 slice 2 review): the entity's state, the attribute carrying the effect, or
   * "none" - nothing observable, so a `confirmed` status only means Home Assistant accepted the call ("sent"). */
  confirmation?: 'state' | 'attribute' | 'none';
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
  /** CR-007 HA refresh: the listing that failed on the last registry refresh (the mirror was kept), or null. */
  last_registry_error?: string | null;
  /** The last registry refresh that actually changed floors / areas / entities. */
  last_structure_at?: string | null;
  registry_events?: number;
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
    client_request_id: commandId(),
    expires_at: new Date(Date.now() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  return post<HaActionRecord>(`ha/entities/${encodeURIComponent(entityId)}/actions`, body);
}

/** Poll a pending action until Home Assistant confirms (or the add-on gives up after ~20 s). LAT1: the next poll does not
 * wait out the interval when the entity's own state push arrives first - the add-on stores the state before it pushes it,
 * so the poll that the push wakes reads the confirmation (before LAT1 a map card stayed busy for up to 1.5 s more). */
export async function awaitAction(id: string, onUpdate: (a: HaActionRecord) => void, signal?: { stopped: boolean }, entityId?: string): Promise<HaActionRecord> {
  const since = performance.now();
  let a = await getAction(id);
  onUpdate(a);
  for (let i = 0; i < 16 && a.status === 'pending' && !signal?.stopped; i++) {
    if (entityId) await waitEntityPush(entityId, 1500, since);
    else await new Promise((r) => setTimeout(r, 1500));
    a = await getAction(id);
    onUpdate(a);
  }
  return a;
}

// ---------------------------------------------------------------- LAT1: entity pushes for command confirmation
// Every open /ha/ws socket of any screen also feeds these listeners, so a command learns of its entity's new state the
// moment the push lands - no polling interval in between, and no extra socket while a screen already has one open.

type EntityPushListener = (e: HaEntity, at: number) => void;
const entityPushListeners = new Set<EntityPushListener>();
/** performance.now() of the last push per entity (a push that landed before a waiter started is not missed). */
const lastEntityPush = new Map<string, number>();
let liveSockets = 0;

/** Listen to every entity_state_changed push any open socket receives; returns a stop function. */
export function onEntityPush(fn: EntityPushListener): () => void {
  entityPushListeners.add(fn);
  return () => entityPushListeners.delete(fn);
}

/** True while at least one push socket is connected. */
export function haPushLive(): boolean {
  return liveSockets > 0;
}

function notePush(e: HaEntity): void {
  const at = performance.now();
  lastEntityPush.set(e.entity_id, at);
  for (const fn of Array.from(entityPushListeners)) {
    try {
      fn(e, at);
    } catch {
      /* a listener's own failure never stops the others */
    }
  }
}

/** Resolves when a push for `entityId` arrives (or already arrived after `since`), or after `ms` - whichever is first. */
export function waitEntityPush(entityId: string, ms: number, since = performance.now()): Promise<void> {
  if ((lastEntityPush.get(entityId) ?? -1) >= since) {
    lastEntityPush.delete(entityId); // consumed: the next wait waits for a newer push
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let stop: () => void = () => undefined;
    const timer = window.setTimeout(() => {
      stop();
      resolve();
    }, ms);
    stop = onEntityPush((e) => {
      if (e.entity_id !== entityId) return;
      window.clearTimeout(timer);
      stop();
      lastEntityPush.delete(entityId);
      resolve();
    });
  });
}

/** Why an action ended denied or failed, in words (the code stays in the record for the audit). */
export const ACTION_ERROR_LABEL: Record<string, string> = {
  ha_unauthorized: 'תשתית המערכת דחתה את הפעולה: למשתמש שלך אין הרשאה להתקן זה',
  ha_unknown_user: 'תשתית המערכת אינה מכירה את המשתמש שמאחורי ההפעלה הזו',
  bridge_not_paired: 'הגשר אינו מצומד',
  bridge_error: 'הגשר החזיר שגיאה',
  ha_unavailable: 'תשתית המערכת אינה זמינה',
  service_not_allowed: 'הגשר סירב: השירות אינו ברשימת הפעולות המאושרות (גשר ישן? גרסה 0.2.4 הוסיפה את פקדי חשמל והתקנים: מיקום תריס, עוצמת מאוורר, מצב מאוורר במזגן, כיבוי מזגן, הדלקה / כיבוי / השתקה של מסך — הפעילו מחדש את תשתית המערכת כדי לטעון את הגרסה החדשה)',
  unknown_user: 'תשתית המערכת אינה מכירה את המשתמש',
};

export const ACTION_STATUS_LABEL: Record<HaActionStatus, string> = {
  pending: 'נשלח · ממתין לעדכון מתשתית המערכת',
  confirmed: 'אושר · המצב התעדכן',
  unknown: 'לא ידוע · לא התקבל עדכון מצב',
  failed: 'נכשל',
  denied: 'נדחה · אין הרשאה בתשתית המערכת',
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
  heat_cool: 'חימום/קירור',
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
    camera: 'מצלמת התקן',
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

/** `structure_changed` (CR-007 HA refresh): a registry refresh moved floors / areas / entities (an entity moved to
 * another area, an area renamed, a device added or removed in Home Assistant) - screens that show structure refetch. */
export type HaPush =
  | { type: 'entity_state_changed'; entity: HaEntity }
  | { type: 'ha_sync_state'; connected: boolean }
  | { type: 'heartbeat'; sync: HaSyncState }
  | { type: 'structure_changed'; reason: string; last_registry_at: string | null }
  /** CR-014: the schedules changed (the component's read model moved; no ids) - the schedules screens refetch
   * (api/schedules.ts `subscribeSchedules` opens its own socket for this). */
  | { type: 'schedules_changed' }
  /** CR-017: automations, scenes or scripts changed (an Arx write, or an edit made in the platform): `kinds` and the ids of the items the caller may see
   * (empty ids = refetch); the automations screens refetch (docs/architecture/AUTOMATIONS_API.md section 6). */
  | { type: 'automations_changed'; kinds: string[]; ids: string[] }
  /** CR-015: one media device's live state changed (<= 4/s per device; only for subscribers who see its anchor under media.read).
   * CR-016: for a speaker, player, receiver or group the `live` is the extended `PlayerLive` (shuffle, repeat, group, queue, caps_known);
   * the members of a group are republished when its leader's membership moves. */
  | { type: 'media_state'; device_key: string; entity_id: string; live: MediaLive | PlayerLive }
  /** CR-015: the media model was rebuilt, or a curation / approval / layout changed (no ids): the multimedia screens refetch. */
  | { type: 'media_devices_changed'; reason: string }
  /** CR-016: a saved group or the favourites curation changed (no ids): the groups page and the settings refetch. */
  | { type: 'media_groups_changed' }
  /** CR-028: a cast session started, extended, switched or ended (deliberately without a session id, screen or camera - the frame reaches every socket):
   * the client refetches `GET multimedia/cast/sessions` with its own permissions. */
  | { type: 'cast_sessions_changed'; reason: string };

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
    let counted = false;
    ws.onopen = () => {
      delay = 2000;
      if (!counted) {
        counted = true;
        liveSockets++;
      }
      onSocket?.(true);
    };
    ws.onmessage = (m) => {
      try {
        const env = JSON.parse(m.data as string) as { type: string; payload: Record<string, unknown> };
        if (env.type === 'entity_state_changed') {
          // the command listeners first (LAT1): a toggle confirms in the same tick the push lands, before the screen's own refetch
          notePush(env.payload.entity as HaEntity);
          onMessage({ type: 'entity_state_changed', entity: env.payload.entity as HaEntity });
        }
        else if (env.type === 'ha_sync_state') onMessage({ type: 'ha_sync_state', connected: Boolean(env.payload.connected) });
        else if (env.type === 'heartbeat') onMessage({ type: 'heartbeat', sync: env.payload.sync as HaSyncState });
        else if (env.type === 'structure_changed')
          onMessage({ type: 'structure_changed', reason: String(env.payload.reason ?? ''), last_registry_at: (env.payload.last_registry_at as string | null) ?? null });
        else if (env.type === 'schedules_changed') onMessage({ type: 'schedules_changed' });
        else if (env.type === 'automations_changed') onMessage({ type: 'automations_changed', kinds: Array.isArray(env.payload?.kinds) ? (env.payload.kinds as unknown[]).map(String) : [], ids: Array.isArray(env.payload?.ids) ? (env.payload.ids as unknown[]).map(String) : [] });
        else if (env.type === 'media_state') onMessage({ type: 'media_state', device_key: String(env.payload.device_key ?? ''), entity_id: String(env.payload.entity_id ?? ''), live: env.payload.live as unknown as MediaLive });
        else if (env.type === 'media_devices_changed') onMessage({ type: 'media_devices_changed', reason: String(env.payload?.reason ?? '') });
        else if (env.type === 'media_groups_changed') onMessage({ type: 'media_groups_changed' });
        else if (env.type === 'cast_sessions_changed') onMessage({ type: 'cast_sessions_changed', reason: String(env.payload?.reason ?? '') });
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (ev) => {
      if (counted) {
        counted = false;
        liveSockets = Math.max(0, liveSockets - 1);
      }
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
