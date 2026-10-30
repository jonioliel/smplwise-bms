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
  /** SERVICEIA1-295: the service-management section row for a user who sees one section only - `hide_single` (default) | `always`. shell/nav.ts. */
  'ui.tickets_section_row'?: string;
  /** How the tab groups are presented on the phone (0.1.153; הגדרות › כללי › לשוניות): `tabs` (default) | `hybrid` | `dropdown`, and a per-group override. shell/tabs-mode.ts. */
  'ui.tabs_mode'?: string;
  'ui.tabs_mode_groups'?: Record<string, string>;
  'ui.dd_style'?: string;
  'ui.dd_style_groups'?: Record<string, string>;
  'ui.dd_phone'?: string;
  /** 2.0.2: from how many cameras a multi-select picker searches (always | 4 | 8 | never) and the camera comparison picker's look (dropdown | chips). */
  'ui.dd_search'?: string;
  'ui.dd_picker'?: string;
  'ui.dd_place'?: string;
  /** Unreleased: the size of a dropdown, `sm` | `md` (default) | `lg`, and a per-group override. shell/tabs-mode.ts. */
  'ui.dd_size'?: string;
  'ui.dd_size_groups'?: Record<string, string>;
  'ui.dd_ring'?: string;
  'ui.dd_ring_groups'?: Record<string, string>;
  'ui.dd_panel'?: string;
  'ui.dd_panel_groups'?: Record<string, string>;
  /** The phone UX guards (הגדרות › כללי › אפשרויות נייד, owner 2026-09-30): which kinds of management the phone UI hides - shell/phone.ts. */
  'ui.mobile'?: Record<string, boolean>;
  /** 2.29.0: the cross-section / synoptic map / fire-alarm-UI options (הגדרות › כללי › חתך הבניין), one object - xsection/xs-model.ts, backend services/xs_options.py. */
  'ui.xs'?: Record<string, unknown>;
  /** The colour of each thing the investigation timeline draws (owner 2026-10-01): option -> palette name | #rrggbb; api/timeline-colors.ts. */
  'timeline.colors'?: Record<string, string>;
  /** Who sees the timeline's helper line / the recording screen's diagnostics block (owner 2026-10-01): all | installers | hidden; api/playback-display.ts. */
  'playback.helper_line'?: 'all' | 'installers' | 'hidden';
  'playback.diagnostics'?: 'all' | 'installers' | 'hidden';
  /** The floor the map's floor tab opens first (an existing floor id); '' = the first floor the user may read. */
  'map.default_floor'?: string;
  'media.transport_default': Transport;
  'media.max_live_sessions': number;
  'media.wall_profile': 'sub' | 'main';
  /** Owner 2026-10-01: 'true' shows the live player's notes about how it plays (banner, remote-policy hint, "מנגן דרך" line); default 'false'. */
  'media.video_notices'?: 'true' | 'false';
  /** NVRMASK-295: privacy-mask preview / write to the NVR; off by default. */
  'nvr.privacy_mask_write'?: 'true' | 'false';
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
  'plan.quality'?: 'auto' | '1' | '2';
  /** CR-006 1b: the presence tint's fade after the last motion - 'off' (the tint only while a sensor is on) or the
   * window in minutes as a string (default '3'), per installation. */
  'plan.presence_fade'?: string;
  /** CAMSUGGEST138-295: defaults of "suggest the nearest camera" in the zone editor - max distance in % of the plan width (default '35'),
   * how strongly a known field of view that misses the zone counts against a camera in % (default '50'), suggestions offered 1-3 (default '3'). */
  'plan.camsuggest_distance'?: string;
  'plan.camsuggest_fov'?: string;
  'plan.camsuggest_count'?: string;
  /** K88 (owner 2026-10-04): where the live plan shows besides the map tab - 'devices' (a plan view in חשמל והתקנים),
   * 'area' (a card on the area page); [] = nowhere new. Default both. */
  'plan.surfaces'?: ('devices' | 'area')[];
  /** CR-029 S0 (Plan Studio 6): the installation's look dials of the realistic 3D (api/plan-view.ts PlanViewDials without
   * default_view; services/plan_view.py); read back whole, patched partially. */
  'plan.view'?: Partial<Omit<import('./plan-view').PlanViewDials, 'default_view'>>;
  /** CR-029 S3: what "prepare stills and lighting" bakes and the storage caps (services/plan_bakes.py); a PATCH sends a partial object. */
  'plan.bakes'?: Partial<import('../map/still-bake').BakeSetting>;
  /** CR-029 S2 (owner 2026-10-11): where the sun stands - 'home' (default; the home's own location) or 'manual' (the two
   * values below, an explicit override). The 3D view reads the resolved location from /plan-view/prefs, never these. */
  'site.location_source'?: 'home' | 'manual';
  /** The manual override in degrees: a number (or null when not set) read back, a string ('' clears) sent. */
  'site.latitude'?: number | string | null;
  'site.longitude'?: number | string | null;
  'time.zone'?: string;
  'playback.max_sessions'?: number;
  'playback.lease_s'?: number;
  /** 2.0.0: seconds without media progress before the recording player says "מתחבר מחדש" (2-30, default 5). */
  'playback.stall_s'?: number;
  /** 2.0.0: automatic "resume from here" attempts before "הניגון נעצר" (0-5, default 3; 0 = none). */
  'playback.auto_resume_attempts'?: number;
  /** CR-024: EXPERIMENTAL synchronized playback of cameras of different recorders ('true' | 'false', default 'false'). */
  'playback.cross_recorder_sync'?: string;
  'exports.max_mb'?: number;
  /** BACKUP-HASH-ENC: the minimum length of the backup password (8-64, default 12; 8 is the server's hard floor). */
  'backup.password_min'?: number;
  'exports.retention_days'?: number;
  'events.retention_days'?: number;
  /** DEVHIST (CR-032): how long the device activity rows (the long-press popup) are kept, 7-365 days, default 90. */
  'device_activity.retention_days'?: number;
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
  /** TOPPILL-295: the pill's search: off (default) | admins | roles | all; `roles` reads ui.global_search_roles (comma-separated role ids). */
  'ui.global_search'?: 'off' | 'admins' | 'roles' | 'all';
  'ui.global_search_roles'?: string;
  /** Screen the UI opens on (0.1.68): explore | live | wall | events | playback. */
  'ui.start_route'?: string;
  /** 'true' hides the map area from the navigation for everyone (0.1.68). */
  'ui.hide_map'?: string;
  /** 'false' hides the security area's "תמונת מצב" (the live overview) from the navigation for everyone (2026-09-30); default 'true'. */
  'ui.security_snapshot'?: string;
  /** S2: 'true' lets the Home Assistant recorder fill entity states the local history does not know (marked as secondary). */
  'history.ha_secondary'?: string;
  /** CR-TIMESCRUB101: 'true' turns the historical map's time scrub on (layer legend, playback, per-layer lanes); default 'false'. */
  'history.timescrub'?: string;
  /** CR-TIMESCRUB101: the longest window one range request may cover, in days (default 7, 1..30). */
  'history.range_max_days'?: number;
  /** CR-TIMESCRUB101 section 7: how long presence sensor states are kept in the local history, in days (default 7, 1..30). */
  'history.presence_retention_days'?: number;
  /** הגדרות › מתגי מסכי כניסה (CR-005 recorded decision 2026-09-28): per SMPLWISE WisKey screen, 'wiskey' = WisKey's own
   * Home Assistant panel embedded as-is (the default), 'smplwise' = the screen built here. */
  'access.ui.overview'?: 'wiskey' | 'smplwise';
  'access.ui.events'?: 'wiskey' | 'smplwise';
  'access.ui.people'?: 'wiskey' | 'smplwise';
  /** CR-036 S6: "תחנות ודלתות" (route #/wiskey/devices). */
  'access.ui.stations'?: 'wiskey' | 'smplwise';
  /** CR-036 S9: "לוחות זמנים" (route #/wiskey/schedules, read only); 'wiskey' = no own tab (the embedded panel's tools keep them). */
  'access.ui.schedules'?: 'wiskey' | 'smplwise';
  /** CR-036 S6 (owner answers of 2026-10-12, every decision a setting): what the native stations screen shows - who sees the
   * incoming-call hint, the talk button, the announcement targets, the quick phrases (one per line). */
  'access.call_hint'?: 'everyone' | 'call';
  'access.talk_button'?: 'classic' | 'hidden';
  'access.announce_scope'?: 'scope' | 'station';
  'access.announce_phrases'?: string;
  /** CR-036 S18: the station drawer's own live video and push-to-talk - off (default) | video | video_talk. */
  'access.station_media'?: 'off' | 'video' | 'video_talk';
  /** W10CLIENT-295 / WKDIRECT-295: the longest talk through a station, seconds (1..86400, default 300). */
  'access.station_media_max_talk_s'?: number;
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
  /** Design foundation (2026-10-01): the installation's skin (design/skins) and light / dark / auto choice (design/apply.ts). */
  'ui.skin'?: 'classic' | 'domus' | 'tesla' | 'bubble' | 'crystal' | 'infra' | 'soft';
  'ui.scheme'?: 'light' | 'dark' | 'auto';
  /** MOTIONSETTING-297: motion - auto (follow the OS reduction) | full (ignore it for non-essential motion) | reduced (zero durations); design/apply.ts. */
  'ui.motion'?: 'auto' | 'full' | 'reduced';
  /** SKINCOMP-297: the rail tone - `auto` (the skin's own rail) or `dark` (the skin's dark rail where it has one: Arx Infra = direction D). */
  'ui.rail_tone'?: 'auto' | 'dark';
  /** 2.4.4: the accent colour and the switch-on colour - 'default' | a preset id | '#rrggbb' (design/brand.ts). */
  'ui.accent'?: string;
  'ui.toggle_on'?: string;
  /** CRY (2026-10-10): the background artwork behind the glass - the built-in day / night pair, none, or the installation's uploads
   * (design/background.ts). `ui.background_images` is read-only here: the version stamp of each uploaded slot, written by the upload routes. */
  'ui.background'?: 'builtin' | 'none' | 'custom';
  'ui.background_images'?: { day: string | null; night: string | null };
  /** Bubble foundation (2026-10-02): the installation's look dials (every dial present; shape in design/look.ts). A user's own partial `ui.look` (/me/prefs) wins per dial. */
  'ui.look'?: Record<string, unknown>;
  /** Release 0.1.155: the installation's custom colour palettes (design/palette.ts; the backend refuses a palette that fails the contrast checks). */
  'ui.palettes'?: Record<string, unknown>[];
  /** The palette of the style (styles/devices-themes.ts DEVICE_THEMES; 'default' today, no picker until 6b). */
  'devices.theme'?: string;
  'devices.default_view'?: 'cards' | 'tiles';
  'devices.show_sensors'?: 'true' | 'false';
  'devices.show_climate_strip'?: 'true' | 'false';
  'devices.density'?: 'comfortable' | 'compact';
  /** CR-007 6b: the device area's colour scheme - light (default), dark, or auto (the viewer's operating system). */
  'devices.scheme'?: 'light' | 'dark' | 'auto';
  /** 2.4.4: the glass screens' light / dark behaviour - follow the product's scheme (default) | always light | always dark. */
  'devices.glass_scheme'?: 'follow' | 'light' | 'dark';
  /** Owner 2026-09-30 (area redesign): the direction every area screen opens in - dense tiles | sequential sections. */
  'devices.area_design'?: 'tiles' | 'sections';
  /** Release 0.1.149: what shows next to an area's name / in a floor's header (api/area-row.ts), read back as objects. */
  'devices.area_row'?: { items: string[]; climate: 'icon' | 'temp' | 'mode'; show_empty: boolean };
  'devices.floor_row'?: { items: string[] };
  /** CR-008 SmplWise Arx remote access (הגדרות › גישה מרחוק). */
  'remote.policy'?: 'flag' | 'any_role';
  /** CR-008 amendment (owner 2026-10-01): a system administrator signs in remotely without a per-user flag (default 'true'). */
  'remote.admins_default'?: 'true' | 'false';
  'remote.session'?: 'rolling_90d' | 'browser_session' | 'rolling_90d_idle_lock';
  'remote.idle_lock_minutes'?: number;
  'remote.default_profile'?: 'main' | 'sub';
  'remote.mse_fallback'?: 'true' | 'false';
  'remote.require_mfa_admin'?: 'true' | 'false';
  /** K11 (owner 2026-10-06): the TOTP second factor is optional (default); 'admins' refuses a remote sign-in of an administrator without one. */
  'security.second_factor_policy'?: 'optional' | 'admins';
  /** Security review 2.2.0 H1: 'enforce' (default) asks a new bearer sign-in (the phone app's own calls) for the factor too; 'off' = the pre-2.2.1 bearer path. */
  'security.second_factor_bearer'?: 'enforce' | 'off';
  /** CR-008 P2: live streams one remote sign-in may hold open at once (default 16); the next one is refused (429). */
  'remote.max_live_streams'?: number;
  /** The stream the camera wall plays on the remote channel (default 'sub'; LAN / Ingress use media.wall_profile). */
  'remote.wall_profile'?: 'main' | 'sub';
  /** CR-008 P2: 'true' enforces the stricter CSP on the remote channel (default 'false': report-only). */
  'remote.csp_enforce'?: 'true' | 'false';
  /** 2026-10-06: the Android app download offer of the sign-in page (https address, optional version label and SHA-256); '' = not offered. */
  'app.android_url'?: string;
  'app.android_version'?: string;
  'app.android_sha256'?: string;
  /** 2.4.4: CR-021 self-update switch - 'true' (default) | 'false' (POST /system/update/apply is refused; Settings › Updates says so). */
  'update.apply_enabled'?: 'true' | 'false';
  /** CR-038: the optional tickets module - 'false' (default) hides its area and answers 404 on every tickets route; system.configure. */
  'tickets.enabled'?: 'true' | 'false';
}

/** `nvr_channels`: the recorder's channel capacity when known; `warnings`: advisory only, never blocks a save. */
export type SettingsResponse = { settings: ProductSettings; can_edit: boolean; /** TOPPILL-295: this caller may use the global search */ search_allowed?: boolean; nvr_channels?: number | null; warnings?: { key: string; message: string }[] };
export const getSettings = () => get<SettingsResponse>('settings');
export const patchSettings = (body: Partial<ProductSettings>) => patch<SettingsResponse>('settings', body);

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
  /** NVRMASK-295: a region's `enabled` is the parser's verdict (master on + polygon); `device_enabled` is the device's own flag (reads false while masking on V4.84). */
  privacy_mask: { enabled: boolean; normalized: ZoneFrame; regions: (ZonePolygon & { device_enabled?: boolean | null })[]; active_regions?: number } | null;
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

