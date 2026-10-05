import { css } from 'lit';

/**
 * CR-016: the page chrome shared by the players page and the groups page (the screens page keeps its own copy, 0.1.149): the
 * sticky header with the large title, the room chips, the floor menu, the state filter and the search, the sections with their
 * headers, the card grid, the edit chips, the toast. Rules read the glass knobs of styles/media-glass.ts only; a designer who
 * restyles the multimedia area edits that file and this one, no page.
 */
export const mediaPageStyles = css`
    :host {
      display: block;
      position: relative;
      overflow: auto;
      scrollbar-width: thin;
      background: var(--dv-backdrop);
      color: var(--dv-text);
      font-family: var(--dv-font);
      font-size: 14px;
      line-height: 1.5;
    }
    .page {
      padding: 0 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 26px;
      min-block-size: 100%;
    }
    /* the header: a large title, rooms, the floor menu; it sticks and compacts while scrolling */
    .dh {
      position: sticky;
      inset-block-start: 0;
      z-index: 15;
      margin-inline: -36px;
      padding: 16px 36px 4px;
      padding-inline-end: calc(36px + var(--sw-float-reserve, 0px));
      display: flex;
      flex-direction: column;
      gap: 12px;
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
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
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
      gap: 12px 18px;
      min-inline-size: 0;
    }
    h1 {
      margin: 0;
      font-size: var(--mm-fs-page-title);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.04;
      flex: none;
      transition: font-size var(--mm-motion) var(--mm-ease);
    }
    .dh.compact h1 {
      font-size: var(--mm-fs-page-title-compact);
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
      block-size: 38px;
      padding-inline: 17px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      font-size: 14px;
      font-weight: 500;
      color: var(--dv-text-2);
      white-space: nowrap;
      transition: background var(--mm-motion), color var(--mm-motion);
    }
    .rc:hover {
      color: var(--dv-text);
      background: var(--dv-surface);
    }
    .rc[aria-pressed='true'] {
      background: var(--dv-text);
      border-color: transparent;
      color: var(--mm-text-inverse);
      font-weight: 600;
      box-shadow: var(--dv-shadow-control);
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
    .dh.compact .dh-det {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .amb {
      font-size: 14px;
      color: var(--dv-text-2);
    }
    .amb em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: 600;
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
      font-size: 13.5px;
      color: var(--dv-text);
    }
    .search input::placeholder {
      color: var(--dv-text-2);
    }
    .search .ic {
      font-size: 16px;
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
    .sh h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
    .shlink {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border-radius: 8px;
      min-block-size: 28px;
    }
    .shlink .ic {
      font-size: 19px;
      color: var(--dv-text-3);
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    .shlink:hover .ic {
      transform: translateX(-3px);
    }
    .shlink:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .sh small {
      display: block;
      font-size: 13px;
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
      border-radius: 999px;
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
      font-size: 11px;
      font-weight: 700;
    }
    .ecard button:hover {
      background: var(--dv-surface-3);
    }
    .ecard button[aria-pressed='true'] {
      color: var(--dv-accent-text);
      background: var(--dv-accent-soft);
    }
    .ecard button[disabled] {
      opacity: 0.35;
    }
    .ecard .ic {
      font-size: 16px;
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
      font-size: 13px;
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
      background: rgba(28, 28, 30, 0.88);
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(20px));
      backdrop-filter: var(--sw-perf-blur, blur(20px));
      color: #fff;
      padding: 11px 20px 11px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 13.5px;
      font-weight: 500;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      display: flex;
      gap: 9px;
      align-items: center;
      animation: mm-pop var(--mm-motion) var(--mm-ease);
    }
    .toast .ic {
      color: #30d158;
      font-size: 16px;
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
      .page {
        padding: 0 14px 26px;
        gap: 18px;
      }
      .dh {
        margin-inline: -14px;
        padding: 12px 14px 2px;
        padding-inline-end: 14px;
        gap: 10px;
      }
      .dh-row {
        display: grid;
        /* the third column keeps the row clear of the shell's floating search / status corner */
        grid-template-columns: minmax(0, 1fr) auto var(--sw-float-reserve, 0px);
        grid-template-areas: 't f .' 'r r r';
        gap: 10px;
      }
      .dh-row h1 {
        grid-area: t;
      }
      /* a long title wraps to two lines on a phone: a smaller compact font would shorten the header and feed back into the scroll */
      .dh.compact h1 {
        font-size: var(--mm-fs-page-title);
      }
      .dh-row .flwrap {
        grid-area: f;
      }
      .dh-row .rooms {
        grid-area: r;
        margin-inline: -14px;
        padding-inline: 14px;
      }
      .dh.compact .rooms {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      .amb {
        display: none;
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
        inset-block-end: calc(var(--sw-bottomnav-h, 66px) + 14px);
      }
      .groups {
        gap: 22px;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .page {
        padding-inline: 24px;
      }
      .dh {
        margin-inline: -24px;
        padding-inline: 24px;
        padding-inline-end: calc(24px + var(--sw-float-reserve, 0px));
      }
    }
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
  for (const el of dh.querySelectorAll<HTMLElement>(phone ? ':scope > .dh-row > h1, :scope > .dh-row > .flwrap' : ':scope > .dh-row > *')) bottom = Math.max(bottom, el.getBoundingClientRect().bottom - top);
  const h = `${Math.ceil(bottom + (phone ? 8 : 10))}px`;
  if (bottom && dh.style.getPropertyValue('--mm-bar-h') !== h) dh.style.setProperty('--mm-bar-h', h);
}
