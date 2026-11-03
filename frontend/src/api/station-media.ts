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
  /** Why not (TALK_REASONS): `off` (the setting says video only), `provider_local` (Arx's own source: video only), `pairing` (WisKey
   * chosen, no pairing key that signs), `not_listed` (WisKey publishes the W10 talk commands to Arx neither in its overview nor in its signed
   * capabilities), `capabilities_unread` (the overview lacks them and the signed capabilities could not be read), `unsupported` (the station
   * has none), `wiskey_unavailable`
   * (WisKey chosen but not reachable: Arx's own video serves), `forbidden` (no call permission on the station). */
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

/** WKDIRECT-295: the longest a talk through the station may last, in seconds (routers/settings.py `access.station_media_max_talk_s`).
 * The range is the station's own (`station_media_max_talk_seconds`: a whole number 1..86400, default 300); the station's published value
 * still applies on top, so a talk ends at the smaller of the two. */
export const TALK_MAX_KEY = 'access.station_media_max_talk_s';
export const TALK_MAX_DEFAULT_S = 300;
export const TALK_MAX_MIN_S = 1;
export const TALK_MAX_MAX_S = 86400;

/** The setting as the screen reads it: a whole number inside the range, else the default the server acts on. */
export function parseTalkMax(settings: Record<string, unknown> | null | undefined): number {
  const raw = settings?.[TALK_MAX_KEY];
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  return Number.isInteger(n) && n >= TALK_MAX_MIN_S && n <= TALK_MAX_MAX_S ? n : TALK_MAX_DEFAULT_S;
}

/** What the operator typed, as a value the server accepts (a whole number 1..86400), or null. */
export function talkMaxInput(text: string): number | null {
  const s = text.trim();
  if (!/^\d{1,5}$/.test(s)) return null;
  const n = Number(s);
  return n >= TALK_MAX_MIN_S && n <= TALK_MAX_MAX_S ? n : null;
}

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

// ---------------------------------------------------------------- WISKEY-TALK-DIAL-2382: the source choice, its readiness, the dial

/** The settings key of the station media source (routers/settings.py): `local` = Arx's own source (video only), `auto` = WisKey's signed
 * W10 source (video and talk) while it is ready, else Arx's own. */
export const STATION_MEDIA_PROVIDER_KEY = 'access.station_media_provider';
export type StationMediaProvider = 'local' | 'auto';

export function parseProvider(settings: Record<string, unknown> | null | undefined): StationMediaProvider {
  return settings?.[STATION_MEDIA_PROVIDER_KEY] === 'auto' ? 'auto' : 'local';
}

/** The closed reasons of `GET access-control/station-media/readiness` (services/intercom_media.py READINESS_CODES). WISKEY-TALK-CAPS-2382:
 * `video_not_listed` / `talk_not_listed` = listed neither in WisKey's overview nor in its signed capabilities; `capabilities_unread` = the
 * overview lacks them and the signed capabilities could not be read (`wiskey.capabilities.reason_kind` says why). */
export const READINESS_CODES = ['wiskey_unreachable', 'api_incompatible', 'video_not_listed', 'talk_not_listed', 'capabilities_unread', 'pairing_missing', 'pairing_key_rotated'] as const;
export type ReadinessCode = (typeof READINESS_CODES)[number];

/** WISKEY-TALK-CAPS-2382: why the signed capabilities read failed, grouped (services/wiskey_media_caps.py `reason_kind`). */
export const CAPS_REASON_KINDS = ['unreachable', 'refused', 'clock', 'incompatible', 'failed'] as const;
export type CapsReasonKind = (typeof CAPS_REASON_KINDS)[number];

/** WISKEY-TALK-CAPS-2382: WisKey's signed `direct/capabilities` as the readiness reports it. `not_needed`: the overview already lists W10;
 * `not_read`: not consulted (no key that signs); `read`: read (its own listing); `unread`: the signed read failed (`reason`, `reason_kind`). */
export interface StationMediaCapabilities {
  state: 'not_needed' | 'not_read' | 'read' | 'unread';
  video_listed: boolean;
  talk_listed: boolean;
  reason: string | null;
  reason_kind: string | null;
  source: 'join' | 'read' | null;
  read_at: string | null;
}

export function capsReasonKind(r: StationMediaReadiness | null | undefined): CapsReasonKind {
  const k = r?.wiskey?.capabilities?.reason_kind ?? '';
  return (CAPS_REASON_KINDS as readonly string[]).includes(k) ? (k as CapsReasonKind) : 'failed';
}

export interface StationMediaReadiness {
  choice: StationMediaProvider;
  /** The source a station read uses now (before WisKey's per-station answer). */
  active: 'local' | 'wiskey';
  mode: StationMediaMode;
  wiskey: {
    reachable: boolean;
    video_listed: boolean;
    talk_listed: boolean;
    signing: boolean;
    /** WISKEY-TALK-CAPS-2382: where W10 was found (`overview`, `capabilities`, or nowhere). Absent on an older server. */
    listed_in?: 'overview' | 'capabilities' | null;
    capabilities?: StationMediaCapabilities;
  };
  missing: string[];
  video_ready: boolean;
  talk_ready: boolean;
}

/** `system.configure`; read only (nothing is sent to WisKey). */
export const getStationMediaReadiness = () => get<StationMediaReadiness>('access-control/station-media/readiness');

/** The readiness as the Settings row says it: `ok` (WisKey can serve video and talk), `partial` / `missing` with the known codes in the
 * server's order (an unknown code is dropped, never shown). */
export function readinessSummary(r: StationMediaReadiness | null): { state: 'ok' | 'partial' | 'missing'; codes: ReadinessCode[] } | null {
  if (!r) return null;
  const codes = (Array.isArray(r.missing) ? r.missing : []).filter((c): c is ReadinessCode => (READINESS_CODES as readonly string[]).includes(c));
  if (!codes.length && r.talk_ready) return { state: 'ok', codes };
  return { state: r.video_ready ? 'partial' : 'missing', codes };
}

/** Every `talk.reason` the drawer explains (anything else reads as `unavailable`). */
export const TALK_REASONS = ['off', 'provider_local', 'pairing', 'not_listed', 'capabilities_unread', 'unsupported', 'wiskey_unavailable', 'forbidden', 'unavailable'] as const;
export type TalkReason = (typeof TALK_REASONS)[number];

export function talkReason(reason: string | null | undefined): TalkReason {
  return (TALK_REASONS as readonly string[]).includes(reason ?? '') ? (reason as TalkReason) : 'unavailable';
}

/** What the drawer's "dial the station" offers for a station read: `native` (Arx's own talk session), `reason` (why not, with the classic
 * panel as the secondary way), or `legacy` (nothing read yet, or the setting off: the classic-panel link exactly as before). `undefined`
 * media = not read yet; `null` = the read failed. */
export type DialState = { kind: 'native' } | { kind: 'reason'; reason: TalkReason } | { kind: 'legacy' };

export function dialState(mode: StationMediaMode, media: StationMedia | null | undefined): DialState {
  if (mode === 'off' || media === undefined) return { kind: 'legacy' };
  if (!media || media.state !== 'ready') return { kind: 'reason', reason: media?.state === 'off' ? 'off' : 'unavailable' };
  if (media.talk?.available) return { kind: 'native' };
  return { kind: 'reason', reason: talkReason(media.talk?.reason) };
}
