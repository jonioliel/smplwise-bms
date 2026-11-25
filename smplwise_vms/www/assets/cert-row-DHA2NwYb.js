import{c$ as f,g as h,y as p,j as v,i as u,e3 as m,e4 as b,e5 as x,e6 as k,A as w,b as n,k as g}from"./index-BMsqo0rz.js";import{m as c}from"./maintenance-ByJIbLtP.js";import{c as $,b as y}from"./model-DVq4yCP1.js";var j=Object.defineProperty,C=Object.getOwnPropertyDescriptor,i=(t,a,o,r)=>{for(var s=r>1?void 0:r?C(a,o):a,l=t.length-1,d;l>=0;l--)(d=t[l])&&(s=(r?d(a,o,s):d(s))||s);return r&&s&&j(a,o,s),s};let e=class extends u{constructor(){super(...arguments),this.kind="elevator",this.subjectId="",this.access=m(),this.items=null,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.stop=b(t=>{this.access=t,this.load()}),x()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){(t.has("subjectId")||t.has("kind"))&&this.load()}async load(){const t=`${this.kind}:${this.subjectId}`;if(!(!this.subjectId||!this.access.enabled||!this.access.view||this.loadedFor===t)){this.loadedFor=t;try{this.items=(await k.bySubject(this.kind,this.subjectId)).items}catch{this.items=null,this.loadedFor=""}}}render(){if(!this.access.enabled||!this.access.view||this.items===null)return w;const t=$(this.items),a=t?`#/tickets/maintenance/ledger?task=${encodeURIComponent(t.task.id)}`:"#/tickets/maintenance/ledger";return n`<div class="r" data-maint-cert-row=${this.kind}><span class="lbl"><sw-icon name="shield" size="14"></sw-icon>${c("certRowTitle")}</span>
      ${t?n`<span class="v" data-maint-cert-text>${t.text}</span><span class="b" data-look=${t.look}>${y(t.task)}</span>`:n`<span class="v" data-maint-cert-none>${c("certRowNone")}</span>`}
      ${t||this.access.manage?n`<a href=${a} data-maint-cert-link @click=${o=>o.stopPropagation()}>${t?c("certRowOpen"):c("certRowAdd")}</a>`:w}</div>`}};e.styles=h`
    ${f}
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
  `;i([p()],e.prototype,"kind",2);i([p()],e.prototype,"subjectId",2);i([v()],e.prototype,"access",2);i([v()],e.prototype,"items",2);e=i([g("maint-cert-row")],e);
