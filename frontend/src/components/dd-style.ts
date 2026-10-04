/**
 * The dropdown style ids, as plain data (no Lit, no decorators): `shell/tabs-mode.ts` (and through it `shell/nav.ts`, which the unit
 * specs import under Playwright's own transpiler) must not pull the `sw-dropdown` component in just to read the list of ids.
 * `sw-dropdown.ts` re-exports both names, so existing imports keep working.
 */
export type DdStyle = 'auto' | 'pill' | 'field' | 'underline' | 'text' | 'prefix' | 'tonal' | 'capsule';
export const DD_STYLE_IDS: readonly DdStyle[] = ['auto', 'pill', 'field', 'underline', 'text', 'prefix', 'tonal', 'capsule'];

/** The SIZE of a dropdown (Unreleased, owner request 2026-10-04): `md` is the reference size (and today's size for the other styles). */
export type DdSize = 'sm' | 'md' | 'lg';
export const DD_SIZE_IDS: readonly DdSize[] = ['sm', 'md', 'lg'];
export const DD_SIZE_DEFAULT: DdSize = 'md';
