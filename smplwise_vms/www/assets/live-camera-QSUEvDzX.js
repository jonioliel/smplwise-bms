import{E as B,F as g,G as l,a as N,i as x,i3 as z,R as w,A as n,e as r,H as O,pR as D,pS as W,pT as L,pU as V,pV as C,pW as q,pX as K,pY as F,pZ as H,p_ as U,p$ as X,q0 as Y,j as J,dQ as m,q1 as G,q2 as T,av as Q,q3 as ee,q4 as se,q5 as te,S as ae,q6 as P,w as $,pP as ie,n as re,q7 as oe,q8 as ne,dX as R,px as le,J as de,O as ce,pO as pe,q9 as he,qa as I,qb as ue,qc as me,qd as fe,qe as be,qf as ve,qg as we,qh as ge,hO as $e,l as ye,qi as xe,aj as j,pE as E,dW as A,C as ke,bp as Z}from"./index-DmgaojPZ.js";import{f as ze,g as Ee,a as _e,s as Ce,b as Re,n as Me,c as Te,d as M,e as Se}from"./frigate-control-DmaJE4sU.js";import"./sw-chip-9iGUQ_k2.js";import{c as Be,a as Ne,s as Oe,b as Ve,d as qe,o as Pe,w as Ie,e as S,r as je,f as Ae,g as De,h as Le}from"./nvr-DmnugkdR.js";import"./sw-week-grid-CAedkP5U.js";import{m as Ze,a as We}from"./map-create-AITz0yvW.js";import{f as Ke}from"./frigate-text-DyEPnL8H.js";import"./sw-logo-art-Va6y_cIM.js";var Fe=Object.defineProperty,He=Object.getOwnPropertyDescriptor,k=(e,s,t,a)=>{for(var i=a>1?void 0:a?He(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&Fe(s,t,i),i};let y=class extends N{constructor(){super(...arguments),this.cameraId="",this.recorderId="",this.data=null,this.profiles=null,this.pending=null,this.busy=!1,this.msg=null,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load()}async load(){const e=++this.seq;if(this.data=null,this.profiles=null,!(!x()||!this.cameraId||!this.recorderId)&&!(!(await ze()).has(this.recorderId)||e!==this.seq)){try{const s=await Ee(this.recorderId,this.cameraId);if(e!==this.seq)return;this.data=s.writable.analytics||s.writable.record?s:null}catch{this.data=null;return}try{const s=await _e(this.recorderId);e===this.seq&&s.can_switch&&s.names.length&&(this.profiles=s)}catch{}}}flash(e,s){this.msg={tone:e,text:s},window.setTimeout(()=>{this.msg?.text===s&&(this.msg=null)},3500)}ask(e){this.pending=e}cancel(){this.pending?.undo?.(),this.pending=null}async apply(e,s){if(!(!this.data&&!this.profiles)){this.busy=!0;try{if(e.group==="profile"){const t=await Ce(this.recorderId,e.to||null,s);this.profiles&&(this.profiles={...this.profiles,active:t.active})}else{const t=await Re(this.recorderId,this.cameraId,e.feature,e.to,s);if(this.data){const a=i=>i.feature===e.feature?{...i,value:e.to}:i;this.data={...this.data,features:this.data.features.map(a),named:this.data.named?.map(a)}}t.verified?this.flash("ok",z.frigate.control.saved):this.flash("ok",z.frigate.control.unverified)}e.group==="profile"&&this.flash("ok",z.frigate.control.saved)}catch(t){e.undo?.(),this.flash("err",`${z.frigate.control.failed}: ${w(t)}`),this.load()}finally{this.busy=!1,this.pending=null}}}onSwitch(e,s,t){const a=t.currentTarget,i=a.checked,o={group:e,feature:s,to:i,undo:()=>a.checked=!i};Me(e)?this.ask(o):this.apply(o,!1)}group(e,s,t){const a=this.data,i=Te(a,e);return!t||!i.length?n:r`<div data-fcc-group=${e}>
      <h4>${s}</h4>
      <div class="grid">
        ${i.map(o=>r`<div class="row" data-fcc-row=${o.feature}>
          <span>${M(o.feature)}</span>
          <sw-toggle .checked=${o.value===!0} ?disabled=${this.busy} labelHidden label=${M(o.feature)} data-fcc-switch=${o.feature} @change=${d=>this.onSwitch(e,o.feature,d)}></sw-toggle>
        </div>`)}
      </div>
    </div>`}named(){const e=this.data,s=(e.named??[]).filter(a=>a.value!==null);if(!e.writable.analytics||!s.length)return n;const t=z.frigate.control;return r`<div data-fcc-group="named">
      <h4>${t.named}</h4>
      <div class="grid">
        ${s.map(a=>r`<div class="row" data-fcc-row=${a.feature}>
          <span><bdi>${M(a.feature)}</bdi></span>
          <sw-toggle .checked=${a.value===!0} ?disabled=${this.busy} labelHidden label=${M(a.feature)} data-fcc-switch=${a.feature} @change=${i=>this.onSwitch("analytics",a.feature,i)}></sw-toggle>
        </div>`)}
      </div>
    </div>`}dialog(){const e=this.pending;if(!e)return n;const s=z.frigate.control,t=e.group==="profile"?{title:`${s.profile}: ${e.to||s.noProfile}`,text:s.confirmProfile}:Se(e.group,e.feature,e.to);return r`<sw-dialog open heading=${t.title} data-fcc-confirm @close=${()=>this.cancel()}>
      ${t.text?r`<p class="dialog-text">${t.text}</p>`:n}
      <sw-button slot="footer" data-fcc-cancel @click=${()=>this.cancel()}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcc-ok ?disabled=${this.busy} @click=${()=>void this.apply(e,!0)}>${s.confirm}</sw-button>
    </sw-dialog>`}render(){const e=this.data;if(!e&&!this.profiles)return n;const s=z.frigate.control,t=this.profiles;return r`<div class="box" data-frigate-camera-control>
      ${e?this.group("analytics",s.analytics,e.writable.analytics):n}
      ${e?this.named():n}
      ${e?this.group("record",s.record,e.writable.record):n}
      ${t?r`<div class="row" data-fcc-profile>
        <h4>${s.profile}</h4>
        <select aria-label=${s.profile} .value=${t.active??""} ?disabled=${this.busy} @change=${a=>{const i=a.currentTarget,o=t.active??"";this.ask({group:"profile",feature:"profile",to:i.value||null,undo:()=>i.value=o})}}>
          <option value="">${s.noProfile}</option>
          ${t.names.map(a=>r`<option value=${a} ?selected=${a===t.active}>${a}</option>`)}
        </select>
      </div>`:n}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcc-msg>${this.msg.text}</div>`:n}
      ${this.dialog()}
    </div>`}};y.styles=B`
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
  `;k([g({attribute:"camera-id"})],y.prototype,"cameraId",2);k([g({attribute:"recorder-id"})],y.prototype,"recorderId",2);k([l()],y.prototype,"data",2);k([l()],y.prototype,"profiles",2);k([l()],y.prototype,"pending",2);k([l()],y.prototype,"busy",2);k([l()],y.prototype,"msg",2);y=k([O("frigate-camera-control")],y);var Ue=Object.defineProperty,Xe=Object.getOwnPropertyDescriptor,b=(e,s,t,a)=>{for(var i=a>1?void 0:a?Xe(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&Ue(s,t,i),i};const Ye={confirmed:T.confirmed,likely:T.likely,unknown:T.unknown,manual:"נקבע ידנית"};let f=class extends N{constructor(){super(...arguments),this.open=!1,this.cameraId="",this.cameraName="",this.anchor=null,this.profile="sub",this.phone=!1,this.ddPhone="",this.remote=!1,this.data=null,this.loading=!1,this.error="",this.busyKey="",this.confirm=null,this.quality="sub",this.watch=new D(this),this.onKey=e=>{e.key==="Escape"&&this.open&&this.close()},this.onDoc=e=>{if(!this.open||this.mode()==="sheet")return;const s=e.composedPath();s.includes(this)||this.anchor&&s.includes(this.anchor)||this.close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.onKey),document.addEventListener("pointerdown",this.onDoc,!0)}disconnectedCallback(){document.removeEventListener("keydown",this.onKey),document.removeEventListener("pointerdown",this.onDoc,!0),super.disconnectedCallback()}willUpdate(e){e.has("open")&&this.open&&(this.error="",this.confirm=null,this.quality=this.profile==="main"?"main":"sub",this.load())}updated(e){this.open&&this.mode()==="pop"&&(e.has("open")||e.has("data"))&&this.place()}mode(){const e=W({phone:this.phone,ddPhone:this.ddPhone});return e==="panel"?"pop":e}async load(){this.loading=!0;try{this.data=await L(this.cameraId||void 0)}catch(e){this.data=null,this.error=w(e)}finally{this.loading=!1}}place(){const e=this.renderRoot.querySelector(".panel.pop"),s=this.anchor;if(!e||!s)return;const t=s.getBoundingClientRect(),a=e.offsetHeight,i=e.offsetWidth,d=t.top-8-a>=8?t.top-8-a:Math.min(window.innerHeight-a-8,t.bottom+8);let h=getComputedStyle(this).direction==="rtl"?t.right-i:t.left;h=Math.max(8,Math.min(window.innerWidth-i-8,h)),e.style.top=`${Math.max(8,d)}px`,e.style.left=`${h}px`}close(){this.confirm=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}mineOn(e){const s=V(C.sessions,e);return s&&s.mine?s:null}async pick(e,s=!1,t=!1){if(!q(e)||this.busyKey||!this.cameraId)return;if(K(e)&&!t){this.confirm={target:e,permanent:s};return}this.confirm=null,this.busyKey=e.key,this.error="";const a=this.quality==="main"&&e.main_allowed?"main":"sub";try{const i=this.mineOn(e.key),o=i&&i.can.switch&&!s&&i.camera_id!==this.cameraId?await F(i.session_id,{camera_id:this.cameraId,profile:a}):await H({target_key:e.key,camera_id:this.cameraId,profile:a,duration:s?"permanent":"default",client_request_id:U(),confirmed:t||void 0});if(C.put(o.session),o.status==="refused"){this.error=X(o.error),this.dispatchEvent(new CustomEvent("cast-error",{detail:{message:this.error},bubbles:!0,composed:!0}));return}Y(e.key),this.dispatchEvent(new CustomEvent("cast-started",{detail:{session:o.session},bubbles:!0,composed:!0})),this.close()}catch(i){i instanceof J&&i.body.code==="cast_busy"&&!t?this.confirm={target:e,permanent:s}:(this.error=w(i),this.dispatchEvent(new CustomEvent("cast-error",{detail:{message:this.error},bubbles:!0,composed:!0})),this.load())}finally{this.busyKey=""}}row(e){const s=this.mineOn(e.key),t=!!s&&s.camera_id===this.cameraId,a=!q(e)||t,i=V(C.sessions,e.key),o=t?`${m("cast.stateCasting")}: ${this.cameraName||s?.camera_name||""}`:G(e,i),d=[e.area_name].filter(Boolean).join(" · "),u=e.confidence&&!e.blocked?Ye[e.confidence]:"";return r`<div class="row-wrap" data-cast-target=${e.key}>
      <button type="button" class=${`row ${e.state==="casting"?"casting":""}`} aria-disabled=${a?"true":"false"} data-cast-state=${e.state} data-cast-blocked=${e.blocked??""}
        @click=${()=>a?void 0:void this.pick(e)}>
        <span class="ic"><sw-icon name=${e.blocked?"lock":"media"} size=${18}></sw-icon></span>
        <span class="tx"><span class="nm">${e.name}</span><span class=${`ln ${e.state==="playing_music"?"warn":""}`}>${d?`${d} · `:""}${this.busyKey===e.key?m("cast.starting"):o}</span></span>
        ${u?r`<sw-badge kind=${e.confidence==="confirmed"?"live":"neutral"} label=${u}></sw-badge>`:n}
      </button>
      ${e.permanent_allowed&&!a?r`<button type="button" class="perm" data-cast-permanent title=${m("cast.durationPermanent")} aria-label=${`${m("cast.durationPermanent")}: ${e.name}`} @click=${()=>void this.pick(e,!0)}>${m("cast.pillPermanent")}</button>`:n}
      ${t&&s?r`<sw-cast-stop .session=${s} variant="ghost"></sw-cast-stop>`:n}
    </div>`}body(){const e=this.data,s=Q("system.configure");if(this.loading&&!e)return r`<div class="state" role="status" data-cast-loading>${m("cast.loading")}</div>`;if(!e)return this.error?r`<div class="err" role="alert" data-cast-error>${this.error}</div>`:r`${n}`;if(!e.ready)return r`<div class="state" role="status" data-cast-notready>${ee(e.reason,s)}</div>`;const t=se(e.targets,te()),a=e.main_possible;return r`
      <div class="opts" data-cast-quality>
        <span>${m("camera.quality")}</span>
        <div class="seg" role="group" aria-label=${m("camera.quality")}>
          <button type="button" aria-pressed=${this.quality==="sub"} data-cast-q="sub" @click=${()=>this.quality="sub"}>${m("cast.profileSub")}</button>
          <button type="button" aria-pressed=${this.quality==="main"} data-cast-q="main" ?disabled=${!a} title=${a?"":m("cast.profileMainNo")} @click=${()=>this.quality="main"}>${m("cast.profileMain")}</button>
        </div>
      </div>
      ${this.error?r`<div class="err" role="alert" data-cast-error>${this.error}</div>`:n}
      ${this.confirm?r`<div class="ask" role="alertdialog" aria-label=${m("cast.confirmBusy")} data-cast-confirm>
            <span>${this.confirm.target.name}: ${m("cast.confirmBusy")}</span>
            <div class="btns"><button type="button" class="yes" data-cast-confirm-yes @click=${()=>void this.pick(this.confirm.target,this.confirm.permanent,!0)}>${m("cast.confirmBusyYes")}</button>
              <button type="button" class="no" data-cast-confirm-no @click=${()=>this.confirm=null}>${m("actions.cancel")}</button></div>
          </div>`:n}
      <div class="body" data-cast-list>
        ${t.length?t.map(i=>r`<div class="grp" data-cast-group=${i.id}>${i.title}</div>${i.targets.map(o=>this.row(o))}`):r`<div class="state" data-cast-empty>${m("cast.empty")}</div>`}
      </div>
      ${this.remote?r`<div class="note" data-cast-remote-note>${m("cast.remoteNote")}</div>`:n}`}head(e){return r`<header><div><h3>${m("cast.pickerTitle")}</h3>${this.cameraName?r`<div class="sub">${m("cast.pickerFor")} ${this.cameraName}</div>`:n}</div>
      ${e?r`<button type="button" class="x" aria-label=${m("cast.close")} data-cast-close @click=${()=>this.close()}><sw-icon name="close" size=${16}></sw-icon></button>`:n}</header>`}foot(){const e=this.data;return r`<footer><span>${e&&e.ready?`${e.active}/${e.max_sessions}`:""}</span>
      <a class="link" data-cast-mine href="#/multimedia/cast" @click=${s=>{s.preventDefault(),this.close(),location.hash="#/multimedia/cast"}}>${m("cast.mineLink")}</a></footer>`}render(){if(!this.open)return n;const e=this.mode();return this.watch,e==="sheet"?r`<sw-sheet open kind="sheet" @close=${()=>this.close()}>
        <div class="panel sheet" data-cast-picker="sheet" role="region" aria-label=${m("cast.sheetRegion")}>${this.head(!1)}${this.body()}${this.foot()}</div></sw-sheet>`:r`<div class=${`panel ${e}`} data-cast-picker=${e} role="dialog" aria-label=${m("cast.sheetRegion")}>${this.head(!0)}${this.body()}${this.foot()}</div>`}};f.styles=B`
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
      background: var(--sw-seg-thumb, var(--sw-surface));
      color: var(--sw-accent, var(--sw-text));
      /* DARK-REVIEW-2342: the bare accent read ~2.2:1 on the lifted dark thumb (3.3:1 on the old one) - dark takes the accent's text ink;
         light keeps the accent (an engine without light-dark() keeps the line above) */
      color: light-dark(var(--sw-accent, var(--sw-text)), var(--sw-accent-text));
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
  `;b([g({type:Boolean,reflect:!0})],f.prototype,"open",2);b([g()],f.prototype,"cameraId",2);b([g()],f.prototype,"cameraName",2);b([g({attribute:!1})],f.prototype,"anchor",2);b([g()],f.prototype,"profile",2);b([g({type:Boolean})],f.prototype,"phone",2);b([g()],f.prototype,"ddPhone",2);b([g({type:Boolean})],f.prototype,"remote",2);b([l()],f.prototype,"data",2);b([l()],f.prototype,"loading",2);b([l()],f.prototype,"error",2);b([l()],f.prototype,"busyKey",2);b([l()],f.prototype,"confirm",2);b([l()],f.prototype,"quality",2);f=b([O("sw-cast-picker")],f);var Je=Object.defineProperty,Ge=Object.getOwnPropertyDescriptor,p=(e,s,t,a)=>{for(var i=a>1?void 0:a?Ge(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&Je(s,t,i),i};let c=class extends N{constructor(){super(...arguments),this.bubbleSkin=new ae(this),this.cameraId="cam-1",this.mapTicket=!1,this.cam=null,this.zones=null,this.zonesBusy=!1,this.zonesError="",this.motionEdit=null,this.motionConfirm=!1,this.motionBusy=!1,this.motionMsg="",this.paintValue=null,this.rec=null,this.osd=null,this.sched=null,this.schedError="",this.schedTab="motion",this.schedEdit=null,this.schedBusy=!1,this.schedMsg="",this.schedConfirm=!1,this.smart=null,this.smartEdit=null,this.smartBusy=!1,this.smartMsg="",this.osdMsg="",this.renameTo=null,this.renameBusy=!1,this.renameMsg="",this.osdBusy=!1,this.recMinutes=10,this.recBusy=!1,this.recMsg="",this.recTimer=0,this.zoneLayers={motion:!0,privacy:!0,intrusion:!0,lines:!0},this.caps=null,this.capsError="",this.cams=[],this.canConfigure=!1,this.settings=null,this.error="",this.loading=!0,this.profile="main",this.transport="auto",this.playerStatus="",this.playerTransport="",this.posterBust=Date.now(),this.ptzMode="presets",this.castShown=!1,this.castOpen=!1,this.castNote="",this.castWatch=new D(this),this.castNoteTimer=0}async loadSchedules(){if(!(!this.cam||!x())){if(!P()){this.sched=null,this.smart=null,this.schedError="לוחות הזמנים וחוקי ה־smart של ה־NVR נקראים עם הרשאת ניהול NVR.";return}try{this.sched=await Be(this.cam.id),this.schedError="",!this.sched.arming[this.schedTab]&&this.schedTab!=="record"&&(this.schedTab=Object.keys(this.sched.arming)[0]??"record")}catch(e){this.schedError=w(e)}try{this.smart=await Ne(this.cam.id)}catch{this.smart=null}}}startSchedEdit(){const e=this.sched;if(!e)return;const s=this.schedTab,t=(s==="record"?e.record?.days:e.arming[s])??Array.from({length:7},()=>[]);this.schedMsg="",this.schedEdit={kind:s,days:t.map(a=>a.map(i=>({...i}))),schedule_enabled:e.record?.schedule_enabled??null,enabled:e.record?.enabled}}schedDiff(){const e=this.schedEdit,s=this.sched;if(!e||!s)return 0;const t=(e.kind==="record"?s.record?.days:s.arming[e.kind])??[],a=i=>i.map(o=>o.map(d=>`${d.begin}-${d.end}-${d.mode??""}`).join(",")).join("|");return a(t)===a(e.days)?0:1}async saveSched(){const e=this.schedEdit;if(!(!e||!this.cam||this.schedBusy)){this.schedBusy=!0,this.schedConfirm=!1;try{const s=e.kind==="record"?await Oe(this.cam.id,{days:e.days,...e.schedule_enabled!==null&&e.schedule_enabled!==this.sched?.record?.schedule_enabled?{schedule_enabled:e.schedule_enabled??void 0}:{}}):await Ve(this.cam.id,e.kind,e.days);this.schedMsg=s.status==="unchanged"?"ה־NVR כבר היה במצב הזה — לא נכתב דבר.":"הלוח נכתב ל־NVR ונרשם (ניתן להחזרה מרשימת השינויים בהגדרות ‹ חיבורים).",this.schedEdit=null,await this.loadSchedules()}catch(s){this.schedMsg=w(s)}finally{this.schedBusy=!1}}}renderSchedules(){const e=this.sched;if(this.schedError&&!e)return r`<div class="note">${this.schedError}</div>`;if(!e)return r`<div class="note">קורא לוחות מה־NVR…</div>`;const s=[{id:"motion",label:"זיהוי תנועה",ok:!!e.arming.motion},{id:"line",label:"חציית קו",ok:!!e.arming.line},{id:"field",label:"פריצה לאזור",ok:!!e.arming.field},{id:"record",label:"לוח הקלטה",ok:!!e.record}],t=this.schedTab,a=this.schedEdit?.kind===t?this.schedEdit:null,i=a?a.days:t==="record"?e.record?.days:e.arming[t],o=[{id:"CMR",label:"רציף",color:"#2f6bff"},{id:"MOTION",label:"תנועה",color:"#16a34a"},{id:"EDR",label:"אירוע",color:"#f59e0b"},{id:"ALARM",label:"אזעקה",color:"#dc2626"}],d=t==="record"?e.can.schedule:e.can.events,u=s.find(h=>h.id===t)?.label??"";return r`<div class="note">${s.length} לוחות בכרטיס הזה, כולל <strong>לוח הקלטה</strong> (מתי הערוץ מקליט בפועל) — לא רק לוחות הזיהוי.</div>
      <div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-end:8px" data-schedules-tabs>
        ${s.map(h=>r`<sw-chip ?selected=${t===h.id} ?disabled=${!h.ok} data-sched-tab=${h.id} title=${h.ok?"":e.unsupported[h.id]??"לא נתמך בערוץ זה"} @click=${()=>{h.ok&&(this.schedTab=h.id,this.schedEdit=null)}}>${h.label}${h.ok?"":" · לא זמין"}</sw-chip>`)}
        <span class="grow"></span>
        ${d&&!a?r`<sw-button size="sm" icon="edit" data-sched-edit @click=${()=>this.startSchedEdit()}>עריכה</sw-button>`:n}
      </div>
      ${i?r`<sw-week-grid data-week-grid .days=${i} .modes=${t==="record"?o:[{id:"on",label:"פעיל",color:"var(--sw-accent)"}]} ?editable=${!!a}
            @change=${h=>{this.schedEdit&&(this.schedEdit={...this.schedEdit,days:h.detail.days})}}></sw-week-grid>`:r`<div class="note">הלוח הזה לא נקרא מה־NVR${e.unsupported[t]?` (${e.unsupported[t]})`:""}.</div>`}
      ${t==="record"&&e.record?r`<div class="note" style="margin-block-start:6px">ברירת מחדל: ${e.record.default_mode??"—"} · לפני אירוע ${e.record.pre_record_s??"—"} שנ׳ · אחרי ${e.record.post_record_s??"—"} שנ׳ · הקלטה ${e.record.enabled?"פעילה":"כבויה"} · לוח ${e.record.schedule_enabled===!1?"כבוי (מקליט לפי ברירת המחדל)":"פעיל"}
            ${a?r`<label style="display:inline-flex;gap:4px;align-items:center;margin-inline-start:8px"><input type="checkbox" data-sched-enabled .checked=${a.schedule_enabled!==!1} @change=${h=>this.schedEdit={...a,schedule_enabled:h.target.checked}} /> לוח פעיל</label>`:n}</div>`:n}
      ${a?r`<div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-start:8px" data-sched-editor>
            <span class="note">${t==="record"?"צבע = מצב הקלטה לשעה זו; תא ריק = אין הקלטה בשעה זו. טעות כאן = שעות בלי הקלטה, לכן יש אישור והחזר.":"תא צבוע = הזיהוי פעיל בשעה זו; כיבוי כל היום = בלי התראות מהערוץ בזמן הזה."}</span>
            <span class="grow"></span>
            <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.schedBusy||!this.schedDiff()&&(t!=="record"||a.schedule_enabled===(e.record?.schedule_enabled??null))} data-sched-save @click=${()=>this.schedConfirm=!0}>שמור ל־NVR</sw-button>
            <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.schedBusy} data-sched-cancel @click=${()=>this.schedEdit=null}>ביטול</sw-button>
          </div>`:n}
      ${this.schedConfirm&&a?r`<sw-dialog open heading=${`כתיבה ל־NVR: ${u}`} subheading=${`${this.cam?.name??""} · ערוץ ${e.channel}`} data-sched-confirm @close=${()=>this.schedConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${a.days.map(h=>h.length).reduce((h,v)=>h+v,0)} טווחים בשבוע${t==="record"?` · ${a.days.flat().filter(h=>h.mode==="CMR").length} רציף, ${a.days.flat().filter(h=>h.mode==="MOTION").length} תנועה, ${a.days.flat().filter(h=>h.mode==="EDR").length} אירוע`:""}.</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה בלחיצה.</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.schedBusy} data-sched-confirm-run @click=${()=>this.saveSched()}>${this.schedBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.schedConfirm=!1}>ביטול</sw-button></div>
          </sw-dialog>`:n}
      ${this.schedMsg?r`<div class="note" data-sched-msg>${this.schedMsg}</div>`:n}`}startSmartEdit(){const e=this.smart;if(!e)return;this.smartMsg="";const s=e.line?{enabled:e.line.enabled,lines:e.line.lines.map(a=>({...a,points:a.points.map(i=>[...i])}))}:null,t=e.field?{enabled:e.field.enabled,regions:e.field.regions.map(a=>({...a,points:a.points.map(i=>[...i])}))}:null;this.smartEdit={line:s,field:t,tool:s?{type:"line",id:s.lines[0]?.id??1}:{type:"field",id:t?.regions[0]?.id??1}}}smartClick(e){const s=this.smartEdit;if(!s)return;const a=e.currentTarget.getBoundingClientRect(),i=Math.round(Math.max(0,Math.min(1e3,(e.clientX-a.left)/a.width*1e3))),o=Math.round(Math.max(0,Math.min(1e3,(e.clientY-a.top)/a.height*1e3)));if(s.tool.type==="line"&&s.line){const d=s.line.lines.map(u=>{if(u.id!==s.tool.id)return u;const v=[...u.points.length>=2&&!(u.points[0][0]===0&&u.points[0][1]===1e3&&u.points[1][0]===0&&u.points[1][1]===1e3)&&u.points.length!==1?[]:u.points.filter(_=>!(_[0]===0&&_[1]===1e3)),[i,o]].slice(-2);return{...u,points:v,enabled:v.length===2?!0:u.enabled}});this.smartEdit={...s,line:{...s.line,lines:d}}}else if(s.tool.type==="field"&&s.field){const d=s.field.regions.map(u=>u.id===s.tool.id&&u.points.length<10?{...u,points:[...u.points,[i,o]]}:u);this.smartEdit={...s,field:{...s.field,regions:d}}}}async saveSmart(){const e=this.smartEdit;if(!(!e||!this.cam||this.smartBusy)){this.smartBusy=!0;try{const s={};e.line&&(s.line={enabled:e.line.enabled,lines:e.line.lines.filter(o=>o.points.length===2)}),e.field&&(s.field={enabled:e.field.enabled,regions:e.field.regions.filter(o=>o.points.length===0||o.points.length>=4)});const t=await qe(this.cam.id,s),a=Object.values(t).map(o=>o.status),i=Object.values(t).some(o=>o.enable_refused);this.smartMsg=a.every(o=>o==="unchanged")?"ה־NVR כבר היה במצב הזה — לא נכתב דבר.":i?"הצורות והפרמטרים נכתבו ל־NVR ונרשמו, אבל ה־NVR סירב להפעיל את הכלל דרך ה־ISAPI (invalidOperation). בקושחה הזו ההפעלה נעשית בממשק ה־NVR / המצלמה (משאב VCA של המצלמה); אחרי ההפעלה שם התצוגה כאן תתעדכן.":'הכללים נכתבו ל־NVR ונרשמו (ניתנים להחזרה). התראות "אדם" / "רכב" מגיעות רק כשהערוץ מודיע ל־Arx (הגדרות ‹ חיבורים ‹ התראות מה־NVR).',this.smartEdit=null,await Promise.all([this.loadSchedules(),this.loadZones(!0)])}catch(s){this.smartMsg=w(s)}finally{this.smartBusy=!1}}}renderSmartOverlay(){const e=this.smartEdit;if(!e)return n;const s=(t,a)=>e.tool.type===t&&e.tool.id===a;return $`
      ${e.field?e.field.regions.filter(t=>t.points.length>=1).map(t=>$`<polygon points=${t.points.map(a=>a.join(",")).join(" ")} class="field" style=${s("field",t.id)?"stroke:#fff;stroke-width:6":""}></polygon>${t.points.map(a=>$`<circle cx=${a[0]} cy=${a[1]} r="9" fill="#f59e0b" stroke="#fff" stroke-width="3"></circle>`)}`):n}
      ${e.line?e.line.lines.filter(t=>t.points.length>=1&&!(t.points[0][0]===0&&t.points[0][1]===1e3)).map(t=>$`<polyline points=${t.points.map(a=>a.join(",")).join(" ")} class="line ${t.enabled?"":"off"}" style=${s("line",t.id)?"stroke:#fff":""}></polyline>${t.points.map(a=>$`<circle cx=${a[0]} cy=${a[1]} r="9" fill="#2f6bff" stroke="#fff" stroke-width="3"></circle>`)}`):n}
    `}renderSmartEditor(){const e=this.smartEdit,s=t=>({any:"שני הכיוונים","left-right":"שמאל → ימין","right-left":"ימין → שמאל"})[t]??t;return r`<div class="legend" data-smart-editor style="display:grid;gap:8px;margin-block-start:8px">
      <div class="note">בחר כלל ולחץ על התמונה כדי לצייר: קו = <strong>שתי</strong> לחיצות (התחלה וסוף — לחיצה נוספת מזיזה את הסוף); אזור פריצה = <strong>4 עד 10</strong> לחיצות (נקודה לכל פינה), ואז ישר "שמור ל־NVR" למטה — אין צורך לסגור את הצורה. "אדם" / "רכב" = סינון אזעקות שווא (רק מטרה מסוג זה מפעילה).</div>
      ${e.line?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-lines>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" data-smart-line-enabled .checked=${e.line.enabled} @change=${t=>this.smartEdit={...e,line:{...e.line,enabled:t.target.checked}}} /> חציית קו פעילה</label>
          ${e.line.lines.map(t=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:8px;padding:4px 8px" data-smart-line=${t.id}>
            <sw-chip ?selected=${e.tool.type==="line"&&e.tool.id===t.id} data-smart-pick-line=${t.id} @click=${()=>this.smartEdit={...e,tool:{type:"line",id:t.id}}}>קו ${t.id}${t.points.length===2&&!(t.points[0][0]===0&&t.points[0][1]===1e3)?"":" · לא מצויר"}</sw-chip>
            <label class="note"><input type="checkbox" .checked=${t.enabled} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===t.id?{...i,enabled:a.target.checked}:i)}}} /> פעיל</label>
            <select class="note" aria-label="כיוון" .value=${t.direction} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===t.id?{...i,direction:a.target.value}:i)}}}>${["any","left-right","right-left"].map(a=>r`<option value=${a} ?selected=${a===t.direction}>${s(a)}</option>`)}</select>
            <label class="note">רגישות <input type="range" min="1" max="100" .value=${String(t.sensitivity)} @input=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===t.id?{...i,sensitivity:Number(a.target.value)}:i)}}} /> ${t.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${t.human} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===t.id?{...i,human:a.target.checked}:i)}}} /> אדם</label>
            <label class="note"><input type="checkbox" .checked=${t.vehicle} @change=${a=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(i=>i.id===t.id?{...i,vehicle:a.target.checked}:i)}}} /> רכב</label>
          </span>`)}
        </div>`:n}
      ${e.field?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-regions>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" data-smart-field-enabled .checked=${e.field.enabled} @change=${t=>this.smartEdit={...e,field:{...e.field,enabled:t.target.checked}}} /> פריצה לאזור פעילה</label>
          ${e.field.regions.map(t=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:8px;padding:4px 8px" data-smart-region=${t.id}>
            <sw-chip ?selected=${e.tool.type==="field"&&e.tool.id===t.id} data-smart-pick-region=${t.id} @click=${()=>this.smartEdit={...e,tool:{type:"field",id:t.id}}}>אזור ${t.id} · ${t.points.length} נק׳</sw-chip>
            <sw-button size="sm" variant="ghost" data-smart-region-clear=${t.id} @click=${()=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(a=>a.id===t.id?{...a,points:[]}:a)}}}>נקה</sw-button>
            <label class="note">רגישות <input type="range" min="1" max="100" .value=${String(t.sensitivity)} @input=${a=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===t.id?{...i,sensitivity:Number(a.target.value)}:i)}}} /> ${t.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${t.human} @change=${a=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===t.id?{...i,human:a.target.checked}:i)}}} /> אדם</label>
            <label class="note"><input type="checkbox" .checked=${t.vehicle} @change=${a=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===t.id?{...i,vehicle:a.target.checked}:i)}}} /> רכב</label>
          </span>`)}
        </div>`:n}
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="grow"></span>
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.smartBusy} data-smart-save @click=${()=>this.saveSmart()}>${this.smartBusy?"כותב…":"שמור ל־NVR"}</sw-button>
        <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.smartBusy} data-smart-cancel @click=${()=>this.smartEdit=null}>ביטול</sw-button>
      </div>
    </div>`}async saveRename(){if(!(this.renameTo===null||!this.cam||this.renameBusy)){this.renameBusy=!0,this.renameMsg="";try{const e=await ie(this.cam.id,{alias:this.renameTo.trim()});this.cam={...this.cam,...e},this.cams=this.cams.map(s=>s.id===e.id?{...s,...e}:s),this.renameTo=null,this.loadOsd()}catch(e){this.renameMsg=w(e)}finally{this.renameBusy=!1}}}renderRename(){return this.renameTo===null?n:r`<sw-dialog open heading="שינוי שם המצלמה" subheading="השם במערכת (בקיר, במפה, באירועים). השם ב־NVR לא משתנה, אלא אם כותבים אותו מסעיף ה־OSD למטה." data-rename-dialog @close=${()=>this.renameTo=null}>
      <sw-field label="שם"><input data-rename-input maxlength="80" .value=${this.renameTo} placeholder=${this.cam?.name_source??""} @input=${e=>this.renameTo=e.target.value} @keydown=${e=>{e.key==="Enter"&&this.saveRename()}} /></sw-field>
      <div class="note">ריק = השם מה־NVR${this.cam?.name_source?` („${this.cam.name_source}“)`:""}.</div>
      ${this.renameMsg?r`<div class="note" style="color:var(--sw-danger)">${this.renameMsg}</div>`:n}
      <div slot="footer"><sw-button variant="primary" icon="check" ?disabled=${this.renameBusy} data-rename-save @click=${()=>this.saveRename()}>שמור</sw-button><sw-button variant="ghost" @click=${()=>this.renameTo=null}>ביטול</sw-button></div>
    </sw-dialog>`}async loadOsd(){if(!(!this.cam||!x())){if(!P()){this.osd=null;return}try{this.osd=await Pe(this.cam.id)}catch{this.osd=null}}}async osdAction(e,s){if(!this.osdBusy){this.osdBusy=!0,this.osdMsg="";try{await s(),this.osdMsg=`${e}: נכתב ל־NVR ונרשם.`,await this.loadOsd()}catch(t){this.osdMsg=`${e}: ${w(t)}`}finally{this.osdBusy=!1}}}renderOsd(){const e=this.osd;if(!e||!e.can_write)return n;const s=(e.nvr_name??"")===e.vms_name;return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-osd>
      <span>שם ב־NVR: <b data-osd-nvr-name>${e.nvr_name??"—"}</b>${s?" (זהה לשם ב־Arx)":` · ב־Arx: ${e.vms_name}`}</span>
      <sw-button size="sm" icon="edit" ?disabled=${this.osdBusy||s} data-osd-write-name @click=${()=>this.osdAction("שם הערוץ",()=>Ie(this.cam.id))}>כתוב את השם מ־Arx ל־NVR</sw-button>
      ${e.channel_name?r`<label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-osd-name-enabled .checked=${e.channel_name.enabled} ?disabled=${this.osdBusy} @change=${t=>this.osdAction("שם על התמונה",()=>S(this.cam.id,{name_enabled:t.target.checked}))} /> שם על התמונה</label>`:n}
      ${e.datetime?r`<label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-osd-datetime-enabled .checked=${e.datetime.enabled} ?disabled=${this.osdBusy} @change=${t=>this.osdAction("חותמת זמן",()=>S(this.cam.id,{datetime_enabled:t.target.checked}))} /> חותמת זמן</label>
        <sw-field><select aria-label="פורמט תאריך" data-osd-date-style ?disabled=${this.osdBusy} @change=${t=>this.osdAction("פורמט תאריך",()=>S(this.cam.id,{date_style:t.target.value}))}>${e.date_styles.map(t=>r`<option value=${t} ?selected=${t===e.datetime.date_style}>${t}</option>`)}</select></sw-field>`:n}
      ${this.osdMsg?r`<span data-osd-msg>${this.osdMsg}</span>`:n}
    </div>`}async loadRecord(){if(!(!this.cam||!x())){try{this.rec=await je(this.cam.id)}catch{this.rec=null}window.clearTimeout(this.recTimer),this.rec?.active&&(this.recTimer=window.setTimeout(()=>void this.loadRecord(),15e3))}}async toggleRecord(){if(!(!this.cam||this.recBusy)){this.recBusy=!0,this.recMsg="";try{if(this.rec?.active)await Ae(this.cam.id),this.recMsg="ההקלטה הידנית נעצרה.";else{const e=await De(this.cam.id,this.recMinutes);this.recMsg=`הקלטה ידנית החלה · תיעצר אוטומטית ב־${re(new Date(e.stop_at))}.`}await this.loadRecord()}catch(e){this.recMsg=w(e)}finally{this.recBusy=!1}}}renderRecord(){const e=this.rec;if(!e||!e.can_write)return n;const s=e.active,t=s?`${Math.floor(s.remaining_s/60)}:${String(s.remaining_s%60).padStart(2,"0")}`:"";return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-manual-record data-active=${s?"yes":"no"}>
      ${s?r`<sw-badge kind="live" label=${`הקלטה ידנית פעילה · נותרו ${t}`}></sw-badge>
          <sw-button size="sm" variant="danger" icon="close" ?disabled=${this.recBusy} data-record-stop @click=${()=>this.toggleRecord()}>עצור הקלטה</sw-button>`:r`<sw-field><select aria-label="משך הקלטה ידנית" data-record-minutes @change=${a=>this.recMinutes=Number(a.target.value)}>${[5,10,30,60,120].map(a=>r`<option value=${a} ?selected=${a===this.recMinutes}>${a} דק׳</option>`)}</select></sw-field>
          <sw-button size="sm" variant="primary" icon="live" ?disabled=${this.recBusy||!e.track_id} data-record-start @click=${()=>this.toggleRecord()}>הקלט עכשיו</sw-button>
          ${e.track_id?r`<span>הקלטה ידנית ב־NVR על הזרם הראשי; נעצרת אוטומטית בתום הזמן גם אם המסך נסגר. ההקלטה עצמה מצטרפת להקלטות הרגילות של הערוץ — היא נמצאת לפי הזמן במסך "הקלטות", לא בתגית נפרדת.</span>`:r`<span class="warn" data-record-unavailable>אין זרם ראשי זמין למצלמה זו כרגע, אי אפשר להקליט ידנית.</span>`}`}
      ${this.recMsg?r`<span data-record-msg>${this.recMsg}</span>`:n}
    </div>`}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load(),e.has("cam")&&this.cam&&x()&&!this.zonesBusy&&(!this.zones||this.zones.camera_id!==this.cam.id)&&(this.loadRecord(),this.loadOsd(),this.loadSchedules(),this.zonesError="",this.loadZones()),e.has("cam")&&this.cam&&x()&&(!this.caps||this.caps.camera_id!==this.cam.id)&&this.loadCaps(),e.has("cam")&&this.cam&&this.loadCastTargets()}async loadZones(e=!1){if(this.cam){this.zonesBusy=!0,this.zonesError="";try{this.zones=await oe(this.cam.id,e)}catch(s){this.zonesError=w(s)}finally{this.zonesBusy=!1}}}async loadCaps(e=!1){if(this.cam){this.capsError="";try{this.caps=await ne(this.cam.id,e)}catch(s){this.capsError=w(s)}}}renderCaps(){const e=this.caps;if(this.capsError&&!e)return r`<div class="note" data-caps>יכולות המצלמה לא נקראו מה־NVR: ${this.capsError}</div>`;if(!e)return r`<div class="note" data-caps>קורא יכולות מה־NVR…</div>`;const s=e.ptz.state==="supported"?"live":e.ptz.state==="unsupported"?"neutral":"unknown",t=e.ptz.state==="supported"?`PTZ: נתמך${e.ptz.preset_count!==null?` · ${e.ptz.preset_count} presets`:""}`:e.ptz.state==="unsupported"?"PTZ: לא נתמך במצלמה זו":"PTZ: לא ידוע",a=e.audio.state==="available"?"live":e.audio.state==="disabled"?"stale":e.audio.state==="unsupported"?"neutral":"unknown",i=e.audio.state==="available"?`שמע דו־כיווני: ערוץ פעיל${e.audio.codec?` (${e.audio.codec})`:""}`:e.audio.state==="disabled"?"שמע דו־כיווני: ערוץ קיים אך כבוי במכשיר":e.audio.state==="unsupported"?"שמע דו־כיווני: אין ערוץ למצלמה זו":"שמע דו־כיווני: לא ידוע";return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center" data-caps data-ptz=${e.ptz.state} data-audio=${e.audio.state}>
      <sw-badge kind=${s} label=${t} title=${e.ptz.reason??""}></sw-badge>
      <sw-badge kind=${a} label=${i} title=${e.audio.reason??""}></sw-badge>
      <sw-badge kind="neutral" label="זום דיגיטלי: הגדלה בדפדפן בלבד, לא הנעת מצלמה"></sw-badge>
      ${e.video?.main?r`<sw-badge data-caps-webrtc kind=${e.video.main.webrtc==="ok"?"live":e.video.main.webrtc==="no"?"stale":"unknown"} label=${`זרם ראשי ${e.video.main.codec??"?"}: ${e.video.main.webrtc==="ok"?"מתנגן ב־WebRTC":e.video.main.webrtc==="no"?"לא יתנגן ב־WebRTC":"WebRTC לא ידוע"}`}></sw-badge>`:n}
      ${e.video?.hint?r`<span data-caps-webrtc-hint>${e.video.hint}.</span>`:n}
      <span>${e.ptz.reason?`PTZ לפי המכשיר: ${e.ptz.reason}. `:""}הנעת PTZ, קריאת preset ודיבור הם כתיבה למכשיר ואינם מוצעים בפיילוט ללא אישור מפורש — אין פקד מדומה. נקרא מה־NVR ${e.fetched_at.replace("T"," ").replace("Z"," UTC")}${e.cached?" (מהמטמון)":""}.</span>
    </div>`}startMotionEdit(){const e=this.zones?.motion;!e||!e.rows||!e.cols||(this.motionMsg="",this.motionEdit={cells:e.cells.map(s=>[...s]),sensitivity:e.sensitivity??50,enabled:e.enabled})}paintCell(e,s,t=!1){const a=this.motionEdit;if(!a||(t&&(this.paintValue=!a.cells[e][s]),this.paintValue===null)||a.cells[e][s]===this.paintValue)return;const i=a.cells.map(o=>[...o]);i[e][s]=this.paintValue,this.motionEdit={...a,cells:i}}fillMotion(e){const s=this.motionEdit;s&&(this.motionEdit={...s,cells:s.cells.map(t=>t.map(()=>e))})}motionDiff(){const e=this.zones?.motion,s=this.motionEdit;if(!e||!s)return{added:0,removed:0,sensitivity:!1,enabled:!1};let t=0,a=0;return s.cells.forEach((i,o)=>i.forEach((d,u)=>{const h=e.cells[o]?.[u]??!1;d&&!h&&t++,!d&&h&&a++})),{added:t,removed:a,sensitivity:s.sensitivity!==(e.sensitivity??50),enabled:s.enabled!==e.enabled}}async saveMotion(){const e=this.motionEdit,s=this.cam;if(!e||!s||this.motionBusy)return;const t=this.motionDiff();this.motionBusy=!0;try{const a=await Le(s.id,{...t.added||t.removed?{cells:e.cells}:{},...t.sensitivity?{sensitivity:e.sensitivity}:{},...t.enabled?{enabled:e.enabled}:{}});this.motionMsg=a.status==="unchanged"?"ה־NVR כבר היה במצב הזה, לא נכתב דבר.":`נכתב ל־NVR (שינוי ${a.id.slice(0,8)}). ניתן להחזיר מהגדרות ‹ חיבורים ‹ שינויים אחרונים.`,this.motionEdit=null,this.motionConfirm=!1,await this.loadZones(!0)}catch(a){this.motionMsg=w(a),this.motionConfirm=!1}finally{this.motionBusy=!1}}renderMotionEditor(e){const s=this.motionEdit,t=this.motionDiff(),a=t.added||t.removed||t.sensitivity||t.enabled,i=s.cells.flat().filter(Boolean).length;return r`<div class="legend" data-motion-editor>
      <span class="note">לחץ או גרור על התמונה כדי לסמן תאים שמזהים תנועה · ${i} מתוך ${e.rows*e.cols} תאים</span>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!0)}>בחר הכל</sw-button>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!1)}>נקה</sw-button>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px">רגישות <input type="range" min=${this.zones?.sensitivity_caps?.min??0} max=${this.zones?.sensitivity_caps?.max??100} step=${this.zones?.sensitivity_caps?.step??20} .value=${String(s.sensitivity)} data-motion-sensitivity @input=${o=>this.motionEdit={...s,sensitivity:Number(o.target.value)}} /> <b class="ltr">${s.sensitivity}</b></label>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" .checked=${s.enabled} data-motion-enabled @change=${o=>this.motionEdit={...s,enabled:o.target.checked}} /> זיהוי תנועה פעיל</label>
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="check" ?disabled=${!a||this.motionBusy} data-motion-save @click=${()=>this.motionConfirm=!0}>שמור ל־NVR</sw-button>
      <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.motionBusy} data-motion-cancel @click=${()=>this.motionEdit=null}>ביטול</sw-button>
      ${this.motionConfirm?r`<sw-dialog open heading="כתיבה ל־NVR: זיהוי תנועה" subheading=${`${this.cam?.name??""} · ערוץ ${this.zones?.channel??""}`} data-motion-confirm @close=${()=>this.motionConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${t.added?`+${t.added} תאים נוספים לזיהוי`:""}${t.added&&t.removed?" · ":""}${t.removed?`−${t.removed} תאים מוסרים`:""}${!t.added&&!t.removed?"הרשת ללא שינוי":""}</div>
              <div>רגישות: ${t.sensitivity?`${e.sensitivity??"—"} → ${s.sensitivity}`:"ללא שינוי"} · זיהוי: ${t.enabled?s.enabled?"כבוי → פעיל":"פעיל → כבוי":"ללא שינוי"}</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה. ההקלטות אינן מושפעות; אזור שלא מסומן לא יפעיל הקלטת תנועה.</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.motionBusy} data-motion-confirm-run @click=${()=>this.saveMotion()}>${this.motionBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.motionConfirm=!1}>ביטול</sw-button></div>
          </sw-dialog>`:n}
    </div>`}renderZones(e){const s=this.zones;if(this.zonesBusy&&!s)return r`<div class="note">קורא את הגדרות הזיהוי מה־NVR…</div>`;if(this.zonesError&&!s)return r`<div class="note">${this.zonesError} <sw-button size="sm" @click=${()=>this.loadZones(!0)}>נסה שוב</sw-button></div>`;if(!s)return r`<div class="note">—</div>`;const t=this.zoneLayers,a=s.motion,i=(d,u)=>d.map(([h,v])=>`${h/u.width*1e3},${v/u.height*1e3}`).join(" "),o=d=>d==="human"?"אדם":d==="vehicle"?"רכב":d;return r`
      <div class="zones" data-zones-loaded>
        <div class="frame">
          <img src=${R(e.id)} alt="" />
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="אזורי זיהוי מעל תמונת המצלמה" style=${this.smartEdit?"cursor:crosshair":""} data-zones-svg @click=${d=>this.smartClick(d)}>
            ${this.motionEdit&&a&&a.rows&&a.cols?this.motionEdit.cells.flatMap((d,u)=>d.map((h,v)=>$`<rect class=${h?"cell":"cell off"} data-motion-cell=${`${u}-${v}`} x=${v*1e3/a.cols} y=${u*1e3/a.rows} width=${1e3/a.cols} height=${1e3/a.rows} style="cursor:crosshair;${h?"":"fill:rgba(255,255,255,0.03);stroke:rgba(255,255,255,0.18)"}" @pointerdown=${_=>{_.preventDefault(),this.paintCell(u,v,!0)}} @pointerenter=${_=>{_.buttons&1&&this.paintCell(u,v)}} @pointerup=${()=>this.paintValue=null}></rect>`)):n}
            ${!this.motionEdit&&t.motion&&a&&a.rows&&a.cols?a.cells.flatMap((d,u)=>d.map((h,v)=>h?$`<rect x=${v*1e3/a.cols} y=${u*1e3/a.rows} width=${1e3/a.cols} height=${1e3/a.rows} class="cell"></rect>`:n)):n}
            ${t.privacy&&s.privacy_mask?s.privacy_mask.regions.map(d=>$`<polygon points=${i(d.points,s.privacy_mask.normalized)} class="mask"></polygon>`):n}
            ${t.intrusion&&s.intrusion&&!this.smartEdit?s.intrusion.regions.map(d=>$`<polygon points=${i(d.points,s.intrusion.normalized)} class="field"></polygon>`):n}
            ${t.lines&&s.line_crossing&&!this.smartEdit?s.line_crossing.lines.map(d=>$`<polyline points=${i(d.points,s.line_crossing.normalized)} class="line ${d.enabled?"":"off"}"></polyline>`):n}
            ${this.renderSmartOverlay()}
          </svg>
        </div>
        <div class="legend">
          <sw-chip data-zone-layer="motion" ?selected=${t.motion} @click=${()=>this.zoneLayers={...t,motion:!t.motion}}>תנועה${a?` · ${a.enabled?"פעיל":"כבוי"} · ${a.coverage_pct}% מהתמונה · רגישות ${a.sensitivity??"?"}${a.target_types.length?` · ${a.target_types.map(o).join("/")}`:""}`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="privacy" ?selected=${t.privacy} @click=${()=>this.zoneLayers={...t,privacy:!t.privacy}}>מסכת פרטיות${s.privacy_mask?` · ${s.privacy_mask.enabled?"פעילה":"כבויה"} · ${s.privacy_mask.regions.length} אזורים`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="intrusion" ?selected=${t.intrusion} @click=${()=>this.zoneLayers={...t,intrusion:!t.intrusion}}>חדירה לאזור${s.intrusion?` · ${s.intrusion.enabled?"פעיל":"כבוי"} · ${s.intrusion.regions.length} אזורים`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="lines" ?selected=${t.lines} @click=${()=>this.zoneLayers={...t,lines:!t.lines}}>חציית קו${s.line_crossing?` · ${s.line_crossing.enabled?"פעיל":"כבוי"} · ${s.line_crossing.lines.length} קווים`:" · לא נקרא"}</sw-chip>
          <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.zonesBusy} @click=${()=>this.loadZones(!0)}>רענון מה־NVR</sw-button>
          ${s.can_edit_motion&&a&&a.rows&&a.cols&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-motion-edit @click=${()=>this.startMotionEdit()}>עריכת אזורי תנועה</sw-button>`:n}
          ${this.smart?.can_write&&(this.smart.line||this.smart.field)&&!this.smartEdit&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-smart-edit @click=${()=>this.startSmartEdit()}>עריכת כללים חכמים</sw-button>`:n}
        </div>
        ${this.motionEdit&&a?this.renderMotionEditor(a):n}
        ${this.smartEdit?this.renderSmartEditor():n}
        ${this.smartMsg?r`<div class="note" data-smart-msg>${this.smartMsg}</div>`:n}
        ${this.motionMsg?r`<div class="note" data-motion-msg>${this.motionMsg}</div>`:n}
        ${Object.keys(s.unsupported).length?r`<div class="note">לא נקרא מהמכשיר: ${Object.entries(s.unsupported).map(([d,u])=>`${d} (${u})`).join(", ")}</div>`:n}
        <div class="note" data-zones-note>קריאה בלבד מה־NVR (נקרא ${s.fetched_at.replace("T"," ").replace("Z"," UTC")}${s.cached?", מהמטמון":""}). אלו פוליגונים בתמונת המצלמה — לא חדרים במפה. שכבת־על בדפדפן אינה מסכת NVR ואינה מגינה על הקלטות; עריכה או מסכה אמיתית דורשות אישור מפורש, כתיבה מאומתת ובדיקת התוצאה בזרם.</div>
      </div>`}async load(){this.loading=!0,this.error="";try{if(x()){const[e,s]=await Promise.all([le(),de()]);this.cams=e.cameras,this.cam=e.cameras.find(a=>a.id===this.cameraId)??null,this.canConfigure=e.can_sync,this.settings=s,this.transport=ce(s);const t=pe();t&&(this.profile=t.defaultProfile)}}catch(e){this.error=w(e)}finally{this.loading=!1}}setTransport(e){he(e===(this.settings?.["media.transport_default"]??I)?"":e),this.transport=e}onPlayer(e){this.playerStatus=e.detail.status,this.playerTransport=e.detail.transport??""}renderApi(){const e=this.cam;if(this.loading)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(this.error)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!e)return r`<sw-state-panel state="forbidden" heading="המצלמה לא זמינה" hint="המצלמה לא נמצאה או שאין לך הרשאת צפייה בה."></sw-state-panel>`;const s=e.can_view_live!==!1&&e.status!=="offline",t=R(e.id,this.posterBust),a=e.stream,i=ue(this.transport),o=me(this.profile,e.encoding,this.transport);return r`
      <div class="video ${s?"":"off"}">
        ${s&&e.live_kind==="still"?r`<sw-camera-tile data-live-still name=${e.name} state="live" cameraId=${e.id} poster=${R(e.id)} .stillRefresh=${e.still_refresh_s??10} noDemo></sw-camera-tile>`:s?r`<sw-live-player .cameraId=${e.id} .profile=${this.profile} .mode=${this.transport} .plan=${o.plan} .preferred=${o.preferred} .gop=${o.gop} .encoding=${e.encoding??null} .poster=${t} @player-status=${this.onPlayer}></sw-live-player>`:r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span data-camera-off-reason>${e.recorder_enabled===!1?"ה־NVR של המצלמה מושבת":e.status==="offline"?"המצלמה מנותקת מה־NVR (לפי הסנכרון האחרון)":"אין הרשאת צפייה חיה במצלמה זו"}</span></div></div>`}
      </div>
      ${s&&e.live_kind==="still"?r`<div class="note" data-live-still-note>${Ke().live.stillExplain.replace("{n}",String(e.still_refresh_s??10))}</div>`:n}
      <div class="controls" data-player=${this.playerStatus==="playing"?"playing":this.playerStatus==="error"?"error":"connecting"}>
        <div class="round" role="group" aria-label="פקדי מצלמה">
          <button title="רענון תמונה" aria-label="רענון תמונה" @click=${()=>this.posterBust=Date.now()}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${this.playerStatus!=="playing"} @click=${()=>this.player?.fullscreen()}><sw-icon name="expand" size=${16}></sw-icon></button>
          ${this.castShown?r`<button type="button" data-cast-button title=${m("cast.button")} aria-label=${m("cast.button")} aria-haspopup="dialog" aria-expanded=${this.castOpen?"true":"false"} @click=${()=>this.castOpen=!this.castOpen}><sw-icon name="cast" size=${16}></sw-icon></button>`:n}
          <button title="התחבר מחדש" aria-label="התחבר מחדש" @click=${()=>this.player?.reconnect()}><sw-icon name="refresh" size=${16}></sw-icon></button>
          <button class="q ${this.profile==="main"?"on":""}" @click=${()=>this.profile="main"}>ראשי</button>
          <button class="q ${this.profile==="sub"?"on":""}" @click=${()=>this.profile="sub"}>משני</button>
          ${i?this.settings?.["media.video_notices"]!=="true"?n:r`<span class="note" data-remote-video-policy>גישה מרחוק: WebRTC תחילה${i.mseFallback?" · MSE רק כמוצא אחרון":" · בלי MSE"}</span>`:r`<div class="transport" role="group" aria-label="תעבורה">
                  ${["auto","webrtc","mse"].map(d=>r`<button class=${this.transport===d?"on":""} @click=${()=>this.setTransport(d)}>${d==="auto"?"אוטומטי":d==="webrtc"?"WebRTC":"MSE"}</button>`)}
                </div>
                ${fe()?r`<span class="note">ברירת המחדל של המערכת: ${be(this.settings?.["media.transport_default"]??I)}</span>`:n}`}
        </div>
        ${this.playerStatus==="playing"&&this.settings?.["media.video_notices"]!=="true"?n:r`<div class="note">${this.playerStatus==="playing"?`מנגן דרך ${this.playerTransport==="webrtc"?"WebRTC":"MSE"}`:this.playerStatus==="error"?"הזרם לא זמין":"מתחבר…"}</div>`}
      </div>
      ${this.renderCast(e)}
      <frigate-camera-control camera-id=${e.id} recorder-id=${e.recorder_id} data-live-frigate-control></frigate-camera-control>
      ${this.renderSettingsAccordion(e,a)}
    `}renderCast(e){if(this.castWatch,!this.castShown&&!C.open().some(a=>a.mine&&a.camera_id===e.id))return n;const s=C.now,t=C.open().filter(a=>a.mine&&a.camera_id===e.id);return r`
      ${t.map(a=>r`<div class="cast-status" data-cast-status data-cast-status-state=${a.state} role="status">
        <sw-icon name="cast" size=${15}></sw-icon>
        <span class="who">${a.state==="not_confirmed"?m("cast.notConfirmed"):a.state==="starting"?`${m("cast.starting2")} · ${a.screen_name}`:`${m("cast.playing")}: ${a.screen_name}`}</span>
        ${a.state==="playing"?r`<span class=${ve(a,s)?"low":""} data-cast-status-left>${we(a,s)}</span>`:n}
        <sw-cast-stop .session=${a} @cast-stopped=${()=>this.flashCast(m("cast.stopped"))}></sw-cast-stop>
      </div>`)}
      ${this.castNote?r`<div class="note" data-cast-note role="status">${this.castNote}</div>`:n}
      <sw-cast-picker .open=${this.castOpen} .cameraId=${e.id} .cameraName=${e.alias||e.name} .anchor=${this.castBtn??null} .profile=${this.profile}
        .phone=${ge()} .ddPhone=${document.documentElement.getAttribute("data-dd-phone")??""} ?remote=${$e()}
        @close=${()=>this.castOpen=!1} @cast-started=${()=>this.flashCast(m("cast.started"))}></sw-cast-picker>`}flashCast(e){this.castNote=e,window.clearTimeout(this.castNoteTimer),this.castNoteTimer=window.setTimeout(()=>this.castNote="",4e3)}async loadCastTargets(){if(!this.cam||!x()||!ye("media.cast")){this.castShown=!1;return}try{const e=await L(this.cam.id);this.castShown=xe({api:!0,hasCast:!0,targets:e.targets.length,ready:e.ready})}catch{this.castShown=!1}}renderSettingsAccordion(e,s){const t=this.renderCaps(),a=this.renderRecord(),i=this.renderOsd();return r`<details class="acc-root" data-camera-settings>
      <summary><sw-icon class="chev" name="chevron" size=${16}></sw-icon>הגדרות מצלמה</summary>
      <div class="acc-body">
        ${a!==n?r`<details class="acc" data-acc-record ?open=${!!this.rec?.active}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>הקלטה ידנית</span>${this.rec?.active?r`<sw-badge kind="live" label="פעילה"></sw-badge>`:n}</summary>
              <div class="acc-content">${a}</div>
            </details>`:n}
        <details class="acc" data-acc-details>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>פרטים</span></summary>
          <div class="acc-content">
            <dl>
              <dt>מצב</dt><dd><sw-badge kind=${e.status==="online"?"live":e.status==="offline"?"offline":"unknown"}></sw-badge></dd>
              <dt>ערוץ</dt><dd>${e.channel} · <span class="ltr">track ${e.main_track??"?"}</span></dd>
              <dt>שם ב־NVR</dt><dd>${e.name_source||"—"}</dd>
              <dt>זרם ראשי</dt><dd>${s?`${s.resolution??""} · ${s.fps??"?"} fps · ${s.bitrate_kbps??"?"} kbps`:"לא נבדק"}</dd>
              <dt>זמן מקור</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
              <dt>נראתה לאחרונה</dt><dd>${e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</dd>
            </dl>
            ${t}
          </div>
        </details>
        ${i!==n?r`<details class="acc" data-acc-osd>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>OSD — כיתוב על התמונה</span></summary>
              <div class="acc-content">${i}</div>
            </details>`:n}
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
        <details class="acc" data-acc-more>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>מצלמות נוספות</span></summary>
          <div class="acc-content tiles">
            ${this.cams.filter(o=>o.id!==e.id).slice(0,4).map(o=>r`<sw-camera-tile compact name=${o.name} state=${o.status==="online"?"live":o.status==="offline"?"offline":"unknown"} poster=${o.status==="offline"?"":R(o.id)} @click=${()=>j(`/live/cameras/${o.id}`)}></sw-camera-tile>`)}
          </div>
        </details>
      </div>
    </details>`}renderDemo(){const e=E.find(a=>a.id===this.cameraId)??E[0],s=e.state==="live"||e.state==="stale",t=A[e.id]??"lobby";return r`
      <div class="video ${s?t:"off"}">
        ${s?r`<sw-scene kind=${t}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>
              <span class="stamp">2026-09-14 10:24:36</span>
              <span class="quality">${this.profile==="main"?"1440p · H.265":"360p · H.264"}</span>`:r`<div class="center"><div>
              <sw-icon name=${e.state==="offline"?"offline":"lock"} size=${32}></sw-icon>
              <span>${e.state==="offline"?"המצלמה אינה מחוברת ל־NVR":"אין הרשאת צפייה במצלמה זו"}</span>
            </div></div>`}
      </div>
      <div class="controls" data-player=${s?"playing":"error"}>
        <div class="round" role="group" aria-label="פקדי מצלמה">
          ${e.audio?r`<button title="מיקרופון" aria-label="מיקרופון" ?disabled=${!s}><sw-icon name="mic" size=${16}></sw-icon></button><button title="שמע" aria-label="שמע" ?disabled=${!s}><sw-icon name="volume" size=${16}></sw-icon></button>`:n}
          <button title="צילום מסך" aria-label="צילום מסך" ?disabled=${!s}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${!s}><sw-icon name="expand" size=${16}></sw-icon></button>
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
            </div>`:n}
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
            ${E.filter(a=>a.floor===e.floor&&a.id!==e.id).slice(0,4).map(a=>r`<sw-camera-tile compact name=${a.name} state=${a.state} scene=${A[a.id]??"lobby"} @click=${()=>j(`/live/cameras/${a.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    `}render(){const e=x(),s=e?this.cam?.name??"מצלמה":(E.find(a=>a.id===this.cameraId)??E[0]).name,t=e?this.cam?`ערוץ ${this.cam.channel} · ${this.cam.name_source||""}`:"":`${(E.find(a=>a.id===this.cameraId)??E[0]).floor} · נתוני הדגמה`;return r`
      <sw-page heading=${s} subheading=${t} crumbs="מצלמות | שידור חי" backHref="/live/wall">
        ${this.cam?r`<sw-badge slot="actions" kind=${this.cam.status==="online"?"live":this.cam.status==="offline"?"offline":"unknown"}></sw-badge>`:n}
        ${e&&this.cam&&this.canConfigure?r`<sw-button slot="actions" variant="ghost" icon="edit" data-camera-rename @click=${()=>{this.renameMsg="",this.renameTo=this.cam?.alias??this.cam?.name??""}}>שנה שם</sw-button>`:n}
        ${this.renderRename()}
        <a slot="actions" href=${e&&this.cam?`#/investigate/playback?camera=${this.cam.id}`:"#/investigate/playback"}><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label="במפה"></sw-button></a>
        ${e&&this.cam&&Ze()?r`<sw-button slot="actions" variant="ghost" icon="plus" data-camera-ticket @click=${()=>this.mapTicket=!0}>${We()}</sw-button>`:n}
        ${this.mapTicket&&this.cam?r`<ticket-map-create open .element=${{pick:{resource:{type:"camera",id:this.cam.id}},name:this.cam.alias||this.cam.name,floorName:""}} @close=${()=>this.mapTicket=!1}></ticket-map-create>`:n}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};c.styles=[B`
    /* the detection-zones view (renderZones). Here, not in a <style> element of the template: the remote channel's strict
       CSP (style-src-elem 'self', CR-008 P2) refuses inline style elements; static styles are constructed stylesheets */
    .zones .frame { position: relative; aspect-ratio: 16 / 9; background: var(--sw-video-bg); border-radius: var(--sw-r-sm); overflow: hidden; }
    .zones .frame img { inline-size: 100%; block-size: 100%; object-fit: fill; display: block; }
    .zones .frame svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
    .zones .cell { fill: rgba(239, 68, 68, 0.28); stroke: rgba(239, 68, 68, 0.55); stroke-width: 1; }
    .zones .mask { fill: rgba(15, 23, 42, 0.78); stroke: #0f172a; stroke-width: 3; }
    .zones .field { fill: rgba(245, 158, 11, 0.25); stroke: #f59e0b; stroke-width: 4; }
    .zones .line { fill: none; stroke: #2f6bff; stroke-width: 6; }
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
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 65%, rgba(0, 0, 0, 0.45) 100%);
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
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .quality {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
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
    .round button:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
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
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
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
  `,ke];p([g()],c.prototype,"cameraId",2);p([l()],c.prototype,"mapTicket",2);p([l()],c.prototype,"cam",2);p([l()],c.prototype,"zones",2);p([l()],c.prototype,"zonesBusy",2);p([l()],c.prototype,"zonesError",2);p([l()],c.prototype,"motionEdit",2);p([l()],c.prototype,"motionConfirm",2);p([l()],c.prototype,"motionBusy",2);p([l()],c.prototype,"motionMsg",2);p([l()],c.prototype,"rec",2);p([l()],c.prototype,"osd",2);p([l()],c.prototype,"sched",2);p([l()],c.prototype,"schedError",2);p([l()],c.prototype,"schedTab",2);p([l()],c.prototype,"schedEdit",2);p([l()],c.prototype,"schedBusy",2);p([l()],c.prototype,"schedMsg",2);p([l()],c.prototype,"schedConfirm",2);p([l()],c.prototype,"smart",2);p([l()],c.prototype,"smartEdit",2);p([l()],c.prototype,"smartBusy",2);p([l()],c.prototype,"smartMsg",2);p([l()],c.prototype,"osdMsg",2);p([l()],c.prototype,"renameTo",2);p([l()],c.prototype,"renameBusy",2);p([l()],c.prototype,"renameMsg",2);p([l()],c.prototype,"osdBusy",2);p([l()],c.prototype,"recMinutes",2);p([l()],c.prototype,"recBusy",2);p([l()],c.prototype,"recMsg",2);p([l()],c.prototype,"zoneLayers",2);p([l()],c.prototype,"caps",2);p([l()],c.prototype,"capsError",2);p([l()],c.prototype,"cams",2);p([l()],c.prototype,"canConfigure",2);p([l()],c.prototype,"settings",2);p([l()],c.prototype,"error",2);p([l()],c.prototype,"loading",2);p([l()],c.prototype,"profile",2);p([l()],c.prototype,"transport",2);p([l()],c.prototype,"playerStatus",2);p([l()],c.prototype,"playerTransport",2);p([l()],c.prototype,"posterBust",2);p([l()],c.prototype,"ptzMode",2);p([Z("sw-live-player")],c.prototype,"player",2);p([l()],c.prototype,"castShown",2);p([l()],c.prototype,"castOpen",2);p([l()],c.prototype,"castNote",2);p([Z("[data-cast-button]")],c.prototype,"castBtn",2);c=p([O("live-camera")],c);export{c as LiveCamera};
//# sourceMappingURL=live-camera-QSUEvDzX.js.map
