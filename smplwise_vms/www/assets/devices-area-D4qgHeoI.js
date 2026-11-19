import{g as j,ay as C,j as w,i as J,en as Ke,lG as De,ck as s,Y as ne,A as d,a7 as f,b as n,k as ee,e1 as je,a3 as D,a4 as Y,iE as te,cP as $e,dT as Ue,k2 as ye,iD as xe,cZ as ke,n as Z,i0 as We,dc as Ve,j$ as Ye,pQ as Qe,k0 as Xe,bc as M,gr as Te,cs as z,iw as be,cq as m,cr as we,as as x,pR as Le,iv as N,pS as oe,cp as ge,pT as me,ct as B,cu as I,jo as E,ex as Ze,pU as Ne,aS as Ge,cl as Je,cm as et,pV as tt,aL as at,pW as st,pX as _e,pY as ze,pZ as it,p_ as nt,p$ as U,q0 as ot,q1 as rt,ii as lt,aN as dt,p as ct,q2 as Se,aB as pt,q3 as de,q4 as ut,q5 as ht,ih as vt,a as Ae,ig as gt,ie as mt,q6 as bt,iu as ce,q7 as wt,lt as pe,q8 as Ce,q9 as ft,qa as Ee,qb as Oe,qc as ae,qd as $t,qe as Pe,qf as yt,qg as ue,qh as Re,qi as xt,qj as Me,qk as kt,ql as se,qm as _t,cx as zt,qn as St,qo as At}from"./index-DJHEuoub.js";import"./sw-chip-yB9ry-O_.js";import"./sw-pager-DakjKGlb.js";import"./media-player-card-DoyPxUSe.js";import"./media-screen-card-CZ8IUN4A.js";import"./media-group-dialog-BbwmOZkW.js";import"./explore-floor-map-OH2B1YGO.js";import"./area-quick-sheet-Rft5KFKe.js";import{L as Ct}from"./long-lists-C1pXF1Lz.js";import"./sw-logo-art-MaHPMZFI.js";import"./media-now-CC6fBhTh.js";import"./multimedia-players-layout-BB2FelZ5.js";import"./lead-reserve-BI3si4Ta.js";import"./demo-3d-BW-wdmix.js";import"./sw-plan-canvas-CjQUUYAH.js";import"./map-BSAdvTQ5.js";import"./shared-space-CKuDIAAl.js";import"./zones-e9UW_q16.js";import"./candidates-C7MOPmaK.js";import"./views-QMhDFEpQ.js";import"./geometry-Dt4Eeb6r.js";import"./state-facts-znZ675OD.js";import"./plan-catalog-Bktb0q0b.js";import"./floor-view-shared-CCW4QCCO.js";import"./webgl-Cg07RNXj.js";import"./quality-ladder-sKg6FDpr.js";import"./scene-builder-Cu5ORt4x.js";import"./material-resolve-D0nDdkyx.js";import"./quality-mode-DdBaTZdp.js";import"./plan-change-key-DCdXAOMQ.js";import"./still-bake-JrldsKvN.js";import"./plan-view-p3C8oeF-.js";import"./wall-plan-mode-Dt1Corf5.js";import"./sun-CkWBvHKM.js";import"./part-select-CylWA6VC.js";import"./hud-layout-BZeRb5LJ.js";import"./live-CzfFQ-6I.js";import"./plan-studio-panel-CLhhC9Fq.js";import"./connector-targets-ClcWoNdA.js";import"./skins-DoG7PtB3.js";import"./icons-B1y-Lo0K.js";import"./map-create-C8Kzd01o.js";import"./ticket-create-fEyBCxUh.js";import"./automations-glass-CuVLY0Pj.js";import"./automations-demo-DZ_Ot_mu.js";import"./map-text-Bl0HmeU1.js";import"./readiness-model-DGhavIGL.js";import"./tickets-s4-DCuGQ3gv.js";import"./drawer-text-BP9msJcu.js";import"./org-locations-text-m4fuQitl.js";import"./location-picker-jR9j4Q0n.js";import"./events-7klzHIM6.js";var Et=Object.defineProperty,Ot=Object.getOwnPropertyDescriptor,F=(t,e,i,a)=>{for(var o=a>1?void 0:a?Ot(e,i):e,l=t.length-1,r;l>=0;l--)(r=t[l])&&(o=(a?r(e,i,o):r(o))||o);return a&&o&&Et(e,i,o),o};function Pt(t,e){return t?t.floors.map(i=>{const a=i.areas.find(o=>o.name===e)??i.areas[0];return{id:i.floor_id,name:i.name||s("ללא קומה"),count:i.counts.entities,href:a?`/devices/areas/${encodeURIComponent(a.area_id)}`:void 0}}):[]}function Rt(t){return t.map(e=>({id:e.area_id,name:e.name,count:e.counts.entities,href:`/devices/areas/${encodeURIComponent(e.area_id)}`}))}let T=class extends J{constructor(){super(...arguments),this.areaId="",this.areaName="",this.floorName="",this.areas=[],this.open="",this.tree=null,this.treeError=!1,this.phone=!1,this.mq=null,this.tabsMode=new Ke(this,"home"),this.onMq=()=>{this.phone=this.mq?.matches??!1},this.onOutside=t=>{this.open&&!t.composedPath().includes(this)&&(this.open="")}}connectedCallback(){super.connectedCallback();try{this.mq=window.matchMedia("(max-width: 599px)"),this.phone=this.mq.matches,this.mq.addEventListener("change",this.onMq)}catch{this.mq=null}document.addEventListener("pointerdown",this.onOutside,!0)}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),document.removeEventListener("pointerdown",this.onOutside,!0)}updated(){const t=this.tabsMode.ddSize;this.getAttribute("data-dd-size")!==t&&this.setAttribute("data-dd-size",t)}willUpdate(t){t.has("areaId")&&(this.open="");const e=this.phone&&document.documentElement.getAttribute("data-dd-phone")==="sheet";this.toggleAttribute("data-sheet",e)}async ensureTree(){if(!(this.tree||this.treeError))try{this.tree=await De()}catch{this.treeError=!0}}toggle(t,e=!1){const i=this.open!==t;this.open=i?t:"",i&&(t==="floor"&&this.ensureTree(),this.updateComplete.then(()=>e?this.focusOption(0):void 0))}options(t){return t==="floor"?Pt(this.tree,this.areaName):Rt(this.areas)}isCurrent(t,e){return t==="area"?e.id===this.areaId:e.name===(this.floorName||s("ללא קומה"))}optionButtons(){return[...this.renderRoot.querySelectorAll(".menu .opt:not(:disabled)")??[]]}focusOption(t){const e=this.optionButtons();if(!e.length)return;const i=e.findIndex(a=>a.getAttribute("aria-checked")==="true");(t<0?e[e.length-1]:e[t===0&&i>=0?i:Math.min(t,e.length-1)]).focus()}onTriggerKey(t,e){t.key==="ArrowDown"||t.key==="ArrowUp"?(t.preventDefault(),this.open!==e?this.toggle(e,!0):this.focusOption(0)):t.key==="Escape"&&this.open&&(this.open="")}onMenuKey(t,e){const i=this.optionButtons(),a=i.indexOf(this.renderRoot.querySelector(".menu .opt:focus")??document.activeElement),o=l=>{t.preventDefault(),i[(l+i.length)%i.length]?.focus()};t.key==="ArrowDown"?o(a+1):t.key==="ArrowUp"?o(a<0?-1:a-1):t.key==="Home"?o(0):t.key==="End"?o(-1):t.key==="Escape"?(t.preventDefault(),t.stopPropagation(),this.open="",this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-crumb="${e}"]`)?.focus())):t.key==="Tab"&&(this.open="")}choose(t){t.href&&(this.open="",ne(t.href))}renderMenu(t){if(this.open!==t)return d;const e=this.options(t),i=t==="floor"?s("קומות"):s("אזורים בקומה"),a=e.length?e.map(o=>n`<button type="button" role="menuitemradio" class="opt" data-nav-option=${o.id} data-count=${o.count} aria-checked=${String(this.isCurrent(t,o))} ?disabled=${!o.href} @click=${()=>this.choose(o)}>
            <span>${f(o.name)}</span><span class="n">${o.count}</span>
          </button>`):n`<div class="note">${t==="floor"&&!this.treeError?s("טוען קומות…"):t==="floor"?s("לא ניתן לטעון את הקומות"):s("אין אזורים")}</div>`;return n`${this.hasAttribute("data-sheet")?n`<div class="back" @click=${()=>this.open=""}></div>`:d}
      <div class="menu" role="menu" aria-label=${i} data-nav-menu=${t} @keydown=${o=>this.onMenuKey(o,t)}>${a}</div>`}pick(t,e,i,a){const o=t==="area"?n`<h1 class="val">${f(i)}</h1>`:n`<span class="val">${f(i)}</span>`;return n`<span class="wrap">
      <button type="button" class="pick" data-crumb=${t} aria-haspopup="menu" aria-expanded=${String(this.open===t)} aria-current=${t==="area"?"location":d} aria-label=${`${e}: ${i}`} @click=${()=>this.toggle(t)} @keydown=${l=>this.onTriggerKey(l,t)}>
        <sw-icon .name=${a} size=${16}></sw-icon>
        <span class="pt"><span class="cap" aria-hidden="true">${e}</span>${o}</span>
        <sw-icon class="chev" name="chevronDown" size=${14}></sw-icon>
      </button>${this.renderMenu(t)}
    </span>`}render(){const t=this.floorName||s("ללא קומה"),e=n`<span class="sep" aria-hidden="true"><sw-icon name="chevron" size=${11}></sw-icon></span>`,i=this.areaId!=="unassigned";return n`<nav aria-label=${s("ניווט: קומה ואזור")}>
        <a class="crumb" data-crumb="home" href="#/devices/building" @click=${a=>{a.preventDefault(),ne("/devices/building")}}>${this.phone?n`<sw-icon name="home" size=${16}></sw-icon>`:d}<span>${s("חשמל והתקנים")}</span></a>
        ${e}
        <div class="picks" data-nav-picks>${this.pick("floor",s("קומה"),t,"floor")}${i?this.pick("area",s("אזור"),this.areaName,"door"):d}</div>
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
  `;F([C()],T.prototype,"areaId",2);F([C()],T.prototype,"areaName",2);F([C()],T.prototype,"floorName",2);F([C({attribute:!1})],T.prototype,"areas",2);F([w()],T.prototype,"open",2);F([w()],T.prototype,"tree",2);F([w()],T.prototype,"treeError",2);F([w()],T.prototype,"phone",2);T=F([ee("devices-area-nav")],T);var Mt=Object.defineProperty,Bt=Object.getOwnPropertyDescriptor,O=(t,e,i,a)=>{for(var o=a>1?void 0:a?Bt(e,i):e,l=t.length-1,r;l>=0;l--)(r=t[l])&&(o=(a?r(e,i,o):r(o))||o);return a&&o&&Mt(e,i,o),o};const he={already_off:s("כבוי כבר"),not_confirmed:s("מצב לא מאושר"),unavailable:s("לא זמין"),not_allowed:s("אין הרשאה")};let A=class extends J{constructor(){super(...arguments),this.areaId="",this.areaName="",this.entityIds=null,this.external=!1,this.devices=null,this.speakers=null,this.canBulk=!1,this.remoteKey="",this.remoteKind="",this.remoteOpen=!1,this.phase="closed",this.preview=null,this.record=null,this.outcomes=[],this.error="",this.timer=0,this.token=0,this.stop={stopped:!1},this.openRemote=(t,e="")=>{this.remoteKey=t,this.remoteKind=e||this.kindOf(t),this.remoteOpen=!0},this.onOpenRemote=t=>{const i=t.detail?.key??t.target.device?.key??"";i&&this.openRemote(i)},this.close=()=>{this.phase!=="sending"&&(this.phase="closed",this.preview=null,this.record=null,this.outcomes=[],this.error="")}}connectedCallback(){super.connectedCallback(),this.load(),this.timer=window.setInterval(()=>{document.visibilityState==="visible"&&this.phase==="closed"&&this.load()},8e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer),this.stop.stopped=!0}updated(t){t.has("areaId")&&t.get("areaId")!==void 0&&this.load()}allowed(){return!D()||Y("media.read")}async load(){if(!this.areaId||!this.allowed())return this.setDevices([],[]);const t=++this.token;try{if(!(await te().status()).enabled)return t===this.token?this.setDevices([],[]):void 0;const{devices:i}=await te().list({area:this.areaId}),a=this.areaId,o=await $e().list({area:a}).then(h=>h.devices.filter(u=>u.area_id===a&&["speaker","player","receiver"].includes(u.kind)&&Ue.includes(u.kind))).catch(()=>[]),l=o.length>0&&await $e().status().then(h=>h.can.bulk).catch(()=>!1);if(t!==this.token)return;this.canBulk=l;const r=i.filter(h=>h.kind==="screen"),c=this.entityIds,p=c?.length?r.filter(h=>(h.entity_ids??[]).some(u=>c.includes(u))):[];this.setDevices(c?.length&&p.length?p:r,o)}catch{t===this.token&&!this.devices&&this.setDevices([],[])}}setDevices(t,e){this.devices=t,this.speakers=e,this.dispatchEvent(new CustomEvent("media-area-state",{detail:{screens:t.length,players:e.length,playing:e.filter(ke).length,on:t.filter(i=>xe(i.live)).length,canOff:ye(t).length>0},bubbles:!0,composed:!0}))}kindOf(t){return this.speakers?.find(e=>e.key===t)?.kind??"screen"}async ask(){this.phase="loading",this.error="";try{this.preview=await te().bulkPreview("area",this.areaId),this.phase="ask",this.updateComplete.then(()=>requestAnimationFrame(()=>this.renderRoot.querySelector("[data-mac-cancel]")?.focus()))}catch(t){this.error=Z(t),this.phase="error"}}async run(){const t=this.preview;if(t){this.phase="sending",this.stop={stopped:!1};try{const e=await te().bulkRun("area",this.areaId,We(),new Date(Date.now()+15e3).toISOString());if(D()){const i=await Ve(await Ye(e.bulk_id),a=>this.record=a,this.stop);this.record=i,this.outcomes=i.items.map(a=>({name:a.name,text:Qe[a.outcome]}))}else{await this.load();const i=new Map((this.devices??[]).map(a=>[a.key,a]));this.outcomes=t.devices.map(a=>({name:a.name,text:a.will==="off"?i.get(a.key)&&!xe(i.get(a.key).live)?s("אושר"):s("לא אושר"):`${s("דולג")} · ${he[a.reason??""]??""}`}))}this.phase="done",this.load()}catch(e){this.error=Z(e),this.phase="error"}}}dialog(){if(this.phase==="closed"||this.phase==="loading")return d;const t=this.preview,e=t?.counts.send??0,i=this.areaName?s("ב{name}",{name:f(this.areaName)}):s("באזור");if(this.phase==="error")return n`<sw-dialog open heading=${s("הפעולה לא בוצעה")} data-mac-dialog="error" @close=${this.close}><div class="err" role="alert">${this.error}</div>
        <sw-button slot="footer" @click=${this.close}>${s("סגור")}</sw-button></sw-dialog>`;if(this.phase==="done"||this.phase==="sending"){const a=this.record?Xe(this.record).text:this.phase==="sending"?s("שולח…"):this.outcomes.every(o=>o.text===s("אושר")||o.text.startsWith(s("דולג")))?s("בוצע"):s("בוצע חלקית");return n`<sw-dialog open ?locked=${this.phase==="sending"} heading=${e===1?s("כיבוי מסך {where}",{where:i}):s("כיבוי מסכים {where}",{where:i})} data-mac-dialog=${this.phase} @close=${this.close}>
        <div class="res"><b data-mac-headline>${a}</b><ul>${this.outcomes.map(o=>n`<li>${f(o.name)} · ${o.text}</li>`)}</ul></div>
        <sw-button slot="footer" variant="primary" ?disabled=${this.phase==="sending"} @click=${this.close}>${s("סגור")}</sw-button></sw-dialog>`}return!t||e===0?n`<sw-dialog open heading=${s("אין מסך דולק {where}",{where:i})} data-mac-dialog="none" @close=${this.close}>
        <details><summary>${s("פרטים")}</summary><ul>${(t?.devices??[]).map(a=>n`<li>${f(a.name)} · ${he[a.reason??""]??""}</li>`)}</ul></details>
        <sw-button slot="footer" @click=${this.close}>${s("סגור")}</sw-button></sw-dialog>`:n`<sw-dialog open heading=${e===1?s("לכבות מסך אחד {where}?",{where:i}):s("לכבות {n} מסכים {where}?",{n:e,where:i})} data-mac-dialog="ask" @close=${this.close}>
      <details data-mac-details><summary>${s("פרטים")}</summary><ul>${t.devices.map(a=>n`<li>${f(a.name)} · ${a.will==="off"?s("יכובה"):`${s("לא יכובה")} · ${he[a.reason??""]??""}`}</li>`)}</ul></details>
      <sw-button slot="footer" data-mac-cancel @click=${this.close}>${s("ביטול")}</sw-button>
      <sw-button slot="footer" variant="danger" icon="power" data-mac-confirm @click=${()=>void this.run()}>${s("כבה")}</sw-button></sw-dialog>`}render(){const t=this.devices??[],e=this.speakers??[];if(!t.length&&!e.length)return d;const i=ye(t).length>0,o=this.canBulk&&e.some(ke)?n`<button type="button" class="off-all quiet" data-media-pause-all @click=${()=>void this.pauseDialog?.pause({scope:"area",id:this.areaId,name:this.areaName||s("האזור")})}><sw-icon name="pause" size=${14}></sw-icon>${s("עצור מוזיקה")}</button>`:d,l=i&&!this.external?n`<button type="button" class="off-all" data-media-off-all ?disabled=${this.phase==="loading"} @click=${()=>void this.ask()}><sw-icon name="power" size=${14}></sw-icon>${s("כבה הכל")}</button>`:d;return n`${o!==d||l!==d?n`<div class="bar" data-media-area-bar>${o}${l}</div>`:d}
      <div class="list" data-media-area-list @open-remote=${this.onOpenRemote} @open-player=${this.onOpenRemote}>${M(t,r=>r.key,r=>n`<media-screen-card .device=${r} .compact=${!0} size="s" data-media-tile=${r.key}></media-screen-card>`)}
        ${e.length?n`${t.length?n`<div class="sub" data-media-area-sub="players">${s("רמקולים ומגברים")}</div>`:d}${M(e,r=>r.key,r=>n`<media-player-card .device=${r} .compact=${!0} size="s" data-player-tile=${r.key}></media-player-card>`)}`:d}</div>
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
  `;O([C()],A.prototype,"areaId",2);O([C()],A.prototype,"areaName",2);O([C({attribute:!1})],A.prototype,"entityIds",2);O([C({type:Boolean})],A.prototype,"external",2);O([w()],A.prototype,"devices",2);O([w()],A.prototype,"speakers",2);O([w()],A.prototype,"canBulk",2);O([je("media-group-dialog")],A.prototype,"pauseDialog",2);O([w()],A.prototype,"remoteKey",2);O([w()],A.prototype,"remoteKind",2);O([w()],A.prototype,"remoteOpen",2);O([w()],A.prototype,"phase",2);O([w()],A.prototype,"preview",2);O([w()],A.prototype,"record",2);O([w()],A.prototype,"outcomes",2);O([w()],A.prototype,"error",2);A=O([ee("media-area-card")],A);var It=Object.defineProperty,qt=Object.getOwnPropertyDescriptor,G=(t,e,i,a)=>{for(var o=a>1?void 0:a?qt(e,i):e,l=t.length-1,r;l>=0;l--)(r=t[l])&&(o=(a?r(e,i,o):r(o))||o);return a&&o&&It(e,i,o),o};let q=class extends J{constructor(){super(...arguments),this.icon="light",this.label="",this.state="",this.value=0,this.on=!1,this.fillColor="",this.unavailable=!1,this.readonly=!1,this.surface="",this.look=new Te(this),this.drag=null,this.onDown=t=>{this.unavailable||this.readonly||(this.drag={y0:t.clientY,id:t.pointerId,moved:!1})},this.onMove=t=>{if(!this.drag||t.pointerId!==this.drag.id)return;const e=t.clientY-this.drag.y0;if(!this.drag.moved&&Math.abs(e)>6){this.drag.moved=!0,this.setAttribute("data-dragging","");try{this.setPointerCapture(t.pointerId)}catch{}}this.drag.moved&&this.setFromPointer(t.clientY)},this.onUp=t=>{if(!this.drag||t.pointerId!==this.drag.id)return;const e=this.drag.moved;if(this.drag=null,this.removeAttribute("data-dragging"),e){this.emit("change",{value:this.value});return}t.type==="pointerup"&&this.emit("toggle",{on:!this.on})},this.onKey=t=>{if(this.unavailable||this.readonly)return;const i={ArrowUp:.05,ArrowDown:-.05,PageUp:.2,PageDown:-.2,Home:-1,End:1}[t.key];if(i!==void 0){t.preventDefault(),this.value=this.clamp(this.value+i),this.emit("input",{value:this.value}),this.emit("change",{value:this.value});return}(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.emit("toggle",{on:!this.on}))}}connectedCallback(){super.connectedCallback(),this.hasAttribute("tabindex")||(this.tabIndex=0),this.setAttribute("role","slider"),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp),this.addEventListener("keydown",this.onKey)}disconnectedCallback(){this.removeEventListener("pointerdown",this.onDown),this.removeEventListener("pointermove",this.onMove),this.removeEventListener("pointerup",this.onUp),this.removeEventListener("pointercancel",this.onUp),this.removeEventListener("keydown",this.onKey),super.disconnectedCallback()}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}clamp(t){return Math.max(0,Math.min(1,Math.round(t*100)/100))}setFromPointer(t){const e=this.getBoundingClientRect(),i=this.clamp((e.bottom-t)/e.height);i!==this.value&&(this.value=i,this.emit("input",{value:i}))}willUpdate(){const t=this.on?this.value:0;this.style.setProperty("--fill",String(t)),this.fillColor?this.style.setProperty("--fill-c",this.fillColor):this.style.removeProperty("--fill-c"),this.toggleAttribute("data-high",this.on&&this.value>.42)}updated(){const t=Math.round((this.on?this.value:0)*100);this.setAttribute("aria-valuemin","0"),this.setAttribute("aria-valuemax","100"),this.setAttribute("aria-valuenow",String(t)),this.setAttribute("aria-valuetext",this.state||`${t}%`),this.setAttribute("aria-orientation","vertical"),this.setAttribute("aria-label",this.label),this.unavailable?this.setAttribute("aria-disabled","true"):this.removeAttribute("aria-disabled"),this.readonly?this.setAttribute("aria-readonly","true"):this.removeAttribute("aria-readonly"),this.setAttribute("data-surface",this.surface||this.look.of("surface"))}render(){const t=Math.round(this.value*100);return n`<span class="ring" aria-hidden="true"><sw-icon .name=${this.icon} size=${20}></sw-icon></span>
      <span class=${z({tx:!0})}><span class="v">${this.state||(this.on?`${t}%`:"—")}</span>${this.label?n`<span class="nm">${this.label}</span>`:d}</span>`}};q.styles=j`
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
  `;G([C()],q.prototype,"icon",2);G([C()],q.prototype,"label",2);G([C()],q.prototype,"state",2);G([C({type:Number})],q.prototype,"value",2);G([C({type:Boolean,reflect:!0})],q.prototype,"on",2);G([C({attribute:"fill-color"})],q.prototype,"fillColor",2);G([C({type:Boolean,reflect:!0})],q.prototype,"unavailable",2);G([C({type:Boolean,reflect:!0})],q.prototype,"readonly",2);G([C()],q.prototype,"surface",2);q=G([ee("sw-vslider")],q);var Dt=Object.defineProperty,Tt=Object.getOwnPropertyDescriptor,He=(t,e,i,a)=>{for(var o=a>1?void 0:a?Tt(e,i):e,l=t.length-1,r;l>=0;l--)(r=t[l])&&(o=(a?r(e,i,o):r(o))||o);return a&&o&&Dt(e,i,o),o};let re=class extends J{constructor(){super(...arguments),this.items=[],this.look=new Te(this)}updated(){this.setAttribute("data-orientation",this.look.of("slider"))}render(){if(!this.items.length)return d;if(this.look.of("slider")==="vertical"){const t=this.items.map(e=>e.subs).filter(e=>e&&e!==d);return n`<div class="vrow" data-bubble-vsliders>
          ${this.items.map(e=>n`<sw-vslider .icon=${e.icon} .label=${e.label} .state=${e.state} .value=${Math.max(0,Math.min(1,e.value))} ?on=${e.on} fill-color=${e.fillColor??""} ?unavailable=${!!e.unavailable} ?readonly=${!e.onInput&&!e.onChange&&!e.onToggle}
              data-control=${e.key} data-vslider=${e.key}
              @toggle=${i=>e.onToggle?.(i.detail.on)}
              @input=${i=>e.onInput?.(i.detail.value)}
              @change=${i=>e.onChange?.(i.detail.value)}></sw-vslider>`)}
        </div>
        ${t.length?n`<div class="subs">${t}</div>`:d}`}return n`${this.items.map(t=>n`<sw-pill variant="slider" .icon=${t.icon} .label=${t.label} .state=${t.state} .value=${Math.max(0,Math.min(1,t.value))} ?on=${t.on} fill-color=${t.fillColor??""} ?keep-text=${!!t.keepText} ?unavailable=${!!t.unavailable} data-control=${t.key}
        @toggle=${e=>t.onToggle?.(e.detail.on)}
        @input=${e=>t.onInput?.(e.detail.value)}
        @change=${e=>t.onChange?.(e.detail.value)}>${t.subs??d}</sw-pill>`)}`}};re.styles=j`
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
  `;He([C({attribute:!1})],re.prototype,"items",2);re=He([ee("bubble-sliders")],re);const Lt={lighting:"light",switches:"bolt",climate:"snow",heating:"flame",covers:"layers",security:"shield",media:"play",sensors:"activity"};function Be(t){return Lt[t]}const Nt=j`
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
`,le=t=>!t.available||t.state==="unavailable";function W(t,e,i){const a=t.ctl.pillStatus(e.entity_id);return a?a.text:i}function fe(t){return le(t)?s("לא זמין"):t.domain==="sensor"&&t.value!==null&&t.value!==void 0?`${x(Number.isInteger(t.value)?t.value:t.value.toFixed(1))}${t.unit?t.unit.startsWith("°")||t.unit==="%"?t.unit:` ${t.unit}`:""}`:t.domain==="sensor"?t.state??"—":m(t)}function Gt(t){const e=t.device_class??"";return e==="temperature"?"thermometer":e==="humidity"?"sensor":e==="motion"||e==="occupancy"||e==="presence"||e==="moving"?"activity":e==="door"||e==="window"||e==="opening"||e==="garage_door"?"door":e==="power"||e==="energy"?"bolt":e==="battery"?"storage":"sensor"}function Q(t,e,i){const a=le(e),o=e.can_control&&!a,l=me(e.entity_id),r=t.ctl,c=r.rowPendingVisible(e.entity_id),p=()=>t.openSheet(e,i);if(e.entity_id,i==="switches"&&be.has(e.domain))return n`<sw-pill variant="plain" icon="bolt" .label=${f(e.name)} .state=${W(t,e,m(e))} ?on=${e.active&&!a} .hue=${l} ?unavailable=${a} readonly
      data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(e.active&&!a)} data-equipment=${e.domain} title=${E(e)} @activate=${p} @icon-click=${p}>${t.assignButton(e)}</sw-pill>`;if(i==="lighting"||i==="switches"){const h=(r.live(e.entity_id,"power")??e.active)&&!a,u=we(e)&&e.brightness_pct!==null&&e.brightness_pct!==void 0,v=r.live(e.entity_id,"brightness")??e.brightness_pct??0,$=h?u?`${s("דולק")} · ${x(Math.round(v))}%`:e.domain==="light"?s("דולק"):s("פועל"):a?s("לא זמין"):s("כבוי"),_=e.alarm_managed?n`<button slot="subs" type="button" class="chip" aria-label=${e.managed_label??s("נשלט ממסך האזעקה")} data-alarm-managed @click=${()=>ne("/security/alarm")}><sw-icon name="shield" size=${14}></sw-icon></button>`:d;return u?n`<sw-pill variant="slider" icon="light" .label=${f(e.name)} .state=${W(t,e,$)} .value=${Math.max(0,Math.min(1,v/100))} ?on=${h} .hue=${l} ?unavailable=${a} ?readonly=${!e.can_control}
        data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(h)} ?data-can-control=${o} ?data-pending=${c} title=${E(e)}
        @toggle=${g=>o&&r.power(e,g.detail.on)}
        @input=${g=>o&&r.brightness(e,Math.round(g.detail.value*100))}
        @icon-click=${p}>${_}${t.assignButton(e)}</sw-pill>`:n`<sw-pill variant="toggle" .icon=${i==="lighting"?"light":"bolt"} .label=${f(e.name)} .state=${W(t,e,$)} ?on=${h} ?accent=${h&&i==="switches"} .hue=${l} ?unavailable=${a} ?readonly=${!e.can_control}
      data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(h)} ?data-can-control=${o} ?data-pending=${c} title=${E(e)}
      @toggle=${g=>o&&r.power(e,g.detail.on)} @icon-click=${p}>${_}${t.assignButton(e)}</sw-pill>`}if(i==="covers"){if(e.door_class)return n`<sw-pill variant="plain" icon="door" .label=${f(e.name)} .state=${m(e)} .hue=${l} ?unavailable=${a} data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(e.active)} data-door-class="true" title=${E(e)} @activate=${p} @icon-click=${p}>${t.assignButton(e)}</sw-pill>`;const h=e.position!==null&&e.position!==void 0,u=r.coverShown(e),v=r.coverDraft(e),$=r.coverMoving(e),_=h&&!a?`${e.state==="opening"?s("נפתח…"):e.state==="closing"?s("נסגר…"):u>0?s("פתוח"):Ze("deviceCard.valveClosed")} · ${x(Math.round(u))}%`:m(e),g=o?n`<button slot="subs" type="button" class=${z({sb:!0,armed:r.coverArmed(e,"open")})} aria-label=${r.coverArmed(e,"open")?s("לאשר פתיחה?"):s("פתח")} ?disabled=${$} data-control="open" @click=${()=>r.coverMove(e,"open")}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class="sb" aria-label=${s("עצור")} data-control="stop" @click=${()=>r.coverMove(e,"stop")}><sw-icon name="pause" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${z({sb:!0,armed:r.coverArmed(e,"close")})} aria-label=${r.coverArmed(e,"close")?s("לאשר סגירה?"):s("סגור")} ?disabled=${$} data-control="close" @click=${()=>r.coverMove(e,"close")}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
          ${v!==void 0?n`<button slot="subs" type="button" class="chip armed" data-control="position-confirm" @click=${()=>r.coverConfirm(e)}>${s("לאשר {n}%?",{n:x(v)})}</button>`:d}`:d,P=r.coverArmed(e,"open")||r.coverArmed(e,"close");return n`<sw-pill variant=${h&&o?"slider":"plain"} icon="layers" .label=${f(e.name)} .state=${W(t,e,P?s("לחיצה נוספת מאשרת"):_)} .value=${Math.max(0,Math.min(1,u/100))} ?on=${h&&u>0&&!a} fill-color="var(--sw-accent-soft)" keep-text .hue=${l} ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(e.active)} ?data-can-control=${o} ?data-pending=${c} data-door-class="false" title=${E(e)}
      @toggle=${()=>h&&o?r.coverStage(e,u>0?0:100):p()} @change=${R=>o&&r.coverStage(e,Math.round(R.detail.value*100))} @activate=${p} @icon-click=${p}>${g}${t.assignButton(e)}</sw-pill>`}if(i==="climate"||i==="heating"){if(e.domain==="climate"){const{min:$,max:_,step:g}=Le(e),P=r.live(e.entity_id,"temp")??e.target_temperature,R=r.live(e.entity_id,"mode")??e.hvac_mode??"",b=e.active&&!a&&R!=="off",H=e.hvac_action==="heating"||R==="heat"||e.climate_kind==="heating",S=a?s("לא זמין"):`${Ne[R]??R??""}${e.hvac_action&&oe[e.hvac_action]&&e.hvac_action!==R?` · ${oe[e.hvac_action]}`:""}${e.current_temperature!==null&&e.current_temperature!==void 0?` · ${s("בחדר {t}",{t:N(e.current_temperature)})}`:""}`,Fe=o&&P!==null&&P!==void 0?n`<button slot="subs" type="button" class="sb" aria-label=${s("הנמך")} data-control="temp-down" ?disabled=${P<=$} @click=${()=>r.climateTemp(e,P-g)}><sw-icon name="minus" size=${18}></sw-icon></button>
            <button slot="subs" type="button" class="chip" aria-label=${s("יעד {t}",{t:N(P)})} data-control="temp-value" @click=${p}>${N(P)}</button>
            <button slot="subs" type="button" class="sb" aria-label=${s("הגבה")} data-control="temp-up" ?disabled=${P>=_} @click=${()=>r.climateTemp(e,P+g)}><sw-icon name="plus" size=${18}></sw-icon></button>`:d;return n`<sw-pill variant="plain" .icon=${H?"flame":"snow"} .label=${f(e.name)} .state=${W(t,e,S)} ?on=${b} fill-color=${H?"var(--sw-heat)":"var(--sw-cool)"} .hue=${l} ?unavailable=${a}
        data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(e.active)} ?data-can-control=${o} ?data-pending=${c} title=${E(e)} @activate=${p} @icon-click=${p}>${Fe}${t.assignButton(e)}</sw-pill>`}const h=(r.live(e.entity_id,"power")??e.active)&&!a,u=e.domain==="fan",v=r.live(e.entity_id,"percentage")??e.percentage;return n`<sw-pill variant=${u&&o&&v!==null&&v!==void 0?"slider":"plain"} .icon=${u?"fan":"activity"} .label=${f(e.name)} .state=${W(t,e,m(e))} .value=${Math.max(0,Math.min(1,(v??0)/100))} ?on=${h} fill-color="var(--sw-accent-soft)" keep-text .hue=${l} ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(e.active)} ?data-can-control=${o} ?data-pending=${c} title=${E(e)}
      @toggle=${$=>o&&u&&r.power(e,$.detail.on)} @input=${$=>o&&u&&r.fanPercentage(e,Math.round($.detail.value*100))} @activate=${p} @icon-click=${p}>${t.assignButton(e)}</sw-pill>`}if(i==="security"){const h=e.kind==="lock"?e.locked?"lock":"unlock":e.kind==="alarm"?"shield":e.kind==="camera"?"camera":"door",u=a?s("לא זמין"):e.kind==="lock"?e.locked?s("נעול"):m(e):e.kind==="camera"?s("מצלמת התקן"):m(e),v=e.kind==="alarm"?()=>ne("/security/alarm"):p;return n`<sw-pill variant="plain" .icon=${h} .label=${f(e.name)} .state=${u} .hue=${l} ?on=${e.kind==="alarm"?e.state==="triggered":e.kind==="binary_sensor"?e.state==="on":!1} fill-color="var(--sw-warning-soft)" keep-text ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-kind=${e.kind??""} title=${E(e)} @activate=${v} @icon-click=${v}>${t.assignButton(e)}</sw-pill>`}if(i==="media"){const h=(r.live(e.entity_id,"power")??e.active)&&!a,u=(r.live(e.entity_id,"playpause")??e.state)==="playing",v=r.live(e.entity_id,"mute")??!!e.muted,$=a?s("לא זמין"):[m(e),e.media_title,e.source].filter(Boolean).join(" · "),_=o?n`<button slot="subs" type="button" class=${z({sb:!0,dark:u})} aria-label=${u?s("השהה"):s("נגן")} data-control="playpause" @click=${()=>r.mediaPlayPause(e)}><sw-icon .name=${u?"pause":"play"} size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${z({sb:!0,on:v})} aria-label=${v?s("בטל השתקה"):s("השתקה")} data-control="mute" @click=${()=>r.mediaMute(e)}><sw-icon name="volume" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${z({sb:!0,on:h})} role="switch" aria-checked=${String(h)} aria-label=${h?s("כבה"):s("הדלק")} data-control="power" @click=${()=>r.power(e,!h)}><sw-icon name="power" size=${18}></sw-icon></button>`:d;return n`<sw-pill variant="plain" icon="play" .label=${f(e.name)} .state=${W(t,e,$)} ?on=${u&&!a} fill-color="var(--sw-lit)" .hue=${l} ?unavailable=${a}
      data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(e.active)} ?data-can-control=${o} ?data-pending=${c} title=${E(e)} @activate=${p} @icon-click=${p}>${_}${t.assignButton(e)}</sw-pill>`}return n`<sw-pill variant="plain" .icon=${Gt(e)} .label=${f(e.name)} .state=${fe(e)} .hue=${l} ?on=${e.domain==="binary_sensor"&&e.state==="on"} fill-color="var(--sw-warning-soft)" keep-text ?unavailable=${a}
    data-entity=${e.entity_id} data-activity=${B(I(e,m(e)))} data-active=${String(e.active)} title=${E(e)} @activate=${p} @icon-click=${p}>${t.assignButton(e)}</sw-pill>`}function Ie(t,e){const i=le(t);return n`<div class=${z({unavailable:i,hot:t.domain==="binary_sensor"&&t.state==="on"})} data-main-sensor=${t.entity_id} data-slot=${e??""} title=${E(t)}>
    <span class="k">${f(t.name)}</span><div class="v">${fe(t)}</div>
  </div>`}function qe(t){const e=t.fold;return n`<div class="bsep" data-bubble-section=${t.id}>
    ${e?n`<button type="button" class="bt fold" aria-expanded=${String(e.open)} aria-label=${e.open?s("כווץ {name}",{name:t.label}):s("הרחב {name}",{name:t.label})} @click=${e.toggle}><sw-icon name="chevronDown" size=${16}></sw-icon><sw-icon .name=${t.icon} size=${18}></sw-icon><span>${t.label}</span></button>`:n`<sw-icon .name=${t.icon} size=${18}></sw-icon><span class="bt">${t.label}</span>`}
    ${t.count?n`<span class="bn">${t.count}</span>`:d}
    <span class="rule"></span>
    ${t.actions?n`<span class="acts">${t.actions}</span>`:d}
  </div>`}function K(t,e){const i=t.ctl.pillStatus(e.entity_id);return i?n`<div class=${z({bstatus:!0,bad:i.tone==="bad",pending:i.tone==="pending"})} role="status" data-cmd-status=${i.tone==="bad"?"rolled_back":i.tone}>${i.text}</div>`:d}function L(t,e=[]){const i=[...e,...t.last_changed?[{k:s("שינוי אחרון"),v:Ge(t.last_changed)}]:[]];return i.length?n`<div class="kv">${i.map(a=>n`<div><span class="k">${a.k}</span><div class=${z({v:!0,sm:a.v.length>12})}>${a.v}</div></div>`)}</div>`:d}const X=(t,e,i,a,o)=>n`<div class="chips" role="group" data-control=${o}>${t.map(l=>n`<button type="button" class="chip" aria-pressed=${String(l===e)} @click=${()=>a(l)}>${i(l)}</button>`)}</div>`;function Ht(t,e,i){const a=t.ctl,o=le(e),l=e.can_control&&!o;if(i==="switches"&&be.has(e.domain))return n`${K(t,e)}${L(e,[{k:s("מצב"),v:m(e)}])}`;if(i==="lighting"||i==="switches"){const r=(a.live(e.entity_id,"power")??e.active)&&!o,c=we(e)&&e.brightness_pct!==null&&e.brightness_pct!==void 0,p=a.live(e.entity_id,"brightness")??e.brightness_pct??0,h=c?[{key:"brightness",icon:"light",label:s("בהירות"),state:r?`${x(Math.round(p))}%`:s("כבוי"),value:p/100,on:r,unavailable:!l,onToggle:u=>l&&a.power(e,u),onInput:u=>l&&a.brightness(e,Math.round(u*100))}]:[];return n`${h.length?n`<bubble-sliders .items=${h}></bubble-sliders>`:d}
      ${l?n`<div class="brow"><button type="button" class=${z({bbtn:!0,primary:!r})} data-control="power" @click=${()=>a.power(e,!r)}><sw-icon name="power" size=${18}></sw-icon>${r?s("כבה"):s("הדלק")}</button></div>`:d}
      ${K(t,e)}
      ${L(e,[{k:s("מצב"),v:m(e)}])}`}if(i==="covers"){if(e.door_class||!l)return n`${K(t,e)}${L(e,[{k:s("מצב"),v:m(e)},...e.door_class?[{k:s("סוג"),v:s("דלת / שער")}]:[]])}`;const r=(c,p,h)=>{if(!h)return d;const u=a.coverShown(e,c),v=a.coverDraft(e,c),$=a.coverMoving(e,c),_={key:c==="tilt"?"tilt-position":"position",icon:c==="tilt"?"move":"layers",label:c==="tilt"?s("הטיה"):s("מיקום"),state:`${x(Math.round(u))}%${v!==void 0?` · ${s("טרם נשלח")}`:""}`,value:u/100,on:u>0,fillColor:"var(--sw-accent-soft)",keepText:!0,onToggle:()=>a.coverStage(e,u>0?0:100,c),onChange:g=>a.coverStage(e,Math.round(g*100),c),subs:v!==void 0?n`<button slot="subs" type="button" class="chip armed" data-control=${c==="tilt"?"tilt-position-confirm":"position-confirm"} @click=${()=>a.coverConfirm(e,c)}>${s("לאשר {n}%?",{n:x(v)})}</button>`:d};return n`<div class="bsh">${p}</div>
        <bubble-sliders .items=${[_]}></bubble-sliders>
        <div class="brow" data-control=${c==="tilt"?"cover-tilt":"cover"}>
          <button type="button" class=${z({bbtn:!0,primary:a.coverArmed(e,"open",c)})} ?disabled=${$} data-control=${c==="tilt"?"open-tilt":"open"} @click=${()=>a.coverMove(e,"open",c)}><sw-icon name="arrowUp" size=${18}></sw-icon>${a.coverArmed(e,"open",c)?s("לאשר פתיחה?"):s("פתיחה")}</button>
          <button type="button" class="bbtn" data-control=${c==="tilt"?"stop-tilt":"stop"} @click=${()=>a.coverMove(e,"stop",c)}><sw-icon name="pause" size=${18}></sw-icon>${s("עצירה")}</button>
          <button type="button" class=${z({bbtn:!0,primary:a.coverArmed(e,"close",c)})} ?disabled=${$} data-control=${c==="tilt"?"close-tilt":"close"} @click=${()=>a.coverMove(e,"close",c)}><sw-icon name="arrowDown" size=${18}></sw-icon>${a.coverArmed(e,"close",c)?s("לאשר סגירה?"):s("סגירה")}</button>
        </div>`};return n`${r("position",s("מיקום"),!0)}${r("tilt",s("הטיה"),e.tilt!==null&&e.tilt!==void 0)}${K(t,e)}${L(e,[{k:s("מצב"),v:m(e)}])}`}if(i==="climate"||i==="heating"){if(e.domain==="climate"){const{min:p,max:h,step:u}=Le(e),v=a.live(e.entity_id,"temp")??e.target_temperature,$=a.live(e.entity_id,"mode")??e.hvac_mode??"",_=(e.hvac_modes??[]).filter(S=>["off","heat","cool","heat_cool","auto","dry","fan_only"].includes(S)),g=a.live(e.entity_id,"fan")??e.fan_mode??"",P=a.live(e.entity_id,"preset")??e.preset_mode??"",R=a.live(e.entity_id,"swing")??e.swing_mode??"",b=a.live(e.entity_id,"humidity")??e.target_humidity,H=[e.current_temperature!==null&&e.current_temperature!==void 0?s("בחדר {t}",{t:N(e.current_temperature)}):"",e.current_humidity!==null&&e.current_humidity!==void 0?s("לחות {n}%",{n:x(e.current_humidity)}):""].filter(Boolean).join(" · ");return n`${v!=null?n`<div class="target" data-control="climate">
              <button type="button" class="sb" aria-label=${s("הנמך")} data-control="temp-down" ?disabled=${!l||v<=p} @click=${()=>a.climateTemp(e,v-u)}><sw-icon name="minus" size=${22}></sw-icon></button>
              <div class="tv"><span class="l">${s("יעד")}</span><div class="n" data-control="temp-value">${N(v)}</div>${H?n`<span class="l">${H}</span>`:d}</div>
              <button type="button" class="sb" aria-label=${s("הגבה")} data-control="temp-up" ?disabled=${!l||v>=h} @click=${()=>a.climateTemp(e,v+u)}><sw-icon name="plus" size=${22}></sw-icon></button>
            </div>`:d}
        ${_.length&&l?n`<div class="bsh">${s("מצב")}</div>${X(_,$,S=>Ne[S]??S,S=>a.climateMode(e,S),"mode")}`:d}
        ${e.fan_modes?.length&&l?n`<div class="bsh">${s("מאוורר")}</div>${X(e.fan_modes,g,S=>S,S=>a.climateChoice(e,"fan",S),"fan-mode")}`:d}
        ${e.preset_modes?.length&&l?n`<div class="bsh">${s("מצב מוגדר")}</div>${X(e.preset_modes,P,S=>S,S=>a.climateChoice(e,"preset",S),"preset-mode")}`:d}
        ${e.swing_modes?.length&&l?n`<div class="bsh">${s("נדנוד")}</div>${X(e.swing_modes,R,S=>S,S=>a.climateChoice(e,"swing",S),"swing-mode")}`:d}
        ${b!=null&&l?n`<div class="bsh">${s("לחות יעד")}</div><div class="brow" data-control="humidity">
              <button type="button" class="sb" aria-label=${s("הפחת לחות יעד")} data-control="humidity-down" @click=${()=>a.humidity(e,b-5)}><sw-icon name="minus" size=${18}></sw-icon></button>
              <span class="chip plain" data-control="humidity-value">${x(b)}%</span>
              <button type="button" class="sb" aria-label=${s("הגבר לחות יעד")} data-control="humidity-up" @click=${()=>a.humidity(e,b+5)}><sw-icon name="plus" size=${18}></sw-icon></button>
            </div>`:d}
        ${K(t,e)}
        ${L(e,[{k:s("מצב"),v:m(e)},...e.hvac_action?[{k:s("עכשיו"),v:oe[e.hvac_action]??e.hvac_action}]:[]])}`}if(e.domain==="fan"){const p=(a.live(e.entity_id,"power")??e.active)&&!o,h=a.live(e.entity_id,"percentage")??e.percentage,u=h!=null?[{key:"percentage",icon:"fan",label:s("עוצמה"),state:p?`${x(Math.round(h))}%`:s("כבוי"),value:h/100,on:p,fillColor:"var(--sw-accent-soft)",keepText:!0,unavailable:!l,onToggle:v=>l&&a.power(e,v),onInput:v=>l&&a.fanPercentage(e,Math.round(v*100))}]:[];return n`${u.length?n`<bubble-sliders .items=${u}></bubble-sliders>`:d}
        ${l?n`<div class="brow"><button type="button" class=${z({bbtn:!0,primary:!p})} data-control="power" @click=${()=>a.power(e,!p)}><sw-icon name="power" size=${18}></sw-icon>${p?s("כבה"):s("הדלק")}</button></div>`:d}
        ${K(t,e)}${L(e,[{k:s("מצב"),v:m(e)}])}`}const r=a.live(e.entity_id,"mode")??e.mode??"",c=a.live(e.entity_id,"humidity")??e.target_humidity;return n`${e.available_modes?.length&&l?n`<div class="bsh">${s("מצב")}</div>${X(e.available_modes,r,p=>p,p=>a.climateChoice(e,"hmode",p),"mode")}`:d}
      ${c!=null&&l?n`<div class="bsh">${s("לחות יעד")}</div><div class="brow" data-control="humidifier">
            <button type="button" class="sb" aria-label=${s("הפחת לחות יעד")} data-control="humidity-down" @click=${()=>a.humidity(e,c-5)}><sw-icon name="minus" size=${18}></sw-icon></button>
            <span class="chip plain" data-control="humidity-value">${x(c)}%</span>
            <button type="button" class="sb" aria-label=${s("הגבר לחות יעד")} data-control="humidity-up" @click=${()=>a.humidity(e,c+5)}><sw-icon name="plus" size=${18}></sw-icon></button>
          </div>`:d}
      ${K(t,e)}${L(e,[{k:s("מצב"),v:m(e)},...e.current_humidity!==null&&e.current_humidity!==void 0?[{k:s("לחות"),v:`${x(e.current_humidity)}%`}]:[]])}`}if(i==="media"){const r=(a.live(e.entity_id,"power")??e.active)&&!o,c=(a.live(e.entity_id,"playpause")??e.state)==="playing",p=a.live(e.entity_id,"mute")??!!e.muted;return n`${l?n`<div class="brow" data-control="media">
            <button type="button" class="bbtn primary" data-control="playpause" @click=${()=>a.mediaPlayPause(e)}><sw-icon .name=${c?"pause":"play"} size=${18}></sw-icon>${c?s("השהה"):s("נגן")}</button>
            <button type="button" class=${z({bbtn:!0,primary:p})} data-control="mute" @click=${()=>a.mediaMute(e)}><sw-icon name="volume" size=${18}></sw-icon>${p?s("בטל השתקה"):s("השתק")}</button>
            <button type="button" class="bbtn" data-control="power" @click=${()=>a.power(e,!r)}><sw-icon name="power" size=${18}></sw-icon>${r?s("כבה"):s("הדלק")}</button>
          </div>`:d}
      ${K(t,e)}
      ${L(e,[{k:s("מצב"),v:m(e)},...e.media_title?[{k:s("מתנגן"),v:e.media_title}]:[],...e.source?[{k:s("מקור"),v:e.source}]:[],...e.volume_pct!==null&&e.volume_pct!==void 0?[{k:s("עוצמה"),v:`${x(e.volume_pct)}%${e.muted?` · ${s("מושתק")}`:""}`}]:[]])}`}if(i==="security"){const r=o?s("לא זמין"):e.kind==="alarm"?ge[e.state??""]??e.state??"":e.kind==="lock"?e.locked?s("נעול"):m(e):e.kind==="camera"?s("מצלמת התקן"):m(e);return n`${L(e,[{k:s("מצב"),v:r}])}`}return n`${L(e,[{k:s("ערך"),v:fe(e)}])}`}var Ft=Object.defineProperty,Kt=Object.getOwnPropertyDescriptor,k=(t,e,i,a)=>{for(var o=a>1?void 0:a?Kt(e,i):e,l=t.length-1,r;l>=0;l--)(r=t[l])&&(o=(a?r(e,i,o):r(o))||o);return a&&o&&Ft(e,i,o),o};const jt={door:s("דלת"),garage:s("דלת מוסך"),gate:s("שער")},Ut={shutter:s("תריס גלילה"),blind:s("תריס"),curtain:s("וילון"),awning:s("סוכך"),window:s("חלון")},Wt={door:"lock",garage:"lock",gate:"lock"},ve={temperature:s("טמפרטורה"),humidity:s("לחות"),power:s("חשמל / אנרגיה"),illuminance:s("תאורה סביבתית"),co2:"CO2",battery:s("סוללה"),other:s("אחר")},V=["temperature","humidity","power","illuminance","co2","battery"],Vt="(min-width: 1024px) and (min-height: 560px)",ie=new Set(["lighting","switches","sensors"]),Yt={lighting:"light",switches:"bolt",climate:"activity",heating:"activity",covers:"layers",security:"shield",media:"play",sensors:"sensor"},Qt=j`
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
  /* FIXTURE-SPECS-2405: in the sections direction the title column is 110-140 px (sw-card [row]); since "הדלק הכל" joined "כבה הכל"
     (ALLON, 2026-10-10) the two keys side by side (about 176 px) ran into the section's first tiles. They wrap inside the column. */
  :host([data-area-design='sections']) .grid:not(.lay-grid) > sw-card .sec-bulk {
    flex-wrap: wrap;
    max-inline-size: 100%;
  }
  /* NOSCROLL-1366-2437: the cards region (measureBands). Below BANDS_MQ, and in the layout editor, it is transparent and the page scrolls
     as before. From there the page takes the screen's height and the region the room left under the header; it clips (a card's
     shadow keeps 12 px of room), the grid moves up to the page's first card, and the cards of the other pages are hidden. */
  .fitbox {
    display: contents;
  }
  @media (min-width: 1024px) and (min-height: 560px) {
    :host([data-pages]) sw-page {
      block-size: 100%;
    }
    :host([data-pages]) .fitbox {
      display: block;
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: clip;
      overflow-clip-margin: 12px;
    }
    /* PAGING-SETTING-2439: the long lists scroll (הגדרות › כללי) - every card is drawn and the region scrolls inside itself */
    :host([data-pages][data-long-lists='scroll']) .fitbox {
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    :host([data-pages]) .fitbox > .grid {
      transform: translateY(calc(-1 * var(--band-y, 0px)));
    }
    :host([data-pages]) .fitbox > .grid > [data-band-off] {
      visibility: hidden;
    }
  }
  /* FIXTURE-SPECS-2405: the fit steps (measureFit) - only while the automatic layout would make the page scroll on a desktop-width
     screen; the look is the same, the air between and inside the cards is what gives. Step 1: */
  :host([data-fit='1']) sw-page,
  :host([data-fit='2']) sw-page {
    gap: 6px;
  }
  :host([data-fit='1']) .sec-strip {
    padding: 6px 12px;
  }
  :host([data-fit='1']) .sec-chip {
    min-block-size: 26px;
  }
  :host([data-fit='1']) .msens {
    padding-block: 6px;
  }
  :host([data-fit='1']) .tile {
    min-block-size: 46px;
    padding: 5px 10px;
  }
  :host([data-fit='1']) .tiles {
    gap: 5px;
  }
  :host([data-fit='1']) .row {
    padding-block: 4px;
  }
  :host([data-area-design='tiles'][data-fit='1']) .grid:not(.lay-grid) > sw-card {
    margin-block-end: 8px;
    padding: 8px 12px 10px;
  }
  :host([data-area-design='tiles'][data-fit='1']) .grid:not(.lay-grid) > sw-card > header,
  :host([data-area-design='tiles'][data-fit='2']) .grid:not(.lay-grid) > sw-card > header {
    margin-block-end: 6px;
  }
  :host([data-area-design='sections'][data-fit='1']) .grid:not(.lay-grid),
  :host([data-area-design='sections'][data-fit='2']) .grid:not(.lay-grid) {
    gap: 6px 12px;
  }
  :host([data-area-design='sections'][data-fit='1']) .grid:not(.lay-grid) > sw-card {
    padding: 7px 12px;
  }
  /* step 2: the tightest */
  :host([data-fit='2']) .sec-strip {
    padding: 4px 10px;
  }
  :host([data-fit='2']) .sec-chip {
    min-block-size: 24px;
  }
  :host([data-fit='2']) .msens {
    padding: 4px 10px;
  }
  :host([data-fit='2']) .tile {
    min-block-size: 42px;
    padding: 4px 8px;
  }
  :host([data-fit='2']) .tiles {
    gap: 4px;
  }
  :host([data-fit='2']) .row {
    padding-block: 3px;
  }
  :host([data-area-design='tiles'][data-fit='2']) .grid:not(.lay-grid) > sw-card {
    margin-block-end: 6px;
    padding: 6px 10px 8px;
  }
  :host([data-area-design='sections'][data-fit='2']) .grid:not(.lay-grid) > sw-card {
    padding: 5px 10px;
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
`,Xt=j`
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
`;let y=class extends J{constructor(){super(...arguments),this.areaId="",this.detail=null,this.fit=0,this.fitKey="",this.fitRaf=0,this.bandPage=0,this.bandCount=1,this.bandObserved=null,this.bandMq=window.matchMedia(Vt),this.lists=new Ct(this,()=>{this.bandPage=0,this.fitRaf||(this.fitRaf=window.requestAnimationFrame(this.measureFit))}),this.onBandMq=()=>this.requestUpdate(),this.error="",this.forbidden=!1,this.notFound=!1,this.sync=null,this.structureFlash=!1,this.flashTimer=0,this.coverGroupPosition=50,this.assigning=null,this.assignAreas=null,this.assignTarget="",this.assignBusy=!1,this.assignError="",this.stop=null,this.timer=0,this.loading=!1,this.loadAgain=!1,this.ctl=new Je(this),this.press=new et(this,{area:()=>this.detail?.area.name??""}),this.prefs=tt,this.prefsReady=Promise.resolve(),this.design="tiles",this.installationDesign="tiles",this.extra=new Map,this.mediaCount=new Map,this.sensOpen=new Set,this.foldState=new Map,this.phone=!1,this.phoneMq=null,this.extraKey="",this.skin=new at(this),this.sheet=null,this.quick=null,this.desktopArea="drawer",this.presence=null,this.presenceTimer=0,this.lay=new st(this,{scope:"area",id:()=>this.areaId,screenName:()=>s("מסך האזור ‹ {name}",{name:this.detail?.area.name??""}),measure:()=>this.measureCards(),defaultH:()=>30,label:t=>t.startsWith("card:c-")?this.lay.customTitle(t):t.startsWith("camera:")?this.lay.item(t)?.title||s("מצלמה"):this.detail?this.detail.cards[t.slice(5)]?.label??t:t,compact:()=>this.prefs.density==="compact",entities:t=>{if(t.startsWith("card:c-"))return this.customRows(t).map(i=>({id:i.entity_id,name:i.name}));const e=this.detail?.cards[t.slice(5)];return e?this.displayRows(e).map(i=>({id:i.entity_id,name:i.name,group:e.id==="sensors"?ve[i.group??"other"]:void 0})):[]},tileSpan:t=>{const e=this.lay.customOf(t)?.type;return e?ze[e]?.tiles?1:_e[e]??2:ie.has(t.slice(5))?1:_e[t.slice(5)]??1},pool:()=>this.areaPool(),barExtra:()=>this.renderDesignPersonal()}),this.measureFit=()=>{if(this.fitRaf=0,!this.detail||!this.isConnected)return;if(!(window.innerWidth>=it&&!this.phone&&!this.lay.editing&&!this.lay.gridOn("cards"))){this.fit!==0?this.fit=0:this.measureBands();return}const i=[window.innerWidth,window.innerHeight,this.areaId,this.design,this.entityIds.size].join("|");if(i!==this.fitKey&&(this.fitKey=i,this.fit!==0)){this.fit=0;return}const a=nt(this),o=this.bandsOn()?this.renderRoot.querySelector(".fitbox"):null,l=o?.querySelector(":scope > .grid"),r=o&&l?l.offsetHeight-o.clientHeight:0;if((a&&a.scrollHeight-a.clientHeight>1||r>1)&&this.fit<2){this.fit=this.fit+1;return}this.measureBands()},this.onFitResize=()=>{this.requestUpdate()},this.onBulkRequest=t=>{t.stopPropagation(),this.renderRoot.querySelector("devices-bulk-dialog")?.show(t.detail)},this.onPhone=()=>{this.phone=this.phoneMq?.matches??!1},this.bubbleHost={ctl:this.ctl,openSheet:(t,e)=>{this.sheet={id:t.entity_id,card:e}},assignButton:t=>this.canAssignArea?n`<sw-button slot="subs" class="assign-btn" size="sm" variant="ghost" data-assign-entity=${t.entity_id} @click=${e=>{e.stopPropagation(),this.openAssign(t)}}>${s("שייך לאזור")}</sw-button>`:d},this.onQuickBulk=t=>{const{kind:e,position:i,area:a}=t.detail;this.bulkAllowed&&this.renderRoot.querySelector("devices-bulk-dialog")?.show({scope:"area",id:a.area_id,name:a.name,kind:e,position:i})},this.closeAssign=()=>{this.assignBusy||(this.assigning=null)}}areaPool(){const t=this.detail;return t?U.filter(e=>this.prefs.showSensors||e!=="sensors").flatMap(e=>(t.cards[e]?.entities??[]).map(i=>({id:i.entity_id,name:i.name,card:e,domain:i.domain,group:i.group,door:i.door_class}))):[]}rowIndex(){const t=new Map,e=this.detail;if(!e)return t;for(const i of U)for(const a of e.cards[i]?.entities??[])t.set(a.entity_id,{row:a,card:i});for(const[i,a]of this.extra)t.has(i)||t.set(i,{row:a,card:a.card});return t}updated(){this.getAttribute("data-fit")!==String(this.fit)&&this.setAttribute("data-fit",String(this.fit)),this.toggleAttribute("data-pages",this.bandsOn()),this.watchBands(),this.fitRaf||(this.fitRaf=window.requestAnimationFrame(this.measureFit));const t=this.detail;if(!t)return;const e=new Set(U.flatMap(a=>t.cards[a].entities.map(o=>o.entity_id))),i=this.lay.listedEntityIds().filter(a=>!e.has(a)).join(",");i!==this.extraKey&&!(i===""&&this.extra.size===0)&&this.loadExtra()}bandsOn(){return this.bandMq.matches&&!this.phone&&!this.lay.editing}watchBands(){const t=this.renderRoot.querySelector(".fitbox");if(t===this.bandObserved||typeof ResizeObserver>"u"||(this.bandRo?.disconnect(),this.bandObserved=t,!t))return;this.bandRo??=new ResizeObserver(()=>{this.fitRaf||(this.fitRaf=window.requestAnimationFrame(this.measureFit))}),this.bandRo.observe(t);const e=t.querySelector(":scope > .grid");e&&this.bandRo.observe(e)}measureBands(){const t=this.renderRoot.querySelector(".fitbox"),e=t?.querySelector(":scope > .grid"),i=e?[...e.children]:[],a=()=>{for(const v of i)v.removeAttribute("data-band-off");e?.style.removeProperty("--band-y"),this.bandCount!==1&&(this.bandCount=1),this.bandPage!==0&&(this.bandPage=0)};if(!t||!e||!this.bandsOn()||!this.lists.paged)return a();const o=t.clientHeight,l=e.getBoundingClientRect().top,r=i.map(v=>({el:v,r:v.getBoundingClientRect()})).filter(v=>v.r.height>0).map(v=>({el:v.el,top:v.r.top-l,bottom:v.r.bottom-l}));if(!r.length||Math.max(...r.map(v=>v.bottom))<=o+.5)return a();const c=[];let p=[...r].sort((v,$)=>v.top-$.top);for(;p.length;){const v=p[0].top;let $=p.filter(_=>_.bottom-v<=o+.5);$.length||($=[p[0]]),c.push({y:v,els:new Set($.map(_=>_.el))}),p=p.filter(_=>!$.includes(_))}const h=Math.min(this.bandPage,c.length-1),u=c[h];for(const v of r)v.el.toggleAttribute("data-band-off",!u.els.has(v.el));e.style.setProperty("--band-y",`${h===0?0:u.y}px`),this.bandCount!==c.length&&(this.bandCount=c.length),this.bandPage!==h&&(this.bandPage=h)}goBand(t){this.bandPage=Math.max(0,Math.min(t-1,this.bandCount-1)),this.fitRaf||(this.fitRaf=window.requestAnimationFrame(this.measureFit))}customRows(t){const e=this.rowIndex();return(this.lay.customOf(t)?.entities??[]).flatMap(i=>e.has(i)?[e.get(i).row]:[])}displayRows(t){if(t.id!=="sensors")return t.entities;const e=i=>{const a=V.indexOf(i??"other");return a===-1?i&&i!=="other"?V.length:V.length+1:a};return t.entities.map((i,a)=>({r:i,i:a})).sort((i,a)=>e(i.r.group)-e(a.r.group)||(e(i.r.group)===V.length?(i.r.group??"").localeCompare(a.r.group??""):0)||i.i-a.i).map(i=>i.r)}measureCards(){const t=this.renderRoot.querySelector('[data-lay-grid="cards"]');return t?[{el:t,items:[...t.querySelectorAll(":scope > [data-lay-key]")].map(e=>({key:e.dataset.layKey,el:e}))}]:[]}get bulkAllowed(){return D()&&Y("devices.control_bulk")&&this.detail?.can_bulk===!0}connectedCallback(){super.connectedCallback(),this.prefsReady=Promise.all([ot().then(t=>{this.prefs=t,rt(this,t)}),this.loadDesign()]).then(()=>{}),lt().then(t=>this.desktopArea=t.desktop_area);try{this.phoneMq=window.matchMedia("(max-width: 599px)"),this.phone=this.phoneMq.matches,this.phoneMq.addEventListener("change",this.onPhone)}catch{this.phoneMq=null}if(window.addEventListener("resize",this.onFitResize),this.bandMq.addEventListener("change",this.onBandMq),!!D()){if(!Y("devices.read")){this.forbidden=!0;return}this.stop=dt(t=>{t.type==="entity_state_changed"?(!this.detail||this.entityIds.has(t.entity.entity_id))&&this.scheduleReload():t.type==="structure_changed"?(this.scheduleReload(),this.structureFlash=!0,window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.structureFlash=!1,St)):t.type==="ha_sync_state"?(this.sync&&(this.sync={...this.sync,connected:t.connected}),this.scheduleReload()):t.type==="heartbeat"&&(this.sync=t.sync)},t=>{t&&this.scheduleReload()})}}disconnectedCallback(){super.disconnectedCallback(),this.stop?.(),this.stop=null,window.clearTimeout(this.timer),this.timer=0,window.clearInterval(this.presenceTimer),this.presenceTimer=0,this.phoneMq?.removeEventListener("change",this.onPhone),window.removeEventListener("resize",this.onFitResize),this.bandMq.removeEventListener("change",this.onBandMq),this.bandRo?.disconnect(),this.bandRo=void 0,this.bandObserved=null,this.fitRaf&&window.cancelAnimationFrame(this.fitRaf),this.fitRaf=0}async loadDesign(){let t="tiles";if(D())try{t=(await ct())["devices.area_design"]}catch{}this.installationDesign=Se(t,null,!1),this.applyDesign()}get mayPersonalize(){return D()&&pt(At)}personalDesign(){try{return localStorage.getItem(de)}catch{return null}}applyDesign(){this.design=Se(this.installationDesign,this.personalDesign(),this.mayPersonalize),this.setAttribute("data-area-design",this.design)}setPersonalDesign(t){try{t?localStorage.setItem(de,t):localStorage.removeItem(de)}catch{}this.applyDesign()}get entityIds(){return this.detail?new Set([...U.flatMap(t=>this.detail.cards[t].entities.map(e=>e.entity_id)),...this.extra.keys()]):new Set}async loadExtra(){const t=this.detail;if(!t)return;const e=new Set(U.flatMap(o=>t.cards[o].entities.map(l=>l.entity_id))),i=this.lay.listedEntityIds().filter(o=>!e.has(o)),a=i.join(",");if(!i.length){this.extra.size&&(this.extra=new Map),this.extraKey="";return}try{const o=await ut(i);this.extra=new Map(o.entities.map(l=>[l.entity_id,l])),this.extraKey=a}catch{this.extraKey=a}}willUpdate(t){t.has("areaId")&&D()&&!this.forbidden&&(this.lay.load(),this.detail=null,this.presence=null,this.notFound=!1,this.error="",this.load())}scheduleReload(){this.timer||(this.timer=window.setTimeout(()=>{this.timer=0,this.load()},ht))}async load(){if(!this.areaId)return;if(this.loading){this.loadAgain=!0;return}this.loading=!0;const t=this.areaId;try{const[e,i]=await Promise.all([vt(t),this.readPresence(t),this.prefsReady]);if(t!==this.areaId)return;i!==void 0&&(this.presence=i),this.detail=e,this.sync=e.sync,this.error="",this.notFound=!1,this.loadExtra()}catch(e){e instanceof Ae&&e.status===403?this.forbidden=!0:e instanceof Ae&&e.status===404?this.notFound=!0:this.error=Z(e)}finally{this.loading=!1,this.loadAgain&&(this.loadAgain=!1,this.load())}}presenceMayRead(){return D()&&(Y("presence.building.view")||Y("presence.view"))}async readPresence(t){if(!this.presenceMayRead())return null;try{const e=await gt(t);return this.syncPresencePoll(e.line),e}catch{return}}syncPresencePoll(t){if(!t){window.clearInterval(this.presenceTimer),this.presenceTimer=0;return}this.presenceTimer||(this.presenceTimer=window.setInterval(()=>{if(document.hidden||!this.areaId||!this.isConnected)return;const e=this.areaId;this.readPresence(e).then(i=>{i!==void 0&&e===this.areaId&&(this.presence=i)})},mt))}renderPresenceLine(){const t=bt(this.presence);if(!t.show)return d;const e=t.names.length?n`${t.names.map((i,a)=>n`${a?", ":""}<bdi>${i}</bdi>`)}${t.rest>0?` ${ce.andMore(t.rest)}`:""}`:t.people;return n`<div class="pres-line" data-area-presence data-tone=${t.tone} role="status" aria-label=${ce.areaLineAria} title=${t.title}>
      <sw-icon name="users" size=${15}></sw-icon><span class="pres-lbl">${ce.areaLineLabel}</span>
      ${t.room?n`<span class="pres-sep" aria-hidden="true">·</span><b data-area-presence-room>${t.room}</b>`:d}
      ${t.people?n`<span class="pres-sep" aria-hidden="true">·</span><span class="pres-who" data-area-presence-people>${e}</span>`:d}
    </div>`}render(){const t=s("חשמל והתקנים");if(!D())return n`<sw-page heading=${s("אזור")} subheading=${`${t} · ${s("נתוני הדגמה")}`} backHref="/devices/building" crumbs=${`${t} | ${s("אזור")}`}><sw-state-panel icon="home" state="empty" heading=${s("מסך האזור עובד מול השרת")} hint=${s("במצב הדגמה אין אזורים להצגה; עץ המבנה מציג נתוני הדגמה.")}></sw-state-panel></sw-page>`;if(this.forbidden)return n`<sw-page heading=${t} subheading=${s("אזור")} backHref="/devices/building"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading=${s("אין לך הרשאת צפייה בחשמל והתקנים")} hint=${s("נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת.")}></sw-state-panel></sw-page>`;if(this.notFound)return n`<sw-page heading=${t} subheading=${s("אזור")} backHref="/devices/building" crumbs=${`${t} | ${s("אזור")}`}><sw-state-panel icon="home" data-devices-state="not_found" state="empty" heading=${s("האזור לא נמצא")} hint=${s("האזור אינו קיים, או שאין בו התקנים שבהרשאתך.")}></sw-state-panel></sw-page>`;const e=this.detail;if(!e)return n`<sw-page heading=${t} subheading=${s("אזור")} backHref="/devices/building">${this.error?n`<sw-state-panel data-devices-state="load_error" state="error" heading=${s("לא ניתן לטעון את האזור")} hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel>`:n`<div class="skeleton" data-devices-state="loading" role="status" aria-label=${s("טוען…")} aria-busy="true">
            <div class="skl strip"></div>
            <div class="skl-cards"><div class="skl card"></div><div class="skl card"></div><div class="skl card"></div></div>
          </div>`}</sw-page>`;const i=e.area.floor_name??"",a=`${s("{n} התקנים",{n:e.counts.entities})}${e.scoped?` · ${s("לפי הקומות שלך")}`:""}`,o=this.sync?.connected??!1,l=U.filter(b=>this.prefs.showSensors||b!=="sensors").map(b=>e.cards[b]),r=l.filter(b=>b.count>0),c=this.lay.gridOn("cards")||this.lay.editing,p=r.filter(b=>!this.lay.isRemoved(`card:${b.id}`)&&(b.id!=="security"||c)),h=this.lay.customKeys(),u=[...r.map(b=>`card:${b.id}`),...h,...this.lay.removedKeys().filter(b=>!r.some(H=>`card:${H.id}`===b))],v=l.some(b=>b.entities.some(H=>H.can_control)),$=this.bulkAllowed,_=this.lay.keysWithPrefix("camera:").filter(b=>wt(this.lay.cameraOf(b)));this.lay.prepare([{id:"cards",keys:[...u,..._]}]);const g=this.lay.tileCard?p.find(b=>this.lay.arranging(`card:${b.id}`)):void 0,P=this.lay.tileCard&&h.includes(this.lay.tileCard)&&this.lay.arranging(this.lay.tileCard)?this.lay.tileCard:"",R=this.skin.bubble;return n`<sw-page heading=${R||e.area.area_id!=="unassigned"?"":f(e.area.name)} subheading=${R?"":a} wide @bulk-request=${this.onBulkRequest}>
      <devices-area-nav slot="crumbs" .areaId=${e.area.area_id} .areaName=${e.area.name} .floorName=${i} .areas=${e.floor_areas}></devices-area-nav>
      <div slot="actions">
        ${this.bandCount>1&&this.bandsOn()?n`<sw-pager data-area-pager .page=${this.bandPage+1} .pages=${this.bandCount} @page-change=${b=>this.goBand(b.detail.page)}></sw-pager>`:d}
        ${e.area.map?n`<sw-button size="sm" variant="ghost" icon="map" data-show-on-map @click=${()=>{location.hash=pe(e.area.map)??location.hash}}>${s("הצג על המפה")}</sw-button>`:d}
        ${$?n`<devices-bulk-menu scope="area" .targetId=${e.area.area_id} .targetName=${e.area.name} .counts=${e.counts} variant="popover" label=${s("פעולות לאזור")} mapHref=${pe(e.area.map)??""} data-bulk-area=${e.area.area_id}></devices-bulk-menu>`:d}
        ${e.counts.alarm&&!R?n`<sw-badge data-area-alarm kind=${Ce(e.counts.alarm)} label=${`${s("אזעקה")}: ${ge[e.counts.alarm]??e.counts.alarm}`}></sw-badge>`:d}
        ${R&&o?d:n`<sw-badge data-devices-sync kind=${o?"live":"stale"} label=${o?s("מסונכרן"):s("לא מסונכרן")}></sw-badge>`}
        ${this.structureFlash?n`<sw-badge data-structure-changed kind="live" label=${s("מבנה עודכן")}></sw-badge>`:d}
      </div>
      ${this.error?n`<sw-state-panel compact state="error" heading=${s("הרענון האחרון נכשל")} hint=${this.error}></sw-state-panel>`:d}
      ${R?this.renderBubbleHead(e):d}
      ${this.lay.renderBar()}
      ${this.lay.editing?d:this.renderPresenceLine()}
      ${this.lay.editing?d:this.renderSecurityStrip(e)}
      ${this.lay.editing||!e.area.map||!this.prefs.planSurfaces.includes("area")||!D()?d:this.renderPlanCard(e)}
      ${g?this.lay.stage(`card:${g.id}`,this.renderCard(g)):P?this.lay.stage(P,this.renderCustomCard(P)):p.length||h.length||_.length||this.lay.editing&&r.length>0?n`<div class="fitbox" data-area-cards><div class=${z({grid:!0,"lay-grid":this.lay.gridOn("cards")})} data-lay-grid="cards" data-lay-cols=${this.lay.gridCols("cards")} ?data-lay-phone-preview=${this.lay.phonePreview("cards")}>
            ${M(p,b=>b.id,b=>this.lay.wrap(`card:${b.id}`,this.renderCard(b)))}
            ${M(h,b=>b,b=>this.lay.wrap(b,this.renderCustomCard(b)))}
            ${M(_,b=>b,b=>this.lay.wrap(b,this.renderCameraCard(b)))}
          </div></div>`:n`<sw-state-panel icon="home" data-devices-state="area_empty" state="empty" heading=${s("אין התקנים באזור הזה")} hint=${s("התקנים שישויכו לאזור יופיעו כאן.")}></sw-state-panel>`}
      ${v?d:n`<div class="note" data-readonly-note>${s("תצוגה לקריאה בלבד: מצב ההתקנים כפי שדווח.")}</div>`}
      ${$?n`<devices-bulk-dialog @bulk-done=${()=>void this.load()}></devices-bulk-dialog>`:d}
      ${this.canAssignArea?this.renderAssignDialog():d}
      ${this.lay.renderPanel()}
      ${R?this.renderBubbleSheet():d}
      ${this.renderQuickSheet(e)}
    </sw-page>`}renderPlanCard(t){const e=t.area.map;return n`<sw-card class="plancard" data-area-plan-card heading=${s("על התוכנית")}>
      <a slot="actions" class="plan-open" href=${pe(e)??""} data-area-plan-open>${s("למפה המלאה")}<sw-icon name="chevron" size=${12}></sw-icon></a>
      <explore-floor-map embedded compact .floorId=${e.floor_id} .focusZone=${e.zone_id} @area-open=${i=>this.onPlanAreaOpen(t,i.detail.area_id)}></explore-floor-map>
    </sw-card>`}onPlanAreaOpen(t,e){if(!e||e===t.area.area_id)return;const i=t.floor_areas.find(l=>l.area_id===e);if(!i)return;const a=ft(this.phone,"sheet",this.desktopArea);if(a==="screen"){location.hash=`#/devices/areas/${encodeURIComponent(e)}`;return}const o={area_id:i.area_id,name:i.name,icon:i.icon,floor_id:t.area.floor_id,counts:i.counts,has_camera:!1,can_bulk:t.can_bulk};this.quick={area:o,mode:a}}renderQuickSheet(t){const e=this.quick;return n`<area-quick-sheet data-area-quick=${e?.area.area_id??d} .area=${e?.area??null} .floorName=${t.area.floor_name??""} .mode=${e?.mode??"drawer"} ?open=${!!e}
      ?canBulk=${this.bulkAllowed} @close=${()=>this.quick=null} @area-bulk=${this.onQuickBulk}></area-quick-sheet>`}renderBubbleHead(t){const e=t.counts,i=[e.lights_on?s("{n} דולקים",{n:x(e.lights_on)}):"",e.climate_active+e.heating_active?s("{n} מיזוג",{n:x(e.climate_active+e.heating_active)}):"",e.covers_open?s("{n} פתוחים",{n:x(e.covers_open)}):""].filter(Boolean),a=[i.length?i.join(" · "):s("{n} התקנים",{n:x(e.entities)}),t.area.floor_name??""].filter(Boolean).join(" · "),o=t.cards.sensors.entities.find(r=>r.domain==="sensor"&&r.device_class==="temperature"&&r.available&&r.value!==null&&r.value!==void 0),l=t.counts.alarm;return n`<sw-pill class="bhead" variant="plain" ring-static icon="home" .label=${f(t.area.name)} .state=${a} .hue=${me(t.area.area_id)} tabindex="-1" data-area-head=${t.area.area_id}>
      ${o?n`<span slot="subs" class="chip plain" data-area-temperature title=${f(o.name)}><sw-icon name="thermometer" size=${14}></sw-icon>${N(o.value)}</span>`:d}
      ${l?n`<a slot="subs" class="chip" href="#/security/alarm" data-area-alarm title=${s("לאזעקה")} style="text-decoration:none"><sw-icon name="shield" size=${14}></sw-icon>${ge[l]??l}</a>`:d}
      ${this.bulkAllowed&&(e.lights_on||e.switches_on)?n`<button slot="subs" type="button" class="sb" aria-label=${s("כבה הכל באזור")} data-area-all-off @click=${()=>this.openCoverGroupBulk("all_off")}><sw-icon name="power" size=${18}></sw-icon></button>`:d}
    </sw-pill>`}renderBubbleSheet(){const t=this.sheet,e=t?this.rowIndex().get(t.id):void 0,i=e?.row,a=t?.card??e?.card??"sensors";return n`<sw-sheet ?open=${!!i} heading=${i?f(i.name):""} data-device-sheet=${i?.entity_id??""} @close=${()=>this.sheet=null}>
      ${i?n`<sw-pill slot="head" variant="plain" ring-static .icon=${Be(a)} .label=${f(i.name)} .state=${m(i)} .hue=${me(i.entity_id)} ?on=${i.active&&i.available} fill-color=${a==="lighting"?"var(--sw-lit)":a==="climate"||a==="heating"?a==="heating"?"var(--sw-heat)":"var(--sw-cool)":"var(--sw-accent-soft)"} tabindex="-1" data-sheet-head></sw-pill>${Ht(this.bubbleHost,i,a)}`:d}
    </sw-sheet>`}renderBubbleSection(t,e,i){const a=this.lay.item(e),o=this.phone&&!this.lay.editing&&this.folded(e,t.id==="sensors"),l=Ee[t.id]&&this.bulkAllowed&&t.count&&!this.lay.arranging(e)?n`<span class="sec-bulk" data-section-bulk=${t.id} data-bulk-look=${this.lay.bulkLookOf(e)}>${Oe(t.id,t.entities).map(r=>n`<button type="button" class="sb" aria-label=${`${r.label} · ${t.label}`} title=${r.label} data-section-bulk-kind=${r.kind} @click=${()=>this.openCoverGroupBulk(r.kind)}><sw-icon .name=${r.icon} size=${18}></sw-icon></button>`)}</span>`:d;return n`${qe({id:t.id,icon:a?.icon??Be(t.id),label:ae(a,t.label),count:t.count?`${x(t.count)}`:"",fold:this.phone&&!this.lay.editing?{open:!o,toggle:()=>this.fold(e,!o)}:null,actions:l})}
      ${o?d:i}`}renderCameraCard(t){const e=this.lay.item(t);return n`<sw-card flush data-camera-card=${t} data-lay-key=${t}>
      <devices-camera-card .source=${this.lay.cameraOf(t)??null} .title=${e?.title??""} .quality=${this.lay.qualityOf(t)} ?showQuality=${this.lay.editing} ?fill=${this.lay.gridOn("cards")}></devices-camera-card>
    </sw-card>`}renderCard(t){const e=$t[t.id],i=this.lay.item(`card:${t.id}`),a=Pe(i,t.entities),o=t.count?this.lay.tiles(`card:${t.id}`,this.displayRows(t).map(p=>p.entity_id)):null,l=`card:${t.id}`,r=this.skin.bubble,c=t.count===0?n`<sw-state-panel icon="home" compact data-card-empty state="empty" heading=${e.heading} hint=${e.hint}></sw-state-panel>`:o?this.renderArranged(t,o):a.length?t.id==="media"&&this.mediaHook?this.renderMedia(l,null,a):t.id==="sensors"?this.renderSensorsSection(l,a):r?n`${t.id==="covers"?this.renderCoverGroupControl():d}<div class="bgrid" data-bubble-grid=${t.id}>${M(a,p=>p.entity_id,p=>Q(this.bubbleHost,p,t.id))}</div>`:t.id==="lighting"||t.id==="switches"?n`<div class="tiles">${M(a,p=>p.entity_id,p=>this.renderTile(p,t.id))}</div>`:n`${t.id==="covers"?this.renderCoverGroupControl():d}<div class="rows">${M(a,p=>p.entity_id,p=>this.renderRow(p,t.id))}</div>`:n`<div class="count" data-card-all-hidden>${s("כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.")}</div>`;return r?n`<sw-card data-card=${t.id} data-lay-key=${l} ?data-empty=${t.count===0} data-bubble-card>${this.renderBubbleSection(t,l,c)}</sw-card>`:n`<sw-card data-card=${t.id} data-lay-key=${l} ?data-empty=${t.count===0} ?row=${this.rowSections&&t.id!=="sensors"&&t.id!=="media"} ?collapsible=${this.phone&&!this.lay.editing} ?collapsed=${this.phone&&!this.lay.editing&&this.folded(l,t.id==="sensors")} @sw-card-toggle=${p=>this.fold(l,p.detail.collapsed)} heading=${ae(i,t.label)} subheading=${t.count?`${t.count===1?s("התקן אחד"):s("{n} התקנים",{n:t.count})}${t.id==="lighting"||t.id==="switches"||t.id==="climate"||t.id==="heating"||t.id==="covers"||t.id==="media"?` · ${t.active===1?s("אחד פעיל"):s("{n} פעילים",{n:t.active})}`:""}`:""}>
      ${this.renderSectionBulk(t,l)}
      <sw-icon slot="actions" .name=${i?.icon??Yt[t.id]} size=${18}></sw-icon>
      ${c}
    </sw-card>`}get rowSections(){return this.design==="sections"&&!this.phone&&!this.lay.gridOn("cards")}folded(t,e){return this.foldState.has(t)?this.foldState.get(t):e}fold(t,e){this.foldState=new Map(this.foldState).set(t,e)}renderSectionBulk(t,e){if(!Ee[t.id]||!this.bulkAllowed||!t.count||this.lay.arranging(e))return d;const i=Oe(t.id,t.entities),a=this.lay.bulkLookOf(e);return n`<span slot="actions" class="sec-bulk" data-section-bulk=${t.id} data-bulk-look=${a}>${i.map(o=>a==="icon"?n`<sw-button size="sm" iconOnly icon=${o.icon} label=${o.label} data-section-bulk-kind=${o.kind} @click=${()=>this.openCoverGroupBulk(o.kind)}></sw-button>`:n`<sw-button size="sm" icon=${a==="both"?o.icon:void 0} data-section-bulk-kind=${o.kind} @click=${()=>this.openCoverGroupBulk(o.kind)}>${o.label}</sw-button>`)}</span>`}renderSecurityStrip(t){const e=t.cards.security.entities;if(!e.length)return d;const i=a=>{const o=!a.available||a.state==="unavailable",l=a.kind==="lock"?a.locked?"lock":"unlock":a.kind==="alarm"?"shield":a.kind==="camera"?"camera":"door",r=o?"off":a.kind==="lock"?a.locked?"ok":"warn":a.kind==="alarm"?a.state==="triggered"?"bad":a.armed?"ok":"warn":a.kind==="camera"?"ok":a.state==="on"?"warn":"ok",c=a.kind==="camera"?s("מקוון"):m(a),p=n`<sw-icon .name=${l} size=${14}></sw-icon><b title=${a.name}>${f(a.name)}</b><span>${c}</span>`;return a.kind==="alarm"?n`<a class="sec-chip ${r}" href="#/security/alarm" data-sec-chip=${a.entity_id} title=${s("לאזעקה")}>${p}</a>`:n`<span class="sec-chip ${r}" data-sec-chip=${a.entity_id}>${p}</span>`};return n`<div class="sec-strip" data-security-strip role="group" aria-label=${s("אבטחה")}><span class="sec-lbl"><sw-icon name="shield" size=${15}></sw-icon>${s("אבטחה")}</span>${e.map(i)}</div>`}renderSensorsSection(t,e){const i=this.rowIndex(),a=new Map([...i].map(([u,v])=>[u,v.row])),o=[...i.values()].filter(u=>!this.extra.has(u.row.entity_id)).map(u=>u.row),{rows:l}=yt(this.lay.mainOf(t),a,o),r=new Set(l.map(u=>u.entity_id)),c=e.filter(u=>!r.has(u.entity_id));if(!l.length)return this.renderSensorGroups(e);const p=this.sensOpen.has(t),h=()=>{const u=new Set(this.sensOpen);p?u.delete(t):u.add(t),this.sensOpen=u};return this.skin.bubble?n`<div class="kv" data-main-sensors>${l.map(u=>Ie(u,ue(u)))}</div>
        ${c.length?n`<button type="button" class="bmore" data-sensors-more aria-expanded=${String(p)} @click=${h}>${p?s("הסתר חיישנים"):s("עוד {n} חיישנים",{n:c.length})}</button>${p?this.renderSensorGroups(c):d}`:d}`:n`<div class="main-sensors" data-main-sensors>${l.map(u=>this.renderMainSensor(u))}</div>
      ${c.length?n`<button type="button" class="more-sens" data-sensors-more aria-expanded=${String(p)} @click=${h}>${p?s("הסתר חיישנים"):s("עוד {n} חיישנים",{n:c.length})}</button>${p?this.renderSensorGroups(c):d}`:d}`}renderMainSensor(t){if(this.skin.bubble)return Ie(t,ue(t));const e=ue(t),i=e==="temperature"||e==="humidity"?"sensor":e==="motion"?"activity":e==="door"?"door":"sensor",a=!t.available||t.state==="unavailable",o=a?s("לא זמין"):t.domain==="sensor"&&t.value!==null&&t.value!==void 0?`${x(Number.isInteger(t.value)?t.value:t.value.toFixed(1))}${t.unit?t.unit.startsWith("°")||t.unit==="%"?t.unit:` ${t.unit}`:""}`:m(t);return n`<div class=${z({msens:!0,unavailable:a,hot:t.domain==="binary_sensor"&&t.state==="on"})} data-main-sensor=${t.entity_id} data-slot=${e??""} title=${E(t)}>
      <sw-icon .name=${i} size=${16}></sw-icon><div class="mv"><b>${o}</b><span>${f(t.name)}</span></div>
    </div>`}renderDesignPersonal(){if(!this.mayPersonalize)return d;const t=this.personalDesign();return n`<span class="design-personal" data-design-personal><label>${s("כיוון תצוגה (רק אצלי)")}
      <select data-design-personal-select @change=${e=>this.setPersonalDesign(e.target.value)}>
        <option value="" ?selected=${!t}>${s("ברירת המערכת")} · ${Re[this.installationDesign]}</option>
        ${xt.map(e=>n`<option value=${e} ?selected=${t===e}>${Re[e]}</option>`)}
      </select></label></span>`}renderArranged(t,e,i){if(!e.length)return n`<div class="count" data-card-all-hidden>${s("כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.")}</div>`;const a=i?.key??`card:${t.id}`,o=new Map(t.entities.map(l=>[l.entity_id,l]));return n`${!i&&t.id==="covers"&&!this.lay.arranging(a)?this.renderCoverGroupControl():d}<div class="tiles lay-tgrid" data-lay-tiles=${i?a:t.id}>${M(e,l=>l.id,(l,r)=>{const c=o.get(l.id),p=l.t.title?{...c,name:l.t.title}:c,h=i?i.cardOf(l.id):t.id;return this.lay.wrapTile(a,l,r,e.length,ie.has(h)?this.renderTile(p,h):this.renderRow(p,h))})}</div>`}get mediaHook(){return!D()||Y("media.read")}isScreenRow(t,e,i){return t.domain!=="media_player"?!1:t.device_class==="speaker"||t.device_class==="receiver"?i:e}renderMedia(t,e,i){const a=this.detail,o=this.mediaCount.get(t),l=o===void 0?[]:i.filter(p=>!this.isScreenRow(p,o.n>0,o.p>0)),r=this.lay.bulkLookOf(t),c=()=>this.renderRoot.querySelector(`media-area-card[data-media-card="${t}"]`)?.ask();return n`${o?.off&&!this.lay.arranging(t)?n`<span slot="actions" class="sec-bulk" data-section-bulk="media" data-bulk-look=${r}>${r==="icon"?n`<sw-button size="sm" iconOnly icon="power" label=${s("כבה הכל")} data-section-bulk-kind="screens_off" @click=${c}></sw-button>`:n`<sw-button size="sm" icon=${r==="both"?"power":void 0} data-section-bulk-kind="screens_off" @click=${c}>${s("כבה הכל")}</sw-button>`}</span>`:d}
      <media-area-card external data-media-card=${t} .areaId=${a.area.area_id} .areaName=${a.area.name} .entityIds=${e}
        @media-area-state=${p=>{const h=p.detail.players??0;o?.n===p.detail.screens&&o.p===h&&o.off===p.detail.canOff||(this.mediaCount=new Map(this.mediaCount).set(t,{n:p.detail.screens,p:h,off:p.detail.canOff}))}}></media-area-card>
      ${l.length?n`<div class="rows">${M(l,p=>p.entity_id,p=>this.renderRow(p,"media"))}</div>`:d}`}renderCustomCard(t){const e=this.lay.customOf(t);if(!e||!Me(e.type))return n``;const i=ze[e.type],a=this.lay.item(t),o=this.rowIndex(),l=g=>o.get(g)?.card??"sensors",r=Pe(a,this.customRows(t)),c=this.customRows(t),p={id:"sensors",label:i.label,entities:c,count:c.length,active:c.filter(g=>g.active).length},h=c.length?this.lay.tiles(t,c.map(g=>g.entity_id)):null,u=r.filter(g=>ie.has(l(g.entity_id))),v=r.filter(g=>!ie.has(l(g.entity_id))),$=this.skin.bubble,_=c.length?h?this.renderArranged(p,h,{key:t,cardOf:l}):r.length?e.type==="media"&&this.mediaHook?this.renderMedia(t,e.entities??null,r):$?n`<div class="bgrid" data-bubble-grid=${e.type}>${M(r,g=>g.entity_id,g=>Q(this.bubbleHost,g,l(g.entity_id)))}</div>`:n`${u.length?n`<div class="tiles">${M(u,g=>g.entity_id,g=>this.renderTile(g,l(g.entity_id)))}</div>`:d}${v.length?n`<div class="rows">${M(v,g=>g.entity_id,g=>this.renderRow(g,l(g.entity_id)))}</div>`:d}`:n`<div class="count" data-card-all-hidden>${s("כל ההתקנים בכרטיס הוסתרו בעורך הפריסה.")}</div>`:n`<div class="count" data-card-empty>${s("אין בכרטיס התקנים. בחרו התקנים בחלונית המאפיינים של הכרטיס.")}</div>`;if($){const g={...p,id:Me(e.type)&&U.includes(e.type)?e.type:"sensors",label:ae(a,i.label)};return n`<sw-card data-custom-card=${t.slice(5)} data-card-type=${e.type} data-lay-key=${t} ?data-empty=${c.length===0} data-bubble-card>${qe({id:g.id,icon:a?.icon??i.icon,label:g.label,count:c.length?`${x(c.length)}`:""})}${_}</sw-card>`}return n`<sw-card data-custom-card=${t.slice(5)} data-card-type=${e.type} data-lay-key=${t} ?data-empty=${c.length===0} heading=${ae(a,i.label)} subheading=${c.length?c.length===1?s("התקן אחד"):s("{n} התקנים",{n:c.length}):""}>
      <sw-icon slot="actions" .name=${a?.icon??i.icon} size=${18}></sw-icon>
      ${_}
    </sw-card>`}renderSensorGroups(t){const e=new Map;for(const a of t){const o=a.group??"other",l=e.get(o);l?l.push(a):e.set(o,[a])}const i=[...e.keys()].sort((a,o)=>{const l=V.indexOf(a),r=V.indexOf(o);return l===-1&&r===-1?a==="other"?1:o==="other"?-1:a.localeCompare(o):l===-1?1:r===-1?-1:l-r});return this.skin.bubble?n`<div class="sensor-groups">${i.map(a=>n`<div class="sensor-group" data-sensor-group=${a}>
        <div class="bsh">${ve[a]??a}</div>
        <div class="bgrid" data-bubble-grid="sensors">${M(e.get(a),o=>o.entity_id,o=>Q(this.bubbleHost,o,"sensors"))}</div>
      </div>`)}</div>`:n`<div class="sensor-groups">${i.map(a=>n`<div class="sensor-group" data-sensor-group=${a}>
      <div class="sensor-group-label">${ve[a]??a}</div>
      <div class="tiles">${M(e.get(a),o=>o.entity_id,o=>this.renderTile(o,"sensors"))}</div>
    </div>`)}</div>`}renderTile(t,e){if(this.skin.bubble)return Q(this.bubbleHost,t,e);const i=t.can_control&&t.available&&t.state!=="unavailable"&&(e==="lighting"||e==="switches")&&!be.has(t.domain),a=i?this.ctl.shownRow(t):t,o=!a.available||a.state==="unavailable",l=e==="lighting"?"light":e==="switches"?"bolt":"sensor",r=e==="sensors"?a.domain==="sensor"?a.value!==null&&a.value!==void 0?`${x(Number.isInteger(a.value)?a.value:a.value.toFixed(1))}${a.unit?` ${a.unit}`:""}`:a.state??"—":m(a):m(a),c=a.active&&!o;return n`<div class=${z({tile:!0,on:c,off:!c&&!o,unavailable:o,pending:i&&this.ctl.rowPendingVisible(a.entity_id)})} data-entity=${a.entity_id} data-activity=${B(I(a,m(a)))} data-active=${String(c)} data-reported=${String(t.active&&!o)} ?data-can-control=${i} title=${E(a)}>
      <div class="t"><sw-icon .name=${l} size=${15}></sw-icon><span>${f(a.name)}</span>${i?this.ctl.renderPowerToggle(a):d}</div>
      <div class="s">${o?s("לא זמין"):r}</div>
      ${e==="sensors"&&a.last_changed?n`<div class="lc" data-last-changed>${Ge(a.last_changed)}</div>`:d}
      ${i&&e==="lighting"&&we(a)&&(c||this.ctl.live(a.entity_id,"power")===!0)?this.ctl.renderBrightnessSlider(a):d}
      ${i?this.ctl.renderCmdStatus(a.entity_id):d}
      ${a.alarm_managed?n`<div class="managed-note" data-alarm-managed>${a.managed_label??s("נשלט ממסך האזעקה")} · <a href="#/security/alarm">${s("לאזעקה")}</a></div>`:d}
      ${this.renderAssignButton(a)}
    </div>`}coverLabel(t){return t.door_class?jt[t.device_class??""]??s("דלת / שער"):Ut[t.device_class??""]??s("תריס")}get coverGroupAllowed(){return this.bulkAllowed&&(this.detail?.counts.covers??0)>0}openCoverGroupBulk(t,e){const i=this.detail;i&&this.renderRoot.querySelector("devices-bulk-dialog")?.show({scope:"area",id:i.area.area_id,name:i.area.name,kind:t,position:e})}renderCoverGroupControl(){if(!this.coverGroupAllowed)return d;if(this.skin.bubble){const e=this.coverGroupPosition;return n`<sw-pill class="bgroup" variant="slider" icon="layers" label=${s("כל התריסים")} .state=${`${s("מיקום לכולם")} · ${x(e)}%`} .value=${e/100} on fill-color="var(--sw-accent-soft)" keep-text data-cover-group
        @input=${i=>this.coverGroupPosition=Math.round(i.detail.value*100)} @toggle=${()=>this.coverGroupPosition=e>0?0:100}>
        <button slot="subs" type="button" class="sb" aria-label=${s("פתח הכל")} data-cover-group-kind="covers_open" @click=${()=>this.openCoverGroupBulk("covers_open")}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="sb" aria-label=${s("עצור הכל")} data-cover-group-kind="covers_stop" @click=${()=>this.openCoverGroupBulk("covers_stop")}><sw-icon name="pause" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="sb" aria-label=${s("סגור הכל")} data-cover-group-kind="covers_close" @click=${()=>this.openCoverGroupBulk("covers_close")}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
        <button slot="subs" type="button" class="chip on" data-cover-group-kind="covers_position" @click=${()=>this.openCoverGroupBulk("covers_position",this.coverGroupPosition)}>${s("קבע {n}%",{n:x(e)})}</button>
      </sw-pill>`}const t=e=>this.coverGroupPosition=Number(e.target.value);return n`<div class="cover-group" data-cover-group>
      <span class="lbl">${s("כל התריסים")}:</span>
      <sw-button size="sm" data-cover-group-kind="covers_open" @click=${()=>this.openCoverGroupBulk("covers_open")}>${s("פתח הכל")}</sw-button>
      <sw-button size="sm" data-cover-group-kind="covers_stop" @click=${()=>this.openCoverGroupBulk("covers_stop")}>${s("עצור הכל")}</sw-button>
      <sw-button size="sm" data-cover-group-kind="covers_close" @click=${()=>this.openCoverGroupBulk("covers_close")}>${s("סגור הכל")}</sw-button>
      <input type="range" data-cover-group-position-input min="0" max="100" .value=${String(this.coverGroupPosition)} @input=${t} @click=${e=>e.stopPropagation()} aria-label=${s("מיקום לכל התריסים")} />
      <span class="ctl-val">${x(this.coverGroupPosition)}%</span>
      <sw-button size="sm" variant="primary" data-cover-group-kind="covers_position" @click=${()=>this.openCoverGroupBulk("covers_position",this.coverGroupPosition)}>${s("קבע מיקום לכולם")}</sw-button>
    </div>`}get canAssignArea(){return this.detail?.area.area_id==="unassigned"&&this.detail?.can_assign_area===!0}renderAssignButton(t){return this.canAssignArea?n`<sw-button class="assign-btn" size="sm" variant="ghost" data-assign-entity=${t.entity_id} @click=${e=>{e.stopPropagation(),this.openAssign(t)}}>${s("שייך לאזור")}</sw-button>`:d}async openAssign(t){if(this.assigning=t,this.assignTarget="",this.assignError="",this.assignBusy=!1,!this.assignAreas)try{const e=await De();this.assignAreas=this.flattenAreas(e)}catch(e){this.assignError=Z(e)}}flattenAreas(t){return t.floors.flatMap(e=>e.areas.map(i=>({area_id:i.area_id,name:i.name,floor_name:e.floor_id==="none"?null:e.name})))}async confirmAssign(){const t=this.assigning;if(!(!t||!this.assignTarget||this.assignBusy)){this.assignBusy=!0,this.assignError="";try{await kt(t.entity_id,this.assignTarget),this.assigning=null,this.load()}catch(e){this.assignError=Z(e)}finally{this.assignBusy=!1}}}renderAssignDialog(){const t=this.assigning;return t?n`<sw-dialog open data-assign-dialog="open" heading=${s("שיוך לאזור")} subheading=${f(t.name)} @close=${this.closeAssign}>
      ${this.assignError?n`<div class="assign-err" data-assign-error>${this.assignError}</div>`:d}
      ${this.assignAreas===null?n`<div class="assign-muted">${s("טוען אזורים…")}</div>`:n`<select class="assign-select" data-assign-select aria-label=${s("אזור")} @change=${e=>this.assignTarget=e.target.value}>
            <option value="" ?selected=${!this.assignTarget} disabled>${s("בחרו אזור")}</option>
            ${this.assignAreas.map(e=>n`<option value=${e.area_id} ?selected=${e.area_id===this.assignTarget}>${f(e.name)}${e.floor_name?` · ${f(e.floor_name)}`:""}</option>`)}
          </select>`}
      <div class="assign-actions">
        <sw-button data-assign-cancel autofocus @click=${this.closeAssign}>${s("ביטול")}</sw-button>
        <sw-button data-assign-confirm variant="primary" ?disabled=${!this.assignTarget||this.assignBusy} @click=${()=>void this.confirmAssign()}>${s("שייך")}</sw-button>
      </div>
    </sw-dialog>`:n`<sw-dialog data-assign-dialog="closed"></sw-dialog>`}renderRow(t,e){if(this.skin.bubble)return Q(this.bubbleHost,t,e);const i=t.can_control&&t.available&&t.state!=="unavailable"&&(e==="climate"||e==="heating"||e==="covers"||e==="media"),a=t,o=!a.available||a.state==="unavailable",l=a.active&&!o,r=i&&this.ctl.rowPendingVisible(a.entity_id);if(e==="climate"||e==="heating"){const c=a.domain==="climate";return n`<div class=${z({row:!0,on:l,unavailable:o,pending:r})} data-entity=${a.entity_id} data-activity=${B(I(a,m(a)))} data-active=${String(a.active)} ?data-can-control=${i} title=${E(a)}>
        <span class="n">${f(a.name)}</span>
        <span class="v big">${o?s("לא זמין"):c?N(a.current_temperature):m(a)}</span>
        ${c&&!o?n`<div class="d">
              <span>${s("מצב")}: ${m(a)}</span>
              ${a.hvac_action?n`<span>${oe[a.hvac_action]??a.hvac_action}</span>`:d}
              ${a.target_temperature!==null&&a.target_temperature!==void 0?n`<span>${s("יעד {t}",{t:N(a.target_temperature)})}</span>`:d}
              ${a.target_temp_low!==null&&a.target_temp_low!==void 0&&a.target_temp_high!==null&&a.target_temp_high!==void 0?n`<span>${s("טווח {low}–{high}",{low:N(a.target_temp_low),high:N(a.target_temp_high)})}</span>`:d}
              ${a.fan_mode?n`<span>${s("מאוורר")}: ${se("fan",a.fan_mode)}</span>`:d}
              ${a.preset_mode?n`<span>${s("מצב מוגדר")}: ${se("preset",a.preset_mode)}</span>`:d}
              ${a.swing_mode?n`<span>${s("נדנוד")}: ${se("swing",a.swing_mode)}</span>`:d}
              ${a.target_humidity!==null&&a.target_humidity!==void 0?n`<span>${s("לחות יעד {n}%",{n:x(a.target_humidity)})}</span>`:d}
            </div>`:a.domain==="humidifier"&&!o?n`<div class="d">
                ${a.mode?n`<span>${s("מצב")}: ${se("hmode",a.mode)}</span>`:d}
                ${a.current_humidity!==null&&a.current_humidity!==void 0?n`<span>${s("לחות {n}%",{n:x(a.current_humidity)})}</span>`:d}
                ${a.target_humidity!==null&&a.target_humidity!==void 0?n`<span>${s("יעד {t}",{t:`${x(a.target_humidity)}%`})}</span>`:d}
              </div>`:d}
        ${i?this.ctl.renderClimateControls(a):d}
        ${i?this.ctl.renderCmdStatus(a.entity_id):d}
        ${this.renderAssignButton(a)}
      </div>`}if(e==="covers"){const c=a.door_class?Wt[a.device_class??""]??"lock":"layers";return n`<div class=${z({row:!0,on:l,unavailable:o,pending:r})} data-entity=${a.entity_id} data-activity=${B(I(a,m(a)))} data-active=${String(a.active)} data-door-class=${String(!!a.door_class)} ?data-can-control=${i} title=${E(a)}>
        <span class="n nk">${a.door_class?n`<sw-icon .name=${c} size=${14}></sw-icon>`:d}<span class="nt">${f(a.name)}</span><span class="muted">· ${this.coverLabel(a)}</span></span>
        <span class="v">${m(a)}</span>
        ${a.position!==null&&a.position!==void 0&&!o?n`<div class="bar" role="img" aria-label=${s("פתוח {n}%",{n:a.position})}><i style=${`inline-size:${a.position}%`}></i></div>`:d}
        ${a.tilt!==null&&a.tilt!==void 0&&!o?n`<div class="d"><span>${s("הטיה {n}%",{n:x(a.tilt)})}</span></div>`:d}
        ${a.door_class?n`<div class="d"><span>${s("דלת / שער - תנועה של מעבר, לקריאה בלבד כאן")}</span></div>`:d}
        ${i?this.ctl.renderCoverControls(a):d}
        ${i?this.ctl.renderCmdStatus(a.entity_id):d}
        ${this.renderAssignButton(a)}
      </div>`}if(e==="security"){let c;o?c={kind:"offline",label:s("לא זמין")}:a.kind==="lock"?c=a.locked?{kind:"live",label:s("נעול")}:{kind:"stale",label:m(a)}:a.kind==="alarm"?c={kind:Ce(a.state),label:m(a)}:a.kind==="camera"?c={kind:"neutral",label:s("מצלמת התקן")}:c={kind:a.state==="on"?"stale":"neutral",label:m(a)};const p=a.kind==="lock"?a.locked?"lock":"unlock":a.kind==="alarm"?"shield":a.kind==="camera"?"camera":"sensor";return n`<div class=${z({row:!0,unavailable:o})} data-entity=${a.entity_id} data-activity=${B(I(a,m(a)))} data-kind=${a.kind??""} title=${E(a)}>
        <span class="n"><sw-icon .name=${p} size=${14}></sw-icon> ${f(a.name)}</span>
        <sw-badge kind=${c.kind} label=${c.label}></sw-badge>
        ${a.kind==="camera"?n`<div class="d"><span>${s('אין תמונה ממצלמת התקן במסך הזה עדיין; מצלמות ה־NVR מוצגות ב"מצלמות".')}</span></div>`:d}
        ${this.renderAssignButton(a)}
      </div>`}return n`<div class=${z({row:!0,on:l,unavailable:o,pending:r})} data-entity=${a.entity_id} data-activity=${B(I(a,m(a)))} data-active=${String(a.active)} ?data-can-control=${i} title=${E(a)}>
      <span class="n"><sw-icon name="play" size=${14}></sw-icon> ${f(a.name)}</span>
      <span class="v">${m(a)}</span>
      ${!o&&(a.media_title||a.source||a.volume_pct!==null)?n`<div class="d">
            ${a.media_title?n`<span>${a.media_title}</span>`:d}
            ${a.source?n`<span>${s("מקור")}: ${a.source}</span>`:d}
            ${a.volume_pct!==null&&a.volume_pct!==void 0?n`<span>${s("עוצמה {n}%",{n:x(a.volume_pct)})}${a.muted?` · ${s("מושתק")}`:""}</span>`:d}
          </div>`:d}
      ${i?this.ctl.renderMediaControls(a):d}
      ${i?this.ctl.renderCmdStatus(a.entity_id):d}
      ${this.renderAssignButton(a)}
    </div>`}};y.styles=[_t,zt,j`
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
  `,Xt,Qt,Nt];k([C()],y.prototype,"areaId",2);k([w()],y.prototype,"detail",2);k([w()],y.prototype,"fit",2);k([w()],y.prototype,"bandPage",2);k([w()],y.prototype,"bandCount",2);k([w()],y.prototype,"error",2);k([w()],y.prototype,"forbidden",2);k([w()],y.prototype,"notFound",2);k([w()],y.prototype,"sync",2);k([w()],y.prototype,"structureFlash",2);k([w()],y.prototype,"coverGroupPosition",2);k([w()],y.prototype,"assigning",2);k([w()],y.prototype,"assignAreas",2);k([w()],y.prototype,"assignTarget",2);k([w()],y.prototype,"assignBusy",2);k([w()],y.prototype,"assignError",2);k([w()],y.prototype,"prefs",2);k([w()],y.prototype,"design",2);k([w()],y.prototype,"installationDesign",2);k([w()],y.prototype,"extra",2);k([w()],y.prototype,"mediaCount",2);k([w()],y.prototype,"sensOpen",2);k([w()],y.prototype,"foldState",2);k([w()],y.prototype,"phone",2);k([w()],y.prototype,"sheet",2);k([w()],y.prototype,"quick",2);k([w()],y.prototype,"desktopArea",2);k([w()],y.prototype,"presence",2);y=k([ee("devices-area")],y);export{y as DevicesArea,m as rowLabel};
