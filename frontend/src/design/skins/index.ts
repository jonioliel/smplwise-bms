/**
 * The skin registry. A skin = token overrides (both columns, always) + a bounded set of component rules (<= 50 `{ }` blocks).
 * Adding a skin: one file in this folder + one line in SKINS below; see docs/design/SKIN_AUTHORING_HE.md. DESIGNTOKENS-297: a new skin
 * can be pure data - `defineSkin({ id, name, nameHe, noteHe, light, dark, features })` (define.ts) checks it against the token table,
 * the semantic contract (semantic.ts) and the bevel policy, and returns the entry for SKINS.
 * Keep SKIN_IDS and FROZEN_SKINS in step with the validation of `ui.skin` in smplwise_vms/backend/smplwise/routers/settings.py
 * (tests/unit-designtokens-297.spec.ts compares them).
 * FROZEN SKINS (owner 2026-10-26, docs/changes/BUBBLE-FREEZE-295.md): a frozen skin keeps all its code and CSS in the tree but is not
 * offered in any picker, is rejected by new writes, and a stored / requested frozen id is read as FROZEN_FALLBACK_SKIN at runtime.
 */
import type { TokenTable } from '../tokens';
import { SKIN_OPTION_ID, type SkinFeatures, type SkinOptionDef, type SkinStage } from './define';
import { classic } from './classic';
import { domus } from './domus';
import { tesla } from './tesla';
import { bubble } from './bubble';
import { crystal } from './crystal';
import { infra } from './infra';
import { soft } from './soft';

export { SKIN_RULE_BUDGET, BEVEL_SKINS, defineSkin, skinProblems, optionProblems, derivedFeatures, type SkinData, type SkinFeatures, type SkinStage, type SkinOption, type SkinOptionDef } from './define';

export const SKIN_IDS = ['classic', 'domus', 'tesla', 'bubble', 'crystal', 'infra', 'soft'] as const;
export type SkinId = (typeof SKIN_IDS)[number];
export const DEFAULT_SKIN: SkinId = 'classic';

export interface Skin {
  id: SkinId;
  /** The name shown in הגדרות › עיצוב (Hebrew) and for developers (English). */
  name: string;
  nameHe: string;
  /** One line under the name in the picker. */
  noteHe: string;
  /** DESIGNTOKENS-297: where the skin is in its life (define.ts SkinStage); FROZEN_SKINS / FOUNDATION_SKINS are read from it. */
  stage: SkinStage;
  /** DESIGNTOKENS-297: the pixel / bevel features the skin may draw (define.ts SkinFeatures; bevels: classic and domus only). */
  features: SkinFeatures;
  /** Token overrides: every entry has a light AND a dark value; a name must exist in tokens.ts. */
  tokens: TokenTable;
  /** Component rules, written for the shadow roots: `:host(sw-card) .x { }` (see apply.ts for how they are adopted). */
  rules: string;
  /** POLISH-SKINS-297: the skin's options (define.ts SkinOption): token-only choices offered in Settings, stored in `ui.skin_options`. */
  options?: readonly SkinOptionDef[];
}

export const SKINS: Record<SkinId, Skin> = { classic, domus, tesla, bubble, crystal, infra, soft };

/**
 * Skins that are frozen (`stage: 'frozen'`): not selectable, not publishable. Unfreeze = set the skin's stage back (and re-enable the
 * specs, see docs/changes/BUBBLE-FREEZE-295.md). Today: bubble.
 */
export const FROZEN_SKINS: readonly SkinId[] = SKIN_IDS.filter((id) => SKINS[id].stage === 'frozen');
/** What a frozen skin is read as. */
export const FROZEN_FALLBACK_SKIN: SkinId = 'domus';
/** The skins a person can choose and a write may carry: the registry without the frozen ones. */
export const SELECTABLE_SKIN_IDS: readonly SkinId[] = SKIN_IDS.filter((id) => !FROZEN_SKINS.includes(id));
/**
 * BUBBLECLEAN-297: the bubble-only screens (Settings > General > Look dials card, the #/styleguide/bubble demo page) are offered only
 * while the bubble skin is NOT frozen. Their code stays in the tree (docs/design/BUBBLE_FREEZE_RESTORE.md).
 */
export const BUBBLE_SCREENS_ENABLED: boolean = !FROZEN_SKINS.includes('bubble');
/**
 * SKINFOUND-297 (owner 2026-10-27): the Arx design-system skins ("Arx Infra" = direction A, "Arx Soft" = direction C) at their
 * FOUNDATION stage (`stage: 'foundation'`): registered, selectable in the look settings, token-tested (contrast, menus, HUD) like every
 * skin, but kept out of the broad "for each skin" layout / evidence / pixel matrix of the specs (tests/helpers/frozen-skins.ts) until the
 * owner's round-2 decision - they have no pixel baselines yet. Leaving the foundation stage = set the skin's stage to `stable`.
 */
export const FOUNDATION_SKINS: readonly SkinId[] = SKIN_IDS.filter((id) => SKINS[id].stage === 'foundation');

export const isSkinId = (v: unknown): v is SkinId => typeof v === 'string' && (SKIN_IDS as readonly string[]).includes(v);

export const isFrozenSkin = (v: unknown): boolean => isSkinId(v) && FROZEN_SKINS.includes(v);
/** A registry id that may be chosen / written (not frozen). */
export const isSelectableSkin = (v: unknown): v is SkinId => isSkinId(v) && !FROZEN_SKINS.includes(v);
/** The skin to DRAW for a stored / requested value: a frozen id reads as the fallback skin; null for anything that is no skin id. */
export const resolveSkin = (v: unknown): SkinId | null => (isSkinId(v) ? (FROZEN_SKINS.includes(v) ? FROZEN_FALLBACK_SKIN : v) : null);

/** POLISH-SKINS-297: the most `ui.skin_options` may hold (keep in step with SKIN_OPTIONS_MAX_ENTRIES in routers/settings.py). */
export const SKIN_OPTIONS_MAX_ENTRIES = 32;

/**
 * `ui.skin_options` in canonical form: `{ "<skin>.<option>": "<choice>" }`, only registered skins, options and choices (an object or its
 * JSON text; anything else, a corrupt value or an unknown id, is dropped - it then reads as the option's default).
 */
export function normalizeSkinOptions(v: unknown): Record<string, string> {
  let o: unknown = v;
  if (typeof v === 'string') {
    try {
      o = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out: Record<string, string> = {};
  for (const [k, c] of Object.entries(o as Record<string, unknown>)) {
    if (Object.keys(out).length >= SKIN_OPTIONS_MAX_ENTRIES) break;
    const [skin, opt, ...rest] = k.split('.');
    if (rest.length || !isSkinId(skin) || typeof c !== 'string' || !SKIN_OPTION_ID.test(c)) continue;
    const def = SKINS[skin].options?.find((x) => x.id === opt);
    if (def?.choices.some((x) => x.id === c)) out[k] = c;
  }
  return out;
}

/** The choice in force for each option of a skin (the stored one, else the default). */
export function skinOptionChoices(id: SkinId, stored: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of SKINS[id].options ?? []) {
    const c = stored[`${id}.${o.id}`];
    out[o.id] = c && o.choices.some((x) => x.id === c) ? c : o.default;
  }
  return out;
}
