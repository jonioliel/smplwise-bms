import{E as p,F as c,a as v,h$ as w,cb as d,e as u,H as b}from"./index-CmpXuSwg.js";var h=Object.defineProperty,f=Object.getOwnPropertyDescriptor,i=(s,a,o,t)=>{for(var e=t>1?void 0:t?f(a,o):a,n=s.length-1,l;n>=0;n--)(l=s[n])&&(e=(t?l(a,o,e):l(e))||e);return t&&e&&h(a,o,e),e};let r=class extends v{constructor(){super(...arguments),this.value="",this.options=[],this.label=""}pick(s){s!==this.value&&(this.value=s,this.dispatchEvent(new CustomEvent("change",{detail:s,bubbles:!0,composed:!0})))}render(){return u`<div class="group" role="group" aria-label=${this.label}>
      ${this.options.map(s=>u`<button type="button" data-view=${s.id} aria-pressed=${String(s.id===this.value)} aria-label=${s.label} title=${s.label} @click=${()=>this.pick(s.id)}>
          ${w(s.icon)?d(s.icon,18):u`<sw-icon .name=${s.icon} size=${18}></sw-icon>`}
        </button>`)}
    </div>`}};r.styles=p`
    :host {
      display: inline-flex;
    }
    .group {
      display: inline-flex;
      gap: var(--sw-s-1);
      padding: var(--sw-s-1);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    button {
      box-sizing: border-box;
      display: grid;
      place-items: center;
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: var(--sw-touch-desktop);
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover {
        background: var(--sw-hover-wash);
      }
    }
    button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface-solid));
      color: var(--sw-seg-key-ink, var(--sw-heading));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (max-width: 1100px) {
      button {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;i([c()],r.prototype,"value",2);i([c({attribute:!1})],r.prototype,"options",2);i([c()],r.prototype,"label",2);r=i([b("sw-view-switch")],r);
//# sourceMappingURL=sw-view-switch-DUZICOQ-.js.map
