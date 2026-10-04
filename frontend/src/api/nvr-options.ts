import type { StreamOptions } from './nvr-settings';

/**
 * The answer of `GET /nvr/cameras/{id}/streams/{ref}/options[?codec=]` (API 3.3) is an ENVELOPE:
 * `{camera_id, stream_ref, codec, options, writable, not_writable_reason}`, where `options` is the stream's options or null
 * (capability documents unreadable). Until 0.1.160 the screen used the envelope itself as the options, so after a codec change
 * every list was undefined, the editor's render threw and "שמור" did nothing at all (owner report 2026-10-04).
 *
 * `unwrapOptions` returns the options inside the envelope, or null when they are missing or not in the shape the editor
 * reads (a bare options object - the in-memory demo - is accepted as is). Pure: no DOM, no network (unit-tested in Node).
 */
export function unwrapOptions(answer: unknown): StreamOptions | null {
  if (!answer || typeof answer !== 'object') return null;
  const a = answer as Record<string, unknown>;
  const inner = 'options' in a && !Array.isArray(a.codec) ? a.options : a;
  if (!isStreamOptions(inner)) return null;
  const o = inner as StreamOptions;
  return o.locks ? o : { ...o, locks: {} };
}

const isList = (v: unknown): boolean => Array.isArray(v);
const isMap = (v: unknown): boolean => !!v && typeof v === 'object' && !Array.isArray(v);
const isRange = (v: unknown): boolean => v === null || v === undefined || (isMap(v) && typeof (v as Record<string, unknown>).min === 'number' && typeof (v as Record<string, unknown>).max === 'number');

/** The fields the editor reads without a guard: lists, per-codec maps and the two ranges (a range may be null: not offered). */
export function isStreamOptions(v: unknown): boolean {
  if (!isMap(v)) return false;
  const o = v as Record<string, unknown>;
  return isList(o.codec) && isMap(o.profile) && isMap(o.resolution) && isList(o.fps) && isList(o.bitrate_mode) && isList(o.quality)
    && isRange(o.bitrate_kbps) && isRange(o.gop) && (o.locks === undefined || isMap(o.locks));
}
