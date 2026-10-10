import { css } from 'lit';

/**
 * CR-018: the look of the notification surfaces (the center, its rows and detail, the Settings tab). It stands on the glass layer of
 * styles/media-glass.ts (`--dv-*` knobs bridged to the v2 tokens, `--mm-*` media knobs) exactly as the approved mockup does and adds the
 * knobs the mockup marked PROPOSED for notifications: severity colours, the unread dot, the pinned-critical wash, the timeline line, the
 * matrix header. A host that shows notifications puts `notifyKnobs` after `mediaGlassStyles` and calls `applyMediaGlass(this)`; the
 * element rules below read knobs only, so a designer who restyles notifications edits this file.
 */

export const notifyKnobs = css`
  /* MEDIA-polish (2026-10-10): the knobs read the product's state colours through the glass layer (the --dv-* knobs, which the default
     palette takes from --sw-product-*), so the severities are the product's warning / danger in every skin, light and dark; the
     information severity is the tertiary text. One block for both schemes: every value follows the scheme by itself. */
  :host([data-devices-style='glass']) {
    --nt-sev-info: var(--dv-text-3);
    --nt-sev-alert: var(--dv-warning);
    --nt-sev-critical: var(--dv-danger);
    --nt-sev-info-soft: color-mix(in srgb, var(--dv-text-3) 16%, transparent);
    --nt-sev-alert-soft: var(--dv-warning-soft);
    --nt-sev-critical-soft: var(--dv-danger-soft);
    --nt-critical-glow: color-mix(in srgb, var(--dv-danger) 24%, transparent);
    --nt-unread-dot: var(--dv-accent);
    --nt-row-min: 72px;
    --nt-pin-bg: linear-gradient(180deg, color-mix(in srgb, var(--dv-danger) 9%, transparent), color-mix(in srgb, var(--dv-danger) 2%, transparent));
    --nt-timeline-line: var(--dv-border-strong);
    --nt-matrix-head: var(--dv-surface-2);
    --nt-warn-text: var(--sw-warning-text);
    --nt-sheet-w: 480px;
  }
`;

/** Element rules shared by the center and the settings screen (the mockup's tag, input, stepper, day chip, check, banner, timeline, delivery line). */
export const notifyControls = css`
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    block-size: 24px;
    padding-inline: 9px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    background: var(--dv-neutral-soft);
    color: var(--dv-text-2);
    white-space: nowrap;
  }
  .tag .ic {
    font-size: var(--sw-fs-base);
  }
  .tag.soon {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .tag.ok {
    background: var(--dv-success-soft);
    color: var(--dv-success);
  }
  .tag.bad {
    background: var(--dv-danger-soft);
    color: var(--dv-danger);
  }
  .tag.warn {
    background: var(--dv-warning-soft);
    color: var(--nt-warn-text);
  }
  .btn.door {
    background: var(--dv-warning-soft);
    border-color: color-mix(in srgb, var(--dv-warning) 40%, transparent);
    color: var(--dv-text);
  }
  .btn.door .ic {
    color: var(--dv-warning);
  }
  .btn {
    min-block-size: 44px;
  }
  .btn.sm {
    min-block-size: 40px;
  }
  @media (pointer: coarse), (max-width: 767px) {
    .btn.sm {
      min-block-size: 44px;
    }
  }
  .btn.full {
    inline-size: 100%;
  }
  .rc {
    flex: none;
    block-size: 44px;
    padding-inline: 16px;
    border-radius: var(--dv-radius-control);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    font-size: var(--sw-fs-base);
    font-weight: 500;
    color: var(--dv-text-2);
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .rc:hover {
    color: var(--dv-text);
    background: var(--dv-surface);
  }
  .rc[aria-pressed='true'],
  .rc.on {
    background: var(--dv-text);
    border-color: transparent;
    color: var(--mm-text-inverse);
    font-weight: 600;
    box-shadow: var(--dv-shadow-control);
  }
  .rc .ic {
    font-size: var(--sw-fs-lg);
  }
  .inp {
    block-size: 44px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    padding-inline: 14px;
    font-size: var(--sw-fs-base);
    color: var(--dv-text);
    min-inline-size: 0;
    inline-size: 100%;
    outline: none;
  }
  .inp:focus {
    outline: 2px solid var(--dv-focus);
    outline-offset: 1px;
  }
  .inp.ltr {
    direction: ltr;
    text-align: left;
    font-family: var(--sw-font-mono, ui-monospace, 'Cascadia Mono', Consolas, monospace);
    font-size: var(--sw-fs-base);
  }
  .inp.sm {
    block-size: 44px;
    inline-size: auto;
  }
  .inp[disabled] {
    opacity: 0.5;
  }
  select.inp {
    appearance: none;
    -webkit-appearance: none;
    padding-inline-end: 34px;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236e6e73' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: left 12px center;
    background-size: 16px;
  }
  .stp {
    display: inline-flex;
    align-items: center;
    block-size: 44px;
    border-radius: 999px;
    background: var(--dv-surface-3);
    padding: 3px;
  }
  .stp button {
    inline-size: 38px;
    block-size: 38px;
    border-radius: 50%;
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
    color: var(--dv-text);
  }
  .stp button:hover {
    background: var(--mm-seg-thumb);
    box-shadow: var(--dv-shadow-control);
  }
  .stp .vv {
    min-inline-size: 52px;
    text-align: center;
    font-weight: 700;
    font-size: var(--sw-fs-md);
    font-variant-numeric: tabular-nums;
  }
  .stp .vv small {
    font-weight: 500;
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    margin-inline-start: 3px;
  }
  .days {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .days button {
    inline-size: 44px;
    block-size: 44px;
    border-radius: 50%;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    font-weight: 600;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
  }
  .days button[aria-pressed='true'] {
    background: var(--dv-accent);
    border-color: transparent;
    color: var(--sw-text-inverse);
  }
  .chk {
    inline-size: 32px;
    block-size: 32px;
    border-radius: var(--sw-r-sm);
    border: 1.5px solid var(--dv-border-strong);
    background: var(--dv-surface-2);
    display: grid;
    place-items: center;
    color: var(--sw-text-inverse);
    padding: 0;
    flex: none;
    position: relative;
  }
  .chk::before {
    content: '';
    position: absolute;
    inset: -6px;
  }
  .chk[aria-checked='true'] {
    background: var(--dv-accent);
    border-color: transparent;
  }
  .chk .ic {
    font-size: var(--sw-fs-xl);
    stroke-width: 2.4;
    opacity: 0;
  }
  .chk[aria-checked='true'] .ic {
    opacity: 1;
  }
  .chk[disabled] {
    opacity: 0.35;
    pointer-events: none;
  }
  .tog {
    position: relative;
  }
  .tog::before {
    content: '';
    position: absolute;
    inset: -8px -2px;
  }
  .tog[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }
  .bnr {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    padding: 6px 8px;
    padding-inline: 14px 8px;
    border-radius: var(--sw-r-lg);
    font-size: var(--sw-fs-base);
    font-weight: 600;
    background: var(--dv-surface-2);
    border: 1px solid var(--dv-border);
    color: var(--dv-text);
  }
  .bnr > .ic {
    font-size: var(--sw-fs-xl);
    color: var(--dv-text-2);
    flex: none;
  }
  .bnr.quiet > .ic {
    color: var(--dv-accent);
  }
  .bnr.failed {
    background: var(--dv-danger-soft);
    border-color: color-mix(in srgb, var(--dv-danger) 30%, transparent);
  }
  .bnr.failed > .ic {
    color: var(--dv-danger);
  }
  .bnr.push {
    background: var(--dv-warning-soft);
    border-color: color-mix(in srgb, var(--dv-warning) 35%, transparent);
  }
  .bnr.push > .ic {
    color: var(--dv-warning);
  }
  .bnr .btn {
    margin-inline-start: auto;
  }
  .bnr > span {
    min-inline-size: 0;
  }
  /* the timeline of a notification, and the escalation preview of the settings */
  .tl {
    display: flex;
    flex-direction: column;
    padding: 2px 4px;
  }
  .tl .ev {
    display: grid;
    grid-template-columns: 52px 20px minmax(0, 1fr);
    gap: 0 10px;
    align-items: start;
    min-block-size: 46px;
    position: relative;
  }
  .tl .ev .t {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
    font-variant-numeric: tabular-nums;
    padding-block-start: 2px;
    text-align: end;
    direction: ltr;
  }
  .tl .ev .d {
    position: relative;
    display: flex;
    justify-content: center;
    padding-block-start: 5px;
  }
  .tl .ev .d i {
    inline-size: 12px;
    block-size: 12px;
    border-radius: 50%;
    background: var(--dv-text-3);
    border: 2px solid var(--mm-sheet-surface);
    box-shadow: 0 0 0 2px var(--nt-timeline-line);
    z-index: 1;
  }
  .tl .ev .d::after {
    content: '';
    position: absolute;
    inset-block-start: 17px;
    inset-block-end: -5px;
    inline-size: 2px;
    background: var(--nt-timeline-line);
  }
  .tl .ev:last-child .d::after {
    display: none;
  }
  .tl .ev.escalated .d i {
    background: var(--nt-sev-critical);
  }
  .tl .ev.acknowledged .d i {
    background: var(--dv-success);
  }
  .tl .ev.now .d i {
    background: var(--dv-accent);
    box-shadow: 0 0 0 2px var(--nt-timeline-line), 0 0 0 6px var(--dv-accent-soft);
  }
  .tl .ev.delivery_failed .d i {
    background: var(--dv-danger);
  }
  .tl .ev .b {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: var(--sw-fs-base);
    line-height: 1.3;
    padding-block-end: 10px;
  }
  .tl .ev .b b {
    font-weight: 600;
  }
  .tl .ev .b small {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .tl .ev.pending .b {
    color: var(--dv-text-3);
  }
  .tl .ev.pending .d i {
    background: transparent;
    border: 2px dashed var(--dv-text-3);
    box-shadow: none;
  }
`;
