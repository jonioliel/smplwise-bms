import{a as y,eK as _,c as x,q as u,b as r,A as h,ae as f,eD as b,j as C,k as d,m as S}from"./index-CoJbESCx.js";import{a as z}from"./settings-xDM-ttq5.js";import{l as T}from"./live-Cd6o5F1x.js";import{t as E,a as H,p as N,b as t,s as F,c as D,d as g,r as A,e as M,m as q,f as O,g as P,h as k}from"./model-ByGiS2-s.js";import{n as L}from"./styles-Bu-UUb1F.js";import"./sw-logo-art-PLtEZJxU.js";var j=Object.defineProperty,I=Object.getOwnPropertyDescriptor,c=(s,e,i,a)=>{for(var o=a>1?void 0:a?I(e,i):e,p=s.length-1,l;p>=0;p--)(l=s[p])&&(o=(a?l(e,i,o):l(o))||o);return a&&o&&j(e,i,o),o};let n=class extends y{constructor(){super(...arguments),this.s=null,this.error="",this.forbidden=!1,this.toast="",this.cities=[],this.city="",this.q="",this.code="",this.results=null,this.busy=!1,this.refreshing=!1,this.checking=!1,this.check=null,this.checkError="",this.toastTimer=0,this.poll=new _(this)}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.toastTimer),this.poll.cancel("catalogue")}say(s){this.toast=s,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await E(),this.forbidden=!1,this.loadCities()}catch(s){s instanceof x&&s.status===403?this.forbidden=!0:this.error=u(s)}}async loadCities(){try{this.cities=(await H()).cities}catch{this.cities=[]}}async save(s,e=t("saved")){this.busy=!0;try{this.s=await N(s),this.say(e)}catch(i){this.say(u(i)||t("saveError"))}finally{this.busy=!1}}async runSearch(){const s=this.code.trim()||this.q.trim();if(!this.city&&!s){this.results=[];return}try{const e=await F(this.city,s);this.results=e.stops,this.s&&(this.s={...this.s,catalogue:e.catalogue})}catch(e){this.say(u(e))}}async addStop(s){const e=this.s.config,i=D(e.stops,s.code,this.s.limits.max_stops);if(i!=="dup"){if(i==="full")return this.say(t("limit"));await this.save({stops:[...g(e.stops),{code:s.code,name:""}]},t("added"))}}async refreshCatalogue(){this.refreshing=!0;try{await A()}catch(s){return this.refreshing=!1,this.say(u(s))}this.poll.every("catalogue",3e3,async()=>{try{const s=await M();this.s&&(this.s={...this.s,catalogue:s.catalogue,health:s.health}),(s.catalogue.ok_at!==this.s?.catalogue.ok_at||!!s.catalogue.error||s.catalogue.count>0)&&(this.refreshing=!1,this.poll.cancel("catalogue"),this.loadCities())}catch{}})}render(){if(this.forbidden)return r`<sw-page heading=${t("title")}><sw-state-panel state="forbidden" heading=${t("forbidden")} hint=${t("forbiddenHint")}></sw-state-panel></sw-page>`;if(this.error&&!this.s)return r`<sw-page heading=${t("title")}><sw-state-panel state="error" heading=${t("loadError")} hint=${this.error} actionLabel=${t("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.s)return r`<sw-page heading=${t("title")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const s=this.s.can.configure;return r`<sw-page heading="" data-transit-settings>
      <div class="top"><div><h1>${t("title")}</h1><p class="sub">${t("sub")}</p></div></div>
      <div class="stack">
        ${this.moduleCard(s)}
        <div class="two">${this.stopsCard(s)}${s?this.searchCard():h}</div>
        <div class="two">${this.rulesCard(s)}${this.refreshCard(s)}</div>
        ${this.catalogueCard(s)}
        ${this.healthCard()}
      </div></sw-page>${this.toast?r`<div class="toast" role="status">${this.toast}</div>`:h}`}moduleCard(s){const e=this.s.config.enabled;return r`<div class="panel" data-transit-module><div class="hd"><h2>${t("moduleCard")}</h2><span class="sp"></span>
      <sw-toggle controlled .checked=${e} ?disabled=${!s||this.busy} label=${e?t("moduleOn"):t("moduleOff")} data-transit-switch
        @change=${i=>this.save({enabled:i.detail.checked})}></sw-toggle></div>
      <p class="hint">${t("moduleHint")}</p></div>`}stopsCard(s){const{config:e,limits:i}=this.s;return r`<div class="panel" data-transit-stops><div class="hd"><h2>${t("stopsCard")}</h2><span class="chip num">${e.stops.length} / ${i.max_stops}</span></div>
      <p class="hint">${t("stopsHint",{n:i.max_stops})}</p>
      ${e.stops.length===0?r`<p class="mut" data-stops-empty>${t("stopsEmpty")}</p>`:e.stops.map((a,o)=>r`<div class="stop" data-stop=${a.code}>
        <span class="chip num ltr">${a.code}</span>
        <div class="fld"><input class="inp" maxlength="60" aria-label=${t("displayName")} placeholder=${a.catalogue_name||t("displayName")} .value=${a.name} ?disabled=${!s}
          @change=${p=>this.rename(o,p.target.value)}><span class="code">${a.city||""}</span></div>
        ${s?r`<div class="acts"><sw-button size="sm" variant="ghost" ?disabled=${o===0||this.busy} @click=${()=>this.move(o,-1)}>${t("up")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${o===e.stops.length-1||this.busy} @click=${()=>this.move(o,1)}>${t("down")}</sw-button>
          <sw-button size="sm" variant="ghost" data-remove-stop=${a.code} ?disabled=${this.busy} @click=${()=>this.removeStop(o)}>${t("remove")}</sw-button></div>`:h}
      </div>`)}</div>`}rename(s,e){const i=g(this.s.config.stops);i[s]={...i[s],name:e},this.save({stops:i})}move(s,e){this.save({stops:g(q(this.s.config.stops,s,e))})}removeStop(s){this.save({stops:g(this.s.config.stops.filter((e,i)=>i!==s))})}searchCard(){const{catalogue:s,config:e,limits:i}=this.s;return r`<div class="panel" data-transit-search><div class="hd"><h2>${t("searchCard")}</h2></div>
      ${s.count===0?r`<p class="hint">${t("catalogueEmpty")}</p>`:r`<div class="form" @keydown=${a=>a.key==="Enter"&&this.runSearch()}>
        <div class="r">
          <div class="fld"><label for="tr-city">${t("city")}</label><sw-field><select id="tr-city" class="inp" data-v=${this.city} .value=${this.city} @change=${a=>this.city=a.target.value}>
            <option value="">${t("cityAny")}</option>${this.cities.map(a=>r`<option value=${a} ?selected=${a===this.city}>${a}</option>`)}</select></sw-field></div>
          <div class="fld"><label for="tr-q">${t("nameFilter")}</label><input id="tr-q" class="inp" maxlength="60" .value=${this.q} @input=${a=>this.q=a.target.value}></div>
          <div class="fld"><label for="tr-code">${t("codeFilter")}</label><input id="tr-code" class="inp ltr" inputmode="numeric" maxlength="8" .value=${this.code} @input=${a=>this.code=a.target.value}></div>
        </div>
        <div><sw-button variant="primary" icon="search" data-transit-search-btn @click=${()=>this.runSearch()}>${t("search")}</sw-button></div>
        ${this.results===null?h:this.results.length===0?r`<p class="mut">${t("noResults")}</p>`:r`<div class="res" data-transit-results>${this.results.map(a=>r`<div class="row" data-result=${a.code}>
          <div><b>${a.name}</b><span>${a.city} · ${t("stopCode",{c:a.code})}</span></div>
          <sw-button size="sm" ?disabled=${this.busy||e.stops.length>=i.max_stops||e.stops.some(o=>o.code===a.code)} @click=${()=>this.addStop(a)}>
            ${e.stops.some(o=>o.code===a.code)?t("added"):t("add")}</sw-button></div>`)}</div>
          ${this.results.length>=40?r`<p class="hint">${t("resultsMore")}</p>`:h}`}
      </div>`}</div>`}numField(s,e,i,a,o,p="minutes"){const l=this.s.config[s];return r`<div class="fld"><label for=${"tr-"+s}>${t(e)}</label>
      <div class="sum"><input id=${"tr-"+s} class="inp short num" type="number" min=${a[0]} max=${a[1]} step="1" .value=${T(String(l))} ?disabled=${!o||this.busy} data-field=${s}
        @change=${m=>this.saveNumber(s,O(m.target.value,a[0],a[1],l))}><span class="mut">${t(p)}</span></div>
      <span class="hint">${t(i)}</span></div>`}saveNumber(s,e){const i=this.s.config;s==="poll_s"&&e<this.s.limits.poll_floor_s&&!i.poll_floor_ack&&(e=this.s.limits.poll_floor_s),this.save({[s]:e})}refreshCard(s){const{config:e,limits:i}=this.s;return r`<div class="panel" data-transit-refresh><div class="hd"><h2>${t("refreshCard")}</h2></div><div class="form">
      ${this.numField("refresh_s","refreshS","refreshSHint",i.refresh_range,s,"seconds")}
      ${this.numField("poll_s","pollS","pollSHint",i.poll_range,s,"seconds")}
      <label class="ck"><sw-toggle controlled size="sm" labelHidden in-label label=${t("pollAck")} data-field="poll_floor_ack" .checked=${e.poll_floor_ack} ?disabled=${!s||this.busy}
        @change=${a=>this.save({poll_floor_ack:f(a),...f(a)||e.poll_s>=i.poll_floor_s?{}:{poll_s:i.poll_floor_s}})}></sw-toggle>${t("pollAck")}</label>
      ${this.numField("position_fresh_min","positionFresh","positionFreshHint",i.position_fresh_range,s)}
      <label class="ck"><sw-toggle controlled size="sm" labelHidden in-label label=${t("showDistance")} data-field="show_distance" .checked=${e.show_distance} ?disabled=${!s||this.busy}
        @change=${a=>this.save({show_distance:f(a)})}></sw-toggle>${t("showDistance")}</label>
      <span class="hint">${t("showDistanceHint")}</span>
    </div></div>`}rulesCard(s){const e=this.s.limits;return r`<div class="panel" data-transit-rules><div class="hd"><h2>${t("generalCard")}</h2></div><div class="form">
      ${this.numField("clock_after_min","clockAfter","clockAfterHint",e.clock_after_range,s)}
      ${this.numField("stale_grace_min","grace","graceHint",e.grace_range,s)}
      ${this.numField("hide_closer_min","hideCloser","hideCloserHint",e.walk_range,s)}
      ${this.numField("outage_warn_h","outageWarn","outageWarnHint",e.outage_warn_range,s,"hours")}
    </div></div>`}catalogueCard(s){const e=this.s.catalogue;return r`<div class="panel" data-transit-catalogue><div class="hd"><h2>${t("catalogueCard")}</h2><span class="sp"></span>
      ${s?r`<sw-button size="sm" data-refresh-catalogue ?disabled=${this.refreshing} @click=${()=>this.refreshCatalogue()}>${this.refreshing?t("refreshing"):t("refreshNow")}</sw-button>`:h}</div>
      ${e.count===0?r`<p class="hint">${t("catalogueEmpty")}</p>`:r`<p class="sum num">${t("catalogueInfo",{n:e.count,d:e.date??""})}</p>`}
      <p class="hint">${t("catalogueNightly")}</p>
      ${e.error?r`<div class="alert">${t("catalogueError",{e:e.error})}</div>`:h}</div>`}async runCheck(){this.checking=!0,this.checkError="";try{const s=await P();this.check=s.check,this.s&&(this.s={...this.s,health:s.health})}catch(s){this.check=null,this.checkError=u(s)}finally{this.checking=!1}}healthCard(){const s=this.s.health,e=this.s.can.configure,i=s.state==="ok"?"ok":s.state==="off"?"off":s.state==="stale"||s.state==="source_down"?"warn":"alarm",a=s.age_s===null?t("never"):t("ageMin",{n:Math.floor(s.age_s/60)}),o=s.state==="off"||s.codes_in_use===0,p=s.last_good_at??s.last_ok_at,l=this.check,m=this.checkError?r`<p class="res-line" data-look="alarm" role="alert" data-transit-check-result="refused">${this.checkError}</p>`:l?r`<p class="res-line" role="status" data-transit-check-result=${l.skipped??(l.ok?"ok":"failed")}
            data-look=${l.ok?"ok":l.skipped==="no_stops"?"off":l.skipped?"warn":"alarm"}>${l.skipped==="no_stops"?t("checkNoStops"):l.skipped==="retry_after"?t("checkWait",{ago:v(l.retry_after_s??60)}):l.ok?t("checkOk",{n:l.fetched}):t("checkFail",{e:$(l.error)})} <span class="mut">${t("checkedAt",{t:B(l.at)})}</span></p>`:h;return r`<div class="panel" data-transit-health><div class="hd"><h2>${t("healthCard")}</h2><span class="badge state" data-look=${i} data-health=${s.state}>${t("st_"+s.state)}</span>
        <span class="sp"></span>
        ${e?r`<sw-button size="sm" icon="refresh" data-transit-check ?disabled=${this.checking} @click=${()=>void this.runCheck()}>${this.checking?t("checking"):t("checkNow")}</sw-button>`:h}</div>
      ${o?r`<p class="note" data-transit-idle>${t("idleNote")}</p>`:h}
      <dl class="kv"><dt>${t("lastGood")}</dt><dd class=${p?"num":""} data-transit-last-good>${p?`${W(p)} · ${t("agoOnly",{ago:v(w(p))})}`:t("never")}</dd>
        ${o?h:r`<dt>${t("dataAge")}</dt><dd>${a}</dd>`}<dt>${t("codesInUse")}</dt><dd class="num">${s.codes_in_use}</dd>
        <dt>${t("errorsCount")}</dt><dd class="num">${s.errors}</dd>
        ${s.last_error?r`<dt>${t("lastError")}</dt><dd data-transit-last-error>${s.last_error_at?t("errorAgo",{ago:v(w(s.last_error_at)),e:$(s.last_error)}):$(s.last_error)}</dd>`:h}
        ${s.backoff_until&&!o?r`<dt></dt><dd class="mut">${t("backoff")}</dd>`:h}</dl>
      ${m}</div>`}};n.styles=[z,L,C`
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
      .note { margin: 0 0 8px; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .res-line { margin: 8px 0 0; font-size: var(--sw-fs-sm); }
      .res-line[data-look='ok'] { color: var(--sw-success-text); }
      .res-line[data-look='warn'] { color: var(--sw-warning-text); }
      .res-line[data-look='alarm'] { color: var(--sw-danger-text); }
      /* POLISH4-WP8 (D16): the two-card rows never force a card wider than a narrow screen; a long source error or time wraps in its cell */
      .two { grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); }
      .kv dd { min-inline-size: 0; overflow-wrap: anywhere; }
      .stop .fld { min-inline-size: 0; }
      @media (pointer: coarse) {
        .inp { min-block-size: 44px; }
        .ck { min-block-size: 44px; }
      }
      /* the phone: a stop is two lines - its code and display name, then the order and remove keys - so the name field keeps its width
         (three keys beside it squeezed it to a sliver); the toast clears the bottom bar */
      @media (max-width: 767px) {
        .stop { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: 'code name' 'acts acts'; row-gap: 6px; }
        .stop > .chip { grid-area: code; }
        .stop > .fld { grid-area: name; }
        .stop > .acts { grid-area: acts; justify-content: flex-end; flex-wrap: wrap; }
        .kv { grid-template-columns: minmax(0, max-content) minmax(0, 1fr); }
        .toast { inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 16px + env(safe-area-inset-bottom, 0px)); max-inline-size: calc(100% - 32px); }
      }
    `];c([d()],n.prototype,"s",2);c([d()],n.prototype,"error",2);c([d()],n.prototype,"forbidden",2);c([d()],n.prototype,"toast",2);c([d()],n.prototype,"cities",2);c([d()],n.prototype,"city",2);c([d()],n.prototype,"q",2);c([d()],n.prototype,"code",2);c([d()],n.prototype,"results",2);c([d()],n.prototype,"busy",2);c([d()],n.prototype,"refreshing",2);c([d()],n.prototype,"checking",2);c([d()],n.prototype,"check",2);c([d()],n.prototype,"checkError",2);n=c([S("system-transit")],n);function w(s){const e=Date.parse(s);return Number.isFinite(e)?Math.max(0,Math.round((Date.now()-e)/1e3)):0}function v(s){const e=Math.max(1,Math.round(s/60));if(e<60)return e===1?t("agoMinute"):t("agoMinutes",{n:e});const i=Math.round(e/60);if(i<48)return i===1?t("agoHour"):t("agoHours",{n:i});const a=Math.round(i/24);return a===1?t("agoDay"):t("agoDays",{n:a})}function $(s){if(!s)return"";if(s==="http_503")return t("err_http_503");const e=/^http_(\d{3})$/.exec(s);return e?t("err_http",{c:e[1]}):s==="unreachable"?t("err_unreachable"):t("err_other",{c:s})}function W(s){const e=new Date(s);return Number.isNaN(e.getTime())?s:e.toLocaleString(b(k()),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}function B(s){const e=new Date(s);return Number.isNaN(e.getTime())?s:e.toLocaleTimeString(b(k()),{hour:"2-digit",minute:"2-digit"})}export{n as SystemTransit};
