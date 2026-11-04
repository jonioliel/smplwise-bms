import{E as j,F as S,G as m,a as Z,dt as Ke,b_ as De,aj as ie,A as l,q as w,e as i,H as J,bq as je,i as D,l as V,du as ee,dv as fe,dw as Fe,dx as $e,dy as ye,dz as ke,R as X,cD as Ue,dA as We,dB as Ve,dC as Ye,dD as Qe,bS as M,dE as Te,dF as x,dG as me,dH as v,dI as be,dJ as Le,dK as q,aR as f,dL as ne,dM as ve,dN as ge,co as I,dO as R,dP as C,dQ as qe,bu as Ne,dR as Xe,dS as Ze,dT as Je,S as et,dU as tt,dV as xe,dW as _e,dX as F,dY as at,dZ as st,d_ as it,bs as nt,d$ as ot,J as rt,e0 as ze,av as lt,e1 as le,b$ as dt,e2 as ct,e3 as pt,j as Ae,e4 as ut,e5 as ht,e6 as vt,e7 as de,e8 as gt,e9 as ce,ea as Se,eb as mt,ec as Ce,ed as Ee,ee as te,ef as bt,eg as Oe,eh as wt,ei as pe,ej as Pe,ek as ft,el as Me,em as $t,en as ae,eo as yt,ep as kt,eq as xt}from"./index-Dspqd-4d.js";import"./sw-chip-BXHChhkH.js";import"./media-player-card-CUJS1pF8.js";import"./media-screen-card-huhI69ps.js";import"./media-group-dialog-DF_hc3bR.js";import"./explore-floor-map-CyCn658d.js";import"./sw-logo-art-Va6y_cIM.js";import"./media-now-QI8H_RRI.js";import"./multimedia-players-layout-CPiGinPM.js";import"./lead-reserve-DZMSEB5q.js";import"./demo-3d-Ca8bWAg-.js";import"./sw-plan-canvas-AclV1AqA.js";import"./shared-space-C7_HjtK1.js";import"./zones-Dztn3Pg_.js";import"./candidates-CS7-ly_Q.js";import"./views-CO1Y7wfT.js";import"./geometry-Yt0D5zt6.js";import"./state-facts-xyEdXEVZ.js";import"./plan-catalog-DZbR3QIF.js";import"./scene-builder-jMvw4ZO4.js";import"./material-resolve-vJCQoqhE.js";import"./quality-mode-Lw2uUGRc.js";import"./plan-change-key-xYId1QNj.js";import"./still-bake-ikWADTiq.js";import"./plan-view-1Gr8yJwr.js";import"./webgl-U1M5Oj-F.js";import"./quality-ladder-CXajLOl3.js";import"./wall-plan-mode-CWXgHhMr.js";import"./sun-D-xXkfn5.js";import"./part-select-CylWA6VC.js";import"./plan-studio-panel-wX2dJfaT.js";import"./connector-targets-Cw_oqhYV.js";import"./hud-layout-E9SCGK9C.js";import"./skins-DdjgPuml.js";import"./map-create-BQfMDLwG.js";var _t=Object.defineProperty,zt=Object.getOwnPropertyDescriptor,H=(t,e,s,a)=>{for(var n=a>1?void 0:a?zt(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(a?o(e,s,n):o(n))||n);return a&&n&&_t(e,s,n),n};function At(t,e){return t?t.floors.map(s=>{const a=s.areas.find(n=>n.name===e)??s.areas[0];return{id:s.floor_id,name:s.name||"ללא קומה",count:s.counts.entities,href:a?`/devices/areas/${encodeURIComponent(a.area_id)}`:void 0}}):[]}function St(t){return t.map(e=>({id:e.area_id,name:e.name,count:e.counts.entities,href:`/devices/areas/${encodeURIComponent(e.area_id)}`}))}let T=class extends Z{constructor(){super(...arguments),this.areaId="",this.areaName="",this.floorName="",this.areas=[],this.open="",this.tree=null,this.treeError=!1,this.phone=!1,this.mq=null,this.tabsMode=new Ke(this,"home"),this.onMq=()=>{this.phone=this.mq?.matches??!1},this.onOutside=t=>{this.open&&!t.composedPath().includes(this)&&(this.open="")}}connectedCallback(){super.connectedCallback();try{this.mq=window.matchMedia("(max-width: 599px)"),this.phone=this.mq.matches,this.mq.addEventListener("change",this.onMq)}catch{this.mq=null}document.addEventListener("pointerdown",this.onOutside,!0)}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),document.removeEventListener("pointerdown",this.onOutside,!0)}updated(){const t=this.tabsMode.ddSize;this.getAttribute("data-dd-size")!==t&&this.setAttribute("data-dd-size",t)}willUpdate(t){t.has("areaId")&&(this.open="");const e=this.phone&&document.documentElement.getAttribute("data-dd-phone")==="sheet";this.toggleAttribute("data-sheet",e)}async ensureTree(){if(!(this.tree||this.treeError))try{this.tree=await De()}catch{this.treeError=!0}}toggle(t,e=!1){const s=this.open!==t;this.open=s?t:"",s&&(t==="floor"&&this.ensureTree(),this.updateComplete.then(()=>e?this.focusOption(0):void 0))}options(t){return t==="floor"?At(this.tree,this.areaName):St(this.areas)}isCurrent(t,e){return t==="area"?e.id===this.areaId:e.name===(this.floorName||"ללא קומה")}optionButtons(){return[...this.renderRoot.querySelectorAll(".menu .opt:not(:disabled)")??[]]}focusOption(t){const e=this.optionButtons();if(!e.length)return;const s=e.findIndex(a=>a.getAttribute("aria-checked")==="true");(t<0?e[e.length-1]:e[t===0&&s>=0?s:Math.min(t,e.length-1)]).focus()}onTriggerKey(t,e){t.key==="ArrowDown"||t.key==="ArrowUp"?(t.preventDefault(),this.open!==e?this.toggle(e,!0):this.focusOption(0)):t.key==="Escape"&&this.open&&(this.open="")}onMenuKey(t,e){const s=this.optionButtons(),a=s.indexOf(this.renderRoot.querySelector(".menu .opt:focus")??document.activeElement),n=r=>{t.preventDefault(),s[(r+s.length)%s.length]?.focus()};t.key==="ArrowDown"?n(a+1):t.key==="ArrowUp"?n(a<0?-1:a-1):t.key==="Home"?n(0):t.key==="End"?n(-1):t.key==="Escape"?(t.preventDefault(),t.stopPropagation(),this.open="",this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-crumb="${e}"]`)?.focus())):t.key==="Tab"&&(this.open="")}choose(t){t.href&&(this.open="",ie(t.href))}renderMenu(t){if(this.open!==t)return l;const e=this.options(t),s=t==="floor"?"קומות":"אזורים בקומה",a=e.length?e.map(n=>i`<button type="button" role="menuitemradio" class="opt" data-nav-option=${n.id} data-count=${n.count} aria-checked=${String(this.isCurrent(t,n))} ?disabled=${!n.href} @click=${()=>this.choose(n)}>
            <span>${w(n.name)}</span><span class="n">${n.count}</span>
          </button>`):i`<div class="note">${t==="floor"&&!this.treeError?"טוען קומות…":t==="floor"?"לא ניתן לטעון את הקומות":"אין אזורים"}</div>`;return i`${this.hasAttribute("data-sheet")?i`<div class="back" @click=${()=>this.open=""}></div>`:l}
      <div class="menu" role="menu" aria-label=${s} data-nav-menu=${t} @keydown=${n=>this.onMenuKey(n,t)}>${a}</div>`}pick(t,e,s,a){const n=t==="area"?i`<h1 class="val">${w(s)}</h1>`:i`<span class="val">${w(s)}</span>`;return i`<span class="wrap">
      <button type="button" class="pick" data-crumb=${t} aria-haspopup="menu" aria-expanded=${String(this.open===t)} aria-current=${t==="area"?"location":l} aria-label=${`${e}: ${s}`} @click=${()=>this.toggle(t)} @keydown=${r=>this.onTriggerKey(r,t)}>
        <sw-icon .name=${a} size=${16}></sw-icon>
        <span class="pt"><span class="cap" aria-hidden="true">${e}</span>${n}</span>
        <sw-icon class="chev" name="chevronDown" size=${14}></sw-icon>
      </button>${this.renderMenu(t)}
    </span>`}render(){const t=this.floorName||"ללא קומה",e=i`<span class="sep" aria-hidden="true"><sw-icon name="chevron" size=${11}></sw-icon></span>`,s=this.areaId!=="unassigned";return i`<nav aria-label="ניווט: קומה ואזור">
        <a class="crumb" data-crumb="home" href="#/devices/building" @click=${a=>{a.preventDefault(),ie("/devices/building")}}>${this.phone?i`<sw-icon name="home" size=${16}></sw-icon>`:l}<span>חשמל והתקנים</span></a>
        ${e}
        <div class="picks" data-nav-picks>${this.pick("floor","קומה",t,"floor")}${s?this.pick("area","אזור",this.areaName,"door"):l}</div>
      </nav>`}};T.styles=j`
    :host {
      display: block;
      margin-block-end: 4px;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    nav {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
    }
    .sep {
      color: var(--sw-border-strong);
      display: inline-flex;
    }
    .wrap {
      position: relative;
      display: inline-flex;
    }
    .crumb {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 30px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      cursor: pointer;
      text-decoration: none;
    }
    .crumb:hover,
    .crumb[aria-expanded='true'] {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .crumb:focus-visible,
    .opt:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -1px;
    }
    .crumb[aria-current] {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* the two pickers (owner 2026-10-10): a field-like control - the level's caption over its value, a chevron at the end */
    .picks {
      display: flex;
      align-items: stretch;
      gap: 8px;
      flex-wrap: wrap;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .picks .wrap {
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .pick {
      display: inline-grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 8px;
      box-sizing: border-box;
      min-inline-size: 150px;
      max-inline-size: 100%;
      min-block-size: var(--pick-h, 44px);
      padding: 4px 10px 4px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    :host([data-dd-size='sm']) {
      --pick-h: 36px;
    }
    :host([data-dd-size='lg']) {
      --pick-h: 52px;
    }
    .pick > sw-icon:first-child {
      color: var(--sw-text-3);
    }
    .pick .chev {
      color: var(--sw-text-2);
    }
    .pick .pt {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.15;
    }
    .pick .cap {
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
    }
    .pick .val {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
      letter-spacing: normal;
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pick[data-crumb='area'] .val {
      font-size: var(--sw-fs-xl);
    }
    .pick:hover {
      border-color: var(--sw-text-3);
      background: var(--sw-surface-2);
    }
    .pick[aria-expanded='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .pick:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (prefers-reduced-motion: no-preference) {
      .pick {
        transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
      }
      .pick .chev {
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
    }
    .pick[aria-expanded='true'] .chev {
      transform: rotate(180deg);
    }
    .menu {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline-start: 0;
      z-index: var(--sw-z-modal);
      min-inline-size: 200px;
      max-block-size: min(60vh, 420px);
      overflow: auto;
      padding: 4px;
      /* the picker's list (a popover, a bottom sheet on a phone) is a menu: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
    }
    .opt {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      inline-size: 100%;
      min-block-size: 34px;
      padding: 0 10px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .opt:hover:not(:disabled) {
      background: var(--sw-surface-3);
    }
    .opt[aria-checked='true'] {
      background: var(--sw-accent-soft, var(--sw-surface-3));
      color: var(--sw-accent);
      font-weight: var(--sw-fw-semibold);
    }
    .opt:disabled {
      color: var(--sw-text-3);
      cursor: default;
    }
    .opt .n {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      flex: none;
    }
    .opt > span:not(.n) {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    @media (min-width: 600px) {
      .menu {
        max-inline-size: 480px;
      }
    }
    .note {
      padding: 8px 10px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .back {
      position: fixed;
      inset: 0;
      z-index: calc(var(--sw-z-modal) - 1);
      background: var(--sw-overlay);
    }
    @media (max-width: 599px) {
      .crumb {
        min-block-size: 44px;
        padding: 0 10px;
      }
      /* a phone: the two pickers take the next line, side by side; a long area name gets the whole line */
      .picks {
        flex: 1 1 100%;
      }
      .picks .wrap {
        flex: 1 1 calc(50% - 4px);
        display: flex;
      }
      .pick {
        flex: 1 1 auto;
        inline-size: 100%;
        min-inline-size: 0;
        min-block-size: max(var(--pick-h, 44px), 44px);
      }
      .opt {
        min-block-size: 48px;
      }
      /* the owner's phone choice (data-dd-phone, DDAREA-295): "sheet" = the bottom sheet; "list" keeps the popover under the picker, the area's list
         hanging from the picker's far edge so it stays inside the screen */
      :host([data-sheet]) .menu {
        position: fixed;
        inset-inline: 0;
        inset-block: auto 0;
        max-block-size: 65vh;
        border-radius: var(--sw-r-lg) var(--sw-r-lg) 0 0;
        padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
      }
      :host(:not([data-sheet])) .menu[data-nav-menu='area'] {
        inset-inline-start: auto;
        inset-inline-end: 0;
      }
      :host(:not([data-sheet])) .menu {
        max-inline-size: calc(100vw - 16px);
      }
    }
  `;H([S()],T.prototype,"areaId",2);H([S()],T.prototype,"areaName",2);H([S()],T.prototype,"floorName",2);H([S({attribute:!1})],T.prototype,"areas",2);H([m()],T.prototype,"open",2);H([m()],T.prototype,"tree",2);H([m()],T.prototype,"treeError",2);H([m()],T.prototype,"phone",2);T=H([J("devices-area-nav")],T);var Ct=Object.defineProperty,Et=Object.getOwnPropertyDescriptor,E=(t,e,s,a)=>{for(var n=a>1?void 0:a?Et(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(a?o(e,s,n):o(n))||n);return a&&n&&Ct(e,s,n),n};const ue={already_off:"כבוי כבר",not_confirmed:"מצב לא מאושר",unavailable:"לא זמין",not_allowed:"אין הרשאה"};let A=class extends Z{constructor(){super(...arguments),this.areaId="",this.areaName="",this.entityIds=null,this.external=!1,this.devices=null,this.speakers=null,this.canBulk=!1,this.remoteKey="",this.remoteKind="",this.remoteOpen=!1,this.phase="closed",this.preview=null,this.record=null,this.outcomes=[],this.error="",this.timer=0,this.token=0,this.stop={stopped:!1},this.openRemote=(t,e="")=>{this.remoteKey=t,this.remoteKind=e||this.kindOf(t),this.remoteOpen=!0},this.onOpenRemote=t=>{const s=t.detail?.key??t.target.device?.key??"";s&&this.openRemote(s)},this.close=()=>{this.phase!=="sending"&&(this.phase="closed",this.preview=null,this.record=null,this.outcomes=[],this.error="")}}connectedCallback(){super.connectedCallback(),this.load(),this.timer=window.setInterval(()=>{document.visibilityState==="visible"&&this.phase==="closed"&&this.load()},8e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer),this.stop.stopped=!0}updated(t){t.has("areaId")&&t.get("areaId")!==void 0&&this.load()}allowed(){return!D()||V("media.read")}async load(){if(!this.areaId||!this.allowed())return this.setDevices([],[]);const t=++this.token;try{if(!(await ee().status()).enabled)return t===this.token?this.setDevices([],[]):void 0;const{devices:s}=await ee().list({area:this.areaId}),a=this.areaId,n=await fe().list({area:a}).then(u=>u.devices.filter(p=>p.area_id===a&&["speaker","player","receiver"].includes(p.kind)&&Fe.includes(p.kind))).catch(()=>[]),r=n.length>0&&await fe().status().then(u=>u.can.bulk).catch(()=>!1);if(t!==this.token)return;this.canBulk=r;const o=s.filter(u=>u.kind==="screen"),d=this.entityIds,c=d?.length?o.filter(u=>(u.entity_ids??[]).some(p=>d.includes(p))):[];this.setDevices(d?.length&&c.length?c:o,n)}catch{t===this.token&&!this.devices&&this.setDevices([],[])}}setDevices(t,e){this.devices=t,this.speakers=e,this.dispatchEvent(new CustomEvent("media-area-state",{detail:{screens:t.length,players:e.length,playing:e.filter(ke).length,on:t.filter(s=>ye(s.live)).length,canOff:$e(t).length>0},bubbles:!0,composed:!0}))}kindOf(t){return this.speakers?.find(e=>e.key===t)?.kind??"screen"}async ask(){this.phase="loading",this.error="";try{this.preview=await ee().bulkPreview("area",this.areaId),this.phase="ask",this.updateComplete.then(()=>requestAnimationFrame(()=>this.renderRoot.querySelector("[data-mac-cancel]")?.focus()))}catch(t){this.error=X(t),this.phase="error"}}async run(){const t=this.preview;if(t){this.phase="sending",this.stop={stopped:!1};try{const e=await ee().bulkRun("area",this.areaId,Ue(),new Date(Date.now()+15e3).toISOString());if(D()){const s=await We(await Ve(e.bulk_id),a=>this.record=a,this.stop);this.record=s,this.outcomes=s.items.map(a=>({name:a.name,text:Ye[a.outcome]}))}else{await this.load();const s=new Map((this.devices??[]).map(a=>[a.key,a]));this.outcomes=t.devices.map(a=>({name:a.name,text:a.will==="off"?s.get(a.key)&&!ye(s.get(a.key).live)?"אושר":"לא אושר":`דולג · ${ue[a.reason??""]??""}`}))}this.phase="done",this.load()}catch(e){this.error=X(e),this.phase="error"}}}dialog(){if(this.phase==="closed"||this.phase==="loading")return l;const t=this.preview,e=t?.counts.send??0,s=this.areaName?`ב${w(this.areaName)}`:"באזור";if(this.phase==="error")return i`<sw-dialog open heading="הפעולה לא בוצעה" data-mac-dialog="error" @close=${this.close}><div class="err" role="alert">${this.error}</div>
        <sw-button slot="footer" @click=${this.close}>סגור</sw-button></sw-dialog>`;if(this.phase==="done"||this.phase==="sending"){const a=this.record?Qe(this.record).text:this.phase==="sending"?"שולח…":this.outcomes.every(n=>n.text==="אושר"||n.text.startsWith("דולג"))?"בוצע":"בוצע חלקית";return i`<sw-dialog open ?locked=${this.phase==="sending"} heading=${e===1?`כיבוי מסך ${s}`:`כיבוי מסכים ${s}`} data-mac-dialog=${this.phase} @close=${this.close}>
        <div class="res"><b data-mac-headline>${a}</b><ul>${this.outcomes.map(n=>i`<li>${w(n.name)} · ${n.text}</li>`)}</ul></div>
        <sw-button slot="footer" variant="primary" ?disabled=${this.phase==="sending"} @click=${this.close}>סגור</sw-button></sw-dialog>`}return!t||e===0?i`<sw-dialog open heading=${`אין מסך דולק ${s}`} data-mac-dialog="none" @close=${this.close}>
        <details><summary>פרטים</summary><ul>${(t?.devices??[]).map(a=>i`<li>${w(a.name)} · ${ue[a.reason??""]??""}</li>`)}</ul></details>
        <sw-button slot="footer" @click=${this.close}>סגור</sw-button></sw-dialog>`:i`<sw-dialog open heading=${e===1?`לכבות מסך אחד ${s}?`:`לכבות ${e} מסכים ${s}?`} data-mac-dialog="ask" @close=${this.close}>
      <details data-mac-details><summary>פרטים</summary><ul>${t.devices.map(a=>i`<li>${w(a.name)} · ${a.will==="off"?"יכובה":`לא יכובה · ${ue[a.reason??""]??""}`}</li>`)}</ul></details>
      <sw-button slot="footer" data-mac-cancel @click=${this.close}>ביטול</sw-button>
      <sw-button slot="footer" variant="danger" icon="power" data-mac-confirm @click=${()=>void this.run()}>כבה</sw-button></sw-dialog>`}render(){const t=this.devices??[],e=this.speakers??[];if(!t.length&&!e.length)return l;const s=$e(t).length>0,n=this.canBulk&&e.some(ke)?i`<button type="button" class="off-all quiet" data-media-pause-all @click=${()=>void this.pauseDialog?.pause({scope:"area",id:this.areaId,name:this.areaName||"האזור"})}><sw-icon name="pause" size=${14}></sw-icon>עצור מוזיקה</button>`:l,r=s&&!this.external?i`<button type="button" class="off-all" data-media-off-all ?disabled=${this.phase==="loading"} @click=${()=>void this.ask()}><sw-icon name="power" size=${14}></sw-icon>כבה הכל</button>`:l;return i`${n!==l||r!==l?i`<div class="bar" data-media-area-bar>${n}${r}</div>`:l}
      <div class="list" data-media-area-list @open-remote=${this.onOpenRemote} @open-player=${this.onOpenRemote}>${M(t,o=>o.key,o=>i`<media-screen-card .device=${o} .compact=${!0} size="s" data-media-tile=${o.key}></media-screen-card>`)}
        ${e.length?i`${t.length?i`<div class="sub" data-media-area-sub="players">רמקולים ומגברים</div>`:l}${M(e,o=>o.key,o=>i`<media-player-card .device=${o} .compact=${!0} size="s" data-player-tile=${o.key}></media-player-card>`)}`:l}</div>
      ${this.dialog()}
      <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
      <media-remote .deviceKey=${this.remoteKey} .kind=${this.remoteKind} .open=${this.remoteOpen} @close=${()=>this.remoteOpen=!1} @media-changed=${()=>void this.load()} @media-remote-open=${()=>this.remoteOpen=!0}></media-remote>`}};A.styles=j`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bar {
      display: flex;
      justify-content: flex-end;
      margin-block-end: 2px;
    }
    .sub {
      margin-block-start: 4px;
      padding-inline: 4px;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--sw-text-2);
    }
    .off-all {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 14px;
      border-radius: 999px;
      border: 1px solid var(--dv-border, var(--sw-border-strong));
      background: var(--dv-surface-2, var(--sw-surface));
      color: var(--dv-danger, var(--sw-danger));
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: 600;
      cursor: pointer;
    }
    .bar {
      gap: 8px;
      flex-wrap: wrap;
    }
    .off-all.quiet {
      color: var(--dv-text, var(--sw-text));
    }
    .off-all.quiet:hover {
      background: var(--dv-surface-3, var(--sw-surface-2, var(--sw-surface)));
    }
    .off-all:hover {
      background: var(--dv-danger-soft, var(--sw-danger-soft));
    }
    .off-all:focus-visible {
      outline: 2px solid var(--dv-focus, var(--sw-focus));
      outline-offset: 2px;
    }
    .q {
      margin: 0;
      font-size: var(--sw-fs-md);
    }
    details {
      font-size: var(--sw-fs-base);
      color: var(--sw-text-2);
    }
    summary {
      cursor: pointer;
      inline-size: max-content;
      min-block-size: 28px;
      display: inline-flex;
      align-items: center;
    }
    details ul {
      margin: 6px 0 0;
      padding-inline-start: 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .res b {
      display: block;
      margin-block-end: 6px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-base);
    }
  `;E([S()],A.prototype,"areaId",2);E([S()],A.prototype,"areaName",2);E([S({attribute:!1})],A.prototype,"entityIds",2);E([S({type:Boolean})],A.prototype,"external",2);E([m()],A.prototype,"devices",2);E([m()],A.prototype,"speakers",2);E([m()],A.prototype,"canBulk",2);E([je("media-group-dialog")],A.prototype,"pauseDialog",2);E([m()],A.prototype,"remoteKey",2);E([m()],A.prototype,"remoteKind",2);E([m()],A.prototype,"remoteOpen",2);E([m()],A.prototype,"phase",2);E([m()],A.prototype,"preview",2);E([m()],A.prototype,"record",2);E([m()],A.prototype,"outcomes",2);E([m()],A.prototype,"error",2);A=E([J("media-area-card")],A);var Ot=Object.defineProperty,Pt=Object.getOwnPropertyDescriptor,N=(t,e,s,a)=>{for(var n=a>1?void 0:a?Pt(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(a?o(e,s,n):o(n))||n);return a&&n&&Ot(e,s,n),n};let B=class extends Z{constructor(){super(...arguments),this.icon="light",this.label="",this.state="",this.value=0,this.on=!1,this.fillColor="",this.unavailable=!1,this.readonly=!1,this.surface="",this.look=new Te(this),this.drag=null,this.onDown=t=>{this.unavailable||this.readonly||(this.drag={y0:t.clientY,id:t.pointerId,moved:!1})},this.onMove=t=>{if(!this.drag||t.pointerId!==this.drag.id)return;const e=t.clientY-this.drag.y0;if(!this.drag.moved&&Math.abs(e)>6){this.drag.moved=!0,this.setAttribute("data-dragging","");try{this.setPointerCapture(t.pointerId)}catch{}}this.drag.moved&&this.setFromPointer(t.clientY)},this.onUp=t=>{if(!this.drag||t.pointerId!==this.drag.id)return;const e=this.drag.moved;if(this.drag=null,this.removeAttribute("data-dragging"),e){this.emit("change",{value:this.value});return}t.type==="pointerup"&&this.emit("toggle",{on:!this.on})},this.onKey=t=>{if(this.unavailable||this.readonly)return;const s={ArrowUp:.05,ArrowDown:-.05,PageUp:.2,PageDown:-.2,Home:-1,End:1}[t.key];if(s!==void 0){t.preventDefault(),this.value=this.clamp(this.value+s),this.emit("input",{value:this.value}),this.emit("change",{value:this.value});return}(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.emit("toggle",{on:!this.on}))}}connectedCallback(){super.connectedCallback(),this.hasAttribute("tabindex")||(this.tabIndex=0),this.setAttribute("role","slider"),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp),this.addEventListener("keydown",this.onKey)}disconnectedCallback(){this.removeEventListener("pointerdown",this.onDown),this.removeEventListener("pointermove",this.onMove),this.removeEventListener("pointerup",this.onUp),this.removeEventListener("pointercancel",this.onUp),this.removeEventListener("keydown",this.onKey),super.disconnectedCallback()}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}clamp(t){return Math.max(0,Math.min(1,Math.round(t*100)/100))}setFromPointer(t){const e=this.getBoundingClientRect(),s=this.clamp((e.bottom-t)/e.height);s!==this.value&&(this.value=s,this.emit("input",{value:s}))}willUpdate(){const t=this.on?this.value:0;this.style.setProperty("--fill",String(t)),this.fillColor?this.style.setProperty("--fill-c",this.fillColor):this.style.removeProperty("--fill-c"),this.toggleAttribute("data-high",this.on&&this.value>.42)}updated(){const t=Math.round((this.on?this.value:0)*100);this.setAttribute("aria-valuemin","0"),this.setAttribute("aria-valuemax","100"),this.setAttribute("aria-valuenow",String(t)),this.setAttribute("aria-valuetext",this.state||`${t}%`),this.setAttribute("aria-orientation","vertical"),this.setAttribute("aria-label",this.label),this.unavailable?this.setAttribute("aria-disabled","true"):this.removeAttribute("aria-disabled"),this.readonly?this.setAttribute("aria-readonly","true"):this.removeAttribute("aria-readonly"),this.setAttribute("data-surface",this.surface||this.look.of("surface"))}render(){const t=Math.round(this.value*100);return i`<span class="ring" aria-hidden="true"><sw-icon .name=${this.icon} size=${20}></sw-icon></span>
      <span class=${x({tx:!0})}><span class="v">${this.state||(this.on?`${t}%`:"—")}</span>${this.label?i`<span class="nm">${this.label}</span>`:l}</span>`}};B.styles=j`
    :host {
      --fill: 0;
      --fill-c: var(--sw-lit);
      --vs-w: max(var(--sw-touch-desktop), calc(72px * var(--sw-look-scale)));
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      position: relative;
      isolation: isolate;
      overflow: hidden;
      box-sizing: border-box;
      inline-size: var(--vs-w);
      min-inline-size: var(--sw-touch-desktop);
      block-size: calc(var(--sw-vslider-h, 160px) * var(--sw-look-scale));
      padding: 8px 4px;
      border-radius: var(--sw-r-lg);
      background: var(--pill-base, var(--sw-surface));
      color: var(--sw-text);
      font-family: var(--sw-font);
      font-size: calc(var(--sw-fs-state) * var(--sw-look-scale));
      user-select: none;
      -webkit-user-select: none;
      cursor: ns-resize;
      touch-action: pan-x;
      transition: background var(--sw-t-state) var(--sw-ease);
    }
    :host(:focus-visible) {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* the fill: from the bottom edge up */
    :host::before {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      z-index: -1;
      block-size: calc(var(--fill) * 100%);
      background: var(--fill-c);
      transition: block-size var(--sw-t-med) var(--sw-ease), background var(--sw-t-state) var(--sw-ease);
    }
    :host([data-dragging])::before {
      transition: none;
    }
    :host(:not([on]))::before {
      block-size: 0;
    }
    :host([unavailable]) {
      opacity: 0.55;
      cursor: not-allowed;
    }
    :host([readonly]) {
      cursor: default;
    }
    .ring {
      flex: none;
      inline-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      block-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      max-inline-size: calc(100% - 4px);
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    :host([on]) .ring {
      background: rgba(0, 0, 0, 0.16);
      color: var(--sw-on-lit);
    }
    .tx {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      min-inline-size: 0;
      max-inline-size: 100%;
      text-align: center;
    }
    .v {
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      font-size: calc(var(--sw-fs-name) * var(--sw-look-scale));
      direction: ltr;
      unicode-bidi: isolate;
    }
    .nm {
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.86;
    }
    /* once the fill passes the text, the text takes the on-fill colour (one colour per state; the bar is tall enough to read either way) */
    :host([on][data-high]) .tx {
      color: var(--sw-on-lit);
    }
    /* the surface dial */
    :host([data-surface='glass']) {
      background: var(--sw-perf-glass-bg, rgba(var(--sw-sheet-rgb), 0.42));
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong);
    }
    :host([data-surface='none']) {
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    :host([data-surface='none']:not([on]):hover) {
      background: var(--sw-layer);
    }
    @media (max-width: 1100px) {
      :host {
        min-inline-size: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host,
      :host::before {
        transition: none !important;
      }
    }
  `;N([S()],B.prototype,"icon",2);N([S()],B.prototype,"label",2);N([S()],B.prototype,"state",2);N([S({type:Number})],B.prototype,"value",2);N([S({type:Boolean,reflect:!0})],B.prototype,"on",2);N([S({attribute:"fill-color"})],B.prototype,"fillColor",2);N([S({type:Boolean,reflect:!0})],B.prototype,"unavailable",2);N([S({type:Boolean,reflect:!0})],B.prototype,"readonly",2);N([S()],B.prototype,"surface",2);B=N([J("sw-vslider")],B);var Mt=Object.defineProperty,It=Object.getOwnPropertyDescriptor,Ge=(t,e,s,a)=>{for(var n=a>1?void 0:a?It(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(a?o(e,s,n):o(n))||n);return a&&n&&Mt(e,s,n),n};let oe=class extends Z{constructor(){super(...arguments),this.items=[],this.look=new Te(this)}updated(){this.setAttribute("data-orientation",this.look.of("slider"))}render(){if(!this.items.length)return l;if(this.look.of("slider")==="vertical"){const t=this.items.map(e=>e.subs).filter(e=>e&&e!==l);return i`<div class="vrow" data-bubble-vsliders>
          ${this.items.map(e=>i`<sw-vslider .icon=${e.icon} .label=${e.label} .state=${e.state} .value=${Math.max(0,Math.min(1,e.value))} ?on=${e.on} fill-color=${e.fillColor??""} ?unavailable=${!!e.unavailable} ?readonly=${!e.onInput&&!e.onChange&&!e.onToggle}
              data-control=${e.key} data-vslider=${e.key}
              @toggle=${s=>e.onToggle?.(s.detail.on)}
              @input=${s=>e.onInput?.(s.detail.value)}
              @change=${s=>e.onChange?.(s.detail.value)}></sw-vslider>`)}
        </div>
        ${t.length?i`<div class="subs">${t}</div>`:l}`}return i`${this.items.map(t=>i`<sw-pill variant="slider" .icon=${t.icon} .label=${t.label} .state=${t.state} .value=${Math.max(0,Math.min(1,t.value))} ?on=${t.on} fill-color=${t.fillColor??""} ?keep-text=${!!t.keepText} ?unavailable=${!!t.unavailable} data-control=${t.key}
        @toggle=${e=>t.onToggle?.(e.detail.on)}
        @input=${e=>t.onInput?.(e.detail.value)}
        @change=${e=>t.onChange?.(e.detail.value)}>${t.subs??l}</sw-pill>`)}`}};oe.styles=j`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: 0;
    }
    :host([data-orientation='vertical']) .vrow {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: flex-end;
      gap: 12px;
      padding: 4px 0;
    }
    .subs {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
    .subs:empty {
      display: none;
    }
    sw-pill,
    sw-vslider {
      --pill-base: var(--sw-layer);
    }
    /* the confirm chip a cover's slider carries (the same chip as devices-area-bubble's; it is rendered here, so it is styled here) */
    ::slotted(.chip),
    .chip {
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: var(--sw-touch-desktop);
      box-sizing: border-box;
      justify-content: center;
      padding: 0 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .chip.armed {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (max-width: 1100px) {
      .chip {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;Ge([S({attribute:!1})],oe.prototype,"items",2);oe=Ge([J("bubble-sliders")],oe);const Rt={lighting:"light",switches:"bolt",climate:"snow",heating:"flame",covers:"layers",security:"shield",media:"play",sensors:"activity"};function Ie(t){return Rt[t]}const Bt=j`
  /* ---- the bubble skin: sections are separators, devices are pills in a grid, nothing is a card ---- */
  :host([data-skin='bubble']) sw-page {
    gap: 12px;
  }
  :host([data-skin='bubble']) .grid:not(.lay-grid),
  :host([data-skin='bubble'][data-area-design]) .grid:not(.lay-grid) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    column-width: auto;
  }
  :host([data-skin='bubble']) .grid:not(.lay-grid) > sw-card,
  :host([data-skin='bubble'][data-area-design]) .grid:not(.lay-grid) > sw-card {
    display: block;
    padding: 0;
    margin: 0;
    grid-column: auto;
    grid-row: auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  :host([data-skin='bubble']) .lay-grid > .lay-item > sw-card {
    border: 0;
    background: var(--sw-layer);
    box-shadow: none;
    padding: 10px 12px;
  }
  :host([data-skin='bubble']) sw-card[data-empty] {
    background: transparent;
  }
  /* the separator: icon, bold label, a rounded 6 px rule, the count and the section's bulk button */
  .bsep {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    margin: 6px 4px 8px;
    color: var(--sw-text);
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-lg);
  }
  .bsep > sw-icon {
    flex: none;
    color: var(--sw-text-2);
  }
  .bsep .bt {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0;
    cursor: default;
    text-align: start;
  }
  .bsep .bt.fold {
    cursor: pointer;
    min-block-size: 44px;
    border-radius: var(--sw-r-pill);
    padding-inline: 4px 10px;
  }
  .bsep .bt.fold:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .bsep .bt.fold sw-icon {
    transition: transform var(--sw-t-med) var(--sw-ease);
  }
  .bsep .bt.fold[aria-expanded='false'] sw-icon {
    transform: rotate(-90deg);
  }
  .bsep .bn {
    flex: none;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  .bsep .rule {
    flex: 1 1 24px;
    min-inline-size: 24px;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-2);
    opacity: 0.9;
  }
  .bsep .acts {
    flex: none;
    display: inline-flex;
    gap: 6px;
  }
  /* the pills: a grid of --sw-grid-min columns; row density = one column of touching rows */
  .bgrid {
    display: grid;
    gap: var(--sw-gap-grid);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    align-items: start;
  }
  :host([data-skin='bubble']) .lay-tgrid.tiles {
    gap: var(--sw-gap-grid);
  }
  /* an arranged card and the media card's leftover rows keep their containers: pills inside, the bubble grid's columns */
  :host([data-skin='bubble']) .tiles:not(.lay-tgrid),
  :host([data-skin='bubble']) .rows {
    display: grid;
    gap: var(--sw-gap-grid);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    align-items: start;
  }
  :host([data-skin='bubble']) .sensor-groups {
    gap: 8px;
  }
  :host([data-skin='bubble']) .bgroup {
    margin-block-end: var(--sw-gap-grid);
  }
  .bgrid.list {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sw-gap);
  }
  /* sub-buttons inside pills: round, the sub size, 44 px in touch layouts */
  .sb {
    inline-size: var(--sw-sub-size, var(--sw-sub));
    block-size: var(--sw-sub-size, var(--sw-sub));
    min-inline-size: var(--sw-touch-desktop);
    min-block-size: var(--sw-touch-desktop);
    box-sizing: border-box;
    border: 0;
    border-radius: 50%;
    background: var(--sw-surface-2);
    color: var(--sw-text);
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
    font: inherit;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease-thumb);
  }
  .sb:hover {
    background: var(--sw-surface-3);
  }
  .sb:active {
    transform: scale(0.94);
  }
  .sb:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .sb.on,
  .sb.armed {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .sb.dark {
    background: var(--sw-text);
    color: var(--sw-bg);
  }
  .sb:focus-visible,
  .chip:focus-visible,
  .bbtn:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .chip {
    block-size: var(--sw-sub-size, var(--sw-sub));
    min-block-size: var(--sw-touch-desktop);
    min-inline-size: var(--sw-touch-desktop);
    box-sizing: border-box;
    justify-content: center;
    padding: 0 12px;
    border: 0;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .chip:hover {
    background: var(--sw-surface-3);
  }
  .chip.on,
  .chip[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .chip.armed {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .chip.plain {
    cursor: default;
  }
  .chip.plain:hover {
    background: var(--sw-surface-2);
  }
  @media (max-width: 1100px) {
    .sb,
    .chip,
    .bbtn {
      min-block-size: 44px;
    }
    .sb,
    .chip {
      min-inline-size: 44px;
    }
  }
  /* the sensor tiles (value big, name small) */
  .kv {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
    gap: var(--sw-gap);
  }
  .kv > div {
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    padding: 12px 16px;
    min-inline-size: 0;
  }
  .kv .k {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kv .v {
    font-size: var(--sw-fs-xl);
    font-weight: var(--sw-fw-bold);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .kv .v.sm {
    font-size: var(--sw-fs-md);
  }
  .kv .lc {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .kv > div.hot {
    background: var(--sw-warning-soft);
  }
  .kv > div.unavailable {
    opacity: 0.6;
  }
  .bmore {
    inline-size: 100%;
    min-block-size: var(--sw-touch-desktop);
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .bmore:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  /* the head pill of the area (name, counts, the temperature, all off): a plain-variant pill is not a button */
  .bhead {
    cursor: default;
  }
  .bhead:hover {
    background: var(--pill-base, var(--sw-surface));
  }
  /* the security strip as pill chips */
  :host([data-skin='bubble']) .sec-strip {
    border: 0;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface);
    box-shadow: none;
    padding: 8px 12px;
    gap: 8px;
  }
  :host([data-skin='bubble']) .sec-chip {
    border: 0;
    background: var(--sw-layer-2);
    min-block-size: var(--sw-touch-desktop);
    padding: 0 12px;
  }
  @media (max-width: 1100px) {
    :host([data-skin='bubble']) .sec-chip {
      min-block-size: 44px;
    }
  }
  :host([data-skin='bubble']) .note,
  :host([data-skin='bubble']) .count {
    padding-inline: 8px;
  }
  /* ---- inside the sheet: pills are translucent layers over the sheet, chips and a big target ---- */
  sw-sheet sw-pill {
    --pill-base: var(--sw-layer);
  }
  sw-sheet .kv > div {
    background: var(--sw-layer);
  }
  .bsh {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
    display: flex;
    align-items: center;
    gap: 10px;
    margin-block-start: 4px;
  }
  .bsh::after {
    content: '';
    flex: 1;
    block-size: 4px;
    border-radius: 2px;
    background: var(--sw-layer);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .target {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 12px 8px;
    border-radius: var(--sw-r-lg);
    background: var(--sw-layer);
  }
  .target .tv {
    flex: 1 1 auto;
    min-inline-size: 0;
    text-align: center;
  }
  .target .tv .n {
    font-size: 40px;
    font-weight: var(--sw-fw-bold);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .target .tv .l {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .target .sb {
    inline-size: 56px;
    block-size: 56px;
  }
  .bbtn {
    min-block-size: var(--sw-touch-desktop);
    padding: 0 18px;
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    color: var(--sw-text);
    font: inherit;
    font-weight: var(--sw-fw-semibold);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .bbtn.primary {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .bbtn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .brow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .brow > .bbtn {
    flex: 1 1 100px;
  }
  .bstatus {
    font-size: var(--sw-fs-xs);
    border-radius: var(--sw-r-md);
    padding: 8px 12px;
    background: var(--sw-layer);
  }
  .bstatus.bad {
    color: var(--sw-danger-text);
    background: var(--sw-danger-soft);
  }
  .bstatus.pending {
    color: var(--sw-warning-text);
    background: var(--sw-warning-soft);
  }
  @media (prefers-reduced-motion: reduce) {
    .sb,
    .bsep .bt.fold sw-icon {
      transition: none;
    }
  }
`,re=t=>!t.available||t.state==="unavailable";function U(t,e,s){const a=t.ctl.pillStatus(e.entity_id);return a?a.text:s}function we(t){return re(t)?"לא זמין":t.domain==="sensor"&&t.value!==null&&t.value!==void 0?`${f(Number.isInteger(t.value)?t.value:t.value.toFixed(1))}${t.unit?t.unit.startsWith("°")||t.unit==="%"?t.unit:` ${t.unit}`:""}`:t.domain==="sensor"?t.state??"—":v(t)}function Dt(t){const e=t.device_class??"";return e==="temperature"?"thermometer":e==="humidity"?"sensor":e==="motion"||e==="occupancy"||e==="presence"||e==="moving"?"activity":e==="door"||e==="window"||e==="opening"||e==="garage_door"?"door":e==="power"||e==="energy"?"bolt":e==="battery"?"storage":"sensor"}function Y(t,e,s){const a=re(e),n=e.can_control&&!a,r=ge(e.entity_id),o=t.ctl,d=o.rowPendingVisible(e.entity_id),c=()=>t.openSheet(e,s);if(e.entity_id,s==="switches"&&me.has(e.domain))return i`<sw-pill variant="plain" icon="bolt" .label=${w(e.name)} .state=${U(t,e,v(e))} ?on=${e.active&&!a} .hue=${r} ?unavailable=${a} readonly
      data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(e.active&&!a)} data-equipment=${e.domain} title=${C(e)} @activate=${c} @icon-click=${c}>${t.assignButton(e)}</sw-pill>`;if(s==="lighting"||s==="switches"){const u=(o.live(e.entity_id,"power")??e.active)&&!a,p=be(e)&&e.brightness_pct!==null&&e.brightness_pct!==void 0,b=o.live(e.entity_id,"brightness")??e.brightness_pct??0,k=u?p?`דולק · ${f(Math.round(b))}%`:e.domain==="light"?"דולק":"פועל":a?"לא זמין":"כבוי",_=e.alarm_managed?i`<button slot="subs" type="button" class="chip" aria-label=${e.managed_label??"נשלט ממסך האזעקה"} data-alarm-managed @click=${()=>ie("/security/alarm")}><sw-icon name="shield" size=${14}></sw-icon></button>`:l;return p?i`<sw-pill variant="slider" icon="light" .label=${w(e.name)} .state=${U(t,e,k)} .value=${Math.max(0,Math.min(1,b/100))} ?on=${u} .hue=${r} ?unavailable=${a} ?readonly=${!e.can_control}
        data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(u)} ?data-can-control=${n} ?data-pending=${d} title=${C(e)}
        @toggle=${h=>n&&o.power(e,h.detail.on)}
        @input=${h=>n&&o.brightness(e,Math.round(h.detail.value*100))}
        @icon-click=${c}>${_}${t.assignButton(e)}</sw-pill>`:i`<sw-pill variant="toggle" .icon=${s==="lighting"?"light":"bolt"} .label=${w(e.name)} .state=${U(t,e,k)} ?on=${u} ?accent=${u&&s==="switches"} .hue=${r} ?unavailable=${a} ?readonly=${!e.can_control}
      data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(u)} ?data-can-control=${n} ?data-pending=${d} title=${C(e)}
      @toggle=${h=>n&&o.power(e,h.detail.on)} @icon-click=${c}>${_}${t.assignButton(e)}</sw-pill>`}if(s==="covers"){if(e.door_class)return i`<sw-pill variant="plain" icon="door" .label=${w(e.name)} .state=${v(e)} .hue=${r} ?unavailable=${a} data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(e.active)} data-door-class="true" title=${C(e)} @activate=${c} @icon-click=${c}>${t.assignButton(e)}</sw-pill>`;const u=e.position!==null&&e.position!==void 0,p=o.coverShown(e),b=o.coverDraft(e),k=o.coverMoving(e),_=u&&!a?`${e.state==="opening"?"נפתח…":e.state==="closing"?"נסגר…":p>0?"פתוח":"סגור"} · ${f(Math.round(p))}%`:v(e),h=n?i`<button slot="subs" type="button" class=${x({sb:!0,armed:o.coverArmed(e,"open")})} aria-label=${o.coverArmed(e,"open")?"לאשר פתיחה?":"פתח"} ?disabled=${k} data-control="open" @click=${()=>o.coverMove(e,"open")}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class="sb" aria-label="עצור" data-control="stop" @click=${()=>o.coverMove(e,"stop")}><sw-icon name="pause" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${x({sb:!0,armed:o.coverArmed(e,"close")})} aria-label=${o.coverArmed(e,"close")?"לאשר סגירה?":"סגור"} ?disabled=${k} data-control="close" @click=${()=>o.coverMove(e,"close")}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
          ${b!==void 0?i`<button slot="subs" type="button" class="chip armed" data-control="position-confirm" @click=${()=>o.coverConfirm(e)}>${`לאשר ${f(b)}%?`}</button>`:l}`:l,O=o.coverArmed(e,"open")||o.coverArmed(e,"close");return i`<sw-pill variant=${u&&n?"slider":"plain"} icon="layers" .label=${w(e.name)} .state=${U(t,e,O?"לחיצה נוספת מאשרת":_)} .value=${Math.max(0,Math.min(1,p/100))} ?on=${u&&p>0&&!a} fill-color="var(--sw-accent-soft)" keep-text .hue=${r} ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(e.active)} ?data-can-control=${n} ?data-pending=${d} data-door-class="false" title=${C(e)}
      @toggle=${()=>u&&n?o.coverStage(e,p>0?0:100):c()} @change=${P=>n&&o.coverStage(e,Math.round(P.detail.value*100))} @activate=${c} @icon-click=${c}>${h}${t.assignButton(e)}</sw-pill>`}if(s==="climate"||s==="heating"){if(e.domain==="climate"){const{min:k,max:_,step:h}=Le(e),O=o.live(e.entity_id,"temp")??e.target_temperature,P=o.live(e.entity_id,"mode")??e.hvac_mode??"",g=e.active&&!a&&P!=="off",G=e.hvac_action==="heating"||P==="heat"||e.climate_kind==="heating",z=a?"לא זמין":`${qe[P]??P??""}${e.hvac_action&&ne[e.hvac_action]&&e.hvac_action!==P?` · ${ne[e.hvac_action]}`:""}${e.current_temperature!==null&&e.current_temperature!==void 0?` · בחדר ${q(e.current_temperature)}`:""}`,He=n&&O!==null&&O!==void 0?i`<button slot="subs" type="button" class="sb" aria-label="הנמך" data-control="temp-down" ?disabled=${O<=k} @click=${()=>o.climateTemp(e,O-h)}><sw-icon name="minus" size=${18}></sw-icon></button>
            <button slot="subs" type="button" class="chip" aria-label=${`יעד ${q(O)}`} data-control="temp-value" @click=${c}>${q(O)}</button>
            <button slot="subs" type="button" class="sb" aria-label="הגבה" data-control="temp-up" ?disabled=${O>=_} @click=${()=>o.climateTemp(e,O+h)}><sw-icon name="plus" size=${18}></sw-icon></button>`:l;return i`<sw-pill variant="plain" .icon=${G?"flame":"snow"} .label=${w(e.name)} .state=${U(t,e,z)} ?on=${g} fill-color=${G?"var(--sw-heat)":"var(--sw-cool)"} .hue=${r} ?unavailable=${a}
        data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(e.active)} ?data-can-control=${n} ?data-pending=${d} title=${C(e)} @activate=${c} @icon-click=${c}>${He}${t.assignButton(e)}</sw-pill>`}const u=(o.live(e.entity_id,"power")??e.active)&&!a,p=e.domain==="fan",b=o.live(e.entity_id,"percentage")??e.percentage;return i`<sw-pill variant=${p&&n&&b!==null&&b!==void 0?"slider":"plain"} .icon=${p?"fan":"activity"} .label=${w(e.name)} .state=${U(t,e,v(e))} .value=${Math.max(0,Math.min(1,(b??0)/100))} ?on=${u} fill-color="var(--sw-accent-soft)" keep-text .hue=${r} ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(e.active)} ?data-can-control=${n} ?data-pending=${d} title=${C(e)}
      @toggle=${k=>n&&p&&o.power(e,k.detail.on)} @input=${k=>n&&p&&o.fanPercentage(e,Math.round(k.detail.value*100))} @activate=${c} @icon-click=${c}>${t.assignButton(e)}</sw-pill>`}if(s==="security"){const u=e.kind==="lock"?e.locked?"lock":"unlock":e.kind==="alarm"?"shield":e.kind==="camera"?"camera":"door",p=a?"לא זמין":e.kind==="lock"?e.locked?"נעול":v(e):e.kind==="camera"?"מצלמת התקן":v(e),b=e.kind==="alarm"?()=>ie("/security/alarm"):c;return i`<sw-pill variant="plain" .icon=${u} .label=${w(e.name)} .state=${p} .hue=${r} ?on=${e.kind==="alarm"?e.state==="triggered":e.kind==="binary_sensor"?e.state==="on":!1} fill-color="var(--sw-warning-soft)" keep-text ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-kind=${e.kind??""} title=${C(e)} @activate=${b} @icon-click=${b}>${t.assignButton(e)}</sw-pill>`}if(s==="media"){const u=(o.live(e.entity_id,"power")??e.active)&&!a,p=(o.live(e.entity_id,"playpause")??e.state)==="playing",b=o.live(e.entity_id,"mute")??!!e.muted,k=a?"לא זמין":[v(e),e.media_title,e.source].filter(Boolean).join(" · "),_=n?i`<button slot="subs" type="button" class=${x({sb:!0,dark:p})} aria-label=${p?"השהה":"נגן"} data-control="playpause" @click=${()=>o.mediaPlayPause(e)}><sw-icon .name=${p?"pause":"play"} size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${x({sb:!0,on:b})} aria-label=${b?"בטל השתקה":"השתקה"} data-control="mute" @click=${()=>o.mediaMute(e)}><sw-icon name="volume" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${x({sb:!0,on:u})} role="switch" aria-checked=${String(u)} aria-label=${u?"כבה":"הדלק"} data-control="power" @click=${()=>o.power(e,!u)}><sw-icon name="power" size=${18}></sw-icon></button>`:l;return i`<sw-pill variant="plain" icon="play" .label=${w(e.name)} .state=${U(t,e,k)} ?on=${p&&!a} fill-color="var(--sw-lit)" .hue=${r} ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(e.active)} ?data-can-control=${n} ?data-pending=${d} title=${C(e)} @activate=${c} @icon-click=${c}>${_}${t.assignButton(e)}</sw-pill>`}return i`<sw-pill variant="plain" .icon=${Dt(e)} .label=${w(e.name)} .state=${we(e)} .hue=${r} ?on=${e.domain==="binary_sensor"&&e.state==="on"} fill-color="var(--sw-warning-soft)" keep-text ?unavailable=${a}
    data-entity=${e.entity_id} data-activity=${I(R(e,v(e)))} data-active=${String(e.active)} title=${C(e)} @activate=${c} @icon-click=${c}>${t.assignButton(e)}</sw-pill>`}function Re(t,e){const s=re(t);return i`<div class=${x({unavailable:s,hot:t.domain==="binary_sensor"&&t.state==="on"})} data-main-sensor=${t.entity_id} data-slot=${e??""} title=${C(t)}>
    <span class="k">${w(t.name)}</span><div class="v">${we(t)}</div>
  </div>`}function Be(t){const e=t.fold;return i`<div class="bsep" data-bubble-section=${t.id}>
    ${e?i`<button type="button" class="bt fold" aria-expanded=${String(e.open)} aria-label=${`${e.open?"כווץ":"הרחב"} ${t.label}`} @click=${e.toggle}><sw-icon name="chevronDown" size=${16}></sw-icon><sw-icon .name=${t.icon} size=${18}></sw-icon><span>${t.label}</span></button>`:i`<sw-icon .name=${t.icon} size=${18}></sw-icon><span class="bt">${t.label}</span>`}
    ${t.count?i`<span class="bn">${t.count}</span>`:l}
    <span class="rule"></span>
    ${t.actions?i`<span class="acts">${t.actions}</span>`:l}
  </div>`}function K(t,e){const s=t.ctl.pillStatus(e.entity_id);return s?i`<div class=${x({bstatus:!0,bad:s.tone==="bad",pending:s.tone==="pending"})} role="status" data-cmd-status=${s.tone==="bad"?"rolled_back":s.tone}>${s.text}</div>`:l}function L(t,e=[]){const s=[...e,...t.last_changed?[{k:"שינוי אחרון",v:Ne(t.last_changed)}]:[]];return s.length?i`<div class="kv">${s.map(a=>i`<div><span class="k">${a.k}</span><div class=${x({v:!0,sm:a.v.length>12})}>${a.v}</div></div>`)}</div>`:l}const Q=(t,e,s,a,n)=>i`<div class="chips" role="group" data-control=${n}>${t.map(r=>i`<button type="button" class="chip" aria-pressed=${String(r===e)} @click=${()=>a(r)}>${s(r)}</button>`)}</div>`;function Tt(t,e,s){const a=t.ctl,n=re(e),r=e.can_control&&!n;if(s==="switches"&&me.has(e.domain))return i`${K(t,e)}${L(e,[{k:"מצב",v:v(e)}])}`;if(s==="lighting"||s==="switches"){const o=(a.live(e.entity_id,"power")??e.active)&&!n,d=be(e)&&e.brightness_pct!==null&&e.brightness_pct!==void 0,c=a.live(e.entity_id,"brightness")??e.brightness_pct??0,u=d?[{key:"brightness",icon:"light",label:"בהירות",state:o?`${f(Math.round(c))}%`:"כבוי",value:c/100,on:o,unavailable:!r,onToggle:p=>r&&a.power(e,p),onInput:p=>r&&a.brightness(e,Math.round(p*100))}]:[];return i`${u.length?i`<bubble-sliders .items=${u}></bubble-sliders>`:l}
      ${r?i`<div class="brow"><button type="button" class=${x({bbtn:!0,primary:!o})} data-control="power" @click=${()=>a.power(e,!o)}><sw-icon name="power" size=${18}></sw-icon>${o?"כבה":"הדלק"}</button></div>`:l}
      ${K(t,e)}
      ${L(e,[{k:"מצב",v:v(e)}])}`}if(s==="covers"){if(e.door_class||!r)return i`${K(t,e)}${L(e,[{k:"מצב",v:v(e)},...e.door_class?[{k:"סוג",v:"דלת / שער"}]:[]])}`;const o=(d,c,u)=>{if(!u)return l;const p=a.coverShown(e,d),b=a.coverDraft(e,d),k=a.coverMoving(e,d),_={key:d==="tilt"?"tilt-position":"position",icon:d==="tilt"?"move":"layers",label:d==="tilt"?"הטיה":"מיקום",state:`${f(Math.round(p))}%${b!==void 0?" · טרם נשלח":""}`,value:p/100,on:p>0,fillColor:"var(--sw-accent-soft)",keepText:!0,onToggle:()=>a.coverStage(e,p>0?0:100,d),onChange:h=>a.coverStage(e,Math.round(h*100),d),subs:b!==void 0?i`<button slot="subs" type="button" class="chip armed" data-control=${d==="tilt"?"tilt-position-confirm":"position-confirm"} @click=${()=>a.coverConfirm(e,d)}>${`לאשר ${f(b)}%?`}</button>`:l};return i`<div class="bsh">${c}</div>
        <bubble-sliders .items=${[_]}></bubble-sliders>
        <div class="brow" data-control=${d==="tilt"?"cover-tilt":"cover"}>
          <button type="button" class=${x({bbtn:!0,primary:a.coverArmed(e,"open",d)})} ?disabled=${k} data-control=${d==="tilt"?"open-tilt":"open"} @click=${()=>a.coverMove(e,"open",d)}><sw-icon name="arrowUp" size=${18}></sw-icon>${a.coverArmed(e,"open",d)?"לאשר פתיחה?":"פתיחה"}</button>
          <button type="button" class="bbtn" data-control=${d==="tilt"?"stop-tilt":"stop"} @click=${()=>a.coverMove(e,"stop",d)}><sw-icon name="pause" size=${18}></sw-icon>עצירה</button>
          <button type="button" class=${x({bbtn:!0,primary:a.coverArmed(e,"close",d)})} ?disabled=${k} data-control=${d==="tilt"?"close-tilt":"close"} @click=${()=>a.coverMove(e,"close",d)}><sw-icon name="arrowDown" size=${18}></sw-icon>${a.coverArmed(e,"close",d)?"לאשר סגירה?":"סגירה"}</button>
        </div>`};return i`${o("position","מיקום",!0)}${o("tilt","הטיה",e.tilt!==null&&e.tilt!==void 0)}${K(t,e)}${L(e,[{k:"מצב",v:v(e)}])}`}if(s==="climate"||s==="heating"){if(e.domain==="climate"){const{min:c,max:u,step:p}=Le(e),b=a.live(e.entity_id,"temp")??e.target_temperature,k=a.live(e.entity_id,"mode")??e.hvac_mode??"",_=(e.hvac_modes??[]).filter(z=>["off","heat","cool","heat_cool","auto","dry","fan_only"].includes(z)),h=a.live(e.entity_id,"fan")??e.fan_mode??"",O=a.live(e.entity_id,"preset")??e.preset_mode??"",P=a.live(e.entity_id,"swing")??e.swing_mode??"",g=a.live(e.entity_id,"humidity")??e.target_humidity,G=[e.current_temperature!==null&&e.current_temperature!==void 0?`בחדר ${q(e.current_temperature)}`:"",e.current_humidity!==null&&e.current_humidity!==void 0?`לחות ${f(e.current_humidity)}%`:""].filter(Boolean).join(" · ");return i`${b!=null?i`<div class="target" data-control="climate">
              <button type="button" class="sb" aria-label="הנמך" data-control="temp-down" ?disabled=${!r||b<=c} @click=${()=>a.climateTemp(e,b-p)}><sw-icon name="minus" size=${22}></sw-icon></button>
              <div class="tv"><span class="l">יעד</span><div class="n" data-control="temp-value">${q(b)}</div>${G?i`<span class="l">${G}</span>`:l}</div>
              <button type="button" class="sb" aria-label="הגבה" data-control="temp-up" ?disabled=${!r||b>=u} @click=${()=>a.climateTemp(e,b+p)}><sw-icon name="plus" size=${22}></sw-icon></button>
            </div>`:l}
        ${_.length&&r?i`<div class="bsh">מצב</div>${Q(_,k,z=>qe[z]??z,z=>a.climateMode(e,z),"mode")}`:l}
        ${e.fan_modes?.length&&r?i`<div class="bsh">מאוורר</div>${Q(e.fan_modes,h,z=>z,z=>a.climateChoice(e,"fan",z),"fan-mode")}`:l}
        ${e.preset_modes?.length&&r?i`<div class="bsh">מצב מוגדר</div>${Q(e.preset_modes,O,z=>z,z=>a.climateChoice(e,"preset",z),"preset-mode")}`:l}
        ${e.swing_modes?.length&&r?i`<div class="bsh">נדנוד</div>${Q(e.swing_modes,P,z=>z,z=>a.climateChoice(e,"swing",z),"swing-mode")}`:l}
        ${g!=null&&r?i`<div class="bsh">לחות יעד</div><div class="brow" data-control="humidity">
              <button type="button" class="sb" aria-label="הפחת לחות יעד" data-control="humidity-down" @click=${()=>a.humidity(e,g-5)}><sw-icon name="minus" size=${18}></sw-icon></button>
              <span class="chip plain" data-control="humidity-value">${f(g)}%</span>
              <button type="button" class="sb" aria-label="הגבר לחות יעד" data-control="humidity-up" @click=${()=>a.humidity(e,g+5)}><sw-icon name="plus" size=${18}></sw-icon></button>
            </div>`:l}
        ${K(t,e)}
        ${L(e,[{k:"מצב",v:v(e)},...e.hvac_action?[{k:"עכשיו",v:ne[e.hvac_action]??e.hvac_action}]:[]])}`}if(e.domain==="fan"){const c=(a.live(e.entity_id,"power")??e.active)&&!n,u=a.live(e.entity_id,"percentage")??e.percentage,p=u!=null?[{key:"percentage",icon:"fan",label:"עוצמה",state:c?`${f(Math.round(u))}%`:"כבוי",value:u/100,on:c,fillColor:"var(--sw-accent-soft)",keepText:!0,unavailable:!r,onToggle:b=>r&&a.power(e,b),onInput:b=>r&&a.fanPercentage(e,Math.round(b*100))}]:[];return i`${p.length?i`<bubble-sliders .items=${p}></bubble-sliders>`:l}
        ${r?i`<div class="brow"><button type="button" class=${x({bbtn:!0,primary:!c})} data-control="power" @click=${()=>a.power(e,!c)}><sw-icon name="power" size=${18}></sw-icon>${c?"כבה":"הדלק"}</button></div>`:l}
        ${K(t,e)}${L(e,[{k:"מצב",v:v(e)}])}`}const o=a.live(e.entity_id,"mode")??e.mode??"",d=a.live(e.entity_id,"humidity")??e.target_humidity;return i`${e.available_modes?.length&&r?i`<div class="bsh">מצב</div>${Q(e.available_modes,o,c=>c,c=>a.climateChoice(e,"hmode",c),"mode")}`:l}
      ${d!=null&&r?i`<div class="bsh">לחות יעד</div><div class="brow" data-control="humidifier">
            <button type="button" class="sb" aria-label="הפחת לחות יעד" data-control="humidity-down" @click=${()=>a.humidity(e,d-5)}><sw-icon name="minus" size=${18}></sw-icon></button>
            <span class="chip plain" data-control="humidity-value">${f(d)}%</span>
            <button type="button" class="sb" aria-label="הגבר לחות יעד" data-control="humidity-up" @click=${()=>a.humidity(e,d+5)}><sw-icon name="plus" size=${18}></sw-icon></button>
          </div>`:l}
      ${K(t,e)}${L(e,[{k:"מצב",v:v(e)},...e.current_humidity!==null&&e.current_humidity!==void 0?[{k:"לחות",v:`${f(e.current_humidity)}%`}]:[]])}`}if(s==="media"){const o=(a.live(e.entity_id,"power")??e.active)&&!n,d=(a.live(e.entity_id,"playpause")??e.state)==="playing",c=a.live(e.entity_id,"mute")??!!e.muted;return i`${r?i`<div class="brow" data-control="media">
            <button type="button" class="bbtn primary" data-control="playpause" @click=${()=>a.mediaPlayPause(e)}><sw-icon .name=${d?"pause":"play"} size=${18}></sw-icon>${d?"השהה":"נגן"}</button>
            <button type="button" class=${x({bbtn:!0,primary:c})} data-control="mute" @click=${()=>a.mediaMute(e)}><sw-icon name="volume" size=${18}></sw-icon>${c?"בטל השתקה":"השתק"}</button>
            <button type="button" class="bbtn" data-control="power" @click=${()=>a.power(e,!o)}><sw-icon name="power" size=${18}></sw-icon>${o?"כבה":"הדלק"}</button>
          </div>`:l}
      ${K(t,e)}
      ${L(e,[{k:"מצב",v:v(e)},...e.media_title?[{k:"מתנגן",v:e.media_title}]:[],...e.source?[{k:"מקור",v:e.source}]:[],...e.volume_pct!==null&&e.volume_pct!==void 0?[{k:"עוצמה",v:`${f(e.volume_pct)}%${e.muted?" · מושתק":""}`}]:[]])}`}if(s==="security"){const o=n?"לא זמין":e.kind==="alarm"?ve[e.state??""]??e.state??"":e.kind==="lock"?e.locked?"נעול":v(e):e.kind==="camera"?"מצלמת התקן":v(e);return i`${L(e,[{k:"מצב",v:o}])}`}return i`${L(e,[{k:"ערך",v:we(e)}])}`}var Lt=Object.defineProperty,qt=Object.getOwnPropertyDescriptor,y=(t,e,s,a)=>{for(var n=a>1?void 0:a?qt(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(a?o(e,s,n):o(n))||n);return a&&n&&Lt(e,s,n),n};const Nt={door:"דלת",garage:"דלת מוסך",gate:"שער"},Gt={shutter:"תריס גלילה",blind:"תריס",curtain:"וילון",awning:"סוכך",window:"חלון"},Ht={door:"lock",garage:"lock",gate:"lock"},he={temperature:"טמפרטורה",humidity:"לחות",power:"חשמל / אנרגיה",illuminance:"תאורה סביבתית",co2:"CO2",battery:"סוללה",other:"אחר"},W=["temperature","humidity","power","illuminance","co2","battery"],se=new Set(["lighting","switches","sensors"]),Kt={lighting:"light",switches:"bolt",climate:"activity",heating:"activity",covers:"layers",security:"shield",media:"play",sensors:"sensor"},jt=j`
  /* a tighter page: the header, the room tabs, the security strip and the sections sit closer */
  sw-page {
    gap: 8px;
  }
  /* AREA-PRESENCE-LINE-2351: the presence line - one quiet line, fixed height, never wraps (a long list ends in an ellipsis; the full
     list is the tooltip). Green only while someone is there. */
  .pres-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    block-size: 28px;
    padding-inline: 4px;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    white-space: nowrap;
    overflow: hidden;
  }
  .pres-line sw-icon {
    flex: none;
    color: var(--sw-text-3);
  }
  .pres-line[data-tone='ok'] sw-icon,
  .pres-line[data-tone='ok'] b {
    color: var(--sw-success-text);
  }
  .pres-lbl {
    flex: none;
    color: var(--sw-text-2);
  }
  .pres-sep {
    flex: none;
    color: var(--sw-text-3);
  }
  .pres-line b {
    flex: none;
    color: var(--sw-text);
    font-weight: var(--sw-fw-semibold);
  }
  .pres-who {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--sw-text);
  }
  /* HOMEFABLE-297: the security strip is the one dark-ink line of the screen - a label in the heading ink, chips as filled wells */
  .sec-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    padding: 10px 14px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface);
    box-shadow: var(--sw-shadow-1);
  }
  .sec-lbl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-inline-end: 6px;
    color: var(--sw-heading);
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.01em;
  }
  .sec-lbl sw-icon {
    color: var(--sw-accent);
  }
  .sec-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 28px;
    padding: 3px 11px;
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    text-decoration: none;
    white-space: nowrap;
  }
  .sec-chip b {
    color: var(--sw-text);
    font-weight: var(--sw-fw-medium);
    /* WIDGETBREAK-297: a long or unbreakable device name ends in an ellipsis inside the chip (the full name is the tooltip) */
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sec-chip {
    max-inline-size: 100%;
    box-sizing: border-box;
  }
  .sec-chip span {
    flex: none;
  }
  .sec-chip.ok span {
    color: var(--sw-success-text);
    font-weight: var(--sw-fw-medium);
  }
  .sec-chip.warn span {
    color: var(--sw-warning-text);
    font-weight: var(--sw-fw-medium);
  }
  .sec-chip.bad span {
    color: var(--sw-danger-text);
    font-weight: var(--sw-fw-semibold);
  }
  .sec-chip.off {
    opacity: 0.6;
  }
  a.sec-chip:hover {
    background: var(--sw-surface-3);
  }
  a.sec-chip:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  /* the main sensors strip and its fold */
  .main-sensors {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .msens {
    display: flex;
    align-items: center;
    gap: 10px;
    min-inline-size: 0;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
  }
  .msens sw-icon {
    flex: none;
    color: var(--sw-accent);
  }
  .msens.hot {
    background: var(--sw-warning-soft);
    border-color: transparent;
  }
  .msens.unavailable {
    opacity: 0.6;
  }
  .msens .mv {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.2;
  }
  .msens .mv b {
    font-size: var(--sw-fs-xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--sw-heading);
    font-variant-numeric: tabular-nums;
  }
  .msens .mv span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .more-sens {
    inline-size: 100%;
    margin-block-start: 6px;
    padding: 5px 10px;
    border: 1px dashed var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-accent-text);
    font: inherit;
    font-size: var(--sw-fs-xs);
    cursor: pointer;
  }
  .more-sens:hover {
    background: var(--sw-hover-wash);
    border-color: var(--sw-accent);
  }
  .more-sens:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  .more-sens + .sensor-groups {
    margin-block-start: 8px;
  }
  .sec-bulk {
    display: inline-flex;
    gap: 6px;
  }
  .design-personal label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .design-personal select {
    font: inherit;
    font-size: var(--sw-fs-xs);
    padding: 3px 6px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-xs);
    background: var(--sw-surface);
    color: var(--sw-text);
  }
  /* dense tiles: icon, name and state on the start side, the switch at the end - one short row; a slider or a status line
     takes the whole row under it */
  .tile {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'ic nm tg' 'ic st tg';
    column-gap: 10px;
    row-gap: 0;
    align-items: center;
    min-block-size: 50px;
    padding: 7px 11px;
  }
  .tile .t {
    display: contents;
  }
  .tile .t > sw-icon {
    grid-area: ic;
  }
  /* HOME polish (2026-10-10): a device's name may take two lines before the ellipsis (the dense tile cut "תאורה אולם ספור…") */
  .tile .t > span {
    grid-area: nm;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
    white-space: normal;
    line-height: 1.25;
    font-weight: var(--sw-fw-semibold);
    font-size: var(--sw-fs-base);
    color: var(--sw-heading);
  }
  .tile .t > sw-toggle {
    grid-area: tg;
    margin-inline-start: 0;
  }
  .tile .s {
    grid-area: st;
  }
  .tile > :not(.t):not(.s) {
    grid-column: 1 / -1;
  }
  .rows {
    gap: 4px;
  }
  .row {
    padding: 6px 9px;
    row-gap: 2px;
  }
  .row .v.big {
    font-size: var(--sw-fs-lg);
  }
  .tiles {
    gap: 6px;
  }
  /* compact controls: the buttons and the slider share one line; a brightness slider is a thin line under its tile */
  .ctl-row {
    gap: 4px;
  }
  .ctl-row input[type='range'].ctl-range {
    flex: 1 1 90px;
    inline-size: auto;
    min-inline-size: 90px;
    margin: 0;
  }
  .tile input[type='range'].ctl-range {
    margin: 0;
    block-size: 14px;
  }
  .row .d {
    gap: 4px 8px;
  }
  /* the section's header has "פתח" / "סגור" now (with the confirmation): the group control keeps only what it adds -
     stop all and the position for all - on one short line */
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group {
    padding: 4px 8px;
    margin-block-end: 4px;
  }
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group .lbl,
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group [data-cover-group-kind='covers_open'],
  :host([data-area-design]) .grid:not(.lay-grid) .cover-group [data-cover-group-kind='covers_close'] {
    display: none;
  }
  /* tiles: section cards flow in columns (top to bottom, then the next column) */
  :host([data-area-design='tiles']) .grid:not(.lay-grid) {
    display: block;
    column-width: 360px;
    column-gap: 12px;
  }
  /* the dense direction: a position bar repeats what the slider under it already shows */
  :host([data-area-design]) .grid:not(.lay-grid) .row .bar {
    display: none;
  }
  :host([data-area-design='tiles']) .grid:not(.lay-grid) > sw-card {
    display: block;
    break-inside: avoid;
    margin-block-end: 12px;
    padding: 12px 14px 14px;
  }
  :host([data-area-design='tiles']) .grid:not(.lay-grid) > sw-card > header {
    margin-block-end: 10px;
  }
  /* PRE-GATE-2350: the tiles design's own card padding (2026-10-28) outweighed the compact density's sw-card rule, so
     devices.density = compact no longer tightened the area cards of the default design; compact wins again here */
  :host([data-area-design='tiles'][data-devices-density='compact']) .grid:not(.lay-grid) > sw-card {
    padding: 10px;
  }
  /* sections: one section after the other, its title at the side; the sensors card stands beside them */
  :host([data-area-design='sections']) .grid:not(.lay-grid) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 264px;
    grid-auto-flow: row dense;
    gap: 8px 12px;
    align-items: start;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card {
    grid-column: 1;
    padding: 10px 14px;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card[data-card='sensors'],
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card[data-card='media'] {
    grid-column: 2;
    grid-row: span 2;
    display: block;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card:not([data-card='sensors']) .tiles {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card:not([data-card='sensors']):not([data-card='media']) .rows {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
    gap: 6px;
  }
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card .cover-group {
    grid-column: 1 / -1;
  }
  /* a phone: one column of folding sections */
  @media (max-width: 599px) {
    :host([data-area-design]) .grid:not(.lay-grid) {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    :host([data-area-design]) .grid:not(.lay-grid) > sw-card {
      display: block;
      grid-column: auto;
      grid-row: auto;
      margin: 0;
      padding: 10px 12px;
      /* GATE-FIX-2270: the R5 card title (larger, bold) and the semibold "turn all on / off" keys no longer fit one 320 px line;
         the keys drop under the title instead of widening the section past the screen (sw-card: --sw-card-head-wrap) */
      --sw-card-head-wrap: wrap;
    }
    :host([data-area-design]) .grid:not(.lay-grid) > sw-card .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    :host([data-area-design]) .grid:not(.lay-grid) > sw-card .rows {
      display: flex;
    }
  }
`,Ft=j`
  :host([data-devices-style='glass']) sw-card {
    backdrop-filter: var(--sw-glass-blur);
    -webkit-backdrop-filter: var(--sw-glass-blur);
    padding-block: var(--dv-card-pad-block);
    padding-inline: var(--dv-card-pad-inline);
  }
  :host([data-devices-style='glass']) sw-card[data-empty] {
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) sw-card > sw-icon[slot='actions'] {
    box-sizing: border-box;
    inline-size: var(--dv-card-badge-size);
    block-size: var(--dv-card-badge-size);
    padding: var(--dv-icon-ring-pad);
    border-radius: 50%;
    background: var(--dv-accent-soft);
    color: var(--dv-accent);
  }
  :host([data-devices-style='glass']) .grid {
    grid-template-columns: repeat(auto-fill, minmax(min(var(--dv-area-card-min), 100%), 1fr));
    gap: var(--dv-gap);
  }
  :host([data-devices-style='glass']) .tiles {
    /* icon + name + switch need room: one column in a narrow card or on a phone, two in a wide one */
    grid-template-columns: repeat(auto-fill, minmax(min(var(--dv-entity-tile-min), 100%), 1fr));
    gap: var(--dv-gap-sm);
  }
  :host([data-devices-style='glass']) .rows {
    gap: var(--dv-gap-sm);
  }
  :host([data-devices-style='glass']) .tile {
    min-block-size: var(--dv-item-min-block);
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
    gap: 6px;
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) .tile .t {
    gap: var(--dv-gap-sm);
    font-size: var(--dv-fs-item-name);
    font-weight: var(--sw-fw-semibold);
  }
  :host([data-devices-style='glass']) .tile .t > sw-icon {
    box-sizing: border-box;
    inline-size: var(--dv-icon-ring-size);
    block-size: var(--dv-icon-ring-size);
    padding: var(--dv-icon-ring-pad);
    border-radius: 50%;
    background: var(--dv-icon-ring-bg);
    color: var(--dv-icon-ring-fg);
  }
  :host([data-devices-style='glass']) .tile .s,
  :host([data-devices-style='glass']) .tile .lc {
    padding-inline-start: calc(var(--dv-icon-ring-size) + var(--dv-gap-sm));
  }
  :host([data-devices-style='glass']) sw-card[data-card='lighting'] .tile.on {
    background: linear-gradient(135deg, rgb(var(--dv-tile-on-cool) / var(--dv-glow-fill-start)), rgb(var(--dv-tile-on-cool) / var(--dv-glow-fill-end))), var(--sw-surface-2);
    border-color: rgb(var(--dv-tile-on-cool) / var(--dv-glow-border));
    box-shadow: 0 0 24px rgb(var(--dv-tile-on-cool) / var(--dv-glow-halo));
  }
  :host([data-devices-style='glass']) sw-card[data-card='switches'] .tile.on {
    background: linear-gradient(135deg, rgb(var(--dv-tile-on-switch) / var(--dv-glow-fill-start)), rgb(var(--dv-tile-on-switch) / var(--dv-glow-fill-end))), var(--sw-surface-2);
    border-color: rgb(var(--dv-tile-on-switch) / var(--dv-glow-border));
    box-shadow: 0 0 24px rgb(var(--dv-tile-on-switch) / var(--dv-glow-halo));
  }
  :host([data-devices-style='glass']) sw-card[data-card='lighting'] .tile.on .t > sw-icon,
  :host([data-devices-style='glass']) sw-card[data-card='switches'] .tile.on .t > sw-icon {
    background: var(--dv-icon-ring-on-bg);
    color: var(--dv-icon-ring-fg);
  }
  :host([data-devices-style='glass']) sw-toggle {
    --sw-accent: var(--dv-toggle-on);
  }
  :host([data-devices-style='glass']) .row {
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) .row .v.big {
    font-size: var(--dv-fs-value-big);
    font-weight: var(--dv-fw-title);
  }
  :host([data-devices-style='glass']) .cover-group {
    border-radius: var(--dv-radius-sm);
    padding-block: var(--dv-gap-sm);
    padding-inline: var(--dv-item-pad-inline);
  }
  :host([data-devices-style='glass']) .bar {
    block-size: 8px;
    border-radius: var(--dv-radius-control);
  }
  :host([data-devices-style='glass']) .bar i {
    border-radius: var(--dv-radius-control);
  }

  /* compact density (either style) */
  :host([data-devices-density='compact']) .grid {
    grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
    gap: 8px;
  }
  :host([data-devices-density='compact']) sw-card {
    padding-block: 10px;
    padding-inline: 10px;
  }
  :host([data-devices-density='compact']) .tiles {
    gap: 6px;
  }
  :host([data-devices-density='compact']) .rows {
    gap: 4px;
  }
  :host([data-devices-density='compact']) .tile {
    min-block-size: 0;
    padding-block: 6px;
    padding-inline: 8px;
    gap: 2px;
  }
  :host([data-devices-density='compact']) .row {
    padding-block: 5px;
    padding-inline: 8px;
  }
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile .t > sw-icon {
    inline-size: calc(var(--dv-icon-ring-size) - 8px);
    block-size: calc(var(--dv-icon-ring-size) - 8px);
    padding: calc(var(--dv-icon-ring-pad) - 3px);
  }
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile .s,
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile .lc {
    padding-inline-start: calc(var(--dv-icon-ring-size) - 8px + var(--dv-gap-sm));
  }
`;let $=class extends Z{constructor(){super(...arguments),this.areaId="",this.detail=null,this.error="",this.forbidden=!1,this.notFound=!1,this.sync=null,this.structureFlash=!1,this.flashTimer=0,this.coverGroupPosition=50,this.assigning=null,this.assignAreas=null,this.assignTarget="",this.assignBusy=!1,this.assignError="",this.stop=null,this.timer=0,this.loading=!1,this.loadAgain=!1,this.ctl=new Xe(this),this.press=new Ze(this,{area:()=>this.detail?.area.name??""}),this.prefs=Je,this.prefsReady=Promise.resolve(),this.design="tiles",this.installationDesign="tiles",this.extra=new Map,this.mediaCount=new Map,this.sensOpen=new Set,this.foldState=new Map,this.phone=!1,this.phoneMq=null,this.extraKey="",this.skin=new et(this),this.sheet=null,this.quick=null,this.desktopArea="drawer",this.presence=null,this.presenceTimer=0,this.lay=new tt(this,{scope:"area",id:()=>this.areaId,screenName:()=>`מסך האזור ‹ ${this.detail?.area.name??""}`,measure:()=>this.measureCards(),defaultH:()=>30,label:t=>t.startsWith("card:c-")?this.lay.customTitle(t):t.startsWith("camera:")?this.lay.item(t)?.title||"מצלמה":this.detail?this.detail.cards[t.slice(5)]?.label??t:t,compact:()=>this.prefs.density==="compact",entities:t=>{if(t.startsWith("card:c-"))return this.customRows(t).map(s=>({id:s.entity_id,name:s.name}));const e=this.detail?.cards[t.slice(5)];return e?this.displayRows(e).map(s=>({id:s.entity_id,name:s.name,group:e.id==="sensors"?he[s.group??"other"]:void 0})):[]},tileSpan:t=>{const e=this.lay.customOf(t)?.type;return e?_e[e]?.tiles?1:xe[e]??2:se.has(t.slice(5))?1:xe[t.slice(5)]??1},pool:()=>this.areaPool(),barExtra:()=>this.renderDesignPersonal()}),this.onBulkRequest=t=>{t.stopPropagation(),this.renderRoot.querySelector("devices-bulk-dialog")?.show(t.detail)},this.onPhone=()=>{this.phone=this.phoneMq?.matches??!1},this.bubbleHost={ctl:this.ctl,openSheet:(t,e)=>{this.sheet={id:t.entity_id,card:e}},assignButton:t=>this.canAssignArea?i`<sw-button slot="subs" class="assign-btn" size="sm" variant="ghost" data-assign-entity=${t.entity_id} @click=${e=>{e.stopPropagation(),this.openAssign(t)}}>שייך לאזור</sw-button>`:l},this.onQuickBulk=t=>{const{kind:e,position:s,area:a}=t.detail;this.bulkAllowed&&this.renderRoot.querySelector("devices-bulk-dialog")?.show({scope:"area",id:a.area_id,name:a.name,kind:e,position:s})},this.closeAssign=()=>{this.assignBusy||(this.assigning=null)}}areaPool(){const t=this.detail;return t?F.filter(e=>this.prefs.showSensors||e!=="sensors").flatMap(e=>(t.cards[e]?.entities??[]).map(s=>({id:s.entity_id,name:s.name,card:e,domain:s.domain,group:s.group,door:s.door_class}))):[]}rowIndex(){const t=new Map,e=this.detail;if(!e)return t;for(const s of F)for(const a of e.cards[s]?.entities??[])t.set(a.entity_id,{row:a,card:s});for(const[s,a]of this.extra)t.has(s)||t.set(s,{row:a,card:a.card});return t}updated(){const t=this.detail;if(!t)return;const e=new Set(F.flatMap(a=>t.cards[a].entities.map(n=>n.entity_id))),s=this.lay.listedEntityIds().filter(a=>!e.has(a)).join(",");s!==this.extraKey&&!(s===""&&this.extra.size===0)&&this.loadExtra()}customRows(t){const e=this.rowIndex();return(this.lay.customOf(t)?.entities??[]).flatMap(s=>e.has(s)?[e.get(s).row]:[])}displayRows(t){if(t.id!=="sensors")return t.entities;const e=s=>{const a=W.indexOf(s??"other");return a===-1?s&&s!=="other"?W.length:W.length+1:a};return t.entities.map((s,a)=>({r:s,i:a})).sort((s,a)=>e(s.r.group)-e(a.r.group)||(e(s.r.group)===W.length?(s.r.group??"").localeCompare(a.r.group??""):0)||s.i-a.i).map(s=>s.r)}measureCards(){const t=this.renderRoot.querySelector('[data-lay-grid="cards"]');return t?[{el:t,items:[...t.querySelectorAll(":scope > [data-lay-key]")].map(e=>({key:e.dataset.layKey,el:e}))}]:[]}get bulkAllowed(){return D()&&V("devices.control_bulk")&&this.detail?.can_bulk===!0}connectedCallback(){super.connectedCallback(),this.prefsReady=Promise.all([at().then(t=>{this.prefs=t,st(this,t)}),this.loadDesign()]).then(()=>{}),it().then(t=>this.desktopArea=t.desktop_area);try{this.phoneMq=window.matchMedia("(max-width: 599px)"),this.phone=this.phoneMq.matches,this.phoneMq.addEventListener("change",this.onPhone)}catch{this.phoneMq=null}if(D()){if(!V("devices.read")){this.forbidden=!0;return}this.stop=nt(t=>{t.type==="entity_state_changed"?(!this.detail||this.entityIds.has(t.entity.entity_id))&&this.scheduleReload():t.type==="structure_changed"?(this.scheduleReload(),this.structureFlash=!0,window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.structureFlash=!1,ot)):t.type==="ha_sync_state"?(this.sync&&(this.sync={...this.sync,connected:t.connected}),this.scheduleReload()):t.type==="heartbeat"&&(this.sync=t.sync)},t=>{t&&this.scheduleReload()})}}disconnectedCallback(){super.disconnectedCallback(),this.stop?.(),this.stop=null,window.clearTimeout(this.timer),this.timer=0,window.clearInterval(this.presenceTimer),this.presenceTimer=0,this.phoneMq?.removeEventListener("change",this.onPhone)}async loadDesign(){let t="tiles";if(D())try{t=(await rt())["devices.area_design"]}catch{}this.installationDesign=ze(t,null,!1),this.applyDesign()}get mayPersonalize(){return D()&&lt(xt)}personalDesign(){try{return localStorage.getItem(le)}catch{return null}}applyDesign(){this.design=ze(this.installationDesign,this.personalDesign(),this.mayPersonalize),this.setAttribute("data-area-design",this.design)}setPersonalDesign(t){try{t?localStorage.setItem(le,t):localStorage.removeItem(le)}catch{}this.applyDesign()}get entityIds(){return this.detail?new Set([...F.flatMap(t=>this.detail.cards[t].entities.map(e=>e.entity_id)),...this.extra.keys()]):new Set}async loadExtra(){const t=this.detail;if(!t)return;const e=new Set(F.flatMap(n=>t.cards[n].entities.map(r=>r.entity_id))),s=this.lay.listedEntityIds().filter(n=>!e.has(n)),a=s.join(",");if(!s.length){this.extra.size&&(this.extra=new Map),this.extraKey="";return}try{const n=await dt(s);this.extra=new Map(n.entities.map(r=>[r.entity_id,r])),this.extraKey=a}catch{this.extraKey=a}}willUpdate(t){t.has("areaId")&&D()&&!this.forbidden&&(this.lay.load(),this.detail=null,this.presence=null,this.notFound=!1,this.error="",this.load())}scheduleReload(){this.timer||(this.timer=window.setTimeout(()=>{this.timer=0,this.load()},ct))}async load(){if(!this.areaId)return;if(this.loading){this.loadAgain=!0;return}this.loading=!0;const t=this.areaId;try{const[e,s]=await Promise.all([pt(t),this.readPresence(t),this.prefsReady]);if(t!==this.areaId)return;s!==void 0&&(this.presence=s),this.detail=e,this.sync=e.sync,this.error="",this.notFound=!1,this.loadExtra()}catch(e){e instanceof Ae&&e.status===403?this.forbidden=!0:e instanceof Ae&&e.status===404?this.notFound=!0:this.error=X(e)}finally{this.loading=!1,this.loadAgain&&(this.loadAgain=!1,this.load())}}presenceMayRead(){return D()&&(V("presence.building.view")||V("presence.view"))}async readPresence(t){if(!this.presenceMayRead())return null;try{const e=await ut(t);return this.syncPresencePoll(e.line),e}catch{return}}syncPresencePoll(t){if(!t){window.clearInterval(this.presenceTimer),this.presenceTimer=0;return}this.presenceTimer||(this.presenceTimer=window.setInterval(()=>{if(document.hidden||!this.areaId||!this.isConnected)return;const e=this.areaId;this.readPresence(e).then(s=>{s!==void 0&&e===this.areaId&&(this.presence=s)})},ht))}renderPresenceLine(){const t=vt(this.presence);if(!t.show)return l;const e=t.names.length?i`${t.names.map((s,a)=>i`${a?", ":""}<bdi>${s}</bdi>`)}${t.rest>0?` ${de.andMore(t.rest)}`:""}`:t.people;return i`<div class="pres-line" data-area-presence data-tone=${t.tone} role="status" aria-label=${de.areaLineAria} title=${t.title}>
      <sw-icon name="users" size=${15}></sw-icon><span class="pres-lbl">${de.areaLineLabel}</span>
      ${t.room?i`<span class="pres-sep" aria-hidden="true">·</span><b data-area-presence-room>${t.room}</b>`:l}
      ${t.people?i`<span class="pres-sep" aria-hidden="true">·</span><span class="pres-who" data-area-presence-people>${e}</span>`:l}
    </div>`}render(){const t="חשמל והתקנים";if(!D())return i`<sw-page heading="אזור" subheading="חשמל והתקנים · נתוני הדגמה" backHref="/devices/building" crumbs=${`${t} | אזור`}><sw-state-panel icon="home" state="empty" heading="מסך האזור עובד מול השרת" hint="במצב הדגמה אין אזורים להצגה; עץ המבנה מציג נתוני הדגמה."></sw-state-panel></sw-page>`;if(this.forbidden)return i`<sw-page heading=${t} subheading="אזור" backHref="/devices/building"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בחשמל והתקנים" hint="נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת."></sw-state-panel></sw-page>`;if(this.notFound)return i`<sw-page heading=${t} subheading="אזור" backHref="/devices/building" crumbs=${`${t} | אזור`}><sw-state-panel icon="home" data-devices-state="not_found" state="empty" heading="האזור לא נמצא" hint="האזור אינו קיים, או שאין בו התקנים שבהרשאתך."></sw-state-panel></sw-page>`;const e=this.detail;if(!e)return i`<sw-page heading=${t} subheading="אזור" backHref="/devices/building">${this.error?i`<sw-state-panel data-devices-state="load_error" state="error" heading="לא ניתן לטעון את האזור" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel>`:i`<div class="skeleton" data-devices-state="loading" role="status" aria-label="טוען…" aria-busy="true">
            <div class="skl strip"></div>
            <div class="skl-cards"><div class="skl card"></div><div class="skl card"></div><div class="skl card"></div></div>
          </div>`}</sw-page>`;const s=e.area.floor_name??"",a=`${e.counts.entities} התקנים${e.scoped?" · לפי הקומות שלך":""}`,n=this.sync?.connected??!1,r=F.filter(g=>this.prefs.showSensors||g!=="sensors").map(g=>e.cards[g]),o=r.filter(g=>g.count>0),d=this.lay.gridOn("cards")||this.lay.editing,c=o.filter(g=>!this.lay.isRemoved(`card:${g.id}`)&&(g.id!=="security"||d)),u=this.lay.customKeys(),p=[...o.map(g=>`card:${g.id}`),...u,...this.lay.removedKeys().filter(g=>!o.some(G=>`card:${G.id}`===g))],b=r.some(g=>g.entities.some(G=>G.can_control)),k=this.bulkAllowed,_=this.lay.keysWithPrefix("camera:").filter(g=>gt(this.lay.cameraOf(g)));this.lay.prepare([{id:"cards",keys:[...p,..._]}]);const h=this.lay.tileCard?c.find(g=>this.lay.arranging(`card:${g.id}`)):void 0,O=this.lay.tileCard&&u.includes(this.lay.tileCard)&&this.lay.arranging(this.lay.tileCard)?this.lay.tileCard:"",P=this.skin.bubble;return i`<sw-page heading=${P||e.area.area_id!=="unassigned"?"":w(e.area.name)} subheading=${P?"":a} wide @bulk-request=${this.onBulkRequest}>
      <devices-area-nav slot="crumbs" .areaId=${e.area.area_id} .areaName=${e.area.name} .floorName=${s} .areas=${e.floor_areas}></devices-area-nav>
      <div slot="actions">
        ${e.area.map?i`<sw-button size="sm" variant="ghost" icon="map" data-show-on-map @click=${()=>{location.hash=ce(e.area.map)??location.hash}}>הצג על המפה</sw-button>`:l}
        ${k?i`<devices-bulk-menu scope="area" .targetId=${e.area.area_id} .targetName=${e.area.name} .counts=${e.counts} variant="popover" label="פעולות לאזור" mapHref=${ce(e.area.map)??""} data-bulk-area=${e.area.area_id}></devices-bulk-menu>`:l}
        ${e.counts.alarm&&!P?i`<sw-badge data-area-alarm kind=${Se(e.counts.alarm)} label=${`אזעקה: ${ve[e.counts.alarm]??e.counts.alarm}`}></sw-badge>`:l}
        ${P&&n?l:i`<sw-badge data-devices-sync kind=${n?"live":"stale"} label=${n?"מסונכרן":"לא מסונכרן"}></sw-badge>`}
        ${this.structureFlash?i`<sw-badge data-structure-changed kind="live" label="מבנה עודכן"></sw-badge>`:l}
      </div>
      ${this.error?i`<sw-state-panel compact state="error" heading="הרענון האחרון נכשל" hint=${this.error}></sw-state-panel>`:l}
      ${P?this.renderBubbleHead(e):l}
      ${this.lay.renderBar()}
      ${this.lay.editing?l:this.renderPresenceLine()}
      ${this.lay.editing?l:this.renderSecurityStrip(e)}
      ${this.lay.editing||!e.area.map||!this.prefs.planSurfaces.includes("area")||!D()?l:this.renderPlanCard(e)}
      ${h?this.lay.stage(`card:${h.id}`,this.renderCard(h)):O?this.lay.stage(O,this.renderCustomCard(O)):c.length||u.length||_.length||this.lay.editing&&o.length>0?i`<div class=${x({grid:!0,"lay-grid":this.lay.gridOn("cards")})} data-lay-grid="cards" data-lay-cols=${this.lay.gridCols("cards")} ?data-lay-phone-preview=${this.lay.phonePreview("cards")}>
            ${M(c,g=>g.id,g=>this.lay.wrap(`card:${g.id}`,this.renderCard(g)))}
            ${M(u,g=>g,g=>this.lay.wrap(g,this.renderCustomCard(g)))}
            ${M(_,g=>g,g=>this.lay.wrap(g,this.renderCameraCard(g)))}
          </div>`:i`<sw-state-panel icon="home" data-devices-state="area_empty" state="empty" heading="אין התקנים באזור הזה" hint="התקנים שישויכו לאזור יופיעו כאן."></sw-state-panel>`}
      ${b?l:i`<div class="note" data-readonly-note>תצוגה לקריאה בלבד: מצב ההתקנים כפי שדווח.</div>`}
      ${k?i`<devices-bulk-dialog @bulk-done=${()=>void this.load()}></devices-bulk-dialog>`:l}
      ${this.canAssignArea?this.renderAssignDialog():l}
      ${this.lay.renderPanel()}
      ${P?this.renderBubbleSheet():l}
      ${this.renderQuickSheet(e)}
    </sw-page>`}renderPlanCard(t){const e=t.area.map;return i`<sw-card class="plancard" data-area-plan-card heading="על התוכנית">
      <a slot="actions" class="plan-open" href=${ce(e)??""} data-area-plan-open>למפה המלאה<sw-icon name="chevron" size=${12}></sw-icon></a>
      <explore-floor-map embedded compact .floorId=${e.floor_id} .focusZone=${e.zone_id} @area-open=${s=>this.onPlanAreaOpen(t,s.detail.area_id)}></explore-floor-map>
    </sw-card>`}onPlanAreaOpen(t,e){if(!e||e===t.area.area_id)return;const s=t.floor_areas.find(r=>r.area_id===e);if(!s)return;const a=mt(this.phone,"sheet",this.desktopArea);if(a==="screen"){location.hash=`#/devices/areas/${encodeURIComponent(e)}`;return}const n={area_id:s.area_id,name:s.name,icon:s.icon,floor_id:t.area.floor_id,counts:s.counts,has_camera:!1,can_bulk:t.can_bulk};this.quick={area:n,mode:a}}renderQuickSheet(t){const e=this.quick;return i`<area-quick-sheet data-area-quick=${e?.area.area_id??l} .area=${e?.area??null} .floorName=${t.area.floor_name??""} .mode=${e?.mode??"drawer"} ?open=${!!e}
      ?canBulk=${this.bulkAllowed} @close=${()=>this.quick=null} @area-bulk=${this.onQuickBulk}></area-quick-sheet>`}renderBubbleHead(t){const e=t.counts,s=[e.lights_on?`${f(e.lights_on)} דולקים`:"",e.climate_active+e.heating_active?`${f(e.climate_active+e.heating_active)} מיזוג`:"",e.covers_open?`${f(e.covers_open)} פתוחים`:""].filter(Boolean),a=[s.length?s.join(" · "):`${f(e.entities)} התקנים`,t.area.floor_name??""].filter(Boolean).join(" · "),n=t.cards.sensors.entities.find(o=>o.domain==="sensor"&&o.device_class==="temperature"&&o.available&&o.value!==null&&o.value!==void 0),r=t.counts.alarm;return i`<sw-pill class="bhead" variant="plain" ring-static icon="home" .label=${w(t.area.name)} .state=${a} .hue=${ge(t.area.area_id)} tabindex="-1" data-area-head=${t.area.area_id}>
      ${n?i`<span slot="subs" class="chip plain" data-area-temperature title=${w(n.name)}><sw-icon name="thermometer" size=${14}></sw-icon>${q(n.value)}</span>`:l}
      ${r?i`<a slot="subs" class="chip" href="#/security/alarm" data-area-alarm title="לאזעקה" style="text-decoration:none"><sw-icon name="shield" size=${14}></sw-icon>${ve[r]??r}</a>`:l}
      ${this.bulkAllowed&&(e.lights_on||e.switches_on)?i`<button slot="subs" type="button" class="sb" aria-label="כבה הכל באזור" data-area-all-off @click=${()=>this.openCoverGroupBulk("all_off")}><sw-icon name="power" size=${18}></sw-icon></button>`:l}
    </sw-pill>`}renderBubbleSheet(){const t=this.sheet,e=t?this.rowIndex().get(t.id):void 0,s=e?.row,a=t?.card??e?.card??"sensors";return i`<sw-sheet ?open=${!!s} heading=${s?w(s.name):""} data-device-sheet=${s?.entity_id??""} @close=${()=>this.sheet=null}>
      ${s?i`<sw-pill slot="head" variant="plain" ring-static .icon=${Ie(a)} .label=${w(s.name)} .state=${v(s)} .hue=${ge(s.entity_id)} ?on=${s.active&&s.available} fill-color=${a==="lighting"?"var(--sw-lit)":a==="climate"||a==="heating"?a==="heating"?"var(--sw-heat)":"var(--sw-cool)":"var(--sw-accent-soft)"} tabindex="-1" data-sheet-head></sw-pill>${Tt(this.bubbleHost,s,a)}`:l}
    </sw-sheet>`}renderBubbleSection(t,e,s){const a=this.lay.item(e),n=this.phone&&!this.lay.editing&&this.folded(e,t.id==="sensors"),r=Ce[t.id]&&this.bulkAllowed&&t.count&&!this.lay.arranging(e)?i`<span class="sec-bulk" data-section-bulk=${t.id} data-bulk-look=${this.lay.bulkLookOf(e)}>${Ee(t.id,t.entities).map(o=>i`<button type="button" class="sb" aria-label=${`${o.label} · ${t.label}`} title=${o.label} data-section-bulk-kind=${o.kind} @click=${()=>this.openCoverGroupBulk(o.kind)}><sw-icon .name=${o.icon} size=${18}></sw-icon></button>`)}</span>`:l;return i`${Be({id:t.id,icon:a?.icon??Ie(t.id),label:te(a,t.label),count:t.count?`${f(t.count)}`:"",fold:this.phone&&!this.lay.editing?{open:!n,toggle:()=>this.fold(e,!n)}:null,actions:r})}
      ${n?l:s}`}renderCameraCard(t){const e=this.lay.item(t);return i`<sw-card flush data-camera-card=${t} data-lay-key=${t}>
      <devices-camera-card .source=${this.lay.cameraOf(t)??null} .title=${e?.title??""} .quality=${this.lay.qualityOf(t)} ?showQuality=${this.lay.editing} ?fill=${this.lay.gridOn("cards")}></devices-camera-card>
    </sw-card>`}renderCard(t){const e=bt[t.id],s=this.lay.item(`card:${t.id}`),a=Oe(s,t.entities),n=t.count?this.lay.tiles(`card:${t.id}`,this.displayRows(t).map(c=>c.entity_id)):null,r=`card:${t.id}`,o=this.skin.bubble,d=t.count===0?i`<sw-state-panel icon="home" compact data-card-empty state="empty" heading=${e.heading} hint=${e.hint}></sw-state-panel>`:n?this.renderArranged(t,n):a.length?t.id==="media"&&this.mediaHook?this.renderMedia(r,null,a):t.id==="sensors"?this.renderSensorsSection(r,a):o?i`${t.id==="covers"?this.renderCoverGroupControl():l}<div class="bgrid" data-bubble-grid=${t.id}>${M(a,c=>c.entity_id,c=>Y(this.bubbleHost,c,t.id))}</div>`:t.id==="lighting"||t.id==="switches"?i`<div class="tiles">${M(a,c=>c.entity_id,c=>this.renderTile(c,t.id))}</div>`:i`${t.id==="covers"?this.renderCoverGroupControl():l}<div class="rows">${M(a,c=>c.entity_id,c=>this.renderRow(c,t.id))}</div>`:i`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`;return o?i`<sw-card data-card=${t.id} data-lay-key=${r} ?data-empty=${t.count===0} data-bubble-card>${this.renderBubbleSection(t,r,d)}</sw-card>`:i`<sw-card data-card=${t.id} data-lay-key=${r} ?data-empty=${t.count===0} ?row=${this.rowSections&&t.id!=="sensors"&&t.id!=="media"} ?collapsible=${this.phone&&!this.lay.editing} ?collapsed=${this.phone&&!this.lay.editing&&this.folded(r,t.id==="sensors")} @sw-card-toggle=${c=>this.fold(r,c.detail.collapsed)} heading=${te(s,t.label)} subheading=${t.count?`${t.count===1?"התקן אחד":`${t.count} התקנים`}${t.id==="lighting"||t.id==="switches"||t.id==="climate"||t.id==="heating"||t.id==="covers"||t.id==="media"?` · ${t.active===1?"אחד פעיל":`${t.active} פעילים`}`:""}`:""}>
      ${this.renderSectionBulk(t,r)}
      <sw-icon slot="actions" .name=${s?.icon??Kt[t.id]} size=${18}></sw-icon>
      ${d}
    </sw-card>`}get rowSections(){return this.design==="sections"&&!this.phone&&!this.lay.gridOn("cards")}folded(t,e){return this.foldState.has(t)?this.foldState.get(t):e}fold(t,e){this.foldState=new Map(this.foldState).set(t,e)}renderSectionBulk(t,e){if(!Ce[t.id]||!this.bulkAllowed||!t.count||this.lay.arranging(e))return l;const s=Ee(t.id,t.entities),a=this.lay.bulkLookOf(e);return i`<span slot="actions" class="sec-bulk" data-section-bulk=${t.id} data-bulk-look=${a}>${s.map(n=>a==="icon"?i`<sw-button size="sm" iconOnly icon=${n.icon} label=${n.label} data-section-bulk-kind=${n.kind} @click=${()=>this.openCoverGroupBulk(n.kind)}></sw-button>`:i`<sw-button size="sm" icon=${a==="both"?n.icon:void 0} data-section-bulk-kind=${n.kind} @click=${()=>this.openCoverGroupBulk(n.kind)}>${n.label}</sw-button>`)}</span>`}renderSecurityStrip(t){const e=t.cards.security.entities;if(!e.length)return l;const s=a=>{const n=!a.available||a.state==="unavailable",r=a.kind==="lock"?a.locked?"lock":"unlock":a.kind==="alarm"?"shield":a.kind==="camera"?"camera":"door",o=n?"off":a.kind==="lock"?a.locked?"ok":"warn":a.kind==="alarm"?a.state==="triggered"?"bad":a.armed?"ok":"warn":a.kind==="camera"?"ok":a.state==="on"?"warn":"ok",d=a.kind==="camera"?"מקוון":v(a),c=i`<sw-icon .name=${r} size=${14}></sw-icon><b title=${a.name}>${w(a.name)}</b><span>${d}</span>`;return a.kind==="alarm"?i`<a class="sec-chip ${o}" href="#/security/alarm" data-sec-chip=${a.entity_id} title="לאזעקה">${c}</a>`:i`<span class="sec-chip ${o}" data-sec-chip=${a.entity_id}>${c}</span>`};return i`<div class="sec-strip" data-security-strip role="group" aria-label="אבטחה"><span class="sec-lbl"><sw-icon name="shield" size=${15}></sw-icon>אבטחה</span>${e.map(s)}</div>`}renderSensorsSection(t,e){const s=this.rowIndex(),a=new Map([...s].map(([p,b])=>[p,b.row])),n=[...s.values()].filter(p=>!this.extra.has(p.row.entity_id)).map(p=>p.row),{rows:r}=wt(this.lay.mainOf(t),a,n),o=new Set(r.map(p=>p.entity_id)),d=e.filter(p=>!o.has(p.entity_id));if(!r.length)return this.renderSensorGroups(e);const c=this.sensOpen.has(t),u=()=>{const p=new Set(this.sensOpen);c?p.delete(t):p.add(t),this.sensOpen=p};return this.skin.bubble?i`<div class="kv" data-main-sensors>${r.map(p=>Re(p,pe(p)))}</div>
        ${d.length?i`<button type="button" class="bmore" data-sensors-more aria-expanded=${String(c)} @click=${u}>${c?"הסתר חיישנים":`עוד ${d.length} חיישנים`}</button>${c?this.renderSensorGroups(d):l}`:l}`:i`<div class="main-sensors" data-main-sensors>${r.map(p=>this.renderMainSensor(p))}</div>
      ${d.length?i`<button type="button" class="more-sens" data-sensors-more aria-expanded=${String(c)} @click=${u}>${c?"הסתר חיישנים":`עוד ${d.length} חיישנים`}</button>${c?this.renderSensorGroups(d):l}`:l}`}renderMainSensor(t){if(this.skin.bubble)return Re(t,pe(t));const e=pe(t),s=e==="temperature"||e==="humidity"?"sensor":e==="motion"?"activity":e==="door"?"door":"sensor",a=!t.available||t.state==="unavailable",n=a?"לא זמין":t.domain==="sensor"&&t.value!==null&&t.value!==void 0?`${f(Number.isInteger(t.value)?t.value:t.value.toFixed(1))}${t.unit?t.unit.startsWith("°")||t.unit==="%"?t.unit:` ${t.unit}`:""}`:v(t);return i`<div class=${x({msens:!0,unavailable:a,hot:t.domain==="binary_sensor"&&t.state==="on"})} data-main-sensor=${t.entity_id} data-slot=${e??""} title=${C(t)}>
      <sw-icon .name=${s} size=${16}></sw-icon><div class="mv"><b>${n}</b><span>${w(t.name)}</span></div>
    </div>`}renderDesignPersonal(){if(!this.mayPersonalize)return l;const t=this.personalDesign();return i`<span class="design-personal" data-design-personal><label>כיוון תצוגה (רק אצלי)
      <select data-design-personal-select @change=${e=>this.setPersonalDesign(e.target.value)}>
        <option value="" ?selected=${!t}>ברירת המערכת · ${Pe[this.installationDesign]}</option>
        ${ft.map(e=>i`<option value=${e} ?selected=${t===e}>${Pe[e]}</option>`)}
      </select></label></span>`}renderArranged(t,e,s){if(!e.length)return i`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`;const a=s?.key??`card:${t.id}`,n=new Map(t.entities.map(r=>[r.entity_id,r]));return i`${!s&&t.id==="covers"&&!this.lay.arranging(a)?this.renderCoverGroupControl():l}<div class="tiles lay-tgrid" data-lay-tiles=${s?a:t.id}>${M(e,r=>r.id,(r,o)=>{const d=n.get(r.id),c=r.t.title?{...d,name:r.t.title}:d,u=s?s.cardOf(r.id):t.id;return this.lay.wrapTile(a,r,o,e.length,se.has(u)?this.renderTile(c,u):this.renderRow(c,u))})}</div>`}get mediaHook(){return!D()||V("media.read")}isScreenRow(t,e,s){return t.domain!=="media_player"?!1:t.device_class==="speaker"||t.device_class==="receiver"?s:e}renderMedia(t,e,s){const a=this.detail,n=this.mediaCount.get(t),r=n===void 0?[]:s.filter(c=>!this.isScreenRow(c,n.n>0,n.p>0)),o=this.lay.bulkLookOf(t),d=()=>this.renderRoot.querySelector(`media-area-card[data-media-card="${t}"]`)?.ask();return i`${n?.off&&!this.lay.arranging(t)?i`<span slot="actions" class="sec-bulk" data-section-bulk="media" data-bulk-look=${o}>${o==="icon"?i`<sw-button size="sm" iconOnly icon="power" label="כבה הכל" data-section-bulk-kind="screens_off" @click=${d}></sw-button>`:i`<sw-button size="sm" icon=${o==="both"?"power":void 0} data-section-bulk-kind="screens_off" @click=${d}>כבה הכל</sw-button>`}</span>`:l}
      <media-area-card external data-media-card=${t} .areaId=${a.area.area_id} .areaName=${a.area.name} .entityIds=${e}
        @media-area-state=${c=>{const u=c.detail.players??0;n?.n===c.detail.screens&&n.p===u&&n.off===c.detail.canOff||(this.mediaCount=new Map(this.mediaCount).set(t,{n:c.detail.screens,p:u,off:c.detail.canOff}))}}></media-area-card>
      ${r.length?i`<div class="rows">${M(r,c=>c.entity_id,c=>this.renderRow(c,"media"))}</div>`:l}`}renderCustomCard(t){const e=this.lay.customOf(t);if(!e||!Me(e.type))return i``;const s=_e[e.type],a=this.lay.item(t),n=this.rowIndex(),r=h=>n.get(h)?.card??"sensors",o=Oe(a,this.customRows(t)),d=this.customRows(t),c={id:"sensors",label:s.label,entities:d,count:d.length,active:d.filter(h=>h.active).length},u=d.length?this.lay.tiles(t,d.map(h=>h.entity_id)):null,p=o.filter(h=>se.has(r(h.entity_id))),b=o.filter(h=>!se.has(r(h.entity_id))),k=this.skin.bubble,_=d.length?u?this.renderArranged(c,u,{key:t,cardOf:r}):o.length?e.type==="media"&&this.mediaHook?this.renderMedia(t,e.entities??null,o):k?i`<div class="bgrid" data-bubble-grid=${e.type}>${M(o,h=>h.entity_id,h=>Y(this.bubbleHost,h,r(h.entity_id)))}</div>`:i`${p.length?i`<div class="tiles">${M(p,h=>h.entity_id,h=>this.renderTile(h,r(h.entity_id)))}</div>`:l}${b.length?i`<div class="rows">${M(b,h=>h.entity_id,h=>this.renderRow(h,r(h.entity_id)))}</div>`:l}`:i`<div class="count" data-card-all-hidden>כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.</div>`:i`<div class="count" data-card-empty>אין בכרטיס התקנים. בחרו התקנים בחלונית המאפיינים של הכרטיס.</div>`;if(k){const h={...c,id:Me(e.type)&&F.includes(e.type)?e.type:"sensors",label:te(a,s.label)};return i`<sw-card data-custom-card=${t.slice(5)} data-card-type=${e.type} data-lay-key=${t} ?data-empty=${d.length===0} data-bubble-card>${Be({id:h.id,icon:a?.icon??s.icon,label:h.label,count:d.length?`${f(d.length)}`:""})}${_}</sw-card>`}return i`<sw-card data-custom-card=${t.slice(5)} data-card-type=${e.type} data-lay-key=${t} ?data-empty=${d.length===0} heading=${te(a,s.label)} subheading=${d.length?d.length===1?"התקן אחד":`${d.length} התקנים`:""}>
      <sw-icon slot="actions" .name=${a?.icon??s.icon} size=${18}></sw-icon>
      ${_}
    </sw-card>`}renderSensorGroups(t){const e=new Map;for(const a of t){const n=a.group??"other",r=e.get(n);r?r.push(a):e.set(n,[a])}const s=[...e.keys()].sort((a,n)=>{const r=W.indexOf(a),o=W.indexOf(n);return r===-1&&o===-1?a==="other"?1:n==="other"?-1:a.localeCompare(n):r===-1?1:o===-1?-1:r-o});return this.skin.bubble?i`<div class="sensor-groups">${s.map(a=>i`<div class="sensor-group" data-sensor-group=${a}>
        <div class="bsh">${he[a]??a}</div>
        <div class="bgrid" data-bubble-grid="sensors">${M(e.get(a),n=>n.entity_id,n=>Y(this.bubbleHost,n,"sensors"))}</div>
      </div>`)}</div>`:i`<div class="sensor-groups">${s.map(a=>i`<div class="sensor-group" data-sensor-group=${a}>
      <div class="sensor-group-label">${he[a]??a}</div>
      <div class="tiles">${M(e.get(a),n=>n.entity_id,n=>this.renderTile(n,"sensors"))}</div>
    </div>`)}</div>`}renderTile(t,e){if(this.skin.bubble)return Y(this.bubbleHost,t,e);const s=t.can_control&&t.available&&t.state!=="unavailable"&&(e==="lighting"||e==="switches")&&!me.has(t.domain),a=s?this.ctl.shownRow(t):t,n=!a.available||a.state==="unavailable",r=e==="lighting"?"light":e==="switches"?"bolt":"sensor",o=e==="sensors"?a.domain==="sensor"?a.value!==null&&a.value!==void 0?`${f(Number.isInteger(a.value)?a.value:a.value.toFixed(1))}${a.unit?` ${a.unit}`:""}`:a.state??"—":v(a):v(a),d=a.active&&!n;return i`<div class=${x({tile:!0,on:d,off:!d&&!n,unavailable:n,pending:s&&this.ctl.rowPendingVisible(a.entity_id)})} data-entity=${a.entity_id} data-activity=${I(R(a,v(a)))} data-active=${String(d)} data-reported=${String(t.active&&!n)} ?data-can-control=${s} title=${C(a)}>
      <div class="t"><sw-icon .name=${r} size=${15}></sw-icon><span>${w(a.name)}</span>${s?this.ctl.renderPowerToggle(a):l}</div>
      <div class="s">${n?"לא זמין":o}</div>
      ${e==="sensors"&&a.last_changed?i`<div class="lc" data-last-changed>${Ne(a.last_changed)}</div>`:l}
      ${s&&e==="lighting"&&be(a)&&(d||this.ctl.live(a.entity_id,"power")===!0)?this.ctl.renderBrightnessSlider(a):l}
      ${s?this.ctl.renderCmdStatus(a.entity_id):l}
      ${a.alarm_managed?i`<div class="managed-note" data-alarm-managed>${a.managed_label??"נשלט ממסך האזעקה"} · <a href="#/security/alarm">לאזעקה</a></div>`:l}
      ${this.renderAssignButton(a)}
    </div>`}coverLabel(t){return t.door_class?Nt[t.device_class??""]??"דלת / שער":Gt[t.device_class??""]??"תריס"}get coverGroupAllowed(){return this.bulkAllowed&&(this.detail?.counts.covers??0)>0}openCoverGroupBulk(t,e){const s=this.detail;s&&this.renderRoot.querySelector("devices-bulk-dialog")?.show({scope:"area",id:s.area.area_id,name:s.area.name,kind:t,position:e})}renderCoverGroupControl(){if(!this.coverGroupAllowed)return l;if(this.skin.bubble){const e=this.coverGroupPosition;return i`<sw-pill class="bgroup" variant="slider" icon="layers" label="כל התריסים" .state=${`מיקום לכולם · ${f(e)}%`} .value=${e/100} on fill-color="var(--sw-accent-soft)" keep-text data-cover-group
        @input=${s=>this.coverGroupPosition=Math.round(s.detail.value*100)} @toggle=${()=>this.coverGroupPosition=e>0?0:100}>
        <button slot="subs" type="button" class="sb" aria-label="פתח הכל" data-cover-group-kind="covers_open" @click=${()=>this.openCoverGroupBulk("covers_open")}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="sb" aria-label="עצור הכל" data-cover-group-kind="covers_stop" @click=${()=>this.openCoverGroupBulk("covers_stop")}><sw-icon name="pause" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="sb" aria-label="סגור הכל" data-cover-group-kind="covers_close" @click=${()=>this.openCoverGroupBulk("covers_close")}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="chip on" data-cover-group-kind="covers_position" @click=${()=>this.openCoverGroupBulk("covers_position",this.coverGroupPosition)}>${`קבע ${f(e)}%`}</button>
      </sw-pill>`}const t=e=>this.coverGroupPosition=Number(e.target.value);return i`<div class="cover-group" data-cover-group>
      <span class="lbl">כל התריסים:</span>
      <sw-button size="sm" data-cover-group-kind="covers_open" @click=${()=>this.openCoverGroupBulk("covers_open")}>פתח הכל</sw-button>
      <sw-button size="sm" data-cover-group-kind="covers_stop" @click=${()=>this.openCoverGroupBulk("covers_stop")}>עצור הכל</sw-button>
      <sw-button size="sm" data-cover-group-kind="covers_close" @click=${()=>this.openCoverGroupBulk("covers_close")}>סגור הכל</sw-button>
      <input type="range" data-cover-group-position-input min="0" max="100" .value=${String(this.coverGroupPosition)} @input=${t} @click=${e=>e.stopPropagation()} aria-label="מיקום לכל התריסים" />
      <span class="ctl-val">${f(this.coverGroupPosition)}%</span>
      <sw-button size="sm" variant="primary" data-cover-group-kind="covers_position" @click=${()=>this.openCoverGroupBulk("covers_position",this.coverGroupPosition)}>קבע מיקום לכולם</sw-button>
    </div>`}get canAssignArea(){return this.detail?.area.area_id==="unassigned"&&this.detail?.can_assign_area===!0}renderAssignButton(t){return this.canAssignArea?i`<sw-button class="assign-btn" size="sm" variant="ghost" data-assign-entity=${t.entity_id} @click=${e=>{e.stopPropagation(),this.openAssign(t)}}>שייך לאזור</sw-button>`:l}async openAssign(t){if(this.assigning=t,this.assignTarget="",this.assignError="",this.assignBusy=!1,!this.assignAreas)try{const e=await De();this.assignAreas=this.flattenAreas(e)}catch(e){this.assignError=X(e)}}flattenAreas(t){return t.floors.flatMap(e=>e.areas.map(s=>({area_id:s.area_id,name:s.name,floor_name:e.floor_id==="none"?null:e.name})))}async confirmAssign(){const t=this.assigning;if(!(!t||!this.assignTarget||this.assignBusy)){this.assignBusy=!0,this.assignError="";try{await $t(t.entity_id,this.assignTarget),this.assigning=null,this.load()}catch(e){this.assignError=X(e)}finally{this.assignBusy=!1}}}renderAssignDialog(){const t=this.assigning;return t?i`<sw-dialog open data-assign-dialog="open" heading="שיוך לאזור" subheading=${w(t.name)} @close=${this.closeAssign}>
      ${this.assignError?i`<div class="assign-err" data-assign-error>${this.assignError}</div>`:l}
      ${this.assignAreas===null?i`<div class="assign-muted">טוען אזורים…</div>`:i`<select class="assign-select" data-assign-select aria-label="אזור" @change=${e=>this.assignTarget=e.target.value}>
            <option value="" ?selected=${!this.assignTarget} disabled>בחרו אזור</option>
            ${this.assignAreas.map(e=>i`<option value=${e.area_id} ?selected=${e.area_id===this.assignTarget}>${w(e.name)}${e.floor_name?` · ${w(e.floor_name)}`:""}</option>`)}
          </select>`}
      <div class="assign-actions">
        <sw-button data-assign-cancel autofocus @click=${this.closeAssign}>ביטול</sw-button>
        <sw-button data-assign-confirm variant="primary" ?disabled=${!this.assignTarget||this.assignBusy} @click=${()=>void this.confirmAssign()}>שייך</sw-button>
      </div>
    </sw-dialog>`:i`<sw-dialog data-assign-dialog="closed"></sw-dialog>`}renderRow(t,e){if(this.skin.bubble)return Y(this.bubbleHost,t,e);const s=t.can_control&&t.available&&t.state!=="unavailable"&&(e==="climate"||e==="heating"||e==="covers"||e==="media"),a=t,n=!a.available||a.state==="unavailable",r=a.active&&!n,o=s&&this.ctl.rowPendingVisible(a.entity_id);if(e==="climate"||e==="heating"){const d=a.domain==="climate";return i`<div class=${x({row:!0,on:r,unavailable:n,pending:o})} data-entity=${a.entity_id} data-activity=${I(R(a,v(a)))} data-active=${String(a.active)} ?data-can-control=${s} title=${C(a)}>
        <span class="n">${w(a.name)}</span>
        <span class="v big">${n?"לא זמין":d?q(a.current_temperature):v(a)}</span>
        ${d&&!n?i`<div class="d">
              <span>מצב: ${v(a)}</span>
              ${a.hvac_action?i`<span>${ne[a.hvac_action]??a.hvac_action}</span>`:l}
              ${a.target_temperature!==null&&a.target_temperature!==void 0?i`<span>יעד ${q(a.target_temperature)}</span>`:l}
              ${a.target_temp_low!==null&&a.target_temp_low!==void 0&&a.target_temp_high!==null&&a.target_temp_high!==void 0?i`<span>טווח ${q(a.target_temp_low)}–${q(a.target_temp_high)}</span>`:l}
              ${a.fan_mode?i`<span>מאוורר: ${ae("fan",a.fan_mode)}</span>`:l}
              ${a.preset_mode?i`<span>מצב מוגדר: ${ae("preset",a.preset_mode)}</span>`:l}
              ${a.swing_mode?i`<span>נדנוד: ${ae("swing",a.swing_mode)}</span>`:l}
              ${a.target_humidity!==null&&a.target_humidity!==void 0?i`<span>לחות יעד ${f(a.target_humidity)}%</span>`:l}
            </div>`:a.domain==="humidifier"&&!n?i`<div class="d">
                ${a.mode?i`<span>מצב: ${ae("hmode",a.mode)}</span>`:l}
                ${a.current_humidity!==null&&a.current_humidity!==void 0?i`<span>לחות ${f(a.current_humidity)}%</span>`:l}
                ${a.target_humidity!==null&&a.target_humidity!==void 0?i`<span>יעד ${f(a.target_humidity)}%</span>`:l}
              </div>`:l}
        ${s?this.ctl.renderClimateControls(a):l}
        ${s?this.ctl.renderCmdStatus(a.entity_id):l}
        ${this.renderAssignButton(a)}
      </div>`}if(e==="covers"){const d=a.door_class?Ht[a.device_class??""]??"lock":"layers";return i`<div class=${x({row:!0,on:r,unavailable:n,pending:o})} data-entity=${a.entity_id} data-activity=${I(R(a,v(a)))} data-active=${String(a.active)} data-door-class=${String(!!a.door_class)} ?data-can-control=${s} title=${C(a)}>
        <span class="n nk">${a.door_class?i`<sw-icon .name=${d} size=${14}></sw-icon>`:l}<span class="nt">${w(a.name)}</span><span class="muted">· ${this.coverLabel(a)}</span></span>
        <span class="v">${v(a)}</span>
        ${a.position!==null&&a.position!==void 0&&!n?i`<div class="bar" role="img" aria-label=${`פתוח ${a.position}%`}><i style=${`inline-size:${a.position}%`}></i></div>`:l}
        ${a.tilt!==null&&a.tilt!==void 0&&!n?i`<div class="d"><span>הטיה ${f(a.tilt)}%</span></div>`:l}
        ${a.door_class?i`<div class="d"><span>דלת / שער - תנועה של מעבר, לקריאה בלבד כאן</span></div>`:l}
        ${s?this.ctl.renderCoverControls(a):l}
        ${s?this.ctl.renderCmdStatus(a.entity_id):l}
        ${this.renderAssignButton(a)}
      </div>`}if(e==="security"){let d;n?d={kind:"offline",label:"לא זמין"}:a.kind==="lock"?d=a.locked?{kind:"live",label:"נעול"}:{kind:"stale",label:v(a)}:a.kind==="alarm"?d={kind:Se(a.state),label:v(a)}:a.kind==="camera"?d={kind:"neutral",label:"מצלמת התקן"}:d={kind:a.state==="on"?"stale":"neutral",label:v(a)};const c=a.kind==="lock"?a.locked?"lock":"unlock":a.kind==="alarm"?"shield":a.kind==="camera"?"camera":"sensor";return i`<div class=${x({row:!0,unavailable:n})} data-entity=${a.entity_id} data-activity=${I(R(a,v(a)))} data-kind=${a.kind??""} title=${C(a)}>
        <span class="n"><sw-icon .name=${c} size=${14}></sw-icon> ${w(a.name)}</span>
        <sw-badge kind=${d.kind} label=${d.label}></sw-badge>
        ${a.kind==="camera"?i`<div class="d"><span>אין תמונה ממצלמת התקן במסך הזה עדיין; מצלמות ה־NVR מוצגות ב"מצלמות".</span></div>`:l}
        ${this.renderAssignButton(a)}
      </div>`}return i`<div class=${x({row:!0,on:r,unavailable:n,pending:o})} data-entity=${a.entity_id} data-activity=${I(R(a,v(a)))} data-active=${String(a.active)} ?data-can-control=${s} title=${C(a)}>
      <span class="n"><sw-icon name="play" size=${14}></sw-icon> ${w(a.name)}</span>
      <span class="v">${v(a)}</span>
      ${!n&&(a.media_title||a.source||a.volume_pct!==null)?i`<div class="d">
            ${a.media_title?i`<span>${a.media_title}</span>`:l}
            ${a.source?i`<span>מקור: ${a.source}</span>`:l}
            ${a.volume_pct!==null&&a.volume_pct!==void 0?i`<span>עוצמה ${f(a.volume_pct)}%${a.muted?" · מושתק":""}</span>`:l}
          </div>`:l}
      ${s?this.ctl.renderMediaControls(a):l}
      ${s?this.ctl.renderCmdStatus(a.entity_id):l}
      ${this.renderAssignButton(a)}
    </div>`}};$.styles=[yt,kt,j`
    /* K88: the live plan card */
    .plancard {
      display: block;
      margin-block-end: 16px;
    }
    .plancard explore-floor-map {
      display: flex;
      block-size: 360px;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      border: 1px solid var(--sw-border);
    }
    .plancard .plan-open {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-accent-text, var(--sw-accent));
      font-size: var(--sw-fs-sm);
      text-decoration: none;
    }
    @media (max-width: 767px) {
      .plancard explore-floor-map {
        block-size: 300px;
      }
    }
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
      align-items: start;
    }
    sw-card[data-empty] {
      background: var(--sw-surface-2);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .sensor-groups {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sensor-group-label {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      margin-block-end: 4px;
    }
    .tile .lc {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    /* HOMEFABLE-297 (impeccable bolder; craft floor "nested cards are always wrong"): a device inside a section card is a WELL - a tone
       step down, rounded, no hairline - and a device that is on is a solid lit field with the heading ink; the section card above it
       keeps the only outline on the screen */
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid transparent;
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .tile.on {
      background: var(--sw-lit-soft);
      border-color: transparent;
    }
    .tile.on .t {
      color: var(--sw-heading);
    }
    /* HOME polish (2026-10-10): a device's state change fades in (the warm fill, the icon); still under reduced motion */
    @media (prefers-reduced-motion: no-preference) {
      .tile,
      .row,
      .msens,
      .tile .t sw-icon,
      .sec-chip {
        transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), color var(--sw-t-state) var(--sw-ease), opacity var(--sw-t-state) var(--sw-ease);
      }
    }
    .tile .t sw-icon {
      color: var(--sw-text-2);
    }
    .tile.off {
      color: var(--sw-text-2);
    }
    .tile.unavailable,
    .row.unavailable {
      opacity: 0.6;
    }
    .tile .t {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .tile .t span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tile.on .t sw-icon {
      color: var(--sw-warning);
    }
    .tile .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 9px 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid transparent;
      background: var(--sw-surface-2);
    }
    .row.on {
      border-color: transparent;
      background: var(--sw-lit-soft);
    }
    .row .n {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-base);
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .v {
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      text-align: end;
    }
    .row .v.big {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--sw-heading);
    }
    .row .d {
      grid-column: 1 / -1;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      min-inline-size: 0;
      /* WIDGETBREAK-297: a long media title or source wraps inside the row, an unbreakable one breaks at the card edge */
      overflow-wrap: anywhere;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .bar {
      grid-column: 1 / -1;
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      border-radius: 3px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* ---- the loading skeleton (HOME polish 2026-10-10): the strip and three section cards in the screen's own shape ---- */
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .skl {
      position: relative;
      overflow: hidden;
      border-radius: var(--sw-r-md);
      background: var(--sw-skeleton);
    }
    .skl::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, var(--sw-skeleton-shine), transparent);
    }
    @media (prefers-reduced-motion: no-preference) {
      .skl::after {
        animation: skl-shine 1.4s var(--sw-ease) infinite;
      }
    }
    @keyframes skl-shine {
      to {
        transform: translateX(100%);
      }
    }
    .skl.strip {
      block-size: 44px;
    }
    .skl-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
    }
    .skl-cards .card {
      block-size: 200px;
    }
    .row .n .muted {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular, normal);
      color: var(--sw-text-3);
    }
    /* WORSTCASE-2310: a cover's row is its name and its kind ("· תריס"). Both used to run in one ellipsis line, so a long name pushed the
       kind past the card edge (the guard saw it 26-29 px outside the card in domus and classic dark). The name now takes what is left
       and ends in an ellipsis (the row's title has the whole name); the kind is short and always stays visible at the end */
    .row .n.nk {
      display: flex;
      align-items: baseline;
      gap: 4px;
      min-inline-size: 0;
    }
    .row .n.nk > sw-icon {
      flex: none;
      align-self: center;
    }
    .row .n.nk .nt {
      flex: 0 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .n.nk .muted {
      flex: none;
      white-space: nowrap;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .managed-note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: normal;
    }
    /* CR-007 slice 4: the covers card's own "כל התריסים" group control */
    .cover-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 10px;
      margin-block-end: 6px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface-2);
    }
    .cover-group .lbl {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    .cover-group input[type='range'] {
      flex: 1;
      min-inline-size: 80px;
      accent-color: var(--sw-accent);
    }
    /* CR-007 slice 4: assign an unassigned entity to an area */
    .assign-btn {
      grid-column: 1 / -1;
    }
    .assign-select {
      inline-size: 100%;
      font: inherit;
      font-size: var(--sw-fs-sm);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      padding: 6px 8px;
    }
    .assign-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 10px;
      margin-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    .assign-err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .assign-muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    /* owner 2026-09-30: a camera card is the picture edge to edge (the glass style's card padding does not apply to it) */
    :host sw-card[data-camera-card] {
      padding: 0 !important;
      overflow: hidden;
    }
    .lay-item > sw-card[data-camera-card] {
      display: flex;
      flex-direction: column;
    }
    .lay-item > sw-card[data-camera-card] > devices-camera-card {
      flex: 1 1 auto;
    }
  `,Ft,jt,Bt];y([S()],$.prototype,"areaId",2);y([m()],$.prototype,"detail",2);y([m()],$.prototype,"error",2);y([m()],$.prototype,"forbidden",2);y([m()],$.prototype,"notFound",2);y([m()],$.prototype,"sync",2);y([m()],$.prototype,"structureFlash",2);y([m()],$.prototype,"coverGroupPosition",2);y([m()],$.prototype,"assigning",2);y([m()],$.prototype,"assignAreas",2);y([m()],$.prototype,"assignTarget",2);y([m()],$.prototype,"assignBusy",2);y([m()],$.prototype,"assignError",2);y([m()],$.prototype,"prefs",2);y([m()],$.prototype,"design",2);y([m()],$.prototype,"installationDesign",2);y([m()],$.prototype,"extra",2);y([m()],$.prototype,"mediaCount",2);y([m()],$.prototype,"sensOpen",2);y([m()],$.prototype,"foldState",2);y([m()],$.prototype,"phone",2);y([m()],$.prototype,"sheet",2);y([m()],$.prototype,"quick",2);y([m()],$.prototype,"desktopArea",2);y([m()],$.prototype,"presence",2);$=y([J("devices-area")],$);export{$ as DevicesArea,v as rowLabel};
//# sourceMappingURL=devices-area-igvdbFwt.js.map
