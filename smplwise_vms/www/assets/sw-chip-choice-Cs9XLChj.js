import{g as h,ax as l,i as v,cI as b,A as d,b as u,k as w}from"./index-koYOOmpL.js";var f=Object.defineProperty,m=Object.getOwnPropertyDescriptor,c=(e,r,a,i)=>{for(var t=i>1?void 0:i?m(r,a):r,n=e.length-1,s;n>=0;n--)(s=e[n])&&(t=(i?s(r,a,t):s(t))||t);return i&&t&&f(r,a,t),t};let o=class extends v{constructor(){super(...arguments),this.options=[],this.value="",this.label="",this.disabled=!1}get chips(){return[...this.renderRoot?.querySelectorAll("button")??[]]}press(e){this.disabled||e.disabled||this.dispatchEvent(new CustomEvent("change",{detail:{value:e.value},bubbles:!0,composed:!0}))}onKey(e){const r=this.chips,a=r.indexOf(e.target);if(a<0)return;const i=b(e.key,a,r.map(t=>!t.disabled),getComputedStyle(this).direction==="rtl");i<0||(e.preventDefault(),r[i].focus())}updated(e){if(!e.has("options"))return;const r=this.chips;this.options.forEach((a,i)=>{const t=r[i];if(!t)return;const n=a.attrs??{};for(const s of[...t.attributes])s.name.startsWith("data-")&&!(s.name in n)&&t.removeAttribute(s.name);for(const[s,p]of Object.entries(n))t.getAttribute(s)!==p&&t.setAttribute(s,p)})}render(){return u`<div class="row" part="row" role="group" aria-label=${this.label||d} @keydown=${this.onKey}>
      ${this.options.map(e=>u`<button type="button" part=${e.value===this.value?"chip chip-on":"chip"} aria-pressed=${e.value===this.value?"true":"false"}
          ?disabled=${this.disabled||!!e.disabled} title=${e.title||d} @click=${()=>this.press(e)}>${e.label}</button>`)}
    </div>`}};o.styles=h`
    :host {
      display: flex;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-chipc-gap, 6px);
      min-inline-size: 0;
    }
    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-block-size: var(--sw-chipc-h, 32px);
      padding: 0 var(--sw-chipc-pad, 12px);
      border: 1px solid var(--sw-chipc-border, var(--sw-border));
      border-radius: var(--sw-chipc-radius, var(--sw-r-pill));
      background: var(--sw-chipc-bg, var(--sw-surface));
      color: var(--sw-chipc-fg, var(--sw-text));
      font: inherit;
      font-size: var(--sw-chipc-fs, inherit);
      line-height: 1.2;
      max-inline-size: 100%;
      overflow-wrap: anywhere;
      cursor: pointer;
      transition:
        background-color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        border-color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        transform var(--sw-t-press, 120ms) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not([aria-pressed='true']):not(:disabled) {
        border-color: var(--sw-border-strong);
        background: var(--sw-surface-2);
      }
    }
    button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    button[aria-pressed='true'] {
      background: var(--sw-chipc-on-bg, var(--sw-accent));
      border-color: var(--sw-chipc-on-border, var(--sw-accent));
      color: var(--sw-chipc-on-fg, var(--sw-text-inverse));
      font-weight: var(--sw-chipc-on-fw, inherit);
    }
    button:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    @media (pointer: coarse) {
      button {
        min-block-size: max(44px, var(--sw-chipc-h, 32px));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition-duration: 0ms;
      }
    }
  `;c([l({attribute:!1})],o.prototype,"options",2);c([l()],o.prototype,"value",2);c([l()],o.prototype,"label",2);c([l({type:Boolean,reflect:!0})],o.prototype,"disabled",2);o=c([w("sw-chip-choice")],o);
