/* WisKey native screens (CR-036 slice S5) - static mockup gallery. Fake data only: an invented site, invented stations,
   invented people and events. Nothing here talks to a device, to the intercom integration or to the system infrastructure.
   State lives in the URL hash so every view has a link:
     #s=stations|people|events|schedules|settings  d=desktop|tablet|phone  t=light|dark  k=classic|domus|tesla|bubble|crystal
      v=cards|list|table  st=ready|loading|empty|error|forbidden|scoped|stale  id=admin|operator|viewer
      dr=0|1 (detail drawer)  dlg=none|release|export|switch  pop=0|1 (display switch popover)  f=0|1 (keyboard focus demo)
      sub=status|audit|groups|view (settings sub-screen)  sent=0|1 (door result after a release)
   Not product code: the real screens (slices S6-S10) are built from docs/design/WISKEY_SCREENS_DESIGN.md. */
'use strict';

/* ------------------------------------------------------------------ state */
const S = { s: 'stations', d: 'desktop', t: 'light', k: 'classic', v: 'cards', st: 'ready', id: 'admin', dr: '0', dlg: 'none', pop: '0', f: '0', sub: 'status', sent: '0', talk: 'unavail', ann: 'none', callv: 'none', wa: 'idle', sel: '0' };
const DEFAULTS = { ...S };
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  for (const k of Object.keys(S)) S[k] = h.get(k) || DEFAULTS[k];
}
function writeHash() {
  const h = new URLSearchParams();
  for (const [k, v] of Object.entries(S)) if (v !== DEFAULTS[k]) h.set(k, v);
  history.replaceState(null, '', '#' + h.toString());
}
function set(patch) { Object.assign(S, patch); render(); }
window.set = set;
const PH = () => S.d === 'phone';
const TB = () => S.d === 'tablet';
/* identity -> Arx permissions of CR-036 section 2.3 (D). The viewer holds access.read only. */
const PERM = {
  admin: ['access.read', 'access.stations.read', 'access.events.read', 'access.events.export', 'access.people.read', 'access.people.sensitive', 'access.people.manage', 'access.people.message', 'access.admin.read', 'door_authority', 'access.call', 'access.announce', 'settings'],
  operator: ['access.read', 'access.stations.read', 'access.events.read', 'access.people.read', 'door_authority', 'access.call', 'access.announce'],
  viewer: ['access.read'],
};
const can = (p) => PERM[S.id].includes(p);
/* a station-scoped operator (st=scoped): sees only stations in the scope chain; everything else is omitted, never greyed */
const SCOPE = ['lobby', 'gate'];
const inScope = (id) => S.st !== 'scoped' || S.id === 'admin' || SCOPE.includes(id);

/* ------------------------------------------------------------------ icons */
const I = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', door: 'M5 3h11v18H5zM13 12h.5M16 21h3V7h-3',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', check: 'M4 12l5 5L20 7', x: 'M6 6l12 12M18 6L6 18',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c1-4 3.5-6 7-6s6 2 7 6M16 4a4 4 0 0 1 0 8M22 21c-.5-3-2-5-5-5.5',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14', chev: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', more: 'M5 12h.01M12 12h.01M19 12h.01',
  lock: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4', unlock: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4', key: 'M14 3a6 6 0 0 0-5.7 7.8L3 16v5h5l1-1v-2h2l1-1v-2h2l1.2-1.2A6 6 0 1 0 14 3zM16 8h.01',
  face: 'M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4M9 10v1M15 10v1M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5',
  export: 'M12 3v12M7 10l5 5 5-5M4 21h16', filter: 'M3 5h18l-7 8v6l-4-2v-4z', refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v.5M12 11v6',
  pin: 'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  window: 'M3 5h18v14H3zM3 9h18M7 7h.01M10 7h.01', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  cal: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4', sync: 'M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7M17 3v4h-4M7 21v-4h4',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', log: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4',
  tag: 'M3 12V4h8l9 9-8 8zM7 8h.01', hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-3 7-7 7s-6-2-7-5l-2-5a1.5 1.5 0 0 1 2.7-1.3L8 13',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3', cam: 'M3 7h4l2-2h6l2 2h4v12H3zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  columns: 'M4 5h16v14H4zM10 5v14M15 5v14', ring: 'M18 8a6 6 0 0 0-12 0v5l-2 2h16l-2-2zM10 19a2 2 0 0 0 4 0', ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8',
  volume: 'M4 10v4h3l4 3V7l-4 3zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12',
  micoff: 'M12 3a3 3 0 0 1 3 3v3M9 9v3a3 3 0 0 0 5 2.2M5 11a7 7 0 0 0 10.5 6M19 11a7 7 0 0 1-1 3.6M12 18v3M3 3l18 18',
  end: 'M3 14c5-5 13-5 18 0l-2 3-4-2v-3c-2-.7-4-.7-6 0v3l-4 2z', wa: 'M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zM9 8.5c.3-.5 1-.5 1.3 0l.7 1.5c.1.3 0 .6-.2.8l-.5.6c.8 1.4 1.8 2.4 3.2 3.2l.6-.5c.2-.2.5-.3.8-.2l1.5.7c.5.3.5 1 0 1.3-.7.7-1.5 1-2.3.8-3-.8-5.4-3.2-6.2-6.2-.2-.8.1-1.6.8-2.3z',
  checkbox: 'M4 4h16v16H4zM8 12l3 3 5-6', send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
};
const ic = (n, sw = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${I[n]}"/></svg>`;
const FD = (sel) => (S.f === '1' && sel ? ' focus-demo' : '');

/* ------------------------------------------------------------------ fake data (an invented office building) */
const FLOORS = [
  { id: 'f0', name: 'קומת קרקע', areas: [{ id: 'a-lobby', name: 'לובי' }, { id: 'a-gate', name: 'שער ראשי' }, { id: 'a-park', name: 'חניון' }] },
  { id: 'f1', name: 'קומה 1', areas: [{ id: 'a-lab', name: 'מעבדה' }, { id: 'a-store', name: 'מחסן' }] },
  { id: 'f2', name: 'קומה 2', closed: true, areas: [{ id: 'a-mgmt', name: 'הנהלה' }] },
];
const STATIONS = [
  { id: 'gate', name: 'שער ראשי', area: 'a-gate', floor: 'f0', online: true, call: 'ringing', seen: 'עכשיו', sync: 'synced', model: 'DS-KD8003', fw: 'V2.2.62', doors: [{ i: 1, name: 'שער' }], camera: true, pending: 0 },
  { id: 'lobby', name: 'לובי', area: 'a-lobby', floor: 'f0', online: true, call: 'idle', seen: 'עכשיו', sync: 'synced', model: 'DS-KD8003', fw: 'V2.2.62', doors: [{ i: 1, name: 'כניסה' }, { i: 2, name: 'מחסום' }], camera: true, pending: 0 },
  { id: 'park', name: 'חניון', area: 'a-park', floor: 'f0', online: true, call: 'idle', seen: 'לפני דקה', sync: 'pending', model: 'DS-KV8213', fw: 'V2.2.53', doors: [], camera: true, pending: 3 },
  { id: 'lab', name: 'מעבדה', area: 'a-lab', floor: 'f1', online: true, call: 'in_call', seen: 'עכשיו', sync: 'synced', model: 'DS-KD8003', fw: 'V2.2.62', doors: [{ i: 1, name: 'דלת מעבדה' }], camera: true, pending: 0 },
  { id: 'store', name: 'מחסן', area: 'a-store', floor: 'f1', online: false, call: 'unavailable', seen: 'אתמול 19:02', sync: 'offline', model: 'DS-KV6113', fw: 'V2.2.53', doors: [{ i: 1, name: 'מחסן' }], camera: false, pending: 1 },
  { id: 'mgmt', name: 'הנהלה', area: 'a-mgmt', floor: 'f2', online: true, call: 'idle', seen: 'עכשיו', sync: 'error', err: 'sync_rejected: user 2044 revision conflict', model: 'DS-KD8003', fw: 'V2.2.62', doors: [{ i: 1, name: 'הנהלה' }], camera: true, pending: 0 },
];
const AREA = Object.fromEntries(FLOORS.flatMap((f) => f.areas.map((a) => [a.id, { ...a, floor: f.name }])));
const place = (s) => `${AREA[s.area].floor} · ${AREA[s.area].name}`;
const CALL = { ringing: ['שיחה נכנסת', 'warn', 'ring'], in_call: ['בשיחה', 'acc', 'phone'], idle: null, unavailable: null };
const SYNC = { synced: ['מסונכרן', 'ok'], pending: ['ממתין לסנכרון', 'warn'], offline: ['לא מחובר', 'off'], error: ['שגיאת סנכרון', 'err'] };
const visibleStations = () => STATIONS.filter((s) => inScope(s.id));

const PEOPLE = [
  { id: 'p1', name: 'דנה כהן', groups: ['עובדים', 'מעבדה'], stations: ['gate', 'lobby', 'lab'], valid: 'ללא הגבלה', state: 'active', emp: '1001', phone: '050-000-0001', mail: 'dana@example.test', creds: ['card', 'pin'], photo: true },
  { id: 'p2', name: 'יוסי לוי', groups: ['עובדים'], stations: ['gate', 'lobby'], valid: 'עד 31.12.2026', state: 'active', emp: '1002', phone: '050-000-0002', mail: 'yossi@example.test', creds: ['card'], photo: true },
  { id: 'p3', name: 'מיכל אברהם', groups: ['הנהלה'], stations: ['gate', 'lobby', 'mgmt', 'lab'], valid: 'ללא הגבלה', state: 'active', emp: '1003', phone: '050-000-0003', mail: 'michal@example.test', creds: ['card', 'face'], photo: true },
  { id: 'p4', name: 'אורי שמש', groups: ['קבלנים'], stations: ['park', 'store'], valid: 'עד 15.11.2026', state: 'active', emp: 'ק-204', phone: '052-000-0004', mail: '', creds: ['pin'], photo: false },
  { id: 'p5', name: 'נועה בר', groups: ['עובדים', 'מעבדה'], stations: ['lobby', 'lab'], valid: 'עד 30.10.2026', state: 'expiring', emp: '1005', phone: '050-000-0005', mail: 'noa@example.test', creds: ['card'], photo: true },
  { id: 'p6', name: 'אלי פרץ', groups: ['ניקיון'], stations: ['lobby', 'store'], valid: 'ללא הגבלה', state: 'disabled', emp: 'נ-17', phone: '', mail: '', creds: ['card'], photo: false },
  { id: 'p7', name: 'רונית גל', groups: ['הנהלה'], stations: ['gate', 'lobby', 'mgmt'], valid: 'ללא הגבלה', state: 'active', emp: '1007', phone: '050-000-0007', mail: 'ronit@example.test', creds: ['card', 'pin'], photo: true },
  { id: 'p8', name: 'תומר אדר', groups: ['אורחים'], stations: ['lobby'], valid: 'היום בלבד', state: 'active', emp: 'א-311', phone: '', mail: '', creds: ['pin'], photo: false },
];
const PSTATE = { active: ['פעיל', 'ok'], expiring: ['פג בקרוב', 'warn'], disabled: ['מושבת', 'off'], archived: ['בארכיון', 'unk'] };
const CRED = { card: ['כרטיס', 'card'], pin: ['קוד', 'key'], face: ['זיהוי פנים', 'face'], manual: ['פתיחה ידנית', 'hand'], call: ['שיחה', 'phone'], unknown: ['לא ידוע', 'info'] };
const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('');
/* a person is visible only if at least one of their stations is in the operator's scope (SCOPES "projection placeholders") */
const visiblePeople = () => PEOPLE.filter((p) => p.stations.some((s) => inScope(s)));

const EVENTS = [
  { id: 'e1', day: 'היום', time: '08:14', person: 'דנה כהן', station: 'gate', door: 'שער', how: 'card', result: 'granted' },
  { id: 'e2', day: 'היום', time: '08:12', person: 'יוסי לוי', station: 'lobby', door: 'כניסה', how: 'card', result: 'granted' },
  { id: 'e3', day: 'היום', time: '08:09', person: null, station: 'lobby', door: 'מחסום', how: 'pin', result: 'denied' },
  { id: 'e4', day: 'היום', time: '08:03', person: 'מיכל אברהם', station: 'mgmt', door: 'הנהלה', how: 'face', result: 'granted' },
  { id: 'e5', day: 'היום', time: '07:58', person: null, station: 'gate', door: 'שער', how: 'call', result: 'call' },
  { id: 'e6', day: 'היום', time: '07:41', person: 'אורי שמש', station: 'park', door: null, how: 'pin', result: 'granted' },
  { id: 'e7', day: 'היום', time: '07:30', person: 'נועה בר', station: 'lab', door: 'דלת מעבדה', how: 'card', result: 'granted' },
  { id: 'e8', day: 'היום', time: '07:12', person: null, station: 'lobby', door: 'כניסה', how: 'manual', result: 'sent' },
  { id: 'e9', day: 'אתמול', time: '22:10', person: null, station: 'park', door: null, how: 'unknown', result: 'denied' },
  { id: 'e10', day: 'אתמול', time: '19:02', person: null, station: 'store', door: null, how: 'unknown', result: 'offline' },
  { id: 'e11', day: 'אתמול', time: '18:45', person: 'אלי פרץ', station: 'store', door: 'מחסן', how: 'card', result: 'denied' },
  { id: 'e12', day: 'אתמול', time: '17:30', person: 'רונית גל', station: 'gate', door: 'שער', how: 'card', result: 'granted' },
];
const RESULT = { granted: ['אושר', 'ok'], denied: ['נדחה', 'err'], call: ['שיחה', 'acc'], sent: ['פתיחה נשלחה', 'acc'], offline: ['העמדה התנתקה', 'off'], unknown: ['לא ידוע', 'unk'] };
const visibleEvents = () => EVENTS.filter((e) => inScope(e.station));
const stationOf = (id) => STATIONS.find((s) => s.id === id);

/* ------------------------------------------------------------------ shell */
const RAIL = [['home', 'בית', false], ['shield', 'אבטחה', false], ['door', 'בקרת כניסה', true], ['map', 'מפות', false], ['bell', 'התרעות', false]];
const TABS = [['overview', 'מרכז הכניסה'], ['stations', 'תחנות ודלתות'], ['people', 'אנשים'], ['events', 'פעילות'], ['schedules', 'לוחות זמנים']];
const TITLES = { stations: 'תחנות ודלתות', people: 'אנשים', events: 'פעילות', schedules: 'לוחות זמנים', settings: 'בקרת כניסה' };

function shell(body, overlays = '') {
  const rail = PH() ? '' : `<nav class="sh-rail" aria-label="ניווט">
    <div class="sh-brand">A</div>
    ${RAIL.map(([i, l, on]) => `<a class="sh-item${on ? ' on' : ''}" href="#">${ic(i)}<span>${l}</span></a>`).join('')}
    <a class="sh-item end${S.s === 'settings' ? ' on' : ''}" href="#">${ic('gear')}<span>הגדרות</span></a>
  </nav>`;
  const bottom = PH() ? `<nav class="sh-bottom" aria-label="ניווט">
    ${RAIL.slice(0, 4).map(([i, l, on]) => `<a class="sh-item${on && S.s !== 'settings' ? ' on' : ''}" href="#">${ic(i)}<span>${l}</span></a>`).join('')}
    <a class="sh-item${S.s === 'settings' ? ' on' : ''}" href="#">${ic('gear')}<span>הגדרות</span></a></nav>` : '';
  const stale = S.st === 'stale';
  const feed = stale ? `<span class="sh-pill stale"><span class="dot"></span>עודכן לפני 4 דק׳</span>` : `<span class="sh-pill"><span class="dot"></span>מחובר</span>`;
  const tabs = S.s === 'settings' ? '' : `<div class="sh-tabs" role="tablist">${TABS.filter(([id]) => tabAllowed(id)).map(([id, l]) => `<a class="sh-tab${id === S.s ? ' on' : ''}" role="tab" href="#" onclick="set({s:'${id}',dr:'0',dlg:'none',pop:'0'});return false">${l}</a>`).join('')}</div>`;
  const crumb = S.s === 'settings' ? 'הגדרות › בקרת כניסה' : 'בקרת כניסה';
  return `<div class="sh" data-skin="${S.k}" data-theme="${S.t}" lang="he" dir="rtl">
    <div class="sh-main">
      <div class="sh-top"><span class="sh-crumb">${crumb}</span><span class="sp"></span>${S.s === 'settings' ? '' : feed}<span class="sh-avatar">${S.id === 'admin' ? 'מא' : S.id === 'operator' ? 'מפ' : 'צפ'}</span></div>
      ${tabs}
      <div class="sh-body">${body}</div>
    </div>
    ${rail}${bottom}${overlays}
  </div>`;
}
/* viewer: only מרכז הכניסה and תחנות (names only) - the other tabs are not rendered for that identity (default deny, omitted not greyed) */
function tabAllowed(id) {
  if (id === 'overview' || id === 'stations') return true;
  if (id === 'people') return can('access.people.read');
  if (id === 'events') return can('access.events.read');
  if (id === 'schedules') return can('access.stations.read');
  return true;
}

/* page header: title, view switch, search, and (admins only) the per-screen display switch */
function head(title, sub, actions = '', views = true) {
  const sw = can('settings') && S.s !== 'settings' ? `<button class="btn ghost sm" aria-haspopup="menu" aria-expanded="${S.pop}" onclick="set({pop: S.pop==='1'?'0':'1'})" title="תצוגת המסך">${ic('window')}<span class="hide-p">מסך Arx</span>${ic('down')}</button>` : '';
  const seg = views ? `<div class="seg" role="group" aria-label="תצוגה">
      <button aria-pressed="${S.v === 'cards'}" onclick="set({v:'cards'})" title="כרטיסים">${ic('grid')}</button>
      <button aria-pressed="${S.v === 'list'}" onclick="set({v:'list'})" title="רשימה">${ic('list')}</button>
      ${PH() ? '' : `<button aria-pressed="${S.v === 'table'}" onclick="set({v:'table'})" title="טבלה">${ic('table')}</button>`}
    </div>` : '';
  return `<header class="wk-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="sp"></span><div class="wk-actions">${actions}${seg}${sw}</div></header>`;
}
function switchPop() {
  if (S.pop !== '1') return '';
  const top = PH() ? 118 : 128;
  return `<div class="pop" role="menu" style="top:${top}px;inset-inline-end:${PH() ? 16 : 100}px">
    <a class="on" href="#" role="menuitemradio" aria-checked="true">${ic('check')}מסך Arx (נוכחי)</a>
    <a href="#" role="menuitemradio" aria-checked="false" onclick="set({pop:'0',dlg:'switch'});return false">${ic('window')}חלון האינטרקום</a>
    <div class="sep"></div>
    <a href="#" role="menuitem" onclick="set({s:'settings',sub:'view',pop:'0'});return false">${ic('gear')}הגדרות תצוגה</a>
  </div>`;
}
function switchDialog() {
  if (S.dlg !== 'switch') return '';
  return `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="box">
    <h2 id="dlg-t">להציג את "${TITLES[S.s]}" בחלון האינטרקום?</h2>
    <p>השינוי חל על כל המשתמשים. אפשר לחזור למסך Arx בכל רגע.</p>
    <div class="acts"><button class="btn primary" onclick="set({dlg:'none'})">החלף</button><button class="btn" onclick="set({dlg:'none'})">ביטול</button></div>
  </div></div>`;
}

/* state panels (sw-state-panel) */
function panel(kind, title, text, action = '') {
  const icon = { loading: 'refresh', empty: 'door', error: 'alert', forbidden: 'lock', scoped: 'eye', stale: 'clock' }[kind] || 'info';
  return `<div class="panel ${kind}${kind === 'forbidden' ? ' full' : ''}" role="status"><div class="ic">${ic(icon)}</div><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}${action}</div>`;
}
const FORBIDDEN = panel('forbidden', 'המסך הזה אינו זמין לך', '');
function skCards(n = 6) {
  return `<div class="grid">${Array.from({ length: n }, () => `<div class="sk-card" aria-busy="true"><div class="sk still"></div><div class="sk l"></div><div class="sk m"></div><div class="sk b"></div></div>`).join('')}</div>`;
}
function skRows(n = 8) {
  return `<div class="rows" aria-busy="true">${Array.from({ length: n }, () => `<div class="row"><div class="sk" style="width:10px;height:10px;border-radius:50%"></div><div class="main"><div class="sk l"></div><div class="sk m"></div></div><div class="sk" style="width:80px;height:12px"></div></div>`).join('')}</div>`;
}

/* places tree (devices-building nav.tree) - stations per floor and area; floors collapse; out-of-scope places are omitted */
function tree(kind = 'stations', selected = 'all') {
  const stations = visibleStations();
  const floors = FLOORS.filter((f) => f.areas.some((a) => stations.some((s) => s.area === a.id)));
  const total = kind === 'doors' ? stations.reduce((n, s) => n + s.doors.length, 0) : stations.length;
  const rows = floors.map((f) => {
    const areas = f.areas.filter((a) => stations.some((s) => s.area === a.id));
    const cnt = stations.filter((s) => s.floor === f.id).reduce((n, s) => n + (kind === 'doors' ? s.doors.length : 1), 0);
    const open = !f.closed;
    const kids = open ? areas.map((a) => {
      const st = stations.filter((s) => s.area === a.id);
      const dot = st.every((s) => s.online) ? '' : st.some((s) => s.online) ? ' unk' : ' off';
      const doors = kind === 'doors' ? st.flatMap((s) => s.doors.map((d) => `<a class="door${selected === `${s.id}/${d.i}` ? ' on' : ''}" href="#">${ic('door')}<span>${d.name}</span></a>`)).join('') : '';
      return `<a class="area${selected === a.id ? ' on' : ''}" href="#"><span class="st${dot}"></span><span>${a.name}</span><span class="n">${kind === 'doors' ? st.reduce((n, s) => n + s.doors.length, 0) : st.length}</span></a>${doors}`;
    }).join('') : '';
    return `<a class="floor${open ? '' : ' closed'}" href="#" aria-expanded="${open}">${ic('down')}<span>${f.name}</span><span class="n">${cnt}</span></a>${kids}`;
  }).join('');
  return `<nav class="tree" aria-label="מיקום"><div class="ttl">מיקום</div><a class="${selected === 'all' ? 'on' : ''}" href="#">${ic('pin')}<span>הכול</span><span class="n">${total}</span></a><div class="sep"></div>${rows}</nav>`;
}
/* phone: the tree becomes a chip that opens a sheet with the same tree (not drawn here) */
const treeChip = () => `<button class="chip">${ic('pin')}הכול${ic('down')}</button>`;

/* ------------------------------------------------------------------ 1. stations and doors (round 2) */
/* A station still: the existing station-stills concept (one frame of the station's stream through go2rtc, re-read every
   60 s, wiskey_camera.py). The mockup draws an invented entrance scene per station - no real frame, no lab image. */
function scene(s, i) {
  const hue = [212, 196, 28, 160, 230, 265][i % 6];
  const dusk = S.t === 'dark';
  const sky = dusk ? `hsl(${hue} 30% 16%)` : `hsl(${hue} 45% 78%)`;
  const sky2 = dusk ? `hsl(${hue} 25% 9%)` : `hsl(${hue} 35% 62%)`;
  const wall = dusk ? `hsl(${hue} 10% 22%)` : `hsl(${hue} 12% 58%)`;
  const wall2 = dusk ? `hsl(${hue} 10% 15%)` : `hsl(${hue} 12% 46%)`;
  const floor = dusk ? '#141821' : '#7b8494';
  const door = dusk ? `hsl(${hue} 18% 28%)` : `hsl(${hue} 22% 36%)`;
  const glass = dusk ? 'rgba(255,220,150,.55)' : 'rgba(255,255,255,.55)';
  const person = i === 0 ? `<g transform="translate(118 44)"><circle cx="0" cy="0" r="5" fill="${dusk ? '#c9d2e3' : '#2b3446'}"/><path d="M-7 8c0-5 14-5 14 0v16h-14z" fill="${dusk ? '#aeb8cb' : '#3a4457'}"/></g>` : '';
  const car = i === 2 ? `<g transform="translate(40 50)"><rect x="0" y="0" width="52" height="16" rx="4" fill="${dusk ? '#394458' : '#2d3748'}"/><rect x="10" y="-8" width="30" height="10" rx="3" fill="${dusk ? '#4a5670' : '#3f4a5e'}"/><circle cx="12" cy="17" r="4" fill="#111"/><circle cx="40" cy="17" r="4" fill="#111"/></g>` : '';
  const noise = `<rect width="160" height="70" fill="url(#g${i})" opacity=".35"/>`;
  return `<svg class="scene" viewBox="0 0 160 70" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="s${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>
    <linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient></defs>
    <rect width="160" height="70" fill="url(#s${i})"/>
    <rect x="0" y="12" width="60" height="46" fill="${wall}"/><rect x="100" y="12" width="60" height="46" fill="${wall2}"/>
    <rect x="60" y="8" width="40" height="50" fill="${door}"/><rect x="66" y="14" width="12" height="36" fill="${glass}"/><rect x="82" y="14" width="12" height="36" fill="${glass}"/>
    <rect x="0" y="56" width="160" height="14" fill="${floor}"/>
    ${car}${person}${noise}
    ${dusk ? `<circle cx="80" cy="6" r="9" fill="rgba(255,230,170,.35)"/>` : ''}
  </svg>`;
}
const DUR = { gate: '00:00', lab: '01:42' };
const TALK = { idle: ['דיבור', 'לחיצה ארוכה כדי לדבר'], req: ['מבקש הרשאת מיקרופון…', ''], live: ['מדבר', 'שחרור כדי להפסיק'], muted: ['מושתק', 'לחיצה כדי לבטל השתקה'], unavail: ['דיבור בלוח הקלאסי', 'פותח את העמדה בחלון האינטרקום'] };
/* the talk control: push-to-talk. Until the audio hook (W10) lands, the control is in the `unavail` state and opens the station in
   the classic panel; it is rendered only with access.call. */
function talkControl(size = '') {
  if (!can('access.call')) return '';
  const st = S.talk;
  const [label, hint] = TALK[st];
  const icon = st === 'muted' ? 'micoff' : st === 'unavail' ? 'window' : 'mic';
  return `<button class="talk ${st} ${size}${FD(true)}" aria-pressed="${st === 'live'}" aria-label="${label}" title="${hint}" onclick="set({talk: S.talk==='idle'?'req':S.talk==='req'?'live':S.talk==='live'?'muted':S.talk==='muted'?'idle':'unavail'})">
    <span class="ring"></span>${ic(icon, 2)}<span class="lbl">${size === 'sm' && st === 'unavail' ? 'לוח קלאסי' : label}</span>${st === 'live' ? '<span class="eq"><i></i><i></i><i></i><i></i></span>' : ''}</button>`;
}
function callControls(s, where = 'card') {
  if (!can('access.call')) return CALL[s.call] ? `<div class="callrow"><span class="pill ${CALL[s.call][1]}">${CALL[s.call][0]}</span></div>` : '';
  if (s.call === 'ringing') return `<div class="callrow ringing"><span class="cs">${ic('ring')}שיחה נכנסת<span class="dur">${DUR[s.id] || '00:08'}</span></span>
      <button class="btn sm ok" onclick="set({sent:'0'})">${ic('phone')}מענה</button><button class="btn sm danger">${ic('x')}דחייה</button></div>`;
  if (s.call === 'in_call') return `<div class="callrow incall"><span class="cs">${ic('phone')}בשיחה<span class="dur">${DUR[s.id] || '00:31'}</span></span>
      ${where === 'card' ? talkControl('sm') : ''}<button class="btn sm danger">${ic('end')}סיום</button></div>`;
  return '';
}
function doorButtons(s, size = 'sm', focusFirst = false) {
  if (!can('door_authority') || !s.doors.length) return '';
  return s.doors.map((d, i) => `<button class="btn ${size}${FD(focusFirst && i === 0 && s.id === 'lobby')}" ${s.online ? '' : 'disabled'} onclick="set({dlg:'release'})">${ic('unlock')}פתח${s.doors.length > 1 ? ` · ${d.name}` : ''}</button>`).join('');
}
/* per-door hold state (read-only, from the door programs; see the schedules screen) */
const HOLD = { 'lobby/1': 'פתוח קבוע עד 09:00', 'gate/1': '', 'lab/1': '', 'mgmt/1': 'נעול עד 06:00', 'store/1': '', 'lobby/2': '' };
function stationCard(s, i) {
  const call = CALL[s.call];
  const tech = can('access.stations.read') ? `<div class="tech"><span class="pill ${SYNC[s.sync][1]} plain">${SYNC[s.sync][0]}</span>${s.pending ? `<span>${s.pending} ממתינים</span>` : ''}<span class="sp"></span><span class="hide-p"><code>${s.model}</code></span></div>` : '';
  const still = s.camera
    ? `<div class="still${s.online ? '' : ' off'}">${scene(s, i)}<span class="stamp">${s.online ? '08:14:07' : s.seen}</span>${call ? `<span class="ring-badge ${s.call}">${ic(call[2])}${call[0]}</span>` : ''}
        <div class="scrim"><span class="name">${s.name}</span><span class="place">${place(s)}</span></div></div>`
    : `<div class="still nocam"><span class="nc">${ic('cam')}ללא מצלמה</span><div class="scrim"><span class="name">${s.name}</span><span class="place">${place(s)}</span></div></div>`;
  const hold = s.doors.map((d) => HOLD[`${s.id}/${d.i}`]).filter(Boolean);
  return `<article class="wk-card st${s.online ? '' : ' dim'}${s.call === 'ringing' ? ' ringing' : ''}" tabindex="0" onclick="set({dr:'1'})">${still}<div class="cb">
    <div class="hd"><span class="pill ${s.online ? 'live' : 'off'}">${s.online ? 'מחובר' : 'לא מחובר'}</span><span class="meta"><span>נראה <b>${s.seen}</b></span>${hold.length ? `<span class="hold">${ic('clock')}${hold[0]}</span>` : ''}</span></div>
    <div onclick="event.stopPropagation()">${callControls(s)}</div>
    <div class="doors" onclick="event.stopPropagation()">${doorButtons(s, 'sm', true)}${can('access.announce') && s.online ? `<button class="btn sm icon" title="הכרזה" aria-label="הכרזה" onclick="set({dlg:'announce',ann:'idle'})">${ic('volume')}</button>` : ''}</div>${tech}</div></article>`;
}
function stationRow(s, i) {
  const call = CALL[s.call];
  return `<a class="row st${FD(s.id === 'lobby')}" href="#" onclick="set({dr:'1'});return false"><span class="thumb${s.online ? '' : ' off'}">${s.camera ? scene(s, i) : ic('cam')}</span>
    <div class="main"><span class="t">${s.name}<span class="pill ${s.online ? 'live' : 'off'} mini"></span></span><span class="s">${place(s)}${can('access.stations.read') ? ` · ${SYNC[s.sync][0]}` : ''}</span></div>
    ${call ? `<span class="pill ${call[1]}">${call[0]}${DUR[s.id] ? ` · ${DUR[s.id]}` : ''}</span>` : ''}<span class="side hide-p">נראה ${s.seen}</span>
    <div class="acts" onclick="event.stopPropagation()">${s.call === 'ringing' && can('access.call') ? `<button class="btn sm ok">${ic('phone')}מענה</button>` : ''}${doorButtons(s)}</div>${ic('chev')}</a>`;
}
function stationTable(list) {
  const tech = can('access.stations.read');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>תחנה</th><th>מיקום</th><th>מצב</th><th>נראה לאחרונה</th><th>שיחה</th><th>דלתות</th>${tech ? '<th>סנכרון</th><th>דגם · קושחה</th>' : ''}<th></th></tr></thead><tbody>
    ${list.map((s) => `<tr onclick="set({dr:'1'})"><td><b>${s.name}</b></td><td>${place(s)}</td><td><span class="pill ${s.online ? 'live' : 'off'}">${s.online ? 'מחובר' : 'לא מחובר'}</span></td><td class="num">${s.seen}</td><td>${CALL[s.call] ? `<span class="pill ${CALL[s.call][1]}">${CALL[s.call][0]}${DUR[s.id] ? ` · ${DUR[s.id]}` : ''}</span>` : '<span class="muted">—</span>'}</td><td>${s.doors.map((d) => d.name).join(', ') || '<span class="muted">—</span>'}</td>${tech ? `<td><span class="pill ${SYNC[s.sync][1]} plain">${SYNC[s.sync][0]}</span></td><td><code class="ltr">${s.model} · ${s.fw}</code></td>` : ''}<td onclick="event.stopPropagation()">${s.call === 'ringing' && can('access.call') ? `<button class="btn sm ok">${ic('phone')}מענה</button>` : ''}${doorButtons(s)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function stationsScreen() {
  const actions = `<span class="search">${ic('search')}חיפוש תחנה</span>${can('access.announce') ? `<button class="btn" onclick="set({dlg:'announce',ann:'idle'})">${ic('volume')}<span class="hide-p">הכרזה</span></button>` : ''}`;
  let body;
  if (S.st === 'loading') body = S.v === 'cards' ? skCards() : skRows();
  else if (S.st === 'empty') body = panel('empty', 'אין תחנות במיקום הזה', '');
  else if (S.st === 'error') body = panel('error', 'לא ניתן לטעון את התחנות', 'הניסיון חוזר אוטומטית', `<button class="btn">${ic('refresh')}נסה שוב</button>`);
  else {
    const list = visibleStations();
    const ringing = list.filter((s) => s.call === 'ringing' || s.call === 'in_call').length;
    const strip = ringing && S.v === 'cards' && can('access.call') ? `<div class="attn"><span class="dot"></span><span>${ringing === 1 ? 'שיחה אחת פעילה' : `${ringing} שיחות פעילות`}</span><span class="sp"></span><button class="btn sm ghost" onclick="set({v:'list'})">${ic('list')}הצג כרשימה</button></div>` : '';
    body = strip + (S.v === 'cards' ? `<div class="grid st">${list.map(stationCard).join('')}</div>` : S.v === 'table' && !PH() ? stationTable(list) : `<div class="rows">${list.map(stationRow).join('')}</div>`);
  }
  const chips = `<div class="chips">${PH() ? treeChip() : ''}<button class="chip on">הכול</button><button class="chip">מחוברות</button><button class="chip">דורשות תשומת לב</button><button class="chip">${ic('phone')}בשיחה</button></div>`;
  const main = `${chips}${body}`;
  return head('תחנות ודלתות', S.st === 'scoped' && S.id !== 'admin' ? `${visibleStations().length} תחנות בתחום שלך` : `${STATIONS.length} תחנות · ${STATIONS.reduce((n, s) => n + s.doors.length, 0)} דלתות`, actions) + `<div class="wk-split">${tree('stations')}<div>${main}</div></div>`;
}
function stationDrawer() {
  if (S.dr !== '1') return '';
  if (S.st === 'scoped' && S.id !== 'admin' && S.dlg === 'none' && S.sent === '2') {
    /* a direct link to a station outside the operator's scope: a calm placeholder, never partial data */
    return `<div class="scrim" onclick="set({dr:'0'})"></div><aside class="drawer" role="dialog" aria-label="תחנה"><div class="dh"><h2>תחנה</h2><button class="btn ghost icon" onclick="set({dr:'0'})">${ic('x')}</button></div><div class="db">${panel('scoped', 'התחנה אינה בתחום שלך', '')}</div></aside>`;
  }
  const s = S.callv === 'in' ? STATIONS[3] : S.callv === 'ring' ? STATIONS[0] : STATIONS[1];
  const i = STATIONS.indexOf(s);
  const tech = can('access.stations.read');
  const result = S.sent === '1' ? `<div class="result ok">${ic('check')}פתיחה נשלחה · העמדה אישרה קבלה</div>` : '';
  const callSect = can('access.call') ? `<section class="sect call"><h3>${ic('phone')}שיחה</h3>
      ${s.call === 'ringing' ? `<div class="callrow ringing big"><span class="cs">${ic('ring')}שיחה נכנסת<span class="dur">00:08</span></span><button class="btn ok">${ic('phone')}מענה</button><button class="btn danger">${ic('x')}דחייה</button></div>`
        : s.call === 'in_call' ? `<div class="callrow incall big"><span class="cs">${ic('phone')}בשיחה<span class="dur">${DUR[s.id]}</span></span><button class="btn danger">${ic('end')}סיום</button></div>${talkControl('lg')}`
        : `<div class="callrow"><span class="cs muted">אין שיחה</span><button class="btn sm" disabled>${ic('phone')}חיוג לעמדה</button></div>`}
    </section>` : (CALL[s.call] ? `<section class="sect"><h3>${ic('phone')}שיחה</h3><span class="pill ${CALL[s.call][1]}">${CALL[s.call][0]}</span></section>` : '');
  return `<div class="scrim" onclick="set({dr:'0',sent:'0'})"></div><aside class="drawer${s.call === 'ringing' ? ' ringing' : ''}" role="dialog" aria-labelledby="dr-t">
    <div class="dh"><h2 id="dr-t">${s.name}</h2><span class="pill ${s.online ? 'live' : 'off'}">${s.online ? 'מחובר' : 'לא מחובר'}</span><button class="btn ghost icon" aria-label="סגור" onclick="set({dr:'0',sent:'0'})">${ic('x')}</button></div>
    <div class="db">
      <div class="live">${s.camera ? scene(s, i) : ''}<span class="stamp">תמונה אחרונה · 08:14:07</span>
        <div class="live-ov"><span class="t">${ic('play')}שידור חי בלוח הקלאסי</span><button class="btn sm">${ic('window')}פתיחה בחלון האינטרקום</button></div></div>
      <div class="meta" style="display:flex;gap:12px;color:var(--sw-text-3);font-size:var(--sw-fs-sm)"><span>${place(s)}</span><span>נראה ${s.seen}</span></div>
      ${result}
      ${callSect}
      <section class="sect"><h3>${ic('door')}דלתות</h3>
        ${s.doors.map((d) => `<div class="doorrow"><span class="dn">${d.name}</span><span class="ds">${HOLD[`${s.id}/${d.i}`] ? `${ic('clock')}${HOLD[`${s.id}/${d.i}`]}` : 'סגורה'}</span>${can('door_authority') ? `<button class="btn sm" ${s.online ? '' : 'disabled'} onclick="set({dlg:'release'})">${ic('unlock')}פתח</button>` : ''}</div>`).join('') || '<span style="color:var(--sw-text-3)">אין דלת משויכת</span>'}
      </section>
      ${can('access.announce') ? `<section class="sect"><h3>${ic('volume')}הכרזה</h3><div class="callrow"><span class="cs muted">${S.ann === 'sent' ? 'הכרזה אחרונה נשלחה 08:02' : 'ברמקול העמדה'}</span><button class="btn sm" ${s.online ? '' : 'disabled'} onclick="set({dlg:'announce',ann:'idle'})">${ic('volume')}הכרזה</button></div></section>` : ''}
      ${tech ? `<section class="sect"><h3>${ic('sync')}טכני</h3><dl class="kv"><dt>סנכרון</dt><dd>${SYNC[s.sync][0]} · 08:11</dd><dt>דגם</dt><dd><code class="ltr">${s.model}</code></dd><dt>קושחה</dt><dd><code class="ltr">${s.fw}</code></dd><dt>ממסרים</dt><dd>${s.doors.length} · ממופים</dd><dt>שגיאה אחרונה</dt><dd style="color:var(--sw-text-3)">${s.err ? `<code class="ltr">${s.err}</code>` : 'אין'}</dd></dl></section>` : ''}
    </div>
    <div class="df">${tech ? `<button class="btn" onclick="set({s:'schedules',dr:'0'})">${ic('cal')}לוחות זמנים</button>` : ''}<button class="btn" onclick="set({s:'events',dr:'0'})">${ic('log')}פעילות התחנה</button></div>
  </aside>`;
}
function releaseDialog() {
  if (S.dlg !== 'release') return '';
  return `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="rl-t"><div class="box">
    <h2 id="rl-t">לפתוח את "כניסה" בלובי?</h2>
    <div class="acts"><button class="btn primary${FD(true)}" onclick="set({dlg:'none',sent:'1',dr:'1'})">${ic('unlock')}שלח פתיחה</button><button class="btn" onclick="set({dlg:'none'})">ביטול</button></div>
  </div></div>`;
}
const sentToast = () => (S.sent === '1' && S.dr !== '1' ? `<div class="toast" role="status">${ic('check')}פתיחה נשלחה</div>` : '');
/* the announcement (TTS) panel: text, quick phrases, targets (one station / a place / all), preview, result. Builds on the existing
   native flow (intercom/tts/engines + POST intercom/stations/{id}/tts, wiskey-overview.ts renderSpeak); many targets = one request per
   station (new, section 3.1 of the ADR). Result wording: "נשלחה", never "הושמעה". */
const PHRASES = ['נא להמתין, מישהו בדרך אליך', 'הדלת נפתחת, נא להיכנס', 'המשרד סגור, נא לחזור בשעות הפעילות', 'נא לעמוד מול המצלמה'];
function announceDialog() {
  if (S.dlg !== 'announce' || !can('access.announce')) return '';
  const st = S.ann;
  const text = PHRASES[0];
  const result = st === 'sent' ? `<div class="result ok">${ic('check')}ההכרזה נשלחה ל־3 עמדות · ההשמעה בעמדה לא מאומתת</div>`
    : st === 'rate' ? `<div class="result warn">${ic('clock')}העמדה עדיין משמיעה את ההכרזה הקודמת · אפשר לשלוח שוב בעוד 12 שניות</div>`
    : st === 'noengine' ? `<div class="result warn">${ic('info')}אין מנוע הקראה זמין</div>` : '';
  const busy = st === 'rate' || st === 'noengine';
  return `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="an-t"><div class="box wide">
    <h2 id="an-t">הכרזה</h2>
    <div class="fld"><label>לאן</label><div class="chips tight"><button class="chip on">${ic('door')}לובי</button><button class="chip">שער ראשי</button><button class="chip">${ic('pin')}קומת קרקע (3)</button><button class="chip">כל העמדות (5)</button></div></div>
    <div class="fld"><label>ההודעה</label><div class="ta" role="textbox" aria-multiline="true" tabindex="0">${text}</div><span class="cnt">${text.length}/500</span></div>
    <div class="fld"><label>ביטויים מהירים</label><div class="chips tight">${PHRASES.map((p, i) => `<button class="chip${i === 0 ? ' on' : ''}">${p}</button>`).join('')}</div></div>
    <div class="prev">${ic('volume')}<span>עברית · קול ברירת המחדל · כ־3 שניות</span><span class="sp"></span><button class="btn ghost sm">${ic('play')}האזנה</button></div>
    ${result}
    <div class="acts"><button class="btn primary" ${busy ? 'disabled' : ''} onclick="set({ann:'sent'})">${ic('volume')}${st === 'sent' ? 'שליחה נוספת' : 'שלח הכרזה'}</button><button class="btn" onclick="set({dlg:'none',ann:'none'})">${st === 'sent' ? 'סגירה' : 'ביטול'}</button></div>
  </div></div>`;
}

/* ------------------------------------------------------------------ 2. people (names only; sensitive block gated) */
function personCard(p) {
  return `<article class="wk-card person" tabindex="0" onclick="set({dr:'1'})"><div class="cb"><span class="av">${initials(p.name)}</span>
    <div class="col"><span class="name">${p.name}</span><span class="meta">${p.groups.join(' · ')} · ${p.stations.filter(inScope).length} תחנות</span><span class="meta">${p.valid}</span></div>
    <span class="pill ${PSTATE[p.state][1]}">${PSTATE[p.state][0]}</span></div></article>`;
}
/* WhatsApp: the action exists only with BOTH access.people.sensitive and access.people.message (omit, never grey). A person
   without a phone or without consent still shows the action in the drawer; the composer then explains why it cannot send. */
const canWa = () => can('access.people.sensitive') && can('access.people.message');
const waBtn = (p, size = 'sm') => (canWa() && p.phone ? `<button class="btn ${size} icon" title="שלח הודעת וואטסאפ" aria-label="שלח הודעת וואטסאפ" onclick="event.stopPropagation();set({dlg:'wa',wa:'idle'})">${ic('wa')}</button>` : '');
const SELECTED = ['p1', 'p2', 'p5'];
const selBox = (p) => (S.sel === '1' ? `<span class="cbx${SELECTED.includes(p.id) ? ' on' : ''}" role="checkbox" aria-checked="${SELECTED.includes(p.id)}" tabindex="0" onclick="event.stopPropagation()">${SELECTED.includes(p.id) ? ic('check', 2.4) : ''}</span>` : '');
function personRow(p) {
  return `<a class="row${FD(p.id === 'p1')}${S.sel === '1' && SELECTED.includes(p.id) ? ' sel' : ''}" href="#" onclick="set({dr:'1'});return false">${selBox(p)}<span class="av" style="width:36px;height:36px">${initials(p.name)}</span>
    <div class="main"><span class="t">${p.name}</span><span class="s">${p.groups.join(' · ')}</span></div>
    <span class="side hide-p">${p.stations.filter(inScope).length} תחנות</span><span class="side hide-p">${p.valid}</span><span class="pill ${PSTATE[p.state][1]}">${PSTATE[p.state][0]}</span><div class="acts">${waBtn(p)}</div>${ic('chev')}</a>`;
}
function peopleTable(list) {
  const sens = can('access.people.sensitive');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${S.sel === '1' ? '<th></th>' : ''}<th>שם</th>${sens ? '<th>מס׳ עובד</th>' : ''}<th>קבוצות</th><th>תחנות</th><th>אמצעים</th><th>תוקף</th><th>מצב</th><th><button class="btn ghost icon sm" title="עמודות">${ic('columns')}</button></th></tr></thead><tbody>
    ${list.map((p) => `<tr onclick="set({dr:'1'})" class="${S.sel === '1' && SELECTED.includes(p.id) ? 'sel' : ''}">${S.sel === '1' ? `<td>${selBox(p)}</td>` : ''}<td><b>${p.name}</b></td>${sens ? `<td class="num"><code>${p.emp}</code></td>` : ''}<td>${p.groups.join(', ')}</td><td class="num">${p.stations.filter(inScope).length}</td><td>${p.creds.map((c) => CRED[c][0]).join(', ')}</td><td>${p.valid}</td><td><span class="pill ${PSTATE[p.state][1]}">${PSTATE[p.state][0]}</span></td><td>${waBtn(p)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
/* bulk bar (secondary design): select several people, one template, preview count, one confirmation */
function bulkBar(list) {
  if (S.sel !== '1') return '';
  const n = SELECTED.filter((id) => list.some((p) => p.id === id)).length;
  return `<div class="bulk" role="toolbar" aria-label="פעולות על הנבחרים"><span class="cbx on" role="checkbox" aria-checked="mixed">${ic('check', 2.4)}</span><span class="n">${n} נבחרו</span><span class="sp"></span>
    ${canWa() ? `<button class="btn sm" onclick="set({dlg:'wabulk',wa:'idle'})">${ic('wa')}וואטסאפ לנבחרים</button>` : ''}${can('access.people.manage') ? `<button class="btn sm">${ic('tag')}קבוצה</button>` : ''}<button class="btn sm ghost" onclick="set({sel:'0'})">${ic('x')}</button></div>`;
}
const WA_TEMPLATES = ['תזכורת: תוקף הכרטיס שלך מסתיים בקרוב. נא לפנות למשרד.', 'שלום, כרטיס הכניסה החדש שלך מוכן לאיסוף.', 'הכניסה לחניון סגורה היום בין 12:00 ל־14:00.'];
const maskPhone = (ph) => ph.replace(/\d(?=\d{2}$)/g, '•').replace(/^(\d{3})/, '$1');
/* the composer: recipient by name; the phone masked until the sensitive section is revealed; state machine per S.wa */
function waDialog() {
  if (S.dlg !== 'wa' || !canWa()) return '';
  const p = PEOPLE[0]; const st = S.wa; const text = WA_TEMPLATES[0];
  const blocked = st === 'nophone' || st === 'noconsent' || st === 'noconn';
  const why = { nophone: 'אין מספר טלפון בכרטיס האדם', noconsent: 'האדם ביקש לא לקבל הודעות', noconn: 'שירות ההודעות אינו מחובר' }[st];
  const result = st === 'sending' ? `<div class="result wait">${ic('refresh')}שולח…</div>`
    : st === 'sent' ? `<div class="result ok">${ic('check')}נשלח · 08:21 · אין אישור מסירה</div>`
    : st === 'failed' ? `<div class="result err">${ic('alert')}לא נשלח · המספר אינו רשום בוואטסאפ</div>`
    : st === 'rate' ? `<div class="result warn">${ic('clock')}הגעת למכסת ההודעות לשעה · אפשר לשלוח שוב בעוד 14 דק׳</div>`
    : blocked ? `<div class="result warn">${ic('ban')}אי אפשר לשלוח · ${why}</div>` : '';
  const phone = st === 'nophone' ? '—' : `<span class="ltr">${S.f === '1' ? p.phone : maskPhone(p.phone)}</span> <button class="btn ghost sm" onclick="set({f:S.f==='1'?'0':'1'})">${ic('eye')}</button>`;
  return `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="wa-t"><div class="box wide">
    <h2 id="wa-t">${ic('wa')}הודעת וואטסאפ</h2>
    <div class="to"><span class="av">${initials(p.name)}</span><div class="col"><b>${p.name}</b><span class="muted">${phone}${st === 'noconsent' ? ' · <span class="pill warn plain">ביקש לא לקבל</span>' : ' · <span class="pill ok plain">הסכמה</span>'}</span></div></div>
    <div class="fld"><label>תבנית</label><div class="chips tight">${WA_TEMPLATES.map((t, i) => `<button class="chip${i === 0 ? ' on' : ''}">${t.slice(0, 26)}…</button>`).join('')}<button class="chip">חופשי</button></div></div>
    <div class="fld"><label>ההודעה</label><div class="ta" role="textbox" aria-multiline="true" tabindex="0" ${blocked ? 'aria-disabled="true"' : ''}>${text}</div><span class="cnt">${text.length}/1000</span></div>
    ${result}
    <div class="acts"><button class="btn primary" ${blocked || st === 'sending' || st === 'rate' ? 'disabled' : ''} onclick="set({wa:'sending'})">${ic('send')}${st === 'sent' ? 'שליחה נוספת' : 'שלח'}</button><button class="btn" onclick="set({dlg:'none',wa:'idle'})">${st === 'sent' ? 'סגירה' : 'ביטול'}</button></div>
  </div></div>`;
}
function waBulkDialog() {
  if (S.dlg !== 'wabulk' || !canWa()) return '';
  const st = S.wa; const text = WA_TEMPLATES[0];
  const result = st === 'sent' ? `<div class="result ok">${ic('check')}נשלח ל־2 · 1 לא נשלח (אין טלפון)</div>` : st === 'sending' ? `<div class="result wait">${ic('refresh')}שולח 2 מתוך 3…</div>` : '';
  return `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="wb-t"><div class="box wide">
    <h2 id="wb-t">${ic('wa')}הודעת וואטסאפ ל־3 אנשים</h2>
    <div class="fld"><label>תבנית אחת לכולם</label><div class="chips tight">${WA_TEMPLATES.map((t, i) => `<button class="chip${i === 0 ? ' on' : ''}">${t.slice(0, 26)}…</button>`).join('')}</div></div>
    <div class="fld"><label>ההודעה</label><div class="ta" role="textbox" aria-multiline="true" tabindex="0">${text}</div><span class="cnt">${text.length}/1000</span></div>
    <div class="prev">${ic('users')}<span>יישלח ל־2 · לא יישלח ל־1: אלי פרץ (אין טלפון)</span></div>
    ${result}
    <div class="acts"><button class="btn primary" ${st === 'sending' ? 'disabled' : ''} onclick="set({wa:'sending'})">${ic('send')}${st === 'sent' ? 'סגירה' : 'שלח ל־2'}</button><button class="btn" onclick="set({dlg:'none',wa:'idle',sel:'0'})">ביטול</button></div>
  </div></div>`;
}
function peopleScreen() {
  if (!can('access.people.read')) return head('אנשים', '', '', false) + FORBIDDEN;
  const list = visiblePeople();
  const actions = `<span class="search">${ic('search')}חיפוש לפי שם${can('access.people.sensitive') ? ' או מס׳ עובד' : ''}</span>${can('access.people.manage') ? `<button class="btn primary">${ic('user')}<span class="hide-p">הוספת אדם</span></button>` : ''}`;
  const chips = `<div class="chips">${PH() ? treeChip() : ''}<button class="chip">${ic('tag')}קבוצה${ic('down')}</button><button class="chip">${ic('door')}תחנה${ic('down')}</button><button class="chip on">פעילים</button><button class="chip">פג בקרוב</button><button class="chip">${ic('card')}אמצעי${ic('down')}</button></div>`;
  let body;
  if (S.st === 'loading') body = skRows();
  else if (S.st === 'empty') body = panel('empty', 'לא נמצאו אנשים', 'נסו מסנן אחר');
  else if (S.st === 'error') body = panel('error', 'לא ניתן לטעון את רשימת האנשים', '', `<button class="btn">${ic('refresh')}נסה שוב</button>`);
  else body = bulkBar(list) + (S.v === 'cards' ? `<div class="grid">${list.map(personCard).join('')}</div>` : S.v === 'table' && !PH() ? peopleTable(list) : `<div class="rows">${list.map(personRow).join('')}</div><div class="more"><button class="btn">עוד 40</button></div>`);
  return head('אנשים', `${S.st === 'scoped' && S.id !== 'admin' ? list.length : 48} אנשים`, actions + (S.v !== 'cards' && S.st === 'ready' ? `<button class="btn icon" title="בחירה מרובה" aria-pressed="${S.sel === '1'}" onclick="set({sel:S.sel==='1'?'0':'1'})">${ic('checkbox')}</button>` : '')) + chips + body;
}
function personDrawer() {
  if (S.dr !== '1') return '';
  const p = PEOPLE[0];
  const sens = can('access.people.sensitive');
  const sensBlock = sens ? `<section class="sect sens" aria-label="פרטים רגישים"><h3>${ic('lock')}פרטים רגישים</h3>
      <div style="display:flex;gap:14px;align-items:center"><span class="av lg photo">${initials(p.name)}</span><dl class="kv" style="flex:1"><dt>מס׳ עובד</dt><dd><code class="ltr">${p.emp}</code></dd><dt>טלפון</dt><dd><span class="ltr">${p.phone}</span></dd><dt>דוא״ל</dt><dd><span class="ltr">${p.mail}</span></dd></dl></div></section>` : '';
  return `<div class="scrim" onclick="set({dr:'0'})"></div><aside class="drawer" role="dialog" aria-labelledby="pd-t">
    <div class="dh"><span class="av">${initials(p.name)}</span><h2 id="pd-t">${p.name}</h2><span class="pill ok">פעיל</span><button class="btn ghost icon" aria-label="סגור" onclick="set({dr:'0'})">${ic('x')}</button></div>
    <div class="db">
      <div class="dtabs" role="tablist"><span class="on" role="tab">פרטים</span><span role="tab">גישה</span><span role="tab">קבוצות</span></div>
      <section class="sect"><h3>${ic('user')}פרטים</h3><dl class="kv"><dt>קבוצות</dt><dd>${p.groups.join(', ')}</dd><dt>תוקף</dt><dd>${p.valid}</dd><dt>שעות גישה</dt><dd>כל היום</dd><dt>אמצעים</dt><dd>${p.creds.map((c) => CRED[c][0]).join(', ')}</dd></dl></section>
      ${sensBlock}
      <section class="sect"><h3>${ic('door')}גישה לתחנות</h3>
        ${p.stations.filter(inScope).map((id) => { const s = stationOf(id); return `<div style="display:flex;align-items:center;gap:10px"><span class="st" style="width:8px;height:8px;border-radius:50%;background:var(--sw-${s.online ? 'live' : 'offline'})"></span><span style="flex:1">${s.name}</span><span class="pill ${SYNC[s.sync][1]} plain">${SYNC[s.sync][0]}</span></div>`; }).join('')}
      </section>
      ${canWa() ? `<section class="sect"><h3>${ic('wa')}הודעות</h3>
        <div class="hist"><span class="ltr num">08:21</span><span>תזכורת תוקף · נשלח ע״י מיכל אברהם · היום</span><span class="pill ok plain">נשלח</span></div>
        <div class="hist"><span class="ltr num">02.10</span><span>כרטיס מוכן לאיסוף · נשלח ע״י רונית גל</span><span class="pill ok plain">נשלח</span></div>
        <div class="hist"><span class="ltr num">28.09</span><span>תזכורת תוקף · נשלח ע״י מיכל אברהם</span><span class="pill err plain">לא נשלח</span></div>
      </section>` : ''}
    </div>
    ${can('access.people.manage') || canWa() ? `<div class="df">${canWa() ? `<button class="btn${FD(true)}" onclick="set({dlg:'wa',wa:'idle'})">${ic('wa')}שלח הודעת וואטסאפ</button>` : ''}${can('access.people.manage') ? `<button class="btn">${ic('card')}הקצאת כרטיס</button><button class="btn primary">עריכה</button>` : ''}</div>` : ''}
  </aside>`;
}

/* ------------------------------------------------------------------ 3. events */
function eventRow(e) {
  const r = RESULT[e.result]; const c = CRED[e.how]; const s = stationOf(e.station);
  return `<a class="row${FD(e.id === 'e1')}" href="#" onclick="set({dr:'1'});return false"><span class="time num">${e.time}</span><span class="st ${r[1] === 'ok' ? '' : r[1] === 'err' ? 'err' : r[1] === 'acc' ? 'warn' : r[1] === 'off' ? 'off' : 'unk'}"></span>
    <div class="main"><span class="t">${e.person || (e.result === 'call' ? 'שיחה מהעמדה' : e.result === 'sent' ? 'פתיחה מהמסך' : 'לא זוהה')}</span><span class="s">${s.name}${e.door ? ` · ${e.door}` : ''} · ${c[0]}</span></div>
    <span class="pill ${r[1]}">${r[0]}</span>${ic('chev')}</a>`;
}
function eventsTable(list) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>זמן</th><th>תוצאה</th><th>אדם</th><th>תחנה</th><th>דלת</th><th>אמצעי</th><th></th></tr></thead><tbody>
    ${list.map((e) => { const r = RESULT[e.result]; return `<tr onclick="set({dr:'1'})"><td class="num">${e.day} ${e.time}</td><td><span class="pill ${r[1]}">${r[0]}</span></td><td>${e.person ? `<b>${e.person}</b>` : '<span class="muted">לא זוהה</span>'}</td><td>${stationOf(e.station).name}</td><td>${e.door || '<span class="muted">—</span>'}</td><td>${CRED[e.how][0]}</td><td></td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function eventsScreen() {
  if (!can('access.events.read')) return head('פעילות', '', '', false) + FORBIDDEN;
  const list = visibleEvents();
  const actions = `<span class="search">${ic('search')}חיפוש</span>${can('access.events.export') ? `<button class="btn" onclick="set({dlg:'export'})">${ic('export')}<span class="hide-p">ייצוא</span></button>` : ''}`;
  const chips = `<div class="chips">${PH() ? treeChip() : ''}<button class="chip on">${ic('cal')}היום</button><button class="chip">${ic('door')}תחנה${ic('down')}</button><button class="chip">תוצאה${ic('down')}</button><button class="chip">${ic('card')}אמצעי${ic('down')}</button><button class="chip">${ic('user')}אדם${ic('down')}</button></div>`;
  let body;
  if (S.st === 'loading') body = skRows(10);
  else if (S.st === 'empty') body = panel('empty', 'אין פעילות בטווח הזה', '');
  else if (S.st === 'error') body = panel('error', 'לא ניתן לטעון את הפעילות', 'הניסיון חוזר אוטומטית', `<button class="btn">${ic('refresh')}נסה שוב</button>`);
  else if (S.v === 'table' && !PH()) body = eventsTable(list);
  else {
    const days = [...new Set(list.map((e) => e.day))];
    body = `<div class="rows">${days.map((d) => `<div class="row grp">${d}</div>${list.filter((e) => e.day === d).map(eventRow).join('')}`).join('')}</div><div class="more"><button class="btn">טען עוד</button></div>`;
  }
  const kpis = PH() || S.st !== 'ready' ? '' : `<div class="kpis"><div class="kpi"><div class="l">היום</div><div class="v">184</div></div><div class="kpi"><div class="l">אושרו</div><div class="v">171</div></div><div class="kpi warn"><div class="l">נדחו</div><div class="v">11</div></div><div class="kpi"><div class="l">שיחות</div><div class="v">2</div></div></div>`;
  const main = `${chips}${kpis}${body}`;
  return head('פעילות', S.st === 'ready' ? 'עודכן עכשיו' : '', actions) + (PH() ? main : `<div class="wk-split">${tree('stations')}<div>${main}</div></div>`);
}
function eventDrawer() {
  if (S.dr !== '1') return '';
  const e = EVENTS[0]; const s = stationOf(e.station);
  const portrait = can('access.people.sensitive') ? `<section class="sect sens"><h3>${ic('lock')}תמונה מהאירוע</h3><div class="still${S.t === 'dark' ? ' dark' : ''}" style="aspect-ratio:4/3;border-radius:var(--sw-r-sm);display:grid;place-items:center;background:linear-gradient(135deg,var(--sw-surface-3),var(--sw-surface-2));color:var(--sw-text-3)">${ic('user')}</div></section>` : '';
  return `<div class="scrim" onclick="set({dr:'0'})"></div><aside class="drawer" role="dialog" aria-labelledby="ev-t">
    <div class="dh"><h2 id="ev-t">${e.person}</h2><span class="pill ok">אושר</span><button class="btn ghost icon" aria-label="סגור" onclick="set({dr:'0'})">${ic('x')}</button></div>
    <div class="db">
      <section class="sect"><h3>${ic('log')}אירוע</h3><dl class="kv"><dt>זמן</dt><dd class="num">היום 08:14:07</dd><dt>תחנה</dt><dd>${s.name} · ${place(s)}</dd><dt>דלת</dt><dd>${e.door}</dd><dt>אמצעי</dt><dd>${CRED[e.how][0]}</dd><dt>מקור הזמן</dt><dd>העמדה</dd></dl></section>
      ${portrait}
      <section class="sect"><h3>${ic('user')}אדם</h3><dl class="kv"><dt>שם</dt><dd>${e.person}</dd><dt>קבוצות</dt><dd>עובדים, מעבדה</dd></dl></section>
    </div>
    <div class="df"><button class="btn" onclick="set({s:'people',dr:'1'})">${ic('user')}לכרטיס האדם</button><button class="btn" onclick="set({s:'stations',dr:'1'})">${ic('door')}לתחנה</button></div>
  </aside>`;
}
function exportDialog() {
  if (S.dlg !== 'export') return '';
  return `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="ex-t"><div class="box">
    <h2 id="ex-t">ייצוא פעילות</h2>
    <p>1,284 אירועים לפי המסננים הנוכחיים · קובץ CSV · ללא תמונות</p>
    <p>הייצוא נרשם ביומן הפעולות.</p>
    <div class="acts"><button class="btn primary" onclick="set({dlg:'none'})">${ic('export')}ייצוא</button><button class="btn" onclick="set({dlg:'none'})">ביטול</button></div>
  </div></div>`;
}

/* ------------------------------------------------------------------ 4. door schedules and programs (read-only) */
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
/* hold-open windows of the selected door (fake): [day index, start hour, end hour, kind] */
const WINDOWS = [[0, 7, 9, 'hold'], [1, 7, 9, 'hold'], [2, 7, 9, 'hold'], [3, 7, 9, 'hold'], [4, 7, 9, 'hold'], [0, 12, 13, 'prog'], [1, 12, 13, 'prog'], [2, 12, 13, 'prog'], [3, 12, 13, 'prog'], [4, 12, 13, 'prog'], [5, 8, 12, 'hol']];
const PROGRAMS = [
  { name: 'בוקר - פתוח קבוע', kind: 'פתוח קבוע', when: 'א׳-ה׳ 07:00-09:00', state: 'active' },
  { name: 'הפסקת צהריים', kind: 'לפי לוח', when: 'א׳-ה׳ 12:00-13:00', state: 'active' },
  { name: 'ערב שישי', kind: 'חג / מיוחד', when: 'ו׳ 08:00-12:00', state: 'pending' },
  { name: 'סגירת לילה', kind: 'נעול', when: 'כל יום 22:00-06:00', state: 'active' },
];
const DEVSCHED = [
  { name: 'לוח עובדים רגיל', ver: 'v12', deployed: 'כל התחנות', state: 'active' },
  { name: 'לוח קבלנים', ver: 'v4', deployed: '2 מתוך 3 תחנות', state: 'pending' },
  { name: 'לוח חגים 2026', ver: 'v2', deployed: 'הנהלה', state: 'error' },
];
const SSTATE = { active: ['פעיל', 'ok'], pending: ['ממתין', 'warn'], error: ['שגיאה', 'err'], unknown: ['לא ידוע', 'unk'] };
function weekGrid() {
  const H0 = 6, H1 = 23, span = H1 - H0;
  const pos = (h) => `${((h - H0) / span) * 100}%`;
  const hours = [6, 9, 12, 15, 18, 21].map((h) => `<span style="top:${pos(h)}">${String(h).padStart(2, '0')}</span>`).join('');
  const cols = DAYS.map((d, i) => `<div class="col" role="gridcell" aria-label="${d}">${[9, 12, 15, 18, 21].map((h) => `<i class="hr" style="top:${pos(h)}"></i>`).join('')}${WINDOWS.filter((w) => w[0] === i).map((w) => `<div class="win ${w[3]}" style="top:${pos(w[1])};height:calc(${((w[2] - w[1]) / span) * 100}% - 2px)">${String(w[1]).padStart(2, '0')}-${String(w[2]).padStart(2, '0')}</div>`).join('')}</div>`).join('');
  return `<div class="week" role="grid" aria-label="שבוע"><div></div>${DAYS.map((d) => `<div class="dh">${d}</div>`).join('')}<div class="hours">${hours}</div>${cols}</div>
    <div class="legend"><span><i style="background:var(--sw-accent)"></i>פתוח קבוע</span><span><i style="background:var(--sw-success)"></i>לפי לוח</span><span><i style="background:var(--sw-warning)"></i>חג / מיוחד</span></div>`;
}
function schedulesScreen() {
  if (!can('access.stations.read')) return head('לוחות זמנים', '', '', false) + FORBIDDEN;
  const edit = can('settings') ? `<button class="btn">${ic('window')}<span class="hide-p">עריכה בחלון האינטרקום</span></button>` : '';
  let main;
  if (S.st === 'loading') main = `<div class="sk" style="height:300px;border-radius:var(--sw-r-md)"></div><div class="two">${skRows(3)}${skRows(3)}</div>`;
  else if (S.st === 'empty') main = panel('empty', 'לדלת הזאת אין לוחות זמנים', '');
  else if (S.st === 'error') main = panel('error', 'לא ניתן לטעון את לוחות הזמנים', 'הניסיון חוזר אוטומטית', `<button class="btn">${ic('refresh')}נסה שוב</button>`);
  else if (S.v === 'table' && !PH()) {
    main = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>דלת</th><th>תחנה</th><th>תוכנית</th><th>סוג</th><th>מתי</th><th>מצב</th><th>קוד ציבורי</th></tr></thead><tbody>
      ${visibleStations().flatMap((s) => s.doors.flatMap((d) => PROGRAMS.slice(0, s.id === 'lobby' ? 4 : 2).map((p) => `<tr><td><b>${d.name}</b></td><td>${s.name}</td><td>${p.name}</td><td>${p.kind}</td><td class="num">${p.when}</td><td><span class="pill ${SSTATE[p.state][1]}">${SSTATE[p.state][0]}</span></td><td>${s.id === 'lobby' ? 'מוגדר' : '<span class="muted">לא מוגדר</span>'}</td></tr>`))).join('')}
    </tbody></table></div>`;
  } else {
    const progRows = PROGRAMS.map((p) => `<div class="row"><span class="st ${SSTATE[p.state][1] === 'ok' ? '' : SSTATE[p.state][1]}"></span><div class="main"><span class="t">${p.name}</span><span class="s">${p.kind} · ${p.when}</span></div><span class="pill ${SSTATE[p.state][1]}">${SSTATE[p.state][0]}</span></div>`).join('');
    const devRows = DEVSCHED.map((p) => `<div class="row"><span class="st ${SSTATE[p.state][1] === 'ok' ? '' : SSTATE[p.state][1]}"></span><div class="main"><span class="t">${p.name} <span class="muted" style="color:var(--sw-text-3);font-weight:400">${p.ver}</span></span><span class="s">${p.deployed}</span></div><span class="pill ${SSTATE[p.state][1]}">${SSTATE[p.state][0]}</span></div>`).join('');
    main = `<div class="sec-h" style="margin-top:0"><h2>כניסה · לובי</h2><span class="sub">קומת קרקע</span><span class="sp"></span><span class="pill acc plain">${ic('key')}קוד ציבורי: מוגדר</span></div>
      ${weekGrid()}
      <div class="two"><div class="block"><div class="bh"><h2>תוכניות הדלת</h2><span class="sub">${PROGRAMS.length}</span></div><div class="rows">${progRows}</div></div>
      <div class="block"><div class="bh"><h2>לוחות זמנים במכשיר</h2><span class="sub">${DEVSCHED.length}</span></div><div class="rows">${devRows}</div></div></div>`;
  }
  const chips = PH() ? `<div class="chips"><button class="chip on">${ic('door')}כניסה · לובי${ic('down')}</button><button class="chip">השבוע</button></div>` : '';
  const views = `<div class="seg" role="group" aria-label="תצוגה"><button aria-pressed="${S.v !== 'table'}" onclick="set({v:'cards'})" title="דלת">${ic('cal')}</button>${PH() ? '' : `<button aria-pressed="${S.v === 'table'}" onclick="set({v:'table'})" title="טבלה">${ic('table')}</button>`}</div>`;
  return head('לוחות זמנים', 'תוכניות דלת ולוחות זמנים של העמדות · לצפייה', edit + views, false) + (PH() ? chips + main : `<div class="wk-split">${tree('doors', 'lobby/1')}<div>${main}</div></div>`);
}

/* ------------------------------------------------------------------ 5. settings: access-control status (admins) */
const SUBS = [['status', 'מצב מערכת'], ['audit', 'יומן האינטרקום'], ['groups', 'קבוצות ושדות'], ['view', 'תצוגה']];
const ALERTS = [
  { sev: 'err', t: 'הנהלה: סנכרון נכשל', s: 'התנגשות גרסה של משתמש 2044 · לפני 12 דק׳' },
  { sev: 'warn', t: 'מחסן: העמדה לא מחוברת', s: 'מאז אתמול 19:02' },
  { sev: 'warn', t: 'חניון: 3 משתמשים ממתינים לסנכרון', s: 'לפני 4 דק׳' },
  { sev: 'ok', t: 'השעון של כל העמדות מסונכרן', s: 'סטייה מרבית 0.8 שניות' },
];
const AUDIT = [
  ['היום 08:11', 'Arx (שירות)', 'פתיחת דלת', 'לובי · כניסה', 'נשלח'],
  ['היום 07:55', 'מנהל (חלון האינטרקום)', 'עדכון אדם', 'נועה בר', 'בוצע'],
  ['היום 07:40', 'Arx (שירות)', 'ייצוא פעילות', '1,284 שורות', 'בוצע'],
  ['אתמול 18:20', 'מנהל (חלון האינטרקום)', 'שמירת תוכנית דלת', 'מעבדה · ערב שישי', 'בוצע'],
  ['אתמול 16:02', 'מערכת', 'סנכרון מתוזמן', 'כל העמדות', 'הושלם'],
  ['אתמול 12:00', 'מנהל (חלון האינטרקום)', 'יצירת קבוצה', 'קבלנים', 'בוצע'],
];
const GROUPS = [['עובדים', 31, 'כל התחנות למעט הנהלה'], ['מעבדה', 6, 'מעבדה'], ['הנהלה', 4, 'כל התחנות'], ['קבלנים', 3, 'חניון, מחסן'], ['ניקיון', 2, 'לובי, מחסן'], ['אורחים', 2, 'לובי בלבד · יום אחד']];
const FIELDS = [['מחלקה', 'בחירה', 'חובה'], ['חברה', 'טקסט', 'רשות'], ['מספר רכב', 'טקסט', 'רשות'], ['תוקף אישור בטיחות', 'תאריך', 'רשות']];
const SCREENS_VIEW = [['מרכז הכניסה', 'Arx', 'אושר 03.10'], ['תחנות ודלתות', 'Arx', 'ממתין לבדיקה'], ['אנשים', 'חלון האינטרקום', 'ממתין לבדיקה'], ['פעילות', 'Arx', 'אושר 03.10'], ['לוחות זמנים', 'חלון האינטרקום', 'ממתין לבדיקה']];
function settingsScreen() {
  if (!can('access.admin.read')) return head('בקרת כניסה', '', '', false) + FORBIDDEN;
  const nav = `<nav class="set-nav" aria-label="בקרת כניסה">${SUBS.map(([id, l]) => `<a class="${S.sub === id ? 'on' : ''}" href="#" onclick="set({sub:'${id}'});return false">${l}</a>`).join('')}</nav>`;
  let body;
  if (S.st === 'loading') body = `<div class="set-grid">${skRows(4)}${skRows(4)}</div>`;
  else if (S.st === 'error') body = panel('error', 'אין חיבור לאינטגרציית האינטרקום', 'WisKey לא ענה. הנתונים האחרונים נשמרו.', `<button class="btn">${ic('refresh')}נסה שוב</button>`);
  else if (S.sub === 'status') body = statusSub();
  else if (S.sub === 'audit') body = auditSub();
  else if (S.sub === 'groups') body = groupsSub();
  else body = viewSub();
  return head('בקרת כניסה', 'WisKey 4.37 · מחובר דרך תשתית המערכת · נבדק לפני 20 שניות', `<button class="btn">${ic('refresh')}רענון</button>`, false) + nav + body;
}
function statusSub() {
  const healthRows = STATIONS.map((s) => `<div class="row"><span class="st${s.online ? '' : ' off'}"></span><div class="main"><span class="t">${s.name}</span><span class="s">${place(s)} · <span class="ltr">${s.model} ${s.fw}</span></span></div><span class="side hide-p">${s.seen}</span><span class="pill ${SYNC[s.sync][1]} plain">${SYNC[s.sync][0]}</span></div>`).join('');
  return `<div class="kpis"><div class="kpi"><div class="l">תחנות מחוברות</div><div class="v">5<small>מתוך 6</small></div></div><div class="kpi warn"><div class="l">ממתינים לסנכרון</div><div class="v">4</div></div><div class="kpi err"><div class="l">התנגשויות</div><div class="v">1</div></div><div class="kpi"><div class="l">סנכרון אחרון</div><div class="v">08:11</div></div></div>
  <div class="set-grid">
    <div class="block"><div class="bh"><h2>תקינות העמדות</h2><span class="sub">health/get</span></div><div class="rows">${healthRows}</div></div>
    <div class="block"><div class="bh"><h2>התרעות</h2><span class="sub">fleet/alerts · ${ALERTS.length}</span></div><div class="rows">${ALERTS.map((a) => `<div class="row"><span class="st ${a.sev === 'ok' ? '' : a.sev}"></span><div class="main"><span class="t">${a.t}</span><span class="s">${a.s}</span></div></div>`).join('')}</div></div>
    <div class="block wide"><div class="bh"><h2>סנכרון</h2><span class="sub">sync/status · ספירות בלבד, בלי פרטי אנשים</span></div>
      <div class="tbl-wrap"><table class="tbl" style="border:0;border-radius:0;box-shadow:none"><thead><tr><th>תחנה</th><th>משתמשים במכשיר</th><th>ממתינים</th><th>להסרה</th><th>התנגשויות</th><th>סנכרון אחרון</th><th>מצב</th></tr></thead><tbody>
      ${STATIONS.map((s) => `<tr><td><b>${s.name}</b></td><td class="num">${s.online ? 42 - (s.id === 'mgmt' ? 38 : 0) : '—'}</td><td class="num">${s.pending || '—'}</td><td class="num">${s.id === 'park' ? 1 : '—'}</td><td class="num">${s.id === 'mgmt' ? 1 : '—'}</td><td class="num">${s.online ? '08:11' : 'אתמול 19:02'}</td><td><span class="pill ${SYNC[s.sync][1]} plain">${SYNC[s.sync][0]}</span></td></tr>`).join('')}
      </tbody></table></div></div>
  </div>`;
}
function auditSub() {
  return `<div class="block"><div class="bh"><h2>פעולות שנעשו בחלון האינטרקום</h2><span class="sub">audit/list · לצפייה בלבד · פעולות שנעשו מ־Arx מתועדות ביומן של Arx</span></div>
    <div class="tbl-wrap"><table class="tbl" style="border:0;border-radius:0;box-shadow:none"><thead><tr><th>זמן</th><th>משתמש</th><th>פעולה</th><th>יעד</th><th>תוצאה</th></tr></thead><tbody>
    ${AUDIT.map((r) => `<tr><td class="num">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[4] === 'נשלח' ? 'acc' : 'ok'} plain">${r[4]}</span></td></tr>`).join('')}
    </tbody></table></div><div class="more"><button class="btn">טען עוד</button></div></div>`;
}
function groupsSub() {
  return `<div class="set-grid">
    <div class="block"><div class="bh"><h2>קבוצות</h2><span class="sub">profiles/settings_get · לצפייה</span><button class="btn sm">${ic('window')}עריכה בחלון האינטרקום</button></div>
      <div class="rows">${GROUPS.map(([n, c, s]) => `<div class="row"><span class="av" style="width:34px;height:34px;font-size:var(--sw-fs-xs)">${c}</span><div class="main"><span class="t">${n}</span><span class="s">${s}</span></div><span class="side">${c} אנשים</span></div>`).join('')}</div></div>
    <div class="block"><div class="bh"><h2>שדות פרופיל</h2><span class="sub">${FIELDS.length} שדות</span></div>
      <div class="tbl-wrap"><table class="tbl" style="border:0;border-radius:0;box-shadow:none"><thead><tr><th>שדה</th><th>סוג</th><th>חובה</th></tr></thead><tbody>${FIELDS.map((f) => `<tr><td><b>${f[0]}</b></td><td>${f[1]}</td><td>${f[2]}</td></tr>`).join('')}</tbody></table></div></div>
  </div>`;
}
function viewSub() {
  return `<div class="block"><div class="bh"><h2>תצוגת המסכים</h2><span class="sub">access.ui.* · לכל המשתמשים · מסך עובר ל־Arx אחרי אישור הבדיקה המקבילה</span></div>
    <div class="rows">${SCREENS_VIEW.map(([n, cur, ver], i) => `<div class="row"><div class="main"><span class="t">${n}</span><span class="s">${ver}</span></div><span class="side hide-p">${cur}</span><span class="toggle${cur === 'Arx' ? ' on' : ''}" role="switch" aria-checked="${cur === 'Arx'}" aria-label="מסך Arx"></span></div>`).join('')}</div>
    <div class="bb" style="color:var(--sw-text-3);font-size:var(--sw-fs-sm)">מופעל = מסך Arx · כבוי = חלון האינטרקום (המסך הקלאסי של WisKey בתוך Arx)</div></div>`;
}

/* ------------------------------------------------------------------ gallery bar + render */
const OPT = {
  s: [['stations', 'תחנות ודלתות'], ['people', 'אנשים'], ['events', 'פעילות'], ['schedules', 'לוחות זמנים'], ['settings', 'הגדרות: מצב']],
  d: [['desktop', '1440'], ['tablet', '820'], ['phone', '390']],
  t: [['light', 'בהיר'], ['dark', 'כהה']],
  k: [['classic', 'classic'], ['crystal', 'crystal'], ['domus', 'domus'], ['tesla', 'tesla'], ['bubble', 'bubble']],
  v: [['cards', 'כרטיסים'], ['list', 'רשימה'], ['table', 'טבלה']],
  st: [['ready', 'מוכן'], ['loading', 'טוען'], ['empty', 'ריק'], ['error', 'שגיאה'], ['scoped', 'תחום חלקי'], ['stale', 'לא עדכני']],
  id: [['admin', 'מנהל אתר'], ['operator', 'מפעיל'], ['viewer', 'צופה']],
  dr: [['0', 'סגור'], ['1', 'פתוח']],
  dlg: [['none', '—'], ['release', 'פתיחה'], ['export', 'ייצוא'], ['switch', 'החלפת תצוגה'], ['announce', 'הכרזה'], ['wa', 'וואטסאפ'], ['wabulk', 'וואטסאפ מרובה']],
  callv: [['none', 'לובי'], ['ring', 'שער: מצלצל'], ['in', 'מעבדה: בשיחה']],
  talk: [['unavail', 'בלוח הקלאסי'], ['idle', 'מוכן'], ['req', 'מבקש הרשאה'], ['live', 'מדבר'], ['muted', 'מושתק']],
  ann: [['idle', 'עריכה'], ['sent', 'נשלחה'], ['rate', 'ממתין'], ['noengine', 'אין מנוע']],
  wa: [['idle', 'עריכה'], ['sending', 'שולח'], ['sent', 'נשלח'], ['failed', 'נכשל'], ['rate', 'מוגבל'], ['nophone', 'אין טלפון'], ['noconsent', 'אין הסכמה'], ['noconn', 'לא מחובר']],
};
const LBL = { s: 'מסך', d: 'רוחב', t: 'ערכה', k: 'סקין', v: 'תצוגה', st: 'מצב', id: 'זהות', dr: 'פרטים', dlg: 'דיאלוג', callv: 'מגירת תחנה', talk: 'דיבור', ann: 'הכרזה', wa: 'וואטסאפ' };
function bar() {
  const grp = (k) => `<span class="g-grp"><span class="g-l">${LBL[k]}</span>${OPT[k].map(([v, l]) => `<button aria-pressed="${S[k] === v}" onclick="set({${k}:'${v}'})">${l}</button>`).join('')}</span>`;
  return `<b>Arx · מסכי בקרת הכניסה</b>${Object.keys(OPT).map(grp).join('')}<span class="g-grp"><span class="g-l">עוד</span><button aria-pressed="${S.sel === '1'}" onclick="set({sel:S.sel==='1'?'0':'1'})">בחירה מרובה</button><button aria-pressed="${S.pop === '1'}" onclick="set({pop:S.pop==='1'?'0':'1'})">תפריט תצוגה</button><button aria-pressed="${S.f === '1'}" onclick="set({f:S.f==='1'?'0':'1'})">פוקוס מקלדת</button><button aria-pressed="${S.sent === '1'}" onclick="set({sent:S.sent==='1'?'0':'1'})">אחרי פתיחה</button></span>`;
}
function render() {
  writeHash();
  document.body.dataset.gal = S.t;
  document.getElementById('bar').innerHTML = bar();
  let body = '', overlays = '';
  if (S.st === 'forbidden') body = head(TITLES[S.s], '', '', false) + FORBIDDEN;
  else if (S.s === 'stations') { body = stationsScreen(); overlays = stationDrawer() + releaseDialog() + announceDialog() + sentToast(); }
  else if (S.s === 'people') { body = peopleScreen(); overlays = can('access.people.read') ? personDrawer() + waDialog() + waBulkDialog() : ''; }
  else if (S.s === 'events') { body = eventsScreen(); overlays = can('access.events.read') ? eventDrawer() + exportDialog() : ''; }
  else if (S.s === 'schedules') body = schedulesScreen();
  else body = settingsScreen();
  overlays += switchPop() + switchDialog();
  document.getElementById('stage').innerHTML = `<div class="g-frame" data-d="${S.d}" data-skin="${S.k}" data-theme="${S.t}">${shell(body, overlays)}</div>`;
  document.title = `Arx – ${TITLES[S.s]} (${S.d}, ${S.t}, ${S.k})`;
}
window.addEventListener('hashchange', () => { readHash(); render(); });
readHash();
render();
