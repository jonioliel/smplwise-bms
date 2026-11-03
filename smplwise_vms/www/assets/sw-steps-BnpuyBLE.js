import{E as v,F as p,a as d,e as o,H as w}from"./index-CHCc2mtA.js";var u=Object.defineProperty,x=Object.getOwnPropertyDescriptor,l=(t,e,a,n)=>{for(var s=n>1?void 0:n?x(e,a):e,i=t.length-1,c;i>=0;i--)(c=t[i])&&(s=(n?c(e,a,s):c(s))||s);return n&&s&&u(e,a,s),s};let r=class extends d{constructor(){super(...arguments),this.steps=[],this.current=0}render(){return o`${this.steps.map((t,e)=>o`
        <div class="step ${e<this.current?"done":e===this.current?"current":""}">
          <span class="n">${e<this.current?o`<sw-icon name="check" size=${13}></sw-icon>`:e+1}</span><span>${t}</span>
        </div>
        ${e<this.steps.length-1?o`<div class="line ${e<this.current?"done":""}"></div>`:""}
      `)}`}};r.styles=v`
    :host {
      display: flex;
      align-items: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      min-inline-size: 72px;
    }
    .n {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .step.done {
      color: var(--sw-text-2);
    }
    .step.done .n {
      background: var(--sw-live);
      border-color: var(--sw-live);
      color: var(--sw-text-inverse);
    }
    .step.current {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .step.current .n {
      border-color: var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: 0 0 0 4px var(--sw-accent-soft);
    }
    .line {
      flex: 1;
      min-inline-size: 20px;
      block-size: 2px;
      margin-block-start: 13px;
      background: var(--sw-border);
      border-radius: 1px;
    }
    .line.done {
      background: var(--sw-live);
    }
  `;l([p({attribute:!1})],r.prototype,"steps",2);l([p({type:Number})],r.prototype,"current",2);r=l([w("sw-steps")],r);
//# sourceMappingURL=sw-steps-BnpuyBLE.js.map
