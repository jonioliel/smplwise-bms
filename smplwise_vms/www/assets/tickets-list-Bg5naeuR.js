import{x as H,mf as be,C as ot,D as rt,E as V,F as h,G as p,a as W,S as lt,b as bt,t as m,q as z,e as n,A as c,H as G,mg as Ut,i as ut,R as T,j as R,fi as Re,f as P,mh as F,gG as Fe,w as Ie,bU as st,mi as mt,mj as _t,mk as ve,ml as ye,l as Ue,mm as ge,mn as je,mo as we,mp as Ve,o as $e,av as Lt,mq as Xt,mr as Qt,ms as Ke,mt as Be,u as He,mu as Zt,mv as We,mw as Ge,bv as qt,mx as Ye,Q as Je,d as dt,my as At,mz as ke,mA as te,hC as gt,p as g,y as A,mB as Xe,N as pt,mC as Qe,s as Ze,mD as ts,mE as ee,mF as es,mG as ss,r as is,iW as as}from"./index-DmgaojPZ.js";import{t as B,s as jt,l as N,b as xe,r as ns,a as Rt,p as ht,c as os,N as Et,F as rs,d as se,e as ls,f as cs,g as ds,h as ps,i as hs,j as us,k as ms,m as fs,n as bs}from"./list-filter-row-CTVtJioH.js";import{s as vs,o as ys,m as gs,a as ws}from"./ticket-detail-DexMtpVP.js";import{m as wt,a as U,w as $s,d as Vt}from"./drawer-model-8zMwdY41.js";import{t as ks}from"./settings-styles-BnAj31lC.js";import{i as J,P as Dt,a as u,f as et,u as xs,p as _s,s as Ss,b as Ts,c as Cs}from"./intake-model-QuyiwEhj.js";import{L as _e,b as Ms}from"./tickets-board-CItc1oz-.js";import{E as Os,o as zs,G as Es}from"./overview-model-CHI-HeTe.js";import{B as Ds}from"./board-model-CCz0A-pC.js";import{m as Ns,a as Ps}from"./media-page-D6eZ8pYU.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-BnrL_yQQ.js";import"./geometry-CDTYeH-V.js";const Kt={calGroup:"יומן שבועי",calPrev:"השבוע הקודם",calNext:"השבוע הבא",calPrevDay:"היום הקודם",calNextDay:"היום הבא",calToday:"היום",calTodayJump:"מעבר להיום",calWeekOf:"{from}–{to}",calWeekAria:"שבוע {from} עד {to}",calCount:"{n} אירועים בשבוע",calCountOne:"אירוע אחד בשבוע",calCountNone:"אין אירועים בשבוע זה",calDayCount:"{n} אירועים",calDayEmpty:"אין אירועים",calDayLabel:"{day}, {date}",calDaysStrip:"ימי השבוע",calUnscheduled:"{n} {tickets} ללא מועד",calUnscheduledOne:"{ticket} {f:אחת|m:אחד} ללא מועד",calMore:"עוד {n}",calLoadMore:"טעינת עוד {tickets} לרשימה",calJumpNearest:"מעבר לשבוע הקרוב עם אירועים",calLegend:"מקרא",calSwipeHint:"החלקה ימינה או שמאלה מחליפה יום",calK_visit:"ביקור",calK_ack:"יעד אישור קבלה",calK_stuck:"יעד ללא עדכון",calK_resolve:"יעד סיום",calOpen:"פתיחת {the_ticket} {n}",calEmptyTitle:"אין ביקורים או יעדים בשבוע הזה",calEmptyAll:"אין ביקורים או יעדים ברשימה הזו",calLoadFailed:"היומן לא נטען",calRetry:"ניסיון חוזר",days:["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"],daysShort:["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],months:["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]},Ls={calGroup:"Weekly calendar",calPrev:"Previous week",calNext:"Next week",calPrevDay:"Previous day",calNextDay:"Next day",calToday:"Today",calTodayJump:"Jump to today",calWeekOf:"{from} - {to}",calWeekAria:"Week {from} to {to}",calCount:"{n} events this week",calCountOne:"1 event this week",calCountNone:"No events this week",calDayCount:"{n} events",calDayEmpty:"No events",calDayLabel:"{day}, {date}",calDaysStrip:"Days of the week",calUnscheduled:"{n} {tickets} without a time",calUnscheduledOne:"1 {ticket} without a time",calMore:"{n} more",calLoadMore:"Load more {tickets} into the list",calJumpNearest:"Go to the nearest week with events",calLegend:"Legend",calSwipeHint:"Swipe sideways to change the day",calK_visit:"Visit",calK_ack:"Acknowledge target",calK_stuck:"No-update target",calK_resolve:"Resolve target",calOpen:"Open {the_ticket} {n}",calEmptyTitle:"No visits or targets this week",calEmptyAll:"No visits or targets in this list",calLoadFailed:"The calendar did not load",calRetry:"Try again"},qs={days:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],daysShort:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],months:["January","February","March","April","May","June","July","August","September","October","November","December"]};Object.keys(Kt).filter(t=>!["days","daysShort","months"].includes(t));function As(t,e=H()){return(e==="en"?Ls[t]:void 0)??Kt[t]}function b(t,e){const s=H(),i=be(As(t,s),s);return e?i.replace(/\{(\w+)\}/g,(a,r)=>r in e?String(e[r]):a):i}function ie(t,e,s=H()){return(s==="en"?qs:Kt)[t][e]??""}const I="Asia/Jerusalem",Rs=36e5,Fs=24*Rs,ae=new Map;function Is(t){let e=ae.get(t);return e||(e=new Intl.DateTimeFormat("en-US",{timeZone:t,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}),ae.set(t,e)),e}function Bt(t,e=I){const s={};for(const i of Is(e).formatToParts(new Date(t)))i.type!=="literal"&&(s[i.type]=Number(i.value));return{y:s.year,m:s.month,d:s.day,h:s.hour===24?0:s.hour,min:s.minute,s:s.second}}const St=t=>String(t).padStart(2,"0"),Se=(t,e,s)=>`${t}-${St(e)}-${St(s)}`;function Tt(t,e=I){if(!Number.isFinite(t))return"";const s=Bt(t,e);return Se(s.y,s.m,s.d)}function Ht(t){return[+t.slice(0,4),+t.slice(5,7),+t.slice(8,10)]}function Q(t,e){const[s,i,a]=Ht(t),r=new Date(Date.UTC(s,i-1,a+e));return Se(r.getUTCFullYear(),r.getUTCMonth()+1,r.getUTCDate())}function Te(t){const[e,s,i]=Ht(t);return new Date(Date.UTC(e,s-1,i)).getUTCDay()}function Ce(t){return Q(t,-Te(t))}function Us(t){return Array.from({length:7},(e,s)=>Q(t,s))}function ne(t,e){const s=Bt(t,e);return Date.UTC(s.y,s.m-1,s.d,s.h,s.min,s.s)-Math.floor(t/1e3)*1e3}function Ft(t,e,s,i=I){const[a,r,l]=Ht(t),d=Date.UTC(a,r-1,l,e,s),k=ne(d,i);let S=d-k;const _=ne(S,i);return _!==k&&(S=d-_),S}function js(t,e=I){return{start:Ft(t,0,0,e),end:Ft(Q(t,1),0,0,e)}}function Vs(t,e=I){const s=Bt(t,e);return`${St(s.h)}:${St(s.min)}`}function $t(t=new Date,e=I){return Tt(t.getTime(),e)}function Ks(t,e){return Q(t,7*e)}const Me=["closed","cancelled"],Bs=["done","closed","cancelled"],oe=t=>t?Date.parse(t):NaN;function Oe(t){const e=[],s=oe(t.eta_at);if(!Me.includes(t.status)&&Number.isFinite(s)&&e.push({id:`${t.id}:visit`,kind:"visit",ticket:t,startMs:s,endMs:null}),t.sla&&!Bs.includes(t.status))for(const[i,a]of[["ack",t.sla.ack_due_at],["stuck",t.sla.stuck_due_at],["resolve",t.sla.resolve_due_at]]){const r=oe(a);Number.isFinite(r)&&e.push({id:`${t.id}:${i}`,kind:i,ticket:t,startMs:r,endMs:null})}return e}function Hs(t){return t.flatMap(e=>Oe(e)).sort((e,s)=>e.startMs-s.startMs||e.id.localeCompare(s.id))}function Ws(t){return t.filter(e=>!Me.includes(e.status)&&Oe(e).length===0).length}function Gs(t,e=I){const s=t.endMs!==null&&t.endMs>t.startMs?t.endMs:t.startMs,i=Tt(t.startMs,e),a=s>t.startMs?Tt(s-1,e):i,r=[];for(let l=i;l<=a&&r.length<400;l=Q(l,1)){const d=js(l,e);r.push({day:l,event:t,fromMs:Math.max(t.startMs,d.start),toMs:Math.min(s,d.end),startsHere:l===i,endsHere:l===a})}return r}function Ys(t,e,s=I){const i=Object.fromEntries(e.map(a=>[a,[]]));for(const a of t)for(const r of Gs(a,s))i[r.day]?.push(r);for(const a of e)i[a].sort((r,l)=>r.fromMs-l.fromMs||r.event.id.localeCompare(l.event.id));return i}function Js(t){return new Set(Object.values(t).flatMap(e=>e.map(s=>s.event.id))).size}function Xs(t,e=new Date){if(t.kind==="visit")return"info";const s=t.startMs-e.getTime();return s<0?"bad":s<Fs?"warn":"quiet"}function Qs(t,e,s=I){const i=Ft(e,0,0,s),a=t.find(r=>r.startMs>=i);return a?Ce(Tt(a.startMs,s)):null}function kt(t){return+t.slice(8,10)}function Nt(t){return+t.slice(5,7)}var Zs=Object.defineProperty,ti=Object.getOwnPropertyDescriptor,q=(t,e,s,i)=>{for(var a=i>1?void 0:i?ti(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Zs(e,s,a),a};function ei(t){return t.split(/(\d+\s*[–-]\s*\d+)/).map((e,s)=>s%2?n`<bdi dir="ltr">${e}</bdi>`:e)}let E=class extends W{constructor(){super(...arguments),this.bubbleSkin=new lt(this),this.items=[],this.now=new Date,this.hrefOf=t=>`#/tickets/${t}`,this.roleOf=()=>"manager",this.tz=I,this.hasMore=!1,this.loadingMore=!1,this.openId="",this.anchor="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.phone=this.mq.matches,this.touch=null,this.goToday=()=>{this.anchor=$t(new Date,this.tz)},this.onKey=t=>{const e=t.target;if(!e||!e.closest("[data-cal-nav]")||t.altKey||t.ctrlKey||t.metaKey)return;const s=getComputedStyle(this).direction==="rtl";let i=0;if(t.key==="ArrowRight")i=s?-1:1;else if(t.key==="ArrowLeft")i=s?1:-1;else if(t.key==="PageUp")i=-1;else if(t.key==="PageDown")i=1;else if(t.key==="Home"){t.preventDefault(),this.goToday();return}else return;e.closest(".strip")&&!this.phone||(t.preventDefault(),this.step(i))},this.onTouchStart=t=>{const e=t.touches[0];this.touch=e?{x:e.clientX,y:e.clientY}:null},this.onTouchEnd=t=>{const e=this.touch;this.touch=null;const s=t.changedTouches[0];if(!e||!s)return;const i=s.clientX-e.x,a=s.clientY-e.y;if(Math.abs(i)<48||Math.abs(i)<Math.abs(a)*1.5)return;const r=getComputedStyle(this).direction==="rtl";this.step(i>0===r?1:-1)}}connectedCallback(){super.connectedCallback(),bt(this),this.mq.addEventListener("change",this.onMq),this.phone=this.mq.matches}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}willUpdate(t){this.anchor||(this.anchor=$t(this.now,this.tz))}step(t){this.anchor=this.phone?Q(this.anchor,t):Ks(this.anchor,t)}dateLabel(t){return`${kt(t)} ${ie("months",Nt(t)-1)}`}weekRange(t){const e=Q(t,6);return Nt(t)===Nt(e)?{from:String(kt(t)),to:this.dateLabel(e)}:{from:this.dateLabel(t),to:this.dateLabel(e)}}dayName(t,e=!1){return ie(e?"daysShort":"days",Te(t))}kindIcon(t){return t==="visit"?m("user"):m("clock")}eventCard(t){const e=t.event,s=e.ticket,i=Xs(e,this.now),a=this.roleOf(s),r=vs(s,a,this.now);return n`<li><a class=${`ev tone-${i}`} href=${this.hrefOf(s.id)} data-cal-event=${e.kind} data-cal-tone=${i} data-ticket=${s.id} aria-current=${String(this.openId===s.id)}>
      <span class="top"><time datetime=${new Date(e.startMs).toISOString()}>${Vs(e.startMs,this.tz)}</time><span class="kind">${this.kindIcon(e.kind)}${b(`calK_${e.kind}`)}</span></span>
      <b>${z(`#${s.number} ${s.title}`)}</b>
      <span class="sent" data-cal-sentence title=${r}>${r}</span>
      <ticket-elapsed .item=${s}></ticket-elapsed>
    </a></li>`}dayList(t){return t.length?n`<ul class="evs">${t.map(e=>this.eventCard(e))}</ul>`:n`<span class="none" data-cal-day-empty>${b("calDayEmpty")}</span>`}legend(){const t=[["info",b("calK_visit")],["quiet",b("calK_resolve")],["warn",`${b("calK_resolve")} < 24h`],["bad",`${b("calK_resolve")} !`]];return n`<ul class="leg" aria-label=${b("calLegend")} data-cal-legend>
      ${t.map(([e,s])=>n`<li class=${`tone-${e}`}><i></i>${s}</li>`)}
    </ul>`}render(){const t=this.anchor||$t(this.now,this.tz),e=Ce(t),s=Us(e),i=$t(this.now,this.tz),a=Hs(this.items),r=Ys(a,s,this.tz),l=Js(r),d=Ws(this.items),k=this.weekRange(e),S=l===0?Qs(a,e,this.tz):null,_=l===0,Y=b("calWeekOf",k),zt=l===0?b("calCountNone"):l===1?b("calCountOne"):b("calCount",{n:l}),yt=getComputedStyle(this).direction==="rtl",ct=this.phone?b("calPrevDay"):b("calPrev"),Jt=this.phone?b("calNextDay"):b("calNext");return n`<section class="cal" data-cal data-cal-mode=${this.phone?"day":"week"} aria-label=${b("calGroup")} @keydown=${this.onKey}>
      <div class="bar" data-cal-nav>
        <button type="button" class=${`step prev${yt?"":" flip"}`} data-cal-prev aria-label=${ct} title=${ct} @click=${()=>this.step(-1)}>${m("back")}</button>
        <button type="button" class=${`step next${yt?" flip":""}`} data-cal-next aria-label=${Jt} title=${Jt} @click=${()=>this.step(1)}>${m("back")}</button>
        <h2 data-cal-range aria-live="polite" aria-label=${b("calWeekAria",k)}>${ei(Y)}</h2>
        <button type="button" class="btn sm today" data-cal-today title=${b("calTodayJump")} aria-current=${t===i?"date":c} @click=${this.goToday}>${b("calToday")}</button>
        <span class="grow"></span>
        <span class="cnt" data-cal-count>${zt}</span>
      </div>
      ${this.legend()}
      ${d?n`<p class="note" data-cal-unscheduled>${d===1?b("calUnscheduledOne"):b("calUnscheduled",{n:d})}</p>`:c}
      ${this.phone?this.dayMode(s,r,t,i):this.weekMode(s,r,i)}
      ${_?n`<div class="statebox glass" role="status" data-cal-state="empty"><span class="ring">${m("clock")}</span><b>${this.items.length?b("calEmptyTitle"):b("calEmptyAll")}</b>
        ${S?n`<button type="button" class="btn sm" data-cal-nearest @click=${()=>this.anchor=S}>${b("calJumpNearest")}</button>`:c}</div>`:c}
      ${this.hasMore?n`<div class="more"><button type="button" class="btn" data-cal-more ?disabled=${this.loadingMore} @click=${()=>this.dispatchEvent(new CustomEvent("cal-load-more",{bubbles:!0,composed:!0}))}>${b("calLoadMore")}</button></div>`:c}
    </section>`}weekMode(t,e,s){return n`<div class="week" data-cal-week role="group" aria-label=${b("calDaysStrip")}>
      ${t.map(i=>n`<section class=${`day glass${i===s?" today":""}`} data-cal-day=${i} aria-label=${b("calDayLabel",{day:this.dayName(i),date:this.dateLabel(i)})} aria-current=${i===s?"date":"false"}>
        <div class="dhd"><b>${kt(i)}</b><small>${this.dayName(i,!0)}</small>${e[i].length?n`<span class="n">${e[i].length}</span>`:c}</div>
        ${this.dayList(e[i])}
      </section>`)}
    </div>`}dayMode(t,e,s,i){const a=e[s]??[];return n`<div class="strip" role="group" aria-label=${b("calDaysStrip")} data-cal-nav data-cal-strip>
        ${t.map(r=>n`<button type="button" class=${`dbtn${r===i?" today":""}`} data-cal-pick=${r} aria-pressed=${String(r===s)} aria-label=${b("calDayLabel",{day:this.dayName(r),date:this.dateLabel(r)})}
          @click=${()=>this.anchor=r}><small>${this.dayName(r,!0)}</small><b>${kt(r)}</b>${e[r].length?n`<span class="dot" aria-hidden="true"></span>`:c}</button>`)}
      </div>
      <div class="daybox glass" data-cal-day=${s} @touchstart=${this.onTouchStart} @touchend=${this.onTouchEnd} title=${b("calSwipeHint")}>
        <div class="dayhd"><h3>${b("calDayLabel",{day:this.dayName(s),date:this.dateLabel(s)})}</h3><span class="cnt">${a.length?b("calDayCount",{n:a.length}):""}</span></div>
        ${this.dayList(a)}
      </div>`}};E.styles=[ot,...rt,V`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .cal {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
      min-inline-size: 0;
    }
    .bar h2 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: 700;
      color: var(--dv-text);
      min-inline-size: 0;
      font-variant-numeric: tabular-nums;
    }
    .step {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sw-touch-desktop);
      block-size: var(--sw-touch-desktop);
      padding: 0;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface);
      color: var(--dv-text);
      cursor: pointer;
      font-size: var(--sw-fs-lg);
    }
    .step .ic {
      display: block;
    }
    .step.flip .ic {
      transform: scaleX(-1);
    }
    .step:focus-visible,
    .today:focus-visible,
    .dbtn:focus-visible,
    a.ev:focus-visible {
      outline: 2px solid var(--dv-accent);
      outline-offset: 2px;
    }
    .grow {
      flex: 1;
    }
    .cnt {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .leg {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .leg li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .leg i {
      inline-size: 10px;
      block-size: 10px;
      border-radius: var(--sw-r-pill);
      background: var(--c);
    }
    .tone-info {
      --c: var(--dv-accent);
    }
    .tone-quiet {
      --c: var(--dv-text-3);
    }
    .tone-warn {
      --c: var(--dv-warning);
    }
    .tone-bad {
      --c: var(--dv-danger);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      margin: 0;
    }
    /* ---- the week */
    .week {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
      align-items: start;
    }
    .day {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
      min-block-size: 220px;
      padding: 10px 8px 12px;
      box-sizing: border-box;
      border-radius: var(--sw-r-2xl);
    }
    .day.today {
      border-color: color-mix(in srgb, var(--dv-accent) 50%, transparent);
      box-shadow: var(--dv-shadow-1), 0 0 0 3px var(--dv-accent-soft);
    }
    .dhd {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 0 4px 6px;
      margin-block-end: 4px;
      border-block-end: 1px solid var(--dv-border);
    }
    .dhd b {
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--dv-text);
    }
    .day.today .dhd b {
      color: var(--dv-accent-text);
    }
    .dhd small {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-3);
      font-weight: 600;
    }
    .dhd .n {
      margin-inline-start: auto;
      font-size: var(--sw-fs-xs);
      color: var(--dv-text-3);
      font-weight: 700;
    }
    .none {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-3);
      padding-inline: 4px;
    }
    .evs {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
      min-inline-size: 0;
    }
    a.ev {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      box-sizing: border-box;
      padding: 7px 9px;
      border-radius: var(--sw-r-xl);
      background: var(--dv-surface-2);
      border-inline-start: 3px solid var(--c);
      color: var(--dv-text);
      text-decoration: none;
      cursor: pointer;
      transition: transform 120ms;
    }
    a.ev:hover {
      transform: translateY(-1px);
    }
    /* the bubble skin's xl radius (42 px) would put the time and the clock of a small card in its corners */
    :host([data-skin='bubble']) a.ev {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
    }
    a.ev[aria-current='true'] {
      box-shadow: 0 0 0 2px var(--dv-accent-soft);
      border-color: var(--dv-accent);
    }
    .ev .top {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 2px 8px;
      min-inline-size: 0;
    }
    .ev time {
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--dv-text-2);
    }
    .ev .kind {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--c);
    }
    .ev.tone-quiet .kind {
      color: var(--dv-text-2);
    }
    .ev b {
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .ev .sent {
      font-size: var(--sw-fs-xs);
      line-height: 1.45;
      color: var(--dv-text-2);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .ev ticket-elapsed {
      font-size: var(--sw-fs-xs);
      --sw-elapsed-fs: var(--sw-fs-xs);
      --sw-elapsed-wrap: normal;
      max-inline-size: 100%;
    }
    /* ---- the phone: one day at a time */
    .strip {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }
    .dbtn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      min-block-size: 44px;
      padding: 2px 0;
      border-radius: var(--sw-r-xl);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface);
      color: var(--dv-text);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-sm);
      position: relative;
    }
    .dbtn b {
      font-size: var(--sw-fs-md);
      font-variant-numeric: tabular-nums;
    }
    .dbtn small {
      font-size: var(--sw-fs-xs);
      color: var(--dv-text-3);
    }
    .dbtn[aria-pressed='true'] {
      background: var(--dv-accent-soft);
      border-color: var(--dv-accent);
      color: var(--dv-accent-text);
    }
    .dbtn.today b {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .dbtn .dot {
      position: absolute;
      inset-block-end: 3px;
      inline-size: 5px;
      block-size: 5px;
      border-radius: var(--sw-r-pill);
      background: var(--dv-accent);
    }
    .dayhd {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dayhd h3 {
      margin: 0;
      flex: 1;
      font-size: var(--sw-fs-md);
      font-weight: 700;
      color: var(--dv-text);
      min-inline-size: 0;
    }
    .daybox {
      padding: 10px;
      box-sizing: border-box;
      border-radius: var(--sw-r-2xl);
      touch-action: pan-y;
    }
    .more {
      display: flex;
      justify-content: center;
    }
    @media (max-width: 767px) {
      .step {
        inline-size: 44px;
        block-size: 44px;
      }
      .today {
        min-block-size: 44px;
      }
      /* UXFIX-A11Y-295 (UX audit 2026-10-20, finding 12): the week range wrapped to three lines between the step keys and the count, and
         the controls took ~460 px above the first event. One line for the range (it shrinks with an ellipsis before it wraps), the
         week's count leaves the bar (the day box says the day's count), the legend keeps one line and scrolls sideways if it must. */
      .bar {
        flex-wrap: nowrap;
        gap: 6px;
      }
      .bar h2 {
        flex: 1;
        font-size: var(--sw-fs-md);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
      }
      .bar .grow,
      .bar .cnt {
        display: none;
      }
      .today {
        flex: none;
      }
      .leg {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        gap: 4px 10px;
        white-space: nowrap;
      }
      .leg::-webkit-scrollbar {
        display: none;
      }
      a.ev {
        min-block-size: 44px;
        padding: 9px 11px;
      }
      .ev .sent {
        font-size: var(--sw-fs-sm);
      }
    }
  `];q([h({attribute:!1})],E.prototype,"items",2);q([h({attribute:!1})],E.prototype,"now",2);q([h({attribute:!1})],E.prototype,"hrefOf",2);q([h({attribute:!1})],E.prototype,"roleOf",2);q([h({type:String})],E.prototype,"tz",2);q([h({type:Boolean})],E.prototype,"hasMore",2);q([h({type:Boolean})],E.prototype,"loadingMore",2);q([h({type:String})],E.prototype,"openId",2);q([p()],E.prototype,"anchor",2);q([p()],E.prototype,"phone",2);E=q([G("tickets-calendar")],E);var si=Object.defineProperty,ii=Object.getOwnPropertyDescriptor,tt=(t,e,s,i)=>{for(var a=i>1?void 0:i?ii(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&si(e,s,a),a};let j=class extends W{constructor(){super(...arguments),this.bubbleSkin=new lt(this),this.manager=!1,this.items=[],this.open=!1,this.busy=!1,this.error="",this.pick={},this.timer=0}connectedCallback(){super.connectedCallback(),this.refresh(),this.timer=window.setInterval(()=>void this.refresh(),6e4)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async refresh(){if(!this.manager||!ut()){this.items=[];return}try{this.items=(await wt().inbound()).items}catch{this.items=[]}}async act(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await t();e&&typeof e=="object"&&"events"in e&&this.dispatchEvent(new CustomEvent("ticket-changed",{detail:{ticket:e},bubbles:!0,composed:!0})),await this.refresh(),this.items.length||(this.open=!1)}catch(e){this.error=T(e),e instanceof R&&(e.status===404||e.status===409)&&await this.refresh()}finally{this.busy=!1}}}async claim(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await wt().claim(t);this.items=this.items.map(s=>s.id===t?e:s)}catch(e){this.error=T(e),await this.refresh()}finally{this.busy=!1}}}render(){return this.items.length?n`<button type="button" class="btn sm chipin" data-inbound-chip aria-label=${U("inbChip",{n:this.items.length})} @click=${()=>this.open=!0}>
        ${m("note")}<span class="lbl">${U("inbTitle")}</span><b class="n">${this.items.length}</b></button>
      ${this.open?n`<sw-dialog open heading=${U("inbTitle")} data-dialog="inbound" @close=${()=>this.open=!1}>
        ${this.error?n`<div class="err" role="alert">${this.error}</div>`:c}
        <div class="list">${this.items.map(t=>n`<div class="item" data-inbound=${t.id}>
          <small>${U("inbFrom",{sender:z(t.sender||"-"),when:$s(t.received_at)})}</small>
          ${t.claimed_by_me?n`<div class="txt" data-inbound-text>${t.text??""}</div>
            <div class="row">
              <select class="inp" data-inbound-ticket @change=${e=>this.pick={...this.pick,[t.id]:e.target.value}}>
                ${t.tickets.map(e=>n`<option value=${e.id} ?selected=${(this.pick[t.id]??t.tickets[0]?.id)===e.id}>#${e.number} · ${z(e.title)}</option>`)}
              </select>
              <button type="button" class="btn sm primary" data-inbound-attach ?disabled=${this.busy||!t.tickets.length}
                @click=${()=>void this.act(()=>wt().attach(t.id,this.pick[t.id]??t.tickets[0]?.id??""))}>${m("check")}${U("inbAttach",{number:t.tickets.find(e=>e.id===(this.pick[t.id]??t.tickets[0]?.id))?.number??""})}</button>
              <button type="button" class="btn sm quiet" data-inbound-dismiss ?disabled=${this.busy} @click=${()=>void this.act(()=>wt().dismiss(t.id))}>${m("x")}${U("inbDismiss")}</button>
            </div>`:t.claimed?n`<small data-inbound-claimed>${U("inbClaimedBy",{name:z(t.claimed_by_name??"")})}</small>`:n`<div class="row"><button type="button" class="btn sm" data-inbound-claim ?disabled=${this.busy} @click=${()=>void this.claim(t.id)}>${m("user")}${U("inbClaim")}</button></div>`}
        </div>`)}</div>
        <div slot="footer" class="sheetfoot"><button type="button" class="btn" @click=${()=>this.open=!1}>${U("inbClose")}</button></div>
      </sw-dialog>`:c}`:c}};j.styles=[ot,...rt,Ut,V`
    :host {
      display: contents;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      min-inline-size: min(28rem, 80vw);
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .item .txt {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .item .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1);
      align-items: center;
    }
    .chipin .n {
      font-variant-numeric: tabular-nums;
    }
    /* the list header's phone layout (tickets-list.ts, < 768 px) orders the search row 2: the chip sits there too (the host is
       display: contents, so the button is the header's flex item) */
    @media (max-width: 767px) {
      .chipin {
        order: 2;
      }
    }
    /* a narrow phone keeps that row to one line: the icon and the count (the full words stay in aria-label) */
    @media (max-width: 599px) {
      .chipin .lbl {
        display: none;
      }
    }
  `];tt([h({type:Boolean})],j.prototype,"manager",2);tt([p()],j.prototype,"items",2);tt([p()],j.prototype,"open",2);tt([p()],j.prototype,"busy",2);tt([p()],j.prototype,"error",2);tt([p()],j.prototype,"pick",2);j=tt([G("tickets-inbound-chip")],j);var ai=Object.defineProperty,ni=Object.getOwnPropertyDescriptor,O=(t,e,s,i)=>{for(var a=i>1?void 0:i?ni(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&ai(e,s,a),a};const oi=["not_a_request","duplicate","spam","abusive","out_of_scope","test"],re=["urgent","high","normal","low"];let M=class extends W{constructor(){super(...arguments),this.summary=null,this.open=!1,this.rows=[],this.total=0,this.offset=0,this.draft=null,this.meta=null,this.busy=!1,this.error="",this.ok="",this.mergeNumber="",this.rejectOpen=!1,this.block=!1,this.timer=0}connectedCallback(){super.connectedCallback(),this.refreshSummary(),this.timer=window.setInterval(()=>void this.refreshSummary(),6e4)}disconnectedCallback(){window.clearInterval(this.timer),super.disconnectedCallback()}async refreshSummary(){try{this.summary=await J.summary()}catch{this.summary=null}}async loadPage(t=this.offset){try{const e=await J.drafts(t,Dt);this.rows=e.drafts,this.total=e.total,this.offset=t,!e.drafts.length&&t>0&&await this.loadPage(Math.max(0,t-Dt))}catch(e){this.error=T(e)}}async show(){if(this.open=!0,this.error="",this.ok="",this.draft=null,!this.meta)try{this.meta=await P().meta()}catch{}await this.loadPage(0)}async openDraft(t){this.error="",this.ok="",this.mergeNumber="",this.rejectOpen=!1,this.block=!1;try{this.draft=await J.draft(t)}catch(e){this.error=T(e)}}async run(t){if(!this.busy){this.busy=!0,this.error="";try{this.ok=await t(),this.draft=null,this.rejectOpen=!1,await Promise.all([this.loadPage(),this.refreshSummary()]),this.dispatchEvent(new CustomEvent("ticket-changed",{bubbles:!0,composed:!0}))}catch(e){this.error=e instanceof R&&e.status===409?u("changed"):T(e),e instanceof R&&e.status===409&&(this.draft=null,await this.loadPage())}finally{this.busy=!1}}}async saveEdit(t,e){const s=this.draft;if(!(!s||this.busy||et(s,t)===e)){this.busy=!0,this.error="";try{const i={[t]:e||null};t==="department_id"&&(i.category_id=null),this.draft=await J.edit(s,i)}catch(i){this.error=T(i),await this.openDraft(s.id)}finally{this.busy=!1}}}deptOptions(){return this.meta?.departments??[]}urgencyLabel(t){return u(re.includes(t)?t:"normal")}rowTag(t){return n`<span class="tag" data-tone=${xs(t.urgency)}>${this.urgencyLabel(t.urgency)}</span>`}listView(){const t=_s(this.total,this.offset,this.rows.length);return n`<div class="list" data-intake-list>
      ${this.rows.length?this.rows.map(e=>n`<button type="button" class="item" data-intake-row=${e.id} @click=${()=>void this.openDraft(e.id)}>
        ${this.rowTag(e)}<span class="line" dir="auto">${e.first_line}</span>
        <span class="tag" dir="auto">${e.requester?.name??u("unknownRequester")}</span>
        ${e.message_count>1?n`<span class="tag">${e.message_count} ${u("more")}</span>`:c}</button>`):n`<div class="meta" data-intake-empty>${u("empty")}</div>`}
      ${this.total>Dt?n`<div class="pager"><sw-button size="sm" ?disabled=${t.prev===null} data-intake-prev @click=${()=>t.prev!==null&&void this.loadPage(t.prev)}>${u("prev")}</sw-button>
        <span>${t.from}-${t.to} ${u("of")} ${t.total}</span>
        <sw-button size="sm" ?disabled=${t.next===null} data-intake-next @click=${()=>t.next!==null&&void this.loadPage(t.next)}>${u("next")}</sw-button></div>`:c}
    </div>`}text(t){return n`<div class="msg" dir="auto" data-intake-text>${Ss(t.text,Ts(t)).map(e=>e.hit?n`<mark>${e.text}</mark>`:e.text)}</div>`}detailView(t){const e=et(t,"department_id"),s=this.deptOptions().find(a=>a.id===e)?.categories??[],i=Cs(t.flags);return n`<div data-intake-detail style="display:flex;flex-direction:column;gap:var(--sw-s-3)">
      <div class="meta"><span dir="auto">${t.requester?`${t.requester.name}${t.requester.org?" · "+t.requester.org:""}`:u("unknownRequester")}</span>
        <bdi dir="ltr">${t.requester?.phone_masked??""}</bdi>${t.message_count>1?n`<span>${t.message_count} ${u("more")}</span>`:c}
        ${t.duplicates.ticket_numbers.length||t.duplicates.drafts.length?n`<span data-intake-dup>${u("duplicates")}: ${t.duplicates.ticket_numbers.map(a=>`#${a}`).join(" ")}</span>`:c}</div>
      ${i.length?n`<div class="flags">${i.map(a=>n`<span class="tag" data-tone=${a==="safety"?"danger":"warning"}>${u(a)}</span>`)}</div>`:c}
      ${this.text(t)}
      <div class="grid">
        <label class="f">${u("department")}<select data-intake-field="department_id" .value=${e} @change=${a=>void this.saveEdit("department_id",a.target.value)}>
          <option value="">${u("pickDept")}</option>${this.deptOptions().map(a=>n`<option value=${a.id} ?selected=${a.id===e}>${a.name}</option>`)}</select></label>
        <label class="f">${u("category")}<small>${u(`conf_${t.suggestion.category.confidence}`)}</small>
          <select data-intake-field="category_id" @change=${a=>void this.saveEdit("category_id",a.target.value)}>
          <option value="">${u("none")}</option>${s.map(a=>n`<option value=${a.id} ?selected=${a.id===et(t,"category_id")}>${a.name}</option>`)}</select></label>
        <label class="f">${u("urgency")}<small>${u(`conf_${t.suggestion.urgency.confidence}`)}</small>
          <select data-intake-field="priority_key" @change=${a=>void this.saveEdit("priority_key",a.target.value)}>
          ${re.map(a=>n`<option value=${a} ?selected=${a===et(t,"priority_key")}>${this.urgencyLabel(a)}</option>`)}</select></label>
        <label class="f">${u("place")}<small>${u(`conf_${t.suggestion.place.confidence}`)}</small>
          <input data-intake-field="place_other" maxlength="200" dir="auto" .value=${et(t,"place_other")} @change=${a=>void this.saveEdit("place_other",a.target.value)} /></label>
        <label class="f" style="grid-column: 1 / -1">${u("titleField")}<input data-intake-field="title" maxlength="120" dir="auto" .value=${et(t,"title")}
          @change=${a=>void this.saveEdit("title",a.target.value)} /></label>
      </div>
      ${this.rejectOpen?n`<div class="bar" data-intake-reject-bar>
        ${oi.map(a=>n`<sw-button size="sm" ?disabled=${this.busy} data-intake-reason=${a}
          @click=${()=>void this.run(async()=>(await J.reject(t,a,this.block),u("rejected")))}>${u(`reason_${a}`)}</sw-button>`)}
        <label class="bar"><input type="checkbox" data-intake-block .checked=${this.block} @change=${a=>this.block=a.target.checked} />${u("block")}</label></div>`:c}
      <div class="bar">
        <sw-button variant="primary" ?disabled=${this.busy||!e} data-intake-approve
          @click=${()=>void this.run(async()=>{const a=await J.approve(t);return`${u("approved")} #${a.number}`})}>${u("approve")}</sw-button>
        <input data-intake-merge-number inputmode="numeric" maxlength="7" size="7" placeholder=${u("mergeNumber")} .value=${this.mergeNumber}
          @input=${a=>this.mergeNumber=a.target.value.replace(/\D/g,"")} />
        <sw-button ?disabled=${this.busy||!this.mergeNumber} data-intake-merge @click=${()=>void this.merge(t)}>${u("merge")}</sw-button>
        <sw-button ?disabled=${this.busy} data-intake-reject @click=${()=>this.rejectOpen=!this.rejectOpen}>${u("reject")}</sw-button>
        <sw-button size="sm" data-intake-back @click=${()=>{this.draft=null}}>${u("back")}</sw-button>
      </div>
    </div>`}async merge(t){const e=Number(this.mergeNumber);await this.run(async()=>(await J.merge(t,e),u("merged")))}render(){const t=this.summary;return!t||!t.can||!t.open&&!this.open?c:n`<sw-button size="sm" data-intake-chip @click=${()=>void this.show()}>${u("chip")} <strong>${t.open}</strong></sw-button>
      <sw-dialog ?open=${this.open} wide heading=${u("title")} @close=${()=>{this.open=!1,this.draft=null,this.refreshSummary()}}>
        ${this.error?n`<div class="err" role="alert" data-intake-error>${this.error}</div>`:c}
        ${this.ok?n`<div class="okm" role="status" data-intake-ok>${this.ok}</div>`:c}
        ${this.draft?this.detailView(this.draft):this.listView()}
      </sw-dialog>`}};M.styles=[Re,ks,V`
    :host { display: contents; }
    .chip { display: inline-flex; align-items: center; gap: var(--sw-s-1); }
    .list { display: flex; flex-direction: column; gap: var(--sw-s-2); min-inline-size: min(34rem, 80vw); }
    .item { display: flex; align-items: center; gap: var(--sw-s-2); padding: var(--sw-s-2) var(--sw-s-3); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); background: var(--sw-surface); color: inherit; font: inherit; text-align: start; cursor: pointer; }
    .item:hover { background: var(--sw-surface-2); }
    .item .line { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag { font-size: var(--sw-fs-xs); padding: 1px 8px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); white-space: nowrap; }
    .tag[data-tone='danger'] { color: var(--sw-danger-text); border-color: var(--sw-danger-text); }
    .tag[data-tone='warning'] { color: var(--sw-warning-text); border-color: var(--sw-warning-text); }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-2); font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sw-s-2) var(--sw-s-3); }
    @media (max-width: 560px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .msg { white-space: pre-wrap; overflow-wrap: anywhere; padding: var(--sw-s-2) var(--sw-s-3); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
    .msg mark { background: var(--sw-accent-soft); color: inherit; border-block-end: 2px solid var(--sw-accent-text); }
    label.f { display: flex; flex-direction: column; gap: 2px; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    label.f small { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    label.f input, label.f select { inline-size: 100%; min-inline-size: 0; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); background: var(--sw-surface); color: inherit; font: inherit; }
    .flags { display: flex; flex-wrap: wrap; gap: var(--sw-s-1); }
    .bar { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); align-items: center; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .okm { color: var(--sw-success-text); font-size: var(--sw-fs-sm); }
    .meta { display: flex; flex-wrap: wrap; gap: var(--sw-s-3); font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  `];O([p()],M.prototype,"summary",2);O([p()],M.prototype,"open",2);O([p()],M.prototype,"rows",2);O([p()],M.prototype,"total",2);O([p()],M.prototype,"offset",2);O([p()],M.prototype,"draft",2);O([p()],M.prototype,"meta",2);O([p()],M.prototype,"busy",2);O([p()],M.prototype,"error",2);O([p()],M.prototype,"ok",2);O([p()],M.prototype,"mergeNumber",2);O([p()],M.prototype,"rejectOpen",2);O([p()],M.prototype,"block",2);M=O([G("tickets-intake-chip")],M);const ri={viewsGroup:"תצוגה",view_cards:"כרטיסים",view_table:"טבלה",view_kanban:"קנבן",col_number:"מס׳",col_title:"כותרת",col_department:"מחלקה",col_priority:"עדיפות",col_status:"מצב",col_assignee:"מטפל",col_place:"מיקום",col_device:"התקן",col_created:"פתוחה",col_activity:"עדכון אחרון",col_stuck:"תקיעה",col_sla:"יעד",columns:"עמודות",columnsReset:"איפוס",columnsFitted:"חלק מהעמודות הוסתרו כדי שהטבלה תתאים לרוחב המסך. סמנו עמודה כדי להציג אותה.",moveUp:"הזזה למעלה: {col}",moveDown:"הזזה למטה: {col}",density:"צפיפות",density_comfortable:"רגיל",density_compact:"צפוף",savedViews:"מסננים שמורים",saveCurrent:"שמירת התצוגה הנוכחית",viewName:"שם התצוגה",save:"שמירה",cancel:"ביטול",makeDefault:"קביעה כברירת מחדל: {name}",unsetDefault:"ביטול ברירת המחדל: {name}",deleteView:"מחיקה: {name}",deleteConfirm:"למחוק את {name}?",noViews:"אין מסננים שמורים",viewsFull:"נשמרו 20 תצוגות",viewSaved:"התצוגה נשמרה",viewNameTaken:"כבר יש תצוגה בשם הזה",filters:"סינון",filtersCount:"סינון · {n}",fPriority:"עדיפות",fAssignee:"מטפל",fAssigneeAny:"כולם",fAssigneeNone:"ללא מטפל",fAssigneeMe:"אצלי",fWaiting:"ממתין למנהל",fStuck:"{f:תקועות|m:תקועים}",fCreatedFrom:"נפתח מ־",fCreatedTo:"עד",fClear:"ניקוי הסינון",csv:"CSV",exportTitle:"ייצוא לקובץ CSV",exported:"הקובץ ירד · {n} שורות",exportTooLarge:"יותר מ־5,000 שורות. צמצמו את הסינון",exportRate:"אפשר לייצא פעם בדקה",monthly:"דוח חודשי",monthlyTitle:"ספירה חודשית לפי מחלקה או ספק (CSV)",monthlyFrom:"מתאריך",monthlyTo:"עד תאריך",monthlyByDepartment:"לפי מחלקה",monthlyByVendor:"לפי ספק",monthlyDownload:"הורדה",monthlyRequired:"יש לבחור תאריך התחלה ותאריך סיום",monthlyOrder:"תאריך הסיום לפני תאריך ההתחלה",monthlyTooLong:"הטווח ארוך משנה",monthlyDone:"הדוח ירד · {n} שורות",count:"{n} {tickets}",countOne:"{ticket} {f:אחת|m:אחד}",countMore:"{n}+ {tickets}",keyboardHelp:"חצים למעלה ולמטה עוברים בין השורות, Enter פותח, רווח בוחר, Ctrl+A בוחר את העמוד, Esc מבטל את הבחירה",tableLabel:"טבלת {the_tickets}",selectRow:"בחירת {ticket} {n}",selectPage:"בחירת כל העמוד",sortBy:"מיון לפי {col}",loadMore:"טעינת עוד",unassigned:"ללא מטפל",statusMenu:"שינוי מצב · {status}",assigneeMenu:"שינוי מטפל · {name}",noMoves:"אין מעברים זמינים",noAssignees:"אין במחלקה מי שאפשר לשייך",moveTitle:"מעבר ל{status}",moveReason:"סיבה",confirm:"אישור",required:"חובה",changed:"נשמר",staleReloaded:"{the_ticket} {f:השתנתה|m:השתנה} בינתיים ונטענ{f:ה|m:} מחדש",failed:"הפעולה לא בוצעה",empty:"אין {tickets} להצגה",emptyFiltered:"לא נמצאו {tickets}",loadFailed:"לא ניתן לטעון את {the_tickets}",retry:"נסו שוב",compactList:"רשימת {the_tickets}",t_now:"עכשיו",t_min:"{n} דק׳",t_hours:"{n} ש׳",t_days:"{n} ימים",t_day:"יום",sla_in:"בעוד {t}",sla_over:"חריגה {t}",stuck_unassigned:"ללא מטפל",stuck_unopened:"הקישור לא נפתח",stuck_ack:"לא אושרה קבלה",stuck_stuck:"אין עדכון",stuck_waiting:"ממתין לחלק",stuck_overdue:"חריגה מהיעד",stuckSince:"{kind} · {t}",selected:"{n} {f:נבחרו|m:נבחרו}",clearSelection:"ביטול הבחירה",bulkAssign:"שיוך",bulkRemind:"תזכורת",bulkPriority:"עדיפות",bulkClose:"סגירה",bulkActions:"פעולות על הנבחרים",bulkAssignTitle:"שיוך {n} {tickets}",bulkRemindTitle:"תזכורת למטפלים",bulkRemindText:"תישלח תזכורת למטפל של כל {ticket} {f:שנבחרה|m:שנבחר} ({n})",bulkPriorityTitle:"עדיפות ל־{n} {tickets}",bulkCloseTitle:"סגירת {n} {tickets}",bulkCloseNote:"סיבת הסגירה",bulkGo:"ביצוע",bulkDone:"בוצע ב־{done} מתוך {total}",r_ok:"בוצע",r_unchanged:"ללא שינוי",r_stale:"השתנו בינתיים",r_forbidden:"אין הרשאה",r_invalid_transition:"לא במצב שמאפשר",r_not_found:"לא {f:נמצאו|m:נמצאו}",r_cost_claim_approved:"עם עלות מאושרת (נדרשת הרשאת עלויות)",r_assignee_not_allowed:"המטפל לא שייך למחלקה",r_unavailable:"לא זמין עדיין",r_too_soon:"כבר נשלחה תזכורת בשעה האחרונה",r_invalid:"ערך לא תקין",prio_urgent:"דחופה",prio_high:"גבוהה",prio_normal:"רגילה",prio_low:"נמוכה"},li={viewsGroup:"View",view_cards:"Cards",view_table:"Table",view_kanban:"Kanban",col_number:"No.",col_title:"Title",col_department:"Department",col_priority:"Priority",col_status:"State",col_assignee:"Handler",col_place:"Location",col_device:"Device",col_created:"Open for",col_activity:"Last update",col_stuck:"Stuck",col_sla:"Due",columns:"Columns",columnsReset:"Reset",columnsFitted:"Some columns are hidden so the table fits the screen width. Tick a column to show it.",moveUp:"Move up: {col}",moveDown:"Move down: {col}",density:"Density",density_comfortable:"Comfortable",density_compact:"Compact",savedViews:"Saved filters",saveCurrent:"Save the current view",viewName:"View name",save:"Save",cancel:"Cancel",makeDefault:"Make default: {name}",unsetDefault:"Remove the default: {name}",deleteView:"Delete: {name}",deleteConfirm:"Delete {name}?",noViews:"No saved filters",viewsFull:"20 views saved",viewSaved:"View saved",viewNameTaken:"A view with this name exists",filters:"Filter",filtersCount:"Filter · {n}",fPriority:"Priority",fAssignee:"Handler",fAssigneeAny:"Anyone",fAssigneeNone:"Unassigned",fAssigneeMe:"Mine",fWaiting:"Waiting for a manager",fStuck:"Stuck",fCreatedFrom:"Opened from",fCreatedTo:"To",fClear:"Clear the filter",csv:"CSV",exportTitle:"Export to a CSV file",exported:"File downloaded · {n} rows",exportTooLarge:"More than 5,000 rows. Narrow the filter",exportRate:"One export a minute",monthly:"Monthly report",monthlyTitle:"Monthly counts per department or vendor (CSV)",monthlyFrom:"From",monthlyTo:"To",monthlyByDepartment:"Per department",monthlyByVendor:"Per vendor",monthlyDownload:"Download",monthlyRequired:"Choose a start and an end date",monthlyOrder:"The end date is before the start date",monthlyTooLong:"The range is longer than a year",monthlyDone:"Report downloaded · {n} lines",count:"{n} {tickets}",countOne:"1 {ticket}",countMore:"{n}+ {tickets}",keyboardHelp:"Up and down arrows move between rows, Enter opens, Space selects, Ctrl+A selects the page, Esc clears the selection",tableLabel:"{tickets} table",selectRow:"Select {ticket} {n}",selectPage:"Select the whole page",sortBy:"Sort by {col}",loadMore:"Load more",unassigned:"Unassigned",statusMenu:"Change the state · {status}",assigneeMenu:"Change the handler · {name}",noMoves:"No moves available",noAssignees:"Nobody in the department can be assigned",moveTitle:"Move to {status}",moveReason:"Reason",confirm:"Confirm",required:"Required",changed:"Saved",staleReloaded:"The {ticket} changed meanwhile and was reloaded",failed:"The action was not done",empty:"No {tickets} to show",emptyFiltered:"No {tickets} found",loadFailed:"The {tickets} could not be loaded",retry:"Try again",compactList:"{tickets} list",t_now:"now",t_min:"{n} min",t_hours:"{n} h",t_days:"{n} days",t_day:"1 day",sla_in:"in {t}",sla_over:"overdue {t}",stuck_unassigned:"Unassigned",stuck_unopened:"Link not opened",stuck_ack:"Not acknowledged",stuck_stuck:"No update",stuck_waiting:"Waiting for a part",stuck_overdue:"Overdue",stuckSince:"{kind} · {t}",selected:"{n} selected",clearSelection:"Clear the selection",bulkAssign:"Assign",bulkRemind:"Remind",bulkPriority:"Priority",bulkClose:"Close",bulkActions:"Actions on the selection",bulkAssignTitle:"Assign {n} {tickets}",bulkRemindTitle:"Remind the handlers",bulkRemindText:"A reminder goes to the handler of each selected {ticket} ({n})",bulkPriorityTitle:"Priority for {n} {tickets}",bulkCloseTitle:"Close {n} {tickets}",bulkCloseNote:"Reason for closing",bulkGo:"Apply",bulkDone:"Done on {done} of {total}",r_ok:"Done",r_unchanged:"No change",r_stale:"Changed meanwhile",r_forbidden:"No permission",r_invalid_transition:"Not in a state that allows it",r_not_found:"Not found",r_cost_claim_approved:"With an approved cost (needs the cost permission)",r_assignee_not_allowed:"The handler is not in the department",r_unavailable:"Not available yet",r_too_soon:"A reminder was sent in the last hour",r_invalid:"Invalid value",prio_urgent:"Urgent",prio_high:"High",prio_normal:"Normal",prio_low:"Low"};function ci(t,e=H()){return(e==="en"?li[t]:void 0)??ri[t]}function o(t,e){const s=H(),i=be(ci(t,s),s);return e?i.replace(/\{(\w+)\}/g,(a,r)=>r in e?String(e[r]):a):i}const le=["number","title","department","priority","status","assignee","place","device","created","activity","stuck","sla"],ft=["number","title","department","priority","status","assignee","place","activity"],Wt=["number","title"],Pt=[{key:"activity",dir:"desc"}],ze=2,di=[25,50,100,200],pi=50,Mt=["urgent","high","normal","low"],hi=["cost","cost_status"];let Ot=!1;function ui(t){Ot=t}function Ee(){return Ot}function Gt(){return Ot?[...le,...hi]:le}const mi=new Set(["created","activity","stuck","cost"]),nt={priority:[],assignee:"",stuck:"",waiting:"",created_from:"",created_to:"",cost_status:[]};function at(t){return t==="cost"?F("sCost"):t==="cost_status"?F("colCostStatus"):o(`col_${t}`)}function De(t){if(!Array.isArray(t))return[...ft];const e=[];for(const s of t)Gt().includes(s)&&!e.includes(s)&&e.push(s);return e.length?[...Wt.filter(s=>!e.includes(s)),...e]:[...ft]}function fi(t,e){return Wt.includes(e)?[...t]:t.includes(e)?t.filter(s=>s!==e):[...t,e]}function ce(t,e,s){const i=[...t],a=i.indexOf(e),r=a+s;return a<0||r<0||r>=i.length||([i[a],i[r]]=[i[r],i[a]]),i}function bi(t){return[...t,...Gt().filter(e=>!t.includes(e))].map(e=>({key:e,shown:t.includes(e),required:Wt.includes(e)}))}const Ne={number:76,title:0,department:128,priority:104,status:148,assignee:148,place:156,device:148,created:148,activity:112,stuck:140,sla:120,cost:104,cost_status:128,sentence:260},vi=220,Pe=52,yi=["department","place","priority"];function xt(t,e){return t.reduce((s,i)=>s+(i==="title"?vi:Ne[i]??120),e?Pe:0)}function gi(t){return t.length===ft.length&&t.every((e,s)=>e===ft[s])}function wi(t,e,s,i=[]){const a=[...t];if(e<=0||!gi(t))return a;for(const r of yi){if(xt([...a,...i],s)<=e)break;const l=a.indexOf(r);l>=0&&a.splice(l,1)}return a}function Le(t){if(typeof t!="string"||!t)return[...Pt];const e=[];for(const s of t.split(",")){const[i,a="asc"]=s.trim().split(":");if(!Gt().includes(i)||a!=="asc"&&a!=="desc"||e.some(r=>r.key===i))return[...Pt];e.push({key:i,dir:a})}return e.length&&e.length<=ze?e:[...Pt]}function it(t){return t.map(e=>`${e.key}:${e.dir}`).join(",")}function $i(t,e,s=!1){const i=mi.has(e)?"desc":"asc",a=l=>l==="asc"?"desc":"asc",r=t.findIndex(l=>l.key===e);return s?r>=0?t.map((l,d)=>d===r?{key:e,dir:a(l.dir)}:l):[...t.slice(0,ze-1),{key:e,dir:i}]:r===0?[{key:e,dir:a(t[0].dir)}]:[{key:e,dir:i}]}function ki(t,e){return t[0]?.key!==e?"none":t[0].dir==="asc"?"ascending":"descending"}function xi(t,e){const s=t.findIndex(i=>i.key===e);return s<0?null:{dir:t[s].dir,order:s+1}}function qe(t,e){return{scope:t.scope,status:t.status||"open",department:t.department?[t.department]:[],priority:[...e.priority],assignee:e.assignee,floor:"",area:"",stuck:e.stuck,waiting:e.waiting,created_from:e.created_from,created_to:e.created_to,q:t.q.trim(),cost_status:Ot?[...e.cost_status]:[]}}function de(t,e,s={}){const i={scope:t.scope,status:t.status,department:t.department.join(","),priority:t.priority.join(","),assignee:t.assignee,floor:t.floor,area:t.area,stuck:t.stuck,waiting:t.waiting,created_from:t.created_from,created_to:t.created_to,q:t.q,sort:it(e),cost_status:(t.cost_status??[]).join(",")};s.limit&&(i.limit=String(s.limit)),s.cursor&&(i.cursor=s.cursor),s.columns&&(i.columns=s.columns.join(",")),s.lang&&(i.lang=s.lang);for(const a of Object.keys(i))i[a]===""&&delete i[a];return i}const _i=366;function Si(t,e){const s=/^\d{4}-\d{2}-\d{2}$/;if(!s.test(t)||!s.test(e))return"required";const i=Date.parse(`${t}T00:00:00Z`),a=Date.parse(`${e}T00:00:00Z`);return Number.isNaN(i)||Number.isNaN(a)?"required":i>a?"order":(a-i)/864e5+1>_i?"tooLong":""}function Ti(t,e,s,i){const a={from:t,to:e,group:s};return a.lang=i,a}function It(t){return(t.priority.length?1:0)+(t.cost_status.length?1:0)+(t.assignee?1:0)+(t.stuck?1:0)+(t.waiting?1:0)+(t.created_from||t.created_to?1:0)}function pe(t){const e=t?.limit&&di.includes(t.limit)?t.limit:pi;return{columns:De(t?.columns),sort:Le(t?.sort),density:t?.density==="compact"?"compact":"comfortable",limit:e}}function Ci(t,e,s){const i=qe(t,e),a={scope:i.scope,status:i.status};i.department.length&&(a.department=i.department),i.priority.length&&(a.priority=i.priority);for(const r of["assignee","stuck","waiting","created_from","created_to","q"])i[r]&&(a[r]=i[r]);return{view:"table",filters:a,sort:it(s.sort),columns:[...s.columns],density:s.density}}const he=t=>Array.isArray(t)?t.filter(e=>typeof e=="string"):typeof t=="string"&&t?t.split(","):[],X=t=>typeof t=="string"?t:"";function Mi(t,e){const s=t.filters??{},i=X(s.waiting)==="manager"?"manager":"";return{base:{status:X(s.status)||"open",department:he(s.department)[0]??"",q:X(s.q)},extra:{priority:he(s.priority).filter(a=>Mt.includes(a)),assignee:X(s.assignee),stuck:X(s.stuck),waiting:i,created_from:X(s.created_from),created_to:X(s.created_to),cost_status:[]},layout:{...e,columns:De(t.columns),sort:Le(t.sort),density:t.density==="compact"?"compact":"comfortable"}}}function ue(t,e,s,i){const a=new Set(e),r=s?t.indexOf(s):-1,l=t.indexOf(i);if(l<0)return a;if(r<0)return a.add(i),a;const[d,k]=r<l?[r,l]:[l,r];for(let S=d;S<=k;S++)a.add(t[S]);return a}function me(t,e){const s=new Set(t);return s.has(e)?s.delete(e):s.add(e),s}function Oi(t,e){return t.length&&t.every(s=>e.has(s))?new Set:new Set(t)}function zi(t,e){const s=t.filter(i=>e.has(i)).length;return s===0?"none":s===t.length?"all":"some"}function Ei(t,e,s){if(!s)return null;const i=a=>Math.max(0,Math.min(s-1,a));switch(e){case"ArrowDown":return i(t<0?0:t+1);case"ArrowUp":return i(t<0?0:t-1);case"Home":return 0;case"End":return s-1;case"PageDown":return i(t+10);case"PageUp":return i(t-10);default:return null}}function Ct(t){const e=Math.floor(Math.abs(t)/6e4);if(e<1)return o("t_now");if(e<60)return o("t_min",{n:e});const s=Math.floor(e/60);if(s<24)return o("t_hours",{n:s});const i=Math.floor(s/24);return i===1?o("t_day"):o("t_days",{n:i})}function Di(t,e=new Date){const s=Date.parse(t.created_at);if(Number.isNaN(s))return"";const i=t.closed_at?Date.parse(t.closed_at):e.getTime();return Ct((Number.isNaN(i)?e.getTime():i)-s)}function Ni(t,e=new Date){if(!t)return{text:"",tone:""};const s=Date.parse(t.due_at);if(Number.isNaN(s))return{text:"",tone:""};const i=s-e.getTime();return i<=0||t.overdue?{text:o("sla_over",{t:Ct(i)}),tone:"bad"}:{text:o("sla_in",{t:Ct(i)}),tone:i<36e5?"warn":""}}function Pi(t,e=new Date){if(!t)return"";const s=o(`stuck_${t.kind}`);if(!t.since)return s;const i=Date.parse(t.since);return Number.isNaN(i)?s:o("stuckSince",{kind:s,t:Ct(e.getTime()-i)})}function Li(t){const e=o("bulkDone",{done:t.done,total:t.total}),s=Object.entries(t.counts).filter(([i])=>i!=="ok").map(([i,a])=>`${a} ${o(`r_${i}`)}`).join(" · ");return{head:e,rest:s,tone:t.done===t.total?"ok":"bad"}}function qi(t,e){return new Set(t.results.filter(s=>s.result!=="ok"&&s.result!=="unchanged"&&e.includes(s.id)).map(s=>s.id))}const Ai={cards:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',table:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',kanban:'<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>',columns:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M14.5 4.5v15"/>',density:'<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',chevron:'<path d="m6 9 6 6 6-6"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',arrowUp:'<path d="M12 19V5M6 11l6-6 6 6"/>',arrowDown:'<path d="M12 5v14M6 13l6 6 6-6"/>',download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',bell:'<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',sort:'<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>',filter:'<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',star:'<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',bookmark:'<path d="M6 3.5h12V21l-6-4-6 4z"/>'};function C(t,e=""){return Ie`<svg class=${e?`ic ${e}`:"ic"} viewBox="0 0 24 24" aria-hidden="true">${Fe(Ai[t])}</svg>`}const Yt=V`
  :host {
    display: block;
    min-inline-size: 0;
  }
  .tbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-block-end: 12px;
    min-inline-size: 0;
  }
  .tbar .count {
    color: var(--dv-text-2);
    font-size: var(--sw-fs-base);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .anchor {
    position: relative;
    display: inline-flex;
  }
  .anchor > .pop {
    inset-block-start: calc(100% + 6px);
    inset-inline-start: 0;
    background: var(--sw-menu-surface);
    border-color: var(--sw-menu-border);
  }
  /* a long list scrolls inside the popover (the popover itself never overflows its own box) */
  .anchor > .pop.lst {
    max-block-size: none;
    overflow: visible;
  }
  .pop .plist {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-block-size: min(46vh, 380px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .anchor.end > .pop {
    inset-inline-start: auto;
    inset-inline-end: 0;
  }
  .pop .hd {
    padding: 6px 10px 4px;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .pop label.opt {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    padding-inline: 10px;
    border-radius: var(--sw-r-md);
    font-size: var(--sw-fs-base);
    cursor: pointer;
  }
  .pop label.opt:hover {
    background: var(--dv-surface-3);
  }
  .pop .crow {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pop .crow label.opt {
    flex: 1;
    min-inline-size: 0;
  }
  .pop .crow button.mv {
    inline-size: 36px;
    min-block-size: 36px;
    justify-content: center;
    padding: 0;
  }
  .pop .crow button.mv[disabled] {
    opacity: 0.3;
  }
  .pop input[type='checkbox'],
  .pop input[type='radio'] {
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--dv-accent);
    flex: none;
  }
  .pop .vrow {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pop .vrow > button:first-child {
    flex: 1;
    min-inline-size: 0;
  }
  .pop .vrow > button:first-child span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pop .vrow button.icon {
    inline-size: 40px;
    justify-content: center;
    padding: 0;
  }
  .pop .vrow button.icon[aria-pressed='true'] .ic {
    color: var(--dv-accent-text);
    fill: currentColor;
  }
  .pop .save {
    display: flex;
    gap: 6px;
    padding: 6px;
    align-items: center;
  }
  .pop .save .inp {
    flex: 1;
    min-inline-size: 0;
  }
  .pop .note {
    padding: 4px 10px 8px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .pop .note.err {
    color: var(--dv-danger);
    font-weight: 600;
  }
  .pop .fgrp {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 2px 6px 8px;
  }
  .pop .fgrp .rc {
    min-block-size: 36px;
  }
  .pop .dates {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 2px 6px 8px;
  }
  .pop .dates label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .pop.wide {
    min-inline-size: min(320px, calc(100vw - 32px));
  }
  .rc,
  .pop button.rc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 38px;
    padding-inline: 14px;
    border-radius: 999px;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
  }
  .pop button.rc:hover {
    background: var(--dv-surface-3);
  }
  .rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true']:hover {
    background: var(--dv-text);
    color: var(--dv-surface-solid);
    border-color: transparent;
  }

  /* the table card */
  .tw {
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-2xl);
    box-shadow: var(--dv-shadow-1);
    /* 2.5.5: the height follows the rows (a few rows leave no empty box and no vertical bar); a tall list scrolls inside, the header stays */
    overflow-x: auto;
    overflow-y: auto;
    block-size: auto;
    max-block-size: max(420px, calc(100dvh - 300px));
    overscroll-behavior: contain;
  }
  /* SMALL-UI-BUGS-2343: fixed column widths (the <colgroup> of screens/tickets-table.ts; tickets/table-model.ts COLUMN_WIDTH_PX), the
     title takes the rest; the table's min-inline-size is their sum, so the default set fits 1280 / 1440 and only columns the user adds
     can make it scroll sideways. Long text in a cell ends with an ellipsis, the full text is its tooltip. */
  table.tt {
    inline-size: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--sw-fs-md);
  }
  table.tt thead th {
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
    background: var(--dv-surface-solid);
    text-align: start;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--dv-text-2);
    padding: 8px 12px;
    border-block-end: 1px solid var(--dv-border-strong);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  table.tt th button.sh {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-block-size: 32px;
    padding: 0 2px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  table.tt th[aria-sort='ascending'] button.sh,
  table.tt th[aria-sort='descending'] button.sh,
  table.tt th button.sh.second {
    color: var(--dv-accent-text);
    font-weight: 700;
  }
  table.tt th button.sh small {
    font-size: var(--sw-fs-xs);
    font-variant-numeric: tabular-nums;
  }
  table.tt td {
    min-inline-size: 0;
    overflow: hidden;
    padding: 12px;
    border-block-end: 1px solid var(--dv-border);
    vertical-align: middle;
    color: var(--dv-text);
  }
  table.tt tbody tr:last-child td {
    border-block-end: 0;
  }
  table.tt tbody tr {
    cursor: pointer;
    outline: none;
  }
  table.tt tbody tr:hover td {
    background: var(--dv-surface-2);
  }
  table.tt tbody tr[aria-selected='true'] td {
    background: var(--dv-accent-soft);
  }
  table.tt tbody tr:focus-visible td {
    box-shadow: inset 0 2px 0 var(--dv-focus), inset 0 -2px 0 var(--dv-focus);
  }
  table.tt tbody tr[data-picked] td:first-child {
    box-shadow: inset -3px 0 0 var(--dv-accent);
  }
  :host([data-density='compact']) table.tt td {
    padding-block: 5px;
  }
  :host([data-density='compact']) table.tt .sub {
    display: none;
  }
  th.ck,
  td.ck {
    inline-size: 44px;
    padding-inline: 8px;
  }
  .ckb {
    display: inline-grid;
    place-items: center;
    inline-size: 36px;
    block-size: 36px;
    cursor: pointer;
  }
  .ckb input {
    inline-size: 18px;
    block-size: 18px;
    margin: 0;
    accent-color: var(--dv-accent);
    cursor: pointer;
  }
  .cv {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-inline-size: 100%;
  }
  td.c-title .cv {
    font-weight: 600;
  }
  /* a chip never widens its cell: the sub-state is cut first */
  table.tt td .chip {
    max-inline-size: 100%;
    min-inline-size: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
  table.tt td .chip .subst {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  td .sub {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-inline-size: 100%;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
    margin-block-start: 2px;
  }
  /* TKUI4: the sentence column - what is happening, in the drawer's words; two lines at most */
  td.c-sentence .cv {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
    max-inline-size: 100%;
    color: var(--dv-text);
  }
  :host([data-density='compact']) td.c-sentence .cv {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
  td .chip .subst {
    font-weight: 600;
    opacity: 0.85;
  }
  td.c-number {
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* GATE2342-B: the fixed column (SMALL-UI-BUGS-2343) cut the running clock ("פתוחה 20 ימים 2 ש׳") mid-word without an ellipsis; the
     clock (<ticket-elapsed>, its own shadow root) wraps to a second line instead of being cut */
  td.c-created {
    --sw-elapsed-wrap: normal;
  }
  td.c-created,
  td.c-activity,
  td.c-sla {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  td .bad {
    color: var(--dv-danger);
    font-weight: 600;
  }
  td .warn {
    color: var(--au-warn-text);
    font-weight: 600;
  }
  /* 2.5.5: the status / handler menu is a top-layer popover rendered outside the scroll box (tickets/overlay-menu.ts places it: below or
     above the trigger, its own scroll only when taller than the room) - never a child of the cell, so no ancestor can clip it */
  .pop.ov {
    position: fixed;
    inset: auto;
    margin: 0;
    z-index: 30;
    min-inline-size: 190px;
    max-inline-size: calc(100vw - 16px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--sw-menu-surface);
    border-color: var(--sw-menu-border);
  }
  button.cbtn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button.cbtn .ic.chev {
    flex: none;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
  }
  button.cbtn .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-inline-size: 0;
  }
  .who.none {
    color: var(--dv-text-3);
  }
  .more {
    display: flex;
    justify-content: center;
    padding: 10px;
  }

  /* the bulk bar (replaces the toolbar while rows are selected) */
  .bulk {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--sw-r-2xl);
    /* TKUI4: the bar floats over the rows (sticky at the bottom of the screen), so its fill is opaque under the accent tint */
    background: linear-gradient(var(--dv-accent-soft), var(--dv-accent-soft)), var(--dv-surface-solid);
    border: 1px solid color-mix(in srgb, var(--dv-accent) 35%, transparent);
    box-shadow: var(--dv-shadow-2);
  }
  .bulk .sel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    color: var(--dv-accent-text);
    white-space: nowrap;
  }

  /* the phone: a compact list (number, title, status chip, age); no selection */
  .cl {
    display: flex;
    flex-direction: column;
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-2xl);
    box-shadow: var(--dv-shadow-1);
    overflow: hidden;
  }
  .cl a.ci {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 't s' 'x x' 'm a';
    align-items: center;
    gap: 4px 10px;
    min-block-size: 56px;
    padding: 10px 14px;
    border-block-end: 1px solid var(--dv-border);
    color: inherit;
    text-decoration: none;
  }
  .cl a.ci:last-child {
    border-block-end: 0;
  }
  .cl .ci-t {
    grid-area: t;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: var(--sw-fs-md);
  }
  .cl .ci-m {
    grid-area: m;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .cl .ci-x {
    grid-area: x;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--sw-fs-base);
    line-height: 1.45;
    color: var(--dv-text);
  }
  :host([data-density='compact']) .cl .ci-x {
    display: none;
  }
  .cl .ci-s {
    grid-area: s;
    justify-self: end;
  }
  .cl .ci-a {
    grid-area: a;
    justify-self: end;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  :host([data-density='compact']) .cl a.ci {
    min-block-size: 48px;
    padding-block: 6px;
  }

  /* skeleton rows */
  .sk td {
    padding-block: 14px;
  }
  .sk .skl {
    block-size: 12px;
  }
  .toast {
    margin-block-end: 12px;
  }

  @media (max-width: 767px) {
    .tbar {
      position: relative;
    }
    .tbar .count {
      flex-basis: 100%;
    }
    /* a phone: a popover spans the toolbar (never past the screen's edge) */
    .anchor {
      position: static;
    }
    .anchor > .pop,
    .anchor.end > .pop {
      inset-inline: 0;
      min-inline-size: 0;
    }
  }
  @media (pointer: coarse) {
    table.tt th button.sh,
    button.cbtn {
      min-block-size: 44px;
    }
  }

  /* Bubble: flat, larger radius, no blur (component-level, the skin sheet is at its budget) */
  :host([data-skin='bubble']) .tw,
  :host([data-skin='bubble']) .cl {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: var(--dv-surface-solid);
    border-radius: var(--sw-r-xl);
  }
  :host([data-skin='bubble']) .bulk {
    border-radius: var(--sw-r-xl);
  }
`;var Ri=Object.defineProperty,Fi=Object.getOwnPropertyDescriptor,$=(t,e,s,i)=>{for(var a=i>1?void 0:i?Fi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Ri(e,s,a),a};let y=class extends W{constructor(){super(...arguments),this.bubbleSkin=new lt(this),this.fitted=null,this.extra={...nt},this.meta=null,this.holders=[],this.current=null,this.count=null,this.more=!1,this.phone=!1,this.canExport=!1,this.exporting=!1,this.sentence=!0,this.defaultView="",this.hostFilters=!1,this.pop=null,this.views=null,this.naming=!1,this.name="",this.viewError="",this.confirmDelete="",this.repFrom="",this.repTo="",this.repGroup="department",this.repError="",this.onOutside=t=>{if(!this.pop)return;const e=this.renderRoot.querySelector(`[data-pop="${this.pop}"]`);e&&!t.composedPath().includes(e)&&this.close()},this.onKey=t=>{if(this.pop&&t.key==="Escape"){t.stopPropagation();const e=this.renderRoot.querySelector(`[data-open="${this.pop}"]`);this.close(),e?.focus()}}}connectedCallback(){super.connectedCallback(),bt(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey)}close(){this.pop=null,this.naming=!1,this.viewError="",this.confirmDelete=""}open(t){if(this.pop===t){this.close();return}this.close(),this.pop=t,t==="views"&&this.loadViews(),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-pop="${t}"] input, [data-pop="${t}"] button`)?.focus())}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}setLayout(t){const e={...this.layout,...t};this.emit("layout-change",{layout:e})}setExtra(t){this.emit("extra-change",{extra:{...this.extra,...t}})}async loadViews(){try{this.views=(await B().views()).items}catch(t){this.views=[],this.viewError=T(t)}}async saveView(){const t=this.name.trim();if(!t||!this.current){this.viewError=o("required");return}try{const e=await B().createView(t,this.current);this.views=[...this.views??[],e].sort((s,i)=>s.name.localeCompare(i.name)),this.naming=!1,this.name="",this.viewError=""}catch(e){this.viewError=e instanceof R&&e.body.code==="view_name_taken"?o("viewNameTaken"):e instanceof R&&e.body.code==="too_many_views"?o("viewsFull"):T(e)}}async deleteView(t){if(this.confirmDelete!==t.id){this.confirmDelete=t.id;return}try{await B().deleteView(t.id),this.views=(this.views??[]).filter(e=>e.id!==t.id),this.defaultView===t.id&&await this.setDefault(null)}catch(e){this.viewError=T(e)}this.confirmDelete=""}async setDefault(t){await jt({default_view:t??void 0}),this.defaultView=t??"",this.emit("default-view",{id:t})}columnsPop(){const t=this.fitted??this.layout.columns,e=bi(t),s=t.length<this.layout.columns.length;return n`<div class="pop lst" role="dialog" aria-label=${o("columns")} data-pop="columns">
      <div class="hd">${o("columns")}</div>
      ${s?n`<p class="note" data-cols-fitted>${o("columnsFitted")}</p>`:c}
      <div class="plist"><div class="crow" data-col="sentence">
          <label class="opt"><input type="checkbox" .checked=${this.sentence} data-col-sentence
            @change=${i=>this.emit("sentence-change",{on:i.target.checked})} />${N("ltSentence")}</label>
        </div>${e.map(i=>{const a=t.indexOf(i.key);return n`<div class="crow" data-col=${i.key}>
          <label class="opt"><input type="checkbox" .checked=${i.shown} ?disabled=${i.required} data-col-toggle=${i.key}
            @change=${()=>this.setLayout({columns:fi(t,i.key)})} />${at(i.key)}</label>
          ${i.shown?n`<button type="button" class="btn quiet sm mv" aria-label=${o("moveUp",{col:at(i.key)})} ?disabled=${a<=0} data-col-up=${i.key}
              @click=${()=>this.setLayout({columns:ce(t,i.key,-1)})}>${C("up")}</button>
            <button type="button" class="btn quiet sm mv" aria-label=${o("moveDown",{col:at(i.key)})} ?disabled=${a>=t.length-1} data-col-down=${i.key}
              @click=${()=>this.setLayout({columns:ce(t,i.key,1)})}>${C("down")}</button>`:c}
        </div>`})}</div>
      <hr />
      <button type="button" data-col-reset @click=${()=>this.setLayout({columns:[...ft]})}>${m("refresh")}${o("columnsReset")}</button>
    </div>`}viewsPop(){const t=this.views;return n`<div class="pop wide lst" role="dialog" aria-label=${o("savedViews")} data-pop="views">
      <div class="hd">${o("savedViews")}</div>
      <div class="plist">${t===null?n`<span class="skl" style="block-size:44px"></span>`:t.length?t.map(e=>n`<div class="vrow" data-view=${e.id}>
          <button type="button" data-view-apply=${e.id} @click=${()=>{this.close(),this.emit("view-apply",{view:e})}}>${C("bookmark")}<span>${e.name}</span></button>
          <button type="button" class="icon" aria-pressed=${String(this.defaultView===e.id)} data-view-default=${e.id}
            aria-label=${this.defaultView===e.id?o("unsetDefault",{name:e.name}):o("makeDefault",{name:e.name})}
            @click=${()=>void this.setDefault(this.defaultView===e.id?null:e.id)}>${C("star")}</button>
          <button type="button" class="icon" data-view-delete=${e.id} aria-label=${this.confirmDelete===e.id?o("deleteConfirm",{name:e.name}):o("deleteView",{name:e.name})}
            @click=${()=>void this.deleteView(e)}>${this.confirmDelete===e.id?m("check"):m("trash")}</button>
        </div>`):n`<div class="note" data-views-empty>${o("noViews")}</div>`}</div>
      <hr />
      ${this.naming?n`<div class="save">
          <label class="vh" for="vname">${o("viewName")}</label>
          <input id="vname" class="inp" maxlength="60" data-view-name .value=${this.name} placeholder=${o("viewName")}
            @input=${e=>{this.name=e.target.value,this.viewError=""}}
            @keydown=${e=>{e.key==="Enter"&&this.saveView()}} />
          <button type="button" class="btn primary sm" data-view-save @click=${()=>void this.saveView()}>${o("save")}</button>
        </div>`:n`<button type="button" data-view-new ?disabled=${(t?.length??0)>=20} @click=${()=>{this.naming=!0,this.updateComplete.then(()=>this.renderRoot.querySelector("[data-view-name]")?.focus())}}>${m("plus")}${o("saveCurrent")}</button>`}
      ${this.viewError?n`<div class="note err" role="alert" data-view-error>${this.viewError}</div>`:c}
    </div>`}reportPop(){const t=()=>{const s=Si(this.repFrom,this.repTo);this.repError=s?o(s==="required"?"monthlyRequired":s==="order"?"monthlyOrder":"monthlyTooLong"):"",s||(this.emit("monthly-report",{from:this.repFrom,to:this.repTo,group:this.repGroup}),this.close())},e=(s,i)=>n`<button type="button" class="rc" aria-pressed=${String(this.repGroup===s)} data-rep-group=${s} @click=${()=>this.repGroup=s}>${i}</button>`;return n`<div class="pop" role="dialog" aria-label=${o("monthlyTitle")} data-pop="report">
      <div class="dates">
        <label>${o("monthlyFrom")}<input class="inp" type="date" lang=${st()} required data-rep-from .value=${this.repFrom} @change=${s=>this.repFrom=s.target.value} /></label>
        <label>${o("monthlyTo")}<input class="inp" type="date" lang=${st()} required data-rep-to .value=${this.repTo} @change=${s=>this.repTo=s.target.value} /></label>
      </div>
      <div class="fgrp">${e("department",o("monthlyByDepartment"))}${e("vendor",o("monthlyByVendor"))}</div>
      ${this.repError?n`<div class="hd" role="alert" data-rep-error>${this.repError}</div>`:c}
      <button type="button" class="btn sm" data-rep-go @click=${t}>${C("download")}${o("monthlyDownload")}</button>
    </div>`}filtersPop(){const t=this.extra,e=i=>this.meta?.departments[0]?.priorities.find(a=>a.key===i)?.name??o(`prio_${i}`),s=(i,a)=>n`<button type="button" class="rc" aria-pressed=${String(t.assignee===i)} data-f-assignee=${i||"any"} @click=${()=>this.setExtra({assignee:i})}>${a}</button>`;return n`<div class="pop wide lst" role="dialog" aria-label=${o("filters")} data-pop="filters">
      <div class="plist">
      <div class="hd">${o("fPriority")}</div>
      <div class="fgrp">${Mt.map(i=>n`<button type="button" class="rc" aria-pressed=${String(t.priority.includes(i))} data-f-priority=${i}
        @click=${()=>this.setExtra({priority:t.priority.includes(i)?t.priority.filter(a=>a!==i):[...t.priority,i]})}>${e(i)}</button>`)}</div>
      <div class="hd">${o("fAssignee")}</div>
      <div class="fgrp">${s("",o("fAssigneeAny"))}${s("none",o("fAssigneeNone"))}${s("me",o("fAssigneeMe"))}</div>
      ${this.holders.length?n`<div class="fgrp" data-f-holders>${this.holders.map(i=>s(i.key,i.name))}</div>`:c}
      <div class="fgrp">
        <button type="button" class="rc" aria-pressed=${String(t.waiting==="manager")} data-f-waiting @click=${()=>this.setExtra({waiting:t.waiting?"":"manager"})}>${o("fWaiting")}</button>
        <button type="button" class="rc" aria-pressed=${String(t.stuck==="any")} data-f-stuck @click=${()=>this.setExtra({stuck:t.stuck?"":"any"})}>${o("fStuck")}</button>
      </div>
      ${Ee()?n`<div class="hd">${F("colCostStatus")}</div>
      <div class="fgrp">${ve.map(i=>n`<button type="button" class="rc" aria-pressed=${String(t.cost_status.includes(i))} data-f-cost-status=${i}
        @click=${()=>this.setExtra({cost_status:t.cost_status.includes(i)?t.cost_status.filter(a=>a!==i):[...t.cost_status,i]})}>${F(`cs_${i}`)}</button>`)}</div>`:c}
      <div class="dates">
        <label>${o("fCreatedFrom")}<input class="inp" type="datetime-local" lang=${st()} data-f-from .value=${mt(t.created_from)} @change=${i=>this.setExtra({created_from:_t(i.target.value)})} /></label>
        <label>${o("fCreatedTo")}<input class="inp" type="datetime-local" lang=${st()} data-f-to .value=${mt(t.created_to)} @change=${i=>this.setExtra({created_to:_t(i.target.value)})} /></label>
      </div>
      </div>
      <hr />
      <button type="button" data-f-clear ?disabled=${!It(t)} @click=${()=>this.setExtra({...nt})}>${m("x")}${o("fClear")}</button>
    </div>`}render(){if(!this.layout)return c;const t=It(this.extra),e=this.layout.density==="compact";return n`<div class="tbar" role="toolbar" aria-label=${o("tableLabel")} data-table-toolbar>
      ${this.phone?c:n`<span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="columns")} data-open="columns" @click=${()=>this.open("columns")}>${C("columns")}${o("columns")}</button>
        ${this.pop==="columns"?this.columnsPop():c}
      </span>`}
      <span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="views")} data-open="views" @click=${()=>this.open("views")}>${C("bookmark")}${o("savedViews")}${C("chevron")}</button>
        ${this.pop==="views"?this.viewsPop():c}
      </span>
      ${this.hostFilters?c:n`<span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="filters")} data-open="filters" @click=${()=>this.open("filters")}>${C("filter")}${t?o("filtersCount",{n:t}):o("filters")}</button>
        ${this.pop==="filters"?this.filtersPop():c}
      </span>`}
      <button type="button" class="btn sm" aria-pressed=${String(e)} data-density=${this.layout.density} aria-label=${`${o("density")}: ${o(e?"density_compact":"density_comfortable")}`}
        @click=${()=>this.setLayout({density:e?"comfortable":"compact"})}>${C("density")}${o(e?"density_compact":"density_comfortable")}</button>
      <span class="grow"></span>
      ${this.count!==null?n`<span class="count" data-table-count>${o(this.more?"countMore":this.count===1?"countOne":"count",{n:this.count})}</span>`:c}
      ${this.canExport?n`<span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="report")} data-open="report" aria-label=${o("monthlyTitle")} @click=${()=>this.open("report")}>${C("download")}${o("monthly")}</button>
        ${this.pop==="report"?this.reportPop():c}
      </span>`:c}
      ${this.canExport?n`<button type="button" class="btn sm" data-export ?disabled=${this.exporting} aria-label=${o("exportTitle")} @click=${()=>this.emit("export-csv",{})}>${C("download")}${o("csv")}</button>`:c}
    </div>`}};y.styles=[ot,...rt,Yt];$([h({attribute:!1})],y.prototype,"layout",2);$([h({attribute:!1})],y.prototype,"fitted",2);$([h({attribute:!1})],y.prototype,"extra",2);$([h({attribute:!1})],y.prototype,"meta",2);$([h({attribute:!1})],y.prototype,"holders",2);$([h({attribute:!1})],y.prototype,"current",2);$([h({type:Number})],y.prototype,"count",2);$([h({type:Boolean})],y.prototype,"more",2);$([h({type:Boolean})],y.prototype,"phone",2);$([h({type:Boolean})],y.prototype,"canExport",2);$([h({type:Boolean})],y.prototype,"exporting",2);$([h({type:Boolean})],y.prototype,"sentence",2);$([h()],y.prototype,"defaultView",2);$([h({type:Boolean})],y.prototype,"hostFilters",2);$([p()],y.prototype,"pop",2);$([p()],y.prototype,"views",2);$([p()],y.prototype,"naming",2);$([p()],y.prototype,"name",2);$([p()],y.prototype,"viewError",2);$([p()],y.prototype,"confirmDelete",2);$([p()],y.prototype,"repFrom",2);$([p()],y.prototype,"repTo",2);$([p()],y.prototype,"repGroup",2);$([p()],y.prototype,"repError",2);y=$([G("tickets-table-toolbar")],y);var Ii=Object.defineProperty,Ui=Object.getOwnPropertyDescriptor,K=(t,e,s,i)=>{for(var a=i>1?void 0:i?Ui(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Ii(e,s,a),a};let L=class extends W{constructor(){super(...arguments),this.bubbleSkin=new lt(this),this.rows=[],this.meta=null,this.dialog=null,this.eligible=null,this.pick="",this.note="",this.error="",this.busy=!1}connectedCallback(){super.connectedCallback(),bt(this)}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}get mayDelete(){return!ut()||Ue("tickets.delete")}open(t){this.dialog=t,this.error="",this.pick=t==="priority"?"urgent":"",this.note="",t==="assign"&&this.loadEligible()}async loadEligible(){this.eligible=null;const t=[...new Set(this.rows.map(e=>e.department?.id).filter(e=>!!e))];try{const e=await Promise.all(t.map(s=>P().assignees(s).then(ge).catch(()=>[])));this.eligible=je(e)}catch(e){this.eligible=[],this.error=T(e)}}async run(){const t=this.dialog;if(!t||t==="delete"||t==="assign"&&!this.pick)return;if(t==="close"&&!this.note.trim()){this.error=o("required");return}const e=(this.eligible??[]).find(i=>i.key===this.pick),s=t==="assign"&&e?{assignee:we(e)}:t==="priority"?{priority_key:this.pick}:t==="close"?{note:this.note.trim()}:{};this.busy=!0;try{const i=await B().bulk({action:t,items:this.rows.map(a=>({id:a.id,revision:a.revision})),params:s,client_request_id:Ve()});this.dialog=null,this.emit("bulk-done",{answer:i})}catch(i){this.error=T(i)}finally{this.busy=!1}}dialogBody(t){const e=this.rows.length,s=this.error?n`<div class="err" role="alert" data-bulk-error>${this.error}</div>`:c;if(t==="assign")return n`<div class="form">${this.eligible===null?n`<span class="skl" style="block-size:44px"></span>`:this.eligible.length?n`<div class="pick" role="radiogroup" aria-label=${o("fAssignee")}>${this.eligible.map(i=>n`<label data-bulk-eligible=${i.id} data-handler=${i.key}><input type="radio" name="basg" .checked=${this.pick===i.key} @change=${()=>{this.pick=i.key,this.error=""}} />${z(i.name)}</label>`)}</div>`:n`<div class="muted" data-bulk-eligible-none>${o("noAssignees")}</div>`}${s}</div>`;if(t==="priority"){const i=a=>this.meta?.departments[0]?.priorities.find(r=>r.key===a)?.name??o(`prio_${a}`);return n`<div class="form"><div class="prio" role="radiogroup" aria-label=${o("bulkPriority")}>${Mt.map(a=>n`<button type="button" class="rc" role="radio" aria-checked=${String(this.pick===a)} data-bulk-priority=${a} @click=${()=>this.pick=a}>${i(a)}</button>`)}</div>${s}</div>`}return t==="close"?n`<div class="form"><label class="fld"><span>${o("bulkCloseNote")} <b class="req">*</b></span>
        <textarea class="inp" maxlength="2000" data-bulk-note .value=${this.note} @input=${i=>{this.note=i.target.value,this.error=""}}></textarea></label>${s}</div>`:n`<div class="form"><div class="muted" data-bulk-remind-text>${o("bulkRemindText",{n:e})}</div>${s}</div>`}dialogEl(){const t=this.dialog;if(!t)return c;if(t==="delete")return n`<tickets-delete-dialog open .targets=${this.rows.map(a=>({id:a.id,number:a.number}))} @delete-close=${()=>this.dialog=null}
        @bulk-done=${()=>this.dialog=null}></tickets-delete-dialog>`;const e=this.rows.length,s=t==="assign"?o("bulkAssignTitle",{n:e}):t==="priority"?o("bulkPriorityTitle",{n:e}):t==="close"?o("bulkCloseTitle",{n:e}):o("bulkRemindTitle"),i=this.busy||t==="assign"&&!this.pick;return n`<sw-dialog open heading=${s} data-bulk-dialog=${t} @close=${()=>{this.busy||(this.dialog=null)}}>
      ${this.dialogBody(t)}
      <div slot="footer" class="sheetfoot">
        <button type="button" class=${`btn ${t==="close"?"danger":"primary"}`} data-bulk-go ?disabled=${i} @click=${()=>void this.run()}>${o("bulkGo")}</button>
        <button type="button" class="btn" data-bulk-cancel @click=${()=>this.dialog=null}>${o("cancel")}</button>
      </div>
    </sw-dialog>`}render(){const t=this.rows.length,e=[["assign",m("user"),o("bulkAssign")],["remind",C("bell"),o("bulkRemind")],["priority",C("sort"),o("bulkPriority")],["close",m("lock"),o("bulkClose")]];return n`<div class="bulk" role="toolbar" aria-label=${o("bulkActions")} data-bulk-bar>
      <span class="sel" data-bulk-count>${m("check")}${o("selected",{n:t})}</span>
      ${e.map(([s,i,a])=>n`<button type="button" class="btn sm" data-bulk=${s} @click=${()=>this.open(s)}>${i}${a}</button>`)}
      ${this.mayDelete?n`<button type="button" class="btn sm dz" data-bulk="delete" @click=${()=>this.open("delete")}>${m("trash")}${Vt("bulkAction")}</button>`:c}
      <span class="grow"></span>
      <button type="button" class="btn sm quiet" data-bulk-clear @click=${()=>this.emit("bulk-clear",{})}>${m("x")}${o("clearSelection")}</button>
    </div>
    ${this.dialogEl()}`}};L.styles=[ot,...rt,Ut,ye,Yt,V`
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .bulk .btn {
      background: var(--dv-surface-solid);
    }
  `];K([h({attribute:!1})],L.prototype,"rows",2);K([h({attribute:!1})],L.prototype,"meta",2);K([p()],L.prototype,"dialog",2);K([p()],L.prototype,"eligible",2);K([p()],L.prototype,"pick",2);K([p()],L.prototype,"note",2);K([p()],L.prototype,"error",2);K([p()],L.prototype,"busy",2);L=K([G("tickets-table-bulk")],L);const Ae="sw.tickets.table.sentence";function ji(){try{return window.localStorage.getItem(Ae)!=="0"}catch{return!0}}function Vi(t){try{window.localStorage.setItem(Ae,t?"1":"0")}catch{}}var Ki=Object.defineProperty,Bi=Object.getOwnPropertyDescriptor,v=(t,e,s,i)=>{for(var a=i>1?void 0:i?Bi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Ki(e,s,a),a};let f=class extends W{constructor(){super(...arguments),this.bubbleSkin=new lt(this),this.scope="mine",this.base={status:"open",department:"",q:""},this.meta=null,this.hrefOf=t=>`#/tickets/${t}`,this.picked="",this.density="comfortable",this.fill=!1,this.rows=null,this.next=null,this.screen="loading",this.failed="",this.loadingMore=!1,this.layout=pe(null),this.extra={...nt},this.hostFilters=!1,this.selected=new Set,this.focusIdx=-1,this.menu=null,this.eligible=null,this.move=null,this.moveNote="",this.moveError="",this.busy=!1,this.toast=null,this.phone=window.matchMedia("(max-width: 767px)").matches,this.now=new Date,this.exporting=!1,this.defaultView="",this.sentenceOn=ji(),this.anchor=null,this.seq=0,this.pages=0,this.key="",this.booted=!1,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>{this.phone=this.phoneMq.matches,this.phone&&(this.menu=null)},this.fitWidth=0,this.fitObs=new ResizeObserver(([t])=>{const e=Math.floor(t?.contentRect.width??0)-2;Math.abs(e-this.fitWidth)>=1&&(this.fitWidth=e)}),this.live=new _e(()=>this.tick()),this.toastTimer=0,this.offNames=null,this.placeMenu=()=>{if(!this.menu)return;const t=this.renderRoot.querySelector(".pop[data-overlay]"),e=this.renderRoot.querySelector(`[data-menu-for="${this.menu.kind}:${this.menu.id}"]`);t&&e&&ys(t,e)},this.onMenuKey=t=>{if(t.key==="Escape"){t.stopPropagation();const e=this.menu?this.renderRoot.querySelector(`[data-menu-for="${this.menu.kind}:${this.menu.id}"]`):null;this.menu=null,e?.focus();return}if(t.key==="Tab"){this.menu=null;return}gs(t,t.currentTarget)},this.holdersKey="",this.onKey=t=>{const e=this.rows??[],s=t.composedPath().some(l=>l instanceof HTMLElement&&l.matches("input, textarea, select, .pop"));if(t.key==="/"&&!s){const l=this.getRootNode().querySelector?.("input[data-search]");l&&(t.preventDefault(),l.focus());return}if(t.key==="Escape"){this.menu?(this.menu=null,t.stopPropagation()):this.selected.size&&(this.selected=new Set,t.stopPropagation());return}if(s)return;if((t.key==="a"||t.key==="A")&&(t.ctrlKey||t.metaKey)&&this.canSelect()){t.preventDefault(),this.selected=new Set(this.ids());return}const i=t.composedPath().find(l=>l instanceof HTMLElement&&l.matches("tbody tr")),a=!!i&&t.target===i,r=Ei(this.focusIdx,t.key,e.length);if(r!==null&&(a||t.composedPath().some(l=>l instanceof HTMLElement&&l.matches("table")))){t.preventDefault(),this.focusRow(r);return}if(!(!a||this.focusIdx<0||!e[this.focusIdx])){if(t.key==="Enter")t.preventDefault(),this.open(e[this.focusIdx].id);else if(t.key===" "&&this.canSelect()){t.preventDefault();const l=e[this.focusIdx].id;this.selected=t.shiftKey?ue(this.ids(),this.selected,this.anchor,l):me(this.selected,l),this.anchor=l}}},this.onOutside=t=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop[data-overlay]"),s=this.renderRoot.querySelector(`[data-menu-for="${this.menu.kind}:${this.menu.id}"]`),i=t.composedPath();e&&i.includes(e)||s&&i.includes(s)||(this.menu=null)},this.onOneDeleted=t=>{this.say(Vt("deletedOne")),this.dropTicket(t.detail?.id??"")},this.onBulkDone=t=>{const e=t.detail.answer,s=Li(e);if(this.say(s.head,s.rest||void 0,s.tone),e.action==="delete"&&this.rows){const i=new Set(e.results.filter(a=>a.result==="ok"||a.result==="not_found").map(a=>a.id));this.rows=this.rows.filter(a=>!i.has(a.id))}this.selected=qi(e,this.ids()),this.load(!1,!0)},this.onSentenceToggle=t=>{this.sentenceOn=t.detail.on,Vi(t.detail.on)}}connectedCallback(){super.connectedCallback(),bt(this),this.phoneMq.addEventListener("change",this.onPhone),this.offNames=$e(()=>this.requestUpdate()),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("resize",this.placeMenu),window.addEventListener("scroll",this.placeMenu,!0),this.fitObs.observe(this),this.live.start(),ui(!ut()||Lt("tickets.costs.view")),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.offNames?.(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("resize",this.placeMenu),window.removeEventListener("scroll",this.placeMenu,!0),this.fitObs.disconnect(),this.live.stop(),window.clearTimeout(this.toastTimer)}updated(t){this.placeMenu(),t.has("rows")&&this.tellHolders()}willUpdate(t){this.booted&&(t.has("scope")||t.has("base")||t.has("extra"))&&this.reloadIfNeeded()}tellHolders(){const t=Xt(this.rows??[]),e=t.map(s=>`${s.key}=${s.name}`).join("|");e!==this.holdersKey&&(this.holdersKey=e,this.dispatchEvent(new CustomEvent("table-holders",{detail:{holders:t},bubbles:!0,composed:!0})))}tellExtra(){this.dispatchEvent(new CustomEvent("table-extra",{detail:{extra:this.extra},bubbles:!0,composed:!0}))}async boot(){const t=await xe();if(this.layout=pe(t),this.density=this.layout.density,t.default_view){this.defaultView=t.default_view;try{const e=(await B().views()).items.find(s=>s.id===t.default_view);if(e){this.booted=!0,this.applySaved(e);return}}catch{}}this.booted=!0,this.reloadIfNeeded(!0)}filters(){return qe({scope:this.scope,...this.base},this.extra)}reloadIfNeeded(t=!1){const e=JSON.stringify([this.filters(),it(this.layout.sort),this.layout.limit]);!t&&e===this.key||(this.key=e,this.load(!1))}async load(t,e=!1){const s=++this.seq;t?this.loadingMore=!0:e||(this.screen="loading",this.rows=null,this.focusIdx=-1);try{const i=await B().page(de(this.filters(),this.layout.sort,{limit:this.layout.limit,cursor:t?this.next:null}));if(s!==this.seq)return;const a=t?this.rows??[]:[],r=new Set(a.map(d=>d.id));this.rows=[...a,...i.items.filter(d=>!r.has(d.id))],this.next=i.next_cursor,this.pages=t?this.pages+1:1;const l=new Set(this.rows.map(d=>d.id));[...this.selected].some(d=>!l.has(d))&&(this.selected=new Set([...this.selected].filter(d=>l.has(d)))),this.screen="ready",i.next_cursor&&i.items.length<Math.min(10,this.layout.limit)&&!e&&this.load(!0)}catch(i){if(s!==this.seq)return;!t&&!e?(this.failed=T(i),this.screen="error"):e||this.say(T(i),void 0,"bad")}finally{s===this.seq&&(this.loadingMore=!1)}}refresh(){this.screen==="ready"&&this.pages<=1&&this.load(!1,!0)}tick(){this.now=new Date,!(document.visibilityState!=="visible"||this.screen!=="ready"||this.menu||this.move||this.pages>1||this.busy)&&(this.renderRoot.querySelector("tickets-table-bulk")?.shadowRoot?.querySelector("sw-dialog[open]")||this.load(!1,!0))}say(t,e,s="ok"){this.toast={head:t,rest:e,tone:s},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,s==="bad"?8e3:4e3)}dropTicket(t){this.rows&&(this.rows=this.rows.filter(s=>s.id!==t));const e=new Set(this.selected);e.delete(t)&&(this.selected=e),this.load(!1,!0)}patchTicket(t){this.rows&&(this.rows=this.rows.map(e=>e.id===t.id?this.merged(e,t):e))}merged(t,e){return{...t,status:e.status,revision:e.revision,assignee:e.assignee,last_assignee_name:e.last_assignee_name,last_activity_at:e.last_activity_at,waiting_on:e.waiting_on,waiting_reason:e.waiting_reason,priority:e.priority,department:e.department,title:e.title,eta_at:e.eta_at,closed_at:e.closed_at,transitions:e.transitions,can:{...t.can,manage:e.can.manage,assign:e.can.assign}}}setLayout(t,e=!0){const s=it(t.sort)!==it(this.layout.sort)||t.limit!==this.layout.limit;this.layout=t,this.density=t.density,e&&jt({columns:t.columns,sort:it(t.sort),density:t.density,limit:t.limit}),s&&this.reloadIfNeeded()}setExtra(t){this.extra=t,this.tellExtra(),this.reloadIfNeeded()}applySaved(t){const e=Mi(t.view,this.layout);this.extra=e.extra,this.tellExtra(),this.setLayout(e.layout),this.dispatchEvent(new CustomEvent("table-filters",{detail:e.base,bubbles:!0,composed:!0})),this.reloadIfNeeded(!0)}download(t,e){const s=URL.createObjectURL(t),i=document.createElement("a");i.href=s,i.download=e,i.rel="noopener",i.click(),window.setTimeout(()=>URL.revokeObjectURL(s),3e4)}async monthlyReport(t){this.exporting=!0;try{const e=await B().monthlyReport(Ti(t.from,t.to,t.group,H()));this.download(e.blob,e.filename),this.say(o("monthlyDone",{n:e.rows??0}))}catch(e){const s=e instanceof R?e.body.code:"";this.say(s==="export_too_large"?o("exportTooLarge"):s==="export_rate"?o("exportRate"):T(e),void 0,"bad")}finally{this.exporting=!1}}async exportCsv(){this.exporting=!0;try{const t=await B().exportCsv(de(this.filters(),this.layout.sort,{columns:this.layout.columns,lang:H()}));this.download(t.blob,t.filename),this.say(o("exported",{n:t.rows??0}))}catch(t){const e=t instanceof R?t.body.code:"";this.say(e==="export_too_large"?o("exportTooLarge"):e==="export_rate"?o("exportRate"):T(t),void 0,"bad")}finally{this.exporting=!1}}ids(){return(this.rows??[]).map(t=>t.id)}canSelect(){return!this.phone&&!!this.meta?.can.manage}open(t){window.location.hash=this.hrefOf(t)}onRowClick(t,e){t.composedPath().some(i=>i instanceof HTMLElement&&(i.matches("button, input, label, a, .pop")||i.classList.contains("ckb")))||this.open(e.id)}onCheck(t,e){const s=t.shiftKey;this.selected=s?ue(this.ids(),this.selected,this.anchor,e):me(this.selected,e),this.anchor=e}focusRow(t){this.focusIdx=t,this.updateComplete.then(()=>this.renderRoot.querySelector(`tbody tr[data-row-index="${t}"]`)?.focus())}async openMenu(t,e){if(this.menu?.id===t.id&&this.menu.kind===e){this.menu=null;return}if(this.menu={id:t.id,kind:e},this.updateComplete.then(()=>this.renderRoot.querySelector(".pop[data-overlay] button")?.focus()),e==="assignee"){this.eligible=null;try{this.eligible=t.department?ge(await P().assignees(t.department.id,t.id)):[]}catch(s){this.eligible=[],this.say(T(s),void 0,"bad")}}}async act(t,e){this.busy=!0;try{const s=await e();this.patchTicket(s),this.say(o("changed"))}catch(s){if(s instanceof R&&s.status===409&&s.body.code==="ticket_stale"){try{this.patchTicket(await P().get(t.id))}catch{}this.say(o("staleReloaded"),void 0,"bad")}else this.say(T(s),void 0,"bad")}finally{this.busy=!1}}pickMove(t,e,s){if(this.menu=null,s){this.move={id:t.id,to:e},this.moveNote="",this.moveError="";return}this.act(t,()=>P().status(t.id,{to:e,revision:t.revision}))}async submitMove(){const t=this.move,e=this.rows?.find(s=>s.id===t?.id);if(!(!t||!e)){if(!this.moveNote.trim()){this.moveError=o("required");return}this.move=null,await this.act(e,()=>P().status(e.id,{to:t.to,note:this.moveNote.trim(),revision:e.revision}))}}pickAssignee(t,e){this.menu=null,!Qt(t.assignee,e)&&this.act(t,()=>P().assign(t.id,{assignee:we(e),revision:t.revision}))}statusChip(t){const e=ws({status:t});return n`<span class=${`chip ${e.tone}`} aria-label=${e.text} title=${e.text}><i class=${`dot ${e.tone==="ok"?"ok":e.tone==="info"?"run":""}`}></i>${e.label}${e.sub?n`<span class="subst"> · ${e.sub}</span>`:c}</span>`}sentenceOf(t){return ns(t,Rt(t,this.meta),this.now,!ut()||Lt("tickets.costs"))}shownColumns(){const t=this.fittedColumns();if(!this.sentenceOn||this.phone)return t;const e=t.indexOf("title"),s=[...t];return s.splice(e<0?0:e+1,0,"sentence"),s}fittedColumns(){return this.phone?this.layout.columns:wi(this.layout.columns,this.fitWidth,this.canSelect(),this.sentenceOn?["sentence"]:[])}colgroup(t,e){return n`<colgroup>${e?n`<col style=${`width:${Pe}px`} />`:c}${t.map(s=>s==="title"?n`<col data-colw="title" />`:n`<col data-colw=${s} style=${`width:${Ne[s]}px`} />`)}</colgroup>`}cell(t,e){switch(e){case"number":return n`<td class="c-number">#${t.number}</td>`;case"title":return n`<td class="c-title"><span class="cv" title=${t.title}>${t.title}</span>${t.category?n`<span class="sub" title=${t.category.name}>${z(t.category.name)}</span>`:c}</td>`;case"department":return n`<td><span class="cv" title=${t.department?.name||c}>${t.department?z(t.department.name):""}</span></td>`;case"priority":{const s=We(t.priority);return n`<td>${t.priority?n`<span class=${`chip ${s}`} title=${t.priority.name}><i class=${`dot ${s==="bad"?"bad":s==="info"?"run":""}`}></i>${t.priority.name}</span>`:c}</td>`}case"status":{const s=this.menu?.id===t.id&&this.menu.kind==="status";return t.transitions.length?n`<td class="cellmenu"><button type="button" class="cbtn" aria-haspopup="menu" aria-expanded=${String(s)} data-menu-for=${`status:${t.id}`}
            aria-label=${o("statusMenu",{status:Zt(t.status)})} ?disabled=${this.busy} @click=${()=>void this.openMenu(t,"status")}>${this.statusChip(t.status)}${C("chevron","chev")}</button>
          </td>`:n`<td>${this.statusChip(t.status)}</td>`}case"assignee":{const s=t.assignee?.name||"",i=n`<span class=${`who${s?"":" none"}`} title=${s||c}>${s?z(s):o("unassigned")}</span>`;if(!t.can.assign)return n`<td>${i}</td>`;const a=this.menu?.id===t.id&&this.menu.kind==="assignee";return n`<td class="cellmenu"><button type="button" class="cbtn" aria-haspopup="menu" aria-expanded=${String(a)} data-menu-for=${`assignee:${t.id}`}
            aria-label=${o("assigneeMenu",{name:s||o("unassigned")})} ?disabled=${this.busy} @click=${()=>void this.openMenu(t,"assignee")}>${i}${C("chevron","chev")}</button>
          </td>`}case"place":return n`<td><span class="cv" title=${t.place_text||c}>${t.place_text?z(t.place_text):""}</span></td>`;case"device":return n`<td><span class="cv" title=${t.device_name||c}>${t.device_name?z(t.device_name):""}</span></td>`;case"created":return n`<td class="c-created"><ticket-elapsed .item=${t} data-row-elapsed></ticket-elapsed></td>`;case"activity":return n`<td class="c-activity">${He(t.last_activity_at,this.now)}</td>`;case"stuck":{const s=Pi(t.stuck,this.now);return n`<td><span class=${`cv${t.stuck?" warn":""}`} title=${s||c}>${s}</span></td>`}case"sla":{const s=Ni(t.sla,this.now);return n`<td class="c-sla"><span class=${s.tone}>${s.text}</span></td>`}case"cost":{const s=Be(t.cost,H());return n`<td class="c-cost" data-cost=${t.cost?t.cost.approved?"approved":"submitted":""}><span class=${s.muted?"muted":""}>${s.text}</span></td>`}case"cost_status":return n`<td>${t.cost_status&&t.cost_status!=="not_required"?n`<span class=${`chip ${Ke(t.cost_status)}`} data-cost-status=${t.cost_status}>${F(`cs_${t.cost_status}`)}</span>`:c}</td>`}}header(){const t=this.layout.sort,e=this.ids(),s=zi(e,this.selected);return n`<thead><tr>
      ${this.canSelect()?n`<th class="ck" scope="col"><label class="ckb"><span class="vh">${o("selectPage")}</span><input type="checkbox" data-select-page .checked=${s==="all"} .indeterminate=${s==="some"}
        @change=${()=>{this.selected=Oi(e,this.selected)}} /></label></th>`:c}
      ${this.shownColumns().map(i=>{if(i==="sentence")return n`<th scope="col" class="c-sentence" data-col="sentence">${N("ltSentence")}</th>`;const a=xi(t,i);return n`<th scope="col" aria-sort=${ki(t,i)} data-col=${i}>
          <button type="button" class=${`sh${a&&a.order>1?" second":""}`} data-sort=${i} aria-label=${o("sortBy",{col:at(i)})}
            @click=${r=>this.setLayout({...this.layout,sort:$i(t,i,r.shiftKey)})}>${at(i)}${a?n`${C(a.dir==="asc"?"arrowUp":"arrowDown")}${t.length>1?n`<small>${a.order}</small>`:c}`:c}</button>
        </th>`})}
    </tr></thead>`}cellMenu(){const t=this.menu,e=t?this.rows?.find(i=>i.id===t.id):void 0;if(!t||!e)return c;if(t.kind==="status")return n`<div class="pop ov" popover="manual" role="menu" data-overlay="status" aria-label=${o("statusMenu",{status:Zt(e.status)})} @keydown=${this.onMenuKey}>
        ${Ge(e.status,e.transitions).map(({move:i,label:a})=>n`<button type="button" role="menuitem" data-move-to=${i.to} @click=${()=>this.pickMove(e,i.to,i.note_required)}>${a}</button>`)}
      </div>`;const s=e.assignee?.name||"";return n`<div class="pop ov" popover="manual" role="menu" data-overlay="assignee" aria-label=${o("assigneeMenu",{name:s||o("unassigned")})} @keydown=${this.onMenuKey}>
      ${this.eligible===null?n`<span class="skl" style="block-size:44px"></span>`:this.eligible.length?this.eligible.map(i=>n`<button type="button" role="menuitemradio" aria-checked=${String(Qt(e.assignee,i))} data-assign-to=${i.id} data-handler=${i.key} @click=${()=>this.pickAssignee(e,i)}>${m("user")}${z(i.name)}</button>`):n`<div class="note">${o("noAssignees")}</div>`}
    </div>`}table(t){const e=this.canSelect(),s=this.shownColumns();return n`<div class="tw" data-table-wrap>
      <table class="tt" style=${`min-inline-size:${xt(s,e)}px`} data-min-width=${xt(s,e)} role="grid" aria-label=${o("tableLabel")} aria-rowcount=${t.length+1} aria-multiselectable=${String(e)} aria-describedby="kbhelp" data-tickets-table @keydown=${this.onKey}>
        ${this.colgroup(s,e)}
        ${this.header()}
        <tbody>${qt(t,i=>i.id,(i,a)=>{const r=this.selected.has(i.id);return n`<tr data-row=${i.id} data-row-index=${a} data-status=${i.status} aria-rowindex=${a+2} aria-selected=${e?String(r):c} ?data-picked=${this.picked===i.id}
              tabindex=${this.focusIdx===a||this.focusIdx<0&&a===0?"0":"-1"} @focus=${()=>this.focusIdx=a} @click=${l=>this.onRowClick(l,i)}>
            ${e?n`<td class="ck"><label class="ckb"><span class="vh">${o("selectRow",{n:i.number})}</span><input type="checkbox" tabindex="-1" data-select=${i.id} .checked=${r}
              @click=${l=>this.onCheck(l,i.id)} /></label></td>`:c}
            ${this.shownColumns().map(l=>l==="sentence"?n`<td class="c-sentence"><span class="cv" title=${this.sentenceOf(i)} data-row-sentence>${this.sentenceOf(i)}</span></td>`:this.cell(i,l))}
          </tr>`})}</tbody>
      </table>
      <span class="vh" id="kbhelp">${o("keyboardHelp")}</span>
      ${this.next?n`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.load(!0)}>${o("loadMore")}</button></div>`:c}
    </div>`}compact(t){return n`<nav class="cl" aria-label=${o("compactList")} data-compact-list>
      ${qt(t,e=>e.id,e=>n`<a class="ci" href=${this.hrefOf(e.id)} data-row=${e.id} data-status=${e.status}>
        <span class="ci-t">${e.title}</span>
        <span class="ci-s">${this.statusChip(e.status)}</span>
        <span class="ci-x" data-row-sentence>${this.sentenceOf(e)}</span>
        <span class="ci-m">#${e.number}${e.assignee?.name?n` · ${z(e.assignee.name)}`:c}</span>
        <span class="ci-a">${Di(e,this.now)}</span>
      </a>`)}
    </nav>
    ${this.next?n`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.load(!0)}>${o("loadMore")}</button></div>`:c}`}skeleton(){const t=this.phone?this.layout.columns:this.fittedColumns();return n`<div class="tw" aria-busy="true" data-table-state="loading"><table class="tt" style=${`min-inline-size:${xt(t,!1)}px`}>${this.colgroup(t,!1)}<thead><tr>${t.map(e=>n`<th scope="col">${at(e)}</th>`)}</tr></thead>
      <tbody>${Array.from({length:this.phone?4:8},()=>n`<tr class="sk">${t.map(()=>n`<td><span class="skl"></span></td>`)}</tr>`)}</tbody></table></div>`}body(){if(this.screen==="loading")return this.skeleton();if(this.screen==="error")return n`<div class="statebox glass" role="status" data-table-state="error"><span class="ring">${m("warning")}</span><b>${o("loadFailed")}</b>
        <span class="vh" data-error-detail>${this.failed}</span><button type="button" class="btn sm" data-retry @click=${()=>this.reloadIfNeeded(!0)}>${m("refresh")}${o("retry")}</button></div>`;const t=this.rows??[];if(!t.length){const e=It(this.extra)>0;return n`<div class="statebox glass" role="status" data-table-state=${e?"no-match":"empty"}><span class="ring">${m(e?"search":"ticket")}</span><b>${o(e?"emptyFiltered":"empty")}</b>
        ${e?n`<button type="button" class="btn sm" data-clear-extra @click=${()=>this.setExtra({...nt})}>${o("fClear")}</button>`:c}</div>`}return this.phone?this.compact(t):this.table(t)}render(){const t=this.rows??[],e=t.filter(i=>this.selected.has(i.id)),s=this.canSelect()&&e.length>0;return n`<div data-screen="tickets-table" data-view="table">
      ${n`<tickets-table-toolbar .layout=${this.layout} .extra=${this.extra} .meta=${this.meta} .holders=${Xt(t)} .current=${Ci({scope:this.scope,...this.base},this.extra,this.layout)}
            .count=${this.screen==="ready"?t.length:null} ?more=${!!this.next} ?phone=${this.phone} ?canExport=${!!this.meta?.can.manage} ?exporting=${this.exporting} .defaultView=${this.defaultView} ?hostFilters=${this.hostFilters} .fitted=${this.fittedColumns()}
            @layout-change=${i=>this.setLayout(i.detail.layout)} @extra-change=${i=>this.setExtra(i.detail.extra)}
            @view-apply=${i=>this.applySaved(i.detail.view)} @default-view=${i=>this.defaultView=i.detail.id??""}
            .sentence=${this.sentenceOn} @sentence-change=${this.onSentenceToggle}
            @export-csv=${()=>void this.exportCsv()} @monthly-report=${i=>void this.monthlyReport(i.detail)}></tickets-table-toolbar>`}
      ${this.toast?n`<div class=${`banner toast ${this.toast.tone==="bad"?"bad":"info"}`} role="status" data-table-toast>${m(this.toast.tone==="bad"?"warning":"check")}<div><b>${this.toast.head}</b>${this.toast.rest?n`<small>${this.toast.rest}</small>`:c}</div></div>`:c}
      ${this.body()}
      ${s?n`<tickets-table-bulk .rows=${e} .meta=${this.meta} @bulk-done=${this.onBulkDone} @ticket-deleted=${this.onOneDeleted} @bulk-clear=${()=>this.selected=new Set}></tickets-table-bulk>`:c}
    </div>
    ${this.cellMenu()}
    ${this.move?n`<sw-dialog open heading=${o("moveTitle",{status:Ye(this.move.to)})} data-dialog="table-move" @close=${()=>this.move=null}>
      <div class="form"><label class="fld"><span>${o("moveReason")} <b class="req">*</b></span>
        <textarea class="inp" maxlength="2000" data-move-note .value=${this.moveNote} @input=${i=>{this.moveNote=i.target.value,this.moveError=""}}></textarea></label>
        ${this.moveError?n`<div class="err" role="alert">${this.moveError}</div>`:c}</div>
      <div slot="footer" class="sheetfoot"><button type="button" class=${`btn ${this.move.to==="cancelled"?"danger":"primary"}`} data-move-ok @click=${()=>void this.submitMove()}>${o("confirm")}</button>
        <button type="button" class="btn" @click=${()=>this.move=null}>${o("cancel")}</button></div>
    </sw-dialog>`:c}`}};f.styles=[ot,...rt,Ut,ye,Yt,V`
    :host {
      display: block;
    }
    :host([fill]) {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
    }
    :host([fill]) > [data-screen] {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-block-size: 0;
    }
    :host([fill]) .tw {
      flex: 0 1 auto;
      min-block-size: 0;
      max-block-size: none;
    }
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .statebox {
      padding-block: 40px;
    }
    /* TKUI4: the bulk bar floats at the bottom of the screen over the rows (sticky: the selection is always one tap from its actions) */
    tickets-table-bulk {
      display: block;
      position: sticky;
      inset-block-end: 16px;
      z-index: 12;
      margin-block-start: 12px;
    }
  `];v([h()],f.prototype,"scope",2);v([h({attribute:!1})],f.prototype,"base",2);v([h({attribute:!1})],f.prototype,"meta",2);v([h({attribute:!1})],f.prototype,"hrefOf",2);v([h()],f.prototype,"picked",2);v([h({reflect:!0,attribute:"data-density"})],f.prototype,"density",2);v([h({type:Boolean,reflect:!0})],f.prototype,"fill",2);v([p()],f.prototype,"rows",2);v([p()],f.prototype,"next",2);v([p()],f.prototype,"screen",2);v([p()],f.prototype,"failed",2);v([p()],f.prototype,"loadingMore",2);v([p()],f.prototype,"layout",2);v([h({attribute:!1})],f.prototype,"extra",2);v([h({type:Boolean})],f.prototype,"hostFilters",2);v([p()],f.prototype,"selected",2);v([p()],f.prototype,"focusIdx",2);v([p()],f.prototype,"menu",2);v([p()],f.prototype,"eligible",2);v([p()],f.prototype,"move",2);v([p()],f.prototype,"moveNote",2);v([p()],f.prototype,"moveError",2);v([p()],f.prototype,"busy",2);v([p()],f.prototype,"toast",2);v([p()],f.prototype,"phone",2);v([p()],f.prototype,"now",2);v([p()],f.prototype,"exporting",2);v([p()],f.prototype,"defaultView",2);v([p()],f.prototype,"sentenceOn",2);v([p()],f.prototype,"fitWidth",2);f=v([G("tickets-table")],f);var Hi=Object.defineProperty,Wi=Object.getOwnPropertyDescriptor,vt=(t,e,s,i)=>{for(var a=i>1?void 0:i?Wi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Hi(e,s,a),a};let Z=class extends W{constructor(){super(...arguments),this.module=null,this.manager=!1,this.source=null,this.n=null,this.seq=0}updated(t){(t.has("module")||t.has("source")||t.has("manager"))&&this.load()}allowed(){return!!this.module?.enabled&&Os(zs(this.module.ui),this.manager)}async load(){const t=Je.me?.user.id,e=++this.seq;if(!this.allowed()||!t){this.n=null;return}try{const s=await P().list({scope:"mine",status:"open",limit:200});e===this.seq&&(this.n=Es(s.items,t,new Date))}catch{e===this.seq&&(this.n=null)}}render(){const t=this.n;return!t||!this.allowed()||t.open===0?c:n`<div class="kpis" role="group" aria-label=${dt("myGroup")} data-my-numbers>
      <div class="kpi" data-my="open"><small>${dt("myOpen")}</small><b>${t.open}</b></div>
      <div class=${`kpi${t.waiting?" warn":""}`} data-my="waiting"><small>${dt("myWaiting")}</small><b>${t.waiting}</b></div>
      <div class=${`kpi${t.overdue?" bad":""}`} data-my="overdue"><small>${dt("myOverdue")}</small><b>${t.overdue}</b></div>
      <div class="kpi" data-my="visits"><small>${dt("myVisits")}</small><b>${t.visitsToday}</b></div>
    </div>`}};Z.styles=V`
    :host { display: block; }
    /* TICKETS-POLISH-2331: one quiet strip (audit §7.5.4) - the number beside its label on a desktop row of 4; on a phone a horizontal
       strip of compact tiles (the 2 x 2 block pushed the first request below the fold) */
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sw-s-3); }
    .kpi { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 10px 16px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border); background: var(--dv-surface); -webkit-backdrop-filter: var(--dv-surface-blur); backdrop-filter: var(--dv-surface-blur); box-shadow: var(--dv-shadow-1); min-inline-size: 0; }
    .kpi small { font-size: var(--sw-fs-sm); color: var(--dv-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .kpi b { flex: none; font-size: var(--sw-fs-xl); font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; color: var(--dv-text); direction: ltr; unicode-bidi: isolate; text-align: start; }
    .kpi.warn b { color: var(--au-warn-text); }
    .kpi.bad b { color: var(--dv-danger); }
    @media (max-width: 767px) {
      .kpis { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(9.5rem, 42%); gap: 8px; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x mandatory; margin-inline: -14px; padding-inline: 14px; scroll-padding-inline: 14px; }
      .kpis::-webkit-scrollbar { display: none; }
      .kpi { scroll-snap-align: start; flex-direction: column; align-items: flex-start; gap: 0; padding: 8px 12px; }
    }
  `;vt([h({attribute:!1})],Z.prototype,"module",2);vt([h({type:Boolean})],Z.prototype,"manager",2);vt([h({attribute:!1})],Z.prototype,"source",2);vt([p()],Z.prototype,"n",2);Z=vt([G("tickets-my-numbers")],Z);const fe={scopes:{},states:{},departments:{}};function Gi(t){const e={};for(const s of ke)e[s]=s==="all"?t.total:t.groups[s]??0;return e}function Yi(t){const e={};for(const s of At){const i=t.scopes[s];i&&(e[s]=i.total)}return{scopes:e,states:t.states?Gi(t.states):{},departments:t.departments?.departments??{}}}function Ji(t){return t===void 0?"":String(t)}function Xi(t,e,s,i){const a=d=>i({...t,...d}),r=d=>e?.departments[0]?.priorities.find(k=>k.key===d)?.name??o(`prio_${d}`),l=(d,k)=>n`<button type="button" class="rc" aria-pressed=${String(t.assignee===d)} data-f-assignee=${d||"any"} @click=${()=>a({assignee:d})}>${k}</button>`;return n`<div class="tfilters" data-table-filters>
    ${ht(o("fPriority"),n`<div class="fchips" role="group" aria-label=${o("fPriority")}>${Mt.map(d=>n`<button type="button" class="rc" aria-pressed=${String(t.priority.includes(d))} data-f-priority=${d}
      @click=${()=>a({priority:t.priority.includes(d)?t.priority.filter(k=>k!==d):[...t.priority,d]})}>${r(d)}</button>`)}</div>`,"priority")}
    ${ht(o("fAssignee"),n`<div class="fchips" role="group" aria-label=${o("fAssignee")}>${l("",o("fAssigneeAny"))}${l("none",o("fAssigneeNone"))}${l("me",o("fAssigneeMe"))}</div>
      ${s.length?n`<div class="fchips" data-f-holders>${s.map(d=>l(d.key,d.name))}</div>`:c}`,"assignee")}
    <div class="fchips" role="group">
      <button type="button" class="rc" aria-pressed=${String(t.waiting==="manager")} data-f-waiting @click=${()=>a({waiting:t.waiting?"":"manager"})}>${o("fWaiting")}</button>
      <button type="button" class="rc" aria-pressed=${String(t.stuck==="any")} data-f-stuck @click=${()=>a({stuck:t.stuck?"":"any"})}>${o("fStuck")}</button>
    </div>
    ${Ee()?ht(F("colCostStatus"),n`<div class="fchips" role="group" aria-label=${F("colCostStatus")}>${ve.map(d=>n`<button type="button" class="rc" aria-pressed=${String(t.cost_status.includes(d))} data-f-cost-status=${d}
      @click=${()=>a({cost_status:t.cost_status.includes(d)?t.cost_status.filter(k=>k!==d):[...t.cost_status,d]})}>${F(`cs_${d}`)}</button>`)}</div>`,"cost"):c}
    <div class="tdates">
      <label>${o("fCreatedFrom")}<input class="inp" type="datetime-local" lang=${st()} data-f-from .value=${mt(t.created_from)} @change=${d=>a({created_from:_t(d.target.value)})} /></label>
      <label>${o("fCreatedTo")}<input class="inp" type="datetime-local" lang=${st()} data-f-to .value=${mt(t.created_to)} @change=${d=>a({created_to:_t(d.target.value)})} /></label>
    </div>
  </div>`}function Qi(t,e,s,i){const a=[],r=l=>e?.departments[0]?.priorities.find(d=>d.key===l)?.name??o(`prio_${l}`);if(t.priority.length&&a.push({key:"priority",label:`${o("fPriority")}: ${t.priority.map(r).join(", ")}`,remove:()=>i({...t,priority:[]})}),t.assignee){const l=t.assignee==="none"?o("fAssigneeNone"):t.assignee==="me"?o("fAssigneeMe"):s.find(d=>d.key===t.assignee)?.name??o("fAssignee");a.push({key:"assignee",label:`${o("fAssignee")}: ${l}`,remove:()=>i({...t,assignee:""})})}if(t.waiting&&a.push({key:"waiting",label:o("fWaiting"),remove:()=>i({...t,waiting:""})}),t.stuck&&a.push({key:"stuck",label:o("fStuck"),remove:()=>i({...t,stuck:""})}),t.cost_status.length&&a.push({key:"cost_status",label:`${F("colCostStatus")}: ${t.cost_status.map(l=>F(`cs_${l}`)).join(", ")}`,remove:()=>i({...t,cost_status:[]})}),t.created_from||t.created_to){const l=k=>{const[,S,_]=mt(k).slice(0,10).split("-");return _&&S?`${Number(_)}.${Number(S)}`:""},d=[t.created_from?`${o("fCreatedFrom")}${l(t.created_from)}`:"",t.created_to?`${o("fCreatedTo")} ${l(t.created_to)}`:""].filter(Boolean).join(" ");a.push({key:"created",label:d,remove:()=>i({...t,created_from:"",created_to:""})})}return a}const Zi=V`
  .tfilters {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
  }
  .tdates {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .tdates label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 200px;
    min-inline-size: 0;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .tdates .inp {
    min-block-size: 36px;
    box-sizing: border-box;
    padding-inline: 10px;
    border: 1px solid var(--dv-border-strong);
    border-radius: var(--sw-r-md);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    font-weight: 400;
  }
  .tdates .inp:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 1px;
  }
  @media (max-width: 767px) {
    .tdates .inp {
      min-block-size: 44px;
    }
  }
`;var ta=Object.defineProperty,ea=Object.getOwnPropertyDescriptor,x=(t,e,s,i)=>{for(var a=i>1?void 0:i?ea(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&ta(e,s,a),a};function D(t,e){if(!e){window.location.hash=t;return}const s=t.replace(/^#/,""),[i,a=""]=s.split("?");is(i,new URLSearchParams(a))}let w=class extends W{constructor(){super(...arguments),this.bubbleSkin=new lt(this),this.route=null,this.r=te(["tickets","mine"],new URLSearchParams),this.module=null,this.meta=null,this.items=null,this.next=null,this.screen="loading",this.failed="",this.loadingMore=!1,this.phone=window.matchMedia("(max-width: 767px)").matches,this.drawerUsed=!1,this.toast=null,this.now=new Date,this.q="",this.view="cards",this.cal=os(),this.counts=fe,this.filterOpen=!1,this.filters={...Et},this.tableExtra={...nt},this.tableHolders=[],this.compactHeader=!1,this.panelCtl=new rs(this,()=>this.filterOpen,t=>this.filterOpen=t),this.countSeq=0,this.pendingQ=null,this.listKey="",this.seq=0,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.qTimer=0,this.toastTimer=0,this.extraPages=0,this.live=new _e(()=>this.refreshQuiet()),this.clock=0,this.offNames=null,this.onScroll=()=>{const t=this.scrollTop>40&&!this.filterOpen;t!==this.compactHeader&&(this.compactHeader=t)},this.onCardAction=t=>{const{item:e,action:s}=t.detail;if(s==="open")D(this.hrefOf(e.id),!1);else if(s==="full")D(gt(e.id),!1);else if(s==="copy"){const i=`${location.origin}${location.pathname}${location.search}${gt(e.id)}`;navigator.clipboard?.writeText(i).then(()=>this.say(g("linkCopied"))).catch(()=>this.say(i))}},this.closeDrawer=()=>this.isConnected&&D(A(this.r.scope,this.r.filters),!1),this.onTicketGone=t=>{this.closeDrawer(),t.detail?.deleted&&this.say(Vt("deletedOne")),t.detail?.deleted&&this.items&&(this.items=this.items.filter(e=>e.id!==t.detail.id)),this.renderRoot.querySelector("tickets-table")?.dropTicket(t.detail?.id??""),this.listKey="",this.reloadIfNeeded(!0)},this.onTicketChanged=t=>{const e=t.detail.ticket;if(!this.items)return;const{description:s,events:i,attachments:a,close_note:r,closed_by_name:l,duplicate_of:d,reopen_until:k,can:S,transitions:_,assignments:Y,...zt}=e,yt={...zt,excerpt:s.slice(0,240)};this.items=this.items.map(ct=>ct.id===e.id?yt:ct),this.renderRoot.querySelector("tickets-table")?.patchTicket(e),this.refreshQuiet(),this.renderRoot.querySelector("tickets-table")?.refresh()},this.onCreated=t=>{const e=t.detail;this.say(e.failedPhotos?g("photosFailed",{n:e.failedPhotos}):g(e.result==="absorbed"?"absorbed":"created",{n:e.number}),e.failedPhotos?"bad":"ok"),this.listKey="";const s=this.detailMode()==="fullscreen"?gt(e.id):A(this.r.scope,this.r.filters,{t:e.id});e.ticket&&e.assignContact&&e.result==="created"?D(Xe(s,e.assignContact),!0):e.ticket||e.result==="absorbed"?D(s,!0):D(A(this.r.scope,this.r.filters),!0),this.loadPage(!1)},this.pickMode=t=>{t==="board"?window.location.hash=Ds:t==="calendar"?(this.cal=!0,se(!0)):(this.cal=!1,se(!1),this.setView(t))},this.resetFilters=()=>{this.filters={...Et},this.tableExtra={...nt};const t=this.r.filters;(t.status!==pt.status||t.department)&&this.setFilters({status:pt.status,department:""})}}refreshQuiet(){this.screen!=="ready"||this.view!=="cards"&&!this.cal||this.extraPages>0||this.loadingMore||this.loadPage(!1)}connectedCallback(){super.connectedCallback(),bt(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offNames=$e(()=>this.requestUpdate()),this.clock=window.setInterval(()=>this.now=new Date,6e4),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offNames?.(),window.clearInterval(this.clock),this.live.stop(),window.clearTimeout(this.qTimer),window.clearTimeout(this.toastTimer)}updated(){Ns(this.renderRoot,this.phone)}willUpdate(t){t.has("route")&&this.route&&(this.r=te(this.route.segments,this.route.params),Qe(this.r.scope),this.r.ticketId&&(this.drawerUsed=!0),(this.pendingQ===null||this.r.filters.q!==this.pendingQ.trim())&&(this.q=this.r.filters.q,this.pendingQ=null),(this.screen==="ready"||this.screen==="error")&&this.reloadIfNeeded())}async boot(){xe().then(t=>this.view=t.view==="table"?"table":"cards");try{const t=await P().module();if(this.module=t,Ze(t.name),!t.enabled){this.screen="off";return}this.meta=await P().meta(),this.reloadIfNeeded(!0)}catch(t){this.fail(t)}}fail(t){t instanceof R&&t.status===403?this.screen="forbidden":t instanceof R&&t.status===404&&t.body.code==="feature_disabled"?this.screen="off":(this.failed=T(t),this.screen="error")}key(){const t=this.r.filters;return`${this.r.scope}|${t.status}|${t.department}|${t.q.trim()}`}reloadIfNeeded(t=!1){const e=this.key();!t&&e===this.listKey||(this.listKey=e,this.loadPage(!1))}async loadPage(t){const e=++this.seq,s=this.r.filters;t?(this.loadingMore=!0,this.extraPages++):(this.extraPages=0,this.items===null&&(this.screen="loading"));try{const i=await P().list({scope:this.r.scope,status:s.status,department_id:s.department||void 0,q:s.q,cursor:t?this.next:null});if(e!==this.seq)return;this.items=t?[...this.items??[],...i.items.filter(a=>!(this.items??[]).some(r=>r.id===a.id))]:i.items,this.next=i.next_cursor,this.screen="ready",t||this.loadCounts()}catch(i){e===this.seq&&this.fail(i)}finally{e===this.seq&&(this.loadingMore=!1)}}scopes(){const e=[...ts(ut(),as)];return e.includes(this.r.scope)||e.splice(At.indexOf(this.r.scope),0,this.r.scope),e}async loadCounts(){const t=++this.countSeq,e=this.r.filters,s=Ms(),i={q:e.q,department_id:e.department||void 0},a=async Y=>Y.catch(()=>null),[r,l,d,k,S]=await Promise.all([...At.map(Y=>this.scopes().includes(Y)?a(s.facets({...i,scope:Y,status:e.status})):Promise.resolve(null)),a(s.facets({...i,scope:this.r.scope,status:"all"})),e.department?a(s.facets({q:e.q,scope:this.r.scope,status:e.status})):Promise.resolve(null)]);if(t!==this.countSeq)return;const _={mine:r,department:l,all:d}[this.r.scope];this.counts=Yi({scopes:{mine:r,department:l,all:d},states:k,departments:e.department?S:_})}say(t,e="ok"){this.toast={text:t,tone:e},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,e==="bad"?7e3:3500)}setFilters(t,e=!1){const s={...this.r.filters,...t};D(A(this.r.scope,s,{t:this.r.ticketId||void 0}),e)}onSearch(t){this.q=t,this.pendingQ=t,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>this.setFilters({q:t},!0),300)}detailMode(){return this.module?.ui.detail??"drawer_fullscreen"}hrefOf(t,e=!1){if(this.detailMode()==="fullscreen")return gt(t);const s=A(this.r.scope,this.r.filters,{t});return e?`${s}${s.includes("?")?"&":"?"}view=timeline`:s}setView(t){this.view=t,jt({view:t})}chips(t){const e=this.r.filters,s=[];if(e.status!==pt.status&&s.push({key:"status",label:N("tbChipState",{name:ee(e.status)}),remove:()=>this.setFilters({status:pt.status})}),e.department){const i=this.meta?.departments.find(a=>a.id===e.department);s.push({key:"department",label:i?i.name:N("tbDept"),remove:()=>this.setFilters({department:""})})}return t?s.push(...ls(this.items??[],this.filters,i=>this.filters=i)):s.push(...Qi(this.tableExtra,this.meta,this.tableHolders,i=>this.tableExtra=i)),s}panelBody(t,e){const s=this.r.filters,i=this.counts,a=this.meta?.departments??[],r=Object.values(i.departments).reduce((d,k)=>d+k,0),l=Object.keys(i.departments).length>0;return n`
      ${ht(N("tbState"),n`<div class="fchips stf" role="radiogroup" aria-label=${g("stateFilter")}>
        ${ke.map(d=>n`<button type="button" class="rc" role="radio" aria-checked=${String(s.status===d)} data-status-filter=${d} @click=${()=>this.setFilters({status:d})}>${ee(d)}${e(i.states[d])}</button>`)}
      </div>`,"state")}
      ${a.length>1?ht(N("tbDept"),n`<div class="fchips" role="group" aria-label=${g("departmentsGroup")}>
        <button type="button" class="rc" aria-pressed=${String(!s.department)} data-dept="" @click=${()=>this.setFilters({department:""})}>${g("allDepartments")}${l?e(r):c}</button>
        ${a.map(d=>n`<button type="button" class="rc" aria-pressed=${String(s.department===d.id)} data-dept=${d.id} @click=${()=>this.setFilters({department:d.id})}>${z(d.name)}${l?e(i.departments[d.id]??0):c}</button>`)}
      </div>`,"department"):c}
      ${t&&this.screen==="ready"?cs(this.items??[],this.filters,d=>this.filters=d):c}
      ${!t&&this.screen==="ready"?Xi(this.tableExtra,this.meta,this.tableHolders,d=>this.tableExtra=d):c}`}header(){const t=this.screen==="ready"||this.screen==="loading",e=!!this.meta?.can.create,s=this.counts,i=this.counts===fe,a=_=>_===void 0?i?n`<small aria-hidden="true" style="visibility:hidden">00</small>`:c:n`<small>${Ji(_)}</small>`,r=this.view!=="table"||this.cal,l=this.chips(r),d=!this.meta&&this.screen==="loading",k=this.r.filters,S=this.filterOpen?ds(this.panelBody(r,a),l.length,this.resetFilters,()=>this.filterOpen=!1):c;return n`<header class=${`dh${this.compactHeader?" compact":""}`} data-tickets-header>
      <div class="dh-row">
        <h1 data-tickets-title>${g("area")}</h1>
        ${t?n`<div class="pact">
          ${ps(this.cal?"calendar":r?"cards":"table",!!this.meta?.can.manage,this.pickMode)}
          ${d?n`<span class="btn primary newbtn" aria-hidden="true" style="visibility:hidden">${m("plus")}<span class="lbl">${g("newShort")}</span></span>`:c}
          ${e?n`<button type="button" class="btn primary newbtn" data-new aria-label=${g("newTitle")} @click=${()=>D(A(this.r.scope,this.r.filters,{create:!0}),!1)}>${m("plus")}<span class="lbl">${g("newShort")}</span></button>`:c}
        </div>`:c}
      </div>
      ${t?n`<div class="dh-det tb" role="group" aria-label=${N("lfGroup")} data-toolbar>
        <div class="seg sm scope" role="radiogroup" aria-label=${N("lsScopeGroup")} data-scope-seg>
          ${this.scopes().map(_=>n`<button type="button" role="radio" aria-checked=${String(this.r.scope===_)} data-scope=${_} @click=${()=>D(A(_,k),!1)}>${es(_)}${a(s.scopes[_])}</button>`)}
        </div>
        <label class="search">${m("search")}<span class="vh">${g("searchShort")}</span><input type="search" data-search maxlength="80" placeholder=${this.phone?g("searchShort"):N("lsSearchLong")} .value=${this.q} @input=${_=>this.onSearch(_.target.value)} /></label>
        <span class="fanchor">
          ${hs(this.filterOpen,l.length,()=>this.filterOpen=!this.filterOpen)}
          ${this.phone?c:S}
        </span>
        ${us(l,this.resetFilters)}
        <span class="qchips">
          <tickets-intake-chip @ticket-changed=${()=>this.reloadIfNeeded(!0)}></tickets-intake-chip>
          ${this.meta?.can.manage?n`<tickets-inbound-chip manager @ticket-changed=${()=>this.reloadIfNeeded(!0)}></tickets-inbound-chip>`:c}
        </span>
        ${this.phone?S:c}
      </div>`:c}
    </header>`}stateBox(t,e,s,i){return n`<div class="statebox glass" role="status" data-tickets-state=${s}><span class="ring">${m(t)}</span><b>${e}</b>${i??c}</div>`}body(){switch(this.screen){case"loading":{const a=n`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:var(--sw-r-2xl)"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`,r=n`<ticket-card skeleton></ticket-card>`;return this.cal?n`<div data-tickets-state="loading" aria-busy="true" data-cal-loading><div class="cgrid">${Array.from({length:this.phone?2:7},()=>a)}</div></div>`:n`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>r)}</div></div>`}case"off":return this.stateBox("ticket",g("moduleOff"),"off",Lt("system.configure")?n`<a class="btn sm" href="#/system/tickets" data-open-settings>${m("settings")}${g("toSettings")}</a>`:void 0);case"forbidden":return this.stateBox("lock",g("forbidden"),"forbidden");case"error":return this.stateBox("warning",g("loadFailed"),"error",n`${this.failed?n`<span class="vh" data-error-detail>${this.failed}</span>`:c}<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.items=null,this.boot()}}>${m("refresh")}${g("retry")}</button>`)}if(this.view==="table"&&!this.cal){const a=this.r.filters;return n`<tickets-table ?fill=${!this.phone} hostFilters .extra=${this.tableExtra} .scope=${this.r.scope} .base=${{status:a.status,department:a.department,q:a.q}} .meta=${this.meta} .hrefOf=${r=>this.hrefOf(r)}
        .picked=${this.r.ticketId} @table-filters=${r=>this.setFilters(r.detail)}
        @table-extra=${r=>this.tableExtra=r.detail.extra} @table-holders=${r=>this.tableHolders=r.detail.holders}></tickets-table>`}const t=this.items??[],e=this.r.filters;if(!t.length){if(e.q.trim()!==""||e.department!==""||e.status!=="open")return this.stateBox("search",g("emptyFiltered"),"no-match",n`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters({...pt})}>${g("clearFilters")}</button>`);if(this.r.scope==="department"&&this.meta&&!this.meta.departments.some(l=>l.my_role))return this.stateBox("users",g("noDepartments"),"no-departments");const r=this.r.scope==="mine"?g("emptyMine"):this.r.scope==="department"?g("emptyDepartment"):g("emptyAll");return this.stateBox("ticket",r,"empty",this.meta?.can.create?n`<button type="button" class="btn primary" data-new-empty @click=${()=>D(A(this.r.scope,this.r.filters,{create:!0}),!1)}>${m("plus")}${g("newTitle")}</button>`:void 0)}const s=this.detailMode()!=="drawer",i=ms(t,this.filters);return i.length?this.cal?n`<tickets-calendar .items=${i} .now=${this.now} .hrefOf=${a=>this.hrefOf(a)} .roleOf=${a=>Rt(a,this.meta)}
        .hasMore=${!!this.next} .loadingMore=${this.loadingMore} .openId=${this.r.ticketId} @cal-load-more=${()=>void this.loadPage(!0)}></tickets-calendar>`:n`<div class="cgrid" data-tickets-grid>${qt(i,a=>a.id,a=>n`<ticket-card .item=${a} .role=${Rt(a,this.meta)} .now=${this.now} .href=${this.hrefOf(a.id)} .timelineHref=${this.hrefOf(a.id,!0)} .fullScreen=${s} ?data-picked=${this.r.ticketId===a.id} @card-action=${this.onCardAction}></ticket-card>`)}</div>
      ${this.next?n`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.loadPage(!0)}>${g("loadMore")}</button></div>`:c}`:n`${this.stateBox("search",N("lfNoMatch"),"no-match-filters",n`<button type="button" class="btn sm" data-clear-card-filters @click=${()=>this.filters={...Et}}>${m("x")}${N("lfClear")}</button>`)}
      ${this.next?n`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.loadPage(!0)}>${g("loadMore")}</button></div>`:c}`}render(){const t=this.module?.ui,e=!!this.r.ticketId&&this.screen==="ready";return n`<div class="page" data-screen="tickets-list" data-scope=${this.r.scope}>
      ${this.header()}
      <div class=${`scr${this.view==="table"&&!this.cal&&this.screen==="ready"?" fill":""}`} data-tickets-scroll>
        ${this.r.scope==="mine"&&this.screen==="ready"?n`<tickets-my-numbers .module=${this.module} .manager=${!!this.meta?.can.manage} .source=${this.items}></tickets-my-numbers>`:c}
        ${this.body()}
      </div>
    </div>
    ${this.drawerUsed&&this.module?.enabled?n`<ticket-detail mode="drawer" .open=${e} .ticketId=${this.r.ticketId} .detailMode=${t?.detail??"drawer_fullscreen"} .scope=${this.r.scope} .focusTimeline=${this.route?.params.get("view")==="timeline"} .initialTab=${this.route?.params.get("tab")??""}
      .defaultTab=${t?.detail_tab??""} .sizeSetting=${t?.drawer_size??""} .sheetSetting=${t?.phone_sheet??""} .cameraViewfinder=${t?.camera_viewfinder===!0} .assignContact=${ss(this.route?.params.get("assign"))}
      @assign-consumed=${()=>D(A(this.r.scope,this.r.filters,{t:this.r.ticketId}),!0)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${this.onTicketChanged} @ticket-gone=${this.onTicketGone}></ticket-detail>`:c}
    ${this.module?.enabled&&this.meta?.can.create?n`<ticket-create .open=${this.r.creating&&this.screen==="ready"} .meta=${this.meta} .mode=${t?.new_ticket??"sheet"} .scope=${this.r.scope} .detailMode=${t?.detail??"drawer_fullscreen"}
      @close=${()=>D(A(this.r.scope,this.r.filters),!1)} @created=${this.onCreated}></ticket-create>`:c}
    ${this.toast?n`<div class=${`banner flt ${this.toast.tone==="bad"?"bad":"info"}`} role="status" data-tickets-toast>${m(this.toast.tone==="bad"?"warning":"check")}<div>${this.toast.text}</div></div>`:c}`}};w.styles=[ot,...rt,Ps,fs,bs,Zi,V`
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    .more {
      display: flex;
      justify-content: center;
      padding-block: 4px;
    }
    /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header (the title row
       and the ONE toolbar) the numbers and the requests scroll in their own region - the page itself never scrolls and the controls stay
       in place. In the table view the region does not scroll at all: the table card fills it and scrolls its rows under its sticky head.
       On a phone the region is transparent (display: contents) and the page scrolls, the header compacting over it. */
    .scr {
      display: contents;
    }
    @media (min-width: 768px) {
      :host {
        overflow: hidden;
      }
      .page {
        block-size: 100%;
        min-block-size: 0;
        box-sizing: border-box;
        padding-block-end: 0;
        gap: 18px;
      }
      .scr {
        display: flex;
        flex-direction: column;
        gap: 18px;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--dv-border-strong) transparent;
        margin-inline: -36px;
        padding: 2px 36px 28px;
      }
      .scr.fill {
        overflow: hidden;
        padding-block-end: 20px;
      }
      .scr.fill > tickets-table {
        flex: 1 1 auto;
        min-block-size: 0;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .scr {
        margin-inline: -24px;
        padding-inline: 24px;
      }
    }
    .flt {
      position: fixed;
      inset-block-end: 24px;
      inset-inline: 0;
      margin-inline: auto;
      inline-size: fit-content;
      max-inline-size: calc(100% - 32px);
      box-sizing: border-box;
      z-index: 40;
      box-shadow: var(--dv-shadow-2);
    }
    .qchips {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: none;
      margin-inline-start: auto;
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't p .';
        grid-template-columns: minmax(0, 1fr) auto var(--sw-float-reserve, 0px);
      }
      .dh-row .pact {
        grid-area: p;
      }
      .qchips {
        order: 2;
        margin-inline-start: 0;
      }
      .flt {
        inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
      }
    }
  `];x([h({attribute:!1})],w.prototype,"route",2);x([p()],w.prototype,"r",2);x([p()],w.prototype,"module",2);x([p()],w.prototype,"meta",2);x([p()],w.prototype,"items",2);x([p()],w.prototype,"next",2);x([p()],w.prototype,"screen",2);x([p()],w.prototype,"failed",2);x([p()],w.prototype,"loadingMore",2);x([p()],w.prototype,"phone",2);x([p()],w.prototype,"drawerUsed",2);x([p()],w.prototype,"toast",2);x([p()],w.prototype,"now",2);x([p()],w.prototype,"q",2);x([p()],w.prototype,"view",2);x([p()],w.prototype,"cal",2);x([p()],w.prototype,"counts",2);x([p()],w.prototype,"filterOpen",2);x([p()],w.prototype,"filters",2);x([p()],w.prototype,"tableExtra",2);x([p()],w.prototype,"tableHolders",2);x([p()],w.prototype,"compactHeader",2);w=x([G("tickets-list")],w);export{w as TicketsList};
//# sourceMappingURL=tickets-list-Bg5naeuR.js.map
