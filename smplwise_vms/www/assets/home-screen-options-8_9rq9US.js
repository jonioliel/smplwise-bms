import{i as g,b as r,d1 as i,d2 as w,d3 as _,A as h,d4 as $,d5 as x,a6 as b,d6 as y,g as k,ax as f,j as S,k as q}from"./index-DkcUEx2W.js";import"./sw-logo-art-PLtEZJxU.js";var O=Object.defineProperty,C=Object.getOwnPropertyDescriptor,p=(e,s,o,a)=>{for(var n=a>1?void 0:a?C(s,o):s,l=e.length-1,u;l>=0;l--)(u=e[l])&&(n=(a?u(s,o,n):u(n))||n);return a&&n&&O(s,o,n),n};const E={summary_chooser:"summaryChooser",row_actions:"rowActions",tile_blinds:"tileBlinds",tile_climate:"tileClimate",phone_area:"phoneArea",desktop_area:"desktopArea",floor_off:"floorOff",many_floors:"manyFloors",building_off_tablet:"buildingOff",quick_card:"quickCard",phone_floors:"phoneFloors",popup_alert:"popupAlert",site_entry:"siteEntry",site_off_shared:"siteOffShared",tree_unassigned:"treeUnassigned",edit_drawer_space:"editDrawerSpace"},z={summary_chooser:"chooser_",row_actions:"row_",tile_blinds:"blinds_",tile_climate:"climate_",phone_area:"area_",desktop_area:"darea_",floor_off:"off_",many_floors:"floors_",building_off_tablet:"bo_",quick_card:"qc_",phone_floors:"pf_",popup_alert:"pa_",site_entry:"se_",site_off_shared:"sos_",tree_unassigned:"tu_",edit_drawer_space:"eds_"},A={lights:"qLights",climate:"qClimate",covers:"qCovers",switches:"qSwitches"},I={lights:"light",climate:"snow",covers:"layers",switches:"bolt"};let c=class extends g{constructor(){super(...arguments),this.areas=[],this.editable=!1,this.area="",this.buildings=[],this.picked=""}emit(e){this.dispatchEvent(new CustomEvent("hs-change",{detail:e,bubbles:!0,composed:!0}))}setScreen(e){this.emit({...this.value,screen:{...this.value.screen,...e}})}seg(e,s,o,a,n){return r`<span class="seg" role="group" data-hs-option=${e}>${s.map(l=>r`<button type="button" data-hs-value=${l} aria-pressed=${String(l===o)} ?disabled=${!this.editable} @click=${()=>l!==o&&n(l)}>${a(l)}</button>`)}</span>`}choice(e){const s=w[e],o=this.value.screen[e];return r`<div class="f"><span class="k">${i(E[e])}</span>${this.seg(e,s,o,a=>i(`${z[e]}${a}`),a=>this.setScreen({[e]:a}))}</div>`}toggleTile(e){const s=this.value.screen.summary_tiles??[..._],o=s.includes(e)?s.filter(a=>a!==e):_.filter(a=>a===e||s.includes(a));this.setScreen({summary_tiles:o})}summary(){const e=this.value.screen.summary_tiles;return r`<div class="f wide"><span class="k">${i("summaryTiles")}</span>
      <div class="picks" data-hs-option="summary_tiles">
        <button type="button" class="pick" data-hs-tiles-all aria-pressed=${String(e===null)} ?disabled=${!this.editable} @click=${()=>this.setScreen({summary_tiles:null})}>${i("summaryAll")}</button>
        ${_.map(s=>r`<button type="button" class="pick" data-hs-tile=${s} aria-pressed=${String(e!==null&&e.includes(s))} ?disabled=${!this.editable} @click=${()=>this.toggleTile(s)}>${i(`k_${s}`)}</button>`)}
      </div></div>`}quickEditor(){const e=this.areas;if(!e.length)return h;const s=e.some(t=>t.id===this.picked)?this.picked:e.some(t=>t.id===this.area)?this.area:e[0].id,o=e.find(t=>t.id===s),a=this.value.screen.area_quick[s],n=a??$(o.counts),l=t=>(o.counts[t]??0)>0,u=t=>{const d=n.includes(t)?n.filter(v=>v!==t):[...n,t];this.setScreen({area_quick:{...this.value.screen.area_quick,[s]:d}})},m=()=>{const{[s]:t,...d}=this.value.screen.area_quick;this.setScreen({area_quick:d})};return r`<div class="f wide" data-hs-area-quick>
      <span class="k">${i("areaQuick")}</span>
      <div class="row">
        <label class="row">${i("areaPick")}
          <select data-hs-area-select @change=${t=>this.picked=t.target.value}>
            ${e.map(t=>r`<option value=${t.id} ?selected=${t.id===s}>${t.floor?`${t.floor} · `:""}${t.name}</option>`)}
          </select>
        </label>
        ${a?r`<button type="button" class="lnk" data-hs-area-reset ?disabled=${!this.editable} @click=${m}>${i("areaReset")}</button>`:r`<span class="muted">${i("areaDefault")}</span>`}
      </div>
      <div class="picks" data-hs-area=${s}>
        ${x.filter(l).map(t=>{const d=n.indexOf(t);return r`<button type="button" class="pick" data-hs-quick=${t} aria-pressed=${String(d>=0)} ?disabled=${!this.editable} @click=${()=>u(t)}><sw-icon name=${I[t]} size=${14}></sw-icon>${i(A[t])}${d>=0?r`<span class="n">${d+1}</span>`:h}</button>`})}
      </div>
      <span class="muted">${b(o.name)}</span>
    </div>`}render(){const e=this.value;return e?r`<div class="grid" data-home-screen-options>
      <div class="f"><span class="k">${i("defaultView")}</span>${this.seg("default_view",["cards","tiles"],e.view,s=>i(s==="cards"?"viewCards":"viewTiles"),s=>this.emit({...e,view:s}))}</div>
      <div class="f"><span class="k">${i("infoRow")}</span>${this.seg("info_style",y,e.info,s=>i(`info_${s}`),s=>this.emit({...e,info:s}))}</div>
      ${this.summary()}
      ${this.choice("summary_chooser")}
      ${this.quickEditor()}
      ${this.choice("row_actions")}
      ${this.choice("tile_blinds")}
      ${this.choice("tile_climate")}
      ${this.choice("floor_off")}
      ${this.choice("many_floors")}
      ${this.treeUnassigned()}
      <div class="f" data-hs-edit-drawer-space>${this.choice("edit_drawer_space")}<span class="muted">${i("edsNote")}</span></div>
      ${this.choice("building_off_tablet")}
      ${this.choice("quick_card")}
      ${this.choice("phone_floors")}
      ${this.choice("phone_area")}
      ${this.choice("desktop_area")}
      ${this.siteOptions()}
    </div>`:h}treeUnassigned(){return r`<div class="f" data-hs-tree-unassigned>${this.choice("tree_unassigned")}
      <span class="muted">${i("tuNote")} <a class="lnk" href="#/devices/areas/unassigned" data-hs-tree-unassigned-open>${i("tuOpen")}</a></span></div>`}siteOptions(){if(this.buildings.length<2)return h;const e=this.value.screen;return r`${this.choice("site_entry")}
      ${e.site_entry==="fixed"?r`<label class="f"><span class="k">${i("siteEntryBuilding")}</span>
            <select data-hs-site-building ?disabled=${!this.editable} @change=${s=>this.setScreen({site_entry_building:s.target.value})}>
              <option value="" ?selected=${!e.site_entry_building}>${i("se_site")}</option>
              ${this.buildings.map(s=>r`<option value=${s.id} ?selected=${e.site_entry_building===s.id}>${b(s.name)}</option>`)}
            </select></label>`:h}
      ${this.choice("site_off_shared")}`}};c.styles=k`
    :host {
      display: block;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px 18px;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .k {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      min-block-size: 36px;
      padding: 0 10px;
      max-inline-size: 100%;
    }
    .seg {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
      inline-size: fit-content;
      max-inline-size: 100%;
    }
    .seg button,
    .pick {
      all: unset;
      box-sizing: border-box;
      min-block-size: 32px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-on-bg, var(--sw-seg-key, var(--sw-surface)));
      color: var(--sw-seg-on-text, var(--sw-seg-key-ink, var(--sw-accent-text)));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      font-weight: var(--sw-fw-semibold);
    }
    .picks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pick {
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      min-block-size: 30px;
    }
    .pick[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: transparent;
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-semibold);
    }
    .pick .n {
      font-variant-numeric: tabular-nums;
      opacity: 0.8;
    }
    button:disabled {
      cursor: default;
      opacity: 0.6;
    }
    button:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 2px;
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 6px 8px;
      max-inline-size: 100%;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .lnk {
      all: unset;
      cursor: pointer;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
  `;p([f({attribute:!1})],c.prototype,"value",2);p([f({attribute:!1})],c.prototype,"areas",2);p([f({type:Boolean})],c.prototype,"editable",2);p([f()],c.prototype,"area",2);p([f({attribute:!1})],c.prototype,"buildings",2);p([S()],c.prototype,"picked",2);c=p([q("home-screen-options")],c);export{c as HomeScreenOptionsForm};
