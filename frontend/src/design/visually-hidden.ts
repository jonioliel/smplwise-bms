/**
 * The inline style of a visually hidden host that a screen reader still reads (the app's live-region announcer,
 * components/announcer.ts). It lives in src/design because its 1px box is a fixed size rule, not a layout value: 1px (never 1em)
 * keeps the box inside the viewport's top corner without adding to the document's height (FIX-NOSCROLL-2560: a 1em box made every
 * control screen 14-15px taller than the viewport, so the page scrolled).
 */
export const VISUALLY_HIDDEN_STYLE =
  'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;block-size:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;margin:0;padding:0;border:0;pointer-events:none';
