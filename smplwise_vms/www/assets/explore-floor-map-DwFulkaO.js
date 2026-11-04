const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{er as Se,E as ge,F as S,G as u,a as ye,o as ze,es as q,f as Ie,A as d,et as W,t as Ce,e as r,H as xe,ac as Ee,eu as Pe,i as P,l as Le,e5 as Oe,ev as Te,aj as g,bv as je,bs as Ae,r as Fe,ae as J,a_ as G,ew as Ne,J as D,at as B,ex as M,O as Y,R as C,ey as X,ez as T,eA as R,bf as j,eB as z,bg as De,aS as Be,_ as Me,q as N,bo as V,eC as w,bt as Re,eD as Ve,eE as He,j as Ze,bp as Q,bu as ee,eF as te,eG as se,eH as qe,bh as We,eI as Ke,av as ie,eJ as Ue,eK as Je,eL as Ge,eM as Ye,eN as Xe,eO as Qe,eP as et,eQ as tt,bq as $e}from"./index-BJ665FDN.js";import{l as st}from"./lead-reserve-8HuqOQGZ.js";import"./sw-chip-DBKKKG59.js";import{d as it,a as at}from"./demo-3d-BKWqfNkz.js";import{q as ot}from"./sw-plan-canvas-BDydJlhE.js";import{p as A}from"./zones-D57f8rFu.js";import{l as rt,c as nt,w as lt}from"./views-D6FDYNQ0.js";import{w as ct}from"./geometry-DRHd_-S4.js";import{aV as dt,k as ht,aW as pt,T as ut,d as mt,aX as ft,aY as wt,aZ as bt,a_ as vt,a$ as gt,b0 as yt,b1 as xt,l as $t,b2 as kt,b3 as _t}from"./shared-space-DRXC19ZL.js";import{s as St}from"./state-facts-BfNweodc.js";import{l as zt,a as It,f as Ct,d as Et}from"./plan-catalog-Crj_wiKn.js";import{b as H}from"./scene-builder-D2O_VUuA.js";import{m as Pt}from"./quality-mode-Lw2uUGRc.js";import{h as ae,s as oe,r as re,p as Lt,B as Ot,a as Tt,b as jt,c as At,d as Ft}from"./plan-change-key-DbfqDpIh.js";import{i as Nt,v as Dt}from"./quality-ladder-CXajLOl3.js";import{N as Bt,a as Mt,r as Rt}from"./wall-plan-mode-CWXgHhMr.js";import{S as ne}from"./still-bake-CEiSkQIB.js";import{D as Vt,p as Ht,C as le,c as Zt,a as qt}from"./plan-view-jgGRgRmb.js";import{r as ce}from"./sun-D-xXkfn5.js";import{b as Wt}from"./part-select-CylWA6VC.js";import{c as Kt,F as Ut}from"./plan-studio-panel-DE_D12T7.js";import{w as E,W as de}from"./webgl-U1M5Oj-F.js";import{h as Jt,n as Gt,e as Yt,a as Xt,H as x,l as Qt,b as he,c as L,d as es,f as ts,g as ss,i as pe,j as ue}from"./hud-layout-E9SCGK9C.js";import{g as is,u as as}from"./skins-DhC8vc9D.js";import{m as os,a as rs}from"./map-create-FNhmtDeM.js";import"./sw-logo-art-Va6y_cIM.js";import"./candidates-CS7-ly_Q.js";import"./material-resolve-CcHUYyNX.js";import"./connector-targets-Cw_oqhYV.js";const me={same_zone:"אותו חדר",adjacent_zone:"חדר סמוך",nearby:"בקרבת מקום"},ns=.2,O={same_zone:0,adjacent_zone:1,nearby:2};function ls(e){let t=0;for(let s=0;s<e.length;s++){const a=e[s],i=e[(s+1)%e.length];t+=a.x*i.y-i.x*a.y}return Math.abs(t)/2}function cs(e,t){let s=null;for(const a of t){if(a.polygon.length<3||!A(e,a.polygon))continue;const i=ls(a.polygon);(!s||i<s.a)&&(s={z:a,a:i})}return s?.z??null}function ds(e,t,s){const a=s.x-t.x,i=s.y-t.y;if(a===0&&i===0)return Math.hypot(e.x-t.x,e.y-t.y);const o=Math.max(0,Math.min(1,((e.x-t.x)*a+(e.y-t.y)*i)/(a*a+i*i)));return Math.hypot(e.x-(t.x+o*a),e.y-(t.y+o*i))}function hs(e,t,s=.01){for(const[a,i]of[[e,t],[t,e]])for(const o of a){if(A(o,i))return!0;for(let n=0;n<i.length;n++)if(ds(o,i[n],i[(n+1)%i.length])<=s)return!0}return!1}function ps(e,t,s,a=ns){const i=new Set(e),o=t.filter(l=>i.has(l.id));if(!o.length)return[];const n=new Map;for(const l of t)n.set(l.id,cs(l.position,s));const c=new Map;for(const l of o){const m=n.get(l.id)??null;for(const b of t){if(i.has(b.id))continue;const f=n.get(b.id)??null,y=Math.hypot(b.position.x-l.position.x,b.position.y-l.position.y);let k=null;if(m&&f&&f.id===m.id?k="same_zone":m&&f&&hs(m.polygon,f.polygon)?k="adjacent_zone":y<=a&&(k="nearby"),!k)continue;const _=c.get(b.id);(!_||O[k]<O[_.relation]||O[k]===O[_.relation]&&y<_.distance)&&c.set(b.id,{id:b.id,relation:k,distance:Math.round(y*1e3)/1e3,from:l.id,zoneId:f?.id??null,zoneName:f?.name??null})}}return[...c.values()].sort((l,m)=>O[l.relation]-O[m.relation]||l.distance-m.distance||(l.id<m.id?-1:1))}function Z(e){return e.join(",")}function us(e,t){if(!e)return[];const s=[];for(const a of e.split(",")){const i=a.trim();i&&t.has(i)&&!s.includes(i)&&s.push(i)}return s}function ms(e,t){return e===t||K(e,t)}function K(e,t){if(e===t)return!0;if(typeof e!="object"||typeof t!="object"||e===null||t===null)return!1;if(Array.isArray(e)){if(!Array.isArray(t)||e.length!==t.length)return!1;for(let o=0;o<e.length;o++)if(!K(e[o],t[o]))return!1;return!0}if(Array.isArray(t))return!1;const s=Object.keys(e);if(s.length!==Object.keys(t).length)return!1;const a=t,i=e;for(const o of s)if(!Object.prototype.hasOwnProperty.call(a,o)||!K(i[o],a[o]))return!1;return!0}function fe(e,t){const s=e.state==="on",a=e.actions.find(o=>o.id.endsWith(s?"turn_off":"turn_on"))??null,i=e.can_control?e.available?a?a.granted===!1?`נדרשת הרשאה נפרדת: ${a.grant??""}`:t.busy?"פעולה על המפסק כבר בדרך":t.stale?"המפה אינה מעודכנת — השליטה חוזרת עם החידוש":null:"אין פעולה מותרת למפסק הזה":"המפסק אינו זמין":"אין הרשאת שליטה בישויות בקומה";return{spec:a,blocked:i!==null,why:i}}var fs=Object.defineProperty,ws=Object.getOwnPropertyDescriptor,U=(e,t,s,a)=>{for(var i=a>1?void 0:a?ws(t,s):t,o=e.length-1,n;o>=0;o--)(n=e[o])&&(i=(a?n(t,s,i):n(i))||i);return a&&i&&fs(t,s,i),i};function bs(e,t,s="",a=null){window.dispatchEvent(new CustomEvent(Se,{detail:{target:{id:e,kind:"generic",name:t,state:s,tracked:!1},tab:"tickets",opener:a}}))}let F=class extends ye{constructor(){super(...arguments),this.entityId="",this.count=0,this.token=0,this.offNames=null}connectedCallback(){super.connectedCallback(),this.offNames=ze(()=>this.requestUpdate())}disconnectedCallback(){super.disconnectedCallback(),this.offNames?.(),this.token++}willUpdate(e){e.has("entityId")&&this.load()}async load(){const e=++this.token;if(this.count=0,!(!this.entityId||!q()))try{const t=await Ie().byEntity(this.entityId);e===this.token&&(this.count=t.open_count)}catch{}}render(){return this.count?r`<span class="chip" role="img" aria-label=${W("countChip",{n:this.count})} title=${W("countChip",{n:this.count})} data-ticket-count=${this.count}>${Ce("ticket")}<bdi>${this.count}</bdi></span>`:d}};F.styles=ge`
    :host { display: inline-flex; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: var(--sw-r-pill); background: var(--sw-warning-soft); color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); font-variant-numeric: tabular-nums; line-height: 1.6;
    }
    .chip svg { inline-size: 1.1em; block-size: 1.1em; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  `;U([S({attribute:"entity-id"})],F.prototype,"entityId",2);U([u()],F.prototype,"count",2);F=U([xe("ticket-count-chip")],F);var vs=Object.defineProperty,gs=Object.getOwnPropertyDescriptor,p=(e,t,s,a)=>{for(var i=a>1?void 0:a?gs(t,s):t,o=e.length-1,n;o>=0;o--)(n=e[o])&&(i=(a?n(t,s,i):n(i))||i);return a&&i&&vs(t,s,i),i};const ys={off:"כבוי",heat:"חימום",cool:"קירור",heat_cool:"חימום/קירור",auto:"אוטומטי",dry:"ייבוש",fan_only:"מאוורר בלבד"},we=[{id:"cameras",icon:"camera",label:()=>w("floor.cameras")},{id:"doors",icon:"door",label:()=>w("floor.doors")},{id:"lights",icon:"light",label:()=>w("floor.lights")},{id:"sensors",icon:"sensor",label:()=>w("floor.sensors")},{id:"zones",icon:"map",label:()=>"חדרים ואזורים"},{id:"structure",icon:"wall",label:()=>"מבנה"},{id:"objects",icon:"grid",label:()=>"עצמים"},{id:"connectors",icon:"stairs",label:()=>"מחברים"},{id:"states",icon:"activity",label:()=>"מצבי חדרים"},{id:"photo",icon:"image",label:()=>"תמונת הקומה"}],be=["structure","objects","connectors","states","photo"],ve=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"];function xs(e){const t=e.match(/-?\d+/);return t?t[0]:/קרקע/.test(e)?"ק":/גג/.test(e)?"גג":/מרתף/.test(e)?"מ":(e.split(/[\s–-]+/).filter(Boolean).pop()??e).slice(0,4)}let h=class extends ye{constructor(){super(...arguments),this.phone=new Ee(this),this.floorId="f0",this.screenState="ready",this.focusZone="",this.focusCamera="",this.focusEntity="",this.focusObject="",this.picksParam="",this.embedded=!1,this.compact=!1,this.otherBundles={},this.sheetTall=!1,this.focusedObjectId=null,this.selectedZoneId=null,this.bundle=null,this.tree=null,this.loadError="",this.noFloors=!1,this.selectedId=null,this.ticketFor=null,this.anchor=null,this.layers=new Set(["cameras","doors","lights","sensors","zones","structure","objects","connectors","states","photo"]),this.planImage=!0,this.catalogLookup=null,this.levelFilter=null,this.geometry=null,this.view3d=!1,this.default3d=!1,this.threeState="idle",this.threeError="",this.preset3d="iso",this.walk3d=!1,this.real3d=!1,this.corner3d=null,this.materials3d=null,this.quality3d=null,this.catalog3d=null,this.itemNames=new Map,this.sceneMemo=null,this.sceneTimer=0,this.sceneDue=!1,this.geomSeq=0,this.presenceFade=dt,this.liveTransport=null,this.stateNow=Date.now(),this.fadeTimer=0,this.stateFacts=null,this.roomStateMemo=null,this.pinned=!1,this.panel=!1,this.multi=!1,this.sideList=(()=>{try{return localStorage.getItem("sw.map.sidelist")==="1"}catch{return!1}})(),this.jumpZoom=(()=>{try{return localStorage.getItem("sw.map.jumpzoom")==="1"}catch{return!1}})(),this.focusZoom=!0,this.saveView=null,this.savedView=null,this.picked=[],this.narrow=!1,this.syncConnected=!0,this.action=null,this.confirmSpec=null,this.stopWs=null,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.narrow=this.mq.matches,this.onKey=e=>{if(!(this.embedded&&e.key==="3")){if(e.key==="3"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!this.typing(e)){if(this.confirmSpec||this.saveView||e.repeat)return;e.preventDefault(),this.toggle3d();return}if(e.key==="Escape"&&!this.confirmSpec)if(this.selectedId){const t=this.selectedId;this.close(),this.shows3d||this.canvas?.focusMarker(t)}else this.panel&&(this.panel=!1)}},this.offScreenEdit=null,this.presenceSnap=null,this.presenceTimer=0,this.hudKey="",this.hudRo=null,this.wallSearch=null,this.wallPins=Bt,this.actionArgs={},this.renaming=null,this.notice="",this.incidentBusy=!1,this.skinBusy=!1,this.skinNote="",this.stillsFallback=!1,this.bakeBusy=!1,this.bakeNote="",this.bakeCancel=!1,this.viewDials=Vt,this.stillsSite=ce(null),this.otherBundlesFor="",this.autoBaked=new Set}typing(e){const t=e.composedPath()[0];return t instanceof HTMLElement&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable)}async loadPresence(){try{this.presenceSnap=await Pe()}catch{}}connectedCallback(){super.connectedCallback(),P()&&Le("presence.building.view")&&(this.loadPresence(),this.presenceTimer=window.setInterval(()=>{document.hidden||this.loadPresence()},Oe)),this.offScreenEdit=Te({id:"floor-map-edit",label:"עריכת המפה",icon:"edit",can:()=>!je("structure")&&(this.bundle?this.bundle.permissions.edit:!P()),run:()=>g(`/explore/floors/${this.floorId}/edit`)}),this.narrow=this.mq.matches,this.mq.addEventListener("change",this.onMq),window.addEventListener("keydown",this.onKey),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.presenceTimer),this.offScreenEdit?.(),this.offScreenEdit=null,window.removeEventListener("keydown",this.onKey),this.mq.removeEventListener("change",this.onMq),window.clearTimeout(this.sceneTimer),this.sceneTimer=0,window.clearTimeout(this.fadeTimer),this.fadeTimer=0,this.stopWs?.(),this.stopWs=null,this.hudRo?.disconnect(),this.hudRo=null,this.hudKey=""}syncHud(e=!1){const t=this.stage;if(!t)return;!this.hudRo&&typeof ResizeObserver<"u"&&(this.hudRo=new ResizeObserver(()=>this.syncHud(!0)),this.hudRo.observe(t));const s=this.bundle,a=window.innerWidth,i=this.shows3d?this.corner3d:null,o=this.sideList&&s?.source==="api",n=[a,i??"-",this.shows3d,o,this.panel,this.sheetTall,s?.floorName??"",s?.levels.map(_=>`${_.name}${_.elevation_m}`).join(",")??"",Object.keys(s?.circuitStates??{}).length].join("|");if(!e&&n===this.hudKey)return;this.hudKey=n;const c=Jt({sideList:o,panel:this.panel,viewport:a}),l=this.renderRoot.querySelector(".levelbar"),m=this.renderRoot.querySelector("[data-floorchip]"),b=this.renderRoot.querySelector("[data-circuit-strip]");l&&this.hudRo?.observe(l);const f=!!l&&Gt({stage:t.clientWidth,end:c,bar:this.barLineWidth(l),chip:m?.offsetWidth??0,endItem:Yt(i,b?.offsetWidth??0)});t.toggleAttribute("data-hud-row2",f),i?t.setAttribute("data-corner",i):t.removeAttribute("data-corner"),c===x?t.style.removeProperty("--hud-end"):t.style.setProperty("--hud-end",`${c}px`);const y=Xt({sideList:o,viewport:a,tall:this.sheetTall});y?t.style.setProperty("--hud-bottom",y):t.style.removeProperty("--hud-bottom"),l&&t.style.setProperty("--hud-bar-h",`${Math.ceil(l.offsetHeight)}px`);const k=!this.shows3d&&o&&c!==x?this.canvas?.zoomDockRect()??null:null;k?t.style.setProperty("--hud-list-bottom",`${Qt(t.getBoundingClientRect().top+t.clientTop+t.clientHeight-k.top)}px`):t.style.removeProperty("--hud-list-bottom")}barLineWidth(e){const t=e.style.whiteSpace;e.style.whiteSpace="nowrap";const s=e.scrollWidth+2;return e.style.whiteSpace=t,s}startWs(){this.stopWs||!P()||(this.stopWs=Ae(e=>{const t=this.bundle;if(e.type==="entity_state_changed"&&t){const s=e.entity.entity_id,a=Object.values(t.circuitStates).some(i=>i.entity_id===s);if(!a&&!t.anchors.some(i=>i.resource_type==="ha_entity"&&i.resource_id===s))return;this.stateNow=Date.now(),this.bundle={...t,anchors:t.anchors.map(i=>i.resource_type==="ha_entity"&&i.resource_id===s?{...i,entity:{...i.entity??{},...e.entity,actions:i.entity?.actions}}:i),circuitStates:a?Object.fromEntries(Object.entries(t.circuitStates).map(([i,o])=>[i,o.entity_id===s?{...o,state:e.entity.state,fresh:e.entity.fresh,available:e.entity.available}:o])):t.circuitStates}}else e.type==="ha_sync_state"?this.syncConnected=e.connected:e.type==="heartbeat"&&(this.syncConnected=e.sync.connected)}))}updated(e){this.syncHud(),this.scheduleFadeTick(this.bundle&&this.layers.has("states")?this.roomStateLayer:null),this.default3d&&!this.view3d&&this.hasScene&&E()&&(this.default3d=!1,this.toggle3d()),this.view3d&&this.loadOtherBundles(),(e.has("picked")||e.has("multi"))&&this.syncPicksRoute(),e.has("floorId")&&e.get("floorId")!==void 0?(this.selectedId=null,this.anchor=null,this.selectedZoneId=null,this.load()):(e.has("focusZone")||e.has("focusCamera")||e.has("focusEntity")||e.has("focusObject"))&&this.bundle?this.applyFocus():e.has("picksParam")&&e.get("picksParam")!==void 0&&this.bundle&&this.applyPicksParam()}picksValue(){return this.multi?Z(this.picked):""}syncPicksRoute(){if(!P()||this.embedded||!this.bundle)return;const e=new URL(window.location.href).hash.replace(/^#/,""),[t,s=""]=e.split("?");if(t!==`/explore/floors/${this.floorId}`)return;const a=new URLSearchParams(s),i=this.picksValue();(a.get("picks")??"")!==i&&(i?a.set("picks",i):a.delete("picks"),Fe(t,a))}applyPicksParam(){if(!this.bundle||!this.picksParam)return;const t=new Set(this.cameraAnchors().map(a=>a.id)),s=us(this.picksParam,t);Z(s)===Z(this.picked)&&this.multi||(this.multi||this.setMulti(!0),this.picked=s)}viewKey(){return`sw.map.view.${this.floorId}`}rememberView(){const e=this.canvas?.getView();if(e)try{sessionStorage.setItem(this.viewKey(),JSON.stringify(e))}catch{}}async restoreView(){let e=null;try{e=sessionStorage.getItem(this.viewKey())}catch{return}if(!e)return;await this.updateComplete;const t=this.canvas;if(!(!t||this.shows3d))try{const s=JSON.parse(e);t.setView(s)}catch{}}get adjacentSuggestions(){const e=this.bundle;return!e||!this.multi||!this.picked.length?[]:ps(this.picked,this.cameraAnchors().map(t=>({id:t.id,position:t.position})),e.zones.map(t=>({id:t.id,name:t.name,polygon:t.polygon}))).slice(0,8)}async applyFocus(){const e=this.bundle;if(!e||!this.focusZone&&!this.focusCamera&&!this.focusEntity&&!this.focusObject)return;await this.updateComplete;const t=this.shows3d?void 0:this.canvas,s=this.focusZone?e.zones.find(i=>i.id===this.focusZone):null;if(s){const i=s.polygon.map(n=>n.x),o=s.polygon.map(n=>n.y);this.selectedZoneId=s.id,t?.zoomToBox(Math.min(...i),Math.min(...o),Math.max(...i),Math.max(...o))}const a=this.focusCamera?e.anchors.find(i=>i.resource_type==="camera"&&i.resource_id===this.focusCamera):this.focusEntity?e.anchors.find(i=>i.resource_type==="ha_entity"&&i.resource_id===this.focusEntity):null;if(a){t&&(this.focusZoom?t.zoomToBox(a.position.x-.15,a.position.y-.15,a.position.x+.15,a.position.y+.15,48,2.2):t.centerOn(a.position.x,a.position.y),await this.updateComplete);const i=t?.toScreen(a.position.x,a.position.y)??null;this.selectedId=a.id,this.anchor=i?{x:i.x,y:i.y}:null}if(this.focusObject){const i=this.geometry?.objects.find(o=>o.id===this.focusObject);if(!i)return;this.focusedObjectId=i.id,t?.centerOn(i.position[0],i.position[1])}}async load(){this.loadError="";try{let e=this.tree??await J();if(P()&&this.tree&&!G(e,this.floorId)&&(e=await J()),this.tree=e,P()&&!G(e,this.floorId)){const i=Ne(e,(await D().catch(()=>null))?.["map.default_floor"]);if(i&&i.id!==this.floorId){g(`/explore/floors/${i.id}`);return}if(!i){this.noFloors=!0,this.bundle=null;return}}this.noFloors=!1,this.restoreLayers(),this.restorePlanImage(),this.levelFilter=null;const t=await B(this.floorId);this.bundle=M()?{...t,anchors:t.anchors.filter(i=>i.resource_type!=="camera")}:t;const s=this.bundle;D().then(i=>{this.bundle===s&&(this.levelFilter=ht(i["plan.levels"],s)),this.bundle===s&&(this.default3d=(i["map.default_view"]==="3d"||this.keep3d())&&!this.view3d),this.quality3d=Pt(i["plan.quality"]),this.presenceFade=pt(i["plan.presence_fade"]),this.liveTransport=Y(i)}).then(()=>Ht()).then(i=>{i&&(this.viewDials=i.effective,this.stillsSite=ce(i.location))}).catch(()=>this.liveTransport=Y(null));const a=++this.geomSeq;this.geometry=null,ct(this.bundle).then(i=>{a===this.geomSeq&&(this.geometry=i,this.maybeAutoBake(),this.focusObject&&this.applyFocus())}),this.bundle.source==="api"&&(this.startWs(),zt(this.bundle.catalogRevision).then(i=>{this.catalogLookup=It(i),this.catalog3d=Ct(i),this.materials3d=Et(i),this.itemNames=new Map(i.items.map(o=>[o.id,o.names.he]))}).catch(()=>{})),this.applyFocus(),this.picksParam&&(this.applyPicksParam(),this.restoreView())}catch(e){this.loadError=C(e),this.bundle=null}}get buildingFloors(){if(this.tree?.source!=="api")return[];for(const e of this.tree.sites)for(const t of e.buildings??[]){const s=t.floors??[];if(!s.some(i=>i.id===this.floorId))continue;const a=s.map(i=>xs(i.name));return s.map((i,o)=>({id:i.id,name:i.name,hasPlan:i.has_plan,short:a.filter(n=>n===a[o]).length>1?`${a[o]}${o+1}`:a[o]}))}return[]}get floors(){return this.tree?.source==="api"?this.tree.sites.flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(s=>({id:s.id,name:`${t.name} · ${s.name}`,cameraCount:s.camera_count,hasPlan:s.has_plan})))):X.map(e=>({id:e.id,name:e.name,cameraCount:e.cameraCount,hasPlan:e.hasPlan}))}get markers(){const e=this.bundle;if(!e)return[];const t=this.screenState==="stale";if(e.source==="demo"){const s=this.layers.has("cameras")?T.filter(i=>i.floorId===e.floorId).map(i=>({id:i.id,kind:"camera",label:i.name,x:i.x,y:i.y,rotation:i.rotation,fov:i.fov,state:i.state})):[],a=R.filter(i=>i.floorId===e.floorId).filter(i=>i.domain==="lock"&&this.layers.has("doors")||i.domain==="light"&&this.layers.has("lights")||i.domain==="binary_sensor"&&this.layers.has("sensors")).map(i=>({id:i.id,kind:i.domain,label:i.name,x:i.x,y:i.y,state:t?"stale":"neutral"}));return[...s,...a]}return e.anchors.filter(s=>s.resource_type==="camera"?this.layers.has("cameras"):this.layers.has(s.layer_id==="doors"?"doors":s.layer_id==="lights"?"lights":"sensors")).filter(s=>ut(e,s.level_id,this.levelFilter)).map(s=>({id:s.id,kind:s.resource_type==="camera"?"camera":De(s.layer_id,s.entity?.domain),label:z(s),x:s.position.x,y:s.position.y,rotation:s.rotation_degrees,fov:s.field_of_view_degrees??void 0,radius:s.coverage_radius??void 0,polygon:s.coverage_polygon?s.coverage_polygon.map(([a,i])=>({x:a,y:i})):void 0,labelPos:s.label_pos??void 0,level:s.level_id??null,state:s.resource_type==="camera"?j(s):t?"stale":this.entityTone(s.entity)}))}get anchorPositions(){const e={};for(const t of this.bundle?.anchors??[])e[`${t.resource_type}:${t.resource_id}`]={x:t.position.x,y:t.position.y,rotation:t.rotation_degrees};return e}get circuitStateMap(){return Object.fromEntries(Object.entries(this.bundle?.circuitStates??{}).map(([e,t])=>[e,t.state]))}get entityStateMap(){const e={};for(const t of this.bundle?.anchors??[])t.resource_type==="ha_entity"&&(e[t.resource_id]=t.entity?.state??null);return e}stateFactsFor(e){const t=this.geometry;if(!t)return null;const s=this.stateFacts;if(s&&s.geometry===t&&s.w===e.width&&s.h===e.height)return s;const{openings:a,lamps:i}=St(t,e.width,e.height,this.catalogLookup);return this.stateFacts={geometry:t,w:e.width,h:e.height,openings:a,lamps:i},this.stateFacts}get roomStateLayer(){const e=this.bundle;if(!e||e.source!=="api"||!this.layers.has("states"))return null;const t=this.states3dStale,s=this.roomStateMemo;if(s&&s.bundle===e&&s.geometry===this.geometry&&s.layers===this.layers&&s.now===this.stateNow&&s.fade===this.presenceFade&&s.stale===t)return s.layer;const a=t?null:this.deriveRoomStates(e);return this.roomStateMemo={bundle:e,geometry:this.geometry,layers:this.layers,now:this.stateNow,fade:this.presenceFade,stale:t,layer:a},a}deriveRoomStates(e){const t=this.stateFactsFor(e);if(!e.zones.length&&!t?.openings.length)return null;const s=this.circuitStates3d,a=this.entityStates3d,i=[];for(const l of e.anchors){if(l.resource_type!=="ha_entity")continue;const m=l.entity;i.push({id:l.resource_id,domain:m?.domain??l.resource_id.split(".")[0]??"",device_class:m?.device_class??null,state:a[l.resource_id]??null,last_changed:m?.last_changed??null,attributes:m?.attributes??null,x:l.position.x,y:l.position.y,level_id:l.level_id??null,layer_id:l.layer_id})}const o=(t?.lamps??[]).map(l=>({x:l.x,y:l.y,level_id:l.level_id,on:l.circuit!==null&&s[l.circuit]==="on"||l.entity!==null&&a[l.entity]==="on"})),n=e.zones.map(l=>({id:l.id,polygon:l.polygon,level_id:l.level_id??null})),c=this.geometry?mt(this.geometry):e.levels.find(l=>l.is_default)?.id??"L0";return ft({rooms:n,entities:i,openings:t?.openings??[],lamps:o,size:[e.width,e.height],scaleMPerPx:e.scaleMPerPx,now:this.stateNow,fade:this.presenceFade,levelOf:l=>l??c})}scheduleFadeTick(e){const t=!!e&&Object.values(e.rooms).some(a=>a.presenceFade>0&&!a.presence)||!!e&&Object.values(e.levels).some(a=>a.presence>0&&a.presence<1),s=wt(this.presenceFade);if(!t||!s){window.clearTimeout(this.fadeTimer),this.fadeTimer=0;return}this.fadeTimer||(this.fadeTimer=window.setTimeout(()=>{this.fadeTimer=0,this.stateNow=Date.now()},s))}get states3dStale(){return this.screenState==="stale"||!this.syncConnected}get entityStates3d(){const e=this.states3dStale,t={};for(const s of this.bundle?.anchors??[])s.resource_type==="ha_entity"&&(t[s.resource_id]=e||s.entity?.fresh===!1?null:s.entity?.state??null);return t}get circuitStates3d(){const e=this.states3dStale;return Object.fromEntries(Object.entries(this.bundle?.circuitStates??{}).map(([t,s])=>[t,e||s.fresh===!1?null:s.state]))}anchorShown(e){return e.resource_type==="camera"?this.layers.has("cameras"):this.layers.has(e.layer_id==="doors"?"doors":e.layer_id==="lights"?"lights":"sensors")}get sceneAnchors(){const e=this.bundle;return!e||e.source!=="api"?[]:e.anchors.filter(t=>this.anchorShown(t)&&(t.resource_type!=="camera"||j(t)!=="forbidden")).map(t=>this.sceneAnchor(t))}sceneAnchor(e){const t=this.entityStates3d;return{id:e.id,resource_type:e.resource_type,resource_id:e.resource_id,x:e.position.x,y:e.position.y,rotation:e.rotation_degrees,fov:e.field_of_view_degrees??null,radius:e.coverage_radius??null,polygon:e.coverage_polygon??null,level_id:e.level_id??null,layer_id:e.layer_id,label:z(e),state:e.resource_type==="ha_entity"?t[e.resource_id]??null:null,online:e.resource_type==="camera"&&e.camera?e.camera.status==="online":null,mount_height_m:e.mount_height_m??null,tilt_deg:e.tilt_deg??null}}async exportControlImages(){const e=this.bundle,t=this.renderRoot.querySelector("sw-plan-3d");if(!(!e||e.source!=="api"||!this.geometry||!t||this.skinBusy)){this.skinBusy=!0;try{const s=await is(e.floorId);if(!s.geometry_key){this.skinNote="לקומה אין מבנה מפורסם — תמונת בקרה נוצרת מהמבנה המפורסם בלבד.";return}if(e.geometryRef?.doc_hash!==s.doc_hash){this.skinNote="המפה מציגה מבנה שאינו המבנה המפורסם (טיוטה) — תמונת בקרה נוצרת מהמבנה המפורסם בלבד.";return}const a={doc:this.geometry,width:e.width,height:e.height,entityStates:{},circuitStates:{},catalog:this.catalog3d,anchors:[],zones:e.zones.map(o=>({id:o.id,name:o.name,polygon:o.polygon,level_id:o.level_id??null}))};let i=0;for(const o of le){const n=t.captureControl(Zt(H(qt(a,o)),o));if(!n)throw new Error("צילום תמונת הבקרה נכשל (WebGL).");(await as(e.floorId,o,s.geometry_key,n)).identical&&i++}this.skinNote=`תמונות הבקרה (אורות כבויים / דולקים) נשמרו במתקן בלבד${i===le.length?" — זהות לשמורות":""}; שום דבר לא נשלח לספק.`}catch(s){this.skinNote=C(s)}finally{this.skinBusy=!1}}}sceneStructureKeys(e){const t=e.source==="api"?e.anchors.map(s=>[s.id,s.revision,s.position.x,s.position.y,s.rotation_degrees,s.field_of_view_degrees,s.coverage_radius,s.coverage_polygon?.length,s.level_id,s.layer_id,s.mount_height_m,s.tilt_deg,z(s)].join("|")).join(";"):"";return[e.floorId,e.width,e.height,t,e.zones,this.geometry,this.layers,this.catalog3d,this.itemNames,this.screenState]}sceneStatesKey(e,t){if(e.source==="demo")return"";const s=e.anchors.filter(a=>a.resource_type==="camera").map(a=>`${a.id}:${a.camera?.status??""}`).join(",");return JSON.stringify([this.entityStates3d,this.circuitStates3d,s,this.syncConnected,bt(t)])}get hasScene(){const e=this.bundle;return e?e.source==="demo"?!!X.find(t=>t.id===e.floorId)?.hasPlan&&Be(e.floorId).length>0:this.geometry!==null:!1}scene3d(){const e=this.bundle;if(!e||!this.hasScene)return null;const t=this.sceneStructureKeys(e),s=[...t,this.levelFilter,this.walk3d,this.real3d],a=this.roomStateLayer,i=this.sceneStatesKey(e,a),o=this.sceneMemo,n=!!o&&o.structure.length===s.length&&o.structure.every((v,I)=>v===s[I]),c=!!o&&o.structureAll.length===t.length&&o.structureAll.every((v,I)=>v===t[I]);if(o&&n&&o.states===i)return o;if(o&&n&&!this.sceneDue)return this.sceneTimer||(this.sceneTimer=window.setTimeout(()=>{this.sceneTimer=0,this.sceneDue=!0,this.view3d&&this.requestUpdate()},100)),o;let l=null;const m=this.states3dStale,b=v=>m?Object.fromEntries(Object.keys(v).map(I=>[I,null])):v;let f=[];const y={};if(e.source==="demo"){const v=it(e.floorId),I=new Set(T.filter($=>$.floorId===e.floorId&&$.state==="forbidden").map($=>$.id));v&&(l={...v,entityStates:b(v.entityStates),circuitStates:b(v.circuitStates),anchors:v.anchors.filter($=>this.anchorShown($)&&!I.has($.id)).map($=>m?{...$,state:null}:$)}),f=this.layers.has("cameras")?T.filter($=>$.floorId===e.floorId&&!I.has($.id)).map($=>({id:$.id,label:$.name})):[],Object.assign(y,at(e.floorId))}else if(this.geometry){l={doc:this.geometry,width:e.width,height:e.height,anchors:this.sceneAnchors,entityStates:this.entityStates3d,circuitStates:this.circuitStates3d,catalog:this.catalog3d,zones:e.zones.map(v=>({id:v.id,name:v.name,polygon:v.polygon,level_id:v.level_id??null}))},f=e.anchors.filter(v=>v.resource_type==="camera"&&this.layers.has("cameras")&&j(v)!=="forbidden").map(v=>({id:v.id,label:z(v)}));for(const v of e.anchors)y[v.id]=z(v);for(const v of this.geometry.objects)y[v.id]=v.label||this.itemNames.get(v.item_id)||v.item_id;for(const v of e.zones)y[v.id]=v.name}if(!l)return null;const k={structure:this.layers.has("structure"),objects:this.layers.has("objects"),connectors:this.layers.has("connectors"),zones:this.layers.has("zones")},_=H({...l,level:this.levelFilter,layers:k,roomStates:a,walk:this.walk3d,realistic:this.real3d,materialsCatalog:this.materials3d}),ke=o&&n&&ms(o.desc,_)?o.desc:_,_e=o&&c?o.all:H({...l,level:null,layers:k,roomStates:null});return this.sceneMemo={structure:s,structureAll:t,states:i,desc:ke,all:_e,cameras:f,labels:y},this.sceneDue=!1,window.clearTimeout(this.sceneTimer),this.sceneTimer=0,this.sceneMemo}get shows3d(){return this.view3d&&(this.threeState==="ready"&&this.hasScene||this.stillsOnly)}get can3d(){return E()&&this.hasScene||this.stillsOnly}get stillsOnly(){return!E()&&ae(this.bundle,oe(this.bundle,this.levelFilter))}onWalkChange(e){this.walk3d!==e&&(this.walk3d=e,this.sceneDue=!0)}async toggle3d(){if(this.shows3d){this.walk3d=!1,this.view3d=!1,await this.updateComplete,this.onViewChange();return}if(!(!this.can3d||this.threeState==="loading")){if(this.stillsOnly){this.anchor=null,this.view3d=!0;return}if(this.threeState!=="ready"){this.threeState="loading";try{await Me(()=>import("./sw-plan-3d-Cg5E8lYy.js"),__vite__mapDeps([0]),import.meta.url),this.threeState="ready"}catch(e){this.threeState="error",this.threeError=C(e);return}}this.can3d&&(this.anchor=null,this.sceneDue=!0,this.view3d=!0)}}get sel3d(){return this.selectedId??this.focusedObjectId??this.selectedZoneId}onPartSelect(e){const{id:t,kind:s}=e.detail,a=this.bundle;if(!t||!s||!a){if(this.multi)return;this.close(),this.focusedObjectId=null,this.selectedZoneId=null;return}if(this.multi&&s!=="zone"){const o=a.anchors.find(n=>n.id===t);s==="camera"&&o?.resource_type==="camera"&&this.togglePick(o.id);return}if(s==="object"){const o=this.geometry?.circuits.find(c=>c.member_ids.includes(t)),n=o?a.circuitStates[o.id]:void 0;if(n){const c=fe(n,{busy:!!this.action?.busy&&this.action.entityId===n.entity_id,stale:this.screenState==="stale"});c.spec&&!c.blocked&&this.trigger(n.entity_id,c.spec),this.close(),this.selectedZoneId=null,this.focusedObjectId=t;return}}const i=s==="zone"?null:Wt({id:t,kind:s},this.geometry,a.anchors);if(i&&"anchor"in i){this.selectedZoneId=null,this.focusedObjectId=null,this.selectedId=i.anchor,this.anchor=null;return}if(i){this.close(),this.selectedZoneId=null,this.focusedObjectId=i.object;return}if(s==="zone"){if(this.multi){this.pickZone(t);return}this.focusedObjectId=null,this.onZoneSelect(t)}}wallPinsFor(e){return e!==this.wallSearch&&(this.wallSearch=e,this.wallPins=Mt(e)),this.wallPins}render3d(e){const t=oe(e,this.levelFilter),s=ae(e,t),a=typeof location<"u"?location.hash:"",i=a.includes("?")?a.slice(a.indexOf("?")):"",o=Nt(i),n=Rt(null,this.wallPinsFor(i),this.viewDials);if(Dt({webgl:E(),wallDisplay:o,wallMode:n.mode,idle:!1,exhausted:this.stillsFallback,hasStills:s,want3d:!0})==="stills")return re(e,t,this.roomStateLayer,this.viewDials,new Date,{autoBand:o,site:this.stillsSite});const l=this.scene3d();if(!l)return d;const m=new Date,b=`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,"0")}-${String(m.getDate()).padStart(2,"0")}`;return r`<sw-plan-3d data-floor-3d .description=${l.desc} .selectedId=${this.sel3d} .preset=${this.preset3d} .frameKey=${e.floorId} .cameras=${l.cameras} .labels=${l.labels}
      .levels=${e.levels.map(f=>({id:f.id,name:f.name,elevation_m:f.elevation_m}))} .activeLevel=${this.levelFilter} .thumbnailScene=${l.all} .qualityDefault=${this.quality3d} .levelDots=${this.roomStateLayer?.levels??{}}
      exportName=${`plan-3d-${e.floorName}${this.levelFilter?`-${this.levelFilter}`:""}-${b}`} @part-select=${f=>this.onPartSelect(f)}
      @level-select=${f=>this.levelFilter=f.detail.id}
      @hud-corner=${f=>{this.corner3d=f.detail.corner}}
      .walkable=${!0} @walk-change=${f=>this.onWalkChange(f.detail.on)}
      @realistic-change=${f=>{this.real3d!==f.detail.on&&(this.real3d=f.detail.on,this.sceneDue=!0)}}
      .stillsAvailable=${s} @stills-fallback=${()=>{this.stillsFallback=!0}}
      .idleS=${o?n.idleS:0} .changeKey=${o?this.planChangeKeyOf(e):""} .qualityForce=${o?n.quality:null}
      @floor-request=${f=>{f.detail.floorId!==this.floorId&&this.floors.some(y=>y.id===f.detail.floorId)&&g(`/explore/floors/${f.detail.floorId}`)}}>
      ${o&&s?re(e,t,this.roomStateLayer,this.viewDials,new Date,{slot:"idle-still",autoBand:!0,site:this.stillsSite}):d}
    </sw-plan-3d>`}planChangeKeyOf(e){const t={};for(const s of e.anchors)s.resource_type==="camera"&&(t[s.id]=s.camera?.status??"?");return Lt({layer:this.roomStateLayer,circuits:this.circuitStates3d,cameras:t})}layerCounts(){const e=this.bundle,t=this.roomStateLayer,s={cameras:0,doors:0,lights:0,sensors:0,zones:e?.zones.length??0,structure:this.geometry?.walls.length??0,photo:e?.floorImages?e.floorImages.on?2:1:0,objects:this.geometry?.objects.length??0,connectors:this.geometry?.connectors.length??0,states:t?Object.values(t.rooms).filter(a=>a.lit||a.presenceFade>0||a.openings.length||a.temperature!==null).length+(t.openOpenings.length?1:0):0};if(!e)return s;if(e.source==="demo"){s.cameras=T.filter(a=>a.floorId===e.floorId).length;for(const a of R.filter(i=>i.floorId===e.floorId))a.domain==="lock"?s.doors++:a.domain==="light"?s.lights++:s.sensors++;return s}for(const a of e.anchors)a.resource_type==="camera"?s.cameras++:a.layer_id==="doors"?s.doors++:a.layer_id==="lights"?s.lights++:s.sensors++;return s}zoneOf(e){return this.bundle?.zones.find(s=>A(e.position,s.polygon))?.name??null}toggleLayer(e){const t=new Set(this.layers);t.has(e)?t.delete(e):t.add(e),this.setLayers(t)}setLayers(e){this.layers=e;try{const t=[...e];for(const s of be)e.has(s)||t.push(`-${s}`);localStorage.setItem(`sw.floor.layers.${this.floorId}`,JSON.stringify(t))}catch{}}restoreLayers(){try{const e=localStorage.getItem(`sw.floor.layers.${this.floorId}`);if(!e)return;const t=JSON.parse(e);if(!Array.isArray(t))return;const s=new Set(t.filter(a=>we.some(i=>i.id===a)));for(const a of be)t.includes(`-${a}`)||s.add(a);this.layers=s}catch{}}setPlanImage(e){this.planImage=e;try{localStorage.setItem(`sw.floor.background.${this.floorId}`,e?"1":"0")}catch{}}restorePlanImage(){try{this.planImage=localStorage.getItem(`sw.floor.background.${this.floorId}`)!=="0"}catch{this.planImage=!0}}cameraAnchors(){return(this.bundle?.anchors??[]).filter(e=>e.resource_type==="camera"&&this.layers.has("cameras"))}togglePick(e){this.picked=this.picked.includes(e)?this.picked.filter(t=>t!==e):[...this.picked,e]}pickedCameraIds(){const e=new Map((this.bundle?.anchors??[]).map(t=>[t.id,t.resource_id]));return this.picked.map(t=>e.get(t)).filter(t=>!!t)}setMulti(e){this.multi=e,this.picked=[],this.saveView=null,this.savedView=null,e&&this.close(),e&&this.narrow&&(this.sideList=!1,this.panel=!1)}addPicks(e){const t=new Set(this.cameraAnchors().map(a=>a.id)),s=e.filter(a=>t.has(a)&&!this.picked.includes(a));s.length&&(this.picked=[...this.picked,...s])}pickZone(e){const t=this.bundle?.zones.find(i=>i.id===e);if(!t)return;const s=this.cameraAnchors().filter(i=>A(i.position,t.polygon)).map(i=>i.id);if(!s.length)return;const a=s.every(i=>this.picked.includes(i));this.picked=a?this.picked.filter(i=>!s.includes(i)):[...this.picked,...s.filter(i=>!this.picked.includes(i))]}roomChips(){const e=this.bundle;if(!e)return d;const t=this.cameraAnchors(),s=e.zones.map(a=>({z:a,ids:t.filter(i=>A(i.position,a.polygon)).map(i=>i.id)})).filter(a=>a.ids.length);return s.length?r`<span class="roomchips" data-room-chips>${s.map(a=>r`<sw-chip icon="layers" data-room-chip=${a.z.id} ?selected=${a.ids.every(i=>this.picked.includes(i))} @click=${()=>this.pickZone(a.z.id)}>${a.z.name} (${a.ids.length})</sw-chip>`)}</span>`:d}togglePanel(){this.panel=!this.panel,this.panel&&this.narrow&&(this.sideList=!1)}toggleSideList(){this.sideList=!this.sideList,this.sideList&&this.narrow&&(this.panel=!1,this.multi&&this.setMulti(!1));try{localStorage.setItem("sw.map.sidelist",this.sideList?"1":"0")}catch{}}async jumpTo(e){if(e.resource_type==="camera"?(this.focusCamera=e.resource_id,this.focusEntity=""):(this.focusEntity=e.resource_id,this.focusCamera=""),this.focusZone="",this.multi&&e.resource_type==="camera"){this.togglePick(e.id);return}this.focusZoom=this.jumpZoom,await this.applyFocus(),window.setTimeout(()=>this.focusZoom=!0,900)}setJumpZoom(e){this.jumpZoom=e;try{localStorage.setItem("sw.map.jumpzoom",e?"1":"0")}catch{}}renderSideList(){const e=this.bundle;if(!e||!this.sideList||e.source!=="api")return d;const t=e.anchors.filter(n=>n.resource_type==="camera"),s=e.anchors.filter(n=>n.resource_type==="ha_entity"),a={light:"תאורה",switch:"מפסקים",lock:"מנעולים",binary_sensor:"חיישנים",sensor:"חיישנים",cover:"תריסים",climate:"מיזוג",media_player:"מדיה",alarm_control_panel:"אזעקה"},i=new Map;for(const n of s){const c=n.entity?.domain??n.resource_id.split(".")[0];i.set(c,[...i.get(c)??[],n])}const o=n=>n.camera?n.camera.status==="online"?"var(--sw-success)":n.camera.status==="offline"?"var(--sw-danger)":"var(--sw-text-3)":n.entity?.state==="on"||n.entity?.state==="unlocked"||n.entity?.state==="open"?"var(--sw-accent)":"var(--sw-text-3)";return r`<div class="sidelist ${this.sheetTall?"tall":""}" data-sidelist data-sheet-tall=${this.sheetTall?"1":d}>
      <button class="grab" data-sheet-grab aria-label=${this.sheetTall?"הקטן את הרשימה":"הגדל את הרשימה"} @click=${()=>this.sheetTall=!this.sheetTall}><span></span></button>
      <div class="sh"><sw-icon name="list" size=${14}></sw-icon>על התוכנית<span class="grow"></span><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${()=>this.toggleSideList()}></sw-button></div>
      <label class="jz" data-jump-zoom-row><input type="checkbox" data-jump-zoom .checked=${this.jumpZoom} @change=${n=>this.setJumpZoom(n.target.checked)} /> זום בקפיצה לרכיב</label>
      <div class="body">
        ${this.embedded?d:r`<div class="grp">קומות</div>
        ${this.floors.map(n=>r`<button class="it ${n.id===this.floorId?"on":""}" data-side-floor=${n.id} @click=${()=>{n.id!==this.floorId&&g(`/explore/floors/${n.id}`)}}>
          <sw-icon name="building" size=${12}></sw-icon><span class="nm">${N(n.name)}</span><span class="st">${n.cameraCount} מצלמות${n.hasPlan?"":" · אין תוכנית"}</span></button>`)}`}
        <div class="grp">מצלמות (${t.length})</div>
        ${t.map(n=>r`<button class="it ${this.selectedId===n.id||this.picked.includes(n.id)?"on":""}" data-side-camera=${n.resource_id} @click=${()=>this.jumpTo(n)}>
          <span class="dot" style="--dot:${o(n)}"></span><span class="nm">${n.camera?.name??n.label??n.resource_id}</span><span class="st">${n.camera?.status==="online"?"חיה":n.camera?.status==="offline"?"מנותקת":""}</span></button>`)}
        ${[...i.entries()].map(([n,c])=>r`<div class="grp">${a[n]??n} (${c.length})</div>
          ${c.map(l=>r`<button class="it ${this.selectedId===l.id?"on":""}" data-side-entity=${l.resource_id} @click=${()=>this.jumpTo(l)}>
            <span class="dot" style="--dot:${o(l)}"></span><span class="nm">${z(l)}</span><span class="st">${l.entity?V(l.entity):""}</span></button>`)}`)}
        ${!t.length&&!s.length?r`<div class="grp">אין פריטים מוצבים על התוכנית הזו.</div>`:d}
      </div>
    </div>`}pickSummary(){const e=this.picked.map(a=>this.bundle?.anchors.find(i=>i.id===a)).filter(a=>!!a),t=e.filter(a=>a.camera?.can_view_live===!1).length,s=e.filter(a=>a.camera?.can_view_live!==!1&&a.camera?.recorder_enabled!==!1&&a.camera?.status==="online").length;return{total:e.length,online:s,offline:e.length-s-t,denied:t}}pickDot(e){return!e?.camera||e.camera.can_view_live===!1||e.camera.recorder_enabled===!1?"var(--sw-text-3)":e.camera.status==="online"?"var(--sw-success)":"var(--sw-danger)"}saveableCameraIds(){const e=new Map((this.bundle?.anchors??[]).map(t=>[t.id,t]));return this.picked.map(t=>e.get(t)).filter(t=>!!t&&t.camera?.can_view_live!==!1&&t.camera?.recorder_enabled!==!1).map(t=>t.resource_id).slice(0,16)}openSave(){const e=this.saveableCameraIds().length;if(!e)return;const t=e<=1?1:e<=4?2:e<=9?3:4,s=Math.max(1,Math.min(4,Math.ceil(e/t))),a=this.floors.find(i=>i.id===this.floorId)?.name??this.bundle?.floorName??"מפה";this.savedView=null,this.saveView={name:`${a} · ${e} מצלמות`,cols:t,rows:s,shared:!1,canShare:!1,busy:!1,error:null},rt().then(i=>{this.saveView&&(this.saveView={...this.saveView,canShare:i.can_share})}).catch(()=>{})}async submitSave(){const e=this.saveView;if(!e||e.busy)return;if(!e.name.trim()){this.saveView={...e,error:"לתצוגה צריך שם."};return}const t=this.saveableCameraIds();if(!t.length){this.saveView={...e,error:"אין בבחירה מצלמה שמותר לך לצפות בה."};return}this.saveView={...e,busy:!0,error:null};try{this.savedView=await nt({name:e.name.trim(),cameras:t,cols:e.cols,rows:e.rows,shared:e.shared,kiosk:!1}),this.saveView=null}catch(s){this.saveView={...e,busy:!1,error:C(s)}}}renderSaveDialog(){const e=this.saveView;if(!e)return d;const t=this.saveableCameraIds(),{denied:s}=this.pickSummary(),a=Math.max(0,this.picked.length-s-16),i=o=>this.saveView={...e,...o};return r`<sw-dialog open heading="שמירה כתצוגה" subheading=${`${t.length} מצלמות מהמפה · התצוגה נפתחת בקיר החי או בקיוסק`} data-save-view-dialog @close=${()=>this.saveView=null}>
      <div class="saveform">
        <sw-field label="שם"><input data-save-view-name .value=${e.name} maxlength="60" @input=${o=>i({name:o.target.value})} @keydown=${o=>o.key==="Enter"&&this.submitSave()} /></sw-field>
        <div class="row">
          <sw-field label="עמודות (קיוסק)"><select data-save-view-cols @change=${o=>i({cols:Number(o.target.value)})}>${[1,2,3,4].map(o=>r`<option value=${o} ?selected=${o===e.cols}>${o}</option>`)}</select></sw-field>
          <sw-field label="שורות (קיוסק)"><select data-save-view-rows @change=${o=>i({rows:Number(o.target.value)})}>${[1,2,3,4].map(o=>r`<option value=${o} ?selected=${o===e.rows}>${o}</option>`)}</select></sw-field>
        </div>
        <sw-toggle ?checked=${e.shared} ?disabled=${!e.canShare} label=${e.canShare?"משותפת לכל המשתמשים":"משותפת (דורש הרשאת ניהול משתמשים)"} data-save-view-shared @change=${o=>i({shared:o.detail.checked})}></sw-toggle>
        ${s?r`<div class="note">${s} מצלמות ללא הרשאת צפייה חיה לא ייכללו בתצוגה.</div>`:d}
        ${a?r`<div class="note">תצוגה מכילה עד 16 מצלמות; ${a} האחרונות שנבחרו לא ייכללו.</div>`:d}
        <div class="note">הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג ${e.cols}×${e.rows} מצלמות בעמוד.</div>
        ${e.error?r`<div class="err" role="alert" data-save-view-error>${e.error}</div>`:d}
      </div>
      <div slot="footer"><sw-button variant="primary" ?disabled=${e.busy} data-save-view-submit @click=${()=>this.submitSave()}>${e.busy?"שומר…":"שמור תצוגה"}</sw-button><sw-button variant="ghost" @click=${()=>this.saveView=null}>${w("actions.cancel")}</sw-button></div>
    </sw-dialog>`}openWall(){const e=this.pickedCameraIds();e.length&&(this.rememberView(),g("/live/wall",{cameras:e.join(","),from:"map"}))}openSync(){const e=this.pickedCameraIds();e.length&&(this.rememberView(),g("/investigate/playback",{camera:e[0],extra:e.slice(1,4).join(","),from:"map"}))}renderSuggestions(){const e=this.adjacentSuggestions;if(!e.length)return d;const t=this.bundle,s=a=>{const i=t.anchors.find(o=>o.id===a);return i?.camera?.name??i?.label??i?.resource_id??a};return r`<span class="suggest" data-pick-suggest>
      <span class="lbl"><sw-icon name="target" size=${12}></sw-icon>מוצע בסמוך</span>
      ${e.map(a=>r`<sw-chip icon="camera" dot=${this.pickDot(t.anchors.find(i=>i.id===a.id))} title=${`${me[a.relation]}${a.zoneName?` · ${a.zoneName}`:""} · ${s(a.from)}`} data-pick-suggest-chip=${a.id} data-relation=${a.relation} @click=${()=>this.togglePick(a.id)}>${s(a.id)}<small>${me[a.relation]}</small></sw-chip>`)}
      ${e.length>1?r`<sw-chip data-pick-suggest-all @click=${()=>this.addPicks(e.map(a=>a.id))}>הוסף הכל (${e.length})</sw-chip>`:d}
    </span>`}renderPickbar(){const e=this.bundle;if(!e)return d;const t=this.cameraAnchors(),s=m=>e.anchors.find(b=>b.id===m),a=m=>{const b=s(m);return b?.camera?.name??b?.label??b?.resource_id??m},i=this.pickSummary(),o=e.anchors.filter(m=>m.resource_type==="camera").length,n=this.floors.find(m=>m.id===this.floorId)?.cameraCount??o,c=Math.max(0,n-o),l=i.total?`נבחרו ${i.total} · ${i.online} זמינות${i.offline?` · ${i.offline} לא מקוונות`:""}${i.denied?` · ${i.denied} ללא הרשאה`:""}${c?` · ${c} מצלמות של הקומה אינן על המפה`:""}`:`לחץ על מצלמות או גרור מלבן על המפה · לחיצה על חדר בוחרת את מצלמותיו · Shift+גרירה מזיזה את המפה · עד 4 לניגון מסונכרן${c?` · ${c} מצלמות של הקומה אינן על המפה`:""}`;return r`<div class="pickbar" data-pickbar>
      <span class="hint" data-pick-hint>${l}</span>
      ${this.picked.map(m=>{const b=s(m),f=b?.camera?.can_view_live===!1,y=b?.camera?.recorder_enabled===!1;return r`<sw-chip selected icon="camera" dot=${this.pickDot(b)} title=${f?"אין הרשאת צפייה חיה":y?"ה־NVR מושבת":b?.camera?.status==="online"?"מקוונת":"לא מקוונת"} data-pick-chip=${f?"denied":y?"recorder-off":b?.camera?.status??"unknown"} @click=${()=>this.togglePick(m)}>${a(m)}</sw-chip>`})}
      <sw-chip data-pick-all @click=${()=>this.picked=t.map(m=>m.id)}>בחר הכל (${t.length})</sw-chip>
      ${this.roomChips()}
      ${this.renderSuggestions()}
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="live" ?disabled=${!this.picked.length} data-pick-wall @click=${()=>this.openWall()}>קיר חי (${this.picked.length})</sw-button>
      <sw-button size="sm" icon="history" ?disabled=${!this.picked.length||this.picked.length>4} data-pick-sync @click=${()=>this.openSync()}>ניגון מסונכרן</sw-button>
      <sw-button size="sm" icon="layers" ?disabled=${!this.saveableCameraIds().length} data-pick-save @click=${()=>this.openSave()}>שמור כתצוגה</sw-button>
      <sw-button variant="ghost" size="sm" @click=${()=>this.picked=[]}>נקה</sw-button>
      <sw-button variant="ghost" size="sm" icon="close" @click=${()=>this.setMulti(!1)}>סיום</sw-button>
      ${this.savedView?r`<span class="saved" data-view-saved role="status">התצוגה „${this.savedView.name}” נשמרה (${this.savedView.cameras.length} מצלמות) · <a href="#/live/views" data-view-saved-open>תצוגות שמורות</a> · <a href=${lt(this.savedView)}>פתח בקיר</a></span>`:d}
    </div>`}onSelect(e){if(this.focusedObjectId=null,this.multi){const t=e.detail.id?this.bundle?.anchors.find(s=>s.id===e.detail.id):null;t?.resource_type==="camera"&&this.togglePick(t.id);return}this.selectedZoneId=null,this.selectedId=e.detail.id,this.anchor=e.detail.id&&e.detail.sx!==void 0&&e.detail.sy!==void 0?{x:e.detail.sx,y:e.detail.sy}:null}onViewChange(){if(this.multi&&this.rememberView(),!this.selectedId||!this.canvas||this.shows3d)return;const e=this.markers.find(s=>s.id===this.selectedId);if(!e)return;const t=this.canvas.toScreen(e.x,e.y);this.anchor={x:t.x,y:t.y}}close(){this.selectedId=null,this.anchor=null}entityTone(e){return e?Re({...e,fresh:e.fresh&&this.syncConnected}):"unknown"}argDefault(e,t){const s=e.attributes;return t.name==="hvac_mode"?String(s.hvac_mode??e.state??t.choices?.[0]??""):t.name==="temperature"?String(s.temperature??21):t.name==="volume_level"?String(Math.round((s.volume_level??.5)*100)):t.name==="value"?String(e.state??s.min??0):t.name==="option"?String(e.state??s.options?.[0]??""):t.name==="brightness_pct"?String(typeof s.brightness=="number"?Math.round(s.brightness/255*100):100):t.name==="percentage"?String(s.percentage??100):String(t.choices?.[0]??t.min??"")}argsFor(e,t){const s={};for(const a of t.argument_specs??[]){const i=this.actionArgs[`${t.id}:${a.name}`]??this.argDefault(e,a);if(a.type==="int"||a.type==="float"){const o=Number(i);if(!Number.isFinite(o))continue;s[a.name]=a.name==="volume_level"?Math.min(1,Math.max(0,o/100)):o}else s[a.name]=i}return s}argChoices(e,t){const s=e.attributes;return t.name==="hvac_mode"&&Array.isArray(s.hvac_modes)?s.hvac_modes.filter(a=>t.choices?.includes(a)):t.name==="option"&&Array.isArray(s.options)?s.options:t.choices??[]}renderArg(e,t,s){const a=`${t.id}:${s.name}`,i=this.actionArgs[a]??this.argDefault(e,s),o=l=>this.actionArgs={...this.actionArgs,[a]:l},n=e.attributes,c=this.argChoices(e,s);if(c.length)return r`<select class="arg" data-action-arg=${a} aria-label=${s.name} @change=${l=>o(l.target.value)}>${c.map(l=>r`<option value=${l} ?selected=${l===i}>${ys[l]??l}</option>`)}</select>`;if(s.type==="int"||s.type==="float"){const l=s.name==="volume_level"?0:s.name==="value"?n.min??s.min:s.name==="temperature"?n.min_temp??5:s.min,m=s.name==="volume_level"?100:s.name==="value"?n.max??s.max:s.name==="temperature"?n.max_temp??35:s.max,b=s.name==="value"?n.step??1:s.name==="temperature"&&n.target_temp_step||1,f=s.name==="volume_level"||s.name==="brightness_pct"||s.name==="percentage"?"%":s.name==="temperature"?"°":"";return r`<span class="argwrap"><input class="arg" type="number" data-action-arg=${a} aria-label=${s.name} .value=${i} min=${String(l??"")} max=${String(m??"")} step=${String(b)} data-ltr @change=${y=>o(y.target.value)} />${f?r`<span class="unit">${f}</span>`:d}</span>`}return r`<input class="arg" type="text" data-action-arg=${a} aria-label=${s.name} .value=${i} maxlength=${String(s.max_len??80)} @change=${l=>o(l.target.value)} />`}trigger(e,t){if(t.sensitive){this.confirmSpec={entityId:e,spec:t};return}this.send(e,t,!1)}async send(e,t,s){this.confirmSpec=null,this.action={entityId:e,spec:t,record:null,error:"",busy:!0};try{const a=this.bundle?.anchors.find(o=>o.resource_type==="ha_entity"&&o.resource_id===e)?.entity,i=await Ve(e,t.id,a?this.argsFor(a,t):{},s);if(this.action={entityId:e,spec:t,record:i,error:"",busy:i.status==="pending"},i.status==="pending"){const o=this.action;await He(i.id,n=>{(this.action===o||this.action?.record?.id===n.id)&&(this.action={entityId:e,spec:t,record:n,error:"",busy:n.status==="pending"})},void 0,e)}}catch(a){const i=a instanceof Ze&&a.code==="bridge_not_paired"?"הגשר אינו מצומד. התקנה וצימוד: הגדרות → כללי.":C(a);this.action={entityId:e,spec:t,record:null,error:i,busy:!1}}}apiEntityBody(e,t){const s=e.entity;if(!s)return r`<div class="note">התקן · <span class="ltr">${e.resource_id}</span> — לא נמצא בקטלוג המסונכרן (ייתכן שהוסר).</div>`;const a=this.entityTone(s),i=this.action?.entityId===s.entity_id?this.action:null,o=s.fresh&&this.syncConnected,n=this.renaming?.id===e.id?this.renaming:null;return r`
      <div class="ecard" data-entity-card>
        <div class="estate ${a}"><sw-badge kind=${a} label=${V(s)}></sw-badge><span class="esub">${Q(s.domain)}${s.area_name?` · ${s.area_name}`:""} · ${t}</span>${q()?r`<ticket-count-chip entity-id=${s.entity_id}></ticket-count-chip>`:d}</div>
        ${e.label&&s.name&&e.label!==s.name?r`<div class="note">שם מקורי: ${s.name}</div>`:d}
        ${this.notice?r`<div class="note" data-notice role="status">${this.notice}</div>`:d}
        ${n?r`<div class="rename" data-rename-form><input .value=${n.value} placeholder=${s.name??e.resource_id} aria-label="שם במפה" @input=${c=>this.renaming={id:e.id,value:c.target.value}} @keydown=${c=>{c.key==="Enter"&&this.saveRename(e),c.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" icon="check" data-rename-save ?disabled=${n.busy} @click=${()=>this.saveRename(e)}>שמור</sw-button>
              <sw-button size="sm" variant="ghost" @click=${()=>this.renaming=null}>ביטול</sw-button></div>`:d}
        ${this.entityActions(e)}
        <details class="more"><summary>פרטים</summary>
          <dl class="meta">
            <dt>${w("entity.lastChanged")}</dt><dd>${ee(s.last_changed)}</dd>
            <dt>נראה לאחרונה</dt><dd>${ee(s.state_seen_at)}</dd>
            <dt>ID</dt><dd><span class="ltr">${s.entity_id}</span></dd>
          </dl>
          ${q()?r`<sw-button size="sm" variant="ghost" icon="list" data-map-tickets @click=${c=>bs(s.entity_id,z(e),V(s),c.currentTarget)}>${W("mapAction")}</sw-button>`:d}
        </details>
      </div>
      ${o?d:r`<div class="warn">${s.state==="unavailable"?"ההתקן אינו זמין.":"הסנכרון מול תשתית המערכת מנותק — המצב עלול להיות מיושן."}</div>`}
      ${s.actions===void 0?r`<div class="note">${w("entity.noControl")}</div>`:s.actions.length===0?r`<div class="note">קריאה בלבד — אין פעולות מותרות ל־${Q(s.domain)}.</div>`:d}
      ${this.grantNote(s.actions)}
      ${i?r`<div class=${i.error||i.record?.status==="failed"||i.record?.status==="denied"?"warn":"note"}>${i.spec.label}: ${i.error?i.error:i.record?`${te[i.record.status]}${i.record.error?` — ${se[i.record.error]??i.record.error}`:""}`:"שולח…"}</div>`:d}
    `}async openIncidentHere(e){this.incidentBusy=!0;try{const t=await qe({anchor_id:e});g(`/investigate/incidents/${encodeURIComponent(t.incident.id)}`)}catch(t){this.notice=C(t)}finally{this.incidentBusy=!1}}async saveRename(e){const t=this.renaming;if(!(!t||t.id!==e.id||t.busy)){this.renaming={...t,busy:!0};try{const s=await We(e.id,{revision:e.revision,label:t.value.trim()||null},e.shared?this.bundle?.floorId:void 0);this.bundle&&(this.bundle={...this.bundle,anchors:this.bundle.anchors.map(a=>a.id===e.id?{...a,label:s.label,revision:s.revision}:a)}),this.renaming=null,this.notice=s.label?`השם „${s.label}“ נשמר`:"חזרה לשם המקורי"}catch(s){this.notice=C(s),this.renaming={...t,busy:!1}}}}grantNote(e){const t=Ke(e,ie("system.configure"));return t?r`<div class="note" data-grant-note data-grant-reason=${e?.find(s=>s.id==="lock.unlock")?.reason??""}>${t.text}${t.link?r` <a data-grant-note-link href=${t.link.href}>${t.link.label}</a>`:d}</div>`:d}entityActions(e){const t=e.entity;return t?.alarm_managed?r`<div class="eactions" data-entity-actions data-alarm-managed><sw-button block variant="primary" icon="shield" @click=${()=>window.location.hash=t.domain==="alarm_control_panel"?`#/security/alarm?panel=${encodeURIComponent(t.entity_id)}`:"#/security/alarm"}>נשלט ממסך האזעקה · לאזעקה</sw-button></div>`:(t?.actions??[]).length?r`<div class="eactions" data-entity-actions>${this.entityFooter(e)}</div>`:d}entityFooter(e){const t=e.entity,s=!!(this.action&&t&&this.action.entityId===t.entity_id&&this.action.busy),a=t?.actions??[];return r`${a.map(i=>r`<span class="actrow" data-action-row=${i.id}>${t&&i.argument_specs?.length?i.argument_specs.map(o=>this.renderArg(t,i,o)):d}<sw-button block variant=${i.risk==="sensitive"||i.sensitive?"danger":"primary"} ?disabled=${s||this.screenState==="stale"||t?.state==="unavailable"||i.granted===!1} title=${i.granted===!1?Ue(i,ie("system.configure")):i.risk_label?`פעולה ${i.risk_label}`:""} data-action=${i.id} data-risk=${i.risk??(i.sensitive?"attention":"routine")} data-granted=${i.granted===!1?"no":"yes"} @click=${()=>t&&this.trigger(t.entity_id,i)}>${i.label}</sw-button></span>`)}`}renderConfirm(){const e=this.confirmSpec;if(!e)return d;const t=this.bundle?.anchors.find(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entityId)?.entity;return r`<sw-dialog open heading=${w("entity.confirm")} subheading=${t?.name??e.entityId} @close=${()=>this.confirmSpec=null}>
      <div style="font-size:var(--sw-fs-sm);line-height:1.5">הפעולה <strong>${e.spec.label}</strong> על <span class="ltr">${e.entityId}</span> היא פעולה ${e.spec.risk_label??"רגישה"}${e.spec.risk==="sensitive"?" (הרשאה נפרדת)":""}. היא תבוצע בזהות שלך ותירשם באודיט.</div>
      <div slot="footer"><sw-button variant="danger" @click=${()=>this.send(e.entityId,e.spec,!0)}>${e.spec.label}</sw-button><sw-button variant="ghost" @click=${()=>this.confirmSpec=null}>${w("actions.cancel")}</sw-button></div>
    </sw-dialog>`}demoCameraBody(e,t){const s=e.state==="offline"?w("camera.offlineReason"):e.state==="forbidden"?w("camera.forbiddenReason"):e.state==="stale"?w("camera.staleReason"):"",a=e.state==="live"||e.state==="stale";return r`
      ${a?r`<sw-camera-tile name="" state=${e.state} scene=${Je[e.id]??"lobby"} @click=${()=>g(`/live/cameras/${e.id}`)}></sw-camera-tile>`:r`<div class="off"><div><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${22}></sw-icon><div>${s}</div></div></div>`}
      <div class="statusrow"><sw-badge kind=${e.state}></sw-badge><span>${t} · ${e.source}</span></div>
      ${s&&a?r`<div class="warn">${s}</div>`:d}
    `}demoEntityBody(e){const t=this.screenState==="stale",s=t?"stale":e.state==="on"||e.state==="unlocked"?"live":"neutral";return r`
      <dl class="meta">
        <dt>${w("entity.state")}</dt><dd><sw-badge kind=${s} label=${w(e.stateLabelKey)}></sw-badge></dd>
        <dt>${w("entity.lastChanged")}</dt><dd>${e.lastChanged}</dd>
        <dt>ID</dt><dd><span class="ltr">${e.id}</span></dd>
      </dl>
      ${t?r`<div class="warn">${w("states.staleHint")}</div>`:d}
      ${e.controllable?d:r`<div class="note">${w("entity.noControl")}</div>`}
    `}apiCameraBody(e,t){const s=e.camera,a=j(e),i=ve[((s?.channel??1)-1)%ve.length],o=a==="live"&&!!s&&s.can_view_live!==!1&&s.live_kind!=="still",n=s?.recorder_enabled===!1,c=this.zoneOf(e),l=c?`${t} / ${c}`:`${t} · ערוץ ${s?.channel??"?"}`;return r`
      ${n?r`<div class="off" data-recorder-off><div><sw-icon name="offline" size=${22}></sw-icon><div>ה־NVR של המצלמה מושבת</div></div></div>`:a==="offline"?r`<div class="off"><div><sw-icon name="offline" size=${22}></sw-icon><div>${w("camera.offlineReason")}</div></div></div>`:r`<sw-camera-tile name="" state=${a==="live"?"live":"unknown"} scene=${i} poster=${s?Ge(s.id,s.live_kind==="still"?void 0:Date.now()):""} .stillRefresh=${s?.live_kind==="still"&&a==="live"?s.still_refresh_s??10:0} ?live=${o&&!!this.liveTransport} .cameraId=${o?s.id:""} transport=${this.liveTransport??"auto"} data-live=${o?"1":"0"} @click=${()=>s&&g(`/live/cameras/${s.id}`)}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${a}></sw-badge><span data-where>${l}</span></div>
      <dl class="meta">
        <dt>שם ב־NVR</dt><dd>${s?.name_source||"—"}${s?r` · <span class="ltr">ch ${s.channel}</span>`:d}</dd>
        <dt>נראתה לאחרונה</dt><dd>${s?.last_seen_at?s.last_seen_at.replace("T"," ").replace("Z"," UTC"):"לא נבדק"}</dd>
      </dl>
      ${n?d:r`<div class="note">${o?'הזרם נפתח לכרטיס הזה בלבד ונסגר איתו; "צפייה מלאה" פותחת את המצלמה במסך מלא.':a==="offline"?"המצלמה מנותקת לפי ה־NVR.":"תמונה: צילום מה־NVR (מתרענן)."}</div>`}
    `}renderCard(){const e=this.bundle;if(!this.selectedId||!e)return d;let t="",s="",a=d,i=d;if(e.source==="demo"){const c=T.find(b=>b.id===this.selectedId),l=c?void 0:R.find(b=>b.id===this.selectedId);if(!c&&!l)return d;t=c?c.name:l.name,s=c?`${e.floorName} · ${c.source}`:`${e.floorName} · ${w(l.domain==="lock"?"entity.door":l.domain==="light"?"entity.light":"entity.sensor")}`,a=c?this.demoCameraBody(c,e.floorName):this.demoEntityBody(l);const m=c?c.state==="live"||c.state==="stale":!1;i=c?r`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${!m} @click=${()=>g(`/live/cameras/${c.id}`)}>צפייה חיה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${c.state==="forbidden"} @click=${()=>g("/investigate/playback")}>${w("camera.recordings")}</sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="pin" label=${this.pinned?w("camera.unpin"):w("camera.pin")} @click=${()=>this.pinned=!this.pinned}></sw-button>`:r`<sw-button variant="primary" size="sm" ?disabled=${!l.controllable||this.screenState==="stale"}>${w("entity.control")}</sw-button><sw-button variant="ghost" size="sm">${w("entity.openInHa")}</sw-button>`}else{const c=e.anchors.find(l=>l.id===this.selectedId);if(!c)return d;t=z(c),s=`${e.buildingName} · ${e.floorName}`,a=c.resource_type==="camera"?this.apiCameraBody(c,e.floorName):this.apiEntityBody(c,e.floorName),i=r`${c.resource_type==="camera"?r`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${j(c)==="offline"||c.camera?.recorder_enabled===!1} @click=${()=>c.camera&&g(`/live/cameras/${c.camera.id}`)}>צפייה מלאה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${!c.camera||c.camera.recorder_enabled===!1} @click=${()=>c.camera&&g("/investigate/playback",{camera:c.camera.id})}>${w("camera.recordings")}</sw-button>`:d}
        ${os()?r`<sw-button variant="ghost" size="sm" icon="plus" data-map-ticket @click=${()=>this.ticketFor={pick:{element:{floor_id:c.floor_id||e.floorId,kind:"anchor",id:c.id}},name:z(c),floorName:e.floorName,entityId:c.resource_type==="ha_entity"?c.resource_id:void 0}}>${rs()}</sw-button>`:d}
        ${Ye(tt())?r`<sw-button variant="ghost" size="sm" icon="warning" data-map-incident ?disabled=${this.incidentBusy} @click=${()=>void this.openIncidentHere(c.id)}>${Xe("openHere")}</sw-button>`:d}
        ${c.resource_type==="ha_entity"&&e.permissions.edit&&c.entity?r`<sw-button variant="ghost" size="sm" icon="edit" data-rename @click=${()=>this.renaming={id:c.id,value:c.label??""}}>שנה שם</sw-button>`:d}
        ${e.permissions.edit&&!this.phone.restricted("structure")?r`<sw-button variant="ghost" size="sm" icon="edit" @click=${()=>g(`/explore/floors/${e.floorId}/edit`)}>עריכה</sw-button>`:d}`}if(this.narrow||!this.anchor||this.shows3d)return r`<sw-drawer open heading=${t} subheading=${s} @close=${this.close}>${a}<div slot="footer">${i}</div></sw-drawer>`;const o=this.stage?.clientWidth??0,n=this.stage?.clientHeight??0;return r`<sw-popover heading=${t} .x=${this.anchor.x} .y=${this.anchor.y} .stageWidth=${o} .stageHeight=${n} @close=${this.close}>${a}<div slot="footer">${i}</div></sw-popover>`}onZoneSelect(e){if(this.multi){this.pickZone(e);return}const t=this.bundle?.zones.find(s=>s.id===e);if(this.embedded&&t){this.selectedZoneId=e,this.close();const s=ot(t.polygon),a=this.canvas?.toScreen(s.x,s.y)??{x:0,y:0};this.dispatchEvent(new CustomEvent("area-open",{detail:{zone_id:e,zone_name:t.name,area_id:t.area_id??null,x:a.x,y:a.y},bubbles:!0,composed:!0}));return}this.selectedZoneId=this.selectedZoneId===e?null:e,this.close()}renderRoomCard(){const e=this.bundle;if(!e||e.source!=="api"||!this.selectedZoneId||this.multi||this.embedded)return d;const t=e.zones.find(i=>i.id===this.selectedZoneId);if(!t||t.shared)return d;const s=this.roomStateLayer?.rooms[t.id],a=[];return s?.lit&&a.push("תאורה דלוקה"),s?.presence&&a.push("נוכחות"),s?.openings.length&&a.push(`${s.openings.length} פתחים פתוחים`),s&&s.temperature!==null&&s.temperature!==void 0&&a.push(vt(s.temperature)??""),r`<div class="roomcard" data-room-card data-zone-id=${t.id}>
      <div class="rc-head"><strong>${N(t.name||"חדר")}</strong><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${()=>this.selectedZoneId=null}></sw-button></div>
      ${a.filter(Boolean).length?r`<div class="rc-sub">${a.filter(Boolean).join(" · ")}</div>`:d}
      ${t.area_id?r`<a class="rc-open" data-room-open-area href=${`#/devices/areas/${encodeURIComponent(t.area_id)}`}>פתח אזור<sw-icon name="chevron" size=${12}></sw-icon></a>`:d}
    </div>`}renderFloorStrip(){const e=this.buildingFloors;return this.bundle?.source!=="api"||e.length<2?d:r`<div class="floorstrip" role="group" aria-label="קומות" data-floor-strip>
      ${e.map(t=>{const s=t.id===this.floorId?this.floorDots(this.bundle):this.floorDots(this.otherBundles[t.id]??null);return r`<button class=${t.id===this.floorId?"on":""} data-strip-floor=${t.id} aria-pressed=${t.id===this.floorId} title=${t.name} ?disabled=${!t.hasPlan}
          @click=${()=>{if(t.id!==this.floorId){try{sessionStorage.setItem("sw.map.keep3d",t.id)}catch{}g(`/explore/floors/${t.id}`)}}}>
          <span class="fs-short">${t.short}</span>
          <span class="fs-name">${N(t.name)}</span>
          <span class="fs-dots" aria-hidden="true">
            ${s.lit?r`<i class="lit"></i>`:d}${s.presence?r`<i class="presence"></i>`:d}${s.open?r`<i class="open"></i>`:d}
          </span>
        </button>`})}
    </div>`}floorDots(e){const t={lit:!1,presence:!1,open:!1};if(!e||e.source!=="api"||this.states3dStale)return t;for(const s of e.anchors){if(s.resource_type!=="ha_entity"||!s.entity||!s.entity.fresh)continue;const a={id:s.resource_id,domain:s.entity.domain??s.resource_id.split(".")[0]??"",device_class:s.entity.device_class??null,layer_id:s.layer_id};(s.entity.state==="on"||s.entity.state==="open"||s.entity.state==="unlocked")&&(gt(a)?t.lit=!0:yt(a)?t.presence=!0:xt(a)&&(t.open=!0))}return t}keep3d(){try{return sessionStorage.getItem("sw.map.keep3d")!==this.floorId?!1:(sessionStorage.removeItem("sw.map.keep3d"),!0)}catch{return!1}}loadOtherBundles(){const e=this.buildingFloors.filter(s=>s.id!==this.floorId&&s.hasPlan),t=`${this.floorId}:${e.map(s=>s.id).join(",")}`;if(!(this.otherBundlesFor===t||this.bundle?.source!=="api")){this.otherBundlesFor=t;for(const s of e)s.id in this.otherBundles||B(s.id).then(a=>{this.otherBundles={...this.otherBundles,[s.id]:a}},()=>{this.otherBundles={...this.otherBundles,[s.id]:null}})}}renderSharedMembers(){const e=this.bundle;if(!e||e.source!=="api"||!this.selectedZoneId)return d;const t=e.zones.find(a=>a.id===this.selectedZoneId),s=t?.shared;return!t||!s?d:r`<div class="shared-members" data-shared-members>
      <div class="sm-head"><strong>${t.name}</strong><span>${$t(s)??""}</span></div>
      <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.load()}></sw-share-members>
    </div>`}renderPanel(){const e=this.layerCounts(),t=[{id:"cameras",label:w("floor.cameras"),count:`${e.cameras} ממוקמות`},{id:"doors",label:"דלתות ואינטרקום",count:`${e.doors} ישויות`},{id:"lights",label:w("floor.lights"),count:`${e.lights} ישויות`},{id:"sensors",label:"אבטחה וחיישנים",count:`${e.sensors} ישויות`},{id:"zones",label:"שמות חדרים",count:e.zones?`${e.zones} אזורים · תוויות לפי רמת זום`:"אין חדרים מוגדרים"},...this.bundle?.floorImages?[{id:"photo",label:"תמונת הקומה",count:this.bundle.floorImages.on?"כבוי ודלוק":"תמונה אחת"}]:[],{id:"structure",label:"מבנה",count:this.geometry?`${this.geometry.walls.length} קירות · ${this.geometry.openings.length} פתחים`:"לא שורטט מבנה"},{id:"objects",label:"עצמים",count:this.geometry?`${this.geometry.objects.length} עצמים מהספרייה`:"אין עצמים"},{id:"connectors",label:"מחברים",count:this.geometry?`${this.geometry.connectors.length} מדרגות, רמפות ומעליות`:"אין מחברים"},{id:"states",label:"מצבי חדרים",count:this.layers.has("states")?e.states?`${e.states} עם מצב · תאורה, תנועה, פתחים פתוחים, טמפרטורה`:"תאורה, תנועה, פתחים פתוחים, טמפרטורה":"מוסתר"}];return r`<div class="panel" role="group" aria-label="שכבות פעילות" data-layers-panel>
      <h3>שכבות פעילות</h3>
      <div class="sub">הצג רק מה שרלוונטי כרגע</div>
      ${t.map(s=>r`<div class="prow"><span class="lbl">${s.label}<span class="cnt">${s.count}</span></span><sw-toggle ?checked=${this.layers.has(s.id)} label=${s.label} labelHidden data-layer=${s.id} @change=${a=>{const i=new Set(this.layers);a.detail.checked?i.add(s.id):i.delete(s.id),this.setLayers(i)}}></sw-toggle></div>`)}
      ${this.bundle?.imageUrl?r`<div class="prow"><span class="lbl">תמונת התוכנית<span class="cnt">${this.planImage?"הקובץ שנטען, מתחת למבנה":"מוסתרת · המבנה על רקע נקי"}</span></span><sw-toggle ?checked=${this.planImage} label="תמונת התוכנית" labelHidden data-plan-background @change=${s=>this.setPlanImage(s.detail.checked)}></sw-toggle></div>`:d}
      <div class="pnote"><sw-icon name="shield" size=${14}></sw-icon><span>מתג משנה תצוגה בלבד; ייבוא ישות אינו מעניק הרשאת שליטה בה.</span></div>
      ${this.renderSkinExport()}
    </div>`}renderSkinExport(){const e=this.bundle;return!this.shows3d||e?.source!=="api"||!e.permissions.edit||this.phone.restricted("control_images")?d:r`<div class="pexport">
      <sw-button variant="ghost" size="sm" icon="image" data-skin-controls-export ?disabled=${this.skinBusy} title="תמונות הבקרה של הקומה לסקין עתידי (אורות כבויים / דולקים), מהמבנה המפורסם, בלי תוויות — נשמרות במתקן בלבד" @click=${()=>this.exportControlImages()}>${this.skinBusy?"מצלם…":"תמונות בקרה"}</sw-button>
      ${this.skinNote?r`<span class="note" data-skin-note>${this.skinNote}</span>`:d}
      <sw-button variant="ghost" size="sm" icon="image" data-bake-run ?disabled=${this.bakeBusy||!this.geometry} title=${Ot} @click=${()=>this.runBake()}>${this.bakeBusy?"מכין…":Tt}</sw-button>
      <span class="note" data-bake-note>${this.bakeNote||jt(e,ne)}</span>
    </div>`}async maybeAutoBake(){const e=this.bundle;!e||e.source!=="api"||!e.permissions.edit||!this.geometry||this.bakeBusy||this.autoBaked.has(e.floorId)||!E()||(await D().catch(()=>null))?.["plan.bakes"]?.bake_trigger!=="auto"||!At(e,ne)||(this.autoBaked.add(e.floorId),await this.runBake())}async runBake(){const e=this.bundle;if(!(!e||e.source!=="api"||!this.geometry||this.bakeBusy)){this.bakeBusy=!0,this.bakeCancel=!1,this.bakeNote="מכין תמונות ותאורה…";try{this.bakeNote=await Ft({bundle:e,geometry:this.geometry,catalog:this.catalog3d,live:this.sceneMemo?.all??null,onProgress:t=>{this.bakeNote=t},cancelled:()=>this.bakeCancel||!this.isConnected||this.bundle?.floorId!==e.floorId}),this.isConnected&&this.bundle?.floorId===e.floorId&&(this.bundle={...e,bakes:(await B(e.floorId)).bakes??null})}finally{this.bakeBusy=!1}}}renderCircuitStrip(){const e=this.bundle,t=e?.circuitStates??{},s=Object.keys(t);if(!e||!s.length)return d;const a=this.action;return r`<div class="circuits ${this.panel||this.sideList?"shifted":""}" role="group" aria-label="מעגלי תאורה" data-circuit-strip>
      ${s.map(i=>{const o=t[i],n=o.state==="on",{spec:c,blocked:l,why:m}=fe(o,{busy:!!a?.busy&&a.entityId===o.entity_id,stale:this.screenState==="stale"}),b=this.screenState==="stale"||!o.fresh,f=o.available?b?"לא מעודכן":"":"לא זמין";return r`<button class="circuit ${n?"on":""} ${f?"muted":""}" data-circuit-toggle=${i} data-state=${o.state??"unknown"} data-available=${o.available?"yes":"no"} style=${`--kc: var(--sw-${kt(o.color_token)??"circuit-1"})`} ?disabled=${l}
            title=${m??(n?"כיבוי המעגל":"הדלקת המעגל")} @click=${()=>{c&&!l&&this.trigger(o.entity_id,c)}}>
          <i></i><span>${o.name??i}</span><span class="cnt">${Kt(o.member_ids.length,"מנורה אחת","מנורות")} · ${o.state===null?"לא ידוע":n?"דולק":"כבוי"}${o.power_w?` · ${o.power_w} W`:""}${f?r` · <span class="cnote" data-circuit-note>${f}</span>`:d}</span>
        </button>`})}
      ${a&&s.some(i=>t[i].entity_id===a.entityId)?r`<span class="cstatus" data-circuit-status>${a.error?r`<span class="err" data-circuit-error role="alert">${a.error}</span>`:a.record?te[a.record.status]+(a.record.error?` · ${se[a.record.error]??a.record.error}`:""):a.busy?"שולח…":""}</span>`:d}
    </div>`}renderStage(){const e=this.bundle;if(this.loadError)return r`<div class="cover"><sw-state-panel state="error" hint=${this.loadError} actionLabel=${w("states.retry")} @action=${()=>this.load()}></sw-state-panel></div>`;if(this.noFloors)return r`<div class="cover"><sw-state-panel icon="map" state="empty" heading="עדיין אין קומות" hint="צור אתר, מבנה וקומה ואז ייבא תוכנית קומה."><div style="margin-block-start:10px"><sw-button variant="primary" icon="building" @click=${()=>g("/explore/sites")}>לאתרים ומבנים</sw-button></div></sw-state-panel></div>`;if(!e)return r`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;switch(this.screenState){case"loading":return r`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;case"error":return r`<div class="cover"><sw-state-panel state="error" actionLabel=${w("states.retry")}></sw-state-panel></div>`;case"forbidden":return r`<div class="cover"><sw-state-panel state="forbidden"></sw-state-panel></div>`}return this.screenState==="empty"||e.planStatus==="none"?r`<div class="cover">
        <sw-state-panel icon="map" state="empty" heading=${w("floor.noPlan")} hint=${this.phone.restricted("structure")?"העלאת תוכנית זמינה במחשב.":e.permissions.import?w("floor.noPlanHint"):"עורך המפות של הקומה יכול להעלות תוכנית."}>
          <div style="display:flex;gap:8px;margin-block-start:10px;justify-content:center;flex-wrap:wrap">
            ${e.permissions.import&&!this.phone.restricted("structure")?r`<sw-button variant="primary" icon="upload" @click=${()=>g(`/explore/floors/${e.floorId}/import`)}>${w("floor.uploadPlan")}</sw-button>`:d}
            <sw-button icon="list" @click=${()=>g("/live/wall")}>${w("floor.listView")}</sw-button>
          </div>
        </sw-state-panel>
      </div>`:r`
      ${this.screenState==="stale"||this.screenState==="partial"?r`<div class="banner"><sw-state-panel icon="map" compact state=${this.screenState}></sw-state-panel></div>`:e.needsAlignment?r`<div class="banner"><sw-state-panel compact state="partial" heading="פריטים הוצבו על גרסת תוכנית קודמת" hint="בדוק שהמיקומים עדיין נכונים על הרקע החדש (עורך התוכנית)."></sw-state-panel></div>`:d}
      ${this.shows3d?this.render3d(e):d}
      <sw-plan-canvas
        style=${this.shows3d?"display:none":""}
        .planWidth=${e.width}
        .planHeight=${e.height}
        .plan=${e.planSvg}
        .imageUrl=${e.imageUrl}
        .hideImage=${!this.planImage}
        .geometry=${this.layers.has("structure")||this.layers.has("objects")||this.layers.has("connectors")?this.geometry:null}
        .hideStructure=${!this.layers.has("structure")}
        .hideObjects=${!this.layers.has("objects")}
        .hideConnectors=${!this.layers.has("connectors")}
        .selectedGeomId=${this.focusedObjectId}
        .structureLevel=${this.levelFilter}
        .catalog=${this.catalogLookup}
        .anchorPositions=${this.anchorPositions}
        .circuitStates=${this.circuitStateMap}
        .entityStates=${this.entityStateMap}
        .markers=${this.markers}
        .selectedId=${this.selectedId}
        .selectedIds=${this.multi?this.picked:[]}
        .boxSelect=${this.multi}
        @box-select=${t=>this.addPicks(t.detail.ids)}
        .zones=${this.layers.has("zones")?_t(e.zones).map(t=>({...t,chip:t.chip??et(this.presenceSnap,t.area_id),chipTone:t.chip?void 0:Qe(this.presenceSnap,t.area_id)??void 0})):[]}
        .floorImage=${e.floorImages}
        .hideFloorImage=${!this.layers.has("photo")}
        .roomStates=${this.roomStateLayer}
        .selectedZoneId=${this.selectedZoneId}
        .dimEntities=${this.screenState==="stale"}
        @zone-select=${t=>this.onZoneSelect(t.detail.id)}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
      ${this.threeState==="loading"?r`<div class="cover" data-3d-loading><sw-state-panel state="loading" hint="טוען תלת-ממד…"></sw-state-panel></div>`:d}
      ${this.threeState==="error"?r`<div class="banner" data-3d-load-error><sw-state-panel compact state="error" heading="תלת-ממד לא נטען" hint=${this.threeError}></sw-state-panel></div>`:d}
      <div class="floorchip" data-floorchip><sw-icon name="building" size=${14}></sw-icon>${e.floorName}</div>
      ${e.levels.length>1?r`<div class="levelbar">${Ut(e.levels,this.levelFilter,t=>this.levelFilter=t)}</div>`:d}
      ${e.source==="api"&&this.buildingFloors.length>1&&!this.shows3d?r`<div class="floorbtns" role="group" aria-label="מעבר מהיר בין קומות" data-floor-buttons>
            ${this.buildingFloors.map(t=>r`<button class=${t.id===this.floorId?"on":""} data-floor-button=${t.id} title=${`${t.name}${t.hasPlan?"":" · אין תוכנית"}`} aria-pressed=${t.id===this.floorId} @click=${()=>{t.id!==this.floorId&&g(`/explore/floors/${t.id}`)}}>${t.short}</button>`)}
          </div>`:d}
      ${this.shows3d?this.renderFloorStrip():d}
      ${this.panel?this.renderPanel():d}
      ${this.renderSharedMembers()}
      ${this.renderRoomCard()}
      ${this.renderCircuitStrip()}
      ${this.multi?this.renderPickbar():d}
      ${this.renderSideList()}
      ${this.renderSaveDialog()}
      ${this.shows3d?d:r`<div class="legend" aria-label="מקרא">
        ${e.zones.length&&this.layers.has("zones")?r`<span><i style="--lg: var(--sw-accent); border-radius: var(--sw-r-2xs); opacity: 0.5"></i>${e.zones.length} אזורים</span>`:d}
        <span><i style="--lg: var(--sw-accent)"></i>חי</span>
        <span><i style="--lg: var(--sw-stale)"></i>לא מעודכן</span>
        <span><i style="--lg: var(--sw-offline)"></i>מנותק</span>
        <span><i style="--lg: var(--sw-forbidden)"></i>ללא הרשאה</span>
        <span><i style="--lg: var(--sw-menu-surface); box-shadow: 0 0 0 1px var(--sw-border-strong)"></i>התקן</span>
      </div>`}
      ${this.renderCard()}
      ${this.renderConfirm()}
      ${this.ticketFor?r`<ticket-map-create open .element=${this.ticketFor} @close=${()=>this.ticketFor=null}></ticket-map-create>`:d}
    `}render(){const e=this.bundle,t=this.floors,s=t.find(o=>o.id===this.floorId),a=e?e.source==="demo"?s?.cameraCount??0:e.anchors.filter(o=>o.resource_type==="camera").length:0,i=this.tree?.source==="api"?this.tree.sites.flatMap(o=>(o.buildings??[]).flatMap(n=>n.floors??[])).find(o=>o.id===this.floorId):null;return r`
      <div class="head lead-head" data-head>
        ${this.embedded?d:r`<div>
          <div class="crumbs">
            <a href="#/explore/sites">${e?.siteName??"אתרים"}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <a href="#/explore/buildings/${e?.source==="api"?i?.building_id??"bld-a":"bld-a"}/floors">${e?.buildingName??""}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <span>${e?.floorName??""}</span>
          </div>
          <h1>${e?`${e.buildingName} – ${e.floorName}`:"מפת קומה"}</h1>
          <div class="sub">
            <span>${a} מצלמות${e&&e.source==="api"?` · ${e.anchors.length-a} התקנים${e.zones.length?` · ${e.zones.length} אזורים`:""}`:""}${e?.source==="demo"?" · נתוני הדגמה":e?.planStatus==="published"?" · תוכנית מפורסמת":""}</span>
            ${i?.draft_version_id?r`<sw-badge kind="stale" label="טיוטת תוכנית ממתינה לפרסום"></sw-badge>`:d}
          </div>
        </div>`}
        <div class="spacer"></div>
        <div class="tools" data-tools>
          <div class="layers" role="group" aria-label=${w("floor.layers")}>
            ${we.filter(o=>(o.id!=="cameras"||!M())&&(o.id!=="photo"||!!e?.floorImages)).map(o=>r`<button class=${this.layers.has(o.id)?"on":""} title=${o.label()} aria-label=${o.label()} aria-pressed=${this.layers.has(o.id)} @click=${()=>this.toggleLayer(o.id)}><sw-icon name=${o.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-button icon="cube" aria-pressed=${this.shows3d} data-view-3d ?disabled=${!this.shows3d&&(!this.can3d||this.threeState==="loading")}
            title=${E()?this.hasScene?"מקש 3":"אין מבנה מפורסם לקומה הזו":de} @click=${()=>this.toggle3d()}>${this.shows3d?"2D":"3D"}</sw-button>
          ${E()?d:r`<span class="note" data-3d-unavailable>${de}</span>`}
          ${this.compact?d:r`<sw-button icon="layers" aria-pressed=${this.panel} @click=${()=>this.togglePanel()}>${w("floor.layers")}</sw-button>
          ${e&&e.source==="api"?r`<sw-button icon="list" aria-pressed=${this.sideList} data-sidelist-toggle @click=${()=>this.toggleSideList()}>רשימה</sw-button>${M()||this.embedded?d:r`<sw-button icon="grid" aria-pressed=${this.multi} data-multi-toggle @click=${()=>this.setMulti(!this.multi)}>בחירת מצלמות</sw-button>`}`:d}`}
          ${this.embedded?d:r`<sw-field style="min-inline-size:280px"><select aria-label=${w("floor.switcher")} @change=${o=>g(`/explore/floors/${o.target.value}`)}>${t.map(o=>r`<option value=${o.id} ?selected=${o.id===this.floorId}>${N(o.name)} · ${o.cameraCount} מצלמות${o.hasPlan?"":" · אין תוכנית"}</option>`)}</select></sw-field>`}
        </div>
      </div>
      <div class="stage" data-stage>${this.renderStage()}</div>
    `}};h.styles=ge`
    ${st}
    :host {
      display: flex;
      flex-direction: column;
      block-size: 100%;
      min-block-size: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 10px 12px;
      padding: 14px 24px 12px;
    }
    /* the header dropdown's lead reserve (styles/lead-reserve.ts) is ADDED to the row's own start padding, never in its place
       (the plain snippet's padding-inline-start outranked .head and dropped the 24 / 12 px inset: classic map pixel baselines) */
    .head.lead-head {
      padding-inline-start: calc(24px + var(--sw-lead-reserve, 0px));
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-end: 4px;
    }
    .crumbs a {
      color: inherit;
      text-decoration: none;
    }
    .crumbs sw-icon {
      color: var(--sw-border-strong);
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      margin-block-start: 2px;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .spacer {
      flex: 1;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tools sw-field {
      inline-size: 170px;
    }
    .layers {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .layers button {
      border: 0;
      background: transparent;
      inline-size: 28px;
      block-size: 26px;
      border-radius: var(--sw-r-xs);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    .layers button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .stage {
      position: relative;
      flex: 1;
      min-block-size: 360px;
      margin: 0 24px 24px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .floorbtns {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 56px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 60%;
      overflow: auto;
    }
    /* HUD panels over the plan are opaque (owner 2026-10-13, tokens: styles/menu-surface.ts): the quick floor buttons, the floor chip, the
       level bar, the circuit buttons, the selection bar, the side list, the legend and the floor strip paint the menu surface and the strong
       hairline (Bubble's menu hairline is its own surface: no edge on the plan's ground), with no blur - a see-through panel overlaps its own
       text with the drawing behind it */
    .floorbtns button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 38px;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-menu-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      direction: ltr;
    }
    .floorbtns button.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse); /* the ink of an accent fill: white on the light schemes' blue, dark on the dark schemes' light blue (--sw-on-video was white on both: 2:1 on a dark Domus / Crystal) */
    }
    .jz {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding: 6px 12px;
      border-block-end: 1px solid var(--sw-border);
    }
    /* entity card on phones (owner round 3, 3.6): full-width actions, stacked state row */
    @media (max-width: 640px) {
      .estate {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      .eactions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .eactions .actrow {
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      .eactions .actrow sw-button {
        min-inline-size: 0;
      }
      /* the map keeps the screen: one scrolling row of tools, floor buttons replace the floor select, no editor entry */
      .tools {
        flex-wrap: nowrap;
        overflow-x: auto;
        max-inline-size: 100%;
        padding-block-end: 2px;
      }
      .tools .layers,
      .tools sw-field,
      .tools sw-button[icon='edit'] {
        display: none;
      }
      /* the 3D toggle stays in the scrolling tool row, never squeezed (ruling R-P4-7) */
      .tools sw-button[data-view-3d] {
        flex: none;
      }
      .tools .note {
        white-space: nowrap;
      }
      .rename {
        flex-wrap: wrap;
      }
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 6px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .floorchip sw-icon {
      color: var(--sw-text-2);
    }
    /* The HUD layout contract (map/hud-layout.ts; owner 2026-10-13, the pictures of the opaque panels). The stage carries what the contract needs:
         --hud-end         the inline-end inset of the free band (the edge inset, or past a docked side list / layers list); the corner's blocks
                           here and in the 3D element and the 2D canvas start there
         --hud-circuits-top  where the circuit buttons start: the edge inset, under the 3D time pill's row, or under the walk's minimap
         --hud-bar-top / --hud-cols-top  the level bar's row when it has a row of its own (data-hud-row2), and where the columns start under it
         --hud-bar-h       the bar's measured height (one line, or two when it wraps in its own row)
         --hud-list-bottom how far above the bottom the docked side list stops (the 2D view: above the measured zoom buttons)
         data-corner       what the 3D element keeps in the corner (its hud-corner event)
         data-hud-row2     the level bar does not fit beside the floor chip and the corner's item (needsSecondRow)
       They are written by syncHud(); without them (the first paint, the demo, a test that never mounts the stage) every var() falls back to the old edge. */
    .stage {
      --hud-circuits-top: ${x}px;
      --hud-bar-top: ${he}px;
      --hud-cols-top: calc(var(--hud-bar-top) + var(--hud-bar-h, 38px) + ${L}px);
      /* the 3D element's slow-device notice stands under the bar (a skin's chips make the bar taller: Bubble's is 54 px) */
      --hud-hint-top: calc(${x}px + var(--hud-bar-h, 38px) + ${L}px);
    }
    .stage[data-corner='pill'] {
      --hud-circuits-top: ${he}px;
    }
    .stage[data-corner='minimap'] {
      --hud-circuits-top: ${x+pe+L}px;
      --hud-bar-top: ${x+pe+L}px;
    }
    @media (max-width: ${es}px) {
      .stage[data-corner='minimap'] {
        --hud-circuits-top: ${x+ue+L}px;
        --hud-bar-top: ${x+ue+L}px;
      }
    }
    /* The level bar is centred in the free band: two logical insets (the start edge, and --hud-end) with auto margins and a fit-content size, so it
       is centred in RTL and LTR alike. The old inset-inline-start: 50% + translateX(-50%) shifted it LEFT by half its own width in RTL, off the
       canvas at 390 px and over the corner's blocks everywhere (the owner's pictures). One line; when the band is too narrow for it beside the floor
       chip and the corner's item it takes a row of its own under them (data-hud-row2) and, if it is still wider than the band, wraps to a second line. */
    .levelbar {
      position: absolute;
      inset-block-start: ${x}px;
      inset-inline: ${x}px var(--hud-end, ${x}px);
      margin-inline: auto;
      inline-size: fit-content;
      max-inline-size: calc(100% - ${x}px - var(--hud-end, ${x}px));
      box-sizing: border-box;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 4px 8px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      white-space: nowrap;
    }
    .stage[data-hud-row2] .levelbar {
      inset-block-start: var(--hud-bar-top);
      white-space: normal; /* wider than its band (a docked list, many levels): a second line, never a scrolling bar - every chip stays in view */
      text-align: center;
    }
    .circuits {
      position: absolute;
      inset-inline-end: var(--hud-end, ${x}px);
      inset-block-start: var(--hud-circuits-top, ${x}px);
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: var(--sw-z-map-ui);
      max-inline-size: 260px;
    }
    /* the level bar's own row: the circuit buttons and the floor buttons of both columns start under it */
    .stage[data-hud-row2] {
      --hud-hint-top: var(--hud-cols-top);
    }
    .stage[data-hud-row2] .circuits {
      inset-block-start: max(var(--hud-circuits-top), var(--hud-cols-top));
    }
    .stage[data-hud-row2] .floorbtns,
    .stage[data-hud-row2] .floorstrip {
      inset-block-start: var(--hud-cols-top);
    }
    .circuits .circuit {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas: "dot name" "dot cnt";
      gap: 0 8px;
      align-items: center;
      text-align: start;
      padding: 6px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      box-shadow: var(--sw-shadow-1);
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      cursor: pointer;
    }
    .circuits .circuit i {
      grid-area: dot;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid var(--kc);
      background: transparent;
    }
    .circuits .circuit.on i {
      background: var(--sw-map-glow);
      box-shadow: 0 0 6px var(--sw-map-glow);
    }
    .circuits .circuit .cnt {
      grid-area: cnt;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .circuits .circuit.muted i {
      border-color: var(--sw-stale);
      background: transparent;
      box-shadow: none;
    }
    .circuits .circuit .cnote {
      color: var(--sw-stale-text);
    }
    /* a button that cannot be pressed now is dimmed by its ink and its dot, not by opacity on the box: a faded box would show the plan through it */
    .circuits .circuit:disabled {
      cursor: not-allowed;
      color: var(--sw-text-2);
    }
    .circuits .circuit:disabled i {
      opacity: 0.6;
    }
    .circuits .cstatus {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 3px 7px; /* 4 / 8 minus the hairline: the box keeps its size */
    }
    .circuits .err {
      color: var(--sw-danger-text);
    }
    @media (max-width: 640px) {
      .circuits.shifted {
        display: none;
      }
    }
    .panel {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      inline-size: 272px;
      max-inline-size: calc(100% - 24px);
      /* the layers list opens over the plan like a popover: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 12px 14px;
      /* owner bug 2026-09-30: on a phone the stage is shorter than the list and clips it (.stage is overflow: hidden), so
         the toggles at the bottom were unreachable. The panel is capped to the stage and scrolls itself; the swipe
         stays inside it (no chaining to the page or the map behind). */
      max-block-size: calc(100% - 50px); /* the 12 px gap above and below, plus this box's own padding and border (content-box) */
      overflow-y: auto;
      overscroll-behavior: contain;
      touch-action: pan-y;
      -webkit-overflow-scrolling: touch;
    }
    .panel h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .panel .sub {
      margin-block-end: 6px;
    }
    .panel .prow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .panel .prow:last-of-type {
      border-block-end: 0;
    }
    .panel .prow .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .panel .prow .cnt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-regular);
    }
    .panel .pnote {
      margin-block-start: 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .panel .pexport {
      margin-block-start: 8px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pickbar {
      position: absolute;
      inset-inline: 12px;
      inset-block-start: 56px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-accent);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      box-shadow: var(--sw-shadow-2);
      font-size: var(--sw-fs-sm);
    }
    .pickbar .hint {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .pickbar .grow {
      flex: 1;
    }
    .pickbar .roomchips {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    /* M043: the suggested adjacent cameras - its own row under the picks, dashed to read as "offered", not picked */
    .pickbar .suggest {
      flex-basis: 100%;
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      padding-block-start: 6px;
      border-block-start: 1px dashed var(--sw-border);
    }
    .pickbar .suggest .lbl {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .pickbar .suggest sw-chip small {
      margin-inline-start: 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular);
    }
    .shared-members {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 56px;
      z-index: var(--sw-z-map-ui);
      inline-size: 300px;
      max-inline-size: calc(100% - 24px);
      max-block-size: 60%;
      overflow: auto;
      /* the shared room's members card hangs over the plan like the room card: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 10px 12px;
    }
    .shared-members .sm-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-block-end: 6px;
      font-size: var(--sw-fs-sm);
    }
    .shared-members .sm-head span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    /* A docked list: it takes the end edge's column from the top to the row of the zoom buttons (--hud-list-bottom: the floor map measures their dock,
       a skin's controls make it 90 px (Classic) or 144 px (Bubble) high; the 3D view has none: HUD_BELOW_LIST). It used to stop 56 px up and covered
       two of the three buttons. The corner's blocks start past it (--hud-end), so nothing but the plan stands under it. A phone gets the bottom sheet below. */
    .sidelist {
      position: absolute;
      inset-inline-end: ${x}px;
      inset-block: ${x}px var(--hud-list-bottom, ${ts}px);
      inline-size: 236px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: var(--sw-fs-sm);
    }
    .sidelist .sh {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-block-end: 1px solid var(--sw-border);
      font-weight: 600;
    }
    .sidelist .sh .grow {
      flex: 1;
    }
    .sidelist .body {
      overflow: auto;
      padding: 4px 0 8px;
    }
    .sidelist .grp {
      padding: 8px 10px 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-transform: none;
    }
    .sidelist button.it {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      padding: 6px 10px;
      border: 0;
      background: none;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .sidelist button.it.on {
      background: var(--sw-surface-3);
    }
    .sidelist button.it:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .sidelist .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--dot, var(--sw-text-3));
      flex: none;
    }
    .sidelist .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sidelist .st {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* the caption of the row under the pointer or selected stands on the row's own wash (surface-3): the body ink keeps it at 4.5:1 in every skin */
    .sidelist button.it.on .st {
      color: var(--sw-text);
    }
    @media (max-width: 720px) {
      .sidelist {
        inline-size: min(236px, 70vw);
      }
    }
    .pickbar .saved {
      flex-basis: 100%;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .pickbar .saved a {
      color: var(--sw-accent-text);
    }
    .saveform {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: min(480px, 80vw);
      font-size: var(--sw-fs-sm);
    }
    .saveform .row {
      display: flex;
      gap: 12px;
    }
    .saveform .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .saveform .err {
      color: var(--sw-danger-text);
    }
    .banner {
      position: absolute;
      inset-inline: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      /* the soft state tone laid over the opaque surface: the amber reads, the plan does not show through the text */
      background: linear-gradient(var(--sw-stale-soft), var(--sw-stale-soft)), var(--sw-menu-surface);
      border: 1px dashed var(--sw-stale);
      border-radius: var(--sw-r-md);
      color: var(--sw-text);
    }
    .banner sw-state-panel {
      --sw-accent-soft: transparent;
    }
    .cover {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: var(--sw-menu-surface);
      z-index: var(--sw-z-map-ui);
    }
    /* the legend was a white 92 % pill with the light ink of the dark scheme on it (unreadable in dark) and a blur: the opaque surface, in the scheme's own ink */
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 10px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .legend i {
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--lg);
      box-shadow: 0 0 0 1px var(--sw-menu-border);
    }
    .meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 10px;
      font-size: var(--sw-fs-xs);
      margin: 0;
    }
    .meta dt {
      color: var(--sw-text-3);
      margin: 0;
    }
    .meta dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .note a[data-grant-note-link] {
      color: var(--sw-accent-text, var(--sw-accent));
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .warn {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .actrow {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .actrow .arg {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      padding: 3px 6px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 110px;
    }
    .actrow input.arg[type='number'] {
      inline-size: 72px;
    }
    .actrow .argwrap {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .actrow .unit {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .statusrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* HA entity card (R3): state first, actions as big buttons, details folded */
    .ecard {
      display: grid;
      gap: 10px;
    }
    .estate {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
    }
    .estate.live {
      background: color-mix(in srgb, var(--sw-accent) 10%, var(--sw-surface));
      border-color: color-mix(in srgb, var(--sw-accent) 35%, var(--sw-border));
    }
    .estate .esub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .eactions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .eactions .actrow sw-button {
      min-inline-size: 110px;
    }
    .rename {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .rename input {
      flex: 1;
      font: inherit;
      padding: 6px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: inherit;
    }
    details.more summary {
      cursor: pointer;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    details.more .meta {
      margin-block-start: 6px;
    }
    .off {
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      display: grid;
      place-items: center;
      color: var(--sw-text-2);
      text-align: center;
      padding: 10px;
      font-size: var(--sw-fs-xs);
    }
    .off sw-icon {
      margin-block-end: 4px;
      color: var(--sw-text-3);
    }
    .sidelist .grab {
      display: none;
      justify-content: center;
      align-items: center;
      block-size: 22px;
      border: 0;
      background: transparent;
      cursor: pointer;
      touch-action: manipulation;
    }
    .sidelist .grab span {
      inline-size: 40px;
      block-size: 4px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-border-strong);
    }
    @media (max-width: 767px) {
      .head {
        padding: 12px 12px 8px;
      }
      .head.lead-head {
        padding-inline-start: calc(12px + var(--sw-lead-reserve, 0px));
      }
      .stage {
        margin: 0;
        border-radius: 0;
        border-inline: 0;
        box-shadow: none;
      }
      h1 {
        font-size: var(--sw-fs-xl);
      }
      .legend {
        display: none;
      }
      /* K88 phone pass (mobile audit rec. 5): the scrolling tool row fades at both edges instead of cutting a button */
      .tools {
        /* a mask reads only alpha: black is the opaque stop, not a colour of the page */
        -webkit-mask-image: linear-gradient(to right, transparent, black 18px, black calc(100% - 18px), transparent);
        mask-image: linear-gradient(to right, transparent, black 18px, black calc(100% - 18px), transparent);
        padding-inline: 14px;
        scrollbar-width: none;
      }
      .tools::-webkit-scrollbar {
        display: none;
      }
      /* K88 phone pass (mobile audit rec. 2): the side list is a bottom sheet that leaves most of the map visible */
      .sidelist {
        inset: auto 0 0 0;
        inline-size: auto;
        max-inline-size: none;
        block-size: 38%;
        border-radius: var(--sw-r-lg) var(--sw-r-lg) 0 0;
        border-block-end: 0;
        transition: block-size 0.2s ease;
      }
      .sidelist.tall {
        block-size: 78%;
      }
      /* the eye-level walk keeps its own bottom row (the phone's one-row sheet, the floating bar of a wider view): the list's sheet stands above it */
      .stage[data-corner='minimap'] .sidelist {
        inset-block-end: calc(${ss}px + env(safe-area-inset-bottom, 0px));
      }
      .sidelist .grab {
        display: flex;
      }
      .sidelist .sh {
        padding-block: 4px 8px;
      }
      /* the selection bar as one thin scrolling row (rec. 2) */
      .pickbar {
        flex-wrap: nowrap;
        overflow-x: auto;
        inset-block-start: 8px;
        padding: 6px 8px;
        scrollbar-width: none;
      }
      .pickbar > * {
        flex: none;
      }
      .floorstrip {
        inset-inline-start: 8px;
        inset-block-start: 48px;
      }
      .floorstrip button {
        inline-size: 52px;
        padding: 4px 2px;
      }
      .floorstrip .fs-name {
        display: none;
      }
    }
    /* K88 phone pass (mobile audit rec. 3): a short landscape viewport keeps the map, drops the title block */
    @media (max-height: 500px) {
      .head {
        padding: 6px 12px 4px;
        gap: 4px 8px;
        align-items: center;
        flex-wrap: nowrap;
      }
      .head.lead-head {
        padding-inline-start: calc(12px + var(--sw-lead-reserve, 0px));
      }
      .crumbs,
      .sub,
      .legend,
      .tools .layers,
      .tools sw-field,
      .tools sw-button[icon='edit'] {
        display: none;
      }
      .tools {
        flex-wrap: nowrap;
        overflow-x: auto;
        max-inline-size: 100%;
      }
      h1 {
        font-size: var(--sw-fs-lg);
        white-space: nowrap;
      }
      .stage {
        min-block-size: 200px;
        margin: 0;
        border-radius: 0;
      }
    }
    /* K88: the selected room's card */
    .roomcard {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 56px;
      z-index: var(--sw-z-map-ui);
      inline-size: 240px;
      max-inline-size: calc(100% - 24px);
      /* the selected room's card hangs over the plan like a popover: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 8px 12px 10px;
      font-size: var(--sw-fs-sm);
    }
    .roomcard .rc-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .roomcard .rc-sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      margin-block-start: 2px;
    }
    .roomcard .rc-open {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-start: 8px;
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: 600;
      text-decoration: none;
    }
    /* K88 3D round 2: the floor strip beside the 3D view */
    .floorstrip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 56px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 4px;
      box-shadow: var(--sw-shadow-2);
    }
    .floorstrip button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      inline-size: 72px;
      padding: 6px 4px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-xs);
    }
    .floorstrip button.on {
      border-color: var(--sw-accent);
      color: var(--sw-text);
      background: var(--sw-accent-soft);
    }
    .floorstrip button[disabled] {
      opacity: 0.45;
      cursor: default;
    }
    .floorstrip .fs-short {
      font-weight: 700;
      font-size: var(--sw-fs-md);
      direction: ltr;
    }
    .floorstrip .fs-name {
      max-inline-size: 64px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .floorstrip .fs-dots {
      display: flex;
      gap: 3px;
      min-block-size: 6px;
    }
    .floorstrip .fs-dots i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-text-3);
    }
    .floorstrip .fs-dots i.lit {
      background: var(--sw-map-lit);
    }
    .floorstrip .fs-dots i.presence {
      background: var(--sw-map-presence);
    }
    .floorstrip .fs-dots i.open {
      background: var(--sw-danger);
    }
    /* K88: hosted inside another screen */
    :host([embedded]) .head {
      padding: 6px 8px 4px;
    }
    :host([embedded]) .stage {
      margin: 0;
      min-block-size: 280px;
    }
    :host([compact]) .stage {
      min-block-size: 240px;
    }
    :host([compact]) .legend,
    :host([compact]) .tools .layers,
    :host([embedded]) .floorbtns,
    :host([embedded]) .floorstrip,
    :host([embedded]) .crumbs {
      display: none; /* hosted: the host screen chooses the floor; the map's own floor controls would leave it */
    }

    /* ---- R5-MAPS-297 (impeccable bolder, the HOMEFABLE hero / card / well pattern) ----
       The stage is the hero object (shadow 2) under a 26/700 title; the HUD panels over it keep the opaque menu surface (owner 2026-10-13)
       with a 14/700 floor chip and a legend in the body ink with 10 px dots. Every "on" state is a FILLED field: an active layer and the
       selected side-list row are the accent field, a lit circuit is the warm lit field over its whole button (not a glowing dot alone).
       Press feedback on pointer-down for every pressable HUD control; hover only with a fine pointer (emil-design-eng, mobile-native). */
    h1 {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.02em;
    }
    .sub {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    .stage {
      box-shadow: var(--sw-shadow-2);
      /* loop 2: the map ground is a tone step down (the desk); a raster plan sheet floats on it and the opaque HUD panels read as raised */
      --sw-map-bg: var(--sw-surface-3);
      border-color: transparent;
    }
    .floorchip {
      padding: 8px 14px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      /* loop 2: the "where am I" chip carries a 2 px accent edge and the accent ink - a HUD panel keeps the opaque menu surface
         (owner 2026-10-13, unit-menu-lint rejects an accent fill on a registered panel) */
      background: var(--sw-menu-surface);
      border: 2px solid var(--sw-accent);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-2);
    }
    .floorchip sw-icon {
      color: inherit;
    }
    .legend {
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-2);
    }
    .legend i {
      inline-size: 12px;
      block-size: 12px;
    }
    .crumbs {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .layers {
      background: var(--sw-surface-2);
      padding: 3px;
      gap: 3px;
    }
    .layers button {
      inline-size: 30px;
      block-size: 28px;
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    .layers button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      box-shadow: none;
    }
    .layers button,
    .floorbtns button,
    .circuits .circuit,
    .sidelist button.it,
    .floorstrip button,
    .sidelist .grab {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
    }
    .layers button:active,
    .floorbtns button:active,
    .circuits .circuit:active:not(:disabled),
    .sidelist button.it:active,
    .floorstrip button:active:not([disabled]) {
      transform: scale(var(--sw-press-scale));
    }
    .floorbtns button {
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    .circuits .circuit {
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    .circuits .circuit.on {
      background: var(--sw-lit-soft);
      border-color: color-mix(in srgb, var(--sw-map-lit) 60%, var(--sw-border-strong));
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .circuits .circuit.on .cnt {
      color: var(--sw-text);
    }
    .sidelist {
      box-shadow: var(--sw-shadow-3);
    }
    .sidelist .sh {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .sidelist .grp {
      font-weight: var(--sw-fw-semibold);
    }
    .sidelist button.it {
      transition: background var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    .sidelist button.it.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .sidelist button.it.on .st {
      color: var(--sw-accent-text);
    }
    /* POLISH4 WP6 (D12): the map is a touch-tablet control screen - hover lives only under a fine pointer, so a tap never leaves a
       sticky wash (it replaces the old ungated :hover + (hover: none) undo pair); the selected row / floor keeps its own fill */
    @media (hover: hover) and (pointer: fine) {
      .crumbs a:hover {
        color: var(--sw-accent-text);
      }
      .sidelist button.it:hover:not(.on) {
        background: var(--sw-surface-3);
      }
      .sidelist button.it:hover:not(.on) .st {
        color: var(--sw-text);
      }
      .roomcard .rc-open:hover {
        text-decoration: underline;
      }
      .floorstrip button:hover:not(.on):not([disabled]) {
        background: var(--sw-surface-2);
      }
    }
    .panel h3 {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .panel .prow .lbl {
      font-weight: var(--sw-fw-semibold);
    }
    .roomcard .rc-head strong {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .shared-members .sm-head {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .estate {
      border: 0;
    }
    .estate.live {
      background: var(--sw-accent-soft);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 35%, transparent);
    }
    .meta dd {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
  `;p([S()],h.prototype,"floorId",2);p([S()],h.prototype,"screenState",2);p([S()],h.prototype,"focusZone",2);p([S()],h.prototype,"focusCamera",2);p([S()],h.prototype,"focusEntity",2);p([S()],h.prototype,"focusObject",2);p([S()],h.prototype,"picksParam",2);p([S({type:Boolean,reflect:!0})],h.prototype,"embedded",2);p([S({type:Boolean,reflect:!0})],h.prototype,"compact",2);p([u()],h.prototype,"otherBundles",2);p([u()],h.prototype,"sheetTall",2);p([u()],h.prototype,"focusedObjectId",2);p([u()],h.prototype,"selectedZoneId",2);p([u()],h.prototype,"bundle",2);p([u()],h.prototype,"tree",2);p([u()],h.prototype,"loadError",2);p([u()],h.prototype,"noFloors",2);p([u()],h.prototype,"selectedId",2);p([u()],h.prototype,"ticketFor",2);p([u()],h.prototype,"anchor",2);p([u()],h.prototype,"layers",2);p([u()],h.prototype,"planImage",2);p([u()],h.prototype,"catalogLookup",2);p([u()],h.prototype,"levelFilter",2);p([u()],h.prototype,"geometry",2);p([u()],h.prototype,"view3d",2);p([u()],h.prototype,"threeState",2);p([u()],h.prototype,"threeError",2);p([u()],h.prototype,"preset3d",2);p([u()],h.prototype,"walk3d",2);p([u()],h.prototype,"real3d",2);p([u()],h.prototype,"corner3d",2);p([u()],h.prototype,"quality3d",2);p([u()],h.prototype,"catalog3d",2);p([u()],h.prototype,"presenceFade",2);p([u()],h.prototype,"liveTransport",2);p([u()],h.prototype,"stateNow",2);p([u()],h.prototype,"pinned",2);p([u()],h.prototype,"panel",2);p([u()],h.prototype,"multi",2);p([u()],h.prototype,"sideList",2);p([u()],h.prototype,"jumpZoom",2);p([u()],h.prototype,"saveView",2);p([u()],h.prototype,"savedView",2);p([u()],h.prototype,"picked",2);p([u()],h.prototype,"narrow",2);p([u()],h.prototype,"syncConnected",2);p([u()],h.prototype,"action",2);p([u()],h.prototype,"confirmSpec",2);p([$e("sw-plan-canvas")],h.prototype,"canvas",2);p([$e(".stage")],h.prototype,"stage",2);p([u()],h.prototype,"presenceSnap",2);p([u()],h.prototype,"actionArgs",2);p([u()],h.prototype,"renaming",2);p([u()],h.prototype,"notice",2);p([u()],h.prototype,"incidentBusy",2);p([u()],h.prototype,"skinBusy",2);p([u()],h.prototype,"skinNote",2);p([u()],h.prototype,"stillsFallback",2);p([u()],h.prototype,"bakeBusy",2);p([u()],h.prototype,"bakeNote",2);p([u()],h.prototype,"viewDials",2);h=p([xe("explore-floor-map")],h);export{h as ExploreFloorMap};
//# sourceMappingURL=explore-floor-map-DwFulkaO.js.map
