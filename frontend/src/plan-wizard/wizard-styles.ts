/**
 * PLAN3D-R28-WIZARD-2433: the wizard's layout, from the approved round 28 mockup (map3d/app/arx.css `.wz*`), in product tokens.
 * One fixed frame - the step bar, the canvas, the side panel and the footer - that never scrolls: lists page instead.
 * Wide: canvas | side 380 px. Tablet (<= 1100): side 330 px, only the current step's name. Phone (<= 767): the canvas above,
 * the side below, the step bar becomes a progress line, the footer keeps the safe-area inset.
 */
import { css } from 'lit';

export const wizardStyles = css`
  :host {
    display: block;
    position: relative;
    min-block-size: 0;
    --wz-sure: var(--sw-accent);
    --wz-check: var(--sw-warning);
    --wz-doubt: var(--sw-danger);
    --wz-out: var(--sw-text-3);
    --wz-ease: cubic-bezier(0.23, 1, 0.32, 1);
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .wz {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-rows: 64px minmax(0, 1fr) 68px;
    grid-template-columns: minmax(0, 1fr) 380px;
    grid-template-areas: 'steps steps' 'canvas side' 'foot foot';
    background: var(--sw-bg);
    overflow: hidden;
  }
  button {
    font: inherit;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  button,
  .opt,
  .preset,
  .dev,
  .st {
    user-select: none;
  }
  :focus-visible {
    outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }

  /* ---- the step bar */
  .wz-steps {
    grid-area: steps;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-inline: 20px 12px;
    background: var(--sw-surface);
    border-block-end: 1px solid var(--sw-border);
    min-inline-size: 0;
  }
  .st {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-medium);
    white-space: nowrap;
  }
  .st i {
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    background: var(--sw-surface-3);
    display: grid;
    place-items: center;
    font-style: normal;
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    transition: background-color 200ms var(--wz-ease), color 200ms var(--wz-ease);
  }
  .st.done i {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .st.now {
    color: var(--sw-heading);
    font-weight: var(--sw-fw-bold);
  }
  .st.now i {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .ln {
    flex: 1;
    block-size: 2px;
    background: var(--sw-border);
    min-inline-size: 10px;
    border-radius: 2px;
  }
  .ln.done {
    background: var(--sw-accent);
  }
  .mob {
    display: none;
  }
  .gear {
    margin-inline-start: 10px;
    flex: none;
    inline-size: 40px;
    block-size: 40px;
    border-radius: var(--sw-r-md);
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--sw-text-2);
    transition: transform 140ms ease-out, background-color 150ms ease;
  }
  .gear:active {
    transform: scale(0.97);
  }
  @media (hover: hover) and (pointer: fine) {
    .gear:hover {
      background: var(--sw-surface-3);
    }
  }

  /* ---- the canvas: the plan on a dotted table, never mirrored */
  .wz-canvas {
    grid-area: canvas;
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at 1px 1px, var(--sw-border-strong) 1px, transparent 0) 0 0 / 22px 22px, var(--sw-surface-2);
    direction: ltr;
  }
  .sheet {
    position: absolute;
    inset: 20px;
    display: grid;
    place-items: center;
  }
  svg.plan {
    max-inline-size: 100%;
    max-block-size: 100%;
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(20, 30, 50, 0.16), 0 1px 3px rgba(20, 30, 50, 0.1);
    background: #fff;
  }
  svg.plan [data-cand],
  svg.plan [data-room] {
    cursor: pointer;
  }
  svg.plan.placing {
    cursor: crosshair;
  }
  .legend {
    position: absolute;
    inset-block-end: 12px;
    left: 12px;
    direction: rtl;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    max-inline-size: calc(100% - 24px);
    padding: 8px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    box-shadow: var(--sw-shadow-2);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .legend i {
    inline-size: 18px;
    block-size: 4px;
    border-radius: 2px;
  }
  .legend i.dash {
    background: none !important;
    block-size: 0;
    border-block-start: 3px dashed var(--wz-doubt);
  }
  .legend i.dot {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 50%;
  }
  .legend i.sq {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 3px;
    border: 2px solid var(--sw-text-3);
  }
  /* the scanning band: a full-height layer whose last 90 px carry the light, moved by its own height (no layout per frame) */
  .scan {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent calc(100% - 90px), color-mix(in srgb, var(--sw-accent) 16%, transparent) calc(100% - 18px), color-mix(in srgb, var(--sw-accent) 45%, transparent));
    border-block-end: 2px solid var(--sw-accent);
    animation: scan 2.2s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate;
    pointer-events: none;
  }
  @keyframes scan {
    from {
      transform: translateY(calc(-100% + 90px));
    }
    to {
      transform: translateY(0);
    }
  }
  .drop {
    position: absolute;
    inset: 28px;
    border: 2px dashed var(--sw-border-strong);
    border-radius: var(--sw-r-xl);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 10px;
    text-align: center;
    color: var(--sw-text-2);
    padding: 24px;
    direction: rtl;
    background: var(--sw-surface);
    transition: border-color 150ms ease, background-color 150ms ease;
  }
  .drop.over {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
  }
  .drop .big {
    color: var(--sw-accent);
  }
  .drop b {
    font-size: var(--sw-fs-xl);
    color: var(--sw-heading);
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.3px;
  }
  .drop .row {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .fmts {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    block-size: 24px;
    padding-inline: 8px;
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
  }
  a.tag {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    text-decoration: none;
  }
  input[type='file'] {
    display: none;
  }
  .preview3d {
    position: absolute;
    inset: 0;
  }
  .preview3d sw-plan-3d {
    position: absolute;
    inset: 0;
    block-size: 100%;
  }
  .preview-note {
    position: absolute;
    inset-block-start: 12px;
    right: 12px;
    direction: rtl;
    padding: 6px 10px;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    box-shadow: var(--sw-shadow-1);
  }

  /* ---- the side panel */
  .wz-side {
    grid-area: side;
    background: var(--sw-surface);
    border-inline-start: 1px solid var(--sw-border);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-block-size: 0;
    overflow: hidden;
  }
  .wz-side h2 {
    margin: 0;
    font-size: var(--sw-fs-xl);
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.3px;
    color: var(--sw-heading);
    text-wrap: balance;
  }
  .wz-side > p {
    margin: 0;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .card {
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-lg);
    padding: 12px;
    background: var(--sw-surface);
  }
  .card.soft {
    background: var(--sw-surface-2);
    border-color: transparent;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .card.err {
    background: var(--sw-danger-soft);
    border-color: transparent;
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-sm);
    display: grid;
    gap: 8px;
  }
  .kv {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px 12px;
    align-items: center;
    font-size: var(--sw-fs-sm);
  }
  .kv b {
    font-weight: var(--sw-fw-semibold);
  }
  .tips {
    display: grid;
    gap: 6px;
    margin-block-start: 8px;
    font-size: var(--sw-fs-sm);
  }
  select,
  input[type='text'],
  input[type='number'] {
    block-size: 36px;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    padding-inline: 10px;
    inline-size: 100%;
    min-inline-size: 0;
  }
  @media (pointer: coarse) {
    select,
    input[type='text'],
    input[type='number'] {
      font-size: 16px;
    }
  }
  .prog {
    display: grid;
    gap: 10px;
  }
  .p {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--sw-fs-md);
    color: var(--sw-text-3);
  }
  .p i {
    inline-size: 22px;
    block-size: 22px;
    border-radius: 50%;
    border: 2px solid var(--sw-border-strong);
    display: grid;
    place-items: center;
    flex: none;
  }
  .p.done {
    color: var(--sw-text);
  }
  .p.done i {
    border-color: var(--sw-accent);
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .p.run {
    color: var(--sw-heading);
    font-weight: var(--sw-fw-semibold);
  }
  .p.run i {
    border-color: var(--sw-accent);
    border-inline-start-color: transparent;
    animation: spin 0.8s linear infinite;
  }
  .p .v {
    margin-inline-start: auto;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .cnts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .cnt {
    border-radius: var(--sw-r-md);
    padding: 10px 12px;
    background: var(--sw-surface-2);
  }
  .cnt b {
    display: block;
    font-size: var(--sw-fs-xl);
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.4px;
    color: var(--sw-heading);
    line-height: 1.1;
  }
  .cnt span {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .cnt.chk {
    background: var(--sw-warning-soft);
  }
  .cnt.chk b {
    color: var(--sw-warning-text);
  }
  .cnt.low {
    background: var(--sw-danger-soft);
  }
  .cnt.low b {
    color: var(--sw-danger-text);
  }
  .qhead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pager {
    margin-inline-start: auto;
    flex: none;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .pager button {
    inline-size: 32px;
    block-size: 32px;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: transform 140ms ease-out;
  }
  .pager button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .pager button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .q-crop {
    border-radius: var(--sw-r-md);
    overflow: hidden;
    background: #fff;
    border: 1px solid var(--sw-border);
    block-size: 150px;
    direction: ltr;
  }
  .q-crop svg {
    inline-size: 100%;
    block-size: 100%;
    display: block;
  }
  .conf {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .conf .bar {
    flex: 1;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-3);
    overflow: hidden;
    direction: ltr;
  }
  .conf .bar i {
    display: block;
    block-size: 100%;
    border-radius: 3px;
    background: var(--wz-check);
  }
  .conf.doubt .bar i {
    background: var(--wz-doubt);
  }
  .conf.sure .bar i {
    background: var(--wz-sure);
  }
  .why {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .opt {
    block-size: 44px;
    border-radius: var(--sw-r-md);
    border: 1.5px solid var(--sw-border-strong);
    font-weight: var(--sw-fw-semibold);
    font-size: var(--sw-fs-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--sw-surface);
    cursor: pointer;
    transition: border-color 150ms ease, background-color 150ms ease, transform 120ms ease-out;
  }
  .opt:active {
    transform: scale(0.97);
  }
  .opt[aria-pressed='true'] {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .opt kbd {
    font: var(--sw-fw-semibold) 11px var(--sw-font, inherit);
    color: var(--sw-text-3);
    border: 1px solid var(--sw-border-strong);
    border-radius: 4px;
    padding: 0 5px;
  }
  .measure {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .measure input {
    inline-size: 90px;
  }
  .rooms {
    display: grid;
    gap: 4px;
  }
  .rrow {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) 118px;
    gap: 8px;
    align-items: center;
    block-size: 40px;
  }
  .rrow > i {
    inline-size: 14px;
    block-size: 14px;
    border-radius: 4px;
  }
  .rrow input.empty {
    border-color: var(--sw-warning);
    background: var(--sw-warning-soft);
  }
  .rrow input.linked {
    border-color: color-mix(in srgb, var(--sw-accent) 55%, var(--sw-border-strong));
  }
  .rnote {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .rnote > span:first-child {
    flex: 1;
    min-inline-size: 0;
  }
  .rnote .warn {
    color: var(--sw-warning-text);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .check input {
    inline-size: 18px;
    block-size: 18px;
    margin: 0;
  }
  .presets {
    display: grid;
    gap: 10px;
  }
  .preset {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    border-radius: var(--sw-r-md);
    border: 1.5px solid var(--sw-border);
    overflow: hidden;
    text-align: start;
    background: var(--sw-surface);
    cursor: pointer;
    padding: 0;
    transition: border-color 150ms ease, transform 120ms ease-out, box-shadow 150ms ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .preset:hover {
      box-shadow: var(--sw-shadow-2);
    }
  }
  .preset:active {
    transform: scale(0.98);
  }
  .preset[aria-pressed='true'] {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 2px var(--sw-accent-soft);
  }
  .preset .sw {
    display: grid;
    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr;
    direction: ltr;
    min-block-size: 64px;
  }
  .preset .tx {
    padding: 10px 12px;
    display: grid;
    gap: 2px;
    align-content: center;
  }
  .preset b {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .preset span {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .devs {
    display: grid;
    gap: 4px;
  }
  .dev {
    display: flex;
    align-items: center;
    gap: 8px;
    block-size: 38px;
    padding-inline: 10px;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
    font-size: var(--sw-fs-sm);
    border: 1.5px solid transparent;
    cursor: pointer;
    text-align: start;
    inline-size: 100%;
    transition: border-color 150ms ease, transform 120ms ease-out;
  }
  .dev:active {
    transform: scale(0.98);
  }
  .dev sw-icon {
    color: var(--sw-text-3);
    flex: none;
  }
  .dev .nm {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dev .w {
    margin-inline-start: auto;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    white-space: nowrap;
  }
  .dev.todo {
    background: var(--sw-warning-soft);
  }
  .dev.todo .w {
    color: var(--sw-warning-text);
    font-weight: var(--sw-fw-semibold);
  }
  .dev.off {
    opacity: 0.55;
  }
  .dev[aria-pressed='true'] {
    border-color: var(--sw-accent);
  }
  /* PLAN3D-R28-WIZARD2-2434: a placed camera, devices / cameras switch, the resume and kept-plan cards, the replace dialog */
  .dev.set .w {
    color: var(--sw-accent-text);
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 2px;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
  }
  .seg button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    block-size: 34px;
    border: 0;
    border-radius: calc(var(--sw-r-md) - 2px);
    background: transparent;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease, transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  .seg button:active {
    transform: scale(0.97);
  }
  .seg button[aria-selected='true'] {
    background: var(--sw-surface);
    color: var(--sw-text);
    box-shadow: var(--sw-shadow-1);
  }
  .seg .num {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-variant-numeric: tabular-nums;
  }
  .card.resume {
    display: grid;
    gap: 6px;
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
    font-size: var(--sw-fs-sm);
  }
  .card.resume span {
    color: var(--sw-text-2);
  }
  .card.resume .side-actions {
    margin-block-start: 4px;
  }
  .dlg-p {
    margin: 0 0 8px;
    font-size: var(--sw-fs-sm);
    line-height: 1.55;
    max-inline-size: 60ch;
  }
  .dlg-p.soft {
    color: var(--sw-text-3);
  }
  .grow {
    flex: 1;
    min-block-size: 0;
  }
  .side-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* ---- the footer */
  .wz-foot {
    grid-area: foot;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-inline: 20px;
    background: var(--sw-surface);
    border-block-start: 1px solid var(--sw-border);
  }
  .wz-foot .sp {
    flex: 1;
  }
  .wz-foot .hint {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- the settings dialog */
  .prefs {
    display: grid;
    gap: 14px;
  }
  .prefs label {
    display: grid;
    gap: 6px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .prefs label.check {
    display: flex;
  }
  .prefs .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .prefs .note {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }

  @media (max-width: 1100px) {
    .wz {
      grid-template-columns: minmax(0, 1fr) 330px;
    }
    .st:not(.now) span {
      display: none;
    }
    .wz-side {
      padding: 14px;
      gap: 10px;
    }
    .q-crop {
      block-size: 112px;
    }
  }
  @media (max-height: 760px) and (min-width: 768px) {
    .q-crop {
      block-size: 104px;
    }
    .wz-side {
      gap: 9px;
    }
  }
  @media (max-width: 767px) {
    .wz {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: 52px minmax(0, 38fr) minmax(0, 62fr) calc(64px + env(safe-area-inset-bottom));
      grid-template-areas: 'steps' 'canvas' 'side' 'foot';
    }
    .wz-steps {
      padding-inline: 14px 8px;
    }
    .st,
    .ln {
      display: none;
    }
    .mob {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 10px;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      min-inline-size: 0;
    }
    .mob small {
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .mob .bar {
      flex: 1;
      block-size: 4px;
      border-radius: 2px;
      background: var(--sw-surface-3);
      overflow: hidden;
      direction: rtl;
    }
    .mob .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      border-radius: 2px;
    }
    .wz-side {
      border-inline-start: 0;
      border-block-start: 1px solid var(--sw-border);
      padding: 12px 14px;
      gap: 8px;
    }
    .wz-side h2 {
      font-size: var(--sw-fs-lg);
    }
    .wz-foot {
      padding: 0 14px env(safe-area-inset-bottom);
    }
    .wz-foot .hint,
    .hide-ph {
      display: none;
    }
    .sheet {
      inset: 10px;
    }
    .drop {
      inset: 12px;
      padding: 14px;
    }
    .legend {
      display: none;
    }
    .q-crop {
      block-size: 96px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .scan {
      animation: none;
      transform: translateY(-62%);
    }
    .p.run i {
      animation-duration: 2.4s;
    }
    .opt,
    .preset,
    .dev,
    .gear,
    .seg button,
    .pager button {
      transition: none;
    }
  }
`;
