import { lt, same, type TokenTable } from '../tokens';
import type { Skin } from './index';

/** Skin "Tesla clean hi-tech": flat opaque surfaces, 1px rules, sharp corners, large numerals, one cold accent. Values from the approved package. */
const tokens: TokenTable = {
  '--sw-bg': lt('#ffffff', '#000000'),
  '--sw-canvas': lt('linear-gradient(#ffffff, #ffffff)', 'linear-gradient(#000000, #000000)'),
  '--sw-surface': lt('#fafafa', '#0f0f0f'),
  '--sw-surface-2': lt('#f2f2f2', '#171717'),
  '--sw-surface-3': lt('#e6e6e6', '#242424'),
  '--sw-surface-solid': lt('#fafafa', '#0f0f0f'),
  '--sw-surface-2-solid': lt('#f2f2f2', '#171717'),
  '--sw-surface-3-solid': lt('#e6e6e6', '#242424'),
  '--sw-border': lt('rgba(0,0,0,.12)', 'rgba(255,255,255,.12)'),
  '--sw-border-strong': lt('rgba(0,0,0,.28)', 'rgba(255,255,255,.26)'),
  '--sw-overlay': lt('rgba(0,0,0,.50)', 'rgba(0,0,0,.72)'),
  '--sw-video-bg': lt('#111111', '#000000'),
  '--sw-text': lt('#171a20', '#e7e7e7'),
  '--sw-heading': lt('#000000', '#ffffff'),
  '--sw-text-2': lt('#3f4247', '#a6a6a6'),
  '--sw-text-3': lt('#606368', '#8f8f8f'),
  '--sw-text-inverse': lt('#ffffff', '#000000'),
  '--sw-accent': lt('#2662f0', '#3d7eff'),
  '--sw-accent-hover': lt('#1d52d1', '#5f97ff'),
  '--sw-accent-soft': lt('rgba(38,98,240,.10)', 'rgba(61,126,255,.16)'),
  '--sw-accent-text': lt('#1f56d6', '#7fadff'),
  '--sw-focus': lt('#2662f0', '#7fadff'),
  '--sw-nav': lt('#2662f0', '#3d7eff'),
  '--sw-live': lt('#0f9d58', '#2fd070'),
  '--sw-live-soft': lt('rgba(15,157,88,.10)', 'rgba(47,208,112,.14)'),
  '--sw-recorded': lt('#2662f0', '#3d7eff'),
  '--sw-recorded-soft': lt('rgba(38,98,240,.10)', 'rgba(61,126,255,.16)'),
  '--sw-offline': lt('#7a7c80', '#8f8f8f'),
  '--sw-offline-soft': lt('rgba(122,124,128,.10)', 'rgba(143,143,143,.14)'),
  '--sw-stale': lt('#b8720a', '#f2b134'),
  '--sw-stale-soft': lt('rgba(196,127,0,.10)', 'rgba(242,177,52,.14)'),
  '--sw-unknown': lt('#a8aaae', '#5c5c5c'),
  '--sw-unknown-soft': lt('rgba(168,170,174,.12)', 'rgba(92,92,92,.20)'),
  '--sw-danger': lt('#d92c2c', '#ff5a5a'),
  '--sw-danger-soft': lt('rgba(217,44,44,.10)', 'rgba(255,90,90,.14)'),
  '--sw-warning': lt('#b8720a', '#f2b134'),
  '--sw-warning-soft': lt('rgba(196,127,0,.10)', 'rgba(242,177,52,.14)'),
  '--sw-success': lt('#0f9d58', '#2fd070'),
  '--sw-success-soft': lt('rgba(15,157,88,.10)', 'rgba(47,208,112,.14)'),
  '--sw-forbidden': lt('#c81e1e', '#ff6b6b'),
  '--sw-forbidden-soft': lt('rgba(200,30,30,.10)', 'rgba(255,107,107,.14)'),
  '--sw-purple': lt('#6b4fd8', '#b48cff'),
  '--sw-live-text': lt('#0a7a44', '#2fd070'),
  '--sw-recorded-text': lt('#1f56d6', '#7fadff'),
  '--sw-offline-text': lt('#55575b', '#b3b3b3'),
  '--sw-stale-text': lt('#7a4c00', '#f2b134'),
  '--sw-unknown-text': lt('#5c5e62', '#a6a6a6'),
  '--sw-danger-text': lt('#b01f1f', '#ff5a5a'),
  '--sw-warning-text': lt('#7a4c00', '#f2b134'),
  '--sw-success-text': lt('#0a7a44', '#2fd070'),
  '--sw-forbidden-text': lt('#a51818', '#ff6b6b'),
  '--sw-toggle-on': lt('#2662f0', '#3d7eff'),
  '--sw-map-bg': lt('#f4f6fa', '#0f141d'),
  '--sw-map-wall': lt('#b9c3d3', '#4a5568'),
  '--sw-map-furniture': lt('#e7ecf4', '#1f2736'),
  '--sw-map-furniture-line': lt('#cfd7e3', '#3a4457'),
  '--sw-map-structure': lt('#4f5b73', '#9aa6bb'),
  '--sw-map-glass': lt('#5b8cff', '#3d7eff'),
  '--sw-map-candidate': lt('#2662f0', '#3d7eff'),
  '--sw-map-label': lt('#5f6c82', '#8391a8'),
  '--sw-map-presence': lt('#2662f0', '#3d7eff'),
  '--sw-fov': lt('rgba(38,98,240,.10)', 'rgba(61,126,255,.14)'),
  '--sw-obj-light': lt('#e5a52a', '#f2b544'),
  '--sw-obj-electrical': lt('#d9712a', '#f08a45'),
  '--sw-obj-safety': lt('#d94039', '#ff6b62'),
  '--sw-obj-medical': lt('#2c9ba6', '#4fc3ce'),
  '--sw-obj-sport': lt('#3a9a55', '#5cc47a'),
  '--sw-obj-sanitary': lt('#4f8fd0', '#7fb2ff'),
  '--sw-obj-security': lt('#7457c2', '#a78bfa'),
  '--sw-obj-outdoor': lt('#55964a', '#7cc26e'),
  '--sw-circuit-1': lt('#2662f0', '#3d7eff'),
  '--sw-circuit-2': lt('#d98a0b', '#f5b043'),
  '--sw-circuit-3': lt('#1f9d55', '#3ddc84'),
  '--sw-circuit-4': lt('#9a55f0', '#c084fc'),
  '--sw-circuit-5': lt('#d93838', '#ff6b62'),
  '--sw-circuit-6': lt('#12a39a', '#2dd4bf'),
  '--sw-fs-xs': same('12px'),
  '--sw-fs-sm': same('13px'),
  '--sw-fs-lg': same('16px'),
  '--sw-fs-xl': same('18px'),
  '--sw-fs-2xl': same('22px'),
  '--sw-fs-3xl': same('30px'),
  '--sw-h1': same('48px'),
  '--sw-h1-weight': same('500'),
  '--sw-h1-tracking': same('-0.5px'),
  '--sw-page-pad': same('32px'),
  '--sw-r-sm': same('4px'),
  '--sw-r-md': same('6px'),
  '--sw-r-lg': same('8px'),
  '--sw-r-xl': same('8px'),
  '--sw-r-pill': same('6px'),
  '--sw-shadow-1': same('none'),
  '--sw-shadow-2': same('none'),
  '--sw-shadow-3': lt('0 0 0 1px rgba(0,0,0,.28)', '0 0 0 1px rgba(255,255,255,.26)'),
  '--sw-shadow-thumb': same('none'),
  '--sw-t-fast': same('100ms'),
  '--sw-t-med': same('180ms'),
  '--sw-ease': same('cubic-bezier(.4, 0, .2, 1)'),
  '--sw-ease-thumb': same('cubic-bezier(.4, 0, .2, 1)'),
};

const rules = `
/* tesla 1 - the rail is a flat column with a hairline; the brand mark is an outline; the active item is the heading colour */
:host(sw-app) nav.rail.rail { background: var(--sw-bg); border-inline-end: 1px solid var(--sw-border); }
:host(sw-app) .brand-tile { background: transparent; color: var(--sw-heading); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); box-shadow: none; font-weight: 600; }
:host(sw-app) a.item.a { border-radius: var(--sw-r-md); }
:host(sw-app) a.item.a.active { background: transparent; color: var(--sw-heading); }
:host(sw-app) a.item.a.active sw-icon { color: var(--sw-heading); }
/* tesla 2 - the phone bar and the corner pill are flat too */
:host(sw-app) nav.bottom.bottom { background: var(--sw-bg); box-shadow: none; border-block-start: 1px solid var(--sw-border); }
:host(sw-app) nav.bottom.bottom a.active .ic { background: transparent; box-shadow: inset 0 -2px 0 var(--sw-accent); border-radius: 0; }
:host(sw-app) .float .pillrow { border-radius: var(--sw-r-md); box-shadow: none; }
:host(sw-app) .searchpanel { box-shadow: none; border-color: var(--sw-border-strong); }
/* tesla 3 - the building tree: a ruled panel, the selected row marked by a 2px accent rule at its start edge */
:host(devices-building) nav.tree { border-radius: var(--sw-r-lg); padding: 10px; }
:host(devices-building) .tree-row { position: relative; border-radius: var(--sw-r-sm); padding-block: 8px; }
:host(devices-building) .tree-row.selected { background: var(--sw-surface-3); color: var(--sw-heading); }
:host(devices-building) .tree-row.selected::before { content: ''; position: absolute; inset-block: 6px; inset-inline-start: 0; inline-size: 2px; background: var(--sw-accent); }
/* tesla 4 - titles in medium weight, big numerals */
:host(sw-page) h1, :host(sw-card) h3, :host(sw-dialog) h3 { font-weight: var(--sw-fw-medium); }
:host(sw-kpi) .value { font-weight: var(--sw-fw-medium); font-variant-numeric: tabular-nums; }
/* tesla 5 - flat, outlined controls */
:host(sw-button) button { border-radius: var(--sw-r-md); box-shadow: none; }
:host(sw-button[variant='primary']) button { box-shadow: none; }
:host(sw-button[variant='secondary']) button, :host(sw-button[variant='danger']) button { background: transparent; }
:host(sw-chip) button { background: transparent; border-radius: var(--sw-r-md); box-shadow: none; }
:host(sw-chip[selected]) button { background: var(--sw-text); border-color: var(--sw-text); color: var(--sw-text-inverse); }
:host(sw-badge:not([onimage])) { background: transparent; border: 1px solid color-mix(in srgb, currentColor 45%, transparent); border-radius: var(--sw-r-md); }
::slotted(input), ::slotted(select), ::slotted(textarea) { background: transparent; border-radius: var(--sw-r-sm); }
/* tesla 6 - switch: an outlined track, the thumb in grey, accent when on */
:host(sw-toggle) button { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
:host(sw-toggle) button::after { background: var(--sw-text-2); box-shadow: none; }
:host(sw-toggle[checked]) button { background: var(--sw-toggle-on); box-shadow: none; }
:host(sw-toggle[checked]) button::after { background: #fff; }
/* tesla 7 - the segmented control: outlined boxes, the selected segment inverted */
:host(sw-tabs[data-variant='pill']) .row::before { background: transparent; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); }
:host(sw-tabs[data-variant='pill']) .lbl { border-radius: var(--sw-r-sm); }
:host(sw-tabs[data-variant='pill']) .on .lbl { background: var(--sw-text); color: var(--sw-text-inverse); box-shadow: none; }
/* tesla 8 - floating layers: a strong rule instead of a shadow */
:host(sw-dialog) .box, :host(sw-popover), :host(sw-drawer) .panel { border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); box-shadow: none; }
/* tesla 9 - the home widgets lose their tint (the alarm's error tone keeps its colour) */
:host(home-widgets) .wg-weather, :host(home-widgets) .wg-shabbat { background: var(--sw-surface); }
/* tesla 10 - tables: ruled rows, small-caps headings */
:host(sw-table) th { text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--sw-fs-xs); }
:host(sw-table) tbody tr:hover { background: var(--sw-surface-2); }
`;

export const tesla: Skin = { id: 'tesla', name: 'Tesla clean hi-tech', nameHe: 'הייטק נקי (Tesla)', noteHe: 'משטחים שטוחים, קווי 1px, פינות חדות, מבטא אחד', tokens, rules };
