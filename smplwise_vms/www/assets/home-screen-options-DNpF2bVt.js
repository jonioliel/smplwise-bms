import{a as w,b as r,dw as i,dx as g,dy as _,A as h,dz as y,dA as x,aj as m,dB as k,j as S,z as f,k as q,m as O}from"./index-kIGDECLR.js";import"./sw-logo-art-PLtEZJxU.js";var C=Object.defineProperty,E=Object.getOwnPropertyDescriptor,u=(e,s,n,a)=>{for(var o=a>1?void 0:a?E(s,n):s,d=e.length-1,l;d>=0;d--)(l=e[d])&&(o=(a?l(s,n,o):l(o))||o);return a&&o&&C(s,n,o),o};const b={summary_chooser:"summaryChooser",row_actions:"rowActions",tile_blinds:"tileBlinds",tile_climate:"tileClimate",phone_area:"phoneArea",desktop_area:"desktopArea",floor_off:"floorOff",many_floors:"manyFloors",building_off_tablet:"buildingOff",quick_card:"quickCard",phone_floors:"phoneFloors",popup_alert:"popupAlert",site_entry:"siteEntry",site_off_shared:"siteOffShared",tree_unassigned:"treeUnassigned",edit_drawer_space:"editDrawerSpace"},z={summary_chooser:"chooser_",row_actions:"row_",tile_blinds:"blinds_",tile_climate:"climate_",phone_area:"area_",desktop_area:"darea_",floor_off:"off_",many_floors:"floors_",building_off_tablet:"bo_",quick_card:"qc_",phone_floors:"pf_",popup_alert:"pa_",site_entry:"se_",site_off_shared:"sos_",tree_unassigned:"tu_",edit_drawer_space:"eds_"},A={lights:"qLights",climate:"qClimate",covers:"qCovers",switches:"qSwitches"},I={lights:"light",climate:"snow",covers:"layers",switches:"bolt"};let c=class extends w{constructor(){super(...arguments),this.areas=[],this.editable=!1,this.area="",this.buildings=[],this.picked=""}emit(e){this.dispatchEvent(new CustomEvent("hs-change",{detail:e,bubbles:!0,composed:!0}))}setScreen(e){this.emit({...this.value,screen:{...this.value.screen,...e}})}seg(e,s,n,a,o,d){return r`<sw-segmented label=${s} data-hs-option=${e} value=${a} ?disabled=${!this.editable} @change=${l=>l.detail.value!==a&&d(l.detail.value)}
      .options=${n.map(l=>({value:l,label:o(l),attrs:{"data-hs-value":l}}))}></sw-segmented>`}choice(e){const s=g[e],n=this.value.screen[e];return r`<div class="f"><span class="k">${i(b[e])}</span>${this.seg(e,i(b[e]),s,n,a=>i(`${z[e]}${a}`),a=>this.setScreen({[e]:a}))}</div>`}toggleTile(e){const s=this.value.screen.summary_tiles??[..._],n=s.includes(e)?s.filter(a=>a!==e):_.filter(a=>a===e||s.includes(a));this.setScreen({summary_tiles:n})}summary(){const e=this.value.screen.summary_tiles;return r`<div class="f wide"><span class="k">${i("summaryTiles")}</span>
      <div class="picks" data-hs-option="summary_tiles">
        <button type="button" class="pick" data-hs-tiles-all aria-pressed=${String(e===null)} ?disabled=${!this.editable} @click=${()=>this.setScreen({summary_tiles:null})}>${i("summaryAll")}</button>
        ${_.map(s=>r`<button type="button" class="pick" data-hs-tile=${s} aria-pressed=${String(e!==null&&e.includes(s))} ?disabled=${!this.editable} @click=${()=>this.toggleTile(s)}>${i(`k_${s}`)}</button>`)}
      </div></div>`}quickEditor(){const e=this.areas;if(!e.length)return h;const s=e.some(t=>t.id===this.picked)?this.picked:e.some(t=>t.id===this.area)?this.area:e[0].id,n=e.find(t=>t.id===s),a=this.value.screen.area_quick[s],o=a??y(n.counts),d=t=>(n.counts[t]??0)>0,l=t=>{const p=o.includes(t)?o.filter($=>$!==t):[...o,t];this.setScreen({area_quick:{...this.value.screen.area_quick,[s]:p}})},v=()=>{const{[s]:t,...p}=this.value.screen.area_quick;this.setScreen({area_quick:p})};return r`<div class="f wide" data-hs-area-quick>
      <span class="k">${i("areaQuick")}</span>
      <div class="row">
        <label class="row">${i("areaPick")}
          <select data-hs-area-select @change=${t=>this.picked=t.target.value}>
            ${e.map(t=>r`<option value=${t.id} ?selected=${t.id===s}>${t.floor?`${t.floor} · `:""}${t.name}</option>`)}
          </select>
        </label>
        ${a?r`<button type="button" class="lnk" data-hs-area-reset ?disabled=${!this.editable} @click=${v}>${i("areaReset")}</button>`:r`<span class="muted">${i("areaDefault")}</span>`}
      </div>
      <div class="picks" data-hs-area=${s}>
        ${x.filter(d).map(t=>{const p=o.indexOf(t);return r`<button type="button" class="pick" data-hs-quick=${t} aria-pressed=${String(p>=0)} ?disabled=${!this.editable} @click=${()=>l(t)}><sw-icon name=${I[t]} size=${14}></sw-icon>${i(A[t])}${p>=0?r`<span class="n">${p+1}</span>`:h}</button>`})}
      </div>
      <span class="muted">${m(n.name)}</span>
    </div>`}render(){const e=this.value;return e?r`<div class="grid" data-home-screen-options>
      <div class="f"><span class="k">${i("defaultView")}</span>${this.seg("default_view",i("defaultView"),["cards","tiles"],e.view,s=>i(s==="cards"?"viewCards":"viewTiles"),s=>this.emit({...e,view:s}))}</div>
      <div class="f"><span class="k">${i("infoRow")}</span>${this.seg("info_style",i("infoRow"),k,e.info,s=>i(`info_${s}`),s=>this.emit({...e,info:s}))}</div>
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
              ${this.buildings.map(s=>r`<option value=${s.id} ?selected=${e.site_entry_building===s.id}>${m(s.name)}</option>`)}
            </select></label>`:h}
      ${this.choice("site_off_shared")}`}};c.styles=S`
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
    /* CR-SEG-MODULE-LOOK-2470 (owner, 20.11): the choices are sw-segmented in its default, the module look, like every settings page
       (the panel's own 32 px key with the medium label went) */
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
  `;u([f({attribute:!1})],c.prototype,"value",2);u([f({attribute:!1})],c.prototype,"areas",2);u([f({type:Boolean})],c.prototype,"editable",2);u([f()],c.prototype,"area",2);u([f({attribute:!1})],c.prototype,"buildings",2);u([q()],c.prototype,"picked",2);c=u([O("home-screen-options")],c);export{c as HomeScreenOptionsForm};
