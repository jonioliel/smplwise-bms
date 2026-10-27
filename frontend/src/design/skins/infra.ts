import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';
import { ARX_MOTION_RULES, ARX_MOTION_TOKENS } from './arx-motion';
import { ARX_KPI_RULES, ARX_RAIL_RULES, INFRA_RAIL_FILL_RULES } from './arx-components';

/**
 * Skin "Arx Infra" (SKINFOUND-297, owner decision 2026-10-27: direction A of the Arx design system, an ADDITIONAL selectable skin;
 * the default stays classic). Hairline + whisper shadow, one blue, flat canvas, no glass. Most values equal the classic base
 * (tokens.ts); the deltas below are the design system's measured values - private/design-system-2026-10-27/docs/TOKENS.md §1 (the
 * Δ rows) as corrected by round 2 (round2/r2.css §5: the darker muted text, the two-layer shadows, the 24 px page title). Nothing
 * here is a new colour invented for the build.
 *
 * SKINFOUND-297: tokens (light AND dark), density and the shared motion layer (arx-motion.ts). SKINCOMP-297: the component rules
 * (arx-components.ts: the KPI tile without the icon box, the rail on the `--sw-rail-*` tokens) and the optional dark rail (direction D,
 * INFRA_DARK_RAIL below, `ui.rail_tone`). The brand mark and the installation logo are NOT touched: they render exactly as in classic.
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
  '--sw-h1': same('24px'),
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
  '--sw-r-xl': same('16px'),
  '--sw-shadow-1': lt('0 1px 2px rgba(16, 24, 40, 0.05), 0 0 0 1px rgba(16, 24, 40, 0.02)', '0 1px 2px rgba(0, 0, 0, 0.4)'),
  '--sw-shadow-2': lt('0 4px 14px rgba(34, 49, 76, 0.09), 0 1px 2px rgba(16, 24, 40, 0.05)', '0 6px 18px rgba(0, 0, 0, 0.45)'),
  '--sw-shadow-3': lt('0 18px 44px rgba(34, 49, 76, 0.16), 0 2px 6px rgba(16, 24, 40, 0.06)', '0 18px 44px rgba(0, 0, 0, 0.6)'),
  '--sw-hover-lift': same('0px'), // A never lifts
  // the menu pair is stated explicitly (a skin never inherits it by accident; unit-menu-surfaces.spec.ts): the classic values
  '--sw-menu-surface': lt('#ffffff', '#151c2c'),
  '--sw-menu-border': lt('#e7ebf2', '#232e45'),
  // SKINCOMP-297: the rail (TOKENS.md §1.2; round 2, r2.css §5, takes the active pill one step lighter: #e9f0ff) - white with the panel
  // hairline in light, a navy one step below the panel in dark
  '--sw-rail-bg': lt('#ffffff', '#0f1526'),
  '--sw-rail-text': lt('#4b5976', '#a9b4ca'),
  '--sw-rail-active': lt('#2062ec', '#8fb2ff'),
  '--sw-rail-active-bg': lt('#e9f0ff', 'rgba(91, 140, 255, 0.18)'),
  '--sw-rail-border': lt('#e7ebf2', '#232e45'),
  // motion: the shared Arx layer
  ...ARX_MOTION_TOKENS,
};

/**
 * SKINCOMP-297: direction D of the design system = Arx Infra with a navy rail (DESIGN.md: take from B the `ui.rail_tone` setting). The
 * light column is direction B's rail (TOKENS.md §2: #141b2b, a white active label on a 10 % white pill); in the dark scheme Infra's rail
 * is navy already, so the dark column is Infra's own dark rail (the setting changes nothing there).
 */
export const INFRA_DARK_RAIL: TokenTable = {
  '--sw-rail-bg': lt('#141b2b', '#0f1526'),
  '--sw-rail-text': lt('#aab6cc', '#a9b4ca'),
  '--sw-rail-active': lt('#ffffff', '#8fb2ff'),
  '--sw-rail-active-bg': lt('rgba(255, 255, 255, 0.1)', 'rgba(91, 140, 255, 0.18)'),
  '--sw-rail-border': lt('#141b2b', '#232e45'),
};

const rules = `
/* infra 1 - numbers are tabular on the KPI tiles (round 2 §3) */
:host(sw-kpi) .value { font-variant-numeric: tabular-nums; }
${ARX_KPI_RULES}${INFRA_RAIL_FILL_RULES}${ARX_RAIL_RULES}${ARX_MOTION_RULES}`;

export const infra: Skin = { id: 'infra', name: 'Arx Infra', nameHe: 'Arx Infra', noteHe: 'קו שיער וצל עדין, כחול אחד, משטחים אטומים', tokens: INFRA_TOKENS, rules, darkRail: INFRA_DARK_RAIL };
