/* Device activity popup (DEVHIST / CR-032) - static mockup gallery. Fake data only (an invented home, invented people); no device, no live system.
   State in the URL hash: #s=<screen>&d=desktop|tablet|phone&t=light|dark&k=classic|domus|tesla|bubble
   Not product code. */
'use strict';
const S = { s: 'press', d: 'desktop', t: 'light', k: 'classic' };
function readHash() { const h = new URLSearchParams(location.hash.slice(1)); for (const k of Object.keys(S)) if (h.get(k)) S[k] = h.get(k); }
function writeHash() { const h = new URLSearchParams(); for (const [k, v] of Object.entries(S)) h.set(k, v); history.replaceState(null, '', '#' + h.toString()); }
const PH = () => S.d === 'phone';
const N = (s) => `<span class="num">${s}</span>`;

const P = {
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
  cover: 'M4 4h16M4 8h16M4 12h16M12 12v8M9 20h6',
  snow: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9 4l3 2 3-2M9 20l3-2 3 2',
  fan: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M12 10.5C12 6 9 4 7 5s-1 5 5 5.5M13.5 12c4.5 0 6.5 3 5.5 5s-5 1-5.5-5M12 13.5C12 18 15 20 17 19s1-5-5-5.5',
  x: 'M6 6l12 12M18 6L6 18', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2', cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', hand: 'M9 11V5a1.5 1.5 0 0 1 3 0v5M12 10V4a1.5 1.5 0 0 1 3 0v7M15 10V6a1.5 1.5 0 0 1 3 0v8c0 4-3 7-6 7s-5-2-7-5l-1-3a1.5 1.5 0 0 1 3-1l1 1.5V9',
  scene: 'M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4', gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3', arrow: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', alert: 'M12 3l10 18H2zM12 10v5M12 18v.5', plus: 'M12 5v14M5 12h14', pen: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  chev: 'M6 9l6 6 6-6', hist: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2', dots: 'M12 5h.01M12 12h.01M12 19h.01', filter: 'M3 5h18l-7 8v6l-4-2v-4z', refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v.5M12 11v6', back: 'M9 6l6 6-6 6', wifi: 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M9 17a5 5 0 0 1 6 0M12 20h.01',
};
const ic = (n, c = '') => `<svg class="${c}" viewBox="0 0 24 24"><path d="${P[n]}"/></svg>`;

/* ---------------- icons for every type ---------------- */
Object.assign(P, {
  garage: 'M3 21V9l9-6 9 6v12M7 21v-8h10v8M7 15h10M7 18h10', heater: 'M5 20V8a3 3 0 0 1 6 0v12M13 20V8a3 3 0 0 1 6 0v12M3 20h18', boiler: 'M7 3h10v18H7zM7 8h10M12 12v4M10 14h4',
  valve: 'M12 3v6M8 3h8M4 13h16M6 10h12v6H6zM12 16v5', drop: 'M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z', vac: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 3v3',
  blind: 'M4 4h16M5 8h14M6 12h12M7 16h10M12 16v5', other: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5', check: 'M4 12l5 5L20 7', flow: 'M3 12h4l2-5 4 10 2-5h6',
});
/* ---------------- every electrical type: icon, state line, what is recorded, Hebrew event wording, a schedule row ---------------- */
// ev: [day, time, actorType, who, verb, from, to, meta]
const TYPES = {
  light: { n: 'תאורת סלון', area: 'סלון', i: 'bulb', st: 'דלוק 60%', on: 1, rec: 'הפעלה, בהירות, גוון או צבע',
    ev: [['היום', '22:41', 'person', 'דנה כהן', 'כיבתה', 'דלוק', 'כבוי', ''], ['היום', '19:02', 'sched', 'תאורת ערב', 'הדליק', 'כבוי', '60%', ''], ['היום', '18:55', 'phys', 'ידני בהתקן', 'שינוי בהירות', '100%', '60%', 'משוער'],
      ['אתמול', '23:00', 'scene', 'לילה טוב', 'כיבתה', 'דלוק', 'כבוי', 'הופעלה ע״י יואב כהן'], ['אתמול', '07:10', 'auto', 'זריחה', 'שינוי גוון', '2700K', '4000K', ''], ['אתמול', '06:58', 'sys', 'המערכת', 'חזר לזמינות', 'לא זמין', 'כבוי', 'אחרי הפסקת חשמל']],
    sch: ['תאורת ערב', 'הדלקה 60% · היום 18:30', 'כל יום'] },
  switch: { n: 'בוילר', area: 'מרפסת שירות', i: 'plug', st: 'כבוי', on: 0, rec: 'הפעלה וכיבוי',
    ev: [['היום', '07:30', 'sched', 'בוילר בוקר', 'כיבה', 'דלוק', 'כבוי', 'אחרי 60 דקות'], ['היום', '06:30', 'sched', 'בוילר בוקר', 'הדליק', 'כבוי', 'דלוק', ''], ['אתמול', '21:15', 'person', 'יואב כהן', 'הדליק', 'כבוי', 'דלוק', 'מהאפליקציה'], ['אתמול', '20:00', 'unk', 'מקור לא ידוע', 'כיבה', 'דלוק', 'כבוי', '']],
    sch: ['בוילר בוקר', 'הדלקה 06:30, כיבוי 07:30', 'א׳–ה׳'] },
  outlet: { n: 'שקע מרפסת', area: 'מרפסת', i: 'plug', st: 'דלוק · 1,200 W', on: 1, rec: 'הפעלה וכיבוי; הספק נוכחי כשיש חיישן הספק',
    ev: [['היום', '12:20', 'person', 'דנה כהן', 'כיבתה', 'דלוק', 'כבוי', 'לפני כיבוי: 1,180 W'], ['היום', '09:05', 'phys', 'ידני בהתקן', 'הדליק', 'כבוי', 'דלוק', 'משוער'], ['אתמול', '22:00', 'sched', 'כיבוי שקעי מרפסת', 'כיבה', 'דלוק', 'כבוי', '']],
    sch: ['כיבוי שקעי מרפסת', 'כיבוי · היום 22:00', 'כל יום'] },
  cover: { n: 'תריס סלון', area: 'סלון', i: 'blind', st: 'פתוח 40% · הטיה 30°', on: 1, rec: 'מיקום, כיוון תנועה, הטיה',
    ev: [['היום', '20:12', 'person', 'דנה כהן', 'סגרה', '100%', '40%', ''], ['היום', '19:41', 'phys', 'ידני בהתקן', 'עצר', '70%', '66%', 'משוער'], ['אתמול', '19:40', 'auto', 'חום בצהריים', 'סגר חלקית', '100%', '70%', 'טמפרטורה חיצונית 34°'], ['אתמול', '08:00', 'sched', 'תריסים בוקר', 'שינוי הטיה', '0°', '30°', '']],
    sch: ['תריסים ערב', 'סגירת תריס ל־40% · היום 20:00', 'כל יום'] },
  garage: { n: 'דלת חניה', area: 'חניה', i: 'garage', st: 'סגור', on: 0, rec: 'פתיחה, סגירה, עצירה',
    ev: [['היום', '08:12', 'person', 'יואב כהן', 'פתח', 'סגור', 'פתוח', 'מהאפליקציה'], ['היום', '08:13', 'sys', 'המערכת', 'נסגר', 'פתוח', 'סגור', 'סגירה אוטומטית אחרי דקה'], ['אתמול', '23:00', 'sched', 'סגירת חניה בלילה', 'סגר', 'פתוח', 'סגור', '']],
    sch: ['סגירת חניה בלילה', 'סגירה · היום 23:00', 'כל יום'] },
  climate: { n: 'מזגן סלון', area: 'סלון', i: 'snow', st: 'קירור 24° · כעת 25.5°', on: 1, rec: 'מצב, יעד, פעולה בפועל, מאוורר',
    ev: [['היום', '21:03', 'person', 'יואב כהן', 'שינה יעד', '22°', '24°', ''], ['היום', '15:30', 'sched', 'מזגן אחר צהריים', 'הדליק', 'כבוי', 'קירור 22°', ''], ['אתמול', '17:12', 'person', 'דנה כהן', 'שינתה מאוורר', 'אוטו', 'גבוה', ''], ['אתמול', '17:10', 'person', 'דנה כהן', 'שינתה מצב', 'חימום', 'קירור', '']],
    sch: ['מזגן אחר צהריים', 'קירור 22° · היום 15:30', 'א׳–ה׳'] },
  heater: { n: 'חימום חדר שינה', area: 'חדר שינה', i: 'heater', st: 'חימום 21° · מחמם כעת', on: 1, rec: 'מצב, יעד, פעולה בפועל',
    ev: [['היום', '06:00', 'sched', 'חימום בוקר', 'שינה יעד', '18°', '21°', ''], ['אתמול', '22:30', 'auto', 'לילה טוב', 'שינה יעד', '21°', '18°', ''], ['אתמול', '19:00', 'person', 'דנה כהן', 'הדליקה', 'כבוי', 'חימום 21°', '']],
    sch: ['חימום בוקר', 'חימום 21° · מחר 06:00', 'כל יום'] },
  fan: { n: 'מאוורר חדר שינה', area: 'חדר שינה', i: 'fan', st: 'מהירות 66%', on: 1, rec: 'הפעלה, מהירות, כיוון, מצב טבעי',
    ev: [['היום', '23:10', 'person', 'יואב כהן', 'שינה מהירות', '33%', '66%', ''], ['היום', '22:50', 'phys', 'ידני בהתקן', 'שינה כיוון', 'קדימה', 'אחורה', 'משוער'], ['אתמול', '22:00', 'sched', 'מאוורר לילה', 'הדליק', 'כבוי', '33%', '']],
    sch: ['מאוורר לילה', 'מהירות 33% · היום 22:00', 'כל יום'] },
  boiler: { n: 'דוד שמש', area: 'גג', i: 'boiler', st: 'חימום חשמלי 55°', on: 1, rec: 'הפעלה, יעד, מצב (חסכוני / רגיל)',
    ev: [['היום', '05:30', 'sched', 'חימום דוד', 'הדליק', 'כבוי', '55°', ''], ['אתמול', '19:20', 'person', 'דנה כהן', 'שינתה מצב', 'חסכוני', 'רגיל', ''], ['אתמול', '19:20', 'person', 'דנה כהן', 'שינתה יעד', '50°', '60°', '']],
    sch: ['חימום דוד', 'הפעלה ל־55° · מחר 05:30', 'כל יום'] },
  valve: { n: 'השקיה: גינה קדמית', area: 'גינה', i: 'valve', st: 'סגור', on: 0, rec: 'פתיחה וסגירה; משך כשיש טיימר',
    ev: [['היום', '06:00', 'sched', 'השקיית בוקר', 'פתח', 'סגור', 'פתוח', 'ל־20 דקות'], ['היום', '06:20', 'sched', 'השקיית בוקר', 'סגר', 'פתוח', 'סגור', ''], ['אתמול', '18:05', 'person', 'יואב כהן', 'פתח', 'סגור', 'פתוח', 'מהאפליקציה']],
    sch: ['השקיית בוקר', 'פתיחה ל־20 דקות · מחר 06:00', 'ב׳ ד׳ ו׳'] },
  vacuum: { n: 'שואב רובוטי', area: 'סלון', i: 'vac', st: 'בעגינה · סוללה 92%', on: 0, rec: 'התחלה, עצירה, חזרה לעגינה',
    ev: [['היום', '10:00', 'sched', 'ניקיון בוקר', 'התחיל ניקיון', 'בעגינה', 'מנקה', ''], ['היום', '10:48', 'sys', 'המערכת', 'חזר לעגינה', 'מנקה', 'בעגינה', 'סיום ניקיון'], ['אתמול', '14:10', 'person', 'דנה כהן', 'עצרה', 'מנקה', 'מושהה', '']],
    sch: ['ניקיון בוקר', 'התחלת ניקיון · מחר 10:00', 'א׳ ג׳ ה׳'] },
  other: { n: 'התקן חשמלי', area: 'מטבח', i: 'other', st: 'פעיל', on: 1, rec: 'שינוי מצב (בלי פירוש מיוחד)',
    ev: [['היום', '13:02', 'person', 'דנה כהן', 'שינוי מצב', 'מושבת', 'פעיל', ''], ['אתמול', '09:30', 'unk', 'מקור לא ידוע', 'שינוי מצב', 'פעיל', 'מושבת', '']],
    sch: ['', '', ''] },
};
const KIND = { person: 'אדם', auto: 'אוטומציה', sched: 'תזמון', scene: 'סצנה', phys: 'ידני בהתקן', sys: 'מערכת', unk: 'לא ידוע' };
const AVI = { auto: 'bolt', sched: 'cal', scene: 'scene', phys: 'hand', sys: 'gear', unk: 'info' };
const prefix = { auto: 'אוטומציה', sched: 'תזמון', scene: 'סצנה' };
function av(type, name) { return type === 'person' ? `<div class="av">${name.split(' ').map((w) => w[0]).join('')}</div>` : `<div class="av ${type}">${ic(AVI[type])}</div>`; }
function evRow(e) {
  const [, t, type, who, verb, from, to, meta] = e;
  const lbl = prefix[type] ? `<span class="kd">${prefix[type]}:</span> ` : '';
  return `<div class="ev">${av(type, who)}<div class="c"><div class="l1">${lbl}<b>${who}</b><span class="vb">${verb}</span></div><div class="l2"><span class="ba"><i>${from}</i><svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="${P.arrow}"/></svg><b>${to}</b></span>${meta ? `<span class="mt">${meta}</span>` : ''}</div></div><div class="t num">${t}</div></div>`;
}
function feed(dev, opt = {}) {
  let out = '', last = '';
  for (const e of TYPES[dev].ev.slice(0, opt.n || 99)) { if (e[0] !== last) { out += `<div class="day">${e[0] === 'היום' ? 'היום' : 'אתמול'} · ${N(e[0] === 'היום' ? '5.10' : '4.10')}</div>`; last = e[0]; } out += evRow(e); }
  return out;
}
const filters = (o = {}) => `<div class="fl"><button class="fchip ${o.p ? 'act' : ''}">${o.p || '7 ימים'}${ic('chev')}</button><button class="fchip ${o.a ? 'act' : ''}">${o.a || 'כל הגורמים'}${ic('chev')}</button><button class="fchip ${o.k ? 'act' : ''}">${o.k || 'כל האירועים'}${ic('chev')}</button></div>`;
const foot = () => `<div class="pf">ידני בהתקן הוא משוער · נשמר 90 יום</div>`;

/* ---------------- the popup (compact) ---------------- */
function popup(dev, tab, body, o = {}) {
  const d = TYPES[dev];
  return `<div class="pop dh" role="dialog" aria-label="פעילות: ${d.n}"><div class="grab"></div>
  <div class="ph ${d.on ? '' : 'off'}"><div class="ic">${ic(d.i)}</div><div class="tt"><h3>${d.n}</h3><div class="sub">${d.area} · <span class="st">${d.st}</span></div></div><button class="x" aria-label="סגור">${ic('x')}</button></div>
  <div class="segt" role="tablist"><a class="${tab === 'act' ? 'on' : ''}" role="tab">פעילות</a><a class="${tab === 'sch' ? 'on' : ''}" role="tab">תזמונים${(o.cnt ?? 3) !== '' && o.cnt !== 0 ? `<span class="cnt">${o.cnt ?? 3}</span>` : ''}</a></div>
  <div class="pbody" role="tabpanel">${body}</div>${o.foot ? foot() : ''}</div>`;
}
const stage = (inner) => `<div class="app dh" style="display:block;position:relative;min-height:inherit"><div class="bk" style="filter:blur(1.5px);opacity:.8">${tiles()}</div><div class="scrim" style="${PH() ? '' : 'padding:30px'}">${inner}</div></div>`;
function tiles() {
  const T = [['bulb', 'תאורת סלון', 'דלוק 60%', 1], ['plug', 'בוילר', 'כבוי', 0], ['blind', 'תריס סלון', 'פתוח 40%', 1], ['snow', 'מזגן סלון', 'קירור 24°', 1], ['bulb', 'תאורת מטבח', 'כבוי', 0], ['plug', 'שקע מרפסת', 'דלוק', 1], ['fan', 'מאוורר חדר שינה', 'כבוי', 0], ['blind', 'תריס חדר שינה', 'סגור', 0]];
  return '<h2>סלון</h2>' + (PH() ? T.slice(0, 5) : T).map(([i, n, s, on]) => `<div class="tile ${on ? 'on' : ''}"><div class="ic">${ic(i)}</div><div><b>${n}</b><small>${s}</small></div></div>`).join('');
}

/* ---------------- schedules tab ---------------- */
function sRow(o) {
  return `<div class="sr"><div class="c"><div class="nm">${o.n}${o.tag ? ' ' + o.tag : ''}</div><div class="nx">${o.nx}<span class="dy">${o.dy}</span></div></div>
   <span class="sw ${o.on ? 'on' : ''} ${o.ro ? 'dis' : ''}" role="switch" aria-checked="${!!o.on}" ${o.ro ? 'aria-disabled="true"' : ''}></span><button class="ib" aria-label="${o.ro ? 'צפייה' : 'עריכה'}">${ic(o.ro ? 'info' : 'pen')}</button></div>`;
}
const addBtn = `<div class="addrow"><button class="btn sm">${ic('plus')}תזמון חדש להתקן</button></div>`;
function schedBody(o = {}, dev = 'light') {
  if (o.state === 'empty') return `<div class="stt"><div class="big">${ic('cal')}</div><h4>אין תזמונים להתקן</h4></div>${addBtn}`;
  if (o.state === 'noperm') return `<div class="stt lock"><div class="big">${ic('lock')}</div><h4>אין הרשאה לראות תזמונים</h4></div>`;
  const s = TYPES[dev].sch;
  const rows = [
    { n: s[0], nx: s[1], dy: ' · ' + s[2], on: 1 },
    { n: 'כיבוי לילה', tag: `<span class="tag">${ic('scene')}דרך קבוצה</span>`, nx: 'כיבוי · היום 23:45', dy: ' · כל יום', on: 1 },
    { n: 'שבת', tag: `<span class="tag ro">${ic('lock')}קריאה בלבד</span>`, nx: 'הדלקה · ו׳ 17:40', dy: '', on: 1, ro: 1 },
    { n: 'חופשה', nx: 'מושבת', dy: '', on: 0 },
  ];
  return rows.map(sRow).join('') + addBtn;
}
P.link = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';

const actBody = (dev, o = {}) => filters(o.f) + feed(dev, o) + `<div class="more2"><button class="btn sm">טען עוד</button></div>`;
function stateBody(k) {
  const st = {
    load: `${filters()}<div style="padding:10px 14px;display:grid;gap:12px">${[1, 2, 3].map(() => '<div style="display:grid;grid-template-columns:28px 1fr 30px;gap:10px;align-items:center"><div class="skel" style="height:28px;border-radius:50%"></div><div style="display:grid;gap:6px"><div class="skel" style="width:60%"></div><div class="skel" style="width:35%;height:10px"></div></div><div class="skel" style="height:10px"></div></div>').join('')}</div>`,
    empty: `${filters({ p: 'שעה', a: 'אנשים' })}<div class="stt"><div class="big">${ic('hist')}</div><h4>אין פעילות בתקופה הזאת</h4><button class="btn sm">הרחב ל־30 יום</button></div>`,
    perm: `<div class="stt lock"><div class="big">${ic('lock')}</div><h4>אין הרשאה לראות פעילות</h4><div class="note">אפשר עדיין לראות תזמונים</div></div>`,
    unav: `<div class="stt err"><div class="big">${ic('wifi')}</div><h4>ההיסטוריה אינה זמינה כרגע</h4><div class="note">מוצג מה שנשמר מקומית עד 4.10</div><button class="btn sm">${ic('refresh')}נסו שוב</button></div>`,
    partial: `<div class="gap">${ic('alert')}<span>המערכת הייתה מנותקת 03:10 עד 03:42; ייתכן שחסרים אירועים</span></div>${feed('light', { n: 2 })}`,
  };
  return st[k];
}
function editorBody() {
  return `<div class="ed"><div class="eh"><button class="ib" aria-label="חזרה">${ic('back')}</button><b>עריכת תזמון</b></div>
  <div><label>שם</label><div class="inp2">תאורת ערב</div></div>
  <div><label>התקנים</label><div class="pe"><span class="chip nodot" style="background:var(--sw-accent-soft);color:var(--sw-accent-text)">תאורת סלון</span><span class="chip nodot" style="background:var(--sw-surface-3)">תאורת מרפסת</span></div></div>
  <div><label>שעות ופעולות</label><div class="pe"><span class="ba">18:30 · הדלקה 60%</span><span class="ba">23:00 · כיבוי</span></div></div>
  <div><label>ימים</label><div class="pe"><span class="ba">כל יום</span></div></div>
  <div class="note">העורך הקיים של התזמונים, בתוך החלון</div>
  <div class="eact"><button class="btn pri sm">שמירה</button><button class="btn sm">ביטול</button></div></div>`;
}

/* ---------------- screens ---------------- */
function filterOpenDesktop(which) {
  const opts = { p: ['שעה', '24 שעות', '7 ימים', '30 יום', 'טווח...'], a: ['כל הגורמים', 'אנשים', 'אוטומציות', 'תזמונים', 'סצנות', 'ידני בהתקן', 'מערכת'], k: ['כל האירועים', 'הפעלה וכיבוי', 'שינוי ערך', 'זמינות'] }[which];
  const sel = { p: 2, a: 1, k: 0 }[which];
  return `<div class="ddp" style="inset-inline-start:${which === 'p' ? 14 : which === 'a' ? 92 : 190}px">${opts.map((x, i) => `<div class="opt ${i === sel ? 'sel' : ''}"><span class="rad"></span>${x}</div>`).join('')}</div>`;
}
function filterSheet() {
  const o = ['כל הגורמים', 'אנשים', 'אוטומציות', 'תזמונים', 'סצנות', 'ידני בהתקן', 'מערכת'];
  return `<div class="sub-sheet dh"><div class="grab"></div><h4>גורם</h4>${o.map((x, i) => `<div class="opt ${i === 1 ? 'sel' : ''}" style="min-height:44px"><span class="rad"></span>${x}</div>`).join('')}<div style="display:flex;gap:8px;margin-block-start:8px"><button class="btn pri" style="flex:1">החל</button><button class="btn" style="flex:1">נקה</button></div></div>`;
}
const SCREENS = {
  'press': { t: 'לחיצה ארוכה והחלופות הנגישות (שולחן עבודה)', fn: pressScreen, d: 'desktop' },
  'press-phone': { t: 'לחיצה ארוכה והחלופות בטלפון', fn: pressPhone, d: 'phone' },
  'desk-activity': { t: 'פעילות (שולחן עבודה)', fn: () => stage(popup('light', 'act', actBody('light', { n: 4 }), { foot: true })), d: 'desktop' },
  'desk-filters': { t: 'מסננים פתוחים (שולחן עבודה)', fn: () => stage(popup('light', 'act', filters({ a: 'אנשים' }).replace(/<\/div>$/, filterOpenDesktop('a') + '</div>') + feed('light', { n: 2 }))), d: 'desktop' },
  'desk-schedules': { t: 'תזמונים (שולחן עבודה)', fn: () => stage(popup('light', 'sch', schedBody())), d: 'desktop' },
  'desk-editor': { t: 'עריכת תזמון בתוך החלון', fn: () => stage(popup('light', 'sch', editorBody())), d: 'desktop' },
  'phone-activity': { t: 'גיליון תחתון: פעילות (טלפון)', fn: () => stage(popup('light', 'act', actBody('light', { n: 4 }), { foot: true })), d: 'phone' },
  'phone-filters': { t: 'בורר מסנן כגיליון (ui.dd_phone = sheet)', fn: () => stage(popup('light', 'act', actBody('light', { f: { a: 'אנשים' }, n: 2 }) + filterSheet())), d: 'phone' },
  'phone-schedules': { t: 'גיליון תחתון: תזמונים (טלפון)', fn: () => stage(popup('light', 'sch', schedBody())), d: 'phone' },
  'phone-editor': { t: 'עורך תזמון בגיליון (טלפון)', fn: () => stage(popup('light', 'sch', editorBody())), d: 'phone' },
  'states': { t: 'מצבים: טעינה, ריק, אין הרשאה, לא זמין, חלקית', fn: statesScreen, d: 'desktop' },
  'states-sched': { t: 'מצבי תזמונים: ריק ואין הרשאה', fn: () => `<div class="vgrid dh c3"><div>${popup('light', 'sch', schedBody({ state: 'empty' }), { cnt: 0 })}</div><div>${popup('light', 'sch', schedBody({ state: 'noperm' }), { cnt: '' })}</div></div>`, d: 'desktop' },
  'variants': { t: 'לוח כל סוגי ההתקנים (12)', fn: variantsScreen, d: 'desktop' },
  'domains': { t: 'אילו ישויות נחשבות חשמליות ואיך הממשק יודע', fn: domainsScreen, d: 'desktop' },
};
function statesScreen() {
  const cell = (h, b, tab = 'act') => `<div><div class="note" style="margin-block-end:6px"><b>${h}</b></div>${popup('light', tab, b)}</div>`;
  return `<div class="vgrid dh c3">${cell('טעינה', stateBody('load'))}${cell('ריק (אחרי סינון)', stateBody('empty'))}${cell('אין הרשאה', stateBody('perm'))}${cell('היסטוריה לא זמינה', stateBody('unav'))}${cell('חלקית (פער בנתונים)', stateBody('partial'))}${cell('טוען עוד', feed('light', { n: 2 }) + '<div class="more2"><button class="btn sm" disabled>טוען...</button></div>')}</div>`;
}
function typeCard(k) {
  const d = TYPES[k], s = d.sch;
  return `<div class="tcard"><div class="ph ${d.on ? '' : 'off'}"><div class="ic">${ic(d.i)}</div><div class="tt"><h3>${d.n}</h3><div class="sub"><span class="st">${d.st}</span></div></div></div>
  <div class="rec"><b>נרשם:</b> ${d.rec}</div>
  <div class="tb">${d.ev.slice(0, 3).map(evRow).join('')}</div>
  ${s[0] ? `<div class="tsch">${ic('cal')}<span><b>${s[0]}</b> · ${s[1]}</span></div>` : '<div class="tsch mut">ללא תזמונים: מצב ריק כרגיל</div>'}</div>`;
}
function variantsScreen() {
  const order = ['light', 'switch', 'outlet', 'cover', 'garage', 'climate', 'heater', 'fan', 'boiler', 'valve', 'vacuum', 'other'];
  return `<div class="vgrid dh c3"><h3 class="vh">כל סוגי ההתקנים החשמליים: אייקון, שורת מצב, מה נרשם, ניסוח אירועים ושורת תזמון. המסגרת, הלשוניות והמסננים זהים בכולם.</h3>${order.map(typeCard).join('')}</div>`;
}
function domainsScreen() {
  const rows = [['light', 'כן', 'תאורה', 'הפעלה, בהירות, גוון, צבע'], ['switch (גם שקע)', 'כן', 'מתג, שקע', 'הפעלה וכיבוי; הספק אם יש חיישן הספק מקושר להתקן'], ['cover', 'כן', 'תריס, וילון, שער, דלת חניה', 'מיקום, כיוון תנועה, הטיה'], ['climate', 'כן', 'מזגן, חימום, תרמוסטט', 'מצב, יעד, פעולה בפועל, מאוורר'], ['fan, humidifier', 'כן', 'מאוורר, מכשיר לחות', 'הפעלה, מהירות, כיוון, יעד'], ['water_heater', 'כן', 'דוד, בוילר', 'הפעלה, יעד, מצב'], ['valve', 'כן', 'ברז, השקיה', 'פתיחה וסגירה, משך'], ['vacuum', 'כן', 'שואב רובוטי', 'התחלה, עצירה, עגינה'], ['input_boolean', 'כן, מסומן וירטואלי', 'מתג לוגי', 'הפעלה וכיבוי'], ['כל domain אחר שמקבל פקדים בשרת', 'כן, תצוגה כללית', 'ניסוח "שינוי מצב"', 'מצב בלבד'], ['lock, alarm_control_panel', 'לא (שאלה לבעלים)', 'אבטחה: יומן נפרד ורגיש', ''], ['media_player', 'לא: חלון נגן משלו', 'הלחיצה הארוכה נשארת של הנגן', ''], ['sensor, binary_sensor, camera, scene, script, automation', 'לא', 'חיישנים אינם מבוצעים; סצנות הן מקור, לא התקן', '']];
  return `<div class="pad dh"><h2>ישויות "חשמליות"</h2><div class="note">הממשק לא מנחש לפי שם או אייקון. השרת מחזיר בכל שורת כרטיס את <span class="kbd">activity: true|false</span> וגם את סוג התצוגה (<span class="kbd">activity_kind</span>: light, switch, outlet, cover, garage, climate, heater, fan, boiler, valve, vacuum, other), נגזרים מהטבלה (<span class="kbd">card_of</span> ב־devices.py) שמחליטה אילו ישויות מקבלות פקדים. הלחיצה הארוכה, פריט התפריט והלשונית זמינים רק כשהשרת אישר וקיים <span class="kbd">devices.read</span> על ההתקן.</div>
  <table class="mtx"><thead><tr><th>domain</th><th>חשמלי</th><th>דוגמה</th><th>מה נרשם</th></tr></thead><tbody>${rows.map((r) => `<tr><td><span class="kbd">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table></div>`;
}
function pressScreen() {
  return `<div class="pad dh"><h2>לחיצה ארוכה על התקן חשמלי</h2>
  <div class="note">אין רמז קבוע על המסך (מסכי תפעול נקיים). הגילוי דרך פריט "פעילות" בתפריט של ההתקן, ובמדריך. הדגמה חיה: החזיקו לחיצה על אחד האריחים חצי שנייה.</div>
  <div class="demo">
   <div><h4>1. משוב לחיצה ארוכה (500 מילישניות)</h4><div style="display:grid;gap:8px"><div class="tile on"><div class="ring"></div><div class="ic">${ic('bulb')}</div><div><b>מנוחה</b><small>טבעת מוסתרת</small></div></div><div class="tile on mid"><div class="ring"></div><div class="ic">${ic('bulb')}</div><div><b>באמצע (62%)</b><small>האריח שוקע 2%, הטבעת מתמלאת</small></div></div><div class="tile on hold"><div class="ring"></div><div class="ic">${ic('bulb')}</div><div><b>הושלם</b><small>טבעת מלאה, רטט קצר, החלון נפתח</small></div></div></div><div class="note">תנועה מופחתת: בלי שקיעה ובלי אנימציה, הטבעת מופיעה מלאה בסיום.</div></div>
   <div><h4>2. נגיש: תפריט הקשר ומקלדת</h4><div class="tile on" tabindex="0" style="outline:2px solid var(--sw-focus)"><div class="ic">${ic('bulb')}</div><div><b>תאורת סלון</b><small>ממוקד במקלדת</small></div><button class="more" aria-label="עוד">${ic('dots')}</button></div>
     <div class="menu" style="position:static"><div class="mi sel">${ic('hist')}פעילות<span class="kbd">Alt+Enter</span></div><div class="mi">${ic('cal')}תזמונים</div><div class="mi">${ic('gear')}הגדרות התקן</div></div>
     <div class="note">נפתח ב: לחיצה ימנית, כפתור ⋯ באריח, <span class="kbd">Shift+F10</span> או מקש התפריט על אריח ממוקד. <span class="kbd">Alt+Enter</span> פותח ישר את "פעילות". Enter ורווח ממשיכים להפעיל/לכבות כמו היום.</div></div>
  </div>
  <h3 style="margin:0;color:var(--sw-heading)">הדגמה חיה</h3><div class="demo" style="grid-template-columns:repeat(3,1fr)" id="live">${['תאורת סלון', 'בוילר', 'תריס סלון'].map((n, i) => `<div class="tile ${i != 1 ? 'on' : ''}" data-dev="${['light', 'switch', 'cover'][i]}" tabindex="0"><div class="ring"></div><div class="ic">${ic(['bulb', 'plug', 'cover'][i])}</div><div><b>${n}</b><small>לחיצה קצרה: הפעלה · ארוכה: פעילות</small></div></div>`).join('')}</div>
  <div id="liveout" class="note" aria-live="polite">&nbsp;</div>
  <h3 style="margin:0;color:var(--sw-heading)">התנגשויות ופתרונן</h3>
  <table class="mtx"><thead><tr><th>מצב</th><th>התנהגות</th></tr></thead><tbody>
  <tr><td>לחיצה קצרה (פחות מ־500 מילישניות)</td><td>מפעיל או מכבה כמו היום; בלי שינוי.</td></tr>
  <tr><td>החזקה של 500 מילישניות ואילך</td><td>פותח את החלון, ואינו מפעיל את ההתקן: אירוע ה־click שאחרי השחרור נבלע.</td></tr>
  <tr><td>גרירה או גלילה (תזוזה מעל 8 פיקסלים לפני סיום)</td><td>מבטל את הטבעת; הגלילה והגרירה פועלות כרגיל.</td></tr>
  <tr><td>מצב עריכה בתכנית או בפריסה</td><td>לחיצה ארוכה כבויה והגרירה קודמת; פריט "פעילות" בתפריט ממשיך לעבוד.</td></tr>
  <tr><td>בחירה מרובה</td><td>ללא שינוי: לחיצה ארוכה אינה פותחת חלון; פריט התפריט פתוח.</td></tr>
  <tr><td>פקדים עם מחוות משלהם (מחוון בהירות, תריס, נגן מדיה)</td><td>רק גוף האריח וכותרתו מגיבים; גרירת המחוון אינה נספרת. הנגן שומר על החלון שלו.</td></tr>
  <tr><td>מגע: תפריט ההקשר של הדפדפן</td><td>מבוטל על האריחים (contextmenu) כדי שלא יופיע ליד הטבעת.</td></tr>
  <tr><td>התקן שאינו חשמלי, או בלי devices.read</td><td>אין לחיצה ארוכה ואין פריט בתפריט.</td></tr></tbody></table></div>`;
}
function pressPhone() {
  return `<div class="app dh" style="display:block;position:relative;min-height:inherit"><div class="bk" style="padding-block-start:20px">${tiles().replace('<div class="tile on">', '<div class="tile on hold"><div class="ring"></div>')}</div>
  <div class="scrim"><div class="pop" style="min-height:0"><div class="grab"></div><div style="padding:0 8px 14px"><div class="ph" style="padding-block-end:6px"><div class="ic">${ic('bulb')}</div><div><h3>תאורת סלון</h3><div class="sub">סלון · קומה 1</div></div></div>
  <div class="mi sel" style="min-height:52px">${ic('hist')}פעילות והיסטוריה</div><div class="mi" style="min-height:52px">${ic('cal')}תזמונים</div><div class="mi" style="min-height:52px">${ic('gear')}הגדרות התקן</div></div></div></div></div>
  <div class="pad dh"><div class="note">בטלפון: לחיצה ארוכה פותחת ישירות את החלון על לשונית "פעילות" (הגיליון מימין). הפריט "פעילות והיסטוריה" בכפתור ⋯ של האריח הוא הנתיב הנגיש; הוא נפתח כגיליון פעולות ומשם לחלון.</div></div>`;
}

/* ---------------- gallery chrome ---------------- */
function bar() {
  const o = (id, l, cur) => `<button class="${cur === id ? 'on' : ''}" onclick="S.${id[0] === 'x' ? '' : ''}">${l}</button>`;
  const seg = (key, list) => `<span class="seg">${list.map(([v, l]) => `<button class="${S[key] === v ? 'on' : ''}" onclick="setS('${key}','${v}')">${l}</button>`).join('')}</span>`;
  return `<b>DEVHIST</b><label>מסך <select onchange="setS('s',this.value)">${Object.entries(SCREENS).map(([k, v]) => `<option value="${k}" ${S.s === k ? 'selected' : ''}>${v.t}</option>`).join('')}</select></label>
  ${seg('d', [['desktop', '1440'], ['tablet', '820'], ['phone', '390']])}${seg('t', [['light', 'בהיר'], ['dark', 'כהה']])}${seg('k', [['classic', 'classic'], ['domus', 'domus'], ['tesla', 'tesla'], ['bubble', 'bubble']])}<a href="index.html" style="margin-inline-start:auto;color:#1d4fc4">חזרה לאינדקס</a>`;
}
window.setS = (k, v) => { S[k] = v; if (k === 's') S.d = SCREENS[v].d; render(); };
function render() {
  const sc = SCREENS[S.s] || SCREENS.press; document.body.dataset.gal = S.t; writeHash();
  document.getElementById('bar').innerHTML = bar();
  document.getElementById('stage').innerHTML = `<div id="cap">${sc.t} · <span class="num">${S.d} / ${S.t} / ${S.k}</span></div><div id="frame" class="d-${S.d}" data-skin="${S.k}" data-theme="${S.t}" dir="rtl">${sc.fn()}</div>`;
  wireLive();
}
/* live long-press demo: 500 ms hold, 8 px slop, the click after a long press is swallowed */
function wireLive() {
  document.querySelectorAll('#live .tile').forEach((el) => {
    let tm = null, x0 = 0, y0 = 0, fired = false;
    const out = document.getElementById('liveout');
    const cancel = () => { clearTimeout(tm); tm = null; el.classList.remove('pressing'); };
    el.addEventListener('pointerdown', (e) => { fired = false; x0 = e.clientX; y0 = e.clientY; el.classList.add('pressing'); el.style.setProperty('--p', 0);
      const t0 = performance.now(); const tick = () => { if (!tm) return; el.style.setProperty('--p', Math.min(100, ((performance.now() - t0) / 5))); requestAnimationFrame(tick); };
      tm = setTimeout(() => { fired = true; cancel(); el.classList.add('hold'); setTimeout(() => el.classList.remove('hold'), 700); out.textContent = 'נפתח חלון הפעילות של ' + el.querySelector('b').textContent + ' (בלי הפעלה).'; }, 500); requestAnimationFrame(tick); });
    el.addEventListener('pointermove', (e) => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { cancel(); out.textContent = 'התזוזה ביטלה את הלחיצה הארוכה.'; } });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, cancel));
    el.addEventListener('click', () => { if (fired) { fired = false; return; } el.classList.toggle('on'); out.textContent = 'לחיצה קצרה: ההתקן הופעל או כובה כרגיל.'; });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); out.textContent = 'לחיצה ימנית: נפתח תפריט הקשר עם "פעילות".'; });
    el.addEventListener('keydown', (e) => { if (e.altKey && e.key === 'Enter') { e.preventDefault(); out.textContent = 'Alt+Enter: נפתח חלון הפעילות.'; } });
  });
}
readHash(); window.addEventListener('hashchange', () => { readHash(); render(); }); render();
