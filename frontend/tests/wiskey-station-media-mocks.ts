import type { Page, WebSocketRoute } from '@playwright/test';
import type { StationsMock } from './wiskey-stations-mocks';

// CR-036 slice S18: the mocked backend of a station's live video and talk, layered over the stations screen's mock
// (tests/wiskey-stations-mocks.ts; routes registered later win, anything else falls through to it). Invented answers only: no
// station, no intercom, no go2rtc. The live picture is a fake browser media stack (an init script: a WebSocket stand-in for the
// station's relay path and an RTCPeerConnection that plays a drawn canvas), the talk socket is answered by `page.routeWebSocket`
// (it records what the push-to-talk sent: control messages and frame sizes - never audio), and the microphone is a fake
// getUserMedia (a quiet oscillator) or a refusal, per test.

export type MicMode = 'ok' | 'denied' | 'none';

export interface StationMediaMock {
  mode: 'off' | 'video' | 'video_talk';
  /** Per station: `ready` (default), an `unavailable` reason, or `video` without talk. */
  station: Record<string, 'ready' | 'video_only' | 'main_only' | `unavailable:${string}`>;
  /** The caller holds video.live (false: the still, as before). */
  liveAllowed: boolean;
  /** The caller may talk (talk.available); false = `forbidden`. */
  talkAllowed: boolean;
  busy: boolean;
  /** A refusal for POST talk (status + code), or null. */
  startFail: { status: number; code: string } | null;
  mic: MicMode;
  // recorded
  mediaReads: string[];
  starts: { station: string; body: Record<string, unknown> }[];
  stops: string[];
  talkSockets: WebSocketRoute[];
  talkText: { type?: string; value?: string }[];
  frames: number[];
  /** Close the open talk socket from the "server" (an expiry, a lost permission ...). */
  serverEnd(outcome: string, code: number): void;
}

export const newMediaMock = (over: Partial<StationMediaMock> = {}): StationMediaMock => {
  const m: StationMediaMock = {
    mode: 'video_talk',
    station: {},
    liveAllowed: true,
    talkAllowed: true,
    busy: false,
    startFail: null,
    mic: 'ok',
    mediaReads: [],
    starts: [],
    stops: [],
    talkSockets: [],
    talkText: [],
    frames: [],
    serverEnd(outcome: string, code: number) {
      for (const ws of m.talkSockets) {
        ws.send(JSON.stringify({ type: 'talk/closed', value: outcome }));
        void ws.close({ code });
      }
    },
    ...over,
  };
  return m;
};

const PROFILES = {
  sub: { id: 'sub', codec: 'h264', transports: ['webrtc', 'mse'], width: 640, height: 360, fps: 15 },
  main: { id: 'main', codec: 'h264', transports: ['mse', 'webrtc'], width: 1920, height: 1080, fps: 25 },
};

function mediaBody(mm: StationMediaMock, id: string) {
  const base = { station_id: id, mode: mm.mode, state: 'off', reason: null, video: null, talk: null, listen: false, expires_at: null };
  if (mm.mode === 'off') return base;
  const how = mm.station[id] ?? 'ready';
  if (how.startsWith('unavailable:')) return { ...base, state: 'unavailable', reason: how.slice('unavailable:'.length) };
  const profiles = how === 'main_only' ? [PROFILES.main] : [PROFILES.sub, PROFILES.main];
  const paths = Object.fromEntries(profiles.map((p) => [p.id, `api/v1/access-control/stations/${id}/live/ws?profile=${p.id}`]));
  const talk =
    mm.mode !== 'video_talk'
      ? { available: false, reason: 'off' }
      : how === 'video_only' || how === 'main_only'
        ? { available: false, reason: 'unsupported' }
        : !mm.talkAllowed
          ? { available: false, reason: 'forbidden' }
          : { available: true, reason: null, transport: 'pcmu_frames', codec: 'pcmu', duplex: 'half', max_seconds: 120, sample_rate: 8000, frame_ms: 20, busy: mm.busy };
  return {
    ...base,
    state: 'ready',
    listen: true,
    expires_at: '2026-10-12T08:19:07Z',
    video: { profiles, default_profile: profiles[0].id, allowed: mm.liveAllowed, paths: mm.liveAllowed ? paths : {}, max_viewers: 2, viewers: 0 },
    talk,
  };
}

/** The fake browser media stack (runs in the page before any script): the station relay socket and a peer connection that plays a
 * drawn canvas; the microphone per `window.__mic` ('ok' | 'denied' | 'none'). */
export const STATION_MEDIA_FAKE = () => {
  const w = window as unknown as Record<string, unknown>;
  w.__liveSockets = [] as { url: string; kind: string }[];
  const RealWS = window.WebSocket;
  class FakeLive {
    url: string;
    readyState = 0;
    binaryType = 'blob';
    entry: { url: string; kind: string };
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      this.entry = { url, kind: '' };
      (w.__liveSockets as unknown[]).push(this.entry);
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }, 20);
    }
    send(data: string) {
      const msg = JSON.parse(data) as { type: string };
      const reply = (body: unknown) => setTimeout(() => this.readyState === 1 && this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(body) })), 20);
      if (msg.type === 'webrtc/offer') {
        this.entry.kind = 'webrtc';
        reply({ type: 'webrtc/answer', value: 'v=0 fake-answer' });
      } else if (msg.type === 'mse') {
        this.entry.kind = 'mse';
        reply({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' });
      }
    }
    close() {
      this.readyState = 3;
    }
  }
  const Patched = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    const u = String(url);
    if (/\/access-control\/stations\/[^/]+\/live\/ws/.test(u)) return new FakeLive(u);
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
    addTransceiver() {}
    addTrack() {}
    async createOffer() {
      return { type: 'offer', sdp: 'v=0 fake-offer' };
    }
    async setLocalDescription() {}
    async addIceCandidate() {}
    async getStats() {
      return new Map([['v', { type: 'inbound-rtp', kind: 'video', bytesReceived: this.bytes, framesDecoded: this.frames }]]);
    }
    async setRemoteDescription() {
      this.timers.push(window.setTimeout(() => {
        this.connectionState = 'connected';
        this.onconnectionstatechange?.();
      }, 40));
      this.timers.push(window.setTimeout(() => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 180;
        const ctx = c.getContext('2d')!;
        const draw = () => {
          // an invented entrance (no real frame): sky, two walls, a door
          ctx.fillStyle = '#9db8d6';
          ctx.fillRect(0, 0, 320, 180);
          ctx.fillStyle = '#6b7686';
          ctx.fillRect(0, 30, 120, 110);
          ctx.fillRect(200, 30, 120, 110);
          ctx.fillStyle = '#3b4658';
          ctx.fillRect(120, 20, 80, 120);
          ctx.fillStyle = '#7b8494';
          ctx.fillRect(0, 140, 320, 40);
          this.bytes += 4000;
          this.frames += 1;
        };
        draw();
        this.timers.push(window.setInterval(draw, 100));
        const stream = c.captureStream(10);
        this.ontrack?.({ streams: [stream], track: stream.getVideoTracks()[0] });
      }, 60));
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

  const mic = () => String(w.__mic ?? 'ok');
  const md = (navigator.mediaDevices ?? {}) as MediaDevices;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: md });
  md.getUserMedia = async () => {
    if (mic() === 'denied') throw new DOMException('blocked', 'NotAllowedError');
    if (mic() === 'none') throw new DOMException('none', 'NotFoundError');
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const dst = ctx.createMediaStreamDestination();
    osc.connect(gain).connect(dst);
    osc.start();
    return dst.stream;
  };
  const perms = navigator.permissions;
  if (perms) {
    const real = perms.query.bind(perms);
    perms.query = (async (d: PermissionDescriptor) => {
      if (d.name === ('microphone' as PermissionName)) return { state: mic() === 'denied' ? 'denied' : 'prompt', onchange: null } as unknown as PermissionStatus;
      return real(d);
    }) as typeof perms.query;
  }
};

export async function installStationMediaMock(page: Page, base: StationsMock, mm: StationMediaMock): Promise<StationMediaMock> {
  base.settings['access.station_media'] = mm.mode; // the stations mock serves its settings (read at request time)
  await page.addInitScript(STATION_MEDIA_FAKE);
  await page.addInitScript((mode) => ((window as unknown as Record<string, unknown>).__mic = mode), mm.mic);
  await page.routeWebSocket(/\/api\/v1\/access-control\/talk\/[^/]+\/ws/, (ws) => {
    mm.talkSockets.push(ws);
    ws.onMessage((msg) => {
      if (typeof msg !== 'string') {
        mm.frames.push(msg.length);
        return;
      }
      const parsed = JSON.parse(msg) as { type?: string; value?: string };
      mm.talkText.push(parsed);
      if (parsed.type === 'talk/ptt') ws.send(JSON.stringify({ type: 'talk/floor', value: parsed.value === 'down' ? 'held' : 'released' }));
      if (parsed.type === 'talk/stop') {
        ws.send(JSON.stringify({ type: 'talk/closed', value: 'stopped' }));
        void ws.close({ code: 1000 });
      }
    });
    setTimeout(() => ws.send(JSON.stringify({ type: 'talk/state', value: 'open', expires_at: '2026-10-12T08:16:07Z', seconds: 120 })), 30);
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const media = /^access-control\/stations\/([^/]+)\/media$/.exec(p);
    if (media) {
      const id = decodeURIComponent(media[1]);
      mm.mediaReads.push(id);
      return json(mediaBody(mm, id));
    }
    const talk = /^access-control\/stations\/([^/]+)\/talk$/.exec(p);
    if (talk && req.method() === 'POST') {
      const id = decodeURIComponent(talk[1]);
      mm.starts.push({ station: id, body: (req.postDataJSON() ?? {}) as Record<string, unknown> });
      if (mm.startFail) return json({ code: mm.startFail.code, user_message: 'סירוב (בדיקה)', retryable: false, correlation_id: 'test', details: {} }, mm.startFail.status);
      const session = `sess${String(mm.starts.length).padStart(20, '0')}`;
      return json({ session, ws_path: `api/v1/access-control/talk/${session}/ws`, expires_at: '2026-10-12T08:16:07Z', max_seconds: 120, attach_within_s: 15, transport: 'pcmu_frames', codec: 'pcmu', duplex: 'half', sample_rate: 8000, frame_ms: 20, request_id: 'ptt-test' });
    }
    const stop = /^access-control\/talk\/([^/]+)\/stop$/.exec(p);
    if (stop) {
      mm.stops.push(stop[1]);
      return json({ stopped: true });
    }
    return route.fallback();
  });
  return mm;
}
