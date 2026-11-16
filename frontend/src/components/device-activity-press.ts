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
import type { ReactiveControllerHost } from 'lit';
import type { ActivityKind } from '../api/device-activity';
import { canAnywhere } from '../api/session';
import { deviceTicketsOn, directTab, longPressMode, pressPlan } from '../tickets/device-entry';
import { LONG_PRESS_MS, MOVE_SLOP_PX, PressController, exceedsSlop, type PressStart } from './press-controller';

export { LONG_PRESS_MS, MOVE_SLOP_PX, exceedsSlop };
export const OPEN_EVENT = 'sw-device-activity';

/** What the tile tells the popup (serialised into `data-activity`). */
export interface ActivityTarget {
  id: string;
  kind: ActivityKind;
  name: string;
  /** The tile's own state text ("דלוק 60%"). */
  state: string;
  /** CR-038 slice 3: false for a catalogued device the server does NOT track (no activity / schedules tabs: the tickets tab only).
   * Absent = tracked (every tag written before slice 3). */
  tracked?: boolean;
}

export type ActivityTab = 'activity' | 'schedules' | 'tickets';

export interface ActivityOpen {
  target: ActivityTarget;
  area?: string;
  tab: ActivityTab;
  /** When set the popup is not opened: the menu is shown at this point instead. */
  menu?: { x: number; y: number };
  /** CR-038 D17: the menu was opened by a long press (mode "menu") rather than by a right click / the menu key. */
  source?: 'press' | 'context';
  /** CR-038 slice 3: the tickets tab opens with the create form ("open a ticket" from the menu). */
  create?: boolean;
  /** CR-038 D17 "open the device": the host's own "open" tap action (a plain row pill), when it has one. */
  openDevice?: () => void;
  /** The element to give focus back to. */
  opener?: HTMLElement | null;
}

/** The value of a tile's `data-activity` attribute, or `nothing`-like undefined when the tile has no long press. A tracked device (the
 * server's `activity` flag) as before; CR-038 slice 3: with the tickets module on (and tickets.view + devices.read) EVERY catalogued row
 * gets one too, marked `tracked: false` (its window has the tickets tab only - tickets/device-entry.ts). */
export function activityTag(r: { entity_id: string; name: string; activity?: boolean; activity_kind?: ActivityKind | null; activity_permissions?: string[] }, state = '', held: (p: string) => boolean = canAnywhere, ticketsOn: boolean = deviceTicketsOn(held)): string | undefined {
  // a lock / alarm panel: the server names the permissions that operate it; none held = no entry (the routes would answer 403 / 404)
  if (r.activity_permissions?.length && !r.activity_permissions.some(held)) return undefined;
  if (!r.activity) {
    if (!ticketsOn) return undefined;
    return JSON.stringify({ id: r.entity_id, kind: 'generic', name: r.name, state, tracked: false } satisfies ActivityTarget);
  }
  const t: ActivityTarget = { id: r.entity_id, kind: r.activity_kind ?? 'generic', name: r.name, state };
  return JSON.stringify(t);
}

export function parseTag(raw: string | null | undefined): ActivityTarget | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<ActivityTarget>;
    if (!t.id) return null;
    const out: ActivityTarget = { id: t.id, kind: t.kind ?? 'generic', name: t.name ?? '', state: t.state ?? '' };
    if (t.tracked === false) out.tracked = false;
    return out;
  } catch {
    return null;
  }
}

/** CR-038 D17: a host row whose tap OPENS something (a plain row pill fires `activate`) - "open the device" replays that; a toggle never. */
export function opensOnTap(el: { tagName?: string; getAttribute?: (n: string) => string | null } | null | undefined): boolean {
  if (!el || (el.tagName ?? '').toLowerCase() !== 'sw-pill') return false;
  return (el.getAttribute?.('variant') ?? 'plain') === 'plain';
}

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

/** The tile a press, a click or a menu gesture belongs to. */
interface ActivityHit {
  el: HTMLElement;
  target: ActivityTarget;
}

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export class ActivityPress extends PressController<ActivityHit> {
  private ring: Animation | null = null;

  constructor(host: ReactiveControllerHost & HTMLElement, private opts: { area?: () => string } = {}) {
    super(host);
  }

  protected findPress(e: Event) {
    return this.find(e);
  }

  protected findMenu(e: Event) {
    return this.find(e, true);
  }

  protected pressStarted(hit: ActivityHit) {
    this.startRing(hit.el);
  }

  protected pressEnded(completed: boolean) {
    this.endRing(completed);
  }

  private find(e: Event, menuLike = false): ActivityHit | null {
    const hit = activityNodeOf(e.composedPath() as unknown as PathNode[], { allowArrange: menuLike, anyControl: menuLike });
    return hit ? { el: hit.node as unknown as HTMLElement, target: hit.target } : null;
  }

  private emit(detail: ActivityOpen) {
    window.dispatchEvent(new CustomEvent<ActivityOpen>(OPEN_EVENT, { detail: { ...detail, area: this.opts.area?.() } }));
  }

  protected longPress(s: PressStart<ActivityHit>) {
    // CR-038 D17: the long press follows the installation's setting (tickets/device-entry.ts pressPlan - the matrix of section 12.1)
    const plan = pressPlan({ tracked: s.target.tracked !== false, on: deviceTicketsOn(), mode: longPressMode() });
    if (!plan) return;
    if (plan.kind === 'menu') {
      const r = s.el.getBoundingClientRect();
      const menu = s.type === 'mouse' ? { x: s.x, y: s.y } : { x: Math.min(s.x, r.right), y: Math.min(s.y + 8, r.bottom) };
      this.emit({ target: s.target, tab: 'activity', menu, source: 'press', openDevice: this.opener(s.el), opener: s.el });
      return;
    }
    this.emit({ target: s.target, tab: plan.tab, opener: s.el });
  }

  /** "Open the device" (D17): the host's own "open" action of a plain row pill, replayed without the long press's click guard. */
  private opener(el: HTMLElement): (() => void) | undefined {
    if (!opensOnTap(el)) return undefined;
    return () => {
      this.swallowUntil = 0;
      el.dispatchEvent(new CustomEvent('activate', { bubbles: true, composed: true }));
    };
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

  protected contextMenu(e: MouseEvent, hit: ActivityHit) {
    const keyboard = e.detail === 0 || (e.clientX === 0 && e.clientY === 0);
    const r = hit.el.getBoundingClientRect();
    const menu = keyboard ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY };
    this.emit({ target: hit.target, tab: 'activity', menu, source: 'context', openDevice: this.opener(hit.el), opener: hit.el });
  }

  protected keyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter' || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const hit = this.find(e, true);
    if (!hit) return;
    const tab = directTab({ tracked: hit.target.tracked !== false, on: deviceTicketsOn() });
    if (!tab) return;
    e.preventDefault();
    e.stopPropagation();
    this.emit({ target: hit.target, tab, opener: hit.el });
  }
}
