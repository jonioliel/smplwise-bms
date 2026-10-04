/** CR-013: the signed-in user's own interface preferences on the server (GET/PUT /me/prefs, routers/me.py). A closed
 * list of keys: `nav.order` (the navigation tabs' order), `ui.nav_size` (the size of the rail / bottom bar - shape in
 * shell/nav-size.ts), from WisKey rc.37 the user's `wiskey.density` / `wiskey.wall` start choices (wiskey/wiskey-prefs.ts)
 * and, for a holder of `screen.personalize` only, `home.personal` - the user's own home-screen direction and widgets
 * (api/home.ts) and, likewise, `multimedia.personal` (CR-015, the screens page: api/media-personal.ts). Null resets a key to its default. */
import { get, put } from './client';

/** The wire shape of a navigation size (validated in the backend, services/nav_size.py; parsed by shell/nav-size.ts). */
export type NavSizeWire = { mode: 'rel'; preset: 's' | 'm' | 'l' | 'xl' } | { mode: 'free'; icon: number; label: number; item: number };

export interface MyPrefs {
  prefs: { 'nav.order': string[]; 'ui.nav_size'?: NavSizeWire; 'ui.look'?: Record<string, unknown> | null; 'ui.tabs_mode'?: string | null; 'ui.tabs_mode_groups'?: Record<string, string> | null; 'ui.dd_style'?: string | null; 'ui.dd_style_groups'?: Record<string, string> | null; 'ui.dd_phone'?: string | null; 'ui.dd_size'?: string | null; 'ui.dd_size_groups'?: Record<string, string> | null; 'wiskey.density'?: string | null; 'wiskey.wall'?: string | null; 'home.personal'?: unknown; 'devices.area_row'?: unknown; 'multimedia.personal'?: unknown };
  /** The keys the user set themselves (the rest are defaults). */
  stored: string[];
  updated_at: string | null;
}

export const getMyPrefs = () => get<MyPrefs>('me/prefs');
export const putMyPrefs = (patch: { 'nav.order'?: string[] | null; 'ui.nav_size'?: NavSizeWire | null; 'ui.look'?: Record<string, unknown> | null; 'ui.tabs_mode'?: string | null; 'ui.tabs_mode_groups'?: Record<string, string> | null; 'ui.dd_style'?: string | null; 'ui.dd_style_groups'?: Record<string, string> | null; 'ui.dd_phone'?: string | null; 'ui.dd_size'?: string | null; 'ui.dd_size_groups'?: Record<string, string> | null; 'wiskey.density'?: string | null; 'wiskey.wall'?: string | null; 'home.personal'?: Record<string, unknown> | null; 'devices.area_row'?: Record<string, unknown> | null; 'multimedia.personal'?: Record<string, unknown> | null }) => put<MyPrefs>('me/prefs', patch);
