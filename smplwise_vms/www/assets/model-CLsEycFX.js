import{E as z}from"./index-BGBybS0o.js";const L=z`
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
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
  .muted { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
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
  .chipb[aria-pressed='true'] { background: var(--sw-heading); color: var(--sw-surface-solid); border-color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
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

  @media (max-width: 699px) {
    .fld { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    /* mobile-native: 16 px inputs never zoom the page */
    .inp { font-size: max(16px, var(--sw-fs-lg)); }
  }
`,O={room:"חדר",team:"צוות",maintenance:"אחזקה",event:"אירועים"},A={room:"חדרים",team:"צוותים",maintenance:"אחזקה",event:"אירועים"},R={view:"צפייה",book:"יצירת אירועים שלי",edit:"עריכת הכול",manage:"ניהול ואישור"},S={view:"רואה את היומן לפי הנראות",book:"יוצר, משנה ומבטל הזמנות שלו",edit:"משנה ומבטל כל הזמנה, גם מחוץ למגבלות הזמן",manage:"מאשר ודוחה בקשות, קובע כללים וחברים"},$={pending:"ממתין לאישור",confirmed:"מאושר",rejected:"נדחה",withdrawn:"בוטל על ידי המבקש",expired:"פג",cancelled:"בוטל",displaced:"נדחק",done:"הסתיים"},q={first_holds:"הראשון שאושר מחזיק, התחזוקה מחכה להחלטה",override_notify:"התחזוקה גוברת ומודיעים למארגנים",block:"אי אפשר להציב תחזוקה מעל הזמנה",ask:"לשאול בכל חלון"},P={first_holds:"הראשון מחזיק",override_notify:"התחזוקה גוברת",block:"אי אפשר להציב",ask:"לשאול בכל חלון"},C={none:"ללא אישור",always:"כל בקשה באישור",outside_hours:"באישור מחוץ לשעות",on_behalf:"באישור כשמזמינים בשם אחרים"},B={reapproval:"באישור מחדש",managers:"רק מנהל החדר"},F={ical:"iCal",ics_in:"iCal",ics_out:"iCal",google:"Google",microsoft:"Microsoft"},V={override_notify:0,first_holds:1,ask:2,block:3};function Y(e){return e.kind==="holiday"?"holiday":e.state==="displaced"?"displaced":e.kind==="maintenance"||e.kind==="maintenance_task"?"maint":e.state==="pending"?"pending":e.kind==="external"?"external":e.title===null?"busy":"ok"}const f=e=>String(e).padStart(2,"0"),D=["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],N=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"],G=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];function u(e){const a=new Date(e);return a.setHours(0,0,0,0),a}function v(e,a){const r=new Date(e);return r.setDate(r.getDate()+a),r}const m=(e,a)=>e.getFullYear()===a.getFullYear()&&e.getMonth()===a.getMonth()&&e.getDate()===a.getDate(),x=e=>{const a=typeof e=="string"?new Date(e):e;return`${f(a.getHours())}:${f(a.getMinutes())}`},j=e=>`${e.getFullYear()}-${f(e.getMonth()+1)}-${f(e.getDate())}`,_=e=>`${f(e.getDate())}.${f(e.getMonth()+1)}`,k=e=>e.getHours()*60+e.getMinutes();function H(e,a,r){const n=new Date(e);return`${m(n,r)?"היום":m(n,v(r,1))?"מחר":`${D[n.getDay()]} ${_(n)}`} · ${x(e)}–${x(a)}`}function I(e){const a=new Date(e.getFullYear(),e.getMonth(),1),r=v(a,-a.getDay());return Array.from({length:42},(n,s)=>{const o=v(r,s);return{day:o,inMonth:o.getMonth()===e.getMonth()}})}const U=e=>u(v(e,-e.getDay()));function M(e,a){const r=u(a).getTime(),n=v(u(a),1).getTime();return e.filter(s=>new Date(s.start).getTime()<n&&new Date(s.end).getTime()>r).sort((s,o)=>s.start.localeCompare(o.start))}function W(e,a,r,n){const s=(n-r)*60,o=M(e,a).filter(t=>!t.all_day).map(t=>{const i=Math.max(r*60,k(new Date(t.start))+(m(new Date(t.start),a)?0:-1440)),d=m(new Date(t.end),a)?k(new Date(t.end)):1440,c=Math.min(n*60,Math.max(d,i+15));return{o:t,s:i,e:c}}).filter(t=>t.e>r*60&&t.s<n*60),w=[];let l=[],g=-1;const b=()=>{const t=Math.max(1,...l.map(i=>i.lane+1));for(const i of l)w.push({o:i.o,top:(i.s-r*60)/s*100,height:(i.e-i.s)/s*100,lane:i.lane,lanes:t});l=[]};for(const t of o){t.s>=g&&l.length&&b();const i=new Set(l.filter(c=>c.e>t.s).map(c=>c.lane));let d=0;for(;i.has(d);)d+=1;l.push({...t,lane:d}),g=Math.max(g,t.e)}return l.length&&b(),w}function J(e,a){if(!e)return{from:7,to:23};const r=Math.min(Math.max(a.getHours()-1,0),18);return{from:r,to:r+6}}function K(e,a,r,n){const s=u(a).getTime(),o=Math.max((new Date(e.start).getTime()-s)/6e4,r*60),w=Math.min((new Date(e.end).getTime()-s)/6e4,n*60);if(w<=o)return null;const l=(n-r)*60;return{start:(o-r*60)/l*100,width:(w-o)/l*100}}function Q(e,a,r=1){return Math.max(r,Math.floor(e/a))}function X(e,a,r){const n=Math.max(1,Math.ceil(e.length/Math.max(1,r))),s=Math.min(Math.max(1,a),n);return{items:e.slice((s-1)*r,s*r),page:s,pages:n}}function Z(e){return["room","team","maintenance","event"].map(a=>({type:a,cals:e.filter(r=>r.type===a)})).filter(a=>a.cals.length)}const ee=e=>`var(--cal-${e??"slate"})`;function ae(e,a){const r=n=>n==="maintenance"?0:n==="team"||n==="department"?1:2;return[...e].sort((n,s)=>a!=="manual"&&n.queue_position!==void 0&&s.queue_position!==void 0&&n.queue_position!==s.queue_position?n.queue_position-s.queue_position:a==="by_kind"&&r(n.kind)!==r(s.kind)?r(n.kind)-r(s.kind):n.requested_at.localeCompare(s.requested_at))}function T(e,a,r,n,s,o){const w=[];for(const l of r){const[g,b]=l.from.split(":").map(Number),[t,i]=l.to.split(":").map(Number);for(let d=g*60+b;d+n<=t*60+i;d+=s){const c=new Date(u(a).getTime()+d*6e4),y=new Date(c.getTime()+n*6e4);if(c<o)continue;const h=e.filter(p=>new Date(p.start)<y&&new Date(p.end)>c);w.push({start:c,free:!h.some(p=>p.state==="confirmed"),pending:h.filter(p=>p.state==="pending").length})}}return w}function re(e,a,r){const n=a==="24h"?1440:a==="1h"?60:0;return new Date(e).getTime()-n*6e4<=r.getTime()}function ne(e,a){return e.free?!e.pending||a==="free"?"free":a==="blocked"?"blocked":"contest":"busy"}function se(e,a,r,n,s){return T(e,a,r,n,15,s).find(o=>o.free)?.start??null}export{C as A,V as B,B as C,N as D,se as E,T as F,ne as G,re as H,G as M,P as O,F as P,R,$ as S,A as T,v as a,m as b,L as c,_ as d,ee as e,I as f,Z as g,x as h,j as i,D as j,Y as k,X as l,k as m,W as n,M as o,f as p,K as q,H as r,u as s,J as t,Q as u,ae as v,U as w,q as x,O as y,S as z};
//# sourceMappingURL=model-CLsEycFX.js.map
