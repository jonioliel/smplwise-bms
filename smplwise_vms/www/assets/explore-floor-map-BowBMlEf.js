const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{g as ce,y as O,j as m,i as de,A as h,cK as v,b as c,eG as oe,k as he,mA as Je,cH as Xe,mz as ne,my as re,a0 as Qe,hr as et,ae as F,af as tt,kx as st,j3 as it,a7 as z,b2 as at,aY as ot,d6 as nt,a2 as me,aK as fe,p as Y,qU as rt,aM as J,gm as K,bo as be,eF as lt,lo as X,qV as ct,e as we,o as j,hD as ve,hE as H,hF as Q,eV as D,eX as M,eW as dt,aE as ht,a$ as Z,n as x,ad as pt,ai as ee,a_ as ut,c4 as mt,li as ft,a as bt,b0 as ge,b1 as ye,qW as xe,c8 as $e,eU as wt,qX as vt,aL as ke,eI as gt,qY as yt,qZ as xt,q_ as _e,lk as $t,eZ as kt,q$ as _t,r0 as St,r1 as zt,eY as It,e2 as Ke}from"./index-CqeTnh_F.js";import{l as Ct}from"./lead-reserve-DTJwMG-y.js";import"./sw-chip-SjQHeT2C.js";import{d as Ot,a as Lt}from"./demo-3d-DK1K7il4.js";import{p as Mt}from"./sw-plan-canvas-Bo62frVI.js";import{t as A}from"./map-zXScpxbg.js";import{p as V}from"./zones-vHxhPHts.js";import{m as Tt,a as Pt}from"./lock-reason-CNcHbSzk.js";import{l as Et,c as At,w as Ft}from"./views-XuA7xQto.js";import{b as jt}from"./geometry-BQCqxGaM.js";import{R as Dt,i as Nt,S as Rt,T as Bt,k as qt,U as Vt,l as Ht,c as Se,g as ze,e as Zt,V as Wt,W as Ut,z as Kt}from"./shared-space-BOiWPXeV.js";import{s as Gt,a as Yt}from"./state-facts-RymfkgiI.js";import{c as Jt}from"./plan-catalog-DphuaJwu.js";import{i as Xt,d as Qt,a as es,l as ts,c as ss,e as is,f as Ie,s as te,h as as,b as os,w as ns,r as rs}from"./floor-view-shared-DzRnI754.js";import{e as Ce,b as se}from"./scene-builder-DvinXVyd.js";import{m as ls}from"./quality-mode-CajKbCwW.js";import{h as Oe,s as Le,r as Me,p as cs,B as ds,a as hs,b as ps,c as us,d as ms}from"./plan-change-key-CMTgnhrJ.js";import{i as fs,v as bs}from"./quality-ladder-DlLcgK2o.js";import{N as ws,b as vs,r as gs}from"./wall-plan-mode-C7_fQEX6.js";import{S as Te}from"./still-bake-Ca-W12aM.js";import{D as ys,p as xs,g as Pe,h as $s,c as ks}from"./plan-view-9dqzzgIq.js";import{r as Ee}from"./sun-CMDElDLC.js";import{b as _s}from"./part-select-CylWA6VC.js";import{h as Ss,n as zs,e as Is,a as Cs,H as C,s as Os,p as Ae,g as Fe,l as Ls,b as je,c as N,d as Ms,f as Ts,i as Ps,j as De,k as Ne}from"./hud-layout-mVZqSuHc.js";import{_ as Es}from"./sw-logo-art-PLtEZJxU.js";import{l as As}from"./live-BLNpflQx.js";import{t as o,c as Fs,r as js}from"./plan-editor-aYmPW8rZ.js";import{w as R,W as Re}from"./webgl-aVCUVQzf.js";import{g as Ds,u as Ns}from"./skins-CRQ8LRMs.js";import{t as Rs}from"./tickets-C2Vs-3kL.js";import{t as Bs}from"./icons-BwdI1nED.js";import{m as qs,a as Vs}from"./map-create-vvnUsbch.js";import"./candidates-CbBB8mEK.js";import"./material-resolve-DiioJtnF.js";import"./if-defined-BHBFWi8J.js";import"./connector-targets-CMEQ3QSz.js";import"./media-KElttbNZ.js";import"./ticket-create-XhmxHQbT.js";import"./automations-glass-D6X5CTVK.js";import"./glass-BPdh5YXZ.js";import"./bubble-chrome-DtLCPG9P.js";import"./map-text-BpeZzcph.js";import"./device-activity-logic-D9h6oPRS.js";import"./readiness-model-DGhavIGL.js";import"./tickets-s4-CD2im1Vy.js";import"./drawer-text-D10ZZllT.js";import"./org-locations-text-Bbujc57i.js";import"./location-picker-396CLzXB.js";const Be={same_zone:A("אותו חדר"),adjacent_zone:A("חדר סמוך"),nearby:A("בקרבת מקום")},Hs=.2,B={same_zone:0,adjacent_zone:1,nearby:2};function Zs(e){let t=0;for(let s=0;s<e.length;s++){const a=e[s],i=e[(s+1)%e.length];t+=a.x*i.y-i.x*a.y}return Math.abs(t)/2}function Ws(e,t){let s=null;for(const a of t){if(a.polygon.length<3||!V(e,a.polygon))continue;const i=Zs(a.polygon);(!s||i<s.a)&&(s={z:a,a:i})}return s?.z??null}function Us(e,t,s){const a=s.x-t.x,i=s.y-t.y;if(a===0&&i===0)return Math.hypot(e.x-t.x,e.y-t.y);const n=Math.max(0,Math.min(1,((e.x-t.x)*a+(e.y-t.y)*i)/(a*a+i*i)));return Math.hypot(e.x-(t.x+n*a),e.y-(t.y+n*i))}function Ks(e,t,s=.01){for(const[a,i]of[[e,t],[t,e]])for(const n of a){if(V(n,i))return!0;for(let r=0;r<i.length;r++)if(Us(n,i[r],i[(r+1)%i.length])<=s)return!0}return!1}function Gs(e,t,s,a=Hs){const i=new Set(e),n=t.filter(l=>i.has(l.id));if(!n.length)return[];const r=new Map;for(const l of t)r.set(l.id,Ws(l.position,s));const d=new Map;for(const l of n){const f=r.get(l.id)??null;for(const w of t){if(i.has(w.id))continue;const $=r.get(w.id)??null,S=Math.hypot(w.position.x-l.position.x,w.position.y-l.position.y);let g=null;if(f&&$&&$.id===f.id?g="same_zone":f&&$&&Ks(f.polygon,$.polygon)?g="adjacent_zone":S<=a&&(g="nearby"),!g)continue;const b=d.get(w.id);(!b||B[g]<B[b.relation]||B[g]===B[b.relation]&&S<b.distance)&&d.set(w.id,{id:w.id,relation:g,distance:Math.round(S*1e3)/1e3,from:l.id,zoneId:$?.id??null,zoneName:$?.name??null})}}return[...d.values()].sort((l,f)=>B[l.relation]-B[f.relation]||l.distance-f.distance||(l.id<f.id?-1:1))}function ie(e){return e.join(",")}function Ys(e,t){if(!e)return[];const s=[];for(const a of e.split(",")){const i=a.trim();i&&t.has(i)&&!s.includes(i)&&s.push(i)}return s}class Js{constructor(){this.seq=0}begin(){const t=++this.seq;return()=>t!==this.seq}}const pe=["cameras","doors","lights","sensors","zones","structure","objects","connectors","states","photo"],Ge=["structure","objects","connectors","states","photo"],Xs=e=>pe.includes(e);function Qs(e){if(e)try{const t=JSON.parse(e);if(Array.isArray(t)){const s=new Set(t.filter(Xs));for(const a of Ge)t.includes(`-${a}`)||s.add(a);return s}}catch{}return new Set(pe)}function ei(e,t,s,a,i){return e&&e.geometry===t&&e.w===s&&e.h===a&&e.catalog===i?e:{geometry:t,w:s,h:a,catalog:i,...Gt(t,s,a,i)}}class ti{constructor(){this.refs=null}get(t,s){const a=this.refs;return a&&a.length===t.length&&a.every((i,n)=>Object.is(i,t[n]))?this.value:(this.value=s(),this.refs=t,this.value)}}function si(e,t){return e===t||le(e,t)}function le(e,t){if(e===t)return!0;if(typeof e!="object"||typeof t!="object"||e===null||t===null)return!1;if(Array.isArray(e)){if(!Array.isArray(t)||e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(!le(e[n],t[n]))return!1;return!0}if(Array.isArray(t))return!1;const s=Object.keys(e);if(s.length!==Object.keys(t).length)return!1;const a=t,i=e;for(const n of s)if(!Object.prototype.hasOwnProperty.call(a,n)||!le(i[n],a[n]))return!1;return!0}function qe(e){const t=e?.["map.stack_backdrop"],s=e?.["map.stack_pick"];return{backdrop:t==="dark"||t==="light"?t:"theme",pick:s==="one_tap"?"one_tap":"two_tap"}}const Ye="sw.plan3d.stack",Ve="open",ii=.35,ai=4,oi=new Set(["connector"]);function ni(e){const t=Math.max(ai,Math.max(e.size[0]*e.scale_m_per_px,e.size[1]*e.scale_m_per_px)*ii),s=[...e.levels].sort((a,i)=>a.elevation_m-i.elevation_m||(a.id<i.id?-1:1));return new Map(s.map((a,i)=>[a.id,i*t]))}const q=(e,t)=>[e[0],e[1]+t,e[2]];function He(e,t=null){if(e.levels.length<2)return e;const s=ni(e),a=l=>l?s.get(l)??0:0,i=l=>!t||!l||l===t,n=e.parts.filter(l=>!oi.has(l.kind)&&i(l.level_id)).map(l=>a(l.level_id)?{...l,position:q(l.position,a(l.level_id))}:l),r={...e,levels:e.levels.filter(l=>i(l.id)).map(l=>({...l,elevation_m:l.elevation_m+a(l.id)})),parts:n},d=e.real;return d&&(r.real={...d,parts:d.parts.filter(l=>i(l.level_id)).map(l=>({...l,position:q(l.position,a(l.level_id))})),floors:d.floors.filter(l=>i(l.level_id)).map(l=>({...l,y:l.y+a(l.level_id)})),...d.ceilings?{ceilings:d.ceilings.filter(l=>i(l.level_id)).map(l=>({...l,y:l.y+a(l.level_id)}))}:{},caps:d.caps.filter(l=>i(l.level_id)).map(l=>({...l,y:l.y+a(l.level_id)})),models:d.models.filter(l=>i(l.level_id)).map(l=>({...l,position:q(l.position,a(l.level_id)),tiles:l.tiles.map(f=>q(f,a(l.level_id)))})),lamps:d.lamps.filter(l=>i(l.level_id)).map(l=>({...l,position:q(l.position,a(l.level_id))})),shutters:d.shutters.filter(l=>i(l.level_id)).map(l=>({...l,position:q(l.position,a(l.level_id))}))}),e.walk&&delete r.walk,r}function ri(e,t,s,a,i=n=>n??""){const n=[...e.levels].sort((l,f)=>l.elevation_m-f.elevation_m||(l.id<f.id?-1:1)),r=Math.max(0,n.findIndex(l=>l.elevation_m>=-.5)),d=[];return n.forEach((l,f)=>{const w=e.parts.find(g=>g.kind==="floor"&&g.shape==="box"&&g.level_id===l.id);if(!w)return;const $=s.filter(g=>i(g.level_id)===l.id),S=$.map(g=>g.temp).filter(g=>g!==null);d.push({id:l.id,name:t.get(l.id)??l.id,short:String(f-r),pos:[w.position[0]+w.size[0]/2,l.elevation_m+l.ceiling_height_m*.5,w.position[2]-w.size[2]/2],open:$.reduce((g,b)=>g+b.open,0),presence:$.some(g=>g.presence),lit:$.reduce((g,b)=>g+b.lit,0),temp:S.length?Math.round(S.reduce((g,b)=>g+b,0)/S.length*10)/10:null,state:a?a===l.id?"sel":"away":"normal"})}),d}function li(e,t,s){return e==="one_tap"||t===s?{focus:null,enter:s}:{focus:s,enter:null}}var ci=Object.defineProperty,di=Object.getOwnPropertyDescriptor,E=(e,t,s,a)=>{for(var i=a>1?void 0:a?di(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&ci(t,s,i),i};const hi=4,Ze=4,pi=5e3,ae=e=>`${Number.isInteger(Math.round(e*10)/10)?Math.round(e):(Math.round(e*10)/10).toFixed(1)}°`;let T=class extends de{constructor(){super(...arguments),this.model=null,this.place="side",this.camera="live",this.sheet="peek",this.tab="lights",this.pages={},this.liveOn=!1,this.bust=Date.now(),this.stillTimer=0,this.rows=hi,this.ro=null}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(()=>{const e=this.clientHeight,t=this.place==="sheet"?Ze:e>=760?4:e>=640?3:2;t!==this.rows&&(this.rows=t)}),this.ro.observe(this),this.stillTimer=window.setInterval(()=>{this.camera==="snapshot"&&!this.liveOn&&!document.hidden&&(this.bust=Date.now())},pi)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.stillTimer),this.ro?.disconnect(),this.ro=null}updated(){this.liveOn&&Es(()=>import("./index-CqeTnh_F.js").then(e=>e.BV),__vite__mapDeps([0]),import.meta.url)}willUpdate(e){const t=e.get("model");e.has("model")&&t&&this.model&&t.id!==this.model.id&&(this.pages={},this.liveOn=this.camera==="live",this.sheet="peek"),e.has("camera")&&(this.liveOn=this.camera==="live")}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}run(e,t,s){this.emit("room-card-action",{entityId:e,spec:t,...s?{args:s}:{}})}openTab(e){this.tab=e,this.sheet="full"}paged(e,t,s,a){const i=Math.max(1,Math.ceil(t.length/s)),n=Math.min(this.pages[e]??0,i-1),r=d=>this.pages={...this.pages,[e]:Math.max(0,Math.min(i-1,n+d))};return c`${t.slice(n*s,n*s+s).map(a)}${i>1?c`<div class="pager" data-room-pager=${e}><button type="button" aria-label=${v("הקודם")} ?disabled=${n===0} @click=${()=>r(-1)}><sw-icon name="chevron" size=${14} flip></sw-icon></button><span class="num">${n+1}/${i}</span><button type="button" aria-label=${v("הבא")} ?disabled=${n>=i-1} @click=${()=>r(1)}><sw-icon name="chevron" size=${14}></sw-icon></button></div>`:h}`}renderCamera(e){if(this.camera==="none")return h;const t=e.cameras[0];if(!t)return h;const s=this.liveOn;return c`<button type="button" class="still" data-room-camera=${t.id} aria-label=${s?v("וידאו חי: {label}",{label:t.label}):v("תמונה מהמצלמה: {label}. לחץ לווידאו חי",{label:t.label})} @click=${()=>{s?this.emit("room-card-camera",{id:t.id}):this.liveOn=!0}}>
      ${s?c`<sw-live-player .cameraId=${t.id} profile="sub" compact .poster=${oe(t.id,this.bust)} fit="cover"></sw-live-player>`:c`<img alt="" src=${oe(t.id,this.bust)} @error=${a=>a.target.style.visibility="hidden"} />`}
      <span class="cap"><span>${v("מצלמה · {label}",{label:t.label})}</span><span>${s?v("למסך המצלמה"):v("לחץ לווידאו חי")}</span></span>
    </button>`}renderLights(e,t){const s=e.lights.filter(i=>i.on).length,a=e.lights.filter(i=>i.on&&i.spec&&!i.forbidden);return c`<div class=${`sec${this.tab==="lights"?" cur":""}`} data-tab="lights" data-room-lights>
      <h3>${v("אורות · {v}",{v:e.lights.length?v("{on} מתוך {lightsCount} דולקים",{on:s,lightsCount:e.lights.length}):v("אין אורות בחדר")})}${a.length>1?c`<button type="button" class="act" data-room-all-off ?disabled=${e.stale} @click=${()=>this.emit("room-card-bulk",{label:v("כבה הכול"),items:a.map(i=>({entityId:i.entityId,spec:i.spec}))})}>${v("כבה הכול")}</button>`:h}</h3>
      ${this.paged("lights",e.lights,t,i=>c`<div class=${`r${i.on?" lit":""}${i.forbidden?" forbidden":""}`} data-room-light=${i.entityId}><sw-icon name="light" size=${18}></sw-icon><span class="l">${i.label}</span>
        ${i.forbidden?c`<span class="no">${v("אין הרשאה")}</span>`:c`<sw-toggle label=${i.label} labelHidden .checked=${As(!!i.on)} ?disabled=${!i.spec||i.on===null||e.stale||e.busy===i.entityId} @change=${()=>i.spec&&this.run(i.entityId,i.spec)}></sw-toggle>`}</div>`)}
    </div>`}renderClimate(e){const t=e.climate;if(!t)return c`<div class=${`sec${this.tab==="climate"?" cur":""}`} data-tab="climate"><h3>${v("אקלים")}</h3><div class="empty">${v("אין חיישן טמפרטורה בחדר")}</div></div>`;const s=a=>t.spec&&t.entityId&&t.target!==null&&this.run(t.entityId,t.spec,{temperature:Math.min(t.max,Math.max(t.min,Math.round((t.target+a*t.step)*10)/10))});return c`<div class=${`sec${this.tab==="climate"?" cur":""}`} data-tab="climate" data-room-climate>
      <h3>${v("אקלים")}</h3>
      <div class="climate"><span class="now num">${t.now!==null?ae(t.now):"—"}<small>${t.target===null?v("עכשיו · חיישן בלבד"):v("עכשיו{v}",{v:t.words?` · ${t.words}`:""})}</small></span>
        ${t.target!==null?c`<span class="step"><button type="button" aria-label=${v("הורד")} ?disabled=${!t.spec||e.stale||e.busy===t.entityId} @click=${()=>s(-1)}><sw-icon name="minus" size=${16}></sw-icon></button><b class="num" aria-label=${v("יעד")}>${ae(t.target)}</b><button type="button" aria-label=${v("העלה")} ?disabled=${!t.spec||e.stale||e.busy===t.entityId} @click=${()=>s(1)}><sw-icon name="plus" size=${16}></sw-icon></button></span>`:h}</div>
    </div>`}renderOpenings(e,t){return c`<div class=${`sec${this.tab==="opens"?" cur":""}`} data-tab="opens" data-room-openings>
      <h3>${v("דלתות, חלונות ותריסים")}</h3>
      ${e.openings.length?this.paged("opens",e.openings,t,s=>c`<div class=${`r${s.open?" open":""}${s.forbidden?" forbidden":""}`} data-room-opening=${s.entityId}><sw-icon name=${s.icon} size=${18}></sw-icon><span class="l">${s.label}</span><span class="st">${s.forbidden?v("אין הרשאה"):s.words}</span>
            ${s.spec&&!s.forbidden?c`<button type="button" class=${`do${s.spec.sensitive?" sens":""}`} data-room-opening-action=${s.spec.id} ?disabled=${e.stale||e.busy===s.entityId} @click=${()=>this.run(s.entityId,s.spec)}>${s.spec.label}</button>`:h}</div>`):c`<div class="empty">${v("אין דלתות או חלונות עם חיישן בחדר")}</div>`}
    </div>`}render(){const e=this.model;if(!e)return h;const t=this.place==="sheet",s=t?Ze:this.rows,a=e.lights.filter(i=>i.on).length;return c`
      <button type="button" class="grab" aria-label=${this.sheet==="full"?v("הקטן את הכרטיס"):v("הגדל את הכרטיס")} @click=${()=>this.sheet=this.sheet==="full"?"peek":"full"}></button>
      <header>
        <div>
          <h2>${e.name||v("חדר")}</h2>
          <div class="sub">${e.levelName}</div>
          <div class="tags">
            ${e.presence?c`<span class="tag pres"><sw-icon name="user" size=${13}></sw-icon>${v("נוכחות עכשיו")}</span>`:e.quietMin!==null?c`<span class="tag">${v("אין תנועה {quietMin} דק׳",{quietMin:e.quietMin})}</span>`:h}
            ${e.open?c`<span class="tag open">${e.open===1?v("פתוח 1"):v("{open} פתוחים",{open:e.open})}</span>`:h}
          </div>
        </div>
        <button type="button" class="x" aria-label=${v("סגור")} data-room-close @click=${()=>this.emit("room-card-close",{})}><sw-icon name="close" size=${18}></sw-icon></button>
      </header>
      <div class="quick">
        <button type="button" class=${a?"on":""} @click=${()=>this.openTab("lights")}><sw-icon name="light" size=${18}></sw-icon>${v("אורות")} <span class="num">${a}/${e.lights.length}</span></button>
        <button type="button" @click=${()=>this.openTab("climate")}><sw-icon name="thermometer" size=${18}></sw-icon><span class="num">${e.climate?.now!=null?ae(e.climate.now):"—"}</span></button>
        <button type="button" class=${e.open?"al":""} @click=${()=>this.openTab("opens")}><sw-icon name="door" size=${18}></sw-icon>${e.open?e.open===1?v("פתוח 1"):v("{open} פתוחים",{open:e.open}):v("סגור")}</button>
        <button type="button" ?disabled=${!e.cameras.length||this.camera==="none"} @click=${()=>this.openTab("cam")}><sw-icon name="camera" size=${18}></sw-icon>${v("מצלמה")}</button>
      </div>
      <div class="tabs" role="tablist">${[["lights",v("אורות")],["climate",v("אקלים")],["opens",v("פתחים")],["cam",v("מצלמה")]].map(([i,n])=>c`<button type="button" role="tab" aria-pressed=${this.tab===i?"true":"false"} @click=${()=>this.tab=i}>${n}</button>`)}</div>
      <div class="body">
        ${t?c`<div data-tab="cam" class=${this.tab==="cam"?"cur":""}>${this.renderCamera(e)}</div>`:this.renderCamera(e)}
        ${this.renderLights(e,t?s+1:s)}
        ${this.renderClimate(e)}
        ${this.renderOpenings(e,t?s:Math.max(2,s-1))}
      </div>
      <footer>
        ${e.areaHref?c`<a class="pri" href=${e.areaHref} data-room-open-area>${v("לעמוד החדר")}</a>`:h}
        <button type="button" data-room-recordings ?disabled=${!e.cameras.length} @click=${()=>e.cameras[0]&&this.emit("room-card-recordings",{id:e.cameras[0].id})}><sw-icon name="history" size=${16}></sw-icon>${v("הקלטות")}</button>
      </footer>
    `}};T.styles=ce`
    :host {
      position: absolute;
      z-index: var(--sw-z-map-ui);
      direction: rtl;
      display: flex;
      flex-direction: column;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xl);
      box-shadow: var(--sw-shadow-3);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      box-sizing: border-box;
    }
    :host([place='side']) {
      inset-block: 12px;
      inset-inline-end: 12px;
      inline-size: min(360px, calc(100% - 24px));
      animation: side-in 300ms var(--sw-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
    }
    :host([place='float']) {
      inset-block-start: 12px;
      inset-inline-end: 12px;
      inline-size: min(320px, calc(100% - 24px));
      max-block-size: calc(100% - 24px);
      animation: pop-in 180ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
      transform-origin: top left;
    }
    :host([place='sheet']) {
      inset-inline: 0;
      inset-block-end: 0;
      block-size: 47%;
      border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0;
      border-inline: 0;
      border-block-end: 0;
      padding-block-end: env(safe-area-inset-bottom);
      animation: sheet-in 320ms var(--sw-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
      transition: block-size 260ms var(--sw-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
    }
    :host([place='sheet'][sheet='full']) {
      block-size: 86%;
    }
    /* OVERLAY-FADE-2520: the card arrives by translate / scale only - its texts are at full contrast from the first frame */
    @keyframes side-in {
      from {
        translate: -16px 0;
      }
    }
    @keyframes pop-in {
      from {
        scale: 0.97;
      }
    }
    @keyframes sheet-in {
      from {
        translate: 0 100%;
      }
    }
    /* reduced motion: nothing travels and nothing fades (it used to cross-fade in, below contrast) - the card is simply there */
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none !important;
        transition: none !important;
      }
    }
    button,
    footer a {
      font: inherit;
      color: inherit;
      cursor: pointer;
      transition: scale 120ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .grab {
      display: none;
      flex: none;
      inline-size: 100%;
      block-size: 22px;
      border: 0;
      background: none;
      padding: 0;
      touch-action: none;
    }
    .grab::after {
      content: '';
      display: block;
      inline-size: 40px;
      block-size: 5px;
      margin: 8px auto 0;
      border-radius: 3px;
      background: var(--sw-border-strong);
    }
    :host([place='sheet']) .grab {
      display: block;
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 14px 8px 16px;
      flex: none;
    }
    :host([place='sheet']) header {
      padding-block: 4px 6px;
    }
    h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .sub {
      margin-block-start: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 6px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      block-size: 22px;
      padding-inline: 8px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
      color: var(--sw-text-2);
    }
    .tag.pres {
      color: var(--sw-accent-text);
    }
    .tag.open {
      color: var(--sw-danger-text);
    }
    .x {
      margin-inline-start: auto;
      flex: none;
      inline-size: 36px;
      block-size: 36px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      color: var(--sw-text-2);
    }
    @media (hover: hover) and (pointer: fine) {
      .x:hover,
      .act:hover,
      .pager button:hover {
        background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
      }
    }
    .quick {
      display: none;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 0 12px 8px;
      flex: none;
    }
    :host([place='sheet']) .quick {
      display: grid;
    }
    .quick button {
      display: grid;
      justify-items: center;
      gap: 2px;
      min-block-size: 52px;
      padding: 6px 4px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      color: var(--sw-text-2);
    }
    .quick button:disabled,
    footer button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .quick button.on {
      color: var(--sw-warning-text);
    }
    .quick button.al {
      color: var(--sw-danger-text);
    }
    .tabs {
      display: none;
      gap: 4px;
      padding: 0 12px 6px;
      flex: none;
    }
    :host([place='sheet'][sheet='full']) .tabs {
      display: flex;
    }
    .tabs button {
      flex: 1;
      block-size: 40px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .tabs button[aria-pressed='true'] {
      background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
      color: var(--sw-accent-text);
      font-weight: 700;
    }
    .body {
      flex: 1;
      min-block-size: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    /* the sheet: the low sheet shows what is open, the full one the chosen tab */
    :host([place='sheet']) [data-tab] {
      display: none;
    }
    :host([place='sheet'][sheet='peek']) [data-tab='opens'],
    :host([place='sheet'][sheet='full']) [data-tab].cur {
      display: block;
    }
    .still {
      position: relative;
      margin: 0 12px 4px;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-video-bg);
      direction: ltr;
      flex: none;
      border: 0;
      padding: 0;
      inline-size: calc(100% - 24px);
      display: block;
    }
    .still img,
    .still sw-live-player {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .still .cap {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      direction: rtl;
      display: flex;
      gap: 8px;
      padding: 18px 10px 7px;
      background: linear-gradient(transparent, var(--sw-video-scrim));
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      text-align: start;
    }
    .still .cap span:last-child {
      margin-inline-start: auto;
      opacity: 0.85;
      font-weight: 500;
    }
    .still .none {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-on-video-2);
      direction: rtl;
      font-size: var(--sw-fs-xs);
    }
    .sec {
      padding: 6px 16px 0;
    }
    :host([place='sheet']) .sec {
      padding-inline: 14px;
    }
    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 28px;
      margin: 0;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--sw-text-2);
    }
    .act {
      margin-inline-start: auto;
      block-size: 28px;
      padding-inline: 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: var(--sw-menu-surface);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
    }
    .r {
      display: flex;
      align-items: center;
      gap: 10px;
      block-size: 40px;
    }
    :host([place='sheet']) .r {
      block-size: 44px;
    }
    .r > sw-icon {
      color: var(--sw-text-2);
      flex: none;
    }
    .r.lit > sw-icon {
      color: var(--sw-warning-text);
    }
    .r.open > sw-icon,
    .r.open .st {
      color: var(--sw-danger-text);
    }
    .r .l {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .r .st {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .r .no {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .r.forbidden {
      opacity: 0.6;
    }
    .r .do {
      min-block-size: 32px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-menu-surface);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
    }
    .r .do:disabled,
    .step button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .r .do.sens {
      color: var(--sw-danger-text);
    }
    .climate {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 48px;
    }
    .climate .now {
      font-size: var(--sw-fs-2xl);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .climate .now small {
      margin-inline-start: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: 500;
      color: var(--sw-text-2);
    }
    .step {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .step button {
      inline-size: 36px;
      block-size: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
    }
    .step b {
      min-inline-size: 40px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .num {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      block-size: 28px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .pager button {
      inline-size: 28px;
      block-size: 28px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: var(--sw-menu-surface);
    }
    .empty {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      padding-block: 6px;
    }
    footer {
      margin-block-start: auto;
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      border-block-start: 1px solid var(--sw-border-strong);
      flex: none;
    }
    :host([place='sheet'][sheet='peek']) footer {
      display: none;
    }
    footer a,
    footer button {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      block-size: 40px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      text-decoration: none;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-menu-surface);
      color: var(--sw-text);
    }
    footer .pri {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .pri:active,
    .do:active,
    .quick button:active {
      scale: 0.97;
    }
  `;E([O({attribute:!1})],T.prototype,"model",2);E([O({reflect:!0})],T.prototype,"place",2);E([O()],T.prototype,"camera",2);E([O({reflect:!0})],T.prototype,"sheet",2);E([m()],T.prototype,"tab",2);E([m()],T.prototype,"pages",2);E([m()],T.prototype,"liveOn",2);E([m()],T.prototype,"bust",2);E([m()],T.prototype,"rows",2);T=E([he("sw-room-card")],T);function We(e,t){const s=e.state==="on",a=e.actions.find(n=>n.id.endsWith(s?"turn_off":"turn_on"))??null,i=e.can_control?e.available?a?a.granted===!1?A("נדרשת הרשאה נפרדת: {grant}",{grant:a.grant??""}):t.busy?A("פעולה על המפסק כבר בדרך"):t.stale?A("המפה אינה מעודכנת — השליטה חוזרת עם החידוש"):null:A("אין פעולה מותרת למפסק הזה"):A("המפסק אינו זמין"):A("אין הרשאת שליטה בישויות בקומה");return{spec:a,blocked:i!==null,why:i}}var ui=Object.defineProperty,mi=Object.getOwnPropertyDescriptor,ue=(e,t,s,a)=>{for(var i=a>1?void 0:a?mi(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&ui(t,s,i),i};function fi(e,t,s="",a=null){window.dispatchEvent(new CustomEvent(Je,{detail:{target:{id:e,kind:"generic",name:t,state:s,tracked:!1},tab:"tickets",opener:a}}))}let W=class extends de{constructor(){super(...arguments),this.entityId="",this.count=0,this.token=0,this.offNames=null}connectedCallback(){super.connectedCallback(),this.offNames=Xe(()=>this.requestUpdate())}disconnectedCallback(){super.disconnectedCallback(),this.offNames?.(),this.token++}willUpdate(e){e.has("entityId")&&this.load()}async load(){const e=++this.token;if(this.count=0,!(!this.entityId||!ne()))try{const t=await Rs().byEntity(this.entityId);e===this.token&&(this.count=t.open_count)}catch{}}render(){return this.count?c`<span class="chip" role="img" aria-label=${re("countChip",{n:this.count})} title=${re("countChip",{n:this.count})} data-ticket-count=${this.count}>${Bs("ticket")}<bdi>${this.count}</bdi></span>`:h}};W.styles=ce`
    :host { display: inline-flex; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: var(--sw-r-pill); background: var(--sw-warning-soft); color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); font-variant-numeric: tabular-nums; line-height: 1.6;
    }
    .chip svg { inline-size: 1.1em; block-size: 1.1em; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  `;ue([O({attribute:"entity-id"})],W.prototype,"entityId",2);ue([m()],W.prototype,"count",2);W=ue([he("ticket-count-chip")],W);var bi=Object.defineProperty,wi=Object.getOwnPropertyDescriptor,u=(e,t,s,a)=>{for(var i=a>1?void 0:a?wi(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&bi(t,s,i),i};const vi={off:o("כבוי"),heat:o("חימום"),cool:o("קירור"),heat_cool:o("חימום/קירור"),auto:o("אוטומטי"),dry:o("ייבוש"),fan_only:o("מאוורר בלבד")},gi=[{id:"cameras",icon:"camera",label:()=>x("floor.cameras")},{id:"doors",icon:"door",label:()=>x("floor.doors")},{id:"lights",icon:"light",label:()=>x("floor.lights")},{id:"sensors",icon:"sensor",label:()=>x("floor.sensors")},{id:"zones",icon:"map",label:()=>o("חדרים ואזורים")},{id:"structure",icon:"wall",label:()=>o("מבנה")},{id:"objects",icon:"grid",label:()=>o("עצמים")},{id:"connectors",icon:"stairs",label:()=>o("מחברים")},{id:"states",icon:"activity",label:()=>o("מצבי חדרים")},{id:"photo",icon:"image",label:()=>o("תמונת הקומה")}],yi=Ge,Ue=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"],xi=new Set(["door","garage","garage_door","gate"]);function $i(){try{const e=localStorage.getItem(Ye);return e==="closed"||e==="open"?e:Ve}catch{return Ve}}function ki(e){const t=e.match(/-?\d+/);return t?t[0]:/קרקע/.test(e)?o("ק"):/גג/.test(e)?o("גג"):/מרתף/.test(e)?o("מ"):(e.split(/[\s–-]+/).filter(Boolean).pop()??e).slice(0,4)}let p=class extends de{constructor(){super(...arguments),this.phone=new Qe(this),this.floorId="f0",this.screenState="ready",this.focusZone="",this.focusCamera="",this.focusEntity="",this.focusObject="",this.picksParam="",this.embedded=!1,this.compact=!1,this.otherBundles={},this.sheetTall=!1,this.focusedObjectId=null,this.selectedZoneId=null,this.bundle=null,this.standaloneIds=new Set,this.tree=null,this.loadError="",this.noFloors=!1,this.selectedId=null,this.ticketFor=null,this.anchor=null,this.layers=new Set(pe),this.planImage=!0,this.catalogLookup=null,this.levelFilter=null,this.r28=null,this.stackMode=$i(),this.stackFocus=null,this.roomConfirm=null,this.r28Memo=null,this.roomsMemo=null,this.geometry=null,this.view3d=!1,this.default3d=!1,this.threeState="idle",this.threeError="",this.preset3d="iso",this.walk3d=!1,this.real3d=!1,this.corner3d=null,this.materials3d=null,this.quality3d=null,this.catalog3d=null,this.itemNames=new Map,this.sceneMemo=null,this.sceneTimer=0,this.sceneDue=!1,this.geomSeq=0,this.presenceFade=Dt,this.liveTransport=null,this.stateNow=Date.now(),this.fadeTimer=0,this.stateFacts=null,this.roomStateMemo=null,this.loads=new Js,this.refMemos=new Map,this.pinned=!1,this.panel=!1,this.multi=!1,this.sideList=(()=>{try{return localStorage.getItem("sw.map.sidelist")==="1"}catch{return!1}})(),this.jumpZoom=(()=>{try{return localStorage.getItem("sw.map.jumpzoom")==="1"}catch{return!1}})(),this.focusZoom=!0,this.focusZoomTimer=0,this.saveView=null,this.savedView=null,this.picked=[],this.narrow=!1,this.syncConnected=!0,this.action=null,this.confirmSpec=null,this.stopWs=null,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.narrow=this.mq.matches,this.onKey=e=>{if(!(this.embedded&&e.key==="3")){if(e.key==="3"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!Xt(e.composedPath()[0])){if(this.confirmSpec||this.saveView||e.repeat)return;e.preventDefault(),this.toggle3d();return}if(e.key==="Escape"&&!this.confirmSpec)if(this.selectedId){const t=this.selectedId;this.close(),this.shows3d||this.canvas?.focusMarker(t)}else this.panel&&(this.panel=!1)}},this.offScreenEdit=null,this.presenceSnap=null,this.presenceTimer=0,this.hudKey="",this.hudRo=null,this.wallSearch=null,this.wallPins=ws,this.actionArgs={},this.renaming=null,this.notice="",this.incidentBusy=!1,this.skinBusy=!1,this.skinNote="",this.stillsFallback=!1,this.bakeBusy=!1,this.bakeNote="",this.viewDials=ys,this.stillsSite=Ee(null),this.otherBundlesFor="",this.autoBaked=new Set}memo(e,t,s){let a=this.refMemos.get(e);return a||this.refMemos.set(e,a=new ti),a.get(t,s)}async loadPresence(){try{this.presenceSnap=await et()}catch{}}connectedCallback(){super.connectedCallback(),F()&&tt("presence.building.view")&&(this.loadPresence(),this.presenceTimer=window.setInterval(()=>{document.hidden||this.loadPresence()},st)),this.offScreenEdit=it({id:"floor-map-edit",label:o("עריכת המפה"),icon:"edit",can:()=>!at("structure")&&(this.bundle?this.bundle.permissions.edit:!F()),run:()=>z(`/explore/floors/${this.floorId}/edit`)}),this.narrow=this.mq.matches,this.mq.addEventListener("change",this.onMq),window.addEventListener("keydown",this.onKey),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.presenceTimer),this.offScreenEdit?.(),this.offScreenEdit=null,window.removeEventListener("keydown",this.onKey),this.mq.removeEventListener("change",this.onMq),window.clearTimeout(this.sceneTimer),this.sceneTimer=0,window.clearTimeout(this.fadeTimer),this.fadeTimer=0,window.clearTimeout(this.focusZoomTimer),this.focusZoomTimer=0,this.focusZoom=!0,this.stopWs?.(),this.stopWs=null,this.hudRo?.disconnect(),this.hudRo=null,this.hudKey=""}syncHud(e=!1){const t=this.stage;if(!t)return;!this.hudRo&&typeof ResizeObserver<"u"&&(this.hudRo=new ResizeObserver(()=>this.syncHud(!0)),this.hudRo.observe(t));const s=this.bundle,a=window.innerWidth,i=this.shows3d?this.corner3d:null,n=this.sideList&&s?.source==="api",r=[a,i??"-",this.shows3d,n,this.panel,this.sheetTall,s?.floorName??"",s?.levels.map(b=>`${b.name}${b.elevation_m}`).join(",")??"",Object.keys(s?.circuitStates??{}).length].join("|");if(!e&&r===this.hudKey)return;this.hudKey=r;const d=Ss({sideList:n,panel:this.panel,viewport:a}),l=this.renderRoot.querySelector(".levelbar"),f=this.renderRoot.querySelector("[data-floorchip]"),w=this.renderRoot.querySelector("[data-circuit-strip]");l&&this.hudRo?.observe(l);const $=!!l&&zs({stage:t.clientWidth,end:d,bar:this.barLineWidth(l),chip:f?.offsetWidth??0,endItem:Is(i,w?.offsetWidth??0)});t.toggleAttribute("data-hud-row2",$),i?t.setAttribute("data-corner",i):t.removeAttribute("data-corner"),d===C?t.style.removeProperty("--hud-end"):t.style.setProperty("--hud-end",`${d}px`);const S=Cs({sideList:n,viewport:a,tall:this.sheetTall});S?t.style.setProperty("--hud-bottom",S):t.style.removeProperty("--hud-bottom"),l&&t.style.setProperty("--hud-bar-h",`${Math.ceil(l.offsetHeight)}px`);const g=!this.shows3d&&n&&d!==C?this.canvas?.zoomDockRect()??null:null;g?t.style.setProperty("--hud-list-bottom",`${Ls(t.getBoundingClientRect().top+t.clientTop+t.clientHeight-g.top)}px`):t.style.removeProperty("--hud-list-bottom")}barLineWidth(e){const t=e.style.whiteSpace;e.style.whiteSpace="nowrap";const s=e.scrollWidth+2;return e.style.whiteSpace=t,s}startWs(){this.stopWs||!F()||(this.stopWs=ot(e=>{const t=this.bundle;if(e.type==="entity_state_changed"&&t){const s=e.entity.entity_id,a=Object.values(t.circuitStates).some(i=>i.entity_id===s);if(!a&&!t.anchors.some(i=>i.resource_type==="ha_entity"&&i.resource_id===s))return;this.stateNow=Date.now(),this.bundle={...t,anchors:t.anchors.map(i=>i.resource_type==="ha_entity"&&i.resource_id===s?{...i,entity:{...i.entity??{},...e.entity,actions:i.entity?.actions}}:i),circuitStates:a?Object.fromEntries(Object.entries(t.circuitStates).map(([i,n])=>[i,n.entity_id===s?{...n,state:e.entity.state,fresh:e.entity.fresh,available:e.entity.available}:n])):t.circuitStates}}else e.type==="ha_sync_state"?this.syncConnected=e.connected:e.type==="heartbeat"&&(this.syncConnected=e.sync.connected)}))}updated(e){this.syncHud(),this.scheduleFadeTick(this.bundle&&this.layers.has("states")?this.roomStateLayer:null),Qt(this.default3d,this.view3d,this.hasScene)&&(this.default3d=!1,this.toggle3d()),this.view3d&&this.loadOtherBundles(),(e.has("picked")||e.has("multi"))&&this.syncPicksRoute(),e.has("floorId")&&e.get("floorId")!==void 0?(this.resetFloorState(),this.load()):(e.has("focusZone")||e.has("focusCamera")||e.has("focusEntity")||e.has("focusObject"))&&this.bundle?this.applyFocus():e.has("picksParam")&&e.get("picksParam")!==void 0&&this.bundle&&this.applyPicksParam()}resetFloorState(){this.selectedId=null,this.anchor=null,this.selectedZoneId=null,this.focusedObjectId=null,this.action=null,this.renaming=null,this.notice="",!this.picksParam&&this.picked.length&&(this.picked=[])}willUpdate(e){e.has("selectedId")&&this.notice&&(this.notice="")}picksValue(){return this.multi?ie(this.picked):""}syncPicksRoute(){if(!F()||this.embedded||!this.bundle)return;const e=new URL(window.location.href).hash.replace(/^#/,""),[t,s=""]=e.split("?");if(t!==`/explore/floors/${this.floorId}`)return;const a=new URLSearchParams(s),i=this.picksValue();(a.get("picks")??"")!==i&&(i?a.set("picks",i):a.delete("picks"),nt(t,a))}applyPicksParam(){if(!this.bundle||!this.picksParam)return;const t=new Set(this.cameraAnchors().map(a=>a.id)),s=Ys(this.picksParam,t);ie(s)===ie(this.picked)&&this.multi||(this.multi||this.setMulti(!0),this.picked=s)}viewKey(){return`sw.map.view.${this.floorId}`}rememberView(){const e=this.canvas?.getView();if(e)try{sessionStorage.setItem(this.viewKey(),JSON.stringify(e))}catch{}}async restoreView(){let e=null;try{e=sessionStorage.getItem(this.viewKey())}catch{return}if(!e)return;await this.updateComplete;const t=this.canvas;if(!(!t||this.shows3d))try{const s=JSON.parse(e);t.setView(s)}catch{}}get adjacentSuggestions(){const e=this.bundle;return!e||!this.multi||!this.picked.length?[]:Gs(this.picked,this.cameraAnchors().map(t=>({id:t.id,position:t.position})),e.zones.map(t=>({id:t.id,name:t.name,polygon:t.polygon}))).slice(0,8)}async applyFocus(){const e=this.bundle;if(!e||!this.focusZone&&!this.focusCamera&&!this.focusEntity&&!this.focusObject)return;await this.updateComplete;const t=this.shows3d?void 0:this.canvas,s=this.focusZone?e.zones.find(i=>i.id===this.focusZone):null;if(s){const i=s.polygon.map(r=>r.x),n=s.polygon.map(r=>r.y);this.selectedZoneId=s.id,t?.zoomToBox(Math.min(...i),Math.min(...n),Math.max(...i),Math.max(...n))}const a=this.focusCamera?e.anchors.find(i=>i.resource_type==="camera"&&i.resource_id===this.focusCamera):this.focusEntity?e.anchors.find(i=>i.resource_type==="ha_entity"&&i.resource_id===this.focusEntity):null;if(a){t&&(this.focusZoom?t.zoomToBox(a.position.x-.15,a.position.y-.15,a.position.x+.15,a.position.y+.15,48,2.2):t.centerOn(a.position.x,a.position.y),await this.updateComplete);const i=t?.toScreen(a.position.x,a.position.y)??null;this.selectedId=a.id,this.anchor=i?{x:i.x,y:i.y}:null}if(this.focusObject){const i=this.geometry?.objects.find(n=>n.id===this.focusObject);if(!i)return;this.focusedObjectId=i.id,t?.centerOn(i.position[0],i.position[1])}}async load(){const e=this.loads.begin();this.loadError="";try{let t=this.tree??await me();if(e()||F()&&this.tree&&!fe(t,this.floorId)&&(t=await me(),e()))return;if(this.tree=t,F()&&!fe(t,this.floorId)){const n=await Y().catch(()=>null);if(e())return;const r=rt(t,n?.["map.default_floor"]);if(r&&r.id!==this.floorId){z(`/explore/floors/${r.id}`);return}if(!r){this.noFloors=!0,this.bundle=null;return}}this.noFloors=!1,this.restoreLayers(),this.restorePlanImage(),this.levelFilter=null;const s=await J(this.floorId);if(e())return;if(K()&&be("cameras_available")){const n=await lt().catch(()=>({cameras:[]}));if(e())return;this.standaloneIds=new Set(n.cameras.filter(X).map(r=>r.id))}else this.standaloneIds=new Set;this.bundle=K()?{...s,anchors:ct(s.anchors,!1,this.standaloneIds)}:s;const a=this.bundle;Y().then(n=>{e()||(this.levelFilter=Nt(n["plan.levels"],a)),e()||(this.default3d=(es(n)||this.keep3d())&&!this.view3d),this.quality3d=ls(n["plan.quality"]),this.r28=n,this.presenceFade=Rt(n["plan.presence_fade"]),this.liveTransport=we(n)}).then(()=>xs()).then(n=>{n&&(this.viewDials=n.effective,this.stillsSite=Ee(n.location))}).catch(()=>this.liveTransport=we(null));const i=++this.geomSeq;this.geometry=null,jt(this.bundle).then(n=>{i===this.geomSeq&&(this.geometry=n,this.maybeAutoBake(),this.focusObject&&this.applyFocus())}),this.bundle.source==="api"&&(this.startWs(),Jt(this.bundle.catalogRevision).then(n=>{const r=ts(n);this.catalogLookup=r.catalogLookup,this.catalog3d=r.catalog3d,this.materials3d=r.materials3d,this.itemNames=r.itemNames}).catch(()=>{})),this.applyFocus(),this.picksParam&&(this.applyPicksParam(),this.restoreView())}catch(t){if(e())return;this.loadError=j(t),this.bundle=null}}get buildingFloors(){return this.memo("buildingFloors",[this.tree,this.floorId],()=>this.computeBuildingFloors())}computeBuildingFloors(){if(this.tree?.source!=="api")return[];for(const e of this.tree.sites)for(const t of e.buildings??[]){const s=t.floors??[];if(!s.some(i=>i.id===this.floorId))continue;const a=s.map(i=>ki(i.name));return s.map((i,n)=>({id:i.id,name:i.name,hasPlan:i.has_plan,short:a.filter(r=>r===a[n]).length>1?`${a[n]}${n+1}`:a[n]}))}return[]}get floors(){return this.memo("floors",[this.tree],()=>this.computeFloors())}computeFloors(){return this.tree?.source==="api"?this.tree.sites.flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(s=>({id:s.id,name:`${t.name} · ${s.name}`,cameraCount:s.camera_count,hasPlan:s.has_plan})))):ve.map(e=>({id:e.id,name:e.name,cameraCount:e.cameraCount,hasPlan:e.hasPlan}))}get markers(){return this.memo("markers",[this.bundle,this.layers,this.levelFilter,this.screenState,this.syncConnected],()=>this.computeMarkers())}computeMarkers(){const e=this.bundle;if(!e)return[];const t=this.screenState==="stale";if(e.source==="demo"){const s=this.layers.has("cameras")?H.filter(i=>i.floorId===e.floorId).map(i=>({id:i.id,kind:"camera",label:i.name,x:i.x,y:i.y,rotation:i.rotation,fov:i.fov,state:i.state})):[],a=Q.filter(i=>i.floorId===e.floorId).filter(i=>i.domain==="lock"&&this.layers.has("doors")||i.domain==="light"&&this.layers.has("lights")||i.domain==="binary_sensor"&&this.layers.has("sensors")).map(i=>({id:i.id,kind:i.domain,label:i.name,x:i.x,y:i.y,state:t?"stale":"neutral"}));return[...s,...a]}return e.anchors.filter(s=>s.resource_type==="camera"?this.layers.has("cameras"):this.layers.has(s.layer_id==="doors"?"doors":s.layer_id==="lights"?"lights":"sensors")).filter(s=>Bt(e,s.level_id,this.levelFilter)).map(s=>({id:s.id,kind:s.resource_type==="camera"?"camera":dt(s.layer_id,s.entity?.domain),label:M(s),x:s.position.x,y:s.position.y,rotation:s.rotation_degrees,fov:s.field_of_view_degrees??void 0,radius:s.coverage_radius??void 0,polygon:s.coverage_polygon?s.coverage_polygon.map(([a,i])=>({x:a,y:i})):void 0,labelPos:s.label_pos??void 0,level:s.level_id??null,state:s.resource_type==="camera"?D(s):t?"stale":this.entityTone(s.entity)}))}get anchorPositions(){return this.memo("anchorPositions",[this.bundle],()=>this.computeAnchorPositions())}computeAnchorPositions(){const e={};for(const t of this.bundle?.anchors??[])e[`${t.resource_type}:${t.resource_id}`]={x:t.position.x,y:t.position.y,rotation:t.rotation_degrees};return e}get circuitStateMap(){return this.memo("circuitStateMap",[this.bundle],()=>this.computeCircuitStateMap())}computeCircuitStateMap(){return Object.fromEntries(Object.entries(this.bundle?.circuitStates??{}).map(([e,t])=>[e,t.state]))}get entityStateMap(){return this.memo("entityStateMap",[this.bundle],()=>this.computeEntityStateMap())}computeEntityStateMap(){const e={};for(const t of this.bundle?.anchors??[])t.resource_type==="ha_entity"&&(e[t.resource_id]=t.entity?.state??null);return e}stateFactsFor(e){const t=this.geometry;return t?(this.stateFacts=ei(this.stateFacts,t,e.width,e.height,this.catalogLookup),this.stateFacts):null}get roomStateLayer(){const e=this.bundle;if(!e||e.source!=="api"||!this.layers.has("states"))return null;const t=this.states3dStale,s=this.roomStateMemo;if(s&&s.bundle===e&&s.geometry===this.geometry&&s.catalog===this.catalogLookup&&s.layers===this.layers&&s.now===this.stateNow&&s.fade===this.presenceFade&&s.stale===t)return s.layer;const a=t?null:this.deriveRoomStates(e);return this.roomStateMemo={bundle:e,geometry:this.geometry,catalog:this.catalogLookup,layers:this.layers,now:this.stateNow,fade:this.presenceFade,stale:t,layer:a},a}deriveRoomStates(e){const t=this.stateFactsFor(e);if(!e.zones.length&&!t?.openings.length)return null;const s=this.circuitStates3d,a=this.entityStates3d,i=Yt(e.anchors,a),n=ss(t,s,a),r=is(e.zones),d=Ie(this.geometry,e);return qt({rooms:r,entities:i,openings:t?.openings??[],lamps:n,size:[e.width,e.height],scaleMPerPx:e.scaleMPerPx,now:this.stateNow,fade:this.presenceFade,levelOf:l=>l??d})}scheduleFadeTick(e){const t=!!e&&Object.values(e.rooms).some(a=>a.presenceFade>0&&!a.presence)||!!e&&Object.values(e.levels).some(a=>a.presence>0&&a.presence<1),s=Vt(this.presenceFade);if(!t||!s){window.clearTimeout(this.fadeTimer),this.fadeTimer=0;return}this.fadeTimer||(this.fadeTimer=window.setTimeout(()=>{this.fadeTimer=0,this.stateNow=Date.now()},s))}get states3dStale(){return this.screenState==="stale"||!this.syncConnected}get entityStates3d(){return this.memo("entityStates3d",[this.bundle,this.states3dStale],()=>this.computeEntityStates3d())}computeEntityStates3d(){const e=this.states3dStale,t={};for(const s of this.bundle?.anchors??[])s.resource_type==="ha_entity"&&(t[s.resource_id]=e||s.entity?.fresh===!1?null:s.entity?.state??null);return t}get circuitStates3d(){return this.memo("circuitStates3d",[this.bundle,this.states3dStale],()=>this.computeCircuitStates3d())}computeCircuitStates3d(){const e=this.states3dStale;return Object.fromEntries(Object.entries(this.bundle?.circuitStates??{}).map(([t,s])=>[t,e||s.fresh===!1?null:s.state]))}anchorShown(e){return e.resource_type==="camera"?this.layers.has("cameras"):this.layers.has(e.layer_id==="doors"?"doors":e.layer_id==="lights"?"lights":"sensors")}get sceneAnchors(){const e=this.bundle;return!e||e.source!=="api"?[]:e.anchors.filter(t=>this.anchorShown(t)&&(t.resource_type!=="camera"||D(t)!=="forbidden")).map(t=>this.sceneAnchor(t))}sceneAnchor(e){const t=this.entityStates3d;return{id:e.id,resource_type:e.resource_type,resource_id:e.resource_id,x:e.position.x,y:e.position.y,rotation:e.rotation_degrees,fov:e.field_of_view_degrees??null,radius:e.coverage_radius??null,polygon:e.coverage_polygon??null,level_id:e.level_id??null,layer_id:e.layer_id,label:M(e),state:e.resource_type==="ha_entity"?t[e.resource_id]??null:null,online:e.resource_type==="camera"&&e.camera?e.camera.status==="online":null,mount_height_m:e.mount_height_m??null,tilt_deg:e.tilt_deg??null,...e.resource_type==="ha_entity"&&e.entity?{entity_meta:Ce(e.entity)}:{}}}async exportControlImages(){const e=this.bundle,t=this.renderRoot.querySelector("sw-plan-3d");if(!(!e||e.source!=="api"||!this.geometry||!t||this.skinBusy)){this.skinBusy=!0;try{const s=await Ds(e.floorId);if(!s.geometry_key){this.skinNote=o("לקומה אין מבנה מפורסם — תמונת בקרה נוצרת מהמבנה המפורסם בלבד.");return}if(e.geometryRef?.doc_hash!==s.doc_hash){this.skinNote=o("המפה מציגה מבנה שאינו המבנה המפורסם (טיוטה) — תמונת בקרה נוצרת מהמבנה המפורסם בלבד.");return}const a={doc:this.geometry,width:e.width,height:e.height,entityStates:{},circuitStates:{},catalog:this.catalog3d,anchors:[],zones:te(e.zones)};let i=0;for(const n of Pe){const r=t.captureControl($s(se(ks(a,n)),n));if(!r)throw new Error(o("צילום תמונת הבקרה נכשל (WebGL)."));(await Ns(e.floorId,n,s.geometry_key,r)).identical&&i++}this.skinNote=o("תמונות הבקרה (אורות כבויים / דולקים) נשמרו במתקן בלבד{v}; שום דבר לא נשלח לספק.",{v:i===Pe.length?o(" — זהות לשמורות"):""})}catch(s){this.skinNote=j(s)}finally{this.skinBusy=!1}}}sceneStructureKeys(e){const t=e.source==="api"?e.anchors.map(s=>[s.id,s.revision,s.position.x,s.position.y,s.rotation_degrees,s.field_of_view_degrees,s.coverage_radius,s.coverage_polygon?.length,s.level_id,s.layer_id,s.mount_height_m,s.tilt_deg,M(s)].join("|")).join(";"):"";return[e.floorId,e.width,e.height,t,e.zones,this.geometry,this.layers,this.catalog3d,this.itemNames,this.screenState]}sceneStatesKey(e,t){if(e.source==="demo")return"";const s=e.anchors.filter(i=>i.resource_type==="camera").map(i=>`${i.id}:${i.camera?.status??""}`).join(","),a=e.anchors.filter(i=>i.resource_type==="ha_entity"&&i.entity).map(i=>[i.id,Ce(i.entity)]);return JSON.stringify([this.entityStates3d,this.circuitStates3d,s,this.syncConnected,Ht(t),a])}get hasScene(){const e=this.bundle;return e?e.source==="demo"?!!ve.find(t=>t.id===e.floorId)?.hasPlan&&ht(e.floorId).length>0:this.geometry!==null:!1}scene3d(){const e=this.bundle;if(!e||!this.hasScene)return null;const t=this.sceneStructureKeys(e),s=[...t,this.levelFilter,this.walk3d,this.real3d],a=this.roomStateLayer,i=this.sceneStatesKey(e,a),n=this.sceneMemo,r=!!n&&n.structure.length===s.length&&n.structure.every((k,L)=>k===s[L]),d=!!n&&n.structureAll.length===t.length&&n.structureAll.every((k,L)=>k===t[L]);if(n&&r&&n.states===i)return n;if(n&&r&&!this.sceneDue)return this.sceneTimer||(this.sceneTimer=window.setTimeout(()=>{this.sceneTimer=0,this.sceneDue=!0,this.view3d&&this.requestUpdate()},100)),n;let l=null;const f=this.states3dStale,w=k=>f?Object.fromEntries(Object.keys(k).map(L=>[L,null])):k;let $=[];const S={};if(e.source==="demo"){const k=Ot(e.floorId),L=new Set(H.filter(_=>_.floorId===e.floorId&&_.state==="forbidden").map(_=>_.id));k&&(l={...k,entityStates:w(k.entityStates),circuitStates:w(k.circuitStates),anchors:k.anchors.filter(_=>this.anchorShown(_)&&!L.has(_.id)).map(_=>f?{..._,state:null}:_)}),$=this.layers.has("cameras")?H.filter(_=>_.floorId===e.floorId&&!L.has(_.id)).map(_=>({id:_.id,label:_.name})):[],Object.assign(S,Lt(e.floorId))}else this.geometry&&(l={doc:this.geometry,width:e.width,height:e.height,anchors:this.sceneAnchors,entityStates:this.entityStates3d,circuitStates:this.circuitStates3d,catalog:this.catalog3d,zones:te(e.zones)},$=e.anchors.filter(k=>k.resource_type==="camera"&&this.layers.has("cameras")&&D(k)!=="forbidden").map(k=>({id:k.id,label:M(k)})),Object.assign(S,as(e.anchors,M,this.geometry.objects,this.itemNames,e.zones)));if(!l)return null;const g={structure:this.layers.has("structure"),objects:this.layers.has("objects"),connectors:this.layers.has("connectors"),zones:this.layers.has("zones")},b=se({...l,level:this.levelFilter,layers:g,roomStates:a,walk:this.walk3d,realistic:this.real3d,materialsCatalog:this.materials3d}),I=n&&r&&si(n.desc,b)?n.desc:b,y=n&&d?n.all:se({...l,level:null,layers:g,roomStates:null});return this.sceneMemo={structure:s,structureAll:t,states:i,desc:I,all:y,cameras:$,labels:S},this.sceneDue=!1,window.clearTimeout(this.sceneTimer),this.sceneTimer=0,this.sceneMemo}get shows3d(){return this.view3d&&(this.threeState==="ready"&&this.hasScene||this.stillsOnly)}get can3d(){return R()&&this.hasScene||this.stillsOnly}get stillsOnly(){return!R()&&Oe(this.bundle,Le(this.bundle,this.levelFilter))}onWalkChange(e){this.walk3d!==e&&(this.walk3d=e,this.sceneDue=!0)}async toggle3d(){if(this.shows3d){this.walk3d=!1,this.view3d=!1,await this.updateComplete,this.onViewChange();return}if(!(!this.can3d||this.threeState==="loading")){if(this.stillsOnly){this.anchor=null,this.view3d=!0;return}if(this.threeState!=="ready"){this.threeState="loading";const e=await os();if(e!==null){this.threeState="error",this.threeError=e;return}this.threeState="ready"}this.can3d&&(this.anchor=null,this.sceneDue=!0,this.view3d=!0)}}get sel3d(){return this.selectedId??this.focusedObjectId??this.selectedZoneId}onPartSelect(e){const{id:t,kind:s}=e.detail,a=this.bundle;if(!t||!s||!a){if(this.multi)return;this.close(),this.focusedObjectId=null,this.selectedZoneId=null;return}if(this.multi&&s!=="zone"){const n=a.anchors.find(r=>r.id===t);s==="camera"&&n?.resource_type==="camera"&&this.togglePick(n.id);return}if(s==="object"){const n=this.geometry?.circuits.find(d=>d.member_ids.includes(t)),r=n?a.circuitStates[n.id]:void 0;if(r){const d=We(r,{busy:!!this.action?.busy&&this.action.entityId===r.entity_id,stale:this.screenState==="stale"});d.spec&&!d.blocked&&this.trigger(r.entity_id,d.spec),this.close(),this.selectedZoneId=null,this.focusedObjectId=t;return}}const i=s==="zone"?null:_s({id:t,kind:s},this.geometry,a.anchors);if(i&&"anchor"in i){this.selectedZoneId=null,this.focusedObjectId=null,this.selectedId=i.anchor,this.anchor=null;return}if(i){this.close(),this.selectedZoneId=null,this.focusedObjectId=i.object;return}if(s==="zone"){if(this.multi){this.pickZone(t);return}this.focusedObjectId=null,this.onZoneSelect(t)}}wallPinsFor(e){return e!==this.wallSearch&&(this.wallSearch=e,this.wallPins=vs(e)),this.wallPins}get fallbackLevel(){return Ie(this.geometry,this.bundle)}pillAnchor(e,t){const s=t[e.resource_id]??null;return{id:e.id,resource_id:e.resource_id,domain:e.entity?.domain??e.resource_id.split(".")[0]??"",device_class:e.entity?.device_class??null,layer_id:e.layer_id,label:M(e),state:s,words:e.entity&&s!==null?Z({...e.entity,state:s}):"",x:e.position.x,y:e.position.y,level_id:e.level_id??null}}get roomSummaries(){const e=this.bundle;if(!e||e.source!=="api"||!this.layers.has("zones")||!e.zones.length)return[];const t=this.roomStateLayer,s=this.roomsMemo;if(s&&s.bundle===e&&s.layer===t&&s.layers===this.layers)return s.rooms;const a=this.entityStates3d,i=e.anchors.filter(d=>d.resource_type==="ha_entity"&&this.anchorShown(d)).map(d=>this.pillAnchor(d,a)),n=this.fallbackLevel,r=Os(te(e.zones),i,t,d=>d??n);return this.roomsMemo={bundle:e,layer:t,layers:this.layers,rooms:r},r}get stackShown(){return this.levelFilter===null&&(this.bundle?.levels.length??0)>1&&!this.walk3d}r28View(e,t){const s=Ae(this.r28),a=this.roomSummaries,i=this.stackShown&&this.stackMode==="open",n=[e,a,s.mode,s.quiet,i,this.stackFocus,this.stackShown,t.levels],r=this.r28Memo;if(r&&r.key.length===n.length&&r.key.every((b,I)=>b===n[I]))return r.out;const d=i?He(e,this.stackFocus):e,l=Fe(d,a,s),f=s.mode==="device"?Fe(d,a,{...s,mode:"room",quiet:"name"}).pills:l.pills,w=this.fallbackLevel,$=new Map(t.levels.map(b=>[b.id,b.name])),S=this.stackShown?ri(i?He(e,null):e,$,a,i?this.stackFocus:null,b=>b??w):[],g={desc:l.desc,pills:l.pills,anchors:f,tags:S,spread:i};return this.r28Memo={key:n,out:g},g}setStackMode(e){this.stackMode=e,this.stackFocus=null;try{localStorage.setItem(Ye,e)}catch{}}onStackLevel(e){const t=e.enter?{focus:null,enter:e.id}:li(qe(this.r28).pick,this.stackFocus,e.id);if(t.enter){this.stackFocus=null,this.levelFilter=t.enter;return}this.stackMode!=="open"&&(this.stackMode="open"),this.stackFocus=t.focus}renderStackSwitch(){if(!this.shows3d||!this.stackShown)return h;const e=this.stackMode==="open";return c`<span class="stackswitch" role="group" aria-label=${o("פריסת המפלסים")} data-stack-switch>
      <sw-chip icon="cube" data-stack-mode="closed" ?selected=${!e} @click=${()=>this.setStackMode("closed")}>${o("בניין")}</sw-chip>
      <sw-chip icon="layers" data-stack-mode="open" ?selected=${e} @click=${()=>this.setStackMode("open")}>${o("פרוס")}</sw-chip>
    </span>`}roomCardPlace(){const e=this.renderRoot.querySelector("[data-stage]")?.clientWidth??window.innerWidth,t=this.r28?.["map.room_card_place"];return e<=700||t==="sheet_tablet"&&e<=1100?"sheet":t==="float"?"float":"side"}roomCardInset(e){const t=this.renderRoot.querySelector("[data-stage]"),s=t?.clientWidth??window.innerWidth,a=t?.clientHeight??window.innerHeight;return e==="sheet"?{left:0,right:0,top:0,bottom:Math.round(a*.47)}:{left:Math.min(e==="float"?320:360,s-24)+24,right:0,top:0,bottom:0}}roomCardModel(e,t){const s=this.fallbackLevel,a=e.level_id??s,i=this.entityStates3d,n=t.anchors.filter(b=>(b.level_id??s)===a&&this.anchorShown(b)&&V(b.position,e.polygon)),r=this.roomStateLayer?.rooms[e.id],d=this.roomSummaries.find(b=>b.id===e.id),l=[],f=[];let w=null;const $=(b,...I)=>{for(const y of I){const k=b?.actions?.find(L=>L.id.endsWith(y));if(k)return k}return null};for(const b of n){if(b.resource_type!=="ha_entity")continue;const I=b.entity,y=i[b.resource_id]??null,k={id:b.resource_id,domain:I?.domain??b.resource_id.split(".")[0]??"",device_class:I?.device_class??null,layer_id:b.layer_id},L=I&&y!==null?Z({...I,state:y}):o("לא ידוע");if(Se(k)){const _=y==="on"?!0:y==="off"?!1:null,P=_===null?null:$(I,_?".turn_off":".turn_on",".toggle");l.push({entityId:b.resource_id,label:M(b),on:_,spec:P,forbidden:P?.granted===!1})}else if(ze(k)||k.domain==="cover"){const _=k.domain==="lock"?$(I,y==="locked"?".unlock":".lock"):k.domain==="cover"?$(I,y==="closed"?".open_cover":".close_cover"):null,P=k.domain==="lock"?"lock":k.device_class==="window"?"grid":k.domain==="cover"&&!xi.has(k.device_class??"")?"menu":"door",U=k.domain==="lock"?y==="unlocked"||y==="open":y==="on"||y==="open";f.push({entityId:b.resource_id,label:M(b),words:L,open:U,icon:P,spec:_,forbidden:_?.granted===!1})}else if(!w&&k.domain==="climate"&&I){const _=I.attributes??{},P=G=>typeof G=="number"&&Number.isFinite(G)?G:null,U=$(I,".set_temperature");w={entityId:b.resource_id,now:P(_.current_temperature),target:P(_.temperature),step:P(_.target_temp_step)||.5,min:P(_.min_temp)??5,max:P(_.max_temp)??35,spec:U?.granted===!1?null:U,words:L}}}!w&&r&&r.temperature!==null&&(w={entityId:null,now:r.temperature,target:null,step:1,min:0,max:0,spec:null,words:""});const S=n.filter(b=>b.resource_type==="camera"&&b.camera&&D(b)!=="forbidden").map(b=>({id:b.camera.id,label:M(b)})),g=t.levels.length>1?t.levels.find(b=>b.id===a)?.name??t.floorName:t.floorName;return{id:e.id,name:e.name,levelName:g,presence:!!r?.presence,quietMin:r&&!r.presence&&r.presenceAge!==null?Math.round(r.presenceAge/60):null,open:d?.open??r?.openings.length??0,lights:l,climate:w,openings:f,cameras:S,areaHref:e.area_id?`#/devices/areas/${encodeURIComponent(e.area_id)}`:null,busy:this.action?.busy?this.action.entityId:null,stale:this.screenState==="stale"}}onRoomAction(e){if(e.args)for(const[t,s]of Object.entries(e.args))this.actionArgs={...this.actionArgs,[`${e.spec.id}:${t}`]:String(s)};if(!e.spec.sensitive&&this.r28?.["map.room_card_confirm"]==="bulk"&&e.spec.id.endsWith(".close_cover")){this.roomConfirm={label:e.spec.label,items:[{entityId:e.entityId,spec:e.spec}]};return}this.trigger(e.entityId,e.spec)}onRoomBulk(e){if(this.r28?.["map.room_card_confirm"]==="bulk"){this.roomConfirm=e;return}this.runBulk(e)}async runBulk(e){this.roomConfirm=null;for(const t of e.items)t.spec.sensitive||await this.send(t.entityId,t.spec,!0)}renderRoomConfirm(){const e=this.roomConfirm;return e?c`<sw-dialog open heading=${`${e.label}?`} subheading=${e.items.length>1?o("{itemsCount} התקנים",{itemsCount:e.items.length}):""} @close=${()=>this.roomConfirm=null} data-room-confirm>
      <div style="font-size:var(--sw-fs-sm);line-height:1.5">${o("הפעולה תבוצע בזהות שלך ותירשם באודיט.")}</div>
      <div slot="footer"><sw-button variant="primary" @click=${()=>this.runBulk(e)}>${e.label}</sw-button><sw-button variant="ghost" @click=${()=>this.roomConfirm=null}>${x("actions.cancel")}</sw-button></div>
    </sw-dialog>`:h}render3d(e){const t=Le(e,this.levelFilter),s=Oe(e,t),a=typeof location<"u"?location.hash:"",i=a.includes("?")?a.slice(a.indexOf("?")):"",n=fs(i),r=gs(null,this.wallPinsFor(i),this.viewDials);if(bs({webgl:R(),wallDisplay:n,wallMode:r.mode,idle:!1,exhausted:this.stillsFallback,hasStills:s,want3d:!0})==="stills")return Me(e,t,this.roomStateLayer,this.viewDials,new Date,{autoBand:n,site:this.stillsSite});const l=this.scene3d();if(!l)return h;const f=this.r28View(l.desc,e),w=this.selectedZoneId&&!this.multi&&!this.embedded?f.anchors.find(y=>y.id===this.selectedZoneId):void 0,$=w?this.roomCardPlace():"side",S=w?{id:w.id,pos:w.pos,extent:w.extent,inset:this.roomCardInset($)}:null,g=qe(this.r28),b=new Date,I=`${b.getFullYear()}-${String(b.getMonth()+1).padStart(2,"0")}-${String(b.getDate()).padStart(2,"0")}`;return c`<sw-plan-3d data-floor-3d .description=${f.desc} .selectedId=${this.sel3d} .preset=${this.preset3d} .frameKey=${f.spread?`${e.floorId}|spread|${this.stackFocus??""}`:e.floorId} .cameras=${l.cameras} .labels=${l.labels}
      .roomPills=${f.pills} .pillPrefs=${Ae(this.r28)} .pillsHidden=${this.stackShown&&!(f.spread&&this.stackFocus)} .levelTags=${f.tags} .focusRoom=${S} .stackDark=${f.spread&&g.backdrop==="dark"} .stackLight=${f.spread&&g.backdrop==="light"}
      @room-open=${y=>{this.close(),this.focusedObjectId=null,this.selectedZoneId=y.detail.id}}
      @stack-level=${y=>this.onStackLevel(y.detail)}
      .levels=${e.levels.map(y=>({id:y.id,name:y.name,elevation_m:y.elevation_m}))} .activeLevel=${this.levelFilter} .thumbnailScene=${l.all} .qualityDefault=${this.quality3d} .levelDots=${this.roomStateLayer?.levels??{}}
      exportName=${`plan-3d-${e.floorName}${this.levelFilter?`-${this.levelFilter}`:""}-${I}`} @part-select=${y=>this.onPartSelect(y)}
      @level-select=${y=>this.levelFilter=y.detail.id}
      @hud-corner=${y=>{this.corner3d=y.detail.corner}}
      .walkable=${!f.spread} @walk-change=${y=>this.onWalkChange(y.detail.on)}
      @realistic-change=${y=>{this.real3d!==y.detail.on&&(this.real3d=y.detail.on,this.sceneDue=!0)}}
      .stillsAvailable=${s} @stills-fallback=${()=>{this.stillsFallback=!0}}
      .idleS=${n?r.idleS:0} .changeKey=${n?this.planChangeKeyOf(e):""} .qualityForce=${n?r.quality:null}
      @floor-request=${y=>{y.detail.floorId!==this.floorId&&this.floors.some(k=>k.id===y.detail.floorId)&&z(`/explore/floors/${y.detail.floorId}`)}}>
      ${n&&s?Me(e,t,this.roomStateLayer,this.viewDials,new Date,{slot:"idle-still",autoBand:!0,site:this.stillsSite}):h}
    </sw-plan-3d>`}planChangeKeyOf(e){const t={};for(const s of e.anchors)s.resource_type==="camera"&&(t[s.id]=s.camera?.status??"?");return cs({layer:this.roomStateLayer,circuits:this.circuitStates3d,cameras:t})}layerCounts(){const e=this.bundle,t=this.roomStateLayer,s={cameras:0,doors:0,lights:0,sensors:0,zones:e?.zones.length??0,structure:this.geometry?.walls.length??0,photo:e?.floorImages?e.floorImages.on?2:1:0,objects:this.geometry?.objects.length??0,connectors:this.geometry?.connectors.length??0,states:t?Object.values(t.rooms).filter(a=>a.lit||a.presenceFade>0||a.openings.length||a.temperature!==null).length+(t.openOpenings.length?1:0):0};if(!e)return s;if(e.source==="demo"){s.cameras=H.filter(a=>a.floorId===e.floorId).length;for(const a of Q.filter(i=>i.floorId===e.floorId))a.domain==="lock"?s.doors++:a.domain==="light"?s.lights++:s.sensors++;return s}for(const a of e.anchors)a.resource_type==="camera"?s.cameras++:a.layer_id==="doors"?s.doors++:a.layer_id==="lights"?s.lights++:s.sensors++;return s}zoneOf(e){return this.bundle?.zones.find(s=>V(e.position,s.polygon))?.name??null}toggleLayer(e){const t=new Set(this.layers);t.has(e)?t.delete(e):t.add(e),this.setLayers(t)}setLayers(e){this.layers=e;try{const t=[...e];for(const s of yi)e.has(s)||t.push(`-${s}`);localStorage.setItem(`sw.floor.layers.${this.floorId}`,JSON.stringify(t))}catch{}}restoreLayers(){let e=null;try{e=localStorage.getItem(`sw.floor.layers.${this.floorId}`)}catch{}const t=Qs(e);(t.size!==this.layers.size||[...t].some(s=>!this.layers.has(s)))&&(this.layers=t)}setPlanImage(e){this.planImage=e,ns("floor",this.floorId,e)}restorePlanImage(){this.planImage=rs("floor",this.floorId)}cameraAnchors(){return(this.bundle?.anchors??[]).filter(e=>e.resource_type==="camera"&&this.layers.has("cameras"))}togglePick(e){this.picked=this.picked.includes(e)?this.picked.filter(t=>t!==e):[...this.picked,e]}pickedCameraIds(){const e=new Map((this.bundle?.anchors??[]).map(t=>[t.id,t.resource_id]));return this.picked.map(t=>e.get(t)).filter(t=>!!t)}setMulti(e){this.multi=e,this.picked=[],this.saveView=null,this.savedView=null,e&&this.close(),e&&this.narrow&&(this.sideList=!1,this.panel=!1)}addPicks(e){const t=new Set(this.cameraAnchors().map(a=>a.id)),s=e.filter(a=>t.has(a)&&!this.picked.includes(a));s.length&&(this.picked=[...this.picked,...s])}pickZone(e){const t=this.bundle?.zones.find(i=>i.id===e);if(!t)return;const s=this.cameraAnchors().filter(i=>V(i.position,t.polygon)).map(i=>i.id);if(!s.length)return;const a=s.every(i=>this.picked.includes(i));this.picked=a?this.picked.filter(i=>!s.includes(i)):[...this.picked,...s.filter(i=>!this.picked.includes(i))]}roomChips(){const e=this.bundle;if(!e)return h;const t=this.cameraAnchors(),s=e.zones.map(a=>({z:a,ids:t.filter(i=>V(i.position,a.polygon)).map(i=>i.id)})).filter(a=>a.ids.length);return s.length?c`<span class="roomchips" data-room-chips>${s.map(a=>c`<sw-chip icon="layers" data-room-chip=${a.z.id} ?selected=${a.ids.every(i=>this.picked.includes(i))} @click=${()=>this.pickZone(a.z.id)}>${a.z.name} (${a.ids.length})</sw-chip>`)}</span>`:h}togglePanel(){this.panel=!this.panel,this.panel&&this.narrow&&(this.sideList=!1)}toggleSideList(){this.sideList=!this.sideList,this.sideList&&this.narrow&&(this.panel=!1,this.multi&&this.setMulti(!1));try{localStorage.setItem("sw.map.sidelist",this.sideList?"1":"0")}catch{}}async jumpTo(e){if(e.resource_type==="camera"?(this.focusCamera=e.resource_id,this.focusEntity=""):(this.focusEntity=e.resource_id,this.focusCamera=""),this.focusZone="",this.multi&&e.resource_type==="camera"){this.togglePick(e.id);return}this.focusZoom=this.jumpZoom,await this.applyFocus(),window.clearTimeout(this.focusZoomTimer),this.focusZoomTimer=window.setTimeout(()=>{this.focusZoomTimer=0,this.focusZoom=!0},900)}setJumpZoom(e){this.jumpZoom=e;try{localStorage.setItem("sw.map.jumpzoom",e?"1":"0")}catch{}}renderSideList(){const e=this.bundle;if(!e||!this.sideList||e.source!=="api")return h;const t=e.anchors.filter(r=>r.resource_type==="camera"),s=e.anchors.filter(r=>r.resource_type==="ha_entity"),a={light:o("תאורה"),switch:o("מפסקים"),lock:o("מנעולים"),binary_sensor:o("חיישנים"),sensor:o("חיישנים"),cover:o("תריסים"),climate:o("מיזוג"),media_player:o("מדיה"),alarm_control_panel:o("אזעקה")},i=new Map;for(const r of s){const d=r.entity?.domain??r.resource_id.split(".")[0];i.set(d,[...i.get(d)??[],r])}const n=r=>r.camera?r.camera.status==="online"?"var(--sw-success)":r.camera.status==="offline"?"var(--sw-danger)":"var(--sw-text-3)":r.entity?.state==="on"||r.entity?.state==="unlocked"||r.entity?.state==="open"?"var(--sw-accent)":"var(--sw-text-3)";return c`<div class="sidelist ${this.sheetTall?"tall":""}" data-sidelist data-sheet-tall=${this.sheetTall?"1":h}>
      <button class="grab" data-sheet-grab aria-label=${this.sheetTall?o("הקטן את הרשימה"):o("הגדל את הרשימה")} @click=${()=>this.sheetTall=!this.sheetTall}><span></span></button>
      <div class="sh"><sw-icon name="list" size=${14}></sw-icon>${o("על התוכנית")}<span class="grow"></span><sw-button variant="ghost" size="sm" iconOnly icon="close" label=${o("סגור")} @click=${()=>this.toggleSideList()}></sw-button></div>
      <label class="jz" data-jump-zoom-row><sw-toggle size="sm" labelHidden in-label label=${o("זום בקפיצה לרכיב")} data-jump-zoom .checked=${this.jumpZoom} @change=${r=>this.setJumpZoom(pt(r))}></sw-toggle> ${o("זום בקפיצה לרכיב")}</label>
      <div class="body">
        ${this.embedded?h:c`<div class="grp">${o("קומות")}</div>
        ${this.floors.map(r=>c`<button class="it ${r.id===this.floorId?"on":""}" data-side-floor=${r.id} @click=${()=>{r.id!==this.floorId&&z(`/explore/floors/${r.id}`)}}>
          <sw-icon name="building" size=${12}></sw-icon><span class="nm">${ee(r.name)}</span><span class="st">${o("{cameraCount} מצלמות{v}",{cameraCount:r.cameraCount,v:r.hasPlan?"":o(" · אין תוכנית")})}</span></button>`)}`}
        <div class="grp">${o("מצלמות ({camsCount})",{camsCount:t.length})}</div>
        ${t.map(r=>c`<button class="it ${this.selectedId===r.id||this.picked.includes(r.id)?"on":""}" data-side-camera=${r.resource_id} @click=${()=>this.jumpTo(r)}>
          <span class="dot" style="--dot:${n(r)}"></span><span class="nm">${r.camera?.name??r.label??r.resource_id}</span><span class="st">${r.camera?.status==="online"?o("חיה"):r.camera?.status==="offline"?o("מנותקת"):""}</span></button>`)}
        ${[...i.entries()].map(([r,d])=>c`<div class="grp">${a[r]??r} (${d.length})</div>
          ${d.map(l=>c`<button class="it ${this.selectedId===l.id?"on":""}" data-side-entity=${l.resource_id} @click=${()=>this.jumpTo(l)}>
            <span class="dot" style="--dot:${n(l)}"></span><span class="nm">${M(l)}</span><span class="st">${l.entity?Z(l.entity):""}</span></button>`)}`)}
        ${!t.length&&!s.length?c`<div class="grp">${o("אין פריטים מוצבים על התוכנית הזו.")}</div>`:h}
      </div>
    </div>`}pickSummary(){const e=this.picked.map(a=>this.bundle?.anchors.find(i=>i.id===a)).filter(a=>!!a),t=e.filter(a=>a.camera?.can_view_live===!1).length,s=e.filter(a=>a.camera?.can_view_live!==!1&&a.camera?.recorder_enabled!==!1&&a.camera?.status==="online").length;return{total:e.length,online:s,offline:e.length-s-t,denied:t}}pickDot(e){return!e?.camera||e.camera.can_view_live===!1||e.camera.recorder_enabled===!1?"var(--sw-text-3)":e.camera.status==="online"?"var(--sw-success)":"var(--sw-danger)"}saveableCameraIds(){const e=new Map((this.bundle?.anchors??[]).map(t=>[t.id,t]));return this.picked.map(t=>e.get(t)).filter(t=>!!t&&t.camera?.can_view_live!==!1&&t.camera?.recorder_enabled!==!1).map(t=>t.resource_id).slice(0,16)}openSave(){const e=this.saveableCameraIds().length;if(!e)return;const t=e<=1?1:e<=4?2:e<=9?3:4,s=Math.max(1,Math.min(4,Math.ceil(e/t))),a=this.floors.find(i=>i.id===this.floorId)?.name??this.bundle?.floorName??o("מפה");this.savedView=null,this.saveView={name:o("{floorName} · {n} מצלמות",{floorName:a,n:e}),cols:t,rows:s,shared:!1,canShare:!1,busy:!1,error:null},Et().then(i=>{this.saveView&&(this.saveView={...this.saveView,canShare:i.can_share})}).catch(()=>{})}async submitSave(){const e=this.saveView;if(!e||e.busy)return;if(!e.name.trim()){this.saveView={...e,error:o("לתצוגה צריך שם.")};return}const t=this.saveableCameraIds();if(!t.length){this.saveView={...e,error:o("אין בבחירה מצלמה שמותר לך לצפות בה.")};return}this.saveView={...e,busy:!0,error:null};try{this.savedView=await At({name:e.name.trim(),cameras:t,cols:e.cols,rows:e.rows,shared:e.shared,kiosk:!1}),this.saveView=null}catch(s){this.saveView={...e,busy:!1,error:j(s)}}}renderSaveDialog(){const e=this.saveView;if(!e)return h;const t=this.saveableCameraIds(),{denied:s}=this.pickSummary(),a=Math.max(0,this.picked.length-s-16),i=n=>this.saveView={...e,...n};return c`<sw-dialog open heading=${o("שמירה כתצוגה")} subheading=${o("{camerasCount} מצלמות מהמפה · התצוגה נפתחת בקיר החי או בקיוסק",{camerasCount:t.length})} data-save-view-dialog @close=${()=>this.saveView=null}>
      <div class="saveform">
        <sw-field label=${o("שם")}><input data-save-view-name .value=${e.name} maxlength="60" @input=${n=>i({name:n.target.value})} @keydown=${n=>n.key==="Enter"&&this.submitSave()} /></sw-field>
        <div class="row">
          <sw-field label=${o("עמודות (קיוסק)")}><select data-save-view-cols @change=${n=>i({cols:Number(n.target.value)})}>${[1,2,3,4].map(n=>c`<option value=${n} ?selected=${n===e.cols}>${n}</option>`)}</select></sw-field>
          <sw-field label=${o("שורות (קיוסק)")}><select data-save-view-rows @change=${n=>i({rows:Number(n.target.value)})}>${[1,2,3,4].map(n=>c`<option value=${n} ?selected=${n===e.rows}>${n}</option>`)}</select></sw-field>
        </div>
        <sw-toggle ?checked=${e.shared} ?disabled=${!e.canShare} label=${e.canShare?o("משותפת לכל המשתמשים"):o("משותפת (דורש הרשאת ניהול משתמשים)")} data-save-view-shared @change=${n=>i({shared:n.detail.checked})}></sw-toggle>
        ${s?c`<div class="note">${o("{denied} מצלמות ללא הרשאת צפייה חיה לא ייכללו בתצוגה.",{denied:s})}</div>`:h}
        ${a?c`<div class="note">${o("תצוגה מכילה עד 16 מצלמות; {over} האחרונות שנבחרו לא ייכללו.",{over:a})}</div>`:h}
        <div class="note">${o("הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג {cols}×{rows} מצלמות בעמוד.",{cols:e.cols,rows:e.rows})}</div>
        ${e.error?c`<div class="err" role="alert" data-save-view-error>${e.error}</div>`:h}
      </div>
      <div slot="footer"><sw-button variant="primary" ?disabled=${e.busy} data-save-view-submit @click=${()=>this.submitSave()}>${e.busy?o("שומר…"):o("שמור תצוגה")}</sw-button><sw-button variant="ghost" @click=${()=>this.saveView=null}>${x("actions.cancel")}</sw-button></div>
    </sw-dialog>`}openWall(){const e=this.pickedCameraIds();e.length&&(this.rememberView(),z("/live/wall",{cameras:e.join(","),from:"map"}))}openSync(){const e=this.pickedCameraIds();e.length&&(this.rememberView(),z("/investigate/playback",{camera:e[0],extra:e.slice(1,4).join(","),from:"map"}))}renderSuggestions(){const e=this.adjacentSuggestions;if(!e.length)return h;const t=this.bundle,s=a=>{const i=t.anchors.find(n=>n.id===a);return i?.camera?.name??i?.label??i?.resource_id??a};return c`<span class="suggest" data-pick-suggest>
      <span class="lbl"><sw-icon name="target" size=${12}></sw-icon>${o("מוצע בסמוך")}</span>
      ${e.map(a=>c`<sw-chip icon="camera" dot=${this.pickDot(t.anchors.find(i=>i.id===a.id))} title=${`${Be[a.relation]}${a.zoneName?` · ${a.zoneName}`:""} · ${s(a.from)}`} data-pick-suggest-chip=${a.id} data-relation=${a.relation} @click=${()=>this.togglePick(a.id)}>${s(a.id)}<small>${Be[a.relation]}</small></sw-chip>`)}
      ${e.length>1?c`<sw-chip data-pick-suggest-all @click=${()=>this.addPicks(e.map(a=>a.id))}>${o("הוסף הכל ({sCount})",{sCount:e.length})}</sw-chip>`:h}
    </span>`}renderPickbar(){const e=this.bundle;if(!e)return h;const t=this.cameraAnchors(),s=f=>e.anchors.find(w=>w.id===f),a=f=>{const w=s(f);return w?.camera?.name??w?.label??w?.resource_id??f},i=this.pickSummary(),n=e.anchors.filter(f=>f.resource_type==="camera").length,r=this.floors.find(f=>f.id===this.floorId)?.cameraCount??n,d=Math.max(0,r-n),l=i.total?o("נבחרו {total} · {online} זמינות{v}{v2}{v3}",{total:i.total,online:i.online,v:i.offline?o(" · {offline} לא מקוונות",{offline:i.offline}):"",v2:i.denied?o(" · {denied} ללא הרשאה",{denied:i.denied}):"",v3:d?o(" · {unplaced} מצלמות של הקומה אינן על המפה",{unplaced:d}):""}):o("לחץ על מצלמות או גרור מלבן על המפה · לחיצה על חדר בוחרת את מצלמותיו · Shift+גרירה מזיזה את המפה · עד 4 לניגון מסונכרן{v}",{v:d?o(" · {unplaced} מצלמות של הקומה אינן על המפה",{unplaced:d}):""});return c`<div class="pickbar" data-pickbar>
      <span class="hint" data-pick-hint>${l}</span>
      ${this.picked.map(f=>{const w=s(f),$=w?.camera?.can_view_live===!1,S=w?.camera?.recorder_enabled===!1;return c`<sw-chip selected icon="camera" dot=${this.pickDot(w)} title=${$?o("אין הרשאת צפייה חיה"):S?o("ה־NVR מושבת"):w?.camera?.status==="online"?o("מקוונת"):o("לא מקוונת")} data-pick-chip=${$?"denied":S?"recorder-off":w?.camera?.status??"unknown"} @click=${()=>this.togglePick(f)}>${a(f)}</sw-chip>`})}
      <sw-chip data-pick-all @click=${()=>this.picked=t.map(f=>f.id)}>${o("בחר הכל ({camsCount})",{camsCount:t.length})}</sw-chip>
      ${this.roomChips()}
      ${this.renderSuggestions()}
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="live" ?disabled=${!this.picked.length} data-pick-wall @click=${()=>this.openWall()}>${o("קיר חי ({pickedCount})",{pickedCount:this.picked.length})}</sw-button>
      <sw-button size="sm" icon="history" ?disabled=${!this.picked.length||this.picked.length>4} data-pick-sync @click=${()=>this.openSync()}>${o("ניגון מסונכרן")}</sw-button>
      <sw-button size="sm" icon="layers" ?disabled=${!this.saveableCameraIds().length} data-pick-save @click=${()=>this.openSave()}>${o("שמור כתצוגה")}</sw-button>
      <sw-button variant="ghost" size="sm" @click=${()=>this.picked=[]}>${o("נקה")}</sw-button>
      <sw-button variant="ghost" size="sm" icon="close" @click=${()=>this.setMulti(!1)}>${o("סיום")}</sw-button>
      ${this.savedView?c`<span class="saved" data-view-saved role="status">${o("התצוגה „{name}” נשמרה ({camerasCount} מצלמות) ·",{name:this.savedView.name,camerasCount:this.savedView.cameras.length})} <a href="#/live/views" data-view-saved-open>${o("תצוגות שמורות")}</a> · <a href=${Ft(this.savedView)}>${o("פתח בקיר")}</a></span>`:h}
    </div>`}onSelect(e){if(this.focusedObjectId=null,this.multi){const t=e.detail.id?this.bundle?.anchors.find(s=>s.id===e.detail.id):null;t?.resource_type==="camera"&&this.togglePick(t.id);return}this.selectedZoneId=null,this.selectedId=e.detail.id,this.anchor=e.detail.id&&e.detail.sx!==void 0&&e.detail.sy!==void 0?{x:e.detail.sx,y:e.detail.sy}:null}onViewChange(){if(this.multi&&this.rememberView(),!this.selectedId||!this.canvas||this.shows3d)return;const e=this.markers.find(s=>s.id===this.selectedId);if(!e)return;const t=this.canvas.toScreen(e.x,e.y);this.anchor={x:t.x,y:t.y}}close(){this.selectedId=null,this.anchor=null}entityTone(e){return e?ut({...e,fresh:e.fresh&&this.syncConnected}):"unknown"}argDefault(e,t){const s=e.attributes;return t.name==="hvac_mode"?String(s.hvac_mode??e.state??t.choices?.[0]??""):t.name==="temperature"?String(s.temperature??21):t.name==="volume_level"?String(Math.round((s.volume_level??.5)*100)):t.name==="value"?String(e.state??s.min??0):t.name==="option"?String(e.state??s.options?.[0]??""):t.name==="brightness_pct"?String(typeof s.brightness=="number"?Math.round(s.brightness/255*100):100):t.name==="percentage"?String(s.percentage??100):String(t.choices?.[0]??t.min??"")}argsFor(e,t){const s={};for(const a of t.argument_specs??[]){const i=this.actionArgs[`${t.id}:${a.name}`]??this.argDefault(e,a);if(a.type==="int"||a.type==="float"){const n=Number(i);if(!Number.isFinite(n))continue;s[a.name]=a.name==="volume_level"?Math.min(1,Math.max(0,n/100)):n}else s[a.name]=i}return s}argChoices(e,t){const s=e.attributes;return t.name==="hvac_mode"&&Array.isArray(s.hvac_modes)?s.hvac_modes.filter(a=>t.choices?.includes(a)):t.name==="option"&&Array.isArray(s.options)?s.options:t.choices??[]}renderArg(e,t,s){const a=`${t.id}:${s.name}`,i=this.actionArgs[a]??this.argDefault(e,s),n=l=>this.actionArgs={...this.actionArgs,[a]:l},r=e.attributes,d=this.argChoices(e,s);if(d.length)return c`<select class="arg" data-action-arg=${a} aria-label=${s.name} @change=${l=>n(l.target.value)}>${d.map(l=>c`<option value=${l} ?selected=${l===i}>${vi[l]??l}</option>`)}</select>`;if(s.type==="int"||s.type==="float"){const l=s.name==="volume_level"?0:s.name==="value"?r.min??s.min:s.name==="temperature"?r.min_temp??5:s.min,f=s.name==="volume_level"?100:s.name==="value"?r.max??s.max:s.name==="temperature"?r.max_temp??35:s.max,w=s.name==="value"?r.step??1:s.name==="temperature"&&r.target_temp_step||1,$=s.name==="volume_level"||s.name==="brightness_pct"||s.name==="percentage"?"%":s.name==="temperature"?"°":"";return c`<span class="argwrap"><input class="arg" type="number" data-action-arg=${a} aria-label=${s.name} .value=${i} min=${String(l??"")} max=${String(f??"")} step=${String(w)} data-ltr @change=${S=>n(S.target.value)} />${$?c`<span class="unit">${$}</span>`:h}</span>`}return c`<input class="arg" type="text" data-action-arg=${a} aria-label=${s.name} .value=${i} maxlength=${String(s.max_len??80)} @change=${l=>n(l.target.value)} />`}trigger(e,t){if(t.sensitive){this.confirmSpec={entityId:e,spec:t};return}this.send(e,t,!1)}async send(e,t,s){this.confirmSpec=null,this.action={entityId:e,spec:t,record:null,error:"",busy:!0};try{const a=this.bundle?.anchors.find(n=>n.resource_type==="ha_entity"&&n.resource_id===e)?.entity,i=await mt(e,t.id,a?this.argsFor(a,t):{},s);if(this.action={entityId:e,spec:t,record:i,error:"",busy:i.status==="pending"},i.status==="pending"){const n=this.action;await ft(i.id,r=>{(this.action===n||this.action?.record?.id===r.id)&&(this.action={entityId:e,spec:t,record:r,error:"",busy:r.status==="pending"})},void 0,e)}}catch(a){const i=a instanceof bt&&a.code==="bridge_not_paired"?o("הגשר אינו מצומד. התקנה וצימוד: הגדרות → כללי."):j(a);this.action={entityId:e,spec:t,record:null,error:i,busy:!1}}}apiEntityBody(e,t){const s=e.entity;if(!s)return c`<div class="note">${o("התקן ·")} <span class="ltr">${e.resource_id}</span> ${o("— לא נמצא בקטלוג המסונכרן (ייתכן שהוסר).")}</div>`;const a=this.entityTone(s),i=this.action?.entityId===s.entity_id?this.action:null,n=s.fresh&&this.syncConnected,r=this.renaming?.id===e.id?this.renaming:null;return c`
      <div class="ecard" data-entity-card>
        <div class="estate ${a}"><sw-badge kind=${a} label=${Z(s)}></sw-badge><span class="esub">${ge(s.domain)}${s.area_name?` · ${s.area_name}`:""} · ${t}</span>${ne()?c`<ticket-count-chip entity-id=${s.entity_id}></ticket-count-chip>`:h}</div>
        ${e.label&&s.name&&e.label!==s.name?c`<div class="note">${o("שם מקורי: {name}",{name:s.name})}</div>`:h}
        ${this.notice?c`<div class="note" data-notice role="status">${this.notice}</div>`:h}
        ${r?c`<div class="rename" data-rename-form><input .value=${r.value} placeholder=${s.name??e.resource_id} aria-label=${o("שם במפה")} @input=${d=>this.renaming={id:e.id,value:d.target.value}} @keydown=${d=>{d.key==="Enter"&&this.saveRename(e),d.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" icon="check" data-rename-save ?disabled=${r.busy} @click=${()=>this.saveRename(e)}>${o("שמור")}</sw-button>
              <sw-button size="sm" variant="ghost" @click=${()=>this.renaming=null}>${o("ביטול")}</sw-button></div>`:h}
        ${this.entityActions(e)}
        <details class="more"><summary>${o("פרטים")}</summary>
          <dl class="meta">
            <dt>${x("entity.lastChanged")}</dt><dd>${ye(s.last_changed)}</dd>
            <dt>${o("נראה לאחרונה")}</dt><dd>${ye(s.state_seen_at)}</dd>
            <dt>ID</dt><dd><span class="ltr">${s.entity_id}</span></dd>
          </dl>
          ${ne()?c`<sw-button size="sm" variant="ghost" icon="list" data-map-tickets @click=${d=>fi(s.entity_id,M(e),Z(s),d.currentTarget)}>${re("mapAction")}</sw-button>`:h}
        </details>
      </div>
      ${n?h:c`<div class="warn">${s.state==="unavailable"?o("ההתקן אינו זמין."):o("הסנכרון מול תשתית המערכת מנותק — המצב עלול להיות מיושן.")}</div>`}
      ${s.actions===void 0?c`<div class="note">${x("entity.noControl")}</div>`:s.actions.length===0?c`<div class="note">${o("קריאה בלבד — אין פעולות מותרות ל־{domainLabel}.",{domainLabel:ge(s.domain)})}</div>`:h}
      ${this.grantNote(s.actions)}
      ${i?c`<div class=${i.error||i.record?.status==="failed"||i.record?.status==="denied"?"warn":"note"}>${i.spec.label}: ${i.error?i.error:i.record?`${xe[i.record.status]}${i.record.error?` — ${$e[i.record.error]??i.record.error}`:""}`:o("שולח…")}</div>`:h}
    `}async openIncidentHere(e){this.incidentBusy=!0;try{const t=await wt({anchor_id:e});z(`/investigate/incidents/${encodeURIComponent(t.incident.id)}`)}catch(t){this.notice=j(t)}finally{this.incidentBusy=!1}}async saveRename(e){const t=this.renaming;if(!(!t||t.id!==e.id||t.busy)){this.renaming={...t,busy:!0};try{const s=await vt(e.id,{revision:e.revision,label:t.value.trim()||null},e.shared?this.bundle?.floorId:void 0);this.bundle&&(this.bundle={...this.bundle,anchors:this.bundle.anchors.map(a=>a.id===e.id?{...a,label:s.label,revision:s.revision}:a)}),this.renaming=null,this.notice=s.label?o("השם „{label}“ נשמר",{label:s.label}):o("חזרה לשם המקורי")}catch(s){this.notice=j(s),this.renaming={...t,busy:!1}}}}grantNote(e){const t=Tt(e,ke("system.configure"));return t?c`<div class="note" data-grant-note data-grant-reason=${e?.find(s=>s.id==="lock.unlock")?.reason??""}>${t.text}${t.link?c` <a data-grant-note-link href=${t.link.href}>${t.link.label}</a>`:h}</div>`:h}entityActions(e){const t=e.entity;return t?.alarm_managed?c`<div class="eactions" data-entity-actions data-alarm-managed><sw-button block variant="primary" icon="shield" @click=${()=>window.location.hash=t.domain==="alarm_control_panel"?`#/security/alarm?panel=${encodeURIComponent(t.entity_id)}`:"#/security/alarm"}>${o("נשלט ממסך האזעקה · לאזעקה")}</sw-button></div>`:(t?.actions??[]).length?c`<div class="eactions" data-entity-actions>${this.entityFooter(e)}</div>`:h}entityFooter(e){const t=e.entity,s=!!(this.action&&t&&this.action.entityId===t.entity_id&&this.action.busy),a=t?.actions??[];return c`${a.map(i=>c`<span class="actrow" data-action-row=${i.id}>${t&&i.argument_specs?.length?i.argument_specs.map(n=>this.renderArg(t,i,n)):h}<sw-button block variant=${i.risk==="sensitive"||i.sensitive?"danger":"primary"} ?disabled=${s||this.screenState==="stale"||t?.state==="unavailable"||i.granted===!1} title=${i.granted===!1?Pt(i,ke("system.configure")):i.risk_label?o("פעולה {risk_label}",{risk_label:i.risk_label}):""} data-action=${i.id} data-risk=${i.risk??(i.sensitive?"attention":"routine")} data-granted=${i.granted===!1?"no":"yes"} @click=${()=>t&&this.trigger(t.entity_id,i)}>${i.label}</sw-button></span>`)}`}renderConfirm(){const e=this.confirmSpec;if(!e)return h;const t=this.bundle?.anchors.find(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entityId)?.entity;return c`<sw-dialog open heading=${x("entity.confirm")} subheading=${t?.name??e.entityId} @close=${()=>this.confirmSpec=null}>
      <div style="font-size:var(--sw-fs-sm);line-height:1.5">${o("הפעולה")} <strong>${e.spec.label}</strong> ${o("על")} <span class="ltr">${e.entityId}</span> ${o("היא פעולה {v}{v2}. היא תבוצע בזהות שלך ותירשם באודיט.",{v:e.spec.risk_label??o("רגישה"),v2:e.spec.risk==="sensitive"?o(" (הרשאה נפרדת)"):""})}</div>
      <div slot="footer"><sw-button variant="danger" @click=${()=>this.send(e.entityId,e.spec,!0)}>${e.spec.label}</sw-button><sw-button variant="ghost" @click=${()=>this.confirmSpec=null}>${x("actions.cancel")}</sw-button></div>
    </sw-dialog>`}demoCameraBody(e,t){const s=e.state==="offline"?x("camera.offlineReason"):e.state==="forbidden"?x("camera.forbiddenReason"):e.state==="stale"?x("camera.staleReason"):"",a=e.state==="live"||e.state==="stale";return c`
      ${a?c`<sw-camera-tile name="" state=${e.state} scene=${gt[e.id]??"lobby"} @click=${()=>z(`/live/cameras/${e.id}`)}></sw-camera-tile>`:c`<div class="off"><div><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${22}></sw-icon><div>${s}</div></div></div>`}
      <div class="statusrow"><sw-badge kind=${e.state}></sw-badge><span>${t} · ${e.source}</span></div>
      ${s&&a?c`<div class="warn">${s}</div>`:h}
    `}demoEntityBody(e){const t=this.screenState==="stale",s=t?"stale":e.state==="on"||e.state==="unlocked"?"live":"neutral";return c`
      <dl class="meta">
        <dt>${x("entity.state")}</dt><dd><sw-badge kind=${s} label=${x(e.stateLabelKey)}></sw-badge></dd>
        <dt>${x("entity.lastChanged")}</dt><dd>${e.lastChanged}</dd>
        <dt>ID</dt><dd><span class="ltr">${e.id}</span></dd>
      </dl>
      ${t?c`<div class="warn">${x("states.staleHint")}</div>`:h}
      ${e.controllable?h:c`<div class="note">${x("entity.noControl")}</div>`}
    `}apiCameraBody(e,t){const s=e.camera,a=D(e),i=Ue[((s?.channel??1)-1)%Ue.length],n=a==="live"&&!!s&&s.can_view_live!==!1&&s.live_kind!=="still",r=s?.recorder_enabled===!1,d=this.zoneOf(e),l=this.standaloneIds.has(e.resource_id)||X(s),f=d?`${t} / ${d}`:l?t:o("{floorName} · ערוץ {v}",{floorName:t,v:s?.channel??"?"});return c`
      ${r?c`<div class="off" data-recorder-off><div><sw-icon name="offline" size=${22}></sw-icon><div>${o("ה־NVR של המצלמה מושבת")}</div></div></div>`:a==="offline"?c`<div class="off"><div><sw-icon name="offline" size=${22}></sw-icon><div>${l?yt:x("camera.offlineReason")}</div></div></div>`:c`<sw-camera-tile name="" state=${a==="live"?"live":"unknown"} scene=${i} poster=${s?oe(s.id,s.live_kind==="still"?void 0:Date.now()):""} .stillRefresh=${s?.live_kind==="still"&&a==="live"?s.still_refresh_s??10:0} ?live=${n&&!!this.liveTransport} .cameraId=${n?s.id:""} transport=${this.liveTransport??"auto"} data-live=${n?"1":"0"} @click=${()=>s&&z(`/live/cameras/${s.id}`)}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${a}></sw-badge><span data-where>${f}</span></div>
      <dl class="meta">
        ${l?c`<dt>${o("מקור")}</dt><dd data-standalone-source>${xt}</dd>`:c`<dt>${o("שם ב־NVR")}</dt><dd>${s?.name_source||"—"}${s?c` · <span class="ltr">ch ${s.channel}</span>`:h}</dd>`}
        <dt>${o("נראתה לאחרונה")}</dt><dd>${s?.last_seen_at?s.last_seen_at.replace("T"," ").replace("Z"," UTC"):o("לא נבדק")}</dd>
      </dl>
      ${this.notice?c`<div class="note" data-notice role="status">${this.notice}</div>`:h}
      ${r?h:c`<div class="note">${n?o('הזרם נפתח לכרטיס הזה בלבד ונסגר איתו; "צפייה מלאה" פותחת את המצלמה במסך מלא.'):a==="offline"?l?_e("offline"):o("המצלמה מנותקת לפי ה־NVR."):l?_e("still"):o("תמונה: צילום מה־NVR (מתרענן).")}</div>`}
    `}renderCard(){const e=this.bundle;if(!this.selectedId||!e)return h;let t="",s="",a=h,i=h;if(e.source==="demo"){const d=H.find(w=>w.id===this.selectedId),l=d?void 0:Q.find(w=>w.id===this.selectedId);if(!d&&!l)return h;t=d?d.name:l.name,s=d?`${e.floorName} · ${d.source}`:`${e.floorName} · ${x(l.domain==="lock"?"entity.door":l.domain==="light"?"entity.light":"entity.sensor")}`,a=d?this.demoCameraBody(d,e.floorName):this.demoEntityBody(l);const f=d?d.state==="live"||d.state==="stale":!1;i=d?c`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${!f} @click=${()=>z(`/live/cameras/${d.id}`)}>${o("צפייה חיה")}</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${d.state==="forbidden"} @click=${()=>z("/investigate/playback")}>${x("camera.recordings")}</sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="pin" label=${this.pinned?x("camera.unpin"):x("camera.pin")} @click=${()=>this.pinned=!this.pinned}></sw-button>`:c`<sw-button variant="primary" size="sm" ?disabled=${!l.controllable||this.screenState==="stale"}>${x("entity.control")}</sw-button><sw-button variant="ghost" size="sm">${x("entity.openInHa")}</sw-button>`}else{const d=e.anchors.find(l=>l.id===this.selectedId);if(!d)return h;t=M(d),s=`${e.buildingName} · ${e.floorName}`,a=d.resource_type==="camera"?this.apiCameraBody(d,e.floorName):this.apiEntityBody(d,e.floorName),i=c`${d.resource_type==="camera"?c`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${D(d)==="offline"||d.camera?.recorder_enabled===!1} @click=${()=>d.camera&&z(`/live/cameras/${d.camera.id}`)}>${o("צפייה מלאה")}</sw-button>
            ${this.standaloneIds.has(d.resource_id)||X(d.camera)?h:c`<sw-button size="sm" icon="history" ?disabled=${!d.camera||d.camera.recorder_enabled===!1} @click=${()=>d.camera&&z("/investigate/playback",{camera:d.camera.id})}>${x("camera.recordings")}</sw-button>`}`:h}
        ${qs()?c`<sw-button variant="ghost" size="sm" icon="plus" data-map-ticket @click=${()=>this.ticketFor={pick:{element:{floor_id:d.floor_id||e.floorId,kind:"anchor",id:d.id}},name:M(d),floorName:e.floorName,entityId:d.resource_type==="ha_entity"?d.resource_id:void 0}}>${Vs()}</sw-button>`:h}
        ${$t(It())?c`<sw-button variant="ghost" size="sm" icon="warning" data-map-incident ?disabled=${this.incidentBusy} @click=${()=>void this.openIncidentHere(d.id)}>${kt("openHere")}</sw-button>`:h}
        ${d.resource_type==="ha_entity"&&e.permissions.edit&&d.entity?c`<sw-button variant="ghost" size="sm" icon="edit" data-rename @click=${()=>this.renaming={id:d.id,value:d.label??""}}>${o("שנה שם")}</sw-button>`:h}
        ${e.permissions.edit&&!this.phone.restricted("structure")?c`<sw-button variant="ghost" size="sm" icon="edit" @click=${()=>z(`/explore/floors/${e.floorId}/edit`)}>${o("עריכה")}</sw-button>`:h}`}if(this.narrow||!this.anchor||this.shows3d)return c`<sw-drawer open heading=${t} subheading=${s} @close=${this.close}>${a}<div slot="footer">${i}</div></sw-drawer>`;const n=this.stage?.clientWidth??0,r=this.stage?.clientHeight??0;return c`<sw-popover heading=${t} .x=${this.anchor.x} .y=${this.anchor.y} .stageWidth=${n} .stageHeight=${r} @close=${this.close}>${a}<div slot="footer">${i}</div></sw-popover>`}onZoneSelect(e){if(this.multi){this.pickZone(e);return}const t=this.bundle?.zones.find(s=>s.id===e);if(this.embedded&&t){this.selectedZoneId=e,this.close();const s=Mt(t.polygon),a=this.canvas?.toScreen(s.x,s.y)??{x:0,y:0};this.dispatchEvent(new CustomEvent("area-open",{detail:{zone_id:e,zone_name:t.name,area_id:t.area_id??null,x:a.x,y:a.y},bubbles:!0,composed:!0}));return}this.selectedZoneId=this.selectedZoneId===e?null:e,this.close()}renderRoomCard(){const e=this.bundle;if(!e||e.source!=="api"||!this.selectedZoneId||this.multi||this.embedded)return h;const t=e.zones.find(a=>a.id===this.selectedZoneId);if(!t||t.shared)return h;const s=this.r28?.["map.room_card_camera"];return c`<sw-room-card data-room-card data-zone-id=${t.id} .model=${this.roomCardModel(t,e)} place=${this.roomCardPlace()} camera=${s==="snapshot"||s==="none"?s:"live"}
      @room-card-action=${a=>this.onRoomAction(a.detail)} @room-card-bulk=${a=>this.onRoomBulk(a.detail)}
      @room-card-close=${()=>this.selectedZoneId=null} @room-card-camera=${a=>z(`/live/cameras/${a.detail.id}`)}
      @room-card-recordings=${a=>z("/investigate/playback",{camera:a.detail.id,from:"map"})}></sw-room-card>`}renderFloorStrip(){const e=this.buildingFloors;return this.bundle?.source!=="api"||e.length<2?h:c`<div class="floorstrip" role="group" aria-label=${o("קומות")} data-floor-strip>
      ${e.map(t=>{const s=t.id===this.floorId?this.floorDots(this.bundle):this.floorDots(this.otherBundles[t.id]??null);return c`<button class=${t.id===this.floorId?"on":""} data-strip-floor=${t.id} aria-pressed=${t.id===this.floorId} title=${t.name} ?disabled=${!t.hasPlan}
          @click=${()=>{if(t.id!==this.floorId){try{sessionStorage.setItem("sw.map.keep3d",t.id)}catch{}z(`/explore/floors/${t.id}`)}}}>
          <span class="fs-short">${t.short}</span>
          <span class="fs-name">${ee(t.name)}</span>
          <span class="fs-dots" aria-hidden="true">
            ${s.lit?c`<i class="lit"></i>`:h}${s.presence?c`<i class="presence"></i>`:h}${s.open?c`<i class="open"></i>`:h}
          </span>
        </button>`})}
    </div>`}floorDots(e){const t={lit:!1,presence:!1,open:!1};if(!e||e.source!=="api"||this.states3dStale)return t;for(const s of e.anchors){if(s.resource_type!=="ha_entity"||!s.entity||!s.entity.fresh)continue;const a={id:s.resource_id,domain:s.entity.domain??s.resource_id.split(".")[0]??"",device_class:s.entity.device_class??null,layer_id:s.layer_id};(s.entity.state==="on"||s.entity.state==="open"||s.entity.state==="unlocked")&&(Se(a)?t.lit=!0:Zt(a)?t.presence=!0:ze(a)&&(t.open=!0))}return t}keep3d(){try{return sessionStorage.getItem("sw.map.keep3d")!==this.floorId?!1:(sessionStorage.removeItem("sw.map.keep3d"),!0)}catch{return!1}}loadOtherBundles(){const e=this.buildingFloors.filter(s=>s.id!==this.floorId&&s.hasPlan),t=`${this.floorId}:${e.map(s=>s.id).join(",")}`;if(!(this.otherBundlesFor===t||this.bundle?.source!=="api")){this.otherBundlesFor=t;for(const s of e)s.id in this.otherBundles||J(s.id).then(a=>{this.otherBundles={...this.otherBundles,[s.id]:a}},()=>{this.otherBundles={...this.otherBundles,[s.id]:null}})}}renderSharedMembers(){const e=this.bundle;if(!e||e.source!=="api"||!this.selectedZoneId)return h;const t=e.zones.find(a=>a.id===this.selectedZoneId),s=t?.shared;return!t||!s?h:c`<div class="shared-members" data-shared-members>
      <div class="sm-head"><strong>${t.name}</strong><span>${Wt(s)??""}</span></div>
      <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.load()}></sw-share-members>
    </div>`}renderPanel(){const e=this.layerCounts(),t=[{id:"cameras",label:x("floor.cameras"),count:o("{cameras} ממוקמות",{cameras:e.cameras})},{id:"doors",label:o("דלתות ואינטרקום"),count:o("{doors} ישויות",{doors:e.doors})},{id:"lights",label:x("floor.lights"),count:o("{lights} ישויות",{lights:e.lights})},{id:"sensors",label:o("אבטחה וחיישנים"),count:o("{sensors} ישויות",{sensors:e.sensors})},{id:"zones",label:o("שמות חדרים"),count:e.zones?o("{zones} אזורים · תוויות לפי רמת זום",{zones:e.zones}):o("אין חדרים מוגדרים")},...this.bundle?.floorImages?[{id:"photo",label:o("תמונת הקומה"),count:this.bundle.floorImages.on?o("כבוי ודלוק"):o("תמונה אחת")}]:[],{id:"structure",label:o("מבנה"),count:this.geometry?o("{wallsCount} קירות · {openingsCount} פתחים",{wallsCount:this.geometry.walls.length,openingsCount:this.geometry.openings.length}):o("לא שורטט מבנה")},{id:"objects",label:o("עצמים"),count:this.geometry?o("{objectsCount} עצמים מהספרייה",{objectsCount:this.geometry.objects.length}):o("אין עצמים")},{id:"connectors",label:o("מחברים"),count:this.geometry?o("{connectorsCount} מדרגות, רמפות ומעליות",{connectorsCount:this.geometry.connectors.length}):o("אין מחברים")},{id:"states",label:o("מצבי חדרים"),count:this.layers.has("states")?e.states?o("{states} עם מצב · תאורה, תנועה, פתחים פתוחים, טמפרטורה",{states:e.states}):o("תאורה, תנועה, פתחים פתוחים, טמפרטורה"):o("מוסתר")}];return c`<div class="panel" role="group" aria-label=${o("שכבות פעילות")} data-layers-panel>
      <h3>${o("שכבות פעילות")}</h3>
      <div class="sub">${o("הצג רק מה שרלוונטי כרגע")}</div>
      ${t.map(s=>c`<div class="prow"><span class="lbl">${s.label}<span class="cnt">${s.count}</span></span><sw-toggle ?checked=${this.layers.has(s.id)} label=${s.label} labelHidden data-layer=${s.id} @change=${a=>{const i=new Set(this.layers);a.detail.checked?i.add(s.id):i.delete(s.id),this.setLayers(i)}}></sw-toggle></div>`)}
      ${this.bundle?.imageUrl?c`<div class="prow"><span class="lbl">${o("תמונת התוכנית")}<span class="cnt">${this.planImage?o("הקובץ שנטען, מתחת למבנה"):o("מוסתרת · המבנה על רקע נקי")}</span></span><sw-toggle ?checked=${this.planImage} label=${o("תמונת התוכנית")} labelHidden data-plan-background @change=${s=>this.setPlanImage(s.detail.checked)}></sw-toggle></div>`:h}
      <div class="pnote"><sw-icon name="shield" size=${14}></sw-icon><span>${o("מתג משנה תצוגה בלבד; ייבוא ישות אינו מעניק הרשאת שליטה בה.")}</span></div>
      ${this.renderSkinExport()}
    </div>`}renderSkinExport(){const e=this.bundle;return!this.shows3d||e?.source!=="api"||!e.permissions.edit||this.phone.restricted("control_images")?h:c`<div class="pexport">
      <sw-button variant="ghost" size="sm" icon="image" data-skin-controls-export ?disabled=${this.skinBusy} title=${o("תמונות הבקרה של הקומה לסקין עתידי (אורות כבויים / דולקים), מהמבנה המפורסם, בלי תוויות — נשמרות במתקן בלבד")} @click=${()=>this.exportControlImages()}>${this.skinBusy?o("מצלם…"):o("תמונות בקרה")}</sw-button>
      ${this.skinNote?c`<span class="note" data-skin-note>${this.skinNote}</span>`:h}
      <sw-button variant="ghost" size="sm" icon="image" data-bake-run ?disabled=${this.bakeBusy||!this.geometry} title=${ds} @click=${()=>this.runBake()}>${this.bakeBusy?o("מכין…"):hs}</sw-button>
      <span class="note" data-bake-note>${this.bakeNote||ps(e,Te)}</span>
    </div>`}async maybeAutoBake(){const e=this.bundle;!e||e.source!=="api"||!e.permissions.edit||!this.geometry||this.bakeBusy||this.autoBaked.has(e.floorId)||!R()||(await Y().catch(()=>null))?.["plan.bakes"]?.bake_trigger!=="auto"||!us(e,Te)||(this.autoBaked.add(e.floorId),await this.runBake())}async runBake(){const e=this.bundle;if(!(!e||e.source!=="api"||!this.geometry||this.bakeBusy)){this.bakeBusy=!0,this.bakeNote=o("מכין תמונות ותאורה…");try{this.bakeNote=await ms({bundle:e,geometry:this.geometry,catalog:this.catalog3d,live:this.sceneMemo?.all??null,onProgress:t=>{this.bakeNote=t},cancelled:()=>!this.isConnected||this.bundle?.floorId!==e.floorId}),this.isConnected&&this.bundle?.floorId===e.floorId&&(this.bundle={...e,bakes:(await J(e.floorId)).bakes??null})}finally{this.bakeBusy=!1}}}renderCircuitStrip(){const e=this.bundle,t=e?.circuitStates??{},s=Object.keys(t);if(!e||!s.length)return h;const a=this.action;return c`<div class="circuits ${this.panel||this.sideList?"shifted":""}" role="group" aria-label=${o("מעגלי תאורה")} data-circuit-strip>
      ${s.map(i=>{const n=t[i],r=n.state==="on",{spec:d,blocked:l,why:f}=We(n,{busy:!!a?.busy&&a.entityId===n.entity_id,stale:this.screenState==="stale"}),w=this.screenState==="stale"||!n.fresh,$=n.available?w?o("לא מעודכן"):"":o("לא זמין");return c`<button class="circuit ${r?"on":""} ${$?"muted":""}" data-circuit-toggle=${i} data-state=${n.state??"unknown"} data-available=${n.available?"yes":"no"} style=${`--kc: var(--sw-${Ut(n.color_token)??"circuit-1"})`} ?disabled=${l}
            title=${f??(r?o("כיבוי המעגל"):o("הדלקת המעגל"))} @click=${()=>{d&&!l&&this.trigger(n.entity_id,d)}}>
          <i></i><span>${n.name??i}</span><span class="cnt">${Fs(n.member_ids.length,o("מנורה אחת"),o("מנורות"))} · ${n.state===null?o("לא ידוע"):r?o("דולק"):o("כבוי")}${n.power_w?` · ${n.power_w} W`:""}${$?c` · <span class="cnote" data-circuit-note>${$}</span>`:h}</span>
        </button>`})}
      ${a&&s.some(i=>t[i].entity_id===a.entityId)?c`<span class="cstatus" data-circuit-status>${a.error?c`<span class="err" data-circuit-error role="alert">${a.error}</span>`:a.record?xe[a.record.status]+(a.record.error?` · ${$e[a.record.error]??a.record.error}`:""):a.busy?o("שולח…"):""}</span>`:h}
    </div>`}renderStage(){const e=this.bundle;if(this.loadError)return c`<div class="cover"><sw-state-panel state="error" hint=${this.loadError} actionLabel=${x("states.retry")} @action=${()=>this.load()}></sw-state-panel></div>`;if(this.noFloors)return c`<div class="cover"><sw-state-panel icon="map" state="empty" heading=${o("עדיין אין קומות")} hint=${o("צור אתר, מבנה וקומה ואז ייבא תוכנית קומה.")}><div style="margin-block-start:10px"><sw-button variant="primary" icon="building" @click=${()=>z("/explore/sites")}>${o("לאתרים ומבנים")}</sw-button></div></sw-state-panel></div>`;if(!e)return c`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;switch(this.screenState){case"loading":return c`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;case"error":return c`<div class="cover"><sw-state-panel state="error" actionLabel=${x("states.retry")}></sw-state-panel></div>`;case"forbidden":return c`<div class="cover"><sw-state-panel state="forbidden"></sw-state-panel></div>`}return this.screenState==="empty"||e.planStatus==="none"?c`<div class="cover">
        <sw-state-panel icon="map" state="empty" heading=${x("floor.noPlan")} hint=${this.phone.restricted("structure")?o("העלאת תוכנית זמינה במחשב."):e.permissions.import?x("floor.noPlanHint"):o("עורך המפות של הקומה יכול להעלות תוכנית.")}>
          <div style="display:flex;gap:8px;margin-block-start:10px;justify-content:center;flex-wrap:wrap">
            ${e.permissions.import&&!this.phone.restricted("structure")?c`<sw-button variant="primary" icon="upload" @click=${()=>z(`/explore/floors/${e.floorId}/import`)}>${x("floor.uploadPlan")}</sw-button>`:h}
            <sw-button icon="list" @click=${()=>z("/live/wall")}>${x("floor.listView")}</sw-button>
          </div>
        </sw-state-panel>
      </div>`:c`
      ${this.screenState==="stale"||this.screenState==="partial"?c`<div class="banner"><sw-state-panel icon="map" compact state=${this.screenState}></sw-state-panel></div>`:e.needsAlignment?c`<div class="banner"><sw-state-panel compact state="partial" heading=${o("פריטים הוצבו על גרסת תוכנית קודמת")} hint=${o("בדוק שהמיקומים עדיין נכונים על הרקע החדש (עורך התוכנית).")}></sw-state-panel></div>`:h}
      ${this.shows3d?this.render3d(e):h}
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
        .zones=${this.layers.has("zones")?Kt(e.zones).map(t=>({...t,chip:t.chip??St(this.presenceSnap,t.area_id),chipTone:t.chip?void 0:_t(this.presenceSnap,t.area_id)??void 0})):[]}
        .floorImage=${e.floorImages}
        .hideFloorImage=${!this.layers.has("photo")}
        .roomStates=${this.roomStateLayer}
        .selectedZoneId=${this.selectedZoneId}
        .dimEntities=${this.screenState==="stale"}
        @zone-select=${t=>this.onZoneSelect(t.detail.id)}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
      ${this.threeState==="loading"?c`<div class="cover" data-3d-loading><sw-state-panel state="loading" hint=${o("טוען תלת-ממד…")}></sw-state-panel></div>`:h}
      ${this.threeState==="error"?c`<div class="banner" data-3d-load-error><sw-state-panel compact state="error" heading=${o("תלת-ממד לא נטען")} hint=${this.threeError}></sw-state-panel></div>`:h}
      <div class="floorchip" data-floorchip><sw-icon name="building" size=${14}></sw-icon>${e.floorName}</div>
      ${e.levels.length>1?c`<div class="levelbar">${js(e.levels,this.levelFilter,t=>{this.levelFilter=t,this.stackFocus=null})}${this.renderStackSwitch()}</div>`:h}
      ${e.source==="api"&&this.buildingFloors.length>1&&!this.shows3d?c`<div class="floorbtns" role="group" aria-label=${o("מעבר מהיר בין קומות")} data-floor-buttons>
            ${this.buildingFloors.map(t=>c`<button class=${t.id===this.floorId?"on":""} data-floor-button=${t.id} title=${`${t.name}${t.hasPlan?"":o(" · אין תוכנית")}`} aria-pressed=${t.id===this.floorId} @click=${()=>{t.id!==this.floorId&&z(`/explore/floors/${t.id}`)}}>${t.short}</button>`)}
          </div>`:h}
      ${this.shows3d?this.renderFloorStrip():h}
      ${this.panel?this.renderPanel():h}
      ${this.renderSharedMembers()}
      ${this.renderRoomCard()}
      ${this.renderCircuitStrip()}
      ${this.multi?this.renderPickbar():h}
      ${this.renderSideList()}
      ${this.renderSaveDialog()}
      ${this.shows3d?h:c`<div class="legend" aria-label=${o("מקרא")}>
        ${e.zones.length&&this.layers.has("zones")?c`<span><i style="--lg: var(--sw-accent); border-radius: var(--sw-r-2xs); opacity: 0.5"></i>${o("{zonesCount} אזורים",{zonesCount:e.zones.length})}</span>`:h}
        <span><i style="--lg: var(--sw-accent)"></i>${o("חי")}</span>
        <span><i style="--lg: var(--sw-stale)"></i>${o("לא מעודכן")}</span>
        <span><i style="--lg: var(--sw-offline)"></i>${o("מנותק")}</span>
        <span><i style="--lg: var(--sw-forbidden)"></i>${o("ללא הרשאה")}</span>
        <span><i style="--lg: var(--sw-menu-surface); box-shadow: 0 0 0 1px var(--sw-border-strong)"></i>${o("התקן")}</span>
      </div>`}
      ${this.renderCard()}
      ${this.renderConfirm()}
      ${this.renderRoomConfirm()}
      ${this.ticketFor?c`<ticket-map-create open .element=${this.ticketFor} @close=${()=>this.ticketFor=null}></ticket-map-create>`:h}
    `}render(){const e=this.bundle,t=this.floors,s=t.find(r=>r.id===this.floorId),a=e?e.source==="demo"?s?.cameraCount??0:e.anchors.filter(r=>r.resource_type==="camera").length:0,i=this.tree?.source==="api"?this.tree.sites.flatMap(r=>(r.buildings??[]).flatMap(d=>d.floors??[])).find(r=>r.id===this.floorId):null,n=this.embedded?"":e?`${e.buildingName} – ${e.floorName}`:o("מפת קומה");return c`
      <sw-page flush wide class="fpage" data-head heading=${n}>
        ${this.embedded?h:c`<div class="crumbs" slot="crumbs">
            <a href="#/explore/sites">${e?.siteName??o("אתרים")}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <a href="#/explore/buildings/${e?.source==="api"?i?.building_id??"bld-a":"bld-a"}/floors">${e?.buildingName??""}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <span>${e?.floorName??""}</span>
          </div>`}
        <div class="tools" slot="actions" data-tools>
          <div class="layers" role="group" aria-label=${x("floor.layers")}>
            ${gi.filter(r=>(r.id!=="cameras"||zt(!K(),be("cameras_available")))&&(r.id!=="photo"||!!e?.floorImages)).map(r=>c`<button class=${this.layers.has(r.id)?"on":""} title=${r.label()} aria-label=${r.label()} aria-pressed=${this.layers.has(r.id)} @click=${()=>this.toggleLayer(r.id)}><sw-icon name=${r.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-button icon="cube" aria-pressed=${this.shows3d} data-view-3d ?disabled=${!this.shows3d&&(!this.can3d||this.threeState==="loading")}
            title=${R()?this.hasScene?o("מקש 3"):o("אין מבנה מפורסם לקומה הזו"):Re} @click=${()=>this.toggle3d()}>${this.shows3d?"2D":"3D"}</sw-button>
          ${R()?h:c`<span class="note" data-3d-unavailable>${Re}</span>`}
          ${this.compact?h:c`<sw-button icon="layers" aria-pressed=${this.panel} @click=${()=>this.togglePanel()}>${x("floor.layers")}</sw-button>
          ${e&&e.source==="api"?c`<sw-button icon="list" aria-pressed=${this.sideList} data-sidelist-toggle @click=${()=>this.toggleSideList()}>${o("רשימה")}</sw-button>${K()||this.embedded?h:c`<sw-button icon="grid" aria-pressed=${this.multi} data-multi-toggle @click=${()=>this.setMulti(!this.multi)}>${o("בחירת מצלמות")}</sw-button>`}`:h}`}
          ${this.embedded?h:c`<sw-field style="min-inline-size:280px"><select aria-label=${x("floor.switcher")} @change=${r=>z(`/explore/floors/${r.target.value}`)}>${t.map(r=>c`<option value=${r.id} ?selected=${r.id===this.floorId}>${o("{bidi} · {cameraCount} מצלמות{v}",{bidi:ee(r.name),cameraCount:r.cameraCount,v:r.hasPlan?"":o(" · אין תוכנית")})}</option>`)}</select></sw-field>`}
        </div>
        ${this.embedded?h:c`<div class="sub fsub">
            <span>${o("{cameraCount} מצלמות{v}{v2}",{cameraCount:a,v:e&&e.source==="api"?o(" · {v} התקנים{v2}",{v:e.anchors.length-a,v2:e.zones.length?o(" · {zonesCount} אזורים",{zonesCount:e.zones.length}):""}):"",v2:e?.source==="demo"?o(" · נתוני הדגמה"):e?.planStatus==="published"?o(" · תוכנית מפורסמת"):""})}</span>
            ${i?.draft_version_id?c`<sw-badge kind="stale" label=${o("טיוטת תוכנית ממתינה לפרסום")}></sw-badge>`:h}
          </div>`}
        <div class="stage" data-stage>${this.renderStage()}</div>
      </sw-page>
    `}};p.styles=ce`
    ${Ct}
    :host {
      display: flex;
      flex-direction: column;
      block-size: 100%;
      min-block-size: 0;
    }
    /* AUDIT30-I4: the sw-page frame fills the screen; the counts line sits under the title row with the old inset */
    sw-page.fpage {
      flex: 1;
      min-block-size: 0;
    }
    .fsub {
      padding: 0 16px 8px;
      margin: 0;
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
      --hud-circuits-top: ${C}px;
      --hud-bar-top: ${je}px;
      --hud-cols-top: calc(var(--hud-bar-top) + var(--hud-bar-h, 38px) + ${N}px);
      /* the 3D element's slow-device notice stands under the bar (a skin's chips make the bar taller: Bubble's is 54 px) */
      --hud-hint-top: calc(${C}px + var(--hud-bar-h, 38px) + ${N}px);
    }
    .stage[data-corner='pill'] {
      --hud-circuits-top: ${je}px;
    }
    .stage[data-corner='minimap'] {
      --hud-circuits-top: ${C+De+N}px;
      --hud-bar-top: ${C+De+N}px;
    }
    @media (max-width: ${Ms}px) {
      .stage[data-corner='minimap'] {
        --hud-circuits-top: ${C+Ne+N}px;
        --hud-bar-top: ${C+Ne+N}px;
      }
    }
    /* The level bar is centred in the free band: two logical insets (the start edge, and --hud-end) with auto margins and a fit-content size, so it
       is centred in RTL and LTR alike. The old inset-inline-start: 50% + translateX(-50%) shifted it LEFT by half its own width in RTL, off the
       canvas at 390 px and over the corner's blocks everywhere (the owner's pictures). One line; when the band is too narrow for it beside the floor
       chip and the corner's item it takes a row of its own under them (data-hud-row2) and, if it is still wider than the band, wraps to a second line. */
    .levelbar {
      position: absolute;
      inset-block-start: ${C}px;
      inset-inline: ${C}px var(--hud-end, ${C}px);
      margin-inline: auto;
      inline-size: fit-content;
      max-inline-size: calc(100% - ${C}px - var(--hud-end, ${C}px));
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
    /* PLAN3D-R28-UI-2433: the building / spread switch of "every level", inside the level bar after a hairline */
    .stackswitch {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-inline-start: 8px;
      padding-inline-start: 8px;
      border-inline-start: 1px solid var(--sw-border-strong);
    }
    .stage[data-hud-row2] .levelbar {
      inset-block-start: var(--hud-bar-top);
      white-space: normal; /* wider than its band (a docked list, many levels): a second line, never a scrolling bar - every chip stays in view */
      text-align: center;
    }
    .circuits {
      position: absolute;
      inset-inline-end: var(--hud-end, ${C}px);
      inset-block-start: var(--hud-circuits-top, ${C}px);
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
      inset-inline-end: ${C}px;
      inset-block: ${C}px var(--hud-list-bottom, ${Ts}px);
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
      font-weight: var(--sw-fw-semibold);
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
        inset-block-end: calc(${Ps}px + env(safe-area-inset-bottom, 0px));
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
      /* AUDIT30-I4: the tools sit in sw-page's actions (content-sized): capped so the title row stays one line */
      .tools {
        flex-wrap: nowrap;
        overflow-x: auto;
        max-inline-size: 60vw;
      }
      sw-page.fpage {
        --sw-h1: var(--sw-fs-lg);
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
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-bold);
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
      /* the lit tone laid over the opaque surface: a circuit switched on must not show the plan through it (--sw-lit-soft alone is alpha 0.32) */
      background: linear-gradient(var(--sw-lit-soft), var(--sw-lit-soft)), var(--sw-menu-surface);
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
  `;u([O()],p.prototype,"floorId",2);u([O()],p.prototype,"screenState",2);u([O()],p.prototype,"focusZone",2);u([O()],p.prototype,"focusCamera",2);u([O()],p.prototype,"focusEntity",2);u([O()],p.prototype,"focusObject",2);u([O()],p.prototype,"picksParam",2);u([O({type:Boolean,reflect:!0})],p.prototype,"embedded",2);u([O({type:Boolean,reflect:!0})],p.prototype,"compact",2);u([m()],p.prototype,"otherBundles",2);u([m()],p.prototype,"sheetTall",2);u([m()],p.prototype,"focusedObjectId",2);u([m()],p.prototype,"selectedZoneId",2);u([m()],p.prototype,"bundle",2);u([m()],p.prototype,"tree",2);u([m()],p.prototype,"loadError",2);u([m()],p.prototype,"noFloors",2);u([m()],p.prototype,"selectedId",2);u([m()],p.prototype,"ticketFor",2);u([m()],p.prototype,"anchor",2);u([m()],p.prototype,"layers",2);u([m()],p.prototype,"planImage",2);u([m()],p.prototype,"catalogLookup",2);u([m()],p.prototype,"levelFilter",2);u([m()],p.prototype,"r28",2);u([m()],p.prototype,"stackMode",2);u([m()],p.prototype,"stackFocus",2);u([m()],p.prototype,"roomConfirm",2);u([m()],p.prototype,"geometry",2);u([m()],p.prototype,"view3d",2);u([m()],p.prototype,"threeState",2);u([m()],p.prototype,"threeError",2);u([m()],p.prototype,"preset3d",2);u([m()],p.prototype,"walk3d",2);u([m()],p.prototype,"real3d",2);u([m()],p.prototype,"corner3d",2);u([m()],p.prototype,"quality3d",2);u([m()],p.prototype,"catalog3d",2);u([m()],p.prototype,"presenceFade",2);u([m()],p.prototype,"liveTransport",2);u([m()],p.prototype,"stateNow",2);u([m()],p.prototype,"pinned",2);u([m()],p.prototype,"panel",2);u([m()],p.prototype,"multi",2);u([m()],p.prototype,"sideList",2);u([m()],p.prototype,"jumpZoom",2);u([m()],p.prototype,"saveView",2);u([m()],p.prototype,"savedView",2);u([m()],p.prototype,"picked",2);u([m()],p.prototype,"narrow",2);u([m()],p.prototype,"syncConnected",2);u([m()],p.prototype,"action",2);u([m()],p.prototype,"confirmSpec",2);u([Ke("sw-plan-canvas")],p.prototype,"canvas",2);u([Ke(".stage")],p.prototype,"stage",2);u([m()],p.prototype,"presenceSnap",2);u([m()],p.prototype,"actionArgs",2);u([m()],p.prototype,"renaming",2);u([m()],p.prototype,"notice",2);u([m()],p.prototype,"incidentBusy",2);u([m()],p.prototype,"skinBusy",2);u([m()],p.prototype,"skinNote",2);u([m()],p.prototype,"stillsFallback",2);u([m()],p.prototype,"bakeBusy",2);u([m()],p.prototype,"bakeNote",2);u([m()],p.prototype,"viewDials",2);p=u([he("explore-floor-map")],p);export{p as ExploreFloorMap};
