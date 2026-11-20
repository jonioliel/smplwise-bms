import{i as k,d7 as m,A as d,bd as v,b as r,cp as h,ar as u,d8 as l,a6 as c,d9 as x,da as z,g as y,ax as g,j as b,k as _}from"./index-koYOOmpL.js";import"./sw-logo-art-PLtEZJxU.js";var E=Object.defineProperty,C=Object.getOwnPropertyDescriptor,f=(e,s,t,o)=>{for(var i=o>1?void 0:o?C(s,t):s,a=e.length-1,n;a>=0;a--)(n=e[a])&&(i=(o?n(s,t,i):n(i))||i);return o&&i&&E(s,t,i),i};let w=class extends k{constructor(){super(...arguments),this.buildings=[],this.canOff=!1,this.offline=!1,this.open=new Set,this.height=0,this.ro=null,this.at="",this.measure=(e=!1)=>{if(window.innerWidth<=m){this.height&&(this.height=0),this.at="";return}const s=this.scroller(),t=Math.round(this.getBoundingClientRect().top+(s?.scrollTop??0)),o=`${t}|${window.innerWidth}|${window.innerHeight}`;if(o===this.at&&e!==!0)return;this.at=o;const i=Math.max(220,Math.floor(window.innerHeight-t-20));Math.abs(i-this.height)>1&&(this.height=i)}}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.measure)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.measure),this.ro?.disconnect(),this.ro=null}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.parentElement&&this.ro.observe(this.parentElement),this.measure()}updated(e){if(e.has("buildings")&&this.measure(!0),e.has("height")&&this.height){const s=this.scroller(),t=s?s.scrollHeight-s.clientHeight:0;t>0&&(this.height=Math.max(220,this.height-t))}}scroller(){let e=this;for(;e;){const s=e.assignedSlot??e.parentNode??e.host??null;if(s instanceof HTMLElement&&["auto","scroll"].includes(getComputedStyle(s).overflowY))return s;e=s}return document.scrollingElement}go(e,s){this.dispatchEvent(new CustomEvent("site-go",{detail:{building:e,floor:s},bubbles:!0,composed:!0}))}off(e){this.dispatchEvent(new CustomEvent("site-off",{detail:{building:e},bubbles:!0,composed:!0}))}toggle(e){const s=new Set(this.open);s.has(e)?s.delete(e):s.add(e),this.open=s}render(){if(!this.model)return d;const e=window.innerWidth<=m,s=this.buildings,t=window.innerWidth>1180,o=e?1:t?4:3,i=t?2:e?1:0,a=Math.max(1,Math.ceil((s.length+i)/o)),n=this.height?`block-size:${this.height}px`:"";return r`<div class="site" ?data-phone=${e} style=${n} data-site-view data-site-rows=${a}>
      ${e?d:this.renderTree()}
      <div class="cards" style=${`--cols:${o};grid-template-rows:${e?"none":`repeat(${a}, minmax(0, 1fr))`}`} data-site-cards>
        ${v(s,p=>p.id,p=>this.renderCard(p))}
        ${t?this.renderAlerts():d}
        ${t||e?this.renderSection():d}
      </div>
    </div>`}lit(e){return r`<span class=${h({lit:!0,zero:e===0})}><sw-icon name="light" size=${12}></sw-icon>${u(e)}</span>`}renderTree(){const e=this.buildings.reduce((s,t)=>s+t.counts.lights_on,0);return r`<nav aria-label=${l("בניינים וקומות")} data-site-tree>
      <div class="trow all" data-site-tree-all aria-current="true"><sw-icon name="building" size=${15}></sw-icon><span class="nm">${l("כל האתר")}</span>${this.lit(e)}</div>
      ${v(this.buildings,s=>s.id,s=>{const t=this.open.has(s.id);return r`<div class="gr">
            <button type="button" class="fold" aria-expanded=${String(t)} aria-label=${t?l("סגור את {name}",{name:s.name}):l("פתח את קומות {name}",{name:s.name})} data-site-tree-fold=${s.id} @click=${()=>this.toggle(s.id)}><sw-icon name="chevronDown" size=${14}></sw-icon></button>
            <button type="button" class=${h({trow:!0,b:!0,shared:s.shared})} data-site-tree-building=${s.id} @click=${()=>this.go(s.id)}>
              <sw-icon class="ic" name=${s.shared?"sparkle":"building"} size=${15}></sw-icon><span class="nm" title=${s.name}>${c(s.name)}</span>
              ${s.alerts.length?r`<span class="al" aria-label=${l("{n} התראות",{n:s.alerts.length})}>${u(s.alerts.length)}</span>`:d}${this.lit(s.counts.lights_on)}
            </button>
          </div>
          ${t?s.floors.map(o=>r`<button type="button" class="trow f" data-site-tree-floor=${o.id} @click=${()=>this.go(s.id,o.id)}><sw-icon name="floor" size=${13}></sw-icon><span class="nm">${c(o.name)}</span>${this.lit(o.counts.lights_on)}</button>`):d}`})}
      ${this.model.unassigned.length?r`<div class="loose" data-site-unassigned=${this.model.unassigned.length}><sw-icon name="warning" size=${13}></sw-icon>${l("לא משויך")} · ${l("{n} אזורים",{n:u(this.model.unassigned.length)})}</div>`:d}
    </nav>`}renderCard(e){const s=e.counts,t=e.floors.reduce((a,n)=>a+n.areas.length,0),o=a=>this.offline?"–":a,i=(a,n,p,$)=>p?r`<span class=${h({chip:!0,[$]:n>0})}><sw-icon name=${a} size=${12}></sw-icon>${o(`${n}/${p}`)}</span>`:d;return r`<section class=${h({card:!0,shared:e.shared,alert:e.alerts.length>0})} data-site-card=${e.id} aria-label=${e.name}>
      <header>
        <h3 role="button" tabindex="0" data-site-card-open=${e.id} @click=${()=>this.go(e.id)} @keydown=${a=>(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),this.go(e.id))}>
          <sw-icon name=${e.shared?"sparkle":"building"} size=${16}></sw-icon>${c(e.name)}</h3>
        <span class="sub">${l("{n} קומות",{n:u(e.floors.length)})} · ${l("{n} אזורים",{n:u(t)})}</span>
      </header>
      <div class="chips">
        ${i("light",s.lights_on,s.lights,"on")}${i("bolt",s.switches_on,s.switches,"on")}${i("layers",s.covers_open,s.covers,"on")}${i("snow",s.climate_active,s.climate,"cool")}
      </div>
      ${e.alerts.length?r`<div class="alerts">${e.alerts.slice(0,2).map(a=>r`<div class="arow" data-site-alert><sw-icon name="warning" size=${13}></sw-icon>${c(a.floor)} · ${c(a.area.name)} · ${l("אזעקה")}</div>`)}</div>`:r`<span class="ok"><sw-icon name="check" size=${13}></sw-icon>${l("אין התראות")}</span>`}
      <div class="bars" data-site-bars>
        ${x(e).map(a=>r`<button type="button" class=${h({bar:!0,alert:a.alert})} data-site-bar=${a.id} aria-label=${l("{name}: {on} מתוך {total} דולקות",{name:a.name,on:a.on,total:a.total})} @click=${()=>this.go(e.id,a.id)}>
          <span class="nm">${c(a.name)}</span><span class="track"><i style=${`inline-size:${Math.round(a.ratio*100)}%`}></i></span><span class="n">${u(a.on)}</span>
        </button>`)}
      </div>
      <div class="foot">
        <button type="button" class="btn" data-site-card-go=${e.id} @click=${()=>this.go(e.id)}><sw-icon name=${e.shared?"sparkle":"building"} size=${14}></sw-icon>${e.shared?l("פתח משותף"):l("פתח בניין")}</button>
        ${this.canOff?r`<button type="button" class="lnk danger" data-site-card-off=${e.id} @click=${()=>this.off(e.id)}>${l("כבה הכל ב{name}",{name:e.name})}</button>`:d}
      </div>
    </section>`}renderAlerts(){const e=this.buildings.flatMap(s=>s.alerts.map(t=>({b:s,a:t})));return r`<section class="card" data-site-alerts=${e.length}>
      <h4><sw-icon name="warning" size=${15}></sw-icon>${l("התראות באתר")}${e.length?r` <span class="sub">· ${u(e.length)}</span>`:d}</h4>
      <div class="alist">
        ${e.length?e.map(({b:s,a:t})=>r`<button type="button" class="lnk" @click=${()=>this.go(s.id)}><span class="code">${c(s.name)}</span> · ${c(t.floor)} · ${c(t.area.name)}</button>`):r`<span class="ok"><sw-icon name="check" size=${13}></sw-icon>${l("אין התראות באתר")}</span>`}
      </div>
    </section>`}renderSection(){const e=z(this.buildings),s=e.findIndex(t=>t<0);return r`<section class="card" data-site-section aria-label=${l("חתך האתר")}>
      <h4><sw-icon name="layers" size=${15}></sw-icon>${l("חתך האתר")}</h4>
      <div class="xs" style=${`--bn:${this.buildings.length}`}>
        ${this.buildings.map(t=>{const o=new Map(x(t).map(i=>[t.floors.find(a=>a.id===i.id).level,i]));return r`<div class=${h({xcol:!0,shared:t.shared})} style=${`--ln:${e.length}`} data-site-section-col=${t.id}>
            <button type="button" class="xh" title=${t.name} @click=${()=>this.go(t.id)}>${c(t.name)}</button>
            ${e.map((i,a)=>{const n=o.get(i),p=a===s&&s>0;return n?r`<button type="button" class=${h({cell:!0,alert:n.alert,under:p})} style=${`--r:${n.ratio.toFixed(2)}`} title=${`${t.name} · ${n.name}: ${n.on}/${n.total}`} aria-label=${`${t.name} · ${n.name}`} data-site-cell=${n.id} @click=${()=>this.go(t.id,n.id)}></button>`:r`<span class=${h({cell:!0,none:!0,under:p})} aria-hidden="true"></span>`})}
          </div>`})}
      </div>
    </section>`}};w.styles=y`
    :host {
      display: block;
      min-inline-size: 0;
      --site-tree-w: 240px;
    }
    .site {
      display: grid;
      grid-template-columns: var(--site-tree-w) minmax(0, 1fr);
      gap: 14px;
      min-block-size: 0;
    }
    .site[data-phone] {
      grid-template-columns: minmax(0, 1fr);
    }
    /* ---- the grouped tree ---- */
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
      min-block-size: 0;
      overflow: hidden;
    }
    .trow {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: var(--sw-r-md);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .trow:hover {
      background: var(--sw-surface-2);
    }
    .trow:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .trow.all {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-bold);
    }
    .trow.b {
      font-weight: var(--sw-fw-semibold);
    }
    .trow.f {
      padding-inline-start: 34px;
      min-block-size: 30px;
      color: var(--sw-text-2);
    }
    .trow.shared sw-icon.ic {
      color: var(--sw-shared);
    }
    .trow.shared .nm {
      color: var(--sw-shared-text);
    }
    .nm {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lit {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--sw-warning-text);
      font-variant-numeric: tabular-nums;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .lit.zero {
      color: var(--sw-text-3);
    }
    .al {
      min-inline-size: 18px;
      block-size: 18px;
      padding: 0 5px;
      box-sizing: border-box;
      border-radius: 999px;
      background: var(--sw-badge-bg);
      color: var(--sw-badge-fg);
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-bold);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .fold {
      all: unset;
      inline-size: 24px;
      block-size: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-3);
      cursor: pointer;
      flex: none;
    }
    .fold:focus-visible {
      outline: 2px solid var(--sw-focus);
    }
    .fold sw-icon {
      transition: transform var(--sw-t-fast, 120ms) var(--sw-ease, ease);
    }
    .fold[aria-expanded='false'] sw-icon {
      transform: rotate(90deg);
    }
    .gr {
      display: flex;
      align-items: center;
    }
    .gr > .trow {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    .loose {
      margin-block-start: auto;
      padding: 8px 10px 2px;
      border-block-start: 1px solid var(--sw-border);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    /* ---- the cards ---- */
    .cards {
      display: grid;
      grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      gap: 12px;
      min-block-size: 0;
    }
    .site[data-phone] .cards {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: auto;
    }
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-block-size: 0;
      overflow: hidden;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
    }
    .site:not([data-phone]) .card {
      container-type: size;
    }
    .card > header,
    .card > .chips,
    .card > .alerts,
    .card > .ok,
    .card > .foot {
      flex: none;
    }
    /* a short card (a landscape tablet, many buildings) keeps what answers "is something wrong, and where": the name, the counters, an
       alert row; "no alerts" and the floor bars go first, then the open button (the name itself opens the building) */
    @container (max-height: 190px) {
      .ok {
        display: none !important;
      }
      .alerts .arow + .arow {
        display: none;
      }
    }
    @container (max-height: 150px) {
      .foot .btn,
      .bars {
        display: none;
      }
      .foot {
        margin-block-start: auto;
      }
    }
    .card.shared {
      border-color: color-mix(in srgb, var(--sw-shared) 45%, var(--sw-border));
      box-shadow: inset 3px 0 0 var(--sw-shared), var(--sw-shadow-1);
    }
    .card.alert {
      border-color: color-mix(in srgb, var(--sw-danger) 55%, var(--sw-border));
    }
    .card header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-inline-size: 0;
    }
    .card h3 {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-inline-size: 0;
    }
    .card h3:focus-visible {
      outline: 2px solid var(--sw-focus);
      border-radius: var(--sw-r-sm);
    }
    .card.shared h3 {
      color: var(--sw-shared-text);
    }
    .card.shared h3 sw-icon {
      color: var(--sw-shared);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-block-size: 26px;
      overflow: hidden;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 24px;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .chip.on {
      background: var(--sw-lit-soft, var(--sw-warning-soft));
      color: var(--sw-warning-text);
    }
    .chip.cool {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .alerts {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .arow {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ok {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    /* the floors that do not fit wrap into a second column outside the card (clipped whole, never half a row) */
    .bars {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: hidden;
      display: flex;
      flex-flow: column wrap;
      align-content: flex-start;
      gap: 3px 40px;
    }
    .site[data-phone] .bars {
      flex-wrap: nowrap;
    }
    .bar {
      all: unset;
      box-sizing: border-box;
      inline-size: 100%;
      display: grid;
      grid-template-columns: minmax(3.5em, auto) minmax(0, 1fr) 2.2em;
      align-items: center;
      gap: 8px;
      min-block-size: 18px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      cursor: pointer;
      border-radius: var(--sw-r-sm);
    }
    .bar:hover .nm {
      color: var(--sw-text);
    }
    .bar:focus-visible {
      outline: 2px solid var(--sw-focus);
    }
    .bar.alert .nm {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-bold);
    }
    .track {
      block-size: 6px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .track > i {
      display: block;
      block-size: 100%;
      border-radius: 999px;
      background: var(--sw-warning);
    }
    .card.shared .track > i {
      background: var(--sw-shared);
    }
    .bar .n {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      padding: 0 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    .btn:focus-visible,
    .lnk:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .lnk {
      all: unset;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      border-radius: var(--sw-r-sm);
    }
    .lnk.danger {
      color: var(--sw-danger-text);
    }
    @media (hover: hover) {
      .btn:hover {
        background: var(--sw-surface-2);
      }
    }
    .btn:active,
    .trow:active,
    .bar:active {
      transform: scale(0.98);
    }
    /* ---- the site's alerts and the mini cross-section ---- */
    .card h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-heading, var(--sw-text));
    }
    .alist {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .alist .code {
      font-weight: var(--sw-fw-bold);
    }
    .xs {
      flex: 1 1 auto;
      min-block-size: 0;
      display: grid;
      grid-template-columns: repeat(var(--bn), minmax(0, 1fr));
      gap: 6px;
    }
    .xcol {
      display: grid;
      grid-template-rows: auto repeat(var(--ln), minmax(0, 1fr));
      gap: 2px;
      min-block-size: 0;
    }
    .xh {
      all: unset;
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-text-2);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }
    .xcol.shared .xh {
      color: var(--sw-shared-text);
    }
    .cell {
      all: unset;
      box-sizing: border-box;
      min-block-size: 3px;
      border-radius: 3px;
      background: color-mix(in srgb, var(--sw-warning) calc(var(--r, 0) * 85%), var(--sw-surface-3));
      cursor: pointer;
    }
    .xcol.shared .cell {
      background: color-mix(in srgb, var(--sw-shared) calc(var(--r, 0) * 85%), var(--sw-surface-3));
    }
    .cell.alert {
      outline: 2px solid var(--sw-danger);
      outline-offset: -2px;
    }
    .cell.none {
      background: transparent;
      cursor: default;
    }
    .cell:focus-visible,
    .xh:focus-visible {
      outline: 2px solid var(--sw-focus);
    }
    .cell.under {
      box-shadow: 0 -3px 0 -1px var(--sw-border-strong);
    }
    @media (prefers-reduced-motion: reduce) {
      .fold sw-icon {
        transition: none;
      }
      .btn:active,
      .trow:active,
      .bar:active {
        transform: none;
      }
    }
  `;f([g({attribute:!1})],w.prototype,"model",2);f([g({attribute:!1})],w.prototype,"buildings",2);f([g({type:Boolean})],w.prototype,"canOff",2);f([g({type:Boolean})],w.prototype,"offline",2);f([b()],w.prototype,"open",2);f([b()],w.prototype,"height",2);w=f([_("home-site-view")],w);export{w as HomeSiteView};
