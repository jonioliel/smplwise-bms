import{i as u,gi as h,dw as s,b as n,gj as c,A as b,gk as w,gl as m,g,j as d,k as $}from"./index-BYRaM0w7.js";import"./sw-logo-art-PLtEZJxU.js";var f=Object.defineProperty,x=Object.getOwnPropertyDescriptor,l=(e,a,t,i)=>{for(var r=i>1?void 0:i?x(a,t):a,p=e.length-1,v;p>=0;p--)(v=e[p])&&(r=(i?v(a,t,r):v(r))||r);return i&&r&&f(a,t,r),r};const k=[{id:"l1",kind:"light",name:"תאורה מרכזית",icon:"light",on:!0,v:.72,hue:2},{id:"l2",kind:"light",name:"ספוטים קיר",icon:"light",on:!0,v:.4,hue:1},{id:"l3",kind:"light",name:"פס לד ספרייה ארוך מאוד בשם",icon:"light",on:!0,v:.25,hue:3},{id:"l4",kind:"light",name:"מנורת קריאה",icon:"light",on:!1,v:.6,hue:7},{id:"s1",kind:"switch",name:"דוד שמש",icon:"bolt",on:!0,hue:6},{id:"s2",kind:"switch",name:"השקיה",icon:"bolt",on:!1,hue:3},{id:"c1",kind:"cover",name:"תריס חלון גדול",icon:"coverOpen",on:!0,v:.6,hue:4},{id:"c2",kind:"cover",name:"תריס מרפסת",icon:"coverOpen",on:!1,v:0,hue:4},{id:"k1",kind:"climate",name:"מזגן סלון",icon:"snow",on:!0,hue:4,state:"קירור · 23°"},{id:"u1",kind:"light",name:"מנורת חוץ",icon:"light",on:!1,v:0,hue:8,unavailable:!0,state:"לא זמין"},{id:"n1",kind:"sensor",name:"טמפרטורה",icon:"thermometer",hue:5,state:"25.5°"},{id:"n2",kind:"sensor",name:"דלת מרפסת",icon:"sensor",hue:1,state:"סגורה"}],y=[{id:"g",name:"קומת קרקע",areas:["סלון","מטבח","פינת אוכל","חדר עבודה"]},{id:"f1",name:"קומה א׳",areas:["חדר שינה הורים","חדר ילדים","חדר רחצה"]},{id:"out",name:"חוץ",areas:["חצר","חניה"]}];let o=class extends u{constructor(){super(...arguments),this.devices=k.map(e=>({...e})),this.sheet="",this.area="סלון",this.collapsed=new Set(["out"]),this.look=new h(this)}set(e,a){this.devices=this.devices.map(t=>t.id===e?{...t,...a}:t)}pill(e){const a=Math.round((e.v??0)*100);return e.kind==="light"?n`<sw-pill variant="slider" .icon=${e.icon} .label=${e.name} .state=${e.state??(e.on?`${s("דולק")} · ${a}%`:s("כבוי"))} .value=${e.v??0} ?on=${!!e.on} .hue=${e.hue} ?unavailable=${!!e.unavailable} data-dev=${e.id}
        @toggle=${t=>this.set(e.id,{on:t.detail.on})} @input=${t=>this.set(e.id,{v:t.detail.value,on:t.detail.value>0})}
        @icon-click=${()=>this.sheet="light"}></sw-pill>`:e.kind==="switch"?n`<sw-pill variant="toggle" .icon=${e.icon} .label=${e.name} .state=${e.on?s("פועל"):s("כבוי")} ?on=${!!e.on} ?accent=${!!e.on} .hue=${e.hue} data-dev=${e.id} @toggle=${t=>this.set(e.id,{on:t.detail.on})}></sw-pill>`:e.kind==="cover"?n`<sw-pill variant="slider" .icon=${e.icon} .label=${e.name} .state=${a?`${s("פתוח")} · ${a}%`:s("סגור")} .value=${e.v??0} ?on=${(e.v??0)>0} fill-color="var(--sw-accent-soft)" .hue=${e.hue} data-dev=${e.id}
        @input=${t=>this.set(e.id,{v:t.detail.value})} @toggle=${()=>this.set(e.id,{v:(e.v??0)>0?0:1})}>
        <button slot="subs" class="sb" aria-label=${s("פתח")} @click=${()=>this.set(e.id,{v:1})}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
        <button slot="subs" class="sb" aria-label=${s("עצור")}><sw-icon name="pause" size=${18}></sw-icon></button>
        <button slot="subs" class="sb" aria-label=${s("סגור")} @click=${()=>this.set(e.id,{v:0})}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
      </sw-pill>`:e.kind==="climate"?n`<sw-pill variant="plain" .icon=${e.icon} .label=${e.name} .state=${e.state??""} ?on=${!!e.on} fill-color="var(--sw-cool)" .hue=${e.hue} data-dev=${e.id} @activate=${()=>this.sheet="light"}>
        <button slot="subs" class="sb" aria-label=${s("הנמך")}><sw-icon name="minus" size=${18}></sw-icon></button>
        <button slot="subs" class="chip" aria-label=${s("יעד 23 מעלות")}>23°</button>
        <button slot="subs" class="sb" aria-label=${s("הגבה")}><sw-icon name="plus" size=${18}></sw-icon></button>
      </sw-pill>`:n`<sw-pill variant="plain" .icon=${e.icon} .label=${e.name} .state=${e.state??""} .hue=${e.hue} data-dev=${e.id}></sw-pill>`}tree(){return n`<nav class="tree" aria-label=${s("קומות ואזורים")} data-demo-tree>
      <h3>${s("הבית")}</h3>
      ${y.map(e=>{const a=this.collapsed.has(e.id);return n`<div class="floor" data-collapsed=${String(a)}>
          <div class="floor-head">
            <button type="button" class="chev" aria-expanded=${String(!a)} aria-label=${a?s("הרחב {name}",{name:e.name}):s("כווץ {name}",{name:e.name})} @click=${()=>{const t=new Set(this.collapsed);t.has(e.id)?t.delete(e.id):t.add(e.id),this.collapsed=t}}><sw-icon name="chevronDown" size=${16}></sw-icon></button>
            <span class="t">${e.name}</span>
            <button type="button" class="sub" aria-label=${s("תפריט {name}",{name:e.name})}><sw-icon name="more" size=${16}></sw-icon></button>
          </div>
          <div class="areas">${e.areas.map(t=>n`<button type="button" class="tree-row" aria-current=${t===this.area?"true":"false"} tabindex=${a?-1:0} @click=${()=>{this.area=t,this.sheet==="inline"&&(this.sheet="")}}><span class="dot"><sw-icon name="home" size=${16}></sw-icon></span><span class="n">${t}</span></button>`)}</div>
        </div>`})}
    </nav>`}render(){const e=this.look.value,a=e.popup,t=this.devices.filter(i=>i.kind==="light");return n`<h1>${s("Bubble · רכיבי היסוד")}</h1>
      <div class="status" data-demo-status>${s("סקין")} ${w()} · ${m()} · ${c.density.labelHe[e.density]} · ${c.surface.labelHe[e.surface]} · ${c.popup.labelHe[a]} · ${c.radius.labelHe[e.radius]} · ${e.transparency}% · ${e.scale}% · ${e.touch}px</div>
      <div class="actions">
        <button type="button" class="btn primary" data-open-area @click=${()=>this.sheet="area"}><sw-icon name="home" size=${18}></sw-icon>${s("פתח אזור")}</button>
        <button type="button" class="btn" data-open-confirm @click=${()=>this.sheet="confirm"}>${s("אישור ממורכז")}</button>
        <button type="button" class="btn" data-open-inline @click=${()=>this.sheet="inline"}>${s("פתח בתוך הדף")}</button>
      </div>
      <div class="frame">
        ${this.tree()}
        <div>
          <sw-sheet kind="inline" heading=${`${this.area} · ${s("בתוך הדף")}`} ?open=${this.sheet==="inline"} data-sheet-inline @close=${()=>this.sheet=""}>
            <div class="grid">${t.slice(0,2).map(i=>this.pill(i))}</div>
            <button slot="footer" type="button" class="btn" @click=${()=>this.sheet=""}>${s("סגור")}</button>
          </sw-sheet>
          <h2>${s("תאורה")}</h2>
          <div class="grid" data-demo-grid>${this.devices.filter(i=>i.kind==="light"||i.kind==="switch").map(i=>this.pill(i))}</div>
          <h2>${s("אקלים ותריסים")}</h2>
          <div class="grid">${this.devices.filter(i=>i.kind==="cover"||i.kind==="climate").map(i=>this.pill(i))}</div>
          <h2>${s("רשימה")}</h2>
          <div class="grid list" data-demo-list>${this.devices.filter(i=>i.kind==="sensor"||i.kind==="switch").map(i=>n`${this.pill({...i,id:`r-${i.id}`})}`)}</div>
        </div>
      </div>

      <sw-sheet wide heading=${this.area} ?open=${this.sheet==="area"} data-sheet-area @close=${()=>this.sheet=""}>
        <sw-pill slot="head" variant="plain" icon="home" .label=${this.area} state="3 דולקים · 25.5°" .hue=${2}>
          <button slot="subs" class="chip" aria-label=${s("בהירות האזור")}>72%</button>
          <button slot="subs" class="sb" aria-label=${s("כבה הכול")}><sw-icon name="power" size=${18}></sw-icon></button>
        </sw-pill>
        <h2>${s("תאורה")}</h2>
        <div class="grid">${t.map(i=>this.pill(i))}</div>
        <h2>${s("תריסים")}</h2>
        <div class="grid">${this.devices.filter(i=>i.kind==="cover").map(i=>this.pill(i))}</div>
        <div class="kv"><div><span class="k">${s("טמפרטורה")}</span><div class="v">25.5°</div></div><div><span class="k">${s("לחות")}</span><div class="v">48%</div></div><div><span class="k">${s("תנועה")}</span><div class="v">לפני 2 דק׳</div></div></div>
      </sw-sheet>

      <sw-sheet kind="centred" narrow heading=${s("לכבות את כל התאורה?")} ?open=${this.sheet==="confirm"} data-sheet-confirm @close=${()=>this.sheet=""}>
        <div>${s("4 מנורות ייכבו ב{area}.",{area:this.area})}</div>
        <button slot="footer" type="button" class="btn" @click=${()=>this.sheet=""}>${s("ביטול")}</button>
        <button slot="footer" type="button" class="btn danger" data-confirm-off @click=${()=>{this.devices=this.devices.map(i=>i.kind==="light"?{...i,on:!1}:i),this.sheet=""}}>${s("כבה")}</button>
      </sw-sheet>

      <sw-sheet heading="תאורה מרכזית" ?open=${this.sheet==="light"} data-sheet-light @close=${()=>this.sheet=""}>
        <div class="big" role="slider" tabindex="0" aria-label=${s("בהירות")} aria-valuemin="0" aria-valuemax="100" aria-valuenow="72" style="--v:0.72"><span>${s("בהירות")}</span><span style="margin-inline-start:auto">72%</span></div>
        <div class="actions"><button type="button" class="chip" aria-pressed="true">${s("חם")}</button><button type="button" class="chip">${s("ניטרלי")}</button><button type="button" class="chip">${s("קר")}</button></div>
        ${b}
      </sw-sheet>`}};o.styles=g`
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
  `;l([d()],o.prototype,"devices",2);l([d()],o.prototype,"sheet",2);l([d()],o.prototype,"area",2);l([d()],o.prototype,"collapsed",2);o=l([$("bubble-demo")],o);export{o as BubbleDemo};
