import { css } from 'lit';
import { iconStyles } from './automation-builder-icons';

/**
 * CR-017 S4: the look shared by the editors and their parts (blocks, picker, gallery, code view): the approved mockup's glass sheet
 * (docs/design/mockups/automations/index.html), written against the `--dv-*` knobs of the devices theme layer (styles/devices-themes.ts,
 * set on the editor's host by `applyDevicesPrefs`), never a literal palette colour. Logical properties only (RTL first); 44 px targets on a phone.
 */
/** The local knobs, set on the TOP-LEVEL editor's host only (the parts inherit them): motion, the sheet material and the sensitive-chip colours. */
export const editorTokens = css`
  :host {
    --ab-motion: 200ms;
    --ab-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --ab-sheet: color-mix(in srgb, var(--dv-surface-solid, #f8fafd) 92%, transparent);
    --ab-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 46%);
    --ab-seg-thumb: #ffffff;
    --ab-amber-text: #8a4b00;
    --ab-sens-bg: var(--dv-warning-soft, rgba(255, 159, 10, 0.16));
    --ab-sens-fg: var(--ab-amber-text);
    --ab-sens-line: color-mix(in srgb, var(--dv-warning, #ff9f0a) 55%, transparent);
    --ab-ok-text: #1a7f37;
    font-family: var(--dv-font, var(--sw-font));
    color: var(--dv-text, var(--sw-text));
  }
  :host([data-devices-scheme='dark']) {
    --ab-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.015) 50%);
    --ab-seg-thumb: rgba(118, 118, 128, 0.5);
    --ab-amber-text: #ffc46b;
    --ab-ok-text: #5ee08a;
  }
  /* the sensitive-step chip colour is the SETTING automations.sensitive_chip (amber | red) */
  :host([data-chip='red']) {
    --ab-sens-bg: var(--dv-danger-soft, rgba(255, 59, 48, 0.13));
    --ab-sens-fg: var(--dv-danger, #d70015);
    --ab-sens-line: color-mix(in srgb, var(--dv-danger, #d70015) 50%, transparent);
  }
  :host([data-chip='red'][data-devices-scheme='dark']) {
    --ab-sens-fg: #ff8a80;
  }
`;

export const editorShared = [
  iconStyles,
  css`
    :host {
      font-family: var(--dv-font, var(--sw-font));
      color: var(--dv-text, var(--sw-text));
    }
    * {
      box-sizing: border-box;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    summary:focus-visible {
      outline: 2px solid var(--dv-focus, var(--sw-focus));
      outline-offset: 2px;
    }
    /* ---- chips ---- */
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      block-size: 24px;
      padding: 0 9px;
      border-radius: 999px;
      background: var(--dv-neutral-soft, var(--sw-surface-3));
      color: var(--dv-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      white-space: nowrap;
      flex: none;
    }
    .tag .ic {
      font-size: var(--sw-fs-sm);
    }
    .tag.warn {
      background: var(--dv-warning-soft);
      color: var(--ab-amber-text, var(--sw-warning-text));
    }
    .tag.bad {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .tag.ok {
      background: var(--dv-success-soft);
      color: var(--ab-ok-text, #1a7f37);
    }
    .tag.acc {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .tag.lock {
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
    }
    .tag.sens {
      background: var(--ab-sens-bg, var(--dv-warning-soft));
      color: var(--ab-sens-fg, var(--sw-warning-text));
    }
    code {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
      background: var(--dv-surface-3);
      padding: 1px 6px;
      border-radius: var(--sw-r-xs);
      color: var(--dv-text-2);
    }
    /* ---- buttons (pills, 44 px on a phone) ---- */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-block-size: 40px;
      padding-inline: 16px;
      border-radius: 999px;
      border: 1px solid var(--dv-border-strong);
      background: var(--dv-surface-2, var(--sw-surface));
      color: var(--dv-text);
      font-size: var(--sw-fs-base);
      font-weight: 600;
      white-space: nowrap;
      box-shadow: var(--dv-shadow-1);
      transition: background var(--ab-motion, 200ms), opacity var(--ab-motion, 200ms);
    }
    .btn:hover:not(:disabled) {
      background: var(--dv-surface-3);
    }
    .btn.primary {
      background: var(--dv-accent);
      border-color: var(--dv-accent);
      color: #fff;
      box-shadow: 0 6px 16px color-mix(in srgb, var(--dv-accent) 35%, transparent);
    }
    .btn.primary:hover:not(:disabled) {
      background: var(--dv-accent-hover, var(--dv-accent));
    }
    .btn.quiet {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .btn.danger {
      color: var(--dv-danger);
      border-color: color-mix(in srgb, var(--dv-danger) 40%, transparent);
    }
    .btn.sm {
      min-block-size: 34px;
      padding-inline: 12px;
      font-size: var(--sw-fs-sm);
    }
    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .btn .ic {
      font-size: var(--sw-fs-lg);
    }
    /* ---- form controls ---- */
    .frow {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .fld {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-inline-size: 0;
      flex: 1 1 140px;
    }
    .fld.sm {
      flex: 0 1 110px;
    }
    .fld.full {
      flex: 1 1 100%;
    }
    /* a field inside a field (the forms wrap labelled controls): the inner one never stretches in the column */
    .fld .fld {
      flex: none;
    }
    .fld > label,
    .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      font-weight: 600;
    }
    .inp,
    .selx {
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 40px;
      padding: 0 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-solid, var(--dv-surface));
      color: var(--dv-text);
      font-size: var(--sw-fs-base);
      min-inline-size: 0;
      font-family: inherit;
    }
    .inp:focus-within,
    .selx:focus {
      outline: 2px solid var(--dv-focus);
      outline-offset: 1px;
    }
    .inp input,
    .inp textarea {
      border: 0;
      background: transparent;
      outline: none;
      flex: 1;
      min-inline-size: 0;
      font: inherit;
      color: inherit;
      text-align: start;
    }
    .inp input.n {
      text-align: center;
      direction: ltr;
    }
    .inp .u {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .inp.area {
      block-size: auto;
      padding-block: 8px;
      align-items: flex-start;
    }
    .inp.area textarea {
      resize: vertical;
      min-block-size: 56px;
    }
    .selx {
      -webkit-appearance: none;
      appearance: none;
      padding-inline-end: 32px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236e6e73' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: left 10px center;
      background-size: 16px;
      inline-size: 100%;
    }
    :host-context([dir='ltr']) .selx {
      background-position: right 10px center;
    }
    .selx.sm {
      block-size: 34px;
      font-size: var(--sw-fs-sm);
    }
    .rolechips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .rolechips button {
      min-block-size: 34px;
      min-inline-size: 38px;
      padding-inline: 12px;
      border-radius: 999px;
      border: 1px solid var(--dv-border-strong);
      background: transparent;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--dv-text-2);
    }
    .rolechips button[aria-pressed='true'] {
      background: var(--dv-accent-soft);
      border-color: var(--dv-accent);
      color: var(--dv-accent-text);
    }
    /* ---- segmented control ---- */
    .seg {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: var(--dv-surface-3);
      border-radius: 999px;
      padding: 3px;
      max-inline-size: 100%;
    }
    .seg button {
      border: 0;
      background: transparent;
      border-radius: 999px;
      padding: 4px 14px;
      min-block-size: 30px;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--dv-text-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
    }
    .seg button[aria-pressed='true'],
    .seg button[aria-selected='true'] {
      background: var(--ab-seg-thumb, #fff);
      color: var(--dv-text);
      box-shadow: var(--dv-shadow-control, 0 1px 4px rgba(0, 0, 0, 0.18));
    }
    @media (max-width: 767px) {
      .btn {
        min-block-size: 44px;
      }
      .inp,
      .selx {
        block-size: 44px;
      }
      .rolechips button {
        min-block-size: 40px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `,
];
