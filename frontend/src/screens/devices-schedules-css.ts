import { css } from 'lit';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles } from '../styles/media-page';
import { bubbleChrome } from '../styles/bubble-chrome';
import { chipSelected, chipSelectedCheck } from '../styles/chip-selected';

/**
 * CR-STRUCT-CSS-SPLIT-2442 (code review 06:STRUCT-1 step 1): the style sheets of `devices-schedules` (screens/devices-schedules.ts), moved here as they
 * stood - same CSS text, same order, same composition of the array. The screen keeps `static styles = devicesSchedulesStyles`.
 */

export const devicesSchedulesStyles = [bubbleChrome, ...automationsStyles, mediaPageStyles, css`
    /* PAGING-SETTING-2439 (owner round 32, Q-SYS-4 a: the page itself never moves): with the long lists set to scroll (הגדרות › כללי) the
       screen keeps its box on a desktop - the title, the chips, the toolbar and the upcoming strip stay - and only the list panel (.groups) scrolls */
    @media (min-width: 1024px) {
      :host([data-list-panel]) {
        overflow: hidden;
      }
      :host([data-list-panel]) sw-page.page {
        block-size: 100%;
        min-block-size: 0;
      }
      :host([data-list-panel]) .groups {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
    }
    /* AUDIT30-I3 (owner Q9 option a): dialogs are opaque (was the media sheet surface and its blur) */
    sw-dialog {
      --sw-surface: var(--sw-surface-solid);
      --sw-glass-blur: none;
    }
    /* AUDIT30-I4 (#6, #8): the page frame is the product's <sw-page> (its title, its actions at the end of the title row); the media
       page keeps its padding (.page) and the toolbar below the title. The title row no longer sticks: the floor chips and the toolbar
       are the first rows of the page body. */
    sw-page.page {
      padding-block-start: var(--sw-s-4);
      gap: var(--sw-s-3);
    }
    .dh {
      position: static;
      padding-block-start: 0;
    }
    .dh-row.fl {
      display: flex;
    }
    /* on a desktop the floor chips stay in the title row (sw-page's actions, as before the frame change: the list keeps its rows);
       a long floor list scrolls sideways inside its own strip */
    .dh-row.hdact {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .dh-row.hdact .rooms {
      max-inline-size: 50vw;
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen floor chip is the Blue Wash pair (the shared media rule paints it --dv-text) */
    .rc[aria-pressed='true'] {
      ${chipSelected}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${chipSelectedCheck}
    }
    .dh-det .grow {
      min-inline-size: 0;
    }
    /* POLISH-295: narrow enough that the review chip, the filter, the search and "חדש" stay on the toolbar row at 1440 */
    .search {
      min-inline-size: 150px;
      flex: 1 1 150px;
      max-inline-size: 260px;
    }
    /* POLISH-295: below a wide desktop the filter button is its icon (and its count), so the toolbar stays one row */
    @media (min-width: 768px) and (max-width: 1600px) {
      .foldbtn .lbl {
        display: none;
      }
    }
    .newbtn[disabled] {
      opacity: 0.5;
    }
    .foldbtn small {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-bold);
      color: var(--dv-accent-text);
    }
    .vwrap {
      flex: none;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the view switch is sw-segmented (icon-only keys); its 40 / 44 px keys and the larger icon through the knobs */
    sw-segmented.views {
      --sw-seg-ico-pad: 12px;
      --sw-seg-key-min-w: 40px;
      --sw-seg-icon-size: var(--sw-fs-lg);
    }
    /* the filters behind "סינון": the same chips and dropdown chips as the header */
    .more {
      flex: 1 1 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
    }
    .more .days {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
      max-inline-size: 100%;
    }
    /* the bubble skin: the card's selection box and "..." key meet the touch dial on every width (the skin's rule) */
    @media (min-width: 1101px) and (pointer: fine) {
      :host([data-skin='bubble']) .pick,
      :host([data-skin='bubble']) .more-btn {
        inline-size: var(--sw-touch-desktop);
        block-size: var(--sw-touch-desktop);
      }
    }
    .rc.day {
      inline-size: 38px;
      padding-inline: 0;
    }
    .more .sep {
      inline-size: 1px;
      block-size: 22px;
      background: var(--dv-border);
    }
    .dh.compact .more {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    /* ---- "today" (the runs still to come today): one quiet glass row ---- */
    .upnext {
      display: flex;
      align-items: center;
      gap: 10px 14px;
      padding: 8px 16px;
      flex-wrap: wrap;
    }
    .upnext::-webkit-scrollbar {
      display: none;
    }
    /* R5-DEVICES-297: "today" is the live object of the list - its word is a heading and the next time a display figure */
    .upnext > b {
      flex: none;
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
    }
    .up {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-md);
      color: var(--dv-text);
      white-space: nowrap;
    }
    .up time {
      font-weight: 800;
      font-size: var(--sw-fs-xl);
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
    }
    .up .what {
      color: var(--dv-text-2);
    }
    .up i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--c);
      flex: none;
    }
    /* ---- the card: the automation card's shape (sw-automation-card.ts), a schedule's content ---- */
    .acard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px 14px;
      block-size: 100%;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--dv-shadow-2);
      transition: box-shadow var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    /* R5-DEVICES-297: the card is the top step (shadow 2 at rest); hover is for a fine pointer only */
    @media (hover: hover) and (pointer: fine) {
      .acard:hover {
        box-shadow: var(--dv-shadow-3, var(--dv-shadow-2));
      }
    }
    .acard:focus-within {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard[data-picked] {
      border-color: var(--dv-accent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard[data-menu] {
      z-index: 20;
    }
    .acard.off .bar,
    .acard.off .meta {
      opacity: 0.55;
    }
    .acard header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-inline-size: 0;
    }
    .ttl {
      flex: 1;
      min-inline-size: 0;
    }
    .acard h3 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name {
      color: inherit;
      text-decoration: none;
    }
    .acard a.name::after {
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
      align-items: center;
      gap: 0 8px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      min-inline-size: 0;
    }
    .where b {
      color: var(--dv-text);
      font-weight: var(--sw-fw-bold);
      white-space: nowrap;
    }
    .where .ic {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-3);
    }
    .where .ar {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ctl,
    .pick,
    .bar,
    .meta,
    .acard footer {
      position: relative;
      z-index: 2;
    }
    .ctl {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: none;
    }
    .pick {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      margin-block-start: -2px;
      margin-inline-start: -6px;
      border-radius: 50%;
      flex: none;
      cursor: pointer;
    }
    .pick:hover {
      background: var(--dv-surface-3);
    }
    input[type='checkbox'] {
      inline-size: 17px;
      block-size: 17px;
      accent-color: var(--dv-accent);
      margin: 0;
      cursor: pointer;
    }
    .more-btn {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-2);
    }
    .more-btn:hover,
    .more-btn[aria-expanded='true'] {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .more-btn .ic {
      font-size: var(--sw-fs-2xl);
    }
    .acard .pop {
      background: var(--sw-menu-surface);
      inset-block-start: 52px;
      inset-inline-end: 12px;
      min-inline-size: 190px;
    }
    .acard .pop button {
      flex: none;
    }
    .pop button.dz,
    .pop button.dz .ic {
      color: var(--dv-danger);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      min-block-size: 26px;
    }
    .acard footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-block-start: auto;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .run {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
    }
    .run b {
      color: var(--sw-heading, var(--dv-text));
      font-weight: 800;
      font-size: var(--sw-fs-lg);
    }
    /* ---- POLISH-295: the rows view (the approved preview): one row per schedule, the whole row opens the drawer ----
       R5-DEVICES-297: the rows are wells (one tone step down, rounded, no hairlines) inside the glass panel; the name is a heading,
       the next-run time a bold figure; a disabled schedule sits a step deeper with quiet ink; the row sinks on pointer-down */
    .rlist {
      padding: 4px;
      overflow: visible;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .lr {
      position: relative;
      display: grid;
      grid-template-columns: 44px minmax(0, 1.6fr) auto minmax(140px, 1.3fr) minmax(130px, 1fr) 44px;
      align-items: center;
      gap: var(--sw-s-3);
      /* loop 2: 56 px rows + 4 px gaps pushed the pager under the fold at 1440x900 (no scrolling in control screens): 52 + 3 keeps
         ten rows and the pager on one screen */
      min-block-size: 52px;
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      font-size: var(--sw-fs-base);
      transition: background-color var(--mm-motion) var(--mm-ease), transform var(--sw-t-fast, 120ms) var(--sw-ease, ease-out);
    }
    .rlist.picking .lr {
      grid-template-columns: 32px 44px minmax(0, 1.6fr) auto minmax(140px, 1.3fr) minmax(130px, 1fr) 44px;
    }
    .lr[data-picked] {
      background: var(--dv-accent-soft);
    }
    .lr[data-menu] {
      z-index: 20;
    }
    .lr.off {
      background: var(--dv-surface-3);
    }
    .lr:active {
      transform: scale(var(--sw-press-scale, 1));
      background: var(--sw-pressed-wash, var(--dv-surface-3));
    }
    @media (hover: hover) and (pointer: fine) {
      .lr:hover {
        background: var(--dv-surface-3);
      }
      .lr[data-picked]:hover {
        background: var(--dv-accent-soft);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .lr {
        transition-duration: 0.01ms;
      }
    }
    .lr .name {
      display: block;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lr .name::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .lr .name:focus-visible::after {
      outline: var(--sw-focus-w) solid var(--dv-focus);
      outline-offset: -2px;
    }
    .lname {
      min-inline-size: 0;
    }
    .lname .sub {
      display: block;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lname .sub b {
      color: var(--dv-text);
      font-weight: var(--sw-fw-semibold);
    }
    .lsel,
    .ltog,
    .lops {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
    }
    .lops {
      justify-content: flex-end;
    }
    /* FIX2200: the menu key keeps its touch size (the column is 44 px; a flex item shrank it to 36-40 px, the 2.20.0 bubble guard) */
    .lops .more-btn {
      flex: none;
    }
    .lops .pop {
      background: var(--sw-menu-surface);
      inset-block-start: 42px;
      inset-inline-end: 0;
      min-inline-size: 190px;
    }
    .lsel .pick {
      margin: 0;
    }
    .lr.off .ldays,
    .lr.off .lbar {
      opacity: 0.55;
    }
    .lr.off .name {
      color: var(--dv-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .lbar {
      min-inline-size: 0;
    }
    .lnext {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .lnext b {
      color: var(--sw-heading, var(--dv-text));
      font-weight: 800;
      font-size: var(--sw-fs-lg);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .lnext.warn {
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* the pager sits close under its page (the groups' 30 px gap is for groups), so a page of rows fits 1440x900 */
    .lfoot {
      display: flex;
      justify-content: flex-end;
      margin-block-start: calc(var(--sw-s-6) * -1);
    }
    /* the review chip beside the state filter (an administrator's; it replaced the banner) */
    .rc.attn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .rc.attn small {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-warning-text);
    }
    .wdot {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dv-warning);
      flex: none;
    }
    /* "today" as a 24-hour timeline (LTR like every time bar of the product) */
    .upnext .tl {
      position: relative;
      flex: 1 1 260px;
      min-inline-size: 160px;
      block-size: 30px;
      direction: ltr;
    }
    .upnext .track {
      position: absolute;
      inset-inline: 0;
      inset-block-start: 6px;
      block-size: 6px;
      border-radius: var(--sw-r-2xs);
      background: var(--dv-surface-3);
      overflow: hidden;
    }
    .upnext .past {
      position: absolute;
      inset-block: 0;
      left: 0;
      background: var(--dv-border-strong);
    }
    .upnext .now {
      position: absolute;
      inset-block-start: 1px;
      block-size: 16px;
      inline-size: 2px;
      margin-inline-start: -1px;
      background: var(--dv-accent);
      border-radius: 1px;
    }
    .upnext .hr {
      position: absolute;
      inset-block-start: 15px;
      transform: translateX(-50%);
      font-size: var(--sw-fs-2xs);
      color: var(--dv-text-3);
      font-variant-numeric: tabular-nums;
    }
    .upnext .hr.h0 {
      transform: none;
    }
    .upnext .hr.h24 {
      transform: translateX(-100%);
    }
    .upnext .tdot {
      position: absolute;
      inset-block-start: 9px;
      inline-size: 10px;
      block-size: 10px;
      margin: -5px 0 0 -5px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 2px var(--dv-surface);
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    .upnext .tdot.nx {
      inline-size: 12px;
      block-size: 12px;
      margin: -6px 0 0 -6px;
    }
    a.up {
      color: inherit;
      text-decoration: none;
      min-block-size: 32px;
    }
    /* FIX2200: the bubble skin's touch dial is the floor of every hit target, the next-run link included (195x32 in the 2.20.0 guard) */
    :host([data-skin='bubble']) a.up {
      min-block-size: var(--sw-touch-desktop);
    }
    /* FIX2200: the pager's keys meet the touch dial in the bubble skin (30x30 in the 2.20.0 guard) */
    :host([data-skin='bubble']) sw-pager {
      --sw-ctl-h-md: var(--sw-touch-desktop);
    }
    @media (pointer: coarse), (max-width: 767px) {
      a.up {
        min-block-size: 44px;
      }
      /* FIX2232B: the pager's keys are 44 px touch targets at a phone width too (30x30 in the 2.23.2 guard since the cards view pages) */
      sw-pager {
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-lg: max(44px, var(--sw-touch-desktop, 44px));
      }
      /* the shared back key of the trash and the review pages (sw-page backHref) is a 44 px target at a phone width too (28x28 in
         the I18N-EN-SWITCH-2438 entry check, layout-schedules-parity) */
      sw-page::part(back) {
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
    }
    a.up:focus-visible {
      outline: var(--sw-focus-w) solid var(--dv-focus);
      outline-offset: 2px;
      border-radius: var(--sw-r-xs);
    }
    .upnext .up .nm {
      max-inline-size: 22ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (max-width: 1100px) and (min-width: 768px) {
      .lr {
        grid-template-columns: 44px minmax(0, 1.6fr) auto minmax(130px, 1fr) 44px;
      }
      .rlist.picking .lr {
        grid-template-columns: 32px 44px minmax(0, 1.6fr) auto minmax(130px, 1fr) 44px;
      }
      .lr > .lbar {
        display: none;
      }
    }
    @media (max-width: 767px) {
      .lr {
        grid-template-columns: 44px minmax(0, 1fr) auto 44px;
        gap: var(--sw-s-2);
        padding-inline: var(--sw-s-3);
      }
      .rlist.picking .lr {
        grid-template-columns: 28px 44px minmax(0, 1fr) auto 44px;
      }
      .lr > .ldays,
      .lr > .lbar {
        display: none;
      }
      /* loop 2 (break-ui at 390 px): the next-run column was 38vw and the name was cut to one word ("מאוור..."): the time keeps
         its weight at the base size and the name gets the room */
      .lnext {
        /* R5 fix: 30vw cut the next-run line ("היום 17:00 · ב..."); the earlier 38vw shows it whole again */
        max-inline-size: 38vw;
        font-size: var(--sw-fs-sm);
      }
      .lnext b {
        font-size: var(--sw-fs-base);
      }
      .lr .name {
        font-size: var(--sw-fs-md);
      }
      .upnext .tl {
        flex-basis: 100%;
        order: 2;
      }
    }
    /* ---- the table ---- */
    .tbl {
      overflow: hidden;
      padding: 0;
    }
    .tr {
      display: grid;
      grid-template-columns: 34px minmax(160px, 1.4fr) auto minmax(230px, 1.9fr) minmax(120px, 1fr) 118px 60px 92px;
      gap: 12px;
      align-items: center;
      padding: 10px 16px;
      border-block-end: 1px solid var(--dv-border);
      font-size: var(--sw-fs-base);
    }
    .tr:last-child {
      border-block-end: 0;
    }
    /* R5-DEVICES-297: the table's header is a heading row (bold, heading ink); a name is a heading, a disabled row a deeper well */
    .tr.h {
      background: var(--dv-surface-2);
      color: var(--sw-heading, var(--dv-text));
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-bold);
      padding-block: 10px;
    }
    .tr[data-picked] {
      background: var(--dv-accent-soft);
    }
    .tr.off {
      background: var(--dv-surface-3);
    }
    .tr.off .name,
    .tr.off .slotrows {
      opacity: 0.6;
    }
    .tr .name {
      display: block;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media (hover: hover) and (pointer: fine) {
      .tr .name:hover {
        color: var(--dv-accent-text);
      }
    }
    .tr .sub {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .slotrows {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
    }
    .sr {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }
    .sr .w {
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--dv-text));
      direction: ltr;
      text-align: end;
      unicode-bidi: isolate;
    }
    .sr .a {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .ac {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px 8px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      background: color-mix(in srgb, var(--c) 16%, transparent);
      color: var(--dv-text);
      max-inline-size: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .linkbtn {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--dv-accent-text);
      background: none;
      border: 0;
      padding: 0;
      text-align: start;
      min-block-size: 28px;
    }
    .ops {
      display: inline-flex;
      gap: 2px;
      justify-content: flex-end;
    }
    /* ---- trash, review: rows of the drawer's block style ---- */
    .rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border-radius: var(--sw-r-2xl);
    }
    .li .t {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
    }
    .li .d {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .li .issues {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 6px;
    }
    /* an issue is a sentence-long chip: it wraps inside the row on a narrow phone */
    .li .issues .chip {
      white-space: normal;
      block-size: auto;
      min-block-size: 26px;
      padding-block: 3px;
      max-inline-size: 100%;
    }
    .li .lops {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    /* 2026-10-04: an administrator's "fine from our side" - the warning chip gives way to a small muted state */
    .li .issues .iss {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: 100%;
    }
    .li .issues .chip.acked {
      background: transparent;
      color: var(--dv-text-2);
      border: 1px solid var(--dv-line, var(--sw-border));
      font-weight: var(--sw-fw-medium);
    }
    /* ---- the bulk bar: the edit bar of the glass style, kept at the bottom while scrolling ---- */
    .bulk {
      position: sticky;
      inset-block-end: 14px;
      z-index: 6;
      align-self: center;
      max-inline-size: 100%;
    }
    /* the note is a popover (top layer): a modal drawer or dialog is open while most notes appear, and must not dim them */
    .toast[popover] {
      inset-block-start: auto;
      margin-block: 0;
      padding: 11px 20px 11px 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: visible;
    }
    .toast .btn {
      min-block-size: 28px;
      padding-inline: 12px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      border-color: transparent;
      box-shadow: none;
      margin-inline-start: 6px;
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    @media (pointer: coarse), (max-width: 1100px) {
      .pick,
      .more-btn {
        inline-size: 44px;
        block-size: 44px;
      }
      sw-segmented.views {
        --sw-seg-key-min-w: 44px;
      }
      .rc.day {
        inline-size: 44px;
      }
      .linkbtn {
        min-block-size: 44px;
      }
    }
    @media (max-width: 1100px) {
      .tr {
        grid-template-columns: 34px minmax(120px, 1.4fr) minmax(160px, 2fr) minmax(80px, 1fr) 104px 56px 92px;
      }
      .tr > .cdays {
        display: none;
      }
    }
    @media (max-width: 767px) {
      /* the phone: the view switch moves under the search row (the title row keeps the automations screen's height, so the
         segment strip stays in place when switching between the two screens) */
      .dh-row {
        grid-template-areas: 't .' 'r r';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      .dh-det .vwrap {
        order: 4;
      }
      .dh-det {
        gap: 10px;
      }
      /* CR-CMP2-TABS-2460: the kind strip takes the first line of the phone toolbar (sw-tabs fill="phone" shares it equally) */
      .dh-det sw-tabs.kinds {
        order: 1;
      }
      .dh-det .stf {
        order: 2;
        inline-size: 100%;
        display: none;
        flex-wrap: wrap;
        justify-content: flex-start;
      }
      .dh-det .stf::-webkit-scrollbar {
        display: none;
      }
      .dh-det .stf[data-open] {
        display: inline-flex;
      }
      .dh-det .grow {
        display: none;
      }
      .dh-det .search {
        order: 3;
        flex: 1 1 120px;
        min-inline-size: 0;
      }
      .dh-det .foldbtn,
      .dh-det .newbtn,
      .dh-det .rc.attn {
        order: 3;
      }
      .more {
        order: 5;
      }
      .tr.h {
        display: none;
      }
      .tr {
        grid-template-columns: 34px minmax(0, 1fr) auto;
        grid-template-areas: 'sel name tog' '. slots slots' '. days days' '. cond next';
        row-gap: 8px;
        padding: 12px 14px;
      }
      .tr > .csel {
        grid-area: sel;
      }
      .tr > .cname {
        grid-area: name;
      }
      .tr > .cslots {
        grid-area: slots;
      }
      .tr > .cdays {
        grid-area: days;
        display: block;
      }
      .tr > .ccond {
        grid-area: cond;
      }
      .tr > .cnext {
        grid-area: next;
        text-align: end;
      }
      .tr > .ctog {
        grid-area: tog;
      }
      .tr > .cops {
        display: none;
      }
      .acard {
        padding: 14px 16px 12px;
        border-radius: var(--sw-r-2xl);
      }
      .bulk {
        inset-block-end: calc(var(--sw-bottomnav-h) + 10px);
      }
    }
  `];
