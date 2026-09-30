/**
 * WisKey rc.37 embed view parameters (`docs/integrations/wiskey/embed-api-v1/WISKEY_EMBED_API_V1.md`, §2): the optional
 * `density` (overview cards: 4 | 6 | 8 | 9 | 12) and `wall` (camera-wall streams: 4 | 9 | 12) query values of the panel's
 * address, plus which value Arx sends. WisKey stores nothing and posts no message when the user changes the count inside
 * the panel, so the choice Arx keeps is a START choice: it is restored on every load of the frame.
 *
 * Pure (no DOM, no network): the connector builds the address from it and the unit spec runs it in Node.
 *
 * Precedence, per parameter: the user's own choice (`/me/prefs` `wiskey.density` / `wiskey.wall`), else the installation's
 * default (`ui.wiskey_density` / `ui.wiskey_wall`), else the parameter is left out and WisKey chooses (automatic
 * density, wall of 4). A density of "auto" (the user's explicit "let WisKey size the overview") leaves the parameter out
 * and stops the fall-through to the installation default; an invalid value is ignored, as WisKey itself does.
 */

/** The overview card counts WisKey accepts. */
export const WISKEY_DENSITIES = ['4', '6', '8', '9', '12'] as const;
/** The camera-wall stream budgets WisKey accepts. */
export const WISKEY_WALLS = ['4', '9', '12'] as const;
/** The word for "no value: WisKey decides" in the stored choices (`auto`). */
export const WISKEY_AUTO = 'auto';

/** What is stored, for the user or the installation: a value, `auto`, or nothing (null / undefined). */
export type WiskeyChoice = string | number | null | undefined;
export interface WiskeyChoices {
  density?: WiskeyChoice;
  wall?: WiskeyChoice;
}
/** The resolved query values (null = the parameter is left out). */
export interface WiskeyView {
  density: string | null;
  wall: string | null;
}

export const NO_VIEW: WiskeyView = { density: null, wall: null };

function pick(value: unknown, allowed: readonly string[]): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  return allowed.includes(text) ? text : null;
}

/** "12" or 12 -> "12"; "auto", nothing and anything not in 4/6/8/9/12 -> null. */
export function parseWiskeyDensity(value: unknown): string | null {
  return pick(value, WISKEY_DENSITIES);
}

/** "9" or 9 -> "9"; anything not in 4/9/12 -> null. */
export function parseWiskeyWall(value: unknown): string | null {
  return pick(value, WISKEY_WALLS);
}

/** The view to send: the user's value, else the installation's, else nothing (per parameter). */
export function resolveWiskeyView(user: WiskeyChoices | null | undefined, installation: WiskeyChoices | null | undefined): WiskeyView {
  const u = user ?? {};
  const i = installation ?? {};
  const userDensity = parseWiskeyDensity(u.density);
  const density = userDensity ?? (u.density === WISKEY_AUTO ? null : parseWiskeyDensity(i.density));
  const wall = parseWiskeyWall(u.wall) ?? parseWiskeyWall(i.wall);
  return { density, wall };
}

/** The view a caller hands the address builder, cleaned: only values WisKey accepts survive. */
export function cleanWiskeyView(view: Partial<Record<keyof WiskeyView, unknown>> | null | undefined): WiskeyView {
  return { density: parseWiskeyDensity(view?.density), wall: parseWiskeyWall(view?.wall) };
}

export function sameWiskeyView(a: WiskeyView, b: WiskeyView): boolean {
  return a.density === b.density && a.wall === b.wall;
}
