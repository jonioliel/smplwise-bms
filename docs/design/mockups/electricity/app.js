/* Electricity meters and bills (CR-023) - static mockup gallery. Fake data only (no real customer, meter or device).
   Open index.html from file:// (no build, no network). State lives in the URL hash so every view has a link:
   #s=<screen>&d=desktop|tablet|phone&t=light|dark&k=classic|domus|tesla|bubble&p=full|view
   Not product code: the real screens are built in phase P4 from the shared components. */
'use strict';

/* ------------------------------------------------------------------ state */
const S = { s: 'index', d: 'desktop', t: 'light', k: 'classic', p: 'full', ms: 'meters' };
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
const MONEY = () => S.p === 'full';

/* ------------------------------------------------------------------ helpers */
const r2 = (x) => Math.round(x * 100 + 1e-9) / 100;
const f2 = (x) => Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f4 = (x) => Number(x).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const f0 = (x) => Number(x).toLocaleString('en-US', { maximumFractionDigits: 0 });
const N = (s) => `<span class="num">${s}</span>`;
const kwh = (x) => `${N(f2(x))} <span class="mut">קוט״ש</span>`;
const ils = (x) => N(`${f2(x)} ₪`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const I = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', media: 'M3 5h18v12H3zM8 21h8', door: 'M6 3h12v18H6zM14 12h1',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5', doc: 'M6 2h9l5 5v15H6zM14 2v6h6', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', more: 'M5 12h.01M12 12h.01M19 12h.01', lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4',
};
const ic = (n, sw = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${I[n]}"/></svg>`;

/* ------------------------------------------------------------------ fake data */
const AREAS = [
  { floor: 'קומת קרקע', areas: ['חדר חשמל', 'לובי', 'מאפיית השקד'] },
  { floor: 'קומה 1', areas: ['סטודיו אורן', 'מסדרון קומה 1'] },
  { floor: 'קומה 2', areas: ['משרדי גל-טק'] },
  { floor: 'חניון', areas: ['חניון'] },
];
// id, name, area, floor, current reading, today, this month, last period (Sept), status, minutes since last report
const METERS = [
  ['m1', 'לוח ראשי - בניין', 'חדר חשמל', 'קומת קרקע', 248912.40, 612.30, 2410.70, 18240.50, 'ok'],
  ['m2', 'לוח סטודיו', 'סטודיו אורן', 'קומה 1', 13264.20, 24.60, 98.10, 685.48, 'ok'],
  ['m3', 'תאורת לובי', 'לובי', 'קומת קרקע', 4553.90, 10.10, 41.20, 302.40, 'ok'],
  ['m4', 'מזגן משותף - קומה 1', 'מסדרון קומה 1', 'קומה 1', 9112.80, 31.40, 140.70, 1104.20, 'ok'],
  ['m5', 'לוח גל-טק', 'משרדי גל-טק', 'קומה 2', 31770.25, 48.20, 181.60, 1360.30, 'ok'],
  ['m6', 'לוח מאפייה - פאזה 1', 'מאפיית השקד', 'קומת קרקע', 18402.11, 41.30, 152.40, 1150.10, 'ok'],
  ['m7', 'לוח מאפייה - פאזה 2', 'מאפיית השקד', 'קומת קרקע', 17995.40, 39.80, 146.90, 1098.60, 'ok'],
  ['m8', 'לוח מאפייה - פאזה 3', 'מאפיית השקד', 'קומת קרקע', 18120.07, 22.10, 129.50, 1121.40, 'stale'],
  ['m9', 'מעלית', 'לובי', 'קומת קרקע', 6240.66, 7.20, 27.80, 210.30, 'ok'],
  ['m10', 'חניון - תאורה', 'חניון', 'חניון', 3880.20, 0, 0, 96.00, 'paused'],
  ['m11', 'עמדת טעינה 1', 'חניון', 'חניון', 2104.90, 12.80, 46.30, 344.10, 'ok'],
  ['m12', 'משאבות מים', 'חדר חשמל', 'קומת קרקע', 1560.33, 2.90, 11.60, 88.20, 'ok'],
].map(([id, name, area, floor, val, today, month, last, st]) => ({ id, name, area, floor, val, today, month, last, st }));
const M = Object.fromEntries(METERS.map((m) => [m.id, m]));
// sensors of the system infrastructure that are NOT valid meters (shown in the picker with the reason)
const CANDIDATES_BAD = [
  { name: 'הספק לוח ראשי', area: 'חדר חשמל', val: '14.2 kW', why: 'kw' },
  { name: 'הספק מזגן משותף', area: 'מסדרון קומה 1', val: '2,310 W', why: 'kw' },
  { name: 'צריכה יומית - מאפייה', area: 'מאפיית השקד', val: '41.3 kWh', why: 'total' },
  { name: 'אנרגיה מוחזרת - גג', area: 'חדר חשמל', val: '1,204.5 kWh', why: 'returned' },
  { name: 'מתח פאזה 1', area: 'חדר חשמל', val: '231 V', why: 'unit' },
];
const WHY = {
  kw: 'החיישן מודד הספק רגעי (קילוואט), לא צריכה מצטברת. לחשבון חשמל צריך מונה שמציג קוט״ש.',
  unit: 'יחידת המידה היא וולט. אפשר לבחור רק מונה שמודד קוט״ש, וואט־שעה או מגוואט־שעה.',
  total: 'המונה מתאפס כל יום. מתאים, אבל מונה מצטבר עדיף.',
  returned: 'מונה של אנרגיה מוחזרת לרשת. לא נתמך בחשבון צריכה.',
};
const CUSTOMERS = [
  { id: 'c1', no: '0001', name: 'סטודיו אורן לעיצוב', addr: 'רחוב הדוגמה 12, קומה 1, עיר לדוגמה', phone: '050-0000001', email: 'studio@example.co.il', reg: '' },
  { id: 'c2', no: '0002', name: 'גל-טק פתרונות בע״מ', addr: 'רחוב הדוגמה 12, קומה 2, עיר לדוגמה', phone: '050-0000002', email: 'office@example.co.il', reg: '510000001' },
  { id: 'c3', no: '0003', name: 'מאפיית השקד', addr: 'רחוב הדוגמה 12, קומת קרקע, עיר לדוגמה', phone: '050-0000003', email: 'bakery@example.co.il', reg: '' },
  { id: 'c4', no: '0004', name: 'ועד הבית - בניין הדוגמה', addr: 'רחוב הדוגמה 12, עיר לדוגמה', phone: '050-0000004', email: 'vaad@example.co.il', reg: '' },
];
const C = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]));
const VAT = 0.18;
const TARIFFS = [
  { id: 't1', name: 'תעריף מסחרי', price: 0.5430, mode: 'ex', from: '01.07.2026', prev: [['01.01.2026', 0.5384], ['01.07.2025', 0.5291]] },
  { id: 't2', name: 'שטחים משותפים', price: 0.6402, mode: 'inc', from: '01.07.2026', prev: [['01.01.2026', 0.6353]] },
];
const T = Object.fromEntries(TARIFFS.map((t) => [t.id, t]));
const exPrice = (t) => (t.mode === 'ex' ? t.price : t.price / (1 + VAT));
const incPrice = (t) => (t.mode === 'inc' ? t.price : t.price * (1 + VAT));
function charge(t, k) { // returns {amt (before VAT), vat, tot}; see CR-023 section 7
  if (t.mode === 'ex') { const amt = r2(k * t.price); const vat = r2(amt * VAT); return { amt, vat, tot: r2(amt + vat) }; }
  const tot = r2(k * t.price); const amt = r2(tot / (1 + VAT)); return { amt, vat: r2(tot - amt), tot };
}
// formula: list of terms {sign:+1|-1, pct:number|null, m:meterId}
const ACCOUNTS = [
  { id: 'a1', name: 'סטודיו אורן - קומה 1', c: 'c1', letter: '', f: [{ s: 1, m: 'm2' }, { s: 1, pct: 30, m: 'm3' }], per: 'חודשי, מה-1 בחודש', t: 't1', st: 'ok', last: '2026-09-0001', lastSt: 'sent' },
  { id: 'a2', name: 'משרדי גל-טק - קומה 2', c: 'c2', letter: 'A', f: [{ s: 1, m: 'm5' }, { s: 1, pct: 50, m: 'm4' }], per: 'חודשי, מה-1 בחודש', t: 't1', st: 'ok', last: '2026-09-0002A', lastSt: 'paid' },
  { id: 'a5', name: 'גל-טק - עמדת טעינה', c: 'c2', letter: 'B', f: [{ s: 1, m: 'm11' }], per: 'חודשי, מה-1 בחודש', t: 't1', st: 'ok', last: '2026-09-0002B', lastSt: 'issued' },
  { id: 'a3', name: 'מאפיית השקד', c: 'c3', letter: '', f: [{ s: 1, m: 'm6' }, { s: 1, m: 'm7' }, { s: 1, m: 'm8' }], per: 'דו-חודשי, מה-1 בינואר', t: 't1', st: 'stale', last: '2026-08-0003', lastSt: 'paid' },
  { id: 'a4', name: 'שטחים משותפים', c: 'c4', letter: '', f: [{ s: 1, m: 'm1' }, { s: -1, m: 'm2' }, { s: -1, m: 'm5' }, { s: -1, m: 'm6' }, { s: -1, m: 'm7' }, { s: -1, m: 'm8' }, { s: -1, m: 'm11' }], per: 'חודשי, מה-1 בחודש', t: 't2', st: 'ok', last: null, lastSt: 'draft' },
];
const A = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]));
const termVal = (term, key) => term.s * (term.pct ? term.pct / 100 : 1) * M[term.m][key];
const accVal = (a, key) => r2(a.f.reduce((s, x) => s + termVal(x, key), 0));
const fText = (f) => f.map((x, i) => `${i === 0 ? (x.s < 0 ? '− ' : '') : x.s < 0 ? ' − ' : ' + '}${x.pct ? x.pct + '% × ' : ''}${M[x.m].name}`).join('');
const BSTATE = { draft: ['טיוטה', 'c-mut'], issued: ['הונפק', 'c-acc'], sent: ['נשלח', 'c-warn'], paid: ['שולם', 'c-ok'], void: ['בוטל', 'c-err'] };
const bchip = (st) => `<span class="chip ${BSTATE[st][1]}">${BSTATE[st][0]}</span>`;
// issued bills (kWh for the past months are fixed numbers; Sept comes from the meters)
const BILLS = [];
function addBill(no, a, period, k, st, issued, extra = {}) { const ch = charge(T[A[a].t], k); BILLS.push({ no, a, period, k, st, issued, ...ch, ...extra }); }
addBill(null, 'a4', '01.09.2026 - 30.09.2026', accVal(A.a4, 'last'), 'draft', '');
addBill('2026-09-0001', 'a1', '01.09.2026 - 30.09.2026', accVal(A.a1, 'last'), 'sent', '02.10.2026');
addBill('2026-09-0002A', 'a2', '01.09.2026 - 30.09.2026', accVal(A.a2, 'last'), 'paid', '02.10.2026');
addBill('2026-09-0002B', 'a5', '01.09.2026 - 30.09.2026', accVal(A.a5, 'last'), 'issued', '02.10.2026');
addBill('2026-08-0001-2', 'a1', '01.08.2026 - 31.08.2026', 812.40, 'paid', '06.09.2026', { rev: '2026-08-0001' });
addBill('2026-08-0001', 'a1', '01.08.2026 - 31.08.2026', 1812.40, 'void', '02.09.2026', { reason: 'קריאת סוף תקופה שגויה, הוחלף ב-2026-08-0001-2' });
addBill('2026-08-0002A', 'a2', '01.08.2026 - 31.08.2026', 2004.10, 'paid', '02.09.2026');
addBill('2026-08-0002B', 'a5', '01.08.2026 - 31.08.2026', 401.70, 'paid', '02.09.2026');
addBill('2026-08-0003', 'a3', '01.07.2026 - 31.08.2026', 6880.50, 'paid', '02.09.2026');
addBill('2026-08-0004', 'a4', '01.08.2026 - 31.08.2026', 13104.90, 'paid', '02.09.2026');
addBill('2026-07-0001', 'a1', '01.07.2026 - 31.07.2026', 845.00, 'paid', '03.08.2026');
addBill('2026-07-0002A', 'a2', '01.07.2026 - 31.07.2026', 2120.80, 'paid', '03.08.2026');
const HIST = [['10.25', 702], ['11.25', 688], ['12.25', 731], ['01.26', 805], ['02.26', 842], ['03.26', 790], ['04.26', 655], ['05.26', 610], ['06.26', 690], ['07.26', 845], ['08.26', 812.4], ['09.26', 776.2]];

/* ------------------------------------------------------------------ shell */
const RAIL = [['devices', 'home', 'ראשי'], ['security', 'shield', 'אבטחה'], ['explore', 'map', 'מפה'], ['multimedia', 'media', 'מולטימדיה'], ['wiskey', 'door', 'WisKey'], ['infra', 'bolt', 'תשתיות']];
const L2_INFRA = [['meters', 'מונים'], ['accounts', 'חשבונות'], ['bills', 'חיובים'], ['customers', 'לקוחות']];
const SET_TABS = [['general', 'כללי'], ['notif', 'התראות'], ['access', 'משתמשים והרשאות'], ['security', 'אבטחה'], ['storage', 'אחסון'], ['entities', 'קטלוג התקנים'], ['infra', 'תשתיות']];
function shell(body, o) {
  const area = o.area || 'infra';
  const rail = RAIL.map(([id, i, l]) => `<a class="${id === area ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  let bars = '';
  if (area === 'infra') {
    const l2 = L2_INFRA.filter(([id]) => MONEY() || (id !== 'bills' && id !== 'customers'));
    bars = `<nav class="tabs l1"><a class="on">חשמל</a></nav>
      <nav class="tabs">${l2.map(([id, l]) => `<a class="${id === o.l2 ? 'on' : ''}" onclick="go('${id === 'meters' ? 'meters' : id}')">${l}</a>`).join('')}</nav>`;
  } else {
    bars = `<nav class="tabs">${SET_TABS.map(([id, l]) => `<a class="${id === o.l1 ? 'on' : ''}" onclick="go('${id === 'access' ? 'set-perms' : id === 'infra' ? 'set-tariffs' : S.s}')">${l}</a>`).join('')}</nav>
      ${o.l1 === 'infra' ? `<nav class="tabs l1"><a class="on">חשמל</a></nav>` : ''}`;
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

/* ------------------------------------------------------------------ shared pieces */
function stChip(m) {
  if (m.st === 'ok') return '<span class="chip c-ok">מדווח</span>';
  if (m.st === 'stale') return '<span class="chip c-warn">לא מדווח</span>';
  return '<span class="chip c-mut">מושהה</span>';
}
function tree(sel = 'הכול') {
  const cnt = (a) => METERS.filter((m) => m.area === a).length;
  return `<div class="tree"><a class="${sel === 'הכול' ? 'on' : ''}" style="padding-inline-start:8px">כל האזורים <span class="cnt">${METERS.length}</span></a>
    ${AREAS.map((f) => `<div class="fl">${f.floor}</div>${f.areas.map((a) => `<a class="${a === sel ? 'on' : ''}">${a}<span class="cnt">${cnt(a)}</span></a>`).join('')}`).join('')}</div>`;
}
function emptyBox(icon, title, text, btn, err) {
  return `<div class="card"><div class="empty ${err ? 'err' : ''}"><div class="ic">${ic(icon)}</div><h3>${title}</h3>${text ? `<div class="mut">${text}</div>` : ''}${btn || ''}</div></div>`;
}
function barChart(data, { h = 180, fmt = (v) => f0(v), hi = -1 } = {}) {
  const W = 640, pad = 26, max = Math.max(...data.map((d) => d[1])) * 1.15, bw = (W - pad * 2) / data.length;
  const bars = data.map(([l, v], i) => {
    const bh = (v / max) * (h - 40); const x = W - pad - (i + 1) * bw + bw * 0.18; // RTL: oldest on the right
    return `<rect class="${i === hi || (hi < 0 && i === data.length - 1) ? 'bar' : 'bar2'}" x="${x}" y="${h - 22 - bh}" width="${bw * 0.64}" height="${bh}" rx="3"/>
      <text x="${x + bw * 0.32}" y="${h - 6}" text-anchor="middle">${l}</text>
      ${data.length <= 14 ? `<text x="${x + bw * 0.32}" y="${h - 26 - bh}" text-anchor="middle">${fmt(v)}</text>` : ''}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="גרף צריכה"><line class="grid" x1="${pad}" x2="${W - pad}" y1="${h - 22}" y2="${h - 22}"/>${bars}</svg>`;
}
function dlg(title, body, acts, wide) { return `<div class="scrim"><div class="dlg ${wide ? 'wide' : ''}"><h3>${title}</h3>${body}<div class="act">${acts}</div></div></div>`; }
const fld = (label, val, o = {}) => `<div class="fld ${o.wide ? 'wide' : ''}"><label>${label}</label><div class="inp ${o.err ? 'err' : ''} ${o.focus ? 'focus' : ''}">${val ? `<span class="${o.num ? 'num' : ''}">${val}</span>` : `<span class="ph">${o.ph || ''}</span>`}${o.suffix ? `<span class="sp" style="flex:1"></span><span class="mut">${o.suffix}</span>` : ''}</div>${o.err ? `<div class="msg">${o.err}</div>` : ''}</div>`;
function forbidden() { return emptyBox('lock', 'אין הרשאה לחיובים', '', ''); }

/* ------------------------------------------------------------------ meters overview (Infrastructure > Electricity > Meters) */
function metersTable(list) {
  if (PH()) {
    return `<div class="list">${list.map((m) => `<div class="li" onclick="go('meter')"><div class="grow"><div class="t1">${m.name}</div><div class="t2">${m.area} · היום ${N(f2(m.today))} קוט״ש</div></div>
      <div style="text-align:left">${stChip(m)}<div class="t2 num" style="margin-top:4px">${f2(m.val)}</div></div></div>`).join('')}</div>`;
  }
  const accCount = (id) => ACCOUNTS.filter((a) => a.f.some((x) => x.m === id)).length;
  return `<div class="card flush scrollx"><table class="t"><thead><tr><th>שם</th><th>אזור</th><th class="num">קריאה נוכחית (קוט״ש)</th><th class="num">היום</th><th class="num">מתחילת החודש</th><th>מצב</th>${S.d === 'desktop' ? '<th>בחשבונות</th>' : ''}</tr></thead><tbody>
    ${list.map((m) => `<tr onclick="go('meter')" style="cursor:pointer"><td class="b">${m.name}</td><td>${m.area}${S.d === 'desktop' ? ` <span class="mut">· ${m.floor}</span>` : ''}</td><td class="num">${f2(m.val)}</td><td class="num">${f2(m.today)}</td><td class="num">${f2(m.month)}</td><td>${stChip(m)}${m.st === 'stale' ? ' <span class="mut">מ-18:40</span>' : ''}</td>${S.d === 'desktop' ? `<td>${accCount(m.id) || '<span class="mut">-</span>'}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}
function metersCards(list) {
  return `<div class="grid-cards">${list.map((m) => `<div class="card" onclick="go('meter')"><div class="row"><b class="h3" style="font-size:var(--sw-fs-md)">${m.name}</b><span class="sp"></span>${stChip(m)}</div>
    <div class="mut">${m.area} · ${m.floor}</div><div class="row" style="margin-top:8px;align-items:baseline"><span style="font-size:22px;font-weight:700;color:var(--sw-heading)">${N(f2(m.today))}</span><span class="mut">קוט״ש היום</span><span class="sp"></span><span class="mut num">${f2(m.val)}</span></div></div>`).join('')}</div>`;
}
function metersBody(state, view = 'table') {
  const head = `<div class="row"><div class="inp" style="width:${PH() ? '100%' : '260px'}">${ic('search')}<span class="ph">חיפוש מונה</span></div>
    ${PH() ? '' : `<div class="seg2"><a class="${view === 'cards' ? 'on' : ''}" onclick="go('meters-cards')">כרטיסים</a><a class="${view === 'table' ? 'on' : ''}" onclick="go('meters')">טבלה</a></div>`}
    <span class="sp"></span>${PH() ? '<span class="btn sm">כל האזורים ▾</span>' : ''}<button class="btn pri ${PH() ? 'sm' : ''}" onclick="go('meter-add')">+ הוספת מונה</button></div>`;
  if (state === 'empty') return emptyBox('bolt', 'אין מונים עדיין', '', '<button class="btn pri" onclick="go(\'meter-add\')">+ הוספת מונה</button>');
  if (state === 'error') return emptyBox('alert', 'לא ניתן לטעון את המונים', '', '<button class="btn">נסה שוב</button>', true);
  const today = METERS.reduce((s, m) => s + m.today, 0), month = METERS.reduce((s, m) => s + m.month, 0);
  const tiles = `<div class="tiles"><div class="tile"><div class="k">היום</div><div class="v">${N(f0(today))}<span class="u">קוט״ש</span></div></div>
    <div class="tile"><div class="k">מתחילת החודש</div><div class="v">${N(f0(month))}<span class="u">קוט״ש</span></div></div>
    <div class="tile"><div class="k">מדווחים</div><div class="v">${N('10')}<span class="u">מתוך 12</span></div></div>
    <div class="tile"><div class="k">לא מדווחים</div><div class="v" style="color:var(--sw-warning)">${N('1')}</div></div></div>`;
  const listHtml = state === 'loading'
    ? `<div class="card">${Array.from({ length: 7 }, () => `<div class="row" style="padding:10px 0"><div class="sk" style="width:30%"></div><span class="sp"></span><div class="sk" style="width:14%"></div><div class="sk" style="width:10%"></div></div>`).join('')}</div>`
    : view === 'cards' && !PH() ? metersCards(METERS) : metersTable(METERS);
  if (S.d === 'desktop') return `${head}${state === 'loading' ? '' : tiles}<div class="cols side"><div class="card">${tree()}</div><div>${listHtml}</div></div>`;
  return `${head}${state === 'loading' ? '' : tiles}${listHtml}`;
}
function meterDrawer() {
  const m = M.m2;
  const days = Array.from({ length: 30 }, (_, i) => [String(i + 1), 18 + ((i * 7) % 11) * 1.1 + (i % 7 > 4 ? -6 : 0)]);
  return `<div class="scrim" style="background:var(--sw-overlay)"></div><aside class="drawer">
    <div class="row"><b class="h2">${m.name}</b>${stChip(m)}<span class="sp"></span><button class="btn ghost sm" onclick="go('meters')">סגירה</button></div>
    <dl class="kv"><dt>אזור</dt><dd>${m.area} · ${m.floor}</dd><dt>קריאה נוכחית</dt><dd>${kwh(m.val)}</dd><dt>דיווח אחרון</dt><dd>${N('21:49')}</dd><dt>יחידה</dt><dd>קוט״ש · מונה מצטבר</dd><dt>בחשבונות</dt><dd>סטודיו אורן - קומה 1</dd></dl>
    <div class="row"><b class="h3">צריכה יומית, ספטמבר 2026</b></div>${barChart(days, { h: 150, hi: 29 })}
    <div class="row"><b class="h3">תקופות מונה</b></div>
    <div class="list"><div class="li"><div class="grow"><div class="t1">מ-${N('12.03.2025')}</div><div class="t2">קריאת התחלה ${N('0.00')}</div></div><span class="chip c-acc nodot">פעיל</span></div>
      <div class="li"><div class="grow"><div class="t1">איפוס ב-${N('02.08.2026 03:12')}</div><div class="t2">נספר אוטומטית, ללא אובדן צריכה</div></div></div></div>
    <div class="row"><button class="btn">החלפת מונה</button><button class="btn">השהיה</button><span class="sp"></span><button class="btn dng">הסרה</button></div>
  </aside>`;
}
function pickerList(o = {}) {
  const good = METERS.slice(0, 6);
  const sel = new Set(o.sel || []);
  const rowsGood = good.map((m) => `<div class="li ${sel.has(m.id) ? 'sel' : ''}"><span class="check ${sel.has(m.id) ? 'on' : ''}"></span><div class="grow"><div class="t1">${m.name}</div><div class="t2">${m.area} · ${N(f2(m.val) + ' kWh')}</div></div><span class="chip c-ok">מתאים</span></div>`);
  const rowsBad = CANDIDATES_BAD.map((c, i) => {
    const warn = c.why === 'total'; const focus = o.kw && i === 0;
    return `<div class="li ${warn ? '' : 'dis'}" ${focus ? 'style="opacity:1;border-color:var(--sw-danger)"' : ''}><span class="check ${warn ? '' : 'dis'}"></span><div class="grow"><div class="t1">${c.name}</div><div class="t2">${c.area} · ${N(c.val)}</div>
      ${focus || warn || o.reasons ? `<div class="t2" style="color:${warn ? 'var(--sw-warning)' : 'var(--sw-danger)'};white-space:normal">${WHY[c.why]}</div>` : ''}</div>${warn ? '<span class="chip c-warn">אזהרה</span>' : '<span class="chip c-err">לא מתאים</span>'}</div>`;
  });
  return `<div class="row"><div class="inp focus" style="flex:1;min-width:0">${ic('search')}<span>${o.q || ''}</span><span class="caret"></span></div>${PH() ? '' : '<span class="btn">כל האזורים ▾</span>'}</div>
    ${o.kw ? `<div class="alert err"><span class="x">!</span><div><b>הספק לוח ראשי</b> לא נבחר. ${WHY.kw}</div></div>` : ''}
    <div class="list">${rowsGood.slice(0, o.short ? 4 : 6).join('')}${rowsBad.join('')}</div>`;
}
function meterAdd(kw) {
  const body = `${pickerList({ q: kw ? 'הספק' : 'לוח', kw, sel: kw ? [] : ['m2'], short: true })}`;
  return dlg('הוספת מונה', `<div style="max-height:${PH() ? '520px' : '560px'};overflow:auto;display:flex;flex-direction:column;gap:10px">${body}</div>`,
    `<button class="btn pri" ${kw ? 'disabled' : ''}>הוספה</button><button class="btn" onclick="go('meters')">ביטול</button>`, true);
}

/* ------------------------------------------------------------------ accounts */
function accountsBody(state, view = 'table') {
  if (state === 'empty') return emptyBox('doc', 'אין חשבונות עדיין', '', '<button class="btn pri" onclick="go(\'w1\')">+ חשבון חדש</button>');
  if (state === 'error') return emptyBox('alert', 'לא ניתן לטעון את החשבונות', '', '<button class="btn">נסה שוב</button>', true);
  const head = `<div class="row"><div class="inp" style="width:${PH() ? '100%' : '260px'}">${ic('search')}<span class="ph">חיפוש חשבון או לקוח</span></div>
    ${PH() ? '' : `<div class="seg2"><a class="${view === 'cards' ? 'on' : ''}" onclick="go('accounts-cards')">כרטיסים</a><a class="${view === 'table' ? 'on' : ''}" onclick="go('accounts')">טבלה</a></div>`}<span class="sp"></span><button class="btn pri ${PH() ? 'sm' : ''}" onclick="go('w1')">+ חשבון חדש</button></div>`;
  const stCell = (a) => (a.st === 'stale' ? '<span class="chip c-warn">מונה לא מדווח</span>' : '<span class="chip c-ok">תקין</span>');
  const last = (a) => (a.last ? `${N(a.last)} ${bchip(a.lastSt)}` : bchip('draft'));
  if (PH() || view === 'cards') {
    return `${head}<div class="${PH() ? 'list' : 'grid-cards'}">${ACCOUNTS.map((a) => {
      const k = accVal(a, 'month');
      return PH()
        ? `<div class="li" onclick="go('account')"><div class="grow"><div class="t1">${a.name}</div><div class="t2">${C[a.c].name} · ${N(f2(k))} קוט״ש${MONEY() ? ` · ${N(f2(charge(T[a.t], k).tot) + ' ₪')}` : ''}</div></div>${stCell(a)}</div>`
        : `<div class="card" onclick="go('account')" style="cursor:pointer"><div class="row"><b class="h3">${a.name}</b><span class="sp"></span>${stCell(a)}</div><div class="mut">${C[a.c].name} · ${a.per}</div>
           <div class="row" style="margin-top:10px;align-items:baseline"><span style="font-size:22px;font-weight:700;color:var(--sw-heading)">${N(f2(k))}</span><span class="mut">קוט״ש בתקופה</span><span class="sp"></span>${MONEY() ? `<b>${ils(charge(T[a.t], k).tot)}</b>` : ''}</div>
           <div class="mut" style="margin-top:6px">חיוב אחרון: ${last(a)}</div></div>`;
    }).join('')}</div>`;
  }
  return `${head}<div class="card flush scrollx"><table class="t"><thead><tr><th>חשבון</th><th>לקוח</th>${S.d === 'desktop' ? '<th>נוסחה</th>' : ''}<th>תקופה</th><th class="num">צריכה בתקופה</th>${MONEY() ? '<th class="num">סכום עד כה</th><th>חיוב אחרון</th>' : ''}<th>מצב</th></tr></thead><tbody>
    ${ACCOUNTS.map((a) => { const k = accVal(a, 'month'); return `<tr onclick="go('account')" style="cursor:pointer"><td class="b">${a.name}</td><td>${C[a.c].name}</td>${S.d === 'desktop' ? `<td class="mut" style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fText(a.f)}</td>` : ''}<td>${a.per}</td><td class="num">${f2(k)}</td>${MONEY() ? `<td class="num">${f2(charge(T[a.t], k).tot)} ₪</td><td>${last(a)}</td>` : ''}<td>${stCell(a)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function accountHead(tab) {
  const a = A.a1;
  const tabs = [['status', 'מצב', 'account'], ['history', 'היסטוריה', 'account-history']].concat(MONEY() ? [['bills', 'חיובים', 'account-bills']] : []);
  return `<div class="row"><a class="btn ghost sm" onclick="go('accounts')">→ חשבונות</a></div>
    <div class="row"><div><b class="h2">${a.name}</b><div class="mut">${MONEY() ? `<a onclick="go('customer')" style="color:var(--sw-accent-text);cursor:pointer">${C[a.c].name}</a>` : C[a.c].name} · ${a.per}</div></div><span class="sp"></span>
      ${MONEY() ? `<button class="btn pri" onclick="go('bill-new')">הפקת חיוב</button>` : ''}<button class="btn" onclick="go('w2')">עריכה</button></div>
    <div class="seg2" style="align-self:flex-start">${tabs.map(([id, l, s]) => `<a class="${id === tab ? 'on' : ''}" onclick="go('${s}')">${l}</a>`).join('')}</div>`;
}
function accountStatus(stale) {
  const a = stale ? A.a3 : A.a1; const t = T[a.t]; const k = accVal(a, 'month'); const ch = charge(t, k);
  const rows = a.f.map((x) => { const m = M[x.m]; const start = r2(m.val - m.month); const use = r2(m.month); const part = r2(termVal(x, 'month'));
    return PH() ? `<div class="li"><div class="grow"><div class="t1">${m.name}${x.pct ? ` <span class="mut">(${x.pct}%)</span>` : ''}</div><div class="t2">${N(f2(start))} ← ${N(f2(m.val))}</div></div><b class="num">${f2(part)}</b></div>`
      : `<tr><td class="b">${m.name} ${m.st === 'stale' ? stChip(m) : ''}</td><td class="num">${f2(start)}</td><td class="num">${f2(m.val)}</td><td class="num">${f2(use)}</td><td class="num">${x.pct ? x.pct + '%' : x.s < 0 ? '−' : ''}</td><td class="num b">${f2(part)}</td></tr>`; }).join('');
  const side = `<div class="card"><div class="hd"><b class="h3">לקוח</b><span class="sp"></span>${MONEY() ? '<a class="btn ghost sm" onclick="go(\'customer\')">כרטיס לקוח</a>' : ''}</div>
      <dl class="kv"><dt>שם</dt><dd>${C[a.c].name}</dd><dt>מספר לקוח</dt><dd>${N(C[a.c].no)}</dd>${MONEY() ? `<dt>טלפון</dt><dd>${N(C[a.c].phone)}</dd><dt>דוא״ל</dt><dd>${N(C[a.c].email)}</dd>` : ''}</dl></div>
    ${MONEY() ? `<div class="card"><div class="hd"><b class="h3">מחיר</b></div><dl class="kv"><dt>תעריף</dt><dd>${t.name}</dd><dt>לפני מע״מ</dt><dd>${N(f4(exPrice(t)) + ' ₪')}</dd><dt>כולל מע״מ</dt><dd>${N(f4(incPrice(t)) + ' ₪')}</dd><dt>מע״מ</dt><dd>${N('18%')}</dd></dl></div>` : ''}
    <div class="card"><div class="hd"><b class="h3">חיוב הבא</b></div><dl class="kv"><dt>תקופה</dt><dd>${N('01.10.2026')} - ${N('31.10.2026')}</dd><dt>מספר צפוי</dt><dd>${N('2026-10-' + C[a.c].no)}</dd><dt>טיוטה אוטומטית</dt><dd>${N('01.11.2026')}</dd></dl></div>`;
  const main = `${stale ? `<div class="alert warn"><span class="x">!</span><div><b>לוח מאפייה - פאזה 3</b> לא מדווח מאז ${N('18:40')}. הצריכה תיספר כשהמונה יחזור לדווח.</div></div>` : ''}
    <div class="tiles"><div class="tile"><div class="k">צריכה בתקופה</div><div class="v">${N(f2(k))}<span class="u">קוט״ש</span></div></div>
      <div class="tile"><div class="k">יום ${N('4')} מתוך ${N('31')}</div><div class="prog" style="margin-top:14px"><i style="width:13%"></i></div></div>
      <div class="tile"><div class="k">צפי לסוף התקופה</div><div class="v">${N(f0(k / 4 * 31))}<span class="u">קוט״ש</span></div></div>
      ${MONEY() ? `<div class="tile"><div class="k">סכום עד כה</div><div class="v">${N(f2(ch.tot))}<span class="u">₪</span></div></div>` : `<div class="tile"><div class="k">ממוצע ליום</div><div class="v">${N(f2(k / 4))}<span class="u">קוט״ש</span></div></div>`}</div>
    <div class="card ${PH() ? '' : 'flush'}"><div class="hd"><b class="h3">מונים בנוסחה</b><span class="sp"></span><span class="mut">${fText(a.f)}</span></div>
      ${PH() ? `<div class="list">${rows}</div><div class="row" style="margin-top:10px"><b>סה״כ לחיוב</b><span class="sp"></span><b class="num">${f2(k)}</b></div>`
        : `<div class="scrollx"><table class="t"><thead><tr><th>מונה</th><th class="num">קריאה בתחילת התקופה</th><th class="num">קריאה נוכחית</th><th class="num">צריכה</th><th class="num">חלק</th><th class="num">לחיוב (קוט״ש)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="5">סה״כ לחיוב</td><td class="num">${f2(k)}</td></tr></tfoot></table></div>`}</div>`;
  return `${accountHead('status')}<div class="cols side-l"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">${main}</div><div style="display:flex;flex-direction:column;gap:16px">${side}</div></div>`;
}
function accountHistory() {
  const a = A.a1; const t = T[a.t];
  const rows = HIST.slice().reverse().map(([l, v], i, arr) => { const prev = arr[i + 1]; const d = prev ? ((v - prev[1]) / prev[1]) * 100 : null; const ch = charge(t, v);
    const b = BILLS.find((x) => x.a === 'a1' && x.period.includes('.' + l.replace('.', '.20')) && x.st !== 'void');
    return PH() ? `<div class="li"><div class="grow"><div class="t1">${N(l.replace('.', '/20'))}</div><div class="t2">${N(f2(v))} קוט״ש${d !== null ? ` · ${N((d > 0 ? '+' : '') + d.toFixed(1) + '%')}` : ''}</div></div>${MONEY() ? `<b class="num">${f2(ch.tot)} ₪</b>` : ''}</div>`
      : `<tr><td class="num" style="text-align:right">${l.replace('.', '/20')}</td><td class="num">${f2(v)}</td><td class="num">${d !== null ? (d > 0 ? '+' : '') + d.toFixed(1) + '%' : '-'}</td>${MONEY() ? `<td class="num">${f2(ch.tot)} ₪</td><td>${b ? N(b.no) + ' ' + bchip(b.st) : '<span class="mut">-</span>'}</td>` : ''}</tr>`; }).join('');
  return `${accountHead('history')}<div class="card"><div class="hd"><b class="h3">צריכה לפי תקופה</b><span class="sp"></span><div class="seg2"><a class="on">12 חודשים</a><a>24 חודשים</a></div></div>${barChart(HIST.map(([l, v]) => [l, v]), { h: PH() ? 200 : 220 })}</div>
    <div class="card ${PH() ? '' : 'flush'}">${PH() ? `<div class="list">${rows}</div>` : `<table class="t"><thead><tr><th>תקופה</th><th class="num">קוט״ש</th><th class="num">שינוי</th>${MONEY() ? '<th class="num">סכום</th><th>חיוב</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>`}</div>`;
}
function accountBills() {
  if (!MONEY()) return forbidden();
  return `${accountHead('bills')}${billsTable(BILLS.filter((b) => b.a === 'a1'), true)}`;
}

/* ------------------------------------------------------------------ customers */
function customersBody() {
  if (!MONEY()) return forbidden();
  return `<div class="row"><div class="inp" style="width:${PH() ? '100%' : '260px'}">${ic('search')}<span class="ph">חיפוש לקוח</span></div><span class="sp"></span><button class="btn pri ${PH() ? 'sm' : ''}">+ לקוח חדש</button></div>
    <div class="grid-cards">${CUSTOMERS.map((c) => { const acc = ACCOUNTS.filter((a) => a.c === c.id);
      return `<div class="card" onclick="go('customer')" style="cursor:pointer"><div class="row"><div class="avatar">${c.name.slice(0, 2)}</div><div><b class="h3">${c.name}</b><div class="mut">מספר לקוח ${N(c.no)}</div></div></div>
        <dl class="kv" style="margin-top:10px"><dt>חשבונות</dt><dd>${acc.map((a) => a.name + (a.letter ? ` (${a.letter})` : '')).join(', ')}</dd><dt>טלפון</dt><dd>${N(c.phone)}</dd><dt>דוא״ל</dt><dd>${N(c.email)}</dd></dl></div>`; }).join('')}</div>`;
}
function customerDrawer() {
  const c = C.c2;
  return `<div class="scrim"></div><aside class="drawer"><div class="row"><b class="h2">כרטיס לקוח</b><span class="sp"></span><button class="btn ghost sm" onclick="go('customers')">סגירה</button></div>
    <div class="form">${fld('שם הלקוח', c.name, { wide: true })}${fld('מספר לקוח', c.no, { num: true })}${fld('ח.פ. / ע.מ. (לא חובה)', c.reg, { num: true })}
      ${fld('כתובת למשלוח החיוב', c.addr, { wide: true })}${fld('טלפון', c.phone, { num: true })}${fld('דוא״ל', c.email, { num: true })}${fld('הערות', '', { wide: true, ph: 'לא חובה' })}</div>
    <b class="h3">חשבונות</b><div class="list">${ACCOUNTS.filter((a) => a.c === 'c2').map((a) => `<div class="li"><span class="chip c-acc nodot">${a.letter}</span><div class="grow"><div class="t1">${a.name}</div><div class="t2">סיומת במספר החיוב: ${N('2026-09-0002' + a.letter)}</div></div></div>`).join('')}</div>
    <b class="h3">חיובים אחרונים</b><div class="list">${BILLS.filter((b) => ['a2', 'a5'].includes(b.a)).slice(0, 4).map((b) => `<div class="li"><div class="grow"><div class="t1 num" style="text-align:right">${b.no}</div><div class="t2">${b.period}</div></div><b class="num">${f2(b.tot)} ₪</b>${bchip(b.st)}</div>`).join('')}</div>
    <div class="row"><button class="btn pri">שמירה</button><span class="sp"></span><button class="btn dng">מחיקת לקוח</button></div></aside>`;
}

/* ------------------------------------------------------------------ wizard */
const STEPS = ['בחירת מונים', 'נוסחת החשבון', 'מחיר ומע״מ', 'תקופת חיוב', 'כרטיס לקוח', 'סיכום והפקה'];
function wizard(n, body, o = {}) {
  const steps = STEPS.map((l, i) => `<a class="${i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''}" onclick="go('w${i + 1}')"><span class="n">${i + 1 < n ? '✓' : i + 1}</span>${l}</a>`).join('');
  return `<div class="row"><a class="btn ghost sm" onclick="go('accounts')">→ חשבונות</a><b class="h2">חשבון חדש</b></div>
    <div class="wiz"><div class="card steps">${steps}</div>
      <div class="card" style="display:flex;flex-direction:column;gap:14px">
        <div class="pstep"><b>שלב ${n} מתוך 6</b><span class="mut">${STEPS[n - 1]}</span><div class="bar"><i style="width:${(n / 6) * 100}%"></i></div></div>
        <b class="h2 hide-phone">${STEPS[n - 1]}</b>${body}
        <div class="wfoot">${n > 1 ? `<button class="btn" onclick="go('w${n - 1}')">הקודם</button>` : '<span></span>'}${n < 6 ? `<button class="btn pri" onclick="go('w${n + 1}')" ${o.block ? 'disabled' : ''}>הבא</button>` : `<button class="btn pri" onclick="go('account')">שמירה והפקת טיוטה</button>`}</div>
      </div></div>`;
}
function w1(kw) {
  return wizard(1, `${pickerList({ q: kw ? 'הספק' : '', kw, sel: ['m2', 'm3'], reasons: true })}
    <div class="row"><span class="chip c-acc nodot">נבחרו 2 מונים</span><span class="mut">לוח סטודיו, תאורת לובי</span></div>`);
}
const TOK = (t) => t.k === 'm' ? `<span class="tok m ${t.bad ? 'bad' : ''}">${M[t.m].name}<small class="num">${f2(M[t.m].last)}</small></span>` : t.k === 'op' ? `<span class="tok op">${t.v}</span>` : `<span class="tok k num">${t.v}</span>`;
function w2(variant) {
  // variant: ok | text | neg | paren | presets(main-sub)
  let toks, res, msg, preset = 'custom';
  if (variant === 'mainsub') {
    preset = 'mainsub';
    toks = [{ k: 'm', m: 'm1' }, { k: 'op', v: '−' }, { k: 'm', m: 'm2' }, { k: 'op', v: '−' }, { k: 'm', m: 'm5' }, { k: 'op', v: '−' }, { k: 'm', m: 'm11' }];
    res = r2(M.m1.last - M.m2.last - M.m5.last - M.m11.last);
  } else if (variant === 'neg') {
    toks = [{ k: 'm', m: 'm3' }, { k: 'op', v: '−' }, { k: 'm', m: 'm2', bad: true }];
    res = r2(M.m3.last - M.m2.last);
  } else if (variant === 'paren') {
    toks = [{ k: 'op', v: '(' }, { k: 'm', m: 'm2' }, { k: 'op', v: '+' }, { k: 'm', m: 'm3' }, { k: 'op', v: '×' }, { k: 'n', v: '30%' }];
    res = null;
  } else {
    toks = [{ k: 'm', m: 'm2' }, { k: 'op', v: '+' }, { k: 'n', v: '30%' }, { k: 'op', v: '×' }, { k: 'm', m: 'm3' }];
    res = r2(M.m2.last + 0.3 * M.m3.last);
  }
  if (variant === 'neg') msg = `<div class="alert err"><span class="x">!</span><div>התוצאה שלילית בתקופה האחרונה (${N(f2(res))} קוט״ש). בדקו את הסימנים בנוסחה.</div></div>`;
  else if (variant === 'paren') msg = `<div class="alert err"><span class="x">!</span><div>חסר סוגר. כל סוגר שנפתח צריך להיסגר.</div></div>`;
  else msg = `<div class="alert ok"><span class="x">✓</span><div>הנוסחה תקינה</div></div>`;
  const presets = [['sum', 'סכום', 'כל המונים יחד'], ['mainsub', 'ראשי פחות משנה', 'מונה ראשי פחות מוני משנה'], ['pct', 'חלק באחוזים', 'אחוז מתוך מונה'], ['custom', 'נוסחה חופשית', 'מונים, פעולות ומספרים']]
    .map(([id, b, s]) => `<div class="preset ${id === preset ? 'on' : ''}" onclick="go('${id === 'mainsub' ? 'w2-mainsub' : 'w2'}')"><b>${b}</b><span>${s}</span></div>`).join('');
  const editor = variant === 'text'
    ? `<div class="inp focus code" style="min-height:52px;font-size:15px">[לוח סטודיו] + 30% * [תאורת לובי]<span class="caret" style="height:20px"></span></div><div class="mut">שמות מונים בסוגריים מרובעים. פעולות: + − × ( ) ומספרים או אחוזים.</div>`
    : `<div class="expr ${variant === 'neg' || variant === 'paren' ? 'err' : ''}">${toks.map(TOK).join('')}<span class="caret"></span></div>
       <div class="pal"><button class="btn">+ מונה ▾</button><button class="btn">+</button><button class="btn">−</button><button class="btn">×</button><button class="btn">%</button><button class="btn">(</button><button class="btn">)</button><button class="btn">מספר</button><span class="sp" style="flex:1"></span><button class="btn ghost">⌫ מחיקה</button></div>`;
  const used = [...new Set(toks.filter((t) => t.k === 'm').map((t) => t.m))];
  const preview = res === null ? '' : `<div class="card ${PH() ? '' : 'flush'}" style="background:var(--sw-surface-2)"><div class="hd"><b class="h3">בדיקה על ספטמבר 2026</b></div>
    ${PH() ? `<div class="list">${used.map((id) => `<div class="li"><div class="grow t1">${M[id].name}</div><b class="num">${f2(M[id].last)}</b></div>`).join('')}</div><div class="row" style="margin-top:8px"><b>צריכת החשבון</b><span class="sp"></span><b class="num" style="${res < 0 ? 'color:var(--sw-danger)' : ''}">${f2(res)}</b></div>`
      : `<table class="t"><thead><tr><th>מונה</th><th class="num">צריכה (קוט״ש)</th></tr></thead><tbody>${used.map((id) => `<tr><td>${M[id].name}</td><td class="num">${f2(M[id].last)}</td></tr>`).join('')}</tbody><tfoot><tr><td>צריכת החשבון</td><td class="num" style="${res < 0 ? 'color:var(--sw-danger)' : ''}">${f2(res)}</td></tr></tfoot></table>`}</div>`;
  return wizard(2, `<div class="presets">${preset === 'custom' || preset === 'mainsub' ? presets : presets}</div>
    <div class="row"><b class="h3">הנוסחה</b><span class="sp"></span><div class="seg2"><a class="${variant === 'text' ? '' : 'on'}" onclick="go('w2')">בונה</a><a class="${variant === 'text' ? 'on' : ''}" onclick="go('w2-text')">טקסט</a></div></div>
    ${editor}${msg}${preview}`, { block: variant === 'neg' || variant === 'paren' });
}
function w3() {
  const cards = TARIFFS.map((t, i) => `<div class="li ${i === 0 ? 'sel' : ''}"><span class="radio ${i === 0 ? 'on' : ''}"></span><div class="grow"><div class="t1">${t.name}</div><div class="t2">הוזן ${t.mode === 'ex' ? 'לפני' : 'כולל'} מע״מ · בתוקף מ-${N(t.from)}</div></div><b class="num">${f4(t.price)} ₪</b></div>`).join('');
  const t = TARIFFS[0];
  return wizard(3, `<div class="list">${cards}</div><div class="row"><a class="btn ghost sm" onclick="go('set-tariff-edit')">+ תעריף חדש</a></div>
    <div class="card" style="background:var(--sw-surface-2)"><dl class="kv"><dt>מחיר לקוט״ש לפני מע״מ</dt><dd>${N(f4(exPrice(t)) + ' ₪')}</dd><dt>מע״מ</dt><dd>${N('18%')} <span class="mut">(מההגדרות)</span></dd><dt>מחיר לקוט״ש כולל מע״מ</dt><dd>${N(f4(incPrice(t)) + ' ₪')}</dd>
      <dt>לדוגמה, ספטמבר 2026</dt><dd>${N(f2(776.2))} קוט״ש = ${ils(charge(t, 776.2).tot)}</dd></dl></div>`);
}
function w4() {
  return wizard(4, `<div class="form"><div class="fld"><label>אורך תקופה</label><div class="seg2"><a class="on">חודשית</a><a>דו-חודשית</a></div></div>
      ${fld('יום תחילת תקופה', '1', { num: true, suffix: 'בחודש' })}${fld('תחילת החיוב הראשון', '01.10.2026', { num: true })}
      <div class="fld"><label>טיוטה אוטומטית בסוף כל תקופה</label><div class="seg2"><a class="on">כן</a><a>לא</a></div></div></div>
    <div class="card flush" style="background:var(--sw-surface-2)"><div class="hd"><b class="h3">התקופות הבאות</b></div><table class="t"><thead><tr><th>תקופה</th><th>מספר חיוב</th></tr></thead><tbody>
      <tr><td>${N('01.10.2026')} - ${N('31.10.2026')}</td><td class="num" style="text-align:right">2026-10-0005</td></tr><tr><td>${N('01.11.2026')} - ${N('30.11.2026')}</td><td class="num" style="text-align:right">2026-11-0005</td></tr><tr><td>${N('01.12.2026')} - ${N('31.12.2026')}</td><td class="num" style="text-align:right">2026-12-0005</td></tr></tbody></table></div>`);
}
function w5(existing) {
  const body = existing
    ? `<div class="inp focus">${ic('search')}<span>גל</span><span class="caret" style="height:18px"></span></div><div class="list"><div class="li sel"><span class="radio on"></span><div class="grow"><div class="t1">גל-טק פתרונות בע״מ</div><div class="t2">מספר לקוח ${N('0002')} · 2 חשבונות</div></div></div></div>
       <div class="alert warn"><span class="x">i</span><div>ללקוח יש כבר 2 חשבונות. לחשבון החדש תינתן הסיומת <b class="num">C</b>, למשל ${N('2026-10-0002C')}.</div></div>${fld('שם החשבון', 'גל-טק - מחסן', {})}`
    : `<div class="form">${fld('שם החשבון', 'סטודיו אורן - קומה 1', { wide: true })}${fld('שם הלקוח', 'סטודיו אורן לעיצוב', { wide: true, focus: true })}${fld('מספר לקוח', '0005', { num: true })}${fld('ח.פ. / ע.מ. (לא חובה)', '', { ph: 'לא חובה' })}
       ${fld('כתובת למשלוח החיוב', 'רחוב הדוגמה 12, קומה 1, עיר לדוגמה', { wide: true })}${fld('טלפון', '050-0000001', { num: true })}${fld('דוא״ל', 'studio@example', { num: true, err: 'כתובת דוא״ל לא תקינה' })}</div>`;
  return wizard(5, `<div class="seg2" style="align-self:flex-start"><a class="${existing ? '' : 'on'}" onclick="go('w5')">לקוח חדש</a><a class="${existing ? 'on' : ''}" onclick="go('w5-existing')">לקוח קיים</a></div>${body}`);
}
function w6() {
  const t = TARIFFS[0]; const ch = charge(t, 776.2);
  return wizard(6, `<dl class="kv"><dt>מונים</dt><dd>לוח סטודיו, תאורת לובי</dd><dt>נוסחה</dt><dd>לוח סטודיו + 30% × תאורת לובי</dd><dt>מחיר</dt><dd>${t.name}, ${N(f4(t.price) + ' ₪')} לפני מע״מ, מע״מ ${N('18%')}</dd>
      <dt>תקופה</dt><dd>חודשית, מה-1 בחודש, החל מ-${N('01.10.2026')}</dd><dt>לקוח</dt><dd>סטודיו אורן לעיצוב, מספר ${N('0005')}</dd><dt>שם החשבון</dt><dd>סטודיו אורן - קומה 1</dd></dl>
    <div class="card" style="background:var(--sw-surface-2)"><div class="hd"><b class="h3">לפי הנתונים של ספטמבר 2026</b></div><div class="row"><span style="font-size:22px;font-weight:700">${N(f2(776.2))}</span><span class="mut">קוט״ש</span><span class="sp"></span><span style="font-size:22px;font-weight:700">${ils(ch.tot)}</span></div></div>
    <div class="fld"><label>אחרי השמירה</label><div class="list"><div class="li sel"><span class="radio on"></span><div class="grow t1">שמירה והפקת טיוטה לספטמבר 2026</div></div><div class="li"><span class="radio"></span><div class="grow t1">שמירה בלבד</div></div></div></div>`);
}

/* ------------------------------------------------------------------ bills list */
function billsTable(list, compact) {
  if (PH()) return `<div class="list">${list.map((b) => `<div class="li" onclick="go('${b.st === 'draft' ? 'bill-draft' : b.st === 'void' ? 'bill-void' : 'bill'}')"><div class="grow"><div class="t1">${b.no ? N(b.no) : 'טיוטה'} · ${A[b.a].name}</div><div class="t2">${b.period} · ${N(f2(b.k))} קוט״ש</div></div><div style="text-align:left"><b class="num">${f2(b.tot)} ₪</b><div style="margin-top:4px">${bchip(b.st)}</div></div></div>`).join('')}</div>`;
  return `<div class="card flush scrollx"><table class="t"><thead><tr><th>מספר</th>${compact ? '' : '<th>לקוח</th><th>חשבון</th>'}<th>תקופה</th><th class="num">קוט״ש</th><th class="num">סה״כ לתשלום</th><th>מצב</th>${S.d === 'desktop' ? '<th>הונפק</th>' : ''}</tr></thead><tbody>
    ${list.map((b) => `<tr onclick="go('${b.st === 'draft' ? 'bill-draft' : b.st === 'void' ? 'bill-void' : b.rev ? 'bill-rev' : 'bill'}')" style="cursor:pointer"><td class="b">${b.no ? N(b.no) : '<span class="mut">טיוטה</span>'}</td>${compact ? '' : `<td>${C[A[b.a].c].name}</td><td>${A[b.a].name}</td>`}<td>${b.period}</td><td class="num">${f2(b.k)}</td><td class="num">${f2(b.tot)} ₪</td><td>${bchip(b.st)}</td>${S.d === 'desktop' ? `<td class="num" style="text-align:right">${b.issued || '-'}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}
function billsBody(state) {
  if (!MONEY()) return forbidden();
  if (state === 'empty') return emptyBox('doc', 'אין חיובים עדיין', '', '<button class="btn pri" onclick="go(\'accounts\')">לחשבונות</button>');
  const cnt = (st) => BILLS.filter((b) => b.st === st).length;
  return `<div class="row"><div class="seg2" style="overflow-x:auto;max-width:100%"><a class="on">הכול ${N(BILLS.length)}</a>${['draft', 'issued', 'sent', 'paid', 'void'].map((s) => `<a>${BSTATE[s][0]} ${N(cnt(s))}</a>`).join('')}</div><span class="sp"></span>
      ${PH() ? '' : `<span class="btn">כל החודשים ▾</span><div class="inp" style="width:220px">${ic('search')}<span class="ph">חיפוש מספר או לקוח</span></div>`}</div>
    ${billsTable(BILLS)}`;
}

/* ------------------------------------------------------------------ the bill (A4 preview) */
function paper(o = {}) {
  const a = o.acc || A.a1; const c = C[a.c]; const t = T[a.t];
  const k = o.k || accVal(a, 'last'); const ch = charge(t, k);
  const rows = a.f.map((x) => { const m = M[x.m]; const end = r2(m.val - m.month); const start = r2(end - m.last); const part = r2(termVal(x, 'last'));
    return `<tr><td>${m.name}</td><td class="n">${f2(start)}</td><td class="n">${f2(end)}</td><td class="n">${f2(m.last)}</td><td class="n">${x.pct ? x.pct + '%' : x.s < 0 ? '−' : ''}</td><td class="n">${f2(part)}</td></tr>`; }).join('');
  const no = o.no === undefined ? '2026-09-0001' : o.no;
  return `<div class="paperwrap"><div class="paper">
    ${o.wm ? `<div class="wm ${o.wm === 'בוטל' ? 'void' : ''}">${o.wm}</div>` : ''}
    <div class="ph"><div><h1>חשבון צריכת חשמל ודרישת תשלום</h1><div class="sub">אינו חשבונית מס</div>
        <div style="margin-top:12px"><b>מספר:</b> <span class="n">${no || '-'}</span>${o.rev ? ` <span class="sub">(מחליף את <span class="n">${o.rev}</span>)</span>` : ''}<br><b>תאריך הפקה:</b> <span class="n">${o.date || '02.10.2026'}</span></div></div>
      <div style="display:flex;gap:14px;align-items:flex-start"><div style="text-align:left;direction:rtl"><b>נכסי הדוגמה בע״מ</b><br><span class="sub">ח.פ. <span class="n">510000000</span><br>רחוב הדוגמה 12, עיר לדוגמה<br><span class="n">03-0000000</span> · <span class="n">billing@example.co.il</span></span></div><div class="logo">נד</div></div></div>
    <div class="two"><div class="bx"><b>לכבוד</b><br>${c.name}<br>${c.addr}<br>מספר לקוח: <span class="n">${c.no}</span><br>חשבון: ${a.name}</div>
      <div class="bx"><b>תקופת החיוב</b><br><span class="n">01.09.2026</span> - <span class="n">30.09.2026</span> (30 ימים)<br>תעריף: ${t.name}<br>לתשלום עד: <span class="n">16.10.2026</span></div></div>
    <div class="big"><span>סה״כ לתשלום</span><b class="n">${f2(ch.tot)} ₪</b></div>
    <table><thead><tr><th>מונה</th><th>קריאה בתחילת התקופה</th><th>קריאה בסוף התקופה</th><th>צריכה (קוט״ש)</th><th>חלק</th><th>לחיוב (קוט״ש)</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="note">נוסחת החשבון: ${fText(a.f)}</div>
    <table><thead><tr><th>פירוט</th><th>כמות</th><th>מחיר ליחידה</th><th>סכום (₪)</th></tr></thead><tbody>
      <tr><td>צריכת חשמל</td><td class="n">${f2(k)} קוט״ש</td><td class="n">${f4(exPrice(t))} ₪</td><td class="n">${f2(ch.amt)}</td></tr>
      <tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class="n">${f2(ch.amt)}</td></tr>
      <tr><td>מע״מ 18%</td><td></td><td></td><td class="n">${f2(ch.vat)}</td></tr>
      <tr class="tot"><td>סה״כ לתשלום</td><td></td><td></td><td class="n">${f2(ch.tot)} ₪</td></tr></tbody></table>
    <div class="note">${t.mode === 'inc' ? 'המחיר נקבע כולל מע״מ; המחיר לפני מע״מ מוצג מעוגל ל-4 ספרות. ' : ''}הקריאות הן קריאות מונה מצטברות שנמדדו בפועל. צריכה בתקופה הקודמת: <span class="n">812.40</span> קוט״ש.</div>
    <div class="note"><b>הערות:</b> התשלום בהעברה בנקאית לפי פרטי ההסכם. לשאלות: <span class="n">03-0000000</span>.</div>
    <div class="foot"><span>הופק ב-SmplWise Arx</span><span>עמוד 1 מתוך 1</span><span class="n">a3f9 c21e</span></div>
  </div></div>`;
}
function billPage(kind) {
  if (!MONEY()) return forbidden();
  const map = {
    issued: { no: '2026-09-0001', st: 'issued', acts: `<button class="btn pri" onclick="go('dlg-sent')">סימון כנשלח</button><button class="btn" onclick="go('dlg-paid')">סימון כשולם</button><button class="btn">הורדת PDF</button><button class="btn" onclick="go('dlg-correct')">תיקון</button><button class="btn dng" onclick="go('dlg-void')">ביטול</button>` },
    draft: { no: null, st: 'draft', wm: 'טיוטה', acts: `<button class="btn pri" onclick="go('dlg-issue')">הנפקה</button><button class="btn">חישוב מחדש</button><button class="btn">תצוגת PDF</button><button class="btn dng">מחיקת טיוטה</button>` },
    void: { no: '2026-08-0001', st: 'void', wm: 'בוטל', acts: `<button class="btn">הורדת PDF</button>` },
    rev: { no: '2026-08-0001-2', st: 'paid', rev: '2026-08-0001', acts: `<button class="btn">הורדת PDF</button><button class="btn" onclick="go('dlg-correct')">תיקון</button>` },
    pdferr: { no: '2026-09-0001', st: 'issued', acts: `<button class="btn pri">יצירת PDF מחדש</button>` },
  }[kind];
  const acc = kind === 'draft' ? A.a4 : A.a1;
  const log = kind === 'draft' ? [['01.10.2026 06:00', 'טיוטה נוצרה אוטומטית']]
    : kind === 'void' ? [['02.09.2026 09:12', 'הונפק'], ['04.09.2026 11:30', 'בוטל: קריאת סוף תקופה שגויה'], ['06.09.2026 08:05', 'הוחלף ב-2026-08-0001-2']]
    : kind === 'rev' ? [['06.09.2026 08:05', 'הונפק, מחליף את 2026-08-0001'], ['09.09.2026 10:40', 'סומן כשולם']]
    : [['02.10.2026 09:12', 'הונפק']];
  const side = `<div class="card"><div class="hd"><b class="h3">פרטים</b></div><dl class="kv"><dt>חשבון</dt><dd><a onclick="go('account')" style="color:var(--sw-accent-text);cursor:pointer">${acc.name}</a></dd><dt>לקוח</dt><dd>${C[acc.c].name}</dd><dt>תקופה</dt><dd>${N('01.09.2026')} - ${N('30.09.2026')}</dd><dt>נוצר על ידי</dt><dd>דנה</dd></dl></div>
    <div class="card"><div class="hd"><b class="h3">יומן</b></div><div class="list">${log.map(([d, l]) => `<div class="row"><span class="num mut" style="min-width:110px">${d}</span><span>${l}</span></div>`).join('')}</div></div>`;
  const alerts = kind === 'pdferr' ? `<div class="alert err"><span class="x">!</span><div>יצירת קובץ ה-PDF נכשלה. החיוב נשמר ואפשר לנסות שוב.</div></div>`
    : kind === 'draft' ? `<div class="alert warn"><span class="x">!</span><div><b>לוח מאפייה - פאזה 3</b> לא דיווח בין ${N('28.09 18:40')} ל-${N('29.09 07:10')}. הצריכה בפער נספרה לפי הקריאה הבאה.</div></div>` : '';
  const papr = kind === 'pdferr' ? emptyBox('doc', 'אין תצוגה מקדימה', '', '<button class="btn pri">יצירת PDF מחדש</button>', true)
    : paper({ acc, no: map.no, wm: map.wm, rev: map.rev, k: kind === 'rev' ? 812.40 : kind === 'void' ? 1812.40 : undefined, date: kind === 'void' ? '02.09.2026' : kind === 'rev' ? '06.09.2026' : undefined });
  return `<div class="row"><a class="btn ghost sm" onclick="go('bills')">→ חיובים</a></div>
    <div class="row"><b class="h2 num">${map.no || 'טיוטה'}</b>${bchip(map.st)}${map.rev ? `<span class="mut">מחליף את ${N(map.rev)}</span>` : ''}<span class="sp"></span>${PH() ? '' : map.acts}</div>
    ${PH() ? `<div class="row">${map.acts}</div>` : ''}${alerts}
    <div class="cols side-l"><div style="min-width:0">${papr}</div><div style="display:flex;flex-direction:column;gap:16px">${side}</div></div>`;
}
function billNew() {
  return dlg('הפקת חיוב', `<div class="mut">סטודיו אורן - קומה 1</div>
    <div class="list"><div class="li sel"><span class="radio on"></span><div class="grow"><div class="t1">התקופה האחרונה</div><div class="t2">${N('01.09.2026')} - ${N('30.09.2026')}</div></div></div>
      <div class="li"><span class="radio"></span><div class="grow"><div class="t1">התקופה הנוכחית עד היום</div><div class="t2">${N('01.10.2026')} - ${N('04.10.2026')}</div></div></div>
      <div class="li"><span class="radio"></span><div class="grow"><div class="t1">טווח אחר</div></div></div></div>
    <div class="alert err"><span class="x">!</span><div>כבר קיים חיוב ${N('2026-09-0001')} לתקופה הזו. אפשר לתקן אותו במקום ליצור חדש.</div></div>`,
    `<button class="btn pri" disabled>יצירת טיוטה</button><button class="btn" onclick="go('account')">ביטול</button>`);
}
function dialogs(kind) {
  const base = kind === 'issue' ? billPage('draft') : billPage('issued');
  const d = {
    issue: dlg('הנפקת חיוב', `<div>החיוב יקבל את המספר <b class="num">2026-09-0004</b>. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.</div><dl class="kv"><dt>חשבון</dt><dd>שטחים משותפים</dd><dt>סה״כ לתשלום</dt><dd>${ils(charge(T.t2, accVal(A.a4, 'last')).tot)}</dd></dl>`, `<button class="btn pri" onclick="go('bill')">הנפקה</button><button class="btn" onclick="go('bill-draft')">ביטול</button>`),
    void: dlg('ביטול חיוב 2026-09-0001', `<div>החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.</div><div class="fld"><label>סיבת הביטול</label><div class="inp err" style="min-height:70px;align-items:flex-start;padding-top:8px"><span class="ph">חובה</span></div><div class="msg">צריך לכתוב סיבה</div></div>`, `<button class="btn dng pri" disabled>ביטול החיוב</button><button class="btn" onclick="go('bill')">חזרה</button>`),
    correct: dlg('תיקון חיוב', `<div>תיווצר טיוטה מתוקנת עם המספר <b class="num">2026-09-0001-2</b>. כשהיא תונפק, החיוב ${N('2026-09-0001')} יבוטל אוטומטית.</div>`, `<button class="btn pri" onclick="go('bill-draft')">יצירת טיוטה מתוקנת</button><button class="btn" onclick="go('bill')">ביטול</button>`),
    paid: dlg('סימון כשולם', `<div class="form">${fld('תאריך תשלום', '05.10.2026', { num: true })}${fld('אסמכתה (לא חובה)', '', { ph: 'לא חובה' })}</div>`, `<button class="btn pri" onclick="go('bill')">שמירה</button><button class="btn" onclick="go('bill')">ביטול</button>`),
    sent: dlg('סימון כנשלח', `<div class="form">${fld('תאריך משלוח', '02.10.2026', { num: true })}<div class="fld"><label>אופן משלוח</label><div class="seg2"><a class="on">דוא״ל</a><a>מסירה ידנית</a><a>אחר</a></div></div></div>`, `<button class="btn pri" onclick="go('bill')">שמירה</button><button class="btn" onclick="go('bill')">ביטול</button>`),
  }[kind];
  return { body: base, overlay: d };
}

/* ------------------------------------------------------------------ settings */
function setInner(active) {
  const tabs = [['set-tariffs', 'מחירים ומע״מ'], ['set-business', 'פרטי העסק'], ['set-retention', 'שמירת נתונים']];
  return `<div class="seg2" style="align-self:flex-start">${tabs.map(([id, l]) => `<a class="${id === active ? 'on' : ''}" onclick="go('${id}')">${l}</a>`).join('')}</div>`;
}
function setTariffs() {
  const rows = TARIFFS.map((t) => `<tr onclick="go('set-tariff-edit')" style="cursor:pointer"><td class="b">${t.name}</td><td class="num">${f4(t.price)} ₪</td><td>${t.mode === 'ex' ? 'לפני מע״מ' : 'כולל מע״מ'}</td><td class="num">${f4(exPrice(t))} ₪</td><td class="num">${f4(incPrice(t))} ₪</td><td class="num" style="text-align:right">${t.from}</td><td>${ACCOUNTS.filter((a) => a.t === t.id).length}</td></tr>`).join('');
  return `${setInner('set-tariffs')}
    <div class="cols side-l"><div class="card ${PH() ? '' : 'flush'}"><div class="hd"><b class="h3">תעריפים</b><span class="sp"></span><button class="btn pri sm" onclick="go('set-tariff-edit')">+ תעריף</button></div>
      ${PH() ? `<div class="list">${TARIFFS.map((t) => `<div class="li"><div class="grow"><div class="t1">${t.name}</div><div class="t2">הוזן ${t.mode === 'ex' ? 'לפני' : 'כולל'} מע״מ · מ-${N(t.from)}</div></div><b class="num">${f4(t.price)} ₪</b></div>`).join('')}</div>`
        : `<div class="scrollx"><table class="t"><thead><tr><th>שם</th><th class="num">מחיר שהוזן</th><th>הוזן</th><th class="num">לפני מע״מ</th><th class="num">כולל מע״מ</th><th>בתוקף מ</th><th>חשבונות</th></tr></thead><tbody>${rows}</tbody></table></div>`}</div>
      <div style="display:flex;flex-direction:column;gap:16px"><div class="card"><div class="hd"><b class="h3">שיעור מע״מ</b><span class="sp"></span><button class="btn sm">+ שיעור חדש</button></div>
        <div class="row" style="align-items:baseline"><span style="font-size:28px;font-weight:700">${N('18%')}</span><span class="mut">מ-${N('01.01.2025')}</span></div>
        <div class="ver" style="margin-top:8px"><span class="num">17%</span><span>עד ${N('31.12.2024')}</span></div></div>
        <div class="card"><div class="hd"><b class="h3">ברירת מחדל להזנת מחיר</b></div><div class="list"><div class="li sel"><span class="radio on"></span><div class="grow t1">לפני מע״מ</div></div><div class="li"><span class="radio"></span><div class="grow t1">כולל מע״מ</div></div></div></div></div></div>`;
}
function setTariffEdit() {
  const t = TARIFFS[0];
  return { body: setTariffs(), overlay: dlg('עריכת תעריף', `<div class="form">${fld('שם התעריף', t.name, { wide: true })}${fld('מחיר לקוט״ש', '0.5430', { num: true, suffix: '₪', focus: true })}
      <div class="fld"><label>המחיר שהוזן</label><div class="seg2"><a class="on">לפני מע״מ</a><a>כולל מע״מ</a></div></div>${fld('בתוקף מתאריך', '01.07.2026', { num: true })}</div>
    <div class="card" style="background:var(--sw-surface-2)"><dl class="kv"><dt>לפני מע״מ</dt><dd>${N('0.5430 ₪')}</dd><dt>מע״מ ${N('18%')}</dt><dd>${N('0.0977 ₪')}</dd><dt>כולל מע״מ</dt><dd>${N('0.6407 ₪')}</dd></dl></div>
    <b class="h3">גרסאות קודמות</b><div class="list">${t.prev.map(([d, p]) => `<div class="ver"><span class="num">${f4(p)} ₪</span><span>מ-${N(d)}</span></div>`).join('')}</div>`,
    `<button class="btn pri" onclick="go('set-tariffs')">שמירה</button><button class="btn" onclick="go('set-tariffs')">ביטול</button>`) };
}
function setBusiness() {
  return `${setInner('set-business')}<div class="cols side-l"><div class="card"><div class="form">
      <div class="fld wide"><label>לוגו</label><div class="row"><div class="logo-drop" style="border-style:solid"><div class="paper" style="all:unset"><div style="width:72px;height:72px;border-radius:14px;background:linear-gradient(135deg,#2767ed,#5b8cff);color:#fff;display:grid;place-items:center;font-weight:800;font-size:24px">נד</div></div></div><div><button class="btn">החלפה</button> <button class="btn ghost">הסרה</button><div class="mut" style="margin-top:6px">PNG או JPEG, עד 1MB</div></div></div></div>
      ${fld('שם העסק', 'נכסי הדוגמה בע״מ', { wide: true })}${fld('ח.פ. / ע.מ.', '510000000', { num: true })}${fld('טלפון', '03-0000000', { num: true })}
      ${fld('כתובת', 'רחוב הדוגמה 12, עיר לדוגמה', { wide: true })}${fld('דוא״ל', 'billing@example.co.il', { num: true })}${fld('ימים לתשלום', '14', { num: true, suffix: 'ימים' })}
      ${fld('הערה קבועה בתחתית החיוב', 'התשלום בהעברה בנקאית לפי פרטי ההסכם.', { wide: true })}
      <div class="fld wide"><label>מספור חיובים</label><div class="inp"><span class="num">YYYY-MM-NNNN</span><span style="flex:1"></span><span class="mut">שנה-חודש-מספר לקוח, למשל ${N('2026-12-0001')}</span></div></div></div>
      <div class="row" style="margin-top:14px"><button class="btn pri">שמירה</button></div></div>
    <div class="card"><div class="hd"><b class="h3">תצוגה מקדימה</b></div><div style="overflow:hidden;height:260px;border-radius:8px"><div style="zoom:.42">${paper()}</div></div></div></div>`;
}
function setRetention(err) {
  const row = (l, v, unit, range, size, e) => `<div class="li" style="flex-wrap:wrap"><div class="grow" style="min-width:180px"><div class="t1">${l}</div><div class="t2">${range} · בשימוש ${N(size)}</div></div>
    <div class="fld" style="width:150px"><div class="inp ${e ? 'err' : ''}"><span class="num">${v}</span><span style="flex:1"></span><span class="mut">${unit}</span></div>${e ? `<div class="msg">${e}</div>` : ''}</div></div>`;
  return `${setInner('set-retention')}<div class="card" style="max-width:760px"><div class="list">
      ${row('קריאות גולמיות', err ? '400' : '90', 'ימים', '7 עד 366', '212 MB', err ? 'הערך חייב להיות בין 7 ל-366' : '')}
      ${row('נתוני רבע שעה', '26', 'חודשים', '3 עד 120', '96 MB')}
      ${row('חיובים וקבצי PDF', '7', 'שנים', '1 עד 15', '41 MB')}
      ${row('טיוטות שלא הונפקו', '30', 'ימים', '7 עד 365', '1 MB')}</div>
    <div class="row" style="margin-top:14px"><span class="mut">נתונים בתוך תקופה של טיוטה פתוחה לא נמחקים.</span><span class="sp"></span><button class="btn pri" ${err ? 'disabled' : ''}>שמירה</button></div></div>`;
}
function setPerms() {
  const roles = ['צופה', 'תצוגת קיוסק', 'מפעיל', 'עורך מפות ותצוגות', 'מנהל אתר', 'מנהל מערכת'];
  const rows = [['צפייה במונים ובצריכה', 'energy.view', [0, 0, 1, 0, 1, 1], ''], ['חיובים: סכומים, לקוחות, הפקה וביטול', 'energy.bills', [0, 0, 0, 0, 1, 1], 'רגישה'], ['ניהול מונים, חשבונות, לקוחות ומחירים', 'energy.manage', [0, 0, 0, 0, 1, 1], ''], ['הגדרות שמירת נתונים', 'system.configure', [0, 0, 0, 0, 0, 1], 'קיימת']];
  const tick = (v) => (v ? '<span class="check on"></span>' : '<span class="check"></span>');
  if (PH()) return `<b class="h3">חשמל</b><div class="list">${rows.map(([l, , v, tag]) => `<div class="li" style="flex-direction:column;align-items:stretch"><div class="row"><b>${l}</b>${tag ? `<span class="chip ${tag === 'רגישה' ? 'c-warn' : 'c-mut'} nodot">${tag}</span>` : ''}</div><div class="t2">${roles.filter((_, i) => v[i]).join(', ')}</div></div>`).join('')}</div>`;
  return `<div class="row"><b class="h3">תפקידים והרשאות</b><span class="sp"></span><span class="mut">מוצגות שורות החשמל בלבד</span></div>
    <div class="card flush scrollx"><table class="t perm-matrix"><thead><tr><th>הרשאה</th>${roles.map((r) => `<th class="c">${r}</th>`).join('')}</tr></thead><tbody>
      <tr><td colspan="${roles.length + 1}" style="background:var(--sw-surface-2);font-weight:700">חשמל</td></tr>
      ${rows.map(([l, id, v, tag]) => `<tr><td><b>${l}</b> ${tag ? `<span class="chip ${tag === 'רגישה' ? 'c-warn' : 'c-mut'} nodot">${tag}</span>` : ''}<div class="mut code" style="text-align:right">${id}</div></td>${v.map((x) => `<td class="c">${tick(x)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}

/* ------------------------------------------------------------------ screen registry */
const SCREENS = [
  // group, id, title, builder -> {body, overlay?, o}
  ['תשתיות › חשמל: מונים', 'meters', 'מונים: טבלה עם עץ האזורים', () => ({ body: metersBody('ready'), o: { l2: 'meters' } })],
  ['תשתיות › חשמל: מונים', 'meters-cards', 'מונים: כרטיסים', () => ({ body: metersBody('ready', 'cards'), o: { l2: 'meters' } })],
  ['תשתיות › חשמל: מונים', 'meter', 'כרטיס מונה (מגירה)', () => ({ body: metersBody('ready'), overlay: meterDrawer(), o: { l2: 'meters' } })],
  ['תשתיות › חשמל: מונים', 'meter-add', 'הוספת מונה: חיפוש לפי שם', () => ({ body: metersBody('ready'), overlay: meterAdd(false), o: { l2: 'meters' } })],
  ['תשתיות › חשמל: מונים', 'meter-kw', 'הודעת קילוואט במקום קוט״ש', () => ({ body: metersBody('ready'), overlay: meterAdd(true), o: { l2: 'meters' } })],
  ['תשתיות › חשמל: מונים', 'meters-loading', 'מונים: טעינה', () => ({ body: metersBody('loading'), o: { l2: 'meters' } })],
  ['תשתיות › חשמל: מונים', 'meters-empty', 'מונים: מצב ריק', () => ({ body: metersBody('empty'), o: { l2: 'meters' } })],
  ['תשתיות › חשמל: מונים', 'meters-error', 'מונים: שגיאת טעינה', () => ({ body: metersBody('error'), o: { l2: 'meters' } })],
  ['חשבונות', 'accounts', 'רשימת חשבונות: טבלה', () => ({ body: accountsBody('ready'), o: { l2: 'accounts' } })],
  ['חשבונות', 'accounts-cards', 'רשימת חשבונות: כרטיסים', () => ({ body: accountsBody('ready', 'cards'), o: { l2: 'accounts' } })],
  ['חשבונות', 'accounts-empty', 'חשבונות: מצב ריק', () => ({ body: accountsBody('empty'), o: { l2: 'accounts' } })],
  ['חשבונות', 'accounts-error', 'חשבונות: שגיאת טעינה', () => ({ body: accountsBody('error'), o: { l2: 'accounts' } })],
  ['חשבונות', 'account', 'עמוד חשבון: מצב הצריכה', () => ({ body: accountStatus(false), o: { l2: 'accounts' } })],
  ['חשבונות', 'account-stale', 'עמוד חשבון: מונה לא מדווח', () => ({ body: accountStatus(true), o: { l2: 'accounts' } })],
  ['חשבונות', 'account-history', 'עמוד חשבון: היסטוריה', () => ({ body: accountHistory(), o: { l2: 'accounts' } })],
  ['חשבונות', 'account-bills', 'עמוד חשבון: חיובים', () => ({ body: accountBills(), o: { l2: 'accounts' } })],
  ['חשבונות', 'bill-new', 'הפקת חיוב: בחירת תקופה וחפיפה', () => ({ body: accountStatus(false), overlay: billNew(), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w1', '1. בחירת מונים לפי שם', () => ({ body: w1(false), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w1-kw', '1. בחירת מונים: חיישן קילוואט נדחה', () => ({ body: w1(true), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w2', '2. עורך הנוסחה (בונה)', () => ({ body: w2('ok'), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w2-mainsub', '2. תבנית ראשי פחות משנה', () => ({ body: w2('mainsub'), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w2-text', '2. עורך הנוסחה (טקסט)', () => ({ body: w2('text'), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w2-neg', '2. שגיאה: תוצאה שלילית', () => ({ body: w2('neg'), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w2-paren', '2. שגיאה: סוגריים', () => ({ body: w2('paren'), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w3', '3. מחיר ומע״מ', () => ({ body: w3(), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w4', '4. תקופת חיוב', () => ({ body: w4(), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w5', '5. כרטיס לקוח חדש (עם שגיאת שדה)', () => ({ body: w5(false), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w5-existing', '5. לקוח קיים עם כמה חשבונות', () => ({ body: w5(true), o: { l2: 'accounts' } })],
  ['אשף חשבון חדש', 'w6', '6. סיכום והפקה', () => ({ body: w6(), o: { l2: 'accounts' } })],
  ['חיובים', 'bills', 'רשימת חיובים עם מצבים', () => ({ body: billsBody('ready'), o: { l2: 'bills' } })],
  ['חיובים', 'bills-empty', 'חיובים: מצב ריק', () => ({ body: billsBody('empty'), o: { l2: 'bills' } })],
  ['חיובים', 'bill', 'חיוב שהונפק (A4)', () => ({ body: billPage('issued'), o: { l2: 'bills' } })],
  ['חיובים', 'bill-draft', 'טיוטה (A4 עם סימן מים)', () => ({ body: billPage('draft'), o: { l2: 'bills' } })],
  ['חיובים', 'bill-void', 'חיוב שבוטל', () => ({ body: billPage('void'), o: { l2: 'bills' } })],
  ['חיובים', 'bill-rev', 'חיוב מתוקן (סיומת גרסה)', () => ({ body: billPage('rev'), o: { l2: 'bills' } })],
  ['חיובים', 'bill-pdferr', 'שגיאה: יצירת PDF נכשלה', () => ({ body: billPage('pdferr'), o: { l2: 'bills' } })],
  ['חיובים', 'dlg-issue', 'אישור הנפקה', () => ({ ...dialogs('issue'), o: { l2: 'bills' } })],
  ['חיובים', 'dlg-void', 'ביטול עם סיבה (שגיאת חובה)', () => ({ ...dialogs('void'), o: { l2: 'bills' } })],
  ['חיובים', 'dlg-correct', 'תיקון (גרסה 2)', () => ({ ...dialogs('correct'), o: { l2: 'bills' } })],
  ['חיובים', 'dlg-sent', 'סימון כנשלח', () => ({ ...dialogs('sent'), o: { l2: 'bills' } })],
  ['חיובים', 'dlg-paid', 'סימון כשולם', () => ({ ...dialogs('paid'), o: { l2: 'bills' } })],
  ['לקוחות', 'customers', 'רשימת לקוחות', () => ({ body: customersBody(), o: { l2: 'customers' } })],
  ['לקוחות', 'customer', 'כרטיס לקוח', () => ({ body: customersBody(), overlay: customerDrawer(), o: { l2: 'customers' } })],
  ['הגדרות › תשתיות › חשמל', 'set-tariffs', 'מחירים ושיעור מע״מ', () => ({ body: setTariffs(), o: { area: 'system', l1: 'infra' } })],
  ['הגדרות › תשתיות › חשמל', 'set-tariff-edit', 'עריכת תעריף (לפני/כולל מע״מ)', () => ({ ...setTariffEdit(), o: { area: 'system', l1: 'infra' } })],
  ['הגדרות › תשתיות › חשמל', 'set-business', 'פרטי העסק, לוגו ומספור', () => ({ body: setBusiness(), o: { area: 'system', l1: 'infra' } })],
  ['הגדרות › תשתיות › חשמל', 'set-retention', 'שמירת נתונים', () => ({ body: setRetention(false), o: { area: 'system', l1: 'infra' } })],
  ['הגדרות › תשתיות › חשמל', 'set-retention-err', 'שמירת נתונים: ערך מחוץ לטווח', () => ({ body: setRetention(true), o: { area: 'system', l1: 'infra' } })],
  ['הגדרות › משתמשים והרשאות', 'set-perms', 'שורות ההרשאות של חשמל', () => ({ body: setPerms(), o: { area: 'system', l1: 'access' } })],
];
const BY = Object.fromEntries(SCREENS.map((x) => [x[1], x]));

function screenHtml(id) {
  const sc = BY[id]; const r = sc[3]();
  return shell(r.body, { ...r.o, overlay: r.overlay });
}

/* ------------------------------------------------------------------ gallery chrome */
function bar() {
  const seg = (key, opts) => `<span class="seg">${opts.map(([v, l]) => `<button class="${S[key] === v ? 'on' : ''}" onclick="S.${key}='${v}';render()">${l}</button>`).join('')}</span>`;
  const groups = [...new Set(SCREENS.map((x) => x[0]))];
  const sel = `<select onchange="go(this.value)"><option value="index" ${S.s === 'index' ? 'selected' : ''}>תוכן הגלריה</option><option value="matrix" ${S.s === 'matrix' ? 'selected' : ''}>מטריצת סקינים</option>
    ${groups.map((g) => `<optgroup label="${g}">${SCREENS.filter((x) => x[0] === g).map((x) => `<option value="${x[1]}" ${S.s === x[1] ? 'selected' : ''}>${x[2]}</option>`).join('')}</optgroup>`).join('')}</select>`;
  return `<b>חשמל: מונים וחיובים · מוקאפ</b>${sel}
    <label>מכשיר ${seg('d', [['desktop', '1440'], ['tablet', '820'], ['phone', '390']])}</label>
    <label>ערכה ${seg('t', [['light', 'בהירה'], ['dark', 'כהה']])}</label>
    <label>סקין ${seg('k', [['classic', 'classic'], ['domus', 'domus'], ['tesla', 'tesla'], ['bubble', 'bubble']])}</label>
    <label>משתמש ${seg('p', [['full', 'עם הרשאת חיובים'], ['view', 'צפייה בלבד']])}</label>`;
}
function indexHtml() {
  const groups = [...new Set(SCREENS.map((x) => x[0]))];
  return `<div class="gal-index"><h1 style="margin:0 0 6px;font-size:20px">חשמל: מונים וחיובים · גלריית מוקאפים לאישור</h1>
    <div>כל המסכים משתמשים בנתונים מומצאים. בחרו מסך, מכשיר, ערכה, סקין וסוג משתמש בפס העליון. הקישור בשורת הכתובת משחזר את התצוגה.</div>
    ${groups.map((g) => `<h2>${g}</h2><ul>${SCREENS.filter((x) => x[0] === g).map((x) => `<li><a onclick="go('${x[1]}')">${x[2]}</a></li>`).join('')}</ul>`).join('')}
    <h2>סקינים</h2><ul><li><a onclick="go('matrix')">מטריצת סקינים: ארבעה סקינים × בהיר/כהה למסכים הראשיים</a></li></ul></div>`;
}
function matrixHtml() {
  const opts = [['meters', 'מונים'], ['account', 'עמוד חשבון'], ['bills', 'רשימת חיובים'], ['w2', 'עורך הנוסחה'], ['bill', 'חיוב A4'], ['set-tariffs', 'הגדרות מחיר']];
  const pick = `<div style="max-width:1480px;width:100%"><span class="seg" style="display:inline-flex;gap:0;border:1px solid #c4cad6;border-radius:6px;overflow:hidden;background:#fff">${opts.map(([v, l]) => `<button style="border:0;padding:4px 10px;${S.ms === v ? 'background:#2767ed;color:#fff' : 'background:#fff'}" onclick="S.ms='${v}';render()">${l}</button>`).join('')}</span></div>`;
  const keepD = S.d; S.d = 'desktop';
  const html = BY[S.ms] ? screenHtml(S.ms) : '';
  S.d = keepD;
  const cells = ['classic', 'domus', 'tesla', 'bubble'].flatMap((k) => ['light', 'dark'].map((t) => `<div class="cell"><h4>${k} · ${t === 'light' ? 'בהיר' : 'כהה'}</h4><div class="mini" data-skin="${k}" data-theme="${t}" data-radius="pill" data-perf="full" dir="rtl">${html}</div></div>`)).join('');
  return `${pick}<div class="matrix">${cells}</div>`;
}
function render() {
  writeHash();
  document.getElementById('bar').innerHTML = bar();
  document.body.dataset.gal = S.t;
  const st = document.getElementById('stage');
  if (S.s === 'index' || !BY[S.s] && S.s !== 'matrix') { st.innerHTML = indexHtml(); return; }
  if (S.s === 'matrix') { st.innerHTML = matrixHtml(); return; }
  const sc = BY[S.s];
  st.innerHTML = `<div id="cap">${sc[0]} · <b>${sc[2]}</b></div><div id="frame" class="d-${S.d}" data-skin="${S.k}" data-theme="${S.t}" data-radius="pill" data-perf="full" dir="rtl">${screenHtml(S.s)}</div>`;
}
window.S = S; window.render = render; window.SCREENS = SCREENS;
readHash();
window.addEventListener('hashchange', () => { readHash(); render(); });
render();
