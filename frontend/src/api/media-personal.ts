/**
 * CR-015 addition A: the screens page's layout for the signed-in user - the installation's layout with, for a holder of
 * `screen.personalize` only, the user's own override on top (`multimedia.personal` of /me/prefs, the `home.personal`
 * pattern). The S0 client (media-screens.ts) reads both in one answer (`media().layout()`) and saves the installation layout;
 * saving the PERSONAL part is a /me/prefs write, which lives here. The MOCK adapter has no personal store (the static
 * demo), so it is kept in memory for the page load.
 *
 * The server validates and prunes (services/media_layout.normalise_personal); a write without screen.personalize is refused
 * (403 personalize_required) and the key is hidden on read - nothing in the UI offers it then.
 */
import { isApi } from './session';
import { putMyPrefs } from './me-prefs';
import { media, type LayoutResponse, type MediaPersonal } from './media-screens';

let demoPersonal: MediaPersonal | null = null;

/** The layout answer as the page uses it (the demo's personal override included). */
export async function loadLayout(): Promise<LayoutResponse> {
  const r = await media().layout();
  return isApi() ? r : { ...r, personal: demoPersonal };
}

/** Saves (or, with null, clears) the user's own override; returns the fresh answer. */
export async function savePersonal(personal: MediaPersonal | null): Promise<LayoutResponse> {
  if (!isApi()) {
    demoPersonal = personal;
    return loadLayout();
  }
  await putMyPrefs({ 'multimedia.personal': personal as unknown as Record<string, unknown> | null });
  return loadLayout();
}

/** Specs: a fresh demo session. */
export function resetDemoPersonal(): void {
  demoPersonal = null;
}
