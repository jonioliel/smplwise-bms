import { css } from 'lit';

/**
 * CR-039 / DOORWIN-295: the shared look of the door-windows screen and the emergency controls - tokens only (`--sw-*`), so every skin
 * and palette (light and dark) follows. Tones ok / acc / warn / err / off map to the product's state colours. Logical properties only
 * (RTL and LTR); times and durations are text, never mirrored.
 */
export const dwCss = css`
  [data-tone='ok'] { --c: var(--sw-success); --cs: var(--sw-success-soft); --ct: var(--sw-success-text); }
  [data-tone='acc'] { --c: var(--sw-accent); --cs: var(--sw-accent-soft); --ct: var(--sw-accent-text); }
  [data-tone='warn'] { --c: var(--sw-warning); --cs: var(--sw-warning-soft); --ct: var(--sw-warning-text); }
  [data-tone='err'] { --c: var(--sw-danger); --cs: var(--sw-danger-soft); --ct: var(--sw-danger-text); }
  [data-tone='off'] { --c: var(--sw-unknown); --cs: var(--sw-unknown-soft); --ct: var(--sw-unknown-text); }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm);
    font-weight: 600; line-height: 20px; white-space: nowrap; max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis;
    background: var(--cs, var(--sw-surface-2)); color: var(--ct, var(--sw-text-2));
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; min-inline-size: 0; }
  .callout {
    display: grid; grid-template-columns: auto 1fr; gap: 10px; padding: 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-sm);
    background: var(--cs, var(--sw-accent-soft)); color: var(--sw-text); align-items: start;
  }
  .callout > sw-icon { color: var(--c, var(--sw-accent)); margin-block-start: 1px; }
  .callout b { display: block; margin-block-end: 2px; }
  ul.lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  ul.lines li {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 8px 10px;
    border-radius: var(--sw-r-md); background: var(--sw-surface-2); min-inline-size: 0;
  }
  ul.lines li > span:first-child { min-inline-size: 0; overflow-wrap: anywhere; }
  ul.lines small { font-size: var(--sw-fs-xs); color: var(--sw-text-2); inline-size: 100%; }
`;
