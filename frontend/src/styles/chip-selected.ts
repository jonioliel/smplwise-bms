import { css } from 'lit';

/**
 * The ONE selected state of every chip / filter pill in the product (AUDIT30-B-SHARED, audit round 30 finding 4), in the look the
 * owner chose in round 33 (DOMUS-DEFAULT-2439, Q-DES-3 option b): the light-blue field STRENGTHENED - the accent ink one step deeper,
 * an accent ring and a check mark. The plain field alone sat 1.2:1 to 1.4:1 from the panel (WCAG 1.4.11 asks 3:1 for the boundary of a
 * control state); the ring is that boundary (>= 3:1 in every skin, light and dark) and the check is the cue that needs no colour.
 *
 * Drawn by sw-chip (components/sw-chip.ts), and by every screen that still owns a local chip - it imports the fragments instead of
 * copying values (this module is CSS only, so a style module and a node unit spec can load it without loading a component):
 *   import { chipSelected, chipSelectedCheck } from '../styles/chip-selected';
 *   css`.rc[aria-pressed='true'] { ${chipSelected} } .rc[aria-pressed='true']::before { ${chipSelectedCheck} }`
 *
 * A setting (`ui.chip_selected`, Settings > General > System look; design/apply.ts CHIP_ON_MODES): strong (this, the default) | soft
 * (the plain light-blue field) | filled (the accent key) | dark (the ink pill). The alternatives are overrides of the
 * `--sw-chip-on-*` knobs (design/css.ts CHIP_ON_CSS); the default is the fallbacks written here, resolved AT THE CHIP - so a glass
 * screen that rewrites the accent tokens on its host (styles/devices-themes.ts) gets the same look in its own colours.
 * Ink on field >= 4.5:1, ring on panel >= 3:1: tests/unit-chip-selected-2439.spec.ts (every skin, light and dark).
 */
export const chipSelected = css`
  background: var(--sw-chip-on-bg, var(--sw-accent-soft));
  color: var(--sw-chip-on-ink, var(--sw-accent-text-strong));
  border-color: var(--sw-chip-on-ring, var(--sw-accent));
  font-weight: var(--sw-fw-semibold);
  /* the ring is the 1 px border plus half a pixel inside it (1.5 px, as measured for the owner) - no layout change */
  box-shadow: inset 0 0 0 0.5px var(--sw-chip-on-ring, var(--sw-accent));
`;
/** The pressed / hovered selected chip: the same field one accent step deeper; the ring stays. */
export const chipSelectedHover = css`
  background: var(--sw-chip-on-hover, color-mix(in srgb, var(--sw-accent) 14%, var(--sw-accent-soft)));
  border-color: var(--sw-chip-on-ring, var(--sw-accent));
  box-shadow: inset 0 0 0 0.5px var(--sw-chip-on-ring, var(--sw-accent));
`;
/**
 * The check mark of a selected LOCAL chip, for its ::before (sw-chip draws its own with sw-icon): two borders of a turned box in the
 * chip's ink - no image, no extra element, nothing for a screen reader (the state is aria-pressed / aria-checked). Hidden by the
 * alternatives of the setting (--sw-chip-on-check: none).
 */
export const chipSelectedCheck = css`
  content: '';
  display: var(--sw-chip-on-check, inline-block);
  flex: none;
  box-sizing: border-box;
  inline-size: 0.36em;
  block-size: 0.68em;
  margin-block: 0 0.16em;
  margin-inline: 0.2em 0.34em;
  border: solid currentColor;
  border-width: 0 0.14em 0.14em 0;
  transform: rotate(45deg);
`;
