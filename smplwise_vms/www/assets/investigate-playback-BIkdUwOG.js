import{E as Y,F as k,G as c,c9 as X,a as Q,e as o,A as f,H as tt,S as rt,e2 as nt,i as _,te as ot,K as lt,f7 as ht,tf as R,Y as $,tg as ct,qX as dt,th as pt,j as D,ti as ut,tj as mt,n as ft,cn as A,b0 as I,tk as O,r2 as S,tl as N,r3 as gt,fl as wt,C as vt}from"./index-B0gHNuRZ.js";import{s as bt,c as q}from"./recorders-DwIdSBlR.js";import"./sw-chip-C3wpCPR_.js";import{s as C,m as P}from"./sw-timeline-CcXcx60D.js";import"./sw-case-picker-DvlcAzav.js";import{l as F,B,c as U}from"./cases-RGMq-23z.js";import{i as b,f as yt,d as T,m as g,b as kt,r as xt,e as $t,g as St,s as j,a as zt,h as Mt,c as _t,j as At,p as G}from"./recordings-z0BPACAw.js";import{e as H,c as Pt,f as E}from"./exports-CSBwLVTA.js";import{I as Dt}from"./investigate-r5-css-BUV5E7sj.js";import"./sw-logo-art-Va6y_cIM.js";const It=["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],st=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"],et=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"],it=t=>String(t).padStart(2,"0");function M(t){return t.slice(0,7)}function Tt(t){const[s,e]=t.split("-").map(Number);return new Date(Date.UTC(s,e,0)).getUTCDate()}function Et(t,s){const[e,i]=t.split("-").map(Number),n=e*12+(i-1)+s;return`${Math.floor(n/12)}-${it(n%12+1)}`}function Lt(t){const[s,e,i]=t.split("-").map(Number);return new Date(Date.UTC(s,e-1,i)).getUTCDay()}function Ct(t){const[s,e]=t.split("-").map(Number);return`${et[e-1]} ${s}`}function V(t,s){const e=Tt(t),i=Lt(`${t}-01`),n=new Set(s.recorded),a=Array.from({length:i},()=>null);for(let r=1;r<=e;r++){const l=`${t}-${it(r)}`,u=l>s.today?"future":s.loaded?n.has(l)?"recorded":"empty":"unknown";a.push({date:l,day:r,weekday:(i+r-1)%7,state:u,today:l===s.today,selected:l===s.selected})}return a}function Z(t,s){return t<M(s)}function Rt(t){const[s,e]=t.date.split("-").map(Number),i=`יום ${st[t.weekday]}, ${t.day} ב${et[e-1]} ${s}`,n={recorded:"יש הקלטות",empty:"אין הקלטות",future:"עתידי",unknown:"בבדיקה"}[t.state];return`${i} · ${n}${t.today?" · היום":""}`}function Ot(t,s){const e=t===0?"אין ימים עם הקלטות בחודש זה":t===1?"יום אחד עם הקלטות":`${t} ימים עם הקלטות`;return s==="partial"?`${e} · ייתכן שחסרים ימים (החיפוש הוגבל)`:e}var Nt=Object.defineProperty,qt=Object.getOwnPropertyDescriptor,v=(t,s,e,i)=>{for(var n=i>1?void 0:i?qt(s,e):s,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(i?r(s,e,n):r(n))||n);return i&&n&&Nt(s,e,n),n};let w=class extends Q{constructor(){super(...arguments),this.value="",this.today="",this.loader=null,this.disabled=!1,this.open=!1,this.month="",this.answer=null,this.error="",this.sheet=!1,this.focusDate="",this.seq=0,this.cache=new Map,this.openAtPress=!1,this.onViewport=()=>this.place()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onViewport)}willUpdate(t){t.has("loader")&&t.get("loader")!==void 0&&(this.cache.clear(),this.open&&this.load(this.month))}toggle(){const t=this.open||this.openAtPress;this.openAtPress=!1,t?this.close():this.show()}async show(){this.disabled||(this.month=M(this.value||this.today),this.focusDate=this.value||this.today,this.sheet=window.matchMedia("(max-width: 600px)").matches,this.open=!0,await this.updateComplete,this.pop.showPopover?.(),this.place(),window.addEventListener("resize",this.onViewport),this.load(this.month),this.focusDay(!1))}close(t=!0){if(this.open){this.open=!1,window.removeEventListener("resize",this.onViewport);try{this.pop?.hidePopover?.()}catch{}t&&this.trigger?.focus({preventScroll:!0})}}place(){if(!this.pop)return;if(this.sheet=window.matchMedia("(max-width: 600px)").matches,this.sheet){this.pop.style.removeProperty("left"),this.pop.style.removeProperty("top");return}const t=this.trigger.getBoundingClientRect(),s=this.pop.offsetWidth,e=this.pop.offsetHeight;let n=getComputedStyle(this).direction==="rtl"?t.right-s:t.left;n=Math.max(8,Math.min(n,window.innerWidth-s-8));let a=t.bottom+6;a+e>window.innerHeight-8&&(a=Math.max(8,t.top-e-6)),this.pop.style.left=`${Math.round(n)}px`,this.pop.style.top=`${Math.round(a)}px`}onToggle(t){t.newState==="closed"&&this.open&&(this.open=!1,window.removeEventListener("resize",this.onViewport))}async load(t){const s=++this.seq;this.error="";const e=this.cache.get(t);if(this.answer=e??null,!(e||!this.loader)){if(t>M(this.today)){this.answer={days:[],coverage:"complete"};return}try{const i=await this.loader(t);this.cache.set(t,i),s===this.seq&&(this.answer=i)}catch(i){s===this.seq&&(this.error=i instanceof Error&&i.message?i.message:"בדיקת ההקלטות נכשלה")}}}go(t){const s=Et(this.month,t);if(t>0&&!Z(this.month,this.today))return;this.month=s;const e=Number(this.focusDate.slice(8,10))||1;this.focusDate=this.clampToMonth(s,e),this.load(s)}clampToMonth(t,s){const e=V(t,{recorded:[],today:this.today,loaded:!1}).filter(a=>!!a),i=Math.min(s,e.length),n=`${t}-${String(i).padStart(2,"0")}`;return n>this.today?this.today:n}pick(t){t.state!=="future"&&(this.dispatchEvent(new CustomEvent("pick",{detail:{date:t.date,recorded:t.state==="recorded"},bubbles:!0,composed:!0})),this.close())}onGridKey(t){const s=getComputedStyle(this).direction==="rtl",e={ArrowRight:s?-1:1,ArrowLeft:s?1:-1,ArrowUp:-7,ArrowDown:7};let i=this.focusDate;if(t.key in e){const[n,a,r]=this.focusDate.split("-").map(Number);i=new Date(Date.UTC(n,a-1,r+e[t.key])).toISOString().slice(0,10)}else if(t.key==="PageUp"||t.key==="PageDown"){this.go(t.key==="PageUp"?-1:1),t.preventDefault(),this.updateComplete.then(()=>this.focusDay(!0));return}else return;t.preventDefault(),!(i>this.today)&&(this.focusDate=i,M(i)!==this.month&&(this.month=M(i),this.load(this.month)),this.updateComplete.then(()=>this.focusDay(!0)))}focusDay(t){const s=()=>this.renderRoot.querySelector(`.day[data-date="${this.focusDate}"]`)?.focus({preventScroll:!0});t?s():this.updateComplete.then(()=>requestAnimationFrame(s))}renderGrid(){const t=V(this.month,{recorded:this.answer?.days??[],today:this.today,selected:this.value,loaded:!!this.answer}),s=t.some(e=>e?.date===this.focusDate)?this.focusDate:t.find(e=>e&&e.state!=="future")?.date??"";return o`<div class="grid" role="grid" aria-labelledby="t" aria-busy=${this.answer||this.error?"false":"true"} @keydown=${e=>this.onGridKey(e)}>
      ${It.map((e,i)=>o`<span class="wd" role="columnheader" aria-label=${st[i]}>${e}</span>`)}
      ${t.map(e=>e?o`<button
              class="day"
              role="gridcell"
              data-date=${e.date}
              data-state=${e.state}
              ?data-today=${e.today}
              aria-current=${e.selected?"date":f}
              aria-label=${Rt(e)}
              tabindex=${e.date===s?0:-1}
              ?disabled=${e.state==="future"}
              @click=${()=>this.pick(e)}
            >${e.day}</button>`:o`<span aria-hidden="true"></span>`)}
    </div>`}renderFoot(){return this.error?o`<div class="foot" data-error role="status"><span class="msg">${this.error}</span><button class="retry" @click=${()=>{this.cache.delete(this.month),this.load(this.month)}}>נסה שוב</button></div>`:this.answer?o`<div class="foot" role="status" ?data-partial=${this.answer.coverage==="partial"}><span class="msg" data-summary>${Ot(this.answer.days.length,this.answer.coverage)}</span></div>`:o`<div class="foot" role="status"><span class="msg">בודק אילו ימים הוקלטו…</span></div>`}render(){return o`
      <button
        class="trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded=${this.open?"true":"false"}
        aria-label="לוח חודשי · ימים עם הקלטות"
        title="לוח חודשי · ימים עם הקלטות"
        ?disabled=${this.disabled}
        @pointerdown=${()=>this.openAtPress=this.open}
        @click=${()=>this.toggle()}
      >
        <sw-icon name="calendar" size="18"></sw-icon>
      </button>
      <div class="pop ${this.sheet?"sheet":""}" popover="auto" role="dialog" aria-label="ימים עם הקלטות" @toggle=${t=>this.onToggle(t)}>
        ${this.open?o`
              <div class="head">
                <button class="nav prev" type="button" aria-label="החודש הקודם" @click=${()=>this.go(-1)}><sw-icon name="chevron" size="18"></sw-icon></button>
                <h2 class="title" id="t" aria-live="polite">${Ct(this.month)}</h2>
                <button class="nav next" type="button" aria-label="החודש הבא" ?disabled=${!Z(this.month,this.today)} @click=${()=>this.go(1)}><sw-icon name="chevron" size="18"></sw-icon></button>
              </div>
              ${this.renderGrid()} ${this.renderFoot()}
            `:f}
      </div>
    `}};w.styles=Y`
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
  `;v([k()],w.prototype,"value",2);v([k()],w.prototype,"today",2);v([k({attribute:!1})],w.prototype,"loader",2);v([k({type:Boolean,reflect:!0})],w.prototype,"disabled",2);v([c()],w.prototype,"open",2);v([c()],w.prototype,"month",2);v([c()],w.prototype,"answer",2);v([c()],w.prototype,"error",2);v([c()],w.prototype,"sheet",2);v([c()],w.prototype,"focusDate",2);v([X(".pop")],w.prototype,"pop",2);v([X(".trigger")],w.prototype,"trigger",2);w=v([tt("sw-recorded-month")],w);const x={stallS:5,attempts:3,graceMs:2e3,backoffMs:[3e3,6e3],attemptTimeoutMs:2e4,stableMs:3e4,epsilon:.05};function K(t){const s=(e,i,n,a)=>{const r=Number(e);return Number.isFinite(r)?Math.min(a,Math.max(n,Math.round(r))):i};return{stallMs:s(t["playback.stall_s"],x.stallS,2,30)*1e3,maxAttempts:s(t["playback.auto_resume_attempts"],x.attempts,0,5)}}class W{constructor(s){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks=new Map,this.since=0,this.wait=0,this.pending=!1,this.sentAt=0,this.fault=!1,this.okSince=0,this.o={graceMs:x.graceMs,backoffMs:[...x.backoffMs],attemptTimeoutMs:x.attemptTimeoutMs,stableMs:x.stableMs,epsilon:x.epsilon,...s}}get options(){return this.o}reset(s){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks.clear(),this.pending=!1,this.fault=!1,this.okSince=s}disarm(s,e){const i=this.tracks.get(s);i&&(i.armed=!1,i.at=e)}lost(){this.fault=!0}attemptSent(s){this.phase==="reconnecting"&&(this.pending=!1,this.sentAt=s,this.fault=!1,this.disarmAll(s))}attemptFailed(s){this.phase==="reconnecting"&&this.failAttempt(s)}retry(s){this.attempts=0,this.pending=!1,this.fault=!1,this.phase="stalled",this.since=s,this.wait=0}step(s,e,i){const n=this.o.epsilon;let a=!1,r=!1;const l=new Set;for(const d of e){l.add(d.key);const m=this.tracks.get(d.key);if(!m){this.tracks.set(d.key,{last:d.mediaTime,at:s,armed:!1});continue}if(!i.expect||!d.playing){m.armed=!1,m.last=d.mediaTime,m.at=s;continue}d.mediaTime>m.last+n?(m.armed=!0,m.last=d.mediaTime,m.at=s,a=!0):d.mediaTime<m.last-n?(m.armed=!1,m.last=d.mediaTime,m.at=s):m.armed&&s-m.at>=this.o.stallMs&&(r=!0)}for(const d of[...this.tracks.keys()])l.has(d)||this.tracks.delete(d);const u=this.fault;switch(this.fault=!1,this.phase){case"ok":return i.expect?r||u?(this.phase="stalled",this.since=s,this.wait=this.attempts===0?this.o.graceMs:this.backoff(this.attempts),this.dueAttempt(s,i)):(this.attempts>0&&a&&s-this.okSince>=this.o.stableMs&&(this.attempts=0),"none"):"none";case"stalled":return i.expect?a&&!r&&!u?(this.phase="ok",this.okSince=s,"none"):this.dueAttempt(s,i):(this.phase="ok",this.okSince=s,"none");case"reconnecting":return this.pending?"none":a&&!r?(this.phase="ok",this.resumes+=1,this.okSince=s,"none"):u||s-this.sentAt>=this.o.attemptTimeoutMs?(this.failAttempt(s),this.phase==="stalled"?this.dueAttempt(s,i):"none"):"none";case"gave_up":default:return"none"}}dueAttempt(s,e){return this.attempts>=this.o.maxAttempts?(this.phase="gave_up","none"):s-this.since<this.wait||!e.canAct?"none":(this.phase="reconnecting",this.attempts+=1,this.pending=!0,this.sentAt=s,"resume")}failAttempt(s){if(this.pending=!1,this.attempts>=this.o.maxAttempts){this.phase="gave_up";return}this.phase="stalled",this.since=s,this.wait=this.backoff(this.attempts)}backoff(s){const e=this.o.backoffMs;return e.length?e[Math.min(e.length-1,Math.max(0,s-1))]:0}disarmAll(s){for(const e of this.tracks.values())e.armed=!1,e.at=s}}const J=10;function Ft(t,s){const e=Math.floor(s.getTime()/(J*1e3))*J*1e3,i=new Date(e).toISOString().replace(/\.\d{3}Z$/,"Z");return{key:`${t}|${i}`,atIso:i}}const Bt=async(t,s)=>{const e=await fetch(t,{credentials:"same-origin",signal:s});return e.ok?{ok:!0,blob:await e.blob(),at:e.headers.get("X-Frame-At")}:{ok:!1,status:e.status}};class Ut{constructor(s){this.opts=s,this.cache=new Map,this.noRecording=new Set,this.flights=new Map,this.waiting=null,this.seq=0,this.stats={requests:0,aborted:0,deduped:0},this.state={key:null,url:null,at:null,loading:!1,none:!1},this.maxConcurrent=Math.max(1,s.maxConcurrent??2),this.cacheSize=Math.max(4,s.cacheSize??40),this.makeUrl=s.makeUrl??(e=>URL.createObjectURL(e)),this.revokeUrl=s.revokeUrl??(e=>URL.revokeObjectURL(e))}want(s,e){const i=this.cache.get(s);if(i){this.cache.delete(s),this.cache.set(s,i),this.stats.deduped+=1,this.waiting=null,this.set({key:s,url:i.url,at:i.at,loading:!1,none:!1});return}if(this.noRecording.has(s)){this.stats.deduped+=1,this.waiting=null,this.set({key:s,url:this.state.url,at:this.state.at,loading:!1,none:!0});return}if(this.set({key:s,url:this.state.url,at:this.state.at,loading:!0,none:!1}),this.flights.has(s)){this.stats.deduped+=1,this.waiting=null;return}this.waiting={key:s,url:e},this.pump()}clear(){this.waiting=null;for(const s of this.flights.values())s.ctrl.abort(),this.stats.aborted+=1;this.flights.clear(),this.set({key:null,url:null,at:null,loading:!1,none:!1})}dispose(){this.clear();for(const s of this.cache.values())this.revokeUrl(s.url);this.cache.clear(),this.noRecording.clear()}get inFlight(){return this.flights.size}set(s){this.state=s,this.opts.onChange(s)}pump(){const s=this.waiting;if(!s)return;if(this.flights.size>=this.maxConcurrent){const n=[...this.flights.values()].filter(a=>a.key!==this.state.key).sort((a,r)=>a.started-r.started)[0];if(!n)return;n.ctrl.abort(),this.flights.delete(n.key),this.stats.aborted+=1}this.waiting=null;const e=new AbortController,i={key:s.key,ctrl:e,started:++this.seq};this.flights.set(s.key,i),this.stats.requests+=1,this.opts.fetchFrame(s.url,e.signal).then(n=>this.done(i,n)).catch(()=>this.done(i,null))}done(s,e){if(this.flights.get(s.key)===s&&this.flights.delete(s.key),s.ctrl.signal.aborted){this.pump();return}if(e&&e.ok){const n=this.makeUrl(e.blob);if(this.cache.set(s.key,{url:n,at:e.at}),this.cache.size>this.cacheSize)for(const[a,r]of[...this.cache]){if(this.cache.size<=this.cacheSize)break;r.url!==this.state.url&&(this.cache.delete(a),this.revokeUrl(r.url))}this.state.key===s.key?this.set({key:s.key,url:n,at:e.at,loading:!1,none:!1}):!this.state.url&&this.state.key!==null&&this.set({...this.state,url:n,at:e.at})}else e&&!e.ok&&e.status===404?(this.noRecording.size>500&&this.noRecording.clear(),this.noRecording.add(s.key),this.state.key===s.key&&this.set({...this.state,loading:!1,none:!0})):this.state.key===s.key&&this.set({...this.state,loading:!1});this.pump()}}const jt=250,Gt={set:(t,s)=>setTimeout(t,s),clear:t=>clearTimeout(t)};class Ht{constructor(s,e={}){this.run=s,this.hasLatest=!1,this.timer=null,this.inflight=!1,this.stats={requested:0,sent:0,coalesced:0},this.delayMs=e.delayMs??jt,this.busyRetryMs=e.busyRetryMs??200,this.timers=e.timers??Gt}request(s){this.stats.requested+=1,this.hasLatest&&(this.stats.coalesced+=1),this.latest=s,this.hasLatest=!0,this.arm(this.delayMs)}flush(){this.timer!==null&&(this.timers.clear(this.timer),this.timer=null),this.fire()}cancel(){this.timer!==null&&this.timers.clear(this.timer),this.timer=null,this.hasLatest=!1,this.latest=void 0}get pending(){return this.hasLatest}get inFlight(){return this.inflight}arm(s){this.timer!==null&&this.timers.clear(this.timer),this.timer=this.timers.set(()=>{this.timer=null,this.fire()},s)}fire(){if(!this.hasLatest||this.inflight)return;const s=this.latest;this.hasLatest=!1,this.latest=void 0,this.inflight=!0,this.stats.sent+=1;const e=n=>{if(this.inflight=!1,n==="busy"&&!this.hasLatest){this.latest=s,this.hasLatest=!0,this.arm(this.busyRetryMs);return}this.hasLatest&&this.timer===null&&this.fire()};let i;try{i=this.run(s)}catch{i=Promise.resolve()}i.then(e,()=>e())}}var Vt=Object.defineProperty,Zt=Object.getOwnPropertyDescriptor,p=(t,s,e,i)=>{for(var n=i>1?void 0:i?Zt(s,e):s,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(i?r(s,e,n):r(n))||n);return i&&n&&Vt(s,e,n),n};const y=["closed","expired","failed"],Kt=[4401,4403,4410,4429,"access_lost","remote_live_cap"],Wt=120,Jt=async t=>({days:t==="2026-09"?Array.from({length:14},(s,e)=>`2026-09-${String(e+1).padStart(2,"0")}`).filter(s=>s!=="2026-09-06"&&s!=="2026-09-07"):[],coverage:"complete"});function z(t){return C(Math.max(0,Math.min(1439.983,t)))}function L(t){const[s=0,e=0,i=0]=t.split(":").map(Number);return s*60+e+i/60}function Yt(t){const s=t.map(e=>Math.abs(e)).sort((e,i)=>e-i);return s[Math.min(s.length-1,Math.max(0,Math.ceil(.95*s.length)-1))]}let h=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new rt(this),this.tabsMode=new nt(this,"security"),this.cameraId="",this.at="",this.extraParam="",this.fromMap=!1,this.demoCamera="cam-10",this.cursor=615,this.generation=3,this.playing=!0,this.speed=1,this.filter="all",this.cams=null,this.crossSync=!1,this.tz="Asia/Jerusalem",this.date="",this.rec=null,this.dayEvents=[],this.bookmarks=[],this.activeBookmark=null,this.loadingRec=!1,this.session=null,this.group=null,this.extra=[],this.casePick=null,this.preview=null,this.previewTimer=0,this.frames=new Ut({fetchFrame:Bt,onChange:t=>{this.preview&&(this.preview={...this.preview,frame:t})}}),this.seeker=new Ht(async t=>await this.startAt(t)==="skipped"&&this.busy?"busy":"done"),this.busy=!1,this.error="",this.notice="",this.tileStatus={},this.drifts={},this.clock=null,this.barrier="none",this.syncStats=null,this.clockPausedAt=0,this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={},this.groupStartedAt=0,this.lastReport=0,this.seekSentAt={},this.firstPlayAt={},this.startLatency={},this.paused=!1,this.scrubbing=!1,this.position=null,this.exportOpen=!1,this.exportFrom="",this.exportTo="",this.estimate=null,this.exportJob=null,this.exportBusy=!1,this.exportError="",this.stall=new W(K({})),this.stallPhase="ok",this.stoppedAt=null,this.onTlHover=t=>{if(!this.cameraId||!_())return;window.clearTimeout(this.previewTimer);const s=t.detail;this.preview&&(this.preview={...this.preview,minute:s.minute,x:s.x,width:s.width}),this.previewTimer=window.setTimeout(()=>{const{key:e,atIso:i}=Ft(this.cameraId,b(this.date,s.minute,this.tz));this.preview||(this.preview={minute:s.minute,x:s.x,width:s.width,frame:this.frames.state}),this.frames.want(e,yt(this.cameraId,i))},Wt)},this.onTlHoverEnd=()=>{window.clearTimeout(this.previewTimer),this.frames.clear(),this.preview=null},this.monthLoaderFor="",this.monthLoaderFn=null}connectedCallback(){super.connectedCallback(),this.stopDisplay=ot(()=>this.requestUpdate()),_()&&(this.init(),this.ticker=window.setInterval(()=>this.tick(),500))}disconnectedCallback(){super.disconnectedCallback(),this.stopDisplay?.(),window.clearInterval(this.ticker),window.clearTimeout(this.previewTimer),this.frames.dispose(),this.endSession()}updated(t){_()&&t.has("cameraId")&&t.get("cameraId")!==void 0&&this.cams&&this.selectCamera(this.cameraId,!0)}get members(){return[this.cameraId,...this.extra.filter(t=>t!==this.cameraId)]}get groupMode(){return this.extra.filter(t=>t!==this.cameraId).length>0}get masterSession(){return this.groupMode?this.group?.sessions.find(t=>t.camera_id===this.cameraId)??this.group?.sessions[0]??null:this.session}get live(){const t=this.masterSession;return!!t&&!y.includes(t.state)&&(this.groupMode?!!this.group:!0)}async init(){try{const[t,s]=await Promise.all([lt(),ht()]);this.tz=t["time.zone"]??"Asia/Jerusalem",this.cams=s.cameras.filter(a=>a.enabled&&a.recorder_enabled!==!1&&!a.standalone),this.crossSync=String(t["playback.cross_recorder_sync"]??"false")==="true",this.stall=new W(K(t));const e=this.cams.find(a=>a.id===this.cameraId)??this.cams[0],i=this.at?new Date(this.at):null,n=!!i&&!Number.isNaN(i.getTime());if(this.date=T(n?i:new Date,this.tz),e)if(this.cameraId=e.id,this.extraParam&&(this.extra=R(this.extraParam,e.id,this.cams.map(a=>a.id))),await this.loadRecordings(),n)this.cursor=g(i,this.tz),await this.startAt(i);else{const a=this.rec?.segments.at(-1);this.cursor=a?this.insideLast(a):Math.max(0,g(new Date,this.tz)-5)}}catch(t){this.error=$(t)}}async selectCamera(t,s=!1){!t||!s&&t===this.cameraId||(this.clearStall(),await this.endSession(),this.frames.dispose(),this.cameraId=t,this.extra=this.extra.filter(e=>e!==t),this.error="",this.notice="",await this.loadRecordings())}get monthLoader(){if(!this.cameraId)return null;if(this.monthLoaderFor!==this.cameraId||!this.monthLoaderFn){const t=this.cameraId;this.monthLoaderFor=t,this.monthLoaderFn=async s=>{try{const e=await kt(t,s);return{days:e.days,coverage:e.coverage}}catch(e){throw new Error($(e))}}}return this.monthLoaderFn}async setDate(t){if(!t||t===this.date)return;this.clearStall(),await this.endSession(),this.date=t,await this.loadRecordings();const s=this.rec?.segments.at(-1);this.cursor=s?this.insideLast(s):540}insideLast(t){const s=g(new Date(t.start_at),this.tz),e=g(new Date(t.end_at),this.tz);return Math.max(0,s,e-5)}async loadRecordings(){if(!(!this.cameraId||!this.date)){this.loadingRec=!0,this.rec=null;try{const[t,s,e]=await Promise.all([xt(this.cameraId,this.date).then(i=>({ok:!0,r:i}),i=>({ok:!1,e:i})),ct(this.cameraId,this.date).catch(()=>({events:[]})),F(this.cameraId,this.date).catch(()=>({bookmarks:[]}))]);if(this.dayEvents=s.events,this.bookmarks=e.bookmarks,this.activeBookmark=null,!t.ok)throw t.e;this.rec=t.r,this.error=""}catch(t){this.error=$(t)}finally{this.loadingRec=!1}}}get markers(){return this.dayEvents.map(t=>({minute:g(new Date(t.occurred_at),this.tz),kind:pt(t.type),label:`${dt[t.type]??t.type}${t.confidence==="inferred"?" (מהקלטה)":""}${t.count>1?` ×${t.count}`:""}`}))}get bookmarkMarkers(){return this.bookmarks.map(t=>({id:t.id,minute:g(new Date(t.from_at),this.tz),endMinute:g(new Date(t.to_at),this.tz),label:`תיק „${t.case_title}”${t.note?` · ${t.note}`:""} · ${B[t.preservation]}`,preservation:t.preservation}))}async loadBookmarks(){if(!(!this.cameraId||!this.date))try{this.bookmarks=(await F(this.cameraId,this.date)).bookmarks}catch{}}bookmarkAt(t){this.cameraId&&(this.casePick={kind:"clip",camera_id:this.cameraId,...U(b(this.date,t,this.tz),10,20),note:"סימנייה"})}get segmentsMin(){return this.rec?this.rec.segments.map(t=>{const s=g(new Date(t.start_at),this.tz);let e=g(new Date(t.end_at),this.tz);return e<s&&(e=1440),{startMin:s,endMin:e,kind:t.kind==="continuous"?"continuous":"motion"}}):[]}inRecording(t){return this.segmentsMin.some(s=>t>=s.startMin&&t<=s.endMin)}get limitMinute(){return this.date===T(new Date,this.tz)?g(new Date,this.tz):1440}cameraName(t){return this.cams?.find(s=>s.id===t)?.name??t}async startAt(t,s={}){if(!this.cameraId||this.busy)return"skipped";s.auto||this.clearStall(),this.busy=!0,this.error="",this.notice="",this.scrubbing=!1;try{const e=t.toISOString().replace(/\.\d{3}Z$/,"Z");if(this.groupMode){const i=performance.now(),n=this.group&&this.group.sessions.some(r=>!y.includes(r.state))?await $t(this.group.id,e):await St(this.members,e);this.group=n;for(const r of n.sessions)this.seekSentAt[r.camera_id]=i,delete this.firstPlayAt[r.camera_id];this.session=null,this.position=new Date(n.requested_at);const a=Object.keys(n.missing);a.length&&(this.notice=`ללא הקלטה בזמן הזה: ${a.map(r=>this.cameraName(r)).join(", ")}`)}else{const i=this.session&&!y.includes(this.session.state)?await j(this.session.id,e):await zt(this.cameraId,e);this.session=i,this.group=null,this.position=new Date(i.requested_at),i.moved_to_next_segment&&(this.notice=`אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא (${this.fmt(new Date(i.requested_at))}).`)}return this.cursor=g(this.position,this.tz),this.paused=!1,this.tileStatus={},this.drifts={},this.resetClock(),this.isConnected?"ok":(await this.endSession(),"skipped")}catch(e){if(e instanceof D&&e.body.code==="no_recording")return this.notice="אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live.",this.position=t,"no_recording";if(e instanceof D&&(e.body.code==="seek_rate"||e.body.code==="seek_busy")){this.notice=e.body.user_message||"יותר מדי קפיצות בזמן; המתן מעט ונסה שוב.";const i=this.currentInstant();return i&&(this.cursor=g(i,this.tz)),"error"}else{if(e instanceof D&&(e.body.code==="session_over"||e.body.code==="not_found"))return this.session=null,this.group=null,this.busy=!1,this.startAt(t,s);s.auto||(this.error=$(e))}return"error"}finally{this.busy=!1}}clearStall(){this.stall.reset(performance.now()),this.stallPhase="ok",this.stoppedAt=null}watchStall(){if(this.stallPhase==="gave_up")return;const t=this.groupMode?this.group?.sessions??[]:this.session?[this.session]:[],s=new Set(t.filter(a=>!y.includes(a.state)).map(a=>a.camera_id)),e=this.players().filter(a=>s.has(a.dataset.camera??"")).map(a=>({key:a.dataset.camera??"",mediaTime:a.mediaTime,playing:a.status==="playing"})),i=s.size>0&&!this.paused&&!this.scrubbing,n=this.stall.step(performance.now(),e,{expect:i,canAct:!this.busy});if(this.stall.phase==="gave_up"){this.giveUp();return}this.stallPhase=this.stall.phase,n==="resume"&&this.autoResume()}async autoResume(){const t=this.currentInstant()??this.position;if(!t){this.stall.attemptFailed(performance.now());return}let s=t;const e=this.masterSession?new Date(this.masterSession.playback_end_at).getTime():NaN;Number.isFinite(e)&&e-t.getTime()<3e3&&(s=new Date(e+1e3));const i=await this.startAt(s,{auto:!0});this.stallPhase==="ok"&&this.stall.phase==="ok"||(i==="ok"?this.stall.attemptSent(performance.now()):i==="no_recording"?this.clearStall():this.stall.attemptFailed(performance.now()),this.stall.phase==="gave_up"?this.giveUp():this.stallPhase=this.stall.phase)}async giveUp(){this.stallPhase!=="gave_up"&&(this.stoppedAt=this.currentInstant()??this.position,this.stallPhase="gave_up",await this.endSession())}async retryStalled(){const t=this.stoppedAt??this.position??b(this.date,this.cursor,this.tz);await this.startAt(t)}onTileLost(t,s){if(!(s.status==="error"&&s.code!==void 0&&Kt.includes(s.code))){if(s.status==="ended"){const e=this.groupMode?this.group?.sessions.find(a=>a.camera_id===t):this.session,i=this.players().find(a=>a.dataset.camera===t);if(!e||!i)return;const n=new Date(e.requested_at).getTime()+i.mediaTime*1e3;if(new Date(e.playback_end_at).getTime()-n<5e3)return}this.stall.lost()}}async endSession(){this.seeker.cancel();const t=this.session,s=this.group;this.session=null,this.group=null,this.tileStatus={},this.drifts={},this.resetClock(),this.stall.reset(performance.now());try{s?await Mt(s.id):t&&!y.includes(t.state)&&await _t(t.id)}catch{}}async applyExtra(t){const s=R(t.join(","),this.cameraId,this.cams?.map(i=>i.id)??[]);if(s.join(",")===this.extra.join(","))return;const e=this.currentInstant();this.extra=s,await this.endSession(),e&&await this.startAt(e)}compareItems(){const t=this.cameraId?[this.cameraId]:[];return(this.cams??[]).filter(s=>s.id!==this.cameraId).map(s=>{const e=!this.extra.includes(s.id)&&!bt(t,this.cams??[],s.id,this.crossSync);return{id:s.id,label:q(s),icon:"camera",disabled:e,note:e?"מקליט אחר":void 0}})}renderCompareChips(){const t=this.extra.length>=3;return o`<span>השוואה (עד 4):</span>${this.compareItems().map(s=>{const e=this.extra.includes(s.id),i=s.note??(!e&&t?ut(3,1):"");return o`<sw-chip data-compare-chip=${s.id} ?selected=${e} ?disabled=${!e&&(s.disabled||t)} title=${i||f} @click=${()=>void this.applyExtra(mt(this.extra,s.id,3).ids)}>${s.label}</sw-chip>`})}`}players(){return Array.from(this.renderRoot.querySelectorAll("sw-live-player"))}masterPlayer(){return this.players().find(t=>t.dataset.camera===this.cameraId)??this.players()[0]}currentInstant(){const t=this.masterSession;if(!t)return this.position;if(this.groupMode&&this.clock)return new Date(this.clockNow());const s=new Date(t.requested_at).getTime();return new Date(s+(this.masterPlayer()?.mediaTime??0)*1e3)}tick(){if(this.watchStall(),!this.masterSession||this.paused||this.scrubbing)return;if(this.groupMode&&this.group){this.tickGroup();return}const s=this.masterPlayer();if(!s||s.status!=="playing")return;const e=this.currentInstant();e&&(this.position=e,this.cursor=g(e,this.tz),s.stale&&s.bufferAhead<.4&&!this.busy&&this.startAt(e))}resetClock(){this.clock=null,this.clockPausedAt=0,this.barrier=this.groupMode?"waiting":"none",this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={};for(const t of this.players())t.rate=1;this.groupMode&&(this.speed=1),this.syncStats=null,this.groupStartedAt=performance.now(),this.lastReport=0}clockNow(){const t=this.clock;return t.baseMs+((this.paused&&this.clockPausedAt?this.clockPausedAt:performance.now())-t.startedAt)}tickGroup(){const t=this.group,s=performance.now(),e=this.players().map(l=>{const u=l.dataset.camera??"",d=t.sessions.find(m=>m.camera_id===u);return{cid:u,p:l,sess:d,at:d?new Date(d.requested_at).getTime()+l.mediaTime*1e3:NaN}}).filter(l=>l.sess&&!y.includes(l.sess.state)),i=e.filter(l=>l.p.status==="playing");if(!this.clock){const l=e.length>0&&i.length===e.length,u=s-this.groupStartedAt>12e3&&i.length>0;if(!l&&!u){this.barrier="waiting";return}const d=i.find(m=>m.cid===this.cameraId)??i[0];this.clock={baseMs:d.at,startedAt:s},this.barrier="passed",this.driftSamples={},this.lateSince={}}let n=this.clockNow();if(i.length>=3){const l=i.map(u=>u.at).sort((u,d)=>u-d);n=l[Math.floor(l.length/2)]}else i.length&&(n=(i.find(l=>l.cid===this.cameraId)??i[0]).at);this.clock={baseMs:n,startedAt:s};const a=new Date(n);this.position=a,this.cursor=g(a,this.tz);const r={};for(const l of e){if(l.p.status!=="playing"){r[l.cid]=NaN,this.lateSince[l.cid]||(this.lateSince[l.cid]=s);continue}delete this.lateSince[l.cid];const u=(l.at-n)/1e3;r[l.cid]=u;const d=this.driftSamples[l.cid]??=[];if(d.push(u),d.length>40&&d.shift(),d.length>=2&&Math.abs(u)>.25&&Math.abs(u)<=3){const m=u<0?Math.abs(u)>1?1.15:1.05:Math.abs(u)>1?.85:.95;l.p.rate!==m&&(this.nudges[l.cid]=(this.nudges[l.cid]??0)+1),l.p.rate=m}else(Math.abs(u)<=.25||Math.abs(u)>3)&&(l.p.rate=1);l.cid!==this.cameraId&&d.length>=4&&d.slice(-4).every(m=>Math.abs(m)>3)&&(this.resyncs[l.cid]??0)<2&&s-(this.resyncAt[l.cid]??0)>2e4&&this.resyncMember(l.cid,n)}this.drifts=r,this.syncStats=this.computeSync(e.map(l=>l.cid),s),s-this.lastReport>5e3&&this.syncStats.samples>=4&&(this.lastReport=s,At(t.id,this.syncStats).catch(()=>{}))}computeSync(t,s){const e={};let i=null,n=0;for(const u of t){const d=this.driftSamples[u]??[],m=d.length?Yt(d):null,at=this.lateSince[u]?s-this.lateSince[u]>8e3:!1;e[u]={p95:m,samples:d.length,last:d.length?d[d.length-1]:null,resyncs:this.resyncs[u]??0,state:at?"late":d.length?"measured":"waiting",latency_ms:this.startLatency[u]??null,nudges:this.nudges[u]??0},n+=d.length,m!==null&&(i=i===null?m:Math.max(i,m))}const a=Object.keys(this.group?.missing??{}),r=Object.values(e).some(u=>u.state==="late"),l=this.barrier!=="passed"||i===null?"waiting":i<=.5?"synced":i<=2?"slight":"out_of_sync";return{p95:i,quality:l,samples:n,partial:a.length>0||r,missing:a,members:e}}async resyncMember(t,s){const e=this.group,i=e?.sessions.find(a=>a.camera_id===t);if(!e||!i||y.includes(i.state))return;this.resyncAt[t]=performance.now(),this.resyncs[t]=(this.resyncs[t]??0)+1,this.stall.disarm(t,performance.now()),this.driftSamples[t]=[];const n=Math.min(this.startLatency[t]??4e3,15e3);try{const a=await j(i.id,new Date(s+n).toISOString().replace(/\.\d{3}Z$/,"Z"));this.group===e&&(this.group={...e,sessions:e.sessions.map(r=>r.id===a.id?a:r)}),this.seekSentAt[t]=performance.now(),delete this.firstPlayAt[t]}catch{}}syncLabel(){const t=this.syncStats;if(this.barrier==="waiting"||!t||t.quality==="waiting")return"סנכרון: ממתין לחסם הפתיחה";const s=t.p95===null?"—":`${t.p95.toFixed(2)} ש׳`;return`סנכרון: ${{synced:"מסונכרן",slight:"סטייה קלה",out_of_sync:"לא מסונכרן",waiting:""}[t.quality]} · p95 ${s}${t.partial?" · חלקי":""}`}async onSeek(t){const s=t.detail.minute,e=b(this.date,s,this.tz);if(e.getTime()>Date.now()){this.notice="לא ניתן לנגן זמן עתידי.",this.scrubbing=!1;return}this.cursor=s,t.detail.alt&&this.bookmarkAt(s),this.seeker.request(e)}onScrub(t){this.scrubbing=!0,this.cursor=t.detail.minute,this.position=b(this.date,t.detail.minute,this.tz)}async nudge(t){const s=this.currentInstant();s&&this.seeker.request(new Date(s.getTime()+t*1e3))}setSpeed(t){if(this.groupMode||t>1)return;this.speed=t;const s=this.masterPlayer();s&&(s.rate=t)}stepFrame(t){const s=this.masterPlayer(),e=this.cams?.find(a=>a.id===this.cameraId),i=e?.stream?.fps&&e.stream.fps>0?e.stream.fps:25;if(!s)return;if(!s.stepFrame(t,i)){this.notice="הפריים המבוקש מחוץ למאגר שכבר הגיע מה־NVR — השתמש בקפיצה של 10 שניות או בציר הזמן.";return}this.notice="";const n=this.currentInstant();n&&(this.position=n,this.cursor=g(n,this.tz))}togglePause(){const t=this.players();if(t.length){if(this.paused){const s=this.masterPlayer();if(!this.groupMode&&s?.stale&&this.position){this.startAt(this.position);return}t.forEach(e=>e.resume()),this.clock&&this.clockPausedAt&&(this.clock={...this.clock,startedAt:this.clock.startedAt+(performance.now()-this.clockPausedAt)}),this.clockPausedAt=0}else t.forEach(s=>s.pause()),this.clockPausedAt=performance.now();this.paused=!this.paused}}onTilePlayer(t,s){if(this.tileStatus={...this.tileStatus,[t]:s.detail.status},s.detail.status==="playing"&&this.seekSentAt[t]&&!this.firstPlayAt[t]&&(this.firstPlayAt[t]=performance.now(),this.startLatency[t]=this.firstPlayAt[t]-this.seekSentAt[t]),(s.detail.status==="error"||s.detail.status==="ended")&&this.onTileLost(t,s.detail),t===this.cameraId){if(this.masterSession&&s.detail.status==="playing"&&(this.session&&(this.session={...this.session,state:"playing"}),!this.groupMode&&this.speed!==1)){const e=this.masterPlayer();e&&e.rate!==this.speed&&(e.rate=this.speed)}if(s.detail.status==="ended"){const e=this.currentInstant(),i=this.masterSession;e&&i&&new Date(i.playback_end_at).getTime()-e.getTime()<5e3&&this.startAt(new Date(new Date(i.playback_end_at).getTime()+1e3))}}}fmt(t){return ft(t,{timeZone:this.tz,seconds:!0})}openExport(){const t=Math.floor(this.cursor*60)/60;this.exportFrom=z(Math.max(0,t-1)),this.exportTo=z(Math.min(this.limitMinute,t+1)),this.estimate=null,this.exportJob=null,this.exportError="",this.exportOpen=!0}exportRange(){const t=b(this.date,L(this.exportFrom),this.tz),s=b(this.date,L(this.exportTo),this.tz);return s.getTime()<=t.getTime()?(this.exportError="זמן הסיום חייב להיות אחרי ההתחלה.",null):[t.toISOString().replace(/\.\d{3}Z$/,"Z"),s.toISOString().replace(/\.\d{3}Z$/,"Z")]}async runEstimate(){const t=this.exportRange();if(t){this.exportBusy=!0,this.exportError="";try{this.estimate=await H(this.cameraId,t[0],t[1])}catch(s){this.exportError=$(s)}finally{this.exportBusy=!1}}}async runExport(){const t=this.exportRange();if(t){this.exportBusy=!0,this.exportError="";try{const s=this.estimate??await H(this.cameraId,t[0],t[1]);if(this.estimate=s,!s.files){this.exportError="אין קבצים מוקלטים בטווח שנבחר.";return}this.exportJob=await Pt(this.cameraId,t[0],t[1])}catch(s){this.exportError=$(s)}finally{this.exportBusy=!1}}}renderExportDialog(){const t=this.estimate,s=this.exportJob;return o`<sw-dialog ?open=${this.exportOpen} heading="ייצוא קטע" subheading=${`${this.cameraName(this.cameraId)} · ${this.date} · ${this.tz}`} @close=${()=>this.exportOpen=!1}>
      <div class="dlg">
        ${s?o`<div class="est"><strong>עבודת הייצוא נוצרה</strong><span>${s.files.length} קבצים · משוער ${E(s.estimate_bytes)} · מצב: ${s.state}</span><span>ה־NVR עדיין מכין את הקובץ; "מעקב והורדה" למטה עובר למסך שבו כפתור ההורדה יופיע ברגע שהוא מוכן.</span></div>`:o`
              <div class="row">
                <sw-field label="מ־"><input type="time" lang=${A()} step="1" data-ltr .value=${this.exportFrom} @change=${e=>{this.exportFrom=e.target.value,this.estimate=null}} /></sw-field>
                <sw-field label="עד"><input type="time" lang=${A()} step="1" data-ltr .value=${this.exportTo} @change=${e=>{this.exportTo=e.target.value,this.estimate=null}} /></sw-field>
              </div>
              ${t?o`<div class="est">
                    <span>${t.files} קבצי NVR בטווח · נפח משוער ${E(t.estimate_bytes)} (מקסימום ${E(t.max_bytes)}) · כיסוי ${t.coverage==="complete"?"מלא":"חלקי"}</span>
                    ${t.first_file_at?o`<span class="ltr">${this.fmt(new Date(t.first_file_at))} → ${this.fmt(new Date(t.last_file_end_at??t.first_file_at))}</span>`:f}
                    <span>${t.note}</span>
                    ${t.ffmpeg?f:o`<span class="warn">ffmpeg לא זמין בשרת: הקובץ יימסר במיכל המקורי (Hikvision PS) ללא חיתוך.</span>`}
                  </div>`:o`<div class="session">הייצוא מוריד את הקבצים המקוריים מה־NVR (לפי קובץ, כך המכשיר תומך) ואז חותך לטווח ב־keyframe. חשב נפח לפני היצירה.</div>`}
            `}
        ${this.exportError?o`<div class="err">${this.exportError}</div>`:f}
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        ${s?o`<sw-button variant="primary" icon="download" @click=${()=>I("/investigate/exports")}>מעקב והורדה</sw-button><sw-button @click=${()=>this.exportOpen=!1}>סגור</sw-button>`:o`<sw-button ?disabled=${this.exportBusy} @click=${()=>this.runEstimate()}>חשב נפח</sw-button>
              <sw-button variant="primary" icon="download" ?disabled=${this.exportBusy} @click=${()=>this.runExport()}>צור ייצוא</sw-button>
              <sw-button variant="ghost" @click=${()=>this.exportOpen=!1}>ביטול</sw-button>`}
      </div>
    </sw-dialog>`}renderStage(t){const s=this.live,e=!s&&!this.inRecording(this.cursor);if(this.groupMode){const n=this.members;return o`<div class="grid ${n.length===1?"one":""}">
        ${n.map(a=>{const r=this.group?.sessions.find(m=>m.camera_id===a),l=this.group?.missing[a],u=this.drifts[a],d=this.tileStatus[a];return o`<div class="tile ${a===this.cameraId?"master":""}">
            ${r&&!y.includes(r.state)?o`<sw-live-player data-camera=${a} .wsUrl=${G(r)} mode="mse" .retry=${!1} recorded compact @player-status=${m=>this.onTilePlayer(a,m)}></sw-live-player>`:this.stallPhase==="gave_up"?f:o`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${l==="gap"||l==="no_recording"?"אין הקלטה בזמן הזה":l==="playback_quota"?"מכסת הניגון מלאה":this.busy?"מכין…":this.group?"לא זמין":"לחץ על ציר הזמן"}</span></div></div>`}
            <span class="name" data-tile=${a} data-tile-state=${this.syncStats?.members[a]?.state??""}>${this.cameraName(a)}${a===this.cameraId?o` · מוביל`:f}${r&&d==="playing"&&Number.isFinite(u)?o`<span class="drift ${Math.abs(u)>2?"bad":""}" title="סטייה מהשעון־אב, נמדדת מהפריים המוצג">${u>=0?"+":""}${u.toFixed(1)}s</span>`:f}${this.syncStats?.members[a]?.state==="late"?o`<span class="drift bad">מאחרת</span>`:f}${(this.syncStats?.members[a]?.resyncs??0)>0?o`<span class="drift">סונכרן מחדש ×${this.syncStats.members[a].resyncs}</span>`:f}</span>
          </div>`})}
      </div>`}const i=this.session;return o`<div class="video ${e?"gap":""}">
      ${s&&i?o`<sw-live-player data-camera=${t.id} .wsUrl=${G(i)} mode="mse" .retry=${!1} recorded @player-status=${n=>this.onTilePlayer(t.id,n)}></sw-live-player>`:this.stallPhase==="gave_up"?f:e?o`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice||"אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live"}</span></div></div>`:o`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy?"מכין ניגון…":"לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר"}</span>${this.busy?f:o`<sw-button variant="primary" size="sm" icon="play" @click=${()=>this.startAt(b(this.date,this.cursor,this.tz))}>נגן מ־${z(this.cursor)}</sw-button>`}</div></div>`}
      <div class="tag"><sw-badge kind=${s?"recorded":"unknown"} ?onImage=${!!s}></sw-badge><span class="nm">${t.name}</span></div>
    </div>`}renderStall(){return this.stallPhase==="ok"?f:this.stallPhase==="gave_up"?o`<div class="stall" data-stall="gave_up" role="status"><div class="box"><span>הניגון נעצר</span><sw-button variant="primary" size="sm" icon="refresh" data-stall-retry ?disabled=${this.busy} @click=${()=>this.retryStalled()}>נסה שוב</sw-button></div></div>`:o`<div class="stall" data-stall=${this.stallPhase} role="status"><div class="box"><span class="spin" aria-hidden="true"></span><span>מתחבר מחדש</span></div></div>`}renderApi(){if(this.error&&!this.cams)return o`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.init()}></sw-state-panel>`;if(!this.cams)return o`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.cams.length)return o`<sw-state-panel icon="history" state="empty" heading="אין מצלמות" hint="סנכרן מצלמות מה־NVR או בקש הרשאת ניגון."></sw-state-panel>`;const t=this.cams.find(r=>r.id===this.cameraId)??this.cams[0],s=this.masterSession,e=this.live,i=s?.time_precision??"unknown",n=this.position??b(this.date,this.cursor,this.tz),a=this.tileStatus[this.cameraId]??"";return o`
      <div class="filters">
        ${this.rec?o`<sw-chip icon="history">${this.rec.segments.length} מקטעים · ${this.rec.matches} קבצים</sw-chip>`:f}
        ${this.dayEvents.length?o`<sw-chip icon="bell" @click=${()=>I("/investigate/events",{camera:this.cameraId,date:this.date})}>${this.dayEvents.length} אירועים${this.dayEvents.every(r=>r.confidence==="inferred")?" (מהקלטות)":""}</sw-chip>`:f}
        ${this.bookmarks.length?o`<sw-chip icon="case" data-bookmarks-count title="סימניות מתיקי חקירה על ציר הזמן · Alt+לחיצה על הציר מוסיפה סימנייה">${this.bookmarks.length} סימניות</sw-chip>`:o`<span class="session" data-bookmarks-hint>אין עדיין סימניות · "הוסף לתיק" מסמן את הרגע הנוכחי, או Alt+לחיצה על הציר מסמנת נקודה אחרת</span>`}
        ${this.activeBookmark?o`<sw-chip selected icon="case" data-bookmark-active @click=${()=>I(`/investigate/cases/${this.activeBookmark.case_id}`)}>תיק „${this.activeBookmark.case_title}”${this.activeBookmark.note?` · ${this.activeBookmark.note}`:""} · ${B[this.activeBookmark.preservation]} · פתח</sw-chip>`:f}
        ${this.rec?.coverage==="partial"?o`<span class="warn">כיסוי חלקי: ${this.rec.note}</span>`:f}
        ${this.loadingRec?o`<span class="session">מחפש הקלטות…</span>`:f}
        ${this.notice?o`<span class="warn">${this.notice}</span>`:f}
        ${this.error?o`<span class="err">${this.error}</span>`:f}
        <span class="grow"></span>
        <sw-button size="sm" icon="case" data-add-to-case title="סימנייה בנקודה הנוכחית · Alt+לחיצה על הציר מסמנת נקודה אחרת" ?disabled=${!this.cameraId} @click=${()=>this.casePick={kind:"clip",camera_id:this.cameraId,...U(b(this.date,this.cursor,this.tz))}}>הוסף לתיק</sw-button>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${()=>this.openExport()}>ייצוא</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">במפה</sw-button></a>
      </div>
      <div class="compare" data-compare data-picker=${this.tabsMode.ddPicker}>
        ${this.tabsMode.ddPicker==="chips"?this.renderCompareChips():o`<sw-dropdown multiple camera-picker data-compare-pick label="השוואה" icon="grid" placeholder="השוואה (עד 4)" max="3" count-base="1" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
              .items=${this.compareItems()} .values=${this.extra} @change=${r=>void this.applyExtra(r.detail.ids??[])}></sw-dropdown>`}
      </div>
      <div class="stage" data-stall-phase=${this.stallPhase} data-stall-attempts=${this.stall.attempts} data-stall-resumes=${this.stall.resumes}>
        ${this.renderStage(t)}
        ${this.renderStall()}
        <span class="stamp">${this.date} ${this.fmt(n)} · ${{verified:"מאומת",keyframe_limited:"דיוק לפי keyframe",estimated:"משוער",unknown:"—"}[i]}${!this.groupMode&&this.speed!==1?o` · <span data-speed-active=${this.speed}>${this.speed}× הילוך איטי</span>`:f}${this.paused&&!this.groupMode?o` · <span data-paused>מושהה · צעד־פריים</span>`:f}${this.groupMode?o` · <span data-sync-quality=${this.syncStats?.quality??"waiting"} data-sync-p95=${this.syncStats?.p95??""} data-sync-samples=${this.syncStats?.samples??0}>${this.syncLabel()}</span>`:""}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused?"play":"pause"} label=${this.paused?"המשך":"השהה"} data-pause ?disabled=${!e||a!=="playing"} @click=${()=>this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה" ?disabled=${!e||this.busy} @click=${()=>this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה" ?disabled=${!e||this.busy} @click=${()=>this.nudge(10)}></sw-button>
          <span class="sep"></span>
          ${[.25,.5,1,2,4].map(r=>{const l=(s?.capabilities.supported_speeds??[1]).includes(r),u=this.masterPlayer()?.transport==="mse",d=r===1||!this.groupMode&&l&&(r>1||u),m=d?r<1?"הילוך איטי: המאגר מתמלא בזמן אמת ונצרך לאט יותר — זמן המקור נשאר מדויק":"":this.groupMode?"בסנכרון רב־מצלמות נתמך רק 1×":r>1?"לא נתמך במסלול הזה: הזרם מגיע מה־NVR בזמן אמת; מהירות מוגברת דורשת מקור ששולח מהר מזמן אמת":"הילוך איטי זמין רק בנתיב MSE";return o`<button class="q ${this.speed===r?"on":""}" data-speed=${r} ?disabled=${!d} title=${m} @click=${()=>this.setSpeed(r)}>${r}×</button>`})}
          <span class="sep"></span>
          <button class="q" data-frame-step="-1" ?disabled=${!e||this.groupMode||!this.paused} title=${this.groupMode?"צעד־פריים זמין במצלמה בודדת":this.paused?"פריים אחד אחורה (בתוך המאגר)":"צעד־פריים זמין בהשהיה"} @click=${()=>this.stepFrame(-1)}>‹ פריים</button>
          <button class="q" data-frame-step="1" ?disabled=${!e||this.groupMode||!this.paused} title=${this.groupMode?"צעד־פריים זמין במצלמה בודדת":this.paused?"פריים אחד קדימה (בתוך המאגר)":"צעד־פריים זמין בהשהיה"} @click=${()=>this.stepFrame(1)}>פריים ‹</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא" ?disabled=${!e} @click=${()=>this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <div class="tlwrap">
        <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .bookmarks=${this.bookmarkMarkers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${i} @seek=${this.onSeek} @bookmark-click=${r=>this.activeBookmark=this.bookmarks.find(l=>l.id===r.detail.id)??null} @scrub=${this.onScrub} @hover=${this.onTlHover} @hover-end=${this.onTlHoverEnd}></sw-timeline>
        ${this.preview?o`<div class="tlpreview" data-tl-preview style="left:${Math.max(104,Math.min(this.preview.width-104,this.preview.x))}px">
              ${this.preview.frame.none?o`<div class="none">אין הקלטה בזמן זה</div>`:this.preview.frame.url?o`<img src=${this.preview.frame.url} alt="" class=${this.preview.frame.loading?"stale":""} />`:o`<div class="none">${this.preview.frame.loading?"טוען תמונה…":"אין פריים בזמן זה"}</div>`}
              <span>${C(this.preview.minute)}</span>
            </div>`:f}
      </div>
      <sw-case-picker .item=${this.casePick} subheading=${`${this.cams?.find(r=>r.id===this.cameraId)?.name??""} · ${this.date} ${C(this.cursor)}`} @added=${()=>void this.loadBookmarks()} @close=${()=>this.casePick=null}></sw-case-picker>
      ${O("diagnostics")?o`<div class="session" data-playback-diagnostics>
        <span>Session: ${s?`${s.id} · דור ${this.groupMode?this.group?.generation??s.generation:s.generation} · ${s.state}`:"אין"}</span>
        <span>נגן: ${a||"—"}${this.paused?" (מושהה)":""}</span>
        <span data-stall-diag>חיבור מחדש: ${this.stall.attempts}/${this.stall.options.maxAttempts} · הצליחו ${this.stall.resumes}</span>
        <span>אזור זמן: <span class="ltr">${this.tz}</span></span>
        <span>כיסוי: ${this.rec?this.rec.coverage==="complete"?"מלא":this.rec.coverage==="partial"?"חלקי":"לא ידוע":"—"}</span>
        ${s?o`<span>סוף הטווח: ${this.fmt(new Date(s.playback_end_at))}</span>`:f}
        ${this.groupMode?o`<span data-sync-method>סנכרון: שעון־אב אחד לכל האריחים (חסם פתיחה, ואז חציון זמני הפריימים המוצגים; מתחת לשלושה אריחים — המוביל); הסטייה של כל אריח נמדדת מול השעון, p95 על החלון האחרון; אריח מאחר מסונכרן לבד ואינו מזיז את האחרים (best effort, ללא עוגן זמן מאומת); מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה", לא כמסונכרן</span>`:f}
      </div>`:f}
      ${this.renderExportDialog()}
    `}seekDemo(t){this.cursor=t.detail.minute,this.generation+=1}renderDemo(){const t=S.find(i=>i.id===this.demoCamera)??S[0],s=!N.some(i=>this.cursor>=i.startMin&&this.cursor<=i.endMin),e=gt.filter(i=>i.minuteOfDay<1440).filter(i=>this.filter==="all"||i.type===this.filter).map(i=>({minute:i.minuteOfDay,kind:i.type,label:i.title}));return o`
      <div class="video ${s?"gap":""}">
        ${s?o`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`:o`<sw-scene kind=${wt[t.id]??"lobby"}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>`}
        <div class="tag"><sw-badge kind=${s?"unknown":"recorded"} ?onImage=${!s}></sw-badge><span class="nm">${t.name}</span></div>
        <span class="stamp">2026-09-14 ${P(this.cursor)}:00 · actual: ${s?"—":P(this.cursor)}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה":"נגן"} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
          <span class="sep"></span>
          ${[1,2,4].map(i=>o`<button class="q ${this.speed===i?"on":""}" @click=${()=>this.speed=i}>${i}×</button>`)}
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="aperture" label="צילום מהקלטה"></sw-button>
          <button class="q on">1080p</button>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${N} .events=${e} .cursor=${this.cursor} precision="estimated" @seek=${this.seekDemo}></sw-timeline>
      <div class="filters">
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"}>הכל</sw-chip>
        <sw-chip dot="var(--sw-tl-motion)" ?selected=${this.filter==="motion"} @click=${()=>this.filter="motion"}>תנועה</sw-chip>
        <sw-chip dot="var(--sw-tl-person)" ?selected=${this.filter==="person"} @click=${()=>this.filter="person"}>אדם</sw-chip>
        <sw-chip dot="var(--sw-tl-vehicle)" ?selected=${this.filter==="vehicle"} @click=${()=>this.filter="vehicle"}>רכב</sw-chip>
        <sw-chip dot="var(--sw-tl-door)" ?selected=${this.filter==="door"} @click=${()=>this.filter="door"}>דלת</sw-chip>
        <span class="grow"></span>
        <sw-button size="sm" icon="case">הוסף לתיק</sw-button>
        <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה בזמן הזה</sw-button></a>
      </div>
      ${O("diagnostics")?o`<div class="session" data-playback-diagnostics>
        <span>Session: ${this.playing?"playing":"paused"} · ${this.speed}×</span>
        <span>דור ${this.generation}</span>
        <span>דיוק זמן: משוער</span>
        <span>כיסוי: ${s?"פער":"מלא"} · 6 מקטעים ביום</span>
        <span>WebRTC → MSE</span>
        ${s?f:o`<span>מצלמה: ${t.name}</span>`}
      </div>`:f}
    `}render(){const t=_(),s=t?this.cams?.find(r=>r.id===this.cameraId):S.find(r=>r.id===this.demoCamera)??S[0],e=s?.name??"הקלטות",i=t?`${this.date} ${z(this.cursor)} · אזור זמן ${this.tz}`:`14.09.2026 ${P(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה`,n=t?"הקלטות":`הקלטות | ${s?.floor??""}`,a=t?T(new Date,this.tz):"2026-09-14";return o`
      <sw-page heading=${e} subheading=${i} crumbs=${n} wide>
        ${this.fromMap?o`<sw-button slot="actions" size="sm" variant="ghost" icon="map" data-back-to-map @click=${()=>history.back()}>חזרה למפה</sw-button>`:f}
        <div slot="actions" class="pick">
          ${t?o`<sw-field><select aria-label="מצלמה" @change=${r=>this.selectCamera(r.target.value)}>${(this.cams??[]).map(r=>o`<option value=${r.id} ?selected=${r.id===this.cameraId}>${q(r)}</option>`)}</select></sw-field>`:o`<sw-field><select aria-label="מצלמה" @change=${r=>this.demoCamera=r.target.value}>${S.map(r=>o`<option value=${r.id} ?selected=${r.id===this.demoCamera}>${r.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" lang=${A()} .value=${t?this.date:"2026-09-14"} max=${a} data-ltr aria-label="תאריך" @change=${r=>t&&this.setDate(r.target.value)} /></sw-field>
          <sw-recorded-month data-recorded-month .value=${t?this.date:"2026-09-14"} .today=${a} .loader=${t?this.monthLoader:Jt} ?disabled=${t&&!this.cameraId} @pick=${r=>t&&void this.setDate(r.detail.date)}></sw-recorded-month>
          <sw-field style="inline-size:132px"><input type="time" lang=${A()} step="1" .value=${t?z(this.cursor):P(this.cursor)} data-ltr aria-label="שעה" @change=${r=>{const l=r.target.value;if(t)this.onSeek(new CustomEvent("seek",{detail:{minute:L(l)}}));else{const[u,d]=l.split(":").map(Number);this.cursor=u*60+d,this.generation+=1}}} /></sw-field>
        </div>
        ${t?f:o`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>`}
        ${t?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};h.styles=[Y`
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
      max-block-size: max(200px, calc(100dvh - 560px));
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
      font-weight: 400;
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
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
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
  `,vt,Dt];p([k()],h.prototype,"cameraId",2);p([k()],h.prototype,"at",2);p([k()],h.prototype,"extraParam",2);p([k({type:Boolean})],h.prototype,"fromMap",2);p([c()],h.prototype,"demoCamera",2);p([c()],h.prototype,"cursor",2);p([c()],h.prototype,"generation",2);p([c()],h.prototype,"playing",2);p([c()],h.prototype,"speed",2);p([c()],h.prototype,"filter",2);p([c()],h.prototype,"cams",2);p([c()],h.prototype,"crossSync",2);p([c()],h.prototype,"tz",2);p([c()],h.prototype,"date",2);p([c()],h.prototype,"rec",2);p([c()],h.prototype,"dayEvents",2);p([c()],h.prototype,"bookmarks",2);p([c()],h.prototype,"activeBookmark",2);p([c()],h.prototype,"loadingRec",2);p([c()],h.prototype,"session",2);p([c()],h.prototype,"group",2);p([c()],h.prototype,"extra",2);p([c()],h.prototype,"casePick",2);p([c()],h.prototype,"preview",2);p([c()],h.prototype,"busy",2);p([c()],h.prototype,"error",2);p([c()],h.prototype,"notice",2);p([c()],h.prototype,"tileStatus",2);p([c()],h.prototype,"drifts",2);p([c()],h.prototype,"clock",2);p([c()],h.prototype,"barrier",2);p([c()],h.prototype,"syncStats",2);p([c()],h.prototype,"paused",2);p([c()],h.prototype,"scrubbing",2);p([c()],h.prototype,"position",2);p([c()],h.prototype,"exportOpen",2);p([c()],h.prototype,"exportFrom",2);p([c()],h.prototype,"exportTo",2);p([c()],h.prototype,"estimate",2);p([c()],h.prototype,"exportJob",2);p([c()],h.prototype,"exportBusy",2);p([c()],h.prototype,"exportError",2);p([c()],h.prototype,"stallPhase",2);h=p([tt("investigate-playback")],h);export{h as InvestigatePlayback};
//# sourceMappingURL=investigate-playback-BIkdUwOG.js.map
