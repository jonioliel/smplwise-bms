import{E as f,F as p,G as v,a as h,jO as u,jP as b,jQ as m,jR as x,A as w,jS as k,jT as n,jU as g,e as c,H as j}from"./index-BJ665FDN.js";var $=Object.defineProperty,y=Object.getOwnPropertyDescriptor,o=(s,a,i,r)=>{for(var t=r>1?void 0:r?y(a,i):a,l=s.length-1,d;l>=0;l--)(d=s[l])&&(t=(r?d(a,i,t):d(t))||t);return r&&t&&$(a,i,t),t};let e=class extends h{constructor(){super(...arguments),this.kind="elevator",this.subjectId="",this.access=u(),this.items=null,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.stop=b(s=>{this.access=s,this.load()}),m()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(s){(s.has("subjectId")||s.has("kind"))&&this.load()}async load(){const s=`${this.kind}:${this.subjectId}`;if(!(!this.subjectId||!this.access.enabled||!this.access.view||this.loadedFor===s)){this.loadedFor=s;try{this.items=(await x.bySubject(this.kind,this.subjectId)).items}catch{this.items=null,this.loadedFor=""}}}render(){if(!this.access.enabled||!this.access.view||this.items===null)return w;const s=k(this.items),a=s?`#/tickets/maintenance/ledger?task=${encodeURIComponent(s.task.id)}`:"#/tickets/maintenance/ledger";return c`<div class="r" data-maint-cert-row=${this.kind}><span class="lbl"><sw-icon name="shield" size="14"></sw-icon>${n("certRowTitle")}</span>
      ${s?c`<span class="v" data-maint-cert-text>${s.text}</span><span class="b" data-look=${s.look}>${g(s.task)}</span>`:c`<span class="v" data-maint-cert-none>${n("certRowNone")}</span>`}
      ${s||this.access.manage?c`<a href=${a} data-maint-cert-link @click=${i=>i.stopPropagation()}>${s?n("certRowOpen"):n("certRowAdd")}</a>`:w}</div>`}};e.styles=f`
    :host { display: block; min-inline-size: 0; }
    :host([hidden]) { display: none; }
    .r { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding-block-start: 6px; border-block-start: 1px solid var(--sw-border); }
    .r .lbl { display: inline-flex; align-items: center; gap: 6px; font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); }
    .v { font-variant-numeric: tabular-nums; color: var(--sw-text); font-weight: var(--sw-fw-medium); unicode-bidi: isolate; }
    .b { display: inline-block; padding: 1px 8px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); background: var(--c-soft, var(--sw-surface-3)); color: var(--c-text, var(--sw-text-2)); }
    [data-look='ok'] { --c-soft: var(--sw-success-soft); --c-text: var(--sw-success-text); }
    [data-look='warn'] { --c-soft: var(--sw-warning-soft); --c-text: var(--sw-warning-text); }
    [data-look='alarm'] { --c-soft: var(--sw-danger-soft); --c-text: var(--sw-danger-text); }
    [data-look='unk'] { --c-soft: var(--sw-unknown-soft); --c-text: var(--sw-text-2); }
    a { color: var(--sw-accent-text); text-decoration: none; margin-inline-start: auto; }
    a:hover { text-decoration: underline; }
    a:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; border-radius: var(--sw-r-2xs); }
  `;o([p()],e.prototype,"kind",2);o([p()],e.prototype,"subjectId",2);o([v()],e.prototype,"access",2);o([v()],e.prototype,"items",2);e=o([j("maint-cert-row")],e);
//# sourceMappingURL=cert-row-tOqtp3mK.js.map
