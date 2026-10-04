/**
 * MD1 material dials (owner decision 2026-10-03; mockups docs/design/compare/material-dials on pilot/material-dials-mockups):
 * ONE material formula - sheen, shade, state wash, bevel rim, lift, grain, glow - written once here and adopted into every shadow
 * root as part of the skin sheet (design/css.ts skinRules appends it for the glass-capable skins, bubble and domus; classic ignores
 * it). The numbers are tokens (design/tokens.ts `--sw-m-*`): the `material` preset writes them (design/look.ts MATERIAL_BUNDLE),
 * `depth` and `tint` multiply them (DEPTH_BUNDLE / TINT_BUNDLE), all keyed on the `data-bubble-*` attributes of <html> or of a
 * settings preview box. With every dial off (the product defaults) each layer is fully transparent and every shadow has alpha 0, so
 * the pixels of 0.1.156 are unchanged until an owner turns a dial.
 *
 * Where the tone comes from (state = shape + word, never colour alone: the dot and the word always stay):
 *   - a tile sets `--sw-m-tone` (the colour) and `--sw-m-on: 1` (its state carries a tone) - sw-pill in willUpdate (glass surface
 *     only: on the fill / flat surfaces the state already IS the fill, on the gradient surface two colours would fight), the home's
 *     area tile inline (`--sw-lit` when something is on), sw-kpi by its tone attribute below; off / unavailable / idle tiles never;
 *   - lists (density row, the home's area rows) take the tone in a 6 px side stripe, NEVER as a washed row (section 2 of the mockups
 *     at tint = strong shows why); tables get nothing (dot + word, as today);
 *   - the neon bloom (`--sw-m-glow-on`) exists only around a tile whose tone is DECORATIVE (the pill's hue ring, the area's hue) and
 *     never around a state tone: alarm, door-open, offline and every other state colour stay reserved and never glow (the lead's
 *     reservation, mitigated here in code); never in a list either (rows touch).
 *   - the wash share is capped at `--sw-m-wash-cap`, computed per skin x palette x scheme by design/contrast.ts so that text and
 *     muted text keep 4.5:1 on every tone; the chrome (tree, rail, dock, strip) takes the rim and the lift only, never a tone.
 *   - performance: no NEW backdrop-filter anywhere. The glass pill's full-tier blur follows the preset (`--sw-m-blur`: frosted 20,
 *     paper 0, neon 14); the lite tier (`--sw-perf-blur: none`) wins over every preset; the chrome keeps `--sw-glass-blur-nav`.
 *   - the light of the sheen is physical (top-left) in both text directions: decoration, not geometry, so it is not mirrored.
 *
 * Our own formula and numbers (README of the mockups, "Licence"); color-mix() and calc() inside colour alphas are used as the pill's
 * gradient surface already does (baseline 2023).
 */

/** The effective depth / tint multipliers and the capped wash share, as declarations (every material host repeats them). */
const VARS = '--sw-m-d: var(--sw-m-depth); --sw-m-t: calc(var(--sw-m-tint) * var(--sw-m-on, 0)); --sw-m-w: min(calc(var(--sw-m-wash) * var(--sw-m-t)), var(--sw-m-wash-cap));';

/** The background layers: sheen (top-left white), shade (bottom-right dark), the 135deg state wash, the grain. */
export const MATERIAL_LAYERS =
  'radial-gradient(120% 120% at 22% 8%, rgba(255, 255, 255, calc(var(--sw-m-sheen) * var(--sw-m-d))) 0%, transparent 60%), ' +
  'radial-gradient(90% 80% at 82% 100%, rgba(0, 0, 0, calc(var(--sw-m-shade) * var(--sw-m-d))) 0%, transparent 60%), ' +
  'linear-gradient(135deg, color-mix(in srgb, var(--sw-m-tone, transparent) var(--sw-m-w), transparent) 0%, transparent 72%), ' +
  'var(--sw-m-grain)';

/** The shadows: the 1 px bevel rim (top highlight, inner light edge, inner dark edge), paper's ink ring, the tone's inner bottom glow, the lift, neon's bloom. */
export const MATERIAL_SHADOWS =
  'inset 0 1px 0 rgba(255, 255, 255, calc(0.22 * var(--sw-m-rim) * var(--sw-m-d))), ' +
  'inset 2px 2px 5px -3px rgba(255, 255, 255, calc(0.5 * var(--sw-m-rim) * var(--sw-m-d))), ' +
  'inset -2px -2px 4px -2px rgba(0, 0, 0, calc(0.12 * var(--sw-m-rim) * var(--sw-m-d))), ' +
  'inset 0 0 0 1px var(--sw-m-border), ' +
  'inset 0 -2px 4px color-mix(in srgb, var(--sw-m-tone, transparent) calc(30% * var(--sw-m-t)), transparent), ' +
  '0 10px 30px -16px rgba(0, 0, 0, calc(var(--sw-m-lift) * var(--sw-m-d))), ' +
  '0 0 var(--sw-m-glow) color-mix(in srgb, var(--sw-m-glow-c, var(--sw-accent)) calc(55% * var(--sw-m-glowa) * var(--sw-m-glow-on, 0)), transparent)';

const BLUR = '-webkit-backdrop-filter: var(--sw-perf-blur, blur(var(--sw-m-blur)) saturate(150%)); backdrop-filter: var(--sw-perf-blur, blur(var(--sw-m-blur)) saturate(150%));';

/** The KPI tiles carry their tone through the `tone` attribute (the same colours their icon already uses); the same for both skins. */
const KPI_TONES =
  `:host(sw-kpi[tone='error']), :host(sw-kpi[tone='offline']) { --sw-m-tone: var(--sw-danger); --sw-m-on: 1; }\n` +
  `:host(sw-kpi[tone='stale']), :host(sw-kpi[tone='partial']) { --sw-m-tone: var(--sw-warning); --sw-m-on: 1; }\n` +
  `:host(sw-kpi[tone='live']) { --sw-m-tone: var(--sw-success); --sw-m-on: 1; }\n`;

/** The material rules of the bubble skin (appended to its sheet). */
const BUBBLE = `
/* material 1 - tiles, cards, widgets, the security strip and the opaque pills: the layers over the surface, the rim and the lift (today's bubble shadow is none, so the material is the whole shadow) */
:host(sw-card), :host(sw-card[interactive]:hover), :host(sw-kpi), :host(devices-building[data-skin='bubble']) a.tile, :host(devices-building[data-skin='bubble']) a.tile:hover, :host(devices-building[data-skin='bubble']) .arow, :host(devices-building[data-skin='bubble']) .arow:hover, :host(home-widgets[data-skin='bubble']) .wg, :host([data-skin='bubble']) .sec-strip, :host(sw-pill:not([data-surface='gradient']):not([data-surface='glass']):not([accent])), :host(sw-pill:not([data-surface='gradient']):not([data-surface='glass']):not([accent]):hover) { ${VARS} background-image: ${MATERIAL_LAYERS}; box-shadow: ${MATERIAL_SHADOWS}; }
/* material 2 - the glass pill keeps its highlight and ring under the rim; its full-tier blur follows the preset (the lite tier's none wins) */
:host(sw-pill[data-surface='glass']:not([accent])), :host(sw-pill[data-surface='glass']:not([accent]):hover) { ${VARS} background-image: ${MATERIAL_LAYERS}; box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), ${MATERIAL_SHADOWS}; ${BLUR} }
/* material 3 - the gradient pill: two colours on one tile fight, so no wash and no layers; the rim and the lift stay */
:host(sw-pill[data-surface='gradient']:not([accent])) { ${VARS} --sw-m-on: 0; box-shadow: ${MATERIAL_SHADOWS}; }
/* material 4 - chrome: the tree and the rail keep their glass and highlight, the rim and the lift come on top; never a tone */
:host(devices-building) nav.tree, :host(sw-app) nav.rail.rail { ${VARS} --sw-m-on: 0; background-image: ${MATERIAL_LAYERS}; box-shadow: inset 0 1px 0 var(--sw-highlight), ${MATERIAL_SHADOWS}; }
:host(sw-app) nav.bottom.bottom .stack { ${VARS} --sw-m-on: 0; background-image: ${MATERIAL_LAYERS}; box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-2), ${MATERIAL_SHADOWS}; }
:host(sw-app) .float .pillrow, :host(sw-app) .searchpanel { ${VARS} --sw-m-on: 0; background-image: ${MATERIAL_LAYERS}; box-shadow: inset 0 1px 0 var(--sw-highlight), var(--sw-shadow-2), ${MATERIAL_SHADOWS}; }
/* material 5 - where the tone comes from (KPI tiles; the pill and the home tile set theirs in JS / inline) */
${KPI_TONES}/* material 6 - neon: the bloom only around a tile whose tone is decorative (the hue ring), never a state colour, never in a list */
:host(sw-pill[on]:not([accent]):not([data-density='row'])), :host(devices-building[data-skin='bubble']) a.tile.on { --sw-m-glow-on: 1; --sw-m-glow-c: var(--h, var(--sw-accent)); }
/* material 7 - lists: the tone goes to a 6 px side stripe (the tint dial scales it 0 / 6 px), never the row; the stripe sits inside the pill */
:host(sw-pill[data-density='row'][on]:not([accent])) { border-inline-start: calc(6px * min(1, var(--sw-m-tint))) solid var(--sw-m-tone, var(--sw-lit)); }
:host(devices-building[data-skin='bubble']) .arow[data-on='true'] { border-inline-start: calc(6px * min(1, var(--sw-m-tint))) solid var(--sw-m-tone, var(--sw-lit)); }
/* material 8 - reduced transparency: no material blur on a pill either (the pill's own rule already drops its fill) */
@media (prefers-reduced-transparency: reduce) { :host(sw-pill[data-surface='glass']:not([accent])) { -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

/** The material rules of the domus skin: the shared cards and KPI tiles only (its own glass sheen and shadows stay underneath). */
const DOMUS = `
/* material (domus) 1 - cards and KPI tiles: the layers over the glass sheen, the rim and the lift over shadow-1 and the highlight */
:host(sw-card), :host(sw-kpi) { ${VARS} background-image: ${MATERIAL_LAYERS}, var(--sw-glass-sheen); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight), ${MATERIAL_SHADOWS}; }
:host(sw-card[interactive]:hover) { ${VARS} background-image: ${MATERIAL_LAYERS}, var(--sw-glass-sheen); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight), ${MATERIAL_SHADOWS}; }
/* material (domus) 2 - the KPI tone */
${KPI_TONES}`;

/** The skins that draw the material (the two glass-capable skins of the mockups' overlap panel). */
export const MATERIAL_SKINS = ['bubble', 'domus'] as const;
/** The material layer's own rule budget (next to the skins' 50): it is one formula on a handful of hosts. */
export const MATERIAL_RULE_BUDGET = 20;

/** The material rules a skin's sheet gets appended; '' for a skin that does not draw the material. */
export function materialRules(skin: string): string {
  if (skin === 'bubble') return BUBBLE;
  if (skin === 'domus') return DOMUS;
  return '';
}
