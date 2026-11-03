import{a as u,ac as x,aA as g,ar as b,i as w,M as k,n as y,pB as $,J as z,pI as S,A as p,e as c,pE as T,O as _,d$ as I,d_ as L,qn as P,E as A,G as d,H as E}from"./index-TwIAG38v.js";import{i as N}from"./wall-arrangement-KbnHMV58.js";import"./sw-logo-art-Va6y_cIM.js";var M=Object.defineProperty,O=Object.getOwnPropertyDescriptor,l=(e,s,a,i)=>{for(var r=i>1?void 0:i?O(s,a):s,o=e.length-1,t;o>=0;o--)(t=e[o])&&(r=(i?t(s,a,r):t(r))||r);return i&&r&&M(s,a,r),r};const v="sw.kiosk.layout",D=[[2,2],[3,2],[3,3],[4,3],[4,4],[5,4],[6,4]],H=[[1,1],[1,2],[1,3],[1,4],[2,2],[2,3]],C={cols:1,rows:3},U=10*6e4;function f(e){try{const i=localStorage.getItem(v);if(i){const[r,o]=i.split("x").map(Number);if(r>=1&&o>=1)return{cols:r,rows:o}}}catch{}if(P())return{...C};const s=Number(e?.["ui.kiosk_cols"]??0),a=Number(e?.["ui.kiosk_rows"]??0);return{cols:s>=1?s:3,rows:a>=1?a:2}}function m(e=f()){const s=g().params,a=Math.min(6,Math.max(1,Number(s.get("cols")??e.cols)||e.cols)),i=Math.min(5,Math.max(1,Number(s.get("rows")??e.rows)||e.rows));return{cameras:(s.get("cameras")??"").split(",").map(r=>r.trim()).filter(Boolean),cols:a,rows:i,rotate:Math.max(0,Number(s.get("rotate")??0)||0)}}let n=class extends u{constructor(){super(...arguments),this.phone=new x(this),this.cams=null,this.settings=null,this.clock={time:"",date:""},this.touchedAt=Date.now(),this.onTouch=()=>{this.touchedAt=Date.now(),this.removeAttribute("data-idle")},this.page=0,this.health=null,this.disconnected=!1,this.view=m(),this.failures=0,this.onHash=()=>{this.view=m(),this.page=this.restorePage(),this.startRotation()},this.started=0,this.staggerTimer=0}setLayout(e){const[s,a]=e.split("x").map(Number);if(!(s>=1&&a>=1))return;try{localStorage.setItem(v,`${s}x${a}`)}catch{}const i=new URLSearchParams(g().params);i.set("cols",String(s)),i.set("rows",String(a)),window.location.replace(`#/kiosk/all?${i.toString()}`)}get pageKey(){return`sw.kiosk.page:${this.view.cameras.join(",")}|${this.view.cols}x${this.view.rows}`}restorePage(){try{const e=Number(localStorage.getItem(this.pageKey)??"0");return Number.isFinite(e)&&e>=0?e:0}catch{return 0}}setPage(e){this.page=e;try{localStorage.setItem(this.pageKey,String(e%Math.max(1,this.pages)))}catch{}}connectedCallback(){super.connectedCallback(),this.page=this.restorePage(),this.tick(),this.timer=window.setInterval(()=>this.tick(),1e3),this.unsubscribe=b(e=>{e.mode==="api"&&this.cams===null?this.load():e.mode!=="loading"&&this.requestUpdate()}),window.addEventListener("hashchange",this.onHash),this.addEventListener("pointerdown",this.onTouch),this.startRotation(),this.pollHealth(),this.healthTimer=window.setInterval(()=>void this.pollHealth(),15e3)}disconnectedCallback(){window.clearTimeout(this.staggerTimer),super.disconnectedCallback(),window.clearInterval(this.timer),window.clearInterval(this.rotateTimer),window.clearInterval(this.healthTimer),window.removeEventListener("hashchange",this.onHash),this.removeEventListener("pointerdown",this.onTouch),this.unsubscribe?.()}startRotation(){window.clearInterval(this.rotateTimer),this.view.rotate>0&&(this.rotateTimer=window.setInterval(()=>{this.setPage(this.page+1),this.stagger()},this.view.rotate*1e3)),this.stagger()}async pollHealth(){if(w())try{this.health=await k(),(this.disconnected||this.failures>=3)&&this.load(),this.failures=0,this.disconnected=!1}catch{this.failures+=1,this.failures>=3&&(this.disconnected=!0)}}layoutChoices(){const e=this.phone.matches?H:D;return e.some(([s,a])=>s===this.view.cols&&a===this.view.rows)?e:[[this.view.cols,this.view.rows],...e]}get pageSize(){return this.view.cols*this.view.rows}stagger(){window.clearTimeout(this.staggerTimer),this.started=0;const e=()=>{this.started<this.pageSize&&(this.started+=1,this.staggerTimer=window.setTimeout(e,400))};e()}get selected(){const e=(this.cams??[]).filter(s=>this.view.cameras.length===0?N(s):this.view.cameras.includes(s.id));return this.view.cameras.length?this.view.cameras.map(s=>e.find(a=>a.id===s)).filter(s=>!!s):e}get pages(){return Math.max(1,Math.ceil(this.selected.length/this.pageSize))}tick(){const e=new Date;this.clock={time:y(e),date:e.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})},Date.now()-this.touchedAt>=U&&this.setAttribute("data-idle","")}async load(){if(w())try{const[e,s]=await Promise.all([$(),z()]);this.cams=e.cameras.filter(a=>a.enabled&&a.recorder_enabled!==!1),this.settings=s,this.view=m(f(s))}catch{this.cams=[]}}render(){const e=w(),s=this.page%this.pages,a=e?this.selected.slice(s*this.pageSize,(s+1)*this.pageSize):[],i=S.filter(t=>t.state!=="forbidden").slice(0,9),r=e?a.filter(t=>t.status==="online").length:7,o=this.settings?.["media.max_live_sessions"]??16;return c`
      <header>
        <sw-brand kind="product" scheme="dark" .h=${24} data-kiosk-product-logo></sw-brand>
        <h1>ניטור חי</h1>
        <sw-brand kind="company" scheme="dark" .h=${24} .maxw=${120} data-kiosk-company-logo></sw-brand>
        <span class="spacer"></span>
        <sw-badge kind="live" label=${`${e?this.selected.length:i.length} מצלמות · ${r} חיות`}></sw-badge>
        ${e&&this.pages>1?c`<span class="pill" data-kiosk-page>עמוד ${s+1}/${this.pages}${this.view.rotate?` · כל ${this.view.rotate} שנ׳`:""}</span>`:p}
        ${e?c`<select class="layout" data-kiosk-layout aria-label="פריסה" @change=${t=>this.setLayout(t.target.value)}>
          ${this.layoutChoices().map(([t,h])=>c`<option value=${`${t}x${h}`} ?selected=${t===this.view.cols&&h===this.view.rows}>${t}×${h} · ${t*h} מצלמות בעמוד</option>`)}
        </select>`:p}
        ${e&&this.health?c`<span class="pill" data-kiosk-health data-status=${this.health.status}>מערכת: ${T[this.health.status]}${this.health.items.filter(t=>t.status!=="ok").length?` · ${this.health.items.filter(t=>t.status!=="ok").map(t=>t.label).join(", ")}`:""}</span>`:p}
        <span class="clock" data-kiosk-clock><b>${this.clock.time||"—"}</b><span>${this.clock.date}</span></span>
        <a class="exit" href="#/live/wall" data-kiosk-exit title="חזרה למערכת (משתמש קיוסק בלבד נשאר כאן)">יציאה</a>
      </header>
      ${this.disconnected?c`<div class="overlay" data-kiosk-disconnected><span class="mark"><sw-icon name="warning" size=${28}></sw-icon></span><b>אין קשר לשרת Arx</b><span>הזרמים אינם חיים · מנסה להתחבר מחדש</span></div>`:p}
      <div class="grid" style=${`--cols:${e?this.view.cols:3}`}>
        ${e?a.map((t,h)=>c`<div class="cell"><sw-camera-tile dark data-kiosk-tile name=${t.name} state=${this.disconnected?"unknown":t.status==="online"?"live":t.status==="offline"?"offline":"unknown"} ?live=${!this.disconnected&&t.status!=="offline"&&t.live_kind!=="still"&&h<o&&h<this.started} .stillRefresh=${t.live_kind==="still"&&t.status!=="offline"?t.still_refresh_s??10:0} cameraId=${t.id} profile="sub" transport=${_(this.settings)} poster=${t.status==="offline"?"":I(t.id)} noDemo></sw-camera-tile></div>`):i.map(t=>c`<div class="cell"><sw-camera-tile dark name=${t.name} state=${t.state} scene=${L[t.id]??"lobby"} noDemo></sw-camera-tile></div>`)}
      </div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${16}></sw-icon></div><div><b>${e?`${r}/${a.length}`:"7/9"}</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic red"><sw-icon name="warning" size=${16}></sw-icon></div><div><b>${e?a.filter(t=>t.status==="offline").length:3}</b><span>${e?"מצלמות מנותקות":"התראות פתוחות"}</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${16}></sw-icon></div><div><b>${e?Math.min(a.length,o):2}</b><span>${e?"זרמים חיים במקביל":"מבנים"}</span></div></div>
        <div class="stat"><div class="ic green"><sw-icon name="check" size=${16}></sw-icon></div><div><b data-word>${e?"פעיל":"חלקי"}</b><span>${e?"go2rtc + NVR":"מצב מערכת · גשר לא רענן"}</span></div></div>
      </div>
    `}};n.styles=A`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      background: var(--sw-video-bg);
      color: var(--sw-on-video);
      padding-block: max(14px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-bottom, 0px));
      padding-inline: max(20px, env(safe-area-inset-right, 0px)) max(20px, env(safe-area-inset-left, 0px));
      gap: 12px;
      --k-wash: var(--sw-video-hover);
      --k-line: var(--sw-video-line);
    }
    header,
    .stats {
      transition: opacity 3s ease;
    }
    :host([data-idle]) header,
    :host([data-idle]) .stats {
      opacity: 0.7;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 48px;
    }
    header sw-brand[kind='product'] {
      opacity: 0.9; /* NOTICEPUSH-295: the approved mockup mark (sw-brand draws it inline, 24 px), as before the mint PNG it replaces */
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .spacer {
      flex: 1;
    }
    .clock {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    .clock b {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: 0.02em;
    }
    .clock span {
      font-size: var(--sw-fs-sm);
      color: var(--sw-on-video-2);
      direction: rtl;
    }
    .overlay {
      position: fixed;
      inset: 0;
      display: grid;
      place-content: center;
      gap: 8px;
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      z-index: var(--sw-z-modal);
      text-align: center;
      animation: k-in 0.6s var(--sw-ease) both;
    }
    .overlay b {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
    }
    .overlay span {
      font-size: var(--sw-fs-lg);
      color: var(--sw-on-video-2);
    }
    .overlay .mark {
      inline-size: 56px;
      block-size: 56px;
      margin: 0 auto 8px;
      display: grid;
      place-content: center;
      border-radius: 50%;
      background: color-mix(in srgb, var(--sw-danger) 24%, transparent);
      color: var(--sw-danger);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      padding: 0 14px;
      border-radius: var(--sw-r-pill);
      background: var(--k-wash);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      animation: k-rise 0.4s var(--sw-ease) both;
    }
    .pill::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
      flex: none;
    }
    .pill[data-status='warn'] {
      background: color-mix(in srgb, var(--sw-warning) 24%, transparent);
    }
    .pill[data-status='warn']::before {
      background: var(--sw-warning);
    }
    .pill[data-status='error'] {
      background: color-mix(in srgb, var(--sw-danger) 28%, transparent);
    }
    .pill[data-status='error']::before {
      background: var(--sw-danger);
      animation: k-breathe 2.4s ease-in-out infinite;
    }
    .pill[data-kiosk-page]::before {
      display: none;
    }
    header select.layout {
      min-block-size: 44px;
      background: var(--k-wash);
      color: var(--sw-on-video);
      border: 1px solid var(--k-line);
      border-radius: var(--sw-r-md);
      padding: 0 12px;
      font: inherit;
      font-size: var(--sw-fs-md);
      cursor: pointer;
    }
    header select.layout option {
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    header a.exit {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      min-inline-size: 44px;
      padding-inline: 16px;
      color: var(--sw-on-video);
      text-decoration: none;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      border: 1px solid var(--k-line);
      border-radius: var(--sw-r-md);
      transition: background-color var(--sw-t-fast) ease;
    }
    header a.exit:hover {
      background: var(--k-wash);
    }
    .grid {
      flex: 1;
      min-block-size: 0;
      display: grid;
      grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      gap: 10px;
    }
    /* a cell centres its 16:9 picture (container units): a page of three rows fits the tablet's height with the counters under
       it instead of pushing them off the screen; where the units are missing the picture fills the cell's width as before */
    .cell {
      display: grid;
      place-items: center;
      min-block-size: 0;
      min-inline-size: 0;
      container-type: size;
    }
    .grid sw-camera-tile {
      inline-size: 100%;
      inline-size: min(100%, calc(100cqh * 16 / 9));
      border-radius: var(--sw-r-md);
      animation: k-in 0.6s var(--sw-ease) both;
    }
    /* a portrait tablet cannot fill its height with 16:9 pictures: the rows pack from the top and the counters follow them */
    @media (orientation: portrait) and (min-width: 768px) {
      .grid {
        flex: none;
        align-content: start;
        grid-auto-rows: max-content;
      }
      .cell {
        container-type: normal;
      }
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .stat {
      background: var(--k-wash);
      border: 1px solid var(--k-line);
      border-radius: var(--sw-r-lg);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      min-inline-size: 0;
    }
    .stat .ic {
      display: grid;
      place-items: center;
      flex: none;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--sw-recorded) 24%, transparent);
      color: var(--sw-recorded);
    }
    .stat .ic.red {
      background: color-mix(in srgb, var(--sw-danger) 22%, transparent);
      color: var(--sw-danger);
    }
    .stat .ic.green {
      background: color-mix(in srgb, var(--sw-live) 22%, transparent);
      color: var(--sw-live);
    }
    .stat > div:last-child {
      min-inline-size: 0;
    }
    .stat b {
      display: block;
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .stat b[data-word] {
      font-size: var(--sw-fs-xl);
    }
    .stat span {
      display: block;
      color: var(--sw-on-video-2);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @keyframes k-in {
      from {
        opacity: 0;
      }
    }
    @keyframes k-rise {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }
    @keyframes k-breathe {
      50% {
        opacity: 0.45;
      }
    }
    /* the reference tablets (820 x 1280, 1280 x 800): the counters stay four across in landscape and become two rows in portrait */
    @media (max-width: 1023px) {
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    /* the phone (mobile audit 2026-09-30): the header wraps instead of running off the screen, the tiles keep their own 16:9
       height and pack from the top (no dead space between rows), the summary tiles become one scrolling row, the targets
       are 44 px and the page keeps clear of the device's safe areas */
    @media (max-width: 767px) {
      :host {
        padding-block: max(10px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-bottom, 0px));
        padding-inline: max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-left, 0px));
        gap: 10px;
      }
      header {
        flex-wrap: wrap;
        row-gap: 8px;
      }
      h1 {
        font-size: var(--sw-fs-xl);
      }
      header select.layout {
        flex: 1 1 150px;
        min-inline-size: 0;
      }
      .clock {
        order: 10;
        flex: 1 1 100%;
        flex-direction: row;
        justify-content: center;
        gap: 10px;
        align-items: baseline;
      }
      .clock b {
        font-size: var(--sw-fs-2xl);
      }
      .grid {
        flex: none;
        align-content: start;
        grid-auto-rows: max-content;
      }
      .cell {
        container-type: normal;
      }
      .stats {
        display: flex;
        overflow-x: auto;
        gap: 8px;
        scrollbar-width: none;
        padding-block-end: 2px;
      }
      .stat {
        flex: 0 0 auto;
        min-inline-size: 150px;
        padding: 8px 12px;
        gap: 10px;
      }
      .stat .ic {
        inline-size: 32px;
        block-size: 32px;
      }
      .stat b {
        font-size: var(--sw-fs-xl);
      }
      .stat b[data-word] {
        font-size: var(--sw-fs-lg);
      }
    }
    /* R5-LIVE-297 (the HOMEFABLE type scale on the wall display, read from across the room): the title 800, the clock a 32 px / 800
       display numeral, the counters 34 px / 800 tight over a 14 px label; a counter that needs someone (open alerts) is a filled danger
       field, a healthy one keeps the quiet wash; the exit is a key that tints on hover only under a fine pointer and sinks on press */
    h1 {
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .clock b {
      font-size: var(--sw-fs-4xl);
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .stat {
      padding: 14px 18px;
      border-color: transparent;
    }
    .stat:has(.ic.red) {
      background: color-mix(in srgb, var(--sw-danger) 26%, var(--sw-video-bg));
    }
    .stat .ic {
      inline-size: 44px;
      block-size: 44px;
    }
    .stat .ic.red {
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .stat b {
      font-size: var(--sw-fs-4xl); /* the kiosk's display numeral, read at three metres */
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .stat b[data-word] {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
    }
    .stat span {
      font-size: var(--sw-fs-md);
    }
    header a.exit {
      font-weight: var(--sw-fw-semibold);
      background: var(--k-wash);
      -webkit-tap-highlight-color: transparent;
      transition: background-color var(--sw-t-fast) ease, transform var(--sw-t-press) var(--sw-ease-out);
    }
    header a.exit:hover {
      background: var(--k-wash);
    }
    @media (hover: hover) and (pointer: fine) {
      header a.exit:hover {
        background: color-mix(in srgb, var(--sw-on-video) 16%, transparent);
      }
    }
    header a.exit:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    @media (max-width: 767px) {
      .stat {
        padding: 8px 12px;
      }
      .stat .ic {
        inline-size: 34px;
        block-size: 34px;
      }
      .stat b {
        font-size: var(--sw-fs-2xl);
      }
      .stat b[data-word] {
        font-size: var(--sw-fs-lg);
      }
      .clock b {
        font-size: var(--sw-fs-2xl);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none !important;
        transition: none !important;
      }
    }
  `;l([d()],n.prototype,"cams",2);l([d()],n.prototype,"settings",2);l([d()],n.prototype,"clock",2);l([d()],n.prototype,"page",2);l([d()],n.prototype,"health",2);l([d()],n.prototype,"disconnected",2);l([d()],n.prototype,"view",2);l([d()],n.prototype,"started",2);n=l([E("kiosk-wall")],n);export{n as KioskWall};
//# sourceMappingURL=kiosk-wall-LfeBMFMm.js.map
