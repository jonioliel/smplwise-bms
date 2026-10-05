/* CR-028 cast-to-screens mockups - shared foundation: icons, fixture (invented names, no lab data), the shell (rail / phone dock),
   the pop-up controllers (centred sheet, anchored popover, bottom sheet), the "currently casting" tray, the mockup chrome
   (page / viewport / scheme / skin / state / annotations) and the numbered annotation markers. Static, no network. */
'use strict';

/* ---------------------------------------------------------------- icons (24x24 stroke) */
const ICONS = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  map: '<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  media: '<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8.5 21h7M12 17v4"/><path d="m10.2 8.3 4.3 2.2-4.3 2.2z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cast: '<path d="M2 16.5a4 4 0 0 1 3.5 3.5M2 12.5a8 8 0 0 1 7.5 7.5M2 8.5A12 12 0 0 1 13.5 20"/><path d="M2 6V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4"/>',
  castOn: '<path d="M2 16.5a4 4 0 0 1 3.5 3.5M2 12.5a8 8 0 0 1 7.5 7.5M2 8.5A12 12 0 0 1 13.5 20"/><path d="M2 6V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4"/><path d="M7 7h12v9h-5" fill="currentColor" stroke="none" opacity=".45"/>',
  tv: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  hub: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M7 21h10"/><path d="M12 17v4"/><circle cx="12" cy="11" r="2"/>',
  speaker: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="14" r="3"/><path d="M12 7h.01"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  aperture: '<circle cx="12" cy="12" r="9"/><path d="m14.3 15 5.4-9.3M9.7 15 4.3 5.7M12 21v-6M12 3v6M3.4 15.5l9-5.2M20.6 8.5l-9 5.2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m12.5 7.5 4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="m9 6 6 6-6 6"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  swap: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  off: '<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
  cols: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  sort: '<path d="M4 7h12M4 12h8M4 17h4"/><path d="m17 10 3 3 3-3M20 13V4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
};
function ic(name, cls = '') { return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- fixture (invented; mirrors the CR-028 section 4 rules) */
/* method: cast_hls | dlna | airplay | browser_url | none ; conf: confirmed | likely | unknown ; allow = admin "מותר לשדר" ; manual = owner override */
const SCREENS = [
  { key: 'tv-living', name: 'טלוויזיה סלון', floor: 'קומת קרקע', room: 'סלון', icon: 'tv', method: 'cast_hls', conf: 'confirmed', reason: 'cast_video', model: 'Google TV', hevc: true, allow: true, avail: true, busy: null, recent: 1, pub: false, integ: 'cast', via: 'media_player.living_tv', ent: 'media_player.living_tv', dev: 'dev_living_tv' },
  { key: 'tv-kitchen', name: 'טלוויזיה מטבח', floor: 'קומת קרקע', room: 'מטבח', icon: 'tv', method: 'cast_hls', conf: 'confirmed', reason: 'cast_video', model: 'Chromecast', hevc: false, allow: true, avail: true, busy: 'music', recent: 2, pub: false, integ: 'cast', via: 'media_player.kitchen_tv', ent: 'media_player.kitchen_tv', dev: 'dev_kitchen_tv' },
  { key: 'hub-kitchen', name: 'מסך מטבח (Nest Hub)', floor: 'קומת קרקע', room: 'מטבח', icon: 'hub', method: 'cast_hls', conf: 'confirmed', reason: 'cast_video', model: 'Nest Hub', hevc: false, allow: true, avail: true, busy: null, recent: 0, pub: false, integ: 'cast', via: 'media_player.kitchen_hub', ent: 'media_player.kitchen_hub', dev: 'dev_kitchen_hub' },
  { key: 'tv-parents', name: 'טלוויזיה הורים', floor: 'קומה א׳', room: 'חדר הורים', icon: 'tv', method: 'cast_hls', conf: 'likely', reason: 'android_tv_builtin', model: 'BRAVIA', hevc: true, allow: true, avail: true, busy: null, recent: 0, pub: false, integ: 'androidtv_remote', via: 'remote.parents_tv', ent: 'remote.parents_tv', dev: 'dev_parents_tv' },
  { key: 'tv-office', name: 'מסך חדר עבודה', floor: 'קומה א׳', room: 'חדר עבודה', icon: 'tv', method: 'cast_hls', conf: 'confirmed', reason: 'cast_screen', model: 'LG', hevc: false, allow: true, avail: false, busy: null, recent: 0, pub: false, integ: 'cast', via: 'media_player.office_tv', ent: 'media_player.office_tv', dev: 'dev_office_tv' },
  { key: 'tv-pergola', name: 'מסך פרגולה', floor: 'חוץ', room: 'פרגולה', icon: 'tv', method: 'cast_hls', conf: 'confirmed', reason: 'cast_video', model: 'Chromecast', hevc: false, allow: false, avail: true, busy: null, recent: 0, pub: false, integ: 'cast', via: 'media_player.pergola_tv', ent: 'media_player.pergola_tv', dev: 'dev_pergola_tv' },
  { key: 'tv-kids', name: 'מסך ילדים', floor: 'קומה א׳', room: 'חדר ילדים', icon: 'tv', method: 'dlna', conf: 'unknown', reason: 'dlna_unavailable', model: 'Samsung', hevc: false, allow: false, avail: true, busy: null, recent: 0, pub: false, integ: 'dlna_dmr', via: 'media_player.kids_dlna', ent: 'media_player.kids_dlna', dev: 'dev_kids_tv' },
  { key: 'tv-lobby', name: 'מסך לובי', floor: 'קומת קרקע', room: 'לובי', icon: 'tv', method: 'cast_hls', conf: 'confirmed', reason: 'cast_video', model: 'Chromecast', hevc: false, allow: true, avail: true, busy: null, recent: 0, pub: true, integ: 'cast', via: 'media_player.lobby_tv', ent: 'media_player.lobby_tv', dev: 'dev_lobby_tv' },
  { key: 'tv-guest', name: 'טלוויזיה אורחים', floor: 'קומה א׳', room: 'חדר אורחים', icon: 'tv', method: 'browser_url', conf: 'unknown', reason: 'samsung_browser', model: 'Samsung', hevc: false, allow: false, avail: true, busy: null, recent: 0, pub: false, integ: 'samsungtv_smart', via: 'media_player.guest_tv', ent: 'media_player.guest_tv', dev: 'dev_guest_tv' },
  { key: 'atv-den', name: 'Apple TV חדר משפחה', floor: 'קומת קרקע', room: 'חדר משפחה', icon: 'tv', method: 'airplay', conf: 'likely', reason: 'apple_tv', model: 'Apple TV 4K', hevc: true, allow: false, avail: true, busy: null, recent: 0, pub: false, integ: 'apple_tv', via: 'media_player.den_atv', ent: 'media_player.den_atv', dev: 'dev_den_atv' },
  { key: 'spk-living', name: 'רמקול סלון', floor: 'קומת קרקע', room: 'סלון', icon: 'speaker', method: 'none', conf: 'confirmed', reason: 'no_screen', model: 'Nest Audio', hevc: false, allow: false, avail: true, busy: null, recent: 0, pub: false, integ: 'cast', via: '', ent: 'media_player.living_spk', dev: 'dev_living_spk', speaker: true },
  { key: 'spk-yard', name: 'רמקול חצר', floor: 'חוץ', room: 'חצר', icon: 'speaker', method: 'none', conf: 'confirmed', reason: 'cast_audio_only', model: 'WiiM', hevc: false, allow: false, avail: true, busy: null, recent: 0, pub: false, integ: 'cast', via: '', ent: 'media_player.yard_spk', dev: 'dev_yard_spk', speaker: true },
];
const SCREEN = Object.fromEntries(SCREENS.map((s) => [s.key, s]));
const CAMS = [
  { id: 'c-lobby', name: 'לובי כניסה', c1: '#2b3a55', c2: '#121a2b', main: 'H.264' },
  { id: 'c-parking', name: 'חניה', c1: '#3b3a2f', c2: '#15140f', main: 'H.265' },
  { id: 'c-yard', name: 'חצר אחורית', c1: '#24412f', c2: '#0e1a12', main: 'H.264' },
  { id: 'c-gate', name: 'שער ראשי', c1: '#3d2b3f', c2: '#160f18', main: 'H.264' },
  { id: 'c-stairs', name: 'חדר מדרגות', c1: '#2b2f3a', c2: '#0f1117', main: 'H.264' },
  { id: 'c-roof', name: 'גג', c1: '#2f3b4e', c2: '#10151e', main: 'H.265' },
  { id: 'c-pool', name: 'בריכה', c1: '#1f3b4d', c2: '#0c171e', main: 'H.264' },
  { id: 'c-door', name: 'דלת שירות', c1: '#3f3528', c2: '#17130d', main: 'H.264' },
  { id: 'c-hall', name: 'מסדרון א׳', c1: '#2d2d3d', c2: '#101016', main: 'H.264' },
];
const CAM = Object.fromEntries(CAMS.map((c) => [c.id, c]));

/* the chip + sentence of media-cast-label.ts (copied, not imported: static mockup) */
const CAST_METHOD_LABEL = { cast_hls: 'Google Cast', dlna: 'DLNA', airplay: 'AirPlay', browser_url: 'דפדפן המסך', none: 'ללא' };
const CAST_CONF_LABEL = { confirmed: 'מאומת', likely: 'כנראה', unknown: 'לא ידוע' };
const CAST_REASON = {
  cast_video: 'מקלט Cast לווידאו (Chromecast / Google TV / Nest Hub או מסך עם Cast מובנה)',
  cast_screen: 'מקלט Cast על מסך; הדגם לא מזוהה כמקלט של Google',
  cast_unknown_model: 'מקלט Cast בדגם לא מזוהה; לא כל מקלט Cast מציג תמונה',
  cast_audio_only: 'מקלט Cast לשמע בלבד (רמקול או קבוצת רמקולים)',
  android_tv_builtin: 'Android TV: מקלט Cast מובנה; האינטגרציה Google Cast לא מחוברת למסך הזה',
  apple_tv: 'Apple TV: AirPlay דרך האינטגרציה apple_tv; לא נבדק בפועל',
  dlna_renderer: 'מקלט DLNA שמדווח על ניגון מדיה; ייבדק בפועל לפני הפעלה',
  dlna_unavailable: 'מקלט DLNA שאינו זמין כרגע; היכולת תתברר כשיתחבר',
  samsung_browser: 'Samsung: פתיחת דף בדפדפן המסך אפשרית בתיאוריה; לא נבדק',
  no_screen: 'רמקול ללא מסך',
  no_path: 'לא נמצאה דרך ידועה לשדר למסך הזה',
};
function castChip(s) {
  if (s.manual) return { kind: 'manual', label: `${CAST_METHOD_LABEL[s.manual]} · ידני`, title: 'נקבע ידנית על ידי מנהל' };
  if (s.method === 'none') return s.conf === 'confirmed' ? { kind: 'neutral', label: 'לא נתמך', title: CAST_REASON[s.reason] } : { kind: 'unknown', label: 'לא ידוע', title: CAST_REASON[s.reason] };
  const l = CAST_METHOD_LABEL[s.method];
  if (s.conf === 'confirmed') return { kind: 'live', label: l, title: `מאומת · ${CAST_REASON[s.reason]}` };
  if (s.conf === 'likely') return { kind: 'neutral', label: `${l} · כנראה`, title: `כנראה · ${CAST_REASON[s.reason]}` };
  return { kind: 'unknown', label: `${l} · לא ידוע`, title: `לא ידוע · ${CAST_REASON[s.reason]}` };
}
function castSentence(s) {
  if (s.method === 'none') return `${s.conf === 'confirmed' ? 'לא נתמך' : 'לא ידוע'} · ${CAST_REASON[s.reason]}`;
  return `${CAST_METHOD_LABEL[s.method]} · ${CAST_CONF_LABEL[s.conf]} · דרך ${s.via} · ${CAST_REASON[s.reason]}`;
}
function badge(c) { return `<span class="badge ${c.kind}" title="${esc(c.title)}">${esc(c.label)}</span>`; }

/* the picker's capability badge (operator screen: NO technology names - "מאומת / כנראה / לא ידוע" only) */
function capBadge(s) {
  if (s.manual) return '<span class="cap m">נקבע ידנית</span>';
  if (s.conf === 'confirmed') return `<span class="cap v">${ic('check', 's')}מאומת</span>`;
  if (s.conf === 'likely') return '<span class="cap p">כנראה</span>';
  return '<span class="cap u">לא ידוע</span>';
}

/* why a screen is disabled in the picker (the operator reads a reason, never a code) */
function disabledWhy(s, ctx = {}) {
  if (s.speaker || s.method === 'none') return 'ללא מסך';
  if (!s.allow) return 'לא אושר לשידור על ידי מנהל';
  if (!s.avail) return 'כבוי';
  if (s.conf === 'unknown') return 'הדרך לשדר למסך הזה עוד לא אומתה';
  if (ctx.profile === 'main' && ctx.codec === 'H.265' && !s.hevc) return 'הזרם הראשי אינו נתמך במסך הזה';
  if (s.pub && !ctx.canPublic) return 'מסך ציבורי: אין לך הרשאה';
  if (ctx.remote && s.conf === 'likely') return null;
  return null;
}
function stateText(s, sessions = {}) {
  if (sessions[s.key]) return { t: `משדר: ${sessions[s.key]}`, cls: 'busy' };
  if (s.busy === 'music') return { t: 'מנגן מוזיקה', cls: 'busy' };
  if (!s.avail) return { t: 'כבוי', cls: 'why' };
  return { t: 'פנוי', cls: '' };
}

/* ---------------------------------------------------------------- params, chrome */
const Q = new URLSearchParams(location.search);
const STATE = {
  vp: Q.get('vp') || (innerWidth < 760 ? 'fit' : '1440'),
  scheme: Q.get('scheme') || 'light',
  skin: Q.get('skin') || 'classic',
  ann: Q.get('ann') ?? '1',
  state: Q.get('state') || '',
};
const VP = { 1440: [1440, 900], 1024: [1024, 1366], 390: [390, 844] };
const PAGES = [
  { id: 'index', label: 'אינדקס', href: 'index.html' },
  { id: 'live', label: '1 · מצלמה בודדת', href: '01-live-camera.html' },
  { id: 'wall', label: '2 · קיר', href: '02-wall.html' },
  { id: 'tray', label: '3 · שידורים פעילים', href: '03-active-tray.html' },
  { id: 'errors', label: '4 · שגיאות ומקרי קצה', href: '04-errors.html' },
  { id: 'perm', label: '5 · הרשאות', href: '05-permissions.html' },
  { id: 'settings', label: '6 · הגדרות', href: '06-settings.html' },
  { id: 'lab', label: '7 · בדיקה במעבדה', href: '07-lab-test.html' },
];
const NAV = [
  { id: 'home', label: 'ראשי', icon: 'home' }, { id: 'security', label: 'אבטחה', icon: 'shield' }, { id: 'map', label: 'מפה', icon: 'map' },
  { id: 'media', label: 'מולטימדיה', icon: 'media' }, { id: 'wiskey', label: 'WisKey', icon: 'key' },
];
function setUrl() {
  const u = new URL(location.href);
  for (const k of ['vp', 'scheme', 'skin', 'ann', 'state']) u.searchParams.set(k, STATE[k]);
  history.replaceState(null, '', u);
}
function applyRoot() {
  const r = document.documentElement;
  r.dataset.theme = STATE.scheme; r.dataset.skin = STATE.skin; r.dataset.ann = STATE.ann;
}

const Mock = {
  page: null, states: [], render: null, nav: 'security',
  /** opts: { page, nav, states: [{id,label}], render(state) -> html of .main-inner, after(state) } */
  boot(opts) {
    Object.assign(Mock, { page: opts.page, states: opts.states || [], render: opts.render, after: opts.after || null, nav: opts.nav || 'security', note: opts.note || '' });
    if (!STATE.state && Mock.states.length) STATE.state = Mock.states[0].id;
    applyRoot();
    document.body.classList.add('mk');
    if (Q.get('shot') === '1') document.body.classList.add('shot');
    document.body.innerHTML = `
      <div class="mk-bar" role="toolbar" aria-label="בקרת המוקאפ">
        <span class="ttl">שדר למסך · מוקאפים</span>
        <span class="grp">${PAGES.map((p) => `<a href="${p.href}" ${p.id === Mock.page ? 'aria-current="page"' : ''} data-keep>${p.label}</a>`).join('')}</span>
        <span class="grp"><span>מסך</span>${['1440', '1024', '390', 'fit'].map((v) => `<button data-vp="${v}" aria-pressed="${STATE.vp === v}">${v === 'fit' ? 'מלא' : v}</button>`).join('')}</span>
        <span class="grp"><span>ערכה</span><button data-scheme="light" aria-pressed="${STATE.scheme === 'light'}">בהיר</button><button data-scheme="dark" aria-pressed="${STATE.scheme === 'dark'}">כהה</button></span>
        <span class="grp"><span>סקין</span><button data-skin="classic" aria-pressed="${STATE.skin === 'classic'}">classic</button><button data-skin="bubble" aria-pressed="${STATE.skin === 'bubble'}">bubble</button></span>
        <span class="grp"><span>הערות</span><button data-ann="1" aria-pressed="${STATE.ann === '1'}">מוצגות</button><button data-ann="0" aria-pressed="${STATE.ann === '0'}">מוסתרות</button></span>
        ${Mock.states.length ? `<span class="grp"><span>מצב</span><select id="mk-state" aria-label="מצב">${Mock.states.map((s) => `<option value="${s.id}" ${s.id === STATE.state ? 'selected' : ''}>${s.label}</option>`).join('')}</select></span>` : ''}
      </div>
      <div class="mk-stage"><div class="mk-fit" id="fit"><div class="device" id="device">
        <div class="app" id="app">
          <nav class="rail" aria-label="ניווט ראשי">
            <div class="logo" aria-hidden="true">S</div>
            ${NAV.map((n) => `<a href="#" ${n.id === Mock.nav ? 'aria-current="page"' : ''}>${ic(n.icon)}<span>${n.label}</span></a>`).join('')}
            <div class="spacer"></div>
            <a href="#" ${Mock.nav === 'settings' ? 'aria-current="page"' : ''}>${ic('gear')}<span>הגדרות</span></a>
            <div class="me" title="יוני">יו</div>
          </nav>
          <main class="main" id="main"><div class="main-inner" id="content"></div></main>
          <div class="dock"><nav class="stack" aria-label="ניווט ראשי">${NAV.map((n) => `<a href="#" ${n.id === Mock.nav ? 'aria-current="page"' : ''}>${ic(n.icon)}<span>${n.label}</span></a>`).join('')}<a href="#" ${Mock.nav === 'settings' ? 'aria-current="page"' : ''}>${ic('gear')}<span>הגדרות</span></a></nav></div>
        </div>
        <div class="scrim" id="scrim"></div>
        <section class="sheet" id="sheet" role="dialog" aria-modal="true" hidden></section>
        <div class="pop" id="pop" role="dialog" hidden></div>
        <div class="tray" id="tray" role="dialog" aria-label="שידורים פעילים" hidden></div>
        <div class="toast" id="toast" role="status" aria-live="polite"></div>
      </div></div></div>
      ${Mock.note ? `<div class="mk-note" id="mk-note"></div>` : ''}`;
    wireChrome();
    applyVp();
    Sheet.init(); Pop.init(); Tray.init();
    Mock.paint();
    addEventListener('resize', () => { fit(); Ann.place(); });
    document.getElementById('device').addEventListener('click', (e) => { const a = e.target.closest('a[href="#"]'); if (a) { e.preventDefault(); Mock.toast('לא כלול במוקאפ הזה'); } });
  },
  paint() {
    Sheet.close(true); Pop.close(true); Tray.close(true);
    document.getElementById('content').innerHTML = Mock.render(STATE.state);
    const n = document.getElementById('mk-note'); if (n) n.innerHTML = typeof Mock.note === 'function' ? Mock.note(STATE.state) : Mock.note;
    Mock.after && Mock.after(STATE.state);
    requestAnimationFrame(() => Ann.place());
  },
  setState(id) { STATE.state = id; const s = document.getElementById('mk-state'); if (s) s.value = id; setUrl(); Mock.paint(); },
  toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(Mock._tt); Mock._tt = setTimeout(() => t.classList.remove('show'), 2200); },
};
function applyVp() {
  const f = document.getElementById('fit');
  document.body.dataset.vp = STATE.vp; f.dataset.vp = STATE.vp;
  const d = document.getElementById('device');
  if (STATE.vp === 'fit') { d.style.width = ''; d.style.height = ''; } else { const [w, h] = VP[STATE.vp]; d.style.width = w + 'px'; d.style.height = h + 'px'; }
  fit();
}
function fit() {
  if (STATE.vp === 'fit') return;
  const st = document.querySelector('.mk-stage'); const [w, h] = VP[STATE.vp];
  const s = document.body.classList.contains('shot') ? 1 : Math.min(1, (st.clientWidth - 24) / w, (st.clientHeight - 24) / h);
  document.getElementById('fit').style.transform = `scale(${s})`;
}
function wireChrome() {
  document.querySelector('.mk-bar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    for (const k of ['vp', 'scheme', 'skin', 'ann']) if (b.dataset[k] !== undefined) STATE[k] = b.dataset[k];
    document.querySelectorAll('.mk-bar button').forEach((x) => x.setAttribute('aria-pressed', String(['vp', 'scheme', 'skin', 'ann'].some((k) => x.dataset[k] !== undefined && x.dataset[k] === STATE[k]))));
    applyRoot(); applyVp(); setUrl(); requestAnimationFrame(() => Ann.place());
  });
  const sel = document.getElementById('mk-state'); if (sel) sel.addEventListener('change', () => Mock.setState(sel.value));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-keep]'); if (!a) return;
    e.preventDefault();
    const u = new URL(a.getAttribute('href'), location.href);
    for (const k of ['vp', 'scheme', 'skin', 'ann']) u.searchParams.set(k, STATE[k]);
    location.href = u.toString();
  });
}

/* ---------------------------------------------------------------- annotation markers */
const Ann = {
  place() {
    document.querySelectorAll('.ann-dot').forEach((d) => d.remove());
    if (STATE.ann === '0') return;
    const dev = document.getElementById('device'); const dr = dev.getBoundingClientRect();
    const sc = dr.width / dev.offsetWidth || 1;
    document.querySelectorAll('[data-ann]').forEach((el) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
      const r = el.getBoundingClientRect(); if (!r.width) return;
      const d = document.createElement('div'); d.className = 'ann-dot'; d.textContent = el.dataset.ann;
      const side = el.dataset.annSide || 'start';
      const x = side === 'end' ? (r.left - dr.left) / sc - 8 : (r.right - dr.left) / sc - 14;
      d.style.left = x + 'px'; d.style.top = (r.top - dr.top) / sc - 9 + 'px';
      dev.appendChild(d);
    });
  },
};

/* ---------------------------------------------------------------- pop-ups */
function trapTab(e, root) {
  const f = [...root.querySelectorAll('button:not([tabindex="-1"]), [href], input, select, [tabindex="0"]')].filter((x) => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
const Sheet = {
  el: null, build: null,
  init() {
    Sheet.el = document.getElementById('sheet');
    document.getElementById('scrim').addEventListener('click', () => { Sheet.close(); Pop.close(); });
    document.addEventListener('keydown', (e) => {
      if (Sheet.isOpen()) { if (e.key === 'Escape') Sheet.close(); if (e.key === 'Tab') trapTab(e, Sheet.el); }
      else if (Pop.isOpen() && e.key === 'Escape') Pop.close();
      else if (Tray.isOpen() && e.key === 'Escape') Tray.close();
    });
  },
  isOpen() { return Sheet.el.classList.contains('open'); },
  open(build, opts = {}) {
    Sheet.build = build; Sheet.opener = document.activeElement;
    Sheet.el.classList.toggle('wide', !!opts.wide);
    Sheet.paint(); Sheet.el.hidden = false;
    document.getElementById('app').inert = true;
    void Sheet.el.offsetWidth;
    Sheet.el.classList.add('open'); document.getElementById('scrim').classList.add('open');
    const f = Sheet.el.querySelector('[data-close]') || Sheet.el.querySelector('button'); setTimeout(() => f && f.focus({ preventScroll: true }), 30);
    requestAnimationFrame(() => Ann.place());
  },
  paint() { Sheet.el.innerHTML = `<button class="grab" aria-label="גרירה לסגירה" tabindex="-1"></button>${Sheet.build()}`; Sheet.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => Sheet.close())); },
  rebuild() { if (Sheet.build) { Sheet.paint(); requestAnimationFrame(() => Ann.place()); } },
  close(silent) {
    if (!Sheet.el || !Sheet.isOpen()) return;
    Sheet.el.classList.remove('open'); if (!Pop.isOpen()) document.getElementById('scrim').classList.remove('open');
    document.getElementById('app').inert = false;
    const done = () => { if (!Sheet.isOpen()) { Sheet.el.hidden = true; Sheet.el.innerHTML = ''; Sheet.build = null; } };
    silent ? done() : setTimeout(done, 280);
    Sheet.opener && Sheet.opener.focus && Sheet.opener.focus({ preventScroll: true });
    requestAnimationFrame(() => Ann.place());
  },
};
/* anchored popover (desktop/tablet: the dropdown panel of the installation's sw-dropdown style; phone: it becomes a bottom sheet via CSS) */
const Pop = {
  el: null,
  init() { Pop.el = document.getElementById('pop'); },
  isOpen() { return Pop.el.classList.contains('open'); },
  open(anchor, html, opts = {}) {
    Pop.el.innerHTML = html; Pop.el.hidden = false;
    Pop.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => Pop.close()));
    const dev = document.getElementById('device'); const dr = dev.getBoundingClientRect(); const sc = dr.width / dev.offsetWidth || 1;
    const r = anchor.getBoundingClientRect();
    const w = opts.width || 360; Pop.el.style.width = w + 'px';
    let left = (r.left - dr.left) / sc + r.width / sc - w; if (left < 8) left = 8;
    const devH = dev.offsetHeight; const want = Math.min(opts.height || 520, devH * 0.7);
    let top = (r.bottom - dr.top) / sc + 6; let origin = 'top right';
    if (top + want > devH - 8) { // no room below the anchor: open upwards (the dropdown's flip rule)
      top = Math.max(8, (r.top - dr.top) / sc - 6 - want); origin = 'bottom right'; Pop.el.style.maxHeight = want + 'px';
    } else Pop.el.style.maxHeight = Math.min(want, devH - top - 8) + 'px';
    Pop.el.style.left = left + 'px'; Pop.el.style.top = top + 'px'; Pop.el.style.right = 'auto'; Pop.el.style.bottom = 'auto';
    Pop.el.style.transformOrigin = origin;
    if (opts.scrim !== false) document.getElementById('scrim').classList.add('open');
    void Pop.el.offsetWidth; Pop.el.classList.add('open');
    requestAnimationFrame(() => Ann.place());
  },
  close(silent) {
    if (!Pop.el || !Pop.isOpen()) return;
    Pop.el.classList.remove('open'); if (!Sheet.isOpen()) document.getElementById('scrim').classList.remove('open');
    const done = () => { if (!Pop.isOpen()) { Pop.el.hidden = true; Pop.el.innerHTML = ''; } };
    silent ? done() : setTimeout(done, 220);
    requestAnimationFrame(() => Ann.place());
  },
};
const Tray = {
  el: null, build: null,
  init() { Tray.el = document.getElementById('tray'); },
  isOpen() { return Tray.el.classList.contains('open'); },
  open(build, anchor) {
    Tray.build = build; Tray.el.innerHTML = build(); Tray.el.hidden = false;
    Tray.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => Tray.close()));
    if (anchor) { const dev = document.getElementById('device'); const dr = dev.getBoundingClientRect(); const sc = dr.width / dev.offsetWidth || 1; const r = anchor.getBoundingClientRect(); Tray.el.style.top = (r.bottom - dr.top) / sc + 8 + 'px'; Tray.el.style.insetInlineStart = Math.max(8, (r.left - dr.left) / sc) + 'px'; }
    void Tray.el.offsetWidth; Tray.el.classList.add('open');
    requestAnimationFrame(() => Ann.place());
  },
  rebuild() { if (Tray.build && Tray.isOpen()) { Tray.el.innerHTML = Tray.build(); Tray.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => Tray.close())); } },
  close(silent) {
    if (!Tray.el || !Tray.isOpen()) return;
    Tray.el.classList.remove('open');
    const done = () => { if (!Tray.isOpen()) { Tray.el.hidden = true; Tray.el.innerHTML = ''; } };
    silent ? done() : setTimeout(done, 220);
    requestAnimationFrame(() => Ann.place());
  },
};

/* ---------------------------------------------------------------- shared renderers */
function pageHead(h1, sub, acts = '', crumbs = '') {
  return `<header class="page-head">${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<div class="tt"><h1>${h1}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="acts">${acts}</div></header>`;
}
/* the global "currently casting" pill (shell top bar on desktop, inside the page head on the phone) */
function trayPill(sessions, opts = {}) {
  const n = Object.keys(sessions).length; if (!n) return '';
  return `<button class="traypill" data-tray ${opts.ann ? `data-ann="${opts.ann}"` : ''} aria-haspopup="dialog" aria-expanded="false"><span class="ic">${ic('cast', 's')}</span>משדר<span class="cnt">${n}</span></button>`;
}
/** sessions: {key: {cam, until, state, user, kind}} */
function trayHtml(sessions, opts = {}) {
  const rows = Object.entries(sessions).map(([k, s]) => {
    const scr = SCREEN[k]; const cls = s.state === 'not_confirmed' ? 'warn' : '';
    const st = s.state === 'starting' ? 'מתחבר…' : s.state === 'not_confirmed' ? 'המסך לא הגיע לזרם' : `יעצור ב־${s.until}`;
    const left = s.left || 0; const w = Math.max(2, Math.min(100, (left / (s.total || 30)) * 100));
    return `<div class="sess-row ${cls}">
      <span class="ic">${ic(s.kind === 'wall' ? 'grid' : 'camera', 's')}</span>
      <div class="t1">${esc(s.kind === 'wall' ? `קיר: ${s.cam}` : s.cam)} <span class="muted">←</span> ${esc(scr.room)}${s.user && s.user !== 'me' ? `<span class="own">(${esc(s.user)})</span>` : ''}</div>
      <div class="t2">${ic('clock', 's')}<span class="num">${st}</span>${s.state === 'playing' && left ? `<span class="num">· עוד ${fmtLeft(left)}</span>` : ''}</div>
      ${s.state === 'playing' ? `<div class="bar" aria-hidden="true"><i style="--w:${w}%"></i></div>` : ''}
      <div class="acts">
        ${s.state === 'not_confirmed' ? `<button class="btn" data-retry="${k}">${ic('refresh', 's')}נסה שוב</button>` : `<button class="btn" data-extend="${k}" ${s.ext >= 8 ? 'disabled title="הוארך 8 פעמים: התחל שידור חדש"' : ''}>${ic('plus', 's')}עוד 30 דקות</button>`}
        ${s.kind === 'camera' ? `<button class="btn" data-switch="${k}">${ic('swap', 's')}החלף מצלמה</button>` : ''}
        <button class="btn danger" data-stop="${k}">${ic('stop', 's')}עצור</button>
      </div></div>`;
  }).join('');
  const bulk = opts.bulk ? `<button class="btn ghost" data-stopall>${ic('stop', 's')}עצור את כל השידורים</button>` : '';
  return `<div class="th">${ic('cast')}<span>שידורים פעילים</span><span class="sp"></span>${bulk}<button class="xbtn" data-close aria-label="סגירה">${ic('x', 's')}</button></div>
    <div class="sess">${rows || '<div class="pk-empty">אין שידורים פעילים</div>'}</div>
    <div class="tf"><span>מכסה: ${Object.keys(sessions).length} מתוך ${opts.cap || 2}</span><span class="sp"></span><span>כל שידור נעצר לבד בתום הזמן</span></div>`;
}
function fmtLeft(min) { const m = Math.floor(min); const s = Math.round((min - m) * 60); return `${m}:${String(s).padStart(2, '0')}`; }
function castPill(o) {
  /* o: {state: starting|playing|not_confirmed|stopped_timeout|replaced|stop_error, room, until, left, total, music, remote} */
  const s = o.state;
  if (s === 'starting') return `<div class="castpill" role="status" ${o.ann ? `data-ann="${o.ann}"` : ''}><span class="ic"><span class="spin"></span></span><span class="tx"><span>מתחבר אל ${esc(o.room)}…</span><span class="st">${o.remote ? 'ההפעלה מרחוק · השידור רץ ברשת המקומית' : 'המסך מושך את הזרם'}</span></span><span class="acts"><button class="stop" data-stop>עצור</button></span></div>`;
  if (s === 'playing') {
    const p = o.total ? Math.round(100 - (o.left / o.total) * 100) : 0;
    return `<div class="castpill" role="status" ${o.ann ? `data-ann="${o.ann}"` : ''}><span class="ring" style="--p:${p}" title="עוד ${fmtLeft(o.left)}"></span><span class="tx"><span>משדר אל ${esc(o.room)} · <span class="num">יעצור ב־${o.until}</span></span>${o.music ? `<span class="st">המוזיקה ב${esc(o.room)} נעצרה</span>` : `<span class="st num">עוד ${fmtLeft(o.left)}${o.remote ? ' · מרחוק' : ''}</span>`}</span><span class="acts"><button data-extend>עוד 30 דקות</button><button class="stop" data-stop>עצור</button></span></div>`;
  }
  if (s === 'not_confirmed') return `<div class="castpill warn" role="alert" ${o.ann ? `data-ann="${o.ann}"` : ''}><span class="ic">${ic('warn', 's')}</span><span class="tx"><span>המסך לא הגיע לזרם</span><span class="st">${esc(o.room)} · 15 שניות ללא תגובה</span></span><span class="acts"><button data-retry>נסה שוב</button><button class="stop" data-stop>עצור</button></span></div>`;
  if (s === 'stopped_timeout') return `<div class="castpill" role="status"><span class="ic">${ic('clock', 's')}</span><span class="tx"><span>השידור הופסק: תם הזמן</span><span class="st">${esc(o.room)}</span></span><span class="acts"><button data-again>שדר שוב</button><button data-dismiss>סגור</button></span></div>`;
  if (s === 'replaced') return `<div class="castpill warn" role="status"><span class="ic">${ic('info', 's')}</span><span class="tx"><span>השידור הוחלף על ידי ${esc(o.user)}</span><span class="st">${esc(o.room)} מציג עכשיו: ${esc(o.cam)}</span></span><span class="acts"><button data-dismiss>סגור</button></span></div>`;
  if (s === 'stop_error') return `<div class="castpill err" role="alert"><span class="ic">${ic('warn', 's')}</span><span class="tx"><span>המסך לא אישר את העצירה</span><span class="st">הזרם נחסם; המסך ייעצר תוך שניות</span></span><span class="acts"><button data-dismiss>סגור</button></span></div>`;
  return '';
}

/* the picker list (shared by camera + wall); ctx: {profile, codec, canPublic, remote, sessions, recent} */
function pickerList(ctx = {}) {
  const sessions = ctx.sessions || {};
  const eligible = SCREENS.filter((s) => !s.speaker);
  const byFloor = new Map();
  for (const s of eligible) { if (!byFloor.has(s.floor)) byFloor.set(s.floor, []); byFloor.get(s.floor).push(s); }
  const opt = (s) => {
    const why = disabledWhy(s, ctx); const st = stateText(s, sessions);
    const sel = ctx.selected === s.key;
    return `<button class="opt ${why ? 'off' : ''}" role="option" aria-selected="${sel}" ${why ? 'aria-disabled="true"' : ''} data-pick="${s.key}" title="${esc(why || '')}">
      <span class="ic">${ic(s.icon)}</span>
      <span class="tx"><span class="nm">${esc(s.name)}</span><span class="st ${why ? 'why' : st.cls}">${esc(why || `${s.room} · ${st.t}`)}</span></span>
      ${why ? '' : capBadge(s)}
    </button>`;
  };
  const recent = eligible.filter((s) => s.recent).sort((a, b) => a.recent - b.recent);
  let html = '';
  if (recent.length && ctx.recent !== false) html += `<div class="pk-sec">לאחרונה</div><div class="pk" role="listbox">${recent.map(opt).join('')}</div>`;
  for (const [floor, list] of byFloor) html += `<div class="pk-sec">${esc(floor)}</div><div class="pk" role="listbox">${list.map(opt).join('')}</div>`;
  return html;
}
/* fixed demo clock: 14:02 now; a 30-min session ends 14:32; the lab's 5-min session ends 14:07 */
const NOW = '14:02';
