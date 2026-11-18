/** Recording search and playback sessions against the add-on backend (chapters 23/24). */
import { apiUrl, del, get, path, post, query } from './client';

interface RecordingSegment {
  start_at: string; // UTC ISO
  end_at: string;
  kind: 'continuous' | 'motion' | 'alarm' | 'event' | 'manual' | 'unknown';
  track_id: number;
  start_raw: string;
  end_raw: string;
}

export interface RecordingsResponse {
  camera_id: string;
  from: string;
  to: string;
  track_id: number | null;
  segments: RecordingSegment[];
  coverage: 'complete' | 'partial' | 'unknown';
  matches: number;
  pages: number;
  searched_at: string;
  timezone: string;
  note: string;
}

export const recordingsForDay = (cameraId: string, date: string) => get<RecordingsResponse>(path`cameras/${cameraId}/recordings` + query({ date }));

export interface PlaybackSession {
  id: string;
  camera_id: string;
  generation: number;
  state: 'creating' | 'buffering' | 'playing' | 'paused' | 'seeking' | 'ended' | 'expired' | 'failed' | 'closed';
  requested_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  media_anchor: { source_at: string; media_pts_seconds: number; verified: boolean } | null;
  time_precision: 'verified' | 'keyframe_limited' | 'estimated' | 'unknown';
  media_handle: string | null;
  expires_at: string;
  capabilities: { seek: boolean; pause: boolean; frame_step: boolean; supported_speeds: number[] };
  playback_end_at: string;
  moved_to_next_segment?: boolean;
}

/** Sessions and groups this page opened; released with a beacon when the page is left, so a closed tab never holds a quota slot. */
const openSessions = new Set<string>();
const openGroups = new Set<string>();
function releaseOnUnload(): void {
  if (!openSessions.size && !openGroups.size) return;
  for (const id of openGroups) navigator.sendBeacon?.(apiUrl(path`playback/groups/${id}/close`), '');
  for (const id of openSessions) navigator.sendBeacon?.(apiUrl(path`playback/sessions/${id}/close`), '');
  openSessions.clear();
  openGroups.clear();
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', releaseOnUnload);

export const createPlayback = async (cameraId: string, startAt: string) => {
  const s = await post<PlaybackSession>('playback/sessions', { camera_id: cameraId, start_at: startAt });
  openSessions.add(s.id);
  return s;
};
export const seekPlayback = (id: string, startAt: string) => post<PlaybackSession>(path`playback/sessions/${id}/seek`, { start_at: startAt });
export const closePlayback = (id: string) => {
  openSessions.delete(id);
  return del(path`playback/sessions/${id}`);
};
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by T028/T029 (playback sessions).
export const listPlayback = () => get<{ sessions: (PlaybackSession & { username: string; bytes_down: number; seconds: number })[]; max_sessions: number; lease_s: number }>('playback/sessions');

/** ws(s):// URL of a session's relay socket for one generation (works under Ingress). */
export function playbackWsUrl(session: PlaybackSession): string {
  const u = new URL(apiUrl(path`playback/sessions/${session.id}/ws` + query({ generation: session.generation })));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

/**
 * CR-INV-PLAYBACK-2440 (review 06:PERF-1): one formatter per zone. `minuteInZone` runs for every segment, event marker and bookmark of
 * a day and twice a second for the playing cursor; building an `Intl.DateTimeFormat` each time was the cost. The formatters are
 * immutable, so they are kept; an unknown zone still throws where it did (nothing is cached for it).
 */
const dayFormats = new Map<string, Intl.DateTimeFormat>();
const minuteFormats = new Map<string, Intl.DateTimeFormat>();
function zoneFormat(cache: Map<string, Intl.DateTimeFormat>, timeZone: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let f = cache.get(timeZone);
  if (!f) {
    f = make();
    cache.set(timeZone, f);
  }
  return f;
}

/** CR-INV-PLAYBACK-2440 (review 06:PLAY-2): a seek that the server answers with "this session is over / not found" is tried once
 * more as a new session - only when there was a session to lose, and only once (a create that itself answers `not_found` used to
 * be tried again without end). */
export function retryLostSession(code: string | undefined, hadSession: boolean, retried: boolean): boolean {
  return (code === 'session_over' || code === 'not_found') && hadSession && !retried;
}

/** Local calendar date (YYYY-MM-DD) of an instant in a zone. */
export function dateInZone(at: Date, timeZone: string): string {
  const parts = zoneFormat(dayFormats, timeZone, () => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Minute of the local day (0..1439, fractional) for an instant, in a zone. */
export function minuteInZone(at: Date, timeZone: string): number {
  const parts = zoneFormat(minuteFormats, timeZone, () => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return g('hour') * 60 + g('minute') + g('second') / 60;
}

/** Instant for a local date + minute of day in a zone (DST-safe by searching the offset at that instant). */
export function instantInZone(date: string, minute: number, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minute / 60), Math.floor(minute % 60), Math.round((minute % 1) * 60));
  // offset at the guessed instant
  const offsetAt = (t: number) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
    const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
    return asUtc - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t); // second pass fixes instants near a DST transition
  return new Date(t);
}

/** Playback group (chapter 25): one reference time for 2–4 cameras, each with its own session. */
/** T042: what the browser measured for a group — |drift| p95 per member against the master clock. */
type SyncQuality = 'waiting' | 'synced' | 'slight' | 'out_of_sync';
interface SyncMember {
  p95: number | null;
  samples: number;
  last: number | null;
  resyncs: number;
  state: 'waiting' | 'measured' | 'late';
  /** Measured time from the last seek to the first rendered frame (ms); what a re-seek aims ahead by. */
  latency_ms?: number | null;
  /** How many times the tile's playback rate was nudged (faster/slower) to close a small drift without a re-seek. */
  nudges?: number;
}
export interface SyncStats {
  p95: number | null;
  quality: SyncQuality;
  samples: number;
  partial: boolean;
  missing: string[];
  members: Record<string, SyncMember>;
}
interface SyncReport {
  p95_s: number | null;
  quality: SyncQuality;
  samples: number;
  partial: boolean;
  members: Record<string, SyncMember>;
  reported_at: string;
}

export interface PlaybackGroup {
  id: string;
  requested_at: string;
  generation: number;
  sessions: PlaybackSession[];
  missing: Record<string, string>;
  sync: 'best_effort';
  sync_report?: SyncReport | null;
}

export const createGroup = async (cameraIds: string[], startAt: string) => {
  const g = await post<PlaybackGroup>('playback/groups', { camera_ids: cameraIds, start_at: startAt });
  openGroups.add(g.id);
  return g;
};
export const seekGroup = (id: string, startAt: string) => post<PlaybackGroup>(path`playback/groups/${id}/seek`, { start_at: startAt });
export const closeGroup = (id: string) => {
  openGroups.delete(id);
  return del(path`playback/groups/${id}`);
};
export const reportGroupSync = (id: string, stats: SyncStats) =>
  post<{ ok: boolean; sync_report: SyncReport }>(path`playback/groups/${id}/sync`, { p95_s: stats.p95, quality: stats.quality, samples: stats.samples, partial: stats.partial, members: stats.members });

/** JPEG frame from the recording at a UTC instant (T044); 404 when there is no picture there. */
export const frameUrl = (cameraId: string, atIso: string) => apiUrl(path`cameras/${cameraId}/frame` + query({ at: atIso }));

/** RECORDED-DAYS-MONTH-2407: local dates of one month (YYYY-MM, the installation's zone) with any recording of a camera. */
interface RecordedDaysResponse {
  camera_id: string;
  month: string;
  timezone: string;
  days: string[];
  source: 'daily_distribution' | 'segment_search' | 'record_dates' | 'future';
  coverage: 'complete' | 'partial';
  through: string | null;
  searched_at: string;
  note: string;
}
export const recordedDays = (cameraId: string, month: string) => get<RecordedDaysResponse>(path`cameras/${cameraId}/recordings/days` + query({ month }));
