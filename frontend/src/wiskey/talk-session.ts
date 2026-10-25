/**
 * One two-way talk session with a station (CR-036 slice S18; WKF01F02-295 owner decision 25.10: full duplex, the microphone open
 * for the whole session - no push-to-talk), as a small state machine with injected effects (the API, the socket, the microphone,
 * the clock), so it is unit-tested without a browser (tests/unit-wiskey-station-media.spec.ts, tests/unit-wkf01f02-295.spec.ts).
 *
 *   idle --start--> starting (microphone, then ONE start request, then the session socket) --"open"--> talking <--mute--> open
 *   any --end / expiry / refusal / lost permission / upstream closed--> idle (+ `outcome`, `problem`)
 *
 * `talking` = the microphone is open and frames leave; `open` = the operator muted it (the session and the station's sound go on).
 * Rules: the microphone is asked for on the start (the permission prompt belongs to the operator's gesture); the start request is
 * sent once and never retried; frames leave only while the microphone is open and unmuted (`talk/ptt` down = open, up = muted; the
 * server drops anything else anyway); the station's sound (binary socket messages) plays through the talk's own audio context;
 * a MUTED session with no sound from the station for IDLE_END_MS is ended (the station's sound re-arms that timer); the session
 * always has an explicit end (`end`), the server's hard limit, and every server-side end.
 */
import { ApiError } from '../api/client';
import type { TalkStartReply } from '../api/station-media';
import { MicFailure, type MicHandle } from './talk-mic';

export type TalkPhase = 'idle' | 'starting' | 'open' | 'talking';
export type TalkProblem =
  | 'insecure'
  | 'denied'
  | 'no_mic'
  | 'mic_busy'
  | 'busy'
  | 'user_busy'
  | 'forbidden'
  | 'unsupported'
  | 'off'
  | 'offline'
  | 'unavailable'
  | 'expired'
  | 'upstream'
  | 'network'
  | 'access_lost'
  | 'failed';

export interface SocketLike {
  binaryType: string;
  readyState: number;
  send(data: string | ArrayBufferView | ArrayBuffer): void;
  close(code?: number): void;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
}

export interface TalkDeps {
  start(stationId: string, requestId: string): Promise<TalkStartReply>;
  stop(session: string): Promise<unknown>;
  socket(wsPath: string): SocketLike;
  mic(codec: 'pcmu' | 'pcma', frameBytes: number, onFrame: (frame: Uint8Array) => void): Promise<MicHandle>;
  requestId(): string;
  now(): number;
  after(fn: () => void, ms: number): number;
  cancel(id: number): void;
  changed(): void;
  /** The floor was taken (true) or released (false): a half-duplex screen mutes the station's sound meanwhile. */
  floor?(held: boolean): void;
}

/** A MUTED session with no sound from the station for this long is ended (the microphone is released). */
export const IDLE_END_MS = 30_000;

const START_PROBLEMS: Record<string, TalkProblem> = {
  intercom_talk_busy: 'busy',
  intercom_talk_user_busy: 'user_busy',
  intercom_talk_unsupported: 'unsupported',
  intercom_talk_off: 'off',
  intercom_station_offline: 'offline',
  intercom_talk_unavailable: 'unavailable',
  intercom_unavailable: 'unavailable',
  intercom_station_not_found: 'unavailable',
  forbidden: 'forbidden',
};

export function startProblem(err: unknown): TalkProblem {
  if (err instanceof ApiError) {
    if (START_PROBLEMS[err.code]) return START_PROBLEMS[err.code];
    if (err.status === 403) return 'forbidden';
    if (err.status === 0) return 'network';
  }
  if (err instanceof TypeError) return 'network'; // fetch's own network failure
  return 'failed';
}

/** How a session ended, as the server said it (`talk/closed`) or as the socket's close code tells. */
export function outcomeOfClose(code: number): string {
  if (code === 4408) return 'expired';
  if (code === 4403) return 'access_lost';
  if (code === 4503) return 'upstream_unavailable';
  if (code === 4423) return 'busy';
  if (code === 4404 || code === 4409) return 'refused';
  if (code === 1000) return 'ended';
  return 'network';
}

export function problemOfOutcome(outcome: string): TalkProblem | null {
  switch (outcome) {
    case 'ended':
    case 'stopped':
      return null;
    case 'expired':
      return 'expired';
    case 'access_lost':
      return 'access_lost';
    case 'busy':
      return 'busy';
    case 'upstream_closed':
    case 'upstream_unavailable':
      return 'upstream';
    case 'network':
      return 'network';
    default:
      return 'failed';
  }
}

export class TalkSession {
  phase: TalkPhase = 'idle';
  problem: TalkProblem | null = null;
  /** How the last session ended (null while none has). */
  outcome: string | null = null;
  /** The session's hard end (epoch ms, from the server's limit), 0 when none is open. */
  endsAt = 0;
  /** Requests sent this life (a test reads it: one per start, never a retry). */
  starts = 0;
  /** The operator muted the microphone (the session and the station's sound go on). Kept across the opening. */
  muted = false;
  private gen = 0;
  private reply: TalkStartReply | null = null;
  private ws: SocketLike | null = null;
  private micHandle: MicHandle | null = null;
  private idleTimer = 0;
  private floorHeld = false;

  constructor(
    readonly stationId: string,
    private readonly codec: 'pcmu' | 'pcma',
    private readonly frameBytes: number,
    private readonly deps: TalkDeps,
  ) {}

  /** Seconds left in the open session (null when none). */
  secondsLeft(): number | null {
    return this.phase === 'open' || this.phase === 'talking' ? Math.max(0, Math.ceil((this.endsAt - this.deps.now()) / 1000)) : null;
  }

  /** Whether the browser applied echo cancellation to the open microphone (null: unknown / no microphone open). */
  get echoCancelled(): boolean | null {
    return this.micHandle?.echoCancellation ?? null;
  }

  /** The operator starts a talk (click or keyboard). Ignored while a session is starting or open. */
  async start(): Promise<void> {
    if (this.phase !== 'idle') return;
    this.problem = null;
    this.muted = false;
    this.phase = 'starting';
    const gen = ++this.gen;
    this.deps.changed();
    let mic: MicHandle;
    try {
      mic = await this.deps.mic(this.codec, this.frameBytes, (f) => this.onFrame(f));
    } catch (err) {
      if (gen === this.gen) this.fail(err instanceof MicFailure ? err.code : 'failed');
      return;
    }
    if (gen !== this.gen) {
      mic.stop();
      return;
    }
    this.micHandle = mic;
    let reply: TalkStartReply;
    try {
      this.starts += 1;
      reply = await this.deps.start(this.stationId, this.deps.requestId());
    } catch (err) {
      if (gen === this.gen) this.fail(startProblem(err));
      return;
    }
    if (gen !== this.gen) {
      void this.deps.stop(reply.session).catch(() => undefined);
      return;
    }
    this.reply = reply;
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
      if (ev.data instanceof ArrayBuffer) {
        if (this.phase === 'open' || this.phase === 'talking') {
          this.micHandle?.play?.(new Uint8Array(ev.data));
          if (this.phase === 'open') this.armIdle(); // owner 25.10: the station's sound keeps a muted session alive
        }
        return;
      }
      if (typeof ev.data !== 'string') return;
      let msg: { type?: string; value?: string };
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'talk/state' && msg.value === 'open' && this.phase === 'starting') {
        this.phase = 'open';
        // the talk holds the station's sound for the whole session: the live view mutes its own copy (no double sound, no echo path)
        this.floorHeld = true;
        this.deps.floor?.(true);
        if (!this.muted) this.openMic();
        else this.armIdle();
        this.deps.changed();
      } else if (msg.type === 'talk/closed') {
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

  /** Mute (true) or open (false) the microphone; the session and the station's sound go on. Remembered while the session opens. */
  setMuted(on: boolean): void {
    if (this.phase === 'idle') return;
    this.muted = on;
    if (on && this.phase === 'talking') this.muteMic();
    else if (!on && this.phase === 'open') this.openMic();
    else this.deps.changed();
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }

  /** The operator ends the session (or the drawer closes). */
  end(): void {
    if (this.phase === 'idle') return;
    const ws = this.ws;
    const reply = this.reply;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'talk/stop' }));
    else if (reply) void this.deps.stop(reply.session).catch(() => undefined); // the socket never opened: release the slot
    this.finish('ended');
  }

  dispose(): void {
    this.end();
  }

  /** The microphone opens: frames leave (`talk/ptt` down - the server's floor) until muted or the end. */
  private openMic(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 || !this.micHandle) return;
    this.deps.cancel(this.idleTimer);
    this.micHandle.setActive(true);
    ws.send(JSON.stringify({ type: 'talk/ptt', value: 'down' }));
    this.phase = 'talking';
    this.deps.changed();
  }

  /** Muted: no frame leaves (`talk/ptt` up); the station's sound still plays; the idle timer runs. */
  private muteMic(): void {
    this.micHandle?.setActive(false);
    const ws = this.ws;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'talk/ptt', value: 'up' }));
    this.phase = 'open';
    this.armIdle();
    this.deps.changed();
  }

  private armIdle(): void {
    this.deps.cancel(this.idleTimer);
    const gen = this.gen;
    this.idleTimer = this.deps.after(() => {
      if (gen === this.gen && this.phase === 'open') this.end();
    }, IDLE_END_MS);
  }

  private onFrame(frame: Uint8Array): void {
    const ws = this.ws;
    if (this.phase === 'talking' && ws && ws.readyState === 1) ws.send(frame);
  }

  private teardown(): void {
    this.gen += 1;
    this.deps.cancel(this.idleTimer);
    this.micHandle?.stop();
    this.micHandle = null;
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
    if (this.floorHeld) this.deps.floor?.(false);
    this.floorHeld = false;
    this.reply = null;
    this.endsAt = 0;
  }

  private fail(problem: TalkProblem): void {
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
    this.problem = problemOfOutcome(outcome);
    this.deps.changed();
  }
}
