/**
 * CR-CAMVF-295 (docs/changes/CR-CAMVF-295-SECURITY.md): the pure rules of the live in-page camera viewfinder - when it may be offered,
 * what a getUserMedia failure means, how big the captured frame is, and how a stream is ended. No DOM writes here; the element is
 * camera-viewfinder.ts.
 */

/** The environment facts the availability rule needs (injected so the rule is testable without a browser). */
export interface CameraEnv {
  secure: boolean;
  hasGetUserMedia: boolean;
}

export function cameraEnv(): CameraEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { secure: false, hasGetUserMedia: false };
  return { secure: window.isSecureContext === true, hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function' };
}

/** The tile is offered only when the installation switch is on (default off), the ticket takes photos, and the browser can do it. */
export function viewfinderAvailable(setting: unknown, canAttach: boolean, env: CameraEnv): boolean {
  return setting === true && canAttach && env.secure && env.hasGetUserMedia;
}

export type CameraFailure = 'denied' | 'no_camera' | 'busy' | 'insecure' | 'failed';

/** A getUserMedia rejection, as one of five plain outcomes (each ends in the same fallback: the file input tile). */
export function classifyCameraError(err: unknown): CameraFailure {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'no_camera';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    case 'TypeError':
      return 'insecure';
    default:
      return 'failed';
  }
}

/** The request: the rear camera when there is one, a sane ideal size, never audio, never `exact` (no OverconstrainedError on laptops). */
export const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
};

/** The server's own long-side limit (image_intake: 2048 px); the frame is never scaled up. */
export const MAX_SIDE = 2048;
export const JPEG_QUALITY = 0.85;

export function frameSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Ends every track of a stream (the camera light goes off). Safe on null and on a stream already ended. */
export function stopStream(stream: Pick<MediaStream, 'getTracks'> | null | undefined): number {
  if (!stream) return 0;
  let n = 0;
  for (const track of stream.getTracks()) {
    if (track.readyState !== 'ended') n += 1;
    track.stop();
  }
  return n;
}

/** The captured photo's file name: local time stamp, no user data. */
export function captureName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `camera-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.jpg`;
}
