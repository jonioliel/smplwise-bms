/**
 * One focus-ring policy for the whole UI (mobile audit 2026-09-30).
 *
 * The app is Lit components in shadow roots, and a document stylesheet (styles/base.css) does not reach into a shadow
 * root, so every element a component did not style itself shows the BROWSER's default focus ring. On Android Chrome that
 * default ring is a thick amber / yellow rounded outline - it appeared around a `select` after a tap in the kiosk screen
 * (owner screenshot). This module adopts one small stylesheet into the document and into every shadow root Lit creates:
 *
 *   - keyboard focus (and a tap on a text field / select, which Chrome always treats as :focus-visible): a 2 px ring in
 *     the brand focus colour (--sw-focus), never the browser's amber;
 *   - an iframe never gets a ring from us (the framed screen's own document decides what it draws);
 *   - every rule sits at specificity 0 (`:where`), so any component that styles its own focus - and sw-field's
 *     `::slotted(select:focus)` box-shadow, excluded below - keeps winning; this only replaces the browser's default.
 *
 * Installed once, before any component connects (imported first by main.ts).
 */
import { ReactiveElement } from 'lit';

export const FOCUS_POLICY_CSS = `
:where(:focus-visible):not(sw-field > *) {
  outline: 2px solid var(--sw-focus);
  outline-offset: 2px;
}
:where(input, select, textarea):where(:focus-visible):not(sw-field > *) {
  outline-offset: 1px;
}
:where(iframe:focus, iframe:focus-visible) {
  outline: none;
}
`;

let sheet: CSSStyleSheet | null = null;

/** The shared sheet (null where constructable stylesheets do not exist). */
export function focusPolicySheet(): CSSStyleSheet | null {
  if (sheet) return sheet;
  try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(FOCUS_POLICY_CSS);
  } catch {
    sheet = null;
  }
  return sheet;
}

let installed = false;

export function installFocusPolicy(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const s = focusPolicySheet();
  if (!s) return;
  try {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
  } catch {
    /* an old engine without adoptedStyleSheets: the components keep the browser's ring */
  }
  const proto = ReactiveElement.prototype as unknown as { createRenderRoot: () => HTMLElement | DocumentFragment };
  const original = proto.createRenderRoot;
  proto.createRenderRoot = function (this: ReactiveElement) {
    const root = original.call(this);
    if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
      try {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, s];
      } catch {
        /* ignore */
      }
    }
    return root;
  };
}

installFocusPolicy();
