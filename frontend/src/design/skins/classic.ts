import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { POLISH_MOTION_TOKENS } from './polish-motion';

/**
 * The default look. Until round 4 classic WAS the base table with no overrides; POLISH-CLASSIC-DOMUS-297 (owner 2026-10-27: keep the
 * structure, make it "much more beautiful, premium") gives it a polish layer of its own, so the base table that the other skins
 * inherit from does not move under them. Nothing here moves a control, changes a size or adds a colour meaning:
 *  - depth: two-layer shadows (a contact shadow + a soft ambient one) instead of a single 4 % hairline shadow, and the 1 px light
 *    edge along the top of raised controls and panels (the bevel - allowed in classic and domus only, define.ts BEVEL_SKINS);
 *  - separation: the canvas one tone step deeper so the white panels lift; the control outline a step stronger than the panel
 *    hairline (they were 2 % apart);
 *  - dark: a deeper canvas, crisper hairlines, a faint top edge on every panel;
 *  - motion: polish-motion.ts (press feedback, the switch spring, the dialog landing);
 *  - the rules below: the bevel on buttons / chips / the segmented thumb, pressed wells, the input well, the dialog and the rail.
 * Skills that drove it: impeccable polish, emil-design-eng, apple-design (materials and depth), ui-ux-pro-max (contrast, states).
 */
const tokens: TokenTable = {
  '--sw-bg': lt('#eef1f6', '#090d17'),
  '--sw-border': lt('#e3e7ee', '#212b40'),
  '--sw-border-strong': lt('#d3d9e4', '#313d57'),
  '--sw-menu-surface': lt('#ffffff', '#151c2c'),
  '--sw-menu-border': lt('#e3e7ee', '#2a3550'),
  '--sw-highlight': lt('rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.05)'),
  '--sw-heading': lt('#16243b', '#f5f7fc'),
  '--sw-overlay': lt('rgba(15, 23, 42, 0.42)', 'rgba(2, 4, 10, 0.66)'),
  // one step rounder (the cards were 12, the dialog the same 14 as a panel): softer objects, the dialog above the card
  '--sw-r-md': same('14px'),
  '--sw-r-lg': same('16px'),
  '--sw-r-xl': same('18px'),
  '--sw-shadow-1': lt('0 1px 2px rgba(16, 24, 40, 0.06), 0 3px 10px rgba(34, 49, 76, 0.05)', '0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.18)'),
  '--sw-shadow-2': lt('0 2px 4px rgba(16, 24, 40, 0.04), 0 10px 28px rgba(34, 49, 76, 0.10)', '0 2px 4px rgba(0, 0, 0, 0.35), 0 12px 32px rgba(0, 0, 0, 0.45)'),
  '--sw-shadow-3': lt('0 4px 12px rgba(16, 24, 40, 0.06), 0 24px 60px rgba(34, 49, 76, 0.20)', '0 4px 12px rgba(0, 0, 0, 0.4), 0 28px 70px rgba(0, 0, 0, 0.62)'),
  '--sw-shadow-primary': lt('0 1px 2px rgba(31, 87, 209, 0.30), 0 3px 10px rgba(39, 103, 237, 0.20)', '0 1px 2px rgba(0, 0, 0, 0.45), 0 3px 10px rgba(30, 70, 170, 0.35)'),
  '--sw-shadow-thumb': lt('0 1px 2px rgba(16, 24, 40, 0.14), 0 2px 6px rgba(16, 24, 40, 0.10)', '0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35)'),
  '--sw-toast-bg': lt('#16243b', '#26324d'),
  ...POLISH_MOTION_TOKENS,
};

const rules = `
/* classic 1 - raised controls carry a 1 px light top edge (the bevel) over a two-layer shadow; pressing sinks them into a well */
:host(sw-button) button, :host(sw-chip) button { box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-button[variant='primary']) button, :host(sw-chip[selected]) button { box-shadow: var(--sw-shadow-primary), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0, 0, 0, 0.10); }
:host(sw-button[variant='ghost']) button { box-shadow: none; }
:host(sw-button[variant='danger']) button { box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-button) button:active:not(:disabled), :host(sw-chip) button:active:not(:disabled) { box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.12); }
:host(sw-button[variant='primary']) button:active:not(:disabled), :host(sw-chip[selected]) button:active:not(:disabled) { box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.22); }
/* classic 2 - panels: the same edge of light on the cards, KPI tiles, tables, the home widgets, the floor cards and the tree */
:host(sw-card), :host(sw-kpi), :host(sw-table), :host(devices-building) section.fcard, :host(devices-building) nav.tree, :host(home-widgets) .wg { box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-card[interactive]:hover) { box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
/* classic 3 - the segmented control: the track is a shallow well, the thumb a raised key */
:host(sw-tabs[data-variant='pill']) .row::before { box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.06); }
:host(sw-tabs[data-variant='pill']) .on .lbl { box-shadow: var(--sw-shadow-thumb), inset 0 1px 0 var(--sw-highlight); }
/* classic 4 - fields sit in a shallow well; the switch track too */
::slotted(input:not([type='checkbox']):not([type='radio']):not([type='range'])), ::slotted(select), ::slotted(textarea) { box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.05); }
:host(sw-toggle) button { box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.14); }
/* classic 5 - floating layers: a hairline and the light edge on the dialog and the drawer */
:host(sw-dialog) .box { border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
:host(sw-drawer) .panel { box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
/* classic 6 - the rail sits on the canvas (no white column and no rule); the current area is a raised key on it, like the segmented thumb */
:host(sw-app) nav.rail.rail { background: transparent; border-inline-end-color: transparent; }
:host(sw-app) a.item.active { background: var(--sw-surface); box-shadow: var(--sw-shadow-thumb), inset 0 1px 0 var(--sw-highlight); }
/* classic 7 - tables: the header quieter and tighter, numbers in tabular figures */
:host(sw-table) th { font-weight: var(--sw-fw-semibold); letter-spacing: 0.01em; }
:host(sw-table) td { font-variant-numeric: tabular-nums; }
`;

export const classic: Skin = {
  id: 'classic',
  name: 'Classic',
  nameHe: 'קלאסי',
  noteHe: 'המראה הנוכחי של המערכת',
  stage: 'stable',
  // the bevel (classic and domus only, define.ts BEVEL_SKINS) and the 1 px top edge; no material layer, no glass
  features: { material: false, bevel: true, pixelEdge: true, glass: false },
  tokens,
  rules,
};
