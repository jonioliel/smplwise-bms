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

/**
 * POLISH-SKINS-297 (owner open items 2026-10-27): a skin OPTION - one small, named choice a skin offers in הגדרות › כללי › מראה המערכת
 * (Arx Soft: the glow of a lit lamp, the colour of a switch that is on). Each choice is a light AND a dark set of token overrides; the
 * default choice's tokens are folded into the skin's own table (it is what the skin draws with nothing chosen), every other choice is
 * emitted by css.ts as `:root[data-skin="<skin>"][data-sko-<option>="<choice>"]` and switched by apply.ts. Options never carry rules:
 * a choice changes tokens only, so it can never move, add or hide anything. Stored per installation in `ui.skin_options`
 * (`{ "<skin>.<option>": "<choice>" }`); an unknown or missing value reads as the default.
 */
export interface SkinOptionChoice {
  id: string;
  labelHe: string;
  /** The colour drawn in the picker's swatch (light, dark); omitted = no swatch. */
  swatch?: readonly [string, string];
  light: Record<string, string>;
  dark: Record<string, string>;
}
export interface SkinOption {
  id: string;
  labelHe: string;
  default: string;
  choices: readonly SkinOptionChoice[];
}
/** A registered option: each choice's overrides as a token table (both columns). */
export interface SkinOptionDef {
  id: string;
  labelHe: string;
  default: string;
  choices: readonly { id: string; labelHe: string; swatch?: readonly [string, string]; tokens: TokenTable }[];
}
/** Option and choice ids: what an attribute name / value and the stored key may carry. */
export const SKIN_OPTION_ID = /^[a-z][a-z0-9_]{0,23}$/;
export const SKIN_OPTION_LABEL_MAX = 16;
export const SKIN_OPTIONS_MAX = 4;
export const SKIN_OPTION_CHOICES_MAX = 6;

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
  /** POLISH-SKINS-297: the skin's options (tokens only; see SkinOption). */
  options?: readonly SkinOption[];
}

/** Turn option data into registry definitions (both columns per choice, the same names in both). */
export function optionDefs(options: readonly SkinOption[] | undefined): SkinOptionDef[] {
  return (options ?? []).map((o) => ({
    id: o.id,
    labelHe: o.labelHe,
    default: o.default,
    choices: o.choices.map((c) => {
      const tokens: TokenTable = {};
      for (const n of Object.keys(c.light)) if (n in c.dark) tokens[n] = { light: c.light[n], dark: c.dark[n] };
      return { id: c.id, labelHe: c.labelHe, ...(c.swatch ? { swatch: c.swatch } : {}), tokens };
    }),
  }));
}

/** The problems of a skin's options (empty = fine): ids, labels, limits, the default, the token names, and the contract with each choice. */
export function optionProblems(skin: Skin, base: TokenTable = TOKENS): string[] {
  const p: string[] = [];
  const opts = skin.options ?? [];
  if (opts.length > SKIN_OPTIONS_MAX) p.push(`more than ${SKIN_OPTIONS_MAX} options`);
  const seen = new Set<string>();
  for (const o of opts) {
    if (!SKIN_OPTION_ID.test(o.id)) p.push(`option id "${o.id}" is not [a-z][a-z0-9_]{0,23}`);
    if (seen.has(o.id)) p.push(`option "${o.id}" is declared twice`);
    seen.add(o.id);
    if (!o.labelHe.trim() || [...o.labelHe].length > SKIN_OPTION_LABEL_MAX) p.push(`option "${o.id}": label empty or longer than ${SKIN_OPTION_LABEL_MAX}`);
    if (o.choices.length < 2 || o.choices.length > SKIN_OPTION_CHOICES_MAX) p.push(`option "${o.id}": 2..${SKIN_OPTION_CHOICES_MAX} choices`);
    if (!o.choices.some((c) => c.id === o.default)) p.push(`option "${o.id}": the default "${o.default}" is not a choice`);
    const names = new Set<string>();
    for (const c of o.choices) for (const n of Object.keys(c.tokens)) names.add(n);
    const cids = new Set<string>();
    for (const c of o.choices) {
      if (!SKIN_OPTION_ID.test(c.id)) p.push(`option "${o.id}": choice id "${c.id}" is not [a-z][a-z0-9_]{0,23}`);
      if (cids.has(c.id)) p.push(`option "${o.id}": choice "${c.id}" twice`);
      cids.add(c.id);
      if (!c.labelHe.trim() || [...c.labelHe].length > SKIN_OPTION_LABEL_MAX) p.push(`option "${o.id}" / "${c.id}": label empty or longer than ${SKIN_OPTION_LABEL_MAX}`);
      // every choice sets the same names, so switching never leaves a value of the previous choice behind
      for (const n of names) if (!c.tokens[n]) p.push(`option "${o.id}" / "${c.id}": does not set ${n} (every choice sets the same tokens)`);
      for (const [n, v] of Object.entries(c.tokens)) {
        if (!base[n]) p.push(`option "${o.id}" / "${c.id}": unknown token ${n}`);
        if (!v.light.trim() || !v.dark.trim()) p.push(`option "${o.id}" / "${c.id}": ${n} needs a light AND a dark value`);
        if (/--sw-m-rim/.test(n)) p.push(`option "${o.id}" / "${c.id}": an option never sets the bevel rim`);
      }
      for (const x of validateSkinTable({ ...base, ...skin.tokens, ...c.tokens })) p.push(`option "${o.id}" / "${c.id}": ${x.rule}${x.scheme ? ` (${x.scheme})` : ''}: ${x.detail}`);
    }
  }
  return p;
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
  // POLISH-SKINS-297: the default choice of every option is what the skin draws with nothing chosen - folded into its own table
  const options = optionDefs(data.options);
  for (const o of options) Object.assign(tokens, o.choices.find((c) => c.id === o.default)?.tokens ?? {});
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
    ...(options.length ? { options } : {}),
  };
  problems.push(...skinProblems(skin, base), ...optionProblems(skin, base));
  if (problems.length) throw new Error(`skin "${data.id}" does not meet the design contract:\n - ${problems.join('\n - ')}`);
  return skin;
}
