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
  POL[t.key] = { on: true, sev: t.sev, rec: crit ? ['sys', 'site', 'maint'] : t.sev === 'alert' ? ['site', 'maint'] : ['site'], ch: crit ? ['push', 'app', 'email'] : t.sev === 'alert' ? ['push', 'app'] : [], quiet: crit ? 'pass' : 'matrix', esc: crit };
}
POL.service_due.ch = ['email']; POL.service_due.rec = ['maint'];
POL.test_done.ch = []; POL.test_done.rec = ['maint'];
POL.mains_restored.ch = ['push'];
POL.not_auto.on = false;
POL.ats_to_gen.rec = ['site', 'owner'];
const CH = [['inbox', 'מרכז ההתראות', 'inbox', 'lock'], ['push', 'דחיפה לדפדפן', 'bell', ''], ['app', 'יישומון הטלפון', 'phone', ''], ['email', 'דוא״ל', 'mail', ''], ['whatsapp', 'WhatsApp - בקרוב', 'chat', 'soon']];

/* ------------------------------------------------------------------ shell */
const RAIL = [['devices', 'home', 'ראשי'], ['security', 'shield', 'אבטחה'], ['explore', 'map', 'מפה'], ['multimedia', 'media', 'מולטימדיה'], ['wiskey', 'door', 'WisKey'], ['infra', 'bolt', 'תשתיות']];
const L1_INFRA = [['electricity', 'מוני חשמל'], ['generator', 'גנרטור']];
const L2_GEN = [['live', 'מצב חי', 'live'], ['alerts', 'התראות פעילות', 'alerts'], ['history', 'היסטוריה', 'history']];
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

/* ------------------------------------------------------------------ pieces: flow diagram, gauges, tables */
function flowSvg(g) {
  // geometry (LTR, never mirrored): grid top-left, generator bottom-left, ATS centre, load right
  const T = (x) => x; // plain text: HTML spans are not allowed inside SVG text
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
  return `<svg class="flow" viewBox="0 0 ${W} ${H}" role="img" aria-label="תרשים זרימת הספק">
    ${wire(gridD, mainsOn && !onGen, false)}
    ${wire(genD, onGen, true)}
    ${wire(loadD, kwOnWire > 0, onGen)}
    <!-- grid -->
    ${node(20, 40, 160, 80, mainsOn ? 'grid' : 'dim')}
    ${iconG(34, 52, 'grid', mainsOn ? 'grid' : 'dim')}
    <text x="82" y="66" class="lbl">רשת החשמל</text>
    <text x="82" y="88" class="val">${mainsOn ? T('230 V · 50.0 Hz') : 'אין מתח'}</text>
    ${tag(100, 130, mainsOn ? 'זמינה' : 'נפלה ' + (g.since || ''), mainsOn ? 'ok' : 'err', mainsOn ? 60 : 92)}
    <!-- generator -->
    ${node(20, 180, 160, 80, genRun ? 'gen' : 'dim')}
    ${iconG(34, 192, 'engine', genRun ? 'gen' : 'dim')}
    <text x="82" y="206" class="lbl">${GEN.name}</text>
    <text x="82" y="228" class="val">${genRun ? T(f0(g.rpm) + ' rpm · ' + f1(g.hz) + ' Hz') : 'כבוי'}</text>
    ${tag(100, 270, genRun ? (onGen ? 'פועל · בעומס' : 'פועל · ללא עומס') : 'במנוחה', genRun ? 'ok' : 'mut', 96)}
    <!-- ATS -->
    ${node(295, 115, 60, 70, 'ats')}
    <circle cx="325" cy="150" r="4" fill="var(--sw-accent)"/>
    <path d="${bladeTo}" class="blade"/>
    <circle cx="297" cy="138" r="3" fill="var(--gen-grid)"/><circle cx="297" cy="162" r="3" fill="var(--gen-gen)"/>
    <text x="325" y="106" text-anchor="middle" class="small">מתג העברה</text>
    ${tag(325, 200, onGen ? 'גנרטור' : mainsOn ? 'רשת' : 'מנותק', onGen ? 'ok' : mainsOn ? 'ok' : 'err', 60)}
    <!-- wire value -->
    <rect x="374" y="124" width="78" height="22" rx="11" class="tag ${kwOnWire ? (onGen ? 'ok' : '') : 'err'}"/>
    <text x="413" y="139" text-anchor="middle" class="tagt ${onGen ? 'ok' : 'mut'}">${kwOnWire ? T(f0(kwOnWire) + ' kW') : '0 kW'}</text>
    <!-- load -->
    ${node(470, 110, 160, 80, kwOnWire ? 'load' : 'dim')}
    ${iconG(484, 122, 'load', kwOnWire ? 'load' : 'dim')}
    <text x="532" y="136" class="lbl">צרכני האתר</text>
    <text x="532" y="158" class="val">${T(f0(kwOnWire) + ' kW')}</text>
    ${tag(550, 200, onGen ? `${g.pct}% מהגנרטור` : mainsOn ? 'מוזן מהרשת' : 'ללא הזנה', onGen ? 'warn' : mainsOn ? 'ok' : 'err', 100)}
  </svg>`;
}
function gauge(label, val, unit, pct, cls, lim) {
  // 240-degree arc from -210 to +30 degrees, radius 42 in a 120x90 box
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
  const fuelCls = g.fuel < 25 ? 'err' : g.fuel < 40 ? 'warn' : 'ok';
  const battCls = g.batt < 24 ? 'err' : g.batt < 25.5 ? 'warn' : 'ok';
  const coolCls = g.cool > 98 ? 'err' : g.cool > 92 ? 'warn' : 'ok';
  const oilCls = g.state === 'running' ? (g.oil < 1.5 ? 'err' : g.oil < 2.5 ? 'warn' : 'ok') : 'ok';
  return `<div class="gauges ${stale ? 'stale' : ''}">
    ${gauge('מפלס דלק', N(g.fuel), '%', g.fuel, fuelCls, 'התראה מתחת ל-25%')}
    ${gauge('מתח מצבר', N(f1(g.batt)), 'V', ((g.batt - 20) / 10) * 100, battCls, 'תקין 25.5-29 וולט')}
    ${gauge('טמפרטורת נוזל קירור', N(g.cool), '°C', (g.cool / 110) * 100, coolCls, 'גבול 98°')}
    ${gauge('לחץ שמן', N(f1(g.oil)), 'bar', (g.oil / 6) * 100, oilCls, g.state === 'running' ? 'מינימום 1.5' : 'המנוע במנוחה')}
  </div>`;
}
function phaseTable(g) {
  const run = g.state === 'running';
  const row = (i) => {
    const kw = run && g.onload ? Math.round((g.v[i] * g.a[i] * g.pf) / 1000) : 0;
    const pct = run && g.onload ? Math.round((g.a[i] / 360) * 100) : 0;
    const vCls = g.v[i] && (g.v[i] < 207 || g.v[i] > 253) ? 'err' : '';
    return `<tr><td class="b">L${i + 1}</td><td class="num ${vCls}">${run ? f0(g.v[i]) + ' V' : '-'}</td><td class="num">${run ? f0(g.a[i]) + ' A' : '-'}</td><td class="num">${run ? kw + ' kW' : '-'}</td><td><div class="pbar"><i class="${pct > 90 ? 'err' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></i></div></td></tr>`;
  };
  return `<div class="card flush"><div class="hd"><span class="h3">מתח, זרם והספק לפי פאזה</span><div class="sp"></div>
      <span class="mut">תדר ${N(run ? f1(g.hz) + ' Hz' : '-')} · מקדם הספק ${N(run && g.onload ? g.pf : '-')}</span></div>
    <div class="scrollx"><table class="t phase"><thead><tr><th>פאזה</th><th>מתח</th><th>זרם</th><th>הספק</th><th>עומס</th></tr></thead>
    <tbody>${[0, 1, 2].map(row).join('')}</tbody>
    <tfoot><tr><td>סה״כ</td><td class="num">${run ? 'ממוצע ' + f0((g.v[0] + g.v[1] + g.v[2]) / 3) + ' V' : '-'}</td><td class="num">${run ? f0(g.a[0] + g.a[1] + g.a[2]) + ' A' : '-'}</td><td class="num">${run ? f0(g.kw) + ' kW' : '-'}</td><td>${run && g.onload ? N(g.pct + '%') + ' מ-' + N(GEN.rated_kw + ' kW') : ''}</td></tr></tfoot></table></div></div>`;
}
function engineCard(g, stale) {
  const [label, cls] = ST[g.state];
  return `<div class="card ${stale ? 'stale' : ''}"><div class="hd"><span class="h3">מנוע ובקר</span><div class="sp"></div><span class="last-seen">${ic('clock')} ${stale ? 'נקלט לאחרונה 09:41' : 'עודכן לפני 4 שנ׳'}</span></div>
    <dl class="kv">
      <dt>מצב המנוע</dt><dd><span class="chip c-${cls === 'ok' ? 'ok' : cls === 'err' ? 'err' : cls === 'warn' ? 'warn' : 'mut'}">${label}</span>${g.since ? ` <span class="mut">מאז ${g.since}</span>` : ''}</dd>
      <dt>מצב הבקר</dt><dd>${MODE[g.mode]}${g.mode !== 'auto' ? ' <span class="chip c-warn nodot">לא אוטומטי</span>' : ''}</dd>
      <dt>שעות עבודה</dt><dd>${N(f1(g.hours))} שעות · ${N(g.starts)} התנעות</dd>
      <dt>סל״ד</dt><dd>${g.state === 'running' ? N(f0(g.rpm)) : '-'}</dd>
      <dt>התנעה אחרונה</dt><dd>${g.state === 'running' && g.since ? 'היום ' + g.since : '28.09 09:00'} · ${g.mode === 'test' ? 'ריצת מבחן' : g.onload ? 'אובדן רשת' : 'ריצת מבחן שבועית'}</dd>
      <dt>מבחן אחרון</dt><dd>28.09 09:00 · <span class="chip c-ok nodot">עבר</span> 20 דק׳</dd>
      <dt>מבחן הבא</dt><dd>12.10 09:00 · שבועי, ללא עומס</dd>
      <dt>טיפול הבא</dt><dd>ב-${N('1,330')} שעות · <span class="chip c-warn nodot">בעוד 46 שעות</span></dd>
    </dl></div>`;
}
function modeCard(g, locked, why) {
  return `<div class="card"><div class="hd"><span class="h3">מצב הפעלה</span><div class="sp"></div>${locked ? `<span class="chip c-mut nodot">${ic(why ? 'link' : 'user')} ${why || 'צפייה בלבד'}</span>` : ''}</div>
    <div class="mode">${['auto', 'manual', 'off'].map((m) => `<a class="${g.mode === m || (m === 'auto' && g.mode === 'test') ? 'on ' + m : ''}">${MODE[m]}</a>`).join('')}</div>
    <div class="actions" style="margin-top:12px">
      <button class="btn pri" onclick="go('confirm-test')" ${locked ? 'disabled' : ''}>${ic('play')} ריצת מבחן</button>
      <button class="btn dng" ${g.state !== 'running' || locked ? 'disabled' : ''}>${ic('stop')} עצירה</button>
      <button class="btn" ${locked ? 'disabled' : ''}>${ic('check')} אישור כל ההתראות</button>
    </div></div>`;
}
function statusStrip(g, extra = '') {
  const [label, cls] = ST[g.state];
  const txt = g.state === 'running' ? (g.onload ? `${GEN.name} פועל ומזין את האתר` : g.mode === 'test' ? `${GEN.name} בריצת מבחן` : `${GEN.name} פועל ללא עומס`) : g.state === 'stopped' ? `${GEN.name} במנוחה · האתר מוזן מהרשת` : `${GEN.name} · ${label}`;
  return `<div class="status-strip"><span class="big"><span class="pulse ${cls}"></span>${txt}</span>
    <span class="mut">${GEN.place} · ${N(GEN.rated_kva + ' kVA')}</span><div class="sp"></div>${extra}</div>`;
}
function liveScreen(key, opts = {}) {
  const g = SCEN[key];
  const locked = !!opts.locked;
  const stale = key === 'unavail';
  const banner = stale ? `<div class="banner err">${ic('link')}<b>אין תקשורת עם בקר הגנרטור</b><span>מאז 09:41 · הערכים מוצגים כפי שנקלטו לאחרונה</span><div class="sp"></div><button class="btn sm">${ic('refresh')} בדיקה חוזרת</button></div>` : '';
  const quick = PH() ? `<div class="kpi-row"><div class="kpi"><div class="k">עומס</div><div class="v">${N(g.pct + '%')}</div></div><div class="kpi"><div class="k">הספק</div><div class="v">${N(f0(g.kw) + ' kW')}</div></div><div class="kpi"><div class="k">דלק</div><div class="v">${N(g.fuel + '%')}</div></div></div>` : '';
  const body = `${banner}
    ${statusStrip(g, stale ? '' : `<span class="last-seen">${ic('clock')} נתונים חיים</span>`)}
    ${quick}
    <div class="hero">
      <div class="card ${stale ? 'stale' : ''}"><div class="hd"><span class="h3">זרימת הספק</span><div class="sp"></div>${g.onload ? sevChip('alert', 'אובדן רשת ' + g.since) : g.mode === 'test' ? sevChip('info', 'מבחן ללא עומס') : sevChip('cleared', 'רשת זמינה')}</div>${flowSvg(g)}</div>
      ${engineCard(g, stale)}
    </div>
    ${gauges(g, stale)}
    <div class="cols side-l">
      <div class="${stale ? 'stale' : ''}">${phaseTable(g)}</div>
      ${modeCard(g, locked || stale, stale ? 'אין תקשורת' : '')}
    </div>`;
  return shell(body, { l2: 'live', activeCount: key === 'run' ? 2 : key === 'standby' ? 0 : 1, overlay: opts.overlay });
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
  const body = `<div class="row"><span class="h2">התראות פעילות</span><span class="chip c-err">${open} ללא אישור</span><span class="chip c-mut">${ACTIVE.length - open} אושרו</span><div class="sp"></div>
      <button class="btn">${ic('check')} אישור הכול</button></div>
    <div class="list">${ACTIVE.map((a) => alertCard(a, false)).join('')}</div>`;
  return shell(body, { l2: 'alerts', activeCount: open });
}
function alertsEmptyScreen() {
  const body = `<div class="row"><span class="h2">התראות פעילות</span></div>
    <div class="card"><div class="empty"><div class="ic">${ic('check')}</div><h3>אין התראות פעילות</h3><div class="mut">ההתראה האחרונה נסגרה ב-28.09 09:20 · <a class="btn ghost sm" onclick="go('history')">להיסטוריה</a></div></div></div>`;
  return shell(body, { l2: 'alerts', activeCount: 0 });
}
function historyScreen(o = {}) {
  const rows = HIST.map((h, i) => `<tr class="${o.sel === i ? 'sel' : ''}" onclick="go('alert')" style="cursor:pointer">
      <td class="num">${h.at}</td><td class="b">${TY[h.t].title}</td><td>${sevChip(h.sev)}</td><td>${h.closed === 'פעיל' ? '<span class="chip c-err">פעיל</span>' : '<span class="mut">' + h.closed + '</span>'}</td>
      <td>${h.ack === '-' ? '<span class="mut">לא נדרש</span>' : h.ack ? h.ack + ' <span class="mut num">' + h.ackAt + '</span>' : '<span class="chip c-warn">ממתין</span>'}</td></tr>`).join('');
  const phoneRows = HIST.map((h) => `<div class="li" onclick="go('alert')"><div class="grow"><div class="t1">${TY[h.t].title}</div><div class="t2 num">${h.at} · ${h.closed}</div></div>${sevChip(h.sev)}</div>`).join('');
  const body = `<div class="row"><span class="h2">היסטוריית התראות</span><div class="sp"></div><button class="btn sm">ייצוא CSV</button></div>
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
function recChips(p) { return `<span class="rec">${p.rec.map((r) => `<span class="${r === 'maint' || r === 'owner' ? 'usr' : 'role'}">${ROLE[r]}</span>`).join('')}</span>`; }
function routingRows() {
  let out = '';
  for (const [gk, gl] of GROUPS) {
    out += `<tr class="grp"><td colspan="7">${gl}</td></tr>`;
    for (const t of TYPES.filter((x) => x.group === gk)) {
      const p = POL[t.key];
      out += `<tr class="pick ${p.on ? '' : 'off'}" onclick="go('set-routing-edit')">
        <td class="c1 c"><span class="tog ${p.on ? 'on' : ''}"></span></td>
        <td class="b">${t.title}</td>
        <td>${sevChip(p.sev)}</td>
        <td>${recChips(p)}</td>
        <td>${chIcons(p)}</td>
        <td class="c">${p.quiet === 'pass' ? '<span class="chip c-ok nodot">עובר</span>' : p.quiet === 'hold' ? '<span class="chip c-mut nodot">מוחזק</span>' : '<span class="mut">לפי המטריצה</span>'}</td>
        <td class="c">${p.esc ? '<span class="chip c-acc nodot">' + ic('up') + ' 5 דק׳ · 2 שלבים</span>' : '<span class="mut">-</span>'}</td>
      </tr>`;
    }
  }
  return out;
}
function routingPhoneList() {
  let out = '';
  for (const [gk, gl] of GROUPS) {
    out += `<div class="h3" style="margin-top:6px">${gl}</div>`;
    for (const t of TYPES.filter((x) => x.group === gk)) {
      const p = POL[t.key];
      out += `<div class="li ${p.on ? '' : 'dis'}" onclick="go('set-routing-edit')"><div class="grow"><div class="t1">${t.title}</div><div class="t2">${p.rec.map((r) => ROLE[r]).join(' · ')}</div><div style="margin-top:6px">${chIcons(p)}</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">${sevChip(p.sev)}<span class="tog ${p.on ? 'on' : ''}"></span></div></div>`;
    }
  }
  return `<div class="list only-phone" style="flex-direction:column">${out}</div>`;
}
function detectionCard(kind) {
  if (kind === 'none') return `<div class="card"><div class="det"><div class="ic err">${ic('x')}</div><div><b>לא נמצא בקר גנרטור בתשתית המערכת</b><small>הזיהוי מחפש התקן של אינטגרציית הגנרטור (לפי מזהה האינטגרציה) ולחלופין התקן שיש לו ישויות מצב מנוע, שעות עבודה ומפלס דלק. נבדק לאחרונה: היום 09:30.</small></div><button class="btn">${ic('refresh')} בדיקה חוזרת</button></div></div>`;
  return `<div class="card"><div class="det"><div class="ic">${ic('check')}</div><div><b>${GEN.name} · ${GEN.model}</b><small>זוהה אוטומטית בתשתית המערכת · 38 חיישנים, 14 התראות ממופות, 3 פקודות · עודכן לפני 4 שנ׳</small></div><div class="row"><button class="btn sm">מיפוי חיישנים</button><button class="btn sm">${ic('refresh')} בדיקה חוזרת</button></div></div></div>`;
}
function routingScreen(o = {}) {
  const body = `<div class="row"><span class="h2">גנרטור</span><div class="sp"></div><div class="seg2"><a class="on">ניתוב התראות</a><a>מיפוי חיישנים</a><a>מבחנים ותחזוקה</a><a>הרשאות</a></div></div>
    ${detectionCard('ok')}
    <div class="notice">${ic('info')}<span>ניתוב ההתראות מוגדר כאן כבר עכשיו ונשמר. המסירה בפועל לכל ערוץ מתבצעת דרך מרכז ההתראות של המערכת: דחיפה, יישומון ודוא״ל פעילים; WhatsApp יתווסף כשהערוץ ייפתח במרכז ההתראות, בלי להגדיר מחדש.</span></div>
    <div class="row"><span class="h3">ניתוב לפי סוג התראה</span><span class="mut">${TYPES.filter((t) => POL[t.key].on).length} מתוך ${TYPES.length} פעילים</span><div class="sp"></div>
      <div class="inp" style="min-height:34px">${ic('search')}<span class="ph">חיפוש סוג התראה</span></div><button class="btn sm">${ic('moon')} שעות שקט: 23:00-07:00</button><button class="btn sm">הסלמה: 5 דק׳ · 2 שלבים</button></div>
    <div class="card flush hide-phone"><div class="scrollx"><table class="t routing"><thead><tr><th class="c">פעיל</th><th>התראה</th><th>חומרה</th><th>נמענים</th><th>ערוצים</th><th class="c">בשעות שקט</th><th class="c">הסלמה</th></tr></thead><tbody>${routingRows()}</tbody></table></div></div>
    ${routingPhoneList()}
    <div class="row"><button class="btn pri">שמירה</button><button class="btn">שחזור ברירות המחדל</button><div class="sp"></div><span class="mut">נשמר לאחרונה: היום 08:12 · דנה</span></div>`;
  return shell(body, { area: 'system', overlay: o.overlay });
}
function routingEditOverlay() {
  const t = TY.fail_to_start; const p = POL[t.key];
  const chooser = (items, on, cls = '') => `<div class="chooser">${items.map(([k, l, dis]) => `<label class="${on.includes(k) ? 'on' : ''} ${dis ? 'dis' : ''}"><span class="check ${on.includes(k) ? 'on' : ''} ${dis ? 'dis' : ''}"></span>${l}</label>`).join('')}</div>`;
  const inner = `<div class="row"><span class="h3">${t.title}</span><span class="chip c-mut nodot">מנוע</span><div class="sp"></div><a class="btn ghost sm" onclick="go('set-routing')">${ic('x')}</a></div>
    <div class="rowc"><span>ההתראה פעילה</span><span class="tog on"></span></div>
    <div class="fld"><label>חומרה</label><div class="seg2">${['critical', 'alert', 'info'].map((s) => `<a class="${p.sev === s ? 'on' : ''}">${SEV[s]}</a>`).join('')}</div></div>
    <div class="fld"><label>נמענים לפי תפקיד</label>${chooser([['sys', 'מנהלי מערכת'], ['site', 'מנהלי אתר'], ['op', 'מפעילים'], ['view', 'צופים', 1]], p.rec)}</div>
    <div class="fld"><label>נמענים נוספים (משתמשים)</label>${chooser([['maint', 'יוסי · אחראי תחזוקה'], ['owner', 'דנה · בעלת האתר']], p.rec)}<div class="inp" style="margin-top:6px">${ic('search')}<span class="ph">הוספת משתמש</span></div></div>
    <div class="fld"><label>ערוצים</label>${chooser([['inbox', 'מרכז ההתראות (תמיד)'], ['push', 'דחיפה לדפדפן'], ['app', 'יישומון הטלפון'], ['email', 'דוא״ל'], ['whatsapp', 'WhatsApp - בקרוב', 1], ['companion', 'Companion - בקרוב', 1]], ['inbox', ...p.ch])}</div>
    <div class="fld"><label>בשעות שקט (23:00-07:00)</label><div class="seg2"><a class="${p.quiet === 'pass' ? 'on' : ''}">עובר תמיד</a><a class="${p.quiet === 'matrix' ? 'on' : ''}">לפי מטריצת החומרה</a><a class="${p.quiet === 'hold' ? 'on' : ''}">מוחזק</a></div></div>
    <div class="fld"><label>הסלמה ללא אישור</label><div class="rowc"><span class="esc-steps"><span class="n">1</span> אחרי 5 דק׳ · מנהלי מערכת <span class="ar">←</span> <span class="n">2</span> אחרי 10 דק׳ · כל הערוצים</span><span class="tog ${p.esc ? 'on' : ''}"></span></div></div>
    <div class="fld"><label>השהיה לפני שליחה</label><div class="row"><div class="inp" style="width:120px"><span class="num">0</span><span class="mut">שניות</span></div><span class="mut">0 = מיידי; מונע התראות על תקלה שחולפת לבד</span></div></div>
    <div class="row" style="margin-top:4px"><button class="btn pri" onclick="go('set-routing')">שמירה</button><button class="btn" onclick="go('set-routing')">ביטול</button><div class="sp"></div><button class="btn ghost sm">${ic('bell')} שליחת בדיקה</button></div>`;
  return PH() ? `<div class="scrim" onclick="go('set-routing')"><div class="dlg" onclick="event.stopPropagation()" style="max-height:92%;overflow:auto">${inner}</div></div>` : `<div class="scrim" onclick="go('set-routing')"></div><aside class="drawer">${inner}</aside>`;
}

/* ------------------------------------------------------------------ states */
function notFoundScreen() {
  const body = `<div class="card"><div class="empty"><div class="ic">${ic('engine')}</div><h3>לא נמצא גנרטור</h3>
      <div class="mut" style="max-width:520px">המסך נבנה אוטומטית כשבתשתית המערכת מותקנת אינטגרציית בקר גנרטור. נבדק לאחרונה: היום 09:30.</div>
      <div class="row" style="justify-content:center"><button class="btn pri">${ic('refresh')} בדיקה חוזרת</button><button class="btn">בחירת התקן ידנית</button></div></div></div>
    <div class="card"><div class="hd"><span class="h3">איך הזיהוי עובד</span></div>
      <dl class="kv"><dt>1</dt><dd>חיפוש אינטגרציה לפי מזהה (רשימת האינטגרציות המותקנות).</dd><dt>2</dt><dd>אם אין: חיפוש התקן שיש לו יחד ישויות של מצב מנוע, שעות עבודה ומפלס דלק.</dd><dt>3</dt><dd>התקן שנמצא מופיע בהגדרות › תשתיות › גנרטור, ומסך הגנרטור נפתח למי שיש לו הרשאת צפייה.</dd></dl></div>`;
  return shell(body, { l2: 'live', activeCount: 0, noL2: true });
}
function loadingScreen() {
  const sk = (w, h = 14) => `<div class="sk" style="width:${w};height:${h}px"></div>`;
  const body = `<div class="status-strip">${sk('320px', 22)}<div class="sp"></div>${sk('90px')}</div>
    <div class="hero"><div class="card">${sk('120px')}<div style="height:280px"></div></div><div class="card">${sk('100px')}<div style="display:flex;flex-direction:column;gap:12px;margin-top:14px">${sk('80%')}${sk('70%')}${sk('85%')}${sk('60%')}${sk('75%')}</div></div></div>
    <div class="gauges">${[1, 2, 3, 4].map(() => `<div class="gauge" style="min-height:140px">${sk('70px', 70)}${sk('60px')}</div>`).join('')}</div>`;
  return shell(body, { l2: 'live', activeCount: 0 });
}
function confirmTestOverlay() {
  return `<div class="scrim"><div class="dlg"><h3>להתחיל ריצת מבחן?</h3>
    <div class="kv" style="display:grid"><dt>גנרטור</dt><dd>${GEN.name}</dd><dt>סוג</dt><dd>ללא עומס · 20 דקות · עצירה אוטומטית</dd><dt>תנאים</dt><dd>רשת זמינה · מצב אוטומטי · דלק 92%</dd></div>
    <div class="alert warn"><span class="x">!</span><span>הפקודה נשלחת לבקר הגנרטור ונרשמת ביומן על שמך.</span></div>
    <div class="act"><button class="btn pri" onclick="go('live-test')">${ic('play')} התחלת מבחן</button><button class="btn" onclick="go('live-standby')">ביטול</button></div></div></div>`;
}

/* ------------------------------------------------------------------ screens index */
const SCREENS = {
  'live': ['מצב חי: הגנרטור מזין את האתר (אובדן רשת)', () => liveScreen('run')],
  'live-standby': ['מצב חי: במנוחה, האתר מוזן מהרשת', () => liveScreen('standby')],
  'live-test': ['מצב חי: ריצת מבחן ללא עומס', () => liveScreen('test')],
  'live-view': ['מצב חי: משתמש עם צפייה בלבד', () => liveScreen('run', { locked: true })],
  'confirm-test': ['אישור ריצת מבחן', () => liveScreen('standby', { overlay: confirmTestOverlay() })],
  'alerts': ['התראות פעילות', alertsScreen],
  'alerts-empty': ['התראות פעילות: ריק', alertsEmptyScreen],
  'history': ['היסטוריית התראות עם מסננים', () => historyScreen()],
  'alert': ['פרטי התראה ואישור', () => historyScreen({ sel: 2, overlay: alertDetailOverlay() })],
  'set-routing': ['הגדרות › תשתיות › גנרטור: ניתוב התראות', () => routingScreen()],
  'set-routing-edit': ['עריכת ניתוב של סוג התראה', () => routingScreen({ overlay: routingEditOverlay() })],
  'not-found': ['לא נמצא גנרטור', notFoundScreen],
  'unavail': ['זוהה אך אין תקשורת', () => liveScreen('unavail')],
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
