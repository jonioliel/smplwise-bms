/**
 * CR-015 S3: how a press on a remote control turns into key events - one small class shared by the d-pad, the rockers and
 * every other key. Pure TypeScript (events are read through structural types; the unit specs drive it with plain objects).
 *
 * - A pointer press fires at once (a physical remote answers on the down stroke); arrows and volume then repeat while held
 *   (HoldRepeater: 200 ms, at most 10 s) and stop on release, leave, cancel, blur or when the remote closes.
 * - A keyboard activation (Enter / Space on a focused control) behaves the same: down starts, up stops - the operating
 *   system's own key repeat is swallowed, so a held Enter can never outrun the hold cap.
 * - `click` with no pointer behind it (detail 0: a screen reader's activate, or a synthetic click) fires once; the click that
 *   follows a real pointer press is ignored (the down stroke already fired).
 */
import type { KeyId } from '../api/media-screens';
import { HoldRepeater, REAL_TIMERS, isRepeatable, type Timers } from './media-remote-logic';

export interface PointerLike {
  button?: number;
  pointerType?: string;
  preventDefault?: () => void;
}
export interface KeyLike {
  key: string;
  repeat?: boolean;
  preventDefault?: () => void;
}
export interface ClickLike {
  detail?: number;
}

export class KeyPress {
  private readonly holds = new Map<KeyId, HoldRepeater>();
  /** The key a pointer is holding (one at a time: a second pointer never starts a second repeat). */
  private held: KeyId | null = null;

  constructor(private readonly fire: (key: KeyId) => void, private readonly timers: Timers = REAL_TIMERS) {}

  private holder(key: KeyId): HoldRepeater {
    let h = this.holds.get(key);
    if (!h) {
      h = new HoldRepeater(() => this.fire(key), this.timers);
      this.holds.set(key, h);
    }
    return h;
  }

  /** Pointer down on a key's control. */
  down(e: PointerLike, key: KeyId): void {
    if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) return;
    e.preventDefault?.();
    this.stopAll();
    this.begin(key);
  }

  private begin(key: KeyId): void {
    this.held = key;
    if (isRepeatable(key)) this.holder(key).start();
    else this.fire(key);
  }

  /** Pointer up / cancel / leave, blur: the hold ends. */
  up(): void {
    this.stopAll();
  }

  /** A `click`: only one with no pointer behind it fires (keyboard-free assistive activation). */
  click(e: ClickLike, key: KeyId): void {
    if ((e.detail ?? 0) === 0 && this.held === null) this.fire(key);
  }

  keyDown(e: KeyLike, key: KeyId): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault?.(); // no native click, and no operating-system repeat of it
    if (e.repeat) return;
    this.stopAll();
    this.begin(key);
  }

  keyUp(e: KeyLike, key: KeyId): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault?.();
    if (this.held === key) this.stopAll();
  }

  /** The desktop keyboard's own keys (arrows, +/-): down starts (auto-repeat ignored), up stops. */
  global(key: KeyId, isDown: boolean, repeat = false): void {
    if (isDown) {
      if (repeat) return;
      this.stopAll();
      this.begin(key);
    } else if (this.held === key) this.stopAll();
  }

  stopAll(): void {
    for (const h of this.holds.values()) h.stop();
    this.held = null;
  }

  get holding(): KeyId | null {
    return this.held;
  }
}
