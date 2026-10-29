import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { ENTER_RULES, POLISH_MOTION_TOKENS } from './polish-motion';

/**
 * The default look. Until round 4 classic WAS the base table with no overrides; POLISH-CLASSIC-DOMUS-297 (owner 2026-10-27: keep the
 * structure, make it "much more beautiful, premium") gave it a polish layer of its own, so the base table that the other skins
 * inherit from does not move under them.
 *
 * POLISH-BOLD-297 (P7, owner 2026-10-27 late: "the before/after pairs look too similar, you can do better"): the polish layer is
 * now BOLD. Nothing moves, nothing is added or removed, no colour gets a new meaning (green stays status); what changes is what P1
 * kept frozen and the owner then released: the type scale (a display tier for numerals, a heavier page title, 13.5 px body), the
 * elevation ladder (three real shadow steps instead of hairlines under the perception floor), tinted neutrals (a cool canvas with a
 * faint accent bloom, three surface steps the eye can tell apart in light AND dark), the control outline, radii one step rounder,
 * control heights +2/+4 px, raised keys (gradient + bevel) on buttons and chips, filled status badges, a display clock, the entrance
 * choreography (polish-motion.ts). Skills: impeccable bolder/polish, taste-skill app-screen rules (its "flat surfaces / no shadow /
 * KPIs are type" rules were REJECTED on the owner's explicit ask for depth and bevels - recorded in the P7 report), apple-design
 * (materials: a key is a raised object, a well is pressed), emil-design-eng, ui-ux-pro-max (contrast floors kept: tests/unit-muted-contrast).
 */
const tokens: TokenTable = {
  // the canvas: a cool tinted neutral, one tone step deeper than before, with a faint accent bloom top-end (never under text at full alpha
  // below 4.5:1 - unit-muted-contrast checks the bloom centres); dark: a deep navy, not black, so the surface ladder has room above it
  '--sw-bg': lt('#e4e9f2', '#070b14'),
  '--sw-canvas': lt(
    'radial-gradient(1000px 560px at 100% -10%, rgba(37, 99, 235, 0.07), transparent 62%), radial-gradient(900px 520px at 0% 110%, rgba(37, 99, 235, 0.05), transparent 62%), linear-gradient(#e4e9f2, #e4e9f2)',
    'radial-gradient(1000px 560px at 100% -10%, rgba(58, 108, 224, 0.16), transparent 62%), radial-gradient(900px 520px at 0% 110%, rgba(58, 108, 224, 0.10), transparent 62%), linear-gradient(#070b14, #070b14)',
  ),
  '--sw-surface': lt('#ffffff', '#131a2a'),
  '--sw-surface-2': lt('#f4f7fb', '#1a2336'),
  '--sw-surface-3': lt('#e9eef6', '#243049'),
  '--sw-surface-solid': lt('#ffffff', '#131a2a'),
  '--sw-surface-2-solid': lt('#f4f7fb', '#1a2336'),
  '--sw-surface-3-solid': lt('#e9eef6', '#243049'),
  '--sw-menu-surface': lt('#ffffff', '#1a2336'),
  '--sw-menu-border': lt('#dfe5ee', '#2f3c58'),
  // the panel hairline and the control outline two clear steps apart (they were 2 % apart before round 4, one step after P1)
  '--sw-border': lt('#d9e0ea', '#253148'),
  '--sw-border-strong': lt('#c7d1df', '#36445f'),
  '--sw-highlight': lt('rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.07)'),
  '--sw-heading': lt('#0f1b31', '#f7f9fd'),
  '--sw-text': lt('#1f2b42', '#e4e9f3'),
  '--sw-text-2': lt('#46556f', '#a7b2c7'),
  '--sw-text-3': lt('#4f5e78', '#8d9ab2'),
  // taste-skill lint "framework-colour": not the Tailwind blue-600 - the product's own blue, a hair deeper than the base #2767ed
  '--sw-accent': lt('#2360e8', '#3b6fe6'),
  '--sw-accent-hover': lt('#1b4ecf', '#3365d9'),
  '--sw-accent-soft': lt('#e4ecff', 'rgba(91, 140, 255, 0.2)'),
  '--sw-accent-text': lt('#1a4fd6', '#8fb2ff'),
  // the deeper canvas and its bloom: the muted inks the base table had at ~4.0:1 on the bloom centre step down (unit-muted-contrast)
  '--sw-offline-text': lt('#525b6c', '#b4bdcc'),
  '--sw-unknown-text': lt('#525b6c', '#aab5c9'),
  '--sw-success-text': lt('#0f6e33', '#3ddc84'),
  '--sw-focus': lt('#2360e8', '#7aa2ff'),
  '--sw-nav': lt('#2360e8', '#3b6fe6'),
  '--sw-overlay': lt('rgba(15, 23, 42, 0.46)', 'rgba(2, 4, 10, 0.7)'),
  '--sw-hover-wash': lt('rgba(20, 30, 50, 0.05)', 'rgba(255, 255, 255, 0.06)'),
  '--sw-pressed-wash': lt('rgba(20, 30, 50, 0.09)', 'rgba(255, 255, 255, 0.11)'),
  '--sw-skeleton': lt('#e9eef6', '#243049'),
  // the type scale: a display tier for the numerals the owner reads first, a page title with weight, 13.5 px body (was 13)
  '--sw-fs-2xs': same('11px'),
  '--sw-fs-xs': same('12px'),
  '--sw-fs-sm': same('13px'),
  '--sw-fs-base': same('13.5px'),
  '--sw-fs-md': same('14.5px'),
  '--sw-fs-lg': same('16px'),
  '--sw-fs-xl': same('18px'),
  '--sw-fs-2xl': same('24px'),
  '--sw-fs-3xl': same('30px'),
  '--sw-lh': same('1.45'),
  '--sw-h1': same('30px'),
  '--sw-h1-weight': same('800'),
  '--sw-h1-tracking': same('-0.9px'),
  '--sw-h1-phone': same('22px'),
  // radii one step rounder (softer objects); the dialog above the card
  '--sw-r-xs': same('7px'),
  '--sw-r-sm': same('10px'),
  '--sw-r-md': same('16px'),
  '--sw-r-lg': same('18px'),
  '--sw-r-xl': same('22px'),
  '--sw-r-2xl': same('26px'),
  // control heights inside the owner's +/- 4 px: the small key 28, the default 34, the large 40 (touch targets, ui-ux-pro-max)
  '--sw-ctl-h-sm': same('28px'),
  '--sw-ctl-h-md': same('34px'),
  '--sw-ctl-h-lg': same('40px'),
  // the elevation ladder: a contact shadow + a soft ambient one + a long diffuse one; each step is visible in a still at 100 %
  '--sw-shadow-1': lt(
    '0 1px 1px rgba(16, 24, 40, 0.05), 0 2px 4px rgba(16, 24, 40, 0.05), 0 12px 24px -10px rgba(30, 45, 80, 0.18)',
    '0 1px 1px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3), 0 14px 28px -10px rgba(0, 0, 0, 0.6)',
  ),
  '--sw-shadow-2': lt(
    '0 2px 4px rgba(16, 24, 40, 0.05), 0 8px 16px -4px rgba(30, 45, 80, 0.12), 0 24px 48px -16px rgba(30, 45, 80, 0.24)',
    '0 2px 4px rgba(0, 0, 0, 0.4), 0 10px 20px -4px rgba(0, 0, 0, 0.45), 0 28px 56px -16px rgba(0, 0, 0, 0.7)',
  ),
  '--sw-shadow-3': lt(
    '0 4px 8px rgba(16, 24, 40, 0.06), 0 16px 32px -8px rgba(30, 45, 80, 0.18), 0 48px 96px -24px rgba(30, 45, 80, 0.34)',
    '0 4px 8px rgba(0, 0, 0, 0.45), 0 20px 40px -8px rgba(0, 0, 0, 0.55), 0 56px 112px -24px rgba(0, 0, 0, 0.8)',
  ),
  '--sw-shadow-primary': lt('0 1px 2px rgba(29, 79, 209, 0.35), 0 6px 16px -4px rgba(37, 99, 235, 0.45)', '0 1px 2px rgba(0, 0, 0, 0.5), 0 6px 16px -4px rgba(59, 111, 230, 0.5)'),
  '--sw-shadow-thumb': lt('0 1px 2px rgba(16, 24, 40, 0.16), 0 3px 8px -2px rgba(16, 24, 40, 0.2)', '0 1px 2px rgba(0, 0, 0, 0.55), 0 3px 8px -2px rgba(0, 0, 0, 0.5)'),
  '--sw-toast-bg': lt('#0f1b31', '#283452'),
  '--sw-hover-lift': same('-2px'),
  ...POLISH_MOTION_TOKENS,
};

const rules = `
/* classic 1 - a key: raised (a vertical gradient, the 1 px light top edge, the two-layer shadow); pressed: sunk into a well */
:host(sw-button) button, :host(sw-chip) button { background: linear-gradient(180deg, var(--sw-surface), var(--sw-surface-2)) var(--sw-surface); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-button[variant='primary']) button, :host(sw-chip[selected]) button { background: linear-gradient(180deg, color-mix(in srgb, var(--sw-accent) 86%, #ffffff), var(--sw-accent-hover)) var(--sw-accent-hover); border-color: var(--sw-accent-hover); box-shadow: var(--sw-shadow-primary), inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -1px 0 rgba(0, 0, 0, 0.14); }
:host(sw-button[variant='ghost']) button { background: transparent; box-shadow: none; }
:host(sw-button[variant='danger']) button { background: linear-gradient(180deg, var(--sw-surface), var(--sw-danger-soft)); }
:host(sw-button) button:active:not(:disabled), :host(sw-chip) button:active:not(:disabled) { background: var(--sw-surface-2); box-shadow: inset 0 2px 3px rgba(16, 24, 40, 0.14); }
:host(sw-button[variant='primary']) button:active:not(:disabled), :host(sw-chip[selected]) button:active:not(:disabled) { background: var(--sw-accent-hover); box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.26); }
@media (hover: hover) and (pointer: fine) { :host(sw-button:not([variant='ghost'])) button:hover:not(:disabled), :host(sw-chip) button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); } }
/* classic 2 - panels are objects: the light top edge over the ladder's first step; the home widgets, the floor cards and the tree too */
:host(sw-card), :host(sw-kpi), :host(sw-table), :host(devices-building) section.fcard, :host(devices-building) nav.tree, :host(home-widgets) .wg { box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
/* loop 2 (impeccable look-and-fix): a panel is a material, not a flat white - a 3 % fall of the canvas tone down its face (the home widgets keep their own tints) */
:host(sw-card), :host(sw-kpi), :host(sw-table), :host(devices-building) section.fcard, :host(devices-building) nav.tree { background: linear-gradient(180deg, var(--sw-surface) 0%, color-mix(in srgb, var(--sw-surface) 96%, var(--sw-bg)) 100%); }
:host(sw-card[interactive]:hover), :host(sw-kpi[interactive]:hover) { box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); transform: translateY(var(--sw-hover-lift)); }
:host(sw-card) h3 { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); letter-spacing: -0.01em; }
/* classic 3 - the counters: a display numeral (24 px / 800, tight), a 12 px medium label, the icon in a 34 px tile with a soft gradient and ring */
:host(sw-kpi) { --sw-kpi-compact-value-fs: 24px; --sw-kpi-compact-icon: 34px; gap: 6px; }
:host(sw-kpi) .value { font-weight: 800; letter-spacing: -0.03em; }
:host(sw-kpi) .label { font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium); letter-spacing: 0.01em; }
:host(sw-kpi) .icon { border-radius: var(--sw-r-sm); background: linear-gradient(160deg, color-mix(in srgb, var(--sw-accent-soft) 70%, var(--sw-surface)), var(--sw-accent-soft)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 16%, transparent), inset 0 1px 0 var(--sw-highlight); }
/* classic 4 - the segmented control: a well with a raised white key; the switch: a well, the "on" track a gradient of the accent */
:host(sw-tabs[data-variant='pill']) .row::before { background: var(--sw-surface-3); box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.08); }
:host(sw-tabs[data-variant='pill']) .on .lbl { font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-thumb), inset 0 1px 0 var(--sw-highlight); }
:host(sw-toggle) button { box-shadow: inset 0 1px 3px rgba(16, 24, 40, 0.16); }
:host(sw-toggle[checked]) button { background: linear-gradient(180deg, color-mix(in srgb, var(--sw-toggle-on) 86%, #ffffff), var(--sw-toggle-on)); box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18); }
/* classic 5 - fields sit in a shallow well; focus is a 4 px halo of the accent */
::slotted(input:not([type='checkbox']):not([type='radio']):not([type='range'])), ::slotted(select), ::slotted(textarea) { border-radius: var(--sw-r-sm); box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.06); }
::slotted(input:focus), ::slotted(select:focus), ::slotted(textarea:focus) { box-shadow: 0 0 0 4px color-mix(in srgb, var(--sw-accent) 18%, transparent); }
/* classic 6 - floating layers: a hairline, the light edge and the ladder's top step on the dialog and the drawer */
:host(sw-dialog) .box { border: 1px solid var(--sw-border); border-radius: var(--sw-r-xl); box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
:host(sw-drawer) .panel { box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
/* classic 7 - the rail sits on the canvas; the current area is a raised white key (the segmented thumb's material), its label a step heavier */
:host(sw-app) nav.rail.rail { background: transparent; border-inline-end-color: transparent; }
:host(sw-app) a.item.active { background: var(--sw-surface); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
:host(sw-app) a.item.a { font-size: var(--nav-label, 11px); }
:host(sw-app) a.item.a.active { font-weight: var(--sw-fw-bold); }
/* classic 8 - tables: a quiet caption row, tabular figures, a hairline under the header a step stronger than the row rules */
:host(sw-table) th { font-weight: var(--sw-fw-bold); letter-spacing: 0.02em; color: var(--sw-text-2); border-block-end-color: var(--sw-border-strong); }
:host(sw-table) td { font-variant-numeric: tabular-nums; }
/* classic 9 - a status badge is a filled pill with its own ink ring (was a bare soft fill; outline was weak at 11 px) */
:host(sw-badge) { font-weight: var(--sw-fw-semibold); padding-inline: 9px; box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent); }
/* classic 10 - the home clock is a display reading (a medium weight, tight), the dates under it a step heavier; the widget header a step bolder */
:host(home-widgets) .hm { font-weight: 600; letter-spacing: -0.045em; }
:host(home-widgets) .hm b { opacity: 0.4; }
:host(home-widgets) .d1 { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
:host(home-widgets) .wg-h { font-weight: var(--sw-fw-bold); }
/* classic 11 - empty / loading: the quiet 48 px icon tile gets a soft gradient and the light edge; the heading one step larger and bolder */
:host(sw-state-panel[state='empty']) .icon, :host(sw-state-panel[state='loading']) .icon { border-radius: var(--sw-r-sm); background: linear-gradient(160deg, var(--sw-surface-2), var(--sw-surface-3)); box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border); }
:host(sw-state-panel) h4 { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); }
/* classic 12 - the sign-in: the card is the one floating object (top step of the ladder, rounder), a display title, the key as everywhere */
:host(arx-login) .card { border-radius: var(--sw-r-xl); padding: 32px 28px 24px; box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
:host(arx-login) h1 { font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; }
:host(arx-login) input { border-radius: var(--sw-r-sm); box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.06); }
:host(arx-login) button:not(.link):not(.mode):not(.secondary) { border-radius: var(--sw-r-sm); background: linear-gradient(180deg, color-mix(in srgb, var(--sw-accent) 86%, #ffffff), var(--sw-accent-hover)); box-shadow: var(--sw-shadow-primary), inset 0 1px 0 rgba(255, 255, 255, 0.28); }
${ENTER_RULES}`;

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
