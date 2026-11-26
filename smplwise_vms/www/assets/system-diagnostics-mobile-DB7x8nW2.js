import{j as z,z as _,k as h,a as C,mZ as Z,m_ as j,kX as r,q as x,m$ as Y,n0 as X,n1 as Q,n2 as V,n3 as ee,A as p,b as a,n4 as se,n5 as te,n6 as F,n7 as B,n8 as D,n9 as ie,u as ae,na as M,nb as ne,m as E,nc as S,b4 as re,aW as J,dv as R,aX as T,a3 as le,af as L,nd as q,hH as l,ne as oe,dL as c,nf as A,ng as de,nh as v,an as I,ni as ce,aM as pe,nj as he,nk as U,nl as W,nm as ue,d7 as me,aU as G,nn as k,no as ge,np as be}from"./index-C0HbI5eb.js";import"./sw-table-CyivE6N7.js";import"./sw-pager-iJYiUPfx.js";import{L as fe,p as we}from"./long-lists-DqYF-X_z.js";import{b as H}from"./bubble-chrome-D8pHRZeV.js";import{e as $e}from"./settings-CkyaGfVS.js";import{l as ve}from"./zones-B0mm6fMF.js";import"./sw-logo-art-PLtEZJxU.js";var ye=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,g=(e,t,s,i)=>{for(var o=i>1?void 0:i?xe(t,s):t,n=e.length-1,d;n>=0;n--)(d=e[n])&&(o=(i?d(t,s,o):d(o))||o);return i&&o&&ye(t,s,o),o};const P={enabled:!1,hold_seconds:60,empty_minutes:10,retention_days:30,home_display:"chip",map_tint:!0,area_line:!1};let m=class extends C{constructor(){super(...arguments),this.editable=!1,this.list=null,this.rooms=[],this.cfg=P,this.hist=null,this.busy=!1,this.message="",this.error="",this.confirmPurge=!1,this.filter="all",this.page=1,this.lists=new fe(this,()=>this.page=1),this.editId="",this.narrow=!1,this.loadFailed="",this.mq=window.matchMedia("(max-width: 700px)"),this.onMq=()=>{this.narrow=this.mq.matches,this.page=1}}connectedCallback(){super.connectedCallback(),this.narrow=this.mq.matches,this.mq.addEventListener("change",this.onMq),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}async load(){this.loadFailed="";try{const e=await Z();this.list=e.sensors,this.rooms=e.rooms??[],this.cfg={...P,...e.settings},this.cfg.enabled&&(this.hist=await j())}catch(e){e instanceof Error&&/403|אין הרשאה/.test(e.message)?this.list=[]:(this.list=null,this.loadFailed=x(e)||r.loadFailed)}}retry(){this.loadFailed="",this.load()}async run(e,t=r.saved){if(!this.busy){this.busy=!0,this.error="";try{await e(),this.message=t,setTimeout(()=>this.message="",2500)}catch(s){this.error=x(s)}finally{this.busy=!1}}}patch(e){return this.run(async()=>{this.cfg={...P,...(await Y(e)).settings},this.hist=this.cfg.enabled?await j():null})}toggleTag(e,t){if(!this.list)return;const s=X(this.list,e,t);return this.run(async()=>{const i=await Q(s);this.list=i.sensors,this.rooms=i.rooms??this.rooms})}setRoom(e,t){return this.run(async()=>{const s=await V(e,t||null);this.list=s.sensors})}purge(){return this.confirmPurge=!1,this.run(async()=>{this.hist=await ee()},r.purged)}num(e,t){const s=t.target.valueAsNumber;this.cfg={...this.cfg,[e]:Number.isFinite(s)?s:NaN}}renderMaster(){return a`<sw-card heading=${r.masterLabel} data-building-presence-master>
      <div class="row">
        <sw-toggle label=${r.masterLabel} labelHidden data-building-enabled .checked=${this.cfg.enabled} ?disabled=${!this.editable||this.busy}
          @change=${e=>void this.patch({enabled:e.detail.checked})}></sw-toggle>
        ${this.cfg.enabled?p:a`<b data-building-off-note>${r.masterOffNote}</b>`}
        <span class="muted">${r.masterHint}</span>
        ${this.message?a`<span class="ok" role="status">${this.message}</span>`:p}
        ${this.error?a`<span class="err" role="alert">${this.error}</span>`:p}
      </div>
    </sw-card>`}renderSensors(e){const t=e.filter(n=>n.tagged).length,s=se(e,this.filter),i=we(this.lists.paged,this.narrow?5:6,s.length),o=te(s,this.page,i);return a`<sw-card heading=${r.heading} subheading=${t?`${t} ${r.tagged} · ${e.length} ${r.found}`:r.subheading} data-building-presence-card>
      <div class="bar"><sw-segmented label=${r.filterLabel} value=${this.filter} @change=${n=>{this.filter=n.detail.value,this.page=1}}
        .options=${[["all",r.filterAll],["tagged",r.filterTagged],["untagged",r.filterUntagged]].map(([n,d])=>({value:n,label:d,attrs:{"data-building-filter":n}}))}></sw-segmented></div>
      ${e.length?p:a`<div class="muted">${r.noSensors}</div>`}
      <div class="tbl" data-building-table>${o.items.map(n=>this.renderRow(n))}</div>
      <div class="foot"><span class="muted">${r.tagNote}</span>${o.pages>1?a`<sw-pager .page=${o.page} .pages=${o.pages} @page-change=${n=>this.page=n.detail.page}></sw-pager>`:p}</div>
      ${this.renderEditor(e)}
    </sw-card>`}stateChip(e){const t=e.state==="on"?"on":e.state==="off"?"off":"na";return a`<span class="st" data-st=${t} data-building-state>${r.stateWord(e.state)}</span>`}roomSelect(e,t){return a`<sw-field><select data-building-room=${t} aria-label=${r.roomPick} ?disabled=${this.busy||!this.editable} @change=${s=>void this.setRoom(e.entity_id,s.target.value)}>
      <option value="" ?selected=${!e.placed}>${r.ownRoom}</option>
      ${this.rooms.map(s=>a`<option value=${s.area_id} ?selected=${!!e.placed&&e.area_id===s.area_id}>${s.name}</option>`)}</select></sw-field>`}renderRow(e){const t=this.editable&&e.tagged;return a`<div class="sensor" data-building-sensor=${e.entity_id} data-tagged=${String(e.tagged)}>
      <label class="ck"><input type="checkbox" aria-label=${e.name} .checked=${e.tagged} ?disabled=${!this.editable||this.busy} @change=${s=>void this.toggleTag(e.entity_id,s.target.checked)} /></label>
      <span class="nm"><b title=${e.name} dir="auto">${e.name}</b><span class="muted">${r.kindWord(e.device_class)}</span></span>
      <span class="rm">${t?this.roomSelect(e,"row"):a`<span class="muted">${e.area_name??r.noRoom}</span>`}</span>
      ${this.stateChip(e)}
      <button type="button" class="more" data-building-more aria-label=${`${r.editTitle}: ${e.name}`} ?disabled=${!t} @click=${()=>this.editId=e.entity_id}><sw-icon name="more" size="18"></sw-icon></button>
    </div>`}renderEditor(e){const t=e.find(s=>s.entity_id===this.editId);return t?a`<sw-drawer modal .open=${!0} heading=${t.name} subheading=${t.area_name??r.noRoom} data-building-editor @close=${()=>this.editId=""}>
      <div class="field">${r.stateNow}<div>${this.stateChip(t)}</div></div>
      <label class="field">${r.roomPick}${this.roomSelect(t,"editor")}</label>
      <div class="priv">${r.tagNote}</div>
      <div slot="footer" class="row">
        <sw-button variant="danger" data-building-untag ?disabled=${this.busy||!this.editable} @click=${()=>{const s=t.entity_id;this.editId="",this.toggleTag(s,!1)}}>${r.removeTag}</sw-button>
        <sw-button @click=${()=>this.editId=""}>${r.close}</sw-button>
      </div>
    </sw-drawer>`:p}renderTimes(){const e=F(this.cfg);return a`<sw-card heading=${r.timesHeading} data-building-presence-settings>
      <div class="row">
        <label>${r.holdLabel} <sw-field inline><input type="number" data-building-hold min=${B.min} max=${B.max} step="1" .value=${String(this.cfg.hold_seconds)} ?disabled=${!this.editable||this.busy} @input=${t=>this.num("hold_seconds",t)} /></sw-field> ${r.holdUnit}</label>
        <label>${r.emptyLabel} <sw-field inline><input type="number" data-building-empty min=${D.min} max=${D.max} step="1" .value=${String(this.cfg.empty_minutes)} ?disabled=${!this.editable||this.busy} @input=${t=>this.num("empty_minutes",t)} /></sw-field> ${r.emptyUnit}</label>
        ${this.editable?a`<sw-button size="sm" data-building-save ?disabled=${this.busy||!!e} @click=${()=>void this.patch({hold_seconds:this.cfg.hold_seconds,empty_minutes:this.cfg.empty_minutes})}>${r.save}</sw-button>`:p}
      </div>
      <div class="row"><span>${r.homeLabel}</span><sw-segmented label=${r.homeLabel} value=${this.cfg.home_display} ?disabled=${!this.editable||this.busy} @change=${t=>void this.patch({home_display:t.detail.value})}
        .options=${[["card",r.homeCard],["chip",r.homeChip],["off",r.homeOff]].map(([t,s])=>({value:t,label:s,attrs:{"data-building-home":t}}))}></sw-segmented></div>
      ${this.cfg.home_display==="card"?this.renderCardOptions():p}
      <div class="row"><sw-toggle label=${r.tintLabel} data-building-tint .checked=${this.cfg.map_tint} ?disabled=${!this.editable||this.busy}
        @change=${t=>void this.patch({map_tint:t.detail.checked})}></sw-toggle><span class="muted">${r.tintHint}</span></div>
      <div class="row"><sw-toggle label=${r.areaSwitchLabel} data-building-area-line .checked=${!!this.cfg.area_line} ?disabled=${!this.editable||this.busy}
        @change=${t=>void this.patch({area_line:t.detail.checked})}></sw-toggle><span class="muted">${r.areaSwitchHint}</span></div>
    </sw-card>`}renderCardOptions(){const e=ie(this.cfg),t=(s,i,o,n)=>a`<div class="row" data-building-card-option=${s}>
        <span>${i}</span>
        <sw-segmented label=${i} value=${o} ?disabled=${!this.editable||this.busy} @change=${d=>void this.patch({[s]:d.detail.value})}
          .options=${ne[s].map(d=>({value:d,label:n[d],attrs:{"data-building-card":`${s}:${d}`}}))}></sw-segmented>
      </div>`;return a`<div class="cardopts" data-building-card-options>
      <div class="room">${r.cardHeading}</div>
      ${t("card_style",r.styleLabel,e.style,{count:r.styleCount,strip:r.styleStrip,floors:r.styleFloors,quiet:r.styleQuiet,off:r.styleOff})}
      ${e.style==="off"?p:a`
        ${t("card_empty_rooms",r.emptyRoomsLabel,e.emptyRooms,{hide:r.emptyHide,show:r.emptyShow})}
        ${t("card_details",r.detailsLabel,e.details,{hover:r.detailsHover,inline:r.detailsInline})}
        ${t("card_all_empty",r.allEmptyLabel,e.allEmpty,{last:r.allEmptyLast,count:r.allEmptyCount})}`}
    </div>`}renderHistory(){const e=this.hist,t=F(this.cfg)?.field==="retention_days",s=e?.oldest?new Intl.DateTimeFormat(ae(),{day:"2-digit",month:"2-digit"}).format(new Date(e.oldest)):"—";return a`<sw-card heading=${r.historyHeading} data-building-history>
      <div class="row">
        <label>${r.retentionLabel} <sw-field inline><input type="number" data-building-retention min=${M.min} max=${M.max} step="1" .value=${String(this.cfg.retention_days)} ?disabled=${!this.editable||this.busy} @input=${i=>this.num("retention_days",i)} /></sw-field> ${r.retentionUnit}</label>
        ${this.editable?a`<sw-button size="sm" data-building-retention-save ?disabled=${this.busy||t} @click=${()=>void this.patch({retention_days:this.cfg.retention_days})}>${r.save}</sw-button>`:p}
      </div>
      <div class="priv" data-building-privacy>${r.privacy}</div>
      <div class="row muted"><span>${r.rowsKept}: <b data-building-rows>${r.count(e?.rows??0)}</b></span><span>${r.oldest}: <b>${s}</b></span></div>
      ${this.editable?a`<div class="row"><sw-button size="sm" variant="danger" data-building-purge ?disabled=${this.busy||!e?.rows} @click=${()=>this.confirmPurge=!0}>${r.purge}</sw-button></div>`:p}
      ${this.confirmPurge?a`<sw-dialog open heading=${r.purgeTitle} data-building-purge-dialog @close=${()=>this.confirmPurge=!1}>
            <p>${r.purgeBody(e?.rows??0)}</p>
            <div slot="footer"><sw-button variant="danger" data-building-purge-confirm @click=${()=>void this.purge()}>${r.purgeConfirm}</sw-button><sw-button @click=${()=>this.confirmPurge=!1}>${r.cancel}</sw-button></div>
          </sw-dialog>`:p}
    </sw-card>`}render(){return this.loadFailed?a`<sw-state-panel state="error" heading=${r.loadFailed} hint=${this.loadFailed} actionLabel=${r.retry} data-building-load-error @action=${()=>this.retry()}></sw-state-panel>`:this.list===null?this.editable?a`<sw-state-panel state="loading" compact heading=${r.loading} data-building-loading></sw-state-panel>`:p:!this.editable&&!this.cfg.enabled?p:a`${this.renderMaster()}${this.cfg.enabled?a`${this.renderSensors(this.list)}${this.renderTimes()}${this.renderHistory()}`:p}`}};m.styles=z`
    :host {
      display: grid;
      gap: 12px;
    }
    .room {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-heading, var(--sw-text));
      margin-block: 10px 4px;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 8px;
    }
    .tbl {
      display: grid;
      gap: 6px;
    }
    .sensor {
      display: grid;
      grid-template-columns: 24px minmax(0, 1.3fr) minmax(0, 1fr) 124px 44px;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-radius-md, 12px);
      background: var(--sw-surface);
      font-size: var(--sw-fs-md);
      min-block-size: 46px;
    }
    .sensor[data-tagged='false'] {
      background: transparent;
    }
    .sensor .nm {
      display: grid;
      min-inline-size: 0;
    }
    .sensor .nm b {
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sensor select {
      inline-size: 100%;
      max-inline-size: none;
    }
    .st {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    .st[data-st='on'] {
      color: var(--sw-success-text);
      background: var(--sw-success-soft);
      border-color: transparent;
      font-weight: var(--sw-fw-semibold);
    }
    .st[data-st='na'] {
      border-style: dashed;
      color: var(--sw-text-3);
    }
    .more {
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
      font-weight: var(--sw-fw-bold);
      line-height: 1;
    }
    .more:disabled {
      opacity: 0.5;
      cursor: default;
    }
    /* PRESENCE-DESIGN-2300: a drawn icon instead of a "···" glyph, pressed feedback, focus ring */
    .more {
      display: inline-grid;
      place-items: center;
      padding: 0;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .more:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: no-preference) {
      .more {
        transition: transform 120ms var(--sw-ease-out, ease-out), background-color var(--sw-t-state, 200ms) var(--sw-ease, ease);
      }
      .more:not(:disabled):active {
        transform: scale(0.96);
      }
    }
    /* mobile-native: a finger gets 44 px targets and 16 px inputs (no zoom on focus) */
    @media (pointer: coarse) {
      .more {
        inline-size: 44px;
        block-size: 44px;
      }
      input[type='number'],
      select {
        /* no zoom-in on focus on a phone (needs >= 16px; the xl tier is 17-19px in every skin) */
        font-size: var(--sw-fs-xl);
      }
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    .field {
      display: grid;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .field select {
      max-inline-size: none;
    }
    @media (max-width: 700px) {
      .sensor {
        grid-template-columns: 24px minmax(0, 1fr) auto 44px;
        grid-template-areas: 'c n s m' '. r r r';
        row-gap: 6px;
      }
      .sensor > .ck {
        grid-area: c;
      }
      .sensor > .nm {
        grid-area: n;
      }
      .sensor > .rm {
        grid-area: r;
      }
      .sensor > .st {
        grid-area: s;
      }
      .sensor > .more {
        grid-area: m;
      }
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-block: 8px 0;
    }
    .priv {
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-radius-sm, 8px);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    input[type='number'] {
      inline-size: 84px;
    }
    select {
      max-inline-size: 180px;
    }
    /* CR-SEG-MODULE-LOOK-2470 (owner, 20.11): the presence pages draw sw-segmented's own default, the module look (their bordered
       pill track with the plain chosen key went) */
    sw-segmented {
      justify-self: start;
    }
    input[type='checkbox'] {
      accent-color: var(--sw-accent);
      inline-size: 18px;
      block-size: 18px;
    }
    /* mockup: the sensor table is the wide column, the times and the history sit beside it */
    @media (min-width: 1280px) {
      :host {
        grid-template-columns: minmax(0, 1fr) 340px;
        align-items: start;
      }
      [data-building-presence-master] {
        grid-column: 1 / -1;
      }
      [data-building-presence-card] {
        grid-column: 1;
        grid-row: 2 / span 2;
      }
      [data-building-presence-settings] {
        grid-column: 2;
        grid-row: 2;
      }
      [data-building-history] {
        grid-column: 2;
        grid-row: 3;
      }
    }
    /* PRESENCE-COMPACT-2310: the card's options sit as one indented group under "on the home screen" */
    .cardopts {
      display: grid;
      padding-inline-start: 12px;
      border-inline-start: 2px solid var(--sw-border);
      margin-block-start: 6px;
    }
    .cardopts .room {
      margin-block: 2px 0;
    }
    .cardopts .row {
      padding-block-start: 6px;
    }
    .ok {
      color: var(--sw-success-text);
    }
    .err {
      color: var(--sw-danger-text);
    }
  `;g([_({type:Boolean})],m.prototype,"editable",2);g([h()],m.prototype,"list",2);g([h()],m.prototype,"rooms",2);g([h()],m.prototype,"cfg",2);g([h()],m.prototype,"hist",2);g([h()],m.prototype,"busy",2);g([h()],m.prototype,"message",2);g([h()],m.prototype,"error",2);g([h()],m.prototype,"confirmPurge",2);g([h()],m.prototype,"filter",2);g([h()],m.prototype,"page",2);g([h()],m.prototype,"editId",2);g([h()],m.prototype,"narrow",2);g([h()],m.prototype,"loadFailed",2);m=g([E("system-building-presence")],m);function N(e,t,s){return e.filter(i=>i.startsWith(`${t}:${s}:`)).map(i=>i.split(":")[2])}function _e(e,t,s){return{sites:e.map(i=>({id:i.id,name:i.name.trim(),lat:Number(i.lat),lon:Number(i.lon),radius_m:Math.round(Number(i.radius_m))})),beacons:t.map(i=>({...i,name:i.name.trim(),uuid:i.uuid.trim().toLowerCase(),major:i.major??null,minor:i.minor??null,floor_id:i.floor_id||null,zone_id:i.zone_id||null})),wifi_sites:s.map(i=>{const o=(i.add_ssids??[]).map(y=>y.trim()).filter(Boolean),{add_ssids:n,...d}=i;return{...d,name:i.name.trim(),floor_id:i.floor_id||null,...o.length?{add_ssids:o}:{}}})}}function ke(e){return Object.keys(S).filter(t=>!(Number.isInteger(e[t])&&e[t]>=S[t][0]&&e[t]<=S[t][1]))}var Se=Object.defineProperty,ze=Object.getOwnPropertyDescriptor,u=(e,t,s,i)=>{for(var o=i>1?void 0:i?ze(t,s):t,n=e.length-1,d;n>=0;n--)(d=e[n])&&(o=(i?d(t,s,o):d(o))||o);return i&&o&&Se(t,s,o),o};const O=e=>`${e}_${Math.random().toString(36).slice(2,10)}`,Ce={coords:"pBadCoords",radius:"pBadRadius",uuid:"pBadUuid",site:"pNoSite",zone:"pZoneNoFloor",ssid:"pNoSsid",max:"pMax"},Ee={immediate:"proxImmediate",near:"proxNear",far:"proxFar"};let b=class extends C{constructor(){super(...arguments),this.bubbleSkin=new T(this),this.settings=null,this.editable=!1,this.sites=[],this.beacons=[],this.wifi=[],this.open=null,this.floors=[],this.zones={},this.busy=!1,this.message="",this.error="",this.source="",this.onFormKey=e=>{e.key==="Escape"&&(e.stopPropagation(),this.open=null)},this.siteName=e=>this.sites.find(t=>t.id===e)?.name||e,this.floorName=e=>e?this.floors.find(t=>t.id===e)?.name??e:""}connectedCallback(){super.connectedCallback(),le().then(e=>{this.floors=e.sites.flatMap(t=>(t.buildings??[]).flatMap(s=>(s.floors??[]).map(i=>({id:i.id,name:e.sites.length>1||(t.buildings??[]).length>1?`${s.name} · ${i.name}`:i.name}))))}).catch(()=>this.floors=[])}willUpdate(){const e=this.settings,t=e?JSON.stringify([e.sites,e.beacons,e.wifi_sites]):"";if(t!==this.source){this.source=t,this.sites=structuredClone(e?.sites??[]),this.beacons=structuredClone(e?.beacons??[]),this.wifi=structuredClone(e?.wifi_sites??[]),this.open=null;for(const s of this.beacons)s.floor_id&&this.ensureZones(s.floor_id)}}get dirty(){return JSON.stringify([this.sites,this.beacons,this.wifi])!==this.source||this.wifi.some(e=>(e.add_ssids??[]).some(t=>t.trim()))}async ensureZones(e){if(!(!e||this.zones[e]||!L()))try{const t=await ve(e);this.zones={...this.zones,[e]:t.zones.map(s=>({id:s.id,name:s.name||s.id}))}}catch{this.zones={...this.zones,[e]:[]}}}add(e){const t=this.sites[0]?.id??"";e==="site"&&(this.sites=[...this.sites,{id:O("site"),name:"",lat:32.0853,lon:34.7818,radius_m:150}]),e==="beacon"&&(this.beacons=[...this.beacons,{id:O("bcn"),name:"",uuid:"",major:null,minor:null,site_id:t,floor_id:null,zone_id:null}]),e==="wifi"&&(this.wifi=[...this.wifi,{id:O("wifi"),name:"",site_id:t,floor_id:null,ssid_hash_salt:"",ssid_hashes:[],add_ssids:[]}]);const s=e==="site"?this.sites:e==="beacon"?this.beacons:this.wifi;this.open={kind:e,id:s[s.length-1].id},this.message=""}dropItem(e,t){e==="site"&&(this.sites=this.sites.filter(s=>s.id!==t)),e==="beacon"&&(this.beacons=this.beacons.filter(s=>s.id!==t)),e==="wifi"&&(this.wifi=this.wifi.filter(s=>s.id!==t)),this.open?.id===t&&(this.open=null),this.message=""}patchSite(e,t){this.sites=this.sites.map(s=>s.id===e?{...s,...t}:s)}patchBeacon(e,t){this.beacons=this.beacons.map(s=>s.id===e?{...s,...t}:s),t.floor_id&&this.ensureZones(t.floor_id)}patchWifi(e,t){this.wifi=this.wifi.map(s=>s.id===e?{...s,...t}:s)}async save(){this.busy=!0,this.error="";try{const e=await q(_e(this.sites,this.beacons,this.wifi));this.source="",this.dispatchEvent(new CustomEvent("saved",{detail:e.settings})),this.message=l("saved"),window.setTimeout(()=>this.message="",2500)}catch(e){this.error=x(e)}finally{this.busy=!1}}row(e,t,s,i,o){const n=!this.editable||this.busy;return a`<li data-presence-place=${`${e}:${t}`}>
      <span class="lbl"><b>${s||"—"}</b><small>${i}</small>${o.length?a`<span class="bad" data-presence-place-problem>${o.map(d=>l(Ce[d]??"pMax")).join(" · ")}</span>`:p}</span>
      ${this.editable?a`<sw-button size="sm" variant="ghost" icon="edit" iconOnly label=${l("edit")} ?disabled=${n} data-presence-edit=${t} @click=${()=>{this.open=this.open?.id===t?null:{kind:e,id:t}}}></sw-button>
            <sw-button size="sm" variant="ghost" icon="trash" iconOnly label=${l("remove")} ?disabled=${n} data-presence-remove=${t} @click=${()=>this.dropItem(e,t)}></sw-button>`:p}
    </li>`}siteSelect(e,t){return a`<sw-field label=${l("site")}><select .value=${e} data-presence-f="site" @change=${s=>t(s.target.value)}>
      ${this.sites.map(s=>a`<option value=${s.id} ?selected=${s.id===e}>${s.name||s.id}</option>`)}</select></sw-field>`}floorSelect(e,t){return a`<sw-field label=${l("floor")}><select data-presence-f="floor" @change=${s=>t(s.target.value||null)}>
      <option value="" ?selected=${!e}>${l("none")}</option>
      ${this.floors.map(s=>a`<option value=${s.id} ?selected=${s.id===e}>${s.name}</option>`)}</select></sw-field>`}done(){return a`<div class="acts"><sw-button size="sm" data-presence-done @click=${()=>{this.open=null}}>${l("done")}</sw-button></div>`}sitesCard(e){return a`<sw-card heading=${l("sitesTitle")} subheading=${l("sitesSub")} data-presence-sites>
      ${this.editable?a`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy||this.sites.length>=20} data-presence-add="site" @click=${()=>this.add("site")}>${l("add")}</sw-button>`:p}
      ${this.sites.length?a`<ul>${this.sites.map(t=>a`${this.row("site",t.id,t.name,a`<span class="ltr">${Number(t.lat).toFixed(5)}, ${Number(t.lon).toFixed(5)} · ${t.radius_m} m</span>`,N(e,"site",t.id))}
          ${this.open?.kind==="site"&&this.open.id===t.id?a`<form data-presence-form="site" @submit=${s=>s.preventDefault()} @keydown=${this.onFormKey}>
                <sw-field class="wide" label=${l("name")}><input maxlength="80" .value=${t.name} data-presence-f="name" @input=${s=>this.patchSite(t.id,{name:s.target.value})} /></sw-field>
                <sw-field label=${l("lat")}><input type="number" step="0.00001" min="-90" max="90" .value=${String(t.lat)} data-presence-f="lat" @input=${s=>this.patchSite(t.id,{lat:Number(s.target.value)})} /></sw-field>
                <sw-field label=${l("lon")}><input type="number" step="0.00001" min="-180" max="180" .value=${String(t.lon)} data-presence-f="lon" @input=${s=>this.patchSite(t.id,{lon:Number(s.target.value)})} /></sw-field>
                <sw-field label=${l("radius")} hint=${l("rangeHint",{lo:30,hi:5e3})}><input type="number" min="30" max="5000" step="10" .value=${String(t.radius_m)} data-presence-f="radius" @input=${s=>this.patchSite(t.id,{radius_m:Number(s.target.value)})} /></sw-field>
                ${this.done()}</form>`:p}`)}</ul>`:a`<div class="muted">${l("emptySites")}</div>`}
    </sw-card>`}beaconsCard(e){const t=!this.sites.length;return a`<sw-card heading=${l("beaconsTitle")} subheading=${l("beaconsSub")} data-presence-beacons>
      ${this.editable?a`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy||t||this.beacons.length>=100} data-presence-add="beacon" @click=${()=>this.add("beacon")}>${l("add")}</sw-button>`:p}
      ${t&&this.editable?a`<div class="muted">${l("needSite")}</div>`:p}
      ${this.beacons.length?a`<ul>${this.beacons.map(s=>{const i=s.floor_id?this.zones[s.floor_id]??[]:[],o=i.find(d=>d.id===s.zone_id)?.name??"",n=[this.siteName(s.site_id),this.floorName(s.floor_id),o].filter(Boolean).join(" · ");return a`${this.row("beacon",s.id,s.name||s.uuid,n,N(e,"beacon",s.id))}
          ${this.open?.kind==="beacon"&&this.open.id===s.id?a`<form data-presence-form="beacon" @submit=${d=>d.preventDefault()} @keydown=${this.onFormKey}>
                <sw-field label=${l("name")}><input maxlength="80" .value=${s.name} data-presence-f="name" @input=${d=>this.patchBeacon(s.id,{name:d.target.value})} /></sw-field>
                ${this.siteSelect(s.site_id,d=>this.patchBeacon(s.id,{site_id:d}))}
                <sw-field class="wide" label=${l("uuid")}><input class="ltr" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" .value=${s.uuid} data-presence-f="uuid" @input=${d=>this.patchBeacon(s.id,{uuid:d.target.value})} /></sw-field>
                <sw-field label=${l("major")}><input type="number" min="0" max="65535" .value=${s.major===null?"":String(s.major)} data-presence-f="major" @input=${d=>{const y=d.target.value;this.patchBeacon(s.id,{major:y===""?null:Number(y)})}} /></sw-field>
                <sw-field label=${l("minor")}><input type="number" min="0" max="65535" .value=${s.minor===null?"":String(s.minor)} data-presence-f="minor" @input=${d=>{const y=d.target.value;this.patchBeacon(s.id,{minor:y===""?null:Number(y)})}} /></sw-field>
                ${this.floorSelect(s.floor_id,d=>this.patchBeacon(s.id,{floor_id:d,zone_id:null}))}
                <sw-field label=${l("zone")}><select ?disabled=${!s.floor_id} data-presence-f="zone" @change=${d=>this.patchBeacon(s.id,{zone_id:d.target.value||null})}>
                  <option value="" ?selected=${!s.zone_id}>${l("none")}</option>${i.map(d=>a`<option value=${d.id} ?selected=${d.id===s.zone_id}>${d.name}</option>`)}</select></sw-field>
                ${this.done()}</form>`:p}`})}</ul>`:a`<div class="muted">${l("emptyBeacons")}</div>`}
    </sw-card>`}wifiCard(e){const t=!this.sites.length;return a`<sw-card heading=${l("wifiTitle")} subheading=${l("wifiSub")} data-presence-wifi>
      ${this.editable?a`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy||t||this.wifi.length>=20} data-presence-add="wifi" @click=${()=>this.add("wifi")}>${l("add")}</sw-button>`:p}
      ${t&&this.editable?a`<div class="muted">${l("needSite")}</div>`:p}
      ${this.wifi.length?a`<ul>${this.wifi.map(s=>{const i=(s.add_ssids??[]).filter(n=>n.trim()).length,o=[this.siteName(s.site_id),this.floorName(s.floor_id),l("ssidCount",{n:s.ssid_hashes.length+i})].filter(Boolean).join(" · ");return a`${this.row("wifi",s.id,s.name,o,N(e,"wifi",s.id))}
          ${this.open?.kind==="wifi"&&this.open.id===s.id?a`<form data-presence-form="wifi" @submit=${n=>n.preventDefault()} @keydown=${this.onFormKey}>
                <sw-field class="wide" label=${l("name")}><input maxlength="80" .value=${s.name} data-presence-f="name" @input=${n=>this.patchWifi(s.id,{name:n.target.value})} /></sw-field>
                ${this.siteSelect(s.site_id,n=>this.patchWifi(s.id,{site_id:n}))}
                ${this.floorSelect(s.floor_id,n=>this.patchWifi(s.id,{floor_id:n}))}
                <sw-field class="wide" label=${l("ssids")} hint=${l("ssidsHint")}><textarea class="ltr" autocomplete="off" spellcheck="false" .value=${(s.add_ssids??[]).join(`
`)} data-presence-f="ssids"
                  @input=${n=>this.patchWifi(s.id,{add_ssids:n.target.value.split(`
`).map(d=>d.slice(0,32))})}></textarea></sw-field>
                <div class="acts">${s.ssid_hashes.length?a`<sw-button size="sm" variant="ghost" icon="trash" data-presence-clear-ssids @click=${()=>this.patchWifi(s.id,{ssid_hashes:[]})}>${l("clearSsids")}</sw-button>`:p}
                  <sw-button size="sm" data-presence-done @click=${()=>{this.open=null}}>${l("done")}</sw-button></div></form>`:p}`})}</ul>`:a`<div class="muted">${l("emptyWifi")}</div>`}
    </sw-card>`}render(){const e=oe(this.sites,this.beacons,this.wifi);return a`<div class="cards">${this.sitesCard(e)}${this.beaconsCard(e)}${this.wifiCard(e)}</div>
      ${this.editable?a`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-presence-places-save ?disabled=${!this.dirty||this.busy||e.length>0} @click=${()=>void this.save()}>${l("save")}</sw-button>
            ${this.message?a`<span class="ok" role="status" data-presence-places-message>${this.message}</span>`:e.length?a`<span class="err" data-presence-places-state="problems">${e.length===1?c("בעיה אחת מונעת שמירה - היא מסומנת ברשימה"):c("{n} בעיות מונעות שמירה - הן מסומנות ברשימה",{n:e.length})}</span>`:this.dirty?a`<span class="pending" data-presence-places-state="dirty">${c("יש שינויים שלא נשמרו")}</span>`:p}
            ${this.error?a`<span class="err" role="alert" data-presence-places-error>${this.error}</span>`:p}
          </div>`:p}`}};b.styles=[z`
    :host { display: grid; gap: 12px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 12px; align-items: start; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-block-end: 1px solid var(--sw-border); }
    li:last-child { border-block-end: 0; }
    .lbl { flex: 1; min-inline-size: 0; display: grid; gap: 2px; }
    .lbl b { font-weight: var(--sw-fw-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lbl small { color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    ${re}
    .bad { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); padding: 6px 0; }
    form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; padding: 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); margin-block: 6px; }
    form .wide { grid-column: 1 / -1; }
    form .acts { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
    textarea { min-block-size: 64px; resize: vertical; }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    ${J}
    ${R}
    /* ACCESS-POLISH-2331: why the save button is (not) available - unsaved edits, or the problems that block it */
    .pending { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    @media (max-width: 480px) { form { grid-template-columns: minmax(0, 1fr); } }
  `,H];u([_({attribute:!1})],b.prototype,"settings",2);u([_({type:Boolean})],b.prototype,"editable",2);u([h()],b.prototype,"sites",2);u([h()],b.prototype,"beacons",2);u([h()],b.prototype,"wifi",2);u([h()],b.prototype,"open",2);u([h()],b.prototype,"floors",2);u([h()],b.prototype,"zones",2);u([h()],b.prototype,"busy",2);u([h()],b.prototype,"message",2);u([h()],b.prototype,"error",2);b=u([E("system-presence-places")],b);let $=class extends C{constructor(){super(...arguments),this.bubbleSkin=new T(this),this.settings=null,this.editable=!1,this.draft={...A},this.busy=!1,this.message="",this.error="",this.source=""}willUpdate(){const e=this.settings?.people??A,t=JSON.stringify(e);t!==this.source&&(this.source=t,this.draft={...e})}async save(){this.busy=!0,this.error="";try{const e=await q({people:this.draft});this.dispatchEvent(new CustomEvent("saved",{detail:e.settings})),this.message=l("saved"),window.setTimeout(()=>this.message="",2500)}catch(e){this.error=x(e)}finally{this.busy=!1}}num(e,t){const[s,i]=S[e];return a`<sw-field label=${l(t)} hint=${l("rangeHint",{lo:s,hi:i})}><input type="number" min=${s} max=${i} step="1" .value=${String(this.draft[e])} ?disabled=${!this.editable||this.busy}
      data-presence-people=${e} @input=${o=>{this.draft={...this.draft,[e]:Number(o.target.value)},this.message=""}} /></sw-field>`}render(){const e=this.draft,t=ke(e),s=JSON.stringify(e)!==this.source,i=this.settings?.people_opt_out_count??0;return a`<sw-card heading=${l("screenTitle")} subheading=${l("screenSub")} data-presence-screen>
      <div class="grid">
        ${this.num("stale_minutes","staleMin")}${this.num("beacon_max_age_minutes","beaconAge")}${this.num("wifi_max_age_minutes","wifiAge")}
        <sw-field label=${l("minProximity")}><select ?disabled=${!this.editable||this.busy} data-presence-people="min_proximity"
          @change=${o=>{this.draft={...e,min_proximity:o.target.value}}}>
          ${de.map(o=>a`<option value=${o} ?selected=${o===e.min_proximity}>${l(Ee[o])}</option>`)}</select></sw-field>
        ${this.num("refresh_seconds","refreshSec")}
        <div class="row"><span class="lbl">${l("showNames")}<span class="muted">${l("showNamesHint")}</span></span>
          <sw-toggle ?checked=${e.show_names} ?disabled=${!this.editable||this.busy} label=${l("showNames")} labelHidden data-presence-people="show_names"
            @change=${o=>{this.draft={...e,show_names:o.detail.checked}}}></sw-toggle></div>
        ${i?a`<div class="row muted" data-presence-optout-count>${l("optOutCount",{n:i})}</div>`:p}
      </div>
      ${this.editable?a`<div class="foot"><sw-button variant="primary" size="sm" icon="check" data-presence-screen-save ?disabled=${!s||this.busy||t.length>0} @click=${()=>void this.save()}>${l("save")}</sw-button>
            ${this.message?a`<span class="ok" role="status">${this.message}</span>`:p}${this.error?a`<span class="err" role="alert">${this.error}</span>`:p}</div>`:p}
    </sw-card>`}};$.styles=[z`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 10px 16px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; grid-column: 1 / -1; border-block-start: 1px solid var(--sw-border); }
    .lbl { display: flex; flex-direction: column; gap: 2px; font-weight: var(--sw-fw-medium); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-regular); }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-block-start: 10px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    ${R}
  `,H];u([_({attribute:!1})],$.prototype,"settings",2);u([_({type:Boolean})],$.prototype,"editable",2);u([h()],$.prototype,"draft",2);u([h()],$.prototype,"busy",2);u([h()],$.prototype,"message",2);u([h()],$.prototype,"error",2);$=u([E("system-presence-screen")],$);var Pe=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,w=(e,t,s,i)=>{for(var o=i>1?void 0:i?Ne(t,s):t,n=e.length-1,d;n>=0;n--)(d=e[n])&&(o=(i?d(t,s,o):d(o))||o);return i&&o&&Pe(t,s,o),o};const Oe=e=>e==="places"||e==="screen"||e==="building"?e:"general",K={enabled:!1,mode:"continuous",interval_s:60,distance_filter_m:50,notice_text:"",notice_version:1,sensors_allowed:[...v],intervals_s:{},sites:[],beacons:[],wifi_sites:[],wifi_match_mode:"phone",retention_days:30,required_sensors:{enabled:!1,sensors:[],hardware_required:[],apply_to_web:!1,max_stale_hours:48,roles:[],users:[],exempt_users:[]},break_glass:{until:null,reason:"",by:null}};let f=class extends C{constructor(){super(...arguments),this.bubbleSkin=new T(this),this.draft=K,this.saved=K,this.canEdit=!1,this.busy=!1,this.message="",this.error="",this.devices=null,this.glassReason="",this.page=Oe(I().params.get("page"))}connectedCallback(){super.connectedCallback(),L()&&(ce().then(e=>{this.saved=e.settings,this.draft=structuredClone(e.settings),this.canEdit=!0}).catch(e=>{this.canEdit=!1,e instanceof Error&&/403|אין הרשאה/.test(e.message)||(this.error=x(e))}),pe("presence.sensors.view")&&he().then(e=>this.devices=e.devices).catch(()=>this.devices=[]))}get dirty(){return JSON.stringify(this.draft)!==JSON.stringify(this.saved)}patch(e){this.draft={...this.draft,...e},this.message=""}toggleSensor(e,t){const s=new Set(this.draft.sensors_allowed);t?s.add(e):s.delete(e),this.patch({sensors_allowed:v.filter(i=>s.has(i))})}toggleRequired(e,t){const s=new Set(this.draft.required_sensors.sensors);t?s.add(e):s.delete(e),this.patch({required_sensors:{...this.draft.required_sensors,sensors:v.filter(i=>s.has(i))}})}toggleHardware(e,t){const s=new Set(this.draft.required_sensors.hardware_required??[]);t?s.add(e):s.delete(e),this.patch({required_sensors:{...this.draft.required_sensors,hardware_required:v.filter(i=>s.has(i))}})}async save(){const e=U(this.draft);if(e&&this.draft.required_sensors.enabled&&this.draft.required_sensors.sensors.length===0){this.error=e;return}this.busy=!0,this.error="";try{const t=this.draft,s=await q({enabled:t.enabled,notice_text:t.notice_text,sensors_allowed:t.sensors_allowed,retention_days:t.retention_days,wifi_match_mode:t.wifi_match_mode??"phone",value_check:W(t.value_check),required_sensors:t.required_sensors});this.saved=s.settings,this.draft=structuredClone(s.settings),this.message=c("ההגדרות נשמרו"),setTimeout(()=>this.message="",2500)}catch(t){this.error=x(t)}finally{this.busy=!1}}async glass(e){this.busy=!0,this.error="";try{const t=await ue(e,this.glassReason);this.saved={...this.saved,break_glass:t.break_glass},this.draft={...this.draft,break_glass:t.break_glass},this.glassReason="",this.message=e?c("הדרישה הושעתה"):c("ההשעיה הסתיימה"),setTimeout(()=>this.message="",2500)}catch(t){this.error=x(t)}finally{this.busy=!1}}renderDevices(){if(this.devices===null)return p;const e=i=>i?G(i):"—",t=i=>v.filter(o=>i.status.sensors[o]==="on").map(o=>k[o]).join(", ")||"—",s=[{key:"user",label:c("משתמש"),render:i=>a`<span class="t1">${i.user?.display_name??""}</span>`},{key:"name",label:c("מכשיר"),render:i=>a`${i.name}<span class="t2">${i.platform==="ios"?"iPhone":"Android"} · ${i.app_version??""}</span>`},{key:"sharing",label:c("משתף"),kind:"truncate",cellTitle:t,render:t},{key:"inside",label:c("במבנה"),kind:"status",render:i=>i.presence.inside===null||i.presence.inside===void 0?a`<span class="mut">—</span>`:a`<span class="chip" data-tone=${i.presence.inside?"ok":p}>${i.presence.inside?c("כן"):c("לא")}</span>`},{key:"last",label:c("דיווח אחרון"),kind:"muted",render:i=>a`<span class="num">${e(i.last_event_at??i.last_seen_at)}</span>`},{key:"push",label:c("התראות"),render:i=>i.push.registered?c("רשום"):a`<span class="mut">—</span>`}];return a`<sw-card heading=${c("מכשירים רשומים")} subheading=${this.devices.length?c("{n} מכשירים",{n:this.devices.length}):c("אין מכשירים רשומים")} data-presence-devices>
      ${this.devices.length?a`<sw-table bare static-rows data-presence-table rowKey="device_id" .columns=${s} .rows=${this.devices}
            .rowAttrs=${i=>({"data-presence-device":String(i.device_id)})}></sw-table>`:p}
    </sw-card>`}setPage(e){this.page=e;const t=new URLSearchParams(I().params);t.set("tab","mobile"),e==="general"?t.delete("page"):t.set("page",e),me("/system/diagnostics",t)}adopt(e){const t={sites:e.sites,beacons:e.beacons,wifi_sites:e.wifi_sites,people:e.people,people_opt_out_count:e.people_opt_out_count,notice_version:e.notice_version};this.saved={...this.saved,...t},this.draft={...this.draft,...t}}render(){const e=this.canEdit&&L(),t=a`<sw-segmented data-presence-pages value=${this.page} @change=${s=>this.setPage(s.detail.value)}
      .options=${[{value:"general",label:l("segGeneral"),attrs:{"data-presence-page":"general"}},{value:"places",label:l("segPlaces"),attrs:{"data-presence-page":"places"}},{value:"screen",label:l("segScreen"),attrs:{"data-presence-page":"screen"}},{value:"building",label:r.tab,attrs:{"data-presence-page":"building"}}]}></sw-segmented>`;return this.page==="building"?a`${t}<system-building-presence ?editable=${e}></system-building-presence>`:this.page==="places"?a`${t}<system-presence-places .settings=${this.saved} ?editable=${e} @saved=${s=>this.adopt(s.detail)}></system-presence-places>`:this.page==="screen"?a`${t}<system-presence-screen .settings=${this.saved} ?editable=${e} @saved=${s=>this.adopt(s.detail)}></system-presence-screen>`:a`${t}${this.renderGeneral(e)}`}renderGeneral(e){const t=this.draft,s=t.required_sensors,i=U(t),o=t.break_glass.until?G(t.break_glass.until):null;return a`<sw-card heading=${c("שיתוף נתונים מהאפליקציה")} subheading=${c("כבוי כברירת מחדל; הטלפונים לא אוספים דבר עד ההפעלה")} data-presence-card>
        <div class="row" data-presence-row="enabled"><span class="lbl">${c("שיתוף פעיל")}<span class="muted">${c("מופעל רק אחרי שההודעה לעובדים נשלחה")}</span></span>
          <sw-toggle ?checked=${t.enabled} ?disabled=${!e||this.busy} label=${c("שיתוף פעיל")} labelHidden data-presence-enabled @change=${n=>this.patch({enabled:n.detail.checked})}></sw-toggle></div>
        <div class="row" data-presence-row="sensors"><span class="lbl">${c("חיישנים מאושרים")}<span class="muted">${c("העובד בוחר באפליקציה מתוך הרשימה הזו בלבד")}</span></span></div>
        <div class="grid" data-presence-sensors>${v.map(n=>a`<label class="chk"><input type="checkbox" data-presence-sensor=${n} .checked=${t.sensors_allowed.includes(n)} ?disabled=${!e||this.busy} @change=${d=>this.toggleSensor(n,d.target.checked)} /> ${k[n]}</label>`)}</div>
        <div class="row" data-presence-row="wifi-mode"><span class="lbl">${c("התאמת Wi-Fi לאתר")}<span class="muted">${c('בטלפון: הטלפון שולח רק "מחובר לרשת אתר"; בשרת: הטלפון שולח גיבוב של שם הרשת והשרת משווה')}</span></span>
          <sw-field><select data-presence-wifi-mode ?disabled=${!e||this.busy} @change=${n=>this.patch({wifi_match_mode:n.target.value})}>
            <option value="phone" ?selected=${(t.wifi_match_mode??"phone")==="phone"}>${c("בטלפון (ברירת מחדל)")}</option>
            <option value="server" ?selected=${t.wifi_match_mode==="server"}>${c("בשרת (גיבוב)")}</option>
          </select></sw-field></div>
        <div class="row" data-presence-row="value-check"><span class="lbl">${l("valueCheck")}<span class="muted">${l("valueCheckHint")}</span></span>
          <sw-segmented label=${l("valueCheck")} data-presence-value-check value=${W(t.value_check)} ?disabled=${!e||this.busy} @change=${n=>this.patch({value_check:n.detail.value})}
      .options=${ge.map(n=>({value:n,label:l(`valueCheck_${n}`),attrs:{"data-v":n}}))}></sw-segmented></div>
        <div class="row" data-presence-row="notice"><span class="lbl">${c("הודעה לעובדים")}<span class="muted">${c("גרסה {n}; שינוי בטקסט מעלה את הגרסה וכל מכשיר מאשר מחדש",{n:t.notice_version})}</span></span></div>
        <textarea data-presence-notice placeholder=${c("טקסט ההודעה לעובדים (ניסוח משפטי של בעל המערכת)")} .value=${t.notice_text} ?disabled=${!e||this.busy} @input=${n=>this.patch({notice_text:n.target.value})}></textarea>
        <div class="row" data-presence-row="retention"><span class="lbl">${c("שמירת יומן הדיווחים")}</span>
          <sw-field><select data-presence-retention ?disabled=${!e||this.busy} @change=${n=>this.patch({retention_days:Number(n.target.value)})}>
            ${be.map(n=>a`<option value=${n} ?selected=${t.retention_days===n}>${c("{n} ימים",{n})}</option>`)}
          </select></sw-field></div>
      </sw-card>
      <sw-card heading=${c("חיישנים נדרשים לשימוש מהאפליקציה")} subheading=${c("מי שלא הפעיל חיישן נדרש לא ייכנס מהאפליקציה; מנהלי מערכת לעולם לא נחסמים")} data-presence-policy>
        <div class="row" data-presence-row="policy"><span class="lbl">${c("הדרישה פעילה")}<span class="muted">${c("חלה על הפעלות מהאפליקציה בלבד, אלא אם סומן אחרת")}</span></span>
          <sw-toggle ?checked=${s.enabled} ?disabled=${!e||this.busy} label=${c("הדרישה פעילה")} labelHidden data-presence-policy-enabled @change=${n=>this.patch({required_sensors:{...s,enabled:n.detail.checked}})}></sw-toggle></div>
        <div class="grid" data-presence-required>${v.map(n=>a`<label class="chk"><input type="checkbox" data-presence-required-sensor=${n} .checked=${s.sensors.includes(n)} ?disabled=${!e||this.busy||!s.enabled} @change=${d=>this.toggleRequired(n,d.target.checked)} /> ${k[n]}</label>`)}</div>
        <div class="row" data-presence-row="hardware"><span class="lbl">${c("חומרה שחובה בשרת זה")}</span></div>
        <div class="grid" data-presence-hardware>${v.map(n=>a`<label class="chk"><input type="checkbox" data-presence-hardware-sensor=${n} .checked=${(s.hardware_required??[]).includes(n)} ?disabled=${!e||this.busy||!s.enabled} @change=${d=>this.toggleHardware(n,d.target.checked)} /> ${k[n]}</label>`)}</div>
        <div class="row" data-presence-row="web"><span class="lbl">${c("גם בדפדפן")}<span class="muted">${c("משתמש בלי האפליקציה ייחסם גם בדפדפן")}</span></span>
          <sw-toggle ?checked=${s.apply_to_web} ?disabled=${!e||this.busy||!s.enabled} label=${c("גם בדפדפן")} labelHidden data-presence-policy-web @change=${n=>this.patch({required_sensors:{...s,apply_to_web:n.detail.checked}})}></sw-toggle></div>
        ${i&&s.enabled?a`<div class="warn" role="status" data-presence-policy-problem>${i}</div>`:p}
        ${e?a`<div class="row" data-presence-row="glass"><span class="lbl">${c("השעיה זמנית")}<span class="muted">${o?`${c("מושעה עד {time}",{time:o})}${this.saved.break_glass.reason?` · ${this.saved.break_glass.reason}`:""}`:c("פותח את הכניסה לכולם ל־24 שעות, עם סיבה")}</span></span>
              <span class="glass">${o?a`<sw-button size="sm" data-presence-glass-end ?disabled=${this.busy} @click=${()=>void this.glass(0)}>${c("סיים השעיה")}</sw-button>`:a`<input type="text" data-presence-glass-reason placeholder=${c("סיבה")} maxlength="200" .value=${this.glassReason} @input=${n=>this.glassReason=n.target.value} /><sw-button size="sm" data-presence-glass ?disabled=${this.busy||this.glassReason.trim().length<3} @click=${()=>void this.glass(24)}>${c("השעה ל־24 שעות")}</sw-button>`}</span></div>`:p}
        ${e?a`<div class="foot">
              <sw-button variant="primary" size="sm" icon="check" data-presence-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${c("שמור")}</sw-button>
              ${this.message?a`<span class="ok" role="status" data-presence-message>${this.message}</span>`:p}
              ${this.error?a`<span class="err" role="alert" data-presence-error>${this.error}</span>`:p}
            </div>`:p}
      </sw-card>
      ${this.renderDevices()}`}};f.styles=[z`
    :host {
      display: grid;
      gap: 12px;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    /* R5-SECURITY: the setting's name 14/700 in the heading ink */
    .lbl {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 6px 16px;
      padding: 8px 0;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      resize: vertical;
      font: inherit;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: inherit;
      box-sizing: border-box;
    }
    ${$e}
    /* POLISH4-WP8: the message inks are the -text tokens (the live-video dot and the bare state colours were below text contrast) */
    ${J}
    ${R}
    .warn {
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    textarea:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (pointer: coarse) {
      .chk {
        min-block-size: 44px;
      }
    }
    .glass {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .glass input {
      flex: 1 1 200px;
      min-width: 0;
    }
    /* CR-CMP2-TABLES-REST-2470 (owner N10): the registered devices are the shared table inside the card (no second card, never wider
       than the card: the shared sensors line is cut with an ellipsis, its full text the cell's title) */
    sw-table[data-presence-table] {
      --sw-table-min: 0;
      --sw-table-trunc: 220px;
    }
    /* CR-SEG-MODULE-LOOK-2470 (owner, 20.11): the presence pages draw sw-segmented's own default, the module look (their bordered
       pill track with the plain chosen key went) */
    sw-segmented {
      justify-self: start;
    }
    @media (max-width: 767px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row > :not(.lbl) {
        align-self: flex-end;
      }
      /* owner Q7: the policy card's save row stays in view on a phone while the long card scrolls under it (settings kit .foot.sticky look) */
      .foot {
        position: sticky;
        inset-block-end: var(--sw-s-2);
        z-index: 3;
        padding: 10px var(--sw-s-2);
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-lg);
        background: var(--sw-surface-solid);
        box-shadow: var(--sw-shadow-3);
      }
    }
  `,H];w([h()],f.prototype,"draft",2);w([h()],f.prototype,"saved",2);w([h()],f.prototype,"canEdit",2);w([h()],f.prototype,"busy",2);w([h()],f.prototype,"message",2);w([h()],f.prototype,"error",2);w([h()],f.prototype,"devices",2);w([h()],f.prototype,"glassReason",2);w([h()],f.prototype,"page",2);f=w([E("system-presence")],f);
