import{E as O,F as y,G as l,a as P,i as x,i$ as _,T as g,A as o,e as r,H as q,qL as Z,qM as U,qN as K,qO as j,qP as T,qQ as I,qR as G,qS as Y,qT as J,qU as X,qV as Q,qW as ee,j as te,eF as m,qX as se,qY as N,aw as ae,qZ as ie,q_ as re,q$ as oe,S as ne,r0 as S,w as $,qJ as de,n as le,r1 as ce,r2 as pe,eO as M,qr as he,K as ue,P as A,qI as me,r3 as B,r4 as L,r5 as fe,r6 as be,r7 as ve,r8 as we,r9 as ge,ra as ye,rb as $e,iK as xe,l as ke,rc as ze,ak as D,qy as E,eN as W,C as _e,br as F}from"./index-JXdHVZ86.js";import{f as Ee,g as Re,a as Te,s as Me,b as Ce,n as Ne,c as Se,d as C,e as Be}from"./frigate-control-ClXdJ_Cx.js";import"./sw-chip-D3EFOa_O.js";import{c as Ve,a as Oe,s as Pe,b as qe,d as je,o as Ie,w as Ae,e as V,f as Le,r as De,g as We,h as Ze,i as Ke,j as Fe}from"./nvr-DoSp9NWW.js";import"./sw-week-grid-CI47Q9n9.js";import{m as He,a as Ue}from"./map-create-wUdJPzKN.js";import{f as Ge}from"./frigate-text-DbeSU0J8.js";import"./sw-logo-art-Va6y_cIM.js";var Ye=Object.defineProperty,Je=Object.getOwnPropertyDescriptor,z=(e,t,s,a)=>{for(var i=a>1?void 0:a?Je(t,s):t,n=e.length-1,d;n>=0;n--)(d=e[n])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&Ye(t,s,i),i};let k=class extends P{constructor(){super(...arguments),this.cameraId="",this.recorderId="",this.data=null,this.profiles=null,this.pending=null,this.busy=!1,this.msg=null,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load()}async load(){const e=++this.seq;if(this.data=null,this.profiles=null,!(!x()||!this.cameraId||!this.recorderId)&&!(!(await Ee()).has(this.recorderId)||e!==this.seq)){try{const t=await Re(this.recorderId,this.cameraId);if(e!==this.seq)return;this.data=t.writable.analytics||t.writable.record?t:null}catch{this.data=null;return}try{const t=await Te(this.recorderId);e===this.seq&&t.can_switch&&t.names.length&&(this.profiles=t)}catch{}}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},3500)}ask(e){this.pending=e}cancel(){this.pending?.undo?.(),this.pending=null}async apply(e,t){if(!(!this.data&&!this.profiles)){this.busy=!0;try{if(e.group==="profile"){const s=await Me(this.recorderId,e.to||null,t);this.profiles&&(this.profiles={...this.profiles,active:s.active})}else{const s=await Ce(this.recorderId,this.cameraId,e.feature,e.to,t);if(this.data){const a=i=>i.feature===e.feature?{...i,value:e.to}:i;this.data={...this.data,features:this.data.features.map(a),named:this.data.named?.map(a)}}s.verified?this.flash("ok",_.frigate.control.saved):this.flash("ok",_.frigate.control.unverified)}e.group==="profile"&&this.flash("ok",_.frigate.control.saved)}catch(s){e.undo?.(),this.flash("err",`${_.frigate.control.failed}: ${g(s)}`),this.load()}finally{this.busy=!1,this.pending=null}}}onSwitch(e,t,s){const a=s.currentTarget,i=a.checked,n={group:e,feature:t,to:i,undo:()=>a.checked=!i};Ne(e)?this.ask(n):this.apply(n,!1)}group(e,t,s){const a=this.data,i=Se(a,e);return!s||!i.length?o:r`<div data-fcc-group=${e}>
      <h4>${t}</h4>
      <div class="grid">
        ${i.map(n=>r`<div class="row" data-fcc-row=${n.feature}>
          <span>${C(n.feature)}</span>
          <sw-toggle .checked=${n.value===!0} ?disabled=${this.busy} labelHidden label=${C(n.feature)} data-fcc-switch=${n.feature} @change=${d=>this.onSwitch(e,n.feature,d)}></sw-toggle>
        </div>`)}
      </div>
    </div>`}named(){const e=this.data,t=(e.named??[]).filter(a=>a.value!==null);if(!e.writable.analytics||!t.length)return o;const s=_.frigate.control;return r`<div data-fcc-group="named">
      <h4>${s.named}</h4>
      <div class="grid">
        ${t.map(a=>r`<div class="row" data-fcc-row=${a.feature}>
          <span><bdi>${C(a.feature)}</bdi></span>
          <sw-toggle .checked=${a.value===!0} ?disabled=${this.busy} labelHidden label=${C(a.feature)} data-fcc-switch=${a.feature} @change=${i=>this.onSwitch("analytics",a.feature,i)}></sw-toggle>
        </div>`)}
      </div>
    </div>`}dialog(){const e=this.pending;if(!e)return o;const t=_.frigate.control,s=e.group==="profile"?{title:`${t.profile}: ${e.to||t.noProfile}`,text:t.confirmProfile}:Be(e.group,e.feature,e.to);return r`<sw-dialog open heading=${s.title} data-fcc-confirm @close=${()=>this.cancel()}>
      ${s.text?r`<p class="dialog-text">${s.text}</p>`:o}
      <sw-button slot="footer" data-fcc-cancel @click=${()=>this.cancel()}>${t.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcc-ok ?disabled=${this.busy} @click=${()=>void this.apply(e,!0)}>${t.confirm}</sw-button>
    </sw-dialog>`}render(){const e=this.data;if(!e&&!this.profiles)return o;const t=_.frigate.control,s=this.profiles;return r`<div class="box" data-frigate-camera-control>
      ${e?this.group("analytics",t.analytics,e.writable.analytics):o}
      ${e?this.named():o}
      ${e?this.group("record",t.record,e.writable.record):o}
      ${s?r`<div class="row" data-fcc-profile>
        <h4>${t.profile}</h4>
        <select aria-label=${t.profile} .value=${s.active??""} ?disabled=${this.busy} @change=${a=>{const i=a.currentTarget,n=s.active??"";this.ask({group:"profile",feature:"profile",to:i.value||null,undo:()=>i.value=n})}}>
          <option value="">${t.noProfile}</option>
          ${s.names.map(a=>r`<option value=${a} ?selected=${a===s.active}>${a}</option>`)}
        </select>
      </div>`:o}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcc-msg>${this.msg.text}</div>`:o}
      ${this.dialog()}
    </div>`}};k.styles=O`
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
  `;z([y({attribute:"camera-id"})],k.prototype,"cameraId",2);z([y({attribute:"recorder-id"})],k.prototype,"recorderId",2);z([l()],k.prototype,"data",2);z([l()],k.prototype,"profiles",2);z([l()],k.prototype,"pending",2);z([l()],k.prototype,"busy",2);z([l()],k.prototype,"msg",2);k=z([q("frigate-camera-control")],k);const H={section:"הפעלה מחדש של המצלמה",button:"הפעל מחדש את המצלמה…",lead:"המצלמה תופעל מחדש דרך ה־NVR. במשך דקה–שתיים אין ממנה וידאו חי ואין הקלטה.",dialogTitle:"הפעלה מחדש של המצלמה",dialogSub:"{name} · ערוץ {channel}",dialogText:"המצלמה תתנתק לדקה–שתיים: אין וידאו חי ואין הקלטה של המצלמה הזו עד שתחזור. שאר המצלמות וה־NVR ממשיכים לעבוד. הפעולה נרשמת ביומן.",confirm:"הפעל מחדש",cancel:"ביטול",sending:"שולח…",done:"פקודת ההפעלה מחדש נשלחה. המצלמה תחזור בעוד דקה–שתיים.",reasonNotSupported:"ה־NVR הזה אינו מאפשר הפעלה מחדש של מצלמה מכאן.",reasonNoPermission:"אין לך הרשאה להפעיל מחדש מצלמות. מנהל המערכת יכול להעניק אותה.",reasonWritesOff:"שינויים ב־NVR כבויים. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.",reasonCooldown:"המצלמה הופעלה מחדש לפני רגע. אפשר לנסות שוב בעוד {min} דק׳.",errorRateLimited:"יותר מדי הפעלות מחדש ברצף. נסו שוב בעוד כמה דקות.",errorRejected:"ה־NVR דחה את הפקודה. המצלמה לא הופעלה מחדש.",errorUnavailable:"ה־NVR אינו זמין כרגע. המצלמה לא הופעלה מחדש.",errorForbidden:"אין הרשאה לפעולה הזו.",errorGeneric:"הפעולה נכשלה. המצלמה לא הופעלה מחדש."},Xe={section:"Restart camera",button:"Restart camera…",lead:"The camera restarts through the NVR. For a minute or two it has no live video and no recording.",dialogTitle:"Restart this camera",dialogSub:"{name} · channel {channel}",dialogText:"The camera goes offline for a minute or two: no live video and no recording from this camera until it is back. The other cameras and the NVR keep working. The action is logged.",confirm:"Restart",cancel:"Cancel",sending:"Sending…",done:"Restart command sent. The camera will be back in a minute or two.",reasonNotSupported:"This NVR does not allow restarting a camera from here.",reasonNoPermission:"You do not have permission to restart cameras. A system administrator can grant it.",reasonWritesOff:"NVR changes are turned off. They can be turned on in the NVR connection settings.",reasonCooldown:"The camera was just restarted. Try again in {min} min.",errorRateLimited:"Too many restarts in a row. Try again in a few minutes.",errorRejected:"The NVR refused the command. The camera was not restarted.",errorUnavailable:"The NVR is not reachable right now. The camera was not restarted.",errorForbidden:"You are not allowed to do this.",errorGeneric:"The action failed. The camera was not restarted."};function Qe(){return(typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}const et={he:H,en:Xe};function f(e,t,s=Qe()){const a=et[s][e]??H[e]??e;return t?a.replace(/\{(\w+)\}/g,(i,n)=>n in t?String(t[n]):i):a}const tt={not_supported:"reasonNotSupported",no_permission:"reasonNoPermission",writes_off:"reasonWritesOff",cooldown:"reasonCooldown"};function st(e,t=!1){if(!e||!e.supported)return{shown:!1,enabled:!1,reason:""};if(e.can_reboot)return{shown:!0,enabled:!t,reason:""};const s=tt[e.reason??""]??"errorGeneric",a=Math.max(1,Math.ceil((e.cooldown_s||0)/60));return{shown:!0,enabled:!1,reason:f(s,{min:a})}}function at(e){const t=typeof e=="object"&&e!==null&&"status"in e?Number(e.status):0,s=typeof e=="object"&&e!==null&&"code"in e?String(e.code??""):"";return s==="nvr_writes_off"?f("reasonWritesOff"):s==="camera_reboot_not_supported"||s==="nvr_not_supported"?f("reasonNotSupported"):s==="rate_limited"||t===429?f("errorRateLimited"):s==="nvr_rejected"?f("errorRejected"):s.startsWith("source_")||t===503?f("errorUnavailable"):f(t===403?"errorForbidden":"errorGeneric")}var it=Object.defineProperty,rt=Object.getOwnPropertyDescriptor,v=(e,t,s,a)=>{for(var i=a>1?void 0:a?rt(t,s):t,n=e.length-1,d;n>=0;n--)(d=e[n])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&it(t,s,i),i};const ot={confirmed:N.confirmed,likely:N.likely,unknown:N.unknown,manual:"נקבע ידנית"};let b=class extends P{constructor(){super(...arguments),this.open=!1,this.cameraId="",this.cameraName="",this.anchor=null,this.profile="sub",this.phone=!1,this.ddPhone="",this.remote=!1,this.data=null,this.loading=!1,this.error="",this.busyKey="",this.confirm=null,this.quality="sub",this.watch=new Z(this),this.onKey=e=>{e.key==="Escape"&&this.open&&this.close()},this.onDoc=e=>{if(!this.open||this.mode()==="sheet")return;const t=e.composedPath();t.includes(this)||this.anchor&&t.includes(this.anchor)||this.close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.onKey),document.addEventListener("pointerdown",this.onDoc,!0)}disconnectedCallback(){document.removeEventListener("keydown",this.onKey),document.removeEventListener("pointerdown",this.onDoc,!0),super.disconnectedCallback()}willUpdate(e){e.has("open")&&this.open&&(this.error="",this.confirm=null,this.quality=this.profile==="main"?"main":"sub",this.load())}updated(e){this.open&&this.mode()==="pop"&&(e.has("open")||e.has("data"))&&this.place()}mode(){const e=U({phone:this.phone,ddPhone:this.ddPhone});return e==="panel"?"pop":e}async load(){this.loading=!0;try{this.data=await K(this.cameraId||void 0)}catch(e){this.data=null,this.error=g(e)}finally{this.loading=!1}}place(){const e=this.renderRoot.querySelector(".panel.pop"),t=this.anchor;if(!e||!t)return;const s=t.getBoundingClientRect(),a=e.offsetHeight,i=e.offsetWidth,d=s.top-8-a>=8?s.top-8-a:Math.min(window.innerHeight-a-8,s.bottom+8);let h=getComputedStyle(this).direction==="rtl"?s.right-i:s.left;h=Math.max(8,Math.min(window.innerWidth-i-8,h)),e.style.top=`${Math.max(8,d)}px`,e.style.left=`${h}px`}close(){this.confirm=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}mineOn(e){const t=j(T.sessions,e);return t&&t.mine?t:null}async pick(e,t=!1,s=!1){if(!I(e)||this.busyKey||!this.cameraId)return;if(G(e)&&!s){this.confirm={target:e,permanent:t};return}this.confirm=null,this.busyKey=e.key,this.error="";const a=this.quality==="main"&&e.main_allowed?"main":"sub";try{const i=this.mineOn(e.key),n=i&&i.can.switch&&!t&&i.camera_id!==this.cameraId?await Y(i.session_id,{camera_id:this.cameraId,profile:a}):await J({target_key:e.key,camera_id:this.cameraId,profile:a,duration:t?"permanent":"default",client_request_id:X(),confirmed:s||void 0});if(T.put(n.session),n.status==="refused"){this.error=Q(n.error),this.dispatchEvent(new CustomEvent("cast-error",{detail:{message:this.error},bubbles:!0,composed:!0}));return}ee(e.key),this.dispatchEvent(new CustomEvent("cast-started",{detail:{session:n.session},bubbles:!0,composed:!0})),this.close()}catch(i){i instanceof te&&i.body.code==="cast_busy"&&!s?this.confirm={target:e,permanent:t}:(this.error=g(i),this.dispatchEvent(new CustomEvent("cast-error",{detail:{message:this.error},bubbles:!0,composed:!0})),this.load())}finally{this.busyKey=""}}row(e){const t=this.mineOn(e.key),s=!!t&&t.camera_id===this.cameraId,a=!I(e)||s,i=j(T.sessions,e.key),n=s?`${m("cast.stateCasting")}: ${this.cameraName||t?.camera_name||""}`:se(e,i),d=[e.area_name].filter(Boolean).join(" · "),u=e.confidence&&!e.blocked?ot[e.confidence]:"";return r`<div class="row-wrap" data-cast-target=${e.key}>
      <button type="button" class=${`row ${e.state==="casting"?"casting":""}`} aria-disabled=${a?"true":"false"} data-cast-state=${e.state} data-cast-blocked=${e.blocked??""}
        @click=${()=>a?void 0:void this.pick(e)}>
        <span class="ic"><sw-icon name=${e.blocked?"lock":"media"} size=${18}></sw-icon></span>
        <span class="tx"><span class="nm">${e.name}</span><span class=${`ln ${e.state==="playing_music"?"warn":""}`}>${d?`${d} · `:""}${this.busyKey===e.key?m("cast.starting"):n}</span></span>
        ${u?r`<sw-badge kind=${e.confidence==="confirmed"?"live":"neutral"} label=${u}></sw-badge>`:o}
      </button>
      ${e.permanent_allowed&&!a?r`<button type="button" class="perm" data-cast-permanent title=${m("cast.durationPermanent")} aria-label=${`${m("cast.durationPermanent")}: ${e.name}`} @click=${()=>void this.pick(e,!0)}>${m("cast.pillPermanent")}</button>`:o}
      ${s&&t?r`<sw-cast-stop .session=${t} variant="ghost"></sw-cast-stop>`:o}
    </div>`}body(){const e=this.data,t=ae("system.configure");if(this.loading&&!e)return r`<div class="state" role="status" data-cast-loading>${m("cast.loading")}</div>`;if(!e)return this.error?r`<div class="err" role="alert" data-cast-error>${this.error}</div>`:r`${o}`;if(!e.ready)return r`<div class="state" role="status" data-cast-notready>${ie(e.reason,t)}</div>`;const s=re(e.targets,oe()),a=e.main_possible;return r`
      <div class="opts" data-cast-quality>
        <span>${m("camera.quality")}</span>
        <div class="seg" role="group" aria-label=${m("camera.quality")}>
          <button type="button" aria-pressed=${this.quality==="sub"} data-cast-q="sub" @click=${()=>this.quality="sub"}>${m("cast.profileSub")}</button>
          <button type="button" aria-pressed=${this.quality==="main"} data-cast-q="main" ?disabled=${!a} title=${a?"":m("cast.profileMainNo")} @click=${()=>this.quality="main"}>${m("cast.profileMain")}</button>
        </div>
      </div>
      ${this.error?r`<div class="err" role="alert" data-cast-error>${this.error}</div>`:o}
      ${this.confirm?r`<div class="ask" role="alertdialog" aria-label=${m("cast.confirmBusy")} data-cast-confirm>
            <span>${this.confirm.target.name}: ${m("cast.confirmBusy")}</span>
            <div class="btns"><button type="button" class="yes" data-cast-confirm-yes @click=${()=>void this.pick(this.confirm.target,this.confirm.permanent,!0)}>${m("cast.confirmBusyYes")}</button>
              <button type="button" class="no" data-cast-confirm-no @click=${()=>this.confirm=null}>${m("actions.cancel")}</button></div>
          </div>`:o}
      <div class="body" data-cast-list>
        ${s.length?s.map(i=>r`<div class="grp" data-cast-group=${i.id}>${i.title}</div>${i.targets.map(n=>this.row(n))}`):r`<div class="state" data-cast-empty>${m("cast.empty")}</div>`}
      </div>
      ${this.remote?r`<div class="note" data-cast-remote-note>${m("cast.remoteNote")}</div>`:o}`}head(e){return r`<header><div><h3>${m("cast.pickerTitle")}</h3>${this.cameraName?r`<div class="sub">${m("cast.pickerFor")} ${this.cameraName}</div>`:o}</div>
      ${e?r`<button type="button" class="x" aria-label=${m("cast.close")} data-cast-close @click=${()=>this.close()}><sw-icon name="close" size=${16}></sw-icon></button>`:o}</header>`}foot(){const e=this.data;return r`<footer><span>${e&&e.ready?`${e.active}/${e.max_sessions}`:""}</span>
      <a class="link" data-cast-mine href="#/multimedia/cast" @click=${t=>{t.preventDefault(),this.close(),location.hash="#/multimedia/cast"}}>${m("cast.mineLink")}</a></footer>`}render(){if(!this.open)return o;const e=this.mode();return this.watch,e==="sheet"?r`<sw-sheet open kind="sheet" @close=${()=>this.close()}>
        <div class="panel sheet" data-cast-picker="sheet" role="region" aria-label=${m("cast.sheetRegion")}>${this.head(!1)}${this.body()}${this.foot()}</div></sw-sheet>`:r`<div class=${`panel ${e}`} data-cast-picker=${e} role="dialog" aria-label=${m("cast.sheetRegion")}>${this.head(!0)}${this.body()}${this.foot()}</div>`}};b.styles=O`
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
    .seg button:focus-visible,
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
    .seg {
      display: inline-flex;
      padding: 2px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      padding: 3px 12px;
      border-radius: var(--sw-r-pill);
      cursor: pointer;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent, var(--sw-text)));
      /* DARK-REVIEW-2342: the bare accent read ~2.2:1 on the lifted dark thumb (3.3:1 on the old one) - dark takes the accent's text ink;
         light keeps the accent (an engine without light-dark() keeps the line above) */
      color: var(--sw-seg-key-ink, light-dark(var(--sw-accent, var(--sw-text)), var(--sw-accent-text)));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .seg button[disabled] {
      opacity: 0.5;
      cursor: default;
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
  `;v([y({type:Boolean,reflect:!0})],b.prototype,"open",2);v([y()],b.prototype,"cameraId",2);v([y()],b.prototype,"cameraName",2);v([y({attribute:!1})],b.prototype,"anchor",2);v([y()],b.prototype,"profile",2);v([y({type:Boolean})],b.prototype,"phone",2);v([y()],b.prototype,"ddPhone",2);v([y({type:Boolean})],b.prototype,"remote",2);v([l()],b.prototype,"data",2);v([l()],b.prototype,"loading",2);v([l()],b.prototype,"error",2);v([l()],b.prototype,"busyKey",2);v([l()],b.prototype,"confirm",2);v([l()],b.prototype,"quality",2);b=v([q("sw-cast-picker")],b);var nt=Object.defineProperty,dt=Object.getOwnPropertyDescriptor,p=(e,t,s,a)=>{for(var i=a>1?void 0:a?dt(t,s):t,n=e.length-1,d;n>=0;n--)(d=e[n])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&nt(t,s,i),i};let c=class extends P{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.cameraId="cam-1",this.mapTicket=!1,this.cam=null,this.zones=null,this.zonesBusy=!1,this.zonesError="",this.motionEdit=null,this.motionConfirm=!1,this.motionBusy=!1,this.motionMsg="",this.paintValue=null,this.rec=null,this.osd=null,this.sched=null,this.schedError="",this.schedTab="motion",this.schedEdit=null,this.schedBusy=!1,this.schedMsg="",this.schedConfirm=!1,this.smart=null,this.smartEdit=null,this.smartBusy=!1,this.smartMsg="",this.osdMsg="",this.renameTo=null,this.renameBusy=!1,this.renameMsg="",this.osdBusy=!1,this.recMinutes=10,this.recBusy=!1,this.recMsg="",this.recTimer=0,this.reboot=null,this.rebootOpen=!1,this.rebootBusy=!1,this.rebootMsg="",this.zoneLayers={motion:!0,privacy:!0,intrusion:!0,lines:!0},this.caps=null,this.capsError="",this.cams=[],this.canConfigure=!1,this.settings=null,this.error="",this.loading=!0,this.profile="main",this.transport="auto",this.playerStatus="",this.playerTransport="",this.posterBust=Date.now(),this.ptzMode="presets",this.castShown=!1,this.castOpen=!1,this.castNote="",this.castWatch=new Z(this),this.castNoteTimer=0}async loadSchedules(){if(!(!this.cam||!x())){if(!S()){this.sched=null,this.smart=null,this.schedError="לוחות הזמנים וחוקי ה־smart של ה־NVR נקראים עם הרשאת ניהול NVR.";return}try{this.sched=await Ve(this.cam.id),this.schedError="",!this.sched.arming[this.schedTab]&&this.schedTab!=="record"&&(this.schedTab=Object.keys(this.sched.arming)[0]??"record")}catch(e){this.schedError=g(e)}try{this.smart=await Oe(this.cam.id)}catch{this.smart=null}}}startSchedEdit(){const e=this.sched;if(!e)return;const t=this.schedTab,s=(t==="record"?e.record?.days:e.arming[t])??Array.from({length:7},()=>[]);this.schedMsg="",this.schedEdit={kind:t,days:s.map(a=>a.map(i=>({...i}))),schedule_enabled:e.record?.schedule_enabled??null,enabled:e.record?.enabled}}schedDiff(){const e=this.schedEdit,t=this.sched;if(!e||!t)return 0;const s=(e.kind==="record"?t.record?.days:t.arming[e.kind])??[],a=i=>i.map(n=>n.map(d=>`${d.begin}-${d.end}-${d.mode??""}`).join(",")).join("|");return a(s)===a(e.days)?0:1}async saveSched(){const e=this.schedEdit;if(!(!e||!this.cam||this.schedBusy)){this.schedBusy=!0,this.schedConfirm=!1;try{const t=e.kind==="record"?await Pe(this.cam.id,{days:e.days,...e.schedule_enabled!==null&&e.schedule_enabled!==this.sched?.record?.schedule_enabled?{schedule_enabled:e.schedule_enabled??void 0}:{}}):await qe(this.cam.id,e.kind,e.days);this.schedMsg=t.status==="unchanged"?"ה־NVR כבר היה במצב הזה — לא נכתב דבר.":"הלוח נכתב ל־NVR ונרשם (ניתן להחזרה מרשימת השינויים בהגדרות ‹ חיבורים).",this.schedEdit=null,await this.loadSchedules()}catch(t){this.schedMsg=g(t)}finally{this.schedBusy=!1}}}renderSchedules(){const e=this.sched;if(this.schedError&&!e)return r`<div class="note">${this.schedError}</div>`;if(!e)return r`<div class="note">קורא לוחות מה־NVR…</div>`;const t=[{id:"motion",label:"זיהוי תנועה",ok:!!e.arming.motion},{id:"line",label:"חציית קו",ok:!!e.arming.line},{id:"field",label:"פריצה לאזור",ok:!!e.arming.field},{id:"record",label:"לוח הקלטה",ok:!!e.record}],s=this.schedTab,a=this.schedEdit?.kind===s?this.schedEdit:null,i=a?a.days:s==="record"?e.record?.days:e.arming[s],n=[{id:"CMR",label:"רציף",color:"var(--sw-recorded)"},{id:"MOTION",label:"תנועה",color:"var(--sw-purple)"},{id:"EDR",label:"אירוע",color:"var(--sw-warning)"},{id:"ALARM",label:"אזעקה",color:"var(--sw-danger)"}],d=s==="record"?e.can.schedule:e.can.events,u=t.find(h=>h.id===s)?.label??"";return r`<div class="note">${t.length} לוחות בכרטיס הזה, כולל <strong>לוח הקלטה</strong> (מתי הערוץ מקליט בפועל) — לא רק לוחות הזיהוי.</div>
      <div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-end:8px" data-schedules-tabs>
        ${t.map(h=>r`<sw-chip ?selected=${s===h.id} ?disabled=${!h.ok} data-sched-tab=${h.id} title=${h.ok?"":e.unsupported[h.id]??"לא נתמך בערוץ זה"} @click=${()=>{h.ok&&(this.schedTab=h.id,this.schedEdit=null)}}>${h.label}${h.ok?"":" · לא זמין"}</sw-chip>`)}
        <span class="grow"></span>
        ${d&&!a?r`<sw-button size="sm" icon="edit" data-sched-edit @click=${()=>this.startSchedEdit()}>עריכה</sw-button>`:o}
      </div>
      ${i?r`<sw-week-grid data-week-grid .days=${i} .modes=${s==="record"?n:[{id:"on",label:"פעיל",color:"var(--sw-accent)"}]} ?editable=${!!a}
            @change=${h=>{this.schedEdit&&(this.schedEdit={...this.schedEdit,days:h.detail.days})}}></sw-week-grid>`:r`<div class="note">הלוח הזה לא נקרא מה־NVR${e.unsupported[s]?` (${e.unsupported[s]})`:""}.</div>`}
      ${s==="record"&&e.record?r`<div class="note" style="margin-block-start:6px">ברירת מחדל: ${e.record.default_mode??"—"} · לפני אירוע ${e.record.pre_record_s??"—"} שנ׳ · אחרי ${e.record.post_record_s??"—"} שנ׳ · הקלטה ${e.record.enabled?"פעילה":"כבויה"} · לוח ${e.record.schedule_enabled===!1?"כבוי (מקליט לפי ברירת המחדל)":"פעיל"}
            ${a?r`<label style="display:inline-flex;gap:4px;align-items:center;margin-inline-start:8px"><input type="checkbox" data-sched-enabled .checked=${a.schedule_enabled!==!1} @change=${h=>this.schedEdit={...a,schedule_enabled:h.target.checked}} /> לוח פעיל</label>`:o}</div>`:o}
      ${a?r`<div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-start:8px" data-sched-editor>
            <span class="note">${s==="record"?"צבע = מצב הקלטה לשעה זו; תא ריק = אין הקלטה בשעה זו. טעות כאן = שעות בלי הקלטה, לכן יש אישור והחזר.":"תא צבוע = הזיהוי פעיל בשעה זו; כיבוי כל היום = בלי התראות מהערוץ בזמן הזה."}</span>
            <span class="grow"></span>
            <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.schedBusy||!this.schedDiff()&&(s!=="record"||a.schedule_enabled===(e.record?.schedule_enabled??null))} data-sched-save @click=${()=>this.schedConfirm=!0}>שמור ל־NVR</sw-button>
            <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.schedBusy} data-sched-cancel @click=${()=>this.schedEdit=null}>ביטול</sw-button>
          </div>`:o}
      ${this.schedConfirm&&a?r`<sw-dialog open heading=${`כתיבה ל־NVR: ${u}`} subheading=${`${this.cam?.name??""} · ערוץ ${e.channel}`} data-sched-confirm @close=${()=>this.schedConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${a.days.map(h=>h.length).reduce((h,w)=>h+w,0)} טווחים בשבוע${s==="record"?` · ${a.days.flat().filter(h=>h.mode==="CMR").length} רציף, ${a.days.flat().filter(h=>h.mode==="MOTION").length} תנועה, ${a.days.flat().filter(h=>h.mode==="EDR").length} אירוע`:""}.</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה בלחיצה.</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.schedBusy} data-sched-confirm-run @click=${()=>this.saveSched()}>${this.schedBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.schedConfirm=!1}>ביטול</sw-button></div>
          </sw-dialog>`:o}
      ${this.schedMsg?r`<div class="note" data-sched-msg>${this.schedMsg}</div>`:o}`}startSmartEdit(){const e=this.smart;if(!e)return;this.smartMsg="";const t=e.line?{enabled:e.line.enabled,lines:e.line.lines.map(a=>({...a,points:a.points.map(i=>[...i])}))}:null,s=e.field?{enabled:e.field.enabled,regions:e.field.regions.map(a=>({...a,points:a.points.map(i=>[...i])}))}:null;this.smartEdit={line:t,field:s,tool:t?{type:"line",id:t.lines[0]?.id??1}:{type:"field",id:s?.regions[0]?.id??1}}}smartClick(e){const t=this.smartEdit;if(!t)return;const a=e.currentTarget.getBoundingClientRect(),i=Math.round(Math.max(0,Math.min(1e3,(e.clientX-a.left)/a.width*1e3))),n=Math.round(Math.max(0,Math.min(1e3,(e.clientY-a.top)/a.height*1e3)));if(t.tool.type==="line"&&t.line){const d=t.line.lines.map(u=>{if(u.id!==t.tool.id)return u;const w=[...u.points.length>=2&&!(u.points[0][0]===0&&u.points[0][1]===1e3&&u.points[1][0]===0&&u.points[1][1]===1e3)&&u.points.length!==1?[]:u.points.filter(R=>!(R[0]===0&&R[1]===1e3)),[i,n]].slice(-2);return{...u,points:w,enabled:w.length===2?!0:u.enabled}});this.smartEdit={...t,line:{...t.line,lines:d}}}else if(t.tool.type==="field"&&t.field){const d=t.field.regions.map(u=>u.id===t.tool.id&&u.points.length<10?{...u,points:[...u.points,[i,n]]}:u);this.smartEdit={...t,field:{...t.field,regions:d}}}}async saveSmart(){const e=this.smartEdit;if(!(!e||!this.cam||this.smartBusy)){this.smartBusy=!0;try{const t={};e.line&&(t.line={enabled:e.line.enabled,lines:e.line.lines.filter(n=>n.points.length===2)}),e.field&&(t.field={enabled:e.field.enabled,regions:e.field.regions.filter(n=>n.points.length===0||n.points.length>=4)});const s=await je(this.cam.id,t),a=Object.values(s).map(n=>n.status),i=Object.values(s).some(n=>n.enable_refused);this.smartMsg=a.every(n=>n==="unchanged")?"ה־NVR כבר היה במצב הזה — לא נכתב דבר.":i?"הצורות והפרמטרים נכתבו ל־NVR ונרשמו, אבל ה־NVR סירב להפעיל את הכלל דרך ה־ISAPI (invalidOperation). בקושחה הזו ההפעלה נעשית בממשק ה־NVR / המצלמה (משאב VCA של המצלמה); אחרי ההפעלה שם התצוגה כאן תתעדכן.":'הכללים נכתבו ל־NVR ונרשמו (ניתנים להחזרה). התראות "אדם" / "רכב" מגיעות רק כשהערוץ מודיע ל־Arx (הגדרות ‹ חיבורים ‹ התראות מה־NVR).',this.smartEdit=null,await Promise.all([this.loadSchedules(),this.loadZones(!0)])}catch(t){this.smartMsg=g(t)}finally{this.smartBusy=!1}}}renderSmartOverlay(){const e=this.smartEdit;if(!e)return o;const t=(s,a)=>e.tool.type===s&&e.tool.id===a;return $`
      ${e.field?e.field.regions.filter(s=>s.points.length>=1).map(s=>$`<polygon points=${s.points.map(a=>a.join(",")).join(" ")} class="field" style=${t("field",s.id)?"stroke:var(--sw-on-video);stroke-width:6":""}></polygon>${s.points.map(a=>$`<circle class="handle field" cx=${a[0]} cy=${a[1]} r="9"></circle>`)}`):o}
      ${e.line?e.line.lines.filter(s=>s.points.length>=1&&!(s.points[0][0]===0&&s.points[0][1]===1e3)).map(s=>$`<polyline points=${s.points.map(a=>a.join(",")).join(" ")} class="line ${s.enabled?"":"off"}" style=${t("line",s.id)?"stroke:var(--sw-on-video)":""}></polyline>${s.points.map(a=>$`<circle class="handle line" cx=${a[0]} cy=${a[1]} r="9"></circle>`)}`):o}
    `}renderSmartEditor(){const e=this.smartEdit,t=s=>({any:"שני הכיוונים","left-right":"שמאל → ימין","right-left":"ימין → שמאל"})[s]??s;return r`<div class="legend" data-smart-editor style="display:grid;gap:8px;margin-block-start:8px">
      <div class="note">בחר כלל ולחץ על התמונה כדי לצייר: קו = <strong>שתי</strong> לחיצות (התחלה וסוף — לחיצה נוספת מזיזה את הסוף); אזור פריצה = <strong>4 עד 10</strong> לחיצות (נקודה לכל פינה), ואז ישר "שמור ל־NVR" למטה — אין צורך לסגור את הצורה. "אדם" / "רכב" = סינון אזעקות שווא (רק מטרה מסוג זה מפעילה).</div>
      ${e.line?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-lines>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" data-smart-line-enabled .checked=${e.line.enabled} @change=${s=>this.smartEdit={...e,line:{...e.line,enabled:s.target.checked}}} /> חציית קו פעילה</label>
          ${e.line.lines.map(s=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:var(--sw-r-sm);padding:4px 8px" data-smart-line=${s.id}>
            <sw-chip ?selected=${e.tool.type==="line"&&e.tool.id===s.id} data-smart-pick-line=${s.id} @click=${()=>this.smartEdit={...e,tool:{type:"line",id:s.id}}}>קו ${s.id}${s.points.length===2&&!(s.points[0][0]===0&&s.points[0][1]===1e3)?"":" · לא מצויר"}</sw-chip>
            <label class="note"><input type="checkbox" .checked=${s.enabled} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===s.id?{...i,enabled:a.target.checked}:i)}}} /> פעיל</label>
            <select class="note" aria-label="כיוון" .value=${s.direction} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===s.id?{...i,direction:a.target.value}:i)}}}>${["any","left-right","right-left"].map(a=>r`<option value=${a} ?selected=${a===s.direction}>${t(a)}</option>`)}</select>
            <label class="note">רגישות <input type="range" min="1" max="100" .value=${String(s.sensitivity)} @input=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===s.id?{...i,sensitivity:Number(a.target.value)}:i)}}} /> ${s.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${s.human} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===s.id?{...i,human:a.target.checked}:i)}}} /> אדם</label>
            <label class="note"><input type="checkbox" .checked=${s.vehicle} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===s.id?{...i,vehicle:a.target.checked}:i)}}} /> רכב</label>
          </span>`)}
        </div>`:o}
      ${e.field?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-regions>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" data-smart-field-enabled .checked=${e.field.enabled} @change=${s=>this.smartEdit={...e,field:{...e.field,enabled:s.target.checked}}} /> פריצה לאזור פעילה</label>
          ${e.field.regions.map(s=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:var(--sw-r-sm);padding:4px 8px" data-smart-region=${s.id}>
            <sw-chip ?selected=${e.tool.type==="field"&&e.tool.id===s.id} data-smart-pick-region=${s.id} @click=${()=>this.smartEdit={...e,tool:{type:"field",id:s.id}}}>אזור ${s.id} · ${s.points.length} נק׳</sw-chip>
            <sw-button size="sm" variant="ghost" data-smart-region-clear=${s.id} @click=${()=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(a=>a.id===s.id?{...a,points:[]}:a)}}}>נקה</sw-button>
            <label class="note">רגישות <input type="range" min="1" max="100" .value=${String(s.sensitivity)} @input=${a=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===s.id?{...i,sensitivity:Number(a.target.value)}:i)}}} /> ${s.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${s.human} @change=${a=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===s.id?{...i,human:a.target.checked}:i)}}} /> אדם</label>
            <label class="note"><input type="checkbox" .checked=${s.vehicle} @change=${a=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===s.id?{...i,vehicle:a.target.checked}:i)}}} /> רכב</label>
          </span>`)}
        </div>`:o}
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="grow"></span>
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.smartBusy} data-smart-save @click=${()=>this.saveSmart()}>${this.smartBusy?"כותב…":"שמור ל־NVR"}</sw-button>
        <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.smartBusy} data-smart-cancel @click=${()=>this.smartEdit=null}>ביטול</sw-button>
      </div>
    </div>`}async saveRename(){if(!(this.renameTo===null||!this.cam||this.renameBusy)){this.renameBusy=!0,this.renameMsg="";try{const e=await de(this.cam.id,{alias:this.renameTo.trim()});this.cam={...this.cam,...e},this.cams=this.cams.map(t=>t.id===e.id?{...t,...e}:t),this.renameTo=null,this.loadOsd()}catch(e){this.renameMsg=g(e)}finally{this.renameBusy=!1}}}renderRename(){return this.renameTo===null?o:r`<sw-dialog open heading="שינוי שם המצלמה" subheading="השם במערכת (בקיר, במפה, באירועים). השם ב־NVR לא משתנה, אלא אם כותבים אותו מסעיף ה־OSD למטה." data-rename-dialog @close=${()=>this.renameTo=null}>
      <sw-field label="שם"><input data-rename-input maxlength="80" .value=${this.renameTo} placeholder=${this.cam?.name_source??""} @input=${e=>this.renameTo=e.target.value} @keydown=${e=>{e.key==="Enter"&&this.saveRename()}} /></sw-field>
      <div class="note">ריק = השם מה־NVR${this.cam?.name_source?` („${this.cam.name_source}“)`:""}.</div>
      ${this.renameMsg?r`<div class="note" style="color:var(--sw-danger)">${this.renameMsg}</div>`:o}
      <div slot="footer"><sw-button variant="primary" icon="check" ?disabled=${this.renameBusy} data-rename-save @click=${()=>this.saveRename()}>שמור</sw-button><sw-button variant="ghost" @click=${()=>this.renameTo=null}>ביטול</sw-button></div>
    </sw-dialog>`}async loadOsd(){if(!(!this.cam||!x())){if(!S()){this.osd=null;return}try{this.osd=await Ie(this.cam.id)}catch{this.osd=null}}}async osdAction(e,t){if(!this.osdBusy){this.osdBusy=!0,this.osdMsg="";try{await t(),this.osdMsg=`${e}: נכתב ל־NVR ונרשם.`,await this.loadOsd()}catch(s){this.osdMsg=`${e}: ${g(s)}`}finally{this.osdBusy=!1}}}renderOsd(){const e=this.osd;if(!e||!e.can_write)return o;const t=(e.nvr_name??"")===e.vms_name;return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-osd>
      <span>שם ב־NVR: <b data-osd-nvr-name>${e.nvr_name??"—"}</b>${t?" (זהה לשם ב־Arx)":` · ב־Arx: ${e.vms_name}`}</span>
      <sw-button size="sm" icon="edit" ?disabled=${this.osdBusy||t} data-osd-write-name @click=${()=>this.osdAction("שם הערוץ",()=>Ae(this.cam.id))}>כתוב את השם מ־Arx ל־NVR</sw-button>
      ${e.channel_name?r`<label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-osd-name-enabled .checked=${e.channel_name.enabled} ?disabled=${this.osdBusy} @change=${s=>this.osdAction("שם על התמונה",()=>V(this.cam.id,{name_enabled:s.target.checked}))} /> שם על התמונה</label>`:o}
      ${e.datetime?r`<label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-osd-datetime-enabled .checked=${e.datetime.enabled} ?disabled=${this.osdBusy} @change=${s=>this.osdAction("חותמת זמן",()=>V(this.cam.id,{datetime_enabled:s.target.checked}))} /> חותמת זמן</label>
        <sw-field><select aria-label="פורמט תאריך" data-osd-date-style ?disabled=${this.osdBusy} @change=${s=>this.osdAction("פורמט תאריך",()=>V(this.cam.id,{date_style:s.target.value}))}>${e.date_styles.map(s=>r`<option value=${s} ?selected=${s===e.datetime.date_style}>${s}</option>`)}</select></sw-field>`:o}
      ${this.osdMsg?r`<span data-osd-msg>${this.osdMsg}</span>`:o}
    </div>`}async loadReboot(){if(!this.cam||!x()||!S()){this.reboot=null;return}try{this.reboot=await Le(this.cam.id)}catch{this.reboot=null}}async runReboot(){if(!(!this.cam||this.rebootBusy)){this.rebootBusy=!0,this.rebootMsg="";try{await De(this.cam.id),this.rebootMsg=f("done")}catch(e){this.rebootMsg=at(e)}finally{this.rebootBusy=!1,this.rebootOpen=!1,await this.loadReboot()}}}renderReboot(){const e=st(this.reboot,this.rebootBusy);if(!e.shown||!this.cam)return o;const t=this.cam;return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-camera-reboot data-enabled=${e.enabled?"yes":"no"}>
      <span>${f("lead")}</span>
      <sw-button size="sm" variant="danger" icon="refresh" ?disabled=${!e.enabled} title=${e.reason||o} aria-describedby=${e.reason?"camera-reboot-reason":o}
        data-camera-reboot-open @click=${()=>{this.rebootMsg="",this.rebootOpen=!0}}>${this.rebootBusy?f("sending"):f("button")}</sw-button>
      ${e.reason?r`<span class="muted" id="camera-reboot-reason" data-camera-reboot-reason>${e.reason}</span>`:o}
      ${this.rebootMsg?r`<span role="status" data-camera-reboot-msg>${this.rebootMsg}</span>`:o}
    </div>
    ${this.rebootOpen?r`<sw-dialog open heading=${f("dialogTitle")} subheading=${f("dialogSub",{name:t.name,channel:t.channel??"—"})} data-camera-reboot-dialog @close=${()=>this.rebootOpen=!1}>
          <p>${f("dialogText")}</p>
          <div slot="footer"><sw-button variant="danger" ?disabled=${this.rebootBusy} data-camera-reboot-run @click=${()=>void this.runReboot()}>${f("confirm")}</sw-button><sw-button variant="ghost" @click=${()=>this.rebootOpen=!1}>${f("cancel")}</sw-button></div>
        </sw-dialog>`:o}`}async loadRecord(){if(!(!this.cam||!x())){try{this.rec=await We(this.cam.id)}catch{this.rec=null}window.clearTimeout(this.recTimer),this.rec?.active&&(this.recTimer=window.setTimeout(()=>void this.loadRecord(),15e3))}}async toggleRecord(){if(!(!this.cam||this.recBusy)){this.recBusy=!0,this.recMsg="";try{if(this.rec?.active)await Ze(this.cam.id),this.recMsg="ההקלטה הידנית נעצרה.";else{const e=await Ke(this.cam.id,this.recMinutes);this.recMsg=`הקלטה ידנית החלה · תיעצר אוטומטית ב־${le(new Date(e.stop_at))}.`}await this.loadRecord()}catch(e){this.recMsg=g(e)}finally{this.recBusy=!1}}}renderRecord(){const e=this.rec;if(!e||!e.can_write)return o;const t=e.active,s=t?`${Math.floor(t.remaining_s/60)}:${String(t.remaining_s%60).padStart(2,"0")}`:"";return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-manual-record data-active=${t?"yes":"no"}>
      ${t?r`<sw-badge kind="live" label=${`הקלטה ידנית פעילה · נותרו ${s}`}></sw-badge>
          <sw-button size="sm" variant="danger" icon="close" ?disabled=${this.recBusy} data-record-stop @click=${()=>this.toggleRecord()}>עצור הקלטה</sw-button>`:r`<sw-field><select aria-label="משך הקלטה ידנית" data-record-minutes @change=${a=>this.recMinutes=Number(a.target.value)}>${[5,10,30,60,120].map(a=>r`<option value=${a} ?selected=${a===this.recMinutes}>${a} דק׳</option>`)}</select></sw-field>
          <sw-button size="sm" variant="primary" icon="live" ?disabled=${this.recBusy||!e.track_id} data-record-start @click=${()=>this.toggleRecord()}>הקלט עכשיו</sw-button>
          ${e.track_id?r`<span>הקלטה ידנית ב־NVR על הזרם הראשי; נעצרת אוטומטית בתום הזמן גם אם המסך נסגר. ההקלטה עצמה מצטרפת להקלטות הרגילות של הערוץ — היא נמצאת לפי הזמן במסך "הקלטות", לא בתגית נפרדת.</span>`:r`<span class="warn" data-record-unavailable>אין זרם ראשי זמין למצלמה זו כרגע, אי אפשר להקליט ידנית.</span>`}`}
      ${this.recMsg?r`<span data-record-msg>${this.recMsg}</span>`:o}
    </div>`}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load(),e.has("cam")&&this.cam&&x()&&!this.zonesBusy&&(!this.zones||this.zones.camera_id!==this.cam.id)&&(this.loadRecord(),this.loadOsd(),this.loadReboot(),this.loadSchedules(),this.zonesError="",this.loadZones()),e.has("cam")&&this.cam&&x()&&(!this.caps||this.caps.camera_id!==this.cam.id)&&this.loadCaps(),e.has("cam")&&this.cam&&this.loadCastTargets()}async loadZones(e=!1){if(this.cam){this.zonesBusy=!0,this.zonesError="";try{this.zones=await ce(this.cam.id,e)}catch(t){this.zonesError=g(t)}finally{this.zonesBusy=!1}}}async loadCaps(e=!1){if(this.cam){this.capsError="";try{this.caps=await pe(this.cam.id,e)}catch(t){this.capsError=g(t)}}}renderCaps(){const e=this.caps;if(this.capsError&&!e)return r`<div class="note" data-caps>יכולות המצלמה לא נקראו מה־NVR: ${this.capsError}</div>`;if(!e)return r`<div class="note" data-caps>קורא יכולות מה־NVR…</div>`;const t=e.ptz.state==="supported"?"live":e.ptz.state==="unsupported"?"neutral":"unknown",s=e.ptz.state==="supported"?`PTZ: נתמך${e.ptz.preset_count!==null?` · ${e.ptz.preset_count} presets`:""}`:e.ptz.state==="unsupported"?"PTZ: לא נתמך במצלמה זו":"PTZ: לא ידוע",a=e.audio.state==="available"?"live":e.audio.state==="disabled"?"stale":e.audio.state==="unsupported"?"neutral":"unknown",i=e.audio.state==="available"?`שמע דו־כיווני: ערוץ פעיל${e.audio.codec?` (${e.audio.codec})`:""}`:e.audio.state==="disabled"?"שמע דו־כיווני: ערוץ קיים אך כבוי במכשיר":e.audio.state==="unsupported"?"שמע דו־כיווני: אין ערוץ למצלמה זו":"שמע דו־כיווני: לא ידוע";return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center" data-caps data-ptz=${e.ptz.state} data-audio=${e.audio.state}>
      <sw-badge kind=${t} label=${s} title=${e.ptz.reason??""}></sw-badge>
      <sw-badge kind=${a} label=${i} title=${e.audio.reason??""}></sw-badge>
      <sw-badge kind="neutral" label="זום דיגיטלי: הגדלה בדפדפן בלבד, לא הנעת מצלמה"></sw-badge>
      ${e.video?.main?r`<sw-badge data-caps-webrtc kind=${e.video.main.webrtc==="ok"?"live":e.video.main.webrtc==="no"?"stale":"unknown"} label=${`זרם ראשי ${e.video.main.codec??"?"}: ${e.video.main.webrtc==="ok"?"מתנגן ב־WebRTC":e.video.main.webrtc==="no"?"לא יתנגן ב־WebRTC":"WebRTC לא ידוע"}`}></sw-badge>`:o}
      ${e.video?.hint?r`<span data-caps-webrtc-hint>${e.video.hint}.</span>`:o}
      <span>${e.ptz.reason?`PTZ לפי המכשיר: ${e.ptz.reason}. `:""}הנעת PTZ, קריאת preset ודיבור הם כתיבה למכשיר ואינם מוצעים בפיילוט ללא אישור מפורש — אין פקד מדומה. נקרא מה־NVR ${e.fetched_at.replace("T"," ").replace("Z"," UTC")}${e.cached?" (מהמטמון)":""}.</span>
    </div>`}startMotionEdit(){const e=this.zones?.motion;!e||!e.rows||!e.cols||(this.motionMsg="",this.motionEdit={cells:e.cells.map(t=>[...t]),sensitivity:e.sensitivity??50,enabled:e.enabled})}paintCell(e,t,s=!1){const a=this.motionEdit;if(!a||(s&&(this.paintValue=!a.cells[e][t]),this.paintValue===null)||a.cells[e][t]===this.paintValue)return;const i=a.cells.map(n=>[...n]);i[e][t]=this.paintValue,this.motionEdit={...a,cells:i}}fillMotion(e){const t=this.motionEdit;t&&(this.motionEdit={...t,cells:t.cells.map(s=>s.map(()=>e))})}motionDiff(){const e=this.zones?.motion,t=this.motionEdit;if(!e||!t)return{added:0,removed:0,sensitivity:!1,enabled:!1};let s=0,a=0;return t.cells.forEach((i,n)=>i.forEach((d,u)=>{const h=e.cells[n]?.[u]??!1;d&&!h&&s++,!d&&h&&a++})),{added:s,removed:a,sensitivity:t.sensitivity!==(e.sensitivity??50),enabled:t.enabled!==e.enabled}}async saveMotion(){const e=this.motionEdit,t=this.cam;if(!e||!t||this.motionBusy)return;const s=this.motionDiff();this.motionBusy=!0;try{const a=await Fe(t.id,{...s.added||s.removed?{cells:e.cells}:{},...s.sensitivity?{sensitivity:e.sensitivity}:{},...s.enabled?{enabled:e.enabled}:{}});this.motionMsg=a.status==="unchanged"?"ה־NVR כבר היה במצב הזה, לא נכתב דבר.":`נכתב ל־NVR (שינוי ${a.id.slice(0,8)}). ניתן להחזיר מהגדרות ‹ חיבורים ‹ שינויים אחרונים.`,this.motionEdit=null,this.motionConfirm=!1,await this.loadZones(!0)}catch(a){this.motionMsg=g(a),this.motionConfirm=!1}finally{this.motionBusy=!1}}renderMotionEditor(e){const t=this.motionEdit,s=this.motionDiff(),a=s.added||s.removed||s.sensitivity||s.enabled,i=t.cells.flat().filter(Boolean).length;return r`<div class="legend" data-motion-editor>
      <span class="note">לחץ או גרור על התמונה כדי לסמן תאים שמזהים תנועה · ${i} מתוך ${e.rows*e.cols} תאים</span>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!0)}>בחר הכל</sw-button>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!1)}>נקה</sw-button>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px">רגישות <input type="range" min=${this.zones?.sensitivity_caps?.min??0} max=${this.zones?.sensitivity_caps?.max??100} step=${this.zones?.sensitivity_caps?.step??20} .value=${String(t.sensitivity)} data-motion-sensitivity @input=${n=>this.motionEdit={...t,sensitivity:Number(n.target.value)}} /> <b class="ltr">${t.sensitivity}</b></label>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" .checked=${t.enabled} data-motion-enabled @change=${n=>this.motionEdit={...t,enabled:n.target.checked}} /> זיהוי תנועה פעיל</label>
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="check" ?disabled=${!a||this.motionBusy} data-motion-save @click=${()=>this.motionConfirm=!0}>שמור ל־NVR</sw-button>
      <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.motionBusy} data-motion-cancel @click=${()=>this.motionEdit=null}>ביטול</sw-button>
      ${this.motionConfirm?r`<sw-dialog open heading="כתיבה ל־NVR: זיהוי תנועה" subheading=${`${this.cam?.name??""} · ערוץ ${this.zones?.channel??""}`} data-motion-confirm @close=${()=>this.motionConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${s.added?`+${s.added} תאים נוספים לזיהוי`:""}${s.added&&s.removed?" · ":""}${s.removed?`−${s.removed} תאים מוסרים`:""}${!s.added&&!s.removed?"הרשת ללא שינוי":""}</div>
              <div>רגישות: ${s.sensitivity?`${e.sensitivity??"—"} → ${t.sensitivity}`:"ללא שינוי"} · זיהוי: ${s.enabled?t.enabled?"כבוי → פעיל":"פעיל → כבוי":"ללא שינוי"}</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה. ההקלטות אינן מושפעות; אזור שלא מסומן לא יפעיל הקלטת תנועה.</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.motionBusy} data-motion-confirm-run @click=${()=>this.saveMotion()}>${this.motionBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.motionConfirm=!1}>ביטול</sw-button></div>
          </sw-dialog>`:o}
    </div>`}renderZones(e){const t=this.zones;if(this.zonesBusy&&!t)return r`<div class="note">קורא את הגדרות הזיהוי מה־NVR…</div>`;if(this.zonesError&&!t)return r`<div class="note">${this.zonesError} <sw-button size="sm" @click=${()=>this.loadZones(!0)}>נסה שוב</sw-button></div>`;if(!t)return r`<div class="note">—</div>`;const s=this.zoneLayers,a=t.motion,i=(d,u)=>d.map(([h,w])=>`${h/u.width*1e3},${w/u.height*1e3}`).join(" "),n=d=>d==="human"?"אדם":d==="vehicle"?"רכב":d;return r`
      <div class="zones" data-zones-loaded>
        <div class="frame">
          <img src=${M(e.id)} alt="" />
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="אזורי זיהוי מעל תמונת המצלמה" style=${this.smartEdit?"cursor:crosshair":""} data-zones-svg @click=${d=>this.smartClick(d)}>
            ${this.motionEdit&&a&&a.rows&&a.cols?this.motionEdit.cells.flatMap((d,u)=>d.map((h,w)=>$`<rect class=${h?"cell":"cell off"} data-motion-cell=${`${u}-${w}`} x=${w*1e3/a.cols} y=${u*1e3/a.rows} width=${1e3/a.cols} height=${1e3/a.rows} style="cursor:crosshair;${h?"":"fill:color-mix(in srgb, var(--sw-on-video) 3%, transparent);stroke:var(--sw-video-line)"}" @pointerdown=${R=>{R.preventDefault(),this.paintCell(u,w,!0)}} @pointerenter=${R=>{R.buttons&1&&this.paintCell(u,w)}} @pointerup=${()=>this.paintValue=null}></rect>`)):o}
            ${!this.motionEdit&&s.motion&&a&&a.rows&&a.cols?a.cells.flatMap((d,u)=>d.map((h,w)=>h?$`<rect x=${w*1e3/a.cols} y=${u*1e3/a.rows} width=${1e3/a.cols} height=${1e3/a.rows} class="cell"></rect>`:o)):o}
            ${s.privacy&&t.privacy_mask?t.privacy_mask.regions.map(d=>$`<polygon points=${i(d.points,t.privacy_mask.normalized)} class="mask"></polygon>`):o}
            ${s.intrusion&&t.intrusion&&!this.smartEdit?t.intrusion.regions.map(d=>$`<polygon points=${i(d.points,t.intrusion.normalized)} class="field"></polygon>`):o}
            ${s.lines&&t.line_crossing&&!this.smartEdit?t.line_crossing.lines.map(d=>$`<polyline points=${i(d.points,t.line_crossing.normalized)} class="line ${d.enabled?"":"off"}"></polyline>`):o}
            ${this.renderSmartOverlay()}
          </svg>
        </div>
        <div class="legend">
          <sw-chip data-zone-layer="motion" ?selected=${s.motion} @click=${()=>this.zoneLayers={...s,motion:!s.motion}}>תנועה${a?` · ${a.enabled?"פעיל":"כבוי"} · ${a.coverage_pct}% מהתמונה · רגישות ${a.sensitivity??"?"}${a.target_types.length?` · ${a.target_types.map(n).join("/")}`:""}`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="privacy" ?selected=${s.privacy} @click=${()=>this.zoneLayers={...s,privacy:!s.privacy}}>מסכת פרטיות${t.privacy_mask?` · ${t.privacy_mask.enabled?"פעילה":"כבויה"} · ${t.privacy_mask.regions.length} אזורים`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="intrusion" ?selected=${s.intrusion} @click=${()=>this.zoneLayers={...s,intrusion:!s.intrusion}}>חדירה לאזור${t.intrusion?` · ${t.intrusion.enabled?"פעיל":"כבוי"} · ${t.intrusion.regions.length} אזורים`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="lines" ?selected=${s.lines} @click=${()=>this.zoneLayers={...s,lines:!s.lines}}>חציית קו${t.line_crossing?` · ${t.line_crossing.enabled?"פעיל":"כבוי"} · ${t.line_crossing.lines.length} קווים`:" · לא נקרא"}</sw-chip>
          <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.zonesBusy} @click=${()=>this.loadZones(!0)}>רענון מה־NVR</sw-button>
          ${t.can_edit_motion&&a&&a.rows&&a.cols&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-motion-edit @click=${()=>this.startMotionEdit()}>עריכת אזורי תנועה</sw-button>`:o}
          ${this.smart?.can_write&&(this.smart.line||this.smart.field)&&!this.smartEdit&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-smart-edit @click=${()=>this.startSmartEdit()}>עריכת כללים חכמים</sw-button>`:o}
        </div>
        ${this.motionEdit&&a?this.renderMotionEditor(a):o}
        ${this.smartEdit?this.renderSmartEditor():o}
        ${this.smartMsg?r`<div class="note" data-smart-msg>${this.smartMsg}</div>`:o}
        ${this.motionMsg?r`<div class="note" data-motion-msg>${this.motionMsg}</div>`:o}
        ${Object.keys(t.unsupported).length?r`<div class="note">לא נקרא מהמכשיר: ${Object.entries(t.unsupported).map(([d,u])=>`${d} (${u})`).join(", ")}</div>`:o}
        <div class="note" data-zones-note>קריאה בלבד מה־NVR (נקרא ${t.fetched_at.replace("T"," ").replace("Z"," UTC")}${t.cached?", מהמטמון":""}). אלו פוליגונים בתמונת המצלמה — לא חדרים במפה. שכבת־על בדפדפן אינה מסכת NVR ואינה מגינה על הקלטות; עריכה או מסכה אמיתית דורשות אישור מפורש, כתיבה מאומתת ובדיקת התוצאה בזרם.</div>
      </div>`}async load(){this.loading=!0,this.error="";try{if(x()){const[e,t]=await Promise.all([he(),ue()]);this.cams=e.cameras,this.cam=e.cameras.find(a=>a.id===this.cameraId)??null,this.canConfigure=e.can_sync,this.settings=t,this.transport=A(t);const s=me();s&&(this.profile=s.defaultProfile)}}catch(e){this.error=g(e)}finally{this.loading=!1}}setTransport(e){const t=B()?.installation??this.settings?.["media.transport_default"]??L;this.transport=e,fe(e===t?null:e).then(s=>{s&&(this.transport=s.choice)}).catch(()=>this.transport=A(this.settings))}onPlayer(e){this.playerStatus=e.detail.status,this.playerTransport=e.detail.transport??""}renderApi(){const e=this.cam;if(this.loading)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(this.error)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!e)return r`<sw-state-panel state="forbidden" heading="המצלמה לא זמינה" hint="המצלמה לא נמצאה או שאין לך הרשאת צפייה בה."></sw-state-panel>`;const t=e.can_view_live!==!1&&e.status!=="offline",s=M(e.id,this.posterBust),a=e.stream,i=be(this.transport),n=ve(this.profile,e.encoding,this.transport);return r`
      <div class="video ${t?"":"off"}">
        ${t&&e.live_kind==="still"?r`<sw-camera-tile data-live-still name=${e.name} state="live" cameraId=${e.id} poster=${M(e.id)} .stillRefresh=${e.still_refresh_s??10} noDemo></sw-camera-tile>`:t?r`<sw-live-player .cameraId=${e.id} .profile=${this.profile} .mode=${this.transport} .plan=${n.plan} .preferred=${n.preferred} .gop=${n.gop} .encoding=${e.encoding??null} .poster=${s} @player-status=${this.onPlayer}></sw-live-player>`:r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span data-camera-off-reason>${e.recorder_enabled===!1?"ה־NVR של המצלמה מושבת":e.status==="offline"?"המצלמה מנותקת מה־NVR (לפי הסנכרון האחרון)":"אין הרשאת צפייה חיה במצלמה זו"}</span></div></div>`}
      </div>
      ${t&&e.live_kind==="still"?r`<div class="note" data-live-still-note>${Ge().live.stillExplain.replace("{n}",String(e.still_refresh_s??10))}</div>`:o}
      <div class="controls" data-player=${this.playerStatus==="playing"?"playing":this.playerStatus==="error"?"error":"connecting"}>
        <div class="round" role="group" aria-label="פקדי מצלמה">
          <button title="רענון תמונה" aria-label="רענון תמונה" @click=${()=>this.posterBust=Date.now()}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${this.playerStatus!=="playing"} @click=${()=>this.player?.fullscreen()}><sw-icon name="expand" size=${16}></sw-icon></button>
          ${this.castShown?r`<button type="button" data-cast-button title=${m("cast.button")} aria-label=${m("cast.button")} aria-haspopup="dialog" aria-expanded=${this.castOpen?"true":"false"} @click=${()=>this.castOpen=!this.castOpen}><sw-icon name="cast" size=${16}></sw-icon></button>`:o}
          <button title="התחבר מחדש" aria-label="התחבר מחדש" @click=${()=>this.player?.reconnect()}><sw-icon name="refresh" size=${16}></sw-icon></button>
          <button class="q ${this.profile==="main"?"on":""}" @click=${()=>this.profile="main"}>ראשי</button>
          <button class="q ${this.profile==="sub"?"on":""}" @click=${()=>this.profile="sub"}>משני</button>
          <div class="transport" role="group" aria-label="תעבורה" data-transport-choice=${this.transport}>
            ${["auto","webrtc","mse"].map(d=>r`<button class=${this.transport===d?"on":""} aria-pressed=${String(this.transport===d)} @click=${()=>this.setTransport(d)}>${d==="auto"?"אוטומטי":d==="webrtc"?"WebRTC":"MSE"}</button>`)}
          </div>
          ${B()?.source==="personal"?r`<span class="note" data-transport-own>ברירת המחדל של המערכת: ${we(B()?.installation??this.settings?.["media.transport_default"]??L)}</span>`:o}
          ${i&&this.settings?.["media.video_notices"]==="true"?r`<span class="note" data-remote-video-policy>גישה מרחוק: ${this.transport==="mse"?"MSE בלבד":this.transport==="webrtc"?"WebRTC בלבד · בלי MSE":`WebRTC תחילה${i.mseFallback?" · MSE רק כמוצא אחרון":" · בלי MSE"}`}</span>`:o}
        </div>
        ${this.playerStatus==="playing"&&this.settings?.["media.video_notices"]!=="true"?o:r`<div class="note">${this.playerStatus==="playing"?`מנגן דרך ${this.playerTransport==="webrtc"?"WebRTC":"MSE"}`:this.playerStatus==="error"?"הזרם לא זמין":"מתחבר…"}</div>`}
      </div>
      ${this.renderCast(e)}
      <frigate-camera-control camera-id=${e.id} recorder-id=${e.recorder_id} data-live-frigate-control></frigate-camera-control>
      ${this.renderSettingsAccordion(e,a)}
    `}renderCast(e){if(this.castWatch,!this.castShown&&!T.open().some(a=>a.mine&&a.camera_id===e.id))return o;const t=T.now,s=T.open().filter(a=>a.mine&&a.camera_id===e.id);return r`
      ${s.map(a=>r`<div class="cast-status" data-cast-status data-cast-status-state=${a.state} role="status">
        <sw-icon name="cast" size=${15}></sw-icon>
        <span class="who">${a.state==="not_confirmed"?m("cast.notConfirmed"):a.state==="starting"?`${m("cast.starting2")} · ${a.screen_name}`:`${m("cast.playing")}: ${a.screen_name}`}</span>
        ${a.state==="playing"?r`<span class=${ge(a,t)?"low":""} data-cast-status-left>${ye(a,t)}</span>`:o}
        <sw-cast-stop .session=${a} @cast-stopped=${()=>this.flashCast(m("cast.stopped"))}></sw-cast-stop>
      </div>`)}
      ${this.castNote?r`<div class="note" data-cast-note role="status">${this.castNote}</div>`:o}
      <sw-cast-picker .open=${this.castOpen} .cameraId=${e.id} .cameraName=${e.alias||e.name} .anchor=${this.castBtn??null} .profile=${this.profile}
        .phone=${$e()} .ddPhone=${document.documentElement.getAttribute("data-dd-phone")??""} ?remote=${xe()}
        @close=${()=>this.castOpen=!1} @cast-started=${()=>this.flashCast(m("cast.started"))}></sw-cast-picker>`}flashCast(e){this.castNote=e,window.clearTimeout(this.castNoteTimer),this.castNoteTimer=window.setTimeout(()=>this.castNote="",4e3)}async loadCastTargets(){if(!this.cam||!x()||!ke("media.cast")){this.castShown=!1;return}try{const e=await K(this.cam.id);this.castShown=ze({api:!0,hasCast:!0,targets:e.targets.length,ready:e.ready})}catch{this.castShown=!1}}renderSettingsAccordion(e,t){const s=this.renderCaps(),a=this.renderRecord(),i=this.renderOsd(),n=this.renderReboot();return r`<details class="acc-root" data-camera-settings>
      <summary><sw-icon class="chev" name="chevron" size=${16}></sw-icon>הגדרות מצלמה</summary>
      <div class="acc-body">
        ${a!==o?r`<details class="acc" data-acc-record ?open=${!!this.rec?.active}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>הקלטה ידנית</span>${this.rec?.active?r`<sw-badge kind="live" label="פעילה"></sw-badge>`:o}</summary>
              <div class="acc-content">${a}</div>
            </details>`:o}
        <details class="acc" data-acc-details>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>פרטים</span></summary>
          <div class="acc-content">
            <dl>
              <dt>מצב</dt><dd><sw-badge kind=${e.status==="online"?"live":e.status==="offline"?"offline":"unknown"}></sw-badge></dd>
              <dt>ערוץ</dt><dd>${e.channel} · <span class="ltr">track ${e.main_track??"?"}</span></dd>
              <dt>שם ב־NVR</dt><dd>${e.name_source||"—"}</dd>
              <dt>זרם ראשי</dt><dd>${t?`${t.resolution??""} · ${t.fps??"?"} fps · ${t.bitrate_kbps??"?"} kbps`:"לא נבדק"}</dd>
              <dt>זמן מקור</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
              <dt>נראתה לאחרונה</dt><dd>${e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</dd>
            </dl>
            ${s}
          </div>
        </details>
        ${i!==o?r`<details class="acc" data-acc-osd>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>OSD — כיתוב על התמונה</span></summary>
              <div class="acc-content">${i}</div>
            </details>`:o}
        <details class="acc" data-acc-schedules>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>לוחות זימון והקלטה — כפי שמוגדר ב־NVR</span></summary>
          <div class="acc-content">
            <div class="note">מתי כל זיהוי פעיל ומתי הערוץ מקליט (רציף / תנועה / אירוע) · עריכה דורשת הרשאה רגישה ונרשמת עם החזר</div>
            ${this.renderSchedules()}
          </div>
        </details>
        <details class="acc" data-acc-zones>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>אזורי זיהוי ומסכות — כפי שמוגדר ב־NVR</span></summary>
          <div class="acc-content">${this.renderZones(e)}</div>
        </details>
        ${n!==o?r`<details class="acc" data-acc-reboot ?open=${this.rebootOpen||!!this.rebootMsg}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${f("section")}</span></summary>
              <div class="acc-content">${n}</div>
            </details>`:o}
        <details class="acc" data-acc-more>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>מצלמות נוספות</span></summary>
          <div class="acc-content tiles">
            ${this.cams.filter(d=>d.id!==e.id).slice(0,4).map(d=>r`<sw-camera-tile compact name=${d.name} state=${d.status==="online"?"live":d.status==="offline"?"offline":"unknown"} poster=${d.status==="offline"?"":M(d.id)} @click=${()=>D(`/live/cameras/${d.id}`)}></sw-camera-tile>`)}
          </div>
        </details>
      </div>
    </details>`}renderDemo(){const e=E.find(a=>a.id===this.cameraId)??E[0],t=e.state==="live"||e.state==="stale",s=W[e.id]??"lobby";return r`
      <div class="video ${t?s:"off"}">
        ${t?r`<sw-scene kind=${s}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>
              <span class="stamp">2026-09-14 10:24:36</span>
              <span class="quality">${this.profile==="main"?"1440p · H.265":"360p · H.264"}</span>`:r`<div class="center"><div>
              <sw-icon name=${e.state==="offline"?"offline":"lock"} size=${32}></sw-icon>
              <span>${e.state==="offline"?"המצלמה אינה מחוברת ל־NVR":"אין הרשאת צפייה במצלמה זו"}</span>
            </div></div>`}
      </div>
      <div class="controls" data-player=${t?"playing":"error"}>
        <div class="round" role="group" aria-label="פקדי מצלמה">
          ${e.audio?r`<button title="מיקרופון" aria-label="מיקרופון" ?disabled=${!t}><sw-icon name="mic" size=${16}></sw-icon></button><button title="שמע" aria-label="שמע" ?disabled=${!t}><sw-icon name="volume" size=${16}></sw-icon></button>`:o}
          <button title="צילום מסך" aria-label="צילום מסך" ?disabled=${!t}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${!t}><sw-icon name="expand" size=${16}></sw-icon></button>
          <button class="q ${this.profile==="main"?"on":""}" @click=${()=>this.profile="main"}>1440p</button>
          <button class="q ${this.profile==="sub"?"on":""}" @click=${()=>this.profile="sub"}>360p</button>
        </div>
        ${e.ptz?r`<div class="ptz" role="group" aria-label="בקרת PTZ">
              <div class="joy">
                <button class="u" aria-label="למעלה"><sw-icon name="chevronDown" size=${14} style="transform:rotate(180deg)"></sw-icon></button>
                <button class="d" aria-label="למטה"><sw-icon name="chevronDown" size=${14}></sw-icon></button>
                <button class="l" aria-label="שמאלה"><sw-icon name="chevron" size=${14} flip></sw-icon></button>
                <button class="r" aria-label="ימינה"><sw-icon name="chevron" size=${14}></sw-icon></button>
                <span class="c" aria-hidden="true"></span>
              </div>
              <div class="zoom"><button aria-label="זום פנימה"><sw-icon name="plus" size=${14}></sw-icon></button><button aria-label="זום החוצה"><sw-icon name="minus" size=${14}></sw-icon></button></div>
            </div>`:o}
      </div>
      ${e.ptz?r`<div class="modes">
            <sw-chip icon="bookmark" ?selected=${this.ptzMode==="presets"} @click=${()=>this.ptzMode="presets"}>Presets</sw-chip>
            <sw-chip icon="target" ?selected=${this.ptzMode==="track"} @click=${()=>this.ptzMode="track"}>מעקב אוטומטי</sw-chip>
            <sw-chip icon="route" ?selected=${this.ptzMode==="patrol"} @click=${()=>this.ptzMode="patrol"}>סיור</sw-chip>
          </div>`:r`<div class="note" style="margin-block-start:8px">PTZ ושמע אינם מוצגים במצלמה זו: היכולת לא אומתה. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>`}
      <div class="grid">
        <sw-card heading="פרטים">
          <dl>
            <dt>מצב</dt><dd><sw-badge kind=${e.state}></sw-badge></dd>
            <dt>הקלטה</dt><dd>${{continuous:"רציפה",motion:"לפי תנועה",off:"כבויה",unknown:"לא ידוע"}[e.recording]}</dd>
            <dt>זרם</dt><dd>${e.fps?`${e.fps} fps · ${e.bitrateKbps} kbps`:"—"}</dd>
            <dt>קושחה</dt><dd><span class="ltr">${e.firmware}</span></dd>
            <dt>אירוע אחרון</dt><dd>${e.lastEvent}</dd>
          </dl>
        </sw-card>
        <sw-card heading="מצלמות באותה קומה">
          <div class="tiles">
            ${E.filter(a=>a.floor===e.floor&&a.id!==e.id).slice(0,4).map(a=>r`<sw-camera-tile compact name=${a.name} state=${a.state} scene=${W[a.id]??"lobby"} @click=${()=>D(`/live/cameras/${a.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    `}render(){const e=x(),t=e?this.cam?.name??"מצלמה":(E.find(a=>a.id===this.cameraId)??E[0]).name,s=e?this.cam?`ערוץ ${this.cam.channel} · ${this.cam.name_source||""}`:"":`${(E.find(a=>a.id===this.cameraId)??E[0]).floor} · נתוני הדגמה`;return r`
      <sw-page heading=${t} subheading=${s} crumbs="מצלמות | שידור חי" backHref="/live/wall">
        ${this.cam?r`<sw-badge slot="actions" kind=${this.cam.status==="online"?"live":this.cam.status==="offline"?"offline":"unknown"}></sw-badge>`:o}
        ${e&&this.cam&&this.canConfigure?r`<sw-button slot="actions" variant="ghost" icon="edit" data-camera-rename @click=${()=>{this.renameMsg="",this.renameTo=this.cam?.alias??this.cam?.name??""}}>שנה שם</sw-button>`:o}
        ${this.renderRename()}
        <a slot="actions" href=${e&&this.cam?`#/investigate/playback?camera=${this.cam.id}`:"#/investigate/playback"}><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label="במפה"></sw-button></a>
        ${e&&this.cam&&He()?r`<sw-button slot="actions" variant="ghost" icon="plus" data-camera-ticket @click=${()=>this.mapTicket=!0}>${Ue()}</sw-button>`:o}
        ${this.mapTicket&&this.cam?r`<ticket-map-create open .element=${{pick:{resource:{type:"camera",id:this.cam.id}},name:this.cam.alias||this.cam.name,floorName:""}} @close=${()=>this.mapTicket=!1}></ticket-map-create>`:o}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};c.styles=[O`
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
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-video-bg);
      color: var(--sw-on-video);
      box-shadow: var(--sw-shadow-2);
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    .video.off .center sw-icon {
      color: var(--sw-offline);
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
      font-size: var(--sw-fs-xs);
      direction: ltr;
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px var(--sw-video-scrim);
    }
    .quality {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 10px;
      font-size: var(--sw-fs-xs);
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
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    .round {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .round button {
      inline-size: 38px;
      block-size: 38px;
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
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
      padding-inline: 10px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      block-size: 30px;
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
      block-size: 26px;
      border: 0;
      background: transparent;
      box-shadow: none;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      padding: 0 9px;
      border-radius: var(--sw-r-xs);
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
      gap: 12px;
      margin-block-start: 12px;
      align-items: start;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    /* settings accordion (owner round 4, 2.6): the video keeps its place, everything below starts collapsed
       under one "camera settings" toggle, and each setting inside is its own collapsed row. */
    .acc-root {
      margin-block-start: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    .acc-root > summary {
      padding: 12px 14px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
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
      padding: 10px 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-xl);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
    }
    .round {
      gap: 10px;
    }
    .round button {
      inline-size: 42px;
      block-size: 42px;
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
      block-size: 36px;
      padding-inline: 14px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .round .q.on,
    .round .q.on:hover {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-primary);
    }
    .round .transport button {
      block-size: 30px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
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
    .round .transport {
      background: color-mix(in srgb, var(--sw-heading) 6%, var(--sw-surface));
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
  `,_e];p([y()],c.prototype,"cameraId",2);p([l()],c.prototype,"mapTicket",2);p([l()],c.prototype,"cam",2);p([l()],c.prototype,"zones",2);p([l()],c.prototype,"zonesBusy",2);p([l()],c.prototype,"zonesError",2);p([l()],c.prototype,"motionEdit",2);p([l()],c.prototype,"motionConfirm",2);p([l()],c.prototype,"motionBusy",2);p([l()],c.prototype,"motionMsg",2);p([l()],c.prototype,"rec",2);p([l()],c.prototype,"osd",2);p([l()],c.prototype,"sched",2);p([l()],c.prototype,"schedError",2);p([l()],c.prototype,"schedTab",2);p([l()],c.prototype,"schedEdit",2);p([l()],c.prototype,"schedBusy",2);p([l()],c.prototype,"schedMsg",2);p([l()],c.prototype,"schedConfirm",2);p([l()],c.prototype,"smart",2);p([l()],c.prototype,"smartEdit",2);p([l()],c.prototype,"smartBusy",2);p([l()],c.prototype,"smartMsg",2);p([l()],c.prototype,"osdMsg",2);p([l()],c.prototype,"renameTo",2);p([l()],c.prototype,"renameBusy",2);p([l()],c.prototype,"renameMsg",2);p([l()],c.prototype,"osdBusy",2);p([l()],c.prototype,"recMinutes",2);p([l()],c.prototype,"recBusy",2);p([l()],c.prototype,"recMsg",2);p([l()],c.prototype,"reboot",2);p([l()],c.prototype,"rebootOpen",2);p([l()],c.prototype,"rebootBusy",2);p([l()],c.prototype,"rebootMsg",2);p([l()],c.prototype,"zoneLayers",2);p([l()],c.prototype,"caps",2);p([l()],c.prototype,"capsError",2);p([l()],c.prototype,"cams",2);p([l()],c.prototype,"canConfigure",2);p([l()],c.prototype,"settings",2);p([l()],c.prototype,"error",2);p([l()],c.prototype,"loading",2);p([l()],c.prototype,"profile",2);p([l()],c.prototype,"transport",2);p([l()],c.prototype,"playerStatus",2);p([l()],c.prototype,"playerTransport",2);p([l()],c.prototype,"posterBust",2);p([l()],c.prototype,"ptzMode",2);p([F("sw-live-player")],c.prototype,"player",2);p([l()],c.prototype,"castShown",2);p([l()],c.prototype,"castOpen",2);p([l()],c.prototype,"castNote",2);p([F("[data-cast-button]")],c.prototype,"castBtn",2);c=p([q("live-camera")],c);export{c as LiveCamera};
//# sourceMappingURL=live-camera-DDb4yiuh.js.map
