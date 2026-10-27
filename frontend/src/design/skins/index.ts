/**
 * The skin registry. A skin = token overrides (both columns, always) + a bounded set of component rules (<= 50 `{ }` blocks).
 * Adding a skin: one file in this folder + one line in SKINS below; see docs/design/SKIN_AUTHORING_HE.md.
 * Keep SKIN_IDS and FROZEN_SKINS in step with the validation of `ui.skin` in smplwise_vms/backend/smplwise/routers/settings.py.
 * FROZEN SKINS (owner 2026-10-26, docs/changes/BUBBLE-FREEZE-295.md): a frozen skin keeps all its code and CSS in the tree but is not
 * offered in any picker, is rejected by new writes, and a stored / requested frozen id is read as FROZEN_FALLBACK_SKIN at runtime.
 */
import type { TokenTable } from '../tokens';
import { classic } from './classic';
import { domus } from './domus';
import { tesla } from './tesla';
import { bubble } from './bubble';
import { crystal } from './crystal';

export const SKIN_IDS = ['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const;
export type SkinId = (typeof SKIN_IDS)[number];
export const DEFAULT_SKIN: SkinId = 'classic';
/** Skins that are frozen: not selectable, not publishable. Unfreeze = empty this list (and re-enable the specs, see docs/changes/BUBBLE-FREEZE-295.md). */
export const FROZEN_SKINS: readonly SkinId[] = ['bubble'];
/** What a frozen skin is read as. */
export const FROZEN_FALLBACK_SKIN: SkinId = 'domus';
/** The skins a person can choose and a write may carry: the registry without the frozen ones. */
export const SELECTABLE_SKIN_IDS: readonly SkinId[] = SKIN_IDS.filter((id) => !FROZEN_SKINS.includes(id));
/**
 * BUBBLECLEAN-297: the bubble-only screens (Settings > General > Look dials card, the #/styleguide/bubble demo page) are offered only
 * while the bubble skin is NOT frozen. Their code stays in the tree (docs/design/BUBBLE_FREEZE_RESTORE.md).
 */
export const BUBBLE_SCREENS_ENABLED: boolean = !FROZEN_SKINS.includes('bubble');
/** The rule budget of one skin (`{ }` blocks of its `rules`). */
export const SKIN_RULE_BUDGET = 50;

export interface Skin {
  id: SkinId;
  /** The name shown in הגדרות › עיצוב (Hebrew) and for developers (English). */
  nameHe: string;
  name: string;
  /** One line under the name in the picker. */
  noteHe: string;
  /** Token overrides: every entry has a light AND a dark value; a name must exist in tokens.ts. */
  tokens: TokenTable;
  /** Component rules, written for the shadow roots: `:host(sw-card) .x { }` (see apply.ts for how they are adopted). */
  rules: string;
}

export const SKINS: Record<SkinId, Skin> = { classic, domus, tesla, bubble, crystal };

export const isSkinId = (v: unknown): v is SkinId => typeof v === 'string' && (SKIN_IDS as readonly string[]).includes(v);

export const isFrozenSkin = (v: unknown): boolean => isSkinId(v) && FROZEN_SKINS.includes(v);
/** A registry id that may be chosen / written (not frozen). */
export const isSelectableSkin = (v: unknown): v is SkinId => isSkinId(v) && !FROZEN_SKINS.includes(v);
/** The skin to DRAW for a stored / requested value: a frozen id reads as the fallback skin; null for anything that is no skin id. */
export const resolveSkin = (v: unknown): SkinId | null => (isSkinId(v) ? (FROZEN_SKINS.includes(v) ? FROZEN_FALLBACK_SKIN : v) : null);
