/**
 * CR-032 device activity: the long-press (and its accessible alternatives) that opens the activity popup of an electrical device.
 *
 * One delegated controller per screen (`new ActivityPress(this)`): it listens on the host element, finds the tile / row / pill that
 * carries `data-activity` (the server's `activity` flag, written by `activityTag`) in the composed event path, and never guesses from a
 * name or an icon. Threshold 500 ms, 8 px slop (movement beyond it cancels, so scroll and drag win), the click that follows a completed
 * long press is swallowed (the device is NOT toggled), a normal tap is untouched. Alternatives: right click, the menu key and Shift+F10
 * open a two-item menu ("פעילות", "תזמונים"); Alt+Enter opens the popup directly. Never started on a control with a gesture of its own
 * (slider, toggle, button, input) nor in a screen's arrange mode (the drag wins; the menu still works there).
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { ActivityKind } from '../api/device-activity';

export const LONG_PRESS_MS = 500;
export const MOVE_SLOP_PX = 8;
export const OPEN_EVENT = 'sw-device-activity';

/** What the tile tells the popup (serialised into `data-activity`). */
export interface ActivityTarget {
  id: string;
  kind: ActivityKind;
  name: string;
  /** The tile's own state text ("דלוק 60%"). */
  state: string;
}

export interface ActivityOpen {
  target: ActivityTarget;
  area?: string;
  tab: 'activity' | 'schedules';
  /** When set the popup is not opened: a two-item menu is shown at this point instead. */
  menu?: { x: number; y: number };
  /** The element to give focus back to. */
  opener?: HTMLElement | null;
}

/** The value of a tile's `data-activity` attribute, or `nothing`-like undefined when the server did not flag the entity. */
export function activityTag(r: { entity_id: string; name: string; activity?: boolean; activity_kind?: ActivityKind | null }, state = ''): string | undefined {
  if (!r.activity) return undefined;
  const t: ActivityTarget = { id: r.entity_id, kind: r.activity_kind ?? 'other', name: r.name, state };
  return JSON.stringify(t);
}

export function parseTag(raw: string | null | undefined): ActivityTarget | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<ActivityTarget>;
    return t.id ? { id: t.id, kind: t.kind ?? 'other', name: t.name ?? '', state: t.state ?? '' } : null;
  } catch {
    return null;
  }
}

/** True when the pointer has moved past the slop. */
export const exceedsSlop = (dx: number, dy: number, slop = MOVE_SLOP_PX) => dx * dx + dy * dy > slop * slop;

/** The structural part of a node the path logic reads (so the unit specs can pass plain objects). */
export interface PathNode {
  tagName?: string;
  getAttribute?: (n: string) => string | null;
  hasAttribute?: (n: string) => boolean;
  classList?: { contains: (c: string) => boolean };
  shadowRoot?: unknown;
  getRootNode?: () => unknown;
}

const OWN_GESTURE = /slider|toggle|dropdown|switch|range/i;

/** Does this node, sitting between the pointer and the tile, carry a gesture of its own? */
function blocks(n: PathNode, own: boolean): boolean {
  const tag = (n.tagName ?? '').toLowerCase();
  if (!tag) return false;
  const role = n.getAttribute?.('role') ?? '';
  if (role === 'slider' || role === 'switch' || role === 'spinbutton') return true;
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return true;
  if (n.hasAttribute?.('data-no-activity')) return true;
  if (tag.startsWith('sw-') && OWN_GESTURE.test(tag)) return true;
  if (own) return false; // inside the tile's own shadow tree a button is the tile body (a pill)
  if (tag === 'button' || tag === 'a' || tag === 'sw-button' || role === 'button' || role === 'menuitem') return true;
  return false;
}

/**
 * The tile an event belongs to, or null: the first node of the composed path that carries `data-activity`, provided no control with a
 * gesture of its own (slider, toggle, button, field) sits between the pointer and it, and the tile is not in an arrange (edit) mode.
 */
export function activityNodeOf(path: PathNode[], opts: { allowArrange?: boolean; anyControl?: boolean } = {}): { node: PathNode; target: ActivityTarget } | null {
  for (let i = 0; i < path.length; i++) {
    const n = path[i];
    const raw = n.getAttribute?.('data-activity') ?? null;
    if (raw === null) continue;
    const target = parseTag(raw);
    if (!target) return null;
    const own = (n as { shadowRoot?: unknown }).shadowRoot ?? null;
    for (let j = 0; j < i && !opts.anyControl; j++) {
      const m = path[j];
      const inOwn = own !== null && (m.getRootNode?.() ?? null) === own;
      if (blocks(m, inOwn)) return null;
    }
    if (!opts.allowArrange) {
      for (let j = i; j < path.length; j++) if (path[j].classList?.contains('lay-tedit') || path[j].hasAttribute?.('data-lay-tpos')) return null;
    }
    return { node: n, target };
  }
  return null;
}

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export class ActivityPress implements ReactiveController {
  private timer: number | undefined;
  private start: { x: number; y: number; el: HTMLElement; target: ActivityTarget; type: string } | null = null;
  private swallowUntil = 0;
  private lastType = 'mouse';
  private ring: Animation | null = null;

  constructor(private host: ReactiveControllerHost & HTMLElement, private opts: { area?: () => string } = {}) {
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

  private find(e: Event, menuLike = false) {
    const hit = activityNodeOf(e.composedPath() as unknown as PathNode[], { allowArrange: menuLike, anyControl: menuLike });
    return hit ? { el: hit.node as unknown as HTMLElement, target: hit.target } : null;
  }

  private emit(detail: ActivityOpen) {
    window.dispatchEvent(new CustomEvent<ActivityOpen>(OPEN_EVENT, { detail: { ...detail, area: this.opts.area?.() } }));
  }

  private down = (e: PointerEvent) => {
    this.lastType = e.pointerType || 'mouse';
    this.cancel();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.isPrimary) return;
    const hit = this.find(e);
    if (!hit) return;
    this.start = { x: e.clientX, y: e.clientY, el: hit.el, target: hit.target, type: e.pointerType };
    this.startRing(hit.el);
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
    this.swallowUntil = Date.now() + 800;
    try {
      navigator.vibrate?.(10);
    } catch {
      /* no haptics */
    }
    this.endRing(true);
    this.start = null;
    this.emit({ target: s.target, tab: 'activity', opener: s.el });
  }

  private cancel() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    if (this.start) this.endRing(false);
    this.start = null;
  }

  private startRing(el: HTMLElement) {
    try {
      const ring = '0 0 0 2px var(--sw-accent, #2563eb)';
      const still = reduced();
      this.ring = el.animate(
        still
          ? [{ boxShadow: 'none' }, { boxShadow: 'none', offset: 0.99 }, { boxShadow: ring }]
          : [{ transform: 'scale(1)', boxShadow: 'none' }, { transform: 'scale(.98)', boxShadow: ring }],
        { delay: 120, duration: LONG_PRESS_MS - 120, easing: 'linear', fill: 'both' },
      );
    } catch {
      this.ring = null;
    }
  }

  private endRing(completed: boolean) {
    const r = this.ring;
    this.ring = null;
    if (!r) return;
    if (completed) window.setTimeout(() => r.cancel(), 160);
    else r.cancel();
  }

  /** The click that ends a completed long press must not toggle the device. */
  private click = (e: MouseEvent) => {
    if (Date.now() < this.swallowUntil && this.find(e, true)) {
      e.stopPropagation();
      e.preventDefault();
      this.swallowUntil = 0;
    }
  };

  private ctx = (e: MouseEvent) => {
    const hit = this.find(e, true);
    if (!hit) return;
    if (this.lastType === 'touch' || this.lastType === 'pen') {
      // the browser's own menu would appear beside the ring; the long press itself opens the popup
      e.preventDefault();
      return;
    }
    e.preventDefault();
    this.cancel();
    const keyboard = e.detail === 0 || (e.clientX === 0 && e.clientY === 0);
    const r = hit.el.getBoundingClientRect();
    const menu = keyboard ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY };
    this.lastType = 'mouse';
    this.emit({ target: hit.target, tab: 'activity', menu, opener: hit.el });
  };

  private key = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const hit = this.find(e, true);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    this.emit({ target: hit.target, tab: 'activity', opener: hit.el });
  };
}
