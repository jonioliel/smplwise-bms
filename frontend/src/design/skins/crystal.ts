import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';

/**
 * Skin "Crystal" (CRY, 2026-10-10): glassy, luminous, refined. Frosted crystal panels with a 1 px luminous rim over a pearl
 * (light) or deep-indigo (dark) canvas, a sapphire accent, moderately round shapes, calm shadows. The canvas carries the
 * background artwork chosen in הגדרות › כללי › מראה המערכת › רקע (design/background.ts writes `--sw-bg-image` on <html>;
 * the built-in day / night pair follows the scheme), softened by `--sw-bg-veil` so text on the canvas keeps its contrast.
 * Built on the DU1 token layer: every tier of the type / radius / control scales is set here; the state colours share the
 * proven Domus values (semantic colours stay recognisable from skin to skin).
 */
const tokens: TokenTable = {
  '--sw-bg': lt('#eef3fa', '#0a0f1a'),
  // UXFIX-A11Y-295 (owner option A for domus, applied to crystal too - the same finding): the light blooms are softened toward white at
  // the same alpha - rgba(120, 200, 255) -> rgba(152, 213, 255), rgba(176, 150, 255) -> rgba(204, 187, 255) - so text straight on a bloom
  // centre reads at >= 4.5:1 (was 4.20-4.35:1). Dark unchanged.
  '--sw-canvas': lt(
    'radial-gradient(1200px 760px at 8% -10%, rgba(152, 213, 255, 0.38), transparent 62%), radial-gradient(1100px 720px at 100% 110%, rgba(204, 187, 255, 0.30), transparent 64%), radial-gradient(900px 520px at 55% 30%, rgba(255, 255, 255, 0.55), transparent 70%), linear-gradient(165deg, #f4f8fd 0%, #e9eff8 55%, #e6edf7 100%)',
    'radial-gradient(1000px 640px at 6% -8%, rgba(64, 140, 255, 0.20), transparent 62%), radial-gradient(1000px 680px at 100% 108%, rgba(140, 96, 255, 0.18), transparent 64%), linear-gradient(180deg, #0d1424 0%, #080c16 100%)',
  ),
  '--sw-bg-veil': lt('rgba(238, 243, 250, 0.42)', 'rgba(10, 15, 26, 0.50)'),
  '--sw-surface': lt('rgba(255, 255, 255, 0.58)', 'rgba(20, 28, 46, 0.64)'),
  '--sw-surface-2': lt('rgba(255, 255, 255, 0.72)', 'rgba(255, 255, 255, 0.07)'),
  '--sw-surface-3': lt('rgba(30, 50, 90, 0.07)', 'rgba(255, 255, 255, 0.10)'),
  '--sw-surface-solid': lt('#f9fbfe', '#141c2e'),
  '--sw-surface-2-solid': lt('#ffffff', '#1b2538'),
  '--sw-surface-3-solid': lt('#e6ecf5', '#263248'),
  // a menu is opaque (owner 2026-10-13): the solid twin, and the skin's ink hairline (12 % light / 14 % white dark) flattened over it
  '--sw-menu-surface': lt('#f9fbfe', '#141c2e'),
  '--sw-menu-border': lt('#dfe3ea', '#353c4b'),
  '--sw-border': lt('rgba(255, 255, 255, 0.82)', 'rgba(255, 255, 255, 0.14)'),
  '--sw-border-strong': lt('rgba(30, 50, 90, 0.18)', 'rgba(255, 255, 255, 0.22)'),
  '--sw-highlight': lt('rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.22)'),
  '--sw-overlay': lt('rgba(12, 22, 44, 0.38)', 'rgba(0, 0, 0, 0.62)'),
  '--sw-text': lt('#152238', '#e9eef8'),
  '--sw-heading': lt('#0e1a30', '#ffffff'),
  '--sw-text-2': lt('#3e4d66', '#aeb9cf'),
  '--sw-text-3': lt('#55637c', '#909db5'),
  '--sw-text-inverse': lt('#ffffff', '#0b1020'),
  '--sw-accent': lt('#1e5bd8', '#8ab8ff'),
  '--sw-accent-hover': lt('#174cbd', '#a5c8ff'),
  '--sw-accent-soft': lt('rgba(30, 91, 216, 0.12)', 'rgba(138, 184, 255, 0.18)'),
  '--sw-accent-text': lt('#174cbd', '#9ec4ff'),
  '--sw-focus': lt('#1e5bd8', '#9ec4ff'),
  '--sw-nav': lt('#1e5bd8', '#8ab8ff'),
  '--sw-live': lt('#1f9d55', '#3ddc84'),
  '--sw-live-soft': lt('rgba(31, 157, 85, 0.14)', 'rgba(61, 220, 132, 0.20)'),
  '--sw-recorded': lt('#1e5bd8', '#8ab8ff'),
  '--sw-recorded-soft': lt('rgba(30, 91, 216, 0.12)', 'rgba(138, 184, 255, 0.20)'),
  '--sw-offline': lt('#7c879a', '#8b96a8'),
  '--sw-offline-soft': lt('rgba(124, 135, 154, 0.14)', 'rgba(139, 150, 168, 0.20)'),
  '--sw-stale': lt('#bf7506', '#f5b043'),
  '--sw-stale-soft': lt('rgba(217, 138, 11, 0.15)', 'rgba(245, 176, 67, 0.20)'),
  '--sw-unknown': lt('#aab3c2', '#6b7686'),
  '--sw-unknown-soft': lt('rgba(170, 179, 194, 0.16)', 'rgba(107, 118, 134, 0.22)'),
  '--sw-danger': lt('#d93838', '#ff6b62'),
  '--sw-danger-soft': lt('rgba(217, 56, 56, 0.12)', 'rgba(255, 107, 98, 0.20)'),
  '--sw-warning': lt('#bf7506', '#f5b043'),
  '--sw-warning-soft': lt('rgba(217, 138, 11, 0.15)', 'rgba(245, 176, 67, 0.20)'),
  '--sw-success': lt('#1f9d55', '#3ddc84'),
  '--sw-success-soft': lt('rgba(31, 157, 85, 0.14)', 'rgba(61, 220, 132, 0.20)'),
  '--sw-forbidden': lt('#c81e1e', '#ff7a70'),
  '--sw-forbidden-soft': lt('rgba(200, 30, 30, 0.12)', 'rgba(255, 122, 112, 0.20)'),
  '--sw-purple': lt('#7c5cf0', '#a78bfa'),
  '--sw-live-text': lt('#14703c', '#3ddc84'),
  '--sw-recorded-text': lt('#174cbd', '#9ec4ff'),
  '--sw-offline-text': lt('#4f5a6d', '#b4bdcc'),
  '--sw-stale-text': lt('#7a4c00', '#f5b043'),
  '--sw-unknown-text': lt('#525f77', '#aab5c9'),
  '--sw-danger-text': lt('#a82525', '#ff6b62'),
  '--sw-warning-text': lt('#7a4c00', '#f5b043'),
  '--sw-success-text': lt('#14703c', '#3ddc84'),
  '--sw-forbidden-text': lt('#a51818', '#ff7a70'),
  '--sw-toggle-on': lt('#1e5bd8', '#5f9cff'),
  '--sw-map-bg': lt('#f3f6fb', '#0f141d'),
  '--sw-map-wall': lt('#b6c2d4', '#4a5568'),
  '--sw-map-furniture': lt('#e6ecf5', '#1f2736'),
  '--sw-map-furniture-line': lt('#cbd5e3', '#3a4457'),
  '--sw-map-structure': lt('#4b5873', '#9aa6bb'),
  '--sw-map-candidate': lt('#1e5bd8', '#8ab8ff'),
  '--sw-map-label': lt('#5a6882', '#8391a8'),
  '--sw-map-presence': lt('#1e5bd8', '#8ab8ff'),
  '--sw-fov': lt('rgba(30, 91, 216, 0.12)', 'rgba(138, 184, 255, 0.16)'),
  '--sw-circuit-1': lt('#1e5bd8', '#8ab8ff'),
  '--sw-circuit-2': lt('#d98a0b', '#f5b043'),
  '--sw-circuit-3': lt('#1f9d55', '#3ddc84'),
  '--sw-circuit-4': lt('#9a55f0', '#c084fc'),
  '--sw-circuit-5': lt('#d93838', '#ff6b62'),
  '--sw-circuit-6': lt('#12a39a', '#2dd4bf'),
  '--sw-fs-2xs': same('10.5px'),
  '--sw-fs-xs': same('11.5px'),
  '--sw-fs-sm': same('12.5px'),
  '--sw-fs-base': same('13.5px'),
  '--sw-fs-md': same('14px'),
  '--sw-fs-lg': same('15.5px'),
  '--sw-fs-xl': same('17.5px'),
  '--sw-fs-2xl': same('21px'),
  '--sw-fs-3xl': same('27px'),
  '--sw-lh': same('1.48'),
  '--sw-h1': same('34px'),
  '--sw-h1-weight': same('600'),
  '--sw-h1-tracking': same('-0.8px'),
  '--sw-page-pad': same('28px'),
  '--sw-r-2xs': same('5px'),
  '--sw-r-xs': same('8px'),
  '--sw-r-sm': same('10px'),
  '--sw-r-md': same('14px'),
  '--sw-r-lg': same('18px'),
  '--sw-r-xl': same('22px'),
  '--sw-r-2xl': same('28px'),
  '--sw-hover-wash': lt('rgba(255, 255, 255, 0.40)', 'rgba(255, 255, 255, 0.07)'),
  '--sw-pressed-wash': lt('rgba(30, 50, 90, 0.08)', 'rgba(255, 255, 255, 0.12)'),
  '--sw-skeleton': lt('rgba(30, 50, 90, 0.08)', 'rgba(255, 255, 255, 0.08)'),
  '--sw-shadow-primary': lt('0 6px 16px rgba(30, 91, 216, 0.28)', '0 6px 16px rgba(0, 0, 0, 0.45)'),
  '--sw-on-image-bg': lt('rgba(255, 255, 255, 0.88)', 'rgba(20, 28, 46, 0.86)'),
  '--sw-toast-bg': lt('#13213a', '#223052'),
  '--sw-shadow-1': lt('0 1px 2px rgba(20, 40, 80, 0.05), 0 10px 30px rgba(20, 40, 80, 0.08)', '0 1px 2px rgba(0, 0, 0, 0.45), 0 12px 36px rgba(0, 0, 0, 0.50)'),
  '--sw-shadow-2': lt('0 2px 6px rgba(20, 40, 80, 0.06), 0 18px 44px rgba(20, 40, 80, 0.13)', '0 2px 6px rgba(0, 0, 0, 0.45), 0 22px 56px rgba(0, 0, 0, 0.58)'),
  '--sw-shadow-3': lt('0 8px 20px rgba(20, 40, 80, 0.10), 0 30px 76px rgba(20, 40, 80, 0.22)', '0 8px 20px rgba(0, 0, 0, 0.5), 0 32px 84px rgba(0, 0, 0, 0.72)'),
  '--sw-shadow-thumb': lt('0 1px 3px rgba(0, 0, 0, 0.20), 0 0 0 0.5px rgba(0, 0, 0, 0.06)', '0 1px 3px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(0, 0, 0, 0.4)'),
  '--sw-glass-blur': same('blur(28px) saturate(1.4)'),
  '--sw-glass-blur-nav': same('blur(22px) saturate(1.3)'),
  '--sw-glass-blur-sheet': same('blur(36px) saturate(1.5)'),
  '--sw-glass-sheen': lt(
    'linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.14) 38%, rgba(255, 255, 255, 0) 72%)',
    'linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0) 46%)',
  ),
  '--sw-sheet-rgb': lt('248, 251, 255', '20, 28, 46'),
  '--sw-nav-glass': lt('rgba(255, 255, 255, 0.55)', 'rgba(20, 28, 46, 0.62)'),
  '--sw-backdrop-blur': same('blur(6px)'),
  '--sw-t-med': same('220ms'),
  '--sw-ease': same('cubic-bezier(0.2, 0, 0, 1)'),
  '--sw-ease-thumb': same('cubic-bezier(0.34, 1.3, 0.64, 1)'),
  '--sw-hover-lift': same('-1px'),
};

/* The component rules (budget 50; this skin uses 34). Written for the shadow roots (SKIN_AUTHORING_HE.md §2). Every translucent
   layer has its solid twin (@supports / prefers-reduced-transparency, rules 26-27); a scrolling layer wraps its blur and fill in the
   performance switches (TOKEN_CONTRACT §7). */
const rules = `
/* crystal 1 - the canvas: the chosen background artwork under a soft veil, over the prism blooms (none = the blooms alone) */
:host(sw-app) { background: linear-gradient(var(--sw-bg-veil), var(--sw-bg-veil)), var(--sw-bg-image) center / cover no-repeat, var(--sw-canvas); }
/* crystal 2 - the rail is a floating crystal panel with a luminous rim */
:host(sw-app) nav.rail.rail { margin-block: 12px; margin-inline-start: 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-xl); background: var(--sw-glass-sheen), var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
/* crystal 3 - brand tile, rail items, the floating corner (the search panel is a menu, rule 3b), the phone bar */
:host(sw-app) .brand-tile { background: linear-gradient(145deg, var(--sw-accent), var(--sw-accent-hover)); border-radius: var(--sw-r-sm); box-shadow: var(--sw-shadow-primary); }
:host(sw-app) a.item.a { border-radius: var(--sw-r-md); }
:host(sw-app) a.item.a.active { background: var(--sw-accent-soft); color: var(--sw-accent-text); box-shadow: inset 0 0 0 1px var(--sw-border); }
:host(sw-app) .float .pillrow, :host(sw-app) .tabpair { border: 1px solid var(--sw-border); background: var(--sw-glass-sheen), var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
/* crystal 3b - the search panel hangs over the page like a menu: opaque, nothing blurred behind it (owner 2026-10-13) */
:host(sw-app) .searchpanel { background: var(--sw-glass-sheen), var(--sw-menu-surface); -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); }
:host(sw-app) nav.bottom.bottom { background: var(--sw-glass-sheen), var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); border-block-start: 1px solid var(--sw-border); box-shadow: 0 -1px 0 var(--sw-highlight); }
/* crystal 4 - crystal panels: cards, KPI tiles, home widgets, floor cards, area tiles and the building tree (blur and fill behind the performance switches) */
:host(sw-card), :host(sw-kpi), :host(devices-building) section.fcard, :host(devices-building) a.tile, :host(devices-building) nav.tree, :host(home-widgets) .wg { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-glass-sheen), var(--sw-perf-glass-bg, var(--sw-surface)); -webkit-backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur)); backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur)); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px rgba(255, 255, 255, 0.06); }
:host(sw-card[interactive]:hover), :host(devices-building) a.tile:hover { box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); transform: translateY(var(--sw-hover-lift)); }
/* crystal 5 - the building tree stays prominent: a taller panel with the nav blur, pill rows, the selected row filled */
:host(devices-building) nav.tree { border-radius: var(--sw-r-lg); padding: 10px; gap: 3px; -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); }
:host(devices-building) .tree-row { border-radius: var(--sw-r-pill); padding-block: 8px; }
:host(devices-building) .tree-row.selected { background: var(--sw-accent-soft); color: var(--sw-accent-text); box-shadow: inset 0 0 0 1px var(--sw-border); }
/* crystal 6 - controls: buttons with a light rim, pill chips, frosted fields */
:host(sw-button) button { border-radius: var(--sw-r-sm); min-block-size: 34px; box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); }
:host(sw-button[variant='primary']) button { background: linear-gradient(180deg, var(--sw-accent), var(--sw-accent-hover)); box-shadow: var(--sw-shadow-primary), inset 0 1px 0 rgba(255, 255, 255, 0.28); }
:host(sw-button[variant='ghost']) button { box-shadow: none; }
:host(sw-button[size='sm']) button { border-radius: var(--sw-r-sm); min-block-size: 30px; }
:host(sw-chip) button { border-radius: var(--sw-r-pill); }
::slotted(input), ::slotted(select), ::slotted(textarea) { background: var(--sw-surface-2); border-color: var(--sw-border-strong); border-radius: var(--sw-r-sm); }
/* crystal 7 - the switch and the segmented / tab rails: a glass track, a solid luminous thumb */
:host(sw-toggle) button::after { box-shadow: var(--sw-shadow-thumb); transition-timing-function: var(--sw-ease-thumb); }
:host(sw-toggle[checked]) button { background: var(--sw-toggle-on); }
:host(sw-tabs[data-variant='pill']) .row::before { border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
:host(sw-tabs[data-variant='pill']) .lbl { border-radius: var(--sw-r-pill); }
:host(sw-tabs[data-variant='pill']) .on .lbl { background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-thumb), inset 0 1px 0 var(--sw-highlight); }
/* crystal 8 - floating layers read on anything: the solid twin under the sheen, a sheet blur behind, a luminous rim; the menus (a popover, a dropdown's list) are fully opaque, no blur (owner 2026-10-13) */
:host(sw-dialog) .box, :host(sw-drawer) .panel { background: var(--sw-glass-sheen), var(--sw-surface-solid); border-color: var(--sw-border); -webkit-backdrop-filter: var(--sw-glass-blur-sheet); backdrop-filter: var(--sw-glass-blur-sheet); box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
:host(sw-popover), :host(sw-dropdown) .pop { background: var(--sw-glass-sheen), var(--sw-menu-surface); border-color: var(--sw-menu-border); box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
:host(sw-dialog) .box { border-radius: var(--sw-r-xl); }
:host(sw-dialog) .backdrop { -webkit-backdrop-filter: var(--sw-backdrop-blur); backdrop-filter: var(--sw-backdrop-blur); }
/* crystal 9 - tables and list rows: hairline rows, a soft hover; tabular numbers on the KPI tiles; headings */
:host(sw-table) tbody tr:hover { background: var(--sw-surface-3); }
:host(sw-table) th { font-weight: var(--sw-fw-semibold); letter-spacing: 0.02em; }
:host(sw-kpi) .value { font-variant-numeric: tabular-nums; }
:host(sw-page) h1 { font-weight: var(--sw-h1-weight); }
/* crystal 10 - no backdrop-filter, or the OS asks for less transparency: every crystal layer becomes its solid twin (layout unchanged) */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { :host(sw-card), :host(sw-kpi), :host(devices-building) section.fcard, :host(devices-building) a.tile, :host(devices-building) nav.tree, :host(home-widgets) .wg, :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom, :host(sw-app) .float .pillrow, :host(sw-app) .tabpair { background: var(--sw-surface-solid); } }
@media (prefers-reduced-transparency: reduce) { :host(sw-card), :host(sw-kpi), :host(devices-building) section.fcard, :host(devices-building) a.tile, :host(devices-building) nav.tree, :host(home-widgets) .wg, :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom, :host(sw-app) .float .pillrow, :host(sw-app) .tabpair { background: var(--sw-surface-solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

export const crystal: Skin = { id: 'crystal', name: 'Crystal', nameHe: 'קריסטל', noteHe: 'זכוכית מוארת על רקע יום / לילה, שפה זוהרת, צורות מעודנות', stage: 'stable', features: { material: false, bevel: false, pixelEdge: true, glass: true }, tokens, rules };
