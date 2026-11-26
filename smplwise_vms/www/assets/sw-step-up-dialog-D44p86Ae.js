import{a as x,S as b,P,n as U,o as i,q as m,v as t,x as E,A as h,b as o,y as C,j as S,z as w,k as d,m as _}from"./index-kIGDECLR.js";import{i as A,v as O}from"./second-factor-xuUifJJ4.js";import{appDeviceKeyId as T,NO_RECOVERY_ACTIONS as B,deviceKeyStepUp as I,DeviceKeyCancelled as D,recoveryStepUp as z}from"./factor-screens-mEla9ej7.js";import{p as M}from"./step-up-passkey-CcWgLOAS.js";import{l as X}from"./local-identity-o-ebtMjL.js";import{cancelPushApproval as F,startPushApproval as j,pushApprovalState as R,verifyPushApproval as K,alarmPinStepUp as H}from"./push-approval-Cq7Zx1I1.js";import"./sw-logo-art-PLtEZJxU.js";var L=Object.defineProperty,N=Object.getOwnPropertyDescriptor,l=(s,e,n,c)=>{for(var r=c>1?void 0:c?N(e,n):e,u=s.length-1,p;u>=0;u--)(p=s[u])&&(r=(c?p(e,n,r):p(r))||r);return c&&r&&L(e,n,r),r};const q=2e3,W={denied:()=>t("הבקשה נדחתה בטלפון."),expired:()=>t("הבקשה פגה לפני שאושרה. נסה שוב."),cancelled:()=>t("הבקשה בוטלה."),used:()=>t("הבקשה כבר נוצלה. נסה שוב.")};let a=class extends x{constructor(){super(...arguments),this.details={},this.open=!1,this.code="",this.busy=!1,this.error="",this.passkeyBusy=!1,this.keyId=null,this.keyBusy=!1,this.recovery=!1,this.pin=!1,this.push=null,this.pushTimer=null,this.resolver=null}connectedCallback(){super.connectedCallback(),this.methods.includes("device_key")&&T().then(s=>this.keyId=s)}get recoveryAllowed(){return this.methods.includes("totp")&&!this.details.once&&!B.includes(this.details.action??"")}disconnectedCallback(){super.disconnectedCallback(),this.answer(!1)}get action(){return typeof this.details.action=="string"?this.details.action:""}get pushOffered(){return this.methods.includes("push")&&!!this.action&&!this.keyId}get pinOffered(){return this.methods.includes("alarm_pin")&&!!this.action}get pinMode(){return this.pinOffered&&(this.pin||!this.methods.includes("totp"))}get methods(){return Array.isArray(this.details.methods)?this.details.methods:[]}get valid(){return this.pinMode?/^\d{4,8}$/.test(this.code.trim()):this.recovery?A(this.code):/^\d{6}$/.test(this.code.replace(/\s+/g,""))}answer(s){const e=this.resolver;e&&(this.resolver=null,this.stopPush(!s),this.open=!1,e(s),this.updateComplete.then(()=>requestAnimationFrame(()=>this.remove())))}async byPasskey(){if(!this.busy){this.busy=!0,this.passkeyBusy=!0,this.error="";try{await M(this.details.action),window.dispatchEvent(new CustomEvent(b)),this.answer(!0)}catch(s){this.error=s instanceof P?X("passkeyWrongHost",{origin:s.rpId}):s instanceof U?i("stepUp.passkeyCancelled"):m(s)}finally{this.busy=!1,this.passkeyBusy=!1}}}async byDeviceKey(){if(!(this.busy||!this.keyId)){this.busy=!0,this.keyBusy=!0,this.error="";try{await I(this.keyId,i("stepUp.heading"),this.details.action),window.dispatchEvent(new CustomEvent(b)),this.answer(!0)}catch(s){this.error=s instanceof D?t("האישור בטלפון בוטל או נכשל."):m(s)}finally{this.busy=!1,this.keyBusy=!1}}}stopPush(s){this.pushTimer&&clearTimeout(this.pushTimer),this.pushTimer=null;const e=this.push;this.push=null,s&&e&&F(e.id).catch(()=>{})}async byPush(){if(!(this.busy||this.push)){this.busy=!0,this.error="";try{const s=await j(this.action);this.push={id:s.request_id,number:s.number},this.schedulePushPoll()}catch(s){this.error=m(s)}finally{this.busy=!1}}}schedulePushPoll(){this.pushTimer=setTimeout(()=>void this.pollPush(),q)}async pollPush(){const s=this.push;if(!(!s||!this.resolver))try{const e=await R(s.id);if(this.push?.id!==s.id)return;if(e.status==="pending")return this.schedulePushPoll();if(e.status==="approved"){this.busy=!0,await K(s.id,this.action),this.push=null,window.dispatchEvent(new CustomEvent(b)),this.answer(!0);return}this.push=null,this.error=W[e.status]?.()??t("הבקשה פגה לפני שאושרה. נסה שוב.")}catch(e){this.push=null,this.error=m(e)}finally{this.busy=!1}}async submit(s){if(s?.preventDefault(),!(this.busy||!this.valid)){this.busy=!0,this.error="";try{this.pinMode?await H(this.code.trim(),this.action):this.recovery?await z(this.code.trim(),this.details.action):await O(this.code.replace(/\s+/g,""),this.details.action),window.dispatchEvent(new CustomEvent(b)),this.answer(!0)}catch(e){this.error=m(e),this.code=""}finally{this.busy=!1}}}render(){const s=typeof this.details.minutes=="number"?this.details.minutes:5,e=this.methods.includes("totp"),n=this.pinOffered,c=this.pinMode,r=e||n,u=this.methods.includes("passkey"),p=u&&E(),f=!!this.keyId,v=this.pushOffered,$=r||p||f||v,k=p&&e?i("stepUp.bodyBoth"):p?i("stepUp.bodyPasskey"):e?i("stepUp.body"):n?t("כדי להמשיך, הזן את קוד האזעקה האישי שלך."):v?t("כדי להמשיך, אשר את הפעולה בטלפון שבו מותקנת האפליקציה."):t("כדי לשנות הגדרות, משתמשים או הרשאות, אשר במפתח הטלפון."),g=u&&!p&&(r||f||v);return o`<sw-dialog ?open=${this.open} heading=${i("stepUp.heading")} data-step-up-dialog @close=${y=>{y.stopPropagation(),this.answer(!1)}}>
      ${$?o`<p class="msg" data-step-up-text>${k}</p>
            ${g?o`<p class="hint" data-step-up-passkey-elsewhere>${t("למפתח הגישה שלך צריך דפדפן שתומך במפתחות גישה. כאן אפשר לאשר בדרך אחרת.")}</p>`:h}
            <p class="hint" data-step-up-window>${s>0?C("stepUp.window",{minutes:s}):i("stepUp.once")}</p>
            ${p?o`<div class="pk"><sw-button variant=${r?"secondary":"primary"} data-step-up-passkey ?disabled=${this.busy} @click=${()=>void this.byPasskey()}>${this.passkeyBusy?i("stepUp.passkeyWaiting"):i("stepUp.passkey")}</sw-button></div>`:h}
            ${f?o`<div class="pk"><sw-button variant=${r||p?"secondary":"primary"} icon="sensor" data-step-up-device-key ?disabled=${this.busy} @click=${()=>void this.byDeviceKey()}>${this.keyBusy?t("ממתין לטלפון…"):t("אישור במפתח הטלפון")}</sw-button></div>`:h}
            ${v?this.push?o`<div class="push" role="status" data-step-up-push-wait>
                    <span class="hint">${t("בטלפון, הקלד את המספר:")}</span>
                    <span class="num" dir="ltr" data-step-up-push-number>${this.push.number}</span>
                    <span class="hint">${t("ממתין לאישור בטלפון…")}</span>
                  </div>`:o`<div class="pk"><sw-button variant=${r||p||f?"secondary":"primary"} icon="bell" data-step-up-push ?disabled=${this.busy}
                    @click=${()=>void this.byPush()}>${t("אישור בטלפון")}</sw-button></div>`:h}
            ${(p||f||v)&&r?o`<div class="or" aria-hidden="true">${i("stepUp.or")}</div>`:h}
            ${r?o`<form @submit=${y=>void this.submit(y)}>
                  ${c?o`<input name="code" type="password" inputmode="numeric" autocomplete="off" maxlength="8" spellcheck="false" placeholder="••••"
                        aria-label=${t("קוד האזעקה האישי")} data-step-up-code data-step-up-pin-field
                        .value=${this.code} ?disabled=${this.busy} @input=${y=>this.code=y.target.value} />`:o`<input name="code" inputmode=${this.recovery?"text":"numeric"} autocomplete="one-time-code" maxlength=${this.recovery?11:7} autocapitalize=${this.recovery?"characters":"off"}
                        spellcheck="false" placeholder=${this.recovery?"XXXX-XXXX":"000000"} aria-label=${this.recovery?i("secondFactor.recoveryCodeLabel"):i("stepUp.codeLabel")} data-step-up-code
                        .value=${this.code} ?disabled=${this.busy} @input=${y=>this.code=y.target.value} />`}
                </form>
                ${this.recoveryAllowed&&!c?o`<div class="alt"><button type="button" class="link" data-step-up-recovery ?disabled=${this.busy}
                      @click=${()=>{this.recovery=!this.recovery,this.code="",this.error=""}}>${this.recovery?i("secondFactor.recoveryUseApp"):i("secondFactor.recoveryUse")}</button></div>`:h}
                ${n&&e?o`<div class="alt"><button type="button" class="link" data-step-up-pin ?disabled=${this.busy}
                      @click=${()=>{this.pin=!this.pin,this.recovery=!1,this.code="",this.error=""}}>${this.pin?t("אישור בקוד מאפליקציית האימות"):t("אישור בקוד האזעקה האישי")}</button></div>`:h}`:h}`:o`<p class="msg" data-step-up-no-method>${u?i("stepUp.passkeyUnsupported"):this.methods.includes("device_key")&&!this.methods.includes("totp")?t("את מפתח הטלפון אפשר לאשר רק מתוך אפליקציית Android."):i("stepUp.noMethod")}</p>`}
      ${this.error?o`<div class="err" role="alert" data-step-up-error>${this.error}</div>`:h}
      <sw-button slot="footer" data-step-up-cancel ?disabled=${this.busy} @click=${()=>this.answer(!1)}>${i("stepUp.cancel")}</sw-button>
      ${r?o`<sw-button slot="footer" variant="primary" data-step-up-confirm ?disabled=${this.busy||!this.valid} @click=${()=>void this.submit()}>${i("stepUp.confirm")}</sw-button>`:h}
    </sw-dialog>`}};a.styles=S`
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
    /* MFA-T095-REST-2530: the number the phone must type, while the dialog waits for the approval */
    .push {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sw-s-1);
    }
    .push .hint {
      margin: 0;
    }
    .num {
      font-size: var(--sw-fs-3xl);
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--sw-text);
      font-variant-numeric: tabular-nums;
    }
    .err {
      margin: 8px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      text-align: center;
    }
  `;l([w({attribute:!1})],a.prototype,"details",2);l([w({type:Boolean})],a.prototype,"open",2);l([d()],a.prototype,"code",2);l([d()],a.prototype,"busy",2);l([d()],a.prototype,"error",2);l([d()],a.prototype,"passkeyBusy",2);l([d()],a.prototype,"keyId",2);l([d()],a.prototype,"keyBusy",2);l([d()],a.prototype,"recovery",2);l([d()],a.prototype,"pin",2);l([d()],a.prototype,"push",2);a=l([_("sw-step-up-dialog")],a);function es(s){return typeof document>"u"?Promise.resolve(!1):new Promise(e=>{const n=document.createElement("sw-step-up-dialog");n.details=s,n.resolver=e,document.body.append(n),n.open=!0})}export{a as SwStepUpDialog,es as stepUpDialog};
