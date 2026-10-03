import { css } from 'lit';

/**
 * CR-023 electricity screens (accounts, bills, customers, billing settings): the shared styles, ported from the approved mockup
 * (docs/design/mockups/electricity/styles.css) onto the product tokens. One sheet for every element of this half so the screens
 * look the same; tokens only (a palette or a skin changes everything). Responsive by the viewport: phone <= 767 px, tablet <= 1100 px
 * (touch targets 44 px from 1100 down: the layout guard's rule). Bubble skin: pills and flat layers (`data-skin` is mirrored on the
 * host by SkinController).
 */
export const elecCss = css`
  :host {
    display: block;
    color: var(--sw-text);
    font-size: var(--sw-fs-md);
    min-inline-size: 0;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
    padding: var(--sw-s-4) var(--sw-page-pad, 24px) var(--sw-s-8);
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    min-inline-size: 0;
  }
  .sp {
    flex: 1;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
  }
  .cols {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  .cols.side-l {
    grid-template-columns: minmax(0, 1fr) 340px;
  }
  .cols.side-r {
    grid-template-columns: 240px minmax(0, 1fr);
  }
  h2,
  h3 {
    margin: 0;
    color: var(--sw-heading);
  }
  .h2 {
    font-size: var(--sw-fs-xl);
    font-weight: 700;
  }
  .h3 {
    font-size: var(--sw-fs-lg);
    font-weight: 600;
  }
  .mut {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .num {
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  }
  td.num,
  th.num {
    text-align: left;
  }
  .b {
    font-weight: 600;
    color: var(--sw-heading);
  }
  .bad {
    color: var(--sw-danger-text);
  }
  .sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* cards, tiles */
  .card {
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-lg);
    box-shadow: var(--sw-shadow-1);
    -webkit-backdrop-filter: var(--sw-glass-blur-sheet, none);
    backdrop-filter: var(--sw-glass-blur-sheet, none);
    padding: 16px;
    min-inline-size: 0;
  }
  .card.flush {
    padding: 0;
    overflow: hidden;
  }
  .card.soft {
    background: var(--sw-surface-2);
  }
  .card > .hd {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-block-end: 10px;
    flex-wrap: wrap;
  }
  .card.flush > .hd {
    padding: 14px 16px 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .tile {
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-lg);
    padding: 12px 14px;
    min-inline-size: 0;
  }
  .tile .k {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .tile .v {
    font-size: 24px;
    font-weight: 700;
    color: var(--sw-heading);
  }
  .tile .u {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
    font-weight: 500;
    margin-inline-start: 4px;
  }
  .prog {
    block-size: 8px;
    border-radius: 4px;
    background: var(--sw-surface-3);
    overflow: hidden;
  }
  .prog i {
    display: block;
    block-size: 100%;
    background: var(--sw-accent);
  }

  /* buttons and fields */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-block-size: 36px;
    padding: 0 14px;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface-solid);
    color: var(--sw-text);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    text-decoration: none;
  }
  .btn:hover {
    background: var(--sw-surface-2);
  }
  .btn.pri {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .btn.pri:hover {
    background: var(--sw-accent-hover);
  }
  .btn.dng {
    color: var(--sw-danger-text);
    border-color: var(--sw-danger);
  }
  .btn.dng.pri {
    background: var(--sw-danger);
    color: #fff;
  }
  .btn.ghost {
    background: transparent;
    border-color: transparent;
    color: var(--sw-accent-text);
  }
  .btn.sm {
    min-block-size: 30px;
    padding: 0 10px;
    font-size: var(--sw-fs-sm);
  }
  .btn[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
  }
  input,
  select,
  textarea {
    font: inherit;
    color: var(--sw-text);
    background: var(--sw-surface-solid);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    min-block-size: 38px;
    padding: 0 12px;
    min-inline-size: 0;
    inline-size: 100%;
  }
  textarea {
    padding: 8px 12px;
    resize: vertical;
    min-block-size: 70px;
  }
  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 3px var(--sw-accent-soft);
  }
  input[type='color'] {
    padding: 2px;
    inline-size: 44px;
    min-inline-size: 44px;
    cursor: pointer;
  }
  label.li {
    position: relative;
  }
  label.li > input {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    opacity: 0;
    margin: 0;
    padding: 0;
    cursor: pointer;
    border-radius: inherit;
  }
  .ind {
    inline-size: 18px;
    block-size: 18px;
    border-radius: 5px;
    border: 1.5px solid var(--sw-border-strong);
    display: inline-grid;
    place-items: center;
    flex: none;
    background: var(--sw-surface-solid);
  }
  input[type='radio'] + .ind {
    border-radius: 50%;
  }
  input:checked + .ind {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: #fff;
  }
  input[type='checkbox']:checked + .ind::after {
    content: '✓';
    font-size: 12px;
    font-weight: 700;
  }
  input[type='radio']:checked + .ind {
    background: var(--sw-surface-solid);
    border: 5px solid var(--sw-accent);
  }
  input:disabled + .ind,
  .li.dis > .ind {
    opacity: 0.4;
  }
  input:focus-visible + .ind {
    outline: 2px solid var(--sw-focus);
    outline-offset: 2px;
  }
  input.err,
  select.err,
  textarea.err {
    border-color: var(--sw-danger);
    box-shadow: 0 0 0 3px var(--sw-danger-soft);
  }
  input[type='search'] {
    inline-size: 260px;
    max-inline-size: 100%;
  }
  .ltr {
    direction: ltr;
    text-align: start;
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-inline-size: 0;
  }
  .fld > label,
  .fld > .lbl {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    font-weight: 500;
  }
  .fld .msg {
    font-size: var(--sw-fs-sm);
    color: var(--sw-danger-text);
  }
  .fld .unit {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fld .unit > span {
    color: var(--sw-text-3);
    white-space: nowrap;
  }
  .form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 16px;
  }
  .form .wide {
    grid-column: 1 / -1;
  }
  .seg {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    background: var(--sw-surface-3);
    border-radius: var(--sw-r-sm);
    max-inline-size: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .seg button {
    padding: 5px 12px;
    border-radius: calc(var(--sw-r-sm) - 2px);
    color: var(--sw-text-2);
    cursor: pointer;
    font: inherit;
    font-size: var(--sw-fs-sm);
    white-space: nowrap;
    border: 0;
    background: transparent;
    min-block-size: 30px;
  }
  .seg button[aria-pressed='true'] {
    background: var(--sw-surface-solid);
    color: var(--sw-text);
    font-weight: 600;
    box-shadow: var(--sw-shadow-1);
  }
  .seg button[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* chips */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    white-space: nowrap;
    line-height: 20px;
  }
  .chip::before {
    content: '';
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  .chip.nodot::before {
    display: none;
  }
  .c-ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .c-warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .c-err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .c-mut {
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
  }
  .c-acc {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }

  /* tables and lists */
  .scrollx {
    overflow-x: auto;
  }
  table.t {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--sw-fs-md);
  }
  table.t th {
    text-align: start;
    font-weight: 600;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    padding: 9px 12px;
    border-block-end: 1px solid var(--sw-border-strong);
    white-space: nowrap;
    background: var(--sw-surface-2);
  }
  table.t td {
    padding: 12px;
    border-block-end: 1px solid var(--sw-border);
    vertical-align: middle;
  }
  table.t tbody tr:last-child td {
    border-block-end: 0;
  }
  table.t tbody tr.go {
    cursor: pointer;
  }
  table.t tbody tr.go:hover td {
    background: var(--sw-surface-2);
  }
  table.t tfoot td {
    font-weight: 700;
    border-block-start: 1px solid var(--sw-border-strong);
  }
  table.t td.ell {
    max-inline-size: 260px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rowlink {
    color: var(--sw-heading);
    font-weight: 600;
    text-decoration: none;
  }
  .rowlink:hover {
    text-decoration: underline;
  }
  a.lnk {
    color: var(--sw-accent-text);
    text-decoration: none;
    cursor: pointer;
  }
  a.lnk:hover {
    text-decoration: underline;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .li {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    min-inline-size: 0;
    color: inherit;
    text-decoration: none;
    font: inherit;
    text-align: start;
  }
  button.li,
  a.li,
  label.li {
    cursor: pointer;
  }
  button.li {
    inline-size: 100%;
  }
  .li .grow {
    flex: 1;
    min-inline-size: 0;
  }
  .li .t1 {
    font-weight: 600;
    color: var(--sw-heading);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .li .t2 {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
  }
  .li .t2.wrap {
    white-space: normal;
  }
  .li.sel {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
  }
  .li.dis {
    opacity: 0.7;
    cursor: default;
  }
  .grid-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .kv {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 6px 14px;
    font-size: var(--sw-fs-md);
    margin: 0;
  }
  .kv dt {
    color: var(--sw-text-3);
  }
  .kv dd {
    margin: 0;
    color: var(--sw-text);
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .ver {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .ver .num:first-child {
    font-weight: 600;
  }

  /* states */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 56px 20px;
  }
  .empty .ic {
    inline-size: 56px;
    block-size: 56px;
    border-radius: 50%;
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    display: grid;
    place-items: center;
  }
  .empty.err .ic {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .empty h3 {
    font-size: var(--sw-fs-xl);
  }
  .alert {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: var(--sw-r-md);
    font-size: var(--sw-fs-md);
    border: 1px solid transparent;
  }
  .alert > div {
    min-inline-size: 0;
    flex: 1;
  }
  .alert.err {
    background: var(--sw-danger-soft);
    border-color: color-mix(in srgb, var(--sw-danger) 40%, transparent);
  }
  .alert.warn {
    background: var(--sw-warning-soft);
    border-color: color-mix(in srgb, var(--sw-warning) 40%, transparent);
  }
  .alert.ok {
    background: var(--sw-success-soft);
    border-color: color-mix(in srgb, var(--sw-success) 35%, transparent);
  }
  .alert.info {
    background: var(--sw-accent-soft);
  }
  .alert .x {
    font-weight: 800;
    flex: none;
  }
  .alert.err .x {
    color: var(--sw-danger-text);
  }
  .alert.warn .x {
    color: var(--sw-warning-text);
  }
  .alert.ok .x {
    color: var(--sw-success-text);
  }
  .skl {
    background: linear-gradient(90deg, var(--sw-surface-3), var(--sw-surface-2), var(--sw-surface-3));
    border-radius: 6px;
    block-size: 14px;
  }

  /* wizard */
  .wiz {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .steps {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .steps button {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 9px 10px;
    border-radius: var(--sw-r-md);
    color: var(--sw-text-2);
    cursor: pointer;
    border: 0;
    background: transparent;
    font: inherit;
    text-align: start;
  }
  .steps button .n {
    inline-size: 24px;
    block-size: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    flex: none;
  }
  .steps button.done .n {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .steps button.on {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font-weight: 600;
  }
  .steps button.on .n {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .steps button[disabled] {
    opacity: 0.55;
    cursor: default;
  }
  .pstep {
    display: none;
    align-items: center;
    gap: 10px;
  }
  .pstep .bar {
    flex: 1;
    block-size: 4px;
    border-radius: 2px;
    background: var(--sw-surface-3);
    overflow: hidden;
  }
  .pstep .bar i {
    display: block;
    block-size: 100%;
    background: var(--sw-accent);
  }
  .wfoot {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding-block-start: 14px;
    border-block-start: 1px solid var(--sw-border);
    margin-block-start: 6px;
  }

  /* formula editor */
  .presets {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .preset {
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    padding: 10px 12px;
    cursor: pointer;
    background: var(--sw-surface-solid);
    font: inherit;
    color: inherit;
    text-align: start;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .preset[aria-pressed='true'] {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 2px var(--sw-accent-soft);
  }
  .preset b {
    color: var(--sw-heading);
  }
  .preset span {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
  }
  .expr {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    min-block-size: 64px;
    padding: 10px;
    border: 1.5px solid var(--sw-accent);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-solid);
    box-shadow: 0 0 0 3px var(--sw-accent-soft);
    direction: rtl;
  }
  .expr.err {
    border-color: var(--sw-danger);
    box-shadow: 0 0 0 3px var(--sw-danger-soft);
  }
  .tok {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--sw-r-sm);
    line-height: 1.25;
    font: inherit;
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    cursor: pointer;
    min-block-size: 36px;
    justify-content: center;
  }
  .tok.m {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font-weight: 600;
    border-color: color-mix(in srgb, var(--sw-accent) 30%, transparent);
  }
  .tok.m small {
    font-weight: 500;
    color: var(--sw-text-3);
    font-size: 11px;
  }
  .tok.op {
    font-size: 20px;
    font-weight: 700;
    color: var(--sw-heading);
    padding: 0 8px;
  }
  .tok.k {
    background: var(--sw-surface-3);
    font-weight: 700;
    color: var(--sw-heading);
  }
  .tok.bad {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
    border-color: var(--sw-danger);
  }
  .tok.sel {
    outline: 2px solid var(--sw-accent);
  }
  .pal {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pal .btn {
    min-inline-size: 42px;
  }
  .menu {
    position: relative;
    display: inline-block;
  }
  .menu .pop {
    position: absolute;
    inset-block-start: calc(100% + 4px);
    inset-inline-start: 0;
    z-index: 5;
    min-inline-size: 240px;
    max-inline-size: 86vw;
    background: var(--sw-surface-solid);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    box-shadow: var(--sw-shadow-3);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-block-size: 280px;
    overflow: auto;
  }
  .menu .pop button {
    text-align: start;
    border: 0;
    background: transparent;
    padding: 8px 10px;
    border-radius: var(--sw-r-sm);
    font: inherit;
    color: var(--sw-text);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    min-block-size: 36px;
    align-items: center;
  }
  .menu .pop button:hover {
    background: var(--sw-surface-2);
  }
  .code {
    font-family: var(--sw-font-mono);
    direction: ltr;
    text-align: left;
  }

  /* chart */
  .chart {
    inline-size: 100%;
    block-size: auto;
    display: block;
  }
  .chart text {
    fill: var(--sw-text-3);
    font-size: 11px;
    font-family: var(--sw-font);
  }
  .chart .bar {
    fill: var(--sw-accent);
  }
  .chart .bar2 {
    fill: color-mix(in srgb, var(--sw-accent) 38%, var(--sw-surface-3));
  }
  .chart .ly {
    fill: none;
    stroke: var(--sw-text-2);
    stroke-width: 1.6;
    stroke-dasharray: 4 3;
  }
  .chart .part {
    fill: url(#hatch);
  }
  .chart .grid {
    stroke: var(--sw-border);
  }
  .legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .legend i {
    display: inline-block;
    inline-size: 12px;
    block-size: 12px;
    border-radius: 3px;
    margin-inline-end: 5px;
    vertical-align: -1px;
  }

  /* bill paper (always light: a print style, not the skin) */
  .paperwrap {
    display: flex;
    justify-content: center;
    background: var(--sw-surface-3);
    border-radius: var(--sw-r-lg);
    padding: 20px;
    overflow: hidden;
  }

  @media (max-width: 1100px) {
    .page {
      padding-inline: var(--sw-page-pad, 16px);
    }
    .cols.side-l,
    .cols.side-r {
      grid-template-columns: minmax(0, 1fr);
    }
    .grid-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .wiz {
      grid-template-columns: 200px minmax(0, 1fr);
    }
    .presets {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .btn,
    .seg button,
    .steps button,
    .preset,
    .tok,
    .menu .pop button {
      min-block-size: 44px;
    }
    .btn.sm {
      min-block-size: 44px;
    }
    input,
    select {
      min-block-size: 44px;
    }
    .hide-tablet {
      display: none !important;
    }
    .rowlink,
    a.lnk {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
    }
    button.li,
    a.li,
    label.li {
      min-block-size: 44px;
    }
  }
  @media (max-width: 767px) {
    .page {
      padding: 12px 14px 20px;
      gap: 12px;
    }
    .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .tile .v {
      font-size: 19px;
    }
    .grid-cards {
      grid-template-columns: minmax(0, 1fr);
    }
    .form {
      grid-template-columns: minmax(0, 1fr);
    }
    .wiz {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
    .steps {
      display: none;
    }
    .pstep {
      display: flex;
    }
    .hide-phone {
      display: none !important;
    }
    .presets {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    input[type='search'] {
      inline-size: 100%;
    }
    .paperwrap {
      padding: 8px;
    }
  }

  /* skins */
  :host([data-skin='domus']) .card {
    box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
  }
  :host([data-skin='tesla']) .btn {
    border-radius: 4px;
  }
  :host([data-skin='bubble']) .btn,
  :host([data-skin='bubble']) .chip,
  :host([data-skin='bubble']) input,
  :host([data-skin='bubble']) select,
  :host([data-skin='bubble']) .seg {
    border-radius: var(--sw-r-pill);
  }
  :host([data-skin='bubble']) textarea {
    border-radius: var(--sw-r-lg);
  }
  :host([data-skin='bubble']) .btn {
    border-color: transparent;
    background: var(--sw-surface-2);
  }
  :host([data-skin='bubble']) .btn.pri {
    background: var(--sw-accent);
  }
  :host([data-skin='bubble']) .btn.dng {
    border-color: var(--sw-danger);
  }
  :host([data-skin='bubble']) .btn.ghost {
    background: transparent;
  }
  :host([data-skin='bubble']) .seg {
    padding: 0;
    gap: 2px;
  }
  :host([data-skin='bubble']) .seg button {
    border-radius: var(--sw-r-pill);
    min-block-size: var(--sw-touch-desktop, 44px);
    min-inline-size: var(--sw-touch-desktop, 44px);
  }
  :host([data-skin='bubble']) .li,
  :host([data-skin='bubble']) .tile,
  :host([data-skin='bubble']) .card {
    border-color: transparent;
  }
  :host([data-skin='bubble']) table.t th {
    background: transparent;
  }
  :host([data-skin='bubble']) table.t td {
    border-block-end-color: rgba(127, 127, 127, 0.14);
  }
  :host([data-skin='bubble']) .btn,
  :host([data-skin='bubble']) input,
  :host([data-skin='bubble']) select,
  :host([data-skin='bubble']) .preset,
  :host([data-skin='bubble']) .tok {
    min-block-size: var(--sw-touch-desktop, 44px);
  }
`;
