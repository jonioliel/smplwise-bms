import{iw as G,ig as O,iq as I,ix as _,hS as M,E as j,F as b,G as S,a as N,hU as U,A as u,dG as q,q as $,e as d,bW as B,H as J,dv as Z,i as A,iy as H}from"./index-CNy_qMuw.js";import{m as h,n as y}from"./media-now-B7mfqB4U.js";const x={s:"קטן",m:"רגיל",l:"גדול"},K={floor:"לפי קומה",area:"לפי חדר",none:"רציף"},ce=[{id:"all",label:"הכל"},{id:"on",label:"פועלים"},{id:"off",label:"כבויים"},{id:"un",label:"לא זמינים"}],W=24,z="none",pe=["g","u1","b"],D=(e,t)=>JSON.stringify(e)===JSON.stringify(t),X=(e,t)=>e.name.localeCompare(t.name,"he");function Y(e,t){const r=G(e,t);if(!t)return r;const s={...r.cards};for(const[a,n]of Object.entries(t.cards))n.on!==void 0&&s[a]&&(s[a]={...s[a],phone_on:null});return{...r,cards:s}}const fe={floor:"",area:"",q:"",state:"all"},me=e=>!!(e.floor||e.area||e.q.trim()||e.state!=="all");function ue(e){const t=e.get("state");return{floor:e.get("floor")??"",area:e.get("area")??"",q:e.get("q")??"",state:t==="on"||t==="off"||t==="un"?t:"all"}}function he(e,t=new URLSearchParams){for(const r of["floor","area","q","state"])t.delete(r);return e.floor&&t.set("floor",e.floor),e.area&&t.set("area",e.area),e.q.trim()&&t.set("q",e.q.trim()),e.state!=="all"&&t.set("state",e.state),t}const F=e=>e.floor_id??z;function R(e){const t=e.live.power;return t==="on"?"on":t==="unavailable"||t==="unknown"?"un":"off"}function Q(e,t){if(t.floor&&F(e)!==t.floor||t.area&&(e.area_id??"")!==t.area||t.state!=="all"&&R(e)!==t.state)return!1;const r=t.q.trim().toLowerCase();return!(r&&!`${e.name} ${e.area_name??""} ${e.floor_name??""}`.toLowerCase().includes(r))}const ge=(e,t)=>e.filter(r=>Q(r,t));function be(e){const t={total:e.length,on:0,off:0,un:0};for(const r of e)t[R(r)]+=1;return t}function ve(e,t){const r=new Map;for(const n of e){const o=F(n),l=r.get(o)??{id:o,name:n.floor_name??"ללא שיוך",count:0};l.count+=1,r.set(o,l)}const s=new Map(t.floor_order.map((n,o)=>[n,o])),a=new Map([...r.keys()].map((n,o)=>[n,o]));return[...r.values()].sort((n,o)=>{const l=s.get(n.id)??(n.id===z?2e6:1e6),m=s.get(o.id)??(o.id===z?2e6:1e6);return l-m||(a.get(n.id)??0)-(a.get(o.id)??0)})}function $e(e,t){const r=new Map;for(const s of e)t&&F(s)!==t||s.area_id&&!r.has(s.area_id)&&r.set(s.area_id,s.area_name??s.area_id);return[...r].map(([s,a])=>({id:s,name:a}))}function v(e,t){const r=new Set(e.order),s=t.filter(n=>!r.has(n.key)).sort(X).map(n=>n.key),a={...e.cards};for(const n of t)a[n.key]||(a[n.key]={...O});return{...e,order:[...e.order,...s],pinned:[...e.pinned],floor_order:[...e.floor_order],cards:a}}const V=(e,t)=>e.floor_order.length||!t.length?e:{...e,floor_order:[...t]};function xe(e,t,r,s,a=[]){return V(v(e==="all"?t:Y(t,r),s),a)}const E=(e,t)=>e.cards[t]??O;function k(e,t,r){return{...e,cards:{...e.cards,[t]:{...E(e,t),...r}}}}const ee=(e,t)=>({...e,group_by:t});function te(e,t){return e.pinned.includes(t)?{...e,pinned:e.pinned.filter(r=>r!==t)}:e.pinned.length>=W?e:{...e,pinned:[...e.pinned,t]}}function P(e,t){const r={...t,cards:Object.fromEntries(e.map(s=>[s.key,{...E(t,s.key),on:!0,phone_on:!0}]))};return I(e,r,!1)}function ae(e,t,r,s){const a=P(t,e).find(l=>l.items.some(m=>m.device.key===r));if(!a)return e;const o=a.items.findIndex(l=>l.device.key===r)+s;return o<0||o>=a.items.length?e:T(e,t,r,a.items[o].device.key,a.id==="pinned")}function re(e,t,r,s){if(r===s)return e;const n=P(t,e).find(o=>o.items.some(l=>l.device.key===r));return!n||!n.items.some(o=>o.device.key===s)?e:T(e,t,r,s,n.id==="pinned")}function T(e,t,r,s,a){if(a)return{...e,pinned:_(e.pinned,r,e.pinned.indexOf(s))};const n=v(e,t);return{...n,order:_(n.order,r,n.order.indexOf(s))}}function w(e,t,r,s){return{...e,floor_order:_(t,r,s)}}function ke(e,t,r){const s=v(e,r),a=v(t,r),n={};for(const[m,g]of Object.entries(a.cards)){const i=s.cards[m]??O,p={};g.on!==i.on&&(p.on=g.on),g.size!==i.size&&(p.size=g.size),Object.keys(p).length&&(n[m]=p)}const o=a.group_by!==s.group_by?a.group_by:null,l=D(a.order,s.order)?null:a.order;return!o&&!l&&!Object.keys(n).length?null:{group_by:o,order:l,cards:n}}const ye=(e,t)=>!D(e,t);function we(e,t,r,s){const a=v(e,t);return!r.floor_order.length&&D(a.floor_order,s)?{...a,floor_order:[]}:a}var se=Object.defineProperty,ne=Object.getOwnPropertyDescriptor,f=(e,t,r,s)=>{for(var a=s>1?void 0:s?ne(t,r):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(s?o(t,r,a):o(a))||a);return s&&a&&se(t,r,a),a};const oe=["s","m","l"],ie=["floor","area","none"];let c=class extends N{constructor(){super(...arguments),this.devices=[],this.scope="all",this.floors=[],this.simple=!1,this.heading="מסכים",this.drag="",this.dragFloor="",this.phoneOpen=new Set}connectedCallback(){super.connectedCallback(),U(this)}change(e){this.dispatchEvent(new CustomEvent("layout-draft",{detail:e,bubbles:!0,composed:!0}))}keepFocus(e,t){this.updateComplete.then(()=>requestAnimationFrame(()=>{const r=this.renderRoot,s=`[data-mm-row="${CSS.escape(e)}"]`;(r.querySelector(`${s} [data-mm-${t}]:not([disabled])`)??r.querySelector(`${s} [data-mm-up]:not([disabled]), ${s} [data-mm-down]:not([disabled])`))?.focus()}))}move(e,t){this.change(ae(this.draft,this.devices,e,t)),this.keepFocus(e,t<0?"up":"down")}onDrop(e,t){e.preventDefault();const r=this.drag;this.drag="",r&&this.change(re(this.draft,this.devices,r,t))}togglePhone(e){const t=new Set(this.phoneOpen);t.has(e)?t.delete(e):t.add(e),this.phoneOpen=t}row(e,t,r){const s=this.draft,a=E(s,e.key),n=this.scope==="me",o=a.phone_on??a.on,l=s.pinned.includes(e.key),m=a.phone_on!==null||a.phone_size!==null,g=this.phoneOpen.has(e.key);return d`<div class=${q({row:!0,off:!a.on,dragging:this.drag===e.key})} data-mm-row=${e.key} draggable="true"
      @dragstart=${i=>{this.drag=e.key,i.dataTransfer?.setData("text/plain",e.key),i.dataTransfer&&(i.dataTransfer.effectAllowed="move")}}
      @dragend=${()=>this.drag=""} @dragover=${i=>this.drag&&i.preventDefault()} @drop=${i=>this.onDrop(i,e.key)}>
      <div class="l1">
        <span class="grip" aria-hidden="true">${h("grip")}</span>
        <label class="check"><input type="checkbox" data-mm-on=${e.key} .checked=${a.on} aria-label=${`הצג ${e.name}`} @change=${i=>this.change(k(s,e.key,{on:i.target.checked}))} /><b>${y($(e.name))}</b>${e.area_name?d`<small>${y($(e.area_name))}</small>`:u}</label>
        <span class="sp"></span>
        <button type="button" class="ib" data-mm-up ?disabled=${t===0} aria-label=${`הקדם את ${e.name}`} title="הקדם" @click=${()=>this.move(e.key,-1)}>${h("arrowUp")}</button>
        <button type="button" class="ib" data-mm-down ?disabled=${t===r-1} aria-label=${`אחר את ${e.name}`} title="אחר" @click=${()=>this.move(e.key,1)}>${h("arrowDown")}</button>
      </div>
      <div class="l2">
        ${this.simple?u:d`<span class="seg sm" role="group" aria-label=${`גודל: ${e.name}`}>${oe.map(i=>d`<button type="button" data-mm-size=${`${e.key}:${i}`} aria-pressed=${String(a.size===i)} ?disabled=${!a.on} @click=${()=>this.change(k(s,e.key,{size:i}))}>${x[i]}</button>`)}</span>`}
        <span class="sp"></span>
        ${n?u:d`<button type="button" class="ib" data-mm-pin=${e.key} aria-pressed=${String(l)} aria-label=${`מועדף: ${e.name}`} title="מועדף" @click=${()=>this.change(te(s,e.key))}>${h("star")}</button>
          ${this.simple?u:d`<button type="button" class="ib" data-mm-phone-toggle=${e.key} aria-expanded=${String(g)} aria-label=${`בנייד: ${e.name}`} title="בנייד" @click=${()=>this.togglePhone(e.key)}>${h("phone")}${m?d`<i class="dot" aria-hidden="true"></i>`:u}</button>`}`}
      </div>
      ${n||this.simple||!g?u:d`<div class="phone" data-mm-phone=${e.key}>
        <span class="pl">בנייד</span>
        <label class="check"><input type="checkbox" data-mm-phone-on=${e.key} .checked=${o} aria-label=${`הצג בנייד: ${e.name}`} @change=${i=>{const p=i.target.checked;this.change(k(s,e.key,{phone_on:p===a.on?null:p}))}} />הצג</label>
        <select data-mm-phone-size=${e.key} aria-label=${`גודל בנייד: ${e.name}`} ?disabled=${!o} @change=${i=>{const p=i.target.value;this.change(k(s,e.key,{phone_size:p==="s"||p==="m"?p:null}))}}>
          <option value="" ?selected=${!a.phone_size}>אוטומטי (${x[a.size==="l"?"m":a.size]})</option>
          <option value="s" ?selected=${a.phone_size==="s"}>${x.s}</option><option value="m" ?selected=${a.phone_size==="m"}>${x.m}</option>
        </select>
      </div>`}
    </div>`}render(){if(!this.draft)return u;const e=this.draft,t=P(this.devices,e),r=this.floors.map(a=>a.id),s=this.scope==="all"&&e.group_by==="floor"&&this.floors.length>1;return d`<section class="panel glass" data-mm-edit aria-label=${`הגדרות · ${this.heading}`}>
      <div class="lbl" id="mm-grp">קיבוץ
        <span class="seg sm" role="group" aria-labelledby="mm-grp" data-mm-groupby>${ie.map(a=>d`<button type="button" data-mm-group=${a} aria-pressed=${String(e.group_by===a)} @click=${()=>this.change(ee(e,a))}>${K[a]}</button>`)}</span>
      </div>
      ${s?d`<div data-mm-floors-col>
        <h3 id="mm-floors">סדר הקומות</h3>
        <ol aria-labelledby="mm-floors" data-mm-floors>
          ${this.floors.map((a,n)=>d`<li class=${q({floor:!0,dragging:this.dragFloor===a.id})} data-mm-floor=${a.id} draggable="true"
            @dragstart=${o=>{this.dragFloor=a.id,o.dataTransfer?.setData("text/plain",a.id),o.dataTransfer&&(o.dataTransfer.effectAllowed="move")}}
            @dragend=${()=>this.dragFloor=""} @dragover=${o=>this.dragFloor&&o.preventDefault()}
            @drop=${o=>{o.preventDefault();const l=this.dragFloor;this.dragFloor="",l&&this.change(w(e,r,l,n))}}>
            <span class="grip" aria-hidden="true">${h("grip")}</span><span class="nm">${$(a.name)}</span>
            <button type="button" class="ib" data-mm-floor-up=${a.id} ?disabled=${n===0} aria-label=${`הקדם את ${a.name}`} title="הקדם" @click=${()=>this.change(w(e,r,a.id,n-1))}>${h("arrowUp")}</button>
            <button type="button" class="ib" data-mm-floor-down=${a.id} ?disabled=${n===r.length-1} aria-label=${`אחר את ${a.name}`} title="אחר" @click=${()=>this.change(w(e,r,a.id,n+1))}>${h("arrowDown")}</button>
          </li>`)}
        </ol>
      </div>`:u}
      <h3>${this.heading}</h3>
      ${t.map(a=>d`<h4>${y($(a.label))}</h4>
        <div class="rows">${B(a.items,n=>n.device.key,(n,o)=>this.row(n.device,o,a.items.length))}</div>`)}
    </section>`}};c.styles=[M,j`
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
  `];f([b({attribute:!1})],c.prototype,"draft",2);f([b({attribute:!1})],c.prototype,"devices",2);f([b()],c.prototype,"scope",2);f([b({attribute:!1})],c.prototype,"floors",2);f([b({type:Boolean})],c.prototype,"simple",2);f([b()],c.prototype,"heading",2);f([S()],c.prototype,"drag",2);f([S()],c.prototype,"dragFloor",2);f([S()],c.prototype,"phoneOpen",2);c=f([J("multimedia-edit-panel")],c);let C=null;async function L(){const e=await Z().layout();return A()?e:{...e,personal:C}}async function _e(e){return A()?(await H({"multimedia.personal":e}),L()):(C=e,L())}export{pe as D,fe as N,ce as S,z as a,he as b,we as c,_e as d,Y as e,ue as f,P as g,ge as h,ye as i,E as j,k,L as l,ae as m,be as n,ve as o,ke as p,me as q,$e as r,xe as s,te as t,V as w};
//# sourceMappingURL=media-personal-qBsKqXod.js.map
