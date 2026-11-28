import{j as R,c as q,v as l,q as m,A as n,b as o,o as t,ai as E,k as c,z as x,a as _,y as U,C as D,m as F}from"./index-DlIoBDHe.js";import{q as I}from"./qrcode-CWKHzRGU.js";import{s as S,r as O,a as L,b as P,d as X,c as A,f as N,e as T,g as M,h as B,j as H,i as V}from"./second-factor-B2569KpR.js";const C=e=>e.normalize("NFC").trim().toLowerCase();function Y(e,s){return s.trim()?e?C(s)===C(e.confirm_text):!0:!1}const g=e=>!!e&&!e.allowed,$={self:()=>l("את דרכי האימות שלך מסירים בחשבון שלי ‹ אבטחה."),user_unknown:()=>l("המשתמש לא נמצא."),local_only:()=>l("איפוס דרכי אימות של משתמש אחר מותר רק מהרשת המקומית."),reauth:()=>l("לאיפוס מבחוץ צריך כניסה טרייה (לפני פחות מ־5 דקות). צא והיכנס שוב, ואז נסה שוב."),last_admin:()=>l("זה מנהל המערכת האחרון שיכול להיכנס מרחוק, ולכן אי אפשר לאפס את דרכי האימות שלו."),rate_limited:()=>l("אפשר לאפס דרכי אימות לשלושה משתמשים לכל היותר בשעה. אפשר לנסות שוב מאוחר יותר.")},G={second_factor_self_reset:"self",user_unknown:"user_unknown",factor_reset_local_only:"local_only",reauth_required:"reauth",factor_reset_last_admin:"last_admin",factor_reset_rate_limited:"rate_limited"};function J(e){if(e instanceof q){const s=e.body.code;if(s==="factor_reset_confirm_required"||s==="factor_reset_confirm_mismatch")return l("שם המשתמש שהוקלד אינו תואם לחשבון. האיפוס לא בוצע.");const r=G[s];if(r)return $[r]()}return m(e)}function K(e){const s=[...e.totp?[l("אפליקציית האימות")]:[],...e.passkeys?[l("מפתחות גישה: {n}",{n:e.passkeys})]:[],...e.device_keys?[l("מפתחות טלפון: {n}",{n:e.device_keys})]:[],...e.recovery_codes?[l("קודי שחזור: {n}",{n:e.recovery_codes})]:[]];return s.length?l("יוסרו: {list}",{list:s.join(" · ")}):l("למשתמש אין דרכי אימות להסרה; הכניסות שלו יסתיימו.")}function Q(e,s,r,a){if(e===void 0)return n;if(e&&!e.allowed){const u=e.reason??"user_unknown";return o`<div class="err" role="alert" data-reset-refused=${u}>${($[u]??$.user_unknown)()}</div>`}const d=e?l("לאישור, יש להקליד את שם המשתמש: {name}",{name:e.confirm_text}):l("לאישור, יש להקליד את שם המשתמש");return o`${e?o`<div class="lbl rc-line" data-reset-removes>${K(e.factors)}</div>
          <div class="lbl rc-line" data-reset-after>${l("כל הכניסות והמכשירים של המשתמש יתנתקו.")}${e.must_enroll_after?` ${l("בכניסה הבאה מרחוק יצטרך להגדיר אימות דו־שלבי מחדש.")}`:""}</div>`:n}
    <form class="typed-form" @submit=${u=>{u.preventDefault(),a()}}>
      <label class="lbl rc-line" data-reset-confirm-label>${d}
        <input class="typed" data-reset-confirm-text type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200"
          .value=${s} @input=${u=>r(u.target.value)} />
      </label>
    </form>
    ${e&&e.resets_left<e.rate_max?o`<div class="lbl rc-line" data-reset-left>${l("אפשר לאפס עוד {n} בשעה הזו",{n:e.resets_left})}</div>`:n}`}const W=R`
  .typed-form {
    display: block;
  }
  .rc-line {
    text-align: start;
  }
  label.rc-line {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-1);
  }
  input.typed {
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 20em;
    letter-spacing: normal;
    text-align: start;
    font-size: var(--sw-fs-sm);
    direction: ltr;
  }
`;var Z=Object.defineProperty,ee=Object.getOwnPropertyDescriptor,i=(e,s,r,a)=>{for(var d=a>1?void 0:a?ee(s,r):s,u=e.length-1,f;u>=0;u--)(f=e[u])&&(d=(a?f(s,r,d):f(d))||d);return a&&d&&Z(s,r,d),d};function se(e,s=168){const r=I(0,"M");r.addData(e),r.make();const a=r.getModuleCount(),d=3;let u="";for(let y=0;y<a;y++)for(let b=0;b<a;b++)r.isDark(y,b)&&(u+=`M${b+d} ${y+d}h1v1h-1z`);const f=a+d*2;return E`<svg viewBox="0 0 ${f} ${f}" width=${s} height=${s} role="img" aria-label=${t("secondFactor.qrLabel")} shape-rendering="crispEdges" data-sf-qr>
    <rect width=${f} height=${f} fill="#fff"></rect><path d=${u} fill="#000"></path></svg>`}function j(e){if(!e)return"";const s=new Date(e);return D(s)}const k=R`
  :host {
    display: block;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-block-size: 44px;
  }
  .state {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
  }
  .state small {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 8px 0 4px;
  }
  .qr {
    background: #fff;
    border-radius: var(--sw-r-md);
    padding: 4px;
    line-height: 0;
  }
  .key {
    direction: ltr;
    font-family: var(--sw-font-mono, ui-monospace, monospace);
    font-size: var(--sw-fs-sm);
    letter-spacing: 0.08em;
    word-break: break-all;
    text-align: center;
    user-select: all;
    color: var(--sw-text);
  }
  .lbl {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    text-align: center;
  }
  form {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }
  input {
    inline-size: 9.5em;
    min-block-size: 36px;
    padding: 4px 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-lg);
    letter-spacing: 0.25em;
    text-align: center;
    direction: ltr;
  }
  select {
    min-block-size: 36px;
    padding: 4px 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  input:focus-visible,
  select:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  .err {
    margin: 4px 0 0;
    font-size: var(--sw-fs-xs);
    color: var(--sw-danger);
  }
  .ok {
    margin: 4px 0 0;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  /* MFA-RECOVERY-CODES-2490: the recovery-codes row, the warning and the one-time list (the card's own tokens, no new look) */
  .rc {
    margin-block-start: var(--sw-s-2);
    padding-block-start: var(--sw-s-1);
  }
  .warn {
    margin: 0 0 var(--sw-s-1);
    font-size: var(--sw-fs-xs);
    color: var(--sw-warning-text);
  }
  .codes {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    gap: var(--sw-s-1h) var(--sw-s-5);
    justify-content: center;
    margin: var(--sw-s-1) 0 0;
    padding: var(--sw-s-3) var(--sw-s-3h);
    list-style: none;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
    direction: ltr;
    font-family: var(--sw-font-mono, ui-monospace, monospace);
    font-size: var(--sw-fs-sm);
    letter-spacing: 0.08em;
    color: var(--sw-text);
    user-select: all;
  }
  .acts {
    display: flex;
    gap: var(--sw-s-2);
    justify-content: center;
    flex-wrap: wrap;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    font-size: var(--sw-fs-xs);
    color: var(--sw-accent-text);
    text-decoration: underline;
    cursor: pointer;
  }
  .link:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
`;function z(e,s){const r=e.replace(/\s+/g,"");return s?V(e):/^\d{6}$/.test(r)}function te(e){const s=[t("secondFactor.recoveryFileTitle"),t("secondFactor.recoveryFileNote"),"",...e,""].join(`\r
`),r=URL.createObjectURL(new Blob([s],{type:"text/plain;charset=utf-8"})),a=document.createElement("a");a.href=r,a.download="arx-recovery-codes.txt",document.body.append(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(r),1e3)}let h=class extends _{constructor(){super(...arguments),this.status=null,this.enrolment=null,this.disabling=!1,this.code="",this.busy=!1,this.error="",this.message="",this.recovery=null,this.freshCodes=[],this.regenerating=!1,this.useRecovery=!1}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.freshCodes=[]}async load(){try{this.status=await S()}catch(e){this.error=m(e)}await this.loadRecovery()}async loadRecovery(){try{this.recovery=this.status?.enabled?await O():null}catch{this.recovery=null}}async run(e){this.busy=!0,this.error="";try{await e()}catch(s){this.error=s instanceof q&&s.body.code==="reauth_required"?t("secondFactor.reauth"):m(s)}finally{this.busy=!1}}start(){this.message="",this.run(async()=>{this.enrolment=await L(),this.code=""})}cancel(){this.enrolment=null,this.disabling=!1,this.regenerating=!1,this.useRecovery=!1,this.code="",this.error=""}submit(e){e.preventDefault();const s=this.disabling&&this.useRecovery;if(!z(this.code,s))return;const r=s?this.code.trim():this.code.replace(/\s+/g,"");this.run(async()=>{if(this.regenerating){const a=await P(r);this.freshCodes=a.codes,this.recovery={available:!0,remaining:a.remaining,total:a.total,created_at:a.created_at,last_used_at:a.last_used_at,low:a.low,low_at:a.low_at},this.regenerating=!1}else if(this.disabling)this.status=await X(r),this.message=t("secondFactor.disabledDone"),this.freshCodes=[],this.recovery=null;else{const a=await A(r);this.status={enabled:a.enabled,enabled_at:a.enabled_at,last_used_at:a.last_used_at},this.message=t("secondFactor.enabledDone"),this.freshCodes=a.recovery_codes??[],await this.loadRecovery()}this.enrolment=null,this.disabling=!1,this.useRecovery=!1,this.code=""})}async copyCodes(){try{await navigator.clipboard.writeText(this.freshCodes.join(`
`)),this.message=t("secondFactor.recoveryCopied")}catch(e){this.error=m(e)}}codeForm(){const e=this.disabling&&this.useRecovery;return o`<form @submit=${this.submit} data-sf-form>
      <input name="code" inputmode=${e?"text":"numeric"} autocomplete="one-time-code" maxlength=${e?11:7}
        autocapitalize=${e?"characters":"off"} spellcheck="false" placeholder=${e?"XXXX-XXXX":""}
        aria-label=${e?t("secondFactor.recoveryCodeLabel"):t("secondFactor.codeLabel")} data-sf-code .value=${this.code}
        @input=${s=>this.code=s.target.value} ?disabled=${this.busy} />
      <sw-button size="sm" variant="primary" data-sf-confirm @click=${s=>this.submit(s)} ?disabled=${this.busy||!z(this.code,e)}>${this.regenerating?t("secondFactor.recoveryCreate"):t("secondFactor.confirm")}</sw-button>
      <sw-button size="sm" variant="ghost" data-sf-cancel ?disabled=${this.busy} @click=${()=>this.cancel()}>${t("secondFactor.cancel")}</sw-button>
    </form>
    ${this.disabling?o`<div class="acts"><button type="button" class="link" data-sf-use-recovery ?disabled=${this.busy}
          @click=${()=>{this.useRecovery=!this.useRecovery,this.code="",this.error=""}}>${this.useRecovery?t("secondFactor.recoveryUseApp"):t("secondFactor.recoveryUse")}</button></div>`:n}`}recoveryPart(){const e=this.recovery,s=this.status;if(this.freshCodes.length)return o`<div class="box rc" data-sf-recovery-fresh>
        <div class="lbl" data-sf-recovery-once>${t("secondFactor.recoveryShownOnce")}</div>
        <ul class="codes" aria-label=${t("secondFactor.recoveryListLabel")} data-sf-recovery-codes>${this.freshCodes.map(a=>o`<li>${a}</li>`)}</ul>
        <div class="acts">
          <sw-button size="sm" variant="secondary" icon="copy" data-sf-recovery-copy @click=${()=>void this.copyCodes()}>${t("secondFactor.recoveryCopy")}</sw-button>
          <sw-button size="sm" variant="secondary" icon="download" data-sf-recovery-download @click=${()=>te(this.freshCodes)}>${t("secondFactor.recoveryDownload")}</sw-button>
          <sw-button size="sm" variant="primary" data-sf-recovery-saved @click=${()=>{this.freshCodes=[],this.message=""}}>${t("secondFactor.recoverySaved")}</sw-button>
        </div>
      </div>`;if(!s?.enabled||!e||this.enrolment||this.disabling)return n;const r=e.remaining===0;return o`<div class="rc" data-sf-recovery>
      <div class="row">
        <span class="state">${t("secondFactor.recoveryTitle")} <small data-sf-recovery-count>${r?t("secondFactor.recoveryNone"):U("secondFactor.recoveryRemaining",{n:e.remaining,total:e.total})}</small></span>
        ${this.regenerating?n:o`<sw-button size="sm" variant=${e.low||r?"primary":"secondary"} data-sf-recovery-new @click=${()=>{this.regenerating=!0,this.code="",this.message="",this.error=""}}>${t("secondFactor.recoveryNew")}</sw-button>`}
      </div>
      ${e.low||r?o`<div class="warn" role="status" data-sf-recovery-low>${r?t("secondFactor.recoveryEmpty"):t("secondFactor.recoveryLow")}</div>`:n}
      ${this.regenerating?o`<div class="box" data-sf-recovery-step><div class="lbl">${t("secondFactor.recoveryNewHint")}</div>${this.codeForm()}</div>`:n}
    </div>`}render(){const e=this.status;return e?o`
      <div class="row">
        <span class="state" data-sf-state>${e.enabled?t("secondFactor.on"):t("secondFactor.off")}${e.enabled&&e.enabled_at?o` <small>${t("secondFactor.since")} ${j(e.enabled_at)}</small>`:n}</span>
        ${this.enrolment||this.disabling||this.regenerating?n:e.enabled?o`<sw-button size="sm" variant="secondary" data-sf-disable @click=${()=>{this.disabling=!0,this.useRecovery=!1,this.message=""}}>${t("secondFactor.disable")}</sw-button>`:o`<sw-button size="sm" variant="primary" data-sf-enable ?disabled=${this.busy} @click=${()=>this.start()}>${t("secondFactor.enable")}</sw-button>`}
      </div>
      ${this.enrolment?o`<div class="box" data-sf-enrolment>
            <div class="lbl">${t("secondFactor.scan")}</div>
            <div class="qr">${se(this.enrolment.otpauth_uri)}</div>
            <div class="lbl">${t("secondFactor.keyLabel")}</div>
            <div class="key" data-sf-key>${this.enrolment.secret.replace(/(.{4})/g,"$1 ").trim()}</div>
            ${this.codeForm()}
          </div>`:this.disabling?o`<div class="box" data-sf-disabling>${this.codeForm()}</div>`:n}
      ${this.recoveryPart()}
      ${this.error?o`<div class="err" role="alert" data-sf-error>${this.error}</div>`:n}
      ${this.message?o`<div class="ok" role="status" data-sf-message>${this.message}</div>`:n}
    `:this.error?o`<div class="err" role="alert">${this.error}</div>`:n}};h.styles=k;i([c()],h.prototype,"status",2);i([c()],h.prototype,"enrolment",2);i([c()],h.prototype,"disabling",2);i([c()],h.prototype,"code",2);i([c()],h.prototype,"busy",2);i([c()],h.prototype,"error",2);i([c()],h.prototype,"message",2);i([c()],h.prototype,"recovery",2);i([c()],h.prototype,"freshCodes",2);i([c()],h.prototype,"regenerating",2);i([c()],h.prototype,"useRecovery",2);h=i([F("sw-second-factor")],h);let v=class extends _{constructor(){super(...arguments),this.userId="",this.since=void 0,this.busy=!1,this.armed=!1,this.error="",this.message="",this.stepUp=!1,this.ownCode="",this.check=void 0,this.typed="",this.seq=0}willUpdate(e){e.has("userId")&&(this.since=void 0,this.armed=!1,this.ownCode="",this.typed="",this.check=void 0,this.message="",this.load())}async load(){const e=++this.seq;try{const s=await N();if(e!==this.seq)return;const r=s.users.find(a=>a.user_id===this.userId);this.since=r?r.enabled_at??"":null}catch{e===this.seq&&(this.since=null)}}async arm(){this.armed=!0,this.error="",this.ownCode="",this.typed="",this.check=void 0;const e=this.userId,[s,r]=await Promise.allSettled([S(),T(e)]);e===this.userId&&(this.stepUp=s.status==="fulfilled"&&s.value.enabled,this.check=r.status==="fulfilled"?r.value:null)}ready(){return!g(this.check)&&Y(this.check,this.typed)&&(!this.stepUp||/^\d{6}$/.test(this.ownCode))}async reset(){if(!this.ready()||this.busy)return;this.busy=!0,this.error="";const e=this.userId;try{if(await M(e,this.typed,this.stepUp?this.ownCode:void 0),e!==this.userId){this.dispatchEvent(new CustomEvent("factors-changed",{bubbles:!0,composed:!0}));return}this.since=null,this.armed=!1,this.ownCode="",this.typed="",this.message=t("secondFactor.adminResetDone"),this.dispatchEvent(new CustomEvent("factors-changed",{bubbles:!0,composed:!0}))}catch(s){e===this.userId&&(this.error=J(s))}finally{this.busy=!1}}render(){return this.since===void 0?n:this.since===null?this.message?o`<div class="ok" role="status" data-sf-message>${this.message}</div>`:o`<span class="state" data-sf-admin-state>${t("secondFactor.off")}</span>`:o`<div class="row" data-sf-admin>
        <span class="state" data-sf-admin-state>${t("secondFactor.on")}${this.since?o` <small>${t("secondFactor.since")} ${j(this.since)}</small>`:n}</span>
        ${this.armed?o`<span>${g(this.check)?n:o`<sw-button size="sm" variant="danger" data-sf-admin-confirm ?disabled=${this.busy||!this.ready()} @click=${()=>void this.reset()}>${t("secondFactor.adminReset")}</sw-button>`}
              <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.armed=!1}>${t("secondFactor.cancel")}</sw-button></span>`:o`<sw-button size="sm" variant="secondary" data-sf-admin-reset @click=${()=>void this.arm()}>${t("secondFactor.adminReset")}</sw-button>`}
      </div>
      ${this.armed?o`<div class="lbl">${t("secondFactor.adminResetConfirm")}</div>`:n}
      ${this.armed?Q(this.check,this.typed,e=>this.typed=e,()=>void this.reset()):n}
      ${this.armed&&this.stepUp&&!g(this.check)?o`<form @submit=${e=>{e.preventDefault(),this.reset()}}>
            <input data-sf-admin-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label=${t("secondFactor.adminStepUp")}
              placeholder="000000" .value=${this.ownCode} @input=${e=>this.ownCode=e.target.value.replace(/\D/g,"").slice(0,6)} />
          </form>
          <div class="lbl">${t("secondFactor.adminStepUp")}</div>`:n}
      ${this.error?o`<div class="err" role="alert">${this.error}</div>`:n}`}};v.styles=[k,W];i([x()],v.prototype,"userId",2);i([c()],v.prototype,"since",2);i([c()],v.prototype,"busy",2);i([c()],v.prototype,"armed",2);i([c()],v.prototype,"error",2);i([c()],v.prototype,"message",2);i([c()],v.prototype,"stepUp",2);i([c()],v.prototype,"ownCode",2);i([c()],v.prototype,"check",2);i([c()],v.prototype,"typed",2);v=i([F("sw-second-factor-user")],v);let w=null,p=class extends _{constructor(){super(...arguments),this.kind="user",this.subjectId="",this.value=void 0,this.busy=!1,this.error=""}willUpdate(e){(e.has("subjectId")||e.has("kind"))&&(this.value=void 0,this.load())}async load(){const e=this.kind,s=this.subjectId;try{w??=B();const r=await w;e===this.kind&&s===this.subjectId&&(this.value=r[e][s]??"inherit")}catch{w=null,this.value=void 0}}async change(e){const s=e.target,r=s.value,a=this.value;this.busy=!0,this.error="";try{const d=await H(this.kind,this.subjectId,r);w=Promise.resolve(d),this.value=r}catch(d){this.error=m(d),this.value=a,s.value=a??"inherit"}finally{this.busy=!1}}render(){return this.value===void 0?n:o`<div class="row" data-sf-policy-row>
        <select data-sf-policy-select aria-label=${t("secondFactor.overrideLabel")} ?disabled=${this.busy} @change=${e=>void this.change(e)}>
          ${["inherit","optional","required"].map(e=>o`<option value=${e} ?selected=${this.value===e}>${t(e==="inherit"?"secondFactor.overrideInherit":e==="optional"?"secondFactor.overrideOptional":"secondFactor.overrideRequired")}</option>`)}
        </select>
      </div>
      ${this.error?o`<div class="err" role="alert" data-sf-policy-error>${this.error}</div>`:n}`}};p.styles=k;i([x()],p.prototype,"kind",2);i([x()],p.prototype,"subjectId",2);i([c()],p.prototype,"value",2);i([c()],p.prototype,"busy",2);i([c()],p.prototype,"error",2);p=i([F("sw-second-factor-policy")],p);export{g as a,J as b,Q as c,se as q,W as r,Y as t};
