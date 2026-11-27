import{cL as m,j as et,z as x,k as p,e3 as st,a as it,b as l,A as w,m as at,cf as ct,bO as _,aX as dt,el as pt,eV as R,af as T,eN as ut,p as mt,eG as ft,eQ as q,q as z,c as C,eR as gt,eS as wt,e as vt,ei as I,a8 as L,eO as B,eI as M,eT as U,eU as bt,eJ as yt,o as $t,b4 as kt}from"./index-CoJbESCx.js";import{s as xt,c as j}from"./recorders-CjpuuIc_.js";import"./sw-chip-C7It7kNL.js";import{s as F,m as E}from"./sw-timeline-D8_O0Dbh.js";import"./sw-case-picker-Dq_2LWkE.js";import{s as G,B as H,q as V}from"./cases-CAulEuWQ.js";import{d as P,i as $,f as St,m as v,b as zt,r as Mt,s as At,e as _t,g as K,c as Dt,h as Pt,j as Tt,a as It,k as Et,p as Y}from"./recordings-8b8Csc_3.js";import{R as Rt}from"./memo-CyxK7byc.js";import{b as W,g as Ct,f as O}from"./exports-CegZAUD3.js";import{m as Lt,E as Ot,n as Nt}from"./events-C74h9cko.js";import{S as Ft}from"./seek-coalescer-C32aVod-.js";import{b as qt}from"./bubble-chrome-Da7T662v.js";import{I as Bt}from"./investigate-r5-css-DHv046wq.js";import{t as a}from"./investigate-Bk6g33fT.js";import"./sw-logo-art-PLtEZJxU.js";import"./bytes-QYSxC3WX.js";const Ut=[m("א׳"),m("ב׳"),m("ג׳"),m("ד׳"),m("ה׳"),m("ו׳"),m("ש׳")],rt=[m("ראשון"),m("שני"),m("שלישי"),m("רביעי"),m("חמישי"),m("שישי"),m("שבת")],nt=[m("ינואר"),m("פברואר"),m("מרץ"),m("אפריל"),m("מאי"),m("יוני"),m("יולי"),m("אוגוסט"),m("ספטמבר"),m("אוקטובר"),m("נובמבר"),m("דצמבר")],ot=e=>String(e).padStart(2,"0");function D(e){return e.slice(0,7)}function jt(e){const[t,s]=e.split("-").map(Number);return new Date(Date.UTC(t,s,0)).getUTCDate()}function Gt(e,t){const[s,i]=e.split("-").map(Number),r=s*12+(i-1)+t;return`${Math.floor(r/12)}-${ot(r%12+1)}`}function Ht(e){const[t,s,i]=e.split("-").map(Number);return new Date(Date.UTC(t,s-1,i)).getUTCDay()}function Vt(e){const[t,s]=e.split("-").map(Number);return`${nt[s-1]} ${t}`}function J(e,t){const s=jt(e),i=Ht(`${e}-01`),r=new Set(t.recorded),n=Array.from({length:i},()=>null);for(let h=1;h<=s;h++){const o=`${e}-${ot(h)}`,d=o>t.today?"future":t.loaded?r.has(o)?"recorded":"empty":"unknown";n.push({date:o,day:h,weekday:(i+h-1)%7,state:d,today:o===t.today,selected:o===t.selected})}return n}function X(e,t){return e<D(t)}function Kt(e){const[t,s]=e.date.split("-").map(Number),i=m("יום {weekday}, {day} ב{month} {year}",{weekday:rt[e.weekday],day:e.day,month:nt[s-1],year:t}),r={recorded:m("יש הקלטות"),empty:m("אין הקלטות"),future:m("עתידי"),unknown:m("בבדיקה")}[e.state];return`${i} · ${r}${e.today?` · ${m("היום")}`:""}`}function Yt(e,t){const s=e===0?m("אין ימים עם הקלטות בחודש זה"):e===1?m("יום אחד עם הקלטות"):m("{n} ימים עם הקלטות",{n:e});return t==="partial"?`${s} · ${m("ייתכן שחסרים ימים (החיפוש הוגבל)")}`:s}var Wt=Object.defineProperty,Jt=Object.getOwnPropertyDescriptor,y=(e,t,s,i)=>{for(var r=i>1?void 0:i?Jt(t,s):t,n=e.length-1,h;n>=0;n--)(h=e[n])&&(r=(i?h(t,s,r):h(r))||r);return i&&r&&Wt(t,s,r),r};let b=class extends it{constructor(){super(...arguments),this.value="",this.today="",this.loader=null,this.disabled=!1,this.open=!1,this.month="",this.answer=null,this.error="",this.sheet=!1,this.focusDate="",this.seq=0,this.cache=new Map,this.openAtPress=!1,this.onViewport=()=>this.place()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onViewport)}willUpdate(e){e.has("loader")&&e.get("loader")!==void 0&&(this.cache.clear(),this.open&&this.load(this.month))}toggle(){const e=this.open||this.openAtPress;this.openAtPress=!1,e?this.close():this.show()}async show(){this.disabled||(this.month=D(this.value||this.today),this.focusDate=this.value||this.today,this.sheet=window.matchMedia("(max-width: 600px)").matches,this.open=!0,await this.updateComplete,this.pop.showPopover?.(),this.place(),window.addEventListener("resize",this.onViewport),this.load(this.month),this.focusDay(!1))}close(e=!0){if(this.open){this.open=!1,window.removeEventListener("resize",this.onViewport);try{this.pop?.hidePopover?.()}catch{}e&&this.trigger?.focus({preventScroll:!0})}}place(){if(!this.pop)return;if(this.sheet=window.matchMedia("(max-width: 600px)").matches,this.sheet){this.pop.style.removeProperty("left"),this.pop.style.removeProperty("top");return}const e=this.trigger.getBoundingClientRect(),t=this.pop.offsetWidth,s=this.pop.offsetHeight;let r=getComputedStyle(this).direction==="rtl"?e.right-t:e.left;r=Math.max(8,Math.min(r,window.innerWidth-t-8));let n=e.bottom+6;n+s>window.innerHeight-8&&(n=Math.max(8,e.top-s-6)),this.pop.style.left=`${Math.round(r)}px`,this.pop.style.top=`${Math.round(n)}px`}onToggle(e){e.newState==="closed"&&this.open&&(this.open=!1,window.removeEventListener("resize",this.onViewport))}async load(e){const t=++this.seq;this.error="";const s=this.cache.get(e);if(this.answer=s??null,!(s||!this.loader)){if(e>D(this.today)){this.answer={days:[],coverage:"complete"};return}try{const i=await this.loader(e);this.cache.set(e,i),t===this.seq&&(this.answer=i)}catch(i){t===this.seq&&(this.error=i instanceof Error&&i.message?i.message:m("בדיקת ההקלטות נכשלה"))}}}go(e){const t=Gt(this.month,e);if(e>0&&!X(this.month,this.today))return;this.month=t;const s=Number(this.focusDate.slice(8,10))||1;this.focusDate=this.clampToMonth(t,s),this.load(t)}clampToMonth(e,t){const s=J(e,{recorded:[],today:this.today,loaded:!1}).filter(n=>!!n),i=Math.min(t,s.length),r=`${e}-${String(i).padStart(2,"0")}`;return r>this.today?this.today:r}pick(e){e.state!=="future"&&(this.dispatchEvent(new CustomEvent("pick",{detail:{date:e.date,recorded:e.state==="recorded"},bubbles:!0,composed:!0})),this.close())}onGridKey(e){const t=getComputedStyle(this).direction==="rtl",s={ArrowRight:t?-1:1,ArrowLeft:t?1:-1,ArrowUp:-7,ArrowDown:7};let i=this.focusDate;if(e.key in s){const[r,n,h]=this.focusDate.split("-").map(Number);i=new Date(Date.UTC(r,n-1,h+s[e.key])).toISOString().slice(0,10)}else if(e.key==="PageUp"||e.key==="PageDown"){this.go(e.key==="PageUp"?-1:1),e.preventDefault(),this.updateComplete.then(()=>this.focusDay(!0));return}else return;e.preventDefault(),!(i>this.today)&&(this.focusDate=i,D(i)!==this.month&&(this.month=D(i),this.load(this.month)),this.updateComplete.then(()=>this.focusDay(!0)))}focusDay(e){const t=()=>this.renderRoot.querySelector(`.day[data-date="${this.focusDate}"]`)?.focus({preventScroll:!0});e?t():this.updateComplete.then(()=>requestAnimationFrame(t))}renderGrid(){const e=J(this.month,{recorded:this.answer?.days??[],today:this.today,selected:this.value,loaded:!!this.answer}),t=e.some(s=>s?.date===this.focusDate)?this.focusDate:e.find(s=>s&&s.state!=="future")?.date??"";return l`<div class="grid" role="grid" aria-labelledby="t" aria-busy=${this.answer||this.error?"false":"true"} @keydown=${s=>this.onGridKey(s)}>
      ${Ut.map((s,i)=>l`<span class="wd" role="columnheader" aria-label=${rt[i]}>${s}</span>`)}
      ${e.map(s=>s?l`<button
              class="day"
              role="gridcell"
              data-date=${s.date}
              data-state=${s.state}
              ?data-today=${s.today}
              aria-current=${s.selected?"date":w}
              aria-label=${Kt(s)}
              tabindex=${s.date===t?0:-1}
              ?disabled=${s.state==="future"}
              @click=${()=>this.pick(s)}
            >${s.day}</button>`:l`<span aria-hidden="true"></span>`)}
    </div>`}renderFoot(){return this.error?l`<div class="foot" data-error role="status"><span class="msg">${this.error}</span><button class="retry" @click=${()=>{this.cache.delete(this.month),this.load(this.month)}}>${m("נסה שוב")}</button></div>`:this.answer?l`<div class="foot" role="status" ?data-partial=${this.answer.coverage==="partial"}><span class="msg" data-summary>${Yt(this.answer.days.length,this.answer.coverage)}</span></div>`:l`<div class="foot" role="status"><span class="msg">${m("בודק אילו ימים הוקלטו…")}</span></div>`}render(){return l`
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
      <div class="pop ${this.sheet?"sheet":""}" popover="auto" role="dialog" aria-label=${m("ימים עם הקלטות")} @toggle=${e=>this.onToggle(e)}>
        ${this.open?l`
              <div class="head">
                <button class="nav prev" type="button" aria-label=${m("החודש הקודם")} @click=${()=>this.go(-1)}><sw-icon name="chevron" size="18"></sw-icon></button>
                <h2 class="title" id="t" aria-live="polite">${Vt(this.month)}</h2>
                <button class="nav next" type="button" aria-label=${m("החודש הבא")} ?disabled=${!X(this.month,this.today)} @click=${()=>this.go(1)}><sw-icon name="chevron" size="18"></sw-icon></button>
              </div>
              ${this.renderGrid()} ${this.renderFoot()}
            `:w}
      </div>
    `}};b.styles=et`
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
      /* STARTING-STYLE-AUDIT-2520 (the FLAKY-FIX-2520 rule of sw-dialog): the month lands by transform only - it holds text (the day
         numbers, the legend), and an opacity fade put them below contrast for the length of the fade. Full contrast from the first frame. */
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    @starting-style {
      .pop:popover-open {
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
  `;y([x()],b.prototype,"value",2);y([x()],b.prototype,"today",2);y([x({attribute:!1})],b.prototype,"loader",2);y([x({type:Boolean,reflect:!0})],b.prototype,"disabled",2);y([p()],b.prototype,"open",2);y([p()],b.prototype,"month",2);y([p()],b.prototype,"answer",2);y([p()],b.prototype,"error",2);y([p()],b.prototype,"sheet",2);y([p()],b.prototype,"focusDate",2);y([st(".pop")],b.prototype,"pop",2);y([st(".trigger")],b.prototype,"trigger",2);b=y([at("sw-recorded-month")],b);const S={stallS:5,attempts:3,graceMs:2e3,backoffMs:[3e3,6e3],attemptTimeoutMs:2e4,stableMs:3e4,epsilon:.05};function Z(e){const t=(s,i,r,n)=>{const h=Number(s);return Number.isFinite(h)?Math.min(n,Math.max(r,Math.round(h))):i};return{stallMs:t(e["playback.stall_s"],S.stallS,2,30)*1e3,maxAttempts:t(e["playback.auto_resume_attempts"],S.attempts,0,5)}}class Q{constructor(t){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks=new Map,this.since=0,this.wait=0,this.pending=!1,this.sentAt=0,this.fault=!1,this.okSince=0,this.o={graceMs:S.graceMs,backoffMs:[...S.backoffMs],attemptTimeoutMs:S.attemptTimeoutMs,stableMs:S.stableMs,epsilon:S.epsilon,...t}}get options(){return this.o}reset(t){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks.clear(),this.pending=!1,this.fault=!1,this.okSince=t}disarm(t,s){const i=this.tracks.get(t);i&&(i.armed=!1,i.at=s)}lost(){this.fault=!0}attemptSent(t){this.phase==="reconnecting"&&(this.pending=!1,this.sentAt=t,this.fault=!1,this.disarmAll(t))}attemptFailed(t){this.phase==="reconnecting"&&this.failAttempt(t)}retry(t){this.attempts=0,this.pending=!1,this.fault=!1,this.phase="stalled",this.since=t,this.wait=0}step(t,s,i){const r=this.o.epsilon;let n=!1,h=!1;const o=new Set;for(const u of s){o.add(u.key);const g=this.tracks.get(u.key);if(!g){this.tracks.set(u.key,{last:u.mediaTime,at:t,armed:!1});continue}if(!i.expect||!u.playing){g.armed=!1,g.last=u.mediaTime,g.at=t;continue}u.mediaTime>g.last+r?(g.armed=!0,g.last=u.mediaTime,g.at=t,n=!0):u.mediaTime<g.last-r?(g.armed=!1,g.last=u.mediaTime,g.at=t):g.armed&&t-g.at>=this.o.stallMs&&(h=!0)}for(const u of[...this.tracks.keys()])o.has(u)||this.tracks.delete(u);const d=this.fault;switch(this.fault=!1,this.phase){case"ok":return i.expect?h||d?(this.phase="stalled",this.since=t,this.wait=this.attempts===0?this.o.graceMs:this.backoff(this.attempts),this.dueAttempt(t,i)):(this.attempts>0&&n&&t-this.okSince>=this.o.stableMs&&(this.attempts=0),"none"):"none";case"stalled":return i.expect?n&&!h&&!d?(this.phase="ok",this.okSince=t,"none"):this.dueAttempt(t,i):(this.phase="ok",this.okSince=t,"none");case"reconnecting":return this.pending?"none":n&&!h?(this.phase="ok",this.resumes+=1,this.okSince=t,"none"):d||t-this.sentAt>=this.o.attemptTimeoutMs?(this.failAttempt(t),this.phase==="stalled"?this.dueAttempt(t,i):"none"):"none";case"gave_up":default:return"none"}}dueAttempt(t,s){return this.attempts>=this.o.maxAttempts?(this.phase="gave_up","none"):t-this.since<this.wait||!s.canAct?"none":(this.phase="reconnecting",this.attempts+=1,this.pending=!0,this.sentAt=t,"resume")}failAttempt(t){if(this.pending=!1,this.attempts>=this.o.maxAttempts){this.phase="gave_up";return}this.phase="stalled",this.since=t,this.wait=this.backoff(this.attempts)}backoff(t){const s=this.o.backoffMs;return s.length?s[Math.min(s.length-1,Math.max(0,t-1))]:0}disarmAll(t){for(const s of this.tracks.values())s.armed=!1,s.at=t}}const tt=10;function Xt(e,t){const s=Math.floor(t.getTime()/(tt*1e3))*tt*1e3,i=_(s);return{key:`${e}|${i}`,atIso:i}}const Zt=async(e,t)=>{const s=await ct(e,{signal:t});return s.ok?{ok:!0,blob:await s.blob(),at:s.headers.get("X-Frame-At")}:{ok:!1,status:s.status}};class Qt{constructor(t){this.opts=t,this.cache=new Map,this.noRecording=new Set,this.flights=new Map,this.waiting=null,this.seq=0,this.stats={requests:0,aborted:0,deduped:0},this.state={key:null,url:null,at:null,loading:!1,none:!1},this.maxConcurrent=Math.max(1,t.maxConcurrent??2),this.cacheSize=Math.max(4,t.cacheSize??40),this.makeUrl=t.makeUrl??(s=>URL.createObjectURL(s)),this.revokeUrl=t.revokeUrl??(s=>URL.revokeObjectURL(s))}want(t,s){const i=this.cache.get(t);if(i){this.cache.delete(t),this.cache.set(t,i),this.stats.deduped+=1,this.waiting=null,this.set({key:t,url:i.url,at:i.at,loading:!1,none:!1});return}if(this.noRecording.has(t)){this.stats.deduped+=1,this.waiting=null,this.set({key:t,url:this.state.url,at:this.state.at,loading:!1,none:!0});return}if(this.set({key:t,url:this.state.url,at:this.state.at,loading:!0,none:!1}),this.flights.has(t)){this.stats.deduped+=1,this.waiting=null;return}this.waiting={key:t,url:s},this.pump()}clear(){this.waiting=null;for(const t of this.flights.values())t.ctrl.abort(),this.stats.aborted+=1;this.flights.clear(),this.set({key:null,url:null,at:null,loading:!1,none:!1})}dispose(){this.clear();for(const t of this.cache.values())this.revokeUrl(t.url);this.cache.clear(),this.noRecording.clear()}get inFlight(){return this.flights.size}set(t){this.state=t,this.opts.onChange(t)}pump(){const t=this.waiting;if(!t)return;if(this.flights.size>=this.maxConcurrent){const r=[...this.flights.values()].filter(n=>n.key!==this.state.key).sort((n,h)=>n.started-h.started)[0];if(!r)return;r.ctrl.abort(),this.flights.delete(r.key),this.stats.aborted+=1}this.waiting=null;const s=new AbortController,i={key:t.key,ctrl:s,started:++this.seq};this.flights.set(t.key,i),this.stats.requests+=1,this.opts.fetchFrame(t.url,s.signal).then(r=>this.done(i,r)).catch(()=>this.done(i,null))}done(t,s){if(this.flights.get(t.key)===t&&this.flights.delete(t.key),t.ctrl.signal.aborted){this.pump();return}if(s&&s.ok){const r=this.makeUrl(s.blob);if(this.cache.set(t.key,{url:r,at:s.at}),this.cache.size>this.cacheSize)for(const[n,h]of[...this.cache]){if(this.cache.size<=this.cacheSize)break;h.url!==this.state.url&&(this.cache.delete(n),this.revokeUrl(h.url))}this.state.key===t.key?this.set({key:t.key,url:r,at:s.at,loading:!1,none:!1}):!this.state.url&&this.state.key!==null&&this.set({...this.state,url:r,at:s.at})}else s&&!s.ok&&s.status===404?(this.noRecording.size>500&&this.noRecording.clear(),this.noRecording.add(t.key),this.state.key===t.key&&this.set({...this.state,loading:!1,none:!0})):this.state.key===t.key&&this.set({...this.state,loading:!1});this.pump()}}function te(e,t,s){if(!t||!Number.isFinite(t.getTime()))return null;const i=P(t,s);return i&&i!==e?i:null}function lt(e,t,s,i){return e&&Number.isFinite(e.getTime())?e:$(t,s,i)}function ee(e,t,s,i){return P(lt(e,t,s,i),i)}var se=Object.defineProperty,ie=Object.getOwnPropertyDescriptor,f=(e,t,s,i)=>{for(var r=i>1?void 0:i?ie(t,s):t,n=e.length-1,h;n>=0;n--)(h=e[n])&&(r=(i?h(t,s,r):h(r))||r);return i&&r&&se(t,s,r),r};const k=["closed","expired","failed"],ae=[4401,4403,4410,4429,"access_lost","remote_live_cap","presence_required","service_account"],re=120,ne=async e=>({days:e==="2026-09"?Array.from({length:14},(t,s)=>`2026-09-${String(s+1).padStart(2,"0")}`).filter(t=>t!=="2026-09-06"&&t!=="2026-09-07"):[],coverage:"complete"});function A(e){return F(Math.max(0,Math.min(1439.983,e)))}function N(e){const[t=0,s=0,i=0]=e.split(":").map(Number);return t*60+s+i/60}function oe(e){const t=e.map(s=>Math.abs(s)).sort((s,i)=>s-i);return t[Math.min(t.length-1,Math.max(0,Math.ceil(.95*t.length)-1))]}let c=class extends it{constructor(){super(...arguments),this.bubbleSkin=new dt(this),this.tabsMode=new pt(this,"security"),this.cameraId="",this.at="",this.extraParam="",this.fromMap=!1,this.demoCamera="cam-10",this.cursor=615,this.generation=3,this.playing=!0,this.speed=1,this.filter="all",this.cams=null,this.crossSync=!1,this.tz="Asia/Jerusalem",this.date="",this.rec=null,this.dayEvents=[],this.bookmarks=[],this.activeBookmark=null,this.loadingRec=!1,this.session=null,this.group=null,this.extra=[],this.casePick=null,this.preview=null,this.previewTimer=0,this.frames=new Qt({fetchFrame:Zt,onChange:e=>{this.preview&&(this.preview={...this.preview,frame:e})}}),this.seeker=new Ft(async e=>await this.startAt(e)==="skipped"&&this.busy?"busy":"done"),this.busy=!1,this.error="",this.notice="",this.tileStatus={},this.drifts={},this.clock=null,this.barrier="none",this.syncStats=null,this.clockPausedAt=0,this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={},this.groupStartedAt=0,this.lastReport=0,this.seekSentAt={},this.firstPlayAt={},this.startLatency={},this.paused=!1,this.scrubbing=!1,this.position=null,this.exportOpen=!1,this.exportFrom="",this.exportTo="",this.estimate=null,this.exportJob=null,this.exportBusy=!1,this.exportError="",this.appliedCamera="",this.recReads=new R,this.cameraPicks=new R,this.datePicks=new R,this.memo=new Rt,this.stall=new Q(Z({})),this.stallPhase="ok",this.stoppedAt=null,this.diagRow=null,this.onTlHover=e=>{if(!this.cameraId||!T())return;window.clearTimeout(this.previewTimer);const t=e.detail;this.preview&&(this.preview={...this.preview,minute:t.minute,x:t.x,width:t.width}),this.previewTimer=window.setTimeout(()=>{const{key:s,atIso:i}=Xt(this.cameraId,$(this.date,t.minute,this.tz));this.preview||(this.preview={minute:t.minute,x:t.x,width:t.width,frame:this.frames.state}),this.frames.want(s,St(this.cameraId,i))},re)},this.onTlHoverEnd=()=>{window.clearTimeout(this.previewTimer),this.frames.clear(),this.preview=null},this.monthLoaderFor="",this.monthLoaderFn=null}connectedCallback(){super.connectedCallback(),this.stopDisplay=ut(()=>this.requestUpdate()),T()&&(this.init(),this.ticker=window.setInterval(()=>this.tick(),500))}disconnectedCallback(){super.disconnectedCallback(),this.diagObs?.disconnect(),this.diagObs=void 0,this.diagRow=null,this.stopDisplay?.(),window.clearInterval(this.ticker),window.clearTimeout(this.previewTimer),this.frames.dispose(),this.cameraPicks.cancel(),this.datePicks.cancel(),this.endSession()}measureDiagRow(){const e=this.shadowRoot?.querySelector("[data-playback-diagnostics]")??null;e!==this.diagRow&&(this.diagObs?.disconnect(),this.diagRow=e,e&&typeof ResizeObserver<"u"&&(this.diagObs??=new ResizeObserver(()=>this.applyDiagRow()),this.diagObs.observe(e))),this.applyDiagRow()}applyDiagRow(){const e=this.diagRow,t=e?.isConnected?e.getBoundingClientRect().height:0,s=t>0&&e?.parentElement&&parseFloat(getComputedStyle(e.parentElement).rowGap)||0,i=t>0?`${Math.ceil(t+s)}px`:"";this.style.getPropertyValue("--pb-diag-h")!==i&&(i?this.style.setProperty("--pb-diag-h",i):this.style.removeProperty("--pb-diag-h"))}updated(e){this.measureDiagRow(),T()&&e.has("cameraId")&&e.get("cameraId")!==void 0&&this.cams&&this.cameraId!==this.appliedCamera&&this.selectCamera(this.cameraId,!0)}get members(){return[this.cameraId,...this.extra.filter(e=>e!==this.cameraId)]}get groupMode(){return this.extra.filter(e=>e!==this.cameraId).length>0}get masterSession(){return this.groupMode?this.group?.sessions.find(e=>e.camera_id===this.cameraId)??this.group?.sessions[0]??null:this.session}get live(){const e=this.masterSession;return!!e&&!k.includes(e.state)&&(this.groupMode?!!this.group:!0)}async init(){try{const[e,t]=await Promise.all([mt(),ft()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras.filter(n=>n.enabled&&n.recorder_enabled!==!1&&!n.standalone),this.crossSync=String(e["playback.cross_recorder_sync"]??"false")==="true",this.stall=new Q(Z(e));const s=this.cams.find(n=>n.id===this.cameraId)??this.cams[0],i=this.at?new Date(this.at):null,r=!!i&&!Number.isNaN(i.getTime());if(this.date=P(r?i:new Date,this.tz),s)if(this.cameraId=s.id,this.appliedCamera=s.id,this.extraParam&&(this.extra=q(this.extraParam,s.id,this.cams.map(n=>n.id))),await this.loadRecordings(),r)this.cursor=v(i,this.tz),await this.startAt(i);else{const n=this.rec?.segments.at(-1);this.cursor=n?this.insideLast(n):Math.max(0,v(new Date,this.tz)-5)}}catch(e){this.error=z(e)}}async selectCamera(e,t=!1){const s=this.cameraPicks.begin();!e||!t&&e===this.cameraId||(this.clearStall(),await this.endSession(),s()&&(this.frames.dispose(),this.cameraId=e,this.appliedCamera=e,this.extra=this.extra.filter(i=>i!==e),this.error="",this.notice="",await this.loadRecordings()))}get monthLoader(){if(!this.cameraId)return null;if(this.monthLoaderFor!==this.cameraId||!this.monthLoaderFn){const e=this.cameraId;this.monthLoaderFor=e,this.monthLoaderFn=async t=>{try{const s=await zt(e,t);return{days:s.days,coverage:s.coverage}}catch(s){throw new Error(z(s))}}}return this.monthLoaderFn}async setDate(e){const t=this.datePicks.begin();if(!e||e===this.date||(this.clearStall(),await this.endSession(),!t())||(this.date=e,this.position=null,await this.loadRecordings(),!t()))return;const s=this.rec?.segments.at(-1);this.cursor=s?this.insideLast(s):540}insideLast(e){const t=v(new Date(e.start_at),this.tz),s=v(new Date(e.end_at),this.tz);return Math.max(0,t,s-5)}followDay(e){const t=te(this.date,e,this.tz);t&&(this.date=t,this.loadRecordings())}async loadRecordings(){if(!this.cameraId||!this.date)return;const e=this.recReads.begin();this.loadingRec=!0,this.rec=null;try{const[t,s,i]=await Promise.all([Mt(this.cameraId,this.date).then(r=>({ok:!0,r}),r=>({ok:!1,e:r})),Lt(this.cameraId,this.date).catch(()=>({events:[]})),G(this.cameraId,this.date).catch(()=>({bookmarks:[]}))]);if(!e())return;if(this.dayEvents=s.events,this.bookmarks=i.bookmarks,this.activeBookmark=null,!t.ok)throw t.e;this.rec=t.r,this.error=""}catch(t){if(!e())return;this.error=z(t)}finally{e()&&(this.loadingRec=!1)}}get markers(){const{dayEvents:e,tz:t}=this;return this.memo.get("markers",[e,t],()=>e.map(s=>({minute:v(new Date(s.occurred_at),t),kind:Nt(s.type),label:`${Ot[s.type]??s.type}${s.confidence==="inferred"?` ${a("(מהקלטה)")}`:""}${s.count>1?` ×${s.count}`:""}`})))}get bookmarkMarkers(){const{bookmarks:e,tz:t}=this;return this.memo.get("bookmarks",[e,t],()=>e.map(s=>({id:s.id,minute:v(new Date(s.from_at),t),endMinute:v(new Date(s.to_at),t),label:`${a("תיק „{title}”",{title:s.case_title})}${s.note?` · ${s.note}`:""} · ${H[s.preservation]}`,preservation:s.preservation})))}async loadBookmarks(){if(!(!this.cameraId||!this.date))try{this.bookmarks=(await G(this.cameraId,this.date)).bookmarks}catch{}}bookmarkAt(e){this.cameraId&&(this.casePick={kind:"clip",camera_id:this.cameraId,...V($(this.date,e,this.tz),10,20),note:a("סימנייה")})}get segmentsMin(){const{rec:e,tz:t}=this;return this.memo.get("segments",[e,t],()=>e?e.segments.map(s=>{const i=v(new Date(s.start_at),t);let r=v(new Date(s.end_at),t);return r<i&&(r=1440),{startMin:i,endMin:r,kind:s.kind==="continuous"?"continuous":"motion"}}):[])}inRecording(e){return this.segmentsMin.some(t=>e>=t.startMin&&e<=t.endMin)}get limitMinute(){return this.date===P(new Date,this.tz)?v(new Date,this.tz):1440}cameraName(e){return this.cams?.find(t=>t.id===e)?.name??e}async startAt(e,t={}){if(!this.cameraId||this.busy)return"skipped";const s=!!(this.session||this.group);t.auto||this.clearStall(),this.busy=!0,this.error="",this.notice="",this.scrubbing=!1;try{const i=_(e);if(this.groupMode){const r=performance.now(),n=this.group&&this.group.sessions.some(o=>!k.includes(o.state))?await At(this.group.id,i):await _t(this.members,i);this.group=n;for(const o of n.sessions)this.seekSentAt[o.camera_id]=r,delete this.firstPlayAt[o.camera_id];this.session=null,this.position=new Date(n.requested_at);const h=Object.keys(n.missing);h.length&&(this.notice=a("ללא הקלטה בזמן הזה: {cameras}",{cameras:h.map(o=>this.cameraName(o)).join(", ")}))}else{const r=this.session&&!k.includes(this.session.state)?await K(this.session.id,i):await Dt(this.cameraId,i);this.session=r,this.group=null,this.position=new Date(r.requested_at),r.moved_to_next_segment&&(this.notice=a("אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא ({time}).",{time:this.fmt(new Date(r.requested_at))}))}return this.followDay(this.position),this.cursor=v(this.position,this.tz),this.paused=!1,this.tileStatus={},this.drifts={},this.resetClock(),this.isConnected?"ok":(await this.endSession(),"skipped")}catch(i){if(i instanceof C&&i.body.code==="no_recording")return this.notice=a("אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live."),this.position=e,"no_recording";if(i instanceof C&&(i.body.code==="seek_rate"||i.body.code==="seek_busy")){this.notice=i.body.user_message||a("יותר מדי קפיצות בזמן; המתן מעט ונסה שוב.");const r=this.currentInstant();return r&&(this.cursor=v(r,this.tz)),"error"}else{if(i instanceof C&&Pt(i.body.code,s,!!t.retried))return this.session=null,this.group=null,this.busy=!1,this.startAt(e,{...t,retried:!0});t.auto||(this.error=z(i))}return"error"}finally{this.busy=!1}}clearStall(){this.stall.reset(performance.now()),this.stallPhase="ok",this.stoppedAt=null}watchStall(){if(this.stallPhase==="gave_up")return;const e=this.groupMode?this.group?.sessions??[]:this.session?[this.session]:[],t=new Set(e.filter(n=>!k.includes(n.state)).map(n=>n.camera_id)),s=this.players().filter(n=>t.has(n.dataset.camera??"")).map(n=>({key:n.dataset.camera??"",mediaTime:n.mediaTime,playing:n.status==="playing"})),i=t.size>0&&!this.paused&&!this.scrubbing,r=this.stall.step(performance.now(),s,{expect:i,canAct:!this.busy});if(this.stall.phase==="gave_up"){this.giveUp();return}this.stallPhase=this.stall.phase,r==="resume"&&this.autoResume()}async autoResume(){const e=this.currentInstant()??this.position;if(!e){this.stall.attemptFailed(performance.now());return}let t=e;const s=this.masterSession?new Date(this.masterSession.playback_end_at).getTime():NaN;Number.isFinite(s)&&s-e.getTime()<3e3&&(t=new Date(s+1e3));const i=await this.startAt(t,{auto:!0});this.stallPhase==="ok"&&this.stall.phase==="ok"||(i==="ok"?this.stall.attemptSent(performance.now()):i==="no_recording"?this.clearStall():this.stall.attemptFailed(performance.now()),this.stall.phase==="gave_up"?this.giveUp():this.stallPhase=this.stall.phase)}async giveUp(){this.stallPhase!=="gave_up"&&(this.stoppedAt=this.currentInstant()??this.position,this.stallPhase="gave_up",await this.endSession())}async retryStalled(){const e=this.stoppedAt??this.position??$(this.date,this.cursor,this.tz);await this.startAt(e)}onTileLost(e,t){if(!(t.status==="error"&&t.code!==void 0&&ae.includes(t.code))){if(t.status==="ended"){const s=this.groupMode?this.group?.sessions.find(n=>n.camera_id===e):this.session,i=this.players().find(n=>n.dataset.camera===e);if(!s||!i)return;const r=new Date(s.requested_at).getTime()+i.mediaTime*1e3;if(new Date(s.playback_end_at).getTime()-r<5e3)return}this.stall.lost()}}async endSession(){this.seeker.cancel();const e=this.session,t=this.group;this.session=null,this.group=null,this.tileStatus={},this.drifts={},this.resetClock(),this.stall.reset(performance.now());try{t?await Tt(t.id):e&&!k.includes(e.state)&&await It(e.id)}catch{}}async applyExtra(e){const t=q(e.join(","),this.cameraId,this.cams?.map(i=>i.id)??[]);if(t.join(",")===this.extra.join(","))return;const s=this.currentInstant();this.extra=t,await this.endSession(),s&&await this.startAt(s)}compareItems(){const e=this.cameraId?[this.cameraId]:[];return(this.cams??[]).filter(t=>t.id!==this.cameraId).map(t=>{const s=!this.extra.includes(t.id)&&!xt(e,this.cams??[],t.id,this.crossSync);return{id:t.id,label:j(t),icon:"camera",disabled:s,note:s?a("מקליט אחר"):void 0}})}renderCompareChips(){const e=this.extra.length>=3;return l`<span>${a("השוואה (עד 4):")}</span>${this.compareItems().map(t=>{const s=this.extra.includes(t.id),i=t.note??(!s&&e?gt(3,1):"");return l`<sw-chip data-compare-chip=${t.id} ?selected=${s} ?disabled=${!s&&(t.disabled||e)} title=${i||w} @click=${()=>void this.applyExtra(wt(this.extra,t.id,3).ids)}>${t.label}</sw-chip>`})}`}players(){return Array.from(this.renderRoot.querySelectorAll("sw-live-player"))}masterPlayer(){const e=this.players();return e.find(t=>t.dataset.camera===this.cameraId)??e[0]}currentInstant(){const e=this.masterSession;if(!e)return this.position;if(this.groupMode&&this.clock)return new Date(this.clockNow());const t=new Date(e.requested_at).getTime();return new Date(t+(this.masterPlayer()?.mediaTime??0)*1e3)}tick(){if(this.watchStall(),!this.masterSession||this.paused||this.scrubbing)return;if(this.groupMode&&this.group){this.tickGroup();return}const t=this.masterPlayer();if(!t||t.status!=="playing")return;const s=this.currentInstant();s&&(this.position=s,this.followDay(s),this.cursor=v(s,this.tz),t.stale&&t.bufferAhead<.4&&!this.busy&&this.startAt(s))}resetClock(){this.clock=null,this.clockPausedAt=0,this.barrier=this.groupMode?"waiting":"none",this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={};for(const e of this.players())e.rate=1;this.groupMode&&(this.speed=1),this.syncStats=null,this.groupStartedAt=performance.now(),this.lastReport=0}clockNow(){const e=this.clock;return e.baseMs+((this.paused&&this.clockPausedAt?this.clockPausedAt:performance.now())-e.startedAt)}tickGroup(){const e=this.group,t=performance.now(),s=this.players().map(o=>{const d=o.dataset.camera??"",u=e.sessions.find(g=>g.camera_id===d);return{cid:d,p:o,sess:u,at:u?new Date(u.requested_at).getTime()+o.mediaTime*1e3:NaN}}).filter(o=>o.sess&&!k.includes(o.sess.state)),i=s.filter(o=>o.p.status==="playing");if(!this.clock){const o=s.length>0&&i.length===s.length,d=t-this.groupStartedAt>12e3&&i.length>0;if(!o&&!d){this.barrier="waiting";return}const u=i.find(g=>g.cid===this.cameraId)??i[0];this.clock={baseMs:u.at,startedAt:t},this.barrier="passed",this.driftSamples={},this.lateSince={}}let r=this.clockNow();if(i.length>=3){const o=i.map(d=>d.at).sort((d,u)=>d-u);r=o[Math.floor(o.length/2)]}else i.length&&(r=(i.find(o=>o.cid===this.cameraId)??i[0]).at);this.clock={baseMs:r,startedAt:t};const n=new Date(r);this.position=n,this.followDay(n),this.cursor=v(n,this.tz);const h={};for(const o of s){if(o.p.status!=="playing"){h[o.cid]=NaN,this.lateSince[o.cid]||(this.lateSince[o.cid]=t);continue}delete this.lateSince[o.cid];const d=(o.at-r)/1e3;h[o.cid]=d;const u=this.driftSamples[o.cid]??=[];if(u.push(d),u.length>40&&u.shift(),u.length>=2&&Math.abs(d)>.25&&Math.abs(d)<=3){const g=d<0?Math.abs(d)>1?1.15:1.05:Math.abs(d)>1?.85:.95;o.p.rate!==g&&(this.nudges[o.cid]=(this.nudges[o.cid]??0)+1),o.p.rate=g}else(Math.abs(d)<=.25||Math.abs(d)>3)&&(o.p.rate=1);o.cid!==this.cameraId&&u.length>=4&&u.slice(-4).every(g=>Math.abs(g)>3)&&(this.resyncs[o.cid]??0)<2&&t-(this.resyncAt[o.cid]??0)>2e4&&this.resyncMember(o.cid,r)}this.drifts=h,this.syncStats=this.computeSync(s.map(o=>o.cid),t),t-this.lastReport>5e3&&this.syncStats.samples>=4&&(this.lastReport=t,Et(e.id,this.syncStats).catch(()=>{}))}computeSync(e,t){const s={};let i=null,r=0;for(const d of e){const u=this.driftSamples[d]??[],g=u.length?oe(u):null,ht=this.lateSince[d]?t-this.lateSince[d]>8e3:!1;s[d]={p95:g,samples:u.length,last:u.length?u[u.length-1]:null,resyncs:this.resyncs[d]??0,state:ht?"late":u.length?"measured":"waiting",latency_ms:this.startLatency[d]??null,nudges:this.nudges[d]??0},r+=u.length,g!==null&&(i=i===null?g:Math.max(i,g))}const n=Object.keys(this.group?.missing??{}),h=Object.values(s).some(d=>d.state==="late"),o=this.barrier!=="passed"||i===null?"waiting":i<=.5?"synced":i<=2?"slight":"out_of_sync";return{p95:i,quality:o,samples:r,partial:n.length>0||h,missing:n,members:s}}async resyncMember(e,t){const s=this.group,i=s?.sessions.find(n=>n.camera_id===e);if(!s||!i||k.includes(i.state))return;this.resyncAt[e]=performance.now(),this.resyncs[e]=(this.resyncs[e]??0)+1,this.stall.disarm(e,performance.now()),this.driftSamples[e]=[];const r=Math.min(this.startLatency[e]??4e3,15e3);try{const n=await K(i.id,_(t+r));this.group===s&&(this.group={...s,sessions:s.sessions.map(h=>h.id===n.id?n:h)}),this.seekSentAt[e]=performance.now(),delete this.firstPlayAt[e]}catch{}}syncLabel(){const e=this.syncStats;if(this.barrier==="waiting"||!e||e.quality==="waiting")return a("סנכרון: ממתין לחסם הפתיחה");const t=e.p95===null?"—":a("{n} ש׳",{n:e.p95.toFixed(2)}),s={synced:a("מסונכרן"),slight:a("סטייה קלה"),out_of_sync:a("לא מסונכרן"),waiting:""}[e.quality];return`${a("סנכרון: {quality}",{quality:s})} · p95 ${t}${e.partial?` · ${a("חלקי")}`:""}`}async onSeek(e){const t=e.detail.minute,s=$(this.date,t,this.tz);if(s.getTime()>Date.now()){this.notice=a("לא ניתן לנגן זמן עתידי."),this.scrubbing=!1;return}this.cursor=t,e.detail.alt&&this.bookmarkAt(t),this.seeker.request(s)}onScrub(e){this.scrubbing=!0,this.cursor=e.detail.minute,this.position=$(this.date,e.detail.minute,this.tz)}async nudge(e){const t=this.currentInstant();t&&this.seeker.request(new Date(t.getTime()+e*1e3))}setSpeed(e){if(this.groupMode||e>1)return;this.speed=e;const t=this.masterPlayer();t&&(t.rate=e)}stepFrame(e){const t=this.masterPlayer(),s=this.cams?.find(n=>n.id===this.cameraId),i=s?.stream?.fps&&s.stream.fps>0?s.stream.fps:25;if(!t)return;if(!t.stepFrame(e,i)){this.notice=a("הפריים המבוקש מחוץ למאגר שכבר הגיע מהמקליט — השתמש בקפיצה של 10 שניות או בציר הזמן.");return}this.notice="";const r=this.currentInstant();r&&(this.position=r,this.followDay(r),this.cursor=v(r,this.tz))}togglePause(){const e=this.players();if(e.length){if(this.paused){const t=this.masterPlayer();if(!this.groupMode&&t?.stale&&this.position){this.startAt(this.position);return}e.forEach(s=>s.resume()),this.clock&&this.clockPausedAt&&(this.clock={...this.clock,startedAt:this.clock.startedAt+(performance.now()-this.clockPausedAt)}),this.clockPausedAt=0}else e.forEach(t=>t.pause()),this.clockPausedAt=performance.now();this.paused=!this.paused}}onTilePlayer(e,t){if(this.tileStatus={...this.tileStatus,[e]:t.detail.status},t.detail.status==="playing"&&this.seekSentAt[e]&&!this.firstPlayAt[e]&&(this.firstPlayAt[e]=performance.now(),this.startLatency[e]=this.firstPlayAt[e]-this.seekSentAt[e]),(t.detail.status==="error"||t.detail.status==="ended")&&this.onTileLost(e,t.detail),e===this.cameraId){if(this.masterSession&&t.detail.status==="playing"&&(this.session&&(this.session={...this.session,state:"playing"}),!this.groupMode&&this.speed!==1)){const s=this.masterPlayer();s&&s.rate!==this.speed&&(s.rate=this.speed)}if(t.detail.status==="ended"){const s=this.currentInstant(),i=this.masterSession;s&&i&&new Date(i.playback_end_at).getTime()-s.getTime()<5e3&&this.startAt(new Date(new Date(i.playback_end_at).getTime()+1e3))}}}fmt(e){return vt(e,{timeZone:this.tz,seconds:!0})}openExport(){const e=Math.floor(this.cursor*60)/60;this.exportFrom=A(Math.max(0,e-1)),this.exportTo=A(Math.min(this.limitMinute,e+1)),this.estimate=null,this.exportJob=null,this.exportError="",this.exportOpen=!0}exportRange(){const e=$(this.date,N(this.exportFrom),this.tz),t=$(this.date,N(this.exportTo),this.tz);return t.getTime()<=e.getTime()?(this.exportError=a("זמן הסיום חייב להיות אחרי ההתחלה."),null):[_(e),_(t)]}async runEstimate(){const e=this.exportRange();if(e){this.exportBusy=!0,this.exportError="";try{this.estimate=await W(this.cameraId,e[0],e[1])}catch(t){this.exportError=z(t)}finally{this.exportBusy=!1}}}async runExport(){const e=this.exportRange();if(e){this.exportBusy=!0,this.exportError="";try{const t=this.estimate??await W(this.cameraId,e[0],e[1]);if(this.estimate=t,!t.files){this.exportError=a("אין קבצים מוקלטים בטווח שנבחר.");return}this.exportJob=await Ct(this.cameraId,e[0],e[1])}catch(t){this.exportError=z(t)}finally{this.exportBusy=!1}}}renderExportDialog(){const e=this.estimate,t=this.exportJob;return l`<sw-dialog ?open=${this.exportOpen} heading=${a("ייצוא קטע")} subheading=${`${this.cameraName(this.cameraId)} · ${this.date} · ${this.tz}`} @close=${()=>this.exportOpen=!1}>
      <div class="dlg">
        ${t?l`<div class="est"><strong>${a("עבודת הייצוא נוצרה")}</strong><span>${a("{n} קבצים",{n:t.files.length})} · ${a("משוער {size}",{size:O(t.estimate_bytes)})} · ${a("מצב: {state}",{state:t.state})}</span><span>${a('המקליט עדיין מכין את הקובץ; "מעקב והורדה" למטה עובר למסך שבו כפתור ההורדה יופיע ברגע שהוא מוכן.')}</span></div>`:l`
              <div class="row">
                <sw-field label=${a("מ־")}><input type="time" lang=${I()} step="1" data-ltr .value=${this.exportFrom} @change=${s=>{this.exportFrom=s.target.value,this.estimate=null}} /></sw-field>
                <sw-field label=${a("עד")}><input type="time" lang=${I()} step="1" data-ltr .value=${this.exportTo} @change=${s=>{this.exportTo=s.target.value,this.estimate=null}} /></sw-field>
              </div>
              ${e?l`<div class="est">
                    <span>${a("{n} קבצי מקליט בטווח",{n:e.files})} · ${a("נפח משוער {size} (מקסימום {max})",{size:O(e.estimate_bytes),max:O(e.max_bytes)})} · ${a("כיסוי {coverage}",{coverage:e.coverage==="complete"?a("מלא"):a("חלקי")})}</span>
                    ${e.first_file_at?l`<span class="ltr">${this.fmt(new Date(e.first_file_at))} → ${this.fmt(new Date(e.last_file_end_at??e.first_file_at))}</span>`:w}
                    <span>${e.note}</span>
                    ${e.ffmpeg?w:l`<span class="warn">${a("ffmpeg לא זמין בשרת: הקובץ יימסר במיכל המקורי (Hikvision PS) ללא חיתוך.")}</span>`}
                  </div>`:l`<div class="session">${a("הייצוא מוריד את הקבצים המקוריים מהמקליט (לפי קובץ, כך המכשיר תומך) ואז חותך לטווח ב־keyframe. חשב נפח לפני היצירה.")}</div>`}
            `}
        ${this.exportError?l`<div class="err">${this.exportError}</div>`:w}
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        ${t?l`<sw-button variant="primary" icon="download" @click=${()=>L("/investigate/exports")}>${a("מעקב והורדה")}</sw-button><sw-button @click=${()=>this.exportOpen=!1}>${a("סגור")}</sw-button>`:l`<sw-button ?disabled=${this.exportBusy} @click=${()=>this.runEstimate()}>${a("חשב נפח")}</sw-button>
              <sw-button variant="primary" icon="download" ?disabled=${this.exportBusy} @click=${()=>this.runExport()}>${a("צור ייצוא")}</sw-button>
              <sw-button variant="ghost" @click=${()=>this.exportOpen=!1}>${a("ביטול")}</sw-button>`}
      </div>
    </sw-dialog>`}renderStage(e){const t=this.live,s=!t&&!this.inRecording(this.cursor);if(this.groupMode){const r=this.members;return l`<div class="grid ${r.length===1?"one":r.length>2?"rows2":""}" data-pb-grid=${r.length}>
        ${r.map(n=>{const h=this.group?.sessions.find(g=>g.camera_id===n),o=this.group?.missing[n],d=this.drifts[n],u=this.tileStatus[n];return l`<div class="tile ${n===this.cameraId?"master":""}">
            ${h&&!k.includes(h.state)?l`<sw-live-player data-camera=${n} .wsUrl=${Y(h)} mode="mse" .retry=${!1} recorded compact @player-status=${g=>this.onTilePlayer(n,g)}></sw-live-player>`:this.stallPhase==="gave_up"?w:l`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${o==="gap"||o==="no_recording"?a("אין הקלטה בזמן הזה"):o==="playback_quota"?a("מכסת הניגון מלאה"):this.busy?a("מכין…"):this.group?a("לא זמין"):a("לחץ על ציר הזמן")}</span></div></div>`}
            <span class="name" data-tile=${n} data-tile-state=${this.syncStats?.members[n]?.state??""}>${this.cameraName(n)}${n===this.cameraId?l` · ${a("מוביל")}`:w}${h&&u==="playing"&&Number.isFinite(d)?l`<span class="drift ${Math.abs(d)>2?"bad":""}" title=${a("סטייה מהשעון־אב, נמדדת מהפריים המוצג")}>${d>=0?"+":""}${d.toFixed(1)}s</span>`:w}${this.syncStats?.members[n]?.state==="late"?l`<span class="drift bad">${a("מאחרת")}</span>`:w}${(this.syncStats?.members[n]?.resyncs??0)>0?l`<span class="drift">${a("סונכרן מחדש ×{n}",{n:this.syncStats.members[n].resyncs})}</span>`:w}</span>
          </div>`})}
      </div>`}const i=this.session;return l`<div class="video ${s?"gap":""}">
      ${t&&i?l`<sw-live-player data-camera=${e.id} .wsUrl=${Y(i)} mode="mse" .retry=${!1} recorded @player-status=${r=>this.onTilePlayer(e.id,r)}></sw-live-player>`:this.stallPhase==="gave_up"?w:s?l`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice||a("אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live")}</span></div></div>`:l`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy?a("מכין ניגון…"):a("לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר")}</span>${this.busy?w:l`<sw-button variant="primary" size="sm" icon="play" @click=${()=>this.startAt($(this.date,this.cursor,this.tz))}>${a("נגן מ־{time}",{time:A(this.cursor)})}</sw-button>`}</div></div>`}
      <div class="tag"><sw-badge kind=${t?"recorded":"unknown"} ?onImage=${!!t}></sw-badge><span class="nm">${e.name}</span></div>
    </div>`}renderStall(){return this.stallPhase==="ok"?w:this.stallPhase==="gave_up"?l`<div class="stall" data-stall="gave_up" role="status"><div class="box"><span>${a("הניגון נעצר")}</span><sw-button variant="primary" size="sm" icon="refresh" data-stall-retry ?disabled=${this.busy} @click=${()=>this.retryStalled()}>${a("נסה שוב")}</sw-button></div></div>`:l`<div class="stall" data-stall=${this.stallPhase} role="status"><div class="box"><span class="spin" aria-hidden="true"></span><span>${a("מתחבר מחדש")}</span></div></div>`}renderApi(){if(this.error&&!this.cams)return l`<sw-state-panel state="error" hint=${this.error} actionLabel=${a("נסה שוב")} @action=${()=>this.init()}></sw-state-panel>`;if(!this.cams)return l`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.cams.length)return l`<sw-state-panel icon="history" state="empty" heading=${a("אין מצלמות")} hint=${a("סנכרן מצלמות מהמקליט או בקש הרשאת ניגון.")}></sw-state-panel>`;const e=this.cams.find(o=>o.id===this.cameraId)??this.cams[0],t=this.masterSession,s=this.live,i=t?.time_precision??"unknown",r=this.position??$(this.date,this.cursor,this.tz),n=this.tileStatus[this.cameraId]??"",h=this.masterPlayer()?.transport==="mse";return l`
      <div class="filters">
        ${this.rec?l`<sw-chip icon="history">${a("{n} מקטעים",{n:this.rec.segments.length})} · ${a("{n} קבצים",{n:this.rec.matches})}</sw-chip>`:w}
        ${this.dayEvents.length?l`<sw-chip icon="bell" @click=${()=>L("/investigate/events",{camera:this.cameraId,date:this.date})}>${a("{n} אירועים",{n:this.dayEvents.length})}${this.dayEvents.every(o=>o.confidence==="inferred")?` ${a("(מהקלטות)")}`:""}</sw-chip>`:w}
        ${this.bookmarks.length?l`<sw-chip icon="case" data-bookmarks-count title=${a("סימניות מתיקי חקירה על ציר הזמן · Alt+לחיצה על הציר מוסיפה סימנייה")}>${a("{n} סימניות",{n:this.bookmarks.length})}</sw-chip>`:l`<span class="session" data-bookmarks-hint>${a('אין עדיין סימניות · "הוסף לתיק" מסמן את הרגע הנוכחי, או Alt+לחיצה על הציר מסמנת נקודה אחרת')}</span>`}
        ${this.activeBookmark?l`<sw-chip selected icon="case" data-bookmark-active @click=${()=>L(`/investigate/cases/${this.activeBookmark.case_id}`)}>${a("תיק „{title}”",{title:this.activeBookmark.case_title})}${this.activeBookmark.note?` · ${this.activeBookmark.note}`:""} · ${H[this.activeBookmark.preservation]} · ${a("פתח")}</sw-chip>`:w}
        ${this.rec?.coverage==="partial"?l`<span class="warn">${a("כיסוי חלקי:")} ${this.rec.note}</span>`:w}
        ${this.loadingRec?l`<span class="session">${a("מחפש הקלטות…")}</span>`:w}
        ${this.notice?l`<span class="warn">${this.notice}</span>`:w}
        ${this.error?l`<span class="err">${this.error}</span>`:w}
        <span class="grow"></span>
        <sw-button size="sm" icon="case" data-add-to-case title=${a("סימנייה בנקודה הנוכחית · Alt+לחיצה על הציר מסמנת נקודה אחרת")} ?disabled=${!this.cameraId} @click=${()=>this.casePick={kind:"clip",camera_id:this.cameraId,...V(lt(this.position,this.date,this.cursor,this.tz))}}>${a("הוסף לתיק")}</sw-button>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${()=>this.openExport()}>${a("ייצוא")}</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">${a("במפה")}</sw-button></a>
      </div>
      <div class="compare" data-compare data-picker=${this.tabsMode.ddPicker}>
        ${this.tabsMode.ddPicker==="chips"?this.renderCompareChips():l`<sw-dropdown multiple camera-picker data-compare-pick label=${a("השוואה")} icon="grid" placeholder=${a("השוואה (עד 4)")} max="3" count-base="1" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
              .items=${this.compareItems()} .values=${this.extra} @change=${o=>void this.applyExtra(o.detail.ids??[])}></sw-dropdown>`}
      </div>
      <div class="stage" data-stall-phase=${this.stallPhase} data-stall-attempts=${this.stall.attempts} data-stall-resumes=${this.stall.resumes}>
        ${this.renderStage(e)}
        ${this.renderStall()}
        <span class="stamp">${ee(r,this.date,this.cursor,this.tz)} ${this.fmt(r)} · ${{verified:a("מאומת"),keyframe_limited:a("דיוק לפי keyframe"),estimated:a("משוער"),unknown:"—"}[i]}${!this.groupMode&&this.speed!==1?l` · <span data-speed-active=${this.speed}>${a("{n}× הילוך איטי",{n:this.speed})}</span>`:w}${this.paused&&!this.groupMode?l` · <span data-paused>${a("מושהה · צעד־פריים")}</span>`:w}${this.groupMode?l` · <span data-sync-quality=${this.syncStats?.quality??"waiting"} data-sync-p95=${this.syncStats?.p95??""} data-sync-samples=${this.syncStats?.samples??0}>${this.syncLabel()}</span>`:""}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused?"play":"pause"} label=${this.paused?a("המשך"):a("השהה")} data-pause ?disabled=${!s||n!=="playing"} @click=${()=>this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label=${a("10 שניות אחורה")} ?disabled=${!s||this.busy} @click=${()=>this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label=${a("10 שניות קדימה")} ?disabled=${!s||this.busy} @click=${()=>this.nudge(10)}></sw-button>
          <span class="sep"></span>
          ${[.25,.5,1,2,4].map(o=>{const d=(t?.capabilities.supported_speeds??[1]).includes(o),u=o===1||!this.groupMode&&d&&(o>1||h),g=u?o<1?a("הילוך איטי: המאגר מתמלא בזמן אמת ונצרך לאט יותר — זמן המקור נשאר מדויק"):"":this.groupMode?a("בסנכרון רב־מצלמות נתמך רק 1×"):o>1?a("לא נתמך במסלול הזה: הזרם מגיע מהמקליט בזמן אמת; מהירות מוגברת דורשת מקור ששולח מהר מזמן אמת"):a("הילוך איטי זמין רק בנתיב MSE");return l`<button class="q ${this.speed===o?"on":""}" data-speed=${o} ?disabled=${!u} title=${g} @click=${()=>this.setSpeed(o)}>${o}×</button>`})}
          <span class="sep"></span>
          <button class="q" data-frame-step="-1" ?disabled=${!s||this.groupMode||!this.paused} title=${this.groupMode?a("צעד־פריים זמין במצלמה בודדת"):this.paused?a("פריים אחד אחורה (בתוך המאגר)"):a("צעד־פריים זמין בהשהיה")} @click=${()=>this.stepFrame(-1)}>${a("‹ פריים")}</button>
          <button class="q" data-frame-step="1" ?disabled=${!s||this.groupMode||!this.paused} title=${this.groupMode?a("צעד־פריים זמין במצלמה בודדת"):this.paused?a("פריים אחד קדימה (בתוך המאגר)"):a("צעד־פריים זמין בהשהיה")} @click=${()=>this.stepFrame(1)}>${a("פריים ‹")}</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label=${a("מסך מלא")} ?disabled=${!s} @click=${()=>this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <div class="tlwrap">
        <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .bookmarks=${this.bookmarkMarkers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${i} @seek=${this.onSeek} @bookmark-click=${o=>this.activeBookmark=this.bookmarks.find(d=>d.id===o.detail.id)??null} @scrub=${this.onScrub} @hover=${this.onTlHover} @hover-end=${this.onTlHoverEnd}></sw-timeline>
        ${this.preview?l`<div class="tlpreview" data-tl-preview style="left:${Math.max(104,Math.min(this.preview.width-104,this.preview.x))}px">
              ${this.preview.frame.none?l`<div class="none">${a("אין הקלטה בזמן זה")}</div>`:this.preview.frame.url?l`<img src=${this.preview.frame.url} alt="" class=${this.preview.frame.loading?"stale":""} />`:l`<div class="none">${this.preview.frame.loading?a("טוען תמונה…"):a("אין פריים בזמן זה")}</div>`}
              <span>${F(this.preview.minute)}</span>
            </div>`:w}
      </div>
      <sw-case-picker .item=${this.casePick} subheading=${`${this.cams?.find(o=>o.id===this.cameraId)?.name??""} · ${this.date} ${F(this.cursor)}`} @added=${()=>void this.loadBookmarks()} @close=${()=>this.casePick=null}></sw-case-picker>
      ${B("diagnostics")?l`<div class="session" data-playback-diagnostics>
        <span>Session: ${t?`${t.id} · ${a("דור {n}",{n:this.groupMode?this.group?.generation??t.generation:t.generation})} · ${t.state}`:a("אין")}</span>
        <span>${a("נגן:")} ${n||"—"}${this.paused?` ${a("(מושהה)")}`:""}</span>
        <span data-stall-diag>${a("חיבור מחדש:")} ${this.stall.attempts}/${this.stall.options.maxAttempts} · ${a("הצליחו {n}",{n:this.stall.resumes})}</span>
        <span>${a("אזור זמן:")} <span class="ltr">${this.tz}</span></span>
        <span>${a("כיסוי:")} ${this.rec?this.rec.coverage==="complete"?a("מלא"):this.rec.coverage==="partial"?a("חלקי"):a("לא ידוע"):"—"}</span>
        ${t?l`<span>${a("סוף הטווח:")} ${this.fmt(new Date(t.playback_end_at))}</span>`:w}
        ${this.groupMode?l`<span data-sync-method title=${a('סנכרון: שעון־אב אחד לכל האריחים (חסם פתיחה, ואז חציון זמני הפריימים המוצגים; מתחת לשלושה אריחים — המוביל); הסטייה של כל אריח נמדדת מול השעון, p95 על החלון האחרון; אריח מאחר מסונכרן לבד ואינו מזיז את האחרים (best effort, ללא עוגן זמן מאומת); מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה", לא כמסונכרן')}>${a("סנכרון: שעון־אב אחד")}</span>`:w}
      </div>`:w}
      ${this.renderExportDialog()}
    `}seekDemo(e){this.cursor=e.detail.minute,this.generation+=1}renderDemo(){const e=M.find(i=>i.id===this.demoCamera)??M[0],t=!U.some(i=>this.cursor>=i.startMin&&this.cursor<=i.endMin),s=bt.filter(i=>i.minuteOfDay<1440).filter(i=>this.filter==="all"||i.type===this.filter).map(i=>({minute:i.minuteOfDay,kind:i.type,label:i.title}));return l`
      <div class="video ${t?"gap":""}">
        ${t?l`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${a("אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live")}</span></div></div>`:l`<sw-scene kind=${yt[e.id]??"lobby"}></sw-scene><div class="shade"></div><span class="demo">${a("דמו · אין שרת מחובר")}</span>`}
        <div class="tag"><sw-badge kind=${t?"unknown":"recorded"} ?onImage=${!t}></sw-badge><span class="nm">${e.name}</span></div>
        <span class="stamp">2026-09-14 ${E(this.cursor)}:00 · actual: ${t?"—":E(this.cursor)}</span>
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
      <sw-timeline .segments=${U} .events=${s} .cursor=${this.cursor} precision="estimated" @seek=${this.seekDemo}></sw-timeline>
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
      ${B("diagnostics")?l`<div class="session" data-playback-diagnostics>
        <span>Session: ${this.playing?"playing":"paused"} · ${this.speed}×</span>
        <span>${a("דור {n}",{n:this.generation})}</span>
        <span>${a("דיוק זמן: משוער")}</span>
        <span>${a("כיסוי:")} ${t?a("פער"):a("מלא")} · ${a("6 מקטעים ביום")}</span>
        <span>WebRTC → MSE</span>
        ${t?w:l`<span>${a("מצלמה:")} ${e.name}</span>`}
      </div>`:w}
    `}render(){const e=T(),t=e?this.cams?.find(h=>h.id===this.cameraId):M.find(h=>h.id===this.demoCamera)??M[0],s=t?.name??a("הקלטות"),i=e?`${this.date} ${A(this.cursor)}`:`14.09.2026 ${E(this.cursor)} · ${$t("videoCopy.playbackDemoSub")}`,r=e?a("הקלטות"):`${a("הקלטות")} | ${t?.floor??""}`,n=e?P(new Date,this.tz):"2026-09-14";return l`
      <sw-page heading=${s} subheading=${i} crumbs=${r} wide>
        ${this.fromMap?l`<sw-button slot="actions" size="sm" variant="ghost" icon="map" data-back-to-map @click=${()=>history.back()}>${a("חזרה למפה")}</sw-button>`:w}
        <div slot="actions" class="pick">
          ${e?l`<sw-field><select aria-label=${a("מצלמה")} @change=${h=>this.selectCamera(h.target.value)}>${(this.cams??[]).map(h=>l`<option value=${h.id} ?selected=${h.id===this.cameraId}>${j(h)}</option>`)}</select></sw-field>`:l`<sw-field><select aria-label=${a("מצלמה")} @change=${h=>this.demoCamera=h.target.value}>${M.map(h=>l`<option value=${h.id} ?selected=${h.id===this.demoCamera}>${h.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" lang=${I()} .value=${e?this.date:"2026-09-14"} max=${n} data-ltr aria-label=${a("תאריך")} @change=${h=>e&&this.setDate(h.target.value)} /></sw-field>
          <sw-recorded-month data-recorded-month .value=${e?this.date:"2026-09-14"} .today=${n} .loader=${e?this.monthLoader:ne} ?disabled=${e&&!this.cameraId} @pick=${h=>e&&void this.setDate(h.detail.date)}></sw-recorded-month>
          <sw-field style="inline-size:132px"><input type="time" lang=${I()} step="1" .value=${e?A(this.cursor):E(this.cursor)} data-ltr aria-label=${a("שעה")} @change=${h=>{const o=h.target.value;if(e)this.onSeek(new CustomEvent("seek",{detail:{minute:N(o)}}));else{const[d,u]=o.split(":").map(Number);this.cursor=d*60+u,this.generation+=1}}} /></sw-field>
        </div>
        ${e?w:l`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label=${a("ייצוא קטע")}></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label=${a("שיתוף")}></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label=${a("עוד")}></sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};c.styles=[et`
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
      /* A11Y-AUDIT-2490: the ink of an accent fill (white on the dark scheme's light accent read 2.5:1) */
      color: var(--sw-text-inverse);
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
    ${kt}
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
  `,qt,Bt];f([x()],c.prototype,"cameraId",2);f([x()],c.prototype,"at",2);f([x()],c.prototype,"extraParam",2);f([x({type:Boolean})],c.prototype,"fromMap",2);f([p()],c.prototype,"demoCamera",2);f([p()],c.prototype,"cursor",2);f([p()],c.prototype,"generation",2);f([p()],c.prototype,"playing",2);f([p()],c.prototype,"speed",2);f([p()],c.prototype,"filter",2);f([p()],c.prototype,"cams",2);f([p()],c.prototype,"crossSync",2);f([p()],c.prototype,"tz",2);f([p()],c.prototype,"date",2);f([p()],c.prototype,"rec",2);f([p()],c.prototype,"dayEvents",2);f([p()],c.prototype,"bookmarks",2);f([p()],c.prototype,"activeBookmark",2);f([p()],c.prototype,"loadingRec",2);f([p()],c.prototype,"session",2);f([p()],c.prototype,"group",2);f([p()],c.prototype,"extra",2);f([p()],c.prototype,"casePick",2);f([p()],c.prototype,"preview",2);f([p()],c.prototype,"busy",2);f([p()],c.prototype,"error",2);f([p()],c.prototype,"notice",2);f([p()],c.prototype,"tileStatus",2);f([p()],c.prototype,"drifts",2);f([p()],c.prototype,"clock",2);f([p()],c.prototype,"barrier",2);f([p()],c.prototype,"syncStats",2);f([p()],c.prototype,"paused",2);f([p()],c.prototype,"scrubbing",2);f([p()],c.prototype,"position",2);f([p()],c.prototype,"exportOpen",2);f([p()],c.prototype,"exportFrom",2);f([p()],c.prototype,"exportTo",2);f([p()],c.prototype,"estimate",2);f([p()],c.prototype,"exportJob",2);f([p()],c.prototype,"exportBusy",2);f([p()],c.prototype,"exportError",2);f([p()],c.prototype,"stallPhase",2);c=f([at("investigate-playback")],c);export{c as InvestigatePlayback};
