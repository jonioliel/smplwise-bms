import{bg as D,g as F,ax as g,j as w,i as E,U as t,bk as P,A as h,cp as z,a6 as u,b as p,bd as G,k as A}from"./index-Cwrvr-7C.js";import{m as b,n as x}from"./media-now-DvermjKF.js";import{m as C,a as T,c as I,s as f,S as $,t as R,e as U,b as B,G as L,d as y}from"./multimedia-base-BPbCx8xf.js";var j=Object.defineProperty,q=Object.getOwnPropertyDescriptor,c=(e,s,r,o)=>{for(var a=o>1?void 0:o?q(s,r):s,n=e.length-1,l;n>=0;n--)(l=e[n])&&(a=(o?l(s,r,a):l(a))||a);return o&&a&&j(s,r,a),a};const _=["s","m","l"],O=["floor","area","none"];let d=class extends E{constructor(){super(...arguments),this.devices=[],this.scope="all",this.floors=[],this.simple=!1,this.heading=t("מסכים"),this.drag="",this.dragFloor="",this.phoneOpen=new Set}connectedCallback(){super.connectedCallback(),P(this)}change(e){this.dispatchEvent(new CustomEvent("layout-draft",{detail:e,bubbles:!0,composed:!0}))}keepFocus(e,s){this.updateComplete.then(()=>requestAnimationFrame(()=>{const r=this.renderRoot,o=`[data-mm-row="${CSS.escape(e)}"]`;(r.querySelector(`${o} [data-mm-${s}]:not([disabled])`)??r.querySelector(`${o} [data-mm-up]:not([disabled]), ${o} [data-mm-down]:not([disabled])`))?.focus()}))}move(e,s){this.change(C(this.draft,this.devices,e,s)),this.keepFocus(e,s<0?"up":"down")}onDrop(e,s){e.preventDefault();const r=this.drag;this.drag="",r&&this.change(T(this.draft,this.devices,r,s))}togglePhone(e){const s=new Set(this.phoneOpen);s.has(e)?s.delete(e):s.add(e),this.phoneOpen=s}row(e,s,r){const o=this.draft,a=I(o,e.key),n=this.scope==="me",l=a.phone_on??a.on,v=o.pinned.includes(e.key),S=a.phone_on!==null||a.phone_size!==null,k=this.phoneOpen.has(e.key);return p`<div class=${z({row:!0,off:!a.on,dragging:this.drag===e.key})} data-mm-row=${e.key} draggable="true"
      @dragstart=${i=>{this.drag=e.key,i.dataTransfer?.setData("text/plain",e.key),i.dataTransfer&&(i.dataTransfer.effectAllowed="move")}}
      @dragend=${()=>this.drag=""} @dragover=${i=>this.drag&&i.preventDefault()} @drop=${i=>this.onDrop(i,e.key)}>
      <div class="l1">
        <span class="grip" aria-hidden="true">${b("grip")}</span>
        <label class="check"><input type="checkbox" data-mm-on=${e.key} .checked=${a.on} aria-label=${t("הצג {name}",{name:e.name})} @change=${i=>this.change(f(o,e.key,{on:i.target.checked}))} /><b>${x(u(e.name))}</b>${e.area_name?p`<small>${x(u(e.area_name))}</small>`:h}</label>
        <span class="sp"></span>
        <button type="button" class="ib" data-mm-up ?disabled=${s===0} aria-label=${t("הקדם את {name}",{name:e.name})} title=${t("הקדם")} @click=${()=>this.move(e.key,-1)}>${b("arrowUp")}</button>
        <button type="button" class="ib" data-mm-down ?disabled=${s===r-1} aria-label=${t("אחר את {name}",{name:e.name})} title=${t("אחר")} @click=${()=>this.move(e.key,1)}>${b("arrowDown")}</button>
      </div>
      <div class="l2">
        ${this.simple?h:p`<sw-segmented size="sm" label=${t("גודל: {name}",{name:e.name})} value=${a.size} ?disabled=${!a.on}
          @change=${i=>this.change(f(o,e.key,{size:_.find(m=>m===i.detail.value)??a.size}))}
          .options=${_.map(i=>({value:i,label:$[i],attrs:{"data-mm-size":`${e.key}:${i}`}}))}></sw-segmented>`}
        <span class="sp"></span>
        ${n?h:p`<button type="button" class="ib" data-mm-pin=${e.key} aria-pressed=${String(v)} aria-label=${t("מועדף: {name}",{name:e.name})} title=${t("מועדף")} @click=${()=>this.change(R(o,e.key))}>${b("star")}</button>
          ${this.simple?h:p`<button type="button" class="ib" data-mm-phone-toggle=${e.key} aria-expanded=${String(k)} aria-label=${t("בנייד: {name}",{name:e.name})} title=${t("בנייד")} @click=${()=>this.togglePhone(e.key)}>${b("phone")}${S?p`<i class="dot" aria-hidden="true"></i>`:h}</button>`}`}
      </div>
      ${n||this.simple||!k?h:p`<div class="phone" data-mm-phone=${e.key}>
        <span class="pl">${t("בנייד")}</span>
        <label class="check"><input type="checkbox" data-mm-phone-on=${e.key} .checked=${l} aria-label=${t("הצג בנייד: {name}",{name:e.name})} @change=${i=>{const m=i.target.checked;this.change(f(o,e.key,{phone_on:m===a.on?null:m}))}} />${t("הצג")}</label>
        <select data-mm-phone-size=${e.key} aria-label=${t("גודל בנייד: {name}",{name:e.name})} ?disabled=${!l} @change=${i=>{const m=i.target.value;this.change(f(o,e.key,{phone_size:m==="s"||m==="m"?m:null}))}}>
          <option value="" ?selected=${!a.phone_size}>${t("אוטומטי ({size})",{size:$[a.size==="l"?"m":a.size]})}</option>
          <option value="s" ?selected=${a.phone_size==="s"}>${$.s}</option><option value="m" ?selected=${a.phone_size==="m"}>${$.m}</option>
        </select>
      </div>`}
    </div>`}render(){if(!this.draft)return h;const e=this.draft,s=U(this.devices,e),r=this.floors.map(a=>a.id),o=this.scope==="all"&&e.group_by==="floor"&&this.floors.length>1;return p`<section class="panel glass" data-mm-edit aria-label=${t("הגדרות · {heading}",{heading:this.heading})}>
      <div class="lbl" id="mm-grp">${t("קיבוץ")}
        <sw-segmented size="sm" label=${t("קיבוץ")} data-mm-groupby value=${e.group_by} @change=${a=>this.change(B(e,O.find(n=>n===a.detail.value)??e.group_by))}
          .options=${O.map(a=>({value:a,label:L[a],attrs:{"data-mm-group":a}}))}></sw-segmented>
      </div>
      ${o?p`<div data-mm-floors-col>
        <h3 id="mm-floors">${t("סדר הקומות")}</h3>
        <ol aria-labelledby="mm-floors" data-mm-floors>
          ${this.floors.map((a,n)=>p`<li class=${z({floor:!0,dragging:this.dragFloor===a.id})} data-mm-floor=${a.id} draggable="true"
            @dragstart=${l=>{this.dragFloor=a.id,l.dataTransfer?.setData("text/plain",a.id),l.dataTransfer&&(l.dataTransfer.effectAllowed="move")}}
            @dragend=${()=>this.dragFloor=""} @dragover=${l=>this.dragFloor&&l.preventDefault()}
            @drop=${l=>{l.preventDefault();const v=this.dragFloor;this.dragFloor="",v&&this.change(y(e,r,v,n))}}>
            <span class="grip" aria-hidden="true">${b("grip")}</span><span class="nm">${u(a.name)}</span>
            <button type="button" class="ib" data-mm-floor-up=${a.id} ?disabled=${n===0} aria-label=${t("הקדם את {name}",{name:a.name})} title=${t("הקדם")} @click=${()=>this.change(y(e,r,a.id,n-1))}>${b("arrowUp")}</button>
            <button type="button" class="ib" data-mm-floor-down=${a.id} ?disabled=${n===r.length-1} aria-label=${t("אחר את {name}",{name:a.name})} title=${t("אחר")} @click=${()=>this.change(y(e,r,a.id,n+1))}>${b("arrowDown")}</button>
          </li>`)}
        </ol>
      </div>`:h}
      <h3>${this.heading}</h3>
      ${s.map(a=>p`<h4>${x(u(a.label))}</h4>
        <div class="rows">${G(a.items,n=>n.device.key,(n,l)=>this.row(n.device,l,a.items.length))}</div>`)}
    </section>`}};d.styles=[D,F`
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
  `];c([g({attribute:!1})],d.prototype,"draft",2);c([g({attribute:!1})],d.prototype,"devices",2);c([g()],d.prototype,"scope",2);c([g({attribute:!1})],d.prototype,"floors",2);c([g({type:Boolean})],d.prototype,"simple",2);c([g()],d.prototype,"heading",2);c([w()],d.prototype,"drag",2);c([w()],d.prototype,"dragFloor",2);c([w()],d.prototype,"phoneOpen",2);d=c([A("multimedia-edit-panel")],d);
