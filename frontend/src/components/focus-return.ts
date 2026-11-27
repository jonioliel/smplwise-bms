import { deepActive, focusLost } from './modal-stack';

/**
 * A11Y-NEW-2550: where the keyboard focus goes when the control that had it is gone. A button disabled while its request runs drops the
 * focus to the page body (the browser's focus fix-up), and so does a control removed with the outcome it produced (an un-mute button gone
 * with the mute, a dialog closed by its own result). A keyboard or screen-reader user then starts again from the top of the page.
 *
 * - `lastFocused()`: the last element that held the focus (through shadow roots), kept by one capturing `focusin` listener on the window;
 * - `openerNow()`: the control a dialog opened now should give the focus back to - the focused one, else the last one that had it;
 * - `focusIfLost(el)`: focus `el` (an outcome line, or the control the person was on) ONLY when the focus fell back to the page; an element
 *   that is not focusable by itself gets `tabindex="-1"` (reachable by script, not by Tab). Nothing moves while the focus is elsewhere.
 */
let last: HTMLElement | null = null;
let tracking = false;

function track(): void {
  if (tracking || typeof window === 'undefined') return;
  tracking = true;
  window.addEventListener(
    'focusin',
    () => {
      const a = deepActive();
      if (a && a !== document.body && a !== document.documentElement) last = a;
    },
    true,
  );
}
track();

export function lastFocused(): HTMLElement | null {
  return last?.isConnected ? last : null;
}

export function openerNow(): HTMLElement | null {
  const a = deepActive();
  if (a && a !== document.body && a !== document.documentElement && a.isConnected) return a;
  return lastFocused();
}

export function focusIfLost(el: HTMLElement | null | undefined): void {
  if (!el?.isConnected || !focusLost()) return;
  if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus();
}
