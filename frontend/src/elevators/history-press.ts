/**
 * 2.9.0: the long press on an elevator card opens that elevator's history - the same gesture as the long press on an electrical device
 * (components/device-activity-press.ts): 500 ms, 8 px slop (movement cancels, so scroll wins), the click that follows a completed press is
 * swallowed, the touch context menu is suppressed. Keyboard / pointer alternatives: Alt+Enter, the menu key, Shift+F10 and a right click
 * (all open the history directly) and the visible history button of the card (`data-elevator-history`, a normal button).
 * One delegated controller per screen; it reads `data-elevator` of the composed path and never starts on a link or button.
 */
import type { ReactiveControllerHost } from 'lit';
import { LONG_PRESS_MS, PressController } from '../components/press-controller';

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

/** The card a press, a click or a menu gesture belongs to. */
interface ElevatorHit {
  id: string;
  el: HTMLElement;
}

/** A thin configuration of the shared long-press controller (components/press-controller.ts): it owns the listener set
 * (pointerdown / pointermove / pointerup / pointercancel, click, contextmenu, keydown), the timer and `swallowUntil`. */
export class ElevatorHistoryPress extends PressController<ElevatorHit> {
  constructor(host: ReactiveControllerHost & HTMLElement, private open: (id: string, opener: HTMLElement | null) => void) {
    super(host);
  }

  private find(e: Event): ElevatorHit | null {
    const path = e.composedPath() as unknown as (PressNode & HTMLElement)[];
    const id = elevatorIdOf(path);
    if (!id) return null;
    const el = path.find((n) => n.getAttribute?.('data-elevator') === id) as HTMLElement | undefined;
    return el ? { id, el } : null;
  }

  protected findPress(e: Event) {
    return this.find(e);
  }

  protected findMenu(e: Event) {
    return this.find(e);
  }

  protected longPress(s: ElevatorHit) {
    this.open(s.id, s.el);
  }

  /** Mouse / keyboard: the menu gesture opens the history directly (touch: the long press itself opens it). */
  protected contextMenu(_e: MouseEvent, hit: ElevatorHit) {
    this.open(hit.id, hit.el);
  }

  protected keyDown(e: KeyboardEvent) {
    const alt = e.key === 'Enter' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    const menu = e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey);
    if (!alt && !menu) return;
    const hit = this.find(e);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    this.open(hit.id, hit.el);
  }
}
