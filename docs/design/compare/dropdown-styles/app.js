/* Dropdown style gallery (0.1.157 pre-work). Plain JS, no build, no network. Everything is rendered from the data below. */
(function () {
  'use strict';

  // ---------- data: the six styles ----------
  const STYLES = [
    { id: 'pill', he: 'כמוסה', en: 'Pill chip', desc: 'כמוסה מלאה ללא מסגרת, כמו הפקד הנוכחי ב-Bubble.' },
    { id: 'field', he: 'שדה מעוגל', en: 'Rounded field', desc: 'שדה עם מסגרת, כמו הפקד הנוכחי ב-Classic.' },
    { id: 'underline', he: 'קו תחתון + חץ', en: 'Underline + chevron', desc: 'הלשונית שנשארה לשונית: טקסט בצבע ההדגשה וקו תחתון.' },
    { id: 'text', he: 'טקסט + חץ', en: 'Text + chevron', desc: 'כותרת העמוד היא התפריט; חץ קטן בעיגול.' },
    { id: 'prefix', he: 'קידומת קבוצה', en: 'Group prefix', desc: '"אבטחה: חקירה" - שם הקבוצה לפני הערך, על כמוסה רכה.' },
    { id: 'tonal', he: 'גוון הדגשה', en: 'Tonal', desc: 'מקטע נבחר של פס כמוסות, עומד לבדו: מילוי הדגשה רך.' },
  ];
  const SKINS = [
    { id: 'classic', he: 'קלאסי' }, { id: 'domus', he: 'דומוס' }, { id: 'tesla', he: 'טסלה' }, { id: 'bubble', he: 'באבל' },
  ];
  // the ten palettes of docs/design/palettes (core colours only; the mapping to --sw-* tokens approximates design/palette.ts)
  const PALETTES = [
    { id: 'calm-blue', he: 'כחול שקט', light: { bg: '#ecf0f9', surface: '#dfe3eb', surface2: '#d2d6df', el: '#f5f8fd', text: '#1d222c', muted: '#434852', border: 'rgba(40, 46, 58, 0.16)', accent: '#2767ed', accentC: '#ffffff', accentT: '#1d4fc4', tint: '#f8fafd', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#1e232d', surface: '#343944', surface2: '#424854', el: '#2c2f35', text: '#f9fafd', muted: '#d2d6de', border: 'rgba(255, 255, 255, 0.14)', accent: '#7ea2f6', accentC: '#0b152d', accentT: '#c9d6ff', tint: '#282b33', danger: '#ff645f', warning: '#fda856' } },
    { id: 'purple-rose', he: 'סגול ורד', light: { bg: '#f4edf8', surface: '#e7e0ea', surface2: '#dad3de', el: '#faf6fc', text: '#271d2b', muted: '#4d4451', border: 'rgba(52, 41, 57, 0.16)', accent: '#953490', accentC: '#ffffff', accentT: '#812c7d', tint: '#fcf9fd', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#281e2d', surface: '#3f3544', surface2: '#4f4254', el: '#332c35', text: '#fcf9fd', muted: '#dad2de', border: 'rgba(255, 255, 255, 0.14)', accent: '#d98dc9', accentC: '#230c1f', accentT: '#e9b9dd', tint: '#2f2833', danger: '#ff645f', warning: '#fda856' } },
    { id: 'teal-green', he: 'טורקיז', light: { bg: '#e7f3f2', surface: '#dae6e5', surface2: '#ccd9d8', el: '#f3f9f9', text: '#152525', muted: '#3c4b4b', border: 'rgba(31, 50, 49, 0.16)', accent: '#02736e', accentC: '#ffffff', accentT: '#03635f', tint: '#f7fbfb', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#162626', surface: '#2c3d3d', surface2: '#394c4c', el: '#283131', text: '#f7fbfb', muted: '#ccd9d8', border: 'rgba(255, 255, 255, 0.14)', accent: '#4dc8ba', accentC: '#011b18', accentT: '#99d9d0', tint: '#232e2e', danger: '#ff645f', warning: '#fda856' } },
    { id: 'amber-sand', he: 'חול וענבר', light: { bg: '#f6efe6', surface: '#e9e2d9', surface2: '#dcd5cb', el: '#fbf7f2', text: '#292014', muted: '#4f463a', border: 'rgba(54, 44, 30, 0.16)', accent: '#9f5102', accentC: '#ffffff', accentT: '#834101', tint: '#fcfaf6', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#282219', surface: '#3f382f', surface2: '#4e463c', el: '#322e29', text: '#fbfaf7', muted: '#dad5ce', border: 'rgba(255, 255, 255, 0.14)', accent: '#eca760', accentC: '#231100', accentT: '#ecc299', tint: '#2f2b24', danger: '#ff645f', warning: '#fda856' } },
    { id: 'graphite', he: 'גרפיט', light: { bg: '#eef0f3', surface: '#e1e3e5', surface2: '#d4d6d9', el: '#f7f8f9', text: '#1f2225', muted: '#45484b', border: 'rgba(43, 46, 50, 0.16)', accent: '#334f6d', accentC: '#ffffff', accentT: '#3e5872', tint: '#f9fafb', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#212326', surface: '#37393c', surface2: '#45484b', el: '#2e2f31', text: '#f9fafb', muted: '#d4d6d8', border: 'rgba(255, 255, 255, 0.14)', accent: '#95b5d6', accentC: '#03172c', accentT: '#b9cde2', tint: '#2a2b2d', danger: '#ff645f', warning: '#fda856' } },
    { id: 'deep-ocean', he: 'אוקיינוס עמוק', light: { bg: '#e6f2fb', surface: '#d9e5ee', surface2: '#cbd8e2', el: '#f2f9fe', text: '#122430', muted: '#3a4a56', border: 'rgba(28, 48, 62, 0.16)', accent: '#036884', accentC: '#ffffff', accentT: '#045e78', tint: '#f6fbff', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#122532', surface: '#283c4a', surface2: '#344b5b', el: '#263139', text: '#f6fbfe', muted: '#cad8e3', border: 'rgba(255, 255, 255, 0.14)', accent: '#4dc3dd', accentC: '#011a20', accentT: '#99d6e6', tint: '#202d36', danger: '#ff645f', warning: '#fda856' } },
    { id: 'forest', he: 'יער', light: { bg: '#ebf2eb', surface: '#dee5de', surface2: '#d1d8d1', el: '#f5f9f5', text: '#1b241b', muted: '#414b41', border: 'rgba(38, 49, 38, 0.16)', accent: '#206b38', accentC: '#ffffff', accentT: '#246436', tint: '#f8fbf8', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#1d251d', surface: '#333c33', surface2: '#414b40', el: '#2b312b', text: '#f8fbf8', muted: '#d1d8d1', border: 'rgba(255, 255, 255, 0.14)', accent: '#7cca7f', accentC: '#051c07', accentT: '#abd9ac', tint: '#272d27', danger: '#ff645f', warning: '#fda856' } },
    { id: 'sunset', he: 'שקיעה', light: { bg: '#f9edeb', surface: '#ece0dd', surface2: '#e0d2d0', el: '#fdf6f4', text: '#2d1d1a', muted: '#534341', border: 'rgba(59, 41, 37, 0.16)', accent: '#b93917', accentC: '#ffffff', accentT: '#972706', tint: '#fef9f8', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#2e1e1c', surface: '#453532', surface2: '#56423f', el: '#362c2b', text: '#fdf9f8', muted: '#e0d2d0', border: 'rgba(255, 255, 255, 0.14)', accent: '#f88d67', accentC: '#280d04', accentT: '#fbb9a1', tint: '#342826', danger: '#ff645f', warning: '#fda856' } },
    { id: 'rose-quartz', he: 'קוורץ ורוד', light: { bg: '#f8edf0', surface: '#eae0e2', surface2: '#ded2d5', el: '#fcf6f7', text: '#2b1d21', muted: '#514447', border: 'rgba(56, 41, 45, 0.16)', accent: '#9c3e60', accentC: '#ffffff', accentT: '#873453', tint: '#fdf9fa', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#2b1f22', surface: '#423539', surface2: '#524347', el: '#342d2f', text: '#fdf9fa', muted: '#ddd3d5', border: 'rgba(255, 255, 255, 0.14)', accent: '#e799b7', accentC: '#270b17', accentT: '#ecbbcc', tint: '#32292b', danger: '#ff645f', warning: '#fda856' } },
    { id: 'high-contrast', he: 'ניגודיות גבוהה', light: { bg: '#ffffff', surface: '#f2f2f2', surface2: '#e2e2e2', el: '#ffffff', text: '#000000', muted: '#1f1f1f', border: 'rgba(0, 0, 0, 0.7)', accent: '#0039b8', accentC: '#ffffff', accentT: '#0039b8', tint: '#ffffff', danger: '#c92f33', warning: '#ac6304' }, dark: { bg: '#000000', surface: '#141414', surface2: '#262626', el: '#0a0a0a', text: '#ffffff', muted: '#e6e6e6', border: 'rgba(255, 255, 255, 0.7)', accent: '#9cc0ff', accentC: '#000000', accentT: '#9cc0ff', tint: '#000000', danger: '#ff645f', warning: '#fda856' } },
  ];

  // ---------- data: real tab groups (shell/nav.ts) ----------
  const G = {
    sections: { label: 'מדור', group: 'אבטחה', items: [{ id: 'live', label: 'לייב' }, { id: 'invest', label: 'חקירה', alert: 'warn' }, { id: 'alarm', label: 'אזעקה', alert: true }] },
    live: { label: 'עמוד', group: 'לייב', items: [{ id: 'overview', label: 'תמונת מצב' }, { id: 'all', label: 'כל המצלמות', count: 24 }, { id: 'views', label: 'תצוגות שמורות', count: 3 }] },
    invest: {
      label: 'עמוד', group: 'חקירה', items: [
        { id: 'events', label: 'מרכז אירועים', count: 12 }, { id: 'rec', label: 'הקלטות' }, { id: 'sync', label: 'ניגון מסונכרן' }, { id: 'hmap', label: 'מפה היסטורית' },
        { id: 'review', label: 'Review' }, { id: 'search', label: 'חיפוש' }, { id: 'cases', label: 'תיקים', count: 4 }, { id: 'rules', label: 'חוקים והתראות', count: 2, alert: 'warn' },
        { id: 'export', label: 'ייצוא' }, { id: 'health', label: 'בריאות מצלמות', alert: true },
      ],
    },
    settings: {
      label: 'הגדרות', group: 'הגדרות', items: [
        { id: 'general', label: 'כללי' }, { id: 'notif', label: 'התראות' }, { id: 'users', label: 'משתמשים והרשאות', count: 7 }, { id: 'security', label: 'אבטחה' },
        { id: 'audit', label: 'אודיט' }, { id: 'storage', label: 'אחסון', alert: 'warn' }, { id: 'wizard', label: 'אשף התקנה' }, { id: 'conn', label: 'חיבורים', count: 3 },
        { id: 'catalog', label: 'קטלוג התקנים', count: 148 }, { id: 'sched', label: 'תזמונים' }, { id: 'autom', label: 'אוטומציות' }, { id: 'media', label: 'מולטימדיה' }, { id: 'screens', label: 'כל המסכים' },
      ],
    },
    secsub: { label: 'הגדרות אבטחה', group: 'אבטחה', items: [{ id: 'alarm', label: 'אזעקה' }, { id: 'alarmmgmt', label: 'ניהול אזעקה' }, { id: 'nvr', label: 'NVR', alert: true }, { id: 'cams', label: 'מצלמות', count: 24 }] },
    // the area list of a floor, grouped by floor (the floors/areas tree in list form)
    areas: { label: 'אזור', group: 'קומה 1', items: [{ id: 'f1', label: 'סלון', count: 12, group: 'קומה 1' }, { id: 'f2', label: 'מטבח', count: 8, group: 'קומה 1' }, { id: 'f3', label: 'כניסה', count: 5, group: 'קומה 1', alert: 'warn' }, { id: 'f4', label: 'חדר שינה הורים', count: 9, group: 'קומה 2' }, { id: 'f5', label: 'חדר ילדים', count: 6, group: 'קומה 2' }, { id: 'f6', label: 'מרפסת', count: 3, group: 'גג' }] },
  };

  const ICONS = {
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 10l5-2v8l-5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    media: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    tree: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };

  // ---------- state ----------
  const state = { style: 'pill', skin: 'bubble', theme: 'light', palette: 'default', radius: 'pill', touch: '44', perf: 'full', popup: 'sheet', cmpOpen: 'short' };
  (function readHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    for (const k of Object.keys(state)) if (h.get(k)) state[k] = h.get(k);
  })();
  function writeHash() {
    const p = new URLSearchParams();
    for (const k of Object.keys(state)) p.set(k, state[k]);
    history.replaceState(null, '', '#' + p.toString());
  }

  // ---------- rendering helpers ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function hiddenAlert(items, value) {
    let warn = false;
    for (const it of items) {
      if (it.id === value || !it.alert) continue;
      if (it.alert === true) return 'alert';
      warn = true;
    }
    return warn ? 'warn' : false;
  }
  function dotHtml(alert) { return alert ? `<span class="dot ${alert === 'warn' ? 'warn' : ''}"></span>` : ''; }

  /** One dropdown. o: { style, g (group data), value, open, inline, focus, cursor, block, prefix, search, icon, mode:'pop'|'none' } */
  function dd(o) {
    const style = o.style || state.style;
    const g = o.g;
    const value = o.value || g.items[0].id;
    const sel = g.items.find((i) => i.id === value) || g.items[0];
    const alert = hiddenAlert(g.items, value);
    const showPrefix = style === 'prefix' || o.prefix;
    const cls = ['dd', o.open ? 'open' : '', o.inline ? 'inline' : '', o.focus ? 'focus' : '', o.block ? 'block' : ''].filter(Boolean).join(' ');
    const chip = `<button type="button" class="chip" aria-haspopup="listbox" aria-expanded="${o.open ? 'true' : 'false'}" aria-label="${esc(g.label)}: ${esc(sel.label)}${sel.count !== undefined ? ` (${sel.count})` : ''}${alert ? ', יש התראות באפשרויות אחרות' : ''}">
      ${o.icon ? `<span class="ico">${ICONS[o.icon]}</span>` : ''}
      ${showPrefix ? `<span class="pre">${esc(g.group)}${style === 'prefix' ? '' : ':'}</span>` : ''}
      <span class="txt">${esc(sel.label)}</span>${sel.count !== undefined ? `<span class="n">(${sel.count})</span>` : ''}
      <span class="chev" aria-hidden="true">${ICONS.chev}</span>${dotHtml(alert)}</button>`;
    const list = o.mode === 'none' ? '' : `<div class="pop" role="listbox" aria-label="${esc(g.label)}" data-search="${o.search || g.items.length >= 8 ? '1' : ''}">${listInner(g, value, o)}</div>`;
    return `<span class="${cls}" data-style="${style}">${chip}${list}</span>`;
  }
  function listInner(g, value, o) {
    const search = o.search || g.items.length >= 8 ? `<label class="search">${ICONS.search}<input type="search" placeholder="חיפוש" aria-label="חיפוש ב${esc(g.label)}" value="${esc(o.typed || '')}"></label>` : '';
    let last;
    const typed = (o.typed || '').trim();
    const opts = g.items.map((it, i) => {
      let grp = '';
      if (it.group && it.group !== last) grp = `<div class="grp" role="presentation">${esc(it.group)}</div>`;
      last = it.group;
      const hide = typed && !it.label.includes(typed) ? ' hide' : '';
      return `${grp}<div class="opt${hide}" role="option" aria-selected="${it.id === value}" ${o.cursor === i ? 'data-active' : ''} data-label="${esc(it.label)}">
        <span class="lbl">${esc(it.label)}</span>${it.count !== undefined ? `<span class="n">(${it.count})</span>` : ''}${dotHtml(it.alert)}</div>`;
    }).join('');
    return search + opts;
  }
  /** The phone sheet for a group (open), following the popup dial. */
  function sheet(g, value, o) {
    o = o || {};
    return `<div class="scrim"></div><div class="sheet ${state.popup === 'centred' ? 'centred' : ''}" role="listbox" aria-label="${esc(g.label)}"><div class="grab"></div><div class="ttl">${esc(g.label)}</div><div class="list">${listInner(g, value, o)}</div></div>`;
  }
  const alarmPin = () => `<a class="alarmpin" href="#" aria-label="אזעקה" onclick="return false">${ICONS.bell}</a>`;
  const corner = (small) => `<div class="corner"><span class="pillbtn">${ICONS.search}</span>${small ? '' : `<span class="pillbtn">${ICONS.user}</span>`}</div>`;

  /** The two-chip pair row (security: sections + pages + alarm pin). */
  function pairRow(style, o) {
    o = o || {};
    return `<div class="tabpair row-pair">${dd({ style, g: G.sections, value: 'invest', block: true, mode: 'none' })}${dd({ style, g: o.second || G.invest, value: o.secondValue || 'rec', block: true, open: o.open, mode: 'none' })}${alarmPin()}${corner(true)}</div>`;
  }

  // ---------- chrome pieces ----------
  function rail(active) {
    const items = [['home', ICONS.home], ['cam', ICONS.cam], ['map', ICONS.map], ['media', ICONS.media], ['gear', ICONS.gear]];
    return `<nav class="rail"><div class="logo"></div>${items.map(([k, svg]) => `<span class="ic ${k === active ? 'on' : ''}">${svg}</span>`).join('')}</nav>`;
  }
  function tree() {
    return `<aside class="tree"><h3>קומות ואזורים</h3>
      <div class="fl">קומה 1<span class="chev">${ICONS.chev}</span></div>
      <div class="ar on">סלון<span class="n">12</span></div><div class="ar">מטבח<span class="n">8</span></div><div class="ar">כניסה<span class="n">5</span></div>
      <div class="fl">קומה 2<span class="chev">${ICONS.chev}</span></div>
      <div class="ar">חדר שינה הורים<span class="n">9</span></div><div class="ar">חדר ילדים<span class="n">6</span></div>
      <div class="fl closed">גג<span class="chev">${ICONS.chev}</span></div></aside>`;
  }
  function recTable(rows) {
    const data = [
      ['מצלמה 01 - כניסה ראשית', '09:12', '00:04:10', 'rec', 'תנועה'], ['מצלמה 04 - חניה', '09:08', '00:12:32', 'rec', 'רציף'], ['מצלמה 07 - לובי', '08:55', '00:01:48', 'alarm', 'אזעקה'],
      ['מצלמה 02 - גדר מזרח', '08:40', '00:06:05', 'rec', 'קו וירטואלי'], ['מצלמה 11 - מחסן', '08:31', '00:03:21', 'rec', 'תנועה'], ['מצלמה 09 - גג', '08:12', '00:09:47', 'rec', 'רציף'],
    ].slice(0, rows || 6);
    return `<div class="card"><table class="tbl"><thead><tr><th>מצלמה</th><th>התחלה</th><th>משך</th><th>סוג</th><th>מצב</th></tr></thead><tbody>${data.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[4]}</td><td><span class="st ${r[3]}">${r[3] === 'alarm' ? 'אזעקה' : 'מוקלט'}</span></td></tr>`).join('')}</tbody></table></div>`;
  }
  function kpis() {
    return `<div class="kpis"><div class="card kpi"><b>24</b><span>מצלמות</span></div><div class="card kpi"><b>3</b><span>אירועים פתוחים</span></div><div class="card kpi"><b>96%</b><span>כיסוי הקלטה</span></div><div class="card kpi"><b>1</b><span>מצלמה לא מקוונת</span></div></div>`;
  }
  function phoneList(n) {
    const rows = [['מצלמה 01 - כניסה ראשית', '09:12 · 4 דק׳'], ['מצלמה 04 - חניה', '09:08 · 12 דק׳'], ['מצלמה 07 - לובי', '08:55 · אזעקה'], ['מצלמה 02 - גדר מזרח', '08:40 · 6 דק׳'], ['מצלמה 11 - מחסן', '08:31 · 3 דק׳'], ['מצלמה 09 - גג', '08:12 · 10 דק׳'], ['מצלמה 05 - מעלית', '07:58 · 2 דק׳']].slice(0, n || 7);
    return `<div class="card listv">${rows.map((r) => `<div class="li"><span class="thumb"></span><span class="t"><b>${r[0]}</b><span>${r[1]}</span></span>${ICONS.chev.replace('<svg', '<svg style="width:14px;height:14px;transform:rotate(90deg);color:var(--sw-text-3)"')}</div>`).join('')}</div>`;
  }
  function dock(active) {
    const items = [['home', ICONS.home], ['cam', ICONS.cam], ['map', ICONS.map], ['media', ICONS.media], ['gear', ICONS.gear]];
    return `<nav class="dock">${items.map(([k, svg]) => `<span class="ic ${k === active ? 'on' : ''}">${svg}</span>`).join('')}</nav>`;
  }

  // ---------- frames ----------
  function desktopSecurity(style) {
    return `<div class="frame desktop">${rail('cam')}${tree()}<div class="main">${corner()}
      <div class="head"><h1>אבטחה</h1><span class="sep"></span>${dd({ style, g: G.sections, value: 'invest' })}${dd({ style, g: G.invest, value: 'rec', open: true, cursor: 1 })}${alarmPin()}</div>
      <div class="content">${kpis()}${recTable(6)}</div><span class="cap">1440 · אבטחה › חקירה › הקלטות · הרשימה פתוחה (10 פריטים, חיפוש), עץ הקומות נשאר</span></div></div>`;
  }
  function desktopSettings(style) {
    return `<div class="frame desktop">${rail('gear')}${tree()}<div class="main">${corner()}
      <div class="head"><h1>הגדרות</h1><span class="sep"></span>${dd({ style, g: G.settings, value: 'security', open: true, cursor: 5, typed: '' })}${dd({ style, g: G.secsub, value: 'nvr' })}</div>
      <div class="content"><div class="card"><table class="tbl"><thead><tr><th>מקליט</th><th>כתובת</th><th>ערוצים</th><th>מצב</th></tr></thead><tbody>
        <tr><td>NVR ראשי</td><td>••••••</td><td>16</td><td><span class="st rec">מחובר</span></td></tr><tr><td>NVR חניה</td><td>••••••</td><td>8</td><td><span class="st alarm">ללא תגובה</span></td></tr></tbody></table></div></div>
      <span class="cap">1440 · הגדרות (13 פריטים עם חיפוש) › אבטחה › NVR · מקלדת: הסמן על "אחסון", הנבחר "אבטחה"</span></div></div>`;
  }
  function tabletFrame(style) {
    return `<div class="frame tablet">${rail('cam')}<div class="main">${corner()}
      <div class="head"><span class="treebtn" aria-label="קומות ואזורים">${ICONS.tree}</span><h1>אבטחה</h1><span class="sep"></span>${dd({ style, g: G.sections, value: 'live', open: true, cursor: 1 })}${dd({ style, g: G.live, value: 'all' })}${alarmPin()}</div>
      <div class="content">${recTable(5)}</div><span class="cap">820 · העץ במגירה (הכפתור בתחילת השורה) · נקודת התראה נסתרת על "לייב"</span></div></div>`;
  }
  function phoneClosed(style) {
    return `<div class="frame phone">${pairRow(style)}<div class="ph-title">הקלטות</div><div class="ph-body">${phoneList(6)}</div>${dock('cam')}<span class="cap">390 · הזוג סגור, שמורים 84px לפינה הצפה</span></div>`;
  }
  function phoneSheet(style) {
    return `<div class="frame phone">${pairRow(style, { open: true })}<div class="ph-title">הקלטות</div><div class="ph-body">${phoneList(6)}</div>${dock('cam')}${sheet(G.invest, 'rec', { cursor: 2 })}<span class="cap">390 · הרשימה הארוכה כגיליון תחתון עם חיפוש</span></div>`;
  }
  function phoneSettings(style) {
    return `<div class="frame phone"><div class="tabpair">${dd({ style, g: G.settings, value: 'security', block: true, open: true, mode: 'none' })}${dd({ style, g: G.secsub, value: 'nvr', block: true, mode: 'none' })}${corner(true)}</div><div class="ph-title">NVR</div><div class="ph-body">${phoneList(5)}</div>${dock('gear')}${sheet(G.settings, 'security', { typed: 'א' })}<span class="cap">390 · הגדרות: 13 פריטים, הוקלד "א"</span></div>`;
  }

  // ---------- sections ----------
  function sectionCompare() {
    const styleOpts = STYLES;
    const head = ['סגנון', 'סגור (עם מונה)', 'התראה נסתרת', 'מיקוד מקלדת', 'פתוח (3 פריטים)', 'שורת הזוג (390)'];
    let html = `<div class="cmp">${head.map((h) => `<div class="hd">${h}</div>`).join('')}`;
    for (const s of styleOpts) {
      html += `<div><span class="nm">${s.he}<small>${s.en} · ${s.desc}</small></span></div>
        <div class="cell">${dd({ style: s.id, g: G.live, value: 'all', mode: 'none' })}</div>
        <div class="cell">${dd({ style: s.id, g: G.sections, value: 'live', mode: 'none' })}</div>
        <div class="cell">${dd({ style: s.id, g: G.invest, value: 'rec', focus: true, mode: 'none' })}</div>
        <div class="cell tall">${dd({ style: s.id, g: state.cmpOpen === 'long' ? G.settings : G.live, value: state.cmpOpen === 'long' ? 'security' : 'all', open: true, inline: true, cursor: 2 })}</div>
        <div class="cell" style="padding:0"><div class="frame phone" style="inline-size:100%;block-size:auto;border:0;border-radius:0;box-shadow:none;background:var(--sw-bg)">${pairRow(s.id)}</div></div>`;
    }
    return html + '</div>';
  }
  function sectionMatrix(style) {
    let html = '<div class="matrix">';
    for (const sk of SKINS) for (const th of ['light', 'dark']) {
      html += `<div class="cell" data-skin="${sk.id}" data-theme="${th}" data-radius="${state.radius}"><h4>${sk.he} · ${th === 'light' ? 'בהיר' : 'כהה'}</h4>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-block-end:10px">${dd({ style, g: G.sections, value: 'invest', mode: 'none' })}${dd({ style, g: G.invest, value: 'rec', mode: 'none' })}</div>
        ${dd({ style, g: G.live, value: 'all', open: true, inline: true, cursor: 1 })}</div>`;
    }
    return html + '</div>';
  }
  function paletteVars(p, th) {
    const c = p[th];
    const rgb = hexToRgb(c.tint);
    return `--sw-bg:${c.bg};--sw-canvas:linear-gradient(${c.bg},${c.bg});--sw-surface:${c.surface};--sw-surface-2:${c.surface2};--sw-surface-3:${c.surface2};--sw-surface-solid:${c.el};` +
      `--sw-text:${c.text};--sw-heading:${c.text};--sw-text-2:${c.muted};--sw-text-3:${c.muted};--sw-border-strong:${c.border};--sw-accent:${c.accent};--sw-accent-text:${c.accentT};` +
      `--sw-accent-soft:color-mix(in srgb, ${c.accent} 16%, transparent);--sw-focus:${c.accent};--sw-text-inverse:${c.accentC};--sw-sheet-rgb:${rgb};--sw-nav-glass:rgba(${rgb},0.62);--sw-danger:${c.danger};--sw-warning:${c.warning};`;
  }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`; }
  function sectionPalettes(style) {
    let html = '<div class="palgrid">';
    for (const p of PALETTES) {
      html += `<div class="cell" data-skin="bubble" data-theme="light" data-radius="${state.radius}" style="${paletteVars(p, 'light')}"><h4>${p.he} <span class="muted">${p.id}</span></h4><div class="duo">`;
      for (const th of ['light', 'dark']) {
        html += `<div data-skin="bubble" data-theme="${th}" data-radius="${state.radius}" style="${paletteVars(p, th)}">
          <div style="display:flex;gap:8px;align-items:center;margin-block-end:8px;flex-wrap:wrap">${dd({ style, g: G.sections, value: 'invest', mode: 'none' })}${dd({ style, g: G.live, value: 'all', mode: 'none' })}</div>
          ${dd({ style, g: G.secsub, value: 'cams', open: true, inline: true, cursor: 1 })}</div>`;
      }
      html += '</div></div>';
    }
    return html + '</div>';
  }
  function sectionFrames(style) {
    return `<div class="frames"><div class="fit" data-w="1440" data-h="720">${desktopSecurity(style)}</div></div>
      <div class="frames" style="margin-block-start:18px"><div class="fit" data-w="1440" data-h="720">${desktopSettings(style)}</div></div>
      <div class="frames three" style="margin-block-start:18px"><div class="fit" data-w="820" data-h="660">${tabletFrame(style)}</div><div class="fit" data-w="390" data-h="760">${phoneClosed(style)}</div><div class="fit" data-w="390" data-h="760">${phoneSheet(style)}</div></div>
      <div class="frames three" style="margin-block-start:18px"><div class="fit" data-w="820" data-h="660"><div class="frame tablet">${rail('home')}<div class="main">${corner()}
        <div class="head"><span class="treebtn">${ICONS.tree}</span><h1>קומה 1</h1><span class="sep"></span>${dd({ style, g: G.areas, value: 'f1', open: true, cursor: 3, prefix: false })}</div>
        <div class="content">${kpis()}</div><span class="cap">820 · רשימת האזורים של הקומה, מקובצת לפי קומות (העץ בצורת רשימה)</span></div></div></div>
        <div class="fit" data-w="390" data-h="760">${phoneSettings(style)}</div>
        <div class="fit" data-w="390" data-h="760"><div class="frame phone"><div class="tabpair">${dd({ style, g: G.areas, value: 'f1', block: true, mode: 'none' })}${dd({ style, g: { label: 'תצוגה', group: 'אזור', items: [{ id: 'a', label: 'מבט על' }, { id: 'b', label: 'קברניט' }] }, value: 'a', block: true, mode: 'none' })}${corner(true)}</div><div class="ph-title">סלון</div><div class="ph-body">${kpis().replace('class="kpis"', 'class="kpis" style="grid-template-columns:1fr 1fr"')}${phoneList(3)}</div>${dock('home')}<span class="cap">390 · מסך האזור: אזור בקומה + לשוניות האזור</span></div></div></div>`;
  }

  function styleStrip(current, onPick) {
    return `<div class="stylestrip" data-strip="${onPick}">${STYLES.map((s) => `<button type="button" data-style-pick="${s.id}" aria-pressed="${s.id === current}">${s.he}</button>`).join('')}</div>`;
  }

  function render() {
    document.body.dataset.skin = state.skin;
    document.body.dataset.theme = state.theme;
    document.body.dataset.radius = state.radius;
    document.body.dataset.touch = state.touch;
    document.body.dataset.perf = state.perf;
    // palette: only on the bubble skin (as in the product)
    const palStyle = document.getElementById('pal');
    const p = PALETTES.find((x) => x.id === state.palette);
    palStyle.textContent = p ? `body[data-skin="bubble"][data-theme="light"], body [data-skin="bubble"][data-theme="light"]:not([style]) { ${paletteVars(p, 'light')} }
      body[data-skin="bubble"][data-theme="dark"], body [data-skin="bubble"][data-theme="dark"]:not([style]) { ${paletteVars(p, 'dark')} }` : '';
    const s = STYLES.find((x) => x.id === state.style) || STYLES[0];
    const root = document.getElementById('root');
    root.innerHTML = `
      <section class="block"><h2>א. השוואה זו לצד זו</h2><p class="lead">ששת הסגנונות באותו סקין וערכה (בוחרים למעלה). כל פקד כאן חי: לחיצה פותחת וסוגרת, בחיפוש אפשר להקליד.
        <span class="seg" style="margin-inline-start:10px"><button type="button" data-cmp="short" aria-pressed="${state.cmpOpen === 'short'}">רשימה קצרה</button><button type="button" data-cmp="long" aria-pressed="${state.cmpOpen === 'long'}">13 פריטים + חיפוש</button></span></p>${sectionCompare()}</section>
      <section class="block"><h2>ב. בהקשר: ${s.he} <span class="muted">(${s.en})</span></h2><p class="lead">1440 / 820 / 390, אבטחה והגדרות, הזוג בטלפון, גיליון תחתון או מרכזי לפי חוגת הפופ-אפ. עץ הקומות והאזורים נשאר במקומו בכל רוחב (פאנל, מגירה או רשימה).</p>${styleStrip(state.style)}${sectionFrames(state.style)}</section>
      <section class="block"><h2>ג. ארבעת הסקינים, בהיר וכהה: ${s.he}</h2><p class="lead">אותו פקד, רק הטוקנים משתנים. חוגת הפינות (למעלה) פועלת על Bubble בלבד, כמו במוצר.</p>${sectionMatrix(state.style)}</section>
      <section class="block"><h2>ד. עשר הערכות של Bubble: ${s.he}</h2><p class="lead">בהיר וכהה לכל ערכה. הפקד קורא טוקנים בלבד, לכן ערכה חדשה או מותאמת אישית לא דורשת עבודה בפקד.</p>${sectionPalettes(state.style)}</section>`;
    fit();
    writeHash();
  }

  function fit() {
    document.querySelectorAll('.fit').forEach((box) => {
      const w = +box.dataset.w, h = +box.dataset.h;
      const frame = box.firstElementChild;
      const avail = box.clientWidth || w;
      const sc = Math.min(1, avail / w);
      frame.style.transform = `scale(${sc})`;
      box.style.blockSize = `${Math.round(h * sc)}px`;
    });
  }

  // ---------- controls ----------
  function buildTopbar() {
    const bar = document.getElementById('bar');
    const seg = (key, opts) => `<span class="ctl">${opts.label}<span class="seg" data-key="${key}">${opts.values.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${state[key] === v}">${t}</button>`).join('')}</span></span>`;
    bar.innerHTML = `<h1>סגנונות תפריט נפתח ללשוניות · 0.1.157</h1>
      <span class="ctl">סגנון<select data-key="style">${STYLES.map((s) => `<option value="${s.id}" ${s.id === state.style ? 'selected' : ''}>${s.he}</option>`).join('')}</select></span>
      ${seg('skin', { label: 'סקין', values: SKINS.map((s) => [s.id, s.he]) })}
      ${seg('theme', { label: 'מצב', values: [['light', 'בהיר'], ['dark', 'כהה']] })}
      <span class="ctl">ערכה<select data-key="palette" ${state.skin === 'bubble' ? '' : 'disabled title="ערכות צבעים שייכות לסקין Bubble"'}><option value="default">ברירת מחדל</option>${PALETTES.map((p) => `<option value="${p.id}" ${p.id === state.palette ? 'selected' : ''}>${p.he}</option>`).join('')}</select></span>
      ${seg('radius', { label: 'פינות', values: [['pill', 'כמוסה'], ['soft', 'רך'], ['square', 'מרובע']] })}
      ${seg('touch', { label: 'מגע', values: [['44', '44'], ['32', '32']] })}
      ${seg('perf', { label: 'ביצועים', values: [['full', 'מלא'], ['lite', 'לייט / ללא שקיפות']] })}
      ${seg('popup', { label: 'פופ-אפ בטלפון', values: [['sheet', 'גיליון'], ['centred', 'מרכזי']] })}`;
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const segBtn = t.closest('.seg[data-key] button');
    if (segBtn) { state[segBtn.parentElement.dataset.key] = segBtn.dataset.v; buildTopbar(); render(); return; }
    const cmp = t.closest('[data-cmp]');
    if (cmp) { state.cmpOpen = cmp.dataset.cmp; render(); return; }
    const pick = t.closest('[data-style-pick]');
    if (pick) { state.style = pick.dataset.stylePick; buildTopbar(); render(); return; }
    const chip = t.closest('.dd > .chip');
    if (chip) {
      const box = chip.parentElement;
      if (box.classList.contains('inline')) return;
      const willOpen = !box.classList.contains('open');
      document.querySelectorAll('.dd.open:not(.inline)').forEach((d) => { if (d !== box) d.classList.remove('open'); });
      box.classList.toggle('open', willOpen);
      chip.setAttribute('aria-expanded', String(willOpen));
      return;
    }
    const opt = t.closest('.opt');
    if (opt) {
      const list = opt.parentElement;
      list.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-selected', String(o === opt)));
      const box = list.closest('.dd');
      if (box) { const txt = box.querySelector('.chip .txt'); if (txt) txt.textContent = opt.dataset.label; if (!box.classList.contains('inline')) box.classList.remove('open'); }
      return;
    }
    if (!t.closest('.dd') && !t.closest('.sheet')) document.querySelectorAll('.dd.open:not(.inline)').forEach((d) => d.classList.remove('open'));
  });
  document.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-key]');
    if (sel) { state[sel.dataset.key] = sel.value; buildTopbar(); render(); }
  });
  document.addEventListener('input', (e) => {
    const inp = e.target.closest('.search input');
    if (!inp) return;
    const q = inp.value.trim();
    const list = inp.closest('.pop, .list');
    let any = false;
    list.querySelectorAll('.opt').forEach((o) => { const hit = !q || o.dataset.label.includes(q); o.classList.toggle('hide', !hit); any = any || hit; });
    list.querySelectorAll('.grp').forEach((g) => { let n = g.nextElementSibling, vis = false; while (n && !n.classList.contains('grp')) { if (n.classList.contains('opt') && !n.classList.contains('hide')) vis = true; n = n.nextElementSibling; } g.style.display = vis ? '' : 'none'; });
    let em = list.querySelector('.empty');
    if (!any && !em) { em = document.createElement('div'); em.className = 'empty'; em.textContent = 'אין תוצאות'; list.appendChild(em); }
    if (any && em) em.remove();
  });
  document.addEventListener('keydown', (e) => {
    // Esc closes an open popover; arrows move the cursor (a taste of the real keyboard model)
    const open = document.querySelector('.dd.open:not(.inline)');
    if (!open) return;
    if (e.key === 'Escape') { open.classList.remove('open'); open.querySelector('.chip').focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const opts = [...open.querySelectorAll('.opt:not(.hide)')];
      const cur = opts.findIndex((o) => o.hasAttribute('data-active'));
      const next = ((cur + (e.key === 'ArrowDown' ? 1 : -1)) % opts.length + opts.length) % opts.length;
      opts.forEach((o, i) => o.toggleAttribute('data-active', i === next));
    }
  });
  window.addEventListener('resize', fit);

  buildTopbar();
  render();
})();
