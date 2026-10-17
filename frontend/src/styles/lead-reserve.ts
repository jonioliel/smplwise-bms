import { css } from 'lit';

/**
 * Header dropdown placement 4 (owner 2026-10-17, shell/sw-app.ts, setting `ui.dd_place`): on a wide screen the shell hangs the tab group's
 * dropdown chip at the START edge of the page's first row and publishes how much room it needs as `--sw-lead-reserve` (0 everywhere else,
 * and on a narrow screen). A screen that draws its OWN header keeps that room free by including this snippet:
 *   - the shared `.dh .dh-row` header family (styles/media-page.ts already includes it), or
 *   - any other first row: give the element the class `lead-head`.
 * `sw-page` reads the variable itself. tests/unit-lead-reserve.spec.ts fails when a screen renders a top-level header without it.
 */
export const leadReserveStyles = css`
  :host .dh .dh-row,
  :host .lead-head {
    padding-inline-start: var(--sw-lead-reserve, 0px);
  }
`;
