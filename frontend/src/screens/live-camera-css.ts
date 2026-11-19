import { css } from 'lit';
import { bubbleChrome } from '../styles/bubble-chrome';

/**
 * CR-STRUCT-CSS-SPLIT-2442 (code review 06:STRUCT-1 step 1): the style sheets of `live-camera` (screens/live-camera.ts), moved here as they
 * stood - same CSS text, same order, same composition of the array. The screen keeps `static styles = liveCameraStyles`.
 */

export const liveCameraStyles = [css`
    /* the detection-zones view (renderZones). Here, not in a <style> element of the template: the remote channel's strict
       CSP (style-src-elem 'self', CR-008 P2) refuses inline style elements; static styles are constructed stylesheets */
    .zones .frame { position: relative; aspect-ratio: 16 / 9; background: var(--sw-video-bg); border-radius: var(--sw-r-sm); overflow: hidden; }
    .zones .frame img { inline-size: 100%; block-size: 100%; object-fit: fill; display: block; }
    .zones .frame svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
    /* POLISH4-WP2: the overlays drawn over the video take tokens of the video domain (fixed in both schemes, as the picture is):
       motion cells the timeline's motion tone, a mask the video ink, a field the warning tone, a line the recorded blue */
    .zones .cell { fill: color-mix(in srgb, var(--sw-tl-motion) 28%, transparent); stroke: color-mix(in srgb, var(--sw-tl-motion) 55%, transparent); stroke-width: 1; }
    .zones .mask { fill: color-mix(in srgb, var(--sw-video-bg) 78%, transparent); stroke: var(--sw-video-bg); stroke-width: 3; }
    .zones .field { fill: color-mix(in srgb, var(--sw-warning) 25%, transparent); stroke: var(--sw-warning); stroke-width: 4; }
    .zones .line { fill: none; stroke: var(--sw-recorded); stroke-width: 6; }
    .zones .handle { stroke: var(--sw-on-video); stroke-width: 3; }
    .zones .handle.field { fill: var(--sw-warning); stroke-width: 3; }
    .zones .handle.line { fill: var(--sw-recorded); stroke-width: 3; }
    .zones .line.off { stroke-dasharray: 14 10; opacity: 0.6; }
    .zones .legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-block-start: 8px; }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      /* owner report: on a wide desktop (design A has no page max-width), a 16:9 box at full page width grows
         taller than the viewport - the controls and settings below need a scroll to even see they exist. Capping
         the height (the width then follows from the ratio) keeps the whole screen reachable without scrolling. */
      max-block-size: min(60dvh, 640px);
      inline-size: 100%;
      margin-inline: auto;
      overflow: hidden;
      background: var(--sw-video-bg);
      color: var(--sw-on-video);
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, color-mix(in srgb, var(--sw-video-scrim) 18%, transparent) 0%, transparent 25%, transparent 65%, color-mix(in srgb, var(--sw-video-scrim) 82%, transparent) 100%);
      pointer-events: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: var(--sw-fs-2xs);
      letter-spacing: 0.04em;
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 2px 7px;
      z-index: 2;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 10px;
      font-family: var(--sw-font-mono);
      direction: ltr;
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px var(--sw-video-scrim);
    }
    .quality {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 10px;
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px var(--sw-video-scrim);
      direction: ltr;
      z-index: 2;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    /* EVIDENCE-CAMERAS-2412: the "no WebRTC server" link was the browser's default blue on the dark video area */
    .center[data-webrtc-required] a {
      color: inherit;
      font-weight: var(--sw-fw-semibold);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .cast-status {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-block-start: 10px;
      padding: 8px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      font-size: var(--sw-fs-sm);
    }
    .cast-status[data-cast-status-state='not_confirmed'] {
      border-color: var(--sw-danger);
    }
    .cast-status .who {
      font-weight: var(--sw-fw-medium);
    }
    .cast-status .low {
      color: var(--sw-stale);
    }
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .round {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
    }
    .round button {
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .round button:hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .round button:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: not-allowed;
    }
    .round button,
    .zoom button,
    .joy button {
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .round button:active,
    .zoom button:active,
    .joy button:active {
      transform: scale(0.94);
    }
    .round button:focus-visible,
    .zoom button:focus-visible,
    .joy button:focus-visible,
    .round .transport button:focus-visible,
    summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (prefers-reduced-motion: reduce) {
      .round button:active,
      .zoom button:active,
      .joy button:active {
        transform: none;
      }
    }
    .round .q {
      inline-size: auto;
      border-radius: var(--sw-r-pill);
      font: inherit;
    }
    .round .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .transport {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .round .transport button {
      display: inline-block;
      inline-size: auto;
      border: 0;
      background: transparent;
      box-shadow: none;
      font: inherit;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .round .transport button.on {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .ptz {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .joy {
      position: relative;
      inline-size: 64px;
      block-size: 64px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    .joy button {
      position: absolute;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      border-radius: 50%;
    }
    .joy .u {
      inset-block-start: 3px;
      inset-inline-start: 22px;
    }
    .joy .d {
      inset-block-end: 3px;
      inset-inline-start: 22px;
    }
    .joy .l {
      inset-inline-start: 3px;
      inset-block-start: 22px;
    }
    .joy .r {
      inset-inline-end: 3px;
      inset-block-start: 22px;
    }
    .joy .c {
      inset-inline-start: 26px;
      inset-block-start: 26px;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .zoom {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zoom button {
      inline-size: 28px;
      block-size: 28px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .modes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      margin: 0;
    }
    dd {
      margin: 0;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30: 464 px at 1366x768). The wrappers are inert
       below 1024 px (display: contents: the tablet and the phone keep the stacked page). From 1024 px the page takes the screen's
       height and splits in two: the player column (the video as large as the room allows at 16:9, its controls under it, always on
       screen) and a side column with the details / settings, which scrolls inside itself when the settings are opened. */
    .stage,
    .stage-main,
    .stage-side,
    .vbox {
      display: contents;
    }
    @media (min-width: 1024px) {
      sw-page {
        block-size: 100%;
      }
      .stage {
        display: grid;
        grid-template-columns: minmax(0, 1fr) clamp(300px, 27vw, 400px);
        gap: 14px;
        flex: 1 1 0;
        min-block-size: 0;
      }
      .stage-main {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
        min-inline-size: 0;
      }
      .vbox {
        display: block;
        /* as tall as 16:9 of the column when there is room (the controls sit right under the picture), shorter when there is not
           (the picture then narrows to keep 16:9, centred) */
        aspect-ratio: 16 / 9;
        flex: 0 1 auto;
        min-block-size: 160px;
        container-type: size;
      }
      .vbox > .video {
        inline-size: min(100cqw, calc(100cqh * 16 / 9));
        max-block-size: none;
      }
      .stage-side {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-block-size: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        /* room for the cards' shadow and the focus ring inside the scroller */
        padding: 2px 4px 6px;
        margin: -2px -4px 0;
      }
      .stage-side > .grid {
        grid-template-columns: minmax(0, 1fr);
        margin-block-start: 0;
      }
      .stage-side > .acc-root {
        margin-block-start: 0;
      }
    }
    /* settings accordion (owner round 4, 2.6): the video keeps its place, everything below starts collapsed
       under one "camera settings" toggle, and each setting inside is its own collapsed row. */
    .acc-root {
      margin-block-start: 12px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .acc-root > summary {
      padding: 12px 14px;
    }
    .acc-root[open] > summary {
      border-block-end: 1px solid var(--sw-border);
    }
    .acc-body {
      padding: 4px 14px 8px;
      display: flex;
      flex-direction: column;
    }
    summary {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary .chev {
      flex: none;
      color: var(--sw-text-3);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    details[open] > summary .chev {
      transform: rotate(90deg);
    }
    .acc {
      border-block-start: 1px solid var(--sw-border);
    }
    .acc > summary {
      padding: 10px 2px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      justify-content: space-between;
    }
    .acc > summary .lbl {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .acc-content {
      padding: 0 2px 12px;
    }
    /* R5-LIVE-297 (the HOMEFABLE method on the single camera): the picture is the hero (radius 2xl, the third shadow); the stream
       choice is a pair of raised keys with the chosen one a filled accent key, 14 px bold; the round tools are 42 px raised keys that
       sink on pointer-down and tint on hover only under a fine pointer; the details card's facts are WELLS (label over a 15 px bold
       value) instead of grey label / value text; a camera that is down is a filled offline field */
    .video {
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--sw-shadow-3);
    }
    .video.off {
      background: color-mix(in srgb, var(--sw-offline) 40%, var(--sw-surface-3));
      box-shadow: var(--sw-shadow-1);
    }
    .stamp {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .quality {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
    }
    /* visible-difference test (50 %): on a desktop the picture is most of the frame, so the tool row became a tier-2 strip - the
       surface, the first shadow, rounded - that reads as the camera's control deck under the hero */
    .controls {
      margin-block-start: 14px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .round button {
      border-color: var(--sw-border);
      color: var(--sw-heading);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .round button:hover {
      background: var(--sw-surface);
      color: var(--sw-heading);
    }
    @media (hover: hover) and (pointer: fine) {
      .round button:hover:not(:disabled) {
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-2);
      }
      /* DARK-SEG-ALL-2380: a hovered chosen transport key keeps the dark light pill (its label is the key's dark ink); light: surface-2 as before */
      .round .transport button.on:hover:not(:disabled) {
        background: var(--sw-seg-key, var(--sw-surface-2));
      }
    }
    .round button:active:not(:disabled),
    .zoom button:active,
    .joy button:active {
      transform: scale(var(--sw-press-scale, 0.94));
      box-shadow: none;
    }
    .round .q {
      font-variant-numeric: tabular-nums;
    }
    .round .q.on,
    .round .q.on:hover {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-primary);
    }
    .grid {
      gap: 16px;
      margin-block-start: 16px;
    }
    /* each label / value pair is one well row: the two cells share the surface-2 fill and round the row's outer corners */
    dl {
      gap: 5px 0;
      font-size: var(--sw-fs-md);
    }
    dt,
    dd {
      display: flex;
      align-items: center;
      min-block-size: 40px;
      padding: 6px 12px;
      background: var(--sw-surface-2);
    }
    dt {
      color: var(--sw-text-2);
      border-start-start-radius: var(--sw-r-md);
      border-end-start-radius: var(--sw-r-md);
    }
    dd {
      min-inline-size: 0;
      justify-content: flex-end;
      text-align: end;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-variant-numeric: tabular-nums;
      border-start-end-radius: var(--sw-r-md);
      border-end-end-radius: var(--sw-r-md);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .acc-root {
      border-radius: var(--sw-r-lg);
    }
    .acc-root > summary {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    @media (prefers-reduced-motion: reduce) {
      .round button:active:not(:disabled) {
        transform: none;
      }
    }
    /* R5-LIVE-297 Fable pass (the Opus deck was a full-width strip, 80 % empty, that vanished in the flat skins): the deck hugs its
       keys - a raised remote (radius xl, the second shadow) at the start edge under the picture, not a band; 44 px keys with the first
       shadow, the stream choice 40 px / 15 px bold with the chosen one a filled accent key; the player's state is a filled field in the
       deck (the same slot as the old "playing through…" note, so the order of controls is unchanged); a camera that is down shows a
       64 px ring with its reason in 15 px semibold */
    .controls {
      inline-size: fit-content;
      max-inline-size: 100%;
      margin-inline-end: auto;
      padding: 10px 12px;
      gap: 10px 14px;
      border-color: transparent;
      border-radius: var(--sw-r-xl);
      /* loop 1: in the flat skins (tesla, Arx Infra, Arx Soft) a surface deck with a faint shadow melted into the page - the deck is a
         7 % tone step in the heading ink, so it reads as a tray in every skin, light and dark, and the surface keys float on it */
      background: color-mix(in srgb, var(--sw-heading) 7%, var(--sw-surface));
      box-shadow: var(--sw-shadow-2);
    }
    .round {
      gap: 8px;
    }
    .round button {
      inline-size: 44px;
      block-size: 44px;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    .round .q {
      block-size: 40px;
      padding-inline: 16px;
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .round .transport {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      padding: 3px;
    }
    .round .transport button {
      block-size: 34px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
    }
    .controls > .note {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      padding: 0 14px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--sw-live) 20%, var(--sw-surface));
      color: var(--sw-heading);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      white-space: nowrap;
    }
    .controls > .note::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
      flex: none;
    }
    .controls[data-player='error'] > .note {
      background: color-mix(in srgb, var(--sw-danger) 20%, var(--sw-surface));
    }
    .controls[data-player='error'] > .note::before {
      background: var(--sw-danger);
    }
    .controls[data-player='connecting'] > .note {
      background: color-mix(in srgb, var(--sw-stale) 22%, var(--sw-surface));
    }
    .controls[data-player='connecting'] > .note::before {
      background: var(--sw-stale);
    }
    .video.off .center {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .video.off .center > div {
      gap: 12px;
      max-inline-size: 36ch;
    }
    .video.off .center sw-icon {
      inline-size: 64px;
      block-size: 64px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
      color: var(--sw-offline-text, var(--sw-text-2));
    }
    .acc-root {
      border-color: transparent;
      box-shadow: var(--sw-shadow-2);
    }
  `, bubbleChrome];
