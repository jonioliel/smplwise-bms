import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import { parseListenMode, STATION_LISTEN_KEY, type ListenStartReply } from '../src/api/station-listen';
import { aLaw, muLaw } from '../src/wiskey/g711';
import { aLawDecode, decayLevel, decodeFrame, frameLevel, muLawDecode } from '../src/wiskey/g711-decode';
import { JITTER_S, MAX_LAG_S, schedule } from '../src/wiskey/listen-player';
import { ListenSession, listenProblemOfOutcome, listenStartProblem, type ListenDeps, type ListenSink } from '../src/wiskey/listen-session';
import type { SocketLike } from '../src/wiskey/talk-session';
import { enStationListenText, heStationListenText } from '../src/i18n/wiskey-station-listen';

// WKAUDIN-295: listening to a station - the G.711 decoder and the meter, the speaker's scheduling rule, the setting, and the listen state
// machine with injected effects (no browser, no speaker, no socket, no station). Fakes only.
//   npx playwright test tests/unit-wkaudin-295.spec.ts --project=desktop

const REPLY: ListenStartReply = {
  session: 'sess-listen-0123456789abcdef', ws_path: 'api/v1/access-control/listen/sess-listen-0123456789abcdef/ws', expires_at: '2027-01-15T08:10:00Z',
  max_seconds: 120, attach_within_s: 15, codec: 'pcmu', sample_rate: 8000, frame_ms: 20, request_id: null,
};

class FakeSocket implements SocketLike {
  binaryType = 'blob';
  readyState = 0;
  sent: (string | Uint8Array)[] = [];
  closed = false;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  constructor(readonly path: string) {}
  send(data: string | ArrayBufferView | ArrayBuffer) {
    this.sent.push(typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer));
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  server(msg: unknown) {
    this.readyState = 1;
    this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent);
  }
  frame(bytes: Uint8Array) {
    this.readyState = 1;
    this.onmessage?.({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as MessageEvent);
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }
}

class FakeSink implements ListenSink {
  played: { n: number; rate: number }[] = [];
  muted = false;
  closed = false;
  play(samples: Float32Array, rate: number) {
    this.played.push({ n: samples.length, rate });
  }
  setMuted(m: boolean) {
    this.muted = m;
  }
  close() {
    this.closed = true;
  }
}

function rig(over: Partial<ListenDeps> = {}) {
  const sockets: FakeSocket[] = [];
  const sink = new FakeSink();
  const stops: string[] = [];
  let clock = 1_000_000;
  let changes = 0;
  const deps: ListenDeps = {
    start: async () => REPLY,
    stop: async (s) => {
      stops.push(s);
      return { stopped: true };
    },
    socket: (p) => {
      const s = new FakeSocket(p);
      sockets.push(s);
      return s;
    },
    sink: () => sink,
    requestId: () => 'lst-test-0001',
    now: () => clock,
    changed: () => {
      changes += 1;
    },
    ...over,
  };
  const session = new ListenSession('entry-a', deps);
  return { session, sockets, sink, stops, advance: (ms: number) => (clock += ms), changes: () => changes };
}

const apiError = (status: number, code: string) => new ApiError(status, { code, user_message: 'x', retryable: false, correlation_id: '', details: {} });

const tone = (n = 160, byte = 0x7f) => new Uint8Array(n).fill(byte);

test.describe('G.711 decoder and the meter', () => {
  test('mu-law and A-law decode matches the reference and round-trips the encoder to within one step', () => {
    expect(muLawDecode(0xff)).toBe(0);
    expect(muLawDecode(0x80)).toBe(32124);
    expect(muLawDecode(0x00)).toBe(-32124);
    expect(aLawDecode(0xd5)).toBe(8);
    expect(aLawDecode(0x55)).toBe(-8);
    for (const x of [0, 100, -100, 1000, -1000, 8000, -8000, 20000, -20000]) {
      const u = muLawDecode(muLaw(x));
      const a = aLawDecode(aLaw(x));
      const tol = Math.max(16, Math.abs(x) * 0.07);
      expect(Math.abs(u - x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(a - x)).toBeLessThanOrEqual(tol);
    }
  });

  test('a frame decodes to 160 float samples in -1..1, and the level reads 0 for silence and rises with loudness', () => {
    const quiet = decodeFrame(new Uint8Array(160).fill(0xff), 'pcmu');
    expect(quiet).toHaveLength(160);
    expect(frameLevel(quiet)).toBe(0);
    const loud = decodeFrame(new Uint8Array(160).fill(0x80), 'pcmu');
    expect(Math.max(...loud)).toBeLessThanOrEqual(1);
    expect(frameLevel(loud)).toBe(1);
    const mid = decodeFrame(Uint8Array.from({ length: 160 }, (_, i) => muLaw(i % 2 ? 2000 : -2000)), 'pcmu');
    const level = frameLevel(mid);
    expect(level).toBeGreaterThan(0.1);
    expect(level).toBeLessThan(0.5);
    expect(frameLevel([])).toBe(0);
  });

  test('the meter halves every 150 ms and reads empty within a second', () => {
    expect(decayLevel(0.8, 0)).toBe(0.8);
    expect(decayLevel(0.8, 150)).toBeCloseTo(0.4, 5);
    expect(decayLevel(0.8, 1200)).toBe(0);
  });
});

test.describe('the speaker schedule', () => {
  test('frames go back to back a little ahead of the clock; one that would run too far ahead is dropped, never queued', () => {
    expect(schedule(10, 0)).toBeCloseTo(10 + JITTER_S, 6);
    expect(schedule(10, 10.1)).toBe(10.1);
    expect(schedule(10, 10 + MAX_LAG_S - 0.001)).toBeCloseTo(10 + MAX_LAG_S - 0.001, 6);
    expect(schedule(10, 10 + MAX_LAG_S + 0.05)).toBeNull();
  });
});

test.describe('the setting and the words', () => {
  test('off unless the server says on or probe', () => {
    expect(STATION_LISTEN_KEY).toBe('access.station_listen');
    expect(parseListenMode(undefined)).toBe('off');
    expect(parseListenMode({ [STATION_LISTEN_KEY]: 'on' })).toBe('on');
    expect(parseListenMode({ [STATION_LISTEN_KEY]: 'probe' })).toBe('probe');
    expect(parseListenMode({ [STATION_LISTEN_KEY]: 'true' })).toBe('off');
  });

  test('every problem has words in both languages and none names a protocol or a platform', () => {
    const keys = Object.keys(heStationListenText.problems).sort();
    expect(Object.keys(enStationListenText.problems).sort()).toEqual(keys);
    for (const t of [heStationListenText, enStationListenText]) {
      const blob = JSON.stringify(t);
      expect(blob).not.toMatch(/WisKey|Home Assistant|go2rtc|rtsp|G\.711|pcmu|http/i);
    }
  });

  test('refusals and outcomes map to a problem', () => {
    expect(listenStartProblem(apiError(409, 'intercom_listen_busy'))).toBe('busy');
    expect(listenStartProblem(apiError(409, 'intercom_listen_off'))).toBe('off');
    expect(listenStartProblem(apiError(409, 'intercom_listen_no_listen'))).toBe('no_listen');
    expect(listenStartProblem(apiError(403, 'forbidden'))).toBe('forbidden');
    expect(listenStartProblem(new TypeError('fetch'))).toBe('network');
    expect(listenProblemOfOutcome('stopped')).toBeNull();
    expect(listenProblemOfOutcome('expired')).toBe('expired');
    expect(listenProblemOfOutcome('upstream_closed')).toBe('upstream');
  });
});

test.describe('the listen state machine', () => {
  test('start sends ONE request, opens the socket, plays frames, meters them and keeps no audio', async () => {
    const { session, sockets, sink } = rig();
    await session.start();
    expect(session.phase).toBe('starting');
    expect(session.starts).toBe(1);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].binaryType).toBe('arraybuffer');
    sockets[0].server({ type: 'listen/state', value: 'open' });
    expect(session.phase).toBe('listening');
    expect(session.secondsLeft()).toBe(120);
    sockets[0].frame(tone(160, 0x80));
    sockets[0].frame(tone(160, 0x80));
    expect(session.frames).toBe(2);
    expect(sink.played).toEqual([{ n: 160, rate: 8000 }, { n: 160, rate: 8000 }]);
    expect(session.levelNow()).toBe(1);
    expect(sockets[0].sent).toEqual([]);  // nothing is ever sent up to the station
  });

  test('the meter decays when the station goes quiet, while the session stays open', async () => {
    const { session, sockets, advance } = rig();
    await session.start();
    sockets[0].server({ type: 'listen/state', value: 'open' });
    sockets[0].frame(tone(160, 0x80));
    advance(150);
    expect(session.levelNow()).toBeCloseTo(0.5, 5);
    advance(2000);
    expect(session.levelNow()).toBe(0);
    expect(session.phase).toBe('listening');
  });

  test('mute silences the speaker and leaves the meter running', async () => {
    const { session, sockets, sink } = rig();
    await session.start();
    sockets[0].server({ type: 'listen/state', value: 'open' });
    session.setMuted(true);
    expect(sink.muted).toBe(true);
    sockets[0].frame(tone(160, 0x80));
    expect(session.levelNow()).toBe(1);
    session.setMuted(false);
    expect(sink.muted).toBe(false);
  });

  test('the operator can always stop: while listening, while starting, and the reservation is released if the socket never opened', async () => {
    const a = rig();
    await a.session.start();
    a.sockets[0].server({ type: 'listen/state', value: 'open' });
    a.session.stop();
    expect(a.session.phase).toBe('idle');
    expect(a.sockets[0].sent).toEqual([JSON.stringify({ type: 'listen/stop' })]);
    expect(a.sink.closed).toBe(true);
    expect(a.session.outcome).toBe('ended');
    expect(a.session.problem).toBeNull();
    // stopped while the socket has not opened: the stop endpoint releases the reservation
    const b = rig();
    await b.session.start();
    b.session.stop();
    expect(b.session.phase).toBe('idle');
    expect(b.stops).toEqual([REPLY.session]);
    // dispose (the drawer closing) is the same stop
    const c = rig();
    await c.session.start();
    c.sockets[0].server({ type: 'listen/state', value: 'open' });
    c.session.dispose();
    expect(c.session.phase).toBe('idle');
    expect(c.sockets[0].closed).toBe(true);
  });

  test('a stop pressed before the start answered releases the reservation when it arrives', async () => {
    let resolve!: (r: ListenStartReply) => void;
    const pending = new Promise<ListenStartReply>((r) => (resolve = r));
    const { session, stops, sockets } = rig({ start: () => pending });
    const started = session.start();
    session.stop();
    resolve(REPLY);
    await started;
    expect(session.phase).toBe('idle');
    expect(sockets).toHaveLength(0);
    expect(stops).toEqual([REPLY.session]);
  });

  test('the server ends it: expiry, lost permission, upstream closed, a dropped socket', async () => {
    for (const [msg, problem] of [['expired', 'expired'], ['access_lost', 'access_lost'], ['upstream_closed', 'upstream']] as const) {
      const { session, sockets, sink } = rig();
      await session.start();
      sockets[0].server({ type: 'listen/state', value: 'open' });
      sockets[0].server({ type: 'listen/closed', value: msg });
      expect(session.phase).toBe('idle');
      expect(session.problem).toBe(problem);
      expect(sink.closed).toBe(true);
    }
    const { session, sockets } = rig();
    await session.start();
    sockets[0].server({ type: 'listen/state', value: 'open' });
    sockets[0].drop(1006);
    expect(session.phase).toBe('idle');
    expect(session.problem).toBe('network');
  });

  test('a refused start shows the reason, closes the speaker and is never retried', async () => {
    const { session, sink } = rig({ start: async () => { throw apiError(409, 'intercom_listen_user_busy'); } });
    await session.start();
    expect(session.phase).toBe('idle');
    expect(session.problem).toBe('user_busy');
    expect(session.starts).toBe(1);
    expect(sink.closed).toBe(true);
  });

  test('no audio output in the browser: nothing is requested from the server', async () => {
    const { session, sockets } = rig({ sink: () => null });
    await session.start();
    expect(session.problem).toBe('no_audio');
    expect(session.starts).toBe(0);
    expect(sockets).toHaveLength(0);
  });
});
