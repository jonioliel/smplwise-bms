/**
 * POLISH-PHONE-297: the phone layer of the design system (round 4, agent P5). The small platform-level rules that separate "a web site in
 * a browser" from an installed app on a phone (skills mobile-native, apple-design, emil-design-eng): no input zoom, no sticky hover after a
 * tap, no grey tap flash, no long-press selection of a control's label, press feedback on pointer-down, a 44 px hit height where the drawn
 * control is smaller, dvh for the pop-ups, the root never pulls-to-refresh, and a status bar that matches the page's own colour.
 *
 * Nothing structural moves. Everything is phone- or pointer-gated (`(max-width: 767px)` = shell/phone.ts, `(pointer: coarse)`,
 * `(hover: none)`), so a desktop draws exactly what it drew before. Two sheets (the CSS text lives in mobile-polish-css.ts):
 *   - MOBILE_POLISH_DOCUMENT   the document rules (<html>, <body>)
 *   - MOBILE_POLISH_SHADOW     one constructable stylesheet adopted into every shadow root, AFTER the skin sheet of design/apply.ts, so a
 *                              phone rule wins over a component's own resting rule at equal specificity. `:host(sw-x)` scopes a rule to
 *                              one component's shadow root; everything else is written for the tree the element lives in.
 * Plus the theme-color meta: the installed app's status bar takes the page's own background (`--sw-bg` of the skin and scheme in force),
 * never the brand blue over a light page (mobile-native §10).
 */
import { ReactiveElement } from 'lit';
import { onDesign } from './apply';
import { MOBILE_POLISH_DOCUMENT, MOBILE_POLISH_SHADOW } from './mobile-polish-css';

export { MOBILE_POLISH_DOCUMENT, MOBILE_POLISH_SHADOW };

/** The status bar / browser chrome colour follows the page's own background: the skin and scheme in force, live on every change. */
function syncThemeColor() {
  let bg = '';
  try {
    bg = getComputedStyle(document.documentElement).getPropertyValue('--sw-bg').trim();
  } catch {
    return;
  }
  if (!bg) return;
  // the static per-scheme metas of index.html are the no-JS net; from here on ONE meta carries the resolved colour
  const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  let meta = metas.find((m) => !m.media) ?? null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  for (const m of metas) if (m !== meta) m.remove();
  if (meta.content !== bg) meta.content = bg;
}

let booted = false;
/** Boot: the document sheet, the shadow sheet (adopted by every shadow root created from now on), the theme-color sync. Idempotent. */
export function bootMobilePolish() {
  if (booted) return;
  booted = true;
  try {
    const doc = new CSSStyleSheet();
    doc.replaceSync(MOBILE_POLISH_DOCUMENT);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, doc];
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(MOBILE_POLISH_SHADOW);
    // wraps the createRenderRoot already wrapped by design/apply.ts (imported first), so this sheet lands after the skin sheet
    const proto = ReactiveElement.prototype as unknown as { createRenderRoot(): ShadowRoot | HTMLElement };
    const original = proto.createRenderRoot;
    proto.createRenderRoot = function patched(this: unknown) {
      const root = original.call(this);
      if ('adoptedStyleSheets' in root) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return root;
    };
  } catch {
    const style = document.createElement('style');
    style.id = 'sw-mobile-polish';
    style.textContent = MOBILE_POLISH_DOCUMENT;
    document.head.appendChild(style); // no constructable stylesheets: the document rules still apply
  }
  onDesign(syncThemeColor);
  syncThemeColor();
}
