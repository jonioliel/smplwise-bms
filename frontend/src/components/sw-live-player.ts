import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import './sw-icon';
import { liveWsUrl, relayWsUrl, type Transport } from '../api/media';
import { can } from '../api/session';
import { badgeLabel, decodeLadder, undecodableMessage, type Profile, type VideoStep } from '../api/video-policy';

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
 * for (the one the viewer asked for).
 */
export type PlayerStatus = 'idle' | 'connecting' | 'playing' | 'ended' | 'error';

const MSE_CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus'];
/** ICE + first key frame: cameras with a 2–4 s GOP need well over 7 s before the first frame renders. */
const WEBRTC_TIMEOUT_MS = 12000;
/** CR-008 review M2 (a WebRTC step under a remote plan): the first-frame watch polls the RTP statistics this often,
 * waits at most FIRST_FRAME_CAP_MS for media to arrive at all, and calls a stream undecodable when bytes arrive but no
 * frame decodes for DECODE_GRACE_MS (or the stream's GOP + 3 s, bounded, when the registry knows the GOP). */
const STATS_POLL_MS = 1000;
const FIRST_FRAME_CAP_MS = 30000;
const DECODE_GRACE_MS = 10000;
const DECODE_GRACE_MIN_MS = 6000;
const DECODE_GRACE_MAX_MS = 20000;
/** The relay's go2rtc is down (error `upstream_unavailable`, close 4503): no step of a plan can help. */
const VIDEO_SERVER_DOWN = 'שרת הווידאו אינו זמין';
/** go2rtc starts the fMP4 stream at the next key frame; the lab NVR's GOP is ~8 s. */
const MSE_TIMEOUT_MS = 20000;
/** Automatic reconnect after a transient failure (not after 4401/4403/4429): 3 s, 6 s, 12 s … max 30 s. */
const RETRY_BASE_MS = 3000;
const RETRY_MAX_MS = 30000;

/** The remote live cap (`remote_live_cap`, WebSocket close 4429): what the tile says, and who may raise it. Never a retry. */
export const liveCapTitle = (max: number) => `הגעת למכסת הזרמים החיים בחיבור הזה${max > 0 ? ` (${max})` : ''}`;
export const LIVE_CAP_HINT_ADMIN = 'אפשר להגדיל בהגדרות › מערכת › גישה מרחוק';
export const LIVE_CAP_HINT_OTHER = 'פנה למנהל המערכת';

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
      background: #0f1729;
      overflow: hidden;
    }
    video,
    img.poster {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      background: #0f1729;
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
      font-size: 10.5px;
      font-weight: 600;
      color: #fff;
      background: rgba(17, 24, 39, 0.6);
      border-radius: 999px;
      padding: 2px 8px;
      backdrop-filter: blur(6px);
    }
    .status i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: #f59e0b;
    }
    .status.playing i {
      background: #22c55e;
    }
    .status.error i {
      background: #ef4444;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.85);
      font-size: 11.5px;
      text-align: center;
      padding: 12px;
      background: rgba(15, 23, 41, 0.35);
    }
    .center div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    .center .hint {
      font-size: 10.5px;
      opacity: 0.75;
    }
    .spin {
      inline-size: 22px;
      block-size: 22px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
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
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      display: grid;
      place-items: center;
      cursor: pointer;
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
      font-size: 10.5px;
      font-weight: 600;
      color: #fff;
      background: rgba(17, 24, 39, 0.6);
      border-radius: 999px;
      padding: 2px 8px;
      backdrop-filter: blur(6px);
    }
    .vbadge.mse {
      background: rgba(180, 83, 9, 0.85);
    }
    .vbadge.trying {
      background: rgba(17, 24, 39, 0.45);
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
      background: rgba(17, 24, 39, 0.8);
      color: #fff;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .vnotice {
      position: absolute;
      inset-inline: 8px;
      inset-block-start: 34px;
      font-size: 11px;
      line-height: 1.4;
      color: #fff;
      background: rgba(17, 24, 39, 0.72);
      border-radius: 8px;
      padding: 4px 8px;
      text-align: start;
    }
    :host([compact]) .vnotice {
      display: none;
    }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnect();
  }

  /** The first render (properties set) and every later change of camera/profile/mode/active (re)connects. */
  protected updated(changed: Map<string, unknown>) {
    if (changed.has('active') || changed.has('cameraId') || changed.has('livePath') || changed.has('profile') || changed.has('mode') || changed.has('wsUrl') || changed.has('plan') || changed.has('preferred')) {
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
    this.connect();
  }

  /** CR-008 D7: a remote plan is in force (live video only; recorded playback keeps its own MSE socket). */
  get laddered(): boolean {
    return !!this.plan && !this.wsUrl;
  }

  private steps(): VideoStep[] {
    return this.laddered ? decodeLadder(this.plan) : [];
  }

  /** The step being played or tried (null outside a plan, or when the plan has none left). */
  get currentStep(): VideoStep | null {
    return this.steps()[this.step] ?? null;
  }

  /** The profile the socket opens: the current step's under a plan, else the `profile` property. */
  get effectiveProfile(): Profile {
    return this.currentStep?.profile ?? this.profile;
  }

  /** Public: open the stream. `preferMse` is set internally after a WebRTC failure in auto mode. */
  connect(preferMse = false) {
    if ((!this.cameraId && !this.wsUrl && !this.livePath) || !this.active) return;
    if (this.laddered && !this.currentStep) {
      this.planExhausted();
      return;
    }
    this.teardown(); // never leave an earlier socket open: the relay counts every socket as a session
    const gen = (this.generation += 1);
    this.status = 'connecting';
    this.error = '';
    this.capped = false;
    this.transport = '';
    this.triedWebrtc = preferMse;
    this.lastPreferMse = preferMse;
    const step = this.currentStep;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.wsUrl || (this.livePath && !this.cameraId ? relayWsUrl(this.livePath) : liveWsUrl(this.cameraId, this.effectiveProfile)));
    } catch (err) {
      this.fail('לא ניתן לפתוח חיבור');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      if (gen !== this.generation) return;
      if (step) {
        if (step.transport === 'mse') this.startMse();
        else this.startWebrtc();
      } else if (this.wsUrl || this.mode === 'mse' || (this.mode === 'auto' && preferMse)) this.startMse();
      else this.startWebrtc();
    };
    ws.onmessage = (ev) => {
      if (gen !== this.generation) return;
      if (typeof ev.data === 'string') this.onSignal(ev.data);
      else this.onFragment(ev.data as ArrayBuffer);
    };
    ws.onerror = () => {
      /* `close` always follows and carries the code; deciding there keeps the auto fallback in one place */
    };
    ws.onclose = (ev) => {
      if (gen !== this.generation) return;
      if (this.status === 'error') return;
      if (ev.code === 4429 && this.laddered) {
        this.capRefused(); // the close without its message (a proxy dropped it): still a cap, still no ladder and no retry
        return;
      }
      // go2rtc drops the socket when its WebRTC consumer dies: in auto mode that is a transport failure, not the end.
      if ((this.mode === 'auto' || this.laddered) && this.transport === 'webrtc' && this.status !== 'playing' && ev.code < 4000) {
        this.webrtcFailed('WebRTC נכשל');
        return;
      }
      if (!this.retry && this.status === 'playing' && ev.code < 4000) {
        // Playback reached the end of the requested range (or the session was superseded): show it as such.
        this.teardown();
        this.status = 'ended';
        this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'ended' }, bubbles: true, composed: true }));
        return;
      }
      const reason = ev.code === 4403 ? 'אין הרשאת צפייה' : ev.code === 4429 ? 'הגיע למכסת הזרמים' : ev.code === 4503 ? (this.laddered ? VIDEO_SERVER_DOWN : 'go2rtc לא זמין') : ev.code === 4401 ? 'נדרשת הזדהות' : ev.code === 4404 ? 'סשן הניגון פג' : ev.code === 4410 ? 'הסשן הוחלף' : this.status === 'playing' ? 'החיבור נותק' : 'החיבור נסגר';
      this.fail(reason, this.retry && ev.code !== 4401 && ev.code !== 4403 && ev.code !== 4404 && ev.code !== 4410); // a quota hit retries later; a denial does not
    };
  }

  disconnect() {
    this.teardown();
    window.clearTimeout(this.retryTimer);
    this.attempts = 0;
    this.status = 'idle';
    this.transport = '';
  }

  /** Close socket, peer connection and media source without touching the visible status. */
  private teardown() {
    this.generation += 1;
    window.clearTimeout(this.timer);
    window.clearTimeout(this.retryTimer);
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

  private fail(message: string, retryable = true) {
    this.teardown(); // release the relay session and the upstream stream right away
    this.status = 'error';
    this.error = message;
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'error', error: message }, bubbles: true, composed: true }));
    if (retryable && this.retry && this.active && (this.cameraId || this.wsUrl || this.livePath)) {
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(this.attempts, 6));
      this.attempts += 1;
      this.retryTimer = window.setTimeout(() => {
        if (this.laddered) {
          this.step = 0; // a plan starts over: WebRTC first again whenever the connection allows
          this.decodeFailed = false;
        }
        this.connect(this.lastPreferMse);
      }, delay);
    }
  }

  /** CR-008 D7: the current step failed before its first frame - the next step, or the end of the plan. */
  private nextStep(reason: string, decode = false) {
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
    const message = decode ? undecodableMessage(pref) : `${reason || 'WebRTC לא התחבר (ייתכן ש-UDP חסום)'} · MSE דרך המנהרה כבוי בהגדרות › גישה מרחוק`;
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
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
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
    if (this.laddered) {
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
      if (bytes > 0 && decoded === 0 && now - firstBytesAt >= this.decodeGraceMs()) {
        stop();
        this.webrtcFailed('WebRTC התחבר אך הדפדפן לא מפענח את הזרם', true);
        return;
      }
      if (now - started >= FIRST_FRAME_CAP_MS && !(bytes > 0 && decoded === 0)) {
        stop();
        // no counter and nothing rendered although bytes arrive (or no statistics while connected): the cap calls it
        // a decode failure; no bytes at all: a connection failure
        const decode = (bytes > 0 && decoded < 0) || (bytes < 0 && (pc.connectionState === 'connected' || this.webrtcConnected));
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
    if (this.mode === 'auto' && !this.triedWebrtc) {
      this.fail(reason);
      return;
    }
    if (this.mode === 'auto') {
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
      if (this.status !== 'playing') this.fail(`לא התקבל וידאו (${this.mseTrace()})`);
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
      this.fail('הדפדפן לא תומך ב־codec של המצלמה');
    }
  }

  private onSignal(text: string) {
    let msg: { type?: string; value?: string; max?: number };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.type === 'error' && msg.value === 'remote_live_cap') {
      this.capRefused(msg.max);
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
        else if (!this.laddered && this.transport === 'webrtc' && this.mode === 'auto') this.webrtcFailed(msg.value ?? 'WebRTC');
        else if (this.laddered && msg.value !== 'access_lost') this.fail(`שגיאה בזרם הווידאו`);
        else this.fail(msg.value === 'upstream_unavailable' ? 'go2rtc לא זמין' : msg.value === 'access_lost' ? 'ההרשאה לצפייה במצלמה הזו הוסרה' : `שגיאת זרם: ${msg.value ?? ''}`, msg.value !== 'access_lost');
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
    window.clearTimeout(this.timer);
    this.stopFirstFrameWatch?.();
    this.needsTap = false;
    this.attempts = 0;
    this.status = 'playing';
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'playing', transport: this.transport, profile: this.effectiveProfile }, bubbles: true, composed: true }));
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
      ${notice ? html`<div class="vnotice" data-video-notice role="status">${notice}</div>` : nothing}`;
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
      ${this.poster && showPoster ? html`<img class="poster" src=${this.poster} alt="" />` : nothing}
      <video class=${showPoster ? 'hidden' : ''} autoplay playsinline muted @playing=${this.onPlaying} @timeupdate=${this.onTimeUpdate}></video>
      ${this.status === 'connecting' ? html`<div class="center"><div><span class="spin"></span><span>מתחבר${this.transport ? ` · ${this.transport === 'webrtc' ? 'WebRTC' : 'MSE'}` : ''}…</span></div></div>` : nothing}
      ${this.status === 'error' && this.capped
        ? html`<div class="center" data-live-cap><div><sw-icon name="lock" size=${this.compact ? 16 : 22}></sw-icon><span data-player-error>${this.error}</span><span class="hint" data-live-cap-hint>${can('system.configure') ? LIVE_CAP_HINT_ADMIN : LIVE_CAP_HINT_OTHER}</span></div></div>`
        : this.status === 'error'
          ? html`<div class="center"><div><sw-icon name="offline" size=${22}></sw-icon><span data-player-error>${this.error}</span></div></div>`
          : nothing}
      ${this.status === 'ended' ? html`<div class="center"><div><sw-icon name="history" size=${22}></sw-icon><span>הקטע הסתיים</span></div></div>` : nothing}
      ${this.status === 'idle' && !this.poster ? html`<div class="center"><div><sw-icon name="camera" size=${22}></sw-icon><span>לא מחובר</span></div></div>` : nothing}
      <span class="status ${this.status}"><i></i><span class="t">${this.status === 'playing' ? `${this.wsUrl ? 'הקלטה' : 'חי'} · ${this.transport === 'webrtc' ? 'WebRTC' : 'MSE'}` : this.status === 'connecting' ? 'מתחבר' : this.status === 'error' ? (this.capped ? 'מכסה' : 'לא זמין') : this.status === 'ended' ? 'הסתיים' : 'תמונה'}</span></span>
      ${this.laddered ? this.renderPlan() : nothing}
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
