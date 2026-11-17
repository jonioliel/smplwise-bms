import { css } from 'lit';

/**
 * AUDIT30-C-TICKETS (audit round 30, finding 4, owner question 3 answered with the recommended option: "light blue fill, blue text"):
 * the ONE selected look of every chip and single-choice key on the service screens - the Blue Wash pair of DESIGN.md
 * (`--sw-accent-soft` behind `--sw-accent-text`), no filled black (`--dv-text`) or filled accent key. The glass page frame
 * (styles/media-page.ts) paints a pressed `.rc` as a black key; every tickets screen appends this fragment LAST so it wins at the
 * same specificity. Tokens only.
 *
 * After branch B (pilot/AUDIT30-B-SHARED) merges: `chipSelected` from components/sw-chip.ts carries the same declarations; this
 * fragment then imports it instead of repeating them.
 */
export const ticketChipSelected = css`
  .rc[aria-pressed='true'],
  .rc[aria-checked='true'],
  .rooms .rc[aria-pressed='true'],
  .fchips .rc[aria-pressed='true'],
  .fchips .rc[aria-checked='true'],
  .prio .rc[aria-checked='true'],
  .pop button.rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true']:hover {
    background: var(--sw-accent-soft);
    border-color: transparent;
    color: var(--sw-accent-text);
    font-weight: var(--sw-fw-semibold);
    box-shadow: none;
  }
  .rc[aria-pressed='true'] small,
  .rc[aria-checked='true'] small {
    background: color-mix(in srgb, var(--sw-accent-text) 14%, transparent);
    color: var(--sw-accent-text);
  }
`;
