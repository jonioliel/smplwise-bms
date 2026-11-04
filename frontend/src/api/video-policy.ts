/**
 * VIDEO-TRANSPORT-2400 (owner decisions 2026-11-04): the transport is exactly what the viewer's choice says - "MSE בלבד" plays MSE
 * only, "WebRTC בלבד" WebRTC only - on every channel and surface; only `auto` tries more than one transport. The choice is decided
 * by the server (GET /media/video-policy, backend services/video_transport.py: the personal `video.transport` of /me/prefs, else
 * the installation's `media.transport_default`, else `auto`) and every player executes it. `planSteps` below mirrors the server's
 * `plan_steps` (the demo mode and an older server derive the policy here from the settings, `localPolicy`); both are checked
 * against one case table (contracts/fixtures/video_transport/policy_cases.json, tests/unit-video-transport-2400.spec.ts).
 * The text below (CR-008 D7) describes `auto` on the remote channel; an explicit choice there plays its one transport.
 *
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
export type TransportChoice = 'auto' | 'webrtc' | 'mse';
export type VideoChannel = 'local' | 'remote';

/** GET /media/video-policy (backend services/video_transport.py `policy`). */
export interface VideoPolicy {
  choice: TransportChoice;
  source: 'personal' | 'installation' | 'default';
  explicit: boolean;
  installation: TransportChoice;
  personal: TransportChoice | null;
  channel: VideoChannel;
  order: StepTransport[];
  label?: string;
  remote: { default_profile: Profile; mse_fallback: boolean } | null;
}

const CHOICES: readonly TransportChoice[] = ['auto', 'webrtc', 'mse'];

export function normalizeChoice(v: unknown): TransportChoice | null {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (CHOICES as readonly string[]).includes(t) ? (t as TransportChoice) : null;
}

/** The personal choice when set, else the installation's, else `auto` (services/video_transport.py `effective_choice`). */
export function effectiveChoice(installation: unknown, personal: unknown): { choice: TransportChoice; source: VideoPolicy['source'] } {
  const own = normalizeChoice(personal);
  if (own) return { choice: own, source: 'personal' };
  const base = normalizeChoice(installation);
  if (base) return { choice: base, source: 'installation' };
  return { choice: 'auto', source: 'default' };
}

const flag = (v: unknown, dflt = true): boolean => (typeof v === 'boolean' ? v : v == null ? dflt : String(v).trim().toLowerCase() !== 'false');

/** The transports a player may use, in order: one for an explicit choice; `auto` only may hold two. */
export function transportOrder(choice: string, channel: VideoChannel, mseFallback: unknown = true): StepTransport[] {
  const c = normalizeChoice(choice) ?? 'auto';
  if (c !== 'auto') return [c];
  if (channel === 'remote' && !flag(mseFallback)) return ['webrtc'];
  return ['webrtc', 'mse'];
}

export interface PlanOptions {
  mseFallback?: unknown;
  /** local: the profile is not the viewer's own choice (the wall's default quality) - the other profile may follow */
  autoProfile?: boolean;
  /** a station: the quality is the viewer's choice and the relay path is per profile - never another profile */
  singleProfile?: boolean;
  /** remote: false where the registry says the profile does not decode over WebRTC */
  webrtcOk?: Partial<Record<Profile, boolean>> | null;
  /** what the source offers per profile (a station's descriptor); a transport not offered is dropped, never replaced */
  offered?: Partial<Record<Profile, readonly string[]>> | null;
}

/** The steps one player walks (services/video_transport.py `plan_steps`); empty = nothing may play under this choice. */
export function planSteps(choice: string, channel: VideoChannel, profile: Profile, o: PlanOptions = {}): VideoStep[] {
  const c = normalizeChoice(choice) ?? 'auto';
  const p: Profile = profile === 'main' ? 'main' : 'sub';
  const other = otherProfile(p);
  const order = transportOrder(c, channel, o.mseFallback ?? true);
  let steps: VideoStep[];
  if (channel === 'remote') {
    if (order.length === 1 && order[0] === 'mse') steps = [{ profile: p, transport: 'mse' }];
    else if (order.length === 1) steps = [{ profile: p, transport: 'webrtc' }, { profile: other, transport: 'webrtc' }];
    else steps = [{ profile: p, transport: 'webrtc' }, { profile: p, transport: 'mse' }];
  } else if (c !== 'auto') {
    steps = [{ profile: p, transport: c }, ...(o.autoProfile ? [{ profile: other, transport: c }] : [])];
  } else {
    steps = [{ profile: p, transport: 'webrtc' }, { profile: p, transport: 'mse' }];
    if (o.autoProfile) {
      const first: StepTransport = other === 'main' ? 'mse' : 'webrtc';
      steps.push({ profile: other, transport: first }, { profile: other, transport: first === 'mse' ? 'webrtc' : 'mse' });
    }
  }
  if (o.singleProfile) steps = steps.filter((s) => s.profile === p);
  if (channel === 'remote' && o.webrtcOk) steps = steps.filter((s) => s.transport !== 'webrtc' || o.webrtcOk?.[s.profile] !== false);
  if (o.offered) steps = steps.filter((s) => (o.offered?.[s.profile] ?? []).includes(s.transport));
  return steps;
}

/** The policy derived here from the settings (the demo mode, or a server without /media/video-policy): the installation's choice
 * only - a personal choice lives on the server. */
export function localPolicy(installation: unknown, me: Me | null | undefined = session.me, personal: unknown = null): VideoPolicy {
  const { choice, source } = effectiveChoice(installation, personal);
  const channel: VideoChannel = me?.channel === 'remote' ? 'remote' : 'local';
  const r = me?.remote ?? {};
  const mseFallback = flag(r['remote.mse_fallback'], true);
  return {
    choice,
    source,
    explicit: choice !== 'auto',
    installation: normalizeChoice(installation) ?? 'auto',
    personal: normalizeChoice(personal),
    channel,
    order: transportOrder(choice, channel, mseFallback),
    remote: channel === 'remote' ? { default_profile: r['remote.default_profile'] === 'sub' ? 'sub' : 'main', mse_fallback: mseFallback } : null,
  };
}

export interface VideoStep {
  profile: Profile;
  transport: StepTransport;
}

export interface RemoteVideo {
  defaultProfile: Profile;
  mseFallback: boolean;
}

/** The owner's wording (CR-008 step 6). */
export const MAIN_UNDECODABLE = 'הזרם הראשי אינו ניתן לפענוח ב-WebRTC - ראה הגדרות ‹ וידאו';
export const SUB_UNDECODABLE = 'הזרם המשני אינו ניתן לפענוח ב-WebRTC - ראה הגדרות ‹ וידאו';

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
 * keep `remote.mse_fallback` as it is (VIDEO-TRANSPORT-2400: it shapes `auto` only - an explicit MSE choice plans MSE only,
 * planSteps). */
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
 * `none` when nothing may play under the policy (the player shows the message). `transport` is the player's `mode` (the
 * viewer's effective choice): an explicit `webrtc` leaves MSE out of the plan, an explicit `mse` WebRTC (VIDEO-TRANSPORT-2400). */
export function playerPlan(preferred: Profile, encoding?: CameraEncoding | null, transport = '', me: Me | null | undefined = session.me): { plan: string; preferred: Profile | ''; gop: string } {
  const policy = remoteVideo(me);
  if (!policy) return { plan: '', preferred: '', gop: '' };
  // VIDEO-TRANSPORT-2400: the viewer's choice decides the transports (an explicit MSE choice plans MSE only); '' reads as `auto`
  const steps = planSteps(transport || 'auto', 'remote', preferred, { mseFallback: policy.mseFallback, webrtcOk: webrtcOkFrom(encoding) });
  return { plan: steps.length ? encodeLadder(steps) : 'none', preferred, gop: encodeGop(encoding) };
}

/** The registry's WebRTC verdicts per profile (false only for `webrtc: 'no'`; unknown is tried). */
export function webrtcOkFrom(encoding: CameraEncoding | null | undefined): Record<Profile, boolean> {
  return { main: webrtcPossible(encoding, 'main'), sub: webrtcPossible(encoding, 'sub') };
}

/** VIDEO-TRANSPORT-2400: what a station's live view hands its player for one profile - the server's plan for it when the station read
 * carried one (`video.transport.plans`), else the same decision made here. `blocked`: the station offers no transport the choice allows
 * (the view says so; nothing else is tried). On the local channel a plan that the player's own chain-less walk of `mode` follows anyway
 * is handed over as '' (the local timings stay: the WebRTC connect bound, the MSE fallback of `auto`). */
export function stationPlayer(choice: TransportChoice, profile: Profile, offered: Partial<Record<Profile, readonly string[]>> | null, serverPlan?: string | null, me: Me | null | undefined = session.me): { mode: TransportChoice; plan: string; blocked: boolean } {
  const channel: VideoChannel = me?.channel === 'remote' ? 'remote' : 'local';
  const mseFallback = me?.remote?.['remote.mse_fallback'];
  const steps = serverPlan === 'none' ? [] : serverPlan ? decodeLadder(serverPlan) : planSteps(choice, channel, profile, { mseFallback, singleProfile: true, offered });
  if (!steps.length) return { mode: choice, plan: 'none', blocked: true };
  // one transport left: the player plays exactly that one (its `mode` keeps every step honest too)
  const kinds = [...new Set(steps.map((s) => s.transport))];
  const mode: TransportChoice = kinds.length === 1 ? kinds[0] : choice;
  const natural = encodeLadder(planSteps(mode, 'local', profile, { singleProfile: true }));
  if (channel === 'local' && encodeLadder(steps) === natural) return { mode, plan: '', blocked: false };
  return { mode, plan: encodeLadder(steps), blocked: false };
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
  return planSteps(mode, 'local', profile, { autoProfile }); // VIDEO-TRANSPORT-2400: the one expansion of the policy
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

/**
 * VIDEO-TRANSPORT-2400 (lab audit finding 5): the frozen-MSE watch of a live player. Sampled every FREEZE_POLL_MS while an MSE stream
 * plays: progress is the playhead moving (or, while the element is paused - autoplay refused -, the buffer growing). No progress for
 * FREEZE_AFTER_MS = frozen: the player reconnects the same step (any choice); only `auto` moves on to WebRTC after
 * FREEZE_FALLBACK_AFTER freezes in a row. A hidden tab is never judged (its sample restarts).
 */
export const FREEZE_POLL_MS = 2000;
export const FREEZE_AFTER_MS = 8000;
export const FREEZE_FALLBACK_AFTER = 2;
const FREEZE_EPS_S = 0.05;

export interface FreezeMark {
  t: number;
  end: number;
  at: number;
}

export function freezeStep(prev: FreezeMark | null, cur: { t: number; end: number; now: number; paused: boolean; hidden?: boolean }, afterMs = FREEZE_AFTER_MS): { frozen: boolean; mark: FreezeMark | null } {
  if (cur.hidden) return { frozen: false, mark: null };
  const fresh: FreezeMark = { t: cur.t, end: cur.end, at: cur.now };
  if (!prev) return { frozen: false, mark: fresh };
  const moved = cur.paused ? cur.end > prev.end + FREEZE_EPS_S : cur.t > prev.t + FREEZE_EPS_S;
  if (moved) return { frozen: false, mark: fresh };
  return { frozen: cur.now - prev.at >= afterMs, mark: prev };
}

/** Where an automatic retry starts (VIDEO-TRANSPORT-2400): the step that played last when it is still allowed, else the first. */
export function retryIndex(steps: VideoStep[], lastGood: VideoStep | null): number {
  const i = lastGood ? steps.findIndex((s) => sameStep(s, lastGood)) : -1;
  return i >= 0 ? i : 0;
}

/** The step an `auto` player moves to after repeated MSE freezes: WebRTC of the same profile when the ladder holds it. */
export function freezeFallback(steps: VideoStep[], current: VideoStep | null, mode: string): VideoStep | null {
  if (mode !== 'auto' || !current || current.transport !== 'mse') return null;
  return steps.find((s) => s.profile === current.profile && s.transport === 'webrtc') ?? null;
}

/** The player badge: `main·WebRTC`, `sub·WebRTC`, `main·MSE`. */
export function badgeLabel(step: VideoStep): string {
  return `${step.profile}·${step.transport === 'webrtc' ? 'WebRTC' : 'MSE'}`;
}
