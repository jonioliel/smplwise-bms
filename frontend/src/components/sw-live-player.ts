import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import './sw-icon';
import { liveWsUrl, relayWsUrl, type Transport } from '../api/media';
import { can, cap, isApi } from '../api/session';
import { frameSaysDown, isDownState, videoService, VIDEO_SERVICE_DOWN_HE, VIDEO_SERVICE_HINT_ADMIN, VIDEO_SERVICE_HINT_OTHER } from '../api/video-service';
import { productSettings } from '../api/prefs';
import { LIVE_ICE_SERVERS } from '../api/video-conn-test';
import { badgeLabel, decodeLadder, FREEZE_FALLBACK_AFTER, FREEZE_POLL_MS, freezeFallback, freezeStep, lanLadder, mainFirst, mseFirst, noteSubDown, noteWebrtcUnreachable, orderLadder, rememberStep, rememberedStep, retryIndex, sameStep, subDown, subFallbackStep, undecodableMessage, webrtcUnreachable, type FreezeMark, type Profile, type StepTransport, type SubFallbackReason, type VideoStep } from '../api/video-policy';
import { H265_ALTERNATE_HE, H265_REFUSAL_CLOSE, H265_UNSUPPORTED_HE, h265Param, h265Reaction, h265Support, normalizePolicy, orderForH265, parseServed, servedTag, streamCodec, transcodeCapHe, type H265Policy, type H265Refusal, type ServedStream } from '../api/h265-support';
import type { CameraEncoding } from '../api/types';

/**
 * Live player over the add-on's WebSocket relay (go2rtc signalling behind it).
 *  - WebRTC: offer/answer + trickle candidates through the socket; media flows browser ↔ go2rtc.
 *  - MSE: fMP4 fragments over the socket, appended to a SourceBuffer, kept near the live edge.
 * `mode` = auto (WebRTC first, MSE on failure) | webrtc | mse. Shows the poster (snapshot) until the
 * first frame plays and never pretends to be live when it is not.
 *
 * CR-008 D7 (the remote channel): a non-empty `plan` (api/video-policy.ts, e.g. `main:webrtc,main:mse`, or `none`)
 * replaces `profile` and `mode`: the player walks the steps in order - a WebRTC step that does not connect or render a
 * frame in time moves on to the next one - announces a fallback on the picture, shows a `main·WebRTC` badge, and ends
 * with the "cannot be decoded over WebRTC" message when no step is left. `preferred` is the profile the plan was built
 * for (the one the viewer asked for). One exception: `mode` `webrtc` (WebRTC only) drops every MSE step of a plan.
 *
 * 0.1.148 (LAN / Ingress, no plan): a live camera player walks `lanLadder(profile, mode, autoProfile)` the same way -
 * a WebRTC step that connects but decodes nothing moves on (MSE on `auto`; the other profile only when `autoProfile`
 * and a step proved the stream undecodable) - and remembers per camera the step that played (api/video-policy).
 *
 * Owner decision 2026-10-05 (WebRTC first, MSE only when WebRTC cannot be used; `auto` is the installation default):
 * an `auto` WebRTC attempt that reaches no ICE connection within WEBRTC_CONNECT_MS moves on to MSE at once, quietly
 * (the poster stays, no error flashes), and the tab remembers that WebRTC is unreachable (api/video-policy
 * `webrtcUnreachable`, 10 min) so the next `auto` players start on MSE without their own wait and WebRTC is probed again
 * later. A stream that connected but did not decode keeps the GOP-sized decode grace (the first decodable frame is the next
 * key frame on MSE too) and the 24 h per-camera memory. `webrtc` / `mse` players never fall back and never consult the
 * memory. The remote plan (CR-008 D7) keeps its own first-frame cap: a mobile link may need longer than the LAN bound.
 *
 * VIDEO-TRANSPORT-2400 (owner decisions 2026-11-04): the player only EXECUTES the server's decision (api/video-transport.ts,
 * api/video-policy.ts `planSteps`): `mode` is the viewer's effective choice and an explicit `mse` / `webrtc` keeps only its own
 * transport's steps of any plan a screen hands over - nothing here substitutes the other transport. An automatic retry starts
 * from the step that played last (`lastGood`), not from the top of the plan. A live MSE stream that stops moving (`freezeStep`:
 * neither the playhead nor, while paused, the buffer advance for FREEZE_AFTER_MS) is reconnected on the same step; only `auto`
 * moves on to WebRTC after FREEZE_FALLBACK_AFTER freezes in a row. A stream error frame's value goes into the `player-status`
 * event's `code` and the console (the server logs go2rtc's own text, sanitized: services/live_diag.py).
 *
 * VIDEO-SUB-FALLBACK-2402 (owner round 20, Q3 = a): with the automatic quality (`autoProfile`) a SUB step that gives no media, never
 * connects or is refused by go2rtc moves to the MAIN step on the same transport (api/video-policy `subFallbackStep`; never another
 * transport because of it) and the tile says "עבר לזרם הראשי"; the camera is remembered for the tab (`subDown`, 10 minutes) so a
 * reconnect opens main directly. The main socket names why (`fallback=`) for the session's audit rows. An explicit quality never
 * switches: the tile says the stream does not arrive. A cap refusal (4429), a denial or the video server being down is never a reason.
 */
export type PlayerStatus = 'idle' | 'connecting' | 'playing' | 'ended' | 'error';

const MSE_CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus'];
/** ICE + first key frame: cameras with a 2–4 s GOP need well over 7 s before the first frame renders. */
const WEBRTC_TIMEOUT_MS = 12000;
/** Owner decision 2026-10-05: how long an `auto` player waits for the ICE connection (any inbound byte, or the peer
 * connection reporting `connected`) before it calls WebRTC unreachable and moves on to MSE. On the LAN ICE completes well
 * under 2 s (host candidates; the STUN reflexive pair a little later); where UDP to go2rtc is blocked (Ingress, Cloudflare,
 * CGNAT) the browser only reports `failed` after its own ~15-30 s ICE timeout, which is what this bound cuts short. Once
 * connected, the wait for media keeps WEBRTC_TIMEOUT_MS and the GOP-sized decode grace. */
export const WEBRTC_CONNECT_MS = 5000;
/** CR-008 review M2 (a WebRTC step under a remote plan): the first-frame watch polls the RTP statistics this often,
 * waits at most FIRST_FRAME_CAP_MS for media to arrive at all, and calls a stream undecodable when bytes arrive but no
 * frame decodes for DECODE_GRACE_MS (or the stream's GOP + 3 s, bounded, when the registry knows the GOP). */
const STATS_POLL_MS = 1000;
const FIRST_FRAME_CAP_MS = 30000;
const DECODE_GRACE_MS = 10000;
const DECODE_GRACE_MIN_MS = 6000;
const DECODE_GRACE_MAX_MS = 20000;
/** The relay's media server is down (error `upstream_unavailable`, close 4503): no step of a plan can help. WARMUP-POLISH-2421: the
 * same plain words on every tile (a LAN tile used to show the internal component's name). */
export const VIDEO_SERVER_DOWN = VIDEO_SERVICE_DOWN_HE; // HEALTH-GO2RTC-2430: one message for "the video service is down" everywhere
/** WARMUP-POLISH-2421: the socket to the video relay has not opened in this bound - the server does not answer (no media server, a
 * proxy holding the upgrade): the tile says so, keeps its snapshot, offers a retry and retries by itself as after any failure. */
export const SOCKET_OPEN_MS = 10000;
/** WARMUP-POLISH-2421: the safety net of one attempt - no state may stay on "מתחבר…" longer than this (every step's own bound - the
 * WebRTC connect / first-frame watch, the MSE first fragment - is shorter; this only catches a path none of them covers). */
export const CONNECTING_CAP_MS = 60000;
export const CONNECT_TIMEOUT_HE = 'שרת הווידאו אינו עונה';
/** go2rtc starts the fMP4 stream at the next key frame; the lab NVR's GOP is ~8 s. */
const MSE_TIMEOUT_MS = 20000;
/** Automatic reconnect after a transient failure (not after 4401/4403/4429): 3 s, 6 s, 12 s … max 30 s. */
const RETRY_BASE_MS = 3000;
const RETRY_MAX_MS = 30000;

/** The remote live cap (`remote_live_cap`, WebSocket close 4429): what the tile says, and who may raise it. Never a retry. */
export const liveCapTitle = (max: number) => `הגעת למכסת הזרמים החיים בחיבור הזה${max > 0 ? ` (${max})` : ''}`;
export const LIVE_CAP_HINT_ADMIN = 'אפשר להגדיל בהגדרות ‹ מערכת ‹ גישה מרחוק';
export const LIVE_CAP_HINT_OTHER = 'פנה למנהל המערכת';

/** LIVE-H265-2341: how often the snapshot behind the "transcode cap full" notice refreshes. */
const STILL_REFRESH_MS = 10000;

/** VIDEO-SUB-FALLBACK-2402: the quiet tag of a tile that moved from its sub stream to the main one. */
export const SUB_FALLBACK_HE = 'עבר לזרם הראשי';
/** SKIN-QA-FOLLOWUP-2404: below this player width (px) the fallback tag is a 20 px chip at the bottom-end corner (see .subtag). */
export const SUB_CHIP_MAX = 160;
/** The chip's long press, with the wall phone bar's timings (wall-phone-bar.ts KEY_HINT_*): the hold, how long the words show, and the
 * movement that makes it a scroll. */
export const SUB_HINT_PRESS_MS = 450;
export const SUB_HINT_SHOW_MS = 2500;
export const SUB_HINT_MOVE_PX = 10;
/** VIDEO-SUB-FALLBACK-2402: an explicit quality whose stream gives nothing (never switched). */
const NO_MEDIA_HE = (p: Profile) => (p === 'sub' ? 'הזרם המשני לא מגיע מהמצלמה' : 'הזרם הראשי לא מגיע מהמצלמה');

/** VIDEO-TRANSPORT-2400: what a frozen live MSE stream says while it reconnects. */
const FROZEN_HE = 'הווידאו נעצר · מתחבר מחדש';

/** Recorded playback: how much media may wait ahead of a paused or slowed playhead before fragments are dropped. */
const MAX_AHEAD_S = 25;

@customElement('sw-live-player')
export class SwLivePlayer extends LitElement {
  @property() cameraId = '';
  @property() profile: 'sub' | 'main' = 'sub';
  @property() mode: Transport = 'auto';
  @property() poster = '';
  @property({ type: Boolean }) active = true;
  @property({ type: Boolean, reflect: true }) compact = false;
  /** How the live picture sits in a box whose shape differs from the stream's own:
   * - `contain` (default): the whole frame at its true proportions, with bands where the shapes differ;
   * - `cover`: fills the box edge to edge at true proportions and trims what overflows (the snapshot poster's
   *   framing);
   * - `fill`: the whole frame stretched to the box in both directions - nothing trimmed, no bands, proportions
   *   distorted when the shapes differ.
   * The all-cameras wall uses `fill` only for a tile that spans several columns (owner decisions 2026-09-27: the
   * picture must run across the whole wide tile, and the owner prefers seeing the whole field of view stretched
   * over a cropped one); every other player keeps `contain`. The poster (`img.poster`) matches `fill` too, so a
   * connecting wide tile does not crop the snapshot and then jump to a stretched frame once live video starts;
   * the poster's own `cover` default is otherwise unaffected for every other fit value. */
  @property({ reflect: true }) fit: 'contain' | 'cover' | 'fill' = 'contain';
  /** Playback: relay socket of a session generation instead of the live endpoint (MSE only). */
  @property() wsUrl = '';
  /** A live relay path the server named for a source that is not a catalogue camera (a standalone Home Assistant camera shown
   * live, `live_path` of the camera card's resolve): opened instead of `media/live/<cameraId>/ws`, with the transport, the
   * retry and the budget of any live stream (unlike `wsUrl`, which is a playback session and plays MSE only). */
  @property() livePath = '';
  /** Playback streams end when the NVR reaches the requested end time: no automatic reconnect then. */
  @property({ type: Boolean }) retry = true;
  /** Recorded playback (T066): no live-edge catch-up — a paused or slowed playhead may lag the buffer; the look-ahead
   * is bounded instead (fragments beyond MAX_AHEAD_S are dropped and `stale` tells the screen to re-seek on resume). */
  @property({ type: Boolean }) recorded = false;
  /** CR-008 D7: the remote video ladder (see the class comment); '' = today's behaviour (`profile` + `mode`). */
  @property() plan = '';
  @property() preferred: Profile | '' = '';
  /** CR-008 review M2: the GOP per profile in ms when the registry knows it (`main:2000,sub:2500`, api/video-policy). */
  @property() gop = '';
  /** LAN / Ingress: the profile is not the viewer's own choice (the wall's default quality) - a stream proven
   * undecodable may fall back to the other profile. Never set where the viewer picked the profile. */
  @property({ type: Boolean }) autoProfile = false;
  /** LIVE-H265-2341: the camera's stream encodings (the registry). An H.265 stream that this browser decodes over MSE only
   * starts on MSE (api/h265-support `orderForH265`); the server picks the fallback stream per attempt either way. */
  @property({ attribute: false }) encoding: CameraEncoding | null = null;
  /** LIVE-H265-2341: the installation's `media.h265_policy` (read with the product settings) */
  private h265Policy: H265Policy = 'auto';
  /** what the server chose for the current socket (its `arx/stream` frame); a fallback shows a tag on the picture */
  @state() served: ServedStream | null = null;
  /** the transcode cap is full: the refreshing snapshot's notice (the live socket is retried meanwhile) */
  @state() stillNotice = '';
  @state() private posterTick = 0;
  private stillTimer: number | undefined;
  /** LAN / Ingress fallback chain of a live camera (no plan) and the step being tried */
  private chain: VideoStep[] = [];
  private chainIndex = 0;
  /** chain[0] is a remembered step (not the chain's own first): forgotten when it fails */
  private chainRemembered = false;
  /** the chain starts on MSE because this tab remembers WebRTC as unreachable (never remembered per camera) */
  private chainWebrtcDown = false;
  /** a WebRTC step of this chain never connected (a network fact, remembered per tab - not per camera) */
  private chainConnectFailed = false;
  /** VIDEO-TRANSPORT-2400: the step that played last in this player (an automatic retry starts there); reset by `reconnect()` */
  private lastGood: VideoStep | null = null;
  /** VIDEO-TRANSPORT-2400: the frozen-MSE watch (its timer, the last progress sample, the freezes in a row) */
  private freezeTimer: number | undefined;
  private freezeMark: FreezeMark | null = null;
  private freezes = 0;
  /** VIDEO-SUB-FALLBACK-2402: why the current attempt failed (set where the failure is seen; '' = not a media / connect failure yet) */
  private failKind: SubFallbackReason | '' = '';
  /** why a main socket of an automatic-quality tile replaces its sub stream (its `fallback=` parameter) */
  private fallbackWhy: SubFallbackReason | '' = '';
  /** this tab remembers the camera's sub stream as giving nothing: the ladder starts on main */
  private subRemembered = false;
  /** True once fragments were dropped because the look-ahead buffer was full: the media after the buffer is gone. */
  stale = false;
  @state() status: PlayerStatus = 'idle';
  @state() transport: 'webrtc' | 'mse' | '' = '';
  @state() error = '';
  /** The remote live cap refused this stream: a final state (no ladder, no automatic retry) with its own text. */
  @state() capped = false;
  @state() capMax = 0;
  @state() muted = true;
  /** the current step of `plan` */
  @state() step = 0;
  /** a WebRTC step connected but rendered nothing (the browser cannot decode the stream) - vs. never connected */
  private decodeFailed = false;
  /** ends the current WebRTC first-frame watch (its visibilitychange listener) - re-review F1 */
  private stopFirstFrameWatch?: () => void;
  /** frames decode but the browser refused autoplay: the picture asks for a tap (re-review F2) */
  @state() needsTap = false;
  private webrtcConnected = false;

  @query('video') private video!: HTMLVideoElement;
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private ms: MediaSource | null = null;
  private sb: SourceBuffer | null = null;
  private queue: ArrayBuffer[] = [];
  private timer: number | undefined;
  private retryTimer: number | undefined;
  /** WARMUP-POLISH-2421: the socket-open bound and the connecting cap of the current attempt */
  private openTimer: number | undefined;
  private capTimer: number | undefined;
  /** WARMUP-POLISH-2421: the error is one a viewer can retry by hand (the server did not answer): the tile shows "נסה שוב" */
  @state() private offerRetry = false;
  /** HEALTH-GO2RTC-2430: the video service itself is down - one message, no own retry timer; the shared watch (api/video-service)
   * re-checks on a backoff to 60 s and this tile reconnects when it reports the recovery */
  @state() private serviceDown = false;
  private unsubService: (() => void) | undefined;
  /** HEALTH-GO2RTC-2430: the current socket delivered a frame (text or media) - a close without one is checked against the server */
  private gotFrame = false;
  private generation = 0;
  private triedWebrtc = false;
  private pendingMime = '';
  private attempts = 0;
  private lastPreferMse = false;

  static styles = css`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      block-size: 100%;
      background: var(--sw-video-bg);
      overflow: hidden;
      /* SKIN-QA-2403: the tile's own width decides whether the top-start tag shares the top row with a top-end badge (.subtag below) */
      container: swlp / inline-size;
    }
    video,
    img.poster {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      background: var(--sw-video-bg);
    }
    img.poster {
      object-fit: cover;
    }
    /* the live picture's own framing (the fit property) - separate rules from the poster's own default above */
    :host([fit='cover']) video {
      object-fit: cover;
    }
    :host([fit='fill']) video {
      object-fit: fill;
    }
    /* T018 re-review: match the poster to the live framing choice too, so a wide/spanned tile does not crop
       while connecting and then jump to a stretched frame the moment live video starts. */
    :host([fit='fill']) img.poster {
      object-fit: fill;
    }
    video.hidden {
      visibility: hidden;
    }
    .status {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-end: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-2xs);
      font-weight: 600;
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      border-radius: 999px;
      padding: 2px 8px;
      backdrop-filter: var(--sw-perf-blur, blur(6px));
    }
    .status i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-warning);
    }
    .status.playing i {
      background: var(--sw-success);
    }
    .status.error i {
      background: var(--sw-danger);
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-on-video-2);
      font-size: var(--sw-fs-xs);
      text-align: center;
      padding: 12px;
      background: color-mix(in srgb, var(--sw-video-bg) 35%, transparent);
    }
    .center div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    .center .hint {
      font-size: var(--sw-fs-2xs);
      opacity: 0.75;
    }
    /* WARMUP-POLISH-2421: the viewer's retry when the video server does not answer */
    .center .again {
      margin-block-start: 2px;
      padding: 6px 14px;
      min-block-size: 32px;
      border: 1px solid var(--sw-video-line);
      border-radius: 999px;
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      cursor: pointer;
    }
    .spin {
      inline-size: 22px;
      block-size: 22px;
      border: 2px solid var(--sw-video-line);
      border-top-color: var(--sw-on-video);
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .mute {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 8px;
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      border: 0;
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .mute:hover {
      background: var(--sw-video-scrim-strong);
    }
    .mute:focus-visible,
    .tap:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-on-video);
      outline-offset: var(--sw-focus-offset);
    }
    :host([compact]) .mute,
    :host([compact]) .status span.t {
      display: none;
    }
    /* CR-008 D7: what is playing on the remote channel (profile · transport), and an announced fallback */
    .vbadge {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      direction: ltr;
      font-size: var(--sw-fs-2xs);
      font-weight: 600;
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      border-radius: 999px;
      padding: 2px 8px;
      backdrop-filter: var(--sw-perf-blur, blur(6px));
    }
    .vbadge.mse {
      background: color-mix(in srgb, var(--sw-warning-text) 85%, transparent);
    }
    .vbadge.trying {
      background: var(--sw-video-scrim);
      font-weight: 500;
      opacity: 0.85;
    }
    /* re-review F2: autoplay refused (iOS Low Power Mode) - one tap starts the decoded stream */
    .tap {
      position: absolute;
      inset: 0;
      margin: auto;
      inline-size: max-content;
      block-size: max-content;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: 0;
      border-radius: 999px;
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: 600;
      cursor: pointer;
    }
    .vnotice {
      position: absolute;
      inset-inline: 8px;
      inset-block-start: 34px;
      font-size: var(--sw-fs-xs);
      line-height: 1.4;
      color: var(--sw-on-video);
      background: var(--sw-video-scrim-strong);
      border-radius: var(--sw-r-sm);
      padding: 4px 8px;
      text-align: start;
    }
    :host([compact]) .vnotice {
      display: none;
    }
    /* VIDEO-SUB-FALLBACK-2402: the automatic quality moved this tile to the main stream - quiet, top-start (the badges sit top-end) */
    .subtag {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      font-size: var(--sw-fs-2xs);
      font-weight: 500;
      /* SKIN-QA-2403: the full on-video ink, as the status pill beside it - the 72 % ink read at 3.3:1 when the picture under the scrim is
         bright (a sunlit yard, a white wall; the tile's picture is never known). Still quiet: weight 500, the smallest size, no icon. */
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(6px));
      backdrop-filter: var(--sw-perf-blur, blur(6px));
      border-radius: 999px;
      padding: 2px 8px;
      pointer-events: none;
    }
    /* SKIN-QA-2403: the remote channel's profile badge (.vbadge) is "direction: ltr", so its inline END is the right edge - the same
       corner as this tag's inline start in the RTL shell: the two lay on top of each other on every remote tile. The tag steps down
       to a second row under the badge. The H.265 tag sits at the real end (left): it meets the tag only on a narrow tile. */
    .vbadge ~ .subtag {
      inset-block-start: 30px;
    }
    @container swlp (max-width: 240px) {
      .h265tag ~ .subtag {
        inset-block-start: 30px;
      }
    }
    /* SKIN-QA-FOLLOWUP-2404 (owner round 22: the fallback stays visible on every tile): a tile narrower than SUB_CHIP_MAX (a phone wall
       of three columns, ~116 x 65 px) has no free row for the words - not beside the remote profile badge (top-start), not under it (the
       camera's name). The tag becomes a CHIP: a 20 px circle with the "up" glyph (stepped up from the sub stream to the main one) in the
       bottom-end corner, on the name's row, opposite the name (sw-camera-tile keeps the name clear of it). The words stay in the DOM,
       visually hidden (the accessible name); they are the tooltip under a mouse and show in a bubble on a long press. */
    .subtag .subico {
      display: none;
    }
    :host([data-subchip]) .subtag,
    :host([data-subchip]) .vbadge ~ .subtag,
    :host([data-subchip]) .h265tag ~ .subtag {
      inset-block-start: auto;
      inset-inline-start: auto;
      inset-inline-end: 6px;
      inset-block-end: 6px;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      inline-size: 20px;
      block-size: 20px;
      padding: 0;
      border-radius: 50%;
      pointer-events: auto;
      cursor: default;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      user-select: none;
      -webkit-user-select: none;
    }
    /* a finger-sized area for the long press, drawn nowhere (a short tap passes on to the tile) */
    :host([data-subchip]) .subtag::after {
      content: '';
      position: absolute;
      inset: -8px;
    }
    :host([data-subchip]) .subtag .subico {
      display: inline-flex;
    }
    :host([data-subchip]) .subtag .subtxt {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    /* the long-press words: over the tile, above the chip; they wrap rather than run off a narrow tile */
    .subhint {
      position: absolute;
      inset-inline-end: 6px;
      inset-block-end: 32px;
      z-index: 2;
      box-sizing: border-box;
      max-inline-size: calc(100% - 12px);
      padding: 4px 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      font-weight: 500;
      line-height: 1.3;
      white-space: normal;
      overflow-wrap: anywhere;
      pointer-events: none;
    }
    /* LIVE-H265-2341: the server played a fallback of an H.265 stream (another profile, or the transcoded H.264 variant) */
    .h265tag {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: var(--sw-fs-2xs);
      font-weight: 600;
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      border-radius: 999px;
      padding: 2px 8px;
      backdrop-filter: var(--sw-perf-blur, blur(6px));
    }
    /* under a remote plan its own badge sits there: the tag goes below it */
    .h265tag.below {
      inset-block-start: 34px;
    }
    /* the transcode cap is full: the snapshot refreshes behind this notice (no black tile, no spinner loop) */
    .stillnote {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 34px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-2xs);
      line-height: 1.4;
      color: var(--sw-on-video);
      background: var(--sw-video-scrim-strong);
      border-radius: var(--sw-r-sm);
      padding: 4px 8px;
      text-align: start;
    }
  `;

  /** Owner 2026-10-01: the notes about how the stream plays (media.video_notices, default off); the badge keeps the same text as its tooltip. */
  @state() private showNotices = false;
  /** SKIN-QA-FOLLOWUP-2404: the player is narrower than SUB_CHIP_MAX (the fallback tag is drawn as a chip there). */
  @state() private narrow = false;
  /** SKIN-QA-FOLLOWUP-2404: the chip's words are shown (a long press). */
  @state() private subHint = false;
  private sizeRo: ResizeObserver | null = null;
  private hintPress: { x: number; y: number; timer: number } | null = null;
  private hintHide = 0;
  private swallowClick = false;

  connectedCallback() {
    super.connectedCallback();
    if (typeof ResizeObserver === 'function') {
      this.sizeRo = new ResizeObserver(() => {
        const narrow = this.getBoundingClientRect().width < SUB_CHIP_MAX;
        if (narrow !== this.narrow) this.narrow = narrow;
      });
      this.sizeRo.observe(this);
    }
    void productSettings()
      .then((s) => {
        this.showNotices = s['media.video_notices'] === 'true';
        const policy = normalizePolicy(s['media.h265_policy']);
        if (policy === this.h265Policy) return;
        this.h265Policy = policy;
        // the chain of an H.265 camera depends on the policy: open it again under the installation's choice
        if (this.active && this.cameraId && !this.wsUrl && (streamCodec(this.encoding, 'main') === 'h265' || streamCodec(this.encoding, 'sub') === 'h265')) this.reconnect();
      })
      .catch(() => undefined);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.sizeRo?.disconnect();
    this.sizeRo = null;
    this.endHintPress();
    window.clearTimeout(this.hintHide);
    this.disconnect();
  }

  /** SKIN-QA-FOLLOWUP-2404: the fallback is drawn as the chip (reflected as `data-subchip`; sw-camera-tile keeps the name clear of it). */
  private get subChip(): boolean {
    return this.narrow && this.subFellBack && this.status !== 'error';
  }

  private endHintPress() {
    if (this.hintPress) window.clearTimeout(this.hintPress.timer);
    this.hintPress = null;
  }

  /** A long press on the chip shows its words. */
  private onChipDown = (e: PointerEvent) => {
    this.endHintPress();
    this.swallowClick = false;
    const timer = window.setTimeout(() => {
      this.hintPress = null;
      this.swallowClick = true; // the release that ends a long press does not also open the camera
      this.subHint = true;
      window.clearTimeout(this.hintHide);
      this.hintHide = window.setTimeout(() => (this.subHint = false), SUB_HINT_SHOW_MS);
    }, SUB_HINT_PRESS_MS);
    this.hintPress = { x: e.clientX, y: e.clientY, timer };
  };

  private onChipMove = (e: PointerEvent) => {
    if (this.hintPress && Math.hypot(e.clientX - this.hintPress.x, e.clientY - this.hintPress.y) > SUB_HINT_MOVE_PX) this.endHintPress();
  };

  private onChipUp = () => this.endHintPress();

  private onChipClick = (e: Event) => {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  private onChipMenu = (e: Event) => {
    if (this.subChip) e.preventDefault(); // no text-selection / context menu under a long press
  };

  /** The first render (properties set) and every later change of camera/profile/mode/active (re)connects. */
  protected updated(changed: Map<string, unknown>) {
    this.toggleAttribute('data-subchip', this.subChip);
    if (!this.subChip && this.subHint) this.subHint = false;
    if (changed.has('active') || changed.has('cameraId') || changed.has('livePath') || changed.has('profile') || changed.has('mode') || changed.has('wsUrl') || changed.has('plan') || changed.has('preferred') || changed.has('autoProfile')) {
      this.endStill();
      if (!this.active || (!this.cameraId && !this.wsUrl && !this.livePath)) this.disconnect();
      else this.reconnect();
    }
  }

  /** Playback helpers: the media element's own clock (seconds since this generation started). */
  get mediaTime(): number {
    return this.video?.currentTime ?? 0;
  }

  /** Seconds of media already buffered ahead of the playhead (0 when nothing is buffered around it). */
  get bufferAhead(): number {
    const v = this.video;
    if (!v || !v.buffered.length) return 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.currentTime >= v.buffered.start(i) - 0.05 && v.currentTime <= v.buffered.end(i)) return v.buffered.end(i) - v.currentTime;
    }
    return 0;
  }

  /** T066 frame step inside the buffered media: pauses and moves the playhead by `frames` at `fps`. Returns false
   * (and moves nothing) when the target frame is not buffered — a real seek is needed then. */
  stepFrame(frames: number, fps = 25): boolean {
    const v = this.video;
    if (!v || !v.buffered.length || !fps) return false;
    v.pause();
    const target = v.currentTime + frames / fps;
    for (let i = 0; i < v.buffered.length; i++) {
      if (target >= v.buffered.start(i) && target <= v.buffered.end(i)) {
        v.currentTime = target;
        return true;
      }
    }
    // forward, just past what has arrived: the relay keeps sending while paused, so the frame is on its way — the
    // element waits for it; backward beyond the buffer is gone (evicted) and needs a real seek
    const end = v.buffered.end(v.buffered.length - 1);
    if (frames > 0 && target > end && target - end <= 1.0) {
      v.currentTime = target;
      return true;
    }
    return false;
  }

  /** Playback rate of the rendered stream (T042): a synchronized group nudges a tile a few percent faster or slower to close a small drift without a re-seek. */
  get rate(): number {
    return this.video?.playbackRate ?? 1;
  }

  set rate(value: number) {
    if (this.video && Math.abs(this.video.playbackRate - value) > 0.001) this.video.playbackRate = value;
  }

  get paused(): boolean {
    return this.video?.paused ?? true;
  }

  pause() {
    this.video?.pause();
  }

  resume() {
    void this.video?.play().catch(() => undefined);
  }

  /** Public: drop the current connection (if any) and open a fresh one. */
  reconnect() {
    this.disconnect();
    this.step = 0;
    this.decodeFailed = false;
    this.lastGood = null; // a new camera / profile / choice (or the viewer's own "reconnect"): the plan starts from its top
    this.freezes = 0;
    this.noteSubRemembered();
    this.buildChain();
    this.connect();
  }

  /** LAN / Ingress: the fallback chain of a live catalogue camera, a remembered working step first. */
  private buildChain() {
    this.chainIndex = 0;
    this.chainRemembered = false;
    if (this.laddered || this.wsUrl || !this.cameraId) {
      this.chain = [];
      return;
    }
    const natural = lanLadder(this.profile, this.mode, this.autoProfile);
    const remembered = rememberedStep(this.cameraId, this.profile, this.mode);
    this.chain = orderLadder(natural, remembered);
    this.chainRemembered = !!remembered && sameStep(this.chain[0], remembered) && !sameStep(natural[0], remembered);
    this.chainConnectFailed = false;
    // WebRTC known unreachable from this tab (owner 2026-10-05): an `auto` chain starts on MSE without its own wait
    this.chainWebrtcDown = this.mode === 'auto' && !remembered && webrtcUnreachable();
    if (this.chainWebrtcDown) this.chain = mseFirst(natural);
    // LIVE-H265-2341: an H.265 stream this browser decodes over MSE only starts there (no WebRTC wait that cannot succeed)
    else if (!remembered) this.chain = orderForH265(natural, this.encoding, h265Support(), this.mode, this.h265Policy);
    if (this.subRemembered) this.chain = mainFirst(this.chain); // VIDEO-SUB-FALLBACK-2402: no sub attempt while it is remembered dead
  }

  /** VIDEO-SUB-FALLBACK-2402: does this tab remember the camera's sub stream as giving nothing (automatic quality only)? */
  private noteSubRemembered() {
    this.subRemembered = this.subFallbackApplies() && subDown(this.cameraId);
    this.fallbackWhy = this.subRemembered ? 'sub_remembered' : '';
  }

  /** The automatic quality of a live catalogue camera whose own profile is sub (the wall's default quality). */
  private subFallbackApplies(): boolean {
    return this.autoProfile && this.profile === 'sub' && !!this.cameraId && !this.wsUrl;
  }

  /** VIDEO-SUB-FALLBACK-2402: the failing SUB step's main twin on the same transport, when the quality is automatic. True when it was
   * taken (a fresh socket is opening). */
  private trySubFallback(): boolean {
    if (!this.subFallbackApplies() || this.status === 'playing') return false;
    const ladder = this.laddered ? this.steps() : this.chain;
    const current = this.currentStep ?? this.lanStep;
    const alt = subFallbackStep(ladder, current);
    if (!alt) return false;
    const why: SubFallbackReason = this.failKind || 'sub_connect';
    noteSubDown(this.cameraId);
    this.fallbackWhy = why;
    console.info('sw-live-player: sub stream gave nothing, main stream on the same transport', this.cameraId, why, alt.transport);
    const i = ladder.findIndex((x) => sameStep(x, alt));
    if (this.laddered) this.step = i;
    else this.chainIndex = i;
    this.connect(); // a fresh socket: go2rtc must not keep the dead consumer of the old one
    return true;
  }

  /** A LAN / Ingress chain is in force (live catalogue camera, no remote plan). */
  get lanChained(): boolean {
    return !this.laddered && !this.wsUrl && !!this.cameraId && this.chain.length > 0;
  }

  /** The LAN chain step being played or tried. */
  get lanStep(): VideoStep | null {
    return this.lanChained ? (this.chain[this.chainIndex] ?? null) : null;
  }

  /** Another step of the LAN chain is left after the current one. */
  private hasChainStep(): boolean {
    return this.lanChained && this.chainIndex + 1 < this.chain.length;
  }

  /** The current LAN step failed before its first frame: the next allowed step, or the end of the chain. */
  private chainNext(reason: string, decode = false) {
    if (decode) this.decodeFailed = true;
    // a WebRTC step that never connected on an `auto` chain: WebRTC is unreachable from here for a while (every
    // `auto` player of this tab starts on MSE until the memory expires), and this camera is not pinned to MSE for a day
    if (!decode && this.mode === 'auto' && this.chain[this.chainIndex]?.transport === 'webrtc') {
      this.chainConnectFailed = true;
      noteWebrtcUnreachable();
    }
    if (this.chainRemembered && this.chainIndex === 0) rememberStep(this.cameraId, this.profile, this.mode, null);
    this.chainRemembered = false;
    // VIDEO-SUB-FALLBACK-2402: the sub stream itself gives nothing (no media / go2rtc refused it): its main twin on this transport now
    if (!decode && (this.failKind === 'sub_no_media' || this.failKind === 'sub_error') && this.trySubFallback()) return;
    for (let j = this.chainIndex + 1; j < this.chain.length; j++) {
      // the other profile only once a step proved the stream undecodable - not after a mere connection failure
      if (this.chain[j].profile === this.profile || this.decodeFailed) {
        this.chainIndex = j;
        this.connect(); // a fresh socket: go2rtc must not keep the dead consumer of the old one
        return;
      }
    }
    // VIDEO-SUB-FALLBACK-2402: no sub step left (a connect failure walked the policy's own order first): the main twin
    if (!this.decodeFailed && this.trySubFallback()) return;
    const message = this.decodeFailed && this.mode === 'webrtc' ? 'WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה — בחר MSE או אוטומטי' : reason;
    this.fail(message, !this.decodeFailed); // undecodable everywhere: retrying the same chain cannot help
  }

  /** An MSE step failed before its first frame: the next LAN step, else the error (plans and playback: unchanged). */
  private mseFailed(reason: string, decode = false) {
    if (this.lanChained && this.status !== 'playing') this.chainNext(reason, decode);
    else if (this.laddered && this.trySubFallback()) return; // VIDEO-SUB-FALLBACK-2402: a remote plan's sub MSE step
    else this.fail(reason);
  }

  /** CR-008 D7: a remote plan is in force (live video only; recorded playback keeps its own MSE socket). */
  get laddered(): boolean {
    return !!this.plan && !this.wsUrl;
  }

  private steps(): VideoStep[] {
    if (!this.laddered) return [];
    const steps = decodeLadder(this.plan);
    // an explicit choice never plays the other transport, whatever plan a screen handed over (owner bug 2026-10-01: WebRTC only;
    // VIDEO-TRANSPORT-2400: MSE only too)
    const own = this.mode === 'webrtc' || this.mode === 'mse' ? steps.filter((s) => s.transport === this.mode) : orderForH265(steps, this.encoding, h265Support(), this.mode, this.h265Policy);
    return this.subRemembered ? mainFirst(own) : own; // VIDEO-SUB-FALLBACK-2402: no sub attempt while it is remembered dead
  }

  /** The step being played or tried (null outside a plan, or when the plan has none left). */
  get currentStep(): VideoStep | null {
    return this.steps()[this.step] ?? null;
  }

  /** VIDEO-SUB-FALLBACK-2402: an automatic-quality tile of a sub profile plays (or tries) its main stream. */
  get subFellBack(): boolean {
    return this.subFallbackApplies() && this.effectiveProfile === 'main';
  }

  /** The profile the socket opens: the current step's under a plan, else the `profile` property. */
  get effectiveProfile(): Profile {
    return this.currentStep?.profile ?? this.lanStep?.profile ?? this.profile;
  }

  /** Public: open the stream. `preferMse` is set internally after a WebRTC failure in auto mode. */
  connect(preferMse = false) {
    if ((!this.cameraId && !this.wsUrl && !this.livePath) || !this.active) return;
    // NN1: no socket without a live source and a media server; the screens are hidden then, this is the last line for a stray tile
    if (isApi() && !cap('live_video')) {
      this.fail('וידאו חי אינו זמין', false);
      return;
    }
    // HEALTH-GO2RTC-2430: the tab already knows the video service is down - say so and wait for the recovery, no socket
    if (videoService.down) {
      this.videoServiceDown(false);
      return;
    }
    if (this.laddered && !this.currentStep) {
      this.planExhausted();
      return;
    }
    this.teardown(); // never leave an earlier socket open: the relay counts every socket as a session
    const gen = (this.generation += 1);
    this.status = 'connecting';
    this.error = '';
    this.offerRetry = false;
    this.serviceDown = false;
    this.gotFrame = false;
    this.capped = false;
    this.transport = '';
    this.served = null;
    this.failKind = '';
    const step = this.currentStep ?? this.lanStep;
    // a chain-less `auto` live source (a Home Assistant camera on its own relay path) starts on MSE while this tab
    // remembers WebRTC as unreachable (owner 2026-10-05), like a chained camera does
    const mseNow = preferMse || (!step && !this.wsUrl && this.mode === 'auto' && webrtcUnreachable());
    this.triedWebrtc = mseNow;
    this.lastPreferMse = mseNow;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.wsUrl || (this.livePath && !this.cameraId ? relayWsUrl(this.livePath) : liveWsUrl(this.cameraId, this.effectiveProfile, this.h265Flag(step?.transport ?? (mseNow || this.mode === 'mse' ? 'mse' : 'webrtc')), this.subFellBack ? this.fallbackWhy || 'sub_error' : '')));
    } catch (err) {
      this.fail('לא ניתן לפתוח חיבור');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    // WARMUP-POLISH-2421: never an endless "מתחבר…" - a socket that does not open, or an attempt no step's own bound ended
    this.openTimer = window.setTimeout(() => {
      if (gen === this.generation && ws.readyState === WebSocket.CONNECTING) this.connectTimedOut();
    }, SOCKET_OPEN_MS);
    this.capTimer = window.setTimeout(() => {
      if (gen === this.generation && this.status === 'connecting') this.connectTimedOut();
    }, CONNECTING_CAP_MS);
    ws.onopen = () => {
      if (gen !== this.generation) return;
      window.clearTimeout(this.openTimer);
      if (step) {
        if (step.transport === 'mse') this.startMse();
        else this.startWebrtc();
      } else if (this.wsUrl || this.mode === 'mse' || (this.mode === 'auto' && mseNow)) this.startMse();
      else this.startWebrtc();
    };
    ws.onmessage = (ev) => {
      if (gen !== this.generation) return;
      this.gotFrame = true;
      if (typeof ev.data === 'string') this.onSignal(ev.data);
      else this.onFragment(ev.data as ArrayBuffer);
    };
    ws.onerror = () => {
      /* `close` always follows and carries the code; deciding there keeps the auto fallback in one place */
    };
    ws.onclose = (ev) => {
      if (gen !== this.generation) return;
      if (this.status === 'error') return;
      // HEALTH-GO2RTC-2430 (lab 11.11): HA ingress delivers the relay's 4503 as a plain close 1000. A socket that closes before any
      // frame, or with a bare 4503, asks the server whether the video service is down before deciding (a failed check: as before)
      if (!this.gotFrame && (ev.code === 4503 || (ev.code < 4000 && this.status === 'connecting'))) {
        void videoService.check().then((s) => {
          if (gen !== this.generation || this.status === 'error') return;
          if (isDownState(s)) this.videoServiceDown(false);
          else this.closed(ev);
        });
        return;
      }
      this.closed(ev);
    };
  }

  /** The socket closed and the video service is not known to be down: the transport ladder, the end of a recording, or the error. */
  private closed(ev: CloseEvent) {
    if (H265_REFUSAL_CLOSE[ev.code] && this.cameraId && !this.wsUrl) {
      this.h265Refused(H265_REFUSAL_CLOSE[ev.code]); // the close without its message (a proxy dropped it): the same reaction
      return;
    }
    if (ev.code === 4429 && this.laddered) {
      this.capRefused(); // the close without its message (a proxy dropped it): still a cap, still no ladder and no retry
      return;
    }
    // go2rtc drops the socket when its WebRTC consumer dies: in auto mode that is a transport failure, not the end.
    if ((this.mode === 'auto' || this.laddered || this.hasChainStep()) && this.transport === 'webrtc' && this.status !== 'playing' && ev.code < 4000) {
      this.webrtcFailed('WebRTC נכשל');
      return;
    }
    if (!this.retry && this.status === 'playing' && ev.code < 4000) {
      // Playback reached the end of the requested range (or the session was superseded): show it as such.
      this.teardown();
      this.status = 'ended';
      this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'ended', code: ev.code }, bubbles: true, composed: true }));
      return;
    }
    const reason = ev.code === 4403 ? 'אין הרשאת צפייה' : ev.code === 4429 ? 'הגיע למכסת הזרמים' : ev.code === 4503 ? VIDEO_SERVER_DOWN : ev.code === 4401 ? 'נדרשת הזדהות' : ev.code === 4404 ? 'סשן הניגון פג' : ev.code === 4410 ? 'הסשן הוחלף' : this.status === 'playing' ? 'החיבור נותק' : 'החיבור נסגר';
    this.fail(reason, this.retry && ev.code !== 4401 && ev.code !== 4403 && ev.code !== 4404 && ev.code !== 4410, ev.code); // a quota hit retries later; a denial does not
  }

  disconnect() {
    this.endStill();
    this.teardown();
    window.clearTimeout(this.retryTimer);
    this.attempts = 0;
    this.status = 'idle';
    this.transport = '';
    this.serviceDown = false;
    this.unsubService?.();
    this.unsubService = undefined;
  }

  /** HEALTH-GO2RTC-2430: the video service is down (the relay's error frame, a checked close, or the tab already knew): one plain
   * message (administrators also see where to look), the snapshot stays, no retry timer of this tile - it waits for the shared watch
   * to report the recovery and then reconnects by itself (a recording tile, `retry` off, offers "נסה שוב" instead). */
  private videoServiceDown(mark = true) {
    this.teardown();
    window.clearTimeout(this.retryTimer);
    this.status = 'error';
    this.error = VIDEO_SERVICE_DOWN_HE;
    this.serviceDown = true;
    this.offerRetry = true;
    this.capped = false;
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'error', error: this.error, code: 'video_service_down' }, bubbles: true, composed: true }));
    if (mark) videoService.markDown();
    if (this.unsubService) return;
    this.unsubService = videoService.subscribe((down) => {
      if (down || !this.serviceDown) return;
      this.unsubService?.();
      this.unsubService = undefined;
      if (this.active && this.isConnected && this.retry) {
        this.attempts = 0;
        this.reconnect();
      }
    });
  }

  /** Close socket, peer connection and media source without touching the visible status. */
  private teardown() {
    this.generation += 1;
    window.clearTimeout(this.timer);
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.openTimer);
    window.clearTimeout(this.capTimer);
    this.stopFreezeWatch();
    this.stopFirstFrameWatch?.();
    this.needsTap = false;
    this.pendingMime = '';
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
    this.sb = null;
    this.queue = [];
    this.stale = false;
    this.ms = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      if (this.video.src.startsWith('blob:')) URL.revokeObjectURL(this.video.src);
      this.video.removeAttribute('src');
      this.video.load();
    }
  }

  private send(msg: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** `remote_live_cap` (the relay's error message, then close 4429): shown as what it is. Not a transport failure - the
   * WebRTC → MSE ladder is not walked, no retry timer is armed (a retry storm would only burn the rate-limited audit),
   * and no "מנסה …" badge is left on the picture. */
  private capRefused(max?: number) {
    this.teardown();
    this.capped = true;
    this.capMax = Number(max) > 0 ? Number(max) : 0;
    this.status = 'error';
    this.error = liveCapTitle(this.capMax);
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'error', error: this.error, code: 'remote_live_cap', max: this.capMax }, bubbles: true, composed: true }));
  }

  /** LIVE-H265-2341: the live socket's `h265` parameter for an attempt over `transport` - only for a catalogue camera
   * (a playback session or a Home Assistant camera's relay path never carries it) and never under the policy `off`. */
  private h265Flag(transport: StepTransport): '' | '0' | '1' {
    if (!this.cameraId || this.wsUrl || this.h265Policy === 'off') return '';
    return h265Param(h265Support(), transport);
  }

  /** LIVE-H265-2341: the server refused this socket for its codec (`h265_unsupported`) or the transcode cap (`transcode_cap`).
   * Another step of the chain / plan may still play (MSE when the browser decodes H.265 there); otherwise the reason stays on
   * the tile (no retry), or - the cap - a refreshing snapshot with the notice while the live socket is retried later. */
  private h265Refused(refusal: H265Refusal, max?: number, message?: string) {
    const next = this.laddered ? this.step + 1 < this.steps().length : this.hasChainStep();
    const reaction = h265Reaction(refusal, next && this.status !== 'playing');
    if (reaction === 'next') {
      if (this.laddered) this.nextStep(message || H265_UNSUPPORTED_HE, true);
      else this.chainNext(message || H265_UNSUPPORTED_HE, true); // "undecodable": the other profile's steps are allowed
      return;
    }
    if (reaction === 'message') {
      this.fail(message || H265_UNSUPPORTED_HE, false, refusal);
      return;
    }
    this.stillNotice = message || transcodeCapHe(Number(max) || 0);
    if (this.stillTimer === undefined) this.stillTimer = window.setInterval(() => (this.posterTick += 1), STILL_REFRESH_MS);
    this.fail(this.stillNotice, true, refusal);
  }

  private endStill() {
    if (this.stillTimer !== undefined) window.clearInterval(this.stillTimer);
    this.stillTimer = undefined;
    this.stillNotice = '';
  }

  /** The poster, re-fetched every STILL_REFRESH_MS while the transcode cap keeps the tile on its snapshot. */
  private posterSrc(): string {
    if (!this.stillNotice || !this.posterTick || !this.poster) return this.poster;
    return `${this.poster}${this.poster.includes('?') ? '&' : '?'}r=${this.posterTick}`;
  }

  /** The tag of a fallback the server chose (another profile, the transcoded H.264 variant); the full sentence as its tooltip. */
  private renderServed() {
    const s = this.served;
    if (!s || s.kind === 'native' || this.status === 'error') return nothing;
    const text = s.message || H265_ALTERNATE_HE;
    return html`<span class="h265tag ${this.laddered ? 'below' : ''}" data-h265-fallback=${s.kind} title=${text} aria-label=${text}>${servedTag(s)}</span>
      ${this.showNotices && !this.compact && !this.laddered ? html`<div class="vnotice" data-h265-notice role="status">${text}</div>` : nothing}`;
  }

  /** `code`: the socket's close code, or the relay's error value - carried in the event so a recording screen can tell a lost
   * connection (resume automatically, 2.0.0) from a denial or a superseded generation (never). */
  /** WARMUP-POLISH-2421: the server did not answer in time - the plain message with a retry button; retried by itself as well. */
  private connectTimedOut() {
    this.fail(CONNECT_TIMEOUT_HE, true, 'connect_timeout');
    this.offerRetry = true;
  }

  /** WARMUP-POLISH-2421: the viewer's own "נסה שוב" - a fresh attempt now (the automatic retry's backoff starts over). */
  private retryNow = () => {
    this.attempts = 0;
    if (this.serviceDown && videoService.down) {
      // HEALTH-GO2RTC-2430: ask the server first - a reconnect while it is down would only show the same message again
      void videoService.check().then((s) => {
        if (!isDownState(s) && this.serviceDown) this.reconnect();
      });
      return;
    }
    this.reconnect();
  };

  private fail(message: string, retryable = true, code?: number | string) {
    this.teardown(); // release the relay session and the upstream stream right away
    this.status = 'error';
    this.error = message;
    this.offerRetry = message === VIDEO_SERVER_DOWN;
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'error', error: message, ...(code !== undefined ? { code } : {}) }, bubbles: true, composed: true }));
    if (retryable && this.retry && this.active && (this.cameraId || this.wsUrl || this.livePath)) {
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(this.attempts, 6));
      this.attempts += 1;
      this.retryTimer = window.setTimeout(() => {
        this.noteSubRemembered(); // VIDEO-SUB-FALLBACK-2402: a sub stream found dead meanwhile is not tried again on the reconnect
        if (this.laddered) {
          // VIDEO-TRANSPORT-2400: a plan restarts from the step that played last (lab audit: it restarted on WebRTC every time)
          this.step = retryIndex(this.steps(), this.lastGood);
          this.decodeFailed = false;
        }
        if (this.lanChained) {
          this.buildChain(); // a LAN chain starts over too (a remembered step first again) ...
          if (this.lastGood) {
            const ordered = orderLadder(this.chain, this.lastGood); // ... and the step that played last in this player before it
            if (ordered !== this.chain) {
              this.chain = ordered;
              this.chainRemembered = false;
            }
          }
          this.decodeFailed = false;
        }
        this.connect(this.lastPreferMse);
      }, delay);
    }
  }

  /** CR-008 D7: the current step failed before its first frame - the next step, or the end of the plan. */
  private nextStep(reason: string, decode = false) {
    // VIDEO-SUB-FALLBACK-2402: the sub stream gives nothing on this transport: its main twin first (never another transport for it)
    if (!decode && (this.failKind === 'sub_no_media' || this.failKind === 'sub_error') && this.trySubFallback()) return;
    if (decode) this.decodeFailed = true; // proven by the statistics (bytes, no frames), not merely "connected"
    if (this.step + 1 < this.steps().length) {
      this.step += 1;
      this.connect(); // a fresh socket: go2rtc must not keep the dead WebRTC consumer of the old one
      return;
    }
    this.step = this.steps().length;
    this.planExhausted(reason);
  }

  /** No step of the plan played (or the plan had none: every allowed WebRTC stream is known undecodable). */
  private planExhausted(reason = '') {
    const pref = (this.preferred || this.decodeLadderFirst() || this.profile) as Profile;
    const first = this.steps()[0];
    const preferredSkipped = !first || first.profile !== pref || first.transport !== 'webrtc';
    const decode = preferredSkipped || this.decodeFailed || !this.steps().length;
    // decoding: the owner's wording; never connected: UDP to go2rtc is likely blocked, and MSE (the tunnel) is off
    const why = this.mode === 'webrtc' ? 'הוגדר WebRTC בלבד' : 'MSE דרך המנהרה כבוי בהגדרות ‹ גישה מרחוק';
    const message = decode ? undecodableMessage(pref) : `${reason || 'WebRTC לא התחבר (ייתכן ש-UDP חסום)'} · ${why}`;
    this.fail(message, !decode);
  }

  private decodeLadderFirst(): Profile | null {
    return decodeLadder(this.plan)[0]?.profile ?? null;
  }

  // ---------- WebRTC ----------

  private async startWebrtc() {
    this.triedWebrtc = true;
    this.transport = 'webrtc';
    this.webrtcConnected = false;
    const gen = this.generation;
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: LIVE_ICE_SERVERS });
    } catch {
      // WARMUP-POLISH-2421: no WebRTC in this browser (or it refused the peer connection): the MSE path, never a stuck spinner
      this.webrtcFailed('WebRTC לא נתמך בדפדפן');
      return;
    }
    this.pc = pc;
    pc.ontrack = (ev) => {
      if (gen !== this.generation) return;
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      if (this.video.srcObject !== stream) {
        this.video.srcObject = stream;
        void this.video.play().catch(() => undefined);
      }
    };
    pc.onicecandidate = (ev) => {
      if (gen === this.generation && ev.candidate) this.send({ type: 'webrtc/candidate', value: ev.candidate.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (gen !== this.generation) return; // a closed, superseded peer connection must not trigger a fallback
      if (pc.connectionState === 'connected') this.webrtcConnected = true;
      // CR-008 review M2: under a plan, a transient `disconnected` before the first frame is not a failure (ICE may
      // recover on a mobile link); only `failed` / `closed` end the step - the first-frame watch bounds the wait
      if (this.laddered && this.status !== 'playing' && pc.connectionState === 'disconnected') return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') this.webrtcFailed('WebRTC נכשל');
    };
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    const started = performance.now();
    try {
      const offer = await pc.createOffer();
      if (gen !== this.generation) return; // torn down (another camera, profile or step) while awaiting: never send a stale offer
      await pc.setLocalDescription(offer);
      if (gen !== this.generation) return;
      this.send({ type: 'webrtc/offer', value: offer.sdp });
    } catch {
      if (gen !== this.generation) return;
      this.webrtcFailed('WebRTC לא נתמך בדפדפן');
      return;
    }
    window.clearTimeout(this.timer);
    // every `auto` attempt is watched (the connect bound applies to a chain-less HA camera too); `webrtc` without a chain
    // keeps the fixed timeout below
    if (this.laddered || this.lanChained || this.mode === 'auto') {
      this.watchFirstFrame(gen, pc, started);
      return;
    }
    this.timer = window.setTimeout(() => {
      if (this.status === 'playing') return;
      // Connected but nothing rendered: the browser cannot decode this stream over RTP (e.g. H.264 Main/High
      // 2560×1440 from the NVR main profile) — MSE plays the same stream. Not connected: UDP is blocked.
      const connected = this.pc?.connectionState === 'connected';
      if (connected) this.webrtcConnected = true;
      this.webrtcFailed(connected ? 'WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה — בחר MSE או אוטומטי' : 'WebRTC לא התחבר (UDP חסום?)');
    }, WEBRTC_TIMEOUT_MS);
  }

  /**
   * CR-008 review M2 - the first-frame watch of a WebRTC step under a plan (instead of one fixed 12 s timeout). Every
   * second it reads the inbound video RTP statistics:
   *  - bytes arrive but no frame decodes for `decodeGraceMs` (sized from the stream's GOP when the registry knows it)
   *    → the browser cannot decode this stream: a decode failure;
   *  - no bytes yet → keep waiting (ICE over a mobile link, go2rtc waiting for the next key frame) up to
   *    FIRST_FRAME_CAP_MS, then a connection failure - not a decode failure;
   *  - no statistics at all → the old rule at the cap: connected but nothing rendered is a decode failure;
   *  - frames decoded → WebRTC works: never a failure, even before the `playing` event (a deferred autoplay);
   *  - the tab is hidden → no judgement; the clock restarts when it is visible again (the listener, or a tick that
   *    sees the tab visible after a gap longer than three poll intervals - JS frozen in the background);
   *  - a browser without the framesDecoded counter: a <video> with a current frame counts as decoding, otherwise the
   *    cap decides.
   */
  private watchFirstFrame(gen: number, pc: RTCPeerConnection, started: number) {
    this.stopFirstFrameWatch?.();
    // LAN / Ingress keeps its shorter first-frame bound (no mobile link to wait for); a stream whose bytes arrive
    // undecoded is judged by the decode grace on both channels
    const cap = this.laddered ? FIRST_FRAME_CAP_MS : WEBRTC_TIMEOUT_MS;
    // owner 2026-10-05: an `auto` player outside the remote plan gives ICE WEBRTC_CONNECT_MS; the remote plan keeps its
    // own cap (a mobile link), `webrtc` only has nothing to fall back to and keeps the full wait
    const connectCap = !this.laddered && this.mode === 'auto' ? WEBRTC_CONNECT_MS : 0;
    let firstBytesAt = 0;
    let lastTickAt = performance.now();
    // re-review: a background tab defers play() and throttles timers - no judgement while hidden, and a fresh clock
    // (the monotonic performance.now(), not the wall clock) once the tab is visible again
    const restart = () => {
      started = performance.now();
      firstBytesAt = 0;
    };
    const onVisibility = () => {
      if (gen !== this.generation) return stop();
      if (!document.hidden) restart();
    };
    const stop = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (this.stopFirstFrameWatch === stop) this.stopFirstFrameWatch = undefined;
    };
    document.addEventListener('visibilitychange', onVisibility);
    // re-review F1: teardown() and onPlaying() end the watch too - no listener outlives its peer connection
    this.stopFirstFrameWatch = stop;
    const rearm = () => {
      this.timer = window.setTimeout(() => void tick(), STATS_POLL_MS);
    };
    const tick = async () => {
      if (gen !== this.generation || this.status === 'playing') return stop();
      // re-review F3: iOS may freeze JS right after backgrounding, before a hidden tick runs; on resume this timer can
      // fire before `visibilitychange`. A gap far beyond the poll interval means the clocks are stale: start over.
      const tickAt = performance.now();
      const frozen = tickAt - lastTickAt > 3 * STATS_POLL_MS;
      lastTickAt = tickAt;
      if (document.hidden || frozen) {
        restart();
        return rearm();
      }
      let bytes = -1;
      let decoded = -1; // -1: the browser does not report framesDecoded (re-review F4: missing is not "0 decoded")
      try {
        const stats = await pc.getStats();
        stats.forEach((r: { type?: string; kind?: string; mediaType?: string; bytesReceived?: number; framesDecoded?: number }) => {
          if (r.type === 'inbound-rtp' && (r.kind ?? r.mediaType) === 'video') {
            bytes = Math.max(bytes, r.bytesReceived ?? 0);
            if (typeof r.framesDecoded === 'number') decoded = Math.max(decoded, r.framesDecoded);
          }
        });
      } catch {
        /* no statistics in this browser: the cap below decides */
      }
      if (gen !== this.generation || (this.status as PlayerStatus) === 'playing') return stop(); // the await may have seen the first frame
      if (document.hidden) {
        restart();
        return rearm();
      }
      // without the counter, a <video> that has a current frame is the decoded signal
      const decodes = decoded > 0 || (decoded < 0 && bytes > 0 && (this.video?.readyState ?? 0) >= 2);
      if (decodes) {
        // frames decode: WebRTC works. The `playing` event may lag (autoplay deferred); nudge play() and never judge
        // this step again - it is not a failure. A refused autoplay (iOS Low Power Mode refuses even muted video) asks
        // for a tap instead of waiting forever.
        stop();
        this.nudgePlay(gen);
        return;
      }
      const now = performance.now();
      if (bytes > 0 && !firstBytesAt) firstBytesAt = now;
      // no ICE connection and no byte within the connect bound: WebRTC is unreachable from here - MSE, now
      if (connectCap && now - started >= connectCap && bytes <= 0 && pc.connectionState !== 'connected' && !this.webrtcConnected) {
        stop();
        this.webrtcFailed('WebRTC לא התחבר (ייתכן ש-UDP חסום)');
        return;
      }
      if (bytes > 0 && decoded === 0 && now - firstBytesAt >= this.decodeGraceMs()) {
        stop();
        this.webrtcFailed('WebRTC התחבר אך הדפדפן לא מפענח את הזרם', true);
        return;
      }
      if (now - started >= cap && !(bytes > 0 && decoded === 0)) {
        stop();
        if (bytes === 0) this.failKind = 'sub_no_media'; // VIDEO-SUB-FALLBACK-2402: statistics read, not one byte arrived
        // no counter and nothing rendered although bytes arrive (or no statistics while connected): the cap calls it
        // a decode failure; no bytes at all: a connection failure. LAN keeps its earlier rule: connected at the cap
        // with nothing rendered is a decode failure.
        const connected = pc.connectionState === 'connected' || this.webrtcConnected;
        const decode = (bytes > 0 && decoded < 0) || (bytes < 0 && connected) || (!this.laddered && connected);
        this.webrtcFailed(decode ? 'WebRTC התחבר אך הדפדפן לא מפענח את הזרם' : 'WebRTC לא התחבר (ייתכן ש-UDP חסום)', decode);
        return;
      }
      rearm();
    };
    rearm();
  }

  /** re-review F2: play() once frames decode; a NotAllowedError (autoplay refused) shows "הקש להפעלה". */
  private nudgePlay(gen: number) {
    const v = this.video;
    if (!v) return;
    v.play().catch((err: unknown) => {
      if (gen === this.generation && (err as DOMException)?.name === 'NotAllowedError' && this.status !== 'playing') this.needsTap = true;
    });
  }

  private tapToPlay() {
    this.needsTap = false;
    const gen = this.generation;
    this.video?.play().catch((err: unknown) => {
      if (gen === this.generation && (err as DOMException)?.name === 'NotAllowedError' && this.status !== 'playing') this.needsTap = true;
    });
  }

  /** How long bytes may arrive without a decoded frame: the stream's GOP (the first decodable frame is the next key
   * frame) plus a margin; unknown GOP → DECODE_GRACE_MS. */
  private decodeGraceMs(): number {
    const gop = this.gopFor(this.effectiveProfile);
    return gop > 0 ? Math.min(DECODE_GRACE_MAX_MS, Math.max(DECODE_GRACE_MIN_MS, gop + 3000)) : DECODE_GRACE_MS;
  }

  private gopFor(profile: Profile): number {
    for (const part of this.gop.split(',')) {
      const [p, ms] = part.split(':');
      if (p === profile && Number(ms) > 0) return Number(ms);
    }
    return 0;
  }

  private webrtcFailed(reason: string, decode = false) {
    if (this.status === 'playing' && this.transport === 'webrtc') {
      this.fail('החיבור נותק');
      return;
    }
    if (this.laddered) {
      this.nextStep(reason, decode);
      return;
    }
    if (this.lanChained) {
      this.chainNext(reason, decode);
      return;
    }
    if (this.mode === 'auto' && !this.triedWebrtc) {
      this.fail(reason);
      return;
    }
    if (this.mode === 'auto') {
      if (!decode) noteWebrtcUnreachable(); // never connected: a network fact this tab's next `auto` players act on
      // Fresh socket for MSE so go2rtc does not keep a dead WebRTC consumer on the old one.
      this.disconnect();
      this.connect(true);
    } else {
      this.fail(reason);
    }
  }

  // ---------- MSE ----------

  private startMse() {
    if (!('MediaSource' in window)) {
      this.fail('MSE לא נתמך בדפדפן');
      return;
    }
    window.clearTimeout(this.timer);
    this.transport = 'mse';
    this.queue = [];
    this.stale = false;
    this.sb = null;
    const ms = new MediaSource();
    this.ms = ms;
    this.video.srcObject = null;
    this.video.src = URL.createObjectURL(ms);
    const gen = this.generation;
    ms.addEventListener('sourceopen', () => {
      if (gen !== this.generation) return;
      const codecs = MSE_CODECS.filter((c) => MediaSource.isTypeSupported(`video/mp4; codecs="${c}"`)).join(',');
      this.send({ type: 'mse', value: codecs });
      if (this.pendingMime) this.openSourceBuffer(this.pendingMime);
    }, { once: true });
    this.timer = window.setTimeout(() => {
      if (this.status === 'playing') return;
      // VIDEO-SUB-FALLBACK-2402: no fragment in the bound = the stream gives no media (the automatic quality moves to main; an explicit
      // one says so in words - the technical trace goes to the console)
      this.failKind = 'sub_no_media';
      const live = !!this.cameraId && !this.wsUrl;
      if (live) console.warn('sw-live-player: no media', this.effectiveProfile, this.mseTrace());
      this.mseFailed(live ? NO_MEDIA_HE(this.effectiveProfile) : `לא התקבל וידאו (${this.mseTrace()})`);
    }, MSE_TIMEOUT_MS);
  }

  /** Short state summary for error messages / diagnostics. */
  private mseTrace(): string {
    const v = this.video;
    return `ms=${this.ms?.readyState ?? '-'} sb=${this.sb ? 'y' : 'n'} q=${this.queue.length} rs=${v?.readyState ?? '-'} buf=${v?.buffered.length ? v.buffered.end(v.buffered.length - 1).toFixed(1) : '-'}`;
  }

  private openSourceBuffer(mime: string) {
    if (!this.ms || this.ms.readyState !== 'open') {
      this.pendingMime = mime; // reply arrived before sourceopen: attach as soon as the MediaSource opens
      return;
    }
    this.pendingMime = '';
    try {
      const sb = this.ms.addSourceBuffer(mime);
      sb.mode = 'segments';
      sb.addEventListener('updateend', () => this.flush());
      this.sb = sb;
      void this.video.play().catch(() => undefined);
      this.flush();
    } catch {
      this.mseFailed('הדפדפן לא תומך ב־codec של המצלמה', true);
    }
  }

  private onSignal(text: string) {
    let msg: { type?: string; value?: string; max?: number; message?: string; media?: string };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    // VIDEO-TRANSPORT-2400 (lab audit finding 8): a stream error is never silent - its code reaches the console here and the
    // `player-status` event below; the server logs go2rtc's own text (sanitized) with the session
    if (msg.type === 'error') console.warn('sw-live-player: stream error', msg.value ?? '', this.transport || '-', this.status);
    // HEALTH-GO2RTC-2430: the relay says the video service itself is down (routers/media.refuse_media) - no transport step can help
    if (frameSaysDown(msg)) {
      this.videoServiceDown();
      return;
    }
    // VIDEO-SUB-FALLBACK-2402: go2rtc refused this stream (not the cap, not a denial, not the video server being down)
    if (msg.type === 'error' && !['remote_live_cap', 'access_lost', 'upstream_unavailable', 'h265_unsupported', 'transcode_cap'].includes(msg.value ?? '')) this.failKind = 'sub_error';
    if (msg.type === 'error' && msg.value === 'remote_live_cap') {
      this.capRefused(msg.max);
      return;
    }
    if (msg.type === 'arx/stream') {
      this.served = parseServed(msg.value); // LIVE-H265-2341: the stream the server chose for this socket
      return;
    }
    if (msg.type === 'error' && (msg.value === 'h265_unsupported' || msg.value === 'transcode_cap')) {
      this.h265Refused(msg.value, msg.max, msg.message);
      return;
    }
    switch (msg.type) {
      case 'webrtc/answer':
        void this.pc?.setRemoteDescription({ type: 'answer', sdp: msg.value ?? '' }).catch(() => this.webrtcFailed('WebRTC: תשובה לא תקינה'));
        break;
      case 'webrtc/candidate':
        void this.pc?.addIceCandidate({ candidate: msg.value ?? '', sdpMid: '0' }).catch(() => undefined);
        break;
      case 'mse':
        this.openSourceBuffer(msg.value ?? 'video/mp4; codecs="avc1.640029"');
        break;
      case 'error':
        if (this.laddered && msg.value === 'upstream_unavailable') this.fail(VIDEO_SERVER_DOWN); // no step can help; retried later
        else if (this.laddered && this.transport === 'webrtc' && msg.value !== 'access_lost') this.webrtcFailed('WebRTC נכשל'); // never a raw code on screen
        else if (!this.laddered && this.transport === 'webrtc' && this.mode === 'auto') this.webrtcFailed(msg.value ?? 'WebRTC', msg.value !== 'upstream_unavailable' && msg.value !== 'access_lost');
        // a LAN chain with a step left: go2rtc refused this stream (e.g. no common codec) - the next step, never a loop
        else if (this.hasChainStep() && this.status !== 'playing' && msg.value !== 'upstream_unavailable' && msg.value !== 'access_lost') {
          if (this.transport === 'webrtc') this.webrtcFailed(`שגיאת זרם: ${msg.value ?? ''}`, true);
          else this.mseFailed(`שגיאת זרם: ${msg.value ?? ''}`, true);
        }
        else if (this.laddered && msg.value !== 'access_lost' && this.status !== 'playing' && this.trySubFallback()) break; // VIDEO-SUB-FALLBACK-2402
        else if (this.laddered && msg.value !== 'access_lost') this.fail(`שגיאה בזרם הווידאו`, true, msg.value ?? undefined);
        else if (this.lanChained && msg.value !== 'access_lost' && msg.value !== 'upstream_unavailable' && this.status !== 'playing' && this.trySubFallback()) break;
        else this.fail(msg.value === 'upstream_unavailable' ? VIDEO_SERVER_DOWN : msg.value === 'access_lost' ? 'ההרשאה לצפייה במצלמה הזו הוסרה' : `שגיאת זרם: ${msg.value ?? ''}`, msg.value !== 'access_lost', msg.value ?? undefined);
        break;
      default:
        break;
    }
  }

  private onFragment(buf: ArrayBuffer) {
    if (this.recorded && this.bufferAhead > MAX_AHEAD_S) {
      this.stale = true; // paused or slowed for long: keep memory bounded, the screen re-seeks when it needs more
      return;
    }
    this.queue.push(buf);
    this.flush();
  }

  /** Drop buffered media older than `keepSeconds` behind the playhead. Returns true when a removal was started. */
  private evict(keepSeconds: number): boolean {
    const sb = this.sb;
    const v = this.video;
    if (!sb || sb.updating || !v.buffered.length) return false;
    const start = v.buffered.start(0);
    const end = Math.max(start, v.currentTime - keepSeconds);
    if (end - start < 1) return false;
    try {
      sb.remove(start, end);
      return true;
    } catch {
      return false;
    }
  }

  private flush() {
    const sb = this.sb;
    if (!sb || sb.updating || !this.ms || this.ms.readyState !== 'open') return;
    const v = this.video;
    // Data that starts after the playhead (first fragment with a non-zero base time, or a trimmed buffer)
    // would never play: move the playhead to the start of what is buffered.
    if (v.buffered.length && v.readyState < 3 && v.currentTime < v.buffered.start(0)) v.currentTime = v.buffered.start(0);
    // Small, bounded buffer: embedded/low-memory browsers give a SourceBuffer only ~12 MB.
    if (v.buffered.length && v.currentTime - v.buffered.start(0) > 12 && this.evict(6)) return;
    const next = this.queue.shift();
    if (!next) return;
    try {
      sb.appendBuffer(next);
    } catch (err) {
      const name = (err as DOMException)?.name ?? 'Error';
      if (name === 'QuotaExceededError') {
        // Free everything but the last couple of seconds and retry this fragment on updateend.
        this.queue.unshift(next);
        if (!this.evict(2)) this.queue.shift();
        return;
      }
      console.warn('sw-live-player: appendBuffer failed', name, (err as Error)?.message);
      this.fail(`שגיאת buffer (${name})`);
    }
  }

  private onTimeUpdate() {
    const v = this.video;
    if (this.transport !== 'mse' || !v.buffered.length || this.recorded) return; // live only: recorded playback may lag on purpose
    const end = v.buffered.end(v.buffered.length - 1);
    if (end - v.currentTime > 2.5) v.currentTime = end - 0.5;
  }

  private onPlaying() {
    this.endStill();
    window.clearTimeout(this.timer);
    this.stopFirstFrameWatch?.();
    this.needsTap = false;
    this.attempts = 0;
    this.status = 'playing';
    // VIDEO-TRANSPORT-2400: the step an automatic retry starts from, and the frozen-MSE watch of a live stream
    this.lastGood = this.currentStep ?? this.lanStep ?? null;
    if (this.transport === 'mse' && !this.wsUrl && !this.recorded) this.startFreezeWatch();
    else this.stopFreezeWatch();
    if (this.lanChained) {
      // remember the step that plays when it is not the chain's own first (and forget the camera when that one plays);
      // MSE reached because WebRTC could not CONNECT (or was remembered as unreachable) is a fact about the network, not
      // about this camera: the per-tab memory carries it, the per-camera one is cleared
      const step = this.chain[this.chainIndex];
      const first = lanLadder(this.profile, this.mode, this.autoProfile)[0];
      const network = this.chainWebrtcDown || this.chainConnectFailed;
      rememberStep(this.cameraId, this.profile, this.mode, step && !network && !sameStep(step, first) ? step : null);
      if (step?.transport === 'webrtc' && this.mode === 'auto') noteWebrtcUnreachable(false); // WebRTC works again: forget
    }
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'playing', transport: this.transport, profile: this.served?.profile ?? this.effectiveProfile, ...(this.served && this.served.kind !== 'native' ? { fallback: this.served.kind } : {}) }, bubbles: true, composed: true }));
  }

  /** VIDEO-TRANSPORT-2400 (lab audit finding 5): watches a playing live MSE stream; `freezeStep` judges every FREEZE_POLL_MS. */
  private startFreezeWatch() {
    this.stopFreezeWatch();
    const gen = this.generation;
    const tick = () => {
      if (gen !== this.generation || this.status !== 'playing' || this.transport !== 'mse') return;
      const v = this.video;
      const end = v && v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
      const r = freezeStep(this.freezeMark, { t: v?.currentTime ?? 0, end, now: performance.now(), paused: !!v?.paused, hidden: document.hidden });
      this.freezeMark = r.mark;
      if (r.frozen) {
        this.mseFrozen();
        return;
      }
      this.freezeTimer = window.setTimeout(tick, FREEZE_POLL_MS);
    };
    this.freezeTimer = window.setTimeout(tick, FREEZE_POLL_MS);
  }

  private stopFreezeWatch() {
    window.clearTimeout(this.freezeTimer);
    this.freezeTimer = undefined;
    this.freezeMark = null;
  }

  /** A live MSE stream froze: reconnect the same step (any choice); `auto` only moves on to WebRTC after repeated freezes. */
  private mseFrozen() {
    this.stopFreezeWatch();
    this.freezes += 1;
    if (this.freezes >= FREEZE_FALLBACK_AFTER && this.mode === 'auto') {
      const ladder = this.laddered ? this.steps() : this.lanChained ? this.chain : [];
      const alt = freezeFallback(ladder, this.currentStep ?? this.lanStep, this.mode);
      if (alt) {
        this.lastGood = alt;
        this.freezes = 0;
      } else if (!ladder.length) {
        this.lastPreferMse = false; // a chain-less `auto` source (a station, a Home Assistant camera): WebRTC first on the retry
        this.freezes = 0;
      }
    }
    console.warn('sw-live-player: live MSE stream frozen', this.freezes);
    this.fail(FROZEN_HE, true, 'frozen');
  }

  /** CR-008 D7: the announcement when the plan fell back (another profile, or MSE through the tunnel). */
  private fallbackNotice(step: VideoStep): string {
    const pref = (this.preferred || this.decodeLadderFirst() || step.profile) as Profile;
    if (step.profile !== pref) return `${undecodableMessage(pref)} · מוצג הזרם ${step.profile === 'sub' ? 'המשני' : 'הראשי'}`;
    if (step.transport === 'mse') return 'WebRTC לא זמין לזרם הזה · הווידאו עובר ב־MSE דרך המנהרה (מוצא אחרון)';
    return '';
  }

  private renderPlan() {
    const step = this.status === 'error' ? null : this.currentStep;
    if (!step) return nothing;
    const notice = this.fallbackNotice(step);
    const playing = this.status === 'playing';
    // review nit: the badge claims what PLAYS only while it plays; before that it says what is being tried
    return html`<span class="vbadge ${step.transport} ${playing ? '' : 'trying'}" data-video-badge data-step=${badgeLabel(step)} data-state=${playing ? 'playing' : 'trying'} title=${notice || badgeLabel(step)}>${playing ? badgeLabel(step) : `מנסה ${badgeLabel(step)}…`}</span>
      ${notice && this.showNotices ? html`<div class="vnotice" data-video-notice role="status">${notice}</div>` : nothing}`;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.video.muted = this.muted;
  }

  fullscreen() {
    void (this.video.requestFullscreen?.() ?? Promise.resolve());
  }

  render() {
    const showPoster = this.status !== 'playing';
    return html`
      ${this.poster && showPoster ? html`<img class="poster" src=${this.posterSrc()} alt="" />` : nothing}
      <video class=${showPoster ? 'hidden' : ''} autoplay playsinline muted @playing=${this.onPlaying} @timeupdate=${this.onTimeUpdate}></video>
      ${this.stillNotice && this.status !== 'playing'
        ? html`<div class="stillnote" data-h265-still role="status"><sw-icon name="camera" size=${12}></sw-icon><span data-player-error>${this.stillNotice}</span></div>`
        : this.status === 'connecting' ? html`<div class="center"><div><span class="spin"></span><span>מתחבר${this.transport ? ` · ${this.transport === 'webrtc' ? 'WebRTC' : 'MSE'}` : ''}…</span></div></div>` : nothing}
      ${this.stillNotice ? nothing : this.status === 'error' && this.capped
        ? html`<div class="center" data-live-cap><div><sw-icon name="lock" size=${this.compact ? 16 : 22}></sw-icon><span data-player-error>${this.error}</span><span class="hint" data-live-cap-hint>${can('system.configure') ? LIVE_CAP_HINT_ADMIN : LIVE_CAP_HINT_OTHER}</span></div></div>`
        : this.status === 'error'
          ? html`<div class="center"><div><sw-icon name="offline" size=${22}></sw-icon><span data-player-error>${this.error}</span>${this.serviceDown && !this.compact ? html`<span class="hint" data-video-service-hint>${can('system.configure') ? VIDEO_SERVICE_HINT_ADMIN : VIDEO_SERVICE_HINT_OTHER}</span>` : nothing}${this.offerRetry && !this.compact ? html`<button class="again" data-player-retry @click=${this.retryNow}>נסה שוב</button>` : nothing}</div></div>`
          : nothing}
      ${this.status === 'ended' ? html`<div class="center"><div><sw-icon name="history" size=${22}></sw-icon><span>הקטע הסתיים</span></div></div>` : nothing}
      ${this.status === 'idle' && !this.poster ? html`<div class="center"><div><sw-icon name="camera" size=${22}></sw-icon><span>לא מחובר</span></div></div>` : nothing}
      <span class="status ${this.status}"><i></i><span class="t">${this.status === 'playing' ? `${this.wsUrl ? 'הקלטה' : 'חי'} · ${this.transport === 'webrtc' ? 'WebRTC' : 'MSE'}` : this.status === 'connecting' ? 'מתחבר' : this.status === 'error' ? (this.capped ? 'מכסה' : 'לא זמין') : this.status === 'ended' ? 'הסתיים' : 'תמונה'}</span></span>
      ${this.laddered ? this.renderPlan() : nothing}
      ${this.renderServed()}
      ${this.subFellBack && this.status !== 'error'
        ? html`<span class="subtag" data-sub-fallback=${this.fallbackWhy || 'sub_error'} title=${SUB_FALLBACK_HE} @pointerdown=${this.onChipDown} @pointermove=${this.onChipMove}
              @pointerup=${this.onChipUp} @pointercancel=${this.onChipUp} @pointerleave=${this.onChipUp} @click=${this.onChipClick} @contextmenu=${this.onChipMenu}
              ><sw-icon class="subico" name="arrowUp" size=${12} aria-hidden="true"></sw-icon><span class="subtxt">${SUB_FALLBACK_HE}</span></span
            >${this.subHint && this.subChip ? html`<span class="subhint" role="status" data-sub-fallback-hint>${SUB_FALLBACK_HE}</span>` : nothing}`
        : nothing}
      ${this.needsTap && this.status !== 'playing' ? html`<button class="tap" data-tap-to-play @click=${this.tapToPlay}><sw-icon name="live" size=${18}></sw-icon>הקש להפעלה</button>` : nothing}
      ${this.status === 'playing' ? html`<button class="mute" title=${this.muted ? 'הפעל שמע' : 'השתק'} aria-label=${this.muted ? 'הפעל שמע' : 'השתק'} @click=${this.toggleMute}><sw-icon name=${this.muted ? 'volume' : 'mic'} size=${13}></sw-icon></button>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-live-player': SwLivePlayer;
  }
}
