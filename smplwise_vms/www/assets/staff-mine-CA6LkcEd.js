import{a as v,t as u,A as b,aV as h,aW as w,G as c,I as r,N as e,aX as y,an as m,ap as d,aq as $}from"./index-BzjrnJ6a.js";import"./transit-logic-DKeOUjSD.js";var g=Object.defineProperty,x=Object.getOwnPropertyDescriptor,a=(t,i,o,l)=>{for(var n=l>1?void 0:l?x(i,o):i,p=t.length-1,f;p>=0;p--)(f=t[p])&&(n=(l?f(i,o,n):f(n))||n);return l&&n&&g(i,o,n),n};let s=class extends v{constructor(){super(...arguments),this.view=null,this.busy=!1,this.error="",this.hiddenAll=!1,this.codeSent=!1,this.code="",this.cooldown=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.view=await u().myStaffMobile()}catch(t){t instanceof b&&(t.status===403||t.status===404)?this.hiddenAll=!0:this.error=h(t)}}async save(t){if(!this.busy){this.busy=!0,this.error="";try{this.view=await u().setMyStaffMobile(t)}catch(i){this.error=h(i),i instanceof b&&i.status===409&&await this.load()}finally{this.busy=!1}}}async sendCode(){if(!this.busy){this.busy=!0,this.error="";try{await w.mySend(),this.codeSent=!0,this.cooldown=60,window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.cooldown=Math.max(0,this.cooldown-1),this.cooldown||window.clearInterval(this.timer)},1e3)}catch(t){this.error=h(t)}finally{this.busy=!1}}}async checkCode(){if(!this.busy){this.busy=!0,this.error="";try{this.view=await w.myCheck(this.code),this.code="",this.codeSent=!1}catch(t){this.error=h(t)}finally{this.busy=!1}}}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}render(){if(this.hiddenAll)return c;const t=this.view;if(!t)return this.error?r`<div class="err" role="alert">${this.error}</div>`:c;if(!t.has_phone)return r`<div class="row" data-staff-mine="none">${e("myMobileNone")}</div>`;const i=!t.confirmed&&!!t.verify_required;return r`<div class="row" data-staff-mine=${t.confirmed?"confirmed":i?"code":"pending"}>
        <span class="num" data-staff-mine-number>${t.phone}</span>
        ${t.confirmed?r`<span class="tag">${e("myMobileConfirmed")}</span>
              <button type="button" ?disabled=${this.busy} data-staff-mine-withdraw @click=${()=>void this.save({confirmed:!1})}>${e("myMobileWithdraw")}</button>`:i?r`<span class="tag warn">${e("otpRequired")}</span>
                <button type="button" ?disabled=${this.busy||this.cooldown>0} data-staff-mine-send @click=${()=>void this.sendCode()}>
                  ${this.codeSent?e("otpResend"):e("otpSend")}${this.cooldown?` (${this.cooldown})`:""}</button>`:r`<span class="tag warn">${e("myMobilePending")}</span>
              <button type="button" ?disabled=${this.busy||!t.confirm} data-staff-mine-confirm @click=${()=>t.confirm&&void this.save({confirm:t.confirm})}>${e("myMobileConfirm")}</button>`}
      </div>
      ${i?r`<div class="hint">${this.codeSent?e("otpSent"):e("otpMineHint")}</div>
        ${this.codeSent?r`<div class="row"><input inputmode="numeric" autocomplete="one-time-code" maxlength="9" aria-label=${e("otpCodeLabel")} placeholder="000000"
            .value=${this.code} data-staff-mine-code @input=${o=>{this.code=o.target.value}}>
          <button type="button" ?disabled=${this.busy||!y(this.code)} data-staff-mine-check @click=${()=>void this.checkCode()}>${e("otpVerify")}</button></div>`:c}`:c}
      <div class="row"><sw-toggle label=${e("hdMobileWhatsapp")} .checked=${t.notify_whatsapp} ?disabled=${this.busy} data-staff-mine-whatsapp
        @change=${o=>void this.save({notify_whatsapp:o.detail.checked})}></sw-toggle></div>
      ${this.error?r`<div class="err" role="alert">${this.error}</div>`:c}`}};s.styles=m`
    :host { display: block; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 0; }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .tag { font-size: var(--sw-fs-xs); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); }
    .warn { color: var(--sw-warning-text); }
    button { font: inherit; padding: 4px 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .hint { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    input { font: inherit; width: 9ch; padding: 4px 8px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit;
      direction: ltr; text-align: center; letter-spacing: 0.15em; font-variant-numeric: tabular-nums; }
  `;a([d()],s.prototype,"view",2);a([d()],s.prototype,"busy",2);a([d()],s.prototype,"error",2);a([d()],s.prototype,"hiddenAll",2);a([d()],s.prototype,"codeSent",2);a([d()],s.prototype,"code",2);a([d()],s.prototype,"cooldown",2);s=a([$("tickets-staff-mine")],s);export{s as TicketsStaffMine};
//# sourceMappingURL=staff-mine-CA6LkcEd.js.map
