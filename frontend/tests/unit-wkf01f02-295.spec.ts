import { test, expect } from '@playwright/test';
import type { TalkStartReply } from '../src/api/station-media';
import { aLaw, g711Sample, muLaw } from '../src/wiskey/g711';
import type { MicHandle } from '../src/wiskey/talk-mic';
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

function rig() {
  const played: number[] = [];
  const sockets: FakeSocket[] = [];
  let stopped = 0;
  const mic: MicHandle = {
    setActive: () => undefined,
    stop: () => (stopped += 1),
    play: (packet) => played.push(packet.byteLength),
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
    after: () => 1,
    cancel: () => undefined,
    changed: () => undefined,
  };
  return { session: new TalkSession('gate', 'pcmu', 160, deps), played, sockets, stopped: () => stopped };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test.describe('two-way talk: the station sound on the talk socket', () => {
  test('binary packets play only while the session is open or talking, never before open or after the end', async () => {
    const { session, played, sockets, stopped } = rig();
    void session.press();
    await flush();
    const ws = sockets[0];
    expect(ws.binaryType).toBe('arraybuffer');
    ws.binary(new Uint8Array(800));
    expect(played).toEqual([]); // still starting: nothing plays
    ws.server({ type: 'talk/state', value: 'open' });
    expect(session.phase).toBe('talking');
    ws.binary(new Uint8Array(800)); // while the operator holds the button (the microphone is open)
    session.release();
    expect(session.phase).toBe('open');
    ws.binary(new Uint8Array(800)); // listening between presses
    expect(played).toEqual([800, 800]);
    expect(ws.sent.filter((x) => typeof x !== 'string')).toHaveLength(0); // nothing of the station's sound is echoed back
    session.end();
    expect(stopped()).toBe(1);
    ws.binary(new Uint8Array(800)); // the socket's handlers are gone after the end
    expect(played).toEqual([800, 800]);
  });

  test('a text message still drives the state machine next to binary packets', async () => {
    const { session, sockets } = rig();
    void session.press();
    await flush();
    const ws = sockets[0];
    ws.server({ type: 'talk/state', value: 'open' });
    ws.binary(new Uint8Array(800));
    ws.server({ type: 'talk/closed', value: 'expired' });
    expect(session.phase).toBe('idle');
    expect(session.outcome).toBe('expired');
  });
});
