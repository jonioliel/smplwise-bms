/**
 * 2.9.0: the long press on an elevator card opens that elevator's history - the same gesture as the long press on an electrical device
 * (components/device-activity-press.ts): 500 ms, 8 px slop (movement cancels, so scroll wins), the click that follows a completed press is
 * swallowed, the touch context menu is suppressed. Keyboard / pointer alternatives: Alt+Enter, the menu key, Shift+F10 and a right click
 * (all open the history directly) and the visible history button of the card (`data-elevator-history`, a normal button).
 * One delegated controller per screen; it reads `data-elevator` of the composed path and never starts on a link or button.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LONG_PRESS_MS, exceedsSlop } from '../components/device-activity-press';

export { LONG_PRESS_MS };

/** The structural part of a node the path logic reads (plain objects in the unit specs). */
export interface PressNode {
  tagName?: string;
  getAttribute?: (n: string) => string | null;
}

/** The elevator id of the card an event belongs to, or null: the first `data-elevator` in the path, none when a link / button / field sits between. */
export function elevatorIdOf(path: readonly PressNode[]): string | null {
  for (const n of path) {
    const id = n.getAttribute?.('data-elevator') ?? null;
    if (id) return id;
    const tag = (n.tagName ?? '').toLowerCase();
    const role = n.getAttribute?.('role') ?? '';
    if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea' || role === 'button') return null;
  }
  return null;
}

export class ElevatorHistoryPress implements ReactiveController {
  private timer: number | undefined;
  private start: { x: number; y: number; id: string; el: HTMLElement } | null = null;
  private swallowUntil = 0;
  private lastType = 'mouse';

  constructor(private host: ReactiveControllerHost & HTMLElement, private open: (id: string, opener: HTMLElement | null) => void) {
    host.addController(this);
  }

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

  private find(e: Event) {
    const path = e.composedPath() as unknown as (PressNode & HTMLElement)[];
    const id = elevatorIdOf(path);
    if (!id) return null;
    const el = path.find((n) => n.getAttribute?.('data-elevator') === id) as HTMLElement | undefined;
    return el ? { id, el } : null;
  }

  private down = (e: PointerEvent) => {
    this.lastType = e.pointerType || 'mouse';
    this.cancel();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.isPrimary) return;
    const hit = this.find(e);
    if (!hit) return;
    this.start = { x: e.clientX, y: e.clientY, ...hit };
    this.timer = window.setTimeout(() => this.fire(), LONG_PRESS_MS);
  };

  private move = (e: PointerEvent) => {
    if (!this.start || this.timer === undefined) return;
    if (exceedsSlop(e.clientX - this.start.x, e.clientY - this.start.y)) this.cancel();
  };

  private up = () => this.cancel();

  private fire() {
    const s = this.start;
    this.timer = undefined;
    this.start = null;
    if (!s) return;
    this.swallowUntil = Date.now() + 800;
    try {
      navigator.vibrate?.(10);
    } catch {
      /* no haptics */
    }
    this.open(s.id, s.el);
  }

  private cancel() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.start = null;
  }

  private click = (e: MouseEvent) => {
    if (Date.now() < this.swallowUntil && this.find(e)) {
      e.stopPropagation();
      e.preventDefault();
      this.swallowUntil = 0;
    }
  };

  private ctx = (e: MouseEvent) => {
    const hit = this.find(e);
    if (!hit) return;
    e.preventDefault(); // touch: the long press itself opens the history; mouse / keyboard: the menu gesture opens it directly
    if (this.lastType === 'touch' || this.lastType === 'pen') return;
    this.cancel();
    this.lastType = 'mouse';
    this.open(hit.id, hit.el);
  };

  private key = (e: KeyboardEvent) => {
    const alt = e.key === 'Enter' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    const menu = e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey);
    if (!alt && !menu) return;
    const hit = this.find(e);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    this.open(hit.id, hit.el);
  };
}
