import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';

/**
 * Skin "bubble" (owner 2026-10-02, approved from the taste mockup docs/design/mockups/bubble-taste on pilot/design-bubble-taste):
 * pop-ups and translucency first, pill rows, a floating phone dock. Values measured in the Bubble Card introduction video and
 * the mockup's contrast pass (README there). Everything a person can change - density, surface, pop-up kind, radius,
 * transparency, scale, desktop touch target, palette - is a look dial (design/look.ts), not a value here: this file is the
 * resting look, the dial bundles rewrite its tokens on <html>. A palette (later phase) overrides the colour names below.
 */
const tokens: TokenTable = {
  '--sw-bg': lt('#eceef5', '#2b2a37'),
  '--sw-canvas': lt(
    'radial-gradient(60% 50% at 85% 0%, rgba(120, 140, 255, 0.22), transparent 70%), radial-gradient(50% 45% at 10% 100%, rgba(255, 170, 120, 0.18), transparent 70%), linear-gradient(#eceef5, #eceef5)',
    'radial-gradient(55% 45% at 88% 0%, rgba(110, 120, 230, 0.22), transparent 70%), radial-gradient(50% 45% at 8% 100%, rgba(230, 120, 80, 0.14), transparent 70%), linear-gradient(#2b2a37, #2b2a37)',
  ),
  '--sw-surface': lt('#dfe3ee', '#4a4356'),
  '--sw-surface-2': lt('#cfd5e3', '#5a5268'),
  '--sw-surface-3': lt('#c1c9da', '#675e77'),
  '--sw-surface-solid': lt('#f4f5fa', '#3b3548'),
  '--sw-surface-2-solid': lt('#dfe3ee', '#4a4356'),
  '--sw-surface-3-solid': lt('#cfd5e3', '#5a5268'),
  '--sw-border': lt('transparent', 'transparent'),
  '--sw-border-strong': lt('rgba(34, 49, 76, 0.2)', 'rgba(255, 255, 255, 0.18)'),
  '--sw-highlight': lt('rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0.16)'),
  '--sw-overlay': lt('rgba(30, 36, 56, 0.28)', 'rgba(14, 12, 22, 0.42)'),
  '--sw-video-bg': lt('#0f1729', '#05070c'),
  '--sw-text': lt('#20263b', '#ffffff'),
  '--sw-heading': lt('#171c2e', '#ffffff'),
  '--sw-text-2': lt('#3d4459', '#ddd6e8'),
  '--sw-text-3': lt('#4f566c', '#d0c9dc'),
  '--sw-text-inverse': same('#ffffff'),
  '--sw-accent': lt('#2767ed', '#4c6fd9'),
  '--sw-accent-hover': lt('#1f57d1', '#6585e6'),
  '--sw-accent-soft': lt('rgba(39, 103, 237, 0.14)', 'rgba(110, 140, 240, 0.26)'),
  '--sw-accent-text': lt('#1d4fc4', '#c9d6ff'),
  '--sw-focus': lt('#2767ed', '#a9bdff'),
  '--sw-nav': lt('#2767ed', '#4c6fd9'),
  '--sw-toggle-on': lt('#2767ed', '#4c6fd9'),
  '--sw-live': lt('#16a34a', '#3ddc84'),
  '--sw-live-soft': lt('rgba(22, 163, 74, 0.14)', 'rgba(61, 220, 132, 0.2)'),
  '--sw-live-text': lt('#116330', '#7ff0b0'),
  '--sw-recorded': lt('#2767ed', '#6ea2ff'),
  '--sw-recorded-soft': lt('rgba(39, 103, 237, 0.14)', 'rgba(110, 162, 255, 0.2)'),
  '--sw-recorded-text': lt('#1d4fc4', '#c9d6ff'),
  '--sw-offline': lt('#7c879a', '#8b96a8'),
  '--sw-offline-soft': lt('rgba(124, 135, 154, 0.14)', 'rgba(139, 150, 168, 0.2)'),
  '--sw-offline-text': lt('#4f5a6d', '#d0c9dc'),
  '--sw-stale': lt('#bf7506', '#f5b043'),
  '--sw-stale-soft': lt('rgba(217, 138, 11, 0.15)', 'rgba(245, 176, 67, 0.22)'),
  '--sw-stale-text': lt('#7a4c00', '#ffd08a'),
  '--sw-unknown': lt('#aab3c2', '#6b7686'),
  '--sw-unknown-soft': lt('rgba(170, 179, 194, 0.16)', 'rgba(107, 118, 134, 0.22)'),
  '--sw-unknown-text': lt('#525f77', '#d0c9dc'),
  '--sw-danger': lt('#ef4444', '#ff6b62'),
  '--sw-danger-soft': lt('rgba(239, 68, 68, 0.14)', 'rgba(255, 107, 98, 0.22)'),
  '--sw-danger-text': lt('#a01515', '#ffc8c3'),
  '--sw-warning': lt('#f59e0b', '#f5b043'),
  '--sw-warning-soft': lt('rgba(245, 158, 11, 0.16)', 'rgba(245, 176, 67, 0.22)'),
  '--sw-warning-text': lt('#9a4a06', '#ffd08a'),
  '--sw-success': lt('#16a34a', '#3ddc84'),
  '--sw-success-soft': lt('rgba(22, 163, 74, 0.14)', 'rgba(61, 220, 132, 0.2)'),
  '--sw-success-text': lt('#116330', '#7ff0b0'),
  '--sw-forbidden': lt('#c81e1e', '#ff7a70'),
  '--sw-forbidden-soft': lt('rgba(200, 30, 30, 0.14)', 'rgba(255, 122, 112, 0.22)'),
  '--sw-forbidden-text': lt('#a01515', '#ffc8c3'),
  '--sw-purple': lt('#7c5cf0', '#a78bfa'),
  '--sw-map-bg': lt('#f4f6fa', '#262533'),
  '--sw-fs-xs': same('12px'),
  '--sw-fs-sm': same('13px'),
  '--sw-h1': same('24px'),
  '--sw-page-pad': same('18px'),
  '--sw-rail-w': same('92px'),
  '--sw-touch': same('44px'),
  '--sw-r-sm': same('12px'),
  '--sw-r-md': same('18px'),
  '--sw-r-lg': same('28px'),
  '--sw-r-xl': same('42px'),
  '--sw-shadow-1': same('none'),
  '--sw-shadow-2': lt('0 8px 24px rgba(30, 40, 70, 0.12)', '0 8px 24px rgba(0, 0, 0, 0.35)'),
  '--sw-shadow-3': lt('0 24px 60px rgba(30, 40, 70, 0.22)', '0 24px 70px rgba(0, 0, 0, 0.5)'),
  '--sw-glass-blur': same('none'), // cards stay flat (bubble); the glass surface dial adds blur per component
  '--sw-glass-blur-nav': same('blur(18px) saturate(150%)'),
  '--sw-glass-blur-sheet': same('blur(26px) saturate(160%)'),
  '--sw-t-fast': same('200ms'),
  '--sw-t-med': same('300ms'),
  '--sw-t-sheet': same('460ms'),
  '--sw-t-state': same('900ms'),
  '--sw-ease': same('cubic-bezier(0.4, 0, 0.2, 1)'),
  '--sw-ease-thumb': same('cubic-bezier(0.34, 1.32, 0.64, 1)'),
  // the bubble group (tokens.ts): the sheet colour and the layers over it
  '--sw-sheet-rgb': lt('246, 247, 252', '59, 53, 72'),
  '--sw-layer': lt('rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.08)'),
  '--sw-layer-2': lt('rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.14)'),
  '--sw-nav-glass': lt('rgba(246, 247, 252, 0.62)', 'rgba(43, 42, 55, 0.6)'),
  '--sw-backdrop-blur': same('blur(3px)'),
  '--sw-lit': lt('#f3a43c', '#f19e33'),
  '--sw-lit-soft': lt('rgba(243, 164, 60, 0.32)', 'rgba(241, 158, 51, 0.34)'),
  '--sw-r-media': same('16px'),
};

/* The structural rules of the skin (budget 50). Written for the shadow roots (see SKIN_AUTHORING_HE.md §2). The pill, the sheet and
   the phone dock are components of their own (sw-pill, sw-sheet, sw-app's dock) that read tokens; the rules here only dress the
   shell and the shared components. A floating glass layer always has its solid twin (@supports / reduced transparency). */
const rules = `
/* bubble 1 - the canvas with its two blooms */
:host(sw-app) { background: var(--sw-canvas); }
/* bubble 2 - the rail is a floating glass pill column */
:host(sw-app) nav.rail.rail { margin-block: 12px; margin-inline-start: 12px; border: 0; border-radius: var(--sw-r-lg); background: var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: inset 0 1px 0 var(--sw-highlight); }
:host(sw-app) .brand-tile { border-radius: 50%; }
:host(sw-app) a.item.a { border-radius: var(--sw-r-md); }
:host(sw-app) a.item.a.active { background: var(--sw-accent); color: var(--sw-text-inverse); }
:host(sw-app) a.item.a.active sw-icon { color: var(--sw-text-inverse); }
/* bubble 3 - the floating corner (search / status) and the search panel */
:host(sw-app) .float .pillrow, :host(sw-app) .searchpanel { border-radius: var(--sw-r-pill); background: var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: inset 0 1px 0 var(--sw-highlight), var(--sw-shadow-2); }
/* bubble 4 - the phone dock: the bottom bar is a floating pill stack beside the home button (sw-app renders the dock row in this skin) */
:host(sw-app) nav.bottom.bottom { background: transparent; border: 0; box-shadow: none; }
:host(sw-app) nav.bottom.bottom .stack { background: var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-2); }
:host(sw-app) nav.bottom.bottom a.active .ic { background: var(--sw-accent); color: var(--sw-text-inverse); }
/* bubble 5 - the building tree stays prominent: a glass panel, pill rows, the selected row filled */
:host(devices-building) nav.tree { border: 0; border-radius: var(--sw-r-lg); padding: 14px 10px; background: var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); box-shadow: inset 0 1px 0 var(--sw-highlight); }
:host(devices-building) .tree-row { border-radius: var(--sw-r-pill); min-block-size: 44px; }
:host(devices-building) .tree-row.selected { background: var(--sw-accent); color: var(--sw-text-inverse); }
:host(devices-building) .tree-row:not(.selected):hover { background: var(--sw-layer); }
/* bubble 6 - cards, KPI tiles, home widgets, floor cards and area tiles: flat pills, no border, no shadow */
:host(sw-card), :host(sw-kpi), :host(devices-building) section.fcard, :host(devices-building) a.tile, :host(home-widgets) .wg { border: 0; border-radius: var(--sw-r-lg); background: var(--sw-surface); box-shadow: none; }
:host(devices-building) a.tile:hover, :host(sw-card[interactive]:hover) { background: var(--sw-surface-3); transform: none; }
/* bubble 7 - controls: pill buttons, pill chips, pill fields, a pill switch */
:host(sw-button) button { border: 0; border-radius: var(--sw-r-pill); min-block-size: var(--sw-touch-desktop); box-shadow: none; background: var(--sw-surface-2); }
:host(sw-button[variant='primary']) button { background: var(--sw-accent); }
:host(sw-button[variant='ghost']) button { background: transparent; }
:host(sw-button[size='sm']) button { min-block-size: var(--sw-touch-desktop); }
:host(sw-chip) button { border: 0; border-radius: var(--sw-r-pill); background: var(--sw-surface-2); box-shadow: none; min-block-size: 36px; }
::slotted(input), ::slotted(select), ::slotted(textarea) { background: var(--sw-surface-2); border-color: transparent; border-radius: var(--sw-r-md); }
:host(sw-toggle) button::after { box-shadow: var(--sw-shadow-thumb); transition-timing-function: var(--sw-ease-thumb); }
:host(sw-toggle[checked]) button { background: var(--sw-toggle-on); }
/* bubble 8 - the segmented control: a pill track, the chosen segment a solid pill */
:host(sw-tabs[data-variant='pill']) .row::before { border-radius: var(--sw-r-pill); background: var(--sw-surface-2); }
:host(sw-tabs[data-variant='pill']) .lbl { border-radius: var(--sw-r-pill); }
:host(sw-tabs[data-variant='pill']) .on .lbl { background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-2); }
/* bubble 9 - floating layers (dialog, drawer, popover) are translucent sheets over a blurred page, solid when the OS asks for less transparency or blur is unsupported */
:host(sw-dialog) .box, :host(sw-popover), :host(sw-drawer) .panel { border: 0; border-radius: var(--sw-r-xl); background: rgba(var(--sw-sheet-rgb), var(--sw-sheet-alpha)); -webkit-backdrop-filter: var(--sw-glass-blur-sheet); backdrop-filter: var(--sw-glass-blur-sheet); box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-3); }
:host(sw-dialog) .backdrop { -webkit-backdrop-filter: var(--sw-backdrop-blur); backdrop-filter: var(--sw-backdrop-blur); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { :host(sw-dialog) .box, :host(sw-popover), :host(sw-drawer) .panel, :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom .stack, :host(devices-building) nav.tree { background: var(--sw-surface-solid); } }
@media (prefers-reduced-transparency: reduce) { :host(sw-dialog) .box, :host(sw-popover), :host(sw-drawer) .panel, :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom .stack, :host(devices-building) nav.tree { background: var(--sw-surface-solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }
/* bubble 10 - tables: pill-shaped rows with a soft hover (admin lists stay tables, never a column of pills) */
:host(sw-table) tbody tr:hover { background: var(--sw-surface-3); }
:host(sw-table) th { font-weight: var(--sw-fw-semibold); }
:host(sw-page) h1 { letter-spacing: -0.3px; }
`;

export const bubble: Skin = { id: 'bubble', name: 'Bubble', nameHe: 'Bubble', noteHe: 'חלונות קופצים שקופים, כמוסות, פס צף בטלפון; צפיפות, משטח ופינות לבחירה', tokens, rules };
