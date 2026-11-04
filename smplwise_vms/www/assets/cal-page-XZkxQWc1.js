import{E as tt,F as y,G as d,a as at,A as c,e as n,bP as _t,H as it,T as _,j as dt,i as Nt,pt as ue,pu as Gt,pv as Ne,pw as Ke,px as Ue,py as ve,pz as Ve,c2 as Ge,pA as Jt,pB as Ye}from"./index-BGBybS0o.js";import{a as B,D as G,d as pt,s as M,b as Z,p as Y,h as w,c as nt,e as q,m as Yt,f as me,w as te,i as X,M as Rt,g as Xe,T as Qe,j as kt,o as Pt,k as Xt,l as wt,n as We,t as Te,q as Kt,S as Ce,r as bt,u as Vt,v as Ze,O as jt,x as Je,y as Dt,P as ts,A as Lt,R as yt,z as es,B as fe,C as be,E as ss,F as ee,G as as,H as is}from"./model-CLsEycFX.js";import{a as Ie}from"./calendar-attendees-gHvD8sKD.js";import{listUsers as ns,listRoles as os}from"./access-c_tTdhcG.js";import"./sw-logo-art-Va6y_cIM.js";const we=["cal","rooms","approvals","maint","manage"],z={newEvent:"cal-new-event",newMaint:"cal-new-maint",changed:"cal-changed",toast:"cal-toast"},oe={attendees:null};function Me(t){return oe.attendees?oe.attendees(t):null}function A(t,e,s){t.dispatchEvent(new CustomEvent(e,{detail:s,bubbles:!0,composed:!0}))}function re(t){const e=t.q.trim();return t.cals.filter(s=>(!t.floor||!s.floor_id||s.floor_id===t.floor)&&(!e||s.name.includes(e)))}const ge={screen:"מסך",projector:"מקרן",video_call:"שיחת וידאו",whiteboard:"לוח",kitchen:"מטבחון",accessible:"נגיש"};function rs(t){const e=[],s=[];return t.forEach(a=>{const i=new Date(a.start).getTime();let o=s.findIndex(r=>r<=i);o<0&&(o=s.length,s.push(0)),s[o]=new Date(a.end).getTime(),e.push(o)}),e}function ls(t,e,s,a,i=23){const o=Z(e,s)?Math.ceil((s.getHours()*60+s.getMinutes())/15)*15:480;for(let r=o;r+a<=i*60;r+=15){const l=new Date(M(e).getTime()+r*6e4),p=new Date(l.getTime()+a*6e4);for(const u of t){if(!u.open.some(h=>{const[x,b]=h.from.split(":").map(Number),[f,g]=h.to.split(":").map(Number);return r>=x*60+b&&r+a<=f*60+g}))continue;if(!u.entries.some(h=>["confirmed","pending"].includes(h.state)&&new Date(h.start)<p&&new Date(h.end)>l))return{room:u.calendar_id,start:l,end:p}}}return null}const ft={self:"אני",team:"צוות",class:"חוג",customer:"לקוח",department:"מחלקה",vendor:"ספק"};function qe(t,e){if(!(t==="none"||e<2))return`FREQ=${t==="daily"?"DAILY":"WEEKLY"};COUNT=${Math.min(Math.max(e,2),104)}`}function Ae(t,e,s){if(t==="none"||e<2)return"פעם אחת";const a=Math.min(Math.max(e,2),104),i=B(s,t==="daily"?a-1:(a-1)*7);return`${t==="daily"?"כל יום":`כל ${G[s.getDay()]}`} עד ${pt(i)} · ${a} מועדים`}function ut(t,e){const s=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t),a=/^(\d{2}):(\d{2})$/.exec(e);return s&&a?new Date(+s[1],+s[2]-1,+s[3],+a[1],+a[2]):null}function le(t){return new URLSearchParams(window.location.hash.split("?")[1]??"").get(t)}function Ut(t){const[e,s=""]=window.location.hash.split("?"),a=new URLSearchParams(s);for(const[i,o]of Object.entries(t))a.set(i,o);history.replaceState(history.state,"",`${window.location.pathname}${window.location.search}${e}?${a.toString()}`)}function Pe(t,e){const s=t?/^(\d{4})-(\d{2})-(\d{2})$/.exec(t):null;return s?new Date(+s[1],+s[2]-1,+s[3]):M(e)}const $t=(t,e,s)=>Math.max(e,Math.min(s,t));function cs(t,e){return e.from+$t(t,0,1)*(e.to-e.from)}function Ot(t,e,s){return $t(Math.floor((t-s.from)/e)*e+s.from,s.from,s.to-e)}const Le=(t,e)=>Math.round(t/e)*e;function ct(t){const e=t?.slot_step_min;return e&&[5,10,15,30,60].includes(e)?e:15}function ds(t,e,s){const a=Ot(t,e,s);return{s:a,e:Math.min(s.to,a+Math.max(30,e))}}function xe(t,e,s,a,i=s){const o=Ot(e,s,a),r=Math.min(t,o);let l=Math.max(t,o)+s;return l-r<i&&(l=Math.min(a.to,r+i)),{s:r,e:l}}function ps(t,e,s,a,i){const o=t.e-t.s,r=$t(Le(e-s,a),i.from,Math.max(i.from,i.to-o));return{s:r,e:r+o}}function hs(t,e,s,a){return{s:t.s,e:$t(Le(e,s),t.s+s,a.to)}}const W=(t,e)=>new Date(M(t).getTime()+e*6e4),xt=t=>{const e=typeof t=="string"?new Date(t):t;return e.getHours()*60+e.getMinutes()},us=450,vs=350,$e={mouse:4,touch:8};class ms{constructor(e,s,a,i){this.target=e,this.x0=s,this.y0=a,this.touch=i,this.started=!1,this.cancelled=!1,this.armed=!i}get delay(){return this.target.kind==="event"?vs:us}onTimer(){return this.cancelled||this.armed?"none":this.target.kind==="slot"?(this.armed=!0,this.started=!0,"select"):this.target.kind==="event"&&this.target.editable?(this.armed=!0,"lift"):"none"}onMove(e,s){const a=Math.hypot(e-this.x0,s-this.y0)>(this.touch?$e.touch:$e.mouse);return this.cancelled?"none":this.armed?this.target.kind==="none"||this.target.kind==="event"&&!this.target.editable?"none":this.started?"drag":a?(this.started=!0,"start"):"none":a?(this.cancelled=!0,"cancel"):"none"}onUp(){return this.target.kind==="none"?"none":this.started?this.target.kind==="slot"?"click":"drop":this.cancelled?"none":this.target.kind==="slot"&&this.touch?"coach":"click"}}function fs(t,e,s,a,i,o,r,l=!0){if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(e))return{kind:"none"};const p=t?{...t}:{col:$t(r.col,0,Math.max(0,a-1)),anchor:Ot(r.min,i,o),focus:Ot(r.min,i,o)},u=()=>({col:p.col,s:Math.min(p.anchor,p.focus),e:Math.max(p.anchor,p.focus)+i});if(e==="Enter")return{kind:"open",span:u()};e==="ArrowUp"&&(p.focus=Math.max(o.from,p.focus-i)),e==="ArrowDown"&&(p.focus=Math.min(o.to-i,p.focus+i));const v=e==="ArrowLeft"===l?1:-1;return(e==="ArrowLeft"||e==="ArrowRight")&&(p.col=$t(p.col+v,0,Math.max(0,a-1))),(e==="ArrowUp"||e==="ArrowDown")&&!s&&(p.anchor=p.focus),{kind:"select",sel:p,span:u()}}const Et=t=>t<60?`${t} דק׳`:t===60?"שעה":t===120?"שעתיים":t%60?`${Math.floor(t/60)}:${Y(t%60)} שעות`:`${t/60} שעות`,bs=t=>t.my_role==="edit"||t.my_role==="manage";function qt(t,e){const s=t.open_hours;if(!s)return{from:0,to:1440};const a=e.getDay()===0?7:e.getDay();if(!s.weekdays.includes(a))return null;const[i,o]=s.start.split(":").map(Number),[r,l]=s.end.split(":").map(Number);return{from:i*60+o,to:r*60+l}}function Bt(t,e,s,a){const i=t.cal,o={level:"ok",reason:null,warn:null,peers:0,contested:null,approver:i.owner?.name||null},r=[],l=bs(i);(!i.my_role||i.my_role==="view")&&r.push(i.my_role==="view"?`${i.name}: צפייה בלבד`:"אין לך הרשאה ליצור אירועים");const p=M(t.start),u=xt(t.start),v=t.end.getTime()-p.getTime()>=864e5?1440:xt(t.end);let m=i.approval_mode==="always"||i.approval_mode==="on_behalf"&&!!t.behalf&&t.behalf!=="self";const h=qt(i,p);if(!h)l?o.warn=`${i.name} סגור ב${G[p.getDay()]}. כמנהל היומן מותר לך`:i.approval_mode==="outside_hours"?m=!0:r.push(`${i.name} סגור ב${G[p.getDay()]==="שבת"?"שבת":"יום הזה"}`);else if(u<h.from||v>h.to){const g=`מחוץ לשעות הפתיחה של ${i.name}: ${Y(Math.floor(h.from/60))}:${Y(h.from%60)}–${Y(Math.floor(h.to/60))}:${Y(h.to%60)}`;l?o.warn=`${g}. כמנהל היומן מותר לך`:i.approval_mode==="outside_hours"?m=!0:r.push(g)}(t.started?t.end<=a:t.start<a)&&r.push("המועד כבר התחיל או עבר");const x=Math.round((t.end.getTime()-t.start.getTime())/6e4);i.max_minutes&&x>i.max_minutes&&(l?o.warn??=`ארוך מ-${Et(i.max_minutes)}. כמנהל היומן מותר לך לחרוג`:r.push(`ב${i.name} אפשר להזמין עד ${Et(i.max_minutes)}`)),i.min_minutes&&x<i.min_minutes&&(l?o.warn??=`קצר מ-${Et(i.min_minutes)}. כמנהל היומן מותר לך`:r.push(`ב${i.name} ההזמנה הקצרה ביותר היא ${Et(i.min_minutes)}`));const b=ct(i);if((u%b||v%b)&&r.push(`השעות ב${i.name} בקפיצות של ${b} דק׳`),i.capacity&&t.headcount&&t.headcount>i.capacity&&r.push(`ב${i.name} יש ${i.capacity} מקומות`),(i.conflict_policy??"exclusive")==="exclusive"){const g=((i.buffer_before_min??0)+(i.buffer_after_min??0))*6e4,k=t.start.getTime()-g,K=t.end.getTime()+g;for(const O of e){if(t.ignoreId&&O.event_id===t.ignoreId||O.calendar_id!==i.id&&!O.room_calendar_ids.includes(i.id)||!(new Date(O.start).getTime()<K&&new Date(O.end).getTime()>k))continue;const Ct=O.state==="confirmed"||s.pending_holds_slot&&O.state==="pending";if(O.kind==="maintenance"&&O.state==="confirmed"){const It=i.overlap_override??s.maintenance_overlap;if(It==="override_notify"||It==="block"){r.push(`חלון תחזוקה${O.title?` "${O.title}"`:""} ${w(O.start)}–${w(O.end)}`);continue}}Ct?s.contested_requests==="reject"?r.push(`חופף ל${O.title?`"${O.title}"`:"הזמנה קיימת"} ${w(O.start)}–${w(O.end)}`):o.contested??=O:O.state==="pending"&&(o.peers+=1)}}if(m&&l&&s.editors_bypass_approval&&(m=!1),(m||!!o.contested)&&t.moving==="confirmed"&&i.approved_move==="managers"&&!l&&r.push("הזמנה מאושרת: שינוי רק דרך מנהל החדר"),r.length)o.level="bad",o.reason=r[0];else if(o.contested){o.level="contest";const g=o.contested.title;o.reason=`חופף ל${g?`"${g}"`:"הזמנה קיימת"} · יישלח כבקשה מתחרה`}else m&&(o.level="pend",o.reason=o.approver?`באישור ${o.approver}`:"באישור מנהל היומן");return o}function ye(t){return t.level==="bad"||t.level==="contest"?{cls:"",text:t.reason}:t.level==="pend"?{cls:"pend",text:t.reason}:t.warn?{cls:"warn",text:t.warn}:null}function ws(t,e,s,a,i,o,r,l){const p=[e,s,`${w(a)}–${w(i)}`].filter(Boolean).join(" · ");return`${t==="resize"?"האורך עודכן":"הועבר"}: ${p}${o==="pending"?r?" · ממתין לאישור, המועד הקודם שמור":l?" · בקשה מתחרה, ממתין לאישור":" · ממתין לאישור":""}`}class gs{constructor(){this.items=[]}push(e){this.items.push(e),this.items.length>40&&this.items.shift()}pop(){return this.items.pop()}peek(){return this.items[this.items.length-1]}get size(){return this.items.length}drop(e){this.items=this.items.filter(s=>s.eventId!==e)}}function xs(t){return t.held?"משיכת השינוי":t.state==="pending"?"משיכה":"מחק"}function $s(t,e,s,a,i,o=10){let r,l;t.x-o-e>=8?(r=t.x-o-e,l="right"):t.x+t.w+o+e<=a-8?(r=t.x+t.w+o,l="left"):(r=$t(t.x+t.w/2-e/2,8,Math.max(8,a-e-8)),l="center");const p=$t(t.y-8,8,Math.max(8,i-s-8));return{left:r,top:p,origin:`${l} ${$t(t.y-p+12,0,s)}px`}}var ys=Object.defineProperty,ks=Object.getOwnPropertyDescriptor,F=(t,e,s,a)=>{for(var i=a>1?void 0:a?ks(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&ys(e,s,i),i};const U=(t,e,s)=>t.dispatchEvent(new CustomEvent(e,{detail:s,bubbles:!0,composed:!0})),Mt=t=>`${Y(Math.floor(t/60))}:${Y(t%60)}`,_s=t=>{const e=/^(\d{2}):(\d{2})$/.exec(t);return e?+e[1]*60+ +e[2]:null},Re=tt`
  :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); pointer-events: none; display: block; }
  .pop { position: fixed; pointer-events: auto; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border); border-radius: var(--sw-r-xl); box-shadow: var(--sw-shadow-3);
    opacity: 0; transform: scale(0.96); transition: opacity 160ms var(--sw-ease-dialog), transform 160ms var(--sw-ease-dialog); }
  .pop.in { opacity: 1; transform: none; }
  .pop.instant { transition: none; }
  .scrim { position: fixed; inset: 0; background: var(--sw-overlay); pointer-events: auto; opacity: 0; transition: opacity 220ms ease; }
  .scrim.in { opacity: 1; }
  .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; pointer-events: auto; background: var(--sw-menu-surface); border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0; box-shadow: var(--sw-shadow-3);
    padding: 8px 16px calc(18px + env(safe-area-inset-bottom, 0px)); max-block-size: 90vh; display: flex; flex-direction: column; gap: 11px; overflow: auto; overscroll-behavior: contain;
    transform: translateY(100%); transition: transform 280ms var(--sw-ease-drawer); }
  .sheet.in { transform: none; }
  .grab { inline-size: 40px; block-size: 5px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); margin: 2px auto 4px; flex: none; }
  .st { display: flex; gap: 8px; padding: 9px 11px; border-radius: var(--sw-r-lg); font-size: var(--sw-fs-sm); line-height: 1.42; }
  .st > sw-icon { margin-block-start: 2px; flex: none; }
  .st b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
  .st span { display: block; color: var(--sw-text-2); }
  .st.ok { background: var(--sw-success-soft); }
  .st.ok > sw-icon, .st.ok b { color: var(--sw-success-text); }
  .st.info { background: var(--sw-accent-soft); }
  .st.info > sw-icon { color: var(--sw-accent-text); }
  .st.bad { background: var(--sw-danger-soft); }
  .st.bad > sw-icon, .st.bad b { color: var(--sw-danger-text); }
  .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
  kbd { font: inherit; font-size: var(--sw-fs-2xs); border: 1px solid var(--sw-border-strong); border-block-end-width: 2px; border-radius: var(--sw-r-2xs); padding: 0 4px; background: var(--sw-surface-2); }
  .kb { margin-inline-start: auto; font-size: var(--sw-fs-xs); color: var(--sw-text-3); white-space: nowrap; }
  .x { inline-size: 32px; min-block-size: 32px; border: 0; background: transparent; }
  /* ROUND4-LEFTOVERS-2390 (D22 review): the popover also opens on a touch tablet - its close key is a 44 px target there */
  @media (pointer: coarse) { .x { inline-size: 44px; min-block-size: 44px; } }
  @media (prefers-reduced-motion: reduce) {
    .pop, .pop.in { transform: none; }
    .sheet, .sheet.in { transform: none; transition: opacity 200ms ease; }
    .sheet:not(.in) { opacity: 0; }
  }
`;function Qt(t,e){if(!t)return;const s=e??{x:window.innerWidth/2-20,y:window.innerHeight/3,w:40},a=$s(s,t.offsetWidth,t.offsetHeight,window.innerWidth,window.innerHeight);t.style.left=`${a.left}px`,t.style.top=`${a.top}px`,t.style.transformOrigin=a.origin}function ke(t,e){if(t.level==="bad")return n`<div class="st bad" role="status" data-cal-qc-status="bad"><sw-icon name="warning" size="16"></sw-icon><div><b>אי אפשר לשמור כאן</b><span>${t.reason}</span></div></div>`;if(t.level==="contest"){const s=t.contested;return n`<div class="st bad" role="status" data-cal-qc-status="contest"><sw-icon name="warning" size="16"></sw-icon><div><b>חופף ל${s.title?`"${s.title}"`:"הזמנה קיימת"} <span class="ltr num" style="display:inline">${w(s.start)}–${w(s.end)}</span></b>
      <span>אפשר לשלוח כבקשה מתחרה. ${t.approver??"מנהל היומן"} יחליט/תחליט, ומי שמאושר ראשון מקבל את המועד.</span></div></div>`}return t.level==="pend"?n`<div class="st info" role="status" data-cal-qc-status="pend"><sw-icon name="info" size="16"></sw-icon><div><b>תישלח לאישור</b>
    <span>${t.approver?`${t.approver}, מנהל/ת ${e?.name??"היומן"}, יקבל/תקבל התראה. `:""}עד ההחלטה ההזמנה מסומנת "ממתין לאישור".</span></div></div>`:n`<div class="st ok" role="status" data-cal-qc-status="ok"><sw-icon name="check" size="16"></sw-icon><div><b>פנוי</b>${t.warn?n`<span>${t.warn}</span>`:c}
    ${t.peers?n`<span>יש עוד ${t.peers===1?"בקשה ממתינה אחת":n`<span class="num">${t.peers}</span> בקשות ממתינות`} לחלון הזה</span>`:c}</div></div>`}let lt=class extends at{constructor(){super(...arguments),this.ctx=null,this.draft=null,this.hint=null,this.anchor=null,this.sheet=!1,this.instant=!1,this.busy=!1,this.error="",this.seriesClash=null,this.shown=!1}connectedCallback(){super.connectedCallback(),this.instant?this.shown=!0:requestAnimationFrame(()=>requestAnimationFrame(()=>this.shown=!0))}firstUpdated(){this.sheet||Qt(this.renderRoot.querySelector(".pop"),this.anchor),this.renderRoot.querySelector('[data-cal-qc="title"]')?.focus({preventScroll:!0})}updated(t){t.has("anchor")&&!this.sheet&&t.get("anchor")!==void 0&&Qt(this.renderRoot.querySelector(".pop"),this.anchor)}cals(){return(this.ctx?.cals??[]).filter(t=>!t.archived&&t.my_role&&t.my_role!=="view"&&t.type!=="maintenance")}set(t){U(this,"qc-change",t)}onKey(t){const e=t.target;t.key==="Escape"?(t.stopPropagation(),U(this,"qc-close")):t.key==="Enter"&&!["TEXTAREA","BUTTON","SELECT"].includes(e.tagName)&&(t.preventDefault(),U(this,"qc-save"))}allDay(t){const e=this.draft,s=this.cals().find(a=>a.id===e.calId);if(t){const a=(s&&qt(s,e.day))??{from:0,to:1440};this.set({allDay:!0,prev:[e.s,e.e],s:a.from,e:Math.min(a.to,1440)})}else this.set({allDay:!1,s:e.prev?.[0]??e.s,e:e.prev?.[1]??e.e})}time(t,e){const s=this.draft,a=_s(e);if(a!==null)if(t==="s"){const i=s.e-s.s;this.set({s:a,e:Math.min(1440,a+i)})}else a>s.s&&this.set({e:a})}render(){const t=this.draft,e=this.ctx;return!t||!e?c:this.sheet?this.sheetView(t,e):this.popView(t,e)}saveLabel(){const t=this.hint?.level;return t==="pend"||t==="contest"?"שליחה לאישור":"שמירה"}organizer(t,e){return e.access.can.book_for_others?n`<span class="sel plain"><select aria-label="בשם" data-cal-qc="behalf" @change=${s=>this.set({behalf:s.target.value})}>
          ${Object.keys(ft).map(s=>n`<option value=${s} ?selected=${t.behalf===s}>${s==="self"?"בשמי":`בשם ${ft[s]}`}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span>
        ${t.behalf!=="self"?n`<input class="fi" style="inline-size:140px" maxlength="80" data-cal-qc="behalf-label" .value=${t.behalfLabel} placeholder=${`שם ה${ft[t.behalf]}`}
          aria-label=${`שם ה${ft[t.behalf]}`} @input=${s=>this.set({behalfLabel:s.target.value})}>`:c}`:n`<span>מארגן: <b>אני</b></span><span class="lockl"><sw-icon name="lock" size="12"></sw-icon>בשם אחרים: למי שקיבל הרשאה</span>`}repeatLine(t){if(t.repeat==="none")return c;const e=W(t.day,t.s);return n`<div class="rs" data-cal-qc-series><sw-icon name="refresh" size="14"></sw-icon><span class="num">${Ae(t.repeat,t.count,e)}</span>
      ${this.seriesClash===null?c:this.seriesClash?n`· <b class="bad"><span class="num">${this.seriesClash}</span> מועדים לא פנויים</b>`:n`· <span>פנוי בכל המועדים</span>`}</div>`}attendees(t){return n`<div class="slot" data-cal-slot="attendees">${Me({surface:"quick",calendarId:t.calId,value:t.attendees,onChange:e=>this.set({attendees:e})})}</div>`}popView(t,e){const s=this.cals(),a=s.find(r=>r.id===t.calId),i=(a?.slot_step_min??15)*60,o=this.hint?.level==="bad";return n`<div class=${`pop${this.shown?" in":""}${this.instant?" instant":""}`} role="dialog" aria-label="אירוע חדש" data-cal-quick @keydown=${this.onKey}>
      <div class="qtop"><input class="qt" data-cal-qc="title" placeholder="הוספת כותרת" maxlength="120" aria-label="כותרת" .value=${t.title} @input=${r=>this.set({title:r.target.value})}>
        <button type="button" class="btn icon sm x" aria-label="סגירה" data-cal-qc-close @click=${()=>U(this,"qc-close")}><sw-icon name="close" size="16"></sw-icon></button></div>
      <div class="qr"><sw-icon name="clock" size="16"></sw-icon><div class="qv"><span>${G[t.day.getDay()]} ${pt(t.day)}</span>
        <span class="tm ltr"><input type="time" lang=${_t()} step=${i} aria-label="שעת התחלה" data-cal-qc="from" .value=${Mt(t.s)} ?disabled=${t.allDay} @change=${r=>this.time("s",r.target.value)}><span>–</span>
          <input type="time" lang=${_t()} step=${i} aria-label="שעת סיום" data-cal-qc="to" .value=${Mt(Math.min(t.e,1439))} ?disabled=${t.allDay} @change=${r=>this.time("e",r.target.value)}></span>
        <label class="ck"><input type="checkbox" data-cal-qc="allday" .checked=${t.allDay} @change=${r=>this.allDay(r.target.checked)}>כל היום</label></div></div>
      <div class="qr"><sw-icon name="pin" size="16"></sw-icon><div class="qv"><span class="sel" style=${`--h:${q(a?.color)}`}><span class="dot"></span>
          <select aria-label="יומן" data-cal-qc="calendar" @change=${r=>this.set({calId:r.target.value})}>${s.map(r=>n`<option value=${r.id} ?selected=${r.id===t.calId}>${r.name}</option>`)}</select>
          <sw-icon name="chevronDown" size="14"></sw-icon></span>${a?.floor_name||a&&a.approval_mode!=="none"&&a.my_role!=="manage"?n`<span class="muted">${[a?.floor_name,a&&a.approval_mode!=="none"&&a.my_role!=="manage"?"באישור":""].filter(Boolean).join(" · ")}</span>`:c}</div></div>
      <div class="qr"><sw-icon name="refresh" size="16"></sw-icon><div class="qv"><div class="seg" role="group" aria-label="חזרה">
        ${[["none","פעם אחת"],["weekly",`כל ${G[t.day.getDay()]}`],["daily","כל יום"]].map(([r,l])=>n`<button type="button" aria-pressed=${String(t.repeat===r)} data-cal-qc-repeat=${r} @click=${()=>this.set({repeat:r})}>${l}</button>`)}</div>
        ${t.repeat!=="none"?n`<span class="tm"><input type="number" min="2" max="104" class="num" style="inline-size:64px" aria-label="מספר מועדים" data-cal-qc="count" .value=${String(t.count)} @change=${r=>this.set({count:Math.min(104,Math.max(2,parseInt(r.target.value,10)||2))})}> <span class="muted">מועדים</span></span>`:c}</div></div>
      <div class="qr"><sw-icon name="user" size="16"></sw-icon><div class="qv">${this.organizer(t,e)}</div></div>
      <div class="qr"><sw-icon name="users" size="16"></sw-icon><div class="qv"><span class="step"><button type="button" aria-label="פחות משתתפים" data-cal-qc-step="-1" @click=${()=>this.set({headcount:Math.max(0,t.headcount-1)})}>−</button>
        <b class="num">${t.headcount||"—"}</b><button type="button" aria-label="יותר משתתפים" data-cal-qc-step="1" @click=${()=>this.set({headcount:t.headcount+1})}>+</button></span>
        ${a?.capacity?n`<span class="muted">משתתפים · <span class="num">${a.capacity}</span> מקומות</span>`:n`<span class="muted">משתתפים</span>`}</div></div>
      ${this.attendees(t)}
      ${this.hint?ke(this.hint,a):c}
      ${this.repeatLine(t)}
      ${this.error?n`<div class="err" role="alert" data-cal-qc-error>${this.error}</div>`:c}
      <div class="qf"><button type="button" class="btn pri" ?disabled=${o||this.busy} data-cal-qc-save @click=${()=>U(this,"qc-save")}><sw-icon name="check" size="16"></sw-icon>${this.saveLabel()}</button>
        <button type="button" class="btn" data-cal-qc-more @click=${()=>U(this,"qc-more")}>פרטים נוספים</button>
        <span class="kb"><kbd>Enter</kbd> שמירה · <kbd>Esc</kbd> ביטול</span></div>
    </div>`}sheetView(t,e){const s=this.cals().find(p=>p.id===t.calId),a=Math.max(15,s?.slot_step_min??15),i=t.e-t.s,o=(s&&qt(s,t.day))??{from:0,to:1440},r=p=>{const u=Math.min(Math.max(t.s+p*a,o.from),o.to-i);this.set({s:u,e:u+i,allDay:!1})},l=p=>this.set({e:Math.min(Math.max(t.e+p*a,t.s+a),o.to),allDay:!1});return n`<div class=${`scrim${this.shown?" in":""}`} @click=${()=>U(this,"qc-close")}></div>
      <div class=${`sheet${this.shown?" in":""}`} role="dialog" aria-modal="true" aria-label="הזמנה חדשה" data-cal-quick="sheet" @keydown=${this.onKey}>
        <div class="grab"></div><h2>הזמנה חדשה</h2>
        <div class="muted">${s?.name??""} · ${G[t.day.getDay()]} ${pt(t.day)} · <span class="ltr num">${Mt(t.s)}–${Mt(Math.min(t.e,1440))}</span></div>
        <div class="tbig">
          <div class="tcol"><small>התחלה</small><div class="stp"><button type="button" aria-label="התחלה מאוחר יותר" data-cal-qc-tm="s+" @click=${()=>r(1)}>+</button><b class="num ltr">${Mt(t.s)}</b>
            <button type="button" aria-label="התחלה מוקדם יותר" data-cal-qc-tm="s-" @click=${()=>r(-1)}>−</button></div></div>
          <div class="tcol"><small>סיום</small><div class="stp"><button type="button" aria-label="סיום מאוחר יותר" data-cal-qc-tm="e+" @click=${()=>l(1)}>+</button><b class="num ltr">${Mt(Math.min(t.e,1440))}</b>
            <button type="button" aria-label="סיום מוקדם יותר" data-cal-qc-tm="e-" @click=${()=>l(-1)}>−</button></div></div></div>
        <div class="chips">${[30,60,120,180].map(p=>n`<button type="button" class="chipb" aria-pressed=${String(i===p)} data-cal-qc-len=${p} @click=${()=>this.set({e:Math.min(o.to,t.s+p),allDay:!1})}>${Et(p)}</button>`)}</div>
        <input class="inp" data-cal-qc="title" maxlength="120" aria-label="כותרת" placeholder="כותרת" .value=${t.title} @input=${p=>this.set({title:p.target.value})}>
        ${this.attendees(t)}
        ${this.hint?ke(this.hint,s):c}
        ${this.error?n`<div class="err" role="alert" data-cal-qc-error>${this.error}</div>`:c}
        <div class="qf"><button type="button" class="btn pri wide" ?disabled=${this.hint?.level==="bad"||this.busy} data-cal-qc-save @click=${()=>U(this,"qc-save")}><sw-icon name="check" size="16"></sw-icon>${this.saveLabel()}</button>
          <button type="button" class="btn" data-cal-qc-more @click=${()=>U(this,"qc-more")}>פרטים נוספים</button></div>
      </div>`}};lt.styles=[nt,Re,tt`
    .pop { inline-size: min(372px, calc(100vw - 16px)); padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }
    .qtop { display: flex; gap: 8px; align-items: center; }
    .qt { flex: 1; min-inline-size: 0; font: inherit; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); border: 0; border-block-end: 2px solid var(--sw-accent); background: transparent;
      padding: 4px 2px 6px; color: var(--sw-heading); outline: none; border-radius: 0; }
    .qt::placeholder { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
    .qr { display: flex; gap: 10px; align-items: flex-start; }
    .qr > sw-icon { margin-block-start: 8px; color: var(--sw-text-3); flex: none; }
    .qv { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; min-inline-size: 0; flex: 1; min-block-size: 34px; font-size: var(--sw-fs-md); }
    .qv .muted { font-size: var(--sw-fs-sm); }
    .tm { display: inline-flex; align-items: center; gap: 4px; }
    .tm input, .fi { font: inherit; font-size: var(--sw-fs-md); border: 1px solid transparent; background: var(--sw-surface-2); border-radius: var(--sw-r-sm); padding: 5px 8px; color: var(--sw-heading); min-block-size: 32px; }
    .tm input[type='time'] { inline-size: 96px; font-variant-numeric: tabular-nums; }
    .tm input:focus, .fi:focus, .sel select:focus, .qt:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .ck { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--sw-fs-sm); }
    .ck input { inline-size: 16px; block-size: 16px; accent-color: var(--sw-accent); margin: 0; }
    .sel { position: relative; display: inline-flex; align-items: center; }
    .sel .dot { position: absolute; inset-inline-start: 10px; pointer-events: none; }
    .sel sw-icon { position: absolute; inset-inline-end: 8px; pointer-events: none; color: var(--sw-text-3); }
    .sel select { appearance: none; font: inherit; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); border: 1px solid transparent; background: var(--sw-surface-2); border-radius: var(--sw-r-sm);
      padding-block: 5px; padding-inline: 28px 30px; color: var(--sw-heading); min-block-size: 32px; cursor: pointer; max-inline-size: 220px; }
    .sel.plain select { padding-inline-start: 10px; }
    .step { display: inline-flex; align-items: center; gap: 2px; background: var(--sw-surface-2); border-radius: var(--sw-r-pill); padding: 2px; }
    .step button { inline-size: 28px; block-size: 28px; border: 0; border-radius: 50%; background: transparent; cursor: pointer; font-size: var(--sw-fs-lg); line-height: 1; color: var(--sw-heading); }
    .step button:active { background: var(--sw-surface-3); }
    .step b { min-inline-size: 26px; text-align: center; }
    @media (pointer: coarse) { .step button { inline-size: 44px; block-size: 44px; } }
    .lockl { display: inline-flex; gap: 5px; align-items: center; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .rs { font-size: var(--sw-fs-sm); color: var(--sw-text-2); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .rs .bad { color: var(--sw-danger-text); }
    .qf { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .slot:empty { display: none; }
    .tbig { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tcol { background: var(--sw-surface-2); border-radius: var(--sw-r-lg); padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; align-items: center; }
    .tcol small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .tcol .stp { display: flex; align-items: center; gap: 8px; }
    .tcol .stp b { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .tcol .stp button { inline-size: 44px; block-size: 44px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); font-size: var(--sw-fs-xl); cursor: pointer; color: var(--sw-heading); }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .sheet h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .sheet .btn { min-block-size: 46px; }
    .sheet .wide { flex: 1; }
  `];F([y({attribute:!1})],lt.prototype,"ctx",2);F([y({attribute:!1})],lt.prototype,"draft",2);F([y({attribute:!1})],lt.prototype,"hint",2);F([y({attribute:!1})],lt.prototype,"anchor",2);F([y({type:Boolean})],lt.prototype,"sheet",2);F([y({type:Boolean})],lt.prototype,"instant",2);F([y({type:Boolean})],lt.prototype,"busy",2);F([y()],lt.prototype,"error",2);F([y({attribute:!1})],lt.prototype,"seriesClash",2);F([d()],lt.prototype,"shown",2);lt=F([it("cal-quick-create")],lt);let vt=class extends at{constructor(){super(...arguments),this.ctx=null,this.occ=null,this.anchor=null,this.sheet=!1,this.busy=!1,this.error="",this.displaceAsk=null,this.shown=!1}connectedCallback(){super.connectedCallback(),requestAnimationFrame(()=>requestAnimationFrame(()=>this.shown=!0))}firstUpdated(){this.sheet||Qt(this.renderRoot.querySelector(".pop"),this.anchor),this.renderRoot.querySelector("[data-cal-pk-close]")?.focus({preventScroll:!0})}updated(t){t.has("displaceAsk")&&!this.sheet&&Qt(this.renderRoot.querySelector(".pop"),this.anchor)}cal(){return this.ctx?.cals.find(t=>t.id===this.occ?.calendar_id)}whyNot(){const t=this.occ,e=this.cal();return!e?.my_role||e.my_role==="view"?"צפייה בלבד":t.kind==="maintenance"?'חלון תחזוקה נערך בלשונית "תחזוקה"':new Date(t.end)<=(this.ctx?.now??new Date)?"המועד כבר עבר":t.kind==="external"||t.kind==="holiday"?"אירוע מיומן חיצוני":"רק המארגן או מנהל היומן יכולים לשנות"}render(){const t=this.occ;if(!t||!this.ctx)return c;const e=this.content(t);return this.sheet?n`<div class=${`scrim${this.shown?" in":""}`} @click=${()=>U(this,"pk-close")}></div>
        <div class=${`sheet${this.shown?" in":""}`} role="dialog" aria-modal="true" aria-label=${t.title??"תפוס"} data-cal-peek="sheet" @keydown=${this.onKey}><div class="grab"></div>${e}</div>`:n`<div class=${`pop${this.shown?" in":""}`} role="dialog" aria-label=${t.title??"תפוס"} data-cal-peek @keydown=${this.onKey}>${e}</div>`}onKey(t){t.key==="Escape"&&(t.stopPropagation(),U(this,"pk-close"))}content(t){const e=this.ctx,s=this.cal(),a=!!t.can_edit&&new Date(t.end)>e.now,i=!!t.title&&t.kind!=="maintenance"&&!!s?.my_role&&s.my_role!=="view"&&!t.recurring,o=s?.my_role==="manage"&&t.state==="pending"&&t.kind!=="maintenance",r=Math.round((new Date(t.end).getTime()-new Date(t.start).getTime())/6e4),l=[t.state==="confirmed"&&t.kind!=="maintenance"?n`<span class="chip ok">מאושר</span>`:c,t.state==="pending"?n`<span class="chip dash">ממתין לאישור</span>`:c,t.contested?n`<span class="chip bad"><sw-icon name="warning" size="12"></sw-icon>חופף להזמנה מאושרת</span>`:c,t.held?n`<span class="chip warn">בקשת שינוי</span>`:c,t.kind==="maintenance"?n`<span class="chip warn">חלון תחזוקה</span>`:c,t.state==="displaced"?n`<span class="chip warn">נדחק · צריך לבחור מועד אחר</span>`:c,t.recurring?n`<span class="chip">חוזר</span>`:c],p=t.held&&t.held.calendar_id!==t.calendar_id?e.cals.find(u=>u.id===t.held?.calendar_id)?.name:"";return n`<div class="pkh" style=${`--h:${t.kind==="maintenance"?"var(--cal-orange)":q(s?.color)}`}><span class="sq"></span><h3>${t.title??"תפוס"}</h3>
        <button type="button" class="btn icon sm x" aria-label="סגירה" data-cal-pk-close @click=${()=>U(this,"pk-close")}><sw-icon name="close" size="16"></sw-icon></button></div>
      <div class="pkl"><sw-icon name="pin" size="14"></sw-icon><span class="ell">${s?.name??""}</span></div>
      <div class="pkl"><sw-icon name="clock" size="14"></sw-icon><span>${G[new Date(t.start).getDay()]} ${pt(new Date(t.start))} · <span class="ltr num">${w(t.start)}–${w(t.end)}</span> · ${Et(r)}</span></div>
      ${t.organizer||t.on_behalf_label?n`<div class="pkl"><sw-icon name="user" size="14"></sw-icon><span class="ell">${[t.organizer?.name,t.on_behalf_label?`בשם ${t.on_behalf_label}`:""].filter(Boolean).join(" · ")}</span></div>`:c}
      <div class="chips">${l}</div>
      ${t.held?n`<div class="note" role="note" data-cal-pk-held><sw-icon name="info" size="16"></sw-icon><div>המועד הקודם <span class="ltr num">${w(t.held.start)}–${w(t.held.end)}</span>${p?` ב${p}`:""} שמור עד ההחלטה. דחייה תחזיר את ההזמנה אליו.</div></div>`:c}
      ${a?c:n`<div class="note" role="note" data-cal-pk-why><sw-icon name="lock" size="16"></sw-icon><div>${this.whyNot()}</div></div>`}
      ${this.error?n`<div class="err" role="alert" data-cal-pk-error>${this.error}</div>`:c}
      ${a||i?n`<div class="pka">
        ${a?n`<button type="button" class="btn sm" data-cal-pk="edit" @click=${()=>U(this,"pk-edit")}><sw-icon name="edit" size="14"></sw-icon>ערוך</button>`:c}
        ${i?n`<button type="button" class="btn sm" ?disabled=${this.busy} data-cal-pk="dup" @click=${()=>U(this,"pk-dup")}><sw-icon name="copy" size="14"></sw-icon>שכפל</button>`:c}
        ${a?n`<button type="button" class="btn sm bad" ?disabled=${this.busy} data-cal-pk="del" @click=${()=>U(this,"pk-del")}><sw-icon name="trash" size="14"></sw-icon>${xs(t)}</button>
          ${this.sheet?c:n`<span class="kb"><kbd>Del</kbd> מחיקה</span>`}`:c}</div>`:c}
      ${o?n`<div class="pka">
        <button type="button" class="btn sm pri" ?disabled=${this.busy} data-cal-pk="approve" @click=${()=>U(this,"pk-approve",{displace:!1})}><sw-icon name="check" size="14"></sw-icon>אישור</button>
        <button type="button" class="btn sm bad" ?disabled=${this.busy} data-cal-pk="reject" @click=${()=>U(this,"pk-reject")}><sw-icon name="close" size="14"></sw-icon>דחייה</button></div>`:c}
      ${this.displaceAsk?n`<div class="note warn" role="alert" data-cal-pk-displace><sw-icon name="warning" size="16"></sw-icon><div><b>יש הזמנה מאושרת בחלון</b>
        ${this.displaceAsk.title?`"${this.displaceAsk.title}" `:""}<span class="ltr num">${w(this.displaceAsk.start)}–${w(this.displaceAsk.end)}</span>. אישור ידחק אותה: היא לא תימחק, והמארגן יבחר מועד אחר.
        <div class="pka" style="border:0;padding-block-start:8px"><button type="button" class="btn sm bad fill" ?disabled=${this.busy} data-cal-pk="displace" @click=${()=>U(this,"pk-approve",{displace:!0})}>לאשר ולדחוק</button>
          <button type="button" class="btn sm" @click=${()=>U(this,"pk-back")}>חזרה</button></div></div></div>`:c}`}};vt.styles=[nt,Re,tt`
    .pop { inline-size: min(320px, calc(100vw - 16px)); padding: 14px; display: flex; flex-direction: column; gap: 9px; }
    .pkh { display: flex; gap: 8px; align-items: flex-start; }
    .pkh h3 { margin: 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); flex: 1; min-inline-size: 0; line-height: 1.3; overflow-wrap: anywhere; }
    .pkh .sq { inline-size: 12px; block-size: 12px; margin-block-start: 5px; border-radius: var(--sw-r-2xs); }
    .pkl { display: flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
    .pkl sw-icon { color: var(--sw-text-3); flex: none; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .pka { display: flex; gap: 6px; flex-wrap: wrap; border-block-start: 1px solid var(--sw-border); padding-block-start: 10px; align-items: center; }
    .note { padding: 9px 11px; font-size: var(--sw-fs-sm); }
    .note b { font-size: var(--sw-fs-sm); }
    .sheet .btn { min-block-size: 44px; }
  `];F([y({attribute:!1})],vt.prototype,"ctx",2);F([y({attribute:!1})],vt.prototype,"occ",2);F([y({attribute:!1})],vt.prototype,"anchor",2);F([y({type:Boolean})],vt.prototype,"sheet",2);F([y({type:Boolean})],vt.prototype,"busy",2);F([y()],vt.prototype,"error",2);F([y({attribute:!1})],vt.prototype,"displaceAsk",2);F([d()],vt.prototype,"shown",2);vt=F([it("cal-peek")],vt);const Wt={user:"משתמש",resident:"דייר",guest:"אורח"},Ht={required:"חובה",optional:"רשות"},je={invited:"הוזמן",accepted:"מגיע",declined:"לא מגיע",tentative:"אולי"},_e={accepted:"מגיע/ה",tentative:"אולי",declined:"לא מגיע/ה"},zs="פרטי הקשר של אורחים גלויים רק למארגן ולמנהלי היומן.",Ss=/^\+[1-9]\d{7,14}$/,Ds=/^[^@\s<>"',;]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;function Be(t){let e=t.replace(/[\s\-().]/g,"");return e.startsWith("00")?e=`+${e.slice(2)}`:e.startsWith("0")&&(e=`+972${e.slice(1)}`),e}function Es(t,e,s){const a={},i=t.trim();i?i.length>80&&(a.name="השם ארוך מדי."):a.name="חסר שם האורח.";const o=e.trim(),r=s.trim();return o&&!Ss.test(Be(o))&&(a.phone="מספר הטלפון אינו תקין."),r&&(r.length>254||!Ds.test(r))&&(a.email="כתובת הדוא״ל אינה תקינה."),!o&&!r&&(a.phone="לאורח צריך טלפון או דוא״ל."),a}const Os=t=>Object.keys(t).length>0;let Ts=0;const Cs=()=>`d${++Ts}`;function Is(t,e="required"){return{key:`${t.kind}:${t.ref_id}`,kind:t.kind,ref_id:t.ref_id,name:t.name,role:e}}function Ms(t,e,s,a="required"){const i=e.trim();return{key:Cs(),kind:"guest",name:t.trim(),role:a,...i?{phone:Be(i)}:{},...s.trim()?{email:s.trim().toLowerCase()}:{}}}function qs(t){return{key:t.ref_id?`${t.kind}:${t.ref_id}`:`id:${t.id}`,id:t.id,kind:t.kind,ref_id:t.ref_id??void 0,name:t.name,role:t.role,status:t.status,phone:t.contact?.phone||void 0,email:t.contact?.email||void 0}}function He(t,e){return t.some(s=>s.kind===e.kind&&s.ref_id===e.ref_id)?t:[...t,Is(e)]}const ze=t=>t==="required"?"optional":"required";function ce(t){return t.map(e=>e.kind==="guest"?{kind:"guest",name:e.name,role:e.role,...e.phone?{phone:e.phone}:{},...e.email?{email:e.email}:{}}:{kind:e.kind,ref_id:e.ref_id,role:e.role})}function As(t){return[t.name||Wt[t.kind],Wt[t.kind],Ht[t.role],t.status?je[t.status]:""].filter(Boolean).join(", ")}function Fe(t){return t===null?"":t===0?"אין מוזמנים":t===1?"מוזמן אחד":`${t} מוזמנים`}function Ps(t,e){return t.filter(s=>!e.some(a=>a.kind===s.kind&&a.ref_id===s.ref_id))}function Ls(t){const e=a=>t.filter(i=>i.status===a).length,s=[];return e("accepted")&&s.push(`${e("accepted")} מגיעים`),e("tentative")&&s.push(`${e("tentative")} אולי`),e("declined")&&s.push(`${e("declined")} לא מגיעים`),e("invited")&&s.push(`${e("invited")} טרם ענו`),s.join(" · ")}var Rs=Object.defineProperty,js=Object.getOwnPropertyDescriptor,E=(t,e,s,a)=>{for(var i=a>1?void 0:a?js(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&Rs(e,s,i),i};const Ft=7,de=22,D={from:Ft*60,to:de*60},Bs={contested_requests:"queue",maintenance_overlap:"first_holds",editors_bypass_approval:!0,pending_holds_slot:!1},Se="sw.cal.grid.coach",Hs=6e3;let S=class extends at{constructor(){super(...arguments),this.ctx=null,this.resident=!1,this.mode="month",this.anchor=M(new Date),this.picked=null,this.hiddenCals=new Set,this.occ=[],this.error="",this.switcherOpen=!1,this.dayPage=1,this.cap=3,this.sel=null,this.draft=null,this.ov=null,this.ovAnchor=null,this.ovInstant=!1,this.ovBusy=!1,this.ovError="",this.seriesClash=null,this.peek=null,this.displaceAsk=null,this.drag=null,this.lifted="",this.hover=null,this.ring=null,this.toast=null,this.toastIn=!1,this.coach=!0,this.live="",this.fresh=new Set,this.hints=Bs,this.undoStack=new gs,this.press=null,this.pressTimer=0,this.toastTimer=0,this.seriesTimer=0,this.kb=null,this.lastClick=null,this.lastCal="",this.cols=[],this.loadedKey="",this.ro=null,this.host=null,this.onChanged=()=>this.reload(),this.onDocKey=t=>this.docKey(t),this.onDocDown=t=>{this.ov!=="quick"&&this.ov!=="peek"||t.composedPath().includes(this)||this.closeOverlay()},this.onDown=t=>{if(t.button!==0)return;const e=this.colAt(t);if(!e)return;this.hover=null,this.ov&&this.closeOverlay();const s=t.pointerType!=="mouse",a=this.minuteIn(e.el,t.clientY),i=t.composedPath(),o=i.find(p=>p instanceof HTMLElement&&p.dataset.occ);let r;if(o){const p=this.occ.find(m=>m.occurrence_id===o.dataset.occ);if(!p)return;const v=i.some(m=>m instanceof HTMLElement&&m.classList.contains("rz"))?"resize":"move";r={kind:"event",col:e.ci,at:a,id:p.occurrence_id,editable:this.editable(p,v),mode:v}}else this.calForCol(e.ci)?r={kind:"slot",col:e.ci,at:a}:r={kind:"none"};try{t.currentTarget.setPointerCapture(t.pointerId)}catch{}const l=new ms(r,t.clientX,t.clientY,s);if(this.press=l,s&&r.kind!=="none"){if(r.kind==="slot"){const p=e.el.getBoundingClientRect();this.ring={col:e.ci,x:t.clientX-p.left,y:t.clientY-p.top}}this.pressTimer=window.setTimeout(()=>{if(this.press!==l)return;const p=l.onTimer();if(this.ring=null,p==="select"&&r.kind==="slot"){const u=this.calForCol(r.col),v=xe(Ot(r.at,ct(u),D),r.at,ct(u),D,30);this.sel={col:r.col,...v},navigator.vibrate?.(8)}else p==="lift"&&r.kind==="event"&&(this.lifted=r.id,navigator.vibrate?.(8))},l.delay)}},this.onMove=t=>{const e=this.press;if(!e){this.hoverAt(t);return}const s=e.onMove(t.clientX,t.clientY);if(s==="cancel"){clearTimeout(this.pressTimer),this.ring=null;return}if(s==="none")return;const a=e.target;if(a.kind==="slot"){const i=this.colEls()[a.col];if(!i)return;const o=this.calForCol(a.col),r=ct(o);this.sel={col:a.col,...xe(Ot(a.at,r,D),this.minuteIn(i,t.clientY),r,D,e.touch?30:r)}}else if(a.kind==="event"){const i=this.occ.find(o=>o.occurrence_id===a.id);if(!i)return;s==="start"&&(this.lifted=""),this.updateDrag(i,a,t)}},this.onUp=t=>{const e=this.press;if(!e)return;clearTimeout(this.pressTimer),this.ring=null,this.press=null;const s=e.onUp(),a=e.target;if(a.kind==="slot"){if(s==="coach"){this.showCoach();return}if(s!=="click")return;if(!this.sel||!e.started){const i=this.calForCol(a.col);this.sel={col:a.col,...ds(a.at,ct(i),D)}}this.openQuick(!1);return}if(a.kind==="event"){const i=this.occ.find(o=>o.occurrence_id===a.id);if(this.lifted="",s==="drop"&&this.drag){this.endDrag();return}if(s==="click"&&i){const o=Date.now();if(this.lastClick&&this.lastClick.id===i.occurrence_id&&o-this.lastClick.t<350){this.lastClick=null,this.closeOverlay(),this.openDrawer(i.event_id);return}this.lastClick={id:i.occurrence_id,t:o};const r=this.renderRoot.querySelector(`[data-occ="${CSS.escape(i.occurrence_id)}"]`);this.openPeek(i,r)}}},this.onCancel=()=>{clearTimeout(this.pressTimer),this.press=null,this.ring=null,this.drag=null,this.lifted=""},this.onGridKey=t=>{if(t.target!==t.currentTarget||!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key))return;const e=this.ctx;if(!this.cols.some((u,v)=>!!this.calForCol(v))){t.key!=="Enter"&&this.say("צפייה בלבד");return}t.preventDefault();const a=this.cols.findIndex(u=>Z(u.day,e.now)),i=Math.max(0,this.cols.findIndex((u,v)=>!!this.calForCol(v)&&(a<0||v>=a))),o=a>=0?Math.ceil(Yt(e.now)/15)*15:540,r=ct(this.calForCol(this.kb?.col??i)),l=fs(this.kb,t.key,t.shiftKey,this.cols.length,r,D,{col:i,min:Math.min(Math.max(o,D.from),D.to-r)},getComputedStyle(this).direction!=="ltr");if(l.kind==="none")return;if(l.kind==="open"){this.sel??={col:l.span.col,s:l.span.s,e:l.span.e},this.openQuick(!0);return}this.kb=l.sel,this.sel={col:l.span.col,s:l.span.s,e:l.span.e};const p=this.cols[l.span.col];this.say(`${p?.cal?p.cal.name:G[p?.day.getDay()??0]} ${this.mm(l.span.s)} עד ${this.mm(l.span.e)}`)}}connectedCallback(){super.connectedCallback();const t=le("view");this.mode=this.resident?"day":t==="week"||t==="day"?t:"month",this.anchor=Pe(le("date"),this.ctx?.now??new Date);try{const s=sessionStorage.getItem("sw.cal.hidden");s&&!this.resident&&(this.hiddenCals=new Set(JSON.parse(s))),this.coach=localStorage.getItem(Se)!=="off"}catch{}this.ro=new ResizeObserver(()=>this.fitMonth());let e=this.getRootNode().host??null;for(;e&&e.tagName!=="CALENDARS-PAGE"&&e.getRootNode()instanceof ShadowRoot;)e=e.getRootNode().host;this.host=e,this.host?.addEventListener(z.changed,this.onChanged),document.addEventListener("keydown",this.onDocKey),document.addEventListener("pointerdown",this.onDocDown),this.loadSettings()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.host?.removeEventListener(z.changed,this.onChanged),document.removeEventListener("keydown",this.onDocKey),document.removeEventListener("pointerdown",this.onDocDown),clearTimeout(this.pressTimer),clearTimeout(this.toastTimer),clearTimeout(this.seriesTimer)}updated(){const t=this.renderRoot.querySelector(".mgrid");t&&this.ro&&this.ro.observe(t)}willUpdate(t){t.has("resident")&&this.resident&&(this.mode="day"),(t.has("ctx")||t.has("mode")||t.has("anchor"))&&this.load()}async loadSettings(){try{const t=this.ctx?.api;if(!t)return;const{settings:e}=await t.settings();this.hints={contested_requests:e.contested_requests,maintenance_overlap:e.maintenance_overlap,editors_bypass_approval:e.editors_bypass_approval,pending_holds_slot:e.pending_holds_slot}}catch{}}fitMonth(){const t=this.renderRoot.querySelector(".mcell");if(!t)return;const e=Math.max(0,Math.floor((t.clientHeight-52)/23));e!==this.cap&&(this.cap=e)}range(){if(this.mode==="month"){const t=me(this.anchor);return{from:t[0].day,to:B(t[41].day,1)}}if(this.mode==="week"){const t=te(this.anchor);return{from:t,to:B(t,7)}}return{from:M(this.anchor),to:B(M(this.anchor),1)}}async load(){const t=this.ctx;if(!t)return;const{from:e,to:s}=this.range(),a=`${e.toISOString()}|${s.toISOString()}|${t.cals.map(i=>i.id).join(",")}`;if(a!==this.loadedKey){this.loadedKey=a;try{const i=await t.api.occurrences(e.toISOString(),s.toISOString());if(this.loadedKey!==a)return;this.occ=i.occurrences.filter(o=>!["cancelled","rejected","withdrawn","expired"].includes(o.state)),this.error=""}catch(i){this.error=_(i)}}}reload(){this.loadedKey="",this.load()}setMode(t){this.mode=this.resident?"day":t,this.dayPage=1,this.clearSel(),this.resident||Ut({view:t,date:X(this.anchor)})}go(t){const e=this.anchor;this.anchor=this.mode==="month"?new Date(e.getFullYear(),e.getMonth()+t,1):B(e,this.mode==="week"?t*7:t),this.picked=null,this.clearSel(),this.resident||Ut({view:this.mode,date:X(this.anchor)})}today(){this.anchor=M(this.ctx?.now??new Date),this.picked=null,this.clearSel(),this.resident||Ut({view:this.mode,date:X(this.anchor)})}toggle(t){const e=new Set(this.hiddenCals);e.has(t)?e.delete(t):e.add(t),this.hiddenCals=e;try{sessionStorage.setItem("sw.cal.hidden",JSON.stringify([...e]))}catch{}}shownCals(){const t=re(this.ctx).filter(e=>!this.hiddenCals.has(e.id));return this.resident?t.filter(e=>e.type==="room"&&e.my_role&&e.my_role!=="view"):t}shownOcc(){const t=new Set(this.shownCals().map(e=>e.id));return this.occ.filter(e=>t.has(e.calendar_id)||e.room_calendar_ids.some(s=>t.has(s)))}calOf(t){return this.ctx?.cals.find(e=>e.id===t)}rangeTitle(){const t=this.anchor;if(this.mode==="month")return`${Rt[t.getMonth()]} ${t.getFullYear()}`;if(this.mode==="week"){const e=te(t),s=B(e,6);return e.getMonth()===s.getMonth()?`${e.getDate()}–${s.getDate()} ב${Rt[e.getMonth()]} ${e.getFullYear()}`:`${e.getDate()}.${Y(e.getMonth()+1)}–${s.getDate()}.${Y(s.getMonth()+1)}.${s.getFullYear()}`}return`${G[t.getDay()]}, ${t.getDate()} ב${Rt[t.getMonth()]}`}render(){const t=this.ctx;if(!t)return c;const e=t.device,s=this.resident||e==="phone"||e==="tablet"&&t.access.ui.tablet_panels==="collapse";return n`
      ${s?c:this.switcher(e==="tablet")}
      <section class="panel main" data-cal-view=${this.mode}>
        ${this.header(s)}
        ${this.error?n`<div class="fail" role="alert" data-cal-error>${this.error}</div>`:c}
        ${this.coachLine()}
        ${this.mode==="month"?this.month():this.week(this.mode==="day")}
      </section>
      ${s&&this.switcherOpen&&!this.resident?n`<div class="scrim" @click=${()=>this.switcherOpen=!1}></div>${this.switcher(!1,!0)}`:c}
      ${this.overlay()}
      <div class="toasts">${this.toast?n`<div class=${`toast${this.toastIn?" in":""}${this.toast.bad?" bad":""}`} role="status" data-cal-grid-toast>
        <span>${this.toast.text}</span>${this.toast.undo?n`<button type="button" class="tb" data-cal-undo @click=${()=>void this.undo()}>בטל</button>`:c}</div>`:c}</div>
      <div class="vh" aria-live="polite" data-cal-live>${this.live}</div>`}header(t){const e=this.shownCals().length,s=this.resident?["day"]:["month","week","day"];return n`<div class="ph" data-cal-head>
      <span class="big" data-cal-title>${this.rangeTitle()}</span>
      <button type="button" class="btn icon sm" aria-label="הקודם" data-cal-prev @click=${()=>this.go(-1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <button type="button" class="btn icon sm" aria-label="הבא" data-cal-next @click=${()=>this.go(1)}><sw-icon name="chevron" size="16"></sw-icon></button>
      <button type="button" class="btn sm" data-cal-today @click=${()=>this.today()}>היום</button>
      <span class="sp"></span>
      ${t&&!this.resident?n`<button type="button" class="btn sm" data-cal-switcher-open aria-expanded=${String(this.switcherOpen)} @click=${()=>this.switcherOpen=!0}>
        <sw-icon name="calendar" size="16"></sw-icon><span class="num">${e}</span> יומנים</button>`:c}
      ${s.length>1?n`<div class="seg" role="group" aria-label="תצוגה">
        ${s.map(a=>n`<button type="button" aria-pressed=${String(this.mode===a)} data-cal-mode=${a} @click=${()=>this.setMode(a)}>${{month:"חודש",week:"שבוע",day:"יום"}[a]}</button>`)}
      </div>`:c}
    </div>`}switcher(t,e=!1){const s=this.ctx,a=re(s),i=a.filter(o=>!this.hiddenCals.has(o.id)).length;return n`<aside class=${`panel switcher${t&&s.access.ui.tablet_panels==="shrink"?" narrow":""}${e?" overlay":""}`} data-cal-switcher aria-label="יומנים">
      <div class="ph"><h2>יומנים</h2><span class="sp"></span><span class="muted num">${i} מתוך ${a.length}</span>
        ${e?n`<button type="button" class="btn icon sm" aria-label="סגירה" data-cal-switcher-close @click=${()=>this.switcherOpen=!1}><sw-icon name="close" size="16"></sw-icon></button>`:c}</div>
      <div class="list">
        ${Xe(a).map(o=>n`<div class="grp">${Qe[o.type]}</div>
          ${o.cals.map(r=>n`<button type="button" class="cal-it" style=${`--h:${q(r.color)}`} aria-pressed=${String(!this.hiddenCals.has(r.id))} data-cal-toggle=${r.id} @click=${()=>this.toggle(r.id)}>
            <span class="box"><sw-icon name="check" size="13"></sw-icon></span><span class="ell" title=${r.name}>${r.name}</span>
            ${r.my_role==="view"?n`<span class="lock" title="צפייה בלבד"><sw-icon name="lock" size="14"></sw-icon></span>`:c}</button>`)}`)}
      </div></aside>`}month(){const t=this.ctx,e=t.device==="phone",s=me(this.anchor),a=this.shownOcc().filter(l=>!l.held_slot),i=t.now,o=e?0:this.cap,r=this.picked??(this.anchor.getMonth()===i.getMonth()&&this.anchor.getFullYear()===i.getFullYear()?M(i):this.anchor);return n`<div class="month" data-cal-month>
        <div class="mhead">${(e?kt:G).map(l=>n`<div>${l}</div>`)}</div>
        <div class="mgrid">${s.map(({day:l,inMonth:p})=>{const u=Pt(a,l),v=u.find(b=>b.kind==="holiday"),m=u.filter(b=>b.kind!=="holiday"),h=l.getDay()>=5,x=Z(l,i);return n`<button type="button" class=${`mcell${p?"":" out"}${h?" we":""}${x?" today":""}`} aria-pressed=${String(e&&Z(l,r))}
            aria-label=${`${l.getDate()} ב${Rt[l.getMonth()]}, ${m.length} אירועים`} data-cal-day=${X(l)} @click=${()=>this.pickDay(l)}>
            <div class="d"><b class="num">${l.getDate()}</b>${v&&!e?n`<span class="ell">${v.title}</span>`:c}</div>
            ${m.slice(0,o).map(b=>this.monthEv(b))}
            ${e?n`<span class="dots">${u.slice(0,4).map(b=>n`<i style=${`--h:${q(this.calOf(b.calendar_id)?.color)}`}></i>`)}</span>`:m.length>o?n`<div class="more">עוד <span class="num">${m.length-o}</span></div>`:c}
          </button>`})}</div>
      </div>
      ${e?this.agenda(r,a):c}`}monthEv(t){const e=this.calOf(t.calendar_id);return n`<span class="ev" data-mark=${Xt(t)} data-flag=${t.sync_flag==="conflict"&&this.ctx?.access.ui.sync_conflict_display!=="list_only"?"conflict":""}
      style=${`--h:${q(e?.color)}`} title=${t.title??"תפוס"}><span class="t num">${w(t.start)}</span><span class="ell">${t.title??"תפוס"}</span></span>`}pickDay(t){if(this.ctx?.device==="phone"){this.picked=t;return}this.anchor=t,this.setMode("day")}agenda(t,e){const s=Pt(e,t),a=this.ctx?.now??new Date,i=s.length>3?2:3;return n`<div class="agenda" data-cal-agenda>
      <h3>${Z(t,a)?"היום, ":""}${G[t.getDay()]} ${t.getDate()}.${Y(t.getMonth()+1)}</h3>
      ${s.length?s.slice(0,i).map(o=>n`<button type="button" class="row" data-cal-entry=${o.event_id} @click=${()=>this.openDrawer(o.event_id)}>
          <span class="dot" style=${`--h:${q(this.calOf(o.calendar_id)?.color)}`}></span><b class="num">${o.all_day?"כל היום":w(o.start)}</b>
          <span class="grow ell">${o.title??"תפוס"}</span>${o.state==="pending"?n`<span class="chip dash">ממתין</span>`:o.kind==="maintenance"?n`<span class="chip">תחזוקה</span>`:c}</button>`):n`<span class="muted">אין אירועים ביום הזה.</span>`}
      ${s.length>i?n`<button type="button" class="btn sm" data-cal-agenda-more @click=${()=>{this.anchor=t,this.setMode("day")}}>עוד <span class="num">${s.length-i}</span> · לתצוגת יום</button>`:c}
    </div>`}touch(){return this.ctx?.device!=="desktop"||matchMedia("(pointer: coarse)").matches}dragEnabled(){return this.ctx?.access.ui.grid_edit!=="create_only"}bookable(t){return!!t&&!t.archived&&!!t.my_role&&t.my_role!=="view"&&t.type!=="maintenance"}calForCol(t){const e=this.cols[t];if(e?.cal)return this.bookable(e.cal)?e.cal:void 0;const s=this.shownCals().filter(a=>this.bookable(a));return s.find(a=>a.id===this.lastCal)??s.find(a=>a.type==="room"&&a.my_role==="manage")??s.find(a=>a.type==="room")??s[0]}columns(t){const e=this.ctx,s=e.device==="phone",a=this.shownOcc();let i=c;if(t){const u=s?2:e.device==="tablet"?4:6,v=Pt(a,this.anchor),m=this.shownCals(),h=this.resident?m:[...m.filter(b=>v.some(f=>f.calendar_id===b.id)),...m.filter(b=>!v.some(f=>f.calendar_id===b.id))],x=wt(h,this.dayPage,u);return x.pages>1&&(i=n`<div class="pager" data-cal-pager><button type="button" class="btn sm" aria-label="יומנים קודמים" ?disabled=${x.page<=1} @click=${()=>{this.dayPage=x.page-1,this.clearSel()}}><sw-icon name="chevronBack" size="16"></sw-icon></button>
          <span class="num">${x.page} / ${x.pages}</span><button type="button" class="btn sm" aria-label="יומנים הבאים" ?disabled=${x.page>=x.pages} @click=${()=>{this.dayPage=x.page+1,this.clearSel()}}><sw-icon name="chevron" size="16"></sw-icon></button></div>`),{cols:x.items.map(b=>({key:b.id,day:this.anchor,cal:b})),pager:i}}const o=te(this.anchor),r=Array.from({length:7},(u,v)=>B(o,v)),l=Math.min(Math.max(this.anchor.getDay(),1),5);return{cols:(s?r.slice(l-1,l+2):r).map(u=>({key:X(u),day:u})),pager:i}}week(t){const e=this.ctx,s=e.device==="phone",a=e.now,i=this.shownOcc(),o=e.access.ui.sync_conflict_display!=="list_only",{cols:r,pager:l}=this.columns(t),p=(this.drag||this.press||this.ov)&&this.cols.length?this.cols:r;this.cols=p;const u=de-Ft,v=Array.from({length:u},(b,f)=>n`<div class="hl" style=${`top:${f/u*100}%`}></div>`),m=(Yt(a)-Ft*60)/(u*60)*100,x=p.some((b,f)=>!!this.calForCol(f))?"לוח היומן. חצים מזיזים את הבחירה, Shift וחצים מאריכים, Enter יוצר אירוע":"לוח היומן, צפייה בלבד";return n`<div class="week" style=${`--cols:${Math.max(1,p.length)}`} data-cal-week tabindex="0" role="application" aria-label=${x}
        @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onCancel} @pointerleave=${()=>{this.press||(this.hover=null)}}
        @keydown=${this.onGridKey} @contextmenu=${b=>{this.touch()&&b.preventDefault()}}>
        <div></div>
        ${p.map(b=>b.cal?n`<div class="wh cal"><span class="dot" style=${`--h:${q(b.cal.color)}`}></span><b class="ell" title=${b.cal.name}>${b.cal.name}</b>
              ${this.bookable(b.cal)?b.cal.approval_mode==="always"&&b.cal.my_role!=="manage"?n`<span class="lk"><sw-icon name="lock" size="12"></sw-icon>באישור</span>`:c:n`<span class="lk"><sw-icon name="lock" size="12"></sw-icon>צפייה</span>`}</div>`:n`<button type="button" class=${`wh${Z(b.day,a)?" today":""}`} @click=${()=>{this.anchor=b.day,this.setMode("day")}}>${s?kt[b.day.getDay()]:G[b.day.getDay()]} <b class="num">${b.day.getDate()}</b></button>`)}
        <div class="axis">${Array.from({length:u},(b,f)=>f%2===0||!s?n`<span class="num" style=${`top:${f/u*100}%`}>${Y(Ft+f)}:00</span>`:c)}</div>
        ${p.map((b,f)=>{const g=b.cal?i.filter($=>$.calendar_id===b.cal?.id||$.room_calendar_ids.includes(b.cal?.id??"")):i,k=Pt(g.filter($=>$.held_slot),b.day),K=We(g.filter($=>!$.held_slot),b.day,Ft,de),O=Pt(g,b.day).filter($=>$.all_day||$.kind==="holiday"),Ct=!b.cal&&(b.day.getDay()===6||O.length>0),It=this.sel?.col===f||this.drag?.col===f;return n`<div class=${`col${Ct?" we":""}${It?" lift-z":""}`} data-cal-col=${b.key} data-ci=${f}>
            ${v}
            ${this.closedZones(b)}
            ${this.pastZone(b.day,a)}
            ${O.length?n`<div class="allday ell">${O[0].title}</div>`:c}
            ${k.map($=>n`<div class="held" data-cal-held=${$.event_id} style=${`top:${this.pct(xt($.start))}%;height:${this.pct(xt($.end))-this.pct(xt($.start))}%`}>
              <b>${$.title??"תפוס"}</b><br>המועד הקודם · שמור עד ההחלטה</div>`)}
            ${K.map($=>{const St=o&&$.o.sync_flag==="conflict",At=100/$.lanes,Zt=`ev${this.editable($.o,"move")||this.editable($.o,"resize")?" ed":""}${$.o.contested?" contest":""}${this.drag?.occ.occurrence_id===$.o.occurrence_id?" src":""}${this.lifted===$.o.occurrence_id?" lift":""}${this.fresh.has($.o.event_id)?" fresh":""}`;return n`<button type="button" class=${Zt} data-mark=${Xt($.o)} data-flag=${St?"conflict":""} data-cal-entry=${$.o.event_id} data-occ=${$.o.occurrence_id}
                style=${`--h:${q(this.calOf($.o.calendar_id)?.color)};top:${$.top}%;height:${$.height}%;inset-inline-start:calc(${$.lane*At}% + 3px);inline-size:calc(${At}% - 6px)`}
                title=${St?"התנגשות עם יומן חיצוני: שתי ההזמנות נשמרו, מחכה להחלטה":`${$.o.title??"תפוס"} · ${w($.o.start)}–${w($.o.end)}`}
                aria-label=${`${$.o.title??"תפוס"}, ${this.calOf($.o.calendar_id)?.name??""}, ${w($.o.start)} עד ${w($.o.end)}${$.o.state==="pending"?", ממתין לאישור":""}`}
                @click=${he=>{he.detail===0&&this.openPeek($.o,he.currentTarget)}}>
                <b>${St||$.o.contested?n`<sw-icon name="warning" size="13"></sw-icon>`:c}<span class="ell">${$.o.title??"תפוס"}</span></b>
                ${$.height>6?n`<span class="tm num ell ltr">${w($.o.start)}–${w($.o.end)}</span>`:c}
                ${this.editable($.o,"resize")?n`<span class="rz" aria-hidden="true"></span>`:c}</button>`})}
            ${this.hover?.col===f&&!this.sel?n`<div class="hov" style=${`top:${this.pct(this.hover.m)}%;height:${30/(D.to-D.from)*100}%`}>+ ${this.mm(this.hover.m)}</div>`:c}
            ${this.selView(f)}
            ${this.dragView(f)}
            ${this.ring?.col===f?n`<div class="ring" style=${`left:${this.ring.x}px;top:${this.ring.y}px`}></div>`:c}
            ${Z(b.day,a)&&m>0&&m<100?n`<div class="now" style=${`top:${m}%`}></div>`:c}
          </div>`})}
      </div>${l}`}pct(t){return(Math.min(Math.max(t,D.from),D.to)-D.from)/(D.to-D.from)*100}mm(t){return`${Y(Math.floor(t/60))}:${Y(t%60)}`}closedZones(t){const e=t.cal?[t.cal]:this.shownCals().filter(o=>o.type==="room");if(!e.length||e.some(o=>o.open_hours===void 0||o.open_hours===null))return c;const s=e.map(o=>qt(o,t.day)).filter(o=>!!o);if(!s.length)return n`<div class="closedz closed all" style="top:0;height:100%"><span>${t.day.getDay()===6?"שבת · סגור":"סגור"}</span></div>`;const a=Math.min(...s.map(o=>o.from)),i=Math.max(...s.map(o=>o.to));return n`${a>D.from?n`<div class="closedz closed t" style=${`top:0;height:${this.pct(a)}%`}></div>`:c}
      ${i<D.to?n`<div class="closedz closed b" style=${`top:${this.pct(i)}%;height:${100-this.pct(i)}%`}>${D.to-i>=90?n`<span>סגור</span>`:c}</div>`:c}`}pastZone(t,e){return M(t)<M(e)?n`<div class="past" style="height:100%;border-radius:var(--sw-r-md)"></div>`:Z(t,e)&&Yt(e)>D.from?n`<div class="past" style=${`height:${this.pct(Yt(e))}%`}></div>`:c}editable(t,e){if(!t.can_edit||!this.dragEnabled()||t.recurring||t.held_slot||t.all_day)return!1;const s=this.ctx?.now??new Date;return e==="move"?new Date(t.start)>s:new Date(t.end)>s}candidate(t,e,s,a){const i=this.cols[t],o=a??this.calForCol(t);return!i||!o?null:{cal:o,start:W(i.day,e),end:W(i.day,s)}}selHint(){const t=this.sel;if(!t)return null;const e=this.draft,s=e?this.calOf(e.calId):void 0,a=this.candidate(t.col,t.s,t.e,s);return a?Bt({...a,behalf:e?.behalf,headcount:e?.headcount||void 0},this.occ,this.hints,this.ctx?.now??new Date):null}selView(t){const e=this.sel;if(!e||e.col!==t)return c;const s=this.selHint(),a=s?.level??"bad",i=s?ye(s):{cls:"",text:"אין כאן יומן שאפשר להזמין בו"},o=e.s-D.from<60?" flip":e.e>D.to-70&&e.s-D.from>=60?" flipb":"",r=this.draft?this.calOf(this.draft.calId):this.calForCol(t);return n`<div class=${`sel lv-${a}${o}`} data-cal-sel=${a} style=${`top:${this.pct(e.s)}%;height:${this.pct(e.e)-this.pct(e.s)}%`}>
      <div class="box"><b class="ltr num" style="text-align:right">${this.mm(e.s)}–${this.mm(Math.min(e.e,1440))}</b>${this.draft?.title?n`<small class="ell">${this.draft.title}</small>`:c}
        ${this.mode==="week"&&r?n`<small class="ell">${r.name}</small>`:c}</div>
      ${i?n`<div class=${`why ${i.cls}`}><sw-icon name=${i.cls==="pend"?"info":"warning"} size="13"></sw-icon><span>${i.text}</span></div>`:c}</div>`}dragView(t){const e=this.drag;if(!e||e.col!==t)return c;const s=e.same?"ok":e.hint?.level??"ok",a=e.same||!e.hint?null:ye(e.hint),i=e.s-D.from<60?" flip":e.e>D.to-70&&e.s-D.from>=60?" flipb":"",o=this.cols[t],r=o?.cal&&o.cal.id!==e.occ.calendar_id?o.cal.name:"",l=!o?.cal&&o&&!Z(o.day,new Date(e.occ.start))?G[o.day.getDay()]:"",p=[r,l,e.mode==="resize"?Et(e.e-e.s):""].filter(Boolean).join(" · ");return n`<div class=${`drag lv-${s}${i}`} data-cal-drag=${s} style=${`top:${this.pct(e.s)}%;height:${this.pct(e.e)-this.pct(e.s)}%`}>
      <div class="ev" data-mark=${Xt(e.occ)} style=${`--h:${q(this.calOf(e.occ.calendar_id)?.color)}`}><b><span class="ell">${e.occ.title??"תפוס"}</span></b></div>
      <div class="tag ltr num">${this.mm(e.s)}–${this.mm(e.e)}${p?n` <span dir="rtl">· ${p}</span>`:c}</div>
      ${a?n`<div class=${`why ${a.cls}`}><sw-icon name=${a.cls==="pend"?"info":"warning"} size="13"></sw-icon><span>${a.text}</span></div>`:c}</div>`}colAt(t){const e=t.composedPath().find(s=>s instanceof HTMLElement&&s.classList.contains("col"))??null;return e?{el:e,ci:Number(e.dataset.ci)}:null}colEls(){return[...this.renderRoot.querySelectorAll(".week .col")]}minuteIn(t,e){const s=t.getBoundingClientRect();return cs((e-s.top)/s.height,D)}colAtX(t){let e=-1,s=1/0;return this.colEls().forEach((a,i)=>{const o=a.getBoundingClientRect(),r=t<o.left?o.left-t:t>o.right?t-o.right:0;r<s&&(s=r,e=i)}),e}updateDrag(t,e,s){const a={s:xt(t.start),e:Z(new Date(t.start),new Date(t.end))?xt(t.end):1440};let i=e.col,o;const r=this.calOf(t.calendar_id);if(e.mode==="move"){const m=this.colAtX(s.clientX);m>=0&&(i=m);const h=this.colEls()[i],x=this.cols[i]?.cal??r;o=ps(a,this.minuteIn(h,s.clientY),e.at-a.s,ct(x),D)}else{const m=this.colEls()[e.col];o=hs(a,this.minuteIn(m,s.clientY),ct(r),D)}const l=this.cols[i],p=l?.cal??r,u=!!l&&p?.id===t.calendar_id&&Z(l.day,new Date(t.start))&&o.s===a.s&&o.e===a.e;let v=null;if(!u&&l&&p){const m=new Date(t.start)<=(this.ctx?.now??new Date);v=Bt({cal:p,start:W(l.day,o.s),end:W(l.day,o.e),ignoreId:t.event_id,moving:t.state==="confirmed"?"confirmed":"pending",started:m},this.occ,this.hints,this.ctx?.now??new Date),l.cal&&!this.bookable(l.cal)&&(v={...v,level:"bad",reason:`${l.cal.name}: צפייה בלבד`})}this.drag={occ:t,mode:e.mode,col:i,s:o.s,e:o.e,grab:e.at-a.s,hint:v,same:u}}hoverAt(t){if(t.pointerType!=="mouse"||this.ov||this.mode==="month"){this.hover&&(this.hover=null);return}const e=this.colAt(t),s=t.composedPath().some(p=>p instanceof HTMLElement&&p.dataset.occ),a=e?this.calForCol(e.ci):void 0;if(!e||s||!a){this.hover&&(this.hover=null);return}const i=Ot(this.minuteIn(e.el,t.clientY),ct(a),D),o=this.cols[e.ci]?.day,r=o?qt(a,o):null,l=!!o&&W(o,i)<(this.ctx?.now??new Date);if(!r||i<r.from||i+30>r.to||l){this.hover&&(this.hover=null);return}(this.hover?.col!==e.ci||this.hover.m!==i)&&(this.hover={col:e.ci,m:i})}async endDrag(){const t=this.drag;if(!t)return;const e=this.cols[t.col],s=e?.cal??this.calOf(t.occ.calendar_id);if(t.same||!e||!s){this.drag=null;return}if(t.hint?.level==="bad"){this.drag=null,this.showToast(t.hint.reason??"אי אפשר להזיז לכאן",!1,!0);return}const a=t.occ,i=W(e.day,t.s),o=W(e.day,t.e),r={calendarId:a.calendar_id,start:a.start,end:a.end};this.occ=this.occ.map(l=>l.occurrence_id===a.occurrence_id?{...l,calendar_id:s.id,start:i.toISOString(),end:o.toISOString()}:l),this.drag=null;try{const p=await this.ctx.api.patchEvent(a.event_id,{revision:a.revision??1,start:i.toISOString(),end:o.toISOString(),...s.id!==a.calendar_id?{calendar_id:s.id}:{}});this.pushUndo({kind:"move",eventId:a.event_id,rev:p.event.revision,before:r});const u=Z(i,new Date(a.start))?null:`${kt[i.getDay()]} ${i.getDate()}.${i.getMonth()+1}`,v=p.change_withdrawn?"השינוי בוטל · ההזמנה חזרה למועד המאושר":ws(t.mode,s.id!==a.calendar_id?s.name:null,u,i,o,p.event.state,!!p.event.held,p.event.contested);this.showToast(v,!0),this.say(v),this.changed()}catch(l){this.showToast(_(l),!1,!0),this.reload()}}docKey(t){const e=t.composedPath()[0],s=!!e&&/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName);if(!this.drawerOpen()){if(t.key==="Escape"){if(this.drag){this.press=null,this.drag=null;return}if(this.ov){this.closeOverlay(),this.focusGrid();return}this.sel&&this.clearSel();return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="z"&&!s&&this.undoStack.size&&this.mode!=="month"){t.preventDefault(),this.undo();return}(t.key==="Delete"||t.key==="Backspace")&&this.ov==="peek"&&!s&&this.peek&&this.peek.can_edit&&(t.preventDefault(),this.del(this.peek))}}drawerOpen(){return!!this.host?.shadowRoot?.querySelector("cal-event-drawer, cal-maint-drawer")}focusGrid(){this.renderRoot.querySelector(".week")?.focus({preventScroll:!0})}say(t){this.live=t}selAnchor(){const t=this.renderRoot.querySelector(".sel .box");if(!t)return null;const e=t.getBoundingClientRect();return{x:e.left,y:e.top,w:e.width,h:e.height}}openQuick(t){const e=this.sel;if(!e)return;const s=this.calForCol(e.col),a=this.cols[e.col];!s||!a||(this.draft={calId:s.id,day:M(a.day),s:e.s,e:e.e,title:"",allDay:!1,repeat:"none",count:9,behalf:"self",behalfLabel:"",headcount:0},this.ov="quick",this.ovInstant=t,this.ovError="",this.seriesClash=null,this.updateComplete.then(()=>this.ovAnchor=this.selAnchor()))}onQuickChange(t){const e=this.draft;if(!e)return;const s={...e,...t};if(t.calId&&t.calId!==e.calId&&e.allDay){const a=qt(this.calOf(t.calId),e.day)??{from:0,to:1440};s.s=a.from,s.e=a.to}if(this.draft=s,this.ovError="",this.sel){let a=this.sel.col;if(t.calId&&this.mode==="day"){const i=this.cols.findIndex(o=>o.cal?.id===t.calId);i>=0&&(a=i)}this.sel={col:a,s:Math.max(D.from,s.s),e:Math.min(D.to,Math.max(s.e,s.s+5))},this.updateComplete.then(()=>this.ovAnchor=this.selAnchor()??this.ovAnchor)}("repeat"in t||"count"in t||"s"in t||"e"in t||"calId"in t)&&this.scheduleSeries()}scheduleSeries(){clearTimeout(this.seriesTimer);const t=this.draft;if(!t||t.repeat==="none"){this.seriesClash=null;return}this.seriesTimer=window.setTimeout(async()=>{const e=this.quickBody(!0);if(e)try{const s=await this.ctx.api.previewEvent(e);this.draft===t&&(this.seriesClash=new Set(s.conflicts.map(a=>a.start)).size)}catch{this.seriesClash=null}},300)}quickBody(t=!1){const e=this.draft,s=this.ctx,a=e?this.calOf(e.calId):void 0;if(!e||!a)return null;const i=e.title.trim()||(t?"בדיקה":a.type==="room"?"הזמנת חדר":"אירוע"),o={calendar_id:a.id,kind:"booking",title:i,start:W(e.day,e.s).toISOString(),end:W(e.day,Math.min(e.e,1440)).toISOString()},r=qe(e.repeat,e.count);r&&(o.rrule=r),s.access.can.book_for_others&&e.behalf!=="self"&&(o.on_behalf={kind:e.behalf,label:e.behalfLabel.trim()}),e.headcount>0&&(o.headcount=e.headcount);const l=t||!Array.isArray(e.attendees)?[]:ce(e.attendees);return l.length&&Object.assign(o,{attendees:l}),o}quickHint(){const t=this.draft;if(!t)return null;const e=this.calOf(t.calId);return e?Bt({cal:e,start:W(t.day,t.s),end:W(t.day,Math.min(t.e,1440)),behalf:t.behalf,headcount:t.headcount||void 0},this.occ,this.hints,this.ctx?.now??new Date):null}async saveQuick(){const t=this.draft,e=this.quickBody();if(!t||!e||this.ovBusy)return;const s=this.quickHint();if(s?.level==="bad"){this.ovError=s.reason??"";return}if(t.behalf!=="self"&&!t.behalfLabel.trim()){this.ovError=`חסר שם ה${{team:"צוות",class:"חוג",customer:"לקוח",department:"מחלקה",vendor:"ספק",self:""}[t.behalf]}.`;return}this.ovBusy=!0;try{const a=await this.ctx.api.createEvent(e);this.lastCal=t.calId,this.pushUndo({kind:"create",eventId:a.event.id,rev:a.event.revision});const i=t.repeat!=="none"?a.state==="pending"?"הסדרה נשלחה לאישור":"הסדרה נשמרה":a.state==="pending"?a.event.contested?"נשלחה בקשה מתחרה לאישור":"הבקשה נשלחה לאישור":"ההזמנה נשמרה";this.fresh=new Set([a.event.id]),this.closeOverlay(),this.showToast(i,!0),this.say(i),this.focusGrid(),this.changed()}catch(a){this.ovError=_(a)}finally{this.ovBusy=!1}}moreQuick(){const t=this.draft;t&&(A(this,z.newEvent,{calendarId:t.calId,start:W(t.day,t.s).toISOString(),end:W(t.day,Math.min(t.e,1440)).toISOString(),title:t.title,repeat:t.repeat,count:t.count,behalf:t.behalf,behalfLabel:t.behalfLabel,headcount:t.headcount||void 0,attendees:Array.isArray(t.attendees)&&t.attendees.length?[...t.attendees]:void 0}),this.closeOverlay())}openPeek(t,e){if(t.held_slot)return;this.clearSel();const s=e?.getBoundingClientRect();this.peek=t,this.ov="peek",this.ovAnchor=s?{x:s.left,y:s.top,w:s.width,h:s.height}:null,this.ovError="",this.displaceAsk=null}openDrawer(t){A(this,z.newEvent,{eventId:t})}async del(t){const e=this.ctx.api;this.ovBusy=!0;try{let s;if(t.held){const a=await e.withdrawEvent(t.event_id,t.revision??1);this.pushUndo({kind:"move",eventId:t.event_id,rev:a.event.revision,before:{calendarId:t.calendar_id,start:t.start,end:t.end}}),s="בקשת השינוי נמשכה · ההזמנה חזרה למועד הקודם"}else if(t.recurring&&t.local_start)await e.cancelEvent(t.event_id,t.revision??1,t.local_start),s="המועד בוטל";else{const a=await e.cancelEvent(t.event_id,t.revision??1);this.pushUndo({kind:"delete",eventId:t.event_id,rev:a.event.revision}),s=t.state==="pending"?"הבקשה נמשכה":"ההזמנה בוטלה"}this.closeOverlay(),this.showToast(s,!(t.recurring&&!t.held)),this.say(s),this.focusGrid(),this.changed()}catch(s){this.ovError=_(s)}finally{this.ovBusy=!1}}async dup(t){const e=this.calOf(t.calendar_id);if(!e)return;const s=Math.round((new Date(t.end).getTime()-new Date(t.start).getTime())/6e4),a=ct(e),i=M(new Date(t.start)),{to:o}=this.range();let r=null;for(let l=0;l<7&&!r;l+=1){const p=B(i,l);if(p>=o)break;for(let u=xt(l===0?t.end:t.start);u+s<=D.to;u+=a){const v=W(p,u),m=W(p,u+s),h=Bt({cal:e,start:v,end:m},this.occ,this.hints,this.ctx?.now??new Date);if(h.level==="ok"||h.level==="pend"){r={start:v,end:m};break}if(l>0)break}}if(!r){this.showToast("אין מועד פנוי לשכפול בימים שמוצגים",!1,!0);return}this.ovBusy=!0;try{const l=await this.ctx.api.createEvent({calendar_id:e.id,kind:"booking",title:t.title??"הזמנה",start:r.start.toISOString(),end:r.end.toISOString()});this.pushUndo({kind:"create",eventId:l.event.id,rev:l.event.revision}),this.fresh=new Set([l.event.id]),this.closeOverlay();const p=Z(r.start,new Date(t.start))?"":`${kt[r.start.getDay()]} ${r.start.getDate()}.${r.start.getMonth()+1} `;this.showToast(`שוכפל ל־${p}${w(r.start)}–${w(r.end)}${l.state==="pending"?" · ממתין לאישור":""}`,!0),this.changed()}catch(l){this.ovError=_(l)}finally{this.ovBusy=!1}}async decide(t,e,s=!1){const a=this.ctx.api;this.ovBusy=!0,this.ovError="";try{const i=t.room_calendar_ids.includes(t.calendar_id)&&t.room_calendar_ids.length?t.calendar_id:null,o=await a.decide(t.event_id,{decision:e,revision:t.revision??1,room_calendar_id:i,...s?{displace_existing:!0}:{}});this.closeOverlay();const r=o.change_rejected;this.showToast(e==="reject"?r?"בקשת השינוי נדחתה · ההזמנה נשארה במועד הקודם":"הבקשה נדחתה · המארגן יקבל הודעה":s?"אושר · ההזמנה הקודמת נדחקה, המארגן יבחר מועד אחר":"הבקשה אושרה",!1),this.changed()}catch(i){if(i instanceof dt&&i.body.code==="slot_held"&&this.ctx?.access.ui.allow_displace){const o=(i.body.details.conflicts??[])[0],r=o?this.occ.find(l=>l.event_id===o.event_id):void 0;this.displaceAsk=o?{title:r?.title??null,start:o.start,end:o.end}:null,o||(this.ovError=_(i))}else this.ovError=_(i)}finally{this.ovBusy=!1}}overlay(){const t=this.ctx,e=t.device==="phone";if(this.ov==="quick"&&this.draft)return n`<cal-quick-create .ctx=${t} .draft=${this.draft} .hint=${this.quickHint()} .anchor=${this.ovAnchor} ?sheet=${e} ?instant=${this.ovInstant} ?busy=${this.ovBusy}
        .error=${this.ovError} .seriesClash=${this.seriesClash}
        @qc-change=${s=>this.onQuickChange(s.detail)} @qc-save=${()=>void this.saveQuick()} @qc-more=${()=>this.moreQuick()}
        @qc-close=${()=>{this.closeOverlay(),this.focusGrid()}}></cal-quick-create>`;if(this.ov==="peek"&&this.peek){const s=this.peek;return n`<cal-peek .ctx=${t} .occ=${s} .anchor=${this.ovAnchor} ?sheet=${e} ?busy=${this.ovBusy} .error=${this.ovError} .displaceAsk=${this.displaceAsk}
        @pk-close=${()=>{this.closeOverlay(),this.focusGrid()}} @pk-edit=${()=>{this.closeOverlay(),this.openDrawer(s.event_id)}}
        @pk-dup=${()=>void this.dup(s)} @pk-del=${()=>void this.del(s)} @pk-reject=${()=>void this.decide(s,"reject")}
        @pk-approve=${a=>void this.decide(s,"approve",a.detail.displace)} @pk-back=${()=>this.displaceAsk=null}></cal-peek>`}return c}closeOverlay(t=!0){this.ov=null,this.peek=null,this.displaceAsk=null,this.ovError="",clearTimeout(this.seriesTimer),t&&this.clearSel()}clearSel(){this.sel=null,this.draft=null,this.kb=null}coachLine(){return!this.coach||this.mode==="month"||!this.touch()||!this.ctx?.access.can.book?c:n`<div class="coach" role="note" data-cal-coach><sw-icon name="hand" size="16"></sw-icon><span>לחיצה ארוכה על שעה פנויה בוחרת זמן. ממשיכים לגרור כדי להאריך.</span>
      <button type="button" class="btn icon sm" aria-label="הסתרת הרמז" @click=${()=>this.hideCoach()}><sw-icon name="close" size="14"></sw-icon></button></div>`}showCoach(){this.coach=!0}hideCoach(){this.coach=!1;try{localStorage.setItem(Se,"off")}catch{}}showToast(t,e,s=!1){clearTimeout(this.toastTimer),this.toast={text:t,undo:e&&this.undoStack.size>0,bad:s,id:Date.now()},this.toastIn=!1,requestAnimationFrame(()=>requestAnimationFrame(()=>this.toastIn=!0)),this.toastTimer=window.setTimeout(()=>{this.toastIn=!1,this.toastTimer=window.setTimeout(()=>this.toast=null,200)},e?Hs:3400)}pushUndo(t){this.undoStack.push(t)}async undo(){const t=this.undoStack.pop();if(!t)return;const e=this.ctx.api;try{t.kind==="move"?await e.patchEvent(t.eventId,{revision:t.rev,calendar_id:t.before.calendarId,start:t.before.start,end:t.before.end}):t.kind==="delete"?await e.restoreEvent(t.eventId,t.rev):await e.cancelEvent(t.eventId,t.rev),this.closeOverlay(),this.showToast("הפעולה בוטלה",!1),this.say("הפעולה בוטלה"),this.changed()}catch(s){this.showToast(_(s),!1,!0),this.reload()}}changed(){this.reload(),A(this,z.changed),window.setTimeout(()=>this.fresh=new Set,400)}};S.styles=[nt,tt`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; min-inline-size: 0; }
    .big { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .switcher { inline-size: 270px; flex: none; gap: 2px; }
    .switcher.narrow { inline-size: 210px; }
    .switcher .grp { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); margin: 8px 4px 2px; }
    .switcher .list { min-block-size: 0; overflow: hidden; display: flex; flex-direction: column; gap: 1px; }
    .cal-it { display: flex; align-items: center; gap: 10px; min-block-size: 32px; padding-inline: 8px; border-radius: var(--sw-r-md); font: inherit; font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold); color: var(--sw-text); background: transparent; border: 0; cursor: pointer; text-align: start; inline-size: 100%; -webkit-tap-highlight-color: transparent; flex: none; }
    .cal-it .box { inline-size: 18px; block-size: 18px; border-radius: var(--sw-r-xs); flex: none; display: grid; place-items: center; box-shadow: inset 0 0 0 2px var(--h); color: var(--sw-text-inverse); }
    .cal-it[aria-pressed='true'] .box { background: var(--h); }
    .cal-it[aria-pressed='false'] { color: var(--sw-text-2); }
    .cal-it[aria-pressed='false'] .box sw-icon { visibility: hidden; }
    .cal-it .lock { margin-inline-start: auto; color: var(--sw-text-3); display: inline-flex; }
    @media (hover: hover) { .cal-it:hover { background: var(--sw-hover-wash); } }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    .switcher.overlay { position: fixed; inset-block: 12px; inset-inline-end: 12px; z-index: calc(var(--sw-z-modal) + 1); box-shadow: var(--sw-shadow-3); inline-size: min(300px, calc(100vw - 24px)); }
    .month { flex: 1; min-block-size: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .mhead, .mgrid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .mhead div { padding: 0 8px 6px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); }
    .mgrid { grid-template-rows: repeat(6, minmax(0, 1fr)); gap: 3px; min-block-size: 0; }
    .mcell { background: var(--sw-surface-2); border-radius: var(--sw-r-md); padding: 6px 6px 4px; display: flex; flex-direction: column; gap: 3px; min-block-size: 0; min-inline-size: 0;
      overflow: hidden; border: 0; font: inherit; text-align: start; cursor: pointer; color: inherit; -webkit-tap-highlight-color: transparent; }
    .mcell.we { background: var(--sw-surface-3); }
    .mcell.out { opacity: 0.5; }
    .mcell .d { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); display: flex; align-items: center; gap: 6px; min-block-size: 22px; min-inline-size: 0; }
    .mcell.today .d b { background: var(--sw-accent); color: var(--sw-text-inverse); border-radius: var(--sw-r-pill); min-inline-size: 24px; block-size: 22px; display: inline-grid; place-items: center; padding-inline: 6px; }
    .mcell[aria-pressed='true'] { box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .mcell .ev { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); block-size: 20px; line-height: 20px; padding: 0 6px; display: flex; gap: 5px; align-items: center; flex: none; inline-size: 100%; }
    .mcell .ev .t { font-weight: var(--sw-fw-bold); flex: none; }
    .mcell .more { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); padding-inline: 6px; }
    .dots { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
    .dots i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--h); }
    .week { flex: 1; min-block-size: 0; display: grid; grid-template-columns: 52px repeat(var(--cols), minmax(0, 1fr)); grid-template-rows: auto minmax(0, 1fr); column-gap: 3px;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; outline: none; border-radius: var(--sw-r-md); }
    .week:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 4px; }
    @media (pointer: coarse) { .week { touch-action: none; } }
    .wh { padding: 0 6px 8px; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); display: flex; gap: 6px; align-items: baseline; min-inline-size: 0;
      border: 0; background: transparent; font-family: inherit; cursor: pointer; text-align: start; }
    .wh b { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .wh.today b { color: var(--sw-accent-text); }
    .wh.cal { align-items: center; cursor: default; }
    .wh.cal b { font-size: var(--sw-fs-lg); }
    .wh .lk { margin-inline-start: auto; font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
    .axis { position: relative; }
    .axis span { position: absolute; inset-inline-end: 6px; transform: translateY(-50%); font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .axis span:first-child { transform: none; }
    .col { position: relative; background: var(--sw-surface-2); border-radius: var(--sw-r-md); min-block-size: 0; }
    .col.we { background: var(--sw-surface-3); }
    .col.lift-z { z-index: 3; }
    .col .hl { position: absolute; inset-inline: 0; block-size: 1px; background: color-mix(in srgb, var(--sw-text) 7%, transparent); pointer-events: none; }
    .col .ev { position: absolute; padding: 3px 6px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); line-height: 1.3; z-index: 1; transition: opacity 150ms ease, box-shadow 150ms ease; }
    .col .ev b { display: flex; gap: 4px; align-items: center; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    .col .ev .tm { display: block; font-variant-numeric: tabular-nums; }
    .col .ev[data-flag='conflict'] sw-icon { color: var(--sw-danger-text); flex: none; }
    .col .ev.contest { box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .col .ev.ed { cursor: grab; }
    .col .ev.src { opacity: 0.3; }
    .col .ev.lift { box-shadow: var(--sw-shadow-2), inset 0 0 0 2px var(--sw-accent); z-index: 5; }
    .col .ev.fresh { animation: fresh 220ms var(--sw-ease-dialog); }
    @keyframes fresh { from { opacity: 0; transform: scale(0.97); } }
    .ev .rz { position: absolute; inset-inline: 0; inset-block-end: 0; block-size: 9px; cursor: ns-resize; }
    .ev .rz::after { content: ''; position: absolute; inset-block-end: 2px; inset-inline-start: 50%; inline-size: 22px; block-size: 3px; margin-inline-start: -11px; border-radius: 2px; background: currentColor; opacity: 0; transition: opacity 120ms ease; }
    @media (hover: hover) and (pointer: fine) { .ev.ed:hover .rz::after { opacity: 0.5; } }
    @media (pointer: coarse) { .ev .rz { block-size: 16px; } .ev .rz::after { opacity: 0.4; } }
    .col .allday { position: absolute; inset: 8px 8px auto; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); pointer-events: none; }
    .closedz { position: absolute; inset-inline: 0; pointer-events: none; display: grid; place-items: center; font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .closedz.t { border-radius: var(--sw-r-md) var(--sw-r-md) 0 0; }
    .closedz.b { border-radius: 0 0 var(--sw-r-md) var(--sw-r-md); }
    .closedz.all { border-radius: var(--sw-r-md); }
    .past { position: absolute; inset-inline: 0; inset-block-start: 0; background: color-mix(in srgb, var(--sw-text-3) 8%, transparent); pointer-events: none; border-radius: var(--sw-r-md) var(--sw-r-md) 0 0; }
    .held { position: absolute; inset-inline: 3px; border-radius: var(--sw-r-xs); outline: 1.5px dotted var(--sw-text-3); outline-offset: -1.5px; z-index: 0; font-size: var(--sw-fs-2xs); line-height: 1.3;
      color: var(--sw-text-3); padding: 3px 7px; pointer-events: none; background: color-mix(in srgb, var(--sw-text-3) 6%, transparent); overflow: hidden; }
    .hov { position: absolute; inset-inline: 3px; border-radius: var(--sw-r-xs); background: color-mix(in srgb, var(--sw-accent) 10%, transparent); color: var(--sw-accent-text);
      font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-bold); padding: 2px 7px; pointer-events: none; z-index: 1; }
    .sel, .drag { position: absolute; inset-inline: 3px; z-index: 7; pointer-events: none; }
    .sel .box { position: absolute; inset: 0; border-radius: var(--sw-r-xs); background: color-mix(in srgb, var(--sw-accent) 18%, var(--sw-surface-solid)); box-shadow: inset 0 0 0 2px var(--sw-accent);
      color: var(--sw-accent-text); padding: 3px 7px; font-size: var(--sw-fs-xs); overflow: hidden; display: flex; flex-direction: column; }
    .sel.lv-pend .box { background: color-mix(in srgb, var(--sw-accent) 8%, var(--sw-surface-solid)); box-shadow: none; outline: 2px dashed var(--sw-accent); outline-offset: -2px; }
    .sel.lv-bad .box, .sel.lv-contest .box { background: color-mix(in srgb, var(--sw-danger) 12%, var(--sw-surface-solid)); box-shadow: inset 0 0 0 2px var(--sw-danger); color: var(--sw-danger-text); }
    .drag > .ev { position: absolute; inset: 0; box-shadow: var(--sw-shadow-2), inset 0 0 0 2px var(--sw-accent); cursor: grabbing; }
    .drag.lv-bad > .ev, .drag.lv-contest > .ev { box-shadow: var(--sw-shadow-2), inset 0 0 0 2px var(--sw-danger); outline: none; background: color-mix(in srgb, var(--sw-danger) 12%, var(--sw-surface-solid)); color: var(--sw-danger-text); }
    .drag.lv-pend > .ev { outline: 2px dashed var(--sw-accent); outline-offset: -2px; }
    .tag { position: absolute; inset-inline-start: 0; inset-block-end: calc(100% + 4px); background: var(--sw-toast-bg); color: var(--sw-toast-text); font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-bold);
      padding: 2px 8px; border-radius: var(--sw-r-xs); white-space: nowrap; z-index: 8; }
    .why { position: absolute; inset-inline-start: 0; inset-block-start: calc(100% + 4px); inline-size: max-content; max-inline-size: 250px; background: var(--sw-danger); color: var(--sw-text-inverse);
      font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); padding: 4px 8px; border-radius: var(--sw-r-xs); line-height: 1.35; z-index: 8; display: flex; gap: 5px; align-items: flex-start; box-shadow: var(--sw-shadow-2); }
    .why.pend { background: var(--sw-surface-solid); color: var(--sw-accent-text); box-shadow: inset 0 0 0 1.5px var(--sw-accent), var(--sw-shadow-2); }
    .why.warn { background: var(--sw-surface-solid); color: var(--sw-warning-text); box-shadow: inset 0 0 0 1.5px var(--sw-warning), var(--sw-shadow-2); }
    .flip .tag { inset-block-end: auto; inset-block-start: calc(100% + 4px); }
    .flip .why { inset-block-start: calc(100% + 30px); }
    .flipb .why { inset-block-start: auto; inset-block-end: calc(100% + 30px); }
    .ring { position: absolute; inline-size: 48px; block-size: 48px; margin: -24px 0 0 -24px; border-radius: 50%; border: 3px solid var(--sw-accent); pointer-events: none; z-index: 9;
      animation: ring 450ms linear forwards; }
    @keyframes ring { from { transform: scale(0.45); opacity: 0.2; } to { transform: scale(1); opacity: 1; } }
    .now { position: absolute; inset-inline: 0; block-size: 2px; background: var(--sw-accent); z-index: 2; pointer-events: none; }
    .now::before { content: ''; position: absolute; inset-inline-end: -1px; inset-block-start: -4px; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .coach { display: flex; align-items: center; gap: 8px; background: var(--sw-accent-soft); color: var(--sw-accent-text); border-radius: var(--sw-r-lg); padding: 7px 10px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .coach .btn { margin-inline-start: auto; border: 0; background: transparent; color: inherit; inline-size: 32px; min-block-size: 32px; }
    .agenda { display: flex; flex-direction: column; gap: 6px; min-block-size: 0; overflow: hidden; }
    .agenda h3 { margin: 4px 0 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .agenda .row { min-block-size: 44px; border: 0; font: inherit; text-align: start; cursor: pointer; inline-size: 100%; flex: none; }
    .agenda .row b { color: var(--sw-heading); }
    .fail { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .toasts { position: fixed; inset-inline: 0; inset-block-end: 24px; display: grid; justify-items: center; pointer-events: none; z-index: var(--sw-z-toast); }
    .toast { display: flex; align-items: center; gap: 12px; background: var(--sw-toast-bg); color: var(--sw-toast-text); border-radius: var(--sw-r-lg); padding-block: 9px; padding-inline: 14px 10px;
      font-size: var(--sw-fs-md); box-shadow: var(--sw-shadow-3); pointer-events: auto; max-inline-size: min(92vw, 640px);
      transform: translateY(calc(100% + 30px)); opacity: 0; transition: transform 240ms var(--sw-ease-dialog), opacity 240ms var(--sw-ease-dialog); }
    .toast.in { transform: none; opacity: 1; }
    .toast.bad { background: var(--sw-danger); color: var(--sw-text-inverse); }
    .toast .tb { border: 0; background: transparent; color: inherit; font: inherit; font-weight: var(--sw-fw-bold); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; padding: 4px 6px; border-radius: var(--sw-r-xs); }
    .toast .tb:focus-visible { outline: 2px solid currentColor; }
    @media (prefers-reduced-motion: reduce) {
      .toast { transform: none; transition: opacity 200ms ease; }
      .col .ev.fresh { animation: none; }
      .ring { animation: ringfade 450ms linear forwards; }
      @keyframes ringfade { from { opacity: 0.2; } to { opacity: 1; } }
    }
    @media (max-width: 699px) {
      :host { flex-direction: column; }
      .panel { padding: 12px; gap: 10px; }
      .big { font-size: var(--sw-fs-xl); }
      .ph { gap: 6px; }
      .month { flex: none; block-size: 262px; }
      .mhead div { padding: 0 0 4px; text-align: center; }
      .mcell { padding: 3px; border-radius: var(--sw-r-sm); align-items: center; gap: 2px; }
      .mcell .d { justify-content: center; min-block-size: 20px; }
      .week { grid-template-columns: 40px repeat(var(--cols), minmax(0, 1fr)); }
      .wh b { font-size: var(--sw-fs-xl); }
      .toasts { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom, 0px)); }
    }
  `];E([y({attribute:!1})],S.prototype,"ctx",2);E([y({type:Boolean})],S.prototype,"resident",2);E([d()],S.prototype,"mode",2);E([d()],S.prototype,"anchor",2);E([d()],S.prototype,"picked",2);E([d()],S.prototype,"hiddenCals",2);E([d()],S.prototype,"occ",2);E([d()],S.prototype,"error",2);E([d()],S.prototype,"switcherOpen",2);E([d()],S.prototype,"dayPage",2);E([d()],S.prototype,"cap",2);E([d()],S.prototype,"sel",2);E([d()],S.prototype,"draft",2);E([d()],S.prototype,"ov",2);E([d()],S.prototype,"ovAnchor",2);E([d()],S.prototype,"ovInstant",2);E([d()],S.prototype,"ovBusy",2);E([d()],S.prototype,"ovError",2);E([d()],S.prototype,"seriesClash",2);E([d()],S.prototype,"peek",2);E([d()],S.prototype,"displaceAsk",2);E([d()],S.prototype,"drag",2);E([d()],S.prototype,"lifted",2);E([d()],S.prototype,"hover",2);E([d()],S.prototype,"ring",2);E([d()],S.prototype,"toast",2);E([d()],S.prototype,"toastIn",2);E([d()],S.prototype,"coach",2);E([d()],S.prototype,"live",2);E([d()],S.prototype,"fresh",2);S=E([it("cal-view-calendar")],S);const Fs=6;function Ns(t){const e=new Set;if(!(t.nowPct>0&&t.nowPct<100)||t.hours<=0)return{pillLeftPx:null,hidden:e};if(!(t.axisPx>0)||!(t.pillPx>0)){for(let v=0;v<=t.hours;v++)Math.abs(v/t.hours*100-t.nowPct)<t.fallbackPct&&e.add(v);return{pillLeftPx:null,hidden:e}}const s=t.gapPx??Fs,a=t.nowPct/100*t.axisPx,i=Math.min(Math.max(a-t.pillPx/2,0),Math.max(0,t.axisPx-t.pillPx)),o=i+t.pillPx,r=v=>{const m=v/t.hours*t.axisPx,h=v===0?0:v===t.hours?t.axisPx-t.labelPx:m-t.labelPx/2;return[h,h+t.labelPx]},l=(v,m)=>v[1]+s>m[0]&&v[0]-s<m[1],p=[],u=[0,t.hours,...Array.from({length:Math.max(0,t.hours-1)},(v,m)=>m+1)];for(const v of u){const m=r(v);l(m,[i,o])||p.some(h=>l(m,h))?e.add(v):p.push(m)}return{pillLeftPx:Math.round(i*10)/10,hidden:e}}var Ks=Object.defineProperty,Us=Object.getOwnPropertyDescriptor,et=(t,e,s,a)=>{for(var i=a>1?void 0:a?Us(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&Ks(e,s,i),i};const se=[0,6,10,20,50];let Q=class extends at{constructor(){super(...arguments),this.ctx=null,this.day=M(new Date),this.rooms=null,this.error="",this.capacity=0,this.equipment=new Set,this.eqOpen=!1,this.page=1,this.per=8,this.shift=0,this.axisPx=0,this.pillPx=0,this.labelPx=0,this.free=void 0,this.loadedKey="",this.ro=null,this.host=null,this.onChanged=()=>{this.loadedKey="",this.load()}}connectedCallback(){super.connectedCallback(),this.day=Pe(le("date"),this.ctx?.now??new Date),this.ro=new ResizeObserver(()=>this.fit()),this.host=this.getRootNode().host??null,this.host?.addEventListener(z.changed,this.onChanged)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.host?.removeEventListener(z.changed,this.onChanged)}updated(){const t=this.renderRoot.querySelector(".tl");t&&this.ro&&this.ro.observe(t),this.measureAxis()}measureAxis(){const t=this.renderRoot.querySelector(".tl-axis");if(!t)return;const e=t.querySelector(".tl-nowlab");let s=0;for(const i of t.querySelectorAll("span.num:not(.tl-nowlab)"))s=Math.max(s,i.offsetWidth);const a=(i,o)=>Math.abs(i-o)<1;a(t.clientWidth,this.axisPx)||(this.axisPx=t.clientWidth),e&&!a(e.offsetWidth,this.pillPx)&&(this.pillPx=e.offsetWidth),s&&!a(s,this.labelPx)&&(this.labelPx=s)}willUpdate(t){(t.has("ctx")||t.has("day"))&&this.load()}fit(){const t=this.renderRoot.querySelector(".tl");if(!t)return;const e=(this.ctx?.device==="phone"?56:52)+6,s=Math.max(1,Math.floor((t.clientHeight-32)/e));s!==this.per&&(this.per=s),this.measureAxis()}async load(){const t=this.ctx;if(!t)return;const e=`${X(this.day)}|${t.cals.map(s=>s.id).join(",")}`;if(e!==this.loadedKey){this.loadedKey=e;try{const s=await t.api.roomsDay(X(this.day));if(e!==this.loadedKey)return;this.rooms=s.rooms,this.error=""}catch(s){this.error=_(s)}}}go(t){this.day=B(this.day,t),this.free=void 0,Ut({date:X(this.day)})}calOf(t){return this.ctx?.cals.find(e=>e.id===t)}filtered(){const t=this.ctx,e=new Set(re(t).map(s=>s.id));return(this.rooms??[]).filter(s=>e.has(s.calendar_id)&&(!this.capacity||(s.capacity??0)>=this.capacity)&&[...this.equipment].every(a=>s.equipment.includes(a)))}findFree(){const t=this.ctx,e=this.filtered().filter(s=>{const a=this.calOf(s.calendar_id);return a?.my_role&&a.my_role!=="view"});if(this.free=ls(e,this.day,t.now,60),this.free){const s=this.filtered().findIndex(a=>a.calendar_id===this.free?.room);this.page=Math.floor(s/this.per)+1}}book(t,e,s){A(this,z.newEvent,{calendarId:t,start:e.toISOString(),end:s.toISOString()})}render(){const t=this.ctx;if(!t)return c;const e=t.device==="phone",s=Te(e,t.now),a=e?{from:Math.min(Math.max(s.from+this.shift,0),18),to:Math.min(Math.max(s.from+this.shift,0),18)+6}:s,i=this.filtered(),o=wt(i,this.page,this.per),r=Z(this.day,t.now),l=e?`${G[this.day.getDay()]}, ${this.day.getDate()}.${Y(this.day.getMonth()+1)}`:`${G[this.day.getDay()]}, `;return n`<section class="panel main" data-cal-rooms>
      <div class="ph">
        <span class="big" data-cal-title>${e?l:n`${l}<b>${this.day.getDate()}</b> ב${Rt[this.day.getMonth()]}`}</span>
        <button type="button" class="btn icon sm" aria-label="יום קודם" data-cal-prev @click=${()=>this.go(-1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <button type="button" class="btn icon sm" aria-label="יום הבא" data-cal-next @click=${()=>this.go(1)}><sw-icon name="chevron" size="16"></sw-icon></button>
        ${e?n`<button type="button" class="btn sm num ltr" data-cal-window aria-label="חלון השעות" @click=${()=>this.shift=this.shift>=6?-6:this.shift+3}>${Y(a.from)}:00–${Y(a.to%24)}:00</button>`:r?c:n`<button type="button" class="btn sm" data-cal-today @click=${()=>{this.day=M(t.now),Ut({date:X(this.day)})}}>היום</button>`}
        <span class="sp"></span>
        ${e?c:n`
          <button type="button" class="btn sm" data-cal-capacity aria-pressed=${String(this.capacity>0)} @click=${()=>this.nextCapacity()}><sw-icon name="users" size="16"></sw-icon>${this.capacity?n`<span class="num">${this.capacity}+</span> מקומות`:"כל הקיבולות"}</button>
          <button type="button" class="btn sm" data-cal-equipment aria-pressed=${String(this.equipment.size>0)} aria-expanded=${String(this.eqOpen)} @click=${()=>this.eqOpen=!this.eqOpen}><sw-icon name="filter" size="16"></sw-icon>ציוד${this.equipment.size?n` <span class="num">${this.equipment.size}</span>`:c}</button>`}
        <button type="button" class="btn sm" data-cal-find @click=${()=>this.findFree()}><sw-icon name="search" size="16"></sw-icon>${e?"חדר פנוי":"מצא חדר פנוי"}</button>
      </div>
      ${this.eqOpen?this.equipmentPop():c}
      ${this.error?n`<div class="fail" role="alert">${this.error}</div>`:c}
      ${this.free===null?n`<div class="found" role="status" data-cal-free-none>אין היום חדר פנוי לשעה אחת שמתאים לסינון.</div>`:c}
      ${this.rooms&&!i.length?n`<sw-state-panel icon="calendar" state="empty" data-cal-rooms-empty heading=${this.rooms.length?"אין חדר שמתאים לסינון":"אין חדרים להזמנה"}
            hint=${this.rooms.length?"אפשר לשנות את הקיבולת או את הציוד.":'חדר הוא יומן מסוג "חדר": קיבולת, ציוד, שעות פתיחה ואישור.'}></sw-state-panel>`:this.timeline(o.items,a,r)}
      ${o.pages>1?n`<div class="pager" data-cal-pager><button type="button" class="btn sm" aria-label="חדרים קודמים" ?disabled=${o.page<=1} @click=${()=>this.page=o.page-1}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <span class="num">${o.page} / ${o.pages}</span><button type="button" class="btn sm" aria-label="חדרים הבאים" ?disabled=${o.page>=o.pages} @click=${()=>this.page=o.page+1}><sw-icon name="chevron" size="16"></sw-icon></button></div>`:c}
      ${e?c:this.legend()}
    </section>`}nextCapacity(){const t=se.indexOf(this.capacity);this.capacity=se[(t+1)%se.length],this.page=1}equipmentPop(){return n`<div class="pop" role="group" aria-label="ציוד" data-cal-equipment-pop>
      ${Object.keys(ge).map(t=>n`<label><input type="checkbox" .checked=${this.equipment.has(t)} @change=${()=>{const e=new Set(this.equipment);e.has(t)?e.delete(t):e.add(t),this.equipment=e,this.page=1}}>${ge[t]}</label>`)}
      <button type="button" class="btn sm" @click=${()=>this.eqOpen=!1}>סגירה</button></div>`}timeline(t,e,s){const a=this.ctx,i=a.device==="phone",o=e.to-e.from,r=s?(a.now.getHours()*60+a.now.getMinutes()-e.from*60)/(o*60)*100:-1,l=r>0&&r<100,p=Ns({nowPct:l?r:-1,hours:o,axisPx:this.axisPx,pillPx:this.pillPx,labelPx:this.labelPx,fallbackPct:i?9:3}),u=Array.from({length:o+1},(m,h)=>{const x=h/o*100;return p.hidden.has(h)?c:n`<span class=${`num${h===0?" first":h===o?" last":""}`} data-cal-hour=${(e.from+h)%24} style=${`left:${x}%`}>${Y((e.from+h)%24)}${i?"":":00"}</span>`}),v=p.pillLeftPx===null?`left:${r}%`:`left:${p.pillLeftPx}px`;return n`<div class="tl" data-cal-timeline>
      <div class="tl-row head"><div></div><div class="tl-axis">${u}${l?n`<span class=${`tl-nowlab num${p.pillLeftPx===null?"":" placed"}`} data-cal-now style=${v}>${w(a.now)}</span>`:c}</div></div>
      <div class="rows">${t.map(m=>this.row(m,e,l?r:-1))}</div>
    </div>`}row(t,e,s){const i=this.ctx.device==="phone",o=this.calOf(t.calendar_id),r=e.to-e.from,l=Array.from({length:r-1},(k,K)=>n`<div class="hl" style=${`left:${(K+1)/r*100}%`}></div>`),p=k=>{const[K,O]=k.split(":").map(Number);return Math.min(100,Math.max(0,(K*60+O-e.from*60)/(r*60)*100))},u=t.open.map(k=>[p(k.from),p(k.to)]).sort((k,K)=>k[0]-K[0]),v=[];let m=0;for(const[k,K]of u)k>m&&v.push([m,k]),m=Math.max(m,K);m<100&&v.push([m,100]);const h=t.entries.filter(k=>!["cancelled","rejected","withdrawn","expired"].includes(k.state)).sort((k,K)=>k.start.localeCompare(K.start)),x=rs(h),b=Math.max(1,...x.map(k=>k+1)),f=this.free&&this.free.room===t.calendar_id?Kt({start:this.free.start.toISOString(),end:this.free.end.toISOString()},this.day,e.from,e.to):null,g=[`${t.capacity??"-"} מקומות`,i?"":o?.floor_name??"",!i&&o&&o.approval_mode!=="none"?"באישור":""].filter(Boolean).join(" · ");return n`<div class="tl-row" data-cal-room=${t.calendar_id}>
      <div class="tl-room"><span class="dot" style=${`--h:${q(o?.color)}`}></span>
        <div class="grow"><div class="name ell" title=${t.name}>${t.name}</div><div class="sub ell">${g}</div></div>
        ${o?.my_role==="view"?n`<span class="lock" title="צפייה בלבד"><sw-icon name="lock" size="14"></sw-icon></span>`:c}</div>
      <div class="tl-track" @click=${k=>this.trackClick(k,t,e)}>
        ${v.filter(([k,K])=>K>k).map(([k,K])=>n`<div class="closed" style=${`left:${k}%;width:${K-k}%`}></div>`)}
        ${l}
        ${h.map((k,K)=>{const O=Kt(k,this.day,e.from,e.to);if(!O)return c;const Ct=100/b,It=`calc(${x[K]*Ct}% + ${b>1?3:7}px)`,$=`calc(${Ct}% - ${b>1?6:14}px)`,St=Xt(k),At=k.state==="pending"?"ממתין לאישור":St==="displaced"?"נדחק בגלל תחזוקה":k.on_behalf_label?`בשם: ${k.on_behalf_label}`:k.organizer?.name??"",pe=O.width>(i?30:8)&&b===1;return n`<button type="button" class="ev" data-mark=${St} data-cal-entry=${k.event_id} style=${`--h:${q(St==="maint"?"orange":o?.color)};left:${O.start}%;width:${O.width}%;top:${It};height:${$}`}
            title=${`${k.title??"תפוס"} · ${w(k.start)}–${w(k.end)}`} @click=${Zt=>{Zt.stopPropagation(),A(this,z.newEvent,{eventId:k.event_id})}}>
            <b>${k.title??"תפוס"}</b>${pe&&At?n`<small>${At}</small>`:c}</button>`})}
        ${f?n`<button type="button" class="tl-free" data-cal-free style=${`left:${f.start}%;width:${f.width}%`} @click=${k=>{k.stopPropagation(),this.book(t.calendar_id,this.free.start,this.free.end)}}>
          פנוי · <span class="num">${w(this.free.start)}</span></button>`:c}
        ${s>0?n`<div class="tl-now" style=${`left:${s}%`}></div>`:c}
      </div></div>`}trackClick(t,e,s){const a=this.calOf(e.calendar_id);if(!this.ctx?.access.can.book||!a?.my_role||a.my_role==="view")return;const o=t.currentTarget.getBoundingClientRect(),r=Math.min(Math.max((t.clientX-o.left)/o.width,0),1),l=Math.floor((s.from*60+r*(s.to-s.from)*60)/30)*30,p=new Date(M(this.day).getTime()+l*6e4);this.book(e.calendar_id,p,new Date(p.getTime()+60*6e4))}legend(){return n`<div class="legend" data-cal-legend>
      <span><i class="ev" style="--h:var(--cal-blue)"></i>מאושר</span>
      <span><i class="ev" data-mark="pending" style="--h:var(--cal-blue)"></i>ממתין לאישור</span>
      <span><i class="ev" data-mark="maint"></i>תחזוקה</span>
      <span><i class="ev" data-mark="displaced"></i>נדחק בגלל תחזוקה</span>
      <span><i class="closed" data-k="closed"></i>סגור</span>
    </div>`}};Q.styles=[nt,tt`
    :host { display: flex; min-block-size: 0; min-inline-size: 0; }
    .main { flex: 1; min-inline-size: 0; }
    .big { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; }
    .big b { font-variant-numeric: tabular-nums; }
    .tl { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; }
    .tl-row { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 10px; min-block-size: 0; }
    .tl-row.head { block-size: 26px; flex: none; }
    .rows { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; }
    .rows .tl-row { flex: 1 1 0; max-block-size: 86px; min-block-size: 52px; }
    .tl-room { display: flex; align-items: center; gap: 10px; padding-inline: 12px; background: var(--sw-surface-2); border-radius: var(--sw-r-lg); min-inline-size: 0; }
    .tl-room .name { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .tl-room .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .tl-room .lock { color: var(--sw-text-3); display: inline-flex; }
    .tl-track { position: relative; direction: ltr; background: var(--sw-surface-2); border-radius: var(--sw-r-lg); overflow: hidden; cursor: copy; }
    .tl-track .closed { position: absolute; inset-block: 0; opacity: 0.9; pointer-events: none; }
    .tl-track .hl { position: absolute; inset-block: 0; inline-size: 1px; background: color-mix(in srgb, var(--sw-text) 7%, transparent); pointer-events: none; }
    .tl-track .ev { position: absolute; padding: 3px 8px; direction: rtl; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); line-height: 1.25; display: flex; flex-direction: column;
      justify-content: center; z-index: 1; }
    .tl-track .ev b { font-size: var(--sw-fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tl-track .ev small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--sw-fs-xs); }
    .tl-axis { position: relative; direction: ltr; block-size: 26px; }
    .tl-axis span { position: absolute; transform: translateX(-50%); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); top: 4px; }
    .tl-axis span.first { transform: none; }
    .tl-axis span.last { transform: translateX(-100%); }
    .tl-now { position: absolute; inset-block: 0; inline-size: 2px; background: var(--sw-accent); z-index: 2; pointer-events: none; }
    /* ROUND4-LEFTOVERS-2390 (D22): ".tl-axis span" (an hour label: grey ink, top 4px) out-ranked the pill's own class, so the time
       on the pill was drawn in the labels' grey on the accent fill (unreadable, it read as a covered label). The pill's rules now
       carry the axis in the selector; once the axis is measured the pill is placed in px inside the axis ("placed": no centring) */
    .tl-axis .tl-nowlab { position: absolute; top: 2px; line-height: 18px; transform: translateX(-50%); background: var(--sw-accent); color: var(--sw-text-inverse); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold);
      border-radius: var(--sw-r-pill); padding: 1px 7px; z-index: 3; white-space: nowrap; }
    .tl-axis .tl-nowlab.placed { transform: none; }
    .tl-free { position: absolute; inset-block: 7px; border-radius: var(--sw-r-xs); outline: 1.5px dashed var(--sw-accent); outline-offset: -1.5px; background: var(--sw-accent-soft);
      color: var(--sw-accent-text); display: grid; place-items: center; font-weight: var(--sw-fw-bold); font-size: var(--sw-fs-sm); direction: rtl; z-index: 2; border: 0; font-family: inherit;
      cursor: pointer; white-space: nowrap; overflow: hidden; }
    .legend { flex: none; }
    .legend i[data-k='closed'] { box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .pop { position: absolute; z-index: calc(var(--sw-z-drawer) + 1); inset-block-start: 56px; inset-inline-end: 16px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-3); padding: 8px; display: grid; gap: 2px; min-inline-size: 200px; }
    .pop label { display: flex; gap: 8px; align-items: center; min-block-size: 34px; padding-inline: 8px; border-radius: var(--sw-r-sm); font-size: var(--sw-fs-md); cursor: pointer; }
    @media (hover: hover) and (pointer: fine) { .pop label:hover { background: var(--sw-hover-wash); } }
    @media (pointer: coarse) { .pop label { min-block-size: 44px; } }
    .btn[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; }
    .fail { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .found { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    @media (max-width: 1179px) { .tl-row { grid-template-columns: 200px minmax(0, 1fr); } }
    @media (max-width: 699px) {
      .panel { padding: 12px; gap: 8px; }
      .big { font-size: var(--sw-fs-xl); }
      .tl-row { grid-template-columns: 112px minmax(0, 1fr); gap: 6px; }
      .tl-room { padding-inline: 8px; gap: 6px; }
      .tl-room .name { font-size: var(--sw-fs-md); }
      .tl-room .dot { display: none; }
      .rows .tl-row { min-block-size: 56px; }
    }
  `];et([y({attribute:!1})],Q.prototype,"ctx",2);et([d()],Q.prototype,"day",2);et([d()],Q.prototype,"rooms",2);et([d()],Q.prototype,"error",2);et([d()],Q.prototype,"capacity",2);et([d()],Q.prototype,"equipment",2);et([d()],Q.prototype,"eqOpen",2);et([d()],Q.prototype,"page",2);et([d()],Q.prototype,"per",2);et([d()],Q.prototype,"shift",2);et([d()],Q.prototype,"axisPx",2);et([d()],Q.prototype,"pillPx",2);et([d()],Q.prototype,"labelPx",2);et([d()],Q.prototype,"free",2);Q=et([it("cal-view-rooms")],Q);function De(t,e){return t.can.edit&&["pending","confirmed"].includes(t.state)&&(t.kind==="booking"||t.kind==="event")&&new Date(t.end)>e&&(t.source??"arx")==="arx"}var Vs=Object.defineProperty,Gs=Object.getOwnPropertyDescriptor,N=(t,e,s,a)=>{for(var i=a>1?void 0:a?Gs(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&Vs(e,s,i),i};let Ys=0,j=class extends at{constructor(){super(...arguments),this.value=[],this.search=null,this.allowGuests=!0,this.allowPeople=!0,this.showContacts=!1,this.showStatus=!1,this.disabled=!1,this.max=50,this.removable=null,this.q="",this.hits=[],this.open=!1,this.active=-1,this.guestOpen=!1,this.gName="",this.gPhone="",this.gEmail="",this.gErr={},this.said="",this.timer=0,this.seq=0,this.uidp=`attp${++Ys}`}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.timer)}fire(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}full(){return this.value.length>=this.max}onInput(t){if(this.q=t.target.value,clearTimeout(this.timer),!this.q.trim()){this.hits=[],this.open=!1;return}this.timer=window.setTimeout(()=>void this.runSearch(),200)}async runSearch(){const t=++this.seq,e=this.q.trim();if(!(!e||!this.search)){try{const s=await this.search(e);if(t!==this.seq)return;this.hits=Ps(s,this.value)}catch{t===this.seq&&(this.hits=[])}this.open=!0,this.active=this.hits.length?0:-1}}onKey(t){if(t.key==="ArrowDown"||t.key==="ArrowUp"){!this.open&&this.hits.length&&(this.open=!0);const e=this.hits.length;if(!e)return;t.preventDefault(),this.active=(this.active+(t.key==="ArrowDown"?1:-1)+e)%e}else t.key==="Enter"?this.open&&this.active>=0&&this.hits[this.active]&&(t.preventDefault(),this.pick(this.hits[this.active])):t.key==="Escape"&&this.open&&(t.stopPropagation(),this.open=!1)}pick(t){if(this.full()){this.said=`אפשר להזמין עד ${this.max} משתתפים.`;return}this.fire("attendee-add",{draft:{key:`${t.kind}:${t.ref_id}`,kind:t.kind,ref_id:t.ref_id,name:t.name,role:"required"}}),this.said=`${t.name} נוסף/ה`,this.q="",this.hits=[],this.open=!1,this.active=-1,this.renderRoot.querySelector('[role="combobox"]')?.focus()}addGuest(){const t=Es(this.gName,this.gPhone,this.gEmail);if(this.gErr=t,Os(t)){const s=t.name?"name":t.phone?"phone":"email";this.renderRoot.querySelector(`[data-att-guest="${s}"]`)?.focus();return}if(this.full()){this.said=`אפשר להזמין עד ${this.max} משתתפים.`;return}const e=Ms(this.gName,this.gPhone,this.gEmail);this.fire("attendee-add",{draft:e}),this.said=`האורח ${e.name} נוסף`,this.gName=this.gPhone=this.gEmail="",this.gErr={}}removeChip(t){this.fire("attendee-remove",{draft:t}),this.said=`${t.name} הוסר/ה`}toggleChipRole(t){const e=ze(t.role);this.fire("attendee-role",{draft:t,role:e}),this.said=`${t.name}: ${Ht[e]}`}canRemove(t){return this.disabled?!!(this.removable&&t.id&&this.removable.has(t.id)):!0}render(){const t=`${this.uidp}-lb`,e=s=>`${this.uidp}-o${s}`;return n`<div class="wrap" data-att-picker>
      ${this.value.length?n`<ul class="chips" aria-label="מוזמנים" data-att-chips>${this.value.map(s=>this.chip(s))}</ul>`:c}
      ${this.allowPeople&&!this.disabled?n`<div class="combo">
          <sw-icon name="search" size="16"></sw-icon>
          <input class="inp" role="combobox" aria-autocomplete="list" aria-expanded=${this.open?"true":"false"} aria-controls=${t}
            aria-activedescendant=${this.open&&this.active>=0?e(this.active):c} aria-label="חיפוש משתמש או דייר להזמנה"
            placeholder="חיפוש משתמש או דייר" autocomplete="off" maxlength="60" data-att-search .value=${this.q} ?disabled=${this.full()}
            @input=${s=>this.onInput(s)} @keydown=${s=>this.onKey(s)} @blur=${()=>window.setTimeout(()=>this.open=!1,150)}>
          ${this.open?n`<ul role="listbox" id=${t} aria-label="תוצאות">
            ${this.hits.length?this.hits.map((s,a)=>n`<li role="option" id=${e(a)} aria-selected=${a===this.active?"true":"false"} data-att-hit=${s.ref_id}
                @mousedown=${i=>i.preventDefault()} @click=${()=>this.pick(s)}><span class="ell">${s.name}</span><span class="k">${Wt[s.kind]}</span></li>`):n`<li class="empty" role="presentation">לא נמצאו תוצאות</li>`}
          </ul>`:c}
        </div>`:c}
      ${this.allowGuests&&!this.disabled?this.guestForm():c}
      ${this.showContacts&&this.value.some(s=>s.kind==="guest")?n`<div class="note" data-att-contact-note>${zs}</div>`:c}
      <div class="sr" role="status" aria-live="polite">${this.said}</div>
    </div>`}chip(t){const e=this.showContacts&&t.kind==="guest"?[t.phone,t.email].filter(Boolean).join(" · "):"";return n`<li class="att" data-kind=${t.kind} data-att-chip=${t.key} aria-label=${As(t)}>
      <span class="nm" title=${t.name}>${t.name}</span>
      <span class="sub">${Wt[t.kind]}${this.showStatus&&t.status?` · ${je[t.status]}`:""}</span>
      ${e?n`<span class="ct">${e}</span>`:c}
      <button type="button" class="mini" aria-pressed=${t.role==="required"?"true":"false"} ?disabled=${this.disabled} data-att-role
        aria-label=${`${t.name}: נוכחות ${Ht[t.role]}. לחיצה מחליפה ל${Ht[ze(t.role)]}`} @click=${()=>this.toggleChipRole(t)}>${Ht[t.role]}</button>
      ${this.canRemove(t)?n`<button type="button" class="mini" aria-label=${`הסרת ${t.name}`} data-att-remove @click=${()=>this.removeChip(t)}><sw-icon name="close" size="12"></sw-icon></button>`:c}
    </li>`}guestForm(){if(!this.guestOpen)return n`<div><button type="button" class="btn sm" data-att-guest-open aria-expanded="false" ?disabled=${this.full()} @click=${()=>this.guestOpen=!0}>
        <sw-icon name="plus" size="14"></sw-icon>הוספת אורח</button></div>`;const t=this.gErr,e=s=>`${this.uidp}-g${s}`;return n`<fieldset data-att-guest-form>
      <legend>אורח (ללא גישה למערכת)</legend>
      <div class="row">
        <input class="inp" id=${e("name")} maxlength="80" placeholder="שם" aria-label="שם האורח" data-att-guest="name" .value=${this.gName} aria-invalid=${t.name?"true":"false"}
          aria-describedby=${t.name?`${e("name")}-e`:c} @input=${s=>this.gName=s.target.value}>
        <input class="inp num ltr" id=${e("phone")} type="tel" inputmode="tel" maxlength="30" placeholder="050-000-0000" aria-label="טלפון האורח" data-att-guest="phone" .value=${this.gPhone}
          aria-invalid=${t.phone?"true":"false"} aria-describedby=${t.phone?`${e("phone")}-e`:c} @input=${s=>this.gPhone=s.target.value}>
        <input class="inp ltr" id=${e("email")} type="email" inputmode="email" maxlength="254" placeholder="name@example.com" aria-label="דוא״ל האורח" data-att-guest="email" .value=${this.gEmail}
          aria-invalid=${t.email?"true":"false"} aria-describedby=${t.email?`${e("email")}-e`:c} @input=${s=>this.gEmail=s.target.value}
          @keydown=${s=>s.key==="Enter"&&this.addGuest()}>
      </div>
      ${t.name?n`<div class="ferr" id=${`${e("name")}-e`}>${t.name}</div>`:c}
      ${t.phone?n`<div class="ferr" id=${`${e("phone")}-e`}>${t.phone}</div>`:c}
      ${t.email?n`<div class="ferr" id=${`${e("email")}-e`}>${t.email}</div>`:c}
      <div class="note">טלפון או דוא״ל. ההזמנה נשלחת בערוץ ההודעות שהוגדר במערכת.</div>
      <div class="row"><button type="button" class="btn sm pri" data-att-guest-add @click=${()=>this.addGuest()}><sw-icon name="check" size="14"></sw-icon>הוספה</button>
        <button type="button" class="btn sm" @click=${()=>{this.guestOpen=!1,this.gErr={}}}>סגירה</button></div>
    </fieldset>`}};j.styles=[nt,tt`
    :host { display: block; min-inline-size: 0; }
    .wrap { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
    .combo { position: relative; }
    .combo .inp { inline-size: 100%; padding-inline-start: 34px; }
    .combo > sw-icon { position: absolute; inset-inline-start: 10px; inset-block-start: 50%; transform: translateY(-50%); color: var(--sw-text-3); pointer-events: none; }
    [role='listbox'] { position: absolute; z-index: 2; inset-inline: 0; inset-block-start: calc(100% + 4px); margin: 0; padding: 4px; list-style: none; max-block-size: 220px; overflow-y: auto;
      background: var(--sw-surface-solid); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); box-shadow: var(--sw-shadow-2); }
    [role='option'] { display: flex; align-items: center; gap: 8px; min-block-size: 40px; padding: 0 10px; border-radius: var(--sw-r-sm); cursor: pointer; }
    [role='option'][aria-selected='true'] { background: var(--sw-hover-wash); }
    @media (hover: hover) and (pointer: fine) { [role='option']:hover { background: var(--sw-hover-wash); } }
    [role='option'] .k { margin-inline-start: auto; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .empty { padding: 8px 10px; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    ul.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    li.att { display: inline-flex; align-items: center; gap: 4px; max-inline-size: 100%; min-block-size: 32px; padding-inline: 10px 2px; border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3); font-size: var(--sw-fs-sm); }
    li.att[data-kind='guest'] { background: var(--sw-accent-soft); }
    li.att .nm { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 18ch; }
    li.att .sub { color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    li.att .ct { direction: ltr; unicode-bidi: isolate; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    .mini { font: inherit; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); min-block-size: 28px; min-inline-size: 28px; padding: 0 8px; border: 0; border-radius: var(--sw-r-pill);
      background: transparent; color: var(--sw-text-2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .mini[aria-pressed='true'] { background: var(--sw-heading); color: var(--sw-surface-solid); }
    .mini:focus-visible, [role='option']:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    @media (hover: hover) and (pointer: fine) { .mini:not([disabled]):hover { background: var(--sw-hover-wash); } .mini[aria-pressed='true']:hover { background: var(--sw-heading); } }
    fieldset { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); margin: 0; padding: 10px; display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; }
    legend { padding: 0 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .row { display: flex; gap: 6px; flex-wrap: wrap; }
    .row > .inp { flex: 1 1 140px; min-inline-size: 0; }
    .ferr { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .note { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    @media (max-width: 699px) { .mini { min-block-size: 44px; min-inline-size: 44px; } li.att { min-block-size: 44px; } [role='option'] { min-block-size: 44px; } }
  `];N([y({attribute:!1})],j.prototype,"value",2);N([y({attribute:!1})],j.prototype,"search",2);N([y({type:Boolean,attribute:"allow-guests"})],j.prototype,"allowGuests",2);N([y({type:Boolean,attribute:"allow-people"})],j.prototype,"allowPeople",2);N([y({type:Boolean,attribute:"show-contacts"})],j.prototype,"showContacts",2);N([y({type:Boolean,attribute:"show-status"})],j.prototype,"showStatus",2);N([y({type:Boolean})],j.prototype,"disabled",2);N([y({type:Number})],j.prototype,"max",2);N([y({attribute:!1})],j.prototype,"removable",2);N([d()],j.prototype,"q",2);N([d()],j.prototype,"hits",2);N([d()],j.prototype,"open",2);N([d()],j.prototype,"active",2);N([d()],j.prototype,"guestOpen",2);N([d()],j.prototype,"gName",2);N([d()],j.prototype,"gPhone",2);N([d()],j.prototype,"gEmail",2);N([d()],j.prototype,"gErr",2);N([d()],j.prototype,"said",2);j=N([it("cal-attendee-picker")],j);var Xs=Object.defineProperty,Qs=Object.getOwnPropertyDescriptor,ot=(t,e,s,a)=>{for(var i=a>1?void 0:a?Qs(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&Xs(e,s,i),i};let mt=class extends at{constructor(){super(...arguments),this.eventId="",this.allowGuests=!0,this.api=null,this.initial=[],this.seeded=!1,this.drafts=[],this.view=null,this.error="",this.busy=!1,this.search=async t=>(await this.client().directory(t)).results}client(){return this.api??Ie()}connectedCallback(){super.connectedCallback(),this.eventId&&this.load()}willUpdate(){!this.seeded&&!this.eventId&&this.initial.length&&(this.drafts=[...this.initial]),this.seeded=!0}payload(){return ce(this.drafts)}async load(){try{this.view=await this.client().list(this.eventId),this.error=""}catch(t){this.error=_(t)}}async run(t){this.busy=!0,this.error="";try{this.view=await t()}catch(e){this.error=_(e)}finally{this.busy=!1}}onAdd(t){const e=t.detail.draft;if(!this.eventId){this.drafts=e.kind==="guest"?[...this.drafts,e]:He(this.drafts,{kind:e.kind,ref_id:e.ref_id,name:e.name});return}this.run(()=>this.client().add(this.eventId,ce([e])))}onRemove(t){const e=t.detail.draft;if(!this.eventId){this.drafts=this.drafts.filter(s=>s.key!==e.key);return}e.id&&this.run(()=>this.client().remove(this.eventId,e.id))}onRole(t){const{draft:e,role:s}=t.detail;if(!this.eventId){this.drafts=this.drafts.map(a=>a.key===e.key?{...a,role:s}:a);return}e.id&&this.run(()=>this.client().setRole(this.eventId,e.id,s))}render(){return n`<div class="sec" data-cal-attendees role="group" aria-labelledby="att-h">
      <span class="lbl" id="att-h">מוזמנים</span>
      <div class="col">${this.eventId?this.existing():this.fresh()}
        ${this.error?n`<div class="err" role="alert" data-att-error>${this.error}</div>`:c}</div>
    </div>`}fresh(){return n`<cal-attendee-picker .value=${this.drafts} .search=${this.search} ?allow-guests=${this.allowGuests} show-contacts
      @attendee-add=${t=>this.onAdd(t)} @attendee-remove=${t=>this.onRemove(t)}
      @attendee-role=${t=>this.onRole(t)}></cal-attendee-picker>`}existing(){const t=this.view;if(!t)return this.error?c:n`<div class="skel" style="block-size:36px"></div>`;if(t.count===null)return n`<span class="muted">—</span>`;const e=t.attendees.map(qs),s=new Set(t.attendees.filter(o=>o.added_by_you||o.you).map(o=>o.id)),a=t.list_visible||t.attendees.length>0,i=t.list_visible?Ls(e):"";return n`
      <span class="muted" data-att-count>${Fe(t.count)}${i?` · ${i}`:""}</span>
      ${a?n`<cal-attendee-picker .value=${e} .search=${this.search} .max=${t.policy.max_attendees} ?disabled=${!t.can.manage||this.busy}
          ?allow-guests=${t.can.add_guest} ?allow-people=${t.can.manage} ?show-contacts=${t.can.contacts} show-status .removable=${s}
          @attendee-add=${o=>this.onAdd(o)} @attendee-remove=${o=>this.onRemove(o)}
          @attendee-role=${o=>this.onRole(o)}></cal-attendee-picker>`:c}
      ${!t.can.manage&&t.can.add_guest?n`<cal-attendee-picker .value=${[]} .max=${t.policy.max_attendees} allow-guests .allowPeople=${!1}
          @attendee-add=${o=>this.onAdd(o)}></cal-attendee-picker>`:c}
      ${t.me&&t.can.respond?n`<div class="rsvp" role="group" aria-label="התשובה שלי" data-att-rsvp>
          ${Object.keys(_e).map(o=>n`<button type="button" class="chipb" aria-pressed=${t.me?.status===o?"true":"false"}
            ?disabled=${this.busy} data-att-respond=${o} @click=${()=>void this.run(()=>this.client().respond(this.eventId,o))}>${_e[o]}</button>`)}
        </div>`:c}
      ${t.can.join?n`<div><button type="button" class="btn sm" ?disabled=${this.busy} data-att-join
          @click=${()=>void this.run(()=>this.client().add(this.eventId,[{kind:"user",ref_id:"@me"}]))}><sw-icon name="plus" size="14"></sw-icon>הצטרפות לאירוע</button></div>`:c}`}};mt.styles=[nt,tt`
    :host { display: block; min-inline-size: 0; }
    .sec { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px 14px; align-items: start; }
    .lbl { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); padding-block-start: 6px; }
    .col { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .rsvp { display: flex; gap: 6px; flex-wrap: wrap; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 699px) { .sec { grid-template-columns: minmax(0, 1fr); gap: 6px; } .lbl { padding: 0; } }
  `];ot([y({attribute:!1})],mt.prototype,"eventId",2);ot([y({type:Boolean,attribute:"allow-guests"})],mt.prototype,"allowGuests",2);ot([y({attribute:!1})],mt.prototype,"api",2);ot([y({attribute:!1})],mt.prototype,"initial",2);ot([d()],mt.prototype,"drafts",2);ot([d()],mt.prototype,"view",2);ot([d()],mt.prototype,"error",2);ot([d()],mt.prototype,"busy",2);mt=ot([it("cal-attendees-section")],mt);let Tt=class extends at{constructor(){super(...arguments),this.value=[],this.onChange=null,this.api=null,this.open=!1,this.search=async t=>(await(this.api??Ie()).directory(t)).results}put(t){this.onChange?.(t)}render(){const t=this.value.length;return n`<button type="button" class="tg" aria-expanded=${String(this.open)} aria-controls="qatt" data-cal-qc-attendees-toggle @click=${()=>this.open=!this.open}>
        <sw-icon name="users" size="16"></sw-icon><span>משתתפים</span><span class="muted">${t?Fe(t):"אף אחד עדיין"}</span>
        <sw-icon class="chev" name="chevronDown" size="14"></sw-icon></button>
      ${this.open?n`<div class="body" id="qatt" data-cal-qc-attendees><cal-attendee-picker .value=${this.value} .search=${this.search} allow-guests show-contacts
        @attendee-add=${e=>{const s=e.detail.draft;this.put(s.kind==="guest"?[...this.value,s]:He(this.value,{kind:s.kind,ref_id:s.ref_id,name:s.name}))}}
        @attendee-remove=${e=>this.put(this.value.filter(s=>s.key!==e.detail.draft.key))}
        @attendee-role=${e=>this.put(this.value.map(s=>s.key===e.detail.draft.key?{...s,role:e.detail.role}:s))}></cal-attendee-picker></div>`:c}`}};Tt.styles=[nt,tt`
    :host { display: block; min-inline-size: 0; }
    .tg { display: flex; align-items: center; gap: 8px; inline-size: 100%; min-block-size: 32px; padding: 0; border: 0; background: transparent; font: inherit;
      font-size: var(--sw-fs-md); color: var(--sw-heading); cursor: pointer; text-align: start; }
    .tg > sw-icon { color: var(--sw-text-3); flex: none; }
    .tg .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .tg .chev { margin-inline-start: auto; transition: transform var(--sw-t-hover) var(--sw-ease-color); }
    .tg[aria-expanded='true'] .chev { transform: rotate(180deg); }
    .tg:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; border-radius: var(--sw-r-sm); }
    .body { padding-block-start: 6px; padding-inline-start: 26px; }
    /* ROUND4-LEFTOVERS-2390 (D22 review): the attendees toggle is a 44 px target on a touch screen */
    @media (pointer: coarse) { .tg { min-block-size: 44px; } }
  `];ot([y({attribute:!1})],Tt.prototype,"value",2);ot([y({attribute:!1})],Tt.prototype,"onChange",2);ot([y({attribute:!1})],Tt.prototype,"api",2);ot([d()],Tt.prototype,"open",2);Tt=ot([it("cal-quick-attendees")],Tt);oe.attendees=t=>t.surface==="drawer"?n`<cal-attendees-section .eventId=${t.eventId??""}
    .initial=${!t.eventId&&Array.isArray(t.value)?t.value:[]}></cal-attendees-section>`:n`<cal-quick-attendees .value=${Array.isArray(t.value)?t.value:[]} .onChange=${e=>t.onChange(e)}></cal-quick-attendees>`;var Ws=Object.defineProperty,Zs=Object.getOwnPropertyDescriptor,I=(t,e,s,a)=>{for(var i=a>1?void 0:a?Zs(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&Ws(e,s,i),i};let T=class extends at{constructor(){super(...arguments),this.ctx=null,this.detail=null,this.calId="",this.evTitle="",this.date="",this.from="",this.to="",this.repeat="none",this.count=9,this.behalf="self",this.behalfLabel="",this.headcount="",this.guestName="",this.guestPhone="",this.dayOcc=[],this.preview=null,this.error="",this.suggestions=[],this.busy=!1,this.event=null,this.confirmCancel=!1,this.retention=null,this.guestKinds=["customer","class"],this.editMode=!1,this.notes="",this.attendees=void 0,this.previewTimer=0,this.dayKey="",this.onKey=t=>{t.key==="Escape"&&this.close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.onKey);const t=this.detail??{};if(t.eventId){this.loadEvent(t.eventId);return}const s=this.ctx?.now??new Date,a=this.bookable().find(r=>r.id===t.calendarId)??this.defaultCal();this.calId=a?.id??"";const i=t.start?new Date(t.start):new Date(Math.ceil(s.getTime()/(30*6e4))*30*6e4),o=t.end?new Date(t.end):new Date(i.getTime()+60*6e4);this.date=X(i),this.from=w(i),this.to=w(o),t.title&&(this.evTitle=t.title),t.repeat&&(this.repeat=t.repeat),t.count&&(this.count=t.count),t.behalf&&t.behalf in ft&&(this.behalf=t.behalf),t.behalfLabel&&(this.behalfLabel=t.behalfLabel),t.headcount&&(this.headcount=String(t.headcount)),Array.isArray(t.attendees)&&t.attendees.length&&(this.attendees=[...t.attendees]),this.loadSettings()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.onKey),clearTimeout(this.previewTimer)}firstUpdated(){this.renderRoot.querySelector('[data-cal-field="title"]')?.focus({preventScroll:!0})}willUpdate(t){this.editMode&&(t.has("calId")||t.has("date"))&&this.loadDay(),!(this.event||this.detail?.eventId)&&(["calId","date","from","to","repeat","count","behalf","headcount"].some(e=>t.has(e))&&this.schedulePreview(),(t.has("calId")||t.has("date"))&&this.loadDay())}bookable(){return(this.ctx?.cals??[]).filter(t=>!t.archived&&t.my_role&&t.my_role!=="view"&&t.type!=="maintenance")}defaultCal(){const t=this.bookable();return t.find(e=>e.type==="room"&&e.my_role==="manage")??t.find(e=>e.type==="room")??t[0]}cal(){return this.ctx?.cals.find(t=>t.id===this.calId)}async loadSettings(){try{const{settings:t}=await this.ctx.api.settings();this.retention=t.guest_retention_days,this.guestKinds=t.guest_details_kinds?.length?t.guest_details_kinds:this.guestKinds}catch{}}async loadEvent(t){try{const e=(await this.ctx.api.event(t)).event;if(this.event=e,De(e,this.ctx?.now??new Date)){const s=new Date(e.start);this.calId=e.calendar_id,this.evTitle=e.title??"",this.notes=e.notes??"",this.date=X(s),this.from=w(s),this.to=w(e.end),this.behalf=e.on_behalf_kind??"self",this.behalfLabel=e.on_behalf_label??"",this.headcount=e.headcount?String(e.headcount):"",this.editMode=!0,this.loadSettings()}}catch(e){this.error=_(e)}}patchBody(){const t=this.event,e=ut(this.date,this.from),s=ut(this.date,this.to);if(!t||!e||!s)return null;const a=this.ctx,i={revision:t.revision};this.evTitle.trim()!==(t.title??"")&&(i.title=this.evTitle.trim()),this.notes!==(t.notes??"")&&(i.notes=this.notes),t.recurring||((e.toISOString()!==new Date(t.start).toISOString()||s.toISOString()!==new Date(t.end).toISOString())&&(i.start=e.toISOString(),i.end=s.toISOString()),this.calId!==t.calendar_id&&(i.calendar_id=this.calId));const o=parseInt(this.headcount,10),r=o>0?o:null;return r!==(t.headcount??null)&&(i.headcount=r),a.access.can.book_for_others&&(this.behalf!==(t.on_behalf_kind??"self")||this.behalfLabel.trim()!==(t.on_behalf_label??""))&&(i.on_behalf={kind:this.behalf,label:this.behalfLabel.trim()}),i}async saveEdit(){const t=this.problem();if(t){this.error=t;return}const e=this.patchBody();if(e){if(Object.keys(e).length===1){this.close();return}this.busy=!0,this.error="";try{const s=await this.ctx.api.patchEvent(this.event.id,e);A(this,z.changed),A(this,z.toast,s.change_withdrawn?"השינוי בוטל · ההזמנה חזרה למועד המאושר":s.event.state==="pending"&&s.event.held?"השינויים נשמרו · ממתין לאישור, המועד הקודם שמור":s.event.state==="pending"?"השינויים נשמרו · ממתין לאישור":"השינויים נשמרו"),this.close()}catch(s){this.error=_(s)}finally{this.busy=!1}}}editHint(){const t=this.cal(),e=ut(this.date,this.from),s=ut(this.date,this.to),a=this.event;return!t||!e||!s||!a||s<=e||!(e.getTime()!==new Date(a.start).getTime()||s.getTime()!==new Date(a.end).getTime()||t.id!==a.calendar_id)?null:Bt({cal:t,start:e,end:s,ignoreId:a.id,moving:a.state==="confirmed"?"confirmed":"pending",behalf:this.behalf,headcount:parseInt(this.headcount,10)||void 0},this.dayOcc,{contested_requests:"queue",maintenance_overlap:"first_holds",editors_bypass_approval:!0,pending_holds_slot:!1},this.ctx?.now??new Date)}async loadDay(){const t=this.ctx,e=ut(this.date,"00:00");if(!t||!e||!this.calId)return;const s=`${this.calId}|${this.date}`;if(s!==this.dayKey){this.dayKey=s;try{const a=await t.api.occurrences(e.toISOString(),B(e,1).toISOString(),[this.calId]);s===this.dayKey&&(this.dayOcc=a.occurrences.filter(i=>["confirmed","pending"].includes(i.state)))}catch{this.dayOcc=[]}}}body(){const t=ut(this.date,this.from),e=ut(this.date,this.to);if(!t||!e||!this.calId)return null;const s=this.ctx,a={calendar_id:this.calId,kind:"booking",title:this.evTitle.trim(),start:t.toISOString(),end:e.toISOString()},i=qe(this.repeat,this.count);i&&(a.rrule=i),s.access.can.book_for_others&&this.behalf!=="self"&&(a.on_behalf={kind:this.behalf,label:this.behalfLabel.trim()});const o=parseInt(this.headcount,10);o>0&&(a.headcount=o),this.guestsOffered()&&(this.guestName.trim()||this.guestPhone.trim())&&(a.guests=[{name:this.guestName.trim(),phone:this.guestPhone.trim()}]);const r=this.renderRoot.querySelector("cal-attendees-section")?.payload()??[];return r.length&&Object.assign(a,{attendees:r}),a}guestsOffered(){const t=this.ctx;return t.access.ui.guest_details_enabled&&t.access.can.book_for_others&&this.behalf!=="self"&&this.guestKinds.includes(this.behalf)}schedulePreview(){clearTimeout(this.previewTimer),this.previewTimer=window.setTimeout(()=>void this.runPreview(),250)}async runPreview(){const t=this.body();if(!t||new Date(t.end)<=new Date(t.start)){this.preview=null;return}try{this.preview=await this.ctx.api.previewEvent({...t,title:t.title||"בדיקה"})}catch{this.preview=null}}close(){this.dispatchEvent(new Event("close"))}problem(){const t=ut(this.date,this.from),e=ut(this.date,this.to);return this.calId?this.evTitle.trim()?!t||!e?"חסר תאריך או שעה.":e<=t?"שעת הסיום לפני שעת ההתחלה.":this.behalf!=="self"&&!this.behalfLabel.trim()?`חסר שם ה${ft[this.behalf]}.`:"":"חסרה כותרת.":"אין יומן שאפשר להזמין בו."}async submit(){const t=this.problem();if(t){this.error=t;return}const e=this.body();this.busy=!0,this.error="",this.suggestions=[];try{const s=await this.ctx.api.createEvent(e);A(this,z.changed),A(this,z.toast,s.state==="pending"?"הבקשה נשלחה לאישור":"ההזמנה נשמרה"),this.close()}catch(s){this.error=_(s),s instanceof dt&&Array.isArray(s.body.details.suggestions)&&(this.suggestions=s.body.details.suggestions.slice(0,3))}finally{this.busy=!1}}take(t){const e=new Date(t.start);this.date=X(e),this.from=w(e),this.to=w(t.end),this.suggestions=[],this.error=""}render(){if(!this.ctx)return c;const e=!!this.detail?.eventId;return n`<div class="scrim" @click=${()=>this.close()}></div>
      <aside role="dialog" aria-modal="true" aria-labelledby="h" data-cal-drawer=${this.editMode?"edit":e?"event":"new"}>
        ${this.editMode?this.form():e?this.viewEvent():this.form()}
      </aside>`}viewEvent(){const t=this.ctx,e=this.event,s=e?t.cals.find(o=>o.id===e.calendar_id):void 0,a=!!e&&e.can.cancel&&["confirmed","displaced"].includes(e.state),i=!!e&&e.state==="pending"&&(e.can.cancel||e.can.edit);return n`<header><div><h2 id="h" class="ell">${e?e.title??"תפוס":"טוען…"}</h2>${s?n`<div class="muted">${s.name}</div>`:c}</div>
        <button type="button" class="btn icon x" aria-label="סגירה" data-cal-close @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        ${e?n`<dl>
          <dt>מתי</dt><dd class="num">${bt(e.start,e.end,t.now).split(" · ")[0]} · <span class="ltr">${w(e.start)}–${w(e.end)}</span>${e.recurring?" · חוזר":""}</dd>
          <dt>מצב</dt><dd><span class=${`chip ${e.state==="confirmed"?"ok":e.state==="pending"?"dash":e.state==="displaced"?"warn":""}`}>${Ce[e.state]}</span>${e.contested?n` <span class="chip warn">מתחרה על החלון</span>`:c}</dd>
          ${e.organizer?n`<dt>מארגן</dt><dd>${e.organizer.name}</dd>`:c}
          ${e.on_behalf_label?n`<dt>בשם</dt><dd>${e.on_behalf_label}</dd>`:c}
          ${e.headcount?n`<dt>משתתפים</dt><dd class="num">${e.headcount}</dd>`:c}
          ${e.notes?n`<dt>הערות</dt><dd>${e.notes}</dd>`:c}
        </dl>
        <cal-attendees-section .eventId=${e.id}></cal-attendees-section>
        ${e.sync_flag?n`<div class="note bad" role="note"><sw-icon name="warning" size="18"></sw-icon><div><b>מסומן להחלטה</b><span class="muted">${e.sync_flag==="conflict"?"התנגשות עם יומן חיצוני: שתי ההזמנות נשמרו. ההחלטה בהגדרות ‹ חיבורי יומן.":"האירוע נמחק ביומן החיצוני."}</span></div></div>`:c}
        ${!De(e,t.now)&&["pending","confirmed"].includes(e.state)?n`<div class="note" role="note" data-cal-readonly-why><sw-icon name="lock" size="18"></sw-icon><div><b>צפייה בלבד</b>
          <span class="muted">${e.can.edit?new Date(e.end)<=t.now?"המועד כבר עבר.":e.kind==="maintenance"?'חלון תחזוקה נערך בלשונית "תחזוקה".':"אירוע מיומן חיצוני.":"רק המארגן או מנהל היומן יכולים לשנות."}</span></div></div>`:c}
        ${e.state==="displaced"?n`<div class="note warn" role="note"><sw-icon name="warning" size="18"></sw-icon><div><b>ההזמנה נדחקה בגלל תחזוקה</b><span class="muted">היא לא נמחקה. אפשר לבחור מועד אחר ולבטל אותה.</span></div></div>`:c}
        ${this.confirmCancel?n`<div class="note warn" role="alert"><sw-icon name="warning" size="18"></sw-icon><div><b>${i?"למשוך את הבקשה?":"לבטל את ההזמנה?"}</b><span class="muted">${e.recurring?"הביטול חל על כל הסדרה.":"המועד יתפנה לאחרים."}</span></div></div>`:c}`:this.error?c:n`<div class="skel" style="block-size:120px"></div>`}
        ${this.error?n`<div class="err" role="alert" data-cal-error>${this.error}</div>`:c}
      </div>
      <footer>
        ${a||i?n`<button type="button" class=${`btn bad${this.confirmCancel?" fill":""}`} ?disabled=${this.busy} data-cal-cancel-event @click=${()=>void this.cancelEvent(i)}>
          <sw-icon name="trash" size="16"></sw-icon>${this.confirmCancel?"כן, לבטל":i?"משיכת הבקשה":"ביטול ההזמנה"}</button>`:c}
        <button type="button" class="btn" @click=${()=>this.close()}>סגירה</button>
      </footer>`}async cancelEvent(t){if(!this.confirmCancel){this.confirmCancel=!0;return}const e=this.event;this.busy=!0;try{const s=this.ctx.api;t?await s.withdrawEvent(e.id,e.revision):await s.cancelEvent(e.id,e.revision),A(this,z.changed),A(this,z.toast,t&&e.held?"בקשת השינוי נמשכה · ההזמנה חזרה למועד הקודם":t?"הבקשה נמשכה":"ההזמנה בוטלה"),this.close()}catch(s){this.error=_(s),this.confirmCancel=!1}finally{this.busy=!1}}roleLine(t){const e=this.ctx;return t?.my_role==="manage"?`ניהול היומן "${t.name}" · ללא צורך באישור`:e.access.can.book_for_others?"מזמין גם בשם אחרים":"יוצר הזמנות שלו בלבד"}form(){const t=this.ctx,e=this.cal(),s=this.bookable(),a=t.access.can.book_for_others,i=ut(this.date,this.from),o=ut(this.date,this.to),r=this.preview?.conflicts??[],p=!!this.preview?.needs_approval_by.length&&e?.my_role!=="manage"||r.length>0,u=parseInt(this.headcount,10),v=!!e?.capacity&&u>e.capacity,m=e?[e.name,e.floor_name].filter(Boolean).join(" · "):"",h=this.editMode?this.event:null,x=!!h?.recurring,b=h?this.editHint():null,f=h?!!b&&(b.level==="pend"||b.level==="contest"):p;return n`<header><div><h2 id="h">${h?"עריכת הזמנה":"הזמנה חדשה"}</h2>${m?n`<div class="muted ell">${m}</div>`:c}</div>
        <button type="button" class="btn icon x" aria-label="סגירה" data-cal-close @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        <div class="lockline" data-cal-roleline><sw-icon name="shield" size="16"></sw-icon><span class="ell">${this.roleLine(e)}</span></div>
        ${h?.held?n`<div class="note warn" role="note" data-cal-held-note><sw-icon name="warning" size="18"></sw-icon><div><b>בקשת שינוי ממתינה</b>
          <span class="muted">המועד הקודם <span class="ltr num">${w(h.held.start)}–${w(h.held.end)}</span> שמור עד שתתקבל החלטה.</span></div></div>`:c}
        ${x?n`<div class="note" role="note" data-cal-series-note><sw-icon name="refresh" size="18"></sw-icon><div><b>אירוע חוזר</b><span class="muted">כאן משנים כותרת ומשתתפים לכל הסדרה. את השעות של מועד אחד משנים מהלוח.</span></div></div>`:c}
        ${s.length?c:n`<div class="note warn" role="note"><sw-icon name="lock" size="18"></sw-icon><div><b>אין יומן שאפשר להזמין בו</b><span class="muted">מנהל היומן יכול לתת הרשאה.</span></div></div>`}
        <div class="fld"><label for="cal">יומן</label>
          <div class="selrow"><span class="dot" style=${`--h:${q(e?.color)}`}></span>
            <select id="cal" class="inp" data-cal-field="calendar" .value=${this.calId} ?disabled=${x} @change=${g=>this.calId=g.target.value}>
              ${s.map(g=>n`<option value=${g.id} ?selected=${g.id===this.calId}>${g.name}</option>`)}</select><sw-icon name="chevronDown" size="16"></sw-icon></div></div>
        <div class="fld"><label for="t">כותרת</label><input id="t" class="inp" maxlength="200" data-cal-field="title" .value=${this.evTitle} placeholder="למשל: ישיבת צוות" @input=${g=>this.evTitle=g.target.value}></div>
        <div class="fld"><span class="lbl">מתי</span><div class="ctls">
          <input type="date" lang=${_t()} class="inp" aria-label="תאריך" data-cal-field="date" .value=${this.date} ?disabled=${x} @change=${g=>this.date=g.target.value}>
          <input type="time" lang=${_t()} class="inp short" aria-label="שעת התחלה" step=${ct(e)*60} data-cal-field="from" .value=${this.from} ?disabled=${x} @change=${g=>this.from=g.target.value}>
          <input type="time" lang=${_t()} class="inp short" aria-label="שעת סיום" step=${ct(e)*60} data-cal-field="to" .value=${this.to} ?disabled=${x} @change=${g=>this.to=g.target.value}></div></div>
        ${h?c:n`<div class="fld"><label for="rep">חזרה</label><div class="ctls">
          <select id="rep" class="inp" data-cal-field="repeat" .value=${this.repeat} @change=${g=>this.repeat=g.target.value}>
            <option value="none" ?selected=${this.repeat==="none"}>פעם אחת</option><option value="weekly" ?selected=${this.repeat==="weekly"}>כל שבוע</option><option value="daily" ?selected=${this.repeat==="daily"}>כל יום</option></select>
          ${this.repeat!=="none"?n`<input type="number" class="inp short num" min="2" max="104" aria-label="מספר מועדים" data-cal-field="count" .value=${String(this.count)} @input=${g=>this.count=parseInt(g.target.value,10)||2}>`:c}</div></div>`}
        ${!h&&this.repeat!=="none"&&i?n`<div class="fld"><span></span><span class="hint num" data-cal-repeat-summary><sw-icon name="refresh" size="14"></sw-icon><span class="ell">${Ae(this.repeat,this.count,i)}</span></span></div>`:c}
        <div class="fld top"><span class="lbl">הזמינות</span><div class="col">${h?this.editAvailability(i,o,b):this.availability(i,o,r)}</div></div>
        ${a?n`
          <div class="fld"><label for="bh">בשם</label><div class="ctls">
            <select id="bh" class="inp short" data-cal-field="behalf" .value=${this.behalf} @change=${g=>this.behalf=g.target.value}>
              ${Object.keys(ft).map(g=>n`<option value=${g} ?selected=${g===this.behalf}>${ft[g]}</option>`)}</select>
            ${this.behalf!=="self"?n`<input class="inp" maxlength="80" aria-label=${`שם ה${ft[this.behalf]}`} data-cal-field="behalf-label" .value=${this.behalfLabel} placeholder=${`שם ה${ft[this.behalf]}`} @input=${g=>this.behalfLabel=g.target.value}>`:c}</div></div>`:n`<div class="lockline" data-cal-behalf-locked><sw-icon name="lock" size="16"></sw-icon><span>הזמנה בשם צוות, חוג או לקוח - למי שקיבל את ההרשאה</span></div>`}
        <div class="fld"><label for="hc">משתתפים</label><div class="ctls">
          <input id="hc" type="number" min="1" class="inp short num" inputmode="numeric" data-cal-field="headcount" .value=${this.headcount} @input=${g=>this.headcount=g.target.value}>
          ${e?.capacity?n`<span class=${`hint${v?" bad":""}`} data-cal-capacity-hint><span>מתוך <span class="num">${e.capacity}</span> מקומות${v?" · יותר מהקיבולת":""}</span></span>`:c}</div></div>
        <div class="slot" data-cal-slot="attendees">${Me({surface:"drawer",calendarId:this.calId,eventId:h?.id,value:this.attendees,onChange:g=>this.attendees=g})}</div>
        ${h?n`<div class="fld top"><label for="nt">הערות</label><textarea id="nt" class="inp" rows="2" maxlength="2000" style="padding-block:8px;resize:none" data-cal-field="notes" .value=${this.notes}
          @input=${g=>this.notes=g.target.value}></textarea></div>`:c}
        ${this.guestsOffered()?n`<div class="fld top"><span class="lbl">פרטי אורח</span><div class="col">
            <div class="ctls"><input class="inp" maxlength="80" aria-label="שם האורח" placeholder="שם" data-cal-field="guest-name" .value=${this.guestName} @input=${g=>this.guestName=g.target.value}>
              <input class="inp num ltr" type="tel" inputmode="tel" maxlength="20" aria-label="טלפון האורח" placeholder="050-000-0000" data-cal-field="guest-phone" .value=${this.guestPhone} @input=${g=>this.guestPhone=g.target.value}></div>
            <span class="hint" data-cal-retention><sw-icon name="clock" size="14"></sw-icon><span>${this.retention===null?"השם והטלפון יימחקו אחרי המועד האחרון, לפי הגדרות השמירה.":this.retention===0?"השם והטלפון יימחקו בסיום המועד האחרון.":n`השם והטלפון יימחקו <span class="num">${this.retention}</span> יום אחרי המועד האחרון.`}${this.behalfLabel.trim()?` התווית "${this.behalfLabel.trim()}" נשארת.`:""}</span></span></div></div>`:c}
        ${!h&&p?n`<div class="note" role="note" data-cal-approval-note><sw-icon name="info" size="18"></sw-icon><div><b>הבקשה תישלח לאישור</b>
          <span class="muted">${r.length?"המועד חופף להזמנה שכבר אושרה; הבקשה תיכנס לתור והמנהל יחליט. ":""}${e?.owner.name?`${e.owner.name}, מנהל/ת היומן, ת/יקבל התראה. `:""}בקשה לא שומרת את המועד: מי שמאושר ראשון מקבל אותו.</span></div></div>`:c}
        ${this.error?n`<div class="err" role="alert" data-cal-error>${this.error}</div>`:c}
        ${this.suggestions.length?n`<div class="sugg">${this.suggestions.map(g=>n`<button type="button" class="num ltr" @click=${()=>this.take(g)}>${w(g.start)}–${w(g.end)}</button>`)}</div>`:c}
      </div>
      <footer>
        <button type="button" class="btn pri" ?disabled=${this.busy||!s.length||b?.level==="bad"} data-cal-submit @click=${()=>void(h?this.saveEdit():this.submit())}><sw-icon name="check" size="16"></sw-icon>${f?"שליחה לאישור":"שמירה"}</button>
        <button type="button" class="btn" @click=${()=>this.close()}>ביטול</button>
        ${h?n`<span class="sp"></span><button type="button" class=${`btn bad${this.confirmCancel?" fill":""}`} ?disabled=${this.busy} data-cal-cancel-event
          @click=${()=>void this.cancelEvent(h.state==="pending"&&!!h.held)}><sw-icon name="trash" size="16"></sw-icon>${this.confirmCancel?"כן, לבטל":h.held?"משיכת השינוי":h.state==="pending"?"משיכת הבקשה":"ביטול ההזמנה"}</button>`:c}
      </footer>`}editAvailability(t,e,s){const a=this.availability(t,e,s?.contested?[{calendar_id:this.calId,start:s.contested.start,end:s.contested.end,title:s.contested.title,state:"confirmed"}]:[]);if(!s)return n`${a}`;const i=s.level==="bad"||s.level==="contest"?"bad":s.level==="pend"?"warn":"ok",o=s.level==="ok"?s.warn??"פנוי":s.level==="pend"&&this.event?.state==="confirmed"?`${s.reason}. המועד הנוכחי נשמר עד ההחלטה`:s.reason;return n`${a}<span class=${`hint ${i}`} data-cal-edit-hint=${s.level}><sw-icon name=${i==="ok"?"check":i==="warn"?"info":"warning"} size="14"></sw-icon><span>${o}</span></span>`}availability(t,e,s){const r=t?M(t):null,l=x=>Math.min(100,Math.max(0,((x.getTime()-r.getTime())/6e4-420)/900*100)),p=s.length>0,u=this.repeat==="none"?1:Math.min(Math.max(this.count,2),104),m=this.cal()?.buffer_after_min??0,h=p&&t&&e?this.nextFree(t,e):null;return n`<div class="mini" aria-hidden="true" data-cal-mini>
        ${r?this.dayOcc.map(x=>n`<div class="busy" data-mark=${x.state==="pending"?"pending":""} style=${`left:${l(new Date(x.start))}%;width:${l(new Date(x.end))-l(new Date(x.start))}%`}></div>`):c}
        ${t&&e&&e>t?n`<div class=${`slot${p?" clash":""}`} style=${`left:${l(t)}%;width:${Math.max(1,l(e)-l(t))}%`}></div>`:c}
      </div>
      <div class="scale num"><span>07:00</span><span>12:00</span><span>17:00</span><span>22:00</span></div>
      ${!this.preview||this.editMode?c:p?n`<span class="hint bad" data-cal-avail="clash"><sw-icon name="warning" size="14"></sw-icon><span class="ell"><b>${u>1?n`<span class="num">${s.length}</span> מועדים מתנגשים`:"המועד תפוס"}</b>${s[0]?n` · <span class="num">${pt(new Date(s[0].start))} ${w(s[0].start)}</span>${s[0].title?` (${s[0].title})`:""}`:c}</span></span>
          ${h?n`<div class="sugg"><button type="button" class="num ltr" data-cal-suggest @click=${()=>this.take(h)}>${w(h.start)}–${w(h.end)}</button></div>`:c}`:n`<span class="hint ok" data-cal-avail="free"><sw-icon name="check" size="14"></sw-icon><span class="ell"><b>${u>1?n`פנוי בכל <span class="num">${u}</span> המועדים`:"פנוי"}</b>${m?n` · כולל <span class="num">${m}</span> דק׳ הפסקה אחרי`:c}</span></span>`}`}nextFree(t,e){const s=e.getTime()-t.getTime(),a=new Date(M(t).getTime()+22*36e5);for(let i=t.getTime()+15*6e4;i+s<=a.getTime();i+=15*6e4){const o=new Date(i),r=new Date(i+s);if(!this.dayOcc.some(l=>l.state==="confirmed"&&new Date(l.start)<r&&new Date(l.end)>o))return{start:o.toISOString(),end:r.toISOString()}}return null}};T.styles=[nt,tt`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .scrim { position: absolute; inset: 0; background: var(--sw-overlay); animation: fade var(--sw-t-med) var(--sw-ease); }
    aside { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: min(500px, 100vw); background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; animation: slide 240ms var(--sw-ease-drawer); }
    @keyframes slide { from { transform: translateX(100%); } }
    @keyframes fade { from { opacity: 0; } }
    :host-context([dir='ltr']) aside { animation-name: slide-l; }
    @keyframes slide-l { from { transform: translateX(-100%); } }
    @media (prefers-reduced-motion: reduce) { aside, .scrim { animation: none; } }
    header { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 10px; }
    header h2 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    header .muted { margin-block-start: 2px; }
    header .x { margin-inline-start: auto; flex: none; }
    .body { flex: 1; min-block-size: 0; padding: 4px 22px 12px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; overscroll-behavior: contain; }
    /* CAL-GRID-EDIT-2343: the edit form (and a plugged-in section such as the attendee picker) may be taller than the drawer: it scrolls inside, never the page */
    footer { display: flex; gap: 10px; padding: 12px 22px calc(16px + env(safe-area-inset-bottom, 0px)); border-block-start: 1px solid var(--sw-border); align-items: center; }
    .lockline { display: flex; align-items: center; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); padding: 8px 12px; border-radius: var(--sw-r-md);
      background: var(--sw-surface-3); }
    .ctls { display: flex; gap: 8px; min-inline-size: 0; align-items: center; }
    .ctls > .inp { flex: 1; }
    .ctls > .short { flex: 0 0 104px; }
    .selrow { position: relative; display: flex; align-items: center; }
    .selrow .dot { position: absolute; inset-inline-start: 12px; pointer-events: none; }
    .selrow select { padding-inline-start: 30px; }
    .selrow sw-icon { position: absolute; inset-inline-end: 10px; color: var(--sw-text-3); pointer-events: none; }
    .hint { display: flex; gap: 6px; align-items: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
    .hint.ok { color: var(--sw-success-text); }
    .hint.bad { color: var(--sw-danger-text); }
    .hint.warn { color: var(--sw-warning-text); }
    .mini { position: relative; direction: ltr; block-size: 26px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); overflow: hidden; }
    .mini .busy { position: absolute; inset-block: 4px; border-radius: var(--sw-r-2xs); background: var(--sw-surface-3); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .mini .busy[data-mark='pending'] { background: transparent; box-shadow: none; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .mini .slot { position: absolute; inset-block: 2px; border-radius: var(--sw-r-2xs); background: var(--sw-accent-soft); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .mini .slot.clash { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .scale { display: flex; justify-content: space-between; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .sugg { display: flex; gap: 6px; flex-wrap: wrap; }
    .sugg button { font: inherit; min-block-size: 30px; padding-inline: 12px; border-radius: var(--sw-r-pill); background: var(--sw-accent-soft); color: var(--sw-accent-text); border: 0;
      font-weight: var(--sw-fw-bold); font-size: var(--sw-fs-sm); cursor: pointer; }
    .col { display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; }
    .fld.top { align-items: start; }
    .fld.top > .lbl, .fld.top > label { padding-block-start: 10px; }
    .note sw-icon { flex: none; color: var(--sw-accent-text); margin-block-start: 2px; }
    .note.warn sw-icon { color: var(--sw-warning-text); }
    .note.bad sw-icon { color: var(--sw-danger-text); }
    .note .muted { display: block; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .slot:empty { display: none; }
    dl { margin: 0; display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px 14px; font-size: var(--sw-fs-md); }
    dt { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    dd { margin: 0; min-inline-size: 0; overflow-wrap: anywhere; color: var(--sw-text); }
    input[type='date'], input[type='time'] { font-variant-numeric: tabular-nums; }
    @media (max-width: 699px) {
      aside { inline-size: 100vw; }
      header { padding: 14px 16px 6px; }
      header h2 { font-size: var(--sw-fs-xl); }
      .body { padding: 4px 16px 10px; gap: 8px; overflow-y: auto; overscroll-behavior: contain; }
      footer { padding-inline: 16px; }
      .ctls { flex-wrap: wrap; }
      .ctls > .inp { flex: 1 1 120px; }
      .inp { min-block-size: 44px; }
    }
  `];I([y({attribute:!1})],T.prototype,"ctx",2);I([y({attribute:!1})],T.prototype,"detail",2);I([d()],T.prototype,"calId",2);I([d()],T.prototype,"evTitle",2);I([d()],T.prototype,"date",2);I([d()],T.prototype,"from",2);I([d()],T.prototype,"to",2);I([d()],T.prototype,"repeat",2);I([d()],T.prototype,"count",2);I([d()],T.prototype,"behalf",2);I([d()],T.prototype,"behalfLabel",2);I([d()],T.prototype,"headcount",2);I([d()],T.prototype,"guestName",2);I([d()],T.prototype,"guestPhone",2);I([d()],T.prototype,"dayOcc",2);I([d()],T.prototype,"preview",2);I([d()],T.prototype,"error",2);I([d()],T.prototype,"suggestions",2);I([d()],T.prototype,"busy",2);I([d()],T.prototype,"event",2);I([d()],T.prototype,"confirmCancel",2);I([d()],T.prototype,"retention",2);I([d()],T.prototype,"guestKinds",2);I([d()],T.prototype,"editMode",2);I([d()],T.prototype,"notes",2);I([d()],T.prototype,"attendees",2);T=I([it("cal-event-drawer")],T);var Js=Object.defineProperty,ta=Object.getOwnPropertyDescriptor,V=(t,e,s,a)=>{for(var i=a>1?void 0:a?ta(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&Js(e,s,i),i};let H=class extends at{constructor(){super(...arguments),this.ctx=null,this.shrink=!1,this.reqs=null,this.error="",this.seg="pending",this.page=1,this.selId="",this.choice="approve",this.pick="",this.lanes=[],this.series=[],this.skip=new Set,this.rejecting=null,this.note="",this.busy=!1,this.actErr="",this.overlay=!1,this.listH=0,this.decided=[],this.ro=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this)}updated(){this.measure()}measure(){const t=this.renderRoot.querySelector(".list");t&&Math.abs(t.clientHeight-this.listH)>4&&(this.listH=t.clientHeight)}willUpdate(t){t.has("ctx")&&(this.shrink=this.ctx?.device==="tablet"&&this.ctx.access.ui.tablet_panels==="shrink")}get device(){return this.ctx?.device??"desktop"}panelMode(){return this.device==="desktop"||this.device==="tablet"&&this.ctx?.access.ui.tablet_panels==="shrink"?"inline":"overlay"}async load(){if(this.ctx)try{const{requests:t}=await this.ctx.api.requests();if(this.reqs=t,this.error="",!t.find(s=>s.event_id===this.selId)&&(this.selId="",this.panelMode()==="inline")){const s=t.find(a=>a.competing_count>1)??t.find(a=>a.recurring)??t[0];s&&this.select(s,!1)}}catch(t){this.error=_(t)}}perPage(){const t=this.device==="phone"?222:this.device==="tablet"?136:122;return this.listH?Vt(this.listH+8,t):this.device==="desktop"?4:2}holderOf(t){return t.room_calendar_id??t.calendar.id}rivals(t){const e=this.holderOf(t),s=(this.reqs??[]).filter(a=>this.holderOf(a)===e&&a.start<t.end&&a.end>t.start);return Ze(s,this.ctx?.access.ui.contested_order??"first_come")}async select(t,e=!0){if(!this.ctx)return;this.selId=t.event_id,this.actErr="",this.skip=new Set,this.series=[],this.lanes=[],e&&this.panelMode()==="overlay"&&(this.overlay=!0);const s=this.ctx.access.ui.contested_order,a=this.rivals(t);this.pick=s==="manual"?a.length>1?"":t.event_id:(a.find(r=>r.suggested)??a[0]??t).event_id,this.choice="approve";const i=this.holderOf(t),o=M(new Date(t.start));try{if(t.recurring){const{occurrences:u}=await this.ctx.api.occurrences(o.toISOString(),B(o,61).toISOString(),[i]);this.series=u.filter(v=>v.event_id===t.event_id).slice(0,12)}const{occurrences:r}=await this.ctx.api.occurrences(o.toISOString(),B(o,1).toISOString(),[i]),l=r.filter(u=>u.state==="confirmed"&&u.start<t.end&&u.end>t.start&&u.kind!=="holiday"&&!a.some(v=>v.event_id===u.event_id)),p=this.ctx.cals.find(u=>u.id===i)?.color??t.calendar.color;this.lanes=[...l.map(u=>({id:u.event_id,title:u.title??"תפוס",who:u.organizer?.name??u.on_behalf_label??"",start:u.start,end:u.end,holder:!0,req:null,color:p})),...a.map(u=>({id:u.event_id,title:u.title??"בקשה",who:[u.organizer?.name,u.headcount?`${u.headcount.toLocaleString("he-IL")} משתתפים`:""].filter(Boolean).join(" · "),start:u.start,end:u.end,holder:!1,req:u,color:u.calendar.color}))]}catch{this.lanes=a.map(r=>({id:r.event_id,title:r.title??"בקשה",who:r.organizer?.name??"",start:r.start,end:r.end,holder:!1,req:r,color:r.calendar.color}))}}async decide(t,e,s={}){if(!this.ctx)return!1;this.busy=!0,this.actErr="";try{await this.ctx.api.decide(t.event_id,{decision:e,revision:t.revision,room_calendar_id:t.room_calendar_id,note:s.note||void 0,displace_existing:s.displace||void 0,except_occurrences:s.except?.length?s.except:void 0}),this.decided=[{r:t,decision:e,at:new Date,displaced:!!s.displace},...this.decided].slice(0,50);const a=t.title??"הבקשה";return A(this,z.toast,e==="approve"?s.displace?`"${a}" אושרה; ההזמנה שהחזיקה את החלון נדחקה`:`"${a}" אושרה`:`"${a}" נדחתה`),A(this,z.changed),this.overlay=!1,await this.load(),!0}catch(a){return this.actErr=this.errText(a),a instanceof dt&&a.code==="slot_held"&&await this.select(t),a instanceof dt&&a.code==="slot_held"&&(this.actErr=this.errText(a)),!1}finally{this.busy=!1}}errText(t){if(t instanceof dt){if(t.code==="slot_held")return"החלון כבר תפוס על ידי הזמנה שאושרה קודם. אפשר לאשר עם דחיקה או לדחות.";if(t.code==="displace_disabled")return"בהתקנה הזאת אי אפשר לדחוק הזמנה שאושרה. אפשר לדחות את הבקשה.";if(t.status===403)return"דחיקה של הזמנה מאושרת דורשת את אישור מנהל היומן עצמו.";if(t.code==="stale")return"הבקשה עודכנה בינתיים. הרשימה רועננה."}return _(t)}async applyChoice(t){const e=this.rivals(t);if(this.choice==="keep"){for(const i of e)if(!await this.decide(i,"reject",{note:"החלון נשאר להזמנה שאושרה קודם"}))return;return}const s=e.find(i=>i.event_id===this.pick)??t,a=this.lanes.some(i=>i.holder)||s.conflicts_now>0;await this.decide(s,"approve",{displace:a&&this.ctx?.access.ui.allow_displace!==!1,except:[...this.skip]})}render(){if(!this.ctx)return c;if(this.error&&!this.reqs)return n`<section class="panel main" data-cal-state="error"><sw-state-panel state="error" heading="הבקשות לא נטענו" hint=${this.error} actionLabel="לנסות שוב" @action=${()=>void this.load()}></sw-state-panel></section>`;if(!this.reqs)return n`<section class="panel main" aria-busy="true">${Array.from({length:4},()=>n`<div class="skel" style="block-size:96px"></div>`)}</section>`;const t=this.reqs.find(s=>s.event_id===this.selId)??null,e=this.panelMode();return n`
      <section class="panel main" data-approvals>
        <div class="ph">
          <div class="seg" role="group" aria-label="בקשות">
            <button type="button" aria-pressed=${String(this.seg==="pending")} data-seg="pending" @click=${()=>{this.seg="pending",this.page=1}}>ממתינות <span class="num">${this.reqs.length}</span></button>
            <button type="button" aria-pressed=${String(this.seg==="decided")} data-seg="decided" @click=${()=>{this.seg="decided",this.page=1}}>הוחלטו לאחרונה</button>
          </div>
          <span class="sp"></span>
          ${this.device==="phone"?c:this.managedDots()}
        </div>
        ${this.actErr&&!(t&&(e==="inline"||this.overlay))&&!this.rejecting?n`<div class="note bad" role="alert" data-act-error>${this.actErr}</div>`:c}
        ${this.seg==="pending"?this.pendingList():this.decidedList()}
      </section>
      ${t&&e==="inline"?this.detail(t,!1):c}
      ${t&&e==="overlay"&&this.overlay?n`<div class="scrim" @click=${()=>this.overlay=!1}></div>${this.detail(t,!0)}`:c}
      ${this.rejecting?this.rejectDialog(this.rejecting):c}`}managedDots(){const t=(this.ctx?.cals??[]).filter(e=>e.my_role==="manage");return n`<span class="hintline">יומנים שבניהולך: ${t.slice(0,8).map(e=>n`<span class="dot" style=${`--h:${q(e.color)}`}></span>`)}<span class="num">${t.length}</span></span>`}pendingList(){const t=this.reqs??[];if(!t.length)return n`<div class="reqs-empty" data-cal-state="empty"><sw-state-panel icon="calendar" state="empty" heading="אין בקשות שממתינות לך"
        hint="כשמישהו יבקש חדר ביומן שבאחריותך, הבקשה תופיע כאן ותקבל התראה."></sw-state-panel></div>`;const e=wt(t,this.page,this.perPage());return n`<div class="list" data-req-list>${e.items.map(s=>this.card(s))}</div>${this.pager(e.page,e.pages)}`}card(t){const e=this.ctx?.now??new Date,s=(new Date(t.start).getTime()-e.getTime())/36e5,a=this.ctx?.cals.find(l=>l.id===(t.room_calendar_id??t.calendar.id))?.approval_timeout_h??2,i=Math.floor(s-a),[o,r]=bt(t.start,t.end,e).split(" · ");return n`<div class="req" role="button" tabindex="0" aria-current=${String(t.event_id===this.selId)} data-req=${t.event_id}
        @click=${l=>{l.target.closest("button")||this.select(t)}}
        @keydown=${l=>{l.key==="Enter"&&l.target===l.currentTarget&&this.select(t)}}>
      <div class="info">
        <div class="ttl"><span class="dot" style=${`--h:${q(t.calendar.color)}`}></span><span class="ell" title=${t.title??""}>${t.title??"בקשה"}</span></div>
        <div class="when"><span>${o} · <span class="ltr num">${r}</span></span>${t.recurring?n`<span class="chip"><sw-icon name="refresh" size="12"></sw-icon><span class="ell">${t.recurring_summary??"סדרה"}</span></span>`:c}</div>
        <div class="meta">
          <span title=${t.calendar.name}>${t.calendar.name}</span>${t.organizer?.name?n`<span title=${t.organizer.name}>${t.organizer.name}</span>`:c}
          <span title=${t.on_behalf_label??""}>${t.on_behalf_label?`בשם: ${t.on_behalf_label}`:n`<span class="muted">ללא תווית</span>`}</span>
          ${t.headcount?n`<span class="num">${t.headcount.toLocaleString("he-IL")} משתתפים</span>`:c}
          ${t.conflicts_now&&t.competing_count<=1?n`<span class="chip bad" data-chip="conflict"><sw-icon name="warning" size="12"></sw-icon>חופף להזמנה מאושרת</span>`:c}
          ${s>0&&i>=0&&i<=12?n`<span class="chip warn num" data-chip="deadline">נשארו ${i} שע׳ להחלטה</span>`:c}
          ${t.competing_count>1?n`<span class="chip warn num" data-chip="contest"><sw-icon name="users" size="12"></sw-icon>${t.competing_count.toLocaleString("he-IL")} מבקשים לחלון</span>`:c}
          ${t.guests_count?n`<span class="chip num" data-chip="guests"><sw-icon name="lock" size="12"></sw-icon>פרטי אורח: ${t.guests_count}</span>`:c}
          ${t.suggested&&this.ctx?.access.ui.contested_order!=="manual"?n`<span class="chip acc" data-chip="first">ראשון בתור</span>`:c}
        </div>
      </div>
      <div class="acts">
        <button type="button" class="btn yes" ?disabled=${this.busy} data-approve=${t.event_id} @click=${()=>void this.quickApprove(t)}><sw-icon name="check" size="14"></sw-icon>אישור</button>
        <button type="button" class="btn no" ?disabled=${this.busy} data-reject=${t.event_id} @click=${()=>{this.rejecting=t,this.note="",this.actErr=""}}><sw-icon name="close" size="14"></sw-icon>דחייה</button>
      </div>
    </div>`}async quickApprove(t){if(t.competing_count>1||t.conflicts_now>0){await this.select(t);return}await this.decide(t,"approve")}decidedList(){if(!this.decided.length)return n`<div class="reqs-empty" data-cal-state="decided-empty"><sw-state-panel icon="check" state="empty" heading="עוד לא הוחלט דבר מאז שנפתח המסך" hint="החלטות שתקבל כאן יופיעו ברשימה הזאת."></sw-state-panel></div>`;const t=wt(this.decided,this.page,this.perPage()+2);return n`<div class="list">${t.items.map(e=>n`<div class="row" data-decided=${e.r.event_id}>
      <span class="dot" style=${`--h:${q(e.r.calendar.color)}`}></span>
      <div class="grow"><div class="name ell">${e.r.title??"בקשה"}</div><div class="sub ell">${e.r.calendar.name} · ${bt(e.r.start,e.r.end,this.ctx?.now??new Date)}</div></div>
      ${e.displaced?n`<span class="chip warn">נדחקה הזמנה</span>`:c}
      <span class=${`chip ${e.decision==="approve"?"ok":"bad"}`}>${e.decision==="approve"?"אושר":"נדחה"} · <span class="num">${w(e.at)}</span></span></div>`)}</div>${this.pager(t.page,t.pages)}`}pager(t,e){return n`<div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${t<=1} @click=${()=>this.page=t-1}><sw-icon name="chevron" size="14"></sw-icon></button>
      <span class="num" data-page>${t} / ${e}</span>
      <button type="button" class="btn" aria-label="הבא" ?disabled=${t>=e} @click=${()=>this.page=t+1}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`}detail(t,e){const s=this.lanes.length>1||t.competing_count>1,a=t.recurring&&!s,i=s?`${t.calendar.name} · ${bt(t.start,t.end,this.ctx?.now??new Date).split(" · ")[0]}`:t.title??"בקשה";return n`<aside class=${`panel ${e?"overlay":""}`} role=${e?"dialog":"complementary"} aria-label="פרטי הבקשה" data-detail=${s?"contested":a?"series":"single"}>
      <div class="ph"><h2 class="ell" title=${i}>${i}</h2>
        ${e?n`<span class="sp"></span><button type="button" class="btn icon sm" aria-label="סגירה" data-detail-close @click=${()=>this.overlay=!1}><sw-icon name="close" size="14"></sw-icon></button>`:c}</div>
      ${a?this.seriesBody(t):this.contestBody(t)}
      ${this.actErr?n`<div class="err" role="alert" data-act-error>${this.actErr}</div>`:c}
    </aside>`}contestBody(t){const e=this.lanes.length?this.lanes:[{id:t.event_id,title:t.title??"בקשה",who:t.organizer?.name??"",start:t.start,end:t.end,holder:!1,req:t,color:t.calendar.color}],s=new Date(Math.min(...e.map(f=>new Date(f.start).getTime())));s.setMinutes(0,0,0),s.setHours(s.getHours()-1);const a=new Date(Math.max(...e.map(f=>new Date(f.end).getTime())));a.setMinutes(0,0,0),a.setHours(a.getHours()+2);const i=a.getTime()-s.getTime(),o=f=>(new Date(f).getTime()-s.getTime())/i*100,r=e.find(f=>f.holder),l=e.filter(f=>!f.holder),p=this.ctx?.access.ui,u=l.find(f=>f.id===this.pick)?.req??(l.length===1?l[0].req:null)??null,v=!!r&&p?.allow_displace===!1,m=v?"keep":this.choice,h=p?.contested_order??"first_come",x=new Date((s.getTime()+a.getTime())/2),b=m==="approve"&&!u;return n`
      <div class="muted"><b class="num" style="color:var(--sw-heading)">${l.length}</b> ${l.length===1?"מבקש":"מבקשים"} לאותו חלון${r?" · מי שאושר ראשון מחזיק":""}
        · ${h==="manual"?"הסדר: המנהל בוחר":h==="by_kind"?"הסדר: לפי סוג":"הסדר: לפי סדר הגעה"}</div>
      <div class="lanes" data-lanes>${e.map(f=>n`<div class="lane" data-lane=${f.holder?"holder":"request"} data-lane-id=${f.id}>
        <div class="ln"><b class="ell" title=${f.title}>${f.title}</b><span class="ell" title=${f.who}>${f.who}</span></div>
        <div class="mini"><div class="ev" data-mark=${f.holder?"ok":"pending"} style=${`--h:${q(f.color)};left:${o(f.start)}%;width:${Math.max(2,o(f.end)-o(f.start))}%`}></div></div>
        <span class="chipcell">${f.holder?n`<span class="chip ok">מאושר · מחזיק את החלון</span>`:n`<span class="chip dash num">בקשה ${l.indexOf(f)+1}${f.req?.requested_at?n` · ${w(f.req.requested_at)}`:c}</span>${f.req?.suggested&&h!=="manual"?n`<span class="chip acc" data-first-in-line>ראשון בתור</span>`:c}`}</span></div>`)}</div>
      <div class="axis"><span class="num">${w(s)}</span><span class="num">${w(x)}</span><span class="num">${w(a)}</span></div>
      ${l.length>1&&m==="approve"?n`<label style="display:flex;flex-direction:column;gap:4px"><span class="lbl">איזו בקשה לאשר</span><select class="inp" data-pick @change=${f=>this.pick=f.target.value}>
        ${h==="manual"?n`<option value="" ?selected=${!this.pick}>בחירה…</option>`:c}
        ${l.map((f,g)=>n`<option value=${f.id} ?selected=${f.id===this.pick}>${g+1}. ${f.title}</option>`)}</select></label>`:c}
      <div role="radiogroup" aria-label="מה לעשות" style="display:flex;flex-direction:column;gap:8px">
        <button type="button" class="opt" role="radio" aria-checked=${String(m==="approve")} aria-disabled=${String(v)} data-choice="approve"
          @click=${()=>{v||(this.choice="approve")}}><span class="rad"></span><span>
          <b>${u?`לאשר את "${u.title??"הבקשה"}"`:"לאשר את הבקשה שתבחר"}${r?" ולדחוק":""}</b>
          <small>${v?"בהתקנה הזאת דחיקה של הזמנה מאושרת כבויה (הגדרות ‹ יומנים). אפשר רק לדחות את הבקשות.":r?`"${r.title}" נדחקת ולא נמחקת; ${r.who||"המארגן"} יבחר זמן חלופי מתוך 3 הצעות.${l.length>1?" שאר הבקשות נשארות ממתינות.":""}`:l.length>1?"הבקשה מאושרת; שאר הבקשות לחלון נשארות ממתינות ויוכרעו מול ההזמנה שאושרה.":"הבקשה מאושרת והמבקש מקבל הודעה."}</small></span></button>
        <button type="button" class="opt" role="radio" aria-checked=${String(m==="keep")} data-choice="keep" @click=${()=>this.choice="keep"}><span class="rad"></span><span>
          <b>${r?"להשאיר למחזיק ולדחות את הבקשות":"לדחות את כל הבקשות לחלון"}</b>
          <small>${l.length>1?`${l.length} הבקשות נדחות עם הערה`:"הבקשה נדחית עם הערה"} והמבקשים מקבלים הצעות לזמן אחר.</small></span></button>
      </div>
      <div class="hintline"><sw-icon name="shield" size="14"></sw-icon>${p?.displace_approver==="any_manager"?"מחליט: מנהל היומן, מנהל האזור או מנהל המערכת":"מחליט: מנהל היומן. דחיקה רק באישור מנהל היומן עצמו"}</div>
      <div class="foot">
        <button type="button" class="btn yes" ?disabled=${this.busy||b} data-apply @click=${()=>{this.choice=m,this.applyChoice(t)}}>
          <sw-icon name="check" size="14"></sw-icon>${m==="keep"?"דחיית הבקשות":r?"אישור ודחיקה":"אישור"}</button>
        <button type="button" class="btn no" ?disabled=${this.busy||!u} @click=${()=>{u&&(this.rejecting=u,this.note="")}}>דחייה עם הערה</button>
      </div>`}localKey(t){return t.occurrence_id.split("@")[1]??t.start}seriesBody(t){const e=this.series,s=e[0];return n`
      <div class="muted">${t.calendar.name}${t.organizer?.name?` · ביקש/ה ${t.organizer.name}`:""}</div>
      ${s?n`<div style="font-weight:700;color:var(--sw-heading)">המועד הראשון: <span class="num">${kt[new Date(s.start).getDay()]} ${pt(new Date(s.start))} · <span class="ltr">${w(s.start)}–${w(s.end)}</span></span></div>`:c}
      <div style="font-weight:700;color:var(--sw-heading)">${e.length?n`<span class="num">${e.length}</span> מועדים`:t.recurring_summary??"סדרה"}</div>
      ${e.length?n`<div class="dates" data-dates>${e.map(a=>{const i=this.localKey(a),o=this.skip.has(i);return n`<button type="button" class="date" aria-pressed=${String(o)} title=${o?"יידחה":"יאושר"} data-date=${i}
          @click=${()=>{const r=new Set(this.skip);o?r.delete(i):r.add(i),this.skip=r}}>
          <span class="num">${pt(new Date(a.start))}</span>${a.contested&&!o?n`<span class="chip bad">מתנגש</span>`:o?n`<sw-icon name="close" size="12"></sw-icon>`:n`<sw-icon class="ok-ic" name="check" size="12"></sw-icon>`}</button>`})}</div>`:c}
      <div class="note"><sw-icon name="info" size="16"></sw-icon><div><b>אפשר לאשר את הסדרה ולדחות מועדים בודדים</b><span class="muted">לחיצה על תאריך מוציאה אותו. המבקש יראה "אושר למעט N מועדים".</span></div></div>
      <div class="foot">
        <button type="button" class="btn yes" ?disabled=${this.busy} data-apply @click=${()=>void this.decide(t,"approve",{except:[...this.skip]})}>
          <sw-icon name="check" size="14"></sw-icon>${this.skip.size?n`אישור למעט <span class="num">${this.skip.size}</span>`:"אישור הסדרה"}</button>
        <button type="button" class="btn no" ?disabled=${this.busy} @click=${()=>{this.rejecting=t,this.note=""}}>דחייה עם הערה</button>
      </div>`}rejectDialog(t){return n`<div class="scrim" @click=${()=>this.rejecting=null}></div>
      <aside class="panel overlay short" role="dialog" aria-label="דחיית בקשה" data-reject-dialog>
        <div class="ph"><h2 class="ell">לדחות את "${t.title??"הבקשה"}"?</h2></div>
        <div class="muted">${t.calendar.name} · ${bt(t.start,t.end,this.ctx?.now??new Date)}</div>
        <label class="lbl" for="note">הערה למבקש (לא חובה, עד 300 תווים)</label>
        <textarea id="note" class="inp" maxlength="300" .value=${this.note} @input=${e=>this.note=e.target.value} data-reject-note></textarea>
        ${this.actErr?n`<div class="err" role="alert">${this.actErr}</div>`:c}
        <div class="foot">
          <button type="button" class="btn bad fill" ?disabled=${this.busy} data-reject-confirm @click=${async()=>{await this.decide(t,"reject",{note:this.note})&&(this.rejecting=null)}}>דחייה</button>
          <button type="button" class="btn" @click=${()=>this.rejecting=null}>ביטול</button>
        </div>
      </aside>`}};H.styles=[nt,tt`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
    .req { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; padding: 12px 16px; border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2); border: 1.5px solid transparent; cursor: pointer; min-inline-size: 0; text-align: start; flex: none; }
    .req[aria-current='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .req:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .req .info { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
    .ttl { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); min-inline-size: 0; }
    .when { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; min-inline-size: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; align-items: center; }
    .meta > span { max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .acts { display: flex; gap: 8px; }
    .yes { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .no { color: var(--sw-danger-text); }
    .hintline { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: inline-flex; gap: 6px; align-items: center; }
    aside.panel { inline-size: 440px; flex: none; }
    aside .lanes { display: flex; flex-direction: column; gap: 8px; }
    .lane { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 4px 10px; align-items: center; }
    .lane .ln { display: flex; flex-direction: column; min-inline-size: 0; }
    .lane .ln b { font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .lane .ln span { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .lane .chipcell { grid-column: 2; justify-self: start; display: flex; gap: 4px; flex-wrap: wrap; }
    .mini { position: relative; block-size: 28px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); direction: ltr; overflow: hidden; }
    .mini .ev { position: absolute; inset-block: 4px; padding: 0; }
    .axis { display: flex; justify-content: space-between; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); padding-inline-end: 140px; }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt[aria-disabled='true'] { opacity: var(--sw-disabled-opacity); cursor: default; }
    .opt .rad { inline-size: 18px; block-size: 18px; border-radius: 50%; border: 2px solid var(--sw-border-strong); flex: none; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border: 5px solid var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); margin-block-start: 2px; }
    .dates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
    .date { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-block-size: 34px; padding: 0 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2);
      border: 0; font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-heading); cursor: pointer; }
    .date[aria-pressed='true'] { background: var(--sw-danger-soft); color: var(--sw-danger-text); text-decoration: line-through; }
    .ok-ic { color: var(--sw-success-text); }
    .foot { display: flex; gap: 8px; margin-block-start: auto; }
    .foot .btn:first-child { flex: 1; }
    textarea.inp { padding: 10px 12px; min-block-size: 72px; resize: none; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    aside.overlay { position: fixed; inset-block: 12px; inset-inline-start: 12px; z-index: calc(var(--sw-z-modal) + 1); inline-size: min(440px, calc(100vw - 24px)); box-shadow: var(--sw-shadow-3); }
    aside.overlay.short { inset-block: auto 12px; }
    :host([shrink]) aside.panel:not(.overlay) { inline-size: 320px; }
    :host([shrink]) .lane { grid-template-columns: 96px minmax(0, 1fr); }
    :host([shrink]) .axis { padding-inline-end: 106px; }
    .reqs-empty { flex: 1; display: grid; place-items: center; }
    .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: var(--sw-fw-semibold); }
    @media (max-width: 699px) {
      .req { grid-template-columns: minmax(0, 1fr); padding: 12px; }
      .acts .btn { flex: 1; }
      aside.overlay { inset: auto 0 0 0; inline-size: 100%; max-block-size: 88dvh; border-end-start-radius: 0; border-end-end-radius: 0; padding-block-end: calc(16px + env(safe-area-inset-bottom)); }
    }
  `];V([y({attribute:!1})],H.prototype,"ctx",2);V([y({type:Boolean,reflect:!0})],H.prototype,"shrink",2);V([d()],H.prototype,"reqs",2);V([d()],H.prototype,"error",2);V([d()],H.prototype,"seg",2);V([d()],H.prototype,"page",2);V([d()],H.prototype,"selId",2);V([d()],H.prototype,"choice",2);V([d()],H.prototype,"pick",2);V([d()],H.prototype,"lanes",2);V([d()],H.prototype,"series",2);V([d()],H.prototype,"skip",2);V([d()],H.prototype,"rejecting",2);V([d()],H.prototype,"note",2);V([d()],H.prototype,"busy",2);V([d()],H.prototype,"actErr",2);V([d()],H.prototype,"overlay",2);V([d()],H.prototype,"listH",2);H=V([it("cal-view-approvals")],H);var ea=Object.defineProperty,sa=Object.getOwnPropertyDescriptor,zt=(t,e,s,a)=>{for(var i=a>1?void 0:a?sa(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&ea(e,s,i),i};const aa={confirmed:["מוצב","ok"],pending:["ממתין להחלטה","dash"],rejected:["נדחה","bad"],cancelled:["בוטל",""],done:["הסתיים",""],displaced:["נדחק","warn"],expired:["פג",""],withdrawn:["בוטל",""]};let gt=class extends at{constructor(){super(...arguments),this.ctx=null,this.wins=null,this.error="",this.seg="next",this.page=1,this.listH=0,this.overlap="first_holds",this.ro=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this)}updated(){this.measure()}measure(){const t=this.renderRoot.querySelector(".list");t&&Math.abs(t.clientHeight-this.listH)>4&&(this.listH=t.clientHeight)}async load(){if(!this.ctx)return;const t=this.ctx.now;try{const{occurrences:e}=await this.ctx.api.occurrences(M(B(t,-7)).toISOString(),M(B(t,54)).toISOString()),s=new Map;for(const a of e.filter(i=>i.kind==="maintenance"||i.kind==="maintenance_task")){const i=`${a.event_id}@${a.start}`,o=s.get(i)??{o:a,rooms:[]},r=this.ctx.cals.find(l=>l.id===a.calendar_id)?.type==="room";for(const l of[...a.room_calendar_ids,...r?[a.calendar_id]:[]])o.rooms.includes(l)||o.rooms.push(l);r||(o.o={...a,room_calendar_ids:o.o.room_calendar_ids}),s.set(i,o)}this.ctx.api.settings().then(a=>this.overlap=a.settings.maintenance_overlap).catch(()=>{}),this.wins=[...s.values()].sort((a,i)=>a.o.start.localeCompare(i.o.start)),this.error=""}catch(e){this.error=_(e)}}render(){if(!this.ctx)return c;if(this.error&&!this.wins)return n`<section class="panel" data-cal-state="error"><div class="center"><sw-state-panel state="error" heading="חלונות התחזוקה לא נטענו" hint=${this.error} actionLabel="לנסות שוב" @action=${()=>void this.load()}></sw-state-panel></div></section>`;if(!this.wins)return n`<section class="panel" aria-busy="true">${Array.from({length:5},()=>n`<div class="skel" style="block-size:56px"></div>`)}</section>`;const t=this.ctx.now.toISOString(),e=this.seg==="next"?this.wins.filter(o=>o.o.end>=t):this.wins.filter(o=>o.o.end<t).reverse(),s=this.ctx.device==="phone"?104:64,a=wt(e,this.page,this.listH?Vt(this.listH+6,s):5),i=this.ctx.access.can.maintenance;return n`<section class="panel" data-maint-list>
      <div class="ph">
        <div class="seg" role="group" aria-label="חלונות">
          <button type="button" aria-pressed=${String(this.seg==="next")} data-seg="next" @click=${()=>{this.seg="next",this.page=1}}>הבאים <span class="num">${this.wins.filter(o=>o.o.end>=t).length}</span></button>
          <button type="button" aria-pressed=${String(this.seg==="past")} data-seg="past" @click=${()=>{this.seg="past",this.page=1}}>השבוע שעבר</button>
        </div>
        <span class="sp"></span>
        <span class="mode"><sw-icon name="info" size="14"></sw-icon>מעל הזמנה מאושרת: <b>${jt[this.overlap]}</b></span>
      </div>
      ${e.length?n`<div class="list">${a.items.map(o=>this.row(o))}</div>
        <div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${a.page<=1} @click=${()=>this.page=a.page-1}><sw-icon name="chevron" size="14"></sw-icon></button>
          <span class="num" data-page>${a.page} / ${a.pages}</span>
          <button type="button" class="btn" aria-label="הבא" ?disabled=${a.page>=a.pages} @click=${()=>this.page=a.page+1}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`:n`<div class="center" data-cal-state="empty"><sw-state-panel icon="wrench" state="empty" heading=${this.seg==="next"?"אין חלונות תחזוקה מתוכננים":"לא היו חלונות תחזוקה בשבוע שעבר"}
          hint="חלון תחזוקה מסמן חדרים כתפוסים לעבודה; לפני השמירה רואים אם הוא חופף להזמנות." actionLabel=${i&&this.seg==="next"?"חלון תחזוקה חדש":""}
          @action=${()=>A(this,z.newMaint,{})}></sw-state-panel></div>`}
    </section>`}row(t){const e=this.ctx?.cals.find(o=>o.id===t.o.calendar_id),[s,a]=aa[t.o.state]??[t.o.state,""],i=t.rooms.map(o=>this.ctx?.cals.find(r=>r.id===o)).filter(Boolean);return n`<div class="row" data-maint-row=${t.o.event_id}>
      <span class="sq" style=${`--h:${q(e?.color??"orange")}`}></span>
      <div class="grow"><div class="name ell" title=${t.o.title??""}>${t.o.title??"חלון תחזוקה"}</div><div class="sub ell">${e?.name??""}${t.o.contested?" · מתחרה על החלון":""}</div></div>
      <div class="rooms">${i.map(o=>n`<span class="chip" title=${o.name}><span class="dot" style=${`--h:${q(o.color)}`}></span>${o.name}</span>`)}</div>
      <span class="when num">${bt(t.o.start,t.o.end,this.ctx?.now??new Date)}</span>
      <span class=${`chip ${a}`}>${s}</span>
    </div>`}};gt.styles=[nt,tt`
    :host { display: flex; min-block-size: 0; }
    .panel { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
    .row { cursor: default; flex: none; }
    .rooms { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; max-inline-size: 40%; }
    .when { font-weight: var(--sw-fw-bold); color: var(--sw-heading); font-size: var(--sw-fs-md); white-space: nowrap; }
    .mode { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: inline-flex; gap: 6px; align-items: center; }
    .mode b { color: var(--sw-heading); }
    .center { flex: 1; display: grid; place-items: center; }
    @media (max-width: 699px) {
      .row { flex-wrap: wrap; row-gap: 6px; }
      .rooms { max-inline-size: 100%; order: 3; inline-size: 100%; }
      .mode { display: none; }
    }
  `];zt([y({attribute:!1})],gt.prototype,"ctx",2);zt([d()],gt.prototype,"wins",2);zt([d()],gt.prototype,"error",2);zt([d()],gt.prototype,"seg",2);zt([d()],gt.prototype,"page",2);zt([d()],gt.prototype,"listH",2);zt([d()],gt.prototype,"overlap",2);gt=zt([it("cal-view-maint")],gt);var ia=Object.defineProperty,na=Object.getOwnPropertyDescriptor,rt=(t,e,s,a)=>{for(var i=a>1?void 0:a?na(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&ia(e,s,i),i};const oa={first_holds:'החלון יישמר כממתין ומסומן "מתחרה". אף הזמנה לא נדחקת עד שמנהלי החדרים מחליטים.',override_notify:'ההזמנות החופפות יעברו ל"נדחק" (לא נמחקות) והמארגנים יקבלו הודעה עם 3 זמנים חלופיים.',block:"השמירה חסומה. הזיזו את החלון או בחרו זמן פנוי.",ask:"בחרו מה יקרה להזמנות החופפות."};let J=class extends at{constructor(){super(...arguments),this.ctx=null,this.detail=null,this.calId="",this.evTitle="",this.date="",this.from="",this.to="",this.rooms=[],this.devices="",this.preview=null,this.decision="override_notify",this.busy=!1,this.err="",this.timer=0,this.onKey=t=>{t.key==="Escape"&&this.close()}}connectedCallback(){super.connectedCallback();const t=this.ctx?.now??new Date,e=this.detail??{},s=e.start?new Date(e.start):new Date(Math.ceil(t.getTime()/18e5)*18e5+36e5),a=e.end?new Date(e.end):new Date(s.getTime()+150*6e4);this.date=X(s),this.from=w(s),this.to=w(a),this.calId=this.maintCals()[0]?.id??"";const i=this.roomCals();this.rooms=e.rooms?.length?e.rooms.filter(o=>i.some(r=>r.id===o)):i.slice(0,1).map(o=>o.id),window.addEventListener("keydown",this.onKey),this.schedule()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),clearTimeout(this.timer)}maintCals(){return(this.ctx?.cals??[]).filter(t=>t.type==="maintenance"&&t.my_role&&t.my_role!=="view")}roomCals(){return(this.ctx?.cals??[]).filter(t=>t.type==="room")}span(){if(!this.date||!this.from||!this.to)return null;const t=new Date(`${this.date}T${this.from}:00`);let e=new Date(`${this.date}T${this.to}:00`);return e<=t&&(e=B(e,1)),Number.isNaN(t.getTime())?null:{start:t.toISOString(),end:e.toISOString()}}schedule(){clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.runPreview(),250)}async runPreview(){const t=this.span();if(!this.ctx||!t||!this.rooms.length||!this.calId){this.preview=null;return}try{this.preview=await this.ctx.api.maintPreview({calendar_id:this.calId,rooms:this.rooms,...t}),this.err=""}catch(e){this.preview=null,this.err=_(e)}}close(){this.dispatchEvent(new CustomEvent("close"))}async save(){const t=this.span();if(!this.ctx||!t)return;if(!this.evTitle.trim()){this.err="צריך כותרת לחלון.";return}const e=this.preview?.mode,s=this.preview?.overlaps.length??0;this.busy=!0,this.err="";try{const a=await this.ctx.api.maintPlace({calendar_id:this.calId,title:this.evTitle.trim(),rooms:this.rooms,...t,notes:this.devices.trim()||void 0,overlap_decision:e==="ask"&&s?this.decision:void 0}),i=a.displaced.length;A(this,z.toast,a.event.state==="pending"?"החלון נשמר כממתין להחלטת מנהלי החדרים":i?`החלון הוצב; ${i} הזמנות נדחקו והמארגנים קיבלו הודעה`:"חלון התחזוקה הוצב"),A(this,z.changed),this.close()}catch(a){a instanceof dt&&a.code==="maintenance_overlap"?this.err="אי אפשר להציב את החלון מעל הזמנה. בחרו אחד מהזמנים הפנויים.":a instanceof dt&&a.code==="overlap_decision_required"?this.err="יש חפיפה עם הזמנות קיימות. יש לבחור מה לעשות.":this.err=_(a),this.runPreview()}finally{this.busy=!1}}useAlt(t){const e=new Date(t.start);this.date=X(e),this.from=w(e),this.to=w(t.end),this.schedule()}render(){const t=this.maintCals(),e=this.roomCals(),s=this.preview,a=s?.overlaps??[],i=s?.mode??"first_holds",o=!!a.length&&(i==="block"||i==="ask"&&this.decision==="block"),r=this.ctx?.now??new Date,l=this.span(),p=l?Z(new Date(l.start),r)?"היום":pt(new Date(l.start)):"",u=o?"אי אפשר לשמור":a.length&&i==="first_holds"?"שמירה כממתין להחלטה":"הצבת החלון",v=a.slice(0,this.ctx?.device==="phone"?2:3),m=h=>this.ctx?.cals.find(x=>x.id===h)?.name??"";return n`<div class="scrim" @click=${()=>this.close()}></div>
      <aside role="dialog" aria-modal="true" aria-label="חלון תחזוקה חדש" data-maint-drawer data-mode=${i}>
        <header><div class="grow"><h2>חלון תחזוקה חדש</h2><div class="muted num">${this.rooms.length} ${this.rooms.length===1?"חדר":"חדרים"}${p?` · ${p}`:""}</div></div>
          <button type="button" class="btn icon" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
        <div class="body">
          ${t.length?c:n`<div class="note warn" data-no-maint-cal><div><b>אין יומן אחזקה שאפשר להציב בו</b><span class="muted">מנהל המערכת יוצר יומן מסוג אחזקה במסך ניהול יומנים.</span></div></div>`}
          <div class="fld"><label for="mc">יומן</label><select id="mc" class="inp" .value=${this.calId} @change=${h=>{this.calId=h.target.value,this.schedule()}}>
            ${t.map(h=>n`<option value=${h.id} ?selected=${h.id===this.calId}>${h.name}</option>`)}</select></div>
          <div class="fld"><label for="mt">כותרת</label><input id="mt" class="inp" maxlength="120" placeholder="למשל: החלפת גוף תאורה ובדיקת גלאים" .value=${this.evTitle}
            @input=${h=>this.evTitle=h.target.value} data-maint-title></div>
          <div class="fld"><span class="lbl">מתי</span><div class="ctls">
            <input class="inp num" type="date" lang=${_t()} aria-label="תאריך" .value=${this.date} @change=${h=>{this.date=h.target.value,this.schedule()}}>
            <input class="inp num" type="time" lang=${_t()} step="900" aria-label="משעה" .value=${this.from} @change=${h=>{this.from=h.target.value,this.schedule()}} data-maint-from>
            <input class="inp num" type="time" lang=${_t()} step="900" aria-label="עד שעה" .value=${this.to} @change=${h=>{this.to=h.target.value,this.schedule()}} data-maint-to></div></div>
          <div class="fld"><span class="lbl">חדרים</span><div class="rooms" role="group" aria-label="חדרים">${e.slice(0,this.ctx?.device==="phone"?6:10).map(h=>{const x=this.rooms.includes(h.id);return n`<button type="button" class="room" aria-pressed=${String(x)} data-room=${h.id} title=${h.name}
              @click=${()=>{this.rooms=x?this.rooms.filter(b=>b!==h.id):[...this.rooms,h.id],this.schedule()}}><span class="dot" style=${`--h:${q(h.color)}`}></span><span class="ell">${h.name}</span></button>`})}</div></div>
          <div class="fld"><label for="md">מכשירים</label><input id="md" class="inp" maxlength="200" placeholder='למשל: תאורה ו-2 גלאי עשן · "צפויה חריגה"' .value=${this.devices}
            @input=${h=>this.devices=h.target.value}></div>
          ${a.length?n`<div class=${`ovl ${i==="block"?"bad":""}`} data-overlaps>
            <b><sw-icon name="warning" size="16"></sw-icon>החלון חופף ל-<span class="num">${a.length}</span> ${a.length===1?"הזמנה":"הזמנות"}</b>
            ${v.map(h=>n`<div class="orow" data-overlap=${h.event_id}><div class="grow"><div class="t ell" title=${h.title??"תפוס"}>${h.title??"תפוס"}</div>
              <div class="s ell">${m(h.calendar_id)}${h.organizer?.name?` · ${h.organizer.name}`:""}</div></div>
              <b class="num ltr">${w(h.start)}–${w(h.end)}</b><span class=${`chip ${h.state==="confirmed"?"ok":"dash"}`}>${h.state==="confirmed"?"מאושר":Ce[h.state]}</span></div>`)}
            ${a.length>v.length?n`<span class="more num">ועוד ${a.length-v.length}</span>`:c}</div>
            <div class="modeline"><sw-icon name="info" size="14"></sw-icon>לפי ההגדרה: <b>${Je[i]}</b></div>
            ${i==="ask"?n`<div role="radiogroup" aria-label="מה יקרה להזמנות" style="display:flex;flex-direction:column;gap:6px">
                <button type="button" class="opt" role="radio" aria-checked=${String(this.decision==="override_notify")} data-decision="override_notify" @click=${()=>this.decision="override_notify"}><span class="rad"></span><span><b>התחזוקה גוברת</b><small>ההזמנות נדחקות והמארגנים מקבלים הודעה</small></span></button>
                <button type="button" class="opt" role="radio" aria-checked=${String(this.decision==="block")} data-decision="block" @click=${()=>this.decision="block"}><span class="rad"></span><span><b>לא להציב</b><small>לחזור ולבחור זמן אחר</small></span></button></div>`:n`<div class="muted" data-mode-text>${oa[i]}</div>`}
            ${o&&s?.alternatives.length?n`<div class="sugg" data-alternatives>${s.alternatives.slice(0,3).map(h=>n`<button type="button" class="btn sm" @click=${()=>this.useAlt(h)}>
              ${Z(new Date(h.start),r)?"":`${pt(new Date(h.start))} `}<span class="num ltr">${w(h.start)}–${w(h.end)}</span></button>`)}</div>`:c}`:s?n`<div class="note" data-no-overlap><sw-icon name="check" size="16"></sw-icon><div><b>אין חפיפה עם הזמנות</b><span class="muted">החלון יוצב מיד.</span></div></div>`:c}
          ${this.err?n`<div class="err" role="alert" data-maint-error>${this.err}</div>`:c}
        </div>
        <footer>
          <button type="button" class="btn pri" ?disabled=${o||this.busy||!t.length||!this.rooms.length} data-maint-save @click=${()=>void this.save()}><sw-icon name="wrench" size="16"></sw-icon>${u}</button>
          <button type="button" class="btn" @click=${()=>this.close()}>ביטול</button>
        </footer>
      </aside>`}};J.styles=[nt,tt`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .scrim { position: absolute; inset: 0; background: var(--sw-overlay); }
    aside { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: min(500px, 100vw); background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; animation: in var(--sw-spring-drawer-ms) var(--sw-ease-drawer); }
    @keyframes in { from { transform: translateX(24px); opacity: 0; } }
    header { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 10px; }
    header h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .body { flex: 1; min-block-size: 0; overflow: hidden; padding: 6px 22px 12px; display: flex; flex-direction: column; gap: 12px; }
    footer { display: flex; gap: 10px; padding: 14px 22px calc(14px + env(safe-area-inset-bottom)); border-block-start: 1px solid var(--sw-border); }
    .ctls { display: flex; gap: 8px; min-inline-size: 0; }
    .ctls > .inp { inline-size: auto; flex: 1 1 0; padding-inline: 10px; }
    .ctls > .inp[type='date'] { flex-grow: 1.5; }
    .rooms { display: flex; flex-wrap: wrap; gap: 6px; }
    .room { font: inherit; font-size: var(--sw-fs-sm); display: inline-flex; align-items: center; gap: 6px; min-block-size: 32px; padding: 0 12px; border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-text-2); cursor: pointer; max-inline-size: 100%; }
    .room[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-heading); border-color: transparent; font-weight: var(--sw-fw-semibold); }
    .room span.ell { max-inline-size: 180px; }
    .ovl { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-warning-soft); }
    .ovl.bad { background: var(--sw-danger-soft); }
    .ovl > b { display: flex; gap: 8px; align-items: center; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .orow { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-solid); min-inline-size: 0; }
    .orow .t { font-weight: var(--sw-fw-bold); color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .orow .s { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .modeline { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: flex; gap: 6px; align-items: center; }
    .modeline b { color: var(--sw-heading); }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt .rad { inline-size: 18px; block-size: 18px; border-radius: 50%; border: 2px solid var(--sw-border-strong); flex: none; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border: 5px solid var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .sugg { display: flex; gap: 8px; flex-wrap: wrap; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .more { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    @media (max-width: 699px) {
      aside { inset: auto 0 0 0; inline-size: 100%; max-block-size: 94dvh; border-start-start-radius: var(--sw-r-2xl); border-start-end-radius: var(--sw-r-2xl); }
      header { padding: 14px 16px 6px; } .body { padding: 4px 16px 8px; gap: 10px; } footer { padding-inline: 16px; }
      .fld { grid-template-columns: minmax(0, 1fr); }
      @keyframes in { from { transform: translateY(24px); opacity: 0; } }
    }
    @media (prefers-reduced-motion: reduce) { aside { animation: none; } }
  `];rt([y({attribute:!1})],J.prototype,"ctx",2);rt([y({attribute:!1})],J.prototype,"detail",2);rt([d()],J.prototype,"calId",2);rt([d()],J.prototype,"evTitle",2);rt([d()],J.prototype,"date",2);rt([d()],J.prototype,"from",2);rt([d()],J.prototype,"to",2);rt([d()],J.prototype,"rooms",2);rt([d()],J.prototype,"devices",2);rt([d()],J.prototype,"preview",2);rt([d()],J.prototype,"decision",2);rt([d()],J.prototype,"busy",2);rt([d()],J.prototype,"err",2);J=rt([it("cal-maint-drawer")],J);var ra=Object.defineProperty,la=Object.getOwnPropertyDescriptor,R=(t,e,s,a)=>{for(var i=a>1?void 0:a?la(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&ra(e,s,i),i};const ca={room:"door",team:"users",maintenance:"wrench",event:"calendar"},ae={user:"משתמש",role:"תפקיד",department:"מחלקה",everyone:"כולם"},da={none:"",always:"acc",outside_hours:"acc",on_behalf:"acc"},ie=300,pa=Ne.filter(t=>t!=="slate"),Ee=["first_holds","override_notify","block","ask"];let P=class extends at{constructor(){super(...arguments),this.ctx=null,this.shrink=!1,this.typ="",this.page=1,this.menuFor="",this.confirmArchive=null,this.members=null,this.memErr="",this.rev=0,this.side=!1,this.adding=!1,this.addKind="user",this.addId="",this.addRole="book",this.people=[],this.roles=[],this.draft=null,this.editing=null,this.formErr="",this.busy=!1,this.instOverlap="first_holds",this.listH=0,this.rowH=0,this.loadedFor="",this.ro=null,this.onDoc=t=>{this.menuFor&&!t.composedPath().some(e=>e.classList?.contains("menuwrap"))&&(this.menuFor="")}}connectedCallback(){super.connectedCallback(),document.addEventListener("pointerdown",this.onDoc,!0),this.ctx?.api.settings().then(t=>this.instOverlap=t.settings.maintenance_overlap).catch(()=>{})}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("pointerdown",this.onDoc,!0),this.ro?.disconnect()}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this)}updated(){this.measure()}measure(){const t=this.renderRoot.querySelector(".list, .tablewrap");t&&Math.abs(t.clientHeight-this.listH)>4&&(this.listH=t.clientHeight);const e=t?.querySelector(".row, tbody tr"),s=e?e.offsetHeight+6:0;s&&Math.abs(s-this.rowH)>2&&(this.rowH=s)}willUpdate(t){if(!t.has("ctx")||!this.ctx)return;this.shrink=this.ctx.device==="tablet"&&this.ctx.access.ui.tablet_panels==="shrink";const e=this.ctx.sub;e==="new"&&!this.draft&&(this.draft=this.blank(),this.loadPeople()),e!=="new"&&!this.editing&&(this.draft=null),e&&e!=="new"&&e!==this.loadedFor&&(this.loadedFor=e,this.page=1,this.loadMembers(e)),e||(this.loadedFor="")}href(t){const e=Nt()?"":window.location.hash.split("?")[1]??"";return`${this.ctx?.base??"#/calendars"}/manage${t}${e?`?${e}`:""}`}canManageAll(){return!!this.ctx?.access.can.manage}render(){if(!this.ctx)return c;const t=this.ctx.sub;return t==="new"||this.editing?this.formScreen():t?this.membersScreen(t):this.listScreen()}perPage(t,e){return this.listH?Vt(this.listH+6,this.rowH||t):e}listScreen(){const t=this.ctx,e=t.q.trim(),s=t.cals.filter(l=>(!t.floor||!l.floor_id||l.floor_id===t.floor)&&(!e||l.name.includes(e)));if(!t.cals.length)return n`<section class="panel main"><div class="center" data-cal-state="empty"><sw-state-panel icon="calendar" state="empty" heading="אין יומנים עדיין"
        hint="יומן לכל חדר, לצוות האחזקה, לצוותים ולאירועים. כל יומן עם מנהל, סוג ואזור זמן." actionLabel=${this.canManageAll()?"יומן חדש":""}
        @action=${()=>location.hash=this.href("/new")}></sw-state-panel></div></section>`;const a=this.typ?s.filter(l=>l.type===this.typ):s,i=t.device==="phone",o=wt(a,this.page,this.perPage(i?72:62,i?5:9)),r=ue.map(l=>[l,s.filter(p=>p.type===l).length]);return n`<section class="panel main" data-manage-list>
      <div class="ph">
        <div class="seg" role="group" aria-label="סוג יומן">
          <button type="button" aria-pressed=${String(!this.typ)} data-type="" @click=${()=>{this.typ="",this.page=1}}>הכל <span class="num">${s.length}</span></button>
          ${r.filter(([,l])=>l||!i).map(([l,p])=>n`<button type="button" aria-pressed=${String(this.typ===l)} data-type=${l} @click=${()=>{this.typ=l,this.page=1}}>${i?Dt[l]:Dt[l]} <span class="num">${p}</span></button>`)}
        </div>
        <span class="sp"></span>
        ${t.device==="desktop"?n`<span class="hint">ההרשאות נקבעות לכל יומן בנפרד</span>`:c}
        ${this.canManageAll()?n`<a class="btn sm" href=${this.href("/new")} data-new-calendar><sw-icon name="plus" size="14"></sw-icon>יומן חדש</a>`:c}
      </div>
      ${a.length?n`<div class="list">${o.items.map((l,p)=>this.calRow(l,p>=o.items.length-2))}</div>`:n`<div class="center"><span class="muted">אין יומנים מהסוג הזה</span></div>`}
      ${this.pager(o.page,o.pages)}
    </section>
    ${this.confirmArchive?this.archiveDialog(this.confirmArchive):c}`}syncChip(t){if(!t.sync)return n`<span class="chip" data-sync="none">ללא סנכרון</span>`;const e=ts[t.sync.provider]??t.sync.provider;return t.sync.state==="ok"?n`<span class="chip ok" data-sync="ok">${e} · מסונכרן</span>`:t.sync.state==="needs_reauth"?n`<span class="chip warn" data-sync="reauth">${e} · נדרשת הרשאה</span>`:t.sync.state==="paused"?n`<span class="chip" data-sync="paused">${e} · מושהה</span>`:n`<span class="chip bad" data-sync="error">${e} · תקלה</span>`}calRow(t,e){const a=this.ctx.device,i=t.owner?.name?n`${t.owner.name}`:n`<span class="missing">חסר מנהל</span>`,o=[t.floor_name,t.capacity?`${t.capacity.toLocaleString("he-IL")} מקומות`:"",t.equipment.length?`${t.equipment.length} פריטי ציוד`:""].filter(Boolean).join(" · "),r=t.pending_count?n`<span class="chip dash num">${t.pending_count>999?"999+":t.pending_count.toLocaleString("he-IL")} ממתינות</span>`:c,l=()=>location.hash=this.href(`/${encodeURIComponent(t.id)}`);return a==="phone"?n`<div class="row" data-cal-row=${t.id} @click=${l}><span class="sq" style=${`--h:${q(t.color)}`}></span>
        <div class="grow"><div class="name ell" title=${t.name}>${t.name}</div><div class="sub ell">${Dt[t.type]} · ${i}</div></div>${r}</div>`:n`<div class="row" data-cal-row=${t.id}>
      <span class="sq" style=${`--h:${q(t.color)}`}></span>
      <div class="cname" @click=${l}><div class="name ell" title=${t.name}>${t.name}</div>
        <div class="sub ell">${a==="tablet"?n`${Dt[t.type]} · מנהל: ${i} · ${Lt[t.approval_mode]}`:o||" "}</div></div>
      ${a==="desktop"?n`<span class="type"><sw-icon name=${ca[t.type]} size="14"></sw-icon>${Dt[t.type]}</span>
        <div class="mgr ell" title=${t.owner?.name??""}><span class="sub">מנהל: </span><b>${i}</b></div>
        <span class=${`chip ${da[t.approval_mode]}`}>${Lt[t.approval_mode]}</span>`:c}
      <span class="sp"></span>
      ${r}${this.syncChip(t)}
      ${a==="desktop"?n`<span class="myrole ell">${t.my_role?yt[t.my_role]:"—"}</span>`:c}
      <div class="menuwrap"><button type="button" class="btn icon sm" aria-label="פעולות" aria-haspopup="menu" aria-expanded=${String(this.menuFor===t.id)} data-cal-menu=${t.id}
        @click=${()=>this.menuFor=this.menuFor===t.id?"":t.id}><sw-icon name="more" size="16"></sw-icon></button>
        ${this.menuFor===t.id?n`<div class=${`menu ${e?"up":""}`} role="menu">
          <button type="button" role="menuitem" @click=${l}><sw-icon name="users" size="14"></sw-icon>חברים ותפקידים</button>
          ${t.my_role==="manage"?n`<button type="button" role="menuitem" data-edit-rules @click=${()=>{this.menuFor="",this.openEdit(t)}}><sw-icon name="edit" size="14"></sw-icon>כללי היומן</button>`:c}
          ${this.canManageAll()?n`<button type="button" role="menuitem" class="bad" data-archive=${t.id} @click=${()=>{this.menuFor="",this.confirmArchive=t,this.formErr=""}}><sw-icon name="trash" size="14"></sw-icon>העברה לארכיון</button>`:c}
        </div>`:c}</div>
    </div>`}pager(t,e){return n`<div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${t<=1} @click=${()=>this.page=t-1}><sw-icon name="chevron" size="14"></sw-icon></button>
      <span class="num" data-page>${t} / ${e}</span>
      <button type="button" class="btn" aria-label="הבא" ?disabled=${t>=e} @click=${()=>this.page=t+1}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`}archiveDialog(t){return n`<div class="scrim" @click=${()=>this.confirmArchive=null}></div>
      <aside class="panel overlay" style="inset-block:auto 12px" role="dialog" aria-label="העברה לארכיון" data-archive-dialog>
        <div class="ph"><h2 class="ell">להעביר את "${t.name}" לארכיון?</h2></div>
        <div class="muted">היומן יוסתר מכל המסכים. ההזמנות שכבר היו נשמרות; אפשר להחזיר אותו מהארכיון.</div>
        ${this.formErr?n`<div class="err" role="alert">${this.formErr}</div>`:c}
        <div class="formfoot"><button type="button" class="btn bad fill" ?disabled=${this.busy} data-archive-confirm @click=${()=>void this.archive(t)}>העברה לארכיון</button>
          <button type="button" class="btn" @click=${()=>this.confirmArchive=null}>ביטול</button></div>
      </aside>`}async archive(t){if(this.ctx){this.busy=!0;try{await this.ctx.api.archiveCalendar(t.id,t.revision),this.confirmArchive=null,A(this,z.toast,`"${t.name}" הועבר לארכיון`),A(this,z.changed)}catch(e){this.formErr=e instanceof dt&&e.status===409?"ביומן יש הזמנות עתידיות מאושרות. צריך לבטל או להעביר אותן לפני ההעברה לארכיון.":_(e)}finally{this.busy=!1}}}async loadMembers(t){if(this.ctx){this.members=null,this.memErr="",this.rev=this.ctx.cals.find(e=>e.id===t)?.revision??0;try{this.members=(await this.ctx.api.members(t)).members}catch(e){this.memErr=e instanceof dt&&e.status===403?"רק מנהל היומן רואה ומשנה את החברים.":_(e)}this.loadPeople()}}async loadPeople(){if(!this.people.length){if(!Nt()){const t=[...new Set((this.ctx?.cals??[]).map(e=>e.owner?.name).filter(Boolean))];this.people=t.map((e,s)=>({id:`demo-${s}`,name:e})),this.roles=[{id:"operator",name:"מפעיל"},{id:"viewer",name:"צופה"},{id:"site_admin",name:"מנהל אתר"}];return}try{const[t,e]=await Promise.all([ns(),os()]);this.people=t.users.filter(s=>s.active).map(s=>({id:s.id,name:s.name||s.username})),this.roles=e.roles.map(s=>({id:s.id,name:e.labels[s.id]??s.name}))}catch{}}}async saveMembers(t,e){if(!this.ctx)return;const s=this.ctx.sub,a=this.members;this.members=t,this.memErr="";try{this.members=(await this.ctx.api.putMembers(s,this.rev,t)).members,this.rev+=1,A(this,z.toast,e)}catch(i){this.members=a,this.memErr=i instanceof dt&&i.code==="stale"?"היומן עודכן בינתיים. הרשימה רועננה; נסו שוב.":_(i),i instanceof dt&&i.code==="stale"&&this.loadMembers(s)}}rules(t){const e=[Lt[t.approval_mode],`חפיפה: ${t.overlap_override?jt[t.overlap_override]:"לפי ההתקנה"}`,t.visibility==="members"?'גלוי לחברים; לאחרים "תפוס"':t.visibility==="busy_to_all"?'לכולם "תפוס"':"גלוי לכולם"];return t.buffer_after_min&&e.push(`${t.buffer_after_min} דק׳ הפסקה אחרי`),t.horizon_days&&e.push(`עד ${t.horizon_days} יום קדימה`),t.min_minutes&&t.max_minutes&&e.push(`${t.min_minutes} דק׳ עד ${t.max_minutes>=60?`${Math.round(t.max_minutes/60)} שע׳`:`${t.max_minutes} דק׳`}`),e}sidePanel(t){const e=this.members?.length??0;return n`<aside class=${`panel ${t?"overlay":""}`} aria-label="מה כל תפקיד מאפשר" data-roles-card>
      <div class="ph"><h2 style="font-size:var(--sw-fs-lg)">מה כל תפקיד מאפשר</h2>${t?n`<span class="sp"></span><button type="button" class="btn icon sm" aria-label="סגירה" @click=${()=>this.side=!1}><sw-icon name="close" size="14"></sw-icon></button>`:c}</div>
      <div class="rights">${Gt.map(s=>n`<div class="rt"><b>${yt[s]}</b><span>${es[s]}</span></div>`)}</div>
      <div class="note"><sw-icon name="info" size="16"></sw-icon><div><b>התפקיד ביומן לא עוקף את המערכת</b><span class="muted">הזמנה בשם חוג או לקוח, חלונות תחזוקה ופרטי אורחים דורשים גם הרשאה במערכת.</span></div></div>
      <span class="sp"></span><div class="muted num">${e.toLocaleString("he-IL")} מתוך ${ie} שורות חברות ביומן</div>
    </aside>`}membersScreen(t){const e=this.ctx,s=e.cals.find(m=>m.id===t);if(!s)return n`<section class="panel main"><div class="center"><sw-state-panel icon="calendar" state="empty" heading="היומן לא נמצא" hint="ייתכן שהועבר לארכיון או שאין לך גישה אליו."
        actionLabel="לכל היומנים" @action=${()=>location.hash=this.href("")}></sw-state-panel></div></section>`;const a=e.device==="phone",i=s.my_role==="manage",o=e.device==="desktop"||this.shrink?"inline":"overlay",r=this.rules(s),l=a?r.slice(0,2):r,p=this.members??[],u=this.listH?Vt(this.listH-(a?0:46),Math.max(a?62:54,this.rowH)):a?4:6,v=wt(p,this.page,u);return n`<section class="panel main" data-members=${s.id}>
      <div class="calhead">
        <a class="btn icon sm" href=${this.href("")} aria-label="לכל היומנים" data-back><sw-icon name="chevronBack" size="16"></sw-icon></a>
        <span class="sq" style=${`--h:${q(s.color)}`}></span>
        <div class="grow"><h2 class="ell" title=${s.name}>${s.name}</h2>
          <div class="sub ell muted">${[Dt[s.type],s.floor_name,s.capacity?`${s.capacity.toLocaleString("he-IL")} מקומות`:"",`מנהל: ${s.owner?.name||"—"}`].filter(Boolean).join(" · ")}</div></div>
        ${i&&!a?n`<button type="button" class="btn sm" data-edit-rules @click=${()=>this.openEdit(s)}><sw-icon name="edit" size="14"></sw-icon>כללי היומן</button>`:c}
        ${i?n`<button type="button" class="btn sm pri" data-add-member @click=${()=>{this.adding=!this.adding,this.addId=""}}><sw-icon name="plus" size="14"></sw-icon>${a?"הוספה":"הוספת חבר"}</button>`:c}
        ${o==="overlay"&&!a?n`<button type="button" class="btn icon sm" aria-label="מה כל תפקיד מאפשר" data-roles-open @click=${()=>this.side=!0}><sw-icon name="help" size="16"></sw-icon></button>`:c}
      </div>
      <div class="rulechips">${l.map((m,h)=>n`<span class=${`chip ${h===0&&s.approval_mode!=="none"?"acc":""}`}>${m}</span>`)}${r.length>l.length?n`<span class="chip num">+${r.length-l.length}</span>`:c}</div>
      <div class="ph"><h2 style="font-size:var(--sw-fs-lg)">חברים ותפקידים</h2><span class="sp"></span>${a?c:n`<span class="hint">${i?"שינוי תפקיד נשמר מיד ונרשם ביומן הפעולות":"רק מנהל היומן משנה תפקידים"}</span>`}</div>
      ${this.adding&&i?this.addRow(s):c}
      ${this.memErr?n`<div class="note bad" role="alert" data-members-error>${this.memErr}</div>`:c}
      ${!this.members&&!this.memErr?n`<div class="tablewrap" style="flex:1">${Array.from({length:4},()=>n`<div class="skel" style="block-size:44px;margin-block-end:6px"></div>`)}</div>`:n`<div class="tablewrap" style="flex:1;min-block-size:0;overflow:hidden">${a?n`<div class="list">${v.items.map(m=>this.memberCard(s,m))}</div>`:this.memberTable(s,v.items,i)}</div>`}
      ${this.pager(v.page,v.pages)}
    </section>
    ${a?c:o==="inline"?this.sidePanel(!1):this.side?n`<div class="scrim" @click=${()=>this.side=!1}></div>${this.sidePanel(!0)}`:c}`}isOwner(t,e){return e.subject_kind==="user"&&e.subject_id===t.owner?.id}memberTable(t,e,s){const a=this.ctx?.device==="tablet";return n`<table class="t"><colgroup><col style="inline-size:${a?84:110}px"><col><col style="inline-size:${a?330:380}px"><col style="inline-size:56px"></colgroup>
      <thead><tr><th>סוג</th><th>מי</th><th>תפקיד ביומן</th><th><span class="vh">הסרה</span></th></tr></thead>
      <tbody>${e.map(i=>{const o=this.isOwner(t,i);return n`<tr data-member=${`${i.subject_kind}:${i.subject_id}`}>
          <td>${ae[i.subject_kind]}</td>
          <td><div style="display:flex;gap:6px;align-items:center;min-inline-size:0"><span class="who ell" title=${i.label}>${i.label||i.subject_id}</span>
            ${o?n`<span class="chip">מנהל אחראי</span>`:i.subject_kind==="everyone"?n`<span class="chip">רואים רק "תפוס"</span>`:c}</div></td>
          <td><span class="rolepick" role="group" aria-label=${`תפקיד של ${i.label}`}>${Gt.map(r=>n`<button type="button" aria-pressed=${String(i.cal_role===r)} data-role=${r}
            ?disabled=${!s||o} @click=${()=>this.setRole(i,r)}>${yt[r]}</button>`)}</span></td>
          <td>${o||!s?c:n`<button type="button" class="btn icon sm" aria-label=${`הסרת ${i.label}`} data-remove @click=${()=>this.removeMember(i)}><sw-icon name="close" size="14"></sw-icon></button>`}</td>
        </tr>`})}</tbody></table>`}memberCard(t,e){const s=this.isOwner(t,e);return n`<div class="row" data-member=${`${e.subject_kind}:${e.subject_id}`}><div class="grow"><div class="name ell">${e.label||e.subject_id}</div>
      <div class="sub">${ae[e.subject_kind]}${s?" · מנהל אחראי":""}</div></div>
      ${t.my_role==="manage"&&!s?n`<select class="inp" style="inline-size:auto;min-block-size:36px" aria-label="תפקיד" @change=${a=>this.setRole(e,a.target.value)}>
        ${Gt.map(a=>n`<option value=${a} ?selected=${e.cal_role===a}>${yt[a]}</option>`)}</select>`:n`<span class=${`chip ${e.cal_role==="manage"?"acc":""}`}>${yt[e.cal_role]}</span>`}</div>`}setRole(t,e){t.cal_role===e||!this.members||this.saveMembers(this.members.map(s=>s===t?{...s,cal_role:e}:s),`${t.label}: ${yt[e]}`)}removeMember(t){this.members&&this.saveMembers(this.members.filter(e=>e!==t),`${t.label} הוסר מהיומן`)}addRow(t){const e=this.addKind==="user"?this.people:this.addKind==="role"?this.roles:[],s=new Set((this.members??[]).map(i=>`${i.subject_kind}:${i.subject_id}`)),a=(this.members?.length??0)>=ie;return n`<div class="addrow" data-add-row>
      <select class="inp k" aria-label="סוג" @change=${i=>{this.addKind=i.target.value,this.addId=""}}>
        ${["user","role","department","everyone"].map(i=>n`<option value=${i} ?selected=${i===this.addKind}>${ae[i]}</option>`)}</select>
      ${this.addKind==="everyone"?n`<span class="grow muted">כל מי שיש לו צפייה ביומנים</span>`:e.length?n`<select class="inp" aria-label="מי" @change=${i=>this.addId=i.target.value} data-add-who>
            <option value="" ?selected=${!this.addId}>בחירה…</option>${e.filter(i=>!s.has(`${this.addKind}:${i.id}`)&&i.id!==t.owner?.id).map(i=>n`<option value=${i.id}>${i.name}</option>`)}</select>`:n`<input class="inp" aria-label="מזהה" placeholder=${this.addKind==="department"?"מזהה המחלקה":"מזהה"} .value=${this.addId} @input=${i=>this.addId=i.target.value.trim()} data-add-who>`}
      <select class="inp k" aria-label="תפקיד" @change=${i=>this.addRole=i.target.value}>
        ${Gt.map(i=>n`<option value=${i} ?selected=${i===this.addRole}>${yt[i]}</option>`)}</select>
      <button type="button" class="btn sm pri" ?disabled=${a||this.addKind!=="everyone"&&!this.addId||s.has(`${this.addKind}:${this.addKind==="everyone"?"*":this.addId}`)} data-add-confirm
        @click=${()=>this.add(e)}>הוספה</button>
      ${a?n`<span class="err">הגעת ל-${ie} שורות. אפשר לצרף תפקיד או מחלקה במקום אנשים בודדים.</span>`:c}
    </div>`}add(t){const e=this.addKind==="everyone"?"*":this.addId,s=this.addKind==="everyone"?"כל מי שיש לו צפייה ביומנים":t.find(a=>a.id===e)?.name??e;this.adding=!1,this.saveMembers([...this.members??[],{subject_kind:this.addKind,subject_id:e,label:s,cal_role:this.addRole}],`${s} נוסף/ה כ${yt[this.addRole]}`)}blank(){return{name:"",type:"room",color:"blue",capacity:"",approval:"none",override:"",owner:"",buffer:"",horizon:"",approvedMove:"reapproval"}}openEdit(t){this.editing=t,this.formErr="",this.draft={name:t.name,type:t.type,color:t.color,capacity:t.capacity?String(t.capacity):"",approval:t.approval_mode,override:t.overlap_override??"",owner:t.owner?.id??"",buffer:t.buffer_after_min!==void 0?String(t.buffer_after_min):"",horizon:t.horizon_days!==void 0?String(t.horizon_days):"",approvedMove:t.approved_move??"reapproval"},this.loadPeople()}allowedOverrides(){const t=this.ctx?.access.ui.override_scope??"both";return t==="none"?[]:t==="stricter"?Ee.filter(e=>fe[e]>=fe[this.instOverlap]):Ee}formScreen(){const t=this.draft??this.blank(),e=this.editing,s=r=>this.draft={...t,...r},a=this.allowedOverrides(),i=this.ctx?.access.ui.override_scope??"both",o=t.type==="room";return n`<section class="panel main" data-cal-form=${e?"edit":"new"}>
      <div class="ph"><a class="btn icon sm" href=${this.href(e?`/${encodeURIComponent(e.id)}`:"")} aria-label="חזרה" @click=${()=>{this.editing=null,this.draft=null}}><sw-icon name="chevronBack" size="16"></sw-icon></a>
        <h2>${e?`כללי היומן · ${e.name}`:"יומן חדש"}</h2></div>
      <div class="form">
        <div class="fld"><label for="cn">שם</label><input id="cn" class="inp" maxlength="80" .value=${t.name} @input=${r=>s({name:r.target.value})} data-f-name></div>
        <div class="fld"><span class="lbl">סוג</span><div class="seg" role="group" aria-label="סוג">${ue.map(r=>n`<button type="button" aria-pressed=${String(t.type===r)} ?disabled=${!!e&&t.type!==r}
          data-f-type=${r} @click=${()=>s({type:r})}>${Dt[r]}</button>`)}</div></div>
        <div class="fld"><span class="lbl">צבע</span><div class="hues" role="group" aria-label="צבע">${pa.map(r=>n`<button type="button" class="hue" style=${`--h:${q(r)}`} aria-pressed=${String(t.color===r)}
          aria-label=${r} data-f-color=${r} @click=${()=>s({color:r})}></button>`)}</div></div>
        <div class="fld"><label for="co">מנהל</label><select id="co" class="inp" @change=${r=>s({owner:r.target.value})}>
          <option value="" ?selected=${!t.owner}>${e?e.owner?.name||"ללא שינוי":"אני"}</option>${this.people.filter(r=>!e||r.id!==e.owner?.id).map(r=>n`<option value=${r.id} ?selected=${t.owner===r.id}>${r.name}</option>`)}</select></div>
        ${o?n`<div class="fld"><label for="cc">מקומות</label><input id="cc" class="inp num" type="number" min="1" max="2000" inputmode="numeric" .value=${t.capacity}
          @input=${r=>s({capacity:r.target.value})}></div>`:c}
        <div class="fld"><label for="ca">אישור</label><select id="ca" class="inp" @change=${r=>s({approval:r.target.value})} data-f-approval>
          ${Object.keys(Lt).map(r=>n`<option value=${r} ?selected=${t.approval===r}>${Lt[r]}</option>`)}</select></div>
        ${t.approval!=="none"?n`<div class="fld"><span class="lbl">הזזת הזמנה מאושרת</span><div class="seg" role="group" aria-label="הזזת הזמנה מאושרת" data-f-approved-move>
          ${Object.keys(be).map(r=>n`<button type="button" aria-pressed=${String(t.approvedMove===r)} data-f-approved-move-opt=${r} @click=${()=>s({approvedMove:r})}>${be[r]}</button>`)}</div></div>`:c}
        ${o?n`<div class="fld"><label for="cv">חפיפת תחזוקה</label>${a.length?n`<select id="cv" class="inp" @change=${r=>s({override:r.target.value})} data-f-override>
              <option value="" ?selected=${!t.override}>לפי ההתקנה (${jt[this.instOverlap]})</option>
              ${a.map(r=>n`<option value=${r} ?selected=${t.override===r}>${jt[r]}</option>`)}</select>`:n`<span class="muted" data-f-override-off>לפי ההתקנה (${jt[this.instOverlap]}). ההגדרות לא מאפשרות ליומן לקבוע אחרת.</span>`}</div>`:c}
        ${o?n`<div class="fld"><label for="cb">הפסקה אחרי</label><input id="cb" class="inp num" type="number" min="0" max="240" inputmode="numeric" placeholder="דקות" .value=${t.buffer}
          @input=${r=>s({buffer:r.target.value})}></div>`:c}
        <div class="fld"><label for="ch">טווח קדימה</label><input id="ch" class="inp num" type="number" min="1" max="730" inputmode="numeric" placeholder="ימים" .value=${t.horizon}
          @input=${r=>s({horizon:r.target.value})}></div>
      </div>
      ${i==="stricter"&&o?n`<div class="muted">מנהל יומן יכול לבחור רק חפיפה מחמירה מההגדרה הכללית.</div>`:c}
      ${this.formErr?n`<div class="err" role="alert" data-form-error>${this.formErr}</div>`:c}
      <div class="formfoot"><button type="button" class="btn pri" ?disabled=${this.busy||!t.name.trim()} data-f-save @click=${()=>void this.saveForm()}><sw-icon name="check" size="16"></sw-icon>${e?"שמירה":"יצירת היומן"}</button>
        <a class="btn" href=${this.href(e?`/${encodeURIComponent(e.id)}`:"")} @click=${()=>{this.editing=null,this.draft=null}}>ביטול</a></div>
    </section>`}async saveForm(){const t=this.draft;if(!this.ctx||!t)return;const e=i=>i.trim()===""?void 0:Number(i),s=t.type==="room",a={name:t.name.trim(),color:t.color,approval_mode:t.approval,overlap_override:s&&t.override||null,approved_move:t.approvedMove};s&&e(t.capacity)!==void 0&&(a.capacity=e(t.capacity)),s&&e(t.buffer)!==void 0&&(a.buffer_after_min=e(t.buffer)),e(t.horizon)!==void 0&&(a.horizon_days=e(t.horizon)),t.owner&&(a.owner_user_id=t.owner),this.busy=!0,this.formErr="";try{if(this.editing){const i=this.editing;await this.ctx.api.patchCalendar(i.id,{...a,revision:i.revision}),this.editing=null,this.draft=null,A(this,z.toast,"כללי היומן נשמרו"),A(this,z.changed)}else{const{calendar:i}=await this.ctx.api.createCalendar({...a,type:t.type});this.draft=null,A(this,z.toast,`היומן "${i.name}" נוצר`),A(this,z.changed),location.hash=this.href(`/${encodeURIComponent(i.id)}`)}}catch(i){this.formErr=i instanceof dt?i.code==="name_taken"?"כבר קיים יומן בשם הזה.":i.code==="too_many_calendars"?"הגעת למספר היומנים המרבי (הגדרות ‹ יומנים).":i.code==="stale"?"היומן עודכן בינתיים. רעננו ונסו שוב.":i.status===422?`ערך לא תקין: ${_(i)}`:_(i):_(i)}finally{this.busy=!1}}};P.styles=[nt,tt`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
    .list > .row { flex: none; }
    /* ROUND4-LEFTOVERS-2390 (D22): at 1024 x 768 the list showed 7 calendars with most of an eighth row empty under them - 2 px less
       padding a row (58 -> 54 px, still well over a 44 px target) fits the eighth; the phone's rows keep their tap height */
    @media (min-width: 700px) { .list > .row { padding-block: 8px; } }
    .cname { flex: 0 0 300px; min-inline-size: 0; cursor: pointer; }
    @media (hover: hover) and (pointer: fine) { .cname:hover .name { color: var(--sw-accent-text); } }
    .type { flex: 0 0 84px; display: inline-flex; gap: 6px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .mgr { flex: 0 0 180px; min-inline-size: 0; font-size: var(--sw-fs-sm); }
    .mgr b { color: var(--sw-heading); }
    .missing { color: var(--sw-warning-text); }
    .myrole { flex: 0 0 110px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .menuwrap { position: relative; }
    .menu { position: absolute; inset-block-start: calc(100% + 4px); inset-inline-end: 0; z-index: 5; min-inline-size: 190px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-3); padding: 6px; display: flex; flex-direction: column; }
    .menu.up { inset-block-start: auto; inset-block-end: calc(100% + 4px); }
    .menu button { font: inherit; font-size: var(--sw-fs-md); text-align: start; border: 0; background: transparent; color: var(--sw-heading); padding: 9px 12px; border-radius: var(--sw-r-md);
      cursor: pointer; display: flex; gap: 8px; align-items: center; }
    @media (hover: hover) and (pointer: fine) { .menu button:hover { background: var(--sw-hover-wash); } }
    .menu button:active { background: var(--sw-pressed-wash); }
    @media (pointer: coarse) { .menu button { min-block-size: 44px; } }
    .menu button.bad { color: var(--sw-danger-text); }
    .hint { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
    /* members */
    .calhead { display: flex; align-items: center; gap: 12px; min-inline-size: 0; flex-wrap: wrap; }
    .calhead .sq { inline-size: 40px; block-size: 40px; border-radius: var(--sw-r-md); }
    .calhead h2 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rulechips { display: flex; gap: 6px; flex-wrap: wrap; max-block-size: 64px; overflow: hidden; }
    table.t { inline-size: 100%; border-collapse: separate; border-spacing: 0 6px; table-layout: fixed; }
    table.t th { text-align: start; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-heading); padding: 8px 12px; background: var(--sw-surface-3); }
    table.t th:first-child { border-start-start-radius: var(--sw-r-md); border-end-start-radius: var(--sw-r-md); }
    table.t th:last-child { border-start-end-radius: var(--sw-r-md); border-end-end-radius: var(--sw-r-md); }
    table.t td { padding: 8px 12px; background: var(--sw-surface-2); vertical-align: middle; font-size: var(--sw-fs-md); }
    table.t td:first-child { border-start-start-radius: var(--sw-r-lg); border-end-start-radius: var(--sw-r-lg); color: var(--sw-text-2); }
    table.t td:last-child { border-start-end-radius: var(--sw-r-lg); border-end-end-radius: var(--sw-r-lg); text-align: end; }
    table.t td .who { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rolepick { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
    .rolepick button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); padding: 5px 10px; border-radius: var(--sw-r-pill); cursor: pointer; white-space: nowrap; }
    .rolepick button[aria-pressed='true'] { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-heading)); font-weight: var(--sw-fw-bold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .rolepick button[disabled] { cursor: default; }
    aside.panel { inline-size: 360px; flex: none; }
    .rights { display: flex; flex-direction: column; gap: 6px; }
    .rt { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); }
    .rt b { color: var(--sw-heading); }
    .rt span { color: var(--sw-text-2); }
    .addrow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--sw-accent-soft); }
    .addrow .inp { inline-size: auto; flex: 1; min-inline-size: 140px; background: var(--sw-surface-solid); }
    .addrow select.inp.k { flex: 0 0 120px; min-inline-size: 0; }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    aside.overlay { position: fixed; inset-block: 12px; inset-inline-start: 12px; z-index: calc(var(--sw-z-modal) + 1); box-shadow: var(--sw-shadow-3); inline-size: min(380px, calc(100vw - 24px)); }
    :host([shrink]) aside.panel:not(.overlay) { inline-size: 280px; }
    :host([shrink]) .rt { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    /* the calendar form */
    .form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px 24px; align-content: start; }
    .form .fld { grid-template-columns: 110px minmax(0, 1fr); }
    .hues { display: flex; gap: 8px; flex-wrap: wrap; }
    .hue { inline-size: 32px; block-size: 32px; border-radius: 50%; background: var(--h); border: 3px solid transparent; cursor: pointer; box-shadow: inset 0 0 0 2px var(--sw-surface-solid); }
    .hue[aria-pressed='true'] { border-color: var(--sw-heading); }
    .formfoot { display: flex; gap: 8px; margin-block-start: auto; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .center { flex: 1; display: grid; place-items: center; }
    @media (max-width: 1179px) {
      .cname { flex: 1; }
      .form { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 699px) {
      .form .fld { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .calhead h2 { font-size: var(--sw-fs-xl); }
      .addrow .inp, .addrow select.inp.k { flex: 1 1 100%; }
    }
  `];R([y({attribute:!1})],P.prototype,"ctx",2);R([y({type:Boolean,reflect:!0})],P.prototype,"shrink",2);R([d()],P.prototype,"typ",2);R([d()],P.prototype,"page",2);R([d()],P.prototype,"menuFor",2);R([d()],P.prototype,"confirmArchive",2);R([d()],P.prototype,"members",2);R([d()],P.prototype,"memErr",2);R([d()],P.prototype,"rev",2);R([d()],P.prototype,"side",2);R([d()],P.prototype,"adding",2);R([d()],P.prototype,"addKind",2);R([d()],P.prototype,"addId",2);R([d()],P.prototype,"addRole",2);R([d()],P.prototype,"people",2);R([d()],P.prototype,"roles",2);R([d()],P.prototype,"draft",2);R([d()],P.prototype,"editing",2);R([d()],P.prototype,"formErr",2);R([d()],P.prototype,"busy",2);R([d()],P.prototype,"instOverlap",2);R([d()],P.prototype,"listH",2);R([d()],P.prototype,"rowH",2);P=R([it("cal-view-manage")],P);var ha=Object.defineProperty,ua=Object.getOwnPropertyDescriptor,L=(t,e,s,a)=>{for(var i=a>1?void 0:a?ua(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&ha(e,s,i),i};const ne={screen:"מסך",projector:"מקרן",video_call:"שיחת וידאו",whiteboard:"לוח",kitchen:"מטבח",accessible:"נגישות"},va=[[30,"30 דק׳"],[60,"שעה"],[120,"שעתיים"],[180,"3 שעות"]],Oe=new Set(["book","edit","manage"]);let C=class extends at{constructor(){super(...arguments),this.ctx=null,this.tab="book",this.dayIdx=0,this.rooms=null,this.roomId="",this.duration=60,this.start=null,this.headcount=0,this.equip=new Set,this.sheet=null,this.mine=null,this.past=!1,this.error="",this.slow=!1,this.busy=!1,this.actionError="",this.done="",this.evTitle="",this.people=1,this.cancelScope="occurrence",this.alts=null,this.altPick=0,this.page=1,this.per=4,this.tlFrom=8,this.ro=null,this.slowTimer=0,this.drag=!1}connectedCallback(){super.connectedCallback(),this.loadDay(),this.loadMine()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),clearTimeout(this.slowTimer)}willUpdate(t){(t.has("dayIdx")||t.has("roomId")||t.has("tab")||t.has("past")||t.has("duration"))&&(this.page=1),(t.has("roomId")||t.has("dayIdx"))&&(this.tlFrom=this.dayIdx===0?Te(!0,this.now).from:8)}updated(){const t=this.renderRoot.querySelector("[data-fit]");this.ro??=new ResizeObserver(()=>this.fit()),this.ro.disconnect(),t&&(this.ro.observe(t),requestAnimationFrame(()=>this.fit()))}fit(){const t=this.renderRoot.querySelector("[data-fit]");if(!t)return;const e=getComputedStyle(t).gridTemplateColumns.split(" ").filter(Boolean).length||1,s=Math.max(0,...[...t.children].map(o=>o.offsetHeight+8)),a=Math.max(Number(t.dataset.fit)||66,s),i=e*Vt(t.clientHeight+8,a);i!==this.per&&(this.per=i)}get now(){return this.ctx?.now??new Date}get day(){return B(M(this.now),this.dayIdx)}get ui(){return this.ctx.access.ui}async loadDay(){if(this.ctx){this.error="",this.slow=!1,clearTimeout(this.slowTimer),this.slowTimer=window.setTimeout(()=>this.slow=!0,300);try{const t=await this.ctx.api.roomsDay(X(this.day));this.rooms=t.rooms}catch(t){this.error=_(t)}finally{clearTimeout(this.slowTimer)}}}async loadMine(){if(this.ctx)try{const t=this.past?B(this.now,-30):this.now,e=this.past?this.now:B(this.now,31),s=await this.ctx.api.mine(t.toISOString(),e.toISOString());this.mine=s.occurrences.filter(a=>a.state!=="cancelled"&&a.state!=="withdrawn").sort((a,i)=>a.start.localeCompare(i.start))}catch(t){this.mine=[],this.error=_(t)}}cal(t){return this.ctx?.cals.find(e=>e.id===t)}roomList(){const t=this.ui.resident_rooms==="all_busy";return(this.rooms??[]).flatMap(e=>{const s=this.cal(e.calendar_id);if(!s)return[];const a=Oe.has(s.my_role??"");return!a&&!t?[]:this.headcount&&e.capacity&&this.headcount>e.capacity?[]:[...this.equip].some(i=>!e.equipment.includes(i))?[]:[{r:e,cal:s,bookable:a}]})}render(){if(!this.ctx)return c;const t=(this.mine??[]).length;return n`
      <h1>יומנים</h1>
      <div class="tabs" role="tablist" aria-label="יומנים">
        <button type="button" role="tab" aria-pressed=${String(this.tab==="grid")} aria-selected=${String(this.tab==="grid")} data-res-tab="grid" @click=${()=>this.tab="grid"}>יומן</button>
        <button type="button" role="tab" aria-pressed=${String(this.tab==="book")} aria-selected=${String(this.tab==="book")} data-res-tab="book" @click=${()=>this.tab="book"}>הזמנת חדר</button>
        <button type="button" role="tab" aria-pressed=${String(this.tab==="mine")} aria-selected=${String(this.tab==="mine")} data-res-tab="mine" @click=${()=>{this.tab="mine",this.done=""}}>ההזמנות שלי${!this.past&&t?n` <b class="num">${t}</b>`:c}</button>
      </div>
      ${this.tab==="grid"?n`<cal-view-calendar resident .ctx=${this.ctx} data-res-view="grid"></cal-view-calendar>`:this.tab==="book"?this.bookView():this.mineView()}
      ${this.sheetView()}`}stateView(){return this.error?n`<div class="center"><sw-state-panel state="error" data-res-state="error" heading="לא הצלחנו לטעון את החדרים" hint=${this.error} actionLabel="לנסות שוב" @action=${()=>void this.loadDay()}></sw-state-panel></div>`:this.slow?this.ui.loading_style==="spinner"?n`<div class="center" data-res-state="loading"><div class="spin" role="status" aria-label="טוען"></div></div>`:n`<section class="panel" data-res-state="loading" role="status" aria-label="טוען"><div class="skel" style="block-size:52px"></div>${[0,1,2,3].map(()=>n`<div class="skel" style="block-size:84px"></div>`)}</section>`:n`<section class="panel" aria-busy="true"></section>`}bookView(){if(!this.rooms)return this.stateView();const t=this.roomId?this.roomList().find(a=>a.r.calendar_id===this.roomId):void 0;if(t)return this.slotView(t.r,t.cal);const e=this.roomList(),s=wt(e,this.page,this.per);return n`<section class="panel" data-res-view="rooms">
      ${this.dayStrip()}
      <div class="tools"><span class="hc"><sw-icon name="users" size="16"></sw-icon>
        <button type="button" aria-label="פחות אנשים" @click=${()=>this.headcount=Math.max(0,this.headcount-1)}>−</button><b class="num" data-res-headcount>${this.headcount||"כל"}</b>
        <button type="button" aria-label="יותר אנשים" @click=${()=>this.headcount+=1}>+</button> אנשים</span><span class="sp"></span>
        <button type="button" class="btn sm" data-res-equip @click=${()=>this.sheet={kind:"equip"}}><sw-icon name="filter" size="14"></sw-icon>ציוד${this.equip.size?n` <b class="num">${this.equip.size}</b>`:c}</button></div>
      ${e.length?n`<div class="list" style="display:grid;grid-template-columns:minmax(0,1fr);align-content:start" data-fit="92">${s.items.map(a=>this.roomCard(a.r,a.cal,a.bookable))}</div>${this.pager(s.page,s.pages)}`:n`<div class="center"><sw-state-panel icon="calendar" state="empty" data-res-state="empty" heading=${(this.rooms??[]).length?"אין חדר שמתאים לסינון":"אין חדרים פתוחים להזמנה בשבילך"}
          hint=${(this.rooms??[]).length?"אפשר לשנות את מספר האנשים או את הציוד.":"ההנהלה קובעת אילו חדרים דיירים יכולים להזמין."}></sw-state-panel></div>`}
    </section>`}dayStrip(){return n`<div class="days" role="group" aria-label="יום">${Array.from({length:7},(t,e)=>{const s=B(M(this.now),e);return n`<button type="button" aria-pressed=${String(this.dayIdx===e)} data-res-day=${e} aria-label=${`${G[s.getDay()]} ${pt(s)}`}
        @click=${()=>{this.dayIdx!==e&&(this.dayIdx=e,this.start=null,this.rooms=null,this.loadDay())}}><small>${e===0?"היום":kt[s.getDay()]}</small><b>${s.getDate()}</b></button>`})}</div>`}roomCard(t,e,s){const a=s?ss(t.entries,this.day,t.open,30,this.now):null,i=e.approval_mode!=="none",o=t.equipment.map(r=>ne[r]).join(" · ");return n`<button type="button" class="rcard" data-res-room=${t.calendar_id} aria-disabled=${String(!s)}
      @click=${()=>{s&&(this.roomId=t.calendar_id,this.start=null)}}>
      <span class="sq" style=${`--h:${q(e.color)}`}></span>
      <div class="grow"><div class="name ell" title=${t.name}>${t.name}</div><div class="sub ell">${t.capacity?n`<span class="num">${t.capacity}</span> מקומות`:"ללא הגבלת מקום"}${o?` · ${o}`:""}</div>
        <div class="mini" aria-hidden="true">${t.entries.map(r=>{const l=Kt(r,this.day,7,23);return l?n`<i class=${r.state==="pending"?"p":""} style=${`left:${l.start}%;width:${l.width}%`}></i>`:c})}</div></div>
      <div class="rnext">${s?a?n`<small>פנוי מ־</small><b>${w(a)}</b>`:n`<b class="none">תפוס ${this.dayIdx?"ביום הזה":"היום"}</b>`:n`<b class="none">תפוס</b><small>צפייה בלבד</small>`}
        ${i&&s?n`<span class="chip acc">באישור</span>`:c}</div></button>`}pager(t,e){return e<=1?c:n`<div class="pager" data-res-pager><button type="button" class="btn icon" aria-label="הקודם" ?disabled=${t<=1} @click=${()=>this.page=t-1}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <span class="num">${t} / ${e}</span><button type="button" class="btn icon" aria-label="הבא" ?disabled=${t>=e} data-res-next @click=${()=>this.page=t+1}><sw-icon name="chevron" size="16"></sw-icon></button></div>`}slots(t){return ee(t.entries,this.day,t.open,this.duration,30,this.now)}slotView(t,e){const s=e.approval_mode!=="none",a=this.start,i=a?new Date(a.getTime()+this.duration*6e4):null,o=this.ui.phone_time_picker==="timeline";return n`<section class="panel" data-res-view="slot" data-picker=${o?"timeline":"grid"}>
      <div class="shead"><span class="sq" style=${`--h:${q(e.color)}`}></span><div class="grow"><b class="ell" title=${t.name}>${t.name}</b>
        <span class="sub">${this.dayIdx===0?"היום":this.dayIdx===1?"מחר":kt[this.day.getDay()]} · ${G[this.day.getDay()]} ${pt(this.day)}${s?" · כל בקשה באישור":""}</span></div>
        <button type="button" class="btn icon" aria-label="חזרה לחדרים" data-res-back @click=${()=>{this.roomId="",this.start=null}}><sw-icon name="chevron" size="16"></sw-icon></button></div>
      <div class="seg dur" role="radiogroup" aria-label="משך">${va.map(([r,l])=>n`<button type="button" role="radio" aria-pressed=${String(this.duration===r)} aria-checked=${String(this.duration===r)} data-res-dur=${r}
        @click=${()=>{this.duration=r,this.start=null}}>${l}</button>`)}</div>
      ${o?this.timelineView(t):this.gridView(t)}
      <button type="button" class="btn pri go" data-res-continue ?disabled=${!a} @click=${()=>{this.evTitle="",this.people=Math.max(1,this.headcount||1),this.actionError="",this.sheet={kind:"confirm"}}}>
        <sw-icon name="check" size="16"></sw-icon>${a&&i?n`המשך · <span class="num ltr">${w(a)}–${w(i)}</span>`:"בחירת שעת התחלה"}</button>
    </section>`}gridView(t){const e=this.ui.resident_pending_display,s=this.slots(t),a=wt(s,this.page,this.per),i=this.start,o=i?i.getTime()+this.duration*6e4:0;return s.length?n`<div class="slots" data-fit="56" data-res-slots>${a.items.map(r=>{const l=as(r,e),p=!!i&&r.start.getTime()>=i.getTime()&&r.start.getTime()<o;return n`<button type="button" class="slot" data-look=${l} ?data-sel=${p} data-res-slot=${w(r.start)} ?disabled=${l==="busy"||l==="blocked"}
        aria-label=${`${w(r.start)} ${l==="busy"?"תפוס":l==="blocked"?"יש בקשות ממתינות":l==="contest"?`${r.pending} מבקשים`:"פנוי"}`}
        @click=${()=>this.start=r.start}><b>${w(r.start)}</b>${l==="busy"?n`<small>תפוס</small>`:l==="blocked"?n`<small>ממתין</small>`:l==="contest"?n`<small>${r.pending} מבקשים</small>`:c}</button>`})}</div>
    ${this.pager(a.page,a.pages)}
    <div class="legend"><span><i class="lf"></i>פנוי</span>${e==="count"?n`<span><i class="lc"></i>יש בקשות ממתינות, אפשר לבקש</span>`:e==="blocked"?n`<span><i class="lb"></i>יש בקשות ממתינות</span>`:c}<span><i class="lb"></i>תפוס</span></div>`:n`<div class="center"><sw-state-panel icon="clock" state="empty" compact data-res-state="noslots" heading="אין שעות פנויות ביום הזה" hint="אפשר לבחור יום אחר או משך קצר יותר."></sw-state-panel></div>`}timelineView(t){const e={from:this.tlFrom,to:Math.min(24,this.tlFrom+6)},s=(e.to-e.from)*60,a=this.start,i=a?this.slotFree(t,a):!0,o=a?Kt({start:a.toISOString(),end:new Date(a.getTime()+this.duration*6e4).toISOString()},this.day,e.from,e.to):null,r=l=>{const u=l.currentTarget.getBoundingClientRect(),v=Math.min(1,Math.max(0,(l.clientX-u.left)/u.width)),m=Math.round((e.from*60+v*s-this.duration/2)/15)*15,h=new Date(M(this.day).getTime()+Math.max(e.from*60,Math.min(e.to*60-this.duration,m))*6e4);h>=this.now&&(this.start=h)};return n`<div class="tl" data-res-timeline>
      <div class="tlnav"><button type="button" class="btn icon" aria-label="מוקדם יותר" ?disabled=${e.from<=0} @click=${()=>this.tlFrom=Math.max(0,this.tlFrom-3)}><sw-icon name="chevron" size="16"></sw-icon></button>
        <div class="tlsel num" data-res-tlsel>${a?n`<span class="ltr">${w(a)}–${w(new Date(a.getTime()+this.duration*6e4))}</span>${i?"":" · תפוס"}`:"נגיעה בפס בוחרת שעה"}</div>
        <button type="button" class="btn icon" aria-label="מאוחר יותר" ?disabled=${e.to>=24} @click=${()=>this.tlFrom=Math.min(18,this.tlFrom+3)}><sw-icon name="chevronBack" size="16"></sw-icon></button></div>
      <div class="bar" role="slider" aria-label="שעת התחלה" aria-valuetext=${a?w(a):""} tabindex="0" data-res-bar
        @pointerdown=${l=>{this.drag=!0,l.currentTarget.setPointerCapture(l.pointerId),r(l)}}
        @pointermove=${l=>{this.drag&&r(l)}} @pointerup=${()=>this.drag=!1} @pointercancel=${()=>this.drag=!1}
        @keydown=${l=>this.tlKey(l)}>
        ${t.entries.map(l=>{const p=Kt(l,this.day,e.from,e.to);return p?n`<span class=${`e ${l.state==="pending"?"p":""}`} style=${`left:${p.start}%;width:${p.width}%`}></span>`:c})}
        ${o?n`<span class=${`sel ${i?"":"bad"}`} style=${`left:${o.start}%;width:${o.width}%`}></span>`:c}
      </div>
      <div class="axis" aria-hidden="true">${Array.from({length:e.to-e.from+1},(l,p)=>n`<span style=${`left:${p/(e.to-e.from)*100}%`}>${String(e.from+p).padStart(2,"0")}</span>`)}</div>
    </div>`}tlKey(t){const e=t.key==="ArrowRight"?15:t.key==="ArrowLeft"?-15:0;if(!e)return;t.preventDefault();const s=this.start??new Date(M(this.day).getTime()+this.tlFrom*36e5),a=new Date(s.getTime()+e*6e4);a>=this.now&&(this.start=a)}slotFree(t,e){const s=new Date(e.getTime()+this.duration*6e4),a=this.ui.resident_pending_display==="blocked";return!t.entries.some(i=>new Date(i.start)<s&&new Date(i.end)>e&&(i.state==="confirmed"||a&&i.state==="pending"))}mineView(){if(!this.mine)return this.stateView();const t=this.mine,e=wt(t,this.page,this.per);return n`<section class="panel" data-res-view="mine">
      ${this.done?n`<div class="done" role="status" data-res-done><sw-icon name="check" size="18"></sw-icon><div><b>${this.done}</b><span class="muted">תקבל הודעה כשיוחלט</span></div></div>`:c}
      <div class="seg" style="align-self:center;flex:none" role="radiogroup" aria-label="הזמנות"><button type="button" role="radio" aria-pressed=${String(!this.past)} aria-checked=${String(!this.past)} data-res-upcoming
        @click=${()=>{this.past=!1,this.mine=null,this.loadMine()}}>קרובות</button>
        <button type="button" role="radio" aria-pressed=${String(this.past)} aria-checked=${String(this.past)} data-res-past @click=${()=>{this.past=!0,this.mine=null,this.loadMine()}}>הסתיימו</button></div>
      ${t.length?n`<div class="list" style="display:grid;grid-template-columns:minmax(0,1fr);align-content:start" data-fit="148">${e.items.map(s=>this.booking(s))}</div>${this.pager(e.page,e.pages)}`:n`<div class="center"><sw-state-panel icon="calendar" state="empty" data-res-state="mine-empty" heading=${this.past?"אין הזמנות שהסתיימו":"אין לך הזמנות קרובות"}
          hint=${this.past?"הזמנות שהסתיימו נשמרות כאן 30 יום.":'חדר פנוי אפשר להזמין בלשונית "הזמנת חדר".'} actionLabel=${this.past?"":"הזמנת חדר"} @action=${()=>this.tab="book"}></sw-state-panel></div>`}
    </section>`}booking(t){const e=this.cal(t.calendar_id),s={confirmed:["ok","מאושר"],pending:["dash","ממתין"],displaced:["warn","נדחק"],rejected:["bad","נדחה"],expired:["","פג"],done:["","הסתיים"]},[a,i]=s[t.state]??["",t.state],o=this.ui.resident_cancel_until,r=t.state==="confirmed"&&is(t.start,o,this.now),l=t.state==="pending"?`ממתין לאישור${t.contested?" · יש עוד בקשה לחלון":""}`:t.state==="displaced"?"נדחק בגלל תחזוקה. אפשר לבחור זמן אחר":t.state==="confirmed"?"מאושר":"";return n`<div class="bk" data-state=${t.state} data-res-booking=${t.event_id}>
      <div class="bkt"><span class="dot" style=${`--h:${q(e?.color)}`}></span><b title=${t.title??""}>${t.title??"הזמנה"}</b><span class=${`chip ${a}`}>${i}</span></div>
      <div class="bkw"><b>${bt(t.start,t.end,this.now)}</b><span class="sub ell">${e?.name??""}${t.recurring?" · סדרה":""}</span></div>
      ${l?n`<div class="sub ell">${l}</div>`:c}
      ${this.past?c:t.state==="displaced"?n`<div class="bka"><button type="button" class="btn sm pri" data-res-alts @click=${()=>void this.openDisplaced(t)}>בחירת זמן חלופי</button>
          <button type="button" class="btn sm badtxt" data-res-cancel @click=${()=>this.openCancel(t)}>ביטול</button></div>`:t.state==="pending"?n`<div class="bka"><button type="button" class="btn sm badtxt" data-res-withdraw ?disabled=${this.busy} @click=${()=>void this.withdraw(t)}>משיכת הבקשה</button></div>`:t.state==="confirmed"?n`<div class="bka">${r?n`<span class="why" data-res-closed>${o==="start"?"המועד התחיל":`אפשר לבטל עד ${o==="1h"?"שעה":"24 שעות"} לפני; מנהל היומן יכול לבטל`}</span>`:c}
          <button type="button" class="btn sm badtxt" data-res-cancel ?disabled=${r} @click=${()=>this.openCancel(t)}>ביטול</button></div>`:c}
    </div>`}openCancel(t){this.cancelScope="occurrence",this.actionError="",this.sheet={kind:"cancel",o:t}}async withdraw(t){if(this.ctx){this.busy=!0;try{const e=await this.ctx.api.event(t.event_id);await this.ctx.api.withdrawEvent(t.event_id,e.event.revision),A(this,z.toast,"הבקשה נמשכה"),await this.loadMine()}catch(e){A(this,z.toast,_(e))}finally{this.busy=!1}}}async openDisplaced(t){if(!this.ctx)return;this.alts=null,this.altPick=0,this.actionError="",this.sheet={kind:"displaced",o:t};const e=this.ctx.api,s=new Date(t.start),a=new Date(t.end).getTime()-s.getTime(),i=Math.max(15,Math.round(a/6e4)),o=M(s),r=[];try{const[l,p]=await Promise.all([e.roomsDay(X(o)),e.roomsDay(X(B(o,1)))]),u=(f,g)=>f.find(k=>k.calendar_id===g),v=u(l.rooms,t.calendar_id),m=v&&ee(v.entries.filter(f=>f.event_id!==t.event_id),o,v.open,i,30,this.now).find(f=>f.free&&f.start.getTime()>=new Date(t.end).getTime());m&&r.push({calendar_id:t.calendar_id,start:m.start,end:new Date(m.start.getTime()+a),note:"אותו חדר, אותו אורך"});const h=u(p.rooms,t.calendar_id),x=new Date(s.getTime()+864e5);h&&ee(h.entries,B(o,1),h.open,i,15,this.now).some(f=>f.free&&f.start.getTime()===x.getTime())&&r.push({calendar_id:t.calendar_id,start:x,end:new Date(x.getTime()+a),note:"אותה שעה, יום אחר"});const b=l.rooms.find(f=>f.calendar_id!==t.calendar_id&&Oe.has(this.cal(f.calendar_id)?.my_role??"")&&!f.entries.some(g=>g.state==="confirmed"&&new Date(g.start)<new Date(t.end)&&new Date(g.end)>s));b&&r.push({calendar_id:b.calendar_id,start:s,end:new Date(t.end),note:`אותה שעה, חדר אחר${this.cal(b.calendar_id)?.approval_mode!=="none"?" · באישור":""}`})}catch(l){this.actionError=_(l)}this.alts=r.slice(0,3)}close(){this.sheet=null}sheetView(){const t=this.sheet;if(!t)return c;const e=n`<div class="scrim" @click=${()=>this.close()}></div>`;return t.kind==="equip"?n`${e}<aside class="sheet" role="dialog" aria-label="ציוד" data-res-sheet="equip"><div class="grab" aria-hidden="true"></div>
        <header><div class="grow"><h2>ציוד בחדר</h2><div class="muted">רק חדרים שיש בהם הכול</div></div><button type="button" class="x" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
        <div class="body"><div class="eq">${Object.keys(ne).map(s=>n`<button type="button" aria-pressed=${String(this.equip.has(s))} data-res-eq=${s}
          @click=${()=>{const a=new Set(this.equip);a.has(s)?a.delete(s):a.add(s),this.equip=a}}>${ne[s]}</button>`)}</div></div>
        <footer><button type="button" class="btn pri" style="flex:1" @click=${()=>this.close()}>הצגת חדרים</button><button type="button" class="btn" @click=${()=>this.equip=new Set}>ניקוי</button></footer></aside>`:t.kind==="confirm"?n`${e}${this.confirmSheet()}`:t.kind==="cancel"?n`${e}${this.cancelSheet(t.o)}`:n`${e}${this.displacedSheet(t.o)}`}confirmSheet(){const t=this.roomList().find(p=>p.r.calendar_id===this.roomId);if(!t||!this.start)return c;const{r:e,cal:s}=t,a=new Date(this.start.getTime()+this.duration*6e4),i=e.entries.filter(p=>p.state==="pending"&&new Date(p.start)<a&&new Date(p.end)>this.start).length,o=s.approval_mode!=="none"||i>0||!this.slotFree(e,this.start),r=s.owner.name||"מנהל החדר",l=s.approval_timeout_h??2;return n`<aside class="sheet" role="dialog" aria-label="אישור הזמנה" data-res-sheet="confirm"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>${o?`בקשה להזמנת ${s.name}`:`הזמנת ${s.name}`}</h2><div class="muted ell">${s.name} · ${bt(this.start.toISOString(),a.toISOString(),this.now)}</div></div>
        <button type="button" class="x" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        <div class="fld"><label for="rt">כותרת</label><input id="rt" class="inp" data-res-title maxlength="120" placeholder="למשל: יום הולדת" .value=${this.evTitle} @input=${p=>this.evTitle=p.target.value}></div>
        <div class="fld"><span class="lbl">משתתפים</span><span class="hc"><button type="button" aria-label="פחות" @click=${()=>this.people=Math.max(1,this.people-1)}>−</button>
          <b class="num" data-res-people>${this.people}</b><button type="button" aria-label="יותר" @click=${()=>this.people=Math.min(e.capacity??2e3,this.people+1)}>+</button>${e.capacity?n`מתוך <span class="num">${e.capacity}</span>`:c}</span></div>
        <div class="lockline"><sw-icon name="lock" size="14"></sw-icon><span>הזמנה בשמך. הזמנה בשם חוג או לקוח רק לצוות.</span></div>
        ${o?n`<div class="note" data-res-approval><sw-icon name="info" size="18"></sw-icon><div><b>הבקשה תישלח ל${r}</b>
          <span>בקשה לא שומרת את המועד.${i?` יש עוד ${i===1?"בקשה אחת":`${i} בקשות`} לחלון הזה; מי שיאושר ראשון יקבל אותו.`:""} אם לא תאושר, תקבל הצעות לזמן אחר.</span></div></div>
          <div class="hint"><sw-icon name="clock" size="14"></sw-icon>${l?`אם לא תהיה החלטה עד ${l===1?"שעה":l===2?"שעתיים":`${l} שעות`} לפני, הבקשה תפוג ותקבל הודעה.`:"אם לא תהיה החלטה עד תחילת המועד, הבקשה תפוג."}</div>`:c}
        ${this.actionError?n`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>`:c}
      </div>
      <footer><button type="button" class="btn pri" style="flex:1" data-res-submit ?disabled=${this.busy} @click=${()=>void this.submit(s,o)}><sw-icon name="check" size="16"></sw-icon>${o?"שליחה לאישור":"הזמנה"}</button>
        <button type="button" class="btn" @click=${()=>this.close()}>חזרה</button></footer></aside>`}async submit(t,e){if(!this.ctx||!this.start)return;this.busy=!0,this.actionError="";const s=new Date(this.start.getTime()+this.duration*6e4);try{const a=await this.ctx.api.createEvent({calendar_id:t.id,kind:"booking",title:this.evTitle.trim()||"הזמנת חדר",start:this.start.toISOString(),end:s.toISOString(),headcount:this.people});this.sheet=null,this.start=null,this.roomId="",this.done=a.state==="pending"||e?`הבקשה נשלחה ל${t.owner.name||"מנהל החדר"}`:"ההזמנה נקבעה",this.tab="mine",this.past=!1,this.rooms=null,this.loadDay(),await this.loadMine()}catch(a){this.actionError=_(a)}finally{this.busy=!1}}cancelSheet(t){const e=this.cal(t.calendar_id);return n`<aside class="sheet" role="alertdialog" aria-label="ביטול הזמנה" data-res-sheet="cancel"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>לבטל את "${t.title??"ההזמנה"}"?</h2><div class="muted ell">${e?.name??""} · ${bt(t.start,t.end,this.now)}</div></div></header>
      <div class="body">
        ${t.recurring?n`<div role="radiogroup" aria-label="מה לבטל" style="display:grid;gap:8px">
          <button type="button" class="opt" role="radio" aria-checked=${String(this.cancelScope==="occurrence")} data-res-scope="occurrence" @click=${()=>this.cancelScope="occurrence"}><span class="rad"></span><div><b>רק ${kt[new Date(t.start).getDay()]} ${pt(new Date(t.start))}</b><small>שאר המועדים נשארים</small></div></button>
          <button type="button" class="opt" role="radio" aria-checked=${String(this.cancelScope==="series")} data-res-scope="series" @click=${()=>this.cancelScope="series"}><span class="rad"></span><div><b>כל הסדרה</b><small>מועדים שעברו נשארים בהיסטוריה</small></div></button></div>`:c}
        <div class="hint"><sw-icon name="info" size="14"></sw-icon>החדר יתפנה מיד ומי שביקש אותו יקבל הודעה.</div>
        ${this.actionError?n`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>`:c}
      </div>
      <footer><button type="button" class="btn bad fill" style="flex:1" data-res-cancel-ok ?disabled=${this.busy} @click=${()=>void this.cancel(t)}><sw-icon name="trash" size="16"></sw-icon>${t.recurring&&this.cancelScope==="series"?"ביטול הסדרה":"ביטול המועד"}</button>
        <button type="button" class="btn" @click=${()=>this.close()}>השארה</button></footer></aside>`}async cancel(t){if(this.ctx){this.busy=!0,this.actionError="";try{const e=await this.ctx.api.event(t.event_id);await this.ctx.api.cancelEvent(t.event_id,e.event.revision,t.recurring&&this.cancelScope==="occurrence"?t.start:void 0),this.sheet=null,A(this,z.toast,"ההזמנה בוטלה"),await this.loadMine()}catch(e){this.actionError=_(e)}finally{this.busy=!1}}}displacedSheet(t){const e=this.alts;return n`<aside class="sheet" role="dialog" aria-label="בחירת זמן חלופי" data-res-sheet="displaced"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>בחירת זמן חלופי</h2><div class="muted">"${t.title??"ההזמנה"}" נדחקה בגלל תחזוקה ב${this.cal(t.calendar_id)?.name??"חדר"}</div></div>
        <button type="button" class="x" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        ${e===null?n`${[0,1,2].map(()=>n`<div class="skel" style="block-size:56px"></div>`)}`:e.length?n`<div role="radiogroup" aria-label="זמן חלופי" style="display:grid;gap:8px">${e.map((s,a)=>n`<button type="button" class="opt" role="radio" aria-checked=${String(this.altPick===a)} data-res-alt=${a}
            @click=${()=>this.altPick=a}><span class="rad"></span><div><b class="num">${bt(s.start.toISOString(),s.end.toISOString(),this.now)} · ${this.cal(s.calendar_id)?.name??""}</b><small>${s.note}</small></div></button>`)}</div>`:n`<div class="note warn">אין כרגע זמן חלופי קרוב. אפשר לבחור זמן בלשונית "הזמנת חדר".</div>`}
        <div class="hint"><sw-icon name="info" size="14"></sw-icon>Arx לא מזיז הזמנות לבד. אם לא תבחר, ההזמנה נשארת "נדחק" עד שתבטל.</div>
        ${this.actionError?n`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>`:c}
      </div>
      <footer><button type="button" class="btn pri" style="flex:1" data-res-alt-ok ?disabled=${!e?.length||this.busy} @click=${()=>void this.rebook(t)}><sw-icon name="check" size="16"></sw-icon>קביעה בזמן הזה</button>
        <button type="button" class="btn" @click=${()=>this.openCancel(t)}>ביטול ההזמנה</button></footer></aside>`}async rebook(t){const e=this.alts?.[this.altPick];if(!(!this.ctx||!e)){this.busy=!0,this.actionError="";try{const s=await this.ctx.api.createEvent({calendar_id:e.calendar_id,kind:"booking",title:t.title??"הזמנת חדר",start:e.start.toISOString(),end:e.end.toISOString()}),a=await this.ctx.api.event(t.event_id);await this.ctx.api.cancelEvent(t.event_id,a.event.revision),this.sheet=null,this.done=s.state==="pending"?"הבקשה לזמן החדש נשלחה לאישור":"ההזמנה נקבעה בזמן החדש",await this.loadMine()}catch(s){this.actionError=_(s)}finally{this.busy=!1}}}};C.styles=[nt,tt`
    :host { display: flex; flex-direction: column; min-block-size: 0; gap: 10px; overflow: hidden; }
    h1 { margin: 0; font-size: var(--sw-fs-3xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); line-height: 1.15; }
    .tabs { display: flex; gap: 2px; padding: 4px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
    .tabs button { flex: 1; font: inherit; font-size: var(--sw-fs-md); border: 0; background: transparent; color: var(--sw-text-2); min-block-size: 40px; border-radius: var(--sw-r-pill);
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; -webkit-tap-highlight-color: transparent; }
    .tabs button[aria-pressed='true'] { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-heading)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .panel { flex: 1; padding: 12px; gap: 10px; }
    .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; flex: none; }
    .days button { font: inherit; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-heading); min-block-size: 52px; display: grid; place-items: center;
      align-content: center; gap: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; padding: 4px 0; }
    .days small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .days b { font-size: var(--sw-fs-xl); font-variant-numeric: tabular-nums; }
    .days button[aria-pressed='true'] { background: var(--sw-accent); color: var(--sw-text-inverse); }
    .days button[aria-pressed='true'] small { color: var(--sw-text-inverse); }
    .tools { display: flex; align-items: center; gap: 8px; flex: none; }
    .hc { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .hc button { inline-size: 32px; block-size: 32px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); font: inherit; cursor: pointer; padding: 0; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
    .rcard { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 0; font: inherit; color: inherit; text-align: start;
      cursor: pointer; inline-size: 100%; min-block-size: 84px; -webkit-tap-highlight-color: transparent; transition: transform var(--sw-t-press) var(--sw-ease); }
    .rcard:active { transform: scale(0.98); }
    .rcard[aria-disabled='true'] { cursor: default; opacity: 0.75; }
    .rcard .name { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rcard .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .rnext { display: grid; justify-items: end; gap: 2px; flex: none; text-align: end; }
    .rnext small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .rnext b { font-size: var(--sw-fs-xl); color: var(--sw-success-text); font-variant-numeric: tabular-nums; }
    .rnext b.none { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .mini { position: relative; block-size: 10px; margin-block-start: 8px; direction: ltr; }
    .mini i { position: absolute; inset-block: 1px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); }
    .mini i.p { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-text-3); }
    .shead { display: flex; align-items: center; gap: 10px; flex: none; }
    .shead b { display: block; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .shead .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .dur { align-self: center; flex: none; }
    .slots { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-content: start; overflow: hidden; }
    .slot { font: inherit; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-heading); min-block-size: 48px; display: grid; place-items: center; align-content: center;
      cursor: pointer; padding: 4px 2px; -webkit-tap-highlight-color: transparent; }
    .slot b { font-size: var(--sw-fs-md); font-variant-numeric: tabular-nums; }
    .slot small { font-size: var(--sw-fs-2xs); color: var(--sw-text-2); }
    .slot[data-look='contest'] { background: transparent; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .slot[data-look='busy'], .slot[data-look='blocked'] { cursor: default; color: var(--sw-text-3); }
    .slot[data-look='busy'] b { text-decoration: line-through; }
    .slot[data-sel] { background: var(--sw-accent); color: var(--sw-text-inverse); outline: 0; }
    .slot[data-sel] small { color: var(--sw-text-inverse); }
    .legend { flex: none; }
    .legend i.lf { background: var(--sw-surface-2); box-shadow: inset 0 0 0 1px var(--sw-border); }
    .legend i.lc { background: transparent; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .legend i.lb { background: var(--sw-surface-3); }
    .go { inline-size: 100%; min-block-size: 52px; font-size: var(--sw-fs-lg); flex: none; }
    .tl { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 10px; justify-content: center; }
    .bar { position: relative; block-size: 72px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); direction: ltr; touch-action: none; cursor: pointer; overflow: hidden; }
    .bar .e { position: absolute; inset-block: 10px; border-radius: var(--sw-r-xs); background: var(--sw-surface-3); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .bar .e.p { background: transparent; box-shadow: none; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .bar .sel { position: absolute; inset-block: 4px; border-radius: var(--sw-r-sm); background: color-mix(in srgb, var(--sw-accent) 30%, transparent); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .bar .sel.bad { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .axis { position: relative; block-size: 16px; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .axis span { position: absolute; transform: translateX(-50%); font-variant-numeric: tabular-nums; }
    .tlnav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .tlsel { text-align: center; font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .bk { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); min-inline-size: 0; flex: none; }
    .bk[data-state='displaced'] { box-shadow: inset 0 0 0 1.5px var(--sw-warning); background: var(--sw-surface-solid); }
    .bkt { display: flex; align-items: center; gap: 8px; min-inline-size: 0; }
    .bkt b { flex: 1; min-inline-size: 0; font-size: var(--sw-fs-lg); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bkw { display: flex; align-items: baseline; gap: 8px; min-inline-size: 0; }
    .bkw b { font-size: var(--sw-fs-lg); color: var(--sw-heading); font-variant-numeric: tabular-nums; flex: none; }
    .bka { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; align-items: center; }
    .bka .why { font-size: var(--sw-fs-xs); color: var(--sw-text-3); margin-inline-end: auto; }
    .sugg { display: flex; flex-wrap: wrap; gap: 6px; }
    .sugg button { font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); border: 0; border-radius: var(--sw-r-pill); background: var(--sw-accent-soft); color: var(--sw-accent-text);
      padding: 6px 12px; cursor: pointer; min-block-size: 32px; }
    .btn.badtxt { color: var(--sw-danger-text); }
    .done { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--sw-success-soft); color: var(--sw-success-text); flex: none; }
    .done b { color: var(--sw-heading); display: block; }
    .center { display: grid; place-items: center; flex: 1; }
    /* the bottom sheet (mobile-native: safe area, 16 px inputs, 44 px targets, the grab handle) */
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); animation: fade var(--sw-t-sheet) var(--sw-ease); }
    .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; z-index: var(--sw-z-modal); background: var(--sw-surface-solid); border-start-start-radius: var(--sw-r-2xl);
      border-start-end-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-3); display: flex; flex-direction: column; max-block-size: 88dvh;
      padding-block-end: env(safe-area-inset-bottom); animation: up var(--sw-spring-drawer-ms) var(--sw-ease-drawer); }
    .grab { inline-size: 40px; block-size: 5px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); margin: 8px auto 0; }
    .sheet header { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px 6px; }
    .sheet header h2 { margin: 0; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .sheet .body { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 10px; overflow: auto; overscroll-behavior: contain; }
    .sheet footer { display: flex; gap: 8px; padding: 10px 16px 14px; border-block-start: 1px solid var(--sw-border); }
    .sheet footer .btn { min-block-size: 48px; }
    .x { inline-size: 44px; block-size: 44px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); display: grid; place-items: center;
      cursor: pointer; flex: none; padding: 0; }
    .opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent; cursor: pointer;
      text-align: start; font: inherit; color: inherit; inline-size: 100%; min-block-size: 44px; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .rad { flex: none; inline-size: 20px; block-size: 20px; border-radius: 50%; border: 2px solid var(--sw-border-strong); display: grid; place-items: center; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border-color: var(--sw-accent); }
    .opt[aria-checked='true'] .rad::after { content: ''; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .lockline { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .hint { display: flex; gap: 6px; align-items: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .eq { display: flex; flex-wrap: wrap; gap: 8px; }
    .eq button { font: inherit; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); border-radius: var(--sw-r-pill); min-block-size: 44px; padding: 0 16px; cursor: pointer; }
    .eq button[aria-pressed='true'] { background: var(--sw-accent-soft); border-color: var(--sw-accent); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    @keyframes up { from { transform: translateY(100%); } }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .sheet, .scrim { animation: none; } .rcard { transition: none; } }
    @media (hover: hover) { .rcard:hover { background: var(--sw-surface-3); } }
  `];L([y({attribute:!1})],C.prototype,"ctx",2);L([d()],C.prototype,"tab",2);L([d()],C.prototype,"dayIdx",2);L([d()],C.prototype,"rooms",2);L([d()],C.prototype,"roomId",2);L([d()],C.prototype,"duration",2);L([d()],C.prototype,"start",2);L([d()],C.prototype,"headcount",2);L([d()],C.prototype,"equip",2);L([d()],C.prototype,"sheet",2);L([d()],C.prototype,"mine",2);L([d()],C.prototype,"past",2);L([d()],C.prototype,"error",2);L([d()],C.prototype,"slow",2);L([d()],C.prototype,"busy",2);L([d()],C.prototype,"actionError",2);L([d()],C.prototype,"done",2);L([d()],C.prototype,"evTitle",2);L([d()],C.prototype,"people",2);L([d()],C.prototype,"cancelScope",2);L([d()],C.prototype,"alts",2);L([d()],C.prototype,"altPick",2);L([d()],C.prototype,"page",2);L([d()],C.prototype,"per",2);L([d()],C.prototype,"tlFrom",2);C=L([it("cal-resident")],C);var ma=Object.defineProperty,fa=Object.getOwnPropertyDescriptor,ht=(t,e,s,a)=>{for(var i=a>1?void 0:a?fa(e,s):e,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(e,s,i):r(i))||i);return a&&i&&ma(e,s,i),i};const ba={cal:"יומן",rooms:"חדרים לפי שעות",approvals:"אישורים",maint:"תחזוקה",manage:"ניהול יומנים"},wa={cal:"יומן",rooms:"חדרים",approvals:"אישורים",maint:"תחזוקה",manage:"ניהול"};let st=class extends at{constructor(){super(...arguments),this.route=null,this.access=Ke(),this.cals=null,this.error="",this.floor="",this.q="",this.floorNames={},this.slow=!1,this.device="desktop",this.drawer=null,this.toastText="",this.api=null,this.stop=null,this.slowTimer=0,this.toastTimer=0,this.onResize=()=>this.measure()}connectedCallback(){super.connectedCallback(),this.measure(),window.addEventListener("resize",this.onResize),this.stop=Ue(t=>this.access=t),ve(),this.load(),this.addEventListener(z.newEvent,t=>this.drawer={kind:"event",d:t.detail??{}}),this.addEventListener(z.newMaint,t=>this.drawer={kind:"maint",d:t.detail??{}}),this.addEventListener(z.changed,()=>void this.load(!0)),this.addEventListener(z.toast,t=>this.toast(t.detail))}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),this.stop?.(),clearTimeout(this.slowTimer),clearTimeout(this.toastTimer)}willUpdate(t){const e=t.get("route");t.has("route")&&e&&e.params.toString()!==this.route?.params.toString()&&(e.params.get("role")!==this.route?.params.get("role")&&ve(),this.load())}measure(){const t=window.innerWidth;this.device=t<700?"phone":t<1180?"tablet":"desktop"}async load(t=!1){t||(this.error="",this.slow=!1,clearTimeout(this.slowTimer),this.slowTimer=window.setTimeout(()=>this.slow=!0,300));try{this.api??=await Ve();const[{calendars:e}]=await Promise.all([this.api.calendars(),this.loadFloors()]);this.cals=e.filter(s=>!s.archived),this.error=""}catch(e){t||(this.cals=null),this.error=_(e)}finally{clearTimeout(this.slowTimer)}}async loadFloors(){if(!(!Nt()||Object.keys(this.floorNames).length))try{const t=await Ge();this.floorNames=Object.fromEntries((t.floors??[]).map(e=>[e.floor_id,e.name]))}catch{}}toast(t){this.toastText=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toastText="",3200)}get view(){const t=this.route?.segments??[],e=this.route?.mode==="devices"?t[2]:t[1];return e&&we.includes(e)?e:"cal"}get sub(){const t=this.route?.segments??[];return decodeURIComponent((this.route?.mode==="devices"?t[3]:t[2])??"")}manages(){return(this.cals??[]).some(t=>t.my_role==="manage")}offered(t){const e=this.access.can;return t==="approvals"?this.manages():t==="maint"?e.maintenance:t==="manage"?e.manage||this.manages():!0}ctx(){return{api:this.api,access:this.access,cals:this.cals??[],floor:this.floor,q:this.q,base:Jt(this.route),sub:this.sub,now:new Date,device:this.device,manages:this.manages()}}floors(){const t=new Map;for(const e of this.cals??[])e.floor_id&&!t.has(e.floor_id)&&t.set(e.floor_id,this.floorNames[e.floor_id]??e.floor_name??e.floor_id);return[...t].map(([e,s])=>({id:e,name:s})).sort((e,s)=>e.name.localeCompare(s.name,"he"))}render(){const t=this.access;if(t.enabled===!1&&Nt())return n`<h1 class="vh">יומנים</h1><div class="center"><sw-state-panel icon="calendar" state="empty" data-cal-state="off" heading="מודול היומנים כבוי"
        hint=${t.can.configure?"אפשר להפעיל אותו בהגדרות ‹ יומנים.":"מנהל המערכת יכול להפעיל אותו."} actionLabel=${t.can.configure?"הפעלת מודול היומנים":""}
        @action=${()=>location.hash=Ye}></sw-state-panel></div>`;if(t.enabled&&!t.can.view)return n`<h1 class="vh">יומנים</h1><div class="center"><sw-state-panel state="forbidden" data-cal-state="forbidden" heading="אין לך גישה ליומנים"></sw-state-panel></div>`;const e=this.device==="phone"&&!!this.cals&&!this.manages()&&!t.can.manage&&!t.can.maintenance;return n`
      ${e?c:this.head()}
      <div class="body" data-cal-body data-view=${this.view}>${this.content(e)}</div>
      ${this.drawer?.kind==="event"&&this.api?n`<cal-event-drawer .ctx=${this.ctx()} .detail=${this.drawer.d} @close=${()=>this.drawer=null}></cal-event-drawer>`:c}
      ${this.drawer?.kind==="maint"&&this.api?n`<cal-maint-drawer .ctx=${this.ctx()} .detail=${this.drawer.d} @close=${()=>this.drawer=null}></cal-maint-drawer>`:c}
      ${this.toastText?n`<div class="toast" role="status" data-cal-toast>${this.toastText}</div>`:c}`}head(){const t=this.floors(),e=we.filter(o=>this.offered(o)),s=Jt(this.route),a=this.device==="phone",i=(this.cals??[]).filter(o=>o.my_role==="manage").reduce((o,r)=>o+r.pending_count,0);return n`
      <div class="top">
        <h1>יומנים</h1><span class="sp"></span>
        ${t.length>1?n`<div class="floors" role="group" aria-label="קומה">
          <button type="button" class="chipb" aria-pressed=${String(this.floor==="")} data-floor="" @click=${()=>this.floor=""}>הכל</button>
          ${t.map(o=>n`<button type="button" class="chipb" aria-pressed=${String(this.floor===o.id)} data-floor=${o.id} @click=${()=>this.floor=o.id}>${o.name}</button>`)}
        </div>`:c}
      </div>
      <div class="bar">
        <nav class="tabs" aria-label="תצוגות היומנים">
          ${e.map(o=>n`<a class="tab" href=${`${s}/${o}${this.demoQuery()}`} aria-current=${this.view===o?"page":"false"} data-cal-tab=${o}>
            ${a?wa[o]:ba[o]}${o==="approvals"&&i?n`<span class="count num">${i>99?"99+":i}</span>`:c}${o==="manage"&&!a?n`<span class="n num">${(this.cals??[]).length}</span>`:c}</a>`)}
        </nav>
        <span class="sp"></span>
        <label class="search"><sw-icon name="search" size="16"></sw-icon><span class="vh">חיפוש ביומנים</span>
          <input type="search" placeholder="חיפוש ביומנים" .value=${this.q} @input=${o=>this.q=o.target.value} data-cal-search></label>
        ${this.newButton()}
      </div>`}demoQuery(){if(Nt())return"";const t=this.route?.params.toString()??"";return t?`?${t}`:""}newButton(){const t=this.access.can;return this.view==="maint"?t.maintenance?n`<button type="button" class="btn pri new" data-cal-new @click=${()=>this.drawer={kind:"maint",d:{}}}><sw-icon name="plus" size="16"></sw-icon>חלון תחזוקה</button>`:c:t.book?n`<button type="button" class="btn pri new" data-cal-new @click=${()=>this.drawer={kind:"event",d:{}}}><sw-icon name="plus" size="16"></sw-icon>חדש</button>`:c}content(t){if(this.error&&!this.cals)return n`<div class="center"><sw-state-panel state="error" data-cal-state="error" heading="לא הצלחנו לטעון את היומנים" hint=${this.error} actionLabel="לנסות שוב"
        @action=${()=>void this.load()}></sw-state-panel></div>`;if(!this.cals||!this.api)return this.slow?this.loadingView():c;const e=this.ctx();if(t)return n`<cal-resident .ctx=${e}></cal-resident>`;if(!this.cals.length&&this.view!=="manage")return n`<div class="center"><sw-state-panel icon="calendar" state="empty" data-cal-state="empty" heading="אין עדיין יומנים"
        hint=${this.access.can.manage?"יומן לכל חדר, צוות, אחזקה או אירועים. אפשר להתחיל מחדר אחד.":"כשיוגדר יומן שיש לך בו הרשאה, הוא יופיע כאן."}
        actionLabel=${this.access.can.manage?"יצירת יומן ראשון":""} @action=${()=>location.hash=`${Jt(this.route)}/manage${this.demoQuery()}`}></sw-state-panel></div>`;switch(this.view){case"rooms":return n`<cal-view-rooms .ctx=${e}></cal-view-rooms>`;case"approvals":return n`<cal-view-approvals .ctx=${e}></cal-view-approvals>`;case"maint":return n`<cal-view-maint .ctx=${e}></cal-view-maint>`;case"manage":return n`<cal-view-manage .ctx=${e}></cal-view-manage>`;default:return n`<cal-view-calendar .ctx=${e}></cal-view-calendar>`}}loadingView(){return this.access.ui.loading_style==="spinner"?n`<div class="center" data-cal-state="loading"><div class="spin" role="status" aria-label="טוען"></div></div>`:n`<div class="loading" data-cal-state="loading" role="status" aria-label="טוען">
      <div class="panel">${Array.from({length:6},(t,e)=>n`<div class="skel" style=${`block-size:${e?64:32}px`}></div>`)}</div>
      <div class="panel side">${Array.from({length:8},()=>n`<div class="skel" style="block-size:22px"></div>`)}</div></div>`}};st.styles=[nt,tt`
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; padding: 14px var(--sw-page-pad) 20px; gap: 14px; overflow: hidden; }
    .top { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; padding-inline-start: var(--sw-lead-reserve, 0px); padding-inline-end: var(--sw-float-reserve, 0px); }
    .top h1 { margin: 0; font-size: var(--sw-h1); font-weight: var(--sw-h1-weight); letter-spacing: var(--sw-h1-tracking); color: var(--sw-heading); line-height: 1.2; }
    .floors { display: flex; gap: 8px; flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; }
    .bar { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; }
    .tabs { display: inline-flex; gap: 2px; padding: 4px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); max-inline-size: 100%; overflow: hidden; }
    .tab { font: inherit; font-size: var(--sw-fs-md); border: 0; background: transparent; color: var(--sw-text-2); padding: 0 14px; min-block-size: 34px; border-radius: var(--sw-r-pill);
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; text-decoration: none; -webkit-tap-highlight-color: transparent; }
    .tab[aria-current='page'] { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-heading)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .tab .n { color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    /* DARK-SEG-ALL-2380: on the dark light pill the count takes the key's dark label (light keeps the muted ink) */
    .tab[aria-current='page'] .n { color: var(--sw-seg-key-ink, var(--sw-text-3)); }
    .search { display: inline-flex; align-items: center; gap: 8px; min-block-size: var(--sw-ctl-h-lg); padding: 0 14px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border);
      background: var(--sw-surface-solid); inline-size: 220px; max-inline-size: 100%; }
    .search input { font: inherit; font-size: var(--sw-fs-md); border: 0; outline: 0; background: transparent; color: var(--sw-text); min-inline-size: 0; flex: 1; }
    .body { flex: 1; min-block-size: 0; display: flex; flex-direction: column; }
    .body > * { flex: 1; min-block-size: 0; }
    .loading { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; flex: 1; min-block-size: 0; }
    .loading .panel { gap: 10px; }
    .center { display: grid; place-items: center; flex: 1; }
    .toast { position: fixed; inset-block-end: 24px; inset-inline-start: 50%; transform: translateX(50%); background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px;
      border-radius: var(--sw-r-pill); font-size: var(--sw-fs-md); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-3); max-inline-size: calc(100vw - 32px); }
    @media (max-width: 1179px) { .loading { grid-template-columns: minmax(0, 1fr); } .loading .side { display: none; } }
    @media (max-width: 699px) {
      :host { padding: 10px var(--sw-page-pad-phone) 10px; gap: 10px; }
      .top h1 { font-size: var(--sw-fs-2xl); }
      .bar { gap: 8px; }
      .tabs { inline-size: 100%; }
      .tab { flex: 1; justify-content: center; padding: 0 6px; font-size: var(--sw-fs-sm); }
      .search { display: none; }
      .new { margin-inline-start: auto; }
      .toast { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom)); }
    }
  `];ht([y({attribute:!1})],st.prototype,"route",2);ht([d()],st.prototype,"access",2);ht([d()],st.prototype,"cals",2);ht([d()],st.prototype,"error",2);ht([d()],st.prototype,"floor",2);ht([d()],st.prototype,"q",2);ht([d()],st.prototype,"floorNames",2);ht([d()],st.prototype,"slow",2);ht([d()],st.prototype,"device",2);ht([d()],st.prototype,"drawer",2);ht([d()],st.prototype,"toastText",2);st=ht([it("calendars-page")],st);export{st as CalendarsPage};
//# sourceMappingURL=cal-page-XZkxQWc1.js.map
