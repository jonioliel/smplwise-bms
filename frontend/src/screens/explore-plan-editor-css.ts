import { css } from 'lit';
import { packageDialogStyles } from './plan-package-dialog';
import { studio6Styles } from './plan-studio6-panel';
import { studioPanelStyles } from './plan-studio-panel';
import { ltrStyles } from '../styles/fragments';

/**
 * CR-STRUCT-CSS-SPLIT-2442 (code review 06:STRUCT-1 step 1): the style sheets of `explore-plan-editor` (screens/explore-plan-editor.ts), moved here as they
 * stood - same CSS text, same order, same composition of the array. The screen keeps `static styles = explorePlanEditorStyles`.
 */

export const explorePlanEditorStyles = [css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 16px;
      min-block-size: 560px;
      flex: 1;
    }
    .mapwrap {
      position: relative;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      min-block-size: 520px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      flex-direction: column;
    }
    .mapwrap sw-plan-canvas {
      flex: 1;
    }
    .rail {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 64px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      /* the HUD panels over the plan are opaque (owner 2026-10-13, styles/menu-surface.ts): the tool rail, the floor chip, the level bar and the legend */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-2);
      padding: 5px;
      z-index: var(--sw-z-map-ui);
    }
    .rail button {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .rail button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .rail button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .rail hr {
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      margin: 2px 4px;
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      z-index: var(--sw-z-map-ui);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .bar .grow {
      flex: 1;
    }
    /* T085 pan/help: the hand-tool toggle and the shortcuts-help button live in the top bar, not the vertical rail (an
     * absolute overlay whose height is capped by the legend below it) - a row that grows in normal flow instead. The
     * hand tool is a modifier over whatever tool is active, not a content tool of its own, so its "on" state gets an
     * amber tone rather than the rail's blue accent, keeping it visually distinct from a selected tool. */
    .bar button.icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 26px;
      block-size: 26px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      flex-shrink: 0;
    }
    .bar button.icon.on {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text); /* POLISH4 WP6 (D28): the bare warning hue read ~2:1 on its own wash in light; the ink is >= 4.5:1 */
      border-color: var(--sw-warning);
    }
    .bar button.icon:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .autosave {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .autosave i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .autosave.dirty i {
      background: var(--sw-stale);
    }
    .placing-hint {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 14px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
    }
    /* WALLP: the drawing hints (a wall, a curved wall) float at the bottom of the window: the map column grows with the
       side panel, so its own bottom edge is often below the fold (a tablet in landscape never saw the live length,
       radius and the finish button) */
    .placing-hint.float {
      position: fixed;
      inset-block-end: 16px;
      pointer-events: none; /* only the pill takes the pointer: the strip beside it stays the map's */
    }
    .placing-hint.float.bindbar span {
      pointer-events: auto;
      max-inline-size: calc(100vw - 32px);
    }
    .placing-hint span {
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-pill);
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      box-shadow: var(--sw-shadow-2);
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      display: flex;
      gap: 12px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 5px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      z-index: var(--sw-z-map-ui);
    }
    .legend i {
      display: inline-block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      margin-inline-end: 5px;
      background: var(--sw-accent);
    }
    .legend i.ent {
      background: var(--sw-live);
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
    }
    /* T085 pan/help: the keyboard-shortcuts dialog's grouped list */
    .shortcuts-group h4 {
      margin: 10px 0 4px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .shortcuts-group:first-child h4 {
      margin-block-start: 0;
    }
    .shortcuts-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 0;
      font-size: var(--sw-fs-xs);
    }
    .shortcuts-row kbd {
      flex: 0 0 auto;
      min-inline-size: 84px;
      text-align: center;
      font: inherit;
      font-size: var(--sw-fs-xs);
      direction: ltr;
      color: var(--sw-text-2);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      padding: 2px 6px;
      background: var(--sw-surface-2);
    }
    .shortcuts-row span {
      color: var(--sw-text-2);
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the plan is the hero (shadow 2), the tool rail a raised panel whose active tool is
       the accent FIELD (a disabled tool dims by its ink, never by fading the box); the save state is a filled pill (saved = the success field,
       unsaved = the stale field) instead of a 7 px dot beside grey text; the legend in the body ink with 10 px dots; keys and values in the
       side cards read at a glance. Press on pointer-down; hover only with a fine pointer. */
    .mapwrap {
      box-shadow: var(--sw-shadow-2);
      /* loop 2: the map ground a tone step down (the desk), the plan sheet floats, the rail and chips read as raised */
      --sw-map-bg: var(--sw-surface-3);
    }
    .rail {
      box-shadow: var(--sw-shadow-3);
    }
    .rail button {
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .rail button.on {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .rail button:active:not(:disabled),
    .bar button.icon:active:not(:disabled),
    .list button:active {
      transform: scale(var(--sw-press-scale));
    }
    .bar button.icon {
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    /* POLISH4 WP6 (D12 / D13): hover lives only under a fine pointer - the tool rail, the bar's icon keys and the side lists never keep a
       sticky wash after a tap on a tablet (it replaces the ungated :hover + (hover: none) undo pair); the active key keeps its own fill */
    @media (hover: hover) and (pointer: fine) {
      .rail button:hover:not(.on):not(:disabled) {
        background: var(--sw-surface-3);
        color: var(--sw-text);
      }
      .bar button.icon:hover:not(.on):not(:disabled) {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
      .list button:hover:not(.on) {
        background: var(--sw-accent-soft);
        border-color: var(--sw-accent);
      }
    }
    .bar {
      font-size: var(--sw-fs-sm);
    }
    .autosave {
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
      font-weight: var(--sw-fw-semibold);
    }
    .autosave.dirty {
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .autosave i,
    .autosave.dirty i {
      background: currentColor;
    }
    /* a HUD panel keeps the opaque menu surface (owner 2026-10-13, unit-menu-lint): the chip's weight comes from a 2 px accent edge and the
       accent ink, not from an accent fill */
    .floorchip {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      background: var(--sw-menu-surface);
      border: 2px solid var(--sw-accent);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-2);
    }
    .floorchip sw-icon {
      color: inherit;
    }
    .legend {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-2);
    }
    .legend i {
      inline-size: 12px;
      block-size: 12px;
    }
    .autosave {
      font-size: var(--sw-fs-sm);
      padding: 4px 12px;
    }
    .list button {
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    .list button.on {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-accent-text);
    }
    /* a circuit row's colour as a 10 px dot in front of the name, not a 4 px coloured side edge (impeccable "side-tab") */
    .list button[data-circuit-row]::before {
      content: '';
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: var(--kc, var(--sw-accent));
      flex: none;
    }
    .list button[data-circuit-row] > span:first-of-type {
      flex: 1;
      min-inline-size: 0;
    }
    .kv {
      font-weight: var(--sw-fw-medium);
    }
    .kv .k {
      font-weight: var(--sw-fw-regular);
    }
    .row .lbl {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .row .muted {
      font-weight: var(--sw-fw-regular);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
    }
    .list button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
    }
    .list button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    .kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .kv .k {
      color: var(--sw-text-3);
    }
    /* CAMSUGGEST138-295: at most three rows, so the zone panel keeps fitting the viewport */
    .cam-sug {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .cam-sug-name {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    /* CR-009: a room shown on two floors */
    .shared-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      margin-block-end: 8px;
      border: 1px dashed var(--sw-accent);
      border-radius: var(--sw-r-sm);
      background: var(--sw-accent-soft);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .shared-box {
      display: grid;
      gap: 6px;
      justify-items: start;
      padding: 8px 0;
    }
    .shared-box .chip {
      padding: 1px 8px;
      border: 1px dashed var(--sw-accent);
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .share-preview {
      display: grid;
      gap: 4px;
      margin-block: 8px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
    }
    .row .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    input[type='range'] {
      inline-size: 100%;
      accent-color: var(--sw-accent);
    }
    .cand {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .cand input.name {
      inline-size: 100%;
      min-inline-size: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-xs);
      padding: 4px 6px;
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .cand select {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-xs);
      padding: 3px 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    i.sw {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: var(--sw-r-2xs);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-text) 15%, transparent);
      margin-inline-end: 6px;
      vertical-align: -2px;
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    /* K88: the floor-image upload buttons (the file input stays hidden behind the button) */
    .upl {
      display: inline-flex;
    }
    .upl input[type='file'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 8px;
    }
    .legend i.zone {
      border-radius: var(--sw-r-2xs);
      background: var(--sw-accent);
      opacity: 0.45;
    }
    .layerlist label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
    }
    ${ltrStyles}
    .compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .vlist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 320px;
      overflow: auto;
      margin-block-start: 6px;
    }
    .vrow {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      grid-template-areas: "img meta" "img acts";
      gap: 4px 8px;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-xs);
    }
    .vrow.cur {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .vrow img {
      grid-area: img;
      inline-size: 56px;
      block-size: 40px;
      object-fit: cover;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
    }
    .vrow .meta {
      grid-area: meta;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .vrow .acts {
      grid-area: acts;
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }
    .vrow .acts:empty {
      display: none;
    }
    .dsum {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .ditems {
      display: flex;
      flex-direction: column;
      max-block-size: 160px;
      overflow: auto;
      font-size: var(--sw-fs-xs);
    }
    .ditems div {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .compare img {
      inline-size: 100%;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-map-bg);
    }
    .bindbar {
      pointer-events: auto;
    }
    .bindbar button {
      margin-inline-start: 8px;
      /* POLISH4 WP6 (D13): the key sits on the toast-coloured hint pill, so it takes the toast ink (was white / white 60 % literals) */
      border: 1px solid color-mix(in srgb, var(--sw-toast-text) 60%, transparent);
      background: transparent;
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-pill);
      padding: 2px 10px;
      font: inherit;
      cursor: pointer;
    }
    .levelbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      position: absolute;
      left: 50%; /* physical: in RTL inset-inline-start is the right edge, and the -50% shift pushed the bar off the canvas's left */
      transform: translateX(-50%);
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-2xl); /* a pill on one row; a rounded card, not a blob, when a narrow canvas wraps it */
      padding: 4px 8px;
      box-shadow: var(--sw-shadow-1);
      max-inline-size: 60%;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .props {
        order: 2;
      }
    }
    /* POLISH4 WP6 (D13): a phone gets the canvas at most 70 % of the screen tall (it was a fixed 520 / 560 px floor that pushed the
       properties a full screen down), the tighter phone gap and the medium radius of a phone card */
    @media (max-width: 767px) {
      .layout {
        gap: 12px;
        min-block-size: 0;
      }
      .mapwrap {
        min-block-size: min(520px, 70dvh);
        border-radius: var(--sw-r-md);
      }
    }
    /* POLISH4 WP6 (D13): a finger gets a larger key on the bar's 26 px icon buttons (the tool rail is already 38 px) */
    @media (pointer: coarse) {
      .bar button.icon {
        position: relative;
        inline-size: var(--sw-ctl-h-lg);
        block-size: var(--sw-ctl-h-lg);
      }
      /* A11Y-R4-LEFTOVERS-2380: the drawn key stays --sw-ctl-h-lg (36 / 40 px, so the bar does not grow on a tablet); an invisible layer
       * brings the hit area to 44 px. It reaches at most 4 px past the key, and the bar's gap is 8 px, so two neighbours never overlap. */
      .bar button.icon::after {
        content: '';
        position: absolute;
        inset: min(0px, calc((var(--sw-ctl-h-lg) - 44px) / 2));
      }
    }
  `, studioPanelStyles, packageDialogStyles, studio6Styles];
