import{b$ as h,bi as u,g as p,ax as i,i as v,b as o,k as w}from"./index-Cwrvr-7C.js";var b=Object.defineProperty,f=Object.getOwnPropertyDescriptor,t=(d,n,a,r)=>{for(var s=r>1?void 0:r?f(n,a):n,c=d.length-1,l;c>=0;c--)(l=d[c])&&(s=(r?l(n,a,s):l(s))||s);return r&&s&&b(n,a,s),s};let e=class extends v{constructor(){super(...arguments),this.selected=!1,this.dot="",this.disabled=!1}render(){return o`
      <button type="button" class="sw-hit" aria-pressed=${this.selected} ?disabled=${this.disabled}>
        ${this.selected?o`<sw-icon class="ck" name="check" size=${12} aria-hidden="true"></sw-icon>`:""}
        ${this.dot?o`<span class="d" style="--dot:${this.dot}"></span>`:""}
        ${this.icon?o`<sw-icon .name=${this.icon} size=${13}></sw-icon>`:""}
        <span class="t"><slot></slot></span>
        ${this.count!==void 0?o`<span class="count">(${this.count})</span>`:""}
      </button>
    `}};e.styles=p`
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
      /* the selected chip does not lift (a skin lifts every chip on hover); .sw-hit only raises the specificity over the skin sheet */
      :host([selected]) button.sw-hit:hover:not(:disabled) {
        ${h}
        transform: none;
      }
    }
    :host([selected]) button.sw-hit:active:not(:disabled) {
      ${h}
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
    /* DOMUS-DEFAULT-2439: the selected state is the shared fragment (styles/chip-selected.ts) in every skin - the skins no longer repaint it
       (classic rule 1 and domus rule 6 did), so the setting ui.chip_selected reaches each of them */
    :host([selected]) button {
      ${u}
    }
    .ck {
      display: var(--sw-chip-on-check, inline-flex);
      margin-inline-end: -1px;
    }
    .d {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dot);
      flex-shrink: 0;
    }
    :host([selected]) .d {
      outline: 2px solid var(--sw-chip-dot-ring, var(--sw-surface-solid));
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    :host([selected]) .count {
      color: inherit; /* the chip's own ink: the count is the quieter figure by its brackets and size */
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
  `;t([i({type:Boolean,reflect:!0})],e.prototype,"selected",2);t([i()],e.prototype,"icon",2);t([i({type:Number})],e.prototype,"count",2);t([i()],e.prototype,"dot",2);t([i({type:Boolean,reflect:!0})],e.prototype,"disabled",2);e=t([w("sw-chip")],e);
