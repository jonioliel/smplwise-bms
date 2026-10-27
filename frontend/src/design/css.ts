/**
 * Turns the token table (tokens.ts) and the skin overrides (skins/*.ts) into CSS text. Pure functions: the app injects the
 * result at boot (design/apply.ts), the unit spec calls the same functions, a designer can print it (see SKIN_AUTHORING_HE.md).
 *
 * Switching mechanism (docs/design/handoff/TOKEN_CONTRACT.md §1 rule 3, decided here):
 *   <html data-skin="classic|domus|tesla" data-theme="light|dark">
 *   - `:root`                                  the light values of the base table (classic)
 *   - `:root[data-theme="dark"]`               the dark values (those that differ from light)
 *   - `:root:not([data-theme="light"]):not([data-theme="dark"])` inside prefers-color-scheme: dark - the same dark set when
 *     the attribute is missing or "auto" (the app always resolves "auto" in JS and sets light|dark; this is the no-JS net)
 *   - `:root[data-skin="x"]` / `[data-theme="dark"]` the skin's overrides, the same three shapes with one more attribute
 *     (a skin override always carries BOTH columns, so a skin's light value can never leak into dark).
 */
import { TOKENS, type TokenTable } from './tokens';
import { SKINS, SKIN_IDS, type SkinId } from './skins';
import { lookBundlesCss } from './look';
import { materialRules } from '../styles/material';

const decls = (t: TokenTable, mode: 'light' | 'dark', onlyDiffering = false): string =>
  Object.entries(t)
    .filter(([, v]) => !onlyDiffering || v.light !== v.dark)
    .map(([k, v]) => `${k}:${v[mode]};`)
    .join('');

const AUTO = ':not([data-theme="light"]):not([data-theme="dark"])';

/** Reduced motion for the Arx motion names (tokens.ts, SKINFOUND-297): every duration 0, no rise, no press scale. */
export const REDUCED_MOTION_ARX = [
  '--sw-t-press:0ms',
  '--sw-t-hover:0ms',
  '--sw-t-slow:0ms',
  '--sw-t-exit:0ms',
  '--sw-t-toast:0ms',
  '--sw-spring-toggle-ms:0ms',
  '--sw-spring-tab-ms:0ms',
  '--sw-spring-dialog-ms:0ms',
  '--sw-spring-drawer-ms:0ms',
  '--sw-spring-kpi-ms:0ms',
  '--sw-stagger:0ms',
  '--sw-enter-y:0px',
  '--sw-enter-ms:0ms',
  '--sw-press-scale:1',
]
  .map((d) => `${d} !important;`)
  .join('');

/** One block set for a selector prefix (`:root` or `:root[data-skin="x"]`) and a table. */
function blocks(prefix: string, t: TokenTable, first: boolean): string {
  const lightDecl = decls(t, 'light');
  const darkDecl = decls(t, 'dark', first); // the base only lists the dark values that differ; a skin lists every override
  let out = '';
  if (lightDecl) out += `${prefix}{${first ? 'color-scheme:light;' : ''}${lightDecl}}\n`;
  if (darkDecl) {
    out += `${prefix}[data-theme="dark"]{${first ? 'color-scheme:dark;' : ''}${darkDecl}}\n`;
    out += `@media (prefers-color-scheme: dark){${prefix}${AUTO}{${first ? 'color-scheme:dark;' : ''}${darkDecl}}}\n`;
  }
  return out;
}

/** The token CSS of the whole product: base table + one block set per skin. */
export function tokensCss(): string {
  let css = blocks(':root', TOKENS, true);
  for (const id of SKIN_IDS) {
    const skin = SKINS[id];
    if (!Object.keys(skin.tokens).length) continue;
    css += blocks(`:root[data-skin="${id}"]`, skin.tokens, false);
  }
  // SKINCOMP-297: a skin's optional dark rail (`ui.rail_tone` = dark puts data-rail="dark" on <html>, design/apply.ts). After the skin
  // blocks: the light block outranks the skin's light block by one attribute, the dark block outranks the skin's dark block likewise.
  for (const id of SKIN_IDS) {
    const rail = SKINS[id].darkRail;
    if (rail && Object.keys(rail).length) css += blocks(`:root[data-skin="${id}"][data-rail="dark"]`, rail, false);
  }
  // the look dials (design/look.ts): token bundles keyed on the data attributes, for the bubble skin
  css += lookBundlesCss();
  // reduced motion: durations become 0 and the hover lift is off (accessibility, TOKEN_CONTRACT §2). !important: a skin's DARK block
  // (`:root[data-skin="x"][data-theme="dark"]`, and the OS-dark twin) repeats every skin override, motion included, with a higher
  // specificity than `:root[data-skin]` - without it bubble / domus / tesla kept their durations in dark under reduced motion (0.1.162 gate)
  // SKINFOUND-297: the Arx motion layer (round 2, r2.css §13) keeps colour / opacity and drops travel, springs and the press scale
  css += `@media (prefers-reduced-motion: reduce){:root,:root[data-skin]{--sw-t-fast:0ms !important;--sw-t-med:0ms !important;--sw-t-sheet:0ms !important;--sw-t-state:0ms !important;--sw-hover-lift:0px !important;${REDUCED_MOTION_ARX}}}\n`;
  // reduced transparency: the translucent layers of every skin become their solid twins
  css += '@media (prefers-reduced-transparency: reduce){:root,:root[data-skin]{--sw-sheet-alpha:1 !important;--sw-glass-blur:none;--sw-glass-blur-nav:none;--sw-glass-blur-sheet:none;--sw-backdrop-blur:none}}\n';
  return css;
}

/** The merged table of a skin: the base with the skin's overrides (what a swatch preview and the contrast tests read). `darkRail`
 * (SKINCOMP-297) adds the skin's dark-rail overrides when it has them. */
export function skinTable(id: SkinId, darkRail = false): TokenTable {
  return { ...TOKENS, ...SKINS[id].tokens, ...(darkRail ? SKINS[id].darkRail ?? {} : {}) };
}

/** A skin's component rules (the sheet adopted into every shadow root) plus the material layer of the glass-capable skins (MD1, styles/material.ts); empty for classic. */
export function skinRules(id: SkinId): string {
  return SKINS[id].rules + materialRules(id);
}

/** Number of rule blocks in a CSS string (the 50-rule budget of a skin counts `{ }` blocks, nested at-rules included). */
export const ruleCount = (css: string): number => (css.match(/\{[^{}]*\}/g) ?? []).length;
