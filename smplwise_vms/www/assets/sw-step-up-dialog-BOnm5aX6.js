import{i as w,S as v,P as k,m as $,n as t,o as f,q as l,v as g,A as c,b as n,x,g as U,y as m,j as d,k as C}from"./index-CqeTnh_F.js";import{i as E,v as P}from"./second-factor-elQhMsWy.js";import{a as B,N as S,d as _,D,r as I}from"./factor-screens-B3mBR6o1.js";import{p as A}from"./step-up-passkey-pyQWoF8o.js";import{l as z}from"./local-identity-BIyqvbpZ.js";import"./sw-logo-art-PLtEZJxU.js";var X=Object.defineProperty,O=Object.getOwnPropertyDescriptor,p=(e,s,i,r)=>{for(var o=r>1?void 0:r?O(s,i):s,u=e.length-1,h;u>=0;u--)(h=e[u])&&(o=(r?h(s,i,o):h(o))||o);return r&&o&&X(s,i,o),o};let a=class extends w{constructor(){super(...arguments),this.details={},this.open=!1,this.code="",this.busy=!1,this.error="",this.passkeyBusy=!1,this.keyId=null,this.keyBusy=!1,this.recovery=!1,this.resolver=null}connectedCallback(){super.connectedCallback(),this.methods.includes("device_key")&&B().then(e=>this.keyId=e)}get recoveryAllowed(){return this.methods.includes("totp")&&!this.details.once&&!S.includes(this.details.action??"")}disconnectedCallback(){super.disconnectedCallback(),this.answer(!1)}get methods(){return Array.isArray(this.details.methods)?this.details.methods:[]}get valid(){return this.recovery?E(this.code):/^\d{6}$/.test(this.code.replace(/\s+/g,""))}answer(e){const s=this.resolver;s&&(this.resolver=null,this.open=!1,s(e),this.updateComplete.then(()=>requestAnimationFrame(()=>this.remove())))}async byPasskey(){if(!this.busy){this.busy=!0,this.passkeyBusy=!0,this.error="";try{await A(this.details.action),window.dispatchEvent(new CustomEvent(v)),this.answer(!0)}catch(e){this.error=e instanceof k?z("passkeyWrongHost",{origin:e.rpId}):e instanceof $?t("stepUp.passkeyCancelled"):f(e)}finally{this.busy=!1,this.passkeyBusy=!1}}}async byDeviceKey(){if(!(this.busy||!this.keyId)){this.busy=!0,this.keyBusy=!0,this.error="";try{await _(this.keyId,t("stepUp.heading"),this.details.action),window.dispatchEvent(new CustomEvent(v)),this.answer(!0)}catch(e){this.error=e instanceof D?l("האישור בטלפון בוטל או נכשל."):f(e)}finally{this.busy=!1,this.keyBusy=!1}}}async submit(e){if(e?.preventDefault(),!(this.busy||!this.valid)){this.busy=!0,this.error="";try{this.recovery?await I(this.code.trim(),this.details.action):await P(this.code.replace(/\s+/g,""),this.details.action),window.dispatchEvent(new CustomEvent(v)),this.answer(!0)}catch(s){this.error=f(s),this.code=""}finally{this.busy=!1}}}render(){const e=typeof this.details.minutes=="number"?this.details.minutes:5,s=this.methods.includes("totp"),i=this.methods.includes("passkey"),r=i&&g(),o=!!this.keyId,u=s||r||o,h=r&&s?t("stepUp.bodyBoth"):r?t("stepUp.bodyPasskey"):s?t("stepUp.body"):l("כדי לשנות הגדרות, משתמשים או הרשאות, אשר במפתח הטלפון."),b=i&&!r&&(s||o);return n`<sw-dialog ?open=${this.open} heading=${t("stepUp.heading")} data-step-up-dialog @close=${y=>{y.stopPropagation(),this.answer(!1)}}>
      ${u?n`<p class="msg" data-step-up-text>${h}</p>
            ${b?n`<p class="hint" data-step-up-passkey-elsewhere>${l("למפתח הגישה שלך צריך דפדפן שתומך במפתחות גישה. כאן אפשר לאשר בדרך אחרת.")}</p>`:c}
            <p class="hint" data-step-up-window>${e>0?x("stepUp.window",{minutes:e}):t("stepUp.once")}</p>
            ${r?n`<div class="pk"><sw-button variant=${s?"secondary":"primary"} data-step-up-passkey ?disabled=${this.busy} @click=${()=>void this.byPasskey()}>${this.passkeyBusy?t("stepUp.passkeyWaiting"):t("stepUp.passkey")}</sw-button></div>`:c}
            ${o?n`<div class="pk"><sw-button variant=${s||r?"secondary":"primary"} icon="sensor" data-step-up-device-key ?disabled=${this.busy} @click=${()=>void this.byDeviceKey()}>${this.keyBusy?l("ממתין לטלפון…"):l("אישור במפתח הטלפון")}</sw-button></div>`:c}
            ${(r||o)&&s?n`<div class="or" aria-hidden="true">${t("stepUp.or")}</div>`:c}
            ${s?n`<form @submit=${y=>void this.submit(y)}>
                  <input name="code" inputmode=${this.recovery?"text":"numeric"} autocomplete="one-time-code" maxlength=${this.recovery?11:7} autocapitalize=${this.recovery?"characters":"off"}
                    spellcheck="false" placeholder=${this.recovery?"XXXX-XXXX":"000000"} aria-label=${this.recovery?t("secondFactor.recoveryCodeLabel"):t("stepUp.codeLabel")} data-step-up-code
                    .value=${this.code} ?disabled=${this.busy} @input=${y=>this.code=y.target.value} />
                </form>
                ${this.recoveryAllowed?n`<div class="alt"><button type="button" class="link" data-step-up-recovery ?disabled=${this.busy}
                      @click=${()=>{this.recovery=!this.recovery,this.code="",this.error=""}}>${this.recovery?t("secondFactor.recoveryUseApp"):t("secondFactor.recoveryUse")}</button></div>`:c}`:c}`:n`<p class="msg" data-step-up-no-method>${i?t("stepUp.passkeyUnsupported"):this.methods.includes("device_key")&&!this.methods.includes("totp")?l("את מפתח הטלפון אפשר לאשר רק מתוך אפליקציית Android."):t("stepUp.noMethod")}</p>`}
      ${this.error?n`<div class="err" role="alert" data-step-up-error>${this.error}</div>`:c}
      <sw-button slot="footer" data-step-up-cancel ?disabled=${this.busy} @click=${()=>this.answer(!1)}>${t("stepUp.cancel")}</sw-button>
      ${s?n`<sw-button slot="footer" variant="primary" data-step-up-confirm ?disabled=${this.busy||!this.valid} @click=${()=>void this.submit()}>${t("stepUp.confirm")}</sw-button>`:c}
    </sw-dialog>`}};a.styles=U`
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
  `;p([m({attribute:!1})],a.prototype,"details",2);p([m({type:Boolean})],a.prototype,"open",2);p([d()],a.prototype,"code",2);p([d()],a.prototype,"busy",2);p([d()],a.prototype,"error",2);p([d()],a.prototype,"passkeyBusy",2);p([d()],a.prototype,"keyId",2);p([d()],a.prototype,"keyBusy",2);p([d()],a.prototype,"recovery",2);a=p([C("sw-step-up-dialog")],a);function q(e){return typeof document>"u"?Promise.resolve(!1):new Promise(s=>{const i=document.createElement("sw-step-up-dialog");i.details=e,i.resolver=s,document.body.append(i),i.open=!0})}export{a as SwStepUpDialog,q as stepUpDialog};
