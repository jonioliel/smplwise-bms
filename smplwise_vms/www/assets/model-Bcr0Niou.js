import{aV as D,gu as _,bi as M,bj as T,g as E,c4 as L,bG as O}from"./index-Cwrvr-7C.js";const P=E`
  :host {
    /* taste-skill-ignore: calendar data hues (a categorical palette, not UI colour) */
    --cal-blue: #2563eb; --cal-rose: #e11d48; --cal-cyan: #0891b2; --cal-orange: #ea580c; --cal-violet: #7c3aed; --cal-brown: #a16207; --cal-magenta: #c026d3;
    --cal-slate: #64748b;
    --ev-fill: 16%; --ev-ink: 78%;
    color: var(--sw-text);
    font-family: var(--sw-font);
  }
  :host-context(html[data-theme='dark']) {
    --cal-blue: #5b8def; --cal-rose: #f0506e; --cal-cyan: #1a9bb5; --cal-orange: #e06a2c; --cal-violet: #9b6cf0; --cal-brown: #b07a22; --cal-magenta: #d24fe0;
    --cal-slate: #93a1b6;
    --ev-fill: 26%; --ev-ink: 30%;
  }
  * { box-sizing: border-box; }
  .num { font-variant-numeric: tabular-nums; }
  ${D}
  .ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
  ${_}
  .sp { flex: 1; }
  .vh { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  /* panels */
  .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-1);
    padding: 16px; min-inline-size: 0; min-block-size: 0; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
  .panel > h2, .ph h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
  .ph { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }

  /* buttons and pills */
  .btn { font: inherit; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-block-size: var(--sw-ctl-h-lg); padding: 0 14px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface-solid);
    color: var(--sw-heading); cursor: pointer; white-space: nowrap; transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent; user-select: none; }
  .btn:active { transform: scale(0.97); }
  .btn.pri { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); box-shadow: var(--sw-shadow-primary); }
  .btn.bad { color: var(--sw-danger-text); }
  .btn.bad.fill { background: var(--sw-danger); border-color: var(--sw-danger); color: var(--sw-text-inverse); }
  .btn.sm { min-block-size: var(--sw-ctl-h-md); font-size: var(--sw-fs-sm); padding: 0 12px; }
  .btn.icon { inline-size: var(--sw-ctl-h-lg); padding: 0; }
  .btn[disabled] { opacity: var(--sw-disabled-opacity); cursor: default; transform: none; }
  .btn:focus-visible, .tab:focus-visible, .chipb:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
  /* ROUND4-LEFTOVERS-2390 (D22 review): hover only under a fine hovering pointer (a tablet with a mouse-emulating stylus kept it) */
  @media (hover: hover) and (pointer: fine) { .btn:not([disabled]):hover { background: var(--sw-hover-wash); } .btn.pri:not([disabled]):hover { background: var(--sw-accent-hover); } }
  .chipb { font: inherit; font-size: var(--sw-fs-md); display: inline-flex; align-items: center; gap: 6px; min-block-size: var(--sw-ctl-h-lg); padding: 0 16px;
    border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); cursor: pointer; white-space: nowrap; }
  /* AUDIT30-F1 (#4, owner Q3 option A assumed): a selected chip is the Blue Wash pair of the design document (sw-chip's look), never a black pill */
  /* DOMUS-DEFAULT-2439: the product's one selected chip (styles/chip-selected.ts) and its check mark */
  .chipb[aria-pressed='true'] { ${M} }
  .chipb[aria-pressed='true']::before { ${T} }
  .chip { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 10px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold);
    background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; }
  .chip.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
  .chip.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
  .chip.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
  .chip.acc { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
  .chip.dash { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-text-2); color: var(--sw-heading); }
  .count { display: inline-grid; place-items: center; min-inline-size: 20px; block-size: 20px; padding: 0 6px; border-radius: var(--sw-r-pill); background: var(--sw-badge-bg);
    color: var(--sw-badge-fg); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold); }

  /* segmented control (settings, view switch) */
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); max-inline-size: 100%; overflow: hidden; }
  .seg button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); padding: 6px 12px; border-radius: var(--sw-r-pill);
    cursor: pointer; white-space: nowrap; min-block-size: 30px; }
  .seg button[aria-pressed='true'] { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-heading)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
  .seg button[disabled] { opacity: var(--sw-disabled-opacity); cursor: default; }
  /* CR-CMP2-SEGMENTED-B-2450 (owner N11): the module's segmented controls are sw-segmented; these knobs keep the module's key (the pill
     track, 13 px labels, the chosen key in the heading ink and semibold) through its shadow root. The .seg rules above stay for the
     provider tab strip (a tablist, system-calendar-sync). */
  sw-segmented {
    --sw-seg-radius: var(--sw-r-pill);
    --sw-seg-btn-radius: var(--sw-r-pill);
    --sw-seg-h: 30px;
    --sw-seg-key-pad: 12px;
    --sw-seg-fs: var(--sw-fs-sm);
    --sw-seg-fw: var(--sw-fw-regular, 400);
    --sw-seg-on-fw: var(--sw-fw-semibold);
    --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface-solid));
    --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-heading));
  }

  /* the calendar's colour dot / square */
  .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--h, var(--cal-slate)); flex: none; }
  .sq { inline-size: 24px; block-size: 24px; border-radius: var(--sw-r-xs); background: var(--h, var(--cal-slate)); flex: none; }

  /* an entry: tinted fill in the calendar's hue; the kind marks */
  .ev { --h: var(--cal-blue); position: relative; display: block; min-inline-size: 0; overflow: hidden; border: 0; text-align: start; font: inherit; cursor: pointer;
    background: color-mix(in srgb, var(--h) var(--ev-fill), var(--sw-surface-solid)); color: color-mix(in srgb, var(--h) var(--ev-ink), var(--sw-heading));
    border-radius: var(--sw-r-xs); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--h) 32%, transparent); padding: 3px 6px; font-size: var(--sw-fs-xs); line-height: 1.3; }
  .ev b { font-weight: var(--sw-fw-bold); }
  .ev small { display: block; font-size: var(--sw-fs-2xs); opacity: 0.85; }
  .ev[data-mark='pending'] { background: color-mix(in srgb, var(--h) 6%, var(--sw-surface-solid)); box-shadow: none; outline: 1.5px dashed color-mix(in srgb, var(--h) 70%, transparent); outline-offset: -1.5px; }
  .ev[data-mark='maint'] { --h: var(--cal-orange); background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--h) 22%, var(--sw-surface-solid)) 0 5px, color-mix(in srgb, var(--h) 8%, var(--sw-surface-solid)) 5px 10px);
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--h) 70%, transparent); }
  .ev[data-mark='displaced'] { --h: var(--sw-warning); background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--sw-warning) 30%, var(--sw-surface-solid)) 0 5px, color-mix(in srgb, var(--sw-warning) 12%, var(--sw-surface-solid)) 5px 10px);
    color: var(--sw-warning-text); box-shadow: inset 0 0 0 1.5px var(--sw-warning); }
  .ev[data-mark='displaced'] b { text-decoration: line-through; }
  .ev[data-mark='external'], .ev[data-mark='busy'] { --h: var(--cal-slate); background: var(--sw-surface-3); color: var(--sw-text-2); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
  .ev[data-mark='holiday'] { --h: var(--cal-slate); background: transparent; box-shadow: none; color: var(--sw-text-2); }
  .ev[data-flag='conflict'] { box-shadow: inset 0 0 0 2px var(--sw-danger); }
  .closed { background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--sw-text-3) 18%, transparent) 6px 7px); }

  /* legend */
  .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); align-items: center; }
  .legend i { display: inline-block; inline-size: 22px; block-size: 12px; border-radius: var(--sw-r-2xs); vertical-align: middle; margin-inline-end: 6px; --h: var(--cal-blue); }

  /* list rows */
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); min-inline-size: 0; }
  .row .name { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
  .row .sub { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  .grow { flex: 1; min-inline-size: 0; }

  /* the pager that replaces a page scroll */
  .pager { display: flex; align-items: center; gap: 8px; justify-content: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .pager .btn { inline-size: var(--sw-ctl-h-lg); padding: 0; }

  /* skeleton (owner answer 26A: after 300 ms, no flash) */
  .skel { border-radius: var(--sw-r-md); background: linear-gradient(90deg, var(--sw-skeleton) 0%, var(--sw-skeleton-shine) 50%, var(--sw-skeleton) 100%); background-size: 200% 100%;
    animation: sk 1.4s linear infinite; }
  @keyframes sk { to { background-position: -200% 0; } }
  .spin { inline-size: 28px; block-size: 28px; border-radius: 50%; border: 3px solid var(--sw-border); border-block-start-color: var(--sw-accent); animation: rot 0.9s linear infinite; }
  @keyframes rot { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .skel, .spin { animation: none; } .btn { transition: none; } }

  /* form fields of the drawers */
  .fld { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px 14px; align-items: center; }
  .fld > label, .fld > .lbl { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
  .inp { font: inherit; font-size: var(--sw-fs-md); color: var(--sw-heading); background: var(--sw-surface-2); border: 1px solid transparent; border-radius: var(--sw-r-md);
    padding: 0 12px; min-block-size: 40px; min-inline-size: 0; inline-size: 100%; }
  .inp:focus { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
  select.inp { appearance: none; }
  .note { display: flex; gap: 10px; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-accent-soft); color: var(--sw-text); font-size: var(--sw-fs-sm); }
  .note.warn { background: var(--sw-warning-soft); }
  .note.bad { background: var(--sw-danger-soft); }
  .note b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }

  /* AUDIT30-F5 (touch): on a coarse pointer every control of the module is a 44 px target (COMPONENT_RULES §1) */
  @media (pointer: coarse) {
    .btn, .btn.sm, .chipb, .seg button { min-block-size: 44px; }
    sw-segmented { --sw-seg-h: 44px; }
    .btn.icon, .pager .btn { inline-size: 44px; }
  }

  @media (max-width: 699px) {
    .fld { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    /* mobile-native: 16 px inputs never zoom the page */
    .inp { font-size: max(16px, var(--sw-fs-lg)); }
  }
`,a=L("msg/calendars",O("en","i18n/msg/calendars","en")),q={room:a("חדר"),team:a("צוות"),maintenance:a("אחזקה"),event:a("אירועים")},F={room:a("חדרים"),team:a("צוותים"),maintenance:a("אחזקה"),event:a("אירועים")},N={view:a("צפייה"),book:a("יצירת אירועים שלי"),edit:a("עריכת הכול"),manage:a("ניהול ואישור")},B={view:a("רואה את היומן לפי הנראות"),book:a("יוצר, משנה ומבטל הזמנות שלו"),edit:a("משנה ומבטל כל הזמנה, גם מחוץ למגבלות הזמן"),manage:a("מאשר ודוחה בקשות, קובע כללים וחברים")},V={pending:a("ממתין לאישור"),confirmed:a("מאושר"),rejected:a("נדחה"),withdrawn:a("בוטל על ידי המבקש"),expired:a("פג"),cancelled:a("בוטל"),displaced:a("נדחק"),done:a("הסתיים")},G={first_holds:a("הראשון שאושר מחזיק, התחזוקה מחכה להחלטה"),override_notify:a("התחזוקה גוברת ומודיעים למארגנים"),block:a("אי אפשר להציב תחזוקה מעל הזמנה"),ask:a("לשאול בכל חלון")},U={first_holds:a("הראשון מחזיק"),override_notify:a("התחזוקה גוברת"),block:a("אי אפשר להציב"),ask:a("לשאול בכל חלון")},Y={none:a("ללא אישור"),always:a("כל בקשה באישור"),outside_hours:a("באישור מחוץ לשעות"),on_behalf:a("באישור כשמזמינים בשם אחרים")},I={reapproval:a("באישור מחדש"),managers:a("רק מנהל החדר")},j={ical:"iCal",ics_in:"iCal",ics_out:"iCal",google:"Google",microsoft:"Microsoft"},H={override_notify:0,first_holds:1,ask:2,block:3};function W(e){return e.kind==="holiday"?"holiday":e.state==="displaced"?"displaced":e.kind==="maintenance"||e.kind==="maintenance_task"?"maint":e.state==="pending"?"pending":e.kind==="external"?"external":e.title===null?"busy":"ok"}const f=e=>String(e).padStart(2,"0"),A=[a("א׳"),a("ב׳"),a("ג׳"),a("ד׳"),a("ה׳"),a("ו׳"),a("ש׳")],Q=[a("ראשון"),a("שני"),a("שלישי"),a("רביעי"),a("חמישי"),a("שישי"),a("שבת")],J=[a("ינואר"),a("פברואר"),a("מרץ"),a("אפריל"),a("מאי"),a("יוני"),a("יולי"),a("אוגוסט"),a("ספטמבר"),a("אוקטובר"),a("נובמבר"),a("דצמבר")];function v(e){const s=new Date(e);return s.setHours(0,0,0,0),s}function h(e,s){const r=new Date(e);return r.setDate(r.getDate()+s),r}const m=(e,s)=>e.getFullYear()===s.getFullYear()&&e.getMonth()===s.getMonth()&&e.getDate()===s.getDate(),k=e=>{const s=typeof e=="string"?new Date(e):e;return`${f(s.getHours())}:${f(s.getMinutes())}`},K=e=>`${e.getFullYear()}-${f(e.getMonth()+1)}-${f(e.getDate())}`,S=e=>`${f(e.getDate())}.${f(e.getMonth()+1)}`,y=e=>e.getHours()*60+e.getMinutes();function X(e,s,r){const n=new Date(e);return`${m(n,r)?a("היום"):m(n,h(r,1))?a("מחר"):`${A[n.getDay()]} ${S(n)}`} · ${k(e)}–${k(s)}`}function Z(e){const s=new Date(e.getFullYear(),e.getMonth(),1),r=h(s,-s.getDay());return Array.from({length:42},(n,t)=>{const i=h(r,t);return{day:i,inMonth:i.getMonth()===e.getMonth()}})}const ee=e=>v(h(e,-e.getDay()));function R(e,s){const r=v(s).getTime(),n=h(v(s),1).getTime();return e.filter(t=>new Date(t.start).getTime()<n&&new Date(t.end).getTime()>r).sort((t,i)=>t.start.localeCompare(i.start))}function ae(e,s,r,n){const t=(n-r)*60,i=R(e,s).filter(o=>!o.all_day).map(o=>{const l=Math.max(r*60,y(new Date(o.start))+(m(new Date(o.start),s)?0:-1440)),p=m(new Date(o.end),s)?y(new Date(o.end)):1440,d=Math.min(n*60,Math.max(p,l+15));return{o,s:l,e:d}}).filter(o=>o.e>r*60&&o.s<n*60),w=[];let c=[],u=-1;const b=()=>{const o=Math.max(1,...c.map(l=>l.lane+1));for(const l of c)w.push({o:l.o,top:(l.s-r*60)/t*100,height:(l.e-l.s)/t*100,lane:l.lane,lanes:o});c=[]};for(const o of i){o.s>=u&&c.length&&b();const l=new Set(c.filter(d=>d.e>o.s).map(d=>d.lane));let p=0;for(;l.has(p);)p+=1;c.push({...o,lane:p}),u=Math.max(u,o.e)}return c.length&&b(),w}function se(e,s){if(!e)return{from:7,to:23};const r=Math.min(Math.max(s.getHours()-1,0),18);return{from:r,to:r+6}}function re(e,s,r,n){const t=v(s).getTime(),i=Math.max((new Date(e.start).getTime()-t)/6e4,r*60),w=Math.min((new Date(e.end).getTime()-t)/6e4,n*60);if(w<=i)return null;const c=(n-r)*60;return{start:(i-r*60)/c*100,width:(w-i)/c*100}}function ne(e,s,r=1){return Math.max(r,Math.floor(e/s))}function te(e,s,r){const n=Math.max(1,Math.ceil(e.length/Math.max(1,r))),t=Math.min(Math.max(1,s),n);return{items:e.slice((t-1)*r,t*r),page:t,pages:n}}function oe(e){return["room","team","maintenance","event"].map(s=>({type:s,cals:e.filter(r=>r.type===s)})).filter(s=>s.cals.length)}const ie=e=>`var(--cal-${e??"slate"})`;function le(e,s){const r=n=>n==="maintenance"?0:n==="team"||n==="department"?1:2;return[...e].sort((n,t)=>s!=="manual"&&n.queue_position!==void 0&&t.queue_position!==void 0&&n.queue_position!==t.queue_position?n.queue_position-t.queue_position:s==="by_kind"&&r(n.kind)!==r(t.kind)?r(n.kind)-r(t.kind):n.requested_at.localeCompare(t.requested_at))}function $(e,s,r,n,t,i){const w=[];for(const c of r){const[u,b]=c.from.split(":").map(Number),[o,l]=c.to.split(":").map(Number);for(let p=u*60+b;p+n<=o*60+l;p+=t){const d=new Date(v(s).getTime()+p*6e4),z=new Date(d.getTime()+n*6e4);if(d<i)continue;const x=e.filter(g=>new Date(g.start)<z&&new Date(g.end)>d);w.push({start:d,free:!x.some(g=>g.state==="confirmed"),pending:x.filter(g=>g.state==="pending").length})}}return w}function ce(e,s,r){const n=s==="24h"?1440:s==="1h"?60:0;return new Date(e).getTime()-n*6e4<=r.getTime()}function de(e,s){return e.free?!e.pending||s==="free"?"free":s==="blocked"?"blocked":"contest":"busy"}function pe(e,s,r,n,t){return $(e,s,r,n,15,t).find(i=>i.free)?.start??null}export{Y as A,V as B,le as C,Q as D,I as E,pe as F,$ as G,de as H,ce as I,J as M,G as O,j as P,N as R,H as S,q as T,U as a,B as b,ie as c,P as d,h as e,S as f,m as g,k as h,f as i,Z as j,ee as k,K as l,y as m,oe as n,F as o,te as p,A as q,ne as r,v as s,a as t,R as u,W as v,X as w,ae as x,se as y,re as z};
