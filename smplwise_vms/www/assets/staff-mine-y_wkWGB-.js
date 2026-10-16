import{i as v,J as h,A as u,K as b,t as p,q as i,L as a,G as m,H as d,I as w}from"./index-CveX3hFh.js";var y=Object.defineProperty,g=Object.getOwnPropertyDescriptor,o=(t,s,l,n)=>{for(var e=n>1?void 0:n?g(s,l):s,c=t.length-1,f;c>=0;c--)(f=t[c])&&(e=(n?f(s,l,e):f(e))||e);return n&&e&&y(s,l,e),e};let r=class extends v{constructor(){super(...arguments),this.view=null,this.busy=!1,this.error="",this.hiddenAll=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.view=await h().myStaffMobile()}catch(t){t instanceof u&&(t.status===403||t.status===404)?this.hiddenAll=!0:this.error=b(t)}}async save(t){if(!this.busy){this.busy=!0,this.error="";try{this.view=await h().setMyStaffMobile(t)}catch(s){this.error=b(s),s instanceof u&&s.status===409&&await this.load()}finally{this.busy=!1}}}render(){if(this.hiddenAll)return p;const t=this.view;return t?t.has_phone?i`<div class="row" data-staff-mine=${t.confirmed?"confirmed":"pending"}>
        <span class="num" data-staff-mine-number>${t.phone}</span>
        ${t.confirmed?i`<span class="tag">${a("myMobileConfirmed")}</span>
              <button type="button" ?disabled=${this.busy} data-staff-mine-withdraw @click=${()=>void this.save({confirmed:!1})}>${a("myMobileWithdraw")}</button>`:i`<span class="tag warn">${a("myMobilePending")}</span>
              <button type="button" ?disabled=${this.busy||!t.confirm} data-staff-mine-confirm @click=${()=>t.confirm&&void this.save({confirm:t.confirm})}>${a("myMobileConfirm")}</button>`}
      </div>
      <div class="row"><sw-toggle label=${a("hdMobileWhatsapp")} .checked=${t.notify_whatsapp} ?disabled=${this.busy} data-staff-mine-whatsapp
        @change=${s=>void this.save({notify_whatsapp:s.detail.checked})}></sw-toggle></div>
      ${this.error?i`<div class="err" role="alert">${this.error}</div>`:p}`:i`<div class="row" data-staff-mine="none">${a("myMobileNone")}</div>`:this.error?i`<div class="err" role="alert">${this.error}</div>`:p}};r.styles=m`
    :host { display: block; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 0; }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .tag { font-size: var(--sw-fs-xs); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); }
    .warn { color: var(--sw-warning-text); }
    button { font: inherit; padding: 4px 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
  `;o([d()],r.prototype,"view",2);o([d()],r.prototype,"busy",2);o([d()],r.prototype,"error",2);o([d()],r.prototype,"hiddenAll",2);r=o([w("tickets-staff-mine")],r);export{r as TicketsStaffMine};
//# sourceMappingURL=staff-mine-y_wkWGB-.js.map
