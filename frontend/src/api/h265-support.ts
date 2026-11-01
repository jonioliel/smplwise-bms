/**
 * LIVE-H265-2341 - can this browser decode H.265 (HEVC) live video, per transport. On the azia lab every `smplwise_` stream
 * returned frames, yet the H.265 channels stayed black in Chrome / Edge: WebRTC there does not decode H.265, and MSE only
 * with hardware decoding. The player tells the server, per attempt, whether the transport it is about to use decodes H.265
 * (`?h265=1|0` on the live socket); the server then picks the stream (routers/media.py `live_ws`, services/live_codec.py):
 * the other profile when it is H.264, else an H.264 variant go2rtc transcodes, else a refusal with a Hebrew reason - and
 * the installation setting `media.h265_policy` (אוטומטי / תמיד זרם משני / תמיד תרגום / כבוי) decides which of those are allowed.
 *
 * Pure functions with the browser objects passed in (the unit spec mocks them); `h265Support()` reads the real ones once.
 */
import type { CameraEncoding } from './types';
import type { Profile, StepTransport, VideoStep } from './video-policy';

export interface H265Support {
  /** RTCRtpReceiver.getCapabilities('video') lists H.265 (Safari 17+ with the experimental flag on, some Chromium builds) */
  webrtc: boolean;
  /** MediaSource.isTypeSupported(...hvc1 / hev1...) (Safari; Chrome / Edge with hardware HEVC decoding) */
  mse: boolean;
}

/** The fMP4 codec strings go2rtc uses for H.265 (Main profile, level 5.1 and a plain one). */
export const HEVC_MSE_TYPES = ['video/mp4; codecs="hvc1.1.6.L153.B0"', 'video/mp4; codecs="hev1.1.6.L153.B0"', 'video/mp4; codecs="hvc1"'];

export interface H265Env {
  RTCRtpReceiver?: { getCapabilities?: (kind: string) => { codecs?: { mimeType?: string }[] } | null } | undefined;
  MediaSource?: { isTypeSupported?: (type: string) => boolean } | undefined;
}

export function detectH265(env: H265Env | undefined = globalThis as unknown as H265Env): H265Support {
  let webrtc = false;
  let mse = false;
  try {
    const caps = env?.RTCRtpReceiver?.getCapabilities?.('video');
    webrtc = !!caps?.codecs?.some((c) => /^video\/(h265|hevc)$/i.test(c?.mimeType ?? ''));
  } catch {
    webrtc = false;
  }
  try {
    const is = env?.MediaSource?.isTypeSupported;
    mse = !!is && HEVC_MSE_TYPES.some((t) => is.call(env!.MediaSource, t));
  } catch {
    mse = false;
  }
  return { webrtc, mse };
}

let cached: H265Support | null = null;

/** This browser's answer, read once per page. */
export function h265Support(): H265Support {
  if (!cached) cached = detectH265();
  return cached;
}

export function canDecodeH265(support: H265Support, transport: StepTransport): boolean {
  return transport === 'webrtc' ? support.webrtc : support.mse;
}

/** The value of the live socket's `h265` parameter for one attempt. */
export function h265Param(support: H265Support, transport: StepTransport): '1' | '0' {
  return canDecodeH265(support, transport) ? '1' : '0';
}

export type CodecFamily = 'h264' | 'h265' | 'mjpeg' | 'other' | 'unknown';

/** The codec family of one profile from the camera registry (the same folding as services/live_codec.codec_family). */
export function streamCodec(encoding: CameraEncoding | null | undefined, profile: Profile): CodecFamily {
  const e = encoding?.[profile] as ({ codec?: string | null; codec_raw?: string | null; reason?: string } | null | undefined);
  const raw = e?.codec || e?.codec_raw || '';
  if (!raw) return e?.reason === 'h265' ? 'h265' : 'unknown';
  const n = raw.toLowerCase().replace(/[.+\- ]/g, '').replace('smart', '');
  if (n === 'h264' || n === 'avc' || n === 'avc1') return 'h264';
  if (n === 'h265' || n === 'hevc' || n === 'hvc1' || n === 'hev1') return 'h265';
  if (n === 'mjpeg' || n === 'jpeg' || n === 'mjpg') return 'mjpeg';
  return 'other';
}

export type H265Policy = 'auto' | 'sub' | 'transcode' | 'off';

export function normalizePolicy(v: unknown): H265Policy {
  return v === 'sub' || v === 'transcode' || v === 'off' ? v : 'auto';
}

/**
 * The order of an `auto` chain for an H.265 stream: when this browser decodes H.265 over MSE but not over WebRTC, the
 * MSE step of the same profile goes first - the real picture, no transcoding, and no WebRTC wait that cannot succeed (the
 * stream "plays as is" over the transport choice). Any other case keeps the chain: the server picks the fallback per
 * attempt (the other profile, then the transcoded variant), and an MSE step later in the chain is the next resort.
 * `off` never reorders (the stream as it is, today's behaviour).
 */
export function orderForH265(steps: VideoStep[], encoding: CameraEncoding | null | undefined, support: H265Support, mode: string, policy: H265Policy): VideoStep[] {
  if (policy === 'off' || mode !== 'auto' || !steps.length) return steps;
  const first = steps[0];
  if (first.transport !== 'webrtc' || streamCodec(encoding, first.profile) !== 'h265' || support.webrtc || !support.mse) return steps;
  const mse = steps.find((s) => s.profile === first.profile && s.transport === 'mse');
  return mse ? [mse, ...steps.filter((s) => s !== mse)] : steps;
}

/** What the server chose for a socket (its `arx/stream` frame). */
export interface ServedStream {
  requested: Profile;
  profile: Profile;
  variant: '' | 'h264';
  kind: 'native' | 'other_profile' | 'transcode';
  codec?: string | null;
  message?: string;
}

export function parseServed(value: unknown): ServedStream | null {
  const v = value as Partial<ServedStream> | null;
  if (!v || typeof v !== 'object') return null;
  const prof = (p: unknown): Profile | null => (p === 'main' || p === 'sub' ? p : null);
  const requested = prof(v.requested);
  const profile = prof(v.profile);
  if (!requested || !profile) return null;
  const kind = v.kind === 'other_profile' || v.kind === 'transcode' ? v.kind : 'native';
  return { requested, profile, variant: v.variant === 'h264' ? 'h264' : '', kind, codec: v.codec ?? null, ...(typeof v.message === 'string' && v.message ? { message: v.message } : {}) };
}

/** The server refused a socket for the codec (`h265_unsupported`) or the transcode cap (`transcode_cap`). */
export type H265Refusal = 'h265_unsupported' | 'transcode_cap';

export const H265_REFUSAL_CLOSE: Record<number, H265Refusal> = { 4415: 'h265_unsupported', 4430: 'transcode_cap' };

/**
 * What the player does with a refusal: another step of its chain may still play (`next` - e.g. MSE when the browser
 * decodes H.265 there); otherwise `message` (no alternative: the reason stays on the tile, no retry) or `still` (the
 * transcode cap is full: a refreshing snapshot with the notice, and the live socket is retried later - a slot may free).
 */
export function h265Reaction(refusal: H265Refusal, hasNextStep: boolean): 'next' | 'message' | 'still' {
  if (hasNextStep) return 'next';
  return refusal === 'transcode_cap' ? 'still' : 'message';
}

export const H265_UNSUPPORTED_HE = 'הדפדפן לא תומך בקידוד H.265 של המצלמה; אין זרם חלופי';
export const H265_ALTERNATE_HE = 'הדפדפן לא תומך בקידוד H.265 של המצלמה; מוצג זרם חלופי';
export const transcodeCapHe = (max: number) => `הדפדפן לא תומך בקידוד H.265 של המצלמה, ומכסת התרגומים במקביל${max > 0 ? ` (${max})` : ''} מלאה; מוצגת תמונה מתעדכנת`;
/** The short tag on a tile that plays a fallback (its tooltip carries the full sentence). */
export const servedTag = (s: ServedStream): string => (s.kind === 'transcode' ? 'H.264 · תרגום' : s.profile === 'sub' ? 'זרם משני' : 'זרם ראשי');
/** The settings hint next to an H.265 stream in the camera admin table. */
export const H265_ADMIN_HINT = 'Chrome ו-Edge לא מנגנים H.265 ב-WebRTC. Arx יציג זרם חלופי לפי ההגדרה "קידוד H.265 בדפדפן" (הגדרות ‹ וידאו ומדיה); קידוד ה-NVR לא משתנה';
