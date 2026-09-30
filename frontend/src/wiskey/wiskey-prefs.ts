/**
 * The WisKey start choices (WisKey rc.37): how many overview cards (`density`) and camera-wall streams (`wall`) the
 * embedded panel opens with. Two layers, resolved by embed-view.ts `resolveWiskeyView`:
 * - the installation's default (הגדרות › מדיה, `ui.wiskey_density` / `ui.wiskey_wall`, filled by `applyWiskeyUi` and by the
 *   embed itself from the product settings);
 * - the user's own choice (החשבון שלי, `wiskey.density` / `wiskey.wall` of GET/PUT /me/prefs, the server keeps it per user,
 *   so it follows the user to every device). Without a backend (the static demo) the choice lives in memory only.
 *
 * WisKey stores nothing and does not tell Arx when the user changes a count inside the panel, so these are START choices:
 * the panel's address carries them on every load. A change made here reloads a mounted frame once (`WISKEY_VIEW_EVENT`).
 */
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';
import { productSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { resolveWiskeyView, sameWiskeyView, WISKEY_AUTO, parseWiskeyDensity, parseWiskeyWall, type WiskeyView } from './embed-view';

/** Fired on `window` when the view the panel's address carries changed (the embed reloads its frame). */
export const WISKEY_VIEW_EVENT = 'sw-wiskey-view';
/** How long the embed waits for the two answers before opening the frame with what it has (never blocks WisKey). */
export const WISKEY_VIEW_WAIT_MS = 3000;

export type WiskeyChoiceKey = 'density' | 'wall';

/** The user's own stored choices (null = none: follow the installation). `density` may be `auto`. */
let own: { density: string | null; wall: string | null } = { density: null, wall: null };
/** The installation's default (`auto` / a value). */
let install: { density: string; wall: string } = { density: WISKEY_AUTO, wall: WISKEY_AUTO };
let loaded = false;
let inflight: Promise<void> | null = null;

const stored = (value: unknown): string | null => (value === WISKEY_AUTO ? WISKEY_AUTO : parseWiskeyDensity(value));

function emitIfChanged(before: WiskeyView): void {
  if (typeof window !== 'undefined' && !sameWiskeyView(before, currentWiskeyView())) window.dispatchEvent(new Event(WISKEY_VIEW_EVENT));
}

/** What the panel's address carries right now. */
export function currentWiskeyView(): WiskeyView {
  return resolveWiskeyView(own, install);
}

/** The user's own stored choices (for the account block). */
export function ownWiskeyChoices(): Readonly<{ density: string | null; wall: string | null }> {
  return own;
}

/** The installation's default choices (for the account block's "default" option label). */
export function installWiskeyChoices(): Readonly<{ density: string; wall: string }> {
  return install;
}

/** Have both layers answered (or failed, or are there no backend)? Then the embed can open its frame at once. */
export function wiskeyViewLoaded(): boolean {
  return loaded;
}

/** The installation's default, from the product settings (`applyWiskeyUi` and the embed's own read both land here). */
export function setInstallWiskeyView(settings: Record<string, unknown> | null | undefined): void {
  const before = currentWiskeyView();
  const d = settings?.['ui.wiskey_density'];
  const w = settings?.['ui.wiskey_wall'];
  install = { density: parseWiskeyDensity(d) ?? WISKEY_AUTO, wall: parseWiskeyWall(w) ?? WISKEY_AUTO };
  emitIfChanged(before);
}

function applyOwn(prefs: { prefs?: Record<string, unknown>; stored?: string[] } | null | undefined): void {
  const p = prefs?.prefs ?? {};
  const set = Array.isArray(prefs?.stored) ? prefs!.stored! : null; // an older answer without `stored`: a non-null value is theirs
  const before = currentWiskeyView();
  own = {
    density: !set || set.includes('wiskey.density') ? stored(p['wiskey.density']) : null,
    wall: !set || set.includes('wiskey.wall') ? parseWiskeyWall(p['wiskey.wall']) : null,
  };
  emitIfChanged(before);
}

/** Read both layers from the server (a failure leaves what is known: the installation's default at worst). */
export function refreshWiskeyView(): Promise<void> {
  if (!isApi()) {
    loaded = true;
    return Promise.resolve();
  }
  if (!inflight) {
    inflight = Promise.all([
      productSettings().then((s) => setInstallWiskeyView(s as unknown as Record<string, unknown>)).catch(() => undefined),
      getMyPrefs().then((p) => applyOwn(p as never)).catch(() => undefined), // an older backend without the keys, or offline
    ])
      .then(() => {
        loaded = true;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Resolves when the view is known - or after `ms`, so a slow server never keeps WisKey from opening. */
export function whenWiskeyViewLoaded(ms = WISKEY_VIEW_WAIT_MS): Promise<void> {
  if (loaded) return Promise.resolve();
  return Promise.race([refreshWiskeyView(), new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

/** Save the user's own choice (null = back to the installation's default). With a backend the server answers first and only
 * then does the choice apply (an open frame reloads once, on the saved value - never on one the server refused). */
export async function saveWiskeyChoice(key: WiskeyChoiceKey, value: string | null): Promise<void> {
  const clean = value === null ? null : key === 'density' ? stored(value) : parseWiskeyWall(value);
  if (value !== null && clean === null) throw new Error('unsupported WisKey choice');
  if (isApi()) {
    applyOwn((await putMyPrefs({ [key === 'density' ? 'wiskey.density' : 'wiskey.wall']: clean })) as never);
    return;
  }
  const before = currentWiskeyView();
  own = { ...own, [key]: clean }; // the static demo: this browser only, in memory
  emitIfChanged(before);
}

/** For the unit spec and a sign-in change: forget everything. */
export function resetWiskeyViewState(): void {
  own = { density: null, wall: null };
  install = { density: WISKEY_AUTO, wall: WISKEY_AUTO };
  loaded = false;
  inflight = null;
}
