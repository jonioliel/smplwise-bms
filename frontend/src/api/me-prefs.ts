/** CR-013: the signed-in user's own interface preferences on the server (GET/PUT /me/prefs, routers/me.py). A closed
 * list of keys; today only `nav.order` (the navigation tabs' order). Null resets a key to its default. */
import { get, put } from './client';

export interface MyPrefs {
  prefs: { 'nav.order': string[] };
  /** The keys the user set themselves (the rest are defaults). */
  stored: string[];
  updated_at: string | null;
}

export const getMyPrefs = () => get<MyPrefs>('me/prefs');
export const putMyPrefs = (patch: { 'nav.order'?: string[] | null }) => put<MyPrefs>('me/prefs', patch);
