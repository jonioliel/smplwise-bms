/**
 * CR-036 S10: the look the Settings page "בקרת כניסה" shares between its segments (status, the intercom's action log, groups): cards with
 * a heading and a muted technical subtitle, the dotted rows of the health and alert lists, the tiles, the notes, the skeleton and the
 * control sizes (every target is `--sw-touch-desktop` / 44 px, like the entry log). Tokens only: no colour, no font size and no radius
 * literal (unit-token-lint).
 */
import { css } from 'lit';

export const statusStyles = css`
  :host {
    display: block;
    --_t: var(--sw-touch-desktop, 44px);
    --sw-ctl-h-sm: var(--_t);
    --sw-ctl-h-md: var(--_t);
    --sw-ctl-h-lg: var(--_t);
  }
  @media (max-width: 1100px) {
    :host {
      --_t: max(44px, var(--sw-touch-desktop, 44px));
    }
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    align-items: start;
  }
  @media (max-width: 767px) {
    .grid2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  @media (max-width: 767px) {
    .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    box-shadow: var(--sw-shadow-1);
    min-inline-size: 0;
  }
  .tile .k {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
  }
  .tile .v {
    color: var(--sw-heading);
    font-size: var(--sw-fs-2xl);
    font-weight: var(--sw-fw-semibold);
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  .tile .v.warn {
    color: var(--sw-warning-text);
  }
  .tile .v.err {
    color: var(--sw-danger-text);
  }
  .tile .d {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  sw-card {
    min-inline-size: 0;
  }
  .ch {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 14px 14px 10px;
  }
  .ch h3 {
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading);
  }
  .ch .sub {
    margin-block-start: 1px;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-regular);
  }
  .ch .ctl {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
  }
  .chipbtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: var(--_t);
    padding: 0 14px;
    box-sizing: border-box;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .chipbtn[aria-pressed='true'] {
    background: var(--sw-accent-soft);
    border-color: var(--sw-accent);
    color: var(--sw-heading);
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .muted {
    color: var(--sw-text-3);
  }
  .mono {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-xs);
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    inline-size: 100%;
    min-block-size: max(56px, var(--_t));
    padding: 8px 14px;
    border: 0;
    border-block-start: 1px solid var(--sw-border);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    box-sizing: border-box;
  }
  button.row {
    cursor: pointer;
  }
  button.row:hover {
    background: var(--sw-hover-wash);
  }
  button.row:focus-visible {
    outline-offset: -2px;
  }
  .dot {
    flex: none;
    inline-size: 10px;
    block-size: 10px;
    border-radius: 50%;
    background: var(--sw-unknown);
  }
  .dot.ok {
    background: var(--sw-live);
  }
  .dot.warn {
    background: var(--sw-warning);
  }
  .dot.err {
    background: var(--sw-danger);
  }
  .dot.off,
  .dot.muted {
    background: var(--sw-offline);
  }
  .main {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .main .t {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .main .s {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .main .s.wrap {
    white-space: normal;
  }
  .side {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .chev {
    flex: none;
    color: var(--sw-text-3);
  }
  :host-context([dir='ltr']) .chev {
    transform: scaleX(-1);
  }
  /* a phone: the station row is two lines - the dot, the name and the chevron, then the sync word and when it was last seen */
  @media (max-width: 767px) {
    .row.two {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: 'dot main chev' '. side side';
      align-items: center;
      column-gap: 12px;
      row-gap: 6px;
    }
    .row.two > .dot {
      grid-area: dot;
    }
    .row.two > .main {
      grid-area: main;
    }
    .row.two > .chev {
      grid-area: chev;
    }
    .row.two > .side {
      grid-area: side;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
  }
  .empty {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 14px;
    border-block-start: 1px solid var(--sw-border);
    color: var(--sw-text-2);
  }
  .note {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--sw-r-md);
    font-size: var(--sw-fs-sm);
  }
  .note > span {
    flex: 1 1 200px;
  }
  .note.info {
    background: var(--sw-surface-2);
    color: var(--sw-text-2);
  }
  .note.stale {
    background: var(--sw-stale-soft);
    color: var(--sw-text);
  }
  .note.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .more {
    display: flex;
    justify-content: center;
    padding: 12px 14px 14px;
    border-block-start: 1px solid var(--sw-border);
  }
  sw-card sw-table,
  .flat {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }
  .sk-list {
    display: flex;
    flex-direction: column;
  }
  .sk-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-block-size: 56px;
    padding: 8px 14px;
    border-block-start: 1px solid var(--sw-border);
  }
  .sk-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sk {
    display: block;
    border-radius: var(--sw-r-xs);
    background: var(--sw-skeleton);
  }
  .sk.l {
    inline-size: 42%;
    block-size: 12px;
  }
  .sk.m {
    inline-size: 28%;
    block-size: 10px;
  }
  .sk.dotp {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 50%;
  }
  .sk.pill {
    inline-size: 72px;
    block-size: 22px;
    border-radius: var(--sw-r-pill);
  }
  .sk.tilebox {
    inline-size: 100%;
    block-size: 66px;
    border-radius: var(--sw-r-md);
  }
  .foot {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    inline-size: 100%;
  }
`;

/** Cells of an `sw-table` are rendered inside the table's own shadow root: this screen's stylesheet does not reach them, so the few looks a
 * cell needs are inline (tokens inherit into the shadow root). */
export const CELL = {
  muted: 'color:var(--sw-text-3)',
  sub: 'display:block;margin-block-start:2px;color:var(--sw-text-3);font-size:var(--sw-fs-xs)',
  raw: 'direction:ltr;unicode-bidi:isolate;font-family:var(--sw-font-mono);font-size:var(--sw-fs-xs)',
  row: 'display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px 8px',
  strong: 'font-weight:var(--sw-fw-semibold);color:var(--sw-heading)',
} as const;
