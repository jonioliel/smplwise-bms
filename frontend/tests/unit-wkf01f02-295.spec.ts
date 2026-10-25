import { test, expect } from '@playwright/test';
import type { TalkStartReply } from '../src/api/station-media';
import { aLaw, g711Sample, muLaw } from '../src/wiskey/g711';
import { MIC_CONSTRAINTS, type MicHandle } from '../src/wiskey/talk-mic';
import { TalkSession, type SocketLike, type TalkDeps } from '../src/wiskey/talk-session';

// WKF01F02-295 (F02): the station's sound inside a two-way talk - WisKey's 800-byte PCMU packets arrive on the talk socket as binary
// messages and play through the talk's own audio context (MicHandle.play). Fakes only: no browser, microphone, speaker or socket.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wkf01f02-295.spec.ts

test.describe('G.711 decoding of the incoming talk packets', () => {
  test('g711Sample inverts the encoders within one quantisation step', () => {
    for (const v of [0, 1000, -1000, 8000, -8000, 30000, -30000]) {
      const mu = g711Sample(muLaw(v), 'pcmu') * 32768;
      const a = g711Sample(aLaw(v), 'pcma') * 32768;
      const step = Math.max(16, Math.abs(v) / 16);
      expect(Math.abs(mu - v)).toBeLessThanOrEqual(step);
      expect(Math.abs(a - v)).toBeLessThanOrEqual(step);
    }
    expect(g711Sample(0xff, 'pcmu')).toBe(0); // mu-law silence
  });
});

class FakeSocket implements SocketLike {
  binaryType = 'blob';
  readyState = 0;
  sent: (string | Uint8Array)[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send(data: string | ArrayBufferView | ArrayBuffer) {
    this.sent.push(typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer));
  }
  close() {
    this.readyState = 3;
  }
  server(msg: unknown) {
    this.readyState = 1;
    this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent);
  }
  texts() {
    return this.sent.filter((x): x is string => typeof x === 'string').map((x) => JSON.parse(x));
  }
  binary(bytes: Uint8Array) {
    this.onmessage?.({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as MessageEvent);
  }
}

const REPLY: TalkStartReply = {
  session: 's'.repeat(32),
  ws_path: 'api/v1/access-control/talk/sss/ws',
  expires_at: '',
  max_seconds: 120,
  attach_within_s: 15,
  transport: 'pcmu_frames',
  codec: 'pcmu',
  duplex: 'half',
  sample_rate: 8000,
  frame_ms: 20,
  request_id: 'ptt-1',
};

function rig(echo: boolean | null = true) {
  const played: number[] = [];
  const sockets: FakeSocket[] = [];
  const timers = new Map<number, () => void>();
  let id = 0;
  let stopped = 0;
  const mic: MicHandle = {
    setActive: () => undefined,
    stop: () => (stopped += 1),
    play: (packet) => played.push(packet.byteLength),
    echoCancellation: echo,
  };
  const deps: TalkDeps = {
    start: async () => REPLY,
    stop: async () => undefined,
    socket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    mic: async () => mic,
    requestId: () => 'ptt-1',
    now: () => 1_000_000,
    after: (fn) => {
      id += 1;
      timers.set(id, fn);
      return id;
    },
    cancel: (t) => timers.delete(t),
    changed: () => undefined,
  };
  return { session: new TalkSession('gate', 'pcmu', 160, deps), played, sockets, timers, stopped: () => stopped };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function opened(echo: boolean | null = true) {
  const r = rig(echo);
  void r.session.start();
  await flush();
  r.sockets[0].server({ type: 'talk/state', value: 'open' });
  return { ...r, ws: r.sockets[0] };
}

test.describe('two-way talk: the station sound on the talk socket (full duplex)', () => {
  test('binary packets play while the microphone is open AND while muted, never before open or after the end', async () => {
    const { session, played, sockets, stopped } = rig();
    void session.start();
    await flush();
    const ws = sockets[0];
    expect(ws.binaryType).toBe('arraybuffer');
    ws.binary(new Uint8Array(800));
    expect(played).toEqual([]); // still starting: nothing plays
    ws.server({ type: 'talk/state', value: 'open' });
    expect(session.phase).toBe('talking'); // the microphone is open for the whole session
    ws.binary(new Uint8Array(800)); // both directions at once
    session.setMuted(true);
    expect(session.phase).toBe('open');
    ws.binary(new Uint8Array(800)); // muted: the station is still heard
    expect(played).toEqual([800, 800]);
    expect(ws.sent.filter((x) => typeof x !== 'string')).toHaveLength(0); // nothing of the station's sound is echoed back
    session.end();
    expect(stopped()).toBe(1);
    ws.binary(new Uint8Array(800)); // the socket's handlers are gone after the end
    expect(played).toEqual([800, 800]);
  });

  test('a text message still drives the state machine next to binary packets', async () => {
    const { session, ws } = await opened();
    ws.binary(new Uint8Array(800));
    ws.server({ type: 'talk/closed', value: 'expired' });
    expect(session.phase).toBe('idle');
    expect(session.outcome).toBe('expired');
  });

  test('owner 25.10: the station sound re-arms the 30 s idle timer of a muted session; silence ends it', async () => {
    const { session, ws, timers } = await opened();
    expect(timers.size).toBe(0); // microphone open: no idle end (the server's hard limit applies)
    session.setMuted(true);
    expect(timers.size).toBe(1);
    const first = [...timers.keys()][0];
    ws.binary(new Uint8Array(800));
    expect(timers.size).toBe(1);
    expect([...timers.keys()][0]).not.toBe(first); // a fresh 30 s window
    [...timers.values()][0](); // IDLE_END_MS of silence later
    expect(session.phase).toBe('idle');
    expect(ws.texts().at(-1)).toEqual({ type: 'talk/stop' });
  });

  test('WK4ADOPT W-002: only a verified 800-byte packet re-arms the 30 s timer; empty or odd binary is neither played nor activity', async () => {
    const { session, ws, timers, played } = await opened();
    session.setMuted(true);
    const armed = [...timers.keys()][0];
    for (const size of [0, 1, 160, 799, 801, 1600]) ws.binary(new Uint8Array(size));
    expect(played).toEqual([]);
    expect([...timers.keys()]).toEqual([armed]); // the same window: nothing re-armed it
    ws.binary(new Uint8Array(800));
    expect(played).toEqual([800]);
    expect([...timers.keys()][0]).not.toBe(armed);
    session.end();
    ws.binary(new Uint8Array(800)); // after the end: no play, no timer
    expect(played).toEqual([800]);
    expect(timers.size).toBe(0);
  });

  test('WK4ADOPT W-002: no artificial keepalive - a muted session sends nothing on its own while the station is heard', async () => {
    const { session, ws } = await opened();
    session.setMuted(true);
    const before = ws.sent.length;
    for (let i = 0; i < 5; i += 1) ws.binary(new Uint8Array(800));
    expect(ws.sent.length).toBe(before); // no floor, no frame, no text: the station's sound is not answered with traffic
  });

  test('unmuting cancels the idle timer; mute state is visible and starts fresh with every session', async () => {
    const { session, timers } = await opened();
    session.setMuted(true);
    expect(session.muted).toBe(true);
    session.setMuted(false);
    expect(session.phase).toBe('talking');
    expect(timers.size).toBe(0);
    session.toggleMute();
    session.end();
    expect(session.phase).toBe('idle');
    void session.start();
    expect(session.muted).toBe(false);
    session.end();
  });

  test('echo cancellation: requested from the browser, and what it applied is reported to the screen', async () => {
    expect((MIC_CONSTRAINTS.audio as MediaTrackConstraints).echoCancellation).toBe(true);
    expect(MIC_CONSTRAINTS.video).toBe(false);
    expect((await opened(true)).session.echoCancelled).toBe(true);
    expect((await opened(false)).session.echoCancelled).toBe(false); // the talk screen shows the headset hint
    expect((await opened(null)).session.echoCancelled).toBeNull();
  });
});