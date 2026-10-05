/** CR-030 wall display API: the display's own reads (`wall/config`, `wall/states`) and the Settings administration (`wall/profiles`). */
import { apiUrl, del, get, patch, post } from './client';

export type WallLayout = 'auto' | 'tablet-landscape' | 'tablet-portrait' | 'single';
export type WallStatus = 'connected' | 'not_connected' | 'never' | 'disabled';

export interface WallWindow { days: number[]; from: string; to: string }
export interface WallConfig {
  cameras: string[];
  scope: 'floor' | 'cameras';
  layout: WallLayout;
  grid: 'auto' | { cols: number; rows: number };
  rotate_s: 0 | 15 | 30 | 60 | 120;
  stream: 'sub';
  strip: string[];
  state_entities: string[];
  show_map: boolean;
  theme: 'follow' | 'dark' | 'light';
  alerts: { enabled: boolean; categories: string[]; min_severity: string; ack_allowed: boolean; takeover_timeout_s: number; sound: boolean };
  frame: { enabled: boolean; folder: string | null; idle_min: number; interval_s: number; fit: string; clock: boolean; motion: string };
  burn_in: { shift: boolean; dim_after_min: number; dim_to: number; shuffle_h: number };
  schedule: { windows: WallWindow[]; wake_on_alert_severity: string; wake_on_touch: boolean };
  offline: { show_last_frame_s: number; then: 'clock' };
}

export interface WallDisplayConfig {
  title: string;
  area_id: string | null;
  floor_id: string | null;
  version: number;
  config: WallConfig;
  cameras: { id: string; name: string }[];
  server_time: string;
  zone: string;
  alerts: unknown[];
}

export interface WallState { id: string; state: string | null; unit: string | null; name: string }

export interface WallProfile {
  user_id: string;
  username: string;
  display_name: string;
  title: string;
  area_id: string | null;
  floor_id: string | null;
  enabled: boolean;
  remote_allowed: boolean;
  version: number;
  config: WallConfig;
  status: WallStatus;
  connections: number;
  last_seen_at: string | null;
  last_channel: 'local' | 'remote' | null;
  created_at: string;
  updated_at: string;
  camera_names: string[];
  has_other_roles?: boolean;
}

export const getWallConfig = () => get<WallDisplayConfig>('wall/config');
export const getWallStates = (ids: string[]) => get<{ states: WallState[] }>(`wall/states?ids=${encodeURIComponent(ids.join(','))}`);
export const wallSocketUrl = (): string => {
  const u = new URL(apiUrl('wall/ws'));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
};

export const listWallProfiles = () => get<{ profiles: WallProfile[]; max_profiles: number }>('wall/profiles');
export const wallCandidates = () => get<{ users: { id: string; username: string; display_name: string }[] }>('wall/candidates');
export const createWallProfile = (body: { user_id: string; title: string; floor_id?: string | null; area_id?: string | null; cameras?: string[] }) => post<WallProfile>('wall/profiles', body);
export const patchWallProfile = (userId: string, body: { title?: string; area_id?: string | null; enabled?: boolean; remote_allowed?: boolean; config?: Partial<Record<keyof WallConfig, unknown>> }) =>
  patch<WallProfile>(`wall/profiles/${encodeURIComponent(userId)}`, body);
export const removeWallProfile = (userId: string) => del(`wall/profiles/${encodeURIComponent(userId)}`);

/** The Hebrew label of a list status (the "מצב" column). */
export const WALL_STATUS_LABEL: Record<WallStatus, string> = { connected: 'מחובר', not_connected: 'לא מחובר', never: 'טרם התחבר', disabled: 'מושבת' };
