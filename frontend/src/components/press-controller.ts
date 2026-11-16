/**
 * The generic long-press controller (code review 08:F15): the listener set and the state machine that the device activity
 * press (components/device-activity-press.ts) and the elevator history press (elevators/history-press.ts) each carried.
 *
 * One delegated controller per screen. It listens on the host element (capture phase for the pointer, click and context
 * menu events), asks the subclass which item an event belongs to, and runs the timer: threshold 500 ms, 8 px slop (movement
 * beyond it cancels, so scroll and drag win), `pointercancel` cancels, the click that follows a completed long press is
 * swallowed, the touch context menu is suppressed (the long press itself is the gesture). What a completed press, a right
 * click / menu key and a key do is the subclass's: it is a thin configuration of this class.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export const LONG_PRESS_MS = 500;
export const MOVE_SLOP_PX = 8;
/** How long after a completed long press the click that ends it is swallowed. */
const SWALLOW_MS = 800;

/** True when the pointer has moved past the slop. */
export const exceedsSlop = (dx: number, dy: number, slop = MOVE_SLOP_PX) => dx * dx + dy * dy > slop * slop;

/** What a press started on: the item the subclass found, where the pointer went down and with which pointer type. */
export type PressStart<H> = H & { x: number; y: number; type: string };

export abstract class PressController<H extends { el: HTMLElement }> implements ReactiveController {
  private timer: number | undefined;
  private start: PressStart<H> | null = null;
  protected swallowUntil = 0;
  private lastType = 'mouse';

  constructor(protected host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
  }

  /** The item a press may start on, or null (a control with a gesture of its own, no item under the pointer). */
  protected abstract findPress(e: Event): H | null;
  /** The item of a click, a context menu or a key (a subclass may be more permissive here than for a press). */
  protected abstract findMenu(e: Event): H | null;
  /** The press was held for LONG_PRESS_MS without leaving the slop. */
  protected abstract longPress(s: PressStart<H>): void;
  /** A right click, the menu key or Shift+F10 on an item (never after a touch / pen press: that is the long press). */
  protected abstract contextMenu(e: MouseEvent, hit: H): void;
  /** A key pressed on the host: the subclass decides which keys are its alternatives. */
  protected abstract keyDown(e: KeyboardEvent): void;
  /** A press started on `hit` (the timer runs): e.g. start a progress ring. */
  protected pressStarted(_hit: H): void {}
  /** The press that started ended: completed (the long press fires next) or cancelled. */
  protected pressEnded(_completed: boolean): void {}

  hostConnected() {
    const h = this.host;
    h.addEventListener('pointerdown', this.down, true);
    h.addEventListener('pointermove', this.move, true);
    h.addEventListener('pointerup', this.up, true);
    h.addEventListener('pointercancel', this.up, true);
    h.addEventListener('click', this.click, true);
    h.addEventListener('contextmenu', this.ctx, true);
    h.addEventListener('keydown', this.key);
  }

  hostDisconnected() {
    const h = this.host;
    h.removeEventListener('pointerdown', this.down, true);
    h.removeEventListener('pointermove', this.move, true);
    h.removeEventListener('pointerup', this.up, true);
    h.removeEventListener('pointercancel', this.up, true);
    h.removeEventListener('click', this.click, true);
    h.removeEventListener('contextmenu', this.ctx, true);
    h.removeEventListener('keydown', this.key);
    this.cancel();
  }

  private down = (e: PointerEvent) => {
    this.lastType = e.pointerType || 'mouse';
    this.cancel();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.isPrimary) return;
    const hit = this.findPress(e);
    if (!hit) return;
    this.start = { ...hit, x: e.clientX, y: e.clientY, type: e.pointerType };
    this.pressStarted(hit);
    this.timer = window.setTimeout(() => this.fire(), LONG_PRESS_MS);
  };

  private move = (e: PointerEvent) => {
    if (!this.start || this.timer === undefined) return;
    if (exceedsSlop(e.clientX - this.start.x, e.clientY - this.start.y)) this.cancel();
  };

  private up = () => {
    this.cancel();
  };

  private fire() {
    const s = this.start;
    this.timer = undefined;
    if (!s) return;
    this.swallowUntil = Date.now() + SWALLOW_MS;
    try {
      navigator.vibrate?.(10);
    } catch {
      /* no haptics */
    }
    this.pressEnded(true);
    this.start = null;
    this.longPress(s);
  }

  private cancel() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    if (this.start) this.pressEnded(false);
    this.start = null;
  }

  /** The click that ends a completed long press must not act on the item. */
  private click = (e: MouseEvent) => {
    if (Date.now() < this.swallowUntil && this.findMenu(e)) {
      e.stopPropagation();
      e.preventDefault();
      this.swallowUntil = 0;
    }
  };

  private ctx = (e: MouseEvent) => {
    const hit = this.findMenu(e);
    if (!hit) return;
    // touch / pen: the browser's own menu would appear beside the press; the long press itself is the gesture
    e.preventDefault();
    if (this.lastType === 'touch' || this.lastType === 'pen') return;
    this.cancel();
    this.lastType = 'mouse';
    this.contextMenu(e, hit);
  };

  private key = (e: KeyboardEvent) => this.keyDown(e);
}
