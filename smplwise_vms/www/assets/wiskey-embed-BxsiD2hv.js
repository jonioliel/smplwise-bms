import{nn as fe,bJ as C,cY as me,bK as we,i as be,no as ye,np as ve,nq as P,nr as ge,af as Y,ns as ke,a7 as N,nt as xe,nu as F,nv as H,nw as Ee,nx as Ae,aE as Se,ny as _e,nz as I,nA as g,nB as U,kP as Te,d0 as $e,nC as z,A as w,b as c,nD as j,f as We,nE as Le,nF as Re,g as Ke,v as M,j as m,k as Pe}from"./index-c_ii2C2N.js";import"./wiskey-overview-C7dt5gab.js";import"./wiskey-events-BKnMScPf.js";import"./wiskey-people-C2P9LKYs.js";import{t as o}from"./wiskey-R7kL2mBn.js";import"./sw-logo-art-PLtEZJxU.js";import"./sw-chip-DY4zkYFb.js";import"./access-KADuOlDm.js";import"./wiskey-format-BO63hMTH.js";import"./tts-default-BJZR-hBt.js";import"./if-defined-CapqhvJU.js";import"./sw-table-C6-3GdXK.js";import"./access-events-DLjkh4t3.js";import"./events-logic-RZPPI8OV.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";import"./events-print-PznbawFR.js";import"./wk-deep-links-CIbGfufm.js";import"./deep-links-DZDNxSuN.js";import"./live-DMqV6qVh.js";import"./access-people-BhlpYCRD.js";import"./access-messaging-DYXmLHkX.js";import"./wiskey-profiles-otc-OIy9.js";import"./access-external-Cp1s-Awm.js";/**
 * @license
 * Adapted from the WisKey embed-api-v1 reference client. MIT License.
 * Copyright (c) 2026 Hikvision Intercom Manager contributors
 * The full notice ships in THIRD_PARTY_NOTICES.md of the add-on and in src/wiskey/LICENSE-embed-api-v1.txt.
 */const E="/hikvision-intercom",Ie=1,ze=12e3,Oe=3e3,De=36,re="hikvision-intercom-panel";function Ce(e,t,i=!0,s,n){const r=new URL(E,e);if(i&&(r.searchParams.set("embed","1"),r.searchParams.set("chrome","none")),r.searchParams.set("tab",t.tab),t.tool&&r.searchParams.set("tool",t.tool),i){const a=fe(n);a.density&&r.searchParams.set("density",a.density),a.wall&&r.searchParams.set("wall",a.wall)}for(const[a,h]of Object.entries(s??{}))r.searchParams.set(a,h);return r.href}function B(e){return Array.isArray(e)&&e.every(t=>!!t&&typeof t=="object"&&typeof t.id=="string"&&typeof t.label=="string")}function G(e){return Object.freeze(e.map(t=>Object.freeze({id:t.id,label:t.label})))}function ae(e){if(!e)return null;const t=e.querySelector(re);if(t)return t;for(const i of Array.from(e.querySelectorAll("*"))){const s=i.shadowRoot;if(!s)continue;const n=ae(s);if(n)return n}return null}function Me(e,t={},i=window){const s=i.location.origin;if(s==="null")throw new Error("WisKey requires a same-origin document");let n=t.initial?{tab:t.initial.tab,tool:t.initial.tool||null}:{tab:"overview",tool:null},r=null,a=null,h,b=!1,y=0,A=0;const W=({tab:l,tool:d})=>!!a&&a.tabs.some($=>$.id===l)&&(!d||l==="tools"&&a.tools.some($=>$.id===d));function S(l){return b||!l||typeof l.tab!="string"||l.tool!=null&&typeof l.tool!="string"?!1:a?W(l)?(e.contentWindow?.postMessage({type:"wiskey:navigate",tab:l.tab,tool:l.tool||null},s),!0):!1:(r=l,!1)}function _(l){if(b||l.origin!==s||l.source!==e.contentWindow)return;const d=l.data;if(!(!d||typeof d!="object"))if(d.type==="wiskey:ready"){if(d.version!==Ie){if(a)return;i.clearTimeout(h),t.onUnsupported?.(d.version);return}if(!B(d.tabs)||!B(d.tools)||a)return;if(i.clearTimeout(h),a=Object.freeze({tabs:G(d.tabs),tools:G(d.tools)}),t.onReady?.(a),r){const $=r;r=null,S($)}}else a&&d.type==="wiskey:location"&&typeof d.tab=="string"&&(d.tool===null||typeof d.tool=="string")?(n={tab:d.tab,tool:d.tool},t.onLocation?.(n)):a&&d.type==="wiskey:title"&&typeof d.text=="string"&&t.onTitle?.(d.text)}function T(){if(!b){try{if(e.contentWindow?.location.href==="about:blank")return}catch{}y+=1,y>1&&a&&(a=null,r=null,t.onRemount?.()),!a&&(A=0,k(ze))}}function k(l){i.clearTimeout(h),h=i.setTimeout(f,l)}function f(){if(a||b)return;let l;try{if(e.contentWindow?.location.origin!==s){t.onWaiting?.();return}l=ae(e.contentDocument)}catch{t.onWaiting?.();return}const d=l?.hasAttribute("data-embed-api")?l:null;l?d?d.getAttribute("data-embed-api")!=="1"?t.onUnsupported?.(d.getAttribute("data-embed-api")):t.onWaiting?.():t.onLegacy?.():(t.onWaiting?.(),A<De&&(A+=1,k(Oe)))}function v(){b||(i.clearTimeout(h),a=null,y=0,e.src=Ce(s,n,!0,t.extraParams,typeof t.view=="function"?t.view():t.view))}return i.addEventListener("message",_),e.addEventListener("load",T),v(),{navigate:S,refresh:v,dispose(){b=!0,i.clearTimeout(h),i.removeEventListener("message",_),e.removeEventListener("load",T),a=null,r=null},get catalog(){return a},get confirmed(){return n}}}const oe=["externalAuthSetToken","externalAuthRevokeToken"],R="__smplwiseCompanionRelay",J="__smplwiseBridgeProxy",X="/hikvision-intercom",Z=0,Ve=3e4;function K(e){try{return!!e&&!!(e.externalAppV2||e.externalApp||e.webkit?.messageHandlers?.getExternalAuth)}catch{return!1}}function le(e=window){try{const t=e.top;if(t&&t!==e&&K(t))return t}catch{}return K(e)?e:null}function he(e,t){try{return e.location.origin===t.location.origin}catch{return!1}}function qe(e){const t=e[R];if(t)return t;const i={own:{},had:{},frames:new Set,proxied:new WeakSet};for(const s of oe){i.had[s]=Object.prototype.hasOwnProperty.call(e,s),i.own[s]=e[s];const n=(...r)=>{let a;const h=i.own[s];try{typeof h=="function"&&(a=h.apply(e,r))}finally{Ne(e,i,s,r)}return a};try{Object.defineProperty(e,s,{configurable:!0,enumerable:!0,get:()=>n,set:r=>{i.own[s]=r}})}catch{}}return Object.defineProperty(e,R,{value:i,configurable:!0}),i}function Ye(e,t){if(e[R]===t){for(const i of oe)try{const s=Object.getOwnPropertyDescriptor(e,i);if(!s||!s.get)continue;t.had[i]||t.own[i]!==void 0?Object.defineProperty(e,i,{value:t.own[i],writable:!0,configurable:!0,enumerable:!0}):delete e[i]}catch{}try{delete e[R]}catch{}}}function Ne(e,t,i,s){for(const n of t.frames)try{const r=n.contentWindow;if(!r||!he(r,e)||!t.proxied.has(r))continue;const a=r[i];typeof a=="function"&&a.apply(r,s)}catch{}}function Fe(e,t){if(e.externalAppV2?.postMessage){let i=t;try{i=JSON.parse(t)}catch{}e.externalAppV2.postMessage(JSON.stringify({type:"getExternalAuth",payload:i}))}else e.externalApp?.getExternalAuth?e.externalApp.getExternalAuth(t):e.webkit?.messageHandlers?.getExternalAuth?.postMessage?.(JSON.parse(t))}function O(e,t,i){try{return Object.defineProperty(e,t,{value:i,configurable:!0,writable:!0,enumerable:!0}),e[t]===i}catch{return!1}}function Q(e,t){if(e.externalApp?.[J])return!0;const i={[J]:!0,getExternalAuth:n=>Fe(t,n),revokeExternalAuth:()=>{e.setTimeout(()=>{try{e.externalAuthRevokeToken?.(!1,{message:"not available in an embedded frame"})}catch{}},0)}};let s=O(e,"externalApp",i);return s&&e.externalAppV2!==void 0&&(s=O(e,"externalAppV2",void 0)),s&&e.webkit?.messageHandlers&&(s=O(e,"webkit",{messageHandlers:{}})),s}function He(e){const t=e.location.pathname;return t===X||t.startsWith(`${X}/`)||t.startsWith("/auth/")}function Ue(e,t,i=window){const s=le(i);if(!s)return null;const n=qe(s);n.frames.add(e);let r="",a=null,h=0,b=0,y=!1;const A=()=>_();function W(){let f=null,v=null;try{if(f=e.contentWindow,v=f?.document??null,!f||!v||v===a||v.URL==="about:blank")return!1}catch{return!1}a=v;let l;!he(f,i)||!He(f)?l="failed":v.readyState!=="loading"?l=Q(f,s)?"late":K(f)?"native":"failed":Q(f,s)?l="early":l=K(f)?"native":"failed",(l==="early"||l==="late")&&n.proxied.add(f),r=l;try{f.addEventListener("pagehide",A)}catch{}return t?.(l),!0}function S(){h=0,!y&&(W()||Date.now()<b&&(h=i.setTimeout(S,Z)))}function _(){y||(b=Date.now()+Ve,h||(h=i.setTimeout(S,Z)))}const T=()=>{y||W()},k=()=>{y||(y=!0,i.clearTimeout(h),e.removeEventListener("load",T),i.removeEventListener("pagehide",k),n.frames.delete(e),n.frames.size||Ye(s,n))};return e.addEventListener("load",T),i.addEventListener("pagehide",k),_(),{get state(){return r},dispose:k}}function je(e,t){return e==="loading"&&t==="pending"?"unreachable":e}const V={loading:"טוען את WisKey…",unreachableTitle:"לא ניתן לטעון את WisKey",unreachableHint:"WisKey לא ענה בזמן. אפשר לנסות שוב.",retry:"נסה שוב"},de=C("en","i18n/wiskey-embed","en"),ce=C("ar","i18n/wiskey-embed","ar"),ue=C("ru","i18n/wiskey-embed","ru");function Be(){return me(["en","ar","ru"])}const Ge={he:V,en:de,ar:ce,ru:ue},Je=["ar","ru"];function L(e,t=Be()){return Ge[t][e]??V[e]}we("i18n/wiskey-embed",{he:V,en:de,ar:ce,ru:ue},Je);var Xe=Object.defineProperty,Ze=Object.getOwnPropertyDescriptor,p=(e,t,i,s)=>{for(var n=s>1?void 0:s?Ze(t,i):t,r=e.length-1,a;r>=0;r--)(a=e[r])&&(n=(s?a(t,i,n):a(n))||n);return s&&n&&Xe(t,i,n),n};const pe=re,Qe=2e4,et=35e3,ee=25e3,tt=1e4,it=15e3,te=400,st=3e3,nt=2e3,rt=0,at=0,ot=1e3,D={overview:o("מרכז הכניסה"),events:o("פעילות"),users:o("אנשים"),devices:o("עמדות"),sync:o("סנכרון"),health:o("בריאות"),audit:o("יומן שינויים"),tools:o("ניהול"),camera_wall:o("קיר מצלמות")};function q(e,t,i=0){if(i>12)return null;const s=e.querySelector(t);if(s)return s;for(const n of Array.from(e.querySelectorAll("*"))){const r=n.shadowRoot;if(r){const a=q(r,t,i+1);if(a)return a}}return null}function ie(e,t){try{const i=t.querySelector("home-assistant"),s=i?.shadowRoot?.querySelector("home-assistant-main");if(!i||!s)return"";const n=()=>i.hass;if(n()?.kioskMode!==!0){const h=e.CustomEvent;e.dispatchEvent(new h("hass-kiosk-mode",{detail:{enable:!0}}))}if(n()?.kioskMode===!0)return"kiosk";const r=s.shadowRoot;if(!r)return"visible";if(!r.querySelector("style[data-smplwise-chrome]")){const h=t.createElement("style");h.setAttribute("data-smplwise-chrome",""),h.textContent=":host{--ha-sidebar-width:0px!important;--mdc-drawer-width:0px!important;--ha-top-app-bar-width:100%!important}ha-sidebar{display:none!important}",r.appendChild(h)}const a=r.querySelector("ha-sidebar");return a&&e.getComputedStyle(a).display==="none"?"css":"visible"}catch{return"visible"}}function se(e){try{const t=e;return!!t&&!!(t.externalAppV2||t.externalApp||t.webkit?.messageHandlers?.getExternalAuth||t.webkit?.messageHandlers?.externalBus)}catch{return!1}}function lt(e=window){if(/Home ?Assistant\//.test(e.navigator.userAgent)||se(e))return!0;try{return e.top!==e&&se(e.top)}catch{return!1}}function ne(e){const t=new URLSearchParams({tab:e.tab});return e.tool&&t.set("tool",e.tool),`${E}?${t.toString()}`}function ht(e=window,t=E){let i=e;try{e.top&&e.top!==e&&(e.top.location.pathname,i=e.top)}catch{i=e}if(i===e){e.location.assign(t);return}const s=()=>{try{i.location.assign(t)}catch{e.open(t,"_top")}};try{i.history.pushState(null,"",t);const r=i.CustomEvent;i.dispatchEvent(new r("location-changed",{detail:{replace:!1}}))}catch{s();return}const n=e.frameElement;e.setTimeout(()=>{try{n&&!n.isConnected||!!q(i.document,pe)||s()}catch{s()}},ot)}const dt={overview:"wiskey-overview",events:"wiskey-events",users:"wiskey-people"},x=(e,t)=>!!e&&!!t&&e.tab===t.tab&&(e.tool||null)===(t.tool||null);let u=class extends be{constructor(){super(...arguments),this.tab="overview",this.tool="",this.phase="loading",this.mode="pending",this.chrome="",this.tabApplied=null,this.catalog=null,this.confirmed=null,this.panelTitle="",this.unsupportedVersion="",this.frameKey=0,this.viewReady=ye(),this.loadedView=null,this.direct="",this.forbidden=!1,this.fullLeft=!1,this.fullActive=!1,this.inerted=[],this.connector=null,this.opened=null,this.sent=[],this.wanted=null,this.detached=!1,this.timer=0,this.loadTimer=0,this.loadedAt=0,this.tabSince=0,this.tabAttempts=0,this.lastAttempt=0,this.panelEl=null,this.guarded=new WeakSet,this.frameWin=null,this.phoneRelay=!1,this.bridge=null,this.shim="",this.relayRefused="",this.onSize=()=>this.requestUpdate(),this.onView=()=>{this.forbidden||this.direct||!this.connector||!this.loadedView||ve(this.loadedView,P())||this.reload()},this.onEsc=e=>{e.key==="Escape"&&!e.defaultPrevented&&this.leaveFull()},this.onClick=e=>{if(this.mode!=="v1"||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const t=e.composedPath().find(r=>r instanceof HTMLAnchorElement),i=t?.getAttribute("href")??"";if(!t||!ge(i)||t.target&&t.target!=="_self")return;const s=Y(i);if(ke(s,N()).kind!=="embed")return;e.preventDefault();const n=this.resolve(xe(s));x(n,this.reference())||this.send(n,!0)},this.onFrameNav=()=>this.tick()}connectedCallback(){if(super.connectedCallback(),window.addEventListener(F,this.onSize),window.addEventListener(H,this.onView),this.viewReady?Ae():Ee().then(()=>this.viewReady=!0),N()&&!Se("access.read")){this.forbidden=!0;return}if(lt()&&(this.phoneRelay=_e&&!!le()&&this.direct!=="companion",!this.phoneRelay)){this.direct="companion";return}window.addEventListener("click",this.onClick,!0),this.detached&&(this.detached=!1,this.resetFrameState(),this.frameKey++)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("click",this.onClick,!0),window.removeEventListener(F,this.onSize),window.removeEventListener(H,this.onView),this.fullLeft=!1,this.setFullActive(!1),this.dropFrame(),this.detached=!0}size(){return this.forbidden||this.direct||I==="full"&&this.fullLeft||I==="fit"&&j>=100?"normal":I}leaveFull(){this.fullLeft=!0,this.requestUpdate()}setFullActive(e){if(e!==this.fullActive)if(this.fullActive=e,e){const t=this.getRootNode(),i=t instanceof ShadowRoot?Array.from(t.querySelectorAll("nav.rail, header.topbar, nav.bottom, .float, .searchscrim, .sysbanner, main > :not(.screen), sw-user-menu, sw-nav-order")):[];this.inerted=i.filter(s=>!s.inert);for(const s of this.inerted)s.inert=!0;window.addEventListener("keydown",this.onEsc)}else{for(const t of this.inerted)t.inert=!1;this.inerted=[],window.removeEventListener("keydown",this.onEsc)}}updated(e){const t=this.size();this.setAttribute("data-size",t),this.setFullActive(t==="full"),this.ensureConnector(),(e.has("tab")&&e.get("tab")!==void 0||e.has("tool")&&e.get("tool")!==void 0)&&!this.forbidden&&!this.direct&&this.onRequest()}request(){return{tab:this.tab||"overview",tool:this.tab==="tools"&&this.tool?this.tool:null}}resolve(e){const t=this.catalog;return!t||t.tabs.some(i=>i.id===e.tab)?e:!e.tool&&t.tools.some(i=>i.id===e.tab)?{tab:"tools",tool:e.tab}:e}frame(){return this.renderRoot.querySelector("iframe")}ensureConnector(){if(this.connector||this.forbidden||this.direct)return;const e=this.frame();e&&(this.resetFrameState(),this.opened=this.request(),this.bridge?.dispose(),this.bridge=this.phoneRelay?Ue(e,t=>this.onShim(t)):null,this.loadedView=P(),this.connector=Me(e,{initial:this.opened,view:()=>this.loadedView=P(),extraParams:this.bridge?{external_auth:"1"}:void 0,onReady:t=>this.onReady(t),onLocation:t=>this.onLocation(t),onTitle:t=>this.panelTitle=t,onLegacy:()=>this.onLegacy(),onWaiting:()=>this.onWaiting(),onUnsupported:t=>this.onUnsupported(t),onRemount:()=>this.onRemount()}),this.startLoadTimer())}resetFrameState(){this.stopTimers(),this.phase="loading",this.mode="pending",this.chrome="",this.tabApplied=null,this.panelTitle="",this.unsupportedVersion="",this.catalog=null,this.confirmed=null,this.sent=[],this.wanted=null,this.loadedAt=0,this.panelEl=null}dropFrame(){this.stopTimers(),this.connector?.dispose(),this.connector=null,this.bridge?.dispose(),this.bridge=null,this.shim="";const e=this.frame();if(e){try{e.src="about:blank"}catch{}e.remove()}this.panelEl=null,g({confirmed:null})}reload(){if(this.direct="",this.relayRefused="",this.connector&&this.mode==="v1"){this.resetFrameState(),g({catalog:null,confirmed:null}),this.opened=this.connector.confirmed,this.connector.refresh(),this.startLoadTimer();return}this.dropFrame(),this.resetFrameState(),this.frameKey++}stopTimers(){window.clearInterval(this.timer),window.clearTimeout(this.loadTimer),this.timer=0,this.loadTimer=0,this.frameWin?.removeEventListener("location-changed",this.onFrameNav),this.frameWin=null}startLoadTimer(){window.clearTimeout(this.loadTimer),this.loadTimer=window.setTimeout(()=>{(this.phase==="loading"||this.phase==="waiting")&&!this.loadedAt&&(this.phase="unreachable")},Qe)}startSettleTimer(){window.clearTimeout(this.loadTimer),this.loadTimer=window.setTimeout(()=>{this.phase=je(this.phase,this.mode)},et)}onReady(e){this.stopTimers(),this.mode="v1",this.phase="ready",this.catalog=e,this.confirmed=null,this.sent=[],g({catalog:e,confirmed:null});const t=this.wanted?this.resolve(this.wanted):null;this.wanted=null,t&&!x(t,this.opened)&&this.send(t,!1)}reference(){return this.expireSent(),this.sent.length?this.sent[this.sent.length-1].loc:this.confirmed??this.opened}expireSent(){const e=Date.now();this.sent=this.sent.filter(t=>e-t.at<=st)}send(e,t){return this.connector?.navigate(e)?(this.expireSent(),this.sent=[...this.sent.map(i=>({...i,push:!1})),{loc:e,push:t,at:Date.now()}].slice(-4),!0):!1}onLocation(e){this.confirmed=e,g({confirmed:e}),this.expireSent();const t=this.sent[this.sent.length-1],i=this.sent.findIndex((r,a)=>a<this.sent.length-1&&x(e,r.loc));if(t&&!x(e,t.loc)&&i>=0){this.sent.splice(i,1);return}const s=this.sent[this.sent.length-1],n=!!s&&s.push&&x(e,s.loc);this.sent=[],this.mirror(e,n)}mirror(e,t=!1){const i=Y();if(i.mode!=="wiskey")return;const s=U(e.tab),n=Le(s),r=!!n&&Re[n]==="smplwise",a=new URLSearchParams(i.params);a.set("wiskey_tab",e.tab),e.tool?a.set("wiskey_tool",e.tool):a.delete("wiskey_tool"),(t?Te:$e)(r?i.path:z(e),a)}onRequest(){if(this.phase==="not_installed"||this.phase==="unreachable"||this.phase==="blocked"||this.phase==="unsupported"){this.reload();return}if(this.mode==="legacy"){this.resetTab(),this.tick();return}const e=this.resolve(this.request());if(this.mode==="v1"){if(x(e,this.reference()))return;!this.send(e,!1)&&this.confirmed&&this.mirror(this.confirmed);return}this.wanted=e}onRemount(){if(this.mode!=="v1")return;const e=this.confirmed??this.opened;this.resetFrameState(),this.opened=e,g({catalog:null,confirmed:null})}onLegacy(){this.mode!=="pending"||this.phase!=="loading"&&this.phase!=="waiting"||(this.mode="legacy",this.catalog=null,g({catalog:null,confirmed:null}),this.resetTab(),window.clearInterval(this.timer),this.timer=window.setInterval(()=>this.tick(),te),this.tick())}onWaiting(){this.mode==="pending"&&(this.phase==="loading"||this.phase==="waiting")&&(this.phase="waiting")}onUnsupported(e){this.mode!=="v1"&&(this.phase==="login_required"||this.phase==="not_installed"||this.phase==="unreachable"||this.phase==="blocked"||(this.stopTimers(),this.mode="unsupported",this.phase="unsupported",this.unsupportedVersion=String(e??""),this.catalog=null,g({catalog:null,confirmed:null})))}onLoad(){window.setTimeout(()=>this.afterLoad(),0)}afterLoad(){const e=this.frame();if(!e||!this.connector)return;try{if(e.contentWindow?.location.href==="about:blank")return}catch{}this.loadedAt=Date.now(),this.panelEl=null,this.resetTab(),window.clearTimeout(this.loadTimer);let t=null;try{t=e.contentDocument,e.contentWindow?.location.pathname}catch{t=null}if(!t){this.phase="blocked";return}this.mode==="v1"||this.mode==="unsupported"||(this.frameWin?.removeEventListener("location-changed",this.onFrameNav),this.frameWin=e.contentWindow,this.frameWin?.addEventListener("location-changed",this.onFrameNav),this.startSettleTimer(),window.clearInterval(this.timer),this.timer=window.setInterval(()=>this.tick(),te),this.tick())}tick(){const e=this.frame();if(!(!e||!this.loadedAt||this.mode==="v1"||this.mode==="unsupported"))try{const t=e.contentWindow,i=e.contentDocument;if(!t||!i)return this.phase="blocked",this.settle();const s=t.location.pathname;if(s.startsWith("/auth/"))return this.goDirect();const n=i.querySelector("home-assistant");if(!n){i.readyState==="complete"&&(this.phase="unreachable",this.settle());return}const r=n.hass?.panels;if(r&&!Object.keys(r).includes(E.slice(1)))return this.phase="not_installed",this.settle();const a=this.mode==="legacy";a&&(this.chrome=this.chrome==="kiosk"||this.chrome==="css"?this.keepChrome(t,i):ie(t,i)),(!this.panelEl?.isConnected||this.panelEl.ownerDocument!==i)&&(this.panelEl=q(i,pe));const h=this.panelEl;if(!h){if(Date.now()-this.loadedAt>(this.bridge?tt:ee)){if(!n.hass)return this.goDirect();this.phase=s.startsWith(E)?"unreachable":"not_installed",this.settle()}return}if(!a){this.timer&&this.slowDown();return}this.phase="ready",this.guardMenu(h),this.applyTab(h),this.tabApplied!==null&&(this.chrome==="kiosk"||this.chrome==="css"||Date.now()-this.loadedAt>ee)&&this.slowDown()}catch{}}keepChrome(e,t){return ie(e,t)||this.chrome}guardMenu(e){this.guarded.has(e)||this.chrome!=="kiosk"&&this.chrome!=="css"||(this.guarded.add(e),e.addEventListener("hass-toggle-menu",t=>t.stopPropagation()))}resetTab(){this.tabApplied=null,this.tabSince=0,this.tabAttempts=0,this.lastAttempt=0}applyTab(e){if(this.tabApplied!==null)return;if(e._tab===this.tab){this.tabApplied=!0;return}this.tabSince===0&&(this.tabSince=Date.now());const t=Date.now()-this.tabSince>it;if(typeof e.navigate!="function"){this.tabApplied=!1;return}if("_session"in e){if(e._session===void 0){t&&(this.tabApplied=!1);return}e.navigate(this.tab),this.tabApplied=e._tab===this.tab;return}if(t||this.tabAttempts>=5){this.tabApplied=!1;return}Date.now()-this.lastAttempt<1e3||(this.lastAttempt=Date.now(),this.tabAttempts++,e.navigate(this.tab),e._tab===this.tab&&(this.tabApplied=!0))}slowDown(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>this.tick(),nt)}onShim(e){this.shim=e,e!=="early"&&(this.relayRefused=e,this.goDirect())}goDirect(){this.dropFrame(),this.phase="login_required",this.direct="login_required"}settle(){window.clearInterval(this.timer),this.timer=0}shown(){return this.mode==="v1"&&this.confirmed?this.confirmed:this.request()}labelOf(e){return this.catalog?.tabs.find(t=>t.id===e)?.label||D[e]||e}renderError(){const e=o("אפשר לנסות שוב, לעבור למסך WisKey העצמאי או לפתוח אותו בחלון חדש, או לבחור בהגדרות ‹ מתגי מסכי כניסה את מסכי Arx."),i={not_installed:{heading:o("לוח WisKey לא נמצא"),hint:`${o("האינטגרציה hikvision_intercom לא רשמה את הלוח {path} (לא מותקנת, לא נטענה, או שהמשתמש לא רואה אותו).",{path:E})} ${e}`,state:"empty"},unreachable:{heading:L("unreachableTitle"),hint:L("unreachableHint"),state:"stale"},blocked:{heading:o("הדפדפן לא מאפשר להטמיע את WisKey כאן"),hint:`${o("המסגרת נחסמה (מדיניות מסגרות) או הופנתה לכתובת אחרת.")} ${e}`,state:"error"},unsupported:{heading:o("גרסת ממשק ההטמעה של WisKey אינה נתמכת"),hint:`${o("WisKey המותקן מדבר בגרסת ממשק הטמעה {version}, ו־Arx מכיר את גרסה 1.",{version:this.unsupportedVersion||o("לא ידועה")})} ${e}`,state:"error"}}[this.phase];return i?c`<div class="over" data-wiskey-embed-error=${this.phase}>
      <div>
        <sw-state-panel icon="door" state=${i.state} heading=${i.heading} hint=${i.hint}></sw-state-panel>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${()=>this.reload()}>${L("retry")}</sw-button>
          ${this.openInHaButton()}
          ${this.fullLink()}
        </div>
      </div>
    </div>`:w}openInHaButton(e="secondary"){return c`<sw-button size="sm" variant=${e} icon="door" data-wiskey-open-ha @click=${()=>ht(window,ne(this.shown()))}>${o("פתח ב-WisKey")}</sw-button>`}renderDirect(){const e=D[this.tab]??this.tab,t=this.direct==="companion"||this.phoneRelay,i=this.direct==="companion"?o("בטלפון WisKey נפתח באפליקציה עצמה"):this.phoneRelay&&this.relayRefused?o("ההטמעה באפליקציה (ניסיוני) לא נתמכת במכשיר הזה, ולכן WisKey נפתח באפליקציה עצמה"):this.phoneRelay?o("ההטמעה באפליקציה (ניסיוני) לא הצליחה להתחבר, ולכן WisKey נפתח באפליקציה עצמה"):o("נדרשת התחברות בתוך המסגרת, ולכן WisKey עובר למסך נפרד"),s=dt[this.tab],n=U(this.tab);return c`
      <div class="bar" data-wiskey-embed-bar>
        <span class="note ${this.direct==="companion"?"":"warn"}" data-wiskey-embed-note=${this.direct} ?data-phone-relay=${this.phoneRelay} data-relay-refused=${this.relayRefused}>${i}</span>
        <span class="grow"></span>
        ${s?this.openInHaButton():w}
        ${t?w:this.fullLink()}
      </div>
      ${s==="wiskey-overview"?c`<wiskey-overview></wiskey-overview>`:s==="wiskey-events"?c`<wiskey-events></wiskey-events>`:s==="wiskey-people"?c`<wiskey-people></wiskey-people>`:c`<div class="only" data-wiskey-embed-only=${n}>
                <div>
                  <sw-state-panel icon="door" state="empty" heading=${`WisKey · ${e}`} hint=${`${i}. ${o('המסך "{label}" קיים רק בממשק של WisKey.',{label:e})}`}></sw-state-panel>
                  <div class="actions">
                    ${this.openInHaButton("primary")}
                    ${this.direct==="companion"?w:c`<sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${()=>this.reload()}>${o("נסה שוב")}</sw-button>`}
                  </div>
                </div>
              </div>`}
    `}fullLink(){return c`<a class="full" data-wiskey-embed-full href=${ne(this.shown())} target="_blank" rel="noopener"><sw-icon name="expand" size=${14}></sw-icon>${o("פתח בחלון מלא")}</a>`}statusNote(){if(this.phase==="waiting")return[c`<span class="note warn" data-wiskey-embed-note="waiting">${o("WisKey עדיין לא אישר את החיבור - ממתין לטעינה או להזדהות בתוך WisKey")}</span>`];const e=[];return this.phase==="ready"&&this.mode==="legacy"&&this.chrome==="visible"&&e.push(c`<span class="note" data-wiskey-embed-note="chrome">${o("תפריט נוסף מוצג סביב WisKey (ההסתרה לא נתמכת בגרסה הזו).")}</span>`),this.phase==="ready"&&this.mode==="legacy"&&this.tabApplied===!1&&e.push(c`<span class="note" data-wiskey-embed-note="tab">${o('לא ניתן לפתוח ישירות את "{tab}"; WisKey נפתח במסך שלו.',{tab:D[this.tab]??this.tab})}</span>`),e}renderTools(){const e=this.catalog;if(this.mode!=="v1"||!e||this.confirmed?.tab!=="tools")return w;const t=new Set(e.tabs.map(n=>n.id)),i=e.tools.filter(n=>n.id&&!t.has(n.id));if(!i.length)return w;const s=this.confirmed.tool;return c`<nav class="tools" aria-label=${o("כלי הניהול של WisKey")} data-wiskey-tools>
      <a href=${`#${z({tab:"tools"})}`} class=${s?"":"on"} data-wiskey-tool="" aria-current=${s?"false":"page"}>${this.labelOf("tools")}</a>
      ${i.map(n=>c`<a href=${`#${z({tab:"tools",tool:n.id})}`} class=${s===n.id?"on":""} data-wiskey-tool=${n.id} aria-current=${s===n.id?"page":"false"}>${n.label||n.id}</a>`)}
    </nav>`}render(){if(this.forbidden)return c`<sw-page heading="WisKey"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading=${o("אין לך הרשאת צפייה בבקרת הכניסה")} hint=${o("נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת.")}></sw-state-panel></sw-page>`;if(this.direct)return this.renderDirect();const e=this.phase==="not_installed"||this.phase==="unreachable"||this.phase==="blocked"||this.phase==="unsupported",t=this.shown(),i=this.mode==="v1"&&this.panelTitle?this.panelTitle:this.labelOf(t.tab),s=this.mode==="v1"?this.confirmed:null,n=this.statusNote(),r=this.size();return c`
      ${r==="full"?c`<button type="button" class="exit" data-wiskey-exit aria-label=${o("יציאה ממסך מלא")} title=${o("יציאה ממסך מלא (Esc)")} @click=${()=>this.leaveFull()}><sw-icon name="close" size=${16}></sw-icon></button>`:w}
      ${this.renderTools()}
      <div class="stage" ?data-fit=${r==="fit"} style=${r==="fit"?`--wk-scale:${j/100}`:""}>
        ${this.viewReady?We(this.frameKey,c`<iframe
                data-wiskey-embed-frame
                data-phase=${this.phase}
                data-embed-mode=${this.mode}
                data-chrome=${this.chrome}
                data-tab-applied=${this.tabApplied===null?"":String(this.tabApplied)}
                data-confirmed-tab=${s?.tab??""}
                data-confirmed-tool=${s?.tool??""}
                data-companion-shim=${this.shim}
                title=${`WisKey · ${i}`}
                data-wiskey-embed-title=${i}
                ?data-hidden=${e}
                allow="autoplay; microphone; camera; fullscreen; clipboard-write"
                allowfullscreen
                @load=${()=>this.onLoad()}
              ></iframe>`):w}
        ${n.length?c`<div class="status" role="status" data-wiskey-embed-status>${n}</div>`:w}
        ${this.phase==="loading"?c`<div class="over"><sw-state-panel state="loading" heading=${L("loading")}></sw-state-panel></div>`:w}
        ${e?this.renderError():w}
      </div>
    `}};u.styles=Ke`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      block-size: 100%;
    }
    :host([data-direct]:not([data-direct=''])) {
      /* no frame: the SMPLWISE screen (or the note) flows and scrolls with the shell like any other screen */
      block-size: auto;
    }
    .only {
      display: grid;
      place-items: center;
      padding: 24px var(--sw-page-pad);
    }
    .actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      padding: 6px var(--sw-page-pad);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .bar .grow {
      flex: 1;
    }
    .note {
      color: var(--sw-text-2);
    }
    .note.warn {
      color: var(--sw-warning-text, var(--sw-text));
    }
    a.full {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    a.full:hover {
      text-decoration: underline;
    }
    nav.tools {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 6px var(--sw-page-pad);
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    nav.tools a {
      padding: 4px 10px;
      border-radius: var(--sw-r-xs);
      color: var(--sw-text-2);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    nav.tools a:hover {
      color: var(--sw-text);
    }
    nav.tools a.on {
      background: var(--sw-surface-3);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* the framed screen: the stage fills the host, the frame fills the stage - no border, outline, padding, margin,
       minimum height or darker canvas anywhere around it */
    .stage {
      --wk-crop: ${rt}px;
      position: relative;
      flex: 1 1 0;
      min-block-size: 0;
      min-inline-size: 0;
      display: flex;
      margin: 0;
      padding: 0;
      border: 0;
      overflow: hidden; /* clips the frame's outermost --wk-crop pixels (0 now: nothing of WisKey is clipped) */
      background: var(--sw-surface);
    }
    @media (max-width: 767px) {
      .stage {
        --wk-crop: ${at}px;
      }
    }
    iframe {
      flex: 0 0 auto;
      inline-size: calc(100% + 2 * var(--wk-crop));
      block-size: calc(100% + 2 * var(--wk-crop));
      min-inline-size: 0;
      min-block-size: 0;
      margin: calc(-1 * var(--wk-crop));
      padding: 0;
      display: block;
      border: 0;
      outline: none;
      background: var(--sw-surface);
    }
    /* waiting / older build: one floating status line over the top edge of the frame, never a row that takes height */
    .status {
      position: absolute;
      inset-block-start: 8px;
      inset-inline: 12px;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    }
    .status .note {
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
    }
    /* size "מותאם" (ui.wiskey_size = fit): the frame is rendered 1/scale larger and scaled down from its top-left corner
       (physical, so RTL does not matter), so the wrapper - and the box WisKey lays out in - is bigger than what is
       shown and the visible result still fills the stage exactly. Pointer coordinates follow the transform. */
    .stage[data-fit] iframe {
      position: absolute;
      inset-block-start: calc(-1 * var(--wk-crop));
      left: calc(-1 * var(--wk-crop));
      margin: 0;
      inline-size: auto;
      block-size: auto;
      width: calc((100% + 2 * var(--wk-crop)) / var(--wk-scale));
      height: calc((100% + 2 * var(--wk-crop)) / var(--wk-scale));
      transform: scale(var(--wk-scale));
      transform-origin: 0 0;
    }
    /* size "מסך מלא" (ui.wiskey_size = full): the whole viewport, over the rail, top bar and bottom bar, with one small
       floating exit control in a top corner */
    :host([data-size='full']) {
      position: fixed;
      inset: 0;
      z-index: calc(var(--sw-z-topbar) + 10);
      block-size: auto;
      box-sizing: border-box;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      background: var(--sw-surface);
    }
    button.exit {
      position: absolute;
      inset-block-start: max(8px, env(safe-area-inset-top, 0px));
      inset-inline-end: max(8px, env(safe-area-inset-left, 0px));
      z-index: 3;
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid var(--sw-border);
      background: color-mix(in srgb, var(--sw-surface) 85%, transparent);
      color: var(--sw-text-2);
      box-shadow: var(--sw-shadow-1);
      cursor: pointer;
      opacity: 0.7;
    }
    button.exit:hover,
    button.exit:focus-visible {
      opacity: 1;
      color: var(--sw-text);
    }
    iframe[data-hidden] {
      visibility: hidden;
    }
    .over {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      padding: 16px;
    }
  `;p([M()],u.prototype,"tab",2);p([M()],u.prototype,"tool",2);p([m()],u.prototype,"phase",2);p([m()],u.prototype,"mode",2);p([m()],u.prototype,"chrome",2);p([m()],u.prototype,"tabApplied",2);p([m()],u.prototype,"catalog",2);p([m()],u.prototype,"confirmed",2);p([m()],u.prototype,"panelTitle",2);p([m()],u.prototype,"unsupportedVersion",2);p([m()],u.prototype,"frameKey",2);p([m()],u.prototype,"viewReady",2);p([M({reflect:!0,attribute:"data-direct"})],u.prototype,"direct",2);p([m()],u.prototype,"shim",2);p([m()],u.prototype,"relayRefused",2);u=p([Pe("wiskey-embed")],u);export{E as WISKEY_PANEL_PATH,u as WiskeyEmbed};
