import { deepFocusables } from './sw-drawer';
import { holdsTab, takesEscape } from './modal-stack';

/**
 * A11Y-POLISHED-2342: small keyboard helpers for the hand-written widgets of the screens (the shared sw-dialog / sw-drawer /
 * sw-sheet carry their own).
 */

/** The element that really holds focus (through shadow roots). */
function deepActiveElement(): HTMLElement | null {
  let a: Element | null = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a as HTMLElement | null;
}

/** The next index for an arrow / Home / End key in a one-row strip; `rtl` swaps the arrows (in RTL ArrowLeft is the next one). */
function stripIndex(key: string, index: number, count: number, rtl: boolean): number | null {
  if (count < 1) return null;
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === forward) return (index + 1) % count;
  if (key === backward) return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * The `@keydown` of a `role="tablist"` row of buttons: the arrow keys move the focus between the tabs (RTL aware), Home / End
 * jump to the ends; Enter / Space activate the focused tab as the button it is (manual activation: a tab that navigates away
 * is never opened by an arrow press). A roving strip (the tabs that are not selected carry tabindex="-1", so Tab reaches only
 * the selected one) selects the tab the arrow lands on - there the arrows are the only way to the other tabs.
 */
export function tablistKeydown(e: KeyboardEvent): void {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const list = e.currentTarget as HTMLElement | null;
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter((t) => !(t as HTMLButtonElement).disabled && t.getAttribute('aria-disabled') !== 'true');
  const at = tabs.findIndex((t) => e.composedPath().includes(t));
  if (at < 0) return;
  const next = stripIndex(e.key, at, tabs.length, getComputedStyle(list).direction === 'rtl');
  if (next === null) return;
  e.preventDefault();
  tabs[next].focus();
  if (tabs[next].getAttribute('tabindex') === '-1') tabs[next].click();
}

/**
 * The keyboard of a hand-written modal sheet (role dialog, aria-modal): Escape closes it, Tab / Shift+Tab wrap inside it.
 * Returns true when it handled the key. CR-MODAL-STACK-B-2442: with `layer` (the sheet's entry in the shared modal stack) Escape closes
 * it only while it is the top layer and Tab wraps only while it holds the trap.
 */
export function modalKeydown(e: KeyboardEvent, box: Element, close: () => void, layer?: object): boolean {
  if (e.key === 'Escape') {
    if (layer && !takesEscape(layer, e)) return false;
    e.preventDefault();
    e.stopPropagation();
    close();
    return true;
  }
  if (e.key !== 'Tab') return false;
  if (layer && !holdsTab(layer)) return false;
  const all = deepFocusables(box);
  if (!all.length) {
    e.preventDefault();
    return true;
  }
  const active = deepActiveElement();
  const first = all[0];
  const last = all[all.length - 1];
  const inside = !!active && all.some((el) => el === active || el.shadowRoot?.contains(active) === true);
  if (!inside || (e.shiftKey && active === first) || (!e.shiftKey && active === last)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus({ preventScroll: true });
  }
  return true;
}
