import { icon as I } from './icons.mjs';
import { fontFace, tokensCss, baseCss, phoneCss, skinRules } from './css.mjs';
import { current } from './skin.mjs';

// ---------- document + shell ----------
// Fonts live in boards/fonts/ only; boards of the non-root skins (boards/<skin>/) reach them with '../fonts/'.
let defaultFontPrefix = 'fonts/';
export const setFontPrefix = (p) => { defaultFontPrefix = p; };
export function doc({ title, scheme = 'light', dir = 'rtl', body, css = '', label = '', width, fontPrefix = defaultFontPrefix }) {
  return `<!doctype html>
<html lang="he" dir="${dir}" data-scheme="${scheme}" data-skin="${current().id}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${fontFace(fontPrefix)}${tokensCss()}${baseCss}${skinRules()}${phoneCss}${css}</style>
</head>
<body class="canvas"${width ? ` style="width:${width}px"` : ''}>
${body}
${label ? `<div class="board-label">${label} · ${current().id}</div>` : ''}
</body>
</html>`;
}

const AREAS = [
  ['home', 'ראשי', 'home'],
  ['security', 'אבטחה', 'shield'],
  ['map', 'מפה', 'map'],
  ['wiskey', 'WisKey', 'key'],
];

export function rail({ active = 'home', preset = 'l', labels = true, user = 'יו', alert = true } = {}) {
  return `<nav class="rail rail-${preset}" aria-label="אזורים"><div class="rail-in glass">
  <div class="brand" aria-label="Arx">S</div>
  ${AREAS.map(([id, name, ic]) => `<a class="rail-item${active === id ? ' active' : ''}${labels ? '' : ' nolabel'}" href="#">${I(ic)}${labels ? `<span>${name}</span>` : ''}</a>`).join('')}
  <div class="rail-spacer"></div>
  <button class="rail-foot"><span class="avatar">${user}${alert ? '<i class="adot"></i>' : ''}</span>${labels ? `<span>יוני</span>` : ''}</button>
</div></nav>`;
}

export function bottomBar({ active = 'home', user = 'יו', alert = true } = {}) {
  return `<nav class="bar" aria-label="אזורים">
  ${AREAS.map(([id, name, ic]) => `<a class="bar-item${active === id ? ' active' : ''}" href="#"><span class="pill">${I(ic, { size: 22 })}</span><span>${name}</span></a>`).join('')}
  <button class="bar-item"><span class="pill"><span class="avatar">${user}${alert ? '<i class="adot"></i>' : ''}</span></span><span>יוני</span></button>
</nav>`;
}

export function corner({ health = 'ok' } = {}) {
  return `<div class="corner"><button class="cbtn" aria-label="חיפוש">${I('search', { size: 19 })}</button><span class="health" title="מצב המערכת"><span class="dot lg ${health}"></span></span></div>`;
}

export function shell({ active, phone, content, health = 'ok', preset = 'l' }) {
  if (phone) return `<div class="app phone"><main class="content">${corner({ health })}${content}</main></div>${bottomBar({ active })}`;
  return `<div class="app">${rail({ active, preset })}<main class="content">${corner({ health })}${content}</main></div>`;
}

// ---------- shared bits ----------
const chevBack = `<button class="btn icon ghost" aria-label="חזרה">${I('chevron', { mirror: true })}</button>`;
const tg = (on, extra = '') => `<span class="tg small${on ? ' on' : ''}${extra}" role="switch" aria-checked="${on}"><span class="tr"></span></span>`;
const offAll = (label = 'כבה הכל') => `<button class="btn ghost sm">${I('power')}${label}</button>`;
const fbtn = (label) => `<button class="fbtn">${label}${I('chevron')}</button>`;
// the three-way view switch: tiles · cards · list. Every screen carries it; the boards render cards and list.
const viewSeg = (view, opts = ['tiles', 'cards', 'list']) => {
  const L = { tiles: ['grid', 'אריחים'], cards: ['cards', 'כרטיסים'], list: ['list', 'רשימה'], gridv: ['grid', 'רשת'] };
  return `<div class="seg" role="tablist" aria-label="תצוגה">${opts.map((v) => `<button class="${v === view ? 'on' : ''}">${I(L[v][0])}${L[v][1]}</button>`).join('')}</div>`;
};
const fact = (ic, v, on = false) => `<span${on ? ' class="on"' : ''}>${I(ic)}<b class="num">${v}</b></span>`;

// ---------- HOME (building view: large title + floor row, room cards with ambient chips) ----------
const homeCss = `
.page.home{gap:12px;padding-block-start:16px;padding-block-end:20px}
.home .head{align-items:flex-start}
.home .head .facts{margin-top:6px}
.home .hctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:6px}
.widgets{display:grid;grid-template-columns:1.15fr 1.5fr 1.1fr 1fr 1.05fr;gap:14px}
.widget{padding:12px 16px;display:flex;flex-direction:column;gap:4px;min-height:104px}
.widget.alarm .word{font-size:22px;font-weight:var(--sw-fw-bold);color:var(--sw-heading);letter-spacing:-.3px}
.widget.quick{gap:8px;justify-content:center}
.floor{display:flex;flex-direction:column;gap:10px}
.floor .fh{display:flex;align-items:center;gap:12px;min-height:36px}
.floor .fh .h2{font-size:var(--sw-fs-xl);white-space:nowrap}
.floor .fh .facts{font-size:var(--sw-fs-sm)}
.floor .fh .act{margin-inline-start:auto}
.rooms{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--sw-card-gap)}
.room{padding:12px 14px;gap:8px;min-height:0}
.room .amb{flex-wrap:nowrap;overflow:hidden}
.room .amb .chip{height:28px;padding:0 9px;font-size:var(--sw-fs-xs)}
.room .rf{min-height:36px} .room .rf .more{min-height:32px}
.floor .fh{min-height:32px}
.room.unassigned{justify-content:center}
.strip{display:flex;gap:8px;overflow:hidden;position:relative;align-items:center}
.strip .lbl{font-size:var(--sw-fs-sm);color:var(--sw-text-3);white-space:nowrap;margin-inline-end:4px}
.strip::after{content:"";position:absolute;inset-block:0;inset-inline-end:0;width:56px;background:linear-gradient(to right,var(--sw-bg),transparent);pointer-events:none}
/* optional home widgets (home-kpi variant): KPI strip, climate strip, building tree beside the floors */
.hbody{display:flex;gap:var(--sw-card-gap);align-items:flex-start}
.hbody .floors{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.hbody .room .amb .chip:nth-child(n+4){display:none} /* narrower cards beside the tree: three ambient chips */
.tree-panel{padding:10px}
.tree-panel .tree .trow.tfloor:first-child{margin-top:0}
.strip.climate{gap:8px} .strip.climate .chip{height:34px}
@media (max-width:767px){
  .widgets{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;margin-inline:-16px;padding-inline:16px;scrollbar-width:none}
  .widget{flex:0 0 78%;scroll-snap-align:start;min-height:128px}
  .widget.quick{flex-basis:60%}
  .rooms{grid-template-columns:1fr}
  .home .hctl{padding-top:0}
  .home .hctl .seg{flex:1} .home .hctl .seg > *{flex:1;justify-content:center;padding:0 6px}
}`;

const ROOMS = [
  { floor: 'קרקע', floorFacts: [['bulb', '6/18', true], ['wave', '2/3'], ['layers', '1/2']], rooms: [
    { name: 'לובי', ic: 'door', on: true, n: 9, act: 3, amb: [['thermo', '23.5°'], ['bulb', '2/6', true], ['layers', '1/2'], ['lock', 'נעול']] },
    { name: 'סלון', ic: 'home', on: true, n: 13, act: 5, amb: [['thermo', '24.5°'], ['droplet', '48%'], ['bulb', '4/6', true], ['wave', 'קירור 22°', true], ['monitor', '1/1']] },
    { name: 'מטבח', ic: 'home', n: 8, act: 0, amb: [['thermo', '25°'], ['bulb', '0/4'], ['bolt', '0/2'], ['wave', 'כבוי']] },
    { name: 'חניון', ic: 'camera', n: 6, act: 0, amb: [['bulb', '0/2'], ['camera', '2'], ['door', 'סגור']] },
  ] },
  { floor: 'קומה 1', floorFacts: [['bulb', '10/18', true], ['wave', '3/3'], ['layers', '4/6']], rooms: [
    { name: 'חדר ילדים', ic: 'home', on: true, n: 6, act: 7, amb: [['thermo', '23°'], ['bulb', '6/6', true], ['wave', 'קירור 23°', true]] },
    { name: 'חדר שינה הורים', ic: 'moon', on: true, n: 7, act: 6, amb: [['thermo', '22.5°'], ['bulb', '4/6', true], ['layers', '2/2'], ['wave', 'קירור 21°', true]] },
    { name: 'משרד', ic: 'monitor', n: 5, act: 1, amb: [['thermo', '24°'], ['bulb', '0/6'], ['bolt', '0/2'], ['wave', 'קירור 22°', true]] },
  ] },
  { floor: 'מרתף', floorFacts: [['bulb', '0/12'], ['sensor', '3']], rooms: [
    { name: 'חדר מכונות', ic: 'settings', n: 7, act: 0, amb: [['thermo', '27°'], ['bulb', '0/4'], ['sensor', '3']] },
    { name: 'מחסן', ic: 'layers', n: 8, act: 0, amb: [['bulb', '0/8'], ['motion', 'אין תנועה']] },
  ] },
];

export function roomCard({ name, ic = 'home', on, n, act, amb }) {
  return `<a class="glass room lift${on ? ' on' : ''}" href="#">
    <div class="rh"><span class="dbadge lg">${I(ic)}</span><span class="grow"><div class="rn">${name}</div><div class="rs"><span class="num">${n}</span> התקנים${act ? ` · <span class="num">${act}</span> פעילים` : ''}</div></span>${on ? '<span class="dot on lg"></span>' : ''}</div>
    <div class="amb">${amb.slice(0, 4).map(([i, v, hot]) => `<span class="chip${hot ? ' warm' : ''}">${I(i)}<span class="num">${v}</span></span>`).join('')}</div>
    <div class="rf"><span class="more">פרטים ${I('chevron', { mirror: true })}</span><button class="btn ghost icon touch" aria-label="כבה הכל בחדר">${I('power')}</button></div>
  </a>`;
}

function homeHead({ phone, view }) {
  return `<header class="head"><div><h1 class="h1">הבית של רון</h1><div class="sub">3 קומות · <span class="num">9</span> אזורים · <span class="num">111</span> התקנים</div>
    <div class="facts">${fact('bulb', '16/48', true)}${fact('bolt', '0/32')}${fact('layers', '8/16')}${fact('wave', '8/8')}${fact('monitor', '1/1')}<span>${I('lock')}<b>נעול</b></span><span>${I('shield')}<b>אזעקה דרוכה · חוץ</b></span></div></div>
    <div class="hctl">${phone ? '' : fbtn('כל המבנה')}${viewSeg(view)}</div></header>`;
}

function widgets() {
  return `<section class="widgets">
    <div class="glass widget"><div class="wlabel">${I('clock')}שעה</div><div class="reading num">15:33<small>38</small></div><div class="muted" style="margin-top:auto">יום רביעי · 30 בספטמבר<br><span class="faint">כ״ט באלול התשפ״ו</span></div></div>
    <div class="glass widget"><div class="wlabel">${I('cloudSun')}מזג אוויר</div><div class="row" style="gap:12px"><span class="reading num" style="font-size:44px">28°</span><span>${I('cloudSun', { size: 34 })}<div class="muted">מעונן חלקית</div></span><span class="faint" style="margin-inline-start:auto;font-size:var(--sw-fs-sm);text-align:end">לחות <span class="num">61%</span><br>רוח <span class="num">14</span> קמ״ש</span></div>
      <div class="forecast">${[['14:00', 'sun', '29°'], ['15:00', 'cloudSun', '28°'], ['16:00', 'cloud', '27°'], ['17:00', 'rain', '26°'], ['18:00', 'rain', '25°']].map(([h, i, t]) => `<div><span class="num">${h}</span>${I(i)}<b class="num">${t}</b></div>`).join('')}</div></div>
    <div class="glass widget"><div class="wlabel">${I('star')}שבת</div><div class="h2" style="font-size:22px">פרשת בראשית</div><div class="muted" style="margin-top:auto;display:grid;gap:2px"><span>${I('candle', { size: 15 })} הדלקת נרות <b class="num">17:32</b></span><span>${I('moon', { size: 15 })} צאת שבת <b class="num">18:30</b></span></div></div>
    <div class="glass widget alarm"><div class="wlabel">${I('shield')}אזעקה</div><div class="row" style="gap:10px"><span class="ring" style="background:var(--sw-live-soft);color:var(--sw-live)">${I('shield')}</span><span class="word">דרוכה (חוץ)</span></div><div class="row" style="margin-top:auto;gap:6px"><span class="chip" style="height:26px;font-size:11.5px">קומת כניסה</span><span class="chip" style="height:26px;font-size:11.5px">חוץ</span></div></div>
    <div class="glass widget quick"><div class="wlabel">${I('bolt')}פעולות מהירות</div><button class="btn danger lg">${I('power')}כבה הכל בבניין</button><button class="btn secondary lg">${I('bulb')}כבה תאורה בלבד</button></div>
  </section>`;
}

const unassigned = () => `<a class="glass room unassigned lift" href="#"><div class="rh"><span class="dbadge lg">${I('inbox')}</span><span class="grow"><div class="rn">ללא שיוך</div><div class="rs"><span class="num">4</span> התקנים</div></span>${I('chevron', { mirror: true, cls: 'faint' })}</div></a>`;

// optional widgets (owner decision: KPI strip, building tree and climate strip are widgets, not structure)
const KPIS = [
  { ic: 'bulb', v: '16/48', l: 'תאורה דולקת', tone: 'warm' }, { ic: 'bolt', v: '0/32', l: 'מתגים פעילים' }, { ic: 'layers', v: '8/16', l: 'תריסים פתוחים', tone: 'accent' },
  { ic: 'wave', v: '8/8', l: 'מיזוג פעיל', tone: 'cool' }, { ic: 'monitor', v: '1/1', l: 'מסכים דולקים' }, { ic: 'lock', v: '1/1', l: 'מנעולים', d: 'הכול נעול', tone: 'live' },
  { ic: 'camera', v: '14/16', l: 'מצלמות', d: '2 לא מעודכנות', tone: 'stale' },
];
const kpiStrip = () => `<section class="kpis">${KPIS.map((k) => kpi(k).replace('class="kpi', 'class="kpi glass')).join('')}</section>`;
const climateStrip = () => `<div class="strip climate"><span class="lbl">${I('wave', { size: 15 })} מזגנים</span>${[['סלון', 'קירור 22°', true], ['חדר ילדים', 'קירור 23°', true], ['חדר שינה הורים', 'קירור 21°', true], ['משרד', 'קירור 22°', true], ['לובי', 'כבוי'], ['מטבח', 'כבוי'], ['חדר ישיבות', 'קירור 24°', true], ['מחסן', 'כבוי']].map(([n, s, on]) => `<span class="chip${on ? ' warm' : ''}">${n} · <span class="num">${s}</span></span>`).join('')}</div>`;
const treePanel = () => `<aside class="glass tree-panel"><div class="tree">
  <div class="trow sel">${I('building')}<span>כל המבנה</span><span class="lit"><span class="num">111</span></span><span class="menu">${I('dots', { size: 16 })}</span></div>
  ${ROOMS.map((f) => `<div class="trow tfloor">${I('layers')}<span>${f.floor}</span><span class="lit${f.floorFacts[0][2] ? ' on' : ''}">${I('bulb')}<span class="num">${f.floorFacts[0][1]}</span></span><span class="menu">${I('dots', { size: 16 })}</span></div>
  ${f.rooms.map((r) => `<div class="trow area">${I(r.ic)}<span>${r.name}</span><span class="lit${r.on ? ' on' : ''}"><span class="num">${r.act || 0}</span>/<span class="num">${r.n}</span></span><span class="menu">${I('dots', { size: 16 })}</span></div>`).join('')}`).join('')}
  <div class="trow area">${I('inbox')}<span>ללא שיוך</span><span class="lit"><span class="num">4</span></span></div>
</div></aside>`;

export function homeContent({ phone = false, view = 'cards', widgetsExtra = false } = {}) {
  const floors = ROOMS.map((f, i) => `<section class="floor"><div class="fh"><h2 class="h2">${f.floor}</h2><span class="facts"><span><b class="num">${f.rooms.length}</b> אזורים</span>${f.floorFacts.map(([ic, v, on]) => fact(ic, v, on)).join('')}</span><span class="act">${offAll('כבה קומה')}</span></div>
    <div class="rooms">${f.rooms.map(roomCard).join('')}${i === ROOMS.length - 1 ? unassigned() : ''}</div></section>`).join('');
  if (widgetsExtra) return `<div class="page home">${homeHead({ phone, view })}${widgets()}${kpiStrip()}${climateStrip()}<div class="hbody">${treePanel()}<div class="floors">${floors}</div></div></div>`;
  return `<div class="page home">${homeHead({ phone, view })}${widgets()}${floors}</div>`;
}

export function homeBoard({ scheme, phone, dir = 'rtl', fontPrefix = defaultFontPrefix }) {
  return doc({
    title: `Arx · הבית · ${phone ? 390 : 1440} · ${scheme}${dir === 'ltr' ? ' · LTR' : ''}`, scheme, dir, css: homeCss + listCss, fontPrefix,
    body: shell({ active: 'home', phone, content: homeContent({ phone }) }),
    label: `home · ${phone ? '390×844' : '1440×900'} · ${scheme}${dir === 'ltr' ? ' · ltr mirror' : ''}`,
  });
}

// home with the optional widgets (KPI strip + climate strip + building tree). 1440 only; the default home stays the facts row.
export function homeKpiBoard({ scheme }) {
  return doc({
    title: `Arx · הבית · ווידג׳טים אופציונליים · 1440 · ${scheme}`, scheme, css: homeCss + listCss,
    body: shell({ active: 'home', phone: false, content: homeContent({ widgetsExtra: true }) }),
    label: `home-kpi · 1440×900 · ${scheme} · optional widgets: KPI strip + climate strip + building tree`,
  });
}

// ---------- HOME · list view: areas as rows, grouped by floor ----------
const listCss = `
.ltable.areas .lhead,.ltable.areas .lrow{grid-template-columns:minmax(170px,1.4fr) 76px 92px 92px 108px 96px 72px 88px}
.ltable.devices .lhead,.ltable.devices .lrow{grid-template-columns:minmax(190px,1.3fr) minmax(90px,1fr) minmax(110px,1fr) auto}
.ltable.cams .lhead,.ltable.cams .lrow{grid-template-columns:minmax(200px,1.5fr) 110px 130px 90px 110px 120px 88px}
.ltable .ph-only{display:none}
.lrow .ctl{display:flex;justify-content:flex-end;align-items:center;gap:6px}
@media (max-width:767px){
  .ltable .ph-hide,.lhead{display:none} .ltable .ph-only{display:inline-flex}
  .ltable.areas .lrow{grid-template-columns:minmax(0,1fr) auto auto 44px;gap:8px}
  .ltable.devices .lrow{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name ctl" "state ctl";gap:0 8px;padding-block:6px}
  .ltable.devices .lrow .lname{grid-area:name} .ltable.devices .lrow .lc:nth-child(2){grid-area:state;padding-inline-start:40px;font-size:var(--sw-fs-sm)} .ltable.devices .lrow .ctl{grid-area:ctl}
  .lgroup{flex-wrap:nowrap} .lgroup .count{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .ltable.cams .lrow{grid-template-columns:minmax(0,1fr) auto 44px;gap:8px}
  .lrow{padding-inline:12px} .lgroup{padding-inline:12px}
}`;

export function homeListContent({ phone = false } = {}) {
  const head = `<div class="lhead"><span>אזור</span><span>קומה</span><span>טמפ׳</span><span>תאורה</span><span>מיזוג</span><span>תריסים / אבטחה</span><span>התקנים</span><span></span></div>`;
  const row = (f, r) => {
    const get = (ic) => r.amb.find((a) => a[0] === ic);
    const t = get('thermo'), b = get('bulb'), w = get('wave'), l = get('layers') || get('lock') || get('door') || get('camera');
    return `<a class="lrow${r.on ? ' on warm' : ''}" href="#"><span class="lname"><span class="ring">${I(r.ic)}</span><span>${r.name}</span>${r.on ? '<span class="dot on"></span>' : ''}</span>
      <span class="lc ph-hide">${f}</span><span class="lc ph-hide">${t ? `<b class="num">${t[1]}</b>` : '<span class="faint">—</span>'}</span>
      <span class="lc${b && b[2] ? ' on' : ''}">${I('bulb')}<b class="num">${b ? b[1] : '—'}</b></span>
      <span class="lc ph-hide">${w ? `${I('wave')}<b class="num">${w[1]}</b>` : '<span class="faint">—</span>'}</span>
      <span class="lc ph-hide">${l ? `${I(l[0])}<b class="num">${l[1]}</b>` : '<span class="faint">—</span>'}</span>
      <span class="lc ph-hide"><b class="num">${r.n}</b></span>
      <span class="lact"><button class="btn ghost icon" aria-label="כבה הכל בחדר">${I('power')}</button><button class="btn ghost icon ph-hide" aria-label="פרטים">${I('chevron', { mirror: true })}</button></span></a>`;
  };
  const groups = ROOMS.map((f) => `<div class="lgroup">${I('layers', { size: 16, cls: 'faint' })}${f.floor}<span class="count"><span class="num">${f.rooms.length}</span> אזורים · ${f.floorFacts.map(([ic, v]) => `<span class="num">${v}</span>`).join(' · ')}</span><span class="act">${offAll('כבה קומה')}</span></div>${f.rooms.map((r) => row(f.floor, r)).join('')}`).join('');
  const un = `<div class="lgroup">${I('inbox', { size: 16, cls: 'faint' })}ללא שיוך<span class="count"><span class="num">4</span> התקנים</span></div>`;
  return `<div class="page home">${homeHead({ phone, view: 'list' })}${phone ? '' : widgets()}<section class="glass ltable areas">${head}${groups}${un}</section></div>`;
}

export function homeListBoard({ scheme, phone }) {
  return doc({
    title: `Arx · הבית · רשימה · ${phone ? 390 : 1440} · ${scheme}`, scheme, css: homeCss + listCss,
    body: shell({ active: 'home', phone, content: homeListContent({ phone }) }),
    label: `home-list · ${phone ? '390×844' : '1440×900'} · ${scheme}`,
  });
}

// ---------- AREA (room screen: floor button, big room title, rooms row, 4-column domain grid, tall climate) ----------
const areaCss = `
.page.area{gap:10px;padding-block-start:12px}
.ahead{display:flex;flex-direction:column;gap:6px}
.ahead .tabs.rooms .tab{min-height:34px}
.dcard .tile{min-height:var(--sw-touch)}
.dcard .tiles1,.dcard .tiles2,.dcard .sens2{gap:8px}
.tiles2 .tile.col{grid-column:auto}
.ahead .top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ahead .top .end{margin-inline-start:auto;display:flex;align-items:center;gap:10px}
.ahead .title{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}
.ahead .title .facts{padding-bottom:8px}
.domains{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sw-card-gap);align-items:stretch}
.dcard{padding:12px;display:flex;flex-direction:column}
.dcard .card-head{margin-bottom:8px}
.dcard.tall{grid-row:span 2}
.dcard.wide{grid-column:span 2}
.dcol{display:flex;flex-direction:column;gap:12px}
.tiles1{display:grid;gap:var(--sw-tile-gap)}
.tiles2{display:grid;grid-template-columns:1fr 1fr;gap:var(--sw-tile-gap)}
.climate{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:var(--sw-r-md);background:var(--sw-surface-2);border:1px solid var(--sw-border);flex:1}
.climate .big{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
.climate .temp{font-size:var(--sw-fs-reading);font-weight:var(--sw-fw-reading);letter-spacing:var(--sw-reading-tracking);line-height:1;color:var(--sw-heading);font-variant-numeric:tabular-nums}
.climate .temp small{font-size:14px;letter-spacing:0;color:var(--sw-text-2);font-weight:var(--sw-fw-regular)}
.climate .seg{align-self:stretch;display:flex} .climate .seg>*{flex:1;justify-content:center;padding:0 6px}
.climate .aux{display:grid;grid-template-columns:1fr 1fr;gap:var(--sw-tile-gap);margin-top:auto}
.snap{position:relative;height:84px;border-radius:var(--sw-r-md);overflow:hidden;border:1px solid var(--sw-border);color:#fff}
.snap .nm{position:absolute;inset-inline:0;bottom:0;padding:18px 10px 8px;font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-semibold);background:linear-gradient(to top,rgba(4,8,16,.75),transparent);display:flex;align-items:center;gap:6px}
.snap .tag{position:absolute;top:8px;inset-inline-start:8px}
.snap .exp{position:absolute;top:6px;inset-inline-end:6px;width:32px;height:32px;border-radius:50%;background:rgba(8,12,20,.6);color:#fff;display:grid;place-items:center}
.sens2{display:grid;grid-template-columns:1fr 1fr;gap:var(--sw-tile-gap)}
.empties{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:var(--sw-fs-sm);color:var(--sw-text-3);padding-top:2px}
.ro .tctl,.ro .slider,.ro .bar-ind,.ro .offall,.ro .stepper,.ro .cover-ctl,.ro .climate .seg,.ro .master,.ro .ctl{display:none!important}
.ro .tile.col .tbody{flex:1}
@media (max-width:767px){
  .domains{grid-template-columns:1fr}.tiles2{grid-template-columns:1fr}.sens2{grid-template-columns:1fr 1fr}
  .dcard.tall,.dcard.wide{grid-row:auto;grid-column:auto}
  .ahead .top{padding-inline-end:0} .ahead .top .end{margin-inline-start:0;width:100%} .ahead .top .end .seg{flex:1;min-width:0} .ahead .top .end .seg > *{flex:1;justify-content:center;padding:0 6px;min-width:0} .ahead .top .end .seg .ic,.home .hctl .seg .ic{display:none}
  .climate .aux{margin-top:0}
}`;

function tile({ name, state, ic, on, kind = '', unavail, ctl = '', extra = '', col }) {
  const cls = ['tile', on ? `on ${kind}` : '', unavail ? 'unavail' : '', col ? 'col' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"${unavail ? ' title="אין תקשורת עם ההתקן"' : ''}><span class="ring">${I(ic)}</span><span class="tbody"><div class="tname">${name}</div><div class="tstate">${state}</div></span><span class="tctl">${ctl}</span>${extra}</div>`;
}
const slider = (pct) => `<div class="slider"><div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="thumb" style="inset-inline-start:${pct}%"></span></div>`;
// section card header: badge · title › · "N התקנים" · bulk action
function domainCard({ title, count, ic, role, body, bulk = true, bulkLabel = 'כבה הכל', ro, cls = '' }) {
  return `<section class="glass dcard ${cls}"><div class="card-head"><span class="dbadge" style="--role:var(--sw-role-${role});--role-fg:var(--sw-role-${role}-fg)">${I(ic)}</span><h3 class="sec-title"><span class="tt">${title}</span>${I('chevron', { mirror: true, cls: 'disc' })}<span class="count"><span class="num">${count}</span> התקנים</span></h3>${bulk && !ro ? `<span class="offall">${offAll(bulkLabel)}</span>` : ''}</div>${body}</section>`;
}

function areaHead({ phone, view, ro }) {
  return `<header class="ahead">
    <div class="top">${chevBack}${fbtn('קומה 1')}<div class="end">${viewSeg(view)}${ro ? '' : `<span class="offall">${offAll('כבה הכל באזור')}</span>`}</div></div>
    <div class="title"><h1 class="h1">סלון</h1><div class="facts"><span><b class="num">13</b> התקנים</span><span><b class="num">5</b> פעילים</span>${fact('thermo', '24.5°')}${fact('droplet', '48%')}<span>${I('motion')}<b>אין תנועה</b></span></div></div>
    <div class="tabs rooms fade" role="tablist"><span class="tab on">סלון <span class="n">13</span></span><span class="tab">מטבח <span class="n">8</span></span><span class="tab">לובי <span class="n">9</span></span><span class="tab">חדר ילדים <span class="n">6</span></span><span class="tab">חדר שינה הורים <span class="n">7</span></span><span class="tab">משרד <span class="n">5</span></span><span class="tab">חניון <span class="n">6</span></span></div>
  </header>`;
}

const DEV = {
  lights: [
    { name: 'ספוט סלון', state: 'דולק · 100%', ic: 'bulb', on: true, kind: 'cool', pct: 100 },
    { name: 'תאורת תקרה', state: 'דולק · 60%', ic: 'bulb', on: true, kind: 'cool', pct: 60, dim: true },
    { name: 'מנורת קריאה', state: 'כבוי', ic: 'bulb' }, { name: 'פס לד', state: 'כבוי', ic: 'bulb' },
    { name: 'תאורת מרפסת', state: 'כבוי', ic: 'bulb' }, { name: 'מנורת פינה', state: 'כבוי', ic: 'bulb' },
  ],
  switches: [
    { name: 'מערכת הגברה', state: 'פעיל', ic: 'bolt', on: true, kind: 'switch' },
    { name: 'מאוורר תקרה', state: 'לא זמין', ic: 'fan', unavail: true },
    { name: 'שקע יציע', state: 'כבוי', ic: 'bolt' },
  ],
  covers: [
    { name: 'וילון סלון', state: 'פתוח · 60%', ic: 'layers', on: true, kind: 'warm', pct: 60 },
    { name: 'תריס מרפסת', state: 'סגור', ic: 'layers', pct: 0 },
  ],
};
const coverCtl = (closed) => `<span class="cover-ctl"><button class="btn" aria-label="פתח">${I('up')}</button><button class="btn" aria-label="עצור">${I('stop')}</button><button class="btn${closed ? ' on' : ''}" aria-label="סגור">${I('down')}</button></span>`;

export function areaContent({ phone = false, state = 'ready', view = 'cards' } = {}) {
  const ro = state === 'readonly';
  const un = state === 'unavailable';
  const head = areaHead({ phone, view, ro });

  if (state === 'loading') {
    return `<div class="page area">${head}<div class="domains">${[0, 1, 2, 3].map(() => `<section class="glass dcard"><div class="row" style="gap:10px;margin-bottom:12px"><span class="skeleton" style="width:36px;height:36px;border-radius:12px"></span><span class="skeleton" style="width:120px;height:16px"></span></div><div class="tiles1">${[0, 1, 2].map(() => `<span class="skeleton" style="height:52px;border-radius:var(--sw-r-md)"></span>`).join('')}</div></section>`).join('')}</div></div>`;
  }
  if (state === 'empty') {
    return `<div class="page area">${head}<section class="glass"><div class="state"><span class="sic">${I('inbox')}</span><div class="st">אין התקנים באזור הזה</div></div></section></div>`;
  }
  if (state === 'error') {
    return `<div class="page area">${head}<section class="glass"><div class="state error"><span class="sic">${I('alert')}</span><div class="st">לא ניתן לטעון את האזור</div><div class="sh">תשתית המערכת לא הגיבה</div><button class="btn secondary" style="margin-top:6px">${I('refresh')}נסה שוב</button></div></section></div>`;
  }

  const lighting = domainCard({ title: 'תאורה', count: 6, ic: 'bulb', role: 'warm', ro, cls: 'wide', body: `<div class="tiles2">
    ${DEV.lights.map((d) => tile({ ...d, ctl: tg(!!d.on), col: d.dim, extra: d.dim ? slider(d.pct) : '' })).join('')}</div>` });
  const switches = domainCard({ title: 'מתגים', count: 3, ic: 'bolt', role: 'success', ro, body: `<div class="tiles1">
    ${DEV.switches.map((d) => tile({ ...d, ctl: tg(!!d.on, d.unavail ? ' disabled' : '') })).join('')}</div>` });
  const covers = un
    ? `<section class="glass dcard"><div class="card-head"><span class="dbadge" style="--role:var(--sw-role-neutral);--role-fg:var(--sw-role-neutral-fg)">${I('layers')}</span><h3 class="sec-title">תריסים${I('chevron', { mirror: true, cls: 'disc' })}<span class="count"><span class="num">2</span> התקנים</span></h3></div><div class="state compact stale" style="padding:8px 4px"><span class="sic">${I('wifiOff')}</span><div><div class="st" style="font-size:var(--sw-fs-md)">התחום לא זמין</div><div class="sh" style="font-size:var(--sw-fs-sm)">אין תקשורת עם בקר התריסים</div></div></div></section>`
    : domainCard({ title: 'תריסים', count: 2, ic: 'layers', role: 'accent', ro, bulkLabel: 'סגור הכל', body: `<div class="tiles1">
    ${tile({ ...DEV.covers[0], col: true, ctl: coverCtl(false), extra: `<span class="bar-ind"><i style="width:60%"></i></span>` })}
    ${tile({ ...DEV.covers[1], ctl: coverCtl(true) })}</div>` });
  const screens = domainCard({ title: 'מסכים', count: 1, ic: 'monitor', role: 'cool', ro, body: `<div class="tiles1">${tile({ name: 'טלוויזיה סלון', state: 'כבוי', ic: 'monitor', ctl: tg(false) })}</div>` });
  const climate = domainCard({ title: 'מיזוג', count: 1, ic: 'wave', role: 'warm', ro, cls: 'tall', body: `<div class="climate">
    <div class="row between"><span><div class="tname" style="font-weight:600;color:var(--sw-heading)">מזגן סלון</div><div class="muted" style="font-size:var(--sw-fs-sm)">קירור · כעת <span class="num">24.5°</span></div></span><span class="badge live"><span class="dot"></span>פעיל</span></div>
    <div class="big"><div class="temp num">23°<small> יעד</small></div>${ro ? '' : tg(true)}</div>
    ${ro ? '' : `<div class="row between"><span class="stepper"><button class="btn" aria-label="הנמך">${I('minus')}</button><span class="val num">23°</span><button class="btn" aria-label="הגבה">${I('plus')}</button></span><span class="muted" style="font-size:var(--sw-fs-sm)">יעד</span></div>`}
    <div><div class="wlabel" style="margin-bottom:6px">מצב</div><div class="seg"><button class="on">קירור</button><button>חימום</button><button>אוטו</button><button>מאוורר</button></div></div>
    <div><div class="wlabel" style="margin-bottom:6px">מאוורר</div><div class="seg"><button>נמוך</button><button class="on">בינוני</button><button>גבוה</button><button>אוטו</button></div></div>
    <div class="aux"><div class="sens"><span class="ring">${I('droplet')}</span><span><div class="sv num">48%</div><div class="sl">לחות</div></span></div><div class="sens"><span class="ring">${I('cloudSun')}</span><span><div class="sv num">28°</div><div class="sl">בחוץ</div></span></div></div>
  </div>` });
  const security = domainCard({ title: 'אבטחה', count: 3, ic: 'shield', role: 'success', bulk: false, body: `<div class="tiles1">
    ${tile({ name: 'דלת מרפסת', state: 'נעול', ic: 'lock', ctl: ro ? '' : `<button class="btn secondary sm">${I('unlock')}פתח</button>` })}
    ${tile({ name: 'מגע דלת כניסה', state: 'סגורה', ic: 'door', ctl: '<span class="badge live"><span class="dot"></span>סגורה</span>' })}
    <div class="snap"><div class="scene s4"></div><span class="tag badge image">${I('snapshot')}צילום</span><button class="exp" aria-label="הרחב">${I('expand', { size: 16 })}</button><div class="nm"><span class="dot live" style="border:1.5px solid rgba(255,255,255,.8)"></span>מצלמת סלון</div></div>
  </div>` });
  const sensors = domainCard({ title: 'חיישנים', count: 6, ic: 'sensor', role: 'neutral', bulk: false, body: `<div class="sens2">
    <div class="sens"><span class="ring">${I('thermo')}</span><span><div class="sv num">24.5°</div><div class="sl">טמפרטורה</div></span></div>
    <div class="sens"><span class="ring">${I('droplet')}</span><span><div class="sv num">48%</div><div class="sl">לחות</div></span></div>
    <div class="sens"><span class="ring">${I('motion')}</span><span><div class="sv" style="font-size:16px">אין תנועה</div><div class="sl">לפני <span class="num">12</span> דק׳</div></span></div>
    <div class="sens"><span class="ring">${I('door')}</span><span><div class="sv" style="font-size:16px">סגורה</div><div class="sl">דלת מרפסת</div></span></div>
  </div><button class="btn ghost sm" style="margin-top:8px;width:100%">${I('chevron', { cls: 'faint' })}עוד <span class="num">2</span> חיישנים</button>` });
  const empties = `<div class="empties"><span>ללא התקנים באזור:</span><span class="chip ghost">${I('play')}מדיה</span><span class="chip ghost">${I('droplet')}השקיה</span><span class="chip ghost">${I('door')}שערים</span></div>`;

  // 4 columns: [lighting ×2][climate, tall][switches] / [sensors][covers + screens][climate][security]
  const grid = phone
    ? `${lighting}${climate}${switches}${covers}${screens}${security}${sensors}`
    : `${lighting}${climate}${switches}${sensors}<div class="dcol">${covers}${screens}</div>${security}`;
  return `<div class="page area${ro ? ' ro' : ''}">${head}<div class="domains">${grid}</div>${empties}</div>`;
}

export function areaBoard({ scheme, phone, dir = 'rtl', fontPrefix = defaultFontPrefix }) {
  return doc({
    title: `Arx · אזור · ${phone ? 390 : 1440} · ${scheme}${dir === 'ltr' ? ' · LTR' : ''}`, scheme, dir, css: areaCss, fontPrefix,
    body: shell({ active: 'home', phone, content: areaContent({ phone }) }),
    label: `area · ${phone ? '390×844' : '1440×900'} · ${scheme}${dir === 'ltr' ? ' · ltr mirror' : ''}`,
  });
}

// ---------- AREA · list view: devices as rows grouped by domain ----------
export function areaListContent({ phone = false } = {}) {
  const group = (ic, role, title, n, bulk) => `<div class="lgroup"><span class="dbadge" style="--role:var(--sw-role-${role});--role-fg:var(--sw-role-${role}-fg);width:28px;height:28px;border-radius:8px">${I(ic, { size: 16 })}</span>${title}<span class="count"><span class="num">${n}</span> התקנים</span>${bulk ? `<span class="act">${offAll(bulk)}</span>` : ''}</div>`;
  const row = ({ name, state, ic, on, kind = '', unavail, fact: f = '', ctl = '' }) => `<div class="lrow${on ? ` on ${kind}` : ''}${unavail ? ' unavail' : ''}"><span class="lname"><span class="ring">${I(ic)}</span><span>${name}</span></span><span class="lc${on ? ' on' : ''}"><b>${state}</b></span><span class="lc ph-hide">${f}</span><span class="ctl">${ctl}</span></div>`;
  const head = `<div class="lhead"><span>התקן</span><span>מצב</span><span>פרטים</span><span></span></div>`;
  const body = `
    ${group('bulb', 'warm', 'תאורה', 6, 'כבה הכל')}
    ${DEV.lights.map((d) => row({ ...d, fact: d.on ? `בהירות <span class="num">${d.pct}%</span>` : '—', ctl: tg(!!d.on) })).join('')}
    ${group('wave', 'warm', 'מיזוג', 1, 'כבה הכל')}
    ${row({ name: 'מזגן סלון', state: 'קירור · יעד 23°', ic: 'wave', on: true, kind: 'warm', fact: `כעת <span class="num">24.5°</span> · מאוורר בינוני`, ctl: `<span class="stepper"><button class="btn" aria-label="הנמך">${I('minus')}</button><span class="val num">23°</span><button class="btn" aria-label="הגבה">${I('plus')}</button></span>${tg(true)}` })}
    ${group('bolt', 'success', 'מתגים', 3, 'כבה הכל')}
    ${DEV.switches.map((d) => row({ ...d, fact: d.unavail ? 'אין תקשורת · <span class="num">14</span> דק׳' : '—', ctl: tg(!!d.on, d.unavail ? ' disabled' : '') })).join('')}
    ${group('layers', 'accent', 'תריסים', 2, 'סגור הכל')}
    ${DEV.covers.map((d) => row({ ...d, fact: `מיקום <span class="num">${d.pct}%</span>`, ctl: coverCtl(!d.on) })).join('')}
    ${group('shield', 'success', 'אבטחה', 3)}
    ${row({ name: 'דלת מרפסת', state: 'נעול', ic: 'lock', fact: 'ננעל <span class="num">07:40</span>', ctl: `<button class="btn secondary sm">${I('unlock')}פתח</button>` })}
    ${row({ name: 'מגע דלת כניסה', state: 'סגורה', ic: 'door', fact: 'שינוי אחרון <span class="num">12:15</span>', ctl: '<span class="badge live"><span class="dot"></span>סגורה</span>' })}
    ${row({ name: 'מצלמת סלון', state: 'חי', ic: 'camera', fact: 'צילום לפני <span class="num">1</span> דק׳', ctl: `<button class="btn ghost icon" aria-label="צפה">${I('play')}</button>` })}
    ${group('monitor', 'cool', 'מסכים', 1, 'כבה הכל')}
    ${row({ name: 'טלוויזיה סלון', state: 'כבוי', ic: 'monitor', fact: '—', ctl: tg(false) })}
    ${group('sensor', 'neutral', 'חיישנים', 6)}
    ${row({ name: 'טמפרטורה', state: '<span class="num">24.5°</span>', ic: 'thermo', fact: 'לפני <span class="num">2</span> דק׳' })}
    ${row({ name: 'לחות', state: '<span class="num">48%</span>', ic: 'droplet', fact: 'לפני <span class="num">2</span> דק׳' })}
    ${row({ name: 'תנועה', state: 'אין תנועה', ic: 'motion', fact: 'לפני <span class="num">12</span> דק׳' })}
    ${row({ name: 'דלת מרפסת', state: 'סגורה', ic: 'door', fact: '—' })}
    <div class="lrow" style="grid-template-columns:1fr"><button class="btn ghost sm" style="justify-self:start">${I('chevron', { cls: 'faint' })}עוד <span class="num">2</span> חיישנים</button></div>`;
  return `<div class="page area">${areaHead({ phone, view: 'list' })}<section class="glass ltable devices">${head}${body}</section></div>`;
}

export function areaListBoard({ scheme, phone }) {
  return doc({
    title: `Arx · אזור · רשימה · ${phone ? 390 : 1440} · ${scheme}`, scheme, css: areaCss + listCss,
    body: shell({ active: 'home', phone, content: areaListContent({ phone }) }),
    label: `area-list · ${phone ? '390×844' : '1440×900'} · ${scheme}`,
  });
}

// ---------- LIVE WALL ----------
const wallCss = `
.page.wall{gap:12px;padding-block-end:18px}
.wall .sections{display:flex;align-items:center;gap:14px}
.wall .toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wall .toolbar .faint{font-size:var(--sw-fs-sm)}
.wall .grid{flex:1;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;gap:8px;min-height:0}
.wall .wfacts{font-size:var(--sw-fs-sm);color:var(--sw-text-3);display:flex;gap:6px;flex-wrap:wrap}
.seg.count>*{min-width:36px;justify-content:center;padding:0 8px}
@media (max-width:767px){
  .wall .sections{flex-direction:column;align-items:stretch;gap:6px}
  .wall .grid{grid-template-columns:1fr 1fr;grid-auto-rows:auto}
  .wall .cam{aspect-ratio:16/9}
  .segwrap{overflow:hidden;position:relative;margin-inline:-16px;padding-inline:16px}
  .segwrap::after{content:"";position:absolute;inset-block:0;inset-inline-end:0;width:40px;background:linear-gradient(to right,var(--sw-bg),transparent);pointer-events:none}
  .segwrap .seg{flex-wrap:nowrap}
}`;

const CAMS = [
  ['כניסה ראשית', 'live', 's1', 'לובי'], ['לובי', 'live', 's2', 'לובי'], ['חניון', 'live', 's3', 'חניון'], ['מסדרון קומה 1', 'live', 's5', 'קומה 1'],
  ['חצר אחורית', 'live', 's6', 'חוץ'], ['מחסן', 'snapshot', 's2', 'מרתף'], ['גג', 'live', 's1', 'חוץ'], ['מעלית', 'offline', '', 'לובי'],
  ['מטבח', 'live', 's4', 'מטבח'], ['כניסת עובדים', 'live', 's3', 'חוץ'], ['שער', 'forbidden', '', 'חוץ'], ['אולם', 'live', 's5', 'קרקע'],
  ['חדר מכונות', 'snapshot', 's2', 'מרתף'], ['מרפסת', 'live', 's6', 'סלון'], ['חדר ישיבות', 'live', 's4', 'קומה 1'], ['כניסה צדדית', 'live', 's1', 'חוץ'],
];
export function camTile([name, st, scene], opts = {}) {
  if (st === 'live') return `<div class="cam live${opts.sel ? ' selected' : ''}"><div class="scene ${scene}"></div><span class="tag badge live"><span class="dot"></span>חי</span><div class="nm"><span class="dot live"></span>${name}</div></div>`;
  if (st === 'snapshot') return `<div class="cam snapshot"><div class="scene ${scene}"></div><span class="tag badge image">${I('snapshot')}צילום</span><div class="nm"><span class="dot live"></span>${name}</div></div>`;
  if (st === 'offline') return `<div class="cam offline">${I('wifiOff', { cls: 'big' })}<div class="st">מנותקת</div><div class="rs">אין תגובה · <span class="num">4</span> דק׳</div><div class="nm plain"><span class="dot"></span>${name}</div></div>`;
  if (st === 'connecting') return `<div class="cam connecting">${I('loader', { cls: 'big spin' })}<div class="st">מתחברת…</div><div class="nm plain"><span class="dot unknown"></span>${name}</div></div>`;
  if (st === 'unknown') return `<div class="cam unknown">${I('info', { cls: 'big' })}<div class="st">לא ידוע</div><div class="rs">אין דיווח מצב</div><div class="nm plain"><span class="dot unknown"></span>${name}</div></div>`;
  if (st === 'stale') return `<div class="cam snapshot"><div class="scene ${scene || 's3'}" style="filter:grayscale(.6)"></div><span class="tag badge stale"><span class="dot"></span>לא מעודכן · <span class="num">3</span> דק׳</span><div class="nm"><span class="dot stale"></span>${name}</div></div>`;
  return `<div class="cam forbidden">${I('eyeOff', { cls: 'big' })}<div class="st">אין הרשאה</div><div class="nm plain"><span class="dot forbidden"></span>${name}</div></div>`;
}

function wallHead({ phone, view }) {
  const counts = [1, 2, 4, 6, 8, 9, 12, 16, 20, 25, 32];
  const sections = `<div class="seg lg" role="tablist"><button class="on">${I('camera')}לייב</button><button>${I('clockHistory')}חקירה</button><button>${I('siren')}אזעקה</button></div>`;
  const tabs = `<div class="tabs${phone ? ' underline' : ''}" role="tablist"><span class="tab">תמונת מצב</span><span class="tab on">כל המצלמות</span><span class="tab">תצוגות שמורות</span></div>`;
  const countSeg = `<div class="seg count" role="radiogroup" aria-label="כמות">${counts.map((n) => `<button class="num${n === 16 ? ' on' : ''}">${n}</button>`).join('')}</div>`;
  const cols = `<div class="row" style="gap:6px"><span class="faint">עמודות</span><div class="seg count"><button class="on">אוטו</button>${[1, 2, 3, 4, 5, 6].map((n) => `<button class="num">${n}</button>`).join('')}</div></div>`;
  const vs = viewSeg(view, ['gridv', 'list']);
  return `<div class="sections">${sections}${tabs}</div>
  <header class="head"><div><h1 class="h1">כל המצלמות</h1><div class="sub"><span class="num">16</span> מצלמות · <span class="num">12</span> חי</div></div>
    ${phone ? '' : `<div class="toolbar">${vs}<span class="select">איכות: ברירת מחדל ${I('chevron')}</span>${view === 'gridv' ? countSeg + cols : ''}<button class="btn secondary">${I('expand')}קיוסק</button></div>`}
  </header>
  ${phone ? `<div class="toolbar">${vs}<button class="btn secondary" style="height:40px">${I('expand')}קיוסק</button></div>${view === 'gridv' ? `<div class="segwrap">${countSeg}</div>` : ''}` : ''}`;
}

export function wallContent({ phone = false } = {}) {
  return `<div class="page wall">${wallHead({ phone, view: 'gridv' })}
  <div class="grid">${CAMS.map((c) => camTile(c)).join('')}</div>
  <div class="wfacts"><span><span class="num">12</span> חי</span>·<span><span class="num">2</span> צילום</span>·<span><span class="num">1</span> מנותקת</span>·<span><span class="num">1</span> ללא הרשאה</span>·<span>צילומים מתרעננים כל דקה</span></div>
</div>`;
}

export function wallBoard({ scheme, phone }) {
  return doc({
    title: `Arx · קיר מצלמות · ${phone ? 390 : 1440} · ${scheme}`, scheme, css: wallCss,
    body: shell({ active: 'security', phone, content: wallContent({ phone }) }),
    label: `wall · ${phone ? '390×844' : '1440×900'} · ${scheme}`,
  });
}

// ---------- WALL · list view: cameras as a table ----------
export function wallListContent({ phone = false } = {}) {
  const badge = { live: ['live', 'חי'], snapshot: ['recorded', 'צילום'], offline: ['offline', 'מנותקת'], forbidden: ['forbidden', 'אין הרשאה'] };
  const head = `<div class="lhead"><span>מצלמה</span><span>אזור</span><span>מצב</span><span>איכות</span><span>רזולוציה</span><span>צילום אחרון</span><span></span></div>`;
  const rows = CAMS.map(([name, st, scene, area], i) => {
    const [b, t] = badge[st];
    const thumb = st === 'live' || st === 'snapshot' ? `<span class="thumb"><span class="scene ${scene}"></span></span>` : `<span class="thumb" style="display:grid;place-items:center;background:var(--sw-surface-3-solid);color:var(--sw-text-3)${st === 'offline' ? ';border:1.5px dashed var(--sw-border-strong)' : ''}">${I(st === 'offline' ? 'wifiOff' : 'eyeOff', { size: 16 })}</span>`;
    return `<div class="lrow${st === 'offline' ? ' unavail' : ''}"><span class="lname">${thumb}<span>${name}</span></span>
      <span class="lc ph-hide">${area}</span><span class="lc"><span class="badge ${b}"><span class="dot"></span>${t}</span></span>
      <span class="lc ph-hide">${st === 'live' ? (i % 3 ? 'רגילה' : 'גבוהה') : st === 'snapshot' ? 'צילום' : '—'}</span>
      <span class="lc ph-hide">${st === 'live' || st === 'snapshot' ? `<span class="mono">${i % 3 ? '1920×1080' : '2560×1440'}</span>` : '—'}</span>
      <span class="lc ph-hide">${st === 'forbidden' ? '—' : `<span class="num">15:3${i % 4}</span>`}</span>
      <span class="lact"><button class="btn ghost icon${st === 'live' ? '' : ' disabled'}" aria-label="צפה">${I('play')}</button><button class="btn ghost icon ph-hide" aria-label="הרחב">${I('expand')}</button></span></div>`;
  }).join('');
  return `<div class="page wall">${wallHead({ phone, view: 'list' })}<section class="glass ltable cams">${head}${rows}</section>
  <div class="wfacts"><span><span class="num">12</span> חי</span>·<span><span class="num">2</span> צילום</span>·<span><span class="num">1</span> מנותקת</span>·<span><span class="num">1</span> ללא הרשאה</span></div></div>`;
}

export function wallListBoard({ scheme, phone }) {
  return doc({
    title: `Arx · קיר מצלמות · רשימה · ${phone ? 390 : 1440} · ${scheme}`, scheme, css: wallCss + listCss,
    body: shell({ active: 'security', phone, content: wallListContent({ phone }) }),
    label: `wall-list · ${phone ? '390×844' : '1440×900'} · ${scheme}`,
  });
}

// area tile (compact tiles view) — kept as a component for the sheet and the "אריחים" option
export function areaTile({ name, ic = 'home', on, c }) {
  return `<a class="atile lift${on ? ' on' : ''}" href="#"><span class="dbadge">${I(ic)}</span><span class="an">${name}${on ? '<span class="dot on"></span>' : ''}</span><span class="ac">${c.map(([i, n]) => `<span>${I(i)}<span class="num">${n}</span></span>`).join('')}</span><span class="dots">${I('dots', { size: 16 })}</span></a>`;
}
export function kpi({ ic, v, l, d, tone = '' }) {
  return `<button class="kpi ${tone}"><span class="ring">${I(ic)}</span><span class="tbody"><span class="kv num">${v}</span><div class="kl">${l}</div>${d ? `<div class="kd">${d}</div>` : ''}</span></button>`;
}

export { areaCss, homeCss, wallCss, listCss, tile, tg, offAll, slider, fbtn, viewSeg };
