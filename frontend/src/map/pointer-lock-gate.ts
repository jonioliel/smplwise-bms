/**
 * Plan Studio 6, slice S5-B (CR-029 section 4.5, docs/changes/CR-029-ST7-S5B-NOTES.md): pointer lock as an opt-in that degrades
 * quietly. The product runs inside a Home Assistant Ingress `<iframe>`; whether the embedding frame lets the page lock the pointer
 * (the frame's sandbox flags, its permission policy, a browser that has the API but refuses without a gesture) is not ours to
 * know in advance and not ours to fix. So mouse-look is drag by default, pointer lock is a setting (`plan.view mouse_mode`
 * `lock` / `auto`), and wherever the platform says no the walk stays on drag - no error, no dead control, no second try.
 *
 * What the gate does, with every platform call injected (`LockEnv`) so a unit test can play each refusal:
 *  - `blocked`: why pointer lock cannot work here, or null. Known without trying: the API is missing; the page runs in a frame
 *    whose readable `sandbox` attribute lacks `allow-pointer-lock`; a refusal was seen earlier in this tab session.
 *  - `effectiveMode(mode)`: the mouse mode to hand to the walk - `lock` / `auto` become `drag` while `blocked`.
 *  - `attach()`: listens for `pointerlockerror` on the document, so a refusal of ANY request (the walk makes its own) is learned
 *    once, remembered for the tab session and reported through `onRefused` - the element then moves the running walk to drag.
 *  - `request(target)`: for a caller that asks through the gate - resolves, never rejects, never throws: `locked`, `refused`
 *    (a synchronous SecurityError, a rejected promise, the `pointerlockerror` event, or nothing at all within `LOCK_WAIT_MS`)
 *    or `blocked` (no request made).
 * It holds no pointer-lock state of its own beyond the refusal memory; the walk still owns look and movement.
 */
import type { MouseMode } from '../api/plan-view';

export type RefusalReason = 'unsupported' | 'frame-sandbox' | 'refused';
export type LockVerdict = { state: 'locked' } | { state: 'refused'; reason: RefusalReason } | { state: 'blocked'; reason: RefusalReason };

/** How long a request may stay silent (no `pointerlockchange`, no `pointerlockerror`) before it counts as refused. */
export const LOCK_WAIT_MS = 1200;
export const LOCK_REFUSED_KEY = 'sw.plan3d.lockrefused';

export interface LockDocument {
  addEventListener(type: 'pointerlockchange' | 'pointerlockerror', fn: () => void): void;
  removeEventListener(type: 'pointerlockchange' | 'pointerlockerror', fn: () => void): void;
  readonly pointerLockElement: unknown;
}
export interface LockTarget {
  requestPointerLock?: () => unknown;
}
/** What the page can read of the frame it runs in: the sandbox tokens (null = the iframe has no sandbox attribute). */
export interface FrameInfo {
  sandbox: string[] | null;
}
export interface LockEnv {
  doc: LockDocument;
  /** The embedding frame when the page can read it (same origin), else null - top level and cross-origin look alike. */
  frame(): FrameInfo | null;
  /** The platform has the API at all. */
  supported(): boolean;
  /** The tab session's memory of a refusal. */
  store: { get(): string | null; set(v: string | null): void };
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

/** The browser's own environment. Storage failures (private mode) fall back to an in-page memory. */
export function browserLockEnv(): LockEnv {
  let memory: string | null = null;
  return {
    doc: document as unknown as LockDocument,
    frame: () => {
      try {
        if (window.self === window.top) return null;
        const fe = window.frameElement; // null for a cross-origin parent: unknown, so the request decides
        if (!fe) return null;
        const attr = fe.getAttribute('sandbox');
        return { sandbox: attr === null ? null : attr.split(/\s+/).filter(Boolean) };
      } catch {
        return null;
      }
    },
    supported: () => typeof Element !== 'undefined' && typeof Element.prototype.requestPointerLock === 'function',
    store: {
      get: () => {
        try {
          return sessionStorage.getItem(LOCK_REFUSED_KEY) ?? memory;
        } catch {
          return memory;
        }
      },
      set: (v) => {
        memory = v;
        try {
          if (v === null) sessionStorage.removeItem(LOCK_REFUSED_KEY);
          else sessionStorage.setItem(LOCK_REFUSED_KEY, v);
        } catch {
          /* private mode: the memory above holds it for this page */
        }
      },
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
  };
}

const isReason = (v: unknown): v is RefusalReason => v === 'unsupported' || v === 'frame-sandbox' || v === 'refused';

export class PointerLockGate {
  private attached = 0;
  private reported = false;
  /** The lock was acquired at least once in this page: a later `pointerlockerror` is then the browser's own cool-down after an
   * Esc (Chrome refuses a request made right after the person left the lock), not a frame that forbids it - never remembered. */
  private lockedOnce = false;

  constructor(
    private readonly env: LockEnv = browserLockEnv(),
    private readonly onRefused?: (reason: RefusalReason) => void,
  ) {}

  /** Why pointer lock cannot work here (null = worth asking). Cheap: read on every walk start and every request. */
  get blocked(): RefusalReason | null {
    if (!this.env.supported()) return 'unsupported';
    const f = this.env.frame();
    if (f && f.sandbox && !f.sandbox.includes('allow-pointer-lock')) return 'frame-sandbox';
    const seen = this.env.store.get();
    return isReason(seen) ? seen : null;
  }

  /** The mouse mode the walk should run with: `lock` and `auto` degrade to `drag` while pointer lock is blocked. */
  effectiveMode(mode: MouseMode): MouseMode {
    return mode !== 'drag' && this.blocked ? 'drag' : mode;
  }

  /** Start listening for refusals made by anyone's request; returns the stop function. Several attaches share the listeners. */
  attach(): () => void {
    if (this.attached++ === 0) {
      this.env.doc.addEventListener('pointerlockerror', this.onError);
      this.env.doc.addEventListener('pointerlockchange', this.onChange);
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      if (--this.attached === 0) {
        this.env.doc.removeEventListener('pointerlockerror', this.onError);
        this.env.doc.removeEventListener('pointerlockchange', this.onChange);
      }
    };
  }

  /** Forget a remembered refusal (a new tab session starts clean on its own; this is for tests and an explicit retry). */
  reset(): void {
    this.env.store.set(null);
    this.reported = false;
  }

  /** Ask for the lock on `target`. Never throws, never rejects: a refusal in any of its forms is a verdict. */
  request(target: LockTarget): Promise<LockVerdict> {
    const blocked = this.blocked;
    if (blocked) return Promise.resolve({ state: 'blocked', reason: blocked });
    const ask = target.requestPointerLock;
    if (typeof ask !== 'function') return Promise.resolve(this.refuse('unsupported'));
    const { doc } = this.env;
    return new Promise<LockVerdict>((resolve) => {
      let timer: unknown = null;
      let done = false;
      const finish = (v: LockVerdict): void => {
        if (done) return;
        done = true;
        doc.removeEventListener('pointerlockchange', onChange);
        doc.removeEventListener('pointerlockerror', onError);
        if (timer !== null) this.env.clearTimeout(timer);
        resolve(v);
      };
      const onChange = (): void => {
        if (doc.pointerLockElement === target) {
          this.lockedOnce = true;
          finish({ state: 'locked' });
        }
      };
      const onError = (): void => finish(this.refuse('refused'));
      doc.addEventListener('pointerlockchange', onChange);
      doc.addEventListener('pointerlockerror', onError);
      timer = this.env.setTimeout(() => finish(this.refuse('refused')), LOCK_WAIT_MS);
      try {
        const r = ask.call(target) as { then?: (a: () => void, b: () => void) => unknown } | undefined;
        if (r && typeof r.then === 'function') {
          r.then(
            () => {
              if (doc.pointerLockElement === target) {
                this.lockedOnce = true;
                finish({ state: 'locked' });
              }
            },
            () => finish(this.refuse('refused')),
          );
        }
      } catch {
        finish(this.refuse('refused')); // a synchronous SecurityError / InvalidStateError
      }
    });
  }

  private readonly onError = (): void => {
    this.refuse('refused');
  };

  private readonly onChange = (): void => {
    if (this.env.doc.pointerLockElement) this.lockedOnce = true;
  };

  /** Remember a refusal for the tab session and tell the owner once - unless the lock has worked in this page before, when an
   * error is the browser's cool-down and the next request may well succeed. */
  private refuse(reason: RefusalReason): LockVerdict {
    if (this.lockedOnce && reason === 'refused') return { state: 'refused', reason };
    if (!isReason(this.env.store.get())) this.env.store.set(reason);
    if (!this.reported) {
      this.reported = true;
      this.onRefused?.(reason);
    }
    return { state: 'refused', reason };
  }
}
