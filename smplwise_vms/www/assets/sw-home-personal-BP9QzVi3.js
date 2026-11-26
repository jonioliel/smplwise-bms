import{q as y,gw as k,h5 as A,h6 as S,a as C,h7 as $,h8 as R,h9 as P,f4 as N,ha as M,hb as T,hc as B,hd as D,a2 as L,a3 as z,he as H,hf as I,hg as U,hh as W,fd as v,hi as j,b as p,A as m,dw as l,hj as d,dy as g,hk as Y,hl as x,hm as G,hn as F,ho as K,hp as q,hq as _,hr as J,hs as V,ht as Z,hu as b,ae as Q,hv as X,hw as ee,hx as E,hy as se,hz as te,hA as ae,af as f,hB as ie,p as oe,ag as O,hC as re,hD as le,hE as ne,hF as he,j as de,k as n,m as ce}from"./index-kIGDECLR.js";import{p as pe,M as ue}from"./personal-mode-fjrVUUIE.js";import"./area-row-editor-B8iGHuEQ.js";import"./sw-chip-choice-Cdn-Tg5C.js";import"./sw-logo-art-PLtEZJxU.js";const me=()=>({personal:S(null),row:{}});async function we(s=k){const{prefs:t}=await s();return{personal:S(t["home.personal"]),row:A(t["devices.area_row"])}}async function be(s,t){try{return t(await s()),""}catch(e){return y(e)}}var ve=Object.defineProperty,ge=Object.getOwnPropertyDescriptor,r=(s,t,e,a)=>{for(var i=a>1?void 0:a?ge(t,e):t,h=s.length-1,c;h>=0;h--)(c=s[h])&&(i=(a?c(t,e,i):c(i))||i);return a&&i&&ve(t,e,i),i};let o=class extends C{constructor(){super(...arguments),this.personal=$,this.base=null,this.busy=!1,this.row={},this.rowBase=null,this.failed="",this.elevators=[],this.tempUnits=0,this.generators=!1,this.doors=!1,this.notices=!1,this.presence=!1,this.xsection=!1,this.screenSite=R,this.buildings=[]}connectedCallback(){super.connectedCallback(),be(()=>Promise.all([f()?we():me(),ie(!0),oe().catch(()=>null)]),([s,t,e])=>{this.personal=s.personal,this.screenSite=te(e?.["home.screen"]),this.base={direction:t.direction,config:t.config},this.row=s.row,this.rowBase=ae(e)}).then(s=>this.failed=s),P().view&&N().then(s=>this.elevators=s.elevators).catch(()=>this.elevators=[]),M().view&&T(!1).then(s=>this.tempUnits=s.home_widget===!1?0:s.units.length).catch(()=>this.tempUnits=0),B().then(s=>this.generators=D(s)),Promise.all([L(),z()]).then(([s,t])=>{this.buildings=s?t.sites.flatMap(e=>(e.buildings??[]).map(a=>({id:a.id,name:a.name,shared:!!a.is_shared}))):[],this.xsection=(!f()||O("devices.read"))&&t.sites.some(e=>(e.buildings??[]).some(a=>(a.floors?.length??0)>0))}).catch(()=>this.buildings=[]),H().then(s=>this.doors=I(s,re())),f()&&O("presence.building.view")&&le().then(s=>this.presence=ne(s)).catch(()=>this.presence=!1),U().then(s=>this.notices=!!s&&W(s,he()))}setElevators(s){const t={...this.personal.widgets.elevators??{}};s.mode!==void 0&&(s.mode===null?delete t.mode:t.mode=s.mode),s.hidden!==void 0&&(s.hidden===null?delete t.hidden:t.hidden=s.hidden),this.setWidget("elevators",t)}elevatorChoices(){const s=this.base.config.elevators,t=this.personal.widgets.elevators??{},e=t.hidden??[];return p`<div class="row" data-home-personal-elevators-mode>
        <sw-segmented label=${v("displayMode")} value=${t.mode??""} ?disabled=${this.busy} @change=${a=>this.setElevators({mode:a.detail.value||null})}
          .options=${[{value:"",label:v("personalDefault"),attrs:{"data-home-personal-elevators-mode":""}},...j.map(a=>({value:a,label:v(ue[a]),attrs:{"data-home-personal-elevators-mode":a}}))]}></sw-segmented>
      </div>
      <div class="row" role="group" aria-label=${v("include")} data-home-personal-elevators-include>
        ${this.elevators.map(a=>{const i=s.hidden.includes(a.id);return p`<label class="check"><input type="checkbox" data-home-personal-elevator=${a.id} .checked=${!i&&!e.includes(a.id)} ?disabled=${this.busy||i}
          @change=${h=>{const c=pe(e,a.id,h.target.checked);this.setElevators({hidden:c.length?c:null})}} />${a.name}</label>`})}
      </div>`}setScreen(s){const t={...this.personal.screen??{},...s};for(const e of Object.keys(t))t[e]===void 0&&delete t[e];this.commit({...this.personal,screen:t})}screenChoices(){const s=this.personal.screen??{},t=this.screenSite,e=s.summary_tiles??null,a=i=>{const h=e??t.summary_tiles??[...g],c=h.includes(i)?h.filter(w=>w!==i):g.filter(w=>w===i||h.includes(w));this.setScreen({summary_tiles:c})};return p`<div class="row" data-home-personal-phone-area>
        <span class="lbl" id="hp-parea">${l("phoneArea")}</span>
        <sw-segmented label=${l("phoneArea")} value=${s.phone_area??""} ?disabled=${this.busy} @change=${i=>this.setScreen({phone_area:i.detail.value||void 0})}
          .options=${[{value:"",label:d("ברירת מחדל"),attrs:{"data-home-personal-phone-area":""}},...["sheet","full"].map(i=>({value:i,label:l(`area_${i}`),attrs:{"data-home-personal-phone-area":i}}))]}></sw-segmented>
      </div>
      ${t.summary_chooser==="user"?p`<div class="row" data-home-personal-tiles>
            <span class="lbl">${l("personalTiles")}</span>
            <sw-chip-choice multi class="tiles" label=${l("personalTiles")} ?disabled=${this.busy} .values=${e===null?[""]:e}
              .options=${[{value:"",label:l("personalFollow"),attrs:{"data-home-personal-tile":""}},...g.map(i=>({value:i,label:l(`k_${i}`),attrs:{"data-home-personal-tile":i}}))]}
              @change=${i=>{i.stopPropagation(),i.detail.value?a(i.detail.value):this.setScreen({summary_tiles:void 0})}}></sw-chip-choice>
          </div>`:m}
      ${this.siteChoices()}`}siteChoices(){if(this.buildings.length<2)return m;const s=this.personal.screen??{},t=this.buildings.some(e=>e.shared);return p`<div class="row" data-home-personal-site-entry>
        <span class="lbl" id="hp-sentry">${l("personalEntry")}</span>
        <sw-segmented label=${l("personalEntry")} value=${s.site_entry??""} ?disabled=${this.busy}
          @change=${e=>{const a=e.detail.value;this.setScreen(a?{site_entry:a,site_entry_building:a==="fixed"?s.site_entry_building??this.buildings[0].id:void 0}:{site_entry:void 0,site_entry_building:void 0})}}
          .options=${[{value:"",label:d("ברירת מחדל"),attrs:{"data-home-personal-site-entry":""}},...["site","last","fixed"].map(e=>({value:e,label:l(`se_${e}`),attrs:{"data-home-personal-site-entry":e}}))]}></sw-segmented>
        ${s.site_entry==="fixed"?p`<select data-home-personal-site-building aria-label=${l("siteEntryBuilding")} ?disabled=${this.busy} @change=${e=>this.setScreen({site_entry_building:e.target.value})}>
              ${this.buildings.map(e=>p`<option value=${e.id} ?selected=${s.site_entry_building===e.id}>${e.name}</option>`)}
            </select>`:m}
      </div>
      ${t?p`<div class="row" data-home-personal-hide-shared>
            <span class="lbl" id="hp-hshared">${l("hideShared")}</span>
            <sw-segmented label=${l("hideShared")} value=${s.hide_shared?"on":"off"} ?disabled=${this.busy} @change=${e=>this.setScreen({hide_shared:e.detail.value==="on"?!0:void 0})}
              .options=${[{value:"off",label:l("hideSharedOff"),attrs:{"data-home-personal-hide-shared":"off"}},{value:"on",label:l("hideSharedOn"),attrs:{"data-home-personal-hide-shared":"on"}}]}></sw-segmented>
          </div>`:m}`}get direction(){return this.personal.direction??this.base?.direction??"a"}get order(){return this.personal.order??this.base?.config.order??[]}async commit(s){const t=this.personal;this.personal=s,this.busy=!0,this.failed="";try{this.personal=await Y(s),window.dispatchEvent(new CustomEvent(x))}catch(e){this.personal=t,this.failed=y(e)}finally{this.busy=!1}}async commitRow(s){if(!this.rowBase)return;const t=this.row,e=s?G(s.area,s.floor,this.rowBase.areaRow,this.rowBase.floorRow):null;this.row=e??{},this.busy=!0,this.failed="";try{this.row=await F(e),window.dispatchEvent(new CustomEvent(x))}catch(a){this.row=t,this.failed=y(a)}finally{this.busy=!1}}setDirection(s){this.commit({...this.personal,direction:s})}setPhoneLayout(s){this.commit({...this.personal,phone_layout:s})}setOn(s,t){const e={...this.personal.widgets[s]??{}};t===this.base?.config[s].on?delete e.on:e.on=t,this.setWidget(s,e)}setSize(s,t){const e={...this.personal.widgets[s]??{}};t===null?delete e.size:e.size=t,this.setWidget(s,e)}setWidget(s,t){const e={...this.personal.widgets};Object.keys(t).length?e[s]=t:delete e[s],this.commit({...this.personal,widgets:e})}get offered(){return this.order.filter(s=>(s!=="elevators"||this.elevators.length>0)&&(s!=="temperature"||this.tempUnits>0)&&(s!=="generators"||this.generators)&&(s!=="doors"||this.doors)&&(s!=="notices"||this.notices)&&(s!=="presence"||this.presence)&&(s!=="xsection"||this.xsection))}move(s,t){const e=this.offered,a=e[Math.max(0,Math.min(e.length-1,t))],i=a===void 0||a===s?this.order:K(this.order,s,this.order.indexOf(a)),h=JSON.stringify(i)===JSON.stringify(this.base?.config.order);this.commit({...this.personal,order:h?null:i})}errorNote(){return this.failed?p`<p class="err" role="alert" data-home-personal-error>${this.failed}</p>`:m}render(){if(!this.base)return this.errorNote();const s=this.direction,t=this.offered;return p`
      <div class="row" data-home-personal-direction>
        <span class="lbl" id="hp-dir">${d("כיוון")}</span>
        <sw-segmented label=${d("כיוון")} value=${this.personal.direction??""} ?disabled=${this.busy} @change=${e=>this.setDirection(e.detail.value||null)}
          .options=${[{value:"",label:d("ברירת מחדל"),attrs:{"data-home-personal-dir":""}},...q.map(e=>({value:e,label:`${J[e]} · ${_[e]}`,title:_[e],attrs:{"data-home-personal-dir":e}}))]}></sw-segmented>
      </div>
      ${this.screenChoices()}
      <div class="row" data-home-personal-phone>
        <span class="lbl" id="hp-phone">${d("בנייד")}</span>
        <sw-segmented label=${d("בנייד")} value=${this.personal.phone_layout??""} ?disabled=${this.busy} @change=${e=>this.setPhoneLayout(e.detail.value||null)}
          .options=${[{value:"",label:d("ברירת מחדל"),attrs:{"data-home-personal-phone-layout":""}},...V.map(e=>({value:e,label:Z[e],attrs:{"data-home-personal-phone-layout":e}}))]}></sw-segmented>
      </div>
      ${t.map((e,a)=>{const i=this.base.config[e],h=this.personal.widgets[e]??{},c=h.on??i.on,w=h.size??null;return p`<div class="w" data-home-personal-widget=${e}>
          <div class="row">
            <label class="check"><sw-toggle size="sm" labelHidden in-label label=${b[e]} data-home-personal-on=${e} .checked=${c} ?disabled=${this.busy} @change=${u=>this.setOn(e,Q(u))}></sw-toggle><span class="lbl">${b[e]}</span></label>
            <span class="grow"></span>
            <button type="button" class="ib" data-home-personal-earlier=${e} aria-label=${d("הקדם את {name}",{name:b[e]})} ?disabled=${this.busy||a===0} @click=${()=>this.move(e,a-1)}>↑</button>
            <button type="button" class="ib" data-home-personal-later=${e} aria-label=${d("אחר את {name}",{name:b[e]})} ?disabled=${this.busy||a===t.length-1} @click=${()=>this.move(e,a+1)}>↓</button>
          </div>
          <div class="row">
            <sw-segmented label=${d("גודל: {name}",{name:b[e]})} value=${w??""} ?disabled=${this.busy||!c} @change=${u=>this.setSize(e,u.detail.value||null)}
              .options=${[{value:"",label:d("ברירת מחדל"),attrs:{"data-home-personal-size":`${e}:`}},...X.map(u=>({value:u,label:ee[u],attrs:{"data-home-personal-size":`${e}:${u}`}}))]}></sw-segmented>
          </div>
          ${e==="elevators"&&c?this.elevatorChoices():m}
        </div>`})}
      ${this.rowBase?p`<div class="w" data-home-personal-area-row>
            <div class="row"><span class="lbl">${d("ליד שם האזור")}</span></div>
            <area-row-editor .area=${E(this.rowBase.areaRow,this.rowBase.floorRow,this.row).area} .floor=${E(this.rowBase.areaRow,this.rowBase.floorRow,this.row).floor} ?disabled=${this.busy} @area-row-change=${e=>void this.commitRow(e.detail)}></area-row-editor>
          </div>`:m}
      <button type="button" class="reset" data-home-personal-reset ?disabled=${this.busy||se(this.personal)&&!Object.keys(this.row).length} @click=${async()=>{await this.commit({...$,widgets:{}}),Object.keys(this.row).length&&await this.commitRow(null)}}>${d("ברירת מחדל של המערכת")}</button>
      ${this.errorNote()}
      <span hidden data-home-personal-direction-now=${s}></span>
    `}};o.styles=de`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px 12px;
      flex-wrap: wrap;
      min-block-size: 40px;
    }
    .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      min-inline-size: 84px;
    }
    select {
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      min-block-size: 32px;
      padding: 0 8px;
    }
    /* CR-CMP2-TABS-2460: the summary tiles (a multi-choice - each tile on or off, "follow the installation" beside them) are
       sw-chip-choice multi, at this panel's compact size: the 28 px chip, the small label, the 0.45 disabled dimming */
    sw-chip-choice.tiles {
      --sw-chipc-h: 28px;
      --sw-chipc-pad: 10px;
      --sw-chipc-fs: var(--sw-fs-xs);
      --sw-chipc-gap: 4px;
      --sw-disabled-opacity: 0.45;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the one-of-N choices are sw-segmented, in this panel's compact pill (2 px track, 1 px apart, the 28 px
       key with the small label, the plain chosen key of segThumbPlainStyles and the panel's 0.45 disabled dimming) */
    sw-segmented {
      --sw-seg-pad: 2px;
      --sw-seg-gap: 1px;
      --sw-seg-radius: 999px;
      --sw-seg-btn-radius: 999px;
      --sw-seg-h: 28px;
      --sw-seg-key-pad: 10px;
      --sw-seg-fs: var(--sw-fs-xs);
      --sw-seg-fw: 400;
      --sw-seg-on-fw: var(--sw-fw-semibold);
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-text));
      --sw-disabled-opacity: 0.45;
      /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
      --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface));
    }
    .w {
      border-block-start: 1px solid var(--sw-border);
      padding-block: 6px;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    /* HAND-SWITCH-HOME-PERSONAL-2500: the widget's on / off switch keeps its 32 x 18 track beside the name */
    .check sw-toggle {
      flex: none;
    }
    .grow {
      flex: 1;
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
    button:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .err {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .reset {
      margin-block-start: 6px;
      border: 0;
      background: none;
      padding: 4px 0;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-accent-text);
      cursor: pointer;
    }
    .reset:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;r([n()],o.prototype,"personal",2);r([n()],o.prototype,"base",2);r([n()],o.prototype,"busy",2);r([n()],o.prototype,"row",2);r([n()],o.prototype,"rowBase",2);r([n()],o.prototype,"failed",2);r([n()],o.prototype,"elevators",2);r([n()],o.prototype,"tempUnits",2);r([n()],o.prototype,"generators",2);r([n()],o.prototype,"doors",2);r([n()],o.prototype,"notices",2);r([n()],o.prototype,"presence",2);r([n()],o.prototype,"xsection",2);r([n()],o.prototype,"screenSite",2);r([n()],o.prototype,"buildings",2);o=r([ce("sw-home-personal")],o);export{o as SwHomePersonal};
