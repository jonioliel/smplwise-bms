import { css } from 'lit';
import { BV1_STYLES } from './home-widgets-bv1';
import { ELEVATOR_WIDGET_STYLES } from '../elevators/home-widget';
import { TEMPERATURE_WIDGET_STYLES } from '../temperature/home-widget';
import { GENERATOR_WIDGET_STYLES } from '../generator/home-widget';
import { DOORS_WIDGET_STYLES } from '../door-windows/home-widget';
import { NOTICES_WIDGET_STYLES } from '../notices/home-widget';
import { PRESENCE_WIDGET_STYLES } from './building-presence-widget';
import { XS_MINI_WIDGET_STYLES } from '../xsection/xs-mini-widget';
import { hostBlockStyles } from '../styles/fragments';

/**
 * CR-STRUCT-CSS-SPLIT-2442 (code review 06:STRUCT-1 step 1): the style sheets of `home-widgets` (screens/home-widgets.ts), moved here as they
 * stood - same CSS text, same order, same composition of the array. The screen keeps `static styles = homeWidgetsStyles`.
 */

/** POLISH4-WP4 (D2, PRE-GATE-2360): in edit mode every shown card keeps room under its content for its edit bar, the bar's measured
 * height (--wg-e-h, set by home-widgets from a ResizeObserver: one row on a wide card, two or three when the controls wrap in a
 * narrow one or take 44 px targets on touch) plus its 8 px inset and 8 px of air. The old fixed 52 px lost to the band's fit steps
 * (`[data-fit] .wg { padding-block: 10px }` came later at the same weight) and was too short for a wrapped bar, so the bar covered
 * the last rows of "פעולות מהירות" at 1920 / 1440. Kept as the LAST sheet, at the weight of the heaviest per-direction rule, so no
 * direction, fit step, skin or tile padding wins over it. */
const HOME_EDIT_BAR_STYLES = css`
  :host([editing]) .wg.wg:not(.ghost) {
    padding-block-end: calc(var(--wg-e-h, 34px) + 16px);
  }
`;

/** The Bubble skin (phase C, 2026-10-02; the approved board docs/design/mockups/bubble-taste/home.html): the status widgets are
 * flat pills - the weather on its hue, the armed alarm on the accent, no gradients - and the quick actions are pill rows
 * (home-widgets draws them with sw-pill when the skin is bubble). Keyed on the host's data-skin (design/skin.ts). */
const HOME_WIDGETS_BUBBLE = css`
  :host([data-skin='bubble']) .wg {
    border: 0;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface);
    box-shadow: none;
  }
  :host([data-skin='bubble']) .wg-weather {
    background: var(--sw-hue-4);
    color: var(--sw-ring-on-hue);
  }
  :host([data-skin='bubble']) .wg-weather :is(.wg-h, .wg-h small, .wg-h sw-icon, .wx-c, .wx-m, .wx-m b, .wx-m svg, .wx-fc, .wx-fc span, .wx-fc b, .wx-fc i, .wx-ic) {
    color: inherit;
  }
  :host([data-skin='bubble']) .wg-weather .wx-fc {
    border-color: var(--hw-tone-line);
  }
  :host([data-skin='bubble']) .wg-shabbat {
    background: var(--sw-surface);
  }
  :host([data-skin='bubble']) .wg-alarm[data-tone='ok'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  :host([data-skin='bubble']) .wg-alarm[data-tone='ok'] :is(.al-l, .al-s, .al-x, .al-go) {
    color: inherit;
  }
  :host([data-skin='bubble']) .wg-alarm[data-tone='ok'] .aic {
    background: rgba(255, 255, 255, 0.22);
    color: var(--sw-text-inverse);
  }
  :host([data-skin='bubble']) .wg-alarm[data-tone='err'] {
    background: var(--sw-danger-soft);
    border: 0;
  }
  :host([data-skin='bubble']) .mchip {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    min-block-size: 36px;
  }
  :host([data-skin='bubble']) .mic {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  /* the quick actions as pills: a row in the band, a column in the side panel and on a phone */
  :host([data-skin='bubble']) .wg-quick {
    padding: 0;
    background: transparent;
    justify-content: flex-start;
  }
  :host([data-skin='bubble']) .wg-quick .wg-h {
    padding: 4px 10px 0;
  }
  /* room for the ring, the label and the round button on one line */
  :host([layout='hero'][data-skin='bubble']) .wg-quick,
  :host([layout='row'][data-skin='bubble']) .wg-quick {
    flex-basis: 300px;
    min-inline-size: min(100%, 260px);
  }
  :host([layout='row'][data-skin='bubble']) .wg-quick .qa {
    flex-direction: row;
    flex-wrap: wrap;
  }
  :host([layout='row'][data-skin='bubble']) .wg-quick sw-pill {
    flex: 1 1 220px;
  }
  :host([data-skin='bubble']) .wg-quick .qa {
    flex-direction: column;
    gap: var(--sw-gap);
  }
  :host([data-skin='bubble']) .wg-quick .q-x {
    padding-inline: 10px;
  }
  :host([data-skin='bubble']) .qsb {
    inline-size: var(--sw-sub-size, var(--sw-sub));
    block-size: var(--sw-sub-size, var(--sw-sub));
    min-inline-size: var(--sw-touch-desktop);
    min-block-size: var(--sw-touch-desktop);
    box-sizing: border-box;
    border: 0;
    border-radius: 50%;
    background: var(--hw-well);
    color: inherit;
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
  }
  :host([data-skin='bubble']) .qsb:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  :host([data-skin='bubble']) .qsb:disabled {
    opacity: 0.5;
    cursor: default;
  }
  @media (max-width: 1100px) {
    :host([data-skin='bubble']) .qsb {
      min-inline-size: 44px;
      min-block-size: 44px;
    }
  }
`;

export const homeWidgetsStyles = [css`
    ${hostBlockStyles}
    :host([hidden]) {
      display: none;
    }
    /* size tiers: .only-s / .only-m / .only-l show in one size; .ge-m from medium up */
    [data-size='s'] :is(.only-m, .only-l, .ge-m) {
      display: none !important;
    }
    [data-size='m'] :is(.only-s, .only-l) {
      display: none !important;
    }
    [data-size='l'] :is(.only-s, .only-m) {
      display: none !important;
    }
    .wrap {
      display: flex;
      gap: 12px;
      min-inline-size: 0;
    }
    /* MULTIBUILDING-HOME-2330: the scope a level-following widget speaks for ("אתר" / "בניין א"), quiet, in the card's top corner */
    .wg-scope {
      position: absolute;
      inset-block-start: 6px;
      inset-inline-end: 10px;
      z-index: 1;
      pointer-events: none;
      max-inline-size: 40%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-semibold);
      line-height: 16px;
    }
    .wg {
      position: relative;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      min-inline-size: 0;
      padding: 14px 18px;
      background: var(--sw-surface);
      backdrop-filter: var(--sw-glass-blur);
      -webkit-backdrop-filter: var(--sw-glass-blur);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
      color: var(--sw-text);
      font-variant-numeric: tabular-nums;
    }
    .wg[data-size='s'] {
      padding: 12px 14px;
      gap: 4px;
    }
    /* HOME polish (2026-10-10): a state change (the alarm's tone, a chip's dot, a button's wash) fades in; nothing moves under
       reduced motion */
    @media (prefers-reduced-motion: no-preference) {
      .wg,
      .aic,
      .qbtn,
      .mchip,
      .gbtn {
        transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), color var(--sw-t-state) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
      }
      /* HOMEFABLE-297 (animation-performance): the alarm pulse is a ring that grows and fades (transform + opacity on a pseudo-element,
         composited), not a box-shadow repainted every frame */
      .wg-alarm[data-tone='err'] .aic::after {
        animation: al-pulse 1.6s var(--sw-ease-out) infinite;
      }
    }
    .aic::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-danger) 28%, transparent);
      opacity: 0;
      pointer-events: none;
    }
    @keyframes al-pulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      70%,
      100% {
        transform: scale(1.5);
        opacity: 0;
      }
    }
    /* HOMEFABLE-297 (impeccable typeset): the widget's name is a real heading - 14.5 px bold in the heading ink, the icon in the accent */
    .wg-h {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
      color: var(--sw-heading);
    }
    .wg-h svg,
    .wg-h sw-icon {
      inline-size: 15px;
      block-size: 15px;
      flex: none;
      color: var(--sw-accent);
    }
    .wg-h small {
      margin-inline-start: auto;
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-inline-size: 55%;
    }
    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .wg-b {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .ic {
      inline-size: 1em;
      block-size: 1em;
      flex: none;
    }
    /* ---- clock ---- */
    .hm {
      font-size: var(--hm, 56px);
      font-weight: var(--sw-fw-medium);
      letter-spacing: -0.04em;
      line-height: 1;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
    }
    .hm b {
      font-weight: 300;
      opacity: 0.55;
      margin-inline: 0.03em;
    }
    .ss {
      font-size: calc(var(--hm, 52px) * 0.32);
      color: var(--sw-text-3);
      margin-inline-start: 6px;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
    }
    .clk {
      display: flex;
      align-items: baseline;
      direction: ltr;
      justify-content: flex-end;
    }
    .wg-clock .dts {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-inline-size: 0;
    }
    .d1 {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .d2 {
      font-size: var(--sw-fs-sm);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      /* WIDGETBREAK-297: the Hebrew date comes from a sensor the installer picked; a long state ends in an ellipsis (the full text is the tooltip) */
      overflow: hidden;
      text-overflow: ellipsis;
      max-inline-size: 100%;
    }
    .wg-clock[data-size='s'] .d1 {
      font-size: var(--sw-fs-xs);
    }
    /* ---- weather ---- */
    .wg-weather {
      background: linear-gradient(160deg, var(--sky1, rgba(120, 180, 255, 0.26)), var(--sky2, rgba(255, 206, 120, 0.16)) 70%), var(--sw-surface);
    }
    .wx-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-inline-size: 0; /* P6 item 3: the measures column wraps inside the card at 105 C / 100% / 187.4 km/h instead of leaving it */
    }
    .wx-ic {
      inline-size: var(--wxi, 44px);
      block-size: var(--wxi, 44px);
      color: var(--sw-warning);
      stroke-width: 1.5;
      flex: none;
    }
    .wg-weather[data-cond='cloud'] .wx-ic,
    .wg-weather[data-cond='fog'] .wx-ic {
      color: var(--sw-text-3);
    }
    .wg-weather[data-cond='rain'] .wx-ic,
    .wg-weather[data-cond='storm'] .wx-ic {
      color: var(--sw-accent);
    }
    .wx-tc {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
      min-inline-size: 0;
    }
    .wx-t {
      font-size: var(--wxt, 36px);
      font-weight: 300;
      letter-spacing: -0.03em;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
      text-align: start;
      /* WORSTCASE-2310: a reading that still does not fit its column (105 °C, a sensor in °F with decimals) ends in an ellipsis inside
         the column instead of running under the condition glyph; the full reading is the tooltip */
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .wx-c {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
      margin-block-start: 2px;
      white-space: nowrap;
    }
    .wx-m {
      display: flex;
      gap: 6px 14px;
      flex-wrap: wrap;
      min-inline-size: 0;
      max-inline-size: 100%;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .wx-m span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .wx-m svg {
      inline-size: 14px;
      block-size: 14px;
      color: var(--sw-accent);
    }
    .wx-m b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .wx-fc {
      display: grid;
      grid-template-columns: repeat(var(--fcn, 5), minmax(0, 1fr));
      gap: 4px;
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 8px;
      margin-block-start: 2px;
    }
    .fc {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .fc svg {
      inline-size: 20px;
      block-size: 20px;
      color: var(--sw-warning);
    }
    .fc[data-cond='cloud'] svg,
    .fc[data-cond='fog'] svg {
      color: var(--sw-text-3);
    }
    .fc[data-cond='rain'] svg,
    .fc[data-cond='storm'] svg {
      color: var(--sw-accent);
    }
    .fc b {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .fc .hl {
      display: flex;
      /* WIDGETBREAK-297: in a narrow card the high and the low stack instead of crossing into the next day's column */
      flex-wrap: wrap;
      justify-content: center;
      column-gap: 5px;
      align-items: baseline;
      direction: ltr;
    }
    .fc i {
      font-style: normal;
      font-size: var(--sw-fs-xs);
    }
    /* ---- shabbat ---- */
    .wg-shabbat {
      background: linear-gradient(160deg, rgba(255, 184, 86, 0.26), rgba(255, 184, 86, 0.04) 75%), var(--sw-surface);
    }
    .pr {
      font-size: var(--prs, 19px);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.02em;
      line-height: 1.15;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      /* WIDGETBREAK-297: the holiday and the date lines come from sensors; an unbreakable value wraps inside the card */
      overflow-wrap: anywhere;
      min-inline-size: 0;
    }
    .tms {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .tm {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .tm svg {
      inline-size: 16px;
      block-size: 16px;
      color: var(--sw-warning-text);
      flex: none;
    }
    .tm b {
      margin-inline-start: auto;
      font-size: var(--sw-fs-lg);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .tm b.txt {
      direction: inherit;
      font-size: var(--sw-fs-base);
    }
    .tm2 {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tm2 svg {
      color: var(--sw-warning-text);
      inline-size: 14px;
      block-size: 14px;
    }
    .tm2 b {
      direction: ltr;
      unicode-bidi: isolate;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .cd {
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* ---- alarm ---- */
    .wg-alarm {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .aic {
      position: relative;
      display: grid;
      place-items: center;
      inline-size: var(--ali, 44px);
      block-size: var(--ali, 44px);
      border-radius: 50%;
      background: var(--sw-success-soft);
      color: var(--sw-success);
      flex: none;
    }
    .aic svg {
      inline-size: calc(var(--ali, 40px) * 0.5);
      block-size: calc(var(--ali, 40px) * 0.5);
    }
    .wg-alarm[data-tone='neutral'] .aic {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .wg-alarm[data-tone='err'] {
      background: linear-gradient(160deg, color-mix(in srgb, var(--sw-danger) 22%, transparent), color-mix(in srgb, var(--sw-danger) 4%, transparent)), var(--sw-surface);
      border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
    }
    .wg-alarm[data-tone='err'] .aic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .al-t {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.2;
    }
    .al-l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .al-s {
      font-size: var(--als, var(--sw-fs-xl));
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.015em;
      color: var(--sw-heading);
      white-space: nowrap;
    }
    .al-x {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .al-go {
      font-size: var(--sw-fs-xs);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      margin-block-start: 3px;
      display: inline-flex;
      gap: 3px;
      align-items: center;
      text-decoration: none;
    }
    .al-go svg {
      inline-size: 12px;
      block-size: 12px;
    }
    /* ---- quick actions ---- */
    .qa {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    /* HOMEFABLE-297 (apple-design materials, emil press): a quick action is a raised key - a tone step up from the card, the ladder's first
       shadow, a 14.5 px semibold label - and it sinks on press (scale from the skin's press token, 120 ms, instant on pointer-down) */
    .qbtn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-block-size: 40px;
      padding: 0 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface-2);
      box-shadow: var(--sw-shadow-1);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      white-space: nowrap;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
      transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .qbtn:hover:not(:disabled) {
        background: var(--sw-surface);
        border-color: var(--sw-border-strong);
        box-shadow: var(--sw-shadow-2);
      }
    }
    .qbtn:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
      background: var(--sw-pressed-wash);
      box-shadow: none;
    }
    .qbtn:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    .qbtn.danger {
      color: var(--sw-danger-text);
      background: var(--sw-danger-soft);
      border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
    }
    @media (hover: hover) and (pointer: fine) {
      .qbtn.danger:hover:not(:disabled) {
        background: var(--sw-danger-soft);
        border-color: color-mix(in srgb, var(--sw-danger) 60%, transparent);
      }
    }
    .qbtn svg {
      inline-size: 16px;
      block-size: 16px;
    }
    .q-x {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .wg-quick[data-size='s'] .qa {
      flex-direction: row;
    }
    .wg-quick[data-size='s'] .qbtn {
      flex: 1;
      min-block-size: 34px;
      padding: 0 6px;
      font-size: var(--sw-fs-xs);
    }
    /* ---- media (CR-015): the screens that are on, as chips that open the remote ---- */
    .wg-media {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .wg-media[data-size='m'],
    .wg-media[data-size='l'] {
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
    }
    .mic {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      flex: none;
    }
    .mic svg {
      inline-size: 18px;
      block-size: 18px;
    }
    .mt {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      min-inline-size: 0;
    }
    .mt b {
      font-size: var(--mn, 22px);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .mt span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .mts {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 6px 22px;
      min-inline-size: 0;
    }
    .mchips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-inline-size: 0;
    }
    .mchip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      max-inline-size: 100%;
      padding: 0 12px 0 10px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      cursor: pointer;
      overflow: hidden;
      white-space: nowrap;
    }
    @media (hover: hover) and (pointer: fine) {
      .mchip:hover:not(:disabled) {
        background: var(--sw-hover-wash);
        border-color: var(--sw-text-3);
      }
    }
    .mchip:active:not(:disabled) {
      background: var(--sw-pressed-wash);
    }
    .mchip:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    .mchip i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-success);
      flex: none;
    }
    .mchip.more {
      color: var(--sw-text-2);
      cursor: default;
    }
    .mchip span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* POLISH2-295 (owner feedback 2026-10-25): medium and large are one header line and one row - the counts inline, the chips
       beside them on the same row (a narrow card puts the chips under the counts, still one row of them); the card is as tall as its
       content, not the band's fixed minimum (a card beside it in the band still stretches it to the band's height) */
    .wg-media .mrow {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 20px;
    }
    .wg-media .mrow .mts {
      flex: none;
      align-items: center;
      flex-wrap: nowrap;
      gap: 18px;
    }
    .wg-media .mrow .mt {
      flex-direction: row;
      align-items: baseline;
      gap: 6px;
      white-space: nowrap;
    }
    .wg-media .mrow .mt b {
      font-size: var(--mn, 22px);
      line-height: 1;
    }
    .wg-media .mrow .mt span {
      font-size: var(--sw-fs-sm);
    }
    .wg-media .mrow .mchips {
      flex: 1 1 180px;
      flex-wrap: nowrap;
      justify-content: flex-end;
      overflow: hidden;
    }
    .wg-media .mrow .mchip {
      flex: 0 1 auto;
      min-inline-size: 0;
      min-block-size: 32px;
    }
    .wg-media .mrow .mchip.more {
      flex: none;
    }
    .mchip:focus-visible,
    .qbtn:focus-visible,
    .gbtn:focus-visible,
    .grip:focus-visible,
    .eb:focus-visible,
    .al-go:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* ---- ghosts (edit mode: a widget that is off or not available) ---- */
    .wg.ghost {
      border: 2px dashed var(--sw-border-strong);
      background: var(--sw-surface-2);
      box-shadow: none;
      align-items: center;
      text-align: center;
      color: var(--sw-text-3);
      gap: 6px;
      font-size: var(--sw-fs-sm);
      min-block-size: 96px;
    }
    .wg.ghost b {
      color: var(--sw-text-2);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .wg.ghost b svg {
      inline-size: 16px;
      block-size: 16px;
    }
    .wg.ghost.warn {
      border-color: color-mix(in srgb, var(--sw-warning) 55%, transparent);
      background: var(--sw-warning-soft);
    }
    .gbtn {
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: var(--sw-r-pill);
      padding: 4px 12px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .gbtn:hover {
        background: var(--sw-hover-wash);
      }
    }
    .gbtn:active {
      background: var(--sw-pressed-wash);
    }
    /* ---- edit chrome on every shown widget ---- */
    /* POLISH4-WP4 (D2): the room under the content for the edit bar is reserved in HOME_EDIT_BAR_STYLES (the last sheet), from the
       bar's measured height */
    :host([editing]) .wg:not(.ghost) {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    :host([editing]) .wg[draggable='true'] {
      cursor: grab;
    }
    .wg.dragging {
      opacity: 0.4;
    }
    .wg-e {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      /* WIDGETBREAK-297: the edit controls wrap in a 240 px card instead of leaving it; POLISH4-WP4 (D2): the card reserves the
         wrapped bar's whole height (--wg-e-h), and the radius is a token (a pill reads badly once the bar takes two rows) */
      flex-wrap: wrap;
      row-gap: 2px;
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      padding: 3px 4px 3px 8px;
      box-shadow: var(--sw-shadow-2);
      z-index: 3;
    }
    .grip {
      display: inline-grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-3);
      cursor: grab;
    }
    /* POLISH4-WP4 (D2): the wash only under a pointer that hovers (it stuck after a tap), a press wash on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .grip:hover,
      .eb:hover:not(:disabled) {
        background: var(--sw-surface-3);
      }
    }
    .grip:active,
    .eb:active:not(:disabled) {
      background: var(--sw-pressed-wash);
    }
    .grip,
    .eb {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .eb {
      display: inline-grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      padding: 0;
    }
    .eb:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .eb svg,
    .grip svg,
    .grip sw-icon {
      inline-size: 14px;
      block-size: 14px;
    }
    .eb.x {
      margin-inline-start: auto;
    }
    /* CR-HOME-V3-SEGMENTS-2470 (owner N11): the size choice is the shared sw-segmented; the edit bar's small pill key reaches it
       through the component's knobs (the chosen key, its touch-action and focus ring are the component's own) */
    .wg-e sw-segmented {
      --sw-seg-track: var(--sw-surface-3);
      --sw-seg-pad: 2px;
      --sw-seg-radius: var(--sw-r-pill);
      --sw-seg-gap: 1px;
      --sw-seg-key-pad: 9px;
      --sw-seg-h: 24px;
      --sw-seg-fs: var(--sw-fs-xs);
      --sw-seg-fw: var(--sw-fw-regular);
      --sw-seg-on-fw: var(--sw-fw-semibold);
      --sw-seg-fg: var(--sw-text-2);
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-text));
      --sw-seg-btn-radius: var(--sw-r-pill);
      --sw-seg-key-min-w: auto;
      --sw-seg-wrap: nowrap;
    }
    .wg-e sw-segmented::part(track) {
      border: 0;
    }
    /* the label keeps the bar's own line height (it sits on the same pixel row as before) */
    .wg-e sw-segmented::part(key) {
      line-height: inherit;
    }
    /* POLISH4-WP4 (D2): a 44 px target for every edit control on touch (26 px on a mouse) */
    @media (pointer: coarse) {
      .grip,
      .eb {
        inline-size: 44px;
        block-size: 44px;
      }
      .wg-e sw-segmented {
        --sw-seg-pad: 0;
        --sw-seg-h: 44px;
        --sw-seg-key-min-w: 44px;
      }
      .wg-e {
        gap: 2px;
      }
    }
    /* QUICKHIDE-295: with the quick actions hidden by the setting the notices card is not held to its natural width: it takes the rest of its row */
    :host([quick-hidden]) .wg.wg-notices {
      max-inline-size: none;
    }
    /* ================= directions ================= */
    /* a: control centre - a hero band */
    :host([layout='hero']) .wrap {
      flex-wrap: wrap;
      align-items: stretch;
    }
    :host([layout='hero']) .wg {
      flex: 1 1 var(--wb, 210px);
      /* HOMEINFO-295: with few widgets the cards keep a natural width instead of stretching across the row */
      max-inline-size: calc(var(--wb, 210px) * 1.5);
    }
    :host([layout='hero']) .wg[data-size='s'] {
      --wb: 140px;
      --hm: 36px;
      --wxi: 30px;
      --wxt: 26px;
      --prs: 15px;
      --ali: 30px;
      --als: 14px;
      min-block-size: 104px;
      flex-grow: 0.8;
    }
    :host([layout='hero']) .wg[data-size='m'] {
      --wb: 205px;
      --hm: 54px;
      --wxi: 44px;
      --wxt: 38px;
      --prs: 20px;
      --ali: 46px;
      --als: 18px;
      min-block-size: 146px;
      flex-grow: 1.2;
    }
    :host([layout='hero']) .wg[data-size='l'] {
      --wb: 290px;
      --hm: 74px;
      --wxi: 56px;
      --wxt: 50px;
      --prs: 26px;
      --ali: 54px;
      --als: 20px;
      min-block-size: 176px;
      flex-grow: 1.8;
    }
    :host([layout='hero'][data-fit='1']) .wg,
    :host([layout='hero'][data-fit='2']) .wg {
      padding-block: 10px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='m'] {
      min-block-size: 120px;
      --hm: 44px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] {
      min-block-size: 140px;
      --hm: 58px;
      --wxi: 44px;
      --wxt: 40px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] .wx-fc {
      padding-block-start: 5px;
    }
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] .wg-b,
    :host([layout='hero'][data-fit='1']) .wg[data-size='l'] {
      gap: 4px;
    }
    :host([layout='hero'][data-fit='2']) .wg[data-size='m'] {
      min-block-size: 96px;
      --hm: 36px;
    }
    :host([layout='hero'][data-fit='2']) .wg[data-size='l'] {
      min-block-size: 110px;
      --hm: 44px;
    }
    :host([layout='hero'][data-fit='2']) .wx-fc,
    :host([layout='hero'][data-fit='2']) .cd,
    :host([layout='hero'][data-fit='2']) .q-x {
      display: none;
    }
    /* HOME-SCROLL-3-2530: the home screen's last fit step (devices-building data-squeeze: fit 2 still scrolls on a short screen) folds
       the band of large cards the way direction b's column folds - the headings go, the clock reads at the display size, each card takes
       its content's height - and the band keeps one row where its cards fit at four fifths of their resting width (the owner's five
       cards at 1366 / 1280, four on a landscape tablet; a longer band still wraps). The resting look never reaches this step. */
    :host([layout='hero'][data-squeeze]) .wrap {
      gap: var(--sw-s-2);
    }
    :host([layout='hero'][data-squeeze]) .wg[data-size] {
      flex-basis: calc(var(--wb) * 0.8);
      min-block-size: auto;
      padding-block: var(--sw-s-2);
      --hm: var(--sw-fs-4xl);
    }
    :host([layout='hero'][data-squeeze]) .wg-h {
      display: none;
    }
    :host([layout='hero']) .wg-weather[data-size='l'] .wg-b,
    :host([layout='side']) .wg-weather[data-size='l'] .wg-b {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      column-gap: 10px;
      row-gap: 8px;
    }
    /* WORSTCASE-2310: in this grid the measures column takes its natural width first and the temperature gets the rest - at 1440 the
       large card is ~300 px, so "28°C" at 50 px (101 px) had a 94 px column and ran under the glyph. The temperature now scales with
       its own column (a container on the 1fr cell, which already ignores its content's width there) and keeps --wxt as its ceiling:
       wider cards look exactly as before, the 1440 card shows the reading at ~45 px instead of cutting it */
    :host([layout='hero']) .wg-weather[data-size='l'] .wx-main,
    :host([layout='side']) .wg-weather[data-size='l'] .wx-main {
      container: wxmain / inline-size;
    }
    :host([layout='hero']) .wg-weather[data-size='l'] .wx-t,
    :host([layout='side']) .wg-weather[data-size='l'] .wx-t {
      font-size: min(var(--wxt, 36px), 27cqi);
    }
    :host([layout='hero']) .wg-weather[data-size='l'] .wx-fc,
    :host([layout='side']) .wg-weather[data-size='l'] .wx-fc {
      grid-column: 1 / -1;
      margin-block-start: 0;
    }
    :host([layout='hero']) .wg-weather[data-size='l'] .wx-m,
    :host([layout='side']) .wg-weather[data-size='l'] .wx-m {
      flex-direction: column;
      gap: 6px;
    }
    /* b: side panel - a column */
    :host([layout='side']) .wrap {
      flex-direction: column;
      gap: 12px;
    }
    :host([layout='side']) .wg {
      flex: none;
    }
    :host([layout='side']) .wg[data-size='s'] {
      min-block-size: 78px;
      --hm: 34px;
      --wxi: 28px;
      --wxt: 24px;
      --prs: 15px;
      --ali: 32px;
      --als: 14px;
    }
    :host([layout='side']) .wg[data-size='m'] {
      min-block-size: 124px;
      --hm: 46px;
      --wxi: 38px;
      --wxt: 34px;
      --prs: 19px;
      --ali: 40px;
      --als: 16px;
    }
    :host([layout='side']) .wg[data-size='l'] {
      min-block-size: 176px;
      --hm: 64px;
      --wxi: 54px;
      --wxt: 46px;
      --prs: 24px;
      --ali: 46px;
      --als: 18px;
    }
    :host([layout='side'][data-fit='1']) .wg[data-size='m'] {
      min-block-size: 104px;
      padding-block: 10px;
    }
    :host([layout='side'][data-fit='1']) .wg[data-size='l'] {
      min-block-size: 140px;
      padding-block: 10px;
    }
    :host([layout='side'][data-fit='2']) .wg {
      padding-block: 8px;
    }
    :host([layout='side'][data-fit='2']) .wg[data-size='m'],
    :host([layout='side'][data-fit='2']) .wg[data-size='l'] {
      min-block-size: 90px;
    }
    :host([layout='side'][data-fit='2']) .wx-fc,
    :host([layout='side'][data-fit='2']) .cd,
    :host([layout='side'][data-fit='2']) .q-x {
      display: none;
    }
    /* HOME-SCROLL-FIX-2530: at the tightest packing the column's own spacing packs too - the small cards (the alarm, the quick actions)
       lose their resting floor and take their content's height, the gap narrows (owner's site at 1440x900: the column ended 18 px under
       the viewport); with data-fold (devices-building: still scrolling at fit 2, a shorter screen) the headings fold as in the row of c
       and the clock reads at the display size */
    :host([layout='side'][data-fit='2']) .wrap {
      gap: var(--sw-s-2);
    }
    :host([layout='side'][data-fit='2']) .wg[data-size='s'] {
      min-block-size: auto;
    }
    :host([layout='side'][data-fit='2'][data-fold]) .wg-h {
      display: none;
    }
    :host([layout='side'][data-fit='2'][data-fold]) .wg {
      --hm: var(--sw-fs-4xl);
    }
    :host([layout='side']) .wg-clock[data-size='s'] .wg-b {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    :host([layout='side']) .wg-quick[data-size='m'] .qa,
    :host([layout='side']) .wg-quick[data-size='l'] .qa {
      flex-direction: row;
      flex-wrap: wrap;
    }
    :host([layout='side']) .wg-quick[data-size='m'] .qbtn,
    :host([layout='side']) .wg-quick[data-size='l'] .qbtn {
      flex: 1 1 120px;
    }
    /* c: compact single row */
    :host([layout='row']) .wrap {
      gap: 10px;
      align-items: stretch;
    }
    :host([layout='row']) .wg {
      flex: 1 1 var(--wb, 220px);
      max-inline-size: calc(var(--wb, 220px) * 1.5);
      flex-direction: row;
      align-items: center;
      gap: 14px;
      padding: 10px 16px;
      min-block-size: var(--wh, 88px);
    }
    :host([layout='row']) .wg-h {
      display: none;
    }
    :host([layout='row']) .wg-b {
      flex-direction: row;
      align-items: center;
      gap: 14px;
      flex: 1 1 auto;
    }
    :host([layout='row']) .wg[data-size='s'] {
      --wb: 118px;
      --wh: 70px;
      --hm: 30px;
      --wxi: 28px;
      --wxt: 24px;
      --prs: 14px;
      --ali: 30px;
      --als: 13px;
      padding: 8px 12px;
    }
    :host([layout='row']) .wg[data-size='m'] {
      --wb: 250px;
      --wh: 90px;
      --hm: 42px;
      --wxi: 38px;
      --wxt: 32px;
      --prs: 17px;
      --ali: 38px;
      --als: 15px;
    }
    :host([layout='row']) .wg[data-size='l'] {
      --wb: 330px;
      --wh: 112px;
      --hm: 52px;
      --wxi: 48px;
      --wxt: 38px;
      --prs: 20px;
      --ali: 44px;
      --als: 16px;
      flex-grow: 1.4;
    }
    /* HOME-295: the new home's info row packs tighter with the fit steps (a control screen never scrolls) */
    :host([layout='row'][data-fit='1']) .wg,
    :host([layout='row'][data-fit='2']) .wg {
      --wh: 72px;
      padding-block: 8px;
    }
    :host([layout='row'][data-fit='2']) .wx-fc,
    :host([layout='row'][data-fit='2']) .cd,
    :host([layout='row'][data-fit='2']) .q-x {
      display: none;
    }
    :host([layout='row']) .wg-weather .wx-m {
      flex-direction: column;
      gap: 2px;
    }
    :host([layout='row']) .wg-weather .wx-fc {
      border-block-start: 0;
      padding-block-start: 0;
      margin: 0;
      border-inline-start: 1px solid var(--sw-border);
      padding-inline-start: 12px;
      grid-template-columns: repeat(var(--fcn, 3), auto);
      gap: 10px;
    }
    :host([layout='row']) .wg-shabbat .wg-b {
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
    }
    :host([layout='row']) .wg-shabbat .tms {
      flex-direction: row;
      gap: 14px;
    }
    :host([layout='row']) .wg-shabbat[data-size='m'] .tms {
      flex-direction: column;
      gap: 2px;
    }
    :host([layout='row']) .wg-quick .qa {
      flex-direction: row;
      gap: 6px;
    }
    :host([layout='row']) .wg-quick[data-size='m'] .qa {
      flex-direction: column;
      gap: 5px;
    }
    :host([layout='row']) .wg-quick .qbtn {
      min-block-size: 32px;
      font-size: var(--sw-fs-sm);
      padding: 0 10px;
    }
    :host([layout='row']) .wg-quick[data-size='l'] .qa {
      flex-direction: row;
    }
    :host([layout='row']) .wg-clock .clk {
      justify-content: flex-start;
    }
    :host([layout='row']) .wg-clock[data-size='m'] .d1 .only-m {
      display: none !important;
    }
    :host([layout='row']) .wg-clock[data-size='m'] .d1 .only-s {
      display: inline !important;
    }
    :host([layout='row'][editing]) .wrap {
      flex-wrap: wrap;
    }
    :host([layout='row'][data-fit='1']) .wg {
      --wh: 74px;
    }
    :host([layout='row'][data-fit='2']) .wg {
      --wh: 62px;
    }
    /* phone: widgets as a horizontal snap row */
    :host([layout='snap']) .wrap {
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      overscroll-behavior-x: contain;
      padding-block: 2px 4px;
    }
    :host([layout='snap']) .wrap::-webkit-scrollbar {
      display: none;
    }
    :host([layout='snap']) .wg {
      flex: 0 0 var(--sw, 80%);
      scroll-snap-align: start;
      min-block-size: var(--sh, 150px);
    }
    /* one card under the other: every card the full width (the phone default) */
    :host([layout='stack']) .wrap {
      flex-direction: column;
      gap: 10px;
    }
    :host([layout='stack']) .wg {
      flex: none;
      min-block-size: var(--sh, 96px);
    }
    /* two per row (wrapping): small and medium cards share a row, a large one takes the whole row */
    :host([layout='two']) .wrap {
      flex-wrap: wrap;
      gap: 10px;
    }
    :host([layout='two']) .wg {
      flex: 1 1 calc(50% - 5px);
      min-inline-size: 0;
      min-block-size: var(--sh, 96px);
    }
    :host([layout='two']) .wg[data-size='l'],
    :host([layout='two']) .wg.ghost {
      flex-basis: 100%;
    }
    :host([layout='two']) .wg[data-size='m'] {
      padding-inline: 12px;
    }
    :host(:is([layout='snap'], [layout='stack'], [layout='two'])) .wg[data-size='s'] {
      --sw: 46%;
      --sh: 96px;
      --hm: 32px;
      --wxi: 28px;
      --wxt: 24px;
      --prs: 15px;
      --ali: 30px;
      --als: 14px;
    }
    :host(:is([layout='snap'], [layout='stack'], [layout='two'])) .wg[data-size='m'] {
      --sw: 66%;
      --sh: 140px;
      --hm: 48px;
      --wxi: 40px;
      --wxt: 34px;
      --prs: 19px;
      --ali: 38px;
      --als: 16px;
    }
    :host(:is([layout='snap'], [layout='stack'], [layout='two'])) .wg[data-size='l'] {
      --sw: 86%;
      --sh: 184px;
      --hm: 66px;
      --wxi: 54px;
      --wxt: 46px;
      --prs: 24px;
      --ali: 46px;
      --als: 18px;
    }
    /* POLISH2-295: the media card's height is its content (one header line and one row), in every direction and on a phone; kept last
       so it outranks the band's per-size minimums above (a card beside it in the same band still stretches it) */
    :host([layout]) .wg.wg-media[data-size='m'],
    :host([layout]) .wg.wg-media[data-size='l'] {
      min-block-size: 0;
      gap: 8px;
      /* FIX2220: the chips sit beside the counts (POLISH2), so the HOMEINFO natural-width cap of the other cards is not this card's */
      max-inline-size: none;
    }
    /* FIX2220: since HOME-295 the cards are the info row of the cards view by default, five on one row: at 1440 the clock card is
       ~290 px and the weather card cuts its forecast, at the 1024 tablet the cards are 150-195 px. Each card answers its OWN width
       (a container query): the clock puts its date under the time, the weather drops the forecast and then the facts, the media card
       stacks its two counts; a line that is still too long ends in an ellipsis instead of being cut at the card's edge. */
    :host([layout='row']) .wg {
      container: wg / inline-size;
    }
    :host([layout='row']) .wg-b {
      min-inline-size: 0;
    }
    :host([layout='row']) .wg-clock .d1,
    :host([layout='row']) .wg-clock .d2 {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @container wg (max-width: 340px) {
      /* (a container query adds no specificity: the row layout's own .wg-b rule is outranked by naming the host the same way) */
      :host([layout='row']) .wg-clock .wg-b {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
      :host([layout='row']) .wg-clock .dts {
        align-self: stretch;
      }
      .wg-weather .wx-fc {
        display: none;
      }
    }
    @container wg (max-width: 250px) {
      .wg-weather .wx-m {
        display: none;
      }
      .wg-media .mrow .mts {
        flex: 0 1 auto;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        max-inline-size: 100%;
      }
      .wg-media .mrow .mt {
        max-inline-size: 100%;
      }
      .wg-media .mrow .mt span {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    /* WIDGETFIX-298: the infrastructure cards (elevators, temperature, generator, doors, notices) are a heading, a highlight and a list
       written one under the other; the row band's card is a flex ROW (built for the clock / weather), which laid those parts side by
       side and squeezed the names to 0 px. In the row band they keep their own top-to-bottom order. */
    :host([layout='row']) .wg:is(.wg-elev, .wg-temp, .wg-gen, .wg-doors, .wg-notices, .wg-pres) {
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 6px;
    }
    /* the row band is the compact strip: the elevators card is its heading line and one line per elevator (the highlight repeats the
       first line, and the stacked narrow-card form is kept for a card under 220 px) */
    :host([layout='row']) .wg-elev:not([data-size='s']) .el-big,
    :host([layout='row']) .wg-elev[data-size='l'] .dots {
      display: none;
    }
    :host([layout='row']) .wg-elev .el-box {
      gap: 6px;
    }
    :host([layout='row']) .wg-elev .el-h {
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
    }
    :host([layout='row']) .wg-elev .el-h b {
      max-inline-size: 60%;
    }
    :host([layout='row']) .wg-elev .el-h [data-home-elevators-summary] {
      flex: 1 1 0;
    }
    :host([layout='row']) .wg-elev .lst {
      gap: 4px;
    }
    /* a narrow temperature card: a wide reading puts the unit's name under it instead of squeezing the name away */
    :host([layout='row']) .wg-temp .tw-big {
      flex-wrap: wrap;
      row-gap: 2px;
    }
    :host([layout='row']) .wg-temp .tw-big .t {
      flex: 1 1 72px;
    }
    /* a narrow generator card: its state takes two lines before it ends in an ellipsis */
    :host([layout='row']) .wg-gen .gw-big .t b {
      white-space: normal;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }
    /* the weather card in the row band: the forecast shows the whole days that fit (the others wrap to a hidden second line) instead of
       being cut at the card's edge, and a fact line too long for the card ends in an ellipsis */
    :host([layout='row']) .wg-weather .wx-fc {
      flex: 1 1 0;
      min-inline-size: 0;
      grid-template-columns: repeat(auto-fill, 38px);
      grid-template-rows: auto;
      grid-auto-rows: 0;
      row-gap: 0;
      overflow: hidden;
    }
    :host([layout='row']) .wg-weather .wx-m {
      flex: 0 1 auto;
      min-inline-size: 0;
    }
    :host([layout='row']) .wg-weather .wx-m span {
      display: block;
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([layout='row']) .wg-weather .wx-m svg {
      vertical-align: -2px;
      margin-inline-end: 5px;
    }
    @container wg (max-width: 340px) {
      /* the step before the facts drop (250 px): two facts, so a long value is not cut */
      :host([layout='row']) .wg-weather .wx-m span:nth-child(n + 3) {
        display: none;
      }
    }
    @container el (min-width: 220px) {
      :host([layout='row']) .el-row {
        display: flex;
      }
      :host([layout='row']) .el-row .meta {
        display: contents;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .wrap {
        scroll-behavior: auto;
      }
    }
  `, HOME_WIDGETS_BUBBLE, BV1_STYLES, ELEVATOR_WIDGET_STYLES, TEMPERATURE_WIDGET_STYLES, GENERATOR_WIDGET_STYLES, DOORS_WIDGET_STYLES, NOTICES_WIDGET_STYLES, PRESENCE_WIDGET_STYLES, XS_MINI_WIDGET_STYLES, HOME_EDIT_BAR_STYLES];
