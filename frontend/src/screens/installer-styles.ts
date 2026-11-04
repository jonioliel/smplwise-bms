import { css } from 'lit';

/** WISKEY-INSTALLER-NATIVE-2400: the few rules the installer tools share on top of settingsStyles - a labelled field, a picker row and the
 * muted / tone helpers. Tokens only. */
export const installerStyles = css`
  label.f {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    min-inline-size: 0;
  }
  label.f input,
  label.f select,
  label.f textarea,
  select.pick {
    font: inherit;
    font-size: var(--sw-fs-md);
    min-block-size: 40px;
    padding: 0 10px;
    border: 1px solid var(--sw-border-strong, var(--sw-border));
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    color: var(--sw-text);
    min-inline-size: 0;
  }
  label.f textarea {
    padding: 8px 10px;
    min-block-size: 120px;
    font-family: var(--sw-font-mono, ui-monospace, monospace);
    font-size: var(--sw-fs-sm);
  }
  label.f input:focus-visible,
  label.f select:focus-visible,
  label.f textarea:focus-visible,
  select.pick:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  label.f input:disabled,
  label.f select:disabled {
    background: var(--sw-surface-2, var(--sw-surface-3));
    color: var(--sw-text-3);
    cursor: not-allowed;
  }
  label.f input[aria-invalid='true'] {
    border-color: var(--sw-danger, var(--sw-err));
  }
  .field-error {
    color: var(--sw-danger-text, var(--sw-err));
    font-size: var(--sw-fs-sm);
  }
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .pickrow {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
  }
  .pickrow label.f {
    flex: 1 1 220px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 12px;
  }
  .opt {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .opt input {
    margin-block-start: 4px;
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--sw-accent);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .list > .item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 0;
    border-block-end: 1px solid var(--sw-border);
    font-variant-numeric: tabular-nums;
  }
  .list > .item:last-child {
    border-block-end: 0;
  }
  .item .grow {
    flex: 1 1 200px;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .item .grow b {
    font-weight: var(--sw-fw-semibold);
    overflow-wrap: anywhere;
  }
  details > summary {
    cursor: pointer;
    color: var(--sw-text-2);
    padding-block: 6px;
  }
`;
