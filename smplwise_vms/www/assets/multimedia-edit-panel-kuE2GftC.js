import{bw as F,g as E,y as b,j as y,i as P,bA as G,A as h,cU as z,ad as _,ai as f,b as p,bn as A,k as C}from"./index-CqeTnh_F.js";import{m as g,n as x}from"./media-now-CkGWTkHB.js";import{m as T,a as I,c as R,s as u,S as $,t as U,e as B,b as L,G as j,d as w}from"./multimedia-base-DrMUYR0O.js";import{t as s}from"./media-KElttbNZ.js";var q=Object.defineProperty,M=Object.getOwnPropertyDescriptor,c=(e,t,r,i)=>{for(var a=i>1?void 0:i?M(t,r):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(a=(i?l(t,r,a):l(a))||a);return i&&a&&q(t,r,a),a};const O=["s","m","l"],S=["floor","area","none"];let d=class extends P{constructor(){super(...arguments),this.devices=[],this.scope="all",this.floors=[],this.simple=!1,this.heading=s("מסכים"),this.drag="",this.dragFloor="",this.phoneOpen=new Set}connectedCallback(){super.connectedCallback(),G(this)}change(e){this.dispatchEvent(new CustomEvent("layout-draft",{detail:e,bubbles:!0,composed:!0}))}keepFocus(e,t){this.updateComplete.then(()=>requestAnimationFrame(()=>{const r=this.renderRoot,i=`[data-mm-row="${CSS.escape(e)}"]`;(r.querySelector(`${i} [data-mm-${t}]:not([disabled])`)??r.querySelector(`${i} [data-mm-up]:not([disabled]), ${i} [data-mm-down]:not([disabled])`))?.focus()}))}move(e,t){this.change(T(this.draft,this.devices,e,t)),this.keepFocus(e,t<0?"up":"down")}onDrop(e,t){e.preventDefault();const r=this.drag;this.drag="",r&&this.change(I(this.draft,this.devices,r,t))}togglePhone(e){const t=new Set(this.phoneOpen);t.has(e)?t.delete(e):t.add(e),this.phoneOpen=t}row(e,t,r){const i=this.draft,a=R(i,e.key),n=this.scope==="me",l=a.phone_on??a.on,v=i.pinned.includes(e.key),D=a.phone_on!==null||a.phone_size!==null,k=this.phoneOpen.has(e.key);return p`<div class=${z({row:!0,off:!a.on,dragging:this.drag===e.key})} data-mm-row=${e.key} draggable="true"
      @dragstart=${o=>{this.drag=e.key,o.dataTransfer?.setData("text/plain",e.key),o.dataTransfer&&(o.dataTransfer.effectAllowed="move")}}
      @dragend=${()=>this.drag=""} @dragover=${o=>this.drag&&o.preventDefault()} @drop=${o=>this.onDrop(o,e.key)}>
      <div class="l1">
        <span class="grip" aria-hidden="true">${g("grip")}</span>
        <label class="check"><sw-toggle size="sm" labelHidden in-label data-mm-on=${e.key} .checked=${a.on} label=${s("הצג {name}",{name:e.name})} @change=${o=>this.change(u(i,e.key,{on:_(o)}))}></sw-toggle><b>${x(f(e.name))}</b>${e.area_name?p`<small>${x(f(e.area_name))}</small>`:h}</label>
        <span class="sp"></span>
        <button type="button" class="ib" data-mm-up ?disabled=${t===0} aria-label=${s("הקדם את {name}",{name:e.name})} title=${s("הקדם")} @click=${()=>this.move(e.key,-1)}>${g("arrowUp")}</button>
        <button type="button" class="ib" data-mm-down ?disabled=${t===r-1} aria-label=${s("אחר את {name}",{name:e.name})} title=${s("אחר")} @click=${()=>this.move(e.key,1)}>${g("arrowDown")}</button>
      </div>
      <div class="l2">
        ${this.simple?h:p`<sw-segmented size="sm" label=${s("גודל: {name}",{name:e.name})} value=${a.size} ?disabled=${!a.on}
          @change=${o=>this.change(u(i,e.key,{size:O.find(m=>m===o.detail.value)??a.size}))}
          .options=${O.map(o=>({value:o,label:$[o],attrs:{"data-mm-size":`${e.key}:${o}`}}))}></sw-segmented>`}
        <span class="sp"></span>
        ${n?h:p`<button type="button" class="ib" data-mm-pin=${e.key} aria-pressed=${String(v)} aria-label=${s("מועדף: {name}",{name:e.name})} title=${s("מועדף")} @click=${()=>this.change(U(i,e.key))}>${g("star")}</button>
          ${this.simple?h:p`<button type="button" class="ib" data-mm-phone-toggle=${e.key} aria-expanded=${String(k)} aria-label=${s("בנייד: {name}",{name:e.name})} title=${s("בנייד")} @click=${()=>this.togglePhone(e.key)}>${g("phone")}${D?p`<i class="dot" aria-hidden="true"></i>`:h}</button>`}`}
      </div>
      ${n||this.simple||!k?h:p`<div class="phone" data-mm-phone=${e.key}>
        <span class="pl">${s("בנייד")}</span>
        <label class="check"><sw-toggle size="sm" labelHidden in-label data-mm-phone-on=${e.key} .checked=${l} label=${s("הצג בנייד: {name}",{name:e.name})} @change=${o=>{const m=_(o);this.change(u(i,e.key,{phone_on:m===a.on?null:m}))}}></sw-toggle>${s("הצג")}</label>
        <select data-mm-phone-size=${e.key} aria-label=${s("גודל בנייד: {name}",{name:e.name})} ?disabled=${!l} @change=${o=>{const m=o.target.value;this.change(u(i,e.key,{phone_size:m==="s"||m==="m"?m:null}))}}>
          <option value="" ?selected=${!a.phone_size}>${s("אוטומטי ({size})",{size:$[a.size==="l"?"m":a.size]})}</option>
          <option value="s" ?selected=${a.phone_size==="s"}>${$.s}</option><option value="m" ?selected=${a.phone_size==="m"}>${$.m}</option>
        </select>
      </div>`}
    </div>`}render(){if(!this.draft)return h;const e=this.draft,t=B(this.devices,e),r=this.floors.map(a=>a.id),i=this.scope==="all"&&e.group_by==="floor"&&this.floors.length>1;return p`<section class="panel glass" data-mm-edit aria-label=${s("הגדרות · {heading}",{heading:this.heading})}>
      <div class="lbl" id="mm-grp">${s("קיבוץ")}
        <sw-segmented size="sm" label=${s("קיבוץ")} data-mm-groupby value=${e.group_by} @change=${a=>this.change(L(e,S.find(n=>n===a.detail.value)??e.group_by))}
          .options=${S.map(a=>({value:a,label:j[a],attrs:{"data-mm-group":a}}))}></sw-segmented>
      </div>
      ${i?p`<div data-mm-floors-col>
        <h3 id="mm-floors">${s("סדר הקומות")}</h3>
        <ol aria-labelledby="mm-floors" data-mm-floors>
          ${this.floors.map((a,n)=>p`<li class=${z({floor:!0,dragging:this.dragFloor===a.id})} data-mm-floor=${a.id} draggable="true"
            @dragstart=${l=>{this.dragFloor=a.id,l.dataTransfer?.setData("text/plain",a.id),l.dataTransfer&&(l.dataTransfer.effectAllowed="move")}}
            @dragend=${()=>this.dragFloor=""} @dragover=${l=>this.dragFloor&&l.preventDefault()}
            @drop=${l=>{l.preventDefault();const v=this.dragFloor;this.dragFloor="",v&&this.change(w(e,r,v,n))}}>
            <span class="grip" aria-hidden="true">${g("grip")}</span><span class="nm">${f(a.name)}</span>
            <button type="button" class="ib" data-mm-floor-up=${a.id} ?disabled=${n===0} aria-label=${s("הקדם את {name}",{name:a.name})} title=${s("הקדם")} @click=${()=>this.change(w(e,r,a.id,n-1))}>${g("arrowUp")}</button>
            <button type="button" class="ib" data-mm-floor-down=${a.id} ?disabled=${n===r.length-1} aria-label=${s("אחר את {name}",{name:a.name})} title=${s("אחר")} @click=${()=>this.change(w(e,r,a.id,n+1))}>${g("arrowDown")}</button>
          </li>`)}
        </ol>
      </div>`:h}
      <h3>${this.heading}</h3>
      ${t.map(a=>p`<h4>${x(f(a.label))}</h4>
        <div class="rows">${A(a.items,n=>n.device.key,(n,l)=>this.row(n.device,l,a.items.length))}</div>`)}
    </section>`}};d.styles=[F,E`
    :host {
      display: block;
      color: var(--dv-text);
      font-family: var(--dv-font);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 16px 18px;
      border: 1px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
    }
    /* R5-MEDIA-ENERGY-297: the panel's headings read as headings (heading ink, no tracking); its rows are wells, not outlined boxes */
    h3,
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--dv-text));
    }
    h4 {
      margin-block-start: 6px;
    }
    .lbl {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 9px 10px;
      border: 1px solid transparent;
      border-radius: var(--dv-radius-sm);
      background: var(--dv-surface-2);
    }
    .row.off {
      opacity: 0.7;
    }
    .row.dragging {
      opacity: 0.45;
    }
    .l1,
    .l2 {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .grip {
      color: var(--dv-text-3);
      cursor: grab;
      display: inline-flex;
      font-size: var(--sw-fs-md);
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      font-size: var(--sw-fs-base);
      min-inline-size: 0;
    }
    .check input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--dv-accent);
      flex: none;
    }
    .check b {
      font-weight: var(--sw-fw-semibold);
    }
    .check small {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .sp {
      flex: 1;
    }
    .phone {
      display: flex;
      align-items: center;
      gap: 6px 12px;
      flex-wrap: wrap;
      padding-block-start: 8px;
      border-block-start: 1px dashed var(--dv-border);
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .phone .pl {
      font-weight: var(--sw-fw-bold);
    }
    select {
      min-block-size: 32px;
      padding-inline: 8px;
      border: 1px solid var(--dv-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-solid);
      color: var(--dv-text);
      font: inherit;
      font-size: var(--sw-fs-base);
    }
    .ib {
      position: relative;
      display: inline-grid;
      place-items: center;
      inline-size: 34px;
      block-size: 34px;
      padding: 0;
      border: 1px solid var(--dv-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface);
      color: var(--dv-text);
    }
    .ib[aria-pressed='true'],
    .ib[aria-expanded='true'] {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
      border-color: transparent;
    }
    .ib[disabled] {
      opacity: 0.35;
    }
    .ib .ic {
      font-size: var(--sw-fs-lg);
    }
    .ib .dot {
      position: absolute;
      inset-block-start: 4px;
      inset-inline-end: 4px;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dv-accent);
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 1px solid var(--dv-border);
      border-radius: var(--dv-radius-sm);
      background: var(--dv-surface-2);
    }
    .floor.dragging {
      opacity: 0.45;
    }
    .floor .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-base);
    }
    @media (pointer: coarse), (max-width: 767px) {
      .ib {
        inline-size: 44px;
        block-size: 44px;
      }
      select {
        min-block-size: 44px;
      }
      .check {
        min-block-size: 44px;
      }
    }
  `];c([b({attribute:!1})],d.prototype,"draft",2);c([b({attribute:!1})],d.prototype,"devices",2);c([b()],d.prototype,"scope",2);c([b({attribute:!1})],d.prototype,"floors",2);c([b({type:Boolean})],d.prototype,"simple",2);c([b()],d.prototype,"heading",2);c([y()],d.prototype,"drag",2);c([y()],d.prototype,"dragFloor",2);c([y()],d.prototype,"phoneOpen",2);d=c([C("multimedia-edit-panel")],d);
