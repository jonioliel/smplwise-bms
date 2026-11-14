import{E as S,F as b,G as o,a as R,v9 as D,jE as $,A as n,e as r,va as j,vb as z,vc as A,vd as q,H as N,Y as v,i as P,be as T,jn as C,ve as W,vf as U,j as m,vg as B,vh as _,uR as y,vi as H,vj as x,vk as M,vl as Y,uS as G}from"./index-Cx0qJkOE.js";import{j as X,a2 as J}from"./frigate-control-kACtElQW.js";import{P as E,r as K,a as Q,b as Z,t as tt,d as et,e as st,f as it}from"./recorders-BgJ4A6B2.js";import{W as I,w as rt,a as at,b as nt,c as ot}from"./nvr-h264-preset-CWl-CnDx.js";var dt=Object.defineProperty,lt=Object.getOwnPropertyDescriptor,f=(t,e,i,a)=>{for(var s=a>1?void 0:a?lt(e,i):e,h=t.length-1,c;h>=0;h--)(c=t[h])&&(s=(a?c(e,i,s):c(s))||s);return a&&s&&dt(e,i,s),s};let p=class extends R{constructor(){super(...arguments),this.caps=null,this.recorderId="",this.loaded=null,this.failed=!1,this.writesOn=!1,this.onPolicy=t=>{this.writesOn=t.detail.anyOn}}connectedCallback(){super.connectedCallback(),this.recorderId&&!this.caps&&this.load(),document.addEventListener("frigate-control-policy",this.onPolicy),this.recorderId&&!this.caps&&X(this.recorderId).then(t=>this.writesOn=J(t)).catch(()=>{})}disconnectedCallback(){document.removeEventListener("frigate-control-policy",this.onPolicy),super.disconnectedCallback()}async load(){try{this.loaded=await D(this.recorderId),this.failed=!1}catch{this.failed=!0}}render(){const t=this.caps??this.loaded,e=$.frigate.summary;if(!t)return this.failed?r`<div class="note" data-frigate-summary-failed><sw-icon name="info" size="14"></sw-icon><span>${e.unavailable}</span></div>`:n;const i=t.features,a=i?A.filter(s=>q.includes(s)||s in i):[];return r`<div class="box" data-frigate-summary>
      <h4>${e.title}</h4>
      <dl>
        ${j(t).map(s=>r`<dt>${s.label}</dt><dd data-frigate-row=${s.key} class=${s.key==="version"?"ltr":""}>${s.value}</dd>`)}
      </dl>
      ${i?r`<div>
        <h4>${e.features}</h4>
        <ul class="feats" data-frigate-features>
          ${a.map(s=>{const h=i[s]===!0;return r`<li class="feat" data-feature=${s} data-on=${String(h)} aria-label=${`${z(s)}: ${h?e.on:e.off}`}><sw-icon name=${h?"check":"close"} size="12"></sw-icon>${z(s)}</li>`})}
        </ul>
      </div>`:r`<div class="note" data-frigate-more-after-save><sw-icon name="info" size="14"></sw-icon><span>${e.moreAfterSave}</span></div>`}
      <div class="note" data-frigate-readonly><sw-icon name="info" size="14"></sw-icon><span>${this.writesOn?$.frigate.control.settings.summaryWrites:e.readOnly}${t.restream?"":` ${e.stillOnly}`}</span></div>
    </div>`}};p.styles=S`
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
  `;f([b({attribute:!1})],p.prototype,"caps",2);f([b({attribute:"recorder-id"})],p.prototype,"recorderId",2);f([o()],p.prototype,"loaded",2);f([o()],p.prototype,"failed",2);f([o()],p.prototype,"writesOn",2);p=f([N("frigate-summary")],p);var ct=Object.defineProperty,ht=Object.getOwnPropertyDescriptor,w=(t,e,i,a)=>{for(var s=a>1?void 0:a?ht(e,i):e,h=t.length-1,c;h>=0;h--)(c=t[h])&&(s=(a?c(e,i,s):c(s))||s);return a&&s&&ct(e,i,s),s};const pt=t=>{const e=new Date(t);return Number.isNaN(e.getTime())?t:e.toLocaleString("he-IL",{dateStyle:"short",timeStyle:"short"})};let u=class extends R{constructor(){super(...arguments),this.recorderId=E,this.view=null,this.busy=!1,this.confirmOpen=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}updated(t){t.has("recorderId")&&t.get("recorderId")!==void 0&&this.load()}async load(){try{this.view=await K(this.recorderId),this.error=""}catch{this.view=null,this.error=""}}async apply(t){this.busy=!0,this.error="";try{this.view=await Q(this.recorderId,t,t),this.confirmOpen=!1,this.dispatchEvent(new CustomEvent("writes-changed",{detail:{recorderId:this.recorderId,enabled:this.view.enabled},bubbles:!0,composed:!0}))}catch(e){this.error=v(e)}finally{this.busy=!1}}onToggle(t){const e=t.detail.checked,i=this.view;i&&(t.target.checked=i.enabled,e!==i.enabled&&(e?this.confirmOpen=!0:this.apply(!1)))}render(){const t=this.view;return!t||!t.supported?n:r`<div class="row" data-nvr-writes data-enabled=${t.enabled?"true":"false"}>
        <div class="txt">
          <span class="label">${I}</span>
          <span class="status" data-nvr-writes-status>${rt(t,pt)}</span>
          ${t.can_change?n:r`<span class="status" data-nvr-writes-readonly>נדרשת הרשאת שינוי הגדרות NVR</span>`}
        </div>
        <sw-toggle label=${I} .labelHidden=${!0} data-nvr-writes-toggle .checked=${t.enabled} ?disabled=${!t.can_change||this.busy} @change=${e=>this.onToggle(e)}></sw-toggle>
      </div>
      ${this.error?r`<p class="err" role="alert" data-nvr-writes-error>${this.error}</p>`:n}
      ${this.confirmOpen?r`<sw-dialog open heading=${at} data-nvr-writes-dialog ?locked=${this.busy} @close=${()=>this.confirmOpen=!1}>
            <ul class="points">${ot.map(e=>r`<li>${e}</li>`)}</ul>
            <div slot="footer">
              <sw-button variant="primary" data-nvr-writes-confirm ?disabled=${this.busy} @click=${()=>void this.apply(!0)}>${this.busy?"מפעיל…":nt}</sw-button>
              <sw-button variant="ghost" data-nvr-writes-cancel ?disabled=${this.busy} @click=${()=>this.confirmOpen=!1}>ביטול</sw-button>
            </div>
          </sw-dialog>`:n}`}};u.styles=S`
    :host {
      display: block;
      min-inline-size: 0;
    }
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
  `;w([b({attribute:"recorder-id"})],u.prototype,"recorderId",2);w([o()],u.prototype,"view",2);w([o()],u.prototype,"busy",2);w([o()],u.prototype,"confirmOpen",2);w([o()],u.prototype,"error",2);u=w([N("nvr-writes-switch")],u);var ut=Object.defineProperty,vt=Object.getOwnPropertyDescriptor,l=(t,e,i,a)=>{for(var s=a>1?void 0:a?vt(e,i):e,h=t.length-1,c;h>=0;h--)(c=t[h])&&(s=(a?c(e,i,s):c(s))||s);return a&&s&&ut(e,i,s),s};const L=new Set(["host","http_port","rtsp_port","username","password"]),k={vendor:"",host:"",http_port:"",rtsp_port:"",username:"",password:"",extra:{}},O={source_forbidden:"שם משתמש או סיסמה שגויים",source_unavailable:"לא ניתן להתחבר",timeout:"לא ניתן להתחבר",source_error:"לא ניתן להתחבר",host_refused:"כתובת לא מותרת",port_refused:"פורט לא מותר",username_invalid:"שם משתמש לא תקין",password_required:"יש להזין את הסיסמה מחדש",tls_pin_mismatch:"תעודת ה־NVR אינה התעודה שננעצה",tls_pin_required:"יש לנעוץ את תעודת ה־NVR לפני השמירה",auth_scheme_unsupported:"שיטת האימות של ה־NVR אינה נתמכת",auth_downgrade_refused:"ה־NVR ביקש שיטת אימות חלשה מבעבר. בחרו את שיטת האימות במפורש"},V={basic_over_http:"הסיסמה נשלחת בלי הצפנה (Basic על HTTP). מומלץ לבחור HTTPS.",tls_trust_any:"תעודת ה־HTTPS אינה נבדקת. מומלץ לנעוץ את תעודת המכשיר.",vendor_auth_version:"המכשיר מבקש גרסת אימות של היצרן שאינה נתמכת. אם הכניסה נכשלת, החליפו בשרת ה־API של המכשיר את סוג ההצפנה."},ft=new Set(["host_refused","host_invalid","port_refused","port_invalid","username_invalid","username_required","password_required"]),wt=new Set(["source_unavailable","timeout"]);let d=class extends R{constructor(){super(...arguments),this.context="settings",this.recorderId=E,this.addName="",this.loadState="loading",this.loadError="",this.view=null,this.vendors=[],this.draft={...k},this.editing=!1,this.changePassword=!1,this.busy="",this.msg=null,this.testLine=null,this.offerUntested=!1,this.untestedOpen=!1,this.removeOpen=!1,this.word="",this.lockedByServer=!1,this.stale=!1,this.invalidField="",this.lastTest=null,this.dismissed=[],this.advancedOpen=!1,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.requestUpdate()}get btn(){return this.mq.matches?"lg":"sm"}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}connectedCallback(){super.connectedCallback(),this.mq.addEventListener("change",this.onMq),P()&&T("system.configure")&&!C()&&this.load()}async load(){this.loadState="loading";try{const[t,e]=await Promise.all([W(),this.loadView()]);this.vendors=t,this.view=e,this.loadError="",this.lockedByServer=!1,this.stale=!1,this.invalidField="",this.loadState="ready",this.editing=this.context!=="settings"||!e.vendor||e.state==="not_chosen"||e.state==="unreadable"||e.state==="refused",this.seed()}catch(t){this.loadError=v(t),this.loadState="error"}}get primary(){return this.context!=="add"&&this.recorderId===E}loadView(){return this.context==="add"?Promise.resolve({vendor:null,host:null,http_port:null,rtsp_port:null,username:null,user:null,extra:{},has_password:!1,state:"not_chosen",source:null,revision:0,updated_at:null,updated_by:null,pending_restart:!1,legacy_options_differ:!1,in_addon:!1,restart:"manual",cameras:0,vendor_locked:!1}):this.primary?U():Z(this.recorderId)}seed(){const t=this.view,e=t?.vendor&&this.vendors.some(i=>i.id===t.vendor);this.draft=e&&t?{vendor:String(t.vendor),host:t.host??"",http_port:t.http_port?String(t.http_port):"",rtsp_port:t.rtsp_port?String(t.rtsp_port):"",username:t.username??"",password:"",extra:{...t.extra??{}}}:{...k,extra:{}},this.changePassword=!1,this.testLine=null,this.offerUntested=!1}get spec(){return this.vendors.find(t=>t.id===this.draft.vendor)}label(t){return t?this.vendors.find(e=>e.id===t)?.label??t:"—"}setDraft(t){this.draft={...this.draft,...t},this.testLine=null,this.offerUntested=!1,this.msg=null,this.invalidField="",this.lastTest=null}fieldError(t){if(!(t instanceof m)||!ft.has(t.code))return null;const e=typeof t.body.details?.field=="string"?t.body.details.field:"";return t.code==="password_required"&&(this.changePassword=!0,this.draft={...this.draft,password:""}),this.invalidField=e,O[t.code]??v(t)}isStale(t){return t instanceof m&&(t.code==="stale"||t.code==="revision_required")}chooseVendor(t){const e=this.vendors.find(s=>s.id===t);if(!e||e.status!=="available")return;const i=this.draft,a={...i.extra};for(const s of e.fields)s.kind==="select"&&a[s.key]===void 0&&s.options?.length&&(a[s.key]=s.options[0][0]);this.setDraft({vendor:t,http_port:i.http_port||(e.default_ports.http_port?String(e.default_ports.http_port):""),rtsp_port:i.rtsp_port||(e.default_ports.rtsp_port?String(e.default_ports.rtsp_port):""),extra:a})}get keepsStoredPassword(){const t=this.view;if(!t?.has_password||t.vendor!==this.draft.vendor||this.changePassword)return!1;const e=this.draft;return e.host.trim()===(t.host??"")&&e.http_port.trim()===String(t.http_port??"")&&e.rtsp_port.trim()===String(t.rtsp_port??"")}body(){const t=this.draft;if(t.vendor==="none")return{vendor:"none"};const e={};for(const a of this.spec?.fields??[]){if(L.has(a.key))continue;const s=t.extra[a.key];s!==void 0&&s!==""&&(e[a.key]=s)}const i=a=>a.trim()===""?null:Number(a);return{vendor:t.vendor,host:t.host.trim(),http_port:i(t.http_port),rtsp_port:i(t.rtsp_port),username:t.username.trim(),...t.password?{password:t.password}:{},...Object.keys(e).length?{extra:e}:{}}}get complete(){const t=this.draft;if(!t.vendor||this.context==="add"&&(!this.addName.trim()||t.vendor==="none"))return!1;if(t.vendor==="none")return!0;for(const e of this.spec?.fields??[])if(e.required)if(e.key==="password"){if(!t.password&&!this.keepsStoredPassword)return!1}else{if(e.key==="host"&&!t.host.trim())return!1;if(e.key==="username"&&!t.username.trim())return!1;if(!L.has(e.key)&&(t.extra[e.key]===void 0||t.extra[e.key]===""))return!1}return!0}testText(t){return t.ok?["מחובר",t.model,t.channels!=null?`${t.channels} ערוצים`:null].filter(Boolean).join(" · "):t.code==="nvr_not_supported"?`גרסת Frigate ${t.firmware??""} אינה נתמכת${t.min_version?` (נדרשת ${t.min_version} ומעלה)`:""}`.replace("  "," "):O[t.code]??"לא ניתן להתחבר"}async runTest(){if(!(this.busy||!this.complete||this.draft.vendor==="none")){this.busy="test",this.msg=null,this.offerUntested=!1;try{const t={...this.body(),use_stored_password:this.keepsStoredPassword},e=this.primary||this.context==="add"?await B(this.context==="add"?{...t,use_stored_password:!1}:t):await tt(this.recorderId,t);this.testLine={ok:e.ok,text:this.testText(e)},this.offerUntested=!e.ok&&wt.has(e.code),this.lastTest=e}catch(t){const e=t instanceof m?t.code:"";this.testLine={ok:!1,text:this.fieldError(t)??O[e]??v(t)}}finally{this.busy=""}}}async save(t=!1){if(!(this.busy||!this.complete)){this.busy="save",this.msg=null,this.testLine=null;try{const e=t?{save_untested:!0,confirm_text:_}:{};if(this.context==="add"){const s=await et({...this.body(),name:this.addName.trim(),...e});this.untestedOpen=!1,this.word="",this.draft={...k,extra:{}},this.addName="",this.msg={tone:"ok",text:s.untested?"נוסף בלי בדיקת חיבור":["נוסף",s.device?.model].filter(Boolean).join(" · ")},y(!0),this.dispatchEvent(new CustomEvent("nvr-recorder-added",{bubbles:!0,composed:!0,detail:s}));return}const i={...this.body(),if_revision:this.view?.revision??0,...e},a=this.primary?await H(i):await st(this.recorderId,i);if(a.new_recorder){this.untestedOpen=!1,this.word="",await this.load(),this.msg={tone:"ok",text:"נשמר כ־NVR חדש"},y(!0),this.dispatchEvent(new CustomEvent("nvr-connection-saved",{bubbles:!0,composed:!0,detail:a}));return}this.view=a,this.editing=this.context==="wizard",this.untestedOpen=!1,this.word="",this.seed(),this.msg={tone:"ok",text:a.vendor==="none"?"נשמר: ללא NVR":a.untested?"נשמר בלי בדיקת חיבור":["החיבור נבדק ונשמר",a.device?.model,a.device?.channels!=null?`${a.device.channels} ערוצים`:null].filter(Boolean).join(" · ")},y(!0),this.dispatchEvent(new CustomEvent("nvr-connection-saved",{bubbles:!0,composed:!0,detail:a}))}catch(e){this.untestedOpen=!1,this.word="";const i=this.fieldError(e);this.isStale(e)?(this.msg={tone:"err",text:v(e)},this.stale=!0):i?this.msg={tone:"err",text:i}:(e instanceof m&&e.code==="remove_first"&&(this.lockedByServer=!0),this.msg={tone:"err",text:v(e)},this.offerUntested=e instanceof m&&e.body.details?.can_save_untested===!0)}finally{this.busy=""}}}async removeNvr(){if(!(this.busy||this.word.trim()!==x)){this.busy="remove",this.msg=null;try{this.primary?await M(this.word.trim(),this.view?.revision??0):await it(this.recorderId,this.word.trim(),this.view?.revision??0),this.removeOpen=!1,this.word="",y(!0),await this.load(),this.msg={tone:"ok",text:"ה־NVR הוסר"},this.dispatchEvent(new CustomEvent("nvr-connection-removed",{bubbles:!0,composed:!0}))}catch(t){this.removeOpen=!1,this.msg={tone:"err",text:v(t)},this.isStale(t)&&(this.stale=!0)}finally{this.busy=""}}}cancelEdit(){this.editing=!1,this.seed(),this.msg=null}summary(t){const e=t.vendor==="none",i=[["סוג",e?"ללא NVR":this.label(t.vendor)]];return e||(i.push(["כתובת · פורט HTTP · RTSP",r`<span class="ltr">${t.host??"—"} · ${t.http_port??"—"} · ${t.rtsp_port??"—"}</span>`]),i.push(["משתמש",t.state==="unreadable"?"יש להזין סיסמה מחדש":r`<span class="ltr">${t.username??"—"}</span> · ${t.has_password?"הוגדרה סיסמה":"חסרה סיסמה"}`,t.has_password?"ok":"warn"])),r`<div data-conn-summary>${i.map(([a,s,h])=>r`<div class="row"><span>${a}</span><span class=${`val ${h??""}`}>${s}</span></div>`)}</div>`}field(t){const e=this.draft,i=t.key;if(i==="password")return this.passwordField(t);if(t.kind==="select"){const c=String(e.extra[i]??t.options?.[0]?.[0]??"");return r`<sw-field label=${t.label}><select data-conn-field=${i} @change=${g=>this.setDraft({extra:{...e.extra,[i]:g.target.value}})}>
        ${(t.options??[]).map(([g,F])=>r`<option value=${g} ?selected=${g===c}>${F}</option>`)}
      </select></sw-field>`}if(t.kind==="bool")return r`<label class="chk"><input type="checkbox" data-conn-field=${i} .checked=${e.extra[i]===!0} @change=${c=>this.setDraft({extra:{...e.extra,[i]:c.target.checked}})} />${t.label}</label>`;const a=t.kind==="port",s=i==="host"?e.host:i==="http_port"?e.http_port:i==="rtsp_port"?e.rtsp_port:i==="username"?e.username:String(e.extra[i]??""),h=c=>this.setDraft(i==="host"?{host:c}:i==="http_port"?{http_port:c}:i==="rtsp_port"?{rtsp_port:c}:i==="username"?{username:c}:{extra:{...e.extra,[i]:c}});return r`<sw-field label=${t.label}><input data-ltr data-conn-field=${i} aria-invalid=${this.invalidField===i?"true":"false"} type=${a?"number":"text"} inputmode=${a?"numeric":"text"} autocomplete="off" autocapitalize="off" spellcheck="false" .value=${s} @input=${c=>h(c.target.value)} /></sw-field>`}passwordField(t){return this.keepsStoredPassword?r`<div class="pwset" data-conn-password-set><span>${t.label}: הוגדרה סיסמה</span><button type="button" class="linkbtn" data-conn-password-change @click=${()=>this.changePassword=!0}>שנה</button></div>`:r`<sw-field label=${t.label}><input type="password" data-ltr data-conn-field="password" data-conn-password aria-invalid=${this.invalidField==="password"?"true":"false"} autocomplete="new-password" .value=${this.draft.password} @input=${e=>this.setDraft({password:e.target.value})} /></sw-field>`}visibleFields(t){const e=this.draft.extra.scheme==="https";return t.fields.filter(i=>e||!["https_port","tls_mode","tls_pin","suppress_tls_warning"].includes(i.key))}testExtras(){const t=this.lastTest;if(!t)return n;const e=(t.warnings??[]).filter(s=>V[s]&&!this.dismissed.includes(s)),i=t.certificate,a=this.draft.extra.tls_pin&&i&&this.draft.extra.tls_pin===i.sha256;return r`${this.draft.vendor==="frigate"&&t.ok?r`<frigate-summary .caps=${t.capabilities??Y(t)}></frigate-summary>`:n}${e.map(s=>r`<div class="note warn warnrow" role="note" data-conn-warning=${s}><span>${V[s]}</span>
        <button type="button" class="linkbtn" aria-label="סגור" data-conn-warning-dismiss=${s} @click=${()=>this.dismissed=[...this.dismissed,s]}>×</button></div>`)}
      ${i?r`<div class="note cert" data-conn-certificate>
          <span>תעודת המכשיר${i.self_signed?" (חתומה עצמית)":""}: <span class="ltr mono">${i.sha256.slice(0,16)}…</span>${i.matches_pin===!1?r` · <b>שונה מהתעודה שננעצה</b>`:n}</span>
          ${a?r`<span class="ok">ננעצה</span>`:r`<button type="button" class="linkbtn" data-conn-pin @click=${()=>this.setDraft({extra:{...this.draft.extra,tls_mode:"pin",tls_pin:i.sha256}})}>נעץ תעודה זו</button>`}
        </div>`:n}`}form(t){const e=this.draft,i=this.spec,a=t.vendor_locked||this.lockedByServer;return r`<div class="form" data-nvr-connection-form>
      ${this.context==="add"?r`<sw-field label="שם"><input data-conn-name maxlength="60" autocomplete="off" .value=${this.addName} @input=${s=>{this.addName=s.target.value,this.msg=null}} /></sw-field>`:n}
      <sw-field label="סוג NVR">
        <select data-conn-vendor ?disabled=${t.vendor_locked||this.busy!==""} @change=${s=>this.chooseVendor(s.target.value)}>
          <option value="" disabled ?selected=${!e.vendor}>בחרו סוג NVR</option>
          ${this.vendors.filter(s=>this.primary||s.id!=="none").map(s=>r`<option value=${s.id} ?disabled=${s.status!=="available"} ?selected=${s.id===e.vendor}>${s.label}${s.status!=="available"?" · בקרוב":""}</option>`)}
        </select>
      </sw-field>
      ${a?r`<div class="note" data-conn-vendor-locked>יש להסיר את ה־NVR לפני החלפת סוג</div>`:n}
      ${t.state==="unreadable"?r`<div class="note warn" data-conn-unreadable>יש להזין סיסמה מחדש</div>`:n}
      ${t.state==="refused"?r`<div class="note warn" data-conn-refused>הכתובת השמורה אינה מותרת - יש להזין כתובת מחדש</div>`:n}
      ${i&&i.fields.length?r`<div class="grid">${this.visibleFields(i).filter(s=>!s.advanced).map(s=>this.field(s))}</div>`:n}
      ${i&&i.fields.some(s=>s.advanced)?r`<details class="adv" data-conn-advanced ?open=${this.advancedOpen} @toggle=${s=>this.advancedOpen=s.target.open}>
          <summary>הגדרות מתקדמות</summary><div class="grid">${this.visibleFields(i).filter(s=>s.advanced).map(s=>this.field(s))}</div></details>`:n}
      ${this.testLine?r`<div class=${`line ${this.testLine.ok?"ok":"err"}`} role="status" data-conn-test-result data-ok=${String(this.testLine.ok)}>${this.testLine.text}</div>`:n}
      ${this.testExtras()}
      ${e.vendor==="frigate"?r`<div class="note" data-conn-frigate-hint>${$.frigate.summary.viewerHint} ${$.frigate.summary.linkHint}</div>`:n}
      <div class="actions">
        ${e.vendor&&e.vendor!=="none"?r`<sw-button size=${this.btn} icon="activity" ?disabled=${!this.complete||this.busy!==""} data-conn-test @click=${()=>this.runTest()}>${this.busy==="test"?"בודק…":"בדוק חיבור"}</sw-button>`:n}
        <sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${!this.complete||this.busy!==""||this.stale} data-conn-save @click=${()=>this.save()}>${this.busy==="save"?"שומר…":this.context==="add"?"הוסף":"שמור"}</sw-button>
        ${this.offerUntested?r`<sw-button size=${this.btn} variant="ghost" data-conn-save-anyway ?disabled=${this.busy!==""} @click=${()=>{this.word="",this.untestedOpen=!0}}>שמור בכל זאת</sw-button>`:n}
        ${this.context==="settings"&&!(this.view?.state==="not_chosen"||!this.view?.vendor)?r`<sw-button size=${this.btn} variant="ghost" ?disabled=${this.busy!==""} data-conn-cancel @click=${()=>this.cancelEdit()}>ביטול</sw-button>`:n}
      </div>
    </div>`}render(){if(!P()||!T("system.configure"))return n;if(C())return r`<p class="note" data-nvr-local-only role="status">${G}</p>`;if(this.loadState==="loading")return r`<sw-state-panel state="loading" compact heading="קורא את פרטי החיבור…"></sw-state-panel>`;if(this.loadState==="error"||!this.view)return r`<sw-state-panel state="error" compact heading="פרטי החיבור לא נטענו" hint=${this.loadError} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;const t=this.view,e=!!t.vendor&&t.state!=="not_chosen";return r`<div class="wrap" data-conn-form-root data-conn-state=${t.state}>
      ${!this.editing&&e?this.summary(t):n}
      ${!this.editing&&e&&this.context==="settings"&&(t.vendor==="hikvision"||t.vendor==="provision_isr")?r`<nvr-writes-switch recorder-id=${this.recorderId}></nvr-writes-switch>`:n}
      ${t.legacy_options_differ&&!this.editing?r`<div class="note" data-conn-legacy>פרטי חיבור ישנים בתשתית המערכת אינם בשימוש</div>`:n}
      ${this.editing?this.form(t):r`<div class="actions">
          <sw-button size=${this.btn} icon="edit" data-conn-edit @click=${()=>{this.seed(),this.editing=!0,this.msg=null}}>עריכה</sw-button>
          ${t.vendor&&t.vendor!=="none"?r`<sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove @click=${()=>{this.word="",this.removeOpen=!0}}>הסר NVR</sw-button>`:n}
        </div>`}
      ${this.editing&&e&&t.vendor!=="none"&&this.context==="settings"?r`<div class="actions"><sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove ?disabled=${this.busy!==""} @click=${()=>{this.word="",this.removeOpen=!0}}>הסר NVR</sw-button></div>`:n}
      ${this.msg?r`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-conn-msg>${this.msg.text}</div>`:n}
      ${this.stale?r`<div class="actions"><sw-button size=${this.btn} icon="refresh" data-conn-reload @click=${()=>void this.load()}>טען מחדש</sw-button></div>`:n}
      ${this.untestedOpen?r`<sw-dialog open heading="שמירה בלי בדיקת חיבור" subheading="לא ניתן להתחבר ל־NVR כרגע" data-conn-untested-dialog @close=${()=>this.untestedOpen=!1}>
            <sw-field label=${`לאישור הקלידו „${_}”`}><input data-ltr data-conn-untested-word autocomplete="off" .value=${this.word} @input=${i=>this.word=i.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.busy!==""||this.word.trim()!==_} data-conn-untested-confirm @click=${()=>this.save(!0)}>${this.busy==="save"?"שומר…":"שמור"}</sw-button><sw-button variant="ghost" @click=${()=>this.untestedOpen=!1}>ביטול</sw-button></div>
          </sw-dialog>`:n}
      ${this.removeOpen?r`<sw-dialog open heading="הסרת NVR" subheading="המצלמות יישארו במערכת ויושבתו" data-conn-remove-dialog @close=${()=>this.removeOpen=!1}>
            <sw-field label=${`להסרה הקלידו „${x}”`}><input data-ltr data-conn-remove-word autocomplete="off" .value=${this.word} @input=${i=>this.word=i.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.busy!==""||this.word.trim()!==x} data-conn-remove-confirm @click=${()=>this.removeNvr()}>${this.busy==="remove"?"מסיר…":"הסר NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.removeOpen=!1}>ביטול</sw-button></div>
          </sw-dialog>`:n}
    </div>`}};d.styles=S`
    :host {
      display: block;
      min-inline-size: 0;
    }
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
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
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
  `;l([b()],d.prototype,"context",2);l([b({attribute:"recorder-id"})],d.prototype,"recorderId",2);l([o()],d.prototype,"addName",2);l([o()],d.prototype,"loadState",2);l([o()],d.prototype,"loadError",2);l([o()],d.prototype,"view",2);l([o()],d.prototype,"vendors",2);l([o()],d.prototype,"draft",2);l([o()],d.prototype,"editing",2);l([o()],d.prototype,"changePassword",2);l([o()],d.prototype,"busy",2);l([o()],d.prototype,"msg",2);l([o()],d.prototype,"testLine",2);l([o()],d.prototype,"offerUntested",2);l([o()],d.prototype,"untestedOpen",2);l([o()],d.prototype,"removeOpen",2);l([o()],d.prototype,"word",2);l([o()],d.prototype,"lockedByServer",2);l([o()],d.prototype,"stale",2);l([o()],d.prototype,"invalidField",2);l([o()],d.prototype,"lastTest",2);l([o()],d.prototype,"dismissed",2);l([o()],d.prototype,"advancedOpen",2);d=l([N("nvr-connection-form")],d);
//# sourceMappingURL=nvr-connection-form-Do2KT3V_.js.map
