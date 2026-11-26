import{a as T,S as b,P as U,n as S,o as i,q as v,v as s,x as _,A as h,b as r,y as C,j as A,z as $,k as l,m as I}from"./index-CoJbESCx.js";import{i as O,v as M}from"./second-factor-C_ifscPR.js";import{appDeviceKeyId as B,NO_RECOVERY_ACTIONS as D,deviceKeyStepUp as R,DeviceKeyCancelled as z,recoveryStepUp as X}from"./factor-screens-BaWs30B4.js";import{p as L}from"./step-up-passkey-D_cS00b8.js";import{l as N}from"./local-identity-BZBUqfSP.js";import{cancelPushApproval as j,startPushApproval as F,pushApprovalState as K,verifyPushApproval as H,alarmPinStepUp as q}from"./push-approval-D5yTLzdF.js";import"./sw-logo-art-PLtEZJxU.js";var W=Object.defineProperty,G=Object.getOwnPropertyDescriptor,c=(e,t,p,d)=>{for(var a=d>1?void 0:d?G(t,p):t,u=e.length-1,o;u>=0;u--)(o=e[u])&&(a=(d?o(t,p,a):o(a))||a);return d&&a&&W(t,p,a),a};const V=2e3,Y=9e4,J=["system.configure","sources.configure","nvr.configure","site.content.configure","calendar.configure","tickets.configure","backup.manage","system.update","bridge.key.rotate","partner.manage"],g={"alarm.disarm":()=>s("נטרול האזעקה"),"alarm.bypass":()=>s("עקיפת חיישן באזעקה"),"door.open":()=>s("פתיחת דלת"),"identity.local.manage":()=>s("שינוי משתמשים"),"users.ha_manage":()=>s("שינוי משתמשים"),"rbac.assign":()=>s("שינוי הרשאות"),"rbac.roles.manage":()=>s("שינוי הרשאות"),"rbac.system_admin.assign":()=>s("מינוי מנהל מערכת"),"backup.restore":()=>s("שחזור מגיבוי"),...Object.fromEntries(J.map(e=>[e,()=>s("שינוי הגדרות")]))};function Q(e){return typeof e=="string"&&Object.prototype.hasOwnProperty.call(g,e)?g[e]():null}const Z={denied:()=>s("הבקשה נדחתה בטלפון."),expired:()=>s("הבקשה פגה לפני שאושרה. נסה שוב."),cancelled:()=>s("הבקשה בוטלה."),used:()=>s("הבקשה כבר נוצלה. נסה שוב.")};let n=class extends T{constructor(){super(...arguments),this.details={},this.open=!1,this.code="",this.busy=!1,this.error="",this.passkeyBusy=!1,this.keyId=null,this.keyBusy=!1,this.recovery=!1,this.pin=!1,this.push=null,this.pushTimer=null,this.resolver=null,this.expiresMs=Y,this.expiryTimer=null,this.onRoute=()=>this.answer(!1)}connectedCallback(){super.connectedCallback(),this.methods.includes("device_key")&&B().then(e=>this.keyId=e),this.expiryTimer&&clearTimeout(this.expiryTimer),this.expiryTimer=setTimeout(()=>this.answer(!1),this.expiresMs),window.addEventListener("hashchange",this.onRoute)}get recoveryAllowed(){return this.methods.includes("totp")&&!this.details.once&&!D.includes(this.details.action??"")}disconnectedCallback(){super.disconnectedCallback(),this.answer(!1),this.stopExpiry()}stopExpiry(){this.expiryTimer&&clearTimeout(this.expiryTimer),this.expiryTimer=null,window.removeEventListener("hashchange",this.onRoute)}get action(){return typeof this.details.action=="string"?this.details.action:""}get pushOffered(){return this.methods.includes("push")&&!!this.action&&!this.keyId}get pinOffered(){return this.methods.includes("alarm_pin")&&!!this.action}get pinMode(){return this.pinOffered&&(this.pin||!this.methods.includes("totp"))}get methods(){return Array.isArray(this.details.methods)?this.details.methods:[]}get valid(){return this.pinMode?/^\d{4,8}$/.test(this.code.trim()):this.recovery?O(this.code):/^\d{6}$/.test(this.code.replace(/\s+/g,""))}answer(e){const t=this.resolver;t&&(this.resolver=null,this.stopExpiry(),this.stopPush(!e),this.open=!1,t(e),this.updateComplete.then(()=>requestAnimationFrame(()=>this.remove())))}async byPasskey(){if(!this.busy){this.busy=!0,this.passkeyBusy=!0,this.error="";try{await L(this.details.action),window.dispatchEvent(new CustomEvent(b)),this.answer(!0)}catch(e){this.error=e instanceof U?N("passkeyWrongHost",{origin:e.rpId}):e instanceof S?i("stepUp.passkeyCancelled"):v(e)}finally{this.busy=!1,this.passkeyBusy=!1}}}async byDeviceKey(){if(!(this.busy||!this.keyId)){this.busy=!0,this.keyBusy=!0,this.error="";try{await R(this.keyId,i("stepUp.heading"),this.details.action),window.dispatchEvent(new CustomEvent(b)),this.answer(!0)}catch(e){this.error=e instanceof z?s("האישור בטלפון בוטל או נכשל."):v(e)}finally{this.busy=!1,this.keyBusy=!1}}}stopPush(e){this.pushTimer&&clearTimeout(this.pushTimer),this.pushTimer=null;const t=this.push;this.push=null,e&&t&&j(t.id).catch(()=>{})}async byPush(){if(!(this.busy||this.push)){this.busy=!0,this.error="";try{const e=await F(this.action);this.push={id:e.request_id,number:e.number},this.schedulePushPoll()}catch(e){this.error=v(e)}finally{this.busy=!1}}}schedulePushPoll(){this.pushTimer=setTimeout(()=>void this.pollPush(),V)}async pollPush(){const e=this.push;if(!(!e||!this.resolver))try{const t=await K(e.id);if(this.push?.id!==e.id)return;if(t.status==="pending")return this.schedulePushPoll();if(t.status==="approved"){this.busy=!0,await H(e.id,this.action),this.push=null,window.dispatchEvent(new CustomEvent(b)),this.answer(!0);return}this.push=null,this.error=Z[t.status]?.()??s("הבקשה פגה לפני שאושרה. נסה שוב.")}catch(t){this.push=null,this.error=v(t)}finally{this.busy=!1}}async submit(e){if(e?.preventDefault(),!(this.busy||!this.valid)){this.busy=!0,this.error="";try{this.pinMode?await q(this.code.trim(),this.action):this.recovery?await X(this.code.trim(),this.details.action):await M(this.code.replace(/\s+/g,""),this.details.action),window.dispatchEvent(new CustomEvent(b)),this.answer(!0)}catch(t){this.error=v(t),this.code=""}finally{this.busy=!1}}}render(){const e=typeof this.details.minutes=="number"?this.details.minutes:5,t=this.methods.includes("totp"),p=this.pinOffered,d=this.pinMode,a=t||p,u=this.methods.includes("passkey"),o=u&&_(),m=!!this.keyId,f=this.pushOffered,k=a||o||m||f,w=Q(this.details.action),x=w?o&&t?s("כדי להמשיך, אשר במפתח גישה או הזן את הקוד הנוכחי מאפליקציית האימות."):o?s("כדי להמשיך, אשר במפתח גישה במכשיר הזה."):t?s("כדי להמשיך, הזן את הקוד הנוכחי מאפליקציית האימות."):p?s("כדי להמשיך, הזן את קוד האזעקה האישי שלך."):f?s("כדי להמשיך, אשר את הפעולה בטלפון שבו מותקנת האפליקציה."):s("כדי להמשיך, אשר במפתח הטלפון."):o&&t?i("stepUp.bodyBoth"):o?i("stepUp.bodyPasskey"):t?i("stepUp.body"):p?s("כדי להמשיך, הזן את קוד האזעקה האישי שלך."):f?s("כדי להמשיך, אשר את הפעולה בטלפון שבו מותקנת האפליקציה."):s("כדי לשנות הגדרות, משתמשים או הרשאות, אשר במפתח הטלפון."),P=Math.round(this.expiresMs/1e3),E=u&&!o&&(a||m||f);return r`<sw-dialog ?open=${this.open} heading=${i("stepUp.heading")} data-step-up-dialog @close=${y=>{y.stopPropagation(),this.answer(!1)}}>
      ${w?r`<p class="msg action" data-step-up-action>${s("הפעולה: {action}",{action:w})}</p>`:h}
      ${k?r`<p class="msg" data-step-up-text>${x}</p>
            ${E?r`<p class="hint" data-step-up-passkey-elsewhere>${s("למפתח הגישה שלך צריך דפדפן שתומך במפתחות גישה. כאן אפשר לאשר בדרך אחרת.")}</p>`:h}
            <p class="hint" data-step-up-window>${e>0?C("stepUp.window",{minutes:e}):i("stepUp.once")}</p>
            <p class="hint" data-step-up-expiry>${s("אם לא תאשר תוך {seconds} שניות, הבקשה תבוטל ולא תבוצע.",{seconds:P})}</p>
            ${o?r`<div class="pk"><sw-button variant=${a?"secondary":"primary"} data-step-up-passkey ?disabled=${this.busy} @click=${()=>void this.byPasskey()}>${this.passkeyBusy?i("stepUp.passkeyWaiting"):i("stepUp.passkey")}</sw-button></div>`:h}
            ${m?r`<div class="pk"><sw-button variant=${a||o?"secondary":"primary"} icon="sensor" data-step-up-device-key ?disabled=${this.busy} @click=${()=>void this.byDeviceKey()}>${this.keyBusy?s("ממתין לטלפון…"):s("אישור במפתח הטלפון")}</sw-button></div>`:h}
            ${f?this.push?r`<div class="push" role="status" data-step-up-push-wait>
                    <span class="hint">${s("בטלפון, הקלד את המספר:")}</span>
                    <span class="num" dir="ltr" data-step-up-push-number>${this.push.number}</span>
                    <span class="hint">${s("ממתין לאישור בטלפון…")}</span>
                  </div>`:r`<div class="pk"><sw-button variant=${a||o||m?"secondary":"primary"} icon="bell" data-step-up-push ?disabled=${this.busy}
                    @click=${()=>void this.byPush()}>${s("אישור בטלפון")}</sw-button></div>`:h}
            ${(o||m||f)&&a?r`<div class="or" aria-hidden="true">${i("stepUp.or")}</div>`:h}
            ${a?r`<form @submit=${y=>void this.submit(y)}>
                  ${d?r`<input name="code" type="password" inputmode="numeric" autocomplete="off" maxlength="8" spellcheck="false" placeholder="••••"
                        aria-label=${s("קוד האזעקה האישי")} data-step-up-code data-step-up-pin-field
                        .value=${this.code} ?disabled=${this.busy} @input=${y=>this.code=y.target.value} />`:r`<input name="code" inputmode=${this.recovery?"text":"numeric"} autocomplete="one-time-code" maxlength=${this.recovery?11:7} autocapitalize=${this.recovery?"characters":"off"}
                        spellcheck="false" placeholder=${this.recovery?"XXXX-XXXX":"000000"} aria-label=${this.recovery?i("secondFactor.recoveryCodeLabel"):i("stepUp.codeLabel")} data-step-up-code
                        .value=${this.code} ?disabled=${this.busy} @input=${y=>this.code=y.target.value} />`}
                </form>
                ${this.recoveryAllowed&&!d?r`<div class="alt"><button type="button" class="link" data-step-up-recovery ?disabled=${this.busy}
                      @click=${()=>{this.recovery=!this.recovery,this.code="",this.error=""}}>${this.recovery?i("secondFactor.recoveryUseApp"):i("secondFactor.recoveryUse")}</button></div>`:h}
                ${p&&t?r`<div class="alt"><button type="button" class="link" data-step-up-pin ?disabled=${this.busy}
                      @click=${()=>{this.pin=!this.pin,this.recovery=!1,this.code="",this.error=""}}>${this.pin?s("אישור בקוד מאפליקציית האימות"):s("אישור בקוד האזעקה האישי")}</button></div>`:h}`:h}`:r`<p class="msg" data-step-up-no-method>${u?i("stepUp.passkeyUnsupported"):this.methods.includes("device_key")&&!this.methods.includes("totp")?s("את מפתח הטלפון אפשר לאשר רק מתוך אפליקציית Android."):i("stepUp.noMethod")}</p>`}
      ${this.error?r`<div class="err" role="alert" data-step-up-error>${this.error}</div>`:h}
      <sw-button slot="footer" data-step-up-cancel ?disabled=${this.busy} @click=${()=>this.answer(!1)}>${i("stepUp.cancel")}</sw-button>
      ${a?r`<sw-button slot="footer" variant="primary" data-step-up-confirm ?disabled=${this.busy||!this.valid} @click=${()=>void this.submit()}>${i("stepUp.confirm")}</sw-button>`:h}
    </sw-dialog>`}};n.styles=A`
    .msg {
      margin: 0 0 6px;
      color: var(--sw-text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    /* CLIENT-RESILIENCE-2540 (SCR-23): the refused action, named above the method sentence */
    .msg.action {
      font-weight: var(--sw-fw-semibold);
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
  `;c([$({attribute:!1})],n.prototype,"details",2);c([$({type:Boolean})],n.prototype,"open",2);c([l()],n.prototype,"code",2);c([l()],n.prototype,"busy",2);c([l()],n.prototype,"error",2);c([l()],n.prototype,"passkeyBusy",2);c([l()],n.prototype,"keyId",2);c([l()],n.prototype,"keyBusy",2);c([l()],n.prototype,"recovery",2);c([l()],n.prototype,"pin",2);c([l()],n.prototype,"push",2);n=c([I("sw-step-up-dialog")],n);function ne(e){return typeof document>"u"?Promise.resolve(!1):new Promise(t=>{const p=document.createElement("sw-step-up-dialog");p.details=e,p.resolver=t,document.body.append(p),p.open=!0})}export{n as SwStepUpDialog,ne as stepUpDialog};
