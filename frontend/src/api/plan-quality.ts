/**
 * The user's own 3D view mode on the server (/me/prefs `plan.quality`, owner bug 2026-10-10), cached in this browser so a
 * reload builds the view at once in the remembered mode. Pure rules live in map/quality-mode.ts.
 * Without a backend (the static demo) the browser cache is the only layer.
 */
import { isApi } from './session';
import { getMyPrefs, putMyPrefs } from './me-prefs';
import { modeFromWire, modeToWire, type QualityMode } from '../map/quality-mode';

/** The browser's cache of the personal choice ("auto" | "2" | "1"; the older per-browser "1" / "2" read the same). */
export const QUALITY_KEY = 'sw.plan3d.quality';

export function cachedOwnMode(): QualityMode | null {
  try {
    return modeFromWire(localStorage.getItem(QUALITY_KEY));
  } catch {
    return null;
  }
}

function cache(mode: QualityMode | null): void {
  try {
    if (mode === null) localStorage.removeItem(QUALITY_KEY);
    else localStorage.setItem(QUALITY_KEY, modeToWire(mode));
  } catch {
    /* private mode: the choice lives for this page only */
  }
}

/** The server's answer: the user's own mode (null = follows the installation), or undefined when it could not be read
 * (no backend, offline, an older backend) - the caller keeps the browser's cache then. */
export async function loadOwnMode(): Promise<QualityMode | null | undefined> {
  if (!isApi()) return undefined;
  try {
    const own = modeFromWire((await getMyPrefs()).prefs['plan.quality']);
    if (own !== null) cache(own);
    return own;
  } catch {
    return undefined;
  }
}

/** Remember the user's own mode (null = back to the installation's default): the browser at once, the server best-effort
 * (a refused or failed write keeps the browser's choice; the toolbar never waits for it). */
export async function saveOwnMode(mode: QualityMode | null): Promise<void> {
  cache(mode);
  if (!isApi()) return;
  try {
    await putMyPrefs({ 'plan.quality': mode === null ? null : modeToWire(mode) });
  } catch (err) {
    console.warn('plan-quality: the personal 3D mode was not saved on the server', err);
  }
}
