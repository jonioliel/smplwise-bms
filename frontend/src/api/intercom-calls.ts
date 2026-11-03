/**
 * WISKEY-INBOUND-CALLS-2382: incoming door-station calls - the typed client of backend routers/intercom_calls.py.
 *
 *   GET intercom/calls/active    (access.call somewhere) the ringing calls this user may answer + the calls this user answered from Arx
 *   GET intercom/calls           the call log of a station (or all the stations this user may read), newest first
 *   GET / PUT intercom/calls/settings   (system.configure) who gets the banner - OFF by default
 *
 * Nothing here acts on a station: answer / reject / hang up stay on `signalIntercomCall` (api/intercom.ts), the door on
 * `releaseIntercomDoor`, talk on `startTalk` (api/station-media.ts) - each with its own server-side checks and audit.
 */
import { get, put } from './client';

export type CallBannerMode = 'off' | 'everyone' | 'roles';

export interface CallBannerSettings {
  mode: CallBannerMode;
  /** Role ids (mode `roles`): only holders of one of them get the banner. */
  roles: string[];
  /** Station ids; empty = every station. */
  stations: string[];
  /** The ring tone (still subject to the quiet hours). */
  sound: boolean;
}

export interface CallBannerSettingsView {
  settings: CallBannerSettings;
  defaults: CallBannerSettings;
  roles: { id: string; name: string }[];
  stations: { id: string; name: string }[];
}

export interface IncomingCall {
  call_id: string;
  station_id: string;
  station_name: string;
  state: 'ringing' | 'in_call';
  rang_at: string;
  answered_at: string | null;
  /** This user answered it from Arx (the banner keeps its in-call controls). */
  answered_by_me: boolean;
  /** Seconds since the ring (or since this user answered), on the server's clock when it answered. */
  elapsed_s: number;
  online: boolean;
  has_camera: boolean;
  /** A still can be asked for (`intercomSnapshotUrl`). */
  still: boolean;
  /** This user may open a door of this station (the one door rule); the route decides again. */
  can_open_door: boolean;
  locks: { physical_index: number; name: string | null }[];
}

export type CallSoundReason = 'setting_off' | 'quiet_hours' | null;

export interface ActiveCalls {
  enabled: boolean;
  mode: CallBannerMode;
  feed: string;
  sound: 'ring' | 'silent';
  sound_reason: CallSoundReason;
  server_time_ms: number;
  calls: IncomingCall[];
}

export type CallOutcome = 'answered' | 'rejected' | 'missed' | 'unknown';

/** One row of the call log (the server keeps the user ids; only names and "mine" come back). */
export interface CallLogRow {
  id: string;
  station_id: string;
  station_name: string;
  rang_at: string;
  observed: 'ringing' | 'in_call';
  state: 'ringing' | 'in_call' | 'ended';
  outcome: CallOutcome | null;
  answered_at: string | null;
  answered_via: 'arx' | 'elsewhere' | null;
  answered_by_name: string | null;
  answered_by_me: boolean;
  ended_at: string | null;
  ended_by_name: string | null;
  door_opened_at: string | null;
  door_opened_by_name: string | null;
  updated_at: string;
}

export interface CallLogPage {
  calls: CallLogRow[];
  next: string | null;
  retention_days: number;
}

export const getActiveCalls = () => get<ActiveCalls>('intercom/calls/active');

export function getCallLog(stationId: string | null, limit = 10, before?: string | null): Promise<CallLogPage> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (stationId) qs.set('station_id', stationId);
  if (before) qs.set('before', before);
  return get<CallLogPage>(`intercom/calls?${qs.toString()}`);
}

export const getCallBannerSettings = () => get<CallBannerSettingsView>('intercom/calls/settings');
export const putCallBannerSettings = (s: CallBannerSettings) => put<CallBannerSettingsView>('intercom/calls/settings', s);

/** The station screen's drawer of a station (the native screen, or the embedded panel where the native one is off). */
export const stationDrawerHref = (stationId: string): string => `#/wiskey/devices?station=${encodeURIComponent(stationId)}`;
