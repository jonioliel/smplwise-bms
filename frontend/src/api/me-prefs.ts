/** CR-013: the signed-in user's own interface preferences on the server (GET/PUT /me/prefs, routers/me.py). A closed
 * list of keys: `nav.order` (the navigation tabs' order) and, from WisKey rc.37, the user's `wiskey.density` / `wiskey.wall`
 * start choices (wiskey/wiskey-prefs.ts). Null resets a key to its default. */
import { get, put } from './client';

export interface MyPrefs {
  prefs: { 'nav.order': string[]; 'wiskey.density'?: string | null; 'wiskey.wall'?: string | null };
  /** The keys the user set themselves (the rest are defaults). */
  stored: string[];
  updated_at: string | null;
}

export const getMyPrefs = () => get<MyPrefs>('me/prefs');
export const putMyPrefs = (patch: { 'nav.order'?: string[] | null; 'wiskey.density'?: string | null; 'wiskey.wall'?: string | null }) => put<MyPrefs>('me/prefs', patch);
