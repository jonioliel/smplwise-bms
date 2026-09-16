/** Media, settings and snapshots against the add-on backend. */
import { apiUrl, get, patch, post } from './client';

export type Transport = 'auto' | 'webrtc' | 'mse';

export interface ProductSettings {
  'media.transport_default': Transport;
  'media.max_live_sessions': number;
  'media.wall_profile': 'sub' | 'main';
  'snapshots.max_age_s': number;
  'time.zone'?: string;
  'playback.max_sessions'?: number;
  'playback.lease_s'?: number;
  'exports.max_mb'?: number;
  'exports.retention_days'?: number;
  /** Design switch: 'a' = mockups v1.3 (SW A), 'b' = the earlier boards (SW B); names are editable. */
  'ui.design'?: 'a' | 'b';
  'ui.design_names'?: string;
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
}
export const cameraCapabilities = (cameraId: string, refresh = false) => get<CameraCapabilities>(`cameras/${cameraId}/capabilities${refresh ? '?refresh=true' : ''}`);

