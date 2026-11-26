import{b4 as _,gA as E,bz as A,bA as L,j as O,cB as S,bs as R}from"./index-D3xHkfje.js";const Y=O`
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
  ${_}
  .ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
  ${E}
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
  .chipb[aria-pressed='true'] { ${A} }
  .chipb[aria-pressed='true']::before { ${L} }
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
`,t=S("msg/calendars",R("en","i18n/msg/calendars","en")),I={room:t("חדר"),team:t("צוות"),maintenance:t("אחזקה"),event:t("אירועים")},G={room:t("חדרים"),team:t("צוותים"),maintenance:t("אחזקה"),event:t("אירועים")},H={view:t("צפייה"),book:t("יצירת אירועים שלי"),edit:t("עריכת הכול"),manage:t("ניהול ואישור")},j={view:t("רואה את היומן לפי הנראות"),book:t("יוצר, משנה ומבטל הזמנות שלו"),edit:t("משנה ומבטל כל הזמנה, גם מחוץ למגבלות הזמן"),manage:t("מאשר ודוחה בקשות, קובע כללים וחברים")},K={pending:t("ממתין לאישור"),confirmed:t("מאושר"),rejected:t("נדחה"),withdrawn:t("בוטל על ידי המבקש"),expired:t("פג"),cancelled:t("בוטל"),displaced:t("נדחק"),done:t("הסתיים")},Q={first_holds:t("הראשון שאושר מחזיק, התחזוקה מחכה להחלטה"),override_notify:t("התחזוקה גוברת ומודיעים למארגנים"),block:t("אי אפשר להציב תחזוקה מעל הזמנה"),ask:t("לשאול בכל חלון")},W={first_holds:t("הראשון מחזיק"),override_notify:t("התחזוקה גוברת"),block:t("אי אפשר להציב"),ask:t("לשאול בכל חלון")},J={none:t("ללא אישור"),always:t("כל בקשה באישור"),outside_hours:t("באישור מחוץ לשעות"),on_behalf:t("באישור כשמזמינים בשם אחרים")},X={reapproval:t("באישור מחדש"),managers:t("רק מנהל החדר")},Z={ical:"iCal",ics_in:"iCal",ics_out:"iCal",google:"Google",microsoft:"Microsoft"},ee={override_notify:0,first_holds:1,ask:2,block:3};function ae(e){return e.kind==="holiday"?"holiday":e.state==="displaced"?"displaced":e.kind==="maintenance"||e.kind==="maintenance_task"?"maint":e.state==="pending"?"pending":e.kind==="external"?"external":e.title===null?"busy":"ok"}const f=e=>String(e).padStart(2,"0"),$=[t("א׳"),t("ב׳"),t("ג׳"),t("ד׳"),t("ה׳"),t("ו׳"),t("ש׳")],se=[t("ראשון"),t("שני"),t("שלישי"),t("רביעי"),t("חמישי"),t("שישי"),t("שבת")],te=[t("ינואר"),t("פברואר"),t("מרץ"),t("אפריל"),t("מאי"),t("יוני"),t("יולי"),t("אוגוסט"),t("ספטמבר"),t("אוקטובר"),t("נובמבר"),t("דצמבר")];function k(e){const a=new Date(e);return a.setHours(0,0,0,0),a}function v(e,a){const s=new Date(e);return s.setDate(s.getDate()+a),s}const h=(e,a)=>e.getFullYear()===a.getFullYear()&&e.getMonth()===a.getMonth()&&e.getDate()===a.getDate(),z=e=>{const a=typeof e=="string"?new Date(e):e;return`${f(a.getHours())}:${f(a.getMinutes())}`},ne=e=>`${e.getFullYear()}-${f(e.getMonth()+1)}-${f(e.getDate())}`,C=e=>`${f(e.getDate())}.${f(e.getMonth()+1)}`,D=e=>e.getHours()*60+e.getMinutes(),m=(e,a)=>new Date(e.getFullYear(),e.getMonth(),e.getDate(),0,a);function re(e,a,s){const n=new Date(e);return`${h(n,s)?t("היום"):h(n,v(s,1))?t("מחר"):`${$[n.getDay()]} ${C(n)}`} · ${z(e)}–${z(a)}`}function oe(e){const a=new Date(e.getFullYear(),e.getMonth(),1),s=v(a,-a.getDay());return Array.from({length:42},(n,r)=>{const i=v(s,r);return{day:i,inMonth:i.getMonth()===e.getMonth()}})}const ie=e=>k(v(e,-e.getDay()));function P(e,a){const s=k(a).getTime(),n=v(k(a),1).getTime();return e.filter(r=>new Date(r.start).getTime()<n&&new Date(r.end).getTime()>s).sort((r,i)=>r.start.localeCompare(i.start))}function le(e,a,s,n){const r=(n-s)*60,i=P(e,a).filter(o=>!o.all_day).map(o=>{const l=Math.max(s*60,D(new Date(o.start))+(h(new Date(o.start),a)?0:-1440)),d=h(new Date(o.end),a)?D(new Date(o.end)):1440,g=Math.min(n*60,Math.max(d,l+15));return{o,s:l,e:g}}).filter(o=>o.e>s*60&&o.s<n*60),p=[];let c=[],w=-1;const x=()=>{const o=Math.max(1,...c.map(l=>l.lane+1));for(const l of c)p.push({o:l.o,top:(l.s-s*60)/r*100,height:(l.e-l.s)/r*100,lane:l.lane,lanes:o});c=[]};for(const o of i){o.s>=w&&c.length&&x();const l=new Set(c.filter(g=>g.e>o.s).map(g=>g.lane));let d=0;for(;l.has(d);)d+=1;c.push({...o,lane:d}),w=Math.max(w,o.e)}return c.length&&x(),p}function ce(e,a){if(!e)return{from:7,to:23};const s=Math.min(Math.max(a.getHours()-1,0),18);return{from:s,to:s+6}}function de(e,a,s,n){const[r,i]=q(e,a),p=Math.max(r,s*60),c=Math.min(i,n*60);if(c<=p)return null;const w=(n-s)*60;return{start:(p-s*60)/w*100,width:(c-p)/w*100}}function b(e,a){const s=k(a);return h(e,s)?e.getHours()*60+e.getMinutes()+e.getSeconds()/60+e.getMilliseconds()/6e4:e<s?(e.getTime()-s.getTime())/6e4:1440+(e.getTime()-v(s,1).getTime())/6e4}function q(e,a){const s=new Date(e.start),n=new Date(e.end),r=b(s,a);let i=b(n,a);return i<=r&&n.getTime()>s.getTime()&&(i=r+(n.getTime()-s.getTime())/6e4),[r,i]}function B(e,a){if(a<0||a>23)return"plain";const s=m(e,a*60);return s.getHours()!==a||!h(s,e)?"missing":(m(e,(a+1)*60).getTime()-s.getTime())/6e4>60?"repeated":"plain"}function F(e,a,s){return Array.from({length:s-a+1},(n,r)=>({k:r,h:(a+r)%24,kind:a+r<24?B(e,a+r):"plain"}))}function pe(e,a,s){const n=s-a;return F(e,a,s).filter(r=>r.k<n&&r.kind==="missing").map(r=>({h:r.h,start:r.k/n*100,width:1/n*100}))}function M(e,a){const s=m(e,a);if(a<=0||a>=1440||b(s,e)===a)return s;let n=1;for(;n<=180&&b(new Date(s.getTime()-n*6e4),e)>a;)n+=1;return new Date(s.getTime()-(n-1)*6e4)}const N=(e,a)=>a<=0||a>=1440||b(m(e,a),e)===a;function ge(e,a,s){const n=Math.min(Math.max(s,0),1);return M(e,Math.floor((a.from*60+n*(a.to-a.from)*60)/30)*30)}function we(e,a,s,n){const r=Math.min(Math.max(s,0),1),i=Math.round((a.from*60+r*(a.to-a.from)*60-n/2)/15)*15;return M(e,Math.max(a.from*60,Math.min(a.to*60-n,i)))}function ue(e,a,s=1){return Math.max(s,Math.floor(e/a))}function fe(e,a,s){const n=Math.max(1,Math.ceil(e.length/Math.max(1,s))),r=Math.min(Math.max(1,a),n);return{items:e.slice((r-1)*s,r*s),page:r,pages:n}}function ve(e){return["room","team","maintenance","event"].map(a=>({type:a,cals:e.filter(s=>s.type===a)})).filter(a=>a.cals.length)}const he=e=>`var(--cal-${e??"slate"})`;function me(e,a){const s=n=>n==="maintenance"?0:n==="team"||n==="department"?1:2;return[...e].sort((n,r)=>a!=="manual"&&n.queue_position!==void 0&&r.queue_position!==void 0&&n.queue_position!==r.queue_position?n.queue_position-r.queue_position:a==="by_kind"&&s(n.kind)!==s(r.kind)?s(n.kind)-s(r.kind):n.requested_at.localeCompare(r.requested_at))}function U(e,a,s,n,r,i){const p=[];for(const c of s){const[w,x]=c.from.split(":").map(Number),[o,l]=c.to.split(":").map(Number);for(let d=w*60+x;d+n<=o*60+l;d+=r){if(!N(a,d))continue;const g=m(a,d),T=m(a,d+n);if(g<i)continue;const y=e.filter(u=>new Date(u.start)<T&&new Date(u.end)>g);p.push({start:g,free:!y.some(u=>u.state==="confirmed"),pending:y.filter(u=>u.state==="pending").length})}}return p}function be(e,a,s){const n=a==="24h"?1440:a==="1h"?60:0;return new Date(e).getTime()-n*6e4<=s.getTime()}function xe(e,a){return e.free?!e.pending||a==="free"?"free":a==="blocked"?"blocked":"contest":"busy"}function ke(e,a,s,n,r){return U(e,a,s,n,15,r).find(i=>i.free)?.start??null}export{J as A,ce as B,F as C,se as D,pe as E,de as F,ge as G,q as H,K as I,me as J,X as K,ke as L,te as M,U as N,Q as O,Z as P,xe as Q,H as R,ee as S,I as T,be as U,we as V,W as a,j as b,he as c,Y as d,C as e,v as f,h as g,z as h,m as i,f as j,D as k,oe as l,N as m,ie as n,ne as o,fe as p,ve as q,ue as r,k as s,t,G as u,$ as v,re as w,P as x,ae as y,le as z};
