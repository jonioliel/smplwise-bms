import { productSettings } from '../api/prefs';
import type { ProductSettings } from '../api/media';
import { isApi } from '../api/session';
import { DEVICE_THEMES, devicesThemes, type DeviceThemeId } from '../styles/devices-themes';
import { devicesPalettes } from '../styles/devices-palettes';
import { devicesLayoutCss } from './devices-layout-css';
import { areaRowOf, AREA_ROW_DEFAULT, FLOOR_ROW_DEFAULT, floorRowOf, type AreaRow, type FloorRow } from '../api/area-row';
import { onDesign, resolvedTheme } from '../design/apply';

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
/** DU1: every host, with the `devices.scheme` it was given, re-resolved when the product's scheme (`ui.scheme`) changes. */
const hosts = new Map<HTMLElement, DevicesScheme>();
let darkQuery: MediaQueryList | null = null;
let designWatched = false;

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** DU1 (2026-10-09): the resolved scheme of a glass host. Dark when `devices.scheme` says so (`dark`, or `auto` on a dark
 * operating system) - and also whenever the PRODUCT is dark (`ui.scheme`, resolved on `<html data-theme>`): the device,
 * schedule, automation, media and notification surfaces are never lighter than the shell around them (a white glass area
 * inside a dark shell was the largest inconsistency of the DU1 audit). A dark OS alone still changes nothing while the
 * installation's `ui.scheme` is light. */
function resolveDevicesScheme(scheme: DevicesScheme): 'light' | 'dark' {
  if (scheme === 'dark' || (scheme === 'auto' && systemDark())) return 'dark';
  return resolvedTheme() === 'dark' ? 'dark' : 'light';
}

function reapply() {
  for (const [h, s] of [...hosts]) {
    if (!h.isConnected) {
      hosts.delete(h);
      autoHosts.delete(h);
    } else h.setAttribute('data-devices-scheme', resolveDevicesScheme(s));
  }
}

/** The RESOLVED scheme on the host: `data-devices-scheme="light" | "dark"` (see resolveDevicesScheme). The CSS has no
 * colour-scheme media query: the resolution happens here, in JS - DEVICE_THEMES.md §6. */
export function applyDevicesScheme(host: HTMLElement, scheme: DevicesScheme) {
  host.setAttribute('data-devices-scheme', resolveDevicesScheme(scheme));
  hosts.set(host, scheme);
  if (!designWatched) {
    designWatched = true;
    onDesign(reapply); // the product's skin / scheme changed (settings, ?scheme=, the OS under ui.scheme=auto)
  }
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
          else h.setAttribute('data-devices-scheme', resolveDevicesScheme('auto'));
        }
      });
    } catch {
      darkQuery = null;
    }
  }
}
