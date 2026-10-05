/**
 * The fake browser media stack of the live-player specs (no backend, no go2rtc): installed with `page.addInitScript`.
 *  - a live relay socket (`/media/live/<camera>/ws?profile=`) that records what the player asked for (`webrtc/offer` or
 *    `mse`) in `window.__liveSockets` (with the time each was opened and negotiated, performance.now());
 *  - an RTCPeerConnection whose outcome per profile is set by the test through `window.__rtc`:
 *      ok        connects and delivers a canvas stream (a real <video> "playing" event)
 *      fail      never connects (ICE `failed` after 60 ms - what Chrome reports once its own ICE timeout passes)
 *      hang      never changes state and never delivers a byte (UDP to go2rtc blocked: the Ingress / Cloudflare path
 *                before the browser's own ICE timeout) - the player's connect bound must decide
 *      nodecode  connects, bytes arrive, no frame ever decodes
 * Shared by evidence-webrtc-only.spec.ts (owner bug 2026-10-01) and evidence-webrtc-first.spec.ts (owner decision 2026-10-05).
 * What it does not prove: real go2rtc media.
 */
export type RtcMode = 'ok' | 'fail' | 'hang' | 'nodecode';

export interface LiveSocketEntry {
  profile: string;
  camera: string;
  kind: string;
  /** performance.now() when the socket was opened */
  at: number;
  /** performance.now() when the player sent its offer / MSE request (0 until then) */
  negotiatedAt: number;
}

export const FAKE_MEDIA = () => {
  const w = window as unknown as Record<string, unknown>;
  w.__liveSockets = [] as { profile: string; camera: string; kind: string; at: number; negotiatedAt: number }[];
  const modeOf = (profile: string) => ((w.__rtc as Record<string, string>) ?? {})[profile] ?? 'ok';
  const RealWS = window.WebSocket;
  class FakeLive {
    url: string;
    readyState = 0;
    binaryType = 'blob';
    entry: { profile: string; camera: string; kind: string; at: number; negotiatedAt: number };
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      const u = new URL(url);
      const profile = u.searchParams.get('profile') || 'sub';
      this.entry = { profile, camera: (/\/media\/live\/([^/]+)\/ws/.exec(u.pathname) ?? [])[1] ?? '', kind: '', at: performance.now(), negotiatedAt: 0 };
      (w.__liveSockets as unknown[]).push(this.entry);
      w.__lastProfile = profile;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }, 20);
    }
    private reply(body: unknown) {
      setTimeout(() => this.readyState === 1 && this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(body) })), 20);
    }
    send(data: string) {
      const msg = JSON.parse(data) as { type: string };
      if (msg.type === 'webrtc/offer') {
        this.entry.kind = 'webrtc';
        this.entry.negotiatedAt = performance.now();
        this.reply({ type: 'webrtc/answer', value: 'v=0 fake-answer' });
      } else if (msg.type === 'mse') {
        this.entry.kind = 'mse';
        this.entry.negotiatedAt = performance.now();
        this.reply({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' });
      }
    }
    close() {
      this.readyState = 3;
    }
  }
  const Patched = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    const u = String(url);
    if (u.includes('/media/live/')) return new FakeLive(u);
    return new RealWS(u, protocols);
  } as unknown as typeof WebSocket;
  Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3, prototype: RealWS.prototype });
  window.WebSocket = Patched;

  class FakePC {
    connectionState = 'new';
    ontrack: ((e: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
    onicecandidate: ((e: { candidate: null }) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    private timers: number[] = [];
    private bytes = 0;
    private frames = 0;
    private mode = modeOf(String(w.__lastProfile));
    addTransceiver() {}
    async createOffer() {
      return { type: 'offer', sdp: 'v=0 fake-offer' };
    }
    async setLocalDescription() {}
    async addIceCandidate() {}
    async getStats() {
      return new Map([['v', { type: 'inbound-rtp', kind: 'video', bytesReceived: this.bytes, framesDecoded: this.frames }]]);
    }
    private later(ms: number, fn: () => void) {
      this.timers.push(window.setTimeout(() => this.connectionState !== 'closed' && fn(), ms));
    }
    private state(s: string) {
      this.connectionState = s;
      this.onconnectionstatechange?.();
    }
    private play() {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 180;
      const ctx = c.getContext('2d')!;
      let n = 0;
      this.timers.push(window.setInterval(() => {
        ctx.fillStyle = n++ % 2 ? '#1d4ed8' : '#16a34a';
        ctx.fillRect(0, 0, 320, 180);
        this.bytes += 4000;
        this.frames += 1;
      }, 100));
      const stream = c.captureStream(10);
      this.ontrack?.({ streams: [stream], track: stream.getVideoTracks()[0] });
    }
    async setRemoteDescription() {
      if (this.mode === 'hang') return; // nothing ever happens: no state change, no byte
      if (this.mode === 'fail') return this.later(60, () => this.state('failed'));
      this.later(60, () => this.state('connected'));
      if (this.mode === 'ok') return this.later(80, () => this.play());
      if (this.mode === 'nodecode') return this.timers.push(window.setInterval(() => (this.bytes += 4000), 100));
    }
    close() {
      this.timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      this.connectionState = 'closed';
    }
  }
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakePC;
};
