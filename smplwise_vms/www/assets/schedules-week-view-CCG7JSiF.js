import{g,aw as c,i as y,A as f,cx as x,b as o,k as O,a0 as R,j as M}from"./index-eHtAZ44A.js";import{C as T,D as W,E as H}from"./schedules-logic-CkskFTUy.js";import{t as d}from"./automation-7s0Xw1Mv.js";import{T as A,U,e as I,D as P,V}from"./schedules-Bgc6NA68.js";import{s as X,C as Y,c as j,m as v}from"./schedule-create-dialog-DmcMSZ7w.js";var q=Object.defineProperty,G=Object.getOwnPropertyDescriptor,u=(r,e,s,n)=>{for(var t=n>1?void 0:n?G(e,s):e,a=r.length-1,i;a>=0;a--)(i=r[a])&&(t=(n?i(e,s,t):i(t))||t);return n&&t&&q(e,s,t),t};const N={light:"var(--sw-obj-light)",switch:"var(--sw-live)",climate:"var(--sw-accent)",cover:"var(--sw-circuit-6)",fan:"var(--sw-purple)",alarm:"var(--sw-danger)",lock:"var(--sw-danger)",door:"var(--sw-danger)",script:"var(--sw-circuit-2)",scene:"var(--sw-circuit-4)",helper:"var(--sw-live)",humidifier:"var(--sw-accent)",vacuum:"var(--sw-circuit-5)",siren:"var(--sw-danger)",media:"var(--sw-circuit-3)",number:"var(--sw-circuit-1)",select:"var(--sw-circuit-1)",off:"var(--sw-offline)",other:"var(--sw-unknown)"};function te(r){return N[r]}let m=class extends y{constructor(){super(...arguments),this.slots=[],this.sun=null,this.now=!0,this.nowMinutes=null,this.compact=!1}minutesNow(){if(this.nowMinutes!==null)return this.nowMinutes;const r=new Date;return r.getHours()*60+r.getMinutes()}render(){const r=T(this.slots,this.sun),e=this.minutesNow();return o`
      <div class="track" role="img" aria-label=${r.map(s=>s.title).join("; ")||x("ללא משבצות")}>
        ${r.map(s=>o`<i class=${s.point?"seg point":"seg"} style=${`left:${s.from}%;width:${Math.max(s.to-s.from,0)}%;--c:${N[s.tone]}`} title=${s.title} data-slot=${s.index}></i>`)}
        ${this.now?o`<i class="now" style=${`left:${e/1440*100}%`} data-now></i>`:f}
      </div>
      <div class="axis" aria-hidden="true">${[0,6,12,18,24].map(s=>o`<span style=${`left:${s/24*100}%`}>${String(s).padStart(2,"0")}</span>`)}</div>
    `}};m.styles=g`
    :host {
      display: block;
      direction: ltr;
      min-inline-size: 0;
    }
    .track {
      position: relative;
      block-size: 14px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    :host([compact]) .track {
      block-size: 10px;
    }
    .seg {
      position: absolute;
      inset-block: 0;
      background: var(--c);
      border-inline-end: 1px solid var(--sw-surface);
      box-sizing: border-box;
      min-inline-size: 2px;
    }
    .seg.point {
      inset-block: 2px;
      inline-size: 4px;
      min-inline-size: 4px;
      border: 0;
      border-radius: 2px;
    }
    .now {
      position: absolute;
      inset-block: -1px;
      inline-size: 2px;
      margin-inline-start: -1px;
      background: var(--sw-danger);
      border-radius: 1px;
    }
    .axis {
      position: relative;
      block-size: 14px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-2xs);
      line-height: 14px;
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    :host([compact]) .axis {
      display: none;
    }
    .axis span {
      position: absolute;
      transform: translateX(-50%);
    }
    .axis span:first-child {
      transform: none;
    }
    .axis span:last-child {
      transform: translateX(-100%);
    }
  `;u([c({attribute:!1})],m.prototype,"slots",2);u([c({attribute:!1})],m.prototype,"sun",2);u([c({type:Boolean})],m.prototype,"now",2);u([c({type:Number})],m.prototype,"nowMinutes",2);u([c({type:Boolean,reflect:!0})],m.prototype,"compact",2);m=u([O("sw-schedule-bar")],m);let k=class extends y{constructor(){super(...arguments),this.days={tokens:["daily"],kind:"daily",days:[]},this.compact=!1}render(){const r=W(this.days);return r?o`<span class="w" data-days-word>${r}</span>`:o`${H(this.days).map(e=>o`<span class=${e.on?"d on":"d"} data-day=${e.id} aria-label=${e.on?x("{day} פעיל",{day:e.short}):x("{day} לא פעיל",{day:e.short})}>${e.short}</span>`)}`}};k.styles=g`
    :host {
      display: inline-flex;
      gap: 3px;
      align-items: center;
    }
    .d {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      background: transparent;
      border: 1px solid var(--sw-border);
      box-sizing: border-box;
    }
    :host([compact]) .d {
      inline-size: 19px;
      block-size: 19px;
      font-size: var(--sw-fs-2xs);
    }
    .d.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .w {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
    }
  `;u([c({attribute:!1})],k.prototype,"days",2);u([c({type:Boolean,reflect:!0})],k.prototype,"compact",2);k=u([O("sw-day-chips")],k);let z=class extends y{constructor(){super(...arguments),this.conditions=null,this.compact=!1}render(){const r=this.conditions;if(!r||!r.items.length)return f;const e=r.summary??x("בתנאי");return o`<span class=${r.preset?"chip preset":"chip"} data-condition-chip=${r.preset??"custom"} title=${e}><sw-icon name=${r.preset?"calendar":"sensor"} size=${12}></sw-icon><span class="txt">${e}</span></span>`}};z.styles=g`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    :host([hidden]) {
      display: none;
    }
    span.chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    span.chip.preset {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    span.txt {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host([compact]) span.chip {
      padding: 1px 7px;
    }
  `;u([c({attribute:!1})],z.prototype,"conditions",2);u([c({type:Boolean,reflect:!0})],z.prototype,"compact",2);z=u([O("schedule-condition-chip")],z);let C=class extends y{constructor(){super(...arguments),this.sensitive=!1,this.lowering=!1}render(){return o`${this.sensitive?o`<span class="m sens" data-marker="sensitive"><sw-icon name="shield" size=${12}></sw-icon>${x("רגיש")}</span>`:f}${this.lowering?o`<span class="m" data-marker="lowering"><sw-icon name="unlock" size=${12}></sw-icon>${x("פותח / מנטרל")}</span>`:f}`}};C.styles=g`
    :host {
      display: inline-flex;
      gap: 5px;
      flex-wrap: wrap;
    }
    span.m {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    span.m.sens {
      background: var(--sw-stale-soft);
      color: var(--sw-warning-text);
    }
  `;u([c({type:Boolean})],C.prototype,"sensitive",2);u([c({type:Boolean})],C.prototype,"lowering",2);C=u([O("sw-schedule-markers")],C);var F=Object.defineProperty,b=(r,e,s,n)=>{for(var t=void 0,a=r.length-1,i;a>=0;a--)(i=r[a])&&(t=i(e,s,t)||t);return t&&F(e,s,t),t};class h extends y{constructor(){super(...arguments),this.open=!1,this.summary={entities:[],kinds:[],times:"",sensitive:!0,lowering:!0},this.needsCode=!1,this.busy=!1,this.error="",this.confirmLabel=d("שמירה"),this.ack=!1,this.code=""}static{this.styles=g`
    :host {
      display: contents;
    }
    .warn {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
    .warn.soft {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .warn sw-icon {
      flex: none;
      margin-block-start: 2px;
    }
    label.ack {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: var(--sw-fs-md);
      cursor: pointer;
    }
    label.ack sw-toggle {
      flex: none;
    }
    .code {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .code label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .code input {
      min-block-size: 34px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      font: inherit;
      direction: ltr;
      text-align: start;
      letter-spacing: 0.2em;
    }
    .code input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .code small {
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `}willUpdate(e){e.has("open")&&this.open&&(this.ack=!1,this.code="")}close(){this.busy||this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}confirm(){!this.ack||this.busy||this.needsCode&&!this.code.trim()||this.dispatchEvent(new CustomEvent("confirm",{detail:{alarm_code:this.needsCode?this.code.trim():null},bubbles:!0,composed:!0}))}sentence(){const e=this.summary;if(e.text)return e.text;const s=e.entities.join(", "),n=Array.isArray(e.times)?e.times.join(", "):e.times??"",t=e.kinds??[];if(e.lowering!==!1){const a=t.length===1?t[0]==="מנטרל"?d("ינטרל"):t[0]==="פותח נעילה"?d("יפתח את נעילת"):d("יפתח"):d("יפתח / ינטרל");return d("התזמון {verb} {who}{when} גם כשאיש אינו נמצא במקום.",{verb:a,who:s,when:n?` ${d("ב־{times}",{times:n})}`:""})}return d("התזמון כולל פעולה רגישה (אזעקה, מנעול, דלת או שער){when} והוא יפעל גם כשאיש אינו נמצא במקום.",{when:n?` ${d("ב־{times}",{times:n})}`:""})}render(){const e=this.summary.lowering!==!1,s=e?d("אני מבין שהפעולה תתבצע אוטומטית, ומאשר."):d("אני מאשר את הפעולה הרגישה.");return o`<sw-dialog ?open=${this.open} heading=${e?d("תזמון שפותח או מנטרל"):d("תזמון של פעולה רגישה")} data-lowering-dialog @close=${this.close}>
      <div class="warn ${e?"":"soft"}" role="alert" data-lowering-warning><sw-icon name="warning" size="20"></sw-icon><div>${this.sentence()}</div></div>
      <label class="ack"><sw-toggle size="sm" labelHidden in-label label=${s} data-lowering-ack .checked=${this.ack} @change=${n=>this.ack=R(n)}></sw-toggle><span>${s}</span></label>
      ${this.needsCode?o`<div class="code"><label for="alarm-code">${d("קוד האזעקה")}</label><input id="alarm-code" type="password" inputmode="numeric" autocomplete="off" data-lowering-code .value=${this.code} @input=${n=>this.code=n.target.value} /><small>${d("הקוד נבדק פעם אחת ואינו נשמר בתזמון.")}</small></div>`:f}
      ${this.error?o`<div class="err" role="alert" data-lowering-error>${this.error}</div>`:f}
      <div slot="footer" style="display:contents">
        <sw-button data-lowering-cancel ?disabled=${this.busy} @click=${this.close}>${d("ביטול")}</sw-button>
        <sw-button variant="primary" data-lowering-ok ?disabled=${!this.ack||this.busy||this.needsCode&&!this.code.trim()} @click=${this.confirm}>${this.busy?d("שולח…"):this.confirmLabel}</sw-button>
      </div>
    </sw-dialog>`}}b([c({type:Boolean,reflect:!0})],h.prototype,"open");b([c({attribute:!1})],h.prototype,"summary");b([c({type:Boolean})],h.prototype,"needsCode");b([c({type:Boolean})],h.prototype,"busy");b([c()],h.prototype,"error");b([c()],h.prototype,"confirmLabel");b([M()],h.prototype,"ack");b([M()],h.prototype,"code");customElements.get("schedule-lowering-dialog")||customElements.define("schedule-lowering-dialog",h);var K=Object.defineProperty,S=(r,e,s,n)=>{for(var t=void 0,a=r.length-1,i;a>=0;a--)(i=r[a])&&(t=i(e,s,t)||t);return t&&K(e,s,t),t};class _ extends y{constructor(){super(...arguments),this.schedules=[],this.sun=null,this.snap=15,this.width=0,this.ro=null}static{this.styles=g`
    :host {
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      /* POLISH-CONTROL-297: the category colours follow the product's status tokens (a skin, a palette and the dark scheme change them);
         the two that have no status meaning keep a hue of their own */
      --sc-on: var(--sw-success);
      --sc-off: var(--sw-unknown);
      --sc-level: var(--sw-warning);
      --sc-climate: var(--sw-accent);
      --sc-cover: #0d9488;
      --sc-secure: var(--sw-purple);
      --sc-custom: var(--sw-text-2);
      --sc-empty: var(--sw-text-3);
      --label-w: 64px;
      /* the night, the grid lines and the sun lines are tints of the text colour, so they are seen on a dark board too */
      --sc-night: color-mix(in srgb, var(--sw-text) 5%, transparent);
      --sc-gridline: color-mix(in srgb, var(--sw-text) 9%, transparent);
    }
    .head {
      position: relative;
      block-size: 24px;
      margin-inline-end: var(--label-w);
    }
    .hour {
      position: absolute;
      inset-block-end: 2px;
      transform: translateX(-50%);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .hour:first-child {
      transform: none;
    }
    .rows {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr var(--label-w);
    }
    /* round 2: the day name one step larger and bold; the track is a tone step without a frame (taste-skill: no outlined boxes) */
    .lbl {
      direction: rtl;
      padding-inline-start: 10px;
      display: flex;
      align-items: center;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-text);
    }
    .row.today .lbl {
      color: var(--sw-accent-text);
    }
    .track {
      position: relative;
      background: color-mix(in srgb, var(--sw-text) 4%, transparent);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      min-block-size: 40px;
    }
    .row.today .track {
      background: color-mix(in srgb, var(--sw-accent) 6%, transparent);
    }
    .night {
      position: absolute;
      inset-block: 0;
      background: var(--sc-night);
    }
    .gl {
      position: absolute;
      inset-block: 0;
      inline-size: 1px;
      background: var(--sc-gridline);
    }
    .sunl {
      position: absolute;
      inset-block: 0;
      border-inline-start: 1px dashed color-mix(in srgb, var(--sw-warning) 70%, transparent);
    }
    .nowl {
      position: absolute;
      inset-block: 0;
      border-inline-start: 2px solid var(--sw-danger);
      z-index: 2;
    }
    /* the "now" line carries a small head, so it is told from a schedule's edge */
    .nowl::before {
      content: '';
      position: absolute;
      inset-block-start: -1px;
      inset-inline-start: -4px;
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    /* POLISH-CONTROL-297: the pill is one step taller and its text one step larger (it was the 10 px tier); it answers the press and the
       keyboard, hover is for fine pointers only (transform and shadow, token durations - zero under reduced motion) */
    .pill {
      --c: var(--sc-custom);
      position: absolute;
      block-size: 22px;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
      background: color-mix(in srgb, var(--c) 11%, var(--sw-surface));
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      direction: rtl;
      z-index: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .pill:active {
      transform: scale(0.97);
    }
    .pill:focus-visible {
      z-index: 3;
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (hover: hover) and (pointer: fine) {
      .pill:hover {
        z-index: 3;
        box-shadow: var(--sw-shadow-2);
      }
    }
    .pill.cond {
      border-style: dashed;
    }
    /* round 2 (impeccable detector: the 3 px side stripe was a slop tell): the category is a filled dot before the time */
    .pill::before {
      content: '';
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c);
      flex: none;
    }
    .pill b {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      font-weight: var(--sw-fw-bold);
    }
    .pill.c-on {
      --c: var(--sc-on);
    }
    .pill.c-off {
      --c: var(--sc-off);
    }
    .pill.c-level {
      --c: var(--sc-level);
    }
    .pill.c-climate {
      --c: var(--sc-climate);
    }
    .pill.c-cover {
      --c: var(--sc-cover);
    }
    .pill.c-secure {
      --c: var(--sc-secure);
    }
    .empty {
      padding: 28px 16px;
      text-align: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
      direction: rtl;
    }
  `}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(()=>{const e=this.renderRoot.querySelector(".track");e&&Math.abs(e.clientWidth-this.width)>2&&(this.width=e.clientWidth)})}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.ro=null}firstUpdated(){this.ro?.observe(this);const e=this.renderRoot.querySelector(".track");e&&(this.width=e.clientWidth)}pillsOf(e){const s=this.sun??A,n=[];for(const i of this.schedules){if(!i.enabled)continue;const w=i.days.days;if(!w||!w.includes(e))continue;const l=p=>i.entities.find($=>$.entity_id===p)?.class??null;i.slots.forEach((p,$)=>{const L=U(p.start,s),B=X({start:p.start.raw,stop:p.stop?.raw??null,actions:p.actions.map(E=>({service:E.service,entity_id:E.entity_id,data:E.data}))},l),D=p.actions[0]?I(p.actions[0]):"";n.push({id:i.id,key:`${i.id}:${$}`,at:L,text:i.display_name,title:`${j(L)} · ${i.display_name}${D?` · ${D}`:""} (${Y[B]})${i.conditions.items.length?` · ${d("בתנאי")}`:""}`,cat:B,cond:i.conditions.items.length>0})})}n.sort((i,w)=>i.at-w.at);const t=Math.max(this.width,300),a=[];return n.map(i=>{const w=Math.min(250,74+i.text.length*6.6),l=Math.max(0,Math.min(i.at/1440*t,t-w-2));let p=a.findIndex($=>$+4<=l);return p<0&&(p=a.length,a.push(0)),a[p]=l+w,{...i,lane:p,w,x:l}})}openSchedule(e){this.dispatchEvent(new CustomEvent("open-schedule",{detail:{id:e},bubbles:!0,composed:!0}))}render(){const e=this.sun??A,s=new Date,n=s.getHours()*60+s.getMinutes(),t=P[s.getDay()];return o`<div data-week-view>
      <div class="head" aria-hidden="true">${Array.from({length:9},(a,i)=>i*3).map(a=>o`<span class="hour" style="left:${v(a*60)}%">${String(a).padStart(2,"0")}</span>`)}</div>
      <div class="rows">
        ${P.map(a=>{const i=this.pillsOf(a),w=i.reduce((l,p)=>Math.max(l,p.lane+1),0);return o`<div class="row ${a===t?"today":""}" data-week-day=${a}>
            <div class="track" style="min-block-size:${Math.max(40,8+w*26)}px">
              <div class="night" style="left:0;width:${v(e.sunrise)}%"></div>
              <div class="night" style="left:${v(e.sunset)}%;width:${100-v(e.sunset)}%"></div>
              ${[3,6,9,12,15,18,21].map(l=>o`<div class="gl" style="left:${v(l*60)}%"></div>`)}
              <div class="sunl" style="left:${v(e.sunrise)}%"></div>
              <div class="sunl" style="left:${v(e.sunset)}%"></div>
              ${a===t?o`<div class="nowl" style="left:${v(n)}%"></div>`:f}
              ${i.map(l=>o`<button type="button" class="pill c-${l.cat} ${l.cond?"cond":""}" style="left:${l.x}px;top:${4+l.lane*26}px;max-inline-size:${l.w}px" title=${l.title} data-week-pill=${l.id} @click=${()=>this.openSchedule(l.id)}><b>${j(l.at)}</b><span>${l.text}</span></button>`)}
            </div>
            <div class="lbl">${V[a]}</div>
          </div>`})}
      </div>
      ${this.schedules.some(a=>a.enabled)?f:o`<div class="empty">${d("אין תזמונים פעילים להצגה.")}</div>`}
    </div>`}}S([c({attribute:!1})],_.prototype,"schedules");S([c({attribute:!1})],_.prototype,"sun");S([c({type:Number})],_.prototype,"snap");S([M()],_.prototype,"width");customElements.get("schedules-week-view")||customElements.define("schedules-week-view",_);export{te as t};
