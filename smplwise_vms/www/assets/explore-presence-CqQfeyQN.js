import{hE as m,hF as t,i as g,aL as x,cy as k,a2 as u,hG as y,n as w,aB as $,s as f,a3 as _,A as h,b as i,hH as z,aA as E,aU as S,bi as P,bj as C,g as O,j as p,k as D}from"./index-koYOOmpL.js";import"./sw-plan-canvas-6sAyRYNz.js";import"./sw-logo-art-PLtEZJxU.js";import"./map-CpZHEE-n.js";import"./shared-space-B5gxCFOQ.js";import"./zones-xVC1H7NQ.js";import"./candidates-bDi5UGz8.js";function b(a,e=Date.now()){const r=Math.max(0,Math.round((e-Date.parse(a))/6e4));return!Number.isFinite(r)||r<1?t("agoNow"):r<60?t("agoMin",{n:r}):t("agoHour",{n:Math.round(r/60)})}function F(a,e){return e&&a.some(r=>r.floor_id===e)?e:a.length?[...a].sort((r,s)=>s.count-r.count)[0].floor_id:null}function L(a,e){if(!a)return[];const r=m(e);return a.zones.map(s=>{const n=r.get(s.id)??0;return{id:s.id,name:n?t("zoneCount",{name:s.name,n}):s.name,kind:s.kind,color:n?"var(--sw-accent)":"var(--sw-border-strong, var(--sw-border))",polygon:s.polygon,labelPos:s.label_pos}})}var T=Object.defineProperty,I=Object.getOwnPropertyDescriptor,d=(a,e,r,s)=>{for(var n=s>1?void 0:s?I(e,r):e,o=a.length-1,c;o>=0;o--)(c=a[o])&&(n=(s?c(e,r,n):c(n))||n);return s&&n&&T(e,r,n),n};const M={beacon:"srcBeacon",wifi:"srcWifi",geofence:"srcGeofence"},A={beacon:"signal",wifi:"wifi",geofence:"map"},B="#/system/diagnostics?tab=mobile",v="#/system/diagnostics?tab=mobile&page=places",H={enabled:!0,generated_at:new Date().toISOString(),configured:{sites:1,beacons:2,wifi_sites:1},settings:{show_names:!0,refresh_seconds:30,stale_minutes:30,beacon_max_age_minutes:10,wifi_max_age_minutes:15,min_proximity:"near"},people:[{user_id:"u1",name:"דנה לוי",source:"beacon",at:new Date(Date.now()-6e4).toISOString(),site_id:"site_main",site_name:"המשרד",floor_id:"f0",floor_name:"קומה 0",zone_id:null,zone_name:""},{user_id:"u2",name:"יוסי כהן",source:"wifi",at:new Date(Date.now()-24e4).toISOString(),site_id:"site_main",site_name:"המשרד",floor_id:"f0",floor_name:"קומה 0",zone_id:null,zone_name:""},{user_id:"u3",name:"רות אברהם",source:"geofence",at:new Date(Date.now()-6e5).toISOString(),site_id:"site_main",site_name:"המשרד",floor_id:null,floor_name:"",zone_id:null,zone_name:""}],floors:[{floor_id:"f0",name:"קומה 0",level:0,building:"מבנה א",count:2,zones:[]},{floor_id:"f-1",name:"קומה 1-",level:-1,building:"מבנה א",count:0,zones:[]}],sites:[{site_id:"site_main",name:"המשרד",count:1}],totals:{inside:3,named:3,hidden:0,on_floors:2,site_only:1}};let l=class extends g{constructor(){super(...arguments),this.bubbleSkin=new x(this),this.data=null,this.error="",this.floor=null,this.kpi="all",this.query="",this.bundle=null,this.mapError="",this.phoneView="map",this.busy=!1,this.bundleFor=""}connectedCallback(){super.connectedCallback(),this.stopSession=k(()=>{this.requestUpdate(),!this.data&&!this.busy&&this.load()})}disconnectedCallback(){window.clearTimeout(this.timer),this.stopSession?.(),super.disconnectedCallback()}schedule(){window.clearTimeout(this.timer);const a=(this.data?.settings.refresh_seconds??30)*1e3;this.timer=window.setTimeout(()=>{document.visibilityState==="visible"?this.load():this.schedule()},a)}async load(){if(this.allowed()){this.busy=!0;try{this.data=u()?await y():H,this.error="",this.floor=F(this.data.floors,this.floor),this.loadBundle()}catch(a){this.error=w(a)}finally{this.busy=!1,this.isConnected&&this.schedule()}}}async loadBundle(){const a=this.floor;if(!(!a||a===this.bundleFor)){this.bundleFor=a,this.bundle=null,this.mapError="";try{const e=await $(a);this.floor===a&&(this.bundle=e)}catch(e){this.floor===a&&(this.mapError=w(e))}}}allowed(){return f.mode==="loading"?null:f.mode==="demo"?!0:u()&&_("presence.view")}chooseFloor(a){this.floor=a,this.loadBundle()}kpis(a){const e=a.totals,r=(s,n,o)=>i`<button type="button" class="kpi" data-k=${s} data-presence-kpi=${s} aria-pressed=${String(this.kpi===s)}
      @click=${()=>{this.kpi=this.kpi===s&&s!=="all"?"all":s}}><span class="dot" aria-hidden="true"></span><div><b>${n}</b><span class="l">${t(o)}</span></div></button>`;return i`<div class="kpis" role="group" aria-label=${t("title")}>
      ${r("all",e.inside,"kpiInside")}${r("floors",e.on_floors,"kpiFloors")}${r("site",e.site_only,"kpiSite")}
      ${e.hidden?i`<div class="kpi" data-k="hidden" data-presence-kpi="hidden" title=${t("hiddenNote",{n:e.hidden})}><span class="dot" aria-hidden="true"></span><div><b>${e.hidden}</b><span class="l">${t("kpiHidden")}</span></div></div>`:h}
    </div>`}mapPanel(a){const e=a.floors.find(o=>o.floor_id===this.floor),r=L(this.bundle,e),s=e?e.zones.reduce((o,c)=>o+c.count,0):0,n=!!this.bundle&&(this.bundle.planStatus!=="none"||!!this.bundle.planSvg);return i`<section class="panel mappanel" data-presence-map>
      ${a.floors.length?i`<div class="chips" role="group" aria-label=${t("floorFilter")} data-presence-floors>${a.floors.map(o=>i`<button type="button" aria-pressed=${String(o.floor_id===this.floor)}
            data-presence-floor=${o.floor_id} @click=${()=>this.chooseFloor(o.floor_id)}>${o.name}<span class="n">${o.count}</span></button>`)}</div>`:h}
      <div class="stage">
        ${a.floors.length?this.mapError?i`<div class="center">${this.mapError}</div>`:this.bundle?n?i`<sw-plan-canvas alwaysLabel .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .plan=${this.bundle.planSvg} .imageUrl=${this.bundle.imageUrl}
                    .markers=${[]} .zones=${r} dimEntities></sw-plan-canvas>`:i`<div class="center">${t("noPlan")}</div>`:i`<div class="center skl" data-state="loading"></div>`:i`<div class="center">${t("noFloors")}</div>`}
        ${e?i`<span class="note" data-presence-floor-note>${t("onFloor",{n:e.count})}${e.count>s?` · ${t("unplaced",{n:e.count-s})}`:""}</span>`:h}
      </div>
    </section>`}shown(a){const e=a.people.filter(r=>this.kpi==="all"||(this.kpi==="floors"?!!r.floor_id:!r.floor_id));return z(e,"",this.query)}listPanel(a){if(!a.settings.show_names)return i`<section class="panel listpanel" data-presence-list>
        <div class="lhead"><h2>${t("listTitle")}</h2><small>${t("countsOnly")}</small></div>
        <div class="counts" data-presence-counts>
          ${a.floors.filter(s=>s.count).map(s=>i`<div><span>${s.name}</span><b>${s.count}</b></div>`)}
          ${a.sites.map(s=>i`<div><span>${s.name} · ${t("siteOnly")}</span><b>${s.count}</b></div>`)}
        </div>
      </section>`;const e=this.shown(a),r=Date.now();return i`<section class="panel listpanel" data-presence-list>
      <div class="lhead"><h2>${t("listTitle")}</h2><small data-presence-count>${t("listCount",{n:e.length})}</small></div>
      <input type="search" .value=${this.query} placeholder=${t("search")} aria-label=${t("search")} data-presence-search
        @input=${s=>{this.query=s.target.value}} />
      ${e.length?i`<ul data-presence-people>${e.map(s=>i`<li data-presence-person=${s.user_id}>
            <span class="av" aria-hidden="true">${s.name.trim().slice(0,1)}</span>
            <span class="who"><b>${s.name}</b><small>${[s.floor_name||s.site_name||t("siteOnly"),s.zone_name].filter(Boolean).join(" · ")}</small></span>
            <span class="src" title=${t(M[s.source])}><sw-icon name=${A[s.source]} size="12"></sw-icon>${b(s.at,r)}</span>
          </li>`)}</ul>`:i`<div class="muted" data-presence-list-empty>${t("listEmpty")}</div>`}
      ${a.totals.hidden?i`<div class="muted" data-presence-hidden-note>${t("hiddenNote",{n:a.totals.hidden})}</div>`:h}
    </section>`}render(){const a=this.allowed();if(a===null)return i`<div class="skl" style="block-size:160px" data-state="loading"></div>`;if(!a)return i`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;const e=this.data,r=!u()||E("system.configure"),s=e?e.enabled?t("subtitle",{n:e.totals.inside,ago:b(e.generated_at)}):t("subtitleOff"):"",n=i`<div class="meta" slot="actions">
        <button type="button" class="btn" data-presence-refresh ?disabled=${this.busy} @click=${()=>void this.load()}><sw-icon name="refresh" size="16"></sw-icon>${t("refresh")}</button>
        ${r?i`<a class="btn" href=${v} data-presence-places><sw-icon name="system" size="16"></sw-icon>${t("places")}</a>`:h}
      </div>`,o=c=>i`<sw-page heading=${t("title")} subheading=${s} data-presence-sub=${s}>${n}${c}</sw-page>`;return e?e.enabled?!e.configured.sites&&!e.configured.beacons&&!e.configured.wifi_sites?o(i`<div class="empty" data-state="no-places"><div class="art"><sw-icon name="map" size="34"></sw-icon></div><h2>${t("noPlacesTitle")}</h2><p>${t("noPlacesBody")}</p>
        ${r?i`<a href=${v} data-presence-places-empty>${t("noPlacesLink")}</a>`:h}</div>`):o(i`${this.kpis(e)}
      <sw-segmented data-presence-seg label=${`${t("mapView")} / ${t("listView")}`} value=${this.phoneView} @change=${c=>{this.phoneView=c.detail.value}}
        .options=${[{value:"map",label:t("mapView")},{value:"list",label:t("listView")}]}></sw-segmented>
      <div class="body" data-view=${this.phoneView}>${this.mapPanel(e)}${this.listPanel(e)}</div>`):o(i`<div class="empty" data-state="off"><div class="art"><sw-icon name="users" size="34"></sw-icon></div><h2>${t("offTitle")}</h2><p>${t("offBody")}</p>
        ${r?i`<a href=${B} data-presence-settings>${t("offLink")}</a>`:h}</div>`):this.error?o(i`<sw-state-panel state="error" heading=${t("loadError")} hint=${this.error} data-state="error"></sw-state-panel>`):o(i`<div class="skl" style="block-size:160px" data-state="loading"></div>`)}};l.styles=[O`
    /* AUDIT30-I4 (#6, #8): the page frame is the product's <sw-page> (its padding, its title on the --sw-h1 tokens instead of a local
       30 / 700 H1, the subtitle line, the actions at the end of the title row); the host only gives it the height of the screen */
    :host {
      display: flex; flex-direction: column; inline-size: 100%; box-sizing: border-box; min-block-size: 0; overflow: hidden;
    }
    sw-page { flex: 1; min-block-size: 0; padding-block-end: 14px; gap: 12px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px; block-size: 34px; padding: 0 12px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border);
      background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; text-decoration: none;
    }
    .btn:focus-visible, .kpi:focus-visible, .chips button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; flex: none; }
    .kpi {
      display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface);
      border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); font: inherit; color: inherit; text-align: start; cursor: pointer; --c: var(--sw-accent);
    }
    .kpi[aria-pressed='true'] { border-color: var(--c); box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 35%, transparent); }
    .kpi .dot { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 18%, transparent); }
    .kpi b { display: block; font-size: var(--sw-fs-2xl); line-height: 1; font-variant-numeric: tabular-nums; }
    .kpi span.l { font-size: var(--sw-fs-state); color: var(--sw-text-2); }
    .kpi[data-k='floors'] { --c: var(--sw-live); }
    .kpi[data-k='site'] { --c: var(--sw-warning); }
    .kpi[data-k='hidden'] { --c: var(--sw-text-3); cursor: default; }
    .body { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 14px; }
    .panel {
      min-block-size: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface);
      border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); overflow: hidden;
    }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex: none; }
    .chips button {
      border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text-2); border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit;
      font-size: var(--sw-fs-sm); cursor: pointer; display: inline-flex; gap: 6px; align-items: center;
    }
    /* DOMUS-DEFAULT-2439: the product's one selected chip (styles/chip-selected.ts) and its check mark */
    .chips button[aria-pressed='true'] { ${P} }
    .chips button[aria-pressed='true']::before { ${C} }
    .chips .n { font-variant-numeric: tabular-nums; color: var(--sw-text-3); }
    .chips button[aria-pressed='true'] .n { color: inherit; }
    .stage { position: relative; flex: 1; min-block-size: 0; border-radius: var(--sw-r-md); overflow: hidden; background: var(--sw-map-bg); }
    .stage sw-plan-canvas { block-size: 100%; min-block-size: 0; }
    .stage .note {
      position: absolute; inset-inline-start: 10px; inset-block-end: 10px; padding: 4px 10px; border-radius: var(--sw-r-pill); background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong); font-size: var(--sw-fs-sm); color: var(--sw-text-2); box-shadow: var(--sw-shadow-1);
    }
    .stage .center { position: absolute; inset: 0; display: grid; place-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); text-align: center; padding: 16px; }
    .lhead { display: flex; align-items: baseline; gap: 8px; flex: none; }
    .lhead h2 { margin: 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-semibold); }
    .lhead small { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    input[type='search'] {
      flex: none; block-size: 34px; padding: 0 10px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm); background: var(--sw-surface-2);
      color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); min-inline-size: 0;
    }
    input[type='search']:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    ul { list-style: none; margin: 0; padding: 0; overflow: auto; flex: 1; min-block-size: 0; overscroll-behavior: contain; }
    li { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-block-end: 1px solid var(--sw-border); }
    li:last-child { border-block-end: 0; }
    .av {
      inline-size: 30px; block-size: 30px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--sw-accent-soft);
      color: var(--sw-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold);
    }
    .who { flex: 1; min-inline-size: 0; display: grid; gap: 1px; }
    .who b { font-weight: var(--sw-fw-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who small { color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .src { display: inline-flex; align-items: center; gap: 4px; color: var(--sw-text-3); font-size: var(--sw-fs-xs); flex: none; text-align: end; }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .counts { display: grid; gap: 6px; overflow: auto; flex: 1; min-block-size: 0; }
    .counts div { display: flex; justify-content: space-between; gap: 8px; padding: 6px 4px; border-block-end: 1px solid var(--sw-border); }
    .counts b { font-variant-numeric: tabular-nums; }
    .empty { display: grid; justify-items: center; align-content: center; gap: 10px; text-align: center; padding: 24px 16px; flex: 1; min-block-size: 0; }
    .empty .art { inline-size: 72px; block-size: 72px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-accent-soft); color: var(--sw-accent); }
    .empty h2 { margin: 0; font-size: var(--sw-fs-xl); }
    .empty p { margin: 0; max-inline-size: 520px; color: var(--sw-text-2); }
    .empty a { color: var(--sw-accent-text); }
    .skl { border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
    /* CR-CMP2-SEGMENTED-C-2450: the phone's map / list switch is sw-segmented; it keeps its bordered pill track on surface 2, the small
       regular label and the chosen key in the text ink */
    sw-segmented[data-presence-seg] {
      display: none;
      --sw-seg-border: var(--sw-border);
      --sw-seg-track: var(--sw-surface-2);
      --sw-seg-radius: var(--sw-r-pill);
      --sw-seg-btn-radius: var(--sw-r-pill);
      --sw-seg-pad: 2px;
      --sw-seg-h: 28px;
      --sw-seg-fs: var(--sw-fs-sm);
      --sw-seg-fw: var(--sw-fw-regular);
      --sw-seg-on-fw: var(--sw-fw-semibold);
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-text));
    }
    @media (max-width: 900px) {
      .body { grid-template-columns: minmax(0, 1fr); }
      sw-segmented[data-presence-seg] { display: inline-flex; align-self: flex-start; }
      .body[data-view='map'] .listpanel, .body[data-view='list'] .mappanel { display: none; }
    }
    @media (max-width: 600px) {
      sw-page { gap: 10px; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .kpi { padding: 8px 10px; }
      .kpi b { font-size: var(--sw-fs-xl); }
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the counters carry display digits (26/700) and the pressed counter is a FILLED
       field in its own colour (not a 2 px ring); the map panel is the hero (large radius, shadow 2), the people rows are wells with a
       600 name; press feedback on pointer-down for the counters, the chips and the keys; hover only with a fine pointer. */
    .kpi {
      border-radius: var(--sw-r-lg); padding: 12px 16px;
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;
    }
    .kpi b { font-size: var(--sw-fs-3xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); letter-spacing: -0.02em; }
    .kpi span.l { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); }
    /* loop 2: the unpressed counters are WELLS (surface 2, no edge, no shadow) so the pressed one - a filled field in its colour with a 2 px edge
       and shadow 2 - is the one hero; the dot grows to 14 px */
    .kpi { background: var(--sw-surface-2); border: 2px solid transparent; box-shadow: none; }
    .kpi .dot { inline-size: 14px; block-size: 14px; }
    .kpi[aria-pressed='true'] { background: color-mix(in srgb, var(--c) 16%, var(--sw-surface)); border-color: var(--c); box-shadow: var(--sw-shadow-2); }
    .stage { --sw-map-bg: var(--sw-surface-3); }
    @media (hover: hover) and (pointer: fine) { .kpi:not([aria-pressed='true']):not([data-k='hidden']):hover { background: var(--sw-surface-3); } }
    .kpi:active:not([data-k='hidden']), .chips button:active, .btn:active { transform: scale(var(--sw-press-scale)); }
    .chips button, .btn { transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease); -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    /* POLISH4 WP6 (D12): the button hover joins the fine-pointer gate (it was ungated with a (hover: none) undo) */
    @media (hover: hover) and (pointer: fine) { .btn:hover { background: var(--sw-surface-2); } }
    .panel { border-radius: var(--sw-r-lg); }
    .body > .panel:first-child { box-shadow: var(--sw-shadow-2); }
    .lhead h2 { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    ul { display: grid; gap: 6px; align-content: start; }
    li { padding: 8px 10px; border-block-end: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
    .who b { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .counts div { padding: 8px 10px; border-block-end: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
    .counts b { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .empty h2 { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .empty .art { background: var(--sw-surface-2); color: var(--sw-text-2); }
  `,S];d([p()],l.prototype,"data",2);d([p()],l.prototype,"error",2);d([p()],l.prototype,"floor",2);d([p()],l.prototype,"kpi",2);d([p()],l.prototype,"query",2);d([p()],l.prototype,"bundle",2);d([p()],l.prototype,"mapError",2);d([p()],l.prototype,"phoneView",2);d([p()],l.prototype,"busy",2);l=d([D("explore-presence")],l);export{l as ExplorePresence};
