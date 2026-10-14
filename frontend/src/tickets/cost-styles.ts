import { css } from 'lit';

/**
 * CR-038 slice 9: the look of the cost card, its dialogs and page viewer, and the cost report - on top of the tickets glass layers
 * (styles/automations-glass.ts + tickets/styles.ts). The `--dv-*` palette and the `--sw-*` type / radius scale only (no literal colour,
 * font size or radius: tests/unit-token-lint.spec.ts reads this folder); logical properties only (RTL by default). The Bubble skin
 * gets its component-level rules here (its skin sheet is at its rule budget).
 */
export const costCardStyles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  .claims {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .claim {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    min-inline-size: 0;
  }
  .claim.high {
    border-color: color-mix(in srgb, var(--dv-warning) 55%, transparent);
  }
  .ch {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    min-inline-size: 0;
  }
  .ch .who {
    font-weight: 700;
    overflow-wrap: anywhere;
    min-inline-size: 0;
  }
  .ch .sp {
    flex: 1;
  }
  .amt {
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    white-space: nowrap;
  }
  .kv {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 16px;
    margin: 0;
    font-size: var(--sw-fs-base);
  }
  .kv dt {
    color: var(--dv-text-2);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .kv dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    text-align: end;
    white-space: nowrap;
  }
  .kv .tot {
    font-weight: 700;
    color: var(--dv-text);
    border-block-start: 1px solid var(--dv-border);
    padding-block-start: 4px;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .meta .late {
    color: var(--dv-danger);
    font-weight: 600;
  }
  .docs {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .doc {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    padding: 8px 10px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
    min-inline-size: 0;
  }
  .doc .dl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    min-inline-size: 0;
  }
  .doc .dl small {
    color: var(--dv-text-3);
    font-weight: 500;
  }
  .doc .sp {
    flex: 1;
  }
  .thumbs {
    display: flex;
    gap: 6px;
  }
  .thumb {
    inline-size: 44px;
    block-size: 56px;
    padding: 0;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    overflow: hidden;
    cursor: zoom-in;
  }
  .thumb img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb[aria-current='true'] {
    outline: 2px solid var(--dv-accent);
    outline-offset: 1px;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .reqrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-size: var(--sw-fs-base);
  }
  .reqrow .lbl {
    color: var(--dv-text-2);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .reqrow .seg {
    margin-inline-start: auto;
  }
  details.hist {
    border-block-start: 1px solid var(--dv-border);
    padding-block-start: 8px;
  }
  details.hist summary {
    cursor: pointer;
    min-block-size: 36px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    color: var(--dv-text-2);
  }
  .hist ol {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hist li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-inline-start: 10px;
    border-inline-start: 2px solid var(--dv-border);
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    overflow-wrap: anywhere;
  }
  .hist li b {
    color: var(--dv-text);
  }
  .hist li.dec {
    border-inline-start-color: var(--dv-accent);
  }
  .hist .why {
    white-space: pre-line;
    color: var(--dv-text);
  }
  .state {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    color: var(--dv-text-2);
    font-size: var(--sw-fs-base);
  }
  :host([data-skin='bubble']) .claim,
  :host([data-skin='bubble']) .doc {
    border-radius: var(--sw-r-md);
  }
`;

/** The dialogs of the card: the line editor, the totals preview, the files list, the page viewer. */
export const costDialogStyles = css`
  .lines {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .line {
    display: grid;
    grid-template-columns: minmax(96px, 0.8fr) minmax(0, 2fr) repeat(2, minmax(72px, 1fr)) auto;
    align-items: end;
    gap: 8px;
    padding: 10px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
  }
  .line .fld {
    min-inline-size: 0;
  }
  .line .fld > span {
    font-size: var(--sw-fs-sm);
  }
  .line .lt {
    grid-column: 1 / -2;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .line .rmv {
    align-self: center;
  }
  .line[aria-invalid='true'] {
    border-color: color-mix(in srgb, var(--dv-danger) 55%, transparent);
  }
  .preview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 16px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
    font-size: var(--sw-fs-base);
    font-variant-numeric: tabular-nums;
  }
  .preview dt {
    color: var(--dv-text-2);
  }
  .preview dd {
    margin: 0;
    text-align: end;
    unicode-bidi: isolate;
  }
  .preview .tot {
    font-weight: 700;
    color: var(--dv-text);
  }
  .files {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .files .frow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-base);
    min-inline-size: 0;
  }
  .files .frow span {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pick-file {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .pick-file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .viewer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-inline-size: 0;
  }
  .stage {
    display: grid;
    place-items: center;
    overflow: auto;
    block-size: min(62vh, 640px);
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
  }
  .stage img {
    max-inline-size: 100%;
    max-block-size: 100%;
    transform-origin: center;
    transition: transform var(--mm-motion, 0.2s) var(--mm-ease, ease);
    box-shadow: var(--dv-shadow-1);
  }
  .vbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .vbar .sp {
    flex: 1;
  }
  .vbar .pg {
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .gate {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  @media (max-width: 767px) {
    .line {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .line .fld.wide {
      grid-column: 1 / -1;
    }
    .line .lt {
      grid-column: 1 / 2;
    }
    .stage {
      block-size: 52vh;
    }
  }
`;
