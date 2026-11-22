import{cw as m,g as tt,ax as k,j as p,e2 as st,i as et,b as l,A as w,k as it,bY as lt,bA as _,aL as ht,em as ct,a2 as D,eR as dt,p as pt,eK as ut,eU as N,n as z,a as I,eV as mt,eW as ft,d as gt,ej as E,Y as R,eS as F,eM as M,eX as B,eY as wt,eN as vt,ey as bt,aU as yt,aV as $t}from"./index-CPuzFb4-.js";import{s as xt,c as U}from"./recorders-CgiLAnPO.js";import"./sw-chip-BxeC7rRE.js";import{s as q,m as T}from"./sw-timeline-DSKMHcCU.js";import"./sw-case-picker-BPJQPWKC.js";import{s as j,B as G,q as H}from"./cases-DinSfMbS.js";import{i as $,f as kt,d as L,m as v,b as St,r as zt,s as Mt,e as At,g as V,c as _t,h as Pt,j as Dt,a as Et,k as Tt,p as K}from"./recordings-DEhc9qm_.js";import{L as It}from"./latest-DjG5XH9h.js";import{R as Rt}from"./memo-CyxK7byc.js";import{b as W,g as Lt,f as C}from"./exports-DzomOP2G.js";import{m as Ct,E as Ot,n as qt}from"./events-Dvmtnflm.js";import{I as Nt}from"./investigate-r5-css-vaBeKLxb.js";import{t as a}from"./investigate-CVxpGUgO.js";import"./sw-logo-art-PLtEZJxU.js";import"./bytes-QYSxC3WX.js";const Ft=[m("א׳"),m("ב׳"),m("ג׳"),m("ד׳"),m("ה׳"),m("ו׳"),m("ש׳")],at=[m("ראשון"),m("שני"),m("שלישי"),m("רביעי"),m("חמישי"),m("שישי"),m("שבת")],rt=[m("ינואר"),m("פברואר"),m("מרץ"),m("אפריל"),m("מאי"),m("יוני"),m("יולי"),m("אוגוסט"),m("ספטמבר"),m("אוקטובר"),m("נובמבר"),m("דצמבר")],nt=s=>String(s).padStart(2,"0");function P(s){return s.slice(0,7)}function Bt(s){const[t,e]=s.split("-").map(Number);return new Date(Date.UTC(t,e,0)).getUTCDate()}function Ut(s,t){const[e,i]=s.split("-").map(Number),r=e*12+(i-1)+t;return`${Math.floor(r/12)}-${nt(r%12+1)}`}function jt(s){const[t,e,i]=s.split("-").map(Number);return new Date(Date.UTC(t,e-1,i)).getUTCDay()}function Gt(s){const[t,e]=s.split("-").map(Number);return`${rt[e-1]} ${t}`}function Y(s,t){const e=Bt(s),i=jt(`${s}-01`),r=new Set(t.recorded),n=Array.from({length:i},()=>null);for(let h=1;h<=e;h++){const o=`${s}-${nt(h)}`,d=o>t.today?"future":t.loaded?r.has(o)?"recorded":"empty":"unknown";n.push({date:o,day:h,weekday:(i+h-1)%7,state:d,today:o===t.today,selected:o===t.selected})}return n}function J(s,t){return s<P(t)}function Ht(s){const[t,e]=s.date.split("-").map(Number),i=m("יום {weekday}, {day} ב{month} {year}",{weekday:at[s.weekday],day:s.day,month:rt[e-1],year:t}),r={recorded:m("יש הקלטות"),empty:m("אין הקלטות"),future:m("עתידי"),unknown:m("בבדיקה")}[s.state];return`${i} · ${r}${s.today?` · ${m("היום")}`:""}`}function Vt(s,t){const e=s===0?m("אין ימים עם הקלטות בחודש זה"):s===1?m("יום אחד עם הקלטות"):m("{n} ימים עם הקלטות",{n:s});return t==="partial"?`${e} · ${m("ייתכן שחסרים ימים (החיפוש הוגבל)")}`:e}var Kt=Object.defineProperty,Wt=Object.getOwnPropertyDescriptor,y=(s,t,e,i)=>{for(var r=i>1?void 0:i?Wt(t,e):t,n=s.length-1,h;n>=0;n--)(h=s[n])&&(r=(i?h(t,e,r):h(r))||r);return i&&r&&Kt(t,e,r),r};let b=class extends et{constructor(){super(...arguments),this.value="",this.today="",this.loader=null,this.disabled=!1,this.open=!1,this.month="",this.answer=null,this.error="",this.sheet=!1,this.focusDate="",this.seq=0,this.cache=new Map,this.openAtPress=!1,this.onViewport=()=>this.place()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onViewport)}willUpdate(s){s.has("loader")&&s.get("loader")!==void 0&&(this.cache.clear(),this.open&&this.load(this.month))}toggle(){const s=this.open||this.openAtPress;this.openAtPress=!1,s?this.close():this.show()}async show(){this.disabled||(this.month=P(this.value||this.today),this.focusDate=this.value||this.today,this.sheet=window.matchMedia("(max-width: 600px)").matches,this.open=!0,await this.updateComplete,this.pop.showPopover?.(),this.place(),window.addEventListener("resize",this.onViewport),this.load(this.month),this.focusDay(!1))}close(s=!0){if(this.open){this.open=!1,window.removeEventListener("resize",this.onViewport);try{this.pop?.hidePopover?.()}catch{}s&&this.trigger?.focus({preventScroll:!0})}}place(){if(!this.pop)return;if(this.sheet=window.matchMedia("(max-width: 600px)").matches,this.sheet){this.pop.style.removeProperty("left"),this.pop.style.removeProperty("top");return}const s=this.trigger.getBoundingClientRect(),t=this.pop.offsetWidth,e=this.pop.offsetHeight;let r=getComputedStyle(this).direction==="rtl"?s.right-t:s.left;r=Math.max(8,Math.min(r,window.innerWidth-t-8));let n=s.bottom+6;n+e>window.innerHeight-8&&(n=Math.max(8,s.top-e-6)),this.pop.style.left=`${Math.round(r)}px`,this.pop.style.top=`${Math.round(n)}px`}onToggle(s){s.newState==="closed"&&this.open&&(this.open=!1,window.removeEventListener("resize",this.onViewport))}async load(s){const t=++this.seq;this.error="";const e=this.cache.get(s);if(this.answer=e??null,!(e||!this.loader)){if(s>P(this.today)){this.answer={days:[],coverage:"complete"};return}try{const i=await this.loader(s);this.cache.set(s,i),t===this.seq&&(this.answer=i)}catch(i){t===this.seq&&(this.error=i instanceof Error&&i.message?i.message:m("בדיקת ההקלטות נכשלה"))}}}go(s){const t=Ut(this.month,s);if(s>0&&!J(this.month,this.today))return;this.month=t;const e=Number(this.focusDate.slice(8,10))||1;this.focusDate=this.clampToMonth(t,e),this.load(t)}clampToMonth(s,t){const e=Y(s,{recorded:[],today:this.today,loaded:!1}).filter(n=>!!n),i=Math.min(t,e.length),r=`${s}-${String(i).padStart(2,"0")}`;return r>this.today?this.today:r}pick(s){s.state!=="future"&&(this.dispatchEvent(new CustomEvent("pick",{detail:{date:s.date,recorded:s.state==="recorded"},bubbles:!0,composed:!0})),this.close())}onGridKey(s){const t=getComputedStyle(this).direction==="rtl",e={ArrowRight:t?-1:1,ArrowLeft:t?1:-1,ArrowUp:-7,ArrowDown:7};let i=this.focusDate;if(s.key in e){const[r,n,h]=this.focusDate.split("-").map(Number);i=new Date(Date.UTC(r,n-1,h+e[s.key])).toISOString().slice(0,10)}else if(s.key==="PageUp"||s.key==="PageDown"){this.go(s.key==="PageUp"?-1:1),s.preventDefault(),this.updateComplete.then(()=>this.focusDay(!0));return}else return;s.preventDefault(),!(i>this.today)&&(this.focusDate=i,P(i)!==this.month&&(this.month=P(i),this.load(this.month)),this.updateComplete.then(()=>this.focusDay(!0)))}focusDay(s){const t=()=>this.renderRoot.querySelector(`.day[data-date="${this.focusDate}"]`)?.focus({preventScroll:!0});s?t():this.updateComplete.then(()=>requestAnimationFrame(t))}renderGrid(){const s=Y(this.month,{recorded:this.answer?.days??[],today:this.today,selected:this.value,loaded:!!this.answer}),t=s.some(e=>e?.date===this.focusDate)?this.focusDate:s.find(e=>e&&e.state!=="future")?.date??"";return l`<div class="grid" role="grid" aria-labelledby="t" aria-busy=${this.answer||this.error?"false":"true"} @keydown=${e=>this.onGridKey(e)}>
      ${Ft.map((e,i)=>l`<span class="wd" role="columnheader" aria-label=${at[i]}>${e}</span>`)}
      ${s.map(e=>e?l`<button
              class="day"
              role="gridcell"
              data-date=${e.date}
              data-state=${e.state}
              ?data-today=${e.today}
              aria-current=${e.selected?"date":w}
              aria-label=${Ht(e)}
              tabindex=${e.date===t?0:-1}
              ?disabled=${e.state==="future"}
              @click=${()=>this.pick(e)}
            >${e.day}</button>`:l`<span aria-hidden="true"></span>`)}
    </div>`}renderFoot(){return this.error?l`<div class="foot" data-error role="status"><span class="msg">${this.error}</span><button class="retry" @click=${()=>{this.cache.delete(this.month),this.load(this.month)}}>${m("נסה שוב")}</button></div>`:this.answer?l`<div class="foot" role="status" ?data-partial=${this.answer.coverage==="partial"}><span class="msg" data-summary>${Vt(this.answer.days.length,this.answer.coverage)}</span></div>`:l`<div class="foot" role="status"><span class="msg">${m("בודק אילו ימים הוקלטו…")}</span></div>`}render(){return l`
      <button
        class="trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded=${this.open?"true":"false"}
        aria-label=${m("לוח חודשי · ימים עם הקלטות")}
        title=${m("לוח חודשי · ימים עם הקלטות")}
        ?disabled=${this.disabled}
        @pointerdown=${()=>this.openAtPress=this.open}
        @click=${()=>this.toggle()}
      >
        <sw-icon name="calendar" size="18"></sw-icon>
      </button>
      <div class="pop ${this.sheet?"sheet":""}" popover="auto" role="dialog" aria-label=${m("ימים עם הקלטות")} @toggle=${s=>this.onToggle(s)}>
        ${this.open?l`
              <div class="head">
                <button class="nav prev" type="button" aria-label=${m("החודש הקודם")} @click=${()=>this.go(-1)}><sw-icon name="chevron" size="18"></sw-icon></button>
                <h2 class="title" id="t" aria-live="polite">${Gt(this.month)}</h2>
                <button class="nav next" type="button" aria-label=${m("החודש הבא")} ?disabled=${!J(this.month,this.today)} @click=${()=>this.go(1)}><sw-icon name="chevron" size="18"></sw-icon></button>
              </div>
              ${this.renderGrid()} ${this.renderFoot()}
            `:w}
      </div>
    `}};b.styles=tt`
    :host {
      display: inline-flex;
    }
    .trigger {
      display: inline-grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    @media (hover: hover) {
      .trigger:hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .trigger:active {
      transform: scale(0.96);
    }
    .trigger[aria-expanded='true'] {
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
    }
    .trigger:disabled {
      opacity: 0.45;
      cursor: default;
    }
    @media (max-width: 1100px), (pointer: coarse) {
      .trigger {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }

    .pop {
      position: fixed;
      inset: auto;
      margin: 0;
      box-sizing: border-box;
      inline-size: 296px;
      padding: 12px;
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-menu-surface);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-3);
      overflow: hidden;
      transform-origin: top center;
      transition: opacity var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    @starting-style {
      .pop:popover-open {
        opacity: 0;
        transform: scale(0.97) translateY(-4px);
      }
    }
    .pop.sheet {
      inset-inline: 0;
      inset-block: auto 0;
      inline-size: auto;
      padding: 14px 16px calc(16px + env(safe-area-inset-bottom, 0px));
      border-radius: var(--sw-r-xl) var(--sw-r-xl) 0 0;
      transform-origin: bottom center;
    }
    @starting-style {
      .pop.sheet:popover-open {
        opacity: 1;
        transform: translateY(24px);
      }
    }
    .pop::backdrop {
      background: transparent;
    }
    .pop.sheet::backdrop {
      background: rgb(0 0 0 / 0.32);
    }

    .head {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-block-end: 8px;
    }
    .title {
      flex: 1;
      margin: 0;
      text-align: center;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .nav {
      display: inline-grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    @media (hover: hover) {
      .nav:not(:disabled):hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .nav:disabled {
      opacity: 0.3;
      cursor: default;
    }
    /* the chevron icon points right: in RTL "previous" sits on the right and points right, "next" on the left points left */
    .nav.next sw-icon {
      transform: scaleX(-1);
    }
    :host(:dir(ltr)) .nav.prev sw-icon {
      transform: scaleX(-1);
    }
    :host(:dir(ltr)) .nav.next sw-icon {
      transform: none;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      /* the weekday row + six weeks, always: a month never changes the card's height */
      grid-template-rows: 22px repeat(6, var(--cell));
      gap: 2px;
      --cell: 36px;
    }
    .pop.sheet .grid {
      --cell: 44px;
    }
    .wd {
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
    }
    .day {
      position: relative;
      display: grid;
      place-items: center;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-3);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
    }
    .day[data-state='recorded'] {
      background: var(--sw-accent-soft);
      color: var(--sw-recorded-text, var(--sw-accent-text));
      font-weight: var(--sw-fw-semibold);
    }
    /* the recorded mark is also a shape (a dot under the number), not only a colour */
    .day[data-state='recorded']::after {
      content: '';
      position: absolute;
      inset-block-end: 4px;
      inline-size: 4px;
      block-size: 4px;
      border-radius: 50%;
      background: currentColor;
    }
    .day[data-state='unknown'] {
      color: var(--sw-text-3);
      animation: pulse 1.2s var(--sw-ease-in-out, ease-in-out) infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 0.45; }
      to { opacity: 0.9; }
    }
    @media (prefers-reduced-motion: reduce) {
      .day[data-state='unknown'] {
        animation: none;
      }
      .pop,
      .trigger {
        transition: none;
      }
    }
    @media (hover: hover) {
      .day:not(:disabled):not([aria-current='date']):hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
      .day[data-state='recorded']:not([aria-current='date']):hover {
        background: var(--sw-accent-soft);
        box-shadow: inset 0 0 0 1px var(--sw-accent);
      }
    }
    .day[data-today] {
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    .day[aria-current='date'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-bold);
    }
    .day:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 28px;
      margin-block-start: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .foot .msg {
      flex: 1;
      min-inline-size: 0;
    }
    .foot[data-partial] .msg {
      color: var(--sw-warning-text);
    }
    .foot[data-error] .msg {
      color: var(--sw-danger-text);
    }
    .retry {
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 4px 10px;
      cursor: pointer;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;y([k()],b.prototype,"value",2);y([k()],b.prototype,"today",2);y([k({attribute:!1})],b.prototype,"loader",2);y([k({type:Boolean,reflect:!0})],b.prototype,"disabled",2);y([p()],b.prototype,"open",2);y([p()],b.prototype,"month",2);y([p()],b.prototype,"answer",2);y([p()],b.prototype,"error",2);y([p()],b.prototype,"sheet",2);y([p()],b.prototype,"focusDate",2);y([st(".pop")],b.prototype,"pop",2);y([st(".trigger")],b.prototype,"trigger",2);b=y([it("sw-recorded-month")],b);const S={stallS:5,attempts:3,graceMs:2e3,backoffMs:[3e3,6e3],attemptTimeoutMs:2e4,stableMs:3e4,epsilon:.05};function X(s){const t=(e,i,r,n)=>{const h=Number(e);return Number.isFinite(h)?Math.min(n,Math.max(r,Math.round(h))):i};return{stallMs:t(s["playback.stall_s"],S.stallS,2,30)*1e3,maxAttempts:t(s["playback.auto_resume_attempts"],S.attempts,0,5)}}class Z{constructor(t){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks=new Map,this.since=0,this.wait=0,this.pending=!1,this.sentAt=0,this.fault=!1,this.okSince=0,this.o={graceMs:S.graceMs,backoffMs:[...S.backoffMs],attemptTimeoutMs:S.attemptTimeoutMs,stableMs:S.stableMs,epsilon:S.epsilon,...t}}get options(){return this.o}reset(t){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks.clear(),this.pending=!1,this.fault=!1,this.okSince=t}disarm(t,e){const i=this.tracks.get(t);i&&(i.armed=!1,i.at=e)}lost(){this.fault=!0}attemptSent(t){this.phase==="reconnecting"&&(this.pending=!1,this.sentAt=t,this.fault=!1,this.disarmAll(t))}attemptFailed(t){this.phase==="reconnecting"&&this.failAttempt(t)}retry(t){this.attempts=0,this.pending=!1,this.fault=!1,this.phase="stalled",this.since=t,this.wait=0}step(t,e,i){const r=this.o.epsilon;let n=!1,h=!1;const o=new Set;for(const u of e){o.add(u.key);const g=this.tracks.get(u.key);if(!g){this.tracks.set(u.key,{last:u.mediaTime,at:t,armed:!1});continue}if(!i.expect||!u.playing){g.armed=!1,g.last=u.mediaTime,g.at=t;continue}u.mediaTime>g.last+r?(g.armed=!0,g.last=u.mediaTime,g.at=t,n=!0):u.mediaTime<g.last-r?(g.armed=!1,g.last=u.mediaTime,g.at=t):g.armed&&t-g.at>=this.o.stallMs&&(h=!0)}for(const u of[...this.tracks.keys()])o.has(u)||this.tracks.delete(u);const d=this.fault;switch(this.fault=!1,this.phase){case"ok":return i.expect?h||d?(this.phase="stalled",this.since=t,this.wait=this.attempts===0?this.o.graceMs:this.backoff(this.attempts),this.dueAttempt(t,i)):(this.attempts>0&&n&&t-this.okSince>=this.o.stableMs&&(this.attempts=0),"none"):"none";case"stalled":return i.expect?n&&!h&&!d?(this.phase="ok",this.okSince=t,"none"):this.dueAttempt(t,i):(this.phase="ok",this.okSince=t,"none");case"reconnecting":return this.pending?"none":n&&!h?(this.phase="ok",this.resumes+=1,this.okSince=t,"none"):d||t-this.sentAt>=this.o.attemptTimeoutMs?(this.failAttempt(t),this.phase==="stalled"?this.dueAttempt(t,i):"none"):"none";case"gave_up":default:return"none"}}dueAttempt(t,e){return this.attempts>=this.o.maxAttempts?(this.phase="gave_up","none"):t-this.since<this.wait||!e.canAct?"none":(this.phase="reconnecting",this.attempts+=1,this.pending=!0,this.sentAt=t,"resume")}failAttempt(t){if(this.pending=!1,this.attempts>=this.o.maxAttempts){this.phase="gave_up";return}this.phase="stalled",this.since=t,this.wait=this.backoff(this.attempts)}backoff(t){const e=this.o.backoffMs;return e.length?e[Math.min(e.length-1,Math.max(0,t-1))]:0}disarmAll(t){for(const e of this.tracks.values())e.armed=!1,e.at=t}}const Q=10;function Yt(s,t){const e=Math.floor(t.getTime()/(Q*1e3))*Q*1e3,i=_(e);return{key:`${s}|${i}`,atIso:i}}const Jt=async(s,t)=>{const e=await lt(s,{signal:t});return e.ok?{ok:!0,blob:await e.blob(),at:e.headers.get("X-Frame-At")}:{ok:!1,status:e.status}};class Xt{constructor(t){this.opts=t,this.cache=new Map,this.noRecording=new Set,this.flights=new Map,this.waiting=null,this.seq=0,this.stats={requests:0,aborted:0,deduped:0},this.state={key:null,url:null,at:null,loading:!1,none:!1},this.maxConcurrent=Math.max(1,t.maxConcurrent??2),this.cacheSize=Math.max(4,t.cacheSize??40),this.makeUrl=t.makeUrl??(e=>URL.createObjectURL(e)),this.revokeUrl=t.revokeUrl??(e=>URL.revokeObjectURL(e))}want(t,e){const i=this.cache.get(t);if(i){this.cache.delete(t),this.cache.set(t,i),this.stats.deduped+=1,this.waiting=null,this.set({key:t,url:i.url,at:i.at,loading:!1,none:!1});return}if(this.noRecording.has(t)){this.stats.deduped+=1,this.waiting=null,this.set({key:t,url:this.state.url,at:this.state.at,loading:!1,none:!0});return}if(this.set({key:t,url:this.state.url,at:this.state.at,loading:!0,none:!1}),this.flights.has(t)){this.stats.deduped+=1,this.waiting=null;return}this.waiting={key:t,url:e},this.pump()}clear(){this.waiting=null;for(const t of this.flights.values())t.ctrl.abort(),this.stats.aborted+=1;this.flights.clear(),this.set({key:null,url:null,at:null,loading:!1,none:!1})}dispose(){this.clear();for(const t of this.cache.values())this.revokeUrl(t.url);this.cache.clear(),this.noRecording.clear()}get inFlight(){return this.flights.size}set(t){this.state=t,this.opts.onChange(t)}pump(){const t=this.waiting;if(!t)return;if(this.flights.size>=this.maxConcurrent){const r=[...this.flights.values()].filter(n=>n.key!==this.state.key).sort((n,h)=>n.started-h.started)[0];if(!r)return;r.ctrl.abort(),this.flights.delete(r.key),this.stats.aborted+=1}this.waiting=null;const e=new AbortController,i={key:t.key,ctrl:e,started:++this.seq};this.flights.set(t.key,i),this.stats.requests+=1,this.opts.fetchFrame(t.url,e.signal).then(r=>this.done(i,r)).catch(()=>this.done(i,null))}done(t,e){if(this.flights.get(t.key)===t&&this.flights.delete(t.key),t.ctrl.signal.aborted){this.pump();return}if(e&&e.ok){const r=this.makeUrl(e.blob);if(this.cache.set(t.key,{url:r,at:e.at}),this.cache.size>this.cacheSize)for(const[n,h]of[...this.cache]){if(this.cache.size<=this.cacheSize)break;h.url!==this.state.url&&(this.cache.delete(n),this.revokeUrl(h.url))}this.state.key===t.key?this.set({key:t.key,url:r,at:e.at,loading:!1,none:!1}):!this.state.url&&this.state.key!==null&&this.set({...this.state,url:r,at:e.at})}else e&&!e.ok&&e.status===404?(this.noRecording.size>500&&this.noRecording.clear(),this.noRecording.add(t.key),this.state.key===t.key&&this.set({...this.state,loading:!1,none:!0})):this.state.key===t.key&&this.set({...this.state,loading:!1});this.pump()}}const Zt=250,Qt={set:(s,t)=>setTimeout(s,t),clear:s=>clearTimeout(s)};class ts{constructor(t,e={}){this.run=t,this.hasLatest=!1,this.timer=null,this.inflight=!1,this.stats={requested:0,sent:0,coalesced:0},this.delayMs=e.delayMs??Zt,this.busyRetryMs=e.busyRetryMs??200,this.timers=e.timers??Qt}request(t){this.stats.requested+=1,this.hasLatest&&(this.stats.coalesced+=1),this.latest=t,this.hasLatest=!0,this.arm(this.delayMs)}flush(){this.timer!==null&&(this.timers.clear(this.timer),this.timer=null),this.fire()}cancel(){this.timer!==null&&this.timers.clear(this.timer),this.timer=null,this.hasLatest=!1,this.latest=void 0}get pending(){return this.hasLatest}get inFlight(){return this.inflight}arm(t){this.timer!==null&&this.timers.clear(this.timer),this.timer=this.timers.set(()=>{this.timer=null,this.fire()},t)}fire(){if(!this.hasLatest||this.inflight)return;const t=this.latest;this.hasLatest=!1,this.latest=void 0,this.inflight=!0,this.stats.sent+=1;const e=r=>{if(this.inflight=!1,r==="busy"&&!this.hasLatest){this.latest=t,this.hasLatest=!0,this.arm(this.busyRetryMs);return}this.hasLatest&&this.timer===null&&this.fire()};let i;try{i=this.run(t)}catch{i=Promise.resolve()}i.then(e,()=>e())}}var ss=Object.defineProperty,es=Object.getOwnPropertyDescriptor,f=(s,t,e,i)=>{for(var r=i>1?void 0:i?es(t,e):t,n=s.length-1,h;n>=0;n--)(h=s[n])&&(r=(i?h(t,e,r):h(r))||r);return i&&r&&ss(t,e,r),r};const x=["closed","expired","failed"],is=[4401,4403,4410,4429,"access_lost","remote_live_cap"],as=120,rs=async s=>({days:s==="2026-09"?Array.from({length:14},(t,e)=>`2026-09-${String(e+1).padStart(2,"0")}`).filter(t=>t!=="2026-09-06"&&t!=="2026-09-07"):[],coverage:"complete"});function A(s){return q(Math.max(0,Math.min(1439.983,s)))}function O(s){const[t=0,e=0,i=0]=s.split(":").map(Number);return t*60+e+i/60}function ns(s){const t=s.map(e=>Math.abs(e)).sort((e,i)=>e-i);return t[Math.min(t.length-1,Math.max(0,Math.ceil(.95*t.length)-1))]}let c=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ht(this),this.tabsMode=new ct(this,"security"),this.cameraId="",this.at="",this.extraParam="",this.fromMap=!1,this.demoCamera="cam-10",this.cursor=615,this.generation=3,this.playing=!0,this.speed=1,this.filter="all",this.cams=null,this.crossSync=!1,this.tz="Asia/Jerusalem",this.date="",this.rec=null,this.dayEvents=[],this.bookmarks=[],this.activeBookmark=null,this.loadingRec=!1,this.session=null,this.group=null,this.extra=[],this.casePick=null,this.preview=null,this.previewTimer=0,this.frames=new Xt({fetchFrame:Jt,onChange:s=>{this.preview&&(this.preview={...this.preview,frame:s})}}),this.seeker=new ts(async s=>await this.startAt(s)==="skipped"&&this.busy?"busy":"done"),this.busy=!1,this.error="",this.notice="",this.tileStatus={},this.drifts={},this.clock=null,this.barrier="none",this.syncStats=null,this.clockPausedAt=0,this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={},this.groupStartedAt=0,this.lastReport=0,this.seekSentAt={},this.firstPlayAt={},this.startLatency={},this.paused=!1,this.scrubbing=!1,this.position=null,this.exportOpen=!1,this.exportFrom="",this.exportTo="",this.estimate=null,this.exportJob=null,this.exportBusy=!1,this.exportError="",this.appliedCamera="",this.recReads=new It,this.memo=new Rt,this.stall=new Z(X({})),this.stallPhase="ok",this.stoppedAt=null,this.diagRow=null,this.onTlHover=s=>{if(!this.cameraId||!D())return;window.clearTimeout(this.previewTimer);const t=s.detail;this.preview&&(this.preview={...this.preview,minute:t.minute,x:t.x,width:t.width}),this.previewTimer=window.setTimeout(()=>{const{key:e,atIso:i}=Yt(this.cameraId,$(this.date,t.minute,this.tz));this.preview||(this.preview={minute:t.minute,x:t.x,width:t.width,frame:this.frames.state}),this.frames.want(e,kt(this.cameraId,i))},as)},this.onTlHoverEnd=()=>{window.clearTimeout(this.previewTimer),this.frames.clear(),this.preview=null},this.monthLoaderFor="",this.monthLoaderFn=null}connectedCallback(){super.connectedCallback(),this.stopDisplay=dt(()=>this.requestUpdate()),D()&&(this.init(),this.ticker=window.setInterval(()=>this.tick(),500))}disconnectedCallback(){super.disconnectedCallback(),this.diagObs?.disconnect(),this.diagObs=void 0,this.diagRow=null,this.stopDisplay?.(),window.clearInterval(this.ticker),window.clearTimeout(this.previewTimer),this.frames.dispose(),this.endSession()}measureDiagRow(){const s=this.shadowRoot?.querySelector("[data-playback-diagnostics]")??null;s!==this.diagRow&&(this.diagObs?.disconnect(),this.diagRow=s,s&&typeof ResizeObserver<"u"&&(this.diagObs??=new ResizeObserver(()=>this.applyDiagRow()),this.diagObs.observe(s))),this.applyDiagRow()}applyDiagRow(){const s=this.diagRow,t=s?.isConnected?s.getBoundingClientRect().height:0,e=t>0&&s?.parentElement&&parseFloat(getComputedStyle(s.parentElement).rowGap)||0,i=t>0?`${Math.ceil(t+e)}px`:"";this.style.getPropertyValue("--pb-diag-h")!==i&&(i?this.style.setProperty("--pb-diag-h",i):this.style.removeProperty("--pb-diag-h"))}updated(s){this.measureDiagRow(),D()&&s.has("cameraId")&&s.get("cameraId")!==void 0&&this.cams&&this.cameraId!==this.appliedCamera&&this.selectCamera(this.cameraId,!0)}get members(){return[this.cameraId,...this.extra.filter(s=>s!==this.cameraId)]}get groupMode(){return this.extra.filter(s=>s!==this.cameraId).length>0}get masterSession(){return this.groupMode?this.group?.sessions.find(s=>s.camera_id===this.cameraId)??this.group?.sessions[0]??null:this.session}get live(){const s=this.masterSession;return!!s&&!x.includes(s.state)&&(this.groupMode?!!this.group:!0)}async init(){try{const[s,t]=await Promise.all([pt(),ut()]);this.tz=s["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras.filter(n=>n.enabled&&n.recorder_enabled!==!1&&!n.standalone),this.crossSync=String(s["playback.cross_recorder_sync"]??"false")==="true",this.stall=new Z(X(s));const e=this.cams.find(n=>n.id===this.cameraId)??this.cams[0],i=this.at?new Date(this.at):null,r=!!i&&!Number.isNaN(i.getTime());if(this.date=L(r?i:new Date,this.tz),e)if(this.cameraId=e.id,this.appliedCamera=e.id,this.extraParam&&(this.extra=N(this.extraParam,e.id,this.cams.map(n=>n.id))),await this.loadRecordings(),r)this.cursor=v(i,this.tz),await this.startAt(i);else{const n=this.rec?.segments.at(-1);this.cursor=n?this.insideLast(n):Math.max(0,v(new Date,this.tz)-5)}}catch(s){this.error=z(s)}}async selectCamera(s,t=!1){!s||!t&&s===this.cameraId||(this.clearStall(),await this.endSession(),this.frames.dispose(),this.cameraId=s,this.appliedCamera=s,this.extra=this.extra.filter(e=>e!==s),this.error="",this.notice="",await this.loadRecordings())}get monthLoader(){if(!this.cameraId)return null;if(this.monthLoaderFor!==this.cameraId||!this.monthLoaderFn){const s=this.cameraId;this.monthLoaderFor=s,this.monthLoaderFn=async t=>{try{const e=await St(s,t);return{days:e.days,coverage:e.coverage}}catch(e){throw new Error(z(e))}}}return this.monthLoaderFn}async setDate(s){if(!s||s===this.date)return;this.clearStall(),await this.endSession(),this.date=s,await this.loadRecordings();const t=this.rec?.segments.at(-1);this.cursor=t?this.insideLast(t):540}insideLast(s){const t=v(new Date(s.start_at),this.tz),e=v(new Date(s.end_at),this.tz);return Math.max(0,t,e-5)}async loadRecordings(){if(!this.cameraId||!this.date)return;const s=this.recReads.begin();this.loadingRec=!0,this.rec=null;try{const[t,e,i]=await Promise.all([zt(this.cameraId,this.date).then(r=>({ok:!0,r}),r=>({ok:!1,e:r})),Ct(this.cameraId,this.date).catch(()=>({events:[]})),j(this.cameraId,this.date).catch(()=>({bookmarks:[]}))]);if(!s())return;if(this.dayEvents=e.events,this.bookmarks=i.bookmarks,this.activeBookmark=null,!t.ok)throw t.e;this.rec=t.r,this.error=""}catch(t){if(!s())return;this.error=z(t)}finally{s()&&(this.loadingRec=!1)}}get markers(){const{dayEvents:s,tz:t}=this;return this.memo.get("markers",[s,t],()=>s.map(e=>({minute:v(new Date(e.occurred_at),t),kind:qt(e.type),label:`${Ot[e.type]??e.type}${e.confidence==="inferred"?` ${a("(מהקלטה)")}`:""}${e.count>1?` ×${e.count}`:""}`})))}get bookmarkMarkers(){const{bookmarks:s,tz:t}=this;return this.memo.get("bookmarks",[s,t],()=>s.map(e=>({id:e.id,minute:v(new Date(e.from_at),t),endMinute:v(new Date(e.to_at),t),label:`${a("תיק „{title}”",{title:e.case_title})}${e.note?` · ${e.note}`:""} · ${G[e.preservation]}`,preservation:e.preservation})))}async loadBookmarks(){if(!(!this.cameraId||!this.date))try{this.bookmarks=(await j(this.cameraId,this.date)).bookmarks}catch{}}bookmarkAt(s){this.cameraId&&(this.casePick={kind:"clip",camera_id:this.cameraId,...H($(this.date,s,this.tz),10,20),note:"סימנייה"})}get segmentsMin(){const{rec:s,tz:t}=this;return this.memo.get("segments",[s,t],()=>s?s.segments.map(e=>{const i=v(new Date(e.start_at),t);let r=v(new Date(e.end_at),t);return r<i&&(r=1440),{startMin:i,endMin:r,kind:e.kind==="continuous"?"continuous":"motion"}}):[])}inRecording(s){return this.segmentsMin.some(t=>s>=t.startMin&&s<=t.endMin)}get limitMinute(){return this.date===L(new Date,this.tz)?v(new Date,this.tz):1440}cameraName(s){return this.cams?.find(t=>t.id===s)?.name??s}async startAt(s,t={}){if(!this.cameraId||this.busy)return"skipped";const e=!!(this.session||this.group);t.auto||this.clearStall(),this.busy=!0,this.error="",this.notice="",this.scrubbing=!1;try{const i=_(s);if(this.groupMode){const r=performance.now(),n=this.group&&this.group.sessions.some(o=>!x.includes(o.state))?await Mt(this.group.id,i):await At(this.members,i);this.group=n;for(const o of n.sessions)this.seekSentAt[o.camera_id]=r,delete this.firstPlayAt[o.camera_id];this.session=null,this.position=new Date(n.requested_at);const h=Object.keys(n.missing);h.length&&(this.notice=a("ללא הקלטה בזמן הזה: {cameras}",{cameras:h.map(o=>this.cameraName(o)).join(", ")}))}else{const r=this.session&&!x.includes(this.session.state)?await V(this.session.id,i):await _t(this.cameraId,i);this.session=r,this.group=null,this.position=new Date(r.requested_at),r.moved_to_next_segment&&(this.notice=a("אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא ({time}).",{time:this.fmt(new Date(r.requested_at))}))}return this.cursor=v(this.position,this.tz),this.paused=!1,this.tileStatus={},this.drifts={},this.resetClock(),this.isConnected?"ok":(await this.endSession(),"skipped")}catch(i){if(i instanceof I&&i.body.code==="no_recording")return this.notice=a("אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live."),this.position=s,"no_recording";if(i instanceof I&&(i.body.code==="seek_rate"||i.body.code==="seek_busy")){this.notice=i.body.user_message||a("יותר מדי קפיצות בזמן; המתן מעט ונסה שוב.");const r=this.currentInstant();return r&&(this.cursor=v(r,this.tz)),"error"}else{if(i instanceof I&&Pt(i.body.code,e,!!t.retried))return this.session=null,this.group=null,this.busy=!1,this.startAt(s,{...t,retried:!0});t.auto||(this.error=z(i))}return"error"}finally{this.busy=!1}}clearStall(){this.stall.reset(performance.now()),this.stallPhase="ok",this.stoppedAt=null}watchStall(){if(this.stallPhase==="gave_up")return;const s=this.groupMode?this.group?.sessions??[]:this.session?[this.session]:[],t=new Set(s.filter(n=>!x.includes(n.state)).map(n=>n.camera_id)),e=this.players().filter(n=>t.has(n.dataset.camera??"")).map(n=>({key:n.dataset.camera??"",mediaTime:n.mediaTime,playing:n.status==="playing"})),i=t.size>0&&!this.paused&&!this.scrubbing,r=this.stall.step(performance.now(),e,{expect:i,canAct:!this.busy});if(this.stall.phase==="gave_up"){this.giveUp();return}this.stallPhase=this.stall.phase,r==="resume"&&this.autoResume()}async autoResume(){const s=this.currentInstant()??this.position;if(!s){this.stall.attemptFailed(performance.now());return}let t=s;const e=this.masterSession?new Date(this.masterSession.playback_end_at).getTime():NaN;Number.isFinite(e)&&e-s.getTime()<3e3&&(t=new Date(e+1e3));const i=await this.startAt(t,{auto:!0});this.stallPhase==="ok"&&this.stall.phase==="ok"||(i==="ok"?this.stall.attemptSent(performance.now()):i==="no_recording"?this.clearStall():this.stall.attemptFailed(performance.now()),this.stall.phase==="gave_up"?this.giveUp():this.stallPhase=this.stall.phase)}async giveUp(){this.stallPhase!=="gave_up"&&(this.stoppedAt=this.currentInstant()??this.position,this.stallPhase="gave_up",await this.endSession())}async retryStalled(){const s=this.stoppedAt??this.position??$(this.date,this.cursor,this.tz);await this.startAt(s)}onTileLost(s,t){if(!(t.status==="error"&&t.code!==void 0&&is.includes(t.code))){if(t.status==="ended"){const e=this.groupMode?this.group?.sessions.find(n=>n.camera_id===s):this.session,i=this.players().find(n=>n.dataset.camera===s);if(!e||!i)return;const r=new Date(e.requested_at).getTime()+i.mediaTime*1e3;if(new Date(e.playback_end_at).getTime()-r<5e3)return}this.stall.lost()}}async endSession(){this.seeker.cancel();const s=this.session,t=this.group;this.session=null,this.group=null,this.tileStatus={},this.drifts={},this.resetClock(),this.stall.reset(performance.now());try{t?await Dt(t.id):s&&!x.includes(s.state)&&await Et(s.id)}catch{}}async applyExtra(s){const t=N(s.join(","),this.cameraId,this.cams?.map(i=>i.id)??[]);if(t.join(",")===this.extra.join(","))return;const e=this.currentInstant();this.extra=t,await this.endSession(),e&&await this.startAt(e)}compareItems(){const s=this.cameraId?[this.cameraId]:[];return(this.cams??[]).filter(t=>t.id!==this.cameraId).map(t=>{const e=!this.extra.includes(t.id)&&!xt(s,this.cams??[],t.id,this.crossSync);return{id:t.id,label:U(t),icon:"camera",disabled:e,note:e?a("מקליט אחר"):void 0}})}renderCompareChips(){const s=this.extra.length>=3;return l`<span>${a("השוואה (עד 4):")}</span>${this.compareItems().map(t=>{const e=this.extra.includes(t.id),i=t.note??(!e&&s?mt(3,1):"");return l`<sw-chip data-compare-chip=${t.id} ?selected=${e} ?disabled=${!e&&(t.disabled||s)} title=${i||w} @click=${()=>void this.applyExtra(ft(this.extra,t.id,3).ids)}>${t.label}</sw-chip>`})}`}players(){return Array.from(this.renderRoot.querySelectorAll("sw-live-player"))}masterPlayer(){const s=this.players();return s.find(t=>t.dataset.camera===this.cameraId)??s[0]}currentInstant(){const s=this.masterSession;if(!s)return this.position;if(this.groupMode&&this.clock)return new Date(this.clockNow());const t=new Date(s.requested_at).getTime();return new Date(t+(this.masterPlayer()?.mediaTime??0)*1e3)}tick(){if(this.watchStall(),!this.masterSession||this.paused||this.scrubbing)return;if(this.groupMode&&this.group){this.tickGroup();return}const t=this.masterPlayer();if(!t||t.status!=="playing")return;const e=this.currentInstant();e&&(this.position=e,this.cursor=v(e,this.tz),t.stale&&t.bufferAhead<.4&&!this.busy&&this.startAt(e))}resetClock(){this.clock=null,this.clockPausedAt=0,this.barrier=this.groupMode?"waiting":"none",this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={};for(const s of this.players())s.rate=1;this.groupMode&&(this.speed=1),this.syncStats=null,this.groupStartedAt=performance.now(),this.lastReport=0}clockNow(){const s=this.clock;return s.baseMs+((this.paused&&this.clockPausedAt?this.clockPausedAt:performance.now())-s.startedAt)}tickGroup(){const s=this.group,t=performance.now(),e=this.players().map(o=>{const d=o.dataset.camera??"",u=s.sessions.find(g=>g.camera_id===d);return{cid:d,p:o,sess:u,at:u?new Date(u.requested_at).getTime()+o.mediaTime*1e3:NaN}}).filter(o=>o.sess&&!x.includes(o.sess.state)),i=e.filter(o=>o.p.status==="playing");if(!this.clock){const o=e.length>0&&i.length===e.length,d=t-this.groupStartedAt>12e3&&i.length>0;if(!o&&!d){this.barrier="waiting";return}const u=i.find(g=>g.cid===this.cameraId)??i[0];this.clock={baseMs:u.at,startedAt:t},this.barrier="passed",this.driftSamples={},this.lateSince={}}let r=this.clockNow();if(i.length>=3){const o=i.map(d=>d.at).sort((d,u)=>d-u);r=o[Math.floor(o.length/2)]}else i.length&&(r=(i.find(o=>o.cid===this.cameraId)??i[0]).at);this.clock={baseMs:r,startedAt:t};const n=new Date(r);this.position=n,this.cursor=v(n,this.tz);const h={};for(const o of e){if(o.p.status!=="playing"){h[o.cid]=NaN,this.lateSince[o.cid]||(this.lateSince[o.cid]=t);continue}delete this.lateSince[o.cid];const d=(o.at-r)/1e3;h[o.cid]=d;const u=this.driftSamples[o.cid]??=[];if(u.push(d),u.length>40&&u.shift(),u.length>=2&&Math.abs(d)>.25&&Math.abs(d)<=3){const g=d<0?Math.abs(d)>1?1.15:1.05:Math.abs(d)>1?.85:.95;o.p.rate!==g&&(this.nudges[o.cid]=(this.nudges[o.cid]??0)+1),o.p.rate=g}else(Math.abs(d)<=.25||Math.abs(d)>3)&&(o.p.rate=1);o.cid!==this.cameraId&&u.length>=4&&u.slice(-4).every(g=>Math.abs(g)>3)&&(this.resyncs[o.cid]??0)<2&&t-(this.resyncAt[o.cid]??0)>2e4&&this.resyncMember(o.cid,r)}this.drifts=h,this.syncStats=this.computeSync(e.map(o=>o.cid),t),t-this.lastReport>5e3&&this.syncStats.samples>=4&&(this.lastReport=t,Tt(s.id,this.syncStats).catch(()=>{}))}computeSync(s,t){const e={};let i=null,r=0;for(const d of s){const u=this.driftSamples[d]??[],g=u.length?ns(u):null,ot=this.lateSince[d]?t-this.lateSince[d]>8e3:!1;e[d]={p95:g,samples:u.length,last:u.length?u[u.length-1]:null,resyncs:this.resyncs[d]??0,state:ot?"late":u.length?"measured":"waiting",latency_ms:this.startLatency[d]??null,nudges:this.nudges[d]??0},r+=u.length,g!==null&&(i=i===null?g:Math.max(i,g))}const n=Object.keys(this.group?.missing??{}),h=Object.values(e).some(d=>d.state==="late"),o=this.barrier!=="passed"||i===null?"waiting":i<=.5?"synced":i<=2?"slight":"out_of_sync";return{p95:i,quality:o,samples:r,partial:n.length>0||h,missing:n,members:e}}async resyncMember(s,t){const e=this.group,i=e?.sessions.find(n=>n.camera_id===s);if(!e||!i||x.includes(i.state))return;this.resyncAt[s]=performance.now(),this.resyncs[s]=(this.resyncs[s]??0)+1,this.stall.disarm(s,performance.now()),this.driftSamples[s]=[];const r=Math.min(this.startLatency[s]??4e3,15e3);try{const n=await V(i.id,_(t+r));this.group===e&&(this.group={...e,sessions:e.sessions.map(h=>h.id===n.id?n:h)}),this.seekSentAt[s]=performance.now(),delete this.firstPlayAt[s]}catch{}}syncLabel(){const s=this.syncStats;if(this.barrier==="waiting"||!s||s.quality==="waiting")return a("סנכרון: ממתין לחסם הפתיחה");const t=s.p95===null?"—":a("{n} ש׳",{n:s.p95.toFixed(2)}),e={synced:a("מסונכרן"),slight:a("סטייה קלה"),out_of_sync:a("לא מסונכרן"),waiting:""}[s.quality];return`${a("סנכרון: {quality}",{quality:e})} · p95 ${t}${s.partial?` · ${a("חלקי")}`:""}`}async onSeek(s){const t=s.detail.minute,e=$(this.date,t,this.tz);if(e.getTime()>Date.now()){this.notice=a("לא ניתן לנגן זמן עתידי."),this.scrubbing=!1;return}this.cursor=t,s.detail.alt&&this.bookmarkAt(t),this.seeker.request(e)}onScrub(s){this.scrubbing=!0,this.cursor=s.detail.minute,this.position=$(this.date,s.detail.minute,this.tz)}async nudge(s){const t=this.currentInstant();t&&this.seeker.request(new Date(t.getTime()+s*1e3))}setSpeed(s){if(this.groupMode||s>1)return;this.speed=s;const t=this.masterPlayer();t&&(t.rate=s)}stepFrame(s){const t=this.masterPlayer(),e=this.cams?.find(n=>n.id===this.cameraId),i=e?.stream?.fps&&e.stream.fps>0?e.stream.fps:25;if(!t)return;if(!t.stepFrame(s,i)){this.notice=a("הפריים המבוקש מחוץ למאגר שכבר הגיע מהמקליט — השתמש בקפיצה של 10 שניות או בציר הזמן.");return}this.notice="";const r=this.currentInstant();r&&(this.position=r,this.cursor=v(r,this.tz))}togglePause(){const s=this.players();if(s.length){if(this.paused){const t=this.masterPlayer();if(!this.groupMode&&t?.stale&&this.position){this.startAt(this.position);return}s.forEach(e=>e.resume()),this.clock&&this.clockPausedAt&&(this.clock={...this.clock,startedAt:this.clock.startedAt+(performance.now()-this.clockPausedAt)}),this.clockPausedAt=0}else s.forEach(t=>t.pause()),this.clockPausedAt=performance.now();this.paused=!this.paused}}onTilePlayer(s,t){if(this.tileStatus={...this.tileStatus,[s]:t.detail.status},t.detail.status==="playing"&&this.seekSentAt[s]&&!this.firstPlayAt[s]&&(this.firstPlayAt[s]=performance.now(),this.startLatency[s]=this.firstPlayAt[s]-this.seekSentAt[s]),(t.detail.status==="error"||t.detail.status==="ended")&&this.onTileLost(s,t.detail),s===this.cameraId){if(this.masterSession&&t.detail.status==="playing"&&(this.session&&(this.session={...this.session,state:"playing"}),!this.groupMode&&this.speed!==1)){const e=this.masterPlayer();e&&e.rate!==this.speed&&(e.rate=this.speed)}if(t.detail.status==="ended"){const e=this.currentInstant(),i=this.masterSession;e&&i&&new Date(i.playback_end_at).getTime()-e.getTime()<5e3&&this.startAt(new Date(new Date(i.playback_end_at).getTime()+1e3))}}}fmt(s){return gt(s,{timeZone:this.tz,seconds:!0})}openExport(){const s=Math.floor(this.cursor*60)/60;this.exportFrom=A(Math.max(0,s-1)),this.exportTo=A(Math.min(this.limitMinute,s+1)),this.estimate=null,this.exportJob=null,this.exportError="",this.exportOpen=!0}exportRange(){const s=$(this.date,O(this.exportFrom),this.tz),t=$(this.date,O(this.exportTo),this.tz);return t.getTime()<=s.getTime()?(this.exportError=a("זמן הסיום חייב להיות אחרי ההתחלה."),null):[_(s),_(t)]}async runEstimate(){const s=this.exportRange();if(s){this.exportBusy=!0,this.exportError="";try{this.estimate=await W(this.cameraId,s[0],s[1])}catch(t){this.exportError=z(t)}finally{this.exportBusy=!1}}}async runExport(){const s=this.exportRange();if(s){this.exportBusy=!0,this.exportError="";try{const t=this.estimate??await W(this.cameraId,s[0],s[1]);if(this.estimate=t,!t.files){this.exportError=a("אין קבצים מוקלטים בטווח שנבחר.");return}this.exportJob=await Lt(this.cameraId,s[0],s[1])}catch(t){this.exportError=z(t)}finally{this.exportBusy=!1}}}renderExportDialog(){const s=this.estimate,t=this.exportJob;return l`<sw-dialog ?open=${this.exportOpen} heading=${a("ייצוא קטע")} subheading=${`${this.cameraName(this.cameraId)} · ${this.date} · ${this.tz}`} @close=${()=>this.exportOpen=!1}>
      <div class="dlg">
        ${t?l`<div class="est"><strong>${a("עבודת הייצוא נוצרה")}</strong><span>${a("{n} קבצים",{n:t.files.length})} · ${a("משוער {size}",{size:C(t.estimate_bytes)})} · ${a("מצב: {state}",{state:t.state})}</span><span>${a('המקליט עדיין מכין את הקובץ; "מעקב והורדה" למטה עובר למסך שבו כפתור ההורדה יופיע ברגע שהוא מוכן.')}</span></div>`:l`
              <div class="row">
                <sw-field label=${a("מ־")}><input type="time" lang=${E()} step="1" data-ltr .value=${this.exportFrom} @change=${e=>{this.exportFrom=e.target.value,this.estimate=null}} /></sw-field>
                <sw-field label=${a("עד")}><input type="time" lang=${E()} step="1" data-ltr .value=${this.exportTo} @change=${e=>{this.exportTo=e.target.value,this.estimate=null}} /></sw-field>
              </div>
              ${s?l`<div class="est">
                    <span>${a("{n} קבצי מקליט בטווח",{n:s.files})} · ${a("נפח משוער {size} (מקסימום {max})",{size:C(s.estimate_bytes),max:C(s.max_bytes)})} · ${a("כיסוי {coverage}",{coverage:s.coverage==="complete"?a("מלא"):a("חלקי")})}</span>
                    ${s.first_file_at?l`<span class="ltr">${this.fmt(new Date(s.first_file_at))} → ${this.fmt(new Date(s.last_file_end_at??s.first_file_at))}</span>`:w}
                    <span>${s.note}</span>
                    ${s.ffmpeg?w:l`<span class="warn">${a("ffmpeg לא זמין בשרת: הקובץ יימסר במיכל המקורי (Hikvision PS) ללא חיתוך.")}</span>`}
                  </div>`:l`<div class="session">${a("הייצוא מוריד את הקבצים המקוריים מהמקליט (לפי קובץ, כך המכשיר תומך) ואז חותך לטווח ב־keyframe. חשב נפח לפני היצירה.")}</div>`}
            `}
        ${this.exportError?l`<div class="err">${this.exportError}</div>`:w}
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        ${t?l`<sw-button variant="primary" icon="download" @click=${()=>R("/investigate/exports")}>${a("מעקב והורדה")}</sw-button><sw-button @click=${()=>this.exportOpen=!1}>${a("סגור")}</sw-button>`:l`<sw-button ?disabled=${this.exportBusy} @click=${()=>this.runEstimate()}>${a("חשב נפח")}</sw-button>
              <sw-button variant="primary" icon="download" ?disabled=${this.exportBusy} @click=${()=>this.runExport()}>${a("צור ייצוא")}</sw-button>
              <sw-button variant="ghost" @click=${()=>this.exportOpen=!1}>${a("ביטול")}</sw-button>`}
      </div>
    </sw-dialog>`}renderStage(s){const t=this.live,e=!t&&!this.inRecording(this.cursor);if(this.groupMode){const r=this.members;return l`<div class="grid ${r.length===1?"one":r.length>2?"rows2":""}" data-pb-grid=${r.length}>
        ${r.map(n=>{const h=this.group?.sessions.find(g=>g.camera_id===n),o=this.group?.missing[n],d=this.drifts[n],u=this.tileStatus[n];return l`<div class="tile ${n===this.cameraId?"master":""}">
            ${h&&!x.includes(h.state)?l`<sw-live-player data-camera=${n} .wsUrl=${K(h)} mode="mse" .retry=${!1} recorded compact @player-status=${g=>this.onTilePlayer(n,g)}></sw-live-player>`:this.stallPhase==="gave_up"?w:l`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${o==="gap"||o==="no_recording"?a("אין הקלטה בזמן הזה"):o==="playback_quota"?a("מכסת הניגון מלאה"):this.busy?a("מכין…"):this.group?a("לא זמין"):a("לחץ על ציר הזמן")}</span></div></div>`}
            <span class="name" data-tile=${n} data-tile-state=${this.syncStats?.members[n]?.state??""}>${this.cameraName(n)}${n===this.cameraId?l` · ${a("מוביל")}`:w}${h&&u==="playing"&&Number.isFinite(d)?l`<span class="drift ${Math.abs(d)>2?"bad":""}" title=${a("סטייה מהשעון־אב, נמדדת מהפריים המוצג")}>${d>=0?"+":""}${d.toFixed(1)}s</span>`:w}${this.syncStats?.members[n]?.state==="late"?l`<span class="drift bad">${a("מאחרת")}</span>`:w}${(this.syncStats?.members[n]?.resyncs??0)>0?l`<span class="drift">${a("סונכרן מחדש ×{n}",{n:this.syncStats.members[n].resyncs})}</span>`:w}</span>
          </div>`})}
      </div>`}const i=this.session;return l`<div class="video ${e?"gap":""}">
      ${t&&i?l`<sw-live-player data-camera=${s.id} .wsUrl=${K(i)} mode="mse" .retry=${!1} recorded @player-status=${r=>this.onTilePlayer(s.id,r)}></sw-live-player>`:this.stallPhase==="gave_up"?w:e?l`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice||a("אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live")}</span></div></div>`:l`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy?a("מכין ניגון…"):a("לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר")}</span>${this.busy?w:l`<sw-button variant="primary" size="sm" icon="play" @click=${()=>this.startAt($(this.date,this.cursor,this.tz))}>${a("נגן מ־{time}",{time:A(this.cursor)})}</sw-button>`}</div></div>`}
      <div class="tag"><sw-badge kind=${t?"recorded":"unknown"} ?onImage=${!!t}></sw-badge><span class="nm">${s.name}</span></div>
    </div>`}renderStall(){return this.stallPhase==="ok"?w:this.stallPhase==="gave_up"?l`<div class="stall" data-stall="gave_up" role="status"><div class="box"><span>${a("הניגון נעצר")}</span><sw-button variant="primary" size="sm" icon="refresh" data-stall-retry ?disabled=${this.busy} @click=${()=>this.retryStalled()}>${a("נסה שוב")}</sw-button></div></div>`:l`<div class="stall" data-stall=${this.stallPhase} role="status"><div class="box"><span class="spin" aria-hidden="true"></span><span>${a("מתחבר מחדש")}</span></div></div>`}renderApi(){if(this.error&&!this.cams)return l`<sw-state-panel state="error" hint=${this.error} actionLabel=${a("נסה שוב")} @action=${()=>this.init()}></sw-state-panel>`;if(!this.cams)return l`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.cams.length)return l`<sw-state-panel icon="history" state="empty" heading=${a("אין מצלמות")} hint=${a("סנכרן מצלמות מהמקליט או בקש הרשאת ניגון.")}></sw-state-panel>`;const s=this.cams.find(o=>o.id===this.cameraId)??this.cams[0],t=this.masterSession,e=this.live,i=t?.time_precision??"unknown",r=this.position??$(this.date,this.cursor,this.tz),n=this.tileStatus[this.cameraId]??"",h=this.masterPlayer()?.transport==="mse";return l`
      <div class="filters">
        ${this.rec?l`<sw-chip icon="history">${a("{n} מקטעים",{n:this.rec.segments.length})} · ${a("{n} קבצים",{n:this.rec.matches})}</sw-chip>`:w}
        ${this.dayEvents.length?l`<sw-chip icon="bell" @click=${()=>R("/investigate/events",{camera:this.cameraId,date:this.date})}>${a("{n} אירועים",{n:this.dayEvents.length})}${this.dayEvents.every(o=>o.confidence==="inferred")?` ${a("(מהקלטות)")}`:""}</sw-chip>`:w}
        ${this.bookmarks.length?l`<sw-chip icon="case" data-bookmarks-count title=${a("סימניות מתיקי חקירה על ציר הזמן · Alt+לחיצה על הציר מוסיפה סימנייה")}>${a("{n} סימניות",{n:this.bookmarks.length})}</sw-chip>`:l`<span class="session" data-bookmarks-hint>${a('אין עדיין סימניות · "הוסף לתיק" מסמן את הרגע הנוכחי, או Alt+לחיצה על הציר מסמנת נקודה אחרת')}</span>`}
        ${this.activeBookmark?l`<sw-chip selected icon="case" data-bookmark-active @click=${()=>R(`/investigate/cases/${this.activeBookmark.case_id}`)}>${a("תיק „{title}”",{title:this.activeBookmark.case_title})}${this.activeBookmark.note?` · ${this.activeBookmark.note}`:""} · ${G[this.activeBookmark.preservation]} · ${a("פתח")}</sw-chip>`:w}
        ${this.rec?.coverage==="partial"?l`<span class="warn">${a("כיסוי חלקי:")} ${this.rec.note}</span>`:w}
        ${this.loadingRec?l`<span class="session">${a("מחפש הקלטות…")}</span>`:w}
        ${this.notice?l`<span class="warn">${this.notice}</span>`:w}
        ${this.error?l`<span class="err">${this.error}</span>`:w}
        <span class="grow"></span>
        <sw-button size="sm" icon="case" data-add-to-case title=${a("סימנייה בנקודה הנוכחית · Alt+לחיצה על הציר מסמנת נקודה אחרת")} ?disabled=${!this.cameraId} @click=${()=>this.casePick={kind:"clip",camera_id:this.cameraId,...H($(this.date,this.cursor,this.tz))}}>${a("הוסף לתיק")}</sw-button>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${()=>this.openExport()}>${a("ייצוא")}</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">${a("במפה")}</sw-button></a>
      </div>
      <div class="compare" data-compare data-picker=${this.tabsMode.ddPicker}>
        ${this.tabsMode.ddPicker==="chips"?this.renderCompareChips():l`<sw-dropdown multiple camera-picker data-compare-pick label=${a("השוואה")} icon="grid" placeholder=${a("השוואה (עד 4)")} max="3" count-base="1" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
              .items=${this.compareItems()} .values=${this.extra} @change=${o=>void this.applyExtra(o.detail.ids??[])}></sw-dropdown>`}
      </div>
      <div class="stage" data-stall-phase=${this.stallPhase} data-stall-attempts=${this.stall.attempts} data-stall-resumes=${this.stall.resumes}>
        ${this.renderStage(s)}
        ${this.renderStall()}
        <span class="stamp">${this.date} ${this.fmt(r)} · ${{verified:a("מאומת"),keyframe_limited:a("דיוק לפי keyframe"),estimated:a("משוער"),unknown:"—"}[i]}${!this.groupMode&&this.speed!==1?l` · <span data-speed-active=${this.speed}>${a("{n}× הילוך איטי",{n:this.speed})}</span>`:w}${this.paused&&!this.groupMode?l` · <span data-paused>${a("מושהה · צעד־פריים")}</span>`:w}${this.groupMode?l` · <span data-sync-quality=${this.syncStats?.quality??"waiting"} data-sync-p95=${this.syncStats?.p95??""} data-sync-samples=${this.syncStats?.samples??0}>${this.syncLabel()}</span>`:""}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused?"play":"pause"} label=${this.paused?a("המשך"):a("השהה")} data-pause ?disabled=${!e||n!=="playing"} @click=${()=>this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label=${a("10 שניות אחורה")} ?disabled=${!e||this.busy} @click=${()=>this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label=${a("10 שניות קדימה")} ?disabled=${!e||this.busy} @click=${()=>this.nudge(10)}></sw-button>
          <span class="sep"></span>
          ${[.25,.5,1,2,4].map(o=>{const d=(t?.capabilities.supported_speeds??[1]).includes(o),u=o===1||!this.groupMode&&d&&(o>1||h),g=u?o<1?a("הילוך איטי: המאגר מתמלא בזמן אמת ונצרך לאט יותר — זמן המקור נשאר מדויק"):"":this.groupMode?a("בסנכרון רב־מצלמות נתמך רק 1×"):o>1?a("לא נתמך במסלול הזה: הזרם מגיע מהמקליט בזמן אמת; מהירות מוגברת דורשת מקור ששולח מהר מזמן אמת"):a("הילוך איטי זמין רק בנתיב MSE");return l`<button class="q ${this.speed===o?"on":""}" data-speed=${o} ?disabled=${!u} title=${g} @click=${()=>this.setSpeed(o)}>${o}×</button>`})}
          <span class="sep"></span>
          <button class="q" data-frame-step="-1" ?disabled=${!e||this.groupMode||!this.paused} title=${this.groupMode?a("צעד־פריים זמין במצלמה בודדת"):this.paused?a("פריים אחד אחורה (בתוך המאגר)"):a("צעד־פריים זמין בהשהיה")} @click=${()=>this.stepFrame(-1)}>${a("‹ פריים")}</button>
          <button class="q" data-frame-step="1" ?disabled=${!e||this.groupMode||!this.paused} title=${this.groupMode?a("צעד־פריים זמין במצלמה בודדת"):this.paused?a("פריים אחד קדימה (בתוך המאגר)"):a("צעד־פריים זמין בהשהיה")} @click=${()=>this.stepFrame(1)}>${a("פריים ‹")}</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label=${a("מסך מלא")} ?disabled=${!e} @click=${()=>this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <div class="tlwrap">
        <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .bookmarks=${this.bookmarkMarkers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${i} @seek=${this.onSeek} @bookmark-click=${o=>this.activeBookmark=this.bookmarks.find(d=>d.id===o.detail.id)??null} @scrub=${this.onScrub} @hover=${this.onTlHover} @hover-end=${this.onTlHoverEnd}></sw-timeline>
        ${this.preview?l`<div class="tlpreview" data-tl-preview style="left:${Math.max(104,Math.min(this.preview.width-104,this.preview.x))}px">
              ${this.preview.frame.none?l`<div class="none">${a("אין הקלטה בזמן זה")}</div>`:this.preview.frame.url?l`<img src=${this.preview.frame.url} alt="" class=${this.preview.frame.loading?"stale":""} />`:l`<div class="none">${this.preview.frame.loading?a("טוען תמונה…"):a("אין פריים בזמן זה")}</div>`}
              <span>${q(this.preview.minute)}</span>
            </div>`:w}
      </div>
      <sw-case-picker .item=${this.casePick} subheading=${`${this.cams?.find(o=>o.id===this.cameraId)?.name??""} · ${this.date} ${q(this.cursor)}`} @added=${()=>void this.loadBookmarks()} @close=${()=>this.casePick=null}></sw-case-picker>
      ${F("diagnostics")?l`<div class="session" data-playback-diagnostics>
        <span>Session: ${t?`${t.id} · ${a("דור {n}",{n:this.groupMode?this.group?.generation??t.generation:t.generation})} · ${t.state}`:a("אין")}</span>
        <span>${a("נגן:")} ${n||"—"}${this.paused?` ${a("(מושהה)")}`:""}</span>
        <span data-stall-diag>${a("חיבור מחדש:")} ${this.stall.attempts}/${this.stall.options.maxAttempts} · ${a("הצליחו {n}",{n:this.stall.resumes})}</span>
        <span>${a("אזור זמן:")} <span class="ltr">${this.tz}</span></span>
        <span>${a("כיסוי:")} ${this.rec?this.rec.coverage==="complete"?a("מלא"):this.rec.coverage==="partial"?a("חלקי"):a("לא ידוע"):"—"}</span>
        ${t?l`<span>${a("סוף הטווח:")} ${this.fmt(new Date(t.playback_end_at))}</span>`:w}
        ${this.groupMode?l`<span data-sync-method title=${a('סנכרון: שעון־אב אחד לכל האריחים (חסם פתיחה, ואז חציון זמני הפריימים המוצגים; מתחת לשלושה אריחים — המוביל); הסטייה של כל אריח נמדדת מול השעון, p95 על החלון האחרון; אריח מאחר מסונכרן לבד ואינו מזיז את האחרים (best effort, ללא עוגן זמן מאומת); מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה", לא כמסונכרן')}>${a("סנכרון: שעון־אב אחד")}</span>`:w}
      </div>`:w}
      ${this.renderExportDialog()}
    `}seekDemo(s){this.cursor=s.detail.minute,this.generation+=1}renderDemo(){const s=M.find(i=>i.id===this.demoCamera)??M[0],t=!B.some(i=>this.cursor>=i.startMin&&this.cursor<=i.endMin),e=wt.filter(i=>i.minuteOfDay<1440).filter(i=>this.filter==="all"||i.type===this.filter).map(i=>({minute:i.minuteOfDay,kind:i.type,label:i.title}));return l`
      <div class="video ${t?"gap":""}">
        ${t?l`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${a("אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live")}</span></div></div>`:l`<sw-scene kind=${vt[s.id]??"lobby"}></sw-scene><div class="shade"></div><span class="demo">${a("דמו · אין שרת מחובר")}</span>`}
        <div class="tag"><sw-badge kind=${t?"unknown":"recorded"} ?onImage=${!t}></sw-badge><span class="nm">${s.name}</span></div>
        <span class="stamp">2026-09-14 ${T(this.cursor)}:00 · actual: ${t?"—":T(this.cursor)}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?a("השהה"):a("נגן")} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label=${a("10 שניות אחורה")}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label=${a("10 שניות קדימה")}></sw-button>
          <span class="sep"></span>
          ${[1,2,4].map(i=>l`<button class="q ${this.speed===i?"on":""}" @click=${()=>this.speed=i}>${i}×</button>`)}
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="aperture" label=${a("צילום מהקלטה")}></sw-button>
          <button class="q on">1080p</button>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label=${a("מסך מלא")}></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${B} .events=${e} .cursor=${this.cursor} precision="estimated" @seek=${this.seekDemo}></sw-timeline>
      <div class="filters">
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"}>${a("הכל")}</sw-chip>
        <sw-chip dot="var(--sw-tl-motion)" ?selected=${this.filter==="motion"} @click=${()=>this.filter="motion"}>${a("תנועה")}</sw-chip>
        <sw-chip dot="var(--sw-tl-person)" ?selected=${this.filter==="person"} @click=${()=>this.filter="person"}>${a("אדם")}</sw-chip>
        <sw-chip dot="var(--sw-tl-vehicle)" ?selected=${this.filter==="vehicle"} @click=${()=>this.filter="vehicle"}>${a("רכב")}</sw-chip>
        <sw-chip dot="var(--sw-tl-door)" ?selected=${this.filter==="door"} @click=${()=>this.filter="door"}>${a("דלת")}</sw-chip>
        <span class="grow"></span>
        <sw-button size="sm" icon="case">${a("הוסף לתיק")}</sw-button>
        <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">${a("במפה בזמן הזה")}</sw-button></a>
      </div>
      ${F("diagnostics")?l`<div class="session" data-playback-diagnostics>
        <span>Session: ${this.playing?"playing":"paused"} · ${this.speed}×</span>
        <span>${a("דור {n}",{n:this.generation})}</span>
        <span>${a("דיוק זמן: משוער")}</span>
        <span>${a("כיסוי:")} ${t?a("פער"):a("מלא")} · ${a("6 מקטעים ביום")}</span>
        <span>WebRTC → MSE</span>
        ${t?w:l`<span>${a("מצלמה:")} ${s.name}</span>`}
      </div>`:w}
    `}render(){const s=D(),t=s?this.cams?.find(h=>h.id===this.cameraId):M.find(h=>h.id===this.demoCamera)??M[0],e=t?.name??a("הקלטות"),i=s?`${this.date} ${A(this.cursor)}`:`14.09.2026 ${T(this.cursor)} · ${bt("videoCopy.playbackDemoSub")}`,r=s?a("הקלטות"):`${a("הקלטות")} | ${t?.floor??""}`,n=s?L(new Date,this.tz):"2026-09-14";return l`
      <sw-page heading=${e} subheading=${i} crumbs=${r} wide>
        ${this.fromMap?l`<sw-button slot="actions" size="sm" variant="ghost" icon="map" data-back-to-map @click=${()=>history.back()}>${a("חזרה למפה")}</sw-button>`:w}
        <div slot="actions" class="pick">
          ${s?l`<sw-field><select aria-label=${a("מצלמה")} @change=${h=>this.selectCamera(h.target.value)}>${(this.cams??[]).map(h=>l`<option value=${h.id} ?selected=${h.id===this.cameraId}>${U(h)}</option>`)}</select></sw-field>`:l`<sw-field><select aria-label=${a("מצלמה")} @change=${h=>this.demoCamera=h.target.value}>${M.map(h=>l`<option value=${h.id} ?selected=${h.id===this.demoCamera}>${h.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" lang=${E()} .value=${s?this.date:"2026-09-14"} max=${n} data-ltr aria-label=${a("תאריך")} @change=${h=>s&&this.setDate(h.target.value)} /></sw-field>
          <sw-recorded-month data-recorded-month .value=${s?this.date:"2026-09-14"} .today=${n} .loader=${s?this.monthLoader:rs} ?disabled=${s&&!this.cameraId} @pick=${h=>s&&void this.setDate(h.detail.date)}></sw-recorded-month>
          <sw-field style="inline-size:132px"><input type="time" lang=${E()} step="1" .value=${s?A(this.cursor):T(this.cursor)} data-ltr aria-label=${a("שעה")} @change=${h=>{const o=h.target.value;if(s)this.onSeek(new CustomEvent("seek",{detail:{minute:O(o)}}));else{const[d,u]=o.split(":").map(Number);this.cursor=d*60+u,this.generation+=1}}} /></sw-field>
        </div>
        ${s?w:l`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label=${a("ייצוא קטע")}></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label=${a("שיתוף")}></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label=${a("עוד")}></sw-button>`}
        ${s?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};c.styles=[tt`
    .pick {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pick sw-field {
      inline-size: 150px;
    }
    /* R5-INVESTIGATE-297: the stage is the hero (shadow 3) */
    .video {
      box-shadow: var(--sw-shadow-3);
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      color: var(--sw-on-video);
      background: var(--sw-video-bg);
      box-shadow: var(--sw-shadow-2);
      /* 0.1.68: the whole page (controls + timeline) fits the window - no scrolling to reach the timeline (owner 3.5) */
      /* RELEASE-2440-TRAIN: minus the diagnostics row under the player when it is shown (--pb-diag-h, measured; 0 when hidden) */
      max-block-size: max(200px, calc(100dvh - 560px - var(--pb-diag-h, 0px)));
      margin-inline: auto;
      inline-size: 100%;
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.gap {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .grid {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-2);
      padding: 6px;
    }
    .grid.one {
      grid-template-columns: 1fr;
    }
    /* PAGING-SETTING-2439 (code review 06:PLAY-2, owner O12 a / round 32 Q-SYS-4 a): the comparison grid had no height cap, so two rows of
       16:9 tiles pushed the timeline below the window while the single video keeps the 0.1.68 budget. The grid takes the same budget:
       its width is capped so that its rows (16:9 tiles, the 6 px gaps and padding) end within it, centred like the single video. */
    .grid {
      --pb-stage-h: max(200px, calc(100dvh - 560px - var(--pb-diag-h, 0px)));
      /* RELEASE-2439-TRAIN (layout-playback-grid-2443): the caps below count the 6 px padding (the +12 / +18), so they are border-box
         widths - as content-box the 2x2 grid came out 7 px over the budget (12 px of padding x 9/16) */
      box-sizing: border-box;
      margin-inline: auto;
      inline-size: 100%;
      max-inline-size: calc(2 * (var(--pb-stage-h) - 12px) * 16 / 9 + 18px);
    }
    .grid.one {
      max-inline-size: calc((var(--pb-stage-h) - 12px) * 16 / 9 + 12px);
    }
    .grid.rows2 {
      max-inline-size: calc((var(--pb-stage-h) - 18px) * 16 / 9 + 18px);
    }
    .tile {
      position: relative;
      aspect-ratio: 16 / 9;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-xs);
      overflow: hidden;
      color: var(--sw-on-video);
    }
    .tile sw-live-player {
      position: absolute;
      inset: 0;
    }
    .tile.master {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .tile .name {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px var(--sw-video-scrim);
      z-index: 2;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .tile .drift {
      font-family: var(--sw-font-mono);
      font-weight: var(--sw-fw-regular);
      direction: ltr;
      background: var(--sw-video-scrim);
      border-radius: var(--sw-r-2xs);
      padding: 0 5px;
    }
    .tile .drift.bad {
      background: color-mix(in srgb, var(--sw-danger) 70%, transparent);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, color-mix(in srgb, var(--sw-video-scrim) 22%, transparent) 0%, transparent 25%, transparent 60%, color-mix(in srgb, var(--sw-video-scrim) 90%, transparent) 100%);
      pointer-events: none;
    }
    .tag {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
      z-index: 2;
    }
    .tag .nm {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      text-shadow: 0 1px 3px var(--sw-video-scrim);
    }
    .video.gap .tag .nm {
      text-shadow: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: var(--sw-fs-2xs);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 58px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      text-shadow: 0 1px 2px var(--sw-video-scrim);
      z-index: 2;
    }
    .video.gap .stamp {
      text-shadow: none;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
      z-index: 1;
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
      max-inline-size: 420px;
    }
    .tile .center {
      font-size: var(--sw-fs-xs);
      color: var(--sw-on-video-2);
    }
    .bar {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 10px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: 3;
    }
    .bar .inner {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim-strong);
      backdrop-filter: var(--sw-perf-blur, blur(8px));
      color: var(--sw-on-video);
      box-shadow: var(--sw-shadow-2);
    }
    .bar sw-button {
      --sw-text-2: var(--sw-on-video);
      --sw-text: var(--sw-on-video);
      --sw-surface-3: var(--sw-video-hover);
    }
    .bar .q {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      border: 1px solid color-mix(in srgb, var(--sw-on-video) 35%, transparent);
      border-radius: var(--sw-r-pill);
      padding: 3px 9px;
      margin-inline: 2px;
      background: transparent;
      color: var(--sw-on-video);
      font-family: inherit;
      cursor: pointer;
    }
    .bar .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .bar .sep {
      inline-size: 1px;
      block-size: 18px;
      background: color-mix(in srgb, var(--sw-on-video) 25%, transparent);
      margin-inline: 4px;
    }
    /* The transport controls are ONE bar under the picture, never over it (owner 2026-10-02: on a phone the floating pill covered
       more than half of the video). Row 1 is the picture (the single video or the comparison grid), the time stamp sits on its
       bottom corner, row 2 is the bar. */
    .stage {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }
    .stage > :not(.bar):not(.stamp) {
      grid-row: 1;
      grid-column: 1;
    }
    .stage .stamp {
      position: static;
      grid-row: 1;
      grid-column: 1;
      align-self: end;
      justify-self: start;
      margin: 0 12px 10px;
      pointer-events: none;
      z-index: 2;
    }
    .stage .bar {
      position: static;
      grid-row: 2;
      grid-column: 1;
      justify-content: stretch;
    }
    .stage .bar .inner {
      inline-size: 100%;
      box-sizing: border-box;
      justify-content: center;
      border-radius: var(--sw-r-md);
      background: var(--sw-video-bg);
      backdrop-filter: none;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .stage .bar sw-button {
      min-inline-size: 44px;
      min-block-size: 44px;
    }
    .stage .bar .q {
      min-block-size: 44px;
      min-inline-size: 44px;
    }
    /* 2.0.0 stall states over the picture (single video or the comparison grid): one short line, white on the video's own dark
       shade in every skin and scheme; never covers the controls bar under the picture. */
    .stage .stall {
      align-self: stretch;
      justify-self: stretch;
      display: grid;
      place-items: center;
      z-index: 4;
      border-radius: var(--sw-r-lg);
      background: color-mix(in srgb, var(--sw-video-bg) 55%, transparent);
      color: var(--sw-on-video);
      min-inline-size: 0;
    }
    .stall .box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 10px;
      padding: 8px 14px;
      max-inline-size: calc(100% - 16px);
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim-strong);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-align: center;
    }
    .stall sw-button {
      min-block-size: 44px;
    }
    .stall .spin {
      inline-size: 16px;
      block-size: 16px;
      border: 2px solid color-mix(in srgb, var(--sw-on-video) 35%, transparent);
      border-block-start-color: var(--sw-on-video);
      border-radius: 50%;
      animation: sw-stall-spin 0.9s linear infinite;
      flex: none;
    }
    @keyframes sw-stall-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .stall .spin {
        animation: none;
      }
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .session {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .warn {
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .tlwrap {
      position: relative;
    }
    /* R5-INVESTIGATE-297: the timeline is the second object of the page (radius lg, shadow 2, a light line); the stage keeps shadow 3 */
    sw-timeline {
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    .filters sw-chip {
      --sw-fs-sm: var(--sw-fs-base);
    }
    .tlpreview {
      position: absolute;
      inset-block-end: calc(100% + 6px);
      transform: translateX(-50%);
      inline-size: 200px;
      /* the hover preview over the timeline is a popover: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 4px;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-align: center;
      direction: ltr;
    }
    .tlpreview img {
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
    }
    .tlpreview img.stale {
      /* PLAYBACK-SCRUB-2341: the last good picture while the one under the pointer loads */
      opacity: 0.72;
    }
    .tlpreview .none {
      display: grid;
      place-items: center;
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      direction: rtl;
    }
    .compare {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* 2.0.1: the comparison picker is one dropdown (the chips of 2.0.0 took a row per camera on the phone); it never grows past the row */
    .compare sw-dropdown {
      max-inline-size: 100%;
    }
    .dlg {
      display: grid;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      min-inline-size: min(420px, 80vw);
    }
    .dlg .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .est {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      font-size: var(--sw-fs-xs);
      display: grid;
      gap: 4px;
    }
    ${$t}
    /* full-system sweep: on a phone the floating control pill (frame step, speeds, skip) was wider than the
       screen and its end buttons were clipped; it wraps now, and speeds the relay refuses anyway (2×/4×) are
       dropped there instead of taking room as disabled buttons. */
    @media (max-width: 767px) {
      .bar .inner {
        flex-wrap: nowrap;
        justify-content: center;
        row-gap: 4px;
        max-inline-size: calc(100% - 16px);
      }
      /* one row: the frame-step buttons only exist while paused */
      .stage .bar .inner {
        flex-wrap: nowrap;
        max-inline-size: none;
        padding-inline: 4px;
      }
      .bar .q[disabled],
      .bar .q[data-frame-step][disabled] {
        display: none;
      }
      .bar .q {
        flex: none;
      }
    }
  `,yt,Nt];f([k()],c.prototype,"cameraId",2);f([k()],c.prototype,"at",2);f([k()],c.prototype,"extraParam",2);f([k({type:Boolean})],c.prototype,"fromMap",2);f([p()],c.prototype,"demoCamera",2);f([p()],c.prototype,"cursor",2);f([p()],c.prototype,"generation",2);f([p()],c.prototype,"playing",2);f([p()],c.prototype,"speed",2);f([p()],c.prototype,"filter",2);f([p()],c.prototype,"cams",2);f([p()],c.prototype,"crossSync",2);f([p()],c.prototype,"tz",2);f([p()],c.prototype,"date",2);f([p()],c.prototype,"rec",2);f([p()],c.prototype,"dayEvents",2);f([p()],c.prototype,"bookmarks",2);f([p()],c.prototype,"activeBookmark",2);f([p()],c.prototype,"loadingRec",2);f([p()],c.prototype,"session",2);f([p()],c.prototype,"group",2);f([p()],c.prototype,"extra",2);f([p()],c.prototype,"casePick",2);f([p()],c.prototype,"preview",2);f([p()],c.prototype,"busy",2);f([p()],c.prototype,"error",2);f([p()],c.prototype,"notice",2);f([p()],c.prototype,"tileStatus",2);f([p()],c.prototype,"drifts",2);f([p()],c.prototype,"clock",2);f([p()],c.prototype,"barrier",2);f([p()],c.prototype,"syncStats",2);f([p()],c.prototype,"paused",2);f([p()],c.prototype,"scrubbing",2);f([p()],c.prototype,"position",2);f([p()],c.prototype,"exportOpen",2);f([p()],c.prototype,"exportFrom",2);f([p()],c.prototype,"exportTo",2);f([p()],c.prototype,"estimate",2);f([p()],c.prototype,"exportJob",2);f([p()],c.prototype,"exportBusy",2);f([p()],c.prototype,"exportError",2);f([p()],c.prototype,"stallPhase",2);c=f([it("investigate-playback")],c);export{c as InvestigatePlayback};
