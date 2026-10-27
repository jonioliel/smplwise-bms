import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { ARX_MOTION_RULES, ARX_MOTION_TOKENS } from './arx-motion';
import { ARX_STATE_RULES } from './arx-polish';

/**
 * Skin "Arx Infra" (SKINFOUND-297, owner decision 2026-10-27: direction A of the Arx design system, an ADDITIONAL selectable skin;
 * the default stays classic). Hairline + whisper shadow, one blue, flat canvas, no glass. Most values equal the classic base
 * (tokens.ts); the deltas below are the design system's measured values - private/design-system-2026-10-27/docs/TOKENS.md §1 (the
 * Δ rows) as corrected by round 2 (round2/r2.css §5: the darker muted text, the two-layer shadows, the 24 px page title). Nothing
 * here is a new colour invented for the build.
 *
 * FOUNDATION ONLY: tokens (light AND dark), density and the shared motion layer (arx-motion.ts). The component rules of
 * COMPONENT_RULES.md (KPI without the icon box, rail tokens, the elevator state tokens) come in the build slices after the owner's
 * round-2 decision. The brand mark and the installation logo are NOT touched: they render exactly as in classic.
 */
export const INFRA_TOKENS: TokenTable = {
  // surfaces: the classic values, except the stronger hairline (was #e1e6ef: too close to --sw-border)
  '--sw-border-strong': lt('#d9dfe9', '#2f3c58'),
  // text: the muted tiers of round 2 (5.3:1 on white / 4.9:1 on #eef2f8; dark 5.9:1 on #151c2c)
  '--sw-text-2': lt('#4b5976', '#b0bbd0'),
  '--sw-text-3': lt('#596985', '#93a0b8'),
  // state text on its soft fill (TOKENS.md §1.2 Δ: offline / unknown #5c6573, stale = warning #a04a06 at 4.6:1 on the soft fill)
  '--sw-offline-text': lt('#5c6573', '#b4bdcc'),
  '--sw-unknown-text': lt('#5c6573', '#aab5c9'),
  '--sw-stale-text': lt('#a04a06', '#f5b043'),
  '--sw-warning-text': lt('#a04a06', '#f5b043'),
  // type: a calmer page title (round 2: 24 / 700 / -0.01em), the 2xl tier 22, the phone title 20
  '--sw-fs-2xl': same('22px'),
  '--sw-h1': same('26px'),
  '--sw-h1-weight': same('700'),
  '--sw-h1-tracking': same('-0.01em'),
  '--sw-h1-phone': same('20px'),
  // density (TOKENS.md §1.3): page padding, tile gap, the 44 px touch target, the control heights, rail / bottom bar / tree
  '--sw-page-pad': same('24px'),
  '--sw-page-pad-phone': same('14px'),
  '--sw-gap': same('12px'),
  '--sw-gap-lg': same('16px'),
  '--sw-touch': same('44px'),
  '--sw-ctl-h-sm': same('28px'),
  '--sw-ctl-h-md': same('34px'),
  '--sw-ctl-h-lg': same('40px'),
  '--sw-rail-w': same('72px'),
  '--sw-rail-w-wide': same('72px'),
  '--sw-bottomnav-h': same('56px'),
  '--sw-tree-w': same('260px'),
  '--sw-lh-tight': same('1.2'),
  '--sw-fs-4xl': same('32px'),
  // shape: the dialog one step above the card; round 2's two-layer shadows (rest = 1 px + a 2 % ring, hover, floating)
  '--sw-r-xl': same('18px'),
  '--sw-shadow-1': lt('0 1px 0 rgba(16, 24, 40, 0.04)', '0 1px 0 rgba(0, 0, 0, 0.35)'),
  '--sw-shadow-2': lt('0 4px 14px rgba(34, 49, 76, 0.09), 0 1px 2px rgba(16, 24, 40, 0.05)', '0 6px 18px rgba(0, 0, 0, 0.45)'),
  '--sw-shadow-3': lt('0 18px 44px rgba(34, 49, 76, 0.16), 0 2px 6px rgba(16, 24, 40, 0.06)', '0 18px 44px rgba(0, 0, 0, 0.6)'),
  '--sw-hover-lift': same('0px'), // A never lifts
  // POLISH-SKINS-297: the switch thumb's shadow, two layers (contact + ambient) instead of the flat base one
  '--sw-shadow-thumb': lt('0 1px 2px rgba(16, 24, 40, 0.16), 0 2px 6px rgba(16, 24, 40, 0.1)', '0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35)'),
  // a lit lamp's tint: lighter than the classic 32 % so a lit row reads warm without shouting
  '--sw-lit-soft': lt('rgba(255, 200, 87, 0.22)', 'rgba(255, 181, 71, 0.2)'),
  // POLISH-SKINS-297 pass 2 (owner: the first pass was invisible): the "framed sheet" (taste-skill draw --app, seed 537858390). One
  // tinted blue-grey frame holds the rail and the canvas with no rule between them; the work sits on white sheets with a hairline edge,
  // 14-16 px corners and no shadow at rest - depth is one tone step. A deeper steel blue (not the classic system blue) for the one
  // accent; the colour budget stays under 3 % of the screen. Dark: a near-black navy frame, the sheets one step up.
  '--sw-bg': lt('#e9eef5', '#0a101c'),
  '--sw-canvas': lt('linear-gradient(#e9eef5, #e9eef5)', 'linear-gradient(#0a101c, #0a101c)'),
  '--sw-surface': lt('#ffffff', '#121a2a'),
  '--sw-surface-solid': lt('#ffffff', '#121a2a'),
  '--sw-surface-2': lt('#f5f7fb', '#172136'),
  '--sw-surface-2-solid': lt('#f5f7fb', '#172136'),
  '--sw-surface-3': lt('rgba(20, 40, 80, 0.06)', 'rgba(255, 255, 255, 0.07)'),
  '--sw-nav-glass': lt('#e9eef5', '#0a101c'),
  '--sw-border': lt('#dde4ee', '#1f2a40'),
  '--sw-accent': lt('#1957c9', '#3b6fe0'), // dark: white on it reads 4.6:1 (unit-hud-opaque)
  '--sw-accent-hover': lt('#1449ad', '#2f5fcc'),
  '--sw-accent-soft': lt('rgba(25, 87, 201, 0.1)', 'rgba(92, 141, 255, 0.18)'),
  '--sw-accent-text': lt('#174fb8', '#9dbbff'),
  '--sw-focus': lt('#1957c9', '#9dbbff'),
  '--sw-nav': lt('#1957c9', '#5c8dff'),
  '--sw-toggle-on': lt('#1957c9', '#3b6fe0'),
  // the state inks one step darker on the tinted frame (4.5:1 on #e9eef5)
  '--sw-success-text': lt('#0f6e33', '#7ee29a'),
  '--sw-live-text': lt('#0f6e33', '#7ee29a'),
  '--sw-r-sm': same('8px'),
  '--sw-r-md': same('14px'),
  '--sw-r-lg': same('16px'),
  '--sw-skeleton': lt('#e9eef5', '#172136'),
  // the menu pair is stated explicitly (a skin never inherits it by accident; unit-menu-surfaces.spec.ts): the classic values
  '--sw-menu-surface': lt('#ffffff', '#151c2c'),
  '--sw-menu-border': lt('#e7ebf2', '#232e45'),
  // motion: the shared Arx layer
  ...ARX_MOTION_TOKENS,
};

/* POLISH-SKINS-297: A stays flat (no lift, no glass, no lit edge); the polish is in the type, the hairlines and the states */
const rules = `
/* infra 1 - numbers are tabular on the KPI tiles (round 2 §3), a touch tighter as they grow */
:host(sw-kpi) .value { font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
/* infra 2 - titles: the card and dialog headings one step tighter (apple-design: tracking by size) */
:host(sw-card) h3, :host(sw-dialog) h3 { letter-spacing: -0.005em; }
/* infra 3 - an interactive card answers the pointer with its hairline and the hover shadow, never a lift (mobile-native: only where a pointer hovers) */
@media (hover: hover) and (pointer: fine) { :host(sw-card[interactive]:hover), :host(sw-kpi[interactive]:hover) { border-color: var(--sw-border-strong); box-shadow: var(--sw-shadow-2); transition: border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color); } }
/* infra 4 - the switch's thumb on a crisp two-layer shadow */
:host(sw-toggle) button::after { box-shadow: var(--sw-shadow-thumb); }
/* POLISH-SKINS-297 pass 2 - the framed sheet (impeccable bolder + layout: one move - the frame and the sheets - and everything else quiet) */
/* infra 5 - the frame: the rail and the phone bar sit on the canvas tint with no rule; the current item is a white sheet tab in the accent ink */
:host(sw-app) nav.rail.rail, :host(sw-app) nav.bottom.bottom { background: var(--sw-bg); border-color: transparent; box-shadow: none; }
:host(sw-app) a.item.a.active { background: var(--sw-surface); color: var(--sw-accent-text); box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08); }
/* infra 6 - the sheets: cards, KPI tiles, the building tree and the floor cards are white with the hairline edge */
:host(sw-card), :host(sw-kpi), :host(devices-building) nav.tree, :host(devices-building) section.fcard { background: var(--sw-surface); border-color: var(--sw-border); }
/* infra 7 - type (impeccable typeset): card titles one step up and semibold; KPI numerals 26 px semibold in ink (dataviz: values in text tokens) */
:host(sw-card) h3 { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-semibold); }
:host(sw-kpi) .value { font-size: 26px; font-weight: var(--sw-fw-semibold); }
/* infra 8 - empty / loading / error: the glyph on a sheet tile with the hairline, in the accent ink */
:host(sw-state-panel) .icon { background: var(--sw-surface-2); box-shadow: inset 0 0 0 1px var(--sw-border); color: var(--sw-accent-text); }
${ARX_STATE_RULES}${ARX_MOTION_RULES}`;

export const infra: Skin = { id: 'infra', name: 'Arx Infra', nameHe: 'Arx Infra', noteHe: 'קו שיער וצל עדין, כחול אחד, משטחים אטומים', stage: 'foundation', features: { material: false, bevel: false, pixelEdge: false, glass: false }, tokens: INFRA_TOKENS, rules };
