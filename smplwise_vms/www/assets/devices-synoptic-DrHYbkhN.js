import{E as ts,a as ns,bg as is,bh as rs,aY as os,aZ as ls,Y as ps,bi as ds,i as z,l as U,aa as cs,bf as J,br as a,e as t,bq as hs,bl as ss,bm as ms,bj as P,bk as us,bn as gs,bo as ws,bp as bs,rO as vs,rP as d,rQ as G,A as p,q as O,rR as xs,rS as fs,rT as $s,b2 as C,bu as ys,bv as ks,rU as zs,rV as es,rW as Os,rX as Ls,rY as V,bA as M,rZ as X,be as Ss,ce as _s,r_ as Fs,r$ as As,s0 as Is,s1 as Ns,s2 as Ts,s3 as Ps,F as Cs,G as I,s4 as Ds,H as Es}from"./index-Cx0qJkOE.js";import"./sw-logo-art-Va6y_cIM.js";const Hs=ts`
  .pboard { display: grid; gap: 8px; block-size: 100%; min-block-size: 0; box-sizing: border-box; }
  .pboard.card { padding: 10px 12px; }
  .pboard.pa { grid-template-rows: auto auto auto minmax(0, 1fr); }
  /* SYNOPTIC-PHONE-SETTINGS-2360: "שורת סיכום בטלפון" = line adds one auto row under the list (the list stays the only part that scrolls) */
  .pboard.pa[data-sum='line'] { grid-template-rows: auto auto auto minmax(0, 1fr) auto; }
  .pboard.pb[data-sum='line'] { grid-template-rows: auto auto minmax(0, 1fr) auto; }
  .pboard.pc[data-sum='line'] { grid-template-rows: auto auto minmax(0, 1fr) auto auto; padding-block-end: 8px; }
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
  /* SYNOPTIC-PHONE-SETTINGS-2360 "תאורה בטלפון": the segment strip takes the bar's own width (one segment a light, eight at most) and grows 2 px taller to read */
  .mb.seg { display: flex; gap: 1px; block-size: 6px; background: none; overflow: visible; }
  .mb.seg i { flex: 1 1 0; min-inline-size: 0; border-radius: 1px; background: var(--sw-border-strong); }
  .mb.seg i.on { background: var(--sw-lit); }
  .pmt.lit .mb.seg { background: none; }
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
  /* the summary as a line under the board (syn_phone_summary=line): small, wraps, the links keep a 44 px touch target without growing the line */
  .psum { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; padding-block-start: 6px; border-block-start: 1px solid var(--sw-border); font-size: var(--sw-fs-xs); line-height: 1.45; color: var(--sw-text-2); }
  .psum .st b { color: var(--sw-heading); }
  .psum .hidnote { margin-inline-start: 0; white-space: normal; overflow: visible; }
  .psum .lnk { position: relative; font-size: inherit; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
  .psum .lnk::after { content: ''; position: absolute; inset: -14px -6px; }

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
`;var js=Object.defineProperty,Bs=Object.getOwnPropertyDescriptor,L=(e,s,i,r)=>{for(var l=r>1?void 0:r?Bs(s,i):s,o=e.length-1,c;o>=0;o--)(c=e[o])&&(l=(r?c(s,i,l):c(l))||l);return r&&l&&js(s,i,l),l};const Ms=3e4,Y={light:"colLight",temp:"colTemp",presence:"colPresence",cameras:"colCameras",doors:"colDoors",alerts:"colAlerts",fire:"colFire"},K={light:"light",temp:"therm",presence:"person",cameras:"cam",doors:"door",alerts:"bell",fire:"flame"},qs={light:"lightsOn",temp:"phTemp",presence:"phPresence",cameras:"colCameras",doors:"phDoors",alerts:"phAlerts",fire:"phFire"},as=()=>new Date().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});let y=class extends ns{constructor(){super(...arguments),this.wall=!1,this.tree=null,this.data=null,this.lightsOf=null,this.events=null,this.error="",this.sel="all",this.now=as(),this.info=!1,this.multiOn=!1,this.timers=[],this.stops=[],this.onResize=()=>this.requestUpdate(),this.phoneSet=new Set}connectedCallback(){super.connectedCallback(),this.stops.push(is(()=>this.requestUpdate()),rs(()=>this.requestUpdate())),window.addEventListener("resize",this.onResize),this.load(),this.timers.push(window.setInterval(()=>this.now=as(),15e3),window.setInterval(()=>void this.refresh(),Ms))}disconnectedCallback(){window.removeEventListener("resize",this.onResize),this.timers.forEach(e=>window.clearInterval(e)),this.timers=[],this.stops.forEach(e=>e()),this.stops=[],super.disconnectedCallback()}async load(){os().then(e=>this.multiOn=e);try{this.tree=await ls(),this.error=""}catch(e){this.error=ps(e)}await this.refresh()}async refresh(){if(this.data=await ds(),z()&&U("events.read"))try{this.events=(await cs({limit:8,buildingId:this.building()?.id})).events}catch{this.events=null}}lightsAllowed(e){return this.wall||e.nodata||e.lights===null?!1:!z()||this.data?.demo?!0:U("devices.read")&&J(e)!==null}openLights(e,s){e?.stopPropagation(),this.lightsOf=s}renderLights(){const e=this.lightsOf,s=!z()||!!this.data?.demo,i=e&&!s?J(e):null;return t`<devices-tiles-panel kind="lights" data-floor-lights=${e?.id??""} ?open=${!!e} pairedMaster
      scope=${i?.scope??"building"} scopeId=${i?.scopeId??""} scopeName=${e?.name??""} .areaFilter=${i?i.areaIds:null} switches=${this.opts().syn_switches}
      .building=${i?this.ctlBuilding():""}
      headingText=${e?a("floorLightsTitle",{name:e.name}):""}
      @panel-close=${()=>this.lightsOf=null} @panel-changed=${()=>void this.refresh()}></devices-tiles-panel>`}ctlBuilding(){const e=this.building(),s=e?this.tree?.sites.find(i=>(i.buildings??[]).some(r=>r.id===e.id)):null;return hs(this.multiOn,s?.buildings?.length??0,e?.id)}opts(){return z()?ss():ms(ss(),P().params)}building(){const e=this.tree;if(!e)return null;const s=P().params.get("b"),i=e.sites.flatMap(o=>o.buildings??[]),r=i.find(o=>o.id===s)??i[0]??null;if(!r)return null;const l=z()?0:Number(P().params.get("xsdemo"));return Number.isInteger(l)&&l>=1&&l<=40?us(l,r,P().params.get("xsnames")==="long"):r}signals(e){return!z()||this.data?.demo?gs([...e].sort((s,i)=>i.level-s.level||i.sort_order-s.sort_order),z()?null:P().params.get("xsdata")):ws(e,this.data?.tree??null,this.data?.people??null,this.ctx(e),{switches:this.opts().syn_switches})}ctx(e){const s=e[0]?.building_id,i=this.tree?.sites.find(r=>(r.buildings??[]).some(l=>l.id===s))??null;return bs(this.data,i)}noFloorLights(e,s){return!z()||this.data?.demo?null:vs(this.data?.tree??null,s,this.ctx(e),{switches:this.opts().syn_switches})}head(e){const s={light:["light",a("colLight")],temp:["therm",a("colTemp")],presence:["person",a("colPresence")],cameras:["cam",a("colCameras")],doors:["door",a("colDoors")],alerts:["bell",a("colAlerts")],fire:["flame",a("colFire")]};return t`<span data-syn-col=${e}>${d(s[e][0])}${s[e][1]}</span>`}cell(e,s,i,r){const l=G(s,i.temp_threshold);switch(e){case"light":{const c=s.lights?Math.round((s.lit??0)/s.lights*8):0,h=this.lightsAllowed(s);return s.lit===null||s.lights===null?t`<span class="cell muted" title=${a("noSource")}>-</span>`:t`<span class="cell ${h?"lights-hit":""}" data-syn-lights=${h?s.id:p} title=${h?a("floorLightsOpen",{name:s.name}):p} @click=${g=>h&&this.openLights(g,s)}><span class="fac" aria-hidden="true">${Array.from({length:8},(g,w)=>t`<i class=${w<c?"on":""}></i>`)}</span><b>${s.lit}/${s.lights}</b></span>`}case"temp":return s.temp===null||s.nodata?t`<span class="deg none" title=${a("noSource")}>-</span>`:t`<span class="deg" data-t=${l??""}>${s.temp.toFixed(1)}<small>°</small></span>`;case"presence":return s.people===null?t`<span class="cell muted">-</span>`:t`<span class="cell ${s.people?"":"muted"}">${d("person")}<b>${s.people}</b></span>`;case"cameras":return t`<span class="cell ${s.cams?"":"muted"}">${d("cam")}<b>${s.cams}</b>${s.shared?t`<span class="w">${a("camsShared",{n:s.shared})}</span>`:p}</span>`;case"doors":return s.doorsOpen===null?t`<span class="cell muted" title=${a("noSource")}>-</span>`:t`<span class="cell ${s.doorsOpen?"":"muted"}">${d("door")}<b>${s.doorsOpen}</b></span>`;case"alerts":return s.alerts===null?t`<span class="cell muted" title=${a("alertsNone")}>-</span>`:s.alerts?t`<span class="cell warn">${d("bell")}<b>${s.alerts}</b></span>`:t`<span class="cell muted">0</span>`;case"fire":{if(!r.connected)return t`<span class="cell muted" data-fire-nc>${d("offline")}<span class="w">${a("fireNotConnected")}</span></span>`;const o=r.floors[s.id];return o?o.state==="alarm"?t`<span class="fz alarm">${d("flame")}<span class="w">${a("fireAlarm")}</span></span>`:o.state==="fault"?t`<span class="fz fault">${d("wrench")}<span class="w">${a("fireFault")}</span></span>`:t`<span class="fz">${d("check")}<span class="w">${a("fireOk")}</span></span>`:t`<span class="cell muted">-</span>`}}}pick(e){this.sel=this.sel===e?"all":e}alarmPanel(e,s){const i=s.floors[e.id],r=Ds(),l=this.opts();return t`<div class="alarmpanel ${r?"ackd":""}" role="alert" data-alarm-panel>
      <span class="tx"><b>${r?a("fireAcked",{who:r.who}).split(" · ")[0]:a("fireAlarm")} · ${O(e.name)}${s.demo?t`<span class="tag">${a("fireDemo")}</span>`:p}</b>
        <span>${r?a("fireAcked",{who:r.who}):a("fireBarWhere",{zone:i.zone??"",device:i.device??"",time:i.time??""})}</span></span>
      ${r?p:t`<sw-ack-button .mode=${l.ack} .allowed=${xs(l)} @acked=${()=>fs($s())}></sw-ack-button>`}
      <button class="lnk" @click=${()=>C(`/explore/floors/${e.id}`)}>${a("fireOpenFloor")}</button>
    </div>`}render(){const e=this.opts();if(this.wall&&!e.wall)return t`<sw-state-panel icon="tv" state="empty" heading=${a("wallOff")}></sw-state-panel>`;if(!this.tree)return this.frame(t`<sw-state-panel icon="floor" state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel>`,0);const s=this.building(),i=s?.floors??[];if(!s||!i.length)return this.frame(t`<sw-state-panel icon="floor" state="empty" heading=${a("emptyFloors")}></sw-state-panel>`,0);const r=this.signals(i),l=P().params.get("firemock");ys(e.fire_ui?l:null,r);const o=e.fire_ui?ks():{connected:!1,demo:!1,floors:{}},c=this.data?.demo?!0:!!this.data?.presenceOn,{cols:h,hiddenEmpty:g}=zs(e,c,o.connected,r),w=n=>h.includes(n),m=es(r,e.temp_threshold),x=e.fire_ui?Os(o):[],j=r.find(n=>n.id===x[0]),N=r.some(n=>n.level<0)&&r.some(n=>n.level>=0),S=Ls(h);this.phoneSet=new Set(S);let D=!1;const _=[];r.forEach(n=>{N&&n.level<0&&!D&&(D=!0,_.push(t`<div class="ground" aria-hidden="true"></div>`));const A=w("temp")?G(n,e.temp_threshold):null,b=o.floors[n.id];_.push(t`<button class="srow sgrid" style="--cols:${h.length};--pcols:${S.length}" data-syn-row=${n.id} aria-pressed=${this.sel===n.id} data-temp=${A??""} ?data-off=${n.nodata} data-fire=${b&&b.state!=="ok"?b.state:""} @click=${()=>this.pick(n.id)}
        aria-label=${`${n.name}${n.nodata?`, ${a("noData")}`:""}${b?.state==="alarm"?`, ${a("fireAlarm")} (${a("fireDemo")})`:""}`}>
        <span class="nm"><span class="t" dir="auto" title=${n.name}>${O(n.name)}</span><span class="s" data-syn-match=${n.match?.how??(n.match?"none":"")}>${this.subLine(n)}</span></span>
        ${h.map($=>this.isPhoneCol($)?this.cell($,n,e,o):t`<span class="hide-phone">${this.cell($,n,e,o)}</span>`)}
      </button>`)});const f=r.find(n=>n.id===this.sel)??null,T=w("light")?this.noFloorLights(i,r):null,E=t`<span class="chips">
      ${w("temp")&&m.avg!==null?t`<span class="chip" data-syn-chip="temp">${d("therm")}${a("avgTemp")} <b>${m.avg.toFixed(1)}°</b></span>`:p}
      ${w("light")&&m.litKnown?t`<span class="chip warm" data-syn-chip="light" title=${T?`${a("synInfoNoFloor")}: ${a("synInfoNoFloorVal",T)}`:p}>${d("light")}<b>${m.lit}/${m.lights}</b> ${a("lightsOn")}</span>`:p}
      ${w("presence")&&m.people!==null?t`<span class="chip hide-phone" data-syn-chip="presence">${d("person")}<b>${m.people}</b> ${a("colPresence")}</span>`:p}
      ${w("doors")&&m.doorsOpen!==null?t`<span class="chip hide-phone" data-syn-chip="doors">${d("door")}<b>${m.doorsOpen}</b> ${a("colDoors")}</span>`:p}
      ${m.nodata?t`<span class="chip dash">${d("offline")}${a("noDataCount",{n:m.nodata})}</span>`:p}
      ${x.length?t`<span class="chip alert">${d("flame")}${a("fireAlarm")} <span>${a("fireDemo")}</span></span>`:p}
      ${e.fire_ui&&!o.connected&&e.fire_column==="dashed"?t`<span class="chip dash">${d("flame")}${a("colFire")}: ${a("fireNotConnected")}</span>`:p}
      ${o.demo?t`<span class="chip mock">${a("fireDemo")}</span>`:p}
    </span>`;if(!this.wall&&window.innerWidth<768){const n=this.renderPhone(s,r,h,g,e,o,E,j??null,N,T);return this.frame(t`${n}${this.renderLights()}`,r.length,!0,a("synSite",{name:O(s.name),n:r.length}))}const B=t`<section class="card board" aria-label=${a("synTitle")} data-syn-board style="--n:${r.length}">
      <div class="bhead"><h2>${d("synoptic")}${a("synTitle")} · ${O(s.name)}</h2>${E}<span class="live"><i></i>${this.now}</span></div>
      ${j?this.alarmPanel(j,o):t`<span></span>`}
      <div class="sgrid shdr" style="--cols:${h.length};--pcols:${S.length}"><span>${a("synFloor")}</span>${h.map(n=>this.isPhoneCol(n)?this.head(n):t`<span class="hide-phone">${this.head(n)}</span>`)}</div>
      <div class="srows" style="--n:${r.length}" ?data-dense=${(window.innerHeight-330)/Math.max(1,r.length)<40}>${_}</div>
      <div class="detail" data-syn-detail>${f?t`<b>${O(f.name)}</b><span class="grow">${V(f.match)?`${V(f.match).text} · `:""}${f.nodata?a("noSource"):this.detailText(f,w)}</span>
          ${V(f.match)?.linked===!1&&this.canLink()?t`<button class="lnk" data-syn-link=${f.id} @click=${()=>this.linkFloor(s,f.id)}>${a("matchFix")}</button>`:p}
          ${w("light")&&this.lightsAllowed(f)?t`<sw-button size="sm" variant="ghost" icon="light" data-syn-lights-open=${f.id} @click=${()=>this.openLights(null,f)}>${a("floorLightsBtn")}</sw-button>`:p}
          <sw-button size="sm" variant="ghost" icon="map" data-syn-open @click=${()=>C(`/explore/floors/${f.id}`)}>${a("openMap")}</sw-button>`:this.allLine(s,r)}${this.hiddenNote(g)}</div>
    </section>`,F=!this.wall,q=F?t`<nav class="card tree hide-phone hide-narrow" aria-label=${a("synAll")} data-syn-tree>
          <button aria-pressed=${this.sel==="all"} @click=${()=>this.sel="all"}>${d("synoptic")}<span class="nm">${a("synAll")}</span>${w("light")?t`<span class="lit">${m.litKnown?m.lit:"-"}${d("light")}</span>`:p}</button>
          ${r.map(n=>t`<button aria-pressed=${this.sel===n.id} data-syn-tree-row=${n.id} @click=${()=>this.sel=n.id}><span class="nm" dir="auto">${O(n.name)}</span>${w("light")?t`<span class="lit">${n.lit===null?"-":n.lit}${d("light")}</span>`:p}</button>`)}
        </nav>`:p,H=F&&e.syn_events?t`<aside class="card events hide-phone hide-narrow" aria-label=${a("events")} data-syn-events><h3>${d("light")}${a("events")}</h3>
          ${this.events&&this.events.length?this.events.slice(0,8).map(n=>t`<div class="ev"><span>${d(n.type==="door"?"door":n.type==="offline"?"offline":"bell")}</span><span><b>${n.raw_type}</b><small>${n.camera_name??""}</small></span><time>${new Date(n.occurred_at).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</time></div>`):t`<span class="nc">${a("eventsNone")}</span>`}
        </aside>`:p,v=t`<div class="syn ${F&&window.innerWidth>=1100?"wide":""} ${F&&window.innerWidth>=1500&&e.syn_events?"ev":""}" data-syn>${window.innerWidth>=1100?q:p}${B}${window.innerWidth>=1500?H:p}</div>`;return this.wall?t`<div class="wallhead"><h1>${a("wallTitle")}</h1><span class="clock">${this.now}</span></div>${v}`:this.frame(t`${v}${this.renderLights()}`,r.length,!0)}subLine(e){const s=V(e.match);return s?s.linked?`${a("level",{n:M(e.level)})} · ${s.text}`:s.text:e.nodata?a("noDataSince"):a("level",{n:M(e.level)})}allLine(e,s){const i=X(s);if(!i.length)return t`<span class="grow">${a("synAll")} · ${a("synSub",{n:s.length})}</span>`;const r=i.length===1?a("matchHintOne",{name:i[0].name}):a("matchHintMany",{n:i.length});return t`<span class="grow" data-syn-hint>${r}</span>${this.canLink()?t`<button class="lnk" data-syn-link=${i[0].id} @click=${()=>this.linkFloor(e,i[0].id)}>${a("matchHintAction")}</button>`:p}`}canOpenMapSettings(){return!this.wall&&(!z()||Ss("system.configure"))}canLink(){return!this.wall&&!_s("structure")&&(!z()||U("site.content.configure"))}linkFloor(e,s){const i=z()?{}:Object.fromEntries([...P().params.entries()].filter(([r])=>r.startsWith("xs")));C(`/explore/buildings/${e.id}/floors`,{...i,ha:s})}isPhoneCol(e){return this.phoneSet.has(e)}detailText(e,s){const i=[];return s("temp")&&i.push(`${a("colTemp")}: ${e.temp===null?"-":`${e.temp.toFixed(1)}°`}`),s("light")&&i.push(`${a("colLight")}: ${e.lit===null?"-":`${e.lit}/${e.lights}`}`),s("cameras")&&i.push(`${a("colCameras")}: ${e.cams}`),s("presence")&&e.people!==null&&i.push(`${a("colPresence")}: ${e.people}`),s("doors")&&e.doorsOpen!==null&&i.push(`${a("colDoors")}: ${e.doorsOpen}`),i.join(" · ")}hiddenNote(e){if(!e.length)return p;const s=e.map(i=>a(Y[i])).join(", ");return t`<span class="hidnote" data-syn-hidden=${e.join(",")}>${a("hiddenEmpty",{cols:s})}${this.wall?p:t` · <button class="lnk" data-syn-hidden-opt @click=${()=>C("/system/diagnostics",{focus:"xs"})}>${a("hiddenEmptyOpt")}</button>`}</span>`}frame(e,s,i=!1,r){return t`<sw-page heading=${a("synTitle")} subheading=${i?r??a("synSub",{n:s}):""} data-synoptic-screen>${e}</sw-page>`}openFloor(e){this.info=!1,C(`/explore/floors/${e.id}`)}renderPhone(e,s,i,r,l,o,c,h,g,w){const m=window.innerWidth,{cols:x,dashed:j}=Fs(i,s,m),N=new Set(j),S=s.length>As,D=l.syn_phone_view,_=Is(l.syn_phone_summary,this.canOpenMapSettings()),f=_.line?this.summaryLine(e,s,r,w,D!=="section"):p,T=t`<div class="phead">${c}<span class="live"><i></i>${this.now}</span>
      ${_.button?t`<button class="ib" data-syn-info aria-haspopup="dialog" aria-label=${a("synInfo")} title=${a("synInfo")} @click=${()=>this.info=!0}>${d("info")}</button>`:p}
      ${_.settings?t`<button class="ib" data-syn-map-settings aria-label=${a("synInfoSettings")} title=${a("synInfoSettings")} @click=${()=>C("/system/diagnostics",{focus:"xs"})}>${d("wrench")}</button>`:p}</div>`,E=h?this.alarmPanel(h,o):t`<span></span>`,B=(v,n)=>g&&v.level<0&&(n===0||s[n-1].level>=0),F=v=>`${v.name}${v.nodata?`, ${a("noData")}`:""}${this.detailText(v,n=>x.includes(n))?`: ${this.detailText(v,n=>x.includes(n))}`:""}`,q=Ns(x);let H;if(D==="cards"){const v=[];s.forEach((n,A)=>{B(n,A)&&v.push(t`<div class="pgl" aria-hidden="true">${a("synGroundLine")}</div>`);const b=o.floors[n.id],$=t`<span><span class="t" dir="auto" title=${n.name}>${O(n.name)}</span>${S?p:t`<span class="s" data-syn-match=${n.match?.how??(n.match?"none":"")}>${this.subLine(n)}</span>`}</span>`;v.push(S?t`<div class="card pfc row" role="group" aria-label=${F(n)} data-syn-row=${n.id} ?data-off=${n.nodata} data-fire=${b&&b.state!=="ok"?b.state:""}>
              <div class="pfr" style="--pgrid:${q} 16px">
                <button class="pfh" data-syn-open-floor=${n.id} @click=${()=>this.openFloor(n)}>${$}</button>
                ${x.map(k=>this.phoneCell(k,n,l,o,N.has(k)))}${d("fwd","fwd")}
              </div></div>`:t`<div class="card pfc" role="group" aria-label=${F(n)} data-syn-row=${n.id} ?data-off=${n.nodata} data-fire=${b&&b.state!=="ok"?b.state:""}>
              <button class="pfh" data-syn-open-floor=${n.id} @click=${()=>this.openFloor(n)}>${$}${d("fwd","fwd")}</button>
              ${x.length?t`<div class="pfm">${x.map(k=>this.phoneMetric(k,n,l,o,N.has(k)))}</div>`:p}
            </div>`)}),H=t`<section class="pboard pb" aria-label=${a("synTitle")} data-syn-board data-syn-phone="cards" data-sum=${l.syn_phone_summary}>${T}${E}<div class="pbl" ?data-dense=${S}>${v}</div>${f}</section>`}else if(D==="section"){const v=m<360?52:m>410?72:64,n=m>=360&&!S,A=[t`<span class="roof" aria-hidden="true"></span><span aria-hidden="true"></span>`];s.forEach((u,W)=>{B(u,W)&&A.push(t`<span class="soil" aria-hidden="true"></span><span class="soiltx" aria-hidden="true"></span>`);const Z=this.sel===u.id;A.push(t`<span class="sl ${u.level<0?"bg":""}" aria-hidden="true" ?data-sel=${Z}><i style="inline-size:${Ts(u)}%"></i><em>${M(u.level)}</em></span>
          <div class="ci" role="group" aria-label=${F(u)} data-syn-row=${u.id} ?data-off=${u.nodata}>
            <button class="pl1" data-syn-sel=${u.id} aria-pressed=${Z} aria-label=${a("synSelectAria",{name:u.name})} @click=${()=>this.pick(u.id)}><span class="t" dir="auto" title=${u.name}>${O(u.name)}</span>${n?t`<span class="s" data-syn-match=${u.match?.how??(u.match?"none":"")}>${this.subLine(u)}</span>`:p}</button>
            <span class="ppls">${x.map(Q=>this.phonePill(Q,u,l,o,N.has(Q)))}</span>
          </div>`)});const b=s.find(u=>u.id===this.sel)??null,$=es(s,l.temp_threshold),k=(u,W)=>u===null||W===null?"":` · ${M(`${u}/${W}`)} ${a("lightsOn")}`,R=b?t`<span class="tx"><b title=${b.name}>${O(b.name)}</b>${this.subLine(b)}${x.includes("light")?k(b.lit,b.lights):""}</span>
            <sw-button size="sm" variant="primary" data-syn-open @click=${()=>this.openFloor(b)}>${a("synOpenFloor")}</sw-button>`:t`<span class="tx"><b>${a("synAll")}</b>${a("synFloorsN",{n:s.length})}${x.includes("light")&&$.litKnown?k($.lit,$.lights):""}</span>
            ${_.button?t`<sw-button size="sm" variant="ghost" data-syn-details @click=${()=>this.info=!0}>${a("synDetails")}</sw-button>`:p}`;H=t`<section class="card pboard pc" aria-label=${a("synTitle")} data-syn-board data-syn-phone="section" data-sum=${l.syn_phone_summary} style="--slab:${v}px">${T}${E}
        <div class="cl" ?data-dense=${S}>${A}</div><div class="dstrip" data-syn-strip>${R}</div>${f}</section>`}else{const v=[];s.forEach((n,A)=>{B(n,A)&&v.push(t`<div class="ground" aria-hidden="true"></div>`);const b=x.includes("temp")?G(n,l.temp_threshold):null,$=o.floors[n.id],k=this.subLine(n);v.push(t`<div class="par" role="group" aria-label=${F(n)} data-syn-row=${n.id} data-temp=${b??""} ?data-off=${n.nodata} data-fire=${$&&$.state!=="ok"?$.state:""}>
          <button class="pan" data-syn-open-floor=${n.id} @click=${()=>this.openFloor(n)}><span class="t" dir="auto" title=${n.name}>${O(n.name)}</span><span class="s" title=${k} data-syn-match=${n.match?.how??(n.match?"none":"")}>${k}</span></button>
          ${x.map(R=>this.phoneCell(R,n,l,o,N.has(R)))}
        </div>`)}),H=t`<section class="card pboard pa" aria-label=${a("synTitle")} data-syn-board data-syn-phone="table" data-sum=${l.syn_phone_summary} style="--pgrid:${q}">${T}${E}
        <div class="pah" aria-hidden="true"><span>${a("synFloor")}</span>${x.map(n=>t`<span data-syn-col=${n} title=${a(Y[n])}>${d(K[n])}</span>`)}</div>
        <div class="plist" ?data-dense=${S}>${v}</div>${f}</section>`}return t`${H}${_.button?this.renderInfo(e,s,i,x,r,w):p}`}phoneValue(e,s,i,r){switch(e){case"light":return s.lit===null||s.lights===null||s.nodata?{v:null,mut:!0}:{v:t`<span class="n">${s.lit}</span><small>/${s.lights}</small>`,mut:!s.lit};case"temp":return s.temp===null||s.nodata?{v:null,mut:!0}:{v:t`<span class="n">${s.temp.toFixed(1)}</span><small>°</small>`,mut:!1,tone:G(s,i.temp_threshold)??void 0};case"presence":return s.people===null?{v:null,mut:!0}:{v:t`<span class="n">${s.people}</span>`,mut:!s.people};case"cameras":return{v:t`<span class="n">${s.cams}</span>${s.shared?t`<small>+${s.shared}</small>`:p}`,mut:!s.cams&&!s.shared,title:s.shared?a("camsShared",{n:s.shared}):void 0};case"doors":return s.doorsOpen===null||s.nodata?{v:null,mut:!0}:{v:t`<span class="n">${s.doorsOpen}</span>`,mut:!s.doorsOpen};case"alerts":return s.alerts===null?{v:null,mut:!0,title:a("alertsNone")}:{v:t`<span class="n">${s.alerts}</span>`,mut:!s.alerts,warn:!!s.alerts};case"fire":{if(!r.connected)return{v:d("offline"),mut:!0,title:a("fireNotConnected"),nc:!0};const l=r.floors[s.id];return l?l.state==="alarm"?{v:d("flame"),mut:!1,warn:!0,title:a("fireAlarm")}:l.state==="fault"?{v:d("wrench"),mut:!0,title:a("fireFault")}:{v:d("check"),mut:!0,title:a("fireOk")}:{v:null,mut:!0}}}}lightsAria(e){return a("synLightsAria",{name:e.name,lit:e.lit??0,lights:e.lights??0})}lightGauge(e,s){const i=Ps(s.syn_phone_light,e);return i.kind==="none"?p:i.kind==="segments"?t`<span class="mb seg" aria-hidden="true" data-syn-gauge="segments">${Array.from({length:i.total},(r,l)=>t`<i class=${l<i.on?"on":""}></i>`)}</span>`:t`<span class="mb" aria-hidden="true" data-syn-gauge="bar"><i style="inline-size:${i.percent}%"></i></span>`}summaryLine(e,s,i,r,l){const o=X(s),c=o.length?o.length===1?a("matchHintOne",{name:o[0].name}):a("matchHintMany",{n:o.length}):"";return!l&&!i.length&&!r&&!c?p:t`<div class="psum" data-syn-summary="line">
      ${l?t`<span class="st"><b>${a("synAll")}</b> · ${a("synFloorsN",{n:s.length})}</span>`:p}
      ${this.hiddenNote(i)}
      ${r?t`<span data-syn-summary-nofloor>${a("synInfoNoFloor")}: ${a("synInfoNoFloorVal",r)}</span>`:p}
      ${c?t`<span data-syn-hint>${c}${this.canLink()?t` · <button class="lnk" data-syn-link=${o[0].id} @click=${()=>this.linkFloor(e,o[0].id)}>${a("matchHintAction")}</button>`:p}</span>`:p}
    </div>`}phoneCell(e,s,i,r,l){const o=this.phoneValue(e,s,i,r);if(e==="light"&&o.v&&!l){const h=t`<span class="pv ${o.mut?"mut":""}"><span class="n">${s.lit}/${s.lights}</span></span>${this.lightGauge(s,i)}`;return this.lightsAllowed(s)?t`<button class="plc" data-syn-lights=${s.id} aria-label=${this.lightsAria(s)} title=${a("floorLightsOpen",{name:s.name})} @click=${g=>this.openLights(g,s)}>${h}</button>`:t`<span class="plc">${h}</span>`}const c=l||!o.v;return t`<span class="pcell" data-syn-cell=${e} ?data-fire-nc=${o.nc}><span class="pv ${c||o.mut?"mut":""} ${o.warn?"warn":""}" data-t=${o.tone??p} title=${c?a("noSource"):o.title??p}>${c?"-":o.v}</span></span>`}phoneMetric(e,s,i,r,l){const o=this.phoneValue(e,s,i,r),c=l||!o.v,h=t`<span class="k">${d(K[e])}${a(qs[e])}</span>`;if(e==="light"&&!c){const g=t`${h}<span class="pval">${o.v}</span>${this.lightGauge(s,i)}`;return this.lightsAllowed(s)?t`<button class="pmt lit" data-syn-lights=${s.id} aria-label=${this.lightsAria(s)} @click=${w=>this.openLights(w,s)}>${g}</button>`:t`<div class="pmt lit">${g}</div>`}return t`<div class="pmt ${c||o.mut?"mut":""} ${l?"dash":""} ${o.warn?"warn":""}" data-syn-cell=${e} ?data-fire-nc=${o.nc} title=${c?a("noSource"):o.title??p}>${h}<span class="pval" data-t=${o.tone??p}>${c?"-":o.v}</span></div>`}phonePill(e,s,i,r,l){const o=this.phoneValue(e,s,i,r),c=l||!o.v;if(e==="light"&&!c&&this.lightsAllowed(s))return t`<button class="ppl lit" data-syn-lights=${s.id} aria-label=${this.lightsAria(s)} @click=${g=>this.openLights(g,s)}>${d("light")}<span class="n">${s.lit}/${s.lights}</span></button>`;const h=e==="light"&&!c?"lit":c?l?"dash mut":"mut":`${o.mut?"mut":""} ${o.warn?"warn":""}`;return t`<span class="ppl ${h}" data-syn-cell=${e} ?data-fire-nc=${o.nc} title=${c?a("noSource"):o.title??a(Y[e])}>${e==="fire"?p:d(K[e])}${c?"-":e==="light"?t`<span class="n">${s.lit}/${s.lights}</span>`:o.v}</span>`}renderInfo(e,s,i,r,l,o){const c=m=>m.map(x=>a(Y[x])).join(", "),h=i.filter(m=>!r.includes(m)),g=X(s),w=g.length?g.length===1?a("matchHintOne",{name:g[0].name}):a("matchHintMany",{n:g.length}):"";return t`<sw-sheet narrow heading=${a("synInfoTitle",{name:O(e.name)})} ?open=${this.info} data-syn-info-sheet @close=${()=>this.info=!1}>
      ${this.info?t`<div class="pinfo">
            <p class="sub">${a("synBoardSub")}</p>
            <dl>
              <dt>${a("synInfoFloors")}</dt><dd>${M(s.length)}</dd>
              <dt>${a("synInfoShown")}</dt><dd data-syn-info-shown>${r.length?c(r):"-"}</dd>
              ${h.length?t`<dt>${a("synInfoWide")}</dt><dd data-syn-info-wide>${c(h)}</dd>`:p}
              ${l.length?t`<dt>${a("synInfoHidden")}</dt><dd data-syn-info-hidden>${c(l)}</dd>`:p}
              ${o?t`<dt>${a("synInfoNoFloor")}</dt><dd data-syn-info-nofloor>${a("synInfoNoFloorVal",o)}</dd>`:p}
            </dl>
            ${w?t`<p class="hint" data-syn-hint>${w}</p>`:p}
            <div class="acts">
              ${w&&this.canLink()?t`<sw-button size="sm" variant="ghost" data-syn-link=${g[0].id} @click=${()=>this.linkFloor(e,g[0].id)}>${a("matchHintAction")}</sw-button>`:p}
              <sw-button size="sm" variant="ghost" data-syn-info-settings @click=${()=>{this.info=!1,C("/system/diagnostics",{focus:"xs"})}}>${a("synInfoSettings")}</sw-button>
            </div>
          </div>`:p}
    </sw-sheet>`}};y.styles=[ts`
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
  `,Hs];L([Cs({type:Boolean,reflect:!0})],y.prototype,"wall",2);L([I()],y.prototype,"tree",2);L([I()],y.prototype,"data",2);L([I()],y.prototype,"lightsOf",2);L([I()],y.prototype,"events",2);L([I()],y.prototype,"error",2);L([I()],y.prototype,"sel",2);L([I()],y.prototype,"now",2);L([I()],y.prototype,"info",2);L([I()],y.prototype,"multiOn",2);y=L([Es("devices-synoptic")],y);export{y as DevicesSynoptic};
//# sourceMappingURL=devices-synoptic-DrHYbkhN.js.map
