import { icon as I } from './icons.mjs';
import { fontFace, tokensCss, baseCss, phoneCss } from './css.mjs';

// ---------- document + shell ----------
export function doc({ title, scheme = 'light', dir = 'rtl', body, css = '', label = '', width }) {
  return `<!doctype html>
<html lang="he" dir="${dir}" data-scheme="${scheme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${fontFace}${tokensCss}${baseCss}${phoneCss}${css}</style>
</head>
<body class="canvas"${width ? ` style="width:${width}px"` : ''}>
${body}
${label ? `<div class="board-label">${label}</div>` : ''}
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
const chevBack = `<button class="btn icon ghost sm" aria-label="חזרה">${I('chevron', { mirror: true })}</button>`;
const tg = (on, extra = '') => `<span class="tg small${on ? ' on' : ''}${extra}" role="switch" aria-checked="${on}"><span class="tr"></span></span>`;
const offAll = (label = 'כבה הכל') => `<button class="btn ghost sm">${I('power')}${label}</button>`;

// ---------- HOME ----------
const homeCss = `
.widgets{display:grid;grid-template-columns:1.15fr 1.5fr 1.1fr 1fr 1.05fr;gap:14px}
.widget{padding:12px 16px;display:flex;flex-direction:column;gap:4px;min-height:118px}
.widget.alarm .word{font-size:22px;font-weight:var(--sw-fw-bold);color:var(--sw-heading);letter-spacing:-.3px}
.widget.quick{gap:8px;justify-content:center}
.kpis{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}
.kpis .kpi{background:var(--sw-surface);border-radius:var(--sw-r-md);min-height:60px;padding:8px 14px}
.tree-panel .tree .trow{min-height:30px;font-size:13px}
.tree-panel .tree .trow.floor{margin-top:4px}
.atile{min-height:84px}
.page.home{gap:12px;padding-block-start:16px;padding-block-end:20px}
.page.home .widget{min-height:112px}
.strip{display:flex;gap:8px;overflow:hidden;position:relative;align-items:center}
.strip .lbl{font-size:var(--sw-fs-sm);color:var(--sw-text-3);white-space:nowrap;margin-inline-end:4px}
.strip::after{content:"";position:absolute;inset:0 auto 0 0;width:56px;background:linear-gradient(to right,var(--sw-bg),transparent);pointer-events:none}
.main{display:grid;grid-template-columns:270px 1fr;gap:16px;align-items:start}
.floors{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.floor{padding:14px}
.floor .fh{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.floor .fh .sec-title{flex:1}
.atiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.unassigned{grid-column:1 / -1;display:flex;align-items:center;gap:12px;padding:12px 16px}
@media (max-width:767px){
  .widgets{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;margin-inline:-16px;padding-inline:16px;scrollbar-width:none}
  .widget{flex:0 0 78%;scroll-snap-align:start;min-height:128px}
  .widget.quick{flex-basis:60%}
  .kpis{grid-template-columns:1fr 1fr;gap:8px}
  .kpis .kpi:last-child{grid-column:1 / -1}
  .strip{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-16px;padding-inline:16px}.strip::after{inset-inline-start:0}
  .main{grid-template-columns:1fr}
  .tree-panel{display:none}
  .floors{grid-template-columns:1fr}
  .atiles{grid-template-columns:1fr 1fr}
}`;

function kpi({ ic, v, l, d, tone = '' }) {
  return `<button class="kpi ${tone}"><span class="ring">${I(ic)}</span><span class="tbody"><span class="kv num">${v}</span><div class="kl">${l}</div>${d ? `<div class="kd">${d}</div>` : ''}</span></button>`;
}
function areaTile({ name, ic = 'home', on, c }) {
  return `<a class="atile lift${on ? ' on' : ''}" href="#"><span class="dbadge">${I(ic)}</span><span class="an">${name}${on ? '<span class="dot on"></span>' : ''}</span><span class="ac">${c.map(([i, n]) => `<span>${I(i)}<span class="num">${n}</span></span>`).join('')}</span><span class="dots">${I('dots', { size: 16 })}</span></a>`;
}
function floorCard({ name, lit, tiles, bulk = true }) {
  return `<section class="glass floor"><div class="fh"><h3 class="sec-title">${name}</h3><span class="chip warm" style="height:26px">${I('bulb')}<span class="num">${lit}</span></span>${bulk ? `<button class="btn ghost sm icon" aria-label="כבה קומה">${I('power')}</button>` : ''}</div><div class="atiles">${tiles.map(areaTile).join('')}</div></section>`;
}

export function homeContent({ phone = false } = {}) {
  const climate = ['לובי', 'סלון', 'משרד', 'מטבח', 'מחסן', 'חניון', 'חדר ילדים', 'חדר שינה'];
  return `<div class="page home">
  <header class="head"><div><h1 class="h1">הבית של רון</h1><div class="sub">3 קומות · 8 אזורים · <span class="num">111</span> התקנים</div></div></header>
  <section class="widgets">
    <div class="glass widget"><div class="wlabel">${I('clock')}שעה</div><div class="reading num">15:33<small>38</small></div><div class="muted" style="margin-top:auto">יום רביעי · 30 בספטמבר<br><span class="faint">כ״ט באלול התשפ״ו</span></div></div>
    <div class="glass widget"><div class="wlabel">${I('cloudSun')}מזג אוויר</div><div class="row" style="gap:12px"><span class="reading num" style="font-size:44px">28°</span><span>${I('cloudSun', { size: 34 })}<div class="muted">מעונן חלקית</div></span><span class="faint" style="margin-inline-start:auto;font-size:var(--sw-fs-sm);text-align:end">לחות <span class="num">61%</span><br>רוח <span class="num">14</span> קמ״ש</span></div>
      <div class="forecast">${[['14:00', 'sun', '29°'], ['15:00', 'cloudSun', '28°'], ['16:00', 'cloud', '27°'], ['17:00', 'rain', '26°'], ['18:00', 'rain', '25°']].map(([h, i, t]) => `<div><span class="num">${h}</span>${I(i)}<b class="num">${t}</b></div>`).join('')}</div></div>
    <div class="glass widget"><div class="wlabel">${I('star')}שבת</div><div class="h2" style="font-size:22px">פרשת בראשית</div><div class="muted" style="margin-top:auto;display:grid;gap:2px"><span>${I('candle', { size: 15 })} הדלקת נרות <b class="num">17:32</b></span><span>${I('moon', { size: 15 })} צאת שבת <b class="num">18:30</b></span></div></div>
    <div class="glass widget alarm"><div class="wlabel">${I('shield')}אזעקה</div><div class="row" style="gap:10px"><span class="ring" style="background:var(--sw-live-soft);color:var(--sw-live)">${I('shield')}</span><span class="word">דרוכה (חוץ)</span></div><div class="row" style="margin-top:auto;gap:6px"><span class="chip" style="height:26px;font-size:11.5px">קומת כניסה</span><span class="chip" style="height:26px;font-size:11.5px">חוץ</span></div></div>
    <div class="glass widget quick"><div class="wlabel">${I('bolt')}פעולות מהירות</div><button class="btn danger lg">${I('power')}כבה הכל בבניין</button><button class="btn secondary lg">${I('bulb')}כבה תאורה בלבד</button></div>
  </section>
  <section class="kpis">
    ${kpi({ ic: 'bulb', v: '16/48', l: 'תאורה דולקת', tone: 'warm' })}
    ${kpi({ ic: 'bolt', v: '0/32', l: 'מתגים פעילים' })}
    ${kpi({ ic: 'layers', v: '8/16', l: 'תריסים פתוחים', tone: 'accent' })}
    ${kpi({ ic: 'wave', v: '8/8', l: 'מיזוג פעיל', tone: 'cool' })}
    ${kpi({ ic: 'monitor', v: '1/1', l: 'מסכים דולקים', tone: 'accent' })}
    ${kpi({ ic: 'lock', v: '1/1', l: 'מנעולים נעולים', d: 'הכול נעול', tone: 'live' })}
    ${kpi({ ic: 'shield', v: 'דרוכה', l: 'אזעקה · חוץ', tone: 'live' })}
  </section>
  <div class="strip"><span class="lbl">מזגנים בבניין</span>${climate.map((n) => `<span class="chip warm">${I('wave')}מזגן ${n} · קירור · <span class="num">22°</span></span>`).join('')}</div>
  <div class="row between"><div class="seg" role="tablist"><button class="on">${I('grid')}אריחים</button><button>${I('cards')}כרטיסים</button></div>${phone ? '' : `<div class="row" style="gap:6px"><span class="faint" style="font-size:var(--sw-fs-sm)">קומה</span><div class="seg"><button class="on">כל המבנה</button><button>קרקע</button><button>קומה 1</button><button>מרתף</button></div></div>`}</div>
  <section class="main">
    <aside class="glass card tree-panel" style="padding:12px"><div class="tree">
      <div class="trow sel">${I('building')}כל המבנה<span class="lit on">${I('bulb')}<span class="num">16</span></span></div>
      <div class="trow floor">${I('layers')}קרקע<span class="lit on">${I('bulb')}<span class="num">6</span></span></div>
      <div class="trow area">לובי<span class="lit on"><span class="num">2</span></span></div><div class="trow area">סלון<span class="lit on"><span class="num">4</span></span></div><div class="trow area">מטבח<span class="lit"><span class="num">0</span></span></div><div class="trow area">מחסן<span class="lit"><span class="num">0</span></span></div><div class="trow area">חניון<span class="lit"><span class="num">0</span></span></div>
      <div class="trow floor">${I('layers')}קומה 1<span class="lit on">${I('bulb')}<span class="num">10</span></span></div>
      <div class="trow area">משרד<span class="lit"><span class="num">0</span></span></div><div class="trow area">חדר שינה הורים<span class="lit on"><span class="num">4</span></span></div><div class="trow area">חדר ילדים<span class="lit on"><span class="num">6</span></span></div>
      <div class="trow floor">${I('layers')}מרתף<span class="lit">${I('bulb')}<span class="num">0</span></span></div>
    </div></aside>
    <div class="floors">
      ${floorCard({ name: 'קרקע', lit: '6/18', tiles: [
        { name: 'לובי', ic: 'door', on: true, c: [['bulb', '2/6'], ['layers', '1/2'], ['lock', '1/1']] },
        { name: 'סלון', ic: 'home', on: true, c: [['bulb', '4/6'], ['wave', '1/1'], ['monitor', '1/1']] },
        { name: 'מטבח', ic: 'home', c: [['bulb', '0/4'], ['bolt', '0/2']] },
        { name: 'חניון', ic: 'camera', c: [['bulb', '0/2'], ['camera', '2']] },
      ] })}
      ${floorCard({ name: 'קומה 1', lit: '10/18', tiles: [
        { name: 'חדר ילדים', ic: 'home', on: true, c: [['bulb', '6/6'], ['wave', '1/1']] },
        { name: 'חדר שינה הורים', ic: 'moon', on: true, c: [['bulb', '4/6'], ['layers', '2/2']] },
        { name: 'משרד', ic: 'monitor', c: [['bulb', '0/6'], ['bolt', '0/2']] },
      ] })}
      ${floorCard({ name: 'מרתף', lit: '0/12', tiles: [
        { name: 'חדר מכונות', ic: 'settings', c: [['bulb', '0/4'], ['sensor', '3']] },
        { name: 'מחסן', ic: 'layers', c: [['bulb', '0/8']] },
      ] })}
      <a class="glass unassigned lift" href="#"><span class="dbadge" style="--role:var(--sw-role-neutral);--role-fg:var(--sw-role-neutral-fg)">${I('inbox')}</span><span class="grow"><b>ללא שיוך</b><div class="muted" style="font-size:var(--sw-fs-sm)"><span class="num">4</span> התקנים</div></span>${I('chevron', { mirror: true, cls: 'faint' })}</a>
    </div>
  </section>
</div>`;
}

export function homeBoard({ scheme, phone }) {
  return doc({
    title: `Arx · הבית · ${phone ? 390 : 1440} · ${scheme}`, scheme, css: homeCss,
    body: shell({ active: 'home', phone, content: homeContent({ phone }) }),
    label: `home · ${phone ? '390×844' : '1440×900'} · ${scheme}`,
  });
}

// ---------- AREA ----------
const areaCss = `
.domains{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:start}
.dcol{display:flex;flex-direction:column;gap:14px}
.dcard{padding:14px}
.dcard .card-head{margin-bottom:10px}
.tiles2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tiles1{display:grid;gap:8px}
.climate{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--sw-r-md);background:var(--sw-surface-2);border:1px solid var(--sw-border)}
.climate .big{display:flex;align-items:center;justify-content:space-between;gap:10px}
.climate .temp{font-size:44px;font-weight:var(--sw-fw-medium);letter-spacing:-1.5px;line-height:1;color:var(--sw-heading);font-variant-numeric:tabular-nums}
.climate .temp small{font-size:14px;letter-spacing:0;color:var(--sw-text-2);font-weight:var(--sw-fw-regular)}
.climate .seg{align-self:stretch;display:flex} .climate .seg>*{flex:1;justify-content:center;padding:0 8px}
.snap{position:relative;height:120px;border-radius:var(--sw-r-md);overflow:hidden;border:1px solid var(--sw-border);color:#fff}
.snap .nm{position:absolute;inset-inline:0;bottom:0;padding:18px 10px 8px;font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-semibold);background:linear-gradient(to top,rgba(4,8,16,.75),transparent);display:flex;align-items:center;gap:6px}
.snap .tag{position:absolute;top:8px;inset-inline-start:8px}
.snap .exp{position:absolute;top:6px;inset-inline-end:6px;width:32px;height:32px;border-radius:50%;background:rgba(8,12,20,.6);color:#fff;display:grid;place-items:center}
.sens2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ro .tctl,.ro .slider,.ro .bar-ind,.ro .offall,.ro .stepper,.ro .cover-ctl,.ro .climate .seg,.ro .master{display:none!important}
.ro .tile.col .tbody{flex:1}
@media (max-width:767px){.domains{grid-template-columns:1fr}.tiles2{grid-template-columns:1fr}.sens2{grid-template-columns:1fr 1fr}}
`;

function tile({ name, state, ic, on, kind = '', unavail, ctl = '', extra = '', col }) {
  const cls = ['tile', on ? `on ${kind}` : '', unavail ? 'unavail' : '', col ? 'col' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"${unavail ? ' title="אין תקשורת עם ההתקן"' : ''}><span class="ring">${I(ic)}</span><span class="tbody"><div class="tname">${name}</div><div class="tstate">${state}</div></span><span class="tctl">${ctl}</span>${extra}</div>`;
}
const slider = (pct) => `<div class="slider"><div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="thumb" style="inset-inline-start:${pct}%"></span></div>`;
function domainCard({ title, count, ic, role, body, bulk = true, bulkLabel = 'כבה הכל', ro }) {
  return `<section class="glass dcard"><div class="card-head"><span class="dbadge" style="--role:var(--sw-role-${role});--role-fg:var(--sw-role-${role}-fg)">${I(ic)}</span><h3 class="sec-title">${title} <span class="count">${count}</span></h3>${bulk && !ro ? `<span class="offall">${offAll(bulkLabel)}</span>` : ''}</div>${body}</section>`;
}

export function areaContent({ phone = false, state = 'ready' } = {}) {
  const ro = state === 'readonly';
  const un = state === 'unavailable';
  const head = `<div class="crumbs"><span>ראשי</span>${I('chevron', { mirror: true })}<span>קומה 1</span></div>
  <header class="head"><div class="row" style="gap:8px;align-items:center">${chevBack}<div><h1 class="h1">סלון</h1><div class="sub"><span class="num">13</span> התקנים · <span class="num">5</span> פעילים</div></div></div></header>
  <div class="tabs fade" role="tablist"><span class="tab on">סלון <span class="n">13</span></span><span class="tab">מטבח <span class="n">8</span></span><span class="tab">חדר ילדים <span class="n">6</span></span><span class="tab">חדר שינה הורים <span class="n">7</span></span><span class="tab">משרד <span class="n">5</span></span><span class="tab">מחסן <span class="n">0</span></span></div>`;

  if (state === 'loading') {
    return `<div class="page">${head}<div class="domains">${[0, 1, 2].map(() => `<section class="glass dcard"><div class="row" style="gap:10px;margin-bottom:12px"><span class="skeleton" style="width:36px;height:36px;border-radius:12px"></span><span class="skeleton" style="width:120px;height:16px"></span></div><div class="tiles1">${[0, 1, 2].map(() => `<span class="skeleton" style="height:56px;border-radius:16px"></span>`).join('')}</div></section>`).join('')}</div></div>`;
  }
  if (state === 'empty') {
    return `<div class="page">${head}<section class="glass"><div class="state"><span class="sic">${I('inbox')}</span><div class="st">אין התקנים באזור הזה</div><div class="sh">התקנים שישויכו לאזור יופיעו כאן</div></div></section></div>`;
  }
  if (state === 'error') {
    return `<div class="page">${head}<section class="glass"><div class="state error"><span class="sic">${I('alert')}</span><div class="st">לא ניתן לטעון את האזור</div><div class="sh">תשתית המערכת לא הגיבה</div><button class="btn secondary" style="margin-top:6px">${I('refresh')}נסה שוב</button></div></section></div>`;
  }

  const lighting = domainCard({ title: 'תאורה', count: '2 מתוך 6', ic: 'bulb', role: 'warm', ro, body: `<div class="tiles2">
    ${tile({ name: 'ספוט סלון', state: 'דולק · 100%', ic: 'bulb', on: true, kind: 'cool', ctl: tg(true) })}
    ${tile({ name: 'תאורת תקרה', state: 'דולק · 60%', ic: 'bulb', on: true, kind: 'cool', ctl: tg(true), col: true, extra: slider(60) })}
    ${tile({ name: 'מנורת קריאה', state: 'כבוי', ic: 'bulb', ctl: tg(false) })}
    ${tile({ name: 'פס לד', state: 'כבוי', ic: 'bulb', ctl: tg(false) })}
    ${tile({ name: 'תאורת מרפסת', state: 'כבוי', ic: 'bulb', ctl: tg(false) })}
    ${tile({ name: 'מנורת פינה', state: 'כבוי', ic: 'bulb', ctl: tg(false) })}
  </div>` });
  const switches = domainCard({ title: 'מתגים', count: '1 מתוך 3', ic: 'bolt', role: 'success', ro, body: `<div class="tiles1">
    ${tile({ name: 'מערכת הגברה', state: 'פעיל', ic: 'bolt', on: true, kind: 'switch', ctl: tg(true) })}
    ${tile({ name: 'מאוורר תקרה', state: 'לא זמין', ic: 'fan', unavail: true, ctl: tg(false, ' disabled') })}
    ${tile({ name: 'שקע יציע', state: 'כבוי', ic: 'bolt', ctl: tg(false) })}
  </div>` });
  const covers = un
    ? `<section class="glass dcard"><div class="card-head"><span class="dbadge" style="--role:var(--sw-role-neutral);--role-fg:var(--sw-role-neutral-fg)">${I('layers')}</span><h3 class="sec-title">תריסים <span class="count">3</span></h3></div><div class="state compact stale" style="padding:8px 4px"><span class="sic">${I('wifiOff')}</span><div><div class="st" style="font-size:var(--sw-fs-md)">התחום לא זמין</div><div class="sh" style="font-size:var(--sw-fs-sm)">אין תקשורת עם בקר התריסים</div></div></div></section>`
    : domainCard({ title: 'תריסים', count: '1 מתוך 2', ic: 'layers', role: 'accent', ro, bulkLabel: 'סגור הכל', body: `<div class="tiles1">
    ${tile({ name: 'וילון סלון', state: 'פתוח · 60%', ic: 'layers', on: true, kind: 'warm', col: true, ctl: `<span class="cover-ctl"><button class="btn" aria-label="פתח">${I('up')}</button><button class="btn" aria-label="עצור">${I('stop')}</button><button class="btn" aria-label="סגור">${I('down')}</button></span>`, extra: `<span class="bar-ind"><i style="width:60%"></i></span>` })}
    ${tile({ name: 'תריס מרפסת', state: 'סגור', ic: 'layers', ctl: `<span class="cover-ctl"><button class="btn" aria-label="פתח">${I('up')}</button><button class="btn" aria-label="עצור">${I('stop')}</button><button class="btn on" aria-label="סגור">${I('down')}</button></span>` })}
  </div>` });
  const screens = domainCard({ title: 'מסכים', count: '0 מתוך 1', ic: 'monitor', role: 'cool', ro, body: `<div class="tiles1">${tile({ name: 'טלוויזיה סלון', state: 'כבוי', ic: 'monitor', ctl: tg(false) })}</div>` });
  const climate = domainCard({ title: 'מיזוג', count: '1 מתוך 1', ic: 'wave', role: 'warm', ro, body: `<div class="climate">
    <div class="big"><div><div class="tname" style="font-weight:600;color:var(--sw-heading)">מזגן סלון</div><div class="muted" style="font-size:var(--sw-fs-sm)">קירור · כעת <span class="num">24.5°</span></div></div><div class="temp num">23°<small> יעד</small></div></div>
    ${ro ? '' : `<div class="row between"><span class="stepper"><button class="btn" aria-label="הנמך">${I('minus')}</button><span class="val num">23°</span><button class="btn" aria-label="הגבה">${I('plus')}</button></span>${tg(true)}</div>`}
    <div class="seg"><button class="on">קירור</button><button>חימום</button><button>אוטו</button><button>מאוורר</button></div>
    <div class="seg"><button>נמוך</button><button class="on">בינוני</button><button>גבוה</button><button>אוטו</button></div>
  </div>` });
  const security = domainCard({ title: 'אבטחה', count: '3', ic: 'shield', role: 'success', bulk: false, body: `<div class="tiles1">
    ${tile({ name: 'דלת מרפסת', state: 'נעול', ic: 'lock', ctl: ro ? '' : `<button class="btn secondary sm">${I('unlock')}פתח</button>` })}
    ${tile({ name: 'מגע דלת כניסה', state: 'סגורה', ic: 'door', ctl: '<span class="badge live"><span class="dot"></span>סגורה</span>' })}
    <div class="snap"><div class="scene s4"></div><span class="tag badge image">${I('snapshot')}צילום</span><button class="exp" aria-label="הרחב">${I('expand', { size: 16 })}</button><div class="nm"><span class="dot live" style="border:1.5px solid rgba(255,255,255,.8)"></span>מצלמת סלון</div></div>
  </div>` });
  const sensors = domainCard({ title: 'חיישנים', count: '4 עיקריים · 6', ic: 'sensor', role: 'neutral', bulk: false, body: `<div class="sens2">
    <div class="sens"><span class="ring">${I('thermo')}</span><span><div class="sv num">24.5°</div><div class="sl">טמפרטורה</div></span></div>
    <div class="sens"><span class="ring">${I('droplet')}</span><span><div class="sv num">48%</div><div class="sl">לחות</div></span></div>
    <div class="sens"><span class="ring">${I('motion')}</span><span><div class="sv" style="font-size:16px">אין תנועה</div><div class="sl">תנועה · לפני <span class="num">12</span> דק׳</div></span></div>
    <div class="sens"><span class="ring">${I('door')}</span><span><div class="sv" style="font-size:16px">סגורה</div><div class="sl">דלת מרפסת</div></span></div>
  </div><button class="btn ghost sm" style="margin-top:8px;width:100%">${I('chevron', { cls: 'faint' })}עוד <span class="num">2</span> חיישנים</button>` });

  const cols = phone
    ? `<div class="dcol">${lighting}${climate}${switches}${covers}${security}${screens}${sensors}</div>`
    : `<div class="dcol">${lighting}${sensors}</div><div class="dcol">${switches}${covers}${screens}</div><div class="dcol">${climate}${security}</div>`;
  return `<div class="page${ro ? ' ro' : ''}">${head}<div class="domains">${cols}</div></div>`;
}

export function areaBoard({ scheme, phone }) {
  return doc({
    title: `Arx · אזור · ${phone ? 390 : 1440} · ${scheme}`, scheme, css: areaCss,
    body: shell({ active: 'home', phone, content: areaContent({ phone }) }),
    label: `area · ${phone ? '390×844' : '1440×900'} · ${scheme}`,
  });
}

// ---------- LIVE WALL ----------
const wallCss = `
.page.wall{gap:12px;padding-block-end:18px}
.wall .sections{display:flex;align-items:center;gap:14px}
.wall .toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wall .toolbar .faint{font-size:var(--sw-fs-sm)}
.wall .grid{flex:1;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;gap:8px;min-height:0}
.wall .facts{font-size:var(--sw-fs-sm);color:var(--sw-text-3);display:flex;gap:6px;flex-wrap:wrap}
.seg.count>*{min-width:36px;justify-content:center;padding:0 8px}
@media (max-width:767px){
  .wall .sections{flex-direction:column;align-items:stretch;gap:6px}
  .wall .grid{grid-template-columns:1fr 1fr;grid-auto-rows:auto}
  .wall .cam{aspect-ratio:16/9}
  .segwrap{overflow:hidden;position:relative;margin-inline:-16px;padding-inline:16px}
  .segwrap::after{content:"";position:absolute;inset:0 auto 0 0;width:40px;background:linear-gradient(to right,var(--sw-bg),transparent)}
  .segwrap .seg{flex-wrap:nowrap}
}`;

const CAMS = [
  ['כניסה ראשית', 'live', 's1'], ['לובי', 'live', 's2'], ['חניון', 'live', 's3'], ['מסדרון קומה 1', 'live', 's5'],
  ['חצר אחורית', 'live', 's6'], ['מחסן', 'snapshot', 's2'], ['גג', 'live', 's1'], ['מעלית', 'offline', ''],
  ['מטבח', 'live', 's4'], ['כניסת עובדים', 'live', 's3'], ['שער', 'forbidden', ''], ['אולם', 'live', 's5'],
  ['חדר מכונות', 'snapshot', 's2'], ['מרפסת', 'live', 's6'], ['חדר ישיבות', 'live', 's4'], ['כניסה צדדית', 'live', 's1'],
];
export function camTile([name, st, scene], opts = {}) {
  if (st === 'live') return `<div class="cam live${opts.sel ? ' selected' : ''}"><div class="scene ${scene}"></div><div class="nm"><span class="dot live"></span>${name}</div></div>`;
  if (st === 'snapshot') return `<div class="cam snapshot"><div class="scene ${scene}"></div><span class="tag badge image">${I('snapshot')}צילום</span><div class="nm"><span class="dot live"></span>${name}</div></div>`;
  if (st === 'offline') return `<div class="cam offline">${I('wifiOff', { cls: 'big' })}<div class="st">מנותקת</div><div class="rs">אין תגובה · <span class="num">4</span> דק׳</div><div class="nm plain"><span class="dot"></span>${name}</div></div>`;
  if (st === 'connecting') return `<div class="cam connecting">${I('loader', { cls: 'big spin' })}<div class="st">מתחברת…</div><div class="nm plain"><span class="dot unknown"></span>${name}</div></div>`;
  if (st === 'unknown') return `<div class="cam unknown">${I('info', { cls: 'big' })}<div class="st">לא ידוע</div><div class="rs">אין דיווח מצב</div><div class="nm plain"><span class="dot unknown"></span>${name}</div></div>`;
  if (st === 'stale') return `<div class="cam snapshot"><div class="scene ${scene || 's3'}" style="filter:grayscale(.6)"></div><span class="tag badge stale"><span class="dot"></span>לא מעודכן · <span class="num">3</span> דק׳</span><div class="nm"><span class="dot stale"></span>${name}</div></div>`;
  return `<div class="cam forbidden">${I('eyeOff', { cls: 'big' })}<div class="st">אין הרשאה</div><div class="nm plain"><span class="dot forbidden"></span>${name}</div></div>`;
}

export function wallContent({ phone = false } = {}) {
  const counts = [1, 2, 4, 6, 8, 9, 12, 16, 20, 25, 32];
  const sections = `<div class="seg lg" role="tablist"><button class="on">${I('camera')}לייב</button><button>${I('clockHistory')}חקירה</button><button>${I('siren')}אזעקה</button></div>`;
  const tabs = `<div class="tabs${phone ? ' underline' : ''}" role="tablist"><span class="tab">תמונת מצב</span><span class="tab on">כל המצלמות</span><span class="tab">תצוגות שמורות</span></div>`;
  const countSeg = `<div class="seg count" role="radiogroup" aria-label="כמות">${counts.map((n) => `<button class="num${n === 16 ? ' on' : ''}">${n}</button>`).join('')}</div>`;
  const cols = `<div class="row" style="gap:6px"><span class="faint">עמודות</span><div class="seg count"><button class="on">אוטו</button>${[1, 2, 3, 4, 5, 6].map((n) => `<button class="num">${n}</button>`).join('')}</div></div>`;
  return `<div class="page wall">
  <div class="sections">${sections}${tabs}</div>
  <header class="head"><div><h1 class="h1">כל המצלמות</h1><div class="sub"><span class="num">16</span> מצלמות</div></div>
    ${phone ? '' : `<div class="toolbar"><span class="select">איכות: ברירת מחדל ${I('chevron')}</span>${countSeg}${cols}<button class="btn secondary">${I('expand')}קיוסק</button></div>`}
  </header>
  ${phone ? `<div class="toolbar"><span class="select" style="height:40px">איכות: ברירת מחדל ${I('chevron')}</span><button class="btn secondary" style="height:40px">${I('expand')}קיוסק</button></div><div class="segwrap">${countSeg}</div>` : ''}
  <div class="grid">${CAMS.map((c) => camTile(c)).join('')}</div>
  <div class="facts"><span><span class="num">12</span> חי</span>·<span><span class="num">2</span> צילום</span>·<span><span class="num">1</span> מנותקת</span>·<span><span class="num">1</span> ללא הרשאה</span>·<span>תעבורה <span class="mono">MSE</span></span>·<span>מכסת זרמים <span class="num">16</span></span>·<span>צילומים מתרעננים כל דקה</span></div>
</div>`;
}

export function wallBoard({ scheme, phone }) {
  return doc({
    title: `Arx · קיר מצלמות · ${phone ? 390 : 1440} · ${scheme}`, scheme, css: wallCss,
    body: shell({ active: 'security', phone, content: wallContent({ phone }) }),
    label: `wall · ${phone ? '390×844' : '1440×900'} · ${scheme}`,
  });
}

export { areaCss, homeCss, wallCss, tile, tg, offAll, kpi, areaTile, slider };
