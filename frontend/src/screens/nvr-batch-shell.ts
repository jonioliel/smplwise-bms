import { LitElement, html, css, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { ApiError } from '../api/client';
import { nvrBatch, type Batch } from '../api/nvr-batch';
import { windowOf } from './nvr-batch-logic';

/**
 * CR-DUP-NVR-BATCH-2440 (code review 06:DUP-3): the shell the two NVR batch dialogs share - the multi-camera SVC dialog with the progress
 * of every batch (nvr-camera-batch) and the multi-camera encoding dialog (nvr-encoding-batch). Both were written with their own copy of:
 *   - the look of the checklist: the tools row, the count, the windowed list in its well, the 44 px checkbox rows, the messages;
 *   - the windowed list itself (only the rows in view are drawn; the list measures its own height);
 *   - the rule for a start whose answer was lost (the active batch is read; the request is never repeated).
 * A dialog keeps what is its own: its rows, its steps, its words and the call that applies the change.
 */

export const CHECK = html`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

/** The checklist's look, FIRST in a dialog's styles: a dialog's own rules follow it and win where they say more (the list's height, the
 * disabled row, the count of the encoding dialog). The order inside is the order the two dialogs had: the base, then the polish passes. */
export const nvrBatchShellCss = css`
  :host {
    display: contents;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .count {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  /* the list's block-size is the dialog's own (the two differ) */
  .vl {
    contain: inline-size;
    inline-size: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
  }
  .vl:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 2px;
  }
  .space {
    box-sizing: border-box;
    inline-size: 100%;
  }
  .sel {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    inline-size: 100%;
    block-size: 44px;
    padding-inline: 12px;
    border-block-end: 1px solid var(--sw-border);
    cursor: pointer;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
  }
  .sel:hover:not([aria-disabled='true']) {
    background: var(--sw-surface-2);
  }
  .sel:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: -2px;
  }
  .sel[aria-disabled='true'] {
    cursor: default;
  }
  .box {
    flex: none;
    inline-size: 20px;
    block-size: 20px;
    border-radius: var(--sw-r-2xs);
    border: 2px solid var(--sw-border-strong);
    display: grid;
    place-items: center;
    color: var(--sw-text-inverse);
  }
  .sel[aria-checked='true'] .box {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
  }
  .nm {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    white-space: nowrap;
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  }
  .msg {
    margin: 0;
    padding: 6px 8px;
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  /* R5-LIVE-297 (the HOMEFABLE tiers in the multi-camera encoding dialog) and CAMADMIN-POLISH-2331 (the same language carried to the SVC
     checklist): the list is a WELL (surface-2, no outline, no hairlines between rows; the windowed row heights are untouched); a chosen
     row is a 26 % accent field with a 4 px accent bar at its start edge and a 22 px box, its name bold; rows tint on hover only under a
     fine pointer and darken on press; the count is a bold numeral; messages are wells */
  .vl {
    border-color: transparent;
    background: var(--sw-surface-2);
  }
  .count {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .sel {
    border-block-end: 0;
    padding-inline: 14px;
    gap: 12px;
    font-size: var(--sw-fs-md);
    color: var(--sw-heading);
    transition: background-color var(--sw-t-fast) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
  }
  .sel:hover:not([aria-disabled='true']) {
    background: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    .sel:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-3);
    }
  }
  .sel:active:not([aria-disabled='true']) {
    background: var(--sw-pressed-wash);
  }
  .sel[aria-checked='true'] {
    background: color-mix(in srgb, var(--sw-accent) 26%, var(--sw-surface));
    /* the bar sits at the row's START edge: box-shadow offsets are physical, so RTL (the default) is the right edge */
    box-shadow: inset -4px 0 0 var(--sw-accent);
  }
  :host-context([dir='ltr']) .sel[aria-checked='true'] {
    box-shadow: inset 4px 0 0 var(--sw-accent);
  }
  .sel[aria-checked='true'] .nm {
    font-weight: var(--sw-fw-bold);
  }
  .box {
    inline-size: 22px;
    block-size: 22px;
    border-radius: var(--sw-r-xs);
    background: var(--sw-surface);
    box-shadow: var(--sw-shadow-1);
  }
  .sel[aria-checked='true'] .box {
    box-shadow: none;
  }
  /* A11Y-POLISHED-2342 + DARK-REVIEW-2342: the unchecked box's 2 px --sw-border-strong edge read 1.3-2.0:1 on the light row and
     1.5-2.3:1 on the dark one (a checkbox boundary needs 3:1, WCAG 1.4.11). Light draws it in the muted ink (>= 4.9:1 every skin), dark
     in the muted ink at 70 % (3.2-4.3:1, tests/unit-dark-polish-beds.spec.ts on fix/DARK-REVIEW-2342). light-dark() keys on the page's
     color-scheme (it inherits into the shadow root); an engine without it drops the line and keeps the old edge. */
  .sel:not([aria-checked='true']) .box {
    border-color: light-dark(var(--sw-text-3), color-mix(in srgb, var(--sw-text-3) 70%, transparent));
  }
  .sel .meta {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  .msg {
    padding: 8px 12px;
    border-radius: var(--sw-r-md);
  }
`;

/** What the error lines of both dialogs read from a failed request (`details` only where the caller's line names a camera from them). */
export function errorShape(err: unknown, withDetails = false): { status: number; code: string; user_message?: string; details?: Record<string, unknown> } {
  if (!(err instanceof ApiError)) return { status: 0, code: 'network' };
  const shape = { status: err.status, code: err.code, user_message: err.body.user_message };
  return withDetails ? { ...shape, details: err.body.details ?? {} } : shape;
}

/**
 * A start (or an undo) is sent ONCE. When its answer may have been lost after the batch started (no answer at all, or a 5xx), the active
 * batch is read instead of repeating the request, and handed to `take`. True: a batch was taken (the caller stops there). False: the
 * request was refused, nothing runs, or the read (or `take`) failed too - the caller says so in its line.
 */
export async function takeActiveAfterLostAnswer(err: unknown, take: (active: Batch) => void | Promise<void>): Promise<boolean> {
  const sent = !(err instanceof ApiError) || err.status >= 500;
  if (!sent) return false;
  try {
    const a = await nvrBatch().active();
    if (a) {
      await take(a);
      return true;
    }
  } catch {
    /* cannot read either: the caller says so */
  }
  return false;
}

/** The element both dialogs extend: the windowed list's state and drawing, and the event helper. */
export abstract class NvrBatchShell extends LitElement {
  @state() protected listTop = 0;
  @state() protected viewH = 360;

  protected emit<T>(name: string, detail?: T) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /** The list on screen (one at a time), after taking its measured height for the window. */
  protected measureList(): HTMLElement | null {
    const vl = this.renderRoot.querySelector<HTMLElement>('.vl');
    if (vl && vl.clientHeight > 0 && Math.abs(vl.clientHeight - this.viewH) > 1) this.viewH = vl.clientHeight;
    return vl;
  }

  /** A new search, filter or tab: the list starts from its top. */
  protected resetScroll() {
    this.listTop = 0;
    const vl = this.renderRoot.querySelector<HTMLElement>('.vl');
    if (vl) vl.scrollTop = 0;
  }

  protected onListScroll = (e: Event) => {
    this.listTop = (e.target as HTMLElement).scrollTop;
  };

  /** The inside of a `.vl` list of `n` rows of `rowH` px: only the rows in view, padded to the height of all of them. */
  protected windowRows(n: number, rowH: number, row: (i: number) => TemplateResult) {
    const w = windowOf(this.listTop, this.viewH, n, rowH);
    const idx: number[] = [];
    for (let i = w.start; i < w.end; i++) idx.push(i);
    return html`<div class="space" style="padding-block:${w.top}px ${Math.max(0, w.total - w.top - (w.end - w.start) * rowH)}px">${repeat(idx, (i) => i, (i) => row(i))}</div>`;
  }
}
