/**
 * DESIGNTOKENS-297: a skin as DATA. A new skin is a plain object - its names, a light and a dark token set, the features it may use and
 * (optionally) a bounded set of component rules - passed through defineSkin(), which checks it against the token table (tokens.ts), the
 * semantic contract (semantic.ts) and the feature policy below, and returns the `Skin` the registry (skins/index.ts) holds.
 * Registering it is then one id in SKIN_IDS + one entry in SKINS (and the `ui.skin` pattern of routers/settings.py, which
 * tests/unit-designtokens-297.spec.ts keeps in step). See docs/design/SKIN_AUTHORING_HE.md §2א.
 *
 * This module imports nothing from the registry at run time (types only), so a skin file may call defineSkin() without a cycle.
 */
import { TOKENS, type TokenTable } from '../tokens';
import { validateSkinTable } from '../semantic';
import type { Skin, SkinId } from './index';

/** The rule budget of one skin (`{ }` blocks of its `rules`). */
export const SKIN_RULE_BUDGET = 50;
/** Number of rule blocks in a CSS string (the 50-rule budget of a skin counts `{ }` blocks, nested at-rules included). */
export const ruleCount = (css: string): number => (css.match(/\{[^{}]*\}/g) ?? []).length;

/**
 * Where a skin is in its life:
 *  - `stable`: selectable, in the per-skin layout / evidence / pixel matrix of the specs;
 *  - `foundation`: selectable, token-tested, but kept out of that matrix until it has pixel baselines (SKINFOUND-297);
 *  - `frozen`: kept in the tree, never offered, rejected by writes, read as the fallback skin (BUBBLE-FREEZE-295).
 */
export type SkinStage = 'stable' | 'foundation' | 'frozen';

/** The pixel / bevel features a skin may draw. Declared per skin; checked against what its tokens and rules really do. */
export interface SkinFeatures {
  /** The MD1 material layer (styles/material.ts: sheen, shade, wash, rim, lift) is appended to the skin's rules. */
  material: boolean;
  /** The bevel: the 1 px relief rim of the material layer (inset top highlight + inner light / dark edges). Policy: BEVEL_SKINS only. */
  bevel: boolean;
  /** The 1 px light line along a panel's top edge (`--sw-highlight` is not transparent): the "pixel" edge of a glass panel. */
  pixelEdge: boolean;
  /** Backdrop blur on panels, chrome or sheets (a `--sw-glass-blur*` token is not `none`). */
  glass: boolean;
}

/** Owner policy (DESIGNTOKENS-297 brief, 2026-10-27): bevels are allowed in the classic and domus skins only. */
export const BEVEL_SKINS: readonly SkinId[] = ['classic', 'domus'];
export const NO_FEATURES: SkinFeatures = { material: false, bevel: false, pixelEdge: false, glass: false };

/** Limits of the picker labels (break-ui: a label without a limit is a layout bug waiting for a long name). */
export const SKIN_NAME_MAX = 24;
export const SKIN_NOTE_MAX = 90;

/** What a merged token table really draws: the two token-driven features. */
export function derivedFeatures(t: TokenTable): Pick<SkinFeatures, 'pixelEdge' | 'glass'> {
  const transparent = (v: string) => /^\s*(transparent|rgba\([^)]*,\s*0(\.0+)?\s*\))\s*$/i.test(v);
  const isNone = (v: string) => /^\s*none\s*$/i.test(v);
  const both = (n: string) => [t[n]?.light ?? '', t[n]?.dark ?? ''];
  return {
    pixelEdge: both('--sw-highlight').some((v) => !transparent(v)),
    glass: ['--sw-glass-blur', '--sw-glass-blur-nav', '--sw-glass-blur-sheet'].some((n) => both(n).some((v) => !isNone(v))),
  };
}

export interface SkinData {
  id: SkinId;
  /** English name (developers) and the Hebrew name shown in הגדרות › כללי › מראה המערכת. */
  name: string;
  nameHe: string;
  /** One line under the name in the picker. */
  noteHe: string;
  stage?: SkinStage;
  /** The overrides of the light and the dark scheme: the SAME names in both (a skin's light value must never leak into dark). */
  light: Record<string, string>;
  dark: Record<string, string>;
  /** Defaults to "nothing": no material, no bevel; pixelEdge / glass are derived from the tokens when not given. */
  features?: Partial<SkinFeatures>;
  /** Component rules for the shadow roots, inside the 50-rule budget, tokens only (SKIN_AUTHORING_HE.md §2-§4). */
  rules?: string;
}

/** The problems of a skin (empty = it may be registered). `base` is the table the skin overrides (tokens.ts by default). */
export function skinProblems(skin: Skin, base: TokenTable = TOKENS): string[] {
  const p: string[] = [];
  const label = (s: string, max: number, what: string) => {
    if (!s.trim()) p.push(`${what} is empty`);
    else if ([...s].length > max) p.push(`${what} is longer than ${max} characters`);
  };
  label(skin.name, SKIN_NAME_MAX, 'name');
  label(skin.nameHe, SKIN_NAME_MAX, 'nameHe');
  label(skin.noteHe, SKIN_NOTE_MAX, 'noteHe');
  for (const [n, v] of Object.entries(skin.tokens)) {
    if (!base[n]) p.push(`unknown token ${n} (declare it in tokens.ts first)`);
    if (!v.light.trim() || !v.dark.trim()) p.push(`${n} needs a light AND a dark value`);
  }
  // SKINCOMP-297: the optional dark rail rewrites only the --sw-rail-* names, both columns
  for (const [n, v] of Object.entries(skin.darkRail ?? {})) {
    if (!n.startsWith('--sw-rail-') || !base[n]) p.push(`darkRail: ${n} is not a --sw-rail-* token of tokens.ts`);
    if (!v.light.trim() || !v.dark.trim()) p.push(`darkRail: ${n} needs a light AND a dark value`);
  }
  if (ruleCount(skin.rules) > SKIN_RULE_BUDGET) p.push(`rules: ${ruleCount(skin.rules)} blocks > ${SKIN_RULE_BUDGET}`);
  const f = skin.features;
  if (f.bevel && !BEVEL_SKINS.includes(skin.id) && skin.stage !== 'frozen') p.push(`bevel is allowed only in ${BEVEL_SKINS.join(', ')}`);
  if (f.material && !f.bevel) p.push('the material layer carries the bevel rim: material needs bevel');
  if (!f.bevel && /--sw-m-rim/.test(skin.rules + Object.keys(skin.tokens).join(' '))) p.push('the rules / tokens set the bevel rim (--sw-m-rim) without the bevel feature');
  const merged = { ...base, ...skin.tokens };
  const d = derivedFeatures(merged);
  if (d.pixelEdge !== f.pixelEdge) p.push(`pixelEdge is declared ${f.pixelEdge} but --sw-highlight draws ${d.pixelEdge}`);
  if (d.glass !== f.glass) p.push(`glass is declared ${f.glass} but the --sw-glass-blur* tokens draw ${d.glass}`);
  for (const c of validateSkinTable(merged)) p.push(`${c.rule}${c.scheme ? ` (${c.scheme})` : ''}: ${c.detail}`);
  return p;
}

/** Turn skin data into a registry entry; throws with every problem listed when the data breaks the contract. */
export function defineSkin(data: SkinData, base: TokenTable = TOKENS): Skin {
  const problems: string[] = [];
  const lightNames = Object.keys(data.light);
  const darkNames = Object.keys(data.dark);
  for (const n of lightNames) if (!(n in data.dark)) problems.push(`${n} has a light value and no dark value`);
  for (const n of darkNames) if (!(n in data.light)) problems.push(`${n} has a dark value and no light value`);
  const tokens: TokenTable = {};
  for (const n of lightNames) if (n in data.dark) tokens[n] = { light: data.light[n], dark: data.dark[n] };
  const merged = { ...base, ...tokens };
  const skin: Skin = {
    id: data.id,
    name: data.name,
    nameHe: data.nameHe,
    noteHe: data.noteHe,
    stage: data.stage ?? 'foundation',
    tokens,
    rules: data.rules ?? '',
    features: { ...NO_FEATURES, ...derivedFeatures(merged), ...(data.features ?? {}) },
  };
  problems.push(...skinProblems(skin, base));
  if (problems.length) throw new Error(`skin "${data.id}" does not meet the design contract:\n - ${problems.join('\n - ')}`);
  return skin;
}
