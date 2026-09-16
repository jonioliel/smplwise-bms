/** Recording search and playback sessions against the add-on backend (chapters 23/24). */
import { apiUrl, del, get, post } from './client';

export interface RecordingSegment {
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

export const recordingsForDay = (cameraId: string, date: string) => get<RecordingsResponse>(`cameras/${cameraId}/recordings?date=${date}`);

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

export const createPlayback = (cameraId: string, startAt: string) => post<PlaybackSession>('playback/sessions', { camera_id: cameraId, start_at: startAt });
export const seekPlayback = (id: string, startAt: string) => post<PlaybackSession>(`playback/sessions/${id}/seek`, { start_at: startAt });
export const closePlayback = (id: string) => del(`playback/sessions/${id}`);
export const listPlayback = () => get<{ sessions: (PlaybackSession & { username: string; bytes_down: number; seconds: number })[]; max_sessions: number; lease_s: number }>('playback/sessions');

/** ws(s):// URL of a session's relay socket for one generation (works under Ingress). */
export function playbackWsUrl(session: PlaybackSession): string {
  const u = new URL(apiUrl(`playback/sessions/${session.id}/ws?generation=${session.generation}`));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

/** Local calendar date (YYYY-MM-DD) of an instant in a zone. */
export function dateInZone(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Minute of the local day (0..1439, fractional) for an instant, in a zone. */
export function minuteInZone(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(at);
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
export interface PlaybackGroup {
  id: string;
  requested_at: string;
  generation: number;
  sessions: PlaybackSession[];
  missing: Record<string, string>;
  sync: 'best_effort';
}

export const createGroup = (cameraIds: string[], startAt: string) => post<PlaybackGroup>('playback/groups', { camera_ids: cameraIds, start_at: startAt });
export const seekGroup = (id: string, startAt: string) => post<PlaybackGroup>(`playback/groups/${id}/seek`, { start_at: startAt });
export const closeGroup = (id: string) => del(`playback/groups/${id}`);

/** JPEG frame from the recording at a UTC instant (T044); 404 when there is no picture there. */
export const frameUrl = (cameraId: string, atIso: string) => apiUrl(`cameras/${cameraId}/frame?at=${encodeURIComponent(atIso)}`);
