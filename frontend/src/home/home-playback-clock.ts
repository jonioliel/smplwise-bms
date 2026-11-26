// STALE-ANSWERS-2540 (review SCR-28, second half): the home recordings' position comes from the player's own media clock, the way the
// investigate screen reads it (screens/investigate-playback.ts `currentInstant`: the session's requested start + the player's
// `mediaTime`). The old clock was a wall-clock counter started at the seek answer: it ran ahead of the picture through a stall and on
// past the end of the recording. Pure (no DOM): tests/unit-stale-answers-2540.spec.ts pins it.
import { dateInZone, minuteInZone } from '../api/recordings';

/** The minute of `day` (0..1439.99, in `tz`) the player shows now, or null when it cannot be told (no session start, no media clock):
 * the position then stays where the seek put it. Past midnight it stays at the end of the day the timeline draws.
 * `sinceSeekS` (seconds since this session's answer): a media clock ahead of it by more than 2 s is still the previous generation's
 * (the player has not reconnected to the new stream yet) and is not read. */
export function playerMinute(session: { requested_at?: string | null; actual_start_at?: string | null }, mediaTime: number | null | undefined, tz: string, day: string, sinceSeekS = Infinity): number | null {
  if (typeof mediaTime !== 'number' || !Number.isFinite(mediaTime) || mediaTime < 0 || mediaTime > sinceSeekS + 2) return null;
  const base = [session.requested_at, session.actual_start_at].map((s) => (s ? Date.parse(s) : NaN)).find((t) => Number.isFinite(t));
  if (base === undefined) return null;
  const at = new Date(base + mediaTime * 1000);
  const d = dateInZone(at, tz);
  if (d === day) return Math.min(1439.99, minuteInZone(at, tz));
  return d > day ? 1439.99 : null;
}
