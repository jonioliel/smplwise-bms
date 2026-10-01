/* Bubble taste mockup - shared foundation: icons, fixture, shell (rail, tree, phone stack), pop-up sheet, pill sliders,
   mockup chrome (board / viewport / scheme / transparency). Static, no build, no network. Fixture data only. */
'use strict';

/* ---------------------------------------------------------------- icons (24x24 stroke, our own) */
const ICONS = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  map: '<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  media: '<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8.5 21h7M12 17v4"/><path d="m10.2 8.3 4.3 2.2-4.3 2.2z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  strip: '<path d="M3 15c3-4 6 4 9 0s6 4 9 0"/><path d="M3 10c3-4 6 4 9 0s6 4 9 0" opacity=".5"/>',
  spot: '<path d="M9 3h6l-1 6h-4z"/><path d="M6 21l4-12h4l4 12"/>',
  lamp: '<path d="M8 3h8l3 8H5z"/><path d="M12 11v8M8 21h8"/>',
  sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 18v2M19 18v2"/>',
  kitchen: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 10h14M8 6.5v1M8 13v3"/>',
  dining: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
  desk: '<rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 18v-3"/><path d="M7 13v-2a2 2 0 0 1 2-2h8a3 3 0 0 1 3 3v1"/><circle cx="6.5" cy="10.5" r="1.5"/>',
  child: '<circle cx="12" cy="6" r="2.5"/><path d="M8 21v-5l-2-4h12l-2 4v5"/>',
  bath: '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M6 12V5a2 2 0 0 1 4 0"/><path d="M7 20l-1 2M17 20l1 2"/>',
  hall: '<path d="M4 21V5l8-2 8 2v16"/><path d="M10 21v-6h4v6"/>',
  tree: '<path d="M12 3 6 11h3l-4 6h14l-4-6h3z"/><path d="M12 17v4"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="13" r=".8"/><circle cx="16.5" cy="13" r=".8"/>',
  door: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  chev: '<path d="m6 9 6 6 6-6"/>', chevBack: '<path d="m9 6 6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  power: '<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>',
  thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  snow: '<path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.2 3 2.5 3-.5-3 0-5.5 0-8z"/>',
  fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C11 6 13 3 15.5 4.5S15 10 12 10.4zM13.6 12c4.4-1 7.4 1 5.9 3.5S14 15 13.6 12zM12 13.6c1 4.4-1 7.4-3.5 5.9S9 14 12 13.6zM10.4 12C6 13 3 11 4.5 8.5S10 9 10.4 12z"/>',
  auto: '<path d="M4 18 9 6l5 12M5.8 14h6.4"/><path d="M16 8h5M18.5 5.5v5"/>',
  blinds: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 7h16M4 11h16M4 15h16"/><path d="M12 15v6"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  next: '<path d="M6 5.5v13l9-6.5z"/><path d="M18 5v14"/>', prev: '<path d="M18 5.5v13l-9-6.5z"/><path d="M6 5v14"/>',
  vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  speaker: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="14" r="3"/><path d="M12 7h.01"/>',
  tv: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloudsun: '<path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 18z"/><path d="M8 3v1.5M3.5 7.5H5M4.8 4.3l1 1"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  scene: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
  motion: '<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6L14 17v4M8 11l3-3 3 2 3 1M11.5 15 10 9"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
};
function ic(name, cls = '') { return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- fixture (invented names, no lab data) */
const FLOORS = [
  { id: 'g', name: 'קומת קרקע', areas: [
    { id: 'living', name: 'סלון', icon: 'sofa', hue: 2, temp: 25.5 },
    { id: 'kitchen', name: 'מטבח', icon: 'kitchen', hue: 1, temp: 24.1 },
    { id: 'dining', name: 'פינת אוכל', icon: 'dining', hue: 3, temp: 24.3 },
    { id: 'office', name: 'חדר עבודה', icon: 'desk', hue: 7, temp: 23.8 },
    { id: 'guest', name: 'שירותי אורחים', icon: 'bath', hue: 4, temp: null },
  ] },
  { id: 'f1', name: 'קומה א׳', areas: [
    { id: 'master', name: 'חדר שינה הורים', icon: 'bed', hue: 7, temp: 22.9 },
    { id: 'kids', name: 'חדר ילדים', icon: 'child', hue: 5, temp: 23.4 },
    { id: 'bath1', name: 'חדר רחצה', icon: 'bath', hue: 4, temp: 26.0 },
    { id: 'hall1', name: 'מסדרון', icon: 'hall', hue: 8, temp: null },
  ] },
  { id: 'out', name: 'חוץ', areas: [
    { id: 'yard', name: 'חצר', icon: 'tree', hue: 3, temp: 27.2 },
    { id: 'parking', name: 'חניה', icon: 'car', hue: 6, temp: null },
    { id: 'entry', name: 'כניסה', icon: 'door', hue: 1, temp: null },
  ] },
];
const AREAS = Object.fromEntries(FLOORS.flatMap((f) => f.areas.map((a) => [a.id, { ...a, floor: f.id, floorName: f.name }])));

/* devices: kind light | climate | cover | media | sensor | switch */
const DEVICES = [
  // living (the detailed area)
  { id: 'l1', area: 'living', kind: 'light', name: 'תאורה מרכזית', icon: 'bulb', on: true, v: 0.72, ct: 'warm' },
  { id: 'l2', area: 'living', kind: 'light', name: 'ספוטים קיר', icon: 'spot', on: true, v: 0.4, ct: 'warm' },
  { id: 'l3', area: 'living', kind: 'light', name: 'פס לד ספרייה', icon: 'strip', on: true, v: 0.25, ct: 'cool' },
  { id: 'l4', area: 'living', kind: 'light', name: 'מנורת קריאה', icon: 'lamp', on: false, v: 0.6, ct: 'warm' },
  { id: 'c1', area: 'living', kind: 'climate', name: 'מזגן סלון', icon: 'snow', mode: 'cool', target: 23, cur: 25.5, fan: 'auto' },
  { id: 'v1', area: 'living', kind: 'cover', name: 'תריס חלון גדול', icon: 'blinds', pos: 0.6 },
  { id: 'v2', area: 'living', kind: 'cover', name: 'תריס מרפסת', icon: 'blinds', pos: 0 },
  { id: 'm1', area: 'living', kind: 'media', name: 'רמקול סלון', icon: 'speaker', player: 'p-living' },
  { id: 'm2', area: 'living', kind: 'media', name: 'טלוויזיה סלון', icon: 'tv', player: 'p-tv' },
  { id: 's1', area: 'living', kind: 'sensor', name: 'טמפרטורה', icon: 'thermo', value: '25.5°' },
  { id: 's2', area: 'living', kind: 'sensor', name: 'לחות', icon: 'drop', value: '48%' },
  { id: 's3', area: 'living', kind: 'sensor', name: 'תנועה', icon: 'motion', value: 'לפני 2 דק׳' },
  { id: 's4', area: 'living', kind: 'sensor', name: 'דלת מרפסת', icon: 'door', value: 'סגורה' },
  // other areas (lighter)
  { id: 'k1', area: 'kitchen', kind: 'light', name: 'תאורת תקרה', icon: 'bulb', on: true, v: 1, ct: 'cool' },
  { id: 'k2', area: 'kitchen', kind: 'light', name: 'לד מתחת לארונות', icon: 'strip', on: false, v: 0.5, ct: 'warm' },
  { id: 'k3', area: 'kitchen', kind: 'cover', name: 'תריס מטבח', icon: 'blinds', pos: 1 },
  { id: 'k4', area: 'kitchen', kind: 'media', name: 'רמקול מטבח', icon: 'speaker', player: 'p-kitchen' },
  { id: 'd1', area: 'dining', kind: 'light', name: 'נברשת', icon: 'bulb', on: false, v: 0.8, ct: 'warm' },
  { id: 'd2', area: 'dining', kind: 'cover', name: 'תריס פינת אוכל', icon: 'blinds', pos: 0.5 },
  { id: 'o1', area: 'office', kind: 'light', name: 'מנורת שולחן', icon: 'lamp', on: true, v: 0.55, ct: 'cool' },
  { id: 'o2', area: 'office', kind: 'climate', name: 'מזגן חדר עבודה', icon: 'snow', mode: 'off', target: 24, cur: 23.8, fan: 'low' },
  { id: 'o3', area: 'office', kind: 'media', name: 'רמקול חדר עבודה', icon: 'speaker', player: 'p-office' },
  { id: 'g1', area: 'guest', kind: 'light', name: 'תאורה', icon: 'bulb', on: false, v: 1, ct: 'cool' },
  { id: 'b1', area: 'master', kind: 'light', name: 'תאורה מרכזית', icon: 'bulb', on: false, v: 0.6, ct: 'warm' },
  { id: 'b2', area: 'master', kind: 'light', name: 'מנורות לילה', icon: 'lamp', on: false, v: 0.2, ct: 'warm' },
  { id: 'b3', area: 'master', kind: 'climate', name: 'מזגן חדר שינה', icon: 'snow', mode: 'heat', target: 24, cur: 22.9, fan: 'low' },
  { id: 'b4', area: 'master', kind: 'cover', name: 'תריס חדר שינה', icon: 'blinds', pos: 0.1 },
  { id: 'b5', area: 'master', kind: 'media', name: 'רמקול חדר שינה', icon: 'speaker', player: 'p-master' },
  { id: 'ki1', area: 'kids', kind: 'light', name: 'תאורת לילה', icon: 'lamp', on: true, v: 0.15, ct: 'warm' },
  { id: 'ki2', area: 'kids', kind: 'cover', name: 'תריס חדר ילדים', icon: 'blinds', pos: 0 },
  { id: 'r1', area: 'bath1', kind: 'light', name: 'תאורה', icon: 'bulb', on: false, v: 1, ct: 'cool' },
  { id: 'r2', area: 'bath1', kind: 'switch', name: 'דוד שמש', icon: 'flame', on: false },
  { id: 'h1', area: 'hall1', kind: 'light', name: 'תאורת מעבר', icon: 'spot', on: true, v: 0.3, ct: 'warm' },
  { id: 'y1', area: 'yard', kind: 'light', name: 'תאורת גינה', icon: 'tree', on: true, v: 0.8, ct: 'warm' },
  { id: 'y2', area: 'yard', kind: 'light', name: 'פנסי שביל', icon: 'spot', on: true, v: 1, ct: 'warm' },
  { id: 'y3', area: 'yard', kind: 'media', name: 'רמקול חצר', icon: 'speaker', player: 'p-yard' },
  { id: 'y4', area: 'yard', kind: 'switch', name: 'השקיה', icon: 'drop', on: false },
  { id: 'pk1', area: 'parking', kind: 'light', name: 'תאורת חניה', icon: 'spot', on: false, v: 1, ct: 'cool' },
  { id: 'pk2', area: 'parking', kind: 'cover', name: 'שער חשמלי', icon: 'blinds', pos: 0 },
  { id: 'e1', area: 'entry', kind: 'light', name: 'תאורת כניסה', icon: 'bulb', on: true, v: 0.9, ct: 'warm' },
  { id: 'e2', area: 'entry', kind: 'sensor', name: 'דלת כניסה', icon: 'lock', value: 'נעולה' },
];
const DEV = Object.fromEntries(DEVICES.map((d) => [d.id, d]));
const PLAYERS = [
  { id: 'p-living', name: 'רמקול סלון', area: 'living', kind: 'speaker', state: 'playing', track: 'אור של ערב', artist: 'אנסמבל צפון', vol: 0.34, art: 0, pos: 0.42, dur: 236, group: 'g1', source: 'ספרייה ביתית' },
  { id: 'p-kitchen', name: 'רמקול מטבח', area: 'kitchen', kind: 'speaker', state: 'playing', track: 'אור של ערב', artist: 'אנסמבל צפון', vol: 0.22, art: 0, pos: 0.42, dur: 236, group: 'g1', source: 'ספרייה ביתית' },
  { id: 'p-master', name: 'רמקול חדר שינה', area: 'master', kind: 'speaker', state: 'paused', track: 'גלים רחוקים', artist: 'נועה ושלושת הים', vol: 0.18, art: 1, pos: 0.7, dur: 198, group: null, source: 'רדיו' },
  { id: 'p-tv', name: 'טלוויזיה סלון', area: 'living', kind: 'tv', state: 'on', track: 'HDMI 1', artist: 'ממיר', vol: 0.3, art: 2, pos: 0, dur: 0, group: null, source: 'HDMI 1' },
  { id: 'p-yard', name: 'רמקול חצר', area: 'yard', kind: 'speaker', state: 'idle', track: '', artist: '', vol: 0.5, art: 3, pos: 0, dur: 0, group: null, source: '' },
  { id: 'p-office', name: 'רמקול חדר עבודה', area: 'office', kind: 'speaker', state: 'unavailable', track: '', artist: '', vol: 0.3, art: 3, pos: 0, dur: 0, group: null, source: '' },
];
const PLAYER = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));
/* invented cover art: gradients only, never a label's artwork */
const ARTS = [
  'radial-gradient(circle at 30% 30%, #ffd36e, transparent 45%), radial-gradient(circle at 70% 70%, #ff5e8a, transparent 50%), linear-gradient(135deg, #5b3fd9, #1fb5c9)',
  'radial-gradient(circle at 65% 35%, #9be7ff, transparent 45%), linear-gradient(160deg, #123d6b, #2d8bb8 60%, #a9e2e8)',
  'linear-gradient(135deg, #2b2f3a, #4a5163)',
  'linear-gradient(135deg, #6b6f80, #9a9eb0)',
];
const AREA_STATE = (aid) => {
  const ds = DEVICES.filter((d) => d.area === aid);
  return { lit: ds.filter((d) => d.kind === 'light' && d.on).length, lights: ds.filter((d) => d.kind === 'light').length, devices: ds };
};

/* ---------------------------------------------------------------- params, scheme, viewport */
const Q = new URLSearchParams(location.search);
const STATE = {
  vp: Q.get('vp') || (innerWidth < 760 ? 'fit' : '1440'),
  scheme: Q.get('scheme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  glass: Q.get('glass') || 'glass',
  view: Q.get('view') || 'cards',
  area: Q.get('area') || 'living',
  floor: Q.get('floor') || null,
  collapsed: new Set((Q.get('collapsed') || 'out').split(',').filter(Boolean)),
};
const VP = { 1440: [1440, 900], 820: [820, 1180], 390: [390, 844] };

function setUrl() {
  const u = new URL(location.href);
  for (const k of ['vp', 'scheme', 'glass', 'view', 'area']) u.searchParams.set(k, STATE[k]);
  history.replaceState(null, '', u);
}

/* ---------------------------------------------------------------- shell */
const NAV = [
  { id: 'home', label: 'ראשי', icon: 'home', href: 'home.html' },
  { id: 'security', label: 'אבטחה', icon: 'shield', href: '#' },
  { id: 'map', label: 'מפה', icon: 'map', href: '#' },
  { id: 'media', label: 'מולטימדיה', icon: 'media', href: 'media.html' },
  { id: 'wiskey', label: 'WisKey', icon: 'key', href: '#' },
];
const BOARDS = [
  { id: 'home', label: '1 · בית', href: 'home.html' },
  { id: 'area', label: '2 · אזור + חלון קופץ', href: 'area.html' },
  { id: 'media', label: '3 · מדיה', href: 'media.html' },
];

const Mock = {
  board: null, render: null, onArea: null,
  boot(opts) {
    Mock.board = opts.board; Mock.render = opts.render; Mock.onArea = opts.onArea || null; Mock.treeMode = opts.treeMode || 'area';
    document.documentElement.dataset.skin = 'bubble';
    applyScheme();
    document.body.classList.add('mk');
    if (Q.get('shot') === '1') document.body.classList.add('shot');
    document.body.innerHTML = `
      <div class="mk-bar" role="toolbar" aria-label="בקרת המוקאפ">
        <span class="ttl">Bubble · טעימה</span>
        <span class="grp">${BOARDS.map((b) => `<a href="${b.href}" ${b.id === Mock.board ? 'aria-current="page"' : ''} data-keep>${b.label}</a>`).join('')}<a href="index.html">אינדקס</a></span>
        <span class="grp"><span>מסך</span>${['1440', '820', '390', 'fit'].map((v) => `<button data-vp="${v}" aria-pressed="${STATE.vp === v}">${v === 'fit' ? 'מלא' : v}</button>`).join('')}</span>
        <span class="grp"><span>ערכה</span><button data-scheme="light" aria-pressed="${STATE.scheme === 'light'}">בהיר</button><button data-scheme="dark" aria-pressed="${STATE.scheme === 'dark'}">כהה</button></span>
        <span class="grp"><span>שקיפות</span><button data-glass="bubble" aria-pressed="${STATE.glass === 'bubble'}">Bubble 88%</button><button data-glass="glass" aria-pressed="${STATE.glass === 'glass'}">72%</button><button data-glass="max" aria-pressed="${STATE.glass === 'max'}">58%</button></span>
      </div>
      <div class="mk-stage"><div class="mk-fit" id="fit"><div class="device" id="device">
        <div class="app" id="app">
          <nav class="rail" aria-label="ניווט ראשי">
            <div class="logo" aria-hidden="true">A</div>
            ${NAV.map((n) => `<a href="${n.href}" ${n.id === navId() ? 'aria-current="page"' : ''} data-keep>${ic(n.icon)}<span>${n.label}</span></a>`).join('')}
            <div class="spacer"></div>
            <a href="#">${ic('gear')}<span>הגדרות</span></a>
          </nav>
          <nav class="tree" id="tree" aria-label="קומות ואזורים"></nav>
          <main class="main" id="main"><div class="main-inner" id="content"></div></main>
          <nav class="stack" aria-label="ניווט ראשי">
            ${NAV.map((n) => `<a href="${n.href}" ${n.id === navId() ? 'aria-current="page"' : ''} data-keep>${ic(n.icon)}<span>${n.label}</span></a>`).join('')}
          </nav>
        </div>
        <div class="scrim" id="scrim"></div>
        <section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" hidden></section>
        <div class="toast" id="toast" role="status" aria-live="polite"></div>
      </div></div></div>`;
    wireChrome();
    applyVp();
    Mock.renderTree();
    Mock.render();
    wireSliders(document.getElementById('app'));
    Sheet.init();
    wireDevices();
    const open = Q.get('open');
    if (open && opts.openers && opts.openers[open]) requestAnimationFrame(() => opts.openers[open]());
    addEventListener('resize', fit);
  },
  rerender() { Mock.renderTree(); Mock.render(); },
  renderTree() {
    const el = document.getElementById('tree');
    el.innerHTML = `<h2><span>הבית</span><button class="sub ghost" aria-label="תפריט הבניין">${ic('dots', 's')}</button></h2>` + FLOORS.map((f) => {
      const lit = f.areas.reduce((n, a) => n + AREA_STATE(a.id).lit, 0);
      const col = STATE.collapsed.has(f.id);
      return `<div class="floor" data-collapsed="${col}">
        <div class="floor-head">
          <button class="sub chev ghost" data-floor="${f.id}" aria-expanded="${!col}" aria-label="${col ? 'הרחב' : 'כווץ'} ${f.name}">${ic('chev', 's')}</button>
          <span class="t">${f.name}</span><span class="cnt">${lit ? `${lit} דולקים` : ''}</span>
          <button class="sub ghost" aria-label="תפריט ${f.name}">${ic('dots', 's')}</button>
        </div>
        <div class="floor-areas"><div>${f.areas.map((a) => {
          const s = AREA_STATE(a.id);
          const cur = Mock.treeMode !== 'none' && STATE.area === a.id;
          return `<button class="tree-row" data-area="${a.id}" ${cur ? 'aria-current="true"' : ''} ${col ? 'tabindex="-1"' : ''}>
            <span class="dot" style="background:var(--sw-hue-${a.hue})">${ic(a.icon)}</span><span class="n">${a.name}</span>
            ${s.lit ? `<span class="lit">${ic('bulb', 's')}${s.lit}</span>` : ''}</button>`;
        }).join('')}</div></div></div>`;
    }).join('');
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(Mock._tt); Mock._tt = setTimeout(() => t.classList.remove('show'), 1800);
  },
};
function navId() { return Mock.board === 'area' ? 'home' : Mock.board; }

function applyScheme() {
  document.documentElement.dataset.theme = STATE.scheme;
  document.documentElement.dataset.glass = STATE.glass;
}
function applyVp() {
  const f = document.getElementById('fit');
  document.body.dataset.vp = STATE.vp;
  f.dataset.vp = STATE.vp;
  const d = document.getElementById('device');
  if (STATE.vp === 'fit') { d.style.width = ''; d.style.height = ''; }
  else { const [w, h] = VP[STATE.vp]; d.style.width = w + 'px'; d.style.height = h + 'px'; }
  fit();
}
function fit() {
  if (STATE.vp === 'fit') return;
  const st = document.querySelector('.mk-stage');
  const [w, h] = VP[STATE.vp];
  const shot = document.body.classList.contains('shot');
  const s = shot ? 1 : Math.min(1, (st.clientWidth - 24) / w, (st.clientHeight - 24) / h);
  document.getElementById('fit').style.transform = `scale(${s})`;
}
function wireChrome() {
  document.querySelector('.mk-bar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.vp) STATE.vp = b.dataset.vp;
    if (b.dataset.scheme) STATE.scheme = b.dataset.scheme;
    if (b.dataset.glass) STATE.glass = b.dataset.glass;
    document.querySelectorAll('.mk-bar button').forEach((x) => {
      x.setAttribute('aria-pressed', String(x.dataset.vp === STATE.vp || x.dataset.scheme === STATE.scheme || x.dataset.glass === STATE.glass));
    });
    applyScheme(); applyVp(); setUrl();
  });
  // keep the chrome settings when moving between boards
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-keep]'); if (!a || a.getAttribute('href') === '#') return;
    e.preventDefault();
    const u = new URL(a.getAttribute('href'), location.href);
    for (const k of ['vp', 'scheme', 'glass']) u.searchParams.set(k, STATE[k]);
    location.href = u.toString();
  });
  document.getElementById('tree').addEventListener('click', (e) => {
    const fb = e.target.closest('[data-floor]');
    if (fb) {
      const id = fb.dataset.floor;
      STATE.collapsed.has(id) ? STATE.collapsed.delete(id) : STATE.collapsed.add(id);
      Mock.renderTree(); document.querySelector(`#tree [data-floor="${id}"]`)?.focus();
      return;
    }
    const ar = e.target.closest('[data-area]');
    if (ar) { if (Mock.onArea) Mock.onArea(ar.dataset.area, ar); }
  });
  document.querySelectorAll('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); Mock.toast('לא כלול בטעימה הזו'); }));
}

/* ---------------------------------------------------------------- pill sliders (Bubble slider-in-button) + big sliders */
function wireSliders(root) {
  let drag = null;
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.pill.slider, .bigslider');
    if (!el || e.target.closest('.ring, .sub, .chip, .stepper, button:not(.pill)')) return;
    drag = { el, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x0) > 6 && Math.abs(e.clientX - drag.x0) > Math.abs(e.clientY - drag.y0)) {
      drag.moved = true; drag.el.classList.add('dragging'); drag.el.setPointerCapture(e.pointerId);
    }
    if (drag.moved) setFromPointer(drag.el, e.clientX);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { el, moved } = drag; drag = null; el.classList.remove('dragging');
    if (moved) { el.dispatchEvent(new CustomEvent('slid', { bubbles: true })); return; }
    if (e.type === 'pointerup' && el.classList.contains('pill')) el.dispatchEvent(new CustomEvent('tap', { bubbles: true }));
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('keydown', (e) => {
    const el = e.target.closest('.pill.slider, .bigslider'); if (!el || e.target !== el) return;
    const step = { ArrowUp: 0.05, ArrowLeft: 0.05, ArrowDown: -0.05, ArrowRight: -0.05, PageUp: 0.2, PageDown: -0.2 }[e.key];
    if (step) { e.preventDefault(); setValue(el, clamp(getValue(el) + step)); el.dispatchEvent(new CustomEvent('slid', { bubbles: true })); }
    if ((e.key === 'Enter' || e.key === ' ') && el.classList.contains('pill')) { e.preventDefault(); el.dispatchEvent(new CustomEvent('tap', { bubbles: true })); }
  });
}
const clamp = (v) => Math.max(0, Math.min(1, Math.round(v * 100) / 100));
function setFromPointer(el, x) {
  const r = el.getBoundingClientRect();
  const rtl = getComputedStyle(el).direction === 'rtl';
  const sx = r.width / el.offsetWidth || 1; // the mockup frame may be scaled
  void sx;
  setValue(el, clamp(rtl ? (r.right - x) / r.width : (x - r.left) / r.width));
}
function getValue(el) { return parseFloat(el.style.getPropertyValue(el.classList.contains('pill') ? '--fill' : '--v')) || 0; }
function setValue(el, v) {
  el.style.setProperty(el.classList.contains('pill') ? '--fill' : '--v', v);
  el.setAttribute('aria-valuenow', Math.round(v * 100));
  el.setAttribute('aria-valuetext', `${Math.round(v * 100)}%`);
  const pct = el.querySelector('.pct, .val'); if (pct) pct.textContent = `${Math.round(v * 100)}%`;
  el.dispatchEvent(new CustomEvent('value', { bubbles: true, detail: v }));
}

/* ---------------------------------------------------------------- the pop-up sheet */
const Sheet = {
  el: null, scrim: null, opener: null, onClose: null,
  init() {
    Sheet.el = document.getElementById('sheet'); Sheet.scrim = document.getElementById('scrim');
    Sheet.scrim.addEventListener('click', () => Sheet.close());
    document.addEventListener('keydown', (e) => {
      if (!Sheet.isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); Sheet.close(); }
      if (e.key === 'Tab') trapTab(e, Sheet.el);
    });
    wireSliders(Sheet.el);
    wireGrab();
  },
  isOpen() { return Sheet.el.classList.contains('open'); },
  /** build(): the inner html (head + body), re-run on every state change; opts: {wide, opener, onClose, focus} */
  open(build, opts = {}) {
    const el = Sheet.el;
    const already = Sheet.isOpen();
    Sheet.build = build;
    if (!already) { Sheet.opener = opts.opener || document.activeElement; Sheet.openerKey = focusKey(Sheet.opener); Sheet.onClose = opts.onClose || null; }
    el.classList.toggle('wide', !!opts.wide);
    el.classList.remove('settled');
    Sheet.paint();
    el.hidden = false;
    if (!already) {
      el.style.removeProperty('--drag');
      document.getElementById('app').inert = true;
      void el.offsetWidth; // start the transition from the closed state
      el.classList.add('open'); Sheet.scrim.classList.add('open');
    }
    clearTimeout(Sheet._st); Sheet._st = setTimeout(() => el.classList.add('settled'), 700);
    const f = el.querySelector(opts.focus || '[data-close]') || el.querySelector('button, [tabindex="0"]');
    setTimeout(() => f && f.focus({ preventScroll: true }), 30);
  },
  paint() {
    const body = Sheet.el.querySelector('.sheet-body'); const top = body ? body.scrollTop : 0;
    Sheet.el.innerHTML = `<button class="grab" aria-label="גרירה לסגירה" tabindex="-1"></button>${Sheet.build()}`;
    const nb = Sheet.el.querySelector('.sheet-body'); if (nb) nb.scrollTop = top;
  },
  rebuild() { if (Sheet.build) { Sheet.el.classList.add('settled'); Sheet.paint(); } },
  /** replace the content of an open sheet (sheet to sheet, e.g. player -> group) */
  swap(fn) { Sheet.el.classList.add('swapping'); setTimeout(() => { Sheet.el.classList.remove('swapping'); fn(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140); },
  close() {
    if (!Sheet.isOpen()) return;
    const el = Sheet.el;
    el.classList.remove('open', 'dragging'); el.style.removeProperty('--drag'); Sheet.scrim.classList.remove('open');
    document.getElementById('app').inert = false;
    const done = () => { if (!Sheet.isOpen()) { el.hidden = true; el.innerHTML = ''; Sheet.build = null; } };
    matchMedia('(prefers-reduced-motion: reduce)').matches ? done() : setTimeout(done, 280);
    Sheet.onClose && Sheet.onClose();
    let o = Sheet.opener;
    if (o && !o.isConnected) { const k = Sheet.openerKey; o = k && document.getElementById('app').querySelector(k); }
    o && o.focus && o.focus({ preventScroll: true });
  },
};
function trapTab(e, root) {
  const f = [...root.querySelectorAll('button:not([tabindex="-1"]), [href], input, [tabindex="0"]')].filter((x) => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
/* phone: drag the grabber (or the head) down; close past 35% of the height or a fast flick (Bubble: 50% / 0.5 px/ms) */
function wireGrab() {
  let d = null;
  Sheet.el.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.grab, .sheet-head') || e.target.closest('.sub, .chip, .pill.slider')) return;
    if (getComputedStyle(Sheet.el).top !== 'auto') return; // centred mode: no drag
    d = { y0: e.clientY, t0: performance.now(), id: e.pointerId, dy: 0 };
    Sheet.el.setPointerCapture(e.pointerId); Sheet.el.classList.add('dragging');
  });
  Sheet.el.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    const scale = Sheet.el.getBoundingClientRect().height / Sheet.el.offsetHeight || 1;
    let dy = (e.clientY - d.y0) / scale; if (dy < 0) dy = dy / 4; // rubber band upwards
    d.dy = dy; Sheet.el.style.setProperty('--drag', dy + 'px');
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    const v = d.dy / Math.max(1, performance.now() - d.t0);
    const close = d.dy > Sheet.el.offsetHeight * 0.35 || (v > 0.5 && d.dy > 40);
    Sheet.el.classList.remove('dragging'); d = null;
    if (close) Sheet.close(); else Sheet.el.style.setProperty('--drag', '0px');
  };
  Sheet.el.addEventListener('pointerup', end); Sheet.el.addEventListener('pointercancel', end);
}

/* ---------------------------------------------------------------- shared renderers */
/* A light = a slider pill. The label is drawn twice: once in the normal text colour, once in --sw-on-lit, each clipped to its
   side of the fill edge, so text keeps 4.5:1 on the unfilled surface AND on the warm fill (Bubble keeps one colour). */
function lightPill(d) {
  const fillC = d.ct === 'cool' ? 'var(--sw-lit-cool)' : 'var(--sw-lit)';
  const st = d.on ? `דולק · ${Math.round(d.v * 100)}%` : 'כבוי';
  const tx = `<span class="nm">${esc(d.name)}</span><span class="st">${st}</span>`;
  return `<div class="pill slider lit dual ${d.on ? 'on' : 'off'}" data-dev="${d.id}" role="slider" tabindex="0"
    aria-label="${esc(d.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${d.on ? Math.round(d.v * 100) : 0}" aria-valuetext="${st}"
    style="--fill:${d.on ? d.v : 0};--fill-c:${fillC}">
    <button class="ring" data-pop="${d.id}" aria-label="פרטים: ${esc(d.name)}">${ic(d.icon)}</button>
    <span class="tx lay base">${tx}</span><span class="tx lay over" aria-hidden="true">${tx}</span>
  </div>`;
}
function switchPill(d) {
  return `<div class="pill clickable ${d.on ? 'on accent' : 'off'}" data-dev="${d.id}" role="switch" tabindex="0" aria-checked="${d.on}" aria-label="${esc(d.name)}">
    <span class="ring">${ic(d.icon)}</span><span class="tx"><span class="nm">${esc(d.name)}</span><span class="st">${d.on ? 'פועל' : 'כבוי'}</span></span></div>`;
}
const MODE_LABEL = { cool: 'קירור', heat: 'חימום', fan: 'מאוורר', auto: 'אוטומטי', off: 'כבוי' };
function climatePill(d) {
  const cls = d.mode === 'cool' ? 'cool' : d.mode === 'heat' ? 'heat' : '';
  return `<div class="pill big ${cls}" data-dev="${d.id}">
    <button class="ring" data-pop="${d.id}" aria-label="פרטים: ${esc(d.name)}">${ic(d.mode === 'heat' ? 'flame' : d.mode === 'off' ? 'power' : 'snow')}</button>
    <span class="tx"><span class="nm">${esc(d.name)}</span><span class="st">${MODE_LABEL[d.mode]} · בחדר ${d.cur}°</span></span>
    <span class="subs">${d.mode === 'off' ? `<button class="sub" data-climate-on="${d.id}" aria-label="הפעלה">${ic('power', 's')}</button>` :
      `<span class="stepper"><button data-step="${d.id}" data-d="-0.5" aria-label="הורדת טמפרטורה">${ic('minus', 's')}</button><output>${d.target.toFixed(1)}°</output><button data-step="${d.id}" data-d="0.5" aria-label="העלאת טמפרטורה">${ic('plus', 's')}</button></span>`}</span>
  </div>`;
}
function coverPill(d) {
  const st = d.pos === 0 ? 'סגור' : d.pos === 1 ? 'פתוח' : `פתוח ${Math.round(d.pos * 100)}%`;
  return `<div class="cover" data-dev="${d.id}">
    <div class="pill slider" role="slider" tabindex="0" aria-label="${esc(d.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(d.pos * 100)}" aria-valuetext="${st}"
      style="--fill:${d.pos};--fill-c:var(--sw-accent-soft)" data-cover="${d.id}">
      <button class="ring" data-pop="${d.id}" aria-label="פרטים: ${esc(d.name)}">${ic('blinds')}</button>
      <span class="tx"><span class="nm">${esc(d.name)}</span><span class="st">${st}</span></span>
    </div>
    <div class="btns"><button aria-label="פתיחה" data-cv="${d.id}" data-to="1">${ic('up')}</button><button aria-label="עצירה">${ic('stop')}</button><button aria-label="סגירה" data-cv="${d.id}" data-to="0">${ic('down')}</button></div>
  </div>`;
}
const VOL_OPEN = new Set();
function playerState(p) {
  if (p.state === 'unavailable') return 'לא זמין';
  if (p.state === 'idle') return 'לא מנגן';
  if (p.kind === 'tv') return p.state === 'off' ? 'כבויה' : `דולקת · ${p.source}`;
  return `${p.state === 'paused' ? 'מושהה · ' : ''}${p.track} · ${p.artist}`;
}
function artStyle(p) { return p.kind === 'tv' || p.state === 'idle' || p.state === 'unavailable' ? '' : `background:${ARTS[p.art]};color:transparent`; }
/* Bubble media-player card: cover-art ring, transport subs, big round play; the volume sub morphs the pill into a slider row */
function mediaPill(p, opts = {}) {
  const playing = p.state === 'playing';
  const vol = VOL_OPEN.has(p.id);
  const cls = `pill big ${playing ? 'media-on' : ''} ${p.state === 'unavailable' ? 'unavail' : ''}`;
  if (vol) {
    return `<div class="${cls} volmode" data-player="${p.id}">
      <button class="ring" data-mute="${p.id}" aria-label="${p.muted ? 'ביטול השתקה' : 'השתקה'}">${ic(p.muted ? 'volOff' : 'vol')}</button>
      <div class="bigslider inpill" role="slider" tabindex="0" aria-label="עוצמה · ${esc(p.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.vol * 100)}"
        data-pvol="${p.id}" style="--v:${p.vol};--fill-c:rgba(0,0,0,.16)"><span class="val">${Math.round(p.vol * 100)}%</span></div>
      <span class="subs"><button class="sub ghost" data-vol="${p.id}" aria-label="סגירת העוצמה">${ic('x', 's')}</button>
      <button class="sub play" data-play="${p.id}" aria-label="${playing ? 'השהיה' : 'ניגון'}">${ic(playing ? 'pause' : 'play')}</button></span>
    </div>`;
  }
  return `<div class="${cls}" data-player="${p.id}">
    <button class="ring art" data-pop-player="${p.id}" aria-label="פרטים: ${esc(p.name)}" style="${artStyle(p)}">${p.kind === 'tv' ? ic('tv') : ic('speaker')}</button>
    <span class="tx"><span class="nm">${esc(opts.title || p.name)}</span><span class="st">${esc(playerState(p))}</span></span>
    ${p.state === 'unavailable' ? '' : `<span class="subs">
      ${p.group && !opts.compact ? `<span class="chip" title="בקבוצה">${ic('link', 's')}${groupMembers(p.group).length}</span>` : ''}
      ${opts.compact ? '' : `<button class="sub ghost" data-vol="${p.id}" aria-label="עוצמה ${Math.round(p.vol * 100)}%">${ic('vol', 's')}</button>`}
      <button class="sub play" data-play="${p.id}" aria-label="${playing ? 'השהיה' : p.kind === 'tv' ? 'הפעלה וכיבוי' : 'ניגון'}">${ic(playing ? 'pause' : p.kind === 'tv' ? 'power' : 'play')}</button></span>`}
  </div>`;
}
const groupMembers = (g) => PLAYERS.filter((x) => x.group === g);
function sensorTile(d) {
  return `<div><div class="k">${esc(d.name)}</div><div class="v">${esc(d.value)}</div></div>`;
}

/* ---------------------------------------------------------------- area content (used by the area page AND the area pop-up) */
const KIND_SECTIONS = [
  { kind: ['light', 'switch'], title: 'תאורה ומתגים', icon: 'bulb' },
  { kind: ['climate'], title: 'אקלים', icon: 'thermo' },
  { kind: ['cover'], title: 'תריסים', icon: 'blinds' },
  { kind: ['media'], title: 'מדיה', icon: 'music' },
  { kind: ['sensor'], title: 'חיישנים', icon: 'motion' },
];
function renderDev(d) {
  if (d.kind === 'light') return lightPill(d);
  if (d.kind === 'switch') return switchPill(d);
  if (d.kind === 'climate') return climatePill(d);
  if (d.kind === 'cover') return coverPill(d);
  if (d.kind === 'media') return mediaPill(PLAYER[d.player]);
  return '';
}
function areaSections(aid, opts = {}) {
  const ds = DEVICES.filter((d) => d.area === aid);
  return KIND_SECTIONS.map((s) => {
    const list = ds.filter((d) => s.kind.includes(d.kind));
    if (!list.length) return '';
    const anyOn = list.some((d) => d.on);
    const acts = s.kind[0] === 'light' && anyOn ? `<span class="acts"><button class="sub" data-alloff="${aid}" aria-label="כיבוי כל התאורה ב${AREAS[aid].name}">${ic('power', 's')}</button></span>` : '';
    const body = s.kind[0] === 'sensor' ? `<div class="kv">${list.map(sensorTile).join('')}</div>` : `<div class="grid ${opts.inSheet ? 'g2' : ''} ${['climate', 'media'].includes(s.kind[0]) ? 'wide-cells' : ''}">${list.map(renderDev).join('')}</div>`;
    return `<section class="sec" aria-label="${s.title}"><div class="sep">${ic(s.icon)}<span class="t">${s.title}</span>${acts}</div>${body}</section>`;
  }).join('');
}
function areaListTable(aid) {
  const ds = DEVICES.filter((d) => d.area === aid && d.kind !== 'sensor');
  const state = (d) => d.kind === 'light' ? (d.on ? `דולק · ${Math.round(d.v * 100)}%` : 'כבוי') : d.kind === 'switch' ? (d.on ? 'פועל' : 'כבוי')
    : d.kind === 'climate' ? `${MODE_LABEL[d.mode]} · יעד ${d.target}° · בחדר ${d.cur}°` : d.kind === 'cover' ? (d.pos === 0 ? 'סגור' : d.pos === 1 ? 'פתוח' : `פתוח ${Math.round(d.pos * 100)}%`)
    : playerState(PLAYER[d.player]);
  const kindName = { light: 'תאורה', switch: 'מתג', climate: 'מזגן', cover: 'תריס', media: 'מדיה' };
  const on = (d) => d.kind === 'light' || d.kind === 'switch' ? d.on : d.kind === 'cover' ? d.pos > 0 : d.kind === 'climate' ? d.mode !== 'off' : PLAYER[d.player].state === 'playing' || PLAYER[d.player].state === 'on';
  return `<table class="tbl"><thead><tr><th>התקן</th><th>סוג</th><th>מצב</th><th class="hide-s">עודכן</th><th><span class="sr">פעולה</span></th></tr></thead><tbody>
    ${ds.map((d, i) => `<tr><td><span class="cellname"><button class="ring sm" data-pop="${d.kind === 'media' ? '' : d.id}" ${d.kind === 'media' ? `data-pop-player="${d.player}"` : ''} aria-label="פרטים: ${esc(d.name)}" style="background:${on(d) ? (d.kind === 'light' ? 'var(--sw-lit)' : 'var(--sw-accent)') : 'var(--sw-surface-2)'};color:${on(d) && d.kind === 'light' ? 'var(--sw-on-lit)' : on(d) ? '#fff' : 'var(--sw-text)'}">${ic(d.icon, 's')}</button>${esc(d.name)}</span></td>
      <td>${kindName[d.kind]}</td><td><span class="tag ${on(d) ? (d.kind === 'light' ? 'lit' : 'on') : ''}">${esc(state(d))}</span></td><td class="num hide-s">${['לפני 2 דק׳', 'לפני 14 דק׳', 'לפני שעה', '18:40', 'אתמול'][i % 5]}</td>
      <td style="text-align:end">${d.kind === 'light' || d.kind === 'switch' ? `<button class="sub" data-toggle="${d.id}" aria-label="${d.on ? 'כיבוי' : 'הדלקה'} ${esc(d.name)}">${ic('power', 's')}</button>` : `<button class="sub ghost" ${d.kind === 'media' ? `data-pop-player="${d.player}"` : `data-pop="${d.id}"`} aria-label="פתיחה: ${esc(d.name)}">${ic('chevBack', 's')}</button>`}</td></tr>`).join('')}
  </tbody></table>`;
}
function areaHeadPill(aid, inSheet) {
  const a = AREAS[aid]; const s = AREA_STATE(aid);
  const clim = DEVICES.find((d) => d.area === aid && d.kind === 'climate');
  return `<div class="pill big ${inSheet ? 'head' : ''}" style="flex:1">
    <span class="ring hue" style="background:var(--sw-hue-${a.hue})">${ic(a.icon)}</span>
    <span class="tx"><span class="nm" ${inSheet ? 'id="sheet-title"' : ''}>${esc(a.name)}</span><span class="st">${s.lit ? `${s.lit} דולקים` : 'הכול כבוי'} · ${esc(a.floorName)}</span></span>
    <span class="subs">${a.temp ? `<span class="chip hide-s">${ic('thermo', 's')}${a.temp}°</span>` : ''}
      ${clim ? '' : ''}<button class="chip" data-scenes="${aid}" aria-haspopup="true">${ic('scene', 's')}<span class="hide-s">תרחיש</span>${ic('chev', 's')}</button>
      <button class="sub" data-alloff="${aid}" aria-label="כיבוי הכול ב${esc(a.name)}">${ic('power', 's')}</button></span>
  </div>`;
}

/* ---------------------------------------------------------------- pop-up builders */
function openAreaSheet(aid, opener) {
  Sheet.open(() => `<div class="sheet-head">${areaHeadPill(aid, true)}<button class="sub" data-close aria-label="סגירה">${ic('x')}</button></div>
    <div class="sheet-body">${areaSections(aid, { inSheet: true })}</div>`, { opener, wide: true });
}
function openDeviceSheet(id, opener) {
  const d = DEV[id]; if (!d) return;
  if (d.kind === 'media') return openPlayerSheet(d.player, opener);
  Sheet.open(() => {
    const head = `<div class="sheet-head"><div style="flex:1;min-width:0" data-headof="${d.id}">${renderDev(d).replace('data-pop=', 'data-x=')}</div><button class="sub" data-close aria-label="סגירה">${ic('x')}</button></div>`;
    const title = `<h2 class="sr" id="sheet-title">${esc(d.name)}</h2>`;
    let body = '';
    if (d.kind === 'light') {
      body = `<div class="bigslider tall" role="slider" tabindex="0" aria-label="בהירות" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((d.on ? d.v : 0) * 100)}"
          data-bright="${d.id}" style="--v:${d.on ? d.v : 0};--fill-c:${d.ct === 'cool' ? 'var(--sw-lit-cool)' : 'var(--sw-lit)'}">${ic('sun')}<span>בהירות</span><span class="val">${Math.round((d.on ? d.v : 0) * 100)}%</span></div>
        <div class="sep"><span class="t">גוון</span></div>
        <div class="chips">${[['warm', 'חם'], ['neutral', 'טבעי'], ['cool', 'קר']].map(([k, l]) => `<button class="chip" data-ct="${d.id}" data-v="${k}" aria-pressed="${d.ct === k}">${l}</button>`).join('')}</div>
        <div class="sep"><span class="t">תרחישים</span></div>
        <div class="chips">${['קריאה', 'ערב', 'סרט', 'לילה'].map((l) => `<button class="chip" data-scene-chip>${ic('scene', 's')}${l}</button>`).join('')}</div>
        <div class="kv"><div><div class="k">צריכה</div><div class="v">${d.on ? Math.round(6 + d.v * 14) : 0}W</div></div><div><div class="k">דולק מאז</div><div class="v">${d.on ? '18:40' : '-'}</div></div><div><div class="k">היום</div><div class="v">3:12 ש׳</div></div></div>`;
    } else if (d.kind === 'climate') {
      body = `<div class="thermo-big" aria-live="polite"><button class="sub xl" data-step="${d.id}" data-d="-0.5" aria-label="הורדת טמפרטורה">${ic('minus', 'l')}</button>
          <div class="tval"><span class="k">יעד</span><output>${d.target.toFixed(1)}°</output><span class="k">בחדר ${d.cur}° · לחות 48%</span></div>
          <button class="sub xl" data-step="${d.id}" data-d="0.5" aria-label="העלאת טמפרטורה">${ic('plus', 'l')}</button></div>
        <div class="sep"><span class="t">מצב</span></div>
        <div class="chips">${[['cool', 'קירור', 'snow'], ['heat', 'חימום', 'flame'], ['fan', 'מאוורר', 'fan'], ['auto', 'אוטומטי', 'auto'], ['off', 'כבוי', 'power']].map(([k, l, i]) => `<button class="chip" data-mode="${d.id}" data-v="${k}" aria-pressed="${d.mode === k}">${ic(i, 's')}${l}</button>`).join('')}</div>
        <div class="sep"><span class="t">מאוורר</span></div>
        <div class="chips">${[['low', 'נמוך'], ['mid', 'בינוני'], ['high', 'גבוה'], ['auto', 'אוטומטי']].map(([k, l]) => `<button class="chip" data-fan="${d.id}" data-v="${k}" aria-pressed="${d.fan === k}">${l}</button>`).join('')}</div>`;
    } else if (d.kind === 'cover') {
      body = `<div class="bigslider tall" role="slider" tabindex="0" aria-label="מיקום" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(d.pos * 100)}"
          data-pos="${d.id}" style="--v:${d.pos};--fill-c:var(--sw-accent-soft)">${ic('blinds')}<span>פתיחה</span><span class="val">${Math.round(d.pos * 100)}%</span></div>
        <div class="chips">${[[1, 'פתוח'], [0.5, 'חצי'], [0.2, 'אוורור'], [0, 'סגור']].map(([v, l]) => `<button class="chip" data-cv="${d.id}" data-to="${v}" aria-pressed="${d.pos === v}">${l}</button>`).join('')}</div>`;
    } else if (d.kind === 'switch') {
      body = `<div class="kv"><div><div class="k">מצב</div><div class="v">${d.on ? 'פועל' : 'כבוי'}</div></div><div><div class="k">הופעל לאחרונה</div><div class="v">06:30</div></div></div>`;
    }
    return head + `<div class="sheet-body">${title}${body}</div>`;
  }, { opener });
}
function openPlayerSheet(pid, opener) {
  const p = PLAYER[pid];
  Sheet.open(() => {
    const playing = p.state === 'playing';
    const mem = p.group ? groupMembers(p.group) : [p];
    const tm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    return `<div class="art-glow" style="background:${ARTS[p.art]}" aria-hidden="true"></div>
      <div class="sheet-head"><div class="pill big" style="flex:1"><span class="ring">${ic(p.kind === 'tv' ? 'tv' : 'speaker')}</span>
        <span class="tx"><span class="nm" id="sheet-title">${esc(p.name)}</span><span class="st">${esc(AREAS[p.area].name)}${p.group ? ` · קבוצה של ${mem.length}` : ''}</span></span></div>
        <button class="sub" data-close aria-label="סגירה">${ic('x')}</button></div>
      <div class="sheet-body">
        ${p.kind === 'tv' ? `<div class="kv"><div><div class="k">מקור</div><div class="v">${esc(p.source)}</div></div><div><div class="k">מצב</div><div class="v">${p.state === 'off' ? 'כבויה' : 'דולקת'}</div></div></div>
          <div class="chips">${['HDMI 1', 'HDMI 2', 'אפליקציות'].map((s) => `<button class="chip" aria-pressed="${p.source === s}">${s}</button>`).join('')}</div>` :
        p.state === 'idle' ? `<div class="empty-np">${ic('music', 'l')}<span>לא מנגן כרגע</span><button class="btn primary" data-play="${p.id}">${ic('play', 's')}ניגון מהספרייה</button></div>` : `
        <div class="np"><div class="np-art" style="background:${ARTS[p.art]}" role="img" aria-label="עטיפה"></div>
          <div class="np-t"><div class="np-track">${esc(p.track)}</div><div class="np-artist">${esc(p.artist)}</div></div></div>
        <div class="prog" dir="ltr"><span>${tm(p.pos * p.dur)}</span><div class="bar"><i style="width:${p.pos * 100}%"></i></div><span>${tm(p.dur)}</span></div>
        <div class="transport"><button class="sub xl ghost" aria-label="הקודם">${ic('next', 'l')}</button>
          <button class="sub xxl play" data-play="${p.id}" aria-label="${playing ? 'השהיה' : 'ניגון'}">${ic(playing ? 'pause' : 'play', 'l')}</button>
          <button class="sub xl ghost" aria-label="הבא">${ic('prev', 'l')}</button></div>`}
        <div class="bigslider" role="slider" tabindex="0" aria-label="עוצמה" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.vol * 100)}" data-pvol="${p.id}" style="--v:${p.vol};--fill-c:var(--sw-accent)">
          ${ic('vol')}<span>עוצמה</span><span class="val">${Math.round(p.vol * 100)}%</span></div>
        ${p.kind === 'speaker' ? `<div class="sep">${ic('link')}<span class="t">קבוצת השמעה</span></div>
        <div class="pill clickable" data-open-group="${p.id}" role="button" tabindex="0" aria-label="ניהול קבוצת ההשמעה">
          <span class="ring">${ic('layers')}</span><span class="tx"><span class="nm">${p.group ? mem.map((m) => m.name.replace('רמקול ', '')).join(' + ') : 'רק הרמקול הזה'}</span><span class="st">${p.group ? `${mem.length} רמקולים מנגנים יחד` : 'הוספת רמקולים'}</span></span>
          <span class="sub ghost" aria-hidden="true">${ic('chevBack', 's')}</span></div>` : ''}
      </div>`;
  }, { opener });
}
function openGroupSheet(pid, opener) {
  const lead = PLAYER[pid];
  Sheet.open(() => {
    const gid = lead.group || ('g-' + lead.id);
    const mem = PLAYERS.filter((x) => x.kind === 'speaker');
    const inG = (x) => x.id === lead.id || (lead.group && x.group === lead.group);
    const count = mem.filter(inG).length;
    const master = Math.round((mem.filter(inG).reduce((n, x) => n + x.vol, 0) / count) * 100) / 100;
    return `<div class="art-glow" style="background:${ARTS[lead.art]}" aria-hidden="true"></div>
      <div class="sheet-head"><button class="sub" data-back="${lead.id}" aria-label="חזרה">${ic('chevBack')}</button>
        <div class="tx" style="flex:1"><div class="sheet-h" id="sheet-title">קבוצת השמעה</div><div class="sheet-sub">${count} רמקולים · ${esc(lead.track || 'לא מנגן')}</div></div>
        <button class="sub" data-close aria-label="סגירה">${ic('x')}</button></div>
      <div class="sheet-body">
        <div class="bigslider tall" role="slider" tabindex="0" aria-label="עוצמת הקבוצה" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(master * 100)}" data-gvol="${lead.id}" style="--v:${master};--fill-c:var(--sw-accent)">
          ${ic('vol')}<span>כל הקבוצה</span><span class="val">${Math.round(master * 100)}%</span></div>
        <div class="sep">${ic('speaker')}<span class="t">רמקולים</span></div>
        <div class="gl">${mem.map((x) => {
          const on = inG(x); const un = x.state === 'unavailable';
          return `<div class="gl-row ${on ? 'in' : ''}">
            <div class="pill ${on ? 'slider' : ''} ${un ? 'unavail' : ''}" ${on ? `role="slider" tabindex="0" aria-label="עוצמה · ${esc(x.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(x.vol * 100)}" data-mvol="${x.id}" style="--fill:${x.vol};--fill-c:var(--sw-accent-soft)"` : ''}>
              <span class="ring" style="${on ? artStyle(lead) : ''}">${ic('speaker')}</span>
              <span class="tx"><span class="nm">${esc(x.name)}${x.id === lead.id ? ' · מוביל' : ''}</span><span class="st">${un ? 'לא זמין' : on ? `בקבוצה · ${Math.round(x.vol * 100)}%` : x.state === 'playing' ? 'מנגן משהו אחר' : 'לא בקבוצה'}</span></span>
            </div>
            ${un ? '' : x.id === lead.id ? `<span class="lead-mark" aria-hidden="true">${ic('check', 's')}</span>` :
              `<button class="sub ${on ? 'on' : ''}" data-join="${x.id}" data-lead="${lead.id}" aria-pressed="${on}" aria-label="${on ? 'הוצאה מהקבוצה' : 'צירוף לקבוצה'}: ${esc(x.name)}">${ic(on ? 'check' : 'plus', 's')}</button>`}
          </div>`;
        }).join('')}</div>
        <div class="sheet-actions"><button class="btn danger" data-ungroup="${lead.id}" ${count < 2 ? 'disabled' : ''}>פירוק הקבוצה</button><button class="btn primary" data-close>סיום</button></div>
      </div>`;
  }, { opener, focus: '[data-back]' });
}

/* ---------------------------------------------------------------- one delegated controller for every device control */
function syncLight(d) {
  document.querySelectorAll(`.pill[data-dev="${d.id}"]`).forEach((el) => {
    el.style.setProperty('--fill', d.on ? d.v : 0);
    el.classList.toggle('on', d.on); el.classList.toggle('off', !d.on);
    const st = d.on ? `דולק · ${Math.round(d.v * 100)}%` : 'כבוי';
    el.querySelectorAll('.st').forEach((s) => (s.textContent = st));
    el.setAttribute('aria-valuenow', d.on ? Math.round(d.v * 100) : 0); el.setAttribute('aria-valuetext', st);
  });
  document.querySelectorAll(`[data-bright="${d.id}"]`).forEach((el) => {
    if (el.classList.contains('dragging')) return;
    el.style.setProperty('--v', d.on ? d.v : 0); el.querySelector('.val').textContent = `${Math.round((d.on ? d.v : 0) * 100)}%`;
  });
}
function syncCover(d) {
  const st = d.pos === 0 ? 'סגור' : d.pos === 1 ? 'פתוח' : `פתוח ${Math.round(d.pos * 100)}%`;
  document.querySelectorAll(`[data-cover="${d.id}"]`).forEach((el) => { if (!el.classList.contains('dragging')) el.style.setProperty('--fill', d.pos); el.querySelector('.st').textContent = st; el.setAttribute('aria-valuetext', st); });
  document.querySelectorAll(`[data-pos="${d.id}"]`).forEach((el) => { if (!el.classList.contains('dragging')) { el.style.setProperty('--v', d.pos); el.querySelector('.val').textContent = `${Math.round(d.pos * 100)}%`; } });
}
function focusKey(el) {
  if (!el || el === document.body) return null;
  const parts = [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'aria-label').map((a) => `[${a.name}="${CSS.escape(a.value)}"]`);
  return parts.length ? el.tagName.toLowerCase() + parts.join('') : null;
}
Mock.refresh = function () {
  const k = focusKey(document.activeElement);
  const inSheet = Sheet.el.contains(document.activeElement);
  Mock.renderTree(); Mock.render();
  if (Sheet.isOpen()) Sheet.rebuild();
  if (k) { const root = inSheet ? Sheet.el : document.getElementById('app'); const n = root.querySelector(k); n && n.focus({ preventScroll: true }); }
};
function wireDevices() {
  const dev = document.getElementById('device');
  dev.addEventListener('tap', (e) => {
    const el = e.target.closest('.pill[data-dev]'); if (!el) return;
    const d = DEV[el.dataset.dev];
    if (d.kind === 'light') { d.on = !d.on; if (d.on && d.v < 0.05) d.v = 0.6; syncLight(d); Mock.renderTree(); Mock.afterChange && Mock.afterChange(); }
  });
  dev.addEventListener('value', (e) => {
    const el = e.target; const v = e.detail;
    if (el.matches('.pill[data-dev]')) { const d = DEV[el.dataset.dev]; if (d.kind === 'light') { d.v = v; d.on = v > 0; syncLight(d); } }
    if (el.dataset.bright) { const d = DEV[el.dataset.bright]; d.v = v; d.on = v > 0; syncLight(d); }
    if (el.dataset.cover) { DEV[el.dataset.cover].pos = v; syncCover(DEV[el.dataset.cover]); }
    if (el.dataset.pos) { DEV[el.dataset.pos].pos = v; syncCover(DEV[el.dataset.pos]); }
    if (el.dataset.pvol) { PLAYER[el.dataset.pvol].vol = v; document.querySelectorAll(`[data-pvol="${el.dataset.pvol}"]`).forEach((x) => { if (x !== el) { x.style.setProperty('--v', v); x.querySelector('.val').textContent = `${Math.round(v * 100)}%`; } }); }
    if (el.dataset.mvol) { PLAYER[el.dataset.mvol].vol = v; el.querySelector('.st').textContent = `בקבוצה · ${Math.round(v * 100)}%`; }
    if (el.dataset.gvol) {
      const lead = PLAYER[el.dataset.gvol]; const mem = lead.group ? groupMembers(lead.group) : [lead];
      mem.forEach((m) => { m.vol = v; const r = Sheet.el.querySelector(`[data-mvol="${m.id}"]`); if (r) { r.style.setProperty('--fill', v); r.querySelector('.st').textContent = `בקבוצה · ${Math.round(v * 100)}%`; } });
    }
  });
  dev.addEventListener('slid', () => { Mock.renderTree(); Mock.afterChange && Mock.afterChange(); });
  dev.addEventListener('click', (e) => {
    const t = e.target.closest('button, [role="button"], .pill.clickable'); if (!t) return;
    const ds = t.dataset;
    if (ds.close !== undefined) return Sheet.close();
    if (ds.pop) return openDeviceSheet(ds.pop, t);
    if (ds.popPlayer) return openPlayerSheet(ds.popPlayer, t);
    if (ds.openGroup) return Sheet.swap(() => openGroupSheet(ds.openGroup, Sheet.opener));
    if (ds.back) return Sheet.swap(() => openPlayerSheet(ds.back, Sheet.opener));
    if (ds.popArea) return openAreaSheet(ds.popArea, t);
    if (ds.toggle) { const d = DEV[ds.toggle]; d.on = !d.on; return Mock.refresh(); }
    if (t.matches('.pill.clickable[data-dev]')) { const d = DEV[t.dataset.dev]; d.on = !d.on; return Mock.refresh(); }
    if (ds.step) { const d = DEV[ds.step]; d.target = Math.max(16, Math.min(30, d.target + parseFloat(ds.d))); document.querySelectorAll(`[data-dev="${d.id}"] output, .thermo-big output`).forEach((o) => (o.textContent = d.target.toFixed(1) + '°')); return; }
    if (ds.climateOn) { DEV[ds.climateOn].mode = 'cool'; return Mock.refresh(); }
    if (ds.mode) { DEV[ds.mode].mode = ds.v; return Mock.refresh(); }
    if (ds.fan) { DEV[ds.fan].fan = ds.v; return Mock.refresh(); }
    if (ds.ct) { DEV[ds.ct].ct = ds.v === 'neutral' ? 'warm' : ds.v; DEV[ds.ct]._ct = ds.v; return Mock.refresh(); }
    if (ds.cv) { const d = DEV[ds.cv]; d.pos = parseFloat(ds.to); syncCover(d); Sheet.isOpen() && Sheet.el.querySelectorAll(`[data-cv="${d.id}"]`).forEach((c) => c.setAttribute('aria-pressed', String(parseFloat(c.dataset.to) === d.pos))); return; }
    if (ds.alloff) {
      DEVICES.filter((d) => d.area === ds.alloff && (d.kind === 'light' || d.kind === 'switch')).forEach((d) => (d.on = false));
      Mock.refresh(); return Mock.toast(`כל התאורה ב${AREAS[ds.alloff].name} כובתה`);
    }
    if (ds.scenes) return Mock.toast('תרחישים: ערב · סרט · ניקיון · לילה');
    if (ds.sceneChip !== undefined) return Mock.toast(`התרחיש "${t.textContent.trim()}" הופעל`);
    if (ds.play) {
      const p = PLAYER[ds.play];
      if (p.kind === 'tv') p.state = p.state === 'off' ? 'on' : 'off';
      else if (p.state === 'idle') { p.state = 'playing'; p.track = 'רוח מערבית'; p.artist = 'הרכב הגליל'; p.dur = 214; p.pos = 0.05; p.art = 1; }
      else p.state = p.state === 'playing' ? 'paused' : 'playing';
      if (p.group && p.kind === 'speaker') groupMembers(p.group).forEach((m) => (m.state = p.state));
      return Mock.refresh();
    }
    if (ds.vol) { VOL_OPEN.has(ds.vol) ? VOL_OPEN.delete(ds.vol) : VOL_OPEN.add(ds.vol); Mock.refresh(); const n = document.querySelector(VOL_OPEN.has(ds.vol) ? `.bigslider[data-pvol="${ds.vol}"]` : `[data-vol="${ds.vol}"]`); n && n.focus(); return; }
    if (ds.mute) { const p = PLAYER[ds.mute]; p.muted = !p.muted; return Mock.refresh(); }
    if (ds.join) {
      const x = PLAYER[ds.join], lead = PLAYER[ds.lead];
      if (!lead.group) { lead.group = 'g-' + lead.id; }
      if (x.group === lead.group) { x.group = null; if (x.state === 'playing' && lead.state === 'playing') x.state = 'idle'; }
      else { x.group = lead.group; x.state = lead.state; x.track = lead.track; x.artist = lead.artist; x.art = lead.art; x.dur = lead.dur; x.pos = lead.pos; }
      if (groupMembers(lead.group).length < 2) lead.group = null;
      return Mock.refresh();
    }
    if (ds.ungroup) { const lead = PLAYER[ds.ungroup]; const g = lead.group; PLAYERS.forEach((m) => { if (m.group === g && m !== lead) { m.group = null; m.state = 'idle'; m.track = ''; } }); lead.group = null; Mock.refresh(); return Mock.toast('הקבוצה פורקה'); }
  });
  dev.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"], [role="switch"]')) { e.preventDefault(); e.target.click(); }
  });
}