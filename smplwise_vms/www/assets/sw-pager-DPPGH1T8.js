import{E as d,F as c,a as u,A as v,eA as s,e as b,H as g}from"./index-Do3zNa2z.js";var h=Object.defineProperty,m=Object.getOwnPropertyDescriptor,p=(e,a,n,i)=>{for(var t=i>1?void 0:i?m(a,n):a,o=e.length-1,l;o>=0;o--)(l=e[o])&&(t=(i?l(a,n,t):l(t))||t);return i&&t&&h(a,n,t),t};let r=class extends u{constructor(){super(...arguments),this.page=1,this.pages=1}go(e){const a=Math.min(Math.max(1,e),this.pages);a!==this.page&&this.dispatchEvent(new CustomEvent("page-change",{detail:{page:a},bubbles:!0,composed:!0}))}render(){if(this.pages<=1)return v;const e=Math.min(Math.max(1,this.page),this.pages);return b`<nav role="navigation" aria-label=${s("pages")} data-pager>
        <span style="display:inline-flex;align-items:center;gap:var(--sw-s-1)">
          <button type="button" data-pager-prev aria-label=${s("prev")} title=${s("prev")} ?disabled=${e<=1} @click=${()=>this.go(e-1)}><sw-icon name="chevronBack" size=${16}></sw-icon></button>
          <span class="at" aria-live="polite" aria-label=${s("pageOf",{n:e,m:this.pages})} data-pager-at>${e} / ${this.pages}</span>
          <button type="button" data-pager-next aria-label=${s("next")} title=${s("next")} ?disabled=${e>=this.pages} @click=${()=>this.go(e+1)}><sw-icon name="chevron" size=${16}></sw-icon></button>
        </span>
      </nav>`}};r.styles=d`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-1);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    :host([hidden]) {
      display: none;
    }
    .at {
      min-inline-size: 3.5em;
      text-align: center;
      unicode-bidi: isolate;
      direction: ltr;
    }
    button {
      display: grid;
      place-items: center;
      inline-size: var(--sw-ctl-h-md);
      block-size: var(--sw-ctl-h-md);
      padding: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background-color var(--sw-t-fast) ease, color var(--sw-t-fast) ease, transform var(--sw-t-fast) var(--sw-ease);
    }
    button:active:not(:disabled) {
      transform: scale(0.97);
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--sw-surface-3);
        color: var(--sw-text);
      }
    }
    @media (pointer: coarse) {
      button {
        inline-size: var(--sw-ctl-h-lg);
        block-size: var(--sw-ctl-h-lg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;p([c({type:Number})],r.prototype,"page",2);p([c({type:Number})],r.prototype,"pages",2);r=p([g("sw-pager")],r);
//# sourceMappingURL=sw-pager-DPPGH1T8.js.map
