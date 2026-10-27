/**
 * POLISH-PHONE-297: the CSS of the phone layer (see mobile-polish.ts for the mechanism and the reasoning). A pure module: no DOM, no
 * design runtime, so the unit spec (tests/unit-polish-phone-297.spec.ts) reads the strings in Node.
 *   MOBILE_POLISH_DOCUMENT   the document rules (<html>, <body>)
 *   MOBILE_POLISH_SHADOW     the rules adopted into every shadow root, after the skin sheet
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
@media ${PHONE} and ${COARSE} {
  /* the type scale on a phone held in the hand (ui-ux-pro-max "Readable Font Size": 16 px body on mobile; apple-design §15: the type
     scales with the device, not the layout): every tier one step up, so a dense row reads at 13.5-14 px instead of 12.5-13 and body at
     15 px. The scale keeps its ratios; screens that snap to the tiers follow, nothing is re-laid out. The selectors tie the skins' own
     token blocks (:root[data-skin][data-theme]) and come later, so a skin's re-tuned tier does not drop the phone step. */
  :root,
  :root[data-skin],
  :root[data-skin][data-theme] {
    --sw-fs-2xs: 11px;
    --sw-fs-xs: 12px;
    --sw-fs-sm: 13.5px;
    --sw-fs-base: 14px;
    --sw-fs-md: 15px;
    --sw-fs-lg: 16px;
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
}

@media ${PHONE} and ${COARSE} {
  /* iOS Safari zooms the page when focus lands on a field whose text is under 16 px, and never zooms back: every text field reads at
     16 px on a phone (the cause is fixed; the viewport keeps user zoom, never maximum-scale=1) */
  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file']),
  select:not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]),
  textarea:not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]):not([data-sw-mp]) {
    /* the repeated :not() is specificity only (0,4,1): a screen's own ".bar sw-field:not([capsule]) select" (live-wall) must not win */
    font-size: max(16px, 1em);
  }

  /* 44 px hit height on the drawn 40 / 36 px buttons without changing their drawing or the row heights (the no-scroll rule of the control
     screens): an invisible hit slop above and below, the way a native button's hit rect is larger than its artwork */
  :host(sw-button) button {
    position: relative;
  }
  /* the touch minimum of sw-button itself (40 / 36 / 44, mobile audit 2026-09-30) is written at (0,0,1) and a skin's own
     ":host(sw-button) button { min-block-size: 34px }" (domus) outranks it on the phone too: 34 / 30 px buttons on a domus phone. The same
     numbers again, from a selector that ties the skin's and comes later. */
  :host(sw-button) button {
    min-block-size: max(40px, var(--sw-ctl-h-md));
  }
  :host(sw-button[size='sm']) button {
    min-block-size: max(36px, var(--sw-ctl-h-sm));
  }
  :host(sw-button[size='lg']) button {
    min-block-size: max(44px, var(--sw-ctl-h-lg));
  }
  :host(sw-button[icononly]) button {
    inline-size: max(40px, var(--sw-ctl-h-md));
  }
  :host(sw-button[icononly][size='sm']) button {
    inline-size: max(36px, var(--sw-ctl-h-sm));
  }
  :host(sw-button[icononly][size='lg']) button {
    inline-size: max(44px, var(--sw-ctl-h-lg));
  }
  :host(sw-button) button::after {
    content: '';
    position: absolute;
    inset: -3px 0; /* 40 -> 46 */
  }
  :host(sw-button[size='sm']) button::after {
    inset: -4px 0;
  }
  /* the switch draws 42 x 24; its hit rect becomes 50 x 44 (::before is free: the thumb is ::after) */
  :host(sw-toggle) button::before {
    content: '';
    position: absolute;
    inset: -10px -4px;
  }
  /* the view switch of the user menu (cards / tiles) draws 32 px; 44 px to the finger */
  :host(sw-user-menu) li.view .seg button {
    position: relative;
  }
  :host(sw-user-menu) li.view .seg button::after {
    content: '';
    position: absolute;
    inset: -6px 0;
  }
  /* a filter chip draws 28 px high; 44 px to the finger */
  :host(sw-chip) button {
    position: relative;
  }
  :host(sw-chip) button::after {
    content: '';
    position: absolute;
    inset: -8px 0;
  }

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

/* press feedback on pointer-DOWN (apple-design §1, emil: buttons must feel responsive): the finger lands and the control answers at once.
   Touch only: a mouse keeps the hover language. Reduced motion keeps the colour change and drops the scale. */
@media ${COARSE} {
  :host(sw-button) button {
    transition:
      transform var(--sw-t-press) var(--sw-ease),
      filter var(--sw-t-press) var(--sw-ease),
      background var(--sw-t-fast) var(--sw-ease),
      border-color var(--sw-t-fast) var(--sw-ease),
      color var(--sw-t-fast) var(--sw-ease),
      box-shadow var(--sw-t-fast) var(--sw-ease);
  }
  :host(sw-button) button:active:not(:disabled) {
    /* the press reads in a still too (loop 1: a 3 % scale alone is invisible on a 40 px button): a darkening of the control's own colour,
       primary or secondary alike; filter composites in Chrome / Firefox and is a 120 ms paint elsewhere */
    transform: scale(0.97);
    filter: brightness(0.92);
  }
  :host(sw-chip) button:active:not(:disabled),
  :host(sw-view-switch) button:active {
    transform: scale(0.96);
  }
  :host(sw-chip) button,
  :host(sw-view-switch) button {
    transition:
      transform var(--sw-t-press) var(--sw-ease),
      background var(--sw-t-fast) var(--sw-ease),
      color var(--sw-t-fast) var(--sw-ease),
      border-color var(--sw-t-fast) var(--sw-ease);
  }
  /* the bottom bar: the pressed destination dims for the press (no scale: a tab bar is a fixed row) */
  :host(sw-app) nav.bottom a:active,
  :host(sw-app) nav.bottom button:active {
    opacity: 0.6;
    transition: opacity var(--sw-t-press) var(--sw-ease);
  }
  /* a table row and a menu line answer the press with the pressed wash */
  :host(sw-table) tbody tr:active {
    background: var(--sw-pressed-wash);
  }
  :host(sw-user-menu) li > a:active,
  :host(sw-user-menu) li > button:active {
    background: var(--sw-pressed-wash);
  }
  :host(sw-sheet) .x:active,
  :host(sw-user-menu) button.x:active {
    background: var(--sw-layer-2);
    transform: scale(0.94);
  }
  :host(sw-sheet) .x,
  :host(sw-user-menu) button.x {
    transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
  }
}
@media ${COARSE} and (prefers-reduced-motion: reduce) {
  :host(sw-button) button:active:not(:disabled),
  :host(sw-chip) button:active:not(:disabled),
  :host(sw-view-switch) button:active,
  :host(sw-sheet) .x:active,
  :host(sw-user-menu) button.x:active {
    transform: none;
  }
}

/* sticky hover: a touch browser applies :hover on the first tap and leaves it there until the next tap elsewhere, so a tapped button
   stays in its hover colour. Where the primary input cannot hover, the shared controls rest in their resting colours. (The screens' own
   ~340 :hover rules are listed for the skin owner: they belong inside @media (hover: hover) and (pointer: fine).) */
@media (hover: none) {
  :host(sw-button) button:hover {
    background: var(--sw-surface);
  }
  :host(sw-button[variant='primary']) button:hover {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
  }
  :host(sw-button[variant='ghost']) button:hover {
    background: transparent;
    color: var(--sw-text-2);
  }
  :host(sw-button[variant='danger']) button:hover {
    background: var(--sw-surface);
  }
  :host(sw-chip) button:hover {
    background: var(--sw-surface);
  }
  :host(sw-chip[selected]) button:hover {
    background: var(--sw-accent);
  }
  :host(sw-tabs) a:hover:not(.on),
  :host(sw-tabs) button:hover:not(.on) {
    color: var(--sw-text-2);
  }
  :host(sw-table) tbody tr:hover:not(.selected) {
    background: transparent;
  }
  :host(sw-view-switch) button:hover:not([aria-pressed='true']) {
    background: transparent;
  }
  :host(sw-dropdown) .chip:hover {
    background: var(--sw-dd-bg, var(--sw-surface));
  }
  :host(sw-dropdown[dd-style='capsule']) .chip:hover::before {
    background: linear-gradient(180deg, var(--sw-surface-solid) 0%, color-mix(in srgb, var(--sw-accent) 11%, var(--sw-surface-solid)) 100%);
  }
  :host(sw-sheet) .x:hover {
    background: var(--sw-layer);
  }
  :host(sw-user-menu) button.x:hover {
    background: transparent;
    color: var(--sw-text-3);
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
