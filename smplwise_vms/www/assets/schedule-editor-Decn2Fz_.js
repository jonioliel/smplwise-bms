import{hQ as ee,_ as X,i as U,n as f,r as u,a as R,hR as se,hS as xt,hT as at,hU as C,hV as J,hW as Q,hX as $t,p as h,q as n,cP as kt,hY as Xt,x as q,hZ as zt,h_ as ie,cK as gt,h$ as bt,i0 as ft,i1 as ae,i2 as T,i3 as ne,hJ as B,i4 as it,i5 as wt,i6 as Jt,i7 as re,a4 as oe,S as le,i8 as _t,i9 as de,ia as ce,ib as Qt,ic as St,id as Ot,ie as pe,ig as he,ih as ue,ii as ve,ij as ge,ik as be,il as fe,im as we,io as Z,ha as me,ip as ye,iq as Dt,hd as xe,K as $e,ir as ke,is as E,it as Ct,iu as nt,iv as Et,iw as Nt,ix as tt,hg as ze,h6 as At,iy as It,iz as Pt,hH as I,hp as W,iA as rt,R as ot,ak as et,iB as Tt,iC as P,iD as V,bI as _e,iE as Se,iF as Oe,iG as De,br as Mt,iH as Ce,iI as Lt,iJ as F,iK as Ee,iL as jt,iM as Ne,iN as Bt,iO as Ut,iP as Ae,iQ as lt,iR as Rt,iS as Ie,iT as dt,iU as qt,hq as K,iV as G,iW as Pe,iX as ct,iY as Te,iZ as Me,i_ as Le,hD as pt,i$ as Wt,j0 as je,j1 as st,j2 as M,h8 as ht,hE as Be,hF as Ue,hG as Re,j3 as qe,j4 as Vt,j5 as We,hO as Ve,j6 as Ft,fj as Fe,j7 as Ke,j8 as Ge}from"./index-C5kZ9jiu.js";import"./sw-schedule-bar-DqQa0a05.js";import{DEMO_SUN as He}from"./schedules-mock-8mklnmOo.js";import{a as Ye}from"./automations-demo-CVgZlSKD.js";import{d as Xe,c as ut,a as Kt,w as Gt}from"./automation-ext-dialogs-otxOUaXp.js";import"./sw-logo-art-Va6y_cIM.js";import"./schedules-logic-DVgW4Q3C.js";var Je=Object.defineProperty,Qe=Object.getOwnPropertyDescriptor,z=(t,e,s,i)=>{for(var a=i>1?void 0:i?Qe(e,s):e,r=t.length-1,d;r>=0;r--)(d=t[r])&&(a=(i?d(e,s,a):d(a))||a);return i&&a&&Je(e,s,a),a};const Ht={thermo:X`<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>`,sun:X`<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>`,fan:X`<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 9 3.5 6.5 5.2 4.7 6.5 6.5 10 10.6 11.2M13.6 12c4.4 0 6.9 3 5.2 5.5-1.3 1.8-4.8 0-6-4.1M12 13.6C12 18 15 20.5 17.5 18.8c1.8-1.3 0-4.8-4.1-6"/>`,blinds:X`<path d="M4 4h16M4 8h16M4 12h16M4 16h9M12 16v5"/>`},j=(t,e=14)=>t in Ht?n`<svg class="ic" width=${e} height=${e} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${Ht[t]}</svg>`:n`<sw-icon .name=${t} size=${e}></sw-icon>`;let m=class extends R{constructor(){super(...arguments),this.rows=[],this.snap=15,this.editable=!1,this.sun=null,this.now=null,this.selected="",this.orientation="horizontal",this.compact=!1,this.sunNote="משוער להיום",this.ghost=null,this.live="",this.drag=null,this.trackW=0,this.ro=null,this.onDown=t=>{if(t.button!==0)return;const e=t.target;if(!this.editable){const c=e.closest(".slot");c?.dataset.key&&this.emit("slot-select",{key:c.dataset.key,row:c.dataset.row??""});return}const s=e.closest(".track");if(!s)return;const i=this.rows.find(c=>c.key===s.dataset.track);if(!i||!i.active||i.readOnly||e.closest(".add"))return;const a=e.closest(".slot"),r=e.closest("[data-handle]");if(t.pointerType==="touch"&&this.vertical&&!r)return;const d=s.getBoundingClientRect(),l=this.minuteAt(t,d);let o;if(a){const c=i.slots.find($=>$.key===a.dataset.key);if(!c)return;o={kind:r?r.dataset.handle:"move",row:i.key,key:c.key,pointerId:t.pointerId,rect:d,anchor:l,x0:t.clientX,y0:t.clientY,orig:{start:c.start,end:c.end},locked:!!c.locked,point:!!c.point,moved:!1}}else o={kind:"create",row:i.key,key:null,pointerId:t.pointerId,rect:d,anchor:l,x0:t.clientX,y0:t.clientY,orig:null,moved:!1};this.drag=o,t.currentTarget.setPointerCapture(t.pointerId),o.kind!=="move"&&t.preventDefault()},this.onMove=t=>{const e=this.drag;if(!e||t.pointerId!==e.pointerId||!e.moved&&Math.hypot(t.clientX-e.x0,t.clientY-e.y0)<4)return;e.moved=!0;const s=this.rows.find(o=>o.key===e.row);if(!s)return;const i=this.minuteAt(t,e.rect),{spans:a,points:r}=this.spansOf(s),d=this.snap;if(e.kind==="create"){const o=se(a,e.anchor,i,d);this.ghost=o?{key:null,row:e.row,start:o.start,end:o.end,kind:"create"}:null;return}const l=s.slots.findIndex(o=>o.key===e.key);if(!(l<0||!e.orig||e.locked))if(e.kind==="move"){const o=xt(a,l,i-e.anchor,d);this.ghost={key:e.key,row:e.row,start:o,end:o+(e.orig.end-e.orig.start),kind:"move",point:e.point}}else{const o=at(a,r,l,e.kind,i,d,t.altKey);this.ghost=e.kind==="end"?{key:e.key,row:e.row,start:e.orig.start,end:o,kind:"end"}:{key:e.key,row:e.row,start:o,end:e.orig.end,kind:"start"}}},this.onUp=t=>{const e=this.drag;if(!e||t.pointerId!==e.pointerId)return;this.drag=null;const s=this.ghost;if(this.ghost=null,!e.moved){e.kind==="create"?this.emit("slot-create",{row:e.row,from:e.anchor,to:e.anchor+60}):e.key&&this.emit("slot-select",{key:e.key,row:e.row});return}s&&(e.kind==="create"?this.emit("slot-create",{row:e.row,from:s.start,to:s.end}):e.kind==="move"&&e.orig?s.start!==e.orig.start?this.emit("slot-move",{key:e.key,row:e.row,delta:s.start-e.orig.start}):this.emit("slot-select",{key:e.key,row:e.row}):(e.kind==="start"||e.kind==="end")&&this.emit("slot-resize",{key:e.key,row:e.row,edge:e.kind,minute:e.kind==="start"?s.start:s.end,detach:t.altKey}))},this.onCancel=()=>{this.drag=null,this.ghost=null},this.onKey=t=>{const e=t.target.closest(".slot");if(!e)return;const s=e.dataset.key??"",i=e.dataset.row??"",a=this.rows.find(c=>c.key===i),r=a?.slots.find(c=>c.key===s);if(!a||!r)return;if(t.key==="Escape"&&this.drag){this.onCancel();return}const d=this.vertical?["ArrowUp","ArrowDown"]:["ArrowLeft","ArrowRight"],l=this.vertical?["ArrowLeft","ArrowRight"]:["ArrowUp","ArrowDown"],o=t.key==="ArrowRight"||t.key==="ArrowDown";if(t.key==="Enter"||t.key===" ")t.preventDefault(),this.emit("slot-select",{key:s,row:i});else if(d.includes(t.key)){if(t.preventDefault(),!this.editable||a.readOnly||r.locked)return;const c=this.snap*(o?1:-1),{spans:p,points:$}=this.spansOf(a),w=a.slots.findIndex(v=>v.key===s);t.shiftKey&&!r.point?(this.emit("slot-resize",{key:s,row:i,edge:"end",minute:r.end+c,detach:t.altKey}),this.announce(`סיום ${C(at(p,$,w,"end",r.end+c,this.snap,t.altKey))}`)):(t.ctrlKey||t.metaKey)&&!r.point?(this.emit("slot-resize",{key:s,row:i,edge:"start",minute:r.start+c,detach:t.altKey}),this.announce(`התחלה ${C(at(p,$,w,"start",r.start+c,this.snap,t.altKey))}`)):(this.emit("slot-move",{key:s,row:i,delta:c}),this.announce(`התחלה ${C(xt(p,w,c,this.snap))}`))}else if(t.key==="Delete"||t.key==="Backspace")t.preventDefault(),this.editable&&!a.readOnly&&!r.locked&&this.emit("slot-remove",{key:s,row:i});else if(l.includes(t.key))t.preventDefault(),this.focusNeighbour(i,s,o?1:-1,r.start);else if(t.key==="Home"||t.key==="End"){t.preventDefault();const c=a.slots.slice().sort((p,$)=>p.start-$.start);this.focusSlot(i,(t.key==="Home"?c[0]:c[c.length-1]).key)}}}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(()=>{const e=this.renderRoot.querySelector(".track")?.clientWidth??0;Math.abs(e-this.trackW)>2&&(this.trackW=e)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.ro=null}pinFlips(t){return!t.point||this.vertical||!this.trackW?!1:(J-t.start)/J*this.trackW-34<8*t.title.length+22}announce(t){this.live="",requestAnimationFrame(()=>this.live=t)}get vertical(){return this.orientation==="vertical"}pos(t){return`${Q(t)}%`}slotStyle(t,e=t.start,s=t.end){if(t.point)return this.vertical?`top:${this.pos(e)}`:`left:${this.pos(e)}`;const i=Q(Math.max(0,s-e));return this.vertical?`top:${this.pos(e)};height:${i}%`:`left:${this.pos(e)};width:${i}%`}minuteAt(t,e){return this.vertical?$t(t.clientY-e.top,e.height):$t(t.clientX-e.left,e.width)}spansOf(t){return{spans:t.slots.map(e=>({start:e.start,end:e.end})),points:t.slots.map(e=>!!e.point)}}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}focusSlot(t,e){this.renderRoot.querySelector(`.slot[data-row="${CSS.escape(t)}"][data-key="${CSS.escape(e)}"]`)?.focus()}focusNeighbour(t,e,s,i){const a=this.rows.findIndex(r=>r.key===t);for(let r=a+s;r>=0&&r<this.rows.length;r+=s){const d=this.rows[r];if(!d.active||!d.slots.length)continue;const l=d.slots.find(o=>o.key===e)??d.slots.slice().sort((o,c)=>Math.abs(o.start-i)-Math.abs(c.start-i))[0];this.focusSlot(d.key,l.key);return}}renderSlot(t,e){const s=this.ghost&&this.ghost.key===e.key&&this.drag?.row===t.key,i=["slot",`cat-${e.category}`,e.point?"point":"",e.key===this.selected?"sel":"",s?"dragging":"",e.locked?"locked":"",e.invalid?"invalid":"",e.conflict?"conflict":"",this.pinFlips(e)?"flip":"",e.lowering?"lowering":e.sensitive?"sensitive":""].filter(Boolean).join(" ");return n`<div
      class=${i}
      role="button"
      tabindex="0"
      style=${this.slotStyle(e)}
      data-key=${e.key}
      data-row=${t.key}
      aria-label=${e.aria}
      aria-pressed=${e.key===this.selected?"true":"false"}
      aria-describedby="kbhelp"
      title=${`${e.title} · ${e.timeLabel}`}
    >
      <span class="handle s" data-handle="start"></span>
      <div class="body">
        ${j(e.locked?"lock":e.icon)}
        <span class="txt"><b>${e.title}</b><small><bdi dir="ltr">${e.timeLabel}</bdi></small></span>
        <span class="flags">
          ${e.sunStart||e.sunEnd?n`<span class="flag" title="לפי שמש">${j("sun",11)}</span>`:h}
          ${e.lowering?n`<span class="flag warn" title="פותח או מנטרל">${j("warning",11)}</span>`:e.sensitive?n`<span class="flag" title="פעולה רגישה">${j("shield",11)}</span>`:h}
        </span>
      </div>
      <span class="handle e" data-handle="end"></span>
    </div>`}renderRow(t){const e=["row",t.today?"today":"",t.active?"":"off",t.readOnly?"ro":""].filter(Boolean).join(" "),s=this.ghost,i=!!s&&t.active&&!t.readOnly,a=n`<button class="rowlabel" type="button" @click=${()=>this.emit("row-select",{row:t.key})}><b>${t.label}</b>${t.sub?n`<small>${t.sub}</small>`:h}</button>`;return n`<div class=${e}>
      <div class="track" data-track=${t.key}>
        ${t.active?t.slots.length===0&&this.editable&&!t.readOnly?n`<div class="empty-hint">גררו כדי ליצור משבצת</div>`:h:n`<button class="add" type="button" ?disabled=${!this.editable||!!t.readOnly} @click=${()=>this.emit("row-add",{row:t.key})}>${t.addLabel??"הוספה לתזמון"} ${j("plus",13)}</button>`}
        ${kt(t.active?t.slots:[],r=>r.key,r=>this.renderSlot(t,r))}
        ${i&&s?n`<div class="ghost ${s.point?"point":""}" style=${this.slotStyle({start:s.start,end:s.end,point:s.point},s.start,s.end)}><span>${C(s.start)}–${C(s.end)}</span></div>`:h}
      </div>
      ${a}
    </div>`}render(){const t=this.sun??Xt,e=this.vertical?Array.from({length:24},(a,r)=>r+1):Array.from({length:13},(a,r)=>r*2),s=[{min:t.sunrise,label:this.vertical?C(t.sunrise):`זריחה ${C(t.sunrise)}`,cls:""},{min:t.sunset,label:this.vertical?C(t.sunset):`שקיעה ${C(t.sunset)}`,cls:""}],i=a=>this.vertical?`top:${this.pos(a)}`:`left:${this.pos(a)}`;return n`<div class="board">
      <div class="head">
        <div class="axis">
          ${e.map(a=>n`<span class="hour" style=${i(a*60)}>${String(a%24===0&&a>0&&!this.vertical?24:a).padStart(2,"0")}</span>`)}
          ${s.map(a=>n`<span class="mark" style=${i(a.min)} title=${this.sunNote}>${j("sun",11)}${a.label}</span>`)}
          ${this.now!==null?n`<span class="mark now" style=${i(this.now)}>${this.vertical?"":"עכשיו "}${C(this.now)}</span>`:h}
        </div>
      </div>
      <div class="tracks" @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onCancel} @keydown=${this.onKey}>
        <div class="overlay" aria-hidden="true">
          <div class="night" style=${this.vertical?`top:0;height:${this.pos(t.sunrise)}`:`left:0;width:${this.pos(t.sunrise)}`}></div>
          <div class="night" style=${this.vertical?`top:${this.pos(t.sunset)};height:${Q(J-t.sunset)}%`:`left:${this.pos(t.sunset)};width:${Q(J-t.sunset)}%`}></div>
          ${Array.from({length:23},(a,r)=>r+1).map(a=>n`<div class="grid-line ${a%6===0?"major":""}" style=${i(a*60)}></div>`)}
          <div class="vline" style=${i(t.sunrise)}></div>
          <div class="vline" style=${i(t.sunset)}></div>
          ${this.now!==null?n`<div class="vline now" style=${i(this.now)}></div>`:h}
        </div>
        ${kt(this.rows,a=>a.key,a=>this.renderRow(a))}
      </div>
    </div>
    <p class="sr" id="kbhelp">חצים: הזזת המשבצת. Shift וחצים: שינוי שעת הסיום. Ctrl וחצים: שינוי שעת ההתחלה. Delete: מחיקה. Enter: בחירה.</p>
    <div class="sr" aria-live="polite" role="status">${this.live}</div>`}};m.styles=U`
    :host {
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      user-select: none;
      -webkit-user-select: none;
      --label-w: 64px;
      --row-h: 46px;
      --axis-h: 22px;
       sourceMappingURL=[^*]**/ DU1: the slot colours are the product's state tokens (so dark mode and the skins reach the grid); the fills are the same colours at a low share */
      --sc-on: var(--sw-success-text);
      --sc-on-bg: color-mix(in srgb, var(--sw-success) 16%, transparent);
      --sc-off: var(--sw-text-2);
      --sc-off-bg: color-mix(in srgb, var(--sw-text-3) 15%, transparent);
      --sc-level: var(--sw-warning-text);
      --sc-level-bg: color-mix(in srgb, var(--sw-warning) 18%, transparent);
      --sc-climate: var(--sw-accent-text);
      --sc-climate-bg: color-mix(in srgb, var(--sw-accent) 14%, transparent);
      --sc-cover: var(--sw-circuit-6);
      --sc-cover-bg: color-mix(in srgb, var(--sw-circuit-6) 16%, transparent);
      --sc-secure: var(--sw-purple);
      --sc-secure-bg: color-mix(in srgb, var(--sw-purple) 15%, transparent);
      --sc-custom: var(--sw-text-2);
      --sc-custom-bg: color-mix(in srgb, var(--sw-text-2) 12%, transparent);
      --sc-empty: var(--sw-text-3);
      --sc-empty-bg: color-mix(in srgb, var(--sw-text-3) 10%, transparent);
      --sc-night: color-mix(in srgb, var(--sw-text) 4.5%, transparent);
    }
    :host([compact]) {
      --row-h: 32px;
      --label-w: 56px;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
     sourceMappingURL=[^*]**/ ------------------------------------------------------------------ horizontal */
    .board {
      display: flex;
      flex-direction: column;
    }
    .head {
      display: grid;
      grid-template-columns: 1fr var(--label-w);
      block-size: calc(var(--axis-h) + 16px);
    }
    .axis {
      position: relative;
    }
    .hour {
      position: absolute;
      inset-block-end: 2px;
      transform: translateX(-50%);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-2xs);
      font-variant-numeric: tabular-nums;
    }
    .hour:first-child {
      transform: none;
    }
    .mark {
      position: absolute;
      inset-block-start: 0;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-2xs);
      white-space: nowrap;
      direction: rtl;
    }
    .mark.now {
      color: var(--sw-danger);
      font-weight: var(--sw-fw-semibold);
    }
    .tracks {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr var(--label-w);
      align-items: stretch;
      min-inline-size: 0;
    }
    .rowlabel {
      direction: rtl;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding-inline-start: 8px;
      border: 0;
      background: none;
      font: inherit;
      color: var(--sw-text);
      text-align: start;
      cursor: pointer;
      border-radius: var(--sw-r-xs);
      min-inline-size: 0;
    }
    .rowlabel:hover {
      background: var(--sw-surface-3);
    }
    .rowlabel b {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .rowlabel small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-2xs);
    }
    .row.today .rowlabel b,
    .row.today .rowlabel small {
      color: var(--sw-accent-text);
    }
    .row.off .rowlabel b {
      color: var(--sw-text-3);
    }
    .track {
      position: relative;
      block-size: var(--row-h);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      overflow: hidden;
      touch-action: pan-y;
      cursor: crosshair;
    }
    :host(:not([editable])) .track,
    .row.ro .track {
      cursor: default;
    }
    .row.off .track {
      background: repeating-linear-gradient(135deg, transparent 0 6px, rgba(148, 163, 184, 0.14) 6px 8px);
      cursor: default;
    }
    .row.ro .track {
      opacity: 0.72;
    }
    .add {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 0;
      background: none;
      font: inherit;
      color: var(--sw-text-2);
      cursor: pointer;
      direction: rtl;
    }
    .add:hover,
    .add:focus-visible {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .empty-hint {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      pointer-events: none;
      direction: rtl;
    }
    .overlay {
      position: absolute;
      inset-block: 0;
      inset-inline: 0 var(--label-w);
      pointer-events: none;
      z-index: 2;
    }
    .night {
      position: absolute;
      inset-block: 0;
      background: var(--sc-night);
    }
    .vline {
      position: absolute;
      inset-block: 0;
      inline-size: 0;
      border-inline-start: 1px dashed rgba(217, 119, 6, 0.7);
    }
    .vline.now {
      border-inline-start: 2px solid var(--sw-danger);
    }
    .grid-line {
      position: absolute;
      inset-block: 0;
      inline-size: 1px;
      background: rgba(30, 46, 71, 0.06);
    }
    .grid-line.major {
      background: rgba(30, 46, 71, 0.12);
    }
     sourceMappingURL=[^*]**/ ------------------------------------------------------------------ slots */
    .slot {
      --c: var(--sc-custom);
      --bg: var(--sc-custom-bg);
      position: absolute;
      inset-block: 4px;
      box-sizing: border-box;
      border-radius: var(--sw-r-xs);
      border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
      border-inline-start: 4px solid var(--c);
      background: var(--bg);
      color: color-mix(in srgb, var(--c) 72%, #000);
      cursor: grab;
      container-type: inline-size;
      display: flex;
      align-items: center;
      z-index: 1;
      outline: none;
      touch-action: pan-y;
    }
    .slot.cat-on {
      --c: var(--sc-on);
      --bg: var(--sc-on-bg);
    }
    .slot.cat-off {
      --c: var(--sc-off);
      --bg: var(--sc-off-bg);
    }
    .slot.cat-level {
      --c: var(--sc-level);
      --bg: var(--sc-level-bg);
    }
    .slot.cat-climate {
      --c: var(--sc-climate);
      --bg: var(--sc-climate-bg);
    }
    .slot.cat-cover {
      --c: var(--sc-cover);
      --bg: var(--sc-cover-bg);
    }
    .slot.cat-secure {
      --c: var(--sc-secure);
      --bg: var(--sc-secure-bg);
    }
    .slot.cat-empty {
      --c: var(--sc-empty);
      --bg: var(--sc-empty-bg);
      border-style: dashed;
    }
    .slot.sel {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
      z-index: 3;
    }
    .slot:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
      z-index: 4;
    }
    .slot.dragging {
      opacity: 0.35;
    }
    .slot.invalid {
      box-shadow: 0 0 0 2px var(--sw-danger);
    }
    .slot.conflict {
      outline: 2px dashed var(--sw-warning);
      outline-offset: 1px;
    }
     sourceMappingURL=[^*]**/ the marker of a sensitive / lowering slot stays visible on a narrow bar too (the flags inside hide there) */
    .slot.lowering::after,
    .slot.sensitive::after {
      content: '';
      position: absolute;
      inset-block-start: -4px;
      inset-inline-end: -4px;
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--sw-danger);
      border: 2px solid var(--sw-surface);
      z-index: 3;
      pointer-events: none;
    }
    .slot.sensitive::after {
      background: var(--sc-secure);
    }
    .slot.locked {
      cursor: default;
      background-image: repeating-linear-gradient(135deg, transparent 0 5px, rgba(71, 85, 105, 0.1) 5px 7px);
    }
    .slot .body {
      direction: rtl;
      display: flex;
      align-items: center;
      gap: 5px;
      padding-inline: 6px;
      min-inline-size: 0;
      inline-size: 100%;
      overflow: hidden;
      pointer-events: none;
    }
    .slot .txt {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.2;
    }
    .slot .txt b {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .slot .txt small {
      font-size: var(--sw-fs-2xs);
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .slot .flags {
      display: inline-flex;
      gap: 3px;
      margin-inline-start: auto;
      flex: none;
    }
    .slot .flag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--c) 18%, #fff);
      color: var(--c);
    }
    .slot .flag.warn {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    @container (max-inline-size: 84px) {
      .slot .txt small,
      .slot .flags {
        display: none;
      }
    }
    @container (max-inline-size: 46px) {
      .slot .txt {
        display: none;
      }
      .slot .body {
        justify-content: center;
        padding-inline: 0;
      }
    }
    .handle {
      position: absolute;
      inset-block: 0;
      inline-size: 9px;
      cursor: ew-resize;
      z-index: 2;
      touch-action: none;
    }
    .handle.s {
      inset-inline-start: -4px;
    }
    .handle.e {
      inset-inline-end: -3px;
    }
    .handle::after {
      content: '';
      position: absolute;
      inset-block: 30%;
      inset-inline-start: 4px;
      inline-size: 2px;
      border-radius: 2px;
      background: color-mix(in srgb, var(--c) 55%, transparent);
      opacity: 0;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .slot:hover .handle::after,
    .slot.sel .handle::after,
    .slot:focus-visible .handle::after {
      opacity: 1;
    }
    :host(:not([editable])) .handle,
    .row.ro .handle,
    .slot.locked .handle {
      display: none;
    }
    @media (pointer: coarse) {
      .handle {
        inline-size: 18px;
      }
      .handle.s {
        inset-inline-start: -8px;
      }
      .handle.e {
        inset-inline-end: -8px;
      }
    }
     sourceMappingURL=[^*]**/ a point action: a pin with its label beside it */
    .slot.point {
      border-inline-start-width: 1px;
      border-radius: var(--sw-r-lg);
      inset-block: 8px;
      inline-size: 28px;
      min-inline-size: 28px;
      justify-content: center;
      overflow: visible;
    }
    .slot.point .body {
      padding: 0;
      justify-content: center;
      overflow: visible;
    }
    .slot.point .txt {
      display: flex;
      position: absolute;
       sourceMappingURL=[^*]**/ physical sides: the bar sits on an LTR axis, its label goes to the later side (the flipped one, near the end of the
         day, to the earlier side) whatever the direction of the text inside */
      left: calc(100% + 5px);
      inline-size: max-content;
      max-inline-size: 240px;
      background: color-mix(in srgb, var(--bg) 70%, var(--sw-surface));
      padding: 1px 6px;
      border-radius: var(--sw-r-xs);
    }
    .slot.point.flip .txt {
      left: auto;
      right: calc(100% + 5px);
    }
    .slot.point .flags {
      display: none;
    }
    .slot.point .handle {
      display: none;
    }
    .ghost {
      position: absolute;
      inset-block: 2px;
      border-radius: var(--sw-r-xs);
      border: 2px dashed var(--sw-accent);
      background: rgba(39, 103, 237, 0.1);
      z-index: 5;
      pointer-events: none;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      box-sizing: border-box;
    }
    .ghost.point {
      inline-size: 28px;
    }
    .ghost span {
      transform: translateY(-115%);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-2xs);
      padding: 1px 6px;
      font-size: var(--sw-fs-2xs);
      white-space: nowrap;
      direction: ltr;
      font-variant-numeric: tabular-nums;
    }
     sourceMappingURL=[^*]**/ ------------------------------------------------------------------ vertical (phone day view) */
    :host([orientation='vertical']) .board {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 0;
    }
    :host([orientation='vertical']) .head {
      display: block;
      block-size: auto;
      position: relative;
    }
    :host([orientation='vertical']) .axis {
      position: relative;
      block-size: 100%;
    }
    :host([orientation='vertical']) .hour {
      inset-block-end: auto;
      inset-inline-start: 0;
      transform: translateY(-50%);
      inline-size: 28px;
      text-align: end;
    }
    :host([orientation='vertical']) .hour:first-child {
      transform: none;
    }
    :host([orientation='vertical']) .mark {
      inset-block-start: auto;
      inset-inline: 0 auto;
      inline-size: 32px;
      justify-content: flex-end;
      transform: translateY(-100%);
      font-size: var(--sw-fs-2xs);
    }
    :host([orientation='vertical']) .mark sw-icon,
    :host([orientation='vertical']) .mark svg {
      display: none;
    }
    :host([orientation='vertical']) .tracks {
      flex-direction: row;
      gap: 6px;
      block-size: calc(24 * var(--hour-h, 44px));
    }
    :host([orientation='vertical']) .row {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-inline-size: 0;
    }
    :host([orientation='vertical']) .rowlabel {
      display: none;
    }
    :host([orientation='vertical']) .track {
      flex: 1;
      block-size: auto;
      touch-action: auto;
    }
    :host([orientation='vertical']) .overlay {
      inset: 0;
      inset-block-start: 0;
    }
    :host([orientation='vertical']) .grid-line {
      inset-block: auto;
      inset-inline: 0;
      inline-size: auto;
      block-size: 1px;
    }
    :host([orientation='vertical']) .vline {
      inset-block: auto;
      inset-inline: 0;
      inline-size: auto;
      block-size: 0;
      border-inline-start: 0;
      border-block-start: 1px dashed rgba(217, 119, 6, 0.7);
    }
    :host([orientation='vertical']) .vline.now {
      border-block-start: 2px solid var(--sw-danger);
    }
    :host([orientation='vertical']) .night {
      inset-block: auto;
      inset-inline: 0;
    }
    :host([orientation='vertical']) .slot {
      inset-block: auto;
      inset-inline: 6px;
      border-inline-start-width: 1px;
      border-block-start: 4px solid var(--c);
      touch-action: auto;
      align-items: flex-start;
    }
    :host([orientation='vertical']) .slot .body {
      padding-block: 4px;
      align-items: flex-start;
    }
    :host([orientation='vertical']) .handle {
      inset-block: auto;
      inset-inline: 0;
      inline-size: auto;
      block-size: 16px;
      cursor: ns-resize;
    }
    :host([orientation='vertical']) .handle.s {
      inset-block-start: -8px;
      inset-inline-start: 0;
    }
    :host([orientation='vertical']) .handle.e {
      inset-block-end: -8px;
      inset-inline-end: 0;
    }
    :host([orientation='vertical']) .handle::after {
      inset-block: 7px auto;
      inset-inline: 30%;
      inline-size: auto;
      block-size: 2px;
    }
    :host([orientation='vertical']) .slot.point {
      inline-size: auto;
      min-inline-size: 0;
      block-size: 28px;
      min-block-size: 28px;
      inset-inline: 6px;
      border-radius: var(--sw-r-lg);
      justify-content: flex-start;
    }
    :host([orientation='vertical']) .slot.point .body {
      justify-content: flex-start;
      padding-inline: 8px;
    }
    :host([orientation='vertical']) .slot.point .txt {
      position: static;
      inline-size: auto;
      background: none;
      padding: 0;
      flex-direction: row;
      gap: 6px;
      align-items: center;
    }
    :host([orientation='vertical']) .ghost {
      inset-block: auto;
      inset-inline: 6px;
    }
    :host([orientation='vertical']) .ghost span {
      transform: none;
      align-self: center;
    }
    :host([orientation='vertical']) .empty-hint {
      align-items: start;
      padding-block-start: 30%;
    }
    @media (prefers-reduced-motion: reduce) {
      .handle::after {
        transition: none;
      }
    }
  `;z([f({attribute:!1})],m.prototype,"rows",2);z([f({type:Number})],m.prototype,"snap",2);z([f({type:Boolean,reflect:!0})],m.prototype,"editable",2);z([f({attribute:!1})],m.prototype,"sun",2);z([f({type:Number})],m.prototype,"now",2);z([f()],m.prototype,"selected",2);z([f({reflect:!0})],m.prototype,"orientation",2);z([f({type:Boolean,reflect:!0})],m.prototype,"compact",2);z([f()],m.prototype,"sunNote",2);z([u()],m.prototype,"ghost",2);z([u()],m.prototype,"live",2);z([u()],m.prototype,"trackW",2);m=z([q("sw-schedule-grid")],m);const Ze=["on","off","level","climate","cover","secure"].map(t=>({cat:t,label:ee[t]}));var ts=Object.defineProperty,es=Object.getOwnPropertyDescriptor,_=(t,e,s,i)=>{for(var a=i>1?void 0:i?es(e,s):e,r=t.length-1,d;r>=0;r--)(d=t[r])&&(a=(i?d(e,s,a):d(a))||a);return i&&a&&ts(e,s,a),a};const Yt=new Set(["cover.stop_cover","cover.set_cover_tilt_position","cover.open_cover_tilt","cover.close_cover_tilt","climate.set_fan_mode","climate.set_preset_mode","climate.set_swing_mode","climate.set_humidity","fan.set_percentage"]),ss={brightness:"בהירות",brightness_pct:"בהירות",position:"מיקום",tilt_position:"הטיה",temperature:"טמפרטורה",hvac_mode:"מצב פעולה",percentage:"עוצמה",fan_mode:"מצב מאוורר",preset_mode:"מצב מוגדר",swing_mode:"מצב נדנוד",humidity:"לחות",mode:"מצב",value:"ערך",option:"אפשרות"},is={cool:"קירור",heat:"חימום",heat_cool:"אוטומטי",auto:"אוטומטי",dry:"ייבוש",fan_only:"מאוורר",off:"כבוי"},as={fixed:"שעה קבועה",sunrise:"זריחה",sunset:"שקיעה",end:"סוף היום",none:"ללא (פעולה חד־פעמית)"};let y=class extends R{constructor(){super(...arguments),this.slotData=null,this.index=0,this.count=0,this.meta=new Map,this.entityIds=[],this.allowNegativeSun=!1,this.readOnly=!1,this.locked=[],this.errors=[],this.paired=!1,this.canPair=!1,this.canCopyDays=!0}change(t){this.dispatchEvent(new CustomEvent("slot-change",{detail:{slot:t},bubbles:!0,composed:!0}))}fire(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}setTime(t,e){const s=this.slotData;if(!s)return;const i=zt(t==="start"?s.start:s.stop,t==="stop");let a={...i,...e};e.kind&&e.kind!==i.kind&&e.kind==="fixed"&&i.kind!=="fixed"&&(a={...a,time:t==="stop"?this.nextTime(s.start):"08:00"}),a.offset<0&&!this.allowNegativeSun&&(a={...a,offset:0});const r=ie(a);this.change(t==="start"?{...s,start:r??s.start}:{...s,stop:r})}nextTime(t){const e=/^(\d{2}):(\d{2})/.exec(t);if(!e)return"09:00";const s=Math.min(1439,Number(e[1])*60+Number(e[2])+60);return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}timeField(t){const e=this.slotData,s=zt(t==="start"?e.start:e.stop,t==="stop"),i=t==="start"?["fixed","sunrise","sunset"]:["fixed","sunrise","sunset","end","none"],a=`${t}-${e.uid}`;return n`<div class="f">
      <label for=${a}>${t==="start"?"משעה (רגע הביצוע)":"עד שעה (סוף חלון)"}</label>
      <select id=${a} ?disabled=${this.readOnly} data-time-kind=${t} @change=${r=>this.setTime(t,{kind:r.target.value})}>
        ${i.map(r=>n`<option value=${r} ?selected=${s.kind===r}>${as[r]}</option>`)}
      </select>
      ${s.kind==="fixed"?n`<input type="time" lang=${gt()} step="60" ?disabled=${this.readOnly} data-time=${t} aria-label=${t==="start"?"שעת התחלה":"שעת סיום"} .value=${s.time} @change=${r=>r.target.value&&this.setTime(t,{time:r.target.value})} />`:s.kind==="sunrise"||s.kind==="sunset"?n`<div class="pair">
              <input type="number" min=${this.allowNegativeSun?-720:0} max="720" step="5" ?disabled=${this.readOnly} data-offset=${t} aria-label="דקות אחרי ${s.kind==="sunrise"?"הזריחה":"השקיעה"}" .value=${String(s.offset)} @change=${r=>this.setTime(t,{offset:Number(r.target.value)||0})} />
              <span class="unit">דקות אחרי</span>
            </div>`:h}
    </div>`}updateGroup(t,e,s){const i=this.slotData;i&&this.change({...i,actions:bt(i.actions,t,e,s)})}onService(t,e){const s=t.entities.find(r=>!!r),i=s?this.meta.get(s):void 0,a=i?.actions.find(r=>r.service===e)?.args??[];this.updateGroup(t,e,ft(a,i))}removeEntity(t){const e=this.slotData;!e||!t||this.change({...e,actions:ae(e.actions,t)})}addEntity(t){const e=this.slotData,s=this.meta.get(t);if(!e||!s)return;const i=T(e.actions);let a=null;for(const r of i){const d=e.actions.find(l=>l.entity_id===r.entities[0]);if(d&&(a=ne(d,s),a))break}a??=s.actions[0]?{service:s.actions[0].service,entity_id:t,data:ft(s.actions[0].args,s)}:null,a&&this.change({...e,actions:[...e.actions,a]})}setArg(t,e,s){const i={...t.data};s===void 0||s===""||typeof s=="number"&&Number.isNaN(s)?delete i[e]:i[e]=s,this.updateGroup(t,t.service,i)}setVar(t,e,s){const i={...t.data.variables??{}};s===void 0||s===""||typeof s=="number"&&Number.isNaN(s)?delete i[e]:i[e]=s;const a={...t.data};Object.keys(i).length?a.variables=i:delete a.variables,this.updateGroup(t,t.service,a)}renderVars(t,e){const s=this.readOnly,i=t.data.variables??{};return n`<div class="vars" data-arg="variables">
      <span class="lbl">${e.label??"משתני הסקריפט"}</span>
      ${(e.fields??[]).map(a=>{const r=i[a.name],d=`${t.key}:var:${a.name}`,l=`${a.label??a.name}${a.required?" *":""}`;return a.type==="bool"?n`<label class="pair" data-var=${a.name}><input type="checkbox" ?disabled=${s} .checked=${r===!0} @change=${o=>this.setVar(t,a.name,o.target.checked)} />${l}</label>`:a.choices&&a.choices.length?n`<div class="arg" data-var=${a.name}><label for=${d}>${l}</label>
            <select id=${d} ?disabled=${s} @change=${o=>this.setVar(t,a.name,o.target.value)}>
              ${a.required?h:n`<option value="" ?selected=${r===void 0}>ללא</option>`}
              ${a.choices.map(o=>n`<option value=${o} ?selected=${r===o}>${o}</option>`)}
            </select></div>`:a.type==="int"||a.type==="float"?n`<div class="arg" data-var=${a.name}><label for=${d}>${l}</label>
            <div class="row"><input id=${d} type="number" step=${a.step??(a.type==="int"?1:.5)} min=${a.min??h} max=${a.max??h} ?disabled=${s} .value=${r===void 0?"":String(r)}
              @change=${o=>this.setVar(t,a.name,o.target.value===""?void 0:Number(o.target.value))} /><span class="unit">${a.unit??""}</span></div></div>`:n`<div class="arg" data-var=${a.name}><label for=${d}>${l}</label>
          <input id=${d} type="text" maxlength=${a.max??200} ?disabled=${s} .value=${r===void 0?"":String(r)} @change=${o=>this.setVar(t,a.name,o.target.value)} /></div>`})}
    </div>`}renderArg(t,e){if(e.type==="vars")return this.renderVars(t,e);const s=this.readOnly,i=t.data[e.name],a=e.label??ss[e.name]??e.name,r=`${t.key}:${e.name}`;if(e.name==="brightness_pct"&&t.data.brightness_pct===void 0)return h;if(e.name==="brightness"&&t.data.brightness_pct!==void 0)return h;if(e.name==="brightness"||e.name==="brightness_pct"){const d=e.name==="brightness",l=typeof i=="number"?d?Math.round(i/255*100):i:null,o=c=>this.setArg(t,e.name,d?Math.round(c/100*255):c);return n`<div class="arg" data-arg=${e.name}>
        <span class="lbl">${a}</span>
        ${l===null?n`<div class="row"><sw-button size="sm" ?disabled=${s} @click=${()=>o(80)}>הגדרת בהירות</sw-button></div>`:n`<div class="row">
              <input type="range" min="1" max="100" step="1" ?disabled=${s} aria-label=${a} .value=${String(l)} @input=${c=>o(Number(c.target.value))} />
              <input type="number" min="1" max="100" ?disabled=${s} aria-label="${a} באחוזים" .value=${String(l)} @change=${c=>o(Math.min(100,Math.max(1,Number(c.target.value)||1)))} />
              <span class="unit">%</span>
              ${s?h:n`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="ללא בהירות" @click=${()=>this.setArg(t,e.name,void 0)}></sw-button>`}
            </div>`}
      </div>`}if(e.choices&&e.choices.length)return n`<div class="arg" data-arg=${e.name}>
        <label for=${r}>${a}</label>
        <select id=${r} ?disabled=${s} @change=${d=>this.setArg(t,e.name,d.target.value)}>
          ${e.required?h:n`<option value="" ?selected=${i===void 0}>ללא שינוי</option>`}
          ${e.choices.map(d=>n`<option value=${d} ?selected=${i===d}>${e.name==="hvac_mode"?is[d]??d:d}</option>`)}
        </select>
      </div>`;if(e.type==="bool")return n`<div class="arg" data-arg=${e.name}>
        <label class="pair"><input type="checkbox" ?disabled=${s} .checked=${i===!0} @change=${d=>this.setArg(t,e.name,d.target.checked)} />${a}</label>
      </div>`;if(e.type==="int"&&e.min!==void 0&&e.max!==void 0){if(!e.required&&typeof i!="number")return n`<div class="arg" data-arg=${e.name}>
          <span class="lbl">${a}</span>
          <div class="row"><sw-button size="sm" ?disabled=${s} @click=${()=>this.setArg(t,e.name,Math.min(e.max,Math.max(e.min,50)))}>הגדרת ${a}</sw-button></div>
        </div>`;const d=typeof i=="number"?i:e.min;return n`<div class="arg" data-arg=${e.name}>
        <label for=${r}>${a}</label>
        <div class="row">
          <input id=${r} type="range" min=${e.min} max=${e.max} step="1" ?disabled=${s} .value=${String(d)} @input=${l=>this.setArg(t,e.name,Number(l.target.value))} />
          <input type="number" min=${e.min} max=${e.max} ?disabled=${s} aria-label=${a} .value=${String(d)} @change=${l=>this.setArg(t,e.name,Number(l.target.value))} />
          <span class="unit">${e.name==="position"||e.name==="tilt_position"||e.name==="percentage"?"%":""}</span>
          ${s||e.required?h:n`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="ללא ${a}" @click=${()=>this.setArg(t,e.name,void 0)}></sw-button>`}
        </div>
      </div>`}return e.type==="int"||e.type==="float"?n`<div class="arg" data-arg=${e.name}>
        <label for=${r}>${a}</label>
        <div class="row">
          <input id=${r} type="number" step=${e.step??(e.type==="float"&&e.name!=="temperature"?"0.5":"1")} min=${e.min??h} max=${e.max??h} ?disabled=${s} .value=${i===void 0?"":String(i)} @change=${d=>this.setArg(t,e.name,d.target.value===""?void 0:Number(d.target.value))} />
          <span class="unit">${e.name==="temperature"?"°":""}</span>
        </div>
      </div>`:n`<div class="arg" data-arg=${e.name}>
      <label for=${r}>${a}</label>
      <input id=${r} type="text" ?disabled=${s} .value=${i===void 0?"":String(i)} @change=${d=>this.setArg(t,e.name,d.target.value)} />
    </div>`}renderGroup(t,e){const s=t.entities.find(p=>!!p),a=(s?this.meta.get(s):void 0)?.actions??[],r=a.find(p=>p.service===t.service)?.args??[],d=a.filter(p=>!Yt.has(p.service)),l=a.filter(p=>Yt.has(p.service)),o=a.some(p=>p.service===t.service),c=`svc-${this.slotData?.uid}-${e}`;return n`<div class="group" data-action-group=${e}>
      <div class="ents">
        ${t.entities.map(p=>n`<span class="ent">${p?this.meta.get(p)?.name??p:"ללא התקן"}${this.readOnly||!p?h:n`<button type="button" aria-label="הסרת ${this.meta.get(p)?.name??p} מהפעולה" @click=${()=>this.removeEntity(p)}><sw-icon name="close" size="12"></sw-icon></button>`}</span>`)}
      </div>
      <div class="f">
        <label for=${c}>פעולה</label>
        <select id=${c} ?disabled=${this.readOnly||!a.length} data-service @change=${p=>this.onService(t,p.target.value)}>
          ${o||!a.length?h:n`<option value=${t.service} selected>${B({service:t.service})}</option>`}
          ${a.length?h:n`<option value=${t.service} selected>${B({service:t.service,data:t.data})}</option>`}
          ${d.map(p=>n`<option value=${p.service} ?selected=${p.service===t.service}>${it(p.service,p.label)}</option>`)}
          ${l.length?n`<optgroup label="מתקדם">${l.map(p=>n`<option value=${p.service} ?selected=${p.service===t.service}>${it(p.service,p.label)}</option>`)}</optgroup>`:h}
        </select>
      </div>
      ${r.map(p=>this.renderArg(t,p))}
    </div>`}render(){const t=this.slotData;if(!t)return h;const e=T(t.actions),s=t.actions.some(l=>wt(l,l.entity_id?this.meta.get(l.entity_id)?.class??null:null,l.entity_id?this.meta.get(l.entity_id):void 0)),i=t.actions.some(l=>{const o=l.entity_id?this.meta.get(l.entity_id):void 0;return Jt(l,o?.class??null,o?.actions)}),a=new Set(t.actions.map(l=>l.entity_id)),r=this.entityIds.filter(l=>!a.has(l)&&this.meta.has(l)),d=(t.stop??"")!==""&&t.stop!=="00:00:00";return n`<section class="panel" aria-label="עריכת משבצת" data-slot-panel>
      <header>
        <div class="ttl">
          <span class="top"><h3>משבצת ${this.index+1} מתוך ${this.count}</h3><sw-schedule-markers .sensitive=${s} .lowering=${i}></sw-schedule-markers></span>
          <span class="sum">${re(t,this.meta)}</span>
        </div>
        <div class="tools">
          ${this.readOnly?h:n`
                ${this.canCopyDays?n`<sw-button size="sm" icon="calendar" data-slot-copy-days @click=${()=>this.fire("slot-copy-days")}>העתקה לימים…</sw-button>`:h}
                <sw-button size="sm" icon="layers" data-slot-duplicate @click=${()=>this.fire("slot-duplicate")}>שכפול</sw-button>
                <sw-button size="sm" variant="danger" icon="trash" data-slot-delete @click=${()=>this.fire("slot-delete")}>מחיקה</sw-button>
              `}
          <sw-button size="sm" variant="ghost" iconOnly icon="close" label="סגירת העריכה" @click=${()=>this.fire("slot-close")}></sw-button>
        </div>
      </header>
      ${this.locked.length?n`<div class="lockmsg" data-slot-locked><sw-icon name="lock" size="16"></sw-icon><div>${this.locked.map(l=>n`<div>${l.message}</div>`)}<div><b>לעריכה:</b> ברכיב התזמונים המקורי.</div></div></div>`:n`
            <div class="fields">
              ${this.timeField("start")} ${this.timeField("stop")}
              <div class="groups">
                ${e.length?e.map((l,o)=>this.renderGroup(l,o)):n`<div class="empty" data-slot-empty><sw-icon name="info" size="16"></sw-icon>בחרו פעולה: הוסיפו התקנים לתזמון בכפתור "בחירת התקנים".</div>`}
                ${!this.readOnly&&r.length?n`<select class="add-ent" aria-label="הוספת התקן לפעולה" data-add-entity @change=${l=>{const o=l.target;o.value&&this.addEntity(o.value),o.value=""}}>
                      <option value="">הוספת התקן למשבצת…</option>
                      ${r.map(l=>n`<option value=${l}>${this.meta.get(l)?.name??l}</option>`)}
                    </select>`:h}
              </div>
            </div>
            ${this.errors.length?n`<ul class="errs" role="status" data-slot-errors>${this.errors.map(l=>n`<li><sw-icon name="warning" size="14"></sw-icon><span>${l.message}</span></li>`)}</ul>`:h}
            ${this.canPair||this.paired?n`<div class="off">
                  <sw-toggle .checked=${this.paired} ?disabled=${this.readOnly||!this.paired&&!d} label="כיבוי בסיום החלון" @change=${l=>this.fire("pair-off",{on:l.detail.checked})}></sw-toggle>
                  <span class="unit">${d||this.paired?"מוסיף משבצת כיבוי בשעת הסיום":"נדרשת שעת סיום קבועה"}</span>
                </div>`:h}
          `}
    </section>`}};y.styles=U`
    :host {
      display: block;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
     sourceMappingURL=[^*]**/ SCHED-POLISH-2331: the header reads like the editor's side panel (R5-DEVICES-297): a heading in the heading ink, the summary
       under it, the slot's actions grouped at the end (they wrap below the title on a narrow card instead of crowding it) */
    header {
      display: flex;
      align-items: flex-start;
      gap: 8px 12px;
      flex-wrap: wrap;
    }
    .ttl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 260px;
      min-inline-size: 0;
    }
    .ttl .top {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.01em;
    }
    .sum {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      align-items: start;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-inline-size: 0;
    }
    .f > label,
    .lbl,
    .arg > label {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .pair {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .pair input {
      inline-size: 96px;
      flex: none;
    }
    .pair .unit {
      white-space: nowrap;
    }
    input,
    select {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 36px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    input[type='checkbox'] {
      inline-size: auto;
      min-block-size: 0;
      accent-color: var(--sw-accent);
    }
    input[type='time'],
    input[type='number'] {
      font-variant-numeric: tabular-nums;
    }
    input[type='range'] {
      padding: 0;
      min-block-size: 24px;
      accent-color: var(--sw-accent);
    }
    input[type='time'],
    input[type='number'] {
      direction: ltr;
      text-align: start;
    }
    input[disabled],
    select[disabled] {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .groups {
      display: flex;
      flex-direction: column;
      gap: 10px;
      grid-column: 1 / -1;
    }
    .group {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: 12px 14px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 10px;
      background: var(--sw-surface-2);
    }
    .ents {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ent {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 28px;
      padding-block: 2px;
      padding-inline: 10px 4px;
      font-weight: var(--sw-fw-medium);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      font-size: var(--sw-fs-sm);
    }
    .ent button {
      display: grid;
      place-items: center;
      inline-size: 24px;
      block-size: 24px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .ent button:hover {
        background: var(--sw-surface-3);
        color: var(--sw-text);
      }
    }
    .ent button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .arg {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .vars {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
      align-items: end;
    }
    .vars > .lbl {
      grid-column: 1 / -1;
    }
    .arg .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .arg .row input[type='number'] {
      inline-size: 84px;
      flex: none;
    }
    .unit {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .lockmsg {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    .lockmsg sw-icon {
      margin-block-start: 1px;
    }
    .errs {
      margin: 0;
      padding: 10px 12px;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .errs li {
      display: flex;
      gap: 6px;
      align-items: flex-start;
    }
    .errs sw-icon {
      flex: none;
      margin-block-start: 2px;
    }
    .off {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 12px;
      font-size: var(--sw-fs-sm);
    }
    .off b {
      font-weight: var(--sw-fw-semibold);
    }
    .add-ent {
      max-inline-size: 260px;
    }
    .empty {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 12px 14px;
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-lg);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
     sourceMappingURL=[^*]**/ mobile-native: a finger needs 44 px; the mouse keeps the denser 36 */
    @media (pointer: coarse) {
      input:not([type='range']):not([type='checkbox']),
      select {
        min-block-size: 44px;
      }
      .ent button {
        inline-size: 32px;
        block-size: 32px;
      }
    }
    @media (max-width: 640px) {
      .tools {
        inline-size: 100%;
      }
      .add-ent {
        max-inline-size: none;
      }
      .pair input {
        flex: 1;
      }
    }
  `;_([f({attribute:!1})],y.prototype,"slotData",2);_([f({type:Number})],y.prototype,"index",2);_([f({type:Number})],y.prototype,"count",2);_([f({attribute:!1})],y.prototype,"meta",2);_([f({attribute:!1})],y.prototype,"entityIds",2);_([f({type:Boolean})],y.prototype,"allowNegativeSun",2);_([f({type:Boolean})],y.prototype,"readOnly",2);_([f({attribute:!1})],y.prototype,"locked",2);_([f({attribute:!1})],y.prototype,"errors",2);_([f({type:Boolean})],y.prototype,"paired",2);_([f({type:Boolean})],y.prototype,"canPair",2);_([f({type:Boolean})],y.prototype,"canCopyDays",2);y=_([q("schedule-slot-panel")],y);var ns=Object.defineProperty,rs=Object.getOwnPropertyDescriptor,S=(t,e,s,i)=>{for(var a=i>1?void 0:i?rs(e,s):e,r=t.length-1,d;r>=0;r--)(d=t[r])&&(a=(i?d(e,s,a):d(a))||a);return i&&a&&ns(e,s,a),a};const os={cool:"קירור",heat:"חימום",heat_cool:"אוטומטי",auto:"אוטומטי",dry:"ייבוש",fan_only:"מאוורר"},vt=new Set(["cover.stop_cover","cover.set_cover_tilt_position","climate.set_fan_mode","climate.set_preset_mode","fan.set_percentage"]);let x=class extends R{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.slots=[],this.meta=new Map,this.sun=null,this.snap=15,this.allowNegativeSun=!1,this.readOnly=!1,this.selected="",this.lockedUids={},this.errorsByUid={},this.nextByUid={},this.pairOf=()=>null,this.cellError=null}fire(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}commit(t,e,s){const i=this.slots.findIndex(d=>d.uid===t.uid),a=e==="from"?_t(t.start):_t(t.stop,!0);if(s.trim()===a){this.cellError=null;return}const r=de(this.slots,i,e,s,{step:this.snap,sun:this.sun,allowNegativeSun:this.allowNegativeSun});if("error"in r){this.cellError={uid:t.uid,field:e,message:r.error};return}this.cellError=null,this.fire("slots-change",{slots:r.slots,uid:t.uid})}setService(t,e){const s=T(t.actions)[0];if(!s)return;const i=s.entities.find(d=>!!d),a=i?this.meta.get(i):void 0,r=a?.actions.find(d=>d.service===e)?.args??[];this.fire("slot-change",{slot:{...t,actions:bt(t.actions,s,e,ft(r,a))}})}setArg(t,e,s){const i=T(t.actions)[0];if(!i)return;const a={...i.data};s===void 0||s===""||typeof s=="number"&&Number.isNaN(s)?delete a[e]:a[e]=s,this.fire("slot-change",{slot:{...t,actions:bt(t.actions,i,i.service,a)}})}renderValue(t,e){const s=T(t.actions)[0];if(!s)return n`<span class="unit">—</span>`;const i=s.data,a=s.entities.find(l=>!!l),r=(a?this.meta.get(a):void 0)?.actions.find(l=>l.service===s.service)?.args??[],d=[];for(const l of r){const o=i[l.name];if(l.name==="hvac_mode"&&l.choices?.length)d.push(n`<select ?disabled=${e} aria-label="מצב פעולה" @change=${c=>this.setArg(t,"hvac_mode",c.target.value)}>
          ${l.required?h:n`<option value="" ?selected=${o===void 0}>ללא שינוי</option>`}
          ${l.choices.map(c=>n`<option value=${c} ?selected=${o===c}>${os[c]??c}</option>`)}
        </select>`);else if(l.name==="temperature")d.push(n`<input class="num" type="number" step="0.5" min=${l.min??h} max=${l.max??h} ?disabled=${e} aria-label="טמפרטורה" .value=${o===void 0?"":String(o)} @change=${c=>this.setArg(t,"temperature",c.target.value===""?void 0:Number(c.target.value))} /><span class="unit">°</span>`);else if(l.name==="brightness"||l.name==="brightness_pct"){if(l.name==="brightness_pct"&&i.brightness_pct===void 0||l.name==="brightness"&&i.brightness_pct!==void 0)continue;const c=l.name==="brightness",p=typeof o=="number"?c?Math.round(o/255*100):o:"";d.push(n`<input class="num" type="number" min="1" max="100" placeholder="בהירות" ?disabled=${e} aria-label="בהירות באחוזים" .value=${String(p)} @change=${$=>{const w=$.target.value;this.setArg(t,l.name,w===""?void 0:c?Math.round(Math.min(100,Math.max(1,Number(w)))/100*255):Math.min(100,Math.max(1,Number(w))))}} /><span class="unit">%</span>`)}else(l.name==="position"||l.name==="tilt_position"||l.name==="percentage")&&l.type==="int"&&d.push(n`<input class="num" type="number" min=${l.min??0} max=${l.max??100} ?disabled=${e} aria-label=${l.name==="position"?"מיקום":l.name==="percentage"?"עוצמה":"הטיה"} .value=${o===void 0?"":String(o)} @change=${c=>this.setArg(t,l.name,c.target.value===""?void 0:Number(c.target.value))} /><span class="unit">%</span>`)}return d.length?n`<div class="val">${d}</div>`:n`<span class="unit">—</span>`}renderRow(t,e){const s=this.slots[t.index],i=this.lockedUids[s.uid],a=this.readOnly||!!i,r=this.errorsByUid[s.uid]??[],d=T(s.actions),l=d[0],o=l?.entities.find(v=>!!v),c=(o?this.meta.get(o):void 0)?.actions??[],p=[...new Set(s.actions.map(v=>v.entity_id?this.meta.get(v.entity_id)?.name??v.entity_id:"ללא התקן"))],$=this.pairOf(t.index),w=this.cellError?.uid===s.uid?this.cellError:null;return n`<tr class="${s.uid===this.selected?"sel":""} ${r.length?"bad":""}" data-row=${s.uid} @click=${()=>this.fire("slot-select",{uid:s.uid})}>
      <td class="n" title=${r.map(v=>v.message).join(" · ")}>${r.length?n`<sw-icon name="warning" size="14" role="img" aria-label=${`משבצת ${e}: ${r.map(v=>v.message).join(" · ")}`}></sw-icon>`:e}</td>
      <td data-label="משעה">
        <input class="t ${w?.field==="from"?"err":""}" data-cell="from" ?disabled=${a} .value=${t.from} aria-label="משעה, משבצת ${e}" @change=${v=>this.commit(s,"from",v.target.value)} @keydown=${v=>v.key==="Enter"&&v.target.blur()} @click=${v=>v.stopPropagation()} />
        ${w?.field==="from"?n`<div class="msg" role="alert">${w.message}</div>`:h}
      </td>
      <td data-label="עד שעה (סוף חלון)">
        <input class="t ${w?.field==="to"?"err":""}" data-cell="to" ?disabled=${a} placeholder="ללא" .value=${t.to} aria-label="עד שעה, משבצת ${e}" @change=${v=>this.commit(s,"to",v.target.value)} @keydown=${v=>v.key==="Enter"&&v.target.blur()} @click=${v=>v.stopPropagation()} />
        ${w?.field==="to"?n`<div class="msg" role="alert">${w.message}</div>`:h}
      </td>
      <td class="act-cell" data-label="פעולה">
        ${i?n`<span class="chip lock"><sw-icon name="lock" size="12"></sw-icon>${l?B({service:l.service,data:l.data}):"לא נתמך"}</span>`:l?d.length>1?n`<span class="chip">${d.length} פעולות</span>`:n`<select ?disabled=${a||!c.length} data-cell="service" aria-label="פעולה, משבצת ${e}" @click=${v=>v.stopPropagation()} @change=${v=>this.setService(s,v.target.value)}>
                  ${c.length?h:n`<option selected>${B({service:l.service,data:l.data})}</option>`}
                  ${c.filter(v=>!vt.has(v.service)).map(v=>n`<option value=${v.service} ?selected=${v.service===l.service}>${it(v.service,v.label)}</option>`)}
                  ${c.some(v=>vt.has(v.service))?n`<optgroup label="מתקדם">${c.filter(v=>vt.has(v.service)).map(v=>n`<option value=${v.service} ?selected=${v.service===l.service}>${it(v.service,v.label)}</option>`)}</optgroup>`:h}
                </select>`:n`<span class="unit">בחרו פעולה</span>`}
        ${$!==null?n`<span class="chip" title="משבצת כיבוי בסיום">כיבוי בסיום</span>`:h}
      </td>
      <td class="val-cell" data-label="ערך" @click=${v=>v.stopPropagation()}>${d.length===1&&!i?this.renderValue(s,a):n`<span class="unit">—</span>`}</td>
      <td class="who ents" data-label="התקנים">${p.join(", ")||"—"}</td>
      <td class="next" data-label="הרצה הבאה">${this.nextByUid[s.uid]??"—"}</td>
      <td class="acts">
        ${this.readOnly?h:n`<div class="btns"><sw-button size="sm" variant="ghost" iconOnly icon="layers" label="שכפול משבצת ${e}" @click=${v=>(v.stopPropagation(),this.fire("slot-duplicate",{uid:s.uid}))}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="trash" label="מחיקת משבצת ${e}" @click=${v=>(v.stopPropagation(),this.fire("slot-delete",{uid:s.uid}))}></sw-button></div>`}
      </td>
    </tr>`}render(){const t=ce(this.slots,this.sun,this.pairOf);return n`<div class="wrap"><table data-schedule-table>
        <thead>
          <tr>
            <th>#</th>
            <th>משעה</th>
            <th>עד שעה (סוף חלון)</th>
            <th>פעולה</th>
            <th>ערך</th>
            <th>התקנים</th>
            <th>הרצה הבאה</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${t.length?t.map((e,s)=>this.renderRow(e,s+1)):n`<tr><td colspan="8" class="empty" data-table-empty>אין משבצות עדיין.${this.readOnly?"":' "משבצת חדשה" מוסיפה את הראשונה.'}</td></tr>`}
        </tbody>
      </table></div>
      ${this.readOnly?h:n`<div class="foot"><sw-button size="sm" icon="plus" data-table-add @click=${()=>this.fire("slot-add")}>משבצת חדשה</sw-button></div>`}`}};x.styles=[U`
    :host {
      display: block;
    }
     sourceMappingURL=[^*]**/ SCHED-POLISH-2331: a narrow editor column scrolls the table sideways inside the card, never the page */
    .wrap {
      overflow-x: auto;
      overscroll-behavior-x: contain;
    }
    table {
      inline-size: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: var(--sw-fs-sm);
    }
    th {
      text-align: start;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      padding: 8px;
      border-block-end: 1px solid var(--sw-border-strong);
      white-space: nowrap;
    }
    td {
      padding: 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      transition: background var(--sw-t-hover) var(--sw-ease-color);
    }
    tbody tr[data-row] {
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      tbody tr[data-row]:not(.sel):hover td {
        background: var(--sw-hover-wash);
      }
    }
    tr.sel td {
      background: var(--sw-accent-soft);
    }
    tr.bad td.n {
      color: var(--sw-danger-text);
    }
    td.n {
      color: var(--sw-text-3);
      inline-size: 32px;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
    }
    input,
    select {
      box-sizing: border-box;
      min-block-size: 34px;
      padding: 3px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      max-inline-size: 100%;
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    input.t {
      inline-size: 116px;
      direction: rtl;
      text-align: start;
      font-variant-numeric: tabular-nums;
    }
    input.t.err {
      border-color: var(--sw-danger);
    }
    input.num {
      inline-size: 68px;
      direction: ltr;
    }
    input[disabled],
    select[disabled] {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .val {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .unit {
      color: var(--sw-text-3);
    }
    .ents {
      color: var(--sw-text-2);
    }
    td.next {
      color: var(--sw-text-2);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .msg {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      margin-block-start: 4px;
    }
    .chip {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .chip.lock {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
     sourceMappingURL=[^*]**/ SCHED-POLISH-2331: the flex box is a div inside the cell - a td with display: flex leaves the table model, and its bottom rule
       stepped out of line with the rest of the row */
    .acts .btns {
      display: flex;
      gap: 2px;
      justify-content: flex-end;
    }
    td.acts {
      inline-size: 1%;
      white-space: nowrap;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-block-start: 12px;
    }
    td.empty {
      padding: 28px 16px;
      text-align: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
      cursor: default;
    }
    @media (pointer: coarse) {
      input,
      select {
        min-block-size: 44px;
      }
    }
    @media (max-width: 720px) {
      table,
      tbody {
        display: block;
      }
      thead {
        display: none;
      }
      tr {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 12px;
        padding: 12px 14px;
        margin-block-end: 10px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-lg);
        background: var(--sw-surface);
      }
      tr td,
      tbody tr[data-row]:hover td {
        background: transparent;
      }
      tr.sel {
        border-color: var(--sw-accent);
        background: var(--sw-accent-soft);
      }
      td {
        display: block;
        border: 0;
        padding: 0;
      }
      td.n,
      td.who,
      td.val-cell,
      td.next,
      td.act-cell,
      td.acts {
        grid-column: 1 / -1;
      }
      td.acts {
        inline-size: auto;
        border-block-start: 1px solid var(--sw-border);
        padding-block-start: 6px;
      }
      td.n {
        display: none;
      }
      td[data-label]::before {
        content: attr(data-label);
        display: block;
        color: var(--sw-text-2);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-semibold);
        margin-block-end: 4px;
      }
      td.next {
        white-space: normal;
      }
      input.t {
        inline-size: 100%;
      }
    }
  `,oe];S([f({attribute:!1})],x.prototype,"slots",2);S([f({attribute:!1})],x.prototype,"meta",2);S([f({attribute:!1})],x.prototype,"sun",2);S([f({type:Number})],x.prototype,"snap",2);S([f({type:Boolean})],x.prototype,"allowNegativeSun",2);S([f({type:Boolean})],x.prototype,"readOnly",2);S([f()],x.prototype,"selected",2);S([f({attribute:!1})],x.prototype,"lockedUids",2);S([f({attribute:!1})],x.prototype,"errorsByUid",2);S([f({attribute:!1})],x.prototype,"nextByUid",2);S([f({attribute:!1})],x.prototype,"pairOf",2);S([u()],x.prototype,"cellError",2);x=S([q("schedule-table-view")],x);var ls=Object.defineProperty,ds=Object.getOwnPropertyDescriptor,N=(t,e,s,i)=>{for(var a=i>1?void 0:i?ds(e,s):e,r=t.length-1,d;r>=0;r--)(d=t[r])&&(a=(i?d(e,s,a):d(a))||a);return i&&a&&ls(e,s,a),a};const cs={light:"light",switch:"power",cover:"coverOpen",climate:"activity",fan:"aperture",alarm:"shield",lock:"lock",door:"door",script:"route",scene:"sparkle",helper:"power",humidifier:"thermometer",vacuum:"move",siren:"bell",media:"volume",number:"ruler",select:"list"};let O=class extends R{constructor(){super(...arguments),this.open=!1,this.selected=[],this.entities=[],this.loading=!1,this.error="",this.picked=new Set,this.q="",this.by="area",this.wasOpen=!1}willUpdate(t){t.has("open")&&this.open&&!this.wasOpen&&(this.picked=new Set(this.selected),this.q="",this.load()),t.has("open")&&(this.wasOpen=this.open)}async load(){this.loading=!0,this.error="";try{this.entities=(await Qt()).entities}catch(t){this.error=t instanceof Error?t.message:"לא הצלחנו לטעון את ההתקנים."}this.loading=!1}toggle(t){const e=new Set(this.picked);e.has(t)?e.delete(t):e.add(t),this.picked=e}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}confirm(){const t=[...this.picked];this.dispatchEvent(new CustomEvent("confirm",{detail:{ids:t,entities:this.entities.filter(e=>this.picked.has(e.entity_id))},bubbles:!0,composed:!0}))}nameOf(t){return this.entities.find(e=>e.entity_id===t)?.name??t}render(){const t=this.q.trim().toLowerCase(),e=this.entities.filter(i=>!t||i.name.toLowerCase().includes(t)||(i.area_name??"").toLowerCase().includes(t)||i.entity_id.toLowerCase().includes(t)),s=new Map;for(const i of e){const a=this.by==="area"?i.area_name??"ללא אזור":St[i.class];s.set(a,[...s.get(a)??[],i])}return n`<sw-drawer modal ?open=${this.open} heading="בחירת התקנים" subheading="התקנים ברשותכם בלבד. התקנים שאינם ניתנים לתזמון מסומנים עם הסיבה." data-entity-picker @close=${this.close}>
      <div class="tools">
        <div class="search"><input type="search" data-picker-search placeholder="חיפוש התקן או אזור" aria-label="חיפוש התקן" .value=${this.q} @input=${i=>this.q=i.target.value} /><sw-icon name="search" size="15"></sw-icon></div>
        <div class="seg" role="group" aria-label="קיבוץ">
          <button type="button" aria-pressed=${this.by==="area"} @click=${()=>this.by="area"}>אזור</button>
          <button type="button" aria-pressed=${this.by==="class"} data-picker-by-class @click=${()=>this.by="class"}>סוג</button>
        </div>
      </div>
      <div class="chosen" data-picker-chosen>
        ${this.picked.size?[...this.picked].map(i=>n`<span class="chip">${this.nameOf(i)}<button type="button" aria-label="הסרת ${this.nameOf(i)}" @click=${()=>this.toggle(i)}><sw-icon name="close" size="12"></sw-icon></button></span>`):n`<span class="none">לא נבחר דבר</span>`}
      </div>
      ${this.loading?n`<div class="state">טוען…</div>`:this.error?n`<div class="state err">${this.error}</div>`:e.length?[...s.entries()].map(([i,a])=>n`<h4>${i}<span>${a.length}</span></h4>
                  ${a.map(r=>{const d=r.selectable||this.picked.has(r.entity_id);return n`<label class="item ${d?"":"no"}" data-picker-item=${r.entity_id}>
                      <input type="checkbox" ?disabled=${!d} .checked=${this.picked.has(r.entity_id)} @change=${()=>this.toggle(r.entity_id)} />
                      <span class="nm"><sw-icon name=${cs[r.class]} size="16"></sw-icon>${r.name}${this.by==="class"&&r.area_name?n`<small>${r.area_name}</small>`:h}</span>
                      <small class="${r.sensitive?"sens":""}">${r.sensitive?n`<sw-icon name="shield" size="12"></sw-icon> `:h}${this.by==="area"?St[r.class]:""}</small>
                      ${!r.selectable&&r.reason?n`<span class="why"><sw-icon name="lock" size="12"></sw-icon>${r.reason.message}</span>`:h}
                    </label>`})}`):n`<div class="state">לא נמצאו התקנים</div>`}
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%">
        <sw-button data-picker-cancel @click=${this.close}>ביטול</sw-button>
        <sw-button variant="primary" data-picker-ok @click=${this.confirm}>אישור (${this.picked.size})</sw-button>
      </div>
    </sw-drawer>`}};O.styles=U`
    :host {
      display: contents;
    }
    .tools {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-block-end: 10px;
    }
    .search {
      flex: 1;
      position: relative;
    }
    .search input {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 34px;
      padding: 4px 34px 4px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      font: inherit;
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .search input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .search sw-icon {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-start: 9px;
      color: var(--sw-text-3);
    }
    .seg {
      display: inline-flex;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .seg button {
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 4px 12px;
      border-radius: var(--sw-r-xs);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .chosen {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-end: 12px;
    }
    .chosen .none {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .chip button {
      display: grid;
      place-items: center;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    h4 {
      display: flex;
      justify-content: space-between;
      margin: 16px 0 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    h4 span {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    label.item {
      display: grid;
      grid-template-columns: 22px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
    }
    label.item.no {
      cursor: not-allowed;
      color: var(--sw-text-3);
    }
    label.item input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
      margin: 0;
    }
    .nm {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
    }
    .nm small {
      color: var(--sw-text-3);
    }
    .why {
      grid-column: 2 / -1;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .sens {
      color: var(--sw-purple);
    }
    .state {
      padding: 24px 0;
      text-align: center;
      color: var(--sw-text-3);
    }
    .state.err {
      color: var(--sw-danger);
    }
  `;N([f({type:Boolean,reflect:!0})],O.prototype,"open",2);N([f({attribute:!1})],O.prototype,"selected",2);N([u()],O.prototype,"entities",2);N([u()],O.prototype,"loading",2);N([u()],O.prototype,"error",2);N([u()],O.prototype,"picked",2);N([u()],O.prototype,"q",2);N([u()],O.prototype,"by",2);O=N([q("schedule-entity-picker")],O);var ps=Object.defineProperty,hs=Object.getOwnPropertyDescriptor,D=(t,e,s,i)=>{for(var a=i>1?void 0:i?hs(e,s):e,r=t.length-1,d;r>=0;r--)(d=t[r])&&(a=(i?d(e,s,a):d(a))||a);return i&&a&&ps(e,s,a),a};const us=["is","not"],vs=["above","below","is","not"];let k=class extends R{constructor(){super(...arguments),this.conditions={items:[],type:null,track:!1},this.views=[],this.sensor=null,this.canConfigure=!1,this.warnings=[],this.readOnly=!1,this.adding=!1,this.cands=[],this.loading=!1,this.q="",this.asked=!1}emit(t){const e={};for(const s of t.items)e[s.entity_id]=this.nameOf(s.entity_id);this.dispatchEvent(new CustomEvent("conditions-change",{detail:{conditions:t,names:e},bubbles:!0,composed:!0}))}get lockedIds(){return this.views.filter(t=>t.locked).map(t=>t.entity_id)}viewOf(t){return this.views.find(e=>e.entity_id===t.entity_id&&e.attribute===t.attribute&&e.match_type===t.match_type&&e.value===t.value)}nameOf(t){return this.views.find(e=>e.entity_id===t)?.name??this.cands.find(e=>e.entity_id===t)?.name??(this.sensor?.entity_id===t?this.sensor.name:t)}candOf(t){return this.cands.find(e=>e.entity_id===t)}preset(t){if(!this.sensor||this.readOnly)return;const e=Ot(this.conditions,this.sensor.entity_id);this.emit(e===t?pe(this.conditions,this.lockedIds):he(this.conditions,t,this.sensor.entity_id,this.lockedIds))}async loadCands(){if(!this.asked){this.asked=!0,this.loading=!0;try{this.cands=(await ue()).entities}catch{this.cands=[]}this.loading=!1}}willUpdate(){!this.asked&&this.conditions.items.length&&!this.readOnly&&this.loadCands()}async openAdd(){this.adding=!0,this.q="",await this.loadCands()}pick(t){this.adding=!1,this.emit(ve(this.conditions,ge(t)))}renderCondition(t,e){const s=this.viewOf(t),i=!!s?.locked,a=this.nameOf(t.entity_id);if(i)return n`<div class="cond locked" data-condition-locked=${t.entity_id}>
        <div class="nm"><sw-icon name="lock" size="14"></sw-icon>${be(t,a)}</div>
        <span class="lock">מחוץ להרשאתך</span>
      </div>`;const r=this.candOf(t.entity_id),d=r?.numeric||t.match_type==="above"||t.match_type==="below"||typeof t.value=="number",l=d?vs:us,o=fe(r??(d?void 0:{entity_id:t.entity_id,domain:t.entity_id.startsWith("sun.")?"sun":"binary_sensor",numeric:!1}));return n`<div class="cond" data-condition=${t.entity_id}>
      <div class="nm">${a}${t.attribute!=="state"?n`<small>${t.attribute}</small>`:h}${s?.readable&&s.state!==null?n`<small>כרגע: ${s.state}</small>`:h}</div>
      ${this.readOnly?h:n`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="הסרת התנאי" data-condition-remove @click=${()=>this.emit(we(this.conditions,e))}></sw-button>`}
      <div class="ctl">
        <select ?disabled=${this.readOnly} aria-label="סוג ההשוואה" data-condition-op @change=${c=>this.emit(Z(this.conditions,e,{match_type:c.target.value}))}>
          ${l.map(c=>n`<option value=${c} ?selected=${t.match_type===c}>${me[c]}</option>`)}
        </select>
        ${d?n`<input class="val" type="number" ?disabled=${this.readOnly} aria-label="ערך" data-condition-value .value=${String(t.value)} @change=${c=>this.emit(Z(this.conditions,e,{value:Number(c.target.value)}))} />`:o.length?n`<select ?disabled=${this.readOnly} aria-label="ערך" data-condition-value @change=${c=>this.emit(Z(this.conditions,e,{value:c.target.value}))}>
                ${o.some(c=>c.value===t.value)?h:n`<option value=${String(t.value)} selected>${String(t.value)}</option>`}
                ${o.map(c=>n`<option value=${c.value} ?selected=${t.value===c.value}>${c.label}</option>`)}
              </select>`:n`<input class="val" type="text" ?disabled=${this.readOnly} aria-label="ערך" data-condition-value .value=${String(t.value)} @change=${c=>this.emit(Z(this.conditions,e,{value:c.target.value}))} />`}
      </div>
    </div>`}renderAdd(){const t=this.q.trim().toLowerCase(),e=i=>({binary_sensor:0,sensor:1,input_boolean:2,sun:3})[i.domain],s=this.cands.filter(i=>!t||i.name.toLowerCase().includes(t)||i.entity_id.toLowerCase().includes(t)).sort((i,a)=>Number(a.suggested_shabbat)-Number(i.suggested_shabbat)||e(i)-e(a));return n`<div class="add" data-condition-add>
      <input type="search" placeholder="חיפוש חיישן" aria-label="חיפוש חיישן לתנאי" .value=${this.q} @input=${i=>this.q=i.target.value} />
      <div class="cands">
        ${this.loading?n`<div class="hint">טוען…</div>`:s.length?s.map(i=>n`<button type="button" class="cand" data-candidate=${i.entity_id} @click=${()=>this.pick(i)}><span>${i.name}</span><small>${i.state??""}${i.unit?` ${i.unit}`:""}</small></button>`):n`<div class="hint">לא נמצאו חיישנים</div>`}
      </div>
      <div class="row"><sw-button size="sm" @click=${()=>this.adding=!1}>ביטול</sw-button></div>
    </div>`}render(){const t=this.conditions,e=this.sensor?Ot(t,this.sensor.entity_id):null;return n`<div data-conditions>
      ${this.sensor?n`<div class="presets" role="group" aria-label="תנאים מוכנים">
            ${["only_holy_days","not_holy_days"].map(s=>n`<button type="button" class="preset" data-preset=${s} aria-pressed=${e===s} ?disabled=${this.readOnly} @click=${()=>this.preset(s)}>${ye[s]}</button>`)}
            <button type="button" class="preset" data-preset="motzash" ?disabled=${this.readOnly} @click=${()=>this.dispatchEvent(new CustomEvent("preset-motzash",{bubbles:!0,composed:!0}))}>מוצאי שבת</button>
          </div>`:this.canConfigure?n`<div class="hint" data-preset-hint>בחרו חיישן שבת וחג בהגדרות ‹ תזמונים כדי לקבל תנאים מוכנים.</div>`:h}
      <div class="list">${t.items.map((s,i)=>this.renderCondition(s,i))}</div>
      ${t.items.length>1?n`<div class="row"><span>יתקיימו</span><div class="seg" role="group" aria-label="חיבור התנאים">
            <button type="button" aria-pressed=${t.type!=="or"} data-cond-type="and" ?disabled=${this.readOnly} @click=${()=>this.emit({...t,type:"and"})}>כל התנאים</button>
            <button type="button" aria-pressed=${t.type==="or"} data-cond-type="or" ?disabled=${this.readOnly} @click=${()=>this.emit({...t,type:"or"})}>אחד מהם</button></div></div>`:h}
      ${t.items.length?n`<div class="row"><label class="check"><input type="checkbox" data-cond-track ?disabled=${this.readOnly} .checked=${t.track} @change=${s=>this.emit({...t,track:s.target.checked})} />המשך לבדוק עד סוף החלון</label></div>`:h}
      ${this.adding?this.renderAdd():this.readOnly?h:n`<div class="row"><sw-button size="sm" icon="plus" data-condition-new @click=${()=>this.openAdd()}>תנאי</sw-button></div>`}
      ${this.warnings.length?n`<ul class="warn" data-cond-warnings>${this.warnings.map(s=>n`<li>${s.message}</li>`)}</ul>`:h}
    </div>`}};k.styles=U`
    :host {
      display: block;
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-end: 10px;
    }
    .preset {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      border-radius: var(--sw-r-sm);
      padding: 4px 10px;
      min-block-size: 30px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .preset[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .preset:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      margin-block-end: 8px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cond {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px 8px;
      align-items: center;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      background: var(--sw-surface-2);
    }
    .cond.locked {
      background: var(--sw-surface-3);
    }
    .nm {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      min-inline-size: 0;
    }
    .nm small {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .ctl {
      grid-column: 1 / -1;
      display: flex;
      gap: 6px;
    }
    select,
    input {
      min-block-size: 30px;
      box-sizing: border-box;
      padding: 3px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    select {
      flex: 1;
    }
    input.val {
      flex: 1;
      direction: ltr;
      text-align: start;
    }
    select:focus,
    input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .seg {
      display: inline-flex;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .seg button {
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 3px 10px;
      border-radius: var(--sw-r-xs);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    label.check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    label.check input {
      min-block-size: 0;
      accent-color: var(--sw-accent);
    }
    .lock {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .add {
      margin-block-start: 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 8px;
      background: var(--sw-surface);
    }
    .add input {
      inline-size: 100%;
    }
    .cands {
      max-block-size: 220px;
      overflow: auto;
      margin-block-start: 6px;
    }
    .cand {
      display: flex;
      justify-content: space-between;
      align-items: center;
      inline-size: 100%;
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      padding: 7px 8px;
      border-radius: var(--sw-r-sm);
      cursor: pointer;
      color: var(--sw-text);
    }
    .cand:hover,
    .cand:focus-visible {
      background: var(--sw-accent-soft);
      outline: none;
    }
    .cand small {
      color: var(--sw-text-3);
    }
    .warn {
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `;D([f({attribute:!1})],k.prototype,"conditions",2);D([f({attribute:!1})],k.prototype,"views",2);D([f({attribute:!1})],k.prototype,"sensor",2);D([f({type:Boolean})],k.prototype,"canConfigure",2);D([f({attribute:!1})],k.prototype,"warnings",2);D([f({type:Boolean})],k.prototype,"readOnly",2);D([u()],k.prototype,"adding",2);D([u()],k.prototype,"cands",2);D([u()],k.prototype,"loading",2);D([u()],k.prototype,"q",2);k=D([q("schedule-conditions")],k);var gs=Object.defineProperty,bs=Object.getOwnPropertyDescriptor,b=(t,e,s,i)=>{for(var a=i>1?void 0:i?bs(e,s):e,r=t.length-1,d;r>=0;r--)(d=t[r])&&(a=(i?d(e,s,a):d(a))||a);return i&&a&&gs(e,s,a),a};const H=t=>({...t,path:t.path??""}),Zt="sw.schedules.editor_view",Y="sw.schedules.stash.";function fs(){try{const t=localStorage.getItem(Zt);return t==="week"||t==="day"||t==="table"?t:null}catch{return null}}function L(t,e,s){try{if(t==="get")return sessionStorage.getItem(e);t==="set"?sessionStorage.setItem(e,s??""):sessionStorage.removeItem(e)}catch{}return null}const ws={on:"power",off:"power",level:"light",climate:"thermo",cover:"blinds",secure:"shield",custom:"lock",empty:"plus"};let g=class extends R{constructor(){super(...arguments),this.scheduleId="",this.template="",this.preset="",this.entity="",this.sun=null,this.loading=!0,this.loadError="",this.forbidden=!1,this.status=null,this.schedule=null,this.draft={...Dt(),slots:[]},this.override=null,this.meta=new Map,this.lockedUids={},this.enabledNew=!0,this.view="week",this.day="sun",this.selected="",this.snap=15,this.phone=!1,this.phoneTab="board",this.preview=null,this.kavConflicts=[],this.kavSaveWithWarnings=!0,this.kavOn=!1,this.kavDry=!1,this.kavDevTest=!1,this.kavDevTestEnd="ask",this.kavDevOpen=!1,this.showErrors=!1,this.saving=!1,this.saveError="",this.note="",this.pickerOpen=!1,this.copyOpen=!1,this.copyPick=[],this.splitDialog=null,this.lowering=null,this.conflict=null,this.compareOpen=!1,this.leave=null,this.gone=!1,this.stash=null,this.nowMin=0,this.condNames={},this.chosen=[],this.baseline=Dt(),this.baseRevision="",this.previewToken=0,this.previewTimer=0,this.previewFor=null,this.stopSub=null,this.clockTimer=0,this.mq=null,this.loadedFor="",this.loadedKey="\0",this.savedOk=!1,this.onMq=t=>{this.phone=t.matches,t.matches&&this.view==="week"&&(this.view="day")},this.valCache=null,this.ebuCache=null,this.onBeforeUnload=t=>{this.dirty&&(t.preventDefault(),t.returnValue="")},this.onDocClick=t=>{if(!this.dirty||t.defaultPrevented)return;const e=t.composedPath().find(i=>i instanceof HTMLAnchorElement&&(i.getAttribute("href")??"").startsWith("#/"));if(!e)return;const s=e.getAttribute("href")??"";s.split("?")[0]!==window.location.hash.split("?")[0]&&(t.preventDefault(),t.stopPropagation(),this.leave={href:s})}}connectedCallback(){super.connectedCallback(),Ye(this),this.mq=window.matchMedia("(max-width: 767px)"),this.phone=this.mq.matches,this.mq.addEventListener("change",this.onMq),window.addEventListener("beforeunload",this.onBeforeUnload),document.addEventListener("click",this.onDocClick,!0),this.tick(),this.clockTimer=window.setInterval(()=>this.tick(),3e4),this.stopSub=xe(()=>void this.refreshRemote())}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),window.removeEventListener("beforeunload",this.onBeforeUnload),document.removeEventListener("click",this.onDocClick,!0),window.clearInterval(this.clockTimer),window.clearTimeout(this.previewTimer),this.stopSub?.(),this.stopSub=null,this.dirty&&!this.savedOk&&this.loadedFor&&L("set",Y+this.loadedFor,JSON.stringify({draft:this.currentDraft()}))}tick(){const t=new Date;this.nowMin=t.getHours()*60+t.getMinutes()}willUpdate(){this.valCache=null,this.ebuCache=null;const t=`${this.scheduleId}|${this.template}|${this.preset}`;t!==this.loadedKey&&(this.loadedKey=t,this.loadedFor=this.creating?"new":this.scheduleId,this.load())}get creating(){return!this.scheduleId||this.scheduleId==="new"}get sunBase(){return this.sun??($e()?Xt:He)}get sunNow(){return this.preview?ke({slots:this.draft.slots},this.preview.upcoming,this.sunBase):this.sunBase}get allowNegativeSun(){return!!this.status?.capabilities.negative_sun_offset}get opts(){return{step:this.snap,sun:this.sunNow,allowNegativeSun:this.allowNegativeSun}}get readOnly(){return this.creating?!this.status?.can.manage||this.status.writable===!1:!this.schedule||!this.schedule.can.edit}get work(){return this.override?this.override.slots:this.draft.slots}currentDraft(){return{...this.draft,name:(this.draft.name??"").trim()===""?this.creating?"":this.draft.name??"":this.draft.name,slots:E(this.draft.slots)}}get dirty(){return this.loading||!this.loadedFor?!1:!!this.override||!Ct(this.currentDraft(),this.baseline)}get classOf(){return t=>nt(this.meta,t)}get validation(){return this.valCache??=this.computeValidation()}computeValidation(){const t=Et(this.currentDraft(),{creating:this.creating,meta:this.meta,sun:this.sunNow,original:this.baseline,lockedConditions:this.schedule?.conditions.items??[]});let e=t.errors.map(H);const s=t.warnings.map(H);if(this.override){const a=Et({...this.currentDraft(),weekdays:Nt(this.override.days),slots:E(this.override.slots)},{creating:!1,meta:this.meta,sun:this.sunNow,original:this.baseline,lockedConditions:this.schedule?.conditions.items??[]});e=[...e,...a.errors.map(H).filter(r=>r.path.startsWith("slots")).map(r=>({...r,path:`override.${r.path}`}))]}const i=this.previewOfThisDraft;for(const a of(i?.errors??[]).map(H))e.some(r=>r.path===a.path&&r.message===a.message)||(e=[...e,a]);for(const a of(i?.warnings??[]).map(H))s.some(r=>r.path===a.path&&r.message===a.message)||s.push(a);return{errors:e,warnings:s}}get previewOfThisDraft(){return this.preview&&this.previewFor&&Ct(this.previewFor,this.currentDraft())?this.preview:null}errorsByUid(){return this.ebuCache??=this.computeErrorsByUid()}computeErrorsByUid(){const t={};for(const e of this.validation.errors){const s=e.path.startsWith("override."),i=tt(s?e.path.slice(9):e.path),a=i>=0?s?this.override?.slots[i]:this.draft.slots[i]:void 0;a&&(t[a.uid]??=[]).push(e)}return t}async load(){this.loading=!0,this.loadError="",this.forbidden=!1,this.override=null,this.selected="",this.conflict=null,this.gone=!1,this.savedOk=!1,this.previewToken+=1,this.preview=null,this.previewFor=null,this.stash=null;const t=this.scheduleId,e=this.loadedKey;try{const[s,i,a]=await Promise.all([ze().catch(()=>null),this.creating?Promise.resolve(null):At(t),Qt().catch(()=>null)]);if(e!==this.loadedKey)return;this.status=s,this.snap=s?.settings.snap_minutes??15;const r=a?.entities??[],d=fs();this.view=this.phone?"day":d??"week";let l=It(i);l=Pt(r,l),this.meta=l,i?this.adopt(i):this.startNew(s,l);const o=L("get",Y+this.loadedFor);if(o)try{this.stash=JSON.parse(o)}catch{this.stash=null}const c=I(this.draft.weekdays)??[],p=W[new Date().getDay()];this.day=c.includes(p)?p:c[0]??"sun",this.loading=!1,this.schedulePreview(0),this.creating&&this.draft.slots.length&&!rt(this.draft.slots).length&&!this.readOnly&&(this.pickerOpen=!0)}catch(s){if(e!==this.loadedKey)return;this.loading=!1,s instanceof ot&&(s.status===403||s.status===404)&&(this.forbidden=!0),this.loadError=et(s)}}adopt(t){this.schedule=t,this.baseRevision=t.revision;const e=Tt(t),s=e.slots.map(P),i={};t.slots.forEach((a,r)=>{a.supported||(i[s[r].uid]=a.unsupported.length?a.unsupported:[{code:"unsupported_content",message:"התזמון כולל תוכן שהמערכת אינה מציגה במלואו."}])}),this.lockedUids=i,this.chosen=[],this.meta=It(t,new Map(this.meta)),this.draft={...e,slots:V(s,this.sunNow).slots},this.baseline=this.currentDraft(),this.override=null,this.conflict=null,this.draft.slots.some(a=>a.uid===this.selected)||(this.selected="")}startNew(t,e){const s=_e().params,i=t?.settings.shabbat_sensor?.entity_id??null,a=t?.settings.default_repeat??"repeat";let r=null;if(s.get("draft")){const o=L("get",Ft);if(L("del",Ft),o)try{const c=JSON.parse(o);r={...c,slots:c.slots}}catch{r=null}}if(!r){r=(Se(this.template||s.get("template"))??Oe.find(p=>p.id==="blank")).build({sensor:i,defaultRepeat:a,now:new Date});const c=this.preset||s.get("preset");r=De(r,c==="only_holy_days"||c==="not_holy_days"?c:null,i)}this.schedule=null,this.baseRevision="",this.meta=e,this.lockedUids={};const d=this.entity||s.get("entity")||"";this.chosen=d&&e.has(d)?[d]:[];const l=r.slots.map(P);this.draft={...r,slots:V(l,this.sunNow).slots},this.baseline=this.currentDraft(),this.enabledNew=!0}async refreshRemote(){if(!(this.creating||!this.scheduleId||this.loading||this.saving))try{const t=await At(this.scheduleId);if(t.revision===this.baseRevision)return;this.dirty?this.conflict={current:t}:this.adopt(t)}catch(t){t instanceof ot&&t.status===404&&(this.gone=!0)}}cancel(){const t=this.creating||!this.scheduleId?"#/devices/schedules":`#/devices/schedules/${encodeURIComponent(this.scheduleId)}`;if(this.dirty){this.leave={href:t};return}this.go(t)}go(t){this.savedOk=!0,L("del",Y+this.loadedFor),t.startsWith("#")?Mt(t.slice(1).split("?")[0],Object.fromEntries(new URLSearchParams(t.split("?")[1]??""))):window.location.assign(t)}mark(){this.valCache=null,this.ebuCache=null,this.saveError="",this.savedOk=!1,this.previewToken+=1,this.schedulePreview()}setWork(t,e){const s=V(t,this.sunNow).slots;this.override?this.override={...this.override,slots:s}:this.draft={...this.draft,slots:s},e&&(this.selected=e),this.mark()}patch(t){this.draft={...this.draft,...t},this.mark()}idxOf(t,e=this.work){return e.findIndex(s=>s.uid===t)}grid(){return this.renderRoot.querySelector("sw-schedule-grid")}say(t){this.grid()?.announce(t)}onCreate(t,e){const s=this.work,i=Ce(s,t,e,this.opts,P);if(!i)return this.say("אין מקום פנוי כאן.");const a=i.slots[i.index].uid,r=Lt(E(s),this.meta,l=>F(l,this.sunNow)?.start??0,this.chosen),d=i.slots.map(l=>l.uid===a?{...l,actions:r}:l);this.setWork(d,a),this.reveal(),this.say(`נוצרה משבצת ${(i.index??0)+1}.`)}onAddButton(){const t=this.work,e=Ee(t,this.opts,480,P);if(!e)return this.say("אין מקום למשבצת נוספת.");const s=e.slots[e.index].uid,i=Lt(E(t),this.meta,a=>F(a,this.sunNow)?.start??0,this.chosen);this.setWork(e.slots.map(a=>a.uid===s?{...a,actions:a.actions.length?a.actions:i}:a),s),this.reveal()}reveal(){this.phone&&this.updateComplete.then(()=>this.renderRoot.querySelector("[data-panel-card]")?.scrollIntoView({block:"nearest",behavior:"smooth"}))}onGrid(t,e){const s=this.work,i=String(e.key??""),a=this.idxOf(i,s);switch(t){case"slot-select":this.selected=i,this.reveal();break;case"slot-create":this.onCreate(Number(e.from),Number(e.to));break;case"slot-move":{if(a<0)return;const r=Bt(s,a,Number(e.delta),this.opts);this.setWork(r.slots,i);break}case"slot-resize":{if(a<0)return;const r=Ne(s,a,e.edge,Number(e.minute),{...this.opts,detach:!!e.detach});this.setWork(r.slots,i);break}case"slot-remove":a>=0&&this.removeAt(a);break;case"row-add":this.override||(this.patch({weekdays:jt(this.draft.weekdays,e.row)}),this.day=e.row);break;case"row-select":W.includes(e.row)&&(this.day=e.row);break}}removeAt(t){const e=this.work[t];e&&(this.setWork(Ut(this.work,t)),this.selected===e.uid&&(this.selected=""),this.say("המשבצת נמחקה."))}onSlotChange(t){const e=this.idxOf(t.uid);if(e<0)return;const s=this.work.slice();s[e]=t,this.setWork(s,t.uid)}onDuplicate(t){const e=this.idxOf(t);if(e<0)return;const s=Ae(this.work,e,this.opts,P);if(!s)return this.say("אין מקום לשכפול.");this.setWork(s.slots,s.slots[s.index].uid)}onPairOff(t){const e=this.idxOf(this.selected);if(e<0)return;const s=this.work,i=E(s);if(!t){const d=lt(i,e);d!==null&&this.setWork(Ut(s,d),s[e].uid);return}const a=Rt(i[e]);if(!a)return;const r=[...s,P(a)];if(V(r,this.sunNow).slots.some((d,l,o)=>o.slice(l+1).some((c,p)=>this.overlapIdx(o[l],c,p)))){this.saveError="",this.note="אין מקום לכיבוי בסיום: קיימת משבצת בשעה הזו.";return}this.setWork(r,s[e].uid)}overlapIdx(t,e,s){const i=F(t,this.sunNow),a=F(e,this.sunNow);return!!i&&!!a&&i.start<a.end&&a.start<i.end}setView(t){this.view=t;try{localStorage.setItem(Zt,t)}catch{}}get canSplit(){if(this.creating||this.readOnly||this.override)return!1;const t=I(this.draft.weekdays);return!!t&&t.length>=2}startOverride(t){this.override={days:t,slots:Ie(this.draft.slots)},this.selected="",this.mark()}cancelOverride(){this.override=null,this.selected="",this.mark()}openCopyDays(){this.copyPick=this.override?[...this.override.days]:[],this.copyOpen=!0}applyCopyDays(){if(this.override){const t=I(this.draft.weekdays)??[],e=t.filter(s=>this.copyPick.includes(s));e.length&&e.length<t.length&&(this.override={...this.override,days:e})}else if(this.copyPick.length){const t=I(this.draft.weekdays)??[];this.patch({weekdays:Nt([...new Set([...t,...this.copyPick])])})}this.copyOpen=!1}get slotEntityIds(){return[...new Set([...rt(this.draft.slots),...this.override?rt(this.override.slots):[]])]}get entityIds(){return[...new Set([...this.slotEntityIds,...this.chosen.filter(t=>this.meta.has(t))])]}onPicked(t,e){this.pickerOpen=!1;const s=Pt(e,new Map(this.meta));this.meta=s;const i=this.slotEntityIds,a=t.filter(l=>!i.includes(l)).map(l=>s.get(l)).filter(l=>!!l),r=i.filter(l=>!t.includes(l)),d=l=>r.reduce((o,c)=>dt(o,c),Vt(l,a));this.chosen=t,this.draft={...this.draft,slots:d(this.draft.slots)},this.override&&(this.override={...this.override,slots:d(this.override.slots)}),this.mark()}removeEntity(t){this.chosen=this.chosen.filter(e=>e!==t),this.draft={...this.draft,slots:dt(this.draft.slots,t)},this.override&&(this.override={...this.override,slots:dt(this.override.slots,t)}),this.mark()}schedulePreview(t=450){window.clearTimeout(this.previewTimer),this.previewTimer=window.setTimeout(()=>void this.runPreview(),t)}async runPreview(){if(this.loading||this.readOnly&&!this.creating){this.preview=null,this.previewFor=null;return}const t=this.currentDraft();if(!t.slots.length){this.preview=null,this.previewFor=null;return}const e=++this.previewToken;try{const s=await qt(t,this.creating?null:this.scheduleId,6);e===this.previewToken&&(this.previewFor=t,this.preview=s),Xe("schedule",this.creating?null:this.scheduleId,t).then(i=>{e===this.previewToken&&(this.kavOn=!!i.enabled,this.kavDevTest=!!i.device_test,this.kavDevTestEnd=i.device_test_end??"ask",this.kavConflicts=i.enabled?i.conflicts:[],this.kavSaveWithWarnings=i.save_with_warnings!==!1)}).catch(()=>{e===this.previewToken&&(this.kavConflicts=[],this.kavOn=!1,this.kavDevTest=!1)})}catch{e===this.previewToken&&(this.preview=null,this.previewFor=null)}}sensitiveSig(t){return t.slots.flatMap(e=>e.actions.filter(s=>wt(s,nt(this.meta,s.entity_id))).map(s=>`${s.service}|${s.entity_id}`)).sort().join(",")}async onSave(){if(this.readOnly||this.saving)return;this.showErrors=!0,this.note="";const{errors:t}=this.validation;if(t.length){const e=t.find(s=>tt(s.path.replace(/^override\./,""))>=0);if(e){const a=(e.path.startsWith("override.")?this.override?.slots:this.draft.slots)?.[tt(e.path.replace(/^override\./,""))];a&&(this.selected=a.uid)}this.phoneTab="settings";return}if(this.override){const e=E(this.override.slots);if(JSON.stringify(e)===JSON.stringify(E(this.draft.slots)))this.override=null;else{this.splitDialog={name:`${(this.draft.name??"").trim()||"תזמון"} · ${this.override.days.map(s=>K[s]).join(", ")}`};return}}await this.persist()}async persist(t=!1,e=null){const s=this.currentDraft();this.saving=!0,this.saveError="";try{const i=await qt(s,this.creating?null:this.scheduleId,6);if(this.previewFor=s,this.preview=i,!i.valid){this.showErrors=!0,this.saving=!1;return}const a=G(s,this.meta),r=this.creating||this.sensitiveSig(s)!==this.sensitiveSig(this.baseline);if(!t&&(i.requires.confirm_lowering||a.lowering||a.sensitive&&r||i.requires.alarm_code)){this.lowering={summary:a,needsCode:i.requires.alarm_code,kind:"save",error:""},this.saving=!1;return}const d={confirm_lowering:a.lowering||i.requires.confirm_lowering,alarm_code:e};if(this.creating){const l=await Pe(s,{enabled:this.enabledNew,...d});this.lowering=null,this.savedOk=!0,this.dispatchEvent(new CustomEvent("saved",{detail:{id:"schedule"in l?l.schedule.id:""},bubbles:!0,composed:!0})),"schedule"in l?(this.note="התזמון נוצר.",this.go(`#/devices/schedules/${encodeURIComponent(l.schedule.id)}`)):(this.note=l.message,this.go("#/devices/schedules"))}else{const l=await ct(this.scheduleId,s,this.baseRevision,d);this.lowering=null,this.savedOk=!0,this.adopt(l.schedule),this.note="השינויים נשמרו.",this.dispatchEvent(new CustomEvent("saved",{detail:{id:l.schedule.id},bubbles:!0,composed:!0})),this.go(`#/devices/schedules/${encodeURIComponent(l.schedule.id)}`)}}catch(i){this.handleSaveError(i,"save")}this.saving=!1}handleSaveError(t,e){if(t instanceof ot){const s=t.body.details??{};if(t.code==="schedule_changed"&&s.current){this.lowering=null,this.conflict={current:s.current};return}if(t.code==="lowering_confirmation_required"||t.code==="code_required"){this.lowering={summary:G(this.currentDraft(),this.meta),needsCode:t.code==="code_required",kind:e,error:""};return}if(t.code==="wrong_code"&&this.lowering){this.lowering={...this.lowering,error:t.message};return}if(t.code==="validation"||t.code==="slots_overlap"){const i=s.errors??[];this.previewFor=this.currentDraft(),this.preview={...this.preview??{valid:!1,warnings:[],upcoming:[],conditional:!1,sensitive:!1,lowering:!1,requires:{sensitive_permission:!1,confirm_lowering:!1,alarm_code:!1}},valid:!1,errors:i.length?i:[{path:"",code:t.code,message:t.message}]},this.showErrors=!0,this.lowering=null;return}}this.lowering&&(this.lowering={...this.lowering,error:et(t)}),this.saveError=et(t)}async persistSplit(t,e=!1,s=null){if(!this.override)return;const i=Te(this.currentDraft(),this.baseline,{days:this.override.days,slots:E(this.override.slots)});if(!i.ok){this.saveError=i.error,this.splitDialog=null;return}const a=[G(i.created,this.meta),G(i.originalUpdate??i.afterSplit,this.meta)],r=a.some(o=>o.lowering);if(!e&&(r||a.some(o=>o.sensitive&&this.sensitiveSig(i.created)!==this.sensitiveSig(this.baseline)))){const o={entities:[...new Set(a.flatMap(c=>c.entities))],kinds:[...new Set(a.flatMap(c=>c.kinds))],times:a.map(c=>c.times).filter(Boolean).join(", "),sensitive:a.some(c=>c.sensitive),lowering:r};this.splitDialog={name:t},this.lowering={summary:o,needsCode:!1,kind:"split",error:""};return}this.saving=!0,this.saveError="";const d={confirm_lowering:r,alarm_code:s};let l="split";try{const o=await Me(this.scheduleId,this.baseRevision,i.days,t.trim()||null);l="update",i.originalUpdate&&await ct(o.original.id,i.originalUpdate,o.original.revision,d),await ct(o.created.id,{...i.created,name:t.trim()||o.created.name},o.created.revision,d),this.lowering=null,this.splitDialog=null,this.savedOk=!0,this.override=null,this.dispatchEvent(new CustomEvent("saved",{detail:{id:o.original.id},bubbles:!0,composed:!0})),this.go(`#/devices/schedules/${encodeURIComponent(o.original.id)}`)}catch(o){this.splitDialog=null,this.handleSaveError(o,"split"),l==="update"&&(this.saveError=`הפיצול בוצע, אך שמירת השינויים בתזמון נכשלה: ${this.saveError||et(o)} בדקו את שני התזמונים ברשימה.`)}this.saving=!1}onLoweringConfirm(t){this.lowering?.kind==="split"?this.persistSplit(this.splitDialog?.name??"",!0,t):this.persist(!0,t)}keepMine(){this.conflict&&(this.baseRevision=this.conflict.current.revision,this.conflict=null,this.onSave())}loadLatest(){this.conflict&&(this.adopt(this.conflict.current),this.mark())}restoreStash(){if(!this.stash)return;const t=this.stash.draft;this.draft={...t,slots:V(t.slots.map(P),this.sunNow).slots},this.stash=null,L("del",Y+this.loadedFor),this.mark()}dropStash(){this.stash=null,L("del",Y+this.loadedFor)}slotView(t,e,s){const i=F(t,this.sunNow)??{start:0,end:1},a=Le(t,this.classOf),r=T(t.actions),d=!!this.lockedUids[t.uid],l=r[0],o=l?`${B({service:l.service,data:l.data})}${r.length>1?` +${r.length-1}`:""}`:"בחרו פעולה",c=pt(t.start),p=t.stop?pt(t.stop):null,$=A=>Ve(A).replace(/ ([+−])/," ‎$1"),w=`${$(c)}${t.stop?`–${t.stop==="00:00:00"?"00:00":$(p)}`:""}`,v=t.actions.some(A=>{const yt=A.entity_id?this.meta.get(A.entity_id):void 0;return Jt(A,yt?.class??null,yt?.actions)}),mt=t.actions.some(A=>wt(A,nt(this.meta,A.entity_id))),te=!!this.errorsByUid()[t.uid]?.length;return{key:t.uid,start:i.start,end:i.end,category:d?"custom":a,title:o,timeLabel:w,icon:ws[a],point:t.stop==null,sunStart:Wt(t.start),sunEnd:Wt(t.stop),locked:d,sensitive:mt,lowering:v,invalid:this.showErrors&&te,conflict:this.kavConflictUids().has(t.uid),aria:`משבצת ${e+1} מתוך ${s}: ${o}, ${w}${v?", פותח או מנטרל":mt?", פעולה רגישה":""}${d?", לקריאה בלבד":""}`}}kavConflictUids(){const t=new Set;for(const e of this.kavConflicts){const s=ut(e),i=s===null?void 0:this.draft.slots[s];i&&t.add(i.uid)}return t}moveConflictSlot(t){const e=ut(t),s=Kt(t),i=e===null?void 0:this.draft.slots[e];if(!i||!s||this.override)return;const a=this.draft.slots.findIndex(d=>d.uid===i.uid),r=Bt(this.draft.slots,a,s.delta,this.opts);this.setWork(r.slots,i.uid)}slotViews(t){return t.map((e,s)=>this.slotView(e,s,t.length))}gridRows(){const t=je(this.draft.weekdays),e=W[new Date().getDay()],s=this.override;return t?t.map(i=>{const a=!!s&&s.days.includes(i.day),r=a?s.slots:this.draft.slots;return{key:i.day,label:M[i.day],sub:i.active?i.day===e?"היום":s?a?"פיצול":"מקושר":i.linked>1?"מקושר":"":i.day===e?"היום":"",today:i.day===e,active:i.active,slots:i.active?this.slotViews(r):[],addLabel:`הוספת ${M[i.day]} לתזמון`,readOnly:!!s&&!a}}):[{key:"all",label:st(this.draft.weekdays),active:!0,slots:this.slotViews(this.draft.slots)}]}nextByUid(){const t={},e=this.preview?.upcoming??[],s=this.draft.conditions.items.length>0;for(const i of e){const a=this.draft.slots[i.slot_index];a&&!t[a.uid]&&(t[a.uid]=`${ht(i.at)}${s?" · בתנאי":""}`)}return t}renderBanners(){const t=this.schedule?.read_only?.reasons??[];return n`
      ${this.readOnly&&!this.creating&&this.schedule?n`<div class="banner warn" data-readonly-banner><sw-icon name="lock" size="16"></sw-icon><div>מצב צפייה.${t.length?n` ${t.map(e=>n`<div>${e.message}</div>`)}`:h}</div></div>`:this.creating&&this.readOnly?n`<div class="banner warn" data-readonly-banner><sw-icon name="lock" size="16"></sw-icon><div>שמירת תזמונים אינה זמינה כרגע.</div></div>`:h}
      ${this.gone?n`<div class="banner err" data-gone-banner><sw-icon name="warning" size="16"></sw-icon><span>התזמון נמחק במקום אחר.</span></div>`:h}
      ${this.conflict?n`<div class="banner err" role="alert" data-conflict-banner>
            <sw-icon name="warning" size="16"></sw-icon>
            <span><b>התזמון שונה במקום אחר</b> (גרסה ${this.baseRevision.slice(0,4)} ← ${this.conflict.current.revision.slice(0,4)}). השינויים שלכם עדיין לא נשמרו.</span>
            <span class="sp"></span>
            <sw-button size="sm" data-conflict-compare @click=${()=>this.compareOpen=!0}>השוואה</sw-button>
            <sw-button size="sm" data-conflict-latest @click=${()=>this.loadLatest()}>טעינת הגרסה החדשה</sw-button>
            <sw-button size="sm" variant="danger" data-conflict-mine @click=${()=>this.keepMine()}>שמירה בכל זאת</sw-button>
          </div>`:h}
      ${this.saveError?n`<div class="banner err" role="alert" data-save-error><sw-icon name="warning" size="16"></sw-icon><span><b>השמירה לא הושלמה.</b> ${this.saveError}</span><span class="sp"></span><sw-button size="sm" data-save-retry @click=${()=>this.onSave()}>ניסיון נוסף</sw-button></div>`:h}
      ${this.note?n`<div class="banner ok" role="status" data-note>${this.note}</div>`:h}
      ${this.stash?n`<div class="banner info" data-stash-banner><sw-icon name="info" size="16"></sw-icon><span>נמצאה טיוטה שלא נשמרה מהעריכה הקודמת.</span><span class="sp"></span><sw-button size="sm" data-stash-restore @click=${()=>this.restoreStash()}>שחזור</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.dropStash()}>התעלמות</sw-button></div>`:h}
      ${this.override?n`<div class="banner info" data-override-banner><sw-icon name="link" size="16"></sw-icon><span>עורכים רק את ${this.override.days.map(e=>M[e]).join(", ")}. בשמירה יפוצל תזמון נפרד ליום הזה.</span><span class="sp"></span><sw-button size="sm" data-override-cancel @click=${()=>this.cancelOverride()}>ביטול הפיצול</sw-button></div>`:h}
      ${this.status&&!this.status.writable&&!this.readOnly?n`<div class="banner warn"><sw-icon name="offline" size="16"></sw-icon><span>שמירת שינויים אינה זמינה כרגע.</span></div>`:h}`}renderLegend(){return n`<div class="legend" aria-label="מקרא צבעים">
      ${Ze.map(t=>n`<span class="k"><span class="sw c-${t.cat}"></span>${t.label}</span>`)}
      <span class="k"><sw-icon name="clock" size="12"></sw-icon>זריחה / שקיעה (משוער)</span>
      <span class="k"><span class="now"></span>עכשיו</span>
    </div>`}renderBoard(){const t=this.gridRows(),e=I(this.draft.weekdays),s=e?.length??0,i=this.readOnly,a=t.find(o=>o.key===this.day)??t[0],r=this.phone&&this.view==="day",d=this.work,l=this.override?this.override.days:null;return n`<div class="card" data-board>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="תצוגה">
          <button type="button" data-view-btn="week" aria-pressed=${this.view==="week"} @click=${()=>this.setView("week")}><sw-icon name="calendar" size="14"></sw-icon>שבוע</button>
          <button type="button" data-view-btn="day" aria-pressed=${this.view==="day"} @click=${()=>this.setView("day")}><sw-icon name="clock" size="14"></sw-icon>יום</button>
          <button type="button" data-view-btn="table" aria-pressed=${this.view==="table"} @click=${()=>this.setView("table")}><sw-icon name="list" size="14"></sw-icon>טבלה</button>
        </div>
        <span class="sp"></span>
        ${this.view==="table"?h:n`<label class="snap">הצמדה <select data-snap aria-label="הצמדת זמן" .value=${String(this.snap)} @change=${o=>this.snap=Number(o.target.value)}>
              ${[5,15,30].map(o=>n`<option value=${o} ?selected=${this.snap===o}>${o} דק׳</option>`)}
            </select></label>`}
        ${i||this.view==="table"?h:n`<sw-button size="sm" icon="plus" data-add-slot @click=${()=>this.onAddButton()}>משבצת</sw-button>`}
      </div>
      ${this.view==="table"?h:this.renderLegend()}
      ${this.view==="table"||!e?h:n`<div class="linked">
            ${s>1&&!this.override?n`<span class="chip" data-linked-chip><sw-icon name="link" size="12"></sw-icon>${s} ימים מקושרים</span><span>כל שינוי במשבצת חל על כל הימים: ${st(this.draft.weekdays)}.</span>`:h}
            ${this.canSplit?n`<sw-button size="sm" icon="link" data-split-start @click=${()=>this.startOverride([this.day])}>עריכה רק ל${M[this.day]}…</sw-button>`:h}
            ${l?n`<span class="chip" data-override-chip>עורכים: ${l.map(o=>K[o]).join(", ")}</span>`:h}
          </div>`}
      ${this.view==="day"&&e?n`<div class="dayrow" role="group" aria-label="בחירת יום">${t.map(o=>n`<button type="button" class=${o.active?"":"off"} data-day-btn=${o.key} aria-pressed=${this.day===o.key} @click=${()=>this.day=o.key}><b>${K[o.key]}</b><small>${o.today?"היום":o.active?"בתזמון":"לא בתזמון"}</small></button>`)}</div>`:h}
      ${this.view==="table"?n`<schedule-table-view
            .slots=${d}
            .meta=${this.meta}
            .sun=${this.sunNow}
            .snap=${this.snap}
            .allowNegativeSun=${this.allowNegativeSun}
            .readOnly=${i}
            .selected=${this.selected}
            .lockedUids=${this.lockedUids}
            .errorsByUid=${this.errorsByUid()}
            .nextByUid=${this.nextByUid()}
            .pairOf=${o=>lt(E(d),o)}
            @slots-change=${o=>this.setWork(o.detail.slots,o.detail.uid)}
            @slot-change=${o=>this.onSlotChange(o.detail.slot)}
            @slot-select=${o=>this.selected=o.detail.uid}
            @slot-delete=${o=>this.removeAt(this.idxOf(o.detail.uid))}
            @slot-duplicate=${o=>this.onDuplicate(o.detail.uid)}
            @slot-add=${()=>this.onAddButton()}
          ></schedule-table-view>`:n`<sw-schedule-grid
            data-grid
            .rows=${this.view==="day"&&a?[a]:t}
            .snap=${this.snap}
            .editable=${!i}
            .sun=${this.sunNow}
            .now=${this.nowMin}
            .selected=${this.selected}
            .orientation=${r?"vertical":"horizontal"}
            @slot-select=${o=>this.onGrid("slot-select",o.detail)}
            @slot-create=${o=>this.onGrid("slot-create",o.detail)}
            @slot-move=${o=>this.onGrid("slot-move",o.detail)}
            @slot-resize=${o=>this.onGrid("slot-resize",o.detail)}
            @slot-remove=${o=>this.onGrid("slot-remove",o.detail)}
            @row-add=${o=>this.onGrid("row-add",o.detail)}
            @row-select=${o=>this.onGrid("row-select",o.detail)}
          ></sw-schedule-grid>
          ${i?h:n`<div class="foot">גררו על ציר ריק ליצירה · גררו משבצת להזזה · משכו קצה לשינוי אורך · הצמדה ל־${this.snap} דקות · הקצה העבה הוא רגע הביצוע</div>`}`}
    </div>`}renderPanel(){const t=this.idxOf(this.selected),e=t>=0?this.work[t]:null;if(!e)return h;const s=E(this.work),i=lt(s,t)!==null,a=this.errorsByUid()[e.uid]??[];return n`<div class="card panelcard" data-panel-card>
      <schedule-slot-panel
        .slotData=${e}
        .index=${t}
        .count=${this.work.length}
        .meta=${this.meta}
        .entityIds=${this.entityIds}
        .allowNegativeSun=${this.allowNegativeSun}
        .readOnly=${this.readOnly}
        .locked=${this.lockedUids[e.uid]??[]}
        .errors=${a}
        .paired=${i}
        .canPair=${!!Rt(s[t])}
        .canCopyDays=${!!I(this.draft.weekdays)}
        @slot-change=${r=>this.onSlotChange(r.detail.slot)}
        @slot-delete=${()=>this.removeAt(t)}
        @slot-duplicate=${()=>this.onDuplicate(e.uid)}
        @slot-copy-days=${()=>this.openCopyDays()}
        @slot-close=${()=>this.selected=""}
        @pair-off=${r=>this.onPairOff(r.detail.on)}
      ></schedule-slot-panel>
    </div>`}renderKavConflicts(){const t=this.kavConflicts;return!t.length||this.readOnly?h:n`<div class="kav-vbox" role="status" data-kav-conflicts><b><sw-icon name="warning" size="16"></sw-icon>${Gt(t.length)}<small>· ${this.kavSaveWithWarnings?"אפשר לשמור עם אזהרות":"יש לטפל באזהרות לפני השמירה"}</small></b>
      ${t.map(e=>n`<div class="kav-iss" data-kav-conflict=${e.other.id}><b>${e.title}</b><span>${e.detail}</span>
        ${(()=>{const s=Kt(e),i=ut(e),a=i===null?void 0:this.draft.slots[i],r=!!a&&pt(a.start)?.kind==="fixed";return s&&r&&!this.override&&!this.readOnly?n`<sw-button size="sm" data-kav-move-slot @click=${()=>this.moveConflictSlot(e)}>הזזת המשבצת ל־${s.to}</sw-button>`:h})()}
        <sw-button size="sm" data-kav-open-other @click=${()=>Mt(e.other.kind==="schedule"?`/devices/schedules/${encodeURIComponent(e.other.id)}/edit`:`/devices/automations/${encodeURIComponent(e.other.id)}`)}>${e.other.kind==="schedule"?"פתיחת התזמון":"פתיחת האוטומציה"}</sw-button></div>`)}
    </div>`}renderSide(){const t=this.validation,e=this.readOnly,s=this.draft,i=I(s.weekdays),a=this.entityIds,r=this.preview?.upcoming?.length?this.preview.upcoming:this.schedule?.upcoming?.length?this.schedule.upcoming:Be(this.currentDraft(),new Date,this.sunNow),d=s.conditions.items.length>0,l=this.status?.settings.shabbat_sensor??null,o=t.warnings.filter(p=>p.path.startsWith("conditions")),c=p=>p.summary??this.slotSummaryText(p.slot_index);return n`<aside class="card side" data-side>
      ${this.renderKavConflicts()}
      <div class="status ${t.errors.length&&this.showErrors?"bad":t.errors.length?"":"ok"}" data-validation-status style=${t.errors.length&&!this.showErrors?"display:none":""}>
        <sw-icon name=${t.errors.length?"warning":"check"} size="16"></sw-icon>
        ${t.errors.length?n`<ul>${t.errors.map(p=>n`<li><button type="button" @click=${()=>this.jumpTo(p)}>${p.message}</button></li>`)}</ul>`:n`<span>${e?"התזמון תקין.":"התזמון תקין ומוכן לשמירה."}${t.warnings.filter(p=>!p.path.startsWith("conditions")).map(p=>n`<div>${p.message}</div>`)}</span>`}
      </div>
      <div class="sec">
        <h4>פרטים ${this.schedule?.sensitive||this.entityIds.some(p=>this.meta.get(p)?.sensitive)?n`<span class="chip sens"><sw-icon name="shield" size="12"></sw-icon>רגיש</span>`:h}</h4>
        <div class="field"><label for="name">שם</label><input id="name" type="text" data-editor-name maxlength="80" ?disabled=${e} .value=${s.name??""} placeholder=${this.creating?"שם התזמון":""} @input=${p=>this.patch({name:p.target.value})} /></div>
        ${this.creating&&!e?n`<div class="field"><sw-toggle .checked=${this.enabledNew} label="התזמון פעיל" @change=${p=>this.enabledNew=p.detail.checked}></sw-toggle></div>`:h}
        ${s.tags.length||this.status?.capabilities.tags?n`<div class="tags" data-tags>${s.tags.map(p=>n`<span class="chip">${p}</span>`)}</div>`:h}
      </div>
      <div class="sec" data-devices>
        <h4>התקנים <small>(${a.length})</small></h4>
        <div class="tags">${a.map(p=>n`<span class="ent">${this.meta.get(p)?.name??p}${e?h:n`<button type="button" aria-label="הסרת ${this.meta.get(p)?.name??p}" @click=${()=>this.removeEntity(p)}><sw-icon name="close" size="12"></sw-icon></button>`}</span>`)}</div>
        ${e?h:n`<div style="margin-block-start:8px"><sw-button size="sm" icon="plus" data-open-picker @click=${()=>this.pickerOpen=!0}>בחירת התקנים…</sw-button></div>`}
      </div>
      <div class="sec" data-days>
        <h4>ימים</h4>
        <div class="days" role="group" aria-label="ימי התזמון">
          ${W.map(p=>n`<button type="button" data-day-chip=${p} aria-pressed=${!!i?.includes(p)} aria-label=${M[p]} ?disabled=${e||!!this.override} @click=${()=>this.patch({weekdays:jt(s.weekdays,p)})}>${K[p]}</button>`)}
        </div>
        ${i?h:n`<div class="chip">${st(s.weekdays)}</div>`}
        ${e?h:n`<div class="quick">
          <button type="button" data-days-preset="daily" ?disabled=${!!this.override} @click=${()=>this.patch({weekdays:["daily"]})}>כל יום</button>
          <button type="button" data-days-preset="work" ?disabled=${!!this.override} @click=${()=>this.patch({weekdays:["sun","mon","tue","wed","thu"]})}>א׳–ה׳</button>
          <button type="button" data-days-preset="weekend" ?disabled=${!!this.override} @click=${()=>this.patch({weekdays:["fri","sat"]})}>סוף שבוע</button>
        </div>`}
      </div>
      <div class="sec" data-repeat>
        <h4>חזרה</h4>
        <div class="repeat" role="group" aria-label="חזרה">
          ${["repeat","pause","single"].map(p=>n`<button type="button" data-repeat-btn=${p} aria-pressed=${s.repeat===p} ?disabled=${e} @click=${()=>this.patch({repeat:p})}>${{repeat:"חוזר",pause:"פעם אחת, מושהה",single:"פעם אחת, נמחק"}[p]}</button>`)}
        </div>
        ${s.repeat==="single"?n`<div class="hint" style="color:var(--sw-warning-text)" data-single-warning>התזמון יימחק אחרי ההרצה האחרונה.</div>`:h}
      </div>
      <div class="sec" data-period>
        <h4>תקופה</h4>
        <div class="dates">
          <div class="field"><label for="from">מתאריך</label><input id="from" type="date" lang=${gt()} data-date-from ?disabled=${e} .value=${s.start_date??""} @change=${p=>this.patch({start_date:p.target.value||null})} /></div>
          <div class="field"><label for="to">עד תאריך</label><input id="to" type="date" lang=${gt()} data-date-to ?disabled=${e} .value=${s.end_date??""} @change=${p=>this.patch({end_date:p.target.value||null})} /></div>
        </div>
      </div>
      <div class="sec" data-conditions-sec>
        <h4>תנאים <small>${d?"":"ללא תנאים"}</small></h4>
        <schedule-conditions
          .conditions=${s.conditions}
          .views=${this.schedule?.conditions.items??[]}
          .sensor=${l}
          .canConfigure=${!!this.status?.can.configure}
          .warnings=${o}
          .readOnly=${e}
          @conditions-change=${p=>{p.detail.names&&(this.condNames={...this.condNames,...p.detail.names}),this.patch({conditions:p.detail.conditions})}}
          @preset-motzash=${()=>this.applyMotzash()}
        ></schedule-conditions>
      </div>
      <div class="sec" data-upcoming>
        <h4>ההרצות הבאות</h4>
        ${r.length?n`<ul class="runs">${r.slice(0,5).map(p=>n`<li><span>${ht(p.at)}${d?n` <span class="cond">· בתנאי</span>`:h}</span><span>${c(p)}</span></li>`)}</ul>`:n`<div class="hint">אין הרצה קרובה.</div>`}
      </div>
    </aside>`}condView(){const t=this.draft.conditions,e=this.status?.settings.shabbat_sensor?.entity_id??null,s={...this.condNames};for(const i of this.schedule?.conditions.items??[])s[i.entity_id]=i.name;return this.status?.settings.shabbat_sensor&&(s[this.status.settings.shabbat_sensor.entity_id]=this.status.settings.shabbat_sensor.name),{items:t.items.map(i=>({...i,name:s[i.entity_id]??i.entity_id,readable:!0,state:null,available:null,locked:!1})),type:t.type,track:t.track,uniform:!0,summary:Re(t,s,e),preset:Ue(t,e)}}slotSummaryText(t){const e=this.draft.slots[t];if(!e)return"";const s=T(e.actions)[0];return s?`${B({service:s.service,data:s.data})} · ${s.entities.map(i=>i?this.meta.get(i)?.name??i:"").join(", ")}`:""}applyMotzash(){const t=this.status?.settings.shabbat_sensor?.entity_id;if(!t||this.readOnly)return;const e=qe(t),s={weekdays:e.weekdays,conditions:e.conditions};if(!this.draft.slots.length){const i=P({start:e.start,stop:null,actions:[]});s.slots=Vt([{...i,intent:{kind:"off"}}],this.entityIds.map(a=>this.meta.get(a)).filter(a=>!!a))}this.override=null,this.patch(s)}jumpTo(t){const e=t.path.startsWith("override."),s=tt(t.path.replace(/^override\./,"")),i=e?this.override?.slots:this.draft.slots;s>=0&&i?.[s]&&(this.selected=i[s].uid,this.phoneTab="board",this.reveal())}renderDialogs(){const t=this.conflict?We(this.currentDraft(),Tt(this.conflict.current),i=>i?this.meta.get(i)?.name??i:"ללא התקן",st):[],e=I(this.draft.weekdays)??[],s=new Set(e);return n`
      <schedule-entity-picker ?open=${this.pickerOpen} .selected=${this.entityIds} @close=${()=>this.pickerOpen=!1} @confirm=${i=>this.onPicked(i.detail.ids,i.detail.entities)}></schedule-entity-picker>
      <schedule-lowering-dialog
        ?open=${!!this.lowering}
        .summary=${this.lowering?.summary??{entities:[],kinds:[],times:"",sensitive:!0,lowering:!0}}
        .needsCode=${this.lowering?.needsCode??!1}
        .busy=${this.saving}
        .error=${this.lowering?.error??""}
        @confirm=${i=>this.onLoweringConfirm(i.detail.alarm_code)}
        @close=${()=>this.lowering=null}
      ></schedule-lowering-dialog>
      <sw-dialog ?open=${!!this.splitDialog&&!this.lowering} heading="פיצול התזמון" data-split-dialog @close=${()=>this.splitDialog=null}>
        ${this.override?n`<div>נפצל לשני תזמונים: <b>${this.override.days.map(i=>M[i]).join(", ")}</b> יהיו תזמון נפרד, ו<b>שאר הימים</b> יישארו בתזמון הנוכחי. שני התזמונים יכללו את אותם התקנים, תנאים ותקופה.</div>
              <div class="field" style="margin-block-start:10px"><label for="split-name">שם התזמון החדש</label><input id="split-name" type="text" data-split-name style="inline-size:100%" .value=${this.splitDialog?.name??""} @input=${i=>this.splitDialog={name:i.target.value}} /></div>`:h}
        <div slot="footer" style="display:contents">
          <sw-button ?disabled=${this.saving} @click=${()=>this.splitDialog=null}>ביטול</sw-button>
          <sw-button variant="primary" data-split-ok ?disabled=${this.saving} @click=${()=>void this.persistSplit(this.splitDialog?.name??"")}>${this.saving?"מפצל…":"פיצול ושמירה"}</sw-button>
        </div>
      </sw-dialog>
      <sw-dialog ?open=${this.copyOpen} heading=${this.override?"העתקת הסידור לימים":"העתקה לימים"} data-copy-dialog @close=${()=>this.copyOpen=!1}>
        <div class="days" role="group" aria-label="ימים">
          ${W.map(i=>{const a=s.has(i),r=this.copyPick.includes(i)||!this.override&&a,d=this.override?!a:a;return n`<button type="button" data-copy-day=${i} aria-pressed=${r} ?disabled=${d} aria-label=${M[i]} @click=${()=>this.copyPick=this.copyPick.includes(i)?this.copyPick.filter(l=>l!==i):[...this.copyPick,i]}>${K[i]}</button>`})}
        </div>
        <div class="hint">${this.override?"הימים שיקבלו את הסידור הזה (כולם יפוצלו יחד לתזמון נפרד).":"הימים שנוספים לתזמון יקבלו את אותן משבצות, כמו שאר הימים המקושרים."}</div>
        <div slot="footer" style="display:contents">
          <sw-button @click=${()=>this.copyOpen=!1}>ביטול</sw-button>
          <sw-button variant="primary" data-copy-ok @click=${()=>this.applyCopyDays()}>אישור</sw-button>
        </div>
      </sw-dialog>
      <sw-dialog ?open=${this.kavDry} heading="בדיקה בלי הפעלה" data-kav-dry-dialog @close=${()=>this.kavDry=!1}>
        <div class="hint">לא מופעל דבר. כך התזמון יפעל בפעמים הקרובות לפי מה שמוצג עכשיו, כולל שינויים שעוד לא נשמרו.</div>
        ${(this.preview?.upcoming??[]).length?n`<ul class="runs">${(this.preview?.upcoming??[]).slice(0,10).map(i=>n`<li><span>${ht(i.at)}</span><span>${i.summary??this.slotSummaryText(i.slot_index)}</span></li>`)}</ul>`:n`<div>אין הרצה קרובה.</div>`}
        ${this.kavConflicts.length?n`<div class="hint" data-kav-dry-conflicts>${Gt(this.kavConflicts.length)} בהתנגשות עם פריטים אחרים (מוצגות בתיבה שמעל הלוח).</div>`:h}
        <div slot="footer" style="display:contents"><sw-button variant="primary" @click=${()=>this.kavDry=!1}>סגירה</sw-button></div>
      </sw-dialog>
      <sw-dialog ?open=${this.kavDevOpen} heading="בדיקה על ההתקן" data-kav-devtest-dialog @close=${()=>this.kavDevOpen=!1}>
        ${this.kavDevOpen?n`<kav-device-test source="schedule" .itemId=${this.scheduleId} .draft=${this.currentDraft()} .flags=${{device_test_end:this.kavDevTestEnd}}
          @test-close=${()=>this.kavDevOpen=!1}></kav-device-test>`:h}
      </sw-dialog>
      <sw-dialog ?open=${this.compareOpen} heading="השוואה לגרסה החדשה" data-compare-dialog @close=${()=>this.compareOpen=!1}>
        ${t.length?n`<table style="inline-size:100%;border-collapse:collapse;font-size:var(--sw-fs-sm)">
              <thead><tr><th style="text-align:start;padding:4px">שדה</th><th style="text-align:start;padding:4px">אצלכם</th><th style="text-align:start;padding:4px">בגרסה החדשה</th></tr></thead>
              <tbody>${t.map(i=>n`<tr style="vertical-align:top"><td style="padding:4px;font-weight:600">${i.label}</td><td style="padding:4px;white-space:pre-line">${i.mine}</td><td style="padding:4px;white-space:pre-line">${i.theirs}</td></tr>`)}</tbody>
            </table>`:n`<div>אין הבדלים בתוכן.</div>`}
        <div slot="footer" style="display:contents"><sw-button variant="primary" @click=${()=>this.compareOpen=!1}>סגירה</sw-button></div>
      </sw-dialog>
      <sw-dialog ?open=${!!this.leave} heading="יש שינויים שלא נשמרו" data-leave-dialog @close=${()=>this.leave=null}>
        <div>אם תצאו עכשיו, השינויים שערכתם יאבדו.</div>
        <div slot="footer" style="display:contents">
          <sw-button data-leave-stay @click=${()=>this.leave=null}>הישארות</sw-button>
          <sw-button variant="danger" data-leave-go @click=${()=>this.leave&&this.go(this.leave.href)}>יציאה בלי לשמור</sw-button>
        </div>
      </sw-dialog>`}render(){if(this.loading)return n`<sw-page wide heading="עריכת תזמון"><sw-state-panel state="loading" data-editor-state="loading"></sw-state-panel></sw-page>`;if(this.forbidden||this.loadError&&!this.schedule&&!this.creating)return n`<sw-page wide heading="עריכת תזמון" crumbs="תזמונים|עריכה"><sw-state-panel icon="calendar" data-editor-state=${this.forbidden?"forbidden":"error"} state=${this.forbidden?"forbidden":"error"} heading=${this.forbidden?"התזמון לא נמצא":""} hint=${this.forbidden?"ייתכן שנמחק, או שאינו בהרשאתכם.":this.loadError} actionLabel=${this.forbidden?"":"נסה שוב"} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;if(this.creating&&!this.status?.can.manage&&this.status)return n`<sw-page wide heading="תזמון חדש" crumbs="תזמונים|חדש"><sw-state-panel data-editor-state="forbidden" state="forbidden" hint="אין הרשאה ליצור תזמונים."></sw-state-panel></sw-page>`;const t=(this.draft.name??"").trim()||(this.schedule?.display_name??(this.creating?"תזמון חדש":"תזמון")),e=this.readOnly,s=this.entityIds.some(i=>this.meta.get(i)?.sensitive)||!!this.schedule?.sensitive;return n`<sw-page wide heading=${t} crumbs=${`תזמונים|${this.creating?"חדש":"עריכה"}`} data-editor data-editor-mode=${e?"view":this.creating?"new":"edit"}>
      <div slot="actions" class="actions">
        ${this.schedule?n`<span class="ver" title="גרסה">גרסה ${this.schedule.revision.slice(0,4)}</span>`:h}
        <schedule-condition-chip data-condition-chip .conditions=${this.condView()}></schedule-condition-chip>
        ${s?n`<sw-schedule-markers data-sensitive-badge .sensitive=${!0} .lowering=${G(this.currentDraft(),this.meta).lowering}></sw-schedule-markers>`:h}
        ${this.kavOn&&!e?n`<sw-button icon="play" data-kav-dry @click=${()=>this.kavDry=!0}>בדיקה בלי הפעלה</sw-button>`:h}
        ${this.kavDevTest&&!e&&!this.creating?n`<sw-button icon="play" data-kav-devtest @click=${()=>this.kavDevOpen=!0}>בדיקה על ההתקן</sw-button>`:h}
        <sw-button data-editor-cancel @click=${()=>this.cancel()}>${e?"חזרה":"ביטול"}</sw-button>
        ${e?h:this.kavConflicts.length?n`<sw-button icon="warning" data-editor-save data-editor-save-warnings ?disabled=${!this.dirty||this.saving||!this.kavSaveWithWarnings} @click=${()=>void this.onSave()}>${this.saving?"שומר…":"שמירה עם אזהרות"}</sw-button>`:n`<sw-button variant="primary" icon="check" data-editor-save ?disabled=${!this.dirty||this.saving} @click=${()=>void this.onSave()}>${this.saving?"שומר…":"שמירה"}</sw-button>`}
      </div>
      ${this.renderBanners()}
      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected=${this.phoneTab==="board"} data-phone-tab="board" @click=${()=>this.phoneTab="board"}>לוח זמנים</button>
        <button type="button" role="tab" aria-selected=${this.phoneTab==="settings"} data-phone-tab="settings" @click=${()=>this.phoneTab="settings"}>הגדרות</button>
      </div>
      <div class="layout" data-tab=${this.phoneTab}>
        <div class="col boardcol">${this.renderBoard()}${this.renderPanel()}</div>
        ${this.renderSide()}
      </div>
      ${this.renderDialogs()}
    </sw-page>`}};g.styles=[...Fe,Ke,Ge,U`
     sourceMappingURL=[^*]**/ KAV079-295: the conflict box of the schedule editor (mockup r079 state 7) */
    .kav-vbox { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: var(--sw-r-lg); margin-block-end: 10px;
      background: color-mix(in srgb, var(--dv-warning) 10%, transparent); border: 1px solid color-mix(in srgb, var(--dv-warning) 35%, transparent); }
    .kav-vbox > b { display: flex; gap: 8px; align-items: center; }
    .kav-vbox > b small { font-weight: 400; color: var(--dv-text-2, var(--sw-text-2)); }
    .kav-iss { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
    .kav-iss span { font-size: var(--sw-fs-sm); color: var(--dv-text-2, var(--sw-text-2)); }
    :host {
      display: block;
      min-block-size: 100%;
    }
    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .ver {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-pill);
      padding: 1px 8px;
      font-family: var(--sw-font-mono);
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      border: 1px solid transparent;
    }
    .banner .sp {
      flex: 1;
      min-inline-size: 8px;
    }
    .banner.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, transparent);
    }
    .banner.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      border-color: color-mix(in srgb, var(--sw-danger) 40%, transparent);
    }
    .banner.info {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .banner.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .banner ul {
      margin: 0;
      padding-inline-start: 18px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 14px;
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-inline-size: 0;
    }
     sourceMappingURL=[^*]**/ R5-DEVICES-297: the editor's panels are the top step (shadow 2, larger radius) */
    .card {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-2xl);
      padding: 16px 18px;
      box-shadow: var(--sw-shadow-2);
      min-inline-size: 0;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 10px;
    }
    .toolbar .sp {
      flex: 1;
    }
    .seg {
      display: inline-flex;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      padding: 5px 14px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      cursor: pointer;
      min-block-size: 36px;
      transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
    }
    .seg button:active {
      transform: scale(var(--sw-press-scale, 1));
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      font-weight: var(--sw-fw-bold);
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
    }
    label.snap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    select,
    input[type='text'],
    input[type='date'] {
      min-block-size: 32px;
      box-sizing: border-box;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    select:focus,
    input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      align-items: center;
      margin-block-end: 8px;
    }
    .legend .k {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .legend .sw {
      inline-size: 14px;
      block-size: 10px;
      border-radius: 3px;
      border-inline-start: 4px solid var(--c);
      background: var(--bg);
    }
    .legend .now {
      display: inline-block;
      inline-size: 14px;
      block-size: 2px;
      background: var(--sw-danger);
    }
     sourceMappingURL=[^*]**/ DU1: the same state tokens as sw-schedule-grid's --sc-* knobs, so the legend and the grid agree in every scheme and skin */
    .c-on {
      --c: var(--sw-success-text);
      --bg: color-mix(in srgb, var(--sw-success) 16%, transparent);
    }
    .c-off {
      --c: var(--sw-text-2);
      --bg: color-mix(in srgb, var(--sw-text-3) 15%, transparent);
    }
    .c-level {
      --c: var(--sw-warning-text);
      --bg: color-mix(in srgb, var(--sw-warning) 18%, transparent);
    }
    .c-climate {
      --c: var(--sw-accent-text);
      --bg: color-mix(in srgb, var(--sw-accent) 14%, transparent);
    }
    .c-cover {
      --c: var(--sw-circuit-6);
      --bg: color-mix(in srgb, var(--sw-circuit-6) 16%, transparent);
    }
    .c-secure {
      --c: var(--sw-purple);
      --bg: color-mix(in srgb, var(--sw-purple) 15%, transparent);
    }
    .linked {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 9px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .chip.sens {
      background: rgba(139, 92, 246, 0.14);
      color: var(--sw-purple);
    }
    .chip.warn {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .foot {
      margin-block-start: 8px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .dayrow {
      display: flex;
      gap: 6px;
      margin-block-end: 10px;
    }
    .dayrow button {
      flex: 1;
      min-block-size: 46px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      border-radius: var(--sw-r-md);
      font: inherit;
      color: var(--sw-text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }
    .dayrow button b {
      font-size: var(--sw-fs-md);
    }
    .dayrow button small {
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
    }
    .dayrow button[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .dayrow button[aria-pressed='true'] small {
      color: rgba(255, 255, 255, 0.85);
    }
    .dayrow button.off {
      border-style: dashed;
      color: var(--sw-text-3);
    }
     sourceMappingURL=[^*]**/ ------------------------------------------------------------------ side */
     sourceMappingURL=[^*]**/ R5-DEVICES-297 loop 2: the side panel's section titles are headings (lg/700, heading ink), not grey labels */
    .side h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.01em;
    }
    .side h4 small {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .sec {
      padding-block: 14px;
      border-block-start: 1px solid var(--sw-border);
    }
    .sec:first-child {
      border-block-start: 0;
      padding-block-start: 0;
    }
    .status {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      margin-block-end: 14px;
    }
    .status.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .status.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .status ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .status button {
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-align: start;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-block-end: 8px;
    }
    .field > label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .field input[type='text'] {
      inline-size: 100%;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ent {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-sm);
    }
    .ent button {
      display: grid;
      place-items: center;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    .ent button:hover {
      background: var(--sw-border);
      color: var(--sw-text);
    }
    .days {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-block-end: 8px;
    }
    .days button {
      inline-size: 34px;
      block-size: 34px;
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      color: var(--sw-text);
    }
    .days button[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .days button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .quick {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .quick button {
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: var(--sw-r-sm);
      padding: 4px 10px;
      min-block-size: 30px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      color: var(--sw-text);
    }
    .quick button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 6px;
    }
    .repeat {
      display: flex;
    }
    .repeat button {
      flex: 1;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 6px 4px;
      cursor: pointer;
      color: var(--sw-text);
    }
    .repeat button:first-child {
      border-start-start-radius: var(--sw-r-sm);
      border-end-start-radius: var(--sw-r-sm);
    }
    .repeat button:last-child {
      border-start-end-radius: var(--sw-r-sm);
      border-end-end-radius: var(--sw-r-sm);
    }
    .repeat button[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .dates .field {
      margin: 0;
    }
    .dates input {
      inline-size: 100%;
    }
    .runs {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .runs li {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      padding: 6px 10px;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
    }
    .runs li span:last-child {
      color: var(--sw-text-2);
    }
    .runs .cond {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .tabs {
      display: none;
    }
    .panelcard {
      margin-block-start: 14px;
    }
    .empty-board {
      padding: 26px 12px;
      text-align: center;
      color: var(--sw-text-3);
    }
    .weekhead {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    @media (max-width: 1100px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 767px) {
      .tabs {
        display: flex;
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        overflow: hidden;
      }
      .tabs button {
        flex: 1;
        border: 0;
        background: none;
        font: inherit;
        font-weight: var(--sw-fw-medium);
        padding: 10px;
        color: var(--sw-text-2);
        cursor: pointer;
      }
      .tabs button[aria-selected='true'] {
        background: var(--sw-accent);
        color: var(--sw-text-inverse);
      }
      .layout[data-tab='board'] .side,
      .layout[data-tab='settings'] .boardcol {
        display: none;
      }
      .card {
        padding: 12px;
      }
      .toolbar .seg button {
        padding: 5px 9px;
      }
    }
  `];b([f()],g.prototype,"scheduleId",2);b([f()],g.prototype,"template",2);b([f()],g.prototype,"preset",2);b([f()],g.prototype,"entity",2);b([f({attribute:!1})],g.prototype,"sun",2);b([u()],g.prototype,"loading",2);b([u()],g.prototype,"loadError",2);b([u()],g.prototype,"forbidden",2);b([u()],g.prototype,"status",2);b([u()],g.prototype,"schedule",2);b([u()],g.prototype,"draft",2);b([u()],g.prototype,"override",2);b([u()],g.prototype,"meta",2);b([u()],g.prototype,"lockedUids",2);b([u()],g.prototype,"enabledNew",2);b([u()],g.prototype,"view",2);b([u()],g.prototype,"day",2);b([u()],g.prototype,"selected",2);b([u()],g.prototype,"snap",2);b([u()],g.prototype,"phone",2);b([u()],g.prototype,"phoneTab",2);b([u()],g.prototype,"preview",2);b([u()],g.prototype,"kavConflicts",2);b([u()],g.prototype,"kavSaveWithWarnings",2);b([u()],g.prototype,"kavOn",2);b([u()],g.prototype,"kavDry",2);b([u()],g.prototype,"kavDevTest",2);b([u()],g.prototype,"kavDevTestEnd",2);b([u()],g.prototype,"kavDevOpen",2);b([u()],g.prototype,"showErrors",2);b([u()],g.prototype,"saving",2);b([u()],g.prototype,"saveError",2);b([u()],g.prototype,"note",2);b([u()],g.prototype,"pickerOpen",2);b([u()],g.prototype,"copyOpen",2);b([u()],g.prototype,"copyPick",2);b([u()],g.prototype,"splitDialog",2);b([u()],g.prototype,"lowering",2);b([u()],g.prototype,"conflict",2);b([u()],g.prototype,"compareOpen",2);b([u()],g.prototype,"leave",2);b([u()],g.prototype,"gone",2);b([u()],g.prototype,"stash",2);b([u()],g.prototype,"nowMin",2);b([u()],g.prototype,"condNames",2);b([u()],g.prototype,"chosen",2);g=b([q("schedule-editor")],g);export{g as ScheduleEditor};
