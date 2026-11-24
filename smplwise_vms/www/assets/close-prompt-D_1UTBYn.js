import{i as v,dX as b,m as h,A as u,b as l,dS as w,dU as m,bf as y,g as x,j as a,k}from"./index-DD6xpkEV.js";import{m as i}from"./maintenance-CCI9l9pJ.js";import{f as g}from"./model-OsGHRZuD.js";import"./sw-logo-art-PLtEZJxU.js";var $=Object.defineProperty,C=Object.getOwnPropertyDescriptor,r=(t,s,c,n)=>{for(var o=n>1?void 0:n?C(s,c):s,p=t.length-1,d;p>=0;p--)(d=t[p])&&(o=(n?d(s,c,o):d(o))||o);return n&&o&&$(s,c,o),o};const f="sw:ticket-closed";let e=class extends v{constructor(){super(...arguments),this.ticketId="",this.plan=null,this.busy=!1,this.error="",this.toast="",this.onClosed=t=>{const s=m();!s.enabled||!(s.perform||s.manage)||this.ask(t.detail?.id??"")}}connectedCallback(){super.connectedCallback(),window.addEventListener(f,this.onClosed)}disconnectedCallback(){window.removeEventListener(f,this.onClosed),super.disconnectedCallback()}async ask(t){if(t)try{const s=await b.closeProposal(t);s.proposal&&(this.ticketId=t,this.plan=s.proposal,this.error="")}catch{}}async yes(){this.busy=!0,this.error="";try{await b.confirmClose(this.ticketId),this.plan=null,this.toast=i("closeDoneToast"),window.setTimeout(()=>{this.toast=""},2600)}catch(t){this.error=h(t)}finally{this.busy=!1}}render(){const t=this.plan;return l`${t?l`<sw-dialog open heading=${i("closeAskTitle")} data-maint-close-prompt @close=${()=>{this.plan=null}}>
        <p>${i(t.kind==="preventive"?"closeAskBody":"closeAskBodyDoc",{t:t.title,d:t.next_due?g(t.next_due):""})}</p>
        ${this.error?l`<div class="err" role="alert">${this.error}</div>`:u}
        <div class="acts" slot="footer"><button type="button" class="btn" data-maint-close-no @click=${()=>{this.plan=null}}>${i("closeAskNo")}</button>
          <button type="button" class="btn pri" ?disabled=${this.busy} data-maint-close-yes @click=${()=>void this.yes()}>${i("closeAskYes")}</button></div>
      </sw-dialog>`:u}
      ${this.toast?l`<div class="toast" role="status" aria-live="polite" ${w()}>${this.toast}</div>`:u}`}};e.styles=[y,x`
    :host { display: contents; }
    .acts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; inline-size: 100%; }
    .btn { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--sw-r-pill); padding: 8px 16px; min-block-size: 40px; border: 1px solid var(--sw-border); background: var(--sw-surface);
      color: var(--sw-text); font: inherit; font-weight: var(--sw-fw-semibold); cursor: pointer; }
    .btn.pri { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-accent-on, #fff); }
    .btn:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .err { color: var(--sw-danger-text); margin-block-start: 8px; }
    .toast { position: fixed; inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 20px); inset-inline: 0; margin-inline: auto; inline-size: max-content; max-inline-size: 90vw; background: var(--sw-toast-bg);
      color: var(--sw-toast-text); border-radius: var(--sw-r-pill); padding: 8px 16px; z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2); }
  `];r([a()],e.prototype,"ticketId",2);r([a()],e.prototype,"plan",2);r([a()],e.prototype,"busy",2);r([a()],e.prototype,"error",2);r([a()],e.prototype,"toast",2);e=r([k("maint-close-prompt")],e);export{e as MaintClosePrompt};
