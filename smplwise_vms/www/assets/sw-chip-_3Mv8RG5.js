import{E as u,F as o,a as v,e as n,H as h}from"./index-CmpXuSwg.js";var p=Object.defineProperty,w=Object.getOwnPropertyDescriptor,t=(d,r,i,a)=>{for(var s=a>1?void 0:a?w(r,i):r,c=d.length-1,l;c>=0;c--)(l=d[c])&&(s=(a?l(r,i,s):l(s))||s);return a&&s&&p(r,i,s),s};let e=class extends v{constructor(){super(...arguments),this.selected=!1,this.dot="",this.disabled=!1}render(){return n`
      <button type="button" class="sw-hit" aria-pressed=${this.selected} ?disabled=${this.disabled}>
        ${this.dot?n`<span class="d" style="--dot:${this.dot}"></span>`:""}
        ${this.icon?n`<sw-icon .name=${this.icon} size=${13}></sw-icon>`:""}
        <span class="t"><slot></slot></span>
        ${this.count!==void 0?n`<span class="count">(${this.count})</span>`:""}
      </button>
    `}};e.styles=u`
    :host {
      display: inline-flex;
      /* break-ui (POLISH-CLASSIC-DOMUS-297): a long label (an e-mail, a long area name) ends in an ellipsis inside its container
         instead of running out of the card; the count and the dot never shrink */
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .t {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      /* second pass (break-ui): the text takes its own direction, so a Latin e-mail in the RTL shell is cut at its END, not its start */
      unicode-bidi: plaintext;
      white-space: nowrap;
    }
    .count,
    sw-icon {
      flex-shrink: 0;
    }
    button {
      max-inline-size: 100%;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 28px;
      padding-inline: 11px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      box-shadow: var(--sw-shadow-1);
      /* POLISH-CLASSIC-DOMUS-297: colour on the hover curve, press feedback on transform (1 = none in a skin that sets no scale) */
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--sw-surface-2);
      }
      :host([selected]) button:hover:not(:disabled) {
        background: var(--sw-accent-hover);
        border-color: var(--sw-accent-hover);
      }
    }
    button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .count {
      font-variant-numeric: tabular-nums;
    }
    :host([selected]) button {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .d {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dot);
      flex-shrink: 0;
    }
    :host([selected]) .d {
      outline: 2px solid color-mix(in srgb, var(--sw-text-inverse) 70%, transparent);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    :host([selected]) .count {
      color: var(--sw-text-inverse); /* UXREST-295: the 80 % mix read 3.7:1 on the accent fill; the count is the quieter figure by its brackets and size */
    }
    button:disabled {
      cursor: default;
      color: var(--sw-text-3);
      box-shadow: none;
      opacity: var(--sw-disabled-opacity);
    }
    button:disabled:hover {
      background: var(--sw-surface);
    }
  `;t([o({type:Boolean,reflect:!0})],e.prototype,"selected",2);t([o()],e.prototype,"icon",2);t([o({type:Number})],e.prototype,"count",2);t([o()],e.prototype,"dot",2);t([o({type:Boolean,reflect:!0})],e.prototype,"disabled",2);e=t([h("sw-chip")],e);
//# sourceMappingURL=sw-chip-_3Mv8RG5.js.map
