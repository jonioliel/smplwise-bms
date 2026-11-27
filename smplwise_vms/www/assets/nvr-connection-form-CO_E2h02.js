import{j as E,z as w,k as d,a as N,m1 as j,eF as x,A as o,b as a,m2 as A,m3 as z,m4 as W,m5 as B,m as R,d0 as D,q as f,cL as i,u as U,b4 as H,af as P,aM as T,iX as C,m6 as M,m7 as X,c as g,iH as Y,m8 as G,m9 as y,ma as J,mb as K,ae as Q,mc as Z,md as tt}from"./index-HK12zoPD.js";import{g as et,a as st}from"./frigate-control-B_E1VNcY.js";import{P as S,r as rt,a as it,b as at,t as nt,d as ot,e as dt,f as lt}from"./recorders-FnK1co4k.js";import{W as I,w as ct,a as ht,b as pt,c as ut}from"./nvr-h264-preset-CfVfamRk.js";import{c as _,a as L}from"./confirm-words-B3Rj8-Uo.js";import"./sw-logo-art-PLtEZJxU.js";import"./media-BcD4JgoJ.js";var vt=Object.defineProperty,ft=Object.getOwnPropertyDescriptor,m=(t,e,r,n)=>{for(var s=n>1?void 0:n?ft(e,r):e,p=t.length-1,h;p>=0;p--)(h=t[p])&&(s=(n?h(e,r,s):h(s))||s);return n&&s&&vt(e,r,s),s};let u=class extends N{constructor(){super(...arguments),this.caps=null,this.recorderId="",this.loaded=null,this.failed=!1,this.writesOn=!1,this.onPolicy=t=>{this.writesOn=t.detail.anyOn}}connectedCallback(){super.connectedCallback(),this.recorderId&&!this.caps&&this.load(),document.addEventListener("frigate-control-policy",this.onPolicy),this.recorderId&&!this.caps&&et(this.recorderId).then(t=>this.writesOn=st(t)).catch(()=>{})}disconnectedCallback(){document.removeEventListener("frigate-control-policy",this.onPolicy),super.disconnectedCallback()}async load(){try{this.loaded=await j(this.recorderId),this.failed=!1}catch{this.failed=!0}}render(){const t=this.caps??this.loaded,e=x.frigate.summary;if(!t)return this.failed?a`<div class="note" data-frigate-summary-failed><sw-icon name="info" size="14"></sw-icon><span>${e.unavailable}</span></div>`:o;const r=t.features,n=r?W.filter(s=>B.includes(s)||s in r):[];return a`<div class="box" data-frigate-summary>
      <h4>${e.title}</h4>
      <dl>
        ${A(t).map(s=>a`<dt>${s.label}</dt><dd data-frigate-row=${s.key} class=${s.key==="version"?"ltr":""}>${s.value}</dd>`)}
      </dl>
      ${r?a`<div>
        <h4>${e.features}</h4>
        <ul class="feats" data-frigate-features>
          ${n.map(s=>{const p=r[s]===!0;return a`<li class="feat" data-feature=${s} data-on=${String(p)} aria-label=${`${z(s)}: ${p?e.on:e.off}`}><sw-icon name=${p?"check":"close"} size="12"></sw-icon>${z(s)}</li>`})}
        </ul>
      </div>`:a`<div class="note" data-frigate-more-after-save><sw-icon name="info" size="14"></sw-icon><span>${e.moreAfterSave}</span></div>`}
      <div class="note" data-frigate-readonly><sw-icon name="info" size="14"></sw-icon><span>${this.writesOn?x.frigate.control.settings.summaryWrites:e.readOnly}${t.restream?"":` ${e.stillOnly}`}</span></div>
    </div>`}};u.styles=E`
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
  `;m([w({attribute:!1})],u.prototype,"caps",2);m([w({attribute:"recorder-id"})],u.prototype,"recorderId",2);m([d()],u.prototype,"loaded",2);m([d()],u.prototype,"failed",2);m([d()],u.prototype,"writesOn",2);u=m([R("frigate-summary")],u);var wt=Object.defineProperty,mt=Object.getOwnPropertyDescriptor,b=(t,e,r,n)=>{for(var s=n>1?void 0:n?mt(e,r):e,p=t.length-1,h;p>=0;p--)(h=t[p])&&(s=(n?h(e,r,s):h(s))||s);return n&&s&&wt(e,r,s),s};const bt=t=>{const e=new Date(t);return Number.isNaN(e.getTime())?t:e.toLocaleString(U(),{dateStyle:"short",timeStyle:"short"})};let v=class extends N{constructor(){super(...arguments),this.recorderId=S,this.view=null,this.busy=!1,this.confirmOpen=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}updated(t){t.has("recorderId")&&t.get("recorderId")!==void 0&&this.load()}async load(){try{this.view=await rt(this.recorderId),this.error=""}catch{this.view=null,this.error=""}}async apply(t){this.busy=!0,this.error="";try{this.view=await it(this.recorderId,t,t),this.confirmOpen=!1,this.dispatchEvent(new CustomEvent("writes-changed",{detail:{recorderId:this.recorderId,enabled:this.view.enabled},bubbles:!0,composed:!0}))}catch(e){this.error=f(e)}finally{this.busy=!1}}onToggle(t){const e=t.detail.checked,r=this.view;r&&(t.target.checked=r.enabled,e!==r.enabled&&(e?this.confirmOpen=!0:this.apply(!1)))}render(){const t=this.view;return!t||!t.supported?o:a`<div class="row" data-nvr-writes data-enabled=${t.enabled?"true":"false"}>
        <div class="txt">
          <span class="label">${I}</span>
          <span class="status" data-nvr-writes-status>${ct(t,bt)}</span>
          ${t.can_change?o:a`<span class="status" data-nvr-writes-readonly>${i("נדרשת הרשאת שינוי הגדרות NVR")}</span>`}
        </div>
        <sw-toggle label=${I} .labelHidden=${!0} data-nvr-writes-toggle .checked=${t.enabled} ?disabled=${!t.can_change||this.busy} @change=${e=>this.onToggle(e)}></sw-toggle>
      </div>
      ${this.error?a`<p class="err" role="alert" data-nvr-writes-error>${this.error}</p>`:o}
      ${this.confirmOpen?a`<sw-dialog open heading=${ht} data-nvr-writes-dialog ?locked=${this.busy} @close=${()=>this.confirmOpen=!1}>
            <ul class="points">${ut.map(e=>a`<li>${e}</li>`)}</ul>
            <div slot="footer">
              <sw-button variant="primary" data-nvr-writes-confirm ?disabled=${this.busy} @click=${()=>void this.apply(!0)}>${this.busy?i("מפעיל…"):pt}</sw-button>
              <sw-button variant="ghost" data-nvr-writes-cancel ?disabled=${this.busy} @click=${()=>this.confirmOpen=!1}>${i("ביטול")}</sw-button>
            </div>
          </sw-dialog>`:o}`}};v.styles=E`
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
  `;b([w({attribute:"recorder-id"})],v.prototype,"recorderId",2);b([d()],v.prototype,"view",2);b([d()],v.prototype,"busy",2);b([d()],v.prototype,"confirmOpen",2);b([d()],v.prototype,"error",2);v=b([R("nvr-writes-switch")],v);var gt=Object.defineProperty,$t=Object.getOwnPropertyDescriptor,c=(t,e,r,n)=>{for(var s=n>1?void 0:n?$t(e,r):e,p=t.length-1,h;p>=0;p--)(h=t[p])&&(s=(n?h(e,r,s):h(s))||s);return n&&s&&gt(e,r,s),s};const V=new Set(["host","http_port","rtsp_port","username","password"]),k={vendor:"",host:"",http_port:"",rtsp_port:"",username:"",password:"",extra:{}},O={source_forbidden:i("שם משתמש או סיסמה שגויים"),source_unavailable:i("לא ניתן להתחבר"),timeout:i("לא ניתן להתחבר"),source_error:i("לא ניתן להתחבר"),host_refused:i("כתובת לא מותרת"),port_refused:i("פורט לא מותר"),username_invalid:i("שם משתמש לא תקין"),password_required:i("יש להזין את הסיסמה מחדש"),tls_pin_mismatch:i("תעודת ה־NVR אינה התעודה שננעצה"),tls_pin_required:i("יש לנעוץ את תעודת ה־NVR לפני השמירה"),auth_scheme_unsupported:i("שיטת האימות של ה־NVR אינה נתמכת"),auth_downgrade_refused:i("ה־NVR ביקש שיטת אימות חלשה מבעבר. בחרו את שיטת האימות במפורש")},F={basic_over_http:i("הסיסמה נשלחת בלי הצפנה (Basic על HTTP). מומלץ לבחור HTTPS."),tls_trust_any:i("תעודת ה־HTTPS אינה נבדקת. מומלץ לנעוץ את תעודת המכשיר."),vendor_auth_version:i("המכשיר מבקש גרסת אימות של היצרן שאינה נתמכת. אם הכניסה נכשלת, החליפו בשרת ה־API של המכשיר את סוג ההצפנה.")},yt=new Set(["host_refused","host_invalid","port_refused","port_invalid","username_invalid","username_required","password_required"]),_t=new Set(["source_unavailable","timeout"]);let l=class extends N{constructor(){super(...arguments),this.context="settings",this.recorderId=S,this.prefill=null,this.addName="",this.loadState="loading",this.loadError="",this.view=null,this.vendors=[],this.draft={...k},this.editing=!1,this.changePassword=!1,this.busy="",this.msg=null,this.testLine=null,this.offerUntested=!1,this.untestedOpen=!1,this.removeOpen=!1,this.word="",this.lockedByServer=!1,this.stale=!1,this.invalidField="",this.lastTest=null,this.dismissed=[],this.advancedOpen=!1,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.requestUpdate()}get btn(){return this.mq.matches?"lg":"sm"}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}connectedCallback(){super.connectedCallback(),this.mq.addEventListener("change",this.onMq),P()&&T("system.configure")&&!C()&&this.load()}async load(){this.loadState="loading";try{const[t,e]=await Promise.all([M(),this.loadView()]);this.vendors=t,this.view=e,this.loadError="",this.lockedByServer=!1,this.stale=!1,this.invalidField="",this.loadState="ready",this.editing=this.context!=="settings"||!e.vendor||e.state==="not_chosen"||e.state==="unreadable"||e.state==="refused",this.seed()}catch(t){this.loadError=f(t),this.loadState="error"}}get primary(){return this.context!=="add"&&this.recorderId===S}loadView(){return this.context==="add"?Promise.resolve({vendor:null,host:null,http_port:null,rtsp_port:null,username:null,user:null,extra:{},has_password:!1,state:"not_chosen",source:null,revision:0,updated_at:null,updated_by:null,pending_restart:!1,legacy_options_differ:!1,in_addon:!1,restart:"manual",cameras:0,vendor_locked:!1}):this.primary?X():at(this.recorderId)}seed(){const t=this.view,e=t?.vendor&&this.vendors.some(n=>n.id===t.vendor);this.draft=e&&t?{vendor:String(t.vendor),host:t.host??"",http_port:t.http_port?String(t.http_port):"",rtsp_port:t.rtsp_port?String(t.rtsp_port):"",username:t.username??"",password:"",extra:{...t.extra??{}}}:{...k,extra:{}},this.changePassword=!1,this.testLine=null,this.offerUntested=!1;const r=this.context==="add"?this.prefill:null;r&&(this.draft={...this.draft,host:r.host,http_port:r.http_port?String(r.http_port):""},r.vendor&&this.chooseVendor(r.vendor),this.addName=r.name??"")}get spec(){return this.vendors.find(t=>t.id===this.draft.vendor)}label(t){return t?this.vendors.find(e=>e.id===t)?.label??t:"—"}setDraft(t){this.draft={...this.draft,...t},this.testLine=null,this.offerUntested=!1,this.msg=null,this.invalidField="",this.lastTest=null}fieldError(t){if(!(t instanceof g)||!yt.has(t.code))return null;const e=Y(t)[0]??"";return t.code==="password_required"&&(this.changePassword=!0,this.draft={...this.draft,password:""}),this.invalidField=e,O[t.code]??f(t)}isStale(t){return t instanceof g&&(t.code==="stale"||t.code==="revision_required")}chooseVendor(t){const e=this.vendors.find(s=>s.id===t);if(!e||e.status!=="available")return;const r=this.draft,n={...r.extra};for(const s of e.fields)s.kind==="select"&&n[s.key]===void 0&&s.options?.length&&(n[s.key]=s.options[0][0]);this.setDraft({vendor:t,http_port:r.http_port||(e.default_ports.http_port?String(e.default_ports.http_port):""),rtsp_port:r.rtsp_port||(e.default_ports.rtsp_port?String(e.default_ports.rtsp_port):""),extra:n})}get keepsStoredPassword(){const t=this.view;if(!t?.has_password||t.vendor!==this.draft.vendor||this.changePassword)return!1;const e=this.draft;return e.host.trim()===(t.host??"")&&e.http_port.trim()===String(t.http_port??"")&&e.rtsp_port.trim()===String(t.rtsp_port??"")}body(){const t=this.draft;if(t.vendor==="none")return{vendor:"none"};const e={};for(const n of this.spec?.fields??[]){if(V.has(n.key))continue;const s=t.extra[n.key];s!==void 0&&s!==""&&(e[n.key]=s)}const r=n=>n.trim()===""?null:Number(n);return{vendor:t.vendor,host:t.host.trim(),http_port:r(t.http_port),rtsp_port:r(t.rtsp_port),username:t.username.trim(),...t.password?{password:t.password}:{},...Object.keys(e).length?{extra:e}:{}}}get complete(){const t=this.draft;if(!t.vendor||this.context==="add"&&(!this.addName.trim()||t.vendor==="none"))return!1;if(t.vendor==="none")return!0;for(const e of this.spec?.fields??[])if(e.required)if(e.key==="password"){if(!t.password&&!this.keepsStoredPassword)return!1}else{if(e.key==="host"&&!t.host.trim())return!1;if(e.key==="username"&&!t.username.trim())return!1;if(!V.has(e.key)&&(t.extra[e.key]===void 0||t.extra[e.key]===""))return!1}return!0}testText(t){return t.ok?[i("מחובר"),t.model,t.channels!=null?i("{n} ערוצים",{n:t.channels}):null].filter(Boolean).join(" · "):t.code==="nvr_not_supported"?`${i("גרסת Frigate {version} אינה נתמכת",{version:t.firmware??""})}${t.min_version?` ${i("(נדרשת {version} ומעלה)",{version:t.min_version})}`:""}`.replace("  "," "):O[t.code]??i("לא ניתן להתחבר")}async runTest(){if(!(this.busy||!this.complete||this.draft.vendor==="none")){this.busy="test",this.msg=null,this.offerUntested=!1;try{const t={...this.body(),use_stored_password:this.keepsStoredPassword},e=this.primary||this.context==="add"?await G(this.context==="add"?{...t,use_stored_password:!1}:t):await nt(this.recorderId,t);this.testLine={ok:e.ok,text:this.testText(e)},this.offerUntested=!e.ok&&_t.has(e.code),this.lastTest=e}catch(t){const e=t instanceof g?t.code:"";this.testLine={ok:!1,text:this.fieldError(t)??O[e]??f(t)}}finally{this.busy=""}}}async save(t=!1){if(!(this.busy||!this.complete)&&!(t&&!_("nvr_save_untested",this.word))){this.busy="save",this.msg=null,this.testLine=null;try{const e=t?{save_untested:!0,confirm_text:this.word.trim()}:{};if(this.context==="add"){const s=await ot({...this.body(),name:this.addName.trim(),...e});this.untestedOpen=!1,this.word="",this.draft={...k,extra:{}},this.addName="",this.msg={tone:"ok",text:s.untested?i("נוסף בלי בדיקת חיבור"):[i("נוסף"),s.device?.model].filter(Boolean).join(" · ")},y(!0),this.dispatchEvent(new CustomEvent("nvr-recorder-added",{bubbles:!0,composed:!0,detail:s}));return}const r={...this.body(),if_revision:this.view?.revision??0,...e},n=this.primary?await J(r):await dt(this.recorderId,r);if(n.new_recorder){this.untestedOpen=!1,this.word="",await this.load(),this.msg={tone:"ok",text:i("נשמר כ־NVR חדש")},y(!0),this.dispatchEvent(new CustomEvent("nvr-connection-saved",{bubbles:!0,composed:!0,detail:n}));return}this.view=n,this.editing=this.context==="wizard",this.untestedOpen=!1,this.word="",this.seed(),this.msg={tone:"ok",text:n.vendor==="none"?i("נשמר: ללא NVR"):n.untested?i("נשמר בלי בדיקת חיבור"):[i("החיבור נבדק ונשמר"),n.device?.model,n.device?.channels!=null?i("{n} ערוצים",{n:n.device.channels}):null].filter(Boolean).join(" · ")},y(!0),this.dispatchEvent(new CustomEvent("nvr-connection-saved",{bubbles:!0,composed:!0,detail:n}))}catch(e){this.untestedOpen=!1,this.word="";const r=this.fieldError(e);this.isStale(e)?(this.msg={tone:"err",text:f(e)},this.stale=!0):r?this.msg={tone:"err",text:r}:(e instanceof g&&e.code==="remove_first"&&(this.lockedByServer=!0),this.msg={tone:"err",text:f(e)},this.offerUntested=e instanceof g&&e.body.details?.can_save_untested===!0)}finally{this.busy=""}}}async removeNvr(){if(!(this.busy||!_("nvr_remove",this.word))){this.busy="remove",this.msg=null;try{this.primary?await K(this.word.trim(),this.view?.revision??0):await lt(this.recorderId,this.word.trim(),this.view?.revision??0),this.removeOpen=!1,this.word="",y(!0),await this.load(),this.msg={tone:"ok",text:i("ה־NVR הוסר")},this.dispatchEvent(new CustomEvent("nvr-connection-removed",{bubbles:!0,composed:!0}))}catch(t){this.removeOpen=!1,this.msg={tone:"err",text:f(t)},this.isStale(t)&&(this.stale=!0)}finally{this.busy=""}}}cancelEdit(){this.editing=!1,this.seed(),this.msg=null}summary(t){const e=t.vendor==="none",r=[[i("סוג"),e?i("ללא NVR"):this.label(t.vendor)]];return e||(r.push([i("כתובת · פורט HTTP · RTSP"),a`<span class="ltr">${t.host??"—"} · ${t.http_port??"—"} · ${t.rtsp_port??"—"}</span>`]),r.push([i("משתמש"),t.state==="unreadable"?i("יש להזין סיסמה מחדש"):a`<span class="ltr">${t.username??"—"}</span> · ${t.has_password?i("הוגדרה סיסמה"):i("חסרה סיסמה")}`,t.has_password?"ok":"warn"])),a`<div data-conn-summary>${r.map(([n,s,p])=>a`<div class="row"><span>${n}</span><span class=${`val ${p??""}`}>${s}</span></div>`)}</div>`}field(t){const e=this.draft,r=t.key;if(r==="password")return this.passwordField(t);if(t.kind==="select"){const h=String(e.extra[r]??t.options?.[0]?.[0]??"");return a`<sw-field label=${t.label}><select data-conn-field=${r} @change=${$=>this.setDraft({extra:{...e.extra,[r]:$.target.value}})}>
        ${(t.options??[]).map(([$,q])=>a`<option value=${$} ?selected=${$===h}>${q}</option>`)}
      </select></sw-field>`}if(t.kind==="bool")return a`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t.label} data-conn-field=${r} .checked=${e.extra[r]===!0} @change=${h=>this.setDraft({extra:{...e.extra,[r]:Q(h)}})}></sw-toggle>${t.label}</label>`;const n=t.kind==="port",s=r==="host"?e.host:r==="http_port"?e.http_port:r==="rtsp_port"?e.rtsp_port:r==="username"?e.username:String(e.extra[r]??""),p=h=>this.setDraft(r==="host"?{host:h}:r==="http_port"?{http_port:h}:r==="rtsp_port"?{rtsp_port:h}:r==="username"?{username:h}:{extra:{...e.extra,[r]:h}});return a`<sw-field label=${t.label}><input data-ltr data-conn-field=${r} aria-invalid=${this.invalidField===r?"true":"false"} type=${n?"number":"text"} inputmode=${n?"numeric":"text"} autocomplete="off" autocapitalize="off" spellcheck="false" .value=${s} @input=${h=>p(h.target.value)} /></sw-field>`}passwordField(t){return this.keepsStoredPassword?a`<div class="pwset" data-conn-password-set><span>${t.label}: ${i("הוגדרה סיסמה")}</span><button type="button" class="linkbtn" data-conn-password-change @click=${()=>this.changePassword=!0}>${i("שנה")}</button></div>`:a`<sw-field label=${t.label}><input type="password" data-ltr data-conn-field="password" data-conn-password aria-invalid=${this.invalidField==="password"?"true":"false"} autocomplete="new-password" .value=${this.draft.password} @input=${e=>this.setDraft({password:e.target.value})} /></sw-field>`}visibleFields(t){const e=this.draft.extra.scheme==="https";return t.fields.filter(r=>e||!["https_port","tls_mode","tls_pin","suppress_tls_warning"].includes(r.key))}testExtras(){const t=this.lastTest;if(!t)return o;const e=(t.warnings??[]).filter(s=>F[s]&&!this.dismissed.includes(s)),r=t.certificate,n=this.draft.extra.tls_pin&&r&&this.draft.extra.tls_pin===r.sha256;return a`${this.draft.vendor==="frigate"&&t.ok?a`<frigate-summary .caps=${t.capabilities??Z(t)}></frigate-summary>`:o}${e.map(s=>a`<div class="note warn warnrow" role="note" data-conn-warning=${s}><span>${F[s]}</span>
        <button type="button" class="linkbtn" aria-label=${i("סגור")} data-conn-warning-dismiss=${s} @click=${()=>this.dismissed=[...this.dismissed,s]}>×</button></div>`)}
      ${r?a`<div class="note cert" data-conn-certificate>
          <span>${i("תעודת המכשיר")}${r.self_signed?` ${i("(חתומה עצמית)")}`:""}: <span class="ltr mono">${r.sha256.slice(0,16)}…</span>${r.matches_pin===!1?a` · <b>${i("שונה מהתעודה שננעצה")}</b>`:o}</span>
          ${n?a`<span class="ok">${i("ננעצה")}</span>`:a`<button type="button" class="linkbtn" data-conn-pin @click=${()=>this.setDraft({extra:{...this.draft.extra,tls_mode:"pin",tls_pin:r.sha256}})}>${i("נעץ תעודה זו")}</button>`}
        </div>`:o}`}form(t){const e=this.draft,r=this.spec,n=t.vendor_locked||this.lockedByServer;return a`<div class="form" data-nvr-connection-form>
      ${this.context==="add"?a`<sw-field label=${i("שם")}><input data-conn-name maxlength="60" autocomplete="off" .value=${this.addName} @input=${s=>{this.addName=s.target.value,this.msg=null}} /></sw-field>`:o}
      <sw-field label=${i("סוג NVR")}>
        <select data-conn-vendor ?disabled=${t.vendor_locked||this.busy!==""} @change=${s=>this.chooseVendor(s.target.value)}>
          <option value="" disabled ?selected=${!e.vendor}>${i("בחרו סוג NVR")}</option>
          ${this.vendors.filter(s=>this.primary||s.id!=="none").map(s=>a`<option value=${s.id} ?disabled=${s.status!=="available"} ?selected=${s.id===e.vendor}>${s.label}${s.status!=="available"?` · ${i("בקרוב")}`:""}</option>`)}
        </select>
      </sw-field>
      ${n?a`<div class="note" data-conn-vendor-locked>${i("יש להסיר את ה־NVR לפני החלפת סוג")}</div>`:o}
      ${t.state==="unreadable"?a`<div class="note warn" data-conn-unreadable>${i("יש להזין סיסמה מחדש")}</div>`:o}
      ${t.state==="refused"?a`<div class="note warn" data-conn-refused>${i("הכתובת השמורה אינה מותרת - יש להזין כתובת מחדש")}</div>`:o}
      ${r&&r.fields.length?a`<div class="grid">${this.visibleFields(r).filter(s=>!s.advanced).map(s=>this.field(s))}</div>`:o}
      ${r&&r.fields.some(s=>s.advanced)?a`<details class="adv" data-conn-advanced ?open=${this.advancedOpen} @toggle=${s=>this.advancedOpen=s.target.open}>
          <summary>${i("הגדרות מתקדמות")}</summary><div class="grid">${this.visibleFields(r).filter(s=>s.advanced).map(s=>this.field(s))}</div></details>`:o}
      ${this.testLine?a`<div class=${`line ${this.testLine.ok?"ok":"err"}`} role="status" data-conn-test-result data-ok=${String(this.testLine.ok)}>${this.testLine.text}</div>`:o}
      ${this.testExtras()}
      ${e.vendor==="frigate"?a`<div class="note" data-conn-frigate-hint>${x.frigate.summary.viewerHint} ${x.frigate.summary.linkHint}</div>`:o}
      <div class="actions">
        ${e.vendor&&e.vendor!=="none"?a`<sw-button size=${this.btn} icon="activity" ?disabled=${!this.complete||this.busy!==""} data-conn-test @click=${()=>this.runTest()}>${this.busy==="test"?i("בודק…"):i("בדוק חיבור")}</sw-button>`:o}
        <sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${!this.complete||this.busy!==""||this.stale} data-conn-save @click=${()=>this.save()}>${this.busy==="save"?i("שומר…"):this.context==="add"?i("הוסף"):i("שמור")}</sw-button>
        ${this.offerUntested?a`<sw-button size=${this.btn} variant="ghost" data-conn-save-anyway ?disabled=${this.busy!==""} @click=${()=>{this.word="",this.untestedOpen=!0}}>${i("שמור בכל זאת")}</sw-button>`:o}
        ${this.context==="settings"&&!(this.view?.state==="not_chosen"||!this.view?.vendor)?a`<sw-button size=${this.btn} variant="ghost" ?disabled=${this.busy!==""} data-conn-cancel @click=${()=>this.cancelEdit()}>${i("ביטול")}</sw-button>`:o}
      </div>
    </div>`}render(){if(!P()||!T("system.configure"))return o;if(C())return a`<p class="note" data-nvr-local-only role="status">${tt}</p>`;if(this.loadState==="loading")return a`<sw-state-panel state="loading" compact heading=${i("קורא את פרטי החיבור…")}></sw-state-panel>`;if(this.loadState==="error"||!this.view)return a`<sw-state-panel state="error" compact heading=${i("פרטי החיבור לא נטענו")} hint=${this.loadError} actionLabel=${i("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;const t=this.view,e=!!t.vendor&&t.state!=="not_chosen";return a`<div class="wrap" data-conn-form-root data-conn-state=${t.state}>
      ${!this.editing&&e?this.summary(t):o}
      ${!this.editing&&e&&this.context==="settings"&&(t.vendor==="hikvision"||t.vendor==="provision_isr")?a`<nvr-writes-switch recorder-id=${this.recorderId}></nvr-writes-switch>`:o}
      ${t.legacy_options_differ&&!this.editing?a`<div class="note" data-conn-legacy>${i("פרטי חיבור ישנים בתשתית המערכת אינם בשימוש")}</div>`:o}
      ${this.editing?this.form(t):a`<div class="actions">
          <sw-button size=${this.btn} icon="edit" data-conn-edit @click=${()=>{this.seed(),this.editing=!0,this.msg=null}}>${i("עריכה")}</sw-button>
          ${t.vendor&&t.vendor!=="none"?a`<sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove @click=${()=>{this.word="",this.removeOpen=!0}}>${i("הסר NVR")}</sw-button>`:o}
        </div>`}
      ${this.editing&&e&&t.vendor!=="none"&&this.context==="settings"?a`<div class="actions"><sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove ?disabled=${this.busy!==""} @click=${()=>{this.word="",this.removeOpen=!0}}>${i("הסר NVR")}</sw-button></div>`:o}
      ${this.msg?a`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-conn-msg>${this.msg.text}</div>`:o}
      ${this.stale?a`<div class="actions"><sw-button size=${this.btn} icon="refresh" data-conn-reload @click=${()=>void this.load()}>${i("טען מחדש")}</sw-button></div>`:o}
      ${this.untestedOpen?a`<sw-dialog open heading=${i("שמירה בלי בדיקת חיבור")} subheading=${i("לא ניתן להתחבר ל־NVR כרגע")} data-conn-untested-dialog @close=${()=>this.untestedOpen=!1}>
            <sw-field label=${i("לאישור הקלידו „{word}”",{word:L("nvr_save_untested")})}><input data-ltr data-conn-untested-word autocomplete="off" .value=${this.word} @input=${r=>this.word=r.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.busy!==""||!_("nvr_save_untested",this.word)} data-conn-untested-confirm @click=${()=>this.save(!0)}>${this.busy==="save"?i("שומר…"):i("שמור")}</sw-button><sw-button variant="ghost" @click=${()=>this.untestedOpen=!1}>${i("ביטול")}</sw-button></div>
          </sw-dialog>`:o}
      ${this.removeOpen?a`<sw-dialog open heading=${i("הסרת NVR")} subheading=${i("המצלמות יישארו במערכת ויושבתו")} data-conn-remove-dialog @close=${()=>this.removeOpen=!1}>
            <sw-field label=${i("להסרה הקלידו „{word}”",{word:L("nvr_remove")})}><input data-ltr data-conn-remove-word autocomplete="off" .value=${this.word} @input=${r=>this.word=r.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.busy!==""||!_("nvr_remove",this.word)} data-conn-remove-confirm @click=${()=>this.removeNvr()}>${this.busy==="remove"?i("מסיר…"):i("הסר NVR")}</sw-button><sw-button variant="ghost" @click=${()=>this.removeOpen=!1}>${i("ביטול")}</sw-button></div>
          </sw-dialog>`:o}
    </div>`}};l.styles=E`
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
    ${H}
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
      input,
      select {
        min-block-size: 44px;
      }
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;c([w()],l.prototype,"context",2);c([w({attribute:"recorder-id"})],l.prototype,"recorderId",2);c([w({attribute:!1})],l.prototype,"prefill",2);c([d()],l.prototype,"addName",2);c([d()],l.prototype,"loadState",2);c([d()],l.prototype,"loadError",2);c([d()],l.prototype,"view",2);c([d()],l.prototype,"vendors",2);c([d()],l.prototype,"draft",2);c([d()],l.prototype,"editing",2);c([d()],l.prototype,"changePassword",2);c([d()],l.prototype,"busy",2);c([d()],l.prototype,"msg",2);c([d()],l.prototype,"testLine",2);c([d()],l.prototype,"offerUntested",2);c([d()],l.prototype,"untestedOpen",2);c([d()],l.prototype,"removeOpen",2);c([d()],l.prototype,"word",2);c([d()],l.prototype,"lockedByServer",2);c([d()],l.prototype,"stale",2);c([d()],l.prototype,"invalidField",2);c([d()],l.prototype,"lastTest",2);c([d()],l.prototype,"dismissed",2);c([d()],l.prototype,"advancedOpen",2);l=c([R("nvr-connection-form")],l);export{l as NvrConnectionForm};
