import{lH as c,E as _}from"./index-Cke5lP-r.js";const v=/^(\d{4})-(\d{2})$/;function h(e,r){const t=new Intl.DateTimeFormat("en-CA",{timeZone:r,year:"numeric",month:"2-digit"}).formatToParts(e),a=t.find(s=>s.type==="year")?.value??"1970",o=t.find(s=>s.type==="month")?.value??"01";return`${a}-${o}`}function j(e,r){return k(h(e,r),-1)}function k(e,r){const t=v.exec(e);if(!t)return e;const a=Number(t[1])*12+(Number(t[2])-1)+r;return`${String(Math.floor(a/12)).padStart(4,"0")}-${String(a%12+1).padStart(2,"0")}`}const F=(e,r,t)=>k(e,1)<=h(r,t);function C(e,r="he"){const t=v.exec(e);return t?new Intl.DateTimeFormat(r==="he"?"he-IL":"en-GB",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(Number(t[1]),Number(t[2])-1,15))):e}function S(e){if(!e||e<0)return"-";const r=Math.round(e);return`${Math.floor(r/60)}:${String(r%60).padStart(2,"0")}`}function M(e){const r=Math.max(0,Math.round(e));return`${Math.floor(r/60)}:${String(r%60).padStart(2,"0")}`}function d(e,r=0){return e==null||Number.isNaN(e)?"-":e.toLocaleString("en-US",{minimumFractionDigits:r,maximumFractionDigits:r})}function E(e,r){const t=new Date(e);if(Number.isNaN(t.getTime()))return"-";const a=new Intl.DateTimeFormat("en-GB",{timeZone:r,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:!1}).formatToParts(t),o=s=>a.find(i=>i.type===s)?.value??"";return`${o("day")}.${o("month")} ${o("hour").replace("24","00")}:${o("minute")}`}function O(e,r,t=!1){const a=new Date(e);return Number.isNaN(a.getTime())?"-":new Intl.DateTimeFormat("en-GB",{timeZone:r,hour:"2-digit",minute:"2-digit",second:t?"2-digit":void 0,hour12:!1}).formatToParts(a).filter(s=>s.type!=="literal"||s.value===":").map(s=>s.type==="hour"?s.value.replace("24","00"):s.value).join("")}function $(e,r){if(e==null)return"-";const t=`${Math.abs(e).toLocaleString("en-US",{maximumFractionDigits:1})}%`;return e===0?t:r==="he"?`${t}${e<0?"-":"+"}`:`${e<0?"-":"+"}${t}`}const I={not_permitted:"lock",switch_off:"power",module_off:"layers"};function L(e,r=e.lang){const t=e.data,a=[];if(t.energy?.available&&t.energy.total_kwh!==void 0){const o=t.energy.change_pct;a.push({id:"energy",label:"fEnergy",value:d(t.energy.total_kwh),unit:"kwh",note:o==null?void 0:$(o,r),tone:o==null?void 0:o>0?"up":o<0?"down":"muted"})}return t.tickets&&a.push({id:"tickets",label:"fTickets",value:d(t.tickets.opened),note:c("closedOf",{n:t.tickets.closed},r),tone:"muted"}),t.doors?.configured&&a.push({id:"doors",label:"fDoors",value:d(t.doors.total.unexplained),note:c("openings",void 0,r)+" "+d(t.doors.total.openings),tone:"muted"}),t.temperature&&a.push({id:"temp",label:"fTemp",value:d(t.temperature.alarms),tone:t.temperature.alarms?"up":"muted"}),a.length<4&&t.elevators&&a.push({id:"elevators",label:"fElevators",value:S(t.elevators.down_min),tone:"muted"}),a.length<4&&t.generator?.runs?a.push({id:"genRuns",label:"fGenRuns",value:d(t.generator.runs.runs),note:`${d(t.generator.runs.hours,1)} ${c("hoursShort",void 0,r)}`,tone:"muted"}):a.length<4&&t.generator&&a.push({id:"generator",label:"fGenerator",value:d(t.generator.total),tone:t.generator.critical?"up":"muted"}),a.length<4&&t.cameras&&a.push({id:"cameras",label:"fCameras",value:d(t.cameras.events),tone:"muted"}),a.slice(0,4)}function N(e,r){const t=new Set((r??[]).map(a=>a.section));return e.filter(a=>!t.has(a))}function A(e,r,t){return N(e,t).filter(a=>r.has(a))}function P(e){if(!e.sections.length)return!0;const r=e.data;return!(r.tickets&&r.tickets.opened+r.tickets.closed+r.tickets.open_end>0||r.energy?.available&&(r.energy.total_kwh??0)>0||r.elevators&&r.elevators.items.some(a=>a.has_data)||r.generator&&(r.generator.devices.length>0||(r.generator.runs?.devices.length??0)>0)||r.temperature&&r.temperature.units.length>0||r.doors?.configured&&r.doors.total.openings>0||r.cameras&&r.cameras.events>0||r.waste&&r.waste.minutes.empty_room+r.waste.minutes.after_hours+r.waste.anomalies>0)}const R=(e,r)=>{try{const t=JSON.parse(e??"null");if(Array.isArray(t)){const a=new Set(t.filter(o=>r.includes(o)));if(a.size)return a}}catch{}return new Set(r)};function B(e,r){const t=[];for(const a of e.doors)b(a,r)&&a.items.forEach((o,s)=>t.push({...o,door:a.name,doorKey:a.key,area:a.area,floor:a.floor,judgeable:a.judgeable,id:`${a.key}:${s}:${o.at}`}));return t.sort((a,o)=>a.at<o.at?1:a.at>o.at?-1:0)}function W(e,r){const t=e.doors.filter(i=>b(i,r)),a=i=>t.reduce((g,n)=>g+n[i],0),o=a("unexplained"),s=a("unverifiable");return{unexplained:o,unverifiable:s,explained:a("explained"),all:o+s}}const G=e=>e.configured&&e.doors.length>0;function H(e,r,t){const a=Math.max(1,t),o=e+a+r;return{start:e/o*100,width:Math.max(2,a/o*100),total:o}}const f=e=>e.reduce((r,t)=>r+(t.w??1),0),y="all",z="none",T=e=>`floor:${e}`,x=(e,r)=>`area:${e??""}|${r}`;function U(e,r=new Set,t=c("allBuilding"),a=c("noPlace")){if(!e.length)return[];const o=[{id:y,kind:"all",name:t,depth:0,count:f(e),dot:null}],s=[...new Set(e.filter(n=>n.floor).map(n=>n.floor))];for(const n of s){const l=e.filter(u=>u.floor===n),m=T(n);if(o.push({id:m,kind:"floor",name:n,depth:0,count:f(l),dot:null,open:!r.has(m)}),!r.has(m))for(const u of[...new Set(l.filter(w=>w.area).map(w=>w.area))])o.push({id:x(n,u),kind:"area",name:u,depth:1,count:f(l.filter(w=>w.area===u)),dot:null})}const i=e.filter(n=>!n.floor);for(const n of[...new Set(i.filter(l=>l.area).map(l=>l.area))])o.push({id:x(null,n),kind:"area",name:n,depth:0,count:f(i.filter(l=>l.area===n)),dot:null});const g=i.filter(n=>!n.area);return g.length&&o.push({id:z,kind:"none",name:a,depth:0,count:f(g),dot:null}),o}function b(e,r){return r===y?!0:r===z?!e.floor&&!e.area:r.startsWith("floor:")?e.floor===r.slice(6):r.startsWith("area:")?x(e.floor,e.area??"")===r:!0}const Z=(e,r)=>e.find(t=>t.id===r)?.name??c("allBuilding");function q(e,r,t){return t==="night"?[]:e.devices.items.filter(a=>b(a,r)&&(t==="all"||a.kind===t)).sort((a,o)=>o.minutes-a.minutes)}function K(e,r){const t=e.devices.items.filter(i=>b(i,r)),a=t.filter(i=>i.kind==="empty_room").length,o=t.filter(i=>i.kind==="after_hours").length,s=e.energy.items.length;return{all:a+o,empty_room:a,after_hours:o,night:s}}const J=e=>e==="climate"?"dom_climate":e==="fan"?"dom_fan":e==="switch"?"dom_switch":"dom_light";function V(e,r){if(!e)return{range:"7d"};const t=new Date(`${e}T00:00:00`).toISOString(),a=r?new Date(`${r}T23:59:59`).toISOString():void 0;return{range:"custom",from:t,...a?{to:a}:{}}}const p={before_s:{group:"doors",lo:5,hi:300},after_s:{group:"doors",lo:0,hi:120},min_open_s:{group:"doors",lo:0,hi:60},empty_after_min:{group:"waste",lo:5,hi:240},min_waste_min:{group:"waste",lo:5,hi:720},night_min_min:{group:"waste",lo:10,hi:720},energy_factor:{group:"waste",lo:1.1,hi:10},energy_min_kwh:{group:"waste",lo:.1,hi:1e3},baseline_weeks:{group:"waste",lo:2,hi:8},baseline_min_coverage:{group:"waste",lo:.5,hi:1},min_run_s:{group:"generator",lo:0,hi:3600}};function Y(e){const r={};for(const[t,a]of Object.entries(p))r[t]=String(e[a.group][t]);return{nums:r,nightFrom:e.waste.night_from,nightTo:e.waste.night_to,domains:[...e.waste.domains],pairs:e.doors.pairs.map(t=>({...t,rex_entity_ids:[...t.rex_entity_ids]}))}}function Q(e,r){const t={doors:{...r.doors,pairs:e.pairs},waste:{...r.waste,domains:e.domains,night_from:e.nightFrom,night_to:e.nightTo},generator:{...r.generator},report:r.report};for(const[a,o]of Object.entries(p)){const s=e.nums[a].trim().replace(",",".");t[o.group][a]=s===""?Number.NaN:Number(s)}return t}function X(e){const r=new Set;for(const t of e){const a=t.split(".")[1];a&&a in p&&p[a].group===t.split(".")[0]&&r.add(a)}return r}const ee=e=>c("fieldRange",{lo:p[e].lo,hi:p[e].hi}),re=(e,r)=>e.some(t=>t===r||t.startsWith(`${r}.`)||t.startsWith(`${r}[`)),te=_`
  :host {
    display: block;
    padding: 14px var(--sw-page-pad) 32px;
    max-inline-size: var(--sw-content-max);
    inline-size: 100%;
    box-sizing: border-box;
    color: var(--sw-text);
    font-family: var(--sw-font);
  }
  * { box-sizing: border-box; }
  h1 { font-size: var(--sw-fs-3xl); line-height: 1.2; margin: 0; color: var(--sw-heading); font-weight: 700; letter-spacing: -0.02em; }
  .crumbs { font-size: var(--sw-fs-sm); color: var(--sw-text-2); margin-block-end: 2px; }
  .crumbs a { color: inherit; text-decoration: none; border-radius: var(--sw-r-2xs); transition: color var(--sw-t-fast) var(--sw-ease); }
  .crumbs a:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
  .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
  .pages { margin-block-end: 14px; }

  /* the counters: the temperature / elevators screens' tiles - a surface-3 well (no outline, no shadow) a tone below the cards, the number
     is the hero (display size, heavy, tight, tabular), its word one quiet line that may take two; a counter that reports a problem and is not
     zero is a filled status field; a chosen filter is framed in its colour */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-block-end: 14px; }
  .kpi {
    --c: var(--sw-accent);
    display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: var(--sw-r-lg); min-inline-size: 0;
    background: var(--sw-surface-3); border: 1px solid transparent; box-shadow: none; font: inherit; color: inherit; text-align: start;
  }
  .kpi > div { min-inline-size: 0; }
  button.kpi {
    cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
    transition: border-color var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  button.kpi:active { transform: scale(var(--sw-press-scale)); }
  button.kpi[data-nz][data-look='bad'], button.kpi[data-nz][data-look='warn'] { background: color-mix(in srgb, var(--c) 18%, var(--sw-surface)); }
  button.kpi[data-nz][data-look='bad'] .l, button.kpi[data-nz][data-look='warn'] .l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
  .kpi[aria-pressed='true'] { border-color: var(--c); background: color-mix(in srgb, var(--c) 20%, var(--sw-surface)); box-shadow: inset 0 0 0 1px var(--c); }
  .kpi[aria-pressed='true'] .l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
  .kpi .dot { inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 22%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35); }
  .kpi b { display: block; font-size: var(--sw-fs-4xl); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; color: var(--sw-heading); white-space: nowrap; }
  .kpi b small { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); letter-spacing: 0; color: var(--sw-text-2); }
  .kpi .l { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; margin-block-start: 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); line-height: 1.25; }
  .kpi .d { display: block; margin-block-start: 2px; font-size: var(--sw-fs-xs); font-variant-numeric: tabular-nums; }
  /* the report's figures carry a unit and a change note: one step down so "18,420 kWh" fits a tile */
  .kpis.figs .kpi b { font-size: var(--sw-fs-3xl); }
  .kpi[data-look='bad'] { --c: var(--sw-danger); } .kpi[data-look='warn'] { --c: var(--sw-warning); } .kpi[data-look='ok'] { --c: var(--sw-success); } .kpi[data-look='unk'] { --c: var(--sw-unknown); }
  /* A11Y-POLISHED-2342: in light the state dot read 1.75-2.97:1 on the tile (a status mark needs 3:1); light draws it in the state's
     text ink (>= 5:1), dark keeps the state colour. light-dark() keys on the page's color-scheme; an engine without it keeps the old dot */
  .kpi { --c-ink: var(--sw-accent-text); }
  .kpi[data-look='bad'] { --c-ink: var(--sw-danger-text); } .kpi[data-look='warn'] { --c-ink: var(--sw-warning-text); } .kpi[data-look='ok'] { --c-ink: var(--sw-success-text); } .kpi[data-look='unk'] { --c-ink: var(--sw-unknown-text); }
  .kpi .dot { background: light-dark(var(--c-ink), var(--c)); }
  .kpi:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }

  h2 { font-size: var(--sw-fs-lg); margin: 0; color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
  button { font: inherit; }
  .num, td.n, .date { font-variant-numeric: tabular-nums; }
  .muted { color: var(--sw-text-3); }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-block-end: 14px; }
  .card { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); min-inline-size: 0; }
  .pad { padding: 14px 16px; }
  .title { font-weight: var(--sw-fw-semibold); color: var(--sw-text); }

  /* buttons: the product's pill; they answer the press (transform only, token durations - zero under reduced motion) */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text);
    border-radius: var(--sw-r-pill); padding: 7px 14px; min-block-size: var(--sw-ctl-h-lg); font-weight: var(--sw-fw-semibold); cursor: pointer; white-space: nowrap; text-decoration: none;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn:focus-visible, .chip:focus-visible, .seg button:focus-visible, .month button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
  .btn:disabled { opacity: var(--sw-disabled-opacity, 0.5); cursor: default; }
  .btn.primary, .btn.pri { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); box-shadow: var(--sw-shadow-1); }
  .btn.icon { padding: 7px; inline-size: var(--sw-ctl-h-lg); }
  .btn sw-icon { --sw-icon-size: 16px; }

  /* a segmented choice (range, language): one pill track, the chosen segment raised on it */
  .seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
  .seg button {
    border: 0; background: transparent; color: var(--sw-text-2); padding: 6px 14px; min-block-size: calc(var(--sw-ctl-h-lg) - 4px); border-radius: var(--sw-r-pill); cursor: pointer;
    font-weight: var(--sw-fw-medium); white-space: nowrap; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    transition: background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  .seg button:active { transform: scale(0.97); }
  .seg button[aria-pressed='true'] { background: var(--sw-seg-key, var(--sw-surface)); color: var(--sw-seg-key-ink, var(--sw-heading)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }

  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-pill); padding: 4px 12px; min-block-size: 32px;
    color: var(--sw-text-2); background: var(--sw-surface); cursor: pointer; white-space: nowrap; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  button.chip:active { transform: scale(0.97); }
  .chip.sel { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; font-weight: var(--sw-fw-semibold); }
  .chip .n { font-variant-numeric: tabular-nums; opacity: 0.8; font-weight: var(--sw-fw-regular); }
  /* DARK-REVIEW-2342: on the selected chip the count keeps full ink - accent-text at 0.8 over accent-soft read 4.47:1 in domus dark (3.4-4.1:1 in light) */
  .chip.sel .n { opacity: 1; }
  .chip.off { color: var(--sw-text-3); border-style: dashed; cursor: default; }
  .chip sw-icon { --sw-icon-size: 13px; inline-size: 13px; block-size: 13px; }
  .chip:not(.sel):not(.off) sw-icon.tick { visibility: hidden; }
  .state { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 2px 10px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); white-space: nowrap; }
  .state::before { content: ''; inline-size: 7px; block-size: 7px; border-radius: 50%; background: currentColor; }
  .s-ok { color: var(--sw-success-text); background: var(--sw-success-soft); }
  .s-bad { color: var(--sw-danger-text); background: var(--sw-danger-soft); }
  .s-warn { color: var(--sw-warning-text); background: var(--sw-warning-soft); }
  .s-unk { color: var(--sw-unknown-text); background: var(--sw-unknown-soft); }
  .up { color: var(--sw-danger-text); }
  .down { color: var(--sw-success-text); }

  .layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 14px; align-items: start; }
  .layout.solo { grid-template-columns: minmax(0, 1fr); }
  .stack { display: grid; gap: 14px; min-inline-size: 0; }
  .treecol { position: sticky; inset-block-start: 62px; }
  .place-m { display: none; }
  .place-m select { border: 0; background: none; color: inherit; font: inherit; min-inline-size: 0; max-inline-size: 100%; }
  .toolbar { display: flex; gap: 10px 14px; align-items: center; flex-wrap: wrap; padding: 12px 14px; border-block-end: 1px solid var(--sw-border); }
  .toolbar .sp { flex: 1; }
  .month { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
  .month button {
    border: 0; background: none; color: var(--sw-text-2); padding: 0; cursor: pointer; display: grid; place-items: center; border-radius: 50%;
    inline-size: calc(var(--sw-ctl-h-lg) - 4px); block-size: calc(var(--sw-ctl-h-lg) - 4px); touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  .month button:active:not(:disabled) { transform: scale(0.94); }
  .month button:disabled { opacity: 0.35; cursor: default; }
  .month b { min-inline-size: 120px; text-align: center; font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-variant-numeric: tabular-nums; }
  .picker { padding: 10px 14px; border-block-end: 1px solid var(--sw-border); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .rangefields { display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .inp {
    inline-size: 100%; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: 7px 10px; min-block-size: var(--sw-ctl-h-lg); background: var(--sw-surface);
    color: var(--sw-text); font: inherit; font-variant-numeric: tabular-nums; transition: border-color var(--sw-t-fast) var(--sw-ease);
  }
  .inp:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; border-color: var(--sw-accent); }
  .inp.err, .inp[aria-invalid='true'] { border-color: var(--sw-danger); }
  .rangefields .inp { inline-size: auto; }
  input[type='checkbox'] { accent-color: var(--sw-accent); inline-size: 18px; block-size: 18px; margin: 0; flex: none; cursor: pointer; }
  input[type='checkbox']:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }

  /* the lists: quiet column heads, tabular numbers, a row that opens says so (a chevron) and shows the keyboard focus */
  table { inline-size: 100%; border-collapse: collapse; }
  th { text-align: start; font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); font-size: var(--sw-fs-sm); padding: 9px 12px; border-block-end: 1px solid var(--sw-border); white-space: nowrap; }
  .card > .tw th { background: var(--sw-surface-2); }
  td { padding: 10px 12px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; }
  tr:last-child > td { border-block-end: 0; }
  td.n, th.n { text-align: end; white-space: nowrap; }
  th.ic, td.ic { inline-size: 36px; padding-inline: 4px 10px; text-align: end; }
  tbody.click tr.hit { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  tbody.click tr.hit td { transition: background-color var(--sw-t-fast) var(--sw-ease); }
  tbody.click tr.hit:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: calc(var(--sw-focus-w) * -1); }
  tbody.click tr.hit:active td { background: var(--sw-surface-3); }
  tr.hit[aria-expanded='true'] td { background: var(--sw-surface-2); border-block-end-color: transparent; }
  .chev { color: var(--sw-text-3); transition: transform var(--sw-t-fast) var(--sw-ease-out); }
  tr.hit[aria-expanded='true'] .chev { transform: rotate(90deg); }
  :host(:dir(rtl)) tr.hit[aria-expanded='true'] .chev { transform: rotate(-90deg); }
  .tw { overflow-x: auto; }
  .det td { background: var(--sw-surface-2); padding-block: 4px 14px; }
  .more { border-block-start: 1px solid var(--sw-border); }

  .doc { padding: 6px 0 2px; }
  .rs { padding: 16px 18px 18px; border-block-end: 1px solid var(--sw-border); }
  .rs:last-child { border-block-end: 0; }
  .rs .rh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-block-end: 12px; }
  .rs .rh .muted { font-size: var(--sw-fs-sm); }
  .rs a.muted { text-decoration: none; }
  .figs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm); }
  .fig { padding: 10px 14px; border-inline-start: 1px solid var(--sw-border); }
  .fig:first-child { border-inline-start: 0; }
  .fig .v { font-size: var(--sw-fs-2xl); font-weight: 700; color: var(--sw-heading); font-variant-numeric: tabular-nums; line-height: 1.3; }
  .fig .v small { font-size: var(--sw-fs-state); font-weight: var(--sw-fw-medium); }
  .fig .l { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
  .fig .d { font-size: var(--sw-fs-sm); }
  .sumtab td:first-child { color: var(--sw-text-2); inline-size: 40%; }
  .split { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  .meter { block-size: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); overflow: hidden; min-inline-size: 60px; }
  .meter i { display: block; block-size: 100%; background: var(--sw-success); border-radius: var(--sw-r-pill); }
  .meter i.w { background: var(--sw-warning); }
  .omitted { margin-block-start: 14px; }
  .omitted .ch-h { padding: 12px 16px; border-block-end: 1px solid var(--sw-border); }
  .omitted .o { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 16px; border-block-end: 1px solid var(--sw-border); min-block-size: 44px; flex-wrap: wrap; }
  .omitted .o:last-child { border-block-end: 0; }
  .omitted .o span:first-child { color: var(--sw-text-2); }
  .reason { color: var(--sw-text-3); font-size: var(--sw-fs-sm); display: inline-flex; gap: 6px; align-items: center; }
  .reason sw-icon { inline-size: 14px; block-size: 14px; }

  .bars { display: flex; align-items: flex-end; gap: 10px; block-size: 110px; padding-block-start: 6px; border-block-end: 1px solid var(--sw-border-strong); position: relative; }
  .bars .col { flex: 1; max-inline-size: 48px; position: relative; block-size: 100%; display: flex; align-items: flex-end; }
  .bars .col i { display: block; inline-size: 100%; background: var(--sw-warning); border-radius: 2px 2px 0 0; min-block-size: 2px; }
  .bars .col u { position: absolute; inset-inline: -2px; border-block-start: 1.5px dashed var(--sw-text-3); text-decoration: none; }
  /* the day labels sit under their own bars (the same columns as the chart, not spread across the width) */
  .axis { display: flex; gap: 10px; color: var(--sw-text-3); font-size: var(--sw-fs-xs); margin-block-start: 4px; font-variant-numeric: tabular-nums; }
  .axis span { flex: 1; max-inline-size: 48px; text-align: center; white-space: nowrap; }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-block-start: 10px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend .sw-bar { inline-size: 10px; block-size: 10px; border-radius: 2px; background: var(--sw-warning); display: inline-block; }
  .legend .sw-med { inline-size: 14px; border-block-start: 1.5px dashed var(--sw-text-3); display: inline-block; }
  .ch-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-block-end: 10px; flex-wrap: wrap; }

  .tl { position: relative; block-size: 46px; margin-block: 4px 2px; }
  .tl .track { position: absolute; inset-block-start: 20px; inset-inline: 0; block-size: 2px; background: var(--sw-border-strong); }
  .tl .win { position: absolute; inset-block-start: 12px; block-size: 18px; background: var(--sw-accent-soft); border-radius: var(--sw-r-2xs); inset-inline: 0; }
  .tl .open { position: absolute; inset-block-start: 14px; block-size: 14px; background: var(--sw-tl-door); border-radius: 3px; }
  .tl .mk { position: absolute; inset-block-start: 30px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .ev { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 9px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); background: var(--sw-surface-3); margin-inline-end: 4px; white-space: nowrap; }
  .ev sw-icon { inline-size: 13px; block-size: 13px; }
  .evs { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: 6px; }

  /* empty, error, off and forbidden: one centred answer with its mark in a soft disc */
  .blank { display: grid; place-items: center; text-align: center; gap: 10px; padding: 46px 20px; color: var(--sw-text-2); }
  .blank > sw-icon { --sw-icon-size: 28px; inline-size: 56px; block-size: 56px; padding: 14px; border-radius: 50%; background: var(--sw-surface-3); color: var(--sw-text-3); }
  .blank > sw-icon.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
  .blank > sw-icon.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
  .blank b { color: var(--sw-heading); font-size: var(--sw-fs-lg); }
  .blank .muted { max-inline-size: 520px; }
  .blank.tight { padding: 24px 20px; }
  .skel { background: var(--sw-skeleton); border-radius: var(--sw-r-xs); }
  @media (prefers-reduced-motion: no-preference) {
    .skel {
      background: linear-gradient(90deg, var(--sw-skeleton) 0%, var(--sw-skeleton-shine) 50%, var(--sw-skeleton) 100%); background-size: 200% 100%;
      animation: ix-shimmer 1.4s linear infinite;
    }
  }
  @keyframes ix-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  .set { display: grid; gap: 14px; max-inline-size: 900px; }
  /* a control screen: on a wide window the cards flow in two columns so the page does not run on for screens (one column below 1180 px) */
  @media (min-width: 1180px) {
    .set { display: block; columns: 2; column-gap: 14px; max-inline-size: 1240px; }
    .set > .card { break-inside: avoid; margin-block-end: 14px; }
    .set .fields { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 12px; padding: 12px 14px; }
  }
  .sw { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; border-block-end: 1px solid var(--sw-border); min-block-size: 52px; }
  .sw:last-child { border-block-end: 0; }
  .fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 14px; padding: 14px 16px; }
  .fields .wide2 { grid-column: span 2; }
  .fields label { display: grid; gap: 4px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); align-content: start; }
  .ferr { color: var(--sw-danger-text); font-size: var(--sw-fs-state); }
  .ch-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 16px; border-block-end: 1px solid var(--sw-border); flex-wrap: wrap; }
  .card > .ch-h:last-child { border-block-end: 0; }
  .formrow { display: grid; gap: 4px; margin-block-end: 12px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); }
  .checks { display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .checks label { display: inline-flex; gap: 8px; align-items: center; color: var(--sw-text); font-size: var(--sw-fs-md); font-weight: var(--sw-fw-regular); min-block-size: 32px; cursor: pointer; }
  .scrollbox { max-block-size: 180px; overflow: auto; padding: 4px 8px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); flex-direction: column; flex-wrap: nowrap; }
  .banner { padding: 10px 16px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-base); }
  .banner.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
  .banner.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
  .set-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }

  /* hover is only for fine pointers - a touch must not leave a row or a tile lit */
  @media (hover: hover) and (pointer: fine) {
    .crumbs a:hover { color: var(--sw-accent-text); }
    button.kpi:hover:not([aria-pressed='true']) { border-color: var(--sw-border-strong); }
    .btn:hover:not(:disabled) { background: var(--sw-surface-2); }
    .btn.primary:hover:not(:disabled), .btn.pri:hover:not(:disabled) { background: var(--sw-accent-hover); }
    .seg button:hover:not([aria-pressed='true']) { color: var(--sw-text); }
    .month button:hover:not(:disabled) { background: var(--sw-surface); }
    button.chip:hover:not(.sel) { border-color: var(--sw-border-strong); color: var(--sw-text); }
    tbody.click tr.hit:hover td { background: var(--sw-surface-2); }
    .rs a.muted:hover { color: var(--sw-accent-text); }
  }

  /* touch layouts: every control is a 44 px target */
  @media (max-width: 1100px) {
    .btn, .inp { min-block-size: 44px; }
    .btn.icon { inline-size: 44px; }
    .seg button { min-block-size: 40px; }
    .month button { inline-size: 40px; block-size: 40px; }
    .chip { min-block-size: 40px; }
    .checks label { min-block-size: 44px; }
    tbody.click tr.hit td { padding-block: 12px; }
  }
  @media (max-width: 900px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .treecol { display: none; }
    .place-m { display: inline-flex; }
    .split { grid-template-columns: minmax(0, 1fr); }
    .figs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .fig:nth-child(3) { border-inline-start: 0; }
    .fig:nth-child(n + 3) { border-block-start: 1px solid var(--sw-border); }
    .fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hide-m { display: none; }
    .toolbar .sp { display: none; }
    .rs { padding: 14px 12px 16px; }
    td, th { padding: 9px 8px; }
  }
  @media (max-width: 600px) {
    /* the phone: two counters a row, the number one step down; the toolbar stacks - the range is one full-width track */
    .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .kpi { gap: 10px; padding: 10px 12px; }
    .kpi .dot { inline-size: 14px; block-size: 14px; }
    .kpi b { font-size: var(--sw-fs-3xl); }
    .kpis.figs .kpi b { font-size: var(--sw-fs-2xl); }
    .toolbar { padding: 10px 12px; }
    .toolbar .seg { inline-size: 100%; }
    .toolbar .seg button { flex: 1; padding-inline: 6px; }
    .toolbar .place-m { inline-size: 100%; }
    .toolbar .place-m select { flex: 1; }
    .toolbar .month { flex: 1; justify-content: space-between; }
    .toolbar [data-download] { inline-size: 100%; }
    .head .btn.pri { flex: 1; }
  }
  @media (max-width: 520px) {
    .fields { grid-template-columns: minmax(0, 1fr); }
    .fields .wide2 { grid-column: auto; }
    .actions { inline-size: 100%; }
    .actions .btn { flex: 1; justify-content: center; }
  }
`;export{y as A,Y as B,Q as C,re as D,X as E,ee as F,I as R,S as a,E as b,$ as c,J as d,R as e,d as f,j as g,P as h,A as i,F as j,te as k,O as l,C as m,B as n,M as o,b as p,G as q,L as r,k as s,H as t,W as u,Z as v,V as w,U as x,q as y,K as z};
//# sourceMappingURL=styles-CACJZIZp.js.map
