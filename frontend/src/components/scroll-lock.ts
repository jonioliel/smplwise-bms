/**
 * UIJANK-293: the ONE scroll lock behind every modal overlay (sw-drawer `modal` today; any new overlay uses it too).
 *
 * While an overlay is open the scroll containers behind it stop scrolling (review M2: a wheel or a touch over the dimmed page never
 * moves the screen behind), and the page behind must not move by a single pixel - neither when the overlay opens nor when it closes:
 *   - only `overflow` is switched to `hidden` (never `position: fixed` + a negative `top`, never a padding): the scroll offset stays
 *     exactly where it was, and nothing has to be restored by script on close;
 *   - a container that shows a classic scrollbar (Windows, Linux) keeps its gutter (`scrollbar-gutter: stable` while locked):
 *     hiding the overflow otherwise drops the scrollbar, the content box widens by its width and the whole page re-flows sideways
 *     (the owner's "the page jumps when a drawer opens", 2.9.3);
 *   - one reference count per container, shared by every overlay: the inline values are saved by the FIRST lock and restored by the
 *     LAST release (two overlapping drawers once left a container locked for good).
 */
interface Lock {
  n: number;
  overflow: string;
  gutter: string;
}

const locks = new Map<HTMLElement, Lock>();

/** The width of the classic (space-taking) vertical scrollbar `el` shows now; 0 with overlay scrollbars or no scrollbar. */
export function scrollbarWidth(el: HTMLElement): number {
  if (el === document.documentElement) return Math.max(0, window.innerWidth - el.clientWidth);
  const cs = getComputedStyle(el);
  const borders = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
  return Math.max(0, el.offsetWidth - el.clientWidth - borders);
}

export function lockElement(el: HTMLElement): void {
  const l = locks.get(el);
  if (l) {
    l.n++;
    return;
  }
  locks.set(el, { n: 1, overflow: el.style.overflow, gutter: el.style.getPropertyValue('scrollbar-gutter') });
  if (scrollbarWidth(el) > 0.5) el.style.setProperty('scrollbar-gutter', 'stable');
  el.style.overflow = 'hidden';
}

export function unlockElement(el: HTMLElement): void {
  const l = locks.get(el);
  if (!l) return;
  if (--l.n > 0) return;
  locks.delete(el);
  el.style.overflow = l.overflow;
  if (l.gutter) el.style.setProperty('scrollbar-gutter', l.gutter);
  else el.style.removeProperty('scrollbar-gutter');
}

/** Whether `el` is locked by an overlay right now (screens that re-measure their own layout skip a measurement then). */
export function isScrollLocked(el: Element | null): boolean {
  return !!el && locks.has(el as HTMLElement);
}

/** Locks every scrolling ancestor of `from` (through shadow roots) and the document; returns the release. */
export function lockScrollChain(from: Element): () => void {
  const locked: HTMLElement[] = [];
  let n: Node | null = from;
  while (n) {
    const parent: Node | null = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode;
    if (parent instanceof HTMLElement) {
      const oy = getComputedStyle(parent).overflowY;
      // (a container another overlay locked already reads `hidden` now: it is counted again, so it stays locked until both close)
      if (oy === 'auto' || oy === 'scroll' || parent === document.documentElement || locks.has(parent)) {
        locked.push(parent);
        lockElement(parent);
      }
    }
    n = parent;
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const el of locked) unlockElement(el);
  };
}
