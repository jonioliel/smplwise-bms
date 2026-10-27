import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { defineSkin } from './define';
import { ARX_MOTION_RULES } from './arx-motion';
import { ARX_STATE_RULES } from './arx-polish';
import { INFRA_TOKENS } from './infra';

/**
 * Skin "Arx Soft" (SKINFOUND-297, owner decision 2026-10-27: direction C of the Arx design system, an ADDITIONAL selectable skin;
 * the default stays classic). Real material over warm / cool blooms: translucent panels with a lit top edge, rounder shapes, an
 * iOS-leaning state palette, opaque menus and sheets. Built as the design system builds it: the Arx Infra table (infra.ts) with
 * C's deltas - private/design-system-2026-10-27/docs/TOKENS.md §3, as corrected by round 2 (round2/r2.css §7: the "vibrancy" muted
 * text and state text that keep 4.5:1 on the blended ground, the dark accent #2f6df6 that keeps white at 4.8:1 on a filled button).
 *
 * FOUNDATION ONLY: tokens (light AND dark), density, the shared motion layer, and the few rules that make the material real (the
 * canvas, glass panels behind the performance switches, their solid fallbacks). The C component rules of COMPONENT_RULES.md (pill
 * buttons, the 51 x 31 switch, the lit glow) come in the build slices. The brand mark and the installation logo are NOT touched.
 */
const tokens: TokenTable = {
  ...INFRA_TOKENS,
  '--sw-bg': lt('#eef2f9', '#0b1020'),
  // SKINFOUND-297: the cool light bloom is the design system's rgba(110, 162, 255, .3) softened 30 % toward white at the same alpha
  // (-> rgba(154, 190, 255, .3)), the owner's option A of UXFIX-A11Y-295 for domus and crystal: at the bloom's centre on the warm stop
  // the muted text #566480 read 4.19:1 and the accent text 4.33:1 (unit-muted-contrast.spec.ts), now >= 4.55:1. Dark unchanged.
  '--sw-canvas': lt(
    'radial-gradient(1000px 620px at 88% -14%, rgba(255, 190, 110, 0.4), transparent 60%), radial-gradient(1000px 700px at 6% 112%, rgba(154, 190, 255, 0.3), transparent 62%), radial-gradient(600px 380px at 40% 40%, rgba(255, 236, 214, 0.5), transparent 70%), linear-gradient(#eef2f9, #f3f1ec)',
    'radial-gradient(1000px 620px at 88% -14%, rgba(255, 159, 10, 0.18), transparent 60%), radial-gradient(1000px 700px at 6% 112%, rgba(58, 108, 224, 0.3), transparent 62%), linear-gradient(#0b1020, #10121f)',
  ),
  '--sw-surface': lt('rgba(255, 255, 255, 0.64)', 'rgba(26, 32, 52, 0.62)'),
  '--sw-surface-solid': lt('#fdfdfe', '#1a2032'),
  '--sw-surface-2': lt('rgba(255, 255, 255, 0.62)', 'rgba(44, 52, 76, 0.6)'),
  '--sw-surface-2-solid': lt('#f4f6fa', '#232a40'),
  '--sw-surface-3': lt('rgba(120, 120, 128, 0.12)', 'rgba(235, 235, 245, 0.12)'),
  '--sw-menu-surface': lt('#fdfdfe', '#1a2032'),
  '--sw-menu-border': lt('#dde2ec', '#2b3450'),
  '--sw-border': lt('rgba(30, 41, 59, 0.09)', 'rgba(255, 255, 255, 0.1)'),
  '--sw-border-strong': lt('rgba(30, 41, 59, 0.18)', 'rgba(255, 255, 255, 0.2)'),
  // POLISH-SKINS-297 (no pixel bevels outside classic / domus): no 1 px lit top line; the panel reads as material through the sheen and a soft two-layer shadow
  '--sw-highlight': same('transparent'),
  '--sw-nav-glass': lt('rgba(255, 255, 255, 0.6)', 'rgba(16, 21, 38, 0.6)'), // the rail and the phone bar (TOKENS.md --sw-rail-bg)
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
  '--sw-lit': lt('#ffb13b', '#ffb547'),
  // shape: rounder (6 / 8 / 12 / 18 / 22 / 24 / 28)
  '--sw-r-2xs': same('6px'),
  '--sw-r-xs': same('8px'),
  '--sw-r-sm': same('14px'),
  '--sw-r-md': same('22px'),
  '--sw-r-lg': same('26px'),
  '--sw-r-xl': same('28px'),
  '--sw-r-2xl': same('32px'),
  // depth: soft lifted panels with the lit top edge (round 2), floating layers, the primary's glow
  // POLISH-SKINS-297 (apple-design: bigger surfaces read thicker): a contact shadow + a soft ambient one, offset down, never a halo;
  // the dark ambient is deeper so a panel separates from the navy canvas without a lit line
  '--sw-shadow-1': lt(
    '0 1px 2px rgba(31, 45, 80, 0.06), 0 8px 24px -6px rgba(31, 45, 80, 0.14)',
    '0 1px 2px rgba(0, 0, 0, 0.45), 0 12px 32px -8px rgba(0, 0, 0, 0.6)',
  ),
  '--sw-shadow-2': lt(
    '0 2px 4px rgba(31, 45, 80, 0.07), 0 18px 40px -10px rgba(31, 45, 80, 0.22)',
    '0 2px 4px rgba(0, 0, 0, 0.5), 0 22px 48px -10px rgba(0, 0, 0, 0.7)',
  ),
  '--sw-shadow-3': lt('0 4px 10px rgba(15, 23, 42, 0.08), 0 28px 64px -12px rgba(15, 23, 42, 0.3)', '0 4px 10px rgba(0, 0, 0, 0.5), 0 30px 72px -12px rgba(0, 0, 0, 0.72)'),
  '--sw-shadow-primary': lt('0 1px 2px rgba(47, 109, 246, 0.25), 0 6px 16px -4px rgba(47, 109, 246, 0.45)', '0 1px 2px rgba(0, 0, 0, 0.4), 0 6px 16px -4px rgba(0, 0, 0, 0.55)'),
  '--sw-shadow-thumb': lt('0 1px 2px rgba(15, 23, 42, 0.18), 0 3px 8px rgba(15, 23, 42, 0.14)', '0 1px 2px rgba(0, 0, 0, 0.5), 0 3px 8px rgba(0, 0, 0, 0.4)'),
  // material: panels and the nav blur; sheets (dialog, drawer) and menus stay opaque
  '--sw-glass-blur': same('blur(24px) saturate(1.6)'),
  '--sw-glass-blur-nav': same('blur(16px) saturate(1.4)'),
  '--sw-glass-blur-sheet': same('none'),
  '--sw-glass-sheen': lt('linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 46%)', 'linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0) 46%)'),
  // the pressed / hovered wash on a glass control: a tone step, not a line
  '--sw-hover-wash': lt('rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.06)'),
  '--sw-pressed-wash': lt('rgba(31, 45, 80, 0.07)', 'rgba(255, 255, 255, 0.1)'),
  // a lit lamp: the warm fill, and its tint as a tile bed (the glow itself is the "glow" option below)
  '--sw-lit-soft': lt('rgba(255, 177, 59, 0.2)', 'rgba(255, 181, 71, 0.2)'),
  // type and density: roomier
  '--sw-h1': same('32px'),
  '--sw-h1-tracking': same('-0.025em'),
  '--sw-h1-weight': same('700'),
  '--sw-h1-phone': same('24px'),
  '--sw-gap': same('14px'),
  '--sw-gap-lg': same('18px'),
  '--sw-page-pad': same('28px'),
  '--sw-hover-lift': same('-2px'), // fine pointers, motion allowed (reduced motion zeroes it)
};

/* The component rules (budget 50; this skin uses 15 + the 4 motion blocks + the 13 Arx state blocks). Every translucent layer has its
   solid twin (@supports, prefers-reduced-transparency, prefers-contrast: more); a panel's blur and fill sit behind the performance switches
   (--sw-perf-blur / --sw-perf-glass-bg, TOKEN_CONTRACT §7). Menus and sheets are not touched: they keep the opaque menu surface.
   POLISH-SKINS-297: no 1 px lit edge anywhere (the owner's bevel policy); depth is the sheen + the two-layer shadow. */
const rules = `
/* soft 1 - the canvas: the warm and cool blooms under the glass */
:host(sw-app) { background: var(--sw-canvas); }
/* soft 2 - the rail and the phone bar: nav glass over the canvas */
:host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-glass-sheen), var(--sw-nav-glass); -webkit-backdrop-filter: var(--sw-glass-blur-nav); backdrop-filter: var(--sw-glass-blur-nav); border-color: var(--sw-border); }
/* soft 3 - panels: cards and KPI tiles are glass lit warm from the top corner (loop 1: the glass read as flat white), blur and fill behind the performance switches, lifted by the two-layer shadow */
:host(sw-card), :host(sw-kpi) { border-color: var(--sw-border); background: var(--sw-glass-sheen), linear-gradient(165deg, color-mix(in srgb, var(--sw-lit) 9%, transparent), transparent 55%), var(--sw-perf-glass-bg, var(--sw-surface)); -webkit-backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur)); backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur)); box-shadow: var(--sw-shadow-1); }
@media (hover: hover) and (pointer: fine) { :host(sw-card[interactive]:hover), :host(sw-kpi[interactive]:hover) { box-shadow: var(--sw-shadow-2); transform: translateY(var(--sw-hover-lift)); transition: transform var(--sw-t-hover) var(--sw-ease), box-shadow var(--sw-t-hover) var(--sw-ease-color); } }
/* soft 5 - the switch: the thumb sits on a soft shadow (material), the track takes the chosen colour (the "switch" option) */
:host(sw-toggle) button::after { box-shadow: var(--sw-shadow-thumb); }
/* POLISH-SKINS-297 pass 2 - warm glass, lamp-lit (impeccable bolder + delight: the lamp is the hero of this skin) */
/* soft 8 - controls are pills: buttons, chips and the segmented rails (shape only; sizes untouched) */
:host(sw-button) button, :host(sw-chip) button, :host(sw-tabs[data-variant='pill']) .row::before, :host(sw-tabs[data-variant='pill']) .lbl { border-radius: 999px; }
/* soft 9 - the current rail item: a white glass pill lifted off the rail, the accent ink */
:host(sw-app) a.item.a.active { background: var(--sw-surface-solid); color: var(--sw-accent-text); box-shadow: var(--sw-shadow-1); }
/* soft 10 - type (impeccable typeset, apple-design: tracking by size): card titles larger and bold, KPI numerals large, tabular, tight */
:host(sw-card) h3, :host(sw-dialog) h3 { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); letter-spacing: -0.01em; }
:host(sw-kpi) .value { font-size: 28px; font-weight: var(--sw-fw-bold); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
/* soft 11 - empty / loading / error: the glyph sits on a warm glass disc */
:host(sw-state-panel) .icon { background: var(--sw-glass-sheen), color-mix(in srgb, var(--sw-lit) 18%, var(--sw-surface-solid)); color: var(--sw-text); box-shadow: var(--sw-shadow-1); border-radius: 999px; }
/* soft 12 - a dialog arrives from 0.97 (find-animation-opportunities: occasional + spatial); reduced motion: none */
@media (prefers-reduced-motion: no-preference) { :host(sw-dialog) .box { transition: opacity var(--sw-t-med) var(--sw-ease), transform var(--sw-spring-dialog-ms) var(--sw-spring-dialog); @starting-style { opacity: 0; transform: scale(0.97); } } }
/* soft 7 - no backdrop-filter, less transparency asked, or more contrast asked: every glass layer becomes its solid twin (layout unchanged) */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { :host(sw-card), :host(sw-kpi), :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-surface-solid); } }
@media (prefers-reduced-transparency: reduce) { :host(sw-card), :host(sw-kpi), :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-surface-solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }
@media (prefers-contrast: more) { :host(sw-card), :host(sw-kpi), :host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-surface-solid); border-color: var(--sw-border-strong); -webkit-backdrop-filter: none; backdrop-filter: none; } }
${ARX_STATE_RULES}${ARX_MOTION_RULES}`;

/** TokenTable -> the light and the dark record defineSkin takes. */
const col = (t: TokenTable, m: 'light' | 'dark'): Record<string, string> => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v[m]]));

/**
 * POLISH-SKINS-297 (owner open items 2026-10-27): the two options of Arx Soft, chosen in הגדרות › כללי › מראה המערכת.
 *  - "glow": the glow around a lit lamp, two intensities. Offset downward like light falling from the lamp (never a flat halo).
 *  - "switch": the colour of a switch that is on - never green (green stays for status); blue by default.
 * An installation's brand switch colour (ui.toggle_on, design/brand.ts), when set, still wins over the option: it is the stronger choice.
 */
const GLOW = (ring: number, y: number, blur: number, spread: number, a: number) =>
  `0 0 0 1px color-mix(in srgb, var(--sw-lit) ${ring}%, transparent), 0 ${y}px ${blur}px ${spread}px color-mix(in srgb, var(--sw-lit) ${a}%, transparent)`;
const options = [
  {
    id: 'glow',
    labelHe: 'זוהר נורה דולקת',
    default: 'soft',
    choices: [
      { id: 'soft', labelHe: 'עדין', light: { '--sw-lit-glow': GLOW(40, 8, 24, -6, 70) }, dark: { '--sw-lit-glow': GLOW(45, 8, 26, -6, 60) } },
      { id: 'strong', labelHe: 'חזק', light: { '--sw-lit-glow': GLOW(60, 12, 40, -2, 95) }, dark: { '--sw-lit-glow': GLOW(65, 12, 44, 0, 85) } },
    ],
  },
  {
    id: 'switch',
    labelHe: 'צבע מתג דולק',
    default: 'blue',
    choices: [
      { id: 'blue', labelHe: 'כחול', swatch: ['#2f6df6', '#3d7bff'] as const, light: { '--sw-toggle-on': '#2f6df6' }, dark: { '--sw-toggle-on': '#3d7bff' } },
      { id: 'graphite', labelHe: 'גרפיט', swatch: ['#475569', '#8b95a7'] as const, light: { '--sw-toggle-on': '#475569' }, dark: { '--sw-toggle-on': '#8b95a7' } },
      // dataviz validate_palette.js (2026-10-27): indigo and violet sat at normal-vision dE 5.4 from each other and violet at 10 from blue -
      // one family read as three; teal read as green. Kept: blue, graphite (a neutral on purpose), magenta (dE >= 15 from blue).
      { id: 'magenta', labelHe: 'פוקסיה', swatch: ['#c2349b', '#e45bb8'] as const, light: { '--sw-toggle-on': '#c2349b' }, dark: { '--sw-toggle-on': '#e45bb8' } },
    ],
  },
];

export const soft: Skin = defineSkin({
  id: 'soft',
  name: 'Arx Soft',
  nameHe: 'Arx Soft',
  noteHe: 'חומר שקוף על רקע חם וקר, פינות עגולות, תפריטים אטומים',
  stage: 'foundation',
  features: { material: false, bevel: false, pixelEdge: false, glass: true },
  light: col(tokens, 'light'),
  dark: col(tokens, 'dark'),
  rules,
  options,
});