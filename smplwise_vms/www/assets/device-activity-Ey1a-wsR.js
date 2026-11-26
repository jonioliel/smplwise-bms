const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as D}from"./sw-logo-art-PLtEZJxU.js";import{af as oe,bg as ce,c as M,j as X,z as Z,a as ee,cI as te,mL as de,A as c,cJ as le,ex as ue,bM as pe,aj as y,b as a,mM as ve,mN as he,mO as f,bo as se,m as ie,mP as fe,mQ as q,mR as we,mS as me,mT as be,mU as H,o as r,y as m,aE as $,aM as I,k as p}from"./index-CVsAtsN7.js";import{o as V}from"./if-defined-DIG51bCS.js";import{v as ge,x as ye,w as z,a0 as ke,z as $e,a1 as xe,a2 as _e}from"./schedules-DQSJEhFL.js";import{r as ze}from"./device-commands-CwdnUQvb.js";import{D as Ce,d as Se}from"./devices-controls-CNaZrtaR.js";import{t as C}from"./tickets-CJXeSTIx.js";import{D as S,q as Ae,K as Oe,a as Te,P as Ee,b as De,A as Me,E as Le,t as Pe,g as Fe,c as Ne,i as Re,f as qe,d as B,e as U,h as j,j as K,k as W,p as Q,V as ae}from"./device-activity-logic-DIXhF35s.js";import"./confirm-words-CwRWhfCA.js";import"./lock-reason-Cxavdi_w.js";class L extends Error{constructor(t,s=""){super(s||t),this.reason=t}}function He(e){const t=new URLSearchParams;for(const[i,n]of Object.entries(e))n!=null&&n!==""&&t.set(i,String(n));const s=t.toString();return s?`?${s}`:""}async function Ie(e,t={}){if(!oe())return(await D(async()=>{const{demoActivity:s}=await import("./device-activity-mock-BMg2ifx-.js");return{demoActivity:s}},[],import.meta.url)).demoActivity(e,t);try{const s=await ce(`devices/${encodeURIComponent(e)}/activity${He({limit:50,...t})}`);return{items:s.items??[],next_cursor:s.next_cursor??null,retention_days:s.retention_days??90,tracked_since:s.tracked_since??s.coverage?.from??null,coverage:s.coverage??{from:null,gaps:[]},entity:s.entity,availability:s.availability??"ok"}}catch(s){throw s instanceof M&&s.status===403?new L("forbidden"):new L("unavailable",s instanceof Error?s.message:"")}}var Ve=Object.defineProperty,Be=Object.getOwnPropertyDescriptor,P=(e,t,s,i)=>{for(var n=i>1?void 0:i?Be(t,s):t,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(i?d(t,s,n):d(n))||n);return i&&n&&Ve(t,s,n),n};let _=class extends ee{constructor(){super(...arguments),this.data=null,this.status="loading",this.offNames=null}connectedCallback(){super.connectedCallback(),this.offNames=te(()=>this.requestUpdate())}disconnectedCallback(){super.disconnectedCallback(),this.offNames?.()}fire(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}row(e){const t=e.assignee?.name??e.last_assignee_name??"",s=de.includes(e.status);return a`<a class="tr ${s?"closed":""}" role="listitem" href=${le(ue(),void 0,{t:e.id})} data-device-ticket=${e.id} @click=${()=>this.fire("leave",{id:e.id})}>
      <span class="tt"><b>${e.title}</b><small><bdi>#${e.number}</bdi> · ${pe(e.created_at)}${t?a` · ${y(t)}`:c}</small></span>
      <span class=${`chip ${ve(e.status)}`} data-status=${e.status}><i class="dot" aria-hidden="true"></i>${he(e.status)}</span>
    </a>`}render(){if(this.status==="loading")return a`<div class="skels" role="status" aria-busy="true" data-tickets-state="loading">${[0,1].map(()=>a`<span class="skel"></span>`)}</div>`;if(this.status==="no_device")return a`<sw-state-panel state="forbidden" heading=${f("noDevice")} compact data-tickets-state="no-device"></sw-state-panel>`;if(this.status==="error"||!this.data)return a`<sw-state-panel state="error" heading=${f("loadFailed")} actionLabel=${f("retry")} compact data-tickets-state="error" @action=${()=>this.fire("retry")}></sw-state-panel>`;const e=this.data,t=a`<div class="hd">
      <span class="cnt" data-tickets-open=${e.open_count}>${e.items.length?f("openCount",{n:e.open_count}):c}</span>
      ${e.can_create?a`<sw-button size="sm" variant="primary" icon="plus" data-tickets-new @click=${()=>this.fire("create")}>${f("newBtn")}</sw-button>`:c}
    </div>`;return e.items.length?a`${t}<div class="list" role="list" data-tickets-state="ready">${se(e.items,s=>s.id,s=>this.row(s))}</div>`:a`${t}<sw-state-panel icon="ticket" state="empty" heading=${f("empty")} compact data-tickets-state="empty"></sw-state-panel>`}};_.styles=X`
    :host { display: block; }
    .hd { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-2); padding-block: var(--sw-s-1h) var(--sw-s-2); min-block-size: 40px; }
    .cnt { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .list { display: grid; gap: var(--sw-s-2); }
    .tr {
      display: flex; align-items: center; gap: var(--sw-s-3); min-block-size: 56px; padding: var(--sw-s-2) var(--sw-s-3); border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border); background: var(--sw-surface-2); color: var(--sw-text); text-decoration: none;
    }
    .tr:hover { background: var(--sw-surface-3); }
    .tr:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .tr.closed .tt b { color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
    .tt { flex: 1; min-inline-size: 0; display: grid; gap: 2px; }
    .tt b { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tt small { color: var(--sw-text-3); font-size: var(--sw-fs-xs); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip {
      flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap;
    }
    .chip .dot { inline-size: 6px; block-size: 6px; border-radius: 50%; background: currentColor; }
    .chip.info { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .chip.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .chip.ok { background: var(--sw-success-soft); color: var(--sw-success); }
    .chip.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .skels { display: grid; gap: var(--sw-s-2); padding-block: var(--sw-s-2); }
    .skel { display: block; block-size: 52px; border-radius: var(--sw-r-lg); background: var(--sw-surface-3); animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
  `;P([Z({attribute:!1})],_.prototype,"data",2);P([Z()],_.prototype,"status",2);_=P([ie("device-tickets-tab")],_);const J=1100,Ue=[30,60,90],je=[10,20,30];function A(e){return e==="water_heater"||e==="valve"||e==="vacuum"?e:null}const ne=e=>e.split(".")[0]??"";function Ke(e,t){const s=ne(t);return e==="water_heater"?s==="switch"||s==="input_boolean"?{on:{action:`${s}.turn_on`,expect:"on",confirm:!1,label:"deviceCard.heaterTurnOn"},off:{action:`${s}.turn_off`,expect:"off",confirm:!1,label:"deviceCard.heaterTurnOff"},schedulableOff:`${s}.turn_off`}:s==="water_heater"?{on:{action:"water_heater.turn_on",expect:"on",confirm:!1,label:"deviceCard.heaterTurnOn"},off:{action:"water_heater.turn_off",expect:"off",confirm:!1,label:"deviceCard.heaterTurnOff"},schedulableOff:null}:null:e==="valve"?s==="switch"||s==="input_boolean"?{on:{action:`${s}.turn_on`,expect:"on",confirm:!0,label:"deviceCard.valveDoOpen"},off:{action:`${s}.turn_off`,expect:"off",confirm:!1,label:"deviceCard.valveDoClose"},schedulableOff:`${s}.turn_off`}:s==="valve"?{on:{action:"valve.open_valve",expect:"open",confirm:!0,label:"deviceCard.valveDoOpen"},off:{action:"valve.close_valve",expect:"closed",confirm:!1,label:"deviceCard.valveDoClose"},schedulableOff:null}:null:null}const O={start:{action:"vacuum.start",expect:"cleaning",confirm:!1,label:"deviceCard.vacStart"},pause:{action:"vacuum.pause",expect:"paused",confirm:!1,label:"deviceCard.vacPause"},dock:{action:"vacuum.return_to_base",expect:"returning",confirm:!1,label:"deviceCard.vacDock"}};function x(e,t){return!t||t==="unavailable"||t==="unknown"?!1:e==="valve"?t==="on"||t==="open"||t==="opening":e==="vacuum"?t==="cleaning"||t==="returning":t!=="off"}function Y(e){return e==="opening"||e==="closing"}function We(e,t){return!t||t==="unavailable"||t==="unknown"?"deviceCard.stateUnknown":e==="water_heater"?t==="off"?"deviceCard.heaterOff":"deviceCard.heaterOn":e==="valve"?t==="opening"?"deviceCard.valveOpening":t==="closing"?"deviceCard.valveClosing":x("valve",t)?"deviceCard.valveOpen":"deviceCard.valveClosed":{docked:"deviceCard.vacDocked",cleaning:"deviceCard.vacCleaning",paused:"deviceCard.vacPaused",returning:"deviceCard.vacReturning",idle:"deviceCard.vacIdle",error:"deviceCard.vacError"}[t]??"deviceCard.stateUnknown"}function Qe(e){const t=(e??"").toLowerCase();return t?/quiet|silent|gentle|low/.test(t)?"deviceCard.fanQuiet":/standard|balanced|normal|auto/.test(t)?"deviceCard.fanStandard":/medium/.test(t)?"deviceCard.fanMedium":/high|strong/.test(t)?"deviceCard.fanHigh":/turbo/.test(t)?"deviceCard.fanTurbo":/max/.test(t)?"deviceCard.fanMax":null:null}function Je(e){return e.find(t=>t.kind==="power"&&t.to.state==="cleaning")?.at??null}const G=e=>String(e).padStart(2,"0");function Ye(e,t){const s=new Date(e.getTime()+t*6e4);return`${G(s.getHours())}:${G(s.getMinutes())}:00`}function Ge(e,t,s,i,n){return{name:s,weekdays:["daily"],start_date:null,end_date:null,repeat:"single",tags:[],conditions:{items:[],type:null,track:!1},slots:[{start:Ye(i,n),stop:null,actions:[{service:t,entity_id:e,data:{}}]}]}}function Xe(e,t,s){return s?e.find(i=>i.enabled&&i.repeat==="single"&&!!i.next_run&&i.slots.length===1&&i.slots[0].actions.length===1&&i.slots[0].actions[0].service===s&&i.slots[0].actions[0].entity_id===t)??null:null}var Ze=Object.defineProperty,et=Object.getOwnPropertyDescriptor,u=(e,t,s,i)=>{for(var n=i>1?void 0:i?et(t,s):t,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(i?d(t,s,n):d(n))||n);return i&&n&&Ze(t,s,n),n};const tt={"schedule-editor":()=>D(()=>import("./schedule-editor-C00pvs8r.js"),__vite__mapDeps([0]),import.meta.url),"ticket-create":()=>D(()=>import("./ticket-create-CnszC53r.js"),__vite__mapDeps([0]),import.meta.url)},T=new Map;function E(e){if(customElements.get(e))return Promise.resolve();let t=T.get(e);return t||(t=tt[e](),T.set(e,t),t.catch(()=>T.delete(e))),t}function st(){try{return Q(localStorage.getItem(ae))}catch{return Q(null)}}function it(e){try{localStorage.setItem(ae,e)}catch{}}let l=class extends ee{constructor(){super(...arguments),this.open=!1,this.target=null,this.area="",this.tab="activity",this.menu=null,this.filters={...S},this.view=st(),this.feed=[],this.page=null,this.feedStatus="loading",this.loadingMore=!1,this.sched=[],this.schedStatus="loading",this.editing=null,this.busy=new Set,this.row=null,this.rowStatus="idle",this.holding=!1,this.timerBusy=!1,this.timerNote="",this.menuSource="context",this.tdata=null,this.tstatus="loading",this.creating=!1,this.meta=null,this.newMode="sheet",this.ticketsOn=!1,this.ticketsToken=0,this.offNames=null,this.opener=null,this.popupSeq=0,this.token=0,this.schedToken=0,this.rowToken=0,this.ctl=new Ce(this,()=>void this.loadRow()),this.onOpen=e=>{const t=e.detail;if(this.opener=t.opener??null,this.target=t.target,this.area=t.area??"",this.ticketsOn=fe(),this.openDevice=t.openDevice,t.menu){this.menuSource=t.source??"context",this.menu=t.menu,this.open=!1,this.tdata=null,this.ticketsOn&&this.loadTickets();return}this.tdata=null,this.openPopup(t.tab,t.create)},this.onCreated=()=>{this.creating=!1,this.meta=null,this.tab="tickets",this.loadTickets()},this.onCreateClosed=()=>{this.creating=!1},this.onSaved=()=>{this.editing=null,this.loadSched()},this.onMenuKey=e=>{const t=[...this.renderRoot.querySelectorAll(".menu button")],s=t.indexOf(this.renderRoot.activeElement);if(e.key==="Escape"){e.preventDefault(),this.menu=null;const i=this.opener;i?.isConnected&&requestAnimationFrame(()=>i.focus({preventScroll:!0}))}else(e.key==="ArrowDown"||e.key==="ArrowUp")&&(e.preventDefault(),t[(s+(e.key==="ArrowDown"?1:-1)+t.length)%t.length]?.focus())},this.onTabKey=e=>{const t=this.tabs(),s=Math.max(0,t.indexOf(this.tab));let i=null;e.key==="ArrowLeft"?i=t[(s+1)%t.length]:e.key==="ArrowRight"?i=t[(s-1+t.length)%t.length]:e.key==="Home"?i=t[0]:e.key==="End"&&(i=t[t.length-1]),i&&(e.preventDefault(),this.tab=i,requestAnimationFrame(()=>this.renderRoot.querySelector(`#da-tab-${this.tab}`)?.focus()))},this.cancelHold=()=>{this.holdTimer!==void 0&&window.clearTimeout(this.holdTimer),this.holdTimer=void 0,this.holding&&(this.holding=!1)},this.onViewKey=e=>{const t=["cards","list"];let s=null;e.key==="ArrowLeft"||e.key==="ArrowRight"?s=this.view==="cards"?"list":"cards":e.key==="Home"?s=t[0]:e.key==="End"&&(s=t[1]),s&&(e.preventDefault(),this.setView(s),requestAnimationFrame(()=>this.renderRoot.querySelector(`[data-view="${this.view}"]`)?.focus()))}}connectedCallback(){super.connectedCallback(),window.addEventListener(q,this.onOpen),this.offNames=te(()=>this.requestUpdate())}disconnectedCallback(){window.removeEventListener(q,this.onOpen),this.offNames?.(),super.disconnectedCallback()}get tracked(){return this.target?.tracked!==!1}tabs(){return we({tracked:this.tracked,on:this.ticketsOn})}openPopup(e,t=!1){const s=this.tabs();if(s.length){if(s.includes(e)||(e=s[0]),this.menu=null,this.popupSeq++,this.tab=e,this.creating=!1,this.ticketsOn?((!this.tdata||this.tdata.entity.entity_id!==this.target?.id)&&this.loadTickets(),t&&this.startCreate()):this.tdata=null,!this.tracked){this.open=!0,this.editing=null;return}this.filters={...S},this.feed=[],this.page=null,this.editing=null,this.open=!0,this.row=null,this.rowStatus="idle",this.timerNote="",this.cancelHold(),this.loadFeed(),this.loadSched(),this.target&&A(this.target.kind)&&this.loadRow()}}closePopup(){this.popupSeq++,this.open=!1,this.editing=null,this.token++,this.schedToken++,this.rowToken++,this.ticketsToken++,this.creating=!1,this.cancelHold();const e=this.opener;this.opener=null,e?.isConnected&&requestAnimationFrame(()=>e.focus({preventScroll:!0}))}async loadTickets(){const e=this.target;if(!e)return;const t=++this.ticketsToken;this.tstatus="loading";try{const s=await C().byEntity(e.id);if(t!==this.ticketsToken)return;this.tdata=s,this.tstatus="ready"}catch(s){if(t!==this.ticketsToken)return;this.tdata=null,this.tstatus=s instanceof M&&(s.status===404||s.status===403)?"no_device":"error"}}async startCreate(){if(!customElements.get("ticket-create")){const e=this.popupSeq;try{await E("ticket-create")}catch(t){console.warn("ticket form chunk failed to load",t);return}if(e!==this.popupSeq)return}if(this.creating=!0,!this.meta)try{const[e,t]=await Promise.all([C().meta(),C().module().catch(()=>null)]);this.meta=e,t&&(this.newMode=t.ui.new_ticket)}catch{this.meta={departments:[],can:{view:!1,create:!1,manage:!1,all_departments:!1,external:!1,configure:!1}}}}renderCreate(){const e=this.target;return!this.creating||!e||!customElements.get("ticket-create")?c:a`<ticket-create .open=${!0} .meta=${this.meta} mode=${this.newMode} data-device-create
      .device=${{id:e.id,name:e.name,data:this.tdata}} .mapElement=${{pick:{resource:{type:"ha_entity",id:e.id}},name:e.name,floorName:""}}
      @created=${this.onCreated} @close=${this.onCreateClosed}></ticket-create>`}menuAction(e){if(this.target){if(e==="device"){const s=this.openDevice;this.menu=null,s?.();return}if(e==="ticket_new")return this.openPopup("tickets",!0);if(e==="tickets")return this.openPopup("tickets");this.openPopup(e)}}async loadFeed(e=!1){const t=this.target;if(!t)return;const s=++this.token;e?this.loadingMore=!0:this.feedStatus="loading";try{const i=await Ie(t.id,Ae(this.filters,Date.now(),e?this.page?.next_cursor:null));if(s!==this.token)return;this.feed=e?[...this.feed,...i.items]:i.items,this.page=i,this.feedStatus=i.availability==="unavailable"&&!i.items.length?"unavailable":"ready"}catch(i){if(s!==this.token)return;this.feedStatus=i instanceof L&&i.reason==="forbidden"?"forbidden":"unavailable"}finally{s===this.token&&(this.loadingMore=!1)}}async loadSched(){const e=this.target;if(!e)return;const t=++this.schedToken;this.schedStatus="loading";try{const s=await ge({entity:e.id,limit:50,sort:"next_run"});if(t!==this.schedToken)return;this.sched=s.items,this.schedStatus="ready"}catch(s){if(t!==this.schedToken)return;this.schedStatus=s instanceof M&&s.status===403?"forbidden":"unavailable"}}async loadRow(){const e=this.target;if(!e||!A(e.kind))return;const t=++this.rowToken;this.rowStatus!=="ready"&&(this.rowStatus="loading");try{const s=await me([e.id]);if(t!==this.rowToken)return;const i=s.entities.find(n=>n.entity_id===e.id)??null;this.row=i,this.rowStatus=i?"ready":"missing"}catch{if(t!==this.rowToken)return;this.row=null,this.rowStatus="missing"}}setFilter(e){this.filters={...this.filters,...e},this.loadFeed()}async toggle(e,t){if(!this.busy.has(e.id)){this.busy=new Set(this.busy).add(e.id);try{const s=await ye(e.id,t);this.sched=this.sched.map(i=>i.id===e.id?s.schedule:i)}catch{await this.loadSched()}finally{const s=new Set(this.busy);s.delete(e.id),this.busy=s}}}render(){const e=this.target;return a`${this.renderMenu()}${e?this.renderPopup(e):c}${this.renderEditor()}${this.renderCreate()}`}renderMenu(){const e=this.menu,t=this.target;if(!e||!t)return c;const s=be({tracked:this.tracked,on:this.ticketsOn,mode:H(),source:this.menuSource,canOpenDevice:!!this.openDevice});if(!s.length)return c;const i=s.length+(s.some(v=>v==="ticket_new"||v==="tickets")&&s.some(v=>v==="activity"||v==="device")?1:0),n=Math.min(Math.max(8,e.x),Math.max(8,window.innerWidth-228)),o=Math.min(Math.max(8,e.y),Math.max(8,window.innerHeight-16-i*46)),d=this.ticketsOn&&getComputedStyle(this).direction==="rtl",b=Math.min(Math.max(8,window.innerWidth-e.x),Math.max(8,window.innerWidth-236)),h=d?`left:auto;right:${b}px;top:${o}px`:`inset-inline-start:auto;left:${n}px;top:${o}px`,w=this.tdata?.open_count,g=this.ticketsOn&&H()==="menu",k=v=>()=>this.menuAction(v);let F=!1;return a`<div class="scrim" data-activity-menu-scrim @pointerdown=${()=>this.menu=null} @contextmenu=${v=>{v.preventDefault(),this.menu=null}}></div>
      <div class="menu" role="menu" aria-label=${this.ticketsOn?f("menuLabel"):r("deviceActivity.menuLabel")} style=${h} data-activity-menu data-menu-source=${this.menuSource} @keydown=${this.onMenuKey}>
        ${s.map(v=>{const N=v==="ticket_new"||v==="tickets",re=N&&!F&&s[0]!==v;N&&(F=!0);const R=v==="device"?a`<button type="button" role="menuitem" data-activity-menu-device @click=${k(v)}><sw-icon name="expand" size=${16}></sw-icon><span class="ml">${f("menuDevice")}</span></button>`:v==="activity"?a`<button type="button" role="menuitem" data-activity-menu-activity @click=${k(v)}><sw-icon name="history" size=${16}></sw-icon><span class="ml">${g?f("menuHistory"):r("deviceActivity.menuActivity")}</span></button>`:v==="schedules"?a`<button type="button" role="menuitem" data-activity-menu-schedules @click=${k(v)}><sw-icon name="calendar" size=${16}></sw-icon><span class="ml">${r("deviceActivity.menuSchedules")}</span></button>`:v==="ticket_new"?a`<button type="button" role="menuitem" data-activity-menu-ticket-new @click=${k(v)}><sw-icon name="ticket" size=${16}></sw-icon><span class="ml">${f("menuNew")}</span></button>`:a`<button type="button" role="menuitem" data-activity-menu-tickets @click=${k(v)}><sw-icon name="list" size=${16}></sw-icon><span class="ml">${f("menuList")}</span>${w?a`<span class="mc" data-menu-count>${w}</span>`:c}</button>`;return re?a`<hr aria-hidden="true" />${R}`:R})}
      </div>`}updated(e){if(e.has("menu")&&this.menu&&requestAnimationFrame(()=>this.renderRoot.querySelector(".menu button")?.focus()),(e.has("tab")||e.has("open"))&&this.open){const t=this.tab==="schedules"?"schedule-editor":this.tab==="tickets"?"ticket-create":null;t&&!customElements.get(t)&&E(t).catch(()=>{})}}renderPopup(e){const t=A(e.kind),s=t?x(t,this.row?.state??null)||!this.row&&!!e.state&&!/כבוי|סגור|לא זמין/.test(e.state):!!e.state&&!/כבוי|סגור|לא זמין/.test(e.state),i=this.tabs();return a`<sw-sheet ?open=${this.open&&!this.editing&&!this.creating} heading=${`${r("deviceActivity.popupLabel")}: ${e.name}`} data-device-activity style="--sw-sheet-w:430px" @close=${()=>this.closePopup()}>
      <div slot="head" class="ph ${s?"":"off"}">
        <span class="ic"><sw-icon name=${Oe[e.kind]} size=${18}></sw-icon></span>
        <div class="tt"><h3>${y(e.name)}</h3><div class="sub">${t?a`${this.area?y(this.area):c}`:a`${this.area?a`${y(this.area)} · `:c}<span data-activity-state>${e.state}</span>${this.powerText()}`}</div></div>
      </div>
      ${t?this.renderCard(t,e):c}
      ${i.length>1?a`<div class="segt" role="tablist" aria-label=${r("deviceActivity.tabs")}>
        ${i.map(n=>a`<button type="button" role="tab" id=${`da-tab-${n}`} aria-selected=${String(this.tab===n)} aria-controls="da-panel" tabindex=${this.tab===n?0:-1}
            class=${this.tab===n?"on":""} data-tab=${n} @click=${()=>this.tab=n} @keydown=${this.onTabKey}>${this.tabLabel(n)}${this.tabCount(n)}</button>`)}
      </div>`:c}
      <div id="da-panel" class="pbody" role=${i.length>1?"tabpanel":"region"} aria-labelledby=${V(i.length>1?`da-tab-${this.tab}`:void 0)} aria-label=${V(i.length>1?void 0:f("tab"))} data-panel=${this.tab}>${this.renderPanel(e)}</div>
    </sw-sheet>`}tabLabel(e){return e==="activity"?r("deviceActivity.tabActivity"):e==="schedules"?r("deviceActivity.tabSchedules"):f("tab")}tabCount(e){return e==="schedules"&&this.schedStatus==="ready"&&this.sched.length?a`<span class="cnt">${this.sched.length}</span>`:e==="tickets"&&this.tstatus==="ready"&&this.tdata?.open_count?a`<span class="cnt" data-tickets-count>${this.tdata.open_count}</span>`:c}renderPanel(e){return this.tab==="tickets"?a`<device-tickets-tab .data=${this.tdata} status=${this.tstatus} @create=${()=>void this.startCreate()} @retry=${()=>void this.loadTickets()}
        @leave=${()=>this.closePopup()}></device-tickets-tab>`:this.tab==="activity"?this.renderActivity(e):this.renderSchedules()}powerText(){const e=this.page?.entity?.power;return e&&e.value!==null&&e.value!==void 0?a` · <bdi data-activity-power>${Math.round(e.value).toLocaleString("en")} ${e.unit}</bdi>`:c}cardState(e,t){const s=this.row;if(s){const n=this.ctl.live(s.entity_id,e==="vacuum"?"vacuum":"power")??s.state;return{state:n,text:r(We(e,n))}}return{state:null,text:t.state||r("deviceCard.stateUnknown")}}renderCard(e,t){const s=this.row,i=this.rowStatus==="loading"&&!s,n=!!s&&s.can_control&&s.available&&s.state!=="unavailable",{state:o,text:d}=this.cardState(e,t),b=x(e,o);return a`<section class="card ${b?"on":""}" data-device-card=${e} data-card-state=${o??""} ?data-can-control=${n} aria-label=${d}>
      ${i?a`<div class="skels tight" data-card-loading role="status" aria-label=${r("deviceCard.loading")}><div class="sk"><span><i class="skel a"></i><i class="skel b"></i></span><i class="skel d"></i></div></div>`:a`<div class="st">
              <i class="cdot ${b?"on":""} ${Y(o)||o==="returning"?"moving":""} ${o?"":"unknown"}" aria-hidden="true"></i>
              <span class="big" data-card-big>${d}</span>
              <span class="meta" data-card-meta>${this.renderMeta(e,s,t)}</span>
            </div>
            ${n?this.renderActions(e,s,o):c}
            ${s?this.ctl.renderCmdStatus(s.entity_id):c}
            ${this.timerNote?a`<div class="rollback-note" data-timer-note role="status">${this.timerNote}</div>`:c}`}
    </section>`}renderMeta(e,t,s){const i=[];if(e==="water_heater"){const n=this.page?.entity?.power??t?.power;n&&n.value!==null&&n.value!==void 0&&i.push(a`<bdi data-card-power>${Math.round(n.value).toLocaleString("en")} ${n.unit}</bdi>`),t?.current_temperature!==null&&t?.current_temperature!==void 0&&i.push(m("deviceCard.heaterCurrent",{n:$(t.current_temperature)})),t?.target_temperature!==null&&t?.target_temperature!==void 0&&i.push(m("deviceCard.heaterTarget",{n:$(t.target_temperature)})),t?.last_changed&&i.push(a`<span data-card-since>${m("deviceCard.since",{t:z(t.last_changed)})}</span>`)}else if(e==="valve")t?.position!==null&&t?.position!==void 0&&t.position>0&&t.position<100&&!Y(t.state)&&i.push(m("deviceCard.valvePosition",{n:$(t.position)})),t?.last_changed&&i.push(a`<span data-card-since>${m("deviceCard.since",{t:z(t.last_changed)})}</span>`);else{t?.battery_level!==null&&t?.battery_level!==void 0&&i.push(a`<span class="bat ${t.battery_level<=20?"low":""}" data-card-battery><sw-icon name="storage" size=${12}></sw-icon>${m("deviceCard.vacBattery",{n:$(t.battery_level)})}</span>`);const n=Qe(t?.fan_speed);t?.fan_speed&&i.push(m("deviceCard.vacFan",{v:n?r(n):t.fan_speed}));const o=Je(this.feed);this.feedStatus==="ready"&&i.push(a`<span data-card-last-clean>${o?m("deviceCard.vacLastClean",{t:z(o)}):r("deviceCard.vacLastCleanNone")}</span>`)}return i.length?i.map((n,o)=>a`${o?" · ":""}${n}`):c}renderActions(e,t,s){if(e==="vacuum")return this.renderVacuumActions(t,s);const i=Ke(e,t.entity_id);if(!i)return c;const n=x(e,this.ctl.live(t.entity_id,"power")??s),o=this.ctl.rowPendingVisible(t.entity_id),d=Xe(this.sched,t.entity_id,i.schedulableOff),b=e==="water_heater"?Ue:je,h=I("schedule.manage")&&i.schedulableOff&&!d&&(e==="water_heater"||n),w=e==="valve"?"deviceCard.autoClose":n?"deviceCard.autoOffLabel":"deviceCard.boost";return a`<div class="acts" data-card-actions>
        ${n?a`<sw-button size="lg" icon="power" data-card-off ?disabled=${o} @click=${()=>this.send(t,i.off,"power")}>${r(i.off.label)}</sw-button>`:i.on.confirm?this.renderHold(t,i.on):a`<sw-button size="lg" variant="primary" icon="power" data-card-on ?disabled=${o} @click=${()=>this.send(t,i.on,"power")}>${r(i.on.label)}</sw-button>`}
        ${h?a`<span class="chips" role="group" aria-label=${r(w)} data-card-timers data-card-timers-mode=${n?"off-only":"boost"}>
              <span class="cl">${r(w)}</span>
              ${b.map(g=>a`<button type="button" class="chip" data-card-timer=${g} ?disabled=${o||this.timerBusy} @click=${()=>void this.startTimed(e,t,i,g)}>${m("deviceCard.boostFor",{n:$(g)})}</button>`)}
            </span>`:c}
      </div>
      ${d?a`<div class="auto" data-card-auto-off>
            <sw-icon name="clock" size=${14}></sw-icon>
            <span>${m(e==="water_heater"?"deviceCard.autoOffAt":"deviceCard.autoCloseAt",{t:z(d.next_run.at)})}</span>
            ${d.can.delete?a`<sw-button iconOnly size="sm" variant="ghost" icon="close" label=${r(e==="water_heater"?"deviceCard.autoOffCancel":"deviceCard.autoCloseCancel")} data-card-auto-off-cancel ?disabled=${this.timerBusy} @click=${()=>void this.cancelTimed(d)}></sw-button>`:c}
          </div>`:c}`}renderVacuumActions(e,t){const s=this.ctl.rowPendingVisible(e.entity_id),i=t==="cleaning",n=t==="cleaning"||t==="paused"||t==="returning"||t==="idle"||t==="error";return a`<div class="acts" data-card-actions>
      ${i?a`<sw-button size="lg" icon="pause" data-card-vac-pause ?disabled=${s} @click=${()=>this.send(e,O.pause,"vacuum")}>${r("deviceCard.vacPause")}</sw-button>`:a`<sw-button size="lg" variant="primary" icon="play" data-card-vac-start ?disabled=${s} @click=${()=>this.send(e,O.start,"vacuum")}>${r("deviceCard.vacStart")}</sw-button>`}
      ${n?a`<sw-button size="lg" icon="home" data-card-vac-dock ?disabled=${s||t==="returning"} @click=${()=>this.send(e,O.dock,"vacuum")}>${r("deviceCard.vacDock")}</sw-button>`:c}
    </div>`}renderHold(e,t){const s=`${e.entity_id}:power`,i=this.ctl.isArmed(s),n=this.ctl.rowPendingVisible(e.entity_id),o=()=>this.send(e,t,"power");return a`<button type="button" class="hbtn ${this.holding?"holding":""} ${i?"armed":""}" data-card-hold ?disabled=${n} aria-label=${r("deviceCard.holdToOpen")}
        style=${`--hold:${J}ms`}
        @pointerdown=${d=>this.startHold(d,o)} @pointerup=${this.cancelHold} @pointerleave=${this.cancelHold} @pointercancel=${this.cancelHold}
        @contextmenu=${d=>d.preventDefault()}
        @keydown=${d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),this.ctl.tapArmed(s,o))}}
        @click=${d=>d.preventDefault()}>
      <i class="prog" aria-hidden="true"></i>
      <span class="lb"><sw-icon name="power" size=${15}></sw-icon>${i?r("deviceCard.armedConfirm"):this.holding?r("deviceCard.holdHint"):r(t.label)}</span>
    </button>`}startHold(e,t){if(!(e.button!==0&&e.pointerType==="mouse")){this.cancelHold();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}this.holding=!0,this.holdTimer=window.setTimeout(()=>{this.holdTimer=void 0,this.holding=!1;try{navigator.vibrate?.(10)}catch{}t()},J)}}send(e,t,s){const i=`${e.entity_id}:${s}`;this.ctl.commands[i]?.phase!=="pending"&&ze(i,ne(e.entity_id),e.entity_id,t.action,{},t.expect,n=>this.ctl.setCmd(i,n),{confirmed:t.confirm,label:r(t.label),reached:n=>n.state===t.expect})}async startTimed(e,t,s,i){if(!(!s.schedulableOff||this.timerBusy)){this.timerBusy=!0,this.timerNote="";try{const n=m(e==="water_heater"?"deviceCard.autoOffScheduleName":"deviceCard.autoCloseScheduleName",{name:t.name}),o=Ge(t.entity_id,s.schedulableOff,n,new Date,i),d=await ke(o);"status"in d&&d.status==="unknown"?this.timerNote=r("deviceCard.autoOffFailed"):x(e,this.cardState(e,this.target).state)||this.send(t,s.on,"power"),await this.loadSched()}catch{this.timerNote=r("deviceCard.autoOffFailed")}finally{this.timerBusy=!1}}}async cancelTimed(e){if(!this.timerBusy){this.timerBusy=!0;try{await $e(e.id,e.revision)}catch{}finally{this.timerBusy=!1,await this.loadSched()}}}setView(e){e!==this.view&&(this.view=e,it(e))}clearFilters(){this.filters={...S},this.loadFeed()}renderFilters(){const e=this.filters,t=Te(e),s=this.feedStatus==="loading",i=(o,d,b,h,w)=>a`<sw-dropdown class="fchip" data-filter=${w} .items=${d} .value=${b} label=${o} @change=${g=>h(g.detail.id)}></sw-dropdown>`,n=[{id:"cards",icon:"grid",label:r("deviceActivity.viewCards")},{id:"list",icon:"list",label:r("deviceActivity.viewList")}];return a`<div class="fl" role="group" aria-label=${r("deviceActivity.filterTools")}>
      <div class="fchips">
        ${i(r("deviceActivity.filterPeriod"),Ee.map(o=>({id:o,label:De[o]})),e.period,o=>this.setFilter({period:o}),"period")}
        ${i(r("deviceActivity.filterActor"),Me,e.actor,o=>this.setFilter({actor:o}),"actor")}
        ${i(r("deviceActivity.filterKind"),Le,e.kind,o=>this.setFilter({kind:o}),"kind")}
        ${t?a`<button type="button" class="clr" data-clear-filters @click=${()=>this.clearFilters()}><sw-icon name="close" size=${12}></sw-icon>${r("deviceActivity.clearFilters")}<span class="n">${t}</span></button>`:c}
      </div>
      <div class="ftools">
        <span class="vw" role="radiogroup" aria-label=${r("deviceActivity.viewLabel")} data-view-toggle>
          ${n.map(o=>a`<button type="button" role="radio" aria-checked=${String(this.view===o.id)} tabindex=${this.view===o.id?0:-1} class=${this.view===o.id?"on":""} data-view=${o.id} aria-label=${o.label} title=${o.label}
                @click=${()=>this.setView(o.id)} @keydown=${this.onViewKey}><sw-icon name=${o.icon} size=${15}></sw-icon></button>`)}
        </span>
        <sw-button iconOnly size="sm" variant="ghost" icon="refresh" label=${r("deviceActivity.refresh")} data-feed-refresh ?disabled=${s} @click=${()=>void this.loadFeed()}></sw-button>
      </div>
    </div>`}renderSkeletons(e,t=c){const s=this.view==="list";return a`<div class="skels ${s?"list":""}" data-feed-state=${t} role="status" aria-label=${r("deviceActivity.loading")}>
      ${Array.from({length:e},()=>s?a`<div class="sk l"><i class="skel d"></i><i class="skel dot"></i><i class="skel a"></i><i class="skel b"></i></div>`:a`<div class="sk"><i class="skel c"></i><span><i class="skel a"></i><i class="skel b"></i></span><i class="skel d"></i></div>`)}
    </div>`}renderActivity(e){if(this.feedStatus==="forbidden")return a`<sw-state-panel state="forbidden" heading=${r("deviceActivity.forbiddenTitle")} hint=${r("deviceActivity.forbiddenHint")} compact data-feed-state="forbidden"></sw-state-panel>`;const t=this.renderFilters();if(this.feedStatus==="loading")return a`${t}${this.renderSkeletons(3,"loading")}`;if(this.feedStatus==="unavailable")return a`${t}<sw-state-panel state="error" heading=${r("deviceActivity.unavailableTitle")} hint=${r("deviceActivity.unavailableHint")} actionLabel=${r("deviceActivity.retry")} compact data-feed-state="unavailable" @action=${()=>void this.loadFeed()}></sw-state-panel>`;const s=this.page,i=s?.coverage.gaps[0],n=Pe(s?.tracked_since),o=this.filters,d=o.actor!==""||o.kind!=="",b=this.feed.length?a`${s?.availability==="partial"||i?a`<div class="gap" role="note" data-feed-state="partial"><sw-icon name="warning" size=${14}></sw-icon><span>${i?Fe(i):r("deviceActivity.partialBanner")}</span></div>`:c}
          <div class="feed ${this.view}" role="list" aria-label=${r("deviceActivity.feedList")} data-feed-view=${this.view}>
            ${Ne(this.feed).map(h=>a`<section class="dg" data-day-group>
                <div class="day" data-day><span class="dl">${h.label}</span><span class="dn" aria-label=${h.items.length===1?r("deviceActivity.eventOne"):m("deviceActivity.eventsCount",{n:h.items.length})}>${h.items.length}</span></div>
                <div class="dgb">${se(h.items,w=>w.id,w=>this.view==="list"?this.renderRow(w,e):this.renderEvent(w,e))}</div>
              </section>`)}
          </div>
          ${this.loadingMore?this.renderSkeletons(2):c}
          ${s?.next_cursor?a`<div class="more"><sw-button size="sm" ?disabled=${this.loadingMore} data-load-more @click=${()=>void this.loadFeed(!0)}>${this.loadingMore?r("deviceActivity.loadingMore"):r("deviceActivity.loadMore")}</sw-button></div>`:c}`:Re(o)?a`<sw-state-panel icon="activity" state="empty" heading=${r("deviceActivity.emptyTitle")} actionLabel=${d?r("deviceActivity.clearFilters"):r("deviceActivity.widen")} compact data-feed-state="empty-filtered"
            @action=${()=>d?this.clearFilters():this.setFilter({period:"month"})}></sw-state-panel>`:a`<sw-state-panel icon="activity" state="empty" heading=${s?.tracked_since?r("deviceActivity.emptyTitle"):r("deviceActivity.emptyNone")} compact data-feed-state="empty"></sw-state-panel>`;return a`${t}${b}<div class="pf" data-foot>${n?a`<span data-tracked-since>${n}</span> · `:c}${qe(s?.retention_days??90,this.feed.some(h=>h.actor.type==="device"))}</div>`}renderEvent(e,t){const s=B(e),i=U(e,t.kind),n=j(e,t.kind);return a`<div class="ev" role="listitem" data-event=${e.id} data-actor=${s.type} data-tone=${n}>
      <span class=${`av ${s.type}`} aria-hidden="true">${s.type==="person"&&s.initials?s.initials:a`<sw-icon name=${s.glyph} size=${14}></sw-icon>`}<i class="tn"></i></span>
      <div class="c">
        <div class="l1">${s.prefix?a`<span class="kd">${s.prefix}:</span> `:c}<b>${y(s.name)}</b><span class="vb">${i.verb}</span>${s.qualifier?a`<span class="mt">${s.qualifier}</span>`:c}</div>
        <div class="l2">${i.from||i.to?a`<span class="ba">${i.from?a`<i><bdi>${i.from}</bdi></i><span class="arr" aria-hidden="true">←</span>`:c}<b><bdi>${i.to}</bdi></b></span>`:c}${e.note?a`<span class="mt">${e.note}</span>`:c}</div>
      </div>
      <time class="t" datetime=${e.at} title=${K(e.at)}>${W(e.at)}</time>
    </div>`}renderRow(e,t){const s=B(e),i=U(e,t.kind),n=j(e,t.kind);return a`<div class="rw" role="listitem" data-event=${e.id} data-actor=${s.type} data-tone=${n}>
      <time class="t" datetime=${e.at} title=${K(e.at)}>${W(e.at)}</time>
      <i class="tn" aria-hidden="true"></i>
      <span class="who">${s.prefix?a`<span class="kd">${s.prefix}:</span> `:c}<b>${y(s.name)}</b>${s.qualifier?a` <span class="mt">${s.qualifier}</span>`:c}</span>
      <span class="what"><span class="vb">${i.verb}</span>${i.from||i.to?a`<span class="ba">${i.from?a`<i><bdi>${i.from}</bdi></i><span class="arr" aria-hidden="true">←</span>`:c}<b><bdi>${i.to}</bdi></b></span>`:c}</span>
    </div>`}renderSchedules(){const t=I("schedule.manage")||this.sched.some(s=>s.can.edit)?a`<div class="addrow"><sw-button size="sm" icon="plus" data-sched-add @click=${()=>this.openEditor("")}>${r("deviceActivity.schedAdd")}</sw-button></div>`:c;return this.schedStatus==="loading"?a`<div class="skels" data-sched-state="loading" role="status" aria-label=${r("deviceActivity.schedLoading")}>${[0,1].map(()=>a`<div class="sk"><span><i class="skel a"></i><i class="skel b"></i></span><i class="skel d"></i></div>`)}</div>`:this.schedStatus==="forbidden"?a`<sw-state-panel state="forbidden" heading=${r("deviceActivity.schedForbidden")} compact data-sched-state="forbidden"></sw-state-panel>`:this.schedStatus==="unavailable"?a`<sw-state-panel state="error" heading=${r("deviceActivity.schedUnavailable")} actionLabel=${r("deviceActivity.retry")} compact data-sched-state="unavailable" @action=${()=>void this.loadSched()}></sw-state-panel>`:this.sched.length?a`${this.sched.map(s=>this.renderSched(s))}${t}`:a`<sw-state-panel icon="activity" state="empty" heading=${r("deviceActivity.schedEmpty")} compact data-sched-state="empty"></sw-state-panel>${t}`}renderSched(e){const t=!e.can.edit,s=t||e.read_only,i=e.entities.length>1;return a`<div class="sr" data-schedule=${e.id}>
      <div class="c"><div class="nm">${y(e.display_name)}${s?a` <span class="tag" data-readonly><sw-icon name="lock" size=${11}></sw-icon>${r("deviceActivity.schedReadOnly")}</span>`:c}${i?a` <span class="tag">${r("deviceActivity.schedMore")}</span>`:c}</div>
        <div class="nx"><span>${xe(e)}</span><span class="dy"> · ${_e(e.days.tokens)}</span></div></div>
      <sw-toggle controlled .checked=${e.enabled} ?disabled=${!e.can.toggle||this.busy.has(e.id)} label=${e.enabled?r("deviceActivity.schedEnabled"):r("deviceActivity.schedDisabled")} labelHidden data-sched-toggle @change=${n=>void this.toggle(e,n.detail.checked)}></sw-toggle>
      <sw-button iconOnly size="sm" variant="ghost" icon=${t?"eye":"edit"} label=${t?r("deviceActivity.schedView"):r("deviceActivity.schedEdit")} data-sched-edit @click=${()=>this.openEditor(e.id)}></sw-button>
    </div>`}openEditor(e){if(customElements.get("schedule-editor")){this.editing={id:e};return}const t=this.popupSeq;E("schedule-editor").then(()=>{t===this.popupSeq&&(this.editing={id:e})},s=>console.warn("schedule editor chunk failed to load",s))}renderEditor(){const e=this.editing,t=this.target;return!e||!t||!customElements.get("schedule-editor")?c:a`<sw-sheet open wide heading=${e.id?r("deviceActivity.schedEditTitle"):r("deviceActivity.schedNewTitle")} data-device-activity-editor @close=${()=>{this.editing=null,this.open=!0,this.loadSched()}}>
      <schedule-editor .scheduleId=${e.id} .entity=${t.id} @saved=${this.onSaved}></schedule-editor>
    </sw-sheet>`}};l.styles=[Se,X`
    :host { display: contents; }

    /* CARD1: the equipment card between the head and the tabs */
    .card { display: grid; gap: var(--sw-s-2); padding: var(--sw-s-3) var(--sw-s-3h); margin-block: 2px var(--sw-s-3); border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1px solid var(--sw-border); }
    .card.on { background: var(--sw-accent-soft); border-color: transparent; }
    .card .st { display: flex; align-items: baseline; gap: var(--sw-s-2); flex-wrap: wrap; min-inline-size: 0; }
    .cdot { flex: none; align-self: center; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-text-3); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-text-3) 18%, transparent); }
    .cdot.on { background: var(--sw-success); box-shadow: 0 0 0 3px var(--sw-success-soft); }
    .cdot.moving { background: var(--sw-stale); box-shadow: 0 0 0 3px var(--sw-stale-soft); animation: pulse 1.2s ease-in-out infinite; }
    .cdot.unknown { background: transparent; border: 1.5px dashed var(--sw-border-strong); box-shadow: none; }
    .card .big { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); }
    .card.on .big { color: var(--sw-accent-text); }
    .card .meta { color: var(--sw-text-2); font-size: var(--sw-fs-sm); display: inline-flex; flex-wrap: wrap; gap: 0 var(--sw-s-1); align-items: center; }
    .card .bat { display: inline-flex; align-items: center; gap: 3px; }
    .card .bat.low { color: var(--sw-danger-text); }
    .card .acts { display: flex; align-items: center; gap: var(--sw-s-2); flex-wrap: wrap; }
    .card .acts sw-button { --sw-touch-desktop: 36px; }
    .chips { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .chips .cl { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .chip {
      min-block-size: 30px; padding: 0 10px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text);
      font: inherit; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium); cursor: pointer; font-variant-numeric: tabular-nums;
    }
    .chip:hover { background: var(--sw-surface-3); }
    .chip:disabled { opacity: .45; cursor: not-allowed; }
    .chip:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .auto { display: flex; align-items: center; gap: var(--sw-s-2); color: var(--sw-text-2); font-size: var(--sw-fs-sm); min-block-size: 28px; }
    .auto span { flex: 1; min-inline-size: 0; }
    /* the hold-to-confirm button: a bar fills it over HOLD_MS while the pointer is held */
    .hbtn {
      position: relative; overflow: hidden; isolation: isolate; display: inline-flex; align-items: center; justify-content: center; min-block-size: 36px; padding-inline: 16px;
      border-radius: var(--sw-r-sm); border: 1px solid var(--sw-accent); background: var(--sw-accent); color: var(--sw-text-inverse); font: inherit; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium);
      cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    }
    .hbtn .lb { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; }
    .hbtn .prog { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: 0; background: rgba(255, 255, 255, .35); }
    .hbtn.holding .prog { inline-size: 100%; transition: inline-size var(--hold, 1100ms) linear; }
    .hbtn.armed { background: var(--sw-warning-soft); border-color: var(--sw-warning); color: var(--sw-warning-text); }
    .hbtn:disabled { opacity: .45; cursor: not-allowed; }
    .hbtn:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .hbtn.holding .prog { transition: none; inline-size: 100%; opacity: .5; } }
    .skels.tight { padding: 0; }
    .scrim { position: fixed; inset: 0; z-index: calc(var(--sw-z-modal) + 1); }
    .menu {
      position: fixed; z-index: calc(var(--sw-z-modal) + 2); min-inline-size: 176px; max-inline-size: calc(100vw - 16px); padding: var(--sw-s-1);
      background: var(--sw-menu-surface); color: var(--sw-text); border: 1px solid var(--sw-menu-border); border-radius: var(--sw-r-md); box-shadow: var(--sw-shadow-3);
      display: grid; gap: 2px;
    }
    .menu button {
      display: flex; align-items: center; gap: var(--sw-s-2); min-block-size: var(--sw-touch-desktop); padding: 0 var(--sw-s-3);
      background: transparent; border: 0; border-radius: var(--sw-r-sm); color: inherit; font: inherit; font-size: var(--sw-fs-md); cursor: pointer; text-align: start;
    }
    .menu button:hover, .menu button:focus-visible { background: var(--sw-accent-soft); color: var(--sw-accent-text); outline: none; }
    .menu button:focus-visible { box-shadow: 0 0 0 2px var(--sw-focus); }
    /* CR-038 D17: the ticket items under a divider, the device's open count at the end of its row */
    .menu hr { border: 0; border-block-start: 1px solid var(--sw-menu-border); margin: var(--sw-s-1) var(--sw-s-2); }
    .menu .ml { flex: 1; }
    .menu .mc { min-inline-size: 20px; padding-inline: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); color: var(--sw-text-2); font-size: var(--sw-fs-xs); text-align: center; font-variant-numeric: tabular-nums; }

    .ph { display: flex; align-items: center; gap: var(--sw-s-3); min-inline-size: 0; flex: 1; }
    .ic { display: grid; place-items: center; inline-size: 36px; block-size: 36px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); color: var(--sw-accent-text); flex: none; }
    .ph.off .ic { background: var(--sw-surface-3); color: var(--sw-text-2); }
    .tt { min-inline-size: 0; }
    .tt h3 { margin: 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-semibold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { color: var(--sw-text-2); font-size: var(--sw-fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .segt { display: flex; gap: 2px; padding: 3px; margin-block-end: var(--sw-s-2); background: var(--sw-surface-3); border-radius: var(--sw-r-pill); }
    .segt button {
      flex: 1; min-block-size: 36px; border: 0; border-radius: var(--sw-r-pill); background: transparent; color: var(--sw-text-2); font: inherit; font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: var(--sw-s-1h);
    }
    .segt button.on { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-accent-text)); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .segt button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .cnt { font-size: var(--sw-fs-xs); background: var(--sw-accent-soft); color: var(--sw-accent-text); border-radius: var(--sw-r-pill); padding: 0 6px; }

    .pbody { min-block-size: 120px; max-block-size: min(60vh, 520px); overflow: auto; margin-inline: calc(var(--sw-s-1) * -1); padding-inline: var(--sw-s-1); scrollbar-width: thin; }
    /* a phone: the sheet itself scrolls, one scroller only (no list inside a list) */
    @media (max-width: 767px) { .pbody { max-block-size: none; overflow: visible; } }

    /* ---- the toolbar: filters at the start, the view toggle and refresh at the end; on a phone the chips scroll sideways in one row ---- */
    .fl { display: flex; align-items: center; gap: var(--sw-s-2); padding-block: var(--sw-s-1h) var(--sw-s-2); }
    .fchips { flex: 1 1 auto; min-inline-size: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .ftools { flex: none; display: inline-flex; align-items: center; gap: 2px; }
    @media (max-width: 767px) {
      .fl { align-items: flex-start; }
      .fchips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-block: 2px; margin-inline: calc(var(--sw-s-1) * -1); padding-inline: var(--sw-s-1); }
      .fchips::-webkit-scrollbar { display: none; }
      .fchips > * { flex: none; }
    }
    .clr {
      display: inline-flex; align-items: center; gap: 4px; min-block-size: 32px; padding-inline: 10px; border-radius: var(--sw-r-pill); border: 1px dashed var(--sw-border-strong);
      background: transparent; color: var(--sw-text-2); font: inherit; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium); cursor: pointer; white-space: nowrap;
    }
    .clr:hover { background: var(--sw-surface-3); color: var(--sw-text); }
    .clr:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .clr .n { min-inline-size: 16px; block-size: 16px; display: inline-grid; place-items: center; border-radius: var(--sw-r-pill); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: 10px; font-variant-numeric: tabular-nums; }
    .vw { display: inline-flex; padding: 2px; gap: 2px; border-radius: var(--sw-r-sm); background: var(--sw-surface-3); }
    .vw button { display: inline-grid; place-items: center; inline-size: 28px; block-size: 28px; border: 0; border-radius: calc(var(--sw-r-sm) - 2px); background: transparent; color: var(--sw-text-2); cursor: pointer; padding: 0; }
    .vw button.on { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-accent-text)); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .vw button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }

    /* ---- the day groups: a sticky day line (translucent, so the sheet's glass stays) with the count at its end ---- */
    .feed { display: grid; gap: var(--sw-s-2); }
    .dg { min-inline-size: 0; }
    .day {
      position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-2);
      padding: var(--sw-s-2) 2px var(--sw-s-1); color: var(--sw-text-3); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold);
      /* the sheet's own colour, nearly opaque: no second backdrop blur inside the blurred sheet (a phone pays for nested blurs) */
      background: rgba(var(--sw-sheet-rgb), max(var(--sw-sheet-alpha, 1), 0.92));
    }
    .dn { min-inline-size: 18px; padding-inline: 5px; block-size: 18px; display: inline-grid; place-items: center; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); color: var(--sw-text-2); font-variant-numeric: tabular-nums; font-weight: var(--sw-fw-medium); }
    /* cards: the day's events sit in one soft card */
    .feed.cards .dgb { border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); background: var(--sw-surface-2); padding-inline: var(--sw-s-3); }
    .ev { display: grid; grid-template-columns: 28px 1fr auto; gap: var(--sw-s-3); align-items: center; min-block-size: 52px; border-block-end: 1px solid var(--sw-border); padding-block: var(--sw-s-1h); }
    .feed.cards .ev:last-child { border-block-end: 0; }
    .av { position: relative; display: grid; place-items: center; inline-size: 28px; block-size: 28px; border-radius: 50%; background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); }
    .av.unknown { background: transparent; border: 1px dashed var(--sw-border-strong); color: var(--sw-text-3); }
    .av.automation, .av.schedule, .av.scene, .av.device, .av.system { background: var(--sw-surface-3); color: var(--sw-text-2); }
    /* the tone marker: a small dot - on (success), off (muted), a value change (accent), availability lost (stale) / back (success ring) */
    .tn { display: block; inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--sw-text-3); box-sizing: border-box; }
    .av .tn { position: absolute; inset-inline-end: -2px; inset-block-end: -1px; inline-size: 10px; block-size: 10px; border: 2px solid var(--sw-surface-2); }
    [data-tone='on'] .tn { background: var(--sw-success); }
    [data-tone='off'] .tn { background: var(--sw-text-3); }
    [data-tone='value'] .tn { background: var(--sw-accent); }
    [data-tone='lost'] .tn { background: var(--sw-stale); }
    [data-tone='back'] .tn { background: var(--sw-success-soft); border-color: var(--sw-success); }
    .rw[data-tone='back'] .tn { border: 2px solid var(--sw-success); }
    .c { min-inline-size: 0; }
    .l1 { font-size: var(--sw-fs-md); display: flex; flex-wrap: wrap; gap: 0 var(--sw-s-1h); align-items: baseline; }
    .l1 .kd, .vb { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .l2 { display: flex; flex-wrap: wrap; gap: 0 var(--sw-s-2); color: var(--sw-text-2); font-size: var(--sw-fs-sm); align-items: baseline; }
    .ba i { font-style: normal; } .ba b { color: var(--sw-text); font-weight: var(--sw-fw-medium); } .arr { margin-inline: var(--sw-s-1); }
    [data-tone='on'] .ba b { color: var(--sw-success); }
    [data-tone='lost'] .ba b { color: var(--sw-stale); }
    .mt { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .t { color: var(--sw-text-3); font-size: var(--sw-fs-sm); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    /* list: one dense line per event - clock | dot | who | what */
    .rw { display: grid; grid-template-columns: auto 8px fit-content(42%) minmax(0, 1fr); gap: var(--sw-s-2); align-items: center; min-block-size: 36px; border-block-end: 1px solid var(--sw-border); padding-block: var(--sw-s-1); font-size: var(--sw-fs-sm); }
    .rw .t { min-inline-size: 38px; }
    .rw .tn { inline-size: 8px; block-size: 8px; }
    .rw .who, .rw .what { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rw .who b { font-weight: var(--sw-fw-medium); color: var(--sw-text); }
    .rw .what .vb { margin-inline-end: var(--sw-s-1h); }
    @media (max-width: 480px) {
      .rw { grid-template-columns: auto 8px minmax(0, 1fr); }
      .rw .what { grid-column: 3; }
    }
    .more { display: flex; justify-content: center; padding: var(--sw-s-3); }
    .pf { padding-block: var(--sw-s-2) 0; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .gap { display: flex; gap: var(--sw-s-2); align-items: center; padding: var(--sw-s-2) var(--sw-s-3); margin-block: var(--sw-s-1h); border-radius: var(--sw-r-sm); background: var(--sw-warning-soft); color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }

    .skels { display: grid; gap: var(--sw-s-3); padding: var(--sw-s-2) 0; }
    .sk { display: grid; grid-template-columns: auto 1fr 30px; gap: var(--sw-s-3); align-items: center; }
    .sk > span { display: grid; gap: 6px; }
    .sk.l { grid-template-columns: 38px 8px 1fr 1.2fr; gap: var(--sw-s-2); min-block-size: 28px; }
    .skel { display: block; block-size: 12px; border-radius: var(--sw-r-xs); background: var(--sw-surface-3); animation: pulse 1.2s ease-in-out infinite; }
    .skel.c { inline-size: 28px; block-size: 28px; border-radius: 50%; } .skel.a { inline-size: 60%; } .skel.b { inline-size: 35%; block-size: 10px; } .skel.d { block-size: 10px; }
    .skel.dot { inline-size: 8px; block-size: 8px; border-radius: 50%; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) { .skel, .cdot.moving { animation: none; } }

    .sr { display: grid; grid-template-columns: 1fr auto auto; gap: var(--sw-s-3); align-items: center; min-block-size: 56px; border-block-end: 1px solid var(--sw-border); padding-block: var(--sw-s-1h); }
    .nm { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); } .nx { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .tag { display: inline-flex; align-items: center; gap: 3px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-regular); color: var(--sw-text-2); background: var(--sw-surface-3); border-radius: var(--sw-r-pill); padding: 1px 7px; }
    .addrow { display: flex; padding-block: var(--sw-s-3) var(--sw-s-1); }
  `];u([p()],l.prototype,"open",2);u([p()],l.prototype,"target",2);u([p()],l.prototype,"area",2);u([p()],l.prototype,"tab",2);u([p()],l.prototype,"menu",2);u([p()],l.prototype,"filters",2);u([p()],l.prototype,"view",2);u([p()],l.prototype,"feed",2);u([p()],l.prototype,"page",2);u([p()],l.prototype,"feedStatus",2);u([p()],l.prototype,"loadingMore",2);u([p()],l.prototype,"sched",2);u([p()],l.prototype,"schedStatus",2);u([p()],l.prototype,"editing",2);u([p()],l.prototype,"busy",2);u([p()],l.prototype,"row",2);u([p()],l.prototype,"rowStatus",2);u([p()],l.prototype,"holding",2);u([p()],l.prototype,"timerBusy",2);u([p()],l.prototype,"timerNote",2);u([p()],l.prototype,"menuSource",2);u([p()],l.prototype,"tdata",2);u([p()],l.prototype,"tstatus",2);u([p()],l.prototype,"creating",2);u([p()],l.prototype,"meta",2);u([p()],l.prototype,"newMode",2);u([p()],l.prototype,"ticketsOn",2);l=u([ie("device-activity")],l);export{l as DeviceActivity};
