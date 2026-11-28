import { css } from 'lit';
import { deviceControlStyles } from './devices-controls';

/**
 * CR-STRUCT-CSS-SPLIT-2442 (code review 06:STRUCT-1 step 1): the style sheets of `area-quick-sheet` (screens/area-quick-sheet.ts), moved here as they
 * stood - same CSS text, same order, same composition of the array. The screen keeps `static styles = areaQuickSheetStyles`.
 */

export const areaQuickSheetStyles = [
    deviceControlStyles,
    css`
      :host {
        display: contents;
        --qc-spring: linear(0, 0.4, 0.75, 0.92, 1);
        --qc-spring-flick: var(--qc-spring);
        --qc-open-ms: 576ms;
        --qc-close-ms: 180ms;
        --qc-w: 480px;
        --qc-w-wide: min(900px, calc(100vw - 48px));
        --qc-pop-w: 620px;
        --qc-pop-w-wide: min(1040px, calc(100vw - 48px));
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: var(--sw-z-modal);
        background: var(--sw-overlay);
        -webkit-backdrop-filter: var(--sw-backdrop-blur); /* taste-skill-ignore: the skin contract's scrim blur, none by default */
        backdrop-filter: var(--sw-backdrop-blur); /* taste-skill-ignore: the skin contract's scrim blur, none by default */
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--qc-close-ms) var(--sw-ease-out);
      }
      :host([open]) .scrim {
        opacity: 1;
        pointer-events: auto;
        transition: opacity 240ms var(--sw-ease);
      }
      .panel {
        position: fixed;
        z-index: calc(var(--sw-z-modal) + 1);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        color: var(--sw-text);
        background: var(--sw-surface-solid);
        border: 1px solid var(--sw-border-strong); /* taste-skill-ignore: the floating dialog's edge over a dark page */
        box-shadow: inset 0 1px 0 var(--sw-highlight), var(--sw-shadow-3); /* taste-skill-ignore: a real overlay (dialog) floats */
        isolation: isolate;
        overflow: hidden;
        visibility: hidden;
        will-change: transform;
        transition: transform var(--qc-close-ms) var(--sw-ease-out), opacity var(--qc-close-ms) var(--sw-ease-out), inline-size var(--qc-open-ms) var(--qc-spring), visibility 0s linear var(--qc-close-ms);
      }
      /* OVERLAY-FADE-2520: the entrance moves only (no opacity in the open state's transition: the panel and its texts are at full contrast
         from the first frame they are visible); the exit above may still fade the pop-up - a closed panel is inert (render) */
      :host([open]) .panel {
        visibility: visible;
        transition: transform var(--qc-open-ms) var(--qc-spring), inline-size var(--qc-open-ms) var(--qc-spring), visibility 0s;
      }
      /* ---- drawer: the inline start (right in Hebrew) ---- */
      :host([mode='drawer']) .panel {
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: min(var(--qc-w), 100vw);
        border-inline-start: 0;
        border-block: 0;
        border-start-end-radius: var(--sw-r-xl);
        border-end-end-radius: var(--sw-r-xl);
        transform: translateX(var(--qc-out, 100%));
      }
      :host-context([dir='ltr']) :host([mode='drawer']) .panel,
      :host([mode='drawer'][data-ltr]) .panel {
        --qc-out: -100%;
      }
      :host([mode='drawer'][data-expanded]) .panel {
        inline-size: var(--qc-w-wide);
      }
      :host([mode='drawer'][open][data-shown]) .panel {
        transform: none;
      }
      /* ---- pop-up: centred, grows out of the pressed element ---- */
      /* HOMEFABLE-297 (emil-design-eng: a modal under 300-500 ms; apple-design: materialize - blur and scale arrive together): the
         pop-up lands in 380 ms on the same spring, the scrim behind it blurs the page a touch */
      :host([mode='popup']) {
        --qc-open-ms: 380ms;
      }
      :host([mode='popup']) .scrim {
        -webkit-backdrop-filter: var(--sw-popup-blur); /* taste-skill-ignore: the dimmed page behind a dialog */
        backdrop-filter: var(--sw-popup-blur); /* taste-skill-ignore: the dimmed page behind a dialog */
      }
      :host([mode='popup']) .panel {
        inset-inline: 0;
        margin-inline: auto;
        inset-block-start: 50%;
        inline-size: min(var(--qc-pop-w), calc(100vw - 32px));
        max-block-size: min(86vh, 900px);
        border-radius: var(--sw-r-2xl);
        opacity: 0;
        transform: translateY(-50%) var(--qc-from, scale(0.96));
      }
      :host([mode='popup'][data-expanded]) .panel {
        inline-size: var(--qc-pop-w-wide);
      }
      /* OVERLAY-FADE-2520: opaque as soon as it opens - the first painted frame is the pressed element's box (the FLIP start), at full
         contrast; then it springs to the centre */
      :host([mode='popup'][open]) .panel {
        opacity: 1;
      }
      :host([mode='popup'][open][data-shown]) .panel {
        transform: translateY(-50%);
      }
      /* ---- bottom sheet (phone): three detents, dragged ---- */
      :host([mode='sheet']) .panel {
        inset-inline: 0;
        inset-block-end: 0;
        block-size: 100dvh;
        border-inline: 0;
        border-block-end: 0;
        border-start-start-radius: var(--sw-r-2xl);
        border-start-end-radius: var(--sw-r-2xl);
        padding-block-end: env(safe-area-inset-bottom, 0px);
        transform: translateY(100%);
      }
      /* the list scrolls with the finger; the grabber and the head drag the sheet */
      :host([mode='sheet']) .body {
        touch-action: pan-y;
        --_mask: linear-gradient(to bottom, #000 calc(100% - 28px), transparent 100%); /* taste-skill-ignore: a fade MASK at the cut edge, not a fill */
        -webkit-mask-image: var(--_mask);
        mask-image: var(--_mask);
      }
      :host([mode='sheet'][open][data-shown]) .panel {
        transform: translateY(var(--qc-rest, 38%));
      }
      /* AREAEDIT-2290: the editor's footer (reset / cancel / save) must always be on screen. The browsing sheet is a full-height panel
         pushed down by its detent (its lower part is cropped; the list scrolls); the editor panel is only as tall as the visible part. */
      :host([mode='sheet'][data-editing]) .panel {
        inset-block-start: 0;
        inset-block-end: auto;
        block-size: calc(100dvh - var(--qc-rest, 0px));
      }
      :host([data-dragging]) .panel {
        transition: none !important;
      }
      :host([data-flick]) .panel {
        transition-timing-function: var(--qc-spring-flick);
      }
      .grab {
        display: none;
        flex: none;
        inline-size: 100%;
        block-size: 32px;
        border: 0;
        background: transparent;
        padding: 0;
        cursor: grab;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .grab::before {
        content: '';
        display: block;
        inline-size: 40px;
        block-size: 5px;
        border-radius: 3px;
        margin: 10px auto 0;
        background: var(--sw-text-3);
        opacity: 0.55;
      }
      :host([mode='sheet']) .grab {
        display: block;
      }
      :host([mode='sheet']) header {
        padding-block-start: 2px;
        touch-action: none;
      }
      /* ---- the head: icon ring, name, the floor and the temperature, the actions ---- */
      /* HOMEFABLE-297 (impeccable typeset): the room's name is the display line of the surface - 24 px / 800, tight - over a 14.5 px
         reading line; the icon ring a 46 px object with the ladder's first shadow, lit when something is on */
      header {
        flex: none;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 14px;
        padding: 18px 20px 12px;
      }
      .ring {
        inline-size: 46px;
        block-size: 46px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
        box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
        --sw-icon-stroke: 2;
      }
      .ring[data-on] {
        background: var(--sw-lit-soft);
        color: var(--sw-heading);
      }
      .ttl {
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-2xl);
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--sw-heading);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub {
        margin-block-start: 3px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub b {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      /* each piece of the sub-line keeps its own direction (a number next to Hebrew never swaps places) */
      .sub > span {
        unicode-bidi: isolate;
      }
      /* AREA-PRESENCE-LINE-2351 (owner 02.11, round 14): the area line, as on the area screen - one fixed-height line that never wraps
         (a long list ends in an ellipsis; the full list is the tooltip); green only while someone is there */
      .pline {
        display: flex;
        align-items: center;
        gap: 6px;
        min-inline-size: 0;
        block-size: 24px;
        margin-block-start: 2px;
        font-size: var(--sw-fs-sm);
        line-height: 1.2;
        color: var(--sw-text-2);
        white-space: nowrap;
        overflow: hidden;
      }
      .pline sw-icon,
      .pline .psep {
        flex: none;
        color: var(--sw-text-3);
      }
      .pline .plbl {
        flex: none;
      }
      .pline b {
        flex: none;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .pline[data-tone='ok'] sw-icon,
      .pline[data-tone='ok'] b {
        color: var(--sw-success-text);
      }
      .pline .pwho {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--sw-text);
      }
      /* PRESENCE-COMPACT-2310: the room's presence - green words only while active, a hollow dot for "no data" */
      .sub .pres i {
        display: inline-block;
        inline-size: 7px;
        block-size: 7px;
        border-radius: 50%;
        margin-inline-end: 5px;
        vertical-align: 0.1em;
        background: var(--sw-unknown);
      }
      .sub .pres[data-tone='ok'] {
        color: var(--sw-success-text);
        font-weight: var(--sw-fw-medium);
      }
      .sub .pres[data-tone='ok'] i {
        background: var(--sw-success);
      }
      .sub .pres[data-tone='unknown'] i {
        background: transparent;
        box-shadow: inset 0 0 0 1.5px var(--sw-unknown);
      }
      .acts {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .ib {
        inline-size: 36px;
        block-size: 36px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--sw-text-2);
        display: grid;
        place-items: center;
        cursor: pointer;
        padding: 0;
        text-decoration: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: background-color var(--sw-t-fast) var(--sw-ease), transform 120ms var(--sw-ease-out);
      }
      .ib:active {
        transform: scale(0.94);
      }
      @media (hover: hover) and (pointer: fine) {
        .ib:hover {
          background: var(--sw-hover-wash);
          color: var(--sw-text);
        }
      }
      .ib:focus-visible,
      .qb:focus-visible,
      .scene:focus-visible,
      .grab:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      @media (max-width: 767px) {
        .ib {
          inline-size: 44px;
          block-size: 44px;
        }
        /* a narrow head: the floor, the temperature and the count may take a second line instead of an ellipsis */
        .sub {
          white-space: normal;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
        }
      }
      /* ---- the body: no scroll where it fits; a scroll only when it does not ---- */
      .body {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: 4px 20px 20px;
      }
      .cols {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      /* expanded: two CSS columns in a box of its own height (a column box with a fixed height spills sideways - break-ui found it) */
      :host([data-expanded]) .cols {
        display: block;
        column-count: 2;
        column-gap: 20px;
      }
      :host([data-expanded]) .cols > * {
        break-inside: avoid;
        margin-block-end: 16px;
      }
      :host([data-expanded]) .cols > .quick,
      :host([data-expanded]) .cols > .note {
        column-span: all;
      }
      /* the content settles in as the panel lands. OVERLAY-FADE-2520: by transform only - no fade, so no text waits below contrast through
         its stagger delay */
      :host([open][data-shown]) .cols > * {
        animation: qc-in var(--qc-open-ms) var(--sw-ease-dialog) both;
      }
      :host([open][data-shown]) .cols > :nth-child(2) {
        animation-delay: 40ms;
      }
      :host([open][data-shown]) .cols > :nth-child(3) {
        animation-delay: 80ms;
      }
      :host([open][data-shown]) .cols > :nth-child(n + 4) {
        animation-delay: 110ms;
      }
      @keyframes qc-in {
        from {
          transform: translateY(6px);
        }
      }
      /* ---- the quick strip: the area's group actions ---- */
      .quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      /* HOMEFABLE-297 (apple-design materials, emil press): the group actions are raised keys (a tone step, the first shadow, 14.5 px
         semibold) and the one that turns the room off is a filled danger key, not a red outline; a press sinks the key at once */
      .qb {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-block-size: 40px;
        padding: 0 16px;
        border: 1px solid var(--sw-border); /* taste-skill-ignore: the key's edge, one step under the panel outline */
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-1); /* taste-skill-ignore: a raised key (owner: depth) */
        color: var(--sw-heading);
        font: inherit;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: background-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
      }
      .qb:active:not(:disabled) {
        transform: scale(var(--sw-press-scale, 0.97));
        box-shadow: none;
        background: var(--sw-pressed-wash);
      }
      .qb:disabled {
        opacity: 0.5;
        cursor: default;
      }
      @media (hover: hover) and (pointer: fine) {
        .qb:hover:not(:disabled) {
          background: var(--sw-surface);
          box-shadow: var(--sw-shadow-2);
        }
      }
      .qb.main {
        background: var(--sw-danger-soft);
        border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
        color: var(--sw-danger-text);
      }
      @media (hover: hover) and (pointer: fine) {
        .qb.main:hover:not(:disabled) {
          background: var(--sw-danger-soft);
          border-color: color-mix(in srgb, var(--sw-danger) 60%, transparent);
        }
      }
      @media (max-width: 767px) {
        .qb {
          min-block-size: 44px;
        }
      }
      /* ---- a section: a small label with its icon and count, then the rows ---- */
      .sec {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-inline-size: 0;
      }
      /* HOMEFABLE-297: a section is a real heading (14.5 px bold, heading ink, the icon in the accent) with its count as a filled pill */
      .sh {
        display: flex;
        align-items: center;
        gap: 7px;
        padding-inline: 2px;
        padding-block-start: 6px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.01em;
        color: var(--sw-heading);
      }
      .sh > sw-icon {
        color: var(--sw-accent);
      }
      .sh .n {
        margin-inline-start: auto;
        min-inline-size: 22px;
        padding: 1px 8px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface-3);
        color: var(--sw-text-2);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-bold);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'ic nm ct' 'ic st ct';
        align-items: center;
        column-gap: 12px;
        min-block-size: 50px;
        padding: 7px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        border: 1px solid transparent; /* taste-skill-ignore: reserves the width, no visible line */
        transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
      }
      .row.on {
        background: var(--sw-lit-soft);
      }
      .row.on[data-card='climate'],
      .row.on[data-card='heating'],
      .row.on[data-card='covers'],
      .row.on[data-card='media'] {
        background: var(--sw-accent-soft);
      }
      .row > sw-icon {
        grid-area: ic;
        color: var(--sw-text-3);
      }
      .row.on > sw-icon {
        color: var(--sw-heading);
      }
      .row .nm {
        grid-area: nm;
        font-size: var(--sw-fs-name);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.25;
      }
      .row .st {
        grid-area: st;
        font-size: var(--sw-fs-state);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .ct {
        grid-area: ct;
        display: inline-flex;
        align-items: center;
      }
      /* the shared controls (devices-controls.ts) take a whole line under the name and the state */
      .row > .ctl-row,
      .row > .ctl-range,
      .row > .cmd-status,
      .row > .rollback-note {
        grid-column: 1 / -1;
        grid-row: auto;
      }
      .row > .ctl-row {
        margin-block-start: 4px;
      }
      /* sensors: value chips */
      .sens {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
      }
      .sv {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
        padding: 8px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        line-height: 1.25;
      }
      .sv b {
        font-size: var(--sw-fs-xl);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--sw-heading);
        font-variant-numeric: tabular-nums;
      }
      .sv span {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* cameras */
      .cams {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 8px;
      }
      .cams devices-camera-card {
        border-radius: var(--sw-r-media);
        overflow: hidden;
      }
      /* scenes: chips that run */
      .scenes {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .scene {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        padding: 0 12px;
        border: 1px solid var(--sw-border-strong); /* taste-skill-ignore: the same outlined pill as the home's own quick actions */
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface);
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: transform 120ms var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
      }
      .scene:active {
        transform: scale(0.97);
      }
      .scene[data-busy] {
        opacity: 0.6;
      }
      /* FIX-FE2-2570 (FE2-01): what happened to the last scene press - "sent", or the server's reason in red */
      .scene-note {
        margin-block-start: 6px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .scene-note.bad {
        color: var(--sw-danger-text);
      }
      .scene-note.warn {
        color: var(--sw-warning-text);
      }
      @media (hover: hover) and (pointer: fine) {
        .scene:hover {
          background: var(--sw-surface-2);
        }
      }
      /* schedules and events: quiet lines */
      .line {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: 36px;
        padding: 4px 10px;
        border-radius: var(--sw-r-sm);
        background: var(--sw-surface-2);
        font-size: var(--sw-fs-sm);
      }
      .line .nm {
        flex: 1;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--sw-heading);
        font-weight: var(--sw-fw-medium);
      }
      .line .tm {
        flex: none;
        color: var(--sw-text-3);
        font-variant-numeric: tabular-nums;
        font-size: var(--sw-fs-xs);
      }
      .line.off .nm {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-regular);
      }
      .line .dot {
        flex: none;
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        background: var(--sw-success);
      }
      .line.off .dot {
        background: var(--sw-text-3);
        opacity: 0.5;
      }
      .note {
        padding: 18px 8px;
        text-align: center;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .spin {
        inline-size: 18px;
        block-size: 18px;
        margin: 24px auto;
        border-radius: 50%;
        border: 2px solid var(--sw-border-strong);
        border-block-start-color: var(--sw-accent);
        animation: qc-spin 0.7s linear infinite;
      }
      @keyframes qc-spin {
        to {
          transform: rotate(360deg);
        }
      }
      /* ---- solid when the browser cannot blur or the OS asks for less transparency / more contrast ---- */
      @media (prefers-reduced-transparency: reduce) {
        .scrim {
          -webkit-backdrop-filter: none; /* taste-skill-ignore: the reset */
          backdrop-filter: none; /* taste-skill-ignore: the reset */
        }
      }
      @media (prefers-contrast: more) {
        .panel {
          border-color: var(--sw-text-2);
        }
      }
      /* ---- reduced motion: no travel, no spring. OVERLAY-FADE-2520: the panel is there at once, at full contrast (it used to cross-fade
         in); only the exit keeps its short fade - a closed panel is inert (render) ---- */
      @media (prefers-reduced-motion: reduce) {
        .panel,
        :host([open]) .panel,
        :host([mode='drawer']) .panel,
        :host([mode='popup']) .panel,
        :host([mode='sheet']) .panel {
          transition: opacity 160ms var(--sw-ease), visibility 0s linear 160ms !important;
          opacity: 0;
        }
        :host([mode='drawer'][open]) .panel,
        :host([mode='popup'][open]) .panel,
        :host([mode='sheet'][open]) .panel {
          opacity: 1;
          transition: none !important;
        }
        :host([mode='drawer']) .panel {
          transform: none;
        }
        :host([mode='popup']) .panel {
          transform: translateY(-50%);
        }
        :host([mode='sheet']) .panel {
          transform: translateY(var(--qc-rest, 38%));
        }
        :host([open][data-shown]) .cols > * {
          animation: none;
        }
        .spin {
          animation-duration: 1.4s;
        }
      }

      /* ---- AREAEDIT-2290: the editor (same panel; hide + order). Tokens only; green is never used here, the switch is accent blue ---- */
      /* the name keeps its ellipsis, the "editing" label never leaves; on the phone the head carries only the close button while editing */
      h2 {
        display: flex;
        align-items: center;
        min-inline-size: 0;
      }
      h2 .hn {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      h2 .editing {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-inline-start: 10px;
        padding: 2px 8px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-semibold);
        letter-spacing: 0;
        vertical-align: middle;
      }
      /* a 375 px row: four 44 px controls + the name; the "hidden" word gives way to the dimmed row and the closed eye */
      :host([mode='sheet']) .er {
        gap: 2px;
        padding-inline: 4px;
      }
      :host([mode='sheet']) .er .hidtag {
        display: none;
      }
      :host([mode='sheet'][data-editing]) [data-qc-expand],
      :host([mode='sheet'][data-editing]) [data-qc-open-screen] {
        display: none;
      }
      .ed {
        position: relative;
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
      .ed-main {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto; /* only when the sections do not fit (an accordion keeps it rare); the footer never scrolls away */
        overflow-x: hidden;
        padding: 4px 20px 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      /* two columns (list + side) only where there is room: the pop-up and the widened drawer; the 480 px drawer and the phone stack them */
      :host([mode='popup']) .ed-main,
      :host([mode='drawer'][data-expanded]) .ed-main {
        flex-direction: row;
        align-items: flex-start;
      }
      :host([mode='popup']) .ed-list,
      :host([mode='drawer'][data-expanded]) .ed-list {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .ed-list {
        min-inline-size: 0;
      }
      .ed-side {
        flex: none;
      }
      :host([mode='popup']) .ed-side,
      :host([mode='drawer'][data-expanded]) .ed-side {
        flex: 0 0 240px;
      }
      .er {
        display: flex;
        align-items: center;
        gap: 6px;
        min-block-size: 48px; /* a 44 px control and 2 px of air on each side */
        padding: 2px 6px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        margin-block-end: 4px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text);
      }
      .er.off .nm {
        color: var(--sw-text-3);
      }
      .er.off {
        opacity: 0.7;
      }
      .er.it {
        margin-inline-start: 24px;
        min-block-size: 46px; /* the 44 px control inside the 1 px edge */
        padding-block: 0;
        background: transparent;
        border: 1px solid var(--sw-border);
      }
      .er .nm {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: var(--sw-fw-semibold);
      }
      .er .meta,
      .er .hidtag {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        white-space: nowrap;
      }
      .er .tag {
        font-size: var(--sw-fs-xs);
        padding: 1px 6px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        color: var(--sw-text-2);
        white-space: nowrap;
      }
      .grow {
        flex: 1 1 auto;
      }
      .eye,
      .mv,
      .grip,
      .exp {
        inline-size: 44px; /* a touch target is 44 x 44 at every width (owner rule); the 375 px row drops the drag handle to make room */
        block-size: 44px;
        flex: none;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--sw-r-md);
        background: transparent;
        color: var(--sw-text-2);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .grip {
        cursor: grab;
        touch-action: none; /* a finger on the handle reorders; it never scrolls the list or drags the sheet */
      }
      :host([data-ed-dragging]) .grip {
        cursor: grabbing;
      }
      .eye[aria-pressed='true'] {
        color: var(--sw-accent-text);
      }
      .mv:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .exp sw-icon {
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .exp[aria-expanded='true'] sw-icon {
        transform: rotate(180deg);
      }
      .exp-gap {
        inline-size: 44px;
        flex: none;
      }
      /* the editor's other controls reach 44 px too: the apply-to switch, "show more", the footer keys, the head's buttons, the sheet's handle,
         the alert switch (its host is padded to 44 x 44; a press on the padding flips it) */
      :host([data-editing]) .ib,
      :host([data-editing]) .qb,
      .more {
        min-block-size: 44px;
      }
      :host([data-editing]) .ib {
        inline-size: 44px;
        block-size: 44px;
      }
      :host([data-editing]) .grab {
        block-size: 44px;
      }
      .more {
        padding-inline: 12px;
      }
      .ed-side sw-toggle {
        padding: 10px 1px;
        box-sizing: content-box;
      }
      @media (hover: hover) and (pointer: fine) {
        .eye:hover,
        .mv:hover:not(:disabled),
        .grip:hover,
        .exp:hover {
          background: var(--sw-hover-wash);
          color: var(--sw-text);
        }
      }
      .eye:focus-visible,
      .mv:focus-visible,
      .grip:focus-visible,
      .exp:focus-visible,
      .more:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .more {
        margin-inline-start: 24px;
        border: 0;
        background: transparent;
        color: var(--sw-accent-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        cursor: pointer;
        padding: 6px 12px;
      }
      .ed-side {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ed-side .fld {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ed-side .fld.tgrow {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ed-side b {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .ed-side small,
      .ed-side .fine {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        line-height: 1.4;
      }
      .ed-side .fine {
        display: flex;
        gap: 6px;
        align-items: flex-start;
      }
      .vh {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      /* CR-CMP2-SEGMENTED-C-2450: the apply-to switch is sw-segmented (a radio group of two equal keys filling the column); it keeps
         its 3 px track on surface 2, the 44 px small semibold key and the solid chosen key through the knobs */
      .fld sw-segmented {
        flex: none;
        --sw-seg-track: var(--sw-surface-2);
        --sw-seg-radius: var(--sw-r-md);
        --sw-seg-btn-radius: var(--sw-r-sm, var(--sw-r-md));
        --sw-seg-pad: 3px;
        --sw-seg-gap: 3px;
        --sw-seg-h: 44px;
        --sw-seg-fs: var(--sw-fs-sm);
        --sw-seg-fw: var(--sw-fw-semibold);
        --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface-solid));
        --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-text));
        --sw-disabled-opacity: 0.45;
        /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
        --sw-seg-key-pad: 14px;
      }
      .sitewarn,
      .warn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-radius: var(--sw-r-md);
        background: var(--sw-warning-soft, var(--sw-surface-2));
        color: var(--sw-text);
        font-size: var(--sw-fs-xs);
        line-height: 1.4;
      }
      .warn {
        margin-inline: 20px;
        margin-block-end: 6px;
        flex-wrap: wrap;
      }
      .ed-foot {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px calc(12px + env(safe-area-inset-bottom, 0px));
        border-block-start: 1px solid var(--sw-border);
        background: var(--sw-surface-solid);
      }
      .ed-foot .qb {
        white-space: nowrap;
        flex: none;
      }
      :host([mode='sheet']) .ed-foot {
        padding-inline: 12px;
        gap: 6px;
      }
      :host([mode='sheet']) .ed-foot .qb {
        padding-inline: 12px;
      }
      .ed-side sw-toggle {
        --sw-toggle-on: var(--sw-accent); /* the editor's switch is accent blue, never the success green */
      }
      :host([data-editing]) .sub {
        white-space: normal;
      }
      :host([mode='drawer']:not([data-expanded])) .ed-foot .lockn {
        display: none; /* the narrow drawer has no room for the note; the head's hint and the disabled controls say it */
      }
      .ed-foot .lockn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .qb.pri {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
        color: var(--sw-text-inverse);
      }
      .ed-foot .qb:focus-visible,
      .warn .qb:focus-visible,
      .cf .qb:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .cf-scrim {
        position: absolute;
        inset: 0;
        background: var(--sw-overlay);
        z-index: 2;
      }
      .cf {
        position: absolute;
        z-index: 3;
        inset-inline: 20px;
        inset-block-end: 20px;
        padding: 16px;
        border-radius: var(--sw-r-xl);
        background: var(--sw-surface-solid);
        border: 1px solid var(--sw-border-strong);
        box-shadow: var(--sw-shadow-3);
      }
      .cf h3 {
        margin: 0 0 6px;
        font-size: var(--sw-fs-lg);
        color: var(--sw-heading);
      }
      .cf p {
        margin: 0 0 12px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text-2);
      }
      .cf .row2 {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      /* a hidden sensor that is in alarm: shown for as long as it alarms, red (only an alarm is red) */
      .sv.alarm {
        background: var(--sw-danger-soft);
        outline: 1px solid color-mix(in srgb, var(--sw-danger) 55%, transparent);
        outline-offset: -1px;
      }
      .sv.alarm b {
        color: var(--sw-danger-text);
      }
      .sv.alarm em {
        font-style: normal;
        font-size: var(--sw-fs-xs);
        color: var(--sw-danger-text);
        line-height: 1.3;
      }
    `,
  ];
