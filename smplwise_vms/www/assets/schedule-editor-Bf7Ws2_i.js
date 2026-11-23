import{a4 as Z,g as q,aw as f,j as v,i as W,cx as z,A as u,b as r,bb as Ot,k as F,ea as ft,a0 as bt,aK as oe,a1 as le,a as ot,m as Q,a9 as de,W as St,cO as ce,pt as he,py as pe,pz as ue}from"./index-BYRaM0w7.js";import{K as ve}from"./editor-guards-CEHbVbIV.js";import{T as se,e as j,$ as ie,C as Ct,n as ge,M as we,_ as me,Z as Dt,G as fe,l as be,E as Et,r as I,D as V,a3 as Nt,a4 as lt,a5 as At,a6 as Pt,j as K,a0 as ye,a7 as dt,a8 as $e,p as ct,a2 as tt,V as R,w as ht,a as xe,d as ke,c as ze,i as _e}from"./schedules-IphjVG-n.js";import{C as Oe,a as Se,b as Mt,d as pt,c as N,D as et,m as st,o as It,t as Tt,e as Ce,f as yt,g as $t,r as De,h as L,i as Ee,j as rt,k as xt,l as ae,n as Ne,p as Lt,q as Ae,u as Pe,v as Rt,w as Me,x as Ie,y as Te,z as Le,A as Re,B as Ue,E as Be,F as it,G as je,H as A,I as Ut,J as ut,K as Bt,L as jt,M as at,N as qt,O as Wt,P as vt,Q as T,R as G,S as Ft,T as qe,U as We,V as Fe,W as Ve,X as Vt,Y as H,Z as Ke,_ as Kt,$ as Ge,a0 as Gt,a1 as Ht,a2 as He,a3 as Ye,a4 as gt,a5 as Y,a6 as Xe,s as Je,a7 as Yt,a8 as Ze,a9 as Qe,aa as Xt,ab as ts}from"./schedule-create-dialog-Dbzh6ks1.js";import"./schedules-week-view-boebor7G.js";import{t as a}from"./automation-DgQK6O0g.js";import{b as es}from"./bubble-chrome-BtjbJxHL.js";import{a as ss}from"./activate-keys-CrBsenYs.js";import{DEMO_SUN as is}from"./schedules-mock-DdYzJNts.js";import{a as as}from"./glass-bnFXhDA8.js";import{d as ns,c as wt,a as Jt,w as Zt}from"./automation-ext-dialogs-DnyRjw8D.js";import{a as Qt,b as U,s as kt,d as nt}from"./safe-storage-BOOiiGOc.js";import"./sw-logo-art-PLtEZJxU.js";import"./memo-CyxK7byc.js";import"./confirm-words-CIzDMVUQ.js";import"./schedules-logic-CizQGI3S.js";import"./automations-D4qdJMEM.js";var rs=Object.defineProperty,os=Object.getOwnPropertyDescriptor,O=(t,e,s,i)=>{for(var n=i>1?void 0:i?os(e,s):e,o=t.length-1,c;o>=0;o--)(c=t[o])&&(n=(i?c(e,s,n):c(n))||n);return i&&n&&rs(e,s,n),n};const te={thermo:Z`<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>`,sun:Z`<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>`,fan:Z`<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 9 3.5 6.5 5.2 4.7 6.5 6.5 10 10.6 11.2M13.6 12c4.4 0 6.9 3 5.2 5.5-1.3 1.8-4.8 0-6-4.1M12 13.6C12 18 15 20.5 17.5 18.8c1.8-1.3 0-4.8-4.1-6"/>`,blinds:Z`<path d="M4 4h16M4 8h16M4 12h16M4 16h9M12 16v5"/>`},B=(t,e=14)=>t in te?r`<svg class="ic" width=${e} height=${e} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${te[t]}</svg>`:r`<sw-icon .name=${t} size=${e}></sw-icon>`;let y=class extends W{constructor(){super(...arguments),this.rows=[],this.snap=15,this.editable=!1,this.sun=null,this.now=null,this.selected="",this.orientation="horizontal",this.compact=!1,this.sunNote=z("משוער להיום"),this.ghost=null,this.live="",this.drag=null,this.trackW=0,this.ro=null,this.onDown=t=>{if(t.button!==0)return;const e=t.target;if(!this.editable){const h=e.closest(".slot");h?.dataset.key&&this.emit("slot-select",{key:h.dataset.key,row:h.dataset.row??""});return}const s=e.closest(".track");if(!s)return;const i=this.rows.find(h=>h.key===s.dataset.track);if(!i||!i.active||i.readOnly||e.closest(".add"))return;const n=e.closest(".slot"),o=e.closest("[data-handle]");if(t.pointerType==="touch"&&this.vertical&&!o)return;const c=s.getBoundingClientRect(),d=this.minuteAt(t,c);let l;if(n){const h=i.slots.find(k=>k.key===n.dataset.key);if(!h)return;l={kind:o?o.dataset.handle:"move",row:i.key,key:h.key,pointerId:t.pointerId,rect:c,anchor:d,x0:t.clientX,y0:t.clientY,orig:{start:h.start,end:h.end},locked:!!h.locked,point:!!h.point,moved:!1}}else l={kind:"create",row:i.key,key:null,pointerId:t.pointerId,rect:c,anchor:d,x0:t.clientX,y0:t.clientY,orig:null,moved:!1};this.drag=l,t.currentTarget.setPointerCapture(t.pointerId),l.kind!=="move"&&t.preventDefault()},this.onMove=t=>{const e=this.drag;if(!e||t.pointerId!==e.pointerId||!e.moved&&Math.hypot(t.clientX-e.x0,t.clientY-e.y0)<4)return;e.moved=!0;const s=this.rows.find(l=>l.key===e.row);if(!s)return;const i=this.minuteAt(t,e.rect),{spans:n,points:o}=this.spansOf(s),c=this.snap;if(e.kind==="create"){const l=Se(n,e.anchor,i,c);this.ghost=l?{key:null,row:e.row,start:l.start,end:l.end,kind:"create"}:null;return}const d=s.slots.findIndex(l=>l.key===e.key);if(!(d<0||!e.orig||e.locked))if(e.kind==="move"){const l=Mt(n,d,i-e.anchor,c);this.ghost={key:e.key,row:e.row,start:l,end:l+(e.orig.end-e.orig.start),kind:"move",point:e.point}}else{const l=pt(n,o,d,e.kind,i,c,t.altKey);this.ghost=e.kind==="end"?{key:e.key,row:e.row,start:e.orig.start,end:l,kind:"end"}:{key:e.key,row:e.row,start:l,end:e.orig.end,kind:"start"}}},this.onUp=t=>{const e=this.drag;if(!e||t.pointerId!==e.pointerId)return;this.drag=null;const s=this.ghost;if(this.ghost=null,!e.moved){e.kind==="create"?this.emit("slot-create",{row:e.row,from:e.anchor,to:e.anchor+60}):e.key&&this.emit("slot-select",{key:e.key,row:e.row});return}s&&(e.kind==="create"?this.emit("slot-create",{row:e.row,from:s.start,to:s.end}):e.kind==="move"&&e.orig?s.start!==e.orig.start?this.emit("slot-move",{key:e.key,row:e.row,delta:s.start-e.orig.start}):this.emit("slot-select",{key:e.key,row:e.row}):(e.kind==="start"||e.kind==="end")&&this.emit("slot-resize",{key:e.key,row:e.row,edge:e.kind,minute:e.kind==="start"?s.start:s.end,detach:t.altKey}))},this.onCancel=()=>{this.drag=null,this.ghost=null},this.onKey=t=>{const e=t.target.closest(".slot");if(!e)return;const s=e.dataset.key??"",i=e.dataset.row??"",n=this.rows.find(h=>h.key===i),o=n?.slots.find(h=>h.key===s);if(!n||!o)return;if(t.key==="Escape"&&this.drag){this.onCancel();return}const c=this.vertical?["ArrowUp","ArrowDown"]:["ArrowLeft","ArrowRight"],d=this.vertical?["ArrowLeft","ArrowRight"]:["ArrowUp","ArrowDown"],l=t.key==="ArrowRight"||t.key==="ArrowDown";if(t.key==="Enter"||t.key===" ")t.preventDefault(),this.emit("slot-select",{key:s,row:i});else if(c.includes(t.key)){if(t.preventDefault(),!this.editable||n.readOnly||o.locked)return;const h=this.snap*(l?1:-1),{spans:p,points:k}=this.spansOf(n),b=n.slots.findIndex(g=>g.key===s);t.shiftKey&&!o.point?(this.emit("slot-resize",{key:s,row:i,edge:"end",minute:o.end+h,detach:t.altKey}),this.announce(z("סיום {time}",{time:N(pt(p,k,b,"end",o.end+h,this.snap,t.altKey))}))):(t.ctrlKey||t.metaKey)&&!o.point?(this.emit("slot-resize",{key:s,row:i,edge:"start",minute:o.start+h,detach:t.altKey}),this.announce(z("התחלה {time}",{time:N(pt(p,k,b,"start",o.start+h,this.snap,t.altKey))}))):(this.emit("slot-move",{key:s,row:i,delta:h}),this.announce(z("התחלה {time}",{time:N(Mt(p,b,h,this.snap))})))}else if(t.key==="Delete"||t.key==="Backspace")t.preventDefault(),this.editable&&!n.readOnly&&!o.locked&&this.emit("slot-remove",{key:s,row:i});else if(d.includes(t.key))t.preventDefault(),this.focusNeighbour(i,s,l?1:-1,o.start);else if(t.key==="Home"||t.key==="End"){t.preventDefault();const h=n.slots.slice().sort((p,k)=>p.start-k.start);this.focusSlot(i,(t.key==="Home"?h[0]:h[h.length-1]).key)}}}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(()=>{const e=this.renderRoot.querySelector(".track")?.clientWidth??0;Math.abs(e-this.trackW)>2&&(this.trackW=e)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.ro=null}pinFlips(t){return!t.point||this.vertical||!this.trackW?!1:(et-t.start)/et*this.trackW-34<8*t.title.length+22}announce(t){this.live="",requestAnimationFrame(()=>this.live=t)}get vertical(){return this.orientation==="vertical"}pos(t){return`${st(t)}%`}slotStyle(t,e=t.start,s=t.end){if(t.point)return this.vertical?`top:${this.pos(e)}`:`left:${this.pos(e)}`;const i=st(Math.max(0,s-e));return this.vertical?`top:${this.pos(e)};height:${i}%`:`left:${this.pos(e)};width:${i}%`}minuteAt(t,e){return this.vertical?It(t.clientY-e.top,e.height):It(t.clientX-e.left,e.width)}spansOf(t){return{spans:t.slots.map(e=>({start:e.start,end:e.end})),points:t.slots.map(e=>!!e.point)}}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}focusSlot(t,e){this.renderRoot.querySelector(`.slot[data-row="${CSS.escape(t)}"][data-key="${CSS.escape(e)}"]`)?.focus()}focusNeighbour(t,e,s,i){const n=this.rows.findIndex(o=>o.key===t);for(let o=n+s;o>=0&&o<this.rows.length;o+=s){const c=this.rows[o];if(!c.active||!c.slots.length)continue;const d=c.slots.find(l=>l.key===e)??c.slots.slice().sort((l,h)=>Math.abs(l.start-i)-Math.abs(h.start-i))[0];this.focusSlot(c.key,d.key);return}}renderSlot(t,e){const s=this.ghost&&this.ghost.key===e.key&&this.drag?.row===t.key,i=["slot",`cat-${e.category}`,e.point?"point":"",e.key===this.selected?"sel":"",s?"dragging":"",e.locked?"locked":"",e.invalid?"invalid":"",e.conflict?"conflict":"",this.pinFlips(e)?"flip":"",e.lowering?"lowering":e.sensitive?"sensitive":""].filter(Boolean).join(" ");return r`<div
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
        ${B(e.locked?"lock":e.icon)}
        <span class="txt"><b>${e.title}</b><small><bdi dir="ltr">${e.timeLabel}</bdi></small></span>
        <span class="flags">
          ${e.sunStart||e.sunEnd?r`<span class="flag" title=${z("לפי שמש")}>${B("sun",11)}</span>`:u}
          ${e.lowering?r`<span class="flag warn" title=${z("פותח או מנטרל")}>${B("warning",11)}</span>`:e.sensitive?r`<span class="flag" title=${z("פעולה רגישה")}>${B("shield",11)}</span>`:u}
        </span>
      </div>
      <span class="handle e" data-handle="end"></span>
    </div>`}renderRow(t){const e=["row",t.today?"today":"",t.active?"":"off",t.readOnly?"ro":""].filter(Boolean).join(" "),s=this.ghost,i=!!s&&t.active&&!t.readOnly,n=r`<button class="rowlabel" type="button" @click=${()=>this.emit("row-select",{row:t.key})}><b>${t.label}</b>${t.sub?r`<small>${t.sub}</small>`:u}</button>`;return r`<div class=${e}>
      <div class="track" data-track=${t.key}>
        ${t.active?t.slots.length===0&&this.editable&&!t.readOnly?r`<div class="empty-hint">${z("גררו כדי ליצור משבצת")}</div>`:u:r`<button class="add" type="button" ?disabled=${!this.editable||!!t.readOnly} @click=${()=>this.emit("row-add",{row:t.key})}>${t.addLabel??z("הוספה לתזמון")} ${B("plus",13)}</button>`}
        ${Ot(t.active?t.slots:[],o=>o.key,o=>this.renderSlot(t,o))}
        ${i&&s?r`<div class="ghost ${s.point?"point":""}" style=${this.slotStyle({start:s.start,end:s.end,point:s.point},s.start,s.end)}><span>${N(s.start)}–${N(s.end)}</span></div>`:u}
      </div>
      ${n}
    </div>`}render(){const t=this.sun??se,e=this.vertical?Array.from({length:24},(n,o)=>o+1):Array.from({length:13},(n,o)=>o*2),s=[{min:t.sunrise,label:this.vertical?N(t.sunrise):z("זריחה {time}",{time:N(t.sunrise)}),cls:""},{min:t.sunset,label:this.vertical?N(t.sunset):z("שקיעה {time}",{time:N(t.sunset)}),cls:""}],i=n=>this.vertical?`top:${this.pos(n)}`:`left:${this.pos(n)}`;return r`<div class="board">
      <div class="head">
        <div class="axis">
          ${e.map(n=>r`<span class="hour" style=${i(n*60)}>${String(n%24===0&&n>0&&!this.vertical?24:n).padStart(2,"0")}</span>`)}
          ${s.map(n=>r`<span class="mark" style=${i(n.min)} title=${this.sunNote}>${B("sun",11)}${n.label}</span>`)}
          ${this.now!==null?r`<span class="mark now" style=${i(this.now)}>${this.vertical?"":`${z("עכשיו")} `}${N(this.now)}</span>`:u}
        </div>
      </div>
      <div class="tracks" @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onCancel} @keydown=${this.onKey}>
        <div class="overlay" aria-hidden="true">
          <div class="night" style=${this.vertical?`top:0;height:${this.pos(t.sunrise)}`:`left:0;width:${this.pos(t.sunrise)}`}></div>
          <div class="night" style=${this.vertical?`top:${this.pos(t.sunset)};height:${st(et-t.sunset)}%`:`left:${this.pos(t.sunset)};width:${st(et-t.sunset)}%`}></div>
          ${Array.from({length:23},(n,o)=>o+1).map(n=>r`<div class="grid-line ${n%6===0?"major":""}" style=${i(n*60)}></div>`)}
          <div class="vline" style=${i(t.sunrise)}></div>
          <div class="vline" style=${i(t.sunset)}></div>
          ${this.now!==null?r`<div class="vline now" style=${i(this.now)}></div>`:u}
        </div>
        ${Ot(this.rows,n=>n.key,n=>this.renderRow(n))}
      </div>
    </div>
    <p class="sr" id="kbhelp">${z("חצים: הזזת המשבצת. Shift וחצים: שינוי שעת הסיום. Ctrl וחצים: שינוי שעת ההתחלה. Delete: מחיקה. Enter: בחירה.")}</p>
    <div class="sr" aria-live="polite" role="status">${this.live}</div>`}};y.styles=q`
    :host {
      /* COLOR-LITERAL-A-2480: the dashed marker line of both orientations, written once (the same literal) */
      --sg-vline: rgba(217, 119, 6, 0.7);
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      user-select: none;
      -webkit-user-select: none;
      --label-w: 64px;
      --row-h: 46px;
      --axis-h: 22px;
      /* DU1: the slot colours are the product's state tokens (so dark mode and the skins reach the grid); the fills are the same colours at a low share */
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
    /* ------------------------------------------------------------------ horizontal */
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
      border-inline-start: 1px dashed var(--sg-vline);
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
    /* ------------------------------------------------------------------ slots */
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
    /* the marker of a sensitive / lowering slot stays visible on a narrow bar too (the flags inside hide there) */
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
    /* a point action: a pin with its label beside it */
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
      /* physical sides: the bar sits on an LTR axis, its label goes to the later side (the flipped one, near the end of the
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
    /* ------------------------------------------------------------------ vertical (phone day view) */
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
      border-block-start: 1px dashed var(--sg-vline);
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
  `;O([f({attribute:!1})],y.prototype,"rows",2);O([f({type:Number})],y.prototype,"snap",2);O([f({type:Boolean,reflect:!0})],y.prototype,"editable",2);O([f({attribute:!1})],y.prototype,"sun",2);O([f({type:Number})],y.prototype,"now",2);O([f()],y.prototype,"selected",2);O([f({reflect:!0})],y.prototype,"orientation",2);O([f({type:Boolean,reflect:!0})],y.prototype,"compact",2);O([f()],y.prototype,"sunNote",2);O([v()],y.prototype,"ghost",2);O([v()],y.prototype,"live",2);O([v()],y.prototype,"trackW",2);y=O([F("sw-schedule-grid")],y);const ls=["on","off","level","climate","cover","secure"].map(t=>({cat:t,label:Oe[t]}));var ds=Object.defineProperty,cs=Object.getOwnPropertyDescriptor,S=(t,e,s,i)=>{for(var n=i>1?void 0:i?cs(e,s):e,o=t.length-1,c;o>=0;o--)(c=t[o])&&(n=(i?c(e,s,n):c(n))||n);return i&&n&&ds(e,s,n),n};const ee=new Set(["cover.stop_cover","cover.set_cover_tilt_position","cover.open_cover_tilt","cover.close_cover_tilt","climate.set_fan_mode","climate.set_preset_mode","climate.set_swing_mode","climate.set_humidity","fan.set_percentage"]),hs={brightness:a("בהירות"),brightness_pct:a("בהירות"),position:a("מיקום"),tilt_position:a("הטיה"),temperature:a("טמפרטורה"),hvac_mode:a("מצב פעולה"),percentage:a("עוצמה"),fan_mode:a("מצב מאוורר"),preset_mode:a("מצב מוגדר"),swing_mode:a("מצב נדנוד"),humidity:a("לחות"),mode:a("מצב"),value:a("ערך"),option:a("אפשרות")},ps={cool:a("קירור"),heat:a("חימום"),heat_cool:a("אוטומטי"),auto:a("אוטומטי"),dry:a("ייבוש"),fan_only:a("מאוורר"),off:a("כבוי")},us={fixed:a("שעה קבועה"),sunrise:a("זריחה"),sunset:a("שקיעה"),end:a("סוף היום"),none:a("ללא (פעולה חד־פעמית)")};let $=class extends W{constructor(){super(...arguments),this.slotData=null,this.index=0,this.count=0,this.meta=new Map,this.entityIds=[],this.allowNegativeSun=!1,this.readOnly=!1,this.locked=[],this.errors=[],this.paired=!1,this.canPair=!1,this.canCopyDays=!0}change(t){this.dispatchEvent(new CustomEvent("slot-change",{detail:{slot:t},bubbles:!0,composed:!0}))}fire(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}setTime(t,e){const s=this.slotData;if(!s)return;const i=Tt(t==="start"?s.start:s.stop,t==="stop");let n={...i,...e};e.kind&&e.kind!==i.kind&&e.kind==="fixed"&&i.kind!=="fixed"&&(n={...n,time:t==="stop"?this.nextTime(s.start):"08:00"}),n.offset<0&&!this.allowNegativeSun&&(n={...n,offset:0});const o=Ce(n);this.change(t==="start"?{...s,start:o??s.start}:{...s,stop:o})}nextTime(t){const e=/^(\d{2}):(\d{2})/.exec(t);if(!e)return"09:00";const s=Math.min(1439,Number(e[1])*60+Number(e[2])+60);return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}timeField(t){const e=this.slotData,s=Tt(t==="start"?e.start:e.stop,t==="stop"),i=t==="start"?["fixed","sunrise","sunset"]:["fixed","sunrise","sunset","end","none"],n=`${t}-${e.uid}`;return r`<div class="f">
      <label for=${n}>${t==="start"?a("משעה (רגע הביצוע)"):a("עד שעה (סוף חלון)")}</label>
      <select id=${n} ?disabled=${this.readOnly} data-time-kind=${t} @change=${o=>this.setTime(t,{kind:o.target.value})}>
        ${i.map(o=>r`<option value=${o} ?selected=${s.kind===o}>${us[o]}</option>`)}
      </select>
      ${s.kind==="fixed"?r`<input type="time" lang=${ft()} step="60" ?disabled=${this.readOnly} data-time=${t} aria-label=${t==="start"?a("שעת התחלה"):a("שעת סיום")} .value=${s.time} @change=${o=>o.target.value&&this.setTime(t,{time:o.target.value})} />`:s.kind==="sunrise"||s.kind==="sunset"?r`<div class="pair">
              <input type="number" min=${this.allowNegativeSun?-720:0} max="720" step="5" ?disabled=${this.readOnly} data-offset=${t} aria-label=${s.kind==="sunrise"?a("דקות אחרי הזריחה"):a("דקות אחרי השקיעה")} .value=${String(s.offset)} @change=${o=>this.setTime(t,{offset:Number(o.target.value)||0})} />
              <span class="unit">${a("דקות אחרי")}</span>
            </div>`:u}
    </div>`}updateGroup(t,e,s){const i=this.slotData;i&&this.change({...i,actions:yt(i.actions,t,e,s)})}onService(t,e){const s=t.entities.find(o=>!!o),i=s?this.meta.get(s):void 0,n=i?.actions.find(o=>o.service===e)?.args??[];this.updateGroup(t,e,$t(n,i))}removeEntity(t){const e=this.slotData;!e||!t||this.change({...e,actions:De(e.actions,t)})}addEntity(t){const e=this.slotData,s=this.meta.get(t);if(!e||!s)return;const i=L(e.actions);let n=null;for(const o of i){const c=e.actions.find(d=>d.entity_id===o.entities[0]);if(c&&(n=Ee(c,s),n))break}n??=s.actions[0]?{service:s.actions[0].service,entity_id:t,data:$t(s.actions[0].args,s)}:null,n&&this.change({...e,actions:[...e.actions,n]})}setArg(t,e,s){const i={...t.data};s===void 0||s===""||typeof s=="number"&&Number.isNaN(s)?delete i[e]:i[e]=s,this.updateGroup(t,t.service,i)}setVar(t,e,s){const i={...t.data.variables??{}};s===void 0||s===""||typeof s=="number"&&Number.isNaN(s)?delete i[e]:i[e]=s;const n={...t.data};Object.keys(i).length?n.variables=i:delete n.variables,this.updateGroup(t,t.service,n)}renderVars(t,e){const s=this.readOnly,i=t.data.variables??{};return r`<div class="vars" data-arg="variables">
      <span class="lbl">${e.label??a("משתני הסקריפט")}</span>
      ${(e.fields??[]).map(n=>{const o=i[n.name],c=`${t.key}:var:${n.name}`,d=`${n.label??n.name}${n.required?" *":""}`;return n.type==="bool"?r`<label class="pair" data-var=${n.name}><sw-toggle size="sm" labelHidden in-label label=${d} ?disabled=${s} .checked=${o===!0} @change=${l=>this.setVar(t,n.name,bt(l))}></sw-toggle>${d}</label>`:n.choices&&n.choices.length?r`<div class="arg" data-var=${n.name}><label for=${c}>${d}</label>
            <select id=${c} ?disabled=${s} @change=${l=>this.setVar(t,n.name,l.target.value)}>
              ${n.required?u:r`<option value="" ?selected=${o===void 0}>${a("ללא")}</option>`}
              ${n.choices.map(l=>r`<option value=${l} ?selected=${o===l}>${l}</option>`)}
            </select></div>`:n.type==="int"||n.type==="float"?r`<div class="arg" data-var=${n.name}><label for=${c}>${d}</label>
            <div class="row"><input id=${c} type="number" step=${n.step??(n.type==="int"?1:.5)} min=${n.min??u} max=${n.max??u} ?disabled=${s} .value=${o===void 0?"":String(o)}
              @change=${l=>this.setVar(t,n.name,l.target.value===""?void 0:Number(l.target.value))} /><span class="unit">${n.unit??""}</span></div></div>`:r`<div class="arg" data-var=${n.name}><label for=${c}>${d}</label>
          <input id=${c} type="text" maxlength=${n.max??200} ?disabled=${s} .value=${o===void 0?"":String(o)} @change=${l=>this.setVar(t,n.name,l.target.value)} /></div>`})}
    </div>`}renderArg(t,e){if(e.type==="vars")return this.renderVars(t,e);const s=this.readOnly,i=t.data[e.name],n=e.label??hs[e.name]??e.name,o=`${t.key}:${e.name}`;if(e.name==="brightness_pct"&&t.data.brightness_pct===void 0)return u;if(e.name==="brightness"&&t.data.brightness_pct!==void 0)return u;if(e.name==="brightness"||e.name==="brightness_pct"){const c=e.name==="brightness",d=typeof i=="number"?c?Math.round(i/255*100):i:null,l=h=>this.setArg(t,e.name,c?Math.round(h/100*255):h);return r`<div class="arg" data-arg=${e.name}>
        <span class="lbl">${n}</span>
        ${d===null?r`<div class="row"><sw-button size="sm" ?disabled=${s} @click=${()=>l(80)}>${a("הגדרת בהירות")}</sw-button></div>`:r`<div class="row">
              <input type="range" min="1" max="100" step="1" ?disabled=${s} aria-label=${n} .value=${String(d)} @input=${h=>l(Number(h.target.value))} />
              <input type="number" min="1" max="100" ?disabled=${s} aria-label=${a("{label} באחוזים",{label:n})} .value=${String(d)} @change=${h=>l(Math.min(100,Math.max(1,Number(h.target.value)||1)))} />
              <span class="unit">%</span>
              ${s?u:r`<sw-button size="sm" variant="ghost" iconOnly icon="close" label=${a("ללא בהירות")} @click=${()=>this.setArg(t,e.name,void 0)}></sw-button>`}
            </div>`}
      </div>`}if(e.choices&&e.choices.length)return r`<div class="arg" data-arg=${e.name}>
        <label for=${o}>${n}</label>
        <select id=${o} ?disabled=${s} @change=${c=>this.setArg(t,e.name,c.target.value)}>
          ${e.required?u:r`<option value="" ?selected=${i===void 0}>${a("ללא שינוי")}</option>`}
          ${e.choices.map(c=>r`<option value=${c} ?selected=${i===c}>${e.name==="hvac_mode"?ps[c]??c:c}</option>`)}
        </select>
      </div>`;if(e.type==="bool")return r`<div class="arg" data-arg=${e.name}>
        <label class="pair"><sw-toggle size="sm" labelHidden in-label label=${n} ?disabled=${s} .checked=${i===!0} @change=${c=>this.setArg(t,e.name,bt(c))}></sw-toggle>${n}</label>
      </div>`;if(e.type==="int"&&e.min!==void 0&&e.max!==void 0){if(!e.required&&typeof i!="number")return r`<div class="arg" data-arg=${e.name}>
          <span class="lbl">${n}</span>
          <div class="row"><sw-button size="sm" ?disabled=${s} @click=${()=>this.setArg(t,e.name,Math.min(e.max,Math.max(e.min,50)))}>${a("הגדרת {label}",{label:n})}</sw-button></div>
        </div>`;const c=typeof i=="number"?i:e.min;return r`<div class="arg" data-arg=${e.name}>
        <label for=${o}>${n}</label>
        <div class="row">
          <input id=${o} type="range" min=${e.min} max=${e.max} step="1" ?disabled=${s} .value=${String(c)} @input=${d=>this.setArg(t,e.name,Number(d.target.value))} />
          <input type="number" min=${e.min} max=${e.max} ?disabled=${s} aria-label=${n} .value=${String(c)} @change=${d=>this.setArg(t,e.name,Number(d.target.value))} />
          <span class="unit">${e.name==="position"||e.name==="tilt_position"||e.name==="percentage"?"%":""}</span>
          ${s||e.required?u:r`<sw-button size="sm" variant="ghost" iconOnly icon="close" label=${a("ללא {label}",{label:n})} @click=${()=>this.setArg(t,e.name,void 0)}></sw-button>`}
        </div>
      </div>`}return e.type==="int"||e.type==="float"?r`<div class="arg" data-arg=${e.name}>
        <label for=${o}>${n}</label>
        <div class="row">
          <input id=${o} type="number" step=${e.step??(e.type==="float"&&e.name!=="temperature"?"0.5":"1")} min=${e.min??u} max=${e.max??u} ?disabled=${s} .value=${i===void 0?"":String(i)} @change=${c=>this.setArg(t,e.name,c.target.value===""?void 0:Number(c.target.value))} />
          <span class="unit">${e.name==="temperature"?"°":""}</span>
        </div>
      </div>`:r`<div class="arg" data-arg=${e.name}>
      <label for=${o}>${n}</label>
      <input id=${o} type="text" ?disabled=${s} .value=${i===void 0?"":String(i)} @change=${c=>this.setArg(t,e.name,c.target.value)} />
    </div>`}renderGroup(t,e){const s=t.entities.find(p=>!!p),n=(s?this.meta.get(s):void 0)?.actions??[],o=n.find(p=>p.service===t.service)?.args??[],c=n.filter(p=>!ee.has(p.service)),d=n.filter(p=>ee.has(p.service)),l=n.some(p=>p.service===t.service),h=`svc-${this.slotData?.uid}-${e}`;return r`<div class="group" data-action-group=${e}>
      <div class="ents">
        ${t.entities.map(p=>r`<span class="ent">${p?this.meta.get(p)?.name??p:a("ללא התקן")}${this.readOnly||!p?u:r`<button type="button" aria-label=${a("הסרת {name} מהפעולה",{name:this.meta.get(p)?.name??p})} @click=${()=>this.removeEntity(p)}><sw-icon name="close" size="12"></sw-icon></button>`}</span>`)}
      </div>
      <div class="f">
        <label for=${h}>${a("פעולה")}</label>
        <select id=${h} ?disabled=${this.readOnly||!n.length} data-service @change=${p=>this.onService(t,p.target.value)}>
          ${l||!n.length?u:r`<option value=${t.service} selected>${j({service:t.service})}</option>`}
          ${n.length?u:r`<option value=${t.service} selected>${j({service:t.service,data:t.data})}</option>`}
          ${c.map(p=>r`<option value=${p.service} ?selected=${p.service===t.service}>${rt(p.service,p.label)}</option>`)}
          ${d.length?r`<optgroup label=${a("מתקדם")}>${d.map(p=>r`<option value=${p.service} ?selected=${p.service===t.service}>${rt(p.service,p.label)}</option>`)}</optgroup>`:u}
        </select>
      </div>
      ${o.map(p=>this.renderArg(t,p))}
    </div>`}render(){const t=this.slotData;if(!t)return u;const e=L(t.actions),s=t.actions.some(d=>xt(d,d.entity_id?this.meta.get(d.entity_id)?.class??null:null,d.entity_id?this.meta.get(d.entity_id):void 0)),i=t.actions.some(d=>{const l=d.entity_id?this.meta.get(d.entity_id):void 0;return ae(d,l?.class??null,l?.actions)}),n=new Set(t.actions.map(d=>d.entity_id)),o=this.entityIds.filter(d=>!n.has(d)&&this.meta.has(d)),c=(t.stop??"")!==""&&t.stop!=="00:00:00";return r`<section class="panel" aria-label=${a("עריכת משבצת")} data-slot-panel>
      <header>
        <div class="ttl">
          <span class="top"><h3>${a("משבצת {n} מתוך {count}",{n:this.index+1,count:this.count})}</h3><sw-schedule-markers .sensitive=${s} .lowering=${i}></sw-schedule-markers></span>
          <span class="sum">${Ne(t,this.meta)}</span>
        </div>
        <div class="tools">
          ${this.readOnly?u:r`
                ${this.canCopyDays?r`<sw-button size="sm" icon="calendar" data-slot-copy-days @click=${()=>this.fire("slot-copy-days")}>${a("העתקה לימים…")}</sw-button>`:u}
                <sw-button size="sm" icon="layers" data-slot-duplicate @click=${()=>this.fire("slot-duplicate")}>${a("שכפול")}</sw-button>
                <sw-button size="sm" variant="danger" icon="trash" data-slot-delete @click=${()=>this.fire("slot-delete")}>${a("מחיקה")}</sw-button>
              `}
          <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${a("סגירת העריכה")} @click=${()=>this.fire("slot-close")}></sw-button>
        </div>
      </header>
      ${this.locked.length?r`<div class="lockmsg" data-slot-locked><sw-icon name="lock" size="16"></sw-icon><div>${this.locked.map(d=>r`<div>${d.message}</div>`)}<div><b>${a("לעריכה")}:</b> ${a("ברכיב התזמונים המקורי.")}</div></div></div>`:r`
            <div class="fields">
              ${this.timeField("start")} ${this.timeField("stop")}
              <div class="groups">
                ${e.length?e.map((d,l)=>this.renderGroup(d,l)):r`<div class="empty" data-slot-empty><sw-icon name="info" size="16"></sw-icon>${a('בחרו פעולה: הוסיפו התקנים לתזמון בכפתור "בחירת התקנים".')}</div>`}
                ${!this.readOnly&&o.length?r`<select class="add-ent" aria-label=${a("הוספת התקן לפעולה")} data-add-entity @change=${d=>{const l=d.target;l.value&&this.addEntity(l.value),l.value=""}}>
                      <option value="">${a("הוספת התקן למשבצת…")}</option>
                      ${o.map(d=>r`<option value=${d}>${this.meta.get(d)?.name??d}</option>`)}
                    </select>`:u}
              </div>
            </div>
            ${this.errors.length?r`<ul class="errs" role="status" data-slot-errors>${this.errors.map(d=>r`<li><sw-icon name="warning" size="14"></sw-icon><span>${d.message}</span></li>`)}</ul>`:u}
            ${this.canPair||this.paired?r`<div class="off">
                  <sw-toggle .checked=${this.paired} ?disabled=${this.readOnly||!this.paired&&!c} label=${a("כיבוי בסיום החלון")} @change=${d=>this.fire("pair-off",{on:d.detail.checked})}></sw-toggle>
                  <span class="unit">${c||this.paired?a("מוסיף משבצת כיבוי בשעת הסיום"):a("נדרשת שעת סיום קבועה")}</span>
                </div>`:u}
          `}
    </section>`}};$.styles=q`
    :host {
      display: block;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    /* SCHED-POLISH-2331: the header reads like the editor's side panel (R5-DEVICES-297): a heading in the heading ink, the summary
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
    /* mobile-native: a finger needs 44 px; the mouse keeps the denser 36 */
    @media (pointer: coarse) {
      input:not([type='range']),
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
  `;S([f({attribute:!1})],$.prototype,"slotData",2);S([f({type:Number})],$.prototype,"index",2);S([f({type:Number})],$.prototype,"count",2);S([f({attribute:!1})],$.prototype,"meta",2);S([f({attribute:!1})],$.prototype,"entityIds",2);S([f({type:Boolean})],$.prototype,"allowNegativeSun",2);S([f({type:Boolean})],$.prototype,"readOnly",2);S([f({attribute:!1})],$.prototype,"locked",2);S([f({attribute:!1})],$.prototype,"errors",2);S([f({type:Boolean})],$.prototype,"paired",2);S([f({type:Boolean})],$.prototype,"canPair",2);S([f({type:Boolean})],$.prototype,"canCopyDays",2);$=S([F("schedule-slot-panel")],$);var vs=Object.defineProperty,gs=Object.getOwnPropertyDescriptor,C=(t,e,s,i)=>{for(var n=i>1?void 0:i?gs(e,s):e,o=t.length-1,c;o>=0;o--)(c=t[o])&&(n=(i?c(e,s,n):c(n))||n);return i&&n&&vs(e,s,n),n};const ws={cool:a("קירור"),heat:a("חימום"),heat_cool:a("אוטומטי"),auto:a("אוטומטי"),dry:a("ייבוש"),fan_only:a("מאוורר")},mt=new Set(["cover.stop_cover","cover.set_cover_tilt_position","climate.set_fan_mode","climate.set_preset_mode","fan.set_percentage"]);let x=class extends W{constructor(){super(...arguments),this.bubbleSkin=new oe(this),this.slots=[],this.meta=new Map,this.sun=null,this.snap=15,this.allowNegativeSun=!1,this.readOnly=!1,this.selected="",this.lockedUids={},this.errorsByUid={},this.nextByUid={},this.pairOf=()=>null,this.cellError=null}fire(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}commit(t,e,s){const i=this.slots.findIndex(c=>c.uid===t.uid),n=e==="from"?Lt(t.start):Lt(t.stop,!0);if(s.trim()===n){this.cellError=null;return}const o=Ae(this.slots,i,e,s,{step:this.snap,sun:this.sun,allowNegativeSun:this.allowNegativeSun});if("error"in o){this.cellError={uid:t.uid,field:e,message:o.error};return}this.cellError=null,this.fire("slots-change",{slots:o.slots,uid:t.uid})}setService(t,e){const s=L(t.actions)[0];if(!s)return;const i=s.entities.find(c=>!!c),n=i?this.meta.get(i):void 0,o=n?.actions.find(c=>c.service===e)?.args??[];this.fire("slot-change",{slot:{...t,actions:yt(t.actions,s,e,$t(o,n))}})}setArg(t,e,s){const i=L(t.actions)[0];if(!i)return;const n={...i.data};s===void 0||s===""||typeof s=="number"&&Number.isNaN(s)?delete n[e]:n[e]=s,this.fire("slot-change",{slot:{...t,actions:yt(t.actions,i,i.service,n)}})}renderValue(t,e){const s=L(t.actions)[0];if(!s)return r`<span class="unit">—</span>`;const i=s.data,n=s.entities.find(d=>!!d),o=(n?this.meta.get(n):void 0)?.actions.find(d=>d.service===s.service)?.args??[],c=[];for(const d of o){const l=i[d.name];if(d.name==="hvac_mode"&&d.choices?.length)c.push(r`<select ?disabled=${e} aria-label=${a("מצב פעולה")} @change=${h=>this.setArg(t,"hvac_mode",h.target.value)}>
          ${d.required?u:r`<option value="" ?selected=${l===void 0}>${a("ללא שינוי")}</option>`}
          ${d.choices.map(h=>r`<option value=${h} ?selected=${l===h}>${ws[h]??h}</option>`)}
        </select>`);else if(d.name==="temperature")c.push(r`<input class="num" type="number" step="0.5" min=${d.min??u} max=${d.max??u} ?disabled=${e} aria-label=${a("טמפרטורה")} .value=${l===void 0?"":String(l)} @change=${h=>this.setArg(t,"temperature",h.target.value===""?void 0:Number(h.target.value))} /><span class="unit">°</span>`);else if(d.name==="brightness"||d.name==="brightness_pct"){if(d.name==="brightness_pct"&&i.brightness_pct===void 0||d.name==="brightness"&&i.brightness_pct!==void 0)continue;const h=d.name==="brightness",p=typeof l=="number"?h?Math.round(l/255*100):l:"";c.push(r`<input class="num" type="number" min="1" max="100" placeholder=${a("בהירות")} ?disabled=${e} aria-label=${a("בהירות באחוזים")} .value=${String(p)} @change=${k=>{const b=k.target.value;this.setArg(t,d.name,b===""?void 0:h?Math.round(Math.min(100,Math.max(1,Number(b)))/100*255):Math.min(100,Math.max(1,Number(b))))}} /><span class="unit">%</span>`)}else(d.name==="position"||d.name==="tilt_position"||d.name==="percentage")&&d.type==="int"&&c.push(r`<input class="num" type="number" min=${d.min??0} max=${d.max??100} ?disabled=${e} aria-label=${d.name==="position"?a("מיקום"):d.name==="percentage"?a("עוצמה"):a("הטיה")} .value=${l===void 0?"":String(l)} @change=${h=>this.setArg(t,d.name,h.target.value===""?void 0:Number(h.target.value))} /><span class="unit">%</span>`)}return c.length?r`<div class="val">${c}</div>`:r`<span class="unit">—</span>`}renderRow(t,e){const s=this.slots[t.index],i=this.lockedUids[s.uid],n=this.readOnly||!!i,o=this.errorsByUid[s.uid]??[],c=L(s.actions),d=c[0],l=d?.entities.find(g=>!!g),h=(l?this.meta.get(l):void 0)?.actions??[],p=[...new Set(s.actions.map(g=>g.entity_id?this.meta.get(g.entity_id)?.name??g.entity_id:a("ללא התקן")))],k=this.pairOf(t.index),b=this.cellError?.uid===s.uid?this.cellError:null;return r`<tr class="${s.uid===this.selected?"sel":""} ${o.length?"bad":""}" data-row=${s.uid} tabindex="0" @click=${()=>this.fire("slot-select",{uid:s.uid})} @keydown=${ss(()=>this.fire("slot-select",{uid:s.uid}))}>
      <td class="n" title=${o.map(g=>g.message).join(" · ")}>${o.length?r`<sw-icon name="warning" size="14" role="img" aria-label=${`${a("משבצת {n}",{n:e})}: ${o.map(g=>g.message).join(" · ")}`}></sw-icon>`:e}</td>
      <td data-label="משעה">
        <input class="t ${b?.field==="from"?"err":""}" data-cell="from" ?disabled=${n} .value=${t.from} aria-label=${a("משעה, משבצת {n}",{n:e})} @change=${g=>this.commit(s,"from",g.target.value)} @keydown=${g=>g.key==="Enter"&&g.target.blur()} @click=${g=>g.stopPropagation()} />
        ${b?.field==="from"?r`<div class="msg" role="alert">${b.message}</div>`:u}
      </td>
      <td data-label="עד שעה (סוף חלון)">
        <input class="t ${b?.field==="to"?"err":""}" data-cell="to" ?disabled=${n} placeholder=${a("ללא")} .value=${t.to} aria-label=${a("עד שעה, משבצת {n}",{n:e})} @change=${g=>this.commit(s,"to",g.target.value)} @keydown=${g=>g.key==="Enter"&&g.target.blur()} @click=${g=>g.stopPropagation()} />
        ${b?.field==="to"?r`<div class="msg" role="alert">${b.message}</div>`:u}
      </td>
      <td class="act-cell" data-label="פעולה">
        ${i?r`<span class="chip lock"><sw-icon name="lock" size="12"></sw-icon>${d?j({service:d.service,data:d.data}):a("לא נתמך")}</span>`:d?c.length>1?r`<span class="chip">${a("{n} פעולות",{n:c.length})}</span>`:r`<select ?disabled=${n||!h.length} data-cell="service" aria-label=${a("פעולה, משבצת {n}",{n:e})} @click=${g=>g.stopPropagation()} @change=${g=>this.setService(s,g.target.value)}>
                  ${h.length?u:r`<option selected>${j({service:d.service,data:d.data})}</option>`}
                  ${h.filter(g=>!mt.has(g.service)).map(g=>r`<option value=${g.service} ?selected=${g.service===d.service}>${rt(g.service,g.label)}</option>`)}
                  ${h.some(g=>mt.has(g.service))?r`<optgroup label=${a("מתקדם")}>${h.filter(g=>mt.has(g.service)).map(g=>r`<option value=${g.service} ?selected=${g.service===d.service}>${rt(g.service,g.label)}</option>`)}</optgroup>`:u}
                </select>`:r`<span class="unit">${a("בחרו פעולה")}</span>`}
        ${k!==null?r`<span class="chip" title=${a("משבצת כיבוי בסיום")}>${a("כיבוי בסיום")}</span>`:u}
      </td>
      <td class="val-cell" data-label="ערך" @click=${g=>g.stopPropagation()}>${c.length===1&&!i?this.renderValue(s,n):r`<span class="unit">—</span>`}</td>
      <td class="who ents" data-label="התקנים">${p.join(", ")||"—"}</td>
      <td class="next" data-label="הרצה הבאה">${this.nextByUid[s.uid]??"—"}</td>
      <td class="acts">
        ${this.readOnly?u:r`<div class="btns"><sw-button size="sm" variant="ghost" iconOnly icon="layers" label=${a("שכפול משבצת {n}",{n:e})} @click=${g=>(g.stopPropagation(),this.fire("slot-duplicate",{uid:s.uid}))}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${a("מחיקת משבצת {n}",{n:e})} @click=${g=>(g.stopPropagation(),this.fire("slot-delete",{uid:s.uid}))}></sw-button></div>`}
      </td>
    </tr>`}render(){const t=Pe(this.slots,this.sun,this.pairOf);return r`<div class="wrap"><table data-schedule-table>
        <thead>
          <tr>
            <th>#</th>
            <th>${a("משעה")}</th>
            <th>${a("עד שעה (סוף חלון)")}</th>
            <th>${a("פעולה")}</th>
            <th>${a("ערך")}</th>
            <th>${a("התקנים")}</th>
            <th>${a("הרצה הבאה")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${t.length?t.map((e,s)=>this.renderRow(e,s+1)):r`<tr><td colspan="8" class="empty" data-table-empty>${a("אין משבצות עדיין.")}${this.readOnly?"":` ${a('"משבצת חדשה" מוסיפה את הראשונה.')}`}</td></tr>`}
        </tbody>
      </table></div>
      ${this.readOnly?u:r`<div class="foot"><sw-button size="sm" icon="plus" data-table-add @click=${()=>this.fire("slot-add")}>${a("משבצת חדשה")}</sw-button></div>`}`}};x.styles=[q`
    :host {
      display: block;
    }
    /* SCHED-POLISH-2331: a narrow editor column scrolls the table sideways inside the card, never the page */
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
    /* SCHED-POLISH-2331: the flex box is a div inside the cell - a td with display: flex leaves the table model, and its bottom rule
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
  `,es];C([f({attribute:!1})],x.prototype,"slots",2);C([f({attribute:!1})],x.prototype,"meta",2);C([f({attribute:!1})],x.prototype,"sun",2);C([f({type:Number})],x.prototype,"snap",2);C([f({type:Boolean})],x.prototype,"allowNegativeSun",2);C([f({type:Boolean})],x.prototype,"readOnly",2);C([f()],x.prototype,"selected",2);C([f({attribute:!1})],x.prototype,"lockedUids",2);C([f({attribute:!1})],x.prototype,"errorsByUid",2);C([f({attribute:!1})],x.prototype,"nextByUid",2);C([f({attribute:!1})],x.prototype,"pairOf",2);C([v()],x.prototype,"cellError",2);x=C([F("schedule-table-view")],x);var ms=Object.defineProperty,fs=Object.getOwnPropertyDescriptor,P=(t,e,s,i)=>{for(var n=i>1?void 0:i?fs(e,s):e,o=t.length-1,c;o>=0;o--)(c=t[o])&&(n=(i?c(e,s,n):c(n))||n);return i&&n&&ms(e,s,n),n};const bs={light:"light",switch:"power",cover:"coverOpen",climate:"activity",fan:"aperture",alarm:"shield",lock:"lock",door:"door",script:"route",scene:"sparkle",helper:"power",humidifier:"thermometer",vacuum:"move",siren:"bell",media:"volume",number:"ruler",select:"list"};let D=class extends W{constructor(){super(...arguments),this.open=!1,this.selected=[],this.entities=[],this.loading=!1,this.error="",this.picked=new Set,this.q="",this.by="area",this.wasOpen=!1}willUpdate(t){t.has("open")&&this.open&&!this.wasOpen&&(this.picked=new Set(this.selected),this.q="",this.load()),t.has("open")&&(this.wasOpen=this.open)}async load(){this.loading=!0,this.error="";try{this.entities=(await ie()).entities}catch(t){this.error=t instanceof Error?t.message:a("לא הצלחנו לטעון את ההתקנים.")}this.loading=!1}toggle(t){const e=new Set(this.picked);e.has(t)?e.delete(t):e.add(t),this.picked=e}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}confirm(){const t=[...this.picked];this.dispatchEvent(new CustomEvent("confirm",{detail:{ids:t,entities:this.entities.filter(e=>this.picked.has(e.entity_id))},bubbles:!0,composed:!0}))}nameOf(t){return this.entities.find(e=>e.entity_id===t)?.name??t}render(){const t=this.q.trim().toLowerCase(),e=this.entities.filter(i=>!t||i.name.toLowerCase().includes(t)||(i.area_name??"").toLowerCase().includes(t)||i.entity_id.toLowerCase().includes(t)),s=new Map;for(const i of e){const n=this.by==="area"?i.area_name??a("ללא אזור"):Ct[i.class];s.set(n,[...s.get(n)??[],i])}return r`<sw-drawer modal ?open=${this.open} heading=${a("בחירת התקנים")} subheading=${a("התקנים ברשותכם בלבד. התקנים שאינם ניתנים לתזמון מסומנים עם הסיבה.")} data-entity-picker @close=${this.close}>
      <div class="tools">
        <div class="search"><input type="search" data-picker-search placeholder=${a("חיפוש התקן או אזור")} aria-label=${a("חיפוש התקן")} .value=${this.q} @input=${i=>this.q=i.target.value} /><sw-icon name="search" size="15"></sw-icon></div>
        <sw-segmented size="sm" label=${a("קיבוץ")} value=${this.by} @change=${i=>this.by=i.detail.value==="class"?"class":"area"}
          .options=${[{value:"area",label:a("אזור")},{value:"class",label:a("סוג"),attrs:{"data-picker-by-class":""}}]}></sw-segmented>
      </div>
      <div class="chosen" data-picker-chosen>
        ${this.picked.size?[...this.picked].map(i=>r`<span class="chip">${this.nameOf(i)}<button type="button" aria-label=${a("הסרת {name}",{name:this.nameOf(i)})} @click=${()=>this.toggle(i)}><sw-icon name="close" size="12"></sw-icon></button></span>`):r`<span class="none">${a("לא נבחר דבר")}</span>`}
      </div>
      ${this.loading?r`<div class="state">${a("טוען…")}</div>`:this.error?r`<div class="state err">${this.error}</div>`:e.length?[...s.entries()].map(([i,n])=>r`<h4>${i}<span>${n.length}</span></h4>
                  ${n.map(o=>{const c=o.selectable||this.picked.has(o.entity_id);return r`<label class="item ${c?"":"no"}" data-picker-item=${o.entity_id}>
                      <input type="checkbox" ?disabled=${!c} .checked=${this.picked.has(o.entity_id)} @change=${()=>this.toggle(o.entity_id)} />
                      <span class="nm"><sw-icon name=${bs[o.class]} size="16"></sw-icon>${o.name}${this.by==="class"&&o.area_name?r`<small>${o.area_name}</small>`:u}</span>
                      <small class="${o.sensitive?"sens":""}">${o.sensitive?r`<sw-icon name="shield" size="12"></sw-icon> `:u}${this.by==="area"?Ct[o.class]:""}</small>
                      ${!o.selectable&&o.reason?r`<span class="why"><sw-icon name="lock" size="12"></sw-icon>${o.reason.message}</span>`:u}
                    </label>`})}`):r`<div class="state">${a("לא נמצאו התקנים")}</div>`}
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%">
        <sw-button data-picker-cancel @click=${this.close}>${a("ביטול")}</sw-button>
        <sw-button variant="primary" data-picker-ok @click=${this.confirm}>${a("אישור ({n})",{n:this.picked.size})}</sw-button>
      </div>
    </sw-drawer>`}};D.styles=q`
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
    /* CR-CMP2-SEGMENTED-C-2450: the grouping switch is sw-segmented - its small 2 px track and plain-weight keys through the knobs */
    sw-segmented {
      --sw-seg-pad: 2px;
      --sw-seg-gap: 0px;
      --sw-seg-key-pad: 12px;
      --sw-seg-radius: var(--sw-r-sm);
      --sw-seg-btn-radius: var(--sw-r-xs);
      --sw-seg-fw: var(--sw-fw-regular);
      --sw-seg-on-fw: var(--sw-fw-regular);
      /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
      --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface));
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-accent-text));
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
  `;P([f({type:Boolean,reflect:!0})],D.prototype,"open",2);P([f({attribute:!1})],D.prototype,"selected",2);P([v()],D.prototype,"entities",2);P([v()],D.prototype,"loading",2);P([v()],D.prototype,"error",2);P([v()],D.prototype,"picked",2);P([v()],D.prototype,"q",2);P([v()],D.prototype,"by",2);D=P([F("schedule-entity-picker")],D);var ys=Object.defineProperty,$s=Object.getOwnPropertyDescriptor,E=(t,e,s,i)=>{for(var n=i>1?void 0:i?$s(e,s):e,o=t.length-1,c;o>=0;o--)(c=t[o])&&(n=(i?c(e,s,n):c(n))||n);return i&&n&&ys(e,s,n),n};const xs=["is","not"],ks=["above","below","is","not"];let _=class extends W{constructor(){super(...arguments),this.conditions={items:[],type:null,track:!1},this.views=[],this.sensor=null,this.canConfigure=!1,this.warnings=[],this.readOnly=!1,this.adding=!1,this.cands=[],this.loading=!1,this.q="",this.asked=!1}emit(t){const e={};for(const s of t.items)e[s.entity_id]=this.nameOf(s.entity_id);this.dispatchEvent(new CustomEvent("conditions-change",{detail:{conditions:t,names:e},bubbles:!0,composed:!0}))}get lockedIds(){return this.views.filter(t=>t.locked).map(t=>t.entity_id)}viewOf(t){return this.views.find(e=>e.entity_id===t.entity_id&&e.attribute===t.attribute&&e.match_type===t.match_type&&e.value===t.value)}nameOf(t){return this.views.find(e=>e.entity_id===t)?.name??this.cands.find(e=>e.entity_id===t)?.name??(this.sensor?.entity_id===t?this.sensor.name:t)}candOf(t){return this.cands.find(e=>e.entity_id===t)}preset(t){if(!this.sensor||this.readOnly)return;const e=Rt(this.conditions,this.sensor.entity_id);this.emit(e===t?Me(this.conditions,this.lockedIds):Ie(this.conditions,t,this.sensor.entity_id,this.lockedIds))}async loadCands(){if(!this.asked){this.asked=!0,this.loading=!0;try{this.cands=(await ge()).entities}catch{this.cands=[]}this.loading=!1}}willUpdate(){!this.asked&&this.conditions.items.length&&!this.readOnly&&this.loadCands()}async openAdd(){this.adding=!0,this.q="",await this.loadCands()}pick(t){this.adding=!1,this.emit(Te(this.conditions,Le(t)))}renderCondition(t,e){const s=this.viewOf(t),i=!!s?.locked,n=this.nameOf(t.entity_id);if(i)return r`<div class="cond locked" data-condition-locked=${t.entity_id}>
        <div class="nm"><sw-icon name="lock" size="14"></sw-icon>${Re(t,n)}</div>
        <span class="lock">${a("מחוץ להרשאתך")}</span>
      </div>`;const o=this.candOf(t.entity_id),c=o?.numeric||t.match_type==="above"||t.match_type==="below"||typeof t.value=="number",d=c?ks:xs,l=Ue(o??(c?void 0:{entity_id:t.entity_id,domain:t.entity_id.startsWith("sun.")?"sun":"binary_sensor",numeric:!1}));return r`<div class="cond" data-condition=${t.entity_id}>
      <div class="nm">${n}${t.attribute!=="state"?r`<small>${t.attribute}</small>`:u}${s?.readable&&s.state!==null?r`<small>${a("כרגע: {state}",{state:s.state})}</small>`:u}</div>
      ${this.readOnly?u:r`<sw-button size="sm" variant="ghost" iconOnly icon="close" label=${a("הסרת התנאי")} data-condition-remove @click=${()=>this.emit(Be(this.conditions,e))}></sw-button>`}
      <div class="ctl">
        <select ?disabled=${this.readOnly} aria-label=${a("סוג ההשוואה")} data-condition-op @change=${h=>this.emit(it(this.conditions,e,{match_type:h.target.value}))}>
          ${d.map(h=>r`<option value=${h} ?selected=${t.match_type===h}>${we[h]}</option>`)}
        </select>
        ${c?r`<input class="val" type="number" ?disabled=${this.readOnly} aria-label=${a("ערך")} data-condition-value .value=${String(t.value)} @change=${h=>this.emit(it(this.conditions,e,{value:Number(h.target.value)}))} />`:l.length?r`<select ?disabled=${this.readOnly} aria-label=${a("ערך")} data-condition-value @change=${h=>this.emit(it(this.conditions,e,{value:h.target.value}))}>
                ${l.some(h=>h.value===t.value)?u:r`<option value=${String(t.value)} selected>${String(t.value)}</option>`}
                ${l.map(h=>r`<option value=${h.value} ?selected=${t.value===h.value}>${h.label}</option>`)}
              </select>`:r`<input class="val" type="text" ?disabled=${this.readOnly} aria-label=${a("ערך")} data-condition-value .value=${String(t.value)} @change=${h=>this.emit(it(this.conditions,e,{value:h.target.value}))} />`}
      </div>
    </div>`}renderAdd(){const t=this.q.trim().toLowerCase(),e=i=>({binary_sensor:0,sensor:1,input_boolean:2,sun:3})[i.domain],s=this.cands.filter(i=>!t||i.name.toLowerCase().includes(t)||i.entity_id.toLowerCase().includes(t)).sort((i,n)=>Number(n.suggested_shabbat)-Number(i.suggested_shabbat)||e(i)-e(n));return r`<div class="add" data-condition-add>
      <input type="search" placeholder=${a("חיפוש חיישן")} aria-label=${a("חיפוש חיישן לתנאי")} .value=${this.q} @input=${i=>this.q=i.target.value} />
      <div class="cands">
        ${this.loading?r`<div class="hint">${a("טוען…")}</div>`:s.length?s.map(i=>r`<button type="button" class="cand" data-candidate=${i.entity_id} @click=${()=>this.pick(i)}><span>${i.name}</span><small>${i.state??""}${i.unit?` ${i.unit}`:""}</small></button>`):r`<div class="hint">${a("לא נמצאו חיישנים")}</div>`}
      </div>
      <div class="row"><sw-button size="sm" @click=${()=>this.adding=!1}>${a("ביטול")}</sw-button></div>
    </div>`}render(){const t=this.conditions,e=this.sensor?Rt(t,this.sensor.entity_id):null;return r`<div data-conditions>
      ${this.sensor?r`<div class="presets" role="group" aria-label=${a("תנאים מוכנים")}>
            ${["only_holy_days","not_holy_days"].map(s=>r`<button type="button" class="preset" data-preset=${s} aria-pressed=${e===s} ?disabled=${this.readOnly} @click=${()=>this.preset(s)}>${me[s]}</button>`)}
            <button type="button" class="preset" data-preset="motzash" ?disabled=${this.readOnly} @click=${()=>this.dispatchEvent(new CustomEvent("preset-motzash",{bubbles:!0,composed:!0}))}>${a("מוצאי שבת")}</button>
          </div>`:this.canConfigure?r`<div class="hint" data-preset-hint>${a("בחרו חיישן שבת וחג בהגדרות ‹ תזמונים כדי לקבל תנאים מוכנים.")}</div>`:u}
      <div class="list">${t.items.map((s,i)=>this.renderCondition(s,i))}</div>
      ${t.items.length>1?r`<div class="row"><span>${a("יתקיימו")}</span><sw-segmented size="sm" label=${a("חיבור התנאים")} value=${t.type==="or"?"or":"and"} ?disabled=${this.readOnly}
            @change=${s=>this.emit({...t,type:s.detail.value==="or"?"or":"and"})}
            .options=${[{value:"and",label:a("כל התנאים"),attrs:{"data-cond-type":"and"}},{value:"or",label:a("אחד מהם"),attrs:{"data-cond-type":"or"}}]}></sw-segmented></div>`:u}
      ${t.items.length?r`<div class="row"><label class="check"><sw-toggle size="sm" labelHidden in-label label=${a("המשך לבדוק עד סוף החלון")} data-cond-track ?disabled=${this.readOnly} .checked=${t.track} @change=${s=>this.emit({...t,track:bt(s)})}></sw-toggle>${a("המשך לבדוק עד סוף החלון")}</label></div>`:u}
      ${this.adding?this.renderAdd():this.readOnly?u:r`<div class="row"><sw-button size="sm" icon="plus" data-condition-new @click=${()=>this.openAdd()}>${a("תנאי")}</sw-button></div>`}
      ${this.warnings.length?r`<ul class="warn" data-cond-warnings>${this.warnings.map(s=>r`<li>${s.message}</li>`)}</ul>`:u}
    </div>`}};_.styles=q`
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
    /* CR-CMP2-SEGMENTED-C-2450: the and / or switch is sw-segmented - its small 2 px track and plain-weight keys through the knobs */
    sw-segmented {
      --sw-seg-pad: 2px;
      --sw-seg-gap: 0px;
      --sw-seg-h: 26px;
      --sw-seg-radius: var(--sw-r-sm);
      --sw-seg-btn-radius: var(--sw-r-xs);
      --sw-seg-fw: var(--sw-fw-regular);
      --sw-seg-on-fw: var(--sw-fw-regular);
      /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
      --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface));
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-accent-text));
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
  `;E([f({attribute:!1})],_.prototype,"conditions",2);E([f({attribute:!1})],_.prototype,"views",2);E([f({attribute:!1})],_.prototype,"sensor",2);E([f({type:Boolean})],_.prototype,"canConfigure",2);E([f({attribute:!1})],_.prototype,"warnings",2);E([f({type:Boolean})],_.prototype,"readOnly",2);E([v()],_.prototype,"adding",2);E([v()],_.prototype,"cands",2);E([v()],_.prototype,"loading",2);E([v()],_.prototype,"q",2);_=E([F("schedule-conditions")],_);var zs=Object.defineProperty,_s=Object.getOwnPropertyDescriptor,m=(t,e,s,i)=>{for(var n=i>1?void 0:i?_s(e,s):e,o=t.length-1,c;o>=0;o--)(c=t[o])&&(n=(i?c(e,s,n):c(n))||n);return i&&n&&zs(e,s,n),n};const X=t=>({...t,path:t.path??""}),ne="sw.schedules.editor_view",J="sw.schedules.stash.";function Os(){const t=kt(ne);return t==="week"||t==="day"||t==="table"?t:null}const Ss={on:"power",off:"power",level:"light",climate:"thermo",cover:"blinds",secure:"shield",custom:"lock",empty:"plus"};let w=class extends W{constructor(){super(...arguments),this.scheduleId="",this.template="",this.preset="",this.entity="",this.sun=null,this.loading=!0,this.loadError="",this.forbidden=!1,this.status=null,this.schedule=null,this.draft={...Dt(),slots:[]},this.override=null,this.meta=new Map,this.lockedUids={},this.enabledNew=!0,this.view="week",this.day="sun",this.selected="",this.snap=15,this.phone=!1,this.phoneTab="board",this.preview=null,this.kavConflicts=[],this.kavSaveWithWarnings=!0,this.kavOn=!1,this.kavDry=!1,this.kavDevTest=!1,this.kavDevTestEnd="ask",this.kavDevOpen=!1,this.showErrors=!1,this.saving=!1,this.saveError="",this.note="",this.pickerOpen=!1,this.copyOpen=!1,this.copyPick=[],this.splitDialog=null,this.lowering=null,this.conflict=null,this.compareOpen=!1,this.leave=null,this.gone=!1,this.stash=null,this.nowMin=0,this.condNames={},this.chosen=[],this.baseline=Dt(),this.baseRevision="",this.previewToken=0,this.previewTimer=0,this.previewFor=null,this.stopSub=null,this.clockTimer=0,this.mq=null,this.loadedFor="",this.loadedKey="\0",this.savedOk=!1,this.onMq=t=>{this.phone=t.matches,t.matches&&this.view==="week"&&(this.view="day")},this.dirtyMemo=new ve,this.valCache=null,this.ebuCache=null,this.onBeforeUnload=t=>{this.dirty&&(t.preventDefault(),t.returnValue="")},this.onDocClick=t=>{if(!this.dirty||t.defaultPrevented)return;const e=t.composedPath().find(i=>i instanceof HTMLAnchorElement&&(i.getAttribute("href")??"").startsWith("#/"));if(!e)return;const s=e.getAttribute("href")??"";s.split("?")[0]!==window.location.hash.split("?")[0]&&(t.preventDefault(),t.stopPropagation(),this.leave={href:s})},this.viewCache=null}connectedCallback(){super.connectedCallback(),as(this),this.mq=window.matchMedia("(max-width: 767px)"),this.phone=this.mq.matches,this.mq.addEventListener("change",this.onMq),window.addEventListener("beforeunload",this.onBeforeUnload),document.addEventListener("click",this.onDocClick,!0),this.tick(),this.clockTimer=window.setInterval(()=>this.tick(),3e4),this.stopSub=fe(()=>void this.refreshRemote())}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),window.removeEventListener("beforeunload",this.onBeforeUnload),document.removeEventListener("click",this.onDocClick,!0),window.clearInterval(this.clockTimer),window.clearTimeout(this.previewTimer),this.stopSub?.(),this.stopSub=null,this.dirty&&!this.savedOk&&this.loadedFor&&Qt(J+this.loadedFor,JSON.stringify({draft:this.currentDraft()}),U())}tick(){const t=new Date;this.nowMin=t.getHours()*60+t.getMinutes()}willUpdate(){this.valCache=null,this.ebuCache=null,this.viewCache=null;const t=`${this.scheduleId}|${this.template}|${this.preset}`;t!==this.loadedKey&&(this.loadedKey=t,this.loadedFor=this.creating?"new":this.scheduleId,this.load())}get creating(){return!this.scheduleId||this.scheduleId==="new"}get sunBase(){return this.sun??(le()?se:is)}get sunNow(){return this.preview?je({slots:this.draft.slots},this.preview.upcoming,this.sunBase):this.sunBase}get allowNegativeSun(){return!!this.status?.capabilities.negative_sun_offset}get opts(){return{step:this.snap,sun:this.sunNow,allowNegativeSun:this.allowNegativeSun}}get readOnly(){return this.creating?!this.status?.can.manage||this.status.writable===!1:!this.schedule||!this.schedule.can.edit}get work(){return this.override?this.override.slots:this.draft.slots}currentDraft(){return{...this.draft,name:(this.draft.name??"").trim()===""?this.creating?"":this.draft.name??"":this.draft.name,slots:A(this.draft.slots)}}get dirty(){if(this.loading||!this.loadedFor)return!1;if(this.override)return!0;const{draft:t,baseline:e,creating:s}=this;return this.dirtyMemo.get([t,e,s],()=>!Ut(this.currentDraft(),e))}get classOf(){return t=>ut(this.meta,t)}get validation(){return this.valCache??=this.computeValidation()}computeValidation(){const t=Bt(this.currentDraft(),{creating:this.creating,meta:this.meta,sun:this.sunNow,original:this.baseline,lockedConditions:this.schedule?.conditions.items??[]});let e=t.errors.map(X);const s=t.warnings.map(X);if(this.override){const n=Bt({...this.currentDraft(),weekdays:jt(this.override.days),slots:A(this.override.slots)},{creating:!1,meta:this.meta,sun:this.sunNow,original:this.baseline,lockedConditions:this.schedule?.conditions.items??[]});e=[...e,...n.errors.map(X).filter(o=>o.path.startsWith("slots")).map(o=>({...o,path:`override.${o.path}`}))]}const i=this.previewOfThisDraft;for(const n of(i?.errors??[]).map(X))e.some(o=>o.path===n.path&&o.message===n.message)||(e=[...e,n]);for(const n of(i?.warnings??[]).map(X))s.some(o=>o.path===n.path&&o.message===n.message)||s.push(n);return{errors:e,warnings:s}}get previewOfThisDraft(){return this.preview&&this.previewFor&&Ut(this.previewFor,this.currentDraft())?this.preview:null}errorsByUid(){return this.ebuCache??=this.computeErrorsByUid()}computeErrorsByUid(){const t={};for(const e of this.validation.errors){const s=e.path.startsWith("override."),i=at(s?e.path.slice(9):e.path),n=i>=0?s?this.override?.slots[i]:this.draft.slots[i]:void 0;n&&(t[n.uid]??=[]).push(e)}return t}async load(){this.loading=!0,this.loadError="",this.forbidden=!1,this.override=null,this.selected="",this.conflict=null,this.gone=!1,this.savedOk=!1,this.previewToken+=1,this.preview=null,this.previewFor=null,this.stash=null;const t=this.scheduleId,e=this.loadedKey;try{const[s,i,n]=await Promise.all([be().catch(()=>null),this.creating?Promise.resolve(null):Et(t),ie().catch(()=>null)]);if(e!==this.loadedKey)return;this.status=s,this.snap=s?.settings.snap_minutes??15;const o=n?.entities??[],c=Os();this.view=this.phone?"day":c??"week";let d=qt(i);d=Wt(o,d),this.meta=d,i?this.adopt(i):this.startNew(s,d);const l=kt(J+this.loadedFor,U());if(l)try{this.stash=JSON.parse(l)}catch{this.stash=null}const h=I(this.draft.weekdays)??[],p=V[new Date().getDay()];this.day=h.includes(p)?p:h[0]??"sun",this.loading=!1,this.schedulePreview(0),this.creating&&this.draft.slots.length&&!vt(this.draft.slots).length&&!this.readOnly&&(this.pickerOpen=!0)}catch(s){if(e!==this.loadedKey)return;this.loading=!1,s instanceof ot&&(s.status===403||s.status===404)&&(this.forbidden=!0),this.loadError=Q(s)}}adopt(t){this.schedule=t,this.baseRevision=t.revision;const e=Nt(t),s=e.slots.map(T),i={};t.slots.forEach((n,o)=>{n.supported||(i[s[o].uid]=n.unsupported.length?n.unsupported:[{code:"unsupported_content",message:a("התזמון כולל תוכן שהמערכת אינה מציגה במלואו.")}])}),this.lockedUids=i,this.chosen=[],this.meta=qt(t,new Map(this.meta)),this.draft={...e,slots:G(s,this.sunNow).slots},this.baseline=this.currentDraft(),this.override=null,this.conflict=null,this.draft.slots.some(n=>n.uid===this.selected)||(this.selected="")}startNew(t,e){const s=de().params,i=t?.settings.shabbat_sensor?.entity_id??null,n=t?.settings.default_repeat??"repeat";let o=null;if(s.get("draft")){const l=kt(Ft,U());if(nt(Ft,U()),l)try{const h=JSON.parse(l);o={...h,slots:h.slots}}catch{o=null}}if(!o){o=(qe(this.template||s.get("template"))??We.find(p=>p.id==="blank")).build({sensor:i,defaultRepeat:n,now:new Date});const h=this.preset||s.get("preset");o=Fe(o,h==="only_holy_days"||h==="not_holy_days"?h:null,i)}this.schedule=null,this.baseRevision="",this.meta=e,this.lockedUids={};const c=this.entity||s.get("entity")||"";this.chosen=c&&e.has(c)?[c]:[];const d=o.slots.map(T);this.draft={...o,slots:G(d,this.sunNow).slots},this.baseline=this.currentDraft(),this.enabledNew=!0}async refreshRemote(){if(this.creating||!this.scheduleId||this.loading||this.saving)return;const t=this.scheduleId,e=()=>this.scheduleId===t&&this.loadedFor===t&&!this.loading;try{const s=await Et(t);if(!e()||s.revision===this.baseRevision)return;this.dirty?this.conflict={current:s}:this.adopt(s)}catch(s){e()&&s instanceof ot&&s.status===404&&(this.gone=!0)}}cancel(){const t=this.creating||!this.scheduleId?"#/devices/schedules":`#/devices/schedules/${encodeURIComponent(this.scheduleId)}`;if(this.dirty){this.leave={href:t};return}this.go(t)}go(t){this.savedOk=!0,nt(J+this.loadedFor,U()),t.startsWith("#")?St(t.slice(1).split("?")[0],Object.fromEntries(new URLSearchParams(t.split("?")[1]??""))):window.location.assign(t)}mark(){this.valCache=null,this.ebuCache=null,this.viewCache=null,this.saveError="",this.savedOk=!1,this.previewToken+=1,this.schedulePreview()}setWork(t,e){const s=G(t,this.sunNow).slots;this.override?this.override={...this.override,slots:s}:this.draft={...this.draft,slots:s},e&&(this.selected=e),this.mark()}patch(t){this.draft={...this.draft,...t},this.mark()}idxOf(t,e=this.work){return e.findIndex(s=>s.uid===t)}grid(){return this.renderRoot.querySelector("sw-schedule-grid")}say(t){this.grid()?.announce(t)}onCreate(t,e){const s=this.work,i=Ve(s,t,e,this.opts,T);if(!i)return this.say(a("אין מקום פנוי כאן."));const n=i.slots[i.index].uid,o=Vt(A(s),this.meta,d=>H(d,this.sunNow)?.start??0,this.chosen),c=i.slots.map(d=>d.uid===n?{...d,actions:o}:d);this.setWork(c,n),this.reveal(),this.say(a("נוצרה משבצת {n}.",{n:(i.index??0)+1}))}onAddButton(){const t=this.work,e=Ke(t,this.opts,480,T);if(!e)return this.say(a("אין מקום למשבצת נוספת."));const s=e.slots[e.index].uid,i=Vt(A(t),this.meta,n=>H(n,this.sunNow)?.start??0,this.chosen);this.setWork(e.slots.map(n=>n.uid===s?{...n,actions:n.actions.length?n.actions:i}:n),s),this.reveal()}reveal(){this.phone&&this.updateComplete.then(()=>this.renderRoot.querySelector("[data-panel-card]")?.scrollIntoView({block:"nearest",behavior:"smooth"}))}onGrid(t,e){const s=this.work,i=String(e.key??""),n=this.idxOf(i,s);switch(t){case"slot-select":this.selected=i,this.reveal();break;case"slot-create":this.onCreate(Number(e.from),Number(e.to));break;case"slot-move":{if(n<0)return;const o=Gt(s,n,Number(e.delta),this.opts);this.setWork(o.slots,i);break}case"slot-resize":{if(n<0)return;const o=Ge(s,n,e.edge,Number(e.minute),{...this.opts,detach:!!e.detach});this.setWork(o.slots,i);break}case"slot-remove":n>=0&&this.removeAt(n);break;case"row-add":this.override||(this.patch({weekdays:Kt(this.draft.weekdays,e.row)}),this.day=e.row);break;case"row-select":V.includes(e.row)&&(this.day=e.row);break}}removeAt(t){const e=this.work[t];e&&(this.setWork(Ht(this.work,t)),this.selected===e.uid&&(this.selected=""),this.say(a("המשבצת נמחקה.")))}onSlotChange(t){const e=this.idxOf(t.uid);if(e<0)return;const s=this.work.slice();s[e]=t,this.setWork(s,t.uid)}onDuplicate(t){const e=this.idxOf(t);if(e<0)return;const s=He(this.work,e,this.opts,T);if(!s)return this.say(a("אין מקום לשכפול."));this.setWork(s.slots,s.slots[s.index].uid)}onPairOff(t){const e=this.idxOf(this.selected);if(e<0)return;const s=this.work,i=A(s);if(!t){const c=lt(i,e);c!==null&&this.setWork(Ht(s,c),s[e].uid);return}const n=At(i[e]);if(!n)return;const o=[...s,T(n)];if(G(o,this.sunNow).slots.some((c,d,l)=>l.slice(d+1).some(h=>this.overlapIdx(l[d],h)))){this.saveError="",this.note=a("אין מקום לכיבוי בסיום: קיימת משבצת בשעה הזו.");return}this.setWork(o,s[e].uid)}overlapIdx(t,e){const s=H(t,this.sunNow),i=H(e,this.sunNow);return!!s&&!!i&&s.start<i.end&&i.start<s.end}setView(t){this.view=t,Qt(ne,t)}get canSplit(){if(this.creating||this.readOnly||this.override)return!1;const t=I(this.draft.weekdays);return!!t&&t.length>=2}startOverride(t){this.override={days:t,slots:Ye(this.draft.slots)},this.selected="",this.mark()}cancelOverride(){this.override=null,this.selected="",this.mark()}openCopyDays(){this.copyPick=this.override?[...this.override.days]:[],this.copyOpen=!0}applyCopyDays(){if(this.override){const t=I(this.draft.weekdays)??[],e=t.filter(s=>this.copyPick.includes(s));e.length&&e.length<t.length&&(this.override={...this.override,days:e})}else if(this.copyPick.length){const t=I(this.draft.weekdays)??[];this.patch({weekdays:jt([...new Set([...t,...this.copyPick])])})}this.copyOpen=!1}get slotEntityIds(){return[...new Set([...vt(this.draft.slots),...this.override?vt(this.override.slots):[]])]}get entityIds(){return[...new Set([...this.slotEntityIds,...this.chosen.filter(t=>this.meta.has(t))])]}onPicked(t,e){this.pickerOpen=!1;const s=Wt(e,new Map(this.meta));this.meta=s;const i=this.slotEntityIds,n=t.filter(d=>!i.includes(d)).map(d=>s.get(d)).filter(d=>!!d),o=i.filter(d=>!t.includes(d)),c=d=>o.reduce((l,h)=>gt(l,h),Xt(d,n));this.chosen=t,this.draft={...this.draft,slots:c(this.draft.slots)},this.override&&(this.override={...this.override,slots:c(this.override.slots)}),this.mark()}removeEntity(t){this.chosen=this.chosen.filter(e=>e!==t),this.draft={...this.draft,slots:gt(this.draft.slots,t)},this.override&&(this.override={...this.override,slots:gt(this.override.slots,t)}),this.mark()}schedulePreview(t=450){window.clearTimeout(this.previewTimer),this.previewTimer=window.setTimeout(()=>void this.runPreview(),t)}async runPreview(){if(this.loading||this.readOnly&&!this.creating){this.preview=null,this.previewFor=null;return}const t=this.currentDraft();if(!t.slots.length){this.preview=null,this.previewFor=null;return}const e=++this.previewToken;try{const s=await Pt(t,this.creating?null:this.scheduleId,6);e===this.previewToken&&(this.previewFor=t,this.preview=s),ns("schedule",this.creating?null:this.scheduleId,t).then(i=>{e===this.previewToken&&(this.kavOn=!!i.enabled,this.kavDevTest=!!i.device_test,this.kavDevTestEnd=i.device_test_end??"ask",this.kavConflicts=i.enabled?i.conflicts:[],this.kavSaveWithWarnings=i.save_with_warnings!==!1)}).catch(()=>{e===this.previewToken&&(this.kavConflicts=[],this.kavOn=!1,this.kavDevTest=!1)})}catch{e===this.previewToken&&(this.preview=null,this.previewFor=null)}}sensitiveSig(t){return t.slots.flatMap(e=>e.actions.filter(s=>xt(s,ut(this.meta,s.entity_id))).map(s=>`${s.service}|${s.entity_id}`)).sort().join(",")}async onSave(){if(this.readOnly||this.saving)return;this.showErrors=!0,this.note="";const{errors:t}=this.validation;if(t.length){const e=t.find(s=>at(s.path.replace(/^override\./,""))>=0);if(e){const n=(e.path.startsWith("override.")?this.override?.slots:this.draft.slots)?.[at(e.path.replace(/^override\./,""))];n&&(this.selected=n.uid)}this.phoneTab="settings";return}if(this.override){const e=A(this.override.slots);if(JSON.stringify(e)===JSON.stringify(A(this.draft.slots)))this.override=null;else{this.splitDialog={name:`${(this.draft.name??"").trim()||a("תזמון")} · ${this.override.days.map(s=>K[s]).join(", ")}`};return}}await this.persist()}async persist(t=!1,e=null){const s=this.currentDraft();this.saving=!0,this.saveError="";try{const i=await Pt(s,this.creating?null:this.scheduleId,6);if(this.previewFor=s,this.preview=i,!i.valid){this.showErrors=!0,this.saving=!1;return}const n=Y(s,this.meta),o=this.creating||this.sensitiveSig(s)!==this.sensitiveSig(this.baseline);if(!t&&(i.requires.confirm_lowering||n.lowering||n.sensitive&&o||i.requires.alarm_code)){this.lowering={summary:n,needsCode:i.requires.alarm_code,kind:"save",error:""},this.saving=!1;return}const c={confirm_lowering:n.lowering||i.requires.confirm_lowering,alarm_code:e};if(this.creating){const d=await ye(s,{enabled:this.enabledNew,...c});this.lowering=null,this.savedOk=!0,this.dispatchEvent(new CustomEvent("saved",{detail:{id:"schedule"in d?d.schedule.id:""},bubbles:!0,composed:!0})),"schedule"in d?(this.note=a("התזמון נוצר."),this.go(`#/devices/schedules/${encodeURIComponent(d.schedule.id)}`)):(this.note=d.message,this.go("#/devices/schedules"))}else{const d=await dt(this.scheduleId,s,this.baseRevision,c);this.lowering=null,this.savedOk=!0,this.adopt(d.schedule),this.note=a("השינויים נשמרו."),this.dispatchEvent(new CustomEvent("saved",{detail:{id:d.schedule.id},bubbles:!0,composed:!0})),this.go(`#/devices/schedules/${encodeURIComponent(d.schedule.id)}`)}}catch(i){this.handleSaveError(i,"save")}this.saving=!1}handleSaveError(t,e){if(t instanceof ot){const s=t.body.details??{};if(t.code==="schedule_changed"&&s.current){this.lowering=null,this.conflict={current:s.current};return}if(t.code==="lowering_confirmation_required"||t.code==="code_required"){this.lowering={summary:Y(this.currentDraft(),this.meta),needsCode:t.code==="code_required",kind:e,error:""};return}if(t.code==="wrong_code"&&this.lowering){this.lowering={...this.lowering,error:t.message};return}if(t.code==="validation"||t.code==="slots_overlap"){const i=s.errors??[];this.previewFor=this.currentDraft(),this.preview={...this.preview??{valid:!1,warnings:[],upcoming:[],conditional:!1,sensitive:!1,lowering:!1,requires:{sensitive_permission:!1,confirm_lowering:!1,alarm_code:!1}},valid:!1,errors:i.length?i:[{path:"",code:t.code,message:t.message}]},this.showErrors=!0,this.lowering=null;return}}this.lowering&&(this.lowering={...this.lowering,error:Q(t)}),this.saveError=Q(t)}async persistSplit(t,e=!1,s=null){if(!this.override)return;const i=Xe(this.currentDraft(),this.baseline,{days:this.override.days,slots:A(this.override.slots)});if(!i.ok){this.saveError=i.error,this.splitDialog=null;return}const n=[Y(i.created,this.meta),Y(i.originalUpdate??i.afterSplit,this.meta)],o=n.some(l=>l.lowering);if(!e&&(o||n.some(l=>l.sensitive&&this.sensitiveSig(i.created)!==this.sensitiveSig(this.baseline)))){const l={entities:[...new Set(n.flatMap(h=>h.entities))],kinds:[...new Set(n.flatMap(h=>h.kinds))],times:n.map(h=>h.times).filter(Boolean).join(", "),sensitive:n.some(h=>h.sensitive),lowering:o};this.splitDialog={name:t},this.lowering={summary:l,needsCode:!1,kind:"split",error:""};return}this.saving=!0,this.saveError="";const c={confirm_lowering:o,alarm_code:s};let d="split";try{const l=await $e(this.scheduleId,this.baseRevision,i.days,t.trim()||null);d="update",i.originalUpdate&&await dt(l.original.id,i.originalUpdate,l.original.revision,c),await dt(l.created.id,{...i.created,name:t.trim()||l.created.name},l.created.revision,c),this.lowering=null,this.splitDialog=null,this.savedOk=!0,this.override=null,this.dispatchEvent(new CustomEvent("saved",{detail:{id:l.original.id},bubbles:!0,composed:!0})),this.go(`#/devices/schedules/${encodeURIComponent(l.original.id)}`)}catch(l){this.splitDialog=null,this.handleSaveError(l,"split"),d==="update"&&(this.saveError=a("הפיצול בוצע, אך שמירת השינויים בתזמון נכשלה: {error} בדקו את שני התזמונים ברשימה.",{error:this.saveError||Q(l)}))}this.saving=!1}onLoweringConfirm(t){this.lowering?.kind==="split"?this.persistSplit(this.splitDialog?.name??"",!0,t):this.persist(!0,t)}keepMine(){this.conflict&&(this.baseRevision=this.conflict.current.revision,this.conflict=null,this.onSave())}loadLatest(){this.conflict&&(this.adopt(this.conflict.current),this.mark())}restoreStash(){if(!this.stash)return;const t=this.stash.draft;this.draft={...t,slots:G(t.slots.map(T),this.sunNow).slots},this.stash=null,nt(J+this.loadedFor,U()),this.mark()}dropStash(){this.stash=null,nt(J+this.loadedFor,U())}slotView(t,e,s){const i=H(t,this.sunNow)??{start:0,end:1},n=Je(t,this.classOf),o=L(t.actions),c=!!this.lockedUids[t.uid],d=o[0],l=d?`${j({service:d.service,data:d.data})}${o.length>1?` +${o.length-1}`:""}`:a("בחרו פעולה"),h=ct(t.start),p=t.stop?ct(t.stop):null,k=M=>_e(M).replace(/ ([+−])/," ‎$1"),b=`${k(h)}${t.stop?`–${t.stop==="00:00:00"?"00:00":k(p)}`:""}`,g=t.actions.some(M=>{const _t=M.entity_id?this.meta.get(M.entity_id):void 0;return ae(M,_t?.class??null,_t?.actions)}),zt=t.actions.some(M=>xt(M,ut(this.meta,M.entity_id))),re=!!this.errorsByUid()[t.uid]?.length;return{key:t.uid,start:i.start,end:i.end,category:c?"custom":n,title:l,timeLabel:b,icon:Ss[n],point:t.stop==null,sunStart:Yt(t.start),sunEnd:Yt(t.stop),locked:c,sensitive:zt,lowering:g,invalid:this.showErrors&&re,conflict:this.views().conflicts.has(t.uid),aria:`${a("משבצת {n} מתוך {count}",{n:e+1,count:s})}: ${l}, ${b}${g?`, ${a("פותח או מנטרל")}`:zt?`, ${a("פעולה רגישה")}`:""}${c?`, ${a("לקריאה בלבד")}`:""}`}}kavConflictUids(){const t=new Set;for(const e of this.kavConflicts){const s=wt(e),i=s===null?void 0:this.draft.slots[s];i&&t.add(i.uid)}return t}moveConflictSlot(t){const e=wt(t),s=Jt(t),i=e===null?void 0:this.draft.slots[e];if(!i||!s||this.override)return;const n=this.draft.slots.findIndex(c=>c.uid===i.uid),o=Gt(this.draft.slots,n,s.delta,this.opts);this.setWork(o.slots,i.uid)}views(){return this.viewCache??={conflicts:this.kavConflictUids(),bySlots:new Map}}slotViews(t){const e=this.views().bySlots;let s=e.get(t);return s||e.set(t,s=t.map((i,n)=>this.slotView(i,n,t.length))),s}gridRows(){const t=Ze(this.draft.weekdays),e=V[new Date().getDay()],s=this.override;return t?t.map(i=>{const n=!!s&&s.days.includes(i.day),o=n?s.slots:this.draft.slots;return{key:i.day,label:R[i.day],sub:i.active?i.day===e?a("היום"):s?n?a("פיצול"):a("מקושר"):i.linked>1?a("מקושר"):"":i.day===e?a("היום"):"",today:i.day===e,active:i.active,slots:i.active?this.slotViews(o):[],addLabel:a("הוספת {day} לתזמון",{day:R[i.day]}),readOnly:!!s&&!n}}):[{key:"all",label:tt(this.draft.weekdays),active:!0,slots:this.slotViews(this.draft.slots)}]}nextByUid(){const t={},e=this.preview?.upcoming??[],s=this.draft.conditions.items.length>0;for(const i of e){const n=this.draft.slots[i.slot_index];n&&!t[n.uid]&&(t[n.uid]=`${ht(i.at)}${s?` · ${a("בתנאי")}`:""}`)}return t}renderBanners(){const t=this.schedule?.read_only?.reasons??[];return r`
      ${this.readOnly&&!this.creating&&this.schedule?r`<div class="banner warn" data-readonly-banner><sw-icon name="lock" size="16"></sw-icon><div>${a("מצב צפייה.")}${t.length?r` ${t.map(e=>r`<div>${e.message}</div>`)}`:u}</div></div>`:this.creating&&this.readOnly?r`<div class="banner warn" data-readonly-banner><sw-icon name="lock" size="16"></sw-icon><div>${a("שמירת תזמונים אינה זמינה כרגע.")}</div></div>`:u}
      ${this.gone?r`<div class="banner err" data-gone-banner><sw-icon name="warning" size="16"></sw-icon><span>${a("התזמון נמחק במקום אחר.")}</span></div>`:u}
      ${this.conflict?r`<div class="banner err" role="alert" data-conflict-banner>
            <sw-icon name="warning" size="16"></sw-icon>
            <span><b>${a("התזמון שונה במקום אחר")}</b> (${a("גרסה {from} ← {to}",{from:this.baseRevision.slice(0,4),to:this.conflict.current.revision.slice(0,4)})}). ${a("השינויים שלכם עדיין לא נשמרו.")}</span>
            <span class="sp"></span>
            <sw-button size="sm" data-conflict-compare @click=${()=>this.compareOpen=!0}>${a("השוואה")}</sw-button>
            <sw-button size="sm" data-conflict-latest @click=${()=>this.loadLatest()}>${a("טעינת הגרסה החדשה")}</sw-button>
            <sw-button size="sm" variant="danger" data-conflict-mine @click=${()=>this.keepMine()}>${a("שמירה בכל זאת")}</sw-button>
          </div>`:u}
      ${this.saveError?r`<div class="banner err" role="alert" data-save-error><sw-icon name="warning" size="16"></sw-icon><span><b>${a("השמירה לא הושלמה.")}</b> ${this.saveError}</span><span class="sp"></span><sw-button size="sm" data-save-retry @click=${()=>this.onSave()}>${a("ניסיון נוסף")}</sw-button></div>`:u}
      ${this.note?r`<div class="banner ok" role="status" data-note>${this.note}</div>`:u}
      ${this.stash?r`<div class="banner info" data-stash-banner><sw-icon name="info" size="16"></sw-icon><span>${a("נמצאה טיוטה שלא נשמרה מהעריכה הקודמת.")}</span><span class="sp"></span><sw-button size="sm" data-stash-restore @click=${()=>this.restoreStash()}>${a("שחזור")}</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.dropStash()}>${a("התעלמות")}</sw-button></div>`:u}
      ${this.override?r`<div class="banner info" data-override-banner><sw-icon name="link" size="16"></sw-icon><span>${a("עורכים רק את {days}. בשמירה יפוצל תזמון נפרד ליום הזה.",{days:this.override.days.map(e=>R[e]).join(", ")})}</span><span class="sp"></span><sw-button size="sm" data-override-cancel @click=${()=>this.cancelOverride()}>${a("ביטול הפיצול")}</sw-button></div>`:u}
      ${this.status&&!this.status.writable&&!this.readOnly?r`<div class="banner warn"><sw-icon name="offline" size="16"></sw-icon><span>${a("שמירת שינויים אינה זמינה כרגע.")}</span></div>`:u}`}renderLegend(){return r`<div class="legend" aria-label=${a("מקרא צבעים")}>
      ${ls.map(t=>r`<span class="k"><span class="sw c-${t.cat}"></span>${t.label}</span>`)}
      <span class="k"><sw-icon name="clock" size="12"></sw-icon>${a("זריחה / שקיעה (משוער)")}</span>
      <span class="k"><span class="now"></span>${a("עכשיו")}</span>
    </div>`}renderBoard(){const t=this.gridRows(),e=I(this.draft.weekdays),s=e?.length??0,i=this.readOnly,n=t.find(l=>l.key===this.day)??t[0],o=this.phone&&this.view==="day",c=this.work,d=this.override?this.override.days:null;return r`<div class="card" data-board>
      <div class="toolbar">
        <sw-segmented label=${a("תצוגה")} value=${this.view} @change=${l=>this.setView(l.detail.value)}
          .options=${[{value:"week",label:a("שבוע"),icon:r`<sw-icon name="calendar" size="14"></sw-icon>`,attrs:{"data-view-btn":"week"}},{value:"day",label:a("יום"),icon:r`<sw-icon name="clock" size="14"></sw-icon>`,attrs:{"data-view-btn":"day"}},{value:"table",label:a("טבלה"),icon:r`<sw-icon name="list" size="14"></sw-icon>`,attrs:{"data-view-btn":"table"}}]}></sw-segmented>
        <span class="sp"></span>
        ${this.view==="table"?u:r`<label class="snap">${a("הצמדה")} <select data-snap aria-label=${a("הצמדת זמן")} .value=${String(this.snap)} @change=${l=>this.snap=Number(l.target.value)}>
              ${[5,15,30].map(l=>r`<option value=${l} ?selected=${this.snap===l}>${a("{n} דק׳",{n:l})}</option>`)}
            </select></label>`}
        ${i||this.view==="table"?u:r`<sw-button size="sm" icon="plus" data-add-slot @click=${()=>this.onAddButton()}>${a("משבצת")}</sw-button>`}
      </div>
      ${this.view==="table"?u:this.renderLegend()}
      ${this.view==="table"||!e?u:r`<div class="linked">
            ${s>1&&!this.override?r`<span class="chip" data-linked-chip><sw-icon name="link" size="12"></sw-icon>${a("{n} ימים מקושרים",{n:s})}</span><span>${a("כל שינוי במשבצת חל על כל הימים: {days}.",{days:tt(this.draft.weekdays)})}</span>`:u}
            ${this.canSplit?r`<sw-button size="sm" icon="link" data-split-start @click=${()=>this.startOverride([this.day])}>${a("עריכה רק ל{day}…",{day:R[this.day]})}</sw-button>`:u}
            ${d?r`<span class="chip" data-override-chip>${a("עורכים: {days}",{days:d.map(l=>K[l]).join(", ")})}</span>`:u}
          </div>`}
      ${this.view==="day"&&e?r`<div class="dayrow" role="group" aria-label=${a("בחירת יום")}>${t.map(l=>r`<button type="button" class=${l.active?"":"off"} data-day-btn=${l.key} aria-pressed=${this.day===l.key} @click=${()=>this.day=l.key}><b>${K[l.key]}</b><small>${l.today?a("היום"):l.active?a("בתזמון"):a("לא בתזמון")}</small></button>`)}</div>`:u}
      ${this.view==="table"?r`<schedule-table-view
            .slots=${c}
            .meta=${this.meta}
            .sun=${this.sunNow}
            .snap=${this.snap}
            .allowNegativeSun=${this.allowNegativeSun}
            .readOnly=${i}
            .selected=${this.selected}
            .lockedUids=${this.lockedUids}
            .errorsByUid=${this.errorsByUid()}
            .nextByUid=${this.nextByUid()}
            .pairOf=${l=>lt(A(c),l)}
            @slots-change=${l=>this.setWork(l.detail.slots,l.detail.uid)}
            @slot-change=${l=>this.onSlotChange(l.detail.slot)}
            @slot-select=${l=>this.selected=l.detail.uid}
            @slot-delete=${l=>this.removeAt(this.idxOf(l.detail.uid))}
            @slot-duplicate=${l=>this.onDuplicate(l.detail.uid)}
            @slot-add=${()=>this.onAddButton()}
          ></schedule-table-view>`:r`<sw-schedule-grid
            data-grid
            .rows=${this.view==="day"&&n?[n]:t}
            .snap=${this.snap}
            .editable=${!i}
            .sun=${this.sunNow}
            .now=${this.nowMin}
            .selected=${this.selected}
            .orientation=${o?"vertical":"horizontal"}
            @slot-select=${l=>this.onGrid("slot-select",l.detail)}
            @slot-create=${l=>this.onGrid("slot-create",l.detail)}
            @slot-move=${l=>this.onGrid("slot-move",l.detail)}
            @slot-resize=${l=>this.onGrid("slot-resize",l.detail)}
            @slot-remove=${l=>this.onGrid("slot-remove",l.detail)}
            @row-add=${l=>this.onGrid("row-add",l.detail)}
            @row-select=${l=>this.onGrid("row-select",l.detail)}
          ></sw-schedule-grid>
          ${i?u:r`<div class="foot">${a("גררו על ציר ריק ליצירה · גררו משבצת להזזה · משכו קצה לשינוי אורך · הצמדה ל־{n} דקות · הקצה העבה הוא רגע הביצוע",{n:this.snap})}</div>`}`}
    </div>`}renderPanel(){const t=this.idxOf(this.selected),e=t>=0?this.work[t]:null;if(!e)return u;const s=A(this.work),i=lt(s,t)!==null,n=this.errorsByUid()[e.uid]??[];return r`<div class="card panelcard" data-panel-card>
      <schedule-slot-panel
        .slotData=${e}
        .index=${t}
        .count=${this.work.length}
        .meta=${this.meta}
        .entityIds=${this.entityIds}
        .allowNegativeSun=${this.allowNegativeSun}
        .readOnly=${this.readOnly}
        .locked=${this.lockedUids[e.uid]??[]}
        .errors=${n}
        .paired=${i}
        .canPair=${!!At(s[t])}
        .canCopyDays=${!!I(this.draft.weekdays)}
        @slot-change=${o=>this.onSlotChange(o.detail.slot)}
        @slot-delete=${()=>this.removeAt(t)}
        @slot-duplicate=${()=>this.onDuplicate(e.uid)}
        @slot-copy-days=${()=>this.openCopyDays()}
        @slot-close=${()=>this.selected=""}
        @pair-off=${o=>this.onPairOff(o.detail.on)}
      ></schedule-slot-panel>
    </div>`}renderKavConflicts(){const t=this.kavConflicts;return!t.length||this.readOnly?u:r`<div class="kav-vbox" role="status" data-kav-conflicts><b><sw-icon name="warning" size="16"></sw-icon>${Zt(t.length)}<small>· ${this.kavSaveWithWarnings?a("אפשר לשמור עם אזהרות"):a("יש לטפל באזהרות לפני השמירה")}</small></b>
      ${t.map(e=>r`<div class="kav-iss" data-kav-conflict=${e.other.id}><b>${e.title}</b><span>${e.detail}</span>
        ${(()=>{const s=Jt(e),i=wt(e),n=i===null?void 0:this.draft.slots[i],o=!!n&&ct(n.start)?.kind==="fixed";return s&&o&&!this.override&&!this.readOnly?r`<sw-button size="sm" data-kav-move-slot @click=${()=>this.moveConflictSlot(e)}>${a("הזזת המשבצת ל־{time}",{time:s.to})}</sw-button>`:u})()}
        <sw-button size="sm" data-kav-open-other @click=${()=>St(e.other.kind==="schedule"?`/devices/schedules/${encodeURIComponent(e.other.id)}/edit`:`/devices/automations/${encodeURIComponent(e.other.id)}`)}>${e.other.kind==="schedule"?a("פתיחת התזמון"):a("פתיחת האוטומציה")}</sw-button></div>`)}
    </div>`}renderSide(){const t=this.validation,e=this.readOnly,s=this.draft,i=I(s.weekdays),n=this.entityIds,o=this.preview?.upcoming?.length?this.preview.upcoming:this.schedule?.upcoming?.length?this.schedule.upcoming:xe(this.currentDraft(),new Date,this.sunNow),c=s.conditions.items.length>0,d=this.status?.settings.shabbat_sensor??null,l=t.warnings.filter(p=>p.path.startsWith("conditions")),h=p=>p.summary??this.slotSummaryText(p.slot_index);return r`<aside class="card side" data-side>
      ${this.renderKavConflicts()}
      <div class="status ${t.errors.length&&this.showErrors?"bad":t.errors.length?"":"ok"}" data-validation-status style=${t.errors.length&&!this.showErrors?"display:none":""}>
        <sw-icon name=${t.errors.length?"warning":"check"} size="16"></sw-icon>
        ${t.errors.length?r`<ul>${t.errors.map(p=>r`<li><button type="button" @click=${()=>this.jumpTo(p)}>${p.message}</button></li>`)}</ul>`:r`<span>${e?a("התזמון תקין."):a("התזמון תקין ומוכן לשמירה.")}${t.warnings.filter(p=>!p.path.startsWith("conditions")).map(p=>r`<div>${p.message}</div>`)}</span>`}
      </div>
      <div class="sec">
        <h4>${a("פרטים")} ${this.schedule?.sensitive||this.entityIds.some(p=>this.meta.get(p)?.sensitive)?r`<span class="chip sens"><sw-icon name="shield" size="12"></sw-icon>${a("רגיש")}</span>`:u}</h4>
        <div class="field"><label for="name">${a("שם")}</label><input id="name" type="text" data-editor-name maxlength="80" ?disabled=${e} .value=${s.name??""} placeholder=${this.creating?a("שם התזמון"):""} @input=${p=>this.patch({name:p.target.value})} /></div>
        ${this.creating&&!e?r`<div class="field"><sw-toggle .checked=${this.enabledNew} label=${a("התזמון פעיל")} @change=${p=>this.enabledNew=p.detail.checked}></sw-toggle></div>`:u}
        ${s.tags.length||this.status?.capabilities.tags?r`<div class="tags" data-tags>${s.tags.map(p=>r`<span class="chip">${p}</span>`)}</div>`:u}
      </div>
      <div class="sec" data-devices>
        <h4>${a("התקנים")} <small>(${n.length})</small></h4>
        <div class="tags">${n.map(p=>r`<span class="ent">${this.meta.get(p)?.name??p}${e?u:r`<button type="button" aria-label=${a("הסרת {name}",{name:this.meta.get(p)?.name??p})} @click=${()=>this.removeEntity(p)}><sw-icon name="close" size="12"></sw-icon></button>`}</span>`)}</div>
        ${e?u:r`<div style="margin-block-start:8px"><sw-button size="sm" icon="plus" data-open-picker @click=${()=>this.pickerOpen=!0}>${a("בחירת התקנים…")}</sw-button></div>`}
      </div>
      <div class="sec" data-days>
        <h4>${a("ימים")}</h4>
        <div class="days" role="group" aria-label=${a("ימי התזמון")}>
          ${V.map(p=>r`<button type="button" data-day-chip=${p} aria-pressed=${!!i?.includes(p)} aria-label=${R[p]} ?disabled=${e||!!this.override} @click=${()=>this.patch({weekdays:Kt(s.weekdays,p)})}>${K[p]}</button>`)}
        </div>
        ${i?u:r`<div class="chip">${tt(s.weekdays)}</div>`}
        ${e?u:r`<div class="quick">
          <button type="button" data-days-preset="daily" ?disabled=${!!this.override} @click=${()=>this.patch({weekdays:["daily"]})}>${a("כל יום")}</button>
          <button type="button" data-days-preset="work" ?disabled=${!!this.override} @click=${()=>this.patch({weekdays:["sun","mon","tue","wed","thu"]})}>${a("א׳–ה׳")}</button>
          <button type="button" data-days-preset="weekend" ?disabled=${!!this.override} @click=${()=>this.patch({weekdays:["fri","sat"]})}>${a("סוף שבוע")}</button>
        </div>`}
      </div>
      <div class="sec" data-repeat>
        <h4>${a("חזרה")}</h4>
        <div class="repeat" role="group" aria-label=${a("חזרה")}>
          ${["repeat","pause","single"].map(p=>r`<button type="button" data-repeat-btn=${p} aria-pressed=${s.repeat===p} ?disabled=${e} @click=${()=>this.patch({repeat:p})}>${{repeat:a("חוזר"),pause:a("פעם אחת, מושהה"),single:a("פעם אחת, נמחק")}[p]}</button>`)}
        </div>
        ${s.repeat==="single"?r`<div class="hint" style="color:var(--sw-warning-text)" data-single-warning>${a("התזמון יימחק אחרי ההרצה האחרונה.")}</div>`:u}
      </div>
      <div class="sec" data-period>
        <h4>${a("תקופה")}</h4>
        <div class="dates">
          <div class="field"><label for="from">${a("מתאריך")}</label><input id="from" type="date" lang=${ft()} data-date-from ?disabled=${e} .value=${s.start_date??""} @change=${p=>this.patch({start_date:p.target.value||null})} /></div>
          <div class="field"><label for="to">${a("עד תאריך")}</label><input id="to" type="date" lang=${ft()} data-date-to ?disabled=${e} .value=${s.end_date??""} @change=${p=>this.patch({end_date:p.target.value||null})} /></div>
        </div>
      </div>
      <div class="sec" data-conditions-sec>
        <h4>${a("תנאים")} <small>${c?"":a("ללא תנאים")}</small></h4>
        <schedule-conditions
          .conditions=${s.conditions}
          .views=${this.schedule?.conditions.items??[]}
          .sensor=${d}
          .canConfigure=${!!this.status?.can.configure}
          .warnings=${l}
          .readOnly=${e}
          @conditions-change=${p=>{p.detail.names&&(this.condNames={...this.condNames,...p.detail.names}),this.patch({conditions:p.detail.conditions})}}
          @preset-motzash=${()=>this.applyMotzash()}
        ></schedule-conditions>
      </div>
      <div class="sec" data-upcoming>
        <h4>${a("ההרצות הבאות")}</h4>
        ${o.length?r`<ul class="runs">${o.slice(0,5).map(p=>r`<li><span>${ht(p.at)}${c?r` <span class="cond">· ${a("בתנאי")}</span>`:u}</span><span>${h(p)}</span></li>`)}</ul>`:r`<div class="hint">${a("אין הרצה קרובה.")}</div>`}
      </div>
    </aside>`}condView(){const t=this.draft.conditions,e=this.status?.settings.shabbat_sensor?.entity_id??null,s={...this.condNames};for(const i of this.schedule?.conditions.items??[])s[i.entity_id]=i.name;return this.status?.settings.shabbat_sensor&&(s[this.status.settings.shabbat_sensor.entity_id]=this.status.settings.shabbat_sensor.name),{items:t.items.map(i=>({...i,name:s[i.entity_id]??i.entity_id,readable:!0,state:null,available:null,locked:!1})),type:t.type,track:t.track,uniform:!0,summary:ze(t,s,e),preset:ke(t,e)}}slotSummaryText(t){const e=this.draft.slots[t];if(!e)return"";const s=L(e.actions)[0];return s?`${j({service:s.service,data:s.data})} · ${s.entities.map(i=>i?this.meta.get(i)?.name??i:"").join(", ")}`:""}applyMotzash(){const t=this.status?.settings.shabbat_sensor?.entity_id;if(!t||this.readOnly)return;const e=Qe(t),s={weekdays:e.weekdays,conditions:e.conditions};if(!this.draft.slots.length){const i=T({start:e.start,stop:null,actions:[]});s.slots=Xt([{...i,intent:{kind:"off"}}],this.entityIds.map(n=>this.meta.get(n)).filter(n=>!!n))}this.override=null,this.patch(s)}jumpTo(t){const e=t.path.startsWith("override."),s=at(t.path.replace(/^override\./,"")),i=e?this.override?.slots:this.draft.slots;s>=0&&i?.[s]&&(this.selected=i[s].uid,this.phoneTab="board",this.reveal())}renderDialogs(){const t=this.conflict?ts(this.currentDraft(),Nt(this.conflict.current),s=>s?this.meta.get(s)?.name??s:a("ללא התקן"),tt):[],e=new Set(I(this.draft.weekdays)??[]);return r`
      <schedule-entity-picker ?open=${this.pickerOpen} .selected=${this.entityIds} @close=${()=>this.pickerOpen=!1} @confirm=${s=>this.onPicked(s.detail.ids,s.detail.entities)}></schedule-entity-picker>
      <schedule-lowering-dialog
        ?open=${!!this.lowering}
        .summary=${this.lowering?.summary??{entities:[],kinds:[],times:"",sensitive:!0,lowering:!0}}
        .needsCode=${this.lowering?.needsCode??!1}
        .busy=${this.saving}
        .error=${this.lowering?.error??""}
        @confirm=${s=>this.onLoweringConfirm(s.detail.alarm_code)}
        @close=${()=>this.lowering=null}
      ></schedule-lowering-dialog>
      <sw-dialog ?open=${!!this.splitDialog&&!this.lowering} heading=${a("פיצול התזמון")} data-split-dialog @close=${()=>this.splitDialog=null}>
        ${this.override?r`<div>${a("נפצל לשני תזמונים:")} <b>${this.override.days.map(s=>R[s]).join(", ")}</b> ${a("יהיו תזמון נפרד, ו")}<b>${a("שאר הימים")}</b> ${a("יישארו בתזמון הנוכחי. שני התזמונים יכללו את אותם התקנים, תנאים ותקופה.")}</div>
              <div class="field" style="margin-block-start:10px"><label for="split-name">${a("שם התזמון החדש")}</label><input id="split-name" type="text" data-split-name style="inline-size:100%" .value=${this.splitDialog?.name??""} @input=${s=>this.splitDialog={name:s.target.value}} /></div>`:u}
        <div slot="footer" style="display:contents">
          <sw-button ?disabled=${this.saving} @click=${()=>this.splitDialog=null}>${a("ביטול")}</sw-button>
          <sw-button variant="primary" data-split-ok ?disabled=${this.saving} @click=${()=>void this.persistSplit(this.splitDialog?.name??"")}>${this.saving?a("מפצל…"):a("פיצול ושמירה")}</sw-button>
        </div>
      </sw-dialog>
      <sw-dialog ?open=${this.copyOpen} heading=${this.override?a("העתקת הסידור לימים"):a("העתקה לימים")} data-copy-dialog @close=${()=>this.copyOpen=!1}>
        <div class="days" role="group" aria-label=${a("ימים")}>
          ${V.map(s=>{const i=e.has(s),n=this.copyPick.includes(s)||!this.override&&i,o=this.override?!i:i;return r`<button type="button" data-copy-day=${s} aria-pressed=${n} ?disabled=${o} aria-label=${R[s]} @click=${()=>this.copyPick=this.copyPick.includes(s)?this.copyPick.filter(c=>c!==s):[...this.copyPick,s]}>${K[s]}</button>`})}
        </div>
        <div class="hint">${this.override?a("הימים שיקבלו את הסידור הזה (כולם יפוצלו יחד לתזמון נפרד)."):a("הימים שנוספים לתזמון יקבלו את אותן משבצות, כמו שאר הימים המקושרים.")}</div>
        <div slot="footer" style="display:contents">
          <sw-button @click=${()=>this.copyOpen=!1}>${a("ביטול")}</sw-button>
          <sw-button variant="primary" data-copy-ok @click=${()=>this.applyCopyDays()}>${a("אישור")}</sw-button>
        </div>
      </sw-dialog>
      <sw-dialog ?open=${this.kavDry} heading=${a("בדיקה בלי הפעלה")} data-kav-dry-dialog @close=${()=>this.kavDry=!1}>
        <div class="hint">${a("לא מופעל דבר. כך התזמון יפעל בפעמים הקרובות לפי מה שמוצג עכשיו, כולל שינויים שעוד לא נשמרו.")}</div>
        ${(this.preview?.upcoming??[]).length?r`<ul class="runs">${(this.preview?.upcoming??[]).slice(0,10).map(s=>r`<li><span>${ht(s.at)}</span><span>${s.summary??this.slotSummaryText(s.slot_index)}</span></li>`)}</ul>`:r`<div>${a("אין הרצה קרובה.")}</div>`}
        ${this.kavConflicts.length?r`<div class="hint" data-kav-dry-conflicts>${Zt(this.kavConflicts.length)} ${a("בהתנגשות עם פריטים אחרים (מוצגות בתיבה שמעל הלוח).")}</div>`:u}
        <div slot="footer" style="display:contents"><sw-button variant="primary" @click=${()=>this.kavDry=!1}>${a("סגירה")}</sw-button></div>
      </sw-dialog>
      <sw-dialog ?open=${this.kavDevOpen} heading=${a("בדיקה על ההתקן")} data-kav-devtest-dialog @close=${()=>this.kavDevOpen=!1}>
        ${this.kavDevOpen?r`<kav-device-test source="schedule" .itemId=${this.scheduleId} .draft=${this.currentDraft()} .flags=${{device_test_end:this.kavDevTestEnd}}
          @test-close=${()=>this.kavDevOpen=!1}></kav-device-test>`:u}
      </sw-dialog>
      <sw-dialog ?open=${this.compareOpen} heading=${a("השוואה לגרסה החדשה")} data-compare-dialog @close=${()=>this.compareOpen=!1}>
        ${t.length?r`<table style="inline-size:100%;border-collapse:collapse;font-size:var(--sw-fs-sm)">
              <thead><tr><th style="text-align:start;padding:4px">${a("שדה")}</th><th style="text-align:start;padding:4px">${a("אצלכם")}</th><th style="text-align:start;padding:4px">${a("בגרסה החדשה")}</th></tr></thead>
              <tbody>${t.map(s=>r`<tr style="vertical-align:top"><td style="padding:4px;font-weight:600">${s.label}</td><td style="padding:4px;white-space:pre-line">${s.mine}</td><td style="padding:4px;white-space:pre-line">${s.theirs}</td></tr>`)}</tbody>
            </table>`:r`<div>${a("אין הבדלים בתוכן.")}</div>`}
        <div slot="footer" style="display:contents"><sw-button variant="primary" @click=${()=>this.compareOpen=!1}>${a("סגירה")}</sw-button></div>
      </sw-dialog>
      <sw-dialog ?open=${!!this.leave} heading=${a("יש שינויים שלא נשמרו")} data-leave-dialog @close=${()=>this.leave=null}>
        <div>${a("אם תצאו עכשיו, השינויים שערכתם יאבדו.")}</div>
        <div slot="footer" style="display:contents">
          <sw-button data-leave-stay @click=${()=>this.leave=null}>${a("הישארות")}</sw-button>
          <sw-button variant="danger" data-leave-go @click=${()=>this.leave&&this.go(this.leave.href)}>${a("יציאה בלי לשמור")}</sw-button>
        </div>
      </sw-dialog>`}render(){if(this.loading)return r`<sw-page wide heading=${a("עריכת תזמון")}><sw-state-panel state="loading" data-editor-state="loading"></sw-state-panel></sw-page>`;if(this.forbidden||this.loadError&&!this.schedule&&!this.creating)return r`<sw-page wide heading=${a("עריכת תזמון")} crumbs=${`${a("תזמונים")}|${a("עריכה")}`}><sw-state-panel icon="calendar" data-editor-state=${this.forbidden?"forbidden":"error"} state=${this.forbidden?"forbidden":"error"} heading=${this.forbidden?a("התזמון לא נמצא"):""} hint=${this.forbidden?a("ייתכן שנמחק, או שאינו בהרשאתכם."):this.loadError} actionLabel=${this.forbidden?"":a("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;if(this.creating&&!this.status?.can.manage&&this.status)return r`<sw-page wide heading=${a("תזמון חדש")} crumbs=${`${a("תזמונים")}|${a("חדש")}`}><sw-state-panel data-editor-state="forbidden" state="forbidden" hint=${a("אין הרשאה ליצור תזמונים.")}></sw-state-panel></sw-page>`;const t=(this.draft.name??"").trim()||(this.schedule?.display_name??(this.creating?a("תזמון חדש"):a("תזמון"))),e=this.readOnly,s=this.entityIds.some(i=>this.meta.get(i)?.sensitive)||!!this.schedule?.sensitive;return r`<sw-page wide heading=${t} crumbs=${`${a("תזמונים")}|${this.creating?a("חדש"):a("עריכה")}`} data-editor data-editor-mode=${e?"view":this.creating?"new":"edit"}>
      <div slot="actions" class="actions">
        ${this.schedule?r`<span class="ver" title=${a("גרסה")}>${a("גרסה {rev}",{rev:this.schedule.revision.slice(0,4)})}</span>`:u}
        <schedule-condition-chip data-condition-chip .conditions=${this.condView()}></schedule-condition-chip>
        ${s?r`<sw-schedule-markers data-sensitive-badge .sensitive=${!0} .lowering=${Y(this.currentDraft(),this.meta).lowering}></sw-schedule-markers>`:u}
        ${this.kavOn&&!e?r`<sw-button icon="play" data-kav-dry @click=${()=>this.kavDry=!0}>${a("בדיקה בלי הפעלה")}</sw-button>`:u}
        ${this.kavDevTest&&!e&&!this.creating?r`<sw-button icon="play" data-kav-devtest @click=${()=>this.kavDevOpen=!0}>${a("בדיקה על ההתקן")}</sw-button>`:u}
        <sw-button data-editor-cancel @click=${()=>this.cancel()}>${e?ce("actions.back"):a("ביטול")}</sw-button>
        ${e?u:this.kavConflicts.length?r`<sw-button icon="warning" data-editor-save data-editor-save-warnings ?disabled=${!this.dirty||this.saving||!this.kavSaveWithWarnings} @click=${()=>void this.onSave()}>${this.saving?a("שומר…"):a("שמירה עם אזהרות")}</sw-button>`:r`<sw-button variant="primary" icon="check" data-editor-save ?disabled=${!this.dirty||this.saving} @click=${()=>void this.onSave()}>${this.saving?a("שומר…"):a("שמירה")}</sw-button>`}
      </div>
      ${this.renderBanners()}
      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected=${this.phoneTab==="board"} data-phone-tab="board" @click=${()=>this.phoneTab="board"}>${a("לוח זמנים")}</button>
        <button type="button" role="tab" aria-selected=${this.phoneTab==="settings"} data-phone-tab="settings" @click=${()=>this.phoneTab="settings"}>${a("הגדרות")}</button>
      </div>
      <div class="layout" data-tab=${this.phoneTab}>
        <div class="col boardcol">${this.renderBoard()}${this.renderPanel()}</div>
        ${this.renderSide()}
      </div>
      ${this.renderDialogs()}
    </sw-page>`}};w.styles=[...he,pe,ue,q`
    /* KAV079-295: the conflict box of the schedule editor (mockup r079 state 7) */
    .kav-vbox { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: var(--sw-r-lg); margin-block-end: 10px;
      background: color-mix(in srgb, var(--dv-warning) 10%, transparent); border: 1px solid color-mix(in srgb, var(--dv-warning) 35%, transparent); }
    .kav-vbox > b { display: flex; gap: 8px; align-items: center; }
    .kav-vbox > b small { font-weight: var(--sw-fw-regular); color: var(--dv-text-2, var(--sw-text-2)); }
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
    /* R5-DEVICES-297: the editor's panels are the top step (shadow 2, larger radius) */
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
    /* CR-CMP2-SEGMENTED-C-2450: the view switch is sw-segmented - its 2 px track, 36 px keys and bold chosen label through the knobs */
    .toolbar sw-segmented {
      --sw-seg-pad: 2px;
      --sw-seg-gap: 0px;
      --sw-seg-radius: var(--sw-r-sm);
      --sw-seg-btn-radius: var(--sw-r-sm);
      --sw-seg-h: 36px;
      --sw-seg-fs: var(--sw-fs-base);
      --sw-seg-fw: var(--sw-fw-semibold);
      --sw-seg-on-fw: var(--sw-fw-bold);
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
    /* DU1: the same state tokens as sw-schedule-grid's --sc-* knobs, so the legend and the grid agree in every scheme and skin */
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
    /* ------------------------------------------------------------------ side */
    /* R5-DEVICES-297 loop 2: the side panel's section titles are headings (lg/700, heading ink), not grey labels */
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
      .toolbar sw-segmented {
        --sw-seg-key-pad: 9px;
      }
    }
  `];m([f()],w.prototype,"scheduleId",2);m([f()],w.prototype,"template",2);m([f()],w.prototype,"preset",2);m([f()],w.prototype,"entity",2);m([f({attribute:!1})],w.prototype,"sun",2);m([v()],w.prototype,"loading",2);m([v()],w.prototype,"loadError",2);m([v()],w.prototype,"forbidden",2);m([v()],w.prototype,"status",2);m([v()],w.prototype,"schedule",2);m([v()],w.prototype,"draft",2);m([v()],w.prototype,"override",2);m([v()],w.prototype,"meta",2);m([v()],w.prototype,"lockedUids",2);m([v()],w.prototype,"enabledNew",2);m([v()],w.prototype,"view",2);m([v()],w.prototype,"day",2);m([v()],w.prototype,"selected",2);m([v()],w.prototype,"snap",2);m([v()],w.prototype,"phone",2);m([v()],w.prototype,"phoneTab",2);m([v()],w.prototype,"preview",2);m([v()],w.prototype,"kavConflicts",2);m([v()],w.prototype,"kavSaveWithWarnings",2);m([v()],w.prototype,"kavOn",2);m([v()],w.prototype,"kavDry",2);m([v()],w.prototype,"kavDevTest",2);m([v()],w.prototype,"kavDevTestEnd",2);m([v()],w.prototype,"kavDevOpen",2);m([v()],w.prototype,"showErrors",2);m([v()],w.prototype,"saving",2);m([v()],w.prototype,"saveError",2);m([v()],w.prototype,"note",2);m([v()],w.prototype,"pickerOpen",2);m([v()],w.prototype,"copyOpen",2);m([v()],w.prototype,"copyPick",2);m([v()],w.prototype,"splitDialog",2);m([v()],w.prototype,"lowering",2);m([v()],w.prototype,"conflict",2);m([v()],w.prototype,"compareOpen",2);m([v()],w.prototype,"leave",2);m([v()],w.prototype,"gone",2);m([v()],w.prototype,"stash",2);m([v()],w.prototype,"nowMin",2);m([v()],w.prototype,"condNames",2);m([v()],w.prototype,"chosen",2);w=m([F("schedule-editor")],w);export{w as ScheduleEditor};
