/**
 * CR-008 D7 - the remote video policy (SmplWise Arx). On the remote channel a live player does not follow the LAN
 * transport choice (הגדרות › וידאו ומדיה, MSE by default); it walks a short ladder instead:
 *
 *   1. the preferred profile over WebRTC - skipped when the NVR says that stream cannot play there (H.265, MJPEG,
 *      H.264 with B-frames or SVC: the camera registry's `encoding.<profile>.webrtc === 'no'`);
 *   2. `remote.mse_fallback` true  → the same profile over MSE (the video itself through the tunnel: the last resort,
 *                                    announced on the player);
 *      `remote.mse_fallback` false → the other profile over WebRTC (announced), then the message
 *                                    "הזרם הראשי אינו ניתן לפענוח ב-WebRTC - ראה הגדרות › וידאו".
 *
 * The channel comes from the server (`/me.channel`, CR-008 §3a) and the two settings from `/me.remote`. On the LAN /
 * Ingress channel nothing changes (there is no LAN profile setting; none is invented here).
 */
import { session } from './session';
import type { CameraEncoding, Me } from './types';

export type Profile = 'main' | 'sub';
export type StepTransport = 'webrtc' | 'mse';

export interface VideoStep {
  profile: Profile;
  transport: StepTransport;
}

export interface RemoteVideo {
  defaultProfile: Profile;
  mseFallback: boolean;
}

/** The owner's wording (CR-008 step 6). */
export const MAIN_UNDECODABLE = 'הזרם הראשי אינו ניתן לפענוח ב-WebRTC - ראה הגדרות › וידאו';
export const SUB_UNDECODABLE = 'הזרם המשני אינו ניתן לפענוח ב-WebRTC - ראה הגדרות › וידאו';

export function undecodableMessage(profile: Profile): string {
  return profile === 'main' ? MAIN_UNDECODABLE : SUB_UNDECODABLE;
}

/** The remote policy when this page came through the remote channel, otherwise null (LAN / Ingress: today's behaviour). */
export function remoteVideo(me: Me | null | undefined = session.me): RemoteVideo | null {
  if (!me || me.channel !== 'remote') return null;
  const r = me.remote ?? {};
  return {
    defaultProfile: r['remote.default_profile'] === 'sub' ? 'sub' : 'main',
    mseFallback: String(r['remote.mse_fallback'] ?? 'true') !== 'false',
  };
}

export function otherProfile(p: Profile): Profile {
  return p === 'main' ? 'sub' : 'main';
}

/** False only when the NVR's encoding says this profile will not decode over WebRTC; unknown is tried. */
export function webrtcPossible(encoding: CameraEncoding | null | undefined, profile: Profile): boolean {
  return encoding?.[profile]?.webrtc !== 'no';
}

/** The ladder for one player; may be empty (nothing can play under this policy - the player shows the message). */
export function videoLadder(preferred: Profile, mseFallback: boolean, encoding?: CameraEncoding | null): VideoStep[] {
  const steps: VideoStep[] = [];
  if (webrtcPossible(encoding, preferred)) steps.push({ profile: preferred, transport: 'webrtc' });
  if (mseFallback) {
    steps.push({ profile: preferred, transport: 'mse' });
  } else {
    const other = otherProfile(preferred);
    if (webrtcPossible(encoding, other)) steps.push({ profile: other, transport: 'webrtc' });
  }
  return steps;
}

/** `main:webrtc,main:mse` - a value (not an array) so a re-rendered parent does not reconnect the player. */
export function encodeLadder(steps: VideoStep[]): string {
  return steps.map((s) => `${s.profile}:${s.transport}`).join(',');
}

export function decodeLadder(value: string): VideoStep[] {
  return value
    .split(',')
    .map((part) => part.split(':'))
    .filter(([p, t]) => (p === 'main' || p === 'sub') && (t === 'webrtc' || t === 'mse'))
    .map(([p, t]) => ({ profile: p as Profile, transport: t as StepTransport }));
}

/** What a screen hands its `sw-live-player` (`plan` + `preferred`): '' outside the remote channel (today's behaviour),
 * `none` when nothing may play under the policy (the player shows the message). */
export function playerPlan(preferred: Profile, encoding?: CameraEncoding | null, me: Me | null | undefined = session.me): { plan: string; preferred: Profile | ''; gop: string } {
  const policy = remoteVideo(me);
  if (!policy) return { plan: '', preferred: '', gop: '' };
  const steps = videoLadder(preferred, policy.mseFallback, encoding);
  return { plan: steps.length ? encodeLadder(steps) : 'none', preferred, gop: encodeGop(encoding) };
}

/** Smart codec (H.264+ / H.265+) stretches the GOP dynamically: the longest first-frame wait. */
const SMART_CODEC_GOP_MS = 20000;

/** The key-frame interval of a stream in ms when the NVR reported it (GovLength frames at the stream's frame rate, 25
 * when it runs at the camera's full rate), for the player's first-frame watch; 0 = unknown. */
export function gopMs(encoding: CameraEncoding | null | undefined, profile: Profile): number {
  const e = encoding?.[profile];
  if (!e) return 0;
  if (e.smart_codec) return SMART_CODEC_GOP_MS;
  if (!e.gov_length || e.gov_length <= 0) return 0;
  return Math.round((e.gov_length / (e.fps && e.fps > 0 ? e.fps : 25)) * 1000);
}

/** `main:2000,sub:2500` - a value, like the plan, so a re-rendered parent does not reconnect the player. */
export function encodeGop(encoding: CameraEncoding | null | undefined): string {
  return (['main', 'sub'] as Profile[])
    .map((p) => [p, gopMs(encoding, p)] as const)
    .filter(([, ms]) => ms > 0)
    .map(([p, ms]) => `${p}:${ms}`)
    .join(',');
}

/** The player badge: `main·WebRTC`, `sub·WebRTC`, `main·MSE`. */
export function badgeLabel(step: VideoStep): string {
  return `${step.profile}·${step.transport === 'webrtc' ? 'WebRTC' : 'MSE'}`;
}
