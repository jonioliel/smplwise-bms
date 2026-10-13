import { css } from 'lit';

/**
 * CR-038: the stylesheet of the module's settings screens (system-tickets and its parts: the department editor, the SLA grid), on top
 * of styles/settings.ts. Tokens only (--sw-*); component-level rules (the bubble skin's budget is not touched). Slice 1's rules moved
 * here unchanged in slice 2 so the department editor and the grid share them.
 */
export const ticketSettingsCss = css`
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    max-inline-size: 980px;
    min-inline-size: 0;
  }
  a {
    color: var(--sw-accent-text);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
  }
  /* a stacked row: the label is a line, not a 220 px flex basis (which is a HEIGHT in a column) */
  .row.stack .lbl {
    flex: none;
  }
  .in {
    box-sizing: border-box;
    min-block-size: 36px;
    padding-inline: 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    min-inline-size: 0;
  }
  .in[aria-invalid='true'] {
    border-color: var(--sw-danger);
  }
  .in.num {
    inline-size: 84px;
  }
  .in.time {
    inline-size: 104px;
  }
  textarea.in {
    padding-block: 8px;
    min-block-size: 72px;
    resize: vertical;
    inline-size: 100%;
  }
  .names {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 8px;
    align-items: start;
    inline-size: 100%;
  }
  .names label,
  .fld {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    min-inline-size: 0;
  }
  .lang {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
    margin-block-start: var(--sw-s-2);
  }
  .preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    white-space: nowrap;
  }
  .tag.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .tag.warn {
    background: var(--sw-stale-soft);
    color: var(--sw-warning-text);
  }
  .tag.acc {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  button.tag {
    border: 0;
    font: inherit;
    font-size: var(--sw-fs-xs);
    cursor: pointer;
  }
  button.tag[aria-pressed='true'] {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .chipsrow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .rm {
    border: 0;
    background: transparent;
    color: var(--sw-text-3);
    font: inherit;
    cursor: pointer;
    padding: 0 2px;
    min-block-size: 24px;
  }
  .rm:hover {
    color: var(--sw-danger);
  }
  .rc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 36px;
    padding-inline: 14px;
    border-radius: 999px;
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .rc[aria-pressed='true'] {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .rc:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .people {
    display: flex;
    flex-direction: column;
  }
  .person {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 10px 0;
    border-block-end: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
    min-inline-size: 0;
  }
  .person:last-child {
    border-block-end: 0;
  }
  .person .who {
    font-weight: var(--sw-fw-semibold);
    min-inline-size: 140px;
  }
  .person .via {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .row .end.start {
    justify-content: flex-start;
  }
  /* slice 2: the departments tab - a list at the start, the editor beside it (stacked on a narrow screen) */
  .split {
    display: grid;
    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
    gap: var(--sw-s-3);
    align-items: start;
    max-inline-size: 1240px;
  }
  .dlist {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ditem {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: var(--sw-r-md);
    cursor: pointer;
    min-inline-size: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    inline-size: 100%;
  }
  .ditem:hover {
    background: var(--sw-hover-wash);
  }
  .ditem[aria-current='true'] {
    background: var(--sw-accent-soft);
  }
  .ditem .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-inline-size: 0;
  }
  .ditem .nm {
    font-weight: var(--sw-fw-semibold);
    font-size: var(--sw-fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ditem .sub {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ditem.off .nm {
    color: var(--sw-text-3);
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    inline-size: 100%;
  }
  .unit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  /* the SLA grid: a table on a wide screen, one card per priority on a phone */
  .gridwrap {
    overflow-x: auto;
    max-inline-size: 100%;
  }
  table.sla {
    border-collapse: collapse;
    inline-size: 100%;
    font-size: var(--sw-fs-sm);
  }
  table.sla th {
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-3);
    text-align: start;
    padding: 6px 4px;
    vertical-align: bottom;
    white-space: normal;
    min-inline-size: 88px;
  }
  table.sla td {
    padding: 6px 4px;
    border-block-start: 1px solid var(--sw-border);
    vertical-align: middle;
  }
  table.sla td.pn {
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-2);
    min-inline-size: 96px;
  }
  .cell {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .cell .in {
    inline-size: 56px;
    padding-inline: 6px;
  }
  .cell select.in {
    inline-size: auto;
    padding-inline: 4px;
  }
  .pcards {
    display: none;
  }
  .pcard {
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pcard h4 {
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
  }
  .pcard .pr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    flex-wrap: wrap;
  }
  table.matrix {
    border-collapse: collapse;
    inline-size: 100%;
    font-size: var(--sw-fs-sm);
  }
  table.matrix th {
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-3);
    padding: 6px 4px;
    text-align: center;
    vertical-align: bottom;
  }
  table.matrix th:first-child,
  table.matrix td:first-child {
    text-align: start;
  }
  table.matrix td {
    padding: 8px 4px;
    border-block-start: 1px solid var(--sw-border);
    text-align: center;
  }
  .yes {
    color: var(--sw-success-text);
    font-weight: var(--sw-fw-semibold);
  }
  .no {
    color: var(--sw-text-3);
  }
  .tpl {
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }
  .tplhead {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: space-between;
  }
  .tplhead .nm {
    font-weight: var(--sw-fw-semibold);
    font-size: var(--sw-fs-sm);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  /* the layout follows the space the component really has (a settings page sits beside the settings index), not the window */
  :host {
    container-type: inline-size;
  }
  @container (max-width: 1000px) {
    .split {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @container (max-width: 660px) {
    .gridwrap {
      display: none;
    }
    .pcards {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  }
  @media (max-width: 767px) {
    .names {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .names > :last-child {
      grid-column: 1 / -1;
    }
  }
`;
