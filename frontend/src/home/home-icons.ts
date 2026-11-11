// HOME-SIMPLE-2420: the home interface's own icon set - drawn for Arx in the round-25 mockup (24 grid, 1.75 stroke), copied as is.
// Static SVG markup only (no data ever goes in here), rendered through unsafeSVG.
import { html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

const P: Record<string, string> = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/>',
  rooms: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  bulb: '<path d="M9.5 18h5"/><path d="M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  thermo: '<path d="M12 3.5a2 2 0 0 0-2 2v8.6a4 4 0 1 0 4 0V5.5a2 2 0 0 0-2-2z"/><path d="M12 10.5v6.5"/>',
  door: '<path d="M6 21V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V21"/><path d="M3 21h18"/><path d="M14.5 12.5v.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>',
  cam: '<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5 21 7.5v9l-5-3"/>',
  camoff: '<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5 21 7.5v9l-5-3"/><path d="M4 4l16 16"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',
  sliders: '<path d="M4 7h9"/><path d="M19 7h1"/><circle cx="16" cy="7" r="2.5"/><path d="M4 17h1"/><path d="M11 17h9"/><circle cx="8" cy="17" r="2.5"/>',
  morning: '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 6v3"/><path d="m5 10.5 2 2"/><path d="m19 10.5-2 2"/>',
  leave: '<path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M15 12H4"/><path d="m8 8-4 4 4 4"/>',
  evening: '<path d="M8.5 4h7l2.5 7h-12z"/><path d="M12 11v9"/><path d="M8.5 20h7"/>',
  night: '<path d="M20 14.5A8 8 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5z"/>',
  arrive: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="m9 14.5 2 2 4-4"/>',
  back: '<path d="m9 6 6 6-6 6"/>', fwd: '<path d="m15 6-6 6 6 6"/>', up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  power: '<path d="M12 4v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/>',
  shade: '<path d="M4 4h16"/><path d="M6 4v10h12V4"/><path d="M6 7.5h12"/><path d="M6 10.75h12"/><path d="M12 14v4.5"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  phone: '<path d="M5 4h4l1.5 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2L20 15v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  drop: '<path d="M12 3.5c3 3.6 5.5 6.3 5.5 9.5a5.5 5.5 0 0 1-11 0c0-3.2 2.5-5.9 5.5-9.5z"/>',
  battery: '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21.5 11v2"/><path d="M6.5 11v2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="m5.6 5.6 1.4 1.4"/><path d="m17 17 1.4 1.4"/><path d="m18.4 5.6-1.4 1.4"/><path d="m7 17-1.4 1.4"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.5 7 9 4.1-1.5 7-4.8 7-9V6z"/>',
  swap: '<path d="M4 8h13"/><path d="m14 5 3 3-3 3"/><path d="M20 16H7"/><path d="m10 13-3 3 3 3"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>', map: '<path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13"/><path d="M15 6.5v13"/>',
  media: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7"/>', system: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="m18.4 5.6-2.1 2.1"/><path d="m7.7 16.3-2.1 2.1"/>',
  plug: '<path d="M9 3v5"/><path d="M15 3v5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5V21"/>',
  mic: '<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',
  scenes: '<path d="M12 3v3.5"/><path d="M12 17.5V21"/><path d="M3 12h3.5"/><path d="M17.5 12H21"/><path d="m12 8 1.3 2.7L16 12l-2.7 1.3L12 16l-1.3-2.7L8 12l2.7-1.3z"/>',
  size: '<path d="M4 9.5V4h5.5"/><path d="M20 14.5V20h-5.5"/><path d="m4 4 6.5 6.5"/><path d="m20 20-6.5-6.5"/>',
  hold: '<rect x="8" y="5" width="3" height="14" rx="1"/><rect x="13" y="5" width="3" height="14" rx="1"/>',
  switch: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="2.6"/>',
  fridge: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M6 10h12"/><path d="M9.5 6v1.5"/><path d="M9.5 13v2.5"/>',
  pump: '<circle cx="12" cy="12" r="6.5"/><path d="M12 5.5v13"/><path d="M5.5 12h13"/><path d="M3 12h2.5"/><path d="M18.5 12H21"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H17a3.5 3.5 0 0 0 3.5-3.5c0-4.7-3.8-8.5-8.5-8.5z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.2" cy="8.5" r="1"/>',
};

// HOME-V3-P1-2430: the icons the round-27 mockup v3 added (same set, same grid), for every v3 screen
Object.assign(P, {
  grid: '<circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="12" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  board: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8.5h8"/><path d="M8 12.5h8"/><path d="M8 16.5h5"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5 17 4"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  horn: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17.5 9.5a4 4 0 0 1 0 5"/><path d="M19.8 7a7.5 7.5 0 0 1 0 10"/>',
  bill: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6"/><path d="M9 12.5h6"/>',
  gen: '<rect x="3.5" y="7" width="17" height="11" rx="2.5"/><path d="M7 18v2.5"/><path d="M17 18v2.5"/><path d="m12.8 9.5-2.6 3.4h3.6l-2.6 3.4"/>',
  lift: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M12 3.5v17"/><path d="m8 10 1.5-2 1.5 2"/><path d="m13 14 1.5 2 1.5-2"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.3"/><path d="M16 14.6a4.5 4.5 0 0 1 4.8 4.4"/>',
  cloud: '<path d="M7 18.5a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 9.6a4.5 4.5 0 0 1 .5 8.9z"/>',
  rain: '<path d="M7 15.5a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 6.6a4.5 4.5 0 0 1 .5 8.9z"/><path d="M9 18.5 8 21"/><path d="M13 18.5 12 21"/><path d="M17 18.5 16 21"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13"/><path d="M15.5 5.5v13"/>',
  next: '<path d="M6 6v12l9-6z"/><path d="M18 6v12"/>',
  prev: '<path d="M18 6v12l-9-6z"/><path d="M6 6v12"/>',
  rew: '<path d="M11 7 5 12l6 5z"/><path d="M19 7l-6 5 6 5z"/>',
  ffw: '<path d="m13 7 6 5-6 5z"/><path d="m5 7 6 5-6 5z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5"/><path d="m16 7 2.5 2.5"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M8 5v14"/><path d="M16 5v14"/><path d="M3.5 12h4.5"/><path d="M16 12h4.5"/>',
  vol: '<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7"/>',
  spark: '<path d="M12 4v4"/><path d="M12 16v4"/><path d="M4 12h4"/><path d="M16 12h4"/><path d="m6.5 6.5 2.5 2.5"/><path d="m15 15 2.5 2.5"/>',
  photo: '<rect x="3.5" y="5.5" width="17" height="13.5" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="m5 17 5-4.5 3.5 3 2.5-2 3.5 3.5"/>',
  guest: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 11.5-4"/><path d="M18 14v6"/><path d="M15 17h6"/>',
  list: '<path d="M8 6.5h12"/><path d="M8 12h12"/><path d="M8 17.5h12"/><path d="M4 6.5h.01"/><path d="M4 12h.01"/><path d="M4 17.5h.01"/>',
  del: '<path d="M5 7h14"/><path d="M9.5 7V4.5h5V7"/><path d="M7 7l1 13h8l1-13"/>',
  ok2: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.5 3 3 5-6"/>',
  wind: '<path d="M3 9h10a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 14h14a2.5 2.5 0 1 1-2.5 2.5"/>',
});

export type HomeIcon = keyof typeof P;

export function hi(name: string, cls = ''): TemplateResult {
  return html`<svg class=${'hi' + (cls ? ' ' + cls : '')} viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(P[name] ?? '')}</svg>`;
}

export const hasIcon = (name: string): boolean => name in P;
