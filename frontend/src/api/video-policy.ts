/**
 * CR-008 D7 - the remote video policy (SmplWise Arx). On the remote channel a live player does not follow the LAN
 * transport choice (הגדרות › וידאו ומדיה; automatic = WebRTC first since the owner decision of 2026-10-05); it walks a
 * short ladder instead:
 *
 *   1. the preferred profile over WebRTC - skipped when the NVR says that stream cannot play there (H.265, MJPEG,
 *      H.264 with B-frames or SVC: the camera registry's `encoding.<profile>.webrtc === 'no'`);
 *   2. `remote.mse_fallback` true  → the same profile over MSE (the video itself through the tunnel: the last resort,
 *                                    announced on the player) - unless the transport choice is WebRTC only, which
 *                                    never falls back to MSE (owner bug 2026-10-01): then as with false;
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

/** Owner bug 2026-10-01: the remote policy for a player whose transport choice is `transport` (the installation's
 * `media.transport_default`, or the viewer's own override). An explicit WebRTC choice never falls back to MSE, on any
 * channel: remotely it walks the other profile over WebRTC instead (as with `remote.mse_fallback` false). `auto` / `mse`
 * keep `remote.mse_fallback` as it is. */
export function remoteVideoFor(transport: string | null | undefined, me: Me | null | undefined = session.me): RemoteVideo | null {
  const policy = remoteVideo(me);
  return policy && transport === 'webrtc' ? { ...policy, mseFallback: false } : policy;
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
 * `none` when nothing may play under the policy (the player shows the message). `transport` is the player's `mode`: an
 * explicit `webrtc` leaves MSE out of the plan (remoteVideoFor). */
export function playerPlan(preferred: Profile, encoding?: CameraEncoding | null, transport = '', me: Me | null | undefined = session.me): { plan: string; preferred: Profile | ''; gop: string } {
  const policy = remoteVideoFor(transport, me);
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

/**
 * 0.1.148 fix (owner, the 'oliel' wall: two panoramic cameras stuck on "WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה"
 * while the camera page played their main stream over WebRTC) - the LAN / Ingress fallback chain of a live camera
 * player (no remote plan). The steps are walked in order; a later step with the OTHER profile is taken only after a
 * step proved the stream undecodable (connected, nothing decoded) - never after a mere connection failure:
 *  - `webrtc` (a transport choice, never overridden): the profile over WebRTC; with `autoProfile` then the other profile
 *    over WebRTC;
 *  - `mse` (never overridden): the profile over MSE; with `autoProfile` then the other profile over MSE;
 *  - `auto`: the profile over WebRTC, then over MSE; with `autoProfile` then the other profile on the transport the lab
 *    found works for it first (main: MSE, sub: WebRTC), then the remaining one.
 * `autoProfile` is set only where the profile is not the viewer's own choice (the wall's "ברירת מחדל" quality).
 */
export function lanLadder(profile: Profile, mode: 'auto' | 'webrtc' | 'mse', autoProfile: boolean): VideoStep[] {
  const other = otherProfile(profile);
  if (mode === 'webrtc' || mode === 'mse') {
    const steps: VideoStep[] = [{ profile, transport: mode }];
    if (autoProfile) steps.push({ profile: other, transport: mode });
    return steps;
  }
  const steps: VideoStep[] = [{ profile, transport: 'webrtc' }, { profile, transport: 'mse' }];
  if (autoProfile) {
    const first: StepTransport = other === 'main' ? 'mse' : 'webrtc';
    steps.push({ profile: other, transport: first }, { profile: other, transport: first === 'mse' ? 'webrtc' : 'mse' });
  }
  return steps;
}

export function sameStep(a: VideoStep | null | undefined, b: VideoStep | null | undefined): boolean {
  return !!a && !!b && a.profile === b.profile && a.transport === b.transport;
}

/** The remembered step first (when the chain allows it at all), the rest in their own order. */
export function orderLadder(steps: VideoStep[], remembered: VideoStep | null): VideoStep[] {
  if (!remembered || !steps.some((s) => sameStep(s, remembered))) return steps;
  return [remembered, ...steps.filter((s) => !sameStep(s, remembered))];
}

/** Per camera (and the profile + transport it was asked for): the step that last played when it was not the first of
 * the chain. A per-browser convenience (localStorage); it expires after a day so a camera whose first step was fixed
 * returns to it, and a remembered step that fails is forgotten on the spot. */
export const LIVE_WORKS_KEY = 'sw.live.works';
export const LIVE_WORKS_TTL_MS = 24 * 3600 * 1000;
type WorksStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function localStore(): WorksStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readWorks(store: WorksStore | null): Record<string, { step: string; at: number }> {
  try {
    const v = JSON.parse(store?.getItem(LIVE_WORKS_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

const worksKey = (cameraId: string, profile: Profile, mode: string) => `${cameraId}|${profile}|${mode}`;

export function rememberedStep(cameraId: string, profile: Profile, mode: string, now = Date.now(), store: WorksStore | null = localStore()): VideoStep | null {
  const hit = readWorks(store)[worksKey(cameraId, profile, mode)];
  if (!hit || typeof hit.at !== 'number' || now - hit.at > LIVE_WORKS_TTL_MS) return null;
  return decodeLadder(String(hit.step))[0] ?? null;
}

/** Remembers `step` (null forgets the camera's entry). */
export function rememberStep(cameraId: string, profile: Profile, mode: string, step: VideoStep | null, now = Date.now(), store: WorksStore | null = localStore()): void {
  if (!store) return;
  const all = readWorks(store);
  const key = worksKey(cameraId, profile, mode);
  if (step) all[key] = { step: encodeLadder([step]), at: now };
  else if (key in all) delete all[key];
  else return;
  try {
    if (Object.keys(all).length) store.setItem(LIVE_WORKS_KEY, JSON.stringify(all));
    else store.removeItem(LIVE_WORKS_KEY);
  } catch {
    /* private mode / quota: the chain simply starts from its first step next time */
  }
}

/**
 * Owner decision 2026-10-05 (WebRTC first, MSE only when WebRTC cannot be used): a WebRTC step of an `auto` player that
 * never connected (no ICE connection, no bytes within the connect bound - UDP to go2rtc blocked, the Ingress / Cloudflare
 * path) says something about the NETWORK, not about one camera. It is remembered for this browser tab (sessionStorage)
 * for WEBRTC_DOWN_TTL_MS: every `auto` player opened meanwhile starts on MSE at once (no 5 s wait per tile, no flicker
 * loop), and WebRTC is probed again once the memory expires or the tab is reopened. A stream that CONNECTED but did not
 * decode is a per-camera fact and keeps the 24 h per-camera memory above. Never consulted by `webrtc` / `mse` players.
 */
export const WEBRTC_DOWN_KEY = 'sw.live.webrtc_down';
export const WEBRTC_DOWN_TTL_MS = 10 * 60 * 1000;

function sessionStore(): WorksStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** True while this tab remembers that WebRTC could not connect (within the TTL). */
export function webrtcUnreachable(now = Date.now(), store: WorksStore | null = sessionStore()): boolean {
  try {
    const at = Number(store?.getItem(WEBRTC_DOWN_KEY) ?? 0);
    return at > 0 && now - at <= WEBRTC_DOWN_TTL_MS;
  } catch {
    return false;
  }
}

/** Remembers (or with `down` false forgets) that WebRTC could not connect from this tab. */
export function noteWebrtcUnreachable(down = true, now = Date.now(), store: WorksStore | null = sessionStore()): void {
  try {
    if (down) store?.setItem(WEBRTC_DOWN_KEY, String(now));
    else store?.removeItem(WEBRTC_DOWN_KEY);
  } catch {
    /* private mode / quota: the next player probes WebRTC again, which is only slower */
  }
}

/** The chain with its first MSE step moved to the front (what an `auto` player walks while WebRTC is known unreachable);
 * a chain without an MSE step (WebRTC only) is returned as it is. */
export function mseFirst(steps: VideoStep[]): VideoStep[] {
  return orderLadder(steps, steps.find((s) => s.transport === 'mse') ?? null);
}

/** The player badge: `main·WebRTC`, `sub·WebRTC`, `main·MSE`. */
export function badgeLabel(step: VideoStep): string {
  return `${step.profile}·${step.transport === 'webrtc' ? 'WebRTC' : 'MSE'}`;
}
