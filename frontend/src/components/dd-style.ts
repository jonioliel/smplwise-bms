/**
 * The dropdown style ids, as plain data (no Lit, no decorators): `shell/tabs-mode.ts` (and through it `shell/nav.ts`, which the unit
 * specs import under Playwright's own transpiler) must not pull the `sw-dropdown` component in just to read the list of ids.
 * `sw-dropdown.ts` re-exports both names, so existing imports keep working.
 */
export type DdStyle = 'auto' | 'pill' | 'field' | 'underline' | 'text' | 'prefix' | 'tonal';
export const DD_STYLE_IDS: readonly DdStyle[] = ['auto', 'pill', 'field', 'underline', 'text', 'prefix', 'tonal'];
