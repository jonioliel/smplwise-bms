import{j as B,z as b,a as Q,A as c,cL as $,b as o,m as H,k as h,iH as ii,e3 as ct,ei as qe,p$ as Bi,pJ as Zt,pz as Fi,l3 as ji,bC as es,bo as it,a8 as X,af as et,bg as Xe,cd as qi,F as Qe,bw as Ui,bO as ts,bs as Ft,bu as Vi,br as Wi,bt as Hi,aX as Ee,aj as N,fj as ai,q6 as ni,c as ss,hP as Gi,u as is,ae as Yi,AY as Ki,l7 as as,cj as k,d7 as Le,jg as Ji,la as ns,l8 as Xi,bW as Qi,iJ as Zi,aZ as ea,l9 as ta,g as mt,ld as rs,le as os,lf as ls,lg as ds,cM as sa,bz as ia,bA as aa}from"./index-CVsAtsN7.js";import{i as na,b as f,e as ra,f as oa,g as la,h as da,p as bt,j as It,s as ca,w as pa,k as ua}from"./automation-ext-dialogs-BCfYlpNQ.js";import{Q as ge,N as Se,a8 as pt,a9 as cs,n as ri,E as tt,u as Pt,w as pe,k as ha,a6 as jt,C as st,aa as At,d as va,I as fa,ab as oi,ac as li,a5 as di,ad as ps,J as ci,ae as ma,Y as ba,af as us,b as ga,a7 as wa,ag as $a,v as ya,a as xa,V as hs,ah as ke,M as j,h as ka,c as vs,ai as pi,aj as ui,ak as _a,al as fs,$ as Nt,a0 as hi,a1 as za,am as vi,a3 as fi,an as Sa,ao as Oa,ap as Ea,aq as ms,g as Da,ar as Ca,p as Ta,F as Ia,S as mi,as as Pa,T as Aa,a2 as Na,U as bs,at as Ra}from"./automations-Cn2EeGom.js";import{t as n}from"./automation-DivH_Svc.js";import{b as bi,x as qt,n as Ut,v as Vt,g as w,u as Wt,y as La,o as gt,z as Ma,A as Ba,O as Fa,B as ja,c as ee,D as qa,E as Ua,F as Va,G as gi,s as at,N as gs,H as ws,I as Me,i as A,J as $s,K as _e,a as wt,L as Wa,M as ys,P as me,Q as xs,T as Ha,U as Ga,V as ks,W as Ya,S as Ka,X as Ja,Y as Xa,Z as Qa,_ as _s,$ as Za,a0 as en,a1 as tn,a2 as sn,a3 as an}from"./automations-logic-r9m64K9U.js";import{a4 as Sl}from"./automations-logic-r9m64K9U.js";import{S as nn}from"./schedule-create-dialog-ieVXSQz2.js";import{K as Ze}from"./editor-guards-CEHbVbIV.js";import{a as ye}from"./automations-glass-B2HDAEjC.js";import{a as De}from"./glass-D86AXCLx.js";import{b as Ce}from"./bubble-chrome-CFvMZX-M.js";import{l as wi}from"./live-BzyW7Ndf.js";import"./sw-pager-DsSWfKm-.js";import{L as rn,p as zs}from"./long-lists-D-ITs2rX.js";import{l as on,c as ln,s as dn,d as Ss,b as v,i as $t,n as Os,e as cn,f as pn,h as un,j as yt,k as hn,t as vn,m as fn,u as mn,o as bn,p as gn,q as wn,r as $n,v as yn,w as xn,x as kn,y as _n}from"./scenario-recipients-DN8VGQyy.js";import{a as zn,m as Sn}from"./media-page-Cxc0M3UO.js";import{l as On}from"./schedules-DQSJEhFL.js";import"./sw-logo-art-PLtEZJxU.js";import"./physical-outcome-DQz8AxWW.js";import"./confirm-dialog-CUSAvSFK.js";import"./memo-CyxK7byc.js";import"./lead-reserve-C0-lsC8U.js";import"./confirm-words-CwRWhfCA.js";const En=B`
  :host {
    --ab-motion: 200ms;
    --ab-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --ab-sheet: color-mix(in srgb, var(--dv-surface-solid) 92%, transparent);
    --ab-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 46%);
    --ab-seg-thumb: #ffffff;
    --ab-amber-text: #8a4b00;
    --ab-sens-bg: var(--dv-warning-soft);
    --ab-sens-fg: var(--ab-amber-text);
    --ab-sens-line: color-mix(in srgb, var(--dv-warning) 55%, transparent);
    --ab-ok-text: #1a7f37;
    font-family: var(--dv-font, var(--sw-font));
    color: var(--dv-text, var(--sw-text));
  }
  :host([data-devices-scheme='dark']) {
    --ab-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.015) 50%);
    --ab-seg-thumb: rgba(118, 118, 128, 0.5);
    --ab-amber-text: #ffc46b;
    --ab-ok-text: #5ee08a;
  }
  /* the sensitive-step chip colour is the SETTING automations.sensitive_chip (amber | red) */
  :host([data-chip='red']) {
    --ab-sens-bg: var(--dv-danger-soft);
    --ab-sens-fg: var(--dv-danger);
    --ab-sens-line: color-mix(in srgb, var(--dv-danger) 50%, transparent);
  }
  :host([data-chip='red'][data-devices-scheme='dark']) {
    --ab-sens-fg: #ff8a80;
  }
`,Te=[na,B`
    :host {
      font-family: var(--dv-font, var(--sw-font));
      color: var(--dv-text, var(--sw-text));
    }
    * {
      box-sizing: border-box;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    summary:focus-visible {
      outline: 2px solid var(--dv-focus, var(--sw-focus));
      outline-offset: 2px;
    }
    /* ---- chips ---- */
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      block-size: 24px;
      padding: 0 9px;
      border-radius: 999px;
      background: var(--dv-neutral-soft, var(--sw-surface-3));
      color: var(--dv-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      flex: none;
    }
    .tag .ic {
      font-size: var(--sw-fs-sm);
    }
    .tag.warn {
      background: var(--dv-warning-soft);
      color: var(--ab-amber-text, var(--sw-warning-text));
    }
    .tag.bad {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .tag.ok {
      background: var(--dv-success-soft);
      color: var(--ab-ok-text);
    }
    .tag.acc {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .tag.lock {
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
    }
    .tag.sens {
      background: var(--ab-sens-bg, var(--dv-warning-soft));
      color: var(--ab-sens-fg, var(--sw-warning-text));
    }
    code {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
      background: var(--dv-surface-3);
      padding: 1px 6px;
      border-radius: var(--sw-r-xs);
      color: var(--dv-text-2);
    }
    /* ---- buttons (pills, 44 px on a phone) ---- */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-block-size: 40px;
      padding-inline: 16px;
      border-radius: 999px;
      border: 1px solid var(--dv-border-strong);
      background: var(--dv-surface-2, var(--sw-surface));
      color: var(--dv-text);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      box-shadow: var(--dv-shadow-1);
      transition: background var(--ab-motion, 200ms), opacity var(--ab-motion, 200ms);
    }
    .btn:hover:not(:disabled) {
      background: var(--dv-surface-3);
    }
    .btn.primary {
      background: var(--dv-accent);
      border-color: var(--dv-accent);
      color: #fff;
      box-shadow: 0 6px 16px color-mix(in srgb, var(--dv-accent) 35%, transparent);
    }
    .btn.primary:hover:not(:disabled) {
      background: var(--dv-accent-hover, var(--dv-accent));
    }
    .btn.quiet {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .btn.danger {
      color: var(--dv-danger);
      border-color: color-mix(in srgb, var(--dv-danger) 40%, transparent);
    }
    .btn.sm {
      min-block-size: 34px;
      padding-inline: 12px;
      font-size: var(--sw-fs-sm);
    }
    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .btn .ic {
      font-size: var(--sw-fs-lg);
    }
    /* ---- form controls ---- */
    .frow {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .fld {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-inline-size: 0;
      flex: 1 1 140px;
    }
    .fld.sm {
      flex: 0 1 110px;
    }
    .fld.full {
      flex: 1 1 100%;
    }
    /* a field inside a field (the forms wrap labelled controls): the inner one never stretches in the column */
    .fld .fld {
      flex: none;
    }
    .fld > label,
    .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .inp,
    .selx {
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 40px;
      padding: 0 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-solid, var(--dv-surface));
      color: var(--dv-text);
      font-size: var(--sw-fs-base);
      min-inline-size: 0;
      font-family: inherit;
    }
    .inp:focus-within,
    .selx:focus {
      outline: 2px solid var(--dv-focus);
      outline-offset: 1px;
    }
    .inp input,
    .inp textarea {
      border: 0;
      background: transparent;
      outline: none;
      flex: 1;
      min-inline-size: 0;
      font: inherit;
      color: inherit;
      text-align: start;
    }
    .inp input.n {
      text-align: center;
      direction: ltr;
    }
    .inp .u {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .inp.area {
      block-size: auto;
      padding-block: 8px;
      align-items: flex-start;
    }
    .inp.area textarea {
      resize: vertical;
      min-block-size: 56px;
    }
    .selx {
      -webkit-appearance: none;
      appearance: none;
      padding-inline-end: 32px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236e6e73' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: left 10px center;
      background-size: 16px;
      inline-size: 100%;
    }
    :host-context([dir='ltr']) .selx {
      background-position: right 10px center;
    }
    .selx.sm {
      block-size: 34px;
      font-size: var(--sw-fs-sm);
    }
    .rolechips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .rolechips button {
      min-block-size: 34px;
      min-inline-size: 38px;
      padding-inline: 12px;
      border-radius: 999px;
      border: 1px solid var(--dv-border-strong);
      background: transparent;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--dv-text-2);
    }
    .rolechips button[aria-pressed='true'] {
      background: var(--dv-accent-soft);
      border-color: var(--dv-accent);
      color: var(--dv-accent-text);
    }
    /* ---- segmented control ---- */
    .seg {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: var(--dv-surface-3);
      border-radius: 999px;
      padding: 3px;
      max-inline-size: 100%;
    }
    .seg button {
      border: 0;
      background: transparent;
      border-radius: 999px;
      padding: 4px 14px;
      min-block-size: 30px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--dv-text-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
    }
    .seg button[aria-pressed='true'],
    .seg button[aria-selected='true'] {
      background: var(--ab-seg-thumb);
      color: var(--dv-text);
      box-shadow: var(--dv-shadow-control);
    }
    /* CR-CMP2-TABS-2460: the editors' tab strips (builder / code, the device test's mode) are sw-tabs (pill), in the sheet's palette
       (devices.scheme, not the app's theme) through the tokens the pill and the skins' pill rules read - the .seg look above */
    sw-tabs[variant='pill'] {
      --sw-surface-3: var(--dv-surface-3);
      --sw-text: var(--dv-text);
      --sw-text-2: var(--dv-text-2);
      --sw-accent-text: var(--dv-text);
      --sw-seg-key: var(--ab-seg-thumb);
      --sw-seg-key-ink: var(--dv-text);
      --sw-seg-thumb-shadow: var(--dv-shadow-control);
      --sw-tabs-key-h: 30px;
    }
    @media (max-width: 767px) {
      .btn {
        min-block-size: 44px;
      }
      .inp,
      .selx {
        block-size: 44px;
      }
      .rolechips button {
        min-block-size: 40px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `];var Dn=Object.defineProperty,Cn=Object.getOwnPropertyDescriptor,Z=(e,t,s,i)=>{for(var a=i>1?void 0:i?Cn(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Dn(t,s,a),a};let K=class extends Q{constructor(){super(...arguments),this.icon="bolt",this.heading="",this.chips=[],this.open=!1,this.locked=!1,this.invalid=!1,this.nested=!1,this.readonly=!1,this.canUp=!1,this.canDown=!1,this.canDuplicate=!0,this.uid=""}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}onKey(e){if(!e.altKey||e.key!=="ArrowUp"&&e.key!=="ArrowDown"||this.readonly)return;e.preventDefault();const t=e.key==="ArrowUp"?-1:1;(t<0&&this.canUp||t>0&&this.canDown)&&this.fire("card-move",{delta:t,from:"key"})}onDragStart(e){if(this.readonly)return;const t=this.shadowRoot?.querySelector(".blk");e.dataTransfer?.setData("text/plain",this.uid),e.dataTransfer&&(e.dataTransfer.effectAllowed="move",t&&e.dataTransfer.setDragImage(t,20,24)),this.fire("card-dragstart",{uid:this.uid})}render(){return o`<div class="blk">
      <div class="bh">
        <button class="grip" type="button" draggable="true" tabindex="-1" aria-label=${$("גרירה")} title=${$("גרירה (Alt + חצים להזזה)")} @dragstart=${this.onDragStart}>${f("grip")}</button>
        <button class="bm" type="button" aria-expanded=${this.open} data-block-main @click=${()=>this.fire("card-toggle")} @keydown=${this.onKey}>
          <span class="rg">${f(this.icon)}</span>
          <span class="bt"><b dir="auto">${this.heading}</b>${this.chips.length?o`<span class="sub">${this.chips.map(e=>this.chip(e))}</span>`:c}</span>
        </button>
        <button class="xb" type="button" aria-label=${$("מחיקת החלק")} data-block-remove @click=${()=>this.fire("card-remove")}>${f("close")}</button>
      </div>
      ${this.open?o`<div class="body">
        ${this.readonly?c:o`<div class="tools">
          <button type="button" aria-label=${$("הזז למעלה")} data-block-up ?disabled=${!this.canUp} @click=${()=>this.fire("card-move",{delta:-1,from:"button"})}>${f("arrowUp")}</button>
          <button type="button" aria-label=${$("הזז למטה")} data-block-down ?disabled=${!this.canDown} @click=${()=>this.fire("card-move",{delta:1,from:"button"})}>${f("arrowDown")}</button>
          ${this.canDuplicate?o`<button type="button" aria-label=${$("שכפול")} data-block-dup @click=${()=>this.fire("card-duplicate")}>${f("copy")}</button>`:c}
        </div>`}
        <slot></slot>
      </div>`:c}
    </div>`}chip(e){return e.tone==="code"?o`<code title=${e.title??""}>${e.text}</code>`:o`<span class="tag ${e.tone==="why"?"lock":e.tone}" title=${e.title??""}>${e.icon?f(e.icon):c}${e.text}</span>`}};K.styles=[Te,B`
      :host {
        display: block;
      }
      .blk {
        position: relative;
        display: flex;
        flex-direction: column;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
        transition: border-color var(--ab-motion, 200ms), box-shadow var(--ab-motion, 200ms);
      }
      :host([open]) .blk {
        border-color: color-mix(in srgb, var(--dv-accent) 50%, transparent);
        box-shadow: 0 0 0 4px var(--dv-accent-soft);
        background: var(--dv-surface-solid, var(--dv-surface));
      }
      :host([locked]) .blk {
        background: repeating-linear-gradient(135deg, transparent 0 10px, rgba(120, 120, 128, 0.07) 10px 20px), var(--dv-surface-2);
        border-style: dashed;
        border-color: var(--dv-border-strong);
      }
      :host([invalid]) .blk {
        border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
      }
      :host([nested]) .blk {
        margin-inline-start: 22px;
      }
      .bh {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-inline: 8px 6px;
        min-block-size: 54px;
      }
      .grip {
        display: grid;
        place-items: center;
        inline-size: 26px;
        block-size: 40px;
        color: var(--dv-text-3);
        font-size: var(--sw-fs-lg);
        cursor: grab;
        flex: none;
        border: 0;
        background: transparent;
        padding: 0;
      }
      :host([readonly]) .grip,
      :host([readonly]) .xb {
        display: none;
      }
      .bm {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        background: transparent;
        padding: 6px 0;
        text-align: start;
        border-radius: var(--sw-r-md);
        min-block-size: 44px;
      }
      .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      :host([locked]) .rg {
        background: var(--dv-surface-3);
        color: var(--dv-text-2);
      }
      .bt {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        line-height: 1.35;
      }
      .bt b {
        font-size: var(--sw-fs-md);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .sub {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        align-items: center;
      }
      .xb {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--dv-text-3);
        flex: none;
        font-size: var(--sw-fs-lg);
      }
      .xb:hover {
        background: var(--dv-surface-3);
        color: var(--dv-danger);
      }
      .body {
        display: none;
        border-top: 1px solid var(--dv-border);
        padding: 12px 14px 14px;
        flex-direction: column;
        gap: 12px;
      }
      :host([open]) .body {
        display: flex;
        animation: pop 180ms var(--ab-ease, ease);
      }
      .tools {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .tools button {
        inline-size: 36px;
        block-size: 36px;
        border-radius: 50%;
        border: 1px solid var(--dv-border);
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--dv-text-2);
        font-size: var(--sw-fs-lg);
      }
      .tools button:hover:not(:disabled) {
        background: var(--dv-surface-3);
        color: var(--dv-text);
      }
      .tools button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }
      @media (max-width: 767px) {
        .bh {
          min-block-size: 58px;
        }
        .tools button {
          inline-size: 44px;
          block-size: 44px;
        }
        :host([nested]) .blk {
          margin-inline-start: 12px;
        }
      }
    `];Z([b()],K.prototype,"icon",2);Z([b()],K.prototype,"heading",2);Z([b({attribute:!1})],K.prototype,"chips",2);Z([b({type:Boolean,reflect:!0})],K.prototype,"open",2);Z([b({type:Boolean,reflect:!0})],K.prototype,"locked",2);Z([b({type:Boolean,reflect:!0})],K.prototype,"invalid",2);Z([b({type:Boolean,reflect:!0})],K.prototype,"nested",2);Z([b({type:Boolean,reflect:!0})],K.prototype,"readonly",2);Z([b({type:Boolean})],K.prototype,"canUp",2);Z([b({type:Boolean})],K.prototype,"canDown",2);Z([b({type:Boolean})],K.prototype,"canDuplicate",2);Z([b()],K.prototype,"uid",2);K=Z([H("sw-block-card")],K);var Tn=Object.defineProperty,In=Object.getOwnPropertyDescriptor,Ye=(e,t,s,i)=>{for(var a=i>1?void 0:i?In(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Tn(t,s,a),a};const Pn={motion:"motion",door:"door",users:"users",sunset:"sunset",drop:"drop",sun:"sun",clock:"clock"};let we=class extends Q{constructor(){super(...arguments),this.enabled=!0,this.rows=[],this.phase="loading",this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.phase="loading";try{this.rows=this.enabled?(await ge().templates()).templates:[],this.phase="ready"}catch(e){this.error=Se(e),this.phase="error"}}pick(e){this.dispatchEvent(new CustomEvent("template-pick",{detail:{template:e},bubbles:!0,composed:!0}))}render(){return this.phase==="loading"?o`<div class="state" data-templates-state="loading">${n("טוען…")}</div>`:this.phase==="error"?o`<div class="state err" data-templates-state="error">${this.error}</div>`:o`<div class="grid" data-templates>
      <button class="tpl blank" type="button" data-template="blank" @click=${()=>this.pick(null)}>
        <span class="tile">${f("plus")}</span><b>${n("מאפס")}</b><small>${n("כאשר · אם · אז")}</small>
      </button>
      ${this.rows.map(e=>o`<button class="tpl" type="button" data-template=${e.id} @click=${()=>this.pick(e)}>
        <span class="tile">${f(Pn[e.icon]??"template")}</span><b>${e.name}</b><small>${e.description}</small>
        ${e.sensitive||e.suggest_schedule?o`<span class="tags">${e.sensitive?o`<span class="tag sens">${f("alarm")}${n("רגיש כברירת מחדל")}</span>`:c}${e.suggest_schedule?o`<span class="tag acc">${f("calendar")}${n("גם כתזמון")}</span>`:c}</span>`:c}
      </button>`)}
    </div>`}};we.styles=[Te,B`
      :host {
        display: block;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .tpl {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
        text-align: start;
        padding: 14px 14px 12px;
        min-block-size: 132px;
        border-radius: var(--dv-radius-md, 20px);
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-2);
        color: var(--dv-text);
        box-shadow: var(--dv-shadow-1);
        transition: transform var(--ab-motion, 200ms), box-shadow var(--ab-motion, 200ms);
      }
      .tpl:hover {
        box-shadow: var(--dv-shadow-2);
      }
      .tpl.blank {
        border-style: dashed;
        border-color: var(--dv-border-strong);
        background: transparent;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      .tile {
        display: grid;
        place-items: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--sw-r-md);
        background: var(--dv-accent-soft);
        color: var(--dv-accent-text);
        font-size: var(--sw-fs-2xl);
      }
      .blank .tile {
        background: var(--dv-surface-3);
        color: var(--dv-text-2);
        border-radius: 50%;
      }
      .tpl b {
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-bold);
      }
      .tpl small {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        line-height: 1.4;
      }
      .tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-block-start: auto;
      }
      .state {
        padding: 40px 12px;
        text-align: center;
        color: var(--dv-text-2);
        font-weight: var(--sw-fw-semibold);
      }
      .state.err {
        color: var(--dv-danger);
      }
      @media (max-width: 767px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .tpl {
          min-block-size: 96px;
        }
      }
    `];Ye([b({type:Boolean})],we.prototype,"enabled",2);Ye([h()],we.prototype,"rows",2);Ye([h()],we.prototype,"phase",2);Ye([h()],we.prototype,"error",2);we=Ye([H("automation-templates")],we);const ut=e=>e!==null&&typeof e=="object"&&!Array.isArray(e),U=e=>e===void 0?e:JSON.parse(JSON.stringify(e)),An={entities:[],actions:{},notify_targets:[],scenes:[],scripts:[],floors:[],areas:[],shabbat_sensor:null};function Nn(e){return e.floors.length===1&&!e.entities.some(t=>!t.floor&&!t.area&&t.actions.length)?{floors:[e.floors[0].id],areas:e.areas.map(t=>t.id)}:{floors:null,areas:null}}const Ht=new Map;function Rn(e,t){const s=new Map(t.entities.map(d=>[d.entity_id,d])),i=new Map(t.scenes.map(d=>[d.entity_id,d.name])),a=new Map(t.scripts.map(d=>[d.entity_id,d.name])),r=new Map(t.notify_targets.map(d=>[d.action,d.name])),l=Nn(t);return{status:e,catalog:t,scope:l,byId:s,scoped:t.entities.length>0&&l.floors!==null,ctx:{names:d=>ii({entity_id:d,name:s.get(d)?.name??i.get(d)??a.get(d)}),notifyName:d=>r.get(d)??null,shabbatSensor:t.shabbat_sensor,...t.allowed_actions?{allowedActions:t.allowed_actions}:{},wallButtons:!!t.extension?.wall_buttons,presenceEntity:t.extension?.presence_entity??null,presenceSensors:t.extension?.building_presence?.sensors??[],deviceName:d=>Ht.get(d)??null},notifyActions:t.notify_targets.length?t.notify_targets.map(d=>d.action):null,sensitiveChip:e.ui.sensitive_chip==="red"?"red":"amber",sensitiveWarning:e.ui.sensitive_warning!==!1}}function Ln(e){return e==="alarm_control_panel.alarm_disarm"?n("נטרול"):e.startsWith("alarm_control_panel.")?n("דריכה"):e==="lock.unlock"?n("פתיחת מנעול"):e==="lock.lock"?n("נעילה"):e.startsWith("siren.")?n("הפעלת צופר"):e.startsWith("cover.")?/open/.test(e)?n("פתיחת שער"):n("סגירת שער"):n("שליטה")}const Es=(e,t)=>n("אין לך הרשאה ל{what} ב־{name}",{what:Ln(e).toLowerCase(),name:t});function Mn(e){return e&&e in cs?cs[e]:n("רגיש")}const te="root";function Ke(e){const t=[];"triggers"in e?t.push({owner:te,name:"triggers",blocks:e.triggers,section:"trigger"},{owner:te,name:"conditions",blocks:e.conditions,section:"condition"},{owner:te,name:"actions",blocks:e.actions,section:"action"}):"sequence"in e&&t.push({owner:te,name:"sequence",blocks:e.sequence,section:"action"});for(const s of pe(e))for(const i of jt(s.block))t.push({owner:s.block.uid,name:i.name,blocks:i.blocks,section:i.section});return t}function $i(e,t,s,i=!1){const a=Ke(e).find(d=>d.owner===t&&d.name===s);if(a)return a.blocks;if(!i||t===te)return null;const r=pe(e).find(d=>d.block.uid===t);if(!r||r.block.kind!=="typed")return null;const l=r.block;return s==="else"&&l.type==="if"?l.else=[]:s==="default"&&l.type==="choose"?l.default=[]:null}function Ie(e,t){for(const s of Ke(e)){const i=s.blocks.findIndex(a=>a.uid===t);if(i>=0)return{owner:s.owner,name:s.name,index:i,list:s.blocks,section:s.section}}return null}function nt(e,t=new Set){t.add(e.uid);for(const s of jt(e))s.blocks.forEach(i=>nt(i,t));return e.kind==="typed"&&e.type==="condition"&&nt(e.condition,t),t}function rt(e){e.uid=pt();for(const t of jt(e))t.blocks.forEach(s=>rt(s));return e.kind==="typed"&&e.type==="condition"&&rt(e.condition),e}function Bn(e){for(const t of Ke(e))t.owner===te&&t.blocks.forEach(s=>rt(s));return e}function Fn(e,t,s,i,a){const r=U(e),l=$i(r,t,s,!0);return l&&l.splice(l.length,0,i),r}function jn(e,t){const s=U(e),i=Ie(s,t);return i&&i.list.splice(i.index,1),s}function qn(e,t,s){const i=U(e),a=Ie(i,t);if(!a)return i;const r=a.index+s;if(r<0||r>=a.list.length)return i;const[l]=a.list.splice(a.index,1);return a.list.splice(r,0,l),i}const Un=(e,t,s)=>{const i=Ie(e,t);return!!i&&i.index+s>=0&&i.index+s<i.list.length};function Vn(e,t,s,i,a){const r=U(e),l=Ie(r,t);if(!l)return null;const d=Ke(r).find(m=>m.owner===s&&m.name===i);if(!d||d.section!==l.section)return null;const p=l.list[l.index];if(nt(p).has(s))return null;l.list.splice(l.index,1);const u=d.blocks===l.list&&a>l.index?a-1:a;return d.blocks.splice(Math.max(0,Math.min(u,d.blocks.length)),0,p),r}function Wn(e,t){const s=U(e),i=Ie(s,t);return i&&i.list.splice(i.index+1,0,rt(U(i.list[i.index]))),s}function Hn(e,t,s){const i=U(e),a=pe(i).find(r=>r.block.uid===t);return a&&s(a.block),i}const Gn=e=>pe(e).filter(t=>t.section==="action").length,C=e=>({uid:pt(),kind:"typed",raw:null,sentence:"",...e}),xt=e=>e&&e.length?e[0]:void 0,Yn=e=>"triggers"in e&&e.triggers.some(t=>t.kind==="typed"?!!t.id:ut(t.raw)&&typeof t.raw.id=="string"),Gt="zone.home",Ue=[{id:"state",label:n("מצב מכשיר"),hint:n("כשמכשיר נדלק, נכבה, נפתח…"),icon:"sensor",make:()=>C({type:"state",entity_ids:[],to:"on"})},{id:"time",label:n("שעה קבועה"),hint:n("בשעה מסוימת"),icon:"clock",make:()=>C({type:"time",at:"07:00"})},{id:"time_pattern",label:n("כל X זמן"),hint:n("מחזורי"),icon:"timer",make:()=>C({type:"time_pattern",minutes:"/5",hours:null,seconds:null})},{id:"sun",label:n("זריחה / שקיעה"),hint:n("עם היסט לפני/אחרי"),icon:"sunset",make:()=>C({type:"sun",event:"sunset",offset_min:0})},{id:"numeric",label:n("ערך מעל / מתחת"),hint:n("טמפרטורה, לחות…"),icon:"thermo",make:()=>C({type:"numeric_state",entity_ids:[],above:null,below:null})},{id:"presence",label:n("נוכחות"),hint:n("כולם יצאו · מישהו חזר"),icon:"users",make:()=>C({type:"numeric_state",entity_ids:[Gt],below:1,above:null})},{id:"start",label:n("הפעלת המערכת"),hint:n("אחרי עלייה מחדש"),icon:"power",make:()=>C({type:"homeassistant",event:"start"})}],Ve=[{id:"state",label:n("מצב מכשיר"),hint:n("מכשיר במצב מסוים"),icon:"sensor",make:()=>C({type:"state",entity_ids:[],state:"on"})},{id:"numeric",label:n("ערך מעל / מתחת"),hint:n("טמפרטורה, לחות…"),icon:"thermo",make:()=>C({type:"numeric_state",entity_ids:[],above:null,below:null})},{id:"time",label:n("שעות וימים"),hint:n("אחרי / לפני, ימי השבוע"),icon:"clock",make:()=>C({type:"time",after:"17:00"})},{id:"sun",label:n("שקיעה / זריחה"),hint:n("אחרי השקיעה, לפני הזריחה"),icon:"sunset",make:()=>C({type:"sun",after:"sunset"})},{id:"trigger",label:n("מה הפעיל"),hint:n("לפי מזהה הטריגר"),icon:"bolt",available:(e,t)=>Yn(t),make:()=>C({type:"trigger",ids:[]})},{id:"shabbat",label:n("שבת וחג"),hint:n("רק בשבת, או לא בשבת"),icon:"calendar",available:e=>!!e.catalog.shabbat_sensor,make:()=>C({type:"shabbat",mode:"not_holy_days"})},{id:"or",label:n("אחד מאלה"),hint:n("מספיק תנאי אחד"),icon:"branch",make:()=>C({type:"or",conditions:[]})},{id:"and",label:n("כל אלה"),hint:n("כל התנאים יחד"),icon:"branch",make:()=>C({type:"and",conditions:[]})},{id:"not",label:n("לא אלה"),hint:n("כשהתנאים לא מתקיימים"),icon:"slash",make:()=>C({type:"not",conditions:[]})}],Kn="alarm_control_panel.alarm_arm_away",Jn=[{id:"device",label:n("שליטה במכשיר"),hint:n("הדלקה, כיבוי, טמפרטורה…"),icon:"light",make:()=>C({type:"service",action:"light.turn_on",entity_ids:[],data:{},role:"device"})},{id:"scene",label:n("הפעלת סצנה"),hint:n("סצנה קיימת"),icon:"scene",available:e=>e.catalog.scenes.length>0,make:e=>{const t=xt(e.catalog.scenes)?.entity_id;return C({type:"service",action:"scene.turn_on",entity_ids:t?[t]:[],data:{},role:"scene"})}},{id:"script",label:n("הרצת סקריפט"),hint:n("סקריפט קיים"),icon:"script",available:e=>e.catalog.scripts.length>0,make:e=>{const t=xt(e.catalog.scripts)?.entity_id;return C({type:"service",action:t??"script.turn_on",entity_ids:t?[t]:[],data:{},role:"script"})}},{id:"notify",label:n("שליחת התראה"),hint:n("לטלפון"),icon:"bell",available:e=>e.catalog.notify_targets.length>0,make:e=>C({type:"service",action:xt(e.catalog.notify_targets)?.action??"notify.notify",entity_ids:[],data:{message:""},role:"notify"})},{id:"delay",label:n("השהיה"),hint:n("להמתין לפני הצעד הבא"),icon:"timer",make:()=>C({type:"delay",delay:{minutes:3}})},{id:"if",label:n("אם / אחרת"),hint:n("צעדים לפי תנאי"),icon:"question",make:()=>C({type:"if",conditions:[],then:[],else:null})},{id:"choose",label:n("בחירה לפי תנאים"),hint:n("כמה ענפים"),icon:"branch",make:()=>C({type:"choose",options:[{conditions:[],sequence:[]}],default:null})},{id:"repeat",label:n("חזרה"),hint:n("כמה פעמים"),icon:"repeat",make:()=>C({type:"repeat_count",count:3,sequence:[]})},{id:"condition",label:n("המשך רק אם"),hint:n("עוצר אם התנאי לא מתקיים"),icon:"question",make:()=>C({type:"condition",condition:C({type:"state",entity_ids:[],state:"on"})})},{id:"stop",label:n("עצירה"),hint:n("מפסיק את הריצה"),icon:"stop",make:()=>C({type:"stop",message:""})},{id:"sensitive",label:n("פעולה רגישה"),hint:n("אזעקה, מנעול, שער, צופר"),icon:"alarm",sensitive:!0,make:()=>C({type:"service",action:Kn,entity_ids:[],data:{},role:"device"})}],yi={trigger:Ue,condition:Ve,action:Jn},Xn={trigger:n("מתי להפעיל?"),condition:n("רק אם…"),action:n("מה לעשות?")};n("כאשר"),n("אם"),n("אז");function Qn(e,t,s){const i=yi[e].find(l=>l.id===t);if(!i)return null;const a=i.make(s);a.sentence=At(a,e,s.ctx);const r=a.condition;return r&&(r.sentence=At(r,"condition",s.ctx)),a}function Yt(e){if(e.kind!=="typed")return null;const t=e;return t.type==="numeric_state"&&t.entity_ids.length===1&&t.entity_ids[0]===Gt&&t.below===1&&t.above==null?"all_left":t.type==="state"&&t.entity_ids.length>0&&t.entity_ids.every(s=>s.startsWith("person."))&&t.to==="home"?"someone_home":null}const Zn=e=>e.catalog.entities.filter(t=>t.domain==="person").map(t=>t.entity_id),xi=[{value:"on",label:n("דלוק / פעיל")},{value:"off",label:n("כבוי")}];function Kt(e){const t=e??"",s=t.split(".")[0];return s==="binary_sensor"?/motion|occupancy|presence/.test(t)?[{value:"on",label:n("זוהתה תנועה")},{value:"off",label:n("אין תנועה")}]:/door|window|gate/.test(t)?[{value:"on",label:n("פתוח")},{value:"off",label:n("סגור")}]:/leak|water|flood/.test(t)?[{value:"on",label:n("יש מים")},{value:"off",label:n("יבש")}]:[{value:"on",label:n("מופעל")},{value:"off",label:n("כבוי")}]:s==="person"||s==="device_tracker"?[{value:"home",label:n("בבית")},{value:"not_home",label:n("לא בבית")}]:s==="climate"?[{value:"off",label:n("כבוי")},{value:"cool",label:n("קירור")},{value:"heat",label:n("חימום")},{value:"auto",label:n("אוטומטי")},{value:"fan_only",label:n("מאוורר")},{value:"dry",label:n("ייבוש")},{value:"heat_cool",label:n("חימום/קירור")}]:s==="cover"?[{value:"open",label:n("פתוח")},{value:"closed",label:n("סגור")},{value:"opening",label:n("נפתח")},{value:"closing",label:n("נסגר")}]:s==="lock"?[{value:"locked",label:n("נעול")},{value:"unlocked",label:n("פתוח")}]:s==="alarm_control_panel"?[{value:"disarmed",label:n("מנוטרלת")},{value:"armed_home",label:n("דרוכה (בית)")},{value:"armed_away",label:n("דרוכה (מלא)")},{value:"armed_night",label:n("דרוכה (לילה)")},{value:"triggered",label:n("מופעלת")}]:s==="media_player"?[{value:"off",label:n("כבוי")},{value:"on",label:n("דלוק")},{value:"playing",label:n("מנגן")},{value:"paused",label:n("מושהה")},{value:"idle",label:n("לא מנגן")}]:xi}const er={sun:n("א׳"),mon:n("ב׳"),tue:n("ג׳"),wed:n("ד׳"),thu:n("ה׳"),fri:n("ו׳"),sat:n("ש׳")},je={single:n("התעלם"),restart:n("התחל מחדש"),queued:n("המתן בתור"),parallel:n("הרץ במקביל")},tr={single:n("אם מופעלת שוב בזמן ריצה – התעלם"),restart:n("אם מופעלת שוב – התחל מחדש"),queued:n("אם מופעלת שוב – המתן בתור"),parallel:n("ריצות במקביל")},ki={light:"light",switch:"power",climate:"thermo",cover:"blind",alarm_control_panel:"alarm",lock:"lock",siren:"siren",media_player:"tv",fan:"wind",scene:"scene",script:"script",notify:"bell",automation:"bolt",input_boolean:"power",timer:"timer",select:"list",number:"thermo"};function ce(e){const t=e??"",s=t.split(".")[0];return s==="binary_sensor"?/motion|occupancy|presence/.test(t)?"motion":/door|window|gate/.test(t)?"door":/leak|water|flood/.test(t)?"drop":"sensor":s==="person"||s==="zone"||s==="device_tracker"?"users":s==="sensor"?/temp/.test(t)?"thermo":"sensor":/gate|garage/.test(t)&&s==="cover"?"gate":ki[s]??"sensor"}function sr(e,t){if(e.kind==="locked")return e.reason==="template"?"template":e.reason==="device"?"button":e.reason==="custom_service"?"script":"lock";const s=e;if(t==="trigger")switch(s.type){case"state":return ce(e.entity_ids?.[0]);case"numeric_state":return Yt(e)?"users":ce(e.entity_ids?.[0])==="sensor"?"thermo":ce(e.entity_ids?.[0]);case"time":return"clock";case"time_pattern":return"timer";case"sun":return"sunset";case"button":return"button";default:return"power"}if(t==="condition")switch(s.type){case"state":case"numeric_state":return ce(e.entity_ids?.[0]);case"time":return"clock";case"sun":return"sunset";case"trigger":return"bolt";case"shabbat":return"calendar";case"presence":return"users";case"not":return"slash";default:return"branch"}switch(s.type){case"service":{const i=e;return i.role==="device"?ce(i.entity_ids[0]??i.action):ki[i.role]??"bolt"}case"delay":return"timer";case"if":return"question";case"choose":return"branch";case"repeat_count":return"repeat";case"condition":return"question";default:return"stop"}}const Ds={template:n("תבנית – נשמרת כמו שהיא"),device:n("כפתור או מכשיר – נשמר כמו שהוא"),purpose_trigger:n("טריגר ייעודי – נשמר כמו שהוא"),custom_service:n("שירות מיוחד – נשמר כמו שהוא"),service_not_allowed:n("שירות שאינו מותר בבונה – נשמר כמו שהוא"),unsupported_step:n("צעד מתקדם – נשמר כמו שהוא"),disabled_step:n("צעד מושבת – נשמר כמו שהוא"),secret:n("ערך חסוי – לא מוצג"),code:n("קוד חסוי – לא מוצג"),unknown:n("חלק לא מוכר – נשמר כמו שהוא")},ir=e=>Ds[e.reason]??Ds.unknown,ar=/\{\{|\{%|\{#/;function nr(e,t){let s=!1;const i=a=>s?a:typeof a=="string"?ar.test(a)?(s=!0,t):a:Array.isArray(a)?a.map(i):ut(a)?Object.fromEntries(Object.entries(a).map(([r,l])=>[r,i(l)])):a;return i(e)}function rr(e,t){const s=nr(e.raw,t);return{...e,raw:s,template_text:t,fingerprint:ri(s)}}function We(e){let t=0;const s=[];class i extends Error{constructor(m,g){super(g),this.pos=m}}const a=()=>{for(;t<e.length&&/\s/.test(e[t]);)t++},r=(u,m=t)=>{throw new i(m,u)},l=u=>u===void 0?n("סוף הקוד"):`"${u}"`,d=()=>{const u=t;t++;let m="";for(;t<e.length;){const g=e[t];if(g==='"')return t++,m;if(g===`
`&&r(n("מחרוזת לא נסגרת"),u),g==="\\"){const x=e[t+1],O={n:`
`,t:"	",r:"\r",b:"\b",f:"\f",'"':'"',"\\":"\\","/":"/"};if(x==="u"){const W=e.slice(t+2,t+6);/^[0-9a-fA-F]{4}$/.test(W)||r(n("רצף \\u לא תקין")),m+=String.fromCharCode(parseInt(W,16)),t+=6;continue}x in O||r(n("רצף בריחה לא תקין")),m+=O[x],t+=2;continue}m+=g,t++}return r(n("מחרוזת לא נסגרת"),u)},p=u=>{a();const m=t,g=e[t];let x;if(g==="{"){t++,a();const O={};if(e[t]==="}")t++;else for(;;){a(),e[t]!=='"'&&r(n("צפוי שם שדה במירכאות, נמצא {found}",{found:l(e[t])}));const W=d();if(a(),e[t]!==":"&&r(n('חסר ":" אחרי "{key}"',{key:W})),t++,O[W]=p(!1),a(),e[t]===","){t++;continue}if(e[t]==="}"){t++;break}r(n('צפוי "," או "}", נמצא {found}',{found:l(e[t])}))}x=O}else if(g==="["){t++,a();const O=[];if(e[t]==="]")t++;else for(;;){if(O.push(p(!0)),a(),e[t]===","){t++;continue}if(e[t]==="]"){t++;break}r(n('צפוי "," או "]", נמצא {found}',{found:l(e[t])}))}x=O}else if(g==='"')x=d();else if(e.startsWith("true",t))t+=4,x=!0;else if(e.startsWith("false",t))t+=5,x=!1;else if(e.startsWith("null",t))t+=4,x=null;else{const O=/^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(e.slice(t));O||r(n("תו לא צפוי {found}",{found:l(g)})),t+=O[0].length,x=Number(O[0])}return u&&(ut(x)||typeof x=="string")&&s.push({from:m,to:t,value:x}),x};try{const u=p(!1);return a(),t<e.length&&r(n("תו לא צפוי {found} אחרי סוף האובייקט",{found:l(e[t])})),{ok:!0,value:u,ranges:s}}catch(u){if(!(u instanceof i))throw u;const m=e.slice(0,u.pos),g=m.split(`
`).length;return{ok:!1,pos:u.pos,line:g,column:u.pos-m.lastIndexOf(`
`),message:u.message}}}function or(e,t){const s=We(e);if(!s.ok||!t.size)return[];const i=[0];for(let l=0;l<e.length;l++)e[l]===`
`&&i.push(l+1);const a=l=>{let d=0,p=i.length-1;for(;d<p;){const u=d+p+1>>1;i[u]<=l?d=u:p=u-1}return d},r=[];for(const l of s.ranges){if(!t.has(ri(l.value)))continue;const d=a(l.from),p=a(Math.max(l.from,l.to-1));r.some(u=>u.from<=d&&u.to>=p)||r.push({from:d,to:p})}return r}const kt=e=>{const t=new Set;for(const s of pe(e))s.block.kind==="locked"&&t.add(s.block.fingerprint);return t},lr=e=>`${n("שורה {line}, עמודה {column}",{line:e.line,column:e.column})} · ${e.message}`;function _t(e){const t=e?.config;return ut(t)?t:null}function Be(e,t,s,i=null){try{return tt(Pt(e,t,null,s,{id:i}))}catch{return JSON.stringify(t)}}function Cs(e,t,s){return e?"create":ha(t,s).length?"code":"replace"}const dr={triggers:n("כאשר"),conditions:n("אם"),actions:n("אז"),sequence:n("אז"),alias:n("שם"),name:n("שם"),description:n("תיאור"),fields:n("שדות"),members:n("מכשירים"),mode:n("אפשרויות"),max:n("אפשרויות"),config:n("קוד")},cr=e=>dr[e.split(/[./[\]]+/).filter(Boolean)[0]??""]??n("שגיאה");function pr(e){return{where:cr(e.path),what:e.message}}function ur(...e){const t=new Set,s=[];for(const i of e)for(const a of i){const r=`${a.path}|${a.code}`;t.has(r)||(t.add(r),s.push(a))}return s}function hr(e,t,s){const i=new Map,a=new Map;if(e)e.floors.forEach(l=>i.set(l.id,l.name)),e.areas.forEach(l=>a.set(l.id,l.name));else for(const l of va(t)){const d=s.byId.get(l);d?.floor&&i.set(d.floor.id,d.floor.name),d?.area&&a.set(d.area.id,d.area.name)}const r=[...a.values()];return{floors:[...i.values()].join(" · "),areas:r.slice(0,3).join(" · "),more:Math.max(0,r.length-3)}}function vr(e,t,s,i){const a=[],r=(d,p,u)=>{p!==u&&a.push({group:d,change:"changed",mine:p||"—",theirs:u||"—"})},l=(d,p,u,m)=>{const g=F=>tt(fa(F,m,i)),x=F=>At(F,m,i),O=u.map((F,ft)=>({x:F,i:ft,k:g(F)})),W=[];for(const F of p){const ft=g(F),Qt=O.findIndex(Mi=>Mi.k===ft);Qt>=0?O.splice(Qt,1):W.push(F)}const z=Math.min(W.length,O.length);for(let F=0;F<z;F++)a.push({group:d,change:"changed",mine:x(W[F]),theirs:x(O[F].x)});for(const F of W.slice(z))a.push({group:d,change:"added",mine:x(F),theirs:"—"});for(const F of O.slice(z))a.push({group:d,change:"removed",mine:"—",theirs:x(F.x)})};if(e==="automation"){const d=t,p=s;r(n("שם"),d.alias,p.alias),r(n("תיאור"),d.description,p.description),r(n("אפשרויות"),`${je[d.mode]}${d.max?` · ${d.max}`:""}`,`${je[p.mode]}${p.max?` · ${p.max}`:""}`),l(n("כאשר"),d.triggers,p.triggers,"trigger"),l(n("אם"),d.conditions,p.conditions,"condition"),l(n("אז"),d.actions,p.actions,"action")}else if(e==="script"){const d=t,p=s;r(n("שם"),d.alias,p.alias),r(n("תיאור"),d.description,p.description),r(n("אפשרויות"),je[d.mode],je[p.mode]),r(n("שדות"),d.fields.map(u=>u.name).join(", "),p.fields.map(u=>u.name).join(", ")),l(n("אז"),d.sequence,p.sequence,"action")}else{const d=t,p=s;r(n("שם"),d.name,p.name);const u=g=>`${i.names?.(g.entity_id)??ii(g)} · ${g.state}${Object.keys(g.attributes).length?` ${JSON.stringify(g.attributes)}`:""}`,m=new Map(p.members.map(g=>[g.entity_id,g]));for(const g of d.members){const x=m.get(g.entity_id);x?tt(x)!==tt(g)&&a.push({group:n("מכשירים"),change:"changed",mine:u(g),theirs:u(x)}):a.push({group:n("מכשירים"),change:"added",mine:u(g),theirs:"—"})}for(const g of p.members)d.members.some(x=>x.entity_id===g.entity_id)||a.push({group:n("מכשירים"),change:"removed",mine:"—",theirs:u(g)})}return a}const zt=[{value:"on",label:n("דלוק")},{value:"off",label:n("כבוי")}];function Rt(e){switch(e.split(".")[0]){case"light":return[{key:"state",label:n("מצב"),kind:"select",options:zt},{key:"brightness",label:n("בהירות"),kind:"number",min:1,max:100,step:1,unit:"%",only:"on"},{key:"color_temp_kelvin",label:n("טמפרטורת צבע"),kind:"number",min:2e3,max:6500,step:100,unit:"K",only:"on"}];case"switch":return[{key:"state",label:n("מצב"),kind:"select",options:zt}];case"fan":return[{key:"state",label:n("מצב"),kind:"select",options:zt},{key:"percentage",label:n("מהירות"),kind:"number",min:0,max:100,step:10,unit:"%",only:"on"}];case"cover":return[{key:"state",label:n("מצב"),kind:"select",options:[{value:"open",label:n("פתוח")},{value:"closed",label:n("סגור")}]},{key:"current_position",label:n("מיקום"),kind:"number",min:0,max:100,step:5,unit:"%"}];case"climate":return[{key:"state",label:n("מצב"),kind:"select",options:Kt(e)},{key:"temperature",label:n("טמפרטורה"),kind:"number",min:16,max:30,step:.5,unit:"°"}];case"media_player":return[{key:"state",label:n("מצב"),kind:"select",options:[{value:"on",label:n("דלוק")},{value:"off",label:n("כבוי")},{value:"playing",label:n("מנגן")},{value:"paused",label:n("מושהה")}]},{key:"volume_level",label:n("עוצמה"),kind:"number",min:0,max:100,step:5,unit:"%"}];case"lock":return[{key:"state",label:n("מצב"),kind:"select",options:[{value:"locked",label:n("נעול")},{value:"unlocked",label:n("פתוח")}]}];default:return[{key:"state",label:n("מצב"),kind:"select",options:xi}]}}const fr=(e,t)=>e.key==="brightness"?Math.round(t*100/255):e.key==="volume_level"?Math.round(t*100):t,mr=(e,t)=>e.key==="brightness"?Math.round(t*255/100):e.key==="volume_level"?Math.round(t)/100:t;function br(e,t){const s=e.attributes[t.key];return typeof s=="number"?fr(t,s):null}function Ts(e,t,s){const i={entity_id:e.entity_id,state:e.state,attributes:{...e.attributes}};if(t.key==="state"){if(i.state=String(s??""),i.state==="off"||i.state==="closed"||i.state==="locked"||i.state==="unlocked")for(const a of Rt(e.entity_id).filter(r=>r.only==="on").map(r=>r.key))delete i.attributes[a];return i}return s===null||s===""||Number.isNaN(Number(s))?(delete i.attributes[t.key],i):(i.attributes[t.key]=mr(t,Number(s)),i)}const gr={light:n("תאורה"),switch:n("מתג"),fan:n("מאוורר"),cover:n("תריס"),climate:n("מזגן"),media_player:n("מדיה"),lock:n("מנעול")},wr={light:n("תאורה"),switch:n("מתג"),cover:n("תריס"),climate:n("מזגן"),fan:n("מאוורר"),media_player:n("מדיה"),lock:n("מנעול"),sensor:n("חיישן"),binary_sensor:n("חיישן"),person:n("אדם"),scene:n("סצנה"),script:n("סקריפט")},Is={number:n("מספר"),boolean:n("כן / לא"),select:n("בחירה"),text:n("טקסט"),entity:n("מכשיר")};function Ps(e,t){let s=t.length+1;for(;t.includes(`field_${s}`);)s++;const i=e==="number"?{kind:"number",min:0,max:100,step:1}:e==="boolean"?{kind:"boolean"}:e==="select"?{kind:"select",options:[n("אפשרות 1"),n("אפשרות 2")]}:e==="text"?{kind:"text"}:{kind:"entity",domains:[]};return{key:`field_${s}`,name:"",required:!1,default:void 0,selector:i}}function $r(e){const t=e.selector;switch(t.kind){case"number":return n("מספר {min}–{max}{unit}",{min:t.min,max:t.max,unit:t.unit??""});case"boolean":return n("כן / לא");case"select":return n("בחירה: {options}",{options:t.options.join(" · ")});case"text":return n("טקסט");case"entity":return t.domains.length?n("מכשיר ({domains})",{domains:t.domains.map(s=>wr[s]??s).join(", ")}):n("מכשיר");default:return n("שדה מתקדם · נעול")}}function yr(e,t,s){return t==="trigger"?s>=st.triggers_max:t==="condition"?s>=st.conditions_max:Gn(e)>=st.steps_max}var xr=Object.defineProperty,kr=Object.getOwnPropertyDescriptor,xe=(e,t,s,i)=>{for(var a=i>1?void 0:i?kr(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&xr(t,s,a),a};let re=class extends Q{constructor(){super(...arguments),this.env=null,this.filter={},this.where=null,this.selected=[],this.multi=!0,this.q=""}pick(e){const t=this.selected.includes(e.entity_id),s=this.multi?t?this.selected.filter(i=>i!==e.entity_id):[...this.selected,e.entity_id]:[e.entity_id];this.selected=s,this.dispatchEvent(new CustomEvent("picker-change",{detail:{ids:s},bubbles:!0,composed:!0})),this.multi||this.done()}done(){this.dispatchEvent(new CustomEvent("picker-done",{bubbles:!0,composed:!0}))}firstUpdated(){requestAnimationFrame(()=>this.shadowRoot?.querySelector("input")?.focus({preventScroll:!0}))}row(e){const t=this.selected.includes(e.entity_id);return o`<button class="prow" type="button" role="menuitemcheckbox" aria-checked=${t} data-picker-item=${e.entity_id} @click=${()=>this.pick(e)}>
      <span class="rg">${f(ce(e.entity_id))}</span>
      <span class="nm">${e.name}${e.state?o`<small>${e.state}</small>`:c}</span>
      ${e.class?o`<span class="tag sens">${f("alarm")}${Mn(e.class)}</span>`:c}
      ${e.missing?o`<span class="tag bad">${f("warning")}${n("חסר")}</span>`:c}
      <span class="ck">${t?f("check"):c}</span>
    </button>`}render(){const e=this.env;if(!e)return c;let t=oi(e.catalog.entities,e.scope,{purpose:"target",...this.filter,q:this.q});this.where&&(t=t.filter(this.where));const s=li(t),i=s.filter(a=>a.floor).length>1;return o`<div class="ph">
        <label class="search">${f("search")}<input type="search" data-picker-search placeholder=${n("חיפוש מכשיר")} aria-label=${n("חיפוש מכשיר")} .value=${this.q} @input=${a=>this.q=a.target.value} /></label>
        ${e.scoped?o`<span class="tag acc">${f("layers")}${e.catalog.floors[0]?.name??""}</span>`:c}
      </div>
      <div class="pb" role="menu" aria-label=${n("בחירת מכשירים")}>
        ${s.map(a=>o`${i&&a.floor?o`<h5 class="floor">${f("layers")}${a.floor.name}</h5>`:c}
          ${a.areas.map(r=>o`<div><h5>${r.area?r.area.name:o`${f("home")}${n("כל הבית")}`}</h5>${r.entities.map(l=>this.row(l))}</div>`)}`)}
        ${t.length?c:o`<div class="none">${n("לא נמצאו מכשירים")}</div>`}
      </div>
      <div class="pf"><span class="cnt"><em>${this.selected.length}</em> ${n("נבחרו")}</span><button class="btn primary sm" type="button" data-picker-done @click=${this.done}>${f("check")}${n("סיום")}</button></div>`}};re.styles=[Te,B`
      :host {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
        max-block-size: inherit;
        /* the entity picker is a menu surface (a popover on a desktop, a bottom sheet on a phone): opaque, never see-through (owner 2026-10-13) */
        background: var(--sw-menu-surface);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        border: 1px solid var(--sw-menu-border);
        border-radius: var(--sw-r-2xl);
        box-shadow: var(--dv-shadow-3);
        overflow: hidden;
      }
      .ph {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 12px 12px 8px;
        flex: none;
      }
      .search {
        position: relative;
        flex: 1;
        min-inline-size: 0;
      }
      .search input {
        inline-size: 100%;
        block-size: 42px;
        padding-inline: 38px 12px;
        border-radius: 999px;
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-solid);
        color: var(--dv-text);
        font: inherit;
        font-size: var(--sw-fs-base);
      }
      .search .ic {
        position: absolute;
        inset-inline-start: 13px;
        inset-block-start: 13px;
        color: var(--dv-text-3);
        font-size: var(--sw-fs-lg);
      }
      .pb {
        flex: 1;
        overflow: auto;
        padding: 4px 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-block-size: 0;
        scrollbar-width: thin;
      }
      h5 {
        margin: 6px 6px 2px;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-bold);
        color: var(--dv-text-2);
        display: flex;
        gap: 6px;
        align-items: center;
      }
      h5.floor {
        color: var(--dv-text);
        font-size: var(--sw-fs-base);
      }
      .prow {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 10px;
        min-block-size: 46px;
        border-radius: var(--sw-r-md);
        inline-size: 100%;
        border: 0;
        background: transparent;
        text-align: start;
        color: var(--dv-text);
        font-size: var(--sw-fs-base);
      }
      .prow:hover {
        background: var(--dv-surface-3);
      }
      .prow .rg {
        display: grid;
        place-items: center;
        inline-size: 30px;
        block-size: 30px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      .nm {
        flex: 1;
        min-inline-size: 0;
      }
      .nm small {
        display: block;
        font-size: var(--sw-fs-xs);
        color: var(--dv-text-2);
      }
      .ck {
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--sw-r-xs);
        border: 1.5px solid var(--dv-border-strong);
        display: grid;
        place-items: center;
        color: var(--sw-text-inverse);
        flex: none;
        font-size: var(--sw-fs-base);
      }
      .prow[aria-checked='true'] .ck {
        background: var(--dv-accent);
        border-color: var(--dv-accent);
      }
      .pf {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--dv-border);
      }
      .pf .cnt {
        flex: 1;
        font-size: var(--sw-fs-base);
        color: var(--dv-text-2);
      }
      .pf .cnt em {
        font-style: normal;
        font-weight: var(--sw-fw-bold);
        color: var(--dv-text);
      }
      .none {
        padding: 30px 10px;
        text-align: center;
        color: var(--dv-text-2);
        font-weight: var(--sw-fw-semibold);
      }
    `];xe([b({attribute:!1})],re.prototype,"env",2);xe([b({attribute:!1})],re.prototype,"filter",2);xe([b({attribute:!1})],re.prototype,"where",2);xe([b({attribute:!1})],re.prototype,"selected",2);xe([b({type:Boolean})],re.prototype,"multi",2);xe([h()],re.prototype,"q",2);re=xe([H("automation-entity-picker")],re);var _r=Object.defineProperty,zr=Object.getOwnPropertyDescriptor,Pe=(e,t,s,i)=>{for(var a=i>1?void 0:i?zr(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&_r(t,s,a),a};let ue=class extends Q{constructor(){super(...arguments),this.value="",this.locked=new Set,this.readonly=!1,this.scrollY=0}focusLine(e){const t=this.area;if(!t)return;const s=this.value.split(`
`).slice(0,e).reduce((i,a)=>i+a.length+1,0);t.focus({preventScroll:!0}),t.setSelectionRange(s,s),t.scrollTop=Math.max(0,e*20-60),this.scrollY=t.scrollTop}onInput(e){const t=e.target.value;this.value=t;const s=We(t);this.dispatchEvent(new CustomEvent("code-input",{detail:{text:t,ok:s.ok&&s.value!==null&&typeof s.value=="object"&&!Array.isArray(s.value)},bubbles:!0,composed:!0}))}render(){const e=this.value.split(`
`),t=We(this.value),s=or(this.value,this.locked),i=t.ok?-1:t.line-1,a=t.ok&&(t.value===null||typeof t.value!="object"||Array.isArray(t.value));return o`<div class="card">
        <div class="caph"><span class="tag">JSON</span>${this.locked.size?o`<span class="tag lock">${f("lock")}${this.locked.size===1?n("חלק נעול"):n("{n} חלקים נעולים",{n:this.locked.size})} · ${n("מסומנים")}</span>`:c}<span class="sp"></span><slot name="chips"></slot></div>
        <div class="wrap" data-code-wrap>
          <div class="layer"><div class="in" style=${`transform:translateY(${-this.scrollY}px)`}>
            ${s.map(r=>o`<div class="band" data-locked-band style=${`inset-block-start:${r.from*20}px;block-size:${(r.to-r.from+1)*20}px`}></div>`)}
            ${i>=0?o`<div class="band err" data-error-band style=${`inset-block-start:${i*20}px;block-size:20px`}></div>`:c}
          </div></div>
          <div class="nums" aria-hidden="true"><div class="in" style=${`transform:translateY(${-this.scrollY}px)`}>${e.map((r,l)=>o`<div>${l+1}</div>`)}</div></div>
          <textarea data-code-text spellcheck="false" aria-label=${n("קוד האוטומציה")} ?readonly=${this.readonly} .value=${this.value} @input=${this.onInput} @scroll=${r=>this.scrollY=r.target.scrollTop}></textarea>
        </div>
        ${t.ok?a?o`<div class="errline" role="alert" data-code-error>${f("warning")}<span>${n("התוכן צריך להיות אובייקט")}</span></div>`:c:o`<div class="errline" role="alert" data-code-error>${f("warning")}<span>${lr(t)}</span></div>`}
      </div>
      <div class="note"><slot name="note"></slot></div>`}};ue.styles=[Te,B`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-block-size: 0;
      }
      .card {
        border-radius: var(--dv-radius-sm, 14px);
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-solid, var(--dv-surface));
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .caph {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        padding: 10px 12px;
        border-block-end: 1px solid var(--dv-border);
      }
      .sp {
        flex: 1;
      }
      .wrap {
        position: relative;
        block-size: min(54vh, 520px);
        min-block-size: 220px;
        direction: ltr;
        overflow: hidden;
        background: var(--dv-surface-2);
      }
      .layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }
      .layer .in {
        position: absolute;
        inset-inline: 0;
        inset-block-start: 10px;
      }
      .band {
        position: absolute;
        inset-inline: 0;
        background: color-mix(in srgb, var(--dv-text-2) 14%, transparent);
        border-inline-start: 3px solid var(--dv-text-3);
      }
      .band.err {
        background: color-mix(in srgb, var(--dv-danger) 18%, transparent);
        border-inline-start-color: var(--dv-danger);
      }
      .nums {
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 44px;
        overflow: hidden;
        pointer-events: none;
        color: var(--dv-text-3);
        text-align: end; /* .wrap is direction: ltr - end = right, next to the code */
        font: 12px/20px var(--sw-font-mono, ui-monospace, monospace);
        border-inline-end: 1px solid var(--dv-border);
        background: color-mix(in srgb, var(--dv-surface-3) 60%, transparent);
      }
      .nums .in {
        position: absolute;
        inset-inline: 0;
        inset-block-start: 10px;
        padding-inline-end: 8px;
      }
      textarea {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
        margin: 0;
        padding-block: 10px;
        padding-inline: 56px 12px; /* .wrap is direction: ltr: the wide start side clears the line-number gutter */
        border: 0;
        outline: none;
        resize: none;
        background: transparent;
        color: var(--dv-text);
        font: 12.5px/20px var(--sw-font-mono, ui-monospace, monospace);
        white-space: pre;
        overflow: auto;
        tab-size: 2;
        direction: ltr;
        text-align: start;
      }
      textarea[readonly] {
        opacity: 0.85;
      }
      .errline {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        color: var(--dv-danger);
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        padding: 10px 12px;
        border-block-start: 1px solid var(--dv-border);
        background: var(--dv-danger-soft);
      }
      .errline .ic {
        margin-block-start: 2px;
      }
      .note {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        line-height: 1.5;
      }
      .note .ic {
        margin-block-start: 3px;
        font-size: var(--sw-fs-md);
      }
    `];Pe([b()],ue.prototype,"value",2);Pe([b({attribute:!1})],ue.prototype,"locked",2);Pe([b({type:Boolean})],ue.prototype,"readonly",2);Pe([h()],ue.prototype,"scrollY",2);Pe([ct("textarea")],ue.prototype,"area",2);ue=Pe([H("automation-code")],ue);const R=(e,t,s="")=>o`<div class="fld ${s}"><label>${e}</label>${t}</div>`,As={to:n("עובר ל־"),from:n("מ־"),event:n("אירוע"),when:n("מתי"),offset:n("דקות"),at:n("שעה"),every:n("כל"),unit:n("יחידה"),who:n("מי"),above:n("מעל"),below:n("מתחת"),after:n("אחרי"),before:n("לפני"),state:n("במצב"),mode:n("מצב"),sun:n("שמש"),action:n("פעולה"),scene:n("סצנה"),script:n("סקריפט"),target:n("אל"),message:n("הודעה"),count:n("פעמים"),id:n("מזהה"),hours:n("שעות"),minutes:n("דקות"),seconds:n("שניות"),brightness_pct:n("בהירות"),temperature:n("טמפרטורה"),position:n("מיקום"),volume_level:n("עוצמה"),percentage:n("מהירות")},ht=(e,t)=>t??As[e??""]??As[(e??"").split(".").pop()??""]??"";function Y(e,t,s,i="",a="",r){const l=t.some(d=>d.value===e)||e===""?t:[...t,{value:e,label:e}];return o`<select class="selx ${a}" data-fld=${i} aria-label=${ht(i,r)} @change=${d=>s(d.target.value)}>${l.map(d=>o`<option value=${d.value} ?selected=${d.value===e}>${d.label}</option>`)}</select>`}function se(e,t,s={}){return o`<label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${s.attr??""} aria-label=${ht(s.attr,s.label)} placeholder=${s.ph??""} .value=${e==null?"":String(e)}
    @change=${i=>{const a=i.target.value.trim().replace(",","."),r=a===""?null:Number(a);t(r===null||!Number.isFinite(r)?null:s.min!==void 0&&r<s.min?s.min:s.max!==void 0&&r>s.max?s.max:r)}} />${s.unit?o`<span class="u">${s.unit}</span>`:c}</label>`}const Je=(e,t,s={})=>o`<label class="inp"><input type="text" data-fld=${s.attr??""} aria-label=${ht(s.attr,s.label)} dir=${s.ltr?"ltr":"auto"} placeholder=${s.ph??""} .value=${e} @input=${i=>t(i.target.value)} /></label>`,Lt=(e,t,s)=>o`<label class="inp"><input class="n" type="time" lang=${qe()} step="60" data-fld=${s} aria-label=${ht(s)} .value=${(e??"").slice(0,5)} @change=${i=>t(i.target.value)} /></label>`;function Jt(e,t,s){const i=(a,r)=>{const l={hours:e?.hours??0,minutes:e?.minutes??0,seconds:e?.seconds??0,[a]:r??0};t(l.hours||l.minutes||l.seconds?l:void 0)};return o`<div class="frow">
    <div class="fld sm"><label>${n("שעות")}</label>${se(e?.hours??0,a=>i("hours",a),{min:0,max:999,attr:`${s}.hours`})}</div>
    <div class="fld sm"><label>${n("דקות")}</label>${se(e?.minutes??0,a=>i("minutes",a),{min:0,max:59,attr:`${s}.minutes`})}</div>
    <div class="fld sm"><label>${n("שניות")}</label>${se(e?.seconds??0,a=>i("seconds",a),{min:0,max:59,attr:`${s}.seconds`})}</div>
  </div>`}const _i=e=>e?[e.hours?n("{n} שע׳",{n:e.hours}):"",e.minutes?n("{n} דק׳",{n:e.minutes}):"",e.seconds?n("{n} שנ׳",{n:e.seconds}):""].filter(Boolean).join(" "):"";function Ae(e,t,s){const i=e.env.ctx.names;return o`<div class="entpick" data-entity-chips>
    ${t.map(a=>{const r=e.env.byId.get(a);return o`<span class="ent ${r?.class?"sens":""}" title=${i(a)} data-entity=${a}>${f(ce(a))}<span>${i(a)}</span>${r?.area?o`<small>${r.area.name}</small>`:c}${r?.missing?o`<small class="bad">${n("לא נמצא")}</small>`:c}
        <button class="rm" type="button" aria-label=${n("הסרת {name}",{name:i(a)})} data-entity-remove=${a} @click=${()=>s.apply(t.filter(l=>l!==a))}>${f("close")}</button></span>`})}
    <button class="ent add" type="button" data-entity-add @click=${()=>e.pick({uid:e.block.uid,filter:s.filter,where:s.where,selected:t,multi:s.multi??!0,apply:s.apply})}>${f("plus")}${t.length?n("עוד"):s.add??n("בחרו מכשיר")}</button>
  </div>`}const T=e=>{const t=e.issues.slice(0,3);return t.length?o`${t.map(s=>o`<div class="err" role="alert" data-block-error>${f("warning")}${s.message}</div>`)}`:c},Fe=e=>(e??"").split(".")[0],Sr=(e,...t)=>{for(const s of t)(e[s]===void 0||e[s]===null)&&delete e[s];return e},he=e=>{const t=e.block;return o`<details class="opts" ?open=${!!t.id}><summary>${f("chevronDown")}${n("מזהה לטריגר")}${t.id?` · ${t.id}`:""}</summary>
    ${R(n('מזהה (לתנאי "מה הפעיל")'),Je(t.id??"",s=>e.patch(i=>{s.trim()?i.id=s.trim():delete i.id}),{ph:n("למשל night"),attr:"id",ltr:!0}))}</details>`},zi=(e,t)=>o`<details class="opts" ?open=${!!t.for}><summary>${f("chevronDown")}${n("רק אם נשאר כך זמן מסוים")}${t.for?` · ${_i(t.for)}`:""}</summary>
    ${Jt(t.for,s=>e.patch(i=>{s?i.for=s:delete i.for}),"for")}</details>`,Or=()=>({purpose:"watch",onlyTriggerable:!0});function Si(e,t){const s=e.block,i=r=>e.patch(l=>{const d={uid:l.uid,kind:l.kind,raw:l.raw,id:l.id,sentence:l.sentence};for(const p of Object.keys(l))delete l[p];r==="all_left"?Object.assign(l,d,{type:"numeric_state",entity_ids:[Gt],below:1,above:null}):Object.assign(l,d,{type:"state",entity_ids:Zn(e.env),to:"home"}),Sr(l,"id")}),a="entity_ids"in s?s.entity_ids:[];return o`${T(e)}<div class="frow"><div class="fld">${R(n("מי"),Y(t,[{value:"all_left",label:n("כולם יצאו מהבית")},{value:"someone_home",label:n("מישהו חזר הביתה")}],r=>i(r),"who"))}</div></div>
    ${t==="someone_home"?o`${R(n("אנשים"),Ae(e,a,{filter:{purpose:"watch",domains:["person"]},apply:r=>e.patch(l=>{l.entity_ids=r}),add:n("בחרו אדם")}),"full")}`:c}
    ${he(e)}`}const Er=e=>{const t=e.block,s=Yt(t);if(s)return Si(e,s);const i=Kt(t.entity_ids[0]);return o`${T(e)}${Ae(e,t.entity_ids,{filter:Or(),apply:a=>e.patch(r=>{r.entity_ids=a})})}
    <div class="frow">
      <div class="fld">${R(n("עובר ל־"),Y(t.to??"",[{value:"",label:n("כל שינוי")},...i],a=>e.patch(r=>{a?r.to=a:delete r.to}),"to"))}</div>
      <div class="fld">${R(n("מ־ (לא חובה)"),Y(t.from??"",[{value:"",label:"—"},...i],a=>e.patch(r=>{a?r.from=a:delete r.from}),"from"))}</div>
    </div>${zi(e,t)}${he(e)}`},Oi=()=>({filter:{purpose:"watch"},where:e=>e.triggers.includes("numeric_state")}),Dr=e=>{const t=e.block,s=Yt(t);if(s)return Si(e,s);const i=Oi();return o`${T(e)}${Ae(e,t.entity_ids,{...i,apply:a=>e.patch(r=>{r.entity_ids=a})})}
    <div class="frow">
      <div class="fld sm"><label>${n("מעל")}</label>${se(t.above,a=>e.patch(r=>{a===null?delete r.above:r.above=a}),{attr:"above"})}</div>
      <div class="fld sm"><label>${n("מתחת")}</label>${se(t.below,a=>e.patch(r=>{a===null?delete r.below:r.below=a}),{attr:"below"})}</div>
    </div>${zi(e,t)}${he(e)}`},Cr=e=>{const t=e.block;return o`${T(e)}<div class="frow"><div class="fld sm"><label>${n("שעה")}</label>${Lt(t.at,s=>e.patch(i=>{i.at=s}),"at")}</div></div>${he(e)}`};function Tr(e){const t=["hours","minutes","seconds"].filter(i=>e[i]!=null);if(t.length!==1)return null;const s=/^\/(\d+)$/.exec(String(e[t[0]]));return s?{unit:t[0],n:Number(s[1])}:null}const Ir=e=>{const t=e.block,s=Tr(t);if(!s){const a=(r,l)=>R(l,Je(String(t[r]??""),d=>e.patch(p=>{p[r]=d.trim()?d.trim():null}),{attr:r,ltr:!0,ph:"*"}),"sm");return o`${T(e)}<div class="frow">${a("hours",n("שעות"))}${a("minutes",n("דקות"))}${a("seconds",n("שניות"))}</div>${he(e)}`}const i=(a,r)=>e.patch(l=>{l.hours=null,l.minutes=null,l.seconds=null,l[a]=`/${Math.max(1,r??1)}`});return o`${T(e)}<div class="frow">
    <div class="fld sm"><label>${n("כל")}</label>${se(s.n,a=>i(s.unit,a),{min:1,max:59,attr:"every"})}</div>
    <div class="fld sm"><label>${n("יחידה")}</label>${Y(s.unit,[{value:"minutes",label:n("דקות")},{value:"hours",label:n("שעות")},{value:"seconds",label:n("שניות")}],a=>i(a,s.n),"unit")}</div>
  </div>${he(e)}`},Pr=e=>{const t=e.block,s=t.offset_min===0?"exact":t.offset_min<0?"before":"after",i=Math.abs(t.offset_min),a=(r,l)=>e.patch(d=>{d.offset_min=r==="before"?-l:r==="after"?l:0});return o`${T(e)}<div class="frow">
    <div class="fld">${R(n("אירוע"),Y(t.event,[{value:"sunset",label:n("שקיעה")},{value:"sunrise",label:n("זריחה")}],r=>e.patch(l=>{l.event=r}),"event"))}</div>
    <div class="fld">${R(n("מתי"),Y(s,[{value:"exact",label:n("בדיוק")},{value:"before",label:n("לפני")},{value:"after",label:n("אחרי")}],r=>a(r,i||20),"when"))}</div>
    ${s==="exact"?c:o`<div class="fld sm"><label>${n("דקות")}</label>${se(i,r=>a(s,Math.max(1,r??1)),{min:1,max:600,attr:"offset"})}</div>`}
  </div>${he(e)}`},Ar=e=>o`${T(e)}<div class="codenote">${f("power")}${n("מופעל פעם אחת אחרי שהמערכת עולה.")}</div>${he(e)}`,Nr=e=>{const t=e.block,s=Kt(t.entity_ids[0]),i=Array.isArray(t.state),a={purpose:"watch",onlyTriggerable:!0};return o`${T(e)}${Ae(e,t.entity_ids,{filter:a,apply:r=>e.patch(l=>{l.entity_ids=r})})}
    ${i?R(n("במצב"),o`<div class="rolechips">${s.map(r=>o`<button type="button" aria-pressed=${t.state.includes(r.value)} @click=${()=>e.patch(l=>{const d=l.state;l.state=d.includes(r.value)?d.filter(p=>p!==r.value):[...d,r.value]})}>${r.label}</button>`)}</div>`):o`<div class="frow"><div class="fld">${R(n("במצב"),Y(String(t.state),s,r=>e.patch(l=>{l.state=r}),"state"))}</div></div>`}
    <details class="opts" ?open=${!!t.for}><summary>${f("chevronDown")}${n("רק אם נשאר כך זמן מסוים")}${t.for?` · ${_i(t.for)}`:""}</summary>${Jt(t.for,r=>e.patch(l=>{r?l.for=r:delete l.for}),"for")}</details>`},Rr=e=>{const t=e.block,s=Oi();return o`${T(e)}${Ae(e,t.entity_ids,{...s,apply:i=>e.patch(a=>{a.entity_ids=i})})}
    <div class="frow">
      <div class="fld sm"><label>${n("מעל")}</label>${se(t.above,i=>e.patch(a=>{i===null?delete a.above:a.above=i}),{attr:"above"})}</div>
      <div class="fld sm"><label>${n("מתחת")}</label>${se(t.below,i=>e.patch(a=>{i===null?delete a.below:a.below=i}),{attr:"below"})}</div>
    </div>`},Lr=e=>{const t=e.block,s=t.weekday??[];return o`${T(e)}<div class="frow">
      <div class="fld sm"><label>${n("אחרי")}</label>${Lt(t.after,i=>e.patch(a=>{i?a.after=i:delete a.after}),"after")}</div>
      <div class="fld sm"><label>${n("לפני")}</label>${Lt(t.before,i=>e.patch(a=>{i?a.before=i:delete a.before}),"before")}</div>
    </div>
    ${R(n("ימים"),o`<div class="rolechips">${ps.map(i=>o`<button type="button" data-weekday=${i} aria-pressed=${s.includes(i)} @click=${()=>e.patch(a=>{const r=a.weekday??[],l=r.includes(i)?r.filter(d=>d!==i):[...r,i];l.length?a.weekday=ps.filter(d=>l.includes(d)):delete a.weekday})}>${er[i]}</button>`)}</div>`)}`},St=[{value:"after:sunset",label:n("אחרי השקיעה"),after:"sunset"},{value:"before:sunrise",label:n("לפני הזריחה"),before:"sunrise"},{value:"after:sunrise",label:n("אחרי הזריחה"),after:"sunrise"},{value:"before:sunset",label:n("לפני השקיעה"),before:"sunset"},{value:"night",label:n("בין השקיעה לזריחה (לילה)"),after:"sunset",before:"sunrise"},{value:"day",label:n("בין הזריחה לשקיעה (יום)"),after:"sunrise",before:"sunset"}],Mr=e=>{const t=e.block,s=St.find(i=>(i.after??null)===(t.after??null)&&(i.before??null)===(t.before??null))?.value??"after:sunset";return o`${T(e)}<div class="frow"><div class="fld">${Y(s,St,i=>{const a=St.find(r=>r.value===i);e.patch(r=>{delete r.after,delete r.before,a.after&&(r.after=a.after),a.before&&(r.before=a.before)})},"sun")}</div></div>`},Br=e=>{const t=e.block;return o`${T(e)}${R(n("הטריגרים"),e.triggerIds.length?o`<div class="rolechips">${e.triggerIds.map(s=>o`<button type="button" aria-pressed=${t.ids.includes(s)} @click=${()=>e.patch(i=>{const a=i.ids;i.ids=a.includes(s)?a.filter(r=>r!==s):[...a,s]})}>${s}</button>`)}</div>`:o`<small>${n("תנו מזהה לטריגר קודם")}</small>`)}`},Fr=e=>{const t=e.block;return o`${T(e)}<div class="frow"><div class="fld">${Y(t.mode,[{value:"only_holy_days",label:n("רק בשבת וחג")},{value:"not_holy_days",label:n("לא בשבת וחג")}],s=>e.patch(i=>{i.mode=s}),"mode")}</div></div>`},Ot=e=>o`${T(e)}${e.nested(e.block.uid,"conditions","condition")}`;function jr(e,t,s){const i=(a,r)=>e.patch(l=>{r==null||r===""?delete l.data[a]:l.data[a]=r});return o`${s.length?o`<div class="frow">${s.map(a=>{const r=t.data[a.key];return a.kind==="number"?o`<div class="fld sm"><label>${a.label}</label>${se(typeof r=="number"?r:null,l=>i(a.key,l),{unit:a.unit,min:a.min,max:a.max,attr:`data.${a.key}`,label:a.label})}</div>`:a.kind==="select"?o`<div class="fld">${R(a.label,Y(String(r??""),[{value:"",label:"—"},...a.options??[]],l=>i(a.key,l),`data.${a.key}`,"",a.label))}</div>`:a.kind==="boolean"?o`<div class="fld sm"><label>${a.label}</label><div class="rolechips"><button type="button" aria-pressed=${r===!0} @click=${()=>i(a.key,r===!0?null:!0)}>${n("כן")}</button></div></div>`:o`<div class="fld">${R(a.label,Je(String(r??""),l=>i(a.key,l),{attr:`data.${a.key}`,label:a.label}))}</div>`})}</div>`:c}`}const qr=(e,t)=>t.role==="device"&&(t.entity_ids.length?t.entity_ids:[""]).map(i=>ci(t.action,i?e.env.byId.get(i)?.class??null:null)).find(Boolean)?o`<div class="sensrow" data-sensitive-row>${f("alarm")}<span>${n("פעולה רגישה. מותרת לך כמו בשליטה ידנית; קוד לא נשמר.")}</span></div>`:c;function Ur(e,t){const s=t.entity_ids[0],i=Fe(s)||Fe(t.action),a=e.env.catalog.actions[i]??[],r=a.find(m=>m.action===t.action),l=!t.entity_ids.length&&ci(t.action,null)!==null,d={purpose:"target",controllable:!0,...t.entity_ids.length?{domains:[Fe(s)]}:{},...l?{sensitive:!0}:{}},p=m=>e.patch(g=>{g.entity_ids=m;const x=Fe(m[0]);if(x&&Fe(g.action)!==x){const O=e.env.catalog.actions[x];O?.length&&(g.action=O[0].action,g.data={})}}),u=a.length?a.map(m=>({value:m.action,label:m.label||m.action})):[{value:t.action,label:t.action}];return o`${T(e)}${Ae(e,t.entity_ids,{filter:d,apply:p})}
    <div class="frow"><div class="fld">${R(n("פעולה"),Y(t.action,u,m=>e.patch(g=>{g.action=m,g.data={}}),"action"))}</div></div>
    ${jr(e,t,r?.args??[])}${qr(e,t)}`}function Vr(e,t){const i=(e.env.catalog.scripts.find(r=>r.entity_id===t.action)?.fields??[]).filter(r=>r.selector.kind!=="locked");if(!i.length)return c;const a=(r,l)=>e.patch(d=>{l==null||l===""?delete d.data[r]:d.data[r]=l});return o`<div class="frow">${i.map(r=>{const l=t.data[r.key],d=r.selector;return d.kind==="number"?o`<div class="fld sm"><label>${r.name}</label>${se(typeof l=="number"?l:r.default??null,p=>a(r.key,p),{min:d.min,max:d.max,unit:d.unit,attr:`data.${r.key}`,label:r.name})}</div>`:d.kind==="select"?o`<div class="fld">${R(r.name,Y(String(l??r.default??""),[{value:"",label:"—"},...d.options.map(p=>({value:p,label:p}))],p=>a(r.key,p),`data.${r.key}`,"",r.name))}</div>`:d.kind==="boolean"?o`<div class="fld sm"><label>${r.name}</label><div class="rolechips"><button type="button" aria-pressed=${(l??r.default)===!0} @click=${()=>a(r.key,(l??r.default)!==!0)}>${n("כן")}</button></div></div>`:o`<div class="fld">${R(r.name,Je(String(l??r.default??""),p=>a(r.key,p),{attr:`data.${r.key}`,label:r.name}))}</div>`})}</div>`}const Wr=e=>{const t=e.block;switch(t.role){case"scene":return o`${T(e)}<div class="frow"><div class="fld">${R(n("סצנה"),Y(t.entity_ids[0]??"",[{value:"",label:n("בחרו סצנה")},...e.env.catalog.scenes.map(s=>({value:s.entity_id,label:s.area?`${s.name} · ${s.area}`:s.name}))],s=>e.patch(i=>{i.entity_ids=s?[s]:[]}),"scene"))}</div></div>`;case"script":return o`${T(e)}<div class="frow"><div class="fld">${R(n("סקריפט"),Y(t.entity_ids[0]??"",[{value:"",label:n("בחרו סקריפט")},...e.env.catalog.scripts.map(s=>({value:s.entity_id,label:s.name}))],s=>e.patch(i=>{i.action=s||"script.turn_on",i.entity_ids=s?[s]:[],i.data={}}),"script"))}</div></div>${Vr(e,t)}`;case"notify":return o`${T(e)}<div class="frow"><div class="fld">${R(n("אל"),Y(t.action,e.env.catalog.notify_targets.length?e.env.catalog.notify_targets.map(s=>({value:s.action,label:s.name})):[{value:t.action,label:e.env.ctx.notifyName?.(t.action)??t.action}],s=>e.patch(i=>{i.action=s}),"target"))}</div></div>
        ${R(n("הודעה"),o`<label class="inp"><input type="text" data-fld="message" aria-label=${n("הודעה")} dir="auto" placeholder=${n("מה לכתוב")} .value=${typeof t.data.message=="string"?t.data.message:""} @input=${s=>e.patch(i=>{i.data.message=s.target.value})} /></label>`)}`;case"automation":return o`${T(e)}<div class="codenote">${f("bolt")}${n("שולט באוטומציה אחרת. אפשר להזיז או למחוק.")}</div>`;default:return Ur(e,t)}},Hr=e=>{const t=e.block;return o`${T(e)}${Jt(t.delay,s=>e.patch(i=>{i.delay=s??{}}),"delay")}`},Oe=(e,t)=>{const s=e==="then"?"play":e==="else"?"shuffle":"question",i=e==="if"?n("אם"):e==="then"?n("אז"):e==="else"?n("אחרת"):`${n("ענף {n}",{n:String(t)})} · ${n("אם")}`;return o`<h4 class="sub-h"><span class="k ${e==="then"?"then":"if"}">${f(s,12)}</span>${i}</h4>`},Gr=e=>o`${T(e)}<div class="bsec">${Oe("if")}${e.nested(e.block.uid,"if","condition")}</div>
  <div class="bsec">${Oe("then")}${e.nested(e.block.uid,"then","action")}</div>
  <div class="bsec">${Oe("else")}${e.nested(e.block.uid,"else","action")}</div>`,Yr=e=>{const t=e.block;return o`${T(e)}${t.options.map((s,i)=>o`<div class="bsec" data-choose-option=${i}>
      <div class="opt-h">${Oe("opt",i+1)}${t.options.length>1?o`<button class="btn quiet sm" type="button" data-option-remove=${i} @click=${()=>e.patch(a=>{a.options.splice(i,1)})}>${f("trash")}${n("הסר ענף")}</button>`:c}</div>
      ${e.nested(e.block.uid,`choose.${i}.conditions`,"condition")}
      ${Oe("then")}${e.nested(e.block.uid,`choose.${i}.sequence`,"action")}</div>`)}
    ${t.options.length<st.choose_options_max?o`<button class="btn quiet sm" type="button" data-option-add @click=${()=>e.patch(s=>{s.options.push({conditions:[],sequence:[]})})}>${f("plus")}${n("ענף נוסף")}</button>`:c}
    ${t.default?o`<div class="bsec">${Oe("else")}${e.nested(e.block.uid,"default","action")}</div>`:o`<button class="btn quiet sm" type="button" data-default-add @click=${()=>e.patch(s=>{s.default=[]})}>${f("plus")}${n('ענף "אחרת"')}</button>`}`},Kr=e=>{const t=e.block;return o`${T(e)}<div class="frow"><div class="fld sm"><label>${n("פעמים")}</label>${se(t.count,s=>e.patch(i=>{i.count=Math.round(s??1)}),{min:1,max:1e3,attr:"count"})}</div></div>
    <div class="bsec">${e.nested(e.block.uid,"repeat.sequence","action")}</div>`},Jr=e=>{const t=e.block.condition,s=fe[`condition:${t.type}`];return o`${T(e)}${s?s(e.child(t,"condition")):c}`},Xr=e=>{const t=e.block;return o`${T(e)}${R(n("הודעה (לא חובה)"),Je(t.message,s=>e.patch(i=>{i.message=s}),{attr:"message",ph:n("למה עוצרים")}))}`},fe={"trigger:state":Er,"trigger:numeric_state":Dr,"trigger:time":Cr,"trigger:time_pattern":Ir,"trigger:sun":Pr,"trigger:homeassistant":Ar,"condition:state":Nr,"condition:numeric_state":Rr,"condition:time":Lr,"condition:sun":Mr,"condition:trigger":Br,"condition:shabbat":Fr,"condition:and":Ot,"condition:or":Ot,"condition:not":Ot,"action:service":Wr,"action:delay":Hr,"action:if":Gr,"action:choose":Yr,"action:repeat_count":Kr,"action:condition":Jr,"action:stop":Xr};function Ei(e){const t=e.block;if(t.kind==="locked")return Qr(e,t);const s=fe[`${e.section}:${t.type}`];return s?s(e):o`<div class="codenote">${f("info")}${n("אין טופס לחלק הזה.")}</div>`}function Qr(e,t){const s=JSON.stringify(t.raw,null,2).split(`
`),i=e.canCode&&!t.masked&&t.reason==="template"&&typeof t.template_text=="string";return o`<div class="codenote" data-locked-note>${f("lock")}<span>${ir(t)}. ${n("אפשר להזיז, לשכפל או למחוק")}${e.canCode?`; ${n("לעריכה – תצוגת הקוד")}`:""}.</span></div>
    ${di(t)?o`<div class="codenote">${f("calendar")}${n("שולט בתזמונים של המערכת.")}</div>`:c}
    ${i?o`<div class="fld full"><label><span class="tag lock">{{ }}</span> ${n("טקסט התבנית")}</label>
      <label class="inp area"><textarea rows="3" dir="ltr" data-template-text aria-label=${n("טקסט התבנית")} .value=${t.template_text??""} @change=${a=>e.editTemplate(t.uid,a.target.value)}></textarea></label></div>`:c}
    <div class="lockcode" data-locked-code dir="ltr">${s.map(a=>o`<span class="ln">${a}</span>`)}</div>
    ${e.canCode?o`<div class="frow"><button class="btn sm" type="button" data-goto-code @click=${e.gotoCode}>${f("code")}${n("ערוך בקוד")}</button></div>`:c}`}const Zr=B`
  .bf {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .err {
    font-size: var(--sw-fs-sm);
    color: var(--dv-danger);
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: var(--sw-fw-semibold);
  }
  .entpick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .ent {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-block-size: 36px;
    padding-block: 3px;
    padding-inline: 12px 6px;
    border-radius: 999px;
    background: var(--dv-surface-solid, var(--dv-surface));
    border: 1px solid var(--dv-border);
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-medium);
  }
  .ent .ic {
    font-size: var(--sw-fs-md);
    color: var(--dv-text-2);
  }
  .ent small {
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
  }
  .ent small.bad {
    color: var(--dv-danger);
  }
  .ent .rm {
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    border: 0;
    background: var(--dv-surface-3);
    display: grid;
    place-items: center;
    color: var(--dv-text-2);
    padding: 0;
  }
  .ent .rm .ic {
    font-size: var(--sw-fs-xs);
    color: inherit;
  }
  .ent.add {
    border-style: dashed;
    border-color: var(--dv-border-strong);
    color: var(--dv-accent-text);
    font-weight: var(--sw-fw-semibold);
    padding-inline: 12px;
    background: transparent;
    cursor: pointer;
  }
  .ent.add .ic {
    color: var(--dv-accent-text);
  }
  .ent.sens {
    border-color: var(--ab-sens-line);
    background: var(--ab-sens-bg);
  }
  .opts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--dv-radius-sm, 14px);
    background: var(--dv-surface-2);
    border: 1px solid var(--dv-border);
  }
  .opts summary {
    cursor: pointer;
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-semibold);
    color: var(--dv-text-2);
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 28px;
    list-style: none;
  }
  .opts summary::-webkit-details-marker {
    display: none;
  }
  .opts summary .ic {
    font-size: var(--sw-fs-lg);
    transition: transform 200ms;
  }
  .opts[open] summary .ic {
    transform: rotate(180deg);
  }
  .codenote {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    line-height: 1.5;
  }
  .codenote .ic {
    margin-block-start: 3px;
    font-size: var(--sw-fs-md);
  }
  .sensrow {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 9px 12px;
    border-radius: var(--sw-r-md);
    background: var(--ab-sens-bg);
    color: var(--ab-sens-fg);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
  }
  .bsec {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sub-h {
    margin: 4px 0 0;
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-bold);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .opt-h {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .k {
    display: grid;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    border-radius: var(--sw-r-xs);
    color: var(--sw-text-inverse);
    flex: none;
  }
  .k.if {
    background: var(--sw-text-3);
  }
  .k.then {
    background: var(--dv-accent);
  }
  .lockcode {
    border-radius: var(--sw-r-md);
    background: var(--dv-surface-3);
    padding: 8px 10px;
    font: 12px/1.7 var(--sw-font-mono, ui-monospace, monospace);
    max-block-size: 220px;
    overflow: auto;
    border-inline-start: 3px solid var(--dv-text-3);
    text-align: start; /* dir="ltr" on the element: start = left */
  }
  .lockcode .ln {
    display: block;
    white-space: pre;
  }
`;var eo=Object.defineProperty,to=Object.getOwnPropertyDescriptor,Ne=(e,t,s,i)=>{for(var a=i>1?void 0:i?to(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&eo(t,s,a),a};const Di=e=>({uid:pt(),kind:"typed",raw:null,sentence:"",...e}),Ns={id:"button",label:n("כפתור קיר"),hint:n("לחיצה על מפסק"),icon:"button",available:e=>!!e.catalog.extension?.wall_buttons,make:()=>Di({type:"button",device_id:"",domain:"",ha_type:"remote_button_short_press",ha_subtype:"button_1",button:1,press:"short",extra:{}})},Rs={id:"presence_in",label:n("מי במבנה"),hint:n("יש מישהו · אין אף אחד"),icon:"users",available:e=>!!e.catalog.extension?.presence,make:()=>Di({type:"presence",mode:"nobody",where:"building"})};Ue.some(e=>e.id===Ns.id)||Ue.splice(1,0,Ns);Ve.some(e=>e.id===Rs.id)||Ve.splice(5,0,Rs);let so=null;const Ls=new Map,io=()=>so??=oa().then(e=>(e.devices.forEach(t=>Ht.set(t.device_id,t.name)),e.devices)).catch(()=>[]),Ms=(e,t)=>{const s=`${e}|${t??""}`;let i=Ls.get(s);return i||(i=la(e,t).catch(()=>({device_id:e,buttons:[],source:"stored"})),Ls.set(s,i)),i};function Ci(e,t,s){const i=e?.buttons.find(a=>a.button===t)?.presses.find(a=>a.press===s);return i?{ha_type:i.ha_type,ha_subtype:i.ha_subtype,domain:i.domain,...i.discovery_id?{discovery_id:i.discovery_id}:{}}:null}function Et(e,t,s,i){const a=Ci(t,s,i);e.patch(r=>{r.button=s,r.press=i,a&&(r.ha_type=a.ha_type,r.ha_subtype=a.ha_subtype,a.domain&&a.domain!=="unknown"&&(r.domain=a.domain),r.extra=a.discovery_id?{discovery_id:a.discovery_id}:{})})}let $e=class extends Q{constructor(){super(...arguments),this.fc=null,this.devices=null,this.buttons=null,this.listening=!1,this.note="",this.loadedFor=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),io().then(e=>{this.devices=e})}willUpdate(){const e=this.fc?.block,t=e?.device_id?`${e.device_id}|${this.fc?.itemId??""}`:"";t&&t!==this.loadedFor&&(this.loadedFor=t,Ms(e.device_id,this.fc?.itemId??null).then(s=>{this.loadedFor===t&&(this.buttons=s)}))}async detect(){const e=this.fc,t=e?.block;if(!(!e||!t?.device_id||this.listening)){this.listening=!0,this.note="";try{const s=await ra(t.device_id);s.detected&&s.button&&s.press?Et(this.fc,this.buttons,s.button,s.press):this.note=n("לא זוהתה לחיצה")}catch{this.note=n("לא זוהתה לחיצה")}this.listening=!1}}async pickDevice(e){const t=this.fc;if(!t)return;this.buttons=null;const s=e?await Ms(e,t.itemId??null):null;this.buttons=s,this.loadedFor=e?`${e}|${t.itemId??""}`:"";const i=s?.buttons[0]?.presses[0];this.fc.patch(a=>{a.device_id=e,i&&s&&(a.domain=i.domain,a.ha_type=i.ha_type,a.ha_subtype=i.ha_subtype,a.button=s.buttons[0].button,a.press=i.press,a.extra=i.discovery_id?{discovery_id:i.discovery_id}:{})})}render(){const e=this.fc;if(!e)return c;const t=e.block,s=e.env.catalog.extension?.wall_timing,i=this.devices?.find(d=>d.device_id===t.device_id)??null,a=this.buttons,r=a?.buttons.length?a.buttons:Array.from({length:Math.max(t.button||1,1)},(d,p)=>({button:p+1,presses:[],used:!1})),l=(d,p)=>!a?.buttons.length||!!Ci(a,d,p);return o`<div class="kav-tools"><span class="sp"></span>
        <button class="btn sm" type="button" data-kav-detect ?disabled=${!t.device_id||this.listening} @click=${()=>void this.detect()}>${f("flask")}${this.listening?n("מאזינים ללחיצה…"):n("זיהוי בלחיצה על הכפתור")}</button></div>
      ${this.note?o`<div class="err" role="status" data-kav-detect-note>${f("info")}${this.note}</div>`:c}
      <div class="fld"><label>${n("מפסק או כפתור קיר")}</label>
        <select class="selx" data-kav-device aria-label=${n("מפסק")} @change=${d=>void this.pickDevice(d.target.value)}>
          ${t.device_id?c:o`<option value="" selected>${n("בחרו מפסק")}</option>`}
          ${(this.devices??[]).map(d=>o`<option value=${d.device_id} ?selected=${d.device_id===t.device_id}>${d.name}${d.area?` · ${d.area}`:""}</option>`)}
          ${t.device_id&&!i?o`<option value=${t.device_id} selected>${Ht.get(t.device_id)??n("מפסק")}</option>`:c}
        </select></div>
      <div class="fld"><label>${n("כפתור")}</label>
        <div class="kav-btns" role="group" aria-label=${n("כפתור")} data-kav-buttons>${r.map(d=>o`<button type="button" aria-pressed=${String(d.button===t.button)} data-kav-button=${d.button}
          @click=${()=>Et(e,a,d.button,l(d.button,t.press)?t.press:a?.buttons.find(p=>p.button===d.button)?.presses[0]?.press??t.press)}>${d.button}${d.used?o`<small>${n("בשימוש")}</small>`:c}</button>`)}</div></div>
      <div class="fld"><label>${n("סוג לחיצה")}</label>
        <div class="kav-press" role="group" aria-label=${n("סוג לחיצה")} data-kav-press>${ma.map(d=>o`<button type="button" aria-pressed=${String(d===t.press)} ?disabled=${!l(t.button,d)} data-kav-press-kind=${d}
          @click=${()=>Et(e,a,t.button,d)}><span class="pi ${d}"><i></i>${d==="double"?o`<i></i>`:c}</span>${ba[d].replace("לחיצה ","")}
          <small>${d==="short"?n("לחיצה אחת"):d==="double"?o`${n("עד")} <bdi>${s?.double_ms??400}</bdi> ${n("מ״ש בין לחיצות")}`:o`${n("מעל")} <bdi>${s?.long_ms??800}</bdi> ${n("מ״ש")}`}</small></button>`)}</div>
        <span class="kav-note">${n("הזמנים נקבעים בהגדרות ‹ אוטומציות")} · <a href="#/system/automations">${n("שינוי")}</a></span></div>`}};Ne([b({attribute:!1})],$e.prototype,"fc",2);Ne([h()],$e.prototype,"devices",2);Ne([h()],$e.prototype,"buttons",2);Ne([h()],$e.prototype,"listening",2);Ne([h()],$e.prototype,"note",2);$e=Ne([H("kav-button-form")],$e);const ao=e=>o`<kav-button-form .fc=${e} data-kav-button-form></kav-button-form>`;function no(e){const t=e.block,s=e.env.catalog.extension?.presence_sources,i=(a,r,l,d=c,p=!1)=>o`<span class="kav-src" aria-pressed=${String(a&&!p)} aria-disabled=${String(p)} data-kav-source=${l}>${f(r)}${l}${d}</span>`;return o`<div class="frow">
      <div class="fld"><label>${n("מצב")}</label><select class="selx" data-kav-presence-mode aria-label=${n("מצב")} @change=${a=>e.patch(r=>{r.mode=a.target.value})}>
        <option value="nobody" ?selected=${t.mode==="nobody"}>${n("אין אף אחד")}</option><option value="someone" ?selected=${t.mode==="someone"}>${n("יש מישהו")}</option></select></div>
      <div class="fld"><label>${n("איפה")}</label><select class="selx" aria-label=${n("איפה")} data-kav-presence-where><option value="building" selected>${n("כל המבנה")}</option></select></div></div>
    <div class="fld"><label>${n("לפי")}</label><div class="kav-srcs">
      ${i(!!s?.geofence,"home",n("גיאו־גדר"))}${i(!!s?.beacon,"sensor",n("משואה"))}
      ${i(!!s?.wifi,"sensor","Wi‑Fi",s?.wifi_mode==="server"?c:o`<small>${n("רק כשהאתר במצב שרת")}</small>`,s?.wifi_mode!=="server")}</div></div>`}const ro={"sensor.leak":n("הצפה"),"sensor.smoke":n("עשן"),"sensor.gas":n("גז"),"sensor.co":n("פחמן חד־חמצני"),"alarm.triggered":n("אזעקה")};function oo(e){const t=e.map(s=>ro[s]??s);return t.length?t.length===1?n("מותר כי ״{words}״ מסומנת כאירוע בטיחות בהגדרות ‹ התראות.",{words:t.join(n("״, ״"))}):n("מותר כי ״{words}״ מסומנות כאירוע בטיחות בהגדרות ‹ התראות.",{words:t.join(n("״, ״"))}):n("רק לאירועי בטיחות שהופעלו בהגדרות ‹ התראות.")}function lo(e){const t=e.block,s=e.ext?.critical,i=!!t.critical,a=!!s?.allowed||i;return o`<div class="kav-swrow" data-kav-critical>${f("bell")}<div class="t">${n("צליל קריטי שעוקף ״נא לא להפריע״")}<small>${oo(s?.allowed?s.sources:[])}</small></div>
    <sw-toggle label=${n("צליל קריטי")} labelHidden .checked=${i} ?disabled=${!a} @change=${r=>e.patch(l=>{r.detail.checked?l.critical=!0:delete l.critical})}></sw-toggle></div>`}const Bs=fe["action:service"];fe["trigger:button"]=ao;fe["condition:presence"]=no;fe["action:service"]=e=>{const t=e.block,s=Bs?Bs(e):Ei(e);return t.role==="notify"&&e.kind==="automation"&&(e.ext?.critical||t.critical)?o`${s}${lo(e)}`:s};const co=B`
  .kav-tools { display: flex; gap: 8px; align-items: center; }
  .kav-tools .sp { flex: 1; }
  .kav-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .kav-btns button { min-inline-size: 52px; min-block-size: 44px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border-strong); background: var(--dv-surface-2, transparent);
    color: var(--dv-text); font: inherit; font-weight: var(--sw-fw-bold); display: inline-flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; }
  .kav-btns button small { font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium); color: var(--sw-warning-text); }
  .kav-btns button[aria-pressed='true'], .kav-press button[aria-pressed='true'] { border-color: var(--dv-accent); background: color-mix(in srgb, var(--dv-accent) 14%, transparent); color: var(--dv-accent); }
  .kav-press { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .kav-press button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border-strong);
    background: var(--dv-surface-2, transparent); color: var(--dv-text); font: inherit; font-weight: var(--sw-fw-semibold); cursor: pointer; }
  .kav-press button:disabled { opacity: 0.4; cursor: not-allowed; }
  .kav-press small { font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-regular); color: var(--dv-text-2); }
  .kav-press .pi { display: inline-flex; gap: 3px; block-size: 10px; align-items: center; }
  .kav-press .pi i { inline-size: 10px; block-size: 10px; border-radius: 50%; background: currentColor; }
  .kav-press .pi.long i { inline-size: 26px; border-radius: var(--sw-r-xs); }
  .kav-note { font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
  .kav-note a { color: var(--dv-accent); }
  .kav-srcs { display: flex; gap: 8px; flex-wrap: wrap; }
  .kav-src { display: inline-flex; align-items: center; gap: 6px; min-block-size: 34px; padding-inline: 12px; border-radius: 999px; border: 1px solid var(--dv-border-strong); font-size: var(--sw-fs-sm); }
  .kav-src[aria-pressed='true'] { border-color: var(--dv-accent); color: var(--dv-accent); }
  .kav-src[aria-disabled='true'] { opacity: 0.55; }
  .kav-src small { font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
  .kav-swrow { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border); }
  .kav-swrow > .ic { color: var(--dv-danger); }
  .kav-swrow .t { flex: 1; display: flex; flex-direction: column; font-weight: var(--sw-fw-semibold); }
  .kav-swrow .t small { font-weight: var(--sw-fw-regular); font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
`,Ti=e=>({uid:pt(),kind:"typed",raw:null,sentence:"",...e}),He=e=>e.catalog.extension?.building_presence?.sensors??[],Fs={id:"building_empty",label:n("נוכחות במבנה"),hint:n("מבנה ריק · חדר פעיל"),icon:"users",available:e=>He(e).length>0,make:e=>Ti({type:"building_empty",sensors:He(e),minutes:15})},js={id:"room_occupied",label:n("נוכחות במבנה"),hint:n("המבנה ריק / יש נוכחות"),icon:"users",available:e=>He(e).length>0,make:e=>Ti({type:"room_occupied",mode:"occupied",sensors:He(e)})};Ue.some(e=>e.id===Fs.id)||Ue.push(Fs);Ve.some(e=>e.id===js.id)||Ve.push(js);function Ii(e,t){const s=He(e.env),i=(a,r)=>e.patch(l=>{const d=new Set(l.sensors);r?d.add(a):d.delete(a),l.sensors=s.filter(p=>d.has(p))});return o`<div class="fld full"><label>${n("חיישנים")}</label><div class="frow" data-presence-sensors>
    ${s.map(a=>o`<label class="chk"><input type="checkbox" data-presence-sensor=${a} .checked=${t.includes(a)} @change=${r=>i(a,r.target.checked)} />${e.env.ctx.names?.(a)??a}</label>`)}</div></div>`}function po(e){const t=e.block;return o`<div class="frow"><div class="fld"><label>${n("מה")}</label><select class="selx" aria-label=${n("מה")} data-fld="presence.what"><option selected>${n("המבנה התרוקן")}</option></select></div>
    <div class="fld sm"><label>${n("במשך (דקות)")}</label><label class="inp"><input class="n" type="number" min="1" max=${us} step="1" data-fld="presence.minutes" aria-label=${n("דקות")} .value=${String(t.minutes)}
      @change=${s=>e.patch(i=>{const a=Math.round(Number(s.target.value));i.minutes=Number.isFinite(a)?Math.min(us,Math.max(1,a)):15})} /></label></div></div>
    ${Ii(e,t.sensors)}`}function uo(e){const t=e.block;return o`<div class="frow"><div class="fld"><label>${n("מצב")}</label><select class="selx" aria-label=${n("מצב")} data-fld="presence.mode" @change=${s=>e.patch(i=>{i.mode=s.target.value})}>
      <option value="occupied" ?selected=${t.mode==="occupied"}>${n("יש נוכחות")}</option><option value="empty" ?selected=${t.mode==="empty"}>${n("אין נוכחות")}</option></select></div></div>
    ${Ii(e,t.sensors)}`}fe["trigger:building_empty"]=po;fe["condition:room_occupied"]=uo;const be={loading:n("טוען"),viewOnly:n("צפייה בלבד"),fix:n("יש דברים לתקן"),warnings:n("יש אזהרות"),warningsBlocked:n("יש אזהרות לטיפול")};function ho(e){if(!e.loaded)return{code:"loading",text:be.loading};if(e.hardReadOnly)return{code:"read_only",text:e.roText};if(e.busy)return{code:"busy",text:""};if(e.blockerText!==null)return{code:"blocked",text:e.blockerText};if(e.view==="code")return e.codeMode==="readonly"?{code:"code_read_only",text:be.viewOnly}:e.codeOk?e.codeDirtyOrDraft()?null:{code:"code_unchanged",text:""}:{code:"code_invalid",text:be.fix};if(e.issueCount())return{code:"issues",text:be.fix};const t=e.grantText();if(t!==null)return{code:"grant",text:t};const s=e.previewText();return s!==null?{code:"preview",text:s}:!e.isNew&&!e.dirty()?{code:"unchanged",text:""}:e.warnMode!=="save"?e.warnMode==="blocked"?{code:"warnings_blocked",text:be.warningsBlocked}:{code:"warnings",text:be.warnings}:null}function qs(e,t){return t==="with_warnings"&&e?.code==="warnings"}var vo=Object.defineProperty,S=(e,t,s,i)=>{for(var a=void 0,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=l(t,s,a)||a);return a&&vo(t,s,a),a};const de=e=>o`<div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%">${e}</div>`,fo={template:n("תבנית"),device:n("מכשיר"),purpose_trigger:n("ייעודי"),custom_service:n("שירות מיוחד"),service_not_allowed:n("לא מותר"),unsupported_step:n("מתקדם"),disabled_step:n("מושבת"),secret:n("חסוי"),code:n("חסוי"),unknown:n("לא מוכר")},Us=new Set(["delegation_off","grant_required"]);class _ extends Q{constructor(){super(...arguments),this.itemId=null,this.mode="edit",this.open=!0,this.scheme="",this.draft0=null,this.phase="loading",this.loadError="",this.loadDenied=!1,this.status=null,this.env=null,this.item=null,this.draft=null,this.openUid=null,this.view="builder",this.codeText="",this.codeOk=!0,this.preview=null,this.busy="",this.pop=null,this.picker=null,this.dialog=null,this.dryResult=null,this.saveError="",this.serverIssues=[],this.conflict=null,this.note="",this.dragUid=null,this.dropAt=null,this.touched=!1,this.stage="edit",this.templateName="",this.optionsOpen=!1,this.version=0,this.previewVersion=-1,this.previewFailed=!1,this.initial="",this.storedDraft=null,this.codeBase="",this.lockedFps=new Set,this.previewTimer=0,this.loadToken=0,this.lastDialogClose=0,this.lastKeyEsc=0,this.suggestDraft=null,this.issuesMemo=new Ze,this.issuesByMemo=new Ze,this.dirtyMemo=new Ze,this.pathsMemo=new Ze,this.onBeforeUnload=t=>{this.open&&this.dirty&&!this.busy&&(t.preventDefault(),t.returnValue="")},this.onSheetCancel=t=>{t.preventDefault();const s=performance.now();s-this.lastDialogClose<120||s-this.lastKeyEsc<120||this.requestCancel()},this.onSheetKey=t=>{t.key==="Escape"&&(this.picker||this.pop)&&(t.preventDefault(),t.stopPropagation(),this.picker=null,this.pop=null,this.lastKeyEsc=performance.now())},this.dialogClosed=()=>{this.dialog=null,this.lastDialogClose=performance.now()},this.onCode=t=>{this.codeText=t.detail.text,this.codeOk=t.detail.ok,this.saveError=""},this.gotoCode=()=>{this.setView("code")},this.editTemplate=(t,s)=>this.patchBlock(t,i=>{i.kind==="locked"&&Object.assign(i,rr(i,s))}),this.onDragEnd=()=>{this.dragUid=null,this.dropAt=null}}get codeToggle(){return!0}get startsWithGallery(){return!1}footerExtras(){return c}static{this.styles=[Bi,En,Te,Zr,co,da,B`
      /* KAV079-295: the pre-save warnings box (state 4) and the "save with warnings" button */
      .vbox {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border-radius: var(--dv-radius-sm, 14px);
        background: color-mix(in srgb, var(--dv-warning) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--dv-warning) 35%, transparent);
      }
      .vbox > b {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: var(--sw-fs-base);
      }
      .vbox > b small {
        font-weight: var(--sw-fw-regular);
        color: var(--dv-text-2);
      }
      .vbox .iss {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 10px;
        align-items: center;
      }
      .vbox .iss > div {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
      }
      .vbox .iss .s {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
      }
      .btn.warn {
        background: color-mix(in srgb, var(--dv-warning) 18%, transparent);
        border-color: color-mix(in srgb, var(--dv-warning) 50%, transparent);
      }
    `,B`
      :host {
        display: contents;
      }
      /* AUDIT30-I3 (#11, owner Q9 option a): the builder's sheet is opaque and on the product's dialog tokens - the solid surface, no
         backdrop blur (was blur(40px) saturate(1.8) over a translucent sheen), the dialog radius (was 28 px), the shared scrim and the
         floating shadow. The sheet stays a native modal <dialog> because its close request is guarded (unsaved changes ask first:
         onSheetCancel); sw-dialog closes itself on Escape / X / scrim without a cancelable hook (see docs/changes/AUDIT30-I-DEVICES.md).
         DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A: "אוטומציה חדשה" gets the same dialog, at the wide width): the builder no longer
         hangs on the side - it is centred like every dialog, at the one dialog's wide width (720 px), on its surface (the floating-layer
         pair, opaque), with its radius, and it lands like it. sw-dialog now has the cancelable beforeclose event; hosting the builder's
         own header, pop-overs and pickers inside it is the remaining step (docs/changes/DIALOG-DRAWER-ONE-2439.md). */
      dialog.sheet {
        position: fixed;
        box-sizing: border-box;
        margin: auto;
        padding: 0;
        border: 1px solid var(--sw-menu-border);
        color: var(--dv-text);
        background: var(--sw-menu-surface);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        border-radius: var(--sw-r-lg);
        box-shadow: var(--sw-shadow-3);
        inset: 0;
        inline-size: min(720px, calc(100vw - 32px));
        block-size: min(860px, calc(100dvh - 32px));
        max-block-size: none;
        max-inline-size: none;
        overflow: hidden;
        flex-direction: column;
        isolation: isolate;
        font-family: var(--dv-font, var(--sw-font));
      }
      dialog.sheet:focus,
      dialog.sheet:focus-visible {
        outline: none;
      }
      dialog.sheet[open] {
        display: flex;
        animation: rin var(--sw-spring-dialog-ms) var(--sw-spring-dialog);
      }
      dialog.sheet::backdrop {
        background: var(--sw-overlay);
      }
      /* OVERLAY-FADE-2520: the editor sheet lands (desktop) or rises (phone) by transform only - its texts are at full contrast from the
         first frame; the ::backdrop holds no text */
      @keyframes rin {
        from {
          transform: scale(0.96) translateY(6px);
        }
      }
      @keyframes rup {
        from {
          transform: translateY(40px);
        }
      }
      /* the confirmations and small forms over the sheet read on a solid surface (the sheet itself is the glass) */
      sw-dialog {
        --sw-surface: var(--dv-surface-solid);
        --sw-glass-blur: none;
      }
      .grab {
        display: none;
        inline-size: 40px;
        block-size: 5px;
        border-radius: 3px;
        background: var(--dv-border-strong);
        margin: 8px auto 0;
        flex: none;
      }
      header.shh {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 16px 10px;
        flex: none;
        min-inline-size: 0;
      }
      .shh .tx {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.25;
        gap: 2px;
      }
      .shh .tx small {
        font-size: var(--sw-fs-base);
        color: var(--dv-text-2);
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .shh h3 {
        margin: 0;
        font-size: var(--sw-fs-2xl);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.025em;
      }
      .shh .bk {
        inline-size: 38px;
        block-size: 38px;
        border-radius: 50%;
        border: 0;
        background: var(--dv-surface-3);
        display: grid;
        place-items: center;
        color: var(--dv-text);
        flex: none;
        font-size: var(--sw-fs-xl);
      }
      .namein {
        inline-size: 100%;
        min-inline-size: 0;
        border: 0;
        background: transparent;
        font: inherit;
        font-size: var(--sw-fs-2xl);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.025em;
        color: var(--dv-text);
        outline: none;
        border-block-end: 1.5px dashed var(--dv-border-strong);
        padding: 2px 0 3px;
      }
      .namein:focus {
        border-block-end-color: var(--dv-accent);
      }
      .namein::placeholder {
        color: var(--dv-text-3);
        font-weight: var(--sw-fw-semibold);
      }
      .shh .tgl {
        flex: none;
        --sw-accent: var(--dv-toggle-on);
      }
      .shsub {
        padding: 0 16px 6px;
        display: none;
      }
      .shsub sw-tabs {
        --sw-tab-min-h: 40px;
      }
      .shb {
        flex: 1;
        overflow: auto;
        padding: 2px 16px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scrollbar-width: thin;
        overscroll-behavior: contain;
        position: relative;
        min-block-size: 0;
      }
      .shb > * {
        flex-shrink: 0;
      }
      footer.shf {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 16px 16px;
        border-block-start: 1px solid var(--dv-border);
        background: var(--sw-surface-solid);
      }
      footer.shf .sp {
        flex: 1;
      }
      .sugg {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-block-size: 40px;
        padding-inline: 14px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--dv-accent) 45%, transparent);
        background: var(--dv-accent-soft);
        color: var(--dv-accent-text);
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-base);
      }
      /* ---- banners ---- */
      .banner {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 12px 14px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-warning-soft);
        border: 1px solid color-mix(in srgb, var(--dv-warning) 40%, transparent);
        font-size: var(--sw-fs-base);
        line-height: 1.45;
      }
      .banner.info {
        background: var(--dv-accent-soft);
        border-color: color-mix(in srgb, var(--dv-accent) 30%, transparent);
      }
      .banner.bad {
        background: var(--dv-danger-soft);
        border-color: color-mix(in srgb, var(--dv-danger) 35%, transparent);
      }
      .banner > .ic {
        font-size: var(--sw-fs-xl);
        margin-block-start: 1px;
        color: var(--ab-amber-text);
      }
      .banner.info > .ic {
        color: var(--dv-accent-text);
      }
      .banner.bad > .ic {
        color: var(--dv-danger);
      }
      .banner .t {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .banner .t b {
        font-size: var(--sw-fs-base);
      }
      .banner .t small {
        color: var(--dv-text-2);
        font-size: var(--sw-fs-sm);
      }
      .banner .acts {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-block-start: 8px;
      }
      .sentbox {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 14px 16px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-accent-soft);
        color: var(--dv-text);
        font-size: var(--sw-fs-lg);
        line-height: 1.55;
        font-weight: var(--sw-fw-medium);
      }
      .sentbox > .ic {
        font-size: var(--sw-fs-2xl);
        color: var(--dv-accent-text);
        margin-block-start: 2px;
      }
      .sentbox small {
        display: flex;
        gap: 5px;
        align-items: center;
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        font-weight: var(--sw-fw-medium);
        margin-block-start: 3px;
      }
      .valbox {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-danger-soft);
        border: 1px solid color-mix(in srgb, var(--dv-danger) 30%, transparent);
      }
      .valbox > b {
        font-size: var(--sw-fs-base);
        display: flex;
        gap: 8px;
        align-items: center;
        color: var(--dv-danger);
      }
      .valbox button {
        display: flex;
        gap: 6px;
        text-align: start;
        border: 0;
        background: transparent;
        min-block-size: 32px;
        font-size: var(--sw-fs-base);
        padding: 0;
        align-items: center;
      }
      .valbox button span {
        color: var(--dv-text-2);
        font-weight: var(--sw-fw-semibold);
      }
      /* ---- sections ---- */
      .bsec2 {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      /* R5-DEVICES-297 loop 2: the builder's כאשר / אם / אז are the sheet's headings (xl/800, heading ink) above their block wells */
      .bsec2 > h4 {
        display: flex;
        gap: 10px;
        align-items: center;
        margin: 4px 0 0;
        font-size: var(--sw-fs-xl);
        font-weight: 800;
        color: var(--sw-heading, var(--dv-text));
        letter-spacing: -0.015em;
      }
      .bsec2 > h4 small {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-medium);
        color: var(--dv-text-2);
      }
      .bsec2 > h4 .k {
        inline-size: 28px;
        block-size: 28px;
        border-radius: var(--sw-r-sm);
      }
      .bsec2 > h4 .k.when {
        background: var(--sw-warning);
      }
      .bsec2 > h4 .k.if {
        background: #8e8e93;
      }
      .bsec2 > h4 .k.then {
        background: var(--dv-accent);
      }
      .blist {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .slot {
        position: relative;
      }
      .slot.drag {
        opacity: 0.45;
      }
      .slot.drop-before::before,
      .blist.drop-end::after {
        content: '';
        display: block;
        block-size: 3px;
        border-radius: 2px;
        background: var(--dv-accent);
        margin-block: -5px 2px;
      }
      .slot.drop-before::before {
        position: absolute;
        inset-inline: 0;
        inset-block-start: -6px;
        margin: 0;
      }
      .addblk {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-block-size: 44px;
        border-radius: var(--dv-radius-sm, 14px);
        border: 1.5px dashed var(--dv-border-strong);
        background: transparent;
        color: var(--dv-accent-text);
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-base);
        inline-size: 100%;
      }
      .addblk:hover {
        background: var(--dv-accent-soft);
      }
      .addblk .ic {
        font-size: var(--sw-fs-lg);
      }
      .scrim {
        position: absolute;
        inset: 0;
        z-index: 70;
        background: transparent;
      }
      .scrim.soft {
        background: rgba(15, 23, 42, 0.18);
      }
      .typepop {
        position: absolute;
        z-index: 75;
        inset-inline: 16px;
        inset-block-start: 110px;
        max-block-size: calc(100% - 130px);
        overflow: auto;
        /* the step-type chooser is a menu: opaque, never see-through (owner 2026-10-13); the editor sheet around it keeps its glass */
        background: var(--sw-menu-surface);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        border: 1px solid var(--sw-menu-border);
        border-radius: var(--sw-r-2xl);
        box-shadow: var(--dv-shadow-3);
        padding: 10px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        animation: pop 180ms var(--ab-ease);
      }
      .typepop .hd {
        grid-column: 1 / -1;
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        font-weight: var(--sw-fw-semibold);
        padding: 4px 10px 0;
      }
      .typepop button {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        background: transparent;
        border-radius: var(--sw-r-lg);
        padding: 8px 10px;
        text-align: start;
        font-size: var(--sw-fs-base);
        font-weight: var(--sw-fw-semibold);
        min-block-size: 50px;
        color: var(--dv-text);
      }
      .typepop button:hover {
        background: var(--dv-surface-3);
      }
      .typepop button .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      .typepop button.sensb .rg {
        background: var(--ab-sens-bg);
        color: var(--ab-sens-fg);
      }
      .typepop button small {
        display: block;
        font-size: var(--sw-fs-xs);
        color: var(--dv-text-2);
        font-weight: var(--sw-fw-medium);
      }
      .pickpop {
        position: absolute;
        z-index: 75;
        inset-inline: 16px;
        inset-block-start: 86px;
        max-block-size: min(560px, calc(100% - 110px));
        animation: pop 180ms var(--ab-ease);
      }
      /* OVERLAY-FADE-2520: the type and picker pop-overs open by transform only (full contrast from the first frame) */
      @keyframes pop {
        from {
          transform: translateY(-6px) scale(0.985);
        }
      }
      .state-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 10px;
        padding: 56px 24px;
        color: var(--dv-text-2);
      }
      .state-box b {
        font-size: var(--sw-fs-xl);
        color: var(--dv-text);
      }
      .state-box.err b {
        color: var(--dv-danger);
      }
      .opts-wrap {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .runnote {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        padding-inline: 4px;
      }
      .dlg-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: var(--sw-fs-base);
        line-height: 1.5;
      }
      .dlg-body h5 {
        margin: 6px 0 0;
        font-size: var(--sw-fs-base);
      }
      .kvrow {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
        border-block-end: 1px solid var(--dv-border);
        font-size: var(--sw-fs-base);
      }
      .kvrow:last-child {
        border-block-end: 0;
      }
      .kvrow .bad {
        color: var(--dv-danger);
        font-weight: var(--sw-fw-semibold);
      }
      .kvrow .ok {
        color: var(--ab-ok-text);
        font-weight: var(--sw-fw-semibold);
      }
      .diff {
        display: grid;
        grid-template-columns: 70px 1fr 1fr;
        gap: 6px 10px;
        font-size: var(--sw-fs-sm);
      }
      .diff .h {
        font-weight: var(--sw-fw-bold);
        color: var(--dv-text-2);
      }
      .diff .c {
        padding: 6px 8px;
        border-radius: var(--sw-r-md);
        background: var(--dv-surface-3);
        line-height: 1.4;
      }
      .diff .c.mine {
        background: var(--dv-accent-soft);
      }
      .diff .g {
        font-weight: var(--sw-fw-bold);
        padding-block: 6px;
      }
      @media (max-width: 767px) {
        dialog.sheet {
          inset: auto 0 0 0;
          margin: 0;
          inline-size: auto;
          block-size: calc(100dvh - 20px);
          border-radius: var(--sw-r-lg) var(--sw-r-lg) 0 0;
          border-inline: 0;
          border-block-end: 0;
        }
        dialog.sheet[open] {
          animation: rup var(--sw-t-sheet) var(--sw-ease-drawer);
        }
        .grab {
          display: block;
        }
        header.shh {
          padding: 8px 14px 10px;
        }
        .shh .bk {
          inline-size: 44px;
          block-size: 44px;
        }
        .shh sw-tabs.top {
          display: none;
        }
        .shsub {
          display: block;
        }
        .shb {
          padding-inline: 14px;
        }
        footer.shf {
          padding: 10px 14px 14px;
        }
        footer.shf .sp {
          display: none;
        }
        footer.shf .btn,
        footer.shf .sugg {
          flex: 1 1 auto;
          min-block-size: 44px;
          justify-content: center;
        }
        footer.shf .btn.primary {
          flex: 1 1 100%;
          order: 20;
        }
        .typepop {
          inset-inline: 10px;
          grid-template-columns: 1fr;
          inset-block-start: 96px;
        }
        .pickpop {
          inset-inline: 10px;
          inset-block-start: 70px;
          max-block-size: calc(100% - 90px);
        }
        .diff {
          grid-template-columns: 56px 1fr 1fr;
        }
      }
    `]}get isNew(){return this.mode==="create"||!this.itemId}get dirty(){if(!this.draft||!this.env)return!1;if(this.view==="code"&&this.codeText!==this.codeBase)return!0;const{kind:t,draft:s,env:i,initial:a}=this,r=this.item?.config_id??null;return this.dirtyMemo.get([t,s,this.version,i,r,a],()=>Be(t,s,i.ctx,r)!==a)}get hardReadOnly(){if(!this.status)return!1;if(this.isNew)return!ga(this.kind,this.status);const t=this.item?.read_only?.reasons??[];return!!this.item&&(t.some(s=>!Us.has(s.code))||!this.item.can.edit&&!t.length)}get roText(){if(this.isNew)return n("אין הרשאת עריכה");const t=this.item?.read_only?.reasons.find(s=>!Us.has(s.code));return t?wa({read_only:{reasons:[t]}})?.text??n("צפייה בלבד"):n("צפייה בלבד")}get codeMode(){return!this.status||!this.codeToggle?"hidden":$a(this.status,this.isNew?null:this.item)}get freshPreview(){return this.preview&&this.previewVersion===this.version?this.preview:null}get issues(){if(!this.draft||!this.env)return[];const{kind:t,draft:s,env:i,serverIssues:a}=this,r=this.freshPreview?.errors;return this.issuesMemo.get([t,s,this.version,i,r,a],()=>{const l=ya(t,s,{shabbatSensor:i.catalog.shabbat_sensor,notifyTargets:i.notifyActions,...i.catalog.allowed_actions?{allowedActions:i.catalog.allowed_actions}:{}});return ur(l,r??[],a)})}get missingGrants(){return!this.draft||!this.env?[]:(this.preview?.sensitive_steps??xa(this.draft,s=>this.env.byId.get(s)?.class??null)).filter(s=>!s.granted)}get saveGate(){const t=this.status,s=this.env;return!t||!this.draft||!s?{code:"loading",text:be.loading}:ho({loaded:!0,hardReadOnly:this.hardReadOnly,roText:this.roText,busy:!!this.busy,blockerText:hs(this.kind,t)?.text??null,view:this.view,codeMode:this.codeMode,codeOk:this.codeOk,codeDirtyOrDraft:()=>this.codeDirtyOrDraft,issueCount:()=>this.issues.length,grantText:()=>{const i=this.missingGrants[0];return i?Es(i.action,s.ctx.names(i.entity_id)):null},previewText:()=>{const i=this.freshPreview,a=i?ms(i,t):null;return a&&a.code!=="invalid"?a.text:null},isNew:this.isNew,dirty:()=>this.dirty,warnMode:this.warnMode})}get codeDirtyOrDraft(){return this.isNew||this.codeText!==this.codeBase||this.dirty}sentenceOf(t){return this.freshPreview?.block_sentences[t.uid]??t.sentence}connectedCallback(){super.connectedCallback(),Zt(this,{...Fi,style:"glass",...this.scheme==="light"||this.scheme==="dark"||this.scheme==="auto"?{scheme:this.scheme}:{}}),ji().then(t=>{this.isConnected&&(Zt(this,{...t,style:"glass"}),this.scheme&&es(this,this.scheme))}),window.addEventListener("beforeunload",this.onBeforeUnload)}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.previewTimer),window.removeEventListener("beforeunload",this.onBeforeUnload),this.loadToken++}willUpdate(t){this.issuesMemo.clear(),this.issuesByMemo.clear(),this.dirtyMemo.clear(),this.pathsMemo.clear(),t.has("scheme")&&this.scheme&&es(this,this.scheme),t.has("open")&&!this.open&&window.clearTimeout(this.previewTimer),(t.has("itemId")||t.has("mode")||t.has("draft0")||t.has("open")&&this.open)&&this.open&&this.init(),this.env&&this.setAttribute("data-chip",this.env.sensitiveChip)}updated(t){t.has("open")?this.syncDialog():this.open&&this.sheet&&!this.sheet.open&&this.syncDialog()}syncDialog(){const t=this.sheet;if(t)if(this.open&&!t.open){try{t.showModal()}catch{t.setAttribute("open","")}t.focus({preventScroll:!0})}else!this.open&&t.open&&t.close()}async init(){const t=++this.loadToken;this.phase="loading",this.item=null,this.draft=null,this.preview=null,this.previewVersion=-1,this.previewFailed=!1,this.openUid=null,this.view="builder",this.dialog=null,this.conflict=null,this.saveError="",this.serverIssues=[],this.touched=!1,this.note="",this.pop=null,this.picker=null,this.templateName="",this.optionsOpen=!1,this.dryResult=null;try{if(await bi(),t!==this.loadToken)return;const s=ge(),[i,a,r]=await Promise.all([s.status(),s.catalog().catch(()=>An),this.isNew?Promise.resolve(null):s.get(this.kind,this.itemId)]);if(t!==this.loadToken)return;this.status=i,this.env=Rn(i,a),this.item=r;const l=U(r?r.draft:this.draft0??this.blankDraft());ke(l,this.env.ctx),this.draft=l,this.storedDraft=r?U(r.draft):null,this.initial=this.isNew&&this.draft0===null?Be(this.kind,l,this.env.ctx):Be(this.kind,l,this.env.ctx,r?.config_id??null),this.lockedFps=kt(l),this.stage=this.isNew&&this.draft0===null&&this.startsWithGallery&&i.ui.templates_enabled!==!1&&i.can.manage?"templates":"edit",this.draft0&&(this.touched=!0),this.phase="ready",this.version++,this.schedulePreview(0)}catch(s){if(t!==this.loadToken)return;this.loadError=Se(s);const i=j(s).status;this.loadDenied=i===403||i===404,this.phase="error"}}async notifyExternalChange(){if(this.isNew||!this.item||this.busy)return;const t=this.itemId,s=this.loadToken;try{const i=await ge().get(this.kind,t);if(s!==this.loadToken||this.itemId!==t||!this.item)return;i.revision!==this.item.revision&&(this.conflict=i)}catch{}}change(t){this.env&&(ke(t,this.env.ctx),this.draft=t,this.version++,this.touched=!0,this.saveError="",this.serverIssues=[],this.schedulePreview())}patchBlock(t,s){this.draft&&this.change(Hn(this.draft,t,s))}schedulePreview(t=400){window.clearTimeout(this.previewTimer),this.previewTimer=window.setTimeout(()=>void this.runPreview(),t)}async runPreview(){if(!this.draft||!this.open)return;const t=this.version;try{const s=await ge().preview({kind:this.kind,id:this.isNew?null:this.item?.id??null,draft:this.draft});if(t!==this.version)return;this.preview=s,this.previewVersion=t,this.previewFailed=!1}catch{t===this.version&&(this.previewFailed=!0,this.previewVersion=t)}}closeSelf(){this.open=!1}emit(t,s){this.dispatchEvent(new CustomEvent(t,{detail:s,bubbles:!0,composed:!0}))}requestCancel(){if(!this.busy){if(this.dirty&&!this.hardReadOnly){this.dialog="discard";return}this.cancel()}}cancel(){this.dialog=null,this.emit("cancel",{}),this.closeSelf()}async save(t=!1,s=!1){if(!this.draft||!this.env||!this.status)return;const i=t?null:this.saveGate;if(!(i&&!(s&&qs(i,this.warnMode)))){if(!t&&this.view==="builder"&&(this.freshPreview?.requires.confirm??ka(this.draft))){this.dialog="confirm-save";return}this.busy="save",this.saveError="",this.dialog=null;try{const a=await this.write(t);this.afterWrite(a)}catch(a){this.onSaveError(a)}this.busy=""}}async write(t){const s=this.env;let i=this.draft,a=null;if(this.view==="code"){const p=We(this.codeText);if(!p.ok||typeof p.value!="object"||p.value===null||Array.isArray(p.value))throw new Error("code");a=p.value,i=vs(this.kind,a,s.ctx).draft}const r=Cs(this.isNew,i,this.storedDraft),l=this.item?.revision??null;if(r==="create")return pi(this.kind,i,{enabled:!0,confirm:t});if(r==="replace")return ui(this.kind,this.itemId,i,l,{confirm:t});const d=a??Pt(this.kind,i,_t(this.item),s.ctx,{id:this.item?.config_id??null});if(!_t(this.item)&&(this.item?.extras.length??0)>0)throw Object.assign(new Error("extras"),{extras:!0});return _a(this.kind,this.itemId,d,l,{confirm:t})}afterWrite(t){const s=this.isNew,i=t.item??null;this.emit("saved",{kind:this.kind,id:i?.id??this.itemId,item:i,created:s,status:t.status==="not_loaded"?"not_loaded":"ok"}),t.status==="not_loaded"&&(this.note=n("נשמר, אך עדיין לא נטען במערכת")),this.initial=this.env?Be(this.kind,this.draft,this.env.ctx,i?.config_id??this.item?.config_id??null):this.initial,this.touched=!1,this.codeBase=this.codeText,this.closeSelf()}onSaveError(t){if(t.extras){this.saveError=n("לפריט יש הגדרות נוספות שאינן מוצגות כאן; עריכת חלק נעול תתאפשר כשהקוד המלא יוצג");return}if(t instanceof Error&&t.message==="code"){this.saveError=n("הקוד אינו תקין");return}const s=j(t);if(s.kind==="conflict"){const i=fs(t);if(i){this.conflict=i;return}}if(s.kind==="confirm"){this.dialog="confirm-save";return}if(s.kind==="validation"&&s.issues.length){this.serverIssues=s.issues,this.touched=!0,this.saveError=s.message;return}this.saveError=s.message}reloadTheirs(){const t=this.conflict;if(!t||!this.env)return;this.item=t;const s=U(t.draft);ke(s,this.env.ctx),this.draft=s,this.storedDraft=U(t.draft),this.initial=Be(this.kind,s,this.env.ctx,t.config_id),this.lockedFps=kt(s),this.conflict=null,this.touched=!1,this.openUid=null,this.view="builder",this.version++,this.schedulePreview(0)}rebaseOn(t){this.item={...t,draft:this.item?.draft??t.draft},this.storedDraft=U(t.draft)}keepMine(){const t=this.conflict;t&&(this.rebaseOn(t),this.conflict=null,this.save())}async runNow(t=!1,s=!0){if(!(!this.item||this.kind==="scene")){if(!t&&Nt(this.item)){this.dialog="run";return}this.busy="run",this.note="",this.dialog=null;try{if(this.kind==="script"){const i=this.item.draft.fields;await hi(this.item.id,Object.fromEntries(i.filter(a=>a.default!==void 0).map(a=>[a.key,a.default])),{confirm:t}),this.note=n("הופעל")}else await za(this.item.id,{skip_condition:s,confirm:t}),this.note=s?n("הופעלה"):n("נבדקה והופעלה");this.emit("item-changed",{kind:this.kind,id:this.item.id})}catch(i){const a=j(i);a.kind==="confirm"?this.dialog="run":this.note=a.message}this.busy=""}}async dryRun(){if(this.draft){this.busy="dry",this.note="";try{this.dryResult=await this.computeDry(this.draft),this.dialog="dry"}catch(t){this.note=Se(t)}this.busy=""}}async computeDry(t){const s=!this.isNew&&!this.dirty&&this.item;if(s)return ge().dryRun(this.kind,s.id);const i=await ge().preview({kind:this.kind,id:this.isNew?null:this.item?.id??null,draft:t});return{conditions:("conditions"in t?t.conditions:[]).map(a=>({sentence:a.sentence,passed:null})),effects:i.effects}}async toggleEnabled(t,s=!1){if(this.item){if(t&&!s&&this.item.unknown_effects){this.dialog="enable";return}this.busy="toggle",this.dialog=null;try{const i=await vi(this.item.id,t,{confirm:s});this.item={...this.item,state:i.item.state},this.emit("item-changed",{kind:this.kind,id:this.item.id})}catch(i){this.note=Se(i)}this.busy=""}}async deleteNow(){if(this.item){this.busy="delete",this.dialog=null;try{const t=await fi(this.kind,this.item.id,this.item.revision);this.emit("deleted",{kind:this.kind,id:this.item.id,trash_id:t.trash_id,expires_at:t.expires_at}),this.closeSelf()}catch(t){const s=j(t),i=fs(t);s.kind==="conflict"&&i?this.conflict=i:this.saveError=s.message}this.busy=""}}setView(t){if(t===this.view||!this.draft||!this.env)return;if(t==="code"){const a=Pt(this.kind,this.draft,_t(this.item),this.env.ctx,{id:this.item?.config_id??null});this.codeText=JSON.stringify(a,null,2),this.codeBase=this.codeText,this.codeOk=!0,this.view="code",this.pop=null,this.picker=null;return}const s=Sa(this.kind,this.codeText,this.env.ctx);if(!s.ok)return;const i=ke(s.draft,this.env.ctx);this.draft=i,this.lockedFps=kt(i),this.view="builder",this.openUid=null,this.version++,this.touched=!0,this.schedulePreview(0)}chipsOf(t,s){const i=this.env,a=[];if(t.kind==="locked"){a.push({tone:"lock",text:n("נעול"),icon:"lock",title:n("נשמר כמו שהוא")},{tone:"why",text:fo[t.reason]??n("לא מוכר"),title:t.label}),t.reason==="template"&&a.push({tone:"code",text:"{{ }}"}),t.sensitive&&i.sensitiveWarning&&a.push({tone:"sens",text:n("פעולה רגישה"),icon:"alarm"}),di(t)&&a.push({tone:"warn",text:n("שולט בתזמונים"),icon:"calendar"}),t.masked&&a.push({tone:"bad",text:n("ערך חסוי")});const d=typeof t.raw?.id=="string"&&s==="trigger"?String(t.raw.id):null;return d&&a.push({tone:"code",text:`id: ${d}`}),a}const r=t;s==="trigger"&&r.type==="button"&&a.push({tone:"acc",text:t.raw?n("היה נעול · ניתן לעריכה"):n("ניתן לעריכה"),icon:"button"}),s==="trigger"&&r.id&&a.push({tone:"code",text:`id: ${r.id}`});for(const d of this.blockWarnings(t))a.push(d);return s==="action"&&i.sensitiveWarning&&Oa(t,d=>i.byId.get(d)?.class??null)&&a.push({tone:"sens",text:n("פעולה רגישה"),icon:"alarm"}),(t.entity_ids??[]).some(d=>i.byId.get(d)?.missing)&&a.push({tone:"bad",text:n("מכשיר חסר"),icon:"warning"}),a}blockWarnings(t){if(!this.draft||this.kind!=="automation")return[];const s=bt(this.freshPreview);if(!s.length)return[];const i=this.draft,a=this.pathsMemo.get([i,this.version],()=>{const r=new Map;for(const l of pe(i))r.has(l.block.uid)||r.set(l.block.uid,l.path);return r}).get(t.uid);return a?s.filter(r=>r.path===a).map(r=>({tone:"warn",icon:"warning",text:r.code==="conflict"?`${n("התנגשות")}${typeof r.delta_min=="number"?` · ${n("{n} דק׳",{n:r.delta_min})}`:""}`:r.code==="button_in_use"?n("בשימוש"):n("התקן לא זמין")})):[]}get ext(){return It(this.status?.ui??null)}get warnMode(){return this.kind==="automation"&&this.view==="builder"?ca(bt(this.freshPreview),this.ext):"save"}get deviceTestOn(){return this.kind==="automation"&&this.ext.device_test&&!this.isNew&&!!this.item?.can.edit&&!!this.item?.can.run}formCtx(t,s,i){const a=this.env,r=this.draft,l="triggers"in r?r.triggers.map(d=>d.kind==="typed"?d.id??null:typeof d.raw?.id=="string"?String(d.raw.id):null).filter(d=>!!d):[];return{env:a,kind:this.kind,block:t,section:s,issues:i,triggerIds:l,canCode:this.codeMode==="editable",itemId:this.isNew?null:this.item?.id??null,ext:{critical:this.preview?.extension?.critical},patch:d=>this.patchBlock(t.uid,d),pick:d=>{this.picker=d,this.pop=null},nested:(d,p,u)=>this.renderList(d,p,u),child:(d,p)=>this.formCtx(d,p,this.issuesBy[d.uid]??[]),gotoCode:this.gotoCode,editTemplate:this.editTemplate}}get issuesBy(){const t=this.draft;if(!t)return{};const s=this.issues;return this.issuesByMemo.get([t,s],()=>Ea(t,s))}renderCard(t,s,i,a){const r=this.openUid===t.uid,l=r||!!this.openUid&&nt(t).has(this.openUid),d=a[t.uid]??[],p=this.dropAt&&this.dropAt.owner===i.owner&&this.dropAt.name===i.name&&this.dropAt.index===i.index;return o`<div class="slot ${this.dragUid===t.uid?"drag":""} ${p?"drop-before":""}" data-uid=${t.uid} data-block-slot>
      <sw-block-card .uid=${t.uid} .icon=${sr(t,s)} .heading=${this.sentenceOf(t)} .chips=${this.chipsOf(t,s)} .open=${l} .locked=${t.kind==="locked"} .invalid=${d.length>0}
        .nested=${i.owner!==te} .readonly=${this.hardReadOnly} .canUp=${i.index>0} .canDown=${i.index<i.count-1}
        @card-toggle=${()=>{this.hardReadOnly&&t.kind==="typed"||(this.openUid=r?null:t.uid)}}
        @card-remove=${()=>{this.draft&&(this.change(jn(this.draft,t.uid)),this.openUid===t.uid&&(this.openUid=null))}}
        @card-move=${u=>this.moveCard(t.uid,u.detail.delta,u.detail.from)}
        @card-duplicate=${()=>{this.draft&&this.change(Wn(this.draft,t.uid))}}
        @card-dragstart=${()=>{this.dragUid=t.uid}}>
        ${l?o`<fieldset class="bf" ?disabled=${this.hardReadOnly} style="border:0;padding:0;margin:0;min-inline-size:0">${Ei(this.formCtx(t,s,d))}</fieldset>`:c}
      </sw-block-card>
    </div>`}renderList(t,s,i){const a=this.draft,r=$i(a,t,s)??[],l=this.issuesBy,d=this.dropAt&&this.dropAt.owner===t&&this.dropAt.name===s&&this.dropAt.index>=r.length;return o`<div class="blist ${d?"drop-end":""}" data-list=${`${t}|${s}`} @dragover=${p=>this.onDragOver(p,t,s)} @drop=${p=>this.onDrop(p,t,s)} @dragleave=${p=>this.onDragLeave(p)}>
      ${it(r,p=>p.uid,(p,u)=>this.renderCard(p,i,{owner:t,name:s,index:u,count:r.length},l))}
      ${this.hardReadOnly||yr(a,i,r.length)?c:o`<button class="addblk" type="button" data-add=${i} data-add-list=${`${t}|${s}`} @click=${()=>{this.pop={section:i,owner:t,name:s},this.picker=null}}>${f("plus")}${n("הוסף")}</button>`}
    </div>`}moveCard(t,s,i){!this.draft||!Un(this.draft,t,s)||(this.change(qn(this.draft,t,s)),this.updateComplete.then(()=>{const a=this.renderRoot.querySelector(`[data-uid="${t}"] > sw-block-card`),r=i==="button"?s<0?"[data-block-up]":"[data-block-down]":"[data-block-main]";let l=a?.shadowRoot?.querySelector(r);l&&l.disabled&&(l=a?.shadowRoot?.querySelector(s<0?"[data-block-down]":"[data-block-up]")),(l??a?.shadowRoot?.querySelector("[data-block-main]"))?.focus({preventScroll:!0})}))}onDragOver(t,s,i){if(!this.dragUid||!this.draft)return;const a=Ie(this.draft,this.dragUid),r=Ke(this.draft).find(p=>p.owner===s&&p.name===i);if(!a||!r||r.section!==a.section)return;t.preventDefault(),t.stopPropagation(),t.dataTransfer&&(t.dataTransfer.dropEffect="move");const l=[...t.currentTarget.querySelectorAll(":scope > .slot")];let d=l.length;for(let p=0;p<l.length;p++){const u=l[p].getBoundingClientRect();if(t.clientY<u.top+u.height/2){d=p;break}}(!this.dropAt||this.dropAt.owner!==s||this.dropAt.name!==i||this.dropAt.index!==d)&&(this.dropAt={owner:s,name:i,index:d})}onDragLeave(t){const s=t.relatedTarget;(!s||!t.currentTarget.contains(s))&&(this.dropAt=null)}onDrop(t,s,i){if(!this.dragUid||!this.draft)return;t.preventDefault(),t.stopPropagation();const a=this.dropAt&&this.dropAt.owner===s&&this.dropAt.name===i?this.dropAt.index:0,r=Vn(this.draft,this.dragUid,s,i,a);this.dragUid=null,this.dropAt=null,r&&this.change(r)}chooseType(t){const s=this.pop;if(!s||!this.draft||!this.env)return;const i=Qn(s.section,t,this.env);this.pop=null,i&&(this.change(Fn(this.draft,s.owner,s.name,i)),this.openUid=i.uid,this.updateComplete.then(()=>this.scrollToBlock(i.uid)))}scrollToBlock(t){this.renderRoot.querySelector(`[data-uid="${t}"]`)?.scrollIntoView({block:"center",behavior:"smooth"})}goto(t){if(!this.draft)return;const s=pe(this.draft).filter(i=>t===i.path||t.startsWith(`${i.path}.`)).sort((i,a)=>a.path.length-i.path.length)[0];s&&(this.openUid=s.block.uid,this.updateComplete.then(()=>this.scrollToBlock(s.block.uid)))}renderTypePop(){const t=this.pop;if(!t||!this.env||!this.draft)return c;const s=t.owner===te?null:pe(this.draft).find(r=>r.block.uid===t.owner)?.block,i=!!s&&["and","or","not"].includes(s.type??""),a=yi[t.section].filter(r=>(!r.available||r.available(this.env,this.draft))&&!(t.section==="condition"&&i&&["and","or","not"].includes(r.id)));return o`<div class="scrim" data-scrim @click=${()=>this.pop=null}></div>
      <div class="typepop" role="menu" data-typepop>
        <div class="hd">${Xn[t.section]}</div>
        ${a.map(r=>o`<button type="button" role="menuitem" class=${r.sensitive?"sensb":""} data-type=${r.id} @click=${()=>this.chooseType(r.id)}><span class="rg">${f(r.icon)}</span><span><span>${r.label}</span><small>${r.hint}</small></span></button>`)}
      </div>`}renderPicker(){const t=this.picker;return!t||!this.env?c:o`<div class="scrim" data-scrim @click=${()=>this.picker=null}></div>
      <automation-entity-picker class="pickpop" .env=${this.env} .filter=${t.filter} .where=${t.where??null} .selected=${t.selected} .multi=${t.multi??!0}
        @picker-change=${s=>{t.apply(s.detail.ids),this.picker={...t,selected:s.detail.ids}}}
        @picker-done=${()=>this.picker=null}></automation-entity-picker>`}banners(){const t=[],s=this.status;if(!s||!this.env)return t;this.hardReadOnly&&t.push({id:"readonly",tone:"info",icon:"eye",title:this.roText});const i=this.hardReadOnly?null:hs(this.kind,s);i&&i.code==="delegation_off"?t.push({id:"delegation",tone:"warn",icon:"info",title:n("שמירה דורשת מנהל")}):i&&i.code!=="no_permission"&&t.push({id:"blocked",tone:"warn",icon:"info",title:i.text});const a=this.missingGrants[0];a&&!this.hardReadOnly&&t.push({id:"grant",tone:"warn",icon:"alarm",title:Es(a.action,this.env.ctx.names(a.entity_id))});const r=this.freshPreview;if(r&&!this.hardReadOnly&&!i){const l=ms(r,s);l&&l.code!=="invalid"&&t.push({id:l.code,tone:"warn",icon:"lock",title:l.text})}return this.saveError&&t.push({id:"error",tone:"bad",icon:"warning",title:this.saveError}),t}renderBanners(){return this.banners().map(t=>o`<div class="banner ${t.tone}" role=${t.tone==="bad"?"alert":"status"} data-banner=${t.id}>${f(t.icon)}<div class="t"><b>${t.title}</b>${t.sub?o`<small>${t.sub}</small>`:c}</div></div>`)}renderConflict(){return this.conflict?o`<div class="banner" role="alert" data-banner="conflict">${f("warning")}<div class="t"><b>${n("הפריט שונה במקום אחר לפני רגע")}</b><small>${n("נשמרה גרסה חדשה. מה לעשות עם השינויים שלך?")}</small>
      <div class="acts">
        <button class="btn sm" type="button" data-conflict="reload" @click=${()=>this.reloadTheirs()}>${f("history")}${n("טען את החדש")}</button>
        ${this.kind==="automation"?o`<button class="btn sm" type="button" data-conflict="merge" @click=${()=>this.dialog="merge"}>${f("branch")}${n("השוואה ומיזוג")}</button>`:o`<button class="btn sm" type="button" data-conflict="compare" @click=${()=>this.dialog="compare"}>${f("copy")}${n("השווה")}</button>`}
        <button class="btn sm primary" type="button" data-conflict="mine" @click=${()=>this.keepMine()}>${n("שמור את שלי")}</button>
      </div></div></div>`:c}renderSentence(){if(!this.draft||!this.env)return c;const t=this.freshPreview?.sentence??Da(this.kind,this.draft,this.env.ctx),s=this.preview?.sensitive_steps.length??0;return o`<div class="sentbox" data-sentence>${f("bolt")}<div>${t}${s&&this.env.sensitiveWarning?o`<small>${f("alarm",12)}${s===1?n("כולל פעולה רגישה אחת – נבדקות כמו שליטה ידנית"):n("כולל {n} פעולות רגישות – נבדקות כמו שליטה ידנית",{n:s})}</small>`:c}</div></div>`}renderWarnings(){if(!this.draft||this.kind!=="automation"||!this.ext.precheck)return c;const t=bt(this.freshPreview);if(!t.length)return c;const s=this.issues.length,i=a=>{const r=a.other;if(!r){this.goto(a.path);return}r.kind==="schedule"?X(`/devices/schedules/${encodeURIComponent(r.id)}/edit`):X(`/devices/automations/${encodeURIComponent(r.id)}`)};return o`<div class="vbox" role="status" data-warnings><b>${f("warning")}${pa(t.length)}<small>· ${s?n("יש גם דברים לתקן."):this.ext.save_with_warnings?n("אין שגיאות. אפשר לשמור עם אזהרות."):n("אין שגיאות. יש לטפל באזהרות לפני השמירה.")}</small></b>
      ${t.map(a=>o`<div class="iss" data-warning=${a.code}><div><b>${a.message}</b>${a.detail?o`<span class="s">${a.detail}</span>`:c}</div>
        ${a.code==="conflict"&&a.other?o`<button class="btn sm" type="button" data-warning-open @click=${()=>i(a)}>${a.other.kind==="schedule"?n("פתיחת התזמון"):n("פתיחת האוטומציה")}</button>`:o`<button class="btn sm quiet" type="button" data-warning-goto @click=${()=>this.goto(a.path)}>${n("מעבר לצעד")}</button>`}</div>`)}</div>`}renderValidation(){if(!this.draft)return c;const t=this.renderWarnings();if(!this.touched)return t;const s=this.issues;return s.length?o`<div class="valbox" role="alert" data-validation><b>${f("warning")}${s.length===1?n("דבר אחד לתקן"):n("{n} דברים לתקן",{n:s.length})}</b>
      ${s.map(i=>{const a=pr(i);return o`<button type="button" data-goto=${i.path} @click=${()=>this.goto(i.path)}><span>${a.where} ·</span> ${a.what}</button>`})}</div>${t}`:t}renderCodeView(){if(!this.draft)return c;const t=this.status?Ca(this.status):{state:"not_needed"},s=We(this.codeText);let i=!1;if(s.ok&&typeof s.value=="object"&&s.value!==null&&!Array.isArray(s.value)&&this.env){const a=vs(this.kind,s.value,this.env.ctx).draft;i=Cs(this.isNew,a,this.storedDraft)==="code"}return o`<automation-code .value=${this.codeText} .locked=${this.lockedFps} ?readonly=${this.codeMode==="readonly"} @code-input=${this.onCode}>
      <span slot="chips" class="tag ${i&&t.state!=="not_needed"?"warn":"ok"}">${i&&t.state!=="not_needed"?n("שמירת תוכן שאינו מהבונה – מנהל בלבד"):n("מנהל · הכל ניתן לשמירה")}</span>
      <span slot="note">${f("info")} ${n("שינוי כאן מתורגם לבלוקים; מה שהבונה לא מכיר נשאר נעול.")}</span>
    </automation-code>`}renderHeader(){const t=this.draft,s=t?String(("alias"in t?t.alias:t.name)??""):"",i=this.draft&&this.env?hr(this.item,this.draft,this.env):{floors:"",areas:"",more:0},a=this.isNew?this.templateName?n('מתבנית "{name}"',{name:this.templateName}):this.subtitleNew():null,r=this.codeMode,l=[{id:"builder",label:n("בונה"),glyph:f("blocks"),attrs:{"data-view":"builder"}},{id:"code",label:n("קוד"),glyph:f("code"),attrs:{"data-view":"code"}}],d=(m,g)=>o`<sw-tabs controlled variant="pill" class=${m} fill=${g?"always":c} group-label=${n("תצוגה")} data-view-toggle .items=${l} .active=${this.view}
      @change=${x=>{x.stopPropagation(),this.setView(x.detail.id)}}></sw-tabs>`,p=this.item?this.item.state!=="off":!0,u=this.kind==="automation"&&!this.isNew&&this.item?.can.toggle&&!this.hardReadOnly?o`<sw-toggle class="tgl" controlled labelHidden label=${n("פעילה")} .checked=${p} ?disabled=${this.busy!==""} data-enable-toggle @change=${m=>void this.toggleEnabled(m.detail.checked)}></sw-toggle>`:c;return o`<div class="grab" aria-hidden="true"></div>
      <header class="shh">
        <button class="bk" type="button" aria-label=${n("סגירה")} data-editor-close @click=${()=>this.requestCancel()}>${f("chevron")}</button>
        <div class="tx">
          <input class="namein" data-name-input aria-label=${this.nameLabel} placeholder=${this.nameLabel} .value=${s} ?disabled=${this.hardReadOnly} @input=${m=>this.setName(m.target.value)} />
          <small>${a??o`${i.floors?o`${f("layers",13)}<span>${i.floors}</span>`:c}${i.areas?o`<span>${i.areas}${i.more?` ${i.more}+`:""}</span>`:c}`}</small>
        </div>
        ${r!=="hidden"?d("top",!1):c}${u}
      </header>
      ${r!=="hidden"?o`<div class="shsub">${d("sub",!0)}</div>`:c}`}setName(t){if(!this.draft)return;const s=U(this.draft);"alias"in s?s.alias=t:s.name=t,this.change(s)}renderFooter(){const t=this.saveGate,s=this.kind==="automation"&&this.view==="builder"&&this.status?.scheduler_present&&this.draft?this.suggestion():null;return o`<footer class="shf">
      ${this.kind==="automation"&&this.view==="builder"?o`<button class="btn" type="button" data-dry-run ?disabled=${!!this.busy||this.phase!=="ready"} @click=${()=>this.deviceTestOn?this.openDeviceTest():void this.dryRun()}>${f("flask")}${n("בדיקה")}</button>`:c}
      ${!this.isNew&&this.kind!=="scene"&&this.item?.can.run?o`<button class="btn" type="button" data-run-now ?disabled=${!!this.busy} @click=${()=>void this.runNow()}>${f("play")}${n("הרץ עכשיו")}</button>`:c}
      ${this.footerExtras()}
      ${s?o`<button class="sugg" type="button" data-suggest-schedule @click=${()=>{this.suggestDraft=s.schedule_draft,this.dialog="suggest"}}>${f("calendar")}${n("צור כתזמון")}</button>`:c}
      <span class="sp"></span>
      <button class="btn quiet" type="button" data-editor-cancel @click=${()=>this.requestCancel()}>${n("ביטול")}</button>
      ${qs(t,this.warnMode)?o`<button class="btn warn" type="button" data-editor-save-warnings ?disabled=${!!this.busy} @click=${()=>void this.save(!1,!0)}>${f("warning")}${this.busy==="save"?n("שומר…"):n("שמירה עם אזהרות")}</button>`:c}
      <button class="btn primary" type="button" data-editor-save title=${t?.text??""} ?disabled=${!!t} @click=${()=>void this.save()}>${f("check")}${this.busy==="save"?n("שומר…"):n("שמירה")}</button>
    </footer>${this.note?o`<div class="runnote" role="status" data-note>${this.note}</div>`:c}`}suggestion(){const t=this.freshPreview?.suggest_schedule??null;return t||(!this.draft||!this.env||this.freshPreview?null:Ta(this.draft,{schedulerPresent:!0,shabbatSensor:this.env.catalog.shabbat_sensor,classOf:s=>this.env.byId.get(s)?.class??null}))}renderOptionsBox(t=c){const s=this.draft;return!s||s.mode===void 0?c:o`<details class="opts" ?open=${this.optionsOpen} @toggle=${i=>this.optionsOpen=i.target.open} data-options>
      <summary>${f("chevronDown")}${n("אפשרויות")} · ${tr[s.mode]??""}</summary>
      <div class="opts-wrap" ?inert=${this.hardReadOnly}>
        <div class="frow">
          <div class="fld"><label>${n("אם מופעלת שוב בזמן ריצה")}</label><select class="selx" data-fld="mode" aria-label=${n("מצב")} @change=${i=>this.setField("mode",i.target.value)}>
            ${["single","restart","queued","parallel"].map(i=>o`<option value=${i} ?selected=${s.mode===i}>${je[i]}</option>`)}</select></div>
          ${s.mode==="queued"||s.mode==="parallel"?o`<div class="fld sm"><label>${n("מקסימום")}</label><label class="inp"><input class="n" data-fld="max" type="text" inputmode="numeric" aria-label=${n("מקסימום")} .value=${s.max==null?"":String(s.max)} @change=${i=>{const a=parseInt(i.target.value,10);this.setField("max",Number.isFinite(a)&&a>0?a:null)}} /></label></div>`:c}
        </div>
        <div class="fld full"><label>${n("תיאור")}</label><label class="inp"><input data-fld="description" aria-label=${n("תיאור")} placeholder=${n("לא חובה")} .value=${s.description??""} @input=${i=>this.setField("description",i.target.value)} /></label></div>
        ${t}
      </div>
    </details>`}setField(t,s){if(!this.draft)return;const i=U(this.draft);i[t]=s,this.change(i)}renderDeleteRow(){return this.isNew||!this.item?.can.delete||this.hardReadOnly?c:o`<div class="frow"><button class="btn sm danger" type="button" data-editor-delete @click=${()=>this.dialog="delete"}>${f("trash")}${n("מחיקה")}</button></div>`}renderDialogs(){const t=this.dialog,s=this.item?.name||this.draft?.alias||"",i=this.dialogClosed;return o`
      <sw-dialog heading=${n("לצאת בלי לשמור?")} ?open=${t==="discard"} @close=${i}>
        <div class="dlg-body">${n("השינויים שעשיתם לא יישמרו.")}</div>
        ${de(o`<button class="btn" type="button" data-discard="keep" @click=${()=>this.dialog=null}>${n("המשך עריכה")}</button><button class="btn danger" type="button" data-discard="leave" @click=${()=>this.cancel()}>${n("צא בלי לשמור")}</button>`)}
      </sw-dialog>
      <sw-dialog heading=${n("לשמור?")} ?open=${t==="confirm-save"} @close=${i}>
        <div class="dlg-body">${s?n('כולל פעולה מתקדמת שהמערכת לא יודעת לתאר – "{name}" עלול לשנות מכשירים נוספים.',{name:s}):n("כולל פעולה מתקדמת שהמערכת לא יודעת לתאר – הפריט עלול לשנות מכשירים נוספים.")}</div>
        ${de(o`<button class="btn" type="button" @click=${()=>this.dialog=null}>${n("ביטול")}</button><button class="btn primary" type="button" data-confirm-save @click=${()=>void this.save(!0)}>${n("שמירה")}</button>`)}
      </sw-dialog>
      <sw-dialog heading=${n("להריץ עכשיו?")} ?open=${t==="run"} @close=${i}>
        <div class="dlg-body" data-run-confirm>${this.item?.sensitive?n("כולל פעולה רגישה – נבדקת כמו שליטה ידנית."):n("כולל פעולה מתקדמת שהמערכת לא יודעת לתאר.")}${this.dirty?` ${n("ההרצה תתבצע על הגרסה השמורה.")}`:""}</div>
        ${de(o`<button class="btn" type="button" @click=${()=>this.dialog=null}>${n("ביטול")}</button><button class="btn primary" type="button" data-run-confirm-ok @click=${()=>void this.runNow(!0)}>${n("הרץ")}</button>`)}
      </sw-dialog>
      <sw-dialog heading=${n("להפעיל?")} ?open=${t==="enable"} @close=${i}>
        <div class="dlg-body">${n("כולל פעולה מתקדמת שהמערכת לא יודעת לתאר.")}</div>
        ${de(o`<button class="btn" type="button" @click=${()=>this.dialog=null}>${n("ביטול")}</button><button class="btn primary" type="button" @click=${()=>void this.toggleEnabled(!0,!0)}>${n("הפעל")}</button>`)}
      </sw-dialog>
      <sw-dialog heading=${n("למחוק?")} ?open=${t==="delete"} @close=${i}>
        <div class="dlg-body">${s?n('"{name}" יועבר לסל המחזור, ואפשר לשחזר אותו משם.',{name:s}):n("הפריט יועבר לסל המחזור, ואפשר לשחזר אותו משם.")}</div>
        ${de(o`<button class="btn" type="button" @click=${()=>this.dialog=null}>${n("ביטול")}</button><button class="btn danger" type="button" data-delete-confirm @click=${()=>void this.deleteNow()}>${n("מחיקה")}</button>`)}
      </sw-dialog>
      <sw-dialog heading=${n("בדיקה · בלי להפעיל כלום")} ?open=${t==="dry"} @close=${i}>
        ${this.dryResult?o`<div class="dlg-body" data-dry-result>
          ${this.dryResult.conditions.length?o`<h5>${n("תנאים עכשיו")}</h5>${this.dryResult.conditions.map(a=>o`<div class="kvrow"><span>${a.sentence}</span>${a.passed===null?o`<span>${n("לא ניתן לבדוק")}</span>`:a.passed?o`<span class="ok">${n("מתקיים")}</span>`:o`<span class="bad">${n("לא מתקיים")}</span>`}</div>`)}`:c}
          <h5>${n("מה יקרה")}</h5>
          ${this.dryResult.effects.entities.length?this.dryResult.effects.entities.map(a=>o`<div class="kvrow"><span>${a.name}</span><span>${a.from?`${a.from} → `:""}${a.to??""}</span></div>`):o`<div class="kvrow"><span>${n("לא ידוע אילו מכשירים ישתנו")}</span></div>`}
          ${this.dryResult.effects.unknown?o`<div class="kvrow"><span>${n("כולל פעולה מתקדמת")}</span></div>`:c}
        </div>`:c}
        ${de(o`${!this.isNew&&this.kind==="automation"&&this.item?.can.run?o`<button class="btn" type="button" data-dry-run-then @click=${()=>{this.dialog=null,this.runNow(!(this.item&&Nt(this.item)),!1)}}>${f("play")}${n("בדוק תנאים ואז הרץ")}</button>`:c}
          <button class="btn primary" type="button" data-dry-close @click=${()=>this.dialog=null}>${n("סגירה")}</button>`)}
      </sw-dialog>
      <sw-dialog heading=${n("בדיקה")} ?open=${t==="devtest"} @close=${i}>${t==="devtest"?o`<kav-device-test .itemId=${this.item?.id??null} .draft=${this.dirty?this.draft:null} .dry=${this.dryResult} .flags=${this.ext}
        @need-dry=${()=>void this.loadDry()} @test-close=${()=>{this.dialog=null,this.emit("item-changed",{kind:this.kind,id:this.item?.id})}}></kav-device-test>`:c}</sw-dialog>
      <sw-dialog heading=${`${n("השוואה ומיזוג")}${s?` · ${s}`:""}`} ?open=${t==="merge"} @close=${i}>${t==="merge"&&this.conflict&&this.draft&&this.storedDraft&&this.env?o`<kav-merge
        .base=${this.storedDraft} .mine=${this.draft} .theirs=${this.conflict.draft} .ctx=${this.env.ctx} theirsLabel=${this.theirsLabel()}
        @merge-cancel=${()=>this.dialog=null} @merge-save=${a=>this.saveMerged(a.detail.draft)}></kav-merge>`:c}</sw-dialog>
      <sw-dialog heading=${n("השוואה")} subheading=${n("שלי מול הגרסה החדשה")} ?open=${t==="compare"} @close=${i}>${this.renderCompare()}
        ${de(o`<button class="btn" type="button" @click=${()=>this.dialog=null}>${n("סגירה")}</button>`)}
      </sw-dialog>
      <sw-dialog heading=${n("ליצור כתזמון?")} ?open=${t==="suggest"} @close=${i}>
        <div class="dlg-body" data-suggest-body>${n('"{name}" היא שעון + שליטה במכשירים – בתזמונים זה פשוט יותר. חלון התזמון ייפתח עם הנתונים שכבר הזנתם.',{name:s||n("האוטומציה")})}</div>
        ${de(o`<button class="btn" type="button" data-suggest-no @click=${()=>this.dialog=null}>${n("השאר אוטומציה")}</button><button class="btn primary" type="button" data-suggest-yes @click=${()=>this.openSchedule()}>${n("פתח תזמון חדש")}</button>`)}
      </sw-dialog>`}openDeviceTest(){this.dryResult=null,this.dialog="devtest"}async loadDry(){if(!(!this.draft||this.dryResult))try{this.dryResult=await this.computeDry(this.draft)}catch(t){this.note=Se(t)}}theirsLabel(){const t=this.conflict?.updated_at?new Date(this.conflict.updated_at):null,s=t&&!Number.isNaN(t.getTime())?` · ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`:"";return`${n("החדש")}${s}`}saveMerged(t){const s=this.conflict;!s||!this.env||(ke(t,this.env.ctx),this.rebaseOn(s),this.draft=t,this.conflict=null,this.dialog=null,this.touched=!0,this.version++,this.save())}renderCompare(){if(!this.conflict||!this.draft||!this.env||this.dialog!=="compare")return c;const t=vr(this.kind,this.draft,this.conflict.draft,this.env.ctx);return t.length?o`<div class="diff" data-compare><span class="h"></span><span class="h">${n("שלי")}</span><span class="h">${n("החדש")}</span>
      ${t.map(s=>o`<span class="g">${s.group}</span><span class="c mine">${s.mine}</span><span class="c">${s.theirs}</span>`)}</div>`:o`<div class="dlg-body">${n("אין הבדלים בתוכן.")}</div>`}openSchedule(){const t=this.suggestDraft;if(this.dialog=null,!t){this.note=n("לא ניתן לפתוח את התזמונים כרגע");return}try{sessionStorage.setItem(nn,JSON.stringify(t))}catch{this.note=n("לא ניתן לפתוח את התזמונים כרגע");return}this.emit("cancel",{reason:"schedule"}),this.closeSelf(),X("/devices/schedules/new/edit",{draft:"1"})}renderBody(){return this.phase==="loading"?o`<div class="state-box" data-editor-state="loading"><b>${n("טוען…")}</b></div>`:this.phase==="error"&&this.loadDenied?o`<div class="state-box err" data-editor-state="forbidden"><b>${this.loadError}</b></div>`:this.phase==="error"?o`<div class="state-box err" data-editor-state="error"><b>${n("לא הצלחנו לטעון")}</b><span>${this.loadError}</span><button class="btn" type="button" @click=${()=>void this.init()}>${f("refresh")}${n("נסו שוב")}</button></div>`:this.view==="code"?o`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderCodeView()}`:this.renderBuilderBody()}render(){const t=this.phase==="ready"&&this.draft;return o`<dialog class="sheet" tabindex="-1" autofocus aria-label=${this.nameLabel} @cancel=${this.onSheetCancel} @keydown=${this.onSheetKey} @dragend=${this.onDragEnd}>
      ${this.stage==="templates"&&t?this.renderGalleryShell():o`${this.renderHeader()}
        <div class="shb" id="shb" data-editor-body data-view=${this.view}>${this.renderBody()}</div>
        ${t?this.renderFooter():o`<footer class="shf"><span class="sp"></span><button class="btn quiet" type="button" @click=${()=>this.cancel()}>${n("סגירה")}</button></footer>`}
        ${this.renderTypePop()}${this.renderPicker()}`}
      ${this.renderDialogs()}
    </dialog>`}renderGalleryShell(){return o`<div class="grab" aria-hidden="true"></div>
      <header class="shh"><div class="tx"><h3>${n("אוטומציה חדשה")}</h3><small>${n("מתבנית או מאפס")}</small></div>
        <button class="bk" type="button" aria-label=${n("סגירה")} data-editor-close @click=${()=>this.cancel()}>${f("close")}</button></header>
      <div class="shb" data-editor-body data-stage="templates"><automation-templates .enabled=${this.status?.ui.templates_enabled!==!1} @template-pick=${t=>this.adoptTemplate(t.detail.template)}></automation-templates></div>`}adoptTemplate(t){if(this.stage="edit",!t||!this.env)return;const s=Bn(U(t.draft));ke(s,this.env.ctx),this.draft=s,this.templateName=t.name,this.touched=!0,this.version++,this.schedulePreview(0)}}S([b({attribute:"item-id"})],_.prototype,"itemId");S([b()],_.prototype,"mode");S([b({type:Boolean,reflect:!0})],_.prototype,"open");S([b()],_.prototype,"scheme");S([b({attribute:!1})],_.prototype,"draft0");S([h()],_.prototype,"phase");S([h()],_.prototype,"loadError");S([h()],_.prototype,"loadDenied");S([h()],_.prototype,"status");S([h()],_.prototype,"env");S([h()],_.prototype,"item");S([h()],_.prototype,"draft");S([h()],_.prototype,"openUid");S([h()],_.prototype,"view");S([h()],_.prototype,"codeText");S([h()],_.prototype,"codeOk");S([h()],_.prototype,"preview");S([h()],_.prototype,"busy");S([h()],_.prototype,"pop");S([h()],_.prototype,"picker");S([h()],_.prototype,"dialog");S([h()],_.prototype,"dryResult");S([h()],_.prototype,"saveError");S([h()],_.prototype,"serverIssues");S([h()],_.prototype,"conflict");S([h()],_.prototype,"note");S([h()],_.prototype,"dragUid");S([h()],_.prototype,"dropAt");S([h()],_.prototype,"touched");S([h()],_.prototype,"stage");S([h()],_.prototype,"templateName");S([h()],_.prototype,"optionsOpen");S([ct("dialog.sheet")],_.prototype,"sheet");S([ct("automation-code")],_.prototype,"codeEl");const ot={cooldown_s:10,max_per_hour:30,max_per_day:300,arm_days:180,storm_refusals:5,storm_window_s:600},Mt={cooldown_s:[1,3600],max_per_hour:[1,600],max_per_day:[1,1e4],arm_days:[1,365]},ne="door-automations",mo={status:()=>Xe(`${ne}/status`),doors:async()=>(await Xe(`${ne}/doors`)).doors,forAutomation:async e=>(await Xe(`${ne}?automation_id=${encodeURIComponent(e)}`)).items[0]??null,create:(e,t,s)=>Qe(ne,{automation_id:e,name:t,policy:s}),update:(e,t,s)=>Ui(`${ne}/${e.id}`,{name:t,policy:s,policy_revision:e.policy_revision}),arm:e=>Qe(`${ne}/${e.id}/arm`,{confirmed:!0,policy_revision:e.policy_revision}),disarm:e=>Qe(`${ne}/${e.id}/disarm`,{}),simulate:e=>Qe(`${ne}/${e.id}/simulate`,{}),remove:async e=>{await qi(`${ne}/${e.id}`)},fires:async e=>(await Xe(`${ne}/${e.id}/fires`)).fires};function Vs(){return{doors:[],windows:[]}}function bo(e={}){const t=new Map,s=[{station_id:"demo-entry",relay:1,name:"כניסה ראשית",online:!0,can_arm:!0},{station_id:"demo-dock",relay:2,name:"רציף · שער",online:!0,can_arm:!0},{station_id:"demo-roof",relay:1,name:"יציאה לגג",online:!1,can_arm:!1}];let i=0;const a=()=>ts(new Date),r=d=>d.doors.map(p=>({...p,name:s.find(u=>u.station_id===p.station_id&&u.relay===p.relay)?.name??null})),l=d=>[...t.values()].find(p=>p.id===d);return{status:async()=>e.visible?{visible:!0,feature:e.available?"on":"off",go_live_permitted:!!e.available,available:!!e.available,killed:!!e.killed,can_manage:!0,can_lift_kill:!0,can_configure:!0,limits:{...ot}}:{visible:!1},doors:async()=>s.map(d=>({...d})),forAutomation:async d=>t.get(d)??null,create:async(d,p,u)=>{const m=a(),g={id:`da_demo${String(++i).padStart(27,"0")}`,automation_id:d,automation_name:null,name:p,state:"draft",policy:structuredClone(u),policy_revision:1,doors:r(u),bound_item_revision:null,armed_by:null,armed_by_name:null,armed_at:null,armed_until:null,disarm_reason:null,disarmed_at:null,created_at:m,updated_at:m};return t.set(d,g),structuredClone(g)},update:async(d,p,u)=>{const m=l(d.id);return Object.assign(m,{name:p,policy:structuredClone(u),doors:r(u),policy_revision:m.policy_revision+1,updated_at:a()}),m.state==="armed"&&Object.assign(m,{state:"disarmed",disarm_reason:"edited",disarmed_at:a()}),structuredClone(m)},arm:async d=>{const p=l(d.id),u=ts(Date.now()+(p.policy.arm_days??ot.arm_days)*864e5);return Object.assign(p,{state:"armed",armed_by:"demo",armed_by_name:"מנהל המערכת",armed_at:a(),armed_until:u,disarm_reason:null,disarmed_at:null}),structuredClone(p)},disarm:async d=>{const p=l(d.id);return p.state==="armed"&&Object.assign(p,{state:"disarmed",disarm_reason:"manual",disarmed_at:a()}),structuredClone(p)},simulate:async d=>{const p=l(d.id),u=[{gate:"armed",ok:p.state==="armed",reason:p.state==="armed"?null:"not_armed"},{gate:"feature",ok:!!e.available,reason:e.available?null:"feature_off"},{gate:"kill",ok:!e.killed,reason:e.killed?"killed":null}],m=p.doors.map(g=>({door:g.name,decision:"would_open",reason:null}));return{at:a(),gates:u,doors:m,would_send:u.every(g=>g.ok)}},remove:async d=>{for(const[p,u]of t)u.id===d.id&&t.delete(p)},fires:async()=>[]}}function go(){try{return typeof location<"u"&&new URLSearchParams(location.search).has("demo-door-automation")}catch{return!1}}let wo=null;const $o=()=>et()?mo:wo??=bo({visible:go()}),vt={title:"פתיחת דלת",sub:"Arx פותחת את הדלת כשהאוטומציה רצה, רק בתנאים שלמטה",stateDraft:"טיוטה · לא פעיל",stateArmed:"פעיל",stateDisarmed:"כבוי",off:"כבוי בגרסה הזו",killed:"כל פתיחות הדלתות מאוטומציות עצורות",add:"הוספת פתיחת דלת",name:"שם",doors:"דלתות",doorsEmpty:"אין דלתות שמותר לך להוסיף",doorNoOpen:"אין לך הרשאה לפתוח דלת זו",doorOffline:"לא מחוברת",windows:"מתי מותר",windowAdd:"הוספת חלון זמן",anyTime:"בכל זמן",windowRemove:"הסרה",from:"מ־",to:"עד",limits:"מגבלות",cooldown:"המתנה בין פתיחות (שניות)",perHour:"פתיחות לדלת בשעה",perDay:"פתיחות ביום",armDays:"תוקף ההפעלה (ימים)",save:"שמירה",edit:"עריכה",arm:"הפעלה",disarm:"כיבוי",simulate:"בדיקה",remove:"מחיקה",cancel:"ביטול",armTitle:"להפעיל פתיחת דלת מאוטומציה?",armText:"הדלתות שנבחרו ייפתחו בלי אדם ליד, בכל פעם שהאוטומציה רצה בחלונות הזמן שנבחרו. ההפעלה נרשמת על שמך ונכבית מעצמה אחרי {days} ימים, בכל שינוי ואם תאבד הרשאה.",armConfirm:"הפעלה",removeTitle:"למחוק את פתיחת הדלת?",armedBy:"הופעל בידי {who} · עד {until}",disarmedWhy:"כבוי: {why}",simTitle:"תוצאת בדיקה",simWould:"הייתה נשלחת פתיחה",simWouldNot:"לא הייתה נשלחת פתיחה",simNothing:"שום דבר לא נשלח",history:"פעולות אחרונות",historyEmpty:"עדיין לא רצה",saved:"נשמר",loadError:"לא ניתן לטעון",retry:"נסה שוב",needDoor:"יש לבחור לפחות דלת אחת",needWindow:"יש להגדיר לפחות חלון זמן אחד",badWindow:"שעת הסיום חייבת להיות אחרי שעת ההתחלה",saveFirst:"יש לשמור את האוטומציה לפני הוספת פתיחת דלת",d0:"ב׳",d1:"ג׳",d2:"ד׳",d3:"ה׳",d4:"ו׳",d5:"ש׳",d6:"א׳",g_armed:"מופעל",g_feature:"זמין בגרסה",g_kill:"לא עצור",g_expiry:"בתוקף",g_trigger:"הופעל מעצמו",g_revision:"האוטומציה לא שונתה",g_window:"בתוך חלון הזמן",r_not_armed:"לא מופעל",r_feature_off:"כבוי בגרסה הזו",r_killed:"עצור",r_arm_expired:"תוקף ההפעלה פג",r_manual_trigger:"הופעל ידנית - פתיחה רק מכפתור הדלת",r_item_changed:"האוטומציה שונתה",r_item_missing:"האוטומציה לא נמצאה",r_outside_window:"מחוץ לחלון הזמן",r_clock_untrusted:"אזור הזמן של המערכת לא תקין",r_door_unavailable:"הדלת לא זמינה",r_armer_lost_authority:"למי שהפעיל אין עוד הרשאה",r_cooldown:"פתיחה קודמת לפני זמן קצר",r_rate_hour:"הגיע למכסה השעתית",r_rate_day:"הגיע למכסה היומית",r_storm:"נעצר אחרי ניסיונות חוזרים",r_edited:"ההגדרה שונתה",r_manual:"כובה ידנית",r_deleted:"נמחק",r_loop_risk:"האוטומציה מופעלת מהדלת עצמה",r_triggers_unresolvable:"לא ניתן לזהות מה מפעיל את האוטומציה",r_uncorroborated:"ההפעלה לא אומתה מול מצב המערכת",r_door_rate_hour:"הדלת הגיעה למכסה השעתית שלה",r_door_rate_day:"הדלת הגיעה למכסה היומית שלה",r_restored:"כובה אחרי שחזור גיבוי",o_sent:"נשלח",o_refused:"לא נשלח",o_unknown:"לא ידוע אם נשלח",o_not_sent:"לא נשלח",o_pending:"בטיפול"},Pi=Ft("en","i18n/door-automation","en"),Ai=Ft("ar","i18n/door-automation","ar"),Ni=Ft("ru","i18n/door-automation","ru");function lt(){return Hi(["en","ar","ru"])}const yo={he:vt,en:Pi,ar:Ai,ru:Ni},xo=["ar","ru"];function y(e,t,s=lt()){const i=yo[s][e]??vt[e]??e;return Wi(i,t)}function ze(e,t,s=lt()){const i=`${e}_${t??""}`;return i in vt?y(i,void 0,s):y(e==="o"?"o_refused":"r_not_armed",void 0,s)}Vi("i18n/door-automation",{he:vt,en:Pi,ar:Ai,ru:Ni},xo);function ko(e,t,s){return t.killed?{tone:"warn",text:y("killed",void 0,s)}:!e||e.state==="draft"?{tone:"neutral",text:y("stateDraft",void 0,s)}:e.state==="disarmed"?{tone:"off",text:y("stateDisarmed",void 0,s)}:t.available?{tone:"live",text:y("stateArmed",void 0,s)}:{tone:"off",text:y("off",void 0,s)}}function _o(e,t,s=i=>i.slice(0,10)){return e?e.state==="armed"&&e.armed_until?y("armedBy",{who:e.armed_by_name||e.armed_by||"",until:s(e.armed_until)},t):e.state==="disarmed"&&e.disarm_reason?y("disarmedWhy",{why:ze("r",e.disarm_reason,t)},t):null:null}function Ws(e){if(e==="24:00")return 1440;const[t,s]=e.split(":").map(Number);return t*60+s}const Hs=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;function zo(e,t){const s=[];return t.doors.length||s.push("needDoor"),t.windows.some(i=>!i.days.length||!Hs.test(i.start)||!(i.end==="24:00"||Hs.test(i.end))||Ws(i.start)>=Ws(i.end))&&s.push("badWindow"),e.trim()||s.push("name"),s}function Gs(e){return e==="he"||e==="ar"?[6,0,1,2,3,4,5]:[0,1,2,3,4,5,6]}function So(e,t){const s=e.days.includes(t)?e.days.filter(i=>i!==t):[...e.days,t].sort((i,a)=>i-a);return{...e,days:s}}const dt=(e,t)=>e.station_id===t.station_id&&e.relay===t.relay;function Oo(e,t){const i=e.doors.some(a=>dt(a,t))?e.doors.filter(a=>!dt(a,t)):[...e.doors,{station_id:t.station_id,relay:t.relay}];return{...e,doors:i}}function Eo(e,t,s,i){return!e||i||e.state==="armed"||t.killed?!1:e.policy.doors.length>0&&e.policy.doors.every(a=>s.some(r=>dt(r,a)&&r.can_arm))}function Do(e){const t={doors:e.doors.map(s=>({station_id:s.station_id,relay:s.relay})),windows:e.windows.map(s=>({days:[...s.days].sort((i,a)=>i-a),start:s.start,end:s.end}))};for(const s of Object.keys(Mt)){const i=e[s];if(i==null||!Number.isFinite(i))continue;const[a,r]=Mt[s];t[s]=Math.min(r,Math.max(a,Math.round(i)))}return t}var Co=Object.defineProperty,To=Object.getOwnPropertyDescriptor,G=(e,t,s,i)=>{for(var a=i>1?void 0:i?To(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Co(t,s,a),a};let q=class extends Q{constructor(){super(...arguments),this.automationId=null,this.adapter=null,this.status=null,this.block=null,this.choices=[],this.editing=!1,this.name="",this.policy=Vs(),this.dirty=!1,this.busy=!1,this.error=null,this.confirm=null,this.sim=null,this.history=[],this.problems=[]}get api(){return this.adapter??$o()}updated(e){(e.has("automationId")||e.has("adapter"))&&this.load()}async load(){this.error=null,this.sim=null;try{const e=await this.api.status();if(this.status=e,!e.visible||!this.automationId)return;const[t,s]=await Promise.all([this.api.forAutomation(this.automationId),this.api.doors()]);this.choices=s,this.setBlock(t),this.history=t?await this.api.fires(t):[]}catch{this.error=y("loadError")}}setBlock(e){this.block=e,this.name=e?.name??"",this.policy=e?structuredClone(e.policy):Vs(),this.dirty=!1,this.problems=[]}edit(e){e(),this.dirty=!0,this.sim=null,this.problems=[]}async run(e){this.busy=!0,this.error=null;try{await e()}catch(t){const s=t?.body?.user_message;this.error=typeof s=="string"&&s?s:y("loadError")}finally{this.busy=!1}}save(){const e=zo(this.name,this.policy);return this.problems=e,e.length?Promise.resolve():this.run(async()=>{const t=Do(this.policy),s=this.block?await this.api.update(this.block,this.name.trim(),t):await this.api.create(this.automationId,this.name.trim(),t);this.setBlock(s),this.editing=!1})}arm(){return this.confirm=null,this.run(async()=>this.setBlock(await this.api.arm(this.block)))}disarm(){return this.run(async()=>this.setBlock(await this.api.disarm(this.block)))}simulate(){return this.run(async()=>{this.sim=await this.api.simulate(this.block)})}removeBlock(){return this.confirm=null,this.run(async()=>{await this.api.remove(this.block),this.setBlock(null),this.editing=!1,this.history=[]})}render(){const e=this.status;if(!e?.visible)return c;if(!this.automationId)return o`<section class="da"><p class="muted">${y("saveFirst")}</p></section>`;const t=ko(this.block,e),s=_o(this.block);return o`<section class="da" data-door-automation aria-labelledby="da-title">
      <header>
        <span class="k">${f("door",14)}</span>
        <div class="hd"><h4 id="da-title">${y("title")}</h4><small>${y("sub")}</small></div>
        <span class="tag ${t.tone}" data-state>${t.text}</span>
      </header>
      ${s?o`<p class="line">${s}</p>`:c}
      ${this.error?o`<p class="err" role="alert">${this.error} <button class="link" type="button" @click=${()=>void this.load()}>${y("retry")}</button></p>`:c}
      ${!this.block&&!this.editing?o`<button class="btn" type="button" data-add ?disabled=${this.busy} @click=${()=>{this.editing=!0,this.setBlock(null)}}>${f("door")}${y("add")}</button>`:this.editing?this.renderForm():this.renderSummary()}
      ${this.renderConfirm()}${this.renderSim()}
    </section>`}renderSummary(){const e=this.block,t=this.status;return o`<div class="sum">
        <div class="chips">${e.doors.map(s=>o`<span class="tag acc">${f("door",12)}<bdi>${s.name??"—"}</bdi></span>`)}</div>
        <div class="chips">${e.policy.windows.length===0?o`<span class="tag">${y("anyTime")}</span>`:c}${e.policy.windows.map(s=>o`<span class="tag"><bdi>${this.daysText(s.days)}</bdi> · <bdi dir="ltr">${s.start}–${s.end}</bdi></span>`)}</div>
      </div>
      <div class="row">
        <button class="btn" type="button" data-edit ?disabled=${this.busy} @click=${()=>{this.editing=!0}}>${f("edit")}${y("edit")}</button>
        ${e.state==="armed"?o`<button class="btn" type="button" data-disarm ?disabled=${this.busy} @click=${()=>void this.disarm()}>${y("disarm")}</button>`:o`<button class="btn primary" type="button" data-arm ?disabled=${this.busy||!Eo(e,t,this.choices,this.dirty)} @click=${()=>{this.confirm="arm"}}>${y("arm")}</button>`}
        <button class="btn" type="button" data-simulate ?disabled=${this.busy} @click=${()=>void this.simulate()}>${f("flask")}${y("simulate")}</button>
        <button class="btn ghost" type="button" data-remove ?disabled=${this.busy} @click=${()=>{this.confirm="remove"}}>${f("trash")}${y("remove")}</button>
      </div>
      ${this.renderHistory()}`}daysText(e){return Gs(lt()).filter(s=>e.includes(s)).map(s=>y(`d${s}`)).join(" ")}renderForm(){const e=this.policy,t=lt();return o`<form class="form" @submit=${s=>{s.preventDefault(),this.save()}}>
      <label class="fld"><span>${y("name")}</span>
        <input type="text" maxlength="80" .value=${this.name} data-name @input=${s=>this.edit(()=>{this.name=s.target.value})} />
      </label>
      <fieldset><legend>${y("doors")}</legend>
        ${this.choices.length===0?o`<p class="muted">${y("doorsEmpty")}</p>`:c}
        ${this.choices.map(s=>o`<label class="door ${s.can_arm?"":"dim"}">
          <input type="checkbox" .checked=${e.doors.some(i=>dt(i,s))} data-door=${`${s.station_id}#${s.relay}`}
            @change=${()=>this.edit(()=>{this.policy=Oo(this.policy,s)})} />
          <bdi>${s.name}</bdi>
          ${s.online?c:o`<span class="tag">${y("doorOffline")}</span>`}
          ${s.can_arm?c:o`<span class="tag warn">${y("doorNoOpen")}</span>`}
        </label>`)}
      </fieldset>
      <fieldset><legend>${y("windows")}</legend>
        ${e.windows.length===0?o`<p class="muted" data-any-time>${y("anyTime")}</p>`:c}
        ${e.windows.map((s,i)=>o`<div class="win" data-window=${i}>
          <div class="days" role="group">${Gs(t).map(a=>o`<button type="button" class="day ${s.days.includes(a)?"on":""}" aria-pressed=${s.days.includes(a)?"true":"false"}
            @click=${()=>this.edit(()=>{this.policy={...this.policy,windows:this.policy.windows.map((r,l)=>l===i?So(r,a):r)}})}>${y(`d${a}`)}</button>`)}</div>
          <label class="t"><span>${y("from")}</span><input type="time" lang=${qe()} dir="ltr" .value=${s.start} @change=${a=>this.setWin(i,"start",a.target.value)} /></label>
          <label class="t"><span>${y("to")}</span><input type="time" lang=${qe()} dir="ltr" .value=${s.end==="24:00"?"23:59":s.end} @change=${a=>this.setWin(i,"end",a.target.value)} /></label>
          ${e.windows.length>0?o`<button type="button" class="link" @click=${()=>this.edit(()=>{this.policy={...this.policy,windows:this.policy.windows.filter((a,r)=>r!==i)}})}>${y("windowRemove")}</button>`:c}
        </div>`)}
        ${e.windows.length<7?o`<button type="button" class="link" data-add-window @click=${()=>this.edit(()=>{this.policy={...this.policy,windows:[...this.policy.windows,{days:[6,0,1,2,3],start:"07:00",end:"09:00"}]}})}>+ ${y("windowAdd")}</button>`:c}
      </fieldset>
      <details class="lim"><summary>${y("limits")}</summary>
        ${this.num("cooldown","cooldown_s")}${this.num("perHour","max_per_hour")}${this.num("perDay","max_per_day")}${this.num("armDays","arm_days")}
      </details>
      ${this.problems.length?o`<p class="err" role="alert">${this.problems.map(s=>y(s)).join(" · ")}</p>`:c}
      <div class="row">
        <button class="btn primary" type="submit" data-save ?disabled=${this.busy}>${y("save")}</button>
        <button class="btn" type="button" ?disabled=${this.busy} @click=${()=>{this.editing=!1,this.setBlock(this.block)}}>${y("cancel")}</button>
      </div>
    </form>`}setWin(e,t,s){this.edit(()=>{const i=t==="end"&&s==="23:59"?"24:00":s;this.policy={...this.policy,windows:this.policy.windows.map((a,r)=>r===e?{...a,[t]:i}:a)}})}num(e,t){const[s,i]=Mt[t],a=(this.status?.limits??ot)[t],r=this.policy[t];return o`<label class="fld n"><span>${y(e)}</span><input type="number" dir="ltr" min=${s} max=${i} placeholder=${String(a)} data-limit=${t}
      .value=${r===void 0?"":String(r)}
      @change=${l=>this.edit(()=>{const d=l.target.value.trim(),p={...this.policy};d===""?delete p[t]:p[t]=Number(d),this.policy=p})} /></label>`}renderConfirm(){if(!this.confirm||!this.block)return c;const e=this.confirm==="arm";return o`<div class="confirm" role="alertdialog" aria-labelledby="da-confirm-title" data-confirm=${this.confirm}>
      <h5 id="da-confirm-title">${y(e?"armTitle":"removeTitle")}</h5>
      ${e?o`<p>${y("armText",{days:this.block.effective_limits?.arm_days??this.block.policy.arm_days??(this.status?.limits??ot).arm_days})}</p>`:c}
      <div class="row">
        <button class="btn ${e?"primary":"danger"}" type="button" data-confirm-yes ?disabled=${this.busy} @click=${()=>void(e?this.arm():this.removeBlock())}>${y(e?"armConfirm":"remove")}</button>
        <button class="btn" type="button" @click=${()=>{this.confirm=null}}>${y("cancel")}</button>
      </div>
    </div>`}renderSim(){const e=this.sim;return e?o`<div class="sim" data-sim role="status">
      <h5>${y("simTitle")} · <span class="tag ${e.would_send?"ok":"warn"}">${e.would_send?y("simWould"):y("simWouldNot")}</span></h5>
      <ul>${e.gates.map(t=>o`<li class=${t.ok?"ok":"no"}>${t.ok?"✓":"✕"} ${t.ok?ze("g",t.gate):ze("r",t.reason)}</li>`)}
        ${e.doors.map(t=>o`<li class=${t.decision==="would_open"?"ok":"no"}>${f("door",12)} <bdi>${t.door??"—"}</bdi>${t.reason?o` · ${ze("r",t.reason)}`:c}</li>`)}</ul>
      <small class="muted">${y("simNothing")}</small>
    </div>`:c}renderHistory(){return this.block?o`<details class="hist"><summary>${y("history")}</summary>
      ${this.history.length===0?o`<p class="muted">${y("historyEmpty")}</p>`:o`<ul>${this.history.slice(0,10).map(e=>o`<li><bdi dir="ltr">${e.at.slice(0,16).replace("T"," ")}</bdi> · <bdi>${e.door??"—"}</bdi> · ${e.attempted?ze("o",e.outcome):ze("r",e.reason)}</li>`)}</ul>`}
    </details>`:c}};q.styles=[Te,B`
      /* local knobs: the editor's devices theme (--dv-*) when mounted inside it, the shell tokens otherwise (never redefine --dv-* here) */
      :host {
        display: block;
        --da-accent: var(--dv-accent, var(--sw-accent));
        --da-on-accent: var(--dv-on-accent, #ffffff);
        --da-accent-soft: var(--dv-accent-soft, rgba(10, 100, 216, 0.12));
        --da-accent-text: var(--dv-accent-text, var(--sw-accent));
        --da-line: var(--dv-border-strong, var(--sw-border));
        --da-surface: var(--dv-surface-2, var(--sw-surface));
        --da-soft: var(--dv-surface-3, var(--sw-surface-3));
        --da-text-2: var(--dv-text-2, var(--sw-text-2));
        --da-danger: var(--dv-danger, #d70015);
        --da-ok-bg: var(--dv-success-soft, rgba(52, 199, 89, 0.16));
        --da-warn-bg: var(--dv-warning-soft, rgba(255, 159, 10, 0.16));
      }
      .btn {
        border-color: var(--da-line);
        background: var(--da-surface);
      }
      .btn.primary {
        background: var(--da-accent);
        border-color: var(--da-accent);
        color: var(--da-on-accent);
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .btn:hover:not(:disabled) {
        background: var(--da-soft);
      }
      .btn.primary:hover:not(:disabled) {
        background: var(--da-accent);
        filter: brightness(0.93);
      }
      .tag.acc {
        background: var(--da-accent-soft);
        color: var(--da-accent-text);
      }
      .tag.warn {
        background: var(--da-warn-bg);
      }
      .tag.ok {
        background: var(--da-ok-bg);
      }
      .da {
        margin-block-start: 14px;
        padding: 14px;
        border-radius: var(--sw-r-lg);
        border: 1px solid var(--da-line);
        background: var(--da-surface);
        display: grid;
        gap: 10px;
      }
      header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      header .k {
        display: inline-grid;
        place-items: center;
        inline-size: 28px;
        block-size: 28px;
        border-radius: var(--sw-r-sm);
        background: var(--da-accent-soft);
        color: var(--da-accent-text);
        flex: none;
      }
      .hd {
        flex: 1;
        min-inline-size: 0;
      }
      h4 {
        margin: 0;
        font-size: var(--sw-fs-base);
      }
      h5 {
        margin: 0 0 6px;
        font-size: var(--sw-fs-sm);
      }
      small,
      .muted,
      .line {
        color: var(--da-text-2);
        font-size: var(--sw-fs-sm);
        margin: 0;
      }
      .tag.live {
        background: var(--da-ok-bg);
        color: var(--sw-success-text);
      }
      .tag.off,
      .tag.neutral {
        background: var(--da-soft);
        color: var(--da-text-2);
      }
      .err {
        color: var(--da-danger);
        font-size: var(--sw-fs-sm);
        margin: 0;
      }
      .row,
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .sum {
        display: grid;
        gap: 6px;
      }
      .btn.ghost {
        background: transparent;
        box-shadow: none;
      }
      .btn.danger {
        background: var(--da-danger);
        border-color: var(--da-danger);
        color: var(--da-on-accent);
      }
      .link {
        background: none;
        border: none;
        padding: 0;
        color: var(--da-accent-text);
        font-weight: var(--sw-fw-semibold);
        min-block-size: 32px;
      }
      .form {
        display: grid;
        gap: 12px;
      }
      fieldset {
        border: 1px solid var(--dv-border, var(--sw-border));
        border-radius: var(--sw-r-md);
        padding: 8px 12px 12px;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      legend {
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-sm);
        padding-inline: 4px;
      }
      .fld {
        display: grid;
        gap: 4px;
        font-size: var(--sw-fs-sm);
      }
      .fld.n {
        grid-template-columns: 1fr 96px;
        align-items: center;
      }
      input[type='text'],
      input[type='number'],
      input[type='time'] {
        font: inherit;
        min-block-size: 40px;
        padding: 0 10px;
        border-radius: var(--sw-r-md);
        border: 1px solid var(--da-line);
        background: var(--dv-surface-solid, var(--sw-surface));
        color: inherit;
      }
      .door {
        display: flex;
        align-items: center;
        gap: 8px;
        min-block-size: 40px;
        flex-wrap: wrap;
      }
      .door.dim bdi {
        color: var(--da-text-2);
      }
      .door input {
        inline-size: 20px;
        block-size: 20px;
      }
      .win {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .days {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .day {
        min-inline-size: 40px;
        min-block-size: 36px;
        border-radius: 999px;
        border: 1px solid var(--da-line);
        background: transparent;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
      }
      .day.on {
        background: var(--da-accent);
        border-color: var(--da-accent);
        color: var(--da-on-accent);
      }
      .t {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--sw-fs-sm);
      }
      .lim {
        display: grid;
        gap: 8px;
      }
      .lim[open] {
        padding-block-end: 4px;
      }
      summary {
        cursor: pointer;
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-sm);
        min-block-size: 32px;
        display: flex;
        align-items: center;
      }
      .confirm,
      .sim {
        border-radius: var(--sw-r-md);
        padding: 12px;
        background: var(--da-warn-bg);
      }
      .sim {
        background: var(--da-soft);
      }
      .confirm p {
        margin: 0 0 10px;
        font-size: var(--sw-fs-sm);
      }
      ul {
        margin: 0;
        padding-inline-start: 18px;
        display: grid;
        gap: 2px;
        font-size: var(--sw-fs-sm);
      }
      li.no {
        color: var(--da-text-2);
      }
      @media (max-width: 600px) {
        .row .btn {
          flex: 1 1 auto;
          min-block-size: 44px;
        }
      }
    `];G([b({attribute:"automation-id"})],q.prototype,"automationId",2);G([b({attribute:!1})],q.prototype,"adapter",2);G([h()],q.prototype,"status",2);G([h()],q.prototype,"block",2);G([h()],q.prototype,"choices",2);G([h()],q.prototype,"editing",2);G([h()],q.prototype,"name",2);G([h()],q.prototype,"policy",2);G([h()],q.prototype,"dirty",2);G([h()],q.prototype,"busy",2);G([h()],q.prototype,"error",2);G([h()],q.prototype,"confirm",2);G([h()],q.prototype,"sim",2);G([h()],q.prototype,"history",2);G([h()],q.prototype,"problems",2);q=G([H("door-automation-block")],q);var Io=Object.getOwnPropertyDescriptor,Po=(e,t,s,i)=>{for(var a=i>1?void 0:i?Io(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=l(a)||a);return a};let Ys=class extends _{get kind(){return"automation"}get nameLabel(){return n("שם האוטומציה")}get startsWithGallery(){return!0}subtitleNew(){return n("אוטומציה חדשה")}blankDraft(){return{alias:"",description:"",mode:"single",max:null,triggers:[],conditions:[],actions:[]}}renderBuilderBody(){const e=this.draft,t=e.triggers.length;return o`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="trigger">
        <h4><span class="k when">${f("bolt",14)}</span>${n("כאשר")}<small>${t===0?n("מה מפעיל"):t===1?n("טריגר אחד"):n("{n} טריגרים · אחד מהם מספיק",{n:t})}</small></h4>
        ${this.renderList(te,"triggers","trigger")}
      </section>
      <section class="bsec2" data-section="condition">
        <h4><span class="k if">${f("question",14)}</span>${n("אם")}<small>${e.conditions.length?n("כל התנאים צריכים להתקיים"):n("לא חובה")}</small></h4>
        ${this.renderList(te,"conditions","condition")}
      </section>
      <section class="bsec2" data-section="action">
        <h4><span class="k then">${f("play",14)}</span>${n("אז")}<small>${e.actions.length?n("{n} צעדים, לפי הסדר",{n:e.actions.length}):n("מה לעשות")}</small></h4>
        ${this.renderList(te,"actions","action")}
        ${this.isNew?c:o`<door-automation-block .automationId=${this.itemId}></door-automation-block>`}
      </section>
      ${this.renderOptionsBox(this.renderDeleteRow()??c)}`}};Ys=Po([H("automation-builder")],Ys);var Ao=Object.defineProperty,No=Object.getOwnPropertyDescriptor,Xt=(e,t,s,i)=>{for(var a=i>1?void 0:i?No(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Ao(t,s,a),a};const Ro={number:"thermo",entity:"layers",boolean:"check",select:"list",text:"edit",locked:"lock"},Ks=["number","boolean","select","text","entity"];let Ge=class extends _{constructor(){super(...arguments),this.openField=null,this.adding=!1}get kind(){return"script"}get nameLabel(){return n("שם הסקריפט")}subtitleNew(){return n("סקריפט חדש")}blankDraft(){return{alias:"",description:"",icon:null,mode:"single",max:null,fields:[],sequence:[]}}footerExtras(){return c}setFields(e){if(!this.draft)return;const t=U(this.draft);e(t.fields),this.change(t)}fieldEditor(e,t){const s=r=>this.setFields(l=>r(l[t])),i=e.selector,a=(r,l,d)=>o`<label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${d} aria-label=${d} .value=${r===void 0?"":String(r)}
      @change=${p=>{const u=p.target.value.trim().replace(",","."),m=u===""?void 0:Number(u);l(m!==void 0&&Number.isFinite(m)?m:void 0)}} /></label>`;return o`<div class="edit" data-field-edit=${t}>
      <div class="frow">
        <div class="fld"><label>${n("שם השדה")}</label><label class="inp"><input data-fld="field.name" aria-label=${n("שם השדה")} dir="auto" .value=${e.name} @input=${r=>s(l=>{l.name=r.target.value})} /></label></div>
        <div class="fld"><label>${n("מפתח (לטינית)")}</label><label class="inp"><input data-fld="field.key" aria-label=${n("מפתח")} dir="ltr" .value=${e.key} @change=${r=>s(l=>{l.key=r.target.value.trim()})} /></label></div>
      </div>
      <div class="frow">
        <div class="fld"><label>${n("סוג")}</label><select class="selx" data-fld="field.kind" aria-label=${n("סוג")} @change=${r=>{const l=r.target.value;s(d=>{d.selector=Ps(l,[]).selector,d.default=void 0})}}>
          ${Ks.map(r=>o`<option value=${r} ?selected=${i.kind===r}>${Is[r]}</option>`)}</select></div>
        <div class="fld sm"><label>${n("חובה")}</label><div class="rolechips"><button type="button" aria-pressed=${e.required} data-field-required @click=${()=>s(r=>{r.required=!r.required})}>${e.required?n("חובה"):n("לא חובה")}</button></div></div>
      </div>
      ${i.kind==="number"?o`<div class="frow"><div class="fld sm"><label>${n("מינימום")}</label>${a(i.min,r=>s(l=>{l.selector.kind==="number"&&(l.selector.min=r??0)}),"field.min")}</div>
        <div class="fld sm"><label>${n("מקסימום")}</label>${a(i.max,r=>s(l=>{l.selector.kind==="number"&&(l.selector.max=r??100)}),"field.max")}</div>
        <div class="fld sm"><label>${n("צעד")}</label>${a(i.step,r=>s(l=>{l.selector.kind==="number"&&(r?l.selector.step=r:delete l.selector.step)}),"field.step")}</div>
        <div class="fld sm"><label>${n("ברירת מחדל")}</label>${a(typeof e.default=="number"?e.default:void 0,r=>s(l=>{l.default=r}),"field.default")}</div></div>`:c}
      ${i.kind==="select"?o`<div class="fld full"><label>${n("אפשרויות (אחת בכל שורה)")}</label><label class="inp area"><textarea rows="3" data-fld="field.options" aria-label=${n("אפשרויות")} .value=${i.options.join(`
`)}
        @change=${r=>s(l=>{l.selector.kind==="select"&&(l.selector.options=r.target.value.split(`
`).map(d=>d.trim()).filter(Boolean))})}></textarea></label></div>`:c}
      ${i.kind==="entity"?o`<div class="fld full"><label>${n("סוגי מכשיר (לטינית, מופרדים בפסיק; ריק = הכל)")}</label><label class="inp"><input data-fld="field.domains" aria-label=${n("סוגי מכשיר")} dir="ltr" .value=${i.domains.join(", ")}
        @change=${r=>s(l=>{l.selector.kind==="entity"&&(l.selector.domains=r.target.value.split(",").map(d=>d.trim()).filter(Boolean))})} /></label></div>`:c}
    </div>`}renderBuilderBody(){const e=this.draft,t=this.issues;return o`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="fields">
        <h4><span class="k if">${f("list",14)}</span>${n("שדות")}<small>${e.fields.length?e.fields.length:n("אין")}</small></h4>
        <div class="fieldlist">${e.fields.map((s,i)=>{const a=this.openField===i,r=t.some(l=>l.path===`fields.${i}`);return o`<div class="frow2 ${a?"open":""} ${r?"bad":""}" data-field=${s.key}>
            <div class="h">
              <button class="main" type="button" aria-expanded=${a} data-field-main @click=${()=>this.openField=a?null:i}>
                <span class="rg">${f(Ro[s.selector.kind]??"list")}</span><span class="nm">${s.name||n("שדה חדש")}<small>${$r(s)}</small></span><code>${s.key}</code></button>
              ${this.hardReadOnly?c:o`<button class="x" type="button" aria-label=${n("מחיקת השדה")} data-field-remove @click=${()=>{this.setFields(l=>l.splice(i,1)),this.openField=null}}>${f("close")}</button>`}
            </div>
            ${a&&s.selector.kind!=="locked"?this.fieldEditor(s,i):a?o`<div class="edit"><div class="codenote">${f("lock")}${n("שדה מתקדם – נשמר כמו שהוא.")}</div></div>`:c}
          </div>`})}</div>
        ${this.hardReadOnly||e.fields.length>=12?c:this.adding?o`<div class="rolechips" data-field-kinds>${Ks.map(s=>o`<button type="button" data-field-kind=${s} @click=${()=>{this.adding=!1,this.setFields(i=>i.push(Ps(s,i.map(a=>a.key)))),this.openField=e.fields.length}}>${Is[s]}</button>`)}</div>`:o`<button class="addblk" type="button" data-add-field @click=${()=>this.adding=!0}>${f("plus")}${n("הוסף שדה")}</button>`}
      </section>
      <section class="bsec2" data-section="action">
        <h4><span class="k then">${f("play",14)}</span>${n("אז")}<small>${e.sequence.length?n("{n} צעדים",{n:e.sequence.length}):n("מה לעשות")}</small></h4>
        ${this.renderList(te,"sequence","action")}
      </section>
      ${this.renderOptionsBox(this.renderDeleteRow())}`}};Ge.styles=[..._.styles,B`
      .fieldlist {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .frow2 {
        display: flex;
        flex-direction: column;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
      }
      .frow2.open {
        border-color: color-mix(in srgb, var(--dv-accent) 50%, transparent);
        box-shadow: 0 0 0 4px var(--dv-accent-soft);
        background: var(--dv-surface-solid, var(--dv-surface));
      }
      .frow2.bad {
        border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
      }
      .frow2 .h {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px 6px 6px;
        min-block-size: 56px;
      }
      .frow2 .main {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        background: transparent;
        text-align: start;
        min-block-size: 44px;
      }
      .frow2 .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      .frow2 .nm {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      .frow2 .nm small {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-medium);
        color: var(--dv-text-2);
      }
      .frow2 .x {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--dv-text-3);
        display: grid;
        place-items: center;
        font-size: var(--sw-fs-lg);
      }
      .frow2 .x:hover {
        background: var(--dv-surface-3);
        color: var(--dv-danger);
      }
      .frow2 .edit {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 4px 14px 14px;
        border-block-start: 1px solid var(--dv-border);
        padding-block-start: 12px;
      }
    `];Xt([h()],Ge.prototype,"openField",2);Xt([h()],Ge.prototype,"adding",2);Ge=Xt([H("script-editor")],Ge);var Lo=Object.getOwnPropertyDescriptor,Mo=(e,t,s,i)=>{for(var a=i>1?void 0:i?Lo(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=l(a)||a);return a};let Bt=class extends _{get kind(){return"scene"}get nameLabel(){return n("שם הסצנה")}get codeToggle(){return!1}subtitleNew(){return n("סצנה חדשה")}blankDraft(){return{name:"",icon:null,members:[]}}members(){return this.draft.members}setMembers(e){if(!this.draft)return;const t=U(this.draft);t.members=e(t.members),this.change(t)}applyPicked(e){const t=new Set(this.members().map(i=>i.entity_id)),s=e.filter(i=>!t.has(i));this.setMembers(i=>[...i.filter(a=>e.includes(a.entity_id)),...s.map(a=>({entity_id:a,state:Rt(a)[0].options?.[0].value??"on",attributes:{}}))]),s.length&&this.capture(s)}async capture(e){try{const t=await ge().capture({entity_ids:e});this.setMembers(s=>s.map(i=>t.members.find(a=>a.entity_id===i.entity_id)??i))}catch(t){this.saveError=Se(t)}}field(e,t){if(t.kind==="select")return o`<div class="fld"><label>${t.label}</label><select class="selx" data-fld=${`${e.entity_id}.${t.key}`} aria-label=${t.label} @change=${i=>this.setMembers(a=>a.map(r=>r.entity_id===e.entity_id?Ts(r,t,i.target.value):r))}>
        ${(t.options?.some(i=>i.value===e.state)?t.options:[...t.options??[],{value:e.state,label:e.state}]).map(i=>o`<option value=${i.value} ?selected=${i.value===e.state}>${i.label}</option>`)}</select></div>`;const s=br(e,t);return o`<div class="fld"><label>${t.label}</label><label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${`${e.entity_id}.${t.key}`} aria-label=${t.label} .value=${s===null?"":String(s)}
      @change=${i=>{const a=i.target.value.trim().replace(",","."),r=a===""?null:Number(a),l=r===null||!Number.isFinite(r)?null:t.min!==void 0&&r<t.min?t.min:t.max!==void 0&&r>t.max?t.max:r;this.setMembers(d=>d.map(p=>p.entity_id===e.entity_id?Ts(p,t,l):p))}} />${t.unit?o`<span class="u">${t.unit}</span>`:c}</label></div>`}row(e,t){const s=this.env.byId.get(e.entity_id),i=this.issues.some(r=>r.path===`members.${t}`),a=Rt(e.entity_id).filter(r=>r.key==="state"||!r.only||r.only==="on"&&e.state==="on").filter(r=>r.key==="state"||e.state!=="off");return o`<div class="mrow ${i?"bad":""}" data-member=${e.entity_id}>
      <div class="who"><span class="rg">${f(ce(e.entity_id))}</span><span class="nm">${this.env.ctx.names(e.entity_id)}<small>${[gr[e.entity_id.split(".")[0]],s?.area?.name].filter(Boolean).join(" · ")}</small></span></div>
      <div class="vals">${a.map(r=>this.field(e,r))}</div>
      ${this.hardReadOnly?c:o`<button class="x" type="button" aria-label=${n("הסרת {name}",{name:this.env.ctx.names(e.entity_id)})} data-member-remove=${e.entity_id} @click=${()=>this.setMembers(r=>r.filter(l=>l.entity_id!==e.entity_id))}>${f("close")}</button>`}
      <span class="sum">${Ia(e)}</span>
    </div>`}renderBuilderBody(){const e=this.draft,t=this.env;return o`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="members">
        <h4><span class="k when">${f("light",14)}</span>${n("מכשירים")}<small>${e.members.length?e.members.length:n("בחרו מכשירים")}</small></h4>
        <div class="members">${e.members.length?e.members.map((s,i)=>this.row(s,i)):o`<div class="empty" data-members-empty>${n("עדיין לא נבחרו מכשירים")}</div>`}</div>
        ${this.hardReadOnly?c:o`<div class="frow">
          <button class="btn" type="button" data-scene-add @click=${()=>{this.picker={uid:"scene",filter:{purpose:"target",controllable:!0,domains:[...mi]},selected:e.members.map(s=>s.entity_id),multi:!0,apply:s=>this.applyPicked(s)},this.pop=null}}>${f("plus")}${n("הוסף מכשירים")}</button>
          <button class="btn" type="button" data-scene-capture ?disabled=${!e.members.length} @click=${()=>void this.capture(e.members.map(s=>s.entity_id))}>${f("camera")}${n("צלם מצב נוכחי")}</button>
        </div>`}
      </section>
      ${t&&!this.isNew?this.renderDeleteRow():c}`}};Bt.styles=[..._.styles,B`
      .members {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mrow {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        padding: 10px 10px 10px 8px;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
      }
      .mrow.bad {
        border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
      }
      .mrow .who {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1 1 180px;
        min-inline-size: 0;
      }
      .mrow .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      .mrow .nm {
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        min-inline-size: 0;
      }
      .mrow .nm small {
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-medium);
        color: var(--dv-text-2);
      }
      .mrow .vals {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: flex-end;
        flex: 2 1 220px;
      }
      .mrow .vals .fld {
        flex: 1 1 110px;
      }
      .mrow .x {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--dv-text-3);
        display: grid;
        place-items: center;
        font-size: var(--sw-fs-lg);
      }
      .mrow .x:hover {
        background: var(--dv-surface-3);
        color: var(--dv-danger);
      }
      .mrow .sum {
        flex: 1 1 100%;
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
      }
      .empty {
        padding: 22px 12px;
        text-align: center;
        color: var(--dv-text-2);
        border: 1.5px dashed var(--dv-border-strong);
        border-radius: var(--dv-radius-sm, 14px);
        font-weight: var(--sw-fw-semibold);
      }
    `];Bt=Mo([H("scene-editor")],Bt);var Bo=Object.defineProperty,Fo=Object.getOwnPropertyDescriptor,oe=(e,t,s,i)=>{for(var a=i>1?void 0:i?Fo(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Bo(t,s,a),a};let ie=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new Ee(this),this.href="",this.traceHref="",this.now=new Date,this.sensitiveWarning=!0,this.busy=!1,this.picked=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)}}connectedCallback(){super.connectedCallback(),De(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e)}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}act(e){this.setMenu(!1),this.fire("action",{item:this.item,action:e})}menuItems(){const e=this.item,t=(s,i,a,r="",l=!0)=>l?o`<button type="button" role="menuitem" class=${r} data-card-action=${s} @click=${()=>this.act(s)}>${w(i)}${a}</button>`:c;return o`<div class="pop" role="menu" aria-label=${`${$("פעולות")} · ${e.name}`}>
      ${t("edit","edit",$("עריכה"),"",e.can.edit)}
      ${t("run","play",$("הרץ עכשיו"),"",e.can.run)}
      ${t("dryrun","flask",$("בדיקה"))}
      ${t("trace","help",$("למה זה רץ"),"",!!e.last_run)}
      ${t("versions","history",$("גרסאות"),"",e.source==="ui")}
      ${t("copy","copy",$("שכפול"),"",e.can.copy)}
      ${e.can.delete?o`<hr />`:c}
      ${t("delete","trash",$("מחיקה"),"dz",e.can.delete)}
    </div>`}render(){const e=this.item;if(!e)return c;const t=qt(e,this.now),s=Ut(e,{sensitiveWarning:this.sensitiveWarning}),i=Vt(e),a=e.state==="on"||e.state==="running",r=e.can.toggle&&e.state!=="invalid"&&e.state!=="unavailable",l=e.can.edit||e.can.run||e.can.copy||e.can.delete||!!e.last_run||e.source==="ui";return o`<article class=${`acard ${a?"on":"off"}`} data-automation=${e.id} data-state=${e.state} aria-label=${e.name}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.href||"#"} data-card-open>${N(e.name)}</a></h3>
          <div class="where">${w("layers")}<b>${N(Wt(e))}</b>${i?o`<span class="ar">${N(i)}</span>`:c}</div>
        </div>
        <div class="ctl">
          ${r?o`<sw-toggle .checked=${wi(a)} label=${`${a?$("כיבוי"):$("הפעלה")} · ${e.name}`} labelHidden data-card-toggle ?disabled=${this.busy} @change=${ai(a,()=>this.fire("toggle",{item:e,enabled:!a}))}></sw-toggle>`:e.state==="invalid"||e.state==="unavailable"?c:o`<span class=${`chip ${a?"ok":""}`} data-card-state>${a?$("פעילה"):$("כבויה")}</span>`}
          ${l?o`<button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`${$("עוד")} · ${e.name}`} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${w("dots")}</button>`:c}
        </div>
        ${this.menu?this.menuItems():c}
      </header>
      ${e.sentence?o`<p class="sentence-line" data-card-sentence>${e.sentence}</p>`:c}
      <footer>
        <span class="run" data-card-run title=${t.title}><i class=${`dot ${t.tone==="none"?"":t.tone}`}></i>${t.text}</span>
        ${e.last_run&&this.traceHref?o`<a class="why" href=${this.traceHref} data-card-why>${w("help")}${$("למה זה רץ")}</a>`:c}
      </footer>
      ${s.length?o`<div class="chips" data-card-chips>${s.map(d=>o`<span class=${`chip ${d.id==="sensitive"?"sens":d.tone==="bad"?"bad":d.tone==="warn"?"warn":d.tone==="info"?"info":""}`} data-chip=${d.id}>${w(d.id==="sensitive"?"shield":d.id==="locked"?"lock":d.id==="read_only"?"eye":d.id==="changed_outside"?"history":"warning")}${d.label}</span>`)}</div>`:c}
    </article>`}};ie.styles=[Ce,...ye,B`
    :host {
      display: block;
      min-inline-size: 0;
      position: relative;
    }
    :host([data-menu]) {
      z-index: 20;
    }
    .acard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px 14px;
      block-size: 100%;
      box-sizing: border-box;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--dv-shadow-2);
      transition: box-shadow var(--mm-motion) var(--mm-ease), transform var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    /* R5-DEVICES-297: the card is the top step (shadow 2 at rest); hover only for a fine pointer */
    @media (hover: hover) and (pointer: fine) {
      .acard:hover {
        box-shadow: var(--dv-shadow-3, var(--dv-shadow-2));
      }
    }
    .acard:focus-within {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    :host([data-picked]) .acard {
      border-color: var(--dv-accent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard.off .sentence-line {
      color: var(--dv-text-2);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-inline-size: 0;
    }
    .ttl {
      flex: 1;
      min-inline-size: 0;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name {
      color: inherit;
      text-decoration: none;
    }
    a.name::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    a.name:focus-visible {
      outline: none;
    }
    .where {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 8px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      min-inline-size: 0;
    }
    .where b {
      color: var(--dv-text);
      font-weight: 700;
      white-space: nowrap;
    }
    .where .ic {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-3);
    }
    .where .ar {
      min-inline-size: 0;
    }
    .ctl {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 6px;
      flex: none;
    }
    .more {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-2);
    }
    .more:hover,
    .more[aria-expanded='true'] {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .more .ic {
      font-size: var(--sw-fs-2xl);
    }
    .sentence-line {
      margin: 0;
      font-size: var(--sw-fs-md);
      line-height: 1.55;
      color: var(--dv-text);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-block-size: 3.1em;
    }
    footer {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-block-start: auto;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .run {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: var(--dv-text);
    }
    a.why {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--dv-accent-text);
      font-weight: 600;
      text-decoration: none;
      min-block-size: 32px;
      border-radius: var(--sw-r-sm);
    }
    a.why .ic {
      font-size: var(--sw-fs-lg);
    }
    a.why:hover {
      text-decoration: underline;
    }
    a.why:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .chips {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pop {
      background: var(--sw-menu-surface);
      inset-block-start: 52px;
      inset-inline-end: 12px;
      min-inline-size: 190px;
    }
    .pop button.dz {
      color: var(--dv-danger);
    }
    .pop button.dz .ic {
      color: var(--dv-danger);
    }
    @media (pointer: coarse), (max-width: 767px) {
      .more {
        inline-size: 44px;
        block-size: 44px;
      }
      a.why {
        min-block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .acard {
        padding: 14px 16px 12px;
        border-radius: var(--sw-r-2xl);
      }
    }
  `];oe([b({attribute:!1})],ie.prototype,"item",2);oe([b()],ie.prototype,"href",2);oe([b()],ie.prototype,"traceHref",2);oe([b({attribute:!1})],ie.prototype,"now",2);oe([b({type:Boolean})],ie.prototype,"sensitiveWarning",2);oe([b({type:Boolean})],ie.prototype,"busy",2);oe([b({type:Boolean,reflect:!0,attribute:"data-picked"})],ie.prototype,"picked",2);oe([h()],ie.prototype,"menu",2);ie=oe([H("automation-card")],ie);var jo=Object.defineProperty,qo=Object.getOwnPropertyDescriptor,Re=(e,t,s,i)=>{for(var a=i>1?void 0:i?qo(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&jo(t,s,a),a};let ve=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new Ee(this),this.href="",this.now=new Date,this.busy=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)}}connectedCallback(){super.connectedCallback(),De(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e)}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}act(e){this.setMenu(!1),this.fire("action",{item:this.item,action:e})}menuItems(){const e=this.item,t=(s,i,a,r="",l=!0)=>l?o`<button type="button" role="menuitem" class=${r} data-card-action=${s} @click=${()=>this.act(s)}>${w(i)}${a}</button>`:c;return o`<div class="pop" role="menu" aria-label=${`${$("פעולות")} · ${e.name}`}>
      ${t("edit","edit",$("עריכה"),"",e.can.edit)}
      ${t("run","play",$("הרץ עכשיו"),"",e.can.run)}
      ${t("dryrun","flask",$("בדיקה"))}
      ${t("trace","history",$("ריצות אחרונות"),"",!!e.last_run)}
      ${t("versions","history",$("גרסאות"),"",e.source==="ui")}
      ${t("copy","copy",$("שכפול"),"",e.can.copy)}
      ${e.can.delete?o`<hr />`:c}
      ${t("delete","trash",$("מחיקה"),"dz",e.can.delete)}
    </div>`}render(){const e=this.item;if(!e)return c;const t=qt(e,this.now),s=Ut(e).find(d=>d.tone==="bad"),i=Vt(e),a=e.state==="on"||e.state==="running",r=e.can.toggle&&e.state!=="invalid"&&e.state!=="unavailable",l=e.can.edit||e.can.run||e.can.copy||e.can.delete||!!e.last_run||e.source==="ui";return o`<div class=${`ar ${a?"on":"off"}`} role="row" data-automation=${e.id} data-state=${e.state} aria-label=${e.name}>
      <span class="ctl" role="cell">${r?o`<sw-toggle .checked=${wi(a)} label=${`${a?$("כיבוי"):$("הפעלה")} · ${e.name}`} labelHidden data-card-toggle ?disabled=${this.busy} @change=${ai(a,()=>this.fire("toggle",{item:e,enabled:!a}))}></sw-toggle>`:c}</span>
      <span class="who" role="cell"><a class="name" href=${this.href||"#"} data-card-open>${N(e.name)}</a><span class="where"><b>${N(Wt(e))}</b>${i?o` · ${N(i)}`:c}</span></span>
      <span class="sent" role="cell" data-card-sentence title=${e.sentence}>${e.sentence?o`${w("bolt")}<span>${e.sentence}</span>`:c}</span>
      <span class=${`run${s||t.tone==="bad"?" bad":""}`} role="cell" data-card-run title=${s?s.label:t.title}>${s?o`${w("warning")}<span data-chip=${s.id}>${s.label}</span>`:o`<i class=${`dot ${t.tone==="none"?"":t.tone}`}></i>${t.text}`}</span>
      <span class="ops" role="cell">${l?o`<button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`${$("עוד")} · ${e.name}`} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${w("dots")}</button>`:c}${this.menu?this.menuItems():c}</span>
    </div>`}};ve.styles=[Ce,...ye,B`
    /* R5-DEVICES-297: a row is a well (one tone step down, rounded, no hairline) inside the glass list; the name is a heading; an
       automation that is off sits a step deeper; the row sinks on pointer-down (the skin's press scale), hover for a fine pointer only */
    :host {
      display: block;
      position: relative;
      min-inline-size: 0;
      /* GATE-FIX-2270: 1 px apart, 4 px at the list's ends, and the 52 px row: twelve wells fit a 1440 x 900 screen with no scroll (a
         control screen never scrolls - owner rule; the 56 px row with 2 / 6 px margins scrolled the page by 46 px) */
      margin: 1px 6px;
    }
    :host(:first-of-type) {
      margin-block-start: 4px;
    }
    :host(:last-of-type) {
      margin-block-end: 4px;
    }
    :host([data-menu]) {
      z-index: 20;
    }
    .ar {
      position: relative;
      display: grid;
      grid-template-columns: 44px minmax(0, 1.1fr) minmax(0, 1.6fr) minmax(120px, 0.8fr) 40px;
      align-items: center;
      gap: var(--sw-s-3);
      min-block-size: 52px;
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      transition: background-color var(--mm-motion) var(--mm-ease), transform var(--sw-t-fast, 120ms) var(--sw-ease, ease-out);
    }
    .ar.off {
      background: var(--dv-surface-3);
    }
    .ar:active {
      transform: scale(var(--sw-press-scale, 1));
      background: var(--sw-pressed-wash, var(--dv-surface-3));
    }
    @media (hover: hover) and (pointer: fine) {
      .ar:hover {
        background: var(--dv-surface-3);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ar {
        transition-duration: 0.01ms;
      }
    }
    a.name {
      display: block;
      font-weight: 700;
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    a.name:focus-visible {
      outline: none;
    }
    a.name:focus-visible::after {
      outline: var(--sw-focus-w) solid var(--dv-focus);
      outline-offset: -2px;
    }
    .who {
      min-inline-size: 0;
    }
    .where {
      display: block;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .where b {
      color: var(--dv-text);
      font-weight: 600;
    }
    .sent {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      color: var(--dv-text);
    }
    .sent .ic {
      flex: none;
      color: var(--dv-text-3);
    }
    .sent span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ar.off .name,
    .ar.off .sent {
      color: var(--dv-text-2);
    }
    .ar.off .name {
      font-weight: 600;
    }
    .ar.off .sent {
      opacity: 0.7;
    }
    .run {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      font-weight: 600;
      color: var(--dv-text);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .run.bad {
      color: var(--sw-danger-text);
      font-weight: 700;
    }
    .ctl,
    .ops {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
    }
    .ops {
      justify-content: flex-end;
    }
    .more {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-2);
    }
    .more:hover,
    .more[aria-expanded='true'] {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .pop {
      background: var(--sw-menu-surface);
      inset-block-start: 42px;
      inset-inline-end: 0;
      min-inline-size: 190px;
    }
    .pop button.dz,
    .pop button.dz .ic {
      color: var(--dv-danger);
    }
    @media (max-width: 767px) {
      /* POLISH-LEFTOVERS-2341: the phone grid gave the run summary (auto, up to 34vw) the room and cut the name to a few letters at
         320 / 390. The name now owns the whole first line; the place and the last run share the second line (the run capped at
         38vw like the schedule rows' next-run column) - ellipsis only as the last resort. The cell wrapper keeps its DOM (specs read
         .who / .where / [data-card-run]); only its box steps aside so the name and the place line join the row's grid. */
      .ar {
        grid-template-columns: 44px minmax(0, 1fr) minmax(0, max-content) 44px;
        grid-template-areas:
          'ctl name name ops'
          'ctl where run ops';
        column-gap: var(--sw-s-2);
        row-gap: 2px;
        padding-inline: var(--sw-s-3);
        /* the two lines (24 + 2 + 20 px) sit centred in the 56 px row with no block padding: padding grew every phone row to 62 px and
           seven rows plus the pager scrolled the phone by 18-24 px (POLISH2-295 contract: 7 rows and the pager fit, no scroll) */
        padding-block: 0;
        align-content: center;
        min-block-size: 56px;
      }
      .ar > .sent {
        display: none;
      }
      .ctl {
        grid-area: ctl;
      }
      .ops {
        grid-area: ops;
      }
      .who {
        display: contents;
      }
      a.name {
        grid-area: name;
        min-inline-size: 0;
      }
      .where {
        grid-area: where;
        min-inline-size: 0;
      }
      .run {
        grid-area: run;
        justify-self: end;
        max-inline-size: 38vw;
        gap: 5px;
        font-size: var(--sw-fs-sm);
      }
      .more {
        inline-size: 44px;
        block-size: 44px;
      }
    }
  `];Re([b({attribute:!1})],ve.prototype,"item",2);Re([b()],ve.prototype,"href",2);Re([b({attribute:!1})],ve.prototype,"now",2);Re([b({type:Boolean})],ve.prototype,"busy",2);Re([h()],ve.prototype,"menu",2);ve=Re([H("automation-row")],ve);var Uo=Object.defineProperty,Vo=Object.getOwnPropertyDescriptor,J=(e,t,s,i)=>{for(var a=i>1?void 0:i?Vo(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Uo(t,s,a),a};let V=class extends Q{constructor(){super(...arguments),this.name="",this.members=[],this.entities=[],this.phase="idle",this.error="",this.isNew=!0,this.saving=!1,this.readOnly=!1,this.deletable=!1,this.draftName="",this.rows=[],this.picked=[],this.picker=!1,this.q="",this.onOutside=e=>{this.picker&&!e.composedPath().some(t=>t instanceof HTMLElement&&t.classList?.contains("pickwrap"))&&(this.picker=!1)}}willUpdate(e){e.has("members")&&(this.rows=this.members.map(t=>({entity_id:t.entity_id,state:t.state,attributes:{...t.attributes}})),this.picked=this.rows.map(t=>t.entity_id)),e.has("name")&&(this.draftName=this.name)}connectedCallback(){super.connectedCallback(),De(this),window.addEventListener("pointerdown",this.onOutside,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0)}ent(e){return this.entities.find(t=>t.entity_id===e)}nameOf(e){return this.ent(e)?.name??e}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}addDevice(e){this.picked.includes(e)||(this.picked=[...this.picked,e],this.picker=!1,this.rows.length&&this.fire("capture",{entity_ids:[e],merge:!0}))}removeDevice(e){this.picked=this.picked.filter(t=>t!==e),this.rows=this.rows.filter(t=>t.entity_id!==e)}setRow(e,t){this.rows=this.rows.map(s=>s.entity_id===e?La(s,t):s)}merge(e){const t=new Set(this.rows.map(s=>s.entity_id));this.rows=[...this.rows,...e.filter(s=>!t.has(s.entity_id)).map(s=>({entity_id:s.entity_id,state:s.state,attributes:{...s.attributes}}))]}capturable(){const e=oi(this.entities,Pa,{domains:mi,controllable:!0}),t=this.q.trim();return t?e.filter(s=>`${s.name} ${s.area?.name??""}`.includes(t)):e}picklist(){const e=li(this.capturable().filter(t=>!this.picked.includes(t.entity_id)));return o`<div class="pop" role="listbox" aria-label=${$("בחירת מכשירים")} data-scene-picker>
      <input class="inp srch" type="search" placeholder=${$("חיפוש מכשיר")} aria-label=${$("חיפוש מכשיר")} .value=${this.q} @input=${t=>this.q=t.target.value} />
      ${e.length?e.map(t=>t.areas.map(s=>o`<div class="gh">${N([t.floor?.name,s.area?.name].filter(Boolean).join(" · ")||$("כל הבית"))}</div>${s.entities.map(i=>o`<button type="button" role="option" data-pick=${i.entity_id} @click=${()=>this.addDevice(i.entity_id)}>${w(gt(i.entity_id))}${N(i.name)}</button>`)}`)):o`<div class="gh">${$("אין עוד מכשירים")}</div>`}
    </div>`}stateCell(e){const t=Ma[Ba(e.entity_id)]??Fa,s=t.some(i=>i.value===e.state)?t:[...t,{value:e.state,label:e.state}];return o`<select class="inp" aria-label=${`${$("מצב")} · ${this.nameOf(e.entity_id)}`} data-row-state=${e.entity_id} ?disabled=${this.readOnly} @change=${i=>this.setRow(e.entity_id,{state:i.target.value})}>${s.map(i=>o`<option value=${i.value} ?selected=${i.value===e.state}>${i.label}</option>`)}</select>`}valuesCell(e){const t=ja(e);return t.length?o`<div class="vals">${t.map(s=>{const i=e.attributes[s.key],a=typeof i=="number"?s.toUi?s.toUi(i):i:"";return o`<label class="num"><small>${s.unit}</small><input type="number" inputmode="decimal" min=${s.min} max=${s.max} step=${s.step} .value=${String(a)} aria-label=${`${s.key} · ${this.nameOf(e.entity_id)}`} data-row-attr=${`${e.entity_id}:${s.key}`} ?disabled=${this.readOnly} @change=${r=>{const l=r.target.value;this.setRow(e.entity_id,{attr:{key:s.key,ui:l===""?null:Math.min(s.max,Math.max(s.min,Number(l)))}})}} /></label>`})}</div>`:o`<span class="none">—</span>`}table(){return o`<table data-scene-table>
      <thead><tr><th>${$("מכשיר")}</th><th>${$("מצב")}</th><th>${$("ערכים שנלכדו")}</th><th></th></tr></thead>
      <tbody>${this.rows.map(e=>{const t=this.ent(e.entity_id);return o`<tr data-scene-row=${e.entity_id}>
          <td class="dev"><span class="ico">${w(gt(e.entity_id))}</span><span><b>${N(this.nameOf(e.entity_id))}</b><small>${N(t?.area?.name??t?.floor?.name??"")}</small></span></td>
          <td class="st">${this.stateCell(e)}</td>
          <td class="vl">${this.valuesCell(e)}</td>
          <td class="rm">${this.readOnly?c:o`<button type="button" class="x" aria-label=${`${$("הסרה")} · ${this.nameOf(e.entity_id)}`} data-row-remove=${e.entity_id} @click=${()=>this.removeDevice(e.entity_id)}>${w("close")}</button>`}</td>
        </tr>`})}</tbody>
    </table>`}render(){const e=this.rows.length>0,t=!!this.draftName.trim()&&e&&!this.saving&&!this.readOnly;return o`
      <input class="nm" type="text" maxlength="120" .value=${this.draftName} placeholder=${$("שם הסצנה")} aria-label=${$("שם הסצנה")} data-scene-name ?disabled=${this.readOnly} @input=${s=>this.draftName=s.target.value} />
      <div class="devs">
        <h4>${w("layers")}${$("מכשירים")} <span>${this.picked.length}</span></h4>
        <div class="chipsrow" data-scene-devices>
          ${this.picked.map(s=>o`<span class="dchip" data-device-chip=${s}>${w(gt(s))}<span>${N(this.nameOf(s))}${this.ent(s)?.area?o` <small>${N(this.ent(s).area.name)}</small>`:c}</span>${this.readOnly?c:o`<button type="button" aria-label=${`${$("הסרה")} · ${this.nameOf(s)}`} @click=${()=>this.removeDevice(s)}>${w("close")}</button>`}</span>`)}
          ${this.readOnly?c:o`<span class="pickwrap"><button type="button" class="addchip" data-scene-add aria-haspopup="listbox" aria-expanded=${String(this.picker)} @click=${()=>this.picker=!this.picker}>${w("plus")}${$("עוד")}</button>${this.picker?this.picklist():c}</span>`}
        </div>
      </div>
      ${this.phase==="done"?o`<div class="state-banner" role="status" data-scene-captured>${w("check")}${$("נלכד")}<button type="button" class="btn sm" data-scene-recapture @click=${()=>this.fire("capture",{entity_ids:this.picked,merge:!1})}>${$("צלם שוב")}</button></div>`:this.phase==="error"?o`<div class="state-banner bad" role="alert" data-scene-error>${w("warning")}${this.error||$("הצילום נכשל")}<button type="button" class="btn sm" @click=${()=>this.fire("capture",{entity_ids:this.picked,merge:!1})}>${$("נסו שוב")}</button></div>`:this.readOnly?c:o`<button type="button" class="btn primary capbtn" data-scene-capture ?disabled=${!this.picked.length||this.phase==="busy"} @click=${()=>this.fire("capture",{entity_ids:this.picked,merge:!1})}>${w("camera")}${this.phase==="busy"?$("מצלם…"):e?$("צלם שוב"):$("צלם מצב נוכחי")}</button>`}
      ${e?this.table():c}
      ${this.readOnly?c:o`<div class="bar"><button type="button" class="btn primary" data-scene-save ?disabled=${!t} @click=${()=>this.fire("save",{name:this.draftName.trim(),members:this.rows})}>${w("check")}${$("שמירה")}</button><button type="button" class="btn" data-scene-cancel @click=${()=>this.fire("cancel")}>${$("ביטול")}</button>${this.deletable?o`<span class="grow"></span><button type="button" class="btn quiet dz" data-scene-delete @click=${()=>this.fire("delete")}>${w("trash")}${$("מחיקה")}</button>`:c}</div>`}
    `}};V.styles=[...ye,B`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-inline-size: 0;
    }
    .nm {
      font: inherit;
      font-size: var(--sw-fs-3xl);
      font-weight: 700;
      letter-spacing: -0.02em;
      border: 0;
      border-block-end: 1px dashed var(--dv-border);
      background: transparent;
      color: var(--dv-text);
      padding: 4px 0 8px;
      min-block-size: 44px;
      inline-size: 100%;
      box-sizing: border-box;
    }
    .nm:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
      border-radius: var(--sw-r-xs);
    }
    .devs h4 {
      margin: 0 0 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-base);
      font-weight: 600;
      color: var(--dv-text-2);
    }
    .chipsrow {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .dchip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
      padding-inline: 12px 6px;
      border-radius: var(--dv-radius-control);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      font-size: var(--sw-fs-base);
      font-weight: 600;
    }
    .dchip small {
      color: var(--dv-text-2);
      font-weight: 500;
    }
    .dchip .ic {
      font-size: var(--sw-fs-lg);
      color: var(--dv-text-2);
    }
    .dchip button {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--dv-text-2);
    }
    .dchip button:hover {
      background: var(--dv-surface-3);
    }
    .addchip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px dashed var(--dv-accent);
      background: transparent;
      color: var(--dv-accent-text);
      font-weight: 600;
      font-size: var(--sw-fs-base);
    }
    .pickwrap {
      position: relative;
    }
    .pop {
      background: var(--sw-menu-surface);
      inset-block-start: calc(100% + 6px);
      inset-inline-start: 0;
      min-inline-size: min(320px, 90vw);
      max-block-size: 320px;
    }
    .pop .gh {
      padding: 8px 10px 2px;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--dv-text-2);
    }
    .pop .srch {
      margin: 4px 4px 6px;
    }
    .state-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--dv-radius-md);
      background: var(--dv-success-soft);
      color: var(--au-ok-text);
      font-weight: 700;
      font-size: var(--sw-fs-md);
    }
    .state-banner.bad {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .state-banner .btn {
      margin-inline-start: 6px;
    }
    .capbtn {
      inline-size: 100%;
      justify-content: center;
      min-block-size: 52px;
      font-size: var(--sw-fs-lg);
    }
    table {
      inline-size: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: var(--dv-radius-md);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface);
      overflow: hidden;
    }
    th {
      text-align: start;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--dv-text-2);
      padding: 10px 12px;
      background: var(--dv-surface-3);
    }
    td {
      padding: 10px 12px;
      border-block-start: 1px solid var(--dv-border);
      vertical-align: middle;
      font-size: var(--sw-fs-md);
    }
    td.dev {
      display: flex;
      align-items: center;
      gap: 10px;
      border-block-start: 0;
    }
    tr + tr td.dev {
      border-block-start: 0;
    }
    .ico {
      display: grid;
      place-items: center;
      inline-size: 34px;
      block-size: 34px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .ico .ic {
      font-size: var(--sw-fs-xl);
    }
    th:first-child,
    td.dev {
      inline-size: 40%;
      min-inline-size: 150px;
    }
    td.dev b {
      display: block;
      font-weight: 600;
    }
    td.dev small {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    td .inp {
      min-block-size: 40px;
      inline-size: 100%;
      max-inline-size: 118px;
    }
    .vals {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .num {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding-inline: 10px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      max-inline-size: 108px;
    }
    .num input {
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--dv-text);
      inline-size: 100%;
      min-inline-size: 0;
      text-align: end;
      font-variant-numeric: tabular-nums;
      min-block-size: 36px;
    }
    .num input:focus-visible {
      outline: none;
    }
    .num:focus-within {
      outline: 2px solid var(--dv-focus);
    }
    .num small {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .none {
      color: var(--dv-text-3);
    }
    .x {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--dv-text-2);
    }
    .x:hover {
      background: var(--dv-surface-3);
      color: var(--dv-danger);
    }
    .bar {
      position: sticky;
      inset-block-end: 0;
      display: flex;
      gap: 8px;
      padding: 10px 0 2px;
      background: linear-gradient(to top, var(--mm-sheet-surface, var(--dv-surface-solid)) 70%, transparent);
      margin-block-start: 8px;
    }
    @media (max-width: 767px) {
      table,
      thead,
      tbody,
      tr,
      td {
        display: block;
      }
      thead {
        display: none;
      }
      tr {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px 10px;
        padding: 10px 12px;
        border-block-start: 1px solid var(--dv-border);
      }
      tr:first-child {
        border-block-start: 0;
      }
      td {
        border: 0;
        padding: 0;
      }
      td.dev {
        grid-column: 1;
      }
      td.rm {
        grid-column: 2;
        grid-row: 1;
      }
      td.st,
      td.vl {
        grid-column: 1 / -1;
      }
      td .inp {
        max-inline-size: none;
      }
    }
  `];J([b()],V.prototype,"name",2);J([b({attribute:!1})],V.prototype,"members",2);J([b({attribute:!1})],V.prototype,"entities",2);J([b()],V.prototype,"phase",2);J([b()],V.prototype,"error",2);J([b({type:Boolean})],V.prototype,"isNew",2);J([b({type:Boolean})],V.prototype,"saving",2);J([b({type:Boolean})],V.prototype,"readOnly",2);J([b({type:Boolean})],V.prototype,"deletable",2);J([h()],V.prototype,"draftName",2);J([h()],V.prototype,"rows",2);J([h()],V.prototype,"picked",2);J([h()],V.prototype,"picker",2);J([h()],V.prototype,"q",2);V=J([H("scene-capture")],V);var Wo=Object.defineProperty,Ho=Object.getOwnPropertyDescriptor,L=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ho(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Wo(t,s,a),a};let I=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new Ee(this),this.items=[],this.hiddenItems=[],this.status=null,this.now=new Date,this.sceneId="",this.filtered=!1,this.done=new Set,this.busy=new Set,this.showHidden=!1,this.detail=null,this.entities=[],this.phase="idle",this.capError="",this.saving=!1,this.editorError="",this.conflict=!1,this.confirmDelete=!1,this.members=[],this.editorName="",this.loadedId="__none__"}connectedCallback(){super.connectedCallback(),De(this)}willUpdate(e){e.has("sceneId")&&this.sceneId!==this.loadedId&&(this.loadedId=this.sceneId,this.conflict=!1,this.editorError="",this.phase="idle",this.confirmDelete=!1,this.sceneId?this.openEditor():this.detail=null)}fire(e,t){this.isConnected&&this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}say(e,t="ok",s){this.fire("result",{text:e,tone:t,action:s})}async activate(e){if(!this.busy.has(e.id)){this.busy=new Set([...this.busy,e.id]);try{await Aa(e.id),this.done=new Set([...this.done,e.id]),window.setTimeout(()=>this.done=new Set([...this.done].filter(t=>t!==e.id)),2200),this.fire("changed",{id:e.id})}catch(t){this.say(j(t).message,"error")}finally{this.busy=new Set([...this.busy].filter(t=>t!==e.id))}}}async meta(e,t){try{await ee().setMeta("scene",e.id,t),this.fire("changed",{id:e.id})}catch(s){this.say(j(s).message,"error")}}card(e,t=!1){const s=!qa(e),i=this.done.has(e.id),a=this.status?.counts.hidden!==null&&this.status?.counts.hidden!==void 0;return o`<article class=${`scard${t?" hid":""}`} data-scene=${e.id} data-scene-kind=${s?"native":"device"}>
      <div class="top">
        <span class=${`ico${s?" mine":""}`}>${w(s?"camera":"sparkle")}</span>
        ${s?o`<span class="badge mine" data-scene-badge>${w("edit")}${n("ניתנת לעריכה")}</span>`:o`<span class="badge" data-scene-badge>${n("הפעלה בלבד")}</span>`}
        <span style="flex:1"></span>
        ${a&&!s?o`<button type="button" class="eyeb" aria-label=${`${t?n("הצגה"):n("הסתרה")} · ${e.name}`} title=${t?n("הצגה"):n("הסתרה")} data-scene-hide @click=${()=>void this.meta(e,{hidden:!t})}>${w(t?"eye":"eyeOff")}</button>`:c}
        <button type="button" class="star" aria-pressed=${String(e.favourite)} aria-label=${`${n("מועדף")} · ${e.name}`} title=${n("מועדף")} data-scene-fav @click=${()=>void this.meta(e,{favourite:!e.favourite})}>${w("star")}</button>
      </div>
      <h3>${N(e.name)}</h3>
      <div class="sub" data-scene-sub>${Ua(e,this.now,void 0,s&&e.targets.length||void 0)}</div>
      <div class="acts">
        <button type="button" class=${`btn primary${i?" ok":""}`} data-scene-activate ?disabled=${this.busy.has(e.id)||t} @click=${()=>void this.activate(e)}>${i?w("check"):w("play")}${i?n("הופעלה"):n("הפעל")}</button>
        ${s&&e.can.edit?o`<button type="button" class="btn" data-scene-edit @click=${()=>this.fire("open-scene",{id:e.id})}>${w("edit")}${n("עריכה")}</button>`:c}
      </div>
    </article>`}async openEditor(){this.members=[],this.editorName="",this.detail=null;try{const e=await ee().catalog();this.entities=e.entities}catch{this.entities=[]}if(this.sceneId!=="new")try{const e=await ee().get("scene",this.sceneId);this.detail=e;const t=e.draft;this.members=t.members??[],this.editorName=t.name||e.name,this.entities.length||(this.entities=t.members.map(s=>({entity_id:s.entity_id,name:s.entity_id,domain:s.entity_id.split(".")[0],floor:null,area:null,class:null,state:null,missing:!1,triggers:[],actions:[]})))}catch(e){const t=j(e);this.say(t.message,"error"),this.fire("close-scene")}}async onCapture(e){const{entity_ids:t,merge:s}=e.detail;this.phase="busy",this.capError="";try{const i=await ee().capture({entity_ids:t});s?(this.capture?.merge(i.members),this.phase="done"):(this.members=i.members,this.phase="done")}catch(i){this.capError=j(i).message,this.phase="error"}}async onSave(e){if(this.saving)return;this.saving=!0,this.editorError="";const t={name:e.detail.name,icon:this.detail?this.detail.draft.icon:null,members:e.detail.members};try{this.detail?await ui("scene",this.detail.id,t,this.detail.revision):await pi("scene",t,{enabled:!0}),this.say(n("נשמר")),this.fire("changed",{}),this.fire("close-scene")}catch(s){const i=j(s);i.kind==="conflict"&&(this.conflict=!0),this.editorError=i.message}finally{this.saving=!1}}async doDelete(){const e=this.detail;if(e)try{const t=await fi("scene",e.id,e.revision,{confirm:!0});this.confirmDelete=!1,this.fire("changed",{}),this.fire("close-scene"),this.say(n('"{name}" נמחקה',{name:e.name}),"ok",{label:n("שחזור"),run:()=>void ee().restoreTrash(t.trash_id,{client_request_id:`undo-${t.trash_id}`}).then(()=>this.fire("changed",{})).catch(s=>this.say(j(s).message,"error"))})}catch(t){this.confirmDelete=!1,this.editorError=j(t).message}}editor(){const e=!!this.sceneId,t=this.detail?N(this.detail.name):n("סצנה חדשה");return o`<sw-drawer modal .open=${e} heading=${t} subheading=${this.detail?n("ניתנת לעריכה"):n("סצנה חדשה")} @close=${()=>this.fire("close-scene")}>
      ${e?o`<div class="sheetbody">
        ${this.conflict?o`<div class="banner warn" role="alert">${w("warning")}<div><b>${n("הסצנה שונתה במקום אחר")}</b></div><button type="button" class="btn sm" @click=${()=>{this.conflict=!1,this.openEditor()}}>${n("טען מחדש")}</button></div>`:c}
        ${this.editorError&&!this.conflict?o`<div class="banner bad" role="alert">${w("warning")}${this.editorError}</div>`:c}
        <scene-capture .name=${this.editorName} .members=${this.members} .entities=${this.entities} .phase=${this.phase} .error=${this.capError} .saving=${this.saving} .deletable=${!!this.detail&&!!this.detail.can.delete} .readOnly=${!!this.detail&&!this.detail.can.edit}
          @capture=${s=>void this.onCapture(s)} @save=${s=>void this.onSave(s)} @cancel=${()=>this.fire("close-scene")} @delete=${()=>this.confirmDelete=!0}></scene-capture>
      </div>`:c}
      ${this.confirmDelete&&this.detail?o`<sw-dialog open heading=${n('למחוק את "{name}"?',{name:this.detail.name})} data-dialog="delete-scene" @close=${()=>this.confirmDelete=!1}><div class="dlgform"><p>${n("הסצנה תישמר בסל המחזור וניתן לשחזר אותה.")}</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirmDelete=!1}>${n("ביטול")}</button><button type="button" class="btn danger" data-dialog-ok @click=${()=>void this.doDelete()}>${n("מחיקה")}</button></div></div></sw-dialog>`:c}
    </sw-drawer>`}render(){const e=Va(this.items),t=this.hiddenItems.length?this.hiddenItems:gi(this.items);return o`<div class="groups" data-scenes-panel>
      ${e.map(s=>o`<section data-scene-group=${s.id}>
        <header class="sh"><div><h2>${N(s.title)}</h2>${s.sub?o`<small>${s.sub}</small>`:c}</div></header>
        <div class="grid">${s.items.map(i=>this.card(i))}</div>
      </section>`)}
      ${t.length&&this.status?.counts.hidden!==null?o`<section data-scene-group="hidden">
        <div class="hid-row"><button type="button" class="btn sm quiet" data-scene-hidden-toggle aria-expanded=${String(this.showHidden)} @click=${()=>this.showHidden=!this.showHidden}>${w("eyeOff")}${n("מוסתרות")} <span>${t.length}</span></button></div>
        ${this.showHidden?o`<div class="grid" style="margin-block-start:12px">${t.map(s=>this.card(s,!0))}</div>`:c}
      </section>`:c}
    </div>
    ${this.editor()}`}};I.styles=[Ce,...ye,B`
    :host {
      display: block;
    }
    sw-drawer {
      --sw-drawer-modal-w: 560px;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .groups {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .sh {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      padding-inline: 4px;
      margin-block-end: 12px;
    }
    .sh h2 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.025em;
    }
    .sh small {
      display: block;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: start;
    }
    .scard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px 16px;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--dv-shadow-2);
    }
    .scard.hid {
      opacity: 0.7;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
    }
    .ico {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .ico.mine {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .ico .ic {
      font-size: var(--sw-fs-2xl);
    }
    .badge {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      padding: 5px 11px;
      border-radius: 999px;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      white-space: nowrap;
    }
    .badge.mine {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .badge .ic {
      font-size: var(--sw-fs-sm);
    }
    .star,
    .eyeb {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-3);
    }
    .star:hover,
    .eyeb:hover {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .star[aria-pressed='true'] {
      color: #ff9f0a;
    }
    .star[aria-pressed='true'] .ic {
      fill: currentColor;
    }
    .star .ic,
    .eyeb .ic {
      font-size: var(--sw-fs-xl);
    }
    /* hiding a scene of a device is an administrator's chore: with a mouse the control shows on hover or focus, not on every card;
       a touch screen has no hover, so it stays reachable there (quiet, like the star) - otherwise nobody could unhide a scene on a phone */
    @media (hover: hover) and (pointer: fine) {
      .eyeb {
        opacity: 0;
      }
      .scard:hover .eyeb,
      .eyeb:focus-visible,
      .scard.hid .eyeb {
        opacity: 1;
      }
    }
    /* R5-DEVICES-297: the scene's name is the card's heading (2xl/800); the section title above the group stays as it was */
    h3 {
      margin: 6px 0 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .sub {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      min-block-size: 1.3em;
    }
    .acts {
      display: flex;
      gap: 8px;
      margin-block-start: 10px;
      flex-wrap: wrap;
    }
    .acts .btn.primary {
      min-inline-size: 104px;
      justify-content: center;
    }
    .acts .btn.ok {
      background: var(--dv-success);
      color: #fff;
      border-color: transparent;
      box-shadow: none;
    }
    .hid-row {
      display: flex;
      justify-content: center;
      margin-block-start: 6px;
    }
    .sheetbody {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    ${ni}
  `];L([b({attribute:!1})],I.prototype,"items",2);L([b({attribute:!1})],I.prototype,"hiddenItems",2);L([b({attribute:!1})],I.prototype,"status",2);L([b({attribute:!1})],I.prototype,"now",2);L([b()],I.prototype,"sceneId",2);L([b({type:Boolean})],I.prototype,"filtered",2);L([h()],I.prototype,"done",2);L([h()],I.prototype,"busy",2);L([h()],I.prototype,"showHidden",2);L([h()],I.prototype,"detail",2);L([h()],I.prototype,"entities",2);L([h()],I.prototype,"phase",2);L([h()],I.prototype,"capError",2);L([h()],I.prototype,"saving",2);L([h()],I.prototype,"editorError",2);L([h()],I.prototype,"conflict",2);L([h()],I.prototype,"confirmDelete",2);L([h()],I.prototype,"members",2);L([h()],I.prototype,"editorName",2);L([ct("scene-capture")],I.prototype,"capture",2);I=L([H("scenes-panel")],I);var Go=Object.defineProperty,Yo=Object.getOwnPropertyDescriptor,le=(e,t,s,i)=>{for(var a=i>1?void 0:i?Yo(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Go(t,s,a),a};let ae=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new Ee(this),this.items=[],this.status=null,this.now=new Date,this.withFields=new Set,this.hrefOf=()=>"#",this.sensitiveWarning=!0,this.busy=new Set,this.confirm=null}connectedCallback(){super.connectedCallback(),De(this)}fire(e,t){this.isConnected&&this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}say(e,t="ok"){this.fire("result",{text:e,tone:t})}async run(e,t=!1){if(!this.busy.has(e.id)){if(this.withFields.has(e.id))return void this.fire("open-script",{id:e.id});if(!t&&Nt(e)){this.confirm=e;return}this.confirm=null,this.busy=new Set([...this.busy,e.id]);try{await hi(e.id,{},{confirm:t||void 0}),this.say(n("הסקריפט הופעל")),this.fire("changed",{id:e.id})}catch(s){const i=j(s);i.kind==="confirm"&&!t?this.confirm=e:this.say(i.message,"error")}finally{this.busy=new Set([...this.busy].filter(s=>s!==e.id))}}}async stop(e){if(!this.busy.has(e.id)){this.busy=new Set([...this.busy,e.id]);try{await Na(e.id),this.say(n("הסקריפט נעצר")),this.fire("changed",{id:e.id})}catch(t){this.say(j(t).message,"error")}finally{this.busy=new Set([...this.busy].filter(t=>t!==e.id))}}}card(e){const t=e.state==="running",s=qt(e,this.now),i=Ut(e,{sensitiveWarning:this.sensitiveWarning}).filter(l=>l.id!=="read_only"),a=this.withFields.has(e.id),r=Vt(e);return o`<article class=${`pcard${t?" running":""}`} data-script=${e.id} data-state=${e.state}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.hrefOf(e.id)} data-script-open>${N(e.name)}</a>${t?o`<span class="chip live" data-script-running>${w("play")}${n("רץ עכשיו")}</span>`:c}</h3>
          <div class="where">${w("layers")}<b>${N(Wt(e))}</b>${r?o`<span>${N(r)}</span>`:c}</div>
        </div>
        <div class="go">
          ${t&&e.can.run?o`<button type="button" class="btn danger" data-script-stop ?disabled=${this.busy.has(e.id)} @click=${()=>void this.stop(e)}>${w("stop")}${n("עצור")}</button>`:e.can.run?o`<button type="button" class="btn primary" data-script-run ?disabled=${this.busy.has(e.id)} @click=${()=>void this.run(e)}>${w("play")}${a?n("הפעל…"):n("הפעל")}</button>`:c}
        </div>
      </header>
      ${e.sentence?o`<p data-script-sentence>${e.sentence}</p>`:c}
      <footer>
        <span class="runl" data-script-runline><i class=${`dot ${s.tone==="none"?"":s.tone}`}></i>${s.text}</span>
        ${i.map(l=>o`<span class=${`chip ${l.id==="sensitive"?"sens":l.tone==="bad"?"bad":l.tone==="warn"?"warn":""}`} data-chip=${l.id}>${w(l.id==="sensitive"?"shield":l.id==="locked"?"lock":"warning")}${l.label}</span>`)}
      </footer>
    </article>`}render(){const e=this.confirm;return o`<div class="grid" data-scripts-panel>${this.items.map(t=>this.card(t))}</div>
      ${e?o`<sw-dialog open heading=${n("להפעיל עכשיו?")} data-dialog="run-script" @close=${()=>this.confirm=null}><div class="dlgform">${at(e)?o`<p>${at(e)}</p>`:c}<div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${n("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.run(e,!0)}>${n("הפעל")}</button></div></div></sw-dialog>`:c}`}};ae.styles=[Ce,...ye,B`
    :host {
      display: block;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: start;
    }
    .pcard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 18px 14px;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--dv-shadow-2);
    }
    .pcard.running {
      border-color: var(--dv-accent);
      box-shadow: var(--dv-shadow-2), 0 0 0 4px var(--dv-accent-soft);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .ttl {
      flex: 1;
      min-inline-size: 0;
    }
    /* R5-DEVICES-297: the script's name is the card's heading (2xl/800) */
    h3 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    a.name {
      color: inherit;
      text-decoration: none;
    }
    a.name::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    a.name:focus-visible {
      outline: none;
    }
    .pcard:focus-within {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .where {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 8px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .where b {
      color: var(--dv-text);
      font-weight: var(--sw-fw-bold);
    }
    .where .ic {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-3);
    }
    .go {
      position: relative;
      z-index: 2;
      flex: none;
    }
    .go .btn {
      min-inline-size: 96px;
      justify-content: center;
    }
    p {
      margin: 0;
      font-size: var(--sw-fs-md);
      line-height: 1.55;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-block-size: 3.1em;
    }
    footer {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .runl {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-weight: var(--sw-fw-semibold);
      color: var(--dv-text);
    }
    .chip.live {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      min-block-size: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
      display: block;
    }
    ${ni}
  `];le([b({attribute:!1})],ae.prototype,"items",2);le([b({attribute:!1})],ae.prototype,"status",2);le([b({attribute:!1})],ae.prototype,"now",2);le([b({attribute:!1})],ae.prototype,"withFields",2);le([b({attribute:!1})],ae.prototype,"hrefOf",2);le([b({type:Boolean})],ae.prototype,"sensitiveWarning",2);le([h()],ae.prototype,"busy",2);le([h()],ae.prototype,"confirm",2);ae=le([H("scripts-panel")],ae);var Ko=Object.defineProperty,Jo=Object.getOwnPropertyDescriptor,M=(e,t,s,i)=>{for(var a=i>1?void 0:i?Jo(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Ko(t,s,a),a};const Xo={is_true:n("כן"),is_false:n("לא"),gt:">",ge:"≥",lt:"<",le:"≤",eq:"=",ne:"≠",between:n("בין"),outside:n("מחוץ ל"),in_set:n("אחד מ")},Js={TRUE:{mark:"✓",cls:"t"},FALSE:{mark:"✗",cls:"f"},UNKNOWN:{mark:"?",cls:"u"}},Dt=()=>({when:{op:"and",items:[]},actions:[{type:"notify",to:{roles:[],users:[]}}],options:{}});let P=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new Ee(this),this.status=null,this.scenarioId="",this.list=null,this.failed=!1,this.cat=null,this.choices=null,this.page=0,this.pageSize=6,this.editing=null,this.draft=Dt(),this.name="",this.description="",this.dry=null,this.runs=[],this.sim=!1,this.simValues={},this.errors=[],this.busy=!1,this.dialog="",this.view="edit",this.loadedId="__none__"}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(()=>this.fit()),this.ro.observe(this),this.load()}disconnectedCallback(){this.ro?.disconnect(),super.disconnectedCallback()}fit(){const e=this.clientWidth||900,t=(this.clientHeight||520)-60,s=Math.max(1,Math.floor((e+12)/292)),i=Math.max(1,Math.floor((t+12)/130)),a=s*i;a!==this.pageSize&&(this.pageSize=a,this.page=0)}say(e,t="ok"){this.dispatchEvent(new CustomEvent("result",{detail:{text:e,tone:t},bubbles:!0,composed:!0}))}async load(){try{const[e,t]=await Promise.all([on(),this.cat?Promise.resolve(this.cat):ln()]);this.list=e.scenarios,this.cat=t,this.failed=!1}catch{this.failed=!0}this.status?.can.manage&&!this.choices&&dn().then(e=>this.choices=e).catch(()=>{})}updated(e){e.has("scenarioId")&&this.scenarioId!==this.loadedId&&this.openEditor(this.scenarioId)}async openEditor(e){if(this.loadedId=e,this.dry=null,this.errors=[],this.sim=!1,this.simValues={},this.view="edit",this.runs=[],!e){this.editing=null;return}if(e==="new"){this.editing={id:"",name:"",description:"",enabled:!1,version:0,state:"off"},this.name="",this.description="",this.draft=Dt();return}try{const t=await Ss(e);this.editing=t,this.name=t.name,this.description=t.description,this.draft=t.definition?structuredClone(t.definition):Dt(),this.draft.options=this.draft.options??{}}catch{this.say(v("loadError"),"error"),this.close()}}close(){this.dispatchEvent(new CustomEvent("close-scenario",{bubbles:!0,composed:!0}))}open(e){this.dispatchEvent(new CustomEvent("open-scenario",{detail:{id:e},bubbles:!0,composed:!0}))}sig(e){return this.cat?.signals.find(t=>t.id===e)}setAt(e,t){const s=(a,r)=>{if(!r.length)return t(a);if($t(a)){const l=a.items.map((d,p)=>p===r[0]?s(d,r.slice(1)):d).filter(d=>d!==null);return{...a,items:l}}if(yt(a)){const l=s(a.item,r.slice(1));return l===null?null:{...a,item:l}}return a},i=s(this.draft.when,e)??{op:"and",items:[]};this.draft={...this.draft,when:i},this.dry=null}addLeaf(e){const t=this.cat?.signals[0];t&&this.setAt(e,s=>$t(s)?{...s,items:[...s.items,Os(t)]}:s)}addGroup(e){this.setAt(e,t=>$t(t)?{...t,items:[...t.items,{op:t.op==="and"?"or":"and",items:[]}]}:t)}leafRow(e,t,s,i){const a=this.sig(e.signal),r=u=>this.setAt(t,m=>({...m,...u})),l=this.cat?.signals??[],d=[...new Set(l.map(u=>u.module_label))],p=u=>u===""?void 0:Number(u);return o`<div class="leaf" data-leaf=${s}>
      ${i?o`<span class=${`tri ${Js[i.result].cls}`} title=${i.reason??""}>${Js[i.result].mark}</span>`:c}
      <select aria-label=${v("signal")} @change=${u=>{const m=this.sig(u.target.value);m&&this.setAt(t,()=>Os(m))}}>
        ${d.map(u=>o`<optgroup label=${u}>${l.filter(m=>m.module_label===u).map(m=>o`<option value=${m.id} ?selected=${m.id===e.signal}>${m.label}</option>`)}</optgroup>`)}
      </select>
      ${a&&a.subject!=="none"&&a.subject!=="window"?a.subject==="flag"?o`<input aria-label=${v("flagName")} .value=${e.subject??""} pattern="[a-z][a-z0-9_]{1,39}" @change=${u=>r({subject:u.target.value.trim()})} />`:o`<select aria-label=${v("subject")} @change=${u=>r({subject:u.target.value})}>${a.subjects.map(u=>o`<option value=${u.id} ?selected=${u.id===e.subject}>${N(u.name)}</option>`)}</select>`:c}
      ${a?.subject==="window"&&e.window?this.windowEditor(e,r):c}
      ${a?o`<select aria-label=${n("השוואה")} @change=${u=>{const m=u.target.value;r({cmp:m,value:m==="between"||m==="outside"?[2,8]:m==="is_true"||m==="is_false"?void 0:typeof e.value=="number"?e.value:0})}}>
        ${cn(a.kind).map(u=>o`<option value=${u} ?selected=${u===e.cmp}>${Xo[u]}</option>`)}</select>`:c}
      ${a&&(a.kind==="number"||a.kind==="count")&&!Array.isArray(e.value)&&e.cmp!=="is_true"&&e.cmp!=="is_false"?o`<input type="number" aria-label=${v("value")} .value=${String(e.value??"")} step=${a.kind==="count"?"1":"0.1"} @change=${u=>r({value:Number(u.target.value)})} />${a.unit?o`<span class="hint">${a.unit}</span>`:c}`:c}
      ${Array.isArray(e.value)?o`<input type="number" class="sm" aria-label=${n("מ")} .value=${String(e.value[0])} @change=${u=>r({value:[Number(u.target.value),Number(e.value[1])]})} />–<input type="number" class="sm" aria-label=${n("עד")} .value=${String(e.value[1])} @change=${u=>r({value:[Number(e.value[0]),Number(u.target.value)]})} />`:c}
      <label class="hint">${v("holdFor")} <input type="number" class="sm" min="0" .value=${String(e.hold_s??"")} @change=${u=>r({hold_s:p(u.target.value)})} /></label>
      ${a?.kind==="bool"?o`<label class="hint">${v("debounce")} <input type="number" class="sm" min="0" .value=${String(e.debounce_s??"")} placeholder=${String(a.default_debounce_s)} @change=${u=>r({debounce_s:p(u.target.value)})} /></label>`:c}
      ${a&&(a.kind==="number"||a.kind==="count")&&["gt","ge","lt","le"].includes(e.cmp)?o`<label class="hint">${v("margin")} <input type="number" class="sm" min="0" step="0.1" .value=${String(e.hysteresis?.clear_margin??"")} placeholder=${String(a.default_margin)} @change=${u=>{const m=p(u.target.value);r({hysteresis:m===void 0?void 0:{clear_margin:m}})}} /></label>`:c}
      ${this.sim?o`<label class="hint">${v("simulateHint")} <input class="sm" data-sim=${s} .value=${this.simValues[s]??""} placeholder=${a?.kind==="bool"?n("כן/לא"):"—"} @change=${u=>this.simValues={...this.simValues,[s]:u.target.value}} /></label>`:c}
      <button type="button" class="btn sm" aria-label=${v("remove")} @click=${()=>this.setAt(t,()=>null)}>${w("close")}</button>
    </div>`}windowEditor(e,t){const s=e.window,i=v("dayNames").split(","),a=r=>{const l=s.days.includes(r)?s.days.filter(d=>d!==r):[...s.days,r].sort();l.length&&t({window:{...s,days:l}})};return o`<span class="days" role="group" aria-label=${v("days")}>${[6,0,1,2,3,4,5].map(r=>o`<button type="button" aria-pressed=${String(s.days.includes(r))} @click=${()=>a(r)}>${i[r]}</button>`)}</span>
      <input type="time" lang=${qe()} aria-label=${v("from")} .value=${s.from} @change=${r=>t({window:{...s,from:r.target.value}})} />
      <input type="time" lang=${qe()} aria-label=${v("to")} .value=${s.to} @change=${r=>t({window:{...s,to:r.target.value}})} />`}nodeView(e,t,s){const i=this.dry?.snapshot.find(r=>r.path===s);if(pn(e))return o`<div class="red" data-redacted>${v("redacted")}</div>`;if(un(e))return this.leafRow(e,t,s,i);if(yt(e))return o`<div class="grp"><div class="grp-h"><b>${v("not")}</b><button type="button" class="btn sm" @click=${()=>this.setAt(t,r=>yt(r)?r.item:r)}>${v("remove")}</button></div>${this.nodeView(e.item,[...t,0],`${s}.item`)}</div>`;const a=e;return o`<div class="grp" data-group=${s}>
      <div class="grp-h">
        <sw-segmented radio size="sm" label=${n("חיבור")} value=${a.op}
          @change=${r=>{const l=r.detail.value==="or"?"or":"and";this.setAt(t,d=>({...d,op:l}))}}
          .options=${[{value:"and",label:v("and")},{value:"or",label:v("or")}]}></sw-segmented>
        <button type="button" class="btn sm" data-add-leaf @click=${()=>this.addLeaf(t)}>${w("plus")}${v("addCondition")}</button>
        ${t.length<3?o`<button type="button" class="btn sm" @click=${()=>this.addGroup(t)}>${w("plus")}${v("addGroup")}</button>`:c}
        ${t.length?o`<button type="button" class="btn sm" @click=${()=>this.setAt(t,()=>null)}>${v("remove")}</button>`:c}
      </div>
      ${a.items.map((r,l)=>this.nodeView(r,[...t,l],`${s}.items[${l}]`))}
    </div>`}actionRow(e,t){const s=a=>{const r=[...this.draft.actions];r[t]=a,this.draft={...this.draft,actions:r},this.dry=null},i=this.status&&!this.status.actions[e.type];return o`<div class="act" data-action=${e.type}>
      <select aria-label=${n("פעולה")} @change=${a=>{const r=a.target.value;s(r==="notify"?{type:"notify",to:{roles:[],users:[]}}:r==="set_flag"?{type:"set_flag",flag:"flag_1",value:!0}:{type:"create_service_request",department_id:""})}}>
        <option value="notify" ?selected=${e.type==="notify"}>${v("actNotify")}</option>
        ${this.cat?.tickets_on||e.type==="create_service_request"?o`<option value="create_service_request" ?selected=${e.type==="create_service_request"}>${v("actTicket")}</option>`:c}
        <option value="set_flag" ?selected=${e.type==="set_flag"}>${v("actFlag")}</option>
      </select>
      ${e.type==="notify"?o`<scenario-recipients data-notify-to .choices=${this.choices} .value=${{users:e.to?.users??[],roles:e.to?.roles??[]}}
        @change=${a=>s({...e,to:a.detail.value})}></scenario-recipients>`:c}
      ${e.type==="create_service_request"?o`<select aria-label=${v("department")} data-department @change=${a=>s({...e,department_id:a.target.value})}>
          <option value="" ?selected=${!e.department_id}>${v("departmentPick")}</option>
          ${(this.choices?.departments??[]).map(a=>o`<option value=${a.id} ?selected=${a.id===e.department_id}>${N(a.name)}</option>`)}
          ${e.department_id&&!(this.choices?.departments??[]).some(a=>a.id===e.department_id)?o`<option value=${e.department_id} selected>${e.department_id}</option>`:c}
        </select>
        <input aria-label=${v("ticketTitle")} placeholder=${v("ticketTitle")} .value=${e.title??""} @change=${a=>{const r=a.target.value.trim();s({...e,title:r||void 0})}} />
        ${this.cat&&!this.cat.tickets_on?o`<span class="err">${v("ticketsOff")}</span>`:c}`:c}
      ${e.type==="set_flag"?o`<input aria-label=${v("flagName")} .value=${e.flag} @change=${a=>s({...e,flag:a.target.value.trim()})} />
        <select aria-label=${v("flagValue")} @change=${a=>s({...e,value:a.target.value==="true"})}><option value="true" ?selected=${e.value}>${n("כן")}</option><option value="false" ?selected=${!e.value}>${n("לא")}</option></select>`:c}
      ${i?o`<span class="hint" data-action-off>${v("actionOff")}</span>`:c}
      <button type="button" class="btn sm" aria-label=${v("remove")} @click=${()=>{this.draft={...this.draft,actions:this.draft.actions.filter((a,r)=>r!==t)}}}>${w("close")}</button>
    </div>`}optionsView(){const e=this.draft.options??{},t=this.cat?.option_defaults,s=(a,r)=>{const l={...e};r===""?delete l[a]:l[a]=a==="on_unknown"?r:Number(r),this.draft={...this.draft,options:l},this.dry=null},i=(a,r)=>o`<label class="fld">${r}<input type="number" min="0" .value=${String(e[a]??"")} placeholder=${t&&a in t?String(t[a]):""} @change=${l=>s(a,l.target.value)} /></label>`;return o`<details><summary>${v("options")}</summary><div class="two">
      ${i("cooldown_s",v("cooldown"))}${i("clear_after_s",v("clearAfter"))}${i("for_s",v("forS"))}${i("unknown_grace_s",v("grace"))}
      <label class="fld">${v("onUnknown")}<select @change=${a=>s("on_unknown",a.target.value)}><option value="hold" ?selected=${e.on_unknown!=="treat_as_false"}>${v("onUnknownHold")}</option><option value="treat_as_false" ?selected=${e.on_unknown==="treat_as_false"}>${v("onUnknownFalse")}</option></select></label>
      ${i("max_fires_per_day",v("maxFires"))}${i("max_tickets_per_day",v("maxTickets"))}
    </div></details>`}overrides(){if(!this.sim)return;const e={};for(const[t,s]of Object.entries(this.simValues)){const i=s.trim();i&&(e[t]=i==="כן"||i==="true"?!0:i==="לא"||i==="false"?!1:i==="?"?null:Number(i))}return Object.keys(e).length?e:void 0}fail(e){e instanceof ss?(this.errors=Gi(e),this.say(e.code==="version_conflict"?v("conflict"):e.code==="test_required"?v("testFirst"):e.message,"error")):this.say(String(e),"error")}async runDry(){if(this.editing){this.busy=!0,this.errors=[];try{const e=!this.editing.id||this.dirty();this.dry=e?await hn(this.draft,this.overrides()):await vn(this.editing.id,this.overrides()),!e&&this.editing&&(this.editing={...this.editing,tested_version:!0})}catch(e){this.fail(e)}finally{this.busy=!1}}}dirty(){const e=this.editing;return!e||!e.definition||e.name!==this.name||e.description!==this.description||JSON.stringify(e.definition)!==JSON.stringify(this.draft)}async save(){if(!this.editing||!this.cat)return;const e=fn(this.draft,this.cat.limits);if(e.length){this.errors=e.map(t=>({path:"",message:t}));return}this.busy=!0;try{const t=this.editing.id?await mn(this.editing.id,this.editing.version,this.name.trim(),this.description.trim(),this.draft):await bn(this.name.trim(),this.description.trim(),this.draft);this.say(v("saved")),this.loadedId=t.id;const s=await Ss(t.id);this.editing=s,this.draft=structuredClone(s.definition??this.draft),this.errors=[],this.load(),(!this.scenarioId||this.scenarioId==="new")&&this.open(t.id)}catch(t){this.fail(t)}finally{this.busy=!1}}async toggle(e,t,s=!1){this.busy=!0;try{const i=t?await gn(e.id,e.version,s):await wn(e.id,e.version);this.say(t?v("enabled"):v("disabledNote")),this.editing?.id===i.id&&(this.editing={...this.editing,...i}),this.dialog="",this.load()}catch(i){i instanceof ss&&i.code==="confirmation_required"?this.dialog="confirm-enable":this.fail(i)}finally{this.busy=!1}}async removeScenario(){if(this.editing?.id)try{await $n(this.editing.id),this.say(v("deleted")),this.dialog="",this.load(),this.close()}catch(e){this.fail(e)}}async showRuns(){if(this.editing?.id){this.view="runs";try{this.runs=(await yn(this.editing.id)).runs.slice(0,12)}catch(e){this.fail(e)}}}card(e){const t=xn(e.state),s={off:v("stateOff"),ok:v("stateOk"),active:v("stateActive"),degraded:v("stateDegraded"),suppressed:v("stateSuppressed")}[e.state];return o`<button type="button" class="card glass" data-scenario=${e.id} @click=${()=>this.open(e.id)}>
      <div class="row"><b>${N(e.name)}</b><span class="grow"></span><span class=${`st ${t}`} data-state=${e.state}>${s}</span></div>
      <div class="meta">${e.state_reason_text||(e.last_fire_at?v("lastFire",{t:new Date(e.last_fire_at).toLocaleString(is(),{dateStyle:"short",timeStyle:"short"})}):v("never"))}</div>
      <div class="row"><span class="mods">${e.modules.map(i=>o`<span class="chip">${i}</span>`)}</span><span class="grow"></span><span class="meta">${v("firesToday",{n:e.fires_today})}</span></div>
    </button>`}listView(){if(this.failed)return o`<div class="center" data-scen-state="error">${v("loadError")}<button type="button" class="btn sm" @click=${()=>void this.load()}>${v("retry")}</button></div>`;if(this.list===null)return o`<div class="center" aria-busy="true" data-scen-state="loading"></div>`;if(!this.list.length)return o`<div class="center" data-scen-state="empty">${w("bolt")}<b>${v("empty")}</b>${this.status?.can.manage?o`<button type="button" class="btn primary" data-scen-new-empty @click=${()=>this.open("new")}>${w("plus")}${v("new")}</button>`:c}<span class="hint">${v("doorWall")}</span></div>`;const e=Math.max(1,Math.ceil(this.list.length/this.pageSize)),t=Math.min(this.page,e-1),s=this.list.slice(t*this.pageSize,(t+1)*this.pageSize);return o`<div class="grid" data-scen-grid>${it(s,i=>i.id,i=>this.card(i))}</div>
      ${e>1?o`<div class="pager" data-scen-pager><button type="button" class="btn sm" ?disabled=${t===0} @click=${()=>this.page=t-1}>${v("prev")}</button>${v("page",{a:t+1,b:e})}<button type="button" class="btn sm" ?disabled=${t>=e-1} @click=${()=>this.page=t+1}>${v("next")}</button></div>`:c}`}dryView(){const e=this.dry;if(!e)return c;const t=e.result==="TRUE"?o`<b class="t">${v("wouldFire")}</b>`:e.result==="UNKNOWN"?o`<b class="u">${v("unknownResult")}</b>`:o`<b>${v("wouldNot")}</b>`;return o`<div class="dry" role="status" data-dry=${e.result}>${t}<span>${e.sentence}</span>
      ${e.actions.filter(s=>!s.switch_on).map(s=>o`<span class="hint">${s.type}: ${v("actionOff")}</span>`)}</div>`}runsView(){return this.runs.length?o`<div class="runs" data-scen-runs>${this.runs.map(e=>o`<div class="run"><div class="row"><b>${e.outcome}</b><span class="grow"></span><span class="meta">${new Date(e.at).toLocaleString(is(),{dateStyle:"short",timeStyle:"medium"})}</span></div>
      ${e.sentence?o`<span>${e.sentence}</span>`:c}${e.reason_text?o`<span class="hint">${e.reason_text}</span>`:c}
      ${e.actions.length?o`<span class="hint">${e.actions.map(t=>`${t.type}: ${t.status}${t.reason?` (${t.reason})`:""}`).join(" · ")}</span>`:c}</div>`)}</div>`:o`<div class="hint">${v("noRuns")}</div>`}editor(){const e=this.editing;if(!e)return c;const t=!!this.status?.can.manage&&!e.redacted_leaves?.length,s=kn(this.draft.when),i=s.length>0&&s.every(a=>this.sig(a.leaf.signal)?.module==="doors");return o`<sw-drawer open modal heading=${e.id?e.name||v("title"):v("new")} data-scen-editor @close=${()=>this.close()}>
      <div class="ed">
        ${this.status?.kill_switch?o`<div class="kill" role="alert">${v("killOn")}</div>`:c}
        ${e.warnings?.map(a=>o`<div class="banner warn" role="status">${a.message}</div>`)}
        ${e.state_reason_text?o`<div class="banner bad" role="status" data-state-reason=${e.state_reason??""}>${e.state_reason_text}</div>`:c}
        <sw-tabs controlled variant="pill" class="sm" .active=${this.view}
          .items=${[{id:"edit",label:v("when")},...e.id?[{id:"runs",label:v("runs"),attrs:{"data-scen-runs-tab":""}}]:[]]}
          @change=${a=>{a.stopPropagation(),a.detail.id==="runs"?this.showRuns():this.view="edit"}}></sw-tabs>
        ${this.view==="runs"?this.runsView():o`
          <div class="two"><label class="fld">${v("name")}<input data-scen-name maxlength="120" .value=${this.name} ?disabled=${!t} @input=${a=>this.name=a.target.value} /></label>
            <label class="fld">${v("description")}<input maxlength="1000" .value=${this.description} ?disabled=${!t} @input=${a=>this.description=a.target.value} /></label></div>
          <div class="sect"><b>${v("when")}</b></div>
          <div class="tree">${this.nodeView(this.draft.when,[],"when")}</div>
          ${i?o`<div class="hint">${v("hintHaOnly")}</div>`:c}
          <div class="sect"><b>${v("then")}</b></div>
          ${this.draft.actions.map((a,r)=>this.actionRow(a,r))}
          ${this.draft.actions.length<(this.cat?.limits.actions??3)?o`<button type="button" class="btn sm" data-add-action @click=${()=>{this.draft={...this.draft,actions:[...this.draft.actions,{type:"set_flag",flag:"flag_1",value:!0}]}}}>${w("plus")}${v("then")}</button>`:c}
          <div class="hint">${v("doorWall")}</div>
          ${this.optionsView()}
          ${this.errors.length?o`<div class="err" role="alert" data-scen-errors>${this.errors.map(a=>o`<div>${a.path?`${a.path}: `:""}${a.message}</div>`)}</div>`:c}
          ${this.dryView()}`}
      </div>
      <div slot="footer" class="foot">
        ${t&&e.id?o`<button type="button" class="btn" data-scen-delete @click=${()=>this.dialog="delete"}>${v("delete")}</button>`:c}
        <span class="grow"></span>
        ${t?o`<label class="hint"><sw-toggle size="sm" labelHidden in-label label=${v("simulate")} .checked=${this.sim} @change=${a=>this.sim=Yi(a)}></sw-toggle>${v("simulate")}</label>
          <button type="button" class="btn" data-scen-test ?disabled=${this.busy} @click=${()=>void this.runDry()}>${v("test")}</button>
          <button type="button" class="btn primary" data-scen-save ?disabled=${this.busy||!this.name.trim()} @click=${()=>void this.save()}>${v("save")}</button>
          ${e.id?o`<button type="button" class="btn" data-scen-toggle ?disabled=${this.busy||!e.enabled&&this.dirty()} title=${!e.enabled&&!e.tested_version?v("testFirst"):""} @click=${()=>void this.toggle(e,!e.enabled)}>${e.enabled?v("disable"):v("enable")}</button>`:c}`:c}
      </div>
    </sw-drawer>`}dialogs(){const e=this.editing;if(this.dialog==="delete"&&e)return o`<sw-dialog open heading=${v("confirmDelete")} @close=${()=>this.dialog=""}><div class="foot"><button type="button" class="btn" @click=${()=>this.dialog=""}>${v("cancel")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.removeScenario()}>${v("delete")}</button></div></sw-dialog>`;if(this.dialog==="confirm-enable"&&e){const t=e.definition?.options?.max_tickets_per_day??20;return o`<sw-dialog open heading=${v("enable")} @close=${()=>this.dialog=""}><p>${v("enableConfirm",{n:t})}</p><div class="foot"><button type="button" class="btn" @click=${()=>this.dialog=""}>${v("cancel")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.toggle(e,!0,!0)}>${v("confirm")}</button></div></sw-dialog>`}return c}render(){return o`<div class="wrap" data-scenarios-panel>
      ${this.status?.kill_switch?o`<div class="kill" role="alert" data-scen-kill>${v("killOn")}</div>`:c}
      ${this.listView()}
    </div>${this.editor()}${this.dialogs()}`}};P.styles=[Ce,...ye,B`
    :host { display: block; block-size: 100%; }
    .wrap { display: flex; flex-direction: column; gap: 12px; block-size: 100%; min-block-size: 0; }
    .grid { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); grid-auto-rows: 118px; gap: 12px; overflow: hidden; }
    /* R5-DEVICES-297: a scenario card is the top step (shadow 2, no outline), its name a heading, its state a filled pill; the card
       sinks on pointer-down, hover for a fine pointer only */
    .card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--sw-r-lg, 20px); cursor: pointer; text-align: start; border: 1px solid var(--dv-border); background: var(--mm-sheen), var(--dv-surface); box-shadow: var(--dv-shadow-2); color: var(--dv-text); font: inherit; min-inline-size: 0; transition: transform var(--sw-t-fast, 120ms) var(--sw-ease, ease-out), box-shadow var(--mm-motion, 200ms) var(--mm-ease, ease-out); }
    .card:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; }
    .card:active { transform: scale(var(--sw-press-scale, 1)); }
    @media (hover: hover) and (pointer: fine) { .card:hover { box-shadow: var(--dv-shadow-3, var(--dv-shadow-2)); } }
    .card b { font-size: var(--sw-fs-xl); font-weight: 800; color: var(--sw-heading, var(--dv-text)); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row { display: flex; align-items: center; gap: 8px; min-inline-size: 0; }
    .meta { color: var(--dv-text-2); font-size: var(--sw-fs-base); font-weight: var(--sw-fw-medium); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .st { display: inline-flex; align-items: center; min-block-size: 26px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); padding: 0 10px; border-radius: 999px; background: var(--dv-surface-3); color: var(--dv-text-2); white-space: nowrap; }
    .st.ok { background: var(--dv-success-soft); color: var(--au-ok-text, var(--dv-success)); }
    .st.warn { background: var(--dv-warning-soft); color: var(--au-warn-text, var(--dv-warning)); }
    .st.bad { background: var(--dv-danger-soft); color: var(--au-bad-text, var(--dv-danger)); }
    .mods { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; }
    .pager { display: flex; justify-content: center; align-items: center; gap: 10px; color: var(--dv-text-2); font-size: var(--sw-fs-sm, 13px); }
    .kill { padding: 8px 12px; border-radius: var(--sw-r-md, 12px); background: var(--dv-danger-soft); color: var(--dv-danger); }
    .center { display: grid; place-items: center; gap: 10px; padding: 32px; color: var(--dv-text-2); }
    sw-drawer { --sw-drawer-modal-w: 760px; }
    .ed { display: grid; gap: 12px; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tree { display: grid; gap: 6px; }
    /* R5-DEVICES-297: a group is a well, not a side-tab accent border (impeccable detect) */
    .grp { background: var(--dv-surface-2); border-radius: var(--sw-r-md, 12px); padding: 8px 10px; display: grid; gap: 6px; }
    .grp-h { display: flex; gap: 6px; align-items: center; }
    .leaf { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); }
    .leaf select, .leaf input, .act select, .act input, .ed input, .ed select, .ed textarea { font: inherit; color: var(--dv-text); background: var(--dv-surface); border: 1px solid var(--dv-border); border-radius: var(--dv-radius-control, 10px); padding: 4px 8px; min-inline-size: 0; }
    .leaf input[type='number'] { inline-size: 84px; }
    .leaf .sm { inline-size: 64px; }
    .red { color: var(--dv-text-3); font-style: italic; padding: 6px 8px; }
    .tri { inline-size: 22px; block-size: 22px; display: inline-grid; place-items: center; border-radius: 50%; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); }
    .tri.t { background: var(--dv-success-soft); color: var(--dv-success); }
    .tri.f { background: var(--dv-surface-3); color: var(--dv-text-2); }
    .tri.u { background: var(--dv-warning-soft); color: var(--dv-warning); }
    .act { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); }
    .dry { padding: 10px 12px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); display: grid; gap: 4px; }
    .dry b.t { color: var(--dv-success); } .dry b.u { color: var(--dv-warning); }
    .err { color: var(--dv-danger); font-size: var(--sw-fs-sm, 13px); }
    .hint { color: var(--dv-text-3); font-size: var(--sw-fs-xs, 12px); }
    .days { display: inline-flex; gap: 2px; }
    .days button { min-inline-size: 26px; padding: 2px 4px; border-radius: var(--sw-r-xs); border: 1px solid var(--dv-border); background: var(--dv-surface); color: var(--dv-text-2); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; }
    .days button[aria-pressed='true'] { background: var(--dv-accent-soft); color: var(--dv-accent-text, var(--dv-accent)); }
    .foot { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .runs { display: grid; gap: 6px; }
    .run { padding: 8px 10px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); display: grid; gap: 2px; font-size: var(--sw-fs-sm, 13px); }
    details > summary { cursor: pointer; color: var(--dv-text-2); }
    @media (max-width: 640px) { .two { grid-template-columns: 1fr; } .grid { grid-auto-rows: 104px; } }
  `];M([b({attribute:!1})],P.prototype,"status",2);M([b()],P.prototype,"scenarioId",2);M([h()],P.prototype,"list",2);M([h()],P.prototype,"failed",2);M([h()],P.prototype,"cat",2);M([h()],P.prototype,"choices",2);M([h()],P.prototype,"page",2);M([h()],P.prototype,"pageSize",2);M([h()],P.prototype,"editing",2);M([h()],P.prototype,"draft",2);M([h()],P.prototype,"name",2);M([h()],P.prototype,"description",2);M([h()],P.prototype,"dry",2);M([h()],P.prototype,"runs",2);M([h()],P.prototype,"sim",2);M([h()],P.prototype,"simValues",2);M([h()],P.prototype,"errors",2);M([h()],P.prototype,"busy",2);M([h()],P.prototype,"dialog",2);M([h()],P.prototype,"view",2);P=M([H("scenarios-panel")],P);var Xs=Object.freeze,Ri=Object.defineProperty,Qo=Object.getOwnPropertyDescriptor,D=(e,t,s,i)=>{for(var a=i>1?void 0:i?Qo(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Ri(t,s,a),a},Qs=(e,t)=>Xs(Ri(e,"raw",{value:Xs(e.slice())})),Zs,ei;const Zo="/devices/schedules",Li="sw.automations.view",el=["rows","cards"],ti={rows:"rows",cards:"grid"},Ct={rows:()=>sa("rows"),cards:()=>k("כרטיסים")},Tt=e=>e==="rows"||e==="cards"?e:null;function si(){try{const e=localStorage.getItem(Li);if(!e)return null;try{return Tt(JSON.parse(e))??Tt(e)}catch{return Tt(e)}}catch{return null}}function tl(e){try{localStorage.setItem(Li,JSON.stringify(e))}catch{}}let E=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new Ee(this),this.kavarnit={schedules:!0,automations:!0},this.schedCount=null,this.scen=null,this.scenView=!1,this.scenId="",this.status=null,this.items=null,this.failed="",this.noPerm=!1,this.filters={...gs},this.route=ws(["devices","automations"],new URLSearchParams),this.compactHeader=!1,this.phone=window.matchMedia("(max-width: 767px)").matches,this.filtersOpen=!1,this.note=null,this.toggling=new Set,this.confirm=null,this.whenOpen=!1,this.drawerUsed=!1,this.fieldScripts=new Set,this.now=new Date,this.cardAction="",this.rawParams=new URLSearchParams,this.tplDraft=null,this.view=si()??Ki,this.perPage={rows:as.automations,cards:as.automations_cards},this.page=1,this.fitRows=null,this.lists=new rn(this,()=>{this.page=1,this.fitRows=null}),this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offPush=null,this.offClock=null,this.offEdit=null,this.noteTimer=0,this.urlTimer=0,this.pushTimer=0,this.lastWritten="",this.fieldsFor="",this.onResize=()=>{this.fitRows=null,this.requestUpdate()},this.onScroll=()=>{const e=this.scrollTop>40;e!==this.compactHeader&&(this.compactHeader=e)},this.onResult=e=>this.say(e.detail.text,e.detail.tone,e.detail.action),this.onAction=e=>{const{item:t,action:s}=e.detail,i=Me(t.kind).id;switch(s){case"edit":X($s(t.kind,t.id));break;case"trace":this.go(A(i,t.id),{view:"trace"});break;case"versions":this.go(A(i,t.id),{view:"versions"});break;case"dryrun":this.go(A(i,t.id),{view:"dryrun"});break;case"run":this.go(A(i,t.id),{do:"run"});break;case"copy":this.go(A(i,t.id),{do:"copy"});break;case"delete":this.go(A(i,t.id),{do:"delete"});break}},this.onDrawerClose=()=>{const e=this.route.trash?this.segment():this.route.segment;this.go(A(e))},this.onViewChange=e=>{const{view:t,run:s}=e.detail;this.go(A(this.route.segment,this.route.id),{view:t==="detail"?"":t,run:s})},this.onDeleted=e=>{const{trash_id:t,name:s}=e.detail;this.go(A(this.route.segment)),this.loadList(),this.refreshStatus(),this.say(k('"{name}" נמחק',{name:s}),"ok",{label:k("שחזור"),run:()=>void this.undoDelete(t,s)})},this.onCopied=e=>{this.loadList(),this.go(A(Me(e.detail.item.kind).id,e.detail.item.id)),this.say(k("שוכפל"))},this.onChanged=()=>{this.loadList(),this.refreshStatus()},this.onActionDone=()=>{if(!this.cardAction)return;const e=this.params();e.delete("do"),this.cardAction="",Le(A(this.route.segment,this.route.id),e)},this.onEditorSaved=e=>{const{kind:t,id:s,status:i}=e.detail;this.loadList(),this.refreshStatus(),Le(this.editorExit(t,i==="ok"?s:""),_e(this.filters)),this.say(i==="not_loaded"?k("נשמר, אך עדיין לא נטען"):k("נשמר"),i==="not_loaded"?"error":"ok")},this.onEditorCancel=(e,t)=>{Le(this.editorExit(e,t),_e(this.filters))},this.onEditorDeleted=e=>{const{kind:t,id:s,trash_id:i}=e.detail,a=(this.items??[]).find(r=>r.kind===t&&r.id===s)?.name??"";Le(A(Me(t).id),_e(this.filters)),this.loadList(),this.refreshStatus(),this.say(a?k('"{name}" נמחק',{name:a}):k("נמחק"),"ok",{label:k("שחזור"),run:()=>void this.undoDelete(i,a)})}}connectedCallback(){super.connectedCallback(),De(this),this.phoneMq.addEventListener("change",this.onPhone),window.addEventListener("resize",this.onResize),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=Ji({id:"automations-trash",label:k("סל מחזור"),icon:"trash",can:()=>!!(this.status?.can.manage||this.status?.can.scene_manage||this.status?.can.script_manage),run:()=>ns(xs())}),this.offRoute=Xi(t=>this.onRoute(t));const e=si();Qi().then(t=>{this.perPage={rows:t.pageSize.automations,cards:t.pageSize.automations_cards},e||(this.view=t.automationsView)}),this.load(),this.offClock=Zi(()=>this.now=wt()),et()&&(this.offPush=ea(t=>{t.type==="automations_changed"&&(window.clearTimeout(this.pushTimer),this.pushTimer=window.setTimeout(()=>void this.refresh(),500))}))}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),window.removeEventListener("resize",this.onResize),this.removeEventListener("scroll",this.onScroll),this.offRoute?.(),this.offPush?.(),this.offClock?.(),this.offClock=null,this.offEdit?.(),window.clearTimeout(this.noteTimer),window.clearTimeout(this.urlTimer),window.clearTimeout(this.pushTimer)}willUpdate(){const e=this.scenView?"":this.segment();this.toggleAttribute("data-list-panel",!this.lists.paged&&(e==="automations"||e==="scripts")&&!!this.items?.length)}updated(e){zn(this.renderRoot,this.phone),this.measureFit();const t=this.renderRoot.querySelector(".toast[popover]");if(t)try{t.matches(":popover-open")||t.showPopover()}catch{}e.has("status")&&this.status&&(this.setAttribute("data-phone-filter",this.status.ui.phone_filter==="rows"?"rows":"fold"),this.setAttribute("data-sens",this.status.ui.sensitive_chip==="red"?"red":"amber"))}measureFit(){if(!this.lists.paged)return;const e=this.scenView?"":this.segment(),t=e==="scripts"?this.renderRoot.querySelector("scripts-panel"):null,s=e==="automations"?this.renderRoot.querySelector("[data-auto-grid]"):null,i=t?[t]:s?[...s.children].slice(0,2):[];i.length&&Promise.all(i.map(a=>a.updateComplete)).then(()=>{const a=t?t.shadowRoot?.querySelector("[data-scripts-panel]")??null:s;if(!a?.isConnected)return;const r=ta({host:this,list:a,itemSelector:t?":scope > *":":scope > automation-row, :scope > automation-card",pager:this.renderRoot.querySelector("[data-auto-pager]"),padded:[this.renderRoot.querySelector(".page")]});r!==null&&(this.fitRows===null||r<this.fitRows)&&(this.fitRows=r)})}onRoute(e){if(e.segments[0]!=="devices"||e.segments[1]!=="automations")return;const t=e.segments[2]==="scenarios";this.scenView=t,this.scenId=t?decodeURIComponent(e.segments[3]??""):"";const s=ws(t?["devices","automations"]:e.segments,e.params),i=e.params.toString();if(i!==this.lastWritten){const r=Wa(e.params);this.filters=r,this.lastWritten=i}this.route=s,this.rawParams=new URLSearchParams(e.params),this.cardAction=e.params.get("do")??"";const a=ys(s,e.params);a?.template&&this.tplDraft?.id!==a.template&&this.loadTemplate(a.template),(s.id||s.trash)&&(this.drawerUsed=!0)}segment(){const e=this.status?bs(this.status):[],t=me(this.route.segment);return e.length&&!e.includes(t.kind)?Me(e[0]).id:this.route.segment}extra(){const e=this.route;return{view:e.view==="detail"?"":e.view,run:e.run}}params(e=this.extra()){return _e(this.filters,e)}hrefOf(e,t,s={}){const i=_e(this.filters,s).toString();return`#${A(e,t)}${i?`?${i}`:""}`}go(e,t={}){const s=_e(this.filters,t);this.lastWritten=s.toString(),ns(e,s)}syncUrl(e=0){window.clearTimeout(this.urlTimer),this.urlTimer=window.setTimeout(()=>{const t=this.params();this.lastWritten=t.toString(),Le(this.route.trash?xs():A(this.route.segment,this.route.id),t)},e)}setFilter(e,t=0){this.filters={...this.filters,...e},this.page=1,this.syncUrl(t)}setSegment(e){e===this.segment()&&!this.route.id||(this.filters={...this.filters,state:"all",floor:""},this.page=1,this.fitRows=null,this.filtersOpen=!1,this.go(A(e)))}async loadScheduleCount(){try{this.schedCount=(await On()).counts.visible}catch{this.schedCount=null}}async load(){if(!Ha()){this.kavarnit.schedules&&this.loadScheduleCount(),et()&&_n().then(e=>this.scen=e).catch(()=>this.scen=null),await bi(),this.now=wt();try{this.status=await ee().status()}catch(e){const t=j(e);t.status===403?this.noPerm=!0:this.failed=t.message;return}if(this.status.available==="feature_disabled"||this.status.available==="not_configured"){this.items=[];return}await this.loadList()}}async loadList(){try{const e=await ee().list({limit:500});this.items=e.items,It(this.status?.ui??null).precheck&&ua().then(t=>{this.items&&t.enabled&&(this.items=Ga(this.items,t.items))}).catch(()=>{}),this.failed="",this.now=wt(),this.loadFieldScripts()}catch(e){this.items===null?this.failed=j(e).message:this.say(j(e).message,"error")}}async loadFieldScripts(){const e=(this.items??[]).filter(i=>i.kind==="script"),t=e.map(i=>`${i.id}:${i.revision??""}`).join("|");if(!e.length||t===this.fieldsFor)return;this.fieldsFor=t;const s=new Set;await Promise.all(e.map(async i=>{try{(await ee().get("script",i.id)).draft.fields?.some(r=>r.selector.kind!=="locked")&&s.add(i.id)}catch{}})),this.fieldScripts=s}async refresh(){try{this.status=await ee().status(),this.status.available!=="feature_disabled"&&this.status.available!=="not_configured"&&await this.loadList()}catch{}await this.drawer?.refresh()}get drawer(){return this.renderRoot.querySelector("automation-drawer")}say(e,t="ok",s){window.clearTimeout(this.noteTimer),this.note={text:e,tone:t,action:s},this.noteTimer=window.setTimeout(()=>this.note=null,s?1e4:4e3)}patchItem(e){this.items=(this.items??[]).map(t=>t.kind===e.kind&&t.id===e.id?e:t)}async toggle(e,t,s=!1){if(!this.toggling.has(e.id)){if(t&&!s&&e.unknown_effects){this.confirm={item:e,op:"enable"};return}this.confirm=null,this.toggling=new Set([...this.toggling,e.id]);try{const i=await vi(e.id,t,{confirm:s||void 0});this.patchItem(i.item),this.refreshStatus()}catch(i){Ra(i)&&!s?this.confirm={item:e,op:"enable"}:this.say(j(i).message,"error"),await this.loadList()}finally{this.toggling=new Set([...this.toggling].filter(i=>i!==e.id))}}}async refreshStatus(){try{this.status=await ee().status()}catch{}}newItem(){const e=this.segment();if(e==="scenes")return this.go(A("scenes","new"));if(e==="automations"&&this.status?.ui.ask_when_on_new){this.whenOpen=!0;return}const t=ks(me(e).kind);X(t.path,t.params)}async undoDelete(e,t){try{await ee().restoreTrash(e,{client_request_id:`undo-${e}-${Date.now()}`}),this.say(k('"{name}" שוחזר',{name:t})),await this.loadList()}catch(s){this.say(j(s).message,"error")}}async loadTemplate(e){this.tplDraft={id:e,draft:null,done:!1};try{const{templates:t}=await ee().templates(),s=t.find(i=>i.id===e);this.tplDraft?.id===e&&(this.tplDraft={id:e,draft:s?s.draft:null,done:!0})}catch{this.tplDraft?.id===e&&(this.tplDraft={id:e,draft:null,done:!0})}}editorExit(e,t){const s=Me(e).id;return t&&e!=="scene"?A(s,t):A(s)}editorSheet(){const e=ys(this.route,this.rawParams);if(!e)return c;if(e.template&&!(this.tplDraft?.id===e.template&&this.tplDraft.done))return c;const t=e.template?this.tplDraft?.draft??null:null,s=e.id?"edit":"create",i=()=>this.onEditorCancel(e.kind,e.id),a=()=>void this.loadList(),r=`${e.kind}:${e.id||"new"}:${e.template}`,l=et()?"":Ya().scheme??"";return e.kind==="script"?o`${mt(r,o(Zs||(Zs=Qs(['<script-editor data-auto-editor="script" .itemId='," .mode="," .scheme="," @saved="," @cancel="," @deleted="," @item-changed=","><\/script-editor>"])),e.id||null,s,l,this.onEditorSaved,i,this.onEditorDeleted,a))}`:e.kind==="scene"?o`${mt(r,o`<scene-editor data-auto-editor="scene" .itemId=${e.id||null} .mode=${s} .scheme=${l} @saved=${this.onEditorSaved} @cancel=${i} @deleted=${this.onEditorDeleted} @item-changed=${a}></scene-editor>`)}`:o`${mt(r,o`<automation-builder data-auto-editor="automation" .itemId=${e.id||null} .mode=${s} .scheme=${l} .draft0=${t} @saved=${this.onEditorSaved} @cancel=${i} @deleted=${this.onEditorDeleted} @item-changed=${a}></automation-builder>`)}`}segItems(e){const t=me(e).kind;return(this.items??[]).filter(s=>s.kind===t&&!(t==="scene"&&s.hidden))}kindTabs(e,t,s,i,a){const r=[...this.kavarnit.schedules?[{id:"schedules",label:k("תזמונים"),pill:this.schedCount??void 0,attrs:{"data-segment":"schedules"}}]:[],...Ka.filter(d=>e.includes(d.kind)).map(d=>({id:d.id,label:d.label,pill:t[d.kind],attrs:{"data-segment":d.id}})),...a?[{id:"scenarios",label:v("tab"),attrs:{"data-segment":"scenarios"}}]:[]],l=d=>{d==="schedules"?X(Zo):d==="scenarios"?X("/devices/automations/scenarios"):i?X(A(d)):this.setSegment(d)};return o`<sw-tabs controlled variant="pill" fill="phone" class="kinds" group-label=${k("סוג")} .items=${r} .active=${i?"scenarios":s}
      @change=${d=>{d.stopPropagation(),l(d.detail.id)}}></sw-tabs>`}header(e){const t=me(e),s=this.segItems(e),i=this.status?bs(this.status):[],a=Ja(this.items??[]),r=Xa(s),l=this.filters,d=Qa(s),p=_s(this.status,t.kind),u=Za({...l}),m=this.items!==null&&!this.failed&&!this.noPerm&&!!this.status&&this.status.available!=="feature_disabled"&&this.status.available!=="not_configured",g=!!this.scen?.enabled&&this.scen.can.view,x=this.scenView,O=m&&!x&&t.kind==="automation"&&s.length>0,W=m&&r.length&&!x?o`<div class="rooms" role="group" aria-label=${k("קומות")}>
          <button type="button" class="rc" aria-pressed=${String(!l.floor)} data-floor="" @click=${()=>this.setFilter({floor:""})}>${k("הכל")}</button>
          ${r.map(z=>o`<button type="button" class="rc" aria-pressed=${String(l.floor===z.id)} data-floor=${z.id} @click=${()=>this.setFilter({floor:z.id})}>${N(z.name)}</button>`)}
        </div>`:c;return o`${this.phone?c:o`<div class="dh-row hdact" slot="actions">${W}${O?o`<div class="vwrap">${this.viewSwitch()}</div>`:c}</div>`}
    <header class="dh" data-auto-header>
      ${this.phone&&W!==c?o`<div class="dh-row fl">${W}</div>`:c}
      ${m||x&&g?o`<div class="dh-det">
        ${i.length>1||g||this.kavarnit.schedules&&i.length?this.kindTabs(i,a,e,x,g):c}
        ${t.kind==="automation"&&s.length&&!x?o`<sw-segmented class="stf" radio size="sm" label=${k("סינון לפי מצב")} ?data-open=${this.filtersOpen} value=${l.state} @change=${z=>this.setFilter({state:z.detail.value})}
          .options=${en(It(this.status?.ui??null).precheck).map(z=>({value:z.id,label:z.label,count:String(d[z.id]),attrs:{"data-state-filter":z.id}}))}></sw-segmented>`:c}
        ${t.kind==="automation"&&s.length&&!x?o`<button type="button" class="btn foldbtn" data-fold-toggle aria-expanded=${String(this.filtersOpen)} @click=${()=>this.filtersOpen=!this.filtersOpen}>${w("filter")}${k("סינון")}${u?o` <small>${u}</small>`:c}</button>`:c}
        <span class="grow"></span>
        ${O&&this.phone?this.viewToggle():c}
        ${x?this.scen?.can.manage?o`<button type="button" class="btn primary newbtn" data-scen-new @click=${()=>X("/devices/automations/scenarios/new")}>${w("plus")}${v("new")}</button>`:c:o`<label class="search">${w("search")}<span class="sr-only">${k("חיפוש")}</span><input type="search" data-search placeholder=${this.phone?k("חיפוש"):t.searchLabel} .value=${l.q} @input=${z=>this.setFilter({q:z.target.value},250)} /></label>
        ${p.shown?o`<button type="button" class="btn primary newbtn" data-auto-new ?disabled=${p.disabled} title=${p.reason} @click=${()=>this.newItem()}>${w(e==="scenes"?"camera":"plus")}${t.newLabel}</button>`:c}`}
      </div>`:c}
    </header>`}viewSwitch(){return o`<sw-segmented class="views" size="sm" labels="none" label=${k("תצוגה")} data-auto-views value=${this.view} @change=${e=>this.setView(e.detail.value)}
      .options=${el.map(e=>({value:e,label:Ct[e](),icon:w(ti[e]),attrs:{"data-view-btn":e}}))}></sw-segmented>`}viewToggle(){const e=this.view==="rows"?"cards":"rows";return o`<button type="button" class="btn vtog" data-auto-views data-view-btn=${e} aria-label=${Ct[e]()} title=${Ct[e]()} @click=${()=>this.setView(e)}>${w(ti[e])}</button>`}setView(e){e!==this.view&&(this.view=e,this.page=1,this.fitRows=null,tl(e))}skeleton(){const e=o`<span class="sr-only">${k("טוען…")}</span>`;if(this.view==="rows"&&!this.scenView&&this.segment()==="automations"){const s=i=>o`<div class="skl-row"><span class="skl"></span><span class="skl" style=${`inline-size:${i}%`}></span><span class="skl" style="inline-size:80%"></span><span class="skl" style="inline-size:60%"></span></div>`;return o`<div data-auto-state="loading" aria-busy="true">${e}<div class="rlist glass skl-rows">${[62,48,70,55,40,66,52,45].slice(0,this.phone?6:8).map(s)}</div></div>`}const t=o`<div class="glass skl-card"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;return o`<div data-auto-state="loading" aria-busy="true">${e}<div class="cgrid">${Array.from({length:this.phone?3:6},()=>t)}</div></div>`}stateBox(e,t,s,i){return o`<div class="statebox glass" role="status" data-auto-state=${s}><span class="ring">${w(e)}</span><b>${t}</b>${i??c}</div>`}bannerRow(e){const t=tn(this.status,me(e).kind);return t.length?o`<div class="stack">${t.map(s=>o`<div class=${`banner ${s.tone}`} role=${s.tone==="bad"?"alert":"status"} data-auto-banner=${s.id}>${w(s.id==="offline"?"wifiOff":s.id==="delegation_off"||s.tone==="info"?"info":"warning")}<div>${s.title?o`<b>${s.title}</b><small>${s.text}</small>`:s.text}</div>${s.retry?o`<button type="button" class="btn sm" data-banner-retry @click=${()=>void this.refresh()}>${w("refresh")}${k("נסו שוב")}</button>`:c}</div>`)}</div>`:c}body(e){const t=sn(this.status,{failed:!!this.failed,noPermission:this.noPerm,loading:this.items===null}),s=this.status?.can.configure?o`<a class="btn sm" href="#/system/automations" data-open-settings>${k("הגדרות האוטומציות")}</a>`:void 0;if(t==="loading")return this.skeleton();if(t==="error")return this.stateBox("warning",k("לא ניתן לטעון את הרשימה"),"error",o`<button type="button" class="btn sm" data-auto-retry @click=${()=>{this.failed="",this.items=null,this.load()}}>${w("refresh")}${k("נסו שוב")}</button>`);if(t==="no_permission")return this.stateBox("lock",k("אין הרשאה לצפות באוטומציות"),"no_permission");if(t==="feature_disabled")return this.stateBox("settings",k("האוטומציות כבויות"),"feature_disabled",s);if(t==="not_configured")return this.stateBox("settings",k("האוטומציות עדיין לא הוגדרו"),"not_configured",s);const i=me(e),a=this.segItems(e),r=an(this.items??[],this.filters,i.kind).filter(p=>!(i.kind==="scene"&&p.hidden)),l=_s(this.status,i.kind);let d;if(!a.length)d=this.stateBox(e==="scenes"?"sparkle":e==="scripts"?"script":"bolt",e==="scenes"?k("אין עדיין סצנות"):e==="scripts"?k("אין עדיין סקריפטים"):k("אין עדיין אוטומציות"),"empty",l.shown&&!l.disabled?o`<button type="button" class="btn primary" data-auto-new-empty @click=${()=>this.newItem()}>${w("plus")}${i.newLabel}</button>`:void 0);else if(!r.length)d=this.stateBox("search",e==="scenes"?k("לא נמצאו סצנות"):e==="scripts"?k("לא נמצאו סקריפטים"):k("לא נמצאו אוטומציות"),"no-match",o`<button type="button" class="btn sm" data-clear-filters @click=${()=>{this.filters={...gs},this.syncUrl()}}>${k("נקה סינון")}</button>`);else if(e==="scenes")d=o`<scenes-panel .items=${r} .hiddenItems=${gi(this.items??[])} .status=${this.status} .now=${this.now} .sceneId=${this.route.segment==="scenes"?this.route.id:""} @result=${this.onResult} @changed=${this.onChanged}
        @open-scene=${p=>this.go(A("scenes",p.detail.id))} @close-scene=${()=>this.go(A("scenes"))}></scenes-panel>`;else if(e==="scripts"){const p=zs(this.lists.paged,rs(Math.max(1,r.length),this.fitRows),r.length),u=os(r.length,p),m=ls(this.page,r.length,p),g=ds(r,m,p),x=u>1?o`<div class="lfoot" data-auto-pager><sw-pager .page=${m} .pages=${u} @page-change=${O=>this.page=O.detail.page}></sw-pager></div>`:c;d=o(ei||(ei=Qs(['<div class="lwrap"><scripts-panel .items='," .status="," .now="," .withFields="," .sensitiveWarning="," .hrefOf=",`
        @result=`," @changed="," @open-script=","><\/scripts-panel>","</div>"])),g,this.status,this.now,this.fieldScripts,this.status?.ui.sensitive_warning!==!1,O=>this.hrefOf("scripts",O),this.onResult,this.onChanged,O=>this.go(A("scripts",O.detail.id)),x)}else{const p=this.view==="cards"?this.perPage.cards:this.perPage.rows,u=zs(this.lists.paged,rs(this.phone?p.phone:p.wide,this.fitRows),r.length),m=os(r.length,u),g=ls(this.page,r.length,u),x=ds(r,g,u),O=z=>void this.toggle(z.detail.item,z.detail.enabled),W=this.view==="cards"?o`<div class="cgrid" data-auto-grid>${it(x,z=>z.id,z=>o`<automation-card .item=${z} .now=${this.now} .href=${this.hrefOf("automations",z.id)} .traceHref=${this.hrefOf("automations",z.id,{view:"trace"})}
            .sensitiveWarning=${this.status?.ui.sensitive_warning!==!1} .busy=${this.toggling.has(z.id)} @toggle=${O} @action=${this.onAction}></automation-card>`)}</div>`:o`<div class="rlist glass" role="table" aria-label=${i.label} data-auto-grid data-auto-rows>${it(x,z=>z.id,z=>o`<automation-row .item=${z} .now=${this.now} .href=${this.hrefOf("automations",z.id)} .busy=${this.toggling.has(z.id)} @toggle=${O} @action=${this.onAction}></automation-row>`)}</div>`;d=o`<div class="lwrap">${W}${m>1?o`<div class="lfoot" data-auto-pager><sw-pager .page=${g} .pages=${m} @page-change=${z=>this.page=z.detail.page}></sw-pager></div>`:c}</div>`}return o`${this.bannerRow(e)}${d}`}scenBody(){const e=this.scen;return e?e.enabled?e.can.view?o`<scenarios-panel .status=${e} .scenarioId=${this.scenId} @result=${this.onResult}
      @open-scenario=${t=>X(`/devices/automations/scenarios/${encodeURIComponent(t.detail.id)}`)} @close-scenario=${()=>X("/devices/automations/scenarios")}></scenarios-panel>`:this.stateBox("lock",v("noPermission"),"no_permission"):this.stateBox("settings",v("disabled"),"feature_disabled",e.can.admin?o`<a class="btn sm" href="#/system/automations" data-open-scen-settings>${v("settingsLink")}</a>`:void 0):this.skeleton()}dialogs(){if(this.confirm){const e=this.confirm;return o`<sw-dialog open heading=${k("להפעיל?")} data-dialog="enable" @close=${()=>this.confirm=null}><div class="dlgform">${at(e.item)?o`<p>${at(e.item)}</p>`:c}<div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${k("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.toggle(e.item,!0,!0)}>${k("הפעל")}</button></div></div></sw-dialog>`}return this.whenOpen?o`<sw-dialog open heading=${k("מתי?")} data-dialog="when" @close=${()=>this.whenOpen=!1}><div class="when">
        <button type="button" class="btn" data-when="time" @click=${()=>{this.whenOpen=!1,X("/devices/schedules/new/edit")}}>${w("calendar")}${k("בשעות קבועות")}</button>
        <button type="button" class="btn" data-when="event" @click=${()=>{this.whenOpen=!1;const e=ks("automation");X(e.path,e.params)}}>${w("bolt")}${k("כשמשהו קורה")}</button></div></sw-dialog>`:c}render(){const e=this.segment(),t=this.route,s=t.segment==="scripts"?"script":"automation",i=(!!t.id&&t.id!=="new"&&t.segment!=="scenes"||t.trash)&&!t.edit;return o`<sw-page class="page" heading=${this.scenView?v("title"):me(e).label} data-auto-title data-screen="devices-automations" data-segment=${this.scenView?"scenarios":e}>
      ${this.header(e)}
      ${this.scenView?this.scenBody():this.body(e)}
    </sw-page>
    ${this.drawerUsed||i?o`<automation-drawer .kind=${s} .itemId=${t.segment==="scenes"?"":t.id} .open=${i} .trash=${t.trash} .view=${t.view} .runId=${t.run} .status=${this.status} .now=${this.now} .action=${this.cardAction}
          @drawer-close=${this.onDrawerClose} @view-change=${this.onViewChange} @edit=${a=>X($s(a.detail.kind,a.detail.id))}
          @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult} @action-done=${this.onActionDone}></automation-drawer>`:c}
    ${this.editorSheet()}
    ${this.dialogs()}
    ${this.note?o`<div class=${`toast${this.note.tone==="error"?" bad":""}`} popover="manual" role="status" data-auto-note>${w(this.note.tone==="error"?"warning":"check")}${this.note.text}${this.note.action?o`<button type="button" class="btn sm" data-note-action @click=${()=>{const a=this.note?.action;this.note=null,a?.run()}}>${this.note.action.label}</button>`:c}</div>`:c}`}};E.styles=[Ce,...ye,Sn,B`
    /* PAGING-SETTING-2439 (owner round 32, Q-SYS-4 a: the page itself never moves): with the long lists set to scroll (הגדרות › כללי) the
       screen keeps its box on a desktop - the title, the chips, the toolbar and the banner stay - and only the list panel (.lwrap) scrolls */
    @media (min-width: 1024px) {
      :host([data-list-panel]) {
        overflow: hidden;
      }
      :host([data-list-panel]) sw-page.page {
        block-size: 100%;
        min-block-size: 0;
      }
      :host([data-list-panel]) .lwrap {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
    }
    /* FIX2200: the pager's keys meet the touch dial in the bubble skin (30x30 in the 2.20.0 bubble guard) */
    :host([data-skin='bubble']) sw-pager {
      --sw-ctl-h-md: var(--sw-touch-desktop);
    }
    /* AUDIT30-I3 (owner Q9 option a): dialogs are opaque (was the media sheet surface and its blur) */
    sw-dialog {
      --sw-surface: var(--sw-surface-solid);
      --sw-glass-blur: none;
    }
    /* AUDIT30-I4 (#6, #8): the page frame is the product's <sw-page>; the floor chips and the toolbar are the first rows of its body */
    sw-page.page {
      padding-block-start: var(--sw-s-4);
      gap: var(--sw-s-3);
    }
    .dh {
      position: static;
      padding-block-start: 0;
    }
    .dh-row.fl {
      display: flex;
    }
    /* on a desktop the floor chips stay in the title row (sw-page's actions, as before the frame change: the list keeps its rows);
       a long floor list scrolls sideways inside its own strip */
    .dh-row.hdact {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .dh-row.hdact .rooms {
      max-inline-size: 50vw;
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen floor chip is the Blue Wash pair (the shared media rule paints it --dv-text) */
    .rc[aria-pressed='true'] {
      ${ia}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${aa}
    }
    /* the owner's setting automations.sensitive_chip: red instead of amber, for every chip below (custom properties inherit through the shadow roots) */
    :host([data-sens='red']) {
      --au-sens-bg: var(--dv-danger-soft);
      --au-sens-fg: var(--dv-danger);
    }
    .dh-det .grow {
      min-inline-size: 0;
    }
    .search {
      min-inline-size: 260px;
    }
    .newbtn[disabled] {
      opacity: 0.5;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    /* POLISH4-WP4 (D25): from 768 to 1199 px the cards take whole rows of three (two at 768) instead of two, a tighter gap, so the
       cards view shows more than two cards a page where the height allows (the NOSCROLL fit still counts the rows; no new scroll) */
    @media (min-width: 768px) and (max-width: 1199px) {
      .cgrid {
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 264px), 1fr));
        gap: var(--sw-s-3);
      }
    }
    /* POLISH4-WP4 (D25): below the width where the toolbar holds the kinds, the state filter, the search and "+ חדש" in one line (about
       1400 px), the state filter folds behind "סינון" as it does on a phone - by the same setting (automations.phone_filter: fold, the
       default; "rows" keeps the filter's own row) - so the header is two rows at 1024 / 1180 instead of three. The open filter takes its
       own line under the toolbar. */
    @media (min-width: 768px) and (max-width: 1399px) {
      :host([data-phone-filter='fold']) .dh-det .stf {
        display: none;
      }
      :host([data-phone-filter='fold']) .dh-det .stf[data-open] {
        display: inline-flex;
        order: 9;
      }
      :host([data-phone-filter='fold']) .dh-det .foldbtn {
        display: inline-flex;
      }
      .dh-det .search {
        min-inline-size: 200px;
      }
    }
    .tools {
      display: contents;
    }
    /* POLISH-295: the rows list (the approved preview) and its pager */
    .rlist {
      padding: 0;
      overflow: visible;
    }
    .lwrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .lfoot {
      display: flex;
      justify-content: flex-end;
    }
    .foldbtn {
      display: none;
    }
    /* POLISH2-295: the view switch, as on the schedules screen */
    .vwrap {
      flex: none;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the view switch is sw-segmented (icon-only keys); its 40 / 44 px keys and the larger icon through the knobs */
    sw-segmented.views {
      --sw-seg-ico-pad: 12px;
      --sw-seg-key-min-w: 40px;
      --sw-seg-icon-size: var(--sw-fs-lg);
    }
    @media (pointer: coarse), (max-width: 1100px) {
      sw-segmented.views {
        --sw-seg-key-min-w: 44px;
      }
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4h);
    }
    /* the note is a popover (top layer): a modal drawer or dialog is open while most notes appear, and must not dim them.
       DEVICES-POLISH-2331: the inverted-surface tokens (--sw-toast-*) instead of white literals - the same note as the undo bar */
    .toast[popover] {
      inset-block-start: auto;
      margin-block: 0;
      padding: 11px 20px 11px 16px;
      border: 1px solid color-mix(in srgb, var(--sw-toast-text) 10%, transparent);
      overflow: visible;
    }
    .toast .btn {
      min-block-size: 28px;
      padding-inline: var(--sw-s-3);
      background: color-mix(in srgb, var(--sw-toast-text) 14%, transparent);
      color: var(--sw-toast-action);
      border-color: transparent;
      box-shadow: none;
      margin-inline-start: var(--sw-s-1h);
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding-block-start: var(--sw-s-1);
    }
    /* DEVICES-POLISH-2331: the loading state has the shape of the view it waits for - the rows list (the default) or the cards -
       so nothing jumps when the list lands */
    .skl-card {
      padding: var(--sw-s-4h);
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      border-radius: var(--sw-r-2xl);
    }
    .skl-rows {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: var(--sw-s-1h);
    }
    .skl-row {
      display: grid;
      grid-template-columns: 44px minmax(0, 1.1fr) minmax(0, 1.6fr) minmax(120px, 0.8fr);
      align-items: center;
      gap: var(--sw-s-3);
      min-block-size: 52px;
      padding-inline: var(--sw-s-3);
    }
    .skl-row .skl:first-child {
      block-size: 24px;
      border-radius: var(--sw-r-pill);
    }
    .skl-row .skl {
      block-size: 13px;
    }
    @media (max-width: 767px) {
      .skl-row {
        grid-template-columns: 44px minmax(0, 1fr) 30%;
      }
      .skl-row .skl:nth-child(3) {
        display: none;
      }
    }
    .dlgform p {
      margin: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .when {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .when .btn {
      justify-content: flex-start;
      min-block-size: 52px;
      font-size: var(--sw-fs-lg);
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't .' 'r r';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      /* POLISH2-295: on a phone the view is one icon button in the toolbar row (no extra row on a screen that must not scroll) */
      .dh-det .vtog {
        order: 3;
        flex: none;
        inline-size: 44px;
        padding: 0;
        justify-content: center;
      }
      .dh-det {
        gap: 10px;
      }
      /* CR-CMP2-TABS-2460: the kind strip takes the first line of the phone toolbar (sw-tabs fill="phone" shares it equally) */
      .dh-det sw-tabs.kinds {
        order: 1;
      }
      .dh-det .stf {
        order: 2;
        inline-size: 100%;
      }
      .dh-det .grow {
        display: none;
      }
      .dh-det .search {
        order: 3;
        flex: 1 1 0;
        min-inline-size: 0;
      }
      .dh-det .newbtn {
        order: 3;
      }
      :host([data-phone-filter='fold']) .stf {
        display: none;
      }
      :host([data-phone-filter='fold']) .stf[data-open] {
        display: inline-flex;
      }
      :host([data-phone-filter='fold']) .foldbtn {
        display: inline-flex;
        order: 3;
      }
      /* the strip stays one line and scrolls sideways (CR-CMP2-SEGMENTED-C-2450: sw-segmented keeps its keys on the line) */
      .dh-det .stf {
        overflow-x: auto;
        scrollbar-width: none;
        justify-content: flex-start;
        --sw-seg-wrap: nowrap;
      }
      .dh-det .stf::-webkit-scrollbar {
        display: none;
      }
    }
  `];D([b({attribute:!1})],E.prototype,"kavarnit",2);D([h()],E.prototype,"schedCount",2);D([h()],E.prototype,"scen",2);D([h()],E.prototype,"scenView",2);D([h()],E.prototype,"scenId",2);D([h()],E.prototype,"status",2);D([h()],E.prototype,"items",2);D([h()],E.prototype,"failed",2);D([h()],E.prototype,"noPerm",2);D([h()],E.prototype,"filters",2);D([h()],E.prototype,"route",2);D([h()],E.prototype,"compactHeader",2);D([h()],E.prototype,"phone",2);D([h()],E.prototype,"filtersOpen",2);D([h()],E.prototype,"note",2);D([h()],E.prototype,"toggling",2);D([h()],E.prototype,"confirm",2);D([h()],E.prototype,"whenOpen",2);D([h()],E.prototype,"drawerUsed",2);D([h()],E.prototype,"fieldScripts",2);D([h()],E.prototype,"now",2);D([h()],E.prototype,"cardAction",2);D([h()],E.prototype,"rawParams",2);D([h()],E.prototype,"tplDraft",2);D([h()],E.prototype,"view",2);D([h()],E.prototype,"perPage",2);D([h()],E.prototype,"page",2);D([h()],E.prototype,"fitRows",2);E=D([H("devices-automations")],E);export{Sl as BASE,E as DevicesAutomations};
