import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { ENTER_RULES, POLISH_MOTION_TOKENS } from './polish-motion';

/**
 * Skin "hi-tech Domus": coloured canvas with a warm and a cool bloom, three glass levels, big titles, round shapes. Values from the
 * approved package.
 *
 * POLISH-BOLD-297 (P7, owner 2026-10-27 late): the glass is now a MATERIAL the eye can see in a still - the panels are more opaque
 * (.70 light / .80 dark) so they float off the canvas instead of melting into it, the sheen catches the top third, the ladder of
 * shadows is real, the canvas base one tone deeper (the blooms keep the UXFIX-A11Y-295 alphas: text on a bloom centre still reads at
 * >= 4.5:1, tests/unit-muted-contrast), the type scale carries a display tier (48 px title, 24 px counters, 13.5 px body), the keys
 * (buttons, chips, the segmented thumb) are raised with the bevel finished, radii one step rounder, controls +2/+4 px, the entrance
 * choreography of polish-motion.ts. The rule block was re-cut to stay inside the 50-rule budget (define.ts): the same selectors,
 * merged. Skills: impeccable bolder, apple-design (materials, depth, vibrancy over glass: heavier ink, no flat grey), taste-skill
 * (its "no glass / no gradient / no shadow" page rules are REJECTED here by the approved Domus package - recorded in the P7 report),
 * emil-design-eng, ui-ux-pro-max.
 */
const tokens: TokenTable = {
  '--sw-bg': lt('#d3dcec', '#0a0e16'),
  // UXFIX-A11Y-295 (owner 2026-10-20, option A): the light blooms are softened - the warm one rgba(255,168,60,.62) -> rgba(255,193,117,.5), the
  // cool one rgba(72,124,255,.58) -> rgba(178,200,255,.46) - so text drawn straight on a bloom centre reads at >= 4.5:1 (was 2.85-3.99:1;
  // tests/unit-muted-contrast.spec.ts). POLISH-BOLD-297: the alphas stay; the BASE under them is one tone deeper so the glass panels lift.
  '--sw-canvas': lt('radial-gradient(1100px 680px at 90% -8%, rgba(255,193,117,.5), transparent 62%), radial-gradient(1300px 820px at 4% 108%, rgba(178,200,255,.46), transparent 64%), radial-gradient(820px 560px at 52% 50%, rgba(255,255,255,.34), transparent 70%), linear-gradient(170deg, #dde4f1 0%, #ccd6e9 55%, #d3dbec 100%)', 'radial-gradient(900px 560px at 92% -6%, rgba(255,150,40,.2), transparent 62%), radial-gradient(1100px 700px at 4% 104%, rgba(80,140,255,.28), transparent 64%), linear-gradient(180deg, #0f1521 0%, #090c13 100%)'),
  '--sw-surface': lt('rgba(255,255,255,.70)', 'rgba(24,30,44,.80)'),
  '--sw-surface-2': lt('rgba(255,255,255,.84)', 'rgba(255,255,255,.07)'),
  '--sw-surface-3': lt('rgba(20,30,50,.10)', 'rgba(255,255,255,.11)'),
  '--sw-surface-solid': lt('#fbfcfe', '#171d29'),
  '--sw-surface-2-solid': lt('#ffffff', '#1f2634'),
  '--sw-surface-3-solid': lt('#e3e8f1', '#293246'),
  // a menu is opaque (owner 2026-10-13): the solid twin, and the skin's ink hairline (12 % light / 10 % white dark) flattened over it
  '--sw-menu-surface': lt('#fbfcfe', '#171d29'),
  '--sw-menu-border': lt('#dfe1e6', '#2f3542'),
  '--sw-border': lt('rgba(255,255,255,.95)', 'rgba(255,255,255,.14)'),
  '--sw-border-strong': lt('rgba(20,30,50,.24)', 'rgba(255,255,255,.22)'),
  '--sw-highlight': lt('rgba(255,255,255,1)', 'rgba(255,255,255,.14)'),
  '--sw-overlay': lt('rgba(10,16,30,.44)', 'rgba(0,0,0,.64)'),
  '--sw-text': lt('#172033', '#eef2f8'),
  '--sw-heading': lt('#0c1322', '#ffffff'),
  '--sw-text-2': lt('#3f4c63', '#aab5c9'),
  // POLISH-BOLD-297 (apple-design "vibrancy": heavier ink over glass): the muted inks a step darker in light, a step lighter in dark, so the
  // deeper canvas base keeps every one at >= 4.5:1 on the bloom centres (unit-muted-contrast)
  '--sw-text-3': lt('#48546a', '#95a3ba'),
  '--sw-text-inverse': lt('#ffffff', '#0c1018'),
  '--sw-accent': lt('#2458e6', '#6ea2ff'),
  '--sw-accent-hover': lt('#1b48cc', '#8ab5ff'),
  '--sw-accent-soft': lt('rgba(36,88,230,.14)', 'rgba(110,162,255,.2)'),
  '--sw-accent-text': lt('#1847c2', '#8fb8ff'),
  '--sw-focus': lt('#2458e6', '#7fb0ff'),
  '--sw-nav': lt('#2458e6', '#6ea2ff'),
  '--sw-live': lt('#1f9d55', '#3ddc84'),
  '--sw-live-soft': lt('rgba(31,157,85,.14)', 'rgba(61,220,132,.20)'),
  '--sw-recorded': lt('#2458e6', '#6ea2ff'),
  '--sw-recorded-soft': lt('rgba(36,88,230,.12)', 'rgba(110,162,255,.20)'),
  '--sw-offline': lt('#7c879a', '#8b96a8'),
  '--sw-offline-soft': lt('rgba(124,135,154,.14)', 'rgba(139,150,168,.20)'),
  '--sw-stale': lt('#bf7506', '#f5b043'),
  '--sw-stale-soft': lt('rgba(217,138,11,.15)', 'rgba(245,176,67,.20)'),
  '--sw-unknown': lt('#aab3c2', '#6b7686'),
  '--sw-unknown-soft': lt('rgba(170,179,194,.16)', 'rgba(107,118,134,.22)'),
  '--sw-danger': lt('#d93838', '#ff6b62'),
  '--sw-danger-soft': lt('rgba(217,56,56,.12)', 'rgba(255,107,98,.20)'),
  '--sw-warning': lt('#bf7506', '#f5b043'),
  '--sw-warning-soft': lt('rgba(217,138,11,.15)', 'rgba(245,176,67,.20)'),
  '--sw-success': lt('#1f9d55', '#3ddc84'),
  '--sw-success-soft': lt('rgba(31,157,85,.14)', 'rgba(61,220,132,.20)'),
  '--sw-forbidden': lt('#c81e1e', '#ff7a70'),
  '--sw-forbidden-soft': lt('rgba(200,30,30,.12)', 'rgba(255,122,112,.20)'),
  '--sw-purple': lt('#7c5cf0', '#a78bfa'),
  '--sw-live-text': lt('#14703c', '#3ddc84'),
  '--sw-recorded-text': lt('#1d51d2', '#8fb8ff'),
  '--sw-offline-text': lt('#475164', '#b4bdcc'),
  '--sw-stale-text': lt('#7a4c00', '#f5b043'),
  '--sw-unknown-text': lt('#475268', '#aab5c9'),
  '--sw-danger-text': lt('#a82525', '#ff857d'), // POLISH-BOLD-297: the more opaque dark glass put the coral at 4.49:1 on its soft fill
  '--sw-warning-text': lt('#7a4c00', '#f5b043'),
  '--sw-success-text': lt('#105e32', '#3ddc84'),
  '--sw-forbidden-text': lt('#a51818', '#ff7a70'),
  '--sw-toggle-on': lt('#22a55b', '#34c76a'),
  '--sw-map-bg': lt('#f4f6fa', '#0f141d'),
  '--sw-map-wall': lt('#b9c3d3', '#4a5568'),
  '--sw-map-furniture': lt('#e7ecf4', '#1f2736'),
  '--sw-map-furniture-line': lt('#cfd7e3', '#3a4457'),
  '--sw-map-structure': lt('#4f5b73', '#9aa6bb'),
  '--sw-map-candidate': lt('#2458e6', '#6ea2ff'),
  '--sw-map-label': lt('#5f6c82', '#8391a8'),
  '--sw-map-presence': lt('#2458e6', '#6ea2ff'),
  '--sw-fov': lt('rgba(36,88,230,.12)', 'rgba(110,162,255,.16)'),
  '--sw-obj-light': lt('#e5a52a', '#f2b544'),
  '--sw-obj-electrical': lt('#d9712a', '#f08a45'),
  '--sw-obj-safety': lt('#d94039', '#ff6b62'),
  '--sw-obj-medical': lt('#2c9ba6', '#4fc3ce'),
  '--sw-obj-sport': lt('#3a9a55', '#5cc47a'),
  '--sw-obj-sanitary': lt('#4f8fd0', '#7fb2ff'),
  '--sw-obj-security': lt('#7457c2', '#a78bfa'),
  '--sw-obj-outdoor': lt('#55964a', '#7cc26e'),
  '--sw-circuit-1': lt('#2458e6', '#6ea2ff'),
  '--sw-circuit-2': lt('#d98a0b', '#f5b043'),
  '--sw-circuit-3': lt('#1f9d55', '#3ddc84'),
  '--sw-circuit-4': lt('#9a55f0', '#c084fc'),
  '--sw-circuit-5': lt('#d93838', '#ff6b62'),
  '--sw-circuit-6': lt('#12a39a', '#2dd4bf'),
  // the type scale: a display tier (title 48, counters 24), 13.5 px body, the label floor 11 px (POLISH-CLASSIC-DOMUS-297 audit finding 8)
  '--sw-fs-2xs': same('11px'),
  '--sw-fs-xs': same('12px'),
  '--sw-fs-sm': same('13px'),
  '--sw-fs-base': same('13.5px'),
  '--sw-fs-md': same('14.5px'),
  '--sw-fs-lg': same('16px'),
  '--sw-fs-xl': same('19px'),
  '--sw-fs-2xl': same('24px'),
  '--sw-fs-3xl': same('32px'),
  '--sw-lh': same('1.45'),
  '--sw-h1': same('48px'),
  '--sw-h1-weight': same('800'),
  '--sw-h1-tracking': same('-1.4px'),
  '--sw-h1-phone': same('26px'),
  '--sw-page-pad': same('28px'),
  '--sw-r-2xs': same('6px'),
  '--sw-r-xs': same('9px'),
  '--sw-r-sm': same('12px'),
  '--sw-r-md': same('20px'),
  '--sw-r-lg': same('26px'),
  '--sw-r-xl': same('30px'),
  '--sw-r-2xl': same('34px'),
  '--sw-ctl-h-sm': same('28px'),
  '--sw-ctl-h-md': same('34px'),
  '--sw-ctl-h-lg': same('40px'),
  '--sw-hover-wash': lt('rgba(255,255,255,.4)', 'rgba(255,255,255,.08)'),
  '--sw-pressed-wash': lt('rgba(20,30,50,.08)', 'rgba(255,255,255,.12)'),
  '--sw-skeleton': lt('rgba(20,30,50,.08)', 'rgba(255,255,255,.08)'),
  '--sw-shadow-primary': lt('0 1px 2px rgba(27,72,204,.4), 0 8px 20px -4px rgba(36,88,230,.5)', '0 1px 2px rgba(0,0,0,.5), 0 8px 20px -4px rgba(110,162,255,.35)'),
  '--sw-on-image-bg': lt('rgba(255,255,255,.9)', 'rgba(24,30,44,.88)'),
  // the ladder of a floating glass object: a contact line, an ambient halo, a long soft cast
  '--sw-shadow-1': lt('0 1px 2px rgba(15,23,42,.06), 0 4px 10px -2px rgba(15,23,42,.06), 0 16px 36px -10px rgba(15,23,42,.16)', '0 1px 2px rgba(0,0,0,.45), 0 4px 10px -2px rgba(0,0,0,.35), 0 18px 40px -10px rgba(0,0,0,.65)'),
  '--sw-shadow-2': lt('0 2px 6px rgba(15,23,42,.07), 0 12px 24px -6px rgba(15,23,42,.12), 0 32px 64px -16px rgba(15,23,42,.24)', '0 2px 6px rgba(0,0,0,.45), 0 14px 28px -6px rgba(0,0,0,.5), 0 36px 72px -16px rgba(0,0,0,.75)'),
  '--sw-shadow-3': lt('0 8px 20px rgba(15,23,42,.1), 0 28px 60px -10px rgba(15,23,42,.24), 0 64px 120px -24px rgba(15,23,42,.36)', '0 8px 20px rgba(0,0,0,.5), 0 30px 70px -10px rgba(0,0,0,.7), 0 70px 130px -24px rgba(0,0,0,.85)'),
  '--sw-shadow-thumb': lt('0 1px 3px rgba(0,0,0,.2), 0 4px 10px -2px rgba(0,0,0,.14), 0 0 0 .5px rgba(0,0,0,.06)', '0 1px 3px rgba(0,0,0,.5), 0 4px 10px -2px rgba(0,0,0,.5), 0 0 0 .5px rgba(0,0,0,.4)'),
  '--sw-glass-blur': same('blur(28px) saturate(1.7)'),
  '--sw-glass-blur-nav': same('blur(22px) saturate(1.6)'),
  '--sw-glass-blur-sheet': same('blur(36px) saturate(1.7)'),
  // the sheen: light caught on the top third of the glass (was a 46 % fade of a 55 % white - invisible over an opaque-ish panel)
  '--sw-glass-sheen': lt('linear-gradient(180deg, rgba(255,255,255,.8), rgba(255,255,255,.2) 38%, rgba(255,255,255,0) 72%)', 'linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.03) 40%, rgba(255,255,255,0) 72%)'),
  '--sw-t-med': same('220ms'),
  '--sw-ease': same('cubic-bezier(.2, 0, 0, 1)'),
  // POLISH-CLASSIC-DOMUS-297 (impeccable detector "bounce easing"; apple-design: a sheet lands critically damped): the switch now rides
  // --sw-spring-toggle, so this curve only drives the phone sheet's rise - the iOS drawer curve, no overshoot
  '--sw-ease-thumb': same('cubic-bezier(0.32, 0.72, 0, 1)'),
  '--sw-hover-lift': same('-3px'),
  // POLISH-CLASSIC-DOMUS-297: press feedback, the switch spring and the dialog landing (polish-motion.ts); the domus 220 ms stays
  ...POLISH_MOTION_TOKENS,
};

const rules = `
/* domus 1 - the canvas: warm and cool blooms the glass sits on */
:host(sw-app) { background: var(--sw-canvas); }
/* domus 2 - the rail is a floating glass panel 12px off the edges; the brand tile; the floating corner pill; the phone dock */
:host(sw-app) nav.rail.rail { margin-block: 12px; margin-inline-start: 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-xl); background: var(--sw-glass-sheen), var(--sw-surface); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
:host(sw-app) .brand-tile { background: linear-gradient(145deg, var(--sw-accent), var(--sw-accent-hover)); border-radius: var(--sw-r-sm); box-shadow: var(--sw-shadow-primary), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
:host(sw-app) a.item.a { border-radius: var(--sw-r-md); font-size: var(--nav-label, 11px); }
:host(sw-app) a.item.active { background: var(--sw-surface-2); box-shadow: var(--sw-shadow-thumb), inset 0 1px 0 var(--sw-highlight); font-weight: var(--sw-fw-bold); }
:host(sw-app) .float .pillrow { background: var(--sw-glass-sheen), var(--sw-surface); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
/* domus 2b - the search panel hangs over the page like a menu: opaque, nothing blurred behind it (owner 2026-10-13); the corner pill above keeps its glass */
:host(sw-app) .searchpanel { background: var(--sw-glass-sheen), var(--sw-menu-surface); -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: var(--sw-shadow-2); }
:host(sw-app) nav.bottom.bottom { background: var(--sw-glass-sheen), var(--sw-surface); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); border-block-start: 1px solid var(--sw-border); box-shadow: none; }
/* domus 3 - glass panels: cards, KPI tiles, tables, the home widgets, the floor cards, area tiles and the building tree; a hovered interactive panel lifts */
:host(sw-card), :host(sw-kpi), :host(sw-table), :host(devices-building) section.fcard, :host(devices-building) a.tile, :host(devices-building) nav.tree, :host(home-widgets) .wg { background: var(--sw-glass-sheen), var(--sw-surface); border-color: var(--sw-border); -webkit-backdrop-filter: var(--sw-glass-blur); backdrop-filter: var(--sw-glass-blur); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-card[interactive]:hover), :host(sw-kpi[interactive]:hover), :host(devices-building) a.tile:hover { box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); transform: translateY(var(--sw-hover-lift)); }
:host(sw-card) h3, :host(sw-state-panel) h4 { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); letter-spacing: -0.01em; }
/* domus 4 - the counters: a display numeral, the icon in a 34 px glass tile ringed by the accent */
:host(sw-kpi) { --sw-kpi-compact-value-fs: 24px; --sw-kpi-compact-icon: 34px; gap: 6px; }
:host(sw-kpi) .value { font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
:host(sw-kpi) .icon { border-radius: var(--sw-r-xs); background: linear-gradient(160deg, rgba(255, 255, 255, 0.7), var(--sw-accent-soft)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 18%, transparent), inset 0 1px 0 var(--sw-highlight); }
/* domus 5 - the building tree stays prominent: a taller panel, pill rows, the selected row filled */
:host(devices-building) nav.tree { border-radius: var(--sw-r-lg); padding: 10px; gap: 3px; }
:host(devices-building) .tree-row { border-radius: var(--sw-r-pill); padding-block: 8px; }
:host(devices-building) .tree-row.selected { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
/* domus 6 - keys: round, raised (a vertical gradient, the light top edge, the dark lower edge of the bevel), pressed = sunk; pill chips */
:host(sw-button) button { border-radius: var(--sw-r-sm); background: linear-gradient(180deg, var(--sw-surface-2-solid), var(--sw-surface-solid)) var(--sw-surface-solid); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight), inset 0 -1px 0 rgba(15, 23, 42, 0.07); }
:host(sw-chip) button { border-radius: var(--sw-r-pill); background: linear-gradient(180deg, var(--sw-surface-2-solid), var(--sw-surface-solid)) var(--sw-surface-solid); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight), inset 0 -1px 0 rgba(15, 23, 42, 0.07); }
:host(sw-button[variant='primary']) button, :host(sw-chip[selected]) button { background: linear-gradient(180deg, color-mix(in srgb, var(--sw-accent) 84%, #ffffff), var(--sw-accent-hover)) var(--sw-accent-hover); border-color: var(--sw-accent-hover); box-shadow: var(--sw-shadow-primary), inset 0 1px 0 rgba(255, 255, 255, 0.32), inset 0 -1px 0 rgba(0, 0, 0, 0.14); }
:host(sw-button[variant='ghost']) button { background: transparent; box-shadow: none; }
:host(sw-button) button:active:not(:disabled), :host(sw-chip) button:active:not(:disabled) { background: var(--sw-surface-3-solid); box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.16); }
:host(sw-button[variant='primary']) button:active:not(:disabled), :host(sw-chip[selected]) button:active:not(:disabled) { background: var(--sw-accent-hover); box-shadow: 0 2px 6px color-mix(in srgb, var(--sw-accent) 24%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.24); }
@media (hover: hover) and (pointer: fine) { :host(sw-button:not([variant='ghost'])) button:hover:not(:disabled), :host(sw-chip) button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); } }
/* domus 7 - fields: a soft well at rest, a glow of the accent on focus */
::slotted(input), ::slotted(select), ::slotted(textarea) { background: var(--sw-surface-2-solid); border-color: var(--sw-border-strong); border-radius: var(--sw-r-sm); box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.06); }
::slotted(input:focus), ::slotted(select:focus), ::slotted(textarea:focus) { box-shadow: 0 0 0 4px color-mix(in srgb, var(--sw-accent) 20%, transparent); }
/* domus 8 - the switch (a well; "on" a gradient of the green) and the segmented / tab rails (a well with a raised white key) */
:host(sw-toggle) button { box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.18); }
:host(sw-toggle[checked]) button { background: linear-gradient(180deg, color-mix(in srgb, var(--sw-toggle-on) 84%, #ffffff), var(--sw-toggle-on)); }
:host(sw-tabs[data-variant='pill']) .row::before { border-radius: var(--sw-r-pill); background: var(--sw-surface-3); box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08); }
:host(sw-tabs[data-variant='pill']) .lbl { border-radius: var(--sw-r-pill); }
:host(sw-tabs[data-variant='pill']) .on .lbl { background: var(--sw-surface-solid); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-thumb), inset 0 1px 0 var(--sw-highlight); }
/* domus 9 - floating layers: the dialog and the drawer carry the glass edge over the ladder's top step; a popover is a menu (owner 2026-10-13): fully opaque, no blur */
:host(sw-dialog) .box, :host(sw-drawer) .panel { background: var(--sw-glass-sheen), var(--sw-surface-solid); border: 1px solid var(--sw-border); -webkit-backdrop-filter: var(--sw-glass-blur-sheet); backdrop-filter: var(--sw-glass-blur-sheet); box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
:host(sw-dialog) .box { border-radius: var(--sw-r-xl); }
/* domus 10 - tables: hairline rows, a soft hover, a quiet caption row, tabular figures; a status badge is a filled pill with its ink ring */
:host(sw-table) tbody tr:hover { background: var(--sw-surface-3); }
:host(sw-table) th { font-weight: var(--sw-fw-bold); letter-spacing: 0.02em; color: var(--sw-text-2); }
:host(sw-table) td { font-variant-numeric: tabular-nums; }
:host(sw-badge) { font-weight: var(--sw-fw-semibold); padding-inline: 9px; box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent); }
/* domus 11 - the settings navigation column: pill links, the current one lifted like a tab */
:host(system-nav) a { border-radius: var(--sw-r-pill); }
:host(system-nav) a[aria-current='page'] { background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-thumb); }
/* domus 12 - the home clock is a display reading; empty / loading / error icons in a glass tile; the sign-in card is the one floating object */
:host(home-widgets) .hm { font-weight: 600; letter-spacing: -0.045em; }
:host(home-widgets) .d1 { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
:host(sw-state-panel[state='empty']) .icon, :host(sw-state-panel[state='loading']) .icon { border-radius: var(--sw-r-sm); background: var(--sw-glass-sheen), var(--sw-surface-3); box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border); }
:host(arx-login) .card { border-radius: var(--sw-r-xl); padding: 32px 28px 24px; background: var(--sw-glass-sheen), var(--sw-surface-solid); box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
:host(arx-login) h1 { font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; }
:host(arx-login) button:not(.link):not(.mode):not(.secondary) { border-radius: var(--sw-r-sm); background: linear-gradient(180deg, color-mix(in srgb, var(--sw-accent) 84%, #ffffff), var(--sw-accent-hover)); box-shadow: var(--sw-shadow-primary), inset 0 1px 0 rgba(255, 255, 255, 0.32); }
${ENTER_RULES}`;

export const domus: Skin = { id: 'domus', name: 'hi-tech Domus', nameHe: 'הייטק Domus', noteHe: 'זכוכית על רקע צבעוני, פינות עגולות, כותרות גדולות', stage: 'stable', features: { material: true, bevel: true, pixelEdge: true, glass: true }, tokens, rules };
