import{E as f,F as v,G as m,a as g,b8 as b,ic as k,i as x,bc as p,id as y,ct as h,e as i,A as u,ie as w,l as $,H as z}from"./index-B0gHNuRZ.js";import{m as E,a as _}from"./deep-links-DcLXvoYw.js";var D=Object.defineProperty,O=Object.getOwnPropertyDescriptor,l=(e,t,o,s)=>{for(var n=s>1?void 0:s?O(t,o):t,d=e.length-1,c;d>=0;d--)(c=e[d])&&(n=(s?c(t,o,n):c(n))||n);return s&&n&&D(t,o,n),n};const r="פתיחה בחלון האינטרקום";let a=class extends g{constructor(){super(...arguments),this.place="",this.mode="inline",this.open=!1,this.rev=0,this.stops=[],this.onOutside=e=>{this.open&&this.mode==="menu"&&!e.composedPath().includes(this)&&(this.open=!1)},this.onKey=e=>{e.key!=="Escape"||!this.open||(e.stopPropagation(),this.open=!1,requestAnimationFrame(()=>this.renderRoot.querySelector("[data-wk-deeplinks-toggle]")?.focus()))}}connectedCallback(){super.connectedCallback();const e=()=>this.rev+=1;this.stops=[b(e),k(e)],document.addEventListener("pointerdown",this.onOutside,!0),this.addEventListener("keydown",this.onKey)}disconnectedCallback(){for(const e of this.stops)e();this.stops=[],document.removeEventListener("pointerdown",this.onOutside,!0),this.removeEventListener("keydown",this.onKey),super.disconnectedCallback()}links(){this.rev;const e=x(),t=E({api:e,accessReadInstallation:e&&p("access.read"),hidden:w});return e?_(this.place,{panel:t,admin:p("access.admin.read"),catalog:y().catalog,can:$,canInstallation:p,area:!w}):[]}willUpdate(e){e.has("place")&&(this.open=!1),this.setAttribute("data-wk-deeplinks",this.place)}updated(){const e=this.renderRoot.querySelector(".menu");if(!e)return;e.style.translate="";const t=e.getBoundingClientRect(),o=document.documentElement.clientWidth||window.innerWidth;let s=0;t.right>o-8&&(s=o-8-t.right),t.left+s<8&&(s=8-t.left),s&&(e.style.translate=`${Math.round(s)}px 0`)}list(e){return i`<ul class="list" role="list">
      ${e.map(t=>i`<li>
          <a
            href=${t.href}
            data-wk-deeplink=${t.id}
            data-wk-kind=${t.kind}
            data-wk-target=${t.kind==="native"?t.href:t.target.tool?`${t.target.tab}/${t.target.tool}`:t.target.tab}
            @click=${()=>this.open=!1}
            >${t.kind==="panel"?h("window",14):i`<sw-icon name="chevronBack" size=${14}></sw-icon>`}<span>${t.label}</span></a
          >
        </li>`)}
    </ul>`}render(){const e=this.links();return this.toggleAttribute("hidden",!e.length),e.length?this.mode==="menu"?i`<button
          type="button"
          class="icon-btn"
          aria-label=${r}
          title=${r}
          aria-expanded=${String(this.open)}
          aria-haspopup="true"
          data-wk-deeplinks-toggle
          @click=${()=>this.open=!this.open}
        >
          ${h("window",18)}
        </button>
        ${this.open?i`<div class="menu" role="group" aria-label=${r} data-wk-deeplinks-list><div class="h">${r}</div>${this.list(e)}</div>`:u}`:i`<button type="button" class="toggle" aria-expanded=${String(this.open)} data-wk-deeplinks-toggle @click=${()=>this.open=!this.open}>
        <sw-icon name="chevronDown" size=${14}></sw-icon><span>${r} (${e.length})</span>
      </button>
      ${this.open?i`<div data-wk-deeplinks-list>${this.list(e)}</div>`:u}`:u}};a.styles=f`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    :host([mode='menu']) {
      display: inline-block;
      position: relative;
    }
    button {
      font: inherit;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2, 8px);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-1, 4px);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      border-radius: var(--sw-r-sm);
    }
    .toggle sw-icon {
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .toggle[aria-expanded='true'] sw-icon {
      transform: rotate(180deg);
    }
    .icon-btn {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sw-touch-desktop, 44px);
      block-size: var(--sw-touch-desktop, 44px);
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
    }
    .icon-btn:hover,
    .toggle:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .icon-btn[aria-expanded='true'] {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    a {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2, 8px);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-2, 8px);
      border-radius: var(--sw-r-sm);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      text-decoration: none;
    }
    a:hover {
      background: var(--sw-surface-2);
    }
    a svg {
      flex: none;
      color: var(--sw-text-2);
    }
    a span {
      min-inline-size: 0;
    }
    .menu {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline-end: 0;
      z-index: var(--sw-z-drawer);
      inline-size: max-content;
      min-inline-size: 240px;
      max-inline-size: min(340px, calc(100vw - 32px));
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 6px;
    }
    .menu .h {
      padding: 6px 8px 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs, 12px);
      font-weight: var(--sw-fw-semibold);
    }
  `;l([v({reflect:!0})],a.prototype,"place",2);l([v({reflect:!0})],a.prototype,"mode",2);l([m()],a.prototype,"open",2);l([m()],a.prototype,"rev",2);a=l([z("wk-deep-links")],a);
//# sourceMappingURL=wk-deep-links-CvGt90y-.js.map
