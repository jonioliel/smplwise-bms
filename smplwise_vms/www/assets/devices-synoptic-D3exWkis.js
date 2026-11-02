import{E as as,a as ts,ax as ns,ay as is,ae as rs,R as os,az as ls,i as F,l as G,pz as ps,aw as Q,aH as a,e as t,aC as J,aD as ds,aA as N,aB as cs,aE as hs,aF as ms,aG as us,qk as ws,ql as c,qm as R,A as d,q as z,qn as gs,qo as vs,qp as xs,aj as D,aK as bs,aL as fs,qq as $s,qr as Z,qs as ys,qt as ks,qu as W,aQ as H,qv as ss,bu as zs,qw as Os,qx as Ls,qy as Fs,qz as K,F as As,G as C,qA as Ss,H as _s}from"./index-Iu0qJdv4.js";import"./sw-logo-art-Va6y_cIM.js";const Cs=as`
  .pboard { display: grid; gap: 8px; block-size: 100%; min-block-size: 0; box-sizing: border-box; }
  .pboard.card { padding: 10px 12px; }
  .pboard.pa { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .pboard.pb { grid-template-rows: auto auto minmax(0, 1fr); }
  .pboard.pc { grid-template-rows: auto auto minmax(0, 1fr) auto; padding-block-end: 0; }
  .phead { display: flex; align-items: center; gap: 6px; min-inline-size: 0; min-block-size: 36px; }
  .phead .chips { flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; }
  .phead .live { flex: none; }
  .ib { flex: none; inline-size: 44px; block-size: 44px; margin-block: -4px; margin-inline-end: -10px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--sw-r-md); background: transparent; color: var(--sw-text-2); cursor: pointer; }
  .ib .xi { inline-size: 20px; block-size: 20px; }

  /* every pressable of the phone board: no tap flash, no long-press selection, the click fires at once, the press answers on pointer-down */
  .ib, .pan, .plc, .pfh, .pmt, .pl1, .ppl { font: inherit; color: inherit; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-press) var(--sw-ease); }
  .ib:active, .pan:active, button.plc:active, button.pmt:active, button.ppl:active, .pfh:active, .pl1:active { transform: scale(var(--sw-press-scale)); }

  /* numbers: tabular, isolated left-to-right inside a right-to-left row */
  .n { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
  .pv { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-text); white-space: nowrap; text-align: center; font-variant-numeric: tabular-nums; }
  .pv.mut { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
  .pv.warn { color: var(--sw-danger-text); }
  .pv small, .pval small, .ppl small { font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); margin-inline-start: 1px; direction: ltr; unicode-bidi: isolate; }
  .pv[data-t='hot'], .pval[data-t='hot'] { color: color-mix(in srgb, var(--sw-heat) 62%, var(--sw-heading)); }
  .pv[data-t='cold'], .pval[data-t='cold'] { color: color-mix(in srgb, var(--sw-cool) 62%, var(--sw-heading)); }
  .pv .xi, .pval .xi { inline-size: 16px; block-size: 16px; vertical-align: -3px; }
  .mb { display: block; inline-size: 34px; block-size: 4px; border-radius: 2px; background: var(--sw-surface-3); overflow: hidden; }
  .mb i { display: block; block-size: 100%; border-radius: 2px; background: var(--sw-lit); }
  .pgl { flex: none; display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  .pgl::before, .pgl::after { content: ''; flex: 1; block-size: 2px; border-radius: 2px; background: var(--sw-border-strong); }

  /* A - the compact table */
  .pah, .par, .pfr { display: grid; grid-template-columns: var(--pgrid); align-items: center; column-gap: 6px; }
  .pah { block-size: 24px; padding: 0 10px; color: var(--sw-text-3); }
  .pah > span { display: flex; justify-content: center; min-inline-size: 0; }
  .pah > span:first-child { justify-content: flex-start; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); }
  .pah .xi { inline-size: 16px; block-size: 16px; }
  .plist, .pbl, .cl { min-block-size: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--sw-border-strong) transparent; }
  .plist { display: flex; flex-direction: column; gap: 4px; }
  .par { flex: none; min-block-size: 52px; padding: 0 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
  .plist[data-dense] .par { min-block-size: 44px; }
  .par[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
  .par[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
  .par[data-fire='alarm'], .pfc[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); box-shadow: inset 0 0 0 2px var(--sw-danger); }
  .pan { display: flex; flex-direction: column; justify-content: center; min-inline-size: 0; min-block-size: 44px; padding: 0; border: 0; background: transparent; text-align: start; cursor: pointer; border-radius: var(--sw-r-2xs); }
  .pan .t, .pfh .t { font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pan .t { font-size: var(--sw-fs-md); }
  .pan .s, .pfh .s { color: var(--sw-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pan .s { font-size: var(--sw-fs-xs); }
  .plist[data-dense] .pan .t { font-size: var(--sw-fs-base); }
  .plist[data-dense] .pan .s { font-size: var(--sw-fs-2xs); }
  [data-off] .pan .t, [data-off] .pfh .t, [data-off] .pl1 .t { color: var(--sw-text-2); }
  .pcell { display: flex; justify-content: center; min-inline-size: 0; overflow: hidden; }
  .plc { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-inline-size: 0; min-block-size: 44px; padding: 0; border: 0; border-radius: var(--sw-r-sm); background: transparent; }
  button.plc { cursor: pointer; }

  /* B - one card per floor (above six floors: one row each) */
  .pbl { display: flex; flex-direction: column; gap: 8px; padding-block-end: 2px; }
  .pfc { flex: none; padding: 4px 12px 10px; }
  .pfc.row { padding: 0 12px; }
  .pfh { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; inline-size: 100%; min-block-size: 46px; padding: 0; border: 0; background: transparent; text-align: start; cursor: pointer; border-radius: var(--sw-r-2xs); }
  .pfh > span { min-inline-size: 0; display: flex; flex-direction: column; }
  .pfh .t { font-size: var(--sw-fs-lg); }
  .pfh .s { font-size: var(--sw-fs-state); }
  .pfh .xi, .pfr > .xi { inline-size: 16px; block-size: 16px; color: var(--sw-text-3); }
  :host(:dir(ltr)) .xi.fwd { transform: scaleX(-1); }
  .pfr { min-block-size: 50px; }
  .pfr .pfh { min-block-size: 50px; grid-template-columns: minmax(0, 1fr); }
  .pfm { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .pmt { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; min-block-size: 52px; padding: 7px 9px; border: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); text-align: start; }
  button.pmt { cursor: pointer; }
  .pmt .k { display: flex; align-items: center; gap: 5px; min-inline-size: 0; font-size: var(--sw-fs-xs); color: var(--sw-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pmt .k .xi { inline-size: 14px; block-size: 14px; }
  .pval { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); line-height: 1.15; color: var(--sw-text); text-align: start; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pmt.lit { background: color-mix(in srgb, var(--sw-lit) 16%, var(--sw-surface-2)); }
  .pmt.lit .mb { inline-size: 100%; margin-block-start: 3px; background: color-mix(in srgb, var(--sw-border-strong) 70%, transparent); }
  .pmt.mut .pval { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
  .pmt.warn .pval { color: var(--sw-danger-text); }
  .pmt.dash { background: transparent; outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }

  /* C - the cross-section first: roof, slabs warm by the share of lights on, the ground line and the floors below it */
  .cl { display: grid; grid-template-columns: var(--slab) minmax(0, 1fr); column-gap: 10px; row-gap: 3px; align-content: start; padding-block-end: 8px; }
  .roof { block-size: 12px; margin: 0 4px -1px; background: var(--sw-border-strong); clip-path: polygon(12% 0, 88% 0, 100% 100%, 0 100%); border-radius: 2px; }
  .sl { position: relative; min-block-size: 58px; border: 1.5px solid var(--sw-border-strong); border-radius: var(--sw-r-2xs); background: var(--sw-surface); overflow: hidden; }
  .cl[data-dense] .sl { min-block-size: 44px; }
  .sl.bg { background: var(--sw-surface-3); }
  .sl > i { position: absolute; inset-block: 0; inset-inline-start: 0; background: color-mix(in srgb, var(--sw-lit) 70%, transparent); }
  .sl > em { position: absolute; inset-inline-end: 4px; inset-block-end: 2px; font-style: normal; font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); font-variant-numeric: tabular-nums; direction: ltr; }
  .sl[data-sel] { border-color: var(--sw-accent); box-shadow: 0 0 0 1.5px var(--sw-accent); }
  .ci { display: flex; flex-direction: column; justify-content: center; gap: 4px; min-inline-size: 0; min-block-size: 44px; padding: 4px 0; }
  .pl1 { display: flex; align-items: baseline; gap: 6px; min-inline-size: 0; min-block-size: 24px; padding: 0; border: 0; border-radius: var(--sw-r-2xs); background: transparent; text-align: start; cursor: pointer; }
  .pl1 .t { flex: none; max-inline-size: 60%; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pl1[aria-pressed='true'] .t { color: var(--sw-accent-text); }
  .pl1 .s { min-inline-size: 0; font-size: var(--sw-fs-xs); color: var(--sw-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppls { display: flex; gap: 5px; flex-wrap: nowrap; min-inline-size: 0; }
  .ppl { position: relative; flex: none; display: inline-flex; align-items: center; gap: 4px; block-size: 24px; padding: 0 8px; border: 0; border-radius: var(--sw-r-pill); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text); white-space: nowrap; font-variant-numeric: tabular-nums; }
  button.ppl { cursor: pointer; }
  button.ppl::after { content: ''; position: absolute; inset: -10px 0; } /* a 44 px tall touch target around the 24 px pill (no sideways overflow) */
  .ppl .xi { inline-size: 13px; block-size: 13px; color: var(--sw-text-2); }
  .ppl.lit { background: color-mix(in srgb, var(--sw-lit) 24%, var(--sw-surface)); }
  .ppl.mut { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
  .ppl.warn { color: var(--sw-danger-text); }
  .ppl.dash { background: transparent; outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; color: var(--sw-text-3); }
  .cl[data-dense] .ci { flex-direction: row; align-items: center; justify-content: space-between; gap: 6px; }
  .cl[data-dense] .pl1 .s { display: none; }
  /* name and pills share one line: the pills keep their size, the name gives way and ellipsises (320 px, 12 floors) */
  .cl[data-dense] .pl1 { flex: 1 1 auto; }
  .cl[data-dense] .pl1 .t { flex: 0 1 auto; min-inline-size: 0; max-inline-size: none; font-size: var(--sw-fs-base); }
  .cl[data-dense] .ppls { flex: none; }
  .cl[data-dense] .ppl { block-size: 22px; padding: 0 6px; font-size: var(--sw-fs-state); }
  .soil { grid-column: 1; block-size: 8px; margin: 1px 0; background: repeating-linear-gradient(135deg, var(--sw-border-strong) 0 2px, transparent 2px 6px); border-block-start: 2px solid var(--sw-border-strong); }
  .soiltx { grid-column: 2; block-size: 8px; margin-block-start: 1px; border-block-start: 2px solid var(--sw-border-strong); }
  .dstrip { display: flex; align-items: center; gap: 8px; min-block-size: 52px; margin-inline: -12px; padding: 6px 12px; border-block-start: 1px solid var(--sw-border); }
  .dstrip .tx { flex: 1; min-inline-size: 0; font-size: var(--sw-fs-sm); line-height: 1.35; color: var(--sw-text-2); }
  .dstrip .tx b { display: block; font-size: var(--sw-fs-md); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* the info sheet (sub-answer 3B: the board's summary behind the info button) */
  .pinfo .sub { margin: 0 0 10px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .pinfo dl { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 12px; font-size: var(--sw-fs-base); }
  .pinfo dt { color: var(--sw-text-3); }
  .pinfo dd { margin: 0; color: var(--sw-text); }
  .pinfo .hint { margin: 12px 0 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .pinfo .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-block-start: 14px; }

  @media (hover: hover) and (pointer: fine) {
    .par:hover { background: var(--sw-surface-3); }
    button.plc:hover, button.ppl:hover { background: color-mix(in srgb, var(--sw-lit) 14%, transparent); }
    button.pmt:hover { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface-2)); }
    .ib:hover { background: var(--sw-surface-2); }
  }
`;var qs=Object.defineProperty,Is=Object.getOwnPropertyDescriptor,A=(e,s,r,i)=>{for(var p=i>1?void 0:i?Is(s,r):s,o=e.length-1,h;o>=0;o--)(h=e[o])&&(p=(i?h(s,r,p):h(p))||p);return i&&p&&qs(s,r,p),p};const Ps=3e4,V={light:"colLight",temp:"colTemp",presence:"colPresence",cameras:"colCameras",doors:"colDoors",alerts:"colAlerts",fire:"colFire"},U={light:"light",temp:"therm",presence:"person",cameras:"cam",doors:"door",alerts:"bell",fire:"flame"},Ts={light:"lightsOn",temp:"phTemp",presence:"phPresence",cameras:"colCameras",doors:"phDoors",alerts:"phAlerts",fire:"phFire"},es=()=>new Date().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});let k=class extends ts{constructor(){super(...arguments),this.wall=!1,this.tree=null,this.data=null,this.lightsOf=null,this.events=null,this.error="",this.sel="all",this.now=es(),this.info=!1,this.timers=[],this.stops=[],this.onResize=()=>this.requestUpdate(),this.phoneSet=new Set}connectedCallback(){super.connectedCallback(),this.stops.push(ns(()=>this.requestUpdate()),is(()=>this.requestUpdate())),window.addEventListener("resize",this.onResize),this.load(),this.timers.push(window.setInterval(()=>this.now=es(),15e3),window.setInterval(()=>void this.refresh(),Ps))}disconnectedCallback(){window.removeEventListener("resize",this.onResize),this.timers.forEach(e=>window.clearInterval(e)),this.timers=[],this.stops.forEach(e=>e()),this.stops=[],super.disconnectedCallback()}async load(){try{this.tree=await rs(),this.error=""}catch(e){this.error=os(e)}await this.refresh()}async refresh(){if(this.data=await ls(),F()&&G("events.read"))try{this.events=(await ps({limit:8,buildingId:this.building()?.id})).events}catch{this.events=null}}lightsAllowed(e){return this.wall||e.nodata||e.lights===null?!1:!F()||this.data?.demo?!0:G("devices.read")&&Q(e)!==null}openLights(e,s){e?.stopPropagation(),this.lightsOf=s}renderLights(){const e=this.lightsOf,s=!F()||!!this.data?.demo,r=e&&!s?Q(e):null;return t`<devices-tiles-panel kind="lights" data-floor-lights=${e?.id??""} ?open=${!!e} pairedMaster
      scope=${r?.scope??"building"} scopeId=${r?.scopeId??""} scopeName=${e?.name??""} .areaFilter=${r?r.areaIds:null} switches=${this.opts().syn_switches}
      headingText=${e?a("floorLightsTitle",{name:e.name}):""}
      @panel-close=${()=>this.lightsOf=null} @panel-changed=${()=>void this.refresh()}></devices-tiles-panel>`}opts(){return F()?J():ds(J(),N().params)}building(){const e=this.tree;if(!e)return null;const s=N().params.get("b"),r=e.sites.flatMap(o=>o.buildings??[]),i=r.find(o=>o.id===s)??r[0]??null;if(!i)return null;const p=F()?0:Number(N().params.get("xsdemo"));return Number.isInteger(p)&&p>=1&&p<=40?cs(p,i,N().params.get("xsnames")==="long"):i}signals(e){return!F()||this.data?.demo?hs([...e].sort((s,r)=>r.level-s.level||r.sort_order-s.sort_order),F()?null:N().params.get("xsdata")):ms(e,this.data?.tree??null,this.data?.people??null,this.ctx(e),{switches:this.opts().syn_switches})}ctx(e){const s=e[0]?.building_id,r=this.tree?.sites.find(i=>(i.buildings??[]).some(p=>p.id===s))??null;return us(this.data,r)}noFloorLights(e,s){return!F()||this.data?.demo?null:ws(this.data?.tree??null,s,this.ctx(e),{switches:this.opts().syn_switches})}head(e){const s={light:["light",a("colLight")],temp:["therm",a("colTemp")],presence:["person",a("colPresence")],cameras:["cam",a("colCameras")],doors:["door",a("colDoors")],alerts:["bell",a("colAlerts")],fire:["flame",a("colFire")]};return t`<span data-syn-col=${e}>${c(s[e][0])}${s[e][1]}</span>`}cell(e,s,r,i){const p=R(s,r.temp_threshold);switch(e){case"light":{const h=s.lights?Math.round((s.lit??0)/s.lights*8):0,m=this.lightsAllowed(s);return s.lit===null||s.lights===null?t`<span class="cell muted" title=${a("noSource")}>-</span>`:t`<span class="cell ${m?"lights-hit":""}" data-syn-lights=${m?s.id:d} title=${m?a("floorLightsOpen",{name:s.name}):d} @click=${g=>m&&this.openLights(g,s)}><span class="fac" aria-hidden="true">${Array.from({length:8},(g,v)=>t`<i class=${v<h?"on":""}></i>`)}</span><b>${s.lit}/${s.lights}</b></span>`}case"temp":return s.temp===null||s.nodata?t`<span class="deg none" title=${a("noSource")}>-</span>`:t`<span class="deg" data-t=${p??""}>${s.temp.toFixed(1)}<small>°</small></span>`;case"presence":return s.people===null?t`<span class="cell muted">-</span>`:t`<span class="cell ${s.people?"":"muted"}">${c("person")}<b>${s.people}</b></span>`;case"cameras":return t`<span class="cell ${s.cams?"":"muted"}">${c("cam")}<b>${s.cams}</b>${s.shared?t`<span class="w">${a("camsShared",{n:s.shared})}</span>`:d}</span>`;case"doors":return s.doorsOpen===null?t`<span class="cell muted" title=${a("noSource")}>-</span>`:t`<span class="cell ${s.doorsOpen?"":"muted"}">${c("door")}<b>${s.doorsOpen}</b></span>`;case"alerts":return s.alerts===null?t`<span class="cell muted" title=${a("alertsNone")}>-</span>`:s.alerts?t`<span class="cell warn">${c("bell")}<b>${s.alerts}</b></span>`:t`<span class="cell muted">0</span>`;case"fire":{if(!i.connected)return t`<span class="cell muted" data-fire-nc>${c("offline")}<span class="w">${a("fireNotConnected")}</span></span>`;const o=i.floors[s.id];return o?o.state==="alarm"?t`<span class="fz alarm">${c("flame")}<span class="w">${a("fireAlarm")}</span></span>`:o.state==="fault"?t`<span class="fz fault">${c("wrench")}<span class="w">${a("fireFault")}</span></span>`:t`<span class="fz">${c("check")}<span class="w">${a("fireOk")}</span></span>`:t`<span class="cell muted">-</span>`}}}pick(e){this.sel=this.sel===e?"all":e}alarmPanel(e,s){const r=s.floors[e.id],i=Ss(),p=this.opts();return t`<div class="alarmpanel ${i?"ackd":""}" role="alert" data-alarm-panel>
      <span class="tx"><b>${i?a("fireAcked",{who:i.who}).split(" · ")[0]:a("fireAlarm")} · ${z(e.name)}${s.demo?t`<span class="tag">${a("fireDemo")}</span>`:d}</b>
        <span>${i?a("fireAcked",{who:i.who}):a("fireBarWhere",{zone:r.zone??"",device:r.device??"",time:r.time??""})}</span></span>
      ${i?d:t`<sw-ack-button .mode=${p.ack} .allowed=${gs(p)} @acked=${()=>vs(xs())}></sw-ack-button>`}
      <button class="lnk" @click=${()=>D(`/explore/floors/${e.id}`)}>${a("fireOpenFloor")}</button>
    </div>`}render(){const e=this.opts();if(this.wall&&!e.wall)return t`<sw-state-panel icon="tv" state="empty" heading=${a("wallOff")}></sw-state-panel>`;if(!this.tree)return this.frame(t`<sw-state-panel icon="floor" state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel>`,0);const s=this.building(),r=s?.floors??[];if(!s||!r.length)return this.frame(t`<sw-state-panel icon="floor" state="empty" heading=${a("emptyFloors")}></sw-state-panel>`,0);const i=this.signals(r),p=N().params.get("firemock");bs(e.fire_ui?p:null,i);const o=e.fire_ui?fs():{connected:!1,demo:!1,floors:{}},h=this.data?.demo?!0:!!this.data?.presenceOn,{cols:m,hiddenEmpty:g}=$s(e,h,o.connected,i),v=n=>m.includes(n),u=Z(i,e.temp_threshold),x=e.fire_ui?ys(o):[],E=i.find(n=>n.id===x[0]),q=i.some(n=>n.level<0)&&i.some(n=>n.level>=0),O=ks(m);this.phoneSet=new Set(O);let j=!1;const I=[];i.forEach(n=>{q&&n.level<0&&!j&&(j=!0,I.push(t`<div class="ground" aria-hidden="true"></div>`));const y=v("temp")?R(n,e.temp_threshold):null,$=o.floors[n.id];I.push(t`<button class="srow sgrid" style="--cols:${m.length};--pcols:${O.length}" data-syn-row=${n.id} aria-pressed=${this.sel===n.id} data-temp=${y??""} ?data-off=${n.nodata} data-fire=${$&&$.state!=="ok"?$.state:""} @click=${()=>this.pick(n.id)}
        aria-label=${`${n.name}${n.nodata?`, ${a("noData")}`:""}${$?.state==="alarm"?`, ${a("fireAlarm")} (${a("fireDemo")})`:""}`}>
        <span class="nm"><span class="t" dir="auto" title=${n.name}>${z(n.name)}</span><span class="s" data-syn-match=${n.match?.how??(n.match?"none":"")}>${this.subLine(n)}</span></span>
        ${m.map(_=>this.isPhoneCol(_)?this.cell(_,n,e,o):t`<span class="hide-phone">${this.cell(_,n,e,o)}</span>`)}
      </button>`)});const f=i.find(n=>n.id===this.sel)??null,P=v("light")?this.noFloorLights(r,i):null,T=t`<span class="chips">
      ${v("temp")&&u.avg!==null?t`<span class="chip" data-syn-chip="temp">${c("therm")}${a("avgTemp")} <b>${u.avg.toFixed(1)}°</b></span>`:d}
      ${v("light")&&u.litKnown?t`<span class="chip warm" data-syn-chip="light" title=${P?`${a("synInfoNoFloor")}: ${a("synInfoNoFloorVal",P)}`:d}>${c("light")}<b>${u.lit}/${u.lights}</b> ${a("lightsOn")}</span>`:d}
      ${v("presence")&&u.people!==null?t`<span class="chip hide-phone" data-syn-chip="presence">${c("person")}<b>${u.people}</b> ${a("colPresence")}</span>`:d}
      ${v("doors")&&u.doorsOpen!==null?t`<span class="chip hide-phone" data-syn-chip="doors">${c("door")}<b>${u.doorsOpen}</b> ${a("colDoors")}</span>`:d}
      ${u.nodata?t`<span class="chip dash">${c("offline")}${a("noDataCount",{n:u.nodata})}</span>`:d}
      ${x.length?t`<span class="chip alert">${c("flame")}${a("fireAlarm")} <span>${a("fireDemo")}</span></span>`:d}
      ${e.fire_ui&&!o.connected&&e.fire_column==="dashed"?t`<span class="chip dash">${c("flame")}${a("colFire")}: ${a("fireNotConnected")}</span>`:d}
      ${o.demo?t`<span class="chip mock">${a("fireDemo")}</span>`:d}
    </span>`;if(!this.wall&&window.innerWidth<768){const n=this.renderPhone(s,i,m,g,e,o,T,E??null,q,P);return this.frame(t`${n}${this.renderLights()}`,i.length,!0,a("synSite",{name:z(s.name),n:i.length}))}const B=t`<section class="card board" aria-label=${a("synTitle")} data-syn-board style="--n:${i.length}">
      <div class="bhead"><h2>${c("synoptic")}${a("synTitle")} · ${z(s.name)}</h2>${T}<span class="live"><i></i>${this.now}</span></div>
      ${E?this.alarmPanel(E,o):t`<span></span>`}
      <div class="sgrid shdr" style="--cols:${m.length};--pcols:${O.length}"><span>${a("synFloor")}</span>${m.map(n=>this.isPhoneCol(n)?this.head(n):t`<span class="hide-phone">${this.head(n)}</span>`)}</div>
      <div class="srows" style="--n:${i.length}" ?data-dense=${(window.innerHeight-330)/Math.max(1,i.length)<40}>${I}</div>
      <div class="detail" data-syn-detail>${f?t`<b>${z(f.name)}</b><span class="grow">${W(f.match)?`${W(f.match).text} · `:""}${f.nodata?a("noSource"):this.detailText(f,v)}</span>
          ${W(f.match)?.linked===!1&&this.canLink()?t`<button class="lnk" data-syn-link=${f.id} @click=${()=>this.linkFloor(s,f.id)}>${a("matchFix")}</button>`:d}
          ${v("light")&&this.lightsAllowed(f)?t`<sw-button size="sm" variant="ghost" icon="light" data-syn-lights-open=${f.id} @click=${()=>this.openLights(null,f)}>${a("floorLightsBtn")}</sw-button>`:d}
          <sw-button size="sm" variant="ghost" icon="map" data-syn-open @click=${()=>D(`/explore/floors/${f.id}`)}>${a("openMap")}</sw-button>`:this.allLine(s,i)}${this.hiddenNote(g)}</div>
    </section>`,S=!this.wall,b=S?t`<nav class="card tree hide-phone hide-narrow" aria-label=${a("synAll")} data-syn-tree>
          <button aria-pressed=${this.sel==="all"} @click=${()=>this.sel="all"}>${c("synoptic")}<span class="nm">${a("synAll")}</span>${v("light")?t`<span class="lit">${u.litKnown?u.lit:"-"}${c("light")}</span>`:d}</button>
          ${i.map(n=>t`<button aria-pressed=${this.sel===n.id} data-syn-tree-row=${n.id} @click=${()=>this.sel=n.id}><span class="nm" dir="auto">${z(n.name)}</span>${v("light")?t`<span class="lit">${n.lit===null?"-":n.lit}${c("light")}</span>`:d}</button>`)}
        </nav>`:d,l=S&&e.syn_events?t`<aside class="card events hide-phone hide-narrow" aria-label=${a("events")} data-syn-events><h3>${c("light")}${a("events")}</h3>
          ${this.events&&this.events.length?this.events.slice(0,8).map(n=>t`<div class="ev"><span>${c(n.type==="door"?"door":n.type==="offline"?"offline":"bell")}</span><span><b>${n.raw_type}</b><small>${n.camera_name??""}</small></span><time>${new Date(n.occurred_at).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</time></div>`):t`<span class="nc">${a("eventsNone")}</span>`}
        </aside>`:d,L=t`<div class="syn ${S&&window.innerWidth>=1100?"wide":""} ${S&&window.innerWidth>=1500&&e.syn_events?"ev":""}" data-syn>${window.innerWidth>=1100?b:d}${B}${window.innerWidth>=1500?l:d}</div>`;return this.wall?t`<div class="wallhead"><h1>${a("wallTitle")}</h1><span class="clock">${this.now}</span></div>${L}`:this.frame(t`${L}${this.renderLights()}`,i.length,!0)}subLine(e){const s=W(e.match);return s?s.linked?`${a("level",{n:H(e.level)})} · ${s.text}`:s.text:e.nodata?a("noDataSince"):a("level",{n:H(e.level)})}allLine(e,s){const r=ss(s);if(!r.length)return t`<span class="grow">${a("synAll")} · ${a("synSub",{n:s.length})}</span>`;const i=r.length===1?a("matchHintOne",{name:r[0].name}):a("matchHintMany",{n:r.length});return t`<span class="grow" data-syn-hint>${i}</span>${this.canLink()?t`<button class="lnk" data-syn-link=${r[0].id} @click=${()=>this.linkFloor(e,r[0].id)}>${a("matchHintAction")}</button>`:d}`}canLink(){return!this.wall&&!zs("structure")&&(!F()||G("site.content.configure"))}linkFloor(e,s){const r=F()?{}:Object.fromEntries([...N().params.entries()].filter(([i])=>i.startsWith("xs")));D(`/explore/buildings/${e.id}/floors`,{...r,ha:s})}isPhoneCol(e){return this.phoneSet.has(e)}detailText(e,s){const r=[];return s("temp")&&r.push(`${a("colTemp")}: ${e.temp===null?"-":`${e.temp.toFixed(1)}°`}`),s("light")&&r.push(`${a("colLight")}: ${e.lit===null?"-":`${e.lit}/${e.lights}`}`),s("cameras")&&r.push(`${a("colCameras")}: ${e.cams}`),s("presence")&&e.people!==null&&r.push(`${a("colPresence")}: ${e.people}`),s("doors")&&e.doorsOpen!==null&&r.push(`${a("colDoors")}: ${e.doorsOpen}`),r.join(" · ")}hiddenNote(e){if(!e.length)return d;const s=e.map(r=>a(V[r])).join(", ");return t`<span class="hidnote" data-syn-hidden=${e.join(",")}>${a("hiddenEmpty",{cols:s})}${this.wall?d:t` · <button class="lnk" data-syn-hidden-opt @click=${()=>D("/system/diagnostics",{focus:"xs"})}>${a("hiddenEmptyOpt")}</button>`}</span>`}frame(e,s,r=!1,i){return t`<sw-page heading=${a("synTitle")} subheading=${r?i??a("synSub",{n:s}):""} data-synoptic-screen>${e}</sw-page>`}openFloor(e){this.info=!1,D(`/explore/floors/${e.id}`)}renderPhone(e,s,r,i,p,o,h,m,g,v){const u=window.innerWidth,{cols:x,dashed:E}=Os(r,s,u),q=new Set(E),O=s.length>Ls,j=p.syn_phone_view,I=t`<div class="phead">${h}<span class="live"><i></i>${this.now}</span>
      <button class="ib" data-syn-info aria-haspopup="dialog" aria-label=${a("synInfo")} title=${a("synInfo")} @click=${()=>this.info=!0}>${c("info")}</button></div>`,f=m?this.alarmPanel(m,o):t`<span></span>`,P=(b,l)=>g&&b.level<0&&(l===0||s[l-1].level>=0),T=b=>`${b.name}${b.nodata?`, ${a("noData")}`:""}${this.detailText(b,l=>x.includes(l))?`: ${this.detailText(b,l=>x.includes(l))}`:""}`,B=Fs(x);let S;if(j==="cards"){const b=[];s.forEach((l,L)=>{P(l,L)&&b.push(t`<div class="pgl" aria-hidden="true">${a("synGroundLine")}</div>`);const n=o.floors[l.id],y=t`<span><span class="t" dir="auto" title=${l.name}>${z(l.name)}</span>${O?d:t`<span class="s" data-syn-match=${l.match?.how??(l.match?"none":"")}>${this.subLine(l)}</span>`}</span>`;b.push(O?t`<div class="card pfc row" role="group" aria-label=${T(l)} data-syn-row=${l.id} ?data-off=${l.nodata} data-fire=${n&&n.state!=="ok"?n.state:""}>
              <div class="pfr" style="--pgrid:${B} 16px">
                <button class="pfh" data-syn-open-floor=${l.id} @click=${()=>this.openFloor(l)}>${y}</button>
                ${x.map($=>this.phoneCell($,l,p,o,q.has($)))}${c("fwd","fwd")}
              </div></div>`:t`<div class="card pfc" role="group" aria-label=${T(l)} data-syn-row=${l.id} ?data-off=${l.nodata} data-fire=${n&&n.state!=="ok"?n.state:""}>
              <button class="pfh" data-syn-open-floor=${l.id} @click=${()=>this.openFloor(l)}>${y}${c("fwd","fwd")}</button>
              ${x.length?t`<div class="pfm">${x.map($=>this.phoneMetric($,l,p,o,q.has($)))}</div>`:d}
            </div>`)}),S=t`<section class="pboard pb" aria-label=${a("synTitle")} data-syn-board data-syn-phone="cards">${I}${f}<div class="pbl" ?data-dense=${O}>${b}</div></section>`}else if(j==="section"){const b=u<360?52:u>410?72:64,l=u>=360&&!O,L=[t`<span class="roof" aria-hidden="true"></span><span aria-hidden="true"></span>`];s.forEach((w,M)=>{P(w,M)&&L.push(t`<span class="soil" aria-hidden="true"></span><span class="soiltx" aria-hidden="true"></span>`);const X=this.sel===w.id;L.push(t`<span class="sl ${w.level<0?"bg":""}" aria-hidden="true" ?data-sel=${X}><i style="inline-size:${K(w)}%"></i><em>${H(w.level)}</em></span>
          <div class="ci" role="group" aria-label=${T(w)} data-syn-row=${w.id} ?data-off=${w.nodata}>
            <button class="pl1" data-syn-sel=${w.id} aria-pressed=${X} aria-label=${a("synSelectAria",{name:w.name})} @click=${()=>this.pick(w.id)}><span class="t" dir="auto" title=${w.name}>${z(w.name)}</span>${l?t`<span class="s" data-syn-match=${w.match?.how??(w.match?"none":"")}>${this.subLine(w)}</span>`:d}</button>
            <span class="ppls">${x.map(Y=>this.phonePill(Y,w,p,o,q.has(Y)))}</span>
          </div>`)});const n=s.find(w=>w.id===this.sel)??null,y=Z(s,p.temp_threshold),$=(w,M)=>w===null||M===null?"":` · ${H(`${w}/${M}`)} ${a("lightsOn")}`,_=n?t`<span class="tx"><b title=${n.name}>${z(n.name)}</b>${this.subLine(n)}${x.includes("light")?$(n.lit,n.lights):""}</span>
            <sw-button size="sm" variant="primary" data-syn-open @click=${()=>this.openFloor(n)}>${a("synOpenFloor")}</sw-button>`:t`<span class="tx"><b>${a("synAll")}</b>${a("synFloorsN",{n:s.length})}${x.includes("light")&&y.litKnown?$(y.lit,y.lights):""}</span>
            <sw-button size="sm" variant="ghost" data-syn-details @click=${()=>this.info=!0}>${a("synDetails")}</sw-button>`;S=t`<section class="card pboard pc" aria-label=${a("synTitle")} data-syn-board data-syn-phone="section" style="--slab:${b}px">${I}${f}
        <div class="cl" ?data-dense=${O}>${L}</div><div class="dstrip" data-syn-strip>${_}</div></section>`}else{const b=[];s.forEach((l,L)=>{P(l,L)&&b.push(t`<div class="ground" aria-hidden="true"></div>`);const n=x.includes("temp")?R(l,p.temp_threshold):null,y=o.floors[l.id],$=this.subLine(l);b.push(t`<div class="par" role="group" aria-label=${T(l)} data-syn-row=${l.id} data-temp=${n??""} ?data-off=${l.nodata} data-fire=${y&&y.state!=="ok"?y.state:""}>
          <button class="pan" data-syn-open-floor=${l.id} @click=${()=>this.openFloor(l)}><span class="t" dir="auto" title=${l.name}>${z(l.name)}</span><span class="s" title=${$} data-syn-match=${l.match?.how??(l.match?"none":"")}>${$}</span></button>
          ${x.map(_=>this.phoneCell(_,l,p,o,q.has(_)))}
        </div>`)}),S=t`<section class="card pboard pa" aria-label=${a("synTitle")} data-syn-board data-syn-phone="table" style="--pgrid:${B}">${I}${f}
        <div class="pah" aria-hidden="true"><span>${a("synFloor")}</span>${x.map(l=>t`<span data-syn-col=${l} title=${a(V[l])}>${c(U[l])}</span>`)}</div>
        <div class="plist" ?data-dense=${O}>${b}</div></section>`}return t`${S}${this.renderInfo(e,s,r,x,i,v)}`}phoneValue(e,s,r,i){switch(e){case"light":return s.lit===null||s.lights===null||s.nodata?{v:null,mut:!0}:{v:t`<span class="n">${s.lit}</span><small>/${s.lights}</small>`,mut:!s.lit};case"temp":return s.temp===null||s.nodata?{v:null,mut:!0}:{v:t`<span class="n">${s.temp.toFixed(1)}</span><small>°</small>`,mut:!1,tone:R(s,r.temp_threshold)??void 0};case"presence":return s.people===null?{v:null,mut:!0}:{v:t`<span class="n">${s.people}</span>`,mut:!s.people};case"cameras":return{v:t`<span class="n">${s.cams}</span>${s.shared?t`<small>+${s.shared}</small>`:d}`,mut:!s.cams&&!s.shared,title:s.shared?a("camsShared",{n:s.shared}):void 0};case"doors":return s.doorsOpen===null||s.nodata?{v:null,mut:!0}:{v:t`<span class="n">${s.doorsOpen}</span>`,mut:!s.doorsOpen};case"alerts":return s.alerts===null?{v:null,mut:!0,title:a("alertsNone")}:{v:t`<span class="n">${s.alerts}</span>`,mut:!s.alerts,warn:!!s.alerts};case"fire":{if(!i.connected)return{v:c("offline"),mut:!0,title:a("fireNotConnected"),nc:!0};const p=i.floors[s.id];return p?p.state==="alarm"?{v:c("flame"),mut:!1,warn:!0,title:a("fireAlarm")}:p.state==="fault"?{v:c("wrench"),mut:!0,title:a("fireFault")}:{v:c("check"),mut:!0,title:a("fireOk")}:{v:null,mut:!0}}}}lightsAria(e){return a("synLightsAria",{name:e.name,lit:e.lit??0,lights:e.lights??0})}phoneCell(e,s,r,i,p){const o=this.phoneValue(e,s,r,i);if(e==="light"&&o.v&&!p){const m=t`<span class="pv ${o.mut?"mut":""}"><span class="n">${s.lit}/${s.lights}</span></span><span class="mb" aria-hidden="true"><i style="inline-size:${K(s)}%"></i></span>`;return this.lightsAllowed(s)?t`<button class="plc" data-syn-lights=${s.id} aria-label=${this.lightsAria(s)} title=${a("floorLightsOpen",{name:s.name})} @click=${g=>this.openLights(g,s)}>${m}</button>`:t`<span class="plc">${m}</span>`}const h=p||!o.v;return t`<span class="pcell" data-syn-cell=${e} ?data-fire-nc=${o.nc}><span class="pv ${h||o.mut?"mut":""} ${o.warn?"warn":""}" data-t=${o.tone??d} title=${h?a("noSource"):o.title??d}>${h?"-":o.v}</span></span>`}phoneMetric(e,s,r,i,p){const o=this.phoneValue(e,s,r,i),h=p||!o.v,m=t`<span class="k">${c(U[e])}${a(Ts[e])}</span>`;if(e==="light"&&!h){const g=t`${m}<span class="pval">${o.v}</span><span class="mb" aria-hidden="true"><i style="inline-size:${K(s)}%"></i></span>`;return this.lightsAllowed(s)?t`<button class="pmt lit" data-syn-lights=${s.id} aria-label=${this.lightsAria(s)} @click=${v=>this.openLights(v,s)}>${g}</button>`:t`<div class="pmt lit">${g}</div>`}return t`<div class="pmt ${h||o.mut?"mut":""} ${p?"dash":""} ${o.warn?"warn":""}" data-syn-cell=${e} ?data-fire-nc=${o.nc} title=${h?a("noSource"):o.title??d}>${m}<span class="pval" data-t=${o.tone??d}>${h?"-":o.v}</span></div>`}phonePill(e,s,r,i,p){const o=this.phoneValue(e,s,r,i),h=p||!o.v;if(e==="light"&&!h&&this.lightsAllowed(s))return t`<button class="ppl lit" data-syn-lights=${s.id} aria-label=${this.lightsAria(s)} @click=${g=>this.openLights(g,s)}>${c("light")}<span class="n">${s.lit}/${s.lights}</span></button>`;const m=e==="light"&&!h?"lit":h?p?"dash mut":"mut":`${o.mut?"mut":""} ${o.warn?"warn":""}`;return t`<span class="ppl ${m}" data-syn-cell=${e} ?data-fire-nc=${o.nc} title=${h?a("noSource"):o.title??a(V[e])}>${e==="fire"?d:c(U[e])}${h?"-":e==="light"?t`<span class="n">${s.lit}/${s.lights}</span>`:o.v}</span>`}renderInfo(e,s,r,i,p,o){const h=u=>u.map(x=>a(V[x])).join(", "),m=r.filter(u=>!i.includes(u)),g=ss(s),v=g.length?g.length===1?a("matchHintOne",{name:g[0].name}):a("matchHintMany",{n:g.length}):"";return t`<sw-sheet narrow heading=${a("synInfoTitle",{name:z(e.name)})} ?open=${this.info} data-syn-info-sheet @close=${()=>this.info=!1}>
      ${this.info?t`<div class="pinfo">
            <p class="sub">${a("synBoardSub")}</p>
            <dl>
              <dt>${a("synInfoFloors")}</dt><dd>${H(s.length)}</dd>
              <dt>${a("synInfoShown")}</dt><dd data-syn-info-shown>${i.length?h(i):"-"}</dd>
              ${m.length?t`<dt>${a("synInfoWide")}</dt><dd data-syn-info-wide>${h(m)}</dd>`:d}
              ${p.length?t`<dt>${a("synInfoHidden")}</dt><dd data-syn-info-hidden>${h(p)}</dd>`:d}
              ${o?t`<dt>${a("synInfoNoFloor")}</dt><dd data-syn-info-nofloor>${a("synInfoNoFloorVal",o)}</dd>`:d}
            </dl>
            ${v?t`<p class="hint" data-syn-hint>${v}</p>`:d}
            <div class="acts">
              ${v&&this.canLink()?t`<sw-button size="sm" variant="ghost" data-syn-link=${g[0].id} @click=${()=>this.linkFloor(e,g[0].id)}>${a("matchHintAction")}</sw-button>`:d}
              <sw-button size="sm" variant="ghost" data-syn-info-settings @click=${()=>{this.info=!1,D("/system/diagnostics",{focus:"xs"})}}>${a("synInfoSettings")}</sw-button>
            </div>
          </div>`:d}
    </sw-sheet>`}};k.styles=[as`
    :host { display: block; block-size: 100%; min-block-size: 0; }
    sw-page { block-size: 100%; box-sizing: border-box; }
    :host([wall]) { position: fixed; inset: 0; background: var(--sw-bg); padding: 16px 20px; box-sizing: border-box; }
    .syn { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-block-size: 0; block-size: 100%; }
    .syn.wide { grid-template-columns: 200px minmax(0, 1fr); }
    .syn.wide.ev { grid-template-columns: 200px minmax(0, 1fr) 280px; }
    .card { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); min-block-size: 0; min-inline-size: 0; }
    nav.tree { padding: 10px; display: flex; flex-direction: column; gap: 4px; overflow: hidden; align-self: stretch; }
    nav.tree button { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 0; border-radius: var(--sw-r-sm); background: transparent; font: inherit; color: var(--sw-text); text-align: start; cursor: pointer; min-block-size: 36px; min-inline-size: 0; touch-action: manipulation; }
    nav.tree button[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    nav.tree button { transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); }
    nav.tree button:active { transform: scale(var(--sw-press-scale, 0.98)); }
    @media (hover: hover) and (pointer: fine) { nav.tree button[aria-pressed='false']:hover { background: var(--sw-surface-2); } }
    nav.tree .nm { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    nav.tree .lit { color: var(--sw-text-3); font-size: var(--sw-fs-state); font-variant-numeric: tabular-nums; direction: ltr; display: inline-flex; gap: 3px; align-items: center; }
    .xi { inline-size: 14px; block-size: 14px; flex: none; }
    .syn { grid-template-rows: minmax(0, 1fr); }
    .syn > * { align-self: stretch; min-block-size: 0; }
    .board { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 10px; padding: 14px 16px 12px; block-size: 100%; box-sizing: border-box; }
    .bhead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }
    .bhead h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); display: flex; gap: 8px; align-items: center; }
    .chips { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .chip { display: inline-flex; align-items: center; gap: 5px; block-size: 28px; padding: 0 10px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: var(--sw-fs-sm); white-space: nowrap; }
    .chip b { color: var(--sw-text); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); }
    .chip.alert { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); color: var(--sw-danger-text, var(--sw-danger)); }
    .chip.dash { background: transparent; outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }
    .chip.mock { background: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--sw-border-strong) 45%, transparent) 5px 6px), var(--sw-surface); box-shadow: inset 0 0 0 1px var(--sw-border-strong); color: var(--sw-text); font-weight: 600; }
    .live { margin-inline-start: auto; color: var(--sw-text-3); font-size: var(--sw-fs-state); display: inline-flex; gap: 6px; align-items: center; }
    .live i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--sw-live); }
    .clock { font-size: var(--sw-fs-2xl); font-weight: 800; font-variant-numeric: tabular-nums; direction: ltr; color: var(--sw-heading); }
    .sgrid { display: grid; grid-template-columns: minmax(110px, 1.3fr) repeat(var(--cols, 6), minmax(0, 1fr)); align-items: center; gap: 10px; }
    .shdr { padding: 0 12px; color: var(--sw-text-3); font-size: var(--sw-fs-state); font-weight: var(--sw-fw-semibold); }
    .shdr span { display: inline-flex; gap: 5px; align-items: center; min-inline-size: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .srows { display: flex; flex-direction: column; justify-content: flex-start; gap: 5px; min-block-size: 0; container-type: size; }
    .srow, nav.tree button { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .srow { flex: 1 1 0; min-block-size: 0; max-block-size: 76px; padding: 0 12px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); text-align: start; color: inherit; font: inherit; cursor: pointer; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), box-shadow var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
    .srow:active { transform: scale(var(--sw-press-scale, 0.98)); }
    @media (hover: hover) and (pointer: fine) { .srow:hover:not([aria-pressed='true']) { background: var(--sw-surface-3); } }
    .srow[aria-pressed='true'] { background: var(--sw-accent-soft); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .srow[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
    .srow[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
    /* SYNOPTIC-HA-2310: a floor without data is the same well, said once in muted words (no stripes, no extra edge) */
    .srow[data-off] .nm .t { color: var(--sw-text-2); }
    /* rows too short for two lines (many floors): the name only; the selected floor's detail line carries its home-system floor */
    .srows[data-dense] .nm .s { display: none; }
    .srow[data-off] .nm .s { color: var(--sw-text-3); }
    .lnk { font: inherit; font-weight: var(--sw-fw-semibold); color: var(--sw-accent-text, var(--sw-accent)); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
    .srow[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .srow[aria-pressed='true'][data-fire='alarm'] { box-shadow: inset 0 0 0 2px var(--sw-accent), inset 0 0 0 4px color-mix(in srgb, var(--sw-danger) 45%, transparent); }
    .srow[data-fire='fault'] { outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }
    .nm { min-inline-size: 0; display: flex; flex-direction: column; gap: 1px; }
    .nm .t { font-size: clamp(10px, calc(100cqh / var(--n, 6) * 0.3), var(--sw-fs-md)); font-weight: var(--sw-fw-bold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nm .s { font-size: var(--sw-fs-state); color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cell { min-inline-size: 0; display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-size: clamp(10px, calc(100cqh / var(--n, 6) * 0.3), 15px); }
    .cell b { font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; }
    .cell.muted { color: var(--sw-text-3); }
    .cell.warn { color: var(--sw-danger-text, var(--sw-danger)); font-weight: var(--sw-fw-semibold); }
    .cell .w { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .deg { font-size: clamp(11px, calc(100cqh / var(--n, 6) * 0.42), 24px); font-weight: 800; color: var(--sw-heading); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .deg small { font-size: 0.6em; color: var(--sw-text-3); }
    .deg.none { color: var(--sw-text-3); }
    [data-temp='hot'] .deg { color: color-mix(in srgb, var(--sw-heat) 62%, var(--sw-heading)); }
    [data-temp='cold'] .deg { color: color-mix(in srgb, var(--sw-cool) 62%, var(--sw-heading)); }
    .fac { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--sw-r-2xs); background: var(--sw-border); block-size: clamp(8px, calc(100cqh / var(--n, 6) * 0.3), 22px); }
    .fac i { inline-size: 7px; border-radius: 2px; background: var(--sw-surface-2); }
    .fac i.on { background: color-mix(in srgb, var(--sw-lit) 82%, var(--sw-surface)); }
    .fz { display: inline-flex; gap: 5px; align-items: center; font-weight: var(--sw-fw-semibold); }
    .fz.alarm { color: var(--sw-danger-text, var(--sw-danger)); }
    .fz.fault { color: var(--sw-text-2); }
    .ground { flex: none; block-size: 2px; margin: 2px 6px; border-radius: 2px; background: var(--sw-border-strong); }
    .detail { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-block-size: 40px; padding-block-start: 4px; border-block-start: 1px solid var(--sw-border); color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .detail b { color: var(--sw-heading); }
    .detail .grow { flex: 1; min-inline-size: 0; }
    /* SYN-COLUMNS-2321: the columns left out for want of a source, said once and quietly at the foot of the board */
    .hidnote { margin-inline-start: auto; color: var(--sw-text-3); font-size: var(--sw-fs-state); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; max-inline-size: 100%; }
    .hidnote .lnk { color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
    .empty { display: grid; place-items: center; padding: 24px; color: var(--sw-text-3); }
    .nc { display: flex; gap: 8px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .alarmpanel { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 80%, black); color: var(--sw-text-inverse); }
    .alarmpanel.ackd { background: color-mix(in srgb, var(--sw-danger) 66%, black); }
    .alarmpanel .tx { flex: 1 1 220px; min-inline-size: 0; display: flex; flex-direction: column; }
    .alarmpanel .tag { display: inline-flex; padding: 1px 8px; border-radius: 999px; background: rgba(0, 0, 0, 0.25); font-size: var(--sw-fs-xs); font-weight: 700; margin-inline-start: 8px; }
    .alarmpanel .lnk { min-block-size: 40px; padding: 0 14px; border-radius: 999px; border: 0; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.7); color: var(--sw-text-inverse); font: inherit; font-weight: 600; cursor: pointer; }
    aside.events { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; align-self: stretch; }
    aside.events h3 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); display: flex; gap: 6px; align-items: center; }
    .ev { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; font-size: var(--sw-fs-sm); }
    .ev small { display: block; color: var(--sw-text-3); }
    .ev time { color: var(--sw-text-3); font-variant-numeric: tabular-nums; direction: ltr; }
    :host([wall]) .nm .t { font-size: clamp(14px, calc(100cqh / var(--n, 6) * 0.4), 30px); }
    :host([wall]) .cell, :host([wall]) .deg { font-size: clamp(14px, calc(100cqh / var(--n, 6) * 0.4), 30px); }
    :host([wall]) .shdr { font-size: var(--sw-fs-xl); }
    .wallhead { display: flex; align-items: center; justify-content: space-between; margin-block-end: 10px; gap: 12px; }
    .wallhead h1 { margin: 0; font-size: var(--sw-fs-3xl); color: var(--sw-heading); }
    @media (max-width: 767px) {
      .syn.wide, .syn.wide.ev { grid-template-columns: minmax(0, 1fr); }
      /* SYNOPTIC-MOBILE-2342 root cause: number columns of minmax(0, auto) shrank to nothing while the lights strip and the number did not,
         so lighting spilled over the cameras. The narrow wide board (only the wall screen still draws it under 768 px) gets fixed columns. */
      .sgrid { grid-template-columns: minmax(0, 1fr) repeat(var(--pcols, 3), 64px); gap: 8px; }
      .fac { display: none; }
      .cell { overflow: hidden; }
      .hide-phone { display: none !important; }
      .bhead h2 { font-size: var(--sw-fs-lg); }
    }
    .lights-hit { cursor: pointer; border-radius: var(--sw-r-sm); }
    @media (hover: hover) and (pointer: fine) { .lights-hit:hover { background: color-mix(in srgb, var(--sw-lit) 14%, transparent); } }
    :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
  `,Cs];A([As({type:Boolean,reflect:!0})],k.prototype,"wall",2);A([C()],k.prototype,"tree",2);A([C()],k.prototype,"data",2);A([C()],k.prototype,"lightsOf",2);A([C()],k.prototype,"events",2);A([C()],k.prototype,"error",2);A([C()],k.prototype,"sel",2);A([C()],k.prototype,"now",2);A([C()],k.prototype,"info",2);k=A([_s("devices-synoptic")],k);export{k as DevicesSynoptic};
//# sourceMappingURL=devices-synoptic-D3exWkis.js.map
