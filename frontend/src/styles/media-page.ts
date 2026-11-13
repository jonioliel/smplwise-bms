import { css } from 'lit';
import { leadReserveStyles } from './lead-reserve';
import { liftedReset } from '../components/top-layer';

/**
 * CR-016: the page chrome shared by the players page and the groups page (the screens page keeps its own copy, 0.1.149): the
 * sticky header with the large title, the room chips, the floor menu, the state filter and the search, the sections with their
 * headers, the card grid, the edit chips, the toast. Rules read the glass knobs of styles/media-glass.ts only; a designer who
 * restyles the multimedia area edits that file and this one, no page.
 */
export const mediaPageStyles = css`
    ${liftedReset}
    :host {
      display: block;
      position: relative;
      overflow: auto;
      scrollbar-width: thin;
      background: var(--dv-page-backdrop);
      color: var(--dv-text);
      font-family: var(--dv-font);
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
    /* AUDIT30-D3 (audit round 30 #6): the page frame is the shared <sw-page class="page" wide> - the title, the one-line summary under
       it and the floor menu at the end of the title row come from it (its padding is --sw-page-pad; --mm-pad mirrors it for the
       edge-to-edge bars below). Below it, the filter bar (.dh) and the cards. */
    .page {
      --mm-pad: var(--sw-page-pad);
    }
    /* the filter bar: the room chips, the pager, the state filter, the search; it sticks and compacts while the page scrolls */
    .dh {
      position: sticky;
      inset-block-start: 0;
      z-index: 15;
      margin-inline: calc(-1 * var(--mm-pad));
      padding: var(--sw-s-1) var(--mm-pad);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2) var(--sw-s-3);
    }
    /* Compacting is purely visual: it never changes the header's height in the flow. A header that shrank at scrollTop ~60 moved
       every card under the finger and, with the scroll clamped, fell back under the threshold and expanded again (the list jumped
       back and forth on a phone, the first group heading slid over the search field). The bar is a layer of the measured height of
       the title row (measureHeaderBar below); what folds away fades out in place and stops taking taps. */
    .dh::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      block-size: var(--mm-bar-h, 64px);
      z-index: -1;
      opacity: 0;
      pointer-events: none;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border-block-end: 1px solid var(--dv-border);
      box-shadow: var(--dv-shadow-1);
      transition: opacity var(--mm-motion) var(--mm-ease);
    }
    .dh.compact {
      pointer-events: none;
    }
    .dh.compact::before {
      opacity: 1;
      pointer-events: auto;
    }
    .dh.compact .dh-row > * {
      pointer-events: auto;
    }
    .dh-row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      flex: 1 1 320px;
      min-inline-size: 0;
    }
    /* the bar is not the page's first row any more (sw-page's title row is, and it keeps the shell's lead reserve itself) */
    :host sw-page.page .dh .dh-row {
      padding-inline-start: 0;
    }
    .rooms {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 6px 18px;
      /* the first chip lines up with the title above: the fade's room hangs outside the text edge */
      margin-inline-start: -18px;
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
      mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
      user-select: none;
      touch-action: pan-x;
    }
    .rooms::-webkit-scrollbar {
      display: none;
    }
    .rooms.dragging {
      cursor: grabbing;
    }
    .rc {
      flex: none;
      /* AUDIT30-D1: the chip is a control of the shared height (34 in the classic skin; 44 on touch below) */
      block-size: var(--sw-ctl-h-md);
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      font-size: var(--sw-fs-md);
      font-weight: 500;
      color: var(--dv-text-2);
      white-space: nowrap;
      transition: background var(--mm-motion), color var(--mm-motion), transform var(--sw-t-press) var(--sw-ease-out);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    /* R5-MEDIA-ENERGY-297 (mobile-native): hover only under a pointer that hovers; the chip sinks on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .rc:hover {
        color: var(--dv-text);
        background: var(--dv-surface);
      }
    }
    .rc:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    /* AUDIT30-D1 (audit round 30 #4, owner question 3 answer a): the chosen room is the product's one selected look - the soft accent
       fill with the accent ink (Blue Wash), no border, no shadow; it was a black pill (--dv-text fill) */
    .rc[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: transparent;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: none;
    }
    .rc:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .flwrap {
      position: relative;
      flex: none;
    }
    .dh-det {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      transition: opacity var(--mm-motion), visibility var(--mm-motion);
    }
    .dh-det {
      flex: 0 1 auto;
      min-inline-size: 0;
    }
    .dh.compact .dh-det {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 38px;
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      min-inline-size: 240px;
      color: var(--dv-text-2);
    }
    .search:focus-within {
      outline: 2px solid var(--dv-focus);
      outline-offset: 1px;
    }
    .search input {
      border: 0;
      background: transparent;
      outline: none;
      flex: 1;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      color: var(--dv-text);
    }
    .search input::placeholder {
      color: var(--dv-text-2);
    }
    .search .ic {
      font-size: var(--sw-fs-lg);
    }
    /* groups and the grid */
    .groups {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .fsec {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sh {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      padding-inline: 4px;
    }
    /* AUDIT30-D2 (audit round 30 #17): a section heading sits one tier under the page title (the 26-30 px / 800 heading competed
       with the title, so a screen read as having several); it is the section step of the scale, semibold */
    .sh h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
      letter-spacing: -0.01em;
      line-height: 1.2;
      color: var(--sw-heading, var(--dv-text));
    }
    .shlink {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border-radius: var(--sw-r-sm);
      min-block-size: 28px;
    }
    .shlink .ic {
      font-size: var(--sw-fs-2xl);
      color: var(--dv-text-3);
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .shlink:hover .ic {
        transform: translateX(-3px);
      }
    }
    .shlink:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .sh small {
      display: block;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      margin-block-start: 1px;
    }
    .sh small em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: 600;
    }
    .pgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr));
      gap: var(--dv-gap-lg);
      align-items: start;
    }
    /* edit chips on a card */
    .ecard {
      position: absolute;
      inset-block-start: 18px;
      inset-inline-end: 18px;
      display: flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-perf-glass-bg, var(--mm-sheet-surface));
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(16px));
      backdrop-filter: var(--sw-perf-blur, blur(16px));
      box-shadow: var(--dv-shadow-control);
      border: 1px solid var(--dv-border);
    }
    .ecard button {
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      color: var(--dv-text);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      transition: background var(--mm-motion), transform var(--sw-t-press) var(--sw-ease-out);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .ecard button:hover {
        background: var(--dv-surface-3);
      }
    }
    .ecard button:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .ecard button[aria-pressed='true'] {
      color: var(--dv-accent-text);
      background: var(--dv-accent-soft);
    }
    .ecard button[disabled] {
      opacity: 0.35;
    }
    .ecard .ic {
      font-size: var(--sw-fs-lg);
    }
    /* the confirmation dialogs carry the sheet material (a translucent glass panel over a dimmed page reads as washed out) */
    media-bulk-dialog,
    media-group-dialog,
    media-preset-editor,
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .editing-stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .edit-layout {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    @media (min-width: 1100px) {
      .edit-layout {
        display: grid;
        grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .edit-side {
        position: sticky;
        inset-block-start: 76px;
        max-block-size: calc(100dvh - 96px);
        overflow: auto;
        scrollbar-width: thin;
      }
    }
    .note-bad {
      color: var(--dv-danger);
      font-size: var(--sw-fs-base);
      font-weight: 600;
    }
    .toast {
      position: fixed;
      z-index: 90;
      inset-inline: 0;
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100% - 24px);
      inset-block-end: 26px;
      background: var(--sw-toast-bg);
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(20px));
      backdrop-filter: var(--sw-perf-blur, blur(20px));
      color: var(--sw-toast-text);
      padding: 11px 20px 11px 16px;
      border-radius: var(--sw-r-pill);
      border: 1px solid color-mix(in srgb, var(--sw-toast-text) 12%, transparent);
      font-size: var(--sw-fs-base);
      font-weight: 500;
      box-shadow: var(--sw-shadow-3);
      display: flex;
      gap: 9px;
      align-items: center;
      animation: mm-pop var(--mm-motion) var(--mm-ease);
    }
    .toast .ic {
      color: var(--sw-success);
      font-size: var(--sw-fs-lg);
    }
    /* SHARED-POLISH-2342 (TKSET-POLISH-2331 proposal): a failure toast - the same pill, the icon in the danger ink instead of the
       success green, mixed toward the toast's own ink so it keeps its contrast on the dark pill in both schemes (the automations
       recipe); every page on this sheet gets it by adding class="bad" */
    .toast.bad .ic {
      color: color-mix(in srgb, var(--sw-danger) 70%, var(--sw-toast-text));
    }
    @media (pointer: coarse), (max-width: 767px) {
      .rc,
      .search {
        block-size: 44px;
      }
      .ecard button {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      /* sw-page's phone padding */
      .page {
        --mm-pad: var(--sw-s-3);
      }
      .dh {
        flex-direction: column;
        align-items: stretch;
        flex-wrap: nowrap;
      }
      /* stuck at the top, the room row is what stays: it keeps clear of the shell's floating search / status corner */
      .dh-row {
        flex: none;
        padding-inline-end: var(--sw-float-reserve, 0px);
      }
      .dh-row .rooms {
        margin-inline: calc(-1 * var(--mm-pad));
        padding-inline: var(--mm-pad);
      }
      .dh-det .seg {
        overflow-x: auto;
        scrollbar-width: none;
      }
      .search {
        min-inline-size: 0;
        flex: 1 1 100%;
      }
      .pgrid {
        grid-template-columns: minmax(0, 1fr);
      }
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 14px);
      }
      .groups {
        gap: 22px;
      }
    }
    /* The screens that still draw the OLD frame - a plain div.page whose sticky bar carries the large title (devices schedules and
       automations, notifications, the screens not yet on sw-page) - keep it until they adopt sw-page: the rules above are written for
       the sw-page frame (no page padding of its own, the bar a wrapping row), and on the old frame they dropped the page padding, the
       title style and the shell's start-edge chip room (layout-dd-click placement 4 fell back to 1 on #/devices/schedules). */
    div.page {
      --mm-pad: 36px;
      padding: 0 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 26px;
      min-block-size: 100%;
    }
    div.page .dh {
      padding: 16px 36px 4px;
      padding-inline-end: calc(36px + var(--sw-float-reserve, 0px));
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: stretch;
      gap: 12px;
    }
    div.page .dh::before {
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    div.page .dh-row {
      flex: none;
      gap: 12px 18px;
    }
    div.page .rooms {
      margin-inline-start: 0;
    }
    div.page h1 {
      margin: 0;
      font-family: var(--sw-font-heading);
      font-size: var(--mm-fs-page-title);
      font-weight: var(--sw-h1-weight, 700);
      letter-spacing: var(--sw-h1-tracking, -0.6px);
      line-height: 1.2;
      color: var(--sw-heading, var(--sw-text));
      flex: none;
      transition: font-size var(--mm-motion) var(--mm-ease);
    }
    div.page .dh.compact h1 {
      font-size: var(--mm-fs-page-title-compact);
    }
    div.page .amb {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    div.page .amb em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: 600;
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      div.page {
        --mm-pad: 24px;
        padding-inline: 24px;
      }
      div.page .dh {
        padding-inline: 24px;
        padding-inline-end: calc(24px + var(--sw-float-reserve, 0px));
      }
    }
    @media (max-width: 767px) {
      div.page {
        --mm-pad: 14px;
        padding: 0 14px 26px;
        gap: 18px;
      }
      div.page .dh {
        padding: 12px 14px 2px;
        padding-inline-end: 14px;
        gap: 10px;
      }
      div.page .dh-row {
        display: grid;
        /* the third column keeps the row clear of the shell's floating search / status corner */
        grid-template-columns: minmax(0, 1fr) auto var(--sw-float-reserve, 0px);
        grid-template-areas: 't f .' 'r r r';
        gap: 10px;
        padding-inline-end: 0;
      }
      div.page .dh-row h1 {
        grid-area: t;
      }
      /* a long title wraps to two lines on a phone: a smaller compact font would shorten the header and feed back into the scroll */
      div.page .dh.compact h1 {
        font-size: var(--mm-fs-page-title);
      }
      div.page .dh-row .flwrap {
        grid-area: f;
      }
      div.page .dh-row .rooms {
        grid-area: r;
        margin-inline: calc(-1 * var(--mm-pad));
      }
      div.page .dh.compact .rooms {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      div.page .amb {
        display: none;
      }
    }
    /* header dropdown placement 4: the title row keeps the shell's start-edge chip room free (0 everywhere else) */
    ${leadReserveStyles}
  `;

/**
 * The compact bar of `.dh::before` covers the title row only: its height is measured, never guessed, and only written when it
 * changed. Call it from `updated()` of every page that uses the shared header.
 */
export function measureHeaderBar(root: ParentNode, phone: boolean): void {
  const dh = root.querySelector<HTMLElement>('.dh');
  if (!dh) return;
  const top = dh.getBoundingClientRect().top;
  let bottom = 0;
  // the old frame (the title inside the bar): on a phone the bar is the title row only - the room row under it folds away
  const legacy = phone && !!dh.querySelector(':scope > .dh-row > h1');
  for (const el of dh.querySelectorAll<HTMLElement>(legacy ? ':scope > .dh-row > h1, :scope > .dh-row > .flwrap' : ':scope > .dh-row > *')) bottom = Math.max(bottom, el.getBoundingClientRect().bottom - top);
  const h = `${Math.ceil(bottom + (phone ? 8 : 10))}px`;
  if (bottom && dh.style.getPropertyValue('--mm-bar-h') !== h) dh.style.setProperty('--mm-bar-h', h);
}
