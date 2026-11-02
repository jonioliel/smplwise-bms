import{E as L,fk as xi,F as m,a as K,A as d,fl as f,e as r,H as W,G as u,fm as ie,fn as $e,fo as Ht,fp as Hs,fq as nt,fr as Ke,fs as zt,d3 as Gs,ft as le,fu as ki,fv as Pt,fw as Je,fx as St,fy as _i,fz as zi,fA as Ys,fB as Ks,bp as rt,fC as Js,fD as Gt,fE as Xs,bU as Le,fF as Si,fG as Oi,fH as Ei,fI as Di,fJ as Ti,fK as Yt,dB as Ci,fL as Ii,fM as Pi,fN as Ai,fO as Ni,fP as Ri,fQ as Li,fR as Kt,fS as Jt,dd as Xt,d7 as Bi,dc as Fi,fT as Zt,ey as Zs,fU as be,fV as j,fW as ji,fX as Qt,fY as Qs,fZ as ei,f_ as Mi,f$ as es,g0 as Ot,g1 as ti,g2 as qi,g3 as si,g4 as ii,g5 as Wi,g6 as Ui,g7 as ct,g8 as Et,g9 as Vi,ga as Hi,bv as Ze,gb as Gi,gc as Yi,gd as Ki,ge as Ji,gf as Xi,aj as Y,i as Xe,g as He,b9 as Zi,b6 as Ge,ba as Qi,gg as ea,gh as ai,C as ke,D as ve,S as _e,b as ze,q as I,gi as ta,gj as sa,ez as X,gk as ia,j as ts,gl as aa,eo as ss,r as Ie,dJ as na,bP as is,bx as ra,et as oa,b_ as la,gm as pt,br as da,ex as ca,eA as as,eB as pa,gn as ua,go as ha,gp as fa,gq as va,P as ut,eN as ma,eX as ns,f4 as rs,eY as os,e_ as ls,eu as ba}from"./index-D0R90ECk.js";import{r as At,c as Nt,b as Rt,a as g,f as Lt,w as ga,d as ht,e as ya,g as wa,O as $a,v as xa,h as ka,s as _a,j as za,k as ni,l as Qe,N as ds,p as cs,m as Pe,i as C,n as ps,o as ge,q as Sa,t as us,u as ye,x as hs,y as Oa,z as fs,A as Ea,B as Da,C as Ta,D as vs,E as Ca,S as Ia,F as Pa,G as Aa,H as Na,I as Ra}from"./automations-logic-DNsfntZP.js";import{J as qo}from"./automations-logic-DNsfntZP.js";import"./sw-pager-YtiNRTs_.js";import{l as La,s as Ba,a as Fa,g as ms,b as h,i as ft,n as bs,c as ja,d as Ma,e as qa,f as vt,h as Wa,t as Ua,j as Va,u as Ha,k as Ga,m as Ya,o as Ka,p as Ja,q as Xa,r as Za,v as Qa,w as en}from"./scenario-recipients-BCRqsp86.js";import{m as tn,a as sn}from"./media-page-BoI2xvwR.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-Dfy-IOPJ.js";const an=L`
  :host {
    --ab-motion: 200ms;
    --ab-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --ab-sheet: color-mix(in srgb, var(--dv-surface-solid, #f8fafd) 92%, transparent);
    --ab-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 46%);
    --ab-seg-thumb: #ffffff;
    --ab-amber-text: #8a4b00;
    --ab-sens-bg: var(--dv-warning-soft, rgba(255, 159, 10, 0.16));
    --ab-sens-fg: var(--ab-amber-text);
    --ab-sens-line: color-mix(in srgb, var(--dv-warning, #ff9f0a) 55%, transparent);
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
    --ab-sens-bg: var(--dv-danger-soft, rgba(255, 59, 48, 0.13));
    --ab-sens-fg: var(--dv-danger, #d70015);
    --ab-sens-line: color-mix(in srgb, var(--dv-danger, #d70015) 50%, transparent);
  }
  :host([data-chip='red'][data-devices-scheme='dark']) {
    --ab-sens-fg: #ff8a80;
  }
`,Se=[xi,L`
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
      font-weight: 600;
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
      color: var(--ab-ok-text, #1a7f37);
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
      font-weight: 600;
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
      font-weight: 600;
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
      font-weight: 600;
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
      font-weight: 600;
      color: var(--dv-text-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
    }
    .seg button[aria-pressed='true'],
    .seg button[aria-selected='true'] {
      background: var(--ab-seg-thumb, #fff);
      color: var(--dv-text);
      box-shadow: var(--dv-shadow-control, 0 1px 4px rgba(0, 0, 0, 0.18));
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
  `];var nn=Object.defineProperty,rn=Object.getOwnPropertyDescriptor,J=(e,t,s,i)=>{for(var a=i>1?void 0:i?rn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&nn(t,s,a),a};let H=class extends K{constructor(){super(...arguments),this.icon="bolt",this.heading="",this.chips=[],this.open=!1,this.locked=!1,this.invalid=!1,this.nested=!1,this.readonly=!1,this.canUp=!1,this.canDown=!1,this.canDuplicate=!0,this.uid=""}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}onKey(e){if(!e.altKey||e.key!=="ArrowUp"&&e.key!=="ArrowDown"||this.readonly)return;e.preventDefault();const t=e.key==="ArrowUp"?-1:1;(t<0&&this.canUp||t>0&&this.canDown)&&this.fire("card-move",{delta:t,from:"key"})}onDragStart(e){if(this.readonly)return;const t=this.shadowRoot?.querySelector(".blk");e.dataTransfer?.setData("text/plain",this.uid),e.dataTransfer&&(e.dataTransfer.effectAllowed="move",t&&e.dataTransfer.setDragImage(t,20,24)),this.fire("card-dragstart",{uid:this.uid})}render(){return r`<div class="blk">
      <div class="bh">
        <button class="grip" type="button" draggable="true" tabindex="-1" aria-label="גרירה" title="גרירה (Alt + חצים להזזה)" @dragstart=${this.onDragStart}>${f("grip")}</button>
        <button class="bm" type="button" aria-expanded=${this.open} data-block-main @click=${()=>this.fire("card-toggle")} @keydown=${this.onKey}>
          <span class="rg">${f(this.icon)}</span>
          <span class="bt"><b dir="auto">${this.heading}</b>${this.chips.length?r`<span class="sub">${this.chips.map(e=>this.chip(e))}</span>`:d}</span>
        </button>
        <button class="xb" type="button" aria-label="מחיקת החלק" data-block-remove @click=${()=>this.fire("card-remove")}>${f("close")}</button>
      </div>
      ${this.open?r`<div class="body">
        ${this.readonly?d:r`<div class="tools">
          <button type="button" aria-label="הזז למעלה" data-block-up ?disabled=${!this.canUp} @click=${()=>this.fire("card-move",{delta:-1,from:"button"})}>${f("arrowUp")}</button>
          <button type="button" aria-label="הזז למטה" data-block-down ?disabled=${!this.canDown} @click=${()=>this.fire("card-move",{delta:1,from:"button"})}>${f("arrowDown")}</button>
          ${this.canDuplicate?r`<button type="button" aria-label="שכפול" data-block-dup @click=${()=>this.fire("card-duplicate")}>${f("copy")}</button>`:d}
        </div>`}
        <slot></slot>
      </div>`:d}
    </div>`}chip(e){return e.tone==="code"?r`<code title=${e.title??""}>${e.text}</code>`:r`<span class="tag ${e.tone==="why"?"lock":e.tone}" title=${e.title??""}>${e.icon?f(e.icon):d}${e.text}</span>`}};H.styles=[Se,L`
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
    `];J([m()],H.prototype,"icon",2);J([m()],H.prototype,"heading",2);J([m({attribute:!1})],H.prototype,"chips",2);J([m({type:Boolean,reflect:!0})],H.prototype,"open",2);J([m({type:Boolean,reflect:!0})],H.prototype,"locked",2);J([m({type:Boolean,reflect:!0})],H.prototype,"invalid",2);J([m({type:Boolean,reflect:!0})],H.prototype,"nested",2);J([m({type:Boolean,reflect:!0})],H.prototype,"readonly",2);J([m({type:Boolean})],H.prototype,"canUp",2);J([m({type:Boolean})],H.prototype,"canDown",2);J([m({type:Boolean})],H.prototype,"canDuplicate",2);J([m()],H.prototype,"uid",2);H=J([W("sw-block-card")],H);var on=Object.defineProperty,ln=Object.getOwnPropertyDescriptor,We=(e,t,s,i)=>{for(var a=i>1?void 0:i?ln(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&on(t,s,a),a};const dn={motion:"motion",door:"door",users:"users",sunset:"sunset",drop:"drop",sun:"sun",clock:"clock"};let he=class extends K{constructor(){super(...arguments),this.enabled=!0,this.rows=[],this.phase="loading",this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.phase="loading";try{this.rows=this.enabled?(await ie().templates()).templates:[],this.phase="ready"}catch(e){this.error=$e(e),this.phase="error"}}pick(e){this.dispatchEvent(new CustomEvent("template-pick",{detail:{template:e},bubbles:!0,composed:!0}))}render(){return this.phase==="loading"?r`<div class="state" data-templates-state="loading">טוען…</div>`:this.phase==="error"?r`<div class="state err" data-templates-state="error">${this.error}</div>`:r`<div class="grid" data-templates>
      <button class="tpl blank" type="button" data-template="blank" @click=${()=>this.pick(null)}>
        <span class="tile">${f("plus")}</span><b>מאפס</b><small>כאשר · אם · אז</small>
      </button>
      ${this.rows.map(e=>r`<button class="tpl" type="button" data-template=${e.id} @click=${()=>this.pick(e)}>
        <span class="tile">${f(dn[e.icon]??"template")}</span><b>${e.name}</b><small>${e.description}</small>
        ${e.sensitive||e.suggest_schedule?r`<span class="tags">${e.sensitive?r`<span class="tag sens">${f("alarm")}רגיש כברירת מחדל</span>`:d}${e.suggest_schedule?r`<span class="tag acc">${f("calendar")}גם כתזמון</span>`:d}</span>`:d}
      </button>`)}
    </div>`}};he.styles=[Se,L`
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
        font-weight: 700;
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
        font-weight: 600;
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
    `];We([m({type:Boolean})],he.prototype,"enabled",2);We([u()],he.prototype,"rows",2);We([u()],he.prototype,"phase",2);We([u()],he.prototype,"error",2);he=We([W("automation-templates")],he);const ot=e=>e!==null&&typeof e=="object"&&!Array.isArray(e),F=e=>e===void 0?e:JSON.parse(JSON.stringify(e)),cn={entities:[],actions:{},notify_targets:[],scenes:[],scripts:[],floors:[],areas:[],shabbat_sensor:null};function pn(e){return e.floors.length===1&&!e.entities.some(t=>!t.floor&&!t.area&&t.actions.length)?{floors:[e.floors[0].id],areas:e.areas.map(t=>t.id)}:{floors:null,areas:null}}const Bt=new Map;function un(e,t){const s=new Map(t.entities.map(l=>[l.entity_id,l])),i=new Map(t.scenes.map(l=>[l.entity_id,l.name])),a=new Map(t.scripts.map(l=>[l.entity_id,l.name])),n=new Map(t.notify_targets.map(l=>[l.action,l.name])),o=pn(t);return{status:e,catalog:t,scope:o,byId:s,scoped:t.entities.length>0&&o.floors!==null,ctx:{names:l=>Gs({entity_id:l,name:s.get(l)?.name??i.get(l)??a.get(l)}),notifyName:l=>n.get(l)??null,shabbatSensor:t.shabbat_sensor,...t.allowed_actions?{allowedActions:t.allowed_actions}:{},wallButtons:!!t.extension?.wall_buttons,presenceEntity:t.extension?.presence_entity??null,presenceSensors:t.extension?.building_presence?.sensors??[],deviceName:l=>Bt.get(l)??null},notifyActions:t.notify_targets.length?t.notify_targets.map(l=>l.action):null,sensitiveChip:e.ui.sensitive_chip==="red"?"red":"amber",sensitiveWarning:e.ui.sensitive_warning!==!1}}function hn(e){return e==="alarm_control_panel.alarm_disarm"?"נטרול":e.startsWith("alarm_control_panel.")?"דריכה":e==="lock.unlock"?"פתיחת מנעול":e==="lock.lock"?"נעילה":e.startsWith("siren.")?"הפעלת צופר":e.startsWith("cover.")?/open/.test(e)?"פתיחת שער":"סגירת שער":"שליטה"}const gs=(e,t)=>`אין לך הרשאה ל${hn(e)} ב־${t}`;function fn(e){return e&&e in Ht?Ht[e]:"רגיש"}const Z="root";function Ue(e){const t=[];"triggers"in e?t.push({owner:Z,name:"triggers",blocks:e.triggers,section:"trigger"},{owner:Z,name:"conditions",blocks:e.conditions,section:"condition"},{owner:Z,name:"actions",blocks:e.actions,section:"action"}):"sequence"in e&&t.push({owner:Z,name:"sequence",blocks:e.sequence,section:"action"});for(const s of le(e))for(const i of Pt(s.block))t.push({owner:s.block.uid,name:i.name,blocks:i.blocks,section:i.section});return t}function ri(e,t,s,i=!1){const a=Ue(e).find(l=>l.owner===t&&l.name===s);if(a)return a.blocks;if(!i||t===Z)return null;const n=le(e).find(l=>l.block.uid===t);if(!n||n.block.kind!=="typed")return null;const o=n.block;return s==="else"&&o.type==="if"?o.else=[]:s==="default"&&o.type==="choose"?o.default=[]:null}function Oe(e,t){for(const s of Ue(e)){const i=s.blocks.findIndex(a=>a.uid===t);if(i>=0)return{owner:s.owner,name:s.name,index:i,list:s.blocks,section:s.section}}return null}function et(e,t=new Set){t.add(e.uid);for(const s of Pt(e))s.blocks.forEach(i=>et(i,t));return e.kind==="typed"&&e.type==="condition"&&et(e.condition,t),t}function tt(e){e.uid=nt();for(const t of Pt(e))t.blocks.forEach(s=>tt(s));return e.kind==="typed"&&e.type==="condition"&&tt(e.condition),e}function vn(e){for(const t of Ue(e))t.owner===Z&&t.blocks.forEach(s=>tt(s));return e}function mn(e,t,s,i,a){const n=F(e),o=ri(n,t,s,!0);return o&&o.splice(o.length,0,i),n}function bn(e,t){const s=F(e),i=Oe(s,t);return i&&i.list.splice(i.index,1),s}function gn(e,t,s){const i=F(e),a=Oe(i,t);if(!a)return i;const n=a.index+s;if(n<0||n>=a.list.length)return i;const[o]=a.list.splice(a.index,1);return a.list.splice(n,0,o),i}const yn=(e,t,s)=>{const i=Oe(e,t);return!!i&&i.index+s>=0&&i.index+s<i.list.length};function wn(e,t,s,i,a){const n=F(e),o=Oe(n,t);if(!o)return null;const l=Ue(n).find(v=>v.owner===s&&v.name===i);if(!l||l.section!==o.section)return null;const c=o.list[o.index];if(et(c).has(s))return null;o.list.splice(o.index,1);const p=l.blocks===o.list&&a>o.index?a-1:a;return l.blocks.splice(Math.max(0,Math.min(p,l.blocks.length)),0,c),n}function $n(e,t){const s=F(e),i=Oe(s,t);return i&&i.list.splice(i.index+1,0,tt(F(i.list[i.index]))),s}function xn(e,t,s){const i=F(e),a=le(i).find(n=>n.block.uid===t);return a&&s(a.block),i}const kn=e=>le(e).filter(t=>t.section==="action").length,O=e=>({uid:nt(),kind:"typed",raw:null,sentence:"",...e}),mt=e=>e&&e.length?e[0]:void 0,_n=e=>"triggers"in e&&e.triggers.some(t=>t.kind==="typed"?!!t.id:ot(t.raw)&&typeof t.raw.id=="string"),Ft="zone.home",Be=[{id:"state",label:"מצב מכשיר",hint:"כשמכשיר נדלק, נכבה, נפתח…",icon:"sensor",make:()=>O({type:"state",entity_ids:[],to:"on"})},{id:"time",label:"שעה קבועה",hint:"בשעה מסוימת",icon:"clock",make:()=>O({type:"time",at:"07:00"})},{id:"time_pattern",label:"כל X זמן",hint:"מחזורי",icon:"timer",make:()=>O({type:"time_pattern",minutes:"/5",hours:null,seconds:null})},{id:"sun",label:"זריחה / שקיעה",hint:"עם היסט לפני/אחרי",icon:"sunset",make:()=>O({type:"sun",event:"sunset",offset_min:0})},{id:"numeric",label:"ערך מעל / מתחת",hint:"טמפרטורה, לחות…",icon:"thermo",make:()=>O({type:"numeric_state",entity_ids:[],above:null,below:null})},{id:"presence",label:"נוכחות",hint:"כולם יצאו · מישהו חזר",icon:"users",make:()=>O({type:"numeric_state",entity_ids:[Ft],below:1,above:null})},{id:"start",label:"הפעלת המערכת",hint:"אחרי עלייה מחדש",icon:"power",make:()=>O({type:"homeassistant",event:"start"})}],Fe=[{id:"state",label:"מצב מכשיר",hint:"מכשיר במצב מסוים",icon:"sensor",make:()=>O({type:"state",entity_ids:[],state:"on"})},{id:"numeric",label:"ערך מעל / מתחת",hint:"טמפרטורה, לחות…",icon:"thermo",make:()=>O({type:"numeric_state",entity_ids:[],above:null,below:null})},{id:"time",label:"שעות וימים",hint:"אחרי / לפני, ימי השבוע",icon:"clock",make:()=>O({type:"time",after:"17:00"})},{id:"sun",label:"שקיעה / זריחה",hint:"אחרי השקיעה, לפני הזריחה",icon:"sunset",make:()=>O({type:"sun",after:"sunset"})},{id:"trigger",label:"מה הפעיל",hint:"לפי מזהה הטריגר",icon:"bolt",available:(e,t)=>_n(t),make:()=>O({type:"trigger",ids:[]})},{id:"shabbat",label:"שבת וחג",hint:"רק בשבת, או לא בשבת",icon:"calendar",available:e=>!!e.catalog.shabbat_sensor,make:()=>O({type:"shabbat",mode:"not_holy_days"})},{id:"or",label:"אחד מאלה",hint:"מספיק תנאי אחד",icon:"branch",make:()=>O({type:"or",conditions:[]})},{id:"and",label:"כל אלה",hint:"כל התנאים יחד",icon:"branch",make:()=>O({type:"and",conditions:[]})},{id:"not",label:"לא אלה",hint:"כשהתנאים לא מתקיימים",icon:"slash",make:()=>O({type:"not",conditions:[]})}],zn="alarm_control_panel.alarm_arm_away",Sn=[{id:"device",label:"שליטה במכשיר",hint:"הדלקה, כיבוי, טמפרטורה…",icon:"light",make:()=>O({type:"service",action:"light.turn_on",entity_ids:[],data:{},role:"device"})},{id:"scene",label:"הפעלת סצנה",hint:"סצנה קיימת",icon:"scene",available:e=>e.catalog.scenes.length>0,make:e=>{const t=mt(e.catalog.scenes)?.entity_id;return O({type:"service",action:"scene.turn_on",entity_ids:t?[t]:[],data:{},role:"scene"})}},{id:"script",label:"הרצת סקריפט",hint:"סקריפט קיים",icon:"script",available:e=>e.catalog.scripts.length>0,make:e=>{const t=mt(e.catalog.scripts)?.entity_id;return O({type:"service",action:t??"script.turn_on",entity_ids:t?[t]:[],data:{},role:"script"})}},{id:"notify",label:"שליחת התראה",hint:"לטלפון",icon:"bell",available:e=>e.catalog.notify_targets.length>0,make:e=>O({type:"service",action:mt(e.catalog.notify_targets)?.action??"notify.notify",entity_ids:[],data:{message:""},role:"notify"})},{id:"delay",label:"השהיה",hint:"להמתין לפני הצעד הבא",icon:"timer",make:()=>O({type:"delay",delay:{minutes:3}})},{id:"if",label:"אם / אחרת",hint:"צעדים לפי תנאי",icon:"question",make:()=>O({type:"if",conditions:[],then:[],else:null})},{id:"choose",label:"בחירה לפי תנאים",hint:"כמה ענפים",icon:"branch",make:()=>O({type:"choose",options:[{conditions:[],sequence:[]}],default:null})},{id:"repeat",label:"חזרה",hint:"כמה פעמים",icon:"repeat",make:()=>O({type:"repeat_count",count:3,sequence:[]})},{id:"condition",label:"המשך רק אם",hint:"עוצר אם התנאי לא מתקיים",icon:"question",make:()=>O({type:"condition",condition:O({type:"state",entity_ids:[],state:"on"})})},{id:"stop",label:"עצירה",hint:"מפסיק את הריצה",icon:"stop",make:()=>O({type:"stop",message:""})},{id:"sensitive",label:"פעולה רגישה",hint:"אזעקה, מנעול, שער, צופר",icon:"alarm",sensitive:!0,make:()=>O({type:"service",action:zn,entity_ids:[],data:{},role:"device"})}],oi={trigger:Be,condition:Fe,action:Sn},On={trigger:"מתי להפעיל?",condition:"רק אם…",action:"מה לעשות?"};function En(e,t,s){const i=oi[e].find(o=>o.id===t);if(!i)return null;const a=i.make(s);a.sentence=St(a,e,s.ctx);const n=a.condition;return n&&(n.sentence=St(n,"condition",s.ctx)),a}function jt(e){if(e.kind!=="typed")return null;const t=e;return t.type==="numeric_state"&&t.entity_ids.length===1&&t.entity_ids[0]===Ft&&t.below===1&&t.above==null?"all_left":t.type==="state"&&t.entity_ids.length>0&&t.entity_ids.every(s=>s.startsWith("person."))&&t.to==="home"?"someone_home":null}const Dn=e=>e.catalog.entities.filter(t=>t.domain==="person").map(t=>t.entity_id),li=[{value:"on",label:"דלוק / פעיל"},{value:"off",label:"כבוי"}];function Mt(e){const t=e??"",s=t.split(".")[0];return s==="binary_sensor"?/motion|occupancy|presence/.test(t)?[{value:"on",label:"זוהתה תנועה"},{value:"off",label:"אין תנועה"}]:/door|window|gate/.test(t)?[{value:"on",label:"פתוח"},{value:"off",label:"סגור"}]:/leak|water|flood/.test(t)?[{value:"on",label:"יש מים"},{value:"off",label:"יבש"}]:[{value:"on",label:"מופעל"},{value:"off",label:"כבוי"}]:s==="person"||s==="device_tracker"?[{value:"home",label:"בבית"},{value:"not_home",label:"לא בבית"}]:s==="climate"?[{value:"off",label:"כבוי"},{value:"cool",label:"קירור"},{value:"heat",label:"חימום"},{value:"auto",label:"אוטומטי"},{value:"fan_only",label:"מאוורר"},{value:"dry",label:"ייבוש"},{value:"heat_cool",label:"חימום/קירור"}]:s==="cover"?[{value:"open",label:"פתוח"},{value:"closed",label:"סגור"},{value:"opening",label:"נפתח"},{value:"closing",label:"נסגר"}]:s==="lock"?[{value:"locked",label:"נעול"},{value:"unlocked",label:"פתוח"}]:s==="alarm_control_panel"?[{value:"disarmed",label:"מנוטרלת"},{value:"armed_home",label:"דרוכה (בית)"},{value:"armed_away",label:"דרוכה (מלא)"},{value:"armed_night",label:"דרוכה (לילה)"},{value:"triggered",label:"מופעלת"}]:s==="media_player"?[{value:"off",label:"כבוי"},{value:"on",label:"דלוק"},{value:"playing",label:"מנגן"},{value:"paused",label:"מושהה"},{value:"idle",label:"לא מנגן"}]:li}const Tn={sun:"א׳",mon:"ב׳",tue:"ג׳",wed:"ד׳",thu:"ה׳",fri:"ו׳",sat:"ש׳"},Re={single:"התעלם",restart:"התחל מחדש",queued:"המתן בתור",parallel:"הרץ במקביל"},Cn={single:"אם מופעלת שוב בזמן ריצה – התעלם",restart:"אם מופעלת שוב – התחל מחדש",queued:"אם מופעלת שוב – המתן בתור",parallel:"ריצות במקביל"},di={light:"light",switch:"power",climate:"thermo",cover:"blind",alarm_control_panel:"alarm",lock:"lock",siren:"siren",media_player:"tv",fan:"wind",scene:"scene",script:"script",notify:"bell",automation:"bolt",input_boolean:"power",timer:"timer",select:"list",number:"thermo"};function oe(e){const t=e??"",s=t.split(".")[0];return s==="binary_sensor"?/motion|occupancy|presence/.test(t)?"motion":/door|window|gate/.test(t)?"door":/leak|water|flood/.test(t)?"drop":"sensor":s==="person"||s==="zone"||s==="device_tracker"?"users":s==="sensor"?/temp/.test(t)?"thermo":"sensor":/gate|garage/.test(t)&&s==="cover"?"gate":di[s]??"sensor"}function In(e,t){if(e.kind==="locked")return e.reason==="template"?"template":e.reason==="device"?"button":e.reason==="custom_service"?"script":"lock";const s=e;if(t==="trigger")switch(s.type){case"state":return oe(e.entity_ids?.[0]);case"numeric_state":return jt(e)?"users":oe(e.entity_ids?.[0])==="sensor"?"thermo":oe(e.entity_ids?.[0]);case"time":return"clock";case"time_pattern":return"timer";case"sun":return"sunset";case"button":return"button";default:return"power"}if(t==="condition")switch(s.type){case"state":case"numeric_state":return oe(e.entity_ids?.[0]);case"time":return"clock";case"sun":return"sunset";case"trigger":return"bolt";case"shabbat":return"calendar";case"presence":return"users";case"not":return"slash";default:return"branch"}switch(s.type){case"service":{const i=e;return i.role==="device"?oe(i.entity_ids[0]??i.action):di[i.role]??"bolt"}case"delay":return"timer";case"if":return"question";case"choose":return"branch";case"repeat_count":return"repeat";case"condition":return"question";default:return"stop"}}const ys={template:"תבנית – נשמרת כמו שהיא",device:"כפתור או מכשיר – נשמר כמו שהוא",purpose_trigger:"טריגר ייעודי – נשמר כמו שהוא",custom_service:"שירות מיוחד – נשמר כמו שהוא",service_not_allowed:"שירות שאינו מותר בבונה – נשמר כמו שהוא",unsupported_step:"צעד מתקדם – נשמר כמו שהוא",disabled_step:"צעד מושבת – נשמר כמו שהוא",secret:"ערך חסוי – לא מוצג",code:"קוד חסוי – לא מוצג",unknown:"חלק לא מוכר – נשמר כמו שהוא"},Pn=e=>ys[e.reason]??ys.unknown,An=/\{\{|\{%|\{#/;function Nn(e,t){let s=!1;const i=a=>s?a:typeof a=="string"?An.test(a)?(s=!0,t):a:Array.isArray(a)?a.map(i):ot(a)?Object.fromEntries(Object.entries(a).map(([n,o])=>[n,i(o)])):a;return i(e)}function Rn(e,t){const s=Nn(e.raw,t);return{...e,raw:s,template_text:t,fingerprint:Hs(s)}}function je(e){let t=0;const s=[];class i extends Error{constructor(v,b){super(b),this.pos=v}}const a=()=>{for(;t<e.length&&/\s/.test(e[t]);)t++},n=(p,v=t)=>{throw new i(v,p)},o=p=>p===void 0?"סוף הקוד":`"${p}"`,l=()=>{const p=t;t++;let v="";for(;t<e.length;){const b=e[t];if(b==='"')return t++,v;if(b===`
`&&n("מחרוזת לא נסגרת",p),b==="\\"){const w=e[t+1],_={n:`
`,t:"	",r:"\r",b:"\b",f:"\f",'"':'"',"\\":"\\","/":"/"};if(w==="u"){const x=e.slice(t+2,t+6);/^[0-9a-fA-F]{4}$/.test(x)||n("רצף \\u לא תקין"),v+=String.fromCharCode(parseInt(x,16)),t+=6;continue}w in _||n("רצף בריחה לא תקין"),v+=_[w],t+=2;continue}v+=b,t++}return n("מחרוזת לא נסגרת",p)},c=p=>{a();const v=t,b=e[t];let w;if(b==="{"){t++,a();const _={};if(e[t]==="}")t++;else for(;;){a(),e[t]!=='"'&&n(`צפוי שם שדה במירכאות, נמצא ${o(e[t])}`);const x=l();if(a(),e[t]!==":"&&n(`חסר ":" אחרי "${x}"`),t++,_[x]=c(!1),a(),e[t]===","){t++;continue}if(e[t]==="}"){t++;break}n(`צפוי "," או "}", נמצא ${o(e[t])}`)}w=_}else if(b==="["){t++,a();const _=[];if(e[t]==="]")t++;else for(;;){if(_.push(c(!0)),a(),e[t]===","){t++;continue}if(e[t]==="]"){t++;break}n(`צפוי "," או "]", נמצא ${o(e[t])}`)}w=_}else if(b==='"')w=l();else if(e.startsWith("true",t))t+=4,w=!0;else if(e.startsWith("false",t))t+=5,w=!1;else if(e.startsWith("null",t))t+=4,w=null;else{const _=/^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(e.slice(t));_||n(`תו לא צפוי ${o(b)}`),t+=_[0].length,w=Number(_[0])}return p&&(ot(w)||typeof w=="string")&&s.push({from:v,to:t,value:w}),w};try{const p=c(!1);return a(),t<e.length&&n(`תו לא צפוי ${o(e[t])} אחרי סוף האובייקט`),{ok:!0,value:p,ranges:s}}catch(p){if(!(p instanceof i))throw p;const v=e.slice(0,p.pos),b=v.split(`
`).length;return{ok:!1,pos:p.pos,line:b,column:p.pos-v.lastIndexOf(`
`),message:p.message}}}function Ln(e,t){const s=je(e);if(!s.ok||!t.size)return[];const i=[0];for(let o=0;o<e.length;o++)e[o]===`
`&&i.push(o+1);const a=o=>{let l=0,c=i.length-1;for(;l<c;){const p=l+c+1>>1;i[p]<=o?l=p:c=p-1}return l},n=[];for(const o of s.ranges){if(!t.has(Hs(o.value)))continue;const l=a(o.from),c=a(Math.max(o.from,o.to-1));n.some(p=>p.from<=l&&p.to>=c)||n.push({from:l,to:c})}return n}const bt=e=>{const t=new Set;for(const s of le(e))s.block.kind==="locked"&&t.add(s.block.fingerprint);return t},Bn=e=>`שורה ${e.line}, עמודה ${e.column} · ${e.message}`;function gt(e){const t=e?.config;return ot(t)?t:null}function Ae(e,t,s,i=null){try{return Ke(zt(e,t,null,s,{id:i}))}catch{return JSON.stringify(t)}}function ws(e,t,s){return e?"create":ki(t,s).length?"code":"replace"}const Fn={triggers:"כאשר",conditions:"אם",actions:"אז",sequence:"אז",alias:"שם",name:"שם",description:"תיאור",fields:"שדות",members:"מכשירים",mode:"אפשרויות",max:"אפשרויות",config:"קוד"},jn=e=>Fn[e.split(/[./[\]]+/).filter(Boolean)[0]??""]??"שגיאה";function Mn(e){return{where:jn(e.path),what:e.message}}function qn(...e){const t=new Set,s=[];for(const i of e)for(const a of i){const n=`${a.path}|${a.code}`;t.has(n)||(t.add(n),s.push(a))}return s}function Wn(e,t,s){const i=new Map,a=new Map;if(e)e.floors.forEach(o=>i.set(o.id,o.name)),e.areas.forEach(o=>a.set(o.id,o.name));else for(const o of _i(t)){const l=s.byId.get(o);l?.floor&&i.set(l.floor.id,l.floor.name),l?.area&&a.set(l.area.id,l.area.name)}const n=[...a.values()];return{floors:[...i.values()].join(" · "),areas:n.slice(0,3).join(" · "),more:Math.max(0,n.length-3)}}function Un(e,t,s,i){const a=[],n=(l,c,p)=>{c!==p&&a.push({group:l,change:"changed",mine:c||"—",theirs:p||"—"})},o=(l,c,p,v)=>{const b=B=>Ke(zi(B,v,i)),w=B=>St(B,v,i),_=p.map((B,dt)=>({x:B,i:dt,k:b(B)})),x=[];for(const B of c){const dt=b(B),Vt=_.findIndex($i=>$i.k===dt);Vt>=0?_.splice(Vt,1):x.push(B)}const A=Math.min(x.length,_.length);for(let B=0;B<A;B++)a.push({group:l,change:"changed",mine:w(x[B]),theirs:w(_[B].x)});for(const B of x.slice(A))a.push({group:l,change:"added",mine:w(B),theirs:"—"});for(const B of _.slice(A))a.push({group:l,change:"removed",mine:"—",theirs:w(B.x)})};if(e==="automation"){const l=t,c=s;n("שם",l.alias,c.alias),n("תיאור",l.description,c.description),n("אפשרויות",`${Re[l.mode]}${l.max?` · ${l.max}`:""}`,`${Re[c.mode]}${c.max?` · ${c.max}`:""}`),o("כאשר",l.triggers,c.triggers,"trigger"),o("אם",l.conditions,c.conditions,"condition"),o("אז",l.actions,c.actions,"action")}else if(e==="script"){const l=t,c=s;n("שם",l.alias,c.alias),n("תיאור",l.description,c.description),n("אפשרויות",Re[l.mode],Re[c.mode]),n("שדות",l.fields.map(p=>p.name).join(", "),c.fields.map(p=>p.name).join(", ")),o("אז",l.sequence,c.sequence,"action")}else{const l=t,c=s;n("שם",l.name,c.name);const p=b=>`${i.names?.(b.entity_id)??Gs(b)} · ${b.state}${Object.keys(b.attributes).length?` ${JSON.stringify(b.attributes)}`:""}`,v=new Map(c.members.map(b=>[b.entity_id,b]));for(const b of l.members){const w=v.get(b.entity_id);w?Ke(w)!==Ke(b)&&a.push({group:"מכשירים",change:"changed",mine:p(b),theirs:p(w)}):a.push({group:"מכשירים",change:"added",mine:p(b),theirs:"—"})}for(const b of c.members)l.members.some(w=>w.entity_id===b.entity_id)||a.push({group:"מכשירים",change:"removed",mine:"—",theirs:p(b)})}return a}const yt=[{value:"on",label:"דלוק"},{value:"off",label:"כבוי"}];function Dt(e){switch(e.split(".")[0]){case"light":return[{key:"state",label:"מצב",kind:"select",options:yt},{key:"brightness",label:"בהירות",kind:"number",min:1,max:100,step:1,unit:"%",only:"on"},{key:"color_temp_kelvin",label:"טמפרטורת צבע",kind:"number",min:2e3,max:6500,step:100,unit:"K",only:"on"}];case"switch":return[{key:"state",label:"מצב",kind:"select",options:yt}];case"fan":return[{key:"state",label:"מצב",kind:"select",options:yt},{key:"percentage",label:"מהירות",kind:"number",min:0,max:100,step:10,unit:"%",only:"on"}];case"cover":return[{key:"state",label:"מצב",kind:"select",options:[{value:"open",label:"פתוח"},{value:"closed",label:"סגור"}]},{key:"current_position",label:"מיקום",kind:"number",min:0,max:100,step:5,unit:"%"}];case"climate":return[{key:"state",label:"מצב",kind:"select",options:Mt(e)},{key:"temperature",label:"טמפרטורה",kind:"number",min:16,max:30,step:.5,unit:"°"}];case"media_player":return[{key:"state",label:"מצב",kind:"select",options:[{value:"on",label:"דלוק"},{value:"off",label:"כבוי"},{value:"playing",label:"מנגן"},{value:"paused",label:"מושהה"}]},{key:"volume_level",label:"עוצמה",kind:"number",min:0,max:100,step:5,unit:"%"}];case"lock":return[{key:"state",label:"מצב",kind:"select",options:[{value:"locked",label:"נעול"},{value:"unlocked",label:"פתוח"}]}];default:return[{key:"state",label:"מצב",kind:"select",options:li}]}}const Vn=(e,t)=>e.key==="brightness"?Math.round(t*100/255):e.key==="volume_level"?Math.round(t*100):t,Hn=(e,t)=>e.key==="brightness"?Math.round(t*255/100):e.key==="volume_level"?Math.round(t)/100:t;function Gn(e,t){const s=e.attributes[t.key];return typeof s=="number"?Vn(t,s):null}function $s(e,t,s){const i={entity_id:e.entity_id,state:e.state,attributes:{...e.attributes}};if(t.key==="state"){if(i.state=String(s??""),i.state==="off"||i.state==="closed"||i.state==="locked"||i.state==="unlocked")for(const a of Dt(e.entity_id).filter(n=>n.only==="on").map(n=>n.key))delete i.attributes[a];return i}return s===null||s===""||Number.isNaN(Number(s))?(delete i.attributes[t.key],i):(i.attributes[t.key]=Hn(t,Number(s)),i)}const Yn={light:"תאורה",switch:"מתג",fan:"מאוורר",cover:"תריס",climate:"מזגן",media_player:"מדיה",lock:"מנעול"},Kn={light:"תאורה",switch:"מתג",cover:"תריס",climate:"מזגן",fan:"מאוורר",media_player:"מדיה",lock:"מנעול",sensor:"חיישן",binary_sensor:"חיישן",person:"אדם",scene:"סצנה",script:"סקריפט"},xs={number:"מספר",boolean:"כן / לא",select:"בחירה",text:"טקסט",entity:"מכשיר"};function ks(e,t){let s=t.length+1;for(;t.includes(`field_${s}`);)s++;const i=e==="number"?{kind:"number",min:0,max:100,step:1}:e==="boolean"?{kind:"boolean"}:e==="select"?{kind:"select",options:["אפשרות 1","אפשרות 2"]}:e==="text"?{kind:"text"}:{kind:"entity",domains:[]};return{key:`field_${s}`,name:"",required:!1,default:void 0,selector:i}}function Jn(e){const t=e.selector;switch(t.kind){case"number":return`מספר ${t.min}–${t.max}${t.unit??""}`;case"boolean":return"כן / לא";case"select":return`בחירה: ${t.options.join(" · ")}`;case"text":return"טקסט";case"entity":return t.domains.length?`מכשיר (${t.domains.map(s=>Kn[s]??s).join(", ")})`:"מכשיר";default:return"שדה מתקדם · נעול"}}function Xn(e,t,s){return t==="trigger"?s>=Je.triggers_max:t==="condition"?s>=Je.conditions_max:kn(e)>=Je.steps_max}var Zn=Object.defineProperty,Qn=Object.getOwnPropertyDescriptor,me=(e,t,s,i)=>{for(var a=i>1?void 0:i?Qn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Zn(t,s,a),a};let ae=class extends K{constructor(){super(...arguments),this.env=null,this.filter={},this.where=null,this.selected=[],this.multi=!0,this.q=""}pick(e){const t=this.selected.includes(e.entity_id),s=this.multi?t?this.selected.filter(i=>i!==e.entity_id):[...this.selected,e.entity_id]:[e.entity_id];this.selected=s,this.dispatchEvent(new CustomEvent("picker-change",{detail:{ids:s},bubbles:!0,composed:!0})),this.multi||this.done()}done(){this.dispatchEvent(new CustomEvent("picker-done",{bubbles:!0,composed:!0}))}firstUpdated(){requestAnimationFrame(()=>this.shadowRoot?.querySelector("input")?.focus({preventScroll:!0}))}row(e){const t=this.selected.includes(e.entity_id);return r`<button class="prow" type="button" role="menuitemcheckbox" aria-checked=${t} data-picker-item=${e.entity_id} @click=${()=>this.pick(e)}>
      <span class="rg">${f(oe(e.entity_id))}</span>
      <span class="nm">${e.name}${e.state?r`<small>${e.state}</small>`:d}</span>
      ${e.class?r`<span class="tag sens">${f("alarm")}${fn(e.class)}</span>`:d}
      ${e.missing?r`<span class="tag bad">${f("warning")}חסר</span>`:d}
      <span class="ck">${t?f("check"):d}</span>
    </button>`}render(){const e=this.env;if(!e)return d;let t=Ys(e.catalog.entities,e.scope,{purpose:"target",...this.filter,q:this.q});this.where&&(t=t.filter(this.where));const s=Ks(t),i=s.filter(a=>a.floor).length>1;return r`<div class="ph">
        <label class="search">${f("search")}<input type="search" data-picker-search placeholder="חיפוש מכשיר" aria-label="חיפוש מכשיר" .value=${this.q} @input=${a=>this.q=a.target.value} /></label>
        ${e.scoped?r`<span class="tag acc">${f("layers")}${e.catalog.floors[0]?.name??""}</span>`:d}
      </div>
      <div class="pb" role="menu" aria-label="בחירת מכשירים">
        ${s.map(a=>r`${i&&a.floor?r`<h5 class="floor">${f("layers")}${a.floor.name}</h5>`:d}
          ${a.areas.map(n=>r`<div><h5>${n.area?n.area.name:r`${f("home")}כל הבית`}</h5>${n.entities.map(o=>this.row(o))}</div>`)}`)}
        ${t.length?d:r`<div class="none">לא נמצאו מכשירים</div>`}
      </div>
      <div class="pf"><span class="cnt"><em>${this.selected.length}</em> נבחרו</span><button class="btn primary sm" type="button" data-picker-done @click=${this.done}>${f("check")}סיום</button></div>`}};ae.styles=[Se,L`
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
        font-weight: 700;
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
        font-weight: 700;
        color: var(--dv-text);
      }
      .none {
        padding: 30px 10px;
        text-align: center;
        color: var(--dv-text-2);
        font-weight: 600;
      }
    `];me([m({attribute:!1})],ae.prototype,"env",2);me([m({attribute:!1})],ae.prototype,"filter",2);me([m({attribute:!1})],ae.prototype,"where",2);me([m({attribute:!1})],ae.prototype,"selected",2);me([m({type:Boolean})],ae.prototype,"multi",2);me([u()],ae.prototype,"q",2);ae=me([W("automation-entity-picker")],ae);var er=Object.defineProperty,tr=Object.getOwnPropertyDescriptor,Ee=(e,t,s,i)=>{for(var a=i>1?void 0:i?tr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&er(t,s,a),a};let de=class extends K{constructor(){super(...arguments),this.value="",this.locked=new Set,this.readonly=!1,this.scrollY=0}focusLine(e){const t=this.area;if(!t)return;const s=this.value.split(`
`).slice(0,e).reduce((i,a)=>i+a.length+1,0);t.focus({preventScroll:!0}),t.setSelectionRange(s,s),t.scrollTop=Math.max(0,e*20-60),this.scrollY=t.scrollTop}onInput(e){const t=e.target.value;this.value=t;const s=je(t);this.dispatchEvent(new CustomEvent("code-input",{detail:{text:t,ok:s.ok&&s.value!==null&&typeof s.value=="object"&&!Array.isArray(s.value)},bubbles:!0,composed:!0}))}render(){const e=this.value.split(`
`),t=je(this.value),s=Ln(this.value,this.locked),i=t.ok?-1:t.line-1,a=t.ok&&(t.value===null||typeof t.value!="object"||Array.isArray(t.value));return r`<div class="card">
        <div class="caph"><span class="tag">JSON</span>${this.locked.size?r`<span class="tag lock">${f("lock")}${this.locked.size===1?"חלק נעול":`${this.locked.size} חלקים נעולים`} · מסומנים</span>`:d}<span class="sp"></span><slot name="chips"></slot></div>
        <div class="wrap" data-code-wrap>
          <div class="layer"><div class="in" style=${`transform:translateY(${-this.scrollY}px)`}>
            ${s.map(n=>r`<div class="band" data-locked-band style=${`inset-block-start:${n.from*20}px;block-size:${(n.to-n.from+1)*20}px`}></div>`)}
            ${i>=0?r`<div class="band err" data-error-band style=${`inset-block-start:${i*20}px;block-size:20px`}></div>`:d}
          </div></div>
          <div class="nums" aria-hidden="true"><div class="in" style=${`transform:translateY(${-this.scrollY}px)`}>${e.map((n,o)=>r`<div>${o+1}</div>`)}</div></div>
          <textarea data-code-text spellcheck="false" aria-label="קוד האוטומציה" ?readonly=${this.readonly} .value=${this.value} @input=${this.onInput} @scroll=${n=>this.scrollY=n.target.scrollTop}></textarea>
        </div>
        ${t.ok?a?r`<div class="errline" role="alert" data-code-error>${f("warning")}<span>התוכן צריך להיות אובייקט</span></div>`:d:r`<div class="errline" role="alert" data-code-error>${f("warning")}<span>${Bn(t)}</span></div>`}
      </div>
      <div class="note"><slot name="note"></slot></div>`}};de.styles=[Se,L`
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
        text-align: right;
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
        padding: 10px 12px 10px 56px;
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
        text-align: left;
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
        font-weight: 600;
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
    `];Ee([m()],de.prototype,"value",2);Ee([m({attribute:!1})],de.prototype,"locked",2);Ee([m({type:Boolean})],de.prototype,"readonly",2);Ee([u()],de.prototype,"scrollY",2);Ee([rt("textarea")],de.prototype,"area",2);de=Ee([W("automation-code")],de);const P=(e,t,s="")=>r`<div class="fld ${s}"><label>${e}</label>${t}</div>`,_s={to:"עובר ל־",from:"מ־",event:"אירוע",when:"מתי",offset:"דקות",at:"שעה",every:"כל",unit:"יחידה",who:"מי",above:"מעל",below:"מתחת",after:"אחרי",before:"לפני",state:"במצב",mode:"מצב",sun:"שמש",action:"פעולה",scene:"סצנה",script:"סקריפט",target:"אל",message:"הודעה",count:"פעמים",id:"מזהה",hours:"שעות",minutes:"דקות",seconds:"שניות",brightness_pct:"בהירות",temperature:"טמפרטורה",position:"מיקום",volume_level:"עוצמה",percentage:"מהירות"},lt=(e,t)=>t??_s[e??""]??_s[(e??"").split(".").pop()??""]??"";function V(e,t,s,i="",a="",n){const o=t.some(l=>l.value===e)||e===""?t:[...t,{value:e,label:e}];return r`<select class="selx ${a}" data-fld=${i} aria-label=${lt(i,n)} @change=${l=>s(l.target.value)}>${o.map(l=>r`<option value=${l.value} ?selected=${l.value===e}>${l.label}</option>`)}</select>`}function Q(e,t,s={}){return r`<label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${s.attr??""} aria-label=${lt(s.attr,s.label)} placeholder=${s.ph??""} .value=${e==null?"":String(e)}
    @change=${i=>{const a=i.target.value.trim().replace(",","."),n=a===""?null:Number(a);t(n===null||!Number.isFinite(n)?null:s.min!==void 0&&n<s.min?s.min:s.max!==void 0&&n>s.max?s.max:n)}} />${s.unit?r`<span class="u">${s.unit}</span>`:d}</label>`}const Ve=(e,t,s={})=>r`<label class="inp"><input type="text" data-fld=${s.attr??""} aria-label=${lt(s.attr,s.label)} dir=${s.ltr?"ltr":"auto"} placeholder=${s.ph??""} .value=${e} @input=${i=>t(i.target.value)} /></label>`,Tt=(e,t,s)=>r`<label class="inp"><input class="n" type="time" lang=${Le()} step="60" data-fld=${s} aria-label=${lt(s)} .value=${(e??"").slice(0,5)} @change=${i=>t(i.target.value)} /></label>`;function qt(e,t,s){const i=(a,n)=>{const o={hours:e?.hours??0,minutes:e?.minutes??0,seconds:e?.seconds??0,[a]:n??0};t(o.hours||o.minutes||o.seconds?o:void 0)};return r`<div class="frow">
    <div class="fld sm"><label>שעות</label>${Q(e?.hours??0,a=>i("hours",a),{min:0,max:999,attr:`${s}.hours`})}</div>
    <div class="fld sm"><label>דקות</label>${Q(e?.minutes??0,a=>i("minutes",a),{min:0,max:59,attr:`${s}.minutes`})}</div>
    <div class="fld sm"><label>שניות</label>${Q(e?.seconds??0,a=>i("seconds",a),{min:0,max:59,attr:`${s}.seconds`})}</div>
  </div>`}const ci=e=>e?[e.hours?`${e.hours} שע׳`:"",e.minutes?`${e.minutes} דק׳`:"",e.seconds?`${e.seconds} שנ׳`:""].filter(Boolean).join(" "):"";function De(e,t,s){const i=e.env.ctx.names;return r`<div class="entpick" data-entity-chips>
    ${t.map(a=>{const n=e.env.byId.get(a);return r`<span class="ent ${n?.class?"sens":""}" title=${i(a)} data-entity=${a}>${f(oe(a))}<span>${i(a)}</span>${n?.area?r`<small>${n.area.name}</small>`:d}${n?.missing?r`<small class="bad">לא נמצא</small>`:d}
        <button class="rm" type="button" aria-label=${`הסרת ${i(a)}`} data-entity-remove=${a} @click=${()=>s.apply(t.filter(o=>o!==a))}>${f("close")}</button></span>`})}
    <button class="ent add" type="button" data-entity-add @click=${()=>e.pick({uid:e.block.uid,filter:s.filter,where:s.where,selected:t,multi:s.multi??!0,apply:s.apply})}>${f("plus")}${t.length?"עוד":s.add??"בחרו מכשיר"}</button>
  </div>`}const E=e=>{const t=e.issues.slice(0,3);return t.length?r`${t.map(s=>r`<div class="err" role="alert" data-block-error>${f("warning")}${s.message}</div>`)}`:d},Ne=e=>(e??"").split(".")[0],sr=(e,...t)=>{for(const s of t)(e[s]===void 0||e[s]===null)&&delete e[s];return e},ce=e=>{const t=e.block;return r`<details class="opts" ?open=${!!t.id}><summary>${f("chevronDown")}מזהה לטריגר${t.id?` · ${t.id}`:""}</summary>
    ${P('מזהה (לתנאי "מה הפעיל")',Ve(t.id??"",s=>e.patch(i=>{s.trim()?i.id=s.trim():delete i.id}),{ph:"למשל night",attr:"id",ltr:!0}))}</details>`},pi=(e,t)=>r`<details class="opts" ?open=${!!t.for}><summary>${f("chevronDown")}רק אם נשאר כך זמן מסוים${t.for?` · ${ci(t.for)}`:""}</summary>
    ${qt(t.for,s=>e.patch(i=>{s?i.for=s:delete i.for}),"for")}</details>`,ir=()=>({purpose:"watch",onlyTriggerable:!0});function ui(e,t){const s=e.block,i=n=>e.patch(o=>{const l={uid:o.uid,kind:o.kind,raw:o.raw,id:o.id,sentence:o.sentence};for(const c of Object.keys(o))delete o[c];n==="all_left"?Object.assign(o,l,{type:"numeric_state",entity_ids:[Ft],below:1,above:null}):Object.assign(o,l,{type:"state",entity_ids:Dn(e.env),to:"home"}),sr(o,"id")}),a="entity_ids"in s?s.entity_ids:[];return r`${E(e)}<div class="frow"><div class="fld">${P("מי",V(t,[{value:"all_left",label:"כולם יצאו מהבית"},{value:"someone_home",label:"מישהו חזר הביתה"}],n=>i(n),"who"))}</div></div>
    ${t==="someone_home"?r`${P("אנשים",De(e,a,{filter:{purpose:"watch",domains:["person"]},apply:n=>e.patch(o=>{o.entity_ids=n}),add:"בחרו אדם"}),"full")}`:d}
    ${ce(e)}`}const ar=e=>{const t=e.block,s=jt(t);if(s)return ui(e,s);const i=Mt(t.entity_ids[0]);return r`${E(e)}${De(e,t.entity_ids,{filter:ir(),apply:a=>e.patch(n=>{n.entity_ids=a})})}
    <div class="frow">
      <div class="fld">${P("עובר ל־",V(t.to??"",[{value:"",label:"כל שינוי"},...i],a=>e.patch(n=>{a?n.to=a:delete n.to}),"to"))}</div>
      <div class="fld">${P("מ־ (לא חובה)",V(t.from??"",[{value:"",label:"—"},...i],a=>e.patch(n=>{a?n.from=a:delete n.from}),"from"))}</div>
    </div>${pi(e,t)}${ce(e)}`},hi=()=>({filter:{purpose:"watch"},where:e=>e.triggers.includes("numeric_state")}),nr=e=>{const t=e.block,s=jt(t);if(s)return ui(e,s);const i=hi();return r`${E(e)}${De(e,t.entity_ids,{...i,apply:a=>e.patch(n=>{n.entity_ids=a})})}
    <div class="frow">
      <div class="fld sm"><label>מעל</label>${Q(t.above,a=>e.patch(n=>{a===null?delete n.above:n.above=a}),{attr:"above"})}</div>
      <div class="fld sm"><label>מתחת</label>${Q(t.below,a=>e.patch(n=>{a===null?delete n.below:n.below=a}),{attr:"below"})}</div>
    </div>${pi(e,t)}${ce(e)}`},rr=e=>{const t=e.block;return r`${E(e)}<div class="frow"><div class="fld sm"><label>שעה</label>${Tt(t.at,s=>e.patch(i=>{i.at=s}),"at")}</div></div>${ce(e)}`};function or(e){const t=["hours","minutes","seconds"].filter(i=>e[i]!=null);if(t.length!==1)return null;const s=/^\/(\d+)$/.exec(String(e[t[0]]));return s?{unit:t[0],n:Number(s[1])}:null}const lr=e=>{const t=e.block,s=or(t);if(!s){const a=(n,o)=>P(o,Ve(String(t[n]??""),l=>e.patch(c=>{c[n]=l.trim()?l.trim():null}),{attr:n,ltr:!0,ph:"*"}),"sm");return r`${E(e)}<div class="frow">${a("hours","שעות")}${a("minutes","דקות")}${a("seconds","שניות")}</div>${ce(e)}`}const i=(a,n)=>e.patch(o=>{o.hours=null,o.minutes=null,o.seconds=null,o[a]=`/${Math.max(1,n??1)}`});return r`${E(e)}<div class="frow">
    <div class="fld sm"><label>כל</label>${Q(s.n,a=>i(s.unit,a),{min:1,max:59,attr:"every"})}</div>
    <div class="fld sm"><label>יחידה</label>${V(s.unit,[{value:"minutes",label:"דקות"},{value:"hours",label:"שעות"},{value:"seconds",label:"שניות"}],a=>i(a,s.n),"unit")}</div>
  </div>${ce(e)}`},dr=e=>{const t=e.block,s=t.offset_min===0?"exact":t.offset_min<0?"before":"after",i=Math.abs(t.offset_min),a=(n,o)=>e.patch(l=>{l.offset_min=n==="before"?-o:n==="after"?o:0});return r`${E(e)}<div class="frow">
    <div class="fld">${P("אירוע",V(t.event,[{value:"sunset",label:"שקיעה"},{value:"sunrise",label:"זריחה"}],n=>e.patch(o=>{o.event=n}),"event"))}</div>
    <div class="fld">${P("מתי",V(s,[{value:"exact",label:"בדיוק"},{value:"before",label:"לפני"},{value:"after",label:"אחרי"}],n=>a(n,i||20),"when"))}</div>
    ${s==="exact"?d:r`<div class="fld sm"><label>דקות</label>${Q(i,n=>a(s,Math.max(1,n??1)),{min:1,max:600,attr:"offset"})}</div>`}
  </div>${ce(e)}`},cr=e=>r`${E(e)}<div class="codenote">${f("power")}מופעל פעם אחת אחרי שהמערכת עולה.</div>${ce(e)}`,pr=e=>{const t=e.block,s=Mt(t.entity_ids[0]),i=Array.isArray(t.state),a={purpose:"watch",onlyTriggerable:!0};return r`${E(e)}${De(e,t.entity_ids,{filter:a,apply:n=>e.patch(o=>{o.entity_ids=n})})}
    ${i?P("במצב",r`<div class="rolechips">${s.map(n=>r`<button type="button" aria-pressed=${t.state.includes(n.value)} @click=${()=>e.patch(o=>{const l=o.state;o.state=l.includes(n.value)?l.filter(c=>c!==n.value):[...l,n.value]})}>${n.label}</button>`)}</div>`):r`<div class="frow"><div class="fld">${P("במצב",V(String(t.state),s,n=>e.patch(o=>{o.state=n}),"state"))}</div></div>`}
    <details class="opts" ?open=${!!t.for}><summary>${f("chevronDown")}רק אם נשאר כך זמן מסוים${t.for?` · ${ci(t.for)}`:""}</summary>${qt(t.for,n=>e.patch(o=>{n?o.for=n:delete o.for}),"for")}</details>`},ur=e=>{const t=e.block,s=hi();return r`${E(e)}${De(e,t.entity_ids,{...s,apply:i=>e.patch(a=>{a.entity_ids=i})})}
    <div class="frow">
      <div class="fld sm"><label>מעל</label>${Q(t.above,i=>e.patch(a=>{i===null?delete a.above:a.above=i}),{attr:"above"})}</div>
      <div class="fld sm"><label>מתחת</label>${Q(t.below,i=>e.patch(a=>{i===null?delete a.below:a.below=i}),{attr:"below"})}</div>
    </div>`},hr=e=>{const t=e.block,s=t.weekday??[];return r`${E(e)}<div class="frow">
      <div class="fld sm"><label>אחרי</label>${Tt(t.after,i=>e.patch(a=>{i?a.after=i:delete a.after}),"after")}</div>
      <div class="fld sm"><label>לפני</label>${Tt(t.before,i=>e.patch(a=>{i?a.before=i:delete a.before}),"before")}</div>
    </div>
    ${P("ימים",r`<div class="rolechips">${Gt.map(i=>r`<button type="button" data-weekday=${i} aria-pressed=${s.includes(i)} @click=${()=>e.patch(a=>{const n=a.weekday??[],o=n.includes(i)?n.filter(l=>l!==i):[...n,i];o.length?a.weekday=Gt.filter(l=>o.includes(l)):delete a.weekday})}>${Tn[i]}</button>`)}</div>`)}`},wt=[{value:"after:sunset",label:"אחרי השקיעה",after:"sunset"},{value:"before:sunrise",label:"לפני הזריחה",before:"sunrise"},{value:"after:sunrise",label:"אחרי הזריחה",after:"sunrise"},{value:"before:sunset",label:"לפני השקיעה",before:"sunset"},{value:"night",label:"בין השקיעה לזריחה (לילה)",after:"sunset",before:"sunrise"},{value:"day",label:"בין הזריחה לשקיעה (יום)",after:"sunrise",before:"sunset"}],fr=e=>{const t=e.block,s=wt.find(i=>(i.after??null)===(t.after??null)&&(i.before??null)===(t.before??null))?.value??"after:sunset";return r`${E(e)}<div class="frow"><div class="fld">${V(s,wt,i=>{const a=wt.find(n=>n.value===i);e.patch(n=>{delete n.after,delete n.before,a.after&&(n.after=a.after),a.before&&(n.before=a.before)})},"sun")}</div></div>`},vr=e=>{const t=e.block;return r`${E(e)}${P("הטריגרים",e.triggerIds.length?r`<div class="rolechips">${e.triggerIds.map(s=>r`<button type="button" aria-pressed=${t.ids.includes(s)} @click=${()=>e.patch(i=>{const a=i.ids;i.ids=a.includes(s)?a.filter(n=>n!==s):[...a,s]})}>${s}</button>`)}</div>`:r`<small>תנו מזהה לטריגר קודם</small>`)}`},mr=e=>{const t=e.block;return r`${E(e)}<div class="frow"><div class="fld">${V(t.mode,[{value:"only_holy_days",label:"רק בשבת וחג"},{value:"not_holy_days",label:"לא בשבת וחג"}],s=>e.patch(i=>{i.mode=s}),"mode")}</div></div>`},$t=e=>r`${E(e)}${e.nested(e.block.uid,"conditions","condition")}`;function br(e,t,s){const i=(a,n)=>e.patch(o=>{n==null||n===""?delete o.data[a]:o.data[a]=n});return r`${s.length?r`<div class="frow">${s.map(a=>{const n=t.data[a.key];return a.kind==="number"?r`<div class="fld sm"><label>${a.label}</label>${Q(typeof n=="number"?n:null,o=>i(a.key,o),{unit:a.unit,min:a.min,max:a.max,attr:`data.${a.key}`,label:a.label})}</div>`:a.kind==="select"?r`<div class="fld">${P(a.label,V(String(n??""),[{value:"",label:"—"},...a.options??[]],o=>i(a.key,o),`data.${a.key}`,"",a.label))}</div>`:a.kind==="boolean"?r`<div class="fld sm"><label>${a.label}</label><div class="rolechips"><button type="button" aria-pressed=${n===!0} @click=${()=>i(a.key,n===!0?null:!0)}>כן</button></div></div>`:r`<div class="fld">${P(a.label,Ve(String(n??""),o=>i(a.key,o),{attr:`data.${a.key}`,label:a.label}))}</div>`})}</div>`:d}`}const gr=(e,t)=>t.role==="device"&&(t.entity_ids.length?t.entity_ids:[""]).map(i=>Xs(t.action,i?e.env.byId.get(i)?.class??null:null)).find(Boolean)?r`<div class="sensrow" data-sensitive-row>${f("alarm")}<span>פעולה רגישה. מותרת לך כמו בשליטה ידנית; קוד לא נשמר.</span></div>`:d;function yr(e,t){const s=t.entity_ids[0],i=Ne(s)||Ne(t.action),a=e.env.catalog.actions[i]??[],n=a.find(v=>v.action===t.action),o=!t.entity_ids.length&&Xs(t.action,null)!==null,l={purpose:"target",controllable:!0,...t.entity_ids.length?{domains:[Ne(s)]}:{},...o?{sensitive:!0}:{}},c=v=>e.patch(b=>{b.entity_ids=v;const w=Ne(v[0]);if(w&&Ne(b.action)!==w){const _=e.env.catalog.actions[w];_?.length&&(b.action=_[0].action,b.data={})}}),p=a.length?a.map(v=>({value:v.action,label:v.label||v.action})):[{value:t.action,label:t.action}];return r`${E(e)}${De(e,t.entity_ids,{filter:l,apply:c})}
    <div class="frow"><div class="fld">${P("פעולה",V(t.action,p,v=>e.patch(b=>{b.action=v,b.data={}}),"action"))}</div></div>
    ${br(e,t,n?.args??[])}${gr(e,t)}`}function wr(e,t){const i=(e.env.catalog.scripts.find(n=>n.entity_id===t.action)?.fields??[]).filter(n=>n.selector.kind!=="locked");if(!i.length)return d;const a=(n,o)=>e.patch(l=>{o==null||o===""?delete l.data[n]:l.data[n]=o});return r`<div class="frow">${i.map(n=>{const o=t.data[n.key],l=n.selector;return l.kind==="number"?r`<div class="fld sm"><label>${n.name}</label>${Q(typeof o=="number"?o:n.default??null,c=>a(n.key,c),{min:l.min,max:l.max,unit:l.unit,attr:`data.${n.key}`,label:n.name})}</div>`:l.kind==="select"?r`<div class="fld">${P(n.name,V(String(o??n.default??""),[{value:"",label:"—"},...l.options.map(c=>({value:c,label:c}))],c=>a(n.key,c),`data.${n.key}`,"",n.name))}</div>`:l.kind==="boolean"?r`<div class="fld sm"><label>${n.name}</label><div class="rolechips"><button type="button" aria-pressed=${(o??n.default)===!0} @click=${()=>a(n.key,(o??n.default)!==!0)}>כן</button></div></div>`:r`<div class="fld">${P(n.name,Ve(String(o??n.default??""),c=>a(n.key,c),{attr:`data.${n.key}`,label:n.name}))}</div>`})}</div>`}const $r=e=>{const t=e.block;switch(t.role){case"scene":return r`${E(e)}<div class="frow"><div class="fld">${P("סצנה",V(t.entity_ids[0]??"",[{value:"",label:"בחרו סצנה"},...e.env.catalog.scenes.map(s=>({value:s.entity_id,label:s.area?`${s.name} · ${s.area}`:s.name}))],s=>e.patch(i=>{i.entity_ids=s?[s]:[]}),"scene"))}</div></div>`;case"script":return r`${E(e)}<div class="frow"><div class="fld">${P("סקריפט",V(t.entity_ids[0]??"",[{value:"",label:"בחרו סקריפט"},...e.env.catalog.scripts.map(s=>({value:s.entity_id,label:s.name}))],s=>e.patch(i=>{i.action=s||"script.turn_on",i.entity_ids=s?[s]:[],i.data={}}),"script"))}</div></div>${wr(e,t)}`;case"notify":return r`${E(e)}<div class="frow"><div class="fld">${P("אל",V(t.action,e.env.catalog.notify_targets.length?e.env.catalog.notify_targets.map(s=>({value:s.action,label:s.name})):[{value:t.action,label:e.env.ctx.notifyName?.(t.action)??t.action}],s=>e.patch(i=>{i.action=s}),"target"))}</div></div>
        ${P("הודעה",r`<label class="inp"><input type="text" data-fld="message" aria-label="הודעה" dir="auto" placeholder="מה לכתוב" .value=${typeof t.data.message=="string"?t.data.message:""} @input=${s=>e.patch(i=>{i.data.message=s.target.value})} /></label>`)}`;case"automation":return r`${E(e)}<div class="codenote">${f("bolt")}שולט באוטומציה אחרת. אפשר להזיז או למחוק.</div>`;default:return yr(e,t)}},xr=e=>{const t=e.block;return r`${E(e)}${qt(t.delay,s=>e.patch(i=>{i.delay=s??{}}),"delay")}`},xe=(e,t)=>{const s=e==="then"?"play":e==="else"?"shuffle":"question",i=e==="if"?"אם":e==="then"?"אז":e==="else"?"אחרת":`ענף ${t} · אם`;return r`<h4 class="sub-h"><span class="k ${e==="then"?"then":"if"}">${f(s,12)}</span>${i}</h4>`},kr=e=>r`${E(e)}<div class="bsec">${xe("if")}${e.nested(e.block.uid,"if","condition")}</div>
  <div class="bsec">${xe("then")}${e.nested(e.block.uid,"then","action")}</div>
  <div class="bsec">${xe("else")}${e.nested(e.block.uid,"else","action")}</div>`,_r=e=>{const t=e.block;return r`${E(e)}${t.options.map((s,i)=>r`<div class="bsec" data-choose-option=${i}>
      <div class="opt-h">${xe("opt",i+1)}${t.options.length>1?r`<button class="btn quiet sm" type="button" data-option-remove=${i} @click=${()=>e.patch(a=>{a.options.splice(i,1)})}>${f("trash")}הסר ענף</button>`:d}</div>
      ${e.nested(e.block.uid,`choose.${i}.conditions`,"condition")}
      ${xe("then")}${e.nested(e.block.uid,`choose.${i}.sequence`,"action")}</div>`)}
    ${t.options.length<Je.choose_options_max?r`<button class="btn quiet sm" type="button" data-option-add @click=${()=>e.patch(s=>{s.options.push({conditions:[],sequence:[]})})}>${f("plus")}ענף נוסף</button>`:d}
    ${t.default?r`<div class="bsec">${xe("else")}${e.nested(e.block.uid,"default","action")}</div>`:r`<button class="btn quiet sm" type="button" data-default-add @click=${()=>e.patch(s=>{s.default=[]})}>${f("plus")}ענף "אחרת"</button>`}`},zr=e=>{const t=e.block;return r`${E(e)}<div class="frow"><div class="fld sm"><label>פעמים</label>${Q(t.count,s=>e.patch(i=>{i.count=Math.round(s??1)}),{min:1,max:1e3,attr:"count"})}</div></div>
    <div class="bsec">${e.nested(e.block.uid,"repeat.sequence","action")}</div>`},Sr=e=>{const t=e.block.condition,s=ue[`condition:${t.type}`];return r`${E(e)}${s?s(e.child(t,"condition")):d}`},Or=e=>{const t=e.block;return r`${E(e)}${P("הודעה (לא חובה)",Ve(t.message,s=>e.patch(i=>{i.message=s}),{attr:"message",ph:"למה עוצרים"}))}`},ue={"trigger:state":ar,"trigger:numeric_state":nr,"trigger:time":rr,"trigger:time_pattern":lr,"trigger:sun":dr,"trigger:homeassistant":cr,"condition:state":pr,"condition:numeric_state":ur,"condition:time":hr,"condition:sun":fr,"condition:trigger":vr,"condition:shabbat":mr,"condition:and":$t,"condition:or":$t,"condition:not":$t,"action:service":$r,"action:delay":xr,"action:if":kr,"action:choose":_r,"action:repeat_count":zr,"action:condition":Sr,"action:stop":Or};function fi(e){const t=e.block;if(t.kind==="locked")return Er(e,t);const s=ue[`${e.section}:${t.type}`];return s?s(e):r`<div class="codenote">${f("info")}אין טופס לחלק הזה.</div>`}function Er(e,t){const s=JSON.stringify(t.raw,null,2).split(`
`),i=e.canCode&&!t.masked&&t.reason==="template"&&typeof t.template_text=="string";return r`<div class="codenote" data-locked-note>${f("lock")}<span>${Pn(t)}. אפשר להזיז, לשכפל או למחוק${e.canCode?"; לעריכה – תצוגת הקוד":""}.</span></div>
    ${Js(t)?r`<div class="codenote">${f("calendar")}שולט בתזמונים של המערכת.</div>`:d}
    ${i?r`<div class="fld full"><label><span class="tag lock">{{ }}</span> טקסט התבנית</label>
      <label class="inp area"><textarea rows="3" dir="ltr" data-template-text aria-label="טקסט התבנית" .value=${t.template_text??""} @change=${a=>e.editTemplate(t.uid,a.target.value)}></textarea></label></div>`:d}
    <div class="lockcode" data-locked-code dir="ltr">${s.map(a=>r`<span class="ln">${a}</span>`)}</div>
    ${e.canCode?r`<div class="frow"><button class="btn sm" type="button" data-goto-code @click=${e.gotoCode}>${f("code")}ערוך בקוד</button></div>`:d}`}const Dr=L`
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
    font-weight: 600;
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
    font-weight: 500;
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
    font-weight: 600;
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
    font-weight: 600;
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
    font-weight: 600;
  }
  .bsec {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sub-h {
    margin: 4px 0 0;
    font-size: var(--sw-fs-base);
    font-weight: 700;
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
    text-align: left;
  }
  .lockcode .ln {
    display: block;
    white-space: pre;
  }
`;var Tr=Object.defineProperty,Cr=Object.getOwnPropertyDescriptor,Te=(e,t,s,i)=>{for(var a=i>1?void 0:i?Cr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Tr(t,s,a),a};const vi=e=>({uid:nt(),kind:"typed",raw:null,sentence:"",...e}),zs={id:"button",label:"כפתור קיר",hint:"לחיצה על מפסק",icon:"button",available:e=>!!e.catalog.extension?.wall_buttons,make:()=>vi({type:"button",device_id:"",domain:"",ha_type:"remote_button_short_press",ha_subtype:"button_1",button:1,press:"short",extra:{}})},Ss={id:"presence_in",label:"מי במבנה",hint:"יש מישהו · אין אף אחד",icon:"users",available:e=>!!e.catalog.extension?.presence,make:()=>vi({type:"presence",mode:"nobody",where:"building"})};Be.some(e=>e.id===zs.id)||Be.splice(1,0,zs);Fe.some(e=>e.id===Ss.id)||Fe.splice(5,0,Ss);let Ir=null;const Os=new Map,Pr=()=>Ir??=Di().then(e=>(e.devices.forEach(t=>Bt.set(t.device_id,t.name)),e.devices)).catch(()=>[]),Es=(e,t)=>{const s=`${e}|${t??""}`;let i=Os.get(s);return i||(i=Ti(e,t).catch(()=>({device_id:e,buttons:[],source:"stored"})),Os.set(s,i)),i};function mi(e,t,s){const i=e?.buttons.find(a=>a.button===t)?.presses.find(a=>a.press===s);return i?{ha_type:i.ha_type,ha_subtype:i.ha_subtype,domain:i.domain,...i.discovery_id?{discovery_id:i.discovery_id}:{}}:null}function xt(e,t,s,i){const a=mi(t,s,i);e.patch(n=>{n.button=s,n.press=i,a&&(n.ha_type=a.ha_type,n.ha_subtype=a.ha_subtype,a.domain&&a.domain!=="unknown"&&(n.domain=a.domain),n.extra=a.discovery_id?{discovery_id:a.discovery_id}:{})})}let fe=class extends K{constructor(){super(...arguments),this.fc=null,this.devices=null,this.buttons=null,this.listening=!1,this.note="",this.loadedFor=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),Pr().then(e=>{this.devices=e})}willUpdate(){const e=this.fc?.block,t=e?.device_id?`${e.device_id}|${this.fc?.itemId??""}`:"";t&&t!==this.loadedFor&&(this.loadedFor=t,Es(e.device_id,this.fc?.itemId??null).then(s=>{this.loadedFor===t&&(this.buttons=s)}))}async detect(){const e=this.fc,t=e?.block;if(!(!e||!t?.device_id||this.listening)){this.listening=!0,this.note="";try{const s=await Si(t.device_id);s.detected&&s.button&&s.press?xt(this.fc,this.buttons,s.button,s.press):this.note="לא זוהתה לחיצה"}catch{this.note="לא זוהתה לחיצה"}this.listening=!1}}async pickDevice(e){const t=this.fc;if(!t)return;this.buttons=null;const s=e?await Es(e,t.itemId??null):null;this.buttons=s,this.loadedFor=e?`${e}|${t.itemId??""}`:"";const i=s?.buttons[0]?.presses[0];this.fc.patch(a=>{a.device_id=e,i&&s&&(a.domain=i.domain,a.ha_type=i.ha_type,a.ha_subtype=i.ha_subtype,a.button=s.buttons[0].button,a.press=i.press,a.extra=i.discovery_id?{discovery_id:i.discovery_id}:{})})}render(){const e=this.fc;if(!e)return d;const t=e.block,s=e.env.catalog.extension?.wall_timing,i=this.devices?.find(l=>l.device_id===t.device_id)??null,a=this.buttons,n=a?.buttons.length?a.buttons:Array.from({length:Math.max(t.button||1,1)},(l,c)=>({button:c+1,presses:[],used:!1})),o=(l,c)=>!a?.buttons.length||!!mi(a,l,c);return r`<div class="kav-tools"><span class="sp"></span>
        <button class="btn sm" type="button" data-kav-detect ?disabled=${!t.device_id||this.listening} @click=${()=>void this.detect()}>${f("flask")}${this.listening?"מאזינים ללחיצה…":"זיהוי בלחיצה על הכפתור"}</button></div>
      ${this.note?r`<div class="err" role="status" data-kav-detect-note>${f("info")}${this.note}</div>`:d}
      <div class="fld"><label>מפסק או כפתור קיר</label>
        <select class="selx" data-kav-device aria-label="מפסק" @change=${l=>void this.pickDevice(l.target.value)}>
          ${t.device_id?d:r`<option value="" selected>בחרו מפסק</option>`}
          ${(this.devices??[]).map(l=>r`<option value=${l.device_id} ?selected=${l.device_id===t.device_id}>${l.name}${l.area?` · ${l.area}`:""}</option>`)}
          ${t.device_id&&!i?r`<option value=${t.device_id} selected>${Bt.get(t.device_id)??"מפסק"}</option>`:d}
        </select></div>
      <div class="fld"><label>כפתור</label>
        <div class="kav-btns" role="group" aria-label="כפתור" data-kav-buttons>${n.map(l=>r`<button type="button" aria-pressed=${String(l.button===t.button)} data-kav-button=${l.button}
          @click=${()=>xt(e,a,l.button,o(l.button,t.press)?t.press:a?.buttons.find(c=>c.button===l.button)?.presses[0]?.press??t.press)}>${l.button}${l.used?r`<small>בשימוש</small>`:d}</button>`)}</div></div>
      <div class="fld"><label>סוג לחיצה</label>
        <div class="kav-press" role="group" aria-label="סוג לחיצה" data-kav-press>${Oi.map(l=>r`<button type="button" aria-pressed=${String(l===t.press)} ?disabled=${!o(t.button,l)} data-kav-press-kind=${l}
          @click=${()=>xt(e,a,t.button,l)}><span class="pi ${l}"><i></i>${l==="double"?r`<i></i>`:d}</span>${Ei[l].replace("לחיצה ","")}
          <small>${l==="short"?"לחיצה אחת":l==="double"?r`עד <bdi>${s?.double_ms??400}</bdi> מ״ש בין לחיצות`:r`מעל <bdi>${s?.long_ms??800}</bdi> מ״ש`}</small></button>`)}</div>
        <span class="kav-note">הזמנים נקבעים בהגדרות ‹ אוטומציות · <a href="#/system/automations">שינוי</a></span></div>`}};Te([m({attribute:!1})],fe.prototype,"fc",2);Te([u()],fe.prototype,"devices",2);Te([u()],fe.prototype,"buttons",2);Te([u()],fe.prototype,"listening",2);Te([u()],fe.prototype,"note",2);fe=Te([W("kav-button-form")],fe);const Ar=e=>r`<kav-button-form .fc=${e} data-kav-button-form></kav-button-form>`;function Nr(e){const t=e.block,s=e.env.catalog.extension?.presence_sources,i=(a,n,o,l=d,c=!1)=>r`<span class="kav-src" aria-pressed=${String(a&&!c)} aria-disabled=${String(c)} data-kav-source=${o}>${f(n)}${o}${l}</span>`;return r`<div class="frow">
      <div class="fld"><label>מצב</label><select class="selx" data-kav-presence-mode aria-label="מצב" @change=${a=>e.patch(n=>{n.mode=a.target.value})}>
        <option value="nobody" ?selected=${t.mode==="nobody"}>אין אף אחד</option><option value="someone" ?selected=${t.mode==="someone"}>יש מישהו</option></select></div>
      <div class="fld"><label>איפה</label><select class="selx" aria-label="איפה" data-kav-presence-where><option value="building" selected>כל המבנה</option></select></div></div>
    <div class="fld"><label>לפי</label><div class="kav-srcs">
      ${i(!!s?.geofence,"home","גיאו־גדר")}${i(!!s?.beacon,"sensor","משואה")}
      ${i(!!s?.wifi,"sensor","Wi‑Fi",s?.wifi_mode==="server"?d:r`<small>רק כשהאתר במצב שרת</small>`,s?.wifi_mode!=="server")}</div></div>`}const Rr={"sensor.leak":"הצפה","sensor.smoke":"עשן","sensor.gas":"גז","sensor.co":"פחמן חד־חמצני","alarm.triggered":"אזעקה"};function Lr(e){const t=e.map(s=>Rr[s]??s);return t.length?`מותר כי ״${t.join("״, ״")}״ ${t.length===1?"מסומנת":"מסומנות"} כאירוע בטיחות בהגדרות ‹ התראות.`:"רק לאירועי בטיחות שהופעלו בהגדרות ‹ התראות."}function Br(e){const t=e.block,s=e.ext?.critical,i=!!t.critical,a=!!s?.allowed||i;return r`<div class="kav-swrow" data-kav-critical>${f("bell")}<div class="t">צליל קריטי שעוקף ״נא לא להפריע״<small>${Lr(s?.allowed?s.sources:[])}</small></div>
    <sw-toggle label="צליל קריטי" labelHidden .checked=${i} ?disabled=${!a} @change=${n=>e.patch(o=>{n.detail.checked?o.critical=!0:delete o.critical})}></sw-toggle></div>`}const Ds=ue["action:service"];ue["trigger:button"]=Ar;ue["condition:presence"]=Nr;ue["action:service"]=e=>{const t=e.block,s=Ds?Ds(e):fi(e);return t.role==="notify"&&e.kind==="automation"&&(e.ext?.critical||t.critical)?r`${s}${Br(e)}`:s};const Fr=L`
  .kav-tools { display: flex; gap: 8px; align-items: center; }
  .kav-tools .sp { flex: 1; }
  .kav-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .kav-btns button { min-inline-size: 52px; min-block-size: 44px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border-strong); background: var(--dv-surface-2, transparent);
    color: var(--dv-text); font: inherit; font-weight: 700; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; }
  .kav-btns button small { font-size: var(--sw-fs-xs); font-weight: 500; color: var(--sw-warning-text); }
  .kav-btns button[aria-pressed='true'], .kav-press button[aria-pressed='true'] { border-color: var(--dv-accent); background: color-mix(in srgb, var(--dv-accent) 14%, transparent); color: var(--dv-accent); }
  .kav-press { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .kav-press button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border-strong);
    background: var(--dv-surface-2, transparent); color: var(--dv-text); font: inherit; font-weight: 600; cursor: pointer; }
  .kav-press button:disabled { opacity: 0.4; cursor: not-allowed; }
  .kav-press small { font-size: var(--sw-fs-xs); font-weight: 400; color: var(--dv-text-2); }
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
  .kav-swrow .t { flex: 1; display: flex; flex-direction: column; font-weight: 600; }
  .kav-swrow .t small { font-weight: 400; font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
`,bi=e=>({uid:nt(),kind:"typed",raw:null,sentence:"",...e}),Me=e=>e.catalog.extension?.building_presence?.sensors??[],Ts={id:"building_empty",label:"נוכחות במבנה",hint:"מבנה ריק · חדר פעיל",icon:"users",available:e=>Me(e).length>0,make:e=>bi({type:"building_empty",sensors:Me(e),minutes:15})},Cs={id:"room_occupied",label:"נוכחות במבנה",hint:"המבנה ריק / יש נוכחות",icon:"users",available:e=>Me(e).length>0,make:e=>bi({type:"room_occupied",mode:"occupied",sensors:Me(e)})};Be.some(e=>e.id===Ts.id)||Be.push(Ts);Fe.some(e=>e.id===Cs.id)||Fe.push(Cs);function gi(e,t){const s=Me(e.env),i=(a,n)=>e.patch(o=>{const l=new Set(o.sensors);n?l.add(a):l.delete(a),o.sensors=s.filter(c=>l.has(c))});return r`<div class="fld full"><label>חיישנים</label><div class="frow" data-presence-sensors>
    ${s.map(a=>r`<label class="chk"><input type="checkbox" data-presence-sensor=${a} .checked=${t.includes(a)} @change=${n=>i(a,n.target.checked)} />${e.env.ctx.names?.(a)??a}</label>`)}</div></div>`}function jr(e){const t=e.block;return r`<div class="frow"><div class="fld"><label>מה</label><select class="selx" aria-label="מה" data-fld="presence.what"><option selected>המבנה התרוקן</option></select></div>
    <div class="fld sm"><label>במשך (דקות)</label><label class="inp"><input class="n" type="number" min="1" max=${Yt} step="1" data-fld="presence.minutes" aria-label="דקות" .value=${String(t.minutes)}
      @change=${s=>e.patch(i=>{const a=Math.round(Number(s.target.value));i.minutes=Number.isFinite(a)?Math.min(Yt,Math.max(1,a)):15})} /></label></div></div>
    ${gi(e,t.sensors)}`}function Mr(e){const t=e.block;return r`<div class="frow"><div class="fld"><label>מצב</label><select class="selx" aria-label="מצב" data-fld="presence.mode" @change=${s=>e.patch(i=>{i.mode=s.target.value})}>
      <option value="occupied" ?selected=${t.mode==="occupied"}>יש נוכחות</option><option value="empty" ?selected=${t.mode==="empty"}>אין נוכחות</option></select></div></div>
    ${gi(e,t.sensors)}`}ue["trigger:building_empty"]=jr;ue["condition:room_occupied"]=Mr;var qr=Object.defineProperty,k=(e,t,s,i)=>{for(var a=void 0,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(t,s,a)||a);return a&&qr(t,s,a),a};const Wr={template:"תבנית",device:"מכשיר",purpose_trigger:"ייעודי",custom_service:"שירות מיוחד",service_not_allowed:"לא מותר",unsupported_step:"מתקדם",disabled_step:"מושבת",secret:"חסוי",code:"חסוי",unknown:"לא מוכר"},Is=new Set(["delegation_off","grant_required"]);class $ extends K{constructor(){super(...arguments),this.itemId=null,this.mode="edit",this.open=!0,this.scheme="",this.draft0=null,this.phase="loading",this.loadError="",this.loadDenied=!1,this.status=null,this.env=null,this.item=null,this.draft=null,this.openUid=null,this.view="builder",this.codeText="",this.codeOk=!0,this.preview=null,this.busy="",this.pop=null,this.picker=null,this.dialog=null,this.dryResult=null,this.saveError="",this.serverIssues=[],this.conflict=null,this.note="",this.dragUid=null,this.dropAt=null,this.touched=!1,this.stage="edit",this.templateName="",this.optionsOpen=!1,this.version=0,this.previewVersion=-1,this.previewFailed=!1,this.initial="",this.storedDraft=null,this.codeBase="",this.lockedFps=new Set,this.previewTimer=0,this.loadToken=0,this.lastDialogClose=0,this.lastKeyEsc=0,this.suggestDraft=null,this.onBeforeUnload=t=>{this.open&&this.dirty&&!this.busy&&(t.preventDefault(),t.returnValue="")},this.onSheetCancel=t=>{t.preventDefault();const s=performance.now();s-this.lastDialogClose<120||s-this.lastKeyEsc<120||this.requestCancel()},this.onSheetKey=t=>{t.key==="Escape"&&(this.picker||this.pop)&&(t.preventDefault(),t.stopPropagation(),this.picker=null,this.pop=null,this.lastKeyEsc=performance.now())},this.dialogClosed=()=>{this.dialog=null,this.lastDialogClose=performance.now()},this.onCode=t=>{this.codeText=t.detail.text,this.codeOk=t.detail.ok,this.saveError=""},this.gotoCode=()=>{this.setView("code")},this.editTemplate=(t,s)=>this.patchBlock(t,i=>{i.kind==="locked"&&Object.assign(i,Rn(i,s))}),this.onDragEnd=()=>{this.dragUid=null,this.dropAt=null}}get codeToggle(){return!0}get startsWithGallery(){return!1}footerExtras(){return d}static{this.styles=[Ci,an,Se,Dr,Fr,Ii,L`
      /* KAV079-295: the pre-save warnings box (state 4) and the "save with warnings" button */
      .vbox {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border-radius: var(--dv-radius-sm, 14px);
        background: color-mix(in srgb, var(--dv-warning, #f59e0b) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--dv-warning, #f59e0b) 35%, transparent);
      }
      .vbox > b {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: var(--sw-fs-base);
      }
      .vbox > b small {
        font-weight: 400;
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
        background: color-mix(in srgb, var(--dv-warning, #f59e0b) 18%, transparent);
        border-color: color-mix(in srgb, var(--dv-warning, #f59e0b) 50%, transparent);
      }
    `,L`
      :host {
        display: contents;
      }
      dialog.sheet {
        position: fixed;
        margin: 0;
        padding: 0;
        border: 1px solid var(--dv-border);
        color: var(--dv-text);
        background: var(--ab-sheen), var(--ab-sheet);
        -webkit-backdrop-filter: blur(40px) saturate(1.8);
        backdrop-filter: blur(40px) saturate(1.8);
        border-radius: var(--dv-radius-lg, 28px);
        box-shadow: var(--dv-shadow-3);
        inset-block: 12px;
        inset-inline-start: 12px;
        inset-inline-end: auto;
        inline-size: min(620px, calc(100vw - 24px));
        block-size: calc(100dvh - 24px);
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
        animation: rin 300ms var(--ab-ease);
      }
      dialog.sheet::backdrop {
        background: rgba(15, 23, 42, 0.38);
      }
      @keyframes rin {
        from {
          opacity: 0;
          transform: translateX(24px);
        }
      }
      @keyframes rup {
        from {
          opacity: 0;
          transform: translateY(40px);
        }
      }
      /* the confirmations and small forms over the sheet read on a solid surface (the sheet itself is the glass) */
      sw-dialog {
        --sw-surface: var(--dv-surface-solid, #fff);
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
        font-weight: 700;
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
        font-weight: 700;
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
        font-weight: 600;
      }
      .shh .tgl {
        flex: none;
        --sw-accent: var(--dv-toggle-on, #34c759);
      }
      .shsub {
        padding: 0 16px 6px;
        display: none;
      }
      .shsub .seg {
        inline-size: 100%;
      }
      .shsub .seg button {
        flex: 1;
        min-block-size: 40px;
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
        background: var(--ab-sheen), var(--ab-sheet);
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
        font-weight: 600;
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
        font-weight: 500;
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
        font-weight: 500;
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
        font-weight: 600;
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
        font-weight: 500;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 500;
      }
      .pickpop {
        position: absolute;
        z-index: 75;
        inset-inline: 16px;
        inset-block-start: 86px;
        max-block-size: min(560px, calc(100% - 110px));
        animation: pop 180ms var(--ab-ease);
      }
      @keyframes pop {
        from {
          opacity: 0;
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
        font-weight: 600;
      }
      .kvrow .ok {
        color: var(--ab-ok-text);
        font-weight: 600;
      }
      .diff {
        display: grid;
        grid-template-columns: 70px 1fr 1fr;
        gap: 6px 10px;
        font-size: var(--sw-fs-sm);
      }
      .diff .h {
        font-weight: 700;
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
        font-weight: 700;
        padding-block: 6px;
      }
      @media (max-width: 767px) {
        dialog.sheet {
          inset: auto 0 0 0;
          inline-size: auto;
          block-size: calc(100dvh - 20px);
          border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0;
          border-block-end: 0;
        }
        dialog.sheet[open] {
          animation-name: rup;
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
        .shh .seg.top {
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
    `]}get isNew(){return this.mode==="create"||!this.itemId}get dirty(){return!this.draft||!this.env?!1:this.view==="code"&&this.codeText!==this.codeBase?!0:Ae(this.kind,this.draft,this.env.ctx,this.item?.config_id??null)!==this.initial}get hardReadOnly(){if(!this.status)return!1;if(this.isNew)return!Pi(this.kind,this.status);const t=this.item?.read_only?.reasons??[];return!!this.item&&(t.some(s=>!Is.has(s.code))||!this.item.can.edit&&!t.length)}get roText(){if(this.isNew)return"אין הרשאת עריכה";const t=this.item?.read_only?.reasons.find(s=>!Is.has(s.code));return t?Ai({read_only:{reasons:[t]}})?.text??"צפייה בלבד":"צפייה בלבד"}get codeMode(){return!this.status||!this.codeToggle?"hidden":Ni(this.status,this.isNew?null:this.item)}get freshPreview(){return this.preview&&this.previewVersion===this.version?this.preview:null}get issues(){if(!this.draft||!this.env)return[];const t=Ri(this.kind,this.draft,{shabbatSensor:this.env.catalog.shabbat_sensor,notifyTargets:this.env.notifyActions,...this.env.catalog.allowed_actions?{allowedActions:this.env.catalog.allowed_actions}:{}});return qn(t,this.freshPreview?.errors??[],this.serverIssues)}get missingGrants(){return!this.draft||!this.env?[]:(this.preview?.sensitive_steps??Li(this.draft,s=>this.env.byId.get(s)?.class??null)).filter(s=>!s.granted)}get saveGate(){const t=this.status;if(!t||!this.draft||!this.env)return{text:"טוען"};if(this.hardReadOnly)return{text:this.roText};if(this.busy)return{text:""};const s=Kt(this.kind,t);if(s)return{text:s.text};if(this.view==="code")return this.codeMode==="readonly"?{text:"צפייה בלבד"}:this.codeOk&&this.codeDirtyOrDraft?null:{text:this.codeOk?"":"יש דברים לתקן"};if(this.issues.length)return{text:"יש דברים לתקן"};if(this.missingGrants.length)return{text:gs(this.missingGrants[0].action,this.env.ctx.names(this.missingGrants[0].entity_id))};const i=this.freshPreview;if(i){const a=Jt(i,t);if(a&&a.code!=="invalid")return{text:a.text}}return!this.isNew&&!this.dirty?{text:""}:this.warnMode!=="save"?{text:this.warnMode==="blocked"?"יש אזהרות לטיפול":"יש אזהרות"}:null}get codeDirtyOrDraft(){return this.isNew||this.codeText!==this.codeBase||this.dirty}sentenceOf(t){return this.freshPreview?.block_sentences[t.uid]??t.sentence}connectedCallback(){super.connectedCallback(),Xt(this,{...Bi,style:"glass",...this.scheme==="light"||this.scheme==="dark"||this.scheme==="auto"?{scheme:this.scheme}:{}}),Fi().then(t=>{this.isConnected&&(Xt(this,{...t,style:"glass"}),this.scheme&&Zt(this,this.scheme))}),window.addEventListener("beforeunload",this.onBeforeUnload)}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.previewTimer),window.removeEventListener("beforeunload",this.onBeforeUnload),this.loadToken++}willUpdate(t){t.has("scheme")&&this.scheme&&Zt(this,this.scheme),t.has("open")&&!this.open&&window.clearTimeout(this.previewTimer),(t.has("itemId")||t.has("mode")||t.has("draft0")||t.has("open")&&this.open)&&this.open&&this.init(),this.env&&this.setAttribute("data-chip",this.env.sensitiveChip)}updated(t){t.has("open")?this.syncDialog():this.open&&this.sheet&&!this.sheet.open&&this.syncDialog()}syncDialog(){const t=this.sheet;if(t)if(this.open&&!t.open){try{t.showModal()}catch{t.setAttribute("open","")}t.focus({preventScroll:!0})}else!this.open&&t.open&&t.close()}async init(){const t=++this.loadToken;this.phase="loading",this.item=null,this.draft=null,this.preview=null,this.previewVersion=-1,this.previewFailed=!1,this.openUid=null,this.view="builder",this.dialog=null,this.conflict=null,this.saveError="",this.serverIssues=[],this.touched=!1,this.note="",this.pop=null,this.picker=null,this.templateName="",this.optionsOpen=!1,this.dryResult=null;try{if(await Zs(),t!==this.loadToken)return;const s=ie(),[i,a,n]=await Promise.all([s.status(),s.catalog().catch(()=>cn),this.isNew?Promise.resolve(null):s.get(this.kind,this.itemId)]);if(t!==this.loadToken)return;this.status=i,this.env=un(i,a),this.item=n;const o=F(n?n.draft:this.draft0??this.blankDraft());be(o,this.env.ctx),this.draft=o,this.storedDraft=n?F(n.draft):null,this.initial=this.isNew&&this.draft0===null?Ae(this.kind,o,this.env.ctx):Ae(this.kind,o,this.env.ctx,n?.config_id??null),this.lockedFps=bt(o),this.stage=this.isNew&&this.draft0===null&&this.startsWithGallery&&i.ui.templates_enabled!==!1&&i.can.manage?"templates":"edit",this.draft0&&(this.touched=!0),this.phase="ready",this.version++,this.schedulePreview(0)}catch(s){if(t!==this.loadToken)return;this.loadError=$e(s);const i=j(s).status;this.loadDenied=i===403||i===404,this.phase="error"}}async notifyExternalChange(){if(!(this.isNew||!this.item||this.busy))try{const t=await ie().get(this.kind,this.itemId);t.revision!==this.item.revision&&(this.conflict=t)}catch{}}change(t){this.env&&(be(t,this.env.ctx),this.draft=t,this.version++,this.touched=!0,this.saveError="",this.serverIssues=[],this.schedulePreview())}patchBlock(t,s){this.draft&&this.change(xn(this.draft,t,s))}schedulePreview(t=400){window.clearTimeout(this.previewTimer),this.previewTimer=window.setTimeout(()=>void this.runPreview(),t)}async runPreview(){if(!this.draft||!this.open)return;const t=this.version;try{const s=await ie().preview({kind:this.kind,id:this.isNew?null:this.item?.id??null,draft:this.draft});if(t!==this.version)return;this.preview=s,this.previewVersion=t,this.previewFailed=!1}catch{t===this.version&&(this.previewFailed=!0,this.previewVersion=t)}}closeSelf(){this.open=!1}emit(t,s){this.dispatchEvent(new CustomEvent(t,{detail:s,bubbles:!0,composed:!0}))}requestCancel(){if(!this.busy){if(this.dirty&&!this.hardReadOnly){this.dialog="discard";return}this.cancel()}}cancel(){this.dialog=null,this.emit("cancel",{}),this.closeSelf()}async save(t=!1,s=!1){if(!(!this.draft||!this.env||!this.status)&&!(!t&&this.saveGate&&!(s&&this.warnMode==="with_warnings"&&this.saveGate.text==="יש אזהרות"))){if(!t&&this.view==="builder"&&(this.freshPreview?.requires.confirm??ji(this.draft))){this.dialog="confirm-save";return}this.busy="save",this.saveError="",this.dialog=null;try{const i=await this.write(t);this.afterWrite(i)}catch(i){this.onSaveError(i)}this.busy=""}}async write(t){const s=this.env;let i=this.draft,a=null;if(this.view==="code"){const c=je(this.codeText);if(!c.ok||typeof c.value!="object"||c.value===null||Array.isArray(c.value))throw new Error("code");a=c.value,i=Qt(this.kind,a,s.ctx).draft}const n=ws(this.isNew,i,this.storedDraft),o=this.item?.revision??null;if(n==="create")return Qs(this.kind,i,{enabled:!0,confirm:t});if(n==="replace")return ei(this.kind,this.itemId,i,o,{confirm:t});const l=a??zt(this.kind,i,gt(this.item),s.ctx,{id:this.item?.config_id??null});if(!gt(this.item)&&(this.item?.extras.length??0)>0)throw Object.assign(new Error("extras"),{extras:!0});return Mi(this.kind,this.itemId,l,o,{confirm:t})}afterWrite(t){const s=this.isNew,i=t.item??null;this.emit("saved",{kind:this.kind,id:i?.id??this.itemId,item:i,created:s,status:t.status==="not_loaded"?"not_loaded":"ok"}),t.status==="not_loaded"&&(this.note="נשמר, אך עדיין לא נטען במערכת"),this.initial=this.env?Ae(this.kind,this.draft,this.env.ctx,i?.config_id??this.item?.config_id??null):this.initial,this.touched=!1,this.codeBase=this.codeText,this.closeSelf()}onSaveError(t){if(t.extras){this.saveError="לפריט יש הגדרות נוספות שאינן מוצגות כאן; עריכת חלק נעול תתאפשר כשהקוד המלא יוצג";return}if(t instanceof Error&&t.message==="code"){this.saveError="הקוד אינו תקין";return}const s=j(t);if(s.kind==="conflict"){const i=es(t);if(i){this.conflict=i;return}}if(s.kind==="confirm"){this.dialog="confirm-save";return}if(s.kind==="validation"&&s.issues.length){this.serverIssues=s.issues,this.touched=!0,this.saveError=s.message;return}this.saveError=s.maybe_saved?`${s.message}`:s.message}reloadTheirs(){const t=this.conflict;if(!t||!this.env)return;this.item=t;const s=F(t.draft);be(s,this.env.ctx),this.draft=s,this.storedDraft=F(t.draft),this.initial=Ae(this.kind,s,this.env.ctx,t.config_id),this.lockedFps=bt(s),this.conflict=null,this.touched=!1,this.openUid=null,this.view="builder",this.version++,this.schedulePreview(0)}keepMine(){const t=this.conflict;t&&(this.item={...t,draft:this.item?.draft??t.draft},this.storedDraft=F(t.draft),this.conflict=null,this.save())}async runNow(t=!1,s=!0){if(!(!this.item||this.kind==="scene")){if(!t&&Ot(this.item)){this.dialog="run";return}this.busy="run",this.note="",this.dialog=null;try{if(this.kind==="script"){const i=this.item.draft.fields;await ti(this.item.id,Object.fromEntries(i.filter(a=>a.default!==void 0).map(a=>[a.key,a.default])),{confirm:t}),this.note="הופעל"}else await qi(this.item.id,{skip_condition:s,confirm:t}),this.note=s?"הופעלה":"נבדקה והופעלה";this.emit("item-changed",{kind:this.kind,id:this.item.id})}catch(i){const a=j(i);a.kind==="confirm"?this.dialog="run":this.note=a.message}this.busy=""}}async dryRun(){if(this.draft){this.busy="dry",this.note="";try{if(!this.isNew&&!this.dirty&&this.item)this.dryResult=await ie().dryRun(this.kind,this.item.id);else{const s=await ie().preview({kind:this.kind,id:this.isNew?null:this.item?.id??null,draft:this.draft});this.dryResult={conditions:("conditions"in this.draft?this.draft.conditions:[]).map(i=>({sentence:i.sentence,passed:null})),effects:s.effects}}this.dialog="dry"}catch(t){this.note=$e(t)}this.busy=""}}async toggleEnabled(t,s=!1){if(this.item){if(t&&!s&&this.item.unknown_effects){this.dialog="enable";return}this.busy="toggle",this.dialog=null;try{const i=await si(this.item.id,t,{confirm:s});this.item={...this.item,state:i.item.state},this.emit("item-changed",{kind:this.kind,id:this.item.id})}catch(i){this.note=$e(i)}this.busy=""}}async deleteNow(){if(this.item){this.busy="delete",this.dialog=null;try{const t=await ii(this.kind,this.item.id,this.item.revision);this.emit("deleted",{kind:this.kind,id:this.item.id,trash_id:t.trash_id,expires_at:t.expires_at}),this.closeSelf()}catch(t){const s=j(t),i=es(t);s.kind==="conflict"&&i?this.conflict=i:this.saveError=s.message}this.busy=""}}setView(t){if(t===this.view||!this.draft||!this.env)return;if(t==="code"){const a=zt(this.kind,this.draft,gt(this.item),this.env.ctx,{id:this.item?.config_id??null});this.codeText=JSON.stringify(a,null,2),this.codeBase=this.codeText,this.codeOk=!0,this.view="code",this.pop=null,this.picker=null;return}const s=Wi(this.kind,this.codeText,this.env.ctx);if(!s.ok)return;const i=be(s.draft,this.env.ctx);this.draft=i,this.lockedFps=bt(i),this.view="builder",this.openUid=null,this.version++,this.touched=!0,this.schedulePreview(0)}chipsOf(t,s){const i=this.env,a=[];if(t.kind==="locked"){a.push({tone:"lock",text:"נעול",icon:"lock",title:"נשמר כמו שהוא"},{tone:"why",text:Wr[t.reason]??"לא מוכר",title:t.label}),t.reason==="template"&&a.push({tone:"code",text:"{{ }}"}),t.sensitive&&i.sensitiveWarning&&a.push({tone:"sens",text:"פעולה רגישה",icon:"alarm"}),Js(t)&&a.push({tone:"warn",text:"שולט בתזמונים",icon:"calendar"}),t.masked&&a.push({tone:"bad",text:"ערך חסוי"});const l=typeof t.raw?.id=="string"&&s==="trigger"?String(t.raw.id):null;return l&&a.push({tone:"code",text:`id: ${l}`}),a}const n=t;s==="trigger"&&n.type==="button"&&a.push({tone:"acc",text:t.raw?"היה נעול · ניתן לעריכה":"ניתן לעריכה",icon:"button"}),s==="trigger"&&n.id&&a.push({tone:"code",text:`id: ${n.id}`});for(const l of this.blockWarnings(t))a.push(l);return s==="action"&&i.sensitiveWarning&&Ui(t,l=>i.byId.get(l)?.class??null)&&a.push({tone:"sens",text:"פעולה רגישה",icon:"alarm"}),(t.entity_ids??[]).some(l=>i.byId.get(l)?.missing)&&a.push({tone:"bad",text:"מכשיר חסר",icon:"warning"}),a}blockWarnings(t){if(!this.draft||this.kind!=="automation")return[];const s=ct(this.freshPreview);if(!s.length)return[];const i=le(this.draft).find(a=>a.block.uid===t.uid)?.path;return i?s.filter(a=>a.path===i).map(a=>({tone:"warn",icon:"warning",text:a.code==="conflict"?`התנגשות${typeof a.delta_min=="number"?` · ${a.delta_min} דק׳`:""}`:a.code==="button_in_use"?"בשימוש":"התקן לא זמין"})):[]}get ext(){return Et(this.status?.ui??null)}get warnMode(){return this.kind==="automation"&&this.view==="builder"?Vi(ct(this.freshPreview),this.ext):"save"}get deviceTestOn(){return this.kind==="automation"&&this.ext.device_test&&!this.isNew&&!!this.item?.can.edit&&!!this.item?.can.run}formCtx(t,s,i){const a=this.env,n=this.draft,o="triggers"in n?n.triggers.map(l=>l.kind==="typed"?l.id??null:typeof l.raw?.id=="string"?String(l.raw.id):null).filter(l=>!!l):[];return{env:a,kind:this.kind,block:t,section:s,issues:i,triggerIds:o,canCode:this.codeMode==="editable",itemId:this.isNew?null:this.item?.id??null,ext:{critical:this.preview?.extension?.critical},patch:l=>this.patchBlock(t.uid,l),pick:l=>{this.picker=l,this.pop=null},nested:(l,c,p)=>this.renderList(l,c,p),child:(l,c)=>this.formCtx(l,c,this.issuesBy[l.uid]??[]),gotoCode:this.gotoCode,editTemplate:this.editTemplate}}get issuesBy(){return this.draft?Hi(this.draft,this.issues):{}}renderCard(t,s,i,a){const n=this.openUid===t.uid,o=n||!!this.openUid&&et(t).has(this.openUid),l=a[t.uid]??[],c=this.dropAt&&this.dropAt.owner===i.owner&&this.dropAt.name===i.name&&this.dropAt.index===i.index;return r`<div class="slot ${this.dragUid===t.uid?"drag":""} ${c?"drop-before":""}" data-uid=${t.uid} data-block-slot>
      <sw-block-card .uid=${t.uid} .icon=${In(t,s)} .heading=${this.sentenceOf(t)} .chips=${this.chipsOf(t,s)} .open=${o} .locked=${t.kind==="locked"} .invalid=${l.length>0}
        .nested=${i.owner!==Z} .readonly=${this.hardReadOnly} .canUp=${i.index>0} .canDown=${i.index<i.count-1}
        @card-toggle=${()=>{this.hardReadOnly&&t.kind==="typed"||(this.openUid=n?null:t.uid)}}
        @card-remove=${()=>{this.draft&&(this.change(bn(this.draft,t.uid)),this.openUid===t.uid&&(this.openUid=null))}}
        @card-move=${p=>this.moveCard(t.uid,p.detail.delta,p.detail.from)}
        @card-duplicate=${()=>{this.draft&&this.change($n(this.draft,t.uid))}}
        @card-dragstart=${()=>{this.dragUid=t.uid}}>
        ${o?r`<fieldset class="bf" ?disabled=${this.hardReadOnly} style="border:0;padding:0;margin:0;min-inline-size:0">${fi(this.formCtx(t,s,l))}</fieldset>`:d}
      </sw-block-card>
    </div>`}renderList(t,s,i){const a=this.draft,n=ri(a,t,s)??[],o=this.issuesBy,l=this.dropAt&&this.dropAt.owner===t&&this.dropAt.name===s&&this.dropAt.index>=n.length;return r`<div class="blist ${l?"drop-end":""}" data-list=${`${t}|${s}`} @dragover=${c=>this.onDragOver(c,t,s)} @drop=${c=>this.onDrop(c,t,s)} @dragleave=${c=>this.onDragLeave(c)}>
      ${Ze(n,c=>c.uid,(c,p)=>this.renderCard(c,i,{owner:t,name:s,index:p,count:n.length},o))}
      ${this.hardReadOnly||Xn(a,i,n.length)?d:r`<button class="addblk" type="button" data-add=${i} data-add-list=${`${t}|${s}`} @click=${()=>{this.pop={section:i,owner:t,name:s},this.picker=null}}>${f("plus")}הוסף</button>`}
    </div>`}moveCard(t,s,i){!this.draft||!yn(this.draft,t,s)||(this.change(gn(this.draft,t,s)),this.updateComplete.then(()=>{const a=this.renderRoot.querySelector(`[data-uid="${t}"] > sw-block-card`),n=i==="button"?s<0?"[data-block-up]":"[data-block-down]":"[data-block-main]";let o=a?.shadowRoot?.querySelector(n);o&&o.disabled&&(o=a?.shadowRoot?.querySelector(s<0?"[data-block-down]":"[data-block-up]")),(o??a?.shadowRoot?.querySelector("[data-block-main]"))?.focus({preventScroll:!0})}))}onDragOver(t,s,i){if(!this.dragUid||!this.draft)return;const a=Oe(this.draft,this.dragUid),n=Ue(this.draft).find(c=>c.owner===s&&c.name===i);if(!a||!n||n.section!==a.section)return;t.preventDefault(),t.stopPropagation(),t.dataTransfer&&(t.dataTransfer.dropEffect="move");const o=[...t.currentTarget.querySelectorAll(":scope > .slot")];let l=o.length;for(let c=0;c<o.length;c++){const p=o[c].getBoundingClientRect();if(t.clientY<p.top+p.height/2){l=c;break}}(!this.dropAt||this.dropAt.owner!==s||this.dropAt.name!==i||this.dropAt.index!==l)&&(this.dropAt={owner:s,name:i,index:l})}onDragLeave(t){const s=t.relatedTarget;(!s||!t.currentTarget.contains(s))&&(this.dropAt=null)}onDrop(t,s,i){if(!this.dragUid||!this.draft)return;t.preventDefault(),t.stopPropagation();const a=this.dropAt&&this.dropAt.owner===s&&this.dropAt.name===i?this.dropAt.index:0,n=wn(this.draft,this.dragUid,s,i,a);this.dragUid=null,this.dropAt=null,n&&this.change(n)}chooseType(t){const s=this.pop;if(!s||!this.draft||!this.env)return;const i=En(s.section,t,this.env);this.pop=null,i&&(this.change(mn(this.draft,s.owner,s.name,i)),this.openUid=i.uid,this.updateComplete.then(()=>this.scrollToBlock(i.uid)))}scrollToBlock(t){this.renderRoot.querySelector(`[data-uid="${t}"]`)?.scrollIntoView({block:"center",behavior:"smooth"})}goto(t){if(!this.draft)return;const s=le(this.draft).filter(i=>t===i.path||t.startsWith(`${i.path}.`)).sort((i,a)=>a.path.length-i.path.length)[0];s&&(this.openUid=s.block.uid,this.updateComplete.then(()=>this.scrollToBlock(s.block.uid)))}renderTypePop(){const t=this.pop;if(!t||!this.env||!this.draft)return d;const s=t.owner===Z?null:le(this.draft).find(n=>n.block.uid===t.owner)?.block,i=!!s&&["and","or","not"].includes(s.type??""),a=oi[t.section].filter(n=>(!n.available||n.available(this.env,this.draft))&&!(t.section==="condition"&&i&&["and","or","not"].includes(n.id)));return r`<div class="scrim" data-scrim @click=${()=>this.pop=null}></div>
      <div class="typepop" role="menu" data-typepop>
        <div class="hd">${On[t.section]}</div>
        ${a.map(n=>r`<button type="button" role="menuitem" class=${n.sensitive?"sensb":""} data-type=${n.id} @click=${()=>this.chooseType(n.id)}><span class="rg">${f(n.icon)}</span><span><span>${n.label}</span><small>${n.hint}</small></span></button>`)}
      </div>`}renderPicker(){const t=this.picker;return!t||!this.env?d:r`<div class="scrim" data-scrim @click=${()=>this.picker=null}></div>
      <automation-entity-picker class="pickpop" .env=${this.env} .filter=${t.filter} .where=${t.where??null} .selected=${t.selected} .multi=${t.multi??!0}
        @picker-change=${s=>{t.apply(s.detail.ids),this.picker={...t,selected:s.detail.ids}}}
        @picker-done=${()=>this.picker=null}></automation-entity-picker>`}banners(){const t=[],s=this.status;if(!s||!this.env)return t;this.hardReadOnly&&t.push({id:"readonly",tone:"info",icon:"eye",title:this.roText});const i=this.hardReadOnly?null:Kt(this.kind,s);i&&i.code==="delegation_off"?t.push({id:"delegation",tone:"warn",icon:"info",title:"שמירה דורשת מנהל"}):i&&i.code!=="no_permission"&&t.push({id:"blocked",tone:"warn",icon:"info",title:i.text});const a=this.missingGrants[0];a&&!this.hardReadOnly&&t.push({id:"grant",tone:"warn",icon:"alarm",title:gs(a.action,this.env.ctx.names(a.entity_id))});const n=this.freshPreview;if(n&&!this.hardReadOnly&&!i){const o=Jt(n,s);o&&o.code!=="invalid"&&t.push({id:o.code,tone:"warn",icon:"lock",title:o.text})}return this.saveError&&t.push({id:"error",tone:"bad",icon:"warning",title:this.saveError}),t}renderBanners(){return this.banners().map(t=>r`<div class="banner ${t.tone}" role=${t.tone==="bad"?"alert":"status"} data-banner=${t.id}>${f(t.icon)}<div class="t"><b>${t.title}</b>${t.sub?r`<small>${t.sub}</small>`:d}</div></div>`)}renderConflict(){return this.conflict?r`<div class="banner" role="alert" data-banner="conflict">${f("warning")}<div class="t"><b>הפריט שונה במקום אחר לפני רגע</b><small>נשמרה גרסה חדשה. מה לעשות עם השינויים שלך?</small>
      <div class="acts">
        <button class="btn sm" type="button" data-conflict="reload" @click=${()=>this.reloadTheirs()}>${f("history")}טען את החדש</button>
        ${this.kind==="automation"?r`<button class="btn sm" type="button" data-conflict="merge" @click=${()=>this.dialog="merge"}>${f("branch")}השוואה ומיזוג</button>`:r`<button class="btn sm" type="button" data-conflict="compare" @click=${()=>this.dialog="compare"}>${f("copy")}השווה</button>`}
        <button class="btn sm primary" type="button" data-conflict="mine" @click=${()=>this.keepMine()}>שמור את שלי</button>
      </div></div></div>`:d}renderSentence(){if(!this.draft||!this.env)return d;const t=this.freshPreview?.sentence??Gi(this.kind,this.draft,this.env.ctx),s=this.preview?.sensitive_steps.length??0;return r`<div class="sentbox" data-sentence>${f("bolt")}<div>${t}${s&&this.env.sensitiveWarning?r`<small>${f("alarm",12)}כולל ${s===1?"פעולה רגישה אחת":`${s} פעולות רגישות`} – נבדקות כמו שליטה ידנית</small>`:d}</div></div>`}renderWarnings(){if(!this.draft||this.kind!=="automation"||!this.ext.precheck)return d;const t=ct(this.freshPreview);if(!t.length)return d;const s=this.issues.length,i=a=>{const n=a.other;if(!n){this.goto(a.path);return}n.kind==="schedule"?Y(`/devices/schedules/${encodeURIComponent(n.id)}/edit`):Y(`/devices/automations/${encodeURIComponent(n.id)}`)};return r`<div class="vbox" role="status" data-warnings><b>${f("warning")}${Yi(t.length)}<small>· ${s?"יש גם דברים לתקן.":this.ext.save_with_warnings?"אין שגיאות. אפשר לשמור עם אזהרות.":"אין שגיאות. יש לטפל באזהרות לפני השמירה."}</small></b>
      ${t.map(a=>r`<div class="iss" data-warning=${a.code}><div><b>${a.message}</b>${a.detail?r`<span class="s">${a.detail}</span>`:d}</div>
        ${a.code==="conflict"&&a.other?r`<button class="btn sm" type="button" data-warning-open @click=${()=>i(a)}>${a.other.kind==="schedule"?"פתיחת התזמון":"פתיחת האוטומציה"}</button>`:r`<button class="btn sm quiet" type="button" data-warning-goto @click=${()=>this.goto(a.path)}>מעבר לצעד</button>`}</div>`)}</div>`}renderValidation(){if(!this.draft)return d;const t=this.renderWarnings();if(!this.touched)return t;const s=this.issues;return s.length?r`<div class="valbox" role="alert" data-validation><b>${f("warning")}${s.length===1?"דבר אחד לתקן":`${s.length} דברים לתקן`}</b>
      ${s.map(i=>{const a=Mn(i);return r`<button type="button" data-goto=${i.path} @click=${()=>this.goto(i.path)}><span>${a.where} ·</span> ${a.what}</button>`})}</div>${t}`:t}renderCodeView(){if(!this.draft)return d;const t=this.status?Ki(this.status):{state:"not_needed"},s=je(this.codeText);let i=!1;if(s.ok&&typeof s.value=="object"&&s.value!==null&&!Array.isArray(s.value)&&this.env){const a=Qt(this.kind,s.value,this.env.ctx).draft;i=ws(this.isNew,a,this.storedDraft)==="code"}return r`<automation-code .value=${this.codeText} .locked=${this.lockedFps} ?readonly=${this.codeMode==="readonly"} @code-input=${this.onCode}>
      <span slot="chips" class="tag ${i&&t.state!=="not_needed"?"warn":"ok"}">${i&&t.state!=="not_needed"?"שמירת תוכן שאינו מהבונה – מנהל בלבד":"מנהל · הכל ניתן לשמירה"}</span>
      <span slot="note">${f("info")} שינוי כאן מתורגם לבלוקים; מה שהבונה לא מכיר נשאר נעול.</span>
    </automation-code>`}renderHeader(){const t=this.draft,s=t?String(("alias"in t?t.alias:t.name)??""):"",i=this.draft&&this.env?Wn(this.item,this.draft,this.env):{floors:"",areas:"",more:0},a=this.isNew?this.templateName?`מתבנית "${this.templateName}"`:this.subtitleNew():null,n=this.codeMode,o=n!=="hidden"?r`<div class="seg top" role="tablist" aria-label="תצוגה" data-view-toggle>
      <button type="button" role="tab" aria-selected=${this.view==="builder"} data-view="builder" @click=${()=>this.setView("builder")}>${f("blocks")}בונה</button>
      <button type="button" role="tab" aria-selected=${this.view==="code"} data-view="code" @click=${()=>this.setView("code")}>${f("code")}קוד</button></div>`:d,l=this.item?this.item.state!=="off":!0,c=this.kind==="automation"&&!this.isNew&&this.item?.can.toggle&&!this.hardReadOnly?r`<sw-toggle class="tgl" labelHidden label="פעילה" .checked=${l} ?disabled=${this.busy!==""} data-enable-toggle @change=${p=>void this.toggleEnabled(p.detail.checked)}></sw-toggle>`:d;return r`<div class="grab" aria-hidden="true"></div>
      <header class="shh">
        <button class="bk" type="button" aria-label="סגירה" data-editor-close @click=${()=>this.requestCancel()}>${f("chevron")}</button>
        <div class="tx">
          <input class="namein" data-name-input aria-label=${this.nameLabel} placeholder=${this.nameLabel} .value=${s} ?disabled=${this.hardReadOnly} @input=${p=>this.setName(p.target.value)} />
          <small>${a??r`${i.floors?r`${f("layers",13)}<span>${i.floors}</span>`:d}${i.areas?r`<span>${i.areas}${i.more?` ${i.more}+`:""}</span>`:d}`}</small>
        </div>
        ${o}${c}
      </header>
      ${n!=="hidden"?r`<div class="shsub">${o}</div>`:d}`}setName(t){if(!this.draft)return;const s=F(this.draft);"alias"in s?s.alias=t:s.name=t,this.change(s)}renderFooter(){const t=this.saveGate,s=this.kind==="automation"&&this.view==="builder"&&this.status?.scheduler_present&&this.draft?this.suggestion():null;return r`<footer class="shf">
      ${this.kind==="automation"&&this.view==="builder"?r`<button class="btn" type="button" data-dry-run ?disabled=${!!this.busy||this.phase!=="ready"} @click=${()=>this.deviceTestOn?this.openDeviceTest():void this.dryRun()}>${f("flask")}בדיקה</button>`:d}
      ${!this.isNew&&this.kind!=="scene"&&this.item?.can.run?r`<button class="btn" type="button" data-run-now ?disabled=${!!this.busy} @click=${()=>void this.runNow()}>${f("play")}הרץ עכשיו</button>`:d}
      ${this.footerExtras()}
      ${s?r`<button class="sugg" type="button" data-suggest-schedule @click=${()=>{this.suggestDraft=s.schedule_draft,this.dialog="suggest"}}>${f("calendar")}צור כתזמון</button>`:d}
      <span class="sp"></span>
      <button class="btn quiet" type="button" data-editor-cancel @click=${()=>this.requestCancel()}>ביטול</button>
      ${this.warnMode==="with_warnings"&&t?.text==="יש אזהרות"?r`<button class="btn warn" type="button" data-editor-save-warnings ?disabled=${!!this.busy} @click=${()=>void this.save(!1,!0)}>${f("warning")}${this.busy==="save"?"שומר…":"שמירה עם אזהרות"}</button>`:d}
      <button class="btn primary" type="button" data-editor-save title=${t?.text??""} ?disabled=${!!t} @click=${()=>void this.save()}>${f("check")}${this.busy==="save"?"שומר…":"שמירה"}</button>
    </footer>${this.note?r`<div class="runnote" role="status" data-note>${this.note}</div>`:d}`}suggestion(){const t=this.freshPreview?.suggest_schedule??null;return t||(!this.draft||!this.env||this.freshPreview?null:Ji(this.draft,{schedulerPresent:!0,shabbatSensor:this.env.catalog.shabbat_sensor,classOf:s=>this.env.byId.get(s)?.class??null}))}renderOptionsBox(t=d){const s=this.draft;return!s||s.mode===void 0?d:r`<details class="opts" ?open=${this.optionsOpen} @toggle=${i=>this.optionsOpen=i.target.open} data-options>
      <summary>${f("chevronDown")}אפשרויות · ${Cn[s.mode]??""}</summary>
      <div class="opts-wrap" ?inert=${this.hardReadOnly}>
        <div class="frow">
          <div class="fld"><label>אם מופעלת שוב בזמן ריצה</label><select class="selx" data-fld="mode" aria-label="מצב" @change=${i=>this.setField("mode",i.target.value)}>
            ${["single","restart","queued","parallel"].map(i=>r`<option value=${i} ?selected=${s.mode===i}>${Re[i]}</option>`)}</select></div>
          ${s.mode==="queued"||s.mode==="parallel"?r`<div class="fld sm"><label>מקסימום</label><label class="inp"><input class="n" data-fld="max" type="text" inputmode="numeric" aria-label="מקסימום" .value=${s.max==null?"":String(s.max)} @change=${i=>{const a=parseInt(i.target.value,10);this.setField("max",Number.isFinite(a)&&a>0?a:null)}} /></label></div>`:d}
        </div>
        <div class="fld full"><label>תיאור</label><label class="inp"><input data-fld="description" aria-label="תיאור" placeholder="לא חובה" .value=${s.description??""} @input=${i=>this.setField("description",i.target.value)} /></label></div>
        ${t}
      </div>
    </details>`}setField(t,s){if(!this.draft)return;const i=F(this.draft);i[t]=s,this.change(i)}renderDeleteRow(){return this.isNew||!this.item?.can.delete||this.hardReadOnly?d:r`<div class="frow"><button class="btn sm danger" type="button" data-editor-delete @click=${()=>this.dialog="delete"}>${f("trash")}מחיקה</button></div>`}renderDialogs(){const t=this.dialog,s=this.item?.name||this.draft?.alias||"",i=this.dialogClosed;return r`
      <sw-dialog heading="לצאת בלי לשמור?" ?open=${t==="discard"} @close=${i}>
        <div class="dlg-body">השינויים שעשיתם לא יישמרו.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" data-discard="keep" @click=${()=>this.dialog=null}>המשך עריכה</button><button class="btn danger" type="button" data-discard="leave" @click=${()=>this.cancel()}>צא בלי לשמור</button></div>
      </sw-dialog>
      <sw-dialog heading="לשמור?" ?open=${t==="confirm-save"} @close=${i}>
        <div class="dlg-body">כולל פעולה מתקדמת שהמערכת לא יודעת לתאר – ${s?`"${s}"`:"הפריט"} עלול לשנות מכשירים נוספים.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${()=>this.dialog=null}>ביטול</button><button class="btn primary" type="button" data-confirm-save @click=${()=>void this.save(!0)}>שמירה</button></div>
      </sw-dialog>
      <sw-dialog heading="להריץ עכשיו?" ?open=${t==="run"} @close=${i}>
        <div class="dlg-body" data-run-confirm>${this.item?.sensitive?"כולל פעולה רגישה – נבדקת כמו שליטה ידנית.":"כולל פעולה מתקדמת שהמערכת לא יודעת לתאר."}${this.dirty?" ההרצה תתבצע על הגרסה השמורה.":""}</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${()=>this.dialog=null}>ביטול</button><button class="btn primary" type="button" data-run-confirm-ok @click=${()=>void this.runNow(!0)}>הרץ</button></div>
      </sw-dialog>
      <sw-dialog heading="להפעיל?" ?open=${t==="enable"} @close=${i}>
        <div class="dlg-body">כולל פעולה מתקדמת שהמערכת לא יודעת לתאר.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${()=>this.dialog=null}>ביטול</button><button class="btn primary" type="button" @click=${()=>void this.toggleEnabled(!0,!0)}>הפעל</button></div>
      </sw-dialog>
      <sw-dialog heading="למחוק?" ?open=${t==="delete"} @close=${i}>
        <div class="dlg-body">${s?`"${s}"`:"הפריט"} יועבר לסל המחזור, ואפשר לשחזר אותו משם.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${()=>this.dialog=null}>ביטול</button><button class="btn danger" type="button" data-delete-confirm @click=${()=>void this.deleteNow()}>מחיקה</button></div>
      </sw-dialog>
      <sw-dialog heading="בדיקה · בלי להפעיל כלום" ?open=${t==="dry"} @close=${i}>
        ${this.dryResult?r`<div class="dlg-body" data-dry-result>
          ${this.dryResult.conditions.length?r`<h5>תנאים עכשיו</h5>${this.dryResult.conditions.map(a=>r`<div class="kvrow"><span>${a.sentence}</span>${a.passed===null?r`<span>לא ניתן לבדוק</span>`:a.passed?r`<span class="ok">מתקיים</span>`:r`<span class="bad">לא מתקיים</span>`}</div>`)}`:d}
          <h5>מה יקרה</h5>
          ${this.dryResult.effects.entities.length?this.dryResult.effects.entities.map(a=>r`<div class="kvrow"><span>${a.name}</span><span>${a.from?`${a.from} → `:""}${a.to??""}</span></div>`):r`<div class="kvrow"><span>לא ידוע אילו מכשירים ישתנו</span></div>`}
          ${this.dryResult.effects.unknown?r`<div class="kvrow"><span>כולל פעולה מתקדמת</span></div>`:d}
        </div>`:d}
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%">
          ${!this.isNew&&this.kind==="automation"&&this.item?.can.run?r`<button class="btn" type="button" data-dry-run-then @click=${()=>{this.dialog=null,this.runNow(!(this.item&&Ot(this.item)),!1)}}>${f("play")}בדוק תנאים ואז הרץ</button>`:d}
          <button class="btn primary" type="button" data-dry-close @click=${()=>this.dialog=null}>סגירה</button></div>
      </sw-dialog>
      <sw-dialog heading="בדיקה" ?open=${t==="devtest"} @close=${i}>${t==="devtest"?r`<kav-device-test .itemId=${this.item?.id??null} .draft=${this.dirty?this.draft:null} .dry=${this.dryResult} .flags=${this.ext}
        @need-dry=${()=>void this.loadDry()} @test-close=${()=>{this.dialog=null,this.emit("item-changed",{kind:this.kind,id:this.item?.id})}}></kav-device-test>`:d}</sw-dialog>
      <sw-dialog heading=${`השוואה ומיזוג${s?` · ${s}`:""}`} ?open=${t==="merge"} @close=${i}>${t==="merge"&&this.conflict&&this.draft&&this.storedDraft&&this.env?r`<kav-merge
        .base=${this.storedDraft} .mine=${this.draft} .theirs=${this.conflict.draft} .ctx=${this.env.ctx} theirsLabel=${this.theirsLabel()}
        @merge-cancel=${()=>this.dialog=null} @merge-save=${a=>this.saveMerged(a.detail.draft)}></kav-merge>`:d}</sw-dialog>
      <sw-dialog heading="השוואה" subheading="שלי מול הגרסה החדשה" ?open=${t==="compare"} @close=${i}>${this.renderCompare()}
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" @click=${()=>this.dialog=null}>סגירה</button></div>
      </sw-dialog>
      <sw-dialog heading="ליצור כתזמון?" ?open=${t==="suggest"} @close=${i}>
        <div class="dlg-body" data-suggest-body>"${s||"האוטומציה"}" היא שעון + שליטה במכשירים – בתזמונים זה פשוט יותר. חלון התזמון ייפתח עם הנתונים שכבר הזנתם.</div>
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%"><button class="btn" type="button" data-suggest-no @click=${()=>this.dialog=null}>השאר אוטומציה</button><button class="btn primary" type="button" data-suggest-yes @click=${()=>this.openSchedule()}>פתח תזמון חדש</button></div>
      </sw-dialog>`}openDeviceTest(){this.dryResult=null,this.dialog="devtest"}async loadDry(){if(!(!this.draft||this.dryResult))try{if(!this.isNew&&!this.dirty&&this.item)this.dryResult=await ie().dryRun(this.kind,this.item.id);else{const s=await ie().preview({kind:this.kind,id:this.isNew?null:this.item?.id??null,draft:this.draft});this.dryResult={conditions:("conditions"in this.draft?this.draft.conditions:[]).map(i=>({sentence:i.sentence,passed:null})),effects:s.effects}}}catch(t){this.note=$e(t)}}theirsLabel(){const t=this.conflict?.updated_at?new Date(this.conflict.updated_at):null;return`החדש${t&&!Number.isNaN(t.getTime())?` · ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`:""}`}saveMerged(t){const s=this.conflict;!s||!this.env||(be(t,this.env.ctx),this.item={...s,draft:this.item?.draft??s.draft},this.storedDraft=F(s.draft),this.draft=t,this.conflict=null,this.dialog=null,this.touched=!0,this.version++,this.save())}renderCompare(){if(!this.conflict||!this.draft||!this.env||this.dialog!=="compare")return d;const t=Un(this.kind,this.draft,this.conflict.draft,this.env.ctx);return t.length?r`<div class="diff" data-compare><span class="h"></span><span class="h">שלי</span><span class="h">החדש</span>
      ${t.map(s=>r`<span class="g">${s.group}</span><span class="c mine">${s.mine}</span><span class="c">${s.theirs}</span>`)}</div>`:r`<div class="dlg-body">אין הבדלים בתוכן.</div>`}openSchedule(){const t=this.suggestDraft;if(this.dialog=null,!t){this.note="לא ניתן לפתוח את התזמונים כרגע";return}try{sessionStorage.setItem(Xi,JSON.stringify(t))}catch{this.note="לא ניתן לפתוח את התזמונים כרגע";return}this.emit("cancel",{reason:"schedule"}),this.closeSelf(),Y("/devices/schedules/new/edit",{draft:"1"})}renderBody(){return this.phase==="loading"?r`<div class="state-box" data-editor-state="loading"><b>טוען…</b></div>`:this.phase==="error"&&this.loadDenied?r`<div class="state-box err" data-editor-state="forbidden"><b>${this.loadError}</b></div>`:this.phase==="error"?r`<div class="state-box err" data-editor-state="error"><b>לא הצלחנו לטעון</b><span>${this.loadError}</span><button class="btn" type="button" @click=${()=>void this.init()}>${f("refresh")}נסו שוב</button></div>`:this.view==="code"?r`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderCodeView()}`:this.renderBuilderBody()}render(){const t=this.phase==="ready"&&this.draft;return r`<dialog class="sheet" tabindex="-1" autofocus aria-label=${this.nameLabel} @cancel=${this.onSheetCancel} @keydown=${this.onSheetKey} @dragend=${this.onDragEnd}>
      ${this.stage==="templates"&&t?this.renderGalleryShell():r`${this.renderHeader()}
        <div class="shb" id="shb" data-editor-body data-view=${this.view}>${this.renderBody()}</div>
        ${t?this.renderFooter():r`<footer class="shf"><span class="sp"></span><button class="btn quiet" type="button" @click=${()=>this.cancel()}>סגירה</button></footer>`}
        ${this.renderTypePop()}${this.renderPicker()}`}
      ${this.renderDialogs()}
    </dialog>`}renderGalleryShell(){return r`<div class="grab" aria-hidden="true"></div>
      <header class="shh"><div class="tx"><h3>אוטומציה חדשה</h3><small>מתבנית או מאפס</small></div>
        <button class="bk" type="button" aria-label="סגירה" data-editor-close @click=${()=>this.cancel()}>${f("close")}</button></header>
      <div class="shb" data-editor-body data-stage="templates"><automation-templates .enabled=${this.status?.ui.templates_enabled!==!1} @template-pick=${t=>this.adoptTemplate(t.detail.template)}></automation-templates></div>`}adoptTemplate(t){if(this.stage="edit",!t||!this.env)return;const s=vn(F(t.draft));be(s,this.env.ctx),this.draft=s,this.templateName=t.name,this.touched=!0,this.version++,this.schedulePreview(0)}}k([m({attribute:"item-id"})],$.prototype,"itemId");k([m()],$.prototype,"mode");k([m({type:Boolean,reflect:!0})],$.prototype,"open");k([m()],$.prototype,"scheme");k([m({attribute:!1})],$.prototype,"draft0");k([u()],$.prototype,"phase");k([u()],$.prototype,"loadError");k([u()],$.prototype,"loadDenied");k([u()],$.prototype,"status");k([u()],$.prototype,"env");k([u()],$.prototype,"item");k([u()],$.prototype,"draft");k([u()],$.prototype,"openUid");k([u()],$.prototype,"view");k([u()],$.prototype,"codeText");k([u()],$.prototype,"codeOk");k([u()],$.prototype,"preview");k([u()],$.prototype,"busy");k([u()],$.prototype,"pop");k([u()],$.prototype,"picker");k([u()],$.prototype,"dialog");k([u()],$.prototype,"dryResult");k([u()],$.prototype,"saveError");k([u()],$.prototype,"serverIssues");k([u()],$.prototype,"conflict");k([u()],$.prototype,"note");k([u()],$.prototype,"dragUid");k([u()],$.prototype,"dropAt");k([u()],$.prototype,"touched");k([u()],$.prototype,"stage");k([u()],$.prototype,"templateName");k([u()],$.prototype,"optionsOpen");k([rt("dialog.sheet")],$.prototype,"sheet");k([rt("automation-code")],$.prototype,"codeEl");const st={cooldown_s:10,max_per_hour:30,max_per_day:300,arm_days:180,storm_refusals:5,storm_window_s:600},Ct={cooldown_s:[1,3600],max_per_hour:[1,600],max_per_day:[1,1e4],arm_days:[1,365]},se="door-automations",Ur={status:()=>He(`${se}/status`),doors:async()=>(await He(`${se}/doors`)).doors,forAutomation:async e=>(await He(`${se}?automation_id=${encodeURIComponent(e)}`)).items[0]??null,create:(e,t,s)=>Ge(se,{automation_id:e,name:t,policy:s}),update:(e,t,s)=>Qi(`${se}/${e.id}`,{name:t,policy:s,policy_revision:e.policy_revision}),arm:e=>Ge(`${se}/${e.id}/arm`,{confirmed:!0,policy_revision:e.policy_revision}),disarm:e=>Ge(`${se}/${e.id}/disarm`,{}),simulate:e=>Ge(`${se}/${e.id}/simulate`,{}),remove:async e=>{await Zi(`${se}/${e.id}`)},fires:async e=>(await He(`${se}/${e.id}/fires`)).fires};function Ps(){return{doors:[],windows:[]}}function Vr(e={}){const t=new Map,s=[{station_id:"demo-entry",relay:1,name:"כניסה ראשית",online:!0,can_arm:!0},{station_id:"demo-dock",relay:2,name:"רציף · שער",online:!0,can_arm:!0},{station_id:"demo-roof",relay:1,name:"יציאה לגג",online:!1,can_arm:!1}];let i=0;const a=()=>new Date().toISOString().replace(/\.\d{3}Z$/,"Z"),n=l=>l.doors.map(c=>({...c,name:s.find(p=>p.station_id===c.station_id&&p.relay===c.relay)?.name??null})),o=l=>[...t.values()].find(c=>c.id===l);return{status:async()=>e.visible?{visible:!0,feature:e.available?"on":"off",go_live_permitted:!!e.available,available:!!e.available,killed:!!e.killed,can_manage:!0,can_lift_kill:!0,can_configure:!0,limits:{...st}}:{visible:!1},doors:async()=>s.map(l=>({...l})),forAutomation:async l=>t.get(l)??null,create:async(l,c,p)=>{const v=a(),b={id:`da_demo${String(++i).padStart(27,"0")}`,automation_id:l,automation_name:null,name:c,state:"draft",policy:structuredClone(p),policy_revision:1,doors:n(p),bound_item_revision:null,armed_by:null,armed_by_name:null,armed_at:null,armed_until:null,disarm_reason:null,disarmed_at:null,created_at:v,updated_at:v};return t.set(l,b),structuredClone(b)},update:async(l,c,p)=>{const v=o(l.id);return Object.assign(v,{name:c,policy:structuredClone(p),doors:n(p),policy_revision:v.policy_revision+1,updated_at:a()}),v.state==="armed"&&Object.assign(v,{state:"disarmed",disarm_reason:"edited",disarmed_at:a()}),structuredClone(v)},arm:async l=>{const c=o(l.id),p=new Date(Date.now()+(c.policy.arm_days??st.arm_days)*864e5).toISOString().replace(/\.\d{3}Z$/,"Z");return Object.assign(c,{state:"armed",armed_by:"demo",armed_by_name:"מנהל המערכת",armed_at:a(),armed_until:p,disarm_reason:null,disarmed_at:null}),structuredClone(c)},disarm:async l=>{const c=o(l.id);return c.state==="armed"&&Object.assign(c,{state:"disarmed",disarm_reason:"manual",disarmed_at:a()}),structuredClone(c)},simulate:async l=>{const c=o(l.id),p=[{gate:"armed",ok:c.state==="armed",reason:c.state==="armed"?null:"not_armed"},{gate:"feature",ok:!!e.available,reason:e.available?null:"feature_off"},{gate:"kill",ok:!e.killed,reason:e.killed?"killed":null}],v=c.doors.map(b=>({door:b.name,decision:"would_open",reason:null}));return{at:a(),gates:p,doors:v,would_send:p.every(b=>b.ok)}},remove:async l=>{for(const[c,p]of t)p.id===l.id&&t.delete(c)},fires:async()=>[]}}function Hr(){try{return typeof location<"u"&&new URLSearchParams(location.search).has("demo-door-automation")}catch{return!1}}let Gr=null;const Yr=()=>Xe()?Ur:Gr??=Vr({visible:Hr()}),Wt={title:"פתיחת דלת",sub:"Arx פותחת את הדלת כשהאוטומציה רצה, רק בתנאים שלמטה",stateDraft:"טיוטה · לא פעיל",stateArmed:"פעיל",stateDisarmed:"כבוי",off:"כבוי בגרסה הזו",killed:"כל פתיחות הדלתות מאוטומציות עצורות",add:"הוספת פתיחת דלת",name:"שם",doors:"דלתות",doorsEmpty:"אין דלתות שמותר לך להוסיף",doorNoOpen:"אין לך הרשאה לפתוח דלת זו",doorOffline:"לא מחוברת",windows:"מתי מותר",windowAdd:"הוספת חלון זמן",anyTime:"בכל זמן",windowRemove:"הסרה",from:"מ־",to:"עד",limits:"מגבלות",cooldown:"המתנה בין פתיחות (שניות)",perHour:"פתיחות לדלת בשעה",perDay:"פתיחות ביום",armDays:"תוקף ההפעלה (ימים)",save:"שמירה",edit:"עריכה",arm:"הפעלה",disarm:"כיבוי",simulate:"בדיקה",remove:"מחיקה",cancel:"ביטול",armTitle:"להפעיל פתיחת דלת מאוטומציה?",armText:"הדלתות שנבחרו ייפתחו בלי אדם ליד, בכל פעם שהאוטומציה רצה בחלונות הזמן שנבחרו. ההפעלה נרשמת על שמך ונכבית מעצמה אחרי {days} ימים, בכל שינוי ואם תאבד הרשאה.",armConfirm:"הפעלה",removeTitle:"למחוק את פתיחת הדלת?",armedBy:"הופעל בידי {who} · עד {until}",disarmedWhy:"כבוי: {why}",simTitle:"תוצאת בדיקה",simWould:"הייתה נשלחת פתיחה",simWouldNot:"לא הייתה נשלחת פתיחה",simNothing:"שום דבר לא נשלח",history:"פעולות אחרונות",historyEmpty:"עדיין לא רצה",saved:"נשמר",loadError:"לא ניתן לטעון",retry:"נסה שוב",needDoor:"יש לבחור לפחות דלת אחת",needWindow:"יש להגדיר לפחות חלון זמן אחד",badWindow:"שעת הסיום חייבת להיות אחרי שעת ההתחלה",saveFirst:"יש לשמור את האוטומציה לפני הוספת פתיחת דלת",d0:"ב׳",d1:"ג׳",d2:"ד׳",d3:"ה׳",d4:"ו׳",d5:"ש׳",d6:"א׳",g_armed:"מופעל",g_feature:"זמין בגרסה",g_kill:"לא עצור",g_expiry:"בתוקף",g_trigger:"הופעל מעצמו",g_revision:"האוטומציה לא שונתה",g_window:"בתוך חלון הזמן",r_not_armed:"לא מופעל",r_feature_off:"כבוי בגרסה הזו",r_killed:"עצור",r_arm_expired:"תוקף ההפעלה פג",r_manual_trigger:"הופעל ידנית - פתיחה רק מכפתור הדלת",r_item_changed:"האוטומציה שונתה",r_item_missing:"האוטומציה לא נמצאה",r_outside_window:"מחוץ לחלון הזמן",r_clock_untrusted:"אזור הזמן של המערכת לא תקין",r_door_unavailable:"הדלת לא זמינה",r_armer_lost_authority:"למי שהפעיל אין עוד הרשאה",r_cooldown:"פתיחה קודמת לפני זמן קצר",r_rate_hour:"הגיע למכסה השעתית",r_rate_day:"הגיע למכסה היומית",r_storm:"נעצר אחרי ניסיונות חוזרים",r_edited:"ההגדרה שונתה",r_manual:"כובה ידנית",r_deleted:"נמחק",r_loop_risk:"האוטומציה מופעלת מהדלת עצמה",r_triggers_unresolvable:"לא ניתן לזהות מה מפעיל את האוטומציה",r_uncorroborated:"ההפעלה לא אומתה מול מצב המערכת",r_door_rate_hour:"הדלת הגיעה למכסה השעתית שלה",r_door_rate_day:"הדלת הגיעה למכסה היומית שלה",r_restored:"כובה אחרי שחזור גיבוי",o_sent:"נשלח",o_refused:"לא נשלח",o_unknown:"לא ידוע אם נשלח",o_not_sent:"לא נשלח",o_pending:"בטיפול"},Kr={title:"Open a door",sub:"Arx opens the door when the automation runs, only under the conditions below",stateDraft:"Draft · not active",stateArmed:"Active",stateDisarmed:"Off",off:"Off in this version",killed:"All door openings by automations are stopped",add:"Add a door opening",name:"Name",doors:"Doors",doorsEmpty:"No doors you may add",doorNoOpen:"You may not open this door",doorOffline:"Offline",windows:"When it is allowed",windowAdd:"Add a time window",anyTime:"Any time",windowRemove:"Remove",from:"From",to:"To",limits:"Limits",cooldown:"Wait between openings (seconds)",perHour:"Openings per door per hour",perDay:"Openings per day",armDays:"Activation valid for (days)",save:"Save",edit:"Edit",arm:"Activate",disarm:"Turn off",simulate:"Test",remove:"Delete",cancel:"Cancel",armTitle:"Activate door opening by this automation?",armText:"The chosen doors will open with nobody present, every time the automation runs inside the chosen time windows. The activation is recorded in your name and turns itself off after {days} days, on any change, and if you lose the permission.",armConfirm:"Activate",removeTitle:"Delete the door opening?",armedBy:"Activated by {who} · until {until}",disarmedWhy:"Off: {why}",simTitle:"Test result",simWould:"An opening would be sent",simWouldNot:"No opening would be sent",simNothing:"Nothing was sent",history:"Recent activity",historyEmpty:"Has not run yet",saved:"Saved",loadError:"Could not load",retry:"Try again",needDoor:"Choose at least one door",needWindow:"Set at least one time window",badWindow:"The end time must be after the start time",saveFirst:"Save the automation before adding a door opening",d0:"Mon",d1:"Tue",d2:"Wed",d3:"Thu",d4:"Fri",d5:"Sat",d6:"Sun",g_armed:"Active",g_feature:"Available in this version",g_kill:"Not stopped",g_expiry:"Still valid",g_trigger:"Started on its own",g_revision:"Automation unchanged",g_window:"Inside a time window",r_not_armed:"Not active",r_feature_off:"Off in this version",r_killed:"Stopped",r_arm_expired:"The activation expired",r_manual_trigger:"Started by hand - use the door button instead",r_item_changed:"The automation was changed",r_item_missing:"The automation was not found",r_outside_window:"Outside the time windows",r_clock_untrusted:"The system time zone is not valid",r_door_unavailable:"The door is unavailable",r_armer_lost_authority:"The person who activated it lost the permission",r_cooldown:"Opened a moment ago",r_rate_hour:"Hourly limit reached",r_rate_day:"Daily limit reached",r_storm:"Stopped after repeated attempts",r_edited:"The settings were changed",r_manual:"Turned off by hand",r_deleted:"Deleted",r_loop_risk:"The automation is started by the door itself",r_triggers_unresolvable:"What starts the automation cannot be determined",r_uncorroborated:"The run could not be confirmed against the system state",r_door_rate_hour:"The door reached its hourly limit",r_door_rate_day:"The door reached its daily limit",r_restored:"Turned off after a backup restore",o_sent:"Sent",o_refused:"Not sent",o_unknown:"Unknown whether sent",o_not_sent:"Not sent",o_pending:"In progress"},Jr={title:"فتح باب",sub:"يفتح Arx الباب عند تشغيل الأتمتة، فقط ضمن الشروط أدناه",stateDraft:"مسودة · غير مفعّل",stateArmed:"مفعّل",stateDisarmed:"متوقف",off:"متوقف في هذا الإصدار",killed:"كل عمليات فتح الأبواب بالأتمتة متوقفة",add:"إضافة فتح باب",name:"الاسم",doors:"الأبواب",doorsEmpty:"لا توجد أبواب يمكنك إضافتها",doorNoOpen:"لا تملك صلاحية فتح هذا الباب",doorOffline:"غير متصل",windows:"متى يُسمح",windowAdd:"إضافة فترة زمنية",anyTime:"في أي وقت",windowRemove:"إزالة",from:"من",to:"إلى",limits:"الحدود",cooldown:"الانتظار بين عمليات الفتح (ثوانٍ)",perHour:"عمليات الفتح لكل باب في الساعة",perDay:"عمليات الفتح في اليوم",armDays:"مدة صلاحية التفعيل (أيام)",save:"حفظ",edit:"تعديل",arm:"تفعيل",disarm:"إيقاف",simulate:"فحص",remove:"حذف",cancel:"إلغاء",armTitle:"تفعيل فتح الباب بهذه الأتمتة؟",armText:"ستُفتح الأبواب المختارة دون وجود أحد، في كل مرة تعمل فيها الأتمتة ضمن الفترات المختارة. يُسجَّل التفعيل باسمك ويتوقف تلقائيًا بعد {days} يومًا، وعند أي تغيير، وإذا فقدت الصلاحية.",armConfirm:"تفعيل",removeTitle:"حذف فتح الباب؟",armedBy:"فعّله {who} · حتى {until}",disarmedWhy:"متوقف: {why}",simTitle:"نتيجة الفحص",simWould:"كان سيُرسل أمر فتح",simWouldNot:"لم يكن سيُرسل أمر فتح",simNothing:"لم يُرسل شيء",history:"آخر النشاطات",historyEmpty:"لم يعمل بعد",saved:"تم الحفظ",loadError:"تعذّر التحميل",retry:"إعادة المحاولة",needDoor:"اختر بابًا واحدًا على الأقل",needWindow:"حدّد فترة زمنية واحدة على الأقل",badWindow:"يجب أن يكون وقت الانتهاء بعد وقت البدء",saveFirst:"احفظ الأتمتة قبل إضافة فتح باب",d0:"الإثنين",d1:"الثلاثاء",d2:"الأربعاء",d3:"الخميس",d4:"الجمعة",d5:"السبت",d6:"الأحد",o_sent:"أُرسل",o_refused:"لم يُرسل",o_unknown:"غير معروف إن أُرسل",o_not_sent:"لم يُرسل",r_uncorroborated:"لم يتم التحقق من التشغيل مقابل حالة النظام",r_door_rate_hour:"وصل الباب إلى حده في الساعة",r_door_rate_day:"وصل الباب إلى حده اليومي",r_restored:"أُوقف بعد استعادة نسخة احتياطية"},Xr={title:"Открыть дверь",sub:"Arx открывает дверь при запуске автоматизации, только при условиях ниже",stateDraft:"Черновик · не активно",stateArmed:"Активно",stateDisarmed:"Выключено",off:"Выключено в этой версии",killed:"Все открытия дверей автоматизациями остановлены",add:"Добавить открытие двери",name:"Название",doors:"Двери",doorsEmpty:"Нет дверей, которые вы можете добавить",doorNoOpen:"У вас нет права открывать эту дверь",doorOffline:"Не в сети",windows:"Когда разрешено",windowAdd:"Добавить интервал",anyTime:"В любое время",windowRemove:"Удалить",from:"С",to:"До",limits:"Ограничения",cooldown:"Пауза между открытиями (секунды)",perHour:"Открытий одной двери в час",perDay:"Открытий в день",armDays:"Срок действия активации (дни)",save:"Сохранить",edit:"Изменить",arm:"Активировать",disarm:"Выключить",simulate:"Проверка",remove:"Удалить",cancel:"Отмена",armTitle:"Активировать открытие двери этой автоматизацией?",armText:"Выбранные двери будут открываться без присутствия людей каждый раз, когда автоматизация запускается в выбранные интервалы. Активация записывается на ваше имя и выключается сама через {days} дн., при любом изменении и при потере вами права.",armConfirm:"Активировать",removeTitle:"Удалить открытие двери?",armedBy:"Активировал(а) {who} · до {until}",disarmedWhy:"Выключено: {why}",simTitle:"Результат проверки",simWould:"Команда открытия была бы отправлена",simWouldNot:"Команда открытия не была бы отправлена",simNothing:"Ничего не отправлено",history:"Последние действия",historyEmpty:"Ещё не запускалось",saved:"Сохранено",loadError:"Не удалось загрузить",retry:"Повторить",needDoor:"Выберите хотя бы одну дверь",needWindow:"Задайте хотя бы один интервал",badWindow:"Время окончания должно быть позже времени начала",saveFirst:"Сохраните автоматизацию, прежде чем добавлять открытие двери",d0:"Пн",d1:"Вт",d2:"Ср",d3:"Чт",d4:"Пт",d5:"Сб",d6:"Вс",o_sent:"Отправлено",o_refused:"Не отправлено",o_unknown:"Неизвестно, отправлено ли",o_not_sent:"Не отправлено",r_uncorroborated:"Запуск не подтверждён состоянием системы",r_door_rate_hour:"Дверь достигла часового лимита",r_door_rate_day:"Дверь достигла дневного лимита",r_restored:"Отключено после восстановления из резервной копии"};function it(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const Zr={he:Wt,en:Kr,ar:Jr,ru:Xr};function y(e,t,s=it()){const i=Zr[s][e]??Wt[e]??e;return t?i.replace(/\{(\w+)\}/g,(a,n)=>n in t?String(t[n]):a):i}function we(e,t,s=it()){const i=`${e}_${t??""}`;return i in Wt?y(i,void 0,s):y(e==="o"?"o_refused":"r_not_armed",void 0,s)}function Qr(e,t,s){return t.killed?{tone:"warn",text:y("killed",void 0,s)}:!e||e.state==="draft"?{tone:"neutral",text:y("stateDraft",void 0,s)}:e.state==="disarmed"?{tone:"off",text:y("stateDisarmed",void 0,s)}:t.available?{tone:"live",text:y("stateArmed",void 0,s)}:{tone:"off",text:y("off",void 0,s)}}function eo(e,t,s=i=>i.slice(0,10)){return e?e.state==="armed"&&e.armed_until?y("armedBy",{who:e.armed_by_name||e.armed_by||"",until:s(e.armed_until)},t):e.state==="disarmed"&&e.disarm_reason?y("disarmedWhy",{why:we("r",e.disarm_reason,t)},t):null:null}function As(e){if(e==="24:00")return 1440;const[t,s]=e.split(":").map(Number);return t*60+s}const Ns=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;function to(e,t){const s=[];return t.doors.length||s.push("needDoor"),t.windows.some(i=>!i.days.length||!Ns.test(i.start)||!(i.end==="24:00"||Ns.test(i.end))||As(i.start)>=As(i.end))&&s.push("badWindow"),e.trim()||s.push("name"),s}function Rs(e){return e==="he"||e==="ar"?[6,0,1,2,3,4,5]:[0,1,2,3,4,5,6]}function so(e,t){const s=e.days.includes(t)?e.days.filter(i=>i!==t):[...e.days,t].sort((i,a)=>i-a);return{...e,days:s}}const at=(e,t)=>e.station_id===t.station_id&&e.relay===t.relay;function io(e,t){const i=e.doors.some(a=>at(a,t))?e.doors.filter(a=>!at(a,t)):[...e.doors,{station_id:t.station_id,relay:t.relay}];return{...e,doors:i}}function ao(e,t,s,i){return!e||i||e.state==="armed"||t.killed?!1:e.policy.doors.length>0&&e.policy.doors.every(a=>s.some(n=>at(n,a)&&n.can_arm))}function no(e){const t={doors:e.doors.map(s=>({station_id:s.station_id,relay:s.relay})),windows:e.windows.map(s=>({days:[...s.days].sort((i,a)=>i-a),start:s.start,end:s.end}))};for(const s of Object.keys(Ct)){const i=e[s];if(i==null||!Number.isFinite(i))continue;const[a,n]=Ct[s];t[s]=Math.min(n,Math.max(a,Math.round(i)))}return t}var ro=Object.defineProperty,oo=Object.getOwnPropertyDescriptor,U=(e,t,s,i)=>{for(var a=i>1?void 0:i?oo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ro(t,s,a),a};let M=class extends K{constructor(){super(...arguments),this.automationId=null,this.adapter=null,this.status=null,this.block=null,this.choices=[],this.editing=!1,this.name="",this.policy=Ps(),this.dirty=!1,this.busy=!1,this.error=null,this.confirm=null,this.sim=null,this.history=[],this.problems=[]}get api(){return this.adapter??Yr()}updated(e){(e.has("automationId")||e.has("adapter"))&&this.load()}async load(){this.error=null,this.sim=null;try{const e=await this.api.status();if(this.status=e,!e.visible||!this.automationId)return;const[t,s]=await Promise.all([this.api.forAutomation(this.automationId),this.api.doors()]);this.choices=s,this.setBlock(t),this.history=t?await this.api.fires(t):[]}catch{this.error=y("loadError")}}setBlock(e){this.block=e,this.name=e?.name??"",this.policy=e?structuredClone(e.policy):Ps(),this.dirty=!1,this.problems=[]}edit(e){e(),this.dirty=!0,this.sim=null,this.problems=[]}async run(e){this.busy=!0,this.error=null;try{await e()}catch(t){const s=t?.body?.user_message;this.error=typeof s=="string"&&s?s:y("loadError")}finally{this.busy=!1}}save(){const e=to(this.name,this.policy);return this.problems=e,e.length?Promise.resolve():this.run(async()=>{const t=no(this.policy),s=this.block?await this.api.update(this.block,this.name.trim(),t):await this.api.create(this.automationId,this.name.trim(),t);this.setBlock(s),this.editing=!1})}arm(){return this.confirm=null,this.run(async()=>this.setBlock(await this.api.arm(this.block)))}disarm(){return this.run(async()=>this.setBlock(await this.api.disarm(this.block)))}simulate(){return this.run(async()=>{this.sim=await this.api.simulate(this.block)})}removeBlock(){return this.confirm=null,this.run(async()=>{await this.api.remove(this.block),this.setBlock(null),this.editing=!1,this.history=[]})}render(){const e=this.status;if(!e?.visible)return d;if(!this.automationId)return r`<section class="da"><p class="muted">${y("saveFirst")}</p></section>`;const t=Qr(this.block,e),s=eo(this.block);return r`<section class="da" data-door-automation aria-labelledby="da-title">
      <header>
        <span class="k">${f("door",14)}</span>
        <div class="hd"><h4 id="da-title">${y("title")}</h4><small>${y("sub")}</small></div>
        <span class="tag ${t.tone}" data-state>${t.text}</span>
      </header>
      ${s?r`<p class="line">${s}</p>`:d}
      ${this.error?r`<p class="err" role="alert">${this.error} <button class="link" type="button" @click=${()=>void this.load()}>${y("retry")}</button></p>`:d}
      ${!this.block&&!this.editing?r`<button class="btn" type="button" data-add ?disabled=${this.busy} @click=${()=>{this.editing=!0,this.setBlock(null)}}>${f("door")}${y("add")}</button>`:this.editing?this.renderForm():this.renderSummary()}
      ${this.renderConfirm()}${this.renderSim()}
    </section>`}renderSummary(){const e=this.block,t=this.status;return r`<div class="sum">
        <div class="chips">${e.doors.map(s=>r`<span class="tag acc">${f("door",12)}<bdi>${s.name??"—"}</bdi></span>`)}</div>
        <div class="chips">${e.policy.windows.length===0?r`<span class="tag">${y("anyTime")}</span>`:d}${e.policy.windows.map(s=>r`<span class="tag"><bdi>${this.daysText(s.days)}</bdi> · <bdi dir="ltr">${s.start}–${s.end}</bdi></span>`)}</div>
      </div>
      <div class="row">
        <button class="btn" type="button" data-edit ?disabled=${this.busy} @click=${()=>{this.editing=!0}}>${f("edit")}${y("edit")}</button>
        ${e.state==="armed"?r`<button class="btn" type="button" data-disarm ?disabled=${this.busy} @click=${()=>void this.disarm()}>${y("disarm")}</button>`:r`<button class="btn primary" type="button" data-arm ?disabled=${this.busy||!ao(e,t,this.choices,this.dirty)} @click=${()=>{this.confirm="arm"}}>${y("arm")}</button>`}
        <button class="btn" type="button" data-simulate ?disabled=${this.busy} @click=${()=>void this.simulate()}>${f("flask")}${y("simulate")}</button>
        <button class="btn ghost" type="button" data-remove ?disabled=${this.busy} @click=${()=>{this.confirm="remove"}}>${f("trash")}${y("remove")}</button>
      </div>
      ${this.renderHistory()}`}daysText(e){return Rs(it()).filter(s=>e.includes(s)).map(s=>y(`d${s}`)).join(" ")}renderForm(){const e=this.policy,t=it();return r`<form class="form" @submit=${s=>{s.preventDefault(),this.save()}}>
      <label class="fld"><span>${y("name")}</span>
        <input type="text" maxlength="80" .value=${this.name} data-name @input=${s=>this.edit(()=>{this.name=s.target.value})} />
      </label>
      <fieldset><legend>${y("doors")}</legend>
        ${this.choices.length===0?r`<p class="muted">${y("doorsEmpty")}</p>`:d}
        ${this.choices.map(s=>r`<label class="door ${s.can_arm?"":"dim"}">
          <input type="checkbox" .checked=${e.doors.some(i=>at(i,s))} data-door=${`${s.station_id}#${s.relay}`}
            @change=${()=>this.edit(()=>{this.policy=io(this.policy,s)})} />
          <bdi>${s.name}</bdi>
          ${s.online?d:r`<span class="tag">${y("doorOffline")}</span>`}
          ${s.can_arm?d:r`<span class="tag warn">${y("doorNoOpen")}</span>`}
        </label>`)}
      </fieldset>
      <fieldset><legend>${y("windows")}</legend>
        ${e.windows.length===0?r`<p class="muted" data-any-time>${y("anyTime")}</p>`:d}
        ${e.windows.map((s,i)=>r`<div class="win" data-window=${i}>
          <div class="days" role="group">${Rs(t).map(a=>r`<button type="button" class="day ${s.days.includes(a)?"on":""}" aria-pressed=${s.days.includes(a)?"true":"false"}
            @click=${()=>this.edit(()=>{this.policy={...this.policy,windows:this.policy.windows.map((n,o)=>o===i?so(n,a):n)}})}>${y(`d${a}`)}</button>`)}</div>
          <label class="t"><span>${y("from")}</span><input type="time" lang=${Le()} dir="ltr" .value=${s.start} @change=${a=>this.setWin(i,"start",a.target.value)} /></label>
          <label class="t"><span>${y("to")}</span><input type="time" lang=${Le()} dir="ltr" .value=${s.end==="24:00"?"23:59":s.end} @change=${a=>this.setWin(i,"end",a.target.value)} /></label>
          ${e.windows.length>0?r`<button type="button" class="link" @click=${()=>this.edit(()=>{this.policy={...this.policy,windows:this.policy.windows.filter((a,n)=>n!==i)}})}>${y("windowRemove")}</button>`:d}
        </div>`)}
        ${e.windows.length<7?r`<button type="button" class="link" data-add-window @click=${()=>this.edit(()=>{this.policy={...this.policy,windows:[...this.policy.windows,{days:[6,0,1,2,3],start:"07:00",end:"09:00"}]}})}>+ ${y("windowAdd")}</button>`:d}
      </fieldset>
      <details class="lim"><summary>${y("limits")}</summary>
        ${this.num("cooldown","cooldown_s")}${this.num("perHour","max_per_hour")}${this.num("perDay","max_per_day")}${this.num("armDays","arm_days")}
      </details>
      ${this.problems.length?r`<p class="err" role="alert">${this.problems.map(s=>y(s)).join(" · ")}</p>`:d}
      <div class="row">
        <button class="btn primary" type="submit" data-save ?disabled=${this.busy}>${y("save")}</button>
        <button class="btn" type="button" ?disabled=${this.busy} @click=${()=>{this.editing=!1,this.setBlock(this.block)}}>${y("cancel")}</button>
      </div>
    </form>`}setWin(e,t,s){this.edit(()=>{const i=t==="end"&&s==="23:59"?"24:00":s;this.policy={...this.policy,windows:this.policy.windows.map((a,n)=>n===e?{...a,[t]:i}:a)}})}num(e,t){const[s,i]=Ct[t],a=(this.status?.limits??st)[t],n=this.policy[t];return r`<label class="fld n"><span>${y(e)}</span><input type="number" dir="ltr" min=${s} max=${i} placeholder=${String(a)} data-limit=${t}
      .value=${n===void 0?"":String(n)}
      @change=${o=>this.edit(()=>{const l=o.target.value.trim(),c={...this.policy};l===""?delete c[t]:c[t]=Number(l),this.policy=c})} /></label>`}renderConfirm(){if(!this.confirm||!this.block)return d;const e=this.confirm==="arm";return r`<div class="confirm" role="alertdialog" aria-labelledby="da-confirm-title" data-confirm=${this.confirm}>
      <h5 id="da-confirm-title">${y(e?"armTitle":"removeTitle")}</h5>
      ${e?r`<p>${y("armText",{days:this.block.effective_limits?.arm_days??this.block.policy.arm_days??(this.status?.limits??st).arm_days})}</p>`:d}
      <div class="row">
        <button class="btn ${e?"primary":"danger"}" type="button" data-confirm-yes ?disabled=${this.busy} @click=${()=>void(e?this.arm():this.removeBlock())}>${y(e?"armConfirm":"remove")}</button>
        <button class="btn" type="button" @click=${()=>{this.confirm=null}}>${y("cancel")}</button>
      </div>
    </div>`}renderSim(){const e=this.sim;return e?r`<div class="sim" data-sim role="status">
      <h5>${y("simTitle")} · <span class="tag ${e.would_send?"ok":"warn"}">${e.would_send?y("simWould"):y("simWouldNot")}</span></h5>
      <ul>${e.gates.map(t=>r`<li class=${t.ok?"ok":"no"}>${t.ok?"✓":"✕"} ${t.ok?we("g",t.gate):we("r",t.reason)}</li>`)}
        ${e.doors.map(t=>r`<li class=${t.decision==="would_open"?"ok":"no"}>${f("door",12)} <bdi>${t.door??"—"}</bdi>${t.reason?r` · ${we("r",t.reason)}`:d}</li>`)}</ul>
      <small class="muted">${y("simNothing")}</small>
    </div>`:d}renderHistory(){return this.block?r`<details class="hist"><summary>${y("history")}</summary>
      ${this.history.length===0?r`<p class="muted">${y("historyEmpty")}</p>`:r`<ul>${this.history.slice(0,10).map(e=>r`<li><bdi dir="ltr">${e.at.slice(0,16).replace("T"," ")}</bdi> · <bdi>${e.door??"—"}</bdi> · ${e.attempted?we("o",e.outcome):we("r",e.reason)}</li>`)}</ul>`}
    </details>`:d}};M.styles=[Se,L`
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
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
    `];U([m({attribute:"automation-id"})],M.prototype,"automationId",2);U([m({attribute:!1})],M.prototype,"adapter",2);U([u()],M.prototype,"status",2);U([u()],M.prototype,"block",2);U([u()],M.prototype,"choices",2);U([u()],M.prototype,"editing",2);U([u()],M.prototype,"name",2);U([u()],M.prototype,"policy",2);U([u()],M.prototype,"dirty",2);U([u()],M.prototype,"busy",2);U([u()],M.prototype,"error",2);U([u()],M.prototype,"confirm",2);U([u()],M.prototype,"sim",2);U([u()],M.prototype,"history",2);U([u()],M.prototype,"problems",2);M=U([W("door-automation-block")],M);var lo=Object.getOwnPropertyDescriptor,co=(e,t,s,i)=>{for(var a=i>1?void 0:i?lo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};let Ls=class extends ${get kind(){return"automation"}get nameLabel(){return"שם האוטומציה"}get startsWithGallery(){return!0}subtitleNew(){return"אוטומציה חדשה"}blankDraft(){return{alias:"",description:"",mode:"single",max:null,triggers:[],conditions:[],actions:[]}}renderBuilderBody(){const e=this.draft,t=e.triggers.length;return r`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="trigger">
        <h4><span class="k when">${f("bolt",14)}</span>כאשר<small>${t===0?"מה מפעיל":t===1?"טריגר אחד":`${t} טריגרים · אחד מהם מספיק`}</small></h4>
        ${this.renderList(Z,"triggers","trigger")}
      </section>
      <section class="bsec2" data-section="condition">
        <h4><span class="k if">${f("question",14)}</span>אם<small>${e.conditions.length?"כל התנאים צריכים להתקיים":"לא חובה"}</small></h4>
        ${this.renderList(Z,"conditions","condition")}
      </section>
      <section class="bsec2" data-section="action">
        <h4><span class="k then">${f("play",14)}</span>אז<small>${e.actions.length?`${e.actions.length} צעדים, לפי הסדר`:"מה לעשות"}</small></h4>
        ${this.renderList(Z,"actions","action")}
        ${this.isNew?d:r`<door-automation-block .automationId=${this.itemId}></door-automation-block>`}
      </section>
      ${this.renderOptionsBox(this.renderDeleteRow()??d)}`}};Ls=co([W("automation-builder")],Ls);var po=Object.defineProperty,uo=Object.getOwnPropertyDescriptor,Ut=(e,t,s,i)=>{for(var a=i>1?void 0:i?uo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&po(t,s,a),a};const ho={number:"thermo",entity:"layers",boolean:"check",select:"list",text:"edit",locked:"lock"},Bs=["number","boolean","select","text","entity"];let qe=class extends ${constructor(){super(...arguments),this.openField=null,this.adding=!1}get kind(){return"script"}get nameLabel(){return"שם הסקריפט"}subtitleNew(){return"סקריפט חדש"}blankDraft(){return{alias:"",description:"",icon:null,mode:"single",max:null,fields:[],sequence:[]}}footerExtras(){return d}setFields(e){if(!this.draft)return;const t=F(this.draft);e(t.fields),this.change(t)}fieldEditor(e,t){const s=n=>this.setFields(o=>n(o[t])),i=e.selector,a=(n,o,l)=>r`<label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${l} aria-label=${l} .value=${n===void 0?"":String(n)}
      @change=${c=>{const p=c.target.value.trim().replace(",","."),v=p===""?void 0:Number(p);o(v!==void 0&&Number.isFinite(v)?v:void 0)}} /></label>`;return r`<div class="edit" data-field-edit=${t}>
      <div class="frow">
        <div class="fld"><label>שם השדה</label><label class="inp"><input data-fld="field.name" aria-label="שם השדה" dir="auto" .value=${e.name} @input=${n=>s(o=>{o.name=n.target.value})} /></label></div>
        <div class="fld"><label>מפתח (לטינית)</label><label class="inp"><input data-fld="field.key" aria-label="מפתח" dir="ltr" .value=${e.key} @change=${n=>s(o=>{o.key=n.target.value.trim()})} /></label></div>
      </div>
      <div class="frow">
        <div class="fld"><label>סוג</label><select class="selx" data-fld="field.kind" aria-label="סוג" @change=${n=>{const o=n.target.value;s(l=>{l.selector=ks(o,[]).selector,l.default=void 0})}}>
          ${Bs.map(n=>r`<option value=${n} ?selected=${i.kind===n}>${xs[n]}</option>`)}</select></div>
        <div class="fld sm"><label>חובה</label><div class="rolechips"><button type="button" aria-pressed=${e.required} data-field-required @click=${()=>s(n=>{n.required=!n.required})}>${e.required?"חובה":"לא חובה"}</button></div></div>
      </div>
      ${i.kind==="number"?r`<div class="frow"><div class="fld sm"><label>מינימום</label>${a(i.min,n=>s(o=>{o.selector.kind==="number"&&(o.selector.min=n??0)}),"field.min")}</div>
        <div class="fld sm"><label>מקסימום</label>${a(i.max,n=>s(o=>{o.selector.kind==="number"&&(o.selector.max=n??100)}),"field.max")}</div>
        <div class="fld sm"><label>צעד</label>${a(i.step,n=>s(o=>{o.selector.kind==="number"&&(n?o.selector.step=n:delete o.selector.step)}),"field.step")}</div>
        <div class="fld sm"><label>ברירת מחדל</label>${a(typeof e.default=="number"?e.default:void 0,n=>s(o=>{o.default=n}),"field.default")}</div></div>`:d}
      ${i.kind==="select"?r`<div class="fld full"><label>אפשרויות (אחת בכל שורה)</label><label class="inp area"><textarea rows="3" data-fld="field.options" aria-label="אפשרויות" .value=${i.options.join(`
`)}
        @change=${n=>s(o=>{o.selector.kind==="select"&&(o.selector.options=n.target.value.split(`
`).map(l=>l.trim()).filter(Boolean))})}></textarea></label></div>`:d}
      ${i.kind==="entity"?r`<div class="fld full"><label>סוגי מכשיר (לטינית, מופרדים בפסיק; ריק = הכל)</label><label class="inp"><input data-fld="field.domains" aria-label="סוגי מכשיר" dir="ltr" .value=${i.domains.join(", ")}
        @change=${n=>s(o=>{o.selector.kind==="entity"&&(o.selector.domains=n.target.value.split(",").map(l=>l.trim()).filter(Boolean))})} /></label></div>`:d}
    </div>`}renderBuilderBody(){const e=this.draft,t=this.issues;return r`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="fields">
        <h4><span class="k if">${f("list",14)}</span>שדות<small>${e.fields.length?e.fields.length:"אין"}</small></h4>
        <div class="fieldlist">${e.fields.map((s,i)=>{const a=this.openField===i,n=t.some(o=>o.path===`fields.${i}`);return r`<div class="frow2 ${a?"open":""} ${n?"bad":""}" data-field=${s.key}>
            <div class="h">
              <button class="main" type="button" aria-expanded=${a} data-field-main @click=${()=>this.openField=a?null:i}>
                <span class="rg">${f(ho[s.selector.kind]??"list")}</span><span class="nm">${s.name||"שדה חדש"}<small>${Jn(s)}</small></span><code>${s.key}</code></button>
              ${this.hardReadOnly?d:r`<button class="x" type="button" aria-label="מחיקת השדה" data-field-remove @click=${()=>{this.setFields(o=>o.splice(i,1)),this.openField=null}}>${f("close")}</button>`}
            </div>
            ${a&&s.selector.kind!=="locked"?this.fieldEditor(s,i):a?r`<div class="edit"><div class="codenote">${f("lock")}שדה מתקדם – נשמר כמו שהוא.</div></div>`:d}
          </div>`})}</div>
        ${this.hardReadOnly||e.fields.length>=12?d:this.adding?r`<div class="rolechips" data-field-kinds>${Bs.map(s=>r`<button type="button" data-field-kind=${s} @click=${()=>{this.adding=!1,this.setFields(i=>i.push(ks(s,i.map(a=>a.key)))),this.openField=e.fields.length}}>${xs[s]}</button>`)}</div>`:r`<button class="addblk" type="button" data-add-field @click=${()=>this.adding=!0}>${f("plus")}הוסף שדה</button>`}
      </section>
      <section class="bsec2" data-section="action">
        <h4><span class="k then">${f("play",14)}</span>אז<small>${e.sequence.length?`${e.sequence.length} צעדים`:"מה לעשות"}</small></h4>
        ${this.renderList(Z,"sequence","action")}
      </section>
      ${this.renderOptionsBox(this.renderDeleteRow())}`}};qe.styles=[...$.styles,L`
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
        font-weight: 600;
      }
      .frow2 .nm small {
        font-size: var(--sw-fs-sm);
        font-weight: 500;
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
    `];Ut([u()],qe.prototype,"openField",2);Ut([u()],qe.prototype,"adding",2);qe=Ut([W("script-editor")],qe);var fo=Object.getOwnPropertyDescriptor,vo=(e,t,s,i)=>{for(var a=i>1?void 0:i?fo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};let It=class extends ${get kind(){return"scene"}get nameLabel(){return"שם הסצנה"}get codeToggle(){return!1}subtitleNew(){return"סצנה חדשה"}blankDraft(){return{name:"",icon:null,members:[]}}members(){return this.draft.members}setMembers(e){if(!this.draft)return;const t=F(this.draft);t.members=e(t.members),this.change(t)}applyPicked(e){const t=new Set(this.members().map(i=>i.entity_id)),s=e.filter(i=>!t.has(i));this.setMembers(i=>[...i.filter(a=>e.includes(a.entity_id)),...s.map(a=>({entity_id:a,state:Dt(a)[0].options?.[0].value??"on",attributes:{}}))]),s.length&&this.capture(s)}async capture(e){try{const t=await ie().capture({entity_ids:e});this.setMembers(s=>s.map(i=>t.members.find(a=>a.entity_id===i.entity_id)??i))}catch(t){this.saveError=$e(t)}}field(e,t){if(t.kind==="select")return r`<div class="fld"><label>${t.label}</label><select class="selx" data-fld=${`${e.entity_id}.${t.key}`} aria-label=${t.label} @change=${i=>this.setMembers(a=>a.map(n=>n.entity_id===e.entity_id?$s(n,t,i.target.value):n))}>
        ${(t.options?.some(i=>i.value===e.state)?t.options:[...t.options??[],{value:e.state,label:e.state}]).map(i=>r`<option value=${i.value} ?selected=${i.value===e.state}>${i.label}</option>`)}</select></div>`;const s=Gn(e,t);return r`<div class="fld"><label>${t.label}</label><label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${`${e.entity_id}.${t.key}`} aria-label=${t.label} .value=${s===null?"":String(s)}
      @change=${i=>{const a=i.target.value.trim().replace(",","."),n=a===""?null:Number(a),o=n===null||!Number.isFinite(n)?null:t.min!==void 0&&n<t.min?t.min:t.max!==void 0&&n>t.max?t.max:n;this.setMembers(l=>l.map(c=>c.entity_id===e.entity_id?$s(c,t,o):c))}} />${t.unit?r`<span class="u">${t.unit}</span>`:d}</label></div>`}row(e,t){const s=this.env.byId.get(e.entity_id),i=this.issues.some(n=>n.path===`members.${t}`),a=Dt(e.entity_id).filter(n=>n.key==="state"||!n.only||n.only==="on"&&e.state==="on").filter(n=>n.key==="state"||e.state!=="off");return r`<div class="mrow ${i?"bad":""}" data-member=${e.entity_id}>
      <div class="who"><span class="rg">${f(oe(e.entity_id))}</span><span class="nm">${this.env.ctx.names(e.entity_id)}<small>${[Yn[e.entity_id.split(".")[0]],s?.area?.name].filter(Boolean).join(" · ")}</small></span></div>
      <div class="vals">${a.map(n=>this.field(e,n))}</div>
      ${this.hardReadOnly?d:r`<button class="x" type="button" aria-label=${`הסרת ${this.env.ctx.names(e.entity_id)}`} data-member-remove=${e.entity_id} @click=${()=>this.setMembers(n=>n.filter(o=>o.entity_id!==e.entity_id))}>${f("close")}</button>`}
      <span class="sum">${ea(e)}</span>
    </div>`}renderBuilderBody(){const e=this.draft,t=this.env;return r`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="members">
        <h4><span class="k when">${f("light",14)}</span>מכשירים<small>${e.members.length?e.members.length:"בחרו מכשירים"}</small></h4>
        <div class="members">${e.members.length?e.members.map((s,i)=>this.row(s,i)):r`<div class="empty" data-members-empty>עדיין לא נבחרו מכשירים</div>`}</div>
        ${this.hardReadOnly?d:r`<div class="frow">
          <button class="btn" type="button" data-scene-add @click=${()=>{this.picker={uid:"scene",filter:{purpose:"target",controllable:!0,domains:[...ai]},selected:e.members.map(s=>s.entity_id),multi:!0,apply:s=>this.applyPicked(s)},this.pop=null}}>${f("plus")}הוסף מכשירים</button>
          <button class="btn" type="button" data-scene-capture ?disabled=${!e.members.length} @click=${()=>void this.capture(e.members.map(s=>s.entity_id))}>${f("camera")}צלם מצב נוכחי</button>
        </div>`}
      </section>
      ${t&&!this.isNew?this.renderDeleteRow():d}`}};It.styles=[...$.styles,L`
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
        font-weight: 600;
        min-inline-size: 0;
      }
      .mrow .nm small {
        font-size: var(--sw-fs-xs);
        font-weight: 500;
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
        font-weight: 600;
      }
    `];It=vo([W("scene-editor")],It);var mo=Object.defineProperty,bo=Object.getOwnPropertyDescriptor,ne=(e,t,s,i)=>{for(var a=i>1?void 0:i?bo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&mo(t,s,a),a};let ee=class extends K{constructor(){super(...arguments),this.bubbleSkin=new _e(this),this.href="",this.traceHref="",this.now=new Date,this.sensitiveWarning=!0,this.busy=!1,this.picked=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)}}connectedCallback(){super.connectedCallback(),ze(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e)}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}act(e){this.setMenu(!1),this.fire("action",{item:this.item,action:e})}menuItems(){const e=this.item,t=(s,i,a,n="",o=!0)=>o?r`<button type="button" role="menuitem" class=${n} data-card-action=${s} @click=${()=>this.act(s)}>${g(i)}${a}</button>`:d;return r`<div class="pop" role="menu" aria-label=${`פעולות · ${e.name}`}>
      ${t("edit","edit","עריכה","",e.can.edit)}
      ${t("run","play","הרץ עכשיו","",e.can.run)}
      ${t("dryrun","flask","בדיקה")}
      ${t("trace","help","למה זה רץ","",!!e.last_run)}
      ${t("versions","history","גרסאות","",e.source==="ui")}
      ${t("copy","copy","שכפול","",e.can.copy)}
      ${e.can.delete?r`<hr />`:d}
      ${t("delete","trash","מחיקה","dz",e.can.delete)}
    </div>`}render(){const e=this.item;if(!e)return d;const t=At(e,this.now),s=Nt(e,{sensitiveWarning:this.sensitiveWarning}),i=Rt(e),a=e.state==="on"||e.state==="running",n=e.can.toggle&&e.state!=="invalid"&&e.state!=="unavailable",o=e.can.edit||e.can.run||e.can.copy||e.can.delete||!!e.last_run||e.source==="ui";return r`<article class=${`acard ${a?"on":"off"}`} data-automation=${e.id} data-state=${e.state} aria-label=${e.name}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.href||"#"} data-card-open>${I(e.name)}</a></h3>
          <div class="where">${g("layers")}<b>${I(Lt(e))}</b>${i?r`<span class="ar">${I(i)}</span>`:d}</div>
        </div>
        <div class="ctl">
          ${n?r`<button type="button" class="tog" role="switch" aria-checked=${String(a)} aria-label=${`${a?"כיבוי":"הפעלה"} · ${e.name}`} data-card-toggle ?disabled=${this.busy} @click=${()=>this.fire("toggle",{item:e,enabled:!a})}></button>`:e.state==="invalid"||e.state==="unavailable"?d:r`<span class=${`chip ${a?"ok":""}`} data-card-state>${a?"פעילה":"כבויה"}</span>`}
          ${o?r`<button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`עוד · ${e.name}`} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${g("dots")}</button>`:d}
        </div>
        ${this.menu?this.menuItems():d}
      </header>
      ${e.sentence?r`<p class="sentence-line" data-card-sentence>${e.sentence}</p>`:d}
      <footer>
        <span class="run" data-card-run title=${t.title}><i class=${`dot ${t.tone==="none"?"":t.tone}`}></i>${t.text}</span>
        ${e.last_run&&this.traceHref?r`<a class="why" href=${this.traceHref} data-card-why>${g("help")}למה זה רץ</a>`:d}
      </footer>
      ${s.length?r`<div class="chips" data-card-chips>${s.map(l=>r`<span class=${`chip ${l.id==="sensitive"?"sens":l.tone==="bad"?"bad":l.tone==="warn"?"warn":l.tone==="info"?"info":""}`} data-chip=${l.id}>${g(l.id==="sensitive"?"shield":l.id==="locked"?"lock":l.id==="read_only"?"eye":l.id==="changed_outside"?"history":"warning")}${l.label}</span>`)}</div>`:d}
    </article>`}};ee.styles=[ke,...ve,L`
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
  `];ne([m({attribute:!1})],ee.prototype,"item",2);ne([m()],ee.prototype,"href",2);ne([m()],ee.prototype,"traceHref",2);ne([m({attribute:!1})],ee.prototype,"now",2);ne([m({type:Boolean})],ee.prototype,"sensitiveWarning",2);ne([m({type:Boolean})],ee.prototype,"busy",2);ne([m({type:Boolean,reflect:!0,attribute:"data-picked"})],ee.prototype,"picked",2);ne([u()],ee.prototype,"menu",2);ee=ne([W("automation-card")],ee);var go=Object.defineProperty,yo=Object.getOwnPropertyDescriptor,Ce=(e,t,s,i)=>{for(var a=i>1?void 0:i?yo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&go(t,s,a),a};let pe=class extends K{constructor(){super(...arguments),this.bubbleSkin=new _e(this),this.href="",this.now=new Date,this.busy=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)}}connectedCallback(){super.connectedCallback(),ze(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e)}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}act(e){this.setMenu(!1),this.fire("action",{item:this.item,action:e})}menuItems(){const e=this.item,t=(s,i,a,n="",o=!0)=>o?r`<button type="button" role="menuitem" class=${n} data-card-action=${s} @click=${()=>this.act(s)}>${g(i)}${a}</button>`:d;return r`<div class="pop" role="menu" aria-label=${`פעולות · ${e.name}`}>
      ${t("edit","edit","עריכה","",e.can.edit)}
      ${t("run","play","הרץ עכשיו","",e.can.run)}
      ${t("dryrun","flask","בדיקה")}
      ${t("trace","history","ריצות אחרונות","",!!e.last_run)}
      ${t("versions","history","גרסאות","",e.source==="ui")}
      ${t("copy","copy","שכפול","",e.can.copy)}
      ${e.can.delete?r`<hr />`:d}
      ${t("delete","trash","מחיקה","dz",e.can.delete)}
    </div>`}render(){const e=this.item;if(!e)return d;const t=At(e,this.now),s=Nt(e).find(l=>l.tone==="bad"),i=Rt(e),a=e.state==="on"||e.state==="running",n=e.can.toggle&&e.state!=="invalid"&&e.state!=="unavailable",o=e.can.edit||e.can.run||e.can.copy||e.can.delete||!!e.last_run||e.source==="ui";return r`<div class=${`ar ${a?"on":"off"}`} role="row" data-automation=${e.id} data-state=${e.state} aria-label=${e.name}>
      <span class="ctl" role="cell">${n?r`<button type="button" class="tog" role="switch" aria-checked=${String(a)} aria-label=${`${a?"כיבוי":"הפעלה"} · ${e.name}`} data-card-toggle ?disabled=${this.busy} @click=${()=>this.fire("toggle",{item:e,enabled:!a})}></button>`:d}</span>
      <span class="who" role="cell"><a class="name" href=${this.href||"#"} data-card-open>${I(e.name)}</a><span class="where"><b>${I(Lt(e))}</b>${i?r` · ${I(i)}`:d}</span></span>
      <span class="sent" role="cell" data-card-sentence title=${e.sentence}>${e.sentence?r`${g("bolt")}<span>${e.sentence}</span>`:d}</span>
      <span class=${`run${s||t.tone==="bad"?" bad":""}`} role="cell" data-card-run title=${s?s.label:t.title}>${s?r`${g("warning")}<span data-chip=${s.id}>${s.label}</span>`:r`<i class=${`dot ${t.tone==="none"?"":t.tone}`}></i>${t.text}`}</span>
      <span class="ops" role="cell">${o?r`<button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`עוד · ${e.name}`} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${g("dots")}</button>`:d}${this.menu?this.menuItems():d}</span>
    </div>`}};pe.styles=[ke,...ve,L`
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
  `];Ce([m({attribute:!1})],pe.prototype,"item",2);Ce([m()],pe.prototype,"href",2);Ce([m({attribute:!1})],pe.prototype,"now",2);Ce([m({type:Boolean})],pe.prototype,"busy",2);Ce([u()],pe.prototype,"menu",2);pe=Ce([W("automation-row")],pe);var wo=Object.defineProperty,$o=Object.getOwnPropertyDescriptor,G=(e,t,s,i)=>{for(var a=i>1?void 0:i?$o(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&wo(t,s,a),a};let q=class extends K{constructor(){super(...arguments),this.name="",this.members=[],this.entities=[],this.phase="idle",this.error="",this.isNew=!0,this.saving=!1,this.readOnly=!1,this.deletable=!1,this.draftName="",this.rows=[],this.picked=[],this.picker=!1,this.q="",this.onOutside=e=>{this.picker&&!e.composedPath().some(t=>t instanceof HTMLElement&&t.classList?.contains("pickwrap"))&&(this.picker=!1)}}willUpdate(e){e.has("members")&&(this.rows=this.members.map(t=>({entity_id:t.entity_id,state:t.state,attributes:{...t.attributes}})),this.picked=this.rows.map(t=>t.entity_id)),e.has("name")&&(this.draftName=this.name)}connectedCallback(){super.connectedCallback(),ze(this),window.addEventListener("pointerdown",this.onOutside,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0)}ent(e){return this.entities.find(t=>t.entity_id===e)}nameOf(e){return this.ent(e)?.name??e}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}addDevice(e){this.picked.includes(e)||(this.picked=[...this.picked,e],this.picker=!1,this.rows.length&&this.fire("capture",{entity_ids:[e],merge:!0}))}removeDevice(e){this.picked=this.picked.filter(t=>t!==e),this.rows=this.rows.filter(t=>t.entity_id!==e)}setRow(e,t){this.rows=this.rows.map(s=>s.entity_id===e?ga(s,t):s)}merge(e){const t=new Set(this.rows.map(s=>s.entity_id));this.rows=[...this.rows,...e.filter(s=>!t.has(s.entity_id)).map(s=>({entity_id:s.entity_id,state:s.state,attributes:{...s.attributes}}))]}capturable(){const e=Ys(this.entities,ta,{domains:ai,controllable:!0}),t=this.q.trim();return t?e.filter(s=>`${s.name} ${s.area?.name??""}`.includes(t)):e}picklist(){const e=Ks(this.capturable().filter(t=>!this.picked.includes(t.entity_id)));return r`<div class="pop" role="listbox" aria-label="בחירת מכשירים" data-scene-picker>
      <input class="inp srch" type="search" placeholder="חיפוש מכשיר" aria-label="חיפוש מכשיר" .value=${this.q} @input=${t=>this.q=t.target.value} />
      ${e.length?e.map(t=>t.areas.map(s=>r`<div class="gh">${I([t.floor?.name,s.area?.name].filter(Boolean).join(" · ")||"כל הבית")}</div>${s.entities.map(i=>r`<button type="button" role="option" data-pick=${i.entity_id} @click=${()=>this.addDevice(i.entity_id)}>${g(ht(i.entity_id))}${I(i.name)}</button>`)}`)):r`<div class="gh">אין עוד מכשירים</div>`}
    </div>`}stateCell(e){const t=ya[wa(e.entity_id)]??$a,s=t.some(i=>i.value===e.state)?t:[...t,{value:e.state,label:e.state}];return r`<select class="inp" aria-label=${`מצב · ${this.nameOf(e.entity_id)}`} data-row-state=${e.entity_id} ?disabled=${this.readOnly} @change=${i=>this.setRow(e.entity_id,{state:i.target.value})}>${s.map(i=>r`<option value=${i.value} ?selected=${i.value===e.state}>${i.label}</option>`)}</select>`}valuesCell(e){const t=xa(e);return t.length?r`<div class="vals">${t.map(s=>{const i=e.attributes[s.key],a=typeof i=="number"?s.toUi?s.toUi(i):i:"";return r`<label class="num"><small>${s.unit}</small><input type="number" inputmode="decimal" min=${s.min} max=${s.max} step=${s.step} .value=${String(a)} aria-label=${`${s.key} · ${this.nameOf(e.entity_id)}`} data-row-attr=${`${e.entity_id}:${s.key}`} ?disabled=${this.readOnly} @change=${n=>{const o=n.target.value;this.setRow(e.entity_id,{attr:{key:s.key,ui:o===""?null:Math.min(s.max,Math.max(s.min,Number(o)))}})}} /></label>`})}</div>`:r`<span class="none">—</span>`}table(){return r`<table data-scene-table>
      <thead><tr><th>מכשיר</th><th>מצב</th><th>ערכים שנלכדו</th><th></th></tr></thead>
      <tbody>${this.rows.map(e=>{const t=this.ent(e.entity_id);return r`<tr data-scene-row=${e.entity_id}>
          <td class="dev"><span class="ico">${g(ht(e.entity_id))}</span><span><b>${I(this.nameOf(e.entity_id))}</b><small>${I(t?.area?.name??t?.floor?.name??"")}</small></span></td>
          <td class="st">${this.stateCell(e)}</td>
          <td class="vl">${this.valuesCell(e)}</td>
          <td class="rm">${this.readOnly?d:r`<button type="button" class="x" aria-label=${`הסרה · ${this.nameOf(e.entity_id)}`} data-row-remove=${e.entity_id} @click=${()=>this.removeDevice(e.entity_id)}>${g("close")}</button>`}</td>
        </tr>`})}</tbody>
    </table>`}render(){const e=this.rows.length>0,t=!!this.draftName.trim()&&e&&!this.saving&&!this.readOnly;return r`
      <input class="nm" type="text" maxlength="120" .value=${this.draftName} placeholder="שם הסצנה" aria-label="שם הסצנה" data-scene-name ?disabled=${this.readOnly} @input=${s=>this.draftName=s.target.value} />
      <div class="devs">
        <h4>${g("layers")}מכשירים <span>${this.picked.length}</span></h4>
        <div class="chipsrow" data-scene-devices>
          ${this.picked.map(s=>r`<span class="dchip" data-device-chip=${s}>${g(ht(s))}<span>${I(this.nameOf(s))}${this.ent(s)?.area?r` <small>${I(this.ent(s).area.name)}</small>`:d}</span>${this.readOnly?d:r`<button type="button" aria-label=${`הסרה · ${this.nameOf(s)}`} @click=${()=>this.removeDevice(s)}>${g("close")}</button>`}</span>`)}
          ${this.readOnly?d:r`<span class="pickwrap"><button type="button" class="addchip" data-scene-add aria-haspopup="listbox" aria-expanded=${String(this.picker)} @click=${()=>this.picker=!this.picker}>${g("plus")}עוד</button>${this.picker?this.picklist():d}</span>`}
        </div>
      </div>
      ${this.phase==="done"?r`<div class="state-banner" role="status" data-scene-captured>${g("check")}נלכד<button type="button" class="btn sm" data-scene-recapture @click=${()=>this.fire("capture",{entity_ids:this.picked,merge:!1})}>צלם שוב</button></div>`:this.phase==="error"?r`<div class="state-banner bad" role="alert" data-scene-error>${g("warning")}${this.error||"הצילום נכשל"}<button type="button" class="btn sm" @click=${()=>this.fire("capture",{entity_ids:this.picked,merge:!1})}>נסו שוב</button></div>`:this.readOnly?d:r`<button type="button" class="btn primary capbtn" data-scene-capture ?disabled=${!this.picked.length||this.phase==="busy"} @click=${()=>this.fire("capture",{entity_ids:this.picked,merge:!1})}>${g("camera")}${this.phase==="busy"?"מצלם…":e?"צלם שוב":"צלם מצב נוכחי"}</button>`}
      ${e?this.table():d}
      ${this.readOnly?d:r`<div class="bar"><button type="button" class="btn primary" data-scene-save ?disabled=${!t} @click=${()=>this.fire("save",{name:this.draftName.trim(),members:this.rows})}>${g("check")}שמירה</button><button type="button" class="btn" data-scene-cancel @click=${()=>this.fire("cancel")}>ביטול</button>${this.deletable?r`<span class="grow"></span><button type="button" class="btn quiet dz" data-scene-delete @click=${()=>this.fire("delete")}>${g("trash")}מחיקה</button>`:d}</div>`}
    `}};q.styles=[...ve,L`
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
  `];G([m()],q.prototype,"name",2);G([m({attribute:!1})],q.prototype,"members",2);G([m({attribute:!1})],q.prototype,"entities",2);G([m()],q.prototype,"phase",2);G([m()],q.prototype,"error",2);G([m({type:Boolean})],q.prototype,"isNew",2);G([m({type:Boolean})],q.prototype,"saving",2);G([m({type:Boolean})],q.prototype,"readOnly",2);G([m({type:Boolean})],q.prototype,"deletable",2);G([u()],q.prototype,"draftName",2);G([u()],q.prototype,"rows",2);G([u()],q.prototype,"picked",2);G([u()],q.prototype,"picker",2);G([u()],q.prototype,"q",2);q=G([W("scene-capture")],q);var xo=Object.defineProperty,ko=Object.getOwnPropertyDescriptor,N=(e,t,s,i)=>{for(var a=i>1?void 0:i?ko(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&xo(t,s,a),a};let D=class extends K{constructor(){super(...arguments),this.bubbleSkin=new _e(this),this.items=[],this.hiddenItems=[],this.status=null,this.now=new Date,this.sceneId="",this.filtered=!1,this.done=new Set,this.busy=new Set,this.showHidden=!1,this.detail=null,this.entities=[],this.phase="idle",this.capError="",this.saving=!1,this.editorError="",this.conflict=!1,this.confirmDelete=!1,this.members=[],this.editorName="",this.loadedId="__none__"}connectedCallback(){super.connectedCallback(),ze(this)}willUpdate(e){e.has("sceneId")&&this.sceneId!==this.loadedId&&(this.loadedId=this.sceneId,this.conflict=!1,this.editorError="",this.phase="idle",this.confirmDelete=!1,this.sceneId?this.openEditor():this.detail=null)}fire(e,t){this.isConnected&&this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}say(e,t="ok",s){this.fire("result",{text:e,tone:t,action:s})}async activate(e){if(!this.busy.has(e.id)){this.busy=new Set([...this.busy,e.id]);try{await sa(e.id),this.done=new Set([...this.done,e.id]),window.setTimeout(()=>this.done=new Set([...this.done].filter(t=>t!==e.id)),2200),this.fire("changed",{id:e.id})}catch(t){this.say(j(t).message,"error")}finally{this.busy=new Set([...this.busy].filter(t=>t!==e.id))}}}async meta(e,t){try{await X().setMeta("scene",e.id,t),this.fire("changed",{id:e.id})}catch(s){this.say(j(s).message,"error")}}card(e,t=!1){const s=!ka(e),i=this.done.has(e.id),a=this.status?.counts.hidden!==null&&this.status?.counts.hidden!==void 0;return r`<article class=${`scard${t?" hid":""}`} data-scene=${e.id} data-scene-kind=${s?"native":"device"}>
      <div class="top">
        <span class=${`ico${s?" mine":""}`}>${g(s?"camera":"sparkle")}</span>
        ${s?r`<span class="badge mine" data-scene-badge>${g("edit")}ניתנת לעריכה</span>`:r`<span class="badge" data-scene-badge>הפעלה בלבד</span>`}
        <span style="flex:1"></span>
        ${a&&!s?r`<button type="button" class="eyeb" aria-label=${`${t?"הצגה":"הסתרה"} · ${e.name}`} title=${t?"הצגה":"הסתרה"} data-scene-hide @click=${()=>void this.meta(e,{hidden:!t})}>${g(t?"eye":"eyeOff")}</button>`:d}
        <button type="button" class="star" aria-pressed=${String(e.favourite)} aria-label=${`מועדף · ${e.name}`} title="מועדף" data-scene-fav @click=${()=>void this.meta(e,{favourite:!e.favourite})}>${g("star")}</button>
      </div>
      <h3>${I(e.name)}</h3>
      <div class="sub" data-scene-sub>${_a(e,this.now,void 0,s&&e.targets.length||void 0)}</div>
      <div class="acts">
        <button type="button" class=${`btn primary${i?" ok":""}`} data-scene-activate ?disabled=${this.busy.has(e.id)||t} @click=${()=>void this.activate(e)}>${i?g("check"):g("play")}${i?"הופעלה":"הפעל"}</button>
        ${s&&e.can.edit?r`<button type="button" class="btn" data-scene-edit @click=${()=>this.fire("open-scene",{id:e.id})}>${g("edit")}עריכה</button>`:d}
      </div>
    </article>`}async openEditor(){this.members=[],this.editorName="",this.detail=null;try{const e=await X().catalog();this.entities=e.entities}catch{this.entities=[]}if(this.sceneId!=="new")try{const e=await X().get("scene",this.sceneId);this.detail=e;const t=e.draft;this.members=t.members??[],this.editorName=t.name||e.name,this.entities.length||(this.entities=t.members.map(s=>({entity_id:s.entity_id,name:s.entity_id,domain:s.entity_id.split(".")[0],floor:null,area:null,class:null,state:null,missing:!1,triggers:[],actions:[]})))}catch(e){const t=j(e);this.say(t.message,"error"),this.fire("close-scene")}}async onCapture(e){const{entity_ids:t,merge:s}=e.detail;this.phase="busy",this.capError="";try{const i=await X().capture({entity_ids:t});s?(this.capture?.merge(i.members),this.phase="done"):(this.members=i.members,this.phase="done")}catch(i){this.capError=j(i).message,this.phase="error"}}async onSave(e){if(this.saving)return;this.saving=!0,this.editorError="";const t={name:e.detail.name,icon:this.detail?this.detail.draft.icon:null,members:e.detail.members};try{this.detail?await ei("scene",this.detail.id,t,this.detail.revision):await Qs("scene",t,{enabled:!0}),this.say("נשמר"),this.fire("changed",{}),this.fire("close-scene")}catch(s){const i=j(s);i.kind==="conflict"&&(this.conflict=!0),this.editorError=i.message}finally{this.saving=!1}}async doDelete(){const e=this.detail;if(e)try{const t=await ii("scene",e.id,e.revision,{confirm:!0});this.confirmDelete=!1,this.fire("changed",{}),this.fire("close-scene"),this.say(`"${e.name}" נמחקה`,"ok",{label:"שחזור",run:()=>void X().restoreTrash(t.trash_id,{client_request_id:`undo-${t.trash_id}`}).then(()=>this.fire("changed",{})).catch(s=>this.say(j(s).message,"error"))})}catch(t){this.confirmDelete=!1,this.editorError=j(t).message}}editor(){const e=!!this.sceneId,t=this.detail?I(this.detail.name):"סצנה חדשה";return r`<sw-drawer modal .open=${e} heading=${t} subheading=${this.detail?"ניתנת לעריכה":"סצנה חדשה"} @close=${()=>this.fire("close-scene")}>
      ${e?r`<div class="sheetbody">
        ${this.conflict?r`<div class="banner warn" role="alert">${g("warning")}<div><b>הסצנה שונתה במקום אחר</b></div><button type="button" class="btn sm" @click=${()=>{this.conflict=!1,this.openEditor()}}>טען מחדש</button></div>`:d}
        ${this.editorError&&!this.conflict?r`<div class="banner bad" role="alert">${g("warning")}${this.editorError}</div>`:d}
        <scene-capture .name=${this.editorName} .members=${this.members} .entities=${this.entities} .phase=${this.phase} .error=${this.capError} .saving=${this.saving} .deletable=${!!this.detail&&!!this.detail.can.delete} .readOnly=${!!this.detail&&!this.detail.can.edit}
          @capture=${s=>void this.onCapture(s)} @save=${s=>void this.onSave(s)} @cancel=${()=>this.fire("close-scene")} @delete=${()=>this.confirmDelete=!0}></scene-capture>
      </div>`:d}
      ${this.confirmDelete&&this.detail?r`<sw-dialog open heading=${`למחוק את "${this.detail.name}"?`} data-dialog="delete-scene" @close=${()=>this.confirmDelete=!1}><div class="dlgform"><p>הסצנה תישמר בסל המחזור וניתן לשחזר אותה.</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirmDelete=!1}>ביטול</button><button type="button" class="btn danger" data-dialog-ok @click=${()=>void this.doDelete()}>מחיקה</button></div></div></sw-dialog>`:d}
    </sw-drawer>`}render(){const e=za(this.items),t=this.hiddenItems.length?this.hiddenItems:ni(this.items);return r`<div class="groups" data-scenes-panel>
      ${e.map(s=>r`<section data-scene-group=${s.id}>
        <header class="sh"><div><h2>${I(s.title)}</h2>${s.sub?r`<small>${s.sub}</small>`:d}</div></header>
        <div class="grid">${s.items.map(i=>this.card(i))}</div>
      </section>`)}
      ${t.length&&this.status?.counts.hidden!==null?r`<section data-scene-group="hidden">
        <div class="hid-row"><button type="button" class="btn sm quiet" data-scene-hidden-toggle aria-expanded=${String(this.showHidden)} @click=${()=>this.showHidden=!this.showHidden}>${g("eyeOff")}מוסתרות <span>${t.length}</span></button></div>
        ${this.showHidden?r`<div class="grid" style="margin-block-start:12px">${t.map(s=>this.card(s,!0))}</div>`:d}
      </section>`:d}
    </div>
    ${this.editor()}`}};D.styles=[ke,...ve,L`
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
      font-weight: 700;
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
      font-weight: 700;
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
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `];N([m({attribute:!1})],D.prototype,"items",2);N([m({attribute:!1})],D.prototype,"hiddenItems",2);N([m({attribute:!1})],D.prototype,"status",2);N([m({attribute:!1})],D.prototype,"now",2);N([m()],D.prototype,"sceneId",2);N([m({type:Boolean})],D.prototype,"filtered",2);N([u()],D.prototype,"done",2);N([u()],D.prototype,"busy",2);N([u()],D.prototype,"showHidden",2);N([u()],D.prototype,"detail",2);N([u()],D.prototype,"entities",2);N([u()],D.prototype,"phase",2);N([u()],D.prototype,"capError",2);N([u()],D.prototype,"saving",2);N([u()],D.prototype,"editorError",2);N([u()],D.prototype,"conflict",2);N([u()],D.prototype,"confirmDelete",2);N([u()],D.prototype,"members",2);N([u()],D.prototype,"editorName",2);N([rt("scene-capture")],D.prototype,"capture",2);D=N([W("scenes-panel")],D);var _o=Object.defineProperty,zo=Object.getOwnPropertyDescriptor,re=(e,t,s,i)=>{for(var a=i>1?void 0:i?zo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&_o(t,s,a),a};let te=class extends K{constructor(){super(...arguments),this.bubbleSkin=new _e(this),this.items=[],this.status=null,this.now=new Date,this.withFields=new Set,this.hrefOf=()=>"#",this.sensitiveWarning=!0,this.busy=new Set,this.confirm=null}connectedCallback(){super.connectedCallback(),ze(this)}fire(e,t){this.isConnected&&this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}say(e,t="ok"){this.fire("result",{text:e,tone:t})}async run(e,t=!1){if(!this.busy.has(e.id)){if(this.withFields.has(e.id))return void this.fire("open-script",{id:e.id});if(!t&&Ot(e)){this.confirm=e;return}this.confirm=null,this.busy=new Set([...this.busy,e.id]);try{await ti(e.id,{},{confirm:t||void 0}),this.say("הסקריפט הופעל"),this.fire("changed",{id:e.id})}catch(s){const i=j(s);i.kind==="confirm"&&!t?this.confirm=e:this.say(i.message,"error")}finally{this.busy=new Set([...this.busy].filter(s=>s!==e.id))}}}async stop(e){if(!this.busy.has(e.id)){this.busy=new Set([...this.busy,e.id]);try{await ia(e.id),this.say("הסקריפט נעצר"),this.fire("changed",{id:e.id})}catch(t){this.say(j(t).message,"error")}finally{this.busy=new Set([...this.busy].filter(t=>t!==e.id))}}}card(e){const t=e.state==="running",s=At(e,this.now),i=Nt(e,{sensitiveWarning:this.sensitiveWarning}).filter(o=>o.id!=="read_only"),a=this.withFields.has(e.id),n=Rt(e);return r`<article class=${`pcard${t?" running":""}`} data-script=${e.id} data-state=${e.state}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.hrefOf(e.id)} data-script-open>${I(e.name)}</a>${t?r`<span class="chip live" data-script-running>${g("play")}רץ עכשיו</span>`:d}</h3>
          <div class="where">${g("layers")}<b>${I(Lt(e))}</b>${n?r`<span>${I(n)}</span>`:d}</div>
        </div>
        <div class="go">
          ${t&&e.can.run?r`<button type="button" class="btn danger" data-script-stop ?disabled=${this.busy.has(e.id)} @click=${()=>void this.stop(e)}>${g("stop")}עצור</button>`:e.can.run?r`<button type="button" class="btn primary" data-script-run ?disabled=${this.busy.has(e.id)} @click=${()=>void this.run(e)}>${g("play")}${a?"הפעל…":"הפעל"}</button>`:d}
        </div>
      </header>
      ${e.sentence?r`<p data-script-sentence>${e.sentence}</p>`:d}
      <footer>
        <span class="runl" data-script-runline><i class=${`dot ${s.tone==="none"?"":s.tone}`}></i>${s.text}</span>
        ${i.map(o=>r`<span class=${`chip ${o.id==="sensitive"?"sens":o.tone==="bad"?"bad":o.tone==="warn"?"warn":""}`} data-chip=${o.id}>${g(o.id==="sensitive"?"shield":o.id==="locked"?"lock":"warning")}${o.label}</span>`)}
      </footer>
    </article>`}render(){const e=this.confirm;return r`<div class="grid" data-scripts-panel>${this.items.map(t=>this.card(t))}</div>
      ${e?r`<sw-dialog open heading="להפעיל עכשיו?" data-dialog="run-script" @close=${()=>this.confirm=null}><div class="dlgform">${Qe(e)?r`<p>${Qe(e)}</p>`:d}<div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.run(e,!0)}>הפעל</button></div></div></sw-dialog>`:d}`}};te.styles=[ke,...ve,L`
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
      font-weight: 700;
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
      font-weight: 600;
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
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `];re([m({attribute:!1})],te.prototype,"items",2);re([m({attribute:!1})],te.prototype,"status",2);re([m({attribute:!1})],te.prototype,"now",2);re([m({attribute:!1})],te.prototype,"withFields",2);re([m({attribute:!1})],te.prototype,"hrefOf",2);re([m({type:Boolean})],te.prototype,"sensitiveWarning",2);re([u()],te.prototype,"busy",2);re([u()],te.prototype,"confirm",2);te=re([W("scripts-panel")],te);var So=Object.defineProperty,Oo=Object.getOwnPropertyDescriptor,R=(e,t,s,i)=>{for(var a=i>1?void 0:i?Oo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&So(t,s,a),a};const Eo={is_true:"כן",is_false:"לא",gt:">",ge:"≥",lt:"<",le:"≤",eq:"=",ne:"≠",between:"בין",outside:"מחוץ ל",in_set:"אחד מ"},Fs={TRUE:{mark:"✓",cls:"t"},FALSE:{mark:"✗",cls:"f"},UNKNOWN:{mark:"?",cls:"u"}},kt=()=>({when:{op:"and",items:[]},actions:[{type:"notify",to:{roles:[],users:[]}}],options:{}});let T=class extends K{constructor(){super(...arguments),this.bubbleSkin=new _e(this),this.status=null,this.scenarioId="",this.list=null,this.failed=!1,this.cat=null,this.choices=null,this.page=0,this.pageSize=6,this.editing=null,this.draft=kt(),this.name="",this.description="",this.dry=null,this.runs=[],this.sim=!1,this.simValues={},this.errors=[],this.busy=!1,this.dialog="",this.view="edit",this.loadedId="__none__"}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(()=>this.fit()),this.ro.observe(this),this.load()}disconnectedCallback(){this.ro?.disconnect(),super.disconnectedCallback()}fit(){const e=this.clientWidth||900,t=(this.clientHeight||520)-60,s=Math.max(1,Math.floor((e+12)/292)),i=Math.max(1,Math.floor((t+12)/130)),a=s*i;a!==this.pageSize&&(this.pageSize=a,this.page=0)}say(e,t="ok"){this.dispatchEvent(new CustomEvent("result",{detail:{text:e,tone:t},bubbles:!0,composed:!0}))}async load(){try{const[e,t]=await Promise.all([La(),this.cat?Promise.resolve(this.cat):Ba()]);this.list=e.scenarios,this.cat=t,this.failed=!1}catch{this.failed=!0}this.status?.can.manage&&!this.choices&&Fa().then(e=>this.choices=e).catch(()=>{})}updated(e){e.has("scenarioId")&&this.scenarioId!==this.loadedId&&this.openEditor(this.scenarioId)}async openEditor(e){if(this.loadedId=e,this.dry=null,this.errors=[],this.sim=!1,this.simValues={},this.view="edit",this.runs=[],!e){this.editing=null;return}if(e==="new"){this.editing={id:"",name:"",description:"",enabled:!1,version:0,state:"off"},this.name="",this.description="",this.draft=kt();return}try{const t=await ms(e);this.editing=t,this.name=t.name,this.description=t.description,this.draft=t.definition?structuredClone(t.definition):kt(),this.draft.options=this.draft.options??{}}catch{this.say(h("loadError"),"error"),this.close()}}close(){this.dispatchEvent(new CustomEvent("close-scenario",{bubbles:!0,composed:!0}))}open(e){this.dispatchEvent(new CustomEvent("open-scenario",{detail:{id:e},bubbles:!0,composed:!0}))}sig(e){return this.cat?.signals.find(t=>t.id===e)}setAt(e,t){const s=(a,n)=>{if(!n.length)return t(a);if(ft(a)){const o=a.items.map((l,c)=>c===n[0]?s(l,n.slice(1)):l).filter(l=>l!==null);return{...a,items:o}}if(vt(a)){const o=s(a.item,n.slice(1));return o===null?null:{...a,item:o}}return a},i=s(this.draft.when,e)??{op:"and",items:[]};this.draft={...this.draft,when:i},this.dry=null}addLeaf(e){const t=this.cat?.signals[0];t&&this.setAt(e,s=>ft(s)?{...s,items:[...s.items,bs(t)]}:s)}addGroup(e){this.setAt(e,t=>ft(t)?{...t,items:[...t.items,{op:t.op==="and"?"or":"and",items:[]}]}:t)}leafRow(e,t,s,i){const a=this.sig(e.signal),n=p=>this.setAt(t,v=>({...v,...p})),o=this.cat?.signals??[],l=[...new Set(o.map(p=>p.module_label))],c=p=>p===""?void 0:Number(p);return r`<div class="leaf" data-leaf=${s}>
      ${i?r`<span class=${`tri ${Fs[i.result].cls}`} title=${i.reason??""}>${Fs[i.result].mark}</span>`:d}
      <select aria-label=${h("signal")} @change=${p=>{const v=this.sig(p.target.value);v&&this.setAt(t,()=>bs(v))}}>
        ${l.map(p=>r`<optgroup label=${p}>${o.filter(v=>v.module_label===p).map(v=>r`<option value=${v.id} ?selected=${v.id===e.signal}>${v.label}</option>`)}</optgroup>`)}
      </select>
      ${a&&a.subject!=="none"&&a.subject!=="window"?a.subject==="flag"?r`<input aria-label=${h("flagName")} .value=${e.subject??""} pattern="[a-z][a-z0-9_]{1,39}" @change=${p=>n({subject:p.target.value.trim()})} />`:r`<select aria-label=${h("subject")} @change=${p=>n({subject:p.target.value})}>${a.subjects.map(p=>r`<option value=${p.id} ?selected=${p.id===e.subject}>${I(p.name)}</option>`)}</select>`:d}
      ${a?.subject==="window"&&e.window?this.windowEditor(e,n):d}
      ${a?r`<select aria-label="השוואה" @change=${p=>{const v=p.target.value;n({cmp:v,value:v==="between"||v==="outside"?[2,8]:v==="is_true"||v==="is_false"?void 0:typeof e.value=="number"?e.value:0})}}>
        ${ja(a.kind).map(p=>r`<option value=${p} ?selected=${p===e.cmp}>${Eo[p]}</option>`)}</select>`:d}
      ${a&&(a.kind==="number"||a.kind==="count")&&!Array.isArray(e.value)&&e.cmp!=="is_true"&&e.cmp!=="is_false"?r`<input type="number" aria-label=${h("value")} .value=${String(e.value??"")} step=${a.kind==="count"?"1":"0.1"} @change=${p=>n({value:Number(p.target.value)})} />${a.unit?r`<span class="hint">${a.unit}</span>`:d}`:d}
      ${Array.isArray(e.value)?r`<input type="number" class="sm" aria-label="מ" .value=${String(e.value[0])} @change=${p=>n({value:[Number(p.target.value),Number(e.value[1])]})} />–<input type="number" class="sm" aria-label="עד" .value=${String(e.value[1])} @change=${p=>n({value:[Number(e.value[0]),Number(p.target.value)]})} />`:d}
      <label class="hint">${h("holdFor")} <input type="number" class="sm" min="0" .value=${String(e.hold_s??"")} @change=${p=>n({hold_s:c(p.target.value)})} /></label>
      ${a?.kind==="bool"?r`<label class="hint">${h("debounce")} <input type="number" class="sm" min="0" .value=${String(e.debounce_s??"")} placeholder=${String(a.default_debounce_s)} @change=${p=>n({debounce_s:c(p.target.value)})} /></label>`:d}
      ${a&&(a.kind==="number"||a.kind==="count")&&["gt","ge","lt","le"].includes(e.cmp)?r`<label class="hint">${h("margin")} <input type="number" class="sm" min="0" step="0.1" .value=${String(e.hysteresis?.clear_margin??"")} placeholder=${String(a.default_margin)} @change=${p=>{const v=c(p.target.value);n({hysteresis:v===void 0?void 0:{clear_margin:v}})}} /></label>`:d}
      ${this.sim?r`<label class="hint">${h("simulateHint")} <input class="sm" data-sim=${s} .value=${this.simValues[s]??""} placeholder=${a?.kind==="bool"?"כן/לא":"—"} @change=${p=>this.simValues={...this.simValues,[s]:p.target.value}} /></label>`:d}
      <button type="button" class="btn sm" aria-label=${h("remove")} @click=${()=>this.setAt(t,()=>null)}>${g("close")}</button>
    </div>`}windowEditor(e,t){const s=e.window,i=h("dayNames").split(","),a=n=>{const o=s.days.includes(n)?s.days.filter(l=>l!==n):[...s.days,n].sort();o.length&&t({window:{...s,days:o}})};return r`<span class="days" role="group" aria-label=${h("days")}>${[6,0,1,2,3,4,5].map(n=>r`<button type="button" aria-pressed=${String(s.days.includes(n))} @click=${()=>a(n)}>${i[n]}</button>`)}</span>
      <input type="time" lang=${Le()} aria-label=${h("from")} .value=${s.from} @change=${n=>t({window:{...s,from:n.target.value}})} />
      <input type="time" lang=${Le()} aria-label=${h("to")} .value=${s.to} @change=${n=>t({window:{...s,to:n.target.value}})} />`}nodeView(e,t,s){const i=this.dry?.snapshot.find(n=>n.path===s);if(Ma(e))return r`<div class="red" data-redacted>${h("redacted")}</div>`;if(qa(e))return this.leafRow(e,t,s,i);if(vt(e))return r`<div class="grp"><div class="grp-h"><b>${h("not")}</b><button type="button" class="btn sm" @click=${()=>this.setAt(t,n=>vt(n)?n.item:n)}>${h("remove")}</button></div>${this.nodeView(e.item,[...t,0],`${s}.item`)}</div>`;const a=e;return r`<div class="grp" data-group=${s}>
      <div class="grp-h">
        <div class="seg sm" role="radiogroup" aria-label="חיבור">
          <button type="button" role="radio" aria-checked=${String(a.op==="and")} @click=${()=>this.setAt(t,n=>({...n,op:"and"}))}>${h("and")}</button>
          <button type="button" role="radio" aria-checked=${String(a.op==="or")} @click=${()=>this.setAt(t,n=>({...n,op:"or"}))}>${h("or")}</button>
        </div>
        <button type="button" class="btn sm" data-add-leaf @click=${()=>this.addLeaf(t)}>${g("plus")}${h("addCondition")}</button>
        ${t.length<3?r`<button type="button" class="btn sm" @click=${()=>this.addGroup(t)}>${g("plus")}${h("addGroup")}</button>`:d}
        ${t.length?r`<button type="button" class="btn sm" @click=${()=>this.setAt(t,()=>null)}>${h("remove")}</button>`:d}
      </div>
      ${a.items.map((n,o)=>this.nodeView(n,[...t,o],`${s}.items[${o}]`))}
    </div>`}actionRow(e,t){const s=a=>{const n=[...this.draft.actions];n[t]=a,this.draft={...this.draft,actions:n},this.dry=null},i=this.status&&!this.status.actions[e.type];return r`<div class="act" data-action=${e.type}>
      <select aria-label="פעולה" @change=${a=>{const n=a.target.value;s(n==="notify"?{type:"notify",to:{roles:[],users:[]}}:n==="set_flag"?{type:"set_flag",flag:"flag_1",value:!0}:{type:"create_service_request",department_id:""})}}>
        <option value="notify" ?selected=${e.type==="notify"}>${h("actNotify")}</option>
        ${this.cat?.tickets_on||e.type==="create_service_request"?r`<option value="create_service_request" ?selected=${e.type==="create_service_request"}>${h("actTicket")}</option>`:d}
        <option value="set_flag" ?selected=${e.type==="set_flag"}>${h("actFlag")}</option>
      </select>
      ${e.type==="notify"?r`<scenario-recipients data-notify-to .choices=${this.choices} .value=${{users:e.to?.users??[],roles:e.to?.roles??[]}}
        @change=${a=>s({...e,to:a.detail.value})}></scenario-recipients>`:d}
      ${e.type==="create_service_request"?r`<select aria-label=${h("department")} data-department @change=${a=>s({...e,department_id:a.target.value})}>
          <option value="" ?selected=${!e.department_id}>${h("departmentPick")}</option>
          ${(this.choices?.departments??[]).map(a=>r`<option value=${a.id} ?selected=${a.id===e.department_id}>${I(a.name)}</option>`)}
          ${e.department_id&&!(this.choices?.departments??[]).some(a=>a.id===e.department_id)?r`<option value=${e.department_id} selected>${e.department_id}</option>`:d}
        </select>
        <input aria-label=${h("ticketTitle")} placeholder=${h("ticketTitle")} .value=${e.title??""} @change=${a=>{const n=a.target.value.trim();s({...e,title:n||void 0})}} />
        ${this.cat&&!this.cat.tickets_on?r`<span class="err">${h("ticketsOff")}</span>`:d}`:d}
      ${e.type==="set_flag"?r`<input aria-label=${h("flagName")} .value=${e.flag} @change=${a=>s({...e,flag:a.target.value.trim()})} />
        <select aria-label=${h("flagValue")} @change=${a=>s({...e,value:a.target.value==="true"})}><option value="true" ?selected=${e.value}>כן</option><option value="false" ?selected=${!e.value}>לא</option></select>`:d}
      ${i?r`<span class="hint" data-action-off>${h("actionOff")}</span>`:d}
      <button type="button" class="btn sm" aria-label=${h("remove")} @click=${()=>{this.draft={...this.draft,actions:this.draft.actions.filter((a,n)=>n!==t)}}}>${g("close")}</button>
    </div>`}optionsView(){const e=this.draft.options??{},t=this.cat?.option_defaults,s=(a,n)=>{const o={...e};n===""?delete o[a]:o[a]=a==="on_unknown"?n:Number(n),this.draft={...this.draft,options:o},this.dry=null},i=(a,n)=>r`<label class="fld">${n}<input type="number" min="0" .value=${String(e[a]??"")} placeholder=${t&&a in t?String(t[a]):""} @change=${o=>s(a,o.target.value)} /></label>`;return r`<details><summary>${h("options")}</summary><div class="two">
      ${i("cooldown_s",h("cooldown"))}${i("clear_after_s",h("clearAfter"))}${i("for_s",h("forS"))}${i("unknown_grace_s",h("grace"))}
      <label class="fld">${h("onUnknown")}<select @change=${a=>s("on_unknown",a.target.value)}><option value="hold" ?selected=${e.on_unknown!=="treat_as_false"}>${h("onUnknownHold")}</option><option value="treat_as_false" ?selected=${e.on_unknown==="treat_as_false"}>${h("onUnknownFalse")}</option></select></label>
      ${i("max_fires_per_day",h("maxFires"))}${i("max_tickets_per_day",h("maxTickets"))}
    </div></details>`}overrides(){if(!this.sim)return;const e={};for(const[t,s]of Object.entries(this.simValues)){const i=s.trim();i&&(e[t]=i==="כן"||i==="true"?!0:i==="לא"||i==="false"?!1:i==="?"?null:Number(i))}return Object.keys(e).length?e:void 0}fail(e){if(e instanceof ts){const t=e.body.details??{};this.errors=t.errors??[],this.say(e.code==="version_conflict"?h("conflict"):e.code==="test_required"?h("testFirst"):e.message,"error")}else this.say(String(e),"error")}async runDry(){if(this.editing){this.busy=!0,this.errors=[];try{const e=!this.editing.id||this.dirty();this.dry=e?await Wa(this.draft,this.overrides()):await Ua(this.editing.id,this.overrides()),!e&&this.editing&&(this.editing={...this.editing,tested_version:!0})}catch(e){this.fail(e)}finally{this.busy=!1}}}dirty(){const e=this.editing;return!e||!e.definition||e.name!==this.name||e.description!==this.description||JSON.stringify(e.definition)!==JSON.stringify(this.draft)}async save(){if(!this.editing||!this.cat)return;const e=Va(this.draft,this.cat.limits);if(e.length){this.errors=e.map(t=>({path:"",message:t}));return}this.busy=!0;try{const t=this.editing.id?await Ha(this.editing.id,this.editing.version,this.name.trim(),this.description.trim(),this.draft):await Ga(this.name.trim(),this.description.trim(),this.draft);this.say(h("saved")),this.loadedId=t.id;const s=await ms(t.id);this.editing=s,this.draft=structuredClone(s.definition??this.draft),this.errors=[],this.load(),(!this.scenarioId||this.scenarioId==="new")&&this.open(t.id)}catch(t){this.fail(t)}finally{this.busy=!1}}async toggle(e,t,s=!1){this.busy=!0;try{const i=t?await Ya(e.id,e.version,s):await Ka(e.id,e.version);this.say(t?h("enabled"):h("disabledNote")),this.editing?.id===i.id&&(this.editing={...this.editing,...i}),this.dialog="",this.load()}catch(i){i instanceof ts&&i.code==="confirmation_required"?this.dialog="confirm-enable":this.fail(i)}finally{this.busy=!1}}async removeScenario(){if(this.editing?.id)try{await Ja(this.editing.id),this.say(h("deleted")),this.dialog="",this.load(),this.close()}catch(e){this.fail(e)}}async showRuns(){if(this.editing?.id){this.view="runs";try{this.runs=(await Xa(this.editing.id)).runs.slice(0,12)}catch(e){this.fail(e)}}}card(e){const t=Za(e.state),s={off:h("stateOff"),ok:h("stateOk"),active:h("stateActive"),degraded:h("stateDegraded"),suppressed:h("stateSuppressed")}[e.state];return r`<button type="button" class="card glass" data-scenario=${e.id} @click=${()=>this.open(e.id)}>
      <div class="row"><b>${I(e.name)}</b><span class="grow"></span><span class=${`st ${t}`} data-state=${e.state}>${s}</span></div>
      <div class="meta">${e.state_reason_text||(e.last_fire_at?h("lastFire",{t:new Date(e.last_fire_at).toLocaleString("he-IL",{dateStyle:"short",timeStyle:"short"})}):h("never"))}</div>
      <div class="row"><span class="mods">${e.modules.map(i=>r`<span class="chip">${i}</span>`)}</span><span class="grow"></span><span class="meta">${h("firesToday",{n:e.fires_today})}</span></div>
    </button>`}listView(){if(this.failed)return r`<div class="center" data-scen-state="error">${h("loadError")}<button type="button" class="btn sm" @click=${()=>void this.load()}>${h("retry")}</button></div>`;if(this.list===null)return r`<div class="center" aria-busy="true" data-scen-state="loading"></div>`;if(!this.list.length)return r`<div class="center" data-scen-state="empty">${g("bolt")}<b>${h("empty")}</b>${this.status?.can.manage?r`<button type="button" class="btn primary" data-scen-new-empty @click=${()=>this.open("new")}>${g("plus")}${h("new")}</button>`:d}<span class="hint">${h("doorWall")}</span></div>`;const e=Math.max(1,Math.ceil(this.list.length/this.pageSize)),t=Math.min(this.page,e-1),s=this.list.slice(t*this.pageSize,(t+1)*this.pageSize);return r`<div class="grid" data-scen-grid>${Ze(s,i=>i.id,i=>this.card(i))}</div>
      ${e>1?r`<div class="pager" data-scen-pager><button type="button" class="btn sm" ?disabled=${t===0} @click=${()=>this.page=t-1}>${h("prev")}</button>${h("page",{a:t+1,b:e})}<button type="button" class="btn sm" ?disabled=${t>=e-1} @click=${()=>this.page=t+1}>${h("next")}</button></div>`:d}`}dryView(){const e=this.dry;if(!e)return d;const t=e.result==="TRUE"?r`<b class="t">${h("wouldFire")}</b>`:e.result==="UNKNOWN"?r`<b class="u">${h("unknownResult")}</b>`:r`<b>${h("wouldNot")}</b>`;return r`<div class="dry" role="status" data-dry=${e.result}>${t}<span>${e.sentence}</span>
      ${e.actions.filter(s=>!s.switch_on).map(s=>r`<span class="hint">${s.type}: ${h("actionOff")}</span>`)}</div>`}runsView(){return this.runs.length?r`<div class="runs" data-scen-runs>${this.runs.map(e=>r`<div class="run"><div class="row"><b>${e.outcome}</b><span class="grow"></span><span class="meta">${new Date(e.at).toLocaleString("he-IL",{dateStyle:"short",timeStyle:"medium"})}</span></div>
      ${e.sentence?r`<span>${e.sentence}</span>`:d}${e.reason_text?r`<span class="hint">${e.reason_text}</span>`:d}
      ${e.actions.length?r`<span class="hint">${e.actions.map(t=>`${t.type}: ${t.status}${t.reason?` (${t.reason})`:""}`).join(" · ")}</span>`:d}</div>`)}</div>`:r`<div class="hint">${h("noRuns")}</div>`}editor(){const e=this.editing;if(!e)return d;const t=!!this.status?.can.manage&&!e.redacted_leaves?.length,s=Qa(this.draft.when),i=s.length>0&&s.every(a=>this.sig(a.leaf.signal)?.module==="doors");return r`<sw-drawer open modal heading=${e.id?e.name||h("title"):h("new")} data-scen-editor @close=${()=>this.close()}>
      <div class="ed">
        ${this.status?.kill_switch?r`<div class="kill" role="alert">${h("killOn")}</div>`:d}
        ${e.warnings?.map(a=>r`<div class="banner warn" role="status">${a.message}</div>`)}
        ${e.state_reason_text?r`<div class="banner bad" role="status" data-state-reason=${e.state_reason??""}>${e.state_reason_text}</div>`:d}
        <div class="seg sm" role="tablist"><button type="button" role="tab" aria-selected=${String(this.view==="edit")} @click=${()=>this.view="edit"}>${h("when")}</button>${e.id?r`<button type="button" role="tab" aria-selected=${String(this.view==="runs")} data-scen-runs-tab @click=${()=>void this.showRuns()}>${h("runs")}</button>`:d}</div>
        ${this.view==="runs"?this.runsView():r`
          <div class="two"><label class="fld">${h("name")}<input data-scen-name maxlength="120" .value=${this.name} ?disabled=${!t} @input=${a=>this.name=a.target.value} /></label>
            <label class="fld">${h("description")}<input maxlength="1000" .value=${this.description} ?disabled=${!t} @input=${a=>this.description=a.target.value} /></label></div>
          <div class="sect"><b>${h("when")}</b></div>
          <div class="tree">${this.nodeView(this.draft.when,[],"when")}</div>
          ${i?r`<div class="hint">${h("hintHaOnly")}</div>`:d}
          <div class="sect"><b>${h("then")}</b></div>
          ${this.draft.actions.map((a,n)=>this.actionRow(a,n))}
          ${this.draft.actions.length<(this.cat?.limits.actions??3)?r`<button type="button" class="btn sm" data-add-action @click=${()=>{this.draft={...this.draft,actions:[...this.draft.actions,{type:"set_flag",flag:"flag_1",value:!0}]}}}>${g("plus")}${h("then")}</button>`:d}
          <div class="hint">${h("doorWall")}</div>
          ${this.optionsView()}
          ${this.errors.length?r`<div class="err" role="alert" data-scen-errors>${this.errors.map(a=>r`<div>${a.path?`${a.path}: `:""}${a.message}</div>`)}</div>`:d}
          ${this.dryView()}`}
      </div>
      <div slot="footer" class="foot">
        ${t&&e.id?r`<button type="button" class="btn" data-scen-delete @click=${()=>this.dialog="delete"}>${h("delete")}</button>`:d}
        <span class="grow"></span>
        ${t?r`<label class="hint"><input type="checkbox" .checked=${this.sim} @change=${a=>this.sim=a.target.checked} />${h("simulate")}</label>
          <button type="button" class="btn" data-scen-test ?disabled=${this.busy} @click=${()=>void this.runDry()}>${h("test")}</button>
          <button type="button" class="btn primary" data-scen-save ?disabled=${this.busy||!this.name.trim()} @click=${()=>void this.save()}>${h("save")}</button>
          ${e.id?r`<button type="button" class="btn" data-scen-toggle ?disabled=${this.busy||!e.enabled&&this.dirty()} title=${!e.enabled&&!e.tested_version?h("testFirst"):""} @click=${()=>void this.toggle(e,!e.enabled)}>${e.enabled?h("disable"):h("enable")}</button>`:d}`:d}
      </div>
    </sw-drawer>`}dialogs(){const e=this.editing;if(this.dialog==="delete"&&e)return r`<sw-dialog open heading=${h("confirmDelete")} @close=${()=>this.dialog=""}><div class="foot"><button type="button" class="btn" @click=${()=>this.dialog=""}>${h("cancel")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.removeScenario()}>${h("delete")}</button></div></sw-dialog>`;if(this.dialog==="confirm-enable"&&e){const t=e.definition?.options?.max_tickets_per_day??20;return r`<sw-dialog open heading=${h("enable")} @close=${()=>this.dialog=""}><p>${h("enableConfirm",{n:t})}</p><div class="foot"><button type="button" class="btn" @click=${()=>this.dialog=""}>${h("cancel")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.toggle(e,!0,!0)}>${h("confirm")}</button></div></sw-dialog>`}return d}render(){return r`<div class="wrap" data-scenarios-panel>
      ${this.status?.kill_switch?r`<div class="kill" role="alert" data-scen-kill>${h("killOn")}</div>`:d}
      ${this.listView()}
    </div>${this.editor()}${this.dialogs()}`}};T.styles=[ke,...ve,L`
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
    .meta { color: var(--dv-text-2); font-size: var(--sw-fs-base); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .st { display: inline-flex; align-items: center; min-block-size: 26px; font-size: var(--sw-fs-sm); font-weight: 700; padding: 0 10px; border-radius: 999px; background: var(--dv-surface-3); color: var(--dv-text-2); white-space: nowrap; }
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
    .tri { inline-size: 22px; block-size: 22px; display: inline-grid; place-items: center; border-radius: 50%; font-size: var(--sw-fs-sm); font-weight: 700; }
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
  `];R([m({attribute:!1})],T.prototype,"status",2);R([m()],T.prototype,"scenarioId",2);R([u()],T.prototype,"list",2);R([u()],T.prototype,"failed",2);R([u()],T.prototype,"cat",2);R([u()],T.prototype,"choices",2);R([u()],T.prototype,"page",2);R([u()],T.prototype,"pageSize",2);R([u()],T.prototype,"editing",2);R([u()],T.prototype,"draft",2);R([u()],T.prototype,"name",2);R([u()],T.prototype,"description",2);R([u()],T.prototype,"dry",2);R([u()],T.prototype,"runs",2);R([u()],T.prototype,"sim",2);R([u()],T.prototype,"simValues",2);R([u()],T.prototype,"errors",2);R([u()],T.prototype,"busy",2);R([u()],T.prototype,"dialog",2);R([u()],T.prototype,"view",2);T=R([W("scenarios-panel")],T);var js=Object.freeze,yi=Object.defineProperty,Do=Object.getOwnPropertyDescriptor,S=(e,t,s,i)=>{for(var a=i>1?void 0:i?Do(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&yi(t,s,a),a},Ms=(e,t)=>js(yi(e,"raw",{value:js(e.slice())})),qs,Ws;const To="/devices/schedules",wi="sw.automations.view",Co=["rows","cards"],Us={rows:"rows",cards:"grid"},Ye={rows:()=>ba("rows"),cards:()=>"כרטיסים"},_t=e=>e==="rows"||e==="cards"?e:null;function Vs(){try{const e=localStorage.getItem(wi);if(!e)return null;try{return _t(JSON.parse(e))??_t(e)}catch{return _t(e)}}catch{return null}}function Io(e){try{localStorage.setItem(wi,JSON.stringify(e))}catch{}}let z=class extends K{constructor(){super(...arguments),this.bubbleSkin=new _e(this),this.kavarnit={schedules:!0,automations:!0},this.schedCount=null,this.scen=null,this.scenView=!1,this.scenId="",this.status=null,this.items=null,this.failed="",this.noPerm=!1,this.filters={...ds},this.route=cs(["devices","automations"],new URLSearchParams),this.compactHeader=!1,this.phone=window.matchMedia("(max-width: 767px)").matches,this.filtersOpen=!1,this.note=null,this.toggling=new Set,this.confirm=null,this.whenOpen=!1,this.drawerUsed=!1,this.fieldScripts=new Set,this.now=new Date,this.cardAction="",this.rawParams=new URLSearchParams,this.tplDraft=null,this.view=Vs()??aa,this.perPage={rows:ss.automations,cards:ss.automations_cards},this.page=1,this.fitRows=null,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offPush=null,this.offClock=null,this.offEdit=null,this.noteTimer=0,this.urlTimer=0,this.pushTimer=0,this.lastWritten="",this.fieldsFor="",this.onResize=()=>{this.fitRows=null,this.requestUpdate()},this.onScroll=()=>{const e=this.scrollTop>40;e!==this.compactHeader&&(this.compactHeader=e)},this.onResult=e=>this.say(e.detail.text,e.detail.tone,e.detail.action),this.onAction=e=>{const{item:t,action:s}=e.detail,i=Pe(t.kind).id;switch(s){case"edit":Y(ps(t.kind,t.id));break;case"trace":this.go(C(i,t.id),{view:"trace"});break;case"versions":this.go(C(i,t.id),{view:"versions"});break;case"dryrun":this.go(C(i,t.id),{view:"dryrun"});break;case"run":this.go(C(i,t.id),{do:"run"});break;case"copy":this.go(C(i,t.id),{do:"copy"});break;case"delete":this.go(C(i,t.id),{do:"delete"});break}},this.onDrawerClose=()=>{const e=this.route.trash?this.segment():this.route.segment;this.go(C(e))},this.onViewChange=e=>{const{view:t,run:s}=e.detail;this.go(C(this.route.segment,this.route.id),{view:t==="detail"?"":t,run:s})},this.onDeleted=e=>{const{trash_id:t,name:s}=e.detail;this.go(C(this.route.segment)),this.loadList(),this.refreshStatus(),this.say(`"${s}" נמחק`,"ok",{label:"שחזור",run:()=>void this.undoDelete(t,s)})},this.onCopied=e=>{this.loadList(),this.go(C(Pe(e.detail.item.kind).id,e.detail.item.id)),this.say("שוכפל")},this.onChanged=()=>{this.loadList(),this.refreshStatus()},this.onActionDone=()=>{if(!this.cardAction)return;const e=this.params();e.delete("do"),this.cardAction="",Ie(C(this.route.segment,this.route.id),e)},this.onEditorSaved=e=>{const{kind:t,id:s,status:i}=e.detail;this.loadList(),this.refreshStatus(),Ie(this.editorExit(t,i==="ok"?s:""),ge(this.filters)),this.say(i==="not_loaded"?"נשמר, אך עדיין לא נטען":"נשמר",i==="not_loaded"?"error":"ok")},this.onEditorCancel=(e,t)=>{Ie(this.editorExit(e,t),ge(this.filters))},this.onEditorDeleted=e=>{const{kind:t,id:s,trash_id:i}=e.detail,a=(this.items??[]).find(n=>n.kind===t&&n.id===s)?.name??"";Ie(C(Pe(t).id),ge(this.filters)),this.loadList(),this.refreshStatus(),this.say(a?`"${a}" נמחק`:"נמחק","ok",{label:"שחזור",run:()=>void this.undoDelete(i,a)})}}connectedCallback(){super.connectedCallback(),ze(this),this.phoneMq.addEventListener("change",this.onPhone),window.addEventListener("resize",this.onResize),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=na({id:"automations-trash",label:"סל מחזור",icon:"trash",can:()=>!!(this.status?.can.manage||this.status?.can.scene_manage||this.status?.can.script_manage),run:()=>is(hs())}),this.offRoute=ra(t=>this.onRoute(t));const e=Vs();oa().then(t=>{this.perPage={rows:t.pageSize.automations,cards:t.pageSize.automations_cards},e||(this.view=t.automationsView)}),this.load(),this.offClock=la(()=>this.now=pt()),Xe()&&(this.offPush=da(t=>{t.type==="automations_changed"&&(window.clearTimeout(this.pushTimer),this.pushTimer=window.setTimeout(()=>void this.refresh(),500))}))}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),window.removeEventListener("resize",this.onResize),this.removeEventListener("scroll",this.onScroll),this.offRoute?.(),this.offPush?.(),this.offClock?.(),this.offClock=null,this.offEdit?.(),window.clearTimeout(this.noteTimer),window.clearTimeout(this.urlTimer),window.clearTimeout(this.pushTimer)}updated(e){tn(this.renderRoot,this.phone),this.measureFit();const t=this.renderRoot.querySelector(".toast[popover]");if(t)try{t.matches(":popover-open")||t.showPopover()}catch{}e.has("status")&&this.status&&(this.setAttribute("data-phone-filter",this.status.ui.phone_filter==="rows"?"rows":"fold"),this.setAttribute("data-sens",this.status.ui.sensitive_chip==="red"?"red":"amber"))}measureFit(){const e=this.scenView?"":this.segment(),t=e==="scripts"?this.renderRoot.querySelector("scripts-panel"):null,s=e==="automations"?this.renderRoot.querySelector("[data-auto-grid]"):null,i=t?[t]:s?[...s.children].slice(0,2):[];i.length&&Promise.all(i.map(a=>a.updateComplete)).then(()=>{const a=t?t.shadowRoot?.querySelector("[data-scripts-panel]")??null:s;if(!a?.isConnected)return;const n=ca({host:this,list:a,itemSelector:t?":scope > *":":scope > automation-row, :scope > automation-card",pager:this.renderRoot.querySelector("[data-auto-pager]"),padded:[this.renderRoot.querySelector(".page")]});n!==null&&(this.fitRows===null||n<this.fitRows)&&(this.fitRows=n)})}onRoute(e){if(e.segments[0]!=="devices"||e.segments[1]!=="automations")return;const t=e.segments[2]==="scenarios";this.scenView=t,this.scenId=t?decodeURIComponent(e.segments[3]??""):"";const s=cs(t?["devices","automations"]:e.segments,e.params),i=e.params.toString();if(i!==this.lastWritten){const n=Sa(e.params);this.filters=n,this.lastWritten=i}this.route=s,this.rawParams=new URLSearchParams(e.params),this.cardAction=e.params.get("do")??"";const a=us(s,e.params);a?.template&&this.tplDraft?.id!==a.template&&this.loadTemplate(a.template),(s.id||s.trash)&&(this.drawerUsed=!0)}segment(){const e=this.status?as(this.status):[],t=ye(this.route.segment);return e.length&&!e.includes(t.kind)?Pe(e[0]).id:this.route.segment}extra(){const e=this.route;return{view:e.view==="detail"?"":e.view,run:e.run}}params(e=this.extra()){return ge(this.filters,e)}hrefOf(e,t,s={}){const i=ge(this.filters,s).toString();return`#${C(e,t)}${i?`?${i}`:""}`}go(e,t={}){const s=ge(this.filters,t);this.lastWritten=s.toString(),is(e,s)}syncUrl(e=0){window.clearTimeout(this.urlTimer),this.urlTimer=window.setTimeout(()=>{const t=this.params();this.lastWritten=t.toString(),Ie(this.route.trash?hs():C(this.route.segment,this.route.id),t)},e)}setFilter(e,t=0){this.filters={...this.filters,...e},this.page=1,this.syncUrl(t)}setSegment(e){e===this.segment()&&!this.route.id||(this.filters={...this.filters,state:"all",floor:""},this.page=1,this.fitRows=null,this.filtersOpen=!1,this.go(C(e)))}async loadScheduleCount(){try{this.schedCount=(await pa()).counts.visible}catch{this.schedCount=null}}async load(){if(!ua()){this.kavarnit.schedules&&this.loadScheduleCount(),Xe()&&en().then(e=>this.scen=e).catch(()=>this.scen=null),await Zs(),this.now=pt();try{this.status=await X().status()}catch(e){const t=j(e);t.status===403?this.noPerm=!0:this.failed=t.message;return}if(this.status.available==="feature_disabled"||this.status.available==="not_configured"){this.items=[];return}await this.loadList()}}async loadList(){try{const e=await X().list({limit:500});this.items=e.items,Et(this.status?.ui??null).precheck&&ha().then(t=>{this.items&&t.enabled&&(this.items=Oa(this.items,t.items))}).catch(()=>{}),this.failed="",this.now=pt(),this.loadFieldScripts()}catch(e){this.items===null?this.failed=j(e).message:this.say(j(e).message,"error")}}async loadFieldScripts(){const e=(this.items??[]).filter(i=>i.kind==="script"),t=e.map(i=>`${i.id}:${i.revision??""}`).join("|");if(!e.length||t===this.fieldsFor)return;this.fieldsFor=t;const s=new Set;await Promise.all(e.map(async i=>{try{(await X().get("script",i.id)).draft.fields?.some(n=>n.selector.kind!=="locked")&&s.add(i.id)}catch{}})),this.fieldScripts=s}async refresh(){try{this.status=await X().status(),this.status.available!=="feature_disabled"&&this.status.available!=="not_configured"&&await this.loadList()}catch{}await this.drawer?.refresh()}get drawer(){return this.renderRoot.querySelector("automation-drawer")}say(e,t="ok",s){window.clearTimeout(this.noteTimer),this.note={text:e,tone:t,action:s},this.noteTimer=window.setTimeout(()=>this.note=null,s?1e4:4e3)}patchItem(e){this.items=(this.items??[]).map(t=>t.kind===e.kind&&t.id===e.id?e:t)}async toggle(e,t,s=!1){if(!this.toggling.has(e.id)){if(t&&!s&&e.unknown_effects){this.confirm={item:e,op:"enable"};return}this.confirm=null,this.toggling=new Set([...this.toggling,e.id]);try{const i=await si(e.id,t,{confirm:s||void 0});this.patchItem(i.item),this.refreshStatus()}catch(i){fa(i)&&!s?this.confirm={item:e,op:"enable"}:this.say(j(i).message,"error"),await this.loadList()}finally{this.toggling=new Set([...this.toggling].filter(i=>i!==e.id))}}}async refreshStatus(){try{this.status=await X().status()}catch{}}newItem(){const e=this.segment();if(e==="scenes")return this.go(C("scenes","new"));if(e==="automations"&&this.status?.ui.ask_when_on_new){this.whenOpen=!0;return}const t=fs(ye(e).kind);Y(t.path,t.params)}async undoDelete(e,t){try{await X().restoreTrash(e,{client_request_id:`undo-${e}-${Date.now()}`}),this.say(`"${t}" שוחזר`),await this.loadList()}catch(s){this.say(j(s).message,"error")}}async loadTemplate(e){this.tplDraft={id:e,draft:null,done:!1};try{const{templates:t}=await X().templates(),s=t.find(i=>i.id===e);this.tplDraft?.id===e&&(this.tplDraft={id:e,draft:s?s.draft:null,done:!0})}catch{this.tplDraft?.id===e&&(this.tplDraft={id:e,draft:null,done:!0})}}editorExit(e,t){const s=Pe(e).id;return t&&e!=="scene"?C(s,t):C(s)}editorSheet(){const e=us(this.route,this.rawParams);if(!e)return d;if(e.template&&!(this.tplDraft?.id===e.template&&this.tplDraft.done))return d;const t=e.template?this.tplDraft?.draft??null:null,s=e.id?"edit":"create",i=()=>this.onEditorCancel(e.kind,e.id),a=()=>void this.loadList(),n=`${e.kind}:${e.id||"new"}:${e.template}`,o=Xe()?"":va().scheme??"";return e.kind==="script"?r`${ut(n,r(qs||(qs=Ms(['<script-editor data-auto-editor="script" .itemId='," .mode="," .scheme="," @saved="," @cancel="," @deleted="," @item-changed=","><\/script-editor>"])),e.id||null,s,o,this.onEditorSaved,i,this.onEditorDeleted,a))}`:e.kind==="scene"?r`${ut(n,r`<scene-editor data-auto-editor="scene" .itemId=${e.id||null} .mode=${s} .scheme=${o} @saved=${this.onEditorSaved} @cancel=${i} @deleted=${this.onEditorDeleted} @item-changed=${a}></scene-editor>`)}`:r`${ut(n,r`<automation-builder data-auto-editor="automation" .itemId=${e.id||null} .mode=${s} .scheme=${o} .draft0=${t} @saved=${this.onEditorSaved} @cancel=${i} @deleted=${this.onEditorDeleted} @item-changed=${a}></automation-builder>`)}`}segItems(e){const t=ye(e).kind;return(this.items??[]).filter(s=>s.kind===t&&!(t==="scene"&&s.hidden))}header(e){const t=ye(e),s=this.segItems(e),i=this.status?as(this.status):[],a=Ea(this.items??[]),n=Da(s),o=this.filters,l=Ta(s),c=vs(this.status,t.kind),p=Ca({...o}),v=this.items!==null&&!this.failed&&!this.noPerm&&!!this.status&&this.status.available!=="feature_disabled"&&this.status.available!=="not_configured",b=!!this.scen?.enabled&&this.scen.can.view,w=this.scenView,_=v&&!w&&t.kind==="automation"&&s.length>0;return r`<header class=${`dh${this.compactHeader?" compact":""}`} data-auto-header>
      <div class="dh-row">
        <h1 data-auto-title>${w?h("title"):t.label}</h1>
        ${v&&n.length&&!w?r`<div class="rooms" role="group" aria-label="קומות">
          <button type="button" class="rc" aria-pressed=${String(!o.floor)} data-floor="" @click=${()=>this.setFilter({floor:""})}>הכל</button>
          ${n.map(x=>r`<button type="button" class="rc" aria-pressed=${String(o.floor===x.id)} data-floor=${x.id} @click=${()=>this.setFilter({floor:x.id})}>${I(x.name)}</button>`)}
        </div>`:r`<span class="grow"></span>`}
        ${_&&!this.phone?r`<div class="vwrap">${this.viewSwitch()}</div>`:d}
      </div>
      ${v||w&&b?r`<div class="dh-det">
        ${i.length>1||b||this.kavarnit.schedules&&i.length?r`<div class="seg kinds" role="tablist" aria-label="סוג" @keydown=${ma}>${this.kavarnit.schedules?r`<button type="button" role="tab" aria-selected="false" data-segment="schedules" @click=${()=>Y(To)}>תזמונים${this.schedCount===null?d:r` <small>${this.schedCount}</small>`}</button>`:d}${Ia.filter(x=>i.includes(x.kind)).map(x=>r`<button type="button" role="tab" aria-selected=${String(e===x.id&&!w)} data-segment=${x.id} @click=${()=>w?Y(C(x.id)):this.setSegment(x.id)}>${x.label} <small>${a[x.kind]}</small></button>`)}${b?r`<button type="button" role="tab" aria-selected=${String(w)} data-segment="scenarios" @click=${()=>Y("/devices/automations/scenarios")}>${h("tab")}</button>`:d}</div>`:d}
        ${t.kind==="automation"&&s.length&&!w?r`<div class="seg sm stf" role="radiogroup" aria-label="סינון לפי מצב" ?data-open=${this.filtersOpen}>${Pa(Et(this.status?.ui??null).precheck).map(x=>r`<button type="button" role="radio" aria-checked=${String(o.state===x.id)} data-state-filter=${x.id} @click=${()=>this.setFilter({state:x.id})}>${x.label}<small>${l[x.id]}</small></button>`)}</div>`:d}
        ${t.kind==="automation"&&s.length&&!w?r`<button type="button" class="btn foldbtn" data-fold-toggle aria-expanded=${String(this.filtersOpen)} @click=${()=>this.filtersOpen=!this.filtersOpen}>${g("filter")}סינון${p?r` <small>${p}</small>`:d}</button>`:d}
        <span class="grow"></span>
        ${_&&this.phone?this.viewToggle():d}
        ${w?this.scen?.can.manage?r`<button type="button" class="btn primary newbtn" data-scen-new @click=${()=>Y("/devices/automations/scenarios/new")}>${g("plus")}${h("new")}</button>`:d:r`<label class="search">${g("search")}<span class="sr-only">חיפוש</span><input type="search" data-search placeholder=${this.phone?"חיפוש":t.searchLabel} .value=${o.q} @input=${x=>this.setFilter({q:x.target.value},250)} /></label>
        ${c.shown?r`<button type="button" class="btn primary newbtn" data-auto-new ?disabled=${c.disabled} title=${c.reason} @click=${()=>this.newItem()}>${g(e==="scenes"?"camera":"plus")}${t.newLabel}</button>`:d}`}
      </div>`:d}
    </header>`}viewSwitch(){return r`<div class="seg sm views" role="group" aria-label="תצוגה" data-auto-views>${Co.map(e=>r`<button type="button" data-view-btn=${e} aria-pressed=${String(this.view===e)} aria-label=${Ye[e]()} title=${Ye[e]()} @click=${()=>this.setView(e)}>${g(Us[e])}</button>`)}</div>`}viewToggle(){const e=this.view==="rows"?"cards":"rows";return r`<button type="button" class="btn vtog" data-auto-views data-view-btn=${e} aria-label=${Ye[e]()} title=${Ye[e]()} @click=${()=>this.setView(e)}>${g(Us[e])}</button>`}setView(e){e!==this.view&&(this.view=e,this.page=1,this.fitRows=null,Io(e))}skeleton(){const e=r`<span class="sr-only">טוען…</span>`;if(this.view==="rows"&&!this.scenView&&this.segment()==="automations"){const s=i=>r`<div class="skl-row"><span class="skl"></span><span class="skl" style=${`inline-size:${i}%`}></span><span class="skl" style="inline-size:80%"></span><span class="skl" style="inline-size:60%"></span></div>`;return r`<div data-auto-state="loading" aria-busy="true">${e}<div class="rlist glass skl-rows">${[62,48,70,55,40,66,52,45].slice(0,this.phone?6:8).map(s)}</div></div>`}const t=r`<div class="glass skl-card"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;return r`<div data-auto-state="loading" aria-busy="true">${e}<div class="cgrid">${Array.from({length:this.phone?3:6},()=>t)}</div></div>`}stateBox(e,t,s,i){return r`<div class="statebox glass" role="status" data-auto-state=${s}><span class="ring">${g(e)}</span><b>${t}</b>${i??d}</div>`}bannerRow(e){const t=Aa(this.status,ye(e).kind);return t.length?r`<div class="stack">${t.map(s=>r`<div class=${`banner ${s.tone}`} role=${s.tone==="bad"?"alert":"status"} data-auto-banner=${s.id}>${g(s.id==="offline"?"wifiOff":s.id==="delegation_off"||s.tone==="info"?"info":"warning")}<div>${s.title?r`<b>${s.title}</b><small>${s.text}</small>`:s.text}</div>${s.retry?r`<button type="button" class="btn sm" data-banner-retry @click=${()=>void this.refresh()}>${g("refresh")}נסו שוב</button>`:d}</div>`)}</div>`:d}body(e){const t=Na(this.status,{failed:!!this.failed,noPermission:this.noPerm,loading:this.items===null}),s=this.status?.can.configure?r`<a class="btn sm" href="#/system/automations" data-open-settings>הגדרות האוטומציות</a>`:void 0;if(t==="loading")return this.skeleton();if(t==="error")return this.stateBox("warning","לא ניתן לטעון את הרשימה","error",r`<button type="button" class="btn sm" data-auto-retry @click=${()=>{this.failed="",this.items=null,this.load()}}>${g("refresh")}נסו שוב</button>`);if(t==="no_permission")return this.stateBox("lock","אין הרשאה לצפות באוטומציות","no_permission");if(t==="feature_disabled")return this.stateBox("settings","האוטומציות כבויות","feature_disabled",s);if(t==="not_configured")return this.stateBox("settings","האוטומציות עדיין לא הוגדרו","not_configured",s);const i=ye(e),a=this.segItems(e),n=Ra(this.items??[],this.filters,i.kind).filter(c=>!(i.kind==="scene"&&c.hidden)),o=vs(this.status,i.kind);let l;if(!a.length)l=this.stateBox(e==="scenes"?"sparkle":e==="scripts"?"script":"bolt",e==="scenes"?"אין עדיין סצנות":e==="scripts"?"אין עדיין סקריפטים":"אין עדיין אוטומציות","empty",o.shown&&!o.disabled?r`<button type="button" class="btn primary" data-auto-new-empty @click=${()=>this.newItem()}>${g("plus")}${i.newLabel}</button>`:void 0);else if(!n.length)l=this.stateBox("search",e==="scenes"?"לא נמצאו סצנות":e==="scripts"?"לא נמצאו סקריפטים":"לא נמצאו אוטומציות","no-match",r`<button type="button" class="btn sm" data-clear-filters @click=${()=>{this.filters={...ds},this.syncUrl()}}>נקה סינון</button>`);else if(e==="scenes")l=r`<scenes-panel .items=${n} .hiddenItems=${ni(this.items??[])} .status=${this.status} .now=${this.now} .sceneId=${this.route.segment==="scenes"?this.route.id:""} @result=${this.onResult} @changed=${this.onChanged}
        @open-scene=${c=>this.go(C("scenes",c.detail.id))} @close-scene=${()=>this.go(C("scenes"))}></scenes-panel>`;else if(e==="scripts"){const c=ns(Math.max(1,n.length),this.fitRows),p=rs(n.length,c),v=os(this.page,n.length,c),b=ls(n,v,c),w=p>1?r`<div class="lfoot" data-auto-pager><sw-pager .page=${v} .pages=${p} @page-change=${_=>this.page=_.detail.page}></sw-pager></div>`:d;l=r(Ws||(Ws=Ms(['<div class="lwrap"><scripts-panel .items='," .status="," .now="," .withFields="," .sensitiveWarning="," .hrefOf=",`
        @result=`," @changed="," @open-script=","><\/scripts-panel>","</div>"])),b,this.status,this.now,this.fieldScripts,this.status?.ui.sensitive_warning!==!1,_=>this.hrefOf("scripts",_),this.onResult,this.onChanged,_=>this.go(C("scripts",_.detail.id)),w)}else{const c=this.view==="cards"?this.perPage.cards:this.perPage.rows,p=ns(this.phone?c.phone:c.wide,this.fitRows),v=rs(n.length,p),b=os(this.page,n.length,p),w=ls(n,b,p),_=A=>void this.toggle(A.detail.item,A.detail.enabled),x=this.view==="cards"?r`<div class="cgrid" data-auto-grid>${Ze(w,A=>A.id,A=>r`<automation-card .item=${A} .now=${this.now} .href=${this.hrefOf("automations",A.id)} .traceHref=${this.hrefOf("automations",A.id,{view:"trace"})}
            .sensitiveWarning=${this.status?.ui.sensitive_warning!==!1} .busy=${this.toggling.has(A.id)} @toggle=${_} @action=${this.onAction}></automation-card>`)}</div>`:r`<div class="rlist glass" role="table" aria-label=${i.label} data-auto-grid data-auto-rows>${Ze(w,A=>A.id,A=>r`<automation-row .item=${A} .now=${this.now} .href=${this.hrefOf("automations",A.id)} .busy=${this.toggling.has(A.id)} @toggle=${_} @action=${this.onAction}></automation-row>`)}</div>`;l=r`<div class="lwrap">${x}${v>1?r`<div class="lfoot" data-auto-pager><sw-pager .page=${b} .pages=${v} @page-change=${A=>this.page=A.detail.page}></sw-pager></div>`:d}</div>`}return r`${this.bannerRow(e)}${l}`}scenBody(){const e=this.scen;return e?e.enabled?e.can.view?r`<scenarios-panel .status=${e} .scenarioId=${this.scenId} @result=${this.onResult}
      @open-scenario=${t=>Y(`/devices/automations/scenarios/${encodeURIComponent(t.detail.id)}`)} @close-scenario=${()=>Y("/devices/automations/scenarios")}></scenarios-panel>`:this.stateBox("lock",h("noPermission"),"no_permission"):this.stateBox("settings",h("disabled"),"feature_disabled",e.can.admin?r`<a class="btn sm" href="#/system/automations" data-open-scen-settings>${h("settingsLink")}</a>`:void 0):this.skeleton()}dialogs(){if(this.confirm){const e=this.confirm;return r`<sw-dialog open heading="להפעיל?" data-dialog="enable" @close=${()=>this.confirm=null}><div class="dlgform">${Qe(e.item)?r`<p>${Qe(e.item)}</p>`:d}<div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.toggle(e.item,!0,!0)}>הפעל</button></div></div></sw-dialog>`}return this.whenOpen?r`<sw-dialog open heading="מתי?" data-dialog="when" @close=${()=>this.whenOpen=!1}><div class="when">
        <button type="button" class="btn" data-when="time" @click=${()=>{this.whenOpen=!1,Y("/devices/schedules/new/edit")}}>${g("calendar")}בשעות קבועות</button>
        <button type="button" class="btn" data-when="event" @click=${()=>{this.whenOpen=!1;const e=fs("automation");Y(e.path,e.params)}}>${g("bolt")}כשמשהו קורה</button></div></sw-dialog>`:d}render(){const e=this.segment(),t=this.route,s=t.segment==="scripts"?"script":"automation",i=(!!t.id&&t.id!=="new"&&t.segment!=="scenes"||t.trash)&&!t.edit;return r`<div class="page" data-screen="devices-automations" data-segment=${this.scenView?"scenarios":e}>
      ${this.header(e)}
      ${this.scenView?this.scenBody():this.body(e)}
    </div>
    ${this.drawerUsed||i?r`<automation-drawer .kind=${s} .itemId=${t.segment==="scenes"?"":t.id} .open=${i} .trash=${t.trash} .view=${t.view} .runId=${t.run} .status=${this.status} .now=${this.now} .action=${this.cardAction}
          @drawer-close=${this.onDrawerClose} @view-change=${this.onViewChange} @edit=${a=>Y(ps(a.detail.kind,a.detail.id))}
          @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult} @action-done=${this.onActionDone}></automation-drawer>`:d}
    ${this.editorSheet()}
    ${this.dialogs()}
    ${this.note?r`<div class=${`toast${this.note.tone==="error"?" bad":""}`} popover="manual" role="status" data-auto-note>${g(this.note.tone==="error"?"warning":"check")}${this.note.text}${this.note.action?r`<button type="button" class="btn sm" data-note-action @click=${()=>{const a=this.note?.action;this.note=null,a?.run()}}>${this.note.action.label}</button>`:d}</div>`:d}`}};z.styles=[ke,...ve,sn,L`
    /* FIX2200: the pager's keys meet the touch dial in the bubble skin (30x30 in the 2.20.0 bubble guard) */
    :host([data-skin='bubble']) sw-pager {
      --sw-ctl-h-md: var(--sw-touch-desktop);
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    /* the owner's setting automations.sensitive_chip: red instead of amber, for every chip below (custom properties inherit through the shadow roots) */
    :host([data-sens='red']) {
      --au-sens-bg: var(--dv-danger-soft);
      --au-sens-fg: var(--dv-danger);
    }
    .dh-det .seg.kinds button {
      padding-inline: 14px;
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
    .views button {
      padding-inline: 12px;
      min-inline-size: 40px;
    }
    .views .ic {
      font-size: var(--sw-fs-lg);
    }
    @media (pointer: coarse), (max-width: 1100px) {
      .views button {
        min-inline-size: 44px;
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
      .dh-det .seg.kinds {
        order: 1;
        inline-size: 100%;
      }
      .dh-det .seg.kinds button {
        flex: 1;
        padding-inline: 8px;
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
      .dh-det .stf {
        overflow-x: auto;
        scrollbar-width: none;
        justify-content: flex-start;
      }
      .dh-det .stf::-webkit-scrollbar {
        display: none;
      }
    }
  `];S([m({attribute:!1})],z.prototype,"kavarnit",2);S([u()],z.prototype,"schedCount",2);S([u()],z.prototype,"scen",2);S([u()],z.prototype,"scenView",2);S([u()],z.prototype,"scenId",2);S([u()],z.prototype,"status",2);S([u()],z.prototype,"items",2);S([u()],z.prototype,"failed",2);S([u()],z.prototype,"noPerm",2);S([u()],z.prototype,"filters",2);S([u()],z.prototype,"route",2);S([u()],z.prototype,"compactHeader",2);S([u()],z.prototype,"phone",2);S([u()],z.prototype,"filtersOpen",2);S([u()],z.prototype,"note",2);S([u()],z.prototype,"toggling",2);S([u()],z.prototype,"confirm",2);S([u()],z.prototype,"whenOpen",2);S([u()],z.prototype,"drawerUsed",2);S([u()],z.prototype,"fieldScripts",2);S([u()],z.prototype,"now",2);S([u()],z.prototype,"cardAction",2);S([u()],z.prototype,"rawParams",2);S([u()],z.prototype,"tplDraft",2);S([u()],z.prototype,"view",2);S([u()],z.prototype,"perPage",2);S([u()],z.prototype,"page",2);S([u()],z.prototype,"fitRows",2);z=S([W("devices-automations")],z);export{qo as BASE,z as DevicesAutomations};
//# sourceMappingURL=devices-automations-DP5T5XMD.js.map
