import{g as _,E as M,a as V,aA as S,by as F,i as $,ar as W,j as L,R as B,r as H,A as d,e as a,av as O,l as E,G as p,H as U}from"./index-CcnB1Mea.js";import"./sw-table-D7oaCHnK.js";import{g as K,b as G,c as J,d as Y}from"./access-stations-C7MaZHcp.js";import"./sw-week-grid-BQ_gBu_w.js";import{T as k,s as R,P as Z,d as D,p as I,i as Q,a as t,b,f as X,c as ee,C as se,e as te,g as ae,h as ie,j as ne,k as oe,l as re,t as le,m as de,n as ce,o as he}from"./schedules-logic-rdplUl0d.js";import"./sw-logo-art-Va6y_cIM.js";import"./intercom-DGQVBNNQ.js";import"./wiskey-format-B1C9aa4N.js";const pe=()=>_("access-control/schedules"),we=()=>_("access-control/schedules/plans"),ue=()=>_("access-control/schedules/operations"),fe=M`
  :host {
    display: block;
    --sch-hit: var(--sw-touch-desktop, 44px);
  }
  @media (max-width: 1100px) {
    :host {
      --sch-hit: 44px;
    }
  }
  .status {
    margin: 0;
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-md);
    background: var(--sw-stale-soft);
    color: var(--sw-stale-text);
    font-size: var(--sw-fs-sm);
  }
  .layout {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    gap: var(--sw-s-4);
    align-items: start;
    margin-block-start: var(--sw-s-3);
  }
  .layout.solo {
    grid-template-columns: minmax(0, 1fr);
  }
  .doorcol {
    position: sticky;
    inset-block-start: var(--sw-s-3);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-4);
    min-inline-size: 0;
  }

  /* ---- the door list (a card on a desktop, a sheet on a phone) ---- */
  nav.doors {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sw-s-2);
  }
  .doors .ttl {
    padding: var(--sw-s-2) var(--sw-s-3) var(--sw-s-1);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-3);
  }
  .doors .station {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: var(--sw-s-2) var(--sw-s-3) 0;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  .dot {
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--sw-live);
  }
  .dot.off {
    background: var(--sw-offline);
  }
  .doors button {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--sch-hit);
    padding-inline: var(--sw-s-3) var(--sw-s-3);
    padding-inline-start: var(--sw-s-5);
    border: 0;
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    text-align: start;
    cursor: pointer;
  }
  /* R5-SECURITY: a hover only under a fine pointer; the chosen door is a filled accent field, 700; the row sinks on pointer-down */
  @media (hover: hover) and (pointer: fine) {
    .doors button:hover {
      background: var(--sw-hover-wash);
    }
  }
  .doors button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  .doors button:active {
    transform: scale(var(--sw-press-scale));
  }
  .doors button[aria-current='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font-weight: var(--sw-fw-bold);
  }
  .doors .station {
    color: var(--sw-heading, var(--sw-text));
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
  }
  sw-badge {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
    line-height: 18px;
    padding-block: 2px;
  }
  .doors button .name {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip {
    box-sizing: border-box;
    display: none;
    align-items: center;
    gap: var(--sw-s-2);
    max-inline-size: 100%;
    min-block-size: var(--sch-hit);
    padding-inline: var(--sw-s-4);
    border: 1px solid var(--sw-accent);
    border-radius: var(--sw-r-pill);
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
  }
  .chip .name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doors button:focus-visible,
  .chip:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }

  /* ---- the door ---- */
  .doorhead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .doorhead h2 {
    margin: 0;
    min-inline-size: 0;
    /* R5-SECURITY: the door is the heading of the page's main column - 20/800 */
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--sw-heading);
    overflow-wrap: anywhere;
  }
  .doorhead .sub {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .doorhead .sp {
    flex: 1;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    padding: var(--sw-s-4);
    min-inline-size: 0;
  }
  .bh {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .bh h3 {
    margin: 0;
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .bh .n {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .bh .sp {
    flex: 1;
  }
  .prog {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .prog .name {
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
    overflow-wrap: anywhere;
  }
  .row .t {
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
  }
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .dates h4 {
    margin: 0 0 var(--sw-s-1);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  sw-week-grid {
    max-inline-size: 100%;
  }

  /* ---- the library and the proposals ---- */
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sw-s-4);
    margin-block-start: var(--sw-s-4);
  }
  sw-table {
    margin-block-start: var(--sw-s-3);
  }
  .rows {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--sw-s-3);
    padding-block: var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
  }
  .row:first-child {
    border-block-start: 0;
  }
  .row .main {
    flex: 1;
    gap: 2px;
  }
  .row .t {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
    overflow-wrap: anywhere;
  }
  .row .s {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .row sw-badge {
    flex: none;
  }

  @media (max-width: 1100px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 819px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .doorcol {
      display: none;
    }
    .chip {
      display: inline-flex;
    }
    /* the door chip already names the door on a phone: the title would repeat it */
    .doorhead h2 {
      display: none;
    }
    .block {
      padding: var(--sw-s-3);
    }
  }
`;var me=Object.defineProperty,ge=Object.getOwnPropertyDescriptor,h=(e,s,n,i)=>{for(var o=i>1?void 0:i?ge(s,n):s,r=e.length-1,w;r>=0;r--)(w=e[r])&&(o=(i?w(s,n,o):w(o))||o);return i&&o&&me(s,n,o),o};const T="sw.wiskey.schedules.view",ve=3e4,y={state:"loading",data:null,at:0,fresh:!0,fetchedAt:null},u=(e,s=null)=>({state:e,data:s,at:Date.now(),fresh:!0,fetchedAt:null});function be(e){try{return localStorage.getItem(e)}catch{return null}}function ye(e,s){try{localStorage.setItem(e,s)}catch{}}const x={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},q={kind:"iana",name:"Asia/Jerusalem"},P={loaded:!0,model:null,firmware:null,capabilities:null,clock:null,event_status:null,scanned_at:null,scanning:!1,reconciled_at:null,last_poll_ms:null},$e=[{id:"d1",name:"שער ראשי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"שער"}],has_camera:!1,camera_entity:null,last_seen:null,zone:q,technical:P,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!1,camera_entity:null,last_seen:null,zone:q,technical:P,errors:null}],g=[{start:"07:00",end:"09:00"}],ke={d1:{programs:[],saved:[],timezone:"Asia/Jerusalem",native_supported:!1},d2:{programs:[{door:1,revision:1,enabled:!0,removing:!1,policy:{timezone:"Asia/Jerusalem",name:"בוקר",weekly:{Sunday:g,Monday:g,Tuesday:g,Wednesday:g,Thursday:g},holidays:[]},execution:{owned:!1,attempted:null,status:"idle"},error:null,checked_at:null}],saved:[],timezone:"Asia/Jerusalem",native_supported:!1}};let c=class extends V{constructor(){super(...arguments),this.feed=null,this.error="",this.access={screen:!0,library:!0,edit:!1},this.wanted=null,this.view=be(T)==="table"?"table":"door",this.narrow=typeof window<"u"&&window.innerWidth<k,this.sheet=!1,this.programs={},this.codes={},this.library=y,this.plans=y,this.ops=y,this.features={},this.stopSession=null,this.stopRoute=null,this.poll=0,this.loading=!1,this.loadAgain=!1,this.inFlight=new Set,this.featuresRead=!1,this.mq=typeof matchMedia=="function"?matchMedia(`(max-width: ${k-1}px)`):null,this.onMedia=()=>{this.narrow=window.innerWidth<k},this.onVisible=()=>{document.hidden||this.load()}}connectedCallback(){super.connectedCallback(),this.mq?.addEventListener("change",this.onMedia),this.wanted=S().params.get("door"),this.stopRoute=F(e=>this.onRoute(e)),$()&&(this.stopSession=W(()=>{this.access=R(E,O)}),this.access=R(E,O),this.access.screen&&(this.load(),this.poll=window.setInterval(()=>{document.hidden||this.load()},Z),document.addEventListener("visibilitychange",this.onVisible)))}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMedia),this.stopRoute?.(),this.stopRoute=null,this.stopSession?.(),this.stopSession=null,window.clearInterval(this.poll),document.removeEventListener("visibilitychange",this.onVisible)}onRoute(e){if(e.mode!=="wiskey")return;const s=e.params.get("door");s!==this.wanted&&(this.wanted=s,this.loadNeeded())}demo(){return!$()}stations(){return this.demo()?$e:this.feed?.stations??[]}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{this.feed=await K(),this.error=""}catch(e){e instanceof L&&e.status===403?this.access={...this.access,screen:!1}:this.error=B(e)}await this.readFeatures(),await this.loadNeeded(),await this.loadLibrary()}while(this.loadAgain)}finally{this.loading=!1}}async readFeatures(){if(!this.featuresRead)try{const e=await G();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([s,n])=>[s,n.available])),this.featuresRead=!0}catch{}}needed(){const e=D(this.stations());if(this.effectiveView()==="table")return[...new Set(e.map(n=>n.stationId))];const s=I(e,this.wanted);return s?[s.stationId]:[]}async loadNeeded(){if(!this.demo())for(const e of this.needed()){const s=Math.min(this.programs[e]?.at??0,this.codes[e]?.at??0);Date.now()-s<ve||await this.loadStation(e)}}classify(e,s,n){const i=Date.now();if(e.state==="ready"&&s!==null&&s!==void 0)return{state:"ready",data:s,at:i,fresh:e.fresh!==!1,fetchedAt:e.fetched_at};const o=e.state==="unsupported"?"unsupported":Q(e.last_error)?"busy":"error";return o==="unsupported"?u(o):{state:o,data:n?.data??null,at:i,fresh:!1,fetchedAt:n?.fetchedAt??null}}failed(e,s){return e instanceof L&&(e.status===403||e.status===404)?u("forbidden"):{state:"error",data:s?.data??null,at:Date.now(),fresh:!1,fetchedAt:s?.fetchedAt??null}}async loadStation(e){if(!this.inFlight.has(e)){this.inFlight.add(e);try{if(this.features.door_programs===!1)this.programs={...this.programs,[e]:u("unsupported")};else{this.programs[e]||(this.programs={...this.programs,[e]:y});try{const s=await J(e);this.programs={...this.programs,[e]:this.classify(s,s.programs,this.programs[e])}}catch(s){this.programs={...this.programs,[e]:this.failed(s,this.programs[e])}}}if(this.features.public_codes===!1)this.codes={...this.codes,[e]:u("unsupported")};else try{const s=await Y(e);this.codes={...this.codes,[e]:this.classify(s,s.codes,this.codes[e])}}catch(s){this.codes={...this.codes,[e]:this.failed(s,this.codes[e])}}}finally{this.inFlight.delete(e)}}}async loadLibrary(){if(this.demo()||!this.access.library)return;const e=async(s,n,i)=>{if(this.features[s]===!1)return u("unsupported");try{const o=await n();return this.classify(o,o.schedules,i)}catch(o){return this.failed(o,i)}};if(this.library=await e("schedules",pe,this.library),this.library.state==="forbidden"){this.plans=u("forbidden"),this.ops=u("forbidden");return}this.plans=await e("schedule_plans",we,this.plans),this.ops=await e("schedule_operations",ue,this.ops)}effectiveView(){return this.narrow?"door":this.view}setView(e){this.view=e,ye(T,e),this.loadNeeded()}pick(e){if(this.sheet=!1,this.wanted===e&&this.effectiveView()==="door")return;this.wanted=e,this.view==="table"&&this.setView("door");const s=S();if(s.mode==="wiskey"){const n=new URLSearchParams(s.params);n.set("door",e),H(s.path,n)}this.loadNeeded()}refresh(){this.programs=Object.fromEntries(Object.entries(this.programs).map(([e,s])=>[e,{...s,at:0}])),this.codes=Object.fromEntries(Object.entries(this.codes).map(([e,s])=>[e,{...s,at:0}])),this.load()}zoneOf(e){return this.stations().find(s=>s.id===e)?.zone??this.feed?.default_zone??null}programsOf(e){return this.demo()?u("ready",ke[e]??null):this.programs[e]}codesOf(e){return this.demo()?u("ready",{public_pin_state:e==="d2"?"configured":"absent",slots:[],capabilities:{advertised:null,min:null,max:null},checked_at:null}):this.codes[e]}staleLine(e,s,n){return e.fresh||!e.data?d:a`<p class="status" role="status" data-sch-stale=${n}>${t("stale",{t:b(e.fetchedAt,s)||"—"})}</p>`}render(){const e=t("title");if($()&&!this.access.screen)return a`<sw-page heading=${e}><div data-sch data-sch-state="forbidden"><sw-state-panel quiet state="forbidden" heading=${t("noPermission")} data-sch-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return a`<sw-page heading=${e}><div data-sch data-sch-state=${this.error?"error":"loading"}>${this.error?a`<sw-state-panel quiet state="error" heading=${t("error")} actionLabel=${t("retry")} data-sch-panel="error" @action=${()=>this.refresh()}></sw-state-panel>`:a`<sw-state-panel quiet state="loading" heading=${t("loading")} data-sch-panel="loading"></sw-state-panel>`}</div></sw-page>`;if(!this.demo()&&this.feed.stations===null){const s=this.feed.state==="ready"?"error":this.feed.state,n=X(s);return a`<sw-page heading=${e}><div data-sch data-sch-state=${`feed:${this.feed.state}`}>
        <sw-state-panel icon="calendar" quiet state=${n.panel} heading=${n.heading} actionLabel=${n.panel==="error"||n.panel==="stale"?t("retry"):""} data-sch-panel=${`feed:${this.feed.state}`} @action=${()=>this.refresh()}></sw-state-panel>
      </div></sw-page>`}return this.renderReady()}renderReady(){const e=this.stations(),s=D(e),n=this.effectiveView(),i=I(s,this.wanted),o=this.demo()?!1:this.access.library&&this.library.state!=="forbidden",r=o&&this.library.data?this.library.data.length:null,w=!this.demo()&&this.feed?.fresh===!1;return a`<sw-page wide heading=${t("title")} subheading=${ee(s.length,r)}>
      ${this.access.edit&&!this.demo()?a`<sw-button slot="actions" variant="ghost" icon="edit" data-sch-edit @click=${()=>window.location.hash=se}>${t("editClassic")}</sw-button>`:d}
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${t("refresh")} @click=${()=>this.refresh()}>${t("refresh")}</sw-button>
      ${s.length&&!this.narrow?a`<sw-view-switch slot="actions" data-sch-views label=${t("viewLabel")} .value=${n} .options=${[{id:"door",label:t("viewDoor"),icon:"calendar"},{id:"table",label:t("viewTable"),icon:"table"}]} @change=${v=>this.setView(v.detail)}></sw-view-switch>`:d}
      <div data-sch data-sch-state=${s.length?"ready":"empty"} data-sch-view=${n}>
        ${w?a`<p class="status" role="status" data-sch-stale="stations">${t("stale",{t:b(this.feed?.fetched_at,this.feed?.default_zone??null)||"—"})}</p>`:d}
        ${s.length?n==="table"?this.renderTable(s):this.renderDoorView(s,i):a`<sw-state-panel icon="calendar" quiet state="empty" heading=${t("noDoors")} data-sch-panel="empty"></sw-state-panel>`}
        ${o?this.renderLibrary(e):d}
      </div>
      ${s.length?this.renderSheet(s,i):d}
    </sw-page>`}renderDoorList(e,s,n=!1){return a`<nav class="doors" aria-label=${t("doorsHeading")} data-sch-door-list=${n?"sheet":"side"}>
      ${n?d:a`<div class="ttl">${t("doorsHeading")}</div>`}
      ${te(e).map(i=>a`<div class="station" data-sch-station=${i.stationId}><span class="dot ${i.online?"":"off"}" aria-hidden="true"></span>${i.stationName}</div>
          ${i.doors.map(o=>a`<button type="button" aria-current=${String(o.key===s?.key)} data-sch-door=${o.key} @click=${()=>this.pick(o.key)}><span class="name">${o.doorName}</span></button>`)}`)}
    </nav>`}renderSheet(e,s){return a`<sw-drawer modal ?open=${this.sheet} heading=${t("pickDoor")} data-sch-sheet @close=${n=>n.target===n.currentTarget&&(this.sheet=!1)}>
      ${this.renderDoorList(e,s,!0)}
    </sw-drawer>`}renderDoorView(e,s){return s?a`<div class="layout">
      <aside class="doorcol"><sw-card flush>${this.renderDoorList(e,s)}</sw-card></aside>
      <section class="main" data-sch-door-view=${s.key}>
        <button type="button" class="chip" data-sch-door-chip aria-haspopup="dialog" @click=${()=>this.sheet=!0}>
          <sw-icon name="door" size=${16}></sw-icon><span class="name">${t("doorAt",{door:s.doorName,station:s.stationName})}</span><sw-icon name="chevronDown" size=${12}></sw-icon>
        </button>
        ${this.renderDoor(s)}
      </section>
    </div>`:d}renderCodePill(e){const s=this.codesOf(e);if(s?.state==="unsupported"||s?.state==="forbidden")return d;const n=s?.data?ae(s.data):"unknown";return a`<sw-badge kind=${n==="set"?"live":n==="unset"?"neutral":"unknown"} label=${t("codePill",{state:ie(n)})} data-sch-code=${n}></sw-badge>`}renderDoor(e){const s=this.programsOf(e.stationId),n=this.zoneOf(e.stationId),i=a`<div class="doorhead">
      <h2 data-sch-door-title>${t("doorAt",{door:e.doorName,station:e.stationName})}</h2>
      ${e.online?d:a`<span class="sub" data-sch-offline>${t("offline")}</span>`}
      <span class="sp"></span>
      ${this.renderCodePill(e.stationId)}
    </div>`;let o;return!s||s.state==="loading"&&!s.data?o=a`<sw-state-panel compact quiet state="loading" heading=${t("loading")} data-sch-panel="door-loading"></sw-state-panel>`:s.state==="unsupported"?o=a`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${t("sUnsupported")} data-sch-panel="door-unsupported"></sw-state-panel>`:s.state==="forbidden"?o=a`<sw-state-panel compact quiet state="forbidden" heading=${t("noPermission")} data-sch-panel="door-forbidden"></sw-state-panel>`:s.data?o=this.renderProgram(e,s,n):o=s.state==="busy"?a`<sw-state-panel compact quiet state="stale" heading=${t("busy")} data-sch-panel="door-busy"></sw-state-panel>`:a`<sw-state-panel compact quiet state="error" heading=${t("error")} actionLabel=${t("retry")} data-sch-panel="door-error" @action=${()=>void this.loadStation(e.stationId)}></sw-state-panel>`,a`${i}${o}`}renderProgram(e,s,n){const i=ne(e,s.data),o=this.staleLine(s,n,"door");if(i.none)return a`${o}<sw-card><div class="block"><sw-state-panel icon="calendar" compact quiet state="empty" heading=${t("noProgram")} data-sch-panel="no-program"></sw-state-panel></div></sw-card>`;const r=oe(i.state);return a`${o}<sw-card>
      <div class="block" data-sch-program=${i.state}>
        <div class="bh"><h3>${t("programsTitle")}</h3><span class="sp"></span><sw-badge kind=${x[r]} label=${re(`st_${i.state}`,"st_unknown")} data-sch-program-state=${i.state}></sw-badge></div>
        <div class="prog">
          <span class="name" data-sch-program-name>${i.name}</span>
          ${i.execution?a`<span class="muted" data-sch-execution>${i.execution}</span>`:d}
        </div>
        <sw-week-grid data-sch-week aria-label=${t("weekLabel")} .days=${i.days} .modes=${[{id:"hold",label:t("legendHold"),color:"var(--sw-accent)"}]}></sw-week-grid>
        ${i.unreadable?a`<span class="muted" data-sch-hours-unknown>${t("hoursUnknown")}</span>`:d}
        ${i.lines.length?a`<ul class="lines" data-sch-lines>${i.lines.map(w=>a`<li>${w}</li>`)}</ul>`:d}
        ${i.dates.length?a`<div class="dates" data-sch-dates><h4>${t("datesTitle")}</h4><ul class="lines">${i.dates.map(w=>a`<li>${w}</li>`)}</ul></div>`:d}
        ${i.checkedAt||i.timezone?a`<span class="muted">${[i.checkedAt?t("checked",{when:b(i.checkedAt,n)}):"",i.timezone?t("zone",{zone:i.timezone}):""].filter(Boolean).join(" · ")}</span>`:d}
      </div>
    </sw-card>`}renderTable(e){const s=Object.fromEntries(e.map(r=>[r.stationId,this.programsOf(r.stationId)?.data??null])),n=Object.fromEntries(e.map(r=>[r.stationId,this.codesOf(r.stationId)?.data??null])),i=le(e,s,n),o=[{key:"door",label:t("colDoor"),render:r=>a`<b>${r.door}</b>`},{key:"station",label:t("colStation")},{key:"program",label:t("colProgram")},{key:"kind",label:t("colKind")},{key:"when",label:t("colWhen")},{key:"state",label:t("colState"),render:r=>r.state?a`<sw-badge kind=${x[r.tone]} label=${r.state}></sw-badge>`:""},{key:"code",label:t("colCode"),render:r=>a`<span data-sch-code=${r.codeState}>${r.code}</span>`}];return a`<sw-table dense data-sch-table .rowKey=${"key"} .columns=${o} .rows=${i} @row-select=${r=>this.pick(r.detail.id)}></sw-table>`}renderLibrary(e){const s=de(e),n=this.feed?.default_zone??null,i=l=>l.state==="forbidden"||l.state==="unsupported",o=this.library,r=i(this.plans)?null:this.plans;if(i(o)&&!r)return d;const w=(l,f,m,A,j)=>a`<sw-card>
      <div class="block" data-sch-block=${f}>
        <div class="bh"><h3>${l}</h3>${A!==null?a`<span class="n">${A}</span>`:d}</div>
        ${m.state==="loading"&&!m.data?a`<sw-state-panel compact quiet state="loading" heading=${t("loading")}></sw-state-panel>`:m.state==="unsupported"?a`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${t("sUnsupported")} data-sch-panel=${`${f}-unsupported`}></sw-state-panel>`:m.data?a`${this.staleLine(m,n,f)}${j}`:m.state==="busy"?a`<sw-state-panel compact quiet state="stale" heading=${t("busy")} data-sch-panel=${`${f}-busy`}></sw-state-panel>`:a`<sw-state-panel compact quiet state="error" heading=${t("error")} actionLabel=${t("retry")} data-sch-panel=${`${f}-error`} @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-card>`,v=ce(o.data,r?.data??null,s),z=he(r?.data??null,i(this.ops)?null:this.ops.data,o.data,s),C=v.length?a`<div class="rows">${v.map(l=>a`<div class="row" data-sch-lib-row=${l.id}>
            <div class="main"><span class="t">${l.name}${l.version?a` <span class="muted">${l.version}</span>`:d}</span>
              ${l.lines.map(f=>a`<span class="s">${f}</span>`)}
              <span class="s">${[l.holidays,l.proposals].filter(Boolean).join(" · ")}</span></div>
          </div>`)}</div>`:a`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${t("libraryEmpty")} data-sch-panel="library-empty"></sw-state-panel>`,N=z.length?a`<div class="rows">${z.map(l=>a`<div class="row" data-sch-plan-row=${l.id}>
            <div class="main"><span class="t">${l.name} · ${l.station}</span>
              <span class="s">${[l.state!==l.source?l.source:"",l.outdated?t("outdated"):"",l.notApplied?t("notApplied"):"",l.checkedAt?t("checked",{when:b(l.checkedAt,l.stationId&&this.zoneOf(l.stationId)||n)}):""].filter(Boolean).join(" · ")}</span></div>
            <sw-badge kind=${x[l.tone]} label=${l.state} data-sch-plan-state=${l.tone}></sw-badge>
          </div>`)}</div>`:a`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${t("plansEmpty")} data-sch-panel="plans-empty"></sw-state-panel>`;return a`<div class="two" data-sch-library>
      ${i(o)?d:w(t("libraryTitle"),"library",o,o.data?o.data.length:null,C)}
      ${r?w(t("plansTitle"),"plans",r,r.data?r.data.length:null,N):d}
    </div>`}};c.styles=fe;h([p()],c.prototype,"feed",2);h([p()],c.prototype,"error",2);h([p()],c.prototype,"access",2);h([p()],c.prototype,"wanted",2);h([p()],c.prototype,"view",2);h([p()],c.prototype,"narrow",2);h([p()],c.prototype,"sheet",2);h([p()],c.prototype,"programs",2);h([p()],c.prototype,"codes",2);h([p()],c.prototype,"library",2);h([p()],c.prototype,"plans",2);h([p()],c.prototype,"ops",2);h([p()],c.prototype,"features",2);c=h([U("wiskey-schedules")],c);export{c as WiskeySchedules};
//# sourceMappingURL=wiskey-schedules-7d79wIco.js.map
