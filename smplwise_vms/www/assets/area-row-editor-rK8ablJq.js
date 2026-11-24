import{g,v as f,j as w,i as v,a7 as _,c9 as x,A as c,ca as s,cb as y,cc as u,cd as m,b as l,a6 as h,ce as E,cf as b,cg as A,ch as k,ci as L,cj as O,ck as z,cl as p,k as M}from"./index-c_ii2C2N.js";var I=Object.defineProperty,T=Object.getOwnPropertyDescriptor,d=(a,e,t,i)=>{for(var r=i>1?void 0:i?T(e,t):e,o=a.length-1,$;o>=0;o--)($=a[o])&&(r=(i?$(e,t,r):$(r))||r);return i&&r&&I(e,t,r),r};let n=class extends v{constructor(){super(...arguments),this.disabled=!1,this.multi=null}emit(a,e){this.dispatchEvent(new CustomEvent("area-row-change",{detail:{area:a,floor:e},bubbles:!0,composed:!0}))}order(a,e){return[...a,...e.filter(t=>!a.includes(t))]}updated(){this.area?.climate_mode==="lead"&&this.multi===null&&_()&&(this.multi=[],x().then(a=>{this.multi=a.floors.flatMap(e=>e.areas).filter(e=>(e.climate?.length??0)>1).map(e=>({area_id:e.area_id,name:e.name,climate:e.climate??[]}))}).catch(()=>{}))}setLead(a,e){const t={...this.area.climate_lead};e?t[a]=e:delete t[a],this.emit({...this.area,climate_lead:t},this.floor)}toggleOnly(a,e){const t=e?[...this.area.only_active,a]:this.area.only_active.filter(i=>i!==a);this.emit({...this.area,only_active:t},this.floor)}toggleArea(a,e){const t=e?[...this.area.items,a]:this.area.items.filter(i=>i!==a);this.emit({...this.area,items:t},this.floor)}toggleFloor(a,e){const t=e?[...this.floor.items,a]:this.floor.items.filter(i=>i!==a);this.emit(this.area,{items:t})}render(){if(!this.area||!this.floor)return c;const a=this.disabled;return l`
      <div class="hd" id="are-area">${s("מה מוצג ליד שם האזור")}</div>
      <ul aria-labelledby="are-area" data-area-row-items>
        ${this.order(this.area.items,y).map(e=>{const t=this.area.items.includes(e),i=this.area.items.indexOf(e),r=t&&i===u&&this.area.items.length>u;return l`${r?l`<li class="cut" data-phone-cut role="presentation">${s("בטלפון: רק הפריטים שמעל הקו")}</li>`:c}<li class=${t?"":"off"} data-area-item=${e}>
            <label><sw-toggle size="sm" labelHidden in-label label=${m[e]} data-area-item-on=${e} .checked=${t} ?disabled=${a} @change=${o=>this.toggleArea(e,h(o))}></sw-toggle>${m[e]}</label>
            ${t&&E.includes(e)?l`<label class="only"><sw-toggle size="sm" labelHidden in-label label=${e==="openings"||e==="locks"?s("רק כשפתוח"):s("רק כשפעיל")} data-area-item-only=${e} .checked=${this.area.only_active.includes(e)} ?disabled=${a} @change=${o=>this.toggleOnly(e,h(o))}></sw-toggle>${e==="openings"||e==="locks"?s("רק כשפתוח"):s("רק כשפעיל")}</label>`:c}
            ${t?l`<button type="button" class="ib" data-area-item-earlier=${e} aria-label=${s("הקדם: {name}",{name:m[e]})} ?disabled=${a||i===0} @click=${()=>this.emit({...this.area,items:b(this.area.items,e,-1)},this.floor)}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
                <button type="button" class="ib" data-area-item-later=${e} aria-label=${s("אחר: {name}",{name:m[e]})} ?disabled=${a||i===this.area.items.length-1} @click=${()=>this.emit({...this.area,items:b(this.area.items,e,1)},this.floor)}><sw-icon name="arrowDown" size=${14}></sw-icon></button>`:c}
          </li>`})}
      </ul>
      <div class="row">
        <label for="are-climate">${s("המזגן מציג")}</label>
        <select id="are-climate" data-area-climate ?disabled=${a} @change=${e=>this.emit({...this.area,climate:e.target.value},this.floor)}>
          ${A.map(e=>l`<option value=${e} ?selected=${this.area.climate===e}>${k[e]}</option>`)}
        </select>
      </div>
      <div class="row">
        <label for="are-cmode">${s("כמה מזגנים באזור")}</label>
        <select id="are-cmode" data-area-climate-mode ?disabled=${a} @change=${e=>this.emit({...this.area,climate_mode:e.target.value},this.floor)}>
          ${L.map(e=>l`<option value=${e} ?selected=${this.area.climate_mode===e}>${O[e]}</option>`)}
        </select>
      </div>
      ${this.area.climate_mode==="lead"&&this.multi?.length?l`<ul aria-label=${s("המזגן המוביל")} data-climate-leads>
            ${this.multi.map(e=>l`<li data-climate-lead-area=${e.area_id}>
              <label for=${`lead-${e.area_id}`} style="flex:1">${e.name}</label>
              <select id=${`lead-${e.area_id}`} data-climate-lead=${e.area_id} ?disabled=${a} @change=${t=>this.setLead(e.area_id,t.target.value)}>
                <option value="" ?selected=${!this.area.climate_lead[e.area_id]}>${s("הפועל הראשון")}</option>
                ${e.climate.map(t=>l`<option value=${t.entity_id} ?selected=${this.area.climate_lead[e.area_id]===t.entity_id}>${t.name}</option>`)}
              </select>
            </li>`)}
          </ul>`:c}
      <div class="row">
        <label><sw-toggle size="sm" labelHidden in-label label=${s("הצג גם מונים שערכם אפס")} data-area-show-empty .checked=${this.area.show_empty} ?disabled=${a} @change=${e=>this.emit({...this.area,show_empty:h(e)},this.floor)}></sw-toggle> ${s("הצג גם מונים שערכם אפס")}</label>
      </div>
      <div class="hd" id="are-floor">${s("בכותרת הקומה")}</div>
      <ul aria-labelledby="are-floor" data-floor-row-items>
        ${this.order(this.floor.items,z).map(e=>{const t=this.floor.items.includes(e),i=this.floor.items.indexOf(e);return l`<li class=${t?"":"off"} data-floor-item=${e}>
            <label><sw-toggle size="sm" labelHidden in-label label=${p[e]} data-floor-item-on=${e} .checked=${t} ?disabled=${a} @change=${r=>this.toggleFloor(e,h(r))}></sw-toggle>${p[e]}</label>
            ${t?l`<button type="button" class="ib" data-floor-item-earlier=${e} aria-label=${s("הקדם: {name}",{name:p[e]})} ?disabled=${a||i===0} @click=${()=>this.emit(this.area,{items:b(this.floor.items,e,-1)})}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
                <button type="button" class="ib" data-floor-item-later=${e} aria-label=${s("אחר: {name}",{name:p[e]})} ?disabled=${a||i===this.floor.items.length-1} @click=${()=>this.emit(this.area,{items:b(this.floor.items,e,1)})}><sw-icon name="arrowDown" size=${14}></sw-icon></button>`:c}
          </li>`})}
      </ul>
    `}};n.styles=g`
    :host {
      display: block;
    }
    .hd {
      font-weight: var(--sw-fw-semibold);
      margin-block: 10px 4px;
    }
    .hd:first-child {
      margin-block-start: 0;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 2px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 34px;
      padding-inline: 4px;
      border-radius: var(--sw-r-sm);
    }
    li:hover {
      background: var(--sw-surface-2);
    }
    li label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      cursor: pointer;
    }
    li.off {
      color: var(--sw-text-3);
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px 12px;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    select {
      font: inherit;
      min-block-size: 34px;
      padding-inline: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .cut {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-block: 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .cut::before,
    .cut::after {
      content: '';
      flex: 1;
      border-block-start: 1px dashed var(--sw-border-strong);
    }
    .only {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
  `;d([f({attribute:!1})],n.prototype,"area",2);d([f({attribute:!1})],n.prototype,"floor",2);d([f({type:Boolean})],n.prototype,"disabled",2);d([w()],n.prototype,"multi",2);n=d([M("area-row-editor")],n);
