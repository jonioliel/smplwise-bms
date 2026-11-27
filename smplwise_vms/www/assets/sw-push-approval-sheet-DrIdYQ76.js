import{j as m,z as d,k as h,a as b,v as t,q as v,A as u,b as p,m as y}from"./index-B3MtI4W-.js";import{deviceKeyBridge as w,DeviceKeyCancelled as g}from"./factor-screens-Bcco-vro.js";import{approvePushApproval as $,denyPushApproval as x}from"./push-approval-DvkQDjN2.js";import"./sw-logo-art-PLtEZJxU.js";var _=Object.defineProperty,k=Object.getOwnPropertyDescriptor,n=(e,s,r,o)=>{for(var a=o>1?void 0:o?k(s,r):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(a=(o?c(s,r,a):c(a))||a);return o&&a&&_(s,r,a),a};const C={"alarm.disarm":()=>t("נטרול האזעקה"),"alarm.bypass":()=>t("עקיפת חיישן באזעקה"),"door.open":()=>t("פתיחת דלת"),"identity.local.manage":()=>t("שינוי משתמשים"),"users.ha_manage":()=>t("שינוי משתמשים"),"rbac.assign":()=>t("שינוי הרשאות"),"rbac.roles.manage":()=>t("שינוי הרשאות")};function f(e){return C[e]?.()??t("שינוי הגדרות")}let i=class extends b{constructor(){super(...arguments),this.request=null,this.keyId="",this.open=!1,this.busy=!1,this.error="",this.done="",this.typed="",this.onClosed=null}close(){if(!this.open)return;this.open=!1;const e=this.onClosed;this.onClosed=null,e?.(),this.updateComplete.then(()=>requestAnimationFrame(()=>this.remove()))}disconnectedCallback(){super.disconnectedCallback();const e=this.onClosed;this.onClosed=null,e?.()}get number(){return/^\d{2}$/.test(this.typed.trim())?Number(this.typed.trim()):null}async approve(e){e?.preventDefault();const s=this.request,r=this.number,o=w();if(!(this.busy||!s||r===null||!o||!this.keyId)){this.busy=!0,this.error="";try{(await $(s.request_id,this.keyId,r,`${f(s.action)} · ${r}`,o)).status==="approved"?this.done=t("אושר. אפשר לחזור למסך שביקש."):this.error=t("הבקשה כבר לא ממתינה.")}catch(a){this.error=a instanceof g?t("האישור בטלפון בוטל או נכשל."):v(a);const l=a;(l?.body?.code==="push_approval_number_mismatch"||l?.body?.code==="push_approval_unknown")&&(this.request=null)}finally{this.busy=!1}}}async deny(){const e=this.request;if(!(this.busy||!e)){this.busy=!0,this.error="";try{await x(e.request_id),this.done=t("הבקשה נדחתה.")}catch(s){this.error=v(s)}finally{this.busy=!1}}}render(){const e=this.request,s=!!e&&!this.done;return p`<sw-dialog ?open=${this.open} heading=${t("בקשת אישור")} data-push-approval-sheet @close=${r=>{r.stopPropagation(),this.close()}}>
      ${e&&s?p`<p class="msg" data-push-approval-what>${t("מכשיר אחר שמחובר לחשבון שלך מבקש לאשר:")} <span class="what">${f(e.action)}</span></p>
            <p class="hint">${t("הקלד את המספר שמופיע במסך שביקש. אם לא אתה ביקשת - דחה.")}</p>
            <form @submit=${r=>void this.approve(r)}>
              <input name="number" inputmode="numeric" autocomplete="off" maxlength="2" spellcheck="false" placeholder="00" aria-label=${t("המספר שעל המסך")}
                data-push-approval-number .value=${this.typed} ?disabled=${this.busy} @input=${r=>this.typed=r.target.value} />
            </form>`:u}
      ${this.done?p`<p class="ok" role="status" data-push-approval-done>${this.done}</p>`:u}
      ${this.error?p`<div class="err" role="alert" data-push-approval-error>${this.error}</div>`:u}
      ${s?p`<sw-button slot="footer" variant="danger" data-push-approval-deny ?disabled=${this.busy} @click=${()=>void this.deny()}>${t("לא אני - לדחות")}</sw-button>`:u}
      <sw-button slot="footer" data-push-approval-close ?disabled=${this.busy} @click=${()=>this.close()}>${t("סגור")}</sw-button>
      ${s?p`<sw-button slot="footer" variant="primary" icon="check" data-push-approval-confirm ?disabled=${this.busy||this.number===null} @click=${()=>void this.approve()}>${t("אישור")}</sw-button>`:u}
    </sw-dialog>`}};i.styles=m`
    .msg {
      margin: 0 0 var(--sw-s-1);
      color: var(--sw-text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .what {
      font-weight: 700;
    }
    .hint {
      margin: 0 0 var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    form {
      display: flex;
      justify-content: center;
    }
    input {
      inline-size: 4.5em;
      min-block-size: var(--sw-ctl-h-lg);
      padding: 0 var(--sw-s-2);
      border: var(--sw-check-border-w) solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-2xl);
      font-weight: 700;
      letter-spacing: 0.2em;
      text-align: center;
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .err {
      margin: var(--sw-s-2) 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      text-align: center;
    }
    .ok {
      margin: var(--sw-s-2) 0 0;
      color: var(--sw-text);
      text-align: center;
    }
  `;n([d({attribute:!1})],i.prototype,"request",2);n([d({attribute:!1})],i.prototype,"keyId",2);n([d({type:Boolean})],i.prototype,"open",2);n([h()],i.prototype,"busy",2);n([h()],i.prototype,"error",2);n([h()],i.prototype,"done",2);n([h()],i.prototype,"typed",2);i=n([y("sw-push-approval-sheet")],i);function I(e,s){return new Promise(r=>{const o=document.createElement("sw-push-approval-sheet");o.request=e,o.keyId=s,o.onClosed=r,document.body.append(o),o.open=!0})}export{i as SwPushApprovalSheet,I as showPushApproval};
