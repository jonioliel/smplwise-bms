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

/* ---------------- devices and their fake history ---------------- */
const DEV = {
  light: { name: 'תאורת סלון', area: 'סלון · קומה 1', icon: 'bulb', chips: [['ok', 'דלוק'], ['', 'בהירות 60%'], ['', 'גוון חם']], on: true,
    ev: [
      ['היום', '22:41', 'person', 'דנה כהן', 'כיבתה', 'דלוק', 'כבוי', ''],
      ['היום', '19:02', 'sched', 'תאורת ערב', 'הדליק', 'כבוי', 'דלוק 60%', 'לפי התזמון "תאורת ערב"'],
      ['היום', '18:55', 'phys', 'בהתקן עצמו', 'שינוי בהירות', '100%', '60%', 'לחצן או מתג בקיר (משוער)'],
      ['אתמול', '23:00', 'scene', 'סצנה: לילה טוב', 'כיבתה', 'דלוק', 'כבוי', 'הופעלה על ידי יואב כהן'],
      ['אתמול', '07:10', 'auto', 'אוטומציה: זריחה', 'הדליק', 'כבוי', 'דלוק 30%', ''],
      ['אתמול', '06:58', 'sys', 'המערכת', 'חזר לזמינות', 'לא זמין', 'כבוי', 'אחרי הפסקת חשמל'],
    ] },
  switch: { name: 'בוילר', area: 'מרפסת שירות · קומה 1', icon: 'plug', chips: [['', 'כבוי'], ['wn', 'מופעל ידנית פעמיים השבוע']], on: false,
    ev: [
      ['היום', '07:30', 'sched', 'בוילר בוקר', 'כיבה', 'דלוק', 'כבוי', 'אחרי 60 דקות'],
      ['היום', '06:30', 'sched', 'בוילר בוקר', 'הדליק', 'כבוי', 'דלוק', ''],
      ['אתמול', '21:15', 'person', 'יואב כהן', 'הדליק', 'כבוי', 'דלוק', 'מהאפליקציה'],
      ['אתמול', '20:00', 'unk', 'מקור לא ידוע', 'כיבה', 'דלוק', 'כבוי', 'ללא מזהה משתמש או תהליך'],
    ] },
  cover: { name: 'תריס סלון', area: 'סלון · קומה 1', icon: 'cover', chips: [['', 'פתוח 40%']], on: true,
    ev: [
      ['היום', '20:12', 'person', 'דנה כהן', 'סגרה', 'פתוח 100%', 'פתוח 40%', ''],
      ['היום', '08:00', 'sched', 'תריסים בוקר', 'פתח', 'סגור', 'פתוח 100%', ''],
      ['אתמול', '19:40', 'auto', 'אוטומציה: חום בצהריים', 'סגר חלקית', 'פתוח 100%', 'פתוח 70%', 'טמפרטורה חיצונית 34 מעלות'],
      ['אתמול', '19:41', 'phys', 'בהתקן עצמו', 'עצר', 'פתוח 70%', 'פתוח 66%', 'משוער'],
    ] },
  climate: { name: 'מזגן סלון', area: 'סלון · קומה 1', icon: 'snow', chips: [['ok', 'קירור'], ['', 'יעד 24 מעלות'], ['', 'כעת 25.5 מעלות']], on: true,
    ev: [
      ['היום', '21:03', 'person', 'יואב כהן', 'שינה טמפרטורת יעד', '22 מעלות', '24 מעלות', ''],
      ['היום', '15:30', 'sched', 'מזגן אחר צהריים', 'הדליק', 'כבוי', 'קירור 22 מעלות', ''],
      ['אתמול', '23:30', 'auto', 'אוטומציה: כל הבית נעול', 'כיבה', 'קירור', 'כבוי', ''],
      ['אתמול', '17:12', 'person', 'דנה כהן', 'שינתה מצב', 'מאוורר', 'קירור', ''],
    ] },
};
const GLYPH = { bulb: 'bulb', plug: 'plug', cover: 'cover', snow: 'snow' };
const KIND = { person: 'אדם', auto: 'אוטומציה', sched: 'תזמון', scene: 'סצנה', phys: 'ידני בהתקן', sys: 'מערכת', unk: 'לא ידוע' };
const AVI = { auto: 'bolt', sched: 'cal', scene: 'scene', phys: 'hand', sys: 'gear', unk: 'info' };
function av(type, name) { return type === 'person' ? `<div class="av">${name.split(' ').map((w) => w[0]).join('')}</div>` : `<div class="av ${type}">${ic(AVI[type])}</div>`; }
function evRow(e) {
  const [, t, type, who, verb, from, to, meta] = e;
  return `<div class="ev"><div class="t num">${t}</div>${av(type, who)}<div><div><span class="who">${who}</span><span class="kind">${KIND[type]}</span></div>
    <div class="what"><span>${verb}</span><span class="ba"><i>${from}</i>${ic('chev').replace('<svg', '<svg style="transform:rotate(90deg)"')}<b>${to}</b></span></div>${meta ? `<div class="meta">${meta}</div>` : ''}</div></div>`;
}
function feed(dev, opt = {}) {
  let out = '', last = '';
  for (const e of DEV[dev].ev.slice(0, opt.n || 99)) { if (e[0] !== last) { out += `<div class="day">${e[0] === 'היום' ? 'היום, ' + N('5.10') : 'אתמול, ' + N('4.10')}</div>`; last = e[0]; } out += evRow(e); }
  return out;
}
const filters = (o = {}) => `<div class="fl"><button class="fchip ${o.p ? 'act' : ''}">${ic('clock')}${o.p || '7 ימים אחרונים'}${ic('chev')}</button><button class="fchip ${o.a ? 'act' : ''}">${ic('user')}${o.a || 'כל הגורמים'}${ic('chev')}</button><button class="fchip ${o.k ? 'act' : ''}">${ic('filter')}${o.k || 'כל סוגי האירועים'}${ic('chev')}</button></div>`;
const foot = (t) => `<div class="pf">${ic('info')}<span>${t || 'ההיסטוריה נשמרת 30 יום. "ידני בהתקן" הוא משוער: אין מזהה משתמש או תהליך.'}</span></div>`;

/* ---------------- the popup ---------------- */
function popup(dev, tab, body, o = {}) {
  const d = DEV[dev];
  return `<div class="pop dh" role="dialog" aria-label="פעילות: ${d.name}"><div class="grab"></div>
  <div class="ph ${d.on ? '' : 'off'}"><div class="ic">${ic(GLYPH[d.icon])}</div><div><h3>${d.name}</h3><div class="sub">${d.area}</div></div><button class="x" aria-label="סגור">${ic('x')}</button></div>
  <div class="cur">${d.chips.map(([c, t]) => `<span class="chip nodot ${c}">${t}</span>`).join('')}</div>
  <div class="ptabs" role="tablist"><a class="${tab === 'act' ? 'on' : ''}" role="tab">${ic('hist')}פעילות</a><a class="${tab === 'sch' ? 'on' : ''}" role="tab">${ic('cal')}תזמונים<span class="cnt">${o.cnt ?? 3}</span></a></div>
  <div class="pbody" role="tabpanel">${body}</div>${o.foot ? foot() : ""}</div>`;
}
const stage = (inner, kind = 'dlg') => `<div class="app dh" style="display:block;position:relative;min-height:inherit"><div class="bk" style="filter:blur(1.5px);opacity:.8">${tiles()}</div><div class="scrim" style="${PH() ? '' : 'padding:30px'}">${inner}</div></div>`;
function tiles() {
  const T = [['bulb', 'תאורת סלון', 'דלוק 60%', 1], ['plug', 'בוילר', 'כבוי', 0], ['cover', 'תריס סלון', 'פתוח 40%', 1], ['snow', 'מזגן סלון', 'קירור 24', 1], ['bulb', 'תאורת מטבח', 'כבוי', 0], ['plug', 'שקע מרפסת', 'דלוק', 1], ['fan', 'מאוורר חדר שינה', 'כבוי', 0], ['cover', 'תריס חדר שינה', 'סגור', 0]];
  return '<h2>סלון</h2>' + (PH() ? T.slice(0, 5) : T).map(([i, n, s, on]) => `<div class="tile ${on ? 'on' : ''}"><div class="ic">${ic(i)}</div><div><b>${n}</b><small>${s}</small></div></div>`).join('');
}

/* ---------------- schedules tab ---------------- */
const dayRow = (on) => '<div class="days">' + ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((x, i) => `<span class="${on.includes(i) ? 'on' : ''}">${x}</span>`).join('') + '</div>';
function sRow(o) {
  return `<div class="sr"><div><div class="nm">${o.n}${o.tag ? ' ' + o.tag : ''}</div><div class="nx">${o.nx}</div>${dayRow(o.days)}</div>
   <div class="acts"><span class="sw ${o.on ? 'on' : ''} ${o.ro ? 'dis' : ''}" role="switch" aria-checked="${!!o.on}" ${o.ro ? 'aria-disabled="true"' : ''}></span><button class="ib" aria-label="${o.ro ? 'צפייה' : 'עריכה'}">${ic(o.ro ? 'info' : 'pen')}</button></div></div>`;
}
function schedBody(o = {}) {
  if (o.state === 'empty') return `<div class="stt"><div class="big">${ic('cal')}</div><h4>ההתקן אינו שייך לאף תזמון</h4><div>אפשר ליצור תזמון חדש שכבר כולל אותו.</div></div><div class="addrow"><button class="btn pri">${ic('plus')}הוסף תזמון להתקן זה</button></div>`;
  if (o.state === 'noperm') return `<div class="stt lock"><div class="big">${ic('lock')}</div><h4>אין לך הרשאה לראות תזמונים</h4><div>ההרשאה לתזמונים ניתנת בהגדרות על ידי מנהל המערכת.</div></div>`;
  const rows = [
    { n: 'תאורת ערב', nx: 'הבא: היום 18:30 · הדלקה 60%, כיבוי 23:00', days: [0, 1, 2, 3, 4, 5, 6], on: 1 },
    { n: 'כיבוי לילה', tag: `<span class="tag">${ic('link')}דרך קבוצה: כל האורות בקומה 1</span>`.replace(ic('link'), ic('scene')), nx: 'הבא: היום 23:45 · כיבוי', days: [0, 1, 2, 3, 4, 5, 6], on: 1 },
    { n: 'שבת: תאורה', tag: `<span class="tag ro">${ic('lock')}קריאה בלבד</span>`, nx: 'הבא: ו׳ 17:40 · הדלקה (לפי שקיעה)', days: [5], on: 1, ro: 1 },
    { n: 'חופשה: הדמיית נוכחות', nx: 'מושבת · הבא: אין', days: [0, 1, 2, 3, 4], on: 0 },
  ];
  return `<div>${rows.map(sRow).join('')}</div><div class="addrow"><button class="btn pri">${ic('plus')}הוסף תזמון להתקן זה</button></div>
  <div class="pf">${ic('info')}<span>קריאה בלבד: ניהול התזמון נדרש באזור או בבית. תזמון שעובר דרך קבוצה או סצנה נערך במקום שבו הוא מוגדר, והשינוי חל על כל חבריו.</span></div>`;
}
P.link = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';

/* ---------------- popups per state ---------------- */
const actBody = (dev, o = {}) => filters(o.f) + feed(dev, o) + `<div class="more2"><button class="btn">טען עוד</button></div>`;
function stateBody(k) {
  const st = {
    load: `${filters()}<div style="padding:12px 18px;display:grid;gap:14px">${[1, 2, 3, 4].map(() => '<div style="display:grid;grid-template-columns:44px 36px 1fr;gap:10px;align-items:center"><div class="skel"></div><div class="skel" style="height:36px;border-radius:50%"></div><div style="display:grid;gap:6px"><div class="skel" style="width:60%"></div><div class="skel" style="width:35%"></div></div></div>').join('')}</div>`,
    empty: `${filters({ p: 'שעה אחרונה', a: 'אנשים' })}<div class="stt"><div class="big">${ic('hist')}</div><h4>אין פעילות בתקופה הזאת</h4><div>לא נרשם שינוי שהתבצע על ידי אנשים בשעה האחרונה.</div><button class="btn">הרחב ל־30 יום</button></div>`,
    perm: `<div class="stt lock"><div class="big">${ic('lock')}</div><h4>אין לך הרשאה לראות את הפעילות של ההתקן</h4><div>הצפייה בפעילות ניתנת לפי אזור. אפשר עדיין לראות את התזמונים.</div></div>`,
    unav: `<div class="stt err"><div class="big">${ic('wifi')}</div><h4>ההיסטוריה אינה זמינה כרגע</h4><div>החיבור לתשתית המערכת נותק. מוצג מה שנשמר מקומית מתאריך 4.10, ואין ודאות שהוא שלם.</div><button class="btn">${ic('refresh')}נסו שוב</button></div>`,
    partial: `<div class="pf" style="border-top:0;border-bottom:1px solid var(--sw-border);color:var(--sw-warning);background:var(--sw-warning-soft)">${ic('alert')}<span>המערכת הייתה מנותקת בין 03:10 ל־03:42 היום. ייתכן שחסרים אירועים בטווח הזה.</span></div>${feed('light', { n: 3 })}`,
  };
  return st[k];
}

/* ---------------- editor sheet ---------------- */
function editorBody() {
  return `<div class="ed"><div style="display:flex;align-items:center;gap:6px"><button class="ib" aria-label="חזרה">${ic('back')}</button><b style="font-size:var(--sw-fs-lg);color:var(--sw-heading)">עריכת תזמון: תאורת ערב</b></div>
  <div><label>שם</label><div class="inp2">תאורת ערב</div></div>
  <div><label>התקנים בתזמון</label><div class="pe"><span class="chip nodot" style="background:var(--sw-accent-soft);color:var(--sw-accent-text)">${ic('bulb')} תאורת סלון (נוכחי)</span><span class="chip nodot" style="background:var(--sw-surface-3)">תאורת מרפסת</span></div></div>
  <div><label>שעות והפעולות</label><div class="pe"><span class="ba">18:30 · הדלקה 60%</span><span class="ba">23:00 · כיבוי</span><button class="btn sm ghost">${ic('plus')}שעה</button></div></div>
  <div><label>ימים</label>${dayRow([0, 1, 2, 3, 4, 5, 6])}</div>
  <div><label>תנאים</label><div class="note">ללא תנאים</div></div>
  <div class="pf" style="border:0;padding:0">${ic('info')}<span>זה העורך הקיים של התזמונים, בתוך המסגרת של החלון. שמירה מחזירה לרשימה.</span></div>
  <div style="display:flex;gap:8px;flex-direction:row-reverse;justify-content:flex-end"><button class="btn pri">שמירה</button><button class="btn">ביטול</button></div></div>`;
}

/* ---------------- screens ---------------- */
function filterOpenDesktop(which) {
  const opts = { p: ['שעה אחרונה', '24 שעות', '7 ימים אחרונים', '30 יום', 'טווח תאריכים...'], a: ['כל הגורמים', 'אנשים', 'אוטומציות', 'תזמונים', 'סצנות', 'ידני בהתקן', 'מערכת'], k: ['כל סוגי האירועים', 'הפעלה וכיבוי', 'שינוי ערך', 'זמינות'] }[which];
  const sel = { p: 2, a: 0, k: 0 }[which];
  return `<div class="ddp" style="inset-inline-start:${which === 'p' ? 18 : which === 'a' ? 160 : 300}px">${opts.map((x, i) => `<div class="opt ${i === sel ? 'sel' : ''}"><span class="rad"></span>${x}</div>`).join('')}</div>`;
}
function filterSheet() {
  const o = ['כל הגורמים', 'אנשים', 'אוטומציות', 'תזמונים', 'סצנות', 'ידני בהתקן', 'מערכת'];
  return `<div class="sub-sheet dh"><div class="grab"></div><h4>סוג גורם</h4>${o.map((x, i) => `<div class="opt ${i === 1 ? 'sel' : ''}" style="min-height:48px"><span class="rad"></span>${x}</div>`).join('')}<div style="display:flex;gap:8px;margin-block-start:8px"><button class="btn pri" style="flex:1">החל</button><button class="btn" style="flex:1">נקה</button></div></div>`;
}
const SCREENS = {
  'press': { t: 'התנהגות לחיצה ארוכה והחלופות הנגישות (שולחן עבודה)', fn: pressScreen, d: 'desktop' },
  'press-phone': { t: 'לחיצה ארוכה והחלופות בטלפון', fn: pressPhone, d: 'phone' },
  'desk-activity': { t: 'חלון פעילות: לשונית "פעילות" (שולחן עבודה)', fn: () => stage(popup('light', 'act', actBody('light', { f: {} }), { foot: true })), d: 'desktop' },
  'desk-filters': { t: 'מסננים פתוחים (שולחן עבודה)', fn: () => stage(popup('light', 'act', filters({ a: 'אנשים' }).replace('</div>', filterOpenDesktop('a') + '</div>') + feed('light', { n: 2 }))), d: 'desktop' },
  'desk-schedules': { t: 'לשונית "תזמונים" (שולחן עבודה)', fn: () => stage(popup('light', 'sch', schedBody())), d: 'desktop' },
  'desk-editor': { t: 'עריכת תזמון בתוך החלון (העורך הקיים)', fn: () => stage(popup('light', 'sch', editorBody())), d: 'desktop' },
  'phone-activity': { t: 'גיליון תחתון: "פעילות" (טלפון)', fn: () => stage(popup('light', 'act', actBody('light', { n: 4 }), { foot: true })), d: 'phone' },
  'phone-filters': { t: 'בורר מסנן כגיליון (ui.dd_phone = sheet)', fn: () => stage(popup('light', 'act', actBody('light', { f: { a: 'אנשים' }, n: 2 }) + filterSheet())), d: 'phone' },
  'phone-schedules': { t: 'גיליון תחתון: "תזמונים" (טלפון)', fn: () => stage(popup('light', 'sch', schedBody())), d: 'phone' },
  'phone-editor': { t: 'עורך תזמון בגיליון (טלפון)', fn: () => stage(popup('light', 'sch', editorBody())), d: 'phone' },
  'states': { t: 'מצבים: טעינה, ריק, אין הרשאה, היסטוריה לא זמינה, חלקית', fn: statesScreen, d: 'desktop' },
  'states-sched': { t: 'מצבי לשונית תזמונים: ריק ואין הרשאה', fn: statesSched, d: 'desktop' },
  'variants': { t: 'וריאנטים לפי סוג התקן: תאורה, מתג, תריס, מזגן', fn: variantsScreen, d: 'desktop' },
  'domains': { t: 'אילו ישויות נחשבות "חשמליות" ואיך הממשק יודע', fn: domainsScreen, d: 'desktop' },
};
function statesScreen() {
  const cell = (h, b, tab = 'act') => `<div><div class="note" style="margin-block-end:6px"><b>${h}</b></div>${popup('light', tab, b)}</div>`;
  return `<div class="vgrid dh">${cell('טעינה', stateBody('load'))}${cell('ריק (אחרי סינון)', stateBody('empty'))}${cell('אין הרשאה לצפייה בפעילות', stateBody('perm'))}${cell('היסטוריה לא זמינה', stateBody('unav'))}${cell('היסטוריה חלקית (פער בנתונים)', stateBody('partial'))}${cell('טעינת עוד (בתחתית הרשימה)', feed('light', { n: 2 }) + '<div class="more2"><button class="btn" disabled>טוען...</button></div>')}</div>`;
}
function statesSched() { return `<div class="vgrid dh"><div>${popup('light', 'sch', schedBody({ state: 'empty' }), { cnt: 0 })}</div><div>${popup('light', 'sch', schedBody({ state: 'noperm' }), { cnt: '' })}</div></div>`; }
function variantsScreen() {
  const v = (k, extra) => `<div>${popup(k, 'act', filters() + feed(k, { n: 3 }), { cnt: k === 'switch' ? 1 : 2 })}<div class="note" style="margin-block-start:6px">${extra}</div></div>`;
  return `<div class="vgrid dh"><h3 class="vh">התוכן משתנה לפי סוג ההתקן; המסגרת, הלשוניות והמסננים זהים</h3>
  ${v('light', 'תאורה: הדלקה, כיבוי, בהירות, גוון. הערך "לפני / אחרי" באחוזים.')}${v('switch', 'מתג ושקע: הדלקה וכיבוי בלבד. מקור "לא ידוע" מוצג בקו מקווקו ולא מנחש.')}${v('cover', 'תריס: נפתח, נסגר, נעצר, ומיקום באחוזים לפני ואחרי.')}${v('climate', 'מזגן: מצב, טמפרטורת יעד, מאוורר. שינוי טמפרטורת מקור (חיישן) אינו אירוע.')}</div>`;
}
function domainsScreen() {
  const rows = [['light', 'כן', 'תאורה', 'הפעלה, בהירות, גוון'], ['switch (גם שקע)', 'כן', 'מתג ושקע', 'הפעלה וכיבוי'], ['cover', 'כן', 'תריס, וילון, שער חשמלי', 'פתיחה, סגירה, מיקום באחוזים'], ['climate', 'כן', 'מזגן, חימום, תרמוסטט', 'מצב, טמפרטורת יעד, מאוורר'], ['fan, humidifier', 'כן', 'מאוורר, מכשיר לחות', 'הפעלה, מהירות, יעד'], ['input_boolean', 'כן, מסומן "וירטואלי"', 'מתג חשוב מבחינה לוגית', 'הפעלה וכיבוי'], ['water_heater, valve', 'שלב מאוחר', 'דוד, ברז חשמלי', 'כמו מתג'], ['lock, alarm_control_panel', 'לא (שאלה לבעלים)', 'אבטחה: יש לה יומן נפרד ורגיש', ''], ['media_player', 'לא: יש חלון נגן משלו', 'לחיצה ארוכה נשארת של הנגן', ''], ['sensor, binary_sensor, camera, scene, script, automation', 'לא', 'חיישנים אינם מבוצעים; סצנות הן מקור, לא התקן', '']];
  return `<div class="pad dh"><h2>ישויות "חשמליות"</h2><div class="note">הממשק לא מנחש לפי שם או אייקון. השרת מחזיר בכל שורת כרטיס את השדה <span class="kbd">activity: true|false</span>, והוא נגזר מאותה טבלה (<span class="kbd">card_of</span> ב־devices.py) שמחליטה איזה כרטיס מקבל פקדים: lighting, switches, climate, covers. כך שלחיצה ארוכה, פריט "פעילות" בתפריט והלשונית זמינים אך ורק כשהשרת אישר, וגם רק למי שיש <span class="kbd">devices.read</span> על ההתקן.</div>
  <table class="mtx"><thead><tr><th>domain</th><th>נחשב חשמלי</th><th>דוגמה</th><th>מה נרשם</th></tr></thead><tbody>${rows.map((r) => `<tr><td><span class="kbd">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table></div>`;
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
