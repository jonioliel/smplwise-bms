import { css, html, nothing } from 'lit';
import type { FirstWrites, SupervisedKind } from '../api/frigate-control';
import { fx, frigateLocale } from '../i18n/frigate-text';

/**
 * FRGD: what the Frigate management panels (Settings > the recorder > "שינויים ב־Frigate") share - one sheet of rules for their
 * tables, forms, rows, chips and dialogs, and the small render helpers (the supervision box of a first write, a date). Tokens only.
 */
export const adminStyles = css`
  :host {
    display: block;
  }
  .panel {
    display: grid;
    gap: var(--sw-s-3);
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
    /* the tables fold by the card's own width (a settings card sits beside a tree on wide screens) */
    container: admin / inline-size;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sw-s-2);
  }
  h4 {
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
  }
  h5 {
    margin: 0;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .note {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    margin: 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px var(--sw-s-2);
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    white-space: nowrap;
  }
  .chip.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .chip.warn {
    background: var(--sw-stale-soft);
    color: var(--sw-stale-text);
  }
  .chip.bad {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .chip.accent {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  /* ---- a table that folds to rows on a narrow card ---- */
  .tbl {
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    overflow: hidden;
  }
  .tbl .h,
  .tbl .r {
    display: grid;
    grid-template-columns: var(--cols);
    gap: var(--sw-s-2);
    align-items: center;
    padding: var(--sw-s-2) var(--sw-s-3);
    min-inline-size: 0;
  }
  .tbl .h {
    background: var(--sw-surface-2);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tbl .r {
    border-block-start: 1px solid var(--sw-border);
    min-block-size: 44px;
  }
  .tbl .r:hover {
    background: var(--sw-surface-2);
  }
  .tbl .c {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tbl .c.muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .tbl .c.ltr {
    direction: ltr;
    unicode-bidi: isolate;
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  .tbl .acts {
    display: flex;
    justify-content: flex-end;
    gap: 2px;
  }
  .tbl b {
    font-weight: var(--sw-fw-semibold);
  }
  @container admin (max-width: 640px) {
    .tbl .h {
      display: none;
    }
    .tbl .r {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'main acts' 'sub acts';
      row-gap: 2px;
    }
    .tbl .r .c.main {
      grid-area: main;
    }
    .tbl .r .c.sub {
      grid-area: sub;
      white-space: normal;
    }
    .tbl .r .c:not(.main):not(.sub):not(.acts) {
      display: none;
    }
    .tbl .r .acts {
      grid-area: acts;
    }
  }
  .empty {
    padding: var(--sw-s-4);
    text-align: center;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  /* ---- forms ---- */
  .form {
    display: grid;
    gap: var(--sw-s-3);
  }
  .form .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--sw-s-3);
  }
  .form label {
    display: grid;
    gap: 4px;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    min-inline-size: 0;
  }
  .form label.row {
    grid-template-columns: auto 1fr;
    align-items: center;
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
  }
  .form input:not([type='checkbox']),
  .form select,
  .form textarea,
  .inline input {
    font: inherit;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    padding: var(--sw-s-2) var(--sw-s-3);
    min-block-size: 36px;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
  }
  .form input[type='datetime-local'] {
    direction: ltr;
  }
  .form input[type='checkbox'] {
    inline-size: 16px;
    block-size: 16px;
    margin: 0;
    accent-color: var(--sw-accent);
  }
  .form input:focus-visible,
  .form select:focus-visible,
  .inline input:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .sup {
    display: flex;
    align-items: flex-start;
    gap: var(--sw-s-2);
    padding: var(--sw-s-2) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    background: var(--sw-stale-soft);
    color: var(--sw-stale-text);
    font-size: var(--sw-fs-xs);
  }
  .sup input {
    margin: 2px 0 0;
    accent-color: var(--sw-accent);
    inline-size: 16px;
    block-size: 16px;
    flex: none;
  }
  .err {
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-xs);
  }
  .msg {
    font-size: var(--sw-fs-xs);
  }
  .msg.ok {
    color: var(--sw-success-text);
  }
  .msg.err {
    color: var(--sw-danger-text);
  }
  .inline {
    display: flex;
    gap: var(--sw-s-1);
    align-items: center;
    min-inline-size: 0;
  }
  .dialog-text {
    margin: 0;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .seg {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-3);
    max-inline-size: 100%;
  }
  .seg button {
    min-block-size: 32px;
    padding-inline: var(--sw-s-3);
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
    white-space: nowrap;
  }
  .seg button[aria-pressed='true'] {
    background: var(--sw-surface);
    color: var(--sw-text);
    box-shadow: var(--sw-shadow-1);
  }
  .seg button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .seg button:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 2px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sw-s-3);
    padding-block: var(--sw-s-1);
    min-inline-size: 0;
  }
  .row .name {
    display: grid;
    min-inline-size: 0;
  }
  .row .sub {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
`;

/** The supervision box of a first write: drawn only when THIS kind still needs its supervised first write and the caller may give it. */
export function supervisedBox(first: FirstWrites | null, kind: SupervisedKind, checked: boolean, onChange: (v: boolean) => void, attr = 'data-supervised') {
  if (!first || !first.can_supervise || first.done[kind]) return nothing;
  const s = fx().control.settings.supervised;
  // the attribute name is static per call site (a data-* hook for the specs); lit needs a literal attribute, so the hook is a class + data value
  return html`<label class="sup" data-supervised-box=${attr}><input type="checkbox" .checked=${checked} @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)} /><span><b>${s.label}</b> · ${s.hint}</span></label>`;
}

/** The first write of a kind is still pending and the caller cannot supervise it: the action would be refused, say so in one line. */
export const firstBlocked = (first: FirstWrites | null, kind: SupervisedKind): boolean => !!first && !first.done[kind] && !first.can_supervise;

export function dateText(epochOrIso: number | string | null | undefined, tz?: string): string {
  if (epochOrIso == null) return '—';
  const d = typeof epochOrIso === 'number' ? new Date(epochOrIso * 1000) : new Date(epochOrIso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(frigateLocale(), { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** `datetime-local` value (the browser's zone) -> epoch seconds; null when empty or unreadable. */
export function localToEpoch(v: string): number | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/** Epoch seconds -> a `datetime-local` value in the browser's zone (minutes). */
export function epochToLocal(s: number): string {
  const d = new Date(s * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
