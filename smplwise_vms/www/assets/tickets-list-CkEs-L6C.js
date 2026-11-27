import{bs as oe,bu as _e,eC as et,xk as Se,d0 as ne,j as K,z as h,k as p,a as Y,aX as ht,aj as O,b as o,A as c,m as G,eK as re,af as dt,q as _,c as U,dv as Ce,ae as ze,bz as Te,bA as Oe,bX as Ee,c2 as Me,eu as Pe,ev as qe,ei as tt,xl as pt,s$ as yt,ag as Le,cI as De,aM as zt,h3 as Ne,mN as Ft,cK as Re,t3 as Ie,bo as Tt,t2 as Ae,s as Fe,xm as Ot,xn as le,xo as jt,G as w,cA as je,cJ as R,h4 as rt,xp as Be,xq as Ke,xr as Bt,xs as He,xt as Ue}from"./index-HK12zoPD.js";import{j as H,a as qt,k as ce,m as Ve,b as Et,T as Ge,n as We,w as F,s as Kt,N as Ht,r as Xe,g as Je,c as Ye,f as Qe,l as Ze,e as ts,p as es,t as ss,i as is}from"./list-view-base-DYUjBFsA.js";import{b as Lt,e as de,h as pe,m as as,a as he,j as Ut,l as Vt,w as os,g as ns}from"./map-text-mO-7sYi-.js";import{b as rs,o as ls,m as cs,e as ds}from"./ticket-detail-DceiT2JD.js";import"./ticket-create-CgyXX11l.js";import{a as at}from"./automations-glass-C8bfEVq-.js";import{a as $t}from"./glass-BXN6Hyz1.js";import{b as ot}from"./bubble-chrome-5ObbvscE.js";import{t as g,a as k}from"./icons-fyT1VvmF.js";import{b as ps}from"./day-key-CpLUamnv.js";import{h as hs,d as us}from"./pad-CImDeuHV.js";import{m as ft,a as j,w as ms,d as Dt}from"./drawer-model-iYZkVF8J.js";import{s as fs}from"./settings-DYAYUgHz.js";import{t as bs}from"./settings-styles-Ywn5CIRL.js";import{t as I,n as vs}from"./tickets-BMqAayXt.js";import{i as W,P as _t,a as u,f as Z,u as gs,p as ys,s as ws,b as $s,c as xs,N as it,t as n,d as ks,e as _s,g as st,m as Gt,D as Ss,h as Nt,j as Mt,k as Cs,l as ue,n as Wt,o as zs,r as Xt,q as Jt,v as Ts,w as Os,x as Es,y as Ms,z as Ps,A as bt,B as Yt,C as qs,E as Ls,F as Ds,G as Ns,H as Rs,S as Is,I as As,J as Fs,K as js,L as Bs,M as Ks,O as Hs,Q as Us,R as Vs,T as St,U as Gs,V as Ws}from"./table-model-Dsb_1Jdn.js";import{L as me,b as Xs}from"./tickets-board-CYW2BZ4h.js";import{c as V,C as fe,g as Js,i as Ys}from"./cost-model-CzDknHRH.js";import{l as q}from"./list-text-DvVYtDmz.js";import"./sw-pager-C5_nIonh.js";import{P as Qs}from"./page-fit-DotNetQw.js";import{E as Zs,o as ti,G as ei}from"./overview-model-CZ6DxOQ6.js";import{o as lt}from"./overview-text-DB9AbM2p.js";import{L as si}from"./long-lists-Ch9X_AwK.js";import{B as ii}from"./board-model-B0D2_wZa.js";import{p as ct,f as ai,a as oi,b as ni,t as ri}from"./list-toolbar-CViRWV_z.js";import{m as li}from"./media-page-CsLEdl13.js";import{t as ci}from"./chip-selected-nJJL7kHg.js";import"./sw-logo-art-PLtEZJxU.js";import"./device-activity-logic-DAgscBpw.js";import"./readiness-model-DGhavIGL.js";import"./lead-reserve-Cti7NRb7.js";import"./tickets-costs-D2LLTg00.js";import"./tickets-costs-mock-BFUSzv6f.js";import"./bytes-QYSxC3WX.js";import"./tickets-s4-tmlPu6rS.js";import"./org-locations-text-_mVCnXIY.js";import"./model-CoCaPxiD.js";import"./maintenance-D9ql1UOh.js";import"./geometry-DILugf6d.js";import"./drawer-text-Cx1YZMBf.js";import"./location-picker-BeM9Feet.js";const xt={calGroup:"יומן שבועי",calPrev:"השבוע הקודם",calNext:"השבוע הבא",calPrevDay:"היום הקודם",calNextDay:"היום הבא",calToday:"היום",calTodayJump:"מעבר להיום",calWeekOf:"{from}–{to}",calWeekAria:"שבוע {from} עד {to}",calCount:"{n} אירועים בשבוע",calCountOne:"אירוע אחד בשבוע",calCountNone:"אין אירועים בשבוע זה",calDayCount:"{n} אירועים",calDayEmpty:"אין אירועים",calDayLabel:"{day}, {date}",calDaysStrip:"ימי השבוע",calUnscheduled:"{n} {tickets} ללא מועד",calUnscheduledOne:"{ticket} {f:אחת|m:אחד} ללא מועד",calMore:"עוד {n}",calLoadMore:"טעינת עוד {tickets} לרשימה",calJumpNearest:"מעבר לשבוע הקרוב עם אירועים",calLegend:"מקרא",calSwipeHint:"החלקה ימינה או שמאלה מחליפה יום",calK_visit:"ביקור",calK_ack:"יעד אישור קבלה",calK_stuck:"יעד ללא עדכון",calK_resolve:"יעד סיום",calOpen:"פתיחת {the_ticket} {n}",calEmptyTitle:"אין ביקורים או יעדים בשבוע הזה",calEmptyAll:"אין ביקורים או יעדים ברשימה הזו",calLoadFailed:"היומן לא נטען",calRetry:"ניסיון חוזר",days:["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"],daysShort:["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],months:["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]},be=oe("en","tickets/calendar-text","enPlain"),ve=oe("en","tickets/calendar-text","enNames");Object.keys(xt).filter(t=>!["days","daysShort","months"].includes(t));function di(t,e=et()){return(e==="en"?be[t]:void 0)??xt[t]}function b(t,e){const s=et();return Se(di(t,s),s,e)}function Qt(t,e,s=et()){return(s==="en"?ve:xt)[t][e]??""}_e("tickets/calendar-text",{he:xt,en:{...be,...ve}});const A="Asia/Jerusalem",pi=36e5,hi=24*pi,Zt=new Map;function ui(t){let e=Zt.get(t);return e||(e=new Intl.DateTimeFormat("en-US",{timeZone:t,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}),Zt.set(t,e)),e}function Rt(t,e=A){const s={};for(const i of ui(e).formatToParts(new Date(t)))i.type!=="literal"&&(s[i.type]=Number(i.value));return{y:s.year,m:s.month,d:s.day,h:s.hour===24?0:s.hour,min:s.minute,s:s.second}}const mi=us;function wt(t,e=A){if(!Number.isFinite(t))return"";const s=Rt(t,e);return mi(s.y,s.m,s.d)}function ge(t){return[+t.slice(0,4),+t.slice(5,7),+t.slice(8,10)]}function X(t,e){return ps(t,e)}function ye(t){const[e,s,i]=ge(t);return new Date(Date.UTC(e,s-1,i)).getUTCDay()}function we(t){return X(t,-ye(t))}function fi(t){return Array.from({length:7},(e,s)=>X(t,s))}function te(t,e){const s=Rt(t,e);return Date.UTC(s.y,s.m-1,s.d,s.h,s.min,s.s)-Math.floor(t/1e3)*1e3}function Pt(t,e,s,i=A){const[a,r,l]=ge(t),d=Date.UTC(a,r-1,l,e,s),m=te(d,i);let S=d-m;const T=te(S,i);return T!==m&&(S=d-T),S}function bi(t,e=A){return{start:Pt(t,0,0,e),end:Pt(X(t,1),0,0,e)}}function vi(t,e=A){const s=Rt(t,e);return hs(s.h,s.min)}function vt(t=new Date,e=A){return wt(t.getTime(),e)}function gi(t,e){return X(t,7*e)}const $e=["closed","cancelled"],yi=["done","closed","cancelled"],ee=t=>t?Date.parse(t):NaN;function xe(t){const e=[],s=ee(t.eta_at);if(!$e.includes(t.status)&&Number.isFinite(s)&&e.push({id:`${t.id}:visit`,kind:"visit",ticket:t,startMs:s,endMs:null}),t.sla&&!yi.includes(t.status))for(const[i,a]of[["ack",t.sla.ack_due_at],["stuck",t.sla.stuck_due_at],["resolve",t.sla.resolve_due_at]]){const r=ee(a);Number.isFinite(r)&&e.push({id:`${t.id}:${i}`,kind:i,ticket:t,startMs:r,endMs:null})}return e}function wi(t){return t.flatMap(e=>xe(e)).sort((e,s)=>e.startMs-s.startMs||e.id.localeCompare(s.id))}function $i(t){return t.filter(e=>!$e.includes(e.status)&&xe(e).length===0).length}function xi(t,e=A){const s=t.endMs!==null&&t.endMs>t.startMs?t.endMs:t.startMs,i=wt(t.startMs,e),a=s>t.startMs?wt(s-1,e):i,r=[];for(let l=i;l<=a&&r.length<400;l=X(l,1)){const d=bi(l,e);r.push({day:l,event:t,fromMs:Math.max(t.startMs,d.start),toMs:Math.min(s,d.end),startsHere:l===i,endsHere:l===a})}return r}function ki(t,e,s=A){const i=Object.fromEntries(e.map(a=>[a,[]]));for(const a of t)for(const r of xi(a,s))i[r.day]?.push(r);for(const a of e)i[a].sort((r,l)=>r.fromMs-l.fromMs||r.event.id.localeCompare(l.event.id));return i}function _i(t){return new Set(Object.values(t).flatMap(e=>e.map(s=>s.event.id))).size}function Si(t,e=new Date){if(t.kind==="visit")return"info";const s=t.startMs-e.getTime();return s<0?"bad":s<hi?"warn":"quiet"}function Ci(t,e,s=A){const i=Pt(e,0,0,s),a=t.find(r=>r.startMs>=i);return a?we(wt(a.startMs,s)):null}function gt(t){return+t.slice(8,10)}function Ct(t){return+t.slice(5,7)}var zi=Object.defineProperty,Ti=Object.getOwnPropertyDescriptor,L=(t,e,s,i)=>{for(var a=i>1?void 0:i?Ti(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&zi(e,s,a),a};function Oi(t){return t.split(/(\d+\s*[–-]\s*\d+)/).map((e,s)=>s%2?o`<bdi dir="ltr">${e}</bdi>`:e)}let E=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new ht(this),this.items=[],this.now=new Date,this.hrefOf=t=>`#/tickets/${t}`,this.roleOf=()=>"manager",this.tz=A,this.hasMore=!1,this.loadingMore=!1,this.openId="",this.anchor="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.phone=this.mq.matches,this.touch=null,this.goToday=()=>{this.anchor=vt(new Date,this.tz)},this.onKey=t=>{const e=t.target;if(!e||!e.closest("[data-cal-nav]")||t.altKey||t.ctrlKey||t.metaKey)return;const s=getComputedStyle(this).direction==="rtl";let i=0;if(t.key==="ArrowRight")i=s?-1:1;else if(t.key==="ArrowLeft")i=s?1:-1;else if(t.key==="PageUp")i=-1;else if(t.key==="PageDown")i=1;else if(t.key==="Home"){t.preventDefault(),this.goToday();return}else return;e.closest(".strip")&&!this.phone||(t.preventDefault(),this.step(i))},this.onTouchStart=t=>{const e=t.touches[0];this.touch=e?{x:e.clientX,y:e.clientY}:null},this.onTouchEnd=t=>{const e=this.touch;this.touch=null;const s=t.changedTouches[0];if(!e||!s)return;const i=s.clientX-e.x,a=s.clientY-e.y;if(Math.abs(i)<48||Math.abs(i)<Math.abs(a)*1.5)return;const r=getComputedStyle(this).direction==="rtl";this.step(i>0===r?1:-1)}}connectedCallback(){super.connectedCallback(),$t(this),this.mq.addEventListener("change",this.onMq),this.phone=this.mq.matches}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}willUpdate(t){this.anchor||(this.anchor=vt(this.now,this.tz))}step(t){this.anchor=this.phone?X(this.anchor,t):gi(this.anchor,t)}dateLabel(t){return`${gt(t)} ${Qt("months",Ct(t)-1)}`}weekRange(t){const e=X(t,6);return Ct(t)===Ct(e)?{from:String(gt(t)),to:this.dateLabel(e)}:{from:this.dateLabel(t),to:this.dateLabel(e)}}dayName(t,e=!1){return Qt(e?"daysShort":"days",ye(t))}kindIcon(t){return t==="visit"?g("user"):g("clock")}eventCard(t){const e=t.event,s=e.ticket,i=Si(e,this.now),a=this.roleOf(s),r=rs(s,a,this.now);return o`<li><a class=${`ev tone-${i}`} href=${this.hrefOf(s.id)} data-cal-event=${e.kind} data-cal-tone=${i} data-ticket=${s.id} aria-current=${String(this.openId===s.id)}>
      <span class="top"><time datetime=${new Date(e.startMs).toISOString()}>${vi(e.startMs,this.tz)}</time><span class="kind">${this.kindIcon(e.kind)}${b(`calK_${e.kind}`)}</span></span>
      <b>${O(`#${s.number} ${s.title}`)}</b>
      <span class="sent" data-cal-sentence title=${r}>${r}</span>
      <ticket-elapsed .item=${s}></ticket-elapsed>
    </a></li>`}dayList(t){return t.length?o`<ul class="evs">${t.map(e=>this.eventCard(e))}</ul>`:o`<span class="none" data-cal-day-empty>${b("calDayEmpty")}</span>`}legend(){const t=[["info",b("calK_visit")],["quiet",b("calK_resolve")],["warn",`${b("calK_resolve")} < 24h`],["bad",`${b("calK_resolve")} !`]];return o`<ul class="leg" aria-label=${b("calLegend")} data-cal-legend>
      ${t.map(([e,s])=>o`<li class=${`tone-${e}`}><i></i>${s}</li>`)}
    </ul>`}render(){const t=this.anchor||vt(this.now,this.tz),e=we(t),s=fi(e),i=vt(this.now,this.tz),a=wi(this.items),r=ki(a,s,this.tz),l=_i(r),d=$i(this.items),m=this.weekRange(e),S=l===0?Ci(a,e,this.tz):null,T=l===0,x=b("calWeekOf",m),kt=l===0?b("calCountNone"):l===1?b("calCountOne"):b("calCount",{n:l}),mt=getComputedStyle(this).direction==="rtl",nt=this.phone?b("calPrevDay"):b("calPrev"),At=this.phone?b("calNextDay"):b("calNext");return o`<section class="cal" data-cal data-cal-mode=${this.phone?"day":"week"} aria-label=${b("calGroup")} @keydown=${this.onKey}>
      <div class="bar" data-cal-nav>
        <button type="button" class=${`step prev${mt?"":" flip"}`} data-cal-prev aria-label=${nt} title=${nt} @click=${()=>this.step(-1)}>${g("back")}</button>
        <button type="button" class=${`step next${mt?" flip":""}`} data-cal-next aria-label=${At} title=${At} @click=${()=>this.step(1)}>${g("back")}</button>
        <h2 data-cal-range aria-live="polite" aria-label=${b("calWeekAria",m)}>${Oi(x)}</h2>
        <button type="button" class="btn sm today" data-cal-today title=${b("calTodayJump")} aria-current=${t===i?"date":c} @click=${this.goToday}>${b("calToday")}</button>
        <span class="grow"></span>
        <span class="cnt" data-cal-count>${kt}</span>
      </div>
      ${this.legend()}
      ${d?o`<p class="note" data-cal-unscheduled>${d===1?b("calUnscheduledOne"):b("calUnscheduled",{n:d})}</p>`:c}
      ${this.phone?this.dayMode(s,r,t,i):this.weekMode(s,r,i)}
      ${T?o`<div class="statebox glass" role="status" data-cal-state="empty"><span class="ring">${g("clock")}</span><b>${this.items.length?b("calEmptyTitle"):b("calEmptyAll")}</b>
        ${S?o`<button type="button" class="btn sm" data-cal-nearest @click=${()=>this.anchor=S}>${b("calJumpNearest")}</button>`:c}</div>`:c}
      ${this.hasMore?o`<div class="more"><button type="button" class="btn" data-cal-more ?disabled=${this.loadingMore} @click=${()=>this.dispatchEvent(new CustomEvent("cal-load-more",{bubbles:!0,composed:!0}))}>${b("calLoadMore")}</button></div>`:c}
    </section>`}weekMode(t,e,s){return o`<div class="week" data-cal-week role="group" aria-label=${b("calDaysStrip")}>
      ${t.map(i=>o`<section class=${`day glass${i===s?" today":""}`} data-cal-day=${i} aria-label=${b("calDayLabel",{day:this.dayName(i),date:this.dateLabel(i)})} aria-current=${i===s?"date":"false"}>
        <div class="dhd"><b>${gt(i)}</b><small>${this.dayName(i,!0)}</small>${e[i].length?o`<span class="n">${e[i].length}</span>`:c}</div>
        ${this.dayList(e[i])}
      </section>`)}
    </div>`}dayMode(t,e,s,i){const a=e[s]??[];return o`<div class="strip" role="group" aria-label=${b("calDaysStrip")} data-cal-nav data-cal-strip>
        ${t.map(r=>o`<button type="button" class=${`dbtn${r===i?" today":""}`} data-cal-pick=${r} aria-pressed=${String(r===s)} aria-label=${b("calDayLabel",{day:this.dayName(r),date:this.dateLabel(r)})}
          @click=${()=>this.anchor=r}><small>${this.dayName(r,!0)}</small><b>${gt(r)}</b>${e[r].length?o`<span class="dot" aria-hidden="true"></span>`:c}</button>`)}
      </div>
      <div class="daybox glass" data-cal-day=${s} @touchstart=${this.onTouchStart} @touchend=${this.onTouchEnd} title=${b("calSwipeHint")}>
        <div class="dayhd"><h3>${b("calDayLabel",{day:this.dayName(s),date:this.dateLabel(s)})}</h3><span class="cnt">${a.length?b("calDayCount",{n:a.length}):""}</span></div>
        ${this.dayList(a)}
      </div>`}};E.styles=[ot,...at,K`
    ${ne}
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
  `];L([h({attribute:!1})],E.prototype,"items",2);L([h({attribute:!1})],E.prototype,"now",2);L([h({attribute:!1})],E.prototype,"hrefOf",2);L([h({attribute:!1})],E.prototype,"roleOf",2);L([h({type:String})],E.prototype,"tz",2);L([h({type:Boolean})],E.prototype,"hasMore",2);L([h({type:Boolean})],E.prototype,"loadingMore",2);L([h({type:String})],E.prototype,"openId",2);L([p()],E.prototype,"anchor",2);L([p()],E.prototype,"phone",2);E=L([G("tickets-calendar")],E);var Ei=Object.defineProperty,Mi=Object.getOwnPropertyDescriptor,Q=(t,e,s,i)=>{for(var a=i>1?void 0:i?Mi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Ei(e,s,a),a};let B=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new ht(this),this.manager=!1,this.items=[],this.open=!1,this.busy=!1,this.error="",this.pick={},this.poll=new re(this)}connectedCallback(){super.connectedCallback(),this.refresh(),this.poll.every("inbound",6e4,()=>this.refresh())}async refresh(){if(!this.manager||!dt()){this.items=[];return}try{this.items=(await ft().inbound()).items}catch{this.items=[]}}async act(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await t();e&&typeof e=="object"&&"events"in e&&this.dispatchEvent(new CustomEvent("ticket-changed",{detail:{ticket:e},bubbles:!0,composed:!0})),await this.refresh(),this.items.length||(this.open=!1)}catch(e){this.error=_(e),e instanceof U&&(e.status===404||e.status===409)&&await this.refresh()}finally{this.busy=!1}}}async claim(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await ft().claim(t);this.items=this.items.map(s=>s.id===t?e:s)}catch(e){this.error=_(e),await this.refresh()}finally{this.busy=!1}}}render(){return this.items.length?o`<button type="button" class="btn sm chipin" data-inbound-chip aria-label=${j("inbChip",{n:this.items.length})} @click=${()=>this.open=!0}>
        ${g("note")}<span class="lbl">${j("inbTitle")}</span><b class="n">${this.items.length}</b></button>
      ${this.open?o`<sw-dialog open heading=${j("inbTitle")} data-dialog="inbound" @close=${()=>this.open=!1}>
        ${this.error?o`<div class="err" role="alert">${this.error}</div>`:c}
        <div class="list">${this.items.map(t=>o`<div class="item" data-inbound=${t.id}>
          <small>${j("inbFrom",{sender:O(t.sender||"-"),when:ms(t.received_at)})}</small>
          ${t.claimed_by_me?o`<div class="txt" data-inbound-text>${t.text??""}</div>
            <div class="row">
              <select class="inp" data-inbound-ticket @change=${e=>this.pick={...this.pick,[t.id]:e.target.value}}>
                ${t.tickets.map(e=>o`<option value=${e.id} ?selected=${(this.pick[t.id]??t.tickets[0]?.id)===e.id}>#${e.number} · ${O(e.title)}</option>`)}
              </select>
              <button type="button" class="btn sm primary" data-inbound-attach ?disabled=${this.busy||!t.tickets.length}
                @click=${()=>void this.act(()=>ft().attach(t.id,this.pick[t.id]??t.tickets[0]?.id??""))}>${g("check")}${j("inbAttach",{number:t.tickets.find(e=>e.id===(this.pick[t.id]??t.tickets[0]?.id))?.number??""})}</button>
              <button type="button" class="btn sm quiet" data-inbound-dismiss ?disabled=${this.busy} @click=${()=>void this.act(()=>ft().dismiss(t.id))}>${g("x")}${j("inbDismiss")}</button>
            </div>`:t.claimed?o`<small data-inbound-claimed>${j("inbClaimedBy",{name:O(t.claimed_by_name??"")})}</small>`:o`<div class="row"><button type="button" class="btn sm" data-inbound-claim ?disabled=${this.busy} @click=${()=>void this.claim(t.id)}>${g("user")}${j("inbClaim")}</button></div>`}
        </div>`)}</div>
        <div slot="footer" class="sheetfoot"><button type="button" class="btn" @click=${()=>this.open=!1}>${j("inbClose")}</button></div>
      </sw-dialog>`:c}`:c}};B.styles=[ot,...at,Lt,K`
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
  `];Q([h({type:Boolean})],B.prototype,"manager",2);Q([p()],B.prototype,"items",2);Q([p()],B.prototype,"open",2);Q([p()],B.prototype,"busy",2);Q([p()],B.prototype,"error",2);Q([p()],B.prototype,"pick",2);B=Q([G("tickets-inbound-chip")],B);var Pi=Object.defineProperty,qi=Object.getOwnPropertyDescriptor,z=(t,e,s,i)=>{for(var a=i>1?void 0:i?qi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Pi(e,s,a),a};const Li=["not_a_request","duplicate","spam","abusive","out_of_scope","test"],se=["urgent","high","normal","low"];let C=class extends Y{constructor(){super(...arguments),this.summary=null,this.open=!1,this.rows=[],this.total=0,this.offset=0,this.draft=null,this.meta=null,this.busy=!1,this.error="",this.ok="",this.mergeNumber="",this.rejectOpen=!1,this.block=!1,this.poll=new re(this)}connectedCallback(){super.connectedCallback(),this.refreshSummary(),this.poll.every("summary",6e4,()=>this.refreshSummary())}async refreshSummary(){try{this.summary=await W.summary()}catch{this.summary=null}}async loadPage(t=this.offset){try{const e=await W.drafts(t,_t);this.rows=e.drafts,this.total=e.total,this.offset=t,!e.drafts.length&&t>0&&await this.loadPage(Math.max(0,t-_t))}catch(e){this.error=_(e)}}async show(){if(this.open=!0,this.error="",this.ok="",this.draft=null,!this.meta)try{this.meta=await I().meta()}catch{}await this.loadPage(0)}async openDraft(t){this.error="",this.ok="",this.mergeNumber="",this.rejectOpen=!1,this.block=!1;try{this.draft=await W.draft(t)}catch(e){this.error=_(e)}}async run(t){if(!this.busy){this.busy=!0,this.error="";try{this.ok=await t(),this.draft=null,this.rejectOpen=!1,await Promise.all([this.loadPage(),this.refreshSummary()]),this.dispatchEvent(new CustomEvent("ticket-changed",{bubbles:!0,composed:!0}))}catch(e){this.error=e instanceof U&&e.status===409?u("changed"):_(e),e instanceof U&&e.status===409&&(this.draft=null,await this.loadPage())}finally{this.busy=!1}}}async saveEdit(t,e){const s=this.draft;if(!(!s||this.busy||Z(s,t)===e)){this.busy=!0,this.error="";try{const i={[t]:e||null};t==="department_id"&&(i.category_id=null),this.draft=await W.edit(s,i)}catch(i){this.error=_(i),await this.openDraft(s.id)}finally{this.busy=!1}}}deptOptions(){return this.meta?.departments??[]}urgencyLabel(t){return u(se.includes(t)?t:"normal")}rowTag(t){return o`<span class="tag" data-tone=${gs(t.urgency)}>${this.urgencyLabel(t.urgency)}</span>`}listView(){const t=ys(this.total,this.offset,this.rows.length);return o`<div class="list" data-intake-list>
      ${this.rows.length?this.rows.map(e=>o`<button type="button" class="item" data-intake-row=${e.id} @click=${()=>void this.openDraft(e.id)}>
        ${this.rowTag(e)}<span class="line" dir="auto">${e.first_line}</span>
        <span class="tag" dir="auto">${e.requester?.name??u("unknownRequester")}</span>
        ${e.message_count>1?o`<span class="tag">${e.message_count} ${u("more")}</span>`:c}</button>`):o`<div class="meta" data-intake-empty>${u("empty")}</div>`}
      ${this.total>_t?o`<div class="pager"><sw-button size="sm" ?disabled=${t.prev===null} data-intake-prev @click=${()=>t.prev!==null&&void this.loadPage(t.prev)}>${u("prev")}</sw-button>
        <span>${t.from}-${t.to} ${u("of")} ${t.total}</span>
        <sw-button size="sm" ?disabled=${t.next===null} data-intake-next @click=${()=>t.next!==null&&void this.loadPage(t.next)}>${u("next")}</sw-button></div>`:c}
    </div>`}text(t){return o`<div class="msg" dir="auto" data-intake-text>${ws(t.text,$s(t)).map(e=>e.hit?o`<mark>${e.text}</mark>`:e.text)}</div>`}detailView(t){const e=Z(t,"department_id"),s=this.deptOptions().find(a=>a.id===e)?.categories??[],i=xs(t.flags);return o`<div data-intake-detail style="display:flex;flex-direction:column;gap:var(--sw-s-3)">
      <div class="meta"><span dir="auto">${t.requester?`${t.requester.name}${t.requester.org?" · "+t.requester.org:""}`:u("unknownRequester")}</span>
        <bdi dir="ltr">${t.requester?.phone_masked??""}</bdi>${t.message_count>1?o`<span>${t.message_count} ${u("more")}</span>`:c}
        ${t.duplicates.ticket_numbers.length||t.duplicates.drafts.length?o`<span data-intake-dup>${u("duplicates")}: ${t.duplicates.ticket_numbers.map(a=>`#${a}`).join(" ")}</span>`:c}</div>
      ${i.length?o`<div class="flags">${i.map(a=>o`<span class="tag" data-tone=${a==="safety"?"danger":"warning"}>${u(a)}</span>`)}</div>`:c}
      ${this.text(t)}
      <div class="grid">
        <label class="f">${u("department")}<select data-intake-field="department_id" .value=${e} @change=${a=>void this.saveEdit("department_id",a.target.value)}>
          <option value="">${u("pickDept")}</option>${this.deptOptions().map(a=>o`<option value=${a.id} ?selected=${a.id===e}>${a.name}</option>`)}</select></label>
        <label class="f">${u("category")}<small>${u(`conf_${t.suggestion.category.confidence}`)}</small>
          <select data-intake-field="category_id" @change=${a=>void this.saveEdit("category_id",a.target.value)}>
          <option value="">${u("none")}</option>${s.map(a=>o`<option value=${a.id} ?selected=${a.id===Z(t,"category_id")}>${a.name}</option>`)}</select></label>
        <label class="f">${u("urgency")}<small>${u(`conf_${t.suggestion.urgency.confidence}`)}</small>
          <select data-intake-field="priority_key" @change=${a=>void this.saveEdit("priority_key",a.target.value)}>
          ${se.map(a=>o`<option value=${a} ?selected=${a===Z(t,"priority_key")}>${this.urgencyLabel(a)}</option>`)}</select></label>
        <label class="f">${u("place")}<small>${u(`conf_${t.suggestion.place.confidence}`)}</small>
          <input data-intake-field="place_other" maxlength="200" dir="auto" .value=${Z(t,"place_other")} @change=${a=>void this.saveEdit("place_other",a.target.value)} /></label>
        <label class="f" style="grid-column: 1 / -1">${u("titleField")}<input data-intake-field="title" maxlength="120" dir="auto" .value=${Z(t,"title")}
          @change=${a=>void this.saveEdit("title",a.target.value)} /></label>
      </div>
      ${this.rejectOpen?o`<div class="bar" data-intake-reject-bar>
        ${Li.map(a=>o`<sw-button size="sm" ?disabled=${this.busy} data-intake-reason=${a}
          @click=${()=>void this.run(async()=>(await W.reject(t,a,this.block),u("rejected")))}>${u(`reason_${a}`)}</sw-button>`)}
        <label class="bar"><sw-toggle size="sm" labelHidden in-label label=${u("block")} data-intake-block .checked=${this.block} @change=${a=>this.block=ze(a)}></sw-toggle>${u("block")}</label></div>`:c}
      <div class="bar">
        <sw-button variant="primary" ?disabled=${this.busy||!e} data-intake-approve
          @click=${()=>void this.run(async()=>{const a=await W.approve(t);return`${u("approved")} #${a.number}`})}>${u("approve")}</sw-button>
        <input data-intake-merge-number inputmode="numeric" maxlength="7" size="7" placeholder=${u("mergeNumber")} .value=${this.mergeNumber}
          @input=${a=>this.mergeNumber=a.target.value.replace(/\D/g,"")} />
        <sw-button ?disabled=${this.busy||!this.mergeNumber} data-intake-merge @click=${()=>void this.merge(t)}>${u("merge")}</sw-button>
        <sw-button ?disabled=${this.busy} data-intake-reject @click=${()=>this.rejectOpen=!this.rejectOpen}>${u("reject")}</sw-button>
        <sw-button size="sm" data-intake-back @click=${()=>{this.draft=null}}>${u("back")}</sw-button>
      </div>
    </div>`}async merge(t){const e=Number(this.mergeNumber);await this.run(async()=>(await W.merge(t,e),u("merged")))}render(){const t=this.summary;return!t||!t.can||!t.open&&!this.open?c:o`<sw-button size="sm" data-intake-chip @click=${()=>void this.show()}>${u("chip")} <strong>${t.open}</strong></sw-button>
      <sw-dialog ?open=${this.open} wide heading=${u("title")} @close=${()=>{this.open=!1,this.draft=null,this.refreshSummary()}}>
        ${this.error?o`<div class="err" role="alert" data-intake-error>${this.error}</div>`:c}
        ${this.ok?o`<div class="okm" role="status" data-intake-ok>${this.ok}</div>`:c}
        ${this.draft?this.detailView(this.draft):this.listView()}
      </sw-dialog>`}};C.styles=[fs,bs,K`
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
    ${Ce}
    .okm { color: var(--sw-success-text); font-size: var(--sw-fs-sm); }
    .meta { display: flex; flex-wrap: wrap; gap: var(--sw-s-3); font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  `];z([p()],C.prototype,"summary",2);z([p()],C.prototype,"open",2);z([p()],C.prototype,"rows",2);z([p()],C.prototype,"total",2);z([p()],C.prototype,"offset",2);z([p()],C.prototype,"draft",2);z([p()],C.prototype,"meta",2);z([p()],C.prototype,"busy",2);z([p()],C.prototype,"error",2);z([p()],C.prototype,"ok",2);z([p()],C.prototype,"mergeNumber",2);z([p()],C.prototype,"rejectOpen",2);z([p()],C.prototype,"block",2);C=z([G("tickets-intake-chip")],C);const It=K`
  ${ne}
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
  @media (hover: hover) and (pointer: fine) {
    .pop label.opt:hover {
      background: var(--dv-surface-3);
    }
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
    border-radius: var(--sw-r-pill);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
  }
  @media (hover: hover) and (pointer: fine) {
    .pop button.rc:hover {
      background: var(--dv-surface-3);
    }
  }
  /* AUDIT30-C-TICKETS (#4, Q3 option 1): Blue Wash, never the black key */
  .rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true']:hover {
    ${Te}
  }
  /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
  .rc[aria-pressed='true']::before,
  .pop button.rc[aria-pressed='true']::before {
    ${Oe}
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
  @media (hover: hover) and (pointer: fine) {
    table.tt tbody tr:hover td {
      background: var(--dv-surface-2);
    }
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
`;var Di=Object.defineProperty,Ni=Object.getOwnPropertyDescriptor,$=(t,e,s,i)=>{for(var a=i>1?void 0:i?Ni(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Di(e,s,a),a};let y=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new ht(this),this.fitted=null,this.extra={...it},this.meta=null,this.holders=[],this.current=null,this.count=null,this.more=!1,this.phone=!1,this.canExport=!1,this.exporting=!1,this.sentence=!0,this.sentenceFitted=!1,this.defaultView="",this.hostFilters=!1,this.pop=null,this.views=null,this.naming=!1,this.name="",this.viewError="",this.confirmDelete="",this.repFrom="",this.repTo="",this.repGroup="department",this.repError="",this.onOutside=t=>{if(!this.pop)return;const e=this.renderRoot.querySelector(`[data-pop="${this.pop}"]`);e&&!t.composedPath().includes(e)&&this.close()},this.onKey=t=>{if(this.pop&&t.key==="Escape"){if(!Ee(this,t))return;t.stopPropagation();const e=this.renderRoot.querySelector(`[data-open="${this.pop}"]`);this.close(),e?.focus()}}}connectedCallback(){super.connectedCallback(),$t(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),Me(this)}updated(){Pe(this,!!this.pop,qe)}close(){this.pop=null,this.naming=!1,this.viewError="",this.confirmDelete=""}open(t){if(this.pop===t){this.close();return}this.close(),this.pop=t,t==="views"&&this.loadViews(),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-pop="${t}"] input, [data-pop="${t}"] button`)?.focus())}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}setLayout(t){const e={...this.layout,...t};this.emit("layout-change",{layout:e})}setExtra(t){this.emit("extra-change",{extra:{...this.extra,...t}})}async loadViews(){try{this.views=(await H().views()).items}catch(t){this.views=[],this.viewError=_(t)}}async saveView(){const t=this.name.trim();if(!t||!this.current){this.viewError=n("required");return}try{const e=await H().createView(t,this.current);this.views=[...this.views??[],e].sort((s,i)=>s.name.localeCompare(i.name)),this.naming=!1,this.name="",this.viewError=""}catch(e){this.viewError=e instanceof U&&e.body.code==="view_name_taken"?n("viewNameTaken"):e instanceof U&&e.body.code==="too_many_views"?n("viewsFull"):_(e)}}async deleteView(t){if(this.confirmDelete!==t.id){this.confirmDelete=t.id;return}try{await H().deleteView(t.id),this.views=(this.views??[]).filter(e=>e.id!==t.id),this.defaultView===t.id&&await this.setDefault(null)}catch(e){this.viewError=_(e)}this.confirmDelete=""}async setDefault(t){await qt({default_view:t??void 0}),this.defaultView=t??"",this.emit("default-view",{id:t})}columnsPop(){const t=this.fitted??this.layout.columns,e=ks(t),s=t.length<this.layout.columns.length||this.sentenceFitted;return o`<div class="pop lst" role="dialog" aria-label=${n("columns")} data-pop="columns">
      <div class="hd">${n("columns")}</div>
      ${s?o`<p class="note" data-cols-fitted>${n("columnsFitted")}</p>`:c}
      <div class="plist"><div class="crow" data-col="sentence">
          <label class="opt"><input type="checkbox" .checked=${this.sentence} data-col-sentence
            @change=${i=>this.emit("sentence-change",{on:i.target.checked})} />${q("ltSentence")}</label>
        </div>${e.map(i=>{const a=t.indexOf(i.key);return o`<div class="crow" data-col=${i.key}>
          <label class="opt"><input type="checkbox" .checked=${i.shown} ?disabled=${i.required} data-col-toggle=${i.key}
            @change=${()=>this.setLayout({columns:_s(t,i.key)})} />${st(i.key)}</label>
          ${i.shown?o`<button type="button" class="btn quiet sm mv" aria-label=${n("moveUp",{col:st(i.key)})} ?disabled=${a<=0} data-col-up=${i.key}
              @click=${()=>this.setLayout({columns:Gt(t,i.key,-1)})}>${k("up")}</button>
            <button type="button" class="btn quiet sm mv" aria-label=${n("moveDown",{col:st(i.key)})} ?disabled=${a>=t.length-1} data-col-down=${i.key}
              @click=${()=>this.setLayout({columns:Gt(t,i.key,1)})}>${k("down")}</button>`:c}
        </div>`})}</div>
      <hr />
      <button type="button" data-col-reset @click=${()=>this.setLayout({columns:[...Ss]})}>${g("refresh")}${n("columnsReset")}</button>
    </div>`}viewsPop(){const t=this.views;return o`<div class="pop wide lst" role="dialog" aria-label=${n("savedViews")} data-pop="views">
      <div class="hd">${n("savedViews")}</div>
      <div class="plist">${t===null?o`<span class="skl" style="block-size:44px"></span>`:t.length?t.map(e=>o`<div class="vrow" data-view=${e.id}>
          <button type="button" data-view-apply=${e.id} @click=${()=>{this.close(),this.emit("view-apply",{view:e})}}>${k("bookmark")}<span>${e.name}</span></button>
          <button type="button" class="icon" aria-pressed=${String(this.defaultView===e.id)} data-view-default=${e.id}
            aria-label=${this.defaultView===e.id?n("unsetDefault",{name:e.name}):n("makeDefault",{name:e.name})}
            @click=${()=>void this.setDefault(this.defaultView===e.id?null:e.id)}>${k("star")}</button>
          <button type="button" class="icon" data-view-delete=${e.id} aria-label=${this.confirmDelete===e.id?n("deleteConfirm",{name:e.name}):n("deleteView",{name:e.name})}
            @click=${()=>void this.deleteView(e)}>${this.confirmDelete===e.id?g("check"):g("trash")}</button>
        </div>`):o`<div class="note" data-views-empty>${n("noViews")}</div>`}</div>
      <hr />
      ${this.naming?o`<div class="save">
          <label class="vh" for="vname">${n("viewName")}</label>
          <input id="vname" class="inp" maxlength="60" data-view-name .value=${this.name} placeholder=${n("viewName")}
            @input=${e=>{this.name=e.target.value,this.viewError=""}}
            @keydown=${e=>{e.key==="Enter"&&this.saveView()}} />
          <button type="button" class="btn primary sm" data-view-save @click=${()=>void this.saveView()}>${n("save")}</button>
        </div>`:o`<button type="button" data-view-new ?disabled=${(t?.length??0)>=20} @click=${()=>{this.naming=!0,this.updateComplete.then(()=>this.renderRoot.querySelector("[data-view-name]")?.focus())}}>${g("plus")}${n("saveCurrent")}</button>`}
      ${this.viewError?o`<div class="note err" role="alert" data-view-error>${this.viewError}</div>`:c}
    </div>`}reportPop(){const t=()=>{const s=Cs(this.repFrom,this.repTo);this.repError=s?n(s==="required"?"monthlyRequired":s==="order"?"monthlyOrder":"monthlyTooLong"):"",s||(this.emit("monthly-report",{from:this.repFrom,to:this.repTo,group:this.repGroup}),this.close())},e=(s,i)=>o`<button type="button" class="rc" aria-pressed=${String(this.repGroup===s)} data-rep-group=${s} @click=${()=>this.repGroup=s}>${i}</button>`;return o`<div class="pop" role="dialog" aria-label=${n("monthlyTitle")} data-pop="report">
      <div class="dates">
        <label>${n("monthlyFrom")}<input class="inp" type="date" lang=${tt()} required data-rep-from .value=${this.repFrom} @change=${s=>this.repFrom=s.target.value} /></label>
        <label>${n("monthlyTo")}<input class="inp" type="date" lang=${tt()} required data-rep-to .value=${this.repTo} @change=${s=>this.repTo=s.target.value} /></label>
      </div>
      <div class="fgrp">${e("department",n("monthlyByDepartment"))}${e("vendor",n("monthlyByVendor"))}</div>
      ${this.repError?o`<div class="hd" role="alert" data-rep-error>${this.repError}</div>`:c}
      <button type="button" class="btn sm" data-rep-go @click=${t}>${k("download")}${n("monthlyDownload")}</button>
    </div>`}filtersPop(){const t=this.extra,e=i=>this.meta?.departments[0]?.priorities.find(a=>a.key===i)?.name??n(`prio_${i}`),s=(i,a)=>o`<button type="button" class="rc" aria-pressed=${String(t.assignee===i)} data-f-assignee=${i||"any"} @click=${()=>this.setExtra({assignee:i})}>${a}</button>`;return o`<div class="pop wide lst" role="dialog" aria-label=${n("filters")} data-pop="filters">
      <div class="plist">
      <div class="hd">${n("fPriority")}</div>
      <div class="fgrp">${Nt.map(i=>o`<button type="button" class="rc" aria-pressed=${String(t.priority.includes(i))} data-f-priority=${i}
        @click=${()=>this.setExtra({priority:t.priority.includes(i)?t.priority.filter(a=>a!==i):[...t.priority,i]})}>${e(i)}</button>`)}</div>
      <div class="hd">${n("fAssignee")}</div>
      <div class="fgrp">${s("",n("fAssigneeAny"))}${s("none",n("fAssigneeNone"))}${s("me",n("fAssigneeMe"))}</div>
      ${this.holders.length?o`<div class="fgrp" data-f-holders>${this.holders.map(i=>s(i.key,i.name))}</div>`:c}
      <div class="fgrp">
        <button type="button" class="rc" aria-pressed=${String(t.waiting==="manager")} data-f-waiting @click=${()=>this.setExtra({waiting:t.waiting?"":"manager"})}>${n("fWaiting")}</button>
        <button type="button" class="rc" aria-pressed=${String(t.stuck==="any")} data-f-stuck @click=${()=>this.setExtra({stuck:t.stuck?"":"any"})}>${n("fStuck")}</button>
      </div>
      ${ue()?o`<div class="hd">${V("colCostStatus")}</div>
      <div class="fgrp">${fe.map(i=>o`<button type="button" class="rc" aria-pressed=${String(t.cost_status.includes(i))} data-f-cost-status=${i}
        @click=${()=>this.setExtra({cost_status:t.cost_status.includes(i)?t.cost_status.filter(a=>a!==i):[...t.cost_status,i]})}>${V(`cs_${i}`)}</button>`)}</div>`:c}
      <div class="dates">
        <label>${n("fCreatedFrom")}<input class="inp" type="datetime-local" lang=${tt()} data-f-from .value=${pt(t.created_from)} @change=${i=>this.setExtra({created_from:yt(i.target.value)})} /></label>
        <label>${n("fCreatedTo")}<input class="inp" type="datetime-local" lang=${tt()} data-f-to .value=${pt(t.created_to)} @change=${i=>this.setExtra({created_to:yt(i.target.value)})} /></label>
      </div>
      </div>
      <hr />
      <button type="button" data-f-clear ?disabled=${!Mt(t)} @click=${()=>this.setExtra({...it})}>${g("x")}${n("fClear")}</button>
    </div>`}render(){if(!this.layout)return c;const t=Mt(this.extra),e=this.layout.density==="compact";return o`<div class="tbar" role="toolbar" aria-label=${n("tableLabel")} data-table-toolbar>
      ${this.phone?c:o`<span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="columns")} data-open="columns" @click=${()=>this.open("columns")}>${k("columns")}${n("columns")}</button>
        ${this.pop==="columns"?this.columnsPop():c}
      </span>`}
      <span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="views")} data-open="views" @click=${()=>this.open("views")}>${k("bookmark")}${n("savedViews")}${k("chevron")}</button>
        ${this.pop==="views"?this.viewsPop():c}
      </span>
      ${this.hostFilters?c:o`<span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="filters")} data-open="filters" @click=${()=>this.open("filters")}>${k("filter")}${t?n("filtersCount",{n:t}):n("filters")}</button>
        ${this.pop==="filters"?this.filtersPop():c}
      </span>`}
      <button type="button" class="btn sm" aria-pressed=${String(e)} data-density=${this.layout.density} aria-label=${`${n("density")}: ${n(e?"density_compact":"density_comfortable")}`}
        @click=${()=>this.setLayout({density:e?"comfortable":"compact"})}>${k("density")}${n(e?"density_compact":"density_comfortable")}</button>
      <span class="grow"></span>
      ${this.count!==null?o`<span class="count" data-table-count>${n(this.more?"countMore":this.count===1?"countOne":"count",{n:this.count})}</span>`:c}
      <slot name="pager"></slot>
      ${this.canExport?o`<span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop==="report")} data-open="report" aria-label=${n("monthlyTitle")} @click=${()=>this.open("report")}>${k("download")}${n("monthly")}</button>
        ${this.pop==="report"?this.reportPop():c}
      </span>`:c}
      ${this.canExport?o`<button type="button" class="btn sm" data-export ?disabled=${this.exporting} aria-label=${n("exportTitle")} @click=${()=>this.emit("export-csv",{})}>${k("download")}${n("csv")}</button>`:c}
    </div>`}};y.styles=[ot,...at,It];$([h({attribute:!1})],y.prototype,"layout",2);$([h({attribute:!1})],y.prototype,"fitted",2);$([h({attribute:!1})],y.prototype,"extra",2);$([h({attribute:!1})],y.prototype,"meta",2);$([h({attribute:!1})],y.prototype,"holders",2);$([h({attribute:!1})],y.prototype,"current",2);$([h({type:Number})],y.prototype,"count",2);$([h({type:Boolean})],y.prototype,"more",2);$([h({type:Boolean})],y.prototype,"phone",2);$([h({type:Boolean})],y.prototype,"canExport",2);$([h({type:Boolean})],y.prototype,"exporting",2);$([h({type:Boolean})],y.prototype,"sentence",2);$([h({type:Boolean})],y.prototype,"sentenceFitted",2);$([h()],y.prototype,"defaultView",2);$([h({type:Boolean})],y.prototype,"hostFilters",2);$([p()],y.prototype,"pop",2);$([p()],y.prototype,"views",2);$([p()],y.prototype,"naming",2);$([p()],y.prototype,"name",2);$([p()],y.prototype,"viewError",2);$([p()],y.prototype,"confirmDelete",2);$([p()],y.prototype,"repFrom",2);$([p()],y.prototype,"repTo",2);$([p()],y.prototype,"repGroup",2);$([p()],y.prototype,"repError",2);y=$([G("tickets-table-toolbar")],y);var Ri=Object.defineProperty,Ii=Object.getOwnPropertyDescriptor,D=(t,e,s,i)=>{for(var a=i>1?void 0:i?Ii(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Ri(e,s,a),a};let M=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new ht(this),this.rows=[],this.meta=null,this.offPage=0,this.allCount=0,this.dialog=null,this.eligible=null,this.pick="",this.note="",this.error="",this.busy=!1}connectedCallback(){super.connectedCallback(),$t(this)}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}get mayDelete(){return!dt()||Le("tickets.delete")}open(t){this.dialog=t,this.error="",this.pick=t==="priority"?"urgent":"",this.note="",t==="assign"&&this.loadEligible()}async loadEligible(){this.eligible=null;const t=[...new Set(this.rows.map(e=>e.department?.id).filter(e=>!!e))];try{const e=await Promise.all(t.map(s=>I().assignees(s).then(pe).catch(()=>[])));this.eligible=as(e)}catch(e){this.eligible=[],this.error=_(e)}}async run(){const t=this.dialog;if(!t||t==="delete"||t==="assign"&&!this.pick)return;if(t==="close"&&!this.note.trim()){this.error=n("required");return}const e=(this.eligible??[]).find(i=>i.key===this.pick),s=t==="assign"&&e?{assignee:he(e)}:t==="priority"?{priority_key:this.pick}:t==="close"?{note:this.note.trim()}:{};this.busy=!0;try{const i=await H().bulk({action:t,items:this.rows.map(a=>({id:a.id,revision:a.revision})),params:s,client_request_id:vs()});this.dialog=null,this.emit("bulk-done",{answer:i})}catch(i){this.error=_(i)}finally{this.busy=!1}}dialogBody(t){const e=this.rows.length,s=this.error?o`<div class="err" role="alert" data-bulk-error>${this.error}</div>`:c;if(t==="assign")return o`<div class="form">${this.eligible===null?o`<span class="skl" style="block-size:44px"></span>`:this.eligible.length?o`<div class="pick" role="radiogroup" aria-label=${n("fAssignee")}>${this.eligible.map(i=>o`<label data-bulk-eligible=${i.id} data-handler=${i.key}><input type="radio" name="basg" .checked=${this.pick===i.key} @change=${()=>{this.pick=i.key,this.error=""}} />${O(i.name)}</label>`)}</div>`:o`<div class="muted" data-bulk-eligible-none>${n("noAssignees")}</div>`}${s}</div>`;if(t==="priority"){const i=a=>this.meta?.departments[0]?.priorities.find(r=>r.key===a)?.name??n(`prio_${a}`);return o`<div class="form"><div class="prio" role="radiogroup" aria-label=${n("bulkPriority")}>${Nt.map(a=>o`<button type="button" class="rc" role="radio" aria-checked=${String(this.pick===a)} data-bulk-priority=${a} @click=${()=>this.pick=a}>${i(a)}</button>`)}</div>${s}</div>`}return t==="close"?o`<div class="form"><label class="fld"><span>${n("bulkCloseNote")} <b class="req">*</b></span>
        <textarea class="inp" maxlength="2000" data-bulk-note .value=${this.note} @input=${i=>{this.note=i.target.value,this.error=""}}></textarea></label>${s}</div>`:o`<div class="form"><div class="muted" data-bulk-remind-text>${n("bulkRemindText",{n:e})}</div>${s}</div>`}dialogEl(){const t=this.dialog;if(!t)return c;if(t==="delete")return o`<tickets-delete-dialog open .targets=${this.rows.map(a=>({id:a.id,number:a.number}))} @delete-close=${()=>this.dialog=null}
        @bulk-done=${()=>this.dialog=null}></tickets-delete-dialog>`;const e=this.rows.length,s=t==="assign"?n("bulkAssignTitle",{n:e}):t==="priority"?n("bulkPriorityTitle",{n:e}):t==="close"?n("bulkCloseTitle",{n:e}):n("bulkRemindTitle"),i=this.busy||t==="assign"&&!this.pick;return o`<sw-dialog open heading=${s} data-bulk-dialog=${t} @close=${()=>{this.busy||(this.dialog=null)}}>
      ${this.dialogBody(t)}
      <div slot="footer" class="sheetfoot">
        <button type="button" class=${`btn ${t==="close"?"danger":"primary"}`} data-bulk-go ?disabled=${i} @click=${()=>void this.run()}>${n("bulkGo")}</button>
        <button type="button" class="btn" data-bulk-cancel @click=${()=>this.dialog=null}>${n("cancel")}</button>
      </div>
    </sw-dialog>`}render(){const t=this.rows.length,e=[["assign",g("user"),n("bulkAssign")],["remind",k("bell"),n("bulkRemind")],["priority",k("sort"),n("bulkPriority")],["close",g("lock"),n("bulkClose")]];return o`<div class="bulk" role="toolbar" aria-label=${n("bulkActions")} data-bulk-bar>
      <span class="sel" data-bulk-count>${g("check")}${n("selected",{n:t})}</span>
      ${this.offPage>0?o`<span class="off" data-bulk-off>${n("selectedOff",{n:this.offPage})}</span>`:c}
      ${this.allCount>t?o`<button type="button" class="btn sm quiet" data-bulk-all @click=${()=>this.emit("bulk-all",{})}>${n("selectAllLoaded",{n:this.allCount})}</button>`:c}
      ${e.map(([s,i,a])=>o`<button type="button" class="btn sm" data-bulk=${s} @click=${()=>this.open(s)}>${i}${a}</button>`)}
      ${this.mayDelete?o`<button type="button" class="btn sm dz" data-bulk="delete" @click=${()=>this.open("delete")}>${g("trash")}${Dt("bulkAction")}</button>`:c}
      <span class="grow"></span>
      <button type="button" class="btn sm quiet" data-bulk-clear @click=${()=>this.emit("bulk-clear",{})}>${g("x")}${n("clearSelection")}</button>
    </div>
    ${this.dialogEl()}`}};M.styles=[ot,...at,Lt,de,It,K`
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .bulk .btn {
      background: var(--dv-surface-solid);
    }
    .off {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
  `];D([h({attribute:!1})],M.prototype,"rows",2);D([h({attribute:!1})],M.prototype,"meta",2);D([h({type:Number})],M.prototype,"offPage",2);D([h({type:Number})],M.prototype,"allCount",2);D([p()],M.prototype,"dialog",2);D([p()],M.prototype,"eligible",2);D([p()],M.prototype,"pick",2);D([p()],M.prototype,"note",2);D([p()],M.prototype,"error",2);D([p()],M.prototype,"busy",2);M=D([G("tickets-table-bulk")],M);const ke="sw.tickets.table.sentence";function Ai(){try{const t=window.localStorage.getItem(ke);return t==="0"?"off":t==="1"?"on":"default"}catch{return"default"}}function Fi(t){try{window.localStorage.setItem(ke,t?"1":"0")}catch{}}var ji=Object.defineProperty,Bi=Object.getOwnPropertyDescriptor,v=(t,e,s,i)=>{for(var a=i>1?void 0:i?Bi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&ji(e,s,a),a};let f=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new ht(this),this.scope="mine",this.base={status:"open",department:"",q:""},this.meta=null,this.hrefOf=t=>`#/tickets/${t}`,this.picked="",this.density="comfortable",this.fill=!1,this.rows=null,this.next=null,this.screen="loading",this.failed="",this.loadingMore=!1,this.layout=Wt(null),this.extra={...it},this.hostFilters=!1,this.selected=new Set,this.focusIdx=-1,this.menu=null,this.eligible=null,this.move=null,this.moveNote="",this.moveError="",this.busy=!1,this.toast=null,this.phone=window.matchMedia("(max-width: 767px)").matches,this.now=new Date,this.exporting=!1,this.defaultView="",this.sentenceChoice=Ai(),this.midWidth="",this.anchor=null,this.seq=0,this.pages=0,this.key="",this.booted=!1,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>{this.phone=this.phoneMq.matches,this.phone&&(this.menu=null)},this.fitWidth=0,this.fitObs=new ResizeObserver(([t])=>{const e=Math.floor(t?.contentRect.width??0)-2;Math.abs(e-this.fitWidth)>=1&&(this.fitWidth=e)}),this.live=new me(()=>this.tick()),this.fit=new Qs(this,()=>this.fitRegion(),()=>this.fill&&this.screen==="ready"&&!!this.rows?.length,"all",{keep:!0,content:!0}),this.fitCols="",this.fillH=0,this.fillRaf=0,this.toastTimer=0,this.offNames=null,this.placeMenu=()=>{if(!this.menu)return;const t=this.renderRoot.querySelector(".pop[data-overlay]"),e=this.renderRoot.querySelector(`[data-menu-for="${this.menu.kind}:${this.menu.id}"]`);t&&e&&ls(t,e)},this.onMenuKey=t=>{if(t.key==="Escape"){t.stopPropagation();const e=this.menu?this.renderRoot.querySelector(`[data-menu-for="${this.menu.kind}:${this.menu.id}"]`):null;this.menu=null,e?.focus();return}if(t.key==="Tab"){this.menu=null;return}cs(t,t.currentTarget)},this.holdersKey="",this.onKey=t=>{const e=this.rows??[],s=t.composedPath().some(l=>l instanceof HTMLElement&&l.matches("input, textarea, select, .pop"));if(t.key==="/"&&!s){const l=this.getRootNode().querySelector?.("input[data-search]");l&&(t.preventDefault(),l.focus());return}if(t.key==="Escape"){this.menu?(this.menu=null,t.stopPropagation()):this.selected.size&&(this.selected=new Set,t.stopPropagation());return}if(s)return;if((t.key==="a"||t.key==="A")&&(t.ctrlKey||t.metaKey)&&this.canSelect()){t.preventDefault(),this.selected=new Set([...this.selected,...this.pageIds()]);return}const i=t.composedPath().find(l=>l instanceof HTMLElement&&l.matches("tbody tr")),a=!!i&&t.target===i,r=zs(this.focusIdx,t.key,e.length);if(r!==null&&(a||t.composedPath().some(l=>l instanceof HTMLElement&&l.matches("table")))){t.preventDefault(),this.focusRow(r);return}if(!(!a||this.focusIdx<0||!e[this.focusIdx])){if(t.key==="Enter")t.preventDefault(),this.open(e[this.focusIdx].id);else if(t.key===" "&&this.canSelect()){t.preventDefault();const l=e[this.focusIdx].id;this.selected=t.shiftKey?Xt(this.ids(),this.selected,this.anchor,l):Jt(this.selected,l),this.anchor=l}}},this.onOutside=t=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop[data-overlay]"),s=this.renderRoot.querySelector(`[data-menu-for="${this.menu.kind}:${this.menu.id}"]`),i=t.composedPath();e&&i.includes(e)||s&&i.includes(s)||(this.menu=null)},this.onOneDeleted=t=>{this.say(Dt("deletedOne")),this.dropTicket(t.detail?.id??"")},this.onBulkDone=t=>{const e=t.detail.answer,s=Ts(e);if(this.say(s.head,s.rest||void 0,s.tone),e.action==="delete"&&this.rows){const i=new Set(e.results.filter(a=>a.result==="ok"||a.result==="not_found").map(a=>a.id));this.rows=this.rows.filter(a=>!i.has(a.id))}this.selected=Os(e,this.ids()),this.load(!1,!0)},this.onSentenceToggle=t=>{this.sentenceChoice=t.detail.on?"on":"off",Fi(t.detail.on)}}connectedCallback(){super.connectedCallback(),$t(this),this.phoneMq.addEventListener("change",this.onPhone),this.offNames=De(()=>this.requestUpdate()),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("resize",this.placeMenu),window.addEventListener("scroll",this.placeMenu,!0),this.fitObs.observe(this),this.live.start(),Es(!dt()||zt("tickets.costs.view")),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.offNames?.(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("resize",this.placeMenu),window.removeEventListener("scroll",this.placeMenu,!0),this.fitObs.disconnect(),this.live.stop(),window.clearTimeout(this.toastTimer),cancelAnimationFrame(this.fillRaf)}updated(t){const e=this.phone?"":this.shownColumns().join(",");e!==this.fitCols&&(this.fitCols=e,this.fit.refit()),this.fillRows();const s=this.fit.on?this.renderRoot.querySelector("tickets-table-bulk"):null;s?this.style.setProperty("--toast-lift",`${Math.ceil(window.innerHeight-s.getBoundingClientRect().top)+8}px`):this.style.removeProperty("--toast-lift"),this.placeMenu(),t.has("rows")&&this.tellHolders()}willUpdate(t){this.booted&&(t.has("scope")||t.has("base")||t.has("extra"))&&this.reloadIfNeeded(),this.fit.sync(this.rows?.length??0,`${this.key}|${this.density}|${this.fill?1:0}`),this.toggleAttribute("data-pages-on",this.fit.on),this.toggleAttribute("data-pages-many",this.fit.on&&this.fit.pages>1)}fitRegion(){return this.renderRoot.querySelector("[data-table-wrap]")}fillRows(){this.style.removeProperty("--fit-row-h"),cancelAnimationFrame(this.fillRaf),!(!this.fit.on||this.fit.pages<=1)&&(this.fillRaf=requestAnimationFrame(()=>{const t=this.fitRegion(),e=t?[...t.querySelectorAll("tbody tr[data-fit-item]")]:[];if(!t||!e.length||!this.fit.on||this.fit.pages<=1)return;const s=t.getBoundingClientRect().top+t.clientTop+t.clientHeight-e[e.length-1].getBoundingClientRect().bottom,i=Ms(e.map(l=>l.getBoundingClientRect().height),s-1),a=this.fit.page===this.fit.pages;a||(this.fillH=i);const r=a?Math.min(this.fillH,i):i;r>0&&this.style.setProperty("--fit-row-h",`${r}px`)}))}drawn(t){const e=[];return t.forEach((s,i)=>{this.fit.shows(i)&&e.push([s,i])}),e}pageIds(){return this.drawn(this.rows??[]).map(([t])=>t.id)}tellHolders(){const t=Ut(this.rows??[]),e=t.map(s=>`${s.key}=${s.name}`).join("|");e!==this.holdersKey&&(this.holdersKey=e,this.dispatchEvent(new CustomEvent("table-holders",{detail:{holders:t},bubbles:!0,composed:!0})))}tellExtra(){this.dispatchEvent(new CustomEvent("table-extra",{detail:{extra:this.extra},bubbles:!0,composed:!0}))}async boot(){const t=await ce();if(this.layout=Wt(t),this.density=this.layout.density,t.default_view){this.defaultView=t.default_view;try{const e=(await H().views()).items.find(s=>s.id===t.default_view);if(e){this.booted=!0,this.applySaved(e);return}}catch{}}this.booted=!0,this.reloadIfNeeded(!0)}filters(){return Ps({scope:this.scope,...this.base},this.extra)}reloadIfNeeded(t=!1){const e=JSON.stringify([this.filters(),bt(this.layout.sort),this.layout.limit]);!t&&e===this.key||(this.key=e,this.load(!1))}async load(t,e=!1,s=!1){const i=++this.seq;t?this.loadingMore=!0:e||(this.screen="loading",this.rows=null,this.focusIdx=-1);try{const a=await H().page(Yt(this.filters(),this.layout.sort,{limit:this.layout.limit,cursor:t?this.next:null}));if(i!==this.seq)return;const r=t?this.rows??[]:[],l=new Set(r.map(m=>m.id));this.rows=qs(this.rows,[...r,...a.items.filter(m=>!l.has(m.id))]),t&&!s&&this.fit.reveal(r.length),this.next=a.next_cursor,this.pages=t?this.pages+1:1;const d=new Set(this.rows.map(m=>m.id));[...this.selected].some(m=>!d.has(m))&&(this.selected=new Set([...this.selected].filter(m=>d.has(m)))),this.screen="ready",a.next_cursor&&a.items.length<Math.min(10,this.layout.limit)&&!e&&this.load(!0,!1,!0)}catch(a){if(i!==this.seq)return;!t&&!e?(this.failed=_(a),this.screen="error"):e||this.say(_(a),void 0,"bad")}finally{i===this.seq&&(this.loadingMore=!1)}}refresh(){this.screen==="ready"&&this.pages<=1&&this.load(!1,!0)}tick(){this.now=new Date,!(document.visibilityState!=="visible"||this.screen!=="ready"||this.menu||this.move||this.pages>1||this.busy)&&(this.renderRoot.querySelector("tickets-table-bulk")?.shadowRoot?.querySelector("sw-dialog[open]")||this.load(!1,!0))}say(t,e,s="ok"){this.toast={head:t,rest:e,tone:s},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,s==="bad"?8e3:4e3)}dropTicket(t){this.rows&&(this.rows=this.rows.filter(s=>s.id!==t));const e=new Set(this.selected);e.delete(t)&&(this.selected=e),this.load(!1,!0)}patchTicket(t){this.rows&&(this.rows=this.rows.map(e=>e.id===t.id?this.merged(e,t):e))}merged(t,e){return{...t,status:e.status,revision:e.revision,assignee:e.assignee,last_assignee_name:e.last_assignee_name,last_activity_at:e.last_activity_at,waiting_on:e.waiting_on,waiting_reason:e.waiting_reason,priority:e.priority,department:e.department,title:e.title,eta_at:e.eta_at,closed_at:e.closed_at,transitions:e.transitions,can:{...t.can,manage:e.can.manage,assign:e.can.assign}}}setLayout(t,e=!0){const s=bt(t.sort)!==bt(this.layout.sort)||t.limit!==this.layout.limit;this.layout=t,this.density=t.density,e&&qt({columns:t.columns,sort:bt(t.sort),density:t.density,limit:t.limit}),s&&this.reloadIfNeeded()}setExtra(t){this.extra=t,this.tellExtra(),this.reloadIfNeeded()}applySaved(t){const e=Ls(t.view,this.layout);this.extra=e.extra,this.tellExtra(),this.setLayout(e.layout),this.dispatchEvent(new CustomEvent("table-filters",{detail:e.base,bubbles:!0,composed:!0})),this.reloadIfNeeded(!0)}download(t,e){const s=URL.createObjectURL(t),i=document.createElement("a");i.href=s,i.download=e,i.rel="noopener",i.click(),window.setTimeout(()=>URL.revokeObjectURL(s),3e4)}async monthlyReport(t){this.exporting=!0;try{const e=await H().monthlyReport(Ds(t.from,t.to,t.group,et()));this.download(e.blob,e.filename),this.say(n("monthlyDone",{n:e.rows??0}))}catch(e){const s=e instanceof U?e.body.code:"";this.say(s==="export_too_large"?n("exportTooLarge"):s==="export_rate"?n("exportRate"):_(e),void 0,"bad")}finally{this.exporting=!1}}async exportCsv(){this.exporting=!0;try{const t=await H().exportCsv(Yt(this.filters(),this.layout.sort,{columns:this.layout.columns,lang:et()}));this.download(t.blob,t.filename),this.say(n("exported",{n:t.rows??0}))}catch(t){const e=t instanceof U?t.body.code:"";this.say(e==="export_too_large"?n("exportTooLarge"):e==="export_rate"?n("exportRate"):_(t),void 0,"bad")}finally{this.exporting=!1}}ids(){return(this.rows??[]).map(t=>t.id)}canSelect(){return!this.phone&&!!this.meta?.can.manage}open(t){window.location.hash=this.hrefOf(t)}onRowClick(t,e){t.composedPath().some(i=>i instanceof HTMLElement&&(i.matches("button, input, label, a, .pop")||i.classList.contains("ckb")))||this.open(e.id)}onCheck(t,e){const s=t.shiftKey;this.selected=s?Xt(this.ids(),this.selected,this.anchor,e):Jt(this.selected,e),this.anchor=e}focusRow(t){this.fit.reveal(t),this.focusIdx=t,this.updateComplete.then(()=>this.renderRoot.querySelector(`tbody tr[data-row-index="${t}"]`)?.focus())}async openMenu(t,e){if(this.menu?.id===t.id&&this.menu.kind===e){this.menu=null;return}if(this.menu={id:t.id,kind:e},this.updateComplete.then(()=>this.renderRoot.querySelector(".pop[data-overlay] button")?.focus()),e==="assignee"){this.eligible=null;try{this.eligible=t.department?pe(await I().assignees(t.department.id,t.id)):[]}catch(s){this.eligible=[],this.say(_(s),void 0,"bad")}}}async act(t,e){this.busy=!0;try{const s=await e();this.patchTicket(s),this.say(n("changed"))}catch(s){if(s instanceof U&&s.status===409&&s.body.code==="ticket_stale"){try{this.patchTicket(await I().get(t.id))}catch{}this.say(n("staleReloaded"),void 0,"bad")}else this.say(_(s),void 0,"bad")}finally{this.busy=!1}}pickMove(t,e,s){if(this.menu=null,s){this.move={id:t.id,to:e},this.moveNote="",this.moveError="";return}this.act(t,()=>I().status(t.id,{to:e,revision:t.revision}))}async submitMove(){const t=this.move,e=this.rows?.find(s=>s.id===t?.id);if(!(!t||!e)){if(!this.moveNote.trim()){this.moveError=n("required");return}this.move=null,await this.act(e,()=>I().status(e.id,{to:t.to,note:this.moveNote.trim(),revision:e.revision}))}}pickAssignee(t,e){this.menu=null,!Vt(t.assignee,e)&&this.act(t,()=>I().assign(t.id,{assignee:he(e),revision:t.revision}))}statusChip(t){const e=ds({status:t});return o`<span class=${`chip ${e.tone}`} aria-label=${e.text} title=${e.text}><i class=${`dot ${e.tone==="ok"?"ok":e.tone==="info"?"run":""}`}></i>${e.label}${e.sub?o`<span class="subst"> · ${e.sub}</span>`:c}</span>`}sentenceOf(t){return Ve(t,Et(t,this.meta),this.now,!dt()||zt("tickets.costs"))}shownColumns(){const t=this.fittedColumns();if(!this.fittedTable().sentence||this.phone)return t;const e=t.indexOf("title"),s=[...t];return s.splice(e<0?0:e+1,0,"sentence"),s}fittedColumns(){return this.phone?this.layout.columns:this.fittedTable().columns}fittedTable(){return Ns(this.layout.columns,this.phone?0:this.fitWidth,this.canSelect(),this.sentenceChoice,Rs(this.midWidth))}colgroup(t,e){return o`<colgroup>${e?o`<col style=${`width:${Is}px`} />`:c}${t.map(s=>s==="title"?o`<col data-colw="title" />`:o`<col data-colw=${s} style=${`width:${As[s]}px`} />`)}</colgroup>`}cell(t,e){switch(e){case"number":return o`<td class="c-number">#${t.number}</td>`;case"title":return o`<td class="c-title"><span class="cv" title=${t.title}>${t.title}</span>${t.category?o`<span class="sub" title=${t.category.name}>${O(t.category.name)}</span>`:c}</td>`;case"department":return o`<td><span class="cv" title=${t.department?.name||c}>${t.department?O(t.department.name):""}</span></td>`;case"priority":{const s=Re(t.priority);return o`<td>${t.priority?o`<span class=${`chip ${s}`} title=${t.priority.name}><i class=${`dot ${s==="bad"?"bad":s==="info"?"run":""}`}></i>${t.priority.name}</span>`:c}</td>`}case"status":{const s=this.menu?.id===t.id&&this.menu.kind==="status";return t.transitions.length?o`<td class="cellmenu"><button type="button" class="cbtn" aria-haspopup="menu" aria-expanded=${String(s)} data-menu-for=${`status:${t.id}`}
            aria-label=${n("statusMenu",{status:Ft(t.status)})} ?disabled=${this.busy} @click=${()=>void this.openMenu(t,"status")}>${this.statusChip(t.status)}${k("chevron","chev")}</button>
          </td>`:o`<td>${this.statusChip(t.status)}</td>`}case"assignee":{const s=t.assignee?.name||"",i=o`<span class=${`who${s?"":" none"}`} title=${s||c}>${s?O(s):n("unassigned")}</span>`;if(!t.can.assign)return o`<td>${i}</td>`;const a=this.menu?.id===t.id&&this.menu.kind==="assignee";return o`<td class="cellmenu"><button type="button" class="cbtn" aria-haspopup="menu" aria-expanded=${String(a)} data-menu-for=${`assignee:${t.id}`}
            aria-label=${n("assigneeMenu",{name:s||n("unassigned")})} ?disabled=${this.busy} @click=${()=>void this.openMenu(t,"assignee")}>${i}${k("chevron","chev")}</button>
          </td>`}case"place":return o`<td><span class="cv" title=${t.place_text||c}>${t.place_text?O(t.place_text):""}</span></td>`;case"device":return o`<td><span class="cv" title=${t.device_name||c}>${t.device_name?O(t.device_name):""}</span></td>`;case"created":return o`<td class="c-created"><ticket-elapsed .item=${t} data-row-elapsed></ticket-elapsed></td>`;case"activity":return o`<td class="c-activity">${Ne(t.last_activity_at,this.now)}</td>`;case"stuck":{const s=js(t.stuck,this.now);return o`<td><span class=${`cv${t.stuck?" warn":""}`} title=${s||c}>${s}</span></td>`}case"sla":{const s=Fs(t.sla,this.now);return o`<td class="c-sla"><span class=${s.tone}>${s.text}</span></td>`}case"cost":{const s=Ys(t.cost,et());return o`<td class="c-cost" data-cost=${t.cost?t.cost.approved?"approved":"submitted":""}><span class=${s.muted?"muted":""}>${s.text}</span></td>`}case"cost_status":return o`<td>${t.cost_status&&t.cost_status!=="not_required"?o`<span class=${`chip ${Js(t.cost_status)}`} data-cost-status=${t.cost_status}>${V(`cs_${t.cost_status}`)}</span>`:c}</td>`}}header(){const t=this.layout.sort,e=this.pageIds(),s=Bs(e,this.selected);return o`<thead><tr>
      ${this.canSelect()?o`<th class="ck" scope="col"><label class="ckb"><span class="vh">${n("selectPage")}</span><input type="checkbox" data-select-page .checked=${s==="all"} .indeterminate=${s==="some"}
        @change=${()=>{this.selected=Ks(e,this.selected)}} /></label></th>`:c}
      ${this.shownColumns().map(i=>{if(i==="sentence")return o`<th scope="col" class="c-sentence" data-col="sentence">${q("ltSentence")}</th>`;const a=Hs(t,i);return o`<th scope="col" aria-sort=${Us(t,i)} data-col=${i}>
          <button type="button" class=${`sh${a&&a.order>1?" second":""}`} data-sort=${i} aria-label=${n("sortBy",{col:st(i)})}
            @click=${r=>this.setLayout({...this.layout,sort:Vs(t,i,r.shiftKey)})}>${st(i)}${a?o`${k(a.dir==="asc"?"arrowUp":"arrowDown")}${t.length>1?o`<small>${a.order}</small>`:c}`:c}</button>
        </th>`})}
    </tr></thead>`}cellMenu(){const t=this.menu,e=t?this.rows?.find(i=>i.id===t.id):void 0;if(!t||!e)return c;if(t.kind==="status")return o`<div class="pop ov" popover="manual" role="menu" data-overlay="status" aria-label=${n("statusMenu",{status:Ft(e.status)})} @keydown=${this.onMenuKey}>
        ${Ie(e.status,e.transitions).map(({move:i,label:a})=>o`<button type="button" role="menuitem" data-move-to=${i.to} @click=${()=>this.pickMove(e,i.to,i.note_required)}>${a}</button>`)}
      </div>`;const s=e.assignee?.name||"";return o`<div class="pop ov" popover="manual" role="menu" data-overlay="assignee" aria-label=${n("assigneeMenu",{name:s||n("unassigned")})} @keydown=${this.onMenuKey}>
      ${this.eligible===null?o`<span class="skl" style="block-size:44px"></span>`:this.eligible.length?this.eligible.map(i=>o`<button type="button" role="menuitemradio" aria-checked=${String(Vt(e.assignee,i))} data-assign-to=${i.id} data-handler=${i.key} @click=${()=>this.pickAssignee(e,i)}>${g("user")}${O(i.name)}</button>`):o`<div class="note">${n("noAssignees")}</div>`}
    </div>`}table(t){const e=this.canSelect(),s=this.shownColumns(),i=this.focusIdx>=0&&this.fit.shows(this.focusIdx)?this.focusIdx:this.fit.first;return o`<div class="tw" data-table-wrap><section class="tsec">
      <table class="tt" style=${`min-inline-size:${St(s,e)}px`} data-min-width=${St(s,e)} role="grid" aria-label=${n("tableLabel")} aria-rowcount=${t.length+1} aria-multiselectable=${String(e)} aria-describedby="kbhelp" data-tickets-table @keydown=${this.onKey}>
        ${this.colgroup(s,e)}
        ${this.header()}
        <tbody>${Tt(this.drawn(t),([a])=>a.id,([a,r])=>{const l=this.selected.has(a.id);return o`<tr data-row=${a.id} data-row-index=${r} data-status=${a.status} aria-rowindex=${r+2} aria-selected=${e?String(l):c} ?data-picked=${this.picked===a.id} data-fit-item
              tabindex=${r===i?"0":"-1"} @focus=${()=>this.focusIdx=r} @click=${d=>this.onRowClick(d,a)}>
            ${e?o`<td class="ck"><label class="ckb"><span class="vh">${n("selectRow",{n:a.number})}</span><input type="checkbox" tabindex="-1" data-select=${a.id} .checked=${l}
              @click=${d=>this.onCheck(d,a.id)} /></label></td>`:c}
            ${this.shownColumns().map(d=>d==="sentence"?o`<td class="c-sentence"><span class="cv" title=${this.sentenceOf(a)} data-row-sentence>${this.sentenceOf(a)}</span></td>`:this.cell(a,d))}
          </tr>`})}</tbody>
      </table></section>
      <span class="vh" id="kbhelp">${n("keyboardHelp")}</span>
      ${this.next&&!this.fit.on?o`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.load(!0)}>${n("loadMore")}</button></div>`:c}
    </div>`}compact(t){return o`<nav class="cl" aria-label=${n("compactList")} data-compact-list>
      ${Tt(t,e=>e.id,e=>o`<a class="ci" href=${this.hrefOf(e.id)} data-row=${e.id} data-status=${e.status}>
        <span class="ci-t">${e.title}</span>
        <span class="ci-s">${this.statusChip(e.status)}</span>
        <span class="ci-x" data-row-sentence>${this.sentenceOf(e)}</span>
        <span class="ci-m">#${e.number}${e.assignee?.name?o` · ${O(e.assignee.name)}`:c}</span>
        <span class="ci-a">${Gs(e,this.now)}</span>
      </a>`)}
    </nav>
    ${this.next?o`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.load(!0)}>${n("loadMore")}</button></div>`:c}`}pagerSlot(){if(!this.fit.on)return c;const t=this.fit.pages,e=this.fit.page,s=!!this.next&&e===t;return t<=1&&!s?c:o`<span slot="pager" class="tpager">
      ${s?o`<button type="button" class="btn sm" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.load(!0)}>${n("loadMore")}</button>`:c}
      ${t>1?o`<sw-pager data-table-pager .page=${e} .pages=${t} @page-change=${i=>this.fit.go(i.detail.page)}></sw-pager>`:c}
    </span>`}skeleton(){const t=this.phone?this.layout.columns:this.fittedColumns();return o`<div class="tw" aria-busy="true" data-table-state="loading"><table class="tt" style=${`min-inline-size:${St(t,!1)}px`}>${this.colgroup(t,!1)}<thead><tr>${t.map(e=>o`<th scope="col">${st(e)}</th>`)}</tr></thead>
      <tbody>${Array.from({length:this.phone?4:8},()=>o`<tr class="sk">${t.map(()=>o`<td><span class="skl"></span></td>`)}</tr>`)}</tbody></table></div>`}body(){if(this.screen==="loading")return this.skeleton();if(this.screen==="error")return o`<div class="statebox glass" role="status" data-table-state="error"><span class="ring">${g("warning")}</span><b>${n("loadFailed")}</b>
        <span class="vh" data-error-detail>${this.failed}</span><button type="button" class="btn sm" data-retry @click=${()=>this.reloadIfNeeded(!0)}>${g("refresh")}${n("retry")}</button></div>`;const t=this.rows??[];if(!t.length){const e=Mt(this.extra)>0;return o`<div class="statebox glass" role="status" data-table-state=${e?"no-match":"empty"}><span class="ring">${g(e?"search":"ticket")}</span><b>${e?n("emptyFiltered"):n("empty")}</b>
        ${e?o`<button type="button" class="btn sm" data-clear-extra @click=${()=>this.setExtra({...it})}>${n("fClear")}</button>`:c}</div>`}return this.phone?this.compact(t):this.table(t)}render(){const t=this.rows??[],e=t.filter(a=>this.selected.has(a.id)),s=this.canSelect()&&e.length>0,i=new Set(this.pageIds());return o`<div data-screen="tickets-table" data-view="table">
      ${o`<tickets-table-toolbar .layout=${this.layout} .extra=${this.extra} .meta=${this.meta} .holders=${Ut(t)} .current=${Ws({scope:this.scope,...this.base},this.extra,this.layout)}
            .count=${this.screen==="ready"?t.length:null} ?more=${!!this.next} ?phone=${this.phone} ?canExport=${!!this.meta?.can.manage} ?exporting=${this.exporting} .defaultView=${this.defaultView} ?hostFilters=${this.hostFilters} .fitted=${this.fittedColumns()}
            @layout-change=${a=>this.setLayout(a.detail.layout)} @extra-change=${a=>this.setExtra(a.detail.extra)}
            @view-apply=${a=>this.applySaved(a.detail.view)} @default-view=${a=>this.defaultView=a.detail.id??""}
            .sentence=${this.fittedTable().sentence} .sentenceFitted=${this.fittedTable().sentenceFitted} @sentence-change=${this.onSentenceToggle}
            @export-csv=${()=>void this.exportCsv()} @monthly-report=${a=>void this.monthlyReport(a.detail)}>${this.pagerSlot()}</tickets-table-toolbar>`}
      ${this.toast?o`<div class=${`banner toast ${this.toast.tone==="bad"?"bad":"info"}`} role="status" data-table-toast>${g(this.toast.tone==="bad"?"warning":"check")}<div><b>${this.toast.head}</b>${this.toast.rest?o`<small>${this.toast.rest}</small>`:c}</div></div>`:c}
      ${this.body()}
      ${s?o`<tickets-table-bulk .rows=${e} .meta=${this.meta} .offPage=${e.length-e.filter(a=>i.has(a.id)).length} .allCount=${this.fit.pages>1?t.length:0}
        @bulk-all=${()=>this.selected=new Set(this.ids())} @bulk-done=${this.onBulkDone} @ticket-deleted=${this.onOneDeleted} @bulk-clear=${()=>this.selected=new Set}></tickets-table-bulk>`:c}
    </div>
    ${this.cellMenu()}
    ${this.move?o`<sw-dialog open heading=${n("moveTitle",{status:Ae(this.move.to)})} data-dialog="table-move" @close=${()=>this.move=null}>
      <div class="form"><label class="fld"><span>${n("moveReason")} <b class="req">*</b></span>
        <textarea class="inp" maxlength="2000" data-move-note .value=${this.moveNote} @input=${a=>{this.moveNote=a.target.value,this.moveError=""}}></textarea></label>
        ${this.moveError?o`<div class="err" role="alert">${this.moveError}</div>`:c}</div>
      <div slot="footer" class="sheetfoot"><button type="button" class=${`btn ${this.move.to==="cancelled"?"danger":"primary"}`} data-move-ok @click=${()=>void this.submitMove()}>${n("confirm")}</button>
        <button type="button" class="btn" @click=${()=>this.move=null}>${n("cancel")}</button></div>
    </sw-dialog>`:c}`}};f.styles=[ot,...at,Lt,de,It,K`
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
    /* TICKETS-PAGING-2490: the pages (the fit controller). While they are in force the region clips (it never scrolls); while there
       is more than one page it keeps the whole room (every page ends at the same edge; the measure saw the same height). A toast floats
       over the screen instead of pushing the rows down (a moving edge would re-cut the pages), above the bulk bar while it shows. */
    :host([data-pages-on]) .tw {
      overflow-y: hidden;
    }
    :host([data-pages-many]) .tw {
      flex: 1 1 0;
    }
    :host([data-pages-many]) tbody tr[data-fit-item] {
      block-size: var(--fit-row-h, auto);
    }
    .tpager {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex: none;
    }
    :host([data-pages-on]) .toast {
      position: fixed;
      inset-block-end: var(--toast-lift, var(--sw-s-6));
      inset-inline: 0;
      z-index: 40;
      inline-size: fit-content;
      max-inline-size: calc(100% - var(--sw-s-8));
      box-sizing: border-box;
      margin: 0 auto;
      box-shadow: var(--dv-shadow-2);
    }
    /* TKUI4: the bulk bar floats at the bottom of the screen over the rows (sticky: the selection is always one tap from its actions) */
    tickets-table-bulk {
      display: block;
      position: sticky;
      inset-block-end: 16px;
      z-index: 12;
      margin-block-start: 12px;
    }
  `];v([h()],f.prototype,"scope",2);v([h({attribute:!1})],f.prototype,"base",2);v([h({attribute:!1})],f.prototype,"meta",2);v([h({attribute:!1})],f.prototype,"hrefOf",2);v([h()],f.prototype,"picked",2);v([h({reflect:!0,attribute:"data-density"})],f.prototype,"density",2);v([h({type:Boolean,reflect:!0})],f.prototype,"fill",2);v([p()],f.prototype,"rows",2);v([p()],f.prototype,"next",2);v([p()],f.prototype,"screen",2);v([p()],f.prototype,"failed",2);v([p()],f.prototype,"loadingMore",2);v([p()],f.prototype,"layout",2);v([h({attribute:!1})],f.prototype,"extra",2);v([h({type:Boolean})],f.prototype,"hostFilters",2);v([p()],f.prototype,"selected",2);v([p()],f.prototype,"focusIdx",2);v([p()],f.prototype,"menu",2);v([p()],f.prototype,"eligible",2);v([p()],f.prototype,"move",2);v([p()],f.prototype,"moveNote",2);v([p()],f.prototype,"moveError",2);v([p()],f.prototype,"busy",2);v([p()],f.prototype,"toast",2);v([p()],f.prototype,"phone",2);v([p()],f.prototype,"now",2);v([p()],f.prototype,"exporting",2);v([p()],f.prototype,"defaultView",2);v([p()],f.prototype,"sentenceChoice",2);v([h()],f.prototype,"midWidth",2);v([p()],f.prototype,"fitWidth",2);f=v([G("tickets-table")],f);var Ki=Object.defineProperty,Hi=Object.getOwnPropertyDescriptor,ut=(t,e,s,i)=>{for(var a=i>1?void 0:i?Hi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Ki(e,s,a),a};let J=class extends Y{constructor(){super(...arguments),this.module=null,this.manager=!1,this.source=null,this.n=null,this.seq=0}updated(t){(t.has("module")||t.has("source")||t.has("manager"))&&this.load()}allowed(){return!!this.module?.enabled&&Zs(ti(this.module.ui),this.manager)}async load(){const t=Fe.me?.user.id,e=++this.seq;if(!this.allowed()||!t){this.n=null;return}try{const s=await I().list({scope:"mine",status:"open",limit:200});e===this.seq&&(this.n=ei(s.items,t,new Date))}catch{e===this.seq&&(this.n=null)}}render(){const t=this.n;return!t||!this.allowed()||t.open===0?c:o`<div class="kpis" role="group" tabindex="0" aria-label=${lt("myGroup")} data-my-numbers>
      <div class="kpi" data-my="open"><small>${lt("myOpen")}</small><b>${t.open}</b></div>
      <div class=${`kpi${t.waiting?" warn":""}`} data-my="waiting"><small>${lt("myWaiting")}</small><b>${t.waiting}</b></div>
      <div class=${`kpi${t.overdue?" bad":""}`} data-my="overdue"><small>${lt("myOverdue")}</small><b>${t.overdue}</b></div>
      <div class="kpi" data-my="visits"><small>${lt("myVisits")}</small><b>${t.visitsToday}</b></div>
    </div>`}};J.styles=K`
    :host { display: block; }
    /* TICKETS-POLISH-2331: one quiet strip (audit §7.5.4) - the number beside its label on a desktop row of 4; on a phone a horizontal
       strip of compact tiles (the 2 x 2 block pushed the first request below the fold) */
    .kpis:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
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
  `;ut([h({attribute:!1})],J.prototype,"module",2);ut([h({type:Boolean})],J.prototype,"manager",2);ut([h({attribute:!1})],J.prototype,"source",2);ut([p()],J.prototype,"n",2);J=ut([G("tickets-my-numbers")],J);const ie={scopes:{},states:{},departments:{}};function Ui(t){const e={};for(const s of le)e[s]=s==="all"?t.total:t.groups[s]??0;return e}function Vi(t){const e={};for(const s of Ot){const i=t.scopes[s];i&&(e[s]=i.total)}return{scopes:e,states:t.states?Ui(t.states):{},departments:t.departments?.departments??{}}}function ae(t){return t===void 0?"":String(t)}function Gi(t,e,s,i){const a=d=>i({...t,...d}),r=d=>e?.departments[0]?.priorities.find(m=>m.key===d)?.name??n(`prio_${d}`),l=(d,m)=>o`<button type="button" class="rc" aria-pressed=${String(t.assignee===d)} data-f-assignee=${d||"any"} @click=${()=>a({assignee:d})}>${m}</button>`;return o`<div class="tfilters" data-table-filters>
    ${ct(n("fPriority"),o`<div class="fchips" role="group" aria-label=${n("fPriority")}>${Nt.map(d=>o`<button type="button" class="rc" aria-pressed=${String(t.priority.includes(d))} data-f-priority=${d}
      @click=${()=>a({priority:t.priority.includes(d)?t.priority.filter(m=>m!==d):[...t.priority,d]})}>${r(d)}</button>`)}</div>`,"priority")}
    ${ct(n("fAssignee"),o`<div class="fchips" role="group" aria-label=${n("fAssignee")}>${l("",n("fAssigneeAny"))}${l("none",n("fAssigneeNone"))}${l("me",n("fAssigneeMe"))}</div>
      ${s.length?o`<div class="fchips" data-f-holders>${s.map(d=>l(d.key,d.name))}</div>`:c}`,"assignee")}
    <div class="fchips" role="group">
      <button type="button" class="rc" aria-pressed=${String(t.waiting==="manager")} data-f-waiting @click=${()=>a({waiting:t.waiting?"":"manager"})}>${n("fWaiting")}</button>
      <button type="button" class="rc" aria-pressed=${String(t.stuck==="any")} data-f-stuck @click=${()=>a({stuck:t.stuck?"":"any"})}>${n("fStuck")}</button>
    </div>
    ${ue()?ct(V("colCostStatus"),o`<div class="fchips" role="group" aria-label=${V("colCostStatus")}>${fe.map(d=>o`<button type="button" class="rc" aria-pressed=${String(t.cost_status.includes(d))} data-f-cost-status=${d}
      @click=${()=>a({cost_status:t.cost_status.includes(d)?t.cost_status.filter(m=>m!==d):[...t.cost_status,d]})}>${V(`cs_${d}`)}</button>`)}</div>`,"cost"):c}
    <div class="tdates">
      <label>${n("fCreatedFrom")}<input class="inp" type="datetime-local" lang=${tt()} data-f-from .value=${pt(t.created_from)} @change=${d=>a({created_from:yt(d.target.value)})} /></label>
      <label>${n("fCreatedTo")}<input class="inp" type="datetime-local" lang=${tt()} data-f-to .value=${pt(t.created_to)} @change=${d=>a({created_to:yt(d.target.value)})} /></label>
    </div>
  </div>`}function Wi(t,e,s,i){const a=[],r=l=>e?.departments[0]?.priorities.find(d=>d.key===l)?.name??n(`prio_${l}`);if(t.priority.length&&a.push({key:"priority",label:`${n("fPriority")}: ${t.priority.map(r).join(", ")}`,remove:()=>i({...t,priority:[]})}),t.assignee){const l=t.assignee==="none"?n("fAssigneeNone"):t.assignee==="me"?n("fAssigneeMe"):s.find(d=>d.key===t.assignee)?.name??n("fAssignee");a.push({key:"assignee",label:`${n("fAssignee")}: ${l}`,remove:()=>i({...t,assignee:""})})}if(t.waiting&&a.push({key:"waiting",label:n("fWaiting"),remove:()=>i({...t,waiting:""})}),t.stuck&&a.push({key:"stuck",label:n("fStuck"),remove:()=>i({...t,stuck:""})}),t.cost_status.length&&a.push({key:"cost_status",label:`${V("colCostStatus")}: ${t.cost_status.map(l=>V(`cs_${l}`)).join(", ")}`,remove:()=>i({...t,cost_status:[]})}),t.created_from||t.created_to){const l=m=>{const[,S,T]=pt(m).slice(0,10).split("-");return T&&S?`${Number(T)}.${Number(S)}`:""},d=[t.created_from?`${n("fCreatedFrom")}${l(t.created_from)}`:"",t.created_to?`${n("fCreatedTo")} ${l(t.created_to)}`:""].filter(Boolean).join(" ");a.push({key:"created",label:d,remove:()=>i({...t,created_from:"",created_to:""})})}return a}const Xi=K`
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
`;var Ji=Object.defineProperty,Yi=Object.getOwnPropertyDescriptor,N=(t,e,s,i)=>{for(var a=i>1?void 0:i?Yi(e,s):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(a=(i?l(e,s,a):l(a))||a);return i&&a&&Ji(e,s,a),a};let P=class extends Ge{constructor(){super(...arguments),this.r=jt(["tickets","mine"],new URLSearchParams),this.items=null,this.next=null,this.loadingMore=!1,this.view="cards",this.cal=We(),this.fit=null,this.lists=new si(this,()=>{this.cardPage=1,this.onPaged()}),this.rowMax=0,this.counts=ie,this.tableExtra={...it},this.tableHolders=[],this.countSeq=0,this.listKey="",this.extraPages=0,this.live=new me(()=>this.refreshQuiet()),this.clock=0,this.onTicketGone=t=>{this.closeDrawer(),t.detail?.deleted&&this.say(Dt("deletedOne")),t.detail?.deleted&&this.items&&(this.items=this.items.filter(e=>e.id!==t.detail.id)),this.renderRoot.querySelector("tickets-table")?.dropTicket(t.detail?.id??""),this.listKey="",this.reloadIfNeeded(!0)},this.onTicketChanged=t=>{const e=t.detail.ticket;if(!this.items)return;const{description:s,events:i,attachments:a,close_note:r,closed_by_name:l,duplicate_of:d,reopen_until:m,can:S,transitions:T,assignments:x,...kt}=e,mt={...kt,excerpt:s.slice(0,240)};this.items=this.items.map(nt=>nt.id===e.id?mt:nt),this.renderRoot.querySelector("tickets-table")?.patchTicket(e),this.refreshQuiet(),this.renderRoot.querySelector("tickets-table")?.refresh()},this.onCreated=t=>{const e=t.detail;this.say(e.failedPhotos?w("photosFailed",{n:e.failedPhotos}):w(e.result==="absorbed"?"absorbed":"created",{n:e.number}),e.failedPhotos?"bad":"ok"),this.listKey="";const s=this.detailMode()==="fullscreen"?je(e.id):R(this.r.scope,this.r.filters,{t:e.id});e.ticket&&e.assignContact&&e.result==="created"?F(os(s,e.assignContact),!0):e.ticket||e.result==="absorbed"?F(s,!0):F(R(this.r.scope,this.r.filters),!0),this.loadPage(!1)},this.pickMode=t=>{t==="board"?window.location.hash=ii:t==="calendar"?(this.cal=!0,Kt(!0)):(this.cal=!1,Kt(!1),this.setView(t))},this.resetFilters=()=>{this.filters={...Ht},this.tableExtra={...it};const t=this.r.filters;(t.status!==rt.status||t.department)&&this.setFilters({status:rt.status,department:""})}}resetFit(){this.fit=null,this.rowMax=0,this.cardH.clear()}refreshQuiet(){this.screen!=="ready"||this.view!=="cards"&&!this.cal||this.extraPages>0||this.loadingMore||this.loadPage(!1)}connectedCallback(){super.connectedCallback(),this.clock=window.setInterval(()=>this.now=new Date,6e4)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.clock)}pagerRow(){const t=this.pageAt(),e=!!this.next&&t===this.pageCount;return this.pageCount<=1&&!e?c:o`<span class="lpager">
      ${e?o`<button type="button" class="btn sm" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.loadPage(!0)}>${w("loadMore")}</button>`:c}
      ${this.pageCount>1?o`<sw-pager data-tickets-pager .page=${t} .pages=${this.pageCount} @page-change=${s=>this.cardPage=s.detail.page}></sw-pager>`:c}
    </span>`}pagedCards(){return this.paged&&this.lists.paged&&this.view!=="table"&&!this.cal&&this.screen==="ready"}fitTarget(){return this.pagedCards()?this.renderRoot.querySelector("[data-tickets-pages]"):null}measureFit(){const t=this.fitBox;if(!t||!t.isConnected)return;const e=t.querySelector("[data-tickets-grid]"),s=e?[...e.querySelectorAll(":scope > ticket-card")]:[];if(!e||!s.length)return;this.rowMax=Math.max(this.rowMax,...s.map(l=>l.offsetHeight)),this.noteCardHeights(s)&&this.fit&&(this.fit={...this.fit});const a={room:t.clientHeight,cols:Je(e),rowH:this.rowMax,gap:Xe(e)},r=this.fit;(!r||r.room!==a.room||r.cols!==a.cols||r.rowH!==a.rowH||r.gap!==a.gap)&&(this.fit=a)}willUpdate(t){t.has("route")&&this.route&&(this.r=jt(this.route.segments,this.route.params),Be(this.r.scope),this.r.ticketId&&(this.drawerUsed=!0),this.syncSearch(this.r.filters.q),(this.screen==="ready"||this.screen==="error")&&this.reloadIfNeeded(),this.firstPageOn(`${this.r.scope}|${JSON.stringify(this.r.filters)}`)),t.has("filters")&&(this.cardPage=1)}boot(){return ce().then(t=>this.view=t.view==="table"?"table":"cards"),super.boot()}async loadMeta(){this.meta=await I().meta()}key(){const t=this.r.filters;return`${this.r.scope}|${t.status}|${t.department}|${t.q.trim()}`}reloadIfNeeded(t=!1){const e=this.key();!t&&e===this.listKey||(this.listKey=e,this.loadPage(!1))}async loadPage(t){const e=++this.seq,s=this.r.filters;t?(this.loadingMore=!0,this.extraPages++):(this.extraPages=0,this.items===null&&(this.screen="loading"));try{const i=await I().list({scope:this.r.scope,status:s.status,department_id:s.department||void 0,q:s.q,cursor:t?this.next:null});if(e!==this.seq)return;this.items=t?[...this.items??[],...i.items.filter(a=>!(this.items??[]).some(r=>r.id===a.id))]:i.items,this.next=i.next_cursor,this.screen="ready",t||this.loadCounts()}catch(i){e===this.seq&&this.fail(i)}finally{e===this.seq&&(this.loadingMore=!1)}}scopes(){const e=[...Ke(dt(),Ue)];return e.includes(this.r.scope)||e.splice(Ot.indexOf(this.r.scope),0,this.r.scope),e}async loadCounts(){const t=++this.countSeq,e=this.r.filters,s=Xs(),i={q:e.q,department_id:e.department||void 0},a=async x=>x.catch(()=>null),[r,l,d,m,S]=await Promise.all([...Ot.map(x=>this.scopes().includes(x)?a(s.facets({...i,scope:x,status:e.status})):Promise.resolve(null)),a(s.facets({...i,scope:this.r.scope,status:"all"})),e.department?a(s.facets({q:e.q,scope:this.r.scope,status:e.status})):Promise.resolve(null)]);if(t!==this.countSeq)return;const T={mine:r,department:l,all:d}[this.r.scope];this.counts=Vi({scopes:{mine:r,department:l,all:d},states:m,departments:e.department?S:T})}setFilters(t,e=!1){const s={...this.r.filters,...t};F(R(this.r.scope,s,{t:this.r.ticketId||void 0}),e)}searchTo(t){this.setFilters({q:t},!0)}openHref(t){return R(this.r.scope,this.r.filters,{t})}plainHref(){return R(this.r.scope,this.r.filters)}setView(t){this.view=t,qt({view:t})}chips(t){const e=this.r.filters,s=[];if(e.status!==rt.status&&s.push({key:"status",label:q("tbChipState",{name:Bt(e.status)}),remove:()=>this.setFilters({status:rt.status})}),e.department){const i=this.meta?.departments.find(a=>a.id===e.department);s.push({key:"department",label:i?i.name:q("tbDept"),remove:()=>this.setFilters({department:""})})}return t?s.push(...Ye(this.items??[],this.filters,i=>this.filters=i)):s.push(...Wi(this.tableExtra,this.meta,this.tableHolders,i=>this.tableExtra=i)),s}panelBody(t,e){const s=this.r.filters,i=this.counts,a=this.meta?.departments??[],r=Object.values(i.departments).reduce((d,m)=>d+m,0),l=Object.keys(i.departments).length>0;return o`
      ${ct(q("tbState"),o`<div class="fchips stf" role="radiogroup" aria-label=${w("stateFilter")}>
        ${le.map(d=>o`<button type="button" class="rc" role="radio" aria-checked=${String(s.status===d)} data-status-filter=${d} @click=${()=>this.setFilters({status:d})}>${Bt(d)}${e(i.states[d])}</button>`)}
      </div>`,"state")}
      ${a.length>1?ct(q("tbDept"),o`<div class="fchips" role="group" aria-label=${w("departmentsGroup")}>
        <button type="button" class="rc" aria-pressed=${String(!s.department)} data-dept="" @click=${()=>this.setFilters({department:""})}>${w("allDepartments")}${l?e(r):c}</button>
        ${a.map(d=>o`<button type="button" class="rc" aria-pressed=${String(s.department===d.id)} data-dept=${d.id} @click=${()=>this.setFilters({department:d.id})}>${O(d.name)}${l?e(i.departments[d.id]??0):c}</button>`)}
      </div>`,"department"):c}
      ${t&&this.screen==="ready"?Qe(this.items??[],this.filters,d=>this.filters=d):c}
      ${!t&&this.screen==="ready"?Gi(this.tableExtra,this.meta,this.tableHolders,d=>this.tableExtra=d):c}`}header(){const t=this.screen==="ready"||this.screen==="loading",e=!!this.meta?.can.create,s=this.counts,i=this.counts===ie,a=x=>x===void 0?i?o`<small aria-hidden="true" style="visibility:hidden">00</small>`:c:o`<small>${ae(x)}</small>`,r=x=>x===void 0?i?"  ":void 0:ae(x),l=this.view!=="table"||this.cal,d=this.chips(l),m=!this.meta&&this.screen==="loading",S=this.r.filters,T=this.filterOpen?ai(this.panelBody(l,a),d.length,this.resetFilters,()=>this.filterOpen=!1):c;return o`${t?o`<div class="pact" slot="actions">
          ${Ze(this.cal?"calendar":l?"cards":"table",!!this.meta?.can.manage,this.pickMode)}
          ${m?o`<span class="btn primary newbtn" aria-hidden="true" style="visibility:hidden">${g("plus")}<span class="lbl">${w("newShort")}</span></span>`:c}
          ${e?o`<button type="button" class="btn primary newbtn" data-new aria-label=${w("newTitle")} @click=${()=>F(R(this.r.scope,this.r.filters,{create:!0}),!1)}>${g("plus")}<span class="lbl">${w("newShort")}</span></button>`:c}
        </div>`:c}
    <header class="dh" data-tickets-header>
      ${t?o`<div class="dh-det tb" role="group" aria-label=${q("lfGroup")} data-toolbar>
        <sw-segmented class="scope" radio size="sm" label=${q("lsScopeGroup")} data-scope-seg value=${this.r.scope} @change=${x=>F(R(x.detail.value,S),!1)}
          .options=${this.scopes().map(x=>({value:x,label:He(x),count:r(s.scopes[x]),attrs:{"data-scope":x}}))}></sw-segmented>
        <label class="search">${g("search")}<span class="vh">${w("searchShort")}</span><input type="search" data-search maxlength="80" placeholder=${this.phone?w("searchShort"):q("lsSearchLong")} .value=${this.q} @input=${x=>this.onSearch(x.target.value)} /></label>
        <span class="fanchor">
          ${oi(this.filterOpen,d.length,()=>this.filterOpen=!this.filterOpen)}
          ${this.phone?c:T}
        </span>
        ${ni(d,this.resetFilters)}
        <span class="qchips">
          <tickets-intake-chip @ticket-changed=${()=>this.reloadIfNeeded(!0)}></tickets-intake-chip>
          ${this.meta?.can.manage?o`<tickets-inbound-chip manager @ticket-changed=${()=>this.reloadIfNeeded(!0)}></tickets-inbound-chip>`:c}
        </span>
        ${this.pagedCards()?this.pagerRow():c}
        ${this.phone?T:c}
      </div>`:c}
    </header>`}body(){switch(this.screen){case"loading":{const r=o`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:var(--sw-r-2xl)"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`,l=o`<ticket-card skeleton></ticket-card>`;return this.cal?o`<div data-tickets-state="loading" aria-busy="true" data-cal-loading><div class="cgrid">${Array.from({length:this.phone?2:7},()=>r)}</div></div>`:o`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>l)}</div></div>`}case"off":return this.stateBox("ticket",w("moduleOff"),"off",zt("system.configure")?o`<a class="btn sm" href="#/system/tickets" data-open-settings>${g("settings")}${w("toSettings")}</a>`:void 0);case"forbidden":return this.stateBox("lock",w("forbidden"),"forbidden");case"error":return this.stateBox("warning",w("loadFailed"),"error",o`${this.failed?o`<span class="vh" data-error-detail>${this.failed}</span>`:c}<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.items=null,this.boot()}}>${g("refresh")}${w("retry")}</button>`)}if(this.view==="table"&&!this.cal){const r=this.r.filters;return o`<tickets-table ?fill=${!this.phone} hostFilters .extra=${this.tableExtra} .midWidth=${this.module?.ui?.table_mid_width??""} .scope=${this.r.scope} .base=${{status:r.status,department:r.department,q:r.q}} .meta=${this.meta} .hrefOf=${l=>this.hrefOf(l)}
        .picked=${this.r.ticketId} @table-filters=${l=>this.setFilters(l.detail)}
        @table-extra=${l=>this.tableExtra=l.detail.extra} @table-holders=${l=>this.tableHolders=l.detail.holders}></tickets-table>`}const t=this.items??[],e=this.r.filters;if(!t.length){if(e.q.trim()!==""||e.department!==""||e.status!=="open")return this.stateBox("search",w("emptyFiltered"),"no-match",o`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters({...rt})}>${w("clearFilters")}</button>`);if(this.r.scope==="department"&&this.meta&&!this.meta.departments.some(d=>d.my_role))return this.stateBox("users",w("noDepartments"),"no-departments");const l=this.r.scope==="mine"?w("emptyMine"):this.r.scope==="department"?w("emptyDepartment"):w("emptyAll");return this.stateBox("ticket",l,"empty",this.meta?.can.create?o`<button type="button" class="btn primary" data-new-empty @click=${()=>F(R(this.r.scope,this.r.filters,{create:!0}),!1)}>${g("plus")}${w("newTitle")}</button>`:void 0)}const s=this.detailMode()!=="drawer",i=ts(t,this.filters);if(!i.length)return o`${this.stateBox("search",q("lfNoMatch"),"no-match-filters",o`<button type="button" class="btn sm" data-clear-card-filters @click=${()=>this.filters={...Ht}}>${g("x")}${q("lfClear")}</button>`)}
      ${this.next?o`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.loadPage(!0)}>${w("loadMore")}</button></div>`:c}`;if(this.cal)return o`<tickets-calendar .items=${i} .now=${this.now} .hrefOf=${r=>this.hrefOf(r)} .roleOf=${r=>Et(r,this.meta)}
        .hasMore=${!!this.next} .loadingMore=${this.loadingMore} .openId=${this.r.ticketId} @cal-load-more=${()=>void this.loadPage(!0)}></tickets-calendar>`;const a=r=>o`<div class="cgrid" data-tickets-grid>${Tt(r,l=>l.id,l=>o`<ticket-card .item=${l} .role=${Et(l,this.meta)} .now=${this.now} .href=${this.hrefOf(l.id)} .timelineHref=${this.hrefOf(l.id,!0)} .fullScreen=${s} ?data-picked=${this.r.ticketId===l.id} @card-action=${this.onCardAction}></ticket-card>`)}</div>`;if(this.pagedCards()){const r=this.fit,l=r?es([{id:"list",head:!1,groups:[{key:"all",sub:!1,items:i,cols:r.cols,rowH:r.rowH,gap:r.gap,heightOf:S=>this.cardH.get(S.id)}]}],{room:r.room,headH:0,subH:0,secGap:0,inGap:0,blkGap:0}):[];this.pageCount=Math.max(1,l.length);const d=this.pageAt(),m=r?l[d-1]?.[0]?.groups[0]?.items??[]:i;return o`<div class="pgbox" data-tickets-pages data-page=${d} data-pages=${this.pageCount}>${a(m)}</div>`}return o`${a(i)}
      ${this.next?o`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${()=>void this.loadPage(!0)}>${w("loadMore")}</button></div>`:c}`}render(){const t=this.module?.ui,e=!!this.r.ticketId&&this.screen==="ready";this.pageCount=1;const s=this.body();return o`<sw-page class="page" wide data-screen="tickets-list" data-scope=${this.r.scope} heading=${w("area")} data-tickets-title=${w("area")}>
      ${this.header()}
      <div class=${`scr${this.view==="table"&&!this.cal&&this.screen==="ready"?" fill":""}${this.pagedCards()?" paged":""}`} data-tickets-scroll>
        ${this.r.scope==="mine"&&this.screen==="ready"?o`<tickets-my-numbers .module=${this.module} .manager=${!!this.meta?.can.manage} .source=${this.items}></tickets-my-numbers>`:c}
        ${s}
      </div>
    </sw-page>
    ${this.drawerUsed&&this.module?.enabled?o`<ticket-detail mode="drawer" .open=${e} .ticketId=${this.r.ticketId} .detailMode=${t?.detail??"drawer_fullscreen"} .scope=${this.r.scope} .focusTimeline=${this.route?.params.get("view")==="timeline"} .initialTab=${this.route?.params.get("tab")??""}
      .defaultTab=${t?.detail_tab??""} .sizeSetting=${t?.drawer_size??""} .sheetSetting=${t?.phone_sheet??""} .cameraViewfinder=${t?.camera_viewfinder===!0} .assignContact=${ns(this.route?.params.get("assign"))}
      @assign-consumed=${()=>F(R(this.r.scope,this.r.filters,{t:this.r.ticketId}),!0)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${this.onTicketChanged} @ticket-gone=${this.onTicketGone}></ticket-detail>`:c}
    ${this.module?.enabled&&this.meta?.can.create?o`<ticket-create .open=${this.r.creating&&this.screen==="ready"} .meta=${this.meta} .mode=${t?.new_ticket??"sheet"} .scope=${this.r.scope} .detailMode=${t?.detail??"drawer_fullscreen"}
      @close=${()=>F(R(this.r.scope,this.r.filters),!1)} @created=${this.onCreated}></ticket-create>`:c}
    ${this.toastView()}`}};P.styles=[ot,...at,li,ss,ri,Xi,is,K`
    .more {
      display: flex;
      justify-content: center;
      padding-block: 4px;
    }
    /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header (the title row
       and the ONE toolbar) the numbers and the requests scroll in their own region - the page itself never scrolls and the controls stay
       in place. In the table view the region does not scroll at all: the table card fills it and scrolls its rows under its sticky head.
       On a phone the region is transparent (display: contents) and the page scrolls, the header compacting over it. */
    @media (min-width: 768px) {
      .scr.fill {
        overflow: hidden;
        padding-block-end: 20px;
      }
      .scr.fill > tickets-table {
        flex: 1 1 auto;
        min-block-size: 0;
      }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5): on a desktop the cards view is paged - the
       numbers stay, the cards take the room left (.pgbox: its height is set by the layout, never by the cards) and show the rows that fit;
       the pager is on the toolbar row. The region keeps overflow: auto only as the fallback of a window shorter than one row of cards. */
    .lpager {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: none;
    }
    @media (min-width: 1024px) {
      .scr.paged {
        padding-block-end: 20px;
      }
      .scr.paged > .pgbox {
        flex: 1 1 0;
        min-block-size: 0;
      }
      .pgbox > .cgrid {
        align-content: start;
      }
    }
    .qchips {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: none;
      margin-inline-start: auto;
    }
    @media (max-width: 767px) {
      /* the frame's actions take their own row under the title from the first frame: the view switch grows by the manager-only views
         when the meta arrives, and a row that fitted beside the title before then wrapped under it, pushing the whole list down
         (layout-a11y-295: CLS 0.159 on a phone). Wider than the room beside any title, never wider than the row. */
      .pact {
        min-inline-size: calc(100vw - 100px);
        justify-content: flex-start;
      }
      .qchips {
        order: 2;
        margin-inline-start: 0;
      }
    }
  `,ci];N([p()],P.prototype,"r",2);N([p()],P.prototype,"items",2);N([p()],P.prototype,"next",2);N([p()],P.prototype,"loadingMore",2);N([p()],P.prototype,"view",2);N([p()],P.prototype,"cal",2);N([p()],P.prototype,"fit",2);N([p()],P.prototype,"counts",2);N([p()],P.prototype,"tableExtra",2);N([p()],P.prototype,"tableHolders",2);P=N([G("tickets-list")],P);export{P as TicketsList};
