// HOME-SIMPLE-2421: the room wallpaper gallery and the "switch user" channel of the home interface.
//
// Gallery: original abstract backgrounds drawn from CSS gradients only (no picture files, nothing downloaded). Each is a few soft colour
// fields; on the room screen it sits under a scrim of the theme's own background (home-styles-extra.ts `.hs.walled`), so the text keeps
// the theme's contrast in all 7 themes, dark and light. The server checks the names only (services/home_interface.GALLERY).
import { isRemoteChannel } from '../arx/channel';

export interface GalleryItem { id: string; name: string; layers: string }

export const GALLERY: GalleryItem[] = [
  { id: 'dusk', name: 'דמדומים', layers: 'radial-gradient(120% 90% at 85% 10%, #f2a27a 0%, transparent 55%), radial-gradient(90% 80% at 10% 90%, #5b4b8a 0%, transparent 60%), linear-gradient(160deg, #2b2440, #45324f)' },
  { id: 'tide', name: 'גאות', layers: 'radial-gradient(100% 70% at 20% 0%, #6fc3c9 0%, transparent 60%), radial-gradient(90% 90% at 100% 100%, #1f4e79 0%, transparent 65%), linear-gradient(200deg, #163a52, #0f2b3d)' },
  { id: 'dune', name: 'דיונה', layers: 'radial-gradient(130% 70% at 50% 110%, #c98b55 0%, transparent 60%), radial-gradient(80% 60% at 90% 0%, #f1d3a2 0%, transparent 55%), linear-gradient(180deg, #8a6a4c, #5f4633)' },
  { id: 'moss', name: 'אזוב', layers: 'radial-gradient(90% 80% at 0% 0%, #9bb87a 0%, transparent 60%), radial-gradient(100% 80% at 100% 100%, #2f5a45 0%, transparent 60%), linear-gradient(135deg, #34503d, #1e3328)' },
  { id: 'ember', name: 'גחלים', layers: 'radial-gradient(70% 60% at 75% 80%, #e0673f 0%, transparent 60%), radial-gradient(90% 70% at 15% 15%, #6b2e2e 0%, transparent 60%), linear-gradient(160deg, #2a1a1a, #3f2420)' },
  { id: 'slate', name: 'צפחה', layers: 'radial-gradient(100% 80% at 100% 0%, #8fa3b8 0%, transparent 60%), radial-gradient(80% 70% at 0% 100%, #3d4b5c 0%, transparent 60%), linear-gradient(180deg, #4a5665, #2c3540)' },
  { id: 'aurora', name: 'זוהר', layers: 'radial-gradient(70% 50% at 30% 20%, #59d1a5 0%, transparent 60%), radial-gradient(60% 60% at 80% 40%, #7b6cf0 0%, transparent 60%), linear-gradient(180deg, #111a2e, #1c2540)' },
  { id: 'linen', name: 'פשתן', layers: 'radial-gradient(110% 80% at 0% 0%, #f4ece0 0%, transparent 60%), radial-gradient(90% 80% at 100% 100%, #d9c7ae 0%, transparent 60%), linear-gradient(180deg, #e8dccb, #cdb99c)' },
];

/** The CSS background of one gallery item ('' for an unknown name). */
export function galleryCss(id: string): string {
  return GALLERY.find((g) => g.id === id)?.layers ?? '';
}

/** How "switch user" works here: 'arx' = the remote channel's own sign-out (back to the Arx sign-in page); 'host' = inside the home
 * system, whose sign-in this is (the person signs out on its account page); null = neither (a local preview / dev page). */
export function switchUserMode(path: string = window.location.pathname): 'arx' | 'host' | null {
  if (isRemoteChannel()) return 'arx';
  return path.startsWith('/api/hassio_ingress/') ? 'host' : null;
}
