import{a as g,j as m,R as u,qQ as t,e as r,A as c,qB as f,E as b,G as n,H as w}from"./index-D0R90ECk.js";import{l as y}from"./live-DxVDUJSK.js";import{t as _,f as k,p as x,g as C,h as S,i as v,r as T,j as F,m as H,e as E}from"./model-CYW8vJkq.js";import{n as q}from"./styles-CKN3oTRS.js";import"./sw-logo-art-Va6y_cIM.js";var z=Object.defineProperty,A=Object.getOwnPropertyDescriptor,d=(s,a,i,e)=>{for(var o=e>1?void 0:e?A(a,i):a,h=s.length-1,p;h>=0;h--)(p=s[h])&&(o=(e?p(a,i,o):p(o))||o);return e&&o&&z(a,i,o),o};let l=class extends g{constructor(){super(...arguments),this.s=null,this.error="",this.forbidden=!1,this.toast="",this.cities=[],this.city="",this.q="",this.code="",this.results=null,this.busy=!1,this.refreshing=!1,this.toastTimer=0,this.pollTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.toastTimer),clearInterval(this.pollTimer)}say(s){this.toast=s,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await _(),this.forbidden=!1,this.loadCities()}catch(s){s instanceof m&&s.status===403?this.forbidden=!0:this.error=u(s)}}async loadCities(){try{this.cities=(await k()).cities}catch{this.cities=[]}}async save(s,a=t("saved")){this.busy=!0;try{this.s=await x(s),this.say(a)}catch(i){this.say(u(i)||t("saveError"))}finally{this.busy=!1}}async runSearch(){const s=this.code.trim()||this.q.trim();if(!this.city&&!s){this.results=[];return}try{const a=await C(this.city,s);this.results=a.stops,this.s&&(this.s={...this.s,catalogue:a.catalogue})}catch(a){this.say(u(a))}}async addStop(s){const a=this.s.config,i=S(a.stops,s.code,this.s.limits.max_stops);if(i!=="dup"){if(i==="full")return this.say(t("limit"));await this.save({stops:[...v(a.stops),{code:s.code,name:""}]},t("added"))}}async refreshCatalogue(){this.refreshing=!0;try{await T()}catch(s){return this.refreshing=!1,this.say(u(s))}clearInterval(this.pollTimer),this.pollTimer=window.setInterval(async()=>{try{const s=await F();this.s&&(this.s={...this.s,catalogue:s.catalogue,health:s.health}),(s.catalogue.ok_at!==this.s?.catalogue.ok_at||!!s.catalogue.error||s.catalogue.count>0)&&(this.refreshing=!1,clearInterval(this.pollTimer),this.loadCities())}catch{}},3e3)}render(){if(this.forbidden)return r`<sw-page heading=${t("title")}><sw-state-panel state="forbidden" heading=${t("forbidden")} hint=${t("forbiddenHint")}></sw-state-panel></sw-page>`;if(this.error&&!this.s)return r`<sw-page heading=${t("title")}><sw-state-panel state="error" heading=${t("loadError")} hint=${this.error} actionLabel=${t("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.s)return r`<sw-page heading=${t("title")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const s=this.s.can.configure;return r`<sw-page heading="" data-transit-settings>
      <div class="top"><div><h1>${t("title")}</h1><p class="sub">${t("sub")}</p></div></div>
      <div class="stack">
        ${this.moduleCard(s)}
        <div class="two">${this.stopsCard(s)}${s?this.searchCard():c}</div>
        <div class="two">${this.rulesCard(s)}${this.refreshCard(s)}</div>
        ${this.catalogueCard(s)}
        ${this.healthCard()}
      </div></sw-page>${this.toast?r`<div class="toast" role="status">${this.toast}</div>`:c}`}moduleCard(s){const a=this.s.config.enabled;return r`<div class="panel" data-transit-module><div class="hd"><h2>${t("moduleCard")}</h2><span class="sp"></span>
      <sw-toggle .checked=${a} ?disabled=${!s||this.busy} label=${a?t("moduleOn"):t("moduleOff")} data-transit-switch
        @change=${i=>this.save({enabled:i.detail.checked})}></sw-toggle></div>
      <p class="hint">${t("moduleHint")}</p></div>`}stopsCard(s){const{config:a,limits:i}=this.s;return r`<div class="panel" data-transit-stops><div class="hd"><h2>${t("stopsCard")}</h2><span class="chip num">${a.stops.length} / ${i.max_stops}</span></div>
      <p class="hint">${t("stopsHint",{n:i.max_stops})}</p>
      ${a.stops.length===0?r`<p class="mut" data-stops-empty>${t("stopsEmpty")}</p>`:a.stops.map((e,o)=>r`<div class="stop" data-stop=${e.code}>
        <span class="chip num ltr">${e.code}</span>
        <div class="fld"><input class="inp" maxlength="60" aria-label=${t("displayName")} placeholder=${e.catalogue_name||t("displayName")} .value=${e.name} ?disabled=${!s}
          @change=${h=>this.rename(o,h.target.value)}><span class="code">${e.city||""}</span></div>
        ${s?r`<div class="acts"><sw-button size="sm" variant="ghost" ?disabled=${o===0||this.busy} @click=${()=>this.move(o,-1)}>${t("up")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${o===a.stops.length-1||this.busy} @click=${()=>this.move(o,1)}>${t("down")}</sw-button>
          <sw-button size="sm" variant="ghost" data-remove-stop=${e.code} ?disabled=${this.busy} @click=${()=>this.removeStop(o)}>${t("remove")}</sw-button></div>`:c}
      </div>`)}</div>`}rename(s,a){const i=v(this.s.config.stops);i[s]={...i[s],name:a},this.save({stops:i})}move(s,a){this.save({stops:v(H(this.s.config.stops,s,a))})}removeStop(s){this.save({stops:v(this.s.config.stops.filter((a,i)=>i!==s))})}searchCard(){const{catalogue:s,config:a,limits:i}=this.s;return r`<div class="panel" data-transit-search><div class="hd"><h2>${t("searchCard")}</h2></div>
      ${s.count===0?r`<p class="hint">${t("catalogueEmpty")}</p>`:r`<div class="form" @keydown=${e=>e.key==="Enter"&&this.runSearch()}>
        <div class="r">
          <div class="fld"><label for="tr-city">${t("city")}</label><select id="tr-city" class="inp" data-v=${this.city} .value=${this.city} @change=${e=>this.city=e.target.value}>
            <option value="">${t("cityAny")}</option>${this.cities.map(e=>r`<option value=${e} ?selected=${e===this.city}>${e}</option>`)}</select></div>
          <div class="fld"><label for="tr-q">${t("nameFilter")}</label><input id="tr-q" class="inp" maxlength="60" .value=${this.q} @input=${e=>this.q=e.target.value}></div>
          <div class="fld"><label for="tr-code">${t("codeFilter")}</label><input id="tr-code" class="inp ltr" inputmode="numeric" maxlength="8" .value=${this.code} @input=${e=>this.code=e.target.value}></div>
        </div>
        <div><sw-button variant="primary" icon="search" data-transit-search-btn @click=${()=>this.runSearch()}>${t("search")}</sw-button></div>
        ${this.results===null?c:this.results.length===0?r`<p class="mut">${t("noResults")}</p>`:r`<div class="res" data-transit-results>${this.results.map(e=>r`<div class="row" data-result=${e.code}>
          <div><b>${e.name}</b><span>${e.city} · ${t("stopCode",{c:e.code})}</span></div>
          <sw-button size="sm" ?disabled=${this.busy||a.stops.length>=i.max_stops||a.stops.some(o=>o.code===e.code)} @click=${()=>this.addStop(e)}>
            ${a.stops.some(o=>o.code===e.code)?t("added"):t("add")}</sw-button></div>`)}</div>
          ${this.results.length>=40?r`<p class="hint">${t("resultsMore")}</p>`:c}`}
      </div>`}</div>`}numField(s,a,i,e,o,h="minutes"){const p=this.s.config[s];return r`<div class="fld"><label for=${"tr-"+s}>${t(a)}</label>
      <div class="sum"><input id=${"tr-"+s} class="inp short num" type="number" min=${e[0]} max=${e[1]} step="1" .value=${y(String(p))} ?disabled=${!o||this.busy} data-field=${s}
        @change=${$=>this.saveNumber(s,E($.target.value,e[0],e[1],p))}><span class="mut">${t(h)}</span></div>
      <span class="hint">${t(i)}</span></div>`}saveNumber(s,a){const i=this.s.config;s==="poll_s"&&a<this.s.limits.poll_floor_s&&!i.poll_floor_ack&&(a=this.s.limits.poll_floor_s),this.save({[s]:a})}refreshCard(s){const{config:a,limits:i}=this.s;return r`<div class="panel" data-transit-refresh><div class="hd"><h2>${t("refreshCard")}</h2></div><div class="form">
      ${this.numField("refresh_s","refreshS","refreshSHint",i.refresh_range,s,"seconds")}
      ${this.numField("poll_s","pollS","pollSHint",i.poll_range,s,"seconds")}
      <label class="ck"><input type="checkbox" data-field="poll_floor_ack" .checked=${a.poll_floor_ack} ?disabled=${!s||this.busy}
        @change=${e=>this.save({poll_floor_ack:e.target.checked,...e.target.checked||a.poll_s>=i.poll_floor_s?{}:{poll_s:i.poll_floor_s}})}>${t("pollAck")}</label>
      ${this.numField("position_fresh_min","positionFresh","positionFreshHint",i.position_fresh_range,s)}
      <label class="ck"><input type="checkbox" data-field="show_distance" .checked=${a.show_distance} ?disabled=${!s||this.busy}
        @change=${e=>this.save({show_distance:e.target.checked})}>${t("showDistance")}</label>
      <span class="hint">${t("showDistanceHint")}</span>
    </div></div>`}rulesCard(s){const a=this.s.limits;return r`<div class="panel" data-transit-rules><div class="hd"><h2>${t("generalCard")}</h2></div><div class="form">
      ${this.numField("clock_after_min","clockAfter","clockAfterHint",a.clock_after_range,s)}
      ${this.numField("stale_grace_min","grace","graceHint",a.grace_range,s)}
      ${this.numField("hide_closer_min","hideCloser","hideCloserHint",a.walk_range,s)}
      ${this.numField("outage_warn_h","outageWarn","outageWarnHint",a.outage_warn_range,s,"hours")}
    </div></div>`}catalogueCard(s){const a=this.s.catalogue;return r`<div class="panel" data-transit-catalogue><div class="hd"><h2>${t("catalogueCard")}</h2><span class="sp"></span>
      ${s?r`<sw-button size="sm" data-refresh-catalogue ?disabled=${this.refreshing} @click=${()=>this.refreshCatalogue()}>${this.refreshing?t("refreshing"):t("refreshNow")}</sw-button>`:c}</div>
      ${a.count===0?r`<p class="hint">${t("catalogueEmpty")}</p>`:r`<p class="sum num">${t("catalogueInfo",{n:a.count,d:a.date??""})}</p>`}
      <p class="hint">${t("catalogueNightly")}</p>
      ${a.error?r`<div class="alert">${t("catalogueError",{e:a.error})}</div>`:c}</div>`}healthCard(){const s=this.s.health,a=s.state==="ok"?"ok":s.state==="off"?"off":s.state==="stale"?"warn":"alarm",i=s.age_s===null?t("never"):t("ageMin",{n:Math.floor(s.age_s/60)});return r`<div class="panel" data-transit-health><div class="hd"><h2>${t("healthCard")}</h2><span class="badge state" data-look=${a} data-health=${s.state}>${t("st_"+s.state)}</span></div>
      <dl class="kv"><dt>${t("lastOk")}</dt><dd class=${s.last_ok_at?"num ltr":""}>${s.last_ok_at?s.last_ok_at.replace("T"," ").replace("Z",""):t("never")}</dd>
        <dt>${t("dataAge")}</dt><dd>${i}</dd><dt>${t("codesInUse")}</dt><dd class="num">${s.codes_in_use}</dd>
        <dt>${t("errorsCount")}</dt><dd class="num">${s.errors}</dd>
        ${s.last_error?r`<dt>${t("lastError")}</dt><dd class="ltr">${s.last_error}</dd>`:c}
        ${s.backoff_until?r`<dt></dt><dd class="mut">${t("backoff")}</dd>`:c}</dl></div>`}};l.styles=[f,q,b`
      .stack { display: grid; gap: 14px; }
      .stop { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 0; border-block-end: 1px solid var(--sw-border); }
      .stop:last-child { border-block-end: 0; }
      .stop .code { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
      .stop .acts { display: flex; gap: 6px; }
      .res { display: grid; gap: 0; max-block-size: 320px; overflow: auto; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); }
      .res .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 12px; border-block-end: 1px solid var(--sw-border); }
      .res .row:last-child { border-block-end: 0; }
      .res .row b { display: block; font-weight: var(--sw-fw-medium); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .res .row span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
      .state { display: inline-flex; align-items: center; gap: 6px; }
      .alert { display: flex; gap: 8px; align-items: flex-start; margin-block-start: 8px; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-warning-soft); color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
    `];d([n()],l.prototype,"s",2);d([n()],l.prototype,"error",2);d([n()],l.prototype,"forbidden",2);d([n()],l.prototype,"toast",2);d([n()],l.prototype,"cities",2);d([n()],l.prototype,"city",2);d([n()],l.prototype,"q",2);d([n()],l.prototype,"code",2);d([n()],l.prototype,"results",2);d([n()],l.prototype,"busy",2);d([n()],l.prototype,"refreshing",2);l=d([w("system-transit")],l);export{l as SystemTransit};
//# sourceMappingURL=system-transit-Dj0VsAr-.js.map
