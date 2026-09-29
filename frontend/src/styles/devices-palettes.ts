import { unsafeCSS } from 'lit';

/**
 * CR-007 slice 6b: the colour themes (palettes) of the device area (docs/design/DEVICE_THEMES.md §6).
 *
 * `devices.theme` picks a palette; `devices.scheme` (light | dark | auto) picks its light or dark values. The screen's
 * host carries `data-devices-theme` and `data-devices-scheme` (the RESOLVED scheme, "light" or "dark": "auto" is
 * resolved in JS from `prefers-color-scheme`, see devices-style.ts - there is deliberately no colour-scheme media query
 * in the CSS, so dark never applies by itself while the app shell is light only).
 *
 * Two kinds of knob per palette:
 * - the glass style's COLOUR knobs (surfaces, text, accent, states, shadows, glows) - the palette "default" keeps its
 *   blocks in devices-themes.ts (6a); every other palette sets its own here, over the default's shape knobs (radii,
 *   sizes, gaps, fonts), which apply to every palette;
 * - the ROLE knobs `--dv-role-<role>-bg | -border | -fg` that the layout editor's card colours use (a card never holds
 *   a colour value, only a role): resolved per palette in BOTH styles (smplwise: the light values - its tokens are
 *   light only; glass: light or dark by the scheme).
 */

export const LAYOUT_ROLE_IDS = ['accent', 'warm', 'cool', 'success', 'warning', 'danger', 'neutral'] as const;
export type LayoutRoleId = (typeof LAYOUT_ROLE_IDS)[number];

/** A role: its RGB triplet (fill and border are that colour at the scheme's alphas) and its text colour. */
type Roles = Record<LayoutRoleId, { rgb: string; fg: string }>;

interface Scheme {
  /** The glass colour knobs (absent for "default", whose blocks live in devices-themes.ts). */
  knobs: Record<string, string> | null;
  roles: Roles;
  /** What the settings screen's swatch paints (a static preview; the screens read the knobs). */
  preview: { backdrop: string; surface: string; text: string; accent: string; on: string };
}

export interface DevicePalette {
  id: string;
  name: string;
  hint: string;
  light: Scheme;
  dark: Scheme;
}

const ROLE_ALPHA = { light: { bg: 0.14, border: 0.5 }, dark: { bg: 0.26, border: 0.6 } };

/** The colour knobs a palette other than "default" must set, light and dark (the shape knobs come from "default"). */
export const COLOUR_KNOBS = [
  '--dv-color-scheme', '--dv-backdrop', '--dv-surface', '--dv-surface-2', '--dv-surface-3', '--dv-surface-solid', '--dv-surface-2-solid',
  '--dv-border', '--dv-border-strong', '--dv-overlay', '--dv-text', '--dv-text-2', '--dv-text-3', '--dv-accent', '--dv-accent-hover',
  '--dv-accent-soft', '--dv-accent-text', '--dv-focus', '--dv-success', '--dv-success-soft', '--dv-warning', '--dv-warning-soft',
  '--dv-danger', '--dv-danger-soft', '--dv-neutral-soft', '--dv-offline', '--dv-shadow-1', '--dv-shadow-2', '--dv-shadow-3',
  '--dv-shadow-control', '--dv-tile-on-warm', '--dv-tile-on-cool', '--dv-tile-on-switch', '--dv-icon-ring-bg', '--dv-icon-ring-on-bg',
  '--dv-icon-ring-fg', '--dv-toggle-on',
] as const;

function knobs(v: Record<(typeof COLOUR_KNOBS)[number], string>): Record<string, string> {
  return v;
}

function previewOf(k: Record<string, string>): Scheme['preview'] {
  return { backdrop: k['--dv-backdrop'], surface: k['--dv-surface-solid'], text: k['--dv-text'], accent: k['--dv-accent'], on: `rgb(${k['--dv-tile-on-warm']})` };
}

const DEFAULT_LIGHT_ROLES: Roles = {
  accent: { rgb: '0 122 255', fg: '#0062cc' },
  warm: { rgb: '255 149 0', fg: '#a35a00' },
  cool: { rgb: '50 173 230', fg: '#0b6a91' },
  success: { rgb: '52 199 89', fg: '#1d7a37' },
  warning: { rgb: '230 180 0', fg: '#7d5f00' },
  danger: { rgb: '255 59 48', fg: '#c0170f' },
  neutral: { rgb: '120 120 128', fg: '#3a3a3c' },
};
const DEFAULT_DARK_ROLES: Roles = {
  accent: { rgb: '10 132 255', fg: '#64d2ff' },
  warm: { rgb: '255 159 10', fg: '#ffc46b' },
  cool: { rgb: '100 210 255', fg: '#9be3ff' },
  success: { rgb: '48 209 88', fg: '#7ee29a' },
  warning: { rgb: '255 214 10', fg: '#ffe066' },
  danger: { rgb: '255 69 58', fg: '#ff8a80' },
  neutral: { rgb: '142 142 147', fg: '#d1d1d6' },
};

const SAND_LIGHT = knobs({
  '--dv-color-scheme': 'light',
  '--dv-backdrop': 'radial-gradient(1100px 560px at 85% -12%, rgba(214, 140, 69, 0.22), transparent 60%), radial-gradient(900px 520px at 8% 112%, rgba(176, 122, 74, 0.16), transparent 60%), linear-gradient(180deg, #f7f1e8, #efe6d8)',
  '--dv-surface': 'rgba(255, 252, 247, 0.68)',
  '--dv-surface-2': 'rgba(255, 250, 242, 0.52)',
  '--dv-surface-3': 'rgba(120, 98, 70, 0.14)',
  '--dv-surface-solid': '#fdf9f3',
  '--dv-surface-2-solid': '#f5eee3',
  '--dv-border': 'rgba(92, 70, 40, 0.14)',
  '--dv-border-strong': 'rgba(92, 70, 40, 0.26)',
  '--dv-overlay': 'rgba(40, 28, 14, 0.38)',
  '--dv-text': '#2b2118',
  '--dv-text-2': '#5a4a3a',
  '--dv-text-3': '#76644f',
  '--dv-accent': '#b3572a',
  '--dv-accent-hover': '#9a4821',
  '--dv-accent-soft': 'rgba(179, 87, 42, 0.14)',
  '--dv-accent-text': '#8f441d',
  '--dv-focus': '#b3572a',
  '--dv-success': '#3f8f4f',
  '--dv-success-soft': 'rgba(63, 143, 79, 0.16)',
  '--dv-warning': '#d98a1c',
  '--dv-warning-soft': 'rgba(217, 138, 28, 0.18)',
  '--dv-danger': '#c2362b',
  '--dv-danger-soft': 'rgba(194, 54, 43, 0.13)',
  '--dv-neutral-soft': 'rgba(120, 98, 70, 0.14)',
  '--dv-offline': '#9a8a78',
  '--dv-shadow-1': '0 10px 30px rgba(80, 55, 25, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
  '--dv-shadow-2': '0 18px 44px rgba(80, 55, 25, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
  '--dv-shadow-3': '0 24px 64px rgba(40, 28, 14, 0.28)',
  '--dv-shadow-control': '0 1px 4px rgba(60, 40, 20, 0.2)',
  '--dv-tile-on-warm': '217 138 28',
  '--dv-tile-on-cool': '179 87 42',
  '--dv-tile-on-switch': '63 143 79',
  '--dv-icon-ring-bg': 'rgba(120, 98, 70, 0.14)',
  '--dv-icon-ring-on-bg': 'rgba(255, 255, 255, 0.4)',
  '--dv-icon-ring-fg': '#2b2118',
  '--dv-toggle-on': '#3f8f4f',
});
const SAND_DARK = knobs({
  '--dv-color-scheme': 'dark',
  '--dv-backdrop': 'radial-gradient(1200px 600px at 80% -10%, rgba(240, 166, 64, 0.2), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(224, 136, 80, 0.2), transparent 60%), #15100b',
  '--dv-surface': 'rgba(38, 30, 22, 0.74)',
  '--dv-surface-2': 'rgba(56, 45, 34, 0.62)',
  '--dv-surface-3': 'rgba(245, 230, 210, 0.14)',
  '--dv-surface-solid': '#261e16',
  '--dv-surface-2-solid': '#382d22',
  '--dv-border': 'rgba(255, 240, 220, 0.13)',
  '--dv-border-strong': 'rgba(255, 240, 220, 0.24)',
  '--dv-overlay': 'rgba(0, 0, 0, 0.55)',
  '--dv-text': '#f6efe6',
  '--dv-text-2': 'rgba(246, 239, 230, 0.74)',
  '--dv-text-3': 'rgba(246, 239, 230, 0.58)',
  '--dv-accent': '#e08850',
  '--dv-accent-hover': '#eaa06f',
  '--dv-accent-soft': 'rgba(224, 136, 80, 0.24)',
  '--dv-accent-text': '#f2b58a',
  '--dv-focus': '#f2b58a',
  '--dv-success': '#5cbf6e',
  '--dv-success-soft': 'rgba(92, 191, 110, 0.2)',
  '--dv-warning': '#f0a640',
  '--dv-warning-soft': 'rgba(240, 166, 64, 0.2)',
  '--dv-danger': '#f06a5c',
  '--dv-danger-soft': 'rgba(240, 106, 92, 0.2)',
  '--dv-neutral-soft': 'rgba(180, 160, 140, 0.2)',
  '--dv-offline': '#8f8272',
  '--dv-shadow-1': '0 18px 48px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 240, 220, 0.08)',
  '--dv-shadow-2': '0 22px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 240, 220, 0.1)',
  '--dv-shadow-3': '0 26px 70px rgba(0, 0, 0, 0.6)',
  '--dv-shadow-control': '0 1px 4px rgba(0, 0, 0, 0.35)',
  '--dv-tile-on-warm': '240 166 64',
  '--dv-tile-on-cool': '224 136 80',
  '--dv-tile-on-switch': '92 191 110',
  '--dv-icon-ring-bg': 'rgba(245, 230, 210, 0.12)',
  '--dv-icon-ring-on-bg': 'rgba(255, 255, 255, 0.18)',
  '--dv-icon-ring-fg': '#f6efe6',
  '--dv-toggle-on': '#5cbf6e',
});

const FOREST_LIGHT = knobs({
  '--dv-color-scheme': 'light',
  '--dv-backdrop': 'radial-gradient(1100px 560px at 85% -12%, rgba(120, 180, 90, 0.2), transparent 60%), radial-gradient(900px 520px at 8% 112%, rgba(46, 125, 79, 0.16), transparent 60%), linear-gradient(180deg, #eef4ee, #e3ece4)',
  '--dv-surface': 'rgba(255, 255, 255, 0.66)',
  '--dv-surface-2': 'rgba(250, 253, 250, 0.52)',
  '--dv-surface-3': 'rgba(60, 90, 70, 0.14)',
  '--dv-surface-solid': '#fafcfa',
  '--dv-surface-2-solid': '#eff5f0',
  '--dv-border': 'rgba(40, 70, 50, 0.13)',
  '--dv-border-strong': 'rgba(40, 70, 50, 0.24)',
  '--dv-overlay': 'rgba(12, 30, 20, 0.38)',
  '--dv-text': '#17231b',
  '--dv-text-2': '#3f5245',
  '--dv-text-3': '#5d6f62',
  '--dv-accent': '#2e7d4f',
  '--dv-accent-hover': '#246540',
  '--dv-accent-soft': 'rgba(46, 125, 79, 0.14)',
  '--dv-accent-text': '#1f6a41',
  '--dv-focus': '#2e7d4f',
  '--dv-success': '#2e9e5b',
  '--dv-success-soft': 'rgba(46, 158, 91, 0.16)',
  '--dv-warning': '#c98a1a',
  '--dv-warning-soft': 'rgba(201, 138, 26, 0.18)',
  '--dv-danger': '#c0392b',
  '--dv-danger-soft': 'rgba(192, 57, 43, 0.13)',
  '--dv-neutral-soft': 'rgba(60, 90, 70, 0.13)',
  '--dv-offline': '#86958a',
  '--dv-shadow-1': '0 10px 30px rgba(20, 50, 30, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.65)',
  '--dv-shadow-2': '0 18px 44px rgba(20, 50, 30, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.65)',
  '--dv-shadow-3': '0 24px 64px rgba(12, 30, 20, 0.26)',
  '--dv-shadow-control': '0 1px 4px rgba(0, 0, 0, 0.18)',
  '--dv-tile-on-warm': '201 138 26',
  '--dv-tile-on-cool': '46 125 79',
  '--dv-tile-on-switch': '46 158 91',
  '--dv-icon-ring-bg': 'rgba(60, 90, 70, 0.13)',
  '--dv-icon-ring-on-bg': 'rgba(255, 255, 255, 0.36)',
  '--dv-icon-ring-fg': '#17231b',
  '--dv-toggle-on': '#2e9e5b',
});
const FOREST_DARK = knobs({
  '--dv-color-scheme': 'dark',
  '--dv-backdrop': 'radial-gradient(1200px 600px at 80% -10%, rgba(140, 200, 100, 0.18), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(46, 158, 91, 0.22), transparent 60%), #0b120e',
  '--dv-surface': 'rgba(22, 32, 26, 0.74)',
  '--dv-surface-2': 'rgba(34, 48, 39, 0.62)',
  '--dv-surface-3': 'rgba(220, 240, 225, 0.14)',
  '--dv-surface-solid': '#16201a',
  '--dv-surface-2-solid': '#223027',
  '--dv-border': 'rgba(220, 255, 230, 0.12)',
  '--dv-border-strong': 'rgba(220, 255, 230, 0.23)',
  '--dv-overlay': 'rgba(0, 0, 0, 0.55)',
  '--dv-text': '#eef6f0',
  '--dv-text-2': 'rgba(238, 246, 240, 0.74)',
  '--dv-text-3': 'rgba(238, 246, 240, 0.58)',
  '--dv-accent': '#4fbf7f',
  '--dv-accent-hover': '#72cf99',
  '--dv-accent-soft': 'rgba(79, 191, 127, 0.24)',
  '--dv-accent-text': '#8fe0b0',
  '--dv-focus': '#8fe0b0',
  '--dv-success': '#4fd083',
  '--dv-success-soft': 'rgba(79, 208, 131, 0.2)',
  '--dv-warning': '#e9b04a',
  '--dv-warning-soft': 'rgba(233, 176, 74, 0.2)',
  '--dv-danger': '#f06a5c',
  '--dv-danger-soft': 'rgba(240, 106, 92, 0.2)',
  '--dv-neutral-soft': 'rgba(150, 175, 158, 0.2)',
  '--dv-offline': '#7f8f84',
  '--dv-shadow-1': '0 18px 48px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(220, 255, 230, 0.07)',
  '--dv-shadow-2': '0 22px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(220, 255, 230, 0.09)',
  '--dv-shadow-3': '0 26px 70px rgba(0, 0, 0, 0.6)',
  '--dv-shadow-control': '0 1px 4px rgba(0, 0, 0, 0.35)',
  '--dv-tile-on-warm': '233 176 74',
  '--dv-tile-on-cool': '79 191 127',
  '--dv-tile-on-switch': '79 208 131',
  '--dv-icon-ring-bg': 'rgba(220, 240, 225, 0.12)',
  '--dv-icon-ring-on-bg': 'rgba(255, 255, 255, 0.18)',
  '--dv-icon-ring-fg': '#eef6f0',
  '--dv-toggle-on': '#4fd083',
});

const GRAPHITE_LIGHT = knobs({
  '--dv-color-scheme': 'light',
  '--dv-backdrop': 'radial-gradient(1100px 560px at 85% -12%, rgba(120, 130, 150, 0.18), transparent 60%), radial-gradient(900px 520px at 8% 112%, rgba(79, 91, 213, 0.12), transparent 60%), linear-gradient(180deg, #f1f2f4, #e6e8eb)',
  '--dv-surface': 'rgba(255, 255, 255, 0.7)',
  '--dv-surface-2': 'rgba(250, 250, 251, 0.55)',
  '--dv-surface-3': 'rgba(60, 64, 72, 0.13)',
  '--dv-surface-solid': '#fbfbfc',
  '--dv-surface-2-solid': '#f1f2f4',
  '--dv-border': 'rgba(30, 34, 40, 0.12)',
  '--dv-border-strong': 'rgba(30, 34, 40, 0.24)',
  '--dv-overlay': 'rgba(15, 17, 20, 0.4)',
  '--dv-text': '#1d1f23',
  '--dv-text-2': '#474b53',
  '--dv-text-3': '#666b74',
  '--dv-accent': '#4f5bd5',
  '--dv-accent-hover': '#3f4ab8',
  '--dv-accent-soft': 'rgba(79, 91, 213, 0.13)',
  '--dv-accent-text': '#3b46ad',
  '--dv-focus': '#4f5bd5',
  '--dv-success': '#2f9e6a',
  '--dv-success-soft': 'rgba(47, 158, 106, 0.15)',
  '--dv-warning': '#d08a1e',
  '--dv-warning-soft': 'rgba(208, 138, 30, 0.16)',
  '--dv-danger': '#c53030',
  '--dv-danger-soft': 'rgba(197, 48, 48, 0.12)',
  '--dv-neutral-soft': 'rgba(60, 64, 72, 0.12)',
  '--dv-offline': '#8b9099',
  '--dv-shadow-1': '0 10px 30px rgba(20, 24, 32, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
  '--dv-shadow-2': '0 18px 44px rgba(20, 24, 32, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
  '--dv-shadow-3': '0 24px 64px rgba(15, 17, 20, 0.26)',
  '--dv-shadow-control': '0 1px 4px rgba(0, 0, 0, 0.18)',
  '--dv-tile-on-warm': '208 138 30',
  '--dv-tile-on-cool': '79 91 213',
  '--dv-tile-on-switch': '47 158 106',
  '--dv-icon-ring-bg': 'rgba(60, 64, 72, 0.12)',
  '--dv-icon-ring-on-bg': 'rgba(255, 255, 255, 0.4)',
  '--dv-icon-ring-fg': '#1d1f23',
  '--dv-toggle-on': '#2f9e6a',
});
const GRAPHITE_DARK = knobs({
  '--dv-color-scheme': 'dark',
  '--dv-backdrop': 'radial-gradient(1200px 600px at 80% -10%, rgba(139, 147, 240, 0.16), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(120, 130, 150, 0.18), transparent 60%), #0d0e10',
  '--dv-surface': 'rgba(30, 31, 34, 0.76)',
  '--dv-surface-2': 'rgba(44, 46, 50, 0.64)',
  '--dv-surface-3': 'rgba(230, 232, 240, 0.14)',
  '--dv-surface-solid': '#1e1f22',
  '--dv-surface-2-solid': '#2c2e32',
  '--dv-border': 'rgba(255, 255, 255, 0.12)',
  '--dv-border-strong': 'rgba(255, 255, 255, 0.23)',
  '--dv-overlay': 'rgba(0, 0, 0, 0.58)',
  '--dv-text': '#f2f3f5',
  '--dv-text-2': 'rgba(242, 243, 245, 0.74)',
  '--dv-text-3': 'rgba(242, 243, 245, 0.57)',
  '--dv-accent': '#8b93f0',
  '--dv-accent-hover': '#a6acf4',
  '--dv-accent-soft': 'rgba(139, 147, 240, 0.24)',
  '--dv-accent-text': '#b7bcf7',
  '--dv-focus': '#b7bcf7',
  '--dv-success': '#4cc38a',
  '--dv-success-soft': 'rgba(76, 195, 138, 0.2)',
  '--dv-warning': '#eba94a',
  '--dv-warning-soft': 'rgba(235, 169, 74, 0.2)',
  '--dv-danger': '#f07167',
  '--dv-danger-soft': 'rgba(240, 113, 103, 0.2)',
  '--dv-neutral-soft': 'rgba(160, 165, 175, 0.2)',
  '--dv-offline': '#868b94',
  '--dv-shadow-1': '0 18px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.07)',
  '--dv-shadow-2': '0 22px 60px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.09)',
  '--dv-shadow-3': '0 26px 70px rgba(0, 0, 0, 0.62)',
  '--dv-shadow-control': '0 1px 4px rgba(0, 0, 0, 0.35)',
  '--dv-tile-on-warm': '235 169 74',
  '--dv-tile-on-cool': '139 147 240',
  '--dv-tile-on-switch': '76 195 138',
  '--dv-icon-ring-bg': 'rgba(230, 232, 240, 0.12)',
  '--dv-icon-ring-on-bg': 'rgba(255, 255, 255, 0.18)',
  '--dv-icon-ring-fg': '#f2f3f5',
  '--dv-toggle-on': '#4cc38a',
});

export const DEVICE_PALETTES: DevicePalette[] = [
  {
    id: 'default',
    name: 'כחול',
    hint: 'ברירת המחדל: כחול iOS',
    light: {
      knobs: null,
      roles: DEFAULT_LIGHT_ROLES,
      preview: { backdrop: 'radial-gradient(140px 80px at 85% -10%, rgba(255, 184, 86, 0.3), transparent 60%), linear-gradient(180deg, #eef2f9, #e5eaf4)', surface: '#fbfcfe', text: '#1c1c1e', accent: '#007aff', on: 'rgb(255 159 10)' },
    },
    dark: {
      knobs: null,
      roles: DEFAULT_DARK_ROLES,
      preview: { backdrop: 'radial-gradient(140px 80px at 85% -10%, rgba(255, 184, 86, 0.3), transparent 60%), #0a0a0c', surface: '#1c1c1e', text: '#f5f5f7', accent: '#0a84ff', on: 'rgb(255 159 10)' },
    },
  },
  {
    id: 'sand',
    name: 'חול',
    hint: 'חם: בז׳ וטרקוטה',
    light: {
      knobs: SAND_LIGHT,
      roles: {
        accent: { rgb: '179 87 42', fg: '#8f441d' },
        warm: { rgb: '217 138 28', fg: '#8a5410' },
        cool: { rgb: '70 130 150', fg: '#2f5f70' },
        success: { rgb: '63 143 79', fg: '#2d6b39' },
        warning: { rgb: '214 170 30', fg: '#6f5608' },
        danger: { rgb: '194 54 43', fg: '#9e2a21' },
        neutral: { rgb: '120 98 70', fg: '#4a3b2b' },
      },
      preview: previewOf(SAND_LIGHT),
    },
    dark: {
      knobs: SAND_DARK,
      roles: {
        accent: { rgb: '224 136 80', fg: '#f2b58a' },
        warm: { rgb: '240 166 64', fg: '#f7c98a' },
        cool: { rgb: '110 170 190', fg: '#a8d4e2' },
        success: { rgb: '92 191 110', fg: '#9bdca8' },
        warning: { rgb: '236 200 80', fg: '#f3dc8e' },
        danger: { rgb: '240 106 92', fg: '#f6a79d' },
        neutral: { rgb: '180 160 140', fg: '#ddd0c2' },
      },
      preview: previewOf(SAND_DARK),
    },
  },
  {
    id: 'forest',
    name: 'יער',
    hint: 'ירוק רגוע',
    light: {
      knobs: FOREST_LIGHT,
      roles: {
        accent: { rgb: '46 125 79', fg: '#1f6a41' },
        warm: { rgb: '201 138 26', fg: '#7d5410' },
        cool: { rgb: '45 130 150', fg: '#1d5e6d' },
        success: { rgb: '46 158 91', fg: '#1e6e3e' },
        warning: { rgb: '200 165 30', fg: '#675508' },
        danger: { rgb: '192 57 43', fg: '#962c21' },
        neutral: { rgb: '60 90 70', fg: '#33473a' },
      },
      preview: previewOf(FOREST_LIGHT),
    },
    dark: {
      knobs: FOREST_DARK,
      roles: {
        accent: { rgb: '79 191 127', fg: '#8fe0b0' },
        warm: { rgb: '233 176 74', fg: '#f3d08f' },
        cool: { rgb: '90 180 200', fg: '#a3dbe7' },
        success: { rgb: '79 208 131', fg: '#9ae6b8' },
        warning: { rgb: '230 205 80', fg: '#f0e08f' },
        danger: { rgb: '240 106 92', fg: '#f6a79d' },
        neutral: { rgb: '150 175 158', fg: '#cfdcd2' },
      },
      preview: previewOf(FOREST_DARK),
    },
  },
  {
    id: 'graphite',
    name: 'גרפיט',
    hint: 'אפור ניטרלי, אינדיגו',
    light: {
      knobs: GRAPHITE_LIGHT,
      roles: {
        accent: { rgb: '79 91 213', fg: '#3b46ad' },
        warm: { rgb: '208 138 30', fg: '#80520f' },
        cool: { rgb: '50 150 190', fg: '#1f6583' },
        success: { rgb: '47 158 106', fg: '#1f6e49' },
        warning: { rgb: '210 170 30', fg: '#6c5608' },
        danger: { rgb: '197 48 48', fg: '#9b2424' },
        neutral: { rgb: '60 64 72', fg: '#2f3238' },
      },
      preview: previewOf(GRAPHITE_LIGHT),
    },
    dark: {
      knobs: GRAPHITE_DARK,
      roles: {
        accent: { rgb: '139 147 240', fg: '#b7bcf7' },
        warm: { rgb: '235 169 74', fg: '#f4cd92' },
        cool: { rgb: '100 190 225', fg: '#a9dcef' },
        success: { rgb: '76 195 138', fg: '#9adfbd' },
        warning: { rgb: '232 205 84', fg: '#f1e093' },
        danger: { rgb: '240 113 103', fg: '#f6aba4' },
        neutral: { rgb: '160 165 175', fg: '#d7d9de' },
      },
      preview: previewOf(GRAPHITE_DARK),
    },
  },
];

function decls(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}

function roleDecls(roles: Roles, scheme: 'light' | 'dark'): string {
  const a = ROLE_ALPHA[scheme];
  return LAYOUT_ROLE_IDS.map((r) => `--dv-role-${r}-bg: rgb(${roles[r].rgb} / ${a.bg}); --dv-role-${r}-border: rgb(${roles[r].rgb} / ${a.border}); --dv-role-${r}-fg: ${roles[r].fg};`).join(' ');
}

function paletteCss(): string {
  const out: string[] = [];
  for (const p of DEVICE_PALETTES) {
    const glass = `:host([data-devices-style='glass'][data-devices-theme='${p.id}'])`;
    const glassDark = `:host([data-devices-style='glass'][data-devices-theme='${p.id}'][data-devices-scheme='dark'])`;
    if (p.light.knobs) out.push(`${glass} { ${decls(p.light.knobs)} }`);
    if (p.dark.knobs) out.push(`${glassDark} { ${decls(p.dark.knobs)} }`);
    // roles: every style (light values), glass in the dark scheme (dark values)
    out.push(`:host([data-devices-theme='${p.id}']) { ${roleDecls(p.light.roles, 'light')} }`);
    out.push(`${glassDark} { ${roleDecls(p.dark.roles, 'dark')} }`);
  }
  return out.join('\n');
}

/** Included by every device screen after devices-themes.ts (devices-style.ts, devicesStyleTokens). */
export const devicesPalettes = unsafeCSS(paletteCss());
