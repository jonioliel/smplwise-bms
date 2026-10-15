/**
 * 2.5.5: ONE placement helper for the menus of the Tickets module that open from inside a scrolling box (the cells of the table): the menu is
 * rendered OUTSIDE the scroll container, in the browser's top layer (`popover="manual"`), so no ancestor `overflow` can clip it and no
 * `backdrop-filter` ancestor can capture its fixed box. This file only computes where it goes: below the trigger when it fits, above it when
 * that side is roomier, and a `max-height` (the menu then scrolls inside itself) only when it is taller than the side it sits on. It grows from
 * the trigger's inline-start edge (RTL: to the left) and is clamped to the viewport.
 */
export interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface Placement {
  top: number;
  left: number;
  /** the height limit to apply (the menu scrolls inside it); equals the natural height when the menu fits whole */
  maxHeight: number;
  flipped: boolean;
  scrolls: boolean;
}

export const OVERLAY_GAP = 4;
export const OVERLAY_PAD = 8;

export function placeOverlay(
  anchor: Box,
  size: { w: number; h: number },
  vp: { w: number; h: number },
  rtl: boolean,
  gap = OVERLAY_GAP,
  pad = OVERLAY_PAD,
): Placement {
  const w = Math.min(size.w, Math.max(0, vp.w - 2 * pad));
  let left = rtl ? anchor.right - w : anchor.left;
  left = Math.max(pad, Math.min(left, vp.w - pad - w));
  const below = Math.max(0, vp.h - pad - (anchor.bottom + gap));
  const above = Math.max(0, anchor.top - gap - pad);
  const h = size.h;
  if (h <= below) return { top: anchor.bottom + gap, left, maxHeight: h, flipped: false, scrolls: false };
  if (h <= above) return { top: anchor.top - gap - h, left, maxHeight: h, flipped: true, scrolls: false };
  const flipped = above > below;
  const room = flipped ? above : below;
  const maxHeight = Math.max(0, Math.min(h, room));
  return { top: flipped ? anchor.top - gap - maxHeight : anchor.bottom + gap, left, maxHeight, flipped, scrolls: maxHeight < h };
}

type PopEl = HTMLElement & { showPopover?: () => void; hidePopover?: () => void };

/** Show `pop` (a `popover="manual"` element) and put it next to `anchor`. Safe to call again after the content changed (a list that arrived). */
export function openOverlay(pop: HTMLElement, anchor: HTMLElement): Placement {
  const el = pop as PopEl;
  try {
    if (!el.matches(':popover-open')) el.showPopover?.();
  } catch {
    /* no popover API (or already open): the element is then a plain fixed box */
  }
  pop.style.maxBlockSize = 'none';
  pop.style.top = '0px';
  pop.style.left = '0px';
  const natural = { w: pop.offsetWidth, h: pop.offsetHeight };
  const r = anchor.getBoundingClientRect();
  const doc = document.documentElement;
  const vp = { w: doc.clientWidth || window.innerWidth, h: window.innerHeight || doc.clientHeight };
  const rtl = getComputedStyle(anchor).direction === 'rtl';
  const p = placeOverlay(r, natural, vp, rtl);
  pop.style.top = `${Math.round(p.top)}px`;
  pop.style.left = `${Math.round(p.left)}px`;
  pop.style.maxBlockSize = `${Math.floor(p.maxHeight)}px`;
  pop.toggleAttribute('data-scrolls', p.scrolls);
  pop.toggleAttribute('data-flipped', p.flipped);
  return p;
}

/** Arrow keys inside an open menu move between its items. */
export function menuKey(e: KeyboardEvent, pop: HTMLElement): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
  const items = [...pop.querySelectorAll<HTMLElement>('button:not([disabled])')];
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf((pop.getRootNode() as ShadowRoot | Document).activeElement as HTMLElement);
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
  items[n].focus();
}
