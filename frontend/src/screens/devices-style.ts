import { productSettings } from '../api/prefs';
import type { ProductSettings } from '../api/media';
import { isApi } from '../api/session';
import { DEVICE_THEMES, devicesThemes, type DeviceThemeId } from '../styles/devices-themes';

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
export const devicesStyleTokens = devicesThemes;

export type DevicesStyle = 'smplwise' | 'glass';
export type DevicesDensity = 'comfortable' | 'compact';
export type DevicesView = 'cards' | 'tiles';

export interface DevicesPrefs {
  style: DevicesStyle;
  theme: DeviceThemeId;
  defaultView: DevicesView;
  showSensors: boolean;
  showClimateStrip: boolean;
  density: DevicesDensity;
}

export const DEVICES_PREFS_DEFAULT: DevicesPrefs = { style: 'smplwise', theme: 'default', defaultView: 'cards', showSensors: true, showClimateStrip: true, density: 'comfortable' };

/** The `devices.*` settings as the screens use them; anything unknown falls back to today's look / the default palette. */
export function devicesPrefsOf(s: Partial<ProductSettings> | null | undefined): DevicesPrefs {
  const theme = s?.['devices.theme'];
  return {
    style: s?.['devices.style'] === 'glass' ? 'glass' : 'smplwise',
    theme: (DEVICE_THEMES as readonly string[]).includes(theme ?? '') ? (theme as DeviceThemeId) : 'default',
    defaultView: s?.['devices.default_view'] === 'tiles' ? 'tiles' : 'cards',
    showSensors: s?.['devices.show_sensors'] !== 'false',
    showClimateStrip: s?.['devices.show_climate_strip'] !== 'false',
    density: s?.['devices.density'] === 'compact' ? 'compact' : 'comfortable',
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
}
