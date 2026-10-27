import { css } from 'lit';

/**
 * CR-038: the look of the tickets screens - ALWAYS the glass style of the automations area (styles/automations-glass.ts on top of
 * styles/media-glass.ts: the `--dv-*` palette and the `--mm-*` knobs, light or dark by the installation's scheme; the five skins come
 * through those layers). This file adds only what that area does not have: the ticket card's pieces, the detail's state strip,
 * timeline and photo grid, the form rows of the create sheet. Rules read the knobs and the `--sw-*` type / radius scale only (no
 * literal colour, font size or radius: tests/unit-token-lint.spec.ts reads this folder), logical properties only (RTL by default).
 * The Bubble skin gets component-level rules here (its skin sheet is at its rule budget).
 */
export const ticketCardStyles = css`
  :host {
    display: block;
    min-inline-size: 0;
    position: relative;
  }
  :host([data-menu]) {
    z-index: 20;
  }
  .tcard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 11px;
    padding: 16px 18px 14px;
    block-size: 100%;
    box-sizing: border-box;
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-2xl);
    box-shadow: var(--dv-shadow-1);
    transition: box-shadow var(--mm-motion) var(--mm-ease), border-color var(--mm-motion), transform var(--sw-t-press) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
  }
  /* POLISH-CLASSIC-DOMUS-297 second pass (P4): the shared hover convention (a pointer that hovers) and a small press of the card
     itself - not while a button or link inside it is the thing pressed (that control gives its own feedback) */
  @media (hover: hover) and (pointer: fine) {
    .tcard:hover {
      box-shadow: var(--dv-shadow-2);
    }
  }
  .tcard:active:not(:has(button:active, a:active, input:active, select:active, sw-button:active)) {
    transform: scale(calc(1 - (1 - var(--sw-press-scale)) / 3));
  }
  .tcard:focus-within,
  :host([data-picked]) .tcard {
    border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
    box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
  }
  .tcard.urgent {
    border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
  }
  header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-inline-size: 0;
  }
  .ttl {
    flex: 1;
    min-inline-size: 0;
  }
  h3 {
    margin: 0;
    font-size: var(--sw-fs-xl);
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.25;
    /* UXFIX-RTL: two lines, then an ellipsis; the title text carries dir="auto" so a Latin / Cyrillic title keeps its beginning
       (a one-line ellipsis in an RTL box cut the start of it) and the full text is the link's title attribute. */
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow-wrap: anywhere;
    text-align: start;
    text-overflow: ellipsis; /* UXFIX-NAV-295 (same fix as UXFIX-RTL) */
    white-space: normal;
  }
  a.name {
    color: inherit;
    text-decoration: none;
  }
  a.name::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  a.name:focus-visible {
    outline: none;
  }
  .where {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 8px;
    margin-block-start: 3px;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .where b {
    color: var(--dv-text);
    font-weight: 700;
    white-space: nowrap;
  }
  .where .ic {
    font-size: var(--sw-fs-md);
    color: var(--dv-text-3);
  }
  .ctl {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }
  .more {
    display: grid;
    place-items: center;
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
  }
  .more:hover,
  .more[aria-expanded='true'] {
    background: var(--dv-surface-3);
    color: var(--dv-text);
  }
  .more .ic {
    font-size: var(--sw-fs-2xl);
  }
  .excerpt {
    margin: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.55;
    color: var(--dv-text);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  footer {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin-block-start: auto;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
  }
  .run {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-inline-size: 0;
  }
  .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
    color: var(--dv-text-3);
    font-weight: 600;
  }
  a.tl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--dv-accent-text);
    font-weight: 600;
    text-decoration: none;
    min-block-size: 32px;
    border-radius: var(--sw-r-sm);
  }
  a.tl .ic {
    font-size: var(--sw-fs-lg);
  }
  a.tl:hover {
    text-decoration: underline;
  }
  a.tl:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .chips {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip .dot {
    inline-size: 6px;
    block-size: 6px;
  }
  .pop {
    position: absolute;
    z-index: 30;
    display: flex;
    flex-direction: column;
    padding: 6px;
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-menu-border);
    border-radius: var(--sw-r-lg);
    box-shadow: var(--dv-shadow-2);
    inset-block-start: 52px;
    inset-inline-end: 12px;
    min-inline-size: 190px;
  }
  /* 2.5.5: placed by tickets/overlay-menu.ts in the top layer (a popover), never clipped by a scroll box or a blurred ancestor */
  .pop.ov {
    position: fixed;
    inset: auto;
    margin: 0;
    max-inline-size: calc(100vw - 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .pop button {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    padding-inline: 12px;
    border: 0;
    border-radius: var(--sw-r-md);
    background: transparent;
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-md);
    text-align: start;
  }
  .pop button:hover,
  .pop button:focus-visible {
    background: var(--dv-surface-3);
    outline: none;
  }
  .pop button .ic {
    font-size: var(--sw-fs-lg);
    color: var(--dv-text-2);
  }
  @media (pointer: coarse), (max-width: 767px) {
    .more {
      inline-size: 44px;
      block-size: 44px;
    }
    a.tl {
      min-block-size: 44px;
    }
  }
  @media (max-width: 767px) {
    .tcard {
      padding: 14px 16px 12px;
    }
    /* UXFIX-NAV-295: on a phone the title column was 115-200 px (the chip and the menu shared its row) and cut even short titles:
       the chip and the menu take the first row, the title gets the full width of the second */
    header {
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .ctl {
      order: 1;
      margin-inline-start: auto;
    }
    .ttl {
      order: 2;
      flex: 1 1 100%;
    }
  }
  :host([data-skin='bubble']) .tcard {
    border-radius: var(--sw-r-lg);
  }
`;

/** The detail (drawer body and full screen): the sentence box, sections, the state strip, the handler block, photos, the timeline. */
export const ticketDetailStyles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-inline-size: 0;
  }
  .sentence {
    overflow-wrap: anywhere;
  }
  .sentence .desc {
    white-space: pre-line;
  }
  .sect > h4 .cnt {
    font-variant-numeric: tabular-nums;
    color: var(--dv-text-3);
  }
  .sect > h4 .sp {
    flex: 1;
  }
  .sect > h4 .btn {
    color: var(--dv-text);
  }
  /* the state strip wraps to a second row when the states do not fit (a drawer, a phone): nothing is hidden behind a scroll */
  .strip {
    display: flex;
    flex-wrap: wrap;
    inline-size: 100%;
    box-sizing: border-box;
    border-radius: var(--sw-r-xl);
  }
  .strip button {
    flex: 1 0 auto;
    padding-inline: 10px;
  }
  .strip button .sub {
    display: block;
    font-size: var(--sw-fs-xs);
    font-weight: 500;
    line-height: 1.2;
    opacity: 0.85;
  }
  .strip button[disabled]:not([aria-pressed='true']) {
    color: var(--dv-text-3);
  }
  .side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .who {
    font-weight: 700;
  }
  .blk .acts {
    display: flex;
    gap: 6px;
    flex: none;
  }
  .photos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }
  .ph {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--sw-r-md);
    overflow: hidden;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
  }
  .ph img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .ph .rm {
    position: absolute;
    inset-block-start: 4px;
    inset-inline-end: 4px;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--sw-menu-surface);
    color: var(--dv-danger);
    box-shadow: var(--dv-shadow-1);
  }
  .ph .tag {
    position: absolute;
    inset-block-end: 4px;
    inset-inline-start: 4px;
  }
  .ph.add {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    color: var(--dv-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    border-style: dashed;
    cursor: pointer;
  }
  .ph.add .ic {
    font-size: var(--sw-fs-2xl);
  }
  .ph.add input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .ph.add:focus-within {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .tline {
    list-style: none;
    margin: 0;
    padding: 4px 0 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: relative;
  }
  .tline::before {
    content: '';
    position: absolute;
    inset-block: 18px 18px;
    inset-inline-start: 15px;
    inline-size: 2px;
    background: var(--dv-border);
  }
  .tline li {
    position: relative;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    min-inline-size: 0;
  }
  .tline .ring {
    flex: none;
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    background: var(--dv-surface-solid);
    border: 1px solid var(--dv-border);
    color: var(--dv-text-2);
  }
  .tline .ring .ic {
    font-size: var(--sw-fs-md);
  }
  .tline li[data-kind='status'] .ring,
  .tline li[data-kind='assigned'] .ring,
  .tline li[data-kind='reassigned'] .ring {
    color: var(--dv-accent-text);
  }
  .tline li[data-kind='closed'] .ring,
  .tline li[data-kind='created'] .ring {
    color: var(--dv-text);
  }
  .tline .tx {
    flex: 1;
    min-inline-size: 0;
    padding-block-start: 5px;
  }
  .tline .meta {
    display: block;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
  }
  .tline .line {
    font-size: var(--sw-fs-md);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .tline .body {
    margin-block-start: 6px;
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    border: 1px solid var(--dv-border);
    font-size: var(--sw-fs-md);
    line-height: 1.55;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .composer textarea,
  textarea.inp {
    min-block-size: 88px;
    padding-block: 10px;
    resize: vertical;
    line-height: 1.5;
    border-radius: var(--sw-r-lg);
  }
  .composer .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .composer .row .grow {
    flex: 1;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-block-size: 44px;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
    cursor: pointer;
  }
  .chk input {
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--dv-accent);
  }
  .err {
    color: var(--dv-danger);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
  }
  .muted {
    color: var(--dv-text-2);
    font-size: var(--sw-fs-base);
  }
  .foot2 {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  :host([data-skin='bubble']) .tline .body,
  :host([data-skin='bubble']) .ph {
    border-radius: var(--sw-r-md);
  }
`;

/** The form of the create sheet / dialog and of the edit dialog: labelled rows, pill inputs, priority chips, the similar list. */
export const ticketFormStyles = css`
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .fld > span {
    font-weight: 600;
  }
  .fld .req {
    color: var(--dv-danger);
  }
  .prio {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .prio .rc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 38px;
    padding-inline: 14px;
    border-radius: 999px;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    font-weight: 600;
  }
  .prio .rc[aria-checked='true'] {
    background: var(--dv-text);
    color: var(--dv-backdrop-solid, var(--dv-surface-solid));
    border-color: transparent;
  }
  .similar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-warning-soft);
  }
  .similar b {
    font-size: var(--sw-fs-sm);
  }
  .similar a {
    color: var(--dv-text);
    font-size: var(--sw-fs-base);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .similar a:hover {
    text-decoration: underline;
  }
  /* TKUI7 (ONE scroll per surface): a picker list grows with its rows and the drawer / dialog / sheet body scrolls; only the searchable
     vendor / contact list (.xpick, with its search field above it) keeps a capped box of its own */
  .pick {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pick.xpick {
    max-block-size: 280px;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .pick label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    padding-inline: 12px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    cursor: pointer;
  }
  .pick label:has(input:checked) {
    border-color: var(--dv-accent);
    background: var(--dv-accent-soft);
  }
  .pick input {
    accent-color: var(--dv-accent);
  }
  .pick small {
    color: var(--dv-text-3);
    margin-inline-start: auto;
  }
  .sheetfoot {
    display: flex;
    align-items: center;
    gap: 10px;
    inline-size: 100%;
  }
  .sheetfoot .hint {
    margin-inline-start: auto;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
  }
  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .thumbs .ph {
    inline-size: 72px;
    block-size: 72px;
    aspect-ratio: auto;
  }
  @media (max-width: 767px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
`;
