import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import { parseMediaMode, playerModeFor, startProfile, type MediaProfile, type TalkStartReply } from '../src/api/station-media';
import { aLaw, Downsampler, FramePacker, muLaw, to16 } from '../src/wiskey/g711';
import { MicFailure, type MicHandle } from '../src/wiskey/talk-mic';
import { IDLE_END_MS, outcomeOfClose, problemOfOutcome, startProblem, TalkSession, type SocketLike, type TalkDeps } from '../src/wiskey/talk-session';

// CR-036 slice S18: the pure parts of a station's live video and two-way talk - the G.711 encoder, the frame packer, the player
// mode per profile, the setting, and the talk state machine with injected effects (no browser, no microphone, no socket).
//   npx playwright test tests/unit-wiskey-station-media.spec.ts --project=desktop

test.describe('G.711 frames', () => {
  test('mu-law and A-law match the reference values of the public algorithm', () => {
    expect(muLaw(0)).toBe(0xff);
    expect(muLaw(32767)).toBe(0x80);
    expect(muLaw(-32768)).toBe(0x00);
    expect(muLaw(1000)).toBe(0xce);
    expect(muLaw(-1000)).toBe(0x4e);
    expect(aLaw(0)).toBe(0xd5);
    expect(aLaw(-1)).toBe(0x55);
    expect(aLaw(32767)).toBe(0xaa);
    expect(aLaw(-32768)).toBe(0x2a);
    expect(to16(1.5)).toBe(32767);
    expect(to16(-2)).toBe(-32767);
  });

  test('the downsampler keeps its phase between chunks: 20 ms at 48 kHz is 160 samples at 8 kHz', () => {
    const one = new Downsampler(48000);
    expect(one.push(new Float32Array(960))).toHaveLength(160);
    const two = new Downsampler(48000);
    const n = two.push(new Float32Array(500)).length + two.push(new Float32Array(460)).length;
    expect(n).toBe(160);
    expect(new Downsampler(44100).push(new Float32Array(44100)).length).toBeGreaterThanOrEqual(7999);
    expect(new Downsampler(48000).push(Float32Array.from({ length: 12 }, () => 0.5))).toEqual([0.5, 0.5]);
  });

  test('the packer hands out whole 160-byte frames only, and forgets the rest on reset', () => {
    const p = new FramePacker('pcmu');
    const frames = p.push(new Float32Array(400));
    expect(frames.map((f) => f.length)).toEqual([160, 160]);
    expect(frames[0][0]).toBe(0xff);
    p.reset();
    expect(p.push(new Float32Array(100))).toHaveLength(0);
    expect(new FramePacker('pcma').push(new Float32Array(160))[0][0]).toBe(0xd5);
  });
});

test.describe('live view choices', () => {
  const prof = (id: 'sub' | 'main', transports: ('webrtc' | 'mse')[]): MediaProfile => ({ id, codec: 'h264', transports, width: null, height: null, fps: null });

  test('sub plays WebRTC first with MSE behind it; main plays MSE (the lab facts)', () => {
    expect(playerModeFor(prof('sub', ['webrtc', 'mse']))).toBe('auto');
    expect(playerModeFor(prof('main', ['mse', 'webrtc']))).toBe('mse');
    expect(playerModeFor(prof('main', ['webrtc']))).toBe('webrtc');
    expect(playerModeFor(prof('sub', ['mse']))).toBe('mse');
    expect(playerModeFor(prof('sub', ['webrtc']))).toBe('webrtc');
  });

  test('the start profile is the server default when offered', () => {
    const video = { profiles: [prof('sub', ['webrtc']), prof('main', ['mse'])], default_profile: 'sub' as const, allowed: true, paths: {}, max_viewers: 2, viewers: 0 };
    expect(startProfile(video)).toBe('sub');
    expect(startProfile({ ...video, default_profile: null })).toBe('sub');
    expect(startProfile({ ...video, profiles: [prof('main', ['mse'])] })).toBe('main');
    expect(startProfile(null)).toBeNull();
  });

  test('the setting reads off unless it says video or video_talk', () => {
    expect(parseMediaMode(null)).toBe('off');
    expect(parseMediaMode({ 'access.station_media': 'VIDEO' })).toBe('off');
    expect(parseMediaMode({ 'access.station_media': 'video' })).toBe('video');
    expect(parseMediaMode({ 'access.station_media': 'video_talk' })).toBe('video_talk');
  });
});

// ---------------------------------------------------------------- the talk state machine

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
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }
  texts() {
    return this.sent.filter((x): x is string => typeof x === 'string').map((x) => JSON.parse(x));
  }
  frames() {
    return this.sent.filter((x) => typeof x !== 'string').length;
  }
}

const REPLY: TalkStartReply = { session: 's'.repeat(32), ws_path: 'api/v1/access-control/talk/sss/ws', expires_at: '', max_seconds: 120, attach_within_s: 15, transport: 'pcmu_frames', codec: 'pcmu', duplex: 'half', sample_rate: 8000, frame_ms: 20, request_id: 'ptt-1' };

function rig(o: { start?: () => Promise<TalkStartReply>; mic?: () => Promise<MicHandle> } = {}) {
  const log = { starts: [] as string[], stops: [] as string[], sockets: [] as FakeSocket[], micOn: [] as boolean[], micStopped: 0, floors: [] as boolean[], timers: new Map<number, () => void>(), clock: 1_000_000 };
  let emit: ((f: Uint8Array) => void) | null = null;
  let id = 0;
  const deps: TalkDeps = {
    start: async (station, rid) => {
      log.starts.push(`${station}:${rid}`);
      return o.start ? o.start() : REPLY;
    },
    stop: async (s) => {
      log.stops.push(s);
    },
    socket: (path) => {
      const s = new FakeSocket(path);
      log.sockets.push(s);
      return s;
    },
    mic: async (_codec, _bytes, onFrame) => {
      if (o.mic) return o.mic();
      emit = onFrame;
      return { setActive: (on) => log.micOn.push(on), stop: () => (log.micStopped += 1) };
    },
    requestId: () => `ptt-${log.starts.length + 1}`,
    now: () => log.clock,
    after: (fn) => {
      id += 1;
      log.timers.set(id, fn);
      return id;
    },
    cancel: (t) => log.timers.delete(t),
    changed: () => undefined,
    floor: (held) => log.floors.push(held),
  };
  const session = new TalkSession('gate', 'pcmu', 160, deps);
  const frame = () => emit?.(new Uint8Array(160));
  return { session, log, frame };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test.describe('two-way talk session (full duplex, owner 25.10)', () => {
  test('one start: microphone, ONE start, the socket; the microphone opens with the session; mute / unmute; explicit end', async () => {
    const { session, log, frame } = rig();
    void session.start();
    await flush();
    expect(session.phase).toBe('starting');
    expect(log.starts).toEqual(['gate:ptt-1']);
    const ws = log.sockets[0];
    expect(ws.path).toBe(REPLY.ws_path);
    expect(ws.binaryType).toBe('arraybuffer');
    frame();
    expect(ws.frames()).toBe(0); // not open yet
    ws.server({ type: 'talk/state', value: 'open' });
    expect(session.phase).toBe('talking'); // no button to hold: the microphone is open for the whole session
    expect(ws.texts()).toEqual([{ type: 'talk/ptt', value: 'down' }]);
    frame();
    frame();
    expect(ws.frames()).toBe(2);
    session.toggleMute();
    expect(session.phase).toBe('open');
    expect(session.muted).toBe(true);
    frame();
    expect(ws.frames()).toBe(2); // muted: nothing leaves
    expect(log.micOn).toEqual([true, false]);
    session.toggleMute();
    expect(session.phase).toBe('talking');
    expect(log.starts).toHaveLength(1); // the same session
    expect(ws.texts().map((m) => m.value)).toEqual(['down', 'up', 'down']);
    expect(log.floors).toEqual([true]); // the live view stays muted for the whole talk, not per mute
    void session.start();
    expect(log.starts).toHaveLength(1); // a second start while open does nothing
    expect(session.secondsLeft()).toBe(120);
    session.end();
    expect(ws.texts().at(-1)).toEqual({ type: 'talk/stop' });
    expect(session.phase).toBe('idle');
    expect(session.outcome).toBe('ended');
    expect(session.problem).toBeNull();
    expect(log.micStopped).toBe(1);
    expect(log.floors).toEqual([true, false]);
    expect(ws.closed).toBe(true);
  });

  test('a refused start is shown, never retried; the next start is a new request', async () => {
    const { session, log } = rig({ start: () => Promise.reject(new ApiError(409, { code: 'intercom_talk_busy', user_message: 'x', retryable: true, correlation_id: '', details: {} })) });
    await session.start();
    expect(session.phase).toBe('idle');
    expect(session.problem).toBe('busy');
    expect(log.starts).toHaveLength(1);
    expect(log.micStopped).toBe(1); // the microphone is released at once
    await flush();
    expect(log.starts).toHaveLength(1);
    await session.start();
    expect(log.starts).toHaveLength(2);
  });

  test('a blocked microphone stops before anything is reserved', async () => {
    const { session, log } = rig({ mic: () => Promise.reject(new MicFailure('denied')) });
    await session.start();
    expect(session.problem).toBe('denied');
    expect(log.starts).toHaveLength(0);
  });

  test('the server ends a session: expiry, a lost permission, a closed channel', async () => {
    for (const [how, problem] of [[4408, 'expired'], [4403, 'access_lost'], [4503, 'upstream'], [4423, 'busy'], [1006, 'network']] as const) {
      const { session, log } = rig();
      void session.start();
      await flush();
      log.sockets[0].server({ type: 'talk/state', value: 'open' });
      log.sockets[0].drop(how);
      expect(session.phase).toBe('idle');
      expect(session.problem).toBe(problem);
      expect(log.floors.at(-1)).toBe(false); // the station's sound comes back to the live view
    }
    const { session, log } = rig();
    void session.start();
    await flush();
    log.sockets[0].server({ type: 'talk/state', value: 'open' });
    log.sockets[0].server({ type: 'talk/closed', value: 'upstream_closed' });
    expect(session.problem).toBe('upstream');
  });

  test('muted before the session opened: no frame, no floor; a muted session nobody hears for a while ends', async () => {
    const { session, log } = rig();
    void session.start();
    await flush();
    session.setMuted(true);
    log.sockets[0].server({ type: 'talk/state', value: 'open' });
    expect(session.phase).toBe('open');
    expect(log.sockets[0].texts()).toEqual([]);
    expect(log.timers.size).toBe(1);
    [...log.timers.values()][0](); // IDLE_END_MS later
    expect(session.phase).toBe('idle');
    expect(log.sockets[0].texts()).toEqual([{ type: 'talk/stop' }]);
    expect(IDLE_END_MS).toBe(30_000);
  });

  test('ended while opening: the reserved slot is released, nothing is left open', async () => {
    let resolve: (r: TalkStartReply) => void = () => undefined;
    const { session, log } = rig({ start: () => new Promise((r) => (resolve = r)) });
    void session.start();
    await flush();
    session.end();
    resolve(REPLY);
    await flush();
    expect(log.stops).toEqual([REPLY.session]);
    expect(log.sockets).toHaveLength(0);
    expect(log.micStopped).toBe(1);
  });

  test('error and close mappings', () => {
    expect(startProblem(new ApiError(403, { code: 'forbidden', user_message: '', retryable: false, correlation_id: '', details: {} }))).toBe('forbidden');
    expect(startProblem(new ApiError(409, { code: 'intercom_talk_user_busy', user_message: '', retryable: false, correlation_id: '', details: {} }))).toBe('user_busy');
    expect(startProblem(new ApiError(409, { code: 'intercom_talk_unsupported', user_message: '', retryable: false, correlation_id: '', details: {} }))).toBe('unsupported');
    expect(startProblem(new TypeError('fetch failed'))).toBe('network');
    expect(startProblem(new Error('x'))).toBe('failed');
    expect(outcomeOfClose(4408)).toBe('expired');
    expect(outcomeOfClose(1000)).toBe('ended');
    expect(outcomeOfClose(4423)).toBe('busy');
    expect(problemOfOutcome('busy')).toBe('busy'); // shown as "העמדה בדיבור עם מפעיל אחר" (i18n problems.busy)
    expect(problemOfOutcome('stopped')).toBeNull();
    expect(problemOfOutcome('never_connected')).toBe('failed');
  });
});
