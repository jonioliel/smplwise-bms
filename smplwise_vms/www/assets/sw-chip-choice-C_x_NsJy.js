import{g as d,y as l,i as b,cu as v,cv as f,A as p,b as u,k as w}from"./index-CqeTnh_F.js";var m=Object.defineProperty,g=Object.getOwnPropertyDescriptor,n=(e,t,a,r)=>{for(var i=r>1?void 0:r?g(t,a):t,c=e.length-1,s;c>=0;c--)(s=e[c])&&(i=(r?s(t,a,i):s(i))||i);return r&&i&&m(t,a,i),i};let o=class extends b{constructor(){super(...arguments),this.options=[],this.value="",this.label="",this.disabled=!1,this.multi=!1,this.values=[]}get chips(){return[...this.renderRoot?.querySelectorAll("button")??[]]}press(e){if(this.disabled||e.disabled)return;const t=this.multi?{value:e.value,pressed:!this.on(e)}:{value:e.value};this.dispatchEvent(new CustomEvent("change",{detail:t,bubbles:!0,composed:!0}))}on(e){return v(e.value,this.value,this.multi,this.values)}onKey(e){const t=this.chips,a=t.indexOf(e.target);if(a<0)return;const r=f(e.key,a,t.map(i=>!i.disabled),getComputedStyle(this).direction==="rtl");r<0||(e.preventDefault(),t[r].focus())}updated(e){if(!e.has("options"))return;const t=this.chips;this.options.forEach((a,r)=>{const i=t[r];if(!i)return;const c=a.attrs??{};for(const s of[...i.attributes])s.name.startsWith("data-")&&!(s.name in c)&&i.removeAttribute(s.name);for(const[s,h]of Object.entries(c))i.getAttribute(s)!==h&&i.setAttribute(s,h)})}render(){return u`<div class="row" part="row" role="group" aria-label=${this.label||p} @keydown=${this.onKey}>
      ${this.options.map(e=>{const t=this.on(e);return u`<button type="button" part=${t?"chip chip-on":"chip"} aria-pressed=${t?"true":"false"}
          ?disabled=${this.disabled||!!e.disabled} title=${e.title||p} @click=${()=>this.press(e)}>${e.icon?u`<span class="ic" part="icon" aria-hidden="true">${e.icon}</span>`:p}${e.label}${e.count!==void 0?u`<small class="n" part="count">${e.count}</small>`:p}</button>`})}
    </div>`}};o.styles=d`
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
    /* CR-CMP2-TABS-2460: an icon before the label, a count after it */
    button {
      gap: 6px;
    }
    .ic {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
    .ic > svg {
      inline-size: 1em;
      block-size: 1em;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .n {
      display: inline-grid;
      place-items: center;
      box-sizing: border-box;
      min-inline-size: 18px;
      block-size: 18px;
      padding-inline: 5px;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 14%, transparent);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    /* under a finger a chip is 44 px tall by default. CMP2-POLISH-2480 (owner N48): a host may keep its chip at its own height there
       (--sw-chipc-touch-h, e.g. the events centre's 28 px) - the hit area stays 44 px tall, an invisible ::after centred on the chip
       (the styles/focus-policy.ts .sw-hit rule) */
    @media (pointer: coarse) {
      button {
        position: relative;
        min-block-size: max(var(--sw-chipc-touch-h, 44px), var(--sw-chipc-h, 32px));
      }
      button::after {
        content: '';
        position: absolute;
        inset-inline: 0;
        inset-block: min(0px, calc((100% - 44px) / 2));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition-duration: 0ms;
      }
    }
  `;n([l({attribute:!1})],o.prototype,"options",2);n([l()],o.prototype,"value",2);n([l()],o.prototype,"label",2);n([l({type:Boolean,reflect:!0})],o.prototype,"disabled",2);n([l({type:Boolean,reflect:!0})],o.prototype,"multi",2);n([l({attribute:!1})],o.prototype,"values",2);o=n([w("sw-chip-choice")],o);
