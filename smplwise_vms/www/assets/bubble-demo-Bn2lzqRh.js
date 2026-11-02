import{a as v,cU as u,e as a,wj as l,A as h,wc as b,bb as w,E as g,G as c,H as m}from"./index-DqJBc8eX.js";import"./sw-logo-art-Va6y_cIM.js";var f=Object.defineProperty,$=Object.getOwnPropertyDescriptor,o=(e,t,i,s)=>{for(var n=s>1?void 0:s?$(t,i):t,d=e.length-1,p;d>=0;d--)(p=e[d])&&(n=(s?p(t,i,n):p(n))||n);return s&&n&&f(t,i,n),n};const x=[{id:"l1",kind:"light",name:"תאורה מרכזית",icon:"light",on:!0,v:.72,hue:2},{id:"l2",kind:"light",name:"ספוטים קיר",icon:"light",on:!0,v:.4,hue:1},{id:"l3",kind:"light",name:"פס לד ספרייה ארוך מאוד בשם",icon:"light",on:!0,v:.25,hue:3},{id:"l4",kind:"light",name:"מנורת קריאה",icon:"light",on:!1,v:.6,hue:7},{id:"s1",kind:"switch",name:"דוד שמש",icon:"bolt",on:!0,hue:6},{id:"s2",kind:"switch",name:"השקיה",icon:"bolt",on:!1,hue:3},{id:"c1",kind:"cover",name:"תריס חלון גדול",icon:"coverOpen",on:!0,v:.6,hue:4},{id:"c2",kind:"cover",name:"תריס מרפסת",icon:"coverOpen",on:!1,v:0,hue:4},{id:"k1",kind:"climate",name:"מזגן סלון",icon:"snow",on:!0,hue:4,state:"קירור · 23°"},{id:"u1",kind:"light",name:"מנורת חוץ",icon:"light",on:!1,v:0,hue:8,unavailable:!0,state:"לא זמין"},{id:"n1",kind:"sensor",name:"טמפרטורה",icon:"thermometer",hue:5,state:"25.5°"},{id:"n2",kind:"sensor",name:"דלת מרפסת",icon:"sensor",hue:1,state:"סגורה"}],k=[{id:"g",name:"קומת קרקע",areas:["סלון","מטבח","פינת אוכל","חדר עבודה"]},{id:"f1",name:"קומה א׳",areas:["חדר שינה הורים","חדר ילדים","חדר רחצה"]},{id:"out",name:"חוץ",areas:["חצר","חניה"]}];let r=class extends v{constructor(){super(...arguments),this.devices=x.map(e=>({...e})),this.sheet="",this.area="סלון",this.collapsed=new Set(["out"]),this.look=new u(this)}set(e,t){this.devices=this.devices.map(i=>i.id===e?{...i,...t}:i)}pill(e){const t=Math.round((e.v??0)*100);return e.kind==="light"?a`<sw-pill variant="slider" .icon=${e.icon} .label=${e.name} .state=${e.state??(e.on?`דולק · ${t}%`:"כבוי")} .value=${e.v??0} ?on=${!!e.on} .hue=${e.hue} ?unavailable=${!!e.unavailable} data-dev=${e.id}
        @toggle=${i=>this.set(e.id,{on:i.detail.on})} @input=${i=>this.set(e.id,{v:i.detail.value,on:i.detail.value>0})}
        @icon-click=${()=>this.sheet="light"}></sw-pill>`:e.kind==="switch"?a`<sw-pill variant="toggle" .icon=${e.icon} .label=${e.name} .state=${e.on?"פועל":"כבוי"} ?on=${!!e.on} ?accent=${!!e.on} .hue=${e.hue} data-dev=${e.id} @toggle=${i=>this.set(e.id,{on:i.detail.on})}></sw-pill>`:e.kind==="cover"?a`<sw-pill variant="slider" .icon=${e.icon} .label=${e.name} .state=${t?`פתוח · ${t}%`:"סגור"} .value=${e.v??0} ?on=${(e.v??0)>0} fill-color="var(--sw-accent-soft)" .hue=${e.hue} data-dev=${e.id}
        @input=${i=>this.set(e.id,{v:i.detail.value})} @toggle=${()=>this.set(e.id,{v:(e.v??0)>0?0:1})}>
        <button slot="subs" class="sb" aria-label="פתח" @click=${()=>this.set(e.id,{v:1})}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
        <button slot="subs" class="sb" aria-label="עצור"><sw-icon name="pause" size=${18}></sw-icon></button>
        <button slot="subs" class="sb" aria-label="סגור" @click=${()=>this.set(e.id,{v:0})}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
      </sw-pill>`:e.kind==="climate"?a`<sw-pill variant="plain" .icon=${e.icon} .label=${e.name} .state=${e.state??""} ?on=${!!e.on} fill-color="var(--sw-cool)" .hue=${e.hue} data-dev=${e.id} @activate=${()=>this.sheet="light"}>
        <button slot="subs" class="sb" aria-label="הנמך"><sw-icon name="minus" size=${18}></sw-icon></button>
        <button slot="subs" class="chip" aria-label="יעד 23 מעלות">23°</button>
        <button slot="subs" class="sb" aria-label="הגבה"><sw-icon name="plus" size=${18}></sw-icon></button>
      </sw-pill>`:a`<sw-pill variant="plain" .icon=${e.icon} .label=${e.name} .state=${e.state??""} .hue=${e.hue} data-dev=${e.id}></sw-pill>`}tree(){return a`<nav class="tree" aria-label="קומות ואזורים" data-demo-tree>
      <h3>הבית</h3>
      ${k.map(e=>{const t=this.collapsed.has(e.id);return a`<div class="floor" data-collapsed=${String(t)}>
          <div class="floor-head">
            <button type="button" class="chev" aria-expanded=${String(!t)} aria-label=${`${t?"הרחב":"כווץ"} ${e.name}`} @click=${()=>{const i=new Set(this.collapsed);i.has(e.id)?i.delete(e.id):i.add(e.id),this.collapsed=i}}><sw-icon name="chevronDown" size=${16}></sw-icon></button>
            <span class="t">${e.name}</span>
            <button type="button" class="sub" aria-label=${`תפריט ${e.name}`}><sw-icon name="more" size=${16}></sw-icon></button>
          </div>
          <div class="areas">${e.areas.map(i=>a`<button type="button" class="tree-row" aria-current=${i===this.area?"true":"false"} tabindex=${t?-1:0} @click=${()=>{this.area=i,this.sheet==="inline"&&(this.sheet="")}}><span class="dot"><sw-icon name="home" size=${16}></sw-icon></span><span class="n">${i}</span></button>`)}</div>
        </div>`})}
    </nav>`}render(){const e=this.look.value,t=e.popup,i=this.devices.filter(s=>s.kind==="light");return a`<h1>Bubble · רכיבי היסוד</h1>
      <div class="status" data-demo-status>סקין ${b()} · ${w()} · ${l.density.labelHe[e.density]} · ${l.surface.labelHe[e.surface]} · ${l.popup.labelHe[t]} · ${l.radius.labelHe[e.radius]} · ${e.transparency}% · ${e.scale}% · ${e.touch}px</div>
      <div class="actions">
        <button type="button" class="btn primary" data-open-area @click=${()=>this.sheet="area"}><sw-icon name="home" size=${18}></sw-icon>פתח אזור</button>
        <button type="button" class="btn" data-open-confirm @click=${()=>this.sheet="confirm"}>אישור ממורכז</button>
        <button type="button" class="btn" data-open-inline @click=${()=>this.sheet="inline"}>פתח בתוך הדף</button>
      </div>
      <div class="frame">
        ${this.tree()}
        <div>
          <sw-sheet kind="inline" heading=${`${this.area} · בתוך הדף`} ?open=${this.sheet==="inline"} data-sheet-inline @close=${()=>this.sheet=""}>
            <div class="grid">${i.slice(0,2).map(s=>this.pill(s))}</div>
            <button slot="footer" type="button" class="btn" @click=${()=>this.sheet=""}>סגור</button>
          </sw-sheet>
          <h2>תאורה</h2>
          <div class="grid" data-demo-grid>${this.devices.filter(s=>s.kind==="light"||s.kind==="switch").map(s=>this.pill(s))}</div>
          <h2>אקלים ותריסים</h2>
          <div class="grid">${this.devices.filter(s=>s.kind==="cover"||s.kind==="climate").map(s=>this.pill(s))}</div>
          <h2>רשימה</h2>
          <div class="grid list" data-demo-list>${this.devices.filter(s=>s.kind==="sensor"||s.kind==="switch").map(s=>a`${this.pill({...s,id:`r-${s.id}`})}`)}</div>
        </div>
      </div>

      <sw-sheet wide heading=${this.area} ?open=${this.sheet==="area"} data-sheet-area @close=${()=>this.sheet=""}>
        <sw-pill slot="head" variant="plain" icon="home" .label=${this.area} state="3 דולקים · 25.5°" .hue=${2}>
          <button slot="subs" class="chip" aria-label="בהירות האזור">72%</button>
          <button slot="subs" class="sb" aria-label="כבה הכול"><sw-icon name="power" size=${18}></sw-icon></button>
        </sw-pill>
        <h2>תאורה</h2>
        <div class="grid">${i.map(s=>this.pill(s))}</div>
        <h2>תריסים</h2>
        <div class="grid">${this.devices.filter(s=>s.kind==="cover").map(s=>this.pill(s))}</div>
        <div class="kv"><div><span class="k">טמפרטורה</span><div class="v">25.5°</div></div><div><span class="k">לחות</span><div class="v">48%</div></div><div><span class="k">תנועה</span><div class="v">לפני 2 דק׳</div></div></div>
      </sw-sheet>

      <sw-sheet kind="centred" narrow heading="לכבות את כל התאורה?" ?open=${this.sheet==="confirm"} data-sheet-confirm @close=${()=>this.sheet=""}>
        <div>4 מנורות ייכבו ב${this.area}.</div>
        <button slot="footer" type="button" class="btn" @click=${()=>this.sheet=""}>ביטול</button>
        <button slot="footer" type="button" class="btn danger" data-confirm-off @click=${()=>{this.devices=this.devices.map(s=>s.kind==="light"?{...s,on:!1}:s),this.sheet=""}}>כבה</button>
      </sw-sheet>

      <sw-sheet heading="תאורה מרכזית" ?open=${this.sheet==="light"} data-sheet-light @close=${()=>this.sheet=""}>
        <div class="big" role="slider" tabindex="0" aria-label="בהירות" aria-valuemin="0" aria-valuemax="100" aria-valuenow="72" style="--v:0.72"><span>בהירות</span><span style="margin-inline-start:auto">72%</span></div>
        <div class="actions"><button type="button" class="chip" aria-pressed="true">חם</button><button type="button" class="chip">ניטרלי</button><button type="button" class="chip">קר</button></div>
        ${h}
      </sw-sheet>`}};r.styles=g`
    :host {
      display: block;
      padding: var(--sw-page-pad);
      color: var(--sw-text);
    }
    .frame {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-gap-grid);
      align-items: start;
    }
    @media (min-width: 900px) {
      .frame {
        grid-template-columns: var(--sw-tree-w) minmax(0, 1fr);
      }
    }
    h1 {
      font-size: var(--sw-h1);
      margin: 0 0 12px;
      color: var(--sw-heading);
      font-weight: var(--sw-fw-bold);
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 14px 4px 8px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-text);
    }
    h2::after {
      content: '';
      flex: 1;
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-2);
      opacity: 0.8;
    }
    .grid {
      display: grid;
      gap: var(--sw-gap-grid);
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    }
    .grid.list {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-gap);
    }
    /* the mini building tree (kept in every skin and density) */
    nav.tree {
      border-radius: var(--sw-r-lg);
      padding: 14px 10px;
      background: var(--sw-nav-glass);
      -webkit-backdrop-filter: var(--sw-glass-blur-nav);
      backdrop-filter: var(--sw-glass-blur-nav);
      box-shadow: inset 0 1px 0 var(--sw-highlight);
    }
    nav.tree h3 {
      margin: 4px 10px 10px;
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading);
    }
    .floor-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      padding-inline: 4px;
    }
    .floor-head .t {
      flex: 1;
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sub,
    .chev {
      inline-size: 44px;
      block-size: 44px;
      min-inline-size: 44px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }
    .sub:hover,
    .chev:hover {
      background: var(--sw-layer-2);
    }
    .chev sw-icon {
      transition: transform var(--sw-t-med) var(--sw-ease);
    }
    .floor[data-collapsed='true'] .chev sw-icon {
      transform: rotate(90deg);
    }
    .floor[data-collapsed='true'] .areas {
      display: none;
    }
    .areas {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-block-start: 4px;
    }
    .tree-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding-inline: 6px 12px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
      inline-size: 100%;
    }
    .tree-row:hover {
      background: var(--sw-layer);
    }
    .tree-row[aria-current='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .tree-row .dot {
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      background: var(--sw-hue-1);
      color: #fff;
      display: grid;
      place-items: center;
      flex: none;
    }
    .tree-row .n {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* sub-buttons inside pills: round, the sub size, 44 px in touch layouts */
    .sb {
      inline-size: var(--sw-sub-size, var(--sw-sub));
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
      border: 0;
      border-radius: 50%;
      background: var(--sw-surface-2);
      color: var(--sw-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }
    .sb:hover {
      background: var(--sw-surface-3);
    }
    .sb:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .chip {
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: var(--sw-touch-desktop);
      box-sizing: border-box;
      justify-content: center;
      padding: 0 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .btn {
      min-block-size: var(--sw-touch-desktop);
      padding: 0 18px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn.primary {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .btn.danger {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .btn:focus-visible,
    .chip:focus-visible,
    .tree-row:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 8px;
    }
    .status {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-end: 10px;
    }
    @media (max-width: 1100px) {
      .sb,
      .btn,
      .chip {
        min-block-size: 44px;
      }
      .sb,
      .chip {
        min-inline-size: 44px;
      }
    }
    /* the sheet's inside: pills are translucent layers over the sheet */
    sw-sheet sw-pill {
      --pill-base: var(--sw-layer);
    }
    .kv {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
    }
    .kv > div {
      border-radius: var(--sw-r-md);
      background: var(--sw-layer);
      padding: 12px 16px;
    }
    .kv .k {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .kv .v {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .big {
      --v: 0.5;
      position: relative;
      block-size: 64px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-layer);
      overflow: hidden;
      display: flex;
      align-items: center;
      padding-inline: 18px;
      font-weight: var(--sw-fw-bold);
    }
    .big::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: calc(var(--v) * 100%);
      background: var(--sw-lit);
      z-index: 0;
    }
    .big > * {
      position: relative;
    }
  `;o([c()],r.prototype,"devices",2);o([c()],r.prototype,"sheet",2);o([c()],r.prototype,"area",2);o([c()],r.prototype,"collapsed",2);r=o([m("bubble-demo")],r);export{r as BubbleDemo};
//# sourceMappingURL=bubble-demo-Bn2lzqRh.js.map
