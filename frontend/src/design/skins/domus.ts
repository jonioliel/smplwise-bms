import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { POLISH_MOTION_TOKENS } from './polish-motion';

/** Skin "hi-tech Domus": coloured canvas with a warm and a cool bloom, three glass levels, big titles, round shapes. Values from the approved package. */
const tokens: TokenTable = {
  '--sw-bg': lt('#d9e1f0', '#0c1018'),
  // UXFIX-A11Y-295 (owner 2026-10-20, option A): the light blooms are softened - the warm one rgba(255,168,60,.62) -> rgba(255,193,117,.5), the
  // cool one rgba(72,124,255,.58) -> rgba(178,200,255,.46) - so text drawn straight on a bloom centre reads at >= 4.5:1 (was 2.85-3.99:1;
  // tests/unit-muted-contrast.spec.ts). The dark blooms already pass and are unchanged.
  '--sw-canvas': lt('radial-gradient(1100px 680px at 90% -8%, rgba(255,193,117,.5), transparent 62%), radial-gradient(1300px 820px at 4% 108%, rgba(178,200,255,.46), transparent 64%), radial-gradient(820px 560px at 52% 50%, rgba(255,255,255,.42), transparent 70%), linear-gradient(170deg, #e4e9f4 0%, #d6dfef 55%, #dce1ee 100%)', 'radial-gradient(900px 560px at 92% -6%, rgba(255,150,40,.16), transparent 62%), radial-gradient(1100px 700px at 4% 104%, rgba(80,140,255,.22), transparent 64%), linear-gradient(180deg, #0e131c 0%, #0a0d14 100%)'),
  '--sw-surface': lt('rgba(255,255,255,.52)', 'rgba(22,27,38,.66)'),
  '--sw-surface-2': lt('rgba(255,255,255,.66)', 'rgba(255,255,255,.06)'),
  '--sw-surface-3': lt('rgba(20,30,50,.08)', 'rgba(255,255,255,.09)'),
  '--sw-surface-solid': lt('#fbfcfe', '#161b26'),
  '--sw-surface-2-solid': lt('#ffffff', '#1e2432'),
  '--sw-surface-3-solid': lt('#e3e8f1', '#273043'),
  // a menu is opaque (owner 2026-10-13): the solid twin, and the skin's ink hairline (12 % light / 10 % white dark) flattened over it
  '--sw-menu-surface': lt('#fbfcfe', '#161b26'),
  '--sw-menu-border': lt('#dfe1e6', '#2d323c'),
  '--sw-border': lt('rgba(255,255,255,.72)', 'rgba(255,255,255,.10)'),
  '--sw-border-strong': lt('rgba(20,30,50,.20)', 'rgba(255,255,255,.18)'),
  '--sw-highlight': lt('rgba(255,255,255,.95)', 'rgba(255,255,255,.10)'),
  '--sw-overlay': lt('rgba(10,16,30,.40)', 'rgba(0,0,0,.60)'),
  '--sw-text': lt('#172033', '#eef2f8'),
  '--sw-heading': lt('#0f1727', '#ffffff'),
  '--sw-text-2': lt('#3f4c63', '#aab5c9'),
  '--sw-text-3': lt('#4f5b70', '#8998af'),
  '--sw-text-inverse': lt('#ffffff', '#0c1018'),
  '--sw-accent': lt('#2a63f0', '#6ea2ff'),
  '--sw-accent-hover': lt('#1f52d6', '#8ab5ff'),
  '--sw-accent-soft': lt('rgba(42,99,240,.12)', 'rgba(110,162,255,.18)'),
  '--sw-accent-text': lt('#1c4fce', '#8fb8ff'),
  '--sw-focus': lt('#2a63f0', '#7fb0ff'),
  '--sw-nav': lt('#2a63f0', '#6ea2ff'),
  '--sw-live': lt('#1f9d55', '#3ddc84'),
  '--sw-live-soft': lt('rgba(31,157,85,.14)', 'rgba(61,220,132,.20)'),
  '--sw-recorded': lt('#2a63f0', '#6ea2ff'),
  '--sw-recorded-soft': lt('rgba(42,99,240,.12)', 'rgba(110,162,255,.20)'),
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
  '--sw-offline-text': lt('#4f5a6d', '#b4bdcc'),
  '--sw-stale-text': lt('#7a4c00', '#f5b043'),
  '--sw-unknown-text': lt('#4f5b72', '#aab5c9'),
  '--sw-danger-text': lt('#a82525', '#ff6b62'),
  '--sw-warning-text': lt('#7a4c00', '#f5b043'),
  '--sw-success-text': lt('#136838', '#3ddc84'),
  '--sw-forbidden-text': lt('#a51818', '#ff7a70'),
  '--sw-toggle-on': lt('#22a55b', '#34c76a'),
  '--sw-map-bg': lt('#f4f6fa', '#0f141d'),
  '--sw-map-wall': lt('#b9c3d3', '#4a5568'),
  '--sw-map-furniture': lt('#e7ecf4', '#1f2736'),
  '--sw-map-furniture-line': lt('#cfd7e3', '#3a4457'),
  '--sw-map-structure': lt('#4f5b73', '#9aa6bb'),
  '--sw-map-candidate': lt('#2a63f0', '#6ea2ff'),
  '--sw-map-label': lt('#5f6c82', '#8391a8'),
  '--sw-map-presence': lt('#2a63f0', '#6ea2ff'),
  '--sw-fov': lt('rgba(42,99,240,.12)', 'rgba(110,162,255,.16)'),
  '--sw-obj-light': lt('#e5a52a', '#f2b544'),
  '--sw-obj-electrical': lt('#d9712a', '#f08a45'),
  '--sw-obj-safety': lt('#d94039', '#ff6b62'),
  '--sw-obj-medical': lt('#2c9ba6', '#4fc3ce'),
  '--sw-obj-sport': lt('#3a9a55', '#5cc47a'),
  '--sw-obj-sanitary': lt('#4f8fd0', '#7fb2ff'),
  '--sw-obj-security': lt('#7457c2', '#a78bfa'),
  '--sw-obj-outdoor': lt('#55964a', '#7cc26e'),
  '--sw-circuit-1': lt('#2a63f0', '#6ea2ff'),
  '--sw-circuit-2': lt('#d98a0b', '#f5b043'),
  '--sw-circuit-3': lt('#1f9d55', '#3ddc84'),
  '--sw-circuit-4': lt('#9a55f0', '#c084fc'),
  '--sw-circuit-5': lt('#d93838', '#ff6b62'),
  '--sw-circuit-6': lt('#12a39a', '#2dd4bf'),
  // POLISH-CLASSIC-DOMUS-297 (audit finding 8, taste-skill type floor): the smallest tier was 10.5 px, under the 11 px label floor
  '--sw-fs-2xs': same('11px'),
  '--sw-fs-xs': same('12px'),
  '--sw-fs-base': same('13.5px'),
  '--sw-fs-lg': same('15.5px'),
  '--sw-fs-2xl': same('21px'),
  '--sw-lh': same('1.45'),
  '--sw-h1': same('44px'),
  '--sw-h1-tracking': same('-1px'),
  '--sw-page-pad': same('28px'),
  '--sw-r-2xs': same('5px'),
  '--sw-r-xs': same('8px'),
  '--sw-r-sm': same('10px'),
  '--sw-r-md': same('16px'),
  '--sw-r-lg': same('24px'),
  '--sw-r-xl': same('28px'),
  '--sw-r-2xl': same('32px'),
  '--sw-hover-wash': lt('rgba(255,255,255,.35)', 'rgba(255,255,255,.07)'),
  '--sw-pressed-wash': lt('rgba(20,30,50,.08)', 'rgba(255,255,255,.12)'),
  '--sw-skeleton': lt('rgba(20,30,50,.08)', 'rgba(255,255,255,.08)'),
  '--sw-shadow-primary': lt('0 6px 16px rgba(42,99,240,.30)', '0 6px 16px rgba(0,0,0,.45)'),
  '--sw-on-image-bg': lt('rgba(255,255,255,.88)', 'rgba(22,27,38,.86)'),
  '--sw-shadow-1': lt('0 1px 2px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06)', '0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.45)'),
  '--sw-shadow-2': lt('0 2px 6px rgba(15,23,42,.06), 0 16px 40px rgba(15,23,42,.12)', '0 2px 6px rgba(0,0,0,.4), 0 20px 50px rgba(0,0,0,.55)'),
  '--sw-shadow-3': lt('0 8px 20px rgba(15,23,42,.10), 0 28px 70px rgba(15,23,42,.22)', '0 8px 20px rgba(0,0,0,.5), 0 30px 80px rgba(0,0,0,.7)'),
  '--sw-shadow-thumb': lt('0 1px 3px rgba(0,0,0,.20), 0 0 0 .5px rgba(0,0,0,.06)', '0 1px 3px rgba(0,0,0,.45), 0 0 0 .5px rgba(0,0,0,.4)'),
  '--sw-glass-blur': same('blur(24px) saturate(1.6)'),
  '--sw-glass-blur-nav': same('blur(20px) saturate(1.5)'),
  '--sw-glass-blur-sheet': same('blur(32px) saturate(1.6)'),
  '--sw-glass-sheen': lt('linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.08) 46%)', 'linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,0) 46%)'),
  '--sw-t-med': same('220ms'),
  '--sw-ease': same('cubic-bezier(.2, 0, 0, 1)'),
  // POLISH-CLASSIC-DOMUS-297 (impeccable detector "bounce easing"; apple-design: a sheet lands critically damped): the switch now rides
  // --sw-spring-toggle, so this curve only drives the phone sheet's rise - the iOS drawer curve, no overshoot
  '--sw-ease-thumb': same('cubic-bezier(0.32, 0.72, 0, 1)'),
  '--sw-hover-lift': same('-2px'),
  // POLISH-CLASSIC-DOMUS-297: press feedback, the switch spring and the dialog landing (polish-motion.ts); the domus 220 ms stays
  ...POLISH_MOTION_TOKENS,
};

const rules = `
/* domus 1 - the canvas: warm and cool blooms the glass sits on */
:host(sw-app) { background: var(--sw-canvas); }
/* domus 2 - the rail is a floating glass panel 12px off the edges */
:host(sw-app) nav.rail.rail { margin-block: 12px; margin-inline-start: 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-xl); background: var(--sw-glass-sheen), var(--sw-surface); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
/* domus 3 - brand tile, rail items and the floating corner */
:host(sw-app) .brand-tile { background: linear-gradient(145deg, var(--sw-accent), var(--sw-accent-hover)); border-radius: var(--sw-r-sm); }
:host(sw-app) a.item.a { border-radius: var(--sw-r-md); }
:host(sw-app) .float .pillrow { background: var(--sw-glass-sheen), var(--sw-surface); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: var(--sw-shadow-2); }
/* domus 3b - the search panel hangs over the page like a menu: opaque, nothing blurred behind it (owner 2026-10-13); the corner pill above keeps its glass */
:host(sw-app) .searchpanel { background: var(--sw-glass-sheen), var(--sw-menu-surface); -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: var(--sw-shadow-2); }
:host(sw-app) nav.bottom.bottom { background: var(--sw-glass-sheen), var(--sw-surface); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); border-block-start: 1px solid var(--sw-border); box-shadow: none; }
/* domus 4 - glass panels: cards, KPI tiles, the home widgets, the floor cards, area tiles and the building tree */
:host(sw-card), :host(sw-kpi), :host(devices-building) section.fcard, :host(devices-building) a.tile, :host(devices-building) nav.tree, :host(home-widgets) .wg { background: var(--sw-glass-sheen), var(--sw-surface); border-color: var(--sw-border); -webkit-backdrop-filter: var(--sw-glass-blur); backdrop-filter: var(--sw-glass-blur); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-card[interactive]:hover), :host(devices-building) a.tile:hover { box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); transform: translateY(var(--sw-hover-lift)); }
/* domus 5 - the building tree stays prominent: a taller panel, pill rows, the selected row filled */
:host(devices-building) nav.tree { border-radius: var(--sw-r-lg); padding: 10px; gap: 3px; }
:host(devices-building) .tree-row { border-radius: var(--sw-r-pill); padding-block: 8px; }
:host(devices-building) .tree-row.selected { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
/* domus 6 - controls: round buttons with an inner highlight, pill chips, soft inputs */
:host(sw-button) button { border-radius: var(--sw-r-sm); min-block-size: 34px; box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-button[variant='primary']) button { box-shadow: 0 6px 16px color-mix(in srgb, var(--sw-accent) 30%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.25); }
:host(sw-button[variant='ghost']) button { box-shadow: none; }
:host(sw-button[size='sm']) button { border-radius: var(--sw-r-sm); min-block-size: 30px; }
:host(sw-chip) button { border-radius: var(--sw-r-pill); }
::slotted(input), ::slotted(select), ::slotted(textarea) { background: var(--sw-surface-2); border-color: var(--sw-border-strong); border-radius: var(--sw-r-sm); }
/* domus 7 - the switch and the segmented / tab rails */
:host(sw-toggle) button::after { box-shadow: var(--sw-shadow-thumb); transition-timing-function: var(--sw-ease-thumb); }
:host(sw-toggle[checked]) button { background: var(--sw-toggle-on); }
:host(sw-tabs[data-variant='pill']) .row::before { border-radius: var(--sw-r-pill); }
:host(sw-tabs[data-variant='pill']) .lbl { border-radius: var(--sw-r-pill); }
:host(sw-tabs[data-variant='pill']) .on .lbl { background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-thumb); }
/* domus 8 - floating layers are opaque enough to read, with a sheet blur behind; a popover is a menu (owner 2026-10-13): fully opaque, no blur */
:host(sw-dialog) .box, :host(sw-drawer) .panel { background: var(--sw-glass-sheen), var(--sw-surface-solid); border-color: var(--sw-border); -webkit-backdrop-filter: var(--sw-glass-blur-sheet); backdrop-filter: var(--sw-glass-blur-sheet); }
:host(sw-popover) { background: var(--sw-glass-sheen), var(--sw-menu-surface); }
:host(sw-dialog) .box { border-radius: var(--sw-r-xl); }
/* domus 9 - tables and list rows: hairline rows, a soft hover */
:host(sw-table) tbody tr:hover { background: var(--sw-surface-3); }
:host(sw-table) th { font-weight: var(--sw-fw-semibold); letter-spacing: 0.02em; }
:host(sw-kpi) .value { font-variant-numeric: tabular-nums; }
:host(sw-page) h1 { font-weight: var(--sw-h1-weight); }
/* domus 10 - the settings navigation column: pill links, the current one lifted like a tab */
:host(system-nav) a { border-radius: var(--sw-r-pill); }
:host(system-nav) a[aria-current='page'] { background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-thumb); }
/* domus 11 (POLISH-CLASSIC-DOMUS-297) - the bevel finished: a lower dark edge under the light top edge, and a press that sinks the key */
:host(sw-button:not([variant='ghost'])) button, :host(sw-chip) button { box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight), inset 0 -1px 0 rgba(15, 23, 42, 0.06); }
:host(sw-button[variant='primary']) button, :host(sw-chip[selected]) button { box-shadow: 0 6px 16px color-mix(in srgb, var(--sw-accent) 30%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -1px 0 rgba(0, 0, 0, 0.12); }
:host(sw-button) button:active:not(:disabled), :host(sw-chip) button:active:not(:disabled) { box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.14); }
:host(sw-button[variant='primary']) button:active:not(:disabled), :host(sw-chip[selected]) button:active:not(:disabled) { box-shadow: 0 2px 6px color-mix(in srgb, var(--sw-accent) 24%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.22); }
/* domus 12 - fields: a soft well at rest, a glow of the accent on focus; the switch track is a well too */
::slotted(input:not([type='checkbox']):not([type='radio']):not([type='range'])), ::slotted(textarea) { box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.06); }
::slotted(input:focus), ::slotted(select:focus), ::slotted(textarea:focus) { box-shadow: 0 0 0 4px color-mix(in srgb, var(--sw-accent) 20%, transparent); }
:host(sw-toggle) button { box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.16); }
/* domus 13 - the dialog and the drawer carry the glass edge; the table header reads as a quiet caption row */
:host(sw-dialog) .box, :host(sw-drawer) .panel { box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); border: 1px solid var(--sw-border); }
:host(sw-table) th { color: var(--sw-text-2); }
:host(sw-table) td { font-variant-numeric: tabular-nums; }
`;

export const domus: Skin = { id: 'domus', name: 'hi-tech Domus', nameHe: 'הייטק Domus', noteHe: 'זכוכית על רקע צבעוני, פינות עגולות, כותרות גדולות', stage: 'stable', features: { material: true, bevel: true, pixelEdge: true, glass: true }, tokens, rules };
