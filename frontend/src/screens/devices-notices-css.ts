import { css } from 'lit';

/**
 * HOMEEDIT-POLISH-2331: the notice board page's own layer over the shared notices sheet (notices/styles.ts, also read by the settings
 * pages, the compose dialog and the TV displays - left as it is). It brings the page to the HOMEFABLE-297 / POLISH-CONTROL-297 feel:
 * the page heading in the heading ink at 700, KPI tiles that lift on hover and give on pointer-down, a visible focus on a table row and
 * a phone card (both open the notice from the keyboard now) and a toast that slides in (the row hover wash is gated in the shared sheet). Tokens only.
 */
export const devicesNoticesCss = css`
  .top h1 {
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.01em;
  }
  .kpi {
    transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color),
      background var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .kpi b {
    font-weight: var(--sw-fw-bold);
    font-variant-numeric: tabular-nums;
  }
  .kpi:active,
  .seg button:active,
  .pick:active:not(:disabled) {
    transform: scale(var(--sw-press-scale));
  }
  .kpi:focus-visible,
  .seg button:focus-visible,
  .pick:focus-visible,
  .search:focus-within {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .seg button {
    transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  @media (hover: hover) and (pointer: fine) {
    .kpi:hover {
      border-color: var(--sw-border-strong);
      background: var(--sw-surface-2);
    }
    .seg button:hover:not([aria-pressed='true']) {
      color: var(--sw-text);
    }
    .card.go:hover {
      background: var(--sw-hover-wash);
    }
  }
  /* POLISH4-WP4: the row wash is gated to a hovering fine pointer in the shared sheet itself (notices/styles.ts, POLISH4-WP1), so the
     local cancel that lived here is gone */
  table.t tr.go:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
  table.t tr.go:focus-visible td {
    background: var(--sw-surface-2);
  }
  table.t td .t1 {
    display: flex;
    align-items: center;
    gap: var(--sw-s-1h);
  }
  .card.go {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-hover) var(--sw-ease-color);
  }
  .card.go:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
  .card .t1 {
    display: flex;
    align-items: center;
    gap: var(--sw-s-1h);
  }
  .new {
    flex: none;
    margin-inline-start: 0;
  }
  .toast {
    transition: opacity var(--sw-t-hover) var(--sw-ease-color), translate var(--sw-t-hover) var(--sw-ease);
  }
  @starting-style {
    .toast {
      opacity: 0;
      translate: 0 8px;
    }
  }
  /* a phone: the toolbar's search takes the rest of the row, the KPI tiles and the segment keys reach a 44 px target */
  @media (max-width: 767px) {
    .search {
      flex: 1;
      min-inline-size: 0;
      min-block-size: var(--sw-touch-desktop);
      box-sizing: border-box;
    }
    .search input {
      inline-size: 100%;
      font-size: var(--sw-fs-md);
    }
    .seg button {
      min-block-size: var(--sw-touch);
    }
    .kpi {
      min-block-size: var(--sw-touch-desktop);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .kpi,
    .seg button,
    .card.go,
    .toast {
      transition-duration: 0ms;
    }
    @starting-style {
      .toast {
        translate: none;
      }
    }
  }
`;
