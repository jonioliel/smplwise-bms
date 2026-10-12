/**
 * The physical actions of the native stations screen (CR-036 slice S6), as one small state machine with no DOM: door release
 * (confirm, send ONCE, "sent" - never "opened", an unknown outcome holds the button), call answer / reject / hang up (two taps:
 * the first arms, the second sends) and the announcement progress notices. It moves the logic of screens/wiskey-overview.ts
 * (T054 reviews B1 / S1 / S4) behind injected dependencies so the unit spec can drive it with a fake clock and fake endpoints.
 *
 * Rules kept from the entry center, because they are safety rules of a physical system (AGENTS.md "Never queue or blindly retry
 * physical commands"):
 * - a release runs only from the confirmation step's own button, once per confirmation; nothing here ever retries it;
 * - a failure that is not a structured "not sent" / "refused" from the backend is "outcome unknown" (amber), never a reassurance;
 * - after an unknown outcome (or "release in progress") the relay's button waits as long as the backend holds that relay;
 * - an arm of a call control belongs to the call it was made for: when that station's call state changes it is dropped;
 * - nothing acts on a last-known copy (`live()` false): a stale screen is for reading.
 */
import { ApiError, describeError } from '../api/client';
import { actionOutcome, type IntercomCallCommand, type IntercomCallResult, type IntercomTtsStatus } from '../api/intercom';
import type { AccessStation } from '../api/access-stations';
import { fill, ws, type StationsText } from '../i18n/wiskey-stations';
import { ARM_MIN_MS, ARM_MS, UNKNOWN_HOLD_FALLBACK_MS, callWord } from './wiskey-stations-logic';

export type Tone = 'ok' | 'warn' | 'err';
export interface ActionResult {
  tone: Tone;
  text: string;
}

/** How long a relay's button waits after an unknown outcome: the backend's own `retry_after_s`, else the longest it can hold. */
export function holdMs(err: unknown): number {
  const s = err instanceof ApiError ? Number(err.body?.details?.retry_after_s) : NaN;
  return Number.isFinite(s) && s >= 0 ? Math.ceil(s * 1000) : UNKNOWN_HOLD_FALLBACK_MS;
}

/** A physical action that did not succeed, as the caller must read it. Only a structured "not sent" / "refused" from the backend
 * is a plain failure; everything else - a dropped connection, a proxy error - is "outcome unknown", in amber. */
export function failure(err: unknown, text: StationsText = ws()): { tone: Tone; text: string; unknown: boolean } {
  if (actionOutcome(err) !== 'unknown') return { tone: 'err', text: describeError(err), unknown: false };
  return { tone: 'warn', text: text.call.unknown, unknown: true };
}

/** Only what WisKey's answer says: the device acknowledgement and the call state observed afterwards. */
export function callText(c: IntercomCallResult, text: StationsText = ws()): string {
  const labels: Record<string, string> = { answer: text.call.answer, reject: text.call.reject, hangUp: text.call.hangUp };
  const head = fill(text.call.sent, { label: labels[c.command] ?? c.command, ack: c.acknowledged === true ? text.call.ack : text.call.noAck });
  if (c.observation === 'unavailable' || !c.observed_state) return `${head} · ${text.call.stateUnread}`;
  const state = callWord(c.observed_state, text);
  return `${head} · ${fill(c.observation === 'unchanged' ? text.call.stateUnchanged : text.call.state, { state })}`;
}

const TTS_RANK = ['started', 'generating', 'speaking', 'completed', 'closed'];
const rank = (s: IntercomTtsStatus) => TTS_RANK.indexOf(s.state);

export interface ActionDeps {
  /** POST a door release (api/intercom.ts `releaseIntercomDoor`): resolves only on WisKey's acceptance, anything else throws. */
  release(stationId: string, lock: number): Promise<unknown>;
  /** POST a call signal (`signalIntercomCall`). */
  signal(stationId: string, command: IntercomCallCommand): Promise<{ call: IntercomCallResult | null }>;
  station(id: string): AccessStation | undefined;
  /** The feed is live and fresh: nothing physical is sent on a last-known copy. */
  live(): boolean;
  /** Wall clock (ms): hold deadlines. */
  now(): number;
  /** Monotonic clock (ms): the arming gap. */
  tick(): number;
  after(fn: () => void, ms: number): number;
  cancel(id: number): void;
  /** Something changed: re-render. */
  changed(): void;
  /** A call command was answered (or failed): read the stations again. */
  refetch(): void;
  /** The clock time shown in "sent" lines. */
  stamp(): string;
}

export interface Arm {
  id: string;
  command: IntercomCallCommand;
  at: number;
  callState: string;
}

export class StationActions {
  confirm: { stationId: string; lock: number } | null = null;
  releasing: ReadonlySet<string> = new Set();
  held: Readonly<Record<string, number>> = {};
  results: Readonly<Record<string, ActionResult>> = {};
  callBusy: ReadonlySet<string> = new Set();
  armed: Arm | null = null;
  tts: Readonly<Record<string, IntercomTtsStatus>> = {};
  private armTimer = 0;
  private holdTimer = 0;

  constructor(private deps: ActionDeps) {}

  dispose(): void {
    this.deps.cancel(this.armTimer);
    this.deps.cancel(this.holdTimer);
  }

  static key(stationId: string, lock: number): string {
    return `${stationId}/${lock}`;
  }

  isHeld(key: string): boolean {
    return (this.held[key] ?? 0) > this.deps.now();
  }

  setResult(stationId: string, tone: Tone, text: string): void {
    this.results = { ...this.results, [stationId]: { tone, text } };
    this.deps.changed();
  }

  clearResult(stationId: string): void {
    if (!(stationId in this.results)) return;
    const rest = { ...this.results };
    delete rest[stationId];
    this.results = rest;
    this.deps.changed();
  }

  // ------------------------------------------------------------------ door release

  /** Opens the confirmation step. Blocked while that relay's release is on its way or held after an unknown outcome. */
  askRelease(stationId: string, lock: number): boolean {
    const key = StationActions.key(stationId, lock);
    if (!this.deps.live() || this.releasing.has(key) || this.isHeld(key)) return false;
    this.confirm = { stationId, lock };
    this.deps.changed();
    return true;
  }

  cancelRelease(): void {
    if (!this.confirm) return;
    this.confirm = null;
    this.deps.changed();
  }

  /** Runs only from the confirmation step's own button: the release is never one click away, and it is sent exactly once. */
  async confirmRelease(): Promise<void> {
    const c = this.confirm;
    if (!c) return;
    const key = StationActions.key(c.stationId, c.lock);
    if (!this.deps.live() || this.releasing.has(key) || this.isHeld(key)) return;
    this.releasing = new Set([...this.releasing, key]);
    this.deps.changed();
    try {
      // a success reply always means `accepted: true` (anything else is raised as "outcome unknown" by the backend)
      await this.deps.release(c.stationId, c.lock);
      this.setResult(c.stationId, 'ok', fill(ws().door.sentAt, { at: this.deps.stamp() }));
    } catch (err) {
      const f = failure(err);
      this.setResult(c.stationId, f.tone, f.unknown ? ws().door.unknown : f.text);
      // an unknown outcome, or the backend saying an earlier release of this relay is still unresolved: wait it out
      if (f.unknown || (err instanceof ApiError && err.code === 'intercom_release_in_progress')) this.hold(key, holdMs(err));
    } finally {
      const next = new Set(this.releasing);
      next.delete(key);
      this.releasing = next;
      if (this.confirm === c) this.confirm = null;
      this.deps.changed();
    }
  }

  /** After an unknown outcome the relay's button waits (the backend holds the relay too): nobody fires a second release straight
   * into an ambiguous state. */
  private hold(key: string, ms: number): void {
    const until = this.deps.now() + ms;
    this.held = { ...this.held, [key]: Math.max(this.held[key] ?? 0, until) };
    this.deps.cancel(this.holdTimer);
    const live = Object.values(this.held).filter((t) => t > this.deps.now());
    if (live.length) {
      this.holdTimer = this.deps.after(() => {
        this.held = { ...this.held }; // re-render when one ends
        this.deps.changed();
      }, Math.min(...live) - this.deps.now() + 50);
    }
    this.deps.changed();
  }

  // ------------------------------------------------------------------ call controls (two taps)

  /** A call control's tap. The first arms the button for ARM_MS, the second sends. Lighter than the release dialog - the operator
   * is already dealing with a ringing call - but never a single stray gesture: the second click of a double-click (`detail > 1`)
   * and any tap sooner than ARM_MIN_MS after arming are ignored, and an arm is only good for the call state it was made in. */
  tapCall(stationId: string, command: IntercomCallCommand, clickDetail = 1): void {
    const s = this.deps.station(stationId);
    if (!s || this.callBusy.has(stationId) || !this.deps.live()) return;
    if (clickDetail > 1) return;
    const a = this.armed;
    if (a && a.id === stationId && a.command === command && a.callState === s.call_state) {
      if (this.deps.tick() - a.at < ARM_MIN_MS) return;
      this.deps.cancel(this.armTimer);
      this.armed = null;
      this.deps.changed();
      void this.sendCall(stationId, command);
      return;
    }
    this.deps.cancel(this.armTimer);
    this.armed = { id: stationId, command, at: this.deps.tick(), callState: s.call_state };
    this.armTimer = this.deps.after(() => {
      this.armed = null;
      this.deps.changed();
    }, ARM_MS);
    this.deps.changed();
  }

  /** An arm belongs to the call it was made for: when that station's call state changed (answered elsewhere, ended, went offline)
   * the arm is dropped - never left to fire against a call that no longer exists. */
  dropStaleArm(): void {
    const a = this.armed;
    if (!a) return;
    const s = this.deps.station(a.id);
    if (!this.deps.live() || !s || !s.online || s.call_state !== a.callState) {
      this.deps.cancel(this.armTimer);
      this.armed = null;
      this.deps.changed();
    }
  }

  private async sendCall(stationId: string, command: IntercomCallCommand): Promise<void> {
    this.callBusy = new Set([...this.callBusy, stationId]);
    this.deps.changed();
    try {
      const r = await this.deps.signal(stationId, command);
      if (r.call) this.setResult(stationId, r.call.acknowledged === true ? 'ok' : 'warn', callText(r.call));
    } catch (err) {
      const f = failure(err);
      this.setResult(stationId, f.tone, f.text);
    } finally {
      const next = new Set(this.callBusy);
      next.delete(stationId);
      this.callBusy = next;
      this.deps.changed();
      this.deps.refetch(); // the call state changed (or should have): the entry center refetches too
    }
  }

  // ------------------------------------------------------------------ announcement progress

  /** An announcement's progress (the POST reply, then `intercom_tts` notices); never steps back from a later state. */
  noteTts(status: IntercomTtsStatus): void {
    const seen = this.tts[status.station_id];
    if (seen && seen.at >= status.at && rank(seen) > rank(status)) return;
    this.tts = { ...this.tts, [status.station_id]: status };
    this.deps.changed();
  }
}
