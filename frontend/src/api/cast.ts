/**
 * CR-028 phase 1 (CAST1 UI): the typed client of `/api/v1/multimedia/cast/*` (docs/changes/CR-028-CAST-TO-SCREENS.md section 12.5).
 * Read it with `multimedia.cast.*` settings in mind: the picker asks `targets`, the pill and the live screen ask `sessions`, the
 * Settings forms use `config` / `screens` / `origin/check` / `test` (administrator, local network only: `BLOCKED_ON_REMOTE`).
 * Nothing here contacts a device; the server does, once per command, never retried. Without a backend (the static demo) the
 * calls answer nothing useful and the screens never offer the button (`isApi()`).
 */
import { del, get, post, put } from './client';

export type CastTargetState = 'free' | 'casting' | 'playing_music' | 'off' | 'unavailable';
export type CastBlocked = 'no_permission' | 'unsupported' | 'not_allowed' | 'public' | 'unavailable';
export type CastBlockedDisplay = 'grey_reason' | 'hide' | 'grey_admin';
export type CastProfile = 'sub' | 'main';
export type CastDuration = 'default' | 'permanent';
/** `ready: false` carries the first reason: relay_off / disabled / origin_missing / origin_unverified / bridge_not_paired / bridge_outdated. */
export type CastNotReady = 'relay_off' | 'disabled' | 'origin_missing' | 'origin_unverified' | 'bridge_not_paired' | 'bridge_outdated';

export interface CastTarget {
  key: string;
  name: string;
  kind: string;
  floor_id: string | null;
  floor_name: string | null;
  area_name: string | null;
  state: CastTargetState;
  blocked: CastBlocked | null;
  confidence: string | null;
  permanent_allowed: boolean;
  minutes: number;
  main_allowed: boolean;
  casting_session_id: string | null;
}

export interface CastTargets {
  ready: boolean;
  reason: CastNotReady | string | null;
  targets: CastTarget[];
  blocked_display: CastBlockedDisplay;
  main_possible: boolean;
  max_sessions: number;
  active: number;
}

export type CastSessionState = 'starting' | 'playing' | 'not_confirmed' | 'stopped';
export type CastStopReason = 'user' | 'timeout' | 'replaced' | 'target_gone' | 'error' | 'admin' | 'refused';

export interface CastSession {
  session_id: string;
  device_key: string;
  screen_name: string;
  floor_name: string | null;
  area_name: string | null;
  kind: 'camera' | 'test';
  camera_id: string;
  /** null without video.live on the camera */
  camera_name: string | null;
  profile: CastProfile;
  state: CastSessionState;
  started_at: string;
  /** null = a permanent cast */
  expires_at: string | null;
  permanent: boolean;
  extended_n: number;
  extensions_left: number;
  first_segment_at: string | null;
  started_by_name: string | null;
  mine: boolean;
  channel: 'local' | 'remote';
  stopped_at: string | null;
  stop_reason: CastStopReason | null;
  power_off_after: boolean;
  power_off_state: string | null;
  can: { stop: boolean; extend: boolean; switch: boolean };
}

export interface CastSessions {
  sessions: CastSession[];
  max_sessions: number;
}

export interface CastStartBody {
  target_key: string;
  camera_id: string;
  profile?: CastProfile;
  duration?: CastDuration;
  client_request_id: string;
  confirmed?: boolean;
  power_off_after?: boolean;
}

/** 202 accepted, or 200 with `status: refused` and the `error` code (the bridge or the TV refused after the row was written). */
export interface CastStartResult {
  status: 'accepted' | 'existing' | 'refused';
  error: string | null;
  session: CastSession;
}

export interface CastStopResult {
  status: 'stopped';
  stop: string;
  power_off: 'sent' | 'failed' | 'cancelled' | 'skipped' | null;
  session: CastSession;
}

export interface CastConfig {
  enabled: boolean;
  origin: string | null;
  origin_verified_at: string | null;
  max_sessions: number;
  minutes: number;
  allow_main: boolean;
  power_off_after: boolean;
  blocked_display: CastBlockedDisplay;
  max_extensions: number;
  test_seconds: number;
}

export interface CastConfigAnswer {
  config: CastConfig;
  relay: { option: boolean; listening: boolean; container_port: number; error: string | null };
  bridge: { paired: boolean; version: string | null; required: string; ready: boolean };
  ready: boolean;
  reason: CastNotReady | string | null;
}

export type CastConfigPatch = Partial<Pick<CastConfig, 'enabled' | 'origin' | 'max_sessions' | 'minutes' | 'allow_main' | 'power_off_after' | 'blocked_display'>>;

export interface CastScreenSettings {
  allow: boolean;
  method: 'auto' | 'cast_hls' | 'none';
  minutes: number | null;
  permanent: boolean;
  allow_main: boolean | null;
}

export interface CastScreenCap {
  method: string;
  confidence: string;
  reason: string;
}

export interface CastAdminScreen {
  key: string;
  name: string;
  kind: string;
  approved: boolean;
  public: boolean;
  floor_name: string | null;
  area_name: string | null;
  detected: CastScreenCap | null;
  effective: CastScreenCap;
  target_entity_id: string | null;
  settings: CastScreenSettings;
  casting_session_id: string | null;
}

export type CastOriginReason = 'relay_off' | 'origin_missing' | 'unreachable' | 'not_this_relay';

const BASE = 'multimedia/cast';

export const castTargets = (camera?: string) => get<CastTargets>(`${BASE}/targets${camera ? `?camera=${encodeURIComponent(camera)}` : ''}`);
export const castSessions = () => get<CastSessions>(`${BASE}/sessions`);
export const castStart = (body: CastStartBody) => post<CastStartResult>(`${BASE}/sessions`, body);
export const castExtend = (id: string) => post<CastSession>(`${BASE}/sessions/${encodeURIComponent(id)}/extend`);
export const castSwitch = (id: string, body: { camera_id: string; profile?: CastProfile }) => post<CastStartResult>(`${BASE}/sessions/${encodeURIComponent(id)}/switch`, body);
export const castStop = (id: string, powerOff?: boolean) => del(`${BASE}/sessions/${encodeURIComponent(id)}${powerOff === false ? '?power_off=false' : ''}`) as unknown as Promise<CastStopResult>;
export const castConfig = () => get<CastConfigAnswer>(`${BASE}/config`);
export const castPutConfig = (patch: CastConfigPatch) => put<{ changed: string[] } & CastConfigAnswer>(`${BASE}/config`, patch);
export const castCheckOrigin = () => post<{ ok: boolean; reason: CastOriginReason | null }>(`${BASE}/origin/check`);
export const castAdminScreens = () => get<{ screens: CastAdminScreen[] }>(`${BASE}/screens`);
export const castPutScreen = (key: string, patch: Partial<CastScreenSettings>) => put<{ key: string; settings: CastScreenSettings; changed: string[] }>(`${BASE}/screens/${encodeURIComponent(key)}`, patch);
export const castTest = (body: { target_key: string; camera_id: string }) => post<CastStartResult>(`${BASE}/test`, body);

/** A fresh idempotency key per user action (the same start tapped twice is one session). */
export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
