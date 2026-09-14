import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import './sw-icon';
import { liveWsUrl, type Transport } from '../api/media';

/**
 * Live player over the add-on's WebSocket relay (go2rtc signalling behind it).
 *  - WebRTC: offer/answer + trickle candidates through the socket; media flows browser ↔ go2rtc.
 *  - MSE: fMP4 fragments over the socket, appended to a SourceBuffer, kept near the live edge.
 * `mode` = auto (WebRTC first, MSE on failure) | webrtc | mse. Shows the poster (snapshot) until the
 * first frame plays and never pretends to be live when it is not.
 */
export type PlayerStatus = 'idle' | 'connecting' | 'playing' | 'ended' | 'error';

const MSE_CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus'];
/** ICE + first key frame: cameras with a 2–4 s GOP need well over 7 s before the first frame renders. */
const WEBRTC_TIMEOUT_MS = 12000;
/** go2rtc starts the fMP4 stream at the next key frame; the lab NVR's GOP is ~8 s. */
const MSE_TIMEOUT_MS = 20000;
/** Automatic reconnect after a transient failure (not after 4401/4403/4429): 3 s, 6 s, 12 s … max 30 s. */
const RETRY_BASE_MS = 3000;
const RETRY_MAX_MS = 30000;

@customElement('sw-live-player')
export class SwLivePlayer extends LitElement {
  @property() cameraId = '';
  @property() profile: 'sub' | 'main' = 'sub';
  @property() mode: Transport = 'auto';
  @property() poster = '';
  @property({ type: Boolean }) active = true;
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Playback: relay socket of a session generation instead of the live endpoint (MSE only). */
  @property() wsUrl = '';
  /** Playback streams end when the NVR reaches the requested end time: no automatic reconnect then. */
  @property({ type: Boolean }) retry = true;
  @state() status: PlayerStatus = 'idle';
  @state() transport: 'webrtc' | 'mse' | '' = '';
  @state() error = '';
  @state() muted = true;

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
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnect();
  }

  /** The first render (properties set) and every later change of camera/profile/mode/active (re)connects. */
  protected updated(changed: Map<string, unknown>) {
    if (changed.has('active') || changed.has('cameraId') || changed.has('profile') || changed.has('mode') || changed.has('wsUrl')) {
      if (!this.active || (!this.cameraId && !this.wsUrl)) this.disconnect();
      else this.reconnect();
    }
  }

  /** Playback helpers: the media element's own clock (seconds since this generation started). */
  get mediaTime(): number {
    return this.video?.currentTime ?? 0;
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
    this.connect();
  }

  /** Public: open the stream. `preferMse` is set internally after a WebRTC failure in auto mode. */
  connect(preferMse = false) {
    if ((!this.cameraId && !this.wsUrl) || !this.active) return;
    this.teardown(); // never leave an earlier socket open: the relay counts every socket as a session
    const gen = (this.generation += 1);
    this.status = 'connecting';
    this.error = '';
    this.transport = '';
    this.triedWebrtc = preferMse;
    this.lastPreferMse = preferMse;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.wsUrl || liveWsUrl(this.cameraId, this.profile));
    } catch (err) {
      this.fail('לא ניתן לפתוח חיבור');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      if (gen !== this.generation) return;
      if (this.wsUrl || this.mode === 'mse' || (this.mode === 'auto' && preferMse)) this.startMse();
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
      // go2rtc drops the socket when its WebRTC consumer dies: in auto mode that is a transport failure, not the end.
      if (this.mode === 'auto' && this.transport === 'webrtc' && this.status !== 'playing' && ev.code < 4000) {
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
      const reason = ev.code === 4403 ? 'אין הרשאת צפייה' : ev.code === 4429 ? 'הגיע למכסת הזרמים' : ev.code === 4503 ? 'go2rtc לא זמין' : ev.code === 4401 ? 'נדרשת הזדהות' : ev.code === 4404 ? 'סשן הניגון פג' : ev.code === 4410 ? 'הסשן הוחלף' : this.status === 'playing' ? 'החיבור נותק' : 'החיבור נסגר';
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

  private fail(message: string, retryable = true) {
    this.teardown(); // release the relay session and the upstream stream right away
    this.status = 'error';
    this.error = message;
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'error', error: message }, bubbles: true, composed: true }));
    if (retryable && this.retry && this.active && (this.cameraId || this.wsUrl)) {
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(this.attempts, 6));
      this.attempts += 1;
      this.retryTimer = window.setTimeout(() => this.connect(this.lastPreferMse), delay);
    }
  }

  // ---------- WebRTC ----------

  private async startWebrtc() {
    this.triedWebrtc = true;
    this.transport = 'webrtc';
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
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') this.webrtcFailed('WebRTC נכשל');
    };
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.send({ type: 'webrtc/offer', value: offer.sdp });
    } catch {
      this.webrtcFailed('WebRTC לא נתמך בדפדפן');
      return;
    }
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (this.status === 'playing') return;
      // Connected but nothing rendered: the browser cannot decode this stream over RTP (e.g. H.264 Main/High
      // 2560×1440 from the NVR main profile) — MSE plays the same stream. Not connected: UDP is blocked.
      const connected = this.pc?.connectionState === 'connected';
      this.webrtcFailed(connected ? 'WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה — בחר MSE או אוטומטי' : 'WebRTC לא התחבר (UDP חסום?)');
    }, WEBRTC_TIMEOUT_MS);
  }

  private webrtcFailed(reason: string) {
    if (this.status === 'playing' && this.transport === 'webrtc') {
      this.fail('החיבור נותק');
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
    let msg: { type?: string; value?: string };
    try {
      msg = JSON.parse(text);
    } catch {
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
        if (this.transport === 'webrtc' && this.mode === 'auto') this.webrtcFailed(msg.value ?? 'WebRTC');
        else this.fail(msg.value === 'upstream_unavailable' ? 'go2rtc לא זמין' : `שגיאת זרם: ${msg.value ?? ''}`);
        break;
      default:
        break;
    }
  }

  private onFragment(buf: ArrayBuffer) {
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
    if (this.transport !== 'mse' || !v.buffered.length) return;
    const end = v.buffered.end(v.buffered.length - 1);
    if (end - v.currentTime > 2.5) v.currentTime = end - 0.5;
  }

  private onPlaying() {
    window.clearTimeout(this.timer);
    this.attempts = 0;
    this.status = 'playing';
    this.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'playing', transport: this.transport }, bubbles: true, composed: true }));
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
      ${this.status === 'error' ? html`<div class="center"><div><sw-icon name="offline" size=${22}></sw-icon><span>${this.error}</span></div></div>` : nothing}
      ${this.status === 'ended' ? html`<div class="center"><div><sw-icon name="history" size=${22}></sw-icon><span>הקטע הסתיים</span></div></div>` : nothing}
      ${this.status === 'idle' && !this.poster ? html`<div class="center"><div><sw-icon name="camera" size=${22}></sw-icon><span>לא מחובר</span></div></div>` : nothing}
      <span class="status ${this.status}"><i></i><span class="t">${this.status === 'playing' ? `${this.wsUrl ? 'הקלטה' : 'חי'} · ${this.transport === 'webrtc' ? 'WebRTC' : 'MSE'}` : this.status === 'connecting' ? 'מתחבר' : this.status === 'error' ? 'לא זמין' : this.status === 'ended' ? 'הסתיים' : 'תמונה'}</span></span>
      ${this.status === 'playing' ? html`<button class="mute" title=${this.muted ? 'הפעל שמע' : 'השתק'} aria-label=${this.muted ? 'הפעל שמע' : 'השתק'} @click=${this.toggleMute}><sw-icon name=${this.muted ? 'volume' : 'mic'} size=${13}></sw-icon></button>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-live-player': SwLivePlayer;
  }
}
