/** CR-013: the signed-in user's own interface preferences on the server (GET/PUT /me/prefs, routers/me.py). A closed
 * list of keys: `nav.order` (the navigation tabs' order) and, UI round 1, `ui.nav_size` (the size of the rail / bottom
 * bar - shape in shell/nav-size.ts). Null resets a key to its default. */
import { get, put } from './client';

/** The wire shape of a navigation size (validated in the backend, services/nav_size.py; parsed by shell/nav-size.ts). */
export type NavSizeWire = { mode: 'rel'; preset: 's' | 'm' | 'l' | 'xl' } | { mode: 'free'; icon: number; label: number; item: number };

export interface MyPrefs {
  prefs: { 'nav.order': string[]; 'ui.nav_size'?: NavSizeWire };
  /** The keys the user set themselves (the rest are defaults). */
  stored: string[];
  updated_at: string | null;
}

export const getMyPrefs = () => get<MyPrefs>('me/prefs');
export const putMyPrefs = (patch: { 'nav.order'?: string[] | null; 'ui.nav_size'?: NavSizeWire | null }) => put<MyPrefs>('me/prefs', patch);
