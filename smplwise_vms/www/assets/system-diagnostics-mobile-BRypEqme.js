import{g as z,ax as _,j as h,i as E,n0 as Y,n1 as j,ld as r,n as x,n2 as Z,n3 as Q,n4 as V,n5 as X,n6 as ee,A as p,b as i,n7 as se,n8 as te,n9 as B,na as F,nb as D,nc as ie,u as ae,nd as M,ne as re,k as C,nf as S,aU as L,aV as ne,aK as J,c$ as T,aL as q,R as oe,a2 as R,ng as H,hE as o,nh as le,dE as c,ni as I,nj as de,nk as v,aa as A,nl as ce,aA as pe,nm as he,nn as U,no as W,np as ue,nq as k,cI as ge,aI as G,nr as me,ns as be}from"./index-Cwrvr-7C.js";import"./sw-pager-DXz5Dx67.js";import{L as fe,p as we}from"./long-lists-C3zY0irM.js";import{e as $e}from"./settings-C0oL8AFl.js";import{l as ve}from"./zones-CTc_Y9CE.js";import"./sw-logo-art-PLtEZJxU.js";var ye=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,m=(e,s,t,n)=>{for(var l=n>1?void 0:n?xe(s,t):s,a=e.length-1,d;a>=0;a--)(d=e[a])&&(l=(n?d(s,t,l):d(l))||l);return n&&l&&ye(s,t,l),l};const P={enabled:!1,hold_seconds:60,empty_minutes:10,retention_days:30,home_display:"chip",map_tint:!0,area_line:!1};let g=class extends E{constructor(){super(...arguments),this.editable=!1,this.list=null,this.rooms=[],this.cfg=P,this.hist=null,this.busy=!1,this.message="",this.error="",this.confirmPurge=!1,this.filter="all",this.page=1,this.lists=new fe(this,()=>this.page=1),this.editId="",this.narrow=!1,this.loadFailed="",this.mq=window.matchMedia("(max-width: 700px)"),this.onMq=()=>{this.narrow=this.mq.matches,this.page=1}}connectedCallback(){super.connectedCallback(),this.narrow=this.mq.matches,this.mq.addEventListener("change",this.onMq),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}async load(){this.loadFailed="";try{const e=await Y();this.list=e.sensors,this.rooms=e.rooms??[],this.cfg={...P,...e.settings},this.cfg.enabled&&(this.hist=await j())}catch(e){e instanceof Error&&/403|אין הרשאה/.test(e.message)?this.list=[]:(this.list=null,this.loadFailed=x(e)||r.loadFailed)}}retry(){this.loadFailed="",this.load()}async run(e,s=r.saved){if(!this.busy){this.busy=!0,this.error="";try{await e(),this.message=s,setTimeout(()=>this.message="",2500)}catch(t){this.error=x(t)}finally{this.busy=!1}}}patch(e){return this.run(async()=>{this.cfg={...P,...(await Z(e)).settings},this.hist=this.cfg.enabled?await j():null})}toggleTag(e,s){if(!this.list)return;const t=Q(this.list,e,s);return this.run(async()=>{const n=await V(t);this.list=n.sensors,this.rooms=n.rooms??this.rooms})}setRoom(e,s){return this.run(async()=>{const t=await X(e,s||null);this.list=t.sensors})}purge(){return this.confirmPurge=!1,this.run(async()=>{this.hist=await ee()},r.purged)}num(e,s){const t=s.target.valueAsNumber;this.cfg={...this.cfg,[e]:Number.isFinite(t)?t:NaN}}renderMaster(){return i`<sw-card heading=${r.masterLabel} data-building-presence-master>
      <div class="row">
        <sw-toggle label=${r.masterLabel} labelHidden data-building-enabled .checked=${this.cfg.enabled} ?disabled=${!this.editable||this.busy}
          @change=${e=>void this.patch({enabled:e.detail.checked})}></sw-toggle>
        ${this.cfg.enabled?p:i`<b data-building-off-note>${r.masterOffNote}</b>`}
        <span class="muted">${r.masterHint}</span>
        ${this.message?i`<span class="ok" role="status">${this.message}</span>`:p}
        ${this.error?i`<span class="err" role="alert">${this.error}</span>`:p}
      </div>
    </sw-card>`}renderSensors(e){const s=e.filter(a=>a.tagged).length,t=se(e,this.filter),n=we(this.lists.paged,this.narrow?5:6,t.length),l=te(t,this.page,n);return i`<sw-card heading=${r.heading} subheading=${s?`${s} ${r.tagged} · ${e.length} ${r.found}`:r.subheading} data-building-presence-card>
      <div class="bar"><sw-segmented label=${r.filterLabel} value=${this.filter} @change=${a=>{this.filter=a.detail.value,this.page=1}}
        .options=${[["all",r.filterAll],["tagged",r.filterTagged],["untagged",r.filterUntagged]].map(([a,d])=>({value:a,label:d,attrs:{"data-building-filter":a}}))}></sw-segmented></div>
      ${e.length?p:i`<div class="muted">${r.noSensors}</div>`}
      <div class="tbl" data-building-table>${l.items.map(a=>this.renderRow(a))}</div>
      <div class="foot"><span class="muted">${r.tagNote}</span>${l.pages>1?i`<sw-pager .page=${l.page} .pages=${l.pages} @page-change=${a=>this.page=a.detail.page}></sw-pager>`:p}</div>
      ${this.renderEditor(e)}
    </sw-card>`}stateChip(e){const s=e.state==="on"?"on":e.state==="off"?"off":"na";return i`<span class="st" data-st=${s} data-building-state>${r.stateWord(e.state)}</span>`}roomSelect(e,s){return i`<sw-field><select data-building-room=${s} aria-label=${r.roomPick} ?disabled=${this.busy||!this.editable} @change=${t=>void this.setRoom(e.entity_id,t.target.value)}>
      <option value="" ?selected=${!e.placed}>${r.ownRoom}</option>
      ${this.rooms.map(t=>i`<option value=${t.area_id} ?selected=${!!e.placed&&e.area_id===t.area_id}>${t.name}</option>`)}</select></sw-field>`}renderRow(e){const s=this.editable&&e.tagged;return i`<div class="sensor" data-building-sensor=${e.entity_id} data-tagged=${String(e.tagged)}>
      <label class="ck"><input type="checkbox" aria-label=${e.name} .checked=${e.tagged} ?disabled=${!this.editable||this.busy} @change=${t=>void this.toggleTag(e.entity_id,t.target.checked)} /></label>
      <span class="nm"><b title=${e.name} dir="auto">${e.name}</b><span class="muted">${r.kindWord(e.device_class)}</span></span>
      <span class="rm">${s?this.roomSelect(e,"row"):i`<span class="muted">${e.area_name??r.noRoom}</span>`}</span>
      ${this.stateChip(e)}
      <button type="button" class="more" data-building-more aria-label=${`${r.editTitle}: ${e.name}`} ?disabled=${!s} @click=${()=>this.editId=e.entity_id}><sw-icon name="more" size="18"></sw-icon></button>
    </div>`}renderEditor(e){const s=e.find(t=>t.entity_id===this.editId);return s?i`<sw-drawer modal .open=${!0} heading=${s.name} subheading=${s.area_name??r.noRoom} data-building-editor @close=${()=>this.editId=""}>
      <div class="field">${r.stateNow}<div>${this.stateChip(s)}</div></div>
      <label class="field">${r.roomPick}${this.roomSelect(s,"editor")}</label>
      <div class="priv">${r.tagNote}</div>
      <div slot="footer" class="row">
        <sw-button variant="danger" data-building-untag ?disabled=${this.busy||!this.editable} @click=${()=>{const t=s.entity_id;this.editId="",this.toggleTag(t,!1)}}>${r.removeTag}</sw-button>
        <sw-button @click=${()=>this.editId=""}>${r.close}</sw-button>
      </div>
    </sw-drawer>`:p}renderTimes(){const e=B(this.cfg);return i`<sw-card heading=${r.timesHeading} data-building-presence-settings>
      <div class="row">
        <label>${r.holdLabel} <sw-field inline><input type="number" data-building-hold min=${F.min} max=${F.max} step="1" .value=${String(this.cfg.hold_seconds)} ?disabled=${!this.editable||this.busy} @input=${s=>this.num("hold_seconds",s)} /></sw-field> ${r.holdUnit}</label>
        <label>${r.emptyLabel} <sw-field inline><input type="number" data-building-empty min=${D.min} max=${D.max} step="1" .value=${String(this.cfg.empty_minutes)} ?disabled=${!this.editable||this.busy} @input=${s=>this.num("empty_minutes",s)} /></sw-field> ${r.emptyUnit}</label>
        ${this.editable?i`<sw-button size="sm" data-building-save ?disabled=${this.busy||!!e} @click=${()=>void this.patch({hold_seconds:this.cfg.hold_seconds,empty_minutes:this.cfg.empty_minutes})}>${r.save}</sw-button>`:p}
      </div>
      <div class="row"><span>${r.homeLabel}</span><sw-segmented label=${r.homeLabel} value=${this.cfg.home_display} ?disabled=${!this.editable||this.busy} @change=${s=>void this.patch({home_display:s.detail.value})}
        .options=${[["card",r.homeCard],["chip",r.homeChip],["off",r.homeOff]].map(([s,t])=>({value:s,label:t,attrs:{"data-building-home":s}}))}></sw-segmented></div>
      ${this.cfg.home_display==="card"?this.renderCardOptions():p}
      <div class="row"><sw-toggle label=${r.tintLabel} data-building-tint .checked=${this.cfg.map_tint} ?disabled=${!this.editable||this.busy}
        @change=${s=>void this.patch({map_tint:s.detail.checked})}></sw-toggle><span class="muted">${r.tintHint}</span></div>
      <div class="row"><sw-toggle label=${r.areaSwitchLabel} data-building-area-line .checked=${!!this.cfg.area_line} ?disabled=${!this.editable||this.busy}
        @change=${s=>void this.patch({area_line:s.detail.checked})}></sw-toggle><span class="muted">${r.areaSwitchHint}</span></div>
    </sw-card>`}renderCardOptions(){const e=ie(this.cfg),s=(t,n,l,a)=>i`<div class="row" data-building-card-option=${t}>
        <span>${n}</span>
        <sw-segmented label=${n} value=${l} ?disabled=${!this.editable||this.busy} @change=${d=>void this.patch({[t]:d.detail.value})}
          .options=${re[t].map(d=>({value:d,label:a[d],attrs:{"data-building-card":`${t}:${d}`}}))}></sw-segmented>
      </div>`;return i`<div class="cardopts" data-building-card-options>
      <div class="room">${r.cardHeading}</div>
      ${s("card_style",r.styleLabel,e.style,{count:r.styleCount,strip:r.styleStrip,floors:r.styleFloors,quiet:r.styleQuiet,off:r.styleOff})}
      ${e.style==="off"?p:i`
        ${s("card_empty_rooms",r.emptyRoomsLabel,e.emptyRooms,{hide:r.emptyHide,show:r.emptyShow})}
        ${s("card_details",r.detailsLabel,e.details,{hover:r.detailsHover,inline:r.detailsInline})}
        ${s("card_all_empty",r.allEmptyLabel,e.allEmpty,{last:r.allEmptyLast,count:r.allEmptyCount})}`}
    </div>`}renderHistory(){const e=this.hist,s=B(this.cfg)?.field==="retention_days",t=e?.oldest?new Intl.DateTimeFormat(ae(),{day:"2-digit",month:"2-digit"}).format(new Date(e.oldest)):"—";return i`<sw-card heading=${r.historyHeading} data-building-history>
      <div class="row">
        <label>${r.retentionLabel} <sw-field inline><input type="number" data-building-retention min=${M.min} max=${M.max} step="1" .value=${String(this.cfg.retention_days)} ?disabled=${!this.editable||this.busy} @input=${n=>this.num("retention_days",n)} /></sw-field> ${r.retentionUnit}</label>
        ${this.editable?i`<sw-button size="sm" data-building-retention-save ?disabled=${this.busy||s} @click=${()=>void this.patch({retention_days:this.cfg.retention_days})}>${r.save}</sw-button>`:p}
      </div>
      <div class="priv" data-building-privacy>${r.privacy}</div>
      <div class="row muted"><span>${r.rowsKept}: <b data-building-rows>${r.count(e?.rows??0)}</b></span><span>${r.oldest}: <b>${t}</b></span></div>
      ${this.editable?i`<div class="row"><sw-button size="sm" variant="danger" data-building-purge ?disabled=${this.busy||!e?.rows} @click=${()=>this.confirmPurge=!0}>${r.purge}</sw-button></div>`:p}
      ${this.confirmPurge?i`<sw-dialog open heading=${r.purgeTitle} data-building-purge-dialog @close=${()=>this.confirmPurge=!1}>
            <p>${r.purgeBody(e?.rows??0)}</p>
            <div slot="footer"><sw-button variant="danger" data-building-purge-confirm @click=${()=>void this.purge()}>${r.purgeConfirm}</sw-button><sw-button @click=${()=>this.confirmPurge=!1}>${r.cancel}</sw-button></div>
          </sw-dialog>`:p}
    </sw-card>`}render(){return this.loadFailed?i`<sw-state-panel state="error" heading=${r.loadFailed} hint=${this.loadFailed} actionLabel=${r.retry} data-building-load-error @action=${()=>this.retry()}></sw-state-panel>`:this.list===null?this.editable?i`<sw-state-panel state="loading" compact heading=${r.loading} data-building-loading></sw-state-panel>`:p:!this.editable&&!this.cfg.enabled?p:i`${this.renderMaster()}${this.cfg.enabled?i`${this.renderSensors(this.list)}${this.renderTimes()}${this.renderHistory()}`:p}`}};g.styles=z`
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
    /* CR-CMP2-SEGMENTED-B-2450: the presence pages' round pill keys (the bordered pill track, 13 px keys; 40 / 44 px under a finger)
       drawn by sw-segmented through its knobs */
    sw-segmented {
      --sw-seg-border: var(--sw-border);
      --sw-seg-radius: var(--sw-r-pill);
      --sw-seg-btn-radius: var(--sw-r-pill);
      --sw-seg-pad: 2px;
      --sw-seg-track: var(--sw-surface-2);
      --sw-seg-h: 28px;
      --sw-seg-fs: var(--sw-fs-sm);
      --sw-seg-fw: var(--sw-fw-regular);
      justify-self: start;
    }
    @media (pointer: coarse) {
      sw-segmented {
        --sw-seg-h: 40px;
        --sw-seg-key-pad: 16px;
      }
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
  `;m([_({type:Boolean})],g.prototype,"editable",2);m([h()],g.prototype,"list",2);m([h()],g.prototype,"rooms",2);m([h()],g.prototype,"cfg",2);m([h()],g.prototype,"hist",2);m([h()],g.prototype,"busy",2);m([h()],g.prototype,"message",2);m([h()],g.prototype,"error",2);m([h()],g.prototype,"confirmPurge",2);m([h()],g.prototype,"filter",2);m([h()],g.prototype,"page",2);m([h()],g.prototype,"editId",2);m([h()],g.prototype,"narrow",2);m([h()],g.prototype,"loadFailed",2);g=m([C("system-building-presence")],g);function N(e,s,t){return e.filter(n=>n.startsWith(`${s}:${t}:`)).map(n=>n.split(":")[2])}function _e(e,s,t){return{sites:e.map(n=>({id:n.id,name:n.name.trim(),lat:Number(n.lat),lon:Number(n.lon),radius_m:Math.round(Number(n.radius_m))})),beacons:s.map(n=>({...n,name:n.name.trim(),uuid:n.uuid.trim().toLowerCase(),major:n.major??null,minor:n.minor??null,floor_id:n.floor_id||null,zone_id:n.zone_id||null})),wifi_sites:t.map(n=>{const l=(n.add_ssids??[]).map(y=>y.trim()).filter(Boolean),{add_ssids:a,...d}=n;return{...d,name:n.name.trim(),floor_id:n.floor_id||null,...l.length?{add_ssids:l}:{}}})}}function ke(e){return Object.keys(S).filter(s=>!(Number.isInteger(e[s])&&e[s]>=S[s][0]&&e[s]<=S[s][1]))}var Se=Object.defineProperty,ze=Object.getOwnPropertyDescriptor,u=(e,s,t,n)=>{for(var l=n>1?void 0:n?ze(s,t):s,a=e.length-1,d;a>=0;a--)(d=e[a])&&(l=(n?d(s,t,l):d(l))||l);return n&&l&&Se(s,t,l),l};const O=e=>`${e}_${Math.random().toString(36).slice(2,10)}`,Ee={coords:"pBadCoords",radius:"pBadRadius",uuid:"pBadUuid",site:"pNoSite",zone:"pZoneNoFloor",ssid:"pNoSsid",max:"pMax"},Ce={immediate:"proxImmediate",near:"proxNear",far:"proxFar"};let b=class extends E{constructor(){super(...arguments),this.bubbleSkin=new q(this),this.settings=null,this.editable=!1,this.sites=[],this.beacons=[],this.wifi=[],this.open=null,this.floors=[],this.zones={},this.busy=!1,this.message="",this.error="",this.source="",this.onFormKey=e=>{e.key==="Escape"&&(e.stopPropagation(),this.open=null)},this.siteName=e=>this.sites.find(s=>s.id===e)?.name||e,this.floorName=e=>e?this.floors.find(s=>s.id===e)?.name??e:""}connectedCallback(){super.connectedCallback(),oe().then(e=>{this.floors=e.sites.flatMap(s=>(s.buildings??[]).flatMap(t=>(t.floors??[]).map(n=>({id:n.id,name:e.sites.length>1||(s.buildings??[]).length>1?`${t.name} · ${n.name}`:n.name}))))}).catch(()=>this.floors=[])}willUpdate(){const e=this.settings,s=e?JSON.stringify([e.sites,e.beacons,e.wifi_sites]):"";if(s!==this.source){this.source=s,this.sites=structuredClone(e?.sites??[]),this.beacons=structuredClone(e?.beacons??[]),this.wifi=structuredClone(e?.wifi_sites??[]),this.open=null;for(const t of this.beacons)t.floor_id&&this.ensureZones(t.floor_id)}}get dirty(){return JSON.stringify([this.sites,this.beacons,this.wifi])!==this.source||this.wifi.some(e=>(e.add_ssids??[]).some(s=>s.trim()))}async ensureZones(e){if(!(!e||this.zones[e]||!R()))try{const s=await ve(e);this.zones={...this.zones,[e]:s.zones.map(t=>({id:t.id,name:t.name||t.id}))}}catch{this.zones={...this.zones,[e]:[]}}}add(e){const s=this.sites[0]?.id??"";e==="site"&&(this.sites=[...this.sites,{id:O("site"),name:"",lat:32.0853,lon:34.7818,radius_m:150}]),e==="beacon"&&(this.beacons=[...this.beacons,{id:O("bcn"),name:"",uuid:"",major:null,minor:null,site_id:s,floor_id:null,zone_id:null}]),e==="wifi"&&(this.wifi=[...this.wifi,{id:O("wifi"),name:"",site_id:s,floor_id:null,ssid_hash_salt:"",ssid_hashes:[],add_ssids:[]}]);const t=e==="site"?this.sites:e==="beacon"?this.beacons:this.wifi;this.open={kind:e,id:t[t.length-1].id},this.message=""}dropItem(e,s){e==="site"&&(this.sites=this.sites.filter(t=>t.id!==s)),e==="beacon"&&(this.beacons=this.beacons.filter(t=>t.id!==s)),e==="wifi"&&(this.wifi=this.wifi.filter(t=>t.id!==s)),this.open?.id===s&&(this.open=null),this.message=""}patchSite(e,s){this.sites=this.sites.map(t=>t.id===e?{...t,...s}:t)}patchBeacon(e,s){this.beacons=this.beacons.map(t=>t.id===e?{...t,...s}:t),s.floor_id&&this.ensureZones(s.floor_id)}patchWifi(e,s){this.wifi=this.wifi.map(t=>t.id===e?{...t,...s}:t)}async save(){this.busy=!0,this.error="";try{const e=await H(_e(this.sites,this.beacons,this.wifi));this.source="",this.dispatchEvent(new CustomEvent("saved",{detail:e.settings})),this.message=o("saved"),window.setTimeout(()=>this.message="",2500)}catch(e){this.error=x(e)}finally{this.busy=!1}}row(e,s,t,n,l){const a=!this.editable||this.busy;return i`<li data-presence-place=${`${e}:${s}`}>
      <span class="lbl"><b>${t||"—"}</b><small>${n}</small>${l.length?i`<span class="bad" data-presence-place-problem>${l.map(d=>o(Ee[d]??"pMax")).join(" · ")}</span>`:p}</span>
      ${this.editable?i`<sw-button size="sm" variant="ghost" icon="edit" iconOnly label=${o("edit")} ?disabled=${a} data-presence-edit=${s} @click=${()=>{this.open=this.open?.id===s?null:{kind:e,id:s}}}></sw-button>
            <sw-button size="sm" variant="ghost" icon="trash" iconOnly label=${o("remove")} ?disabled=${a} data-presence-remove=${s} @click=${()=>this.dropItem(e,s)}></sw-button>`:p}
    </li>`}siteSelect(e,s){return i`<sw-field label=${o("site")}><select .value=${e} data-presence-f="site" @change=${t=>s(t.target.value)}>
      ${this.sites.map(t=>i`<option value=${t.id} ?selected=${t.id===e}>${t.name||t.id}</option>`)}</select></sw-field>`}floorSelect(e,s){return i`<sw-field label=${o("floor")}><select data-presence-f="floor" @change=${t=>s(t.target.value||null)}>
      <option value="" ?selected=${!e}>${o("none")}</option>
      ${this.floors.map(t=>i`<option value=${t.id} ?selected=${t.id===e}>${t.name}</option>`)}</select></sw-field>`}done(){return i`<div class="acts"><sw-button size="sm" data-presence-done @click=${()=>{this.open=null}}>${o("done")}</sw-button></div>`}sitesCard(e){return i`<sw-card heading=${o("sitesTitle")} subheading=${o("sitesSub")} data-presence-sites>
      ${this.editable?i`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy||this.sites.length>=20} data-presence-add="site" @click=${()=>this.add("site")}>${o("add")}</sw-button>`:p}
      ${this.sites.length?i`<ul>${this.sites.map(s=>i`${this.row("site",s.id,s.name,i`<span class="ltr">${Number(s.lat).toFixed(5)}, ${Number(s.lon).toFixed(5)} · ${s.radius_m} m</span>`,N(e,"site",s.id))}
          ${this.open?.kind==="site"&&this.open.id===s.id?i`<form data-presence-form="site" @submit=${t=>t.preventDefault()} @keydown=${this.onFormKey}>
                <sw-field class="wide" label=${o("name")}><input maxlength="80" .value=${s.name} data-presence-f="name" @input=${t=>this.patchSite(s.id,{name:t.target.value})} /></sw-field>
                <sw-field label=${o("lat")}><input type="number" step="0.00001" min="-90" max="90" .value=${String(s.lat)} data-presence-f="lat" @input=${t=>this.patchSite(s.id,{lat:Number(t.target.value)})} /></sw-field>
                <sw-field label=${o("lon")}><input type="number" step="0.00001" min="-180" max="180" .value=${String(s.lon)} data-presence-f="lon" @input=${t=>this.patchSite(s.id,{lon:Number(t.target.value)})} /></sw-field>
                <sw-field label=${o("radius")} hint=${o("rangeHint",{lo:30,hi:5e3})}><input type="number" min="30" max="5000" step="10" .value=${String(s.radius_m)} data-presence-f="radius" @input=${t=>this.patchSite(s.id,{radius_m:Number(t.target.value)})} /></sw-field>
                ${this.done()}</form>`:p}`)}</ul>`:i`<div class="muted">${o("emptySites")}</div>`}
    </sw-card>`}beaconsCard(e){const s=!this.sites.length;return i`<sw-card heading=${o("beaconsTitle")} subheading=${o("beaconsSub")} data-presence-beacons>
      ${this.editable?i`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy||s||this.beacons.length>=100} data-presence-add="beacon" @click=${()=>this.add("beacon")}>${o("add")}</sw-button>`:p}
      ${s&&this.editable?i`<div class="muted">${o("needSite")}</div>`:p}
      ${this.beacons.length?i`<ul>${this.beacons.map(t=>{const n=t.floor_id?this.zones[t.floor_id]??[]:[],l=n.find(d=>d.id===t.zone_id)?.name??"",a=[this.siteName(t.site_id),this.floorName(t.floor_id),l].filter(Boolean).join(" · ");return i`${this.row("beacon",t.id,t.name||t.uuid,a,N(e,"beacon",t.id))}
          ${this.open?.kind==="beacon"&&this.open.id===t.id?i`<form data-presence-form="beacon" @submit=${d=>d.preventDefault()} @keydown=${this.onFormKey}>
                <sw-field label=${o("name")}><input maxlength="80" .value=${t.name} data-presence-f="name" @input=${d=>this.patchBeacon(t.id,{name:d.target.value})} /></sw-field>
                ${this.siteSelect(t.site_id,d=>this.patchBeacon(t.id,{site_id:d}))}
                <sw-field class="wide" label=${o("uuid")}><input class="ltr" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" .value=${t.uuid} data-presence-f="uuid" @input=${d=>this.patchBeacon(t.id,{uuid:d.target.value})} /></sw-field>
                <sw-field label=${o("major")}><input type="number" min="0" max="65535" .value=${t.major===null?"":String(t.major)} data-presence-f="major" @input=${d=>{const y=d.target.value;this.patchBeacon(t.id,{major:y===""?null:Number(y)})}} /></sw-field>
                <sw-field label=${o("minor")}><input type="number" min="0" max="65535" .value=${t.minor===null?"":String(t.minor)} data-presence-f="minor" @input=${d=>{const y=d.target.value;this.patchBeacon(t.id,{minor:y===""?null:Number(y)})}} /></sw-field>
                ${this.floorSelect(t.floor_id,d=>this.patchBeacon(t.id,{floor_id:d,zone_id:null}))}
                <sw-field label=${o("zone")}><select ?disabled=${!t.floor_id} data-presence-f="zone" @change=${d=>this.patchBeacon(t.id,{zone_id:d.target.value||null})}>
                  <option value="" ?selected=${!t.zone_id}>${o("none")}</option>${n.map(d=>i`<option value=${d.id} ?selected=${d.id===t.zone_id}>${d.name}</option>`)}</select></sw-field>
                ${this.done()}</form>`:p}`})}</ul>`:i`<div class="muted">${o("emptyBeacons")}</div>`}
    </sw-card>`}wifiCard(e){const s=!this.sites.length;return i`<sw-card heading=${o("wifiTitle")} subheading=${o("wifiSub")} data-presence-wifi>
      ${this.editable?i`<sw-button slot="actions" size="sm" icon="plus" ?disabled=${this.busy||s||this.wifi.length>=20} data-presence-add="wifi" @click=${()=>this.add("wifi")}>${o("add")}</sw-button>`:p}
      ${s&&this.editable?i`<div class="muted">${o("needSite")}</div>`:p}
      ${this.wifi.length?i`<ul>${this.wifi.map(t=>{const n=(t.add_ssids??[]).filter(a=>a.trim()).length,l=[this.siteName(t.site_id),this.floorName(t.floor_id),o("ssidCount",{n:t.ssid_hashes.length+n})].filter(Boolean).join(" · ");return i`${this.row("wifi",t.id,t.name,l,N(e,"wifi",t.id))}
          ${this.open?.kind==="wifi"&&this.open.id===t.id?i`<form data-presence-form="wifi" @submit=${a=>a.preventDefault()} @keydown=${this.onFormKey}>
                <sw-field class="wide" label=${o("name")}><input maxlength="80" .value=${t.name} data-presence-f="name" @input=${a=>this.patchWifi(t.id,{name:a.target.value})} /></sw-field>
                ${this.siteSelect(t.site_id,a=>this.patchWifi(t.id,{site_id:a}))}
                ${this.floorSelect(t.floor_id,a=>this.patchWifi(t.id,{floor_id:a}))}
                <sw-field class="wide" label=${o("ssids")} hint=${o("ssidsHint")}><textarea class="ltr" autocomplete="off" spellcheck="false" .value=${(t.add_ssids??[]).join(`
`)} data-presence-f="ssids"
                  @input=${a=>this.patchWifi(t.id,{add_ssids:a.target.value.split(`
`).map(d=>d.slice(0,32))})}></textarea></sw-field>
                <div class="acts">${t.ssid_hashes.length?i`<sw-button size="sm" variant="ghost" icon="trash" data-presence-clear-ssids @click=${()=>this.patchWifi(t.id,{ssid_hashes:[]})}>${o("clearSsids")}</sw-button>`:p}
                  <sw-button size="sm" data-presence-done @click=${()=>{this.open=null}}>${o("done")}</sw-button></div></form>`:p}`})}</ul>`:i`<div class="muted">${o("emptyWifi")}</div>`}
    </sw-card>`}render(){const e=le(this.sites,this.beacons,this.wifi);return i`<div class="cards">${this.sitesCard(e)}${this.beaconsCard(e)}${this.wifiCard(e)}</div>
      ${this.editable?i`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-presence-places-save ?disabled=${!this.dirty||this.busy||e.length>0} @click=${()=>void this.save()}>${o("save")}</sw-button>
            ${this.message?i`<span class="ok" role="status" data-presence-places-message>${this.message}</span>`:e.length?i`<span class="err" data-presence-places-state="problems">${e.length===1?c("בעיה אחת מונעת שמירה - היא מסומנת ברשימה"):c("{n} בעיות מונעות שמירה - הן מסומנות ברשימה",{n:e.length})}</span>`:this.dirty?i`<span class="pending" data-presence-places-state="dirty">${c("יש שינויים שלא נשמרו")}</span>`:p}
            ${this.error?i`<span class="err" role="alert" data-presence-places-error>${this.error}</span>`:p}
          </div>`:p}`}};b.styles=[z`
    :host { display: grid; gap: 12px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 12px; align-items: start; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-block-end: 1px solid var(--sw-border); }
    li:last-child { border-block-end: 0; }
    .lbl { flex: 1; min-inline-size: 0; display: grid; gap: 2px; }
    .lbl b { font-weight: var(--sw-fw-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lbl small { color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    ${ne}
    .bad { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); padding: 6px 0; }
    form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; padding: 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); margin-block: 6px; }
    form .wide { grid-column: 1 / -1; }
    form .acts { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
    textarea { min-block-size: 64px; resize: vertical; }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    ${J}
    ${T}
    /* ACCESS-POLISH-2331: why the save button is (not) available - unsaved edits, or the problems that block it */
    .pending { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    @media (max-width: 480px) { form { grid-template-columns: minmax(0, 1fr); } }
  `,L];u([_({attribute:!1})],b.prototype,"settings",2);u([_({type:Boolean})],b.prototype,"editable",2);u([h()],b.prototype,"sites",2);u([h()],b.prototype,"beacons",2);u([h()],b.prototype,"wifi",2);u([h()],b.prototype,"open",2);u([h()],b.prototype,"floors",2);u([h()],b.prototype,"zones",2);u([h()],b.prototype,"busy",2);u([h()],b.prototype,"message",2);u([h()],b.prototype,"error",2);b=u([C("system-presence-places")],b);let $=class extends E{constructor(){super(...arguments),this.bubbleSkin=new q(this),this.settings=null,this.editable=!1,this.draft={...I},this.busy=!1,this.message="",this.error="",this.source=""}willUpdate(){const e=this.settings?.people??I,s=JSON.stringify(e);s!==this.source&&(this.source=s,this.draft={...e})}async save(){this.busy=!0,this.error="";try{const e=await H({people:this.draft});this.dispatchEvent(new CustomEvent("saved",{detail:e.settings})),this.message=o("saved"),window.setTimeout(()=>this.message="",2500)}catch(e){this.error=x(e)}finally{this.busy=!1}}num(e,s){const[t,n]=S[e];return i`<sw-field label=${o(s)} hint=${o("rangeHint",{lo:t,hi:n})}><input type="number" min=${t} max=${n} step="1" .value=${String(this.draft[e])} ?disabled=${!this.editable||this.busy}
      data-presence-people=${e} @input=${l=>{this.draft={...this.draft,[e]:Number(l.target.value)},this.message=""}} /></sw-field>`}render(){const e=this.draft,s=ke(e),t=JSON.stringify(e)!==this.source,n=this.settings?.people_opt_out_count??0;return i`<sw-card heading=${o("screenTitle")} subheading=${o("screenSub")} data-presence-screen>
      <div class="grid">
        ${this.num("stale_minutes","staleMin")}${this.num("beacon_max_age_minutes","beaconAge")}${this.num("wifi_max_age_minutes","wifiAge")}
        <sw-field label=${o("minProximity")}><select ?disabled=${!this.editable||this.busy} data-presence-people="min_proximity"
          @change=${l=>{this.draft={...e,min_proximity:l.target.value}}}>
          ${de.map(l=>i`<option value=${l} ?selected=${l===e.min_proximity}>${o(Ce[l])}</option>`)}</select></sw-field>
        ${this.num("refresh_seconds","refreshSec")}
        <div class="row"><span class="lbl">${o("showNames")}<span class="muted">${o("showNamesHint")}</span></span>
          <sw-toggle ?checked=${e.show_names} ?disabled=${!this.editable||this.busy} label=${o("showNames")} labelHidden data-presence-people="show_names"
            @change=${l=>{this.draft={...e,show_names:l.detail.checked}}}></sw-toggle></div>
        ${n?i`<div class="row muted" data-presence-optout-count>${o("optOutCount",{n})}</div>`:p}
      </div>
      ${this.editable?i`<div class="foot"><sw-button variant="primary" size="sm" icon="check" data-presence-screen-save ?disabled=${!t||this.busy||s.length>0} @click=${()=>void this.save()}>${o("save")}</sw-button>
            ${this.message?i`<span class="ok" role="status">${this.message}</span>`:p}${this.error?i`<span class="err" role="alert">${this.error}</span>`:p}</div>`:p}
    </sw-card>`}};$.styles=[z`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 10px 16px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; grid-column: 1 / -1; border-block-start: 1px solid var(--sw-border); }
    .lbl { display: flex; flex-direction: column; gap: 2px; font-weight: var(--sw-fw-medium); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-regular); }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-block-start: 10px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    ${T}
  `,L];u([_({attribute:!1})],$.prototype,"settings",2);u([_({type:Boolean})],$.prototype,"editable",2);u([h()],$.prototype,"draft",2);u([h()],$.prototype,"busy",2);u([h()],$.prototype,"message",2);u([h()],$.prototype,"error",2);$=u([C("system-presence-screen")],$);var Pe=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,w=(e,s,t,n)=>{for(var l=n>1?void 0:n?Ne(s,t):s,a=e.length-1,d;a>=0;a--)(d=e[a])&&(l=(n?d(s,t,l):d(l))||l);return n&&l&&Pe(s,t,l),l};const Oe=e=>e==="places"||e==="screen"||e==="building"?e:"general",K={enabled:!1,mode:"continuous",interval_s:60,distance_filter_m:50,notice_text:"",notice_version:1,sensors_allowed:[...v],intervals_s:{},sites:[],beacons:[],wifi_sites:[],wifi_match_mode:"phone",retention_days:30,required_sensors:{enabled:!1,sensors:[],hardware_required:[],apply_to_web:!1,max_stale_hours:48,roles:[],users:[],exempt_users:[]},break_glass:{until:null,reason:"",by:null}};let f=class extends E{constructor(){super(...arguments),this.bubbleSkin=new q(this),this.draft=K,this.saved=K,this.canEdit=!1,this.busy=!1,this.message="",this.error="",this.devices=null,this.glassReason="",this.page=Oe(A().params.get("page"))}connectedCallback(){super.connectedCallback(),R()&&(ce().then(e=>{this.saved=e.settings,this.draft=structuredClone(e.settings),this.canEdit=!0}).catch(e=>{this.canEdit=!1,e instanceof Error&&/403|אין הרשאה/.test(e.message)||(this.error=x(e))}),pe("presence.sensors.view")&&he().then(e=>this.devices=e.devices).catch(()=>this.devices=[]))}get dirty(){return JSON.stringify(this.draft)!==JSON.stringify(this.saved)}patch(e){this.draft={...this.draft,...e},this.message=""}toggleSensor(e,s){const t=new Set(this.draft.sensors_allowed);s?t.add(e):t.delete(e),this.patch({sensors_allowed:v.filter(n=>t.has(n))})}toggleRequired(e,s){const t=new Set(this.draft.required_sensors.sensors);s?t.add(e):t.delete(e),this.patch({required_sensors:{...this.draft.required_sensors,sensors:v.filter(n=>t.has(n))}})}toggleHardware(e,s){const t=new Set(this.draft.required_sensors.hardware_required??[]);s?t.add(e):t.delete(e),this.patch({required_sensors:{...this.draft.required_sensors,hardware_required:v.filter(n=>t.has(n))}})}async save(){const e=U(this.draft);if(e&&this.draft.required_sensors.enabled&&this.draft.required_sensors.sensors.length===0){this.error=e;return}this.busy=!0,this.error="";try{const s=this.draft,t=await H({enabled:s.enabled,notice_text:s.notice_text,sensors_allowed:s.sensors_allowed,retention_days:s.retention_days,wifi_match_mode:s.wifi_match_mode??"phone",value_check:W(s.value_check),required_sensors:s.required_sensors});this.saved=t.settings,this.draft=structuredClone(t.settings),this.message=c("ההגדרות נשמרו"),setTimeout(()=>this.message="",2500)}catch(s){this.error=x(s)}finally{this.busy=!1}}async glass(e){this.busy=!0,this.error="";try{const s=await ue(e,this.glassReason);this.saved={...this.saved,break_glass:s.break_glass},this.draft={...this.draft,break_glass:s.break_glass},this.glassReason="",this.message=e?c("הדרישה הושעתה"):c("ההשעיה הסתיימה"),setTimeout(()=>this.message="",2500)}catch(s){this.error=x(s)}finally{this.busy=!1}}renderDevices(){if(this.devices===null)return p;const e=s=>s?G(s):"—";return i`<sw-card heading=${c("מכשירים רשומים")} subheading=${this.devices.length?c("{n} מכשירים",{n:this.devices.length}):c("אין מכשירים רשומים")} data-presence-devices>
      ${this.devices.length?i`<div class="wrap"><table>
            <thead><tr><th>${c("משתמש")}</th><th>${c("מכשיר")}</th><th>${c("משתף")}</th><th>${c("במבנה")}</th><th>${c("דיווח אחרון")}</th><th>${c("התראות")}</th></tr></thead>
            <tbody>${this.devices.map(s=>i`<tr data-presence-device=${s.device_id}>
              <td>${s.user?.display_name??""}</td>
              <td>${s.name}<div class="muted">${s.platform==="ios"?"iPhone":"Android"} · ${s.app_version??""}</div></td>
              <td>${v.filter(t=>s.status.sensors[t]==="on").map(t=>k[t]).join(", ")||"—"}</td>
              <td>${s.presence.inside===!0?c("כן"):s.presence.inside===!1?c("לא"):"—"}</td>
              <td>${e(s.last_event_at??s.last_seen_at)}</td>
              <td>${s.push.registered?c("רשום"):"—"}</td>
            </tr>`)}</tbody>
          </table></div>`:p}
    </sw-card>`}setPage(e){this.page=e;const s=new URLSearchParams(A().params);s.set("tab","mobile"),e==="general"?s.delete("page"):s.set("page",e),ge("/system/diagnostics",s)}adopt(e){const s={sites:e.sites,beacons:e.beacons,wifi_sites:e.wifi_sites,people:e.people,people_opt_out_count:e.people_opt_out_count,notice_version:e.notice_version};this.saved={...this.saved,...s},this.draft={...this.draft,...s}}render(){const e=this.canEdit&&R(),s=i`<sw-segmented data-presence-pages value=${this.page} @change=${t=>this.setPage(t.detail.value)}
      .options=${[{value:"general",label:o("segGeneral"),attrs:{"data-presence-page":"general"}},{value:"places",label:o("segPlaces"),attrs:{"data-presence-page":"places"}},{value:"screen",label:o("segScreen"),attrs:{"data-presence-page":"screen"}},{value:"building",label:r.tab,attrs:{"data-presence-page":"building"}}]}></sw-segmented>`;return this.page==="building"?i`${s}<system-building-presence ?editable=${e}></system-building-presence>`:this.page==="places"?i`${s}<system-presence-places .settings=${this.saved} ?editable=${e} @saved=${t=>this.adopt(t.detail)}></system-presence-places>`:this.page==="screen"?i`${s}<system-presence-screen .settings=${this.saved} ?editable=${e} @saved=${t=>this.adopt(t.detail)}></system-presence-screen>`:i`${s}${this.renderGeneral(e)}`}renderGeneral(e){const s=this.draft,t=s.required_sensors,n=U(s),l=s.break_glass.until?G(s.break_glass.until):null;return i`<sw-card heading=${c("שיתוף נתונים מהאפליקציה")} subheading=${c("כבוי כברירת מחדל; הטלפונים לא אוספים דבר עד ההפעלה")} data-presence-card>
        <div class="row" data-presence-row="enabled"><span class="lbl">${c("שיתוף פעיל")}<span class="muted">${c("מופעל רק אחרי שההודעה לעובדים נשלחה")}</span></span>
          <sw-toggle ?checked=${s.enabled} ?disabled=${!e||this.busy} label=${c("שיתוף פעיל")} labelHidden data-presence-enabled @change=${a=>this.patch({enabled:a.detail.checked})}></sw-toggle></div>
        <div class="row" data-presence-row="sensors"><span class="lbl">${c("חיישנים מאושרים")}<span class="muted">${c("העובד בוחר באפליקציה מתוך הרשימה הזו בלבד")}</span></span></div>
        <div class="grid" data-presence-sensors>${v.map(a=>i`<label class="chk"><input type="checkbox" data-presence-sensor=${a} .checked=${s.sensors_allowed.includes(a)} ?disabled=${!e||this.busy} @change=${d=>this.toggleSensor(a,d.target.checked)} /> ${k[a]}</label>`)}</div>
        <div class="row" data-presence-row="wifi-mode"><span class="lbl">${c("התאמת Wi-Fi לאתר")}<span class="muted">${c('בטלפון: הטלפון שולח רק "מחובר לרשת אתר"; בשרת: הטלפון שולח גיבוב של שם הרשת והשרת משווה')}</span></span>
          <sw-field><select data-presence-wifi-mode ?disabled=${!e||this.busy} @change=${a=>this.patch({wifi_match_mode:a.target.value})}>
            <option value="phone" ?selected=${(s.wifi_match_mode??"phone")==="phone"}>${c("בטלפון (ברירת מחדל)")}</option>
            <option value="server" ?selected=${s.wifi_match_mode==="server"}>${c("בשרת (גיבוב)")}</option>
          </select></sw-field></div>
        <div class="row" data-presence-row="value-check"><span class="lbl">${o("valueCheck")}<span class="muted">${o("valueCheckHint")}</span></span>
          <sw-segmented label=${o("valueCheck")} data-presence-value-check value=${W(s.value_check)} ?disabled=${!e||this.busy} @change=${a=>this.patch({value_check:a.detail.value})}
      .options=${me.map(a=>({value:a,label:o(`valueCheck_${a}`),attrs:{"data-v":a}}))}></sw-segmented></div>
        <div class="row" data-presence-row="notice"><span class="lbl">${c("הודעה לעובדים")}<span class="muted">${c("גרסה {n}; שינוי בטקסט מעלה את הגרסה וכל מכשיר מאשר מחדש",{n:s.notice_version})}</span></span></div>
        <textarea data-presence-notice placeholder=${c("טקסט ההודעה לעובדים (ניסוח משפטי של בעל המערכת)")} .value=${s.notice_text} ?disabled=${!e||this.busy} @input=${a=>this.patch({notice_text:a.target.value})}></textarea>
        <div class="row" data-presence-row="retention"><span class="lbl">${c("שמירת יומן הדיווחים")}</span>
          <sw-field><select data-presence-retention ?disabled=${!e||this.busy} @change=${a=>this.patch({retention_days:Number(a.target.value)})}>
            ${be.map(a=>i`<option value=${a} ?selected=${s.retention_days===a}>${c("{n} ימים",{n:a})}</option>`)}
          </select></sw-field></div>
      </sw-card>
      <sw-card heading=${c("חיישנים נדרשים לשימוש מהאפליקציה")} subheading=${c("מי שלא הפעיל חיישן נדרש לא ייכנס מהאפליקציה; מנהלי מערכת לעולם לא נחסמים")} data-presence-policy>
        <div class="row" data-presence-row="policy"><span class="lbl">${c("הדרישה פעילה")}<span class="muted">${c("חלה על הפעלות מהאפליקציה בלבד, אלא אם סומן אחרת")}</span></span>
          <sw-toggle ?checked=${t.enabled} ?disabled=${!e||this.busy} label=${c("הדרישה פעילה")} labelHidden data-presence-policy-enabled @change=${a=>this.patch({required_sensors:{...t,enabled:a.detail.checked}})}></sw-toggle></div>
        <div class="grid" data-presence-required>${v.map(a=>i`<label class="chk"><input type="checkbox" data-presence-required-sensor=${a} .checked=${t.sensors.includes(a)} ?disabled=${!e||this.busy||!t.enabled} @change=${d=>this.toggleRequired(a,d.target.checked)} /> ${k[a]}</label>`)}</div>
        <div class="row" data-presence-row="hardware"><span class="lbl">${c("חומרה שחובה בשרת זה")}</span></div>
        <div class="grid" data-presence-hardware>${v.map(a=>i`<label class="chk"><input type="checkbox" data-presence-hardware-sensor=${a} .checked=${(t.hardware_required??[]).includes(a)} ?disabled=${!e||this.busy||!t.enabled} @change=${d=>this.toggleHardware(a,d.target.checked)} /> ${k[a]}</label>`)}</div>
        <div class="row" data-presence-row="web"><span class="lbl">${c("גם בדפדפן")}<span class="muted">${c("משתמש בלי האפליקציה ייחסם גם בדפדפן")}</span></span>
          <sw-toggle ?checked=${t.apply_to_web} ?disabled=${!e||this.busy||!t.enabled} label=${c("גם בדפדפן")} labelHidden data-presence-policy-web @change=${a=>this.patch({required_sensors:{...t,apply_to_web:a.detail.checked}})}></sw-toggle></div>
        ${n&&t.enabled?i`<div class="warn" role="status" data-presence-policy-problem>${n}</div>`:p}
        ${e?i`<div class="row" data-presence-row="glass"><span class="lbl">${c("השעיה זמנית")}<span class="muted">${l?`${c("מושעה עד {time}",{time:l})}${this.saved.break_glass.reason?` · ${this.saved.break_glass.reason}`:""}`:c("פותח את הכניסה לכולם ל־24 שעות, עם סיבה")}</span></span>
              <span class="glass">${l?i`<sw-button size="sm" data-presence-glass-end ?disabled=${this.busy} @click=${()=>void this.glass(0)}>${c("סיים השעיה")}</sw-button>`:i`<input type="text" data-presence-glass-reason placeholder=${c("סיבה")} maxlength="200" .value=${this.glassReason} @input=${a=>this.glassReason=a.target.value} /><sw-button size="sm" data-presence-glass ?disabled=${this.busy||this.glassReason.trim().length<3} @click=${()=>void this.glass(24)}>${c("השעה ל־24 שעות")}</sw-button>`}</span></div>`:p}
        ${e?i`<div class="foot">
              <sw-button variant="primary" size="sm" icon="check" data-presence-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${c("שמור")}</sw-button>
              ${this.message?i`<span class="ok" role="status" data-presence-message>${this.message}</span>`:p}
              ${this.error?i`<span class="err" role="alert" data-presence-error>${this.error}</span>`:p}
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
    ${T}
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
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      text-align: start;
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: top;
    }
    th {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-xs);
      letter-spacing: 0.03em;
      background: var(--sw-surface-2);
    }
    td {
      font-variant-numeric: tabular-nums;
    }
    td:first-child {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .wrap {
      overflow-x: auto;
    }
    /* CR-CMP2-SEGMENTED-B-2450: the presence pages' round pill keys (the bordered pill track, 13 px keys; 40 / 44 px under a finger)
       drawn by sw-segmented through its knobs */
    sw-segmented {
      --sw-seg-border: var(--sw-border);
      --sw-seg-radius: var(--sw-r-pill);
      --sw-seg-btn-radius: var(--sw-r-pill);
      --sw-seg-pad: 2px;
      --sw-seg-track: var(--sw-surface-2);
      --sw-seg-h: 28px;
      --sw-seg-fs: var(--sw-fs-sm);
      --sw-seg-fw: var(--sw-fw-regular);
      justify-self: start;
    }
    @media (pointer: coarse) {
      sw-segmented {
        --sw-seg-h: 44px;
        --sw-seg-key-pad: 16px;
      }
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
  `,L];w([h()],f.prototype,"draft",2);w([h()],f.prototype,"saved",2);w([h()],f.prototype,"canEdit",2);w([h()],f.prototype,"busy",2);w([h()],f.prototype,"message",2);w([h()],f.prototype,"error",2);w([h()],f.prototype,"devices",2);w([h()],f.prototype,"glassReason",2);w([h()],f.prototype,"page",2);f=w([C("system-presence")],f);
