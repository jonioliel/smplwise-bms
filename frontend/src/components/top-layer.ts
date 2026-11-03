import { css } from 'lit';
import { ref } from 'lit/directives/ref.js';

/**
 * DIALOG-TOPLAYER-2381: the browser's top layer for the app's overlays (the Popover API, `popover="manual"`).
 *
 * A `position: fixed` overlay takes the nearest ancestor with a transform, a filter or a backdrop-filter as its containing block. The glass
 * skins (domus, crystal) give every sw-card a backdrop-filter, so a dialog opened inside a card was centred on the CARD and its dimmed
 * backdrop covered only the card. An element in the top layer is laid out against the viewport whatever its ancestors carry, and it paints
 * above every z-index of the page. A manual popover adds nothing else: no light dismiss, no Escape of its own, the page stays as it was
 * (sw-dialog keeps its own focus trap, Escape and stacking order).
 *
 * The top layer paints in the order things were shown, so a toast that must stay readable above an open sw-dialog is "lifted" too
 * (`liftToTopLayer`), and sw-dialog calls `raiseLifted()` after it opens: the toasts that are showing move back above it.
 * Without the Popover API every call here is a no-op and the overlays stay where they were (fixed, by z-index).
 */

type PopEl = HTMLElement & { showPopover?: () => void; hidePopover?: () => void };

export const hasTopLayer = (el: Element | null | undefined): el is PopEl & { showPopover: () => void; hidePopover: () => void } =>
  !!el && typeof (el as PopEl).showPopover === 'function' && typeof (el as PopEl).hidePopover === 'function';

/** Show / hide a `popover` element in the top layer; quiet when it is already in that state, not connected, or the API is missing. */
export function setTopLayer(el: Element | null | undefined, show: boolean): void {
  if (!hasTopLayer(el) || !el.isConnected) return;
  try {
    const on = el.matches(':popover-open');
    if (show && !on) el.showPopover();
    else if (!show && on) el.hidePopover();
  } catch {
    /* an element the browser refuses (e.g. not a popover): it stays a fixed element in the page */
  }
}

const lifted = new Set<PopEl>();

/** Put a toast in the top layer (as a manual popover) and keep it above any sw-dialog that opens while it shows. Safe to call after every
 * render: an element already lifted and showing is left alone. The host's styles should include `liftedReset` (below). */
export function liftToTopLayer(el: Element | null | undefined): void {
  if (!hasTopLayer(el) || !el.isConnected) return;
  for (const old of lifted) if (!old.isConnected) lifted.delete(old);
  if (!el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
  el.setAttribute('data-lifted', '');
  lifted.add(el);
  setTopLayer(el, true);
}

/** The template form of liftToTopLayer: `<div class="toast" ${liftRef()}>`. Lit hands the element over before the template is in the
 * page, so the lift waits for the end of the render (a microtask). */
const onLiftRef = (el?: Element) => {
  if (el) queueMicrotask(() => liftToTopLayer(el));
};
export const liftRef = () => ref(onLiftRef);

/** Called by sw-dialog after it entered the top layer: every lifted element that is showing is shown again, so it paints above. */
export function raiseLifted(): void {
  for (const el of [...lifted]) {
    if (!el.isConnected) {
      lifted.delete(el);
      continue;
    }
    if (!el.matches(':popover-open')) continue;
    try {
      el.hidePopover!();
      el.showPopover!();
    } catch {
      /* left where it was */
    }
  }
}

/** The browser's own `[popover]` style (centred with `inset: 0; margin: auto`, fit-content size, a border, padding, Canvas colours) is
 * put back to what a plain element had, at zero specificity: the lifted element's own rules (its insets, size, padding, colours) win. */
export const liftedReset = css`
  :where([data-lifted][popover]) {
    inset: auto;
    inline-size: auto;
    block-size: auto;
    margin: 0;
    border: 0;
    padding: 0;
    overflow: visible;
    color: inherit;
    background: transparent;
  }
`;

/** The same for a custom element that is itself the fixed toast (its `:host` positions it): put this BEFORE the `:host` rule - both
 * weigh one pseudo-class, so the host's own declarations come later and win. */
export const liftedHostReset = css`
  :host(:where([data-lifted][popover])) {
    inset: auto;
    inline-size: auto;
    block-size: auto;
    margin: 0;
    border: 0;
    padding: 0;
    overflow: visible;
    color: inherit;
    background: transparent;
  }
`;
