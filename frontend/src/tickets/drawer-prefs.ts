import { parseSize, type DrawerSize } from './drawer-model';

/**
 * TKUI1: the viewer's own drawer size (the header's three-size switch), remembered per browser - a per-viewer convenience only. The module
 * setting `ui.drawer_size` is the default; this choice wins when present. Storage can be missing or throw (a private window, blocked site
 * data): every access is guarded and the drawer then simply opens in the setting's size.
 */
export const SIZE_KEY = 'sw.tickets.drawerSize';

export function loadOwnSize(): DrawerSize | null {
  try {
    return parseSize(globalThis.localStorage?.getItem(SIZE_KEY));
  } catch {
    return null;
  }
}

export function saveOwnSize(s: DrawerSize): void {
  try {
    globalThis.localStorage?.setItem(SIZE_KEY, s);
  } catch {
    /* storage unavailable: the choice lasts until the page is left */
  }
}
