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
  // the look dials (design/look.ts): token bundles keyed on the data attributes, for the bubble skin
  css += lookBundlesCss();
  // reduced motion: durations become 0 and the hover lift is off (accessibility, TOKEN_CONTRACT §2)
  css += '@media (prefers-reduced-motion: reduce){:root,:root[data-skin]{--sw-t-fast:0ms;--sw-t-med:0ms;--sw-t-sheet:0ms;--sw-t-state:0ms;--sw-hover-lift:0px}}\n';
  // reduced transparency: the translucent layers of every skin become their solid twins
  css += '@media (prefers-reduced-transparency: reduce){:root,:root[data-skin]{--sw-sheet-alpha:1 !important;--sw-glass-blur:none;--sw-glass-blur-nav:none;--sw-glass-blur-sheet:none;--sw-backdrop-blur:none}}\n';
  return css;
}

/** The merged table of a skin: the base with the skin's overrides (what a swatch preview and the contrast tests read). */
export function skinTable(id: SkinId): TokenTable {
  return { ...TOKENS, ...SKINS[id].tokens };
}

/** A skin's component rules (the sheet adopted into every shadow root) plus the material layer of the glass-capable skins (MD1, styles/material.ts); empty for classic. */
export function skinRules(id: SkinId): string {
  return SKINS[id].rules + materialRules(id);
}

/** Number of rule blocks in a CSS string (the 50-rule budget of a skin counts `{ }` blocks, nested at-rules included). */
export const ruleCount = (css: string): number => (css.match(/\{[^{}]*\}/g) ?? []).length;
