/**
 * BUBBLE-FREEZE-295 (owner decision 2026-10-26): the single place where the test gate learns which skins are frozen.
 * The registry (src/design/skins/index.ts FROZEN_SKINS) is the source; specs never hard-code "bubble is out".
 *
 *   SKINS_UNDER_TEST    the registry's skins minus the frozen ones - what every "for each skin" spec iterates (SKIN_IDS drop-in)
 *   skinsUnderTest(l)   the same filter for a hand-written list (['classic', 'bubble'] -> ['classic'])
 *   isFrozen(skin)      true for a frozen skin
 *   skipIfFrozen(skin)  call at the top of a spec file (or inside a describe) that exercises only that skin: skips it with a reason
 *
 * Unfreeze: empty FROZEN_SKINS in the registry and every spec below comes back by itself (docs/changes/BUBBLE-FREEZE-295.md).
 * Baselines (PNGs) are never touched by a skip.
 */
import { test } from '@playwright/test';
import { FROZEN_SKINS, SKIN_IDS, type SkinId } from '../../src/design/skins';

export const isFrozen = (skin: string): boolean => (FROZEN_SKINS as readonly string[]).includes(skin);
export const SKINS_UNDER_TEST: readonly SkinId[] = SKIN_IDS.filter((id) => !isFrozen(id));
export const skinsUnderTest = <T extends string>(list: readonly T[]): T[] => list.filter((s) => !isFrozen(s));
export function skipIfFrozen(skin: SkinId = 'bubble') {
  test.skip(isFrozen(skin), `${skin} skin frozen 2026-10-26 (BUBBLE-FREEZE-295)`);
}
