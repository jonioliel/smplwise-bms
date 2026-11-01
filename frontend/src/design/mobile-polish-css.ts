/**
 * POLISH-PHONE-297 / POLISH-PHONE-2310: the CSS of the phone layer (see mobile-polish.ts for the mechanism and the reasoning). A pure
 * module: no DOM, no design runtime, so the unit spec (tests/unit-polish-phone-297.spec.ts) reads the strings in Node.
 *   MOBILE_POLISH_DOCUMENT   the document rules (<html>, <body>)
 *   MOBILE_POLISH_SHADOW     the rules adopted into every shadow root, after the skin sheet
 *
 * ONE press feel (owner 2026-10-30, answer 5A): the press of every control is train 2's model - `transform: scale(var(--sw-press-scale))`
 * written by the components and the skins (.97 where a skin sets press feedback, 1 where it sets none), zeroed by reduced motion through
 * the token (css.ts REDUCED_MOTION_DECLS, which honours `ui.motion`) and by the shared reduced-motion sheet (design/apply.ts). This layer
 * therefore never writes its own scale, filter, opacity dim or transition on a control that already presses (sw-button, sw-chip, the
 * bottom bar, sw-table rows, sw-dropdown, sw-tabs); it only adds the press to the two controls that had none (sw-view-switch, the
 * sheet's close button), with the same token, so they follow the skin and the motion setting like every other control.
 */

export const PHONE_MQ = '(max-width: 767px)';
export const COARSE_MQ = '(pointer: coarse)';
const PHONE = PHONE_MQ;
const COARSE = COARSE_MQ;
export const MOBILE_POLISH_DOCUMENT = `
html {
  /* the translucent grey flash iOS / Android paint over a tapped element; every control draws its own pressed state instead */
  -webkit-tap-highlight-color: transparent;
  /* no font inflation when a phone turns to landscape */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
@media ${PHONE} {
  /* the shell is a 100dvh grid with its own scroll areas: a pull past the top of the page must never reload the app (the shell's <main>
     already contains; the root stops the browser's own pull-to-refresh and the whole-page rubber band) */
  html,
  body {
    overscroll-behavior: none;
  }
}
`;

export const MOBILE_POLISH_SHADOW = `
/* a control never double-tap-zooms: click fires at once (the remaining tap delay on iOS); the pan / pinch of the page stay with the browser.
   An element that owns a gesture (.grab, a slider, a drag surface) sets its own touch-action with a class and keeps it (higher specificity). */
button,
a[href],
[role='button'],
[role='tab'],
[role='menuitem'],
[role='option'],
summary {
  touch-action: manipulation;
}

@media ${COARSE} {
  /* a long press on a control selects its label on iOS (and pops the copy / share callout on a link used as a button); native controls
     never do. Content stays selectable: this names controls only, never text. */
  button,
  a[href],
  [role='button'],
  [role='tab'],
  [role='menuitem'],
  [role='option'],
  summary,
  label {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  /* the press of the two controls that had none, in train 2's model: the skin's press scale (1 = none), zeroed by reduced motion */
  :host(sw-view-switch) button {
    transition:
      background var(--sw-t-fast) var(--sw-ease),
      color var(--sw-t-fast) var(--sw-ease),
      transform var(--sw-t-press) var(--sw-ease);
  }
  :host(sw-view-switch) button:active {
    transform: scale(var(--sw-press-scale));
  }
  :host(sw-sheet) .x {
    transition:
      background var(--sw-t-hover) var(--sw-ease-color),
      transform var(--sw-t-press) var(--sw-ease);
  }
  :host(sw-sheet) .x:active {
    background: var(--sw-layer-2);
    transform: scale(var(--sw-press-scale));
  }
}

@media ${PHONE} and ${COARSE} {
  /* iOS Safari zooms the page when focus lands on a field whose text is under 16 px, and never zooms back: every text field reads at the
     xl tier on a phone (17-19 px in every skin; the tier devices-announce uses for the same reason). The cause is fixed; the viewport
     keeps user zoom, never maximum-scale=1. */
  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file']),
  select:not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]),
  textarea:not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]) {
    /* the repeated :not() is specificity only (0,4,1): a screen's own ".bar sw-field:not([capsule]) select" (live-wall) must not win */
    font-size: max(var(--sw-fs-xl), 1em);
  }

  /* a 44 px hit height on the drawn 40 / 36 px buttons without changing their drawing or the row heights (the no-scroll rule of the
     control screens): an invisible hit slop above and below, the way a native button's hit rect is larger than its artwork */
  :host(sw-button) button {
    position: relative;
  }
  :host(sw-button) button::after {
    content: '';
    position: absolute;
    inset: -3px 0; /* 40 -> 46 */
  }
  :host(sw-button[size='sm']) button::after {
    inset: -4px 0;
  }
  /* (POLISH-PHONE-2310: no slop on sw-chip - it already carries the shared centred 44 x 44 hit of styles/focus-policy.ts (.sw-hit), which
     a 0-inline slop here would narrow; none on sw-toggle - a ::before wider than the 42 px track is scrollable overflow and trips the
     layout guards' clipped-content check at 320 px) */

  /* the pop-ups measure the visible viewport (dvh), never the one with the browser chrome collapsed (vh): a centred pop-up no longer
     runs under the URL bar on the first paint */
  :host(sw-sheet) .sheet {
    max-block-size: min(86dvh, 860px);
  }
  :host(sw-sheet[data-layout='bottom']) .sheet {
    max-block-size: 88dvh;
  }
  /* the bottom sheet's body keeps clear of the home indicator even when a screen slots a footer-less body */
  :host(sw-sheet[data-layout='bottom']) .body {
    padding-block-end: max(22px, calc(10px + env(safe-area-inset-bottom, 0px)));
  }
}

/* sticky hover: a touch browser applies :hover on the first tap and leaves it there until the next tap elsewhere. The shared controls
   already gate their hover to (hover: hover) and (pointer: fine); what is left ungated is the skins' table-row tint (bubble, crystal,
   domus, tesla) and two rules of the shell. Where the primary input cannot hover, those rest in their resting colours. A pressed row
   keeps its own press wash (:not(:active)). */
@media (hover: none) {
  :host(sw-table) tbody tr:hover:not(.selected):not(:active) {
    background: transparent;
  }
  :host(sw-app) .float button:hover:not([aria-expanded='true']) {
    background: transparent;
    color: inherit;
  }
  :host(sw-app) nav.sections a:hover:not(.on) {
    color: var(--sw-text-2);
  }
}
`;
