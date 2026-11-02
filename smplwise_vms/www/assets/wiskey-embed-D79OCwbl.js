import{bA as he,a as de,bB as ce,bC as ue,bD as K,bE as pe,aA as M,bF as fe,i as V,bG as me,bH as H,bI as q,bJ as we,bK as be,av as ye,bL as ve,bM as P,bN as v,bO as N,bP as ge,r as ke,bQ as I,A as m,e as d,bR as Y,P as xe,bS as Ee,bw as Ae,E as Se,F as D,G as f,H as We}from"./index-DzjkD5gF.js";import"./wiskey-overview-CRt9Fpy3.js";import"./wiskey-events-DZhm8HBn.js";import"./wiskey-people-Df9ZUgQi.js";import"./sw-logo-art-Va6y_cIM.js";import"./sw-chip-CbgQ6Ans.js";import"./access-DHDfmQoI.js";import"./intercom-DoMJOSDj.js";import"./wiskey-format-B1C9aa4N.js";import"./sw-table-DdyEPcGY.js";import"./access-events-BmV4mpXK.js";import"./events-logic-CB6NBjhX.js";import"./live-CqA95ux7.js";import"./access-people-DfeC4yhh.js";import"./access-messaging-Do4FDMtW.js";const x="/hikvision-intercom",Te=1,_e=12e3,Le=3e3,$e=36,ie="hikvision-intercom-panel";function Re(e,t,i=!0,s,n){const a=new URL(x,e);if(i&&(a.searchParams.set("embed","1"),a.searchParams.set("chrome","none")),a.searchParams.set("tab",t.tab),t.tool&&a.searchParams.set("tool",t.tool),i){const r=he(n);r.density&&a.searchParams.set("density",r.density),r.wall&&a.searchParams.set("wall",r.wall)}for(const[r,l]of Object.entries(s??{}))a.searchParams.set(r,l);return a.href}function F(e){return Array.isArray(e)&&e.every(t=>!!t&&typeof t=="object"&&typeof t.id=="string"&&typeof t.label=="string")}function U(e){return Object.freeze(e.map(t=>Object.freeze({id:t.id,label:t.label})))}function se(e){if(!e)return null;const t=e.querySelector(ie);if(t)return t;for(const i of Array.from(e.querySelectorAll("*"))){const s=i.shadowRoot;if(!s)continue;const n=se(s);if(n)return n}return null}function Ke(e,t={},i=window){const s=i.location.origin;if(s==="null")throw new Error("WisKey requires a same-origin document");let n=t.initial?{tab:t.initial.tab,tool:t.initial.tool||null}:{tab:"overview",tool:null},a=null,r=null,l,w=!1,b=0,E=0;const _=({tab:o,tool:h})=>!!r&&r.tabs.some(T=>T.id===o)&&(!h||o==="tools"&&r.tools.some(T=>T.id===h));function A(o){return w||!o||typeof o.tab!="string"||o.tool!=null&&typeof o.tool!="string"?!1:r?_(o)?(e.contentWindow?.postMessage({type:"wiskey:navigate",tab:o.tab,tool:o.tool||null},s),!0):!1:(a=o,!1)}function S(o){if(w||o.origin!==s||o.source!==e.contentWindow)return;const h=o.data;if(!(!h||typeof h!="object"))if(h.type==="wiskey:ready"){if(h.version!==Te){if(r)return;i.clearTimeout(l),t.onUnsupported?.(h.version);return}if(!F(h.tabs)||!F(h.tools)||r)return;if(i.clearTimeout(l),r=Object.freeze({tabs:U(h.tabs),tools:U(h.tools)}),t.onReady?.(r),a){const T=a;a=null,A(T)}}else r&&h.type==="wiskey:location"&&typeof h.tab=="string"&&(h.tool===null||typeof h.tool=="string")?(n={tab:h.tab,tool:h.tool},t.onLocation?.(n)):r&&h.type==="wiskey:title"&&typeof h.text=="string"&&t.onTitle?.(h.text)}function W(){if(!w){try{if(e.contentWindow?.location.href==="about:blank")return}catch{}b+=1,b>1&&r&&(r=null,a=null,t.onRemount?.()),!r&&(E=0,g(_e))}}function g(o){i.clearTimeout(l),l=i.setTimeout(p,o)}function p(){if(r||w)return;let o;try{if(e.contentWindow?.location.origin!==s){t.onWaiting?.();return}o=se(e.contentDocument)}catch{t.onWaiting?.();return}const h=o?.hasAttribute("data-embed-api")?o:null;o?h?h.getAttribute("data-embed-api")!=="1"?t.onUnsupported?.(h.getAttribute("data-embed-api")):t.onWaiting?.():t.onLegacy?.():(t.onWaiting?.(),E<$e&&(E+=1,g(Le)))}function y(){w||(i.clearTimeout(l),r=null,b=0,e.src=Re(s,n,!0,t.extraParams,typeof t.view=="function"?t.view():t.view))}return i.addEventListener("message",S),e.addEventListener("load",W),y(),{navigate:A,refresh:y,dispose(){w=!0,i.clearTimeout(l),i.removeEventListener("message",S),e.removeEventListener("load",W),r=null,a=null},get catalog(){return r},get confirmed(){return n}}}const ne=["externalAuthSetToken","externalAuthRevokeToken"],$="__smplwiseCompanionRelay",j="__smplwiseBridgeProxy",B="/hikvision-intercom",G=0,Pe=3e4;function R(e){try{return!!e&&!!(e.externalAppV2||e.externalApp||e.webkit?.messageHandlers?.getExternalAuth)}catch{return!1}}function ae(e=window){try{const t=e.top;if(t&&t!==e&&R(t))return t}catch{}return R(e)?e:null}function re(e,t){try{return e.location.origin===t.location.origin}catch{return!1}}function Ie(e){const t=e[$];if(t)return t;const i={own:{},had:{},frames:new Set,proxied:new WeakSet};for(const s of ne){i.had[s]=Object.prototype.hasOwnProperty.call(e,s),i.own[s]=e[s];const n=(...a)=>{let r;const l=i.own[s];try{typeof l=="function"&&(r=l.apply(e,a))}finally{ze(e,i,s,a)}return r};try{Object.defineProperty(e,s,{configurable:!0,enumerable:!0,get:()=>n,set:a=>{i.own[s]=a}})}catch{}}return Object.defineProperty(e,$,{value:i,configurable:!0}),i}function Oe(e,t){if(e[$]===t){for(const i of ne)try{const s=Object.getOwnPropertyDescriptor(e,i);if(!s||!s.get)continue;t.had[i]||t.own[i]!==void 0?Object.defineProperty(e,i,{value:t.own[i],writable:!0,configurable:!0,enumerable:!0}):delete e[i]}catch{}try{delete e[$]}catch{}}}function ze(e,t,i,s){for(const n of t.frames)try{const a=n.contentWindow;if(!a||!re(a,e)||!t.proxied.has(a))continue;const r=a[i];typeof r=="function"&&r.apply(a,s)}catch{}}function De(e,t){if(e.externalAppV2?.postMessage){let i=t;try{i=JSON.parse(t)}catch{}e.externalAppV2.postMessage(JSON.stringify({type:"getExternalAuth",payload:i}))}else e.externalApp?.getExternalAuth?e.externalApp.getExternalAuth(t):e.webkit?.messageHandlers?.getExternalAuth?.postMessage?.(JSON.parse(t))}function O(e,t,i){try{return Object.defineProperty(e,t,{value:i,configurable:!0,writable:!0,enumerable:!0}),e[t]===i}catch{return!1}}function J(e,t){if(e.externalApp?.[j])return!0;const i={[j]:!0,getExternalAuth:n=>De(t,n),revokeExternalAuth:()=>{e.setTimeout(()=>{try{e.externalAuthRevokeToken?.(!1,{message:"not available in an embedded frame"})}catch{}},0)}};let s=O(e,"externalApp",i);return s&&e.externalAppV2!==void 0&&(s=O(e,"externalAppV2",void 0)),s&&e.webkit?.messageHandlers&&(s=O(e,"webkit",{messageHandlers:{}})),s}function Ce(e){const t=e.location.pathname;return t===B||t.startsWith(`${B}/`)||t.startsWith("/auth/")}function Me(e,t,i=window){const s=ae(i);if(!s)return null;const n=Ie(s);n.frames.add(e);let a="",r=null,l=0,w=0,b=!1;const E=()=>S();function _(){let p=null,y=null;try{if(p=e.contentWindow,y=p?.document??null,!p||!y||y===r||y.URL==="about:blank")return!1}catch{return!1}r=y;let o;!re(p,i)||!Ce(p)?o="failed":y.readyState!=="loading"?o=J(p,s)?"late":R(p)?"native":"failed":J(p,s)?o="early":o=R(p)?"native":"failed",(o==="early"||o==="late")&&n.proxied.add(p),a=o;try{p.addEventListener("pagehide",E)}catch{}return t?.(o),!0}function A(){l=0,!b&&(_()||Date.now()<w&&(l=i.setTimeout(A,G)))}function S(){b||(w=Date.now()+Pe,l||(l=i.setTimeout(A,G)))}const W=()=>{b||_()},g=()=>{b||(b=!0,i.clearTimeout(l),e.removeEventListener("load",W),i.removeEventListener("pagehide",g),n.frames.delete(e),n.frames.size||Oe(s,n))};return e.addEventListener("load",W),i.addEventListener("pagehide",g),S(),{get state(){return a},dispose:g}}function Ve(e,t){return e==="loading"&&t==="pending"?"unreachable":e}const oe={loading:"טוען את WisKey…",unreachableTitle:"לא ניתן לטעון את WisKey",unreachableHint:"WisKey לא ענה בזמן. אפשר לנסות שוב.",retry:"נסה שוב"},He={loading:"Loading WisKey…",unreachableTitle:"WisKey could not be loaded",unreachableHint:"WisKey did not answer in time. You can try again.",retry:"Try again"},qe={loading:"جارٍ تحميل WisKey…",unreachableTitle:"تعذّر تحميل WisKey",unreachableHint:"لم يستجب WisKey في الوقت المناسب. يمكنك المحاولة مرة أخرى.",retry:"حاول مرة أخرى"},Ne={loading:"Загрузка WisKey…",unreachableTitle:"Не удалось загрузить WisKey",unreachableHint:"WisKey не ответил вовремя. Попробуйте ещё раз.",retry:"Повторить"};function Ye(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const Fe={he:oe,en:He,ar:qe,ru:Ne};function L(e,t=Ye()){return Fe[t][e]??oe[e]}var Ue=Object.defineProperty,je=Object.getOwnPropertyDescriptor,u=(e,t,i,s)=>{for(var n=s>1?void 0:s?je(t,i):t,a=e.length-1,r;a>=0;a--)(r=e[a])&&(n=(s?r(t,i,n):r(n))||n);return s&&n&&Ue(t,i,n),n};const le=ie,Be=2e4,Ge=35e3,X=25e3,Je=1e4,Xe=15e3,Z=400,Ze=3e3,Qe=2e3,et=0,tt=0,it=1e3,z={overview:"מרכז הכניסה",events:"פעילות",users:"אנשים",devices:"עמדות",sync:"סנכרון",health:"בריאות",audit:"יומן שינויים",tools:"ניהול",camera_wall:"קיר מצלמות"};function C(e,t,i=0){if(i>12)return null;const s=e.querySelector(t);if(s)return s;for(const n of Array.from(e.querySelectorAll("*"))){const a=n.shadowRoot;if(a){const r=C(a,t,i+1);if(r)return r}}return null}function Q(e,t){try{const i=t.querySelector("home-assistant"),s=i?.shadowRoot?.querySelector("home-assistant-main");if(!i||!s)return"";const n=()=>i.hass;if(n()?.kioskMode!==!0){const l=e.CustomEvent;e.dispatchEvent(new l("hass-kiosk-mode",{detail:{enable:!0}}))}if(n()?.kioskMode===!0)return"kiosk";const a=s.shadowRoot;if(!a)return"visible";if(!a.querySelector("style[data-smplwise-chrome]")){const l=t.createElement("style");l.setAttribute("data-smplwise-chrome",""),l.textContent=":host{--ha-sidebar-width:0px!important;--mdc-drawer-width:0px!important;--ha-top-app-bar-width:100%!important}ha-sidebar{display:none!important}",a.appendChild(l)}const r=a.querySelector("ha-sidebar");return r&&e.getComputedStyle(r).display==="none"?"css":"visible"}catch{return"visible"}}function ee(e){try{const t=e;return!!t&&!!(t.externalAppV2||t.externalApp||t.webkit?.messageHandlers?.getExternalAuth||t.webkit?.messageHandlers?.externalBus)}catch{return!1}}function st(e=window){if(/Home ?Assistant\//.test(e.navigator.userAgent)||ee(e))return!0;try{return e.top!==e&&ee(e.top)}catch{return!1}}function te(e){const t=new URLSearchParams({tab:e.tab});return e.tool&&t.set("tool",e.tool),`${x}?${t.toString()}`}function nt(e=window,t=x){let i=e;try{e.top&&e.top!==e&&(e.top.location.pathname,i=e.top)}catch{i=e}if(i===e){e.location.assign(t);return}const s=()=>{try{i.location.assign(t)}catch{e.open(t,"_top")}};try{i.history.pushState(null,"",t);const a=i.CustomEvent;i.dispatchEvent(new a("location-changed",{detail:{replace:!1}}))}catch{s();return}const n=e.frameElement;e.setTimeout(()=>{try{n&&!n.isConnected||!!C(i.document,le)||s()}catch{s()}},it)}const at={overview:"wiskey-overview",events:"wiskey-events",users:"wiskey-people"},k=(e,t)=>!!e&&!!t&&e.tab===t.tab&&(e.tool||null)===(t.tool||null);let c=class extends de{constructor(){super(...arguments),this.tab="overview",this.tool="",this.phase="loading",this.mode="pending",this.chrome="",this.tabApplied=null,this.catalog=null,this.confirmed=null,this.panelTitle="",this.unsupportedVersion="",this.frameKey=0,this.viewReady=ce(),this.loadedView=null,this.direct="",this.forbidden=!1,this.fullLeft=!1,this.fullActive=!1,this.inerted=[],this.connector=null,this.opened=null,this.sent=[],this.wanted=null,this.detached=!1,this.timer=0,this.loadTimer=0,this.loadedAt=0,this.tabSince=0,this.tabAttempts=0,this.lastAttempt=0,this.panelEl=null,this.guarded=new WeakSet,this.frameWin=null,this.phoneRelay=!1,this.bridge=null,this.shim="",this.relayRefused="",this.onSize=()=>this.requestUpdate(),this.onView=()=>{this.forbidden||this.direct||!this.connector||!this.loadedView||ue(this.loadedView,K())||this.reload()},this.onEsc=e=>{e.key==="Escape"&&!e.defaultPrevented&&this.leaveFull()},this.onClick=e=>{if(this.mode!=="v1"||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const t=e.composedPath().find(a=>a instanceof HTMLAnchorElement),i=t?.getAttribute("href")??"";if(!t||!pe(i)||t.target&&t.target!=="_self")return;const s=M(i);if(fe(s,V()).kind!=="embed")return;e.preventDefault();const n=this.resolve(me(s));k(n,this.reference())||this.send(n,!0)},this.onFrameNav=()=>this.tick()}connectedCallback(){if(super.connectedCallback(),window.addEventListener(H,this.onSize),window.addEventListener(q,this.onView),this.viewReady?be():we().then(()=>this.viewReady=!0),V()&&!ye("access.read")){this.forbidden=!0;return}if(st()&&(this.phoneRelay=ve&&!!ae()&&this.direct!=="companion",!this.phoneRelay)){this.direct="companion";return}window.addEventListener("click",this.onClick,!0),this.detached&&(this.detached=!1,this.resetFrameState(),this.frameKey++)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("click",this.onClick,!0),window.removeEventListener(H,this.onSize),window.removeEventListener(q,this.onView),this.fullLeft=!1,this.setFullActive(!1),this.dropFrame(),this.detached=!0}size(){return this.forbidden||this.direct||P==="full"&&this.fullLeft||P==="fit"&&Y>=100?"normal":P}leaveFull(){this.fullLeft=!0,this.requestUpdate()}setFullActive(e){if(e!==this.fullActive)if(this.fullActive=e,e){const t=this.getRootNode(),i=t instanceof ShadowRoot?Array.from(t.querySelectorAll("nav.rail, header.topbar, nav.bottom, .float, .searchscrim, .sysbanner, main > :not(.screen), sw-user-menu, sw-nav-order")):[];this.inerted=i.filter(s=>!s.inert);for(const s of this.inerted)s.inert=!0;window.addEventListener("keydown",this.onEsc)}else{for(const t of this.inerted)t.inert=!1;this.inerted=[],window.removeEventListener("keydown",this.onEsc)}}updated(e){const t=this.size();this.setAttribute("data-size",t),this.setFullActive(t==="full"),this.ensureConnector(),(e.has("tab")&&e.get("tab")!==void 0||e.has("tool")&&e.get("tool")!==void 0)&&!this.forbidden&&!this.direct&&this.onRequest()}request(){return{tab:this.tab||"overview",tool:this.tab==="tools"&&this.tool?this.tool:null}}resolve(e){const t=this.catalog;return!t||t.tabs.some(i=>i.id===e.tab)?e:!e.tool&&t.tools.some(i=>i.id===e.tab)?{tab:"tools",tool:e.tab}:e}frame(){return this.renderRoot.querySelector("iframe")}ensureConnector(){if(this.connector||this.forbidden||this.direct)return;const e=this.frame();e&&(this.resetFrameState(),this.opened=this.request(),this.bridge?.dispose(),this.bridge=this.phoneRelay?Me(e,t=>this.onShim(t)):null,this.loadedView=K(),this.connector=Ke(e,{initial:this.opened,view:()=>this.loadedView=K(),extraParams:this.bridge?{external_auth:"1"}:void 0,onReady:t=>this.onReady(t),onLocation:t=>this.onLocation(t),onTitle:t=>this.panelTitle=t,onLegacy:()=>this.onLegacy(),onWaiting:()=>this.onWaiting(),onUnsupported:t=>this.onUnsupported(t),onRemount:()=>this.onRemount()}),this.startLoadTimer())}resetFrameState(){this.stopTimers(),this.phase="loading",this.mode="pending",this.chrome="",this.tabApplied=null,this.panelTitle="",this.unsupportedVersion="",this.catalog=null,this.confirmed=null,this.sent=[],this.wanted=null,this.loadedAt=0,this.panelEl=null}dropFrame(){this.stopTimers(),this.connector?.dispose(),this.connector=null,this.bridge?.dispose(),this.bridge=null,this.shim="";const e=this.frame();if(e){try{e.src="about:blank"}catch{}e.remove()}this.panelEl=null,v({confirmed:null})}reload(){if(this.direct="",this.relayRefused="",this.connector&&this.mode==="v1"){this.resetFrameState(),v({catalog:null,confirmed:null}),this.opened=this.connector.confirmed,this.connector.refresh(),this.startLoadTimer();return}this.dropFrame(),this.resetFrameState(),this.frameKey++}stopTimers(){window.clearInterval(this.timer),window.clearTimeout(this.loadTimer),this.timer=0,this.loadTimer=0,this.frameWin?.removeEventListener("location-changed",this.onFrameNav),this.frameWin=null}startLoadTimer(){window.clearTimeout(this.loadTimer),this.loadTimer=window.setTimeout(()=>{(this.phase==="loading"||this.phase==="waiting")&&!this.loadedAt&&(this.phase="unreachable")},Be)}startSettleTimer(){window.clearTimeout(this.loadTimer),this.loadTimer=window.setTimeout(()=>{this.phase=Ve(this.phase,this.mode)},Ge)}onReady(e){this.stopTimers(),this.mode="v1",this.phase="ready",this.catalog=e,this.confirmed=null,this.sent=[],v({catalog:e,confirmed:null});const t=this.wanted?this.resolve(this.wanted):null;this.wanted=null,t&&!k(t,this.opened)&&this.send(t,!1)}reference(){return this.expireSent(),this.sent.length?this.sent[this.sent.length-1].loc:this.confirmed??this.opened}expireSent(){const e=Date.now();this.sent=this.sent.filter(t=>e-t.at<=Ze)}send(e,t){return this.connector?.navigate(e)?(this.expireSent(),this.sent=[...this.sent.map(i=>({...i,push:!1})),{loc:e,push:t,at:Date.now()}].slice(-4),!0):!1}onLocation(e){this.confirmed=e,v({confirmed:e}),this.expireSent();const t=this.sent[this.sent.length-1],i=this.sent.findIndex((a,r)=>r<this.sent.length-1&&k(e,a.loc));if(t&&!k(e,t.loc)&&i>=0){this.sent.splice(i,1);return}const s=this.sent[this.sent.length-1],n=!!s&&s.push&&k(e,s.loc);this.sent=[],this.mirror(e,n)}mirror(e,t=!1){const i=M();if(i.mode!=="wiskey")return;const s=N(e.tab),n=Ee(s),a=!!n&&Ae[n]==="smplwise",r=new URLSearchParams(i.params);r.set("wiskey_tab",e.tab),e.tool?r.set("wiskey_tool",e.tool):r.delete("wiskey_tool"),(t?ge:ke)(a?i.path:I(e),r)}onRequest(){if(this.phase==="not_installed"||this.phase==="unreachable"||this.phase==="blocked"||this.phase==="unsupported"){this.reload();return}if(this.mode==="legacy"){this.resetTab(),this.tick();return}const e=this.resolve(this.request());if(this.mode==="v1"){if(k(e,this.reference()))return;!this.send(e,!1)&&this.confirmed&&this.mirror(this.confirmed);return}this.wanted=e}onRemount(){if(this.mode!=="v1")return;const e=this.confirmed??this.opened;this.resetFrameState(),this.opened=e,v({catalog:null,confirmed:null})}onLegacy(){this.mode!=="pending"||this.phase!=="loading"&&this.phase!=="waiting"||(this.mode="legacy",this.catalog=null,v({catalog:null,confirmed:null}),this.resetTab(),window.clearInterval(this.timer),this.timer=window.setInterval(()=>this.tick(),Z),this.tick())}onWaiting(){this.mode==="pending"&&(this.phase==="loading"||this.phase==="waiting")&&(this.phase="waiting")}onUnsupported(e){this.mode!=="v1"&&(this.phase==="login_required"||this.phase==="not_installed"||this.phase==="unreachable"||this.phase==="blocked"||(this.stopTimers(),this.mode="unsupported",this.phase="unsupported",this.unsupportedVersion=String(e??""),this.catalog=null,v({catalog:null,confirmed:null})))}onLoad(){window.setTimeout(()=>this.afterLoad(),0)}afterLoad(){const e=this.frame();if(!e||!this.connector)return;try{if(e.contentWindow?.location.href==="about:blank")return}catch{}this.loadedAt=Date.now(),this.panelEl=null,this.resetTab(),window.clearTimeout(this.loadTimer);let t=null;try{t=e.contentDocument,e.contentWindow?.location.pathname}catch{t=null}if(!t){this.phase="blocked";return}this.mode==="v1"||this.mode==="unsupported"||(this.frameWin?.removeEventListener("location-changed",this.onFrameNav),this.frameWin=e.contentWindow,this.frameWin?.addEventListener("location-changed",this.onFrameNav),this.startSettleTimer(),window.clearInterval(this.timer),this.timer=window.setInterval(()=>this.tick(),Z),this.tick())}tick(){const e=this.frame();if(!(!e||!this.loadedAt||this.mode==="v1"||this.mode==="unsupported"))try{const t=e.contentWindow,i=e.contentDocument;if(!t||!i)return this.phase="blocked",this.settle();const s=t.location.pathname;if(s.startsWith("/auth/"))return this.goDirect();const n=i.querySelector("home-assistant");if(!n){i.readyState==="complete"&&(this.phase="unreachable",this.settle());return}const a=n.hass?.panels;if(a&&!Object.keys(a).includes(x.slice(1)))return this.phase="not_installed",this.settle();const r=this.mode==="legacy";r&&(this.chrome=this.chrome==="kiosk"||this.chrome==="css"?this.keepChrome(t,i):Q(t,i)),(!this.panelEl?.isConnected||this.panelEl.ownerDocument!==i)&&(this.panelEl=C(i,le));const l=this.panelEl;if(!l){if(Date.now()-this.loadedAt>(this.bridge?Je:X)){if(!n.hass)return this.goDirect();this.phase=s.startsWith(x)?"unreachable":"not_installed",this.settle()}return}if(!r){this.timer&&this.slowDown();return}this.phase="ready",this.guardMenu(l),this.applyTab(l),this.tabApplied!==null&&(this.chrome==="kiosk"||this.chrome==="css"||Date.now()-this.loadedAt>X)&&this.slowDown()}catch{}}keepChrome(e,t){return Q(e,t)||this.chrome}guardMenu(e){this.guarded.has(e)||this.chrome!=="kiosk"&&this.chrome!=="css"||(this.guarded.add(e),e.addEventListener("hass-toggle-menu",t=>t.stopPropagation()))}resetTab(){this.tabApplied=null,this.tabSince=0,this.tabAttempts=0,this.lastAttempt=0}applyTab(e){if(this.tabApplied!==null)return;if(e._tab===this.tab){this.tabApplied=!0;return}this.tabSince===0&&(this.tabSince=Date.now());const t=Date.now()-this.tabSince>Xe;if(typeof e.navigate!="function"){this.tabApplied=!1;return}if("_session"in e){if(e._session===void 0){t&&(this.tabApplied=!1);return}e.navigate(this.tab),this.tabApplied=e._tab===this.tab;return}if(t||this.tabAttempts>=5){this.tabApplied=!1;return}Date.now()-this.lastAttempt<1e3||(this.lastAttempt=Date.now(),this.tabAttempts++,e.navigate(this.tab),e._tab===this.tab&&(this.tabApplied=!0))}slowDown(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>this.tick(),Qe)}onShim(e){this.shim=e,e!=="early"&&(this.relayRefused=e,this.goDirect())}goDirect(){this.dropFrame(),this.phase="login_required",this.direct="login_required"}settle(){window.clearInterval(this.timer),this.timer=0}shown(){return this.mode==="v1"&&this.confirmed?this.confirmed:this.request()}labelOf(e){return this.catalog?.tabs.find(t=>t.id===e)?.label||z[e]||e}renderError(){const e="אפשר לנסות שוב, לעבור למסך WisKey העצמאי או לפתוח אותו בחלון חדש, או לבחור בהגדרות ‹ מתגי מסכי כניסה את מסכי Arx.",i={not_installed:{heading:"לוח WisKey לא נמצא",hint:`האינטגרציה hikvision_intercom לא רשמה את הלוח ${x} (לא מותקנת, לא נטענה, או שהמשתמש לא רואה אותו). ${e}`,state:"empty"},unreachable:{heading:L("unreachableTitle"),hint:L("unreachableHint"),state:"stale"},blocked:{heading:"הדפדפן לא מאפשר להטמיע את WisKey כאן",hint:`המסגרת נחסמה (מדיניות מסגרות) או הופנתה לכתובת אחרת. ${e}`,state:"error"},unsupported:{heading:"גרסת ממשק ההטמעה של WisKey אינה נתמכת",hint:`WisKey המותקן מדבר בגרסת ממשק הטמעה ${this.unsupportedVersion||"לא ידועה"}, ו־Arx מכיר את גרסה 1. ${e}`,state:"error"}}[this.phase];return i?d`<div class="over" data-wiskey-embed-error=${this.phase}>
      <div>
        <sw-state-panel icon="door" state=${i.state} heading=${i.heading} hint=${i.hint}></sw-state-panel>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${()=>this.reload()}>${L("retry")}</sw-button>
          ${this.openInHaButton()}
          ${this.fullLink()}
        </div>
      </div>
    </div>`:m}openInHaButton(e="secondary"){return d`<sw-button size="sm" variant=${e} icon="door" data-wiskey-open-ha @click=${()=>nt(window,te(this.shown()))}>פתח ב-WisKey</sw-button>`}renderDirect(){const e=z[this.tab]??this.tab,t=this.direct==="companion"||this.phoneRelay,i=this.direct==="companion"?"בטלפון WisKey נפתח באפליקציה עצמה":this.phoneRelay&&this.relayRefused?"ההטמעה באפליקציה (ניסיוני) לא נתמכת במכשיר הזה, ולכן WisKey נפתח באפליקציה עצמה":this.phoneRelay?"ההטמעה באפליקציה (ניסיוני) לא הצליחה להתחבר, ולכן WisKey נפתח באפליקציה עצמה":"נדרשת התחברות בתוך המסגרת, ולכן WisKey עובר למסך נפרד",s=at[this.tab],n=N(this.tab);return d`
      <div class="bar" data-wiskey-embed-bar>
        <span class="note ${this.direct==="companion"?"":"warn"}" data-wiskey-embed-note=${this.direct} ?data-phone-relay=${this.phoneRelay} data-relay-refused=${this.relayRefused}>${i}</span>
        <span class="grow"></span>
        ${s?this.openInHaButton():m}
        ${t?m:this.fullLink()}
      </div>
      ${s==="wiskey-overview"?d`<wiskey-overview></wiskey-overview>`:s==="wiskey-events"?d`<wiskey-events></wiskey-events>`:s==="wiskey-people"?d`<wiskey-people></wiskey-people>`:d`<div class="only" data-wiskey-embed-only=${n}>
                <div>
                  <sw-state-panel icon="door" state="empty" heading=${`WisKey · ${e}`} hint=${`${i}. המסך "${e}" קיים רק בממשק של WisKey.`}></sw-state-panel>
                  <div class="actions">
                    ${this.openInHaButton("primary")}
                    ${this.direct==="companion"?m:d`<sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${()=>this.reload()}>נסה שוב</sw-button>`}
                  </div>
                </div>
              </div>`}
    `}fullLink(){return d`<a class="full" data-wiskey-embed-full href=${te(this.shown())} target="_blank" rel="noopener"><sw-icon name="expand" size=${14}></sw-icon>פתח בחלון מלא</a>`}statusNote(){if(this.phase==="waiting")return[d`<span class="note warn" data-wiskey-embed-note="waiting">WisKey עדיין לא אישר את החיבור - ממתין לטעינה או להזדהות בתוך WisKey</span>`];const e=[];return this.phase==="ready"&&this.mode==="legacy"&&this.chrome==="visible"&&e.push(d`<span class="note" data-wiskey-embed-note="chrome">תפריט נוסף מוצג סביב WisKey (ההסתרה לא נתמכת בגרסה הזו).</span>`),this.phase==="ready"&&this.mode==="legacy"&&this.tabApplied===!1&&e.push(d`<span class="note" data-wiskey-embed-note="tab">לא ניתן לפתוח ישירות את "${z[this.tab]??this.tab}"; WisKey נפתח במסך שלו.</span>`),e}renderTools(){const e=this.catalog;if(this.mode!=="v1"||!e||this.confirmed?.tab!=="tools")return m;const t=new Set(e.tabs.map(n=>n.id)),i=e.tools.filter(n=>n.id&&!t.has(n.id));if(!i.length)return m;const s=this.confirmed.tool;return d`<nav class="tools" aria-label="כלי הניהול של WisKey" data-wiskey-tools>
      <a href=${`#${I({tab:"tools"})}`} class=${s?"":"on"} data-wiskey-tool="" aria-current=${s?"false":"page"}>${this.labelOf("tools")}</a>
      ${i.map(n=>d`<a href=${`#${I({tab:"tools",tool:n.id})}`} class=${s===n.id?"on":""} data-wiskey-tool=${n.id} aria-current=${s===n.id?"page":"false"}>${n.label||n.id}</a>`)}
    </nav>`}render(){if(this.forbidden)return d`<sw-page heading="WisKey"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;if(this.direct)return this.renderDirect();const e=this.phase==="not_installed"||this.phase==="unreachable"||this.phase==="blocked"||this.phase==="unsupported",t=this.shown(),i=this.mode==="v1"&&this.panelTitle?this.panelTitle:this.labelOf(t.tab),s=this.mode==="v1"?this.confirmed:null,n=this.statusNote(),a=this.size();return d`
      ${a==="full"?d`<button type="button" class="exit" data-wiskey-exit aria-label="יציאה ממסך מלא" title="יציאה ממסך מלא (Esc)" @click=${()=>this.leaveFull()}><sw-icon name="close" size=${16}></sw-icon></button>`:m}
      ${this.renderTools()}
      <div class="stage" ?data-fit=${a==="fit"} style=${a==="fit"?`--wk-scale:${Y/100}`:""}>
        ${this.viewReady?xe(this.frameKey,d`<iframe
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
              ></iframe>`):m}
        ${n.length?d`<div class="status" role="status" data-wiskey-embed-status>${n}</div>`:m}
        ${this.phase==="loading"?d`<div class="over"><sw-state-panel state="loading" heading=${L("loading")}></sw-state-panel></div>`:m}
        ${e?this.renderError():m}
      </div>
    `}};c.styles=Se`
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
      font-weight: 600;
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
      font-weight: 600;
    }
    /* the framed screen: the stage fills the host, the frame fills the stage - no border, outline, padding, margin,
       minimum height or darker canvas anywhere around it */
    .stage {
      --wk-crop: ${et}px;
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
        --wk-crop: ${tt}px;
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
  `;u([D()],c.prototype,"tab",2);u([D()],c.prototype,"tool",2);u([f()],c.prototype,"phase",2);u([f()],c.prototype,"mode",2);u([f()],c.prototype,"chrome",2);u([f()],c.prototype,"tabApplied",2);u([f()],c.prototype,"catalog",2);u([f()],c.prototype,"confirmed",2);u([f()],c.prototype,"panelTitle",2);u([f()],c.prototype,"unsupportedVersion",2);u([f()],c.prototype,"frameKey",2);u([f()],c.prototype,"viewReady",2);u([D({reflect:!0,attribute:"data-direct"})],c.prototype,"direct",2);u([f()],c.prototype,"shim",2);u([f()],c.prototype,"relayRefused",2);c=u([We("wiskey-embed")],c);export{tt as WISKEY_EDGE_CROP_PHONE_PX,et as WISKEY_EDGE_CROP_PX,x as WISKEY_PANEL_PATH,c as WiskeyEmbed,Q as hideHaChrome,st as isCompanionApp,nt as openWiskeyInHa,te as wiskeyDeepLink};
//# sourceMappingURL=wiskey-embed-D79OCwbl.js.map
