import{bg as S,g as O,ay as g,j as k,i as D,U as t,bk as F,A as m,cs as z,a7 as v,b as d,bc as E,k as P}from"./index-DJHEuoub.js";import{m as h,n as x}from"./media-now-CC6fBhTh.js";import{m as G,a as A,c as C,s as $,S as f,t as T,e as I,G as R,b as U,d as y}from"./multimedia-base-C69-mczw.js";var B=Object.defineProperty,L=Object.getOwnPropertyDescriptor,c=(e,s,n,o)=>{for(var a=o>1?void 0:o?L(s,n):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(o?l(s,n,a):l(a))||a);return o&&a&&B(s,n,a),a};const j=["s","m","l"],q=["floor","area","none"];let p=class extends D{constructor(){super(...arguments),this.devices=[],this.scope="all",this.floors=[],this.simple=!1,this.heading=t("מסכים"),this.drag="",this.dragFloor="",this.phoneOpen=new Set}connectedCallback(){super.connectedCallback(),F(this)}change(e){this.dispatchEvent(new CustomEvent("layout-draft",{detail:e,bubbles:!0,composed:!0}))}keepFocus(e,s){this.updateComplete.then(()=>requestAnimationFrame(()=>{const n=this.renderRoot,o=`[data-mm-row="${CSS.escape(e)}"]`;(n.querySelector(`${o} [data-mm-${s}]:not([disabled])`)??n.querySelector(`${o} [data-mm-up]:not([disabled]), ${o} [data-mm-down]:not([disabled])`))?.focus()}))}move(e,s){this.change(G(this.draft,this.devices,e,s)),this.keepFocus(e,s<0?"up":"down")}onDrop(e,s){e.preventDefault();const n=this.drag;this.drag="",n&&this.change(A(this.draft,this.devices,n,s))}togglePhone(e){const s=new Set(this.phoneOpen);s.has(e)?s.delete(e):s.add(e),this.phoneOpen=s}row(e,s,n){const o=this.draft,a=C(o,e.key),r=this.scope==="me",l=a.phone_on??a.on,u=o.pinned.includes(e.key),_=a.phone_on!==null||a.phone_size!==null,w=this.phoneOpen.has(e.key);return d`<div class=${z({row:!0,off:!a.on,dragging:this.drag===e.key})} data-mm-row=${e.key} draggable="true"
      @dragstart=${i=>{this.drag=e.key,i.dataTransfer?.setData("text/plain",e.key),i.dataTransfer&&(i.dataTransfer.effectAllowed="move")}}
      @dragend=${()=>this.drag=""} @dragover=${i=>this.drag&&i.preventDefault()} @drop=${i=>this.onDrop(i,e.key)}>
      <div class="l1">
        <span class="grip" aria-hidden="true">${h("grip")}</span>
        <label class="check"><input type="checkbox" data-mm-on=${e.key} .checked=${a.on} aria-label=${t("הצג {name}",{name:e.name})} @change=${i=>this.change($(o,e.key,{on:i.target.checked}))} /><b>${x(v(e.name))}</b>${e.area_name?d`<small>${x(v(e.area_name))}</small>`:m}</label>
        <span class="sp"></span>
        <button type="button" class="ib" data-mm-up ?disabled=${s===0} aria-label=${t("הקדם את {name}",{name:e.name})} title=${t("הקדם")} @click=${()=>this.move(e.key,-1)}>${h("arrowUp")}</button>
        <button type="button" class="ib" data-mm-down ?disabled=${s===n-1} aria-label=${t("אחר את {name}",{name:e.name})} title=${t("אחר")} @click=${()=>this.move(e.key,1)}>${h("arrowDown")}</button>
      </div>
      <div class="l2">
        ${this.simple?m:d`<span class="seg sm" role="group" aria-label=${t("גודל: {name}",{name:e.name})}>${j.map(i=>d`<button type="button" data-mm-size=${`${e.key}:${i}`} aria-pressed=${String(a.size===i)} ?disabled=${!a.on} @click=${()=>this.change($(o,e.key,{size:i}))}>${f[i]}</button>`)}</span>`}
        <span class="sp"></span>
        ${r?m:d`<button type="button" class="ib" data-mm-pin=${e.key} aria-pressed=${String(u)} aria-label=${t("מועדף: {name}",{name:e.name})} title=${t("מועדף")} @click=${()=>this.change(T(o,e.key))}>${h("star")}</button>
          ${this.simple?m:d`<button type="button" class="ib" data-mm-phone-toggle=${e.key} aria-expanded=${String(w)} aria-label=${t("בנייד: {name}",{name:e.name})} title=${t("בנייד")} @click=${()=>this.togglePhone(e.key)}>${h("phone")}${_?d`<i class="dot" aria-hidden="true"></i>`:m}</button>`}`}
      </div>
      ${r||this.simple||!w?m:d`<div class="phone" data-mm-phone=${e.key}>
        <span class="pl">${t("בנייד")}</span>
        <label class="check"><input type="checkbox" data-mm-phone-on=${e.key} .checked=${l} aria-label=${t("הצג בנייד: {name}",{name:e.name})} @change=${i=>{const b=i.target.checked;this.change($(o,e.key,{phone_on:b===a.on?null:b}))}} />${t("הצג")}</label>
        <select data-mm-phone-size=${e.key} aria-label=${t("גודל בנייד: {name}",{name:e.name})} ?disabled=${!l} @change=${i=>{const b=i.target.value;this.change($(o,e.key,{phone_size:b==="s"||b==="m"?b:null}))}}>
          <option value="" ?selected=${!a.phone_size}>${t("אוטומטי ({size})",{size:f[a.size==="l"?"m":a.size]})}</option>
          <option value="s" ?selected=${a.phone_size==="s"}>${f.s}</option><option value="m" ?selected=${a.phone_size==="m"}>${f.m}</option>
        </select>
      </div>`}
    </div>`}render(){if(!this.draft)return m;const e=this.draft,s=I(this.devices,e),n=this.floors.map(a=>a.id),o=this.scope==="all"&&e.group_by==="floor"&&this.floors.length>1;return d`<section class="panel glass" data-mm-edit aria-label=${t("הגדרות · {heading}",{heading:this.heading})}>
      <div class="lbl" id="mm-grp">${t("קיבוץ")}
        <span class="seg sm" role="group" aria-labelledby="mm-grp" data-mm-groupby>${q.map(a=>d`<button type="button" data-mm-group=${a} aria-pressed=${String(e.group_by===a)} @click=${()=>this.change(U(e,a))}>${R[a]}</button>`)}</span>
      </div>
      ${o?d`<div data-mm-floors-col>
        <h3 id="mm-floors">${t("סדר הקומות")}</h3>
        <ol aria-labelledby="mm-floors" data-mm-floors>
          ${this.floors.map((a,r)=>d`<li class=${z({floor:!0,dragging:this.dragFloor===a.id})} data-mm-floor=${a.id} draggable="true"
            @dragstart=${l=>{this.dragFloor=a.id,l.dataTransfer?.setData("text/plain",a.id),l.dataTransfer&&(l.dataTransfer.effectAllowed="move")}}
            @dragend=${()=>this.dragFloor=""} @dragover=${l=>this.dragFloor&&l.preventDefault()}
            @drop=${l=>{l.preventDefault();const u=this.dragFloor;this.dragFloor="",u&&this.change(y(e,n,u,r))}}>
            <span class="grip" aria-hidden="true">${h("grip")}</span><span class="nm">${v(a.name)}</span>
            <button type="button" class="ib" data-mm-floor-up=${a.id} ?disabled=${r===0} aria-label=${t("הקדם את {name}",{name:a.name})} title=${t("הקדם")} @click=${()=>this.change(y(e,n,a.id,r-1))}>${h("arrowUp")}</button>
            <button type="button" class="ib" data-mm-floor-down=${a.id} ?disabled=${r===n.length-1} aria-label=${t("אחר את {name}",{name:a.name})} title=${t("אחר")} @click=${()=>this.change(y(e,n,a.id,r+1))}>${h("arrowDown")}</button>
          </li>`)}
        </ol>
      </div>`:m}
      <h3>${this.heading}</h3>
      ${s.map(a=>d`<h4>${x(v(a.label))}</h4>
        <div class="rows">${E(a.items,r=>r.device.key,(r,l)=>this.row(r.device,l,a.items.length))}</div>`)}
    </section>`}};p.styles=[S,O`
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
      font-weight: 700;
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
      font-weight: 600;
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
      font-weight: 700;
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
  `];c([g({attribute:!1})],p.prototype,"draft",2);c([g({attribute:!1})],p.prototype,"devices",2);c([g()],p.prototype,"scope",2);c([g({attribute:!1})],p.prototype,"floors",2);c([g({type:Boolean})],p.prototype,"simple",2);c([g()],p.prototype,"heading",2);c([k()],p.prototype,"drag",2);c([k()],p.prototype,"dragFloor",2);c([k()],p.prototype,"phoneOpen",2);p=c([P("multimedia-edit-panel")],p);
