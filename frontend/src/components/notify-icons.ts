import { html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

/**
 * CR-018: the pictograms of the notification surfaces (the approved mockup's set: the stroke style of sw-icon, 24x24, round caps, neutral
 * glyphs - never a brand logo). The strings are constants of this file, never data. The shared `svg.ic` rule of styles/media-glass.ts sizes them
 * (`font-size` of the parent or the `size` argument).
 */
export const NOTIFY_ICONS: Record<string, string> = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  door: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>',
  doorOpen: '<path d="M4 21h16"/><path d="M6 21V5l8-2v18"/><path d="M14 21h4V5h-4"/><path d="M11 12h.01"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  bellRing: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/><path d="M3.5 9a8.5 8.5 0 0 1 2-4.5M20.5 9a8.5 8.5 0 0 0-2-4.5"/>',
  bellOff: '<path d="M8.6 6.6A6 6 0 0 1 18 11v5l1.5 2H9"/><path d="M6 11v5l-1.5 2H5"/><path d="M10 20a2 2 0 0 0 4 0"/><path d="m3 3 18 18"/>',
  drop: '<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/>',
  flame: '<path d="M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1.2-3.3.3 1.3 1 2 1.8 2.3C11 8.5 10.5 5.5 12 3z"/>',
  gas: '<path d="M7 13a5 5 0 0 0 10 0c0-3-3-5-2-9-3 1-3.5 4-3 6-1-1-1.5-2.5-1-4-2.5 1.5-4 4-4 7z"/><path d="M5 21h14"/>',
  siren: '<path d="M6 19v-6a6 6 0 0 1 12 0v6"/><path d="M4 19h16v2H4z"/><path d="M12 3v2M5 6l1.5 1.5M19 6l-1.5 1.5"/>',
  cameraOff: '<path d="M3 3l18 18"/><path d="M10.5 7H8.5L7 9H4v9h12"/><path d="M20 15.5V9h-3l-1.5-2H12"/><path d="M9.5 13.5a2.5 2.5 0 0 0 3.5 2.3"/>',
  cam: '<path d="M4 9h3l1.5-2h7L17 9h3v9H4z"/><circle cx="12" cy="13" r="3"/>',
  hdd: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 13h18"/><path d="M7 16.5h.01M10 16.5h.01"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9"/><path d="M10 13h4"/>',
  warning: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  snooze: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M15 2h5l-5 4h5"/>',
  bolt: '<path d="M13 3 4 14h7l-1 7 9-11h-7z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4"/><path d="M6 10v4"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="m11 11 9-9"/><path d="m16 6 3 3M14 8l2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  checkAll: '<path d="m2 12 4.5 4.5L15 8"/><path d="m11 15.5 1.5 1.5L22 8"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronBack: '<path d="m15 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  open: '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  send: '<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m21 3-11 10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  escal: '<path d="m4 17 6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 0 1 6.2-.6M5 12.5a10 10 0 0 1 4-2.3M16.5 10.5a10 10 0 0 1 2.5 2M2 9a15 15 0 0 1 5-3M11 5.1A15 15 0 0 1 22 9"/><path d="M12 19.5h.01"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  flash: '<path d="M8 3h8l-3 6h4L9 21l2-9H7z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};

/** One pictogram as an inline SVG (`class="ic"`); an unknown name draws the bell. */
export function nIcon(name: string, size?: number): TemplateResult {
  return html`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style=${size ? `font-size:${size}px` : ''}>${unsafeSVG(NOTIFY_ICONS[name] ?? NOTIFY_ICONS.bell)}</svg>`;
}
