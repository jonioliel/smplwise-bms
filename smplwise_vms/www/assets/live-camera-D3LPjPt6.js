import{j,z as x,k as l,a as L,af as $,eF as _,q as y,A as n,b as r,m as A,br as ee,bs as se,bt as te,bu as ae,cL as ie,iU as U,bX as oe,c2 as re,eu as ne,ev as le,qa as ce,iV as X,j9 as V,iW as B,qb as W,qc as de,qd as he,qe as pe,qf as me,qg as ue,qh as fe,c as be,o as f,qi as ve,aM as Y,qj as we,qk as ge,ql as $e,aX as ye,qm as G,ae as M,ai as k,jO as xe,e as ke,qn as ze,qo as Ee,qp as q,eH as R,eG as _e,p as Me,f as H,lM as Ce,qq as I,qr as Z,qs as Te,qt as Se,kl as Be,qu as Re,qv as Oe,lE as Ge,lD as qe,lN as Ie,qw as Ne,qx as Pe,j7 as je,qy as Le,iX as Ae,ag as De,qz as Ve,a8 as K,eI as C,eJ as F,e3 as J}from"./index-DMqYQw_5.js";import{f as We,b as He,c as Ze,s as Ke,d as Fe,n as Ue,e as Xe,h as O,i as Ye}from"./frigate-control-1cziwKU1.js";import{T as Je}from"./toast-controller-BPX0Tkjm.js";import"./sw-chip-Dl_Tx0XO.js";import{g as Qe,h as es,s as ss,c as z,r as ts}from"./camera-source-dialog-BNpiPkcH.js";import{c as as,a as is,s as os,b as rs,d as ns,o as ls,w as cs,e as N,f as ds,r as hs,g as ps,h as ms,i as us,j as fs}from"./nvr-CGClqjGH.js";import"./sw-week-grid-BgRQurqH.js";import{C as P}from"./media-cast-label-BWU07a0H.js";import{m as bs,a as vs}from"./map-create-CZwiYhnn.js";import{t as s}from"./live-Bj9aHAiC.js";import{f as ws}from"./frigate-text-vX6yyq1v.js";import{b as gs}from"./bubble-chrome-cp9KaWhG.js";import"./sw-logo-art-PLtEZJxU.js";import"./media-DqBt8Qa-.js";import"./ticket-create-DZg-zfQ8.js";import"./automations-glass-BtyiLfMH.js";import"./glass-4bJ7gall.js";import"./map-text-DA_ha4sK.js";import"./device-activity-logic-B5UeK7n0.js";import"./icons-Do2jBvMF.js";import"./readiness-model-DGhavIGL.js";import"./tickets-D67LjSv_.js";import"./tickets-s4-C3ovkesT.js";import"./drawer-text-C0oGnSDG.js";import"./org-locations-text-g7AdgllS.js";import"./location-picker-DzyVqtwx.js";var $s=Object.defineProperty,ys=Object.getOwnPropertyDescriptor,T=(e,t,a,i)=>{for(var o=i>1?void 0:i?ys(t,a):t,c=e.length-1,d;c>=0;c--)(d=e[c])&&(o=(i?d(t,a,o):d(o))||o);return i&&o&&$s(t,a,o),o};let E=class extends L{constructor(){super(...arguments),this.cameraId="",this.recorderId="",this.data=null,this.profiles=null,this.pending=null,this.busy=!1,this.toaster=new Je(this,{ms:3500}),this.seq=0}get msg(){return this.toaster.visible?{tone:this.toaster.tone,text:this.toaster.text}:null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load()}async load(){const e=++this.seq;if(this.data=null,this.profiles=null,!(!$()||!this.cameraId||!this.recorderId)&&!(!(await We()).has(this.recorderId)||e!==this.seq)){try{const t=await He(this.recorderId,this.cameraId);if(e!==this.seq)return;this.data=t.writable.analytics||t.writable.record?t:null}catch{this.data=null;return}try{const t=await Ze(this.recorderId);e===this.seq&&t.can_switch&&t.names.length&&(this.profiles=t)}catch{}}}flash(e,t){this.toaster.show(t,{tone:e})}ask(e){this.pending=e}cancel(){this.pending?.undo?.(),this.pending=null}async apply(e,t){if(!(!this.data&&!this.profiles)){this.busy=!0;try{if(e.group==="profile"){const a=await Ke(this.recorderId,e.to||null,t);this.profiles&&(this.profiles={...this.profiles,active:a.active})}else{const a=await Fe(this.recorderId,this.cameraId,e.feature,e.to,t);if(this.data){const i=o=>o.feature===e.feature?{...o,value:e.to}:o;this.data={...this.data,features:this.data.features.map(i),named:this.data.named?.map(i)}}a.verified?this.flash("ok",_.frigate.control.saved):this.flash("ok",_.frigate.control.unverified)}e.group==="profile"&&this.flash("ok",_.frigate.control.saved)}catch(a){e.undo?.(),this.flash("err",`${_.frigate.control.failed}: ${y(a)}`),this.load()}finally{this.busy=!1,this.pending=null}}}onSwitch(e,t,a){const i=a.currentTarget,o=i.checked,c={group:e,feature:t,to:o,undo:()=>i.checked=!o};Ue(e)?this.ask(c):this.apply(c,!1)}group(e,t,a){const i=this.data,o=Xe(i,e);return!a||!o.length?n:r`<div data-fcc-group=${e}>
      <h4>${t}</h4>
      <div class="grid">
        ${o.map(c=>r`<div class="row" data-fcc-row=${c.feature}>
          <span>${O(c.feature)}</span>
          <sw-toggle .checked=${c.value===!0} ?disabled=${this.busy} labelHidden label=${O(c.feature)} data-fcc-switch=${c.feature} @change=${d=>this.onSwitch(e,c.feature,d)}></sw-toggle>
        </div>`)}
      </div>
    </div>`}named(){const e=this.data,t=(e.named??[]).filter(i=>i.value!==null);if(!e.writable.analytics||!t.length)return n;const a=_.frigate.control;return r`<div data-fcc-group="named">
      <h4>${a.named}</h4>
      <div class="grid">
        ${t.map(i=>r`<div class="row" data-fcc-row=${i.feature}>
          <span><bdi>${O(i.feature)}</bdi></span>
          <sw-toggle .checked=${i.value===!0} ?disabled=${this.busy} labelHidden label=${O(i.feature)} data-fcc-switch=${i.feature} @change=${o=>this.onSwitch("analytics",i.feature,o)}></sw-toggle>
        </div>`)}
      </div>
    </div>`}dialog(){const e=this.pending;if(!e)return n;const t=_.frigate.control,a=e.group==="profile"?{title:`${t.profile}: ${e.to||t.noProfile}`,text:t.confirmProfile}:Ye(e.group,e.feature,e.to);return r`<sw-dialog open heading=${a.title} data-fcc-confirm @close=${()=>this.cancel()}>
      ${a.text?r`<p class="dialog-text">${a.text}</p>`:n}
      <sw-button slot="footer" data-fcc-cancel @click=${()=>this.cancel()}>${t.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcc-ok ?disabled=${this.busy} @click=${()=>void this.apply(e,!0)}>${t.confirm}</sw-button>
    </sw-dialog>`}render(){const e=this.data;if(!e&&!this.profiles)return n;const t=_.frigate.control,a=this.profiles;return r`<div class="box" data-frigate-camera-control>
      ${e?this.group("analytics",t.analytics,e.writable.analytics):n}
      ${e?this.named():n}
      ${e?this.group("record",t.record,e.writable.record):n}
      ${a?r`<div class="row" data-fcc-profile>
        <h4>${t.profile}</h4>
        <select aria-label=${t.profile} .value=${a.active??""} ?disabled=${this.busy} @change=${i=>{const o=i.currentTarget,c=a.active??"";this.ask({group:"profile",feature:"profile",to:o.value||null,undo:()=>o.value=c})}}>
          <option value="">${t.noProfile}</option>
          ${a.names.map(i=>r`<option value=${i} ?selected=${i===a.active}>${i}</option>`)}
        </select>
      </div>`:n}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcc-msg>${this.msg.text}</div>`:n}
      ${this.dialog()}
    </div>`}};E.styles=j`
    :host {
      display: block;
    }
    .box {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: var(--sw-s-3);
      display: grid;
      gap: var(--sw-s-3);
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: var(--sw-s-2) var(--sw-s-4);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      max-inline-size: 100%;
    }
    .msg {
      font-size: var(--sw-fs-xs);
    }
    .msg.ok {
      color: var(--sw-success-text);
    }
    .msg.err {
      color: var(--sw-danger-text);
    }
    .dialog-text {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
  `;T([x({attribute:"camera-id"})],E.prototype,"cameraId",2);T([x({attribute:"recorder-id"})],E.prototype,"recorderId",2);T([l()],E.prototype,"data",2);T([l()],E.prototype,"profiles",2);T([l()],E.prototype,"pending",2);T([l()],E.prototype,"busy",2);E=T([A("frigate-camera-control")],E);const D={section:"הפעלה מחדש של המצלמה",button:"הפעל מחדש את המצלמה…",lead:"המצלמה תופעל מחדש דרך ה־NVR. במשך דקה–שתיים אין ממנה וידאו חי ואין הקלטה.",dialogTitle:"הפעלה מחדש של המצלמה",dialogSub:"{name} · ערוץ {channel}",dialogText:"המצלמה תתנתק לדקה–שתיים: אין וידאו חי ואין הקלטה של המצלמה הזו עד שתחזור. שאר המצלמות וה־NVR ממשיכים לעבוד. הפעולה נרשמת ביומן.",confirm:"הפעל מחדש",cancel:"ביטול",sending:"שולח…",done:"פקודת ההפעלה מחדש נשלחה. המצלמה תחזור בעוד דקה–שתיים.",reasonNotSupported:"ה־NVR הזה אינו מאפשר הפעלה מחדש של מצלמה מכאן.",reasonNoPermission:"אין לך הרשאה להפעיל מחדש מצלמות. מנהל המערכת יכול להעניק אותה.",reasonWritesOff:"שינויים ב־NVR כבויים. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.",reasonCooldown:"המצלמה הופעלה מחדש לפני רגע. אפשר לנסות שוב בעוד {min} דק׳.",errorRateLimited:"יותר מדי הפעלות מחדש ברצף. נסו שוב בעוד כמה דקות.",errorRejected:"ה־NVR דחה את הפקודה. המצלמה לא הופעלה מחדש.",errorUnavailable:"ה־NVR אינו זמין כרגע. המצלמה לא הופעלה מחדש.",errorForbidden:"אין הרשאה לפעולה הזו.",errorGeneric:"הפעולה נכשלה. המצלמה לא הופעלה מחדש."},Q=se("en","i18n/camera-reboot","en");function xs(){return te(["en"])}const ks={he:D,en:Q};function b(e,t,a=xs()){const i=ks[a][e]??D[e]??e;return ee(i,t)}ae("i18n/camera-reboot",{he:D,en:Q});const zs={not_supported:"reasonNotSupported",no_permission:"reasonNoPermission",writes_off:"reasonWritesOff",cooldown:"reasonCooldown"};function Es(e,t=!1){if(!e||!e.supported)return{shown:!1,enabled:!1,reason:""};if(e.can_reboot)return{shown:!0,enabled:!t,reason:""};const a=zs[e.reason??""]??"errorGeneric",i=Math.max(1,Math.ceil((e.cooldown_s||0)/60));return{shown:!0,enabled:!1,reason:b(a,{min:i})}}function _s(e){const t=typeof e=="object"&&e!==null&&"status"in e?Number(e.status):0,a=typeof e=="object"&&e!==null&&"code"in e?String(e.code??""):"";return a==="nvr_writes_off"?b("reasonWritesOff"):a==="camera_reboot_not_supported"||a==="nvr_not_supported"?b("reasonNotSupported"):a==="rate_limited"||t===429?b("errorRateLimited"):a==="nvr_rejected"?b("errorRejected"):a.startsWith("source_")||t===503?b("errorUnavailable"):b(t===403?"errorForbidden":"errorGeneric")}var Ms=Object.defineProperty,Cs=Object.getOwnPropertyDescriptor,w=(e,t,a,i)=>{for(var o=i>1?void 0:i?Cs(t,a):t,c=e.length-1,d;c>=0;c--)(d=e[c])&&(o=(i?d(t,a,o):d(o))||o);return i&&o&&Ms(t,a,o),o};const Ts={confirmed:P.confirmed,likely:P.likely,unknown:P.unknown,manual:ie("נקבע ידנית")};let v=class extends L{constructor(){super(...arguments),this.open=!1,this.cameraId="",this.cameraName="",this.anchor=null,this.profile="sub",this.phone=!1,this.ddPhone="",this.remote=!1,this.data=null,this.loading=!1,this.error="",this.busyKey="",this.confirm=null,this.quality="sub",this.watch=new U(this),this.onKey=e=>{e.key!=="Escape"||!this.open||this.mode()!=="sheet"&&!oe(this,e)||this.close()},this.onDoc=e=>{if(!this.open||this.mode()==="sheet")return;const t=e.composedPath();t.includes(this)||this.anchor&&t.includes(this.anchor)||this.close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.onKey),document.addEventListener("pointerdown",this.onDoc,!0)}disconnectedCallback(){document.removeEventListener("keydown",this.onKey),document.removeEventListener("pointerdown",this.onDoc,!0),re(this),super.disconnectedCallback()}willUpdate(e){e.has("open")&&this.open&&(this.error="",this.confirm=null,this.quality=this.profile==="main"?"main":"sub",this.load())}updated(e){ne(this,this.open&&this.mode()!=="sheet",le),this.open&&this.mode()==="pop"&&(e.has("open")||e.has("data"))&&this.place()}mode(){const e=ce({phone:this.phone,ddPhone:this.ddPhone});return e==="panel"?"pop":e}async load(){this.loading=!0;try{this.data=await X(this.cameraId||void 0)}catch(e){this.data=null,this.error=y(e)}finally{this.loading=!1}}place(){const e=this.renderRoot.querySelector(".panel.pop"),t=this.anchor;if(!e||!t)return;const a=t.getBoundingClientRect(),i=e.offsetHeight,o=e.offsetWidth,d=a.top-8-i>=8?a.top-8-i:Math.min(window.innerHeight-i-8,a.bottom+8);let u=getComputedStyle(this).direction==="rtl"?a.right-o:a.left;u=Math.max(8,Math.min(window.innerWidth-o-8,u)),e.style.top=`${Math.max(8,d)}px`,e.style.left=`${u}px`}close(){this.confirm=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}mineOn(e){const t=V(B.sessions,e);return t&&t.mine?t:null}async pick(e,t=!1,a=!1){if(!W(e)||this.busyKey||!this.cameraId)return;if(de(e)&&!a){this.confirm={target:e,permanent:t};return}this.confirm=null,this.busyKey=e.key,this.error="";const i=this.quality==="main"&&e.main_allowed?"main":"sub";try{const o=this.mineOn(e.key),c=o&&o.can.switch&&!t&&o.camera_id!==this.cameraId?await he(o.session_id,{camera_id:this.cameraId,profile:i}):await pe({target_key:e.key,camera_id:this.cameraId,profile:i,duration:t?"permanent":"default",client_request_id:me(),confirmed:a||void 0});if(B.put(c.session),c.status==="refused"){this.error=ue(c.error),this.dispatchEvent(new CustomEvent("cast-error",{detail:{message:this.error},bubbles:!0,composed:!0}));return}fe(e.key),this.dispatchEvent(new CustomEvent("cast-started",{detail:{session:c.session},bubbles:!0,composed:!0})),this.close()}catch(o){o instanceof be&&o.body.code==="cast_busy"&&!a?this.confirm={target:e,permanent:t}:(this.error=y(o),this.dispatchEvent(new CustomEvent("cast-error",{detail:{message:this.error},bubbles:!0,composed:!0})),this.load())}finally{this.busyKey=""}}row(e){const t=this.mineOn(e.key),a=!!t&&t.camera_id===this.cameraId,i=!W(e)||a,o=V(B.sessions,e.key),c=a?`${f("cast.stateCasting")}: ${this.cameraName||t?.camera_name||""}`:ve(e,o),d=[e.area_name].filter(Boolean).join(" · "),p=e.confidence&&!e.blocked?Ts[e.confidence]:"";return r`<div class="row-wrap" data-cast-target=${e.key}>
      <button type="button" class=${`row ${e.state==="casting"?"casting":""}`} aria-disabled=${i?"true":"false"} data-cast-state=${e.state} data-cast-blocked=${e.blocked??""}
        @click=${()=>i?void 0:void this.pick(e)}>
        <span class="ic"><sw-icon name=${e.blocked?"lock":"media"} size=${18}></sw-icon></span>
        <span class="tx"><span class="nm">${e.name}</span><span class=${`ln ${e.state==="playing_music"?"warn":""}`}>${d?`${d} · `:""}${this.busyKey===e.key?f("cast.starting"):c}</span></span>
        ${p?r`<sw-badge kind=${e.confidence==="confirmed"?"live":"neutral"} label=${p}></sw-badge>`:n}
      </button>
      ${e.permanent_allowed&&!i?r`<button type="button" class="perm" data-cast-permanent title=${f("cast.durationPermanent")} aria-label=${`${f("cast.durationPermanent")}: ${e.name}`} @click=${()=>void this.pick(e,!0)}>${f("cast.pillPermanent")}</button>`:n}
      ${a&&t?r`<sw-cast-stop .session=${t} variant="ghost"></sw-cast-stop>`:n}
    </div>`}body(){const e=this.data,t=Y("system.configure");if(this.loading&&!e)return r`<div class="state" role="status" data-cast-loading>${f("cast.loading")}</div>`;if(!e)return this.error?r`<div class="err" role="alert" data-cast-error>${this.error}</div>`:r`${n}`;if(!e.ready)return r`<div class="state" role="status" data-cast-notready>${we(e.reason,t)}</div>`;const a=ge(e.targets,$e()),i=e.main_possible;return r`
      <div class="opts" data-cast-quality>
        <span>${f("camera.quality")}</span>
        <sw-segmented label=${f("camera.quality")} value=${this.quality} @change=${o=>this.quality=o.detail.value==="main"?"main":"sub"}
          .options=${[{value:"sub",label:f("cast.profileSub"),attrs:{"data-cast-q":"sub"}},{value:"main",label:f("cast.profileMain"),disabled:!i,title:i?"":f("cast.profileMainNo"),attrs:{"data-cast-q":"main"}}]}></sw-segmented>
      </div>
      ${this.error?r`<div class="err" role="alert" data-cast-error>${this.error}</div>`:n}
      ${this.confirm?r`<div class="ask" role="alertdialog" aria-label=${f("cast.confirmBusy")} data-cast-confirm>
            <span>${this.confirm.target.name}: ${f("cast.confirmBusy")}</span>
            <div class="btns"><button type="button" class="yes" data-cast-confirm-yes @click=${()=>void this.pick(this.confirm.target,this.confirm.permanent,!0)}>${f("cast.confirmBusyYes")}</button>
              <button type="button" class="no" data-cast-confirm-no @click=${()=>this.confirm=null}>${f("actions.cancel")}</button></div>
          </div>`:n}
      <div class="body" data-cast-list>
        ${a.length?a.map(o=>r`<div class="grp" data-cast-group=${o.id}>${o.title}</div>${o.targets.map(c=>this.row(c))}`):r`<div class="state" data-cast-empty>${f("cast.empty")}</div>`}
      </div>
      ${this.remote?r`<div class="note" data-cast-remote-note>${f("cast.remoteNote")}</div>`:n}`}head(e){return r`<header><div><h3>${f("cast.pickerTitle")}</h3>${this.cameraName?r`<div class="sub">${f("cast.pickerFor")} ${this.cameraName}</div>`:n}</div>
      ${e?r`<button type="button" class="x" aria-label=${f("cast.close")} data-cast-close @click=${()=>this.close()}><sw-icon name="close" size=${16}></sw-icon></button>`:n}</header>`}foot(){const e=this.data;return r`<footer><span>${e&&e.ready?`${e.active}/${e.max_sessions}`:""}</span>
      <a class="link" data-cast-mine href="#/multimedia/cast" @click=${t=>{t.preventDefault(),this.close(),location.hash="#/multimedia/cast"}}>${f("cast.mineLink")}</a></footer>`}render(){if(!this.open)return n;const e=this.mode();return this.watch,e==="sheet"?r`<sw-sheet open kind="sheet" @close=${()=>this.close()}>
        <div class="panel sheet" data-cast-picker="sheet" role="region" aria-label=${f("cast.sheetRegion")}>${this.head(!1)}${this.body()}${this.foot()}</div></sw-sheet>`:r`<div class=${`panel ${e}`} data-cast-picker=${e} role="dialog" aria-label=${f("cast.sheetRegion")}>${this.head(!0)}${this.body()}${this.foot()}</div>`}};v.styles=j`
    :host {
      display: contents;
    }
    .panel {
      box-sizing: border-box;
      background: var(--sw-surface);
      color: var(--sw-text);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .panel.pop {
      position: fixed;
      z-index: var(--sw-z-drawer);
      inline-size: min(380px, calc(100vw - 24px));
      max-block-size: min(70vh, 560px);
      /* the anchored picker floats over the page like a menu: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border-color: var(--sw-menu-border);
    }
    .panel.list {
      inline-size: 100%;
      margin-block-start: 10px;
      max-block-size: 60vh;
    }
    .panel.sheet {
      border: 0;
      box-shadow: none;
      background: transparent;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px 6px;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .x {
      all: unset;
      box-sizing: border-box;
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .x:hover {
      background: var(--sw-surface-3);
    }
    .x:focus-visible,
    .row:focus-visible,
    .perm:focus-visible,
    .link:focus-visible,
    .yes:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .opts {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 14px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* CR-CMP2-SEGMENTED-C-2450: the quality choice is sw-segmented; the picker keeps its small pill (2 px track, 24 px key, the
       extra-small regular label also when chosen). DARK-REVIEW-2342: the bare accent read ~2.2:1 on the lifted dark thumb - dark takes
       the accent's text ink, light keeps the accent */
    sw-segmented {
      --sw-seg-pad: 2px;
      --sw-seg-radius: var(--sw-r-pill);
      --sw-seg-btn-radius: var(--sw-r-pill);
      --sw-seg-h: 24px;
      --sw-seg-key-pad: 12px;
      --sw-seg-fs: var(--sw-fs-xs);
      --sw-seg-fw: var(--sw-fw-regular);
      --sw-seg-on-fw: var(--sw-fw-regular);
      --sw-seg-on-fg: var(--sw-seg-key-ink, light-dark(var(--sw-accent, var(--sw-text)), var(--sw-accent-text)));
      /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
      --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface));
    }
    .body {
      overflow: auto;
      padding: 0 8px 6px;
    }
    .grp {
      margin: 8px 6px 2px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    .row-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .row {
      all: unset;
      box-sizing: border-box;
      flex: 1;
      min-inline-size: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 8px;
      border-radius: var(--sw-r-md);
      cursor: pointer;
      min-block-size: 44px;
    }
    .row:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-3);
    }
    .row[aria-disabled='true'] {
      cursor: default;
      opacity: 0.6;
    }
    .ic {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .row.casting .ic {
      background: color-mix(in srgb, var(--sw-live) 18%, var(--sw-surface));
      color: var(--sw-live);
    }
    .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
    }
    .nm {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ln {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ln.warn {
      color: var(--sw-stale);
    }
    .perm {
      all: unset;
      box-sizing: border-box;
      flex: none;
      padding: 4px 10px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .perm:hover {
      background: var(--sw-surface-3);
    }
    .err,
    .state {
      margin: 4px 14px 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .err {
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface));
      color: var(--sw-danger);
    }
    .state {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .ask {
      margin: 6px 8px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-surface));
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .ask .btns {
      display: flex;
      gap: 8px;
    }
    .yes,
    .no {
      all: unset;
      box-sizing: border-box;
      padding: 6px 14px;
      border-radius: var(--sw-r-pill);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
    }
    .yes {
      background: var(--sw-accent);
      border-color: transparent;
      color: var(--sw-text-inverse);
    }
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 14px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .link {
      all: unset;
      cursor: pointer;
      color: var(--sw-accent);
      font-size: var(--sw-fs-xs);
    }
    .note {
      padding: 0 14px 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
  `;w([x({type:Boolean,reflect:!0})],v.prototype,"open",2);w([x()],v.prototype,"cameraId",2);w([x()],v.prototype,"cameraName",2);w([x({attribute:!1})],v.prototype,"anchor",2);w([x()],v.prototype,"profile",2);w([x({type:Boolean})],v.prototype,"phone",2);w([x()],v.prototype,"ddPhone",2);w([x({type:Boolean})],v.prototype,"remote",2);w([l()],v.prototype,"data",2);w([l()],v.prototype,"loading",2);w([l()],v.prototype,"error",2);w([l()],v.prototype,"busyKey",2);w([l()],v.prototype,"confirm",2);w([l()],v.prototype,"quality",2);v=w([A("sw-cast-picker")],v);const Ss=[j`
    /* the detection-zones view (renderZones). Here, not in a <style> element of the template: the remote channel's strict
       CSP (style-src-elem 'self', CR-008 P2) refuses inline style elements; static styles are constructed stylesheets */
    .zones .frame { position: relative; aspect-ratio: 16 / 9; background: var(--sw-video-bg); border-radius: var(--sw-r-sm); overflow: hidden; }
    .zones .frame img { inline-size: 100%; block-size: 100%; object-fit: fill; display: block; }
    .zones .frame svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
    /* POLISH4-WP2: the overlays drawn over the video take tokens of the video domain (fixed in both schemes, as the picture is):
       motion cells the timeline's motion tone, a mask the video ink, a field the warning tone, a line the recorded blue */
    .zones .cell { fill: color-mix(in srgb, var(--sw-tl-motion) 28%, transparent); stroke: color-mix(in srgb, var(--sw-tl-motion) 55%, transparent); stroke-width: 1; }
    .zones .mask { fill: color-mix(in srgb, var(--sw-video-bg) 78%, transparent); stroke: var(--sw-video-bg); stroke-width: 3; }
    .zones .field { fill: color-mix(in srgb, var(--sw-warning) 25%, transparent); stroke: var(--sw-warning); stroke-width: 4; }
    .zones .line { fill: none; stroke: var(--sw-recorded); stroke-width: 6; }
    .zones .handle { stroke: var(--sw-on-video); stroke-width: 3; }
    .zones .handle.field { fill: var(--sw-warning); stroke-width: 3; }
    .zones .handle.line { fill: var(--sw-recorded); stroke-width: 3; }
    .zones .line.off { stroke-dasharray: 14 10; opacity: 0.6; }
    .zones .legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-block-start: 8px; }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      /* owner report: on a wide desktop (design A has no page max-width), a 16:9 box at full page width grows
         taller than the viewport - the controls and settings below need a scroll to even see they exist. Capping
         the height (the width then follows from the ratio) keeps the whole screen reachable without scrolling. */
      max-block-size: min(60dvh, 640px);
      inline-size: 100%;
      margin-inline: auto;
      overflow: hidden;
      background: var(--sw-video-bg);
      color: var(--sw-on-video);
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, color-mix(in srgb, var(--sw-video-scrim) 18%, transparent) 0%, transparent 25%, transparent 65%, color-mix(in srgb, var(--sw-video-scrim) 82%, transparent) 100%);
      pointer-events: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: var(--sw-fs-2xs);
      letter-spacing: 0.04em;
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 2px 7px;
      z-index: 2;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 10px;
      font-family: var(--sw-font-mono);
      direction: ltr;
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px var(--sw-video-scrim);
    }
    .quality {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 10px;
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px var(--sw-video-scrim);
      direction: ltr;
      z-index: 2;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    /* EVIDENCE-CAMERAS-2412: the "no WebRTC server" link was the browser's default blue on the dark video area */
    .center[data-webrtc-required] a {
      color: inherit;
      font-weight: var(--sw-fw-semibold);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .cast-status {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-block-start: 10px;
      padding: 8px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      font-size: var(--sw-fs-sm);
    }
    .cast-status[data-cast-status-state='not_confirmed'] {
      border-color: var(--sw-danger);
    }
    .cast-status .who {
      font-weight: var(--sw-fw-medium);
    }
    .cast-status .low {
      color: var(--sw-stale);
    }
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .round {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
    }
    .round button {
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .round button:hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .round button:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: not-allowed;
    }
    .round button,
    .zoom button,
    .joy button {
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .round button:active,
    .zoom button:active,
    .joy button:active {
      transform: scale(0.94);
    }
    .round button:focus-visible,
    .zoom button:focus-visible,
    .joy button:focus-visible,
    .round .transport button:focus-visible,
    summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (prefers-reduced-motion: reduce) {
      .round button:active,
      .zoom button:active,
      .joy button:active {
        transform: none;
      }
    }
    .round .q {
      inline-size: auto;
      border-radius: var(--sw-r-pill);
      font: inherit;
    }
    .round .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .transport {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .round .transport button {
      display: inline-block;
      inline-size: auto;
      border: 0;
      background: transparent;
      box-shadow: none;
      font: inherit;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .round .transport button.on {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .ptz {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .joy {
      position: relative;
      inline-size: 64px;
      block-size: 64px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    .joy button {
      position: absolute;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      border-radius: 50%;
    }
    .joy .u {
      inset-block-start: 3px;
      inset-inline-start: 22px;
    }
    .joy .d {
      inset-block-end: 3px;
      inset-inline-start: 22px;
    }
    .joy .l {
      inset-inline-start: 3px;
      inset-block-start: 22px;
    }
    .joy .r {
      inset-inline-end: 3px;
      inset-block-start: 22px;
    }
    .joy .c {
      inset-inline-start: 26px;
      inset-block-start: 26px;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .zoom {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zoom button {
      inline-size: 28px;
      block-size: 28px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .modes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      margin: 0;
    }
    dd {
      margin: 0;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30: 464 px at 1366x768). The wrappers are inert
       below 1024 px (display: contents: the tablet and the phone keep the stacked page). From 1024 px the page takes the screen's
       height and splits in two: the player column (the video as large as the room allows at 16:9, its controls under it, always on
       screen) and a side column with the details / settings, which scrolls inside itself when the settings are opened. */
    .stage,
    .stage-main,
    .stage-side,
    .vbox {
      display: contents;
    }
    @media (min-width: 1024px) {
      sw-page {
        block-size: 100%;
      }
      .stage {
        display: grid;
        grid-template-columns: minmax(0, 1fr) clamp(300px, 27vw, 400px);
        gap: 14px;
        flex: 1 1 0;
        min-block-size: 0;
      }
      .stage-main {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
        min-inline-size: 0;
      }
      .vbox {
        display: block;
        /* as tall as 16:9 of the column when there is room (the controls sit right under the picture), shorter when there is not
           (the picture then narrows to keep 16:9, centred) */
        aspect-ratio: 16 / 9;
        flex: 0 1 auto;
        min-block-size: 160px;
        container-type: size;
      }
      .vbox > .video {
        inline-size: min(100cqw, calc(100cqh * 16 / 9));
        max-block-size: none;
      }
      .stage-side {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-block-size: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        /* room for the cards' shadow and the focus ring inside the scroller */
        padding: 2px 4px 6px;
        margin: -2px -4px 0;
      }
      .stage-side > .grid {
        grid-template-columns: minmax(0, 1fr);
        margin-block-start: 0;
      }
      .stage-side > .acc-root {
        margin-block-start: 0;
      }
    }
    /* settings accordion (owner round 4, 2.6): the video keeps its place, everything below starts collapsed
       under one "camera settings" toggle, and each setting inside is its own collapsed row. */
    .acc-root {
      margin-block-start: 12px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .acc-root > summary {
      padding: 12px 14px;
    }
    .acc-root[open] > summary {
      border-block-end: 1px solid var(--sw-border);
    }
    .acc-body {
      padding: 4px 14px 8px;
      display: flex;
      flex-direction: column;
    }
    summary {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary .chev {
      flex: none;
      color: var(--sw-text-3);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    details[open] > summary .chev {
      transform: rotate(90deg);
    }
    .acc {
      border-block-start: 1px solid var(--sw-border);
    }
    .acc > summary {
      padding: 10px 2px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      justify-content: space-between;
    }
    .acc > summary .lbl {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .acc-content {
      padding: 0 2px 12px;
    }
    /* R5-LIVE-297 (the HOMEFABLE method on the single camera): the picture is the hero (radius 2xl, the third shadow); the stream
       choice is a pair of raised keys with the chosen one a filled accent key, 14 px bold; the round tools are 42 px raised keys that
       sink on pointer-down and tint on hover only under a fine pointer; the details card's facts are WELLS (label over a 15 px bold
       value) instead of grey label / value text; a camera that is down is a filled offline field */
    .video {
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--sw-shadow-3);
    }
    .video.off {
      background: color-mix(in srgb, var(--sw-offline) 40%, var(--sw-surface-3));
      box-shadow: var(--sw-shadow-1);
    }
    .stamp {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .quality {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
    }
    /* visible-difference test (50 %): on a desktop the picture is most of the frame, so the tool row became a tier-2 strip - the
       surface, the first shadow, rounded - that reads as the camera's control deck under the hero */
    .controls {
      margin-block-start: 14px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .round button {
      border-color: var(--sw-border);
      color: var(--sw-heading);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .round button:hover {
      background: var(--sw-surface);
      color: var(--sw-heading);
    }
    @media (hover: hover) and (pointer: fine) {
      .round button:hover:not(:disabled) {
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-2);
      }
      /* DARK-SEG-ALL-2380: a hovered chosen transport key keeps the dark light pill (its label is the key's dark ink); light: surface-2 as before */
      .round .transport button.on:hover:not(:disabled) {
        background: var(--sw-seg-key, var(--sw-surface-2));
      }
    }
    .round button:active:not(:disabled),
    .zoom button:active,
    .joy button:active {
      transform: scale(var(--sw-press-scale, 0.94));
      box-shadow: none;
    }
    .round .q {
      font-variant-numeric: tabular-nums;
    }
    .round .q.on,
    .round .q.on:hover {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-primary);
    }
    .grid {
      gap: 16px;
      margin-block-start: 16px;
    }
    /* each label / value pair is one well row: the two cells share the surface-2 fill and round the row's outer corners */
    dl {
      gap: 5px 0;
      font-size: var(--sw-fs-md);
    }
    dt,
    dd {
      display: flex;
      align-items: center;
      min-block-size: 40px;
      padding: 6px 12px;
      background: var(--sw-surface-2);
    }
    dt {
      color: var(--sw-text-2);
      border-start-start-radius: var(--sw-r-md);
      border-end-start-radius: var(--sw-r-md);
    }
    dd {
      min-inline-size: 0;
      justify-content: flex-end;
      text-align: end;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-variant-numeric: tabular-nums;
      border-start-end-radius: var(--sw-r-md);
      border-end-end-radius: var(--sw-r-md);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .acc-root {
      border-radius: var(--sw-r-lg);
    }
    .acc-root > summary {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    @media (prefers-reduced-motion: reduce) {
      .round button:active:not(:disabled) {
        transform: none;
      }
    }
    /* R5-LIVE-297 Fable pass (the Opus deck was a full-width strip, 80 % empty, that vanished in the flat skins): the deck hugs its
       keys - a raised remote (radius xl, the second shadow) at the start edge under the picture, not a band; 44 px keys with the first
       shadow, the stream choice 40 px / 15 px bold with the chosen one a filled accent key; the player's state is a filled field in the
       deck (the same slot as the old "playing through…" note, so the order of controls is unchanged); a camera that is down shows a
       64 px ring with its reason in 15 px semibold */
    .controls {
      inline-size: fit-content;
      max-inline-size: 100%;
      margin-inline-end: auto;
      padding: 10px 12px;
      gap: 10px 14px;
      border-color: transparent;
      border-radius: var(--sw-r-xl);
      /* loop 1: in the flat skins (tesla, Arx Infra, Arx Soft) a surface deck with a faint shadow melted into the page - the deck is a
         7 % tone step in the heading ink, so it reads as a tray in every skin, light and dark, and the surface keys float on it */
      background: color-mix(in srgb, var(--sw-heading) 7%, var(--sw-surface));
      box-shadow: var(--sw-shadow-2);
    }
    .round {
      gap: 8px;
    }
    .round button {
      inline-size: 44px;
      block-size: 44px;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    .round .q {
      block-size: 40px;
      padding-inline: 16px;
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .round .transport {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      padding: 3px;
    }
    .round .transport button {
      block-size: 34px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
    }
    .controls > .note {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      padding: 0 14px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--sw-live) 20%, var(--sw-surface));
      color: var(--sw-heading);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      white-space: nowrap;
    }
    .controls > .note::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
      flex: none;
    }
    .controls[data-player='error'] > .note {
      background: color-mix(in srgb, var(--sw-danger) 20%, var(--sw-surface));
    }
    .controls[data-player='error'] > .note::before {
      background: var(--sw-danger);
    }
    .controls[data-player='connecting'] > .note {
      background: color-mix(in srgb, var(--sw-stale) 22%, var(--sw-surface));
    }
    .controls[data-player='connecting'] > .note::before {
      background: var(--sw-stale);
    }
    .video.off .center {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .video.off .center > div {
      gap: 12px;
      max-inline-size: 36ch;
    }
    .video.off .center sw-icon {
      inline-size: 64px;
      block-size: 64px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
      color: var(--sw-offline-text, var(--sw-text-2));
    }
    .acc-root {
      border-color: transparent;
      box-shadow: var(--sw-shadow-2);
    }
  `,gs];var Bs=Object.defineProperty,Rs=Object.getOwnPropertyDescriptor,m=(e,t,a,i)=>{for(var o=i>1?void 0:i?Rs(t,a):t,c=e.length-1,d;c>=0;c--)(d=e[c])&&(o=(i?d(t,a,o):d(o))||o);return i&&o&&Bs(t,a,o),o};let h=class extends L{constructor(){super(...arguments),this.bubbleSkin=new ye(this),this.cameraId="cam-1",this.mapTicket=!1,this.cam=null,this.zones=null,this.zonesBusy=!1,this.zonesError="",this.motionEdit=null,this.motionConfirm=!1,this.motionBusy=!1,this.motionMsg="",this.paintValue=null,this.rec=null,this.osd=null,this.sched=null,this.schedError="",this.schedTab="motion",this.schedEdit=null,this.schedBusy=!1,this.schedMsg="",this.schedConfirm=!1,this.smart=null,this.smartEdit=null,this.smartBusy=!1,this.smartMsg="",this.osdMsg="",this.renameTo=null,this.renameBusy=!1,this.renameMsg="",this.osdBusy=!1,this.recMinutes=10,this.recBusy=!1,this.recMsg="",this.recTimer=0,this.reboot=null,this.rebootOpen=!1,this.rebootBusy=!1,this.rebootMsg="",this.source=null,this.sourceOpen=!1,this.sourceMsg="",this.camGen=0,this.zoneLayers={motion:!0,privacy:!0,intrusion:!0,lines:!0},this.caps=null,this.capsError="",this.cams=[],this.canConfigure=!1,this.settings=null,this.error="",this.loading=!0,this.profile="main",this.transport="auto",this.playerStatus="",this.playerTransport="",this.posterBust=Date.now(),this.ptzMode="presets",this.castShown=!1,this.castOpen=!1,this.castNote="",this.castWatch=new U(this),this.castNoteTimer=0}resetCameraState(){this.camGen++,window.clearTimeout(this.recTimer),window.clearTimeout(this.castNoteTimer),this.mapTicket=!1,this.zones=null,this.zonesBusy=!1,this.zonesError="",this.motionEdit=null,this.motionConfirm=!1,this.motionBusy=!1,this.motionMsg="",this.paintValue=null,this.rec=null,this.recBusy=!1,this.recMsg="",this.osd=null,this.osdBusy=!1,this.osdMsg="",this.sched=null,this.schedError="",this.schedEdit=null,this.schedBusy=!1,this.schedMsg="",this.schedConfirm=!1,this.smart=null,this.smartEdit=null,this.smartBusy=!1,this.smartMsg="",this.renameTo=null,this.renameBusy=!1,this.renameMsg="",this.reboot=null,this.rebootOpen=!1,this.rebootBusy=!1,this.rebootMsg="",this.source=null,this.sourceOpen=!1,this.sourceMsg="",this.caps=null,this.capsError="",this.castShown=!1,this.castOpen=!1,this.castNote="",this.playerStatus="",this.playerTransport="",$()&&(this.loading=!0)}draftTarget(e){const t=this.cam;return t&&t.id===e&&e===this.cameraId?t:null}async loadSource(){if(!this.cam||!$()||!Y("system.configure")){this.source=null;return}const e=this.camGen;try{const t=await Qe(this.cam.id);e===this.camGen&&(this.source=t)}catch{e===this.camGen&&(this.source=null)}}renderSource(e){if(!this.source)return n;const t=es(this.source);return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-camera-source=${this.source.mode}>
      <span>${ss(this.source,e)}</span>
      ${t?r`<span data-camera-source-health=${t.tone} style=${t.tone==="bad"?"color:var(--sw-danger-text, var(--sw-danger))":t.tone==="ok"?"color:var(--sw-success-text, var(--sw-success))":""}>${t.text}</span>`:n}
      <sw-button size="sm" variant="ghost" icon="edit" data-camera-source-open @click=${()=>{this.sourceMsg="",this.sourceOpen=!0}}>${z("change")}</sw-button>
      ${this.sourceMsg?r`<span role="status" data-camera-source-msg>${this.sourceMsg}</span>`:n}
    </div>
    <camera-source-dialog mode="edit" .open=${this.sourceOpen} camera-id=${e.id} camera-name=${e.name} @close=${()=>this.sourceOpen=!1}
      @saved=${()=>{this.sourceMsg=z("saved"),this.loadSource(),this.posterBust=Date.now(),this.player?.reconnect()}}></camera-source-dialog>`}async loadSchedules(){if(!this.cam||!$())return;if(!G()){this.sched=null,this.smart=null,this.schedError=s("לוחות הזמנים וחוקי ה־smart של המקליט נקראים עם הרשאת ניהול מקליט.");return}const e=this.camGen,t=this.cam.id;try{const a=await as(t);if(e!==this.camGen)return;this.sched=a,this.schedError="",!this.sched.arming[this.schedTab]&&this.schedTab!=="record"&&(this.schedTab=Object.keys(this.sched.arming)[0]??"record")}catch(a){if(e!==this.camGen)return;this.schedError=y(a)}try{const a=await is(t);e===this.camGen&&(this.smart=a)}catch{e===this.camGen&&(this.smart=null)}}startSchedEdit(){const e=this.sched;if(!e)return;const t=this.schedTab,a=(t==="record"?e.record?.days:e.arming[t])??Array.from({length:7},()=>[]);this.schedMsg="",this.cam&&(this.schedEdit={camId:this.cam.id,kind:t,days:a.map(i=>i.map(o=>({...o}))),schedule_enabled:e.record?.schedule_enabled??null,enabled:e.record?.enabled})}schedDiff(){const e=this.schedEdit,t=this.sched;if(!e||!t)return 0;const a=(e.kind==="record"?t.record?.days:t.arming[e.kind])??[],i=o=>o.map(c=>c.map(d=>`${d.begin}-${d.end}-${d.mode??""}`).join(",")).join("|");return i(a)===i(e.days)?0:1}async saveSched(){const e=this.schedEdit;if(!e||!this.cam||this.schedBusy)return;const t=this.draftTarget(e.camId);if(!t){this.refuseStaleDraft("sched");return}const a=this.camGen;this.schedBusy=!0,this.schedConfirm=!1;try{const i=e.kind==="record"?await os(t.id,{days:e.days,...e.schedule_enabled!==null&&e.schedule_enabled!==this.sched?.record?.schedule_enabled?{schedule_enabled:e.schedule_enabled??void 0}:{}}):await rs(t.id,e.kind,e.days);if(a!==this.camGen)return;this.schedMsg=i.status==="unchanged"?s("המקליט כבר היה במצב הזה — לא נכתב דבר."):s("הלוח נכתב למקליט ונרשם (ניתן להחזרה מרשימת השינויים בהגדרות ‹ חיבורים)."),this.schedEdit=null,await this.loadSchedules()}catch(i){a===this.camGen&&(this.schedMsg=y(i))}finally{a===this.camGen&&(this.schedBusy=!1)}}refuseStaleDraft(e){const t=s("העריכה נפתחה למצלמה אחרת ולכן לא נכתבה למקליט. פתח את העריכה מחדש במצלמה הזו.");e==="motion"?(this.motionEdit=null,this.motionConfirm=!1,this.motionMsg=t):e==="sched"?(this.schedEdit=null,this.schedConfirm=!1,this.schedMsg=t):(this.smartEdit=null,this.smartMsg=t)}renderSchedules(){const e=this.sched;if(this.schedError&&!e)return r`<div class="note">${this.schedError}</div>`;if(!e)return r`<div class="note">${s("קורא לוחות מהמקליט…")}</div>`;const t=[{id:"motion",label:s("זיהוי תנועה"),ok:!!e.arming.motion},{id:"line",label:s("חציית קו"),ok:!!e.arming.line},{id:"field",label:s("פריצה לאזור"),ok:!!e.arming.field},{id:"record",label:s("לוח הקלטה"),ok:!!e.record}],a=this.schedTab,i=this.schedEdit?.kind===a?this.schedEdit:null,o=i?i.days:a==="record"?e.record?.days:e.arming[a],c=[{id:"CMR",label:s("רציף"),color:"var(--sw-recorded)"},{id:"MOTION",label:s("תנועה"),color:"var(--sw-purple)"},{id:"EDR",label:s("אירוע"),color:"var(--sw-warning)"},{id:"ALARM",label:s("אזעקה"),color:"var(--sw-danger)"}],d=a==="record"?e.can.schedule:e.can.events,p=t.find(u=>u.id===a)?.label??"";return r`<div class="note">${s("{n} לוחות בכרטיס הזה, כולל",{n:t.length})} <strong>${s("לוח הקלטה")}</strong> ${s("(מתי הערוץ מקליט בפועל) — לא רק לוחות הזיהוי.")}</div>
      <div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-end:8px" data-schedules-tabs>
        ${t.map(u=>r`<sw-chip ?selected=${a===u.id} ?disabled=${!u.ok} data-sched-tab=${u.id} title=${u.ok?"":e.unsupported[u.id]??s("לא נתמך בערוץ זה")} @click=${()=>{u.ok&&(this.schedTab=u.id,this.schedEdit=null)}}>${u.label}${u.ok?"":` · ${s("לא זמין")}`}</sw-chip>`)}
        <span class="grow"></span>
        ${d&&!i?r`<sw-button size="sm" icon="edit" data-sched-edit @click=${()=>this.startSchedEdit()}>${s("עריכה")}</sw-button>`:n}
      </div>
      ${o?r`<sw-week-grid data-week-grid .days=${o} .modes=${a==="record"?c:[{id:"on",label:s("פעיל"),color:"var(--sw-accent)"}]} ?editable=${!!i}
            @change=${u=>{this.schedEdit&&(this.schedEdit={...this.schedEdit,days:u.detail.days})}}></sw-week-grid>`:r`<div class="note">${s("הלוח הזה לא נקרא מהמקליט")}${e.unsupported[a]?` (${e.unsupported[a]})`:""}.</div>`}
      ${a==="record"&&e.record?r`<div class="note" style="margin-block-start:6px">${s("ברירת מחדל: {mode}",{mode:e.record.default_mode??"—"})} · ${s("לפני אירוע {n} שנ׳",{n:e.record.pre_record_s??"—"})} · ${s("אחרי {n} שנ׳",{n:e.record.post_record_s??"—"})} · ${s("הקלטה {state}",{state:e.record.enabled?s("פעילה"):s("כבויה")})} · ${s("לוח {state}",{state:e.record.schedule_enabled===!1?s("כבוי (מקליט לפי ברירת המחדל)"):s("פעיל")})}
            ${i?r`<label style="display:inline-flex;gap:4px;align-items:center;margin-inline-start:8px"><sw-toggle size="sm" labelHidden in-label label=${s("לוח פעיל")} data-sched-enabled .checked=${i.schedule_enabled!==!1} @change=${u=>this.schedEdit={...i,schedule_enabled:M(u)}}></sw-toggle> ${s("לוח פעיל")}</label>`:n}</div>`:n}
      ${i?r`<div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-start:8px" data-sched-editor>
            <span class="note">${a==="record"?s("צבע = מצב הקלטה לשעה זו; תא ריק = אין הקלטה בשעה זו. טעות כאן = שעות בלי הקלטה, לכן יש אישור והחזר."):s("תא צבוע = הזיהוי פעיל בשעה זו; כיבוי כל היום = בלי התראות מהערוץ בזמן הזה.")}</span>
            <span class="grow"></span>
            <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.schedBusy||!this.schedDiff()&&(a!=="record"||i.schedule_enabled===(e.record?.schedule_enabled??null))} data-sched-save @click=${()=>this.schedConfirm=!0}>${s("שמור למקליט")}</sw-button>
            <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.schedBusy} data-sched-cancel @click=${()=>this.schedEdit=null}>${s("ביטול")}</sw-button>
          </div>`:n}
      ${this.schedConfirm&&i?r`<sw-dialog open heading=${s("כתיבה למקליט: {label}",{label:p})} subheading=${`${this.cam?.name??""} · ${s("ערוץ {n}",{n:e.channel})}`} data-sched-confirm @close=${()=>this.schedConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${s("{n} טווחים בשבוע",{n:i.days.map(u=>u.length).reduce((u,g)=>u+g,0)})}${a==="record"?` · ${s("{cmr} רציף, {motion} תנועה, {edr} אירוע",{cmr:i.days.flat().filter(u=>u.mode==="CMR").length,motion:i.days.flat().filter(u=>u.mode==="MOTION").length,edr:i.days.flat().filter(u=>u.mode==="EDR").length})}`:""}.</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">${s("המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה בלחיצה.")}</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.schedBusy} data-sched-confirm-run @click=${()=>this.saveSched()}>${this.schedBusy?s("כותב…"):s("כתוב למקליט")}</sw-button><sw-button variant="ghost" @click=${()=>this.schedConfirm=!1}>${s("ביטול")}</sw-button></div>
          </sw-dialog>`:n}
      ${this.schedMsg?r`<div class="note" data-sched-msg>${this.schedMsg}</div>`:n}`}startSmartEdit(){const e=this.smart;if(!e||!this.cam)return;const t=this.cam.id;this.smartMsg="";const a=e.line?{enabled:e.line.enabled,lines:e.line.lines.map(o=>({...o,points:o.points.map(c=>[...c])}))}:null,i=e.field?{enabled:e.field.enabled,regions:e.field.regions.map(o=>({...o,points:o.points.map(c=>[...c])}))}:null;this.smartEdit={camId:t,line:a,field:i,tool:a?{type:"line",id:a.lines[0]?.id??1}:{type:"field",id:i?.regions[0]?.id??1}}}smartClick(e){const t=this.smartEdit;if(!t)return;const i=e.currentTarget.getBoundingClientRect(),o=Math.round(Math.max(0,Math.min(1e3,(e.clientX-i.left)/i.width*1e3))),c=Math.round(Math.max(0,Math.min(1e3,(e.clientY-i.top)/i.height*1e3)));if(t.tool.type==="line"&&t.line){const d=t.line.lines.map(p=>{if(p.id!==t.tool.id)return p;const g=[...p.points.length>=2&&!(p.points[0][0]===0&&p.points[0][1]===1e3&&p.points[1][0]===0&&p.points[1][1]===1e3)&&p.points.length!==1?[]:p.points.filter(S=>!(S[0]===0&&S[1]===1e3)),[o,c]].slice(-2);return{...p,points:g,enabled:g.length===2?!0:p.enabled}});this.smartEdit={...t,line:{...t.line,lines:d}}}else if(t.tool.type==="field"&&t.field){const d=t.field.regions.map(p=>p.id===t.tool.id&&p.points.length<10?{...p,points:[...p.points,[o,c]]}:p);this.smartEdit={...t,field:{...t.field,regions:d}}}}async saveSmart(){const e=this.smartEdit;if(!e||!this.cam||this.smartBusy)return;const t=this.draftTarget(e.camId);if(!t){this.refuseStaleDraft("smart");return}const a=this.camGen;this.smartBusy=!0;try{const i={};e.line&&(i.line={enabled:e.line.enabled,lines:e.line.lines.filter(p=>p.points.length===2)}),e.field&&(i.field={enabled:e.field.enabled,regions:e.field.regions.filter(p=>p.points.length===0||p.points.length>=4)});const o=await ns(t.id,i);if(a!==this.camGen)return;const c=Object.values(o).map(p=>p.status),d=Object.values(o).some(p=>p.enable_refused);this.smartMsg=c.every(p=>p==="unchanged")?s("המקליט כבר היה במצב הזה — לא נכתב דבר."):d?s("הצורות והפרמטרים נכתבו למקליט ונרשמו, אבל המקליט סירב להפעיל את הכלל דרך ה־ISAPI (invalidOperation). בקושחה הזו ההפעלה נעשית בממשק המקליט / המצלמה (משאב VCA של המצלמה); אחרי ההפעלה שם התצוגה כאן תתעדכן."):s('הכללים נכתבו למקליט ונרשמו (ניתנים להחזרה). התראות "אדם" / "רכב" מגיעות רק כשהערוץ מודיע ל־Arx (הגדרות ‹ חיבורים ‹ התראות מהמקליט).'),this.smartEdit=null,await Promise.all([this.loadSchedules(),this.loadZones(!0)])}catch(i){a===this.camGen&&(this.smartMsg=y(i))}finally{a===this.camGen&&(this.smartBusy=!1)}}renderSmartOverlay(){const e=this.smartEdit;if(!e)return n;const t=(a,i)=>e.tool.type===a&&e.tool.id===i;return k`
      ${e.field?e.field.regions.filter(a=>a.points.length>=1).map(a=>k`<polygon points=${a.points.map(i=>i.join(",")).join(" ")} class="field" style=${t("field",a.id)?"stroke:var(--sw-on-video);stroke-width:6":""}></polygon>${a.points.map(i=>k`<circle class="handle field" cx=${i[0]} cy=${i[1]} r="9"></circle>`)}`):n}
      ${e.line?e.line.lines.filter(a=>a.points.length>=1&&!(a.points[0][0]===0&&a.points[0][1]===1e3)).map(a=>k`<polyline points=${a.points.map(i=>i.join(",")).join(" ")} class="line ${a.enabled?"":"off"}" style=${t("line",a.id)?"stroke:var(--sw-on-video)":""}></polyline>${a.points.map(i=>k`<circle class="handle line" cx=${i[0]} cy=${i[1]} r="9"></circle>`)}`):n}
    `}renderSmartEditor(){const e=this.smartEdit,t=a=>({any:s("שני הכיוונים"),"left-right":s("משמאל לימין"),"right-left":s("מימין לשמאל")})[a]??a;return r`<div class="legend" data-smart-editor style="display:grid;gap:8px;margin-block-start:8px">
      <div class="note">${s("בחר כלל ולחץ על התמונה כדי לצייר: קו =")} <strong>${s("שתי")}</strong> ${s("לחיצות (התחלה וסוף — לחיצה נוספת מזיזה את הסוף); אזור פריצה =")} <strong>${s("4 עד 10")}</strong> ${s('לחיצות (נקודה לכל פינה), ואז ישר "שמור למקליט" למטה — אין צורך לסגור את הצורה. "אדם" / "רכב" = סינון אזעקות שווא (רק מטרה מסוג זה מפעילה).')}</div>
      ${e.line?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-lines>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><sw-toggle size="sm" labelHidden in-label label=${s("חציית קו פעילה")} data-smart-line-enabled .checked=${e.line.enabled} @change=${a=>this.smartEdit={...e,line:{...e.line,enabled:M(a)}}}></sw-toggle> ${s("חציית קו פעילה")}</label>
          ${e.line.lines.map(a=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:var(--sw-r-sm);padding:4px 8px" data-smart-line=${a.id}>
            <sw-chip ?selected=${e.tool.type==="line"&&e.tool.id===a.id} data-smart-pick-line=${a.id} @click=${()=>this.smartEdit={...e,tool:{type:"line",id:a.id}}}>${s("קו {id}",{id:a.id})}${a.points.length===2&&!(a.points[0][0]===0&&a.points[0][1]===1e3)?"":` · ${s("לא מצויר")}`}</sw-chip>
            <label class="note"><sw-toggle size="sm" labelHidden in-label label=${s("פעיל")} .checked=${a.enabled} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(o=>o.id===a.id?{...o,enabled:M(i)}:o)}}}></sw-toggle> ${s("פעיל")}</label>
            <select class="note" aria-label=${s("כיוון")} .value=${a.direction} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(o=>o.id===a.id?{...o,direction:i.target.value}:o)}}}>${["any","left-right","right-left"].map(i=>r`<option value=${i} ?selected=${i===a.direction}>${t(i)}</option>`)}</select>
            <label class="note">${s("רגישות")} <input type="range" min="1" max="100" .value=${String(a.sensitivity)} @input=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(o=>o.id===a.id?{...o,sensitivity:Number(i.target.value)}:o)}}} /> ${a.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${a.human} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(o=>o.id===a.id?{...o,human:i.target.checked}:o)}}} /> ${s("אדם")}</label>
            <label class="note"><input type="checkbox" .checked=${a.vehicle} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(o=>o.id===a.id?{...o,vehicle:i.target.checked}:o)}}} /> ${s("רכב")}</label>
          </span>`)}
        </div>`:n}
      ${e.field?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-regions>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><sw-toggle size="sm" labelHidden in-label label=${s("פריצה לאזור פעילה")} data-smart-field-enabled .checked=${e.field.enabled} @change=${a=>this.smartEdit={...e,field:{...e.field,enabled:M(a)}}}></sw-toggle> ${s("פריצה לאזור פעילה")}</label>
          ${e.field.regions.map(a=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:var(--sw-r-sm);padding:4px 8px" data-smart-region=${a.id}>
            <sw-chip ?selected=${e.tool.type==="field"&&e.tool.id===a.id} data-smart-pick-region=${a.id} @click=${()=>this.smartEdit={...e,tool:{type:"field",id:a.id}}}>${s("אזור {id}",{id:a.id})} · ${s("{n} נק׳",{n:a.points.length})}</sw-chip>
            <sw-button size="sm" variant="ghost" data-smart-region-clear=${a.id} @click=${()=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===a.id?{...i,points:[]}:i)}}}>${s("נקה")}</sw-button>
            <label class="note">${s("רגישות")} <input type="range" min="1" max="100" .value=${String(a.sensitivity)} @input=${i=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(o=>o.id===a.id?{...o,sensitivity:Number(i.target.value)}:o)}}} /> ${a.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${a.human} @change=${i=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(o=>o.id===a.id?{...o,human:i.target.checked}:o)}}} /> ${s("אדם")}</label>
            <label class="note"><input type="checkbox" .checked=${a.vehicle} @change=${i=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(o=>o.id===a.id?{...o,vehicle:i.target.checked}:o)}}} /> ${s("רכב")}</label>
          </span>`)}
        </div>`:n}
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="grow"></span>
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.smartBusy} data-smart-save @click=${()=>this.saveSmart()}>${this.smartBusy?s("כותב…"):s("שמור למקליט")}</sw-button>
        <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.smartBusy} data-smart-cancel @click=${()=>this.smartEdit=null}>${s("ביטול")}</sw-button>
      </div>
    </div>`}async saveRename(){if(this.renameTo===null||!this.cam||this.renameBusy||this.cam.id!==this.cameraId)return;const e=this.camGen;this.renameBusy=!0,this.renameMsg="";try{const t=await xe(this.cam.id,{alias:this.renameTo.trim()});if(e!==this.camGen||!this.cam)return;this.cam={...this.cam,...t},this.cams=this.cams.map(a=>a.id===t.id?{...a,...t}:a),this.renameTo=null,this.loadOsd()}catch(t){e===this.camGen&&(this.renameMsg=y(t))}finally{e===this.camGen&&(this.renameBusy=!1)}}renderRename(){return this.renameTo===null?n:r`<sw-dialog open heading=${s("שינוי שם המצלמה")} subheading=${s("השם במערכת (בקיר, במפה, באירועים). השם במקליט לא משתנה, אלא אם כותבים אותו מסעיף ה־OSD למטה.")} data-rename-dialog @close=${()=>this.renameTo=null}>
      <sw-field label=${s("שם")}><input data-rename-input maxlength="80" .value=${this.renameTo} placeholder=${this.cam?.name_source??""} @input=${e=>this.renameTo=e.target.value} @keydown=${e=>{e.key==="Enter"&&this.saveRename()}} /></sw-field>
      <div class="note">${s("ריק = השם מהמקליט")}${this.cam?.name_source?` („${this.cam.name_source}“)`:""}.</div>
      ${this.renameMsg?r`<div class="note" style="color:var(--sw-danger)">${this.renameMsg}</div>`:n}
      <div slot="footer"><sw-button variant="primary" icon="check" ?disabled=${this.renameBusy} data-rename-save @click=${()=>this.saveRename()}>${s("שמור")}</sw-button><sw-button variant="ghost" @click=${()=>this.renameTo=null}>${s("ביטול")}</sw-button></div>
    </sw-dialog>`}async loadOsd(){if(!this.cam||!$())return;if(!G()){this.osd=null;return}const e=this.camGen;try{const t=await ls(this.cam.id);e===this.camGen&&(this.osd=t)}catch{e===this.camGen&&(this.osd=null)}}async osdAction(e,t){if(this.osdBusy||!this.cam||this.cam.id!==this.cameraId||this.osd?.camera_id!==this.cam.id)return;const a=this.camGen;this.osdBusy=!0,this.osdMsg="";try{if(await t(),a!==this.camGen)return;this.osdMsg=`${e}: ${s("נכתב למקליט ונרשם.")}`,await this.loadOsd()}catch(i){a===this.camGen&&(this.osdMsg=`${e}: ${y(i)}`)}finally{a===this.camGen&&(this.osdBusy=!1)}}renderOsd(){const e=this.osd;if(!e||!e.can_write)return n;const t=(e.nvr_name??"")===e.vms_name;return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-osd>
      <span>${s("שם במקליט:")} <b data-osd-nvr-name>${e.nvr_name??"—"}</b>${t?` ${s("(זהה לשם ב־Arx)")}`:` · ${s("ב־Arx: {name}",{name:e.vms_name})}`}</span>
      <sw-button size="sm" icon="edit" ?disabled=${this.osdBusy||t} data-osd-write-name @click=${()=>this.osdAction(s("שם הערוץ"),()=>cs(this.cam.id))}>${s("כתוב את השם מ־Arx למקליט")}</sw-button>
      ${e.channel_name?r`<label style="display:inline-flex;gap:4px;align-items:center"><sw-toggle size="sm" controlled labelHidden in-label label=${s("שם על התמונה")} data-osd-name-enabled .checked=${e.channel_name.enabled} ?disabled=${this.osdBusy} @change=${a=>this.osdAction(s("שם על התמונה"),()=>N(this.cam.id,{name_enabled:M(a)}))}></sw-toggle> ${s("שם על התמונה")}</label>`:n}
      ${e.datetime?r`<label style="display:inline-flex;gap:4px;align-items:center"><sw-toggle size="sm" controlled labelHidden in-label label=${s("חותמת זמן")} data-osd-datetime-enabled .checked=${e.datetime.enabled} ?disabled=${this.osdBusy} @change=${a=>this.osdAction(s("חותמת זמן"),()=>N(this.cam.id,{datetime_enabled:M(a)}))}></sw-toggle> ${s("חותמת זמן")}</label>
        <sw-field><select aria-label=${s("פורמט תאריך")} data-osd-date-style ?disabled=${this.osdBusy} @change=${a=>this.osdAction(s("פורמט תאריך"),()=>N(this.cam.id,{date_style:a.target.value}))}>${e.date_styles.map(a=>r`<option value=${a} ?selected=${a===e.datetime.date_style}>${a}</option>`)}</select></sw-field>`:n}
      ${this.osdMsg?r`<span data-osd-msg>${this.osdMsg}</span>`:n}
    </div>`}async loadReboot(){if(!this.cam||!$()||!G()){this.reboot=null;return}const e=this.camGen;try{const t=await ds(this.cam.id);e===this.camGen&&(this.reboot=t)}catch{e===this.camGen&&(this.reboot=null)}}async runReboot(){if(!this.cam||this.rebootBusy||this.cam.id!==this.cameraId)return;const e=this.camGen;this.rebootBusy=!0,this.rebootMsg="";try{await hs(this.cam.id),e===this.camGen&&(this.rebootMsg=b("done"))}catch(t){e===this.camGen&&(this.rebootMsg=_s(t))}finally{e===this.camGen&&(this.rebootBusy=!1,this.rebootOpen=!1,await this.loadReboot())}}renderReboot(){const e=Es(this.reboot,this.rebootBusy);if(!e.shown||!this.cam)return n;const t=this.cam;return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-camera-reboot data-enabled=${e.enabled?"yes":"no"}>
      <span>${b("lead")}</span>
      <sw-button size="sm" variant="danger" icon="refresh" ?disabled=${!e.enabled} title=${e.reason||n} aria-describedby=${e.reason?"camera-reboot-reason":n}
        data-camera-reboot-open @click=${()=>{this.rebootMsg="",this.rebootOpen=!0}}>${this.rebootBusy?b("sending"):b("button")}</sw-button>
      ${e.reason?r`<span class="muted" id="camera-reboot-reason" data-camera-reboot-reason>${e.reason}</span>`:n}
      ${this.rebootMsg?r`<span role="status" data-camera-reboot-msg>${this.rebootMsg}</span>`:n}
    </div>
    ${this.rebootOpen?r`<sw-dialog open heading=${b("dialogTitle")} subheading=${b("dialogSub",{name:t.name,channel:t.channel??"—"})} data-camera-reboot-dialog @close=${()=>this.rebootOpen=!1}>
          <p>${b("dialogText")}</p>
          <div slot="footer"><sw-button variant="danger" ?disabled=${this.rebootBusy} data-camera-reboot-run @click=${()=>void this.runReboot()}>${b("confirm")}</sw-button><sw-button variant="ghost" @click=${()=>this.rebootOpen=!1}>${b("cancel")}</sw-button></div>
        </sw-dialog>`:n}`}async loadRecord(){if(!this.cam||!$())return;const e=this.camGen;let t;try{t=await ps(this.cam.id)}catch{t=null}e===this.camGen&&(this.rec=t,window.clearTimeout(this.recTimer),this.rec?.active&&this.isConnected&&(this.recTimer=window.setTimeout(()=>void this.loadRecord(),15e3)))}async toggleRecord(){if(!this.cam||this.recBusy||this.cam.id!==this.cameraId)return;const e=this.camGen;this.recBusy=!0,this.recMsg="";try{if(this.rec?.active)await ms(this.cam.id),e===this.camGen&&(this.recMsg=s("ההקלטה הידנית נעצרה."));else{const t=await us(this.cam.id,this.recMinutes);e===this.camGen&&(this.recMsg=s("הקלטה ידנית החלה · תיעצר אוטומטית ב־{time}.",{time:ke(new Date(t.stop_at))}))}e===this.camGen&&await this.loadRecord()}catch(t){e===this.camGen&&(this.recMsg=y(t))}finally{e===this.camGen&&(this.recBusy=!1)}}renderRecord(){const e=this.rec;if(!e||!e.can_write)return n;const t=e.active,a=t?`${Math.floor(t.remaining_s/60)}:${String(t.remaining_s%60).padStart(2,"0")}`:"";return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-manual-record data-active=${t?"yes":"no"}>
      ${t?r`<sw-badge kind="live" label=${s("הקלטה ידנית פעילה · נותרו {time}",{time:a})}></sw-badge>
          <sw-button size="sm" variant="danger" icon="close" ?disabled=${this.recBusy} data-record-stop @click=${()=>this.toggleRecord()}>${s("עצור הקלטה")}</sw-button>`:r`<sw-field><select aria-label=${s("משך הקלטה ידנית")} data-record-minutes @change=${i=>this.recMinutes=Number(i.target.value)}>${[5,10,30,60,120].map(i=>r`<option value=${i} ?selected=${i===this.recMinutes}>${s("{n} דק׳",{n:i})}</option>`)}</select></sw-field>
          <sw-button size="sm" variant="primary" icon="live" ?disabled=${this.recBusy||!e.track_id} data-record-start @click=${()=>this.toggleRecord()}>${s("הקלט עכשיו")}</sw-button>
          ${e.track_id?r`<span>${s('הקלטה ידנית במקליט על הזרם הראשי; נעצרת אוטומטית בתום הזמן גם אם המסך נסגר. ההקלטה עצמה מצטרפת להקלטות הרגילות של הערוץ — היא נמצאת לפי הזמן במסך "הקלטות", לא בתגית נפרדת.')}</span>`:r`<span class="warn" data-record-unavailable>${s("אין זרם ראשי זמין למצלמה זו כרגע, אי אפשר להקליט ידנית.")}</span>`}`}
      ${this.recMsg?r`<span data-record-msg>${this.recMsg}</span>`:n}
    </div>`}connectedCallback(){super.connectedCallback(),this.load(),this.hasUpdated&&this.rec?.active&&this.loadRecord()}disconnectedCallback(){window.clearTimeout(this.recTimer),window.clearTimeout(this.castNoteTimer),this.recTimer=0,this.castNoteTimer=0,super.disconnectedCallback()}willUpdate(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.resetCameraState()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load(),e.has("cam")&&this.cam&&$()&&this.loadSource(),e.has("cam")&&this.cam&&$()&&!this.cam.standalone&&!this.zonesBusy&&(!this.zones||this.zones.camera_id!==this.cam.id)&&(this.loadRecord(),this.loadOsd(),this.loadReboot(),this.loadSchedules(),this.zonesError="",this.loadZones()),e.has("cam")&&this.cam&&$()&&!this.cam.standalone&&(!this.caps||this.caps.camera_id!==this.cam.id)&&this.loadCaps(),e.has("cam")&&this.cam&&this.loadCastTargets()}async loadZones(e=!1){if(!this.cam)return;const t=this.camGen;this.zonesBusy=!0,this.zonesError="";try{const a=await ze(this.cam.id,e);t===this.camGen&&(this.zones=a)}catch(a){t===this.camGen&&(this.zonesError=y(a))}finally{t===this.camGen&&(this.zonesBusy=!1)}}async loadCaps(e=!1){if(!this.cam)return;const t=this.camGen;this.capsError="";try{const a=await Ee(this.cam.id,e);t===this.camGen&&(this.caps=a)}catch(a){t===this.camGen&&(this.capsError=y(a))}}renderCaps(){const e=this.caps;if(this.capsError&&!e)return r`<div class="note" data-caps>${s("יכולות המצלמה לא נקראו מהמקליט: {error}",{error:this.capsError})}</div>`;if(!e)return r`<div class="note" data-caps>${s("קורא יכולות מהמקליט…")}</div>`;const t=e.ptz.state==="supported"?"live":e.ptz.state==="unsupported"?"neutral":"unknown",a=e.ptz.state==="supported"?`${s("PTZ: נתמך")}${e.ptz.preset_count!==null?` · ${e.ptz.preset_count} presets`:""}`:e.ptz.state==="unsupported"?s("PTZ: לא נתמך במצלמה זו"):s("PTZ: לא ידוע"),i=e.audio.state==="available"?"live":e.audio.state==="disabled"?"stale":e.audio.state==="unsupported"?"neutral":"unknown",o=e.audio.state==="available"?`${s("שמע דו־כיווני: ערוץ פעיל")}${e.audio.codec?` (${e.audio.codec})`:""}`:e.audio.state==="disabled"?s("שמע דו־כיווני: ערוץ קיים אך כבוי במכשיר"):e.audio.state==="unsupported"?s("שמע דו־כיווני: אין ערוץ למצלמה זו"):s("שמע דו־כיווני: לא ידוע");return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center" data-caps data-ptz=${e.ptz.state} data-audio=${e.audio.state}>
      <sw-badge kind=${t} label=${a} title=${e.ptz.reason??""}></sw-badge>
      <sw-badge kind=${i} label=${o} title=${e.audio.reason??""}></sw-badge>
      <sw-badge kind="neutral" label=${s("זום דיגיטלי: הגדלה בדפדפן בלבד, לא הנעת מצלמה")}></sw-badge>
      ${e.video?.main?r`<sw-badge data-caps-webrtc kind=${e.video.main.webrtc==="ok"?"live":e.video.main.webrtc==="no"?"stale":"unknown"} label=${`${s("זרם ראשי {codec}",{codec:e.video.main.codec??"?"})}: ${e.video.main.webrtc==="ok"?s("מתנגן ב־WebRTC"):e.video.main.webrtc==="no"?s("לא יתנגן ב־WebRTC"):s("WebRTC לא ידוע")}`}></sw-badge>`:n}
      ${e.video?.hint?r`<span data-caps-webrtc-hint>${e.video.hint}.</span>`:n}
      <span>${e.ptz.reason?`${s("PTZ לפי המכשיר: {reason}.",{reason:e.ptz.reason})} `:""}${s("הנעת PTZ, קריאת preset ודיבור הם כתיבה למכשיר ואינם מוצעים בפיילוט ללא אישור מפורש — אין פקד מדומה.")} ${s("נקרא מהמקליט {time}",{time:e.fetched_at.replace("T"," ").replace("Z"," UTC")})}${e.cached?` ${s("(מהמטמון)")}`:""}.</span>
    </div>`}startMotionEdit(){const e=this.zones?.motion;!e||!e.rows||!e.cols||!this.zones||(this.motionMsg="",this.motionEdit={camId:this.zones.camera_id,cells:e.cells.map(t=>[...t]),sensitivity:e.sensitivity??50,enabled:e.enabled})}paintCell(e,t,a=!1){const i=this.motionEdit;if(!i||(a&&(this.paintValue=!i.cells[e][t]),this.paintValue===null)||i.cells[e][t]===this.paintValue)return;const o=i.cells.map(c=>[...c]);o[e][t]=this.paintValue,this.motionEdit={...i,cells:o}}fillMotion(e){const t=this.motionEdit;t&&(this.motionEdit={...t,cells:t.cells.map(a=>a.map(()=>e))})}motionDiff(){const e=this.zones?.motion,t=this.motionEdit;if(!e||!t)return{added:0,removed:0,sensitivity:!1,enabled:!1};let a=0,i=0;return t.cells.forEach((o,c)=>o.forEach((d,p)=>{const u=e.cells[c]?.[p]??!1;d&&!u&&a++,!d&&u&&i++})),{added:a,removed:i,sensitivity:t.sensitivity!==(e.sensitivity??50),enabled:t.enabled!==e.enabled}}async saveMotion(){const e=this.motionEdit;if(!e||!this.cam||this.motionBusy)return;if(!this.draftTarget(e.camId)||this.zones?.camera_id!==e.camId){this.refuseStaleDraft("motion");return}const a=this.camGen,i=this.motionDiff();this.motionBusy=!0;try{const o=await fs(e.camId,{...i.added||i.removed?{cells:e.cells}:{},...i.sensitivity?{sensitivity:e.sensitivity}:{},...i.enabled?{enabled:e.enabled}:{}});if(a!==this.camGen)return;this.motionMsg=o.status==="unchanged"?s("המקליט כבר היה במצב הזה, לא נכתב דבר."):s("נכתב למקליט (שינוי {id}). ניתן להחזיר מהגדרות ‹ חיבורים ‹ שינויים אחרונים.",{id:o.id.slice(0,8)}),this.motionEdit=null,this.motionConfirm=!1,await this.loadZones(!0)}catch(o){if(a!==this.camGen)return;this.motionMsg=y(o),this.motionConfirm=!1}finally{a===this.camGen&&(this.motionBusy=!1)}}renderMotionEditor(e){const t=this.motionEdit,a=this.motionDiff(),i=a.added||a.removed||a.sensitivity||a.enabled,o=t.cells.flat().filter(Boolean).length;return r`<div class="legend" data-motion-editor>
      <span class="note">${s("לחץ או גרור על התמונה כדי לסמן תאים שמזהים תנועה")} · ${s("{n} מתוך {total} תאים",{n:o,total:e.rows*e.cols})}</span>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!0)}>${s("בחר הכל")}</sw-button>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!1)}>${s("נקה")}</sw-button>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px">${s("רגישות")} <input type="range" min=${this.zones?.sensitivity_caps?.min??0} max=${this.zones?.sensitivity_caps?.max??100} step=${this.zones?.sensitivity_caps?.step??20} .value=${String(t.sensitivity)} data-motion-sensitivity @input=${c=>this.motionEdit={...t,sensitivity:Number(c.target.value)}} /> <b class="ltr">${t.sensitivity}</b></label>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px"><sw-toggle size="sm" labelHidden in-label label=${s("זיהוי תנועה פעיל")} .checked=${t.enabled} data-motion-enabled @change=${c=>this.motionEdit={...t,enabled:M(c)}}></sw-toggle> ${s("זיהוי תנועה פעיל")}</label>
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="check" ?disabled=${!i||this.motionBusy} data-motion-save @click=${()=>this.motionConfirm=!0}>${s("שמור למקליט")}</sw-button>
      <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.motionBusy} data-motion-cancel @click=${()=>this.motionEdit=null}>${s("ביטול")}</sw-button>
      ${this.motionConfirm?r`<sw-dialog open heading=${s("כתיבה למקליט: זיהוי תנועה")} subheading=${`${this.cam?.name??""} · ${s("ערוץ {n}",{n:this.zones?.channel??""})}`} data-motion-confirm @close=${()=>this.motionConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${a.added?s("+{n} תאים נוספים לזיהוי",{n:a.added}):""}${a.added&&a.removed?" · ":""}${a.removed?s("−{n} תאים מוסרים",{n:a.removed}):""}${!a.added&&!a.removed?s("הרשת ללא שינוי"):""}</div>
              <!-- MEDIUM-REST-2540 (SCR-27): before -> after with each value isolated and the arrow of the reading direction (was "60 → 40"
                   for 40 -> 60 in Hebrew) -->
              <div>${s("רגישות:")} <span data-motion-change="sensitivity">${a.sensitivity?q(e.sensitivity??"—",t.sensitivity):s("ללא שינוי")}</span> · ${s("זיהוי:")} <span data-motion-change="enabled">${a.enabled?t.enabled?q(s("כבוי"),s("פעיל")):q(s("פעיל"),s("כבוי")):s("ללא שינוי")}</span></div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">${s("המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה. ההקלטות אינן מושפעות; אזור שלא מסומן לא יפעיל הקלטת תנועה.")}</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.motionBusy} data-motion-confirm-run @click=${()=>this.saveMotion()}>${this.motionBusy?s("כותב…"):s("כתוב למקליט")}</sw-button><sw-button variant="ghost" @click=${()=>this.motionConfirm=!1}>${s("ביטול")}</sw-button></div>
          </sw-dialog>`:n}
    </div>`}renderZones(e){const t=this.zones;if(this.zonesBusy&&!t)return r`<div class="note">${s("קורא את הגדרות הזיהוי מהמקליט…")}</div>`;if(this.zonesError&&!t)return r`<div class="note">${this.zonesError} <sw-button size="sm" @click=${()=>this.loadZones(!0)}>${s("נסה שוב")}</sw-button></div>`;if(!t)return r`<div class="note">—</div>`;const a=this.zoneLayers,i=t.motion,o=(d,p)=>d.map(([u,g])=>`${u/p.width*1e3},${g/p.height*1e3}`).join(" "),c=d=>d==="human"?s("אדם"):d==="vehicle"?s("רכב"):d;return r`
      <div class="zones" data-zones-loaded>
        <div class="frame">
          <img src=${R(e.id)} alt="" />
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label=${s("אזורי זיהוי מעל תמונת המצלמה")} style=${this.smartEdit?"cursor:crosshair":""} data-zones-svg @click=${d=>this.smartClick(d)}>
            ${this.motionEdit&&i&&i.rows&&i.cols?this.motionEdit.cells.flatMap((d,p)=>d.map((u,g)=>k`<rect class=${u?"cell":"cell off"} data-motion-cell=${`${p}-${g}`} x=${g*1e3/i.cols} y=${p*1e3/i.rows} width=${1e3/i.cols} height=${1e3/i.rows} style="cursor:crosshair;${u?"":"fill:color-mix(in srgb, var(--sw-on-video) 3%, transparent);stroke:var(--sw-video-line)"}" @pointerdown=${S=>{S.preventDefault(),this.paintCell(p,g,!0)}} @pointerenter=${S=>{S.buttons&1&&this.paintCell(p,g)}} @pointerup=${()=>this.paintValue=null}></rect>`)):n}
            ${!this.motionEdit&&a.motion&&i&&i.rows&&i.cols?i.cells.flatMap((d,p)=>d.map((u,g)=>u?k`<rect x=${g*1e3/i.cols} y=${p*1e3/i.rows} width=${1e3/i.cols} height=${1e3/i.rows} class="cell"></rect>`:n)):n}
            ${a.privacy&&t.privacy_mask?t.privacy_mask.regions.map(d=>k`<polygon points=${o(d.points,t.privacy_mask.normalized)} class="mask"></polygon>`):n}
            ${a.intrusion&&t.intrusion&&!this.smartEdit?t.intrusion.regions.map(d=>k`<polygon points=${o(d.points,t.intrusion.normalized)} class="field"></polygon>`):n}
            ${a.lines&&t.line_crossing&&!this.smartEdit?t.line_crossing.lines.map(d=>k`<polyline points=${o(d.points,t.line_crossing.normalized)} class="line ${d.enabled?"":"off"}"></polyline>`):n}
            ${this.renderSmartOverlay()}
          </svg>
        </div>
        <div class="legend">
          <sw-chip data-zone-layer="motion" ?selected=${a.motion} @click=${()=>this.zoneLayers={...a,motion:!a.motion}}>${s("תנועה")}${i?` · ${i.enabled?s("פעיל"):s("כבוי")} · ${s("{pct}% מהתמונה",{pct:i.coverage_pct})} · ${s("רגישות {n}",{n:i.sensitivity??"?"})}${i.target_types.length?` · ${i.target_types.map(c).join("/")}`:""}`:` · ${s("לא נקרא")}`}</sw-chip>
          <sw-chip data-zone-layer="privacy" ?selected=${a.privacy} @click=${()=>this.zoneLayers={...a,privacy:!a.privacy}}>${s("מסכת פרטיות")}${t.privacy_mask?` · ${t.privacy_mask.enabled?s("פעילה"):s("כבויה")} · ${s("{n} אזורים",{n:t.privacy_mask.regions.length})}`:` · ${s("לא נקרא")}`}</sw-chip>
          <sw-chip data-zone-layer="intrusion" ?selected=${a.intrusion} @click=${()=>this.zoneLayers={...a,intrusion:!a.intrusion}}>${s("חדירה לאזור")}${t.intrusion?` · ${t.intrusion.enabled?s("פעיל"):s("כבוי")} · ${s("{n} אזורים",{n:t.intrusion.regions.length})}`:` · ${s("לא נקרא")}`}</sw-chip>
          <sw-chip data-zone-layer="lines" ?selected=${a.lines} @click=${()=>this.zoneLayers={...a,lines:!a.lines}}>${s("חציית קו")}${t.line_crossing?` · ${t.line_crossing.enabled?s("פעיל"):s("כבוי")} · ${s("{n} קווים",{n:t.line_crossing.lines.length})}`:` · ${s("לא נקרא")}`}</sw-chip>
          <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.zonesBusy} @click=${()=>this.loadZones(!0)}>${s("רענון מהמקליט")}</sw-button>
          ${t.can_edit_motion&&i&&i.rows&&i.cols&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-motion-edit @click=${()=>this.startMotionEdit()}>${s("עריכת אזורי תנועה")}</sw-button>`:n}
          ${this.smart?.can_write&&(this.smart.line||this.smart.field)&&!this.smartEdit&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-smart-edit @click=${()=>this.startSmartEdit()}>${s("עריכת כללים חכמים")}</sw-button>`:n}
        </div>
        ${this.motionEdit&&i?this.renderMotionEditor(i):n}
        ${this.smartEdit?this.renderSmartEditor():n}
        ${this.smartMsg?r`<div class="note" data-smart-msg>${this.smartMsg}</div>`:n}
        ${this.motionMsg?r`<div class="note" data-motion-msg>${this.motionMsg}</div>`:n}
        ${Object.keys(t.unsupported).length?r`<div class="note">${s("לא נקרא מהמכשיר:")} ${Object.entries(t.unsupported).map(([d,p])=>`${d} (${p})`).join(", ")}</div>`:n}
        <div class="note" data-zones-note>${s("קריאה בלבד מהמקליט (נקרא {time}{cached}).",{time:t.fetched_at.replace("T"," ").replace("Z"," UTC"),cached:t.cached?s(", מהמטמון"):""})} ${s("אלו פוליגונים בתמונת המצלמה — לא חדרים במפה. שכבת־על בדפדפן אינה מסכת מקליט ואינה מגינה על הקלטות; עריכה או מסכה אמיתית דורשות אישור מפורש, כתיבה מאומתת ובדיקת התוצאה בזרם.")}</div>
      </div>`}async load(){const e=this.camGen;this.loading=!0,this.error="";try{if($()){const[t,a]=await Promise.all([_e(),Me()]);if(e!==this.camGen)return;this.cams=t.cameras,this.cam=t.cameras.find(o=>o.id===this.cameraId)??null,this.canConfigure=t.can_sync,this.settings=a,this.transport=H(a);const i=Ce();i&&(this.profile=i.defaultProfile)}}catch(t){e===this.camGen&&(this.error=y(t))}finally{e===this.camGen&&(this.loading=!1)}}setTransport(e){const t=I()?.installation??this.settings?.["media.transport_default"]??Z;this.transport=e,Te(e===t?null:e).then(a=>{a&&(this.transport=a.choice)}).catch(()=>this.transport=H(this.settings))}onPlayer(e){this.playerStatus=e.detail.status,this.playerTransport=e.detail.transport??""}renderApi(){const e=this.cam;if(this.loading)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(this.error)return r`<sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;if(!e)return r`<sw-state-panel state="forbidden" heading=${s("המצלמה לא זמינה")} hint=${s("המצלמה לא נמצאה או שאין לך הרשאת צפייה בה.")}></sw-state-panel>`;const t=e.can_view_live!==!1&&e.status!=="offline",a=Se(e,Be()),i=R(e.id,this.posterBust),o=e.stream,c=Re(this.transport),d=Oe(this.profile,e.encoding,this.transport);return r`<div class="stage"><div class="stage-main"><div class="vbox">
      <div class="video ${a==="off"?"off":""}">
        ${a==="still"?r`<sw-camera-tile data-live-still name=${e.name} state="live" cameraId=${e.id} poster=${R(e.id)} .stillRefresh=${e.still_refresh_s??10} noDemo></sw-camera-tile>`:a==="webrtc_required"?r`<div class="center" data-webrtc-required><div><sw-icon name="camera" size=${32}></sw-icon><span>${Ge}</span> <a href=${qe}>${Ie}</a></div></div>`:a==="player"?r`<sw-live-player .cameraId=${e.id} .profile=${this.profile} .mode=${this.transport} .plan=${d.plan} .preferred=${d.preferred} .gop=${d.gop} .encoding=${e.encoding??null} .poster=${i} @player-status=${this.onPlayer}></sw-live-player>`:r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span data-camera-off-reason>${e.recorder_enabled===!1?s("המקליט של המצלמה מושבת"):e.status==="offline"&&e.video_source==="manual"?z("offline"):e.status==="offline"?s("המצלמה מנותקת מהמקליט (לפי הסנכרון האחרון)"):s("אין הרשאת צפייה חיה במצלמה זו")}</span></div></div>`}
      </div></div>
      ${t&&e.live_kind==="still"?r`<div class="note" data-live-still-note>${ws().live.stillExplain.replace("{n}",String(e.still_refresh_s??10))}</div>`:n}
      <div class="controls" data-player=${this.playerStatus==="playing"?"playing":this.playerStatus==="error"?"error":"connecting"}>
        <div class="round" role="group" aria-label=${s("פקדי מצלמה")}>
          <button title=${s("רענון תמונה")} aria-label=${s("רענון תמונה")} @click=${()=>this.posterBust=Date.now()}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title=${s("מסך מלא")} aria-label=${s("מסך מלא")} ?disabled=${this.playerStatus!=="playing"} @click=${()=>this.player?.fullscreen()}><sw-icon name="expand" size=${16}></sw-icon></button>
          ${this.castShown?r`<button type="button" data-cast-button title=${f("cast.button")} aria-label=${f("cast.button")} aria-haspopup="dialog" aria-expanded=${this.castOpen?"true":"false"} @click=${()=>this.castOpen=!this.castOpen}><sw-icon name="cast" size=${16}></sw-icon></button>`:n}
          <button title=${s("התחבר מחדש")} aria-label=${s("התחבר מחדש")} @click=${()=>this.player?.reconnect()}><sw-icon name="refresh" size=${16}></sw-icon></button>
          <button class="q ${this.profile==="main"?"on":""}" @click=${()=>this.profile="main"}>${s("ראשי")}</button>
          <button class="q ${this.profile==="sub"?"on":""}" @click=${()=>this.profile="sub"}>${s("משני")}</button>
          <div class="transport" role="group" aria-label=${s("תעבורה")} data-transport-choice=${this.transport}>
            ${["auto","webrtc","mse"].map(p=>r`<button class=${this.transport===p?"on":""} aria-pressed=${String(this.transport===p)} @click=${()=>this.setTransport(p)}>${p==="auto"?s("אוטומטי"):p==="webrtc"?"WebRTC":"MSE"}</button>`)}
          </div>
          ${I()?.source==="personal"?r`<span class="note" data-transport-own>${s("ברירת המחדל של המערכת:")} ${Ne(I()?.installation??this.settings?.["media.transport_default"]??Z)}</span>`:n}
          ${c&&this.settings?.["media.video_notices"]==="true"?r`<span class="note" data-remote-video-policy>${s("גישה מרחוק:")} ${this.transport==="mse"?s("MSE בלבד"):this.transport==="webrtc"?s("WebRTC בלבד · בלי MSE"):`${s("WebRTC תחילה")} · ${c.mseFallback?s("MSE רק כמוצא אחרון"):s("בלי MSE")}`}</span>`:n}
        </div>
        ${this.playerStatus==="playing"&&this.settings?.["media.video_notices"]!=="true"?n:r`<div class="note">${this.playerStatus==="playing"?s("מנגן דרך {transport}",{transport:this.playerTransport==="webrtc"?"WebRTC":"MSE"}):this.playerStatus==="error"?s("הזרם לא זמין"):this.playerStatus==="ended"?s("הסתיים"):s("מתחבר…")}</div>`}
      </div>
      ${this.renderCast(e)}
      </div><div class="stage-side">
      <frigate-camera-control camera-id=${e.id} recorder-id=${e.recorder_id} data-live-frigate-control></frigate-camera-control>
      ${this.renderSettingsAccordion(e,o)}
    </div></div>`}renderCast(e){if(this.castWatch,!this.castShown&&!B.open().some(i=>i.mine&&i.camera_id===e.id))return n;const t=B.now,a=B.open().filter(i=>i.mine&&i.camera_id===e.id);return r`
      ${a.map(i=>r`<div class="cast-status" data-cast-status data-cast-status-state=${i.state} role="status">
        <sw-icon name="cast" size=${15}></sw-icon>
        <span class="who">${i.state==="not_confirmed"?f("cast.notConfirmed"):i.state==="starting"?`${f("cast.starting2")} · ${i.screen_name}`:`${f("cast.playing")}: ${i.screen_name}`}</span>
        ${i.state==="playing"?r`<span class=${Pe(i,t)?"low":""} data-cast-status-left>${je(i,t)}</span>`:n}
        <sw-cast-stop .session=${i} @cast-stopped=${()=>this.flashCast(f("cast.stopped"))}></sw-cast-stop>
      </div>`)}
      ${this.castNote?r`<div class="note" data-cast-note role="status">${this.castNote}</div>`:n}
      <sw-cast-picker .open=${this.castOpen} .cameraId=${e.id} .cameraName=${e.alias||e.name} .anchor=${this.castBtn??null} .profile=${this.profile}
        .phone=${Le()} .ddPhone=${document.documentElement.getAttribute("data-dd-phone")??""} ?remote=${Ae()}
        @close=${()=>this.castOpen=!1} @cast-started=${()=>this.flashCast(f("cast.started"))}></sw-cast-picker>`}flashCast(e){this.castNote=e,window.clearTimeout(this.castNoteTimer),this.castNoteTimer=window.setTimeout(()=>this.castNote="",4e3)}async loadCastTargets(){if(!this.cam||!$()||!De("media.cast")){this.castShown=!1;return}const e=this.camGen;try{const t=await X(this.cam.id);e===this.camGen&&(this.castShown=Ve({api:!0,hasCast:!0,targets:t.targets.length,ready:t.ready}))}catch{e===this.camGen&&(this.castShown=!1)}}renderSettingsAccordion(e,t){const a=this.renderCaps(),i=this.renderRecord(),o=this.renderOsd(),c=this.renderReboot(),d=this.renderSource(e),p=ts(e);return r`<details class="acc-root" data-camera-settings>
      <summary><sw-icon class="chev" name="chevron" size=${16}></sw-icon>${s("הגדרות מצלמה")}</summary>
      <div class="acc-body">
        ${d!==n?r`<details class="acc" data-acc-source ?open=${this.sourceOpen||!!this.sourceMsg||this.source?.health?.state==="failing"}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${z("section")}</span>${this.source?.mode==="manual"?r`<sw-badge kind=${this.source.health?.state==="failing"?"offline":"neutral"} label=${z("manual")}></sw-badge>`:n}</summary>
              <div class="acc-content">${d}</div>
            </details>`:n}
        ${p.recording?n:r`<div class="note" data-camera-standalone-note>${z("standaloneNote")} ${p.reason}</div>`}
        ${i!==n?r`<details class="acc" data-acc-record ?open=${!!this.rec?.active}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${s("הקלטה ידנית")}</span>${this.rec?.active?r`<sw-badge kind="live" label=${s("פעילה")}></sw-badge>`:n}</summary>
              <div class="acc-content">${i}</div>
            </details>`:n}
        <details class="acc" data-acc-details>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${s("פרטים")}</span></summary>
          <div class="acc-content">
            <dl>
              <dt>${s("מצב")}</dt><dd><sw-badge kind=${e.status==="online"?"live":e.status==="offline"?"offline":"unknown"}></sw-badge></dd>
              ${e.standalone?r`<dt>${z("section")}</dt><dd>${z("manual")} · ${z("noRecorder")}</dd>`:r`<dt>${s("ערוץ")}</dt><dd>${e.channel} · <span class="ltr">track ${e.main_track??"?"}</span></dd>
              <dt>${s("שם במקליט")}</dt><dd>${e.name_source||"—"}</dd>`}
              <dt>${s("זרם ראשי")}</dt><dd>${t?`${t.resolution??""} · ${t.fps??"?"} fps · ${t.bitrate_kbps??"?"} kbps`:s("לא נבדק")}</dd>
              ${e.standalone?n:r`<dt>${s("זמן מקור")}</dt><dd>${f("videoCopy.sourceTime")}</dd>`}
              <dt>${s("נראתה לאחרונה")}</dt><dd>${e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</dd>
            </dl>
            ${a}
          </div>
        </details>
        ${o!==n?r`<details class="acc" data-acc-osd>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${s("OSD — כיתוב על התמונה")}</span></summary>
              <div class="acc-content">${o}</div>
            </details>`:n}
        ${p.recording?r`<details class="acc" data-acc-schedules>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${s("לוחות זימון והקלטה — כפי שמוגדר במקליט")}</span></summary>
          <div class="acc-content">
            <div class="note">${s("מתי כל זיהוי פעיל ומתי הערוץ מקליט (רציף / תנועה / אירוע) · עריכה דורשת הרשאה רגישה ונרשמת עם החזר")}</div>
            ${this.renderSchedules()}
          </div>
        </details>
        <details class="acc" data-acc-zones>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${s("אזורי זיהוי ומסכות — כפי שמוגדר במקליט")}</span></summary>
          <div class="acc-content">${this.renderZones(e)}</div>
        </details>`:n}
        ${c!==n?r`<details class="acc" data-acc-reboot ?open=${this.rebootOpen||!!this.rebootMsg}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${b("section")}</span></summary>
              <div class="acc-content">${c}</div>
            </details>`:n}
        <details class="acc" data-acc-more>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${s("מצלמות נוספות")}</span></summary>
          <div class="acc-content tiles">
            ${this.cams.filter(u=>u.id!==e.id).slice(0,4).map(u=>r`<sw-camera-tile compact name=${u.name} state=${u.status==="online"?"live":u.status==="offline"?"offline":"unknown"} poster=${u.status==="offline"?"":R(u.id)} @click=${()=>K(`/live/cameras/${u.id}`)}></sw-camera-tile>`)}
          </div>
        </details>
      </div>
    </details>`}renderDemo(){const e=C.find(i=>i.id===this.cameraId)??C[0],t=e.state==="live"||e.state==="stale",a=F[e.id]??"lobby";return r`<div class="stage"><div class="stage-main"><div class="vbox">
      <div class="video ${t?a:"off"}">
        ${t?r`<sw-scene kind=${a}></sw-scene><div class="shade"></div><span class="demo">${s("דמו · אין שרת מחובר")}</span>
              <span class="stamp">2026-09-14 10:24:36</span>
              <span class="quality">${this.profile==="main"?"1440p · H.265":"360p · H.264"}</span>`:r`<div class="center"><div>
              <sw-icon name=${e.state==="offline"?"offline":"lock"} size=${32}></sw-icon>
              <span>${e.state==="offline"?s("המצלמה אינה מחוברת למקליט"):s("אין הרשאת צפייה במצלמה זו")}</span>
            </div></div>`}
      </div></div>
      <div class="controls" data-player=${t?"playing":"error"}>
        <div class="round" role="group" aria-label=${s("פקדי מצלמה")}>
          ${e.audio?r`<button title=${s("מיקרופון")} aria-label=${s("מיקרופון")} ?disabled=${!t}><sw-icon name="mic" size=${16}></sw-icon></button><button title=${s("שמע")} aria-label=${s("שמע")} ?disabled=${!t}><sw-icon name="volume" size=${16}></sw-icon></button>`:n}
          <button title=${s("צילום מסך")} aria-label=${s("צילום מסך")} ?disabled=${!t}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title=${s("מסך מלא")} aria-label=${s("מסך מלא")} ?disabled=${!t}><sw-icon name="expand" size=${16}></sw-icon></button>
          <button class="q ${this.profile==="main"?"on":""}" @click=${()=>this.profile="main"}>1440p</button>
          <button class="q ${this.profile==="sub"?"on":""}" @click=${()=>this.profile="sub"}>360p</button>
        </div>
        ${e.ptz?r`<div class="ptz" role="group" aria-label=${s("בקרת PTZ")}>
              <div class="joy">
                <button class="u" aria-label=${s("למעלה")}><sw-icon name="chevronDown" size=${14} style="transform:rotate(180deg)"></sw-icon></button>
                <button class="d" aria-label=${s("למטה")}><sw-icon name="chevronDown" size=${14}></sw-icon></button>
                <button class="l" aria-label=${s("שמאלה")}><sw-icon name="chevron" size=${14} flip></sw-icon></button>
                <button class="r" aria-label=${s("ימינה")}><sw-icon name="chevron" size=${14}></sw-icon></button>
                <span class="c" aria-hidden="true"></span>
              </div>
              <div class="zoom"><button aria-label=${s("זום פנימה")}><sw-icon name="plus" size=${14}></sw-icon></button><button aria-label=${s("זום החוצה")}><sw-icon name="minus" size=${14}></sw-icon></button></div>
            </div>`:n}
      </div>
      ${e.ptz?r`<div class="modes">
            <sw-chip icon="bookmark" ?selected=${this.ptzMode==="presets"} @click=${()=>this.ptzMode="presets"}>${f("videoCopy.presets")}</sw-chip>
            <sw-chip icon="target" ?selected=${this.ptzMode==="track"} @click=${()=>this.ptzMode="track"}>${s("מעקב אוטומטי")}</sw-chip>
            <sw-chip icon="route" ?selected=${this.ptzMode==="patrol"} @click=${()=>this.ptzMode="patrol"}>${s("סיור")}</sw-chip>
          </div>`:r`<div class="note" style="margin-block-start:8px">${s("PTZ ושמע אינם מוצגים במצלמה זו: היכולת לא אומתה. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.")}</div>`}
      </div><div class="stage-side">
      <div class="grid">
        <sw-card heading=${s("פרטים")}>
          <dl>
            <dt>${s("מצב")}</dt><dd><sw-badge kind=${e.state}></sw-badge></dd>
            <dt>${s("הקלטה")}</dt><dd>${{continuous:s("רציפה"),motion:s("לפי תנועה"),off:s("כבויה"),unknown:s("לא ידוע")}[e.recording]}</dd>
            <dt>${s("זרם")}</dt><dd>${e.fps?`${e.fps} fps · ${e.bitrateKbps} kbps`:"—"}</dd>
            <dt>${s("קושחה")}</dt><dd><span class="ltr">${e.firmware}</span></dd>
            <dt>${s("אירוע אחרון")}</dt><dd>${e.lastEvent}</dd>
          </dl>
        </sw-card>
        <sw-card heading=${s("מצלמות באותה קומה")}>
          <div class="tiles">
            ${C.filter(i=>i.floor===e.floor&&i.id!==e.id).slice(0,4).map(i=>r`<sw-camera-tile compact name=${i.name} state=${i.state} scene=${F[i.id]??"lobby"} @click=${()=>K(`/live/cameras/${i.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    </div></div>`}render(){const e=$(),t=e?this.cam?.name??s("מצלמה"):(C.find(i=>i.id===this.cameraId)??C[0]).name,a=e?this.cam?this.cam.standalone?z("noRecorder"):`${s("ערוץ {n}",{n:this.cam.channel})} · ${this.cam.name_source||""}`:"":`${(C.find(i=>i.id===this.cameraId)??C[0]).floor} · ${s("נתוני הדגמה")}`;return r`
      <sw-page heading=${t} subheading=${a} crumbs=${`${s("מצלמות")} | ${s("שידור חי")}`} backHref="/live/wall">
        ${this.cam?r`<sw-badge slot="actions" kind=${this.cam.status==="online"?"live":this.cam.status==="offline"?"offline":"unknown"}></sw-badge>`:n}
        ${e&&this.cam&&this.canConfigure?r`<sw-button slot="actions" variant="ghost" icon="edit" data-camera-rename @click=${()=>{this.renameMsg="",this.renameTo=this.cam?.alias??this.cam?.name??""}}>${s("שנה שם")}</sw-button>`:n}
        ${this.renderRename()}
        ${e&&this.cam?.standalone?n:r`<a slot="actions" href=${e&&this.cam?`#/investigate/playback?camera=${this.cam.id}`:"#/investigate/playback"}><sw-button icon="history">${s("הקלטות")}</sw-button></a>`}
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label=${s("במפה")}></sw-button></a>
        ${e&&this.cam&&bs()?r`<sw-button slot="actions" variant="ghost" icon="plus" data-camera-ticket @click=${()=>this.mapTicket=!0}>${vs()}</sw-button>`:n}
        ${this.mapTicket&&this.cam?r`<ticket-map-create open .element=${{pick:{resource:{type:"camera",id:this.cam.id}},name:this.cam.alias||this.cam.name,floorName:""}} @close=${()=>this.mapTicket=!1}></ticket-map-create>`:n}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};h.styles=Ss;m([x()],h.prototype,"cameraId",2);m([l()],h.prototype,"mapTicket",2);m([l()],h.prototype,"cam",2);m([l()],h.prototype,"zones",2);m([l()],h.prototype,"zonesBusy",2);m([l()],h.prototype,"zonesError",2);m([l()],h.prototype,"motionEdit",2);m([l()],h.prototype,"motionConfirm",2);m([l()],h.prototype,"motionBusy",2);m([l()],h.prototype,"motionMsg",2);m([l()],h.prototype,"rec",2);m([l()],h.prototype,"osd",2);m([l()],h.prototype,"sched",2);m([l()],h.prototype,"schedError",2);m([l()],h.prototype,"schedTab",2);m([l()],h.prototype,"schedEdit",2);m([l()],h.prototype,"schedBusy",2);m([l()],h.prototype,"schedMsg",2);m([l()],h.prototype,"schedConfirm",2);m([l()],h.prototype,"smart",2);m([l()],h.prototype,"smartEdit",2);m([l()],h.prototype,"smartBusy",2);m([l()],h.prototype,"smartMsg",2);m([l()],h.prototype,"osdMsg",2);m([l()],h.prototype,"renameTo",2);m([l()],h.prototype,"renameBusy",2);m([l()],h.prototype,"renameMsg",2);m([l()],h.prototype,"osdBusy",2);m([l()],h.prototype,"recMinutes",2);m([l()],h.prototype,"recBusy",2);m([l()],h.prototype,"recMsg",2);m([l()],h.prototype,"reboot",2);m([l()],h.prototype,"rebootOpen",2);m([l()],h.prototype,"rebootBusy",2);m([l()],h.prototype,"rebootMsg",2);m([l()],h.prototype,"source",2);m([l()],h.prototype,"sourceOpen",2);m([l()],h.prototype,"sourceMsg",2);m([l()],h.prototype,"zoneLayers",2);m([l()],h.prototype,"caps",2);m([l()],h.prototype,"capsError",2);m([l()],h.prototype,"cams",2);m([l()],h.prototype,"canConfigure",2);m([l()],h.prototype,"settings",2);m([l()],h.prototype,"error",2);m([l()],h.prototype,"loading",2);m([l()],h.prototype,"profile",2);m([l()],h.prototype,"transport",2);m([l()],h.prototype,"playerStatus",2);m([l()],h.prototype,"playerTransport",2);m([l()],h.prototype,"posterBust",2);m([l()],h.prototype,"ptzMode",2);m([J("sw-live-player")],h.prototype,"player",2);m([l()],h.prototype,"castShown",2);m([l()],h.prototype,"castOpen",2);m([l()],h.prototype,"castNote",2);m([J("[data-cast-button]")],h.prototype,"castBtn",2);h=m([A("live-camera")],h);export{h as LiveCamera};
