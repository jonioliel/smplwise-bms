/**
 * The native stations and doors screen's data path (CR-036 slice S6): the typed reads of `/api/v1/access-control/...`
 * (backend routers/access_control_reads.py, services/intercom_adapter.py) and the one write helper that has no typed
 * endpoint yet (the announcement). The browser never names a WisKey command: every read is one typed GET, filtered
 * server-side by the caller's station scope (omitted stations never arrive), and every write goes through the existing
 * physical-action endpoints of api/intercom.ts (door release, call signal, TTS), which keep their command envelope
 * (`client_request_id`, `expires_at`), their audit rows and "never queued, never retried".
 *
 * Reply head of the JSON reads: `{state, configured, last_error, fetched_at, <key>, sync}` (+ `fresh` for the cached and the
 * station reads). `<key>` is null unless `state` is `ready`; `state` `unsupported` means this WisKey does not list the
 * command (nothing was sent); a station the caller may not see answers 404 `intercom_station_not_found`, exactly like one
 * that does not exist.
 */
import { ApiError, get } from './client';
import { actionOutcome, speakAtIntercom, type DisplayZone, type IntercomFeedState, type IntercomLock, type IntercomTtsStatus } from './intercom';

export type ReadState = IntercomFeedState | 'unsupported';

export interface ReadHead {
  state: ReadState;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
  /** False for a copy kept from before a disconnect (or a cached read past its time): last-known, never current. */
  fresh?: boolean;
}

/** A station's technical part (`access.stations.read` on it; null for everyone else - the field is absent, not hidden). */
export interface StationTechnical {
  loaded: boolean | null;
  model: string | null;
  firmware: string | null;
  capabilities: {
    max_users: number | null;
    max_cards: number | null;
    cards_per_person: number | null;
    pin_min: number | null;
    pin_max: number | null;
    card_min: number | null;
    card_max: number | null;
    name_max: number | null;
    pin_mode: string | null;
    pin_writable: boolean | null;
    schedules: boolean | null;
  } | null;
  clock: {
    source: string | null;
    status: string | null;
    zone: DisplayZone | null;
    device_zone: DisplayZone | null;
    skew_seconds: number | null;
    time_mode: string | null;
    drift_state: string | null;
    checked_at: string | null;
    error: string | null;
  } | null;
  event_status: { stream: string | null; history: string | null; reconnects: number | null; last_frame_at: string | null; recovered_until: string | null } | null;
  scanned_at: string | null;
  scanning: boolean | null;
  reconciled_at: string | null;
  last_poll_ms: number | null;
}

/** The station's last sync / scan error texts: only where the sync-error rule lets this caller see them (`access.admin.read`
 * on the station, or the administrator's `access.sync_errors_everyone`); null otherwise. A machine code, never free text. */
export interface StationErrors {
  last_error: string | null;
  scan_error: string | null;
}

export type CallState = 'idle' | 'ringing' | 'in_call' | 'ending' | 'unavailable' | 'unknown';
export type StationSync = 'offline' | 'pending' | 'syncing' | 'synced' | 'error' | 'unknown';

/** One station as the typed endpoint serves it (services/intercom_authority.view_station): the entry-center fields, the call
 * state (no caller name exists in it), the relays, and the technical / error parts under their own rules. */
export interface AccessStation {
  id: string;
  name: string;
  online: boolean;
  call_state: CallState | string;
  sync_state: StationSync | string;
  lock_enabled: boolean;
  locks: IntercomLock[];
  has_camera: boolean;
  camera_entity: string | null;
  last_seen: string | null;
  zone: DisplayZone | null;
  technical: StationTechnical | null;
  errors: StationErrors | null;
}

export type AccessStationsReply = ReadHead & { stations: AccessStation[] | null; default_zone: DisplayZone | null };
export type AccessStationReply = ReadHead & { station: AccessStation | null; default_zone: DisplayZone | null };

/** `GET features`: per native feature whether the installed WisKey offers it (its `api.commands`); `available` is null while
 * there is no served copy yet. A screen hides what is not available. */
export interface AccessFeatures extends ReadHead {
  client_api: number;
  api: { version: number | null; min_client: number | null } | null;
  features: Record<string, { available: boolean | null; reason: string | null }>;
}

export const getAccessFeatures = () => get<AccessFeatures>('access-control/features');
export const getAccessStations = () => get<AccessStationsReply>('access-control/stations');
export const getAccessStation = (stationId: string) => get<AccessStationReply>(`access-control/stations/${encodeURIComponent(stationId)}`);

// ---------------------------------------------------------------- one station's door settings (access.stations.read, view only)

export type WeekdayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export interface Period {
  start: string;
  end: string;
}
/** WisKey's schedule policy of a door program (shape W? until WisKey's W2: every field is optional in practice, so the screen
 * reads it defensively and shows "unknown" for what it cannot map). */
export interface StationPolicy {
  timezone: string | null;
  name: string | null;
  weekly: Partial<Record<WeekdayName, Period[]>>;
  holidays: { name: string | null; start: string | null; end: string | null; periods: Period[] }[];
}
export interface StationProgram {
  door: number | null;
  revision: number | null;
  enabled: boolean;
  removing: boolean;
  policy: StationPolicy | null;
  execution: { owned: boolean; attempted: string | null; status: 'idle' | 'opening' | 'held_acknowledged' | 'restoring' | 'unknown' | null };
  error: string | null;
  checked_at: string | null;
}
export interface StationPrograms {
  programs: StationProgram[];
  saved: { door: number | null; revision: number | null; policy: StationPolicy | null }[];
  timezone: string | null;
  native_supported: boolean;
}
export type PublicPinState = 'configured' | 'absent' | 'unknown';
/** Presence only: whether a public door code is set, per slot (`configured` true / false / null = unknown). Never a value. */
export interface StationCodes {
  public_pin_state: PublicPinState | null;
  slots: { slot: number; configured: boolean | null }[];
  capabilities: { advertised: boolean | null; min: number | null; max: number | null };
  checked_at: string | null;
}

export type ProgramsReply = ReadHead & { programs: StationPrograms | null };
export type CodesReply = ReadHead & { codes: StationCodes | null };

const one = (stationId: string) => `access-control/stations/${encodeURIComponent(stationId)}`;
export const getStationPrograms = (stationId: string) => get<ProgramsReply>(`${one(stationId)}/programs`);
export const getStationCodes = (stationId: string) => get<CodesReply>(`${one(stationId)}/codes`);

// ---------------------------------------------------------------- the announcement (a write, behind ONE named function)

export interface AnnounceRequest {
  /** The stations to speak at, resolved by the dialog from its choice (a station, a place or all) over the stations the
   * caller sees, online only. */
  stationIds: string[];
  engine_id: string;
  language: string | null;
  message: string;
}

export type AnnounceOutcomeKind = 'sent' | 'not_sent' | 'refused' | 'unknown';

export interface AnnounceOutcome {
  station_id: string;
  outcome: AnnounceOutcomeKind;
  /** The progress WisKey reported with the reply (`started`, ...); later progress arrives as `intercom_tts` notices. */
  status: IntercomTtsStatus | null;
  /** The server's Hebrew message for a failure; null for a success. */
  error: string | null;
  /** WisKey's own code when the server carried it in `details.wiskey_code` (`audio_busy`), else the server's code
   * (`intercom_station_offline`, ...). */
  code: string | null;
  /** `details.retry_after_s` when the server gave one. */
  retry_after_s: number | null;
}

/**
 * THE BINDING POINT FOR S11. Announces `message` at each station of `req.stationIds`, one station after the other, ONCE each
 * (never retried, never queued - a failure at one station never stops the rest, and never repeats it). Today this is one
 * `POST /intercom/stations/{id}/tts` per station (api/intercom.ts `speakAtIntercom`: the existing physical-action write path,
 * gated since 2.4.9 by `access.call` over the station chain, audited per station with the spoken text, a fresh command id per
 * station). Owner answers of 2026-10-12: announcing is part of the call permission (`access.call`) and "all stations" /
 * a whole place are allowed for an operator inside their scope. A later slice may replace this loop with one multi-target
 * endpoint; the dialog calls only this function, so nothing in the screen changes when it does.
 *
 * `speak` is injectable for the unit specs.
 */
export async function announceToStations(req: AnnounceRequest, speak: typeof speakAtIntercom = speakAtIntercom): Promise<AnnounceOutcome[]> {
  const out: AnnounceOutcome[] = [];
  for (const id of req.stationIds) {
    try {
      const r = await speak(id, { engine_id: req.engine_id, language: req.language, message: req.message });
      out.push({ station_id: id, outcome: 'sent', status: r.tts ?? null, error: null, code: null, retry_after_s: null });
    } catch (err) {
      const outcome = actionOutcome(err);
      const e = err instanceof ApiError ? err : null;
      const retry = Number(e?.body?.details?.retry_after_s);
      out.push({
        station_id: id,
        outcome,
        status: null,
        error: e ? e.message : null,
        code: e ? String(e.body?.details?.wiskey_code ?? e.code) : null,
        retry_after_s: Number.isFinite(retry) && retry >= 0 ? retry : null,
      });
    }
  }
  return out;
}
