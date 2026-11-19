import{g as S,ax as g,j as d,i as R,mk as A,eK as x,A as o,b as a,ml as j,mm as P,mn as W,mo as B,k as N,cx as D,n as f,cw as r,u as U,aV as M,a2 as T,aA as z,mp as C,mq as H,mr as X,a as b,ms as Y,dr as y,mt as _,mu as G,mv as K,mw as J,mx as Q,dK as I}from"./index-koYOOmpL.js";import{g as Z,a as tt}from"./frigate-control-BD8WmB4c.js";import{P as E,r as et,a as st,b as rt,t as it,d as at,e as nt,f as ot}from"./recorders-BJYWnyGi.js";import{W as L,w as dt,a as lt,b as ct,c as ht}from"./nvr-h264-preset-DPshAyo5.js";var pt=Object.defineProperty,ut=Object.getOwnPropertyDescriptor,w=(t,e,i,n)=>{for(var s=n>1?void 0:n?ut(e,i):e,p=t.length-1,h;p>=0;p--)(h=t[p])&&(s=(n?h(e,i,s):h(s))||s);return n&&s&&pt(e,i,s),s};let u=class extends R{constructor(){super(...arguments),this.caps=null,this.recorderId="",this.loaded=null,this.failed=!1,this.writesOn=!1,this.onPolicy=t=>{this.writesOn=t.detail.anyOn}}connectedCallback(){super.connectedCallback(),this.recorderId&&!this.caps&&this.load(),document.addEventListener("frigate-control-policy",this.onPolicy),this.recorderId&&!this.caps&&Z(this.recorderId).then(t=>this.writesOn=tt(t)).catch(()=>{})}disconnectedCallback(){document.removeEventListener("frigate-control-policy",this.onPolicy),super.disconnectedCallback()}async load(){try{this.loaded=await A(this.recorderId),this.failed=!1}catch{this.failed=!0}}render(){const t=this.caps??this.loaded,e=x.frigate.summary;if(!t)return this.failed?a`<div class="note" data-frigate-summary-failed><sw-icon name="info" size="14"></sw-icon><span>${e.unavailable}</span></div>`:o;const i=t.features,n=i?W.filter(s=>B.includes(s)||s in i):[];return a`<div class="box" data-frigate-summary>
      <h4>${e.title}</h4>
      <dl>
        ${j(t).map(s=>a`<dt>${s.label}</dt><dd data-frigate-row=${s.key} class=${s.key==="version"?"ltr":""}>${s.value}</dd>`)}
      </dl>
      ${i?a`<div>
        <h4>${e.features}</h4>
        <ul class="feats" data-frigate-features>
          ${n.map(s=>{const p=i[s]===!0;return a`<li class="feat" data-feature=${s} data-on=${String(p)} aria-label=${`${P(s)}: ${p?e.on:e.off}`}><sw-icon name=${p?"check":"close"} size="12"></sw-icon>${P(s)}</li>`})}
        </ul>
      </div>`:a`<div class="note" data-frigate-more-after-save><sw-icon name="info" size="14"></sw-icon><span>${e.moreAfterSave}</span></div>`}
      <div class="note" data-frigate-readonly><sw-icon name="info" size="14"></sw-icon><span>${this.writesOn?x.frigate.control.settings.summaryWrites:e.readOnly}${t.restream?"":` ${e.stillOnly}`}</span></div>
    </div>`}};u.styles=S`
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
      font-size: var(--sw-fs-sm);
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--sw-s-1) var(--sw-s-3);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
      color: var(--sw-text);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    dd.ltr {
      direction: ltr;
      text-align: start;
    }
    .feats {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1h);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .feat {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .feat[data-on='true'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      display: flex;
      gap: var(--sw-s-1h);
      align-items: flex-start;
    }
    .note sw-icon {
      flex: none;
      margin-block-start: 1px;
    }
  `;w([g({attribute:!1})],u.prototype,"caps",2);w([g({attribute:"recorder-id"})],u.prototype,"recorderId",2);w([d()],u.prototype,"loaded",2);w([d()],u.prototype,"failed",2);w([d()],u.prototype,"writesOn",2);u=w([N("frigate-summary")],u);var vt=Object.defineProperty,ft=Object.getOwnPropertyDescriptor,m=(t,e,i,n)=>{for(var s=n>1?void 0:n?ft(e,i):e,p=t.length-1,h;p>=0;p--)(h=t[p])&&(s=(n?h(e,i,s):h(s))||s);return n&&s&&vt(e,i,s),s};const wt=t=>{const e=new Date(t);return Number.isNaN(e.getTime())?t:e.toLocaleString(U(),{dateStyle:"short",timeStyle:"short"})};let v=class extends R{constructor(){super(...arguments),this.recorderId=E,this.view=null,this.busy=!1,this.confirmOpen=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}updated(t){t.has("recorderId")&&t.get("recorderId")!==void 0&&this.load()}async load(){try{this.view=await et(this.recorderId),this.error=""}catch{this.view=null,this.error=""}}async apply(t){this.busy=!0,this.error="";try{this.view=await st(this.recorderId,t,t),this.confirmOpen=!1,this.dispatchEvent(new CustomEvent("writes-changed",{detail:{recorderId:this.recorderId,enabled:this.view.enabled},bubbles:!0,composed:!0}))}catch(e){this.error=f(e)}finally{this.busy=!1}}onToggle(t){const e=t.detail.checked,i=this.view;i&&(t.target.checked=i.enabled,e!==i.enabled&&(e?this.confirmOpen=!0:this.apply(!1)))}render(){const t=this.view;return!t||!t.supported?o:a`<div class="row" data-nvr-writes data-enabled=${t.enabled?"true":"false"}>
        <div class="txt">
          <span class="label">${L}</span>
          <span class="status" data-nvr-writes-status>${dt(t,wt)}</span>
          ${t.can_change?o:a`<span class="status" data-nvr-writes-readonly>${r("נדרשת הרשאת שינוי הגדרות NVR")}</span>`}
        </div>
        <sw-toggle label=${L} .labelHidden=${!0} data-nvr-writes-toggle .checked=${t.enabled} ?disabled=${!t.can_change||this.busy} @change=${e=>this.onToggle(e)}></sw-toggle>
      </div>
      ${this.error?a`<p class="err" role="alert" data-nvr-writes-error>${this.error}</p>`:o}
      ${this.confirmOpen?a`<sw-dialog open heading=${lt} data-nvr-writes-dialog ?locked=${this.busy} @close=${()=>this.confirmOpen=!1}>
            <ul class="points">${ht.map(e=>a`<li>${e}</li>`)}</ul>
            <div slot="footer">
              <sw-button variant="primary" data-nvr-writes-confirm ?disabled=${this.busy} @click=${()=>void this.apply(!0)}>${this.busy?r("מפעיל…"):ct}</sw-button>
              <sw-button variant="ghost" data-nvr-writes-cancel ?disabled=${this.busy} @click=${()=>this.confirmOpen=!1}>${r("ביטול")}</sw-button>
            </div>
          </sw-dialog>`:o}`}};v.styles=S`
    ${D}
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-block-size: 44px;
      padding-block: 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    .txt {
      display: grid;
      gap: 2px;
      min-inline-size: 0;
    }
    .label {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .status {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    .err {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .points {
      margin: 0;
      padding-inline-start: 18px;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
  `;m([g({attribute:"recorder-id"})],v.prototype,"recorderId",2);m([d()],v.prototype,"view",2);m([d()],v.prototype,"busy",2);m([d()],v.prototype,"confirmOpen",2);m([d()],v.prototype,"error",2);v=m([N("nvr-writes-switch")],v);var mt=Object.defineProperty,bt=Object.getOwnPropertyDescriptor,c=(t,e,i,n)=>{for(var s=n>1?void 0:n?bt(e,i):e,p=t.length-1,h;p>=0;p--)(h=t[p])&&(s=(n?h(e,i,s):h(s))||s);return n&&s&&mt(e,i,s),s};const V=new Set(["host","http_port","rtsp_port","username","password"]),k={vendor:"",host:"",http_port:"",rtsp_port:"",username:"",password:"",extra:{}},O={source_forbidden:r("שם משתמש או סיסמה שגויים"),source_unavailable:r("לא ניתן להתחבר"),timeout:r("לא ניתן להתחבר"),source_error:r("לא ניתן להתחבר"),host_refused:r("כתובת לא מותרת"),port_refused:r("פורט לא מותר"),username_invalid:r("שם משתמש לא תקין"),password_required:r("יש להזין את הסיסמה מחדש"),tls_pin_mismatch:r("תעודת ה־NVR אינה התעודה שננעצה"),tls_pin_required:r("יש לנעוץ את תעודת ה־NVR לפני השמירה"),auth_scheme_unsupported:r("שיטת האימות של ה־NVR אינה נתמכת"),auth_downgrade_refused:r("ה־NVR ביקש שיטת אימות חלשה מבעבר. בחרו את שיטת האימות במפורש")},F={basic_over_http:r("הסיסמה נשלחת בלי הצפנה (Basic על HTTP). מומלץ לבחור HTTPS."),tls_trust_any:r("תעודת ה־HTTPS אינה נבדקת. מומלץ לנעוץ את תעודת המכשיר."),vendor_auth_version:r("המכשיר מבקש גרסת אימות של היצרן שאינה נתמכת. אם הכניסה נכשלת, החליפו בשרת ה־API של המכשיר את סוג ההצפנה.")},gt=new Set(["host_refused","host_invalid","port_refused","port_invalid","username_invalid","username_required","password_required"]),$t=new Set(["source_unavailable","timeout"]);let l=class extends R{constructor(){super(...arguments),this.context="settings",this.recorderId=E,this.addName="",this.loadState="loading",this.loadError="",this.view=null,this.vendors=[],this.draft={...k},this.editing=!1,this.changePassword=!1,this.busy="",this.msg=null,this.testLine=null,this.offerUntested=!1,this.untestedOpen=!1,this.removeOpen=!1,this.word="",this.lockedByServer=!1,this.stale=!1,this.invalidField="",this.lastTest=null,this.dismissed=[],this.advancedOpen=!1,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.requestUpdate()}get btn(){return this.mq.matches?"lg":"sm"}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}connectedCallback(){super.connectedCallback(),this.mq.addEventListener("change",this.onMq),T()&&z("system.configure")&&!C()&&this.load()}async load(){this.loadState="loading";try{const[t,e]=await Promise.all([H(),this.loadView()]);this.vendors=t,this.view=e,this.loadError="",this.lockedByServer=!1,this.stale=!1,this.invalidField="",this.loadState="ready",this.editing=this.context!=="settings"||!e.vendor||e.state==="not_chosen"||e.state==="unreadable"||e.state==="refused",this.seed()}catch(t){this.loadError=f(t),this.loadState="error"}}get primary(){return this.context!=="add"&&this.recorderId===E}loadView(){return this.context==="add"?Promise.resolve({vendor:null,host:null,http_port:null,rtsp_port:null,username:null,user:null,extra:{},has_password:!1,state:"not_chosen",source:null,revision:0,updated_at:null,updated_by:null,pending_restart:!1,legacy_options_differ:!1,in_addon:!1,restart:"manual",cameras:0,vendor_locked:!1}):this.primary?X():rt(this.recorderId)}seed(){const t=this.view,e=t?.vendor&&this.vendors.some(i=>i.id===t.vendor);this.draft=e&&t?{vendor:String(t.vendor),host:t.host??"",http_port:t.http_port?String(t.http_port):"",rtsp_port:t.rtsp_port?String(t.rtsp_port):"",username:t.username??"",password:"",extra:{...t.extra??{}}}:{...k,extra:{}},this.changePassword=!1,this.testLine=null,this.offerUntested=!1}get spec(){return this.vendors.find(t=>t.id===this.draft.vendor)}label(t){return t?this.vendors.find(e=>e.id===t)?.label??t:"—"}setDraft(t){this.draft={...this.draft,...t},this.testLine=null,this.offerUntested=!1,this.msg=null,this.invalidField="",this.lastTest=null}fieldError(t){if(!(t instanceof b)||!gt.has(t.code))return null;const e=typeof t.body.details?.field=="string"?t.body.details.field:"";return t.code==="password_required"&&(this.changePassword=!0,this.draft={...this.draft,password:""}),this.invalidField=e,O[t.code]??f(t)}isStale(t){return t instanceof b&&(t.code==="stale"||t.code==="revision_required")}chooseVendor(t){const e=this.vendors.find(s=>s.id===t);if(!e||e.status!=="available")return;const i=this.draft,n={...i.extra};for(const s of e.fields)s.kind==="select"&&n[s.key]===void 0&&s.options?.length&&(n[s.key]=s.options[0][0]);this.setDraft({vendor:t,http_port:i.http_port||(e.default_ports.http_port?String(e.default_ports.http_port):""),rtsp_port:i.rtsp_port||(e.default_ports.rtsp_port?String(e.default_ports.rtsp_port):""),extra:n})}get keepsStoredPassword(){const t=this.view;if(!t?.has_password||t.vendor!==this.draft.vendor||this.changePassword)return!1;const e=this.draft;return e.host.trim()===(t.host??"")&&e.http_port.trim()===String(t.http_port??"")&&e.rtsp_port.trim()===String(t.rtsp_port??"")}body(){const t=this.draft;if(t.vendor==="none")return{vendor:"none"};const e={};for(const n of this.spec?.fields??[]){if(V.has(n.key))continue;const s=t.extra[n.key];s!==void 0&&s!==""&&(e[n.key]=s)}const i=n=>n.trim()===""?null:Number(n);return{vendor:t.vendor,host:t.host.trim(),http_port:i(t.http_port),rtsp_port:i(t.rtsp_port),username:t.username.trim(),...t.password?{password:t.password}:{},...Object.keys(e).length?{extra:e}:{}}}get complete(){const t=this.draft;if(!t.vendor||this.context==="add"&&(!this.addName.trim()||t.vendor==="none"))return!1;if(t.vendor==="none")return!0;for(const e of this.spec?.fields??[])if(e.required)if(e.key==="password"){if(!t.password&&!this.keepsStoredPassword)return!1}else{if(e.key==="host"&&!t.host.trim())return!1;if(e.key==="username"&&!t.username.trim())return!1;if(!V.has(e.key)&&(t.extra[e.key]===void 0||t.extra[e.key]===""))return!1}return!0}testText(t){return t.ok?[r("מחובר"),t.model,t.channels!=null?r("{n} ערוצים",{n:t.channels}):null].filter(Boolean).join(" · "):t.code==="nvr_not_supported"?`${r("גרסת Frigate {version} אינה נתמכת",{version:t.firmware??""})}${t.min_version?` ${r("(נדרשת {version} ומעלה)",{version:t.min_version})}`:""}`.replace("  "," "):O[t.code]??r("לא ניתן להתחבר")}async runTest(){if(!(this.busy||!this.complete||this.draft.vendor==="none")){this.busy="test",this.msg=null,this.offerUntested=!1;try{const t={...this.body(),use_stored_password:this.keepsStoredPassword},e=this.primary||this.context==="add"?await Y(this.context==="add"?{...t,use_stored_password:!1}:t):await it(this.recorderId,t);this.testLine={ok:e.ok,text:this.testText(e)},this.offerUntested=!e.ok&&$t.has(e.code),this.lastTest=e}catch(t){const e=t instanceof b?t.code:"";this.testLine={ok:!1,text:this.fieldError(t)??O[e]??f(t)}}finally{this.busy=""}}}async save(t=!1){if(!(this.busy||!this.complete)&&!(t&&!y("nvr_save_untested",this.word))){this.busy="save",this.msg=null,this.testLine=null;try{const e=t?{save_untested:!0,confirm_text:this.word.trim()}:{};if(this.context==="add"){const s=await at({...this.body(),name:this.addName.trim(),...e});this.untestedOpen=!1,this.word="",this.draft={...k,extra:{}},this.addName="",this.msg={tone:"ok",text:s.untested?r("נוסף בלי בדיקת חיבור"):[r("נוסף"),s.device?.model].filter(Boolean).join(" · ")},_(!0),this.dispatchEvent(new CustomEvent("nvr-recorder-added",{bubbles:!0,composed:!0,detail:s}));return}const i={...this.body(),if_revision:this.view?.revision??0,...e},n=this.primary?await G(i):await nt(this.recorderId,i);if(n.new_recorder){this.untestedOpen=!1,this.word="",await this.load(),this.msg={tone:"ok",text:r("נשמר כ־NVR חדש")},_(!0),this.dispatchEvent(new CustomEvent("nvr-connection-saved",{bubbles:!0,composed:!0,detail:n}));return}this.view=n,this.editing=this.context==="wizard",this.untestedOpen=!1,this.word="",this.seed(),this.msg={tone:"ok",text:n.vendor==="none"?r("נשמר: ללא NVR"):n.untested?r("נשמר בלי בדיקת חיבור"):[r("החיבור נבדק ונשמר"),n.device?.model,n.device?.channels!=null?r("{n} ערוצים",{n:n.device.channels}):null].filter(Boolean).join(" · ")},_(!0),this.dispatchEvent(new CustomEvent("nvr-connection-saved",{bubbles:!0,composed:!0,detail:n}))}catch(e){this.untestedOpen=!1,this.word="";const i=this.fieldError(e);this.isStale(e)?(this.msg={tone:"err",text:f(e)},this.stale=!0):i?this.msg={tone:"err",text:i}:(e instanceof b&&e.code==="remove_first"&&(this.lockedByServer=!0),this.msg={tone:"err",text:f(e)},this.offerUntested=e instanceof b&&e.body.details?.can_save_untested===!0)}finally{this.busy=""}}}async removeNvr(){if(!(this.busy||!y("nvr_remove",this.word))){this.busy="remove",this.msg=null;try{this.primary?await K(this.word.trim(),this.view?.revision??0):await ot(this.recorderId,this.word.trim(),this.view?.revision??0),this.removeOpen=!1,this.word="",_(!0),await this.load(),this.msg={tone:"ok",text:r("ה־NVR הוסר")},this.dispatchEvent(new CustomEvent("nvr-connection-removed",{bubbles:!0,composed:!0}))}catch(t){this.removeOpen=!1,this.msg={tone:"err",text:f(t)},this.isStale(t)&&(this.stale=!0)}finally{this.busy=""}}}cancelEdit(){this.editing=!1,this.seed(),this.msg=null}summary(t){const e=t.vendor==="none",i=[[r("סוג"),e?r("ללא NVR"):this.label(t.vendor)]];return e||(i.push([r("כתובת · פורט HTTP · RTSP"),a`<span class="ltr">${t.host??"—"} · ${t.http_port??"—"} · ${t.rtsp_port??"—"}</span>`]),i.push([r("משתמש"),t.state==="unreadable"?r("יש להזין סיסמה מחדש"):a`<span class="ltr">${t.username??"—"}</span> · ${t.has_password?r("הוגדרה סיסמה"):r("חסרה סיסמה")}`,t.has_password?"ok":"warn"])),a`<div data-conn-summary>${i.map(([n,s,p])=>a`<div class="row"><span>${n}</span><span class=${`val ${p??""}`}>${s}</span></div>`)}</div>`}field(t){const e=this.draft,i=t.key;if(i==="password")return this.passwordField(t);if(t.kind==="select"){const h=String(e.extra[i]??t.options?.[0]?.[0]??"");return a`<sw-field label=${t.label}><select data-conn-field=${i} @change=${$=>this.setDraft({extra:{...e.extra,[i]:$.target.value}})}>
        ${(t.options??[]).map(([$,q])=>a`<option value=${$} ?selected=${$===h}>${q}</option>`)}
      </select></sw-field>`}if(t.kind==="bool")return a`<label class="chk"><input type="checkbox" data-conn-field=${i} .checked=${e.extra[i]===!0} @change=${h=>this.setDraft({extra:{...e.extra,[i]:h.target.checked}})} />${t.label}</label>`;const n=t.kind==="port",s=i==="host"?e.host:i==="http_port"?e.http_port:i==="rtsp_port"?e.rtsp_port:i==="username"?e.username:String(e.extra[i]??""),p=h=>this.setDraft(i==="host"?{host:h}:i==="http_port"?{http_port:h}:i==="rtsp_port"?{rtsp_port:h}:i==="username"?{username:h}:{extra:{...e.extra,[i]:h}});return a`<sw-field label=${t.label}><input data-ltr data-conn-field=${i} aria-invalid=${this.invalidField===i?"true":"false"} type=${n?"number":"text"} inputmode=${n?"numeric":"text"} autocomplete="off" autocapitalize="off" spellcheck="false" .value=${s} @input=${h=>p(h.target.value)} /></sw-field>`}passwordField(t){return this.keepsStoredPassword?a`<div class="pwset" data-conn-password-set><span>${t.label}: ${r("הוגדרה סיסמה")}</span><button type="button" class="linkbtn" data-conn-password-change @click=${()=>this.changePassword=!0}>${r("שנה")}</button></div>`:a`<sw-field label=${t.label}><input type="password" data-ltr data-conn-field="password" data-conn-password aria-invalid=${this.invalidField==="password"?"true":"false"} autocomplete="new-password" .value=${this.draft.password} @input=${e=>this.setDraft({password:e.target.value})} /></sw-field>`}visibleFields(t){const e=this.draft.extra.scheme==="https";return t.fields.filter(i=>e||!["https_port","tls_mode","tls_pin","suppress_tls_warning"].includes(i.key))}testExtras(){const t=this.lastTest;if(!t)return o;const e=(t.warnings??[]).filter(s=>F[s]&&!this.dismissed.includes(s)),i=t.certificate,n=this.draft.extra.tls_pin&&i&&this.draft.extra.tls_pin===i.sha256;return a`${this.draft.vendor==="frigate"&&t.ok?a`<frigate-summary .caps=${t.capabilities??J(t)}></frigate-summary>`:o}${e.map(s=>a`<div class="note warn warnrow" role="note" data-conn-warning=${s}><span>${F[s]}</span>
        <button type="button" class="linkbtn" aria-label=${r("סגור")} data-conn-warning-dismiss=${s} @click=${()=>this.dismissed=[...this.dismissed,s]}>×</button></div>`)}
      ${i?a`<div class="note cert" data-conn-certificate>
          <span>${r("תעודת המכשיר")}${i.self_signed?` ${r("(חתומה עצמית)")}`:""}: <span class="ltr mono">${i.sha256.slice(0,16)}…</span>${i.matches_pin===!1?a` · <b>${r("שונה מהתעודה שננעצה")}</b>`:o}</span>
          ${n?a`<span class="ok">${r("ננעצה")}</span>`:a`<button type="button" class="linkbtn" data-conn-pin @click=${()=>this.setDraft({extra:{...this.draft.extra,tls_mode:"pin",tls_pin:i.sha256}})}>${r("נעץ תעודה זו")}</button>`}
        </div>`:o}`}form(t){const e=this.draft,i=this.spec,n=t.vendor_locked||this.lockedByServer;return a`<div class="form" data-nvr-connection-form>
      ${this.context==="add"?a`<sw-field label=${r("שם")}><input data-conn-name maxlength="60" autocomplete="off" .value=${this.addName} @input=${s=>{this.addName=s.target.value,this.msg=null}} /></sw-field>`:o}
      <sw-field label=${r("סוג NVR")}>
        <select data-conn-vendor ?disabled=${t.vendor_locked||this.busy!==""} @change=${s=>this.chooseVendor(s.target.value)}>
          <option value="" disabled ?selected=${!e.vendor}>${r("בחרו סוג NVR")}</option>
          ${this.vendors.filter(s=>this.primary||s.id!=="none").map(s=>a`<option value=${s.id} ?disabled=${s.status!=="available"} ?selected=${s.id===e.vendor}>${s.label}${s.status!=="available"?` · ${r("בקרוב")}`:""}</option>`)}
        </select>
      </sw-field>
      ${n?a`<div class="note" data-conn-vendor-locked>${r("יש להסיר את ה־NVR לפני החלפת סוג")}</div>`:o}
      ${t.state==="unreadable"?a`<div class="note warn" data-conn-unreadable>${r("יש להזין סיסמה מחדש")}</div>`:o}
      ${t.state==="refused"?a`<div class="note warn" data-conn-refused>${r("הכתובת השמורה אינה מותרת - יש להזין כתובת מחדש")}</div>`:o}
      ${i&&i.fields.length?a`<div class="grid">${this.visibleFields(i).filter(s=>!s.advanced).map(s=>this.field(s))}</div>`:o}
      ${i&&i.fields.some(s=>s.advanced)?a`<details class="adv" data-conn-advanced ?open=${this.advancedOpen} @toggle=${s=>this.advancedOpen=s.target.open}>
          <summary>${r("הגדרות מתקדמות")}</summary><div class="grid">${this.visibleFields(i).filter(s=>s.advanced).map(s=>this.field(s))}</div></details>`:o}
      ${this.testLine?a`<div class=${`line ${this.testLine.ok?"ok":"err"}`} role="status" data-conn-test-result data-ok=${String(this.testLine.ok)}>${this.testLine.text}</div>`:o}
      ${this.testExtras()}
      ${e.vendor==="frigate"?a`<div class="note" data-conn-frigate-hint>${x.frigate.summary.viewerHint} ${x.frigate.summary.linkHint}</div>`:o}
      <div class="actions">
        ${e.vendor&&e.vendor!=="none"?a`<sw-button size=${this.btn} icon="activity" ?disabled=${!this.complete||this.busy!==""} data-conn-test @click=${()=>this.runTest()}>${this.busy==="test"?r("בודק…"):r("בדוק חיבור")}</sw-button>`:o}
        <sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${!this.complete||this.busy!==""||this.stale} data-conn-save @click=${()=>this.save()}>${this.busy==="save"?r("שומר…"):this.context==="add"?r("הוסף"):r("שמור")}</sw-button>
        ${this.offerUntested?a`<sw-button size=${this.btn} variant="ghost" data-conn-save-anyway ?disabled=${this.busy!==""} @click=${()=>{this.word="",this.untestedOpen=!0}}>${r("שמור בכל זאת")}</sw-button>`:o}
        ${this.context==="settings"&&!(this.view?.state==="not_chosen"||!this.view?.vendor)?a`<sw-button size=${this.btn} variant="ghost" ?disabled=${this.busy!==""} data-conn-cancel @click=${()=>this.cancelEdit()}>${r("ביטול")}</sw-button>`:o}
      </div>
    </div>`}render(){if(!T()||!z("system.configure"))return o;if(C())return a`<p class="note" data-nvr-local-only role="status">${Q}</p>`;if(this.loadState==="loading")return a`<sw-state-panel state="loading" compact heading=${r("קורא את פרטי החיבור…")}></sw-state-panel>`;if(this.loadState==="error"||!this.view)return a`<sw-state-panel state="error" compact heading=${r("פרטי החיבור לא נטענו")} hint=${this.loadError} actionLabel=${r("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;const t=this.view,e=!!t.vendor&&t.state!=="not_chosen";return a`<div class="wrap" data-conn-form-root data-conn-state=${t.state}>
      ${!this.editing&&e?this.summary(t):o}
      ${!this.editing&&e&&this.context==="settings"&&(t.vendor==="hikvision"||t.vendor==="provision_isr")?a`<nvr-writes-switch recorder-id=${this.recorderId}></nvr-writes-switch>`:o}
      ${t.legacy_options_differ&&!this.editing?a`<div class="note" data-conn-legacy>${r("פרטי חיבור ישנים בתשתית המערכת אינם בשימוש")}</div>`:o}
      ${this.editing?this.form(t):a`<div class="actions">
          <sw-button size=${this.btn} icon="edit" data-conn-edit @click=${()=>{this.seed(),this.editing=!0,this.msg=null}}>${r("עריכה")}</sw-button>
          ${t.vendor&&t.vendor!=="none"?a`<sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove @click=${()=>{this.word="",this.removeOpen=!0}}>${r("הסר NVR")}</sw-button>`:o}
        </div>`}
      ${this.editing&&e&&t.vendor!=="none"&&this.context==="settings"?a`<div class="actions"><sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove ?disabled=${this.busy!==""} @click=${()=>{this.word="",this.removeOpen=!0}}>${r("הסר NVR")}</sw-button></div>`:o}
      ${this.msg?a`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-conn-msg>${this.msg.text}</div>`:o}
      ${this.stale?a`<div class="actions"><sw-button size=${this.btn} icon="refresh" data-conn-reload @click=${()=>void this.load()}>${r("טען מחדש")}</sw-button></div>`:o}
      ${this.untestedOpen?a`<sw-dialog open heading=${r("שמירה בלי בדיקת חיבור")} subheading=${r("לא ניתן להתחבר ל־NVR כרגע")} data-conn-untested-dialog @close=${()=>this.untestedOpen=!1}>
            <sw-field label=${r("לאישור הקלידו „{word}”",{word:I("nvr_save_untested")})}><input data-ltr data-conn-untested-word autocomplete="off" .value=${this.word} @input=${i=>this.word=i.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.busy!==""||!y("nvr_save_untested",this.word)} data-conn-untested-confirm @click=${()=>this.save(!0)}>${this.busy==="save"?r("שומר…"):r("שמור")}</sw-button><sw-button variant="ghost" @click=${()=>this.untestedOpen=!1}>${r("ביטול")}</sw-button></div>
          </sw-dialog>`:o}
      ${this.removeOpen?a`<sw-dialog open heading=${r("הסרת NVR")} subheading=${r("המצלמות יישארו במערכת ויושבתו")} data-conn-remove-dialog @close=${()=>this.removeOpen=!1}>
            <sw-field label=${r("להסרה הקלידו „{word}”",{word:I("nvr_remove")})}><input data-ltr data-conn-remove-word autocomplete="off" .value=${this.word} @input=${i=>this.word=i.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.busy!==""||!y("nvr_remove",this.word)} data-conn-remove-confirm @click=${()=>this.removeNvr()}>${this.busy==="remove"?r("מסיר…"):r("הסר NVR")}</sw-button><sw-button variant="ghost" @click=${()=>this.removeOpen=!1}>${r("ביטול")}</sw-button></div>
          </sw-dialog>`:o}
    </div>`}};l.styles=S`
    ${D}
    .wrap,
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .val {
      color: var(--sw-text-2);
      text-align: end;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .val.ok {
      color: var(--sw-success-text);
    }
    .val.warn {
      color: var(--sw-warning-text);
    }
    ${M}
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .note,
    .line {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .note.warn {
      color: var(--sw-warning-text, var(--sw-warning));
    }
    .line.ok {
      color: var(--sw-success-text);
    }
    .line.err {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .pwset {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      min-block-size: 44px;
    }
    .linkbtn {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-semibold);
      padding-inline: 12px;
      min-inline-size: 44px;
      min-block-size: 44px;
      display: inline-grid;
      place-items: center;
    }
    .linkbtn:focus-visible {
      outline: 2px solid var(--sw-accent);
      border-radius: var(--sw-r-xs);
    }
    .adv summary {
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      min-block-size: 32px;
      display: flex;
      align-items: center;
    }
    .adv .grid {
      margin-block-start: 8px;
    }
    .warnrow,
    .cert {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .cert .ok {
      color: var(--sw-success-text);
    }
    .mono {
      font-family: var(--sw-font-mono, monospace);
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      input:not([type='checkbox']),
      select {
        min-block-size: 44px;
      }
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;c([g()],l.prototype,"context",2);c([g({attribute:"recorder-id"})],l.prototype,"recorderId",2);c([d()],l.prototype,"addName",2);c([d()],l.prototype,"loadState",2);c([d()],l.prototype,"loadError",2);c([d()],l.prototype,"view",2);c([d()],l.prototype,"vendors",2);c([d()],l.prototype,"draft",2);c([d()],l.prototype,"editing",2);c([d()],l.prototype,"changePassword",2);c([d()],l.prototype,"busy",2);c([d()],l.prototype,"msg",2);c([d()],l.prototype,"testLine",2);c([d()],l.prototype,"offerUntested",2);c([d()],l.prototype,"untestedOpen",2);c([d()],l.prototype,"removeOpen",2);c([d()],l.prototype,"word",2);c([d()],l.prototype,"lockedByServer",2);c([d()],l.prototype,"stale",2);c([d()],l.prototype,"invalidField",2);c([d()],l.prototype,"lastTest",2);c([d()],l.prototype,"dismissed",2);c([d()],l.prototype,"advancedOpen",2);l=c([N("nvr-connection-form")],l);
