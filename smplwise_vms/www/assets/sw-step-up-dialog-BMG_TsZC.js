import{a as S,S as w,P as _,n as C,o as i,q as b,v as e,x as A,A as h,b as r,y as I,j as O,z as P,k as l,m as R}from"./index-DlIoBDHe.js";import{i as B,v as M}from"./second-factor-B2569KpR.js";import{appDeviceKeyId as D,NO_RECOVERY_ACTIONS as z,deviceKeyStepUp as X,DeviceKeyCancelled as j,recoveryStepUp as L}from"./factor-screens-BYjcVmCM.js";import{p as N}from"./step-up-passkey-Bp1MF-fb.js";import{l as F}from"./local-identity-CQdo5ps8.js";import{cancelPushApproval as K,startPushApproval as H,pushApprovalState as q,verifyPushApproval as W,pushPollRetryDelay as G,alarmPinStepUp as V}from"./push-approval-wQtplOQh.js";import"./sw-logo-art-PLtEZJxU.js";var Y=Object.defineProperty,J=Object.getOwnPropertyDescriptor,c=(s,t,a,u)=>{for(var o=u>1?void 0:u?J(t,a):t,d=s.length-1,n;d>=0;d--)(n=s[d])&&(o=(u?n(t,a,o):n(o))||o);return u&&o&&Y(t,a,o),o};const Q=2e3,Z=9e4,ss=["system.configure","sources.configure","nvr.configure","site.content.configure","calendar.configure","tickets.configure","backup.manage","system.update","bridge.key.rotate","partner.manage"],x={"alarm.disarm":()=>e("נטרול האזעקה"),"alarm.bypass":()=>e("עקיפת חיישן באזעקה"),"door.open":()=>e("פתיחת דלת"),"identity.local.manage":()=>e("שינוי משתמשים"),"users.ha_manage":()=>e("שינוי משתמשים"),"rbac.assign":()=>e("שינוי הרשאות"),"rbac.roles.manage":()=>e("שינוי הרשאות"),"rbac.system_admin.assign":()=>e("מינוי מנהל מערכת"),"backup.restore":()=>e("שחזור מגיבוי"),...Object.fromEntries(ss.map(s=>[s,()=>e("שינוי הגדרות")]))};function es(s){return typeof s=="string"&&Object.prototype.hasOwnProperty.call(x,s)?x[s]():null}const ts={denied:()=>e("הבקשה נדחתה בטלפון."),expired:()=>e("הבקשה פגה לפני שאושרה. נסה שוב."),cancelled:()=>e("הבקשה בוטלה."),used:()=>e("הבקשה כבר נוצלה. נסה שוב.")};let p=class extends S{constructor(){super(...arguments),this.details={},this.open=!1,this.code="",this.busy=!1,this.error="",this.passkeyBusy=!1,this.keyId=null,this.keyBusy=!1,this.recovery=!1,this.pin=!1,this.push=null,this.pushTimer=null,this.resolver=null,this.expiresMs=Z,this.expiryTimer=null,this.onRoute=()=>this.answer(!1),this.pushRefusals=0}connectedCallback(){super.connectedCallback(),this.methods.includes("device_key")&&D().then(s=>this.keyId=s),this.expiryTimer&&clearTimeout(this.expiryTimer),this.expiryTimer=setTimeout(()=>this.answer(!1),this.expiresMs),window.addEventListener("hashchange",this.onRoute)}get recoveryAllowed(){return this.methods.includes("totp")&&!this.details.once&&!z.includes(this.details.action??"")}disconnectedCallback(){super.disconnectedCallback(),this.answer(!1),this.stopExpiry()}stopExpiry(){this.expiryTimer&&clearTimeout(this.expiryTimer),this.expiryTimer=null,window.removeEventListener("hashchange",this.onRoute)}get action(){return typeof this.details.action=="string"?this.details.action:""}get pushOffered(){return this.methods.includes("push")&&!!this.action&&!this.keyId}get pinOffered(){return this.methods.includes("alarm_pin")&&!!this.action}get pinMode(){return this.pinOffered&&(this.pin||!this.methods.includes("totp"))}get methods(){return Array.isArray(this.details.methods)?this.details.methods:[]}get valid(){return this.pinMode?/^\d{4,8}$/.test(this.code.trim()):this.recovery?B(this.code):/^\d{6}$/.test(this.code.replace(/\s+/g,""))}answer(s){const t=this.resolver;t&&(this.resolver=null,this.stopExpiry(),this.stopPush(!s),this.open=!1,t(s),this.updateComplete.then(()=>requestAnimationFrame(()=>this.remove())))}async byPasskey(){if(!this.busy){this.busy=!0,this.passkeyBusy=!0,this.error="";try{await N(this.details.action),window.dispatchEvent(new CustomEvent(w)),this.answer(!0)}catch(s){this.error=s instanceof _?F("passkeyWrongHost",{origin:s.rpId}):s instanceof C?i("stepUp.passkeyCancelled"):b(s)}finally{this.busy=!1,this.passkeyBusy=!1}}}async byDeviceKey(){if(!(this.busy||!this.keyId)){this.busy=!0,this.keyBusy=!0,this.error="";try{await X(this.keyId,i("stepUp.heading"),this.details.action),window.dispatchEvent(new CustomEvent(w)),this.answer(!0)}catch(s){this.error=s instanceof j?e("האישור בטלפון בוטל או נכשל."):b(s)}finally{this.busy=!1,this.keyBusy=!1}}}stopPush(s){this.pushTimer&&clearTimeout(this.pushTimer),this.pushTimer=null;const t=this.push;this.push=null,s&&t&&K(t.id).catch(()=>{})}async byPush(){if(!(this.busy||this.push)){this.busy=!0,this.error="";try{const s=await H(this.action);this.push={id:s.request_id,number:s.number},this.pushRefusals=0,this.schedulePushPoll()}catch(s){this.error=b(s)}finally{this.busy=!1}}}schedulePushPoll(s=Q){this.pushTimer=setTimeout(()=>void this.pollPush(),s)}async pollPush(){const s=this.push;if(!(!s||!this.resolver))try{const t=await q(s.id);if(this.push?.id!==s.id)return;if(this.pushRefusals=0,t.status==="pending")return this.schedulePushPoll();if(t.status==="approved"){this.busy=!0,await W(s.id,this.action),this.push=null,window.dispatchEvent(new CustomEvent(w)),this.answer(!0);return}this.push=null,this.error=ts[t.status]?.()??e("הבקשה פגה לפני שאושרה. נסה שוב.")}catch(t){const a=this.push?.id===s.id?G(t,this.pushRefusals):null;if(a!==null)return this.pushRefusals+=1,this.schedulePushPoll(a);this.push=null,this.error=b(t)}finally{this.busy=!1}}async submit(s){if(s?.preventDefault(),!(this.busy||!this.valid)){this.busy=!0,this.error="";try{this.pinMode?await V(this.code.trim(),this.action):this.recovery?await L(this.code.trim(),this.details.action):await M(this.code.replace(/\s+/g,""),this.details.action),window.dispatchEvent(new CustomEvent(w)),this.answer(!0)}catch(t){this.error=b(t),this.code=""}finally{this.busy=!1}}}render(){const s=typeof this.details.minutes=="number"?this.details.minutes:5,t=this.methods.includes("totp"),a=this.pinOffered,u=this.pinMode,o=t||a,d=this.methods.includes("passkey"),n=d&&A(),v=!!this.keyId,f=this.pushOffered,E=o||n||v||f,m=es(this.details.action),T=m?n&&t?e("כדי להמשיך, אשר במפתח גישה או הזן את הקוד הנוכחי מאפליקציית האימות."):n?e("כדי להמשיך, אשר במפתח גישה במכשיר הזה."):t?e("כדי להמשיך, הזן את הקוד הנוכחי מאפליקציית האימות."):a?e("כדי להמשיך, הזן את קוד האזעקה האישי שלך."):f?e("כדי להמשיך, אשר את הפעולה בטלפון שבו מותקנת האפליקציה."):e("כדי להמשיך, אשר במפתח הטלפון."):n&&t?i("stepUp.bodyBoth"):n?i("stepUp.bodyPasskey"):t?i("stepUp.body"):a?e("כדי להמשיך, הזן את קוד האזעקה האישי שלך."):f?e("כדי להמשיך, אשר את הפעולה בטלפון שבו מותקנת האפליקציה."):e("כדי לשנות הגדרות, משתמשים או הרשאות, אשר במפתח הטלפון."),$=Math.round(this.expiresMs/1e3),U=d&&!n&&(o||v||f),k=m?"su-action su-expiry":"su-expiry",g=[m?e("הפעולה: {action}",{action:m}):"",e("אם לא תאשר תוך {seconds} שניות, הבקשה תבוטל ולא תבוצע.",{seconds:$})].filter(Boolean).join(". ");return r`<sw-dialog ?open=${this.open} heading=${i("stepUp.heading")} data-step-up-dialog @close=${y=>{y.stopPropagation(),this.answer(!1)}}>
      ${m?r`<p class="msg action" id="su-action" data-step-up-action>${e("הפעולה: {action}",{action:m})}</p>`:h}
      ${E?r`<p class="msg" data-step-up-text>${T}</p>
            ${U?r`<p class="hint" data-step-up-passkey-elsewhere>${e("למפתח הגישה שלך צריך דפדפן שתומך במפתחות גישה. כאן אפשר לאשר בדרך אחרת.")}</p>`:h}
            <p class="hint" data-step-up-window>${s>0?I("stepUp.window",{minutes:s}):i("stepUp.once")}</p>
            <p class="hint" id="su-expiry" data-step-up-expiry>${e("אם לא תאשר תוך {seconds} שניות, הבקשה תבוטל ולא תבוצע.",{seconds:$})}</p>
            ${n?r`<div class="pk"><sw-button variant=${o?"secondary":"primary"} description=${g} data-step-up-passkey ?disabled=${this.busy} @click=${()=>void this.byPasskey()}>${this.passkeyBusy?i("stepUp.passkeyWaiting"):i("stepUp.passkey")}</sw-button></div>`:h}
            ${v?r`<div class="pk"><sw-button variant=${o||n?"secondary":"primary"} icon="sensor" description=${g} data-step-up-device-key ?disabled=${this.busy} @click=${()=>void this.byDeviceKey()}>${this.keyBusy?e("ממתין לטלפון…"):e("אישור במפתח הטלפון")}</sw-button></div>`:h}
            ${f?this.push?r`<div class="push" role="status" data-step-up-push-wait>
                    <span class="hint">${e("בטלפון, הקלד את המספר:")}</span>
                    <span class="num" dir="ltr" data-step-up-push-number>${this.push.number}</span>
                    <span class="hint">${e("ממתין לאישור בטלפון…")}</span>
                  </div>`:r`<div class="pk"><sw-button variant=${o||n||v?"secondary":"primary"} icon="bell" description=${g} data-step-up-push ?disabled=${this.busy}
                    @click=${()=>void this.byPush()}>${e("אישור בטלפון")}</sw-button></div>`:h}
            ${(n||v||f)&&o?r`<div class="or" aria-hidden="true">${i("stepUp.or")}</div>`:h}
            ${o?r`<form @submit=${y=>void this.submit(y)}>
                  ${u?r`<input name="code" type="password" inputmode="numeric" autocomplete="off" maxlength="8" spellcheck="false" placeholder="••••"
                        aria-label=${e("קוד האזעקה האישי")} aria-describedby=${k} data-step-up-code data-step-up-pin-field
                        .value=${this.code} ?disabled=${this.busy} @input=${y=>this.code=y.target.value} />`:r`<input name="code" inputmode=${this.recovery?"text":"numeric"} autocomplete="one-time-code" maxlength=${this.recovery?11:7} autocapitalize=${this.recovery?"characters":"off"}
                        spellcheck="false" placeholder=${this.recovery?"XXXX-XXXX":"000000"} aria-label=${this.recovery?i("secondFactor.recoveryCodeLabel"):i("stepUp.codeLabel")} aria-describedby=${k} data-step-up-code
                        .value=${this.code} ?disabled=${this.busy} @input=${y=>this.code=y.target.value} />`}
                </form>
                ${this.recoveryAllowed&&!u?r`<div class="alt"><button type="button" class="link" data-step-up-recovery ?disabled=${this.busy}
                      @click=${()=>{this.recovery=!this.recovery,this.code="",this.error=""}}>${this.recovery?i("secondFactor.recoveryUseApp"):i("secondFactor.recoveryUse")}</button></div>`:h}
                ${a&&t?r`<div class="alt"><button type="button" class="link" data-step-up-pin ?disabled=${this.busy}
                      @click=${()=>{this.pin=!this.pin,this.recovery=!1,this.code="",this.error=""}}>${this.pin?e("אישור בקוד מאפליקציית האימות"):e("אישור בקוד האזעקה האישי")}</button></div>`:h}`:h}`:r`<p class="msg" data-step-up-no-method>${d?i("stepUp.passkeyUnsupported"):this.methods.includes("device_key")&&!this.methods.includes("totp")?e("את מפתח הטלפון אפשר לאשר רק מתוך אפליקציית Android."):i("stepUp.noMethod")}</p>`}
      ${this.error?r`<div class="err" role="alert" data-step-up-error>${this.error}</div>`:h}
      <sw-button slot="footer" data-step-up-cancel ?disabled=${this.busy} @click=${()=>this.answer(!1)}>${i("stepUp.cancel")}</sw-button>
      ${o?r`<sw-button slot="footer" variant="primary" data-step-up-confirm ?disabled=${this.busy||!this.valid} @click=${()=>void this.submit()}>${i("stepUp.confirm")}</sw-button>`:h}
    </sw-dialog>`}};p.styles=O`
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
  `;c([P({attribute:!1})],p.prototype,"details",2);c([P({type:Boolean})],p.prototype,"open",2);c([l()],p.prototype,"code",2);c([l()],p.prototype,"busy",2);c([l()],p.prototype,"error",2);c([l()],p.prototype,"passkeyBusy",2);c([l()],p.prototype,"keyId",2);c([l()],p.prototype,"keyBusy",2);c([l()],p.prototype,"recovery",2);c([l()],p.prototype,"pin",2);c([l()],p.prototype,"push",2);p=c([R("sw-step-up-dialog")],p);function hs(s){return typeof document>"u"?Promise.resolve(!1):new Promise(t=>{const a=document.createElement("sw-step-up-dialog");a.details=s,a.resolver=t,document.body.append(a),a.open=!0})}export{p as SwStepUpDialog,hs as stepUpDialog};
