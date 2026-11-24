import{i as m,S as v,m as t,n as f,o as y,A as p,q as w,b as n,g as k,v as b,j as d,k as $}from"./index-c_ii2C2N.js";import{i as g,v as x}from"./second-factor-IWI1WQng.js";import{a as U,N as C,d as E,D as P,r as B}from"./factor-screens-C-KpDnSG.js";import{p as S,P as _,a as D}from"./step-up-passkey-BvhZ2nB-.js";import"./sw-logo-art-PLtEZJxU.js";var A=Object.defineProperty,I=Object.getOwnPropertyDescriptor,c=(s,e,r,o)=>{for(var a=o>1?void 0:o?I(e,r):e,l=s.length-1,u;l>=0;l--)(u=s[l])&&(a=(o?u(e,r,a):u(a))||a);return o&&a&&A(e,r,a),a};let i=class extends m{constructor(){super(...arguments),this.details={},this.open=!1,this.code="",this.busy=!1,this.error="",this.passkeyBusy=!1,this.keyId=null,this.keyBusy=!1,this.recovery=!1,this.resolver=null}connectedCallback(){super.connectedCallback(),this.methods.includes("device_key")&&U().then(s=>this.keyId=s)}get recoveryAllowed(){return this.methods.includes("totp")&&!this.details.once&&!C.includes(this.details.action??"")}disconnectedCallback(){super.disconnectedCallback(),this.answer(!1)}get methods(){return Array.isArray(this.details.methods)?this.details.methods:[]}get valid(){return this.recovery?g(this.code):/^\d{6}$/.test(this.code.replace(/\s+/g,""))}answer(s){const e=this.resolver;e&&(this.resolver=null,this.open=!1,e(s),this.updateComplete.then(()=>requestAnimationFrame(()=>this.remove())))}async byPasskey(){if(!this.busy){this.busy=!0,this.passkeyBusy=!0,this.error="";try{await S(this.details.action),window.dispatchEvent(new CustomEvent(v)),this.answer(!0)}catch(s){this.error=s instanceof _?t("stepUp.passkeyCancelled"):f(s)}finally{this.busy=!1,this.passkeyBusy=!1}}}async byDeviceKey(){if(!(this.busy||!this.keyId)){this.busy=!0,this.keyBusy=!0,this.error="";try{await E(this.keyId,t("stepUp.heading"),this.details.action),window.dispatchEvent(new CustomEvent(v)),this.answer(!0)}catch(s){this.error=s instanceof P?y("האישור בטלפון בוטל או נכשל."):f(s)}finally{this.busy=!1,this.keyBusy=!1}}}async submit(s){if(s?.preventDefault(),!(this.busy||!this.valid)){this.busy=!0,this.error="";try{this.recovery?await B(this.code.trim(),this.details.action):await x(this.code.replace(/\s+/g,""),this.details.action),window.dispatchEvent(new CustomEvent(v)),this.answer(!0)}catch(e){this.error=f(e),this.code=""}finally{this.busy=!1}}}render(){const s=typeof this.details.minutes=="number"?this.details.minutes:5,e=this.methods.includes("totp"),r=this.methods.includes("passkey"),o=r&&D(),a=!!this.keyId,l=e||o||a,u=o&&e?t("stepUp.bodyBoth"):o?t("stepUp.bodyPasskey"):e?t("stepUp.body"):y("כדי לשנות הגדרות, משתמשים או הרשאות, אשר במפתח הטלפון.");return n`<sw-dialog ?open=${this.open} heading=${t("stepUp.heading")} data-step-up-dialog @close=${h=>{h.stopPropagation(),this.answer(!1)}}>
      ${l?n`<p class="msg" data-step-up-text>${u}</p>
            <p class="hint" data-step-up-window>${s>0?w("stepUp.window",{minutes:s}):t("stepUp.once")}</p>
            ${o?n`<div class="pk"><sw-button variant=${e?"secondary":"primary"} data-step-up-passkey ?disabled=${this.busy} @click=${()=>void this.byPasskey()}>${this.passkeyBusy?t("stepUp.passkeyWaiting"):t("stepUp.passkey")}</sw-button></div>`:p}
            ${a?n`<div class="pk"><sw-button variant=${e||o?"secondary":"primary"} icon="sensor" data-step-up-device-key ?disabled=${this.busy} @click=${()=>void this.byDeviceKey()}>${this.keyBusy?y("ממתין לטלפון…"):y("אישור במפתח הטלפון")}</sw-button></div>`:p}
            ${(o||a)&&e?n`<div class="or" aria-hidden="true">${t("stepUp.or")}</div>`:p}
            ${e?n`<form @submit=${h=>void this.submit(h)}>
                  <input name="code" inputmode=${this.recovery?"text":"numeric"} autocomplete="one-time-code" maxlength=${this.recovery?11:7} autocapitalize=${this.recovery?"characters":"off"}
                    spellcheck="false" placeholder=${this.recovery?"XXXX-XXXX":"000000"} aria-label=${this.recovery?t("secondFactor.recoveryCodeLabel"):t("stepUp.codeLabel")} data-step-up-code
                    .value=${this.code} ?disabled=${this.busy} @input=${h=>this.code=h.target.value} />
                </form>
                ${this.recoveryAllowed?n`<div class="alt"><button type="button" class="link" data-step-up-recovery ?disabled=${this.busy}
                      @click=${()=>{this.recovery=!this.recovery,this.code="",this.error=""}}>${this.recovery?t("secondFactor.recoveryUseApp"):t("secondFactor.recoveryUse")}</button></div>`:p}`:p}`:n`<p class="msg" data-step-up-no-method>${r?t("stepUp.passkeyUnsupported"):this.methods.includes("device_key")&&!this.methods.includes("totp")?y("את מפתח הטלפון אפשר לאשר רק מתוך אפליקציית Android."):t("stepUp.noMethod")}</p>`}
      ${this.error?n`<div class="err" role="alert" data-step-up-error>${this.error}</div>`:p}
      <sw-button slot="footer" data-step-up-cancel ?disabled=${this.busy} @click=${()=>this.answer(!1)}>${t("stepUp.cancel")}</sw-button>
      ${e?n`<sw-button slot="footer" variant="primary" data-step-up-confirm ?disabled=${this.busy||!this.valid} @click=${()=>void this.submit()}>${t("stepUp.confirm")}</sw-button>`:p}
    </sw-dialog>`}};i.styles=k`
    .msg {
      margin: 0 0 6px;
      color: var(--sw-text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .hint {
      margin: 0 0 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    form {
      display: flex;
      justify-content: center;
    }
    input {
      inline-size: 9.5em;
      min-block-size: 44px;
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
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .pk {
      display: flex;
      justify-content: center;
    }
    .or {
      margin: 10px 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: center;
    }
    /* MFA-SCREENS-2510: the recovery-code switch under the field */
    .alt {
      display: flex;
      justify-content: center;
      margin-block-start: var(--sw-s-2);
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
    .err {
      margin: 8px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      text-align: center;
    }
  `;c([b({attribute:!1})],i.prototype,"details",2);c([b({type:Boolean})],i.prototype,"open",2);c([d()],i.prototype,"code",2);c([d()],i.prototype,"busy",2);c([d()],i.prototype,"error",2);c([d()],i.prototype,"passkeyBusy",2);c([d()],i.prototype,"keyId",2);c([d()],i.prototype,"keyBusy",2);c([d()],i.prototype,"recovery",2);i=c([$("sw-step-up-dialog")],i);function K(s){return typeof document>"u"?Promise.resolve(!1):new Promise(e=>{const r=document.createElement("sw-step-up-dialog");r.details=s,r.resolver=e,document.body.append(r),r.open=!0})}export{i as SwStepUpDialog,K as stepUpDialog};
