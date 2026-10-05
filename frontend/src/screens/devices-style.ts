import { productSettings } from '../api/prefs';
import type { ProductSettings } from '../api/media';
import { isApi } from '../api/session';
import { DEVICE_THEMES, devicesThemes, type DeviceThemeId } from '../styles/devices-themes';
import { devicesPalettes } from '../styles/devices-palettes';
import { devicesLayoutCss } from './devices-layout-css';
import { areaRowOf, AREA_ROW_DEFAULT, FLOOR_ROW_DEFAULT, floorRowOf, type AreaRow, type FloorRow } from '../api/area-row';

/**
 * CR-007 slice 6a: the presentation settings of the device-control screens (הגדרות › חשמל והתקנים, `devices.*`, per
 * installation) and how a screen applies them. The looks themselves - the style structure, the palettes and every
 * knob - are defined in ONE file, styles/devices-themes.ts (documented in docs/design/DEVICE_THEMES.md).
 *
 * The screen's host carries `data-devices-style` ("smplwise" | "glass"), `data-devices-theme` (a registered palette,
 * "default" today) and `data-devices-density` ("comfortable" | "compact"). "smplwise" + "comfortable" match no rule:
 * the screens keep the product's v2 tokens, pixel for pixel. Every rule uses logical properties only (RTL is the
 * product's default; an LTR viewer mirrors cleanly). The glass style is our own token set inspired by DomusUI's look -
 * no DomusUI code or CSS (GPL) is used. The side rail and the rest of the app never see these attributes.
 */

/** The theme layer every device screen includes first in its styles. */
export const devicesStyleTokens = [devicesThemes, devicesPalettes, devicesLayoutCss];

export type DevicesStyle = 'smplwise' | 'glass';
export type DevicesDensity = 'comfortable' | 'compact';
export type DevicesView = 'cards' | 'tiles';
/** CR-007 6b: the device area's colour scheme (glass style). `auto` follows the viewer's operating system. */
export type DevicesScheme = 'light' | 'dark' | 'auto';

export interface DevicesPrefs {
  style: DevicesStyle;
  theme: DeviceThemeId;
  defaultView: DevicesView;
  showSensors: boolean;
  /** Release 0.1.149: what shows next to an area's name and in a floor's header (installation default; api/area-row.ts). */
  areaRow: AreaRow;
  floorRow: FloorRow;
  density: DevicesDensity;
  scheme: DevicesScheme;
  /** K88 (plan.surfaces): where the live plan shows besides the map tab - the devices screen's plan view, the area page's card. */
  planSurfaces: ('devices' | 'area')[];
}

export const DEVICES_PREFS_DEFAULT: DevicesPrefs = { style: 'smplwise', theme: 'default', defaultView: 'cards', showSensors: true, areaRow: AREA_ROW_DEFAULT, floorRow: FLOOR_ROW_DEFAULT, density: 'comfortable', scheme: 'light', planSurfaces: ['devices', 'area'] };

/** The `devices.*` settings as the screens use them; anything unknown falls back to today's look / the default palette. */
export function devicesPrefsOf(s: Partial<ProductSettings> | null | undefined): DevicesPrefs {
  const theme = s?.['devices.theme'];
  return {
    style: s?.['devices.style'] === 'glass' ? 'glass' : 'smplwise',
    theme: (DEVICE_THEMES as readonly string[]).includes(theme ?? '') ? (theme as DeviceThemeId) : 'default',
    defaultView: s?.['devices.default_view'] === 'tiles' ? 'tiles' : 'cards',
    showSensors: s?.['devices.show_sensors'] !== 'false',
    areaRow: areaRowOf(s?.['devices.area_row']),
    floorRow: floorRowOf(s?.['devices.floor_row']),
    density: s?.['devices.density'] === 'compact' ? 'compact' : 'comfortable',
    scheme: s?.['devices.scheme'] === 'dark' || s?.['devices.scheme'] === 'auto' ? s['devices.scheme'] : 'light',
    planSurfaces: Array.isArray(s?.['plan.surfaces']) ? s['plan.surfaces'].filter((x): x is 'devices' | 'area' => x === 'devices' || x === 'area') : ['devices', 'area'],
  };
}

/** The installation's device-screen settings (the shared settings cache); never throws - today's look on any failure. */
export async function loadDevicesPrefs(): Promise<DevicesPrefs> {
  if (!isApi()) return DEVICES_PREFS_DEFAULT;
  try {
    return devicesPrefsOf(await productSettings());
  } catch {
    return DEVICES_PREFS_DEFAULT;
  }
}

/** Puts the style, palette and density on a device screen's host. */
export function applyDevicesPrefs(host: HTMLElement, p: DevicesPrefs) {
  host.setAttribute('data-devices-style', p.style);
  host.setAttribute('data-devices-theme', p.theme);
  host.setAttribute('data-devices-density', p.density);
  applyDevicesScheme(host, p.scheme);
}

/** CR-007 6b: the hosts whose scheme is `auto`, re-resolved when the operating system's scheme changes. */
const autoHosts = new Set<HTMLElement>();
let darkQuery: MediaQueryList | null = null;

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** The RESOLVED scheme on the host: `data-devices-scheme="light" | "dark"`. Dark applies only when chosen - `dark`, or
 * `auto` on a device whose operating system is dark (resolved here, in JS: the CSS has no colour-scheme media query,
 * so while the app shell is light only the device area never turns dark by itself - DEVICE_THEMES.md §6). */
export function applyDevicesScheme(host: HTMLElement, scheme: DevicesScheme) {
  host.setAttribute('data-devices-scheme', scheme === 'dark' || (scheme === 'auto' && systemDark()) ? 'dark' : 'light');
  if (scheme !== 'auto') {
    autoHosts.delete(host);
    return;
  }
  autoHosts.add(host);
  if (!darkQuery) {
    try {
      darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      darkQuery.addEventListener('change', () => {
        for (const h of [...autoHosts]) {
          if (!h.isConnected) autoHosts.delete(h);
          else h.setAttribute('data-devices-scheme', systemDark() ? 'dark' : 'light');
        }
      });
    } catch {
      darkQuery = null;
    }
  }
}
