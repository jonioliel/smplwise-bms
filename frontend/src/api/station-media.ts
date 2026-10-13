/**
 * A station's live video and talk (CR-036 slice S18): the typed endpoints of backend routers/intercom_media.py.
 *
 * - `GET access-control/stations/{id}/media`: what the drawer may offer (`state` off / unavailable / ready), the video profiles
 *   and the relay path of each (opened by sw-live-player as a server-named `livePath`), and the talk capability. Never a source,
 *   an address, a credential or an intercom token: the server builds the reply field by field.
 * - `POST access-control/stations/{id}/talk` (the call permission, `access.call`, on the station): reserves the station's single
 *   talker slot; `POST access-control/talk/{session}/stop` ends it; the session's socket carries the microphone's G.711 frames
 *   while the push-to-talk button is held (wiskey/talk-session.ts).
 * All of it sits behind the administrator setting `access.station_media` (off by default).
 */
import { get, post } from './client';
import { relayWsUrl, type Transport } from './media';

export type StationMediaMode = 'off' | 'video' | 'video_talk';
export type MediaProfileId = 'sub' | 'main';

export interface MediaProfile {
  id: MediaProfileId;
  codec: string;
  transports: ('webrtc' | 'mse')[];
  width: number | null;
  height: number | null;
  fps: number | null;
}

export interface StationMediaVideo {
  profiles: MediaProfile[];
  default_profile: MediaProfileId | null;
  /** The caller holds `video.live` on the station (without it: the still, as before). */
  allowed: boolean;
  /** Relay path per profile (empty without `allowed`). */
  paths: Partial<Record<MediaProfileId, string>>;
  max_viewers: number;
  viewers: number;
}

export interface StationMediaTalk {
  available: boolean;
  /** Why not: `off` (the setting says video only), `unsupported` (no talk transport: the classic panel keeps it), `forbidden`. */
  reason: string | null;
  transport?: string;
  codec?: 'pcmu' | 'pcma';
  duplex?: 'half' | 'full';
  max_seconds?: number;
  sample_rate?: number;
  frame_ms?: number;
  /** Someone talks to the station right now (who is never said). */
  busy?: boolean;
}

export interface StationMedia {
  station_id: string;
  mode: StationMediaMode;
  state: 'off' | 'unavailable' | 'ready';
  reason: string | null;
  video: StationMediaVideo | null;
  talk: StationMediaTalk | null;
  listen: boolean;
  expires_at: string | null;
}

export interface TalkStartReply {
  session: string;
  ws_path: string;
  expires_at: string;
  max_seconds: number;
  attach_within_s: number;
  transport: string;
  codec: 'pcmu' | 'pcma';
  duplex: 'half' | 'full';
  sample_rate: number;
  frame_ms: number;
  request_id: string | null;
}

const station = (id: string) => `access-control/stations/${encodeURIComponent(id)}`;

export const getStationMedia = (id: string) => get<StationMedia>(`${station(id)}/media`);

/** One request per press of the button; never retried (a refusal is shown, the operator presses again). */
export const startTalk = (id: string, clientRequestId: string) => post<TalkStartReply>(`${station(id)}/talk`, { client_request_id: clientRequestId });

export const stopTalk = (session: string) => post<{ stopped: boolean }>(`access-control/talk/${encodeURIComponent(session)}/stop`);

export const talkSocketUrl = (wsPath: string): string => relayWsUrl(wsPath);

/** The settings key (routers/settings.py) and its three values, in the order Settings offers them. */
export const STATION_MEDIA_KEY = 'access.station_media';
export const STATION_MEDIA_MODES: readonly StationMediaMode[] = ['off', 'video', 'video_talk'];

/** The administrator setting as the screen reads it; anything unreadable is `off` (the still and the classic panel). */
export function parseMediaMode(settings: Record<string, unknown> | null | undefined): StationMediaMode {
  const v = settings?.[STATION_MEDIA_KEY];
  return v === 'video' || v === 'video_talk' ? v : 'off';
}

/** The owner's rule (lab facts 2026-09-14): the sub profile plays WebRTC first with MSE as the fallback (`auto`); the main profile
 * is MSE (Chrome assembles no frame of a main-profile stream over WebRTC). A profile that lacks the preferred transport keeps the
 * one it has. */
export function playerModeFor(profile: MediaProfile | undefined): Transport {
  const t = profile?.transports ?? [];
  if (profile?.id === 'main') return t.includes('mse') ? 'mse' : 'webrtc';
  if (t.includes('webrtc') && t.includes('mse')) return 'auto';
  return t.includes('mse') ? 'mse' : 'webrtc';
}

/** The profile to start on: the server's default when it is offered, else the first one. */
export function startProfile(video: StationMediaVideo | null): MediaProfileId | null {
  if (!video?.profiles.length) return null;
  const ids = video.profiles.map((p) => p.id);
  return video.default_profile && ids.includes(video.default_profile) ? video.default_profile : ids[0];
}

/** A random client request id (8-64 url-safe characters): one per press, carried into the audit row. */
export function newRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `ptt-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
