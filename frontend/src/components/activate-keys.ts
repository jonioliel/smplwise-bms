/**
 * CR-A11Y-ROWS-2443 (code review 2026-11-13, D14 / 06:A11Y-1): the keyboard of a clickable row or card that is not a native control
 * (a `<tr>`, a `<div>`, an `sw-card`, a `<span>` cell). Give the element `tabindex="0"` (and a `role` where it is not a table row) and
 * `@keydown=${activateKeydown(() => ...)}`: Enter or Space pressed ON the element runs the same action as its click.
 *
 * A key pressed on something INSIDE the element (a link, a button, a field, a menu of the row) is left alone: that control has its own
 * Enter / Space, and the row must not run as well (a row that took every Enter used to navigate when Enter was pressed on its delete
 * button). A held key (auto-repeat) and a key with a modifier are left alone too. Pure (no DOM import), so Node units can run it.
 */

/** The part of a KeyboardEvent the helper reads (a real event, or a test's plain object). */
export interface ActivateKeyEvent {
  key: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  preventDefault(): void;
}

/** True when the key should activate the element it was pressed on (Enter or Space, on the element itself, no modifier, no repeat). */
export function isActivateKey(e: ActivateKeyEvent): boolean {
  if (e.key !== 'Enter' && e.key !== ' ') return false;
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
  return e.target === e.currentTarget;
}

/** The `@keydown` listener: Enter / Space on the element runs `run` (and the page does not scroll for Space). */
export function activateKeydown(run: () => void): (e: ActivateKeyEvent) => void {
  return (e) => {
    if (!isActivateKey(e)) return;
    e.preventDefault();
    run();
  };
}
