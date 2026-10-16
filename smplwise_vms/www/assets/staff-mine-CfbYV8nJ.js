import{i as v,J as h,A as b,K as u,t as f,q as a,L as i,G as y,H as d,I as m}from"./index-RuiPclLN.js";var w=Object.defineProperty,g=Object.getOwnPropertyDescriptor,o=(t,e,l,n)=>{for(var r=n>1?void 0:n?g(e,l):e,c=t.length-1,p;c>=0;c--)(p=t[c])&&(r=(n?p(e,l,r):p(r))||r);return n&&r&&w(e,l,r),r};let s=class extends v{constructor(){super(...arguments),this.view=null,this.busy=!1,this.error="",this.hiddenAll=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.view=await h().myStaffMobile()}catch(t){t instanceof b&&(t.status===403||t.status===404)?this.hiddenAll=!0:this.error=u(t)}}async save(t){if(!this.busy){this.busy=!0,this.error="";try{this.view=await h().setMyStaffMobile(t)}catch(e){this.error=u(e),e instanceof b&&e.status===409&&await this.load()}finally{this.busy=!1}}}render(){if(this.hiddenAll)return f;const t=this.view;return t?t.has_phone?a`<div class="row" data-staff-mine=${t.confirmed?"confirmed":"pending"}>
        <span class="num" data-staff-mine-number>${t.phone}</span>
        ${t.confirmed?a`<span class="tag">${i("myMobileConfirmed")}</span>
              <button type="button" ?disabled=${this.busy} data-staff-mine-withdraw @click=${()=>void this.save({confirmed:!1})}>${i("myMobileWithdraw")}</button>`:a`<span class="tag warn">${i("myMobilePending")}</span>
              <button type="button" ?disabled=${this.busy||!t.confirm} data-staff-mine-confirm @click=${()=>t.confirm&&void this.save({confirm:t.confirm})}>${i("myMobileConfirm")}</button>`}
      </div>
      <div class="row"><sw-toggle label=${i("hdMobileWhatsapp")} .checked=${t.notify_whatsapp} ?disabled=${this.busy} data-staff-mine-whatsapp
        @change=${e=>void this.save({notify_whatsapp:e.detail.checked})}></sw-toggle></div>
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:f}`:a`<div class="row" data-staff-mine="none">${i("myMobileNone")}</div>`:this.error?a`<div class="err" role="alert">${this.error}</div>`:f}};s.styles=y`
    :host { display: block; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 0; }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .tag { font-size: var(--sw-type-xs, 12px); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2, rgba(127, 127, 127, 0.15)); }
    .warn { color: var(--sw-warn, #b45309); }
    button { font: inherit; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--sw-border, rgba(127, 127, 127, 0.4)); background: transparent; color: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .err { color: var(--sw-danger, #b91c1c); font-size: var(--sw-type-xs, 12px); }
  `;o([d()],s.prototype,"view",2);o([d()],s.prototype,"busy",2);o([d()],s.prototype,"error",2);o([d()],s.prototype,"hiddenAll",2);s=o([m("tickets-staff-mine")],s);export{s as TicketsStaffMine};
//# sourceMappingURL=staff-mine-CfbYV8nJ.js.map
