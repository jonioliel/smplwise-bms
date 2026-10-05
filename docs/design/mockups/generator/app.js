/* Generator control (GEN1) - static mockup gallery. Fake data only: an invented site, an invented controller, invented
   values. Nothing here touches a device or the system infrastructure. State lives in the URL hash so every view has a link:
   #s=<screen>&d=desktop|tablet|phone&t=light|dark&k=classic|domus|tesla|bubble
   Not product code: the real screens are built after the owner approves this mockup. */
'use strict';

/* ------------------------------------------------------------------ state */
const S = { s: 'live', d: 'desktop', t: 'light', k: 'classic' };
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  for (const k of Object.keys(S)) if (h.get(k)) S[k] = h.get(k);
}
function writeHash() {
  const h = new URLSearchParams();
  for (const [k, v] of Object.entries(S)) h.set(k, v);
  history.replaceState(null, '', '#' + h.toString());
}
function go(s) { S.s = s; render(); window.scrollTo(0, 0); }
window.go = go;
const PH = () => S.d === 'phone';

/* ------------------------------------------------------------------ helpers */
const N = (s) => `<span class="num">${s}</span>`;
const f1 = (x) => Number(x).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = (x) => Number(x).toLocaleString('en-US', { maximumFractionDigits: 0 });
const I = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', media: 'M3 5h18v12H3zM8 21h8', door: 'M6 3h12v18H6zM14 12h1',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5', more: 'M5 12h.01M12 12h.01M19 12h.01', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', check: 'M4 12l5 5L20 7', x: 'M6 6l12 12M18 6L6 18',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 4h14l2 9v7H3v-7z', phone: 'M7 2h10v20H7zM11 18h2', mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  chat: 'M4 4h16v12H8l-4 4z', refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  wrench: 'M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9zM3 21l3-3', power: 'M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0',
  engine: 'M3 10h3l2-3h6l2 3h5v7h-5l-2 3H8l-2-3H3zM9 13h6', fuel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h10M6 7h6M14 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3',
  battery: 'M3 8h15v8H3zM18 10h3v4h-3M6 11v2M9 11v2', temp: 'M10 4a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0zM12 9v8', oil: 'M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z',
  grid: 'M12 2v20M5 22l7-20 7 20M7 10h10M5 16h14', ats: 'M4 12h5M15 12h5M9 12l6-5', load: 'M4 21V9l8-6 8 6v12zM10 21v-6h4v6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6', users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c1-4 3.5-6 7-6s6 2 7 6M16 4a4 4 0 0 1 0 8M22 21c-.5-3-2-5-5-5.5',
  moon: 'M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z', up: 'M12 19V5M5 12l7-7 7 7', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v.5M12 11v6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', dots: 'M12 5h.01M12 12h.01M12 19h.01', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  play: 'M7 4l12 8-12 8z', stop: 'M6 6h12v12H6z', pin: 'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
};
const ic = (n, sw = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${I[n]}"/></svg>`;

/* ------------------------------------------------------------------ fake data (ASSUMPTION: generic genset controller catalogue, see index.html) */
const GEN = { name: 'גנרטור ראשי', place: 'חדר גנרטור · קומת מרתף', rated_kw: 200, rated_kva: 250, model: 'בקר גנרטור (דגם לא ידוע)' };
// scenarios: run (mains lost, generator on load), standby (mains ok, generator stopped), test (test run, no load), unavail
const SCEN = {
  run: { state: 'running', mode: 'auto', mains: false, onload: true, kw: 124, pct: 62, rpm: 1500, hz: 50.0, v: [231, 229, 232], a: [180, 171, 186], pf: 0.86, fuel: 58, batt: 27.4, cool: 84, oil: 4.2, since: '14:02', hours: 1284.5, starts: 212 },
  standby: { state: 'stopped', mode: 'auto', mains: true, onload: false, kw: 0, pct: 0, rpm: 0, hz: 0, v: [0, 0, 0], a: [0, 0, 0], pf: 0, fuel: 92, batt: 26.9, cool: 38, oil: 0, since: '', hours: 1284.5, starts: 212 },
  test: { state: 'running', mode: 'test', mains: true, onload: false, kw: 0, pct: 0, rpm: 1500, hz: 50.1, v: [230, 230, 231], a: [0, 0, 0], pf: 0, fuel: 91, batt: 27.9, cool: 71, oil: 4.4, since: '09:00', hours: 1284.5, starts: 213 },
  unavail: { state: 'unknown', mode: 'auto', mains: true, onload: false, kw: 0, pct: 0, rpm: 0, hz: 0, v: [0, 0, 0], a: [0, 0, 0], pf: 0, fuel: 92, batt: 26.8, cool: 36, oil: 0, since: '', hours: 1284.5, starts: 212 },
};
const MAINS_KW = 118; // site load from the grid when the generator is not on load
const ST = { running: ['פועל', 'ok'], stopped: ['במנוחה', 'off'], starting: ['מתניע', 'warn'], cooling: ['מתקרר', 'warn'], fault: ['תקלה', 'err'], unknown: ['אין תקשורת', 'err'] };
const MODE = { auto: 'אוטומטי', manual: 'ידני', off: 'כבוי', test: 'מבחן' };

// alert catalogue (ASSUMPTION): key, group, Hebrew title, default severity, icon
const GROUPS = [['engine', 'מנוע'], ['fuel', 'דלק'], ['electrical', 'חשמל הגנרטור'], ['mains', 'רשת ומתג העברה'], ['maintenance', 'תחזוקה ומבחנים'], ['comm', 'תקשורת ומצב בקר']];
const TYPES = [
  ['fail_to_start', 'engine', 'כשל התנעה', 'critical', 'engine'],
  ['low_oil_pressure', 'engine', 'לחץ שמן נמוך', 'critical', 'oil'],
  ['high_coolant_temp', 'engine', 'טמפרטורת נוזל קירור גבוהה', 'critical', 'temp'],
  ['overspeed', 'engine', 'מהירות יתר', 'critical', 'engine'],
  ['emergency_stop', 'engine', 'עצירת חירום', 'critical', 'stop'],
  ['unexpected_stop', 'engine', 'עצירה לא מתוכננת', 'critical', 'stop'],
  ['low_fuel', 'fuel', 'מפלס דלק נמוך', 'alert', 'fuel'],
  ['fuel_shutdown', 'fuel', 'דלק אזל - השבתה', 'critical', 'fuel'],
  ['overload', 'electrical', 'עומס יתר', 'alert', 'bolt'],
  ['gen_voltage', 'electrical', 'מתח גנרטור חריג', 'alert', 'bolt'],
  ['gen_frequency', 'electrical', 'תדר חריג', 'alert', 'bolt'],
  ['battery_low', 'electrical', 'מתח מצבר נמוך', 'alert', 'battery'],
  ['charger_fail', 'electrical', 'כשל מטען מצבר', 'alert', 'battery'],
  ['mains_lost', 'mains', 'אובדן רשת חשמל', 'alert', 'grid'],
  ['mains_restored', 'mains', 'רשת החשמל חזרה', 'info', 'grid'],
  ['ats_to_gen', 'mains', 'מעבר עומס לגנרטור', 'info', 'ats'],
  ['ats_fail', 'mains', 'כשל מתג העברה', 'critical', 'ats'],
  ['service_due', 'maintenance', 'טיפול תקופתי', 'info', 'wrench'],
  ['test_done', 'maintenance', 'ריצת מבחן הושלמה', 'info', 'check'],
  ['test_failed', 'maintenance', 'ריצת מבחן נכשלה', 'alert', 'x'],
  ['controller_offline', 'comm', 'אין תקשורת עם הבקר', 'alert', 'link'],
  ['not_auto', 'comm', 'הבקר אינו במצב אוטומטי', 'alert', 'gear'],
].map(([key, group, title, sev, icon]) => ({ key, group, title, sev, icon }));
const NEEDS = { fail_to_start: ['state'], low_oil_pressure: ['oil'], high_coolant_temp: ['cool'], overspeed: ['rpm'], emergency_stop: ['state'], unexpected_stop: ['state'],
  low_fuel: ['fuel'], fuel_shutdown: ['fuel'], overload: ['kw'], gen_voltage: ['v1'], gen_frequency: ['hz'], battery_low: ['batt'], charger_fail: ['batt'],
  mains_lost: ['mains'], mains_restored: ['mains'], ats_to_gen: ['ats'], ats_fail: ['ats'], service_due: ['hours'], test_done: ['last_test'], test_failed: ['last_test'],
  controller_offline: [], not_auto: ['mode'] };
const needsMet = (key, caps) => (NEEDS[key] || []).every((r) => caps.has(r) || (r === 'v1' && caps.has('v3')));
const needsMissing = (key, caps) => (NEEDS[key] || []).filter((r) => !(caps.has(r) || (r === 'v1' && caps.has('v3')))).map((r) => CAP_LABEL[r]).join(', ');
const TY = Object.fromEntries(TYPES.map((t) => [t.key, t]));
const SEV = { critical: 'קריטי', alert: 'התראה', info: 'מידע' };
const sevChip = (s, label) => `<span class="sev ${s}">${label || SEV[s] || s}</span>`;

// active alerts (scenario "run")
const ACTIVE = [
  { id: 'n1', t: 'mains_lost', sev: 'alert', at: 'היום 14:02', dur: '27 דק׳', ack: null, detail: 'שלוש הפאזות אבדו יחד · הגנרטור התניע תוך 38 שניות', delivered: 'נשלח ל-4 נמענים · דחיפה ויישומון' },
  { id: 'n2', t: 'ats_to_gen', sev: 'info', at: 'היום 14:02', dur: '27 דק׳', ack: 'דנה', detail: 'מתג ההעברה במצב גנרטור · 124 קילוואט על הגנרטור', delivered: 'מרכז ההתראות בלבד' },
  { id: 'n3', t: 'battery_low', sev: 'alert', at: 'היום 14:02', dur: '27 דק׳', ack: null, detail: 'מתח המצבר ירד ל-23.1 וולט בזמן ההתנעה · כעת 27.4 וולט בטעינה', delivered: 'נשלח ל-2 נמענים · דחיפה' },
  { id: 'n4', t: 'service_due', sev: 'info', at: 'אתמול 06:00', dur: 'יום', ack: 'דנה', detail: 'הטיפול הבא ב-1,330 שעות עבודה · נותרו 46 שעות', delivered: 'דוא״ל לאחראי התחזוקה' },
];
// history rows
const HIST = [
  ['היום 14:02', 'mains_lost', 'alert', 'פעיל', '', ''],
  ['היום 14:02', 'ats_to_gen', 'info', 'פעיל', 'דנה', '14:05'],
  ['היום 14:02', 'battery_low', 'alert', 'פעיל', '', ''],
  ['אתמול 06:00', 'service_due', 'info', 'פעיל', 'דנה', 'אתמול 08:12'],
  ['28.09 09:00', 'test_done', 'info', 'נסגר 09:20', '-', ''],
  ['21.09 09:00', 'test_failed', 'alert', 'נסגר 09:03', 'יוסי', '21.09 09:14'],
  ['21.09 09:00', 'fail_to_start', 'critical', 'נסגר 09:03', 'יוסי', '21.09 09:14'],
  ['14.09 09:00', 'test_done', 'info', 'נסגר 09:20', '-', ''],
  ['11.09 17:40', 'controller_offline', 'alert', 'נסגר 18:05', 'דנה', '11.09 17:48'],
  ['07.09 09:00', 'test_done', 'info', 'נסגר 09:20', '-', ''],
  ['02.09 22:15', 'mains_lost', 'alert', 'נסגר 23:40', 'דנה', '02.09 22:19'],
  ['02.09 22:15', 'ats_to_gen', 'info', 'נסגר 23:41', 'דנה', '02.09 22:19'],
  ['02.09 23:40', 'mains_restored', 'info', 'נסגר 23:41', '-', ''],
  ['31.08 09:00', 'test_done', 'info', 'נסגר 09:20', '-', ''],
  ['19.08 13:05', 'low_fuel', 'alert', 'נסגר 20.08 10:30', 'יוסי', '19.08 13:20'],
].map(([at, t, sev, closed, ack, ackAt]) => ({ at, t, sev, closed, ack, ackAt }));

// routing policy per type (fake defaults). rec: roles / users; ch: channels; quiet: pass|hold|matrix; esc: bool
const ROLE = { sys: 'מנהלי מערכת', site: 'מנהלי אתר', op: 'מפעילים', maint: 'אחראי תחזוקה (יוסי)', owner: 'בעל האתר (דנה)' };
const POL = {};
for (const t of TYPES) {
  const crit = t.sev === 'critical';
  POL[t.key] = { on: true, sev: t.sev, rec: [], ch: [], quiet: crit ? 'pass' : 'matrix', esc: false };
}
POL.not_auto.on = false;
const CH = [['inbox', 'מרכז ההתראות', 'inbox', 'lock'], ['push', 'דחיפה לדפדפן', 'bell', ''], ['app', 'יישומון הטלפון', 'phone', ''], ['email', 'דוא״ל', 'mail', ''], ['whatsapp', 'WhatsApp - בקרוב', 'chat', 'soon']];

/* ------------------------------------------------------------------ shell */
const RAIL = [['devices', 'home', 'ראשי'], ['security', 'shield', 'אבטחה'], ['explore', 'map', 'מפה'], ['multimedia', 'media', 'מולטימדיה'], ['wiskey', 'door', 'WisKey'], ['infra', 'bolt', 'תשתיות']];
const L1_INFRA = [['electricity', 'מוני חשמל'], ['generator', 'גנרטור']];
const L2_GEN = [['live', 'מצב חי', 'live'], ['alerts', 'התראות פעילות', 'alerts'], ['charts', 'גרפים', 'charts'], ['history', 'היסטוריה', 'history']];
const SET_TABS = [['general', 'כללי'], ['notif', 'התראות'], ['access', 'משתמשים והרשאות'], ['security', 'אבטחה'], ['storage', 'אחסון'], ['entities', 'קטלוג התקנים'], ['infra', 'תשתיות']];
function shell(body, o) {
  const area = o.area || 'infra';
  const rail = RAIL.map(([id, i, l]) => `<a class="${id === area ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  let bars = '';
  const activeCount = o.activeCount == null ? 2 : o.activeCount;
  if (area === 'infra') {
    const l2 = PH()
      ? `<nav class="ptabs">${L2_GEN.map(([id, l, s]) => `<a class="${id === o.l2 ? 'on' : ''}" onclick="go('${s}')">${l}${id === 'alerts' && activeCount ? `<span class="cnt">${activeCount}</span>` : ''}</a>`).join('')}</nav>`
      : `<nav class="tabs">${L2_GEN.map(([id, l, s]) => `<a class="${id === o.l2 ? 'on' : ''}" onclick="go('${s}')">${l}${id === 'alerts' && activeCount ? ` <span class="sev critical" style="padding:0 7px">${activeCount}</span>` : ''}</a>`).join('')}</nav>`;
    bars = `<nav class="tabs l1">${L1_INFRA.map(([id, l]) => `<a class="${id === 'generator' ? 'on' : ''}">${l}</a>`).join('')}</nav>${o.noL2 ? '' : l2}`;
  } else {
    bars = `<nav class="tabs">${SET_TABS.map(([id, l]) => `<a class="${id === 'infra' ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <nav class="tabs l1"><a>חשמל</a><a class="on">גנרטור</a></nav>`;
  }
  const dock = [['devices', 'home', 'ראשי'], ['security', 'shield', 'אבטחה'], ['explore', 'map', 'מפה'], ['infra', 'bolt', 'תשתיות'], ['system', 'more', 'עוד']]
    .map(([id, i, l]) => `<a class="${id === area ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  return `<div class="app">
    <aside class="rail"><div class="logo">A</div>${rail}<div class="sp"></div><a class="${area === 'system' ? 'on' : ''}">${ic('gear')}<span>מערכת</span></a></aside>
    <div class="main">
      <header class="top"><h1>${area === 'infra' ? 'תשתיות' : 'הגדרות'}</h1><div class="sp"></div><div class="avatar">דנ</div></header>
      <div class="bars">${bars}</div>
      <section class="content">${body}</section>
    </div>
    <nav class="dock">${dock}</nav>
    ${o.overlay || ''}
  </div>`;
}

/* several generators: a picker by device name (live, charts, alerts, history, routing) */
const GENS = ['גנרטור ראשי', 'גנרטור גיבוי'];
const genPicker = () => `<div class="gpick"><span class="mut">התקן</span><div class="seg2">${GENS.map((n, i) => `<a class="${i === 0 ? 'on' : ''}">${n}</a>`).join('')}</div><span class="mut">${GENS.length} גנרטורים זוהו, מוצג אחד בכל פעם</span></div>`;

/* ------------------------------------------------------------------ capabilities (which roles the detected controller exposes) */
// role keys: state mode ats mains onload rpm hours starts cool oil batt fuel v3 v1 a kw hz pf pct last_start last_test next_test service
const CAPS = {
  minimal: ['state', 'v1'],
  typical: ['state', 'mode', 'ats', 'mains', 'onload', 'rpm', 'hours', 'cool', 'batt', 'v3', 'a', 'kw', 'hz', 'pct', 'last_start', 'last_test', 'service'],
  full: ['state', 'mode', 'ats', 'mains', 'onload', 'rpm', 'hours', 'starts', 'cool', 'oil', 'batt', 'fuel', 'v3', 'a', 'kw', 'hz', 'pf', 'pct', 'last_start', 'last_test', 'next_test', 'service'],
};
const CAP_LABEL = { state: 'מצב מנוע', mode: 'מצב בקר', ats: 'מצב מתג העברה', mains: 'רשת זמינה', onload: 'גנרטור בעומס', rpm: 'סל״ד', hours: 'שעות עבודה', starts: 'מספר התנעות', cool: 'טמפרטורת נוזל קירור', oil: 'לחץ שמן', batt: 'מתח מצבר', fuel: 'מפלס דלק', v3: 'מתח לפי פאזה', v1: 'מתח גנרטור', a: 'זרם', kw: 'הספק', hz: 'תדר', pf: 'מקדם הספק', pct: 'אחוז עומס', last_start: 'התנעה אחרונה', last_test: 'מבחן אחרון', next_test: 'מבחן הבא', service: 'טיפול הבא' };
let CAP = new Set(CAPS.full);
const has = (...r) => r.every((x) => CAP.has(x));
const capCount = () => CAP.size;

/* ------------------------------------------------------------------ power-flow diagram v1 (the first draft, kept for the before/after page) */
function flowSvgV1(g) {
  const T = (x) => x;
  const onGen = g.onload && g.state === 'running';
  const mainsOn = g.mains;
  const W = 640, H = 300;
  const genRun = g.state === 'running';
  const node = (x, y, w, h, cls) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" class="node ${cls}"/>`;
  const tag = (x, y, text, cls, w = 70) => `<rect x="${x - w / 2}" y="${y - 10}" width="${w}" height="20" rx="10" class="tag ${cls}"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="tagt ${cls}">${text}</text>`;
  const iconG = (x, y, n, cls) => `<g transform="translate(${x} ${y}) scale(1.4)"><path d="${I[n]}" class="ico ${cls}"/></g>`;
  const wire = (d, on, gen) => `<path d="${d}" class="wire ${on ? 'on' : ''} ${gen ? 'gen' : ''}"/>${on ? `<path d="${d}" class="dots"/>` : ''}`;
  const gridD = 'M180 80 H 255 V 138 H 295';
  const genD = 'M180 220 H 255 V 162 H 295';
  const loadD = 'M355 150 H 470';
  const bladeTo = onGen ? 'M325 150 L 297 162' : mainsOn ? 'M325 150 L 297 138' : 'M325 150 L 299 150';
  const kwOnWire = onGen ? g.kw : mainsOn ? MAINS_KW : 0;
  return `<svg class="flow v1" viewBox="0 0 ${W} ${H}" role="img" aria-label="תרשים זרימת הספק (טיוטה ראשונה)">
    ${wire(gridD, mainsOn && !onGen, false)}
    ${wire(genD, onGen, true)}
    ${wire(loadD, kwOnWire > 0, onGen)}
    ${node(20, 40, 160, 80, mainsOn ? 'grid' : 'dim')}
    ${iconG(34, 52, 'grid', mainsOn ? 'grid' : 'dim')}
    <text x="82" y="66" class="lbl">רשת החשמל</text>
    <text x="82" y="88" class="val">${mainsOn ? T('230 V · 50.0 Hz') : 'אין מתח'}</text>
    ${tag(100, 130, mainsOn ? 'זמינה' : 'נפלה ' + (g.since || ''), mainsOn ? 'ok' : 'err', mainsOn ? 60 : 92)}
    ${node(20, 180, 160, 80, genRun ? 'gen' : 'dim')}
    ${iconG(34, 192, 'engine', genRun ? 'gen' : 'dim')}
    <text x="82" y="206" class="lbl">${GEN.name}</text>
    <text x="82" y="228" class="val">${genRun ? T(f0(g.rpm) + ' rpm · ' + f1(g.hz) + ' Hz') : 'כבוי'}</text>
    ${tag(100, 270, genRun ? (onGen ? 'פועל · בעומס' : 'פועל · ללא עומס') : 'במנוחה', genRun ? 'ok' : 'mut', 96)}
    ${node(295, 115, 60, 70, 'ats')}
    <circle cx="325" cy="150" r="4" fill="var(--sw-accent)"/>
    <path d="${bladeTo}" class="blade"/>
    <circle cx="297" cy="138" r="3" fill="var(--gen-grid)"/><circle cx="297" cy="162" r="3" fill="var(--gen-gen)"/>
    <text x="325" y="106" text-anchor="middle" class="small">מתג העברה</text>
    ${tag(325, 200, onGen ? 'גנרטור' : mainsOn ? 'רשת' : 'מנותק', onGen ? 'ok' : mainsOn ? 'ok' : 'err', 60)}
    <rect x="374" y="124" width="78" height="22" rx="11" class="tag ${kwOnWire ? (onGen ? 'ok' : '') : 'err'}"/>
    <text x="413" y="139" text-anchor="middle" class="tagt ${onGen ? 'ok' : 'mut'}">${kwOnWire ? T(f0(kwOnWire) + ' kW') : '0 kW'}</text>
    ${node(470, 110, 160, 80, kwOnWire ? 'load' : 'dim')}
    ${iconG(484, 122, 'load', kwOnWire ? 'load' : 'dim')}
    <text x="532" y="136" class="lbl">צרכני האתר</text>
    <text x="532" y="158" class="val">${T(f0(kwOnWire) + ' kW')}</text>
    ${tag(550, 200, onGen ? `${g.pct}% מהגנרטור` : mainsOn ? 'מוזן מהרשת' : 'ללא הזנה', onGen ? 'warn' : mainsOn ? 'ok' : 'err', 100)}
  </svg>`;
}

/* ------------------------------------------------------------------ power-flow diagram v2 (hero component; capability-driven; horizontal and vertical layouts) */
function flowSvg(g, opt = {}) {
  const id = opt.id || 'f';
  const vertical = opt.vertical != null ? opt.vertical : PH();
  const genRun = g.state === 'running';
  const stale = g.state === 'unknown';
  const showMains = has('mains');
  const showAts = has('ats');
  const onGen = showAts ? g.onload && genRun : genRun;            // without an ATS role, a running generator is assumed to feed its load
  const mainsOn = showMains && g.mains;
  const kwKnown = has('kw');
  const siteKw = onGen ? g.kw : mainsOn ? MAINS_KW : 0;
  const motion = !stale;
  // ---- geometry
  const compact = !showMains && !showAts;
  const cw = vertical ? 160 : 190, ch = vertical ? 108 : 96;
  let W = vertical ? 360 : compact ? 540 : 720, H;
  let grid, gen, ats, load;
  if (!vertical) {
    const sy = showMains ? [24, 152] : [compact ? 40 : 88];
    grid = showMains ? { x: 24, y: sy[0] } : null;
    gen = { x: compact ? 40 : 24, y: showMains ? sy[1] : sy[0] };
    ats = showAts ? { x: 332, y: 100 } : null;
    load = { x: compact ? 310 : 506, y: compact ? 40 : 88 };
    H = compact ? 176 : 272;
  } else {
    grid = showMains ? { x: 16, y: 16 } : null;
    gen = { x: showMains ? 184 : 100, y: 16 };
    ats = showAts ? { x: 150, y: 170 } : null;
    load = { x: 100, y: showAts ? 300 : 210 };
    H = load.y + ch + 14;
  }
  const port = (n, side) => !n ? null : side === 'r' ? [n.x + cw, n.y + ch / 2] : side === 'l' ? [n.x, n.y + ch / 2] : side === 'b' ? [n.x + cw / 2, n.y + ch] : [n.x + cw / 2, n.y];
  const atsIn = (k) => !ats ? null : vertical ? [ats.x + (k === 'grid' ? 16 : 44), ats.y] : [ats.x, ats.y + (k === 'grid' ? 18 : 42)];
  const atsOut = () => !ats ? null : vertical ? [ats.x + 30, ats.y + 60] : [ats.x + 60, ats.y + 30];
  const curve = (a, b) => vertical
    ? `M${a[0]} ${a[1]} C ${a[0]} ${a[1] + 46}, ${b[0]} ${b[1] - 46}, ${b[0]} ${b[1]}`
    : `M${a[0]} ${a[1]} C ${a[0] + 70} ${a[1]}, ${b[0] - 70} ${b[1]}, ${b[0]} ${b[1]}`;
  const srcOut = (n) => port(n, vertical ? 'b' : 'r');
  const loadIn = port(load, vertical ? 't' : 'l');
  const paths = [];
  if (grid) paths.push({ k: 'grid', d: curve(srcOut(grid), ats ? atsIn('grid') : loadIn), on: mainsOn && !onGen, tone: 'grid' });
  paths.push({ k: 'gen', d: curve(srcOut(gen), ats ? atsIn('gen') : loadIn), on: onGen, tone: 'gen' });
  if (ats) paths.push({ k: 'out', d: curve(atsOut(), loadIn), on: siteKw > 0 || (onGen && !kwKnown), tone: onGen ? 'gen' : 'grid' });
  // ---- primitives
  const wire = (p) => {
    const base = `<path d="${p.d}" class="w-base"/>`;
    if (!p.on) return base;
    const glow = `<path d="${p.d}" class="w-glow ${p.tone}" filter="url(#${id}-glow)"/><path d="${p.d}" class="w-on ${p.tone}" stroke="url(#${id}-g-${p.tone})"/>`;
    const dots = motion ? [0, 0.55, 1.1].map((b) => `<circle r="3" class="w-dot ${p.tone}"><animateMotion dur="1.7s" begin="-${b}s" repeatCount="indefinite" path="${p.d}"/></circle>`).join('') : '';
    return base + glow + dots;
  };
  const card = (n, o) => {
    const tone = o.tone, dim = o.dim;
    const ix = n.x + 16, iy = n.y + 16;
    const tx = n.x + 60;
    return `<g class="fnode ${dim ? 'dim' : ''} ${tone}">
      <rect x="${n.x}" y="${n.y}" width="${cw}" height="${ch}" rx="18" class="fcard" filter="url(#${id}-shadow)"/>
      <rect x="${n.x + 0.5}" y="${n.y + 0.5}" width="${cw - 1}" height="${ch - 1}" rx="17.5" class="fring"/>
      <circle cx="${ix + 16}" cy="${iy + 16}" r="17" class="fico-bg"/>
      <g transform="translate(${ix + 5} ${iy + 5}) scale(0.92)"><path d="${I[o.icon]}" class="fico"/></g>
      <text x="${tx}" y="${n.y + 30}" class="ft">${o.title}</text>
      <text x="${tx}" y="${n.y + 52}" class="fv">${o.value}</text>
      ${o.sub ? `<text x="${tx}" y="${n.y + 68}" class="fs">${o.sub}</text>` : ''}
      ${o.pill ? pill(n.x + cw - 12, n.y + ch - 14, o.pill, o.pillCls, 'end') : ''}
    </g>`;
  };
  const pill = (x, y, text, cls, anchor = 'middle') => {
    const w = Math.max(44, text.length * 6.6 + 18);
    const x0 = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2;
    return `<g class="fpill ${cls}"><rect x="${x0}" y="${y - 10}" width="${w}" height="20" rx="10"/><circle cx="${x0 + w - 10}" cy="${y}" r="3"/><text x="${x0 + w - 17}" y="${y + 3.6}" text-anchor="end">${text}</text></g>`;
  };
  const atsG = () => {
    if (!ats) return '';
    const cx = ats.x + 30, cy = ats.y + 30;
    const toGrid = vertical ? [ats.x + 16, ats.y + 8] : [ats.x + 8, ats.y + 18];
    const toGen = vertical ? [ats.x + 44, ats.y + 8] : [ats.x + 8, ats.y + 42];
    const tgt = onGen ? toGen : mainsOn ? toGrid : null;
    const lbl = onGen ? 'גנרטור' : mainsOn ? 'רשת' : 'מנותק';
    const cls = onGen ? 'gen' : mainsOn ? 'grid' : 'err';
    return `<g class="fats ${cls}">
      <rect x="${ats.x}" y="${ats.y}" width="60" height="60" rx="16" class="fcard" filter="url(#${id}-shadow)"/>
      <rect x="${ats.x + 0.5}" y="${ats.y + 0.5}" width="59" height="59" rx="15.5" class="fring"/>
      <circle cx="${toGrid[0]}" cy="${toGrid[1]}" r="3.2" class="fp grid"/><circle cx="${toGen[0]}" cy="${toGen[1]}" r="3.2" class="fp gen"/>
      ${tgt ? `<line x1="${cx}" y1="${cy}" x2="${tgt[0]}" y2="${tgt[1]}" class="fblade"/>` : `<line x1="${cx}" y1="${cy}" x2="${vertical ? cx : ats.x + 10}" y2="${vertical ? ats.y + 8 : cy}" class="fblade off"/>`}
      <circle cx="${cx}" cy="${cy}" r="4.2" class="fpivot"/>
      <text x="${cx}" y="${ats.y - 10}" text-anchor="middle" class="fs c">מתג העברה</text>
      ${pill(cx, ats.y + 60 + 16, lbl, cls)}
    </g>`;
  };
  const kwTag = () => {
    if (!ats || (!kwKnown && !siteKw)) return '';
    const o = atsOut(), l = loadIn; const x = (o[0] + l[0]) / 2, y = (o[1] + l[1]) / 2;
    const txt = kwKnown ? f0(siteKw) + ' kW' : onGen ? 'מוזן' : '';
    return txt ? pill(vertical ? x + 62 : x, y - (vertical ? 0 : 14), txt, siteKw || onGen ? (onGen ? 'gen' : 'grid') : 'mut') : '';
  };
  // ---- content
  const gridCard = grid ? card(grid, { icon: 'grid', tone: 'grid', dim: !mainsOn, title: 'רשת החשמל', value: mainsOn ? '230 V · 50.0 Hz' : 'אין מתח', sub: mainsOn ? 'שלוש פאזות תקינות' : g.since ? 'נפלה ב-' + g.since : '', pill: mainsOn ? 'זמינה' : 'נפלה', pillCls: mainsOn ? 'grid' : 'err' }) : '';
  const genVal = stale ? 'אין תקשורת' : genRun ? (has('rpm') ? f0(g.rpm) + ' rpm' : has('hz') ? f1(g.hz) + ' Hz' : has('v1') ? g.v[0] + ' V' : 'פועל') : 'כבוי';
  const genSub = genRun ? [has('rpm') && has('hz') ? f1(g.hz) + ' Hz' : '', has('pct') ? 'עומס ' + g.pct + '%' : has('kw') ? f0(g.kw) + ' kW' : '', !has('rpm') && !has('hz') && has('v1') && !has('v3') ? '' : ''].filter(Boolean).join(' · ') : has('mode') ? 'מצב ' + MODE[g.mode] : '';
  const genCard = card(gen, { icon: 'engine', tone: 'gen', dim: !genRun, title: GEN.name, value: genVal, sub: genSub, pill: stale ? 'לא ידוע' : genRun ? (onGen ? 'בעומס' : g.mode === 'test' ? 'מבחן' : 'פועל') : 'במנוחה', pillCls: stale ? 'err' : genRun ? 'gen' : 'mut' });
  const loadOn = siteKw > 0 || (onGen && !kwKnown);
  const loadCard = card(load, { icon: 'load', tone: 'load', dim: !loadOn, title: 'צרכני האתר', value: kwKnown ? f0(siteKw) + ' kW' : loadOn ? 'מוזן' : 'ללא הזנה', sub: onGen && has('pct') ? g.pct + '% מהספק הגנרטור' : mainsOn && !onGen ? 'מוזן מהרשת' : '', pill: onGen ? 'מהגנרטור' : mainsOn ? 'מהרשת' : loadOn ? 'מוזן' : 'ללא הזנה', pillCls: onGen ? 'gen' : mainsOn ? 'grid' : loadOn ? 'gen' : 'err' });
  return `<svg class="flow v2 ${vertical ? 'vert' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="תרשים זרימת הספק">
    <defs>
      <filter id="${id}-glow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4.5"/></filter>
      <filter id="${id}-shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="var(--gen-shadow)" flood-opacity="0.35"/></filter>
      <linearGradient id="${id}-g-gen" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" style="stop-color:var(--gen-gen)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--gen-gen) 55%, var(--gen-load))"/></linearGradient>
      <linearGradient id="${id}-g-grid" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" style="stop-color:var(--gen-grid)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--gen-grid) 55%, var(--gen-load))"/></linearGradient>
    </defs>
    ${paths.map(wire).join('')}
    ${gridCard}${genCard}${atsG()}${kwTag()}${loadCard}
  </svg>`;
}

/* ------------------------------------------------------------------ gauges, tables, cards (every piece is drawn only when its role exists) */
function gauge(label, val, unit, pct, cls, lim) {
  const r = 42, cx = 60, cy = 56;
  const a0 = (-210 * Math.PI) / 180;
  const total = 240;
  const arc = (deg) => { const a = a0 + (deg * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const [sx, sy] = arc(0); const [tx, ty] = arc(total);
  const p = Math.max(0, Math.min(100, pct)); const [ex, ey] = arc((total * p) / 100);
  const large = (total * p) / 100 > 180 ? 1 : 0;
  return `<div class="gauge">
    <svg viewBox="0 0 120 92" aria-hidden="true">
      <path class="track" d="M${sx} ${sy} A${r} ${r} 0 1 1 ${tx} ${ty}"/>
      ${p > 0 ? `<path class="arc ${cls}" d="M${sx} ${sy} A${r} ${r} 0 ${large} 1 ${ex} ${ey}"/>` : ''}
      <text x="60" y="60" text-anchor="middle" class="gv">${val}</text>
      <text x="60" y="76" text-anchor="middle" class="gu">${unit}</text>
    </svg>
    <div class="k">${label}</div>${lim ? `<div class="lim">${lim}</div>` : ''}
  </div>`;
}
function gauges(g, stale) {
  const items = [];
  if (has('fuel')) items.push(gauge('מפלס דלק', N(g.fuel), '%', g.fuel, g.fuel < 25 ? 'err' : g.fuel < 40 ? 'warn' : 'ok', 'התראה מתחת ל-25%'));
  if (has('batt')) items.push(gauge('מתח מצבר', N(f1(g.batt)), 'V', ((g.batt - 20) / 10) * 100, g.batt < 24 ? 'err' : g.batt < 25.5 ? 'warn' : 'ok', 'תקין 25.5-29 וולט'));
  if (has('cool')) items.push(gauge('טמפרטורת נוזל קירור', N(g.cool), '°C', (g.cool / 110) * 100, g.cool > 98 ? 'err' : g.cool > 92 ? 'warn' : 'ok', 'גבול 98°'));
  if (has('oil')) items.push(gauge('לחץ שמן', N(f1(g.oil)), 'bar', (g.oil / 6) * 100, g.state === 'running' ? (g.oil < 1.5 ? 'err' : g.oil < 2.5 ? 'warn' : 'ok') : 'ok', g.state === 'running' ? 'מינימום 1.5' : 'המנוע במנוחה'));
  if (has('pct') && !has('fuel')) items.push(gauge('עומס', N(g.pct), '%', g.pct, g.pct > 90 ? 'err' : g.pct > 80 ? 'warn' : 'ok', 'מתוך ' + GEN.rated_kw + ' kW'));
  if (!items.length) return '';
  return `<div class="gauges n${items.length} ${stale ? 'stale' : ''}">${items.join('')}</div>`;
}
function phaseTable(g) {
  const run = g.state === 'running';
  if (!has('v3') && !has('v1')) return '';
  const cols = [['v', 'מתח', true], ['a', 'זרם', has('a')], ['kw', 'הספק', has('kw') && has('a')], ['bar', 'עומס', has('a')]].filter((c) => c[2]);
  const rows = has('v3') ? [0, 1, 2] : [0];
  const row = (i) => {
    const kw = run && g.onload ? Math.round((g.v[i] * g.a[i] * g.pf) / 1000) : 0;
    const pct = run && g.onload ? Math.round((g.a[i] / 360) * 100) : 0;
    const cell = { v: `<td class="num">${run ? f0(g.v[i]) + ' V' : '-'}</td>`, a: `<td class="num">${run ? f0(g.a[i]) + ' A' : '-'}</td>`, kw: `<td class="num">${run ? kw + ' kW' : '-'}</td>`, bar: `<td><div class="pbar"><i class="${pct > 90 ? 'err' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></i></div></td>` };
    return `<tr><td class="b">${has('v3') ? 'L' + (i + 1) : 'גנרטור'}</td>${cols.map((c) => cell[c[0]]).join('')}</tr>`;
  };
  const foot = has('v3') ? `<tfoot><tr><td>סה״כ</td>${cols.map((c) => c[0] === 'v' ? `<td class="num">${run ? 'ממוצע ' + f0((g.v[0] + g.v[1] + g.v[2]) / 3) + ' V' : '-'}</td>` : c[0] === 'a' ? `<td class="num">${run ? f0(g.a[0] + g.a[1] + g.a[2]) + ' A' : '-'}</td>` : c[0] === 'kw' ? `<td class="num">${run ? f0(g.kw) + ' kW' : '-'}</td>` : `<td>${run && g.onload && has('pct') ? N(g.pct + '%') + ' מ-' + N(GEN.rated_kw + ' kW') : ''}</td>`).join('')}</tr></tfoot>` : '';
  const hdExtra = [has('hz') ? 'תדר ' + N(run ? f1(g.hz) + ' Hz' : '-') : '', has('pf') ? 'מקדם הספק ' + N(run && g.onload ? g.pf : '-') : ''].filter(Boolean).join(' · ');
  return `<div class="card flush"><div class="hd"><span class="h3">${has('v3') ? 'מתח, זרם והספק לפי פאזה' : 'מתח הגנרטור'}</span><div class="sp"></div><span class="mut">${hdExtra}</span></div>
    <div class="scrollx"><table class="t phase"><thead><tr><th>${has('v3') ? 'פאזה' : ''}</th>${cols.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(row).join('')}</tbody>${foot}</table></div></div>`;
}
function engineCard(g, stale) {
  const [label, cls] = ST[g.state];
  const rows = [];
  rows.push(['מצב המנוע', `<span class="chip c-${cls === 'ok' ? 'ok' : cls === 'err' ? 'err' : cls === 'warn' ? 'warn' : 'mut'}">${label}</span>${g.since && has('last_start') ? ` <span class="mut">מאז ${g.since}</span>` : ''}`]);
  if (has('mode')) rows.push(['מצב הבקר', `${MODE[g.mode]}${g.mode !== 'auto' ? ' <span class="chip c-warn nodot">לא אוטומטי</span>' : ''}`]);
  if (has('hours')) rows.push(['שעות עבודה', `${N(f1(g.hours))} שעות${has('starts') ? ' · ' + N(g.starts) + ' התנעות' : ''}`]);
  if (has('rpm')) rows.push(['סל״ד', g.state === 'running' ? N(f0(g.rpm)) : '-']);
  if (has('last_start')) rows.push(['התנעה אחרונה', `${g.state === 'running' && g.since ? 'היום ' + g.since : '28.09 09:00'} · ${g.mode === 'test' ? 'ריצת מבחן' : g.onload ? 'אובדן רשת' : 'ריצת מבחן שבועית'}`]);
  if (has('last_test')) rows.push(['מבחן אחרון', '28.09 09:00 · <span class="chip c-ok nodot">עבר</span> 20 דק׳']);
  if (has('next_test')) rows.push(['מבחן הבא', '12.10 09:00 · שבועי, ללא עומס']);
  if (has('service')) rows.push(['טיפול הבא', `ב-${N('1,330')} שעות · <span class="chip c-warn nodot">בעוד 46 שעות</span>`]);
  return `<div class="card ${stale ? 'stale' : ''}"><div class="hd"><span class="h3">מנוע ובקר</span><div class="sp"></div><span class="last-seen">${ic('clock')} ${stale ? 'נקלט לאחרונה 09:41' : 'עודכן לפני 4 שנ׳'}</span></div>
    <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${capCount() < CAPS.full.length ? `<div class="mut" style="margin-top:10px">${capCount()} מתוך ${CAPS.full.length} ערכים זמינים מהבקר · <a class="btn ghost sm" style="min-height:24px">מיפוי חיישנים</a></div>` : ''}</div>`;
}
function modeCard(g) {
  const cmds = has('mode');
  return `<div class="card"><div class="hd"><span class="h3">מצב הבקר</span><div class="sp"></div><span class="chip c-mut nodot">${ic('user')} צפייה והתראות בלבד</span></div>
    ${cmds ? `<div class="mode ro">${['auto', 'manual', 'off'].map((m) => `<a class="${g.mode === m || (m === 'auto' && g.mode === 'test') ? 'on ' + m : ''}">${MODE[m]}</a>`).join('')}</div>` : '<div class="mut">הבקר אינו מדווח על מצב הפעלה</div>'}
    <div class="actions" style="margin-top:12px"><button class="btn">${ic('check')} אישור כל ההתראות</button></div>
    <div class="mut" style="margin-top:8px">המערכת מציגה ומתריעה; הפעלה ועצירה נעשות בבקר עצמו</div></div>`;
}
function statusStrip(g, extra = '') {
  const [label, cls] = ST[g.state];
  const onload = has('ats') ? g.onload : true;
  const txt = g.state === 'running' ? (onload ? `${GEN.name} פועל ומזין את האתר` : g.mode === 'test' ? `${GEN.name} בריצת מבחן` : `${GEN.name} פועל ללא עומס`) : g.state === 'stopped' ? `${GEN.name} במנוחה${has('mains') ? ' · האתר מוזן מהרשת' : ''}` : `${GEN.name} · ${label}`;
  return `<div class="status-strip"><span class="big"><span class="pulse ${cls}"></span>${txt}</span>
    <span class="mut">${GEN.place} · ${N(GEN.rated_kva + ' kVA')}</span><div class="sp"></div>${extra}</div>`;
}
function liveScreen(key, opts = {}) {
  CAP = new Set(CAPS[opts.caps || 'typical']);
  const g = SCEN[key];
  const stale = key === 'unavail';
  const banner = stale ? `<div class="banner err">${ic('link')}<b>אין תקשורת עם בקר הגנרטור</b><span>מאז 09:41 · הערכים מוצגים כפי שנקלטו לאחרונה</span><div class="sp"></div><button class="btn sm">${ic('refresh')} בדיקה חוזרת</button></div>` : '';
  const kpis = [];
  if (has('pct')) kpis.push(['עומס', N(g.pct + '%')]);
  if (has('kw')) kpis.push(['הספק', N(f0(g.kw) + ' kW')]);
  if (has('fuel')) kpis.push(['דלק', N(g.fuel + '%')]);
  else if (has('batt')) kpis.push(['מצבר', N(f1(g.batt) + ' V')]);
  const quick = PH() && kpis.length ? `<div class="kpi-row n${kpis.length}">${kpis.map(([k, v]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>` : '';
  const diagChip = has('mains') ? (g.onload && has('ats') ? sevChip('alert', 'אובדן רשת ' + g.since) : g.mode === 'test' ? sevChip('info', 'מבחן ללא עומס') : sevChip('cleared', 'רשת זמינה')) : '';
  const body = `${banner}
    ${genPicker()}
    ${statusStrip(g, stale ? '' : `<span class="last-seen">${ic('clock')} נתונים חיים</span>`)}
    ${quick}
    <div class="hero">
      <div class="card hero-card ${stale ? 'stale' : ''}"><div class="hd"><span class="h3">זרימת הספק</span><div class="sp"></div>${diagChip}</div>${flowSvg(g, { id: 'live' })}</div>
      ${engineCard(g, stale)}
    </div>
    ${gauges(g, stale)}
    ${chartSection()}
    <div class="cols side-l">
      <div class="${stale ? 'stale' : ''}">${phaseTable(g)}</div>
      ${modeCard(g)}
    </div>`;
  const out = shell(body, { l2: 'live', activeCount: key === 'run' ? 2 : key === 'standby' ? 0 : 1, overlay: opts.overlay });
  CAP = new Set(CAPS.full);
  return out;
}
/* ------------------------------------------------------------------ history charts (capability-driven, selectable range) */
let RANGE = '24h', METRIC = 'pct';
const RANGES = [['1h', 'שעה'], ['24h', '24 שעות'], ['7d', '7 ימים'], ['30d', '30 יום'], ['custom', 'מותאם']];
const METRICS = [
  ['pct', 'עומס', '%', 'pct', 0, 100, (t) => 8 + 55 * Math.max(0, Math.sin(t * 5.2 - 1.1)) + 6 * Math.sin(t * 40), 'סף: 90%'],
  ['volt', 'מתח גנרטור', 'V', 'v3', 200, 250, (t) => 230 + 2.2 * Math.sin(t * 31) + 1.2 * Math.sin(t * 7), 'תקין 207-253'],
  ['fuel', 'מפלס דלק', '%', 'fuel', 0, 100, (t) => 94 - 36 * t - 4 * Math.sin(t * 9), 'התראה מתחת ל-25%'],
  ['batt', 'מתח מצבר', 'V', 'batt', 20, 30, (t) => 26.9 + 0.6 * Math.max(0, Math.sin(t * 5.2 - 1.1)) + 0.15 * Math.sin(t * 50), 'תקין 25.5-29'],
  ['cool', 'טמפרטורת נוזל קירור', '°C', 'cool', 20, 110, (t) => 36 + 50 * Math.max(0, Math.sin(t * 5.2 - 1.1)) ** 0.6 + 2 * Math.sin(t * 30), 'גבול 98°'],
];
// the minimal controller has one phase voltage only (role v1), so volt is shown for v1 or v3
const availMetrics = () => METRICS.filter((m) => has(m[3]) || (m[0] === 'volt' && has('v1')));
function setRange(r) { RANGE = r; render(); }
function setMetric(m) { METRIC = m; render(); }
function rangeBar() { return `<div class="seg2">${RANGES.map(([k, l]) => `<a class="${RANGE === k ? 'on' : ''}" onclick="setRange('${k}')">${l}</a>`).join('')}</div>`; }
const rangeAxis = () => ({ '1h': ['לפני שעה', '30 דק׳', 'עכשיו'], '24h': ['לפני 24 ש׳', '12 ש׳', 'עכשיו'], '7d': ['לפני 7 ימים', '3.5 ימים', 'עכשיו'], '30d': ['לפני 30 יום', '15 יום', 'עכשיו'], custom: ['01.10 00:00', '03.10 12:00', '05.10 00:00'] }[RANGE]);
function chartSvg(m, big) {
  const [id, label, , , lo, hi, fn] = m;
  const W = 600, H = big ? 300 : 120, pl = 8, pr = 8, pt = 8, pb = 8, n = RANGE === '1h' ? 60 : RANGE === '24h' ? 96 : RANGE === '7d' ? 168 : 120;
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const v = fn(t); pts.push([pl + t * (W - pl - pr), pt + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (H - pt - pb)]); }
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = d + ` L${W - pr} ${H - pb} L${pl} ${H - pb} Z`;
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="${pl}" x2="${W - pr}" y1="${pt + f * (H - pt - pb)}" y2="${pt + f * (H - pt - pb)}" stroke="var(--sw-border)" stroke-dasharray="3 4"/>`).join('');
  const gid = `cg-${id}${big ? 'b' : ''}`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart ${big ? 'big' : ''}" role="img" aria-label="${label}" dir="ltr"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sw-accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--sw-accent)" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="var(--sw-accent)" stroke-width="${big ? 2.2 : 1.8}" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function metricStats(m) {
  const unit = m[2], fn = m[6]; let mn = 1e9, mx = -1e9, sm = 0;
  for (let i = 0; i <= 50; i++) { const v = fn(i / 50); mn = Math.min(mn, v); mx = Math.max(mx, v); sm += v; }
  const f = unit === 'V' && m[0] === 'batt' ? f1 : f0;
  return [f(mn), f(sm / 51), f(mx)];
}
function chartCard(m, big) {
  const [id, label, unit, , lo, hi, fn, lim] = m; const [mn, av, mx] = metricStats(m); const ax = rangeAxis(); const cur = fn(1);
  return `<div class="card chartcard ${big ? 'bigcard' : ''}" ${big ? '' : `onclick="METRIC='${id}';go('charts')"`}><div class="hd"><span class="h3">${label}</span><div class="sp"></div><span class="num cur">${id === 'batt' ? f1(cur) : f0(cur)} ${unit}</span></div>
    <div class="plot">${chartSvg(m, big)}<div class="axy"><span class="num">${hi}</span><span class="num">${lo}</span></div></div>
    <div class="axx"><span>${ax[0]}</span>${big ? `<span>${ax[1]}</span>` : ''}<span>${ax[2]}</span></div>
    <div class="mut stats"><span>מינימום <b class="num">${mn}</b></span><span>ממוצע <b class="num">${av}</b></span><span>מקסימום <b class="num">${mx}</b></span>${big ? `<span>${lim}</span>` : ''}</div></div>`;
}
function chartSection() {
  const ms = availMetrics(); if (!ms.length) return '';
  return `<div class="row"><span class="h3">היסטוריית ערכים</span><div class="sp"></div>${rangeBar()}<a class="btn sm" onclick="go('charts')">${ic('up')} תצוגה מלאה</a></div>
    <div class="charts n${ms.length}">${ms.map((m) => chartCard(m, false)).join('')}</div>`;
}
function chartsScreen(caps) {
  CAP = new Set(CAPS[caps || 'full']);
  const ms = availMetrics(); const m = ms.find((x) => x[0] === METRIC) || ms[0];
  const body = `${genPicker()}<div class="row"><span class="h2">גרפים</span><div class="sp"></div>${rangeBar()}${RANGE === 'custom' ? '<div class="inp" style="min-height:34px"><span class="num">01.10 00:00 - 05.10 00:00</span></div>' : ''}<button class="btn sm">ייצוא CSV</button></div>
    <div class="seg2 metrics">${ms.map((x) => `<a class="${x[0] === m[0] ? 'on' : ''}" onclick="setMetric('${x[0]}')">${x[1]}</a>`).join('')}</div>
    ${chartCard(m, true)}
    <div class="mut">הנתונים נשמרים לפי טווח: דגימה מלאה 30 יום, אחר כך ממוצע שעתי עד שנה${has('fuel') ? ' · צריכת דלק משוערת: 6.4 ליטר לשעת עבודה' : ''}</div>`;
  const out = shell(body, { l2: 'charts', activeCount: 2 });
  CAP = new Set(CAPS.full);
  return out;
}
function diagramCompareScreen() {
  const g = SCEN.run, s = SCEN.standby;
  const cell = (title, inner) => `<div class="card"><div class="hd"><span class="h3">${title}</span></div>${inner}</div>`;
  const body = `<div class="row"><span class="h2">תרשים זרימת הספק: לפני ואחרי</span><div class="sp"></div><span class="mut">אותם נתונים, אותם טוקנים; רק התרשים השתנה</span></div>
    <div class="cols cmp2">
      ${cell('לפני: הטיוטה הראשונה', flowSvgV1(g))}
      ${cell('אחרי: גרסה 2 (הגנרטור בעומס)', flowSvg(g, { id: 'c1', vertical: false }))}
      ${cell('לפני: במנוחה', flowSvgV1(s))}
      ${cell('אחרי: במנוחה, האתר מוזן מהרשת', flowSvg(s, { id: 'c2', vertical: false }))}
    </div>
    <div class="row"><span class="h3">גרסה 2 לפי יכולות הבקר</span></div>
    <div class="cols cmp3">
      ${cell('מלא: רשת + מתג העברה + הספק', (CAP = new Set(CAPS.full), flowSvg(g, { id: 'c3', vertical: false })))}
      ${cell('טיפוסי: ללא דלק ושמן (התרשים זהה)', (CAP = new Set(CAPS.typical), flowSvg(g, { id: 'c4', vertical: false })))}
      ${cell('מינימלי: מצב ומתח בלבד (אין רשת, אין מתג)', (CAP = new Set(CAPS.minimal), flowSvg(g, { id: 'c5', vertical: false })))}
    </div>
    <div class="row"><span class="h3">גרסה 2 בפריסת טלפון</span></div>
    <div class="cols cmpp">
      ${cell('בעומס', (CAP = new Set(CAPS.full), flowSvg(g, { id: 'p1', vertical: true })))}
      ${cell('במנוחה', flowSvg(s, { id: 'p2', vertical: true }))}
      ${cell('מינימלי', (CAP = new Set(CAPS.minimal), flowSvg(g, { id: 'p3', vertical: true })))}
    </div>`;
  CAP = new Set(CAPS.full);
  return shell(body, { l2: 'live', activeCount: 2 });
}

/* ------------------------------------------------------------------ alerts */
function alertCard(a, sel) {
  const t = TY[a.t];
  return `<div class="al ${a.sev} ${sel ? 'sel' : ''}" onclick="go('alert')">
    <div class="ic">${ic(t.icon)}</div>
    <div class="grow"><div class="t1">${t.title} ${sevChip(a.sev)}${a.ack ? `<span class="sev mut">אושר · ${a.ack}</span>` : ''}</div>
      <div class="t2">${a.detail}</div>
      <div class="t3"><span>${ic('clock')} ${a.at} · ${a.dur}</span><span>${a.delivered}</span></div></div>
    <div class="side">${a.ack ? '' : `<button class="btn sm pri" onclick="event.stopPropagation();go('alert')">${ic('check')} אישור</button>`}<button class="btn sm ghost">פרטים</button></div>
  </div>`;
}
function alertsScreen() {
  const open = ACTIVE.filter((a) => !a.ack).length;
  const body = `${genPicker()}<div class="row"><span class="h2">התראות פעילות</span><span class="chip c-err">${open} ללא אישור</span><span class="chip c-mut">${ACTIVE.length - open} אושרו</span><div class="sp"></div>
      <button class="btn">${ic('check')} אישור הכול</button></div>
    <div class="list">${ACTIVE.map((a) => alertCard(a, false)).join('')}</div>`;
  return shell(body, { l2: 'alerts', activeCount: open });
}
function alertsEmptyScreen() {
  const body = `${genPicker()}<div class="row"><span class="h2">התראות פעילות</span></div>
    <div class="card"><div class="empty"><div class="ic">${ic('check')}</div><h3>אין התראות פעילות</h3><div class="mut">ההתראה האחרונה נסגרה ב-28.09 09:20 · <a class="btn ghost sm" onclick="go('history')">להיסטוריה</a></div></div></div>`;
  return shell(body, { l2: 'alerts', activeCount: 0 });
}
function historyScreen(o = {}) {
  const rows = HIST.map((h, i) => `<tr class="${o.sel === i ? 'sel' : ''}" onclick="go('alert')" style="cursor:pointer">
      <td class="num">${h.at}</td><td class="b">${TY[h.t].title}</td><td>${sevChip(h.sev)}</td><td>${h.closed === 'פעיל' ? '<span class="chip c-err">פעיל</span>' : '<span class="mut">' + h.closed + '</span>'}</td>
      <td>${h.ack === '-' ? '<span class="mut">לא נדרש</span>' : h.ack ? h.ack + ' <span class="mut num">' + h.ackAt + '</span>' : '<span class="chip c-warn">ממתין</span>'}</td></tr>`).join('');
  const phoneRows = HIST.map((h) => `<div class="li" onclick="go('alert')"><div class="grow"><div class="t1">${TY[h.t].title}</div><div class="t2 num">${h.at} · ${h.closed}</div></div>${sevChip(h.sev)}</div>`).join('');
  const body = `${genPicker()}<div class="row"><span class="h2">היסטוריית התראות</span><span class="mut">נשמרת שנה</span><div class="sp"></div><button class="btn sm">ייצוא CSV</button></div>
    <div class="filters">
      <div class="inp">${ic('search')}<span class="ph">חיפוש</span></div>
      <div class="seg2"><a>היום</a><a>7 ימים</a><a class="on">30 יום</a><a>מותאם</a></div>
      <div class="inp"><span>חומרה: הכול</span></div>
      <div class="inp"><span>סוג: הכול</span></div>
      <div class="inp"><span>אישור: הכול</span></div>
      <div class="inp"><span>מצב: הכול</span></div>
    </div>
    <div class="row mut"><span>${HIST.length} התראות ב-30 הימים האחרונים</span><span>·</span><span>3 אובדני רשת</span><span>·</span><span>4 ריצות מבחן, אחת נכשלה</span><span>·</span><span>זמן אישור ממוצע 9 דק׳</span></div>
    <div class="card flush hide-phone"><div class="scrollx"><table class="t"><thead><tr><th>מועד</th><th>התראה</th><th>חומרה</th><th>מצב</th><th>אישור</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="list only-phone" style="flex-direction:column">${phoneRows}</div>`;
  return shell(body, { l2: 'history', overlay: o.overlay });
}
function alertDetailOverlay() {
  const a = ACTIVE[2]; const t = TY[a.t];
  const inner = `<div class="row"><span class="h3">${t.title}</span>${sevChip(a.sev)}<div class="sp"></div><a class="btn ghost sm" onclick="go('alerts')">${ic('x')}</a></div>
    <div class="mut">${GEN.name} · ${GEN.place} · <span class="num">היום 14:02</span> · פעיל ${a.dur}</div>
    <div class="alert warn"><span class="x">!</span><span>${a.detail}. הבקר ממשיך לטעון; אם המתח לא יעלה מעל 25.5 וולט תוך שעה תישלח התראה חוזרת.</span></div>
    <div class="snap"><div class="hot"><span>מתח מצבר בהתנעה</span><b>${N('23.1 V')}</b></div><div><span>מתח מצבר כעת</span><b>${N('27.4 V')}</b></div><div><span>זמן התנעה</span><b>${N('38 שנ׳')}</b></div><div><span>טמפ׳ נוזל קירור</span><b>${N('84°')}</b></div><div><span>מפלס דלק</span><b>${N('58%')}</b></div><div><span>עומס</span><b>${N('62%')}</b></div></div>
    <span class="h3">ציר זמן</span>
    <div class="tl">
      <div class="ev"><div class="dot err">${ic('alert')}</div><div><b>ההתראה נפתחה</b><small class="num">14:02:41 · מתח 23.1 וולט בזמן ההתנעה</small></div></div>
      <div class="ev"><div class="dot acc">${ic('bell')}</div><div><b>נשלח ל-2 נמענים</b><small>דחיפה: דנה, יוסי · נמסר 14:02:44</small></div></div>
      <div class="ev"><div class="dot warn">${ic('up')}</div><div><b>הסלמה 1 · נשלח למנהלי המערכת</b><small class="num">14:07 · 5 דקות ללא אישור</small></div></div>
      <div class="ev"><div class="dot">${ic('clock')}</div><div><b>ממתין לאישור</b><small>הסלמה 2 תישלח ב-14:12 אם לא יאושר</small></div></div>
    </div>
    <div class="ack-note"><label class="mut">הערה לאישור (לא חובה)</label><textarea placeholder="לדוגמה: מצבר בן 4 שנים, הוזמן חדש"></textarea></div>
    <div class="row"><button class="btn pri">${ic('check')} אישור ההתראה</button><button class="btn">השתקה ל-24 שעות</button><div class="sp"></div><a class="btn ghost sm" onclick="go('set-routing-edit')">ניתוב ההתראה</a></div>`;
  return PH() ? `<div class="scrim" onclick="go('alerts')"><div class="dlg" onclick="event.stopPropagation()">${inner}</div></div>` : `<div class="scrim" onclick="go('alerts')"></div><aside class="drawer">${inner}</aside>`;
}

/* ------------------------------------------------------------------ settings: routing */
function chIcons(p) {
  return `<span class="chs">${CH.map(([k, l, i, cls]) => `<span class="ch ${cls} ${k === 'inbox' || p.ch.includes(k) ? 'on' : ''}" title="${l}">${ic(i)}</span>`).join('')}</span>`;
}
function recChips(p) { if (!p.rec.length) return '<span class="mut">לא נבחרו נמענים</span>'; return `<span class="rec">${p.rec.map((r) => `<span class="${r === 'maint' || r === 'owner' ? 'usr' : 'role'}">${ROLE[r]}</span>`).join('')}</span>`; }
function routingRows(caps) {
  let out = '';
  for (const [gk, gl] of GROUPS) {
    const list = TYPES.filter((x) => x.group === gk);
    if (!list.some((t) => needsMet(t.key, caps))) continue;
    out += `<tr class="grp"><td colspan="7">${gl}</td></tr>`;
    for (const t of list) {
      const p = POL[t.key];
      if (!needsMet(t.key, caps)) { out += `<tr class="off na"><td class="c1 c"><span class="tog dis"></span></td><td class="b">${t.title}</td><td colspan="5"><span class="chip c-mut nodot">דורש חיישן: ${needsMissing(t.key, caps)}</span></td></tr>`; continue; }
      out += `<tr class="pick ${p.on ? '' : 'off'}" onclick="go('set-routing-edit')">
        <td class="c1 c"><span class="tog ${p.on ? 'on' : ''}"></span></td>
        <td class="b">${t.title}</td>
        <td>${sevChip(p.sev)}</td>
        <td>${recChips(p)}</td>
        <td>${chIcons(p)}</td>
        <td class="c">${p.quiet === 'pass' ? '<span class="chip c-ok nodot">עובר</span>' : p.quiet === 'hold' ? '<span class="chip c-mut nodot">מוחזק</span>' : '<span class="mut">לפי המטריצה</span>'}</td>
        <td class="c"><span class="mut">-</span></td>
      </tr>`;
    }
  }
  return out;
}
function routingPhoneList(caps) {
  let out = '';
  for (const [gk, gl] of GROUPS) {
    const list = TYPES.filter((x) => x.group === gk);
    if (!list.some((t) => needsMet(t.key, caps))) continue;
    out += `<div class="h3" style="margin-top:6px">${gl}</div>`;
    for (const t of list) {
      const p = POL[t.key];
      if (!needsMet(t.key, caps)) { out += `<div class="li dis"><div class="grow"><div class="t1">${t.title}</div><div class="t2">דורש חיישן: ${needsMissing(t.key, caps)}</div></div><span class="tog dis"></span></div>`; continue; }
      out += `<div class="li ${p.on ? '' : 'dis'}" onclick="go('set-routing-edit')"><div class="grow"><div class="t1">${t.title}</div><div class="t2">${p.rec.length ? p.rec.map((r) => ROLE[r]).join(' · ') : 'לא נבחרו נמענים'}</div><div style="margin-top:6px">${chIcons(p)}</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">${sevChip(p.sev)}<span class="tog ${p.on ? 'on' : ''}"></span></div></div>`;
    }
  }
  return `<div class="list only-phone" style="flex-direction:column">${out}</div>`;
}
function detectionCard(kind, caps) {
  const n = caps ? caps.size : CAPS.full.length; const al = caps ? TYPES.filter((t) => needsMet(t.key, caps)).length : TYPES.length;
  if (kind === 'none') return `<div class="card"><div class="det"><div class="ic err">${ic('x')}</div><div><b>לא נמצא בקר גנרטור בתשתית המערכת</b><small>הזיהוי סורק את רשימת ההתקנים של תשתית המערכת ומחפש התקן שישויותיו מתאימות לבקר גנרטור (מצב מנוע ומתח לפחות); אינטגרציית ההתקן נלמדת ממנו. נבדק לאחרונה: היום 09:30.</small></div><button class="btn">${ic('refresh')} בדיקה חוזרת</button></div></div>`;
  return `<div class="card"><div class="det"><div class="ic">${ic('check')}</div><div><b>${GEN.name} · ${GEN.model}</b><small>זוהה כהתקן אחד עם כל הישויות שלו · ${n} מתוך ${CAPS.full.length} ערכים, ${al} מתוך ${TYPES.length} סוגי התראה · עודכן לפני 4 שנ׳</small></div><div class="row"><button class="btn sm">מיפוי חיישנים</button><button class="btn sm">${ic('refresh')} בדיקה חוזרת</button></div></div></div>`;
}
function routingScreen(o = {}) {
  const caps = new Set(CAPS[o.caps || 'typical']);
  const body = `<div class="row"><span class="h2">גנרטור</span><div class="sp"></div><div class="seg2"><a class="on">ניתוב התראות</a><a>מיפוי חיישנים</a><a>מבחנים ותחזוקה</a><a>הרשאות</a></div></div>
    ${genPicker()}
    ${detectionCard('ok', caps)}
    <div class="notice warnbox">${ic('info')}<span><b>לא נבחרו נמענים.</b> ההתראות יישמרו במרכז ההתראות בלבד עד שתבחרו נמענים לכל סוג התראה. נוסחי ההודעות כבר מוכנים לכל סוג ואפשר לערוך אותם ולראות תצוגה מקדימה.</span></div>
    <div class="notice">${ic('info')}<span>ניתוב ההתראות מוגדר כאן כבר עכשיו ונשמר. המסירה בפועל לכל ערוץ מתבצעת דרך מרכז ההתראות של המערכת: דחיפה, יישומון ודוא״ל פעילים; WhatsApp יתווסף כשהערוץ ייפתח במרכז ההתראות, בלי להגדיר מחדש.</span></div>
    <div class="row"><span class="h3">ניתוב לפי סוג התראה</span><span class="mut">${TYPES.filter((t) => needsMet(t.key, caps) && POL[t.key].on).length} פעילים · ${TYPES.filter((t) => !needsMet(t.key, caps)).length} ללא חיישן מתאים</span><div class="sp"></div>
      <div class="inp" style="min-height:34px">${ic('search')}<span class="ph">חיפוש סוג התראה</span></div><button class="btn sm">${ic('moon')} שעות שקט: 23:00-07:00</button><button class="btn sm">הסלמה: לפי מרכז ההתראות</button></div>
    <div class="card flush hide-phone"><div class="scrollx"><table class="t routing"><thead><tr><th class="c">פעיל</th><th>התראה</th><th>חומרה</th><th>נמענים</th><th>ערוצים</th><th class="c">בשעות שקט</th><th class="c">הסלמה</th></tr></thead><tbody>${routingRows(caps)}</tbody></table></div></div>
    ${routingPhoneList(caps)}
    <div class="row"><button class="btn pri">שמירה</button><button class="btn">שחזור ברירות המחדל</button><div class="sp"></div><span class="mut">נשמר לאחרונה: היום 08:12 · דנה</span></div>`;
  return shell(body, { area: 'system', overlay: o.overlay });
}
function routingEditOverlay() {
  const t = TY.fail_to_start; const p = POL[t.key];
  const chooser = (items, on, cls = '') => `<div class="chooser">${items.map(([k, l, dis]) => `<label class="${on.includes(k) ? 'on' : ''} ${dis ? 'dis' : ''}"><span class="check ${on.includes(k) ? 'on' : ''} ${dis ? 'dis' : ''}"></span>${l}</label>`).join('')}</div>`;
  const inner = `<div class="row"><span class="h3">${t.title}</span><span class="chip c-mut nodot">מנוע</span><div class="sp"></div><a class="btn ghost sm" onclick="go('set-routing')">${ic('x')}</a></div>
    <div class="rowc"><span>ההתראה פעילה</span><span class="tog on"></span></div>
    <div class="fld"><label>חומרה</label><div class="seg2">${['critical', 'alert', 'info'].map((s) => `<a class="${p.sev === s ? 'on' : ''}">${SEV[s]}</a>`).join('')}</div></div>
    <div class="notice warnbox">${ic('info')}<span>לא נבחרו נמענים: ההתראה תישמר במרכז ההתראות בלבד</span></div>
    <div class="fld"><label>נמענים לפי תפקיד</label>${chooser([['sys', 'מנהלי מערכת'], ['site', 'מנהלי אתר'], ['op', 'מפעילים'], ['view', 'צופים', 1]], p.rec)}</div>
    <div class="fld"><label>נמענים נוספים (משתמשים)</label>${chooser([['maint', 'יוסי · אחראי תחזוקה'], ['owner', 'דנה · בעלת האתר']], p.rec)}<div class="inp" style="margin-top:6px">${ic('search')}<span class="ph">הוספת משתמש</span></div></div>
    <div class="fld"><label>ערוצים</label>${chooser([['inbox', 'מרכז ההתראות (תמיד)'], ['push', 'דחיפה לדפדפן'], ['app', 'יישומון הטלפון'], ['email', 'דוא״ל'], ['whatsapp', 'WhatsApp - בקרוב', 1], ['companion', 'Companion - בקרוב', 1]], ['inbox', ...p.ch])}</div>
    <div class="fld"><label>בשעות שקט (23:00-07:00)</label><div class="seg2"><a class="${p.quiet === 'pass' ? 'on' : ''}">עובר תמיד</a><a class="${p.quiet === 'matrix' ? 'on' : ''}">לפי מטריצת החומרה</a><a class="${p.quiet === 'hold' ? 'on' : ''}">מוחזק</a></div></div>
    <div class="fld"><label>הסלמה ללא אישור</label><div class="rowc"><span class="mut">כבויה; ללא נמענים אין למי להסלים</span><span class="tog"></span></div></div>
    <div class="fld"><label>נוסח ההודעה</label>
      <div class="inp tpl"><span>כשל התנעה: {device} לא התניע ב-{time}. מתח מצבר {battery}, מפלס דלק {fuel}.</span></div>
      <div class="mut">משתנים: <code>{device}</code> <code>{time}</code> <code>{battery}</code> <code>{fuel}</code> <code>{load}</code> <code>{site}</code> · משתנה שהחיישן שלו חסר נשמט מההודעה</div>
      <div class="preview"><div class="mut">תצוגה מקדימה</div><b>כשל התנעה</b><div>גנרטור ראשי לא התניע ב-14:02. מתח מצבר 23.1 V, מפלס דלק 58%.</div></div>
      <div class="row"><button class="btn sm ghost">שחזור הנוסח המוכן</button></div></div>
    <div class="fld"><label>השהיה לפני שליחה</label><div class="row"><div class="inp" style="width:120px"><span class="num">0</span><span class="mut">שניות</span></div><span class="mut">0 = מיידי; מונע התראות על תקלה שחולפת לבד</span></div></div>
    <div class="row" style="margin-top:4px"><button class="btn pri" onclick="go('set-routing')">שמירה</button><button class="btn" onclick="go('set-routing')">ביטול</button><div class="sp"></div><button class="btn ghost sm">${ic('bell')} שליחת בדיקה</button></div>`;
  return PH() ? `<div class="scrim" onclick="go('set-routing')"><div class="dlg" onclick="event.stopPropagation()" style="max-height:92%;overflow:auto">${inner}</div></div>` : `<div class="scrim" onclick="go('set-routing')"></div><aside class="drawer">${inner}</aside>`;
}

/* ------------------------------------------------------------------ states */
function notFoundScreen() {
  const body = `<div class="card"><div class="empty"><div class="ic">${ic('engine')}</div><h3>לא נמצא גנרטור</h3>
      <div class="mut" style="max-width:520px">המסך נבנה אוטומטית כשבתשתית המערכת קיים התקן של בקר גנרטור. נבדק לאחרונה: היום 09:30.</div>
      <div class="row" style="justify-content:center"><button class="btn pri">${ic('refresh')} בדיקה חוזרת</button><button class="btn">בחירת התקן ידנית</button></div></div></div>
    <div class="card"><div class="hd"><span class="h3">איך הזיהוי עובד</span></div>
      <dl class="kv"><dt>1</dt><dd>קריאת רשימת ההתקנים של התשתית; כל גנרטור הוא התקן אחד וכל הישויות שלו תחתיו.</dd><dt>2</dt><dd>התקן שיש לו ישויות של מצב מנוע ומתח נחשב גנרטור; שאר החיישנים נקבעים לפי היכולות שלו.</dd><dt>3</dt><dd>התקן שנמצא מופיע בהגדרות › תשתיות › גנרטור, ומסך הגנרטור נפתח למי שיש לו הרשאת צפייה.</dd></dl></div>`;
  return shell(body, { l2: 'live', activeCount: 0, noL2: true });
}
function loadingScreen() {
  const sk = (w, h = 14) => `<div class="sk" style="width:${w};height:${h}px"></div>`;
  const body = `<div class="status-strip">${sk('320px', 22)}<div class="sp"></div>${sk('90px')}</div>
    <div class="hero"><div class="card">${sk('120px')}<div style="height:280px"></div></div><div class="card">${sk('100px')}<div style="display:flex;flex-direction:column;gap:12px;margin-top:14px">${sk('80%')}${sk('70%')}${sk('85%')}${sk('60%')}${sk('75%')}</div></div></div>
    <div class="gauges">${[1, 2, 3, 4].map(() => `<div class="gauge" style="min-height:140px">${sk('70px', 70)}${sk('60px')}</div>`).join('')}</div>`;
  return shell(body, { l2: 'live', activeCount: 0 });
}
/* ------------------------------------------------------------------ screens index */
const SCREENS = {
  'live': ['מצב חי · בקר טיפוסי (ללא דלק ושמן): הגנרטור מזין את האתר', () => liveScreen('run', { caps: 'typical' })],
  'live-full': ['מצב חי · בקר מלא (כל החיישנים)', () => liveScreen('run', { caps: 'full' })],
  'live-min': ['מצב חי · בקר מינימלי (מצב ומתח בלבד)', () => liveScreen('run', { caps: 'minimal' })],
  'charts': ['גרפים: מסך מלא (עומס, 24 שעות)', () => { RANGE = '24h'; METRIC = 'pct'; return chartsScreen('full'); }],
  'charts-7d': ['גרפים: מסך מלא (דלק, 7 ימים)', () => { RANGE = '7d'; METRIC = 'fuel'; return chartsScreen('full'); }],
  'charts-min': ['גרפים: בקר מינימלי (מתח בלבד)', () => { RANGE = '24h'; METRIC = 'volt'; return chartsScreen('minimal'); }],
  'diagram': ['תרשים הזרימה: לפני / אחרי, יכולות, טלפון', diagramCompareScreen],
  'live-standby': ['מצב חי: במנוחה, האתר מוזן מהרשת', () => liveScreen('standby', { caps: 'full' })],
  'live-test': ['מצב חי: ריצת מבחן שהבקר הפעיל, ללא עומס', () => liveScreen('test', { caps: 'full' })],
  'alerts': ['התראות פעילות', alertsScreen],
  'alerts-empty': ['התראות פעילות: ריק', alertsEmptyScreen],
  'history': ['היסטוריית התראות עם מסננים', () => historyScreen()],
  'alert': ['פרטי התראה ואישור', () => historyScreen({ sel: 2, overlay: alertDetailOverlay() })],
  'set-routing': ['הגדרות › תשתיות › גנרטור: ניתוב התראות (בקר טיפוסי)', () => routingScreen({ caps: 'typical' })],
  'set-routing-full': ['ניתוב התראות: בקר מלא', () => routingScreen({ caps: 'full' })],
  'set-routing-min': ['ניתוב התראות: בקר מינימלי', () => routingScreen({ caps: 'minimal' })],
  'set-routing-edit': ['עריכת ניתוב של סוג התראה', () => routingScreen({ overlay: routingEditOverlay() })],
  'not-found': ['לא נמצא גנרטור', notFoundScreen],
  'unavail': ['זוהה אך אין תקשורת', () => liveScreen('unavail', { caps: 'typical' })],
  'set-not-found': ['הגדרות: לא זוהה בקר', () => shell(`<div class="row"><span class="h2">גנרטור</span></div>${detectionCard('none')}<div class="card"><div class="empty"><div class="ic">${ic('bell')}</div><h3>ניתוב ההתראות יופיע אחרי הזיהוי</h3><div class="mut">ברירות המחדל נטענות אוטומטית לפי קטלוג ההתראות של הבקר</div></div></div>`, { area: 'system' })],
  'loading': ['טעינה', loadingScreen],
};

/* ------------------------------------------------------------------ gallery bar + render */
function bar() {
  const opt = (k, items) => items.map(([v, l]) => `<button class="${S[k] === v ? 'on' : ''}" onclick="S.${k}='${v}';render()">${l}</button>`).join('');
  return `<b>Arx · מוקאפ גנרטור</b>
    <label>מסך <select onchange="go(this.value)">${Object.entries(SCREENS).map(([k, [l]]) => `<option value="${k}" ${S.s === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <span class="seg">${opt('d', [['desktop', '1440'], ['tablet', '820'], ['phone', '390']])}</span>
    <span class="seg">${opt('t', [['light', 'בהיר'], ['dark', 'כהה']])}</span>
    <span class="seg">${opt('k', [['classic', 'classic'], ['domus', 'domus'], ['tesla', 'tesla'], ['bubble', 'bubble']])}</span>
    <a href="index.html" style="margin-inline-start:auto">חזרה לאינדקס</a>`;
}
function render() {
  writeHash();
  document.body.dataset.gal = S.t;
  document.getElementById('bar').innerHTML = bar();
  const [cap, fn] = SCREENS[S.s] || SCREENS.live;
  document.getElementById('stage').innerHTML = `<div id="cap">${cap} · <span class="num">${S.d} / ${S.t} / ${S.k}</span></div><div id="frame" class="d-${S.d}" data-skin="${S.k}" data-theme="${S.t}" dir="rtl">${fn()}</div>`;
}
readHash();
window.addEventListener('hashchange', () => { readHash(); render(); });
render();
