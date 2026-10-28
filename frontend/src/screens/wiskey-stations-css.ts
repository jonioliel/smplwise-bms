import { css } from 'lit';

/**
 * Styles of the native stations screen (CR-036 slice S6). Only `--sw-*` tokens (unit-token-lint), no skin rules: the skins reach
 * the cards through `sw-card` (the host the skins already style), the buttons through `wk-action-button`, and the colours through
 * the tokens each skin sets. `--wk-hit` is the hit area of a control: the look dial on a desktop, 44 px in touch layouts.
 */
export const stationsCss = css`
  :host {
    display: block;
    --wk-hit: var(--sw-touch-desktop, 44px);
  }
  @media (max-width: 1100px) {
    :host {
      --wk-hit: 44px;
    }
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .search {
    flex: 1 1 220px;
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-inline-size: 0;
    max-inline-size: 420px;
    padding-inline: var(--sw-s-3);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text-3);
  }
  .search:focus-within {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 3px var(--sw-accent-soft);
  }
  .search input {
    flex: 1;
    min-inline-size: 0;
    min-block-size: var(--wk-hit);
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-base);
  }
  .lbl {
    min-inline-size: 0;
  }
  .layout {
    display: grid;
    grid-template-columns: var(--wk-tree, 236px) minmax(0, 1fr);
    gap: var(--sw-s-4);
    align-items: start;
  }
  .layout.no-tree {
    grid-template-columns: minmax(0, 1fr);
  }
  .treecol {
    position: sticky;
    inset-block-start: var(--sw-s-3);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    min-inline-size: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2);
  }
  .chip {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding-inline: var(--sw-s-4);
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
    cursor: pointer;
    /* R5-SECURITY: a raised key (shadow 1), sinks on pointer-down; the active one a filled accent field */
    box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  @media (hover: hover) and (pointer: fine) {
    .chip:hover {
      background: var(--sw-surface-2);
    }
  }
  .chip:active,
  .rowmain:active,
  .open:active ~ .scrim {
    transform: scale(var(--sw-press-scale));
  }
  .chip[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font-weight: var(--sw-fw-bold);
  }
  .chip.places {
    display: none;
  }
  .chip:focus-visible,
  .rowmain:focus-visible,
  .open:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .strip {
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-md);
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 40%, transparent);
  }
  /* R5-SECURITY: the badges of the cards, rows and the drawer are fields - 12.5/700 on 22 px */
  sw-badge {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
    line-height: 18px;
    padding-block: 2px;
  }
  .strip .dot {
    flex: none;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: var(--sw-warning);
    animation: wk-blink 1.2s ease-in-out infinite;
  }
  .strip .sp {
    flex: 1;
  }

  /* ---- cards ---- */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    gap: var(--sw-s-4);
  }
  .card {
    min-inline-size: 0;
  }
  /* the ring is the ONLY layer of the shadow: a skin may set --sw-shadow-N to "none" (Tesla does), and "none" inside a shadow list
     makes the whole declaration invalid - the ring would vanish exactly where the screen needs it */
  .card.ringing {
    box-shadow: 0 0 0 2px var(--sw-warning);
    animation: wk-ring 1.6s ease-in-out infinite;
  }
  .media {
    position: relative;
    aspect-ratio: 16 / 8;
    overflow: hidden;
    background: var(--sw-surface-3);
  }
  .media img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .media.off img {
    filter: grayscale(1) brightness(0.7);
  }
  .none {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--sw-s-1);
    padding-block-end: 36px;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .open {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .scrim {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 2;
    display: flex;
    align-items: baseline;
    gap: var(--sw-s-3);
    padding: 26px 14px 10px;
    background: linear-gradient(180deg, transparent, var(--sw-video-scrim-strong));
    color: var(--sw-on-video);
    pointer-events: none;
  }
  .scrim .name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* R5-SECURITY: the station's name is the card's display line - 20/800 */
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .scrim .place {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--sw-fs-xs);
    color: var(--sw-on-video-2);
  }
  .stamp {
    position: absolute;
    z-index: 2;
    inset-block-start: 10px;
    inset-inline-start: 10px;
    padding: 2px 7px;
    border-radius: var(--sw-r-2xs);
    background: var(--sw-video-scrim);
    color: var(--sw-on-video);
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-2xs);
    pointer-events: none;
  }
  .stamp bdi {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .callbadge {
    position: absolute;
    z-index: 2;
    inset-block-start: 10px;
    inset-inline-end: 10px;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: var(--sw-s-1) var(--sw-s-3);
    border: 2px solid var(--sw-warning);
    border-radius: var(--sw-r-pill);
    background: var(--sw-on-image-bg);
    color: var(--sw-text);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    box-shadow: var(--sw-shadow-2);
    pointer-events: none;
  }
  .callbadge.in_call,
  .callbadge.ending {
    border-color: var(--sw-accent);
  }
  .callbadge sw-icon,
  .callbadge .ic {
    display: inline-flex;
    color: var(--sw-warning);
  }
  .callbadge.in_call sw-icon,
  .callbadge.in_call .ic,
  .callbadge.ending sw-icon,
  .callbadge.ending .ic {
    color: var(--sw-accent);
  }
  .cb {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    padding: var(--sw-s-3) var(--sw-s-4);
  }
  .hd {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .callrow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2);
  }
  .callrow.ringing {
    background: var(--sw-warning-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 40%, transparent);
  }
  .callrow.in_call,
  .callrow.ending {
    background: var(--sw-accent-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 35%, transparent);
  }
  .callrow.big {
    padding-block: var(--sw-s-3);
  }
  .cs {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    white-space: nowrap;
  }
  .callrow.big .cs {
    font-size: var(--sw-fs-xl);
    font-weight: 800;
  }
  /* the controls of a call row move together: when the row is narrow they take their own line, side by side */
  .ctl {
    flex: 1 1 auto;
    display: flex;
    justify-content: flex-end;
    gap: var(--sw-s-2);
  }
  .ctl > * {
    flex: 1 1 0;
  }
  .callrow.ringing .cs {
    color: var(--sw-warning-text);
  }
  .callrow.in_call .cs,
  .callrow.ending .cs {
    color: var(--sw-accent-text);
  }
  .cs.muted {
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
  .dur {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-3);
    direction: ltr;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
  }
  .acts .grow {
    flex: 1 1 auto;
  }
  .result {
    padding: var(--sw-s-2) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    font-size: var(--sw-fs-sm);
    line-height: 1.4;
  }
  .result.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .result.warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .result.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  /* in the drawer the outcome sticks to the top of the scrolling body, over a solid backing (the soft tones are translucent) */
  .result.sticky {
    position: sticky;
    inset-block-start: 0;
    z-index: 3;
    background-color: var(--sw-surface-solid);
    box-shadow: var(--sw-shadow-1);
  }
  .result.sticky.ok {
    background-image: linear-gradient(var(--sw-success-soft), var(--sw-success-soft));
  }
  .result.sticky.warn {
    background-image: linear-gradient(var(--sw-warning-soft), var(--sw-warning-soft));
  }
  .result.sticky.err {
    background-image: linear-gradient(var(--sw-danger-soft), var(--sw-danger-soft));
  }
  .tech {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    padding-block-start: var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .tech .sp {
    flex: 1;
  }
  code,
  .ltr {
    font-family: var(--sw-font-mono);
    direction: ltr;
    unicode-bidi: isolate;
  }

  /* ---- list rows ---- */
  .rows {
    display: flex;
    flex-direction: column;
  }
  /* a row is two groups: the station (opens the drawer) and its side - call pill, "seen", actions, chevron. When the row is
     narrow the side takes its own line below the station, whole, instead of squeezing the station's name away. */
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
    padding: var(--sw-s-2) var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
  }
  .row:first-child {
    border-block-start: 0;
  }
  .rowside {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2) var(--sw-s-3);
    margin-inline-start: auto;
  }
  .rowmain {
    flex: 1 1 220px;
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    min-inline-size: min(220px, 100%);
    min-block-size: var(--wk-hit);
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .thumb {
    flex: none;
    inline-size: 64px;
    block-size: 40px;
    border-radius: var(--sw-r-xs);
    overflow: hidden;
    background: var(--sw-surface-3);
    display: grid;
    place-items: center;
    color: var(--sw-text-3);
  }
  .thumb img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb.off img {
    filter: grayscale(1) brightness(0.7);
  }
  .rowtext {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .rowtext .t {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
  }
  .row[data-status='ringing'] {
    background: var(--sw-warning-soft);
  }
  .rowtext .t b {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rowtext .s {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sdot {
    flex: none;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: var(--sw-live);
  }
  .sdot.off {
    background: var(--sw-offline);
  }
  .seen {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    white-space: nowrap;
  }
  .rowacts {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
  }
  .pillcall {
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: 2px var(--sw-s-3);
    border-radius: var(--sw-r-pill);
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
  }
  .pillcall.in_call,
  .pillcall.ending {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }

  /* ---- the drawer ---- */
  .live {
    position: relative;
    flex: none;
    aspect-ratio: 16 / 9;
    border-radius: var(--sw-r-md);
    overflow: hidden;
    background: var(--sw-surface-3);
  }
  .live img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    filter: saturate(0.7) brightness(0.85);
  }
  .live.off img {
    filter: grayscale(1) brightness(0.6);
  }
  .live .ov {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--sw-s-3);
    background: linear-gradient(180deg, transparent, var(--sw-video-scrim));
    color: var(--sw-on-video);
    text-align: center;
  }
  .live .ov .t {
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-semibold);
  }
  .live .none {
    padding-block-end: 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  /* CR-036 S12 / WXSCH: the quiet ways on from a station - its entry log, the schedules of its doors */
  .evlink {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: var(--sw-s-2);
  }
  .dsec {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    flex: none;
    padding: var(--sw-s-4);
    border: 1px solid transparent;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface-2);
  }
  /* R5-SECURITY: the drawer's sections are wells; their headings 14.5/700 in the heading ink; the door name 15/700 */
  .dsec h4 {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    margin: 0;
    color: var(--sw-heading, var(--sw-text));
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
  }
  .doorrow {
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    min-block-size: var(--wk-hit);
  }
  .doorrow .dn {
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-lg);
    color: var(--sw-heading, var(--sw-text));
  }
  .doorrow .ds {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-1);
    min-inline-size: 0;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .kv {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sw-s-2) var(--sw-s-4);
    margin: 0;
    font-size: var(--sw-fs-sm);
  }
  .kv dt {
    color: var(--sw-text-3);
  }
  .kv dd {
    margin: 0;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding-inline: var(--sw-s-1);
    border: 0;
    border-radius: var(--sw-r-sm);
    background: none;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    text-align: start;
    cursor: pointer;
  }
  .toggle sw-icon {
    transition: transform var(--sw-t-fast) var(--sw-ease);
  }
  .toggle[aria-expanded='true'] sw-icon {
    transform: rotate(180deg);
  }
  .toggle:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .prog {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-1);
    padding-block: var(--sw-s-2);
    border-block-start: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
  }
  .prog:first-of-type {
    border-block-start: 0;
  }
  .prog .ph {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    font-weight: var(--sw-fw-semibold);
  }
  .prog .line {
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--sw-text-3);
  }
  .tbl {
    min-inline-size: 0;
  }
  .sentence {
    margin: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.5;
  }

  @media (max-width: 1100px) {
    .layout {
      --wk-tree: 208px;
    }
  }
  @media (max-width: 767px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .treecol {
      display: none;
    }
    .chip.places {
      display: inline-flex;
    }
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      padding-block-end: 2px;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .toolbar .lbl {
      display: none;
    }
    .search {
      flex-basis: 160px;
    }
    .seen {
      display: none;
    }
  }
  @keyframes wk-ring {
    0%,
    100% {
      box-shadow: 0 0 0 2px var(--sw-warning);
    }
    50% {
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--sw-warning) 35%, transparent);
    }
  }
  @keyframes wk-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card.ringing,
    .strip .dot {
      animation: none;
    }
  }
`;
