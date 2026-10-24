/**
 * WKAUDIN-295: one session of listening to a station (its audio TO the operator), as a small state machine with injected effects (the API,
 * the socket, the speaker sink, the clock), so it is unit-tested without a browser (tests/unit-wkaudin-295.spec.ts).
 *
 *   idle --start--> starting (ONE start request, then the session socket) --"open"--> listening
 *   any --stop / expiry / refusal / lost permission / upstream closed--> idle (+ `outcome`, `problem`)
 *
 * Rules: the start request is sent once per start and never retried; the operator can ALWAYS stop (the stop button, the drawer closing, or
 * `dispose()` all end it, and a stop before the socket opened releases the reservation through the stop endpoint); nothing is sent to the
 * station and nothing is recorded: a frame is decoded, shown on the meter, handed to the sink and gone. Mute silences the sink and leaves the
 * meter running (the operator still sees that the station is making sound). The frame format is the server's (`listen/state` carries it).
 */
import { ApiError } from '../api/client';
import type { ListenStartReply } from '../api/station-listen';
import { decayLevel, decodeFrame, frameLevel, type ListenCodec } from './g711-decode';
import { outcomeOfClose, type SocketLike } from './talk-session';

export type ListenPhase = 'idle' | 'starting' | 'listening';
export type ListenProblem =
  | 'busy'
  | 'user_busy'
  | 'forbidden'
  | 'unsupported'
  | 'no_listen'
  | 'off'
  | 'offline'
  | 'unavailable'
  | 'expired'
  | 'upstream'
  | 'network'
  | 'access_lost'
  | 'no_audio'
  | 'failed';

/** Where the sound goes (the browser's speaker in the app, a recorder-less fake in tests). */
export interface ListenSink {
  play(samples: Float32Array, sampleRate: number): void;
  setMuted(muted: boolean): void;
  close(): void;
}

export interface ListenDeps {
  start(stationId: string, requestId: string): Promise<ListenStartReply>;
  stop(session: string): Promise<unknown>;
  socket(wsPath: string): SocketLike;
  /** Created inside the operator's click (the browser lets audio start only from a gesture); null when the browser has no audio output. */
  sink(): ListenSink | null;
  requestId(): string;
  now(): number;
  changed(): void;
}

const START_PROBLEMS: Record<string, ListenProblem> = {
  intercom_listen_busy: 'busy',
  intercom_listen_user_busy: 'user_busy',
  intercom_listen_unsupported: 'unsupported',
  intercom_listen_no_listen: 'no_listen',
  intercom_listen_off: 'off',
  intercom_station_offline: 'offline',
  intercom_listen_unavailable: 'unavailable',
  intercom_unavailable: 'unavailable',
  intercom_station_not_found: 'unavailable',
  forbidden: 'forbidden',
};

export function listenStartProblem(err: unknown): ListenProblem {
  if (err instanceof ApiError) {
    if (START_PROBLEMS[err.code]) return START_PROBLEMS[err.code];
    if (err.status === 403) return 'forbidden';
    if (err.status === 0) return 'network';
  }
  if (err instanceof TypeError) return 'network'; // fetch's own network failure
  return 'failed';
}

export function listenProblemOfOutcome(outcome: string): ListenProblem | null {
  switch (outcome) {
    case 'ended':
    case 'stopped':
      return null;
    case 'expired':
      return 'expired';
    case 'access_lost':
      return 'access_lost';
    case 'upstream_closed':
    case 'upstream_unavailable':
      return 'upstream';
    case 'network':
      return 'network';
    default:
      return 'failed';
  }
}

export class ListenSession {
  phase: ListenPhase = 'idle';
  problem: ListenProblem | null = null;
  /** How the last session ended (null while none has). */
  outcome: string | null = null;
  muted = false;
  /** The session's hard end (epoch ms, from the server's limit), 0 when none is open. */
  endsAt = 0;
  /** Requests sent this life (a test reads it: one per start, never a retry). */
  starts = 0;
  /** Whole frames received in this session (a count, never audio). */
  frames = 0;
  private level = 0;
  private levelAt = 0;
  private gen = 0;
  private reply: ListenStartReply | null = null;
  private ws: SocketLike | null = null;
  private sink: ListenSink | null = null;
  private codec: ListenCodec = 'pcmu';
  private rate = 8000;

  constructor(readonly stationId: string, private readonly deps: ListenDeps) {}

  /** Seconds left in the open session (null when none). */
  secondsLeft(): number | null {
    return this.phase === 'listening' ? Math.max(0, Math.ceil((this.endsAt - this.deps.now()) / 1000)) : null;
  }

  /** The meter, 0..1, decayed by the time since the last frame. */
  levelNow(): number {
    return this.phase === 'listening' ? decayLevel(this.level, this.deps.now() - this.levelAt) : 0;
  }

  /** The operator pressed "listen" (a click: audio is allowed to start now). */
  async start(): Promise<void> {
    if (this.phase !== 'idle') return;
    this.problem = null;
    const sink = this.deps.sink();
    if (!sink) {
      this.problem = 'no_audio';
      this.deps.changed();
      return;
    }
    this.sink = sink;
    sink.setMuted(this.muted);
    this.phase = 'starting';
    const gen = ++this.gen;
    this.deps.changed();
    let reply: ListenStartReply;
    try {
      this.starts += 1;
      reply = await this.deps.start(this.stationId, this.deps.requestId());
    } catch (err) {
      if (gen === this.gen) this.fail(listenStartProblem(err));
      return;
    }
    if (gen !== this.gen) {
      void this.deps.stop(reply.session).catch(() => undefined);
      return;
    }
    this.reply = reply;
    this.codec = reply.codec;
    this.rate = reply.sample_rate;
    this.endsAt = this.deps.now() + reply.max_seconds * 1000;
    let ws: SocketLike;
    try {
      ws = this.deps.socket(reply.ws_path);
    } catch {
      void this.deps.stop(reply.session).catch(() => undefined);
      this.fail('network');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onmessage = (ev) => {
      if (gen !== this.gen) return;
      if (typeof ev.data !== 'string') {
        if (this.phase === 'listening') this.onFrame(ev.data as ArrayBuffer);
        return;
      }
      let msg: { type?: string; value?: string };
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'listen/state' && msg.value === 'open' && this.phase === 'starting') {
        this.phase = 'listening';
        this.levelAt = this.deps.now();
        this.deps.changed();
      } else if (msg.type === 'listen/closed') {
        this.finish(String(msg.value ?? 'ended'));
      }
    };
    ws.onclose = (ev) => {
      if (gen !== this.gen) return;
      this.finish(outcomeOfClose(ev.code));
    };
    ws.onerror = () => {
      /* the close that follows decides */
    };
  }

  /** Mute or unmute the speaker; the meter keeps showing the station's sound. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.sink?.setMuted(muted);
    this.deps.changed();
  }

  /** The operator ends the session (or the drawer closes): always possible, in every phase. */
  stop(): void {
    if (this.phase === 'idle') return;
    const ws = this.ws;
    const reply = this.reply;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'listen/stop' }));
    else if (reply) void this.deps.stop(reply.session).catch(() => undefined); // the socket never opened: release the reservation
    this.finish('ended');
  }

  dispose(): void {
    this.stop();
  }

  private onFrame(data: ArrayBuffer): void {
    const samples = decodeFrame(new Uint8Array(data), this.codec);
    this.frames += 1;
    this.level = frameLevel(samples);
    this.levelAt = this.deps.now();
    this.sink?.play(samples, this.rate);
  }

  private teardown(): void {
    this.gen += 1;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
    this.sink?.close();
    this.sink = null;
    this.reply = null;
    this.endsAt = 0;
    this.level = 0;
  }

  private fail(problem: ListenProblem): void {
    this.teardown();
    this.phase = 'idle';
    this.problem = problem;
    this.outcome = null;
    this.deps.changed();
  }

  private finish(outcome: string): void {
    this.teardown();
    this.phase = 'idle';
    this.outcome = outcome;
    this.problem = listenProblemOfOutcome(outcome);
    this.deps.changed();
  }
}
