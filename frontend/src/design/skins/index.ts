/**
 * The skin registry. A skin = token overrides (both columns, always) + a bounded set of component rules (<= 50 `{ }` blocks).
 * Adding a skin: one file in this folder + one line in SKINS below; see docs/design/SKIN_AUTHORING_HE.md.
 * Keep SKIN_IDS in step with the validation of `ui.skin` in smplwise_vms/backend/smplwise/routers/settings.py.
 */
import type { TokenTable } from '../tokens';
import { classic } from './classic';
import { domus } from './domus';
import { tesla } from './tesla';

export const SKIN_IDS = ['classic', 'domus', 'tesla'] as const;
export type SkinId = (typeof SKIN_IDS)[number];
export const DEFAULT_SKIN: SkinId = 'classic';
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

export const SKINS: Record<SkinId, Skin> = { classic, domus, tesla };

export const isSkinId = (v: unknown): v is SkinId => typeof v === 'string' && (SKIN_IDS as readonly string[]).includes(v);
