/** Media, settings and snapshots against the add-on backend. */
import { apiUrl, get, patch, post } from './client';
import type { CameraEncoding } from './types';
import type { NavSizeWire } from './me-prefs';

export type Transport = 'auto' | 'webrtc' | 'mse';

/** `ui.tabs` (2026-09-30, docs/architecture/TABS_CONFIG.md): per navigation section, the preferred order of its tab ids and
 * the hidden ones. Keyed by section id (`security`, `security.live`, ...; the registry is shell/nav.ts TAB_SECTIONS). The
 * whole object is replaced on every PATCH. */
export interface TabsSectionConfig {
  order: string[];
  hidden: string[];
  /** 0.1.148: this section's own bar style (absent = the default of its hierarchy level). */
  style?: TabStyle;
}
/** The sections of `ui.tabs`. The stored object also carries the reserved key `styles` (TabStyleDefaults), which
 * `normalizeTabsConfig` leaves out - nav.ts parses it apart (`normalizeTabStyles`). */
export type TabsConfig = Record<string, TabsSectionConfig>;
/** The look of a tab bar: the segmented pill, the underline row, or the compact underline row (sw-tabs `variant`). */
export type TabStyle = 'pill' | 'underline' | 'underline-compact';
/** `ui.tabs.styles`: the default style per hierarchy level (level1 = the first bar of an area, level2 = the sub-tabs). */
export interface TabStyleDefaults {
  level1?: TabStyle;
  level2?: TabStyle;
}

export interface ProductSettings {
  /** The installation's default size of the navigation rail / bottom bar (UI round 1; הגדרות › כללי › גודל הניווט). */
  'ui.nav_size'?: NavSizeWire;
  /** Installation-wide tab order and visibility per navigation section (הגדרות › כללי › לשוניות); `{}` = the built-in tabs. */
  'ui.tabs'?: Record<string, unknown>;
  /** The phone UX guards (הגדרות › כללי › אפשרויות נייד, owner 2026-09-30): which kinds of management the phone UI hides - shell/phone.ts. */
  'ui.mobile'?: Record<string, boolean>;
  /** The floor the map's floor tab opens first (an existing floor id); '' = the first floor the user may read. */
  'map.default_floor'?: string;
  'media.transport_default': Transport;
  'media.max_live_sessions': number;
  'media.wall_profile': 'sub' | 'main';
  'snapshots.max_age_s': number;
  'plan.estimates'?: 'true' | 'false';
  /** Default levels view on every map (0.1.89): 'all' shows every level together, 'default' opens on the floor's
   * default level; the level chips still switch levels from there. */
  'plan.levels'?: 'all' | 'default';
  /** CR-009 (owner 2026-09-29): the shared room's home levels in the other floor's level bar. */
  'map.shared_levels'?: 'show' | 'hide';
  /** The view a floor map opens in (live map, history map, event page). */
  'map.default_view'?: '2d' | '3d';
  /** CR-006: the 3D quality level a browser opens with ('1' schematic, '2' shadows, materials and the cutaway); each
   * browser may override it (sw.plan3d.quality) and drops to 1 by itself when level 2 misses the frame budget. */
  'plan.quality'?: '1' | '2';
  /** CR-006 1b: the presence tint's fade after the last motion - 'off' (the tint only while a sensor is on) or the
   * window in minutes as a string (default '3'), per installation. */
  'plan.presence_fade'?: string;
  'time.zone'?: string;
  'playback.max_sessions'?: number;
  'playback.lease_s'?: number;
  'exports.max_mb'?: number;
  'exports.retention_days'?: number;
  'events.retention_days'?: number;
  /** T055: audit rows older than this are pruned by the janitor (was a fixed 365-day constant). */
  'audit.retention_days'?: number;
  /** T050: the largest evidence bundle accepted for verification / import, in MB (16-4096). */
  'cases.import_max_mb'?: number;
  /** DEPRECATED (0.1.148): the design switch is gone - SW A is the only design; the server still accepts these two keys, nothing reads them. */
  'ui.design'?: 'a' | 'b';
  'ui.design_names'?: string;
  /** Owner 2026-09-29: the summary tiles' shape (Live overview, devices screens) - api/tile-layout.ts. */
  'ui.tile_layout'?: 'auto' | 'cards' | 'compact';
  /** Owner-set defaults (0.1.61): wall tile count, kiosk page layout, hidden AI search tab. */
  'ui.wall_count'?: number | string;
  'ui.kiosk_cols'?: number | string;
  'ui.kiosk_rows'?: number | string;
  'ui.hide_search'?: string;
  /** Screen the UI opens on (0.1.68): explore | live | wall | events | playback. */
  'ui.start_route'?: string;
  /** 'true' hides the map area from the navigation for everyone (0.1.68). */
  'ui.hide_map'?: string;
  /** 'false' hides the security area's "תמונת מצב" (the live overview) from the navigation for everyone (2026-09-30); default 'true'. */
  'ui.security_snapshot'?: string;
  /** S2: 'true' lets the Home Assistant recorder fill entity states the local history does not know (marked as secondary). */
  'history.ha_secondary'?: string;
  /** הגדרות › בקרות כניסה (CR-005 recorded decision 2026-09-28): per SMPLWISE WisKey screen, 'wiskey' = WisKey's own
   * Home Assistant panel embedded as-is (the default), 'smplwise' = the screen built here. */
  'access.ui.overview'?: 'wiskey' | 'smplwise';
  'access.ui.events'?: 'wiskey' | 'smplwise';
  'access.ui.people'?: 'wiskey' | 'smplwise';
  /** 'true' hides the whole WisKey area from the navigation for everyone, regardless of role (T054 follow-up); the
   * access.ui.* choices above apply only while this is false. */
  'ui.hide_wiskey'?: string;
  /** Owner 2026-09-30: how much of the screen the embedded WisKey panel uses - 'normal' (the content area, default),
   * 'fit' (rendered larger and scaled down by ui.wiskey_scale percent) or 'full' (the whole viewport, small exit). */
  'ui.wiskey_size'?: 'normal' | 'fit' | 'full';
  'ui.wiskey_scale'?: '100' | '90' | '80' | '70';
  /** WisKey rc.37 installation defaults for the panel's `density` (overview cards) and `wall` (camera-wall streams)
   * parameters; 'auto' (default) leaves the parameter out. A user's own choice (החשבון שלי) wins. */
  'ui.wiskey_density'?: 'auto' | '4' | '6' | '8' | '9' | '12';
  'ui.wiskey_wall'?: 'auto' | '4' | '9' | '12';
  /** 'true' (experimental, default 'false') embeds WisKey inside the Home Assistant Companion app too, relaying the
   * app's sign-in bridge into the frame (wiskey/companion-bridge.ts). */
  'access.phone_embed'?: string;
  /** CR-006 phase 2 (AI-rendered floor skins, slice 2a): the image provider, its model, the privacy acknowledgement
   * (nothing is sent while it is 'false') and the render budgets. The API key is an add-on option, never a setting. */
  'skins.provider'?: 'openai';
  'skins.model'?: string;
  'skins.privacy_ack'?: 'true' | 'false';
  'skins.budget_renders_per_floor'?: number;
  'skins.budget_monthly'?: number;
  /** CR-007 slice 6a (הגדרות › חשמל והתקנים): the device-control screens' look, per installation - the style
   * ('smplwise' today's look, 'glass' the approved mockup's), the building screen's first view (a viewer's own toggle
   * wins), the sensors card / count, the climate strip, and the density. */
  'devices.style'?: 'smplwise' | 'glass';
  /** The palette of the style (styles/devices-themes.ts DEVICE_THEMES; 'default' today, no picker until 6b). */
  'devices.theme'?: string;
  'devices.default_view'?: 'cards' | 'tiles';
  'devices.show_sensors'?: 'true' | 'false';
  'devices.show_climate_strip'?: 'true' | 'false';
  'devices.density'?: 'comfortable' | 'compact';
  /** CR-007 6b: the device area's colour scheme - light (default), dark, or auto (the viewer's operating system). */
  'devices.scheme'?: 'light' | 'dark' | 'auto';
  /** Owner 2026-09-30 (area redesign): the direction every area screen opens in - dense tiles | sequential sections. */
  'devices.area_design'?: 'tiles' | 'sections';
  /** CR-008 SmplWise Arx remote access (הגדרות › גישה מרחוק). */
  'remote.policy'?: 'flag' | 'any_role';
  'remote.session'?: 'rolling_90d' | 'browser_session' | 'rolling_90d_idle_lock';
  'remote.idle_lock_minutes'?: number;
  'remote.default_profile'?: 'main' | 'sub';
  'remote.mse_fallback'?: 'true' | 'false';
  'remote.require_mfa_admin'?: 'true' | 'false';
  /** CR-008 P2: live streams one remote sign-in may hold open at once (default 16); the next one is refused (429). */
  'remote.max_live_streams'?: number;
  /** The stream the camera wall plays on the remote channel (default 'sub'; LAN / Ingress use media.wall_profile). */
  'remote.wall_profile'?: 'main' | 'sub';
  /** CR-008 P2: 'true' enforces the stricter CSP on the remote channel (default 'false': report-only). */
  'remote.csp_enforce'?: 'true' | 'false';
}

export const getSettings = () => get<{ settings: ProductSettings; can_edit: boolean }>('settings');
export const patchSettings = (body: Partial<ProductSettings>) => patch<{ settings: ProductSettings; can_edit: boolean }>('settings', body);

export interface LiveInfo {
  camera_id: string;
  profile: 'sub' | 'main';
  ws_path: string;
  transport_default: Transport;
  max_live_sessions: number;
  active_sessions: number;
  media_configured: boolean;
}

export const liveInfo = (cameraId: string, profile: 'sub' | 'main') => get<LiveInfo>(`media/live/${cameraId}?profile=${profile}`);
export const syncStreams = () => post<{ created: number; updated: number; unchanged: number; streams: string[]; foreign_streams_untouched: number }>('media/streams/sync');
export const listStreams = () => get<{ go2rtc: Record<string, unknown>; streams: { name: string; online: boolean; sources: string[] }[]; foreign_streams: number }>('media/streams');
export const listSessions = () => get<{ sessions: { id: string; camera_id: string; stream: string; username: string; seconds: number; bytes_down: number }[]; max_live_sessions: number }>('media/sessions');

/** Snapshot URL; `bust` forces the browser past its cache (the server keeps its own max-age). */
export function snapshotUrl(cameraId: string, bust?: number): string {
  return apiUrl(`cameras/${cameraId}/snapshot.jpg${bust ? `?t=${bust}` : ''}`);
}

/** ws(s):// URL of the live relay for a camera, relative to the page (works under Ingress). */
export function liveWsUrl(cameraId: string, profile: 'sub' | 'main'): string {
  const u = new URL(apiUrl(`media/live/${cameraId}/ws?profile=${profile}`));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

/** ws(s):// URL of a live relay path the server named (`live_path` of a resolved camera card: a standalone camera shown live). */
export function relayWsUrl(path: string): string {
  const u = new URL(apiUrl(path));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

const TRANSPORT_KEY = 'sw.transport';

/** Per-browser override of the transport (set from the player); '' = follow the product default. */
export function transportOverride(): Transport | '' {
  try {
    const v = localStorage.getItem(TRANSPORT_KEY);
    return v === 'webrtc' || v === 'mse' || v === 'auto' ? v : '';
  } catch {
    return '';
  }
}

export function setTransportOverride(v: Transport | '') {
  try {
    if (v) localStorage.setItem(TRANSPORT_KEY, v);
    else localStorage.removeItem(TRANSPORT_KEY);
  } catch {
    /* per-browser convenience only */
  }
}

/** The camera's detection configuration as the NVR holds it (T075, read-only). Coordinates are in the device's own normalized frame. */
export interface ZoneMotion {
  enabled: boolean;
  region_type: string;
  sensitivity: number | null;
  rows: number;
  cols: number;
  cells: boolean[][];
  coverage_pct: number;
  target_types: string[];
}
export interface ZonePolygon {
  id: string;
  enabled?: boolean;
  sensitivity?: number;
  points: number[][];
}
export interface ZoneLine {
  id: string;
  enabled: boolean;
  direction: string;
  points: number[][];
}
export interface ZoneFrame {
  width: number;
  height: number;
}
export interface CameraZones {
  camera_id: string;
  channel: number;
  source: 'nvr';
  read_only: true;
  write_reason: string;
  /** 0.1.65: the caller holds nvr.config.detection - the motion grid can be edited and written to the NVR. */
  can_edit_motion?: boolean;
  /** The sensitivity values the device accepts (min / max / step); the NVR ignores values in between. */
  sensitivity_caps?: { min: number; max: number; step: number } | null;
  fetched_at: string;
  cached: boolean;
  motion: ZoneMotion | null;
  privacy_mask: { enabled: boolean; normalized: ZoneFrame; regions: ZonePolygon[] } | null;
  intrusion: { enabled: boolean; normalized: ZoneFrame; regions: ZonePolygon[] } | null;
  line_crossing: { enabled: boolean; normalized: ZoneFrame; lines: ZoneLine[] } | null;
  unsupported: Record<string, string>;
}
export const cameraZones = (cameraId: string, refresh = false) => get<CameraZones>(`cameras/${cameraId}/zones${refresh ? '?refresh=true' : ''}`);

/** Capability facts the NVR reports for a camera (T045 / T012, read-only): never guessed, 'unknown' is an honest state. */
export interface CameraCapabilities {
  camera_id: string;
  channel: number;
  source: 'nvr';
  read_only: true;
  writes: { ptz_move: string; preset_recall: string; talk: string; reason: string };
  digital_zoom: 'browser_only';
  fetched_at: string;
  cached: boolean;
  ptz: { state: 'supported' | 'unsupported' | 'unknown'; reason: string | null; presets: { id: string; name: string }[] | null; preset_count: number | null };
  audio: { state: 'available' | 'disabled' | 'unsupported' | 'unknown'; reason: string | null; channel_id: string | null; codec: string | null };
  /** CR-008 D7: the stream encodings from the capability registry (the last discovery), with the settings hint. */
  video?: CameraEncoding | null;
}
export const cameraCapabilities = (cameraId: string, refresh = false) => get<CameraCapabilities>(`cameras/${cameraId}/capabilities${refresh ? '?refresh=true' : ''}`);

