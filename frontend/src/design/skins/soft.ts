import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { ARX_MOTION_RULES } from './arx-motion';
import { INFRA_TOKENS } from './infra';
import { ARX_KPI_RULES, ARX_RAIL_RULES, SOFT_COMPONENT_RULES } from './arx-components';

/**
 * Skin "Arx Soft" (SKINFOUND-297, owner decision 2026-10-27: direction C of the Arx design system, an ADDITIONAL selectable skin;
 * the default stays classic). Real material over warm / cool blooms: translucent panels with a lit top edge, rounder shapes, an
 * iOS-leaning state palette, opaque menus and sheets. Built as the design system builds it: the Arx Infra table (infra.ts) with
 * C's deltas - private/design-system-2026-10-27/docs/TOKENS.md §3, as corrected by round 2 (round2/r2.css §7: the "vibrancy" muted
 * text and state text that keep 4.5:1 on the blended ground, the dark accent #2f6df6 that keeps white at 4.8:1 on a filled button).
 *
 * SKINFOUND-297: tokens (light AND dark), density, the shared motion layer, and the few rules that make the material real (the
 * canvas, glass panels behind the performance switches, their solid fallbacks). SKINCOMP-297: the C component rules (arx-components.ts:
 * pill buttons, the 51 x 31 switch, the lit glow, the KPI tile without the icon box, the rail on the `--sw-rail-*` tokens). Soft has no
 * dark rail (`ui.rail_tone` is ignored here). The brand mark and the installation logo are NOT touched.
 */
const tokens: TokenTable = {
  ...INFRA_TOKENS,
  '--sw-bg': lt('#eef2f9', '#0b1020'),
  // SKINFOUND-297: the cool light bloom is the design system's rgba(110, 162, 255, .3) softened 30 % toward white at the same alpha
  // (-> rgba(154, 190, 255, .3)), the owner's option A of UXFIX-A11Y-295 for domus and crystal: at the bloom's centre on the warm stop
  // the muted text #566480 read 4.19:1 and the accent text 4.33:1 (unit-muted-contrast.spec.ts), now >= 4.55:1. Dark unchanged.
  '--sw-canvas': lt(
    'radial-gradient(900px 500px at 85% -10%, rgba(255, 196, 120, 0.35), transparent 60%), radial-gradient(900px 600px at 10% 110%, rgba(154, 190, 255, 0.3), transparent 60%), linear-gradient(#eef2f9, #f3f1ec)',
    'radial-gradient(900px 500px at 85% -10%, rgba(255, 159, 10, 0.14), transparent 60%), radial-gradient(900px 600px at 10% 110%, rgba(58, 108, 224, 0.25), transparent 60%), linear-gradient(#0b1020, #0e1220)',
  ),
  '--sw-surface': lt('rgba(255, 255, 255, 0.72)', 'rgba(24, 30, 48, 0.7)'),
  '--sw-surface-solid': lt('#fdfdfe', '#1a2032'),
  '--sw-surface-2': lt('rgba(255, 255, 255, 0.62)', 'rgba(44, 52, 76, 0.6)'),
  '--sw-surface-2-solid': lt('#f4f6fa', '#232a40'),
  '--sw-surface-3': lt('rgba(120, 120, 128, 0.12)', 'rgba(235, 235, 245, 0.12)'),
  '--sw-menu-surface': lt('#fdfdfe', '#1a2032'),
  '--sw-menu-border': lt('#dde2ec', '#2b3450'),
  '--sw-border': lt('rgba(30, 41, 59, 0.09)', 'rgba(255, 255, 255, 0.1)'),
  '--sw-border-strong': lt('rgba(30, 41, 59, 0.18)', 'rgba(255, 255, 255, 0.2)'),
  '--sw-highlight': lt('rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.1)'),
  '--sw-nav-glass': lt('rgba(255, 255, 255, 0.6)', 'rgba(16, 21, 38, 0.6)'), // the rail and the phone bar (TOKENS.md --sw-rail-bg)
  // SKINCOMP-297: the rail (TOKENS.md §3): nav glass with the vibrancy label, the C accent text on a 12 % / 20 % accent pill
  '--sw-rail-bg': lt('rgba(255, 255, 255, 0.6)', 'rgba(16, 21, 38, 0.6)'),
  '--sw-rail-text': lt('#4d5a72', '#aeb8cc'),
  '--sw-rail-active': lt('#2158d4', '#9ec0ff'),
  '--sw-rail-active-bg': lt('rgba(47, 109, 246, 0.12)', 'rgba(91, 141, 255, 0.2)'),
  '--sw-rail-border': lt('rgba(30, 41, 59, 0.08)', 'rgba(255, 255, 255, 0.08)'),
  '--sw-text': lt('#1f2a3d', '#eef2fa'),
  '--sw-heading': lt('#16203a', '#f8faff'),
  '--sw-text-2': lt('#44516a', '#b6c0d4'),
  '--sw-text-3': lt('#566480', '#97a3bb'),
  '--sw-accent': lt('#2f6df6', '#2f6df6'),
  // SKINFOUND-297: round 2's dark hover #4a80ff carries white at only 3.9:1 (unit-stall-retry-contrast.spec.ts); the hover takes C's own
  // light hover #255ddb in dark too - it moves away from the white label (POLISH-295), white reads at 5.5:1
  '--sw-accent-hover': lt('#255ddb', '#255ddb'),
  '--sw-accent-soft': lt('rgba(47, 109, 246, 0.12)', 'rgba(91, 141, 255, 0.2)'),
  '--sw-accent-text': lt('#2158d4', '#9ec0ff'),
  '--sw-focus': lt('#2f6df6', '#9ec0ff'),
  '--sw-nav': lt('#2f6df6', '#2f6df6'),
  // states (iOS-leaning, TOKENS.md §3), the -text tier of round 2 on the blended soft fills
  '--sw-live': lt('#22c55e', '#30d158'),
  '--sw-live-soft': lt('rgba(34, 197, 94, 0.14)', 'rgba(48, 209, 88, 0.2)'),
  '--sw-live-text': lt('#0e6b33', '#7ee29a'),
  '--sw-success': lt('#22c55e', '#30d158'),
  '--sw-success-soft': lt('rgba(34, 197, 94, 0.14)', 'rgba(48, 209, 88, 0.2)'),
  '--sw-success-text': lt('#0e6b33', '#7ee29a'),
  '--sw-recorded': lt('#2f6bff', '#6ea2ff'),
  '--sw-recorded-soft': lt('rgba(47, 107, 255, 0.14)', 'rgba(110, 162, 255, 0.2)'),
  '--sw-recorded-text': lt('#1f5ae6', '#9ec0ff'),
  '--sw-offline': lt('#8e8e93', '#8e8e93'),
  '--sw-offline-soft': lt('rgba(142, 142, 147, 0.14)', 'rgba(142, 142, 147, 0.2)'),
  '--sw-offline-text': lt('#4f5866', '#c0c4cc'),
  '--sw-stale': lt('#ff9f0a', '#ff9f0a'),
  '--sw-stale-soft': lt('rgba(255, 159, 10, 0.16)', 'rgba(255, 159, 10, 0.2)'),
  '--sw-stale-text': lt('#a04a06', '#ffc46b'),
  '--sw-warning': lt('#ff9f0a', '#ff9f0a'),
  '--sw-warning-soft': lt('rgba(255, 159, 10, 0.16)', 'rgba(255, 159, 10, 0.2)'),
  '--sw-warning-text': lt('#a04a06', '#ffc46b'),
  '--sw-unknown': lt('#aeaeb2', '#636366'),
  '--sw-unknown-soft': lt('rgba(174, 174, 178, 0.1)', 'rgba(99, 99, 102, 0.16)'),
  '--sw-unknown-text': lt('#4f5866', '#b7bcc8'),
  '--sw-danger': lt('#e5484d', '#ff453a'),
  '--sw-danger-soft': lt('rgba(229, 72, 77, 0.13)', 'rgba(255, 69, 58, 0.2)'),
  '--sw-danger-text': lt('#b91c1c', '#ff8a80'),
  '--sw-forbidden': lt('#d70015', '#ff453a'),
  '--sw-forbidden-soft': lt('rgba(215, 0, 21, 0.12)', 'rgba(255, 69, 58, 0.2)'),
  '--sw-forbidden-text': lt('#b91c1c', '#ff8a80'),
  '--sw-toggle-on': lt('#34c759', '#30d158'),
  '--sw-lit': lt('#ffb13b', '#ffb547'),
  // shape: rounder (6 / 8 / 12 / 18 / 22 / 24 / 28)
  '--sw-r-2xs': same('6px'),
  '--sw-r-xs': same('8px'),
  '--sw-r-sm': same('12px'),
  '--sw-r-md': same('18px'),
  '--sw-r-lg': same('22px'),
  '--sw-r-xl': same('24px'),
  '--sw-r-2xl': same('28px'),
  // depth: soft lifted panels with the lit top edge (round 2), floating layers, the primary's glow
  '--sw-shadow-1': lt(
    '0 10px 30px rgba(31, 45, 80, 0.09), 0 1px 2px rgba(31, 45, 80, 0.05), inset 0 1px 0 var(--sw-highlight)',
    '0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 var(--sw-highlight)',
  ),
  '--sw-shadow-2': lt(
    '0 18px 44px rgba(31, 45, 80, 0.15), 0 2px 4px rgba(31, 45, 80, 0.06), inset 0 1px 0 var(--sw-highlight)',
    '0 18px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--sw-highlight)',
  ),
  '--sw-shadow-3': lt('0 24px 64px rgba(15, 23, 42, 0.24)', '0 26px 70px rgba(0, 0, 0, 0.6)'),
  '--sw-shadow-primary': lt('0 4px 12px rgba(47, 109, 246, 0.3)', '0 4px 12px rgba(0, 0, 0, 0.4)'),
  // material: panels and the nav blur; sheets (dialog, drawer) and menus stay opaque
  '--sw-glass-blur': same('blur(18px) saturate(1.4)'),
  '--sw-glass-blur-nav': same('blur(16px) saturate(1.4)'),
  '--sw-glass-blur-sheet': same('none'),
  '--sw-glass-sheen': lt('linear-gradient(180deg, rgba(255, 255, 255, 0.5), transparent 40%)', 'linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 40%)'),
  // type and density: roomier
  '--sw-h1': same('28px'),
  '--sw-h1-tracking': same('-0.02em'),
  '--sw-h1-phone': same('24px'),
  '--sw-gap': same('14px'),
  '--sw-gap-lg': same('18px'),
  '--sw-page-pad': same('28px'),
  '--sw-hover-lift': same('-2px'), // fine pointers, motion allowed (reduced motion zeroes it)
};

/* The component rules (budget 50; this skin uses 9 + the 4 motion blocks). Every translucent layer has its solid twin (@supports,
   prefers-reduced-transparency, prefers-contrast: more); a panel's blur and fill sit behind the performance switches
   (--sw-perf-blur / --sw-perf-glass-bg, TOKEN_CONTRACT §7). Menus and sheets are not touched: they keep the opaque menu surface. */
const rules = `
/* soft 1 - the canvas: the warm and cool blooms under the glass */
:host(sw-app) { background: var(--sw-canvas); }
/* soft 2 - the rail and the phone bar: nav glass with the lit edge */
:host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-glass-sheen), var(--sw-rail-bg); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); border-color: var(--sw-rail-border); }
/* soft 3 - panels: cards and KPI tiles are glass (blur and fill behind the performance switches) */
:host(sw-card), :host(sw-kpi) { border-color: var(--sw-border); background: var(--sw-glass-sheen), var(--sw-perf-glass-bg, var(--sw-surface)); -webkit-backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur)); backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur)); }
@media (hover: hover) and (pointer: fine) { :host(sw-card[interactive]:hover) { box-shadow: var(--sw-shadow-2); transform: translateY(var(--sw-hover-lift)); transition: transform var(--sw-t-hover) var(--sw-ease), box-shadow var(--sw-t-hover) var(--sw-ease-color); } }
/* soft 4 - numbers are tabular on the KPI tiles */
:host(sw-kpi) .value { font-variant-numeric: tabular-nums; }
/* soft 5 - no backdrop-filter, less transparency asked, or more contrast asked: every glass layer becomes its solid twin (layout unchanged) */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { :host(sw-card), :host(sw-kpi), :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-surface-solid); } }
@media (prefers-reduced-transparency: reduce) { :host(sw-card), :host(sw-kpi), :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-surface-solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }
@media (prefers-contrast: more) { :host(sw-card), :host(sw-kpi), :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-surface-solid); border-color: var(--sw-border-strong); -webkit-backdrop-filter: none; backdrop-filter: none; } }
${SOFT_COMPONENT_RULES}${ARX_KPI_RULES}${ARX_RAIL_RULES}${ARX_MOTION_RULES}`;

export const soft: Skin = { id: 'soft', name: 'Arx Soft', nameHe: 'Arx Soft', noteHe: 'חומר שקוף על רקע חם וקר, פינות עגולות, תפריטים אטומים', stage: 'foundation', features: { material: false, bevel: false, pixelEdge: true, glass: true }, tokens, rules };
