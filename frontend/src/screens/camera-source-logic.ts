/**
 * CAMERA-STREAM-SOURCES-2410: the pure rules of the "video source" dialog and of a camera without a recorder - the rough address check
 * before sending (the server's source policy decides), the words of a refusal (never the server's code on the face), the result line
 * of a stream test, and which recorder-only actions a camera has.
 */
import type { Camera } from '../api/types';
import type { CameraSource, StreamTest } from '../api/camera-sources';
import { cst, type CsKey } from '../i18n/camera-sources';

export const MASK = '***';

/** '' when the address may be sent (or is empty), else the reason in words. The server checks it again, fully. */
export function urlProblem(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return /^rtsps?:\/\/[^\s]+$/i.test(v) ? '' : cst('urlBad');
}

/** Whether a manual draft can be saved: at least one address, each one shaped like an RTSP address. */
export function draftReady(main: string, sub: string): { ok: boolean; reason: string } {
  if (!main.trim() && !sub.trim()) return { ok: false, reason: cst('urlRequired') };
  const p = urlProblem(main) || urlProblem(sub);
  return p ? { ok: false, reason: p } : { ok: true, reason: '' };
}

/** The address still carries the stored (masked) password. */
export const isMasked = (value: string): boolean => value.includes(MASK);

const ERROR_KEY: Record<string, CsKey> = {
  stale: 'errStale',
  password_reenter: 'errPasswordReenter',
  source_not_allowed: 'errNotAllowed',
  source_not_supported: 'errNotSupported',
  no_stream_source: 'urlRequired',
  url_required: 'urlRequired',
  media_not_configured: 'errMedia',
  rate_limited: 'errRate',
  standalone_limit: 'errLimit',
  name_required: 'errName',
};

/** A refused or failed call, in words. */
export function sourceErrorText(err: unknown): string {
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : 0;
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code ?? '') : '';
  if (ERROR_KEY[code]) return cst(ERROR_KEY[code]);
  if (status === 403) return cst('errForbidden');
  if (status === 429) return cst('errRate');
  return cst('errGeneric');
}

/** The one line a stream test leaves: `הזרם תקין · 1920×1080 · H.264`, or the server's fixed Hebrew text. */
export function testLine(r: StreamTest): string {
  if (!r.ok) return r.message;
  const res = r.width && r.height ? `${r.width}×${r.height}` : '';
  const codec = r.codec_label ? `${res ? ' · ' : ''}${r.codec_label}` : '';
  return cst('testOk', { res, codec });
}

/** What a camera can do beyond live and snapshots. A camera without a recorder records nothing (owner answer 2). */
export function recorderActions(cam: Pick<Camera, 'standalone'> | null | undefined): { recording: boolean; reason: string } {
  return cam?.standalone ? { recording: false, reason: cst('noRecording') } : { recording: true, reason: '' };
}

/** The current source in words, for the settings row of the camera screen. */
export function sourceSummary(s: Pick<CameraSource, 'mode' | 'standalone'> | null, cam?: Pick<Camera, 'video_source' | 'standalone'> | null): string {
  const mode = s?.mode ?? cam?.video_source ?? 'nvr';
  return cst('current', { mode: mode === 'manual' ? cst('manual') : cst('fromNvr') });
}

/** The health line of a manual source ('' for a source on its recorder). */
export function healthLine(s: Pick<CameraSource, 'mode' | 'health'> | null): { text: string; tone: 'ok' | 'bad' | 'muted' } | null {
  if (!s || s.mode !== 'manual') return null;
  const st = s.health?.state ?? 'unknown';
  if (st === 'ok') return { text: cst('healthOk'), tone: 'ok' };
  if (st === 'failing') return { text: cst('healthFailing'), tone: 'bad' };
  return { text: cst('healthUnknown'), tone: 'muted' };
}
