/**
 * CR-020 S2 phase B: the two device-touching actions of the screen - a guarded stream write and its undo - with the error
 * handling the contract asks for. The screen and the editor both go through here, so there is one place that decides:
 *  - the write is sent ONCE and never repeated (no retry loop, no automatic second PUT, whatever the answer);
 *  - a lost answer (network error, `source_unavailable` with `details.outcome = "unknown"`) is an unknown outcome: "הסטטוס נבדק",
 *    the caller reads the camera again (a read, not a write) and nothing is retried;
 *  - `stale` carries the server's current stream, which replaces the row.
 */
import { ApiError } from '../api/client';
import { nvrSettings, type ChangeRef, type EncodingChanges, type StreamEncoding, type StreamWriteResult, type UndoResult } from '../api/nvr-settings';
import { errorLine, type ErrorLine, type ErrorShape } from './nvr-cameras-edit';

export type ActionResult =
  | { ok: true; stream: StreamEncoding; change: ChangeRef | null; rebootRequired: boolean; kind: 'write' | 'undo'; unchanged: boolean }
  | { ok: false; line: ErrorLine; code: string; stream: StreamEncoding | null };

/** An ApiError (or a network failure) as the plain shape the pure helpers read. A network failure on a write is an unknown outcome. */
export function shapeOf(err: unknown, sentWrite: boolean): ErrorShape {
  if (err instanceof ApiError) return { status: err.status, code: err.code, user_message: err.body.user_message, details: err.body.details ?? {} };
  return sentWrite ? { status: 0, code: 'source_unavailable', details: { outcome: 'unknown' } } : { status: 0, code: 'network', user_message: 'אין חיבור לשרת.' };
}

function failed(err: unknown, sentWrite: boolean): ActionResult {
  const shape = shapeOf(err, sentWrite);
  const stream = shape.code === 'stale' && shape.details?.stream && typeof shape.details.stream === 'object' ? (shape.details.stream as StreamEncoding) : null;
  return { ok: false, line: errorLine(shape), code: shape.code, stream };
}

/** One guarded write. `if_match` is the etag the page holds; `confirm: true` is sent because the person pressed the one confirmation. */
export async function runWrite(cameraId: string, stream: StreamEncoding, changes: EncodingChanges): Promise<ActionResult> {
  if (stream.etag === null) return failed(new ApiError(409, { code: 'stale', user_message: '', retryable: false, correlation_id: '', details: {} }), false);
  try {
    const r: StreamWriteResult = await nvrSettings().writeStream(cameraId, stream.stream_ref, { if_match: stream.etag, confirm: true, changes });
    return { ok: true, stream: r.stream, change: r.change, rebootRequired: r.reboot_required, kind: 'write', unchanged: r.change === null };
  } catch (err) {
    return failed(err, true);
  }
}

/** The undo: the press on the toast / the list's "בטל" IS the confirmation, so `confirm: true` goes with it (the adapter sends it). */
export async function runUndo(changeId: string): Promise<ActionResult> {
  try {
    const r: UndoResult = await nvrSettings().undo(changeId);
    return { ok: true, stream: r.stream, change: r.change, rebootRequired: r.reboot_required, kind: 'undo', unchanged: false };
  } catch (err) {
    return failed(err, true);
  }
}
