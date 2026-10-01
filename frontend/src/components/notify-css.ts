import { css } from 'lit';

/**
 * CR-018: the look of the notification surfaces (the center, its rows and detail, the Settings tab). It stands on the glass layer of
 * styles/media-glass.ts (`--dv-*` knobs bridged to the v2 tokens, `--mm-*` media knobs) exactly as the approved mockup does and adds the
 * knobs the mockup marked PROPOSED for notifications: severity colours, the unread dot, the pinned-critical wash, the timeline line, the
 * matrix header. A host that shows notifications puts `notifyKnobs` after `mediaGlassStyles` and calls `applyMediaGlass(this)`; the
 * element rules below read knobs only, so a designer who restyles notifications edits this file.
 */

export const notifyKnobs = css`
  :host([data-devices-style='glass']) {
    --nt-sev-info: #8e8e93;
    --nt-sev-alert: #ff9f0a;
    --nt-sev-critical: #d70015;
    --nt-sev-info-soft: rgba(142, 142, 147, 0.16);
    --nt-sev-alert-soft: rgba(255, 159, 10, 0.16);
    --nt-sev-critical-soft: rgba(255, 59, 48, 0.14);
    --nt-critical-glow: rgba(215, 0, 21, 0.22);
    --nt-unread-dot: #007aff;
    --nt-row-min: 72px;
    --nt-pin-bg: linear-gradient(180deg, rgba(255, 59, 48, 0.08), rgba(255, 59, 48, 0.02));
    --nt-timeline-line: rgba(60, 60, 67, 0.18);
    --nt-matrix-head: rgba(120, 120, 128, 0.08);
    --nt-warn-text: #9a5b00;
    --nt-sheet-w: 480px;
  }
  :host([data-devices-style='glass'][data-devices-scheme='dark']) {
    --nt-sev-info: #98989d;
    --nt-sev-alert: #ffb340;
    --nt-sev-critical: #ff453a;
    --nt-sev-info-soft: rgba(152, 152, 157, 0.2);
    --nt-sev-alert-soft: rgba(255, 179, 64, 0.2);
    --nt-sev-critical-soft: rgba(255, 69, 58, 0.22);
    --nt-critical-glow: rgba(255, 69, 58, 0.3);
    --nt-unread-dot: #0a84ff;
    --nt-pin-bg: linear-gradient(180deg, rgba(255, 69, 58, 0.14), rgba(255, 69, 58, 0.03));
    --nt-timeline-line: rgba(255, 255, 255, 0.2);
    --nt-matrix-head: rgba(255, 255, 255, 0.05);
    --nt-warn-text: #ffb340;
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
    font-size: 11.5px;
    font-weight: 600;
    background: var(--dv-neutral-soft);
    color: var(--dv-text-2);
    white-space: nowrap;
  }
  .tag .ic {
    font-size: 13px;
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
    font-size: 13.5px;
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
    font-size: 15px;
  }
  .inp {
    block-size: 44px;
    border-radius: 14px;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    padding-inline: 14px;
    font-size: 13.5px;
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
    font-size: 13px;
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
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .stp .vv small {
    font-weight: 500;
    color: var(--dv-text-2);
    font-size: 11.5px;
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
    font-size: 13px;
    color: var(--dv-text-2);
  }
  .days button[aria-pressed='true'] {
    background: var(--dv-accent);
    border-color: transparent;
    color: #fff;
  }
  .chk {
    inline-size: 32px;
    block-size: 32px;
    border-radius: 9px;
    border: 1.5px solid var(--dv-border-strong);
    background: var(--dv-surface-2);
    display: grid;
    place-items: center;
    color: #fff;
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
    font-size: 17px;
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
    border-radius: 16px;
    font-size: 13px;
    font-weight: 600;
    background: var(--dv-surface-2);
    border: 1px solid var(--dv-border);
    color: var(--dv-text);
  }
  .bnr > .ic {
    font-size: 17px;
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
    font-size: 12.5px;
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
    font-size: 13.5px;
    line-height: 1.3;
    padding-block-end: 10px;
  }
  .tl .ev .b b {
    font-weight: 600;
  }
  .tl .ev .b small {
    font-size: 12px;
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
