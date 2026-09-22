(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function s(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=s(a);fetch(a.href,n)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Hs=globalThis,Ki=Hs.ShadowRoot&&(Hs.ShadyCSS===void 0||Hs.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Gi=Symbol(),la=new WeakMap;let nr=class{constructor(t,s,i){if(this._$cssResult$=!0,i!==Gi)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=s}get styleSheet(){let t=this.o;const s=this.t;if(Ki&&t===void 0){const i=s!==void 0&&s.length===1;i&&(t=la.get(s)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&la.set(s,t))}return t}toString(){return this.cssText}};const Qr=e=>new nr(typeof e=="string"?e:e+"",void 0,Gi),z=(e,...t)=>{const s=e.length===1?e[0]:t.reduce((i,a,n)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(a)+e[n+1],e[0]);return new nr(s,e,Gi)},en=(e,t)=>{if(Ki)e.adoptedStyleSheets=t.map(s=>s instanceof CSSStyleSheet?s:s.styleSheet);else for(const s of t){const i=document.createElement("style"),a=Hs.litNonce;a!==void 0&&i.setAttribute("nonce",a),i.textContent=s.cssText,e.appendChild(i)}},da=Ki?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let s="";for(const i of t.cssRules)s+=i.cssText;return Qr(s)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:tn,defineProperty:sn,getOwnPropertyDescriptor:an,getOwnPropertyNames:rn,getOwnPropertySymbols:nn,getPrototypeOf:on}=Object,Qs=globalThis,ca=Qs.trustedTypes,ln=ca?ca.emptyScript:"",dn=Qs.reactiveElementPolyfillSupport,ds=(e,t)=>e,Ws={toAttribute(e,t){switch(t){case Boolean:e=e?ln:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let s=e;switch(t){case Boolean:s=e!==null;break;case Number:s=e===null?null:Number(e);break;case Object:case Array:try{s=JSON.parse(e)}catch{s=null}}return s}},Yi=(e,t)=>!tn(e,t),pa={attribute:!0,type:String,converter:Ws,reflect:!1,useDefault:!1,hasChanged:Yi};Symbol.metadata??=Symbol("metadata"),Qs.litPropertyMetadata??=new WeakMap;let jt=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,s=pa){if(s.state&&(s.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((s=Object.create(s)).wrapped=!0),this.elementProperties.set(t,s),!s.noAccessor){const i=Symbol(),a=this.getPropertyDescriptor(t,i,s);a!==void 0&&sn(this.prototype,t,a)}}static getPropertyDescriptor(t,s,i){const{get:a,set:n}=an(this.prototype,t)??{get(){return this[s]},set(o){this[s]=o}};return{get:a,set(o){const l=a?.call(this);n?.call(this,o),this.requestUpdate(t,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??pa}static _$Ei(){if(this.hasOwnProperty(ds("elementProperties")))return;const t=on(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(ds("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ds("properties"))){const s=this.properties,i=[...rn(s),...nn(s)];for(const a of i)this.createProperty(a,s[a])}const t=this[Symbol.metadata];if(t!==null){const s=litPropertyMetadata.get(t);if(s!==void 0)for(const[i,a]of s)this.elementProperties.set(i,a)}this._$Eh=new Map;for(const[s,i]of this.elementProperties){const a=this._$Eu(s,i);a!==void 0&&this._$Eh.set(a,s)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const s=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const a of i)s.unshift(da(a))}else t!==void 0&&s.push(da(t));return s}static _$Eu(t,s){const i=s.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,s=this.constructor.elementProperties;for(const i of s.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return en(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,s,i){this._$AK(t,i)}_$ET(t,s){const i=this.constructor.elementProperties.get(t),a=this.constructor._$Eu(t,i);if(a!==void 0&&i.reflect===!0){const n=(i.converter?.toAttribute!==void 0?i.converter:Ws).toAttribute(s,i.type);this._$Em=t,n==null?this.removeAttribute(a):this.setAttribute(a,n),this._$Em=null}}_$AK(t,s){const i=this.constructor,a=i._$Eh.get(t);if(a!==void 0&&this._$Em!==a){const n=i.getPropertyOptions(a),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:Ws;this._$Em=a;const l=o.fromAttribute(s,n.type);this[a]=l??this._$Ej?.get(a)??l,this._$Em=null}}requestUpdate(t,s,i,a=!1,n){if(t!==void 0){const o=this.constructor;if(a===!1&&(n=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??Yi)(n,s)||i.useDefault&&i.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,s,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,s,{useDefault:i,reflect:a,wrapped:n},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??s??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(s=void 0),this._$AL.set(t,s)),a===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(s){Promise.reject(s)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[a,n]of this._$Ep)this[a]=n;this._$Ep=void 0}const i=this.constructor.elementProperties;if(i.size>0)for(const[a,n]of i){const{wrapped:o}=n,l=this[a];o!==!0||this._$AL.has(a)||l===void 0||this.C(a,void 0,n,l)}}let t=!1;const s=this._$AL;try{t=this.shouldUpdate(s),t?(this.willUpdate(s),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(s)):this._$EM()}catch(i){throw t=!1,this._$EM(),i}t&&this._$AE(s)}willUpdate(t){}_$AE(t){this._$EO?.forEach(s=>s.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(s=>this._$ET(s,this[s])),this._$EM()}updated(t){}firstUpdated(t){}};jt.elementStyles=[],jt.shadowRootOptions={mode:"open"},jt[ds("elementProperties")]=new Map,jt[ds("finalized")]=new Map,dn?.({ReactiveElement:jt}),(Qs.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ji=globalThis,ha=e=>e,Us=Ji.trustedTypes,ua=Us?Us.createPolicy("lit-html",{createHTML:e=>e}):void 0,or="$lit$",ut=`lit$${Math.random().toFixed(9).slice(2)}$`,lr="?"+ut,cn=`<${lr}>`,At=document,bs=()=>At.createComment(""),ys=e=>e===null||typeof e!="object"&&typeof e!="function",Xi=Array.isArray,pn=e=>Xi(e)||typeof e?.[Symbol.iterator]=="function",hi=`[ 	
\f\r]`,ns=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ma=/-->/g,fa=/>/g,xt=RegExp(`>|${hi}(?:([^\\s"'>=/]+)(${hi}*=${hi}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),wa=/'/g,va=/"/g,dr=/^(?:script|style|textarea|title)$/i,cr=e=>(t,...s)=>({_$litType$:e,strings:t,values:s}),r=cr(1),h=cr(2),Et=Symbol.for("lit-noChange"),c=Symbol.for("lit-nothing"),ga=new WeakMap,St=At.createTreeWalker(At,129);function pr(e,t){if(!Xi(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return ua!==void 0?ua.createHTML(t):t}const hn=(e,t)=>{const s=e.length-1,i=[];let a,n=t===2?"<svg>":t===3?"<math>":"",o=ns;for(let l=0;l<s;l++){const p=e[l];let f,u,v=-1,$=0;for(;$<p.length&&(o.lastIndex=$,u=o.exec(p),u!==null);)$=o.lastIndex,o===ns?u[1]==="!--"?o=ma:u[1]!==void 0?o=fa:u[2]!==void 0?(dr.test(u[2])&&(a=RegExp("</"+u[2],"g")),o=xt):u[3]!==void 0&&(o=xt):o===xt?u[0]===">"?(o=a??ns,v=-1):u[1]===void 0?v=-2:(v=o.lastIndex-u[2].length,f=u[1],o=u[3]===void 0?xt:u[3]==='"'?va:wa):o===va||o===wa?o=xt:o===ma||o===fa?o=ns:(o=xt,a=void 0);const _=o===xt&&e[l+1].startsWith("/>")?" ":"";n+=o===ns?p+cn:v>=0?(i.push(f),p.slice(0,v)+or+p.slice(v)+ut+_):p+ut+(v===-2?l:_)}return[pr(e,n+(e[s]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]};class $s{constructor({strings:t,_$litType$:s},i){let a;this.parts=[];let n=0,o=0;const l=t.length-1,p=this.parts,[f,u]=hn(t,s);if(this.el=$s.createElement(f,i),St.currentNode=this.el.content,s===2||s===3){const v=this.el.content.firstChild;v.replaceWith(...v.childNodes)}for(;(a=St.nextNode())!==null&&p.length<l;){if(a.nodeType===1){if(a.hasAttributes())for(const v of a.getAttributeNames())if(v.endsWith(or)){const $=u[o++],_=a.getAttribute(v).split(ut),N=/([.?@])?(.*)/.exec($);p.push({type:1,index:n,name:N[2],strings:_,ctor:N[1]==="."?mn:N[1]==="?"?fn:N[1]==="@"?wn:ei}),a.removeAttribute(v)}else v.startsWith(ut)&&(p.push({type:6,index:n}),a.removeAttribute(v));if(dr.test(a.tagName)){const v=a.textContent.split(ut),$=v.length-1;if($>0){a.textContent=Us?Us.emptyScript:"";for(let _=0;_<$;_++)a.append(v[_],bs()),St.nextNode(),p.push({type:2,index:++n});a.append(v[$],bs())}}}else if(a.nodeType===8)if(a.data===lr)p.push({type:2,index:n});else{let v=-1;for(;(v=a.data.indexOf(ut,v+1))!==-1;)p.push({type:7,index:n}),v+=ut.length-1}n++}}static createElement(t,s){const i=At.createElement("template");return i.innerHTML=t,i}}function Zt(e,t,s=e,i){if(t===Et)return t;let a=i!==void 0?s._$Co?.[i]:s._$Cl;const n=ys(t)?void 0:t._$litDirective$;return a?.constructor!==n&&(a?._$AO?.(!1),n===void 0?a=void 0:(a=new n(e),a._$AT(e,s,i)),i!==void 0?(s._$Co??=[])[i]=a:s._$Cl=a),a!==void 0&&(t=Zt(e,a._$AS(e,t.values),a,i)),t}class un{constructor(t,s){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=s}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:s},parts:i}=this._$AD,a=(t?.creationScope??At).importNode(s,!0);St.currentNode=a;let n=St.nextNode(),o=0,l=0,p=i[0];for(;p!==void 0;){if(o===p.index){let f;p.type===2?f=new Ms(n,n.nextSibling,this,t):p.type===1?f=new p.ctor(n,p.name,p.strings,this,t):p.type===6&&(f=new vn(n,this,t)),this._$AV.push(f),p=i[++l]}o!==p?.index&&(n=St.nextNode(),o++)}return St.currentNode=At,a}p(t){let s=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,s),s+=i.strings.length-2):i._$AI(t[s])),s++}}class Ms{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,s,i,a){this.type=2,this._$AH=c,this._$AN=void 0,this._$AA=t,this._$AB=s,this._$AM=i,this.options=a,this._$Cv=a?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const s=this._$AM;return s!==void 0&&t?.nodeType===11&&(t=s.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,s=this){t=Zt(this,t,s),ys(t)?t===c||t==null||t===""?(this._$AH!==c&&this._$AR(),this._$AH=c):t!==this._$AH&&t!==Et&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):pn(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==c&&ys(this._$AH)?this._$AA.nextSibling.data=t:this.T(At.createTextNode(t)),this._$AH=t}$(t){const{values:s,_$litType$:i}=t,a=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=$s.createElement(pr(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===a)this._$AH.p(s);else{const n=new un(a,this),o=n.u(this.options);n.p(s),this.T(o),this._$AH=n}}_$AC(t){let s=ga.get(t.strings);return s===void 0&&ga.set(t.strings,s=new $s(t)),s}k(t){Xi(this._$AH)||(this._$AH=[],this._$AR());const s=this._$AH;let i,a=0;for(const n of t)a===s.length?s.push(i=new Ms(this.O(bs()),this.O(bs()),this,this.options)):i=s[a],i._$AI(n),a++;a<s.length&&(this._$AR(i&&i._$AB.nextSibling,a),s.length=a)}_$AR(t=this._$AA.nextSibling,s){for(this._$AP?.(!1,!0,s);t!==this._$AB;){const i=ha(t).nextSibling;ha(t).remove(),t=i}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class ei{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,s,i,a,n){this.type=1,this._$AH=c,this._$AN=void 0,this.element=t,this.name=s,this._$AM=a,this.options=n,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=c}_$AI(t,s=this,i,a){const n=this.strings;let o=!1;if(n===void 0)t=Zt(this,t,s,0),o=!ys(t)||t!==this._$AH&&t!==Et,o&&(this._$AH=t);else{const l=t;let p,f;for(t=n[0],p=0;p<n.length-1;p++)f=Zt(this,l[i+p],s,p),f===Et&&(f=this._$AH[p]),o||=!ys(f)||f!==this._$AH[p],f===c?t=c:t!==c&&(t+=(f??"")+n[p+1]),this._$AH[p]=f}o&&!a&&this.j(t)}j(t){t===c?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class mn extends ei{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===c?void 0:t}}class fn extends ei{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==c)}}class wn extends ei{constructor(t,s,i,a,n){super(t,s,i,a,n),this.type=5}_$AI(t,s=this){if((t=Zt(this,t,s,0)??c)===Et)return;const i=this._$AH,a=t===c&&i!==c||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==c&&(i===c||a);a&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class vn{constructor(t,s,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=s,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Zt(this,t)}}const gn=Ji.litHtmlPolyfillSupport;gn?.($s,Ms),(Ji.litHtmlVersions??=[]).push("3.3.3");const bn=(e,t,s)=>{const i=s?.renderBefore??t;let a=i._$litPart$;if(a===void 0){const n=s?.renderBefore??null;i._$litPart$=a=new Ms(t.insertBefore(bs(),n),n,void 0,s??{})}return a._$AI(e),a};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Qi=globalThis;let x=class extends jt{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const s=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=bn(s,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Et}};x._$litElement$=!0,x.finalized=!0,Qi.litElementHydrateSupport?.({LitElement:x});const yn=Qi.litElementPolyfillSupport;yn?.({LitElement:x});(Qi.litElementVersions??=[]).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const S=e=>(t,s)=>{s!==void 0?s.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const $n={attribute:!0,type:String,converter:Ws,reflect:!1,hasChanged:Yi},xn=(e=$n,t,s)=>{const{kind:i,metadata:a}=s;let n=globalThis.litPropertyMetadata.get(a);if(n===void 0&&globalThis.litPropertyMetadata.set(a,n=new Map),i==="setter"&&((e=Object.create(e)).wrapped=!0),n.set(s.name,e),i==="accessor"){const{name:o}=s;return{set(l){const p=t.get.call(this);t.set.call(this,l),this.requestUpdate(o,p,e,!0,l)},init(l){return l!==void 0&&this.C(o,void 0,e,l),l}}}if(i==="setter"){const{name:o}=s;return function(l){const p=this[o];t.call(this,l),this.requestUpdate(o,p,e,!0,l)}}throw Error("Unsupported decorator location: "+i)};function m(e){return(t,s)=>typeof s=="object"?xn(e,t,s):((i,a,n)=>{const o=a.hasOwnProperty(n);return a.constructor.createProperty(n,i),o?Object.getOwnPropertyDescriptor(a,n):void 0})(e,t,s)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function d(e){return m({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const kn=(e,t,s)=>(s.configurable=!0,s.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,s),s);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function es(e,t){return(s,i,a)=>{const n=o=>o.renderRoot?.querySelector(e)??null;return kn(s,i,{get(){return n(this)}})}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const _n={ATTRIBUTE:1},zn=e=>(...t)=>({_$litDirective$:e,values:t});class Sn{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,s,i){this._$Ct=t,this._$AM=s,this._$Ci=i}_$AS(t,s){return this.update(t,s)}update(t,s){return this.render(...s)}}/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ct=zn(class extends Sn{constructor(e){if(super(e),e.type!==_n.ATTRIBUTE||e.name!=="class"||e.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(const i in t)t[i]&&!this.nt?.has(i)&&this.st.add(i);return this.render(t)}const s=e.element.classList;for(const i of this.st)i in t||(s.remove(i),this.st.delete(i));for(const i in t){const a=!!t[i];a===this.st.has(i)||this.nt?.has(i)||(a?(s.add(i),this.st.add(i)):(s.remove(i),this.st.delete(i)))}return Et}});var Mn=Object.defineProperty,An=Object.getOwnPropertyDescriptor,ti=(e,t,s,i)=>{for(var a=i>1?void 0:i?An(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Mn(t,s,a),a};const ba={live:h`<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/>`,explore:h`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>`,investigate:h`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M11 8v3l2 1.5"/>`,system:h`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,camera:h`<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H8l1.5-2h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.5"/>`,search:h`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>`,bell:h`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>`,user:h`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,play:h`<path d="M7 5v14l11-7z"/>`,expand:h`<path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/>`,close:h`<path d="M6 6l12 12M18 6 6 18"/>`,chevron:h`<path d="m9 6 6 6-6 6"/>`,chevronBack:h`<path d="m15 6-6 6 6 6"/>`,warning:h`<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>`,info:h`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`,lock:h`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,unlock:h`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>`,offline:h`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/><path d="M3 3l18 18"/>`,refresh:h`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>`,layers:h`<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/>`,floor:h`<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v18"/>`,plus:h`<path d="M12 5v14M5 12h14"/>`,minus:h`<path d="M5 12h14"/>`,fit:h`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,door:h`<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>`,light:h`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`,sensor:h`<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>`,check:h`<path d="m5 12 5 5 9-10"/>`,clock:h`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,download:h`<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>`,pin:h`<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v6"/>`,more:h`<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>`,building:h`<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>`,map:h`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/>`,upload:h`<path d="M12 16V5M7 10l5-5 5 5M4 20h16"/>`,list:h`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`,history:h`<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v4l3 2"/>`,target:h`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`,filter:h`<path d="M4 5h16l-6 8v6l-4-2v-4z"/>`,users:h`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21.5 20"/>`,shield:h`<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>`,storage:h`<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>`,edit:h`<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>`,pause:h`<path d="M8 5v14M16 5v14"/>`,skip:h`<path d="M5 5v14l8-7zM15 5h2v14h-2z"/>`,case:h`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>`,rule:h`<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>`,link:h`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,grid:h`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,dashboard:h`<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>`,home:h`<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>`,star:h`<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9L6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,aperture:h`<circle cx="12" cy="12" r="9"/><path d="m14.3 4.5-5 8.6M20.7 9.5H10.8M18.4 17.5l-5-8.6M9.7 19.5l5-8.6M3.3 14.5h9.9M5.6 6.5l5 8.6"/>`,volume:h`<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>`,mic:h`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>`,back10:h`<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,forward10:h`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,chevronDown:h`<path d="m6 9 6 6 6-6"/>`,stairs:h`<path d="M3 20h4v-4h4v-4h4V8h5"/>`,elevator:h`<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>`,menu:h`<path d="M4 7h16M4 12h16M4 17h16"/>`,calendar:h`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,trash:h`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,eye:h`<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,cpu:h`<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>`,activity:h`<path d="M3 12h4l3-8 4 16 3-8h4"/>`,image:h`<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/>`,wifi:h`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/>`,signal:h`<path d="M4 18v-3M9 18v-7M14 18V7M19 18V4"/>`,move:h`<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>`,bookmark:h`<path d="M6 3h12v18l-6-4-6 4z"/>`,route:h`<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 17c5-1 3-9 8-10"/>`,logout:h`<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>`};let qt=class extends x{constructor(){super(...arguments),this.name="info",this.size=20,this.flip=!1}render(){this.style.setProperty("--sw-icon-size",`${this.size}px`);const e=this.name==="chevron"||this.name==="chevronBack";return r`<svg viewBox="0 0 24 24" aria-hidden="true" ?data-dir=${e}>${ba[this.name]??ba.info}</svg>`}};qt.styles=z`
    :host {
      display: inline-flex;
      inline-size: var(--sw-icon-size, 20px);
      block-size: var(--sw-icon-size, 20px);
      color: inherit;
      vertical-align: middle;
      flex-shrink: 0;
    }
    :host([flip]) svg {
      transform: scaleX(-1);
    }
    :host-context([dir='rtl']) svg[data-dir] {
      transform: scaleX(-1);
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `;ti([m()],qt.prototype,"name",2);ti([m({type:Number})],qt.prototype,"size",2);ti([m({type:Boolean,reflect:!0})],qt.prototype,"flip",2);qt=ti([S("sw-icon")],qt);var En=Object.defineProperty,Pn=Object.getOwnPropertyDescriptor,ot=(e,t,s,i)=>{for(var a=i>1?void 0:i?Pn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&En(t,s,a),a};let Ne=class extends x{constructor(){super(...arguments),this.variant="secondary",this.size="md",this.disabled=!1,this.iconOnly=!1,this.round=!1,this.label="",this.type="button"}render(){return r`
      <button type=${this.type} ?disabled=${this.disabled} aria-label=${this.iconOnly?this.label:""} title=${this.iconOnly?this.label:""}>
        ${this.icon?r`<sw-icon .name=${this.icon} size=${this.size==="sm"?13:this.size==="lg"?18:15}></sw-icon>`:""}
        ${this.iconOnly?"":r`<slot>${this.label}</slot>`}
      </button>
    `}};Ne.styles=z`
    :host {
      display: inline-flex;
    }
    :host([hidden]) {
      display: none;
    }
    /* block: the button fills its container (phone layouts, action grids) */
    :host([block]) {
      display: flex;
    }
    :host([block]) button {
      inline-size: 100%;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-block-size: 30px;
      padding-inline: 12px;
      border-radius: 8px;
      border: 1px solid var(--sw-border-strong);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
      white-space: nowrap;
      color: var(--sw-text);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    button:hover {
      background: var(--sw-surface-2);
    }
    :host([size='sm']) button {
      min-block-size: 26px;
      padding-inline: 9px;
      font-size: var(--sw-fs-xs);
      border-radius: 7px;
      gap: 5px;
    }
    :host([size='lg']) button {
      min-block-size: 36px;
      padding-inline: 16px;
      font-size: var(--sw-fs-md);
    }
    :host([variant='primary']) button {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: 0 1px 2px rgba(47, 107, 255, 0.25);
    }
    :host([variant='primary']) button:hover {
      background: var(--sw-accent-hover);
      border-color: var(--sw-accent-hover);
    }
    :host([variant='ghost']) button {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
      color: var(--sw-text-2);
    }
    :host([variant='ghost']) button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    :host([variant='danger']) button {
      background: var(--sw-surface);
      border-color: var(--sw-danger);
      color: var(--sw-danger);
    }
    :host([variant='danger']) button:hover {
      background: var(--sw-danger-soft);
    }
    :host([disabled]) button {
      cursor: not-allowed;
      opacity: 0.45;
    }
    :host([icononly]) button {
      inline-size: 30px;
      padding-inline: 0;
    }
    :host([icononly][size='sm']) button {
      inline-size: 26px;
    }
    :host([icononly][size='lg']) button {
      inline-size: 36px;
    }
    :host([round]) button {
      border-radius: 50%;
    }
  `;ot([m()],Ne.prototype,"variant",2);ot([m()],Ne.prototype,"size",2);ot([m()],Ne.prototype,"icon",2);ot([m({type:Boolean,reflect:!0})],Ne.prototype,"disabled",2);ot([m({type:Boolean,reflect:!0})],Ne.prototype,"iconOnly",2);ot([m({type:Boolean,reflect:!0})],Ne.prototype,"round",2);ot([m()],Ne.prototype,"label",2);ot([m()],Ne.prototype,"type",2);Ne=ot([S("sw-button")],Ne);const In={app:{name:"SMPLWISE VMS",search:"חיפוש מצלמה, קומה, ישות או אירוע…",notifications:"התראות",account:"חשבון"},modes:{live:"שידור חי",explore:"מפות",investigate:"חקירה",system:"מערכת"},nav:{styleguide:"ספריית רכיבים"},breadcrumb:{site:"אתר",building:"מבנה",floor:"קומה"},floor:{switcher:"בחירת קומה",layers:"שכבות",cameras:"מצלמות",doors:"דלתות",lights:"תאורה",sensors:"חיישנים",zoomIn:"הגדלה",zoomOut:"הקטנה",fit:"התאמה למסך",noPlan:"לקומה הזו עדיין אין תוכנית",noPlanHint:"אפשר להעלות PDF או תמונה של התוכנית, או לעבוד עם רשימת המצלמות בינתיים.",uploadPlan:"העלאת תוכנית",listView:"תצוגת רשימה",stalePlan:"התוכנית מוצגת כרקע בלבד"},states:{loading:"טוען…",empty:"אין נתונים להצגה",error:"משהו השתבש",errorHint:"לא הצלחנו לטעון את הנתונים. אפשר לנסות שוב.",retry:"נסה שוב",forbidden:"אין הרשאה",forbiddenHint:"למשתמש שלך אין הרשאה לצפות בתוכן הזה. פנה למנהל ה־VMS כדי לקבל שיוך.",stale:"הנתונים אינם עדכניים",staleHint:"החיבור ל־Home Assistant נותק. מוצג המצב האחרון שנקלט.",partial:"חלק מהנתונים חסר",offline:"לא מחובר",unknown:"לא ידוע",live:"חי",recorded:"מוקלט",historic:"צפייה היסטורית"},camera:{preview:"תצוגה מקדימה",enlarge:"הגדל",recordings:"הקלטות",pin:"הצמד",unpin:"בטל הצמדה",snapshot:"צילום",offlineReason:"המצלמה אינה מחוברת ל־NVR",forbiddenReason:"אין לך הרשאת צפייה במצלמה הזו",staleReason:"מצב המצלמה אינו מעודכן",source:"מקור",timeSource:"זמן מקור",quality:"איכות",main:"ראשי",sub:"משני"},entity:{state:"מצב",lastChanged:"עודכן לאחרונה",control:"הפעלה",noControl:"אין הרשאה לשליטה",openInHa:"פתח ב־Home Assistant",door:"דלת",light:"תאורה",sensor:"חיישן",locked:"נעול",unlocked:"פתוח",on:"דולק",off:"כבוי",confirm:"אישור פעולה"},actions:{close:"סגור",cancel:"ביטול",save:"שמירה",apply:"החל",refresh:"רענון",more:"עוד",back:"חזרה"}};function y(e){const t=e.split(".").reduce((s,i)=>s?.[i],In);return typeof t=="string"?t:e}var Cn=Object.defineProperty,Tn=Object.getOwnPropertyDescriptor,si=(e,t,s,i)=>{for(var a=i>1?void 0:i?Tn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Cn(t,s,a),a};const On={live:()=>y("states.live"),recorded:()=>y("states.recorded"),historic:()=>y("states.historic"),offline:()=>y("states.offline"),stale:()=>y("states.stale"),unknown:()=>y("states.unknown"),forbidden:()=>y("states.forbidden"),error:()=>y("states.error"),partial:()=>y("states.partial"),neutral:()=>""};let Kt=class extends x{constructor(){super(...arguments),this.kind="neutral",this.label="",this.onImage=!1}render(){const e=this.label||On[this.kind]();return r`<span class="dot" aria-hidden="true"></span><span>${e}</span>`}};Kt.styles=z`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      border: 1px solid transparent;
      white-space: nowrap;
    }
    :host([onimage]) {
      background: rgba(255, 255, 255, 0.92);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
    }
    .dot {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    :host([kind='live']) {
      background: var(--sw-live-soft);
      color: #15803d;
    }
    :host([kind='live']) .dot {
      background: var(--sw-live);
      animation: pulse 1.6s ease-in-out infinite;
    }
    :host([onimage][kind='live']) {
      background: rgba(255, 255, 255, 0.92);
      color: var(--sw-text);
    }
    :host([kind='recorded']),
    :host([kind='historic']) {
      background: var(--sw-recorded-soft);
      color: var(--sw-accent-text);
    }
    :host([kind='offline']) {
      background: var(--sw-offline-soft);
      color: #6b7280;
    }
    :host([kind='offline']) .dot {
      background: transparent;
      border: 2px solid currentColor;
      box-sizing: border-box;
    }
    :host([kind='stale']),
    :host([kind='partial']) {
      background: var(--sw-stale-soft);
      color: #b45309;
      border-style: dashed;
      border-color: var(--sw-stale);
    }
    :host([kind='unknown']) {
      background: var(--sw-unknown-soft);
      color: var(--sw-text-3);
      border: 1px dashed var(--sw-border-strong);
    }
    :host([kind='unknown']) .dot {
      background: transparent;
      border: 1px dashed currentColor;
      box-sizing: border-box;
    }
    :host([kind='forbidden']),
    :host([kind='error']) {
      background: var(--sw-danger-soft);
      color: #b91c1c;
    }
    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([kind='live']) .dot {
        animation: none;
      }
    }
  `;si([m({reflect:!0})],Kt.prototype,"kind",2);si([m()],Kt.prototype,"label",2);si([m({type:Boolean,reflect:!0})],Kt.prototype,"onImage",2);Kt=si([S("sw-badge")],Kt);var Dn=Object.defineProperty,Rn=Object.getOwnPropertyDescriptor,As=(e,t,s,i)=>{for(var a=i>1?void 0:i?Rn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Dn(t,s,a),a};let Pt=class extends x{constructor(){super(...arguments),this.items=[],this.active="",this.segmented=!1,this.underline=!1}choose(e){this.active=e.id,this.dispatchEvent(new CustomEvent("change",{detail:{id:e.id},bubbles:!0,composed:!0}))}render(){return r`${this.items.map(e=>e.href?r`<a href=${e.href} class=${e.id===this.active?"on":""} aria-current=${e.id===this.active?"page":"false"}>${e.label}${e.count!==void 0?r`<span class="count">(${e.count})</span>`:""}</a>`:r`<button type="button" class=${e.id===this.active?"on":""} aria-pressed=${e.id===this.active} @click=${()=>this.choose(e)}>${e.label}${e.count!==void 0?r`<span class="count">(${e.count})</span>`:""}</button>`)}`}};Pt.styles=z`
    :host {
      display: inline-flex;
      gap: 2px;
      overflow-x: auto;
      scrollbar-width: none;
      max-inline-size: 100%;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    :host([underline]) {
      display: flex;
      background: transparent;
      padding: 0;
      border-radius: 0;
      border-block-end: 1px solid var(--sw-border);
      gap: 2px;
    }
    a,
    button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--sw-text-2);
      text-decoration: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a:hover,
    button:hover {
      color: var(--sw-text);
    }
    .on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    :host([underline]) a,
    :host([underline]) button {
      padding: 8px 12px;
      border-radius: 0;
      border-block-end: 2px solid transparent;
      margin-block-end: -1px;
    }
    :host([underline]) .on {
      background: transparent;
      box-shadow: none;
      border-block-end-color: var(--sw-accent);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .on .count {
      color: var(--sw-accent-text);
    }
  `;As([m({attribute:!1})],Pt.prototype,"items",2);As([m()],Pt.prototype,"active",2);As([m({type:Boolean,reflect:!0})],Pt.prototype,"segmented",2);As([m({type:Boolean,reflect:!0})],Pt.prototype,"underline",2);Pt=As([S("sw-tabs")],Pt);var Nn=Object.defineProperty,Bn=Object.getOwnPropertyDescriptor,ea=(e,t,s,i)=>{for(var a=i>1?void 0:i?Bn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Nn(t,s,a),a};let xs=class extends x{constructor(){super(...arguments),this.name="",this.size=32}render(){this.style.setProperty("--sz",`${this.size}px`);const e=this.name.trim().split(/\s+/),t=e.length>1?e[0][0]+e[1][0]:this.name.slice(0,2);return r`${t}`}};xs.styles=z`
    :host {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sz, 32px);
      block-size: var(--sz, 32px);
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: calc(var(--sz, 32px) * 0.38);
      font-weight: var(--sw-fw-semibold);
      flex-shrink: 0;
      user-select: none;
    }
  `;ea([m()],xs.prototype,"name",2);ea([m({type:Number})],xs.prototype,"size",2);xs=ea([S("sw-avatar")],xs);var Ln=Object.defineProperty,Hn=Object.getOwnPropertyDescriptor,Es=(e,t,s,i)=>{for(var a=i>1?void 0:i?Hn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ln(t,s,a),a};let It=class extends x{constructor(){super(...arguments),this.selected=!1,this.dot=""}render(){return r`
      <button type="button" aria-pressed=${this.selected}>
        ${this.dot?r`<span class="d" style="--dot:${this.dot}"></span>`:""}
        ${this.icon?r`<sw-icon .name=${this.icon} size=${13}></sw-icon>`:""}
        <slot></slot>
        ${this.count!==void 0?r`<span class="count">(${this.count})</span>`:""}
      </button>
    `}};It.styles=z`
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 28px;
      padding-inline: 11px;
      border-radius: 8px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    button:hover {
      background: var(--sw-surface-2);
    }
    :host([selected]) button {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .d {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dot);
      flex-shrink: 0;
    }
    :host([selected]) .d {
      outline: 2px solid rgba(255, 255, 255, 0.7);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    :host([selected]) .count {
      color: rgba(255, 255, 255, 0.8);
    }
  `;Es([m({type:Boolean,reflect:!0})],It.prototype,"selected",2);Es([m()],It.prototype,"icon",2);Es([m({type:Number})],It.prototype,"count",2);Es([m()],It.prototype,"dot",2);It=Es([S("sw-chip")],It);var Vn=Object.defineProperty,jn=Object.getOwnPropertyDescriptor,ii=(e,t,s,i)=>{for(var a=i>1?void 0:i?jn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Vn(t,s,a),a};let Gt=class extends x{constructor(){super(...arguments),this.open=!1,this.heading="",this.subheading=""}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){return r`
      <aside class="panel" role="dialog" aria-modal="false" aria-label=${this.heading} ?hidden=${!this.open}>
        <div class="grip" aria-hidden="true"></div>
        <header>
          <div class="titles">
            <h3>${this.heading}</h3>
            ${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}
          </div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${y("actions.close")} @click=${this.close}></sw-button>
        </header>
        <div class="body"><slot></slot></div>
        <footer><slot name="footer"></slot></footer>
      </aside>
    `}};Gt.styles=z`
    :host {
      display: contents;
    }
    .panel {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: min(var(--sw-drawer-w), 100%);
      background: var(--sw-surface);
      border-inline-end: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      z-index: var(--sw-z-drawer);
      transform: translateX(100%);
      transition: transform var(--sw-t-med) var(--sw-ease);
      visibility: hidden;
    }
    :host-context([dir='ltr']) .panel {
      transform: translateX(-100%);
    }
    :host([open]) .panel {
      transform: none;
      visibility: visible;
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-3);
      padding: 12px 14px;
      border-block-end: 1px solid var(--sw-border);
    }
    .titles {
      flex: 1;
      min-inline-size: 0;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    footer {
      display: flex;
      gap: var(--sw-s-2);
      padding: 10px 14px;
      border-block-start: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    footer:empty,
    footer:not(:has(*)) {
      display: none;
    }
    .grip {
      display: none;
    }
    @media (max-width: 767px) {
      .panel {
        inset: auto 0 0 0;
        inline-size: 100%;
        max-block-size: 62dvh;
        border-inline-end: 0;
        border-block-start: 1px solid var(--sw-border);
        border-start-start-radius: var(--sw-r-lg);
        border-start-end-radius: var(--sw-r-lg);
        transform: translateY(100%);
        box-shadow: var(--sw-shadow-3);
      }
      :host-context([dir='ltr']) .panel {
        transform: translateY(100%);
      }
      .grip {
        display: block;
        inline-size: 40px;
        block-size: 4px;
        border-radius: 2px;
        background: var(--sw-border-strong);
        margin: var(--sw-s-2) auto 0;
      }
    }
  `;ii([m({type:Boolean,reflect:!0})],Gt.prototype,"open",2);ii([m()],Gt.prototype,"heading",2);ii([m()],Gt.prototype,"subheading",2);Gt=ii([S("sw-drawer")],Gt);var Fn=Object.defineProperty,Wn=Object.getOwnPropertyDescriptor,ts=(e,t,s,i)=>{for(var a=i>1?void 0:i?Wn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Fn(t,s,a),a};let mt=class extends x{constructor(){super(...arguments),this.heading="",this.x=0,this.y=0,this.stageWidth=0,this.stageHeight=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","dialog"),this.setAttribute("aria-modal","false")}willUpdate(){this.heading&&this.setAttribute("aria-label",this.heading)}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}updated(){const t=this.offsetHeight||260,s=16;let i=this.x+s;this.stageWidth&&i+268>this.stageWidth-8&&(i=Math.max(8,this.x-268-s));let a=this.y-t/2;this.stageHeight&&(a=Math.max(8,Math.min(this.stageHeight-t-8,a))),this.style.left=`${i}px`,this.style.top=`${Math.max(8,a)}px`}render(){return r`
      <header><h4>${this.heading}</h4><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
      <slot></slot>
      <footer><slot name="footer"></slot></footer>
    `}};mt.styles=z`
    :host {
      position: absolute;
      z-index: var(--sw-z-drawer);
      inline-size: 268px;
      max-inline-size: calc(100% - 24px);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: pop var(--sw-t-med) var(--sw-ease);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    footer {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    footer:not(:has(*)) {
      display: none;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }
  `;ts([m()],mt.prototype,"heading",2);ts([m({type:Number})],mt.prototype,"x",2);ts([m({type:Number})],mt.prototype,"y",2);ts([m({type:Number})],mt.prototype,"stageWidth",2);ts([m({type:Number})],mt.prototype,"stageHeight",2);mt=ts([S("sw-popover")],mt);var Un=Object.defineProperty,Zn=Object.getOwnPropertyDescriptor,ai=(e,t,s,i)=>{for(var a=i>1?void 0:i?Zn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Un(t,s,a),a};let Yt=class extends x{constructor(){super(...arguments),this.label="",this.hint="",this.inline=!1}render(){return r`
      ${this.label?r`<label>${this.label}</label>`:""}
      <slot></slot>
      ${this.hint?r`<div class="hint">${this.hint}</div>`:""}
    `}};Yt.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    :host([inline]) {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
    }
    label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    ::slotted(input),
    ::slotted(select),
    ::slotted(textarea) {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 30px;
      padding: 5px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    ::slotted(input:focus),
    ::slotted(select:focus),
    ::slotted(textarea:focus) {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    ::slotted([data-ltr]) {
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
    }
  `;ai([m()],Yt.prototype,"label",2);ai([m()],Yt.prototype,"hint",2);ai([m({type:Boolean,reflect:!0})],Yt.prototype,"inline",2);Yt=ai([S("sw-field")],Yt);var qn=Object.defineProperty,Kn=Object.getOwnPropertyDescriptor,hr=(e,t,s,i)=>{for(var a=i>1?void 0:i?Kn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&qn(t,s,a),a};let Gn=0,Zs=class extends x{constructor(){super(...arguments),this.kind="lobby",this.uid=`sc${Gn+=1}`}grad(e,t,s=!0){const i=`${e}-${this.uid}`;return h`<linearGradient id=${i} x1="0" y1="0" x2=${s?0:1} y2=${s?1:0}>${t.map(([a,n])=>h`<stop offset=${a} stop-color=${n} />`)}</linearGradient>`}url(e){return`url(#${e}-${this.uid})`}vignette(){const e=`vig-${this.uid}`;return h`<defs><radialGradient id=${e} cx="50%" cy="45%" r="72%"><stop offset="0.55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity="0.38" /></radialGradient></defs><rect width="320" height="180" fill=${`url(#${e})`} />`}entrance(){return h`
      <defs>${this.grad("wall",[[0,"#f3f1ec"],[1,"#d8d4cc"]])}${this.grad("floor",[[0,"#d2cdc2"],[1,"#a19a8c"]])}${this.grad("glass",[[0,"#e3edf6"],[.55,"#bfd2e6"],[1,"#8fa9c4"]],!1)}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <polygon points="0,0 320,0 250,30 70,30" fill="#e9e6df" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url("floor")} />
      ${[0,1,2,3,4,5].map(e=>h`<line x1=${-40+e*80} y1="180" x2=${100+e*24} y2="118" stroke="#fff" stroke-opacity="0.18" />`)}
      <rect x="0" y="30" width="70" height="88" fill="#8b6e4e" />
      ${[0,1,2,3,4,5].map(e=>h`<rect x=${4+e*11} y="30" width="4" height="88" fill="#6f563d" />`)}
      <rect x="250" y="30" width="70" height="88" fill="#ece9e3" />
      <rect x="118" y="32" width="114" height="86" fill="#2b2f36" />
      <rect x="124" y="38" width="48" height="74" fill=${this.url("glass")} />
      <rect x="178" y="38" width="48" height="74" fill=${this.url("glass")} />
      <polygon points="124,38 160,38 140,112 124,112" fill="#fff" fill-opacity="0.22" />
      <rect x="168" y="68" width="3" height="18" rx="1" fill="#d5dae2" />
      <rect x="179" y="68" width="3" height="18" rx="1" fill="#d5dae2" />
      <rect x="118" y="118" width="114" height="34" fill="#fff" fill-opacity="0.14" />
      <ellipse cx="276" cy="94" rx="19" ry="14" fill="#3f7d4b" /><ellipse cx="266" cy="85" rx="12" ry="10" fill="#4f9159" /><ellipse cx="288" cy="88" rx="11" ry="9" fill="#356d43" />
      <rect x="266" y="106" width="20" height="14" rx="2" fill="#6b6257" />
      <ellipse cx="100" cy="13" rx="11" ry="3" fill="#fff" fill-opacity="0.85" /><ellipse cx="220" cy="13" rx="11" ry="3" fill="#fff" fill-opacity="0.85" />
    `}lobby(){return h`
      <defs>${this.grad("wall",[[0,"#f5f0e7"],[1,"#e2d9ca"]])}${this.grad("floor",[[0,"#dccdb2"],[1,"#b19973"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="196" y="26" width="96" height="66" rx="2" fill="#d9e7f4" />
      <path d="M244 26v66M196 59h96" stroke="#fff" stroke-width="3" />
      <rect x="196" y="26" width="96" height="66" fill="none" stroke="#c8bfae" stroke-width="3" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url("floor")} />
      ${[0,1,2,3].map(e=>h`<line x1="0" y1=${132+e*14} x2="320" y2=${132+e*14} stroke="#fff" stroke-opacity="0.14" />`)}
      <rect x="26" y="86" width="132" height="8" rx="2" fill="#7c6248" />
      <rect x="30" y="94" width="124" height="36" rx="3" fill="#5a4636" />
      <rect x="188" y="102" width="96" height="28" rx="7" fill="#4a5568" />
      <rect x="194" y="92" width="40" height="16" rx="5" fill="#5b6a82" /><rect x="238" y="92" width="40" height="16" rx="5" fill="#5b6a82" />
      <ellipse cx="172" cy="86" rx="14" ry="11" fill="#3f7d4b" /><ellipse cx="164" cy="78" rx="9" ry="8" fill="#4f9159" />
      <rect x="166" y="96" width="12" height="16" rx="2" fill="#7a6c5d" />
      ${[60,120,180,240].map(e=>h`<ellipse cx=${e} cy="9" rx="7" ry="2.5" fill="#fff" fill-opacity="0.9" />`)}
    `}corridor(){return h`
      <defs>${this.grad("floor",[[0,"#cfc9bd"],[1,"#9c9587"]])}${this.grad("ceil",[[0,"#f3f1ec"],[1,"#e2ded6"]])}</defs>
      <rect width="320" height="180" fill="#d6d0c5" />
      <polygon points="0,0 320,0 200,42 120,42" fill=${this.url("ceil")} />
      <polygon points="0,0 120,42 120,138 0,180" fill="#e6e1d8" />
      <polygon points="320,0 200,42 200,138 320,180" fill="#d2ccc0" />
      <rect x="120" y="42" width="80" height="96" fill="#cbc4b8" />
      <rect x="150" y="70" width="22" height="68" fill="#8b7a67" />
      <rect x="153" y="73" width="16" height="30" fill="#c5d5e3" />
      <polygon points="0,180 320,180 200,138 120,138" fill=${this.url("floor")} />
      ${[0,1,2].map(e=>h`<line x1=${40+e*80} y1="180" x2=${140+e*20} y2="138" stroke="#fff" stroke-opacity="0.16" />`)}
      ${[0,1,2,3].map(e=>h`<rect x=${152-e*12} y=${24-e*6} width=${16+e*24} height="4" rx="2" fill="#fff" fill-opacity=${.9-e*.15} />`)}
      ${[0,1,2].map(e=>h`<rect x=${22+e*30} y=${58+e*10} width="10" height=${60-e*10} fill="#c9d5e3" fill-opacity="0.9" />`)}
    `}hall(){return h`
      <defs>${this.grad("wall",[[0,"#f2eee6"],[1,"#ddd6c9"]])}${this.grad("floor",[[0,"#c9c0b0"],[1,"#9a9081"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="112" width="320" height="68" fill=${this.url("floor")} />
      ${[0,1,2,3,4].map(e=>[0,1,2,3,4,5,6].map(t=>h`<rect x=${28+t*40+e*4} y=${96+e*14} width="22" height="9" rx="2" fill="#3b4557" />`))}
      <rect x="40" y="40" width="240" height="50" rx="2" fill="#dfe8f2" />
      <rect x="40" y="40" width="240" height="50" fill="none" stroke="#c9c1b3" stroke-width="3" />
      ${[80,140,200,240].map(e=>h`<line x1=${e} y1="40" x2=${e} y2="90" stroke="#fff" stroke-width="2" />`)}
      ${[60,130,200,260].map(e=>h`<ellipse cx=${e} cy="12" rx="9" ry="3" fill="#fff" fill-opacity="0.9" />`)}
    `}parking(){return h`
      <defs>${this.grad("wall",[[0,"#d3d7de"],[1,"#a1a7b1"]])}${this.grad("floor",[[0,"#8f959f"],[1,"#666c76"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="0" width="320" height="26" fill="#b9bec7" />
      ${[0,1,2].map(e=>h`<rect x="0" y=${8+e*6} width="320" height="2" fill="#98a0ab" />`)}
      <rect x="0" y="116" width="320" height="64" fill=${this.url("floor")} />
      ${[0,1,2,3,4,5].map(e=>h`<line x1=${-20+e*72} y1="180" x2=${90+e*28} y2="116" stroke="#e5e8ee" stroke-opacity="0.6" stroke-width="2" />`)}
      <rect x="34" y="26" width="20" height="100" fill="#7d8591" /><rect x="266" y="26" width="20" height="100" fill="#7d8591" />
      <rect x="110" y="102" width="72" height="24" rx="6" fill="#e8ebf0" /><polygon points="124,102 138,86 168,86 178,102" fill="#c6cfda" /><circle cx="126" cy="127" r="7" fill="#2c2f36" /><circle cx="170" cy="127" r="7" fill="#2c2f36" />
      <rect x="196" y="104" width="62" height="22" rx="6" fill="#3f4a5c" /><polygon points="208,104 220,90 244,90 252,104" fill="#5c6a80" /><circle cx="210" cy="127" r="6" fill="#1f232b" /><circle cx="246" cy="127" r="6" fill="#1f232b" />
      <rect x="130" y="30" width="60" height="5" rx="2" fill="#fff" fill-opacity="0.85" />
    `}warehouse(){return h`
      <defs>${this.grad("wall",[[0,"#e6e9ef"],[1,"#c6cbd3"]])}${this.grad("floor",[[0,"#b7bcc4"],[1,"#7f8592"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="104" width="320" height="76" fill=${this.url("floor")} />
      <line x1="118" y1="180" x2="150" y2="104" stroke="#e2b43a" stroke-width="3" /><line x1="202" y1="180" x2="170" y2="104" stroke="#e2b43a" stroke-width="3" />
      ${[[10,96],[230,316]].map(([e,t])=>h`
        <rect x=${e} y="18" width="6" height="150" fill="#c9772f" /><rect x=${t-6} y="40" width="6" height="128" fill="#c9772f" />
        ${[0,1,2].map(s=>h`<polygon points="${e},${52+s*36} ${t},${64+s*30} ${t},${68+s*30} ${e},${56+s*36}" fill="#b96a22" />`)}
        ${[0,1,2].map(s=>[0,1,2].map(i=>h`<rect x=${e+10+i*26} y=${32+s*36+i*3} width="20" height="16" rx="1" fill=${i%2?"#a8825d":"#c7a17a"} />`))}
      `)}
      <rect x="130" y="8" width="60" height="6" rx="3" fill="#fff" fill-opacity="0.9" /><rect x="120" y="40" width="80" height="5" rx="2" fill="#fff" fill-opacity="0.6" />
    `}backyard(){return h`
      <defs>${this.grad("sky",[[0,"#c4d9ee"],[1,"#e9f1f8"]])}${this.grad("lawn",[[0,"#86bb6f"],[1,"#4d8240"]])}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="62" width="320" height="50" fill="#b8905f" />
      ${Array.from({length:27},(e,t)=>h`<rect x=${t*12} y="62" width="2" height="50" fill="#9c7749" />`)}
      <rect x="0" y="66" width="320" height="4" fill="#a37e51" /><rect x="0" y="100" width="320" height="4" fill="#a37e51" />
      <circle cx="42" cy="52" r="27" fill="#3f7f45" /><circle cx="72" cy="46" r="20" fill="#4f9552" /><circle cx="282" cy="48" r="32" fill="#36763f" /><circle cx="250" cy="58" r="18" fill="#4a8a4c" />
      <rect x="0" y="112" width="320" height="68" fill=${this.url("lawn")} />
      ${[0,1,2].map(e=>h`<rect x="0" y=${118+e*20} width="320" height="10" fill="#fff" fill-opacity="0.07" />`)}
      <polygon points="150,180 320,180 300,128 172,128" fill="#c9c3b5" />
      <ellipse cx="238" cy="146" rx="28" ry="9" fill="#4a4f57" /><rect x="236" y="146" width="4" height="18" fill="#3a3f47" />
      <rect x="196" y="140" width="16" height="11" rx="3" fill="#565b64" /><rect x="262" y="140" width="16" height="11" rx="3" fill="#565b64" />
    `}driveway(){return h`
      <defs>${this.grad("sky",[[0,"#bfd6ee"],[1,"#eaf1f8"]])}${this.grad("drive",[[0,"#b6bac2"],[1,"#868b95"]])}${this.grad("lawn",[[0,"#8fbf72"],[1,"#5c8f47"]])}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <circle cx="20" cy="92" r="22" fill="#4f8d4f" /><circle cx="300" cy="96" r="18" fill="#437d47" />
      <polygon points="28,66 100,26 172,66" fill="#7d6e62" />
      <rect x="40" y="64" width="120" height="52" fill="#efe9df" />
      <rect x="55" y="76" width="22" height="18" fill="#9fb8d3" /><rect x="120" y="76" width="22" height="18" fill="#9fb8d3" /><rect x="92" y="84" width="18" height="32" fill="#5b4a3b" />
      <rect x="0" y="110" width="200" height="70" fill=${this.url("lawn")} />
      <rect x="0" y="98" width="200" height="14" rx="6" fill="#4b8248" />
      <polygon points="160,180 320,180 300,110 200,110" fill=${this.url("drive")} />
      <rect x="205" y="118" width="100" height="30" rx="8" fill="#f4f6f9" />
      <polygon points="226,118 246,100 286,100 300,118" fill="#dfe5ee" /><polygon points="231,117 248,103 283,103 296,117" fill="#8ea3bb" />
      <circle cx="226" cy="150" r="10" fill="#2c2f36" /><circle cx="226" cy="150" r="4" fill="#8a8f99" /><circle cx="290" cy="150" r="10" fill="#2c2f36" /><circle cx="290" cy="150" r="4" fill="#8a8f99" />
      <rect x="300" y="128" width="6" height="8" rx="2" fill="#fff3c4" />
    `}night(){const e=`glow-${this.uid}`;return h`
      <defs>${this.grad("sky",[[0,"#0d1730"],[1,"#050912"]])}<radialGradient id=${e} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f5d78a" stop-opacity="0.55" /><stop offset="1" stop-color="#f5d78a" stop-opacity="0" /></radialGradient></defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="120" width="320" height="60" fill="#0a1020" />
      <circle cx="251" cy="34" r="110" fill=${`url(#${e})`} />
      <rect x="250" y="30" width="3" height="92" fill="#2a3350" /><rect x="238" y="24" width="27" height="8" rx="3" fill="#3b4666" />
      <ellipse cx="251" cy="124" rx="70" ry="12" fill="#f5d78a" fill-opacity="0.16" />
      <rect x="60" y="100" width="92" height="24" rx="7" fill="#131b33" /><polygon points="78,100 94,84 124,84 138,100" fill="#1a2440" />
      <circle cx="80" cy="125" r="8" fill="#0a0f1f" /><circle cx="134" cy="125" r="8" fill="#0a0f1f" />
      ${[0,1,2,3,4,5,6].map(t=>h`<rect x=${t*48} y="88" width="2" height="34" fill="#1b2440" />`)}
      <rect x="0" y="88" width="320" height="2" fill="#1b2440" />
    `}building(){return h`
      <defs>${this.grad("sky",[[0,"#c2d7ec"],[1,"#e9f0f7"]])}${this.grad("face",[[0,"#e6eaf0"],[1,"#c8cfd9"]],!1)}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="156" width="320" height="24" fill="#aab2be" />
      <rect x="92" y="28" width="136" height="130" fill=${this.url("face")} />
      <rect x="228" y="52" width="46" height="106" fill="#b9c1cd" />
      ${[0,1,2,3,4,5].map(e=>[0,1,2,3,4].map(t=>h`<rect x=${102+t*24} y=${38+e*19} width="16" height="12" rx="1" fill=${(e+t)%3?"#8fa8c6":"#c9dbee"} />`))}
      ${[0,1,2,3,4].map(e=>[0,1].map(t=>h`<rect x=${236+t*18} y=${62+e*19} width="12" height="10" rx="1" fill="#8ea3bd" />`))}
      <rect x="118" y="138" width="84" height="8" rx="2" fill="#4b5565" /><rect x="140" y="146" width="40" height="12" fill="#6d7f9a" />
      <circle cx="40" cy="132" r="26" fill="#4a8a4c" /><circle cx="292" cy="140" r="20" fill="#3f7d45" />
    `}house(){return h`
      <defs>${this.grad("sky",[[0,"#c2d7ec"],[1,"#ebf1f7"]])}${this.grad("lawn",[[0,"#8dbd70"],[1,"#5a8d46"]])}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="128" width="320" height="52" fill=${this.url("lawn")} />
      <polygon points="58,76 160,22 262,76" fill="#6e5f55" />
      <rect x="78" y="74" width="164" height="60" fill="#f2ede4" />
      <rect x="96" y="88" width="26" height="22" fill="#9fb8d3" /><rect x="148" y="90" width="20" height="44" fill="#5b4a3b" /><rect x="182" y="94" width="50" height="40" fill="#cfd4dc" />
      <path d="M182 104h50M182 114h50M182 124h50" stroke="#b9c0ca" stroke-width="2" />
      <polygon points="140,180 180,180 176,134 152,134" fill="#c7c1b4" />
      <circle cx="30" cy="112" r="24" fill="#4a8a4c" /><circle cx="296" cy="118" r="20" fill="#3f7d45" />
    `}scene(){switch(this.kind){case"entrance":return this.entrance();case"lobby":return this.lobby();case"corridor":return this.corridor();case"hall":return this.hall();case"parking":return this.parking();case"warehouse":return this.warehouse();case"backyard":return this.backyard();case"driveway":return this.driveway();case"night":return this.night();case"building":return this.building();case"house":return this.house();default:return c}}render(){return this.kind==="none"?r``:r`<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${this.scene()}${this.vignette()}</svg>`}};Zs.styles=z`
    :host {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      overflow: hidden;
      background: #0f1729;
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
  `;hr([m({reflect:!0})],Zs.prototype,"kind",2);Zs=hr([S("sw-scene")],Zs);class be extends Error{constructor(t,s){super(s.user_message||s.code),this.status=t,this.body=s}get code(){return this.body.code}}function Yn(){return new URL("api/v1/",document.baseURI)}function he(e){return new URL(e.replace(/^\/+/,""),Yn()).toString()}function tt(e){return new URL(e.replace(/^\/+/,""),document.baseURI).toString()}async function Rt(e,t={}){const s=new Headers(t.headers);t.body&&!(t.body instanceof FormData)&&!s.has("Content-Type")&&s.set("Content-Type","application/json");const i=await fetch(he(e),{...t,headers:s,credentials:"same-origin"});if(i.status===204)return;const a=await i.text();let n=null;try{n=a?JSON.parse(a):null}catch{n=null}if(!i.ok){const o=n??{code:`http_${i.status}`,user_message:i.statusText,retryable:!1,correlation_id:"",details:{}};throw new be(i.status,o)}return n}const k=e=>Rt(e),M=(e,t)=>Rt(e,{method:"POST",body:t===void 0?void 0:JSON.stringify(t)}),He=(e,t)=>Rt(e,{method:"PATCH",body:JSON.stringify(t)}),Me=(e,t)=>Rt(e,{method:"PUT",body:JSON.stringify(t)}),me=e=>Rt(e,{method:"DELETE"}),ri=(e,t)=>Rt(e,{method:"POST",body:t});function w(e){return e instanceof be?e.body.user_message||e.body.code||`השרת דחה את הבקשה (${e.status})`:e instanceof TypeError?"אין חיבור לשרת.":e instanceof Error?e.message:String(e)}const ur=()=>k("settings"),Jn=e=>He("settings",e),Xn=()=>M("media/streams/sync"),Qn=()=>k("media/streams"),eo=()=>k("media/sessions");function qe(e,t){return he(`cameras/${e}/snapshot.jpg${t?`?t=${t}`:""}`)}function to(e,t){const s=new URL(he(`media/live/${e}/ws?profile=${t}`));return s.protocol=s.protocol==="https:"?"wss:":"ws:",s.toString()}const Ai="sw.transport";function mr(){try{const e=localStorage.getItem(Ai);return e==="webrtc"||e==="mse"||e==="auto"?e:""}catch{return""}}function so(e){try{e?localStorage.setItem(Ai,e):localStorage.removeItem(Ai)}catch{}}const io=(e,t=!1)=>k(`cameras/${e}/zones${t?"?refresh=true":""}`),ao=(e,t=!1)=>k(`cameras/${e}/capabilities${t?"?refresh=true":""}`);var ro=Object.defineProperty,no=Object.getOwnPropertyDescriptor,we=(e,t,s,i)=>{for(var a=i>1?void 0:i?no(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ro(t,s,a),a};const oo=["avc1.640029","avc1.64002A","avc1.640033","hvc1.1.6.L153.B0","mp4a.40.2","mp4a.40.5","flac","opus"],lo=12e3,co=2e4,po=3e3,ho=3e4,uo=25;let le=class extends x{constructor(){super(...arguments),this.cameraId="",this.profile="sub",this.mode="auto",this.poster="",this.active=!0,this.compact=!1,this.wsUrl="",this.retry=!0,this.recorded=!1,this.stale=!1,this.status="idle",this.transport="",this.error="",this.muted=!0,this.ws=null,this.pc=null,this.ms=null,this.sb=null,this.queue=[],this.generation=0,this.triedWebrtc=!1,this.pendingMime="",this.attempts=0,this.lastPreferMse=!1}disconnectedCallback(){super.disconnectedCallback(),this.disconnect()}updated(e){(e.has("active")||e.has("cameraId")||e.has("profile")||e.has("mode")||e.has("wsUrl"))&&(!this.active||!this.cameraId&&!this.wsUrl?this.disconnect():this.reconnect())}get mediaTime(){return this.video?.currentTime??0}get bufferAhead(){const e=this.video;if(!e||!e.buffered.length)return 0;for(let t=0;t<e.buffered.length;t++)if(e.currentTime>=e.buffered.start(t)-.05&&e.currentTime<=e.buffered.end(t))return e.buffered.end(t)-e.currentTime;return 0}stepFrame(e,t=25){const s=this.video;if(!s||!s.buffered.length||!t)return!1;s.pause();const i=s.currentTime+e/t;for(let n=0;n<s.buffered.length;n++)if(i>=s.buffered.start(n)&&i<=s.buffered.end(n))return s.currentTime=i,!0;const a=s.buffered.end(s.buffered.length-1);return e>0&&i>a&&i-a<=1?(s.currentTime=i,!0):!1}get rate(){return this.video?.playbackRate??1}set rate(e){this.video&&Math.abs(this.video.playbackRate-e)>.001&&(this.video.playbackRate=e)}get paused(){return this.video?.paused??!0}pause(){this.video?.pause()}resume(){this.video?.play().catch(()=>{})}reconnect(){this.disconnect(),this.connect()}connect(e=!1){if(!this.cameraId&&!this.wsUrl||!this.active)return;this.teardown();const t=this.generation+=1;this.status="connecting",this.error="",this.transport="",this.triedWebrtc=e,this.lastPreferMse=e;let s;try{s=new WebSocket(this.wsUrl||to(this.cameraId,this.profile))}catch{this.fail("לא ניתן לפתוח חיבור");return}s.binaryType="arraybuffer",this.ws=s,s.onopen=()=>{t===this.generation&&(this.wsUrl||this.mode==="mse"||this.mode==="auto"&&e?this.startMse():this.startWebrtc())},s.onmessage=i=>{t===this.generation&&(typeof i.data=="string"?this.onSignal(i.data):this.onFragment(i.data))},s.onerror=()=>{},s.onclose=i=>{if(t!==this.generation||this.status==="error")return;if(this.mode==="auto"&&this.transport==="webrtc"&&this.status!=="playing"&&i.code<4e3){this.webrtcFailed("WebRTC נכשל");return}if(!this.retry&&this.status==="playing"&&i.code<4e3){this.teardown(),this.status="ended",this.dispatchEvent(new CustomEvent("player-status",{detail:{status:"ended"},bubbles:!0,composed:!0}));return}const a=i.code===4403?"אין הרשאת צפייה":i.code===4429?"הגיע למכסת הזרמים":i.code===4503?"go2rtc לא זמין":i.code===4401?"נדרשת הזדהות":i.code===4404?"סשן הניגון פג":i.code===4410?"הסשן הוחלף":this.status==="playing"?"החיבור נותק":"החיבור נסגר";this.fail(a,this.retry&&i.code!==4401&&i.code!==4403&&i.code!==4404&&i.code!==4410)}}disconnect(){this.teardown(),window.clearTimeout(this.retryTimer),this.attempts=0,this.status="idle",this.transport=""}teardown(){this.generation+=1,window.clearTimeout(this.timer),window.clearTimeout(this.retryTimer),this.pendingMime="",this.pc&&(this.pc.close(),this.pc=null),this.ws&&(this.ws.onclose=null,this.ws.onerror=null,this.ws.onmessage=null,this.ws.onopen=null,this.ws.close(),this.ws=null),this.sb=null,this.queue=[],this.stale=!1,this.ms=null,this.video&&(this.video.pause(),this.video.srcObject=null,this.video.src.startsWith("blob:")&&URL.revokeObjectURL(this.video.src),this.video.removeAttribute("src"),this.video.load())}send(e){this.ws&&this.ws.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify(e))}fail(e,t=!0){if(this.teardown(),this.status="error",this.error=e,this.dispatchEvent(new CustomEvent("player-status",{detail:{status:"error",error:e},bubbles:!0,composed:!0})),t&&this.retry&&this.active&&(this.cameraId||this.wsUrl)){const s=Math.min(ho,po*2**Math.min(this.attempts,6));this.attempts+=1,this.retryTimer=window.setTimeout(()=>this.connect(this.lastPreferMse),s)}}async startWebrtc(){this.triedWebrtc=!0,this.transport="webrtc";const e=this.generation,t=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});this.pc=t,t.ontrack=s=>{if(e!==this.generation)return;const i=s.streams[0]??new MediaStream([s.track]);this.video.srcObject!==i&&(this.video.srcObject=i,this.video.play().catch(()=>{}))},t.onicecandidate=s=>{e===this.generation&&s.candidate&&this.send({type:"webrtc/candidate",value:s.candidate.candidate})},t.onconnectionstatechange=()=>{e===this.generation&&(t.connectionState==="failed"||t.connectionState==="disconnected"||t.connectionState==="closed")&&this.webrtcFailed("WebRTC נכשל")},t.addTransceiver("video",{direction:"recvonly"}),t.addTransceiver("audio",{direction:"recvonly"});try{const s=await t.createOffer();await t.setLocalDescription(s),this.send({type:"webrtc/offer",value:s.sdp})}catch{this.webrtcFailed("WebRTC לא נתמך בדפדפן");return}window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>{if(this.status==="playing")return;const s=this.pc?.connectionState==="connected";this.webrtcFailed(s?"WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה — בחר MSE או אוטומטי":"WebRTC לא התחבר (UDP חסום?)")},lo)}webrtcFailed(e){if(this.status==="playing"&&this.transport==="webrtc"){this.fail("החיבור נותק");return}if(this.mode==="auto"&&!this.triedWebrtc){this.fail(e);return}this.mode==="auto"?(this.disconnect(),this.connect(!0)):this.fail(e)}startMse(){if(!("MediaSource"in window)){this.fail("MSE לא נתמך בדפדפן");return}window.clearTimeout(this.timer),this.transport="mse",this.queue=[],this.stale=!1,this.sb=null;const e=new MediaSource;this.ms=e,this.video.srcObject=null,this.video.src=URL.createObjectURL(e);const t=this.generation;e.addEventListener("sourceopen",()=>{if(t!==this.generation)return;const s=oo.filter(i=>MediaSource.isTypeSupported(`video/mp4; codecs="${i}"`)).join(",");this.send({type:"mse",value:s}),this.pendingMime&&this.openSourceBuffer(this.pendingMime)},{once:!0}),this.timer=window.setTimeout(()=>{this.status!=="playing"&&this.fail(`לא התקבל וידאו (${this.mseTrace()})`)},co)}mseTrace(){const e=this.video;return`ms=${this.ms?.readyState??"-"} sb=${this.sb?"y":"n"} q=${this.queue.length} rs=${e?.readyState??"-"} buf=${e?.buffered.length?e.buffered.end(e.buffered.length-1).toFixed(1):"-"}`}openSourceBuffer(e){if(!this.ms||this.ms.readyState!=="open"){this.pendingMime=e;return}this.pendingMime="";try{const t=this.ms.addSourceBuffer(e);t.mode="segments",t.addEventListener("updateend",()=>this.flush()),this.sb=t,this.video.play().catch(()=>{}),this.flush()}catch{this.fail("הדפדפן לא תומך ב־codec של המצלמה")}}onSignal(e){let t;try{t=JSON.parse(e)}catch{return}switch(t.type){case"webrtc/answer":this.pc?.setRemoteDescription({type:"answer",sdp:t.value??""}).catch(()=>this.webrtcFailed("WebRTC: תשובה לא תקינה"));break;case"webrtc/candidate":this.pc?.addIceCandidate({candidate:t.value??"",sdpMid:"0"}).catch(()=>{});break;case"mse":this.openSourceBuffer(t.value??'video/mp4; codecs="avc1.640029"');break;case"error":this.transport==="webrtc"&&this.mode==="auto"?this.webrtcFailed(t.value??"WebRTC"):this.fail(t.value==="upstream_unavailable"?"go2rtc לא זמין":`שגיאת זרם: ${t.value??""}`);break}}onFragment(e){if(this.recorded&&this.bufferAhead>uo){this.stale=!0;return}this.queue.push(e),this.flush()}evict(e){const t=this.sb,s=this.video;if(!t||t.updating||!s.buffered.length)return!1;const i=s.buffered.start(0),a=Math.max(i,s.currentTime-e);if(a-i<1)return!1;try{return t.remove(i,a),!0}catch{return!1}}flush(){const e=this.sb;if(!e||e.updating||!this.ms||this.ms.readyState!=="open")return;const t=this.video;if(t.buffered.length&&t.readyState<3&&t.currentTime<t.buffered.start(0)&&(t.currentTime=t.buffered.start(0)),t.buffered.length&&t.currentTime-t.buffered.start(0)>12&&this.evict(6))return;const s=this.queue.shift();if(s)try{e.appendBuffer(s)}catch(i){const a=i?.name??"Error";if(a==="QuotaExceededError"){this.queue.unshift(s),this.evict(2)||this.queue.shift();return}console.warn("sw-live-player: appendBuffer failed",a,i?.message),this.fail(`שגיאת buffer (${a})`)}}onTimeUpdate(){const e=this.video;if(this.transport!=="mse"||!e.buffered.length||this.recorded)return;const t=e.buffered.end(e.buffered.length-1);t-e.currentTime>2.5&&(e.currentTime=t-.5)}onPlaying(){window.clearTimeout(this.timer),this.attempts=0,this.status="playing",this.dispatchEvent(new CustomEvent("player-status",{detail:{status:"playing",transport:this.transport},bubbles:!0,composed:!0}))}toggleMute(){this.muted=!this.muted,this.video.muted=this.muted}fullscreen(){this.video.requestFullscreen?.()??Promise.resolve()}render(){const e=this.status!=="playing";return r`
      ${this.poster&&e?r`<img class="poster" src=${this.poster} alt="" />`:c}
      <video class=${e?"hidden":""} autoplay playsinline muted @playing=${this.onPlaying} @timeupdate=${this.onTimeUpdate}></video>
      ${this.status==="connecting"?r`<div class="center"><div><span class="spin"></span><span>מתחבר${this.transport?` · ${this.transport==="webrtc"?"WebRTC":"MSE"}`:""}…</span></div></div>`:c}
      ${this.status==="error"?r`<div class="center"><div><sw-icon name="offline" size=${22}></sw-icon><span>${this.error}</span></div></div>`:c}
      ${this.status==="ended"?r`<div class="center"><div><sw-icon name="history" size=${22}></sw-icon><span>הקטע הסתיים</span></div></div>`:c}
      ${this.status==="idle"&&!this.poster?r`<div class="center"><div><sw-icon name="camera" size=${22}></sw-icon><span>לא מחובר</span></div></div>`:c}
      <span class="status ${this.status}"><i></i><span class="t">${this.status==="playing"?`${this.wsUrl?"הקלטה":"חי"} · ${this.transport==="webrtc"?"WebRTC":"MSE"}`:this.status==="connecting"?"מתחבר":this.status==="error"?"לא זמין":this.status==="ended"?"הסתיים":"תמונה"}</span></span>
      ${this.status==="playing"?r`<button class="mute" title=${this.muted?"הפעל שמע":"השתק"} aria-label=${this.muted?"הפעל שמע":"השתק"} @click=${this.toggleMute}><sw-icon name=${this.muted?"volume":"mic"} size=${13}></sw-icon></button>`:c}
    `}};le.styles=z`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      block-size: 100%;
      background: #0f1729;
      overflow: hidden;
    }
    video,
    img.poster {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      background: #0f1729;
    }
    img.poster {
      object-fit: cover;
    }
    video.hidden {
      visibility: hidden;
    }
    .status {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-end: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10.5px;
      font-weight: 600;
      color: #fff;
      background: rgba(17, 24, 39, 0.6);
      border-radius: 999px;
      padding: 2px 8px;
      backdrop-filter: blur(6px);
    }
    .status i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: #f59e0b;
    }
    .status.playing i {
      background: #22c55e;
    }
    .status.error i {
      background: #ef4444;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.85);
      font-size: 11.5px;
      text-align: center;
      padding: 12px;
      background: rgba(15, 23, 41, 0.35);
    }
    .center div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    .spin {
      inline-size: 22px;
      block-size: 22px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .mute {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 8px;
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      border: 0;
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    :host([compact]) .mute,
    :host([compact]) .status span.t {
      display: none;
    }
  `;we([m()],le.prototype,"cameraId",2);we([m()],le.prototype,"profile",2);we([m()],le.prototype,"mode",2);we([m()],le.prototype,"poster",2);we([m({type:Boolean})],le.prototype,"active",2);we([m({type:Boolean,reflect:!0})],le.prototype,"compact",2);we([m()],le.prototype,"wsUrl",2);we([m({type:Boolean})],le.prototype,"retry",2);we([m({type:Boolean})],le.prototype,"recorded",2);we([d()],le.prototype,"status",2);we([d()],le.prototype,"transport",2);we([d()],le.prototype,"error",2);we([d()],le.prototype,"muted",2);we([es("video")],le.prototype,"video",2);le=we([S("sw-live-player")],le);var mo=Object.defineProperty,fo=Object.getOwnPropertyDescriptor,ve=(e,t,s,i)=>{for(var a=i>1?void 0:i?fo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&mo(t,s,a),a};let de=class extends x{constructor(){super(...arguments),this.name="",this.meta="",this.state="unknown",this.scene="lobby",this.selected=!1,this.compact=!1,this.dark=!1,this.noDemo=!1,this.stamp="",this.poster="",this.cameraId="",this.live=!1,this.profile="sub",this.transport="auto"}offMessage(){return this.state==="forbidden"?"אין הרשאת צפייה":this.state==="offline"?"המצלמה מנותקת":"מצב לא ידוע"}render(){if(this.state==="offline"||this.state==="forbidden"||this.state==="unknown")return r`<div class="off">
        <sw-icon name=${this.state==="forbidden"?"lock":"offline"} size=${this.compact?18:24}></sw-icon>
        <span>${this.offMessage()}</span>
        ${this.name?r`<span class="label"><span class="dot"></span>${this.name}</span>`:c}
      </div>`;const t=this.live&&this.cameraId?"live":this.poster?"poster":"scene";return r`
      ${t==="live"?r`<sw-live-player .cameraId=${this.cameraId} .profile=${this.profile} .mode=${this.transport} .poster=${this.poster} compact></sw-live-player>`:t==="poster"?r`<img class="poster" src=${this.poster} alt="" />`:r`<sw-scene kind=${this.scene}></sw-scene>`}
      <div class="shade"></div>
      ${t==="scene"&&!this.noDemo?r`<span class="demo">דמו</span>`:t==="poster"?r`<span class="demo">צילום</span>`:c}
      ${this.state==="stale"||this.state==="recorded"||this.state==="historic"?r`<sw-badge class="pill" onImage kind=${this.state}></sw-badge>`:c}
      ${this.name?r`<span class="label"><span class="dot"></span>${this.name}</span>`:c}
      ${this.stamp?r`<span class="stamp">${this.stamp}</span>`:this.meta&&!this.compact?r`<span class="meta">${this.meta}</span>`:c}
    `}};de.styles=z`
    :host {
      display: block;
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      cursor: pointer;
      min-inline-size: 0;
      box-shadow: var(--sw-shadow-1);
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
      isolation: isolate;
    }
    :host(:hover) {
      box-shadow: var(--sw-shadow-2);
    }
    :host([selected]) {
      box-shadow: 0 0 0 2px var(--sw-accent), var(--sw-shadow-2);
    }
    sw-scene,
    sw-live-player,
    img.poster {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }
    .off {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface-3);
      text-align: center;
      padding: 8px;
    }
    :host([dark]) .off {
      background: #172036;
      color: rgba(255, 255, 255, 0.65);
    }
    .off sw-icon {
      color: var(--sw-text-3);
    }
    .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: 9.5px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .pill {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
    }
    .label {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-end: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #fff;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
      max-inline-size: calc(100% - 20px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host([compact]) .label {
      font-size: var(--sw-fs-xs);
      inset-inline-start: 8px;
      inset-block-end: 6px;
    }
    .label .dot {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
      box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.5);
      flex-shrink: 0;
    }
    :host([state='stale']) .label .dot {
      background: var(--sw-stale);
    }
    :host([state='recorded']) .label .dot,
    :host([state='historic']) .label .dot {
      background: var(--sw-accent);
    }
    .off .label {
      position: static;
      color: var(--sw-text);
      text-shadow: none;
      font-weight: var(--sw-fw-semibold);
    }
    :host([dark]) .off .label {
      color: #fff;
    }
    .off .label .dot {
      background: var(--sw-offline);
      box-shadow: none;
    }
    :host([state='forbidden']) .off .label .dot {
      background: var(--sw-danger);
    }
    .stamp {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 8px;
      font-family: var(--sw-font-mono);
      font-size: 10px;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
    }
    :host([compact]) .stamp {
      display: none;
    }
    .meta {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 8px;
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.85);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
  `;ve([m()],de.prototype,"name",2);ve([m()],de.prototype,"meta",2);ve([m({reflect:!0})],de.prototype,"state",2);ve([m({reflect:!0})],de.prototype,"scene",2);ve([m({type:Boolean,reflect:!0})],de.prototype,"selected",2);ve([m({type:Boolean,reflect:!0})],de.prototype,"compact",2);ve([m({type:Boolean,reflect:!0})],de.prototype,"dark",2);ve([m({type:Boolean,reflect:!0})],de.prototype,"noDemo",2);ve([m()],de.prototype,"stamp",2);ve([m()],de.prototype,"poster",2);ve([m()],de.prototype,"cameraId",2);ve([m({type:Boolean})],de.prototype,"live",2);ve([m()],de.prototype,"profile",2);ve([m()],de.prototype,"transport",2);de=ve([S("sw-camera-tile")],de);var wo=Object.defineProperty,vo=Object.getOwnPropertyDescriptor,ss=(e,t,s,i)=>{for(var a=i>1?void 0:i?vo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&wo(t,s,a),a};const go={loading:{icon:"clock",title:()=>y("states.loading"),hint:()=>"",tone:"neutral"},empty:{icon:"map",title:()=>y("states.empty"),hint:()=>"",tone:"neutral"},error:{icon:"warning",title:()=>y("states.error"),hint:()=>y("states.errorHint"),tone:"danger"},forbidden:{icon:"lock",title:()=>y("states.forbidden"),hint:()=>y("states.forbiddenHint"),tone:"forbidden"},stale:{icon:"offline",title:()=>y("states.stale"),hint:()=>y("states.staleHint"),tone:"stale"},partial:{icon:"info",title:()=>y("states.partial"),hint:()=>"",tone:"stale"}};let ft=class extends x{constructor(){super(...arguments),this.state="empty",this.heading="",this.hint="",this.actionLabel="",this.compact=!1}render(){const e=this.state==="error"&&/אין (לך )?הרשא/.test(this.hint),t=go[e?"forbidden":this.state],s=this.hint||t.hint();return r`
      <div class="icon" data-look=${e?"forbidden":""} aria-hidden="true"><sw-icon .name=${t.icon} size=${this.compact?20:26}></sw-icon></div>
      <div class="text" role="status">
        <h4>${this.heading||t.title()}</h4>
        ${s?r`<p>${s}</p>`:""}
        <slot></slot>
      </div>
      ${this.actionLabel&&!e?r`<sw-button variant=${this.state==="error"?"primary":"secondary"} size="sm" @click=${()=>this.dispatchEvent(new CustomEvent("action",{bubbles:!0,composed:!0}))}>${this.actionLabel}</sw-button>`:""}
    `}};ft.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: var(--sw-s-3);
      padding: var(--sw-s-8) var(--sw-s-4);
      color: var(--sw-text-2);
      min-block-size: 220px;
    }
    :host([compact]) {
      min-block-size: 0;
      padding: var(--sw-s-4);
      flex-direction: row;
      text-align: start;
      justify-content: flex-start;
    }
    .icon {
      display: grid;
      place-items: center;
      inline-size: 48px;
      block-size: 48px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    :host([compact]) .icon {
      inline-size: 34px;
      block-size: 34px;
      border-radius: var(--sw-r-sm);
    }
    :host([state='error']) .icon {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    :host([state='forbidden']) .icon,
    .icon[data-look='forbidden'] {
      background: var(--sw-forbidden-soft);
      color: var(--sw-forbidden);
    }
    :host([state='stale']) .icon,
    :host([state='partial']) .icon {
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
    }
    :host([state='loading']) .icon {
      animation: spin 1.2s linear infinite;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    p {
      margin: 0;
      max-inline-size: 42ch;
      font-size: var(--sw-fs-sm);
    }
    .text {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      align-items: inherit;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([state='loading']) .icon {
        animation: none;
      }
    }
  `;ss([m({reflect:!0})],ft.prototype,"state",2);ss([m()],ft.prototype,"heading",2);ss([m()],ft.prototype,"hint",2);ss([m()],ft.prototype,"actionLabel",2);ss([m({type:Boolean,reflect:!0})],ft.prototype,"compact",2);ft=ss([S("sw-state-panel")],ft);var bo=Object.defineProperty,yo=Object.getOwnPropertyDescriptor,ni=(e,t,s,i)=>{for(var a=i>1?void 0:i?yo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&bo(t,s,a),a};let Jt=class extends x{constructor(){super(...arguments),this.open=!1,this.heading="",this.subheading="",this.onKey=e=>{e.key==="Escape"&&this.open&&this.close()}}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}updated(e){!e.has("open")||!this.open||requestAnimationFrame(()=>{const t=i=>{for(const a of i.querySelectorAll("[autofocus], input, textarea, select, sw-button, button"))if(!(a.hasAttribute("disabled")||a.type==="hidden"||a.slot==="footer"))return a.tagName==="SW-BUTTON"?a.shadowRoot?.querySelector("button")??a:a;for(const a of i.querySelectorAll("*")){const n=a.shadowRoot&&t(a.shadowRoot);if(n)return n}return null},s=t(this)??this.renderRoot.querySelector(".box");s&&(!s.hasAttribute("tabindex")&&!s.matches("input, textarea, select, button, a[href]")&&s.setAttribute("tabindex","-1"),s.focus({preventScroll:!0}))})}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey)}render(){return r`<div class="backdrop" @click=${e=>e.target===e.currentTarget&&this.close()}>
      <div class="box" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <header><div><h3>${this.heading}</h3>${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}</div><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
        <div class="body"><slot></slot></div>
        <footer><slot name="footer"></slot></footer>
      </div>
    </div>`}};Jt.styles=z`
    :host {
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--sw-overlay);
      z-index: var(--sw-z-modal);
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .box {
      inline-size: min(440px, 100%);
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      max-block-size: calc(100dvh - 32px);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 14px 16px 10px;
    }
    header div {
      flex: 1;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 2px;
    }
    .body {
      padding: 0 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: auto;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px 14px;
      border-block-start: 1px solid var(--sw-border);
    }
  `;ni([m({type:Boolean,reflect:!0})],Jt.prototype,"open",2);ni([m()],Jt.prototype,"heading",2);ni([m()],Jt.prototype,"subheading",2);Jt=ni([S("sw-dialog")],Jt);var $o=Object.defineProperty,xo=Object.getOwnPropertyDescriptor,W=(e,t,s,i)=>{for(var a=i>1?void 0:i?xo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&$o(t,s,a),a};const ui=.2,mi=6,ya={live:"var(--sw-accent)",recorded:"var(--sw-accent)",historic:"var(--sw-accent)",offline:"var(--sw-offline)",stale:"var(--sw-stale)",unknown:"var(--sw-unknown)",forbidden:"var(--sw-forbidden)",error:"var(--sw-danger)",neutral:"var(--sw-surface)",partial:"var(--sw-stale)"},ko={camera:h`<path d="M-7 -4.5A1.5 1.5 0 0 1 -5.5 -6H-2l1.5-2h5L6 -6h1.5A1.5 1.5 0 0 1 9 -4.5v9A1.5 1.5 0 0 1 7.5 6h-13A1.5 1.5 0 0 1 -7 4.5z" transform="translate(-1 0) scale(0.9)"/><circle cx="-1" cy="0" r="3"/>`,lock:h`<rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/>`,light:h`<path d="M-3 6h6M-2 8.5h4"/><path d="M0 -8a5 5 0 0 0-3 9c.7.5 1.2 1.3 1.2 2.2h3.6c0-.9.5-1.7 1.2-2.2A5 5 0 0 0 0 -8z"/>`,binary_sensor:h`<circle cx="0" cy="0" r="2"/><path d="M-4.5 -4.5a6.4 6.4 0 0 0 0 9M4.5 -4.5a6.4 6.4 0 0 1 0 9"/>`};function _o(e){let t=0,s=0,i=0;for(let a=0;a<e.length;a++){const n=e[a],o=e[(a+1)%e.length],l=n.x*o.y-o.x*n.y;t+=l,s+=(n.x+o.x)*l,i+=(n.y+o.y)*l}if(Math.abs(t)<1e-12){const a=e.length||1;return{x:e.reduce((n,o)=>n+o.x,0)/a,y:e.reduce((n,o)=>n+o.y,0)/a}}return{x:s/(3*t),y:i/(3*t)}}let T=class extends x{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.plan=null,this.markers=[],this.selectedId=null,this.selectedIds=[],this.dimEntities=!1,this.alwaysLabel=!1,this.imageUrl=null,this.editable=!1,this.placing=!1,this.coneRadius=140,this.zones=[],this.selectedZoneId=null,this.zoneLabels=!0,this.draftPoints=[],this.boxSelect=!1,this.box=null,this.boxStart=null,this.scale=1,this.tx=0,this.ty=0,this.hoverId=null,this.dragging=null,this.orienting=null,this.shaping=null,this.zoneDraft=null,this.lastVertexPress=null,this.pointers=new Map,this.lastPan=null,this.lastPinchDist=0,this.dragMoved=!1,this.fitted=!1,this.minScale=ui,this.onWheel=e=>{e.preventDefault();const t=this.getBoundingClientRect();this.zoomBy(e.deltaY<0?1.15:1/1.15,e.clientX-t.left,e.clientY-t.top)},this.onMarkerPointerDown=(e,t)=>{if(!this.editable||t.button!==0)return;t.stopPropagation(),t.preventDefault(),this.dragging={id:e.id,x:e.x,y:e.y},this.viewport.setPointerCapture(t.pointerId);const s=a=>{const n=this.getBoundingClientRect(),o=this.toPlan(a.clientX-n.left,a.clientY-n.top);this.dragging={id:e.id,x:o.x,y:o.y}},i=a=>{this.viewport.removeEventListener("pointermove",s),this.viewport.removeEventListener("pointerup",i),this.viewport.removeEventListener("pointercancel",i);const n=this.getBoundingClientRect(),o=this.toPlan(a.clientX-n.left,a.clientY-n.top),l=Math.abs(o.x-e.x)>5e-4||Math.abs(o.y-e.y)>5e-4;this.dragging=null,l?this.dispatchEvent(new CustomEvent("marker-move",{detail:{id:e.id,x:o.x,y:o.y},bubbles:!0,composed:!0})):this.select(e,a),this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0)};this.viewport.addEventListener("pointermove",s),this.viewport.addEventListener("pointerup",i),this.viewport.addEventListener("pointercancel",i)},this.onPointerDown=e=>{if(this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.dragMoved=!1,this.pointers.size===1){if(this.boxSelect&&e.button===0&&!e.shiftKey&&!this.editable&&!this.placing){const t=this.getBoundingClientRect();this.boxStart={x:e.clientX-t.left,y:e.clientY-t.top},this.lastPan=null;return}this.lastPan={x:e.clientX,y:e.clientY},this.viewport.classList.add("dragging")}else this.pointers.size===2&&(this.lastPinchDist=this.pinchDistance(),this.lastPan=null,this.boxStart=null,this.box=null)},this.onPointerMove=e=>{if(this.pointers.has(e.pointerId)){if(this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.pointers.size===2){const t=this.pinchDistance();if(this.lastPinchDist>0){const[s,i]=[...this.pointers.values()],a=this.getBoundingClientRect();this.zoomBy(t/this.lastPinchDist,(s.x+i.x)/2-a.left,(s.y+i.y)/2-a.top)}this.lastPinchDist=t,this.dragMoved=!0;return}if(this.boxStart){const t=this.getBoundingClientRect(),s=e.clientX-t.left,i=e.clientY-t.top;!this.dragMoved&&Math.abs(s-this.boxStart.x)+Math.abs(i-this.boxStart.y)>3&&(this.dragMoved=!0,this.viewport.hasPointerCapture(e.pointerId)||this.viewport.setPointerCapture(e.pointerId)),this.dragMoved&&(this.box={x0:Math.min(this.boxStart.x,s),y0:Math.min(this.boxStart.y,i),x1:Math.max(this.boxStart.x,s),y1:Math.max(this.boxStart.y,i)});return}if(this.lastPan){const t=e.clientX-this.lastPan.x,s=e.clientY-this.lastPan.y;!this.dragMoved&&Math.abs(t)+Math.abs(s)>2&&(this.dragMoved=!0,this.viewport.hasPointerCapture(e.pointerId)||this.viewport.setPointerCapture(e.pointerId)),this.tx+=t,this.ty+=s,this.lastPan={x:e.clientX,y:e.clientY}}}},this.onPointerUp=e=>{if(this.pointers.delete(e.pointerId),this.boxStart&&this.pointers.size===0){const t=this.box;if(this.boxStart=null,this.box=null,t&&t.x1-t.x0>=4&&t.y1-t.y0>=4){const s=this.markers.filter(i=>{const a=this.toScreen(i.x,i.y);return a.x>=t.x0&&a.x<=t.x1&&a.y>=t.y0&&a.y<=t.y1}).map(i=>i.id);this.dispatchEvent(new CustomEvent("box-select",{detail:{ids:s},bubbles:!0,composed:!0}))}}if(this.pointers.size===0)this.lastPan=null,this.viewport.classList.remove("dragging");else if(this.pointers.size===1){const[t]=[...this.pointers.values()];this.lastPan={x:t.x,y:t.y}}},this.onBackgroundClick=e=>{if(!this.dragMoved){if(this.placing){const t=this.getBoundingClientRect(),s=this.toPlan(e.clientX-t.left,e.clientY-t.top);this.dispatchEvent(new CustomEvent("plan-click",{detail:{x:+s.x.toFixed(4),y:+s.y.toFixed(4)},bubbles:!0,composed:!0}));return}this.dispatchEvent(new CustomEvent("marker-select",{detail:{id:null},bubbles:!0,composed:!0}))}},this.onHandlePointerDown=(e,t,s)=>{if(!this.editable||s.button!==0)return;s.stopPropagation(),s.preventDefault();const i=this.getBoundingClientRect(),a=e.rotation??0,n=e.fov??90,o=t==="left"?a+n/2:a-n/2;this.orienting={id:e.id,rotation:a,fov:n},this.viewport.setPointerCapture(s.pointerId);const l=u=>{const v=this.bearingTo(e,u.clientX-i.left,u.clientY-i.top);if(t==="dir")return{rotation:Math.round(v),fov:n};let $=t==="left"?o-v:v-o;$=($%360+360)%360;const _=Math.max(10,Math.min(180,Math.round($))),N=t==="left"?o-_/2:o+_/2;return{rotation:Math.round((N%360+360)%360),fov:_}},p=u=>{this.orienting={id:e.id,...l(u)}},f=u=>{this.viewport.removeEventListener("pointermove",p),this.viewport.removeEventListener("pointerup",f),this.viewport.removeEventListener("pointercancel",f);const v=l(u);this.orienting=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),(v.rotation!==a||v.fov!==n)&&this.dispatchEvent(new CustomEvent("marker-orient",{detail:{id:e.id,...v},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",p),this.viewport.addEventListener("pointerup",f),this.viewport.addEventListener("pointercancel",f)},this.onRangePointerDown=(e,t)=>{if(!this.editable||t.button!==0)return;t.stopPropagation(),t.preventDefault();const s=this.getBoundingClientRect(),i=e.radius??this.coneRadius/this.planWidth;this.shaping={id:e.id,radius:i},this.viewport.setPointerCapture(t.pointerId);const a=l=>{const p=this.toScreen(e.x,e.y),f=Math.hypot(l.clientX-s.left-p.x,l.clientY-s.top-p.y)/this.scale;return+Math.max(.02,Math.min(1,f/this.planWidth)).toFixed(4)},n=l=>this.shaping={id:e.id,radius:a(l)},o=l=>{this.viewport.removeEventListener("pointermove",n),this.viewport.removeEventListener("pointerup",o),this.viewport.removeEventListener("pointercancel",o);const p=a(l);this.shaping=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),p!==i&&this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:e.id,radius:p},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",n),this.viewport.addEventListener("pointerup",o),this.viewport.addEventListener("pointercancel",o)},this.onCoverageVertexDown=(e,t,s)=>{if(!this.editable||s.button!==0||!e.polygon)return;s.stopPropagation(),s.preventDefault();const i=Date.now();if(this.lastVertexPress&&this.lastVertexPress.id===e.id&&this.lastVertexPress.index===t&&i-this.lastVertexPress.at<450){this.lastVertexPress=null,this.editPolygon(e,{remove:t});return}this.lastVertexPress={id:e.id,index:t,at:i};const a=this.getBoundingClientRect(),n=e.polygon.map(u=>({...u}));this.shaping={id:e.id,polygon:n},this.viewport.setPointerCapture(s.pointerId);let o=!1;const l=u=>{const v=this.toPlan(u.clientX-a.left,u.clientY-a.top),$=n.map(_=>({..._}));return $[t]={x:+Math.max(0,Math.min(1,v.x)).toFixed(4),y:+Math.max(0,Math.min(1,v.y)).toFixed(4)},$},p=u=>{o=!0,this.shaping={id:e.id,polygon:l(u)}},f=u=>{this.viewport.removeEventListener("pointermove",p),this.viewport.removeEventListener("pointerup",f),this.viewport.removeEventListener("pointercancel",f);const v=l(u);this.shaping=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),o&&this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:e.id,polygon:v},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",p),this.viewport.addEventListener("pointerup",f),this.viewport.addEventListener("pointercancel",f)}}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.fitted||this.fit()}),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect()}updated(e){(e.has("planWidth")||e.has("planHeight"))&&(this.fitted=!1,this.fit()),(e.has("scale")||e.has("tx")||e.has("ty"))&&this.dispatchEvent(new CustomEvent("view-change",{bubbles:!0,composed:!0}))}get zoom(){return this.scale}focusMarker(e){const t=this.renderRoot.querySelector(`g.marker[data-id="${CSS.escape(e)}"]`);return t?.focus(),!!t}toScreen(e,t){return{x:this.tx+e*this.planWidth*this.scale,y:this.ty+t*this.planHeight*this.scale}}fit(){const e=this.clientWidth,t=this.clientHeight;if(!e||!t||!this.planWidth||!this.planHeight)return;const s=24,i=Math.min((e-s*2)/this.planWidth,(t-s*2)/this.planHeight);this.minScale=Math.min(ui,i),this.scale=Math.max(this.minScale,Math.min(mi,i)),this.tx=(e-this.planWidth*this.scale)/2,this.ty=(t-this.planHeight*this.scale)/2,this.fitted=!0}centerOn(e,t){const s=this.clientWidth,i=this.clientHeight;!s||!i||(this.tx=s/2-e*this.planWidth*this.scale,this.ty=i/2-t*this.planHeight*this.scale,this.fitted=!0)}zoomToBox(e,t,s,i,a=48,n=0){const o=this.clientWidth,l=this.clientHeight;if(!o||!l||!this.planWidth||!this.planHeight)return;const p=Math.max(1e-6,s-e)*this.planWidth,f=Math.max(1e-6,i-t)*this.planHeight,u=Math.min((o-48)/this.planWidth,(l-48)/this.planHeight),v=n>0?Math.min(2.5,Math.max(u*n,u)):2.5,$=Math.max(ui,Math.min(mi,Math.min((o-a*2)/p,(l-a*2)/f,v)));this.scale=$,this.tx=o/2-(e+s)/2*this.planWidth*$,this.ty=l/2-(t+i)/2*this.planHeight*$,this.fitted=!0}zoomBy(e,t,s){const i=this.clientWidth,a=this.clientHeight,n=t??i/2,o=s??a/2,l=Math.max(this.minScale,Math.min(mi,this.scale*e)),p=l/this.scale;this.tx=n-(n-this.tx)*p,this.ty=o-(o-this.ty)*p,this.scale=l,this.fitted=!0}toPlan(e,t){return{x:Math.min(1,Math.max(0,(e-this.tx)/this.scale/this.planWidth)),y:Math.min(1,Math.max(0,(t-this.ty)/this.scale/this.planHeight))}}pinchDistance(){const[e,t]=[...this.pointers.values()];return Math.hypot(e.x-t.x,e.y-t.y)}select(e,t){if(this.dragMoved)return;t.stopPropagation();const s=this.toScreen(e.x,e.y),i={id:e.id,sx:s.x,sy:s.y};this.dispatchEvent(new CustomEvent("marker-select",{detail:i,bubbles:!0,composed:!0}))}selectZone(e,t){this.dragMoved||this.placing||(t.stopPropagation(),this.dispatchEvent(new CustomEvent("zone-select",{detail:{id:e.id},bubbles:!0,composed:!0})))}onVertexPointerDown(e,t,s,i=!1){if(!this.editable||s.button!==0)return;if(s.stopPropagation(),s.preventDefault(),!i){const f=this.lastVertexPress,u=performance.now();if(f&&f.id===e.id&&f.index===t&&u-f.at<450){this.lastVertexPress=null,this.removeVertex(e,t,s);return}this.lastVertexPress={id:e.id,index:t,at:u}}const a=this.getBoundingClientRect();let n=e.polygon.map(f=>({x:f.x,y:f.y})),o=t;if(i){const f=n[t],u=n[(t+1)%n.length];n.splice(t+1,0,{x:+((f.x+u.x)/2).toFixed(4),y:+((f.y+u.y)/2).toFixed(4)}),o=t+1}this.zoneDraft={id:e.id,polygon:n},this.viewport.setPointerCapture(s.pointerId);const l=f=>{const u=this.toPlan(f.clientX-a.left,f.clientY-a.top);n=n.map((v,$)=>$===o?{x:+u.x.toFixed(4),y:+u.y.toFixed(4)}:v),this.zoneDraft={id:e.id,polygon:n}},p=()=>{this.viewport.removeEventListener("pointermove",l),this.viewport.removeEventListener("pointerup",p),this.viewport.removeEventListener("pointercancel",p);const f=i||n.some((u,v)=>u.x!==e.polygon[v].x||u.y!==e.polygon[v].y);this.zoneDraft=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),f&&this.dispatchEvent(new CustomEvent("zone-edit",{detail:{id:e.id,polygon:n},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",l),this.viewport.addEventListener("pointerup",p),this.viewport.addEventListener("pointercancel",p)}removeVertex(e,t,s){if(s.stopPropagation(),!this.editable||e.polygon.length<=3)return;const i=e.polygon.filter((a,n)=>n!==t);this.dispatchEvent(new CustomEvent("zone-edit",{detail:{id:e.id,polygon:i},bubbles:!0,composed:!0}))}renderZoneHandles(e,t){const s=1/this.scale,i=this.planWidth,a=this.planHeight;return h`<g class="zone-handles">
      ${t.map((n,o)=>{const l=t[(o+1)%t.length];return h`<circle class="vmid" cx=${((n.x+l.x)/2*i).toFixed(1)} cy=${((n.y+l.y)/2*a).toFixed(1)} r=${(4*s).toFixed(2)} stroke-width=${(1.2*s).toFixed(2)} role="button" aria-label="הוסף פינה"
          @pointerdown=${p=>this.onVertexPointerDown(e,o,p,!0)} @click=${p=>p.stopPropagation()} />`})}
      ${t.map((n,o)=>h`<circle class="vtx" data-vertex=${o} cx=${(n.x*i).toFixed(1)} cy=${(n.y*a).toFixed(1)} r=${(6*s).toFixed(2)} stroke-width=${(1.6*s).toFixed(2)} role="slider" aria-label=${`פינה ${o+1}`}
          @pointerdown=${l=>this.onVertexPointerDown(e,o,l)} @click=${l=>l.stopPropagation()} />`)}
    </g>`}renderZone(e){if(e.polygon.length<3)return c;const t=1/this.scale,s=this.zoneDraft?.id===e.id?this.zoneDraft.polygon:e.polygon,i=s.map($=>`${($.x*this.planWidth).toFixed(1)},${($.y*this.planHeight).toFixed(1)}`).join(" "),a=_o(s),n=this.selectedZoneId===e.id,o=Math.max(36,e.name.length*7+18),l=s.map($=>$.x),p=s.map($=>$.y),f=(Math.max(...l)-Math.min(...l))*this.planWidth*this.scale,u=(Math.max(...p)-Math.min(...p))*this.planHeight*this.scale,v=n||e.candidate||f>=o+12&&u>=30;return h`
      <g class="zone ${n?"selected":""} ${e.candidate?"candidate":""}" style="--zc:${e.color}" role="button" tabindex="0" aria-label=${e.name} aria-pressed=${n}
         data-zone=${e.id}
         @click=${$=>this.selectZone(e,$)} @keydown=${$=>($.key==="Enter"||$.key===" ")&&this.selectZone(e,$)}>
        <polygon points=${i} stroke-width=${((n?2.2:1.4)*t).toFixed(2)} />
        ${this.zoneLabels&&e.name&&v?h`<g transform="translate(${this.zoneLabelPoint(e,s,a).x.toFixed(1)} ${this.zoneLabelPoint(e,s,a).y.toFixed(1)}) scale(${t})">
              <rect class="zl-bg" x=${-o/2} y="-10" width=${o} height="20" rx="10" />
              <text class="zl" y="3.5">${e.name}</text>
            </g>`:c}
        ${this.editable&&n&&!e.candidate?this.renderZoneHandles(e,s):c}
      </g>`}zoneLabelPoint(e,t,s){const i=1/this.scale,a=t.map(l=>l.x*this.planWidth),n=t.map(l=>l.y*this.planHeight),o=Math.max(36,e.name.length*7+18)*i;switch(e.labelPos){case"top":return{x:s.x*this.planWidth,y:Math.min(...n)-14*i};case"bottom":return{x:s.x*this.planWidth,y:Math.max(...n)+14*i};case"left":return{x:Math.min(...a)-o/2-6*i,y:s.y*this.planHeight};case"right":return{x:Math.max(...a)+o/2+6*i,y:s.y*this.planHeight};default:return{x:s.x*this.planWidth,y:s.y*this.planHeight}}}static labelOffset(e,t,s){switch(e){case"top":return{x:0,y:-(t+14)};case"left":return{x:-(t+8+s/2),y:0};case"right":return{x:t+8+s/2,y:0};default:return{x:0,y:t+14}}}renderDraft(){const e=this.draftPoints;if(!e.length)return c;const t=1/this.scale,s=e.map(a=>({x:a.x*this.planWidth,y:a.y*this.planHeight})),i=s.map(a=>`${a.x.toFixed(1)},${a.y.toFixed(1)}`).join(" ");return h`<g class="draft" pointer-events="none">
      ${s.length>=3?h`<polygon points=${i} stroke-width=${(1.5*t).toFixed(2)} />`:h`<polyline points=${i} stroke-width=${(1.5*t).toFixed(2)} />`}
      ${s.map((a,n)=>h`<circle cx=${a.x.toFixed(1)} cy=${a.y.toFixed(1)} r=${((n===0?5.5:3.5)*t).toFixed(2)} stroke-width=${(1.5*t).toFixed(2)} />`)}
    </g>`}bearingTo(e,t,s){const i=this.toScreen(e.x,e.y);return((Math.atan2(s-i.y,t-i.x)*180/Math.PI+90)%360+360)%360}radiusOf(e){const t=this.shaping?.id===e.id&&this.shaping.radius!==void 0?this.shaping.radius:e.radius;return t?Math.max(12,t*this.planWidth):this.coneRadius}editPolygon(e,t){if(!e.polygon)return;let s=e.polygon.map(i=>({...i}));if("remove"in t){if(s.length<=3)return;s=s.filter((i,a)=>a!==t.remove)}else{const i=s[t.insertAfter],a=s[(t.insertAfter+1)%s.length];if(s.length>=40)return;s.splice(t.insertAfter+1,0,{x:+((i.x+a.x)/2).toFixed(4),y:+((i.y+a.y)/2).toFixed(4)})}this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:e.id,polygon:s},bubbles:!0,composed:!0}))}polygonPath(e){const t=this.shaping?.id===e.id&&this.shaping.polygon?this.shaping.polygon:e.polygon;return!t||t.length<3?null:t.map(s=>`${((s.x-e.x)*this.planWidth).toFixed(1)},${((s.y-e.y)*this.planHeight).toFixed(1)}`).join(" ")}renderPolygonHandles(e){const t=this.shaping?.id===e.id&&this.shaping.polygon?this.shaping.polygon:e.polygon;if(!t)return c;const s=1/this.scale,i=a=>({x:(a.x-e.x)*this.planWidth,y:(a.y-e.y)*this.planHeight});return h`
      ${t.map((a,n)=>{const o=i(a),l=i(t[(n+1)%t.length]);return h`
          <circle class="handle mid" cx=${((o.x+l.x)/2).toFixed(1)} cy=${((o.y+l.y)/2).toFixed(1)} r=${(4.5*s).toFixed(1)} data-cov-mid=${n} role="button" aria-label="הוסף נקודה"
            @pointerdown=${p=>{p.stopPropagation(),p.preventDefault()}} @click=${p=>{p.stopPropagation(),this.editPolygon(e,{insertAfter:n})}} />
          <circle class="handle" cx=${o.x.toFixed(1)} cy=${o.y.toFixed(1)} r=${(6.5*s).toFixed(1)} data-cov-vertex=${n} role="slider" aria-label="נקודת כיסוי"
            @pointerdown=${p=>this.onCoverageVertexDown(e,n,p)} @dblclick=${p=>{p.stopPropagation(),this.editPolygon(e,{remove:n})}} />`})}
    `}renderHandles(e,t,s){const i=this.radiusOf(e),a=1/this.scale,n=(u,v)=>({x:Math.cos(T.rad(u))*v,y:Math.sin(T.rad(u))*v}),o=n(t-s/2,i),l=n(t+s/2,i),p=n(t,i*.72),f=7*a;return h`
      <line class="handle-line" x1="0" y1="0" x2=${p.x.toFixed(1)} y2=${p.y.toFixed(1)} />
      <rect class="handle" x=${(o.x-f).toFixed(1)} y=${(o.y-f).toFixed(1)} width=${(f*2).toFixed(1)} height=${(f*2).toFixed(1)} rx=${(1.5*a).toFixed(1)} role="slider" aria-label="קצה שדה ראייה" @pointerdown=${u=>this.onHandlePointerDown(e,"left",u)} @click=${u=>u.stopPropagation()} />
      <rect class="handle" x=${(l.x-f).toFixed(1)} y=${(l.y-f).toFixed(1)} width=${(f*2).toFixed(1)} height=${(f*2).toFixed(1)} rx=${(1.5*a).toFixed(1)} role="slider" aria-label="קצה שדה ראייה" @pointerdown=${u=>this.onHandlePointerDown(e,"right",u)} @click=${u=>u.stopPropagation()} />
      <circle class="handle" cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r=${(8*a).toFixed(1)} role="slider" aria-label="כיוון מבט" @pointerdown=${u=>this.onHandlePointerDown(e,"dir",u)} @click=${u=>u.stopPropagation()} />
      <circle class="handle range" cx=${n(t,i).x.toFixed(1)} cy=${n(t,i).y.toFixed(1)} r=${(6.5*a).toFixed(1)} role="slider" aria-label="טווח כיסוי" data-cov-range @pointerdown=${u=>this.onRangePointerDown(e,u)} />
    `}static rad(e){return(e-90)*Math.PI/180}fovPath(e,t,s){const i=T.rad(e-t/2),a=T.rad(e+t/2),n=Math.cos(i)*s,o=Math.sin(i)*s,l=Math.cos(a)*s,p=Math.sin(a)*s;return`M0 0 L${n.toFixed(1)} ${o.toFixed(1)} A${s} ${s} 0 ${t>180?1:0} 1 ${l.toFixed(1)} ${p.toFixed(1)} Z`}renderMarker(e){const t=this.dragging?.id===e.id?this.dragging:e,s=this.orienting?.id===e.id?this.orienting:null,i=s?s.rotation:e.rotation??0,a=s?s.fov:e.fov,n=t.x*this.planWidth,o=t.y*this.planHeight,l=1/this.scale,p=e.kind==="camera",f=ya[e.state]??ya.neutral,u=this.selectedId===e.id||this.selectedIds.includes(e.id),v=this.alwaysLabel||u||this.hoverId===e.id,$=Math.max(44,e.label.length*6.5+16),_=this.dimEntities&&!p,N=p?13:11;return h`
      <g class="marker ${e.state} ${u?"selected":""} ${_?"dimmed":""} ${this.editable?"editable":""}"
         transform="translate(${n} ${o})" data-id=${e.id}
         tabindex="0" role="button" aria-label=${e.label} aria-pressed=${u}
         @mouseenter=${()=>this.hoverId=e.id} @mouseleave=${()=>this.hoverId=null}
         @pointerdown=${X=>this.onMarkerPointerDown(e,X)}
         @click=${X=>this.editable?X.stopPropagation():this.select(e,X)}
         @keydown=${X=>(X.key==="Enter"||X.key===" ")&&this.select(e,X)}>
        ${p&&a&&e.state!=="forbidden"?(()=>{const X=this.polygonPath(e);return X?h`<polygon class="fov ${e.state==="offline"?"off":""}" data-cov-polygon points=${X} />`:h`<path class="fov ${e.state==="offline"?"off":""}" d=${this.fovPath(i,a,this.radiusOf(e))} />`})():c}
        ${p&&a&&this.editable&&u&&!this.dragging?this.polygonPath(e)?this.renderPolygonHandles(e):this.renderHandles(e,i,a):c}
        <g transform="scale(${l})">
          <circle class="halo" r=${N+9} />
          <circle class="pin" r=${N} fill=${f} />
          <g class="icon" transform="scale(${p?.85:.75})">${ko[e.kind]}</g>
          ${e.state==="offline"?h`<line x1="-9" y1="-9" x2="9" y2="9" stroke="#fff" stroke-width="2.5" />`:c}
          ${e.state==="forbidden"?h`<g transform="translate(8 -8)"><circle r="6.5" fill="#fff" /><g fill="none" stroke="var(--sw-forbidden)" stroke-width="1.5" transform="scale(0.45)"><rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/></g></g>`:c}
          ${v?h`<g transform="translate(${T.labelOffset(e.labelPos,N,$).x.toFixed(1)} ${T.labelOffset(e.labelPos,N,$).y.toFixed(1)})" data-label-pos=${e.labelPos??"auto"}>
                <rect class="lbl-bg" x=${-$/2} y="-10" width=${$} height="20" rx="6" />
                <text class="lbl" y="3.5">${e.label}</text>
              </g>`:c}
        </g>
      </g>
    `}render(){return r`
      <div class="viewport ${this.placing?"placing":""} ${this.boxSelect?"boxing":""}" @wheel=${this.onWheel} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
           @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp} @click=${this.onBackgroundClick}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl?h`<image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />`:c}
            ${this.plan??c}
            ${this.zones.map(e=>this.renderZone(e))}
            ${this.markers.map(e=>this.renderMarker(e))}
            ${this.renderDraft()}
          </g>
          ${this.box?h`<rect class="box" data-box x=${this.box.x0.toFixed(1)} y=${this.box.y0.toFixed(1)} width=${(this.box.x1-this.box.x0).toFixed(1)} height=${(this.box.y1-this.box.y0).toFixed(1)} />`:c}
        </svg>
      </div>
      <div class="controls" role="group" aria-label="זום">
        <sw-button variant="ghost" size="sm" iconOnly icon="plus" label=${y("floor.zoomIn")} @click=${()=>this.zoomBy(1.25)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="minus" label=${y("floor.zoomOut")} @click=${()=>this.zoomBy(.8)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="fit" label=${y("floor.fit")} @click=${()=>{this.fitted=!1,this.fit()}}></sw-button>
      </div>
      <div class="scale" aria-live="polite">${Math.round(this.scale*100)}%</div>
    `}};T.styles=z`
    :host {
      display: block;
      position: relative;
      direction: ltr;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 320px;
      background: var(--sw-map-bg);
      overflow: hidden;
      touch-action: none;
      user-select: none;
      border-radius: inherit;
    }
    .viewport {
      position: absolute;
      inset: 0;
      cursor: grab;
    }
    .viewport.dragging {
      cursor: grabbing;
    }
    .viewport.boxing {
      cursor: crosshair;
    }
    rect.box {
      fill: color-mix(in srgb, var(--sw-accent) 14%, transparent);
      stroke: var(--sw-accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }
    .viewport.placing {
      cursor: crosshair;
    }
    .handle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      stroke-width: 1.6;
      cursor: grab;
    }
    .handle:active {
      cursor: grabbing;
    }
    .handle.mid {
      fill: var(--sw-accent);
      stroke: var(--sw-surface);
      opacity: 0.8;
      cursor: copy;
    }
    .handle.range {
      fill: var(--sw-accent);
      stroke: #fff;
      cursor: ns-resize;
    }
    .handle-line {
      stroke: var(--sw-accent);
      stroke-width: 1;
      stroke-dasharray: 3 3;
      opacity: 0.7;
      pointer-events: none;
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
      display: block;
    }
    .marker {
      cursor: pointer;
      outline: none;
    }
    .marker.editable {
      cursor: grab;
    }
    .marker.editable:active {
      cursor: grabbing;
    }
    .marker .halo {
      fill: var(--sw-accent);
      opacity: 0;
      pointer-events: none; /* an invisible halo must never steal clicks from a neighbouring pin */
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .marker.selected .halo,
    .marker:focus-visible .halo,
    .marker:hover .halo {
      opacity: 0.18;
    }
    .marker .pin {
      stroke: #fff;
      stroke-width: 2.5;
      filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.28));
    }
    .marker.neutral .pin {
      stroke: var(--sw-border-strong);
      stroke-width: 1.5;
    }
    .marker .icon {
      fill: none;
      stroke: #fff;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .marker.neutral .icon {
      stroke: var(--sw-text);
    }
    .marker.stale .pin,
    .marker.partial .pin,
    .marker.unknown .pin {
      stroke-dasharray: 3 2;
    }
    .marker.dimmed {
      opacity: 0.55;
    }
    .marker .lbl-bg {
      fill: var(--sw-surface);
      filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.18));
      pointer-events: none;
    }
    .marker .lbl {
      pointer-events: none;
      font-family: var(--sw-font);
      font-size: 11px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .zone {
      cursor: pointer;
      outline: none;
    }
    .zone polygon {
      fill: var(--zc);
      fill-opacity: 0.1;
      stroke: var(--zc);
      stroke-opacity: 0.7;
      stroke-linejoin: round;
      transition: fill-opacity var(--sw-t-fast) var(--sw-ease);
    }
    .zone:hover polygon,
    .zone:focus-visible polygon,
    .zone.selected polygon {
      fill-opacity: 0.22;
      stroke-opacity: 1;
    }
    .zone.candidate polygon {
      stroke-dasharray: 6 4;
      fill-opacity: 0.14;
    }
    .zone .zl-bg {
      fill: rgba(255, 255, 255, 0.92);
      stroke: var(--zc);
      stroke-opacity: 0.55;
      stroke-width: 1;
      pointer-events: none;
    }
    .zone .zl {
      pointer-events: none;
      font-family: var(--sw-font);
      font-size: 11.5px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .vtx {
      fill: var(--sw-surface);
      stroke: var(--zc);
      cursor: grab;
    }
    .vtx:active {
      cursor: grabbing;
    }
    .vmid {
      fill: var(--zc);
      fill-opacity: 0.55;
      stroke: var(--sw-surface);
      cursor: copy;
    }
    .draft polyline,
    .draft polygon {
      fill: var(--sw-accent);
      fill-opacity: 0.12;
      stroke: var(--sw-accent);
      stroke-dasharray: 5 4;
      stroke-linejoin: round;
    }
    .draft polyline {
      fill: none;
    }
    .draft circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .fov {
      fill: var(--sw-fov);
      stroke: var(--sw-accent);
      stroke-opacity: 0.25;
      stroke-width: 1;
    }
    .fov.off {
      fill: rgba(154, 163, 181, 0.14);
      stroke: var(--sw-offline);
    }
    .controls {
      position: absolute;
      left: var(--sw-s-3);
      bottom: var(--sw-s-3);
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      box-shadow: var(--sw-shadow-2);
      padding: 3px;
      z-index: var(--sw-z-map-ui);
    }
    .scale {
      position: absolute;
      left: 56px;
      bottom: var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      z-index: var(--sw-z-map-ui);
      font-family: var(--sw-font-mono);
      box-shadow: var(--sw-shadow-1);
    }
  `;W([m({type:Number})],T.prototype,"planWidth",2);W([m({type:Number})],T.prototype,"planHeight",2);W([m({attribute:!1})],T.prototype,"plan",2);W([m({attribute:!1})],T.prototype,"markers",2);W([m()],T.prototype,"selectedId",2);W([m({attribute:!1})],T.prototype,"selectedIds",2);W([m({type:Boolean})],T.prototype,"dimEntities",2);W([m({type:Boolean})],T.prototype,"alwaysLabel",2);W([m()],T.prototype,"imageUrl",2);W([m({type:Boolean})],T.prototype,"editable",2);W([m({type:Boolean})],T.prototype,"placing",2);W([m({type:Number})],T.prototype,"coneRadius",2);W([m({attribute:!1})],T.prototype,"zones",2);W([m()],T.prototype,"selectedZoneId",2);W([m({type:Boolean})],T.prototype,"zoneLabels",2);W([m({attribute:!1})],T.prototype,"draftPoints",2);W([m({type:Boolean})],T.prototype,"boxSelect",2);W([d()],T.prototype,"box",2);W([d()],T.prototype,"scale",2);W([d()],T.prototype,"tx",2);W([d()],T.prototype,"ty",2);W([d()],T.prototype,"hoverId",2);W([d()],T.prototype,"dragging",2);W([d()],T.prototype,"orienting",2);W([d()],T.prototype,"shaping",2);W([d()],T.prototype,"zoneDraft",2);W([es(".viewport")],T.prototype,"viewport",2);T=W([S("sw-plan-canvas")],T);const $a={name:"אתר הדגמה",building:"מבנה א"},wt=[{id:"f0",name:"קומה 0",hasPlan:!0,planWidth:1200,planHeight:800,cameraCount:6,entityCount:4},{id:"f-1",name:"קומה 1-",hasPlan:!0,planWidth:900,planHeight:1100,cameraCount:3,entityCount:1},{id:"f-2",name:"קומה 2-",hasPlan:!1,planWidth:0,planHeight:0,cameraCount:2,entityCount:0}],cs=[{id:"cam-1",name:"כניסה ראשית",floorId:"f0",x:.09,y:.52,rotation:20,fov:70,state:"live",source:"NVR ערוץ 1"},{id:"cam-2",name:"לובי",floorId:"f0",x:.34,y:.3,rotation:120,fov:80,state:"live",source:"NVR ערוץ 2"},{id:"cam-3",name:"מסדרון מזרחי",floorId:"f0",x:.62,y:.55,rotation:180,fov:60,state:"offline",source:"NVR ערוץ 3"},{id:"cam-4",name:"אולם",floorId:"f0",x:.82,y:.22,rotation:210,fov:90,state:"live",source:"NVR ערוץ 4"},{id:"cam-5",name:"חדר מדרגות",floorId:"f0",x:.9,y:.8,rotation:250,fov:60,state:"stale",source:"NVR ערוץ 5"},{id:"cam-6",name:"חניה",floorId:"f0",x:.4,y:.86,rotation:300,fov:75,state:"forbidden",source:"NVR ערוץ 6"},{id:"cam-7",name:"מחסן",floorId:"f-1",x:.3,y:.3,rotation:45,fov:70,state:"live",source:"NVR ערוץ 7"},{id:"cam-8",name:"חדר מכונות",floorId:"f-1",x:.7,y:.6,rotation:200,fov:70,state:"live",source:"NVR ערוץ 8"},{id:"cam-9",name:"מקלט",floorId:"f-1",x:.5,y:.85,rotation:270,fov:70,state:"offline",source:"NVR ערוץ 9"}],Vs=[{id:"lock.main_door",name:"דלת כניסה",floorId:"f0",x:.05,y:.4,domain:"lock",state:"locked",stateLabelKey:"entity.locked",controllable:!1,lastChanged:"לפני 12 דק׳"},{id:"light.lobby",name:"תאורת לובי",floorId:"f0",x:.3,y:.42,domain:"light",state:"on",stateLabelKey:"entity.on",controllable:!0,lastChanged:"לפני שעה"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",floorId:"f0",x:.7,y:.3,domain:"binary_sensor",state:"off",stateLabelKey:"entity.off",controllable:!1,lastChanged:"לפני 3 דק׳"},{id:"light.corridor",name:"תאורת מסדרון",floorId:"f0",x:.55,y:.66,domain:"light",state:"off",stateLabelKey:"entity.off",controllable:!0,lastChanged:"אתמול 22:10"},{id:"lock.shelter",name:"דלת מקלט",floorId:"f-1",x:.46,y:.9,domain:"lock",state:"locked",stateLabelKey:"entity.locked",controllable:!1,lastChanged:"לפני 2 שעות"}],fr={f0:[{x:40,y:40,w:300,h:260,label:"לובי",kind:"lobby"},{x:40,y:340,w:300,h:220,label:"משרדים",kind:"office"},{x:40,y:600,w:460,h:160,label:"חניה מקורה",kind:"parking"},{x:380,y:40,w:420,h:300,label:"אולם",kind:"hall"},{x:840,y:40,w:320,h:300,label:"אולם ב",kind:"meeting"},{x:380,y:380,w:300,h:180,label:"חדר ישיבות",kind:"meeting"},{x:720,y:380,w:440,h:180,label:"מסדרון מזרחי",kind:"corridor"},{x:540,y:600,w:620,h:160,label:"שירותים ומדרגות",kind:"stairs"}],"f-1":[{x:40,y:40,w:400,h:400,label:"מחסן",kind:"storage"},{x:480,y:40,w:380,h:400,label:"חדר מכונות",kind:"machines"},{x:40,y:480,w:820,h:200,label:"מסדרון",kind:"corridor"},{x:40,y:720,w:820,h:340,label:"מקלט",kind:"shelter"}]};function Ei(e){const t=fr[e],s=wt.find(i=>i.id===e);return!t||!s?.hasPlan?[]:t.map(i=>({x:i.x/s.planWidth,y:i.y/s.planHeight,w:i.w/s.planWidth,h:i.h/s.planHeight}))}const oe="var(--sw-map-furniture)",Q="var(--sw-map-furniture-line)";function zo(e){const t=e.x+e.w/2,s=e.y+e.h/2;switch(e.kind){case"lobby":return h`<rect x=${e.x+30} y=${e.y+e.h-70} width="130" height="30" rx="4" fill=${oe} stroke=${Q} /><rect x=${e.x+170} y=${e.y+30} width="110" height="36" rx="10" fill=${oe} stroke=${Q} /><circle cx=${e.x+22} cy=${e.y+22} r="10" fill="#dfe9d9" stroke="#b9cfae" /><circle cx=${e.x+e.w-22} cy=${e.y+22} r="10" fill="#dfe9d9" stroke="#b9cfae" />`;case"office":return h`${[0,1].map(i=>[0,1,2].map(a=>h`<rect x=${e.x+30+a*92} y=${e.y+36+i*92} width="56" height="28" rx="2" fill=${oe} stroke=${Q} /><circle cx=${e.x+58+a*92} cy=${e.y+78+i*92} r="8" fill=${oe} stroke=${Q} />`))}`;case"parking":return h`${[0,1,2,3,4,5,6,7].map(i=>h`<line x1=${e.x+30+i*56} y1=${e.y+20} x2=${e.x+30+i*56} y2=${e.y+e.h-20} stroke=${Q} stroke-dasharray="6 6" />`)}${[1,3,4].map(i=>h`<rect x=${e.x+42+i*56} y=${e.y+36} width="30" height="70" rx="8" fill="#d5dce8" stroke=${Q} />`)}`;case"hall":return h`${[0,1,2,3].map(i=>[0,1,2,3,4,5].map(a=>h`<rect x=${e.x+50+a*56} y=${e.y+60+i*52} width="26" height="16" rx="3" fill=${oe} stroke=${Q} />`))}<rect x=${e.x+40} y=${e.y+20} width=${e.w-80} height="14" rx="2" fill=${oe} stroke=${Q} />`;case"meeting":return h`<rect x=${t-80} y=${s-26} width="160" height="52" rx="12" fill=${oe} stroke=${Q} />${[0,1,2].map(i=>h`<circle cx=${t-50+i*50} cy=${s-44} r="9" fill=${oe} stroke=${Q} /><circle cx=${t-50+i*50} cy=${s+44} r="9" fill=${oe} stroke=${Q} />`)}`;case"corridor":return h`<rect x=${e.x+30} y=${s-8} width="90" height="16" rx="3" fill=${oe} stroke=${Q} />`;case"stairs":return h`<rect x=${e.x+e.w-130} y=${e.y+30} width="100" height="100" fill=${oe} stroke=${Q} />${[1,2,3,4,5,6,7].map(i=>h`<line x1=${e.x+e.w-130} y1=${e.y+30+i*12.5} x2=${e.x+e.w-30} y2=${e.y+30+i*12.5} stroke=${Q} />`)}${[0,1,2,3].map(i=>h`<rect x=${e.x+30+i*46} y=${e.y+30} width="36" height="46" fill=${oe} stroke=${Q} />`)}`;case"storage":return h`${[0,1,2,3].map(i=>h`<rect x=${e.x+40+i*92} y=${e.y+40} width="30" height=${e.h-80} fill=${oe} stroke=${Q} />`)}`;case"machines":return h`${[0,1,2].map(i=>h`<rect x=${e.x+40} y=${e.y+40+i*120} width="110" height="72" rx="4" fill=${oe} stroke=${Q} /><circle cx=${e.x+240} cy=${e.y+76+i*120} r="26" fill=${oe} stroke=${Q} />`)}`;case"shelter":return h`${[0,1,2,3].map(i=>h`<rect x=${e.x+60} y=${e.y+50+i*70} width="220" height="22" rx="3" fill=${oe} stroke=${Q} /><rect x=${e.x+e.w-280} y=${e.y+50+i*70} width="220" height="22" rx="3" fill=${oe} stroke=${Q} />`)}`;default:return""}}function wr(e){const t=fr[e],s=wt.find(i=>i.id===e);return!t||!s?null:h`
    <rect x="0" y="0" width=${s.planWidth} height=${s.planHeight} fill="var(--sw-map-bg)" />
    <rect x="20" y="20" width=${s.planWidth-40} height=${s.planHeight-40} fill="none" stroke="var(--sw-map-wall)" stroke-width="3" />
    ${t.map(i=>h`
        <rect x=${i.x} y=${i.y} width=${i.w} height=${i.h} fill="var(--sw-map-room-fill)" stroke="var(--sw-map-wall)" stroke-width="1.6" />
        ${zo(i)}
        <text x=${i.x+14} y=${i.y+26} text-anchor="start" font-size="15" font-weight="500" fill="var(--sw-map-label)" font-family="var(--sw-font)" direction="rtl" style="unicode-bidi: plaintext">${i.label}</text>
      `)}
  `}const Pi=[{id:"site-a",name:"אתר הדגמה",address:"רחוב הדוגמה 1",buildings:2,cameras:10,online:9,alerts:2,health:"stale"},{id:"site-b",name:"סניף צפון",address:"שדרות הדגמה 20",buildings:1,cameras:6,online:6,alerts:0,health:"live"},{id:"site-c",name:"מחסן לוגיסטי",address:"אזור תעשייה",buildings:1,cameras:4,online:3,alerts:1,health:"offline"}],So=[{id:"bld-a",siteId:"site-a",name:"מבנה א",floors:[{id:"f0",name:"קומה 0",cameras:6,entities:4,hasPlan:!0},{id:"f-1",name:"קומה 1-",cameras:3,entities:1,hasPlan:!0},{id:"f-2",name:"קומה 2-",cameras:2,entities:0,hasPlan:!1}]},{id:"bld-b",siteId:"site-a",name:"מבנה ב",floors:[{id:"b-f0",name:"קרקע",cameras:1,entities:2,hasPlan:!1}]}],G=[{id:"cam-1",name:"כניסה ראשית",floor:"קומה 0",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 2 דק׳",recording:"continuous",ptz:!1,audio:!1},{id:"cam-2",name:"לובי",floor:"קומה 0",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 5 דק׳",recording:"motion",ptz:!1,audio:!0},{id:"cam-3",name:"מסדרון מזרחי",floor:"קומה 0",state:"offline",stream:"sub",fps:null,bitrateKbps:null,firmware:"V5.8.10",lastEvent:"לפני שעה",recording:"unknown",ptz:!1,audio:!1},{id:"cam-4",name:"אולם",floor:"קומה 0",state:"live",stream:"main",fps:25,bitrateKbps:5120,firmware:"V5.8.10",lastEvent:"לפני 12 דק׳",recording:"continuous",ptz:!0,audio:!1},{id:"cam-5",name:"חדר מדרגות",floor:"קומה 0",state:"stale",stream:"sub",fps:20,bitrateKbps:2048,firmware:"V5.8.9",lastEvent:"לפני 40 דק׳",recording:"continuous",ptz:!1,audio:!1},{id:"cam-6",name:"חניה מקורה",floor:"קומה 0",state:"forbidden",stream:"sub",fps:null,bitrateKbps:null,firmware:"—",lastEvent:"—",recording:"unknown",ptz:!1,audio:!1},{id:"cam-7",name:"מחסן",floor:"קומה 1-",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 3 שעות",recording:"motion",ptz:!1,audio:!1},{id:"cam-8",name:"חדר מכונות",floor:"קומה 1-",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"אתמול",recording:"continuous",ptz:!1,audio:!1},{id:"cam-9",name:"מקלט",floor:"קומה 1-",state:"offline",stream:"sub",fps:null,bitrateKbps:null,firmware:"V5.8.10",lastEvent:"לפני יומיים",recording:"unknown",ptz:!1,audio:!1},{id:"cam-10",name:"חצר אחורית",floor:"חוץ",state:"live",stream:"sub",fps:25,bitrateKbps:4096,firmware:"V5.8.10",lastEvent:"לפני 8 דק׳",recording:"continuous",ptz:!0,audio:!0}],Ke={"cam-1":"entrance","cam-2":"lobby","cam-3":"corridor","cam-4":"hall","cam-5":"corridor","cam-6":"parking","cam-7":"warehouse","cam-8":"warehouse","cam-9":"night","cam-10":"backyard"},Ii={person:"זיהוי אדם",vehicle:"זיהוי רכב",motion:"תנועה",line:"חציית קו",offline:"מצלמה מנותקת",door:"דלת נפתחה"},et=[{id:"ev-1",time:"היום 10:14",minuteOfDay:614,type:"person",title:"אדם זוהה",camera:"כניסה ראשית",floor:"קומה 0",source:"NVR",acked:!1,severity:"alert"},{id:"ev-2",time:"היום 09:42",minuteOfDay:582,type:"vehicle",title:"רכב זוהה",camera:"חצר אחורית",floor:"חוץ",source:"NVR",acked:!1,severity:"info"},{id:"ev-3",time:"היום 08:31",minuteOfDay:511,type:"motion",title:"תנועה",camera:"מחסן",floor:"קומה 1-",source:"NVR",acked:!0,severity:"info"},{id:"ev-4",time:"היום 08:12",minuteOfDay:492,type:"door",title:"דלת כניסה נפתחה",camera:"כניסה ראשית",floor:"קומה 0",source:"HA",acked:!0,severity:"info"},{id:"ev-5",time:"היום 07:55",minuteOfDay:475,type:"offline",title:"מסדרון מזרחי מנותק",camera:"מסדרון מזרחי",floor:"קומה 0",source:"NVR",acked:!1,severity:"critical"},{id:"ev-6",time:"היום 06:43",minuteOfDay:403,type:"line",title:"חציית קו",camera:"חניה מקורה",floor:"קומה 0",source:"NVR",acked:!0,severity:"alert"},{id:"ev-7",time:"אתמול 23:10",minuteOfDay:1390,type:"person",title:"אדם זוהה",camera:"לובי",floor:"קומה 0",source:"NVR",acked:!0,severity:"info"}],qs=[{startMin:0,endMin:190,kind:"continuous"},{startMin:205,endMin:460,kind:"continuous"},{startMin:470,endMin:474,kind:"motion"},{startMin:480,endMin:486,kind:"motion"},{startMin:492,endMin:640,kind:"continuous"},{startMin:660,endMin:1439,kind:"continuous"}],Ci=[{id:"u-1",name:"יוני",haUser:"joni",active:!0,lastSync:"לפני 20 שנ׳",groups:["מנהלי מערכת"],bindings:[{role:"מנהל מערכת VMS",scope:"כל ההתקנה"}],haAdmin:!0},{id:"u-2",name:"דנה",haUser:"dana",active:!0,lastSync:"לפני 20 שנ׳",groups:["עורכי קומה 2"],bindings:[{role:"עורך מפות",scope:"מבנה א · קומה 2"}],haAdmin:!1},{id:"u-3",name:"יוסי",haUser:"yossi",active:!0,lastSync:"לפני 20 שנ׳",groups:["מנהלי מבנה א"],bindings:[{role:"מנהל אתר/מבנה",scope:"מבנה א"}],haAdmin:!1},{id:"u-4",name:"codex",haUser:"codex",active:!0,lastSync:"לפני 20 שנ׳",groups:[],bindings:[],haAdmin:!1},{id:"u-5",name:"רון",haUser:"ron",active:!1,lastSync:"לפני 3 ימים",groups:["צופים"],bindings:[{role:"צופה",scope:"אתר הדגמה"}],haAdmin:!1}],vr=[{id:"g-1",name:"מנהלי מערכת",members:1,bindings:["מנהל מערכת VMS · כל ההתקנה"]},{id:"g-2",name:"עורכי קומה 2",members:1,bindings:["עורך מפות · מבנה א · קומה 2"]},{id:"g-3",name:"מנהלי מבנה א",members:1,bindings:["מנהל אתר/מבנה · מבנה א"]},{id:"g-4",name:"צופים",members:1,bindings:["צופה · אתר הדגמה"]}],gr=[{id:"viewer",name:"צופה",allowed:"מפה, מצב ישויות מורשה, שידור חי",denied:"היסטוריה, עריכה, ייצוא, שליטה"},{id:"operator",name:"מפעיל",allowed:"צפייה, Playback, סקירת אירועים וסימון טיפול",denied:"עריכת מפות, תפקידים, ייצוא, פעולות פיזיות"},{id:"editor",name:"עורך מפות ותצוגות",allowed:"צפייה, יבוא/עריכה/פרסום מפות, מיקומים ותצוגות",denied:"Playback, ייצוא, משתמשים, סודות, שליטה"},{id:"site_admin",name:"מנהל אתר / מבנה / קומה",allowed:"מפעיל + עורך, הגדרות תוכן מקומיות",denied:"הגדרות מערכת, תפקידים, סודות, כתיבה ל־NVR"},{id:"system_admin",name:"מנהל מערכת VMS",allowed:"הגדרות מוצר, מקורות, מדיניות, קבוצות ושיוכים",denied:"ניהול HA, שליטה פיזית, ייצוא ראיות ללא grant"}],br=[{time:"10:24",user:"יוני",action:"צפייה חיה",resource:"כניסה ראשית",decision:"הותר",role:"מנהל מערכת · כל ההתקנה"},{time:"10:18",user:"דנה",action:"פרסום תוכנית",resource:"מבנה א · קומה 2",decision:"הותר",role:"עורך מפות · קומה 2"},{time:"10:11",user:"דנה",action:"עריכת תוכנית",resource:"מבנה א · קומה 3",decision:"נחסם: מחוץ להיקף",role:"עורך מפות · קומה 2"},{time:"09:55",user:"יוסי",action:"ייצוא קטע",resource:"לובי 09:10–09:20",decision:"נחסם: אין הרשאת ייצוא",role:"מנהל מבנה · מבנה א"},{time:"09:43",user:"codex",action:"כניסה דרך Ingress",resource:"—",decision:"הותר, ללא שיוך",role:"—"},{time:"09:30",user:"יוני",action:"הפעלת תאורה",resource:"light.lobby",decision:"הותר (HA אישר)",role:"מנהל מערכת"},{time:"08:12",user:"מערכת",action:"סנכרון משתמשים",resource:"HA bridge",decision:"5 משתמשים, 0 שינויים",role:"—"}],yr=[{id:"job-1",title:"ייצוא: כניסה ראשית 09:10–09:25",status:"הושלם",progress:100,size:"182 MB",hash:"sha256 ✓"},{id:"job-2",title:"ייצוא: לובי 23:00–23:40",status:"בתהליך",progress:62,size:"—",hash:"—"},{id:"job-3",title:"תמונות מקדימות: קומה 0",status:"ממתין",progress:0,size:"—",hash:"—"},{id:"job-4",title:"ייצוא: חצר אחורית 02:00–04:00",status:"נכשל: פער בהקלטה",progress:35,size:"—",hash:"—"}],Ti=[{id:"case-1",title:"כניסה לא מורשית — 13.09",status:"פתוח",owner:"יוני",clips:3,notes:2,preserved:2,missing:1},{id:"case-2",title:"נזק לרכב בחניה",status:"בבדיקה",owner:"יוסי",clips:2,notes:1,preserved:2,missing:0},{id:"case-3",title:"דלת מקלט פתוחה בלילה",status:"סגור",owner:"יוני",clips:1,notes:3,preserved:1,missing:0}],Oi=[{id:"r-1",name:"אדם בלילה",trigger:"זיהוי אדם",scope:"חוץ · 22:00–06:00",action:"התראה + פתיחת מצלמות",enabled:!0,last:"אתמול 23:10"},{id:"r-2",name:"רכב באזור מוגבל",trigger:"זיהוי רכב",scope:"חניה מקורה",action:"התראה",enabled:!0,last:"היום 09:42"},{id:"r-3",name:"דלת נשארה פתוחה",trigger:"דלת > 60 שנ׳",scope:"כל הדלתות",action:"התראה + הקלטה",enabled:!0,last:"—"},{id:"r-4",name:"מצלמה מנותקת",trigger:"ניתוק",scope:"כל האתר",action:"התראה מיידית",enabled:!1,last:"היום 07:55"}],$r=[{name:"NVR (הקלטה)",state:"live",detail:"10/10 ערוצים, דיסק תקין"},{name:"go2rtc (מדיה)",state:"live",detail:"גרסה ‎1.9.x‎ · 4 זרמים פעילים"},{name:"גשר Home Assistant",state:"stale",detail:"סנכרון אחרון לפני 4 דק׳"},{name:"מסד נתונים",state:"live",detail:"WAL · גיבוי אחרון אתמול 02:00"},{name:"תור עבודות",state:"partial",detail:"1 בתהליך · 1 נכשל"}],Mo=["live","explore","investigate","system"];function Xt(e=window.location.hash){const t=e.replace(/^#/,"")||"/explore/floors/f0",[s,i=""]=t.split("?"),a=s.startsWith("/")?s:`/${s}`,n=a.split("/").filter(Boolean),o=n[0];return{path:a,segments:n,params:new URLSearchParams(i),mode:o&&Mo.includes(o)?o:null}}function b(e,t){const s=t?`?${new URLSearchParams(t).toString()}`:"";window.location.hash=`#${e}${s}`}function Ao(e){const t=()=>e(Xt());return window.addEventListener("hashchange",t),e(Xt()),()=>window.removeEventListener("hashchange",t)}const Di=new Set;let st={mode:"loading",me:null,error:null};function Os(e){st=e,Di.forEach(t=>t(st))}function xr(e){return Di.add(e),e(st),()=>Di.delete(e)}async function Eo(){try{const e=await k("me");Os({mode:e.has_access?"api":"no_access",me:e,error:null})}catch(e){e instanceof be&&e.status===401?Os({mode:"unauthenticated",me:null,error:e.body.user_message}):e instanceof be?Os({mode:"demo",me:null,error:e.body.user_message}):Os({mode:"demo",me:null,error:null})}return st}const g=()=>st.mode==="api";function Po(e){const t=wt.find(i=>i.id===e)??wt[0],s=cs.filter(i=>i.floorId===t.id);return{source:"demo",floorId:t.id,floorName:t.name,buildingName:$a.building,siteName:$a.name,width:t.planWidth||1200,height:t.planHeight||800,imageUrl:null,planSvg:t.hasPlan?wr(t.id):null,planStatus:t.hasPlan?"published":"none",planVersionId:t.hasPlan?`demo-${t.id}`:null,needsAlignment:!1,renderMode:"source",stylizedAvailable:!1,planPublishedAt:null,planArchivedAt:null,at:null,history:null,historyFrom:null,haHistory:null,anchors:s.map((i,a)=>({id:`demo-anchor-${i.id}`,floor_id:t.id,plan_version_id:`demo-${t.id}`,resource_type:"camera",resource_id:i.id,position:{x:i.x,y:i.y},rotation_degrees:i.rotation,field_of_view_degrees:i.fov,coverage_radius:null,coverage_polygon:null,layer_id:"cameras",label:i.name,revision:1,effective_from:"",effective_to:null,updated_at:"",camera:{id:i.id,recorder_id:"demo",channel:a+1,name:i.name,name_source:i.name,alias:null,enabled:!0,sort_order:a,main_track:null,sub_track:null,status:i.state==="offline"?"offline":"online",last_seen_at:null}})),zones:[],cameras:[],permissions:{edit:!0,publish:!0,import:!0}}}async function ks(e,t=!1,s){if(!g())return Po(e);const i=new URLSearchParams;t&&i.set("draft","true"),s&&i.set("at",s);const a=i.toString(),n=await k(`floors/${e}/map${a?`?${a}`:""}`);return{source:"api",floorId:n.floor.id,floorName:n.floor.name,buildingName:n.building.name,siteName:n.site.name,width:n.plan?.width_px??1200,height:n.plan?.height_px??800,imageUrl:n.plan?tt(n.plan.image_url):null,planSvg:null,planStatus:n.plan?n.plan.status==="published"?"published":"draft":"none",planVersionId:n.plan?.id??null,needsAlignment:n.needs_alignment,anchors:n.anchors,zones:n.zones??[],cameras:n.cameras,permissions:n.permissions,renderMode:n.plan?.render_mode==="stylized"?"stylized":"source",stylizedAvailable:!!n.plan?.stylized_url,planPublishedAt:n.plan?.published_at??null,planArchivedAt:n.plan?.archived_at??null,at:n.at??null,history:n.history??null,historyFrom:n.history_from??null,haHistory:n.ha_history??null}}function ps(e,t){const s=e.camera;return s?s.status==="online"?"live":s.status==="offline"?"offline":t??"unknown":t??"unknown"}const Io=e=>k(`floors/${e}/plan-assets`),Co=(e,t)=>{const s=new FormData;return s.append("file",t,t.name),ri(`floors/${e}/plan-assets`,s)},To=e=>k(`floors/${e}/plan-versions`),Oo=(e,t)=>M(`floors/${e}/plan-versions`,t),Ri=e=>M(`plan-versions/${e}/publish`),Do=(e,t)=>k(`plan-versions/${e}/diff`),Ro=(e,t,s)=>M(`plan-versions/${e}/rollback`,{revision:t,expected_published_id:s});function hs(e){return e.resource_type==="camera"?e.camera?.name??e.label??e.resource_id:e.label??e.entity?.name??e.resource_id}const xa=(e,t)=>M(`floors/${e}/anchors`,t),kr=(e,t)=>He(`map-anchors/${e}`,t),No=(e,t)=>M(`floors/${e}/anchors/realign`,{mode:t}),Bo=e=>me(`map-anchors/${e}`),Te=()=>k("cameras"),Lo=()=>M("cameras/sync"),Ho=e=>M("cameras",e),_r=(e,t)=>He(`cameras/${e}`,t),Vo=e=>k(`plan-assets/${e}/dxf`),jo=(e,t)=>Me(`plan-assets/${e}/dxf`,t);function Fo(){return{source:"demo",sites:Pi.map((t,s)=>({id:t.id,name:t.name,address:t.address,timezone:"Asia/Jerusalem",sort_order:s,updated_at:"",buildings:So.filter(i=>i.siteId===t.id).map((i,a)=>({id:i.id,site_id:t.id,name:i.name,sort_order:a,updated_at:"",floors:i.floors.map((n,o)=>{const l=wt.find(p=>p.id===n.id);return{id:n.id,building_id:i.id,name:n.name,level:-o,sort_order:o,ha_area_id:null,has_plan:n.hasPlan,published_version_id:n.hasPlan?`demo-${n.id}`:null,plan_width_px:l?.planWidth??null,plan_height_px:l?.planHeight??null,draft_version_id:null,anchor_count:n.cameras+n.entities,camera_count:n.cameras,updated_at:""}})}))})),canCreateSite:!0}}async function yt(){if(!g())return Fo();const e=await k("sites?tree=true");return{source:"api",sites:e.sites,canCreateSite:e.can_create_site}}const Wo=e=>M("sites",e),Uo=(e,t)=>He(`sites/${e}`,t),Zo=e=>me(`sites/${e}`),zr=(e,t)=>M(`sites/${e}/buildings`,t),qo=(e,t)=>He(`buildings/${e}`,t),Ko=e=>me(`buildings/${e}`),Go=(e,t)=>M(`buildings/${e}/floors`,t),Yo=(e,t)=>He(`floors/${e}`,t),Jo=(e,t=!1)=>me(`floors/${e}${t?"?force=true":""}`);function Xo(e,t,s){const i=new FormData;return i.append("file",s,s.name),ri(`${e}s/${t}/image`,i)}const Qo=(e,t)=>Rt(`${e}s/${t}/image`,{method:"DELETE"}),ka=e=>he(e.replace(/^api\/v1\//,""));function Sr(e,t){for(const s of e.sites)for(const i of s.buildings??[]){const a=(i.floors??[]).find(n=>n.id===t);if(a)return{site:s,building:i,floor:a}}return null}function Mr(e){for(const t of e.sites)for(const s of t.buildings??[])for(const i of s.floors??[])return i;return null}function Ct(e){return String(e??"").replace(/(^|[^\w])(-\d)/g,"$1‎$2")}function el(e){return e==null?"":`‎${e}`}const Ni=[{id:"room",label:"חדר"},{id:"zone",label:"אזור"},{id:"corridor",label:"מסדרון"},{id:"outdoor",label:"חוץ"},{id:"service",label:"שירות / טכני"}],tl=e=>Ni.find(t=>t.id===e)?.label??e,sl=e=>k(`floors/${e}/zones`),il=(e,t)=>M(`floors/${e}/zones`,t),al=(e,t)=>He(`zones/${e}`,t),rl=e=>me(`zones/${e}`),nl=(e,t="medium")=>M(`floors/${e}/zones/detect`,{strength:t}),ol=(e,t,s)=>M(`floors/${e}/zones/accept`,{candidates:t,replace_auto:s});function us(e,t){let s=!1;for(let i=0,a=t.length-1;i<t.length;a=i++){const n=t[i],o=t[a];n.y>e.y!=o.y>e.y&&e.x<(o.x-n.x)*(e.y-n.y)/(o.y-n.y)+n.x&&(s=!s)}return s}const Ar=()=>k("views"),Er=e=>M("views",e),ll=(e,t)=>Me(`views/${e}`,t),dl=e=>me(`views/${e}`),Pr=e=>`#/live/wall?cameras=${encodeURIComponent(e.cameras.join(","))}`,cl=e=>`#/kiosk/all?cameras=${encodeURIComponent(e.cameras.join(","))}&cols=${e.cols}&rows=${e.rows}`;var pl=Object.defineProperty,hl=Object.getOwnPropertyDescriptor,Ps=(e,t,s,i)=>{for(var a=i>1?void 0:i?hl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&pl(t,s,a),a};let Tt=class extends x{constructor(){super(...arguments),this.checked=!1,this.disabled=!1,this.label="",this.labelHidden=!1}flip(){this.disabled||(this.checked=!this.checked,this.dispatchEvent(new CustomEvent("change",{detail:{checked:this.checked},bubbles:!0,composed:!0})))}render(){return r`<button type="button" role="switch" aria-checked=${this.checked} aria-label=${this.label} ?disabled=${this.disabled} @click=${this.flip}></button>${this.label&&!this.labelHidden?r`<span>${this.label}</span>`:""}`}};Tt.styles=z`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    button {
      inline-size: 42px;
      block-size: 24px;
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-border-strong);
      position: relative;
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease);
      padding: 0;
    }
    button::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 18px;
      block-size: 18px;
      border-radius: 50%;
      background: #fff;
      box-shadow: var(--sw-shadow-1);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    :host([checked]) button {
      background: var(--sw-accent);
    }
    :host([checked]) button::after {
      transform: translateX(-18px);
    }
    :host-context([dir='ltr'][checked]) button::after {
      transform: translateX(18px);
    }
    :host([disabled]) button {
      opacity: 0.5;
      cursor: not-allowed;
    }
    span {
      font-size: var(--sw-fs-sm);
    }
  `;Ps([m({type:Boolean,reflect:!0})],Tt.prototype,"checked",2);Ps([m({type:Boolean,reflect:!0})],Tt.prototype,"disabled",2);Ps([m()],Tt.prototype,"label",2);Ps([m({type:Boolean})],Tt.prototype,"labelHidden",2);Tt=Ps([S("sw-toggle")],Tt);function Ir(e={}){const t=new URLSearchParams;e.domain&&t.set("domain",e.domain),e.q&&t.set("q",e.q),e.area&&t.set("area",e.area),e.placed!==void 0&&t.set("placed",String(e.placed)),e.includeDisabled&&t.set("include_disabled","true"),e.limit&&t.set("limit",String(e.limit));const s=t.toString();return k(`ha/entities${s?`?${s}`:""}`)}const ul=()=>k("ha/status"),ml=(e=!1)=>k(`ha/bridge/pairing${e?"?regenerate=true":""}`),_a=e=>k(`ha/actions/${e}`),fl=()=>M("ha/bridge/install");function wl(e,t,s={},i=!1){const a={allowed_action_id:t,arguments:s,expected_state_version:null,confirmation_grant:i?"confirmed":null,client_request_id:crypto.randomUUID(),expires_at:new Date(Date.now()+6e4).toISOString().replace(/\.\d{3}Z$/,"Z")};return M(`ha/entities/${encodeURIComponent(e)}/actions`,a)}async function vl(e,t,s){let i=await _a(e);t(i);for(let a=0;a<16&&i.status==="pending";a++)await new Promise(n=>setTimeout(n,1500)),i=await _a(e),t(i);return i}const gl={ha_unauthorized:"Home Assistant דחה את הפעולה: למשתמש שלך אין הרשאה לישות זו ב־Home Assistant",ha_unknown_user:"Home Assistant אינו מכיר את המשתמש שמאחורי ההפעלה הזו",bridge_not_paired:"גשר SMPLWISE אינו מצומד",bridge_error:"הגשר החזיר שגיאה",ha_unavailable:"Home Assistant אינו זמין",service_not_allowed:"הגשר סירב: השירות אינו ברשימת הפעולות המאושרות (גשר ישן? מאז 0.2.1 נוספו climate / media / number / select / alarm — הפעל את Home Assistant מחדש כדי לטעון את הגרסה החדשה)",unknown_user:"Home Assistant אינו מכיר את המשתמש"},bl={pending:"נשלח · ממתין לעדכון מ־Home Assistant",confirmed:"אושר · המצב התעדכן",unknown:"לא ידוע · לא התקבל עדכון מצב",failed:"נכשל",denied:"נדחה · אין הרשאה ב־Home Assistant"},yl=new Set(["on","open","opening","unlocked","unlocking","playing","home","heat","cool","heat_cool","dry","fan_only","cleaning","active","detected","problem","running"]),Ds={on:"דולק",off:"כבוי",locked:"נעול",unlocked:"פתוח",locking:"נועל…",unlocking:"פותח…",jammed:"תקוע",open:"פתוח",closed:"סגור",opening:"נפתח…",closing:"נסגר…",unavailable:"לא זמין",unknown:"לא ידוע",idle:"לא פעיל",home:"בבית",not_home:"מחוץ לבית",playing:"מנגן",paused:"מושהה",standby:"המתנה",heat:"חימום",cool:"קירור",auto:"אוטומטי",dry:"ייבוש",fan_only:"מאוורר",docked:"בתחנה",cleaning:"מנקה",returning:"חוזר"},$l={motion:["תנועה","ללא תנועה"],occupancy:["נוכחות","ללא נוכחות"],presence:["נוכח","לא נוכח"],door:["פתוחה","סגורה"],window:["פתוח","סגור"],opening:["פתוח","סגור"],garage_door:["פתוח","סגור"],lock:["פתוח","נעול"],connectivity:["מחובר","מנותק"],power:["פועל","כבוי"],problem:["תקלה","תקין"],safety:["לא בטוח","בטוח"],smoke:["עשן","ללא עשן"],moisture:["רטוב","יבש"],battery:["סוללה חלשה","סוללה תקינה"],running:["פועל","לא פועל"],sound:["רעש","שקט"],vibration:["רטט","ללא רטט"],update:["עדכון זמין","מעודכן"]};function vt(e){const t=e.state;if(t==null)return"לא ידוע";if(t==="unavailable"||t==="unknown")return Ds[t];if(e.domain==="binary_sensor"){const s=$l[e.device_class??""];return s?t==="on"?s[0]:s[1]:t==="on"?"פעיל":"לא פעיל"}if(e.domain==="sensor"||e.domain==="number"||e.domain==="input_number"){const s=Number(t);return!Number.isNaN(s)&&t.trim()!==""?`${Number.isInteger(s)?s:s.toFixed(Math.min(2,(t.split(".")[1]??"").length))}${e.unit?` ${e.unit}`:""}`:t}return e.domain==="light"&&t==="on"&&typeof e.attributes.brightness=="number"?`דולק · ${Math.round(e.attributes.brightness/255*100)}%`:e.domain==="cover"&&typeof e.attributes.current_position=="number"&&(t==="open"||t==="closed")?`${Ds[t]} · ${e.attributes.current_position}%`:e.domain==="climate"&&typeof e.attributes.current_temperature=="number"?`${Ds[t]??t} · ${e.attributes.current_temperature}°`:Ds[t]??t}function Bi(e){return!e||e.removed_at?"unknown":e.state==="unavailable"||!e.available?"offline":e.fresh?e.state===null||e.state==="unknown"?"unknown":yl.has(e.state)?"live":"neutral":"stale"}function oi(e,t){return e==="doors"||t==="lock"||t==="cover"?"lock":e==="lights"||t==="light"||t==="switch"||t==="fan"?"light":"binary_sensor"}function _s(e){return{light:"תאורה",switch:"מתג",lock:"מנעול",cover:"תריס / שער",binary_sensor:"חיישן בינארי",sensor:"חיישן",fan:"מאוורר",climate:"אקלים",camera:"מצלמת HA",button:"כפתור",script:"סקריפט",scene:"סצנה",automation:"אוטומציה",media_player:"נגן",event:"אירוע",number:"מספר",select:"בחירה",input_boolean:"דגל",alarm_control_panel:"אזעקה",siren:"צופר",vacuum:"שואב",weather:"מזג אוויר",sun:"שמש"}[e]??e}function Re(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString("he-IL",{dateStyle:"short",timeStyle:"medium"})}function Cr(e,t){let s=null,i=!1,a=2e3;const n=(()=>{const l=new URL(he("ha/ws"));return l.protocol=l.protocol==="https:"?"wss:":"ws:",l.toString()})(),o=()=>{if(!i){try{s=new WebSocket(n)}catch{return}s.onopen=()=>{a=2e3},s.onmessage=l=>{try{const p=JSON.parse(l.data);p.type==="entity_state_changed"?e({type:"entity_state_changed",entity:p.payload.entity}):p.type==="ha_sync_state"?e({type:"ha_sync_state",connected:!!p.payload.connected}):p.type==="heartbeat"&&e({type:"heartbeat",sync:p.payload.sync})}catch{}},s.onclose=l=>{!i&&l.code!==4403&&l.code!==4401&&(window.setTimeout(o,a),a=Math.min(3e4,a*2))}}};return o(),()=>{i=!0,s?.close()}}var xl=Object.defineProperty,kl=Object.getOwnPropertyDescriptor,H=(e,t,s,i)=>{for(var a=i>1?void 0:i?kl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&xl(t,s,a),a};const _l={off:"כבוי",heat:"חימום",cool:"קירור",heat_cool:"חימום/קירור",auto:"אוטומטי",dry:"ייבוש",fan_only:"מאוורר בלבד"},zl=[{id:"cameras",icon:"camera",label:()=>y("floor.cameras")},{id:"doors",icon:"door",label:()=>y("floor.doors")},{id:"lights",icon:"light",label:()=>y("floor.lights")},{id:"sensors",icon:"sensor",label:()=>y("floor.sensors")},{id:"zones",icon:"map",label:()=>"חדרים ואזורים"}],za=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"];function Sl(e){const t=e.match(/-?\d+/);return t?t[0]:/קרקע/.test(e)?"ק":/גג/.test(e)?"גג":/מרתף/.test(e)?"מ":(e.split(/[\s–-]+/).filter(Boolean).pop()??e).slice(0,4)}let R=class extends x{constructor(){super(...arguments),this.floorId="f0",this.screenState="ready",this.focusZone="",this.focusCamera="",this.focusEntity="",this.selectedZoneId=null,this.bundle=null,this.tree=null,this.loadError="",this.noFloors=!1,this.selectedId=null,this.anchor=null,this.layers=new Set(["cameras","doors","lights","sensors","zones"]),this.pinned=!1,this.panel=!1,this.multi=!1,this.sideList=(()=>{try{return localStorage.getItem("sw.map.sidelist")==="1"}catch{return!1}})(),this.jumpZoom=(()=>{try{return localStorage.getItem("sw.map.jumpzoom")==="1"}catch{return!1}})(),this.focusZoom=!0,this.saveView=null,this.savedView=null,this.picked=[],this.narrow=!1,this.syncConnected=!0,this.action=null,this.confirmSpec=null,this.stopWs=null,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.narrow=this.mq.matches,this.onKey=e=>{if(e.key==="Escape"&&!this.confirmSpec)if(this.selectedId){const t=this.selectedId;this.close(),this.canvas?.focusMarker(t)}else this.panel&&(this.panel=!1)},this.actionArgs={},this.renaming=null,this.notice=""}connectedCallback(){super.connectedCallback(),this.narrow=this.mq.matches,this.mq.addEventListener("change",this.onMq),window.addEventListener("keydown",this.onKey),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),this.mq.removeEventListener("change",this.onMq),this.stopWs?.(),this.stopWs=null}startWs(){this.stopWs||!g()||(this.stopWs=Cr(e=>{const t=this.bundle;if(e.type==="entity_state_changed"&&t){if(!t.anchors.some(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entity.entity_id))return;this.bundle={...t,anchors:t.anchors.map(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entity.entity_id?{...s,entity:{...s.entity??{},...e.entity,actions:s.entity?.actions}}:s)}}else e.type==="ha_sync_state"?this.syncConnected=e.connected:e.type==="heartbeat"&&(this.syncConnected=e.sync.connected)}))}updated(e){e.has("floorId")&&e.get("floorId")!==void 0?(this.selectedId=null,this.anchor=null,this.selectedZoneId=null,this.load()):(e.has("focusZone")||e.has("focusCamera")||e.has("focusEntity"))&&this.bundle&&this.applyFocus()}async applyFocus(){const e=this.bundle;if(!e||!this.focusZone&&!this.focusCamera&&!this.focusEntity)return;await this.updateComplete;const t=this.canvas;if(!t)return;const s=this.focusZone?e.zones.find(a=>a.id===this.focusZone):null;if(s){const a=s.polygon.map(o=>o.x),n=s.polygon.map(o=>o.y);this.selectedZoneId=s.id,t.zoomToBox(Math.min(...a),Math.min(...n),Math.max(...a),Math.max(...n))}const i=this.focusCamera?e.anchors.find(a=>a.resource_type==="camera"&&a.resource_id===this.focusCamera):this.focusEntity?e.anchors.find(a=>a.resource_type==="ha_entity"&&a.resource_id===this.focusEntity):null;if(i){this.focusZoom?t.zoomToBox(i.position.x-.15,i.position.y-.15,i.position.x+.15,i.position.y+.15,48,2.2):t.centerOn(i.position.x,i.position.y),await this.updateComplete;const a=t.toScreen(i.position.x,i.position.y);this.selectedId=i.id,this.anchor={x:a.x,y:a.y}}}async load(){this.loadError="";try{const e=this.tree??await yt();if(this.tree=e,g()&&!Sr(e,this.floorId)){const t=Mr(e);if(t&&t.id!==this.floorId){b(`/explore/floors/${t.id}`);return}if(!t){this.noFloors=!0,this.bundle=null;return}}this.noFloors=!1,this.restoreLayers(),this.bundle=await ks(this.floorId),this.bundle.source==="api"&&this.startWs(),this.applyFocus()}catch(e){this.loadError=w(e),this.bundle=null}}get buildingFloors(){if(this.tree?.source!=="api")return[];for(const e of this.tree.sites)for(const t of e.buildings??[]){const s=t.floors??[];if(!s.some(a=>a.id===this.floorId))continue;const i=s.map(a=>Sl(a.name));return s.map((a,n)=>({id:a.id,name:a.name,hasPlan:a.has_plan,short:i.filter(o=>o===i[n]).length>1?`${i[n]}${n+1}`:i[n]}))}return[]}get floors(){return this.tree?.source==="api"?this.tree.sites.flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(s=>({id:s.id,name:`${t.name} · ${s.name}`,cameraCount:s.camera_count,hasPlan:s.has_plan})))):wt.map(e=>({id:e.id,name:e.name,cameraCount:e.cameraCount,hasPlan:e.hasPlan}))}get markers(){const e=this.bundle;if(!e)return[];const t=this.screenState==="stale";if(e.source==="demo"){const s=this.layers.has("cameras")?cs.filter(a=>a.floorId===e.floorId).map(a=>({id:a.id,kind:"camera",label:a.name,x:a.x,y:a.y,rotation:a.rotation,fov:a.fov,state:a.state})):[],i=Vs.filter(a=>a.floorId===e.floorId).filter(a=>a.domain==="lock"&&this.layers.has("doors")||a.domain==="light"&&this.layers.has("lights")||a.domain==="binary_sensor"&&this.layers.has("sensors")).map(a=>({id:a.id,kind:a.domain,label:a.name,x:a.x,y:a.y,state:t?"stale":"neutral"}));return[...s,...i]}return e.anchors.filter(s=>s.resource_type==="camera"?this.layers.has("cameras"):this.layers.has(s.layer_id==="doors"?"doors":s.layer_id==="lights"?"lights":"sensors")).map(s=>({id:s.id,kind:s.resource_type==="camera"?"camera":oi(s.layer_id,s.entity?.domain),label:hs(s),x:s.position.x,y:s.position.y,rotation:s.rotation_degrees,fov:s.field_of_view_degrees??void 0,radius:s.coverage_radius??void 0,polygon:s.coverage_polygon?s.coverage_polygon.map(([i,a])=>({x:i,y:a})):void 0,labelPos:s.label_pos??void 0,state:s.resource_type==="camera"?ps(s):t?"stale":this.entityTone(s.entity)}))}layerCounts(){const e=this.bundle,t={cameras:0,doors:0,lights:0,sensors:0,zones:e?.zones.length??0};if(!e)return t;if(e.source==="demo"){t.cameras=cs.filter(s=>s.floorId===e.floorId).length;for(const s of Vs.filter(i=>i.floorId===e.floorId))s.domain==="lock"?t.doors++:s.domain==="light"?t.lights++:t.sensors++;return t}for(const s of e.anchors)s.resource_type==="camera"?t.cameras++:s.layer_id==="doors"?t.doors++:s.layer_id==="lights"?t.lights++:t.sensors++;return t}zoneOf(e){return this.bundle?.zones.find(s=>us(e.position,s.polygon))?.name??null}toggleLayer(e){const t=new Set(this.layers);t.has(e)?t.delete(e):t.add(e),this.setLayers(t)}setLayers(e){this.layers=e;try{localStorage.setItem(`sw.floor.layers.${this.floorId}`,JSON.stringify([...e]))}catch{}}restoreLayers(){try{const e=localStorage.getItem(`sw.floor.layers.${this.floorId}`);if(!e)return;const t=JSON.parse(e);Array.isArray(t)&&(this.layers=new Set(t.filter(s=>["cameras","doors","lights","sensors","zones"].includes(s))))}catch{}}cameraAnchors(){return(this.bundle?.anchors??[]).filter(e=>e.resource_type==="camera"&&this.layers.has("cameras"))}togglePick(e){this.picked=this.picked.includes(e)?this.picked.filter(t=>t!==e):[...this.picked,e]}pickedCameraIds(){const e=new Map((this.bundle?.anchors??[]).map(t=>[t.id,t.resource_id]));return this.picked.map(t=>e.get(t)).filter(t=>!!t)}setMulti(e){this.multi=e,this.picked=[],this.saveView=null,this.savedView=null,e&&this.close()}addPicks(e){const t=new Set(this.cameraAnchors().map(i=>i.id)),s=e.filter(i=>t.has(i)&&!this.picked.includes(i));s.length&&(this.picked=[...this.picked,...s])}pickZone(e){const t=this.bundle?.zones.find(a=>a.id===e);if(!t)return;const s=this.cameraAnchors().filter(a=>us(a.position,t.polygon)).map(a=>a.id);if(!s.length)return;const i=s.every(a=>this.picked.includes(a));this.picked=i?this.picked.filter(a=>!s.includes(a)):[...this.picked,...s.filter(a=>!this.picked.includes(a))]}roomChips(){const e=this.bundle;if(!e)return c;const t=this.cameraAnchors(),s=e.zones.map(i=>({z:i,ids:t.filter(a=>us(a.position,i.polygon)).map(a=>a.id)})).filter(i=>i.ids.length);return s.length?r`<span class="roomchips" data-room-chips>${s.map(i=>r`<sw-chip icon="layers" data-room-chip=${i.z.id} ?selected=${i.ids.every(a=>this.picked.includes(a))} @click=${()=>this.pickZone(i.z.id)}>${i.z.name} (${i.ids.length})</sw-chip>`)}</span>`:c}toggleSideList(){this.sideList=!this.sideList;try{localStorage.setItem("sw.map.sidelist",this.sideList?"1":"0")}catch{}}async jumpTo(e){if(e.resource_type==="camera"?(this.focusCamera=e.resource_id,this.focusEntity=""):(this.focusEntity=e.resource_id,this.focusCamera=""),this.focusZone="",this.multi&&e.resource_type==="camera"){this.togglePick(e.id);return}this.focusZoom=this.jumpZoom,await this.applyFocus(),window.setTimeout(()=>this.focusZoom=!0,900)}setJumpZoom(e){this.jumpZoom=e;try{localStorage.setItem("sw.map.jumpzoom",e?"1":"0")}catch{}}renderSideList(){const e=this.bundle;if(!e||!this.sideList||e.source!=="api")return c;const t=e.anchors.filter(o=>o.resource_type==="camera"),s=e.anchors.filter(o=>o.resource_type==="ha_entity"),i={light:"תאורה",switch:"מפסקים",lock:"מנעולים",binary_sensor:"חיישנים",sensor:"חיישנים",cover:"תריסים",climate:"מיזוג",media_player:"מדיה",alarm_control_panel:"אזעקה"},a=new Map;for(const o of s){const l=o.entity?.domain??o.resource_id.split(".")[0];a.set(l,[...a.get(l)??[],o])}const n=o=>o.camera?o.camera.status==="online"?"#22c55e":o.camera.status==="offline"?"#ef4444":"var(--sw-text-3)":o.entity?.state==="on"||o.entity?.state==="unlocked"||o.entity?.state==="open"?"var(--sw-accent)":"var(--sw-text-3)";return r`<div class="sidelist" data-sidelist>
      <div class="sh"><sw-icon name="list" size=${14}></sw-icon>על התוכנית<span class="grow"></span><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${()=>this.toggleSideList()}></sw-button></div>
      <label class="jz" data-jump-zoom-row><input type="checkbox" data-jump-zoom .checked=${this.jumpZoom} @change=${o=>this.setJumpZoom(o.target.checked)} /> זום בקפיצה לרכיב</label>
      <div class="body">
        <div class="grp">קומות</div>
        ${this.floors.map(o=>r`<button class="it ${o.id===this.floorId?"on":""}" data-side-floor=${o.id} @click=${()=>{o.id!==this.floorId&&b(`/explore/floors/${o.id}`)}}>
          <sw-icon name="building" size=${12}></sw-icon><span class="nm">${Ct(o.name)}</span><span class="st">${o.cameraCount} מצלמות${o.hasPlan?"":" · אין תוכנית"}</span></button>`)}
        <div class="grp">מצלמות (${t.length})</div>
        ${t.map(o=>r`<button class="it ${this.selectedId===o.id||this.picked.includes(o.id)?"on":""}" data-side-camera=${o.resource_id} @click=${()=>this.jumpTo(o)}>
          <span class="dot" style="--dot:${n(o)}"></span><span class="nm">${o.camera?.name??o.label??o.resource_id}</span><span class="st">${o.camera?.status==="online"?"חיה":o.camera?.status==="offline"?"מנותקת":""}</span></button>`)}
        ${[...a.entries()].map(([o,l])=>r`<div class="grp">${i[o]??o} (${l.length})</div>
          ${l.map(p=>r`<button class="it ${this.selectedId===p.id?"on":""}" data-side-entity=${p.resource_id} @click=${()=>this.jumpTo(p)}>
            <span class="dot" style="--dot:${n(p)}"></span><span class="nm">${hs(p)}</span><span class="st">${p.entity?vt(p.entity):""}</span></button>`)}`)}
        ${!t.length&&!s.length?r`<div class="grp">אין פריטים מוצבים על התוכנית הזו.</div>`:c}
      </div>
    </div>`}pickSummary(){const e=this.picked.map(i=>this.bundle?.anchors.find(a=>a.id===i)).filter(i=>!!i),t=e.filter(i=>i.camera?.can_view_live===!1).length,s=e.filter(i=>i.camera?.can_view_live!==!1&&i.camera?.status==="online").length;return{total:e.length,online:s,offline:e.length-s-t,denied:t}}pickDot(e){return!e?.camera||e.camera.can_view_live===!1?"var(--sw-text-3)":e.camera.status==="online"?"#22c55e":"#ef4444"}saveableCameraIds(){const e=new Map((this.bundle?.anchors??[]).map(t=>[t.id,t]));return this.picked.map(t=>e.get(t)).filter(t=>!!t&&t.camera?.can_view_live!==!1).map(t=>t.resource_id).slice(0,16)}openSave(){const e=this.saveableCameraIds().length;if(!e)return;const t=e<=1?1:e<=4?2:e<=9?3:4,s=Math.max(1,Math.min(4,Math.ceil(e/t))),i=this.floors.find(a=>a.id===this.floorId)?.name??this.bundle?.floorName??"מפה";this.savedView=null,this.saveView={name:`${i} · ${e} מצלמות`,cols:t,rows:s,shared:!1,canShare:!1,busy:!1,error:null},Ar().then(a=>{this.saveView&&(this.saveView={...this.saveView,canShare:a.can_share})}).catch(()=>{})}async submitSave(){const e=this.saveView;if(!e||e.busy)return;if(!e.name.trim()){this.saveView={...e,error:"לתצוגה צריך שם."};return}const t=this.saveableCameraIds();if(!t.length){this.saveView={...e,error:"אין בבחירה מצלמה שמותר לך לצפות בה."};return}this.saveView={...e,busy:!0,error:null};try{this.savedView=await Er({name:e.name.trim(),cameras:t,cols:e.cols,rows:e.rows,shared:e.shared,kiosk:!1}),this.saveView=null}catch(s){this.saveView={...e,busy:!1,error:w(s)}}}renderSaveDialog(){const e=this.saveView;if(!e)return c;const t=this.saveableCameraIds(),{denied:s}=this.pickSummary(),i=Math.max(0,this.picked.length-s-16),a=n=>this.saveView={...e,...n};return r`<sw-dialog open heading="שמירה כתצוגה" subheading=${`${t.length} מצלמות מהמפה · התצוגה נפתחת בקיר החי או בקיוסק`} data-save-view-dialog @close=${()=>this.saveView=null}>
      <div class="saveform">
        <sw-field label="שם"><input data-save-view-name .value=${e.name} maxlength="60" @input=${n=>a({name:n.target.value})} @keydown=${n=>n.key==="Enter"&&this.submitSave()} /></sw-field>
        <div class="row">
          <sw-field label="עמודות (קיוסק)"><select data-save-view-cols @change=${n=>a({cols:Number(n.target.value)})}>${[1,2,3,4].map(n=>r`<option value=${n} ?selected=${n===e.cols}>${n}</option>`)}</select></sw-field>
          <sw-field label="שורות (קיוסק)"><select data-save-view-rows @change=${n=>a({rows:Number(n.target.value)})}>${[1,2,3,4].map(n=>r`<option value=${n} ?selected=${n===e.rows}>${n}</option>`)}</select></sw-field>
        </div>
        <sw-toggle ?checked=${e.shared} ?disabled=${!e.canShare} label=${e.canShare?"משותפת לכל המשתמשים":"משותפת (דורש הרשאת ניהול משתמשים)"} data-save-view-shared @change=${n=>a({shared:n.detail.checked})}></sw-toggle>
        ${s?r`<div class="note">${s} מצלמות ללא הרשאת צפייה חיה לא ייכללו בתצוגה.</div>`:c}
        ${i?r`<div class="note">תצוגה מכילה עד 16 מצלמות; ${i} האחרונות שנבחרו לא ייכללו.</div>`:c}
        <div class="note">הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג ${e.cols}×${e.rows} מצלמות בעמוד.</div>
        ${e.error?r`<div class="err" role="alert" data-save-view-error>${e.error}</div>`:c}
      </div>
      <div slot="footer"><sw-button variant="primary" ?disabled=${e.busy} data-save-view-submit @click=${()=>this.submitSave()}>${e.busy?"שומר…":"שמור תצוגה"}</sw-button><sw-button variant="ghost" @click=${()=>this.saveView=null}>${y("actions.cancel")}</sw-button></div>
    </sw-dialog>`}openWall(){const e=this.pickedCameraIds();e.length&&b("/live/wall",{cameras:e.join(",")})}openSync(){const e=this.pickedCameraIds();e.length&&b("/investigate/playback",{camera:e[0],extra:e.slice(1,4).join(",")})}renderPickbar(){const e=this.bundle;if(!e)return c;const t=this.cameraAnchors(),s=f=>e.anchors.find(u=>u.id===f),i=f=>{const u=s(f);return u?.camera?.name??u?.label??u?.resource_id??f},a=this.pickSummary(),n=e.anchors.filter(f=>f.resource_type==="camera").length,o=this.floors.find(f=>f.id===this.floorId)?.cameraCount??n,l=Math.max(0,o-n),p=a.total?`נבחרו ${a.total} · ${a.online} זמינות${a.offline?` · ${a.offline} לא מקוונות`:""}${a.denied?` · ${a.denied} ללא הרשאה`:""}${l?` · ${l} מצלמות של הקומה אינן על המפה`:""}`:`לחץ על מצלמות או גרור מלבן על המפה · לחיצה על חדר בוחרת את מצלמותיו · Shift+גרירה מזיזה את המפה · עד 4 לניגון מסונכרן${l?` · ${l} מצלמות של הקומה אינן על המפה`:""}`;return r`<div class="pickbar" data-pickbar>
      <span class="hint" data-pick-hint>${p}</span>
      ${this.picked.map(f=>{const u=s(f),v=u?.camera?.can_view_live===!1;return r`<sw-chip selected icon="camera" dot=${this.pickDot(u)} title=${v?"אין הרשאת צפייה חיה":u?.camera?.status==="online"?"מקוונת":"לא מקוונת"} data-pick-chip=${v?"denied":u?.camera?.status??"unknown"} @click=${()=>this.togglePick(f)}>${i(f)}</sw-chip>`})}
      <sw-chip data-pick-all @click=${()=>this.picked=t.map(f=>f.id)}>בחר הכל (${t.length})</sw-chip>
      ${this.roomChips()}
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="live" ?disabled=${!this.picked.length} data-pick-wall @click=${()=>this.openWall()}>קיר חי (${this.picked.length})</sw-button>
      <sw-button size="sm" icon="history" ?disabled=${!this.picked.length||this.picked.length>4} data-pick-sync @click=${()=>this.openSync()}>ניגון מסונכרן</sw-button>
      <sw-button size="sm" icon="layers" ?disabled=${!this.saveableCameraIds().length} data-pick-save @click=${()=>this.openSave()}>שמור כתצוגה</sw-button>
      <sw-button variant="ghost" size="sm" @click=${()=>this.picked=[]}>נקה</sw-button>
      <sw-button variant="ghost" size="sm" icon="close" @click=${()=>this.setMulti(!1)}>סיום</sw-button>
      ${this.savedView?r`<span class="saved" data-view-saved>התצוגה „${this.savedView.name}” נשמרה (${this.savedView.cameras.length} מצלמות) · <a href="#/live/views" data-view-saved-open>תצוגות שמורות</a> · <a href=${Pr(this.savedView)}>פתח בקיר</a></span>`:c}
    </div>`}onSelect(e){if(this.multi){const t=e.detail.id?this.bundle?.anchors.find(s=>s.id===e.detail.id):null;t?.resource_type==="camera"&&this.togglePick(t.id);return}this.selectedZoneId=null,this.selectedId=e.detail.id,this.anchor=e.detail.id&&e.detail.sx!==void 0&&e.detail.sy!==void 0?{x:e.detail.sx,y:e.detail.sy}:null}onViewChange(){if(!this.selectedId||!this.canvas)return;const e=this.markers.find(s=>s.id===this.selectedId);if(!e)return;const t=this.canvas.toScreen(e.x,e.y);this.anchor={x:t.x,y:t.y}}close(){this.selectedId=null,this.anchor=null}entityTone(e){return e?Bi({...e,fresh:e.fresh&&this.syncConnected}):"unknown"}argDefault(e,t){const s=e.attributes;return t.name==="hvac_mode"?String(s.hvac_mode??e.state??t.choices?.[0]??""):t.name==="temperature"?String(s.temperature??21):t.name==="volume_level"?String(Math.round((s.volume_level??.5)*100)):t.name==="value"?String(e.state??s.min??0):t.name==="option"?String(e.state??s.options?.[0]??""):t.name==="brightness_pct"?String(typeof s.brightness=="number"?Math.round(s.brightness/255*100):100):t.name==="percentage"?String(s.percentage??100):String(t.choices?.[0]??t.min??"")}argsFor(e,t){const s={};for(const i of t.argument_specs??[]){const a=this.actionArgs[`${t.id}:${i.name}`]??this.argDefault(e,i);if(i.type==="int"||i.type==="float"){const n=Number(a);if(!Number.isFinite(n))continue;s[i.name]=i.name==="volume_level"?Math.min(1,Math.max(0,n/100)):n}else s[i.name]=a}return s}argChoices(e,t){const s=e.attributes;return t.name==="hvac_mode"&&Array.isArray(s.hvac_modes)?s.hvac_modes.filter(i=>t.choices?.includes(i)):t.name==="option"&&Array.isArray(s.options)?s.options:t.choices??[]}renderArg(e,t,s){const i=`${t.id}:${s.name}`,a=this.actionArgs[i]??this.argDefault(e,s),n=p=>this.actionArgs={...this.actionArgs,[i]:p},o=e.attributes,l=this.argChoices(e,s);if(l.length)return r`<select class="arg" data-action-arg=${i} aria-label=${s.name} @change=${p=>n(p.target.value)}>${l.map(p=>r`<option value=${p} ?selected=${p===a}>${_l[p]??p}</option>`)}</select>`;if(s.type==="int"||s.type==="float"){const p=s.name==="volume_level"?0:s.name==="value"?o.min??s.min:s.name==="temperature"?o.min_temp??s.min:s.min,f=s.name==="volume_level"?100:s.name==="value"?o.max??s.max:s.name==="temperature"?o.max_temp??s.max:s.max,u=s.name==="value"?o.step??1:s.name==="temperature"?.5:1,v=s.name==="volume_level"||s.name==="brightness_pct"||s.name==="percentage"?"%":s.name==="temperature"?"°":"";return r`<span class="argwrap"><input class="arg" type="number" data-action-arg=${i} aria-label=${s.name} .value=${a} min=${String(p??"")} max=${String(f??"")} step=${String(u)} data-ltr @change=${$=>n($.target.value)} />${v?r`<span class="unit">${v}</span>`:c}</span>`}return r`<input class="arg" type="text" data-action-arg=${i} aria-label=${s.name} .value=${a} maxlength=${String(s.max_len??80)} @change=${p=>n(p.target.value)} />`}trigger(e,t){if(t.sensitive){this.confirmSpec={entityId:e,spec:t};return}this.send(e,t,!1)}async send(e,t,s){this.confirmSpec=null,this.action={entityId:e,spec:t,record:null,error:"",busy:!0};try{const i=this.bundle?.anchors.find(n=>n.resource_type==="ha_entity"&&n.resource_id===e)?.entity,a=await wl(e,t.id,i?this.argsFor(i,t):{},s);if(this.action={entityId:e,spec:t,record:a,error:"",busy:a.status==="pending"},a.status==="pending"){const n=this.action;await vl(a.id,o=>{(this.action===n||this.action?.record?.id===o.id)&&(this.action={entityId:e,spec:t,record:o,error:"",busy:o.status==="pending"})})}}catch(i){const a=i instanceof be&&i.code==="bridge_not_paired"?"גשר SMPLWISE אינו מצומד ב־Home Assistant. התקנה וצימוד: הגדרות → גשר Home Assistant.":w(i);this.action={entityId:e,spec:t,record:null,error:a,busy:!1}}}apiEntityBody(e,t){const s=e.entity;if(!s)return r`<div class="note">ישות HA · <span class="ltr">${e.resource_id}</span> — לא נמצאה בקטלוג המסונכרן (ייתכן שהוסרה מ־Home Assistant).</div>`;const i=this.entityTone(s),a=this.action?.entityId===s.entity_id?this.action:null,n=s.fresh&&this.syncConnected,o=this.renaming?.id===e.id?this.renaming:null;return r`
      <div class="ecard" data-entity-card>
        <div class="estate ${i}"><sw-badge kind=${i} label=${vt(s)}></sw-badge><span class="esub">${_s(s.domain)}${s.area_name?` · ${s.area_name}`:""} · ${t}</span></div>
        ${e.label&&s.name&&e.label!==s.name?r`<div class="note">ב־Home Assistant: ${s.name}</div>`:c}
        ${this.notice?r`<div class="note" data-notice>${this.notice}</div>`:c}
        ${o?r`<div class="rename" data-rename-form><input .value=${o.value} placeholder=${s.name??e.resource_id} aria-label="שם במפה" @input=${l=>this.renaming={id:e.id,value:l.target.value}} @keydown=${l=>{l.key==="Enter"&&this.saveRename(e),l.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" icon="check" data-rename-save ?disabled=${o.busy} @click=${()=>this.saveRename(e)}>שמור</sw-button>
              <sw-button size="sm" variant="ghost" @click=${()=>this.renaming=null}>ביטול</sw-button></div>`:c}
        ${this.entityActions(e)}
        <details class="more"><summary>פרטים</summary>
          <dl class="meta">
            <dt>${y("entity.lastChanged")}</dt><dd>${Re(s.last_changed)}</dd>
            <dt>נראה לאחרונה</dt><dd>${Re(s.state_seen_at)}</dd>
            <dt>ID</dt><dd><span class="ltr">${s.entity_id}</span></dd>
          </dl>
        </details>
      </div>
      ${n?c:r`<div class="warn">${s.state==="unavailable"?"Home Assistant מדווח שהישות אינה זמינה.":"הסנכרון מול Home Assistant מנותק — המצב עלול להיות מיושן."}</div>`}
      ${s.actions===void 0?r`<div class="note">${y("entity.noControl")}</div>`:s.actions.length===0?r`<div class="note">קריאה בלבד — אין פעולות מותרות ל־${_s(s.domain)}.</div>`:c}
      ${s.actions?.some(l=>l.granted===!1)?r`<div class="note" data-grant-note>פעולה מעומעמת דורשת הרשאה נפרדת (למשל פתיחת דלת) שאינה חלק משליטה כללית בישויות.</div>`:c}
      ${a?r`<div class=${a.error||a.record?.status==="failed"||a.record?.status==="denied"?"warn":"note"}>${a.spec.label}: ${a.error?a.error:a.record?`${bl[a.record.status]}${a.record.error?` — ${gl[a.record.error]??a.record.error}`:""}`:"שולח…"}</div>`:c}
    `}async saveRename(e){const t=this.renaming;if(!(!t||t.id!==e.id||t.busy)){this.renaming={...t,busy:!0};try{const s=await kr(e.id,{revision:e.revision,label:t.value.trim()||null});this.bundle&&(this.bundle={...this.bundle,anchors:this.bundle.anchors.map(i=>i.id===e.id?{...i,label:s.label,revision:s.revision}:i)}),this.renaming=null,this.notice=s.label?`השם „${s.label}“ נשמר`:"חזרה לשם מ־Home Assistant"}catch(s){this.notice=w(s),this.renaming={...t,busy:!1}}}}entityActions(e){return(e.entity?.actions??[]).length?r`<div class="eactions" data-entity-actions>${this.entityFooter(e)}</div>`:c}entityFooter(e){const t=e.entity,s=!!(this.action&&t&&this.action.entityId===t.entity_id&&this.action.busy),i=t?.actions??[];return r`${i.map(a=>r`<span class="actrow" data-action-row=${a.id}>${t&&a.argument_specs?.length?a.argument_specs.map(n=>this.renderArg(t,a,n)):c}<sw-button block variant=${a.risk==="sensitive"||a.sensitive?"danger":"primary"} ?disabled=${s||this.screenState==="stale"||t?.state==="unavailable"||a.granted===!1} title=${a.granted===!1?`נדרשת הרשאה נפרדת: ${a.grant??""}`:a.risk_label?`פעולה ${a.risk_label}`:""} data-action=${a.id} data-risk=${a.risk??(a.sensitive?"attention":"routine")} data-granted=${a.granted===!1?"no":"yes"} @click=${()=>t&&this.trigger(t.entity_id,a)}>${a.label}</sw-button></span>`)}`}renderConfirm(){const e=this.confirmSpec;if(!e)return c;const t=this.bundle?.anchors.find(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entityId)?.entity;return r`<sw-dialog open heading=${y("entity.confirm")} subheading=${t?.name??e.entityId} @close=${()=>this.confirmSpec=null}>
      <div style="font-size:var(--sw-fs-sm);line-height:1.5">הפעולה <strong>${e.spec.label}</strong> על <span class="ltr">${e.entityId}</span> היא פעולה ${e.spec.risk_label??"רגישה"}${e.spec.risk==="sensitive"?" (הרשאה נפרדת)":""}. היא תבוצע ב־Home Assistant בזהות שלך ותירשם באודיט.</div>
      <div slot="footer"><sw-button variant="danger" @click=${()=>this.send(e.entityId,e.spec,!0)}>${e.spec.label}</sw-button><sw-button variant="ghost" @click=${()=>this.confirmSpec=null}>${y("actions.cancel")}</sw-button></div>
    </sw-dialog>`}demoCameraBody(e,t){const s=e.state==="offline"?y("camera.offlineReason"):e.state==="forbidden"?y("camera.forbiddenReason"):e.state==="stale"?y("camera.staleReason"):"",i=e.state==="live"||e.state==="stale";return r`
      ${i?r`<sw-camera-tile name="" state=${e.state} scene=${Ke[e.id]??"lobby"} @click=${()=>b(`/live/cameras/${e.id}`)}></sw-camera-tile>`:r`<div class="off"><div><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${22}></sw-icon><div>${s}</div></div></div>`}
      <div class="statusrow"><sw-badge kind=${e.state}></sw-badge><span>${t} · ${e.source}</span></div>
      ${s&&i?r`<div class="warn">${s}</div>`:c}
    `}demoEntityBody(e){const t=this.screenState==="stale",s=t?"stale":e.state==="on"||e.state==="unlocked"?"live":"neutral";return r`
      <dl class="meta">
        <dt>${y("entity.state")}</dt><dd><sw-badge kind=${s} label=${y(e.stateLabelKey)}></sw-badge></dd>
        <dt>${y("entity.lastChanged")}</dt><dd>${e.lastChanged}</dd>
        <dt>ID</dt><dd><span class="ltr">${e.id}</span></dd>
      </dl>
      ${t?r`<div class="warn">${y("states.staleHint")}</div>`:c}
      ${e.controllable?c:r`<div class="note">${y("entity.noControl")}</div>`}
    `}apiCameraBody(e,t){const s=e.camera,i=ps(e),a=za[((s?.channel??1)-1)%za.length],n=i==="live"&&!!s&&s.can_view_live!==!1,o=this.zoneOf(e),l=o?`${t} / ${o}`:`${t} · ערוץ ${s?.channel??"?"}`;return r`
      ${i==="offline"?r`<div class="off"><div><sw-icon name="offline" size=${22}></sw-icon><div>${y("camera.offlineReason")}</div></div></div>`:r`<sw-camera-tile name="" state=${i==="live"?"live":"unknown"} scene=${a} poster=${s?qe(s.id,Date.now()):""} ?live=${n} .cameraId=${n?s.id:""} data-live=${n?"1":"0"} @click=${()=>s&&b(`/live/cameras/${s.id}`)}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${i}></sw-badge><span data-where>${l}</span></div>
      <dl class="meta">
        <dt>שם ב־NVR</dt><dd>${s?.name_source||"—"}${s?r` · <span class="ltr">ch ${s.channel}</span>`:c}</dd>
        <dt>נראתה לאחרונה</dt><dd>${s?.last_seen_at?s.last_seen_at.replace("T"," ").replace("Z"," UTC"):"לא נבדק"}</dd>
      </dl>
      <div class="note">${n?'הזרם נפתח לכרטיס הזה בלבד ונסגר איתו; "צפייה מלאה" פותחת את המצלמה במסך מלא.':i==="offline"?"המצלמה מנותקת לפי ה־NVR.":"תמונה: צילום מה־NVR (מתרענן)."}</div>
    `}renderCard(){const e=this.bundle;if(!this.selectedId||!e)return c;let t="",s="",i=c,a=c;if(e.source==="demo"){const l=cs.find(u=>u.id===this.selectedId),p=l?void 0:Vs.find(u=>u.id===this.selectedId);if(!l&&!p)return c;t=l?l.name:p.name,s=l?`${e.floorName} · ${l.source}`:`${e.floorName} · ${y(p.domain==="lock"?"entity.door":p.domain==="light"?"entity.light":"entity.sensor")}`,i=l?this.demoCameraBody(l,e.floorName):this.demoEntityBody(p);const f=l?l.state==="live"||l.state==="stale":!1;a=l?r`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${!f} @click=${()=>b(`/live/cameras/${l.id}`)}>צפייה חיה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${l.state==="forbidden"} @click=${()=>b("/investigate/playback")}>${y("camera.recordings")}</sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="pin" label=${this.pinned?y("camera.unpin"):y("camera.pin")} @click=${()=>this.pinned=!this.pinned}></sw-button>`:r`<sw-button variant="primary" size="sm" ?disabled=${!p.controllable||this.screenState==="stale"}>${y("entity.control")}</sw-button><sw-button variant="ghost" size="sm">${y("entity.openInHa")}</sw-button>`}else{const l=e.anchors.find(p=>p.id===this.selectedId);if(!l)return c;t=hs(l),s=`${e.buildingName} · ${e.floorName}`,i=l.resource_type==="camera"?this.apiCameraBody(l,e.floorName):this.apiEntityBody(l,e.floorName),a=r`${l.resource_type==="camera"?r`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${ps(l)==="offline"} @click=${()=>l.camera&&b(`/live/cameras/${l.camera.id}`)}>צפייה מלאה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${!l.camera} @click=${()=>l.camera&&b("/investigate/playback",{camera:l.camera.id})}>${y("camera.recordings")}</sw-button>`:c}
        ${l.resource_type==="ha_entity"&&e.permissions.edit&&l.entity?r`<sw-button variant="ghost" size="sm" icon="edit" data-rename @click=${()=>this.renaming={id:l.id,value:l.label??""}}>שנה שם</sw-button>`:c}
        ${e.permissions.edit?r`<sw-button variant="ghost" size="sm" icon="edit" @click=${()=>b(`/explore/floors/${e.floorId}/edit`)}>עריכה</sw-button>`:c}`}if(this.narrow||!this.anchor)return r`<sw-drawer open heading=${t} subheading=${s} @close=${this.close}>${i}<div slot="footer">${a}</div></sw-drawer>`;const n=this.stage?.clientWidth??0,o=this.stage?.clientHeight??0;return r`<sw-popover heading=${t} .x=${this.anchor.x} .y=${this.anchor.y} .stageWidth=${n} .stageHeight=${o} @close=${this.close}>${i}<div slot="footer">${a}</div></sw-popover>`}renderPanel(){const e=this.layerCounts(),t=[{id:"cameras",label:y("floor.cameras"),count:`${e.cameras} ממוקמות`},{id:"doors",label:"דלתות ואינטרקום",count:`${e.doors} ישויות`},{id:"lights",label:y("floor.lights"),count:`${e.lights} ישויות`},{id:"sensors",label:"אבטחה וחיישנים",count:`${e.sensors} ישויות`},{id:"zones",label:"שמות חדרים",count:e.zones?`${e.zones} אזורים · תוויות לפי רמת זום`:"אין חדרים מוגדרים"}];return r`<div class="panel" role="group" aria-label="שכבות פעילות" data-layers-panel>
      <h3>שכבות פעילות</h3>
      <div class="sub">הצג רק מה שרלוונטי כרגע</div>
      ${t.map(s=>r`<div class="prow"><span class="lbl">${s.label}<span class="cnt">${s.count}</span></span><sw-toggle ?checked=${this.layers.has(s.id)} label=${s.label} labelHidden data-layer=${s.id} @change=${i=>{const a=new Set(this.layers);i.detail.checked?a.add(s.id):a.delete(s.id),this.setLayers(a)}}></sw-toggle></div>`)}
      <div class="pnote"><sw-icon name="shield" size=${14}></sw-icon><span>מתג משנה תצוגה בלבד; ייבוא ישות אינו מעניק הרשאת שליטה בה.</span></div>
    </div>`}renderStage(){const e=this.bundle;if(this.loadError)return r`<div class="cover"><sw-state-panel state="error" hint=${this.loadError} actionLabel=${y("states.retry")} @action=${()=>this.load()}></sw-state-panel></div>`;if(this.noFloors)return r`<div class="cover"><sw-state-panel state="empty" heading="עדיין אין קומות" hint="צור אתר, מבנה וקומה ואז ייבא תוכנית קומה."><div style="margin-block-start:10px"><sw-button variant="primary" icon="building" @click=${()=>b("/explore/sites")}>לאתרים ומבנים</sw-button></div></sw-state-panel></div>`;if(!e)return r`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;switch(this.screenState){case"loading":return r`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;case"error":return r`<div class="cover"><sw-state-panel state="error" actionLabel=${y("states.retry")}></sw-state-panel></div>`;case"forbidden":return r`<div class="cover"><sw-state-panel state="forbidden"></sw-state-panel></div>`}return this.screenState==="empty"||e.planStatus==="none"?r`<div class="cover">
        <sw-state-panel state="empty" heading=${y("floor.noPlan")} hint=${e.permissions.import?y("floor.noPlanHint"):"עורך המפות של הקומה יכול להעלות תוכנית."}>
          <div style="display:flex;gap:8px;margin-block-start:10px;justify-content:center;flex-wrap:wrap">
            ${e.permissions.import?r`<sw-button variant="primary" icon="upload" @click=${()=>b(`/explore/floors/${e.floorId}/import`)}>${y("floor.uploadPlan")}</sw-button>`:c}
            <sw-button icon="list" @click=${()=>b("/live/wall")}>${y("floor.listView")}</sw-button>
          </div>
        </sw-state-panel>
      </div>`:r`
      ${this.screenState==="stale"||this.screenState==="partial"?r`<div class="banner"><sw-state-panel compact state=${this.screenState}></sw-state-panel></div>`:e.needsAlignment?r`<div class="banner"><sw-state-panel compact state="partial" heading="פריטים הוצבו על גרסת תוכנית קודמת" hint="בדוק שהמיקומים עדיין נכונים על הרקע החדש (עורך התוכנית)."></sw-state-panel></div>`:c}
      <sw-plan-canvas
        .planWidth=${e.width}
        .planHeight=${e.height}
        .plan=${e.planSvg}
        .imageUrl=${e.imageUrl}
        .markers=${this.markers}
        .selectedId=${this.selectedId}
        .selectedIds=${this.multi?this.picked:[]}
        .boxSelect=${this.multi}
        @box-select=${t=>this.addPicks(t.detail.ids)}
        .zones=${this.layers.has("zones")?e.zones.map(t=>({...t,labelPos:t.label_pos})):[]}
        .selectedZoneId=${this.selectedZoneId}
        .dimEntities=${this.screenState==="stale"}
        @zone-select=${t=>{if(this.multi){this.pickZone(t.detail.id);return}this.selectedZoneId=this.selectedZoneId===t.detail.id?null:t.detail.id,this.close()}}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
      <div class="floorchip" data-floorchip><sw-icon name="building" size=${14}></sw-icon>${e.floorName}</div>
      ${e.source==="api"&&this.buildingFloors.length>1?r`<div class="floorbtns" role="group" aria-label="מעבר מהיר בין קומות" data-floor-buttons>
            ${this.buildingFloors.map(t=>r`<button class=${t.id===this.floorId?"on":""} data-floor-button=${t.id} title=${`${t.name}${t.hasPlan?"":" · אין תוכנית"}`} aria-pressed=${t.id===this.floorId} @click=${()=>{t.id!==this.floorId&&b(`/explore/floors/${t.id}`)}}>${t.short}</button>`)}
          </div>`:c}
      ${this.panel?this.renderPanel():c}
      ${this.multi?this.renderPickbar():c}
      ${this.renderSideList()}
      ${this.renderSaveDialog()}
      <div class="legend" aria-label="מקרא">
        ${e.zones.length&&this.layers.has("zones")?r`<span><i style="--lg: var(--sw-accent); border-radius: 2px; opacity: 0.5"></i>${e.zones.length} אזורים</span>`:c}
        <span><i style="--lg: var(--sw-accent)"></i>חי</span>
        <span><i style="--lg: var(--sw-stale)"></i>לא מעודכן</span>
        <span><i style="--lg: var(--sw-offline)"></i>מנותק</span>
        <span><i style="--lg: var(--sw-forbidden)"></i>ללא הרשאה</span>
        <span><i style="--lg: #fff; box-shadow: 0 0 0 1px var(--sw-border-strong)"></i>ישות HA</span>
      </div>
      ${this.renderCard()}
      ${this.renderConfirm()}
    `}render(){const e=this.bundle,t=this.floors,s=t.find(n=>n.id===this.floorId),i=e?e.source==="demo"?s?.cameraCount??0:e.anchors.filter(n=>n.resource_type==="camera").length:0,a=this.tree?.source==="api"?this.tree.sites.flatMap(n=>(n.buildings??[]).flatMap(o=>o.floors??[])).find(n=>n.id===this.floorId):null;return r`
      <div class="head">
        <div>
          <div class="crumbs">
            <a href="#/explore/sites">${e?.siteName??"אתרים"}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <a href="#/explore/buildings/${e?.source==="api"?a?.building_id??"bld-a":"bld-a"}/floors">${e?.buildingName??""}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <span>${e?.floorName??""}</span>
          </div>
          <h1>${e?`${e.buildingName} – ${e.floorName}`:"מפת קומה"}</h1>
          <div class="sub">
            <span>${i} מצלמות${e&&e.source==="api"?` · ${e.anchors.length-i} ישויות HA${e.zones.length?` · ${e.zones.length} אזורים`:""}`:""}${e?.source==="demo"?" · נתוני הדגמה":e?.planStatus==="published"?" · תוכנית מפורסמת":""}</span>
            ${a?.draft_version_id?r`<sw-badge kind="stale" label="טיוטת תוכנית ממתינה לפרסום"></sw-badge>`:c}
          </div>
        </div>
        <div class="spacer"></div>
        <div class="tools">
          <div class="layers" role="group" aria-label=${y("floor.layers")}>
            ${zl.map(n=>r`<button class=${this.layers.has(n.id)?"on":""} title=${n.label()} aria-label=${n.label()} aria-pressed=${this.layers.has(n.id)} @click=${()=>this.toggleLayer(n.id)}><sw-icon name=${n.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-button icon="layers" aria-pressed=${this.panel} @click=${()=>this.panel=!this.panel}>${y("floor.layers")}</sw-button>
          ${e&&e.source==="api"?r`<sw-button icon="list" aria-pressed=${this.sideList} data-sidelist-toggle @click=${()=>this.toggleSideList()}>רשימה</sw-button><sw-button icon="grid" aria-pressed=${this.multi} data-multi-toggle @click=${()=>this.setMulti(!this.multi)}>בחירת מצלמות</sw-button>`:c}
          <sw-field style="min-inline-size:280px"><select aria-label=${y("floor.switcher")} @change=${n=>b(`/explore/floors/${n.target.value}`)}>${t.map(n=>r`<option value=${n.id} ?selected=${n.id===this.floorId}>${Ct(n.name)} · ${n.cameraCount} מצלמות${n.hasPlan?"":" · אין תוכנית"}</option>`)}</select></sw-field>
          ${!e||e.permissions.edit?r`<sw-button icon="edit" @click=${()=>b(`/explore/floors/${this.floorId}/edit`)}>עריכת תוכנית</sw-button>`:c}
        </div>
      </div>
      <div class="stage">${this.renderStage()}</div>
    `}};R.styles=z`
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
    .crumbs a:hover {
      color: var(--sw-accent-text);
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
      border-radius: 8px;
      padding: 2px;
    }
    .layers button {
      border: 0;
      background: transparent;
      inline-size: 28px;
      block-size: 26px;
      border-radius: 6px;
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
    .floorbtns button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 38px;
      padding: 6px 8px;
      border-radius: 9px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      direction: ltr;
    }
    .floorbtns button.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
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
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      padding: 6px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .floorchip sw-icon {
      color: var(--sw-text-3);
    }
    .panel {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      inline-size: 272px;
      max-inline-size: calc(100% - 24px);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 12px 14px;
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
      color: var(--sw-text-3);
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
    .pickbar {
      position: absolute;
      inset-inline: 12px;
      inset-block-start: 56px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: var(--sw-surface);
      border: 1px solid var(--sw-accent);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      box-shadow: var(--sw-shadow-2);
      font-size: var(--sw-fs-sm);
    }
    .pickbar .hint {
      color: var(--sw-text-3);
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
    .sidelist {
      position: absolute;
      inset-inline-end: 12px;
      inset-block: 12px 56px;
      inline-size: 236px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
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
      color: var(--sw-text-3);
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
    .sidelist button.it:hover,
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
      color: var(--sw-text-3);
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
      color: var(--sw-accent);
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
      color: var(--sw-danger);
    }
    .banner {
      position: absolute;
      inset-inline: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-stale-soft);
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
      background: var(--sw-surface);
      z-index: var(--sw-z-map-ui);
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 10px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      backdrop-filter: blur(6px);
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
      box-shadow: 0 0 0 1px #fff;
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
    .warn {
      color: var(--sw-danger);
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
      border-radius: 6px;
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
      border-radius: 6px;
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
    @media (max-width: 767px) {
      .head {
        padding: 12px 12px 8px;
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
    }
  `;H([m()],R.prototype,"floorId",2);H([m()],R.prototype,"screenState",2);H([m()],R.prototype,"focusZone",2);H([m()],R.prototype,"focusCamera",2);H([m()],R.prototype,"focusEntity",2);H([d()],R.prototype,"selectedZoneId",2);H([d()],R.prototype,"bundle",2);H([d()],R.prototype,"tree",2);H([d()],R.prototype,"loadError",2);H([d()],R.prototype,"noFloors",2);H([d()],R.prototype,"selectedId",2);H([d()],R.prototype,"anchor",2);H([d()],R.prototype,"layers",2);H([d()],R.prototype,"pinned",2);H([d()],R.prototype,"panel",2);H([d()],R.prototype,"multi",2);H([d()],R.prototype,"sideList",2);H([d()],R.prototype,"jumpZoom",2);H([d()],R.prototype,"saveView",2);H([d()],R.prototype,"savedView",2);H([d()],R.prototype,"picked",2);H([d()],R.prototype,"narrow",2);H([d()],R.prototype,"syncConnected",2);H([d()],R.prototype,"action",2);H([d()],R.prototype,"confirmSpec",2);H([es("sw-plan-canvas")],R.prototype,"canvas",2);H([es(".stage")],R.prototype,"stage",2);H([d()],R.prototype,"actionArgs",2);H([d()],R.prototype,"renaming",2);H([d()],R.prototype,"notice",2);R=H([S("explore-floor-map")],R);var Ml=Object.defineProperty,Al=Object.getOwnPropertyDescriptor,Nt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Al(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ml(t,s,a),a};let it=class extends x{constructor(){super(...arguments),this.heading="",this.subheading="",this.crumbs="",this.backHref="",this.wide=!1,this.flush=!1}render(){const e=this.crumbs?this.crumbs.split("|").map(t=>t.trim()):[];return r`
      <header>
        <div>
          ${e.length?r`<div class="crumbs">${e.map((t,s)=>r`${s?r`<sw-icon name="chevron" size=${11}></sw-icon>`:""}<span>${t}</span>`)}</div>`:""}
          <div class="titlebar">
            ${this.backHref?r`<sw-button class="back" data-page-back variant="ghost" size="sm" iconOnly icon="chevronBack" label=${y("actions.back")} @click=${()=>b(this.backHref)}></sw-button>`:""}
            <h1>${this.heading}</h1>
          </div>
          ${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}
        </div>
        <div class="actions"><slot name="actions"></slot></div>
      </header>
      <div class="body"><slot></slot></div>
    `}};it.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      padding: 14px var(--sw-page-pad, 24px) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
      gap: 14px;
    }
    :host([wide]) {
      max-inline-size: none;
    }
    :host([flush]) {
      padding: 0;
      gap: 0;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px 12px;
    }
    :host([flush]) header {
      padding: 12px 16px 0;
    }
    .titlebar {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .back {
      flex: none;
      margin-inline-start: -6px;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-end: 4px;
    }
    .crumbs sw-icon {
      color: var(--sw-border-strong);
    }
    h1 {
      margin: 0;
      font-size: var(--sw-h1, var(--sw-fs-2xl));
      font-weight: var(--sw-h1-weight, var(--sw-fw-semibold));
      line-height: 1.2;
      letter-spacing: var(--sw-h1-tracking, -0.01em);
      color: var(--sw-heading, var(--sw-text));
    }
    .sub {
      margin-block-start: 2px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-block-size: 0;
      flex: 1;
    }
    @media (max-width: 767px) {
      :host {
        padding: 12px 12px 16px;
      }
      h1 {
        font-size: var(--sw-fs-xl);
      }
    }
  `;Nt([m()],it.prototype,"heading",2);Nt([m()],it.prototype,"subheading",2);Nt([m()],it.prototype,"crumbs",2);Nt([m()],it.prototype,"backHref",2);Nt([m({type:Boolean,reflect:!0})],it.prototype,"wide",2);Nt([m({type:Boolean,reflect:!0})],it.prototype,"flush",2);it=Nt([S("sw-page")],it);var El=Object.defineProperty,Pl=Object.getOwnPropertyDescriptor,Is=(e,t,s,i)=>{for(var a=i>1?void 0:i?Pl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&El(t,s,a),a};let Ot=class extends x{constructor(){super(...arguments),this.heading="",this.subheading="",this.flush=!1,this.interactive=!1}render(){return r`
      ${this.heading||this.querySelector('[slot="actions"]')?r`<header><div><h3>${this.heading}</h3>${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}</div><slot name="actions"></slot></header>`:""}
      <slot></slot>
    `}};Ot.styles=z`
    :host {
      display: block;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      padding: 14px;
      min-inline-size: 0;
    }
    :host([flush]) {
      padding: 0;
      overflow: hidden;
    }
    :host([interactive]) {
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    :host([interactive]:hover) {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-block-end: 10px;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
      margin-block-start: 1px;
    }
  `;Is([m()],Ot.prototype,"heading",2);Is([m()],Ot.prototype,"subheading",2);Is([m({type:Boolean,reflect:!0})],Ot.prototype,"flush",2);Is([m({type:Boolean,reflect:!0})],Ot.prototype,"interactive",2);Ot=Is([S("sw-card")],Ot);var Il=Object.defineProperty,Cl=Object.getOwnPropertyDescriptor,lt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Cl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Il(t,s,a),a};const Tl=["house","building","warehouse"];let Be=class extends x{constructor(){super(...arguments),this.tab="all",this.tree=null,this.dialog=null,this.notice="",this.formName="",this.formAddress="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.reload()}async reload(){try{this.tree=await yt()}catch(e){this.error=w(e)}}open(e){this.formName=e&&e.kind==="edit-site"?e.site.name:e&&e.kind==="edit-building"?e.building.name:"",this.formAddress=e&&e.kind==="edit-site"?e.site.address:"",this.error="",this.dialog=e}pickImage(e,t){const s=document.createElement("input");s.type="file",s.accept="image/png,image/jpeg",s.addEventListener("change",async()=>{const i=s.files?.[0];if(i){this.busy=!0;try{await Xo(e,t,i),this.notice="התמונה נשמרה.",await this.reload()}catch(a){this.notice=w(a)}finally{this.busy=!1}}}),s.click()}async removeImage(e,t){this.busy=!0;try{await Qo(e,t),await this.reload()}catch(s){this.notice=w(s)}finally{this.busy=!1}}renderMenu(e,t,s){const i=s?!!s.image_url:!!t.image_url,a=s?s.id:t.id;return r`<span class="menu" @click=${o=>o.stopPropagation()}>
      ${s?c:r`<sw-button variant="ghost" size="sm" icon="plus" data-add-building=${t.id} @click=${()=>this.open({kind:"building",site:t})}>מבנה</sw-button>`}
      <sw-button variant="ghost" size="sm" iconOnly icon="edit" label="עריכה" data-edit=${a} @click=${()=>this.open(s?{kind:"edit-building",building:s,site:t}:{kind:"edit-site",site:t})}></sw-button>
      <sw-button variant="ghost" size="sm" iconOnly icon="camera" label=${i?"החלף תמונה":"תמונה"} ?disabled=${this.busy} data-image=${a} @click=${()=>this.pickImage(e,a)}></sw-button>
      ${i?r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label="הסר תמונה" ?disabled=${this.busy} @click=${()=>this.removeImage(e,a)}></sw-button>`:c}
      <sw-button variant="ghost" size="sm" iconOnly icon="trash" label="מחיקה" data-delete=${a} @click=${()=>this.open(s?{kind:"delete-building",building:s,site:t}:{kind:"delete-site",site:t})}></sw-button>
    </span>`}async submit(){const e=this.dialog;if(e){this.busy=!0,this.error="";try{if(e.kind==="site"){const t=await Wo({name:this.formName.trim(),address:this.formAddress.trim()});this.dialog=null,await this.reload(),this.open({kind:"building",site:t})}else if(e.kind==="building"){const t=await zr(e.site.id,{name:this.formName.trim()});this.dialog=null,b(`/explore/buildings/${t.id}/floors`)}else e.kind==="edit-site"?(await Uo(e.site.id,{name:this.formName.trim(),address:this.formAddress.trim()}),this.dialog=null,await this.reload()):e.kind==="edit-building"?(await qo(e.building.id,{name:this.formName.trim()}),this.dialog=null,await this.reload()):e.kind==="delete-site"?(await Zo(e.site.id),this.dialog=null,await this.reload()):e.kind==="delete-building"&&(await Ko(e.building.id),this.dialog=null,await this.reload())}catch(t){this.error=w(t)}finally{this.busy=!1}}}openSite(e){const t=e.buildings?.[0];t?b(`/explore/buildings/${t.id}/floors`):this.open({kind:"building",site:e})}renderSites(e){return r`<div class="grid">
      ${e.sites.map((t,s)=>{const i=t.buildings??[],a=i.reduce((n,o)=>n+(o.floors??[]).reduce((l,p)=>l+p.camera_count,0),0);return r`<sw-card flush interactive data-site-card=${t.id} @click=${()=>this.openSite(t)}>
          <div class="pic">${t.image_url?r`<img class="photo" src=${ka(t.image_url)} alt="" />`:r`<sw-scene kind=${Tl[s%3]}></sw-scene>${e.source==="demo"?r`<span class="demo">דמו</span>`:r`<span class="demo">איור</span>`}`}</div>
          <div class="info">
            <div><b>${t.name}</b><small>${i.length} ${i.length===1?"מבנה":"מבנים"} · ${a} מצלמות${t.address?` · ${t.address}`:""}</small></div>
            ${e.source==="api"?this.renderMenu("site",t):c}
            <sw-button variant="ghost" size="sm" iconOnly icon="plus" label="מבנה חדש" @click=${n=>{n.stopPropagation(),this.open({kind:"building",site:t})}}></sw-button>
          </div>
        </sw-card>`})}
      ${e.canCreateSite?r`<button class="add" @click=${()=>this.open({kind:"site"})}><div><div class="ic"><sw-icon name="plus" size=${18}></sw-icon></div><strong>הוספת אתר חדש</strong><small>יצירת מיקום חדש כדי להתחיל</small></div></button>`:c}
    </div>`}renderBuildings(e){const t=e.sites.flatMap(s=>(s.buildings??[]).map(i=>({s,b:i})));return r`<div class="blist">
      ${t.map(({s,b:i},a)=>r`<sw-card class="brow" data-building-card=${i.id} @click=${()=>b(`/explore/buildings/${i.id}/floors`)}>
          ${i.image_url?r`<img class="photo small" src=${ka(i.image_url)} alt="" />`:r`<sw-scene kind=${a%2?"house":"building"}></sw-scene>`}
          <div><b>${i.name}</b><small>${s.name} · ${(i.floors??[]).length} קומות · ${(i.floors??[]).reduce((n,o)=>n+o.camera_count,0)} מצלמות</small></div>
          ${e.source==="api"?this.renderMenu("building",s,i):c}
          <sw-icon name="chevron" size=${14}></sw-icon>
        </sw-card>`)}
      ${t.length?c:r`<div class="map" style="min-block-size:120px">אין מבנים עדיין.</div>`}
    </div>`}render(){const e=this.tree;if(!e)return r`<sw-page heading="אתרים ומבנים"><sw-state-panel state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const t=this.dialog;return r`
      <sw-page heading="אתרים ומבנים" subheading=${`ניהול המיקומים והמבנים שלך${e.source==="demo"?" · נתוני הדגמה":""}`}>
        ${e.canCreateSite?r`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button>`:c}
        <sw-tabs .items=${[{id:"all",label:"כל האתרים",count:e.sites.length},{id:"buildings",label:"מבנים",count:e.sites.reduce((s,i)=>s+(i.buildings?.length??0),0)},{id:"map",label:"מפה"}]} .active=${this.tab} @change=${s=>this.tab=s.detail.id}></sw-tabs>
        ${e.sites.length===0&&this.tab==="all"?r`<sw-state-panel state="empty" heading="עוד אין אתרים" hint="התחל ביצירת האתר הראשון; אחר כך מבנה, קומות ותוכניות.">${e.canCreateSite?r`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button></div>`:c}</sw-state-panel>`:this.tab==="all"?this.renderSites(e):this.tab==="buildings"?this.renderBuildings(e):r`<div class="map">מפת אתרים (לוח 3 · מסך 17) תצטרף עם שכבת מיקום גאוגרפי · Beta</div>`}
        ${this.notice?r`<div class="err" data-sites-notice style="margin-block:8px">${this.notice}</div>`:c}
        ${t&&(t.kind==="delete-site"||t.kind==="delete-building")?(()=>{const s=t.kind==="delete-site"?(t.site.buildings??[]).length:(t.building.floors??[]).length,i=t.kind==="delete-site"?t.site.name:t.building.name;return r`<sw-dialog open heading=${t.kind==="delete-site"?"מחיקת אתר":"מחיקת מבנה"} subheading=${i} data-delete-dialog @close=${()=>this.dialog=null}>
                ${s?r`<div class="err">${t.kind==="delete-site"?`לאתר יש ${s} מבנים`:`למבנה יש ${s} קומות`}. מחק אותם קודם; מחיקה לא מוחקת מצלמות, רק את המיקום בקטלוג.</div>`:r`<div>המיקום יוסר מהקטלוג (מחיקה רכה, נרשמת באודיט). מצלמות והקלטות אינן מושפעות.</div>`}
                ${this.error?r`<div class="err">${this.error}</div>`:c}
                <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
                <sw-button slot="footer" variant="danger" ?disabled=${!!s||this.busy} data-delete-confirm @click=${()=>this.submit()}>מחק</sw-button>
              </sw-dialog>`})():t?r`<sw-dialog open heading=${t.kind==="site"?"אתר חדש":t.kind==="building"?"מבנה חדש":t.kind==="edit-site"?"עריכת אתר":"עריכת מבנה"} subheading=${t.kind==="building"?t.site.name:t.kind==="site"?"שם, כתובת ואזור זמן ברירת מחדל Asia/Jerusalem":t.kind==="edit-building"?t.site.name:t.site.address||""} data-edit-dialog @close=${()=>this.dialog=null}>
                <sw-field label="שם"><input data-form-name .value=${this.formName} @input=${s=>this.formName=s.target.value} placeholder=${t.kind==="site"||t.kind==="edit-site"?"למשל: משרדי החברה":"למשל: מבנה ראשי"} /></sw-field>
                ${t.kind==="site"||t.kind==="edit-site"?r`<sw-field label="כתובת (אופציונלי)"><input data-form-address .value=${this.formAddress} @input=${s=>this.formAddress=s.target.value} /></sw-field>`:c}
                ${this.error?r`<div class="err">${this.error}</div>`:c}
                ${e.source==="demo"?r`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:c}
                <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
                <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||e.source==="demo"} data-form-submit @click=${()=>this.submit()}>${t.kind==="site"?"צור אתר":t.kind==="building"?"צור מבנה":"שמור"}</sw-button>
              </sw-dialog>`:c}
      </sw-page>
    `}};Be.styles=z`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 14px;
    }
    .pic {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .pic .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: 9.5px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px 12px;
    }
    .info b {
      display: block;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .info small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .add {
      display: grid;
      place-items: center;
      min-block-size: 200px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      text-align: center;
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
      font-size: var(--sw-fs-sm);
      background: transparent;
      font-family: inherit;
    }
    .add:hover {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .add .ic {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .add small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .blist {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .brow {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }
    .brow sw-scene {
      inline-size: 64px;
      block-size: 44px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .brow b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .brow small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .brow sw-icon {
      margin-inline-start: auto;
      color: var(--sw-text-3);
    }
    .menu {
      display: inline-flex;
      gap: 2px;
      align-items: center;
    }
    .brow .menu {
      margin-inline-start: auto;
    }
    .brow .menu + sw-icon {
      margin-inline-start: 0;
    }
    img.photo {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    img.photo.small {
      inline-size: 64px;
      block-size: 44px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .map {
      min-block-size: 360px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;lt([d()],Be.prototype,"tab",2);lt([d()],Be.prototype,"tree",2);lt([d()],Be.prototype,"dialog",2);lt([d()],Be.prototype,"notice",2);lt([d()],Be.prototype,"formName",2);lt([d()],Be.prototype,"formAddress",2);lt([d()],Be.prototype,"busy",2);lt([d()],Be.prototype,"error",2);Be=lt([S("explore-sites")],Be);var Ol=Object.defineProperty,Dl=Object.getOwnPropertyDescriptor,Cs=(e,t,s,i)=>{for(var a=i>1?void 0:i?Dl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ol(t,s,a),a};let Dt=class extends x{constructor(){super(...arguments),this.rooms=[],this.selected=!1,this.empty=!1,this.width=132}iso(e,t){return{x:60+(e-t)*58,y:6+(e+t)*26}}poly(e){return e.map(t=>`${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(" ")}render(){this.style.setProperty("--w",`${this.width}px`);const e=[this.iso(0,0),this.iso(1,0),this.iso(1,1),this.iso(0,1)],t=7,s=[this.iso(1,0),this.iso(1,1),{x:this.iso(1,1).x,y:this.iso(1,1).y+t},{x:this.iso(1,0).x,y:this.iso(1,0).y+t}],i=[this.iso(0,1),this.iso(1,1),{x:this.iso(1,1).x,y:this.iso(1,1).y+t},{x:this.iso(0,1).x,y:this.iso(0,1).y+t}];return r`<svg viewBox="0 0 120 72" aria-hidden="true">
      ${h`<polygon class="side" points=${this.poly(s)} /><polygon class="side" points=${this.poly(i)} />`}
      ${h`<polygon class="top" points=${this.poly(e)} />`}
      ${this.empty?"":this.rooms.map(a=>h`<polygon class="room" points=${this.poly([this.iso(a.x,a.y),this.iso(a.x+a.w,a.y),this.iso(a.x+a.w,a.y+a.h),this.iso(a.x,a.y+a.h)])} />`)}
    </svg>`}};Dt.styles=z`
    :host {
      display: inline-block;
      inline-size: var(--w, 132px);
      flex-shrink: 0;
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: auto;
      overflow: visible;
    }
    .side {
      fill: #cfd7e3;
    }
    .top {
      fill: #ffffff;
      stroke: #b7c3d4;
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    .room {
      fill: none;
      stroke: #b7c3d4;
      stroke-width: 1;
      stroke-linejoin: round;
    }
    :host([selected]) .side {
      fill: #9db9ff;
    }
    :host([selected]) .top {
      fill: #dbe6ff;
      stroke: var(--sw-accent);
    }
    :host([selected]) .room {
      stroke: var(--sw-accent);
    }
    :host([empty]) .top {
      fill: #f6f8fb;
      stroke-dasharray: 3 3;
    }
  `;Cs([m({attribute:!1})],Dt.prototype,"rooms",2);Cs([m({type:Boolean,reflect:!0})],Dt.prototype,"selected",2);Cs([m({type:Boolean,reflect:!0})],Dt.prototype,"empty",2);Cs([m({type:Number})],Dt.prototype,"width",2);Dt=Cs([S("sw-floor-iso")],Dt);var Rl=Object.defineProperty,Nl=Object.getOwnPropertyDescriptor,Ye=(e,t,s,i)=>{for(var a=i>1?void 0:i?Nl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Rl(t,s,a),a};let Pe=class extends x{constructor(){super(...arguments),this.buildingId="bld-a",this.tree=null,this.selected=null,this.tab="floors",this.dialog=null,this.busy=!1,this.error="",this.formName="",this.formLevel=0}connectedCallback(){super.connectedCallback(),this.reload()}updated(e){e.has("buildingId")&&e.get("buildingId")!==void 0&&(this.selected=null)}async reload(){try{this.tree=await yt(),this.error=""}catch(e){this.error=w(e)}}get context(){if(!this.tree)return null;for(const s of this.tree.sites)for(const i of s.buildings??[])if(i.id===this.buildingId)return{site:s,building:i};const e=this.tree.sites[0],t=e?.buildings?.[0];return e&&t?{site:e,building:t}:null}async run(e){this.busy=!0,this.error="";try{await e(),this.dialog=null,await this.reload()}catch(t){t instanceof be&&t.code==="has_anchors"&&this.dialog?.kind==="delete"?(this.dialog={...this.dialog,force:!0},this.error=`${t.body.user_message} (${t.body.details.anchors??""} פריטים)`):this.error=w(t)}finally{this.busy=!1}}openDialog(e){this.error="",this.formName=e?.kind==="rename"?e.floor.name:"",this.formLevel=e?.kind==="rename"?e.floor.level:0,this.dialog=e}renderDialog(e){const t=this.dialog;if(!t)return c;const s=this.tree?.source==="demo",i=r`<sw-field label="שם"><input .value=${this.formName} @input=${l=>this.formName=l.target.value} placeholder="למשל: קומה 1" autofocus /></sw-field>`,a=r`<sw-field label="מפלס (0 = קרקע, שלילי = מרתף)" hint="קובע את סדר התצוגה בין הקומות"><input type="number" data-ltr .value=${String(this.formLevel)} @input=${l=>this.formLevel=Number(l.target.value)} /></sw-field>`,n=this.error?r`<div class="err">${this.error}</div>`:c,o=s?r`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:c;switch(t.kind){case"floor":return r`<sw-dialog open heading="קומה חדשה" subheading=${`${e.name}`} @close=${()=>this.dialog=null}>
          ${i}${a}${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||s} @click=${()=>this.run(async()=>{const l=await Go(e.id,{name:this.formName.trim(),level:this.formLevel});this.selected=l.id})}>הוסף קומה</sw-button>
        </sw-dialog>`;case"rename":return r`<sw-dialog open heading="עריכת קומה" subheading=${t.floor.name} @close=${()=>this.dialog=null}>
          ${i}${a}${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||s} @click=${()=>this.run(()=>Yo(t.floor.id,{name:this.formName.trim(),level:this.formLevel}))}>שמירה</sw-button>
        </sw-dialog>`;case"delete":return r`<sw-dialog open heading="מחיקת קומה" subheading=${t.floor.name} @close=${()=>this.dialog=null}>
          <div style="font-size:var(--sw-fs-sm)">${t.force?"על הקומה מוצבים פריטים. מחיקה תסיר אותם מהמפה (ההיסטוריה נשמרת באודיט). להמשיך?":"הקומה תוסר מהמערכת. תוכניות שפורסמו נשמרות בארכיון; מצלמות והקלטות ב־NVR אינן נמחקות."}</div>
          ${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="danger" ?disabled=${this.busy||s} @click=${()=>this.run(async()=>{await Jo(t.floor.id,t.force),this.selected===t.floor.id&&(this.selected=null)})}>${t.force?"מחק כולל הפריטים":"מחק קומה"}</sw-button>
        </sw-dialog>`;case"building":return r`<sw-dialog open heading="מבנה חדש" subheading=${this.context?.site.name??""} @close=${()=>this.dialog=null}>
          ${i}${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||s} @click=${()=>this.run(async()=>{const l=await zr(this.context.site.id,{name:this.formName.trim()});b(`/explore/buildings/${l.id}/floors`)})}>הוסף מבנה</sw-button>
        </sw-dialog>`}}render(){if(!this.tree)return r`<sw-page heading="קומות"><sw-state-panel state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const e=this.context;if(!e)return r`<sw-page heading="קומות" subheading="אין עדיין אתרים ומבנים">
        <sw-state-panel state="empty" heading="עוד אין מבנים" hint="צור אתר ומבנה כדי להוסיף קומות ותוכניות.">
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>b("/explore/sites")}>לאתרים</sw-button></div>
        </sw-state-panel>
      </sw-page>`;const{site:t,building:s}=e,i=s.floors??[],a=i.find(l=>l.id===this.selected)??i[0]??null,n=i.reduce((l,p)=>l+p.camera_count,0),o=this.tree;return r`
      <sw-page heading=${s.name} subheading=${`${t.address||t.name} · ${i.length} קומות${o.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${t.name} | ${s.name}`}>
        <div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>
        <sw-tabs .items=${[{id:"floors",label:"קומות",count:i.length},{id:"cameras",label:"מצלמות",count:n},{id:"details",label:"פרטים"}]} .active=${this.tab} @change=${l=>this.tab=l.detail.id}></sw-tabs>
        ${this.tab==="floors"?r`<div class="list">
              ${i.length?c:r`<div class="empty">למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה).</div>`}
              ${i.map(l=>r`<button class="floor ${a?.id===l.id?"on":""}" @click=${()=>a?.id===l.id?b(`/explore/floors/${l.id}`):this.selected=l.id} aria-pressed=${a?.id===l.id}>
                  <div class="txt">
                    <div class="title">${Ct(l.name)}</div>
                    <div class="counts">${l.camera_count} מצלמות · ${l.anchor_count} פריטים במפה · מפלס ${el(l.level)}${l.has_plan?"":" · אין תוכנית עדיין"}${l.draft_version_id?" · טיוטה ממתינה לפרסום":""}</div>
                  </div>
                  <sw-floor-iso .rooms=${o.source==="demo"?Ei(l.id):[]} ?selected=${a?.id===l.id} ?empty=${!l.has_plan} width=${128}></sw-floor-iso>
                  <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
                </button>`)}
              ${this.error&&!this.dialog?r`<div class="err">${this.error}</div>`:c}
              <div class="actions">
                <div>
                  <sw-button icon="plus" @click=${()=>this.openDialog({kind:"floor"})}>קומה חדשה</sw-button>
                  <sw-button variant="ghost" icon="building" @click=${()=>this.openDialog({kind:"building"})}>מבנה חדש</sw-button>
                </div>
                ${a?r`<div>
                      <sw-button variant="ghost" icon="edit" @click=${()=>this.openDialog({kind:"rename",floor:a})}>עריכה</sw-button>
                      <sw-button variant="ghost" icon="trash" @click=${()=>this.openDialog({kind:"delete",floor:a,force:!1})}>מחיקה</sw-button>
                      <sw-button icon="upload" @click=${()=>b(`/explore/floors/${a.id}/import`)}>${a.has_plan?"תוכנית חדשה":"העלאת תוכנית"}</sw-button>
                      <sw-button variant="primary" icon="map" @click=${()=>b(`/explore/floors/${a.id}`)}>פתח את ${a.name}</sw-button>
                    </div>`:c}
              </div>
            </div>`:this.tab==="cameras"?r`<div class="cams">${i.map(l=>r`<sw-card heading=${Ct(l.name)} subheading="${l.camera_count} מצלמות" interactive @click=${()=>b(`/explore/floors/${l.id}`)}></sw-card>`)}</div>`:r`<sw-card heading="פרטי המבנה">
                <dl>
                  <dt>אתר</dt><dd>${t.name}</dd>
                  <dt>כתובת</dt><dd>${t.address||"—"}</dd>
                  <dt>אזור זמן</dt><dd><span class="ltr">${t.timezone}</span></dd>
                  <dt>קומות</dt><dd>${i.length} · ${i.filter(l=>l.has_plan).length} עם תוכנית מפורסמת</dd>
                  <dt>קשרים בין קומות</dt><dd>מדרגות ומעלית יוגדרו בעורך (Beta)</dd>
                </dl>
              </sw-card>`}
        ${this.renderDialog(s)}
      </sw-page>
    `}};Pe.styles=z`
    .pic {
      inline-size: 112px;
      block-size: 72px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      position: relative;
      box-shadow: var(--sw-shadow-1);
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-inline-size: 720px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      border: 1.5px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      text-align: start;
      font: inherit;
      color: inherit;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .floor:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    .floor.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .floor .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .title {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .counts {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .chev {
      color: var(--sw-text-3);
    }
    .floor.on .chev {
      color: var(--sw-accent);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .actions div {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .empty {
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 24px;
      text-align: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
      max-inline-size: 520px;
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .cams {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
  `;Ye([m()],Pe.prototype,"buildingId",2);Ye([d()],Pe.prototype,"tree",2);Ye([d()],Pe.prototype,"selected",2);Ye([d()],Pe.prototype,"tab",2);Ye([d()],Pe.prototype,"dialog",2);Ye([d()],Pe.prototype,"busy",2);Ye([d()],Pe.prototype,"error",2);Ye([d()],Pe.prototype,"formName",2);Ye([d()],Pe.prototype,"formLevel",2);Pe=Ye([S("explore-floors")],Pe);var Bl=Object.defineProperty,Ll=Object.getOwnPropertyDescriptor,ta=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ll(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Bl(t,s,a),a};let zs=class extends x{constructor(){super(...arguments),this.steps=[],this.current=0}render(){return r`${this.steps.map((e,t)=>r`
        <div class="step ${t<this.current?"done":t===this.current?"current":""}">
          <span class="n">${t<this.current?r`<sw-icon name="check" size=${13}></sw-icon>`:t+1}</span><span>${e}</span>
        </div>
        ${t<this.steps.length-1?r`<div class="line ${t<this.current?"done":""}"></div>`:""}
      `)}`}};zs.styles=z`
    :host {
      display: flex;
      align-items: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      min-inline-size: 72px;
    }
    .n {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .step.done {
      color: var(--sw-text-2);
    }
    .step.done .n {
      background: var(--sw-live);
      border-color: var(--sw-live);
      color: #fff;
    }
    .step.current {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .step.current .n {
      border-color: var(--sw-accent);
      background: var(--sw-accent);
      color: #fff;
      box-shadow: 0 0 0 4px var(--sw-accent-soft);
    }
    .line {
      flex: 1;
      min-inline-size: 20px;
      block-size: 2px;
      margin-block-start: 13px;
      background: var(--sw-border);
      border-radius: 1px;
    }
    .line.done {
      background: var(--sw-live);
    }
  `;ta([m({attribute:!1})],zs.prototype,"steps",2);ta([m({type:Number})],zs.prototype,"current",2);zs=ta([S("sw-steps")],zs);var Hl=Object.defineProperty,Vl=Object.getOwnPropertyDescriptor,ie=(e,t,s,i)=>{for(var a=i>1?void 0:i?Vl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Hl(t,s,a),a};const fi=["קובץ","עמוד","חיתוך וסיבוב","שם והערות","שמירה ופרסום"];function Sa(e){return e>=1024*1024?`${(e/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(e/1024))} KB`}let J=class extends x{constructor(){super(...arguments),this.floorId="",this.step=0,this.tree=null,this.assets=[],this.asset=null,this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.notes="",this.version=null,this.busy=!1,this.error="",this.dragOver=!1,this.dxf=null,this.dxfLayers=null,this.dxfUnits=null,this.dxfBusy=!1,this.previewBust=0,this.startCrop=e=>{if(e.button!==0)return;const t=e.currentTarget,s=t.getBoundingClientRect(),i=l=>({x:Math.min(1,Math.max(0,(l.clientX-s.left)/s.width)),y:Math.min(1,Math.max(0,(l.clientY-s.top)/s.height))}),a=i(e);t.setPointerCapture(e.pointerId),e.preventDefault();const n=l=>{const p=i(l),f=Math.min(a.x,p.x),u=Math.min(a.y,p.y),v=Math.abs(p.x-a.x),$=Math.abs(p.y-a.y);v>.01&&$>.01&&(this.crop={x:+f.toFixed(4),y:+u.toFixed(4),w:+v.toFixed(4),h:+$.toFixed(4)})},o=()=>{t.removeEventListener("pointermove",n),t.removeEventListener("pointerup",o),t.removeEventListener("pointercancel",o),(this.crop.w<.02||this.crop.h<.02)&&(this.crop={x:0,y:0,w:1,h:1})};t.addEventListener("pointermove",n),t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o)}}connectedCallback(){super.connectedCallback(),this.init()}async init(){try{this.tree=await yt(),g()&&this.floorId&&(this.assets=(await Io(this.floorId)).assets)}catch(e){this.error=w(e)}}get floor(){return this.tree&&this.floorId?Sr(this.tree,this.floorId):null}updated(e){if(e.has("asset")&&g()){const t=this.asset;t&&t.kind==="dxf"&&(!this.dxf||this.dxf.asset_id!==t.id)?this.loadDxf(t.id):(!t||t.kind!=="dxf")&&(this.dxf=null)}}async loadDxf(e){try{const t=await Vo(e);this.dxf=t,this.dxfLayers=t.options.layers,this.dxfUnits=t.options.units??(t.info?.units&&t.info.units!=="unitless"?t.info.units:null)}catch(t){this.error=w(t)}}toggleDxfLayer(e){const t=this.dxf?.info?.layers.filter(i=>i.drawable>0).map(i=>i.name)??[],s=this.dxfLayers??t;this.dxfLayers=s.includes(e)?s.filter(i=>i!==e):[...s,e]}async applyDxf(){if(this.dxf){this.dxfBusy=!0,this.error="";try{const e=this.dxf.info?.layers.filter(s=>s.drawable>0).map(s=>s.name)??[],t=this.dxfLayers&&this.dxfLayers.length!==e.length?this.dxfLayers:null;this.dxf=await jo(this.dxf.asset_id,{layers:t,units:this.dxfUnits}),this.dxfLayers=this.dxf.options.layers,this.previewBust=Date.now()}catch(e){this.error=w(e)}finally{this.dxfBusy=!1}}}renderDxf(){const e=this.dxf;if(!e||!e.info)return c;const t=e.info.layers.filter(l=>l.drawable>0).map(l=>l.name),s=this.dxfLayers??t,i=e.info.extent,a=Object.entries(e.render?.skipped??e.info.unsupported),n=e.render?.meters_per_px,o=e.render?.units&&e.render.units!=="unitless";return r`<sw-card heading="DXF · שכבות, יחידות וקנה מידה" subheading=${`${e.adapter.library} (${e.adapter.license}) · המקור נשמר כפי שהועלה; התצוגה נגזרת ממנו`} data-dxf>
      <div class="note">גרסה ${e.info.version} · יחידות בקובץ: <strong data-dxf-units>${e.info.units}</strong>${i?r` · היקף ${i.width.toFixed(0)} × ${i.height.toFixed(0)} יחידות`:c}${o&&i&&n?r` · כ־${(i.width*(n*e.render.px_per_unit)).toFixed(1)} × ${(i.height*(n*e.render.px_per_unit)).toFixed(1)} מ׳`:c}</div>
      <div class="note">ישויות: ${Object.entries(e.info.entity_counts).map(([l,p])=>`${l} ${p}`).join(" · ")}</div>
      ${a.length?r`<div class="err" data-dxf-partial>המרה חלקית: ${a.map(([l,p])=>`${p} × ${l}`).join(", ")} לא מצוירים (טקסטים, מילויים, מידות וגופים תלת־ממדיים אינם מומרים). הדבר יוצג גם על הגרסה.</div>`:r`<div class="note">כל הישויות בקובץ מצוירות.</div>`}
      <div class="note" style="margin-block-start:6px">שכבות (${s.length} מתוך ${t.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 12px">${e.info.layers.map(l=>r`<label style="display:flex;gap:6px;align-items:center;font-size:var(--sw-fs-sm)"><input type="checkbox" data-dxf-layer=${l.name} .checked=${s.includes(l.name)} ?disabled=${l.drawable===0} @change=${()=>this.toggleDxfLayer(l.name)} /> <span class="ltr">${l.name}</span> <span class="note">(${l.drawable})</span></label>`)}</div>
      <div class="row" style="margin-block-start:8px;align-items:center;gap:8px">
        <sw-field label="יחידות השרטוט"><select data-dxf-units-select @change=${l=>this.dxfUnits=l.target.value||null}><option value="" ?selected=${!this.dxfUnits}>לפי הקובץ (${e.info.units})</option>${e.units_choices.map(l=>r`<option value=${l} ?selected=${this.dxfUnits===l}>${l}</option>`)}</select></sw-field>
        <sw-button size="sm" variant="primary" data-dxf-apply ?disabled=${this.dxfBusy||s.length===0} @click=${()=>this.applyDxf()}>החל ורנדר מחדש</sw-button>
      </div>
      ${e.render?r`<div class="note" style="margin-block-start:6px" data-dxf-render>רונדר: ${e.render.width}×${e.render.height} px · ${e.render.rendered} ישויות מ־${e.render.layers.length} שכבות${n?` · ${(n*100).toFixed(2)} ס״מ לפיקסל (מיחידות ${e.render.units}; ייכנס לגרסה כקנה מידה)`:" · קנה מידה לא ידוע: הקובץ ללא יחידות, בחר יחידות או כייל מאוחר יותר"}</div>`:c}
      <div class="note">DWG אינו נתמך (פורמט סגור) — יש להמיר ל־DXF לפני הייבוא.</div>
    </sw-card>`}async onFile(e){if(!(!e||!this.floorId)){this.busy=!0,this.error="";try{this.asset=await Co(this.floorId,e),this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.version=null,this.step=this.asset.page_count>1?1:2,this.assets=[this.asset,...this.assets.filter(t=>t.id!==this.asset.id)]}catch(t){this.error=w(t)}finally{this.busy=!1}}}async save(){if(!(!this.asset||!this.floorId)){this.busy=!0,this.error="";try{const e=this.crop.x===0&&this.crop.y===0&&this.crop.w===1&&this.crop.h===1;this.version=await Oo(this.floorId,{asset_id:this.asset.id,page:this.page,rotation:this.rotation,crop:e?null:this.crop,notes:this.notes})}catch(e){this.error=w(e)}finally{this.busy=!1}}}async publish(){if(this.version){this.busy=!0,this.error="";try{this.version=await Ri(this.version.id)}catch(e){this.error=w(e)}finally{this.busy=!1}}}setCrop(e,t){const s=Math.max(0,Math.min(100,t))/100,i={...this.crop,[e]:s};i.x+i.w>1&&(i.w=1-i.x),i.y+i.h>1&&(i.h=1-i.y),i.w<=.02&&(i.w=.02),i.h<=.02&&(i.h=.02),this.crop=i}previewUrl(){const e=this.asset?.pages.find(s=>s.page===this.page)??this.asset?.pages[0];if(!e)return"";const t=tt(e.preview_url)+(this.previewBust?`${e.preview_url.includes("?")?"&":"?"}v=${this.previewBust}`:"");return this.rotation?`${t}${t.includes("?")?"&":"?"}rotation=${this.rotation}`:t}renderStep(){const e=this.asset;switch(this.step){case 0:return r`
          <label class="drop ${this.dragOver?"over":""}" @dragover=${t=>{t.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1} @drop=${t=>{t.preventDefault(),this.dragOver=!1,this.onFile(t.dataTransfer?.files[0])}}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf,application/pdf,image/png,image/jpeg,image/vnd.dxf" @change=${t=>void this.onFile(t.target.files?.[0])} />
            <div>
              <div class="ic"><sw-icon name="upload" size=${20}></sw-icon></div>
              <strong>${this.busy?"מעלה…":"גרור לכאן PDF, תמונה או DXF של התוכנית, או לחץ לבחירה"}</strong>
              <small>PDF עד 20 עמודים, PNG / JPG, DXF (AutoCAD; DWG יש להמיר) · עד 40 MB · הזיהוי לפי תוכן הקובץ · המקור נשמר ללא שינוי</small>
            </div>
          </label>
          ${this.assets.length?r`<div class="assets"><div class="note" style="margin-block-end:4px">קבצים שכבר הועלו לקומה זו:</div>${this.assets.map(t=>r`<button @click=${()=>{this.asset=t,this.page=1,this.step=t.page_count>1?1:2}}><span>${t.original_name}</span><span class="ltr">${t.page_count} עמ׳ · ${Sa(t.bytes)}</span></button>`)}</div>`:c}`;case 1:return r`<div class="note">בחר את העמוד שמכיל את התוכנית של הקומה.</div>
          <div class="pages">${e?.pages.map(t=>r`<button class="pg ${t.page===this.page?"on":""}" @click=${()=>this.page=t.page}><img src=${tt(t.preview_url)} alt=${`עמוד ${t.page}`} loading="lazy" />עמוד ${t.page}</button>`)}</div>`;case 2:{const t=this.crop,s=t.x===0&&t.y===0&&t.w===1&&t.h===1;return r`
          <div class="preview">
            <div class="frame" @pointerdown=${this.startCrop}>
              <img src=${this.previewUrl()} alt="תצוגה מקדימה (אחרי סיבוב)" />
              ${s?c:r`<div class="cropbox" style="left:${t.x*100}%;top:${t.y*100}%;width:${t.w*100}%;height:${t.h*100}%"></div>`}
              <div class="hint">${s?"גרור מלבן על התוכנית כדי לחתוך":`חיתוך ${Math.round(t.w*100)}%×${Math.round(t.h*100)}% · גרור שוב כדי לשנות`}</div>
            </div>
          </div>
          <div class="row">
            <sw-button size="sm" icon="refresh" @click=${()=>{this.rotation=(this.rotation+90)%360,this.crop={x:0,y:0,w:1,h:1}}}>סובב 90°</sw-button>
            <sw-badge kind="neutral" label=${`סיבוב ${this.rotation}°`}></sw-badge>
            <sw-button size="sm" variant="ghost" icon="fit" ?disabled=${s} @click=${()=>this.crop={x:0,y:0,w:1,h:1}}>אפס חיתוך</sw-button>
            <span class="note">התצוגה כבר מסובבת; המלבן המקווקו הוא בדיוק מה שיישמר. אפשר גם להזין אחוזים.</span>
          </div>
          <div class="two">
            <sw-field label="שמאל %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(t.x*100))} @change=${i=>this.setCrop("x",Number(i.target.value))} /></sw-field>
            <sw-field label="עליון %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(t.y*100))} @change=${i=>this.setCrop("y",Number(i.target.value))} /></sw-field>
            <sw-field label="רוחב %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(t.w*100))} @change=${i=>this.setCrop("w",Number(i.target.value))} /></sw-field>
            <sw-field label="גובה %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(t.h*100))} @change=${i=>this.setCrop("h",Number(i.target.value))} /></sw-field>
          </div>`}case 3:return r`
          <sw-field label="קומה"><input .value=${this.floor?.floor.name??""} disabled /></sw-field>
          <sw-field label="הערות לגרסה (אופציונלי)" hint="למשל: תוכנית מעודכנת אחרי שיפוץ 2026"><input .value=${this.notes} @input=${t=>this.notes=t.target.value} /></sw-field>
          <div class="note">קנה מידה (מטרים לפיקסל) יכויל בעורך בשתי נקודות ומרחק ידוע; עד אז מרחקים מוצגים כמשוערים.</div>`;default:return r`
          ${this.version?r`<div class="ok">✓ הגרסה נשמרה (${this.version.width_px}×${this.version.height_px} px) · ${this.version.status==="published"?"פורסמה — היא הרקע של הקומה":"טיוטה — עורכי הקומה רואים אותה, צופים עדיין לא"}</div>
                <div class="preview" style="min-block-size:220px"><img src=${tt(this.version.image_url)} alt="רקע התוכנית" /></div>`:r`<div class="note">סיכום: ${e?.original_name} · עמוד ${this.page} · סיבוב ${this.rotation}° · חיתוך ${Math.round(this.crop.w*100)}%×${Math.round(this.crop.h*100)}%. השמירה מייצרת רקע נגזר; המקור לא משתנה.</div>`}
          <div class="row">
            ${this.version?c:r`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.save()}>שמור כטיוטה</sw-button>`}
            ${this.version&&this.version.status==="draft"?r`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.publish()}>פרסום</sw-button>`:c}
            ${this.version?r`<sw-button icon="map" @click=${()=>b(`/explore/floors/${this.floorId}`)}>פתח במפה</sw-button><sw-button variant="ghost" icon="edit" @click=${()=>b(`/explore/floors/${this.floorId}/edit`)}>הצב מצלמות</sw-button>`:c}
          </div>`}}renderDemo(){return r`<sw-card><sw-state-panel state="empty" heading="ייבוא תוכנית עובד מול השרת" hint="בתצוגת ההדגמה אין שרת מחובר. בהתקנה ב־Home Assistant המסך מעלה PDF/PNG, בוחר עמוד, מסובב וחותך, ומפרסם גרסה."></sw-state-panel></sw-card>`}render(){const e=this.floor,t=this.step===0?!!this.asset:this.step===1?!!this.asset:!0;return r`
      <sw-page heading=${e?`ייבוא תוכנית ל${e.floor.name}`:"ייבוא תוכנית"} subheading="המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת" crumbs=${e?`אתרים | ${e.site.name} | ${e.building.name} | ${e.floor.name}`:"אתרים"}>
        ${g()?!this.floorId||this.tree&&!e?r`<sw-state-panel state="empty" heading="בחר קומה" hint="ייבוא תוכנית מתחיל מדף הקומות."><div style="margin-block-start:10px"><sw-button variant="primary" @click=${()=>b("/explore/sites")}>לאתרים</sw-button></div></sw-state-panel>`:r`
                <sw-card><sw-steps .steps=${fi} .current=${this.step}></sw-steps></sw-card>
                <div class="layout">
                  <div class="stage">${this.renderStep()}${this.error?r`<div class="err">${this.error}</div>`:c}</div>
                  <div class="side">
                    <sw-card heading="קובץ">
                      ${this.asset?r`<div class="note">${this.asset.original_name}</div><div class="row" style="margin-block-start:6px"><sw-badge kind="neutral" label=${`${this.asset.mime.split("/")[1].toUpperCase()} · ${Sa(this.asset.bytes)} · ${this.asset.page_count} עמ׳`}></sw-badge></div><div class="note ltr" style="margin-block-start:6px">sha256 ${this.asset.sha256.slice(0,16)}…</div>`:r`<div class="note">עדיין לא נבחר קובץ.</div>`}
                    </sw-card>
                    ${this.renderDxf()}
                    <sw-card heading="בטיחות">
                      <div class="note">הקובץ מזוהה לפי תוכנו; PDF מרונדר בתהליך נפרד עם מגבלת זמן; SVG נדחה עד sanitization. תוכן טקסטואלי בתוך הקובץ הוא נתון בלבד.</div>
                    </sw-card>
                    <div class="foot">
                      <sw-button variant="ghost" icon="chevron" ?disabled=${this.step===0||this.busy} @click=${()=>this.step=Math.max(0,this.step-1)}>הקודם</sw-button>
                      ${this.step<fi.length-1?r`<sw-button variant="primary" ?disabled=${!t||this.busy} @click=${()=>this.step=Math.min(fi.length-1,this.step+1)}>הבא</sw-button>`:c}
                    </div>
                  </div>
                </div>`:this.renderDemo()}
      </sw-page>
    `}};J.styles=z`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stage {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: 14px;
      min-block-size: 360px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .drop {
      flex: 1;
      min-block-size: 300px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    .drop.over,
    .drop:hover {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .drop .ic {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .drop small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 4px;
    }
    input[type='file'] {
      display: none;
    }
    .pages {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
    .pg {
      border: 1.5px solid var(--sw-border);
      border-radius: 8px;
      padding: 6px;
      background: var(--sw-surface);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pg.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .pg img {
      inline-size: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      background: #f3f5f9;
      border-radius: 4px;
      display: block;
      margin-block-end: 4px;
    }
    .preview {
      position: relative;
      flex: 1;
      min-block-size: 320px;
      background: #f3f5f9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    .preview .frame {
      position: relative;
      display: inline-block;
      line-height: 0;
      cursor: crosshair;
      touch-action: none;
      user-select: none;
      overflow: hidden;
    }
    .preview .frame img {
      max-inline-size: 100%;
      max-block-size: 420px;
      display: block;
      pointer-events: none;
    }
    .preview .cropbox {
      position: absolute;
      border: 2px dashed var(--sw-accent);
      box-shadow: 0 0 0 9999px rgba(17, 24, 39, 0.28);
      pointer-events: none;
      box-sizing: border-box;
    }
    .preview .hint {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      background: rgba(17, 24, 39, 0.7);
      color: #fff;
      font-size: var(--sw-fs-xs);
      border-radius: 6px;
      padding: 3px 8px;
      line-height: 1.4;
      pointer-events: none;
    }
    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
    }
    .assets button {
      display: flex;
      justify-content: space-between;
      inline-size: 100%;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
      margin-block-end: 4px;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;ie([m()],J.prototype,"floorId",2);ie([d()],J.prototype,"step",2);ie([d()],J.prototype,"tree",2);ie([d()],J.prototype,"assets",2);ie([d()],J.prototype,"asset",2);ie([d()],J.prototype,"page",2);ie([d()],J.prototype,"rotation",2);ie([d()],J.prototype,"crop",2);ie([d()],J.prototype,"notes",2);ie([d()],J.prototype,"version",2);ie([d()],J.prototype,"busy",2);ie([d()],J.prototype,"error",2);ie([d()],J.prototype,"dragOver",2);ie([d()],J.prototype,"dxf",2);ie([d()],J.prototype,"dxfLayers",2);ie([d()],J.prototype,"dxfUnits",2);ie([d()],J.prototype,"dxfBusy",2);ie([d()],J.prototype,"previewBust",2);J=ie([S("explore-plan-import")],J);const wi={white:"לבן",tint:"גוון לכל חדר",none:"ללא מילוי"};async function jl(e,t){const s=await M(`plan-versions/${e}/stylize`,t);return{...s,source_url:tt(s.source_url)+`?v=${Date.now()}`,stylized_url:tt(s.stylized_url)+`?v=${Date.now()}`}}const Fl=(e,t)=>He(`plan-versions/${e}`,{render_mode:t});var Wl=Object.defineProperty,Ul=Object.getOwnPropertyDescriptor,D=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ul(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Wl(t,s,a),a};const Rs=["#2767ED","#22A06B","#F59E0B","#8B5CF6","#0EA5E9","#EC4899","#14B8A6","#F97316"],Zl=[{id:"select",icon:"target",label:"בחירה וגרירה",ready:!0},{id:"camera",icon:"camera",label:"הוספת מצלמה",ready:!0},{id:"lights",icon:"light",label:"הוספת תאורה (מפסקים)",ready:!0},{id:"entity",icon:"plus",label:"ישות HA אחרת",ready:!0},{id:"zones",icon:"map",label:"חדרים ואזורים",ready:!0},{id:"layers",icon:"layers",label:"שכבות",ready:!0}],Ma=[{id:"cameras",label:"מצלמות"},{id:"doors",label:"דלתות ומנעולים"},{id:"lights",label:"תאורה ומתגים"},{id:"sensors",label:"חיישנים"}],ql={asset:"קובץ",page:"עמוד",rotation:"סיבוב",crop:"חיתוך",width_px:"רוחב",height_px:"גובה"},vi=e=>e?new Intl.DateTimeFormat("he-IL",{dateStyle:"short",timeStyle:"short"}).format(new Date(e)):"";let O=class extends x{constructor(){super(...arguments),this.floorId="",this.presetEntity="",this.bundle=null,this.anchors=[],this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId=null,this.tool="select",this.layers=new Set(["cameras","doors","lights","sensors"]),this.placing=null,this.entQ="",this.entResults=null,this.entBusy=!1,this.lightsAll=!1,this.busy=!1,this.error="",this.info="",this.stylizing=!1,this.stylized=null,this.stylizeOpts={strength:"medium",keepLines:!1,roomFill:"white"},this.zones=[],this.versions=[],this.diff=null,this.selectedZoneId=null,this.candidates=null,this.detecting=!1,this.detectStrength="medium",this.replaceAuto=!0,this.drawing=null,this.showZones=!0,this.zoneBusy=!1,this.entTimer=0,this.onKey=e=>this.handleKey(e)}connectedCallback(){super.connectedCallback(),this.load(),window.addEventListener("keydown",this.onKey),this.presetEntity&&(this.tool="entity",this.entQ=this.presetEntity,this.searchEntities())}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey)}async realign(e){if(!(!this.bundle||this.busy)){this.busy=!0;try{const t=await No(this.bundle.floorId,e);this.error=t.moved||!t.skipped?"":`${t.skipped} פריטים לא ניתנים ליישור אוטומטי (שרטוט אחר) — בדוק אותם ולחץ "אשר מיקומים".`,await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}}async load(){this.error="";try{const e=await ks(this.floorId||"f0",!0);this.bundle=e,this.anchors=e.anchors.map(t=>({...t,position:{...t.position}})),this.zones=e.zones,this.loadVersions(),this.selectedZoneId&&!this.zones.some(t=>t.id===this.selectedZoneId)&&(this.selectedZoneId=null),this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId&&!this.anchors.some(t=>t.id===this.selectedId)&&(this.selectedId=null)}catch(e){this.error=w(e)}}get selected(){return this.anchors.find(e=>e.id===this.selectedId)}layerOf(e){return e.resource_type==="camera"?"cameras":e.layer_id==="doors"?"doors":e.layer_id==="lights"?"lights":"sensors"}get markers(){return this.anchors.filter(e=>this.layers.has(this.layerOf(e))).map(e=>({id:e.id,kind:e.resource_type==="camera"?"camera":oi(e.layer_id,e.entity?.domain),label:this.anchorName(e),x:e.position.x,y:e.position.y,rotation:e.rotation_degrees,fov:e.field_of_view_degrees??void 0,radius:e.coverage_radius??void 0,polygon:e.coverage_polygon?e.coverage_polygon.map(([t,s])=>({x:t,y:s})):void 0,labelPos:e.label_pos??void 0,state:e.resource_type==="camera"?this.bundle?.source==="demo"?"live":ps(e):"neutral"}))}anchorName(e){return e.resource_type==="camera"?e.camera?.name??e.label??e.resource_id:e.label??e.entity?.name??e.resource_id}get selectedZone(){return this.zones.find(e=>e.id===this.selectedZoneId)}get planZones(){if(!this.showZones)return[];const e=this.zones.map(s=>({id:s.id,name:s.name,kind:s.kind,color:s.color,polygon:s.polygon,labelPos:s.label_pos})),t=(this.candidates??[]).map((s,i)=>({id:`cand-${i}`,name:s.include?s.name:"",color:s.include?Rs[i%Rs.length]:"#9AA3B5",polygon:s.polygon,candidate:!0}));return[...e,...t]}async detect(){const e=this.bundle;if(e){if(e.source==="demo"){this.info="נתוני הדגמה: הזיהוי עובד מול השרת.";return}this.detecting=!0,this.error="";try{const t=await nl(e.floorId,this.detectStrength);this.candidates=t.rooms.map((s,i)=>({polygon:s.polygon,name:`חדר ${i+1}`,kind:"room",include:!0})),this.selectedZoneId=null,this.selectedId=null,this.info=t.rooms.length?`${t.rooms.length} חדרים זוהו · תן שמות ושמור`:"לא זוהו חדרים סגורים; נסה עוצמה אחרת או צייר אזור ידנית",setTimeout(()=>this.info="",5e3)}catch(t){this.error=w(t)}finally{this.detecting=!1}}}setCandidate(e,t){this.candidates&&(this.candidates=this.candidates.map((s,i)=>i===e?{...s,...t}:s))}async acceptCandidates(){const e=this.bundle,t=(this.candidates??[]).filter(s=>s.include);if(!(!e||!t.length)){this.zoneBusy=!0,this.error="";try{const s=await ol(e.floorId,t.map(i=>({polygon:i.polygon,name:i.name,kind:i.kind})),this.replaceAuto);this.candidates=null,this.zones=s.zones,this.info=`${s.created.length} חדרים נשמרו`,setTimeout(()=>this.info="",3e3)}catch(s){this.error=w(s)}finally{this.zoneBusy=!1}}}startDrawing(){this.drawing=[],this.placing=null,this.candidates=null,this.selectedZoneId=null,this.selectedId=null}addDraftPoint(e,t){const s=this.drawing,i=this.bundle;if(!(!s||!i)){if(s.length>=3){const a=this.canvas?.zoom??1;if(Math.hypot((e-s[0].x)*i.width*a,(t-s[0].y)*i.height*a)<12){this.finishDrawing();return}}this.drawing=[...s,{x:+e.toFixed(4),y:+t.toFixed(4)}]}}async finishDrawing(){const e=this.drawing,t=this.bundle;if(!(!e||!t||e.length<3)){if(t.source==="demo"){this.info="נתוני הדגמה: השמירה עובדת מול השרת.",this.drawing=null;return}this.zoneBusy=!0,this.error="";try{const s=await il(t.floorId,{name:`אזור ${this.zones.length+1}`,kind:"zone",polygon:e});this.drawing=null,this.zones=[...this.zones,s],this.selectedZoneId=s.id,this.info="האזור נוצר · תן לו שם",setTimeout(()=>this.info="",3e3)}catch(s){this.error=w(s)}finally{this.zoneBusy=!1}}}async patchZone(e,t){if(this.bundle?.source!=="demo"){this.zoneBusy=!0,this.error="";try{const s=await al(e.id,{revision:e.revision,...t});this.zones=this.zones.map(i=>i.id===s.id?s:i)}catch(s){s instanceof be&&s.status===409?(this.error="האזור השתנה בינתיים על ידי עורך אחר; נטען מחדש בלי לדרוס.",await this.load()):this.error=w(s)}finally{this.zoneBusy=!1}}}async removeZone(e){if(this.bundle?.source!=="demo"&&window.confirm(`למחוק את "${e.name}"? המצלמות והישויות בקומה לא מושפעות.`)){this.zoneBusy=!0,this.error="";try{await rl(e.id),this.zones=this.zones.filter(t=>t.id!==e.id),this.selectedZoneId===e.id&&(this.selectedZoneId=null)}catch(t){this.error=w(t)}finally{this.zoneBusy=!1}}}snapshot(){this.undo=[...this.undo.slice(-40),this.anchors.map(e=>({...e,position:{...e.position}}))],this.redo=[]}apply(e,t){this.snapshot(),this.anchors=this.anchors.map(s=>s.id===e?{...s,...t,position:t.position??s.position}:s),this.dirty=new Set(this.dirty).add(e)}nudge(e,t){const s=this.selected;s&&this.apply(s.id,{position:{x:+Math.min(1,Math.max(0,s.position.x+e)).toFixed(4),y:+Math.min(1,Math.max(0,s.position.y+t)).toFixed(4)}})}doUndo(){const e=this.undo[this.undo.length-1];e&&(this.redo=[...this.redo,this.anchors],this.undo=this.undo.slice(0,-1),this.anchors=e,this.dirty=new Set(this.anchors.map(t=>t.id)))}doRedo(){const e=this.redo[this.redo.length-1];e&&(this.undo=[...this.undo,this.anchors],this.redo=this.redo.slice(0,-1),this.anchors=e,this.dirty=new Set(this.anchors.map(t=>t.id)))}handleKey(e){const t=e.composedPath()[0],s=t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable);if(e.key==="Escape"){this.drawing?this.drawing=null:this.placing?this.placing=null:this.candidates?this.candidates=null:(this.selectedId=null,this.selectedZoneId=null);return}if(s)return;if(e.key==="Enter"&&this.drawing){e.preventDefault(),this.finishDrawing();return}if((e.key==="Delete"||e.key==="Backspace")&&!this.selected&&this.selectedZone){e.preventDefault(),this.removeZone(this.selectedZone);return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault(),e.shiftKey?this.doRedo():this.doUndo();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault(),this.doRedo();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault(),this.save();return}if(!this.selected)return;const i=e.shiftKey?.01:.002;e.key==="ArrowLeft"?(e.preventDefault(),this.nudge(-i,0)):e.key==="ArrowRight"?(e.preventDefault(),this.nudge(i,0)):e.key==="ArrowUp"?(e.preventDefault(),this.nudge(0,-i)):e.key==="ArrowDown"?(e.preventDefault(),this.nudge(0,i)):(e.key==="Delete"||e.key==="Backspace")&&(e.preventDefault(),this.removeSelected())}async save(){if(!this.bundle||this.bundle.source==="demo")return this.info="נתוני הדגמה: השינויים נשמרים רק במסך זה.",this.dirty=new Set,!0;if(!this.dirty.size)return!0;this.busy=!0,this.error="";let e=!1;try{for(const t of this.dirty){const s=this.anchors.find(i=>i.id===t);if(s)try{const i=await kr(t,{revision:s.revision,x:s.position.x,y:s.position.y,rotation_degrees:s.rotation_degrees,field_of_view_degrees:s.field_of_view_degrees,label:s.label,coverage_radius:s.coverage_radius??null,coverage_polygon:s.coverage_polygon??null,label_pos:s.label_pos??"auto"});this.anchors=this.anchors.map(a=>a.id===t?{...a,revision:i.revision}:a)}catch(i){if(i instanceof be&&i.code==="stale_revision")e=!0;else throw i}}return e?(this.error="חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.",await this.load(),!1):(this.dirty=new Set,this.info="המיקומים נשמרו",setTimeout(()=>this.info="",2500),!0)}catch(t){return this.error=w(t),!1}finally{this.busy=!1}}async place(e,t){const s=this.placing;if(!(!s||!this.bundle)){if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הוספה עובדת מול השרת.",this.placing=null;return}if(!(this.dirty.size&&!await this.save())){this.busy=!0,this.error="";try{const i=s.kind==="camera"?await xa(this.bundle.floorId,{resource_type:"camera",resource_id:s.camera.id,x:e,y:t,rotation_degrees:0,field_of_view_degrees:90}):await xa(this.bundle.floorId,{resource_type:"ha_entity",resource_id:s.entity.entity_id,x:e,y:t,rotation_degrees:0,field_of_view_degrees:null});this.placing=null,await this.load(),this.selectedId=i.id,this.tool="select",this.info=`${this.anchorName(i)} הוצב · גרור לדיוק, קבע כיוון בידיות`,setTimeout(()=>this.info="",4e3)}catch(i){this.error=w(i)}finally{this.busy=!1}}}}async removeSelected(){const e=this.selected;if(!(!e||!this.bundle)){if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הסרה עובדת מול השרת.";return}if(window.confirm(`להסיר את "${this.anchorName(e)}" מהמפה? המקור עצמו לא נמחק.`)){this.busy=!0,this.error="";try{await Bo(e.id),this.selectedId=null,await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}}}async loadVersions(){const e=this.bundle;if(!e||e.source==="demo"||!e.permissions.edit){this.versions=[];return}try{this.versions=(await To(e.floorId)).versions}catch{this.versions=[]}}async publish(){if(!this.bundle?.planVersionId||this.dirty.size&&!await this.save())return;const e=this.versions.find(t=>t.id===this.bundle?.planVersionId);if(!e){await this.publishNow(this.bundle.planVersionId);return}await this.openDiff("publish",e)}async publishNow(e){this.busy=!0,this.error="";try{await Ri(e),this.info="הגרסה פורסמה; הצופים רואים אותה עכשיו",await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}async openDiff(e,t){this.diff={mode:e,version:t,data:null,error:""};try{const s=await Do(t.id);this.diff?.version.id===t.id&&(this.diff={mode:e,version:t,data:s,error:""})}catch(s){this.diff={mode:e,version:t,data:null,error:w(s)}}}async confirmDiff(){const e=this.diff;if(!(!e?.data||e.mode==="compare")){this.busy=!0,this.error="";try{e.mode==="publish"?(await Ri(e.version.id),this.info="הגרסה פורסמה; הצופים רואים אותה עכשיו"):(await Ro(e.version.id,e.version.revision,e.data.from?.id??null),this.info="הגרסה שוחזרה ופורסמה מחדש; העוגנים נשמרו"),this.diff=null,await this.load(),setTimeout(()=>this.info="",4e3)}catch(t){this.diff={...e,error:w(t)},t instanceof be&&t.status===409&&this.loadVersions()}finally{this.busy=!1}}}async searchEntities(){if(this.bundle?.source!=="demo"){this.entBusy=!0;try{const e=this.tool==="lights",t=await Ir({q:this.entQ||void 0,domain:e&&!this.lightsAll?"switch":void 0,limit:e?200:40});this.entResults=e?t.entities.filter(s=>s.domain==="switch"||this.lightsAll&&s.domain==="light").slice(0,60):t.entities}catch(e){this.error=w(e),this.entResults=[]}finally{this.entBusy=!1}}}onEntQuery(e){this.entQ=e,window.clearTimeout(this.entTimer),this.entTimer=window.setTimeout(()=>void this.searchEntities(),250)}async stylize(e,t){if(!this.bundle?.planVersionId||this.bundle.source==="demo")return;const s=this.stylizeOpts;(e!==void 0||t!==void 0)&&(this.stylizeOpts={...s,strength:e??s.strength,keepLines:t??s.keepLines}),this.stylizing=!0,this.error="";try{this.stylized=await jl(this.bundle.planVersionId,{strength:this.stylizeOpts.strength,keep_lines:this.stylizeOpts.keepLines,room_fill:this.stylizeOpts.roomFill})}catch(i){this.error=w(i)}finally{this.stylizing=!1}}async useRender(e){if(this.bundle?.planVersionId){this.busy=!0,this.error="";try{await Fl(this.bundle.planVersionId,e),this.stylized=null,await this.load(),this.info=e==="stylized"?"המפה מציגה עכשיו את שפת SMPLWISE":"המפה מציגה את תוכנית המקור",setTimeout(()=>this.info="",3e3)}catch(t){this.error=w(t)}finally{this.busy=!1}}}pickTool(e){this.tool=e,this.placing=null,(e==="entity"||e==="lights")&&(this.entResults=null,this.searchEntities())}renderCoverage(e){const t=e.coverage_polygon,s=e.coverage_radius??0,i=Math.round((s||.1)*100),a=()=>{const n=e.field_of_view_degrees??90,o=s||.1,l=this.bundle&&this.bundle.height?this.bundle.width/this.bundle.height:1,p=[[e.position.x,e.position.y]],f=Math.max(3,Math.round(n/15));for(let u=0;u<=f;u++){const v=(e.rotation_degrees-n/2+n*u/f-90)*Math.PI/180;p.push([+Math.max(0,Math.min(1,e.position.x+Math.cos(v)*o)).toFixed(4),+Math.max(0,Math.min(1,e.position.y+Math.sin(v)*o*l)).toFixed(4)])}this.apply(e.id,{coverage_polygon:p})};return r`<div class="row" data-coverage style="flex-direction:column;align-items:stretch;gap:6px">
      <span class="lbl">שטח כיסוי${t?" · מצולע ידני":""}<span class="muted">${t?`${t.length} נקודות · גרירה מזיזה, לחיצה על נקודת אמצע מוסיפה, לחיצה כפולה מסירה`:"שני מחוונים נפרדים לגמרי זה מזה: רוחב (כמה ימינה ושמאלה, שווה לשני הצדדים) ומרחק (עד איפה המצלמה רואה). אפשר גם לגרור את הידיות על המפה."}</span></span>
      ${t?c:r`<label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-width>רוחב
          <input type="range" min="10" max="180" step="1" style="flex:1" .value=${String(Math.round(e.field_of_view_degrees??90))} aria-label="רוחב שדה הראייה" @input=${n=>this.apply(e.id,{field_of_view_degrees:Number(n.target.value)})} />
          <span class="ltr" style="min-inline-size:64px">${Math.round((e.field_of_view_degrees??90)/2)}° לכל צד</span></label>
        <label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-distance>מרחק
          <input type="range" min="2" max="100" step="1" style="flex:1" .value=${String(i)} aria-label="מרחק ראייה" @input=${n=>this.apply(e.id,{coverage_radius:Number(n.target.value)/100})} />
          <input type="number" step="1" min="2" max="100" data-ltr data-coverage-radius style="inline-size:56px" .value=${String(i)} aria-label="מרחק ראייה, אחוז מדויק" @change=${n=>this.apply(e.id,{coverage_radius:Math.min(1,Math.max(.02,Number(n.target.value)/100))})} />
          <span class="ltr" style="min-inline-size:24px">%</span></label>`}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${t?r`<sw-button size="sm" icon="undo" data-coverage-cone @click=${()=>this.apply(e.id,{coverage_polygon:null})}>חזרה לקשת</sw-button>`:r`${s?r`<sw-button size="sm" variant="ghost" @click=${()=>this.apply(e.id,{coverage_radius:null})}>מרחק לברירת מחדל</sw-button>`:c}
            <sw-button size="sm" icon="edit" data-coverage-polygon @click=${a}>כיסוי ידני (מצולע)</sw-button>`}
      </div>
    </div>`}renderCameraInspector(e){const t=e.camera,s=e.field_of_view_degrees??0;return r`<sw-card heading="הגדרות מצלמה" subheading="גרירה במפה, ידיות לכיוון ולשדה הראייה, או הזנה מדויקת">
      <div class="kv"><span class="k">מצלמה</span><strong>${this.anchorName(e)}</strong></div>
      <div class="kv"><span class="k">מקור</span><span class="ltr">${t?`NVR · ch ${t.channel}`:e.resource_id}</span></div>
      <sw-field label="כיוון מבט (°)" style="margin-block-start:10px"><input type="number" step="1" min="0" max="359" data-ltr .value=${String(Math.round(e.rotation_degrees))} @change=${i=>this.apply(e.id,{rotation_degrees:(Number(i.target.value)%360+360)%360})} /></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(e.position.x*100).toFixed(1)} @change=${i=>this.apply(e.id,{position:{x:Math.min(1,Math.max(0,Number(i.target.value)/100)),y:e.position.y}})} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(e.position.y*100).toFixed(1)} @change=${i=>this.apply(e.id,{position:{x:e.position.x,y:Math.min(1,Math.max(0,Number(i.target.value)/100))}})} /></sw-field>
      </div>
      <sw-field label="תווית (אופציונלי)"><input .value=${e.label??""} @change=${i=>this.apply(e.id,{label:i.target.value||null})} /></sw-field>
      <sw-field label="מיקום התווית"><select data-label-pos @change=${i=>this.apply(e.id,{label_pos:i.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([i,a])=>r`<option value=${i} ?selected=${(e.label_pos??"auto")===i}>${a}</option>`)}</select></sw-field>
      ${s?this.renderCoverage(e):c}
      <div class="row"><span class="lbl">הצג כיסוי משוער<span class="muted">זווית לתכנון, לא מדידת כיסוי בפועל</span></span><sw-toggle ?checked=${!!s} label=${s?"מוצג":"מוסתר"} @click=${()=>this.apply(e.id,{field_of_view_degrees:s?null:90})}></sw-toggle></div>
      <div class="row"><span class="lbl">0° = למעלה, עם כיוון השעון<span class="muted">שינוי כיוון במפה אינו פקודת PTZ למצלמה</span></span></div>
      <div class="note" style="margin-block-start:6px">revision ${e.revision}${this.dirty.has(e.id)?" · שינויים לא שמורים":""} · חצים = הזזה עדינה (Shift = גדולה) · Delete = הסרה</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size||this.busy} @click=${()=>this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`}renderEntityInspector(e){const t=e.entity;return r`<sw-card heading="הגדרות ישות" subheading="הצבה בלבד; שליטה דורשת הרשאה נפרדת">
      <div class="kv"><span class="k">ישות</span><strong>${this.anchorName(e)}</strong></div>
      <div class="kv"><span class="k">מזהה</span><span class="ltr">${e.resource_id}</span></div>
      ${t?r`<div class="kv"><span class="k">מצב עכשיו</span><span>${vt(t)}</span></div><div class="kv"><span class="k">סוג</span><span>${_s(t.domain)}</span></div>`:c}
      <sw-field label="שכבה" style="margin-block-start:8px"><select @change=${s=>this.apply(e.id,{layer_id:s.target.value})}>${Ma.filter(s=>s.id!=="cameras").map(s=>r`<option value=${s.id} ?selected=${e.layer_id===s.id}>${s.label}</option>`)}</select></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(e.position.x*100).toFixed(1)} @change=${s=>this.apply(e.id,{position:{x:Math.min(1,Math.max(0,Number(s.target.value)/100)),y:e.position.y}})} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(e.position.y*100).toFixed(1)} @change=${s=>this.apply(e.id,{position:{x:e.position.x,y:Math.min(1,Math.max(0,Number(s.target.value)/100))}})} /></sw-field>
      </div>
      <sw-field label="שם במפה (ידני)"><input data-entity-name placeholder=${t?.name??e.resource_id} .value=${e.label??""} @change=${s=>this.apply(e.id,{label:s.target.value.trim()||null})} /></sw-field>
      <sw-field label="מיקום התווית"><select data-label-pos @change=${s=>this.apply(e.id,{label_pos:s.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([s,i])=>r`<option value=${s} ?selected=${(e.label_pos??"auto")===s}>${i}</option>`)}</select></sw-field>
      <div class="note">ריק = השם מ־Home Assistant${t?.name?` („${t.name}“)`:""}. השם הידני מוצג במפה, ברשימת הצד ובכרטיס.</div>
      <div class="note" style="margin-block-start:6px">revision ${e.revision}${this.dirty.has(e.id)?" · שינויים לא שמורים":""}</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size||this.busy} @click=${()=>this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`}renderToolPanel(e){const t=new Set(this.anchors.map(s=>s.resource_id));if(this.tool==="camera"){const s=e.cameras.filter(i=>!t.has(i.id));return r`<sw-card heading="הוספת מצלמה" subheading="בחר מצלמה ואז לחץ על התוכנית במקום המבוקש">
        ${s.length?r`<div class="list">${s.map(i=>r`<button class=${this.placing?.kind==="camera"&&this.placing.camera.id===i.id?"on":""} @click=${()=>this.placing={kind:"camera",camera:i}}><span>${i.name}</span><span class="ltr">ch ${i.channel} · ${i.status}</span></button>`)}</div>`:r`<div class="note">${e.cameras.length?"כל המצלמות הרשומות כבר מוצבות על הקומה.":"אין מצלמות רשומות עדיין; הגילוי מה־NVR רץ אוטומטית."}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${()=>b("/system/devices")}>למצלמות</sw-button></div>`}
      </sw-card>`}if(this.tool==="entity"||this.tool==="lights"){const s=this.tool==="lights",i=(this.entResults??[]).filter(a=>!t.has(a.entity_id));return r`<sw-card heading=${s?"הוספת תאורה":"הוספת ישות Home Assistant אחרת"} subheading=${s?"מפסקים (switch) מהקטלוג; לחץ על התוכנית להצבה. השם ניתן לשינוי אחרי ההצבה.":"כל ישות אחרת בקטלוג (דלתות, חיישנים, מזגנים…) ואז לחיצה על התוכנית"} data-tool-panel=${this.tool}>
        <sw-field><input type="search" placeholder=${s?"חיפוש מפסק לפי שם או אזור":"חיפוש לפי שם, entity_id או אזור"} data-ltr .value=${this.entQ} @input=${a=>this.onEntQuery(a.target.value)} /></sw-field>
        ${s?r`<label class="note" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-lights-all .checked=${this.lightsAll} @change=${a=>{this.lightsAll=a.target.checked,this.searchEntities()}} /> להציג גם ישויות light (נורות חכמות)</label>`:c}
        ${e.source==="demo"?r`<div class="note">נתוני הדגמה: החיפוש עובד מול השרת.</div>`:this.entBusy&&!this.entResults?r`<div class="note">מחפש…</div>`:i.length?r`<div class="list">${i.map(a=>r`<button class=${this.placing?.kind==="entity"&&this.placing.entity.entity_id===a.entity_id?"on":""} @click=${()=>this.placing={kind:"entity",entity:a}}><span>${a.name||a.original_name||a.entity_id}<div class="note" style="margin:0">${_s(a.domain)}${a.area_name?` · ${a.area_name}`:""} · ${vt(a)}</div></span><span class="ltr">${a.entity_id}</span></button>`)}</div>`:r`<div class="note">${this.entResults?"לא נמצאו ישויות (או שכולן כבר מוצבות).":""}</div>`}
      </sw-card>`}return this.tool==="layers"?r`<sw-card heading="שכבות" subheading="מה מוצג בעורך (לא משפיע על הצופים)">
        <div class="layerlist">${Ma.map(s=>r`<label><input type="checkbox" .checked=${this.layers.has(s.id)} @change=${i=>{const a=new Set(this.layers);i.target.checked?a.add(s.id):a.delete(s.id),this.layers=a}} /> ${s.label} <span class="note">(${this.anchors.filter(i=>this.layerOf(i)===s.id).length})</span></label>`)}
          <label><input type="checkbox" .checked=${this.showZones} @change=${s=>this.showZones=s.target.checked} /> חדרים ואזורים <span class="note">(${this.zones.length})</span></label></div>
      </sw-card>`:this.tool==="zones"?this.renderZonesPanel(e):r`<sw-card heading="מאפיינים"><div class="note">בחר סיכה במפה כדי לערוך אותה, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה; הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.</div></sw-card>`}renderZoneInspector(e){const t=this.anchors.filter(i=>i.resource_type==="camera"&&us(i.position,e.polygon)),s=this.anchors.filter(i=>i.resource_type!=="camera"&&us(i.position,e.polygon));return r`<div class="zone-insp" data-zone-inspector>
      <sw-field label="שם"><input .value=${e.name} placeholder="למשל: לובי, מחסן, חדר ישיבות" @change=${i=>this.patchZone(e,{name:i.target.value})} /></sw-field>
      <div class="two">
        <sw-field label="סוג"><select @change=${i=>this.patchZone(e,{kind:i.target.value})}>${Ni.map(i=>r`<option value=${i.id} ?selected=${e.kind===i.id}>${i.label}</option>`)}</select></sw-field>
        <sw-field label="צבע"><input type="color" data-ltr .value=${e.color} @change=${i=>this.patchZone(e,{color:i.target.value})} /></sw-field>
      </div>
      <sw-field label="מיקום שם החדר"><select data-zone-label-pos @change=${i=>this.patchZone(e,{label_pos:i.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([i,a])=>r`<option value=${i} ?selected=${(e.label_pos??"auto")===i}>${a}</option>`)}</select></sw-field>
      <div class="kv"><span class="k">מצלמות באזור</span><span>${t.length?t.map(i=>this.anchorName(i)).join(", "):"אין"}</span></div>
      <div class="kv"><span class="k">ישויות HA באזור</span><span>${s.length?`${s.length} ישויות`:"אין"}</span></div>
      <div class="row"><span class="lbl">הכללה בחיפוש מרחבי<span class="muted">זמין לחוקי התראה ולחיפוש לפי מקום</span></span><sw-toggle ?checked=${e.searchable} label=${e.searchable?"כלול":"לא כלול"} @click=${()=>this.patchZone(e,{searchable:!e.searchable})}></sw-toggle></div>
      <div class="note">${e.polygon.length} פינות · ${e.source==="auto"?"זוהה אוטומטית מהתוכנית":"צויר ידנית"} · revision ${e.revision}</div>
      <div class="note">עריכת הצורה במפה: גרירת פינה מזיזה אותה, גרירת נקודת האמצע שבין פינות מוסיפה פינה, לחיצה כפולה על פינה מוחקת אותה. השינוי נשמר מיד.</div>
      <div class="note">אזור במפה הוא הקשר מרחבי בלבד: אינו אזור זיהוי במצלמה ואינו מסכת פרטיות, ואינו משנה תצורת NVR.</div>
      <div class="btns"><sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.zoneBusy} @click=${()=>this.removeZone(e)}>מחק אזור</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.selectedZoneId=null}>סגור</sw-button></div>
    </div>`}renderZonesPanel(e){const t=this.candidates,s=this.selectedZone;return r`<sw-card heading="חדרים ואזורים" subheading="זיהוי מהתוכנית או ציור ידני; השמות מופיעים במפה">
      ${t?r`<div class="note">${t.length} חדרים זוהו · סמן, תן שם ושמור. הפוליגונים מוצגים במפה בקו מקווקו.</div>
            <div class="candlist">${t.map((i,a)=>r`<div class="cand" data-candidate><input type="checkbox" .checked=${i.include} aria-label="כלול" @change=${n=>this.setCandidate(a,{include:n.target.checked})} /><i class="sw" style="background:${Rs[a%Rs.length]}"></i><input class="name" .value=${i.name} placeholder="שם החדר" aria-label="שם החדר" @input=${n=>this.setCandidate(a,{name:n.target.value})} /><select aria-label="סוג" @change=${n=>this.setCandidate(a,{kind:n.target.value})}>${Ni.map(n=>r`<option value=${n.id} ?selected=${i.kind===n.id}>${n.label}</option>`)}</select></div>`)}</div>
            ${this.zones.some(i=>i.source==="auto")?r`<label class="chk"><input type="checkbox" .checked=${this.replaceAuto} @change=${i=>this.replaceAuto=i.target.checked} /> החלף את החדרים שזוהו אוטומטית בעבר (${this.zones.filter(i=>i.source==="auto").length})</label>`:c}
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.zoneBusy||!t.some(i=>i.include)} @click=${()=>this.acceptCandidates()}>שמור ${t.filter(i=>i.include).length} חדרים</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.candidates=null}>בטל</sw-button></div>`:this.drawing?r`<div class="note">לחץ על התוכנית להוספת פינות (${this.drawing.length} עד כה). לחיצה על הפינה הראשונה או Enter סוגרים את הצורה · Esc לביטול.</div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.drawing.length<3||this.zoneBusy} @click=${()=>this.finishDrawing()}>סיים אזור</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.drawing=null}>בטל</sw-button></div>`:r`<div class="row"><span class="lbl">זיהוי חדרים מהתוכנית<span class="muted">עיבוד מקומי של הקירות (ללא AI); החדרים מוצעים ואתה נותן להם שמות</span></span><select aria-label="עוצמת זיהוי" @change=${i=>this.detectStrength=i.target.value}><option value="light" ?selected=${this.detectStrength==="light"}>קל</option><option value="medium" ?selected=${this.detectStrength==="medium"}>בינוני</option><option value="strong" ?selected=${this.detectStrength==="strong"}>חזק</option></select></div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="map" ?disabled=${this.detecting||e.source==="demo"||e.planStatus==="none"} @click=${()=>this.detect()}>${this.detecting?"מזהה…":"זהה חדרים"}</sw-button><sw-button size="sm" icon="edit" ?disabled=${this.zoneBusy} @click=${()=>this.startDrawing()}>צייר אזור</sw-button></div>`}
      ${this.zones.length?r`<div class="note" style="margin-block-start:10px">${this.zones.length} אזורים בקומה · לחיצה בוחרת במפה</div>
            <div class="list">${this.zones.map(i=>r`<button class=${i.id===this.selectedZoneId?"on":""} data-zone-row @click=${()=>{this.selectedZoneId=i.id===this.selectedZoneId?null:i.id,this.selectedId=null}}><span><i class="sw" style="background:${i.color}"></i>${i.name}</span><span class="note" style="margin:0">${tl(i.kind)}${i.source==="auto"?" · אוטומטי":""}</span></button>`)}</div>`:t||this.drawing?c:r`<div class="note" style="margin-block-start:10px">עדיין אין חדרים או אזורים בקומה.</div>`}
      ${s?this.renderZoneInspector(s):c}
    </sw-card>`}renderVersionCard(e){const t=this.stylized;return r`<sw-card heading="גרסת תוכנית" subheading=${e.planStatus==="draft"?"טיוטה: צופים רואים את הגרסה הקודמת":e.planStatus==="published"?"גרסה מפורסמת":"אין תוכנית"}>
      ${e.planStatus==="none"?c:r`<div class="row"><span class="lbl">תצוגת המפה<span class="muted">${e.renderMode==="stylized"?"שפת SMPLWISE (עיבוד אוטומטי של המקור)":"תוכנית המקור כפי שהועלתה"}</span></span>${e.renderMode==="stylized"?r`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("source")}>הצג מקור</sw-button>`:e.stylizedAvailable?r`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>הצג שפת SMPLWISE</sw-button>`:c}</div>
          <div class="row"><span class="lbl">עיבוד לשפת SMPLWISE<span class="muted">בחר מה להשאיר מהתוכנית; המקור נשמר תמיד</span></span></div>
          <div class="two" data-stylize-opts>
            <sw-field label="עוצמת ניקוי"><select aria-label="עוצמת ניקוי" @change=${s=>this.stylizeOpts={...this.stylizeOpts,strength:s.target.value}}><option value="light" ?selected=${this.stylizeOpts.strength==="light"}>קל · קירות דקים נשמרים</option><option value="medium" ?selected=${this.stylizeOpts.strength==="medium"}>בינוני · קירות כפולים מאוחדים</option><option value="strong" ?selected=${this.stylizeOpts.strength==="strong"}>חזק · מדרגות וריהוט לגושים</option></select></sw-field>
            <sw-field label="מילוי חדרים"><select aria-label="מילוי חדרים" @change=${s=>this.stylizeOpts={...this.stylizeOpts,roomFill:s.target.value}}>${Object.keys(wi).map(s=>r`<option value=${s} ?selected=${this.stylizeOpts.roomFill===s}>${wi[s]}</option>`)}</select></sw-field>
          </div>
          <label class="chk"><input type="checkbox" .checked=${this.stylizeOpts.keepLines} @change=${s=>this.stylizeOpts={...this.stylizeOpts,keepLines:s.target.checked}} /> ריהוט, דלתות וקווים דקים מהתוכנית (בגוון עדין)</label>
          <div class="btns"><sw-button variant="primary" size="sm" icon="image" ?disabled=${this.stylizing||e.source==="demo"} @click=${()=>this.stylize()}>${this.stylizing?"מעבד…":"עבד תצוגה מקדימה"}</sw-button></div>
          ${t?r`<div class="compare" style="margin-block-start:8px"><div><div class="note">מקור</div><img src=${t.source_url} alt="תוכנית מקור" /></div><div><div class="note" data-stylize-caption>שפת SMPLWISE · ${t.rooms} חדרים · ${wi[t.room_fill]??t.room_fill} · ${t.keep_lines?"עם קווים דקים":"ללא קווים דקים"}</div><img src=${t.stylized_url} alt="שפת SMPLWISE" /></div></div>
              <div style="display:flex;gap:8px;margin-block-start:8px"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>השתמש בתוצאה</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.stylized=null}>סגור</sw-button></div>
              <div class="note" style="margin-block-start:6px">עיבוד תמונה מקומי (ללא AI וללא שליחה החוצה): קירות וחדרים מזוהים לפי עובי הקווים; חדרים אינם מזוהים בשמם. אפשר לחזור למקור בכל רגע.</div>`:c}`}
      ${this.renderVersionHistory(e)}
      <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${()=>b(`/explore/floors/${e.floorId}/import`)}>ייבוא תוכנית חדשה</sw-button></div>
    </sw-card>`}renderVersionHistory(e){return this.versions.length?r`<div class="row" style="margin-block-start:10px"><span class="lbl">היסטוריית גרסאות<span class="muted">כל פרסום נשמר; אפשר להשוות ולשחזר גרסה מהארכיון בלי לאבד עוגנים</span></span></div>
      <div class="vlist" data-version-list>
        ${this.versions.map(t=>{const s=t.id===e.planVersionId,i=t.status==="published"?"recorded":t.status==="draft"?"partial":"neutral",a=t.status==="published"?"מפורסמת":t.status==="draft"?"טיוטה":"ארכיון";return r`<div class="vrow ${s?"cur":""}" data-version-row data-version-id=${t.id} data-version-status=${t.status}>
            <img src=${tt(t.image_url)} alt="" loading="lazy" />
            <div class="meta">
              <span><sw-badge kind=${i} label=${a}></sw-badge> <span class="ltr">${vi(t.published_at??t.created_at)}</span></span>
              <span class="note">${t.width_px}×${t.height_px}${t.rotation?` · סיבוב ${t.rotation}°`:""}${t.crop?" · חיתוך":""} · ${t.anchors_on??0} פריטים${t.notes?` · ${t.notes}`:""}</span>
            </div>
            <div class="acts">
              ${t.status!=="published"?r`<sw-button size="sm" variant="ghost" data-version-compare ?disabled=${this.busy} @click=${()=>this.openDiff(t.status==="draft"&&e.permissions.publish?"publish":"compare",t)}>השווה</sw-button>`:c}
              ${t.status==="archived"&&e.permissions.publish?r`<sw-button size="sm" icon="history" data-version-rollback ?disabled=${this.busy} @click=${()=>this.openDiff("rollback",t)}>שחזר</sw-button>`:c}
            </div>
          </div>`})}
      </div>`:c}renderDiffDialog(){const e=this.diff;if(!e)return c;const t=e.data,s=e.mode==="publish"?"פרסום גרסה":e.mode==="rollback"?"שחזור גרסה מהארכיון":"השוואת גרסאות",i=e.mode==="publish"?"מה ישתנה לצופים ומה יקרה לפריטים המוצבים":e.mode==="rollback"?"הגרסה תפורסם מחדש כעותק חדש; הגרסה הנוכחית תעבור לארכיון":"מול הגרסה המפורסמת";return r`<sw-dialog open heading=${s} subheading=${i} data-diff-dialog @close=${()=>this.diff=null}>
      ${e.error?r`<div class="err" data-diff-error>${e.error}</div>`:c}
      ${t?r`<div class="compare">
              <div><div class="note">${t.from?`מפורסמת · ${vi(t.from.published_at??t.from.created_at)}`:"אין גרסה מפורסמת"}</div>${t.from?r`<img src=${tt(t.from.image_url)} alt="הגרסה המפורסמת" />`:r`<div class="note">—</div>`}</div>
              <div><div class="note">${e.mode==="rollback"?"לשחזור":"חדשה"} · ${vi(t.to.published_at??t.to.created_at)}</div><img src=${tt(t.to.image_url)} alt="הגרסה החדשה" /></div>
            </div>
            <div class="dsum" data-diff-summary>
              ${t.from?t.geometry.same?r`<sw-badge kind="recorded" label="גאומטריה זהה"></sw-badge>`:r`<sw-badge kind="partial" label=${`שינוי: ${t.geometry.changes.map(a=>ql[a.field]??a.field).join(", ")}`}></sw-badge>`:r`<sw-badge kind="neutral" label="פרסום ראשון"></sw-badge>`}
              <span>${t.anchors.total} פריטים מוצבים · ${t.anchors.carried} עוברים כמו שהם · ${t.anchors.needs_alignment} ידרשו יישור</span>
            </div>
            ${t.anchors.items.length?r`<div class="ditems" data-diff-items>${t.anchors.items.map(a=>r`<div><span>${a.resource_type==="camera"?"מצלמה":"ישות"} · ${a.name}</span><span class=${a.outcome==="carried"?"":"err"}>${a.outcome==="carried"?"עובר":"יישור נדרש"}</span></div>`)}</div>`:c}
            ${t.anchors.needs_alignment?r`<div class="note">פריטים שידרשו יישור נשארים במקומם על גרסת התוכנית הקודמת ומסומנים במפה; שום פריט לא מוזז למיקום מומצא.</div>`:c}`:r`<div class="note">טוען השוואה…</div>`}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.diff=null}>${e.mode==="compare"?"סגור":"ביטול"}</sw-button>
      ${e.mode!=="compare"&&t?r`<sw-button slot="footer" variant="primary" icon=${e.mode==="publish"?"check":"history"} data-diff-confirm ?disabled=${this.busy} @click=${()=>this.confirmDiff()}>${e.mode==="publish"?"פרסם גרסה":"שחזר ופרסם"}</sw-button>`:c}
    </sw-dialog>`}render(){const e=this.bundle;if(this.error&&!e)return r`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!e)return r`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=this.selected,s=this.dirty.size,i=this.anchors.filter(n=>n.resource_type==="camera").length,a=this.anchors.length-i;return r`
      <sw-page heading="עורך תוכנית" subheading=${`${e.buildingName} · ${e.floorName} · ${e.planStatus==="draft"?"טיוטה":e.planStatus==="published"?"תוכנית מפורסמת":"אין תוכנית"} · העוגנים נשמרים בנפרד מתמונת המקור${e.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${e.siteName} | ${e.buildingName} | ${e.floorName}`} wide>
        ${e.planStatus==="draft"&&e.permissions.publish?r`<sw-button slot="actions" variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.publish()}>פרסום גרסה</sw-button>`:c}
        <sw-button slot="actions" icon="eye" @click=${()=>b(`/explore/floors/${e.floorId}`)}>תצוגה מקדימה</sw-button>
        <sw-button slot="actions" ?disabled=${!s||this.busy} icon="check" @click=${()=>this.save()}>${s?`שמירה (${s})`:"הכל שמור"}</sw-button>
        <sw-button slot="actions" variant="ghost" icon="history" ?disabled=${!this.undo.length} @click=${()=>this.doUndo()}>ביטול שינוי</sw-button>
        ${e.planStatus==="none"?r`<sw-state-panel state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות וישויות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${()=>b(`/explore/floors/${e.floorId}/import`)}>העלאת תוכנית</sw-button></div></sw-state-panel>`:r`<div class="layout">
              <div class="mapwrap">
                <div class="bar">
                  <span class="autosave ${s?"dirty":""}"><i></i>${s?`${s} שינויים לא שמורים`:"הכל שמור"}</span>
                  ${this.info?r`<span style="color:#15803d">${this.info}</span>`:c}
                  ${this.error?r`<span class="err">${this.error}</span>`:c}
                  <span class="grow"></span>
                  ${e.needsAlignment?r`<sw-badge kind="partial" label="פריטים מגרסת תוכנית קודמת — בדוק מיקומים"></sw-badge>
                    <sw-button size="sm" data-realign-crop ?disabled=${this.busy} title="כשהגרסה החדשה היא חיתוך אחר של אותו שרטוט, המיקומים מחושבים דרך שני החיתוכים" @click=${()=>this.realign("crop")}>יישר לפי החיתוך</sw-button>
                    <sw-button size="sm" variant="ghost" data-realign-accept ?disabled=${this.busy} title="אחרי בדיקה בעין: הפריטים נרשמים על הגרסה הנוכחית כפי שהם" @click=${()=>this.realign("accept")}>אשר מיקומים</sw-button>`:c}
                  <span>גרירה מזיזה · גלגלת = זום · ידיות = כיוון ושדה ראייה</span>
                </div>
                <div class="floorchip"><sw-icon name="building" size=${14}></sw-icon>${e.floorName}</div>
                <div class="rail" role="toolbar" aria-label="כלי עריכה">
                  ${Zl.map(n=>r`<button class=${n.id===this.tool?"on":""} data-tool=${n.id} ?disabled=${!n.ready} title=${n.label} aria-label=${n.label} aria-pressed=${n.id===this.tool} @click=${()=>this.pickTool(n.id)}><sw-icon .name=${n.icon} size=${18}></sw-icon></button>`)}
                  <hr />
                  <button title="ביטול (Ctrl+Z)" aria-label="ביטול" ?disabled=${!this.undo.length} @click=${()=>this.doUndo()}><sw-icon name="history" size=${18}></sw-icon></button>
                  <button title="בצע שוב (Ctrl+Y)" aria-label="בצע שוב" ?disabled=${!this.redo.length} @click=${()=>this.doRedo()}><sw-icon name="refresh" size=${18}></sw-icon></button>
                </div>
                <sw-plan-canvas editable alwaysLabel .placing=${!!this.placing||!!this.drawing} .planWidth=${e.width} .planHeight=${e.height} .plan=${e.planSvg} .imageUrl=${e.imageUrl} .markers=${this.markers} .selectedId=${this.selectedId}
                  .zones=${this.planZones} .selectedZoneId=${this.selectedZoneId} .draftPoints=${this.drawing??[]}
                  @zone-select=${n=>{this.placing||this.drawing||n.detail.id.startsWith("cand-")||(this.selectedZoneId=n.detail.id,this.selectedId=null)}}
                  @zone-edit=${n=>{const o=this.zones.find(l=>l.id===n.detail.id);o&&this.patchZone(o,{polygon:n.detail.polygon})}}
                  @marker-select=${n=>{this.placing||this.drawing||(this.selectedId=n.detail.id,this.selectedZoneId=null)}}
                  @marker-move=${n=>{this.apply(n.detail.id,{position:{x:+n.detail.x.toFixed(4),y:+n.detail.y.toFixed(4)}}),this.selectedId=n.detail.id}}
                  @marker-orient=${n=>this.apply(n.detail.id,{rotation_degrees:n.detail.rotation,field_of_view_degrees:n.detail.fov})}
                  @marker-coverage=${n=>this.apply(n.detail.id,n.detail.polygon?{coverage_polygon:n.detail.polygon.map(o=>[o.x,o.y])}:{coverage_radius:n.detail.radius})}
                  @plan-click=${n=>this.drawing?this.addDraftPoint(n.detail.x,n.detail.y):this.place(n.detail.x,n.detail.y)}></sw-plan-canvas>
                ${this.placing?r`<div class="placing-hint"><span>לחץ על התוכנית כדי להציב את ${this.placing.kind==="camera"?this.placing.camera.name:this.placing.entity.name||this.placing.entity.entity_id} · Esc לביטול</span></div>`:c}
                ${this.drawing?r`<div class="placing-hint"><span>ציור אזור: לחץ להוספת פינות (${this.drawing.length}) · לחיצה על הפינה הראשונה או Enter מסיימים · Esc לביטול</span></div>`:c}
                <div class="legend"><span><i></i>מצלמות · ${i}</span><span><i class="ent"></i>ישויות HA · ${a}</span><span><i class="zone"></i>אזורים · ${this.zones.length}</span></div>
              </div>
              <div class="props">
                ${t?t.resource_type==="camera"?this.renderCameraInspector(t):this.renderEntityInspector(t):this.selectedZone&&this.tool!=="zones"?r`<sw-card heading="אזור" subheading=${this.selectedZone.name}>${this.renderZoneInspector(this.selectedZone)}</sw-card>`:this.renderToolPanel(e)}
                ${(t||this.selectedZone&&this.tool!=="zones")&&this.tool!=="select"?this.renderToolPanel(e):c}
                ${this.renderVersionCard(e)}
              </div>
            </div>`}
        ${this.renderDiffDialog()}
      </sw-page>
    `}};O.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 16px;
      min-block-size: 560px;
      flex: 1;
    }
    .mapwrap {
      position: relative;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      min-block-size: 520px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      flex-direction: column;
    }
    .mapwrap sw-plan-canvas {
      flex: 1;
    }
    .rail {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 64px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-2);
      padding: 5px;
      z-index: var(--sw-z-map-ui);
    }
    .rail button {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .rail button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .rail button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .rail button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .rail hr {
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      margin: 2px 4px;
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      z-index: var(--sw-z-map-ui);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .bar .grow {
      flex: 1;
    }
    .autosave {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .autosave i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .autosave.dirty i {
      background: var(--sw-stale);
    }
    .placing-hint {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 14px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
    }
    .placing-hint span {
      background: var(--sw-text);
      color: #fff;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      box-shadow: var(--sw-shadow-2);
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      display: flex;
      gap: 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      padding: 5px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      z-index: var(--sw-z-map-ui);
    }
    .legend i {
      display: inline-block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      margin-inline-end: 5px;
      background: var(--sw-accent);
    }
    .legend i.ent {
      background: var(--sw-live);
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
    }
    .list button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
    }
    .list button:hover,
    .list button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    .kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .kv .k {
      color: var(--sw-text-3);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
    }
    .row .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    input[type='range'] {
      inline-size: 100%;
      accent-color: var(--sw-accent);
    }
    .cand {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .cand input.name {
      inline-size: 100%;
      min-inline-size: 0;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      padding: 4px 6px;
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .cand select {
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      padding: 3px 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    i.sw {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.15);
      margin-inline-end: 6px;
      vertical-align: -2px;
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 8px;
    }
    .legend i.zone {
      border-radius: 2px;
      background: var(--sw-accent);
      opacity: 0.45;
    }
    .layerlist label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .vlist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 320px;
      overflow: auto;
      margin-block-start: 6px;
    }
    .vrow {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      grid-template-areas: "img meta" "img acts";
      gap: 4px 8px;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      font-size: var(--sw-fs-xs);
    }
    .vrow.cur {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .vrow img {
      grid-area: img;
      inline-size: 56px;
      block-size: 40px;
      object-fit: cover;
      border-radius: 4px;
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
    }
    .vrow .meta {
      grid-area: meta;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .vrow .acts {
      grid-area: acts;
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }
    .vrow .acts:empty {
      display: none;
    }
    .dsum {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .ditems {
      display: flex;
      flex-direction: column;
      max-block-size: 160px;
      overflow: auto;
      font-size: var(--sw-fs-xs);
    }
    .ditems div {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .compare img {
      inline-size: 100%;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-map-bg);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .props {
        order: 2;
      }
    }
  `;D([m()],O.prototype,"floorId",2);D([m()],O.prototype,"presetEntity",2);D([d()],O.prototype,"bundle",2);D([d()],O.prototype,"anchors",2);D([d()],O.prototype,"dirty",2);D([d()],O.prototype,"undo",2);D([d()],O.prototype,"redo",2);D([d()],O.prototype,"selectedId",2);D([d()],O.prototype,"tool",2);D([d()],O.prototype,"layers",2);D([d()],O.prototype,"placing",2);D([d()],O.prototype,"entQ",2);D([d()],O.prototype,"entResults",2);D([d()],O.prototype,"entBusy",2);D([d()],O.prototype,"lightsAll",2);D([d()],O.prototype,"busy",2);D([d()],O.prototype,"error",2);D([d()],O.prototype,"info",2);D([d()],O.prototype,"stylizing",2);D([d()],O.prototype,"stylized",2);D([d()],O.prototype,"stylizeOpts",2);D([d()],O.prototype,"zones",2);D([d()],O.prototype,"versions",2);D([d()],O.prototype,"diff",2);D([d()],O.prototype,"selectedZoneId",2);D([d()],O.prototype,"candidates",2);D([d()],O.prototype,"detecting",2);D([d()],O.prototype,"detectStrength",2);D([d()],O.prototype,"replaceAuto",2);D([d()],O.prototype,"drawing",2);D([d()],O.prototype,"showZones",2);D([d()],O.prototype,"zoneBusy",2);D([es("sw-plan-canvas")],O.prototype,"canvas",2);O=D([S("explore-plan-editor")],O);var Kl=Object.defineProperty,Gl=Object.getOwnPropertyDescriptor,Bt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Gl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Kl(t,s,a),a};let at=class extends x{constructor(){super(...arguments),this.columns=[],this.rows=[],this.rowKey="id",this.selected=null,this.emptyText="אין שורות להצגה",this.dense=!1}pick(e){const t=String(e[this.rowKey]??"");this.dispatchEvent(new CustomEvent("row-select",{detail:{id:t,row:e},bubbles:!0,composed:!0}))}render(){return this.rows.length?r`
      <table>
        <thead>
          <tr>${this.columns.map(e=>r`<th style=${e.width?`width:${e.width}`:""}>${e.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(e=>r`<tr class="clickable ${this.selected===String(e[this.rowKey])?"selected":""}" data-row-id=${String(e[this.rowKey]??"")} @click=${()=>this.pick(e)}
              @pointerenter=${t=>this.dispatchEvent(new CustomEvent("row-hover",{detail:{id:String(e[this.rowKey]??""),row:e,clientX:t.clientX,clientY:t.clientY,pointerType:t.pointerType},bubbles:!0,composed:!0}))}
              @pointerleave=${()=>this.dispatchEvent(new CustomEvent("row-leave",{detail:{id:String(e[this.rowKey]??"")},bubbles:!0,composed:!0}))}>
              ${this.columns.map(t=>r`<td class=${t.ltr?"ltr":""} data-label=${t.label}>${t.render?t.render(e):String(e[t.key]??"")}</td>`)}
            </tr>`)}
        </tbody>
      </table>
    `:r`<div class="empty">${this.emptyText}</div>`}};at.styles=z`
    :host {
      display: block;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow: auto;
      max-inline-size: 100%;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
      min-inline-size: 560px;
    }
    th,
    td {
      padding: 9px 14px;
      text-align: start;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    :host([dense]) th,
    :host([dense]) td {
      padding: 7px 12px;
    }
    /* Phones (M45): each row is a card — cells stack, the column label becomes a small caption, the first
       column (picture / avatar) sits beside the text. Nothing scrolls sideways. */
    @media (max-width: 767px) {
      :host {
        overflow: visible;
      }
      table {
        min-inline-size: 0;
        display: block;
      }
      thead {
        display: none;
      }
      tbody {
        display: block;
      }
      tr {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 2px 12px;
        padding: 10px 12px;
        border-block-end: 1px solid var(--sw-border);
      }
      tr > td:first-child {
        grid-row: span 6;
        align-self: start;
      }
      tr > td:first-child:not([data-label='']) {
        grid-row: auto;
        grid-column: 1 / -1;
      }
      td {
        display: block;
        padding: 0;
        border: 0;
        white-space: normal;
        grid-column: 2;
        /* full-system sweep: an audit "details" cell (a JSON-ish string with no spaces) or a long entity id
           has no break opportunity, so it ran off the card's edge and widened the whole page sideways */
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      td:not([data-label=''])::before {
        content: attr(data-label);
        display: block;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        line-height: 1.3;
      }
      tr.selected {
        box-shadow: inset 3px 0 0 var(--sw-accent);
      }
    }
    th {
      position: sticky;
      top: 0;
      background: var(--sw-surface);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
      z-index: 1;
    }
    tbody tr {
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    tbody tr:hover {
      background: var(--sw-surface-2);
    }
    tbody tr.selected {
      background: var(--sw-accent-soft);
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    tr.clickable {
      cursor: pointer;
    }
    td.ltr {
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .empty {
      padding: var(--sw-s-6);
      text-align: center;
      color: var(--sw-text-3);
    }
  `;Bt([m({attribute:!1})],at.prototype,"columns",2);Bt([m({attribute:!1})],at.prototype,"rows",2);Bt([m()],at.prototype,"rowKey",2);Bt([m()],at.prototype,"selected",2);Bt([m()],at.prototype,"emptyText",2);Bt([m({type:Boolean,reflect:!0})],at.prototype,"dense",2);at=Bt([S("sw-table")],at);var Yl=Object.defineProperty,Jl=Object.getOwnPropertyDescriptor,Ve=(e,t,s,i)=>{for(var a=i>1?void 0:i?Jl(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Yl(t,s,a),a};const Ns=[{id:"lock.main_door",name:"דלת כניסה",domain:"lock",area:"לובי",state:"נעול",fresh:"live",placed:!0,actions:"נעילה / פתיחה (grant נפרד)"},{id:"light.lobby",name:"תאורת לובי",domain:"light",area:"לובי",state:"דולק · 80%",fresh:"live",placed:!0,actions:"הדלקה / כיבוי / עמעום"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",domain:"binary_sensor",area:"אולם",state:"ללא תנועה",fresh:"live",placed:!0,actions:"קריאה בלבד"},{id:"climate.hall",name:"מזגן אולם",domain:"climate",area:"אולם",state:"קירור · 23°",fresh:"stale",placed:!1,actions:"יעד טמפרטורה (allowlist)"},{id:"cover.parking_gate",name:"שער חניה",domain:"cover",area:"חניה",state:"סגור",fresh:"live",placed:!1,actions:"פתיחה / סגירה (רגיש)"},{id:"script.night_mode",name:"מצב לילה",domain:"script",area:"—",state:"—",fresh:"unknown",placed:!1,actions:"חסום עד allowlist"},{id:"sensor.power_main",name:"צריכת חשמל",domain:"sensor",area:"חדר מכונות",state:"4.2 kW",fresh:"live",placed:!1,actions:"קריאה בלבד"},{id:"camera.intercom_m2",name:"אינטרקום M2",domain:"camera",area:"כניסה",state:"זמין",fresh:"live",placed:!1,actions:"צפייה (provider נפרד)"}];function Xl(e){return e==="lock"||e==="cover"?"lock":e==="light"||e==="switch"||e==="fan"?"light":e==="camera"?"camera":e==="climate"||e==="script"||e==="scene"||e==="button"||e==="automation"?"activity":"sensor"}let _e=class extends x{constructor(){super(...arguments),this.selected=null,this.domain="all",this.q="",this.area="",this.onlyPlaced=!1,this.cat=null,this.error="",this.loading=!1,this.sync=null,this.firstFloorId=null,this.stopWs=null,this.searchTimer=0,this.columns=[{key:"name",label:"ישות",render:e=>r`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:7px;background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${Xl(String(e.domain))} size=${13}></sw-icon></span><span><strong>${String(e.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(e.id)}</div></span></span>`},{key:"domain",label:"Domain",ltr:!0},{key:"area",label:"אזור HA"},{key:"state",label:"מצב"},{key:"fresh",label:"רעננות",render:e=>r`<sw-badge kind=${e.fresh} label=${e.fresh==="live"||e.fresh==="neutral"?"עדכני":e.fresh==="stale"?"מיושן":e.fresh==="offline"?"לא זמין":"לא ידוע"}></sw-badge>`},{key:"placed",label:"במפה",render:e=>e.placed?r`<sw-badge kind="recorded" label="מוצב"></sw-badge>`:r`<span style="color:var(--sw-text-3)">לא</span>`}]}connectedCallback(){super.connectedCallback(),g()&&(this.load(),yt().then(e=>this.firstFloorId=Mr(e)?.id??null).catch(()=>{}),this.stopWs=Cr(e=>{if(e.type==="entity_state_changed"&&this.cat){const t=this.cat.entities.findIndex(s=>s.entity_id===e.entity.entity_id);if(t>=0){const s=[...this.cat.entities];s[t]={...s[t],...e.entity,placements:s[t].placements,actions:s[t].actions},this.cat={...this.cat,entities:s}}}else e.type==="heartbeat"?this.sync=e.sync:e.type==="ha_sync_state"&&this.sync&&(this.sync={...this.sync,connected:e.connected})}))}disconnectedCallback(){super.disconnectedCallback(),this.stopWs?.(),this.stopWs=null}async load(){this.loading=!0,this.error="";try{this.cat=await Ir({domain:this.domain==="all"?void 0:this.domain,q:this.q||void 0,area:this.area||void 0,placed:this.onlyPlaced?!0:void 0,limit:800}),this.sync=this.cat.sync}catch(e){this.error=w(e)}finally{this.loading=!1}}onSearch(e){this.q=e,window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(()=>void this.load(),250)}toRow(e){return{id:e.entity_id,name:e.name||e.original_name||e.entity_id,domain:e.domain,area:e.area_name??"—",state:vt(e),fresh:Bi(e),placed:!!e.placements?.length,actions:e.actions?.length?e.actions.map(t=>`${t.label}${t.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}}renderApiDrawer(e){const t=Bi(e),s=Object.entries(e.attributes).filter(([i])=>i!=="friendly_name"&&i!=="icon").slice(0,14);return r`<sw-drawer open heading=${e.name||e.original_name||e.entity_id} subheading=${e.entity_id} @close=${()=>this.selected=null}>
      <dl>
        <dt>מצב</dt><dd><sw-badge kind=${t} label=${vt(e)}></sw-badge></dd>
        <dt>Domain</dt><dd><span class="ltr">${e.domain}</span> · ${_s(e.domain)}${e.device_class?r` · <span class="ltr">${e.device_class}</span>`:c}</dd>
        <dt>אזור HA</dt><dd>${e.area_name??"—"}${e.ha_floor_name?` · ${e.ha_floor_name}`:""}</dd>
        <dt>שינוי אחרון</dt><dd>${Re(e.last_changed)}</dd>
        <dt>נראה לאחרונה</dt><dd>${Re(e.state_seen_at)}${e.fresh?"":" · הסנכרון מנותק"}</dd>
        <dt>אינטגרציה</dt><dd><span class="ltr">${e.platform??"—"}</span></dd>
        <dt>פעולות נתמכות</dt><dd>${e.actions?.length?e.actions.map(i=>`${i.label}${i.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}</dd>
        <dt>במפה</dt><dd>${e.placements?.length?r`<span class="chips">${e.placements.map(i=>r`<sw-chip @click=${()=>b(`/explore/floors/${i.floor_id}`)}>${i.floor_name}</sw-chip>`)}</span>`:"לא מוצב"}</dd>
      </dl>
      ${s.length?r`<div class="attrs">${s.map(([i,a])=>r`<span>${i}</span><span>${typeof a=="object"?JSON.stringify(a):String(a)}</span>`)}</div>`:c}
      <div class="note">הקטלוג הוא שיקוף לקריאה בלבד של Home Assistant. הפעולות רצות דרך גשר SMPLWISE בזהות המשתמש; שליטה מהמפה דורשת הרשאת ha.entity.control.</div>
      <div slot="footer">
        ${e.placements?.length?r`<sw-button variant="primary" icon="map" @click=${()=>b(`/explore/floors/${e.placements[0].floor_id}`)}>הצג במפה</sw-button>`:r`<sw-button variant="primary" icon="map" ?disabled=${!this.firstFloorId} title=${this.firstFloorId?"פותח את עורך התוכנית עם הישות מוכנה להצבה":"אין קומות עדיין"} @click=${()=>this.firstFloorId&&b(`/explore/floors/${this.firstFloorId}/edit`,{entity:e.entity_id})}>הצב במפה</sw-button>`}
      </div>
    </sw-drawer>`}renderApi(){const e=this.cat,t=this.sync,s=e?e.entities.map(l=>this.toRow(l)):[],i=e?Object.entries(e.domains).sort((l,p)=>p[1]-l[1]):[],a=e?.entities.find(l=>l.entity_id===this.selected),n=i.reduce((l,[,p])=>l+p,0),o=t?`${n} ישויות בקטלוג · ${t.connected?`סנכרון פעיל · HA ${t.ha_version??""}`:`הסנכרון מנותק${t.last_error?` · ${t.last_error}`:""}`}`:"טוען את הקטלוג…";return r`
      <sw-page heading="קטלוג ישויות Home Assistant" subheading=${o}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.loading} @click=${()=>this.load()}>רענון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" .value=${this.q} @input=${l=>this.onSearch(l.target.value)} /></sw-field>
          <sw-field><select aria-label="אזור" @change=${l=>{this.area=l.target.value,this.load()}}><option value="">כל האזורים</option>${(e?.areas??[]).map(l=>r`<option value=${l.area_id} ?selected=${l.area_id===this.area}>${l.area_name??l.area_id}</option>`)}</select></sw-field>
          <sw-chip ?selected=${this.onlyPlaced} icon="map" @click=${()=>{this.onlyPlaced=!this.onlyPlaced,this.load()}}>מוצבות בלבד</sw-chip>
        </div>
        <div class="filters">
          <sw-chip ?selected=${this.domain==="all"} count=${n} @click=${()=>{this.domain="all",this.load()}}>הכל</sw-chip>
          ${i.map(([l,p])=>r`<sw-chip ?selected=${l===this.domain} count=${p} @click=${()=>{this.domain=l,this.load()}}><span class="ltr">${l}</span></sw-chip>`)}
        </div>
        <div class="stage">
          ${this.error?r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`:e?s.length?r`<sw-table .columns=${this.columns} .rows=${s} .selected=${this.selected} @row-select=${l=>this.selected=l.detail.id}></sw-table>`:r`<sw-state-panel state="empty" heading=${n?"אין ישויות שתואמות את הסינון":"הקטלוג ריק"} hint=${n?"נקה את החיפוש או בחר domain אחר.":t?.connected?"ההסנכרון פעיל אך טרם התקבלו מצבים.":"ה־Add-on לא מחובר ל־Home Assistant. בדוק בהגדרות → גשר Home Assistant."}></sw-state-panel>`:r`<sw-state-panel state="loading"></sw-state-panel>`}
          ${a?this.renderApiDrawer(a):c}
        </div>
      </sw-page>
    `}render(){if(g())return this.renderApi();const e=["all",...new Set(Ns.map(i=>i.domain))],t=Ns.filter(i=>this.domain==="all"||i.domain===this.domain),s=Ns.find(i=>i.id===this.selected);return r`
      <sw-page heading="קטלוג ישויות Home Assistant" subheading="${Ns.length} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" /></sw-field>
          ${e.map(i=>r`<sw-chip ?selected=${i===this.domain} @click=${()=>this.domain=i}>${i==="all"?"הכל":i}</sw-chip>`)}
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${t} .selected=${this.selected} @row-select=${i=>this.selected=i.detail.id}></sw-table>
          ${s?r`<sw-drawer open heading=${s.name} subheading=${s.id} @close=${()=>this.selected=null}>
                <dl>
                  <dt>מצב</dt><dd><sw-badge kind=${s.fresh} label=${s.state}></sw-badge></dd>
                  <dt>Domain</dt><dd><span class="ltr">${s.domain}</span></dd>
                  <dt>אזור HA</dt><dd>${s.area}</dd>
                  <dt>פעולות נתמכות</dt><dd>${s.actions}</dd>
                  <dt>במפה</dt><dd>${s.placed?"קומה 0":"לא מוצב"}</dd>
                </dl>
                <div class="note">ישות מ־domain לא מוכר מקבלת כרטיס כללי לקריאה בלבד. scripts ו־scenes חסומים עד allowlist.</div>
                <div slot="footer">
                  <sw-button variant="primary" icon="map">${s.placed?"הצג במפה":"הצב במפה"}</sw-button>
                  <sw-button variant="ghost">פתח ב־HA</sw-button>
                </div>
              </sw-drawer>`:""}
        </div>
      </sw-page>
    `}};_e.styles=z`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .search {
      flex: 1;
      min-inline-size: 220px;
      max-inline-size: 420px;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 10px;
    }
    .attrs {
      margin-block-start: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 3px 10px;
      direction: ltr;
      text-align: left;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .statusline {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;Ve([d()],_e.prototype,"selected",2);Ve([d()],_e.prototype,"domain",2);Ve([d()],_e.prototype,"q",2);Ve([d()],_e.prototype,"area",2);Ve([d()],_e.prototype,"onlyPlaced",2);Ve([d()],_e.prototype,"cat",2);Ve([d()],_e.prototype,"error",2);Ve([d()],_e.prototype,"loading",2);Ve([d()],_e.prototype,"sync",2);Ve([d()],_e.prototype,"firstFloorId",2);_e=Ve([S("explore-entities")],_e);var Ql=Object.defineProperty,ed=Object.getOwnPropertyDescriptor,Tr=(e,t,s,i)=>{for(var a=i>1?void 0:i?ed(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ql(t,s,a),a};const gi=[{id:"d1",name:"כניסה ראשית",kind:"דלת זכוכית",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!1,scene:"entrance"},{id:"d2",name:"לובי",kind:"דלת פנימית",lock:"פתוח",contact:"פתוח",relay:"לא פעיל",ringing:!1,scene:"lobby"},{id:"d3",name:"אינטרקום M2",kind:"עמדת דלת",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!0,scene:"entrance"},{id:"d4",name:"מחסן",kind:"דלת שירות",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!1,scene:"warehouse"}];let Ks=class extends x{constructor(){super(...arguments),this.selected="d1"}render(){if(g())return r`<sw-page heading="דלתות ואינטרקום" subheading="V1 · מצלמה, צלצול, מגע דלת וממסר הם ארבעה נתונים שונים">
        <sw-state-panel data-access-pending state="empty" heading="אינטרקום ובקרת כניסה טרם חוברו" hint="המסך יופעל כשמערכת האינטרקום / בקרת הכניסה תחובר (T054): נדרשות ישויות Home Assistant של הדלת, הצלצול והממסר או תחנת דלת ב־go2rtc. עד אז מעברי דלתות ומנעולים מחיישני HA מופיעים במרכז האירועים ועל המפה."></sw-state-panel>
      </sw-page>`;const e=gi.find(t=>t.id===this.selected)??gi[0];return r`
      <sw-page heading="דלתות ואינטרקום" subheading="V1 · מצלמה, צלצול, מגע דלת וממסר הם ארבעה נתונים שונים · נתוני הדגמה">
        <sw-tabs .items=${[{id:"doors",label:"דלתות",count:4},{id:"intercom",label:"אינטרקום",count:1},{id:"linked",label:"מצלמות מקושרות",count:4}]} active="doors"></sw-tabs>
        <div class="layout">
          <div class="list">
            ${gi.map(t=>r`<button class="door ${t.id===this.selected?"on":""}" @click=${()=>this.selected=t.id} aria-pressed=${t.id===this.selected}>
                <div class="ic"><sw-icon name=${t.lock==="נעול"?"lock":"unlock"} size=${15}></sw-icon></div>
                <div style="flex:1"><b>${t.name}</b><small>${t.kind}</small></div>
                <span class="st ${t.ringing?"ring":t.lock==="נעול"?"":"open"}"><i></i>${t.ringing?"מצלצל":t.lock}</span>
              </button>`)}
          </div>
          <sw-card heading=${e.name} subheading=${e.kind}>
            <sw-camera-tile name="מצלמת הדלת" state="live" scene=${e.scene}></sw-camera-tile>
            <div class="facts">
              <div class="fact"><span>מנעול</span>${e.lock}</div>
              <div class="fact"><span>מגע דלת</span>${e.contact}</div>
              <div class="fact"><span>ממסר</span>${e.relay}</div>
              <div class="fact"><span>צלצול</span>${e.ringing?"כן":"לא"}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <sw-button variant="primary" icon="unlock" disabled>פתח דלת</sw-button>
              <sw-button icon="clock" disabled>השאר פתוח</sw-button>
              <sw-button variant="ghost" icon="history">אירועי הדלת</sw-button>
            </div>
            <div class="note" style="margin-block-start:8px">פתיחה דורשת grant מפורש (<span class="ltr">door.unlock</span>), הרשאת HA של המשתמש, אישור מפורש ורישום באודיט. אין שליחה חוזרת אחרי timeout או reconnect.</div>
            <h4>מצלמות מקושרות (2)</h4>
            <div class="linked">
              <sw-camera-tile compact name="כניסה ראשית" state="live" scene="entrance"></sw-camera-tile>
              <sw-camera-tile compact name="לובי" state="live" scene="lobby"></sw-camera-tile>
            </div>
          </sw-card>
        </div>
      </sw-page>
    `}};Ks.styles=z`
    .layout {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .door {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1.5px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      text-align: start;
      font: inherit;
      color: inherit;
    }
    .door.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .door .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .door b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .door small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .st {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .st i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .st.open i {
      background: var(--sw-danger);
    }
    .st.ring i {
      background: var(--sw-stale);
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-block: 10px;
    }
    .fact {
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .fact span {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular);
    }
    .linked {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    h4 {
      margin: 12px 0 8px;
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .facts {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;Tr([d()],Ks.prototype,"selected",2);Ks=Tr([S("explore-access")],Ks);var td=Object.defineProperty,sd=Object.getOwnPropertyDescriptor,Lt=(e,t,s,i)=>{for(var a=i>1?void 0:i?sd(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&td(t,s,a),a};let rt=class extends x{constructor(){super(...arguments),this.label="",this.value="",this.detail="",this.icon="info",this.tone="neutral",this.badge=""}render(){return r`
      <div class="icon"><sw-icon .name=${this.icon} size=${16}></sw-icon></div>
      ${this.badge?r`<span class="badge">${this.badge}</span>`:""}
      <div>
        <div class="value">${this.value}</div>
        <div class="label">${this.label}</div>
        ${this.detail?r`<div class="detail">${this.detail}</div>`:""}
      </div>
    `}};rt.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
      position: relative;
    }
    .icon {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    :host([tone='error']) .icon,
    :host([tone='offline']) .icon {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    :host([tone='stale']) .icon,
    :host([tone='partial']) .icon {
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
    }
    :host([tone='live']) .icon {
      background: var(--sw-live-soft);
      color: #16a34a;
    }
    .value {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
    }
    .label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 2px;
    }
    .detail {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: #16a34a;
      margin-block-start: 1px;
    }
    :host([tone='stale']) .detail,
    :host([tone='partial']) .detail {
      color: #b45309;
    }
    :host([tone='error']) .detail,
    :host([tone='offline']) .detail {
      color: var(--sw-danger);
    }
    :host([tone='neutral']) .detail {
      color: var(--sw-text-3);
    }
    .badge {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-start: 10px;
      background: var(--sw-danger);
      color: #fff;
      font-size: 9.5px;
      font-weight: var(--sw-fw-semibold);
      border-radius: var(--sw-r-pill);
      padding: 1px 7px;
    }
  `;Lt([m()],rt.prototype,"label",2);Lt([m()],rt.prototype,"value",2);Lt([m()],rt.prototype,"detail",2);Lt([m()],rt.prototype,"icon",2);Lt([m({reflect:!0})],rt.prototype,"tone",2);Lt([m()],rt.prototype,"badge",2);rt=Lt([S("sw-kpi")],rt);function li(e={}){const t=new URLSearchParams;e.date&&t.set("date",e.date),e.from&&e.to&&(t.set("from",e.from),t.set("to",e.to)),e.acked&&t.set("acked","true"),e.cameraId&&t.set("camera_id",e.cameraId),e.type&&t.set("type",e.type),e.unacked&&t.set("unacked","true"),e.limit&&t.set("limit",String(e.limit)),e.floorId&&t.set("floor_id",e.floorId),e.zoneId&&t.set("zone_id",e.zoneId),e.buildingId&&t.set("building_id",e.buildingId),e.siteId&&t.set("site_id",e.siteId),e.source&&t.set("source",e.source),e.severity&&t.set("severity",e.severity),e.query&&t.set("q",e.query);const s=t.toString();return k(`events${s?`?${s}`:""}`)}const id=()=>k("events/summary"),ad=(e,t)=>k(`cameras/${e}/events?date=${t}`),Or=e=>M(`events/${e}/ack`),Aa=e=>M("events/ack-many",{event_ids:e}),Ea={camera:"לפי מצלמה",all:"כל המצלמות יחד",zone:"לפי חדר",floor:"לפי קומה"};function rd(e={}){const t=new URLSearchParams;e.date&&t.set("date",e.date),e.cameraId&&t.set("camera_id",e.cameraId),e.gap&&t.set("gap",String(e.gap)),e.by&&t.set("by",e.by),e.limit&&t.set("limit",String(e.limit));const s=t.toString();return k(`events/windows${s?`?${s}`:""}`)}const nd=e=>k(`events/${e}`),Mt=(e,t=0)=>he(`events/${e}/thumbnail${t?`?v=${t}`:""}`);async function Dr(e){try{const t=await fetch(Mt(e),{credentials:"include",cache:"no-store"});return t.status===200?"ready":t.status===202?"pending":"unavailable"}catch{return"pending"}}const Y={motion:"תנועה",person:"אדם",vehicle:"רכב",line:"חציית קו",field:"חדירה לאזור",offline:"אובדן וידאו",tamper:"חבלה במצלמה",door:"דלת",io:"כניסת חיווי",storage:"אחסון",system:"מערכת",coverage_gap:"פער בקליטת אירועים",manual:"הקלטה ידנית",other:"אחר"},js={motion:"#ef4444",person:"#2f6bff",vehicle:"#22c55e",line:"#f59e0b",field:"#f59e0b",offline:"#6b7280",tamper:"#b45309",door:"#8b5cf6",io:"#8b5cf6",storage:"#6b7280",system:"#6b7280",coverage_gap:"#6b7280",manual:"#2f6bff",other:"#6b7280"};function od(e){return e==="person"||e==="vehicle"||e==="motion"||e==="line"||e==="offline"||e==="door"?e:e==="field"?"line":e==="io"?"door":e==="tamper"||e==="coverage_gap"||e==="storage"||e==="system"?"offline":"motion"}function ld(e,t){let s=null,i=!1,a=2e3;const n=(()=>{const l=new URL(he("events/ws"));return l.protocol=l.protocol==="https:"?"wss:":"ws:",l.toString()})(),o=()=>{if(!i){try{s=new WebSocket(n)}catch{return}s.onopen=()=>{a=2e3,t?.(null,!0)},s.onmessage=l=>{try{const p=JSON.parse(l.data);p.type==="event_added"||p.type==="event_updated"?e(p.payload):p.type==="heartbeat"&&t?.(p.payload.ingest,!0)}catch{}},s.onclose=()=>{t?.(null,!1),i||(window.setTimeout(o,a),a=Math.min(3e4,a*2))}}};return o(),()=>{i=!0,s?.close()}}const dd={measured:"נמדד",inferred:"נגזר",command:"פקודה",availability:"זמינות"},cd=(e,t=120)=>k(`events/${e}/correlation?window=${t}`),pd=(e=90)=>k(`events/facets?days=${e}`),Pa={alertstream:"אירוע NVR",recording:"נגזר מהקלטה",system:"מערכת",ha:"חיישן HA"},hd=(e,t=90)=>k(`events/${e}/route?window=${t}`),Rr=(e=!1)=>k(`storage${e?"?fresh=true":""}`);function zt(e){return e==null?"—":e>=1024*1024?`${(e/1024/1024).toFixed(2)} TB`:e>=1024?`${(e/1024).toFixed(0)} GB`:`${e} MB`}const ms={ok:"תקין",warn:"לתשומת לב",error:"שגיאה"},Ia={ok:"live",warn:"stale",error:"offline"},Nr=(e=!1)=>k(`health/report${e?"?fresh=1":""}`),sa=()=>k("health/summary");function ud(e){return e<3600?`${Math.floor(e/60)} דק׳`:e<86400?`${Math.floor(e/3600)} שע׳ ${Math.floor(e%3600/60)} דק׳`:`${Math.floor(e/86400)} ימים ${Math.floor(e%86400/3600)} שע׳`}let Fs=null,Bs=null;const md={"media.transport_default":"mse","media.max_live_sessions":8,"media.wall_profile":"sub","snapshots.max_age_s":60};async function je(e=!1){return g()?Fs&&!e?Fs:(Bs||(Bs=ur().then(t=>Fs=t.settings).finally(()=>Bs=null)),Bs):md}function Ca(){Fs=null}function ia(e){return mr()||e?.["media.transport_default"]||"mse"}var fd=Object.defineProperty,wd=Object.getOwnPropertyDescriptor,Ae=(e,t,s,i)=>{for(var a=i>1?void 0:i?wd(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&fd(t,s,a),a};function vd(e){return e<5?"לילה טוב":e<12?"בוקר טוב":e<17?"צהריים טובים":e<21?"ערב טוב":"לילה טוב"}const gd={person:"var(--sw-accent)",vehicle:"var(--sw-live)",motion:"var(--sw-danger)",line:"var(--sw-stale)",offline:"var(--sw-offline)",door:"var(--sw-purple)"},bd={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking"};let fe=class extends x{constructor(){super(...arguments),this.cams=null,this.recorder=null,this.sites=null,this.summary=null,this.summaryDenied=!1,this.recent=[],this.storage=null,this.health=null,this.raw=null,this.tz="Asia/Jerusalem",this.now=new Date,this.loaded=!1,this.timer=0,this.clockTimer=0}connectedCallback(){super.connectedCallback(),g()&&(this.load(),this.timer=window.setInterval(()=>void this.load(),6e4),this.clockTimer=window.setInterval(()=>this.now=new Date,3e4))}disconnectedCallback(){window.clearInterval(this.timer),window.clearInterval(this.clockTimer),super.disconnectedCallback()}async load(){this.loadStorage();const[e,t,s,i,a,n,o]=await Promise.allSettled([je(),Te(),k("sites?tree=true"),id(),li({limit:6}),sa(),k("health")]);e.status==="fulfilled"&&(this.tz=e.value["time.zone"]??this.tz),t.status==="fulfilled"?(this.cams=t.value.cameras.filter(l=>l.enabled),this.recorder=t.value.recorder):this.cams===null&&(this.cams=[]),s.status==="fulfilled"?this.sites=s.value.sites:this.sites===null&&(this.sites=[]),i.status==="fulfilled"?this.summary=i.value:this.summaryDenied=i.reason instanceof be&&i.reason.status===403,a.status==="fulfilled"&&(this.recent=a.value.events),n.status==="fulfilled"&&(this.health=n.value),o.status==="fulfilled"&&(this.raw=o.value),this.loaded=!0,this.now=new Date}async loadStorage(){try{this.storage=await Rr()}catch{this.storage=null}}fmtTime(e){return new Date(e).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit",timeZone:this.tz})}spots(){const e=[],t=this.cams??[];for(const a of t.filter(n=>n.status==="offline"))e.push({kind:"critical",title:`מצלמה מנותקת: ${a.name}`,meta:`ערוץ ${a.channel}${a.last_seen_at?` · נראתה לאחרונה ${this.fmtTime(a.last_seen_at)}`:""}`,why:"מוצג כי ה־NVR מדווח שהערוץ אינו מחובר",link:`#/live/cameras/${a.id}`});for(const a of(this.health?.items??[]).filter(n=>n.status!=="ok"))e.push({kind:a.status==="error"?"critical":"alert",title:a.label,meta:`בדיקת מערכת · ${ms[a.status]}`,why:"מוצג כי בדיקת הבריאות של ה־Add-on מדווחת על כך",link:"#/system/diagnostics"});const s=this.summary?.today.unacked??0;if(s>0){const a=Object.entries(this.summary?.today.by_type??{}).sort((n,o)=>o[1]-n[1]).slice(0,3).map(([n,o])=>`${Y[n]??n} ${o}`).join(" · ");e.push({kind:"alert",title:`${s} אירועים שלא נבדקו היום`,meta:a,why:"מוצג כי אירועים ממתינים לסימון טיפול במרכז האירועים",link:"#/investigate/events"})}const i=this.raw?.events.ingest;return i?.connected&&!i.events_stored&&!i.last_event_at&&e.push({kind:"info",title:"ה־NVR לא שלח התראות מאז ההפעלה",meta:"אירועי תנועה נגזרים מההקלטות כל 10 דקות",why:'מוצג כי זרם ההתראות מחובר אך ריק — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה',link:"#/system/setup"}),this.raw?.home_assistant.configured&&!this.raw.home_assistant.connected&&e.push({kind:"alert",title:"אין חיבור ל־Home Assistant",meta:this.raw.home_assistant.last_error??"",why:"מוצג כי מצבי הישויות והדלתות עלולים להיות מיושנים",link:"#/system/setup"}),e}renderApi(){const e=st.me?.user,t=e?.display_name||e?.username||"",s=Number(this.now.toLocaleString("en-GB",{hour:"numeric",hour12:!1,timeZone:this.tz})),i=this.cams??[],a=i.filter(A=>A.status==="online").length,n=this.sites??[],o=n.flatMap(A=>(A.buildings??[]).flatMap(ae=>ae.floors??[])),l=this.health,p=l?l.status==="ok"?"live":l.status==="warn"?"stale":"offline":"neutral",f=l?.items.find(A=>A.status!=="ok"),u=this.loaded?this.spots():[],v=this.storage,$=v?.totals??null,_=$?.used_pct??null,N=34,X=2*Math.PI*N,Vt=i.filter(A=>A.status==="online").slice(0,2);return r`
      <sw-page heading=${`${vd(s)}${t?`, ${t}`:""}`} subheading=${l?`מצב המערכת: ${ms[l.status]}${f?` · ${f.label}`:" · כל הבדיקות תקינות"}`:"קורא את מצב המערכת…"}>
        <div slot="actions" class="date">${this.now.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:this.tz})}<br />${this.now.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit",timeZone:this.tz})}</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi icon="camera" tone=${i.length&&a===i.length?"live":a?"stale":"offline"} value=${`${a}/${i.length}`} label="מצלמות" detail=${this.recorder?`מחוברות · ${this.recorder.model??this.recorder.name}`:"מחוברות"}></sw-kpi>
          <sw-kpi icon="building" value=${String(n.length)} label="אתרים" detail=${`${o.length} קומות · ${o.filter(A=>A.has_plan).length} עם תוכנית`} tone="neutral"></sw-kpi>
          <sw-kpi icon="bell" value=${this.summaryDenied?"—":String(this.summary?.today.total??0)} label="אירועים" detail=${this.summaryDenied?"ללא הרשאה לאירועים":"היום"} tone="neutral" badge=${this.summary?.today.unacked?`${this.summary.today.unacked} לבדיקה`:""}></sw-kpi>
          <sw-kpi icon="shield" tone=${p} value=${l?ms[l.status]:"…"} label="מצב מערכת" detail=${f?f.label:"NVR, go2rtc, HA ואחסון"}></sw-kpi>
        </div>
        ${Vt.length?r`<div class="fav" data-overview-favorites>
              ${Vt.map(A=>r`<sw-camera-tile name=${A.name} state="live" cameraId=${A.id} poster=${qe(A.id)} noDemo @click=${()=>b(`/live/cameras/${A.id}`)}></sw-camera-tile>`)}
            </div>`:c}
        <div class="row2">
          ${v&&$?r`<sw-card heading="אחסון" subheading=${v.cached?"מהמטמון · נמדד מול ה־NVR":"נמדד מול ה־NVR"}>
                <div class="donut">
                  <svg viewBox="0 0 84 84" role="img" aria-label=${`אחסון בשימוש ${_??0}%`}>
                    ${h`<circle cx="42" cy="42" r=${N} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                    <circle cx="42" cy="42" r=${N} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${X*(_??0)/100} ${X}`} transform="rotate(-90 42 42)" />
                    <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">${_??0}%</text>`}
                  </svg>
                  <div class="txt">
                    <div class="big">${zt($.used_mb)} מתוך ${zt($.capacity_mb)}</div>
                    <div class="bar"><i style=${`inline-size:${_??0}%`}></i></div>
                    <div class="muted">${v.retention.measured_days_min!==null?`הקלטה ישנה ביותר ≈ ${v.retention.measured_days_min}${v.retention.measured_days_max!==null&&v.retention.measured_days_max!==v.retention.measured_days_min?`–${v.retention.measured_days_max}`:""} ימים (נמדד)`:v.retention.measured_reason}${v.work_mode?` · ${v.work_mode}`:""} · ${$.disks} דיסקים</div>
                  </div>
                </div>
              </sw-card>`:c}
          <sw-card heading="אתרים ומבנים" subheading=${n.length?`${n.length} אתרים · ${o.length} קומות`:"עדיין לא הוגדרו אתרים"}>
            ${n.map(A=>{const ae=(A.buildings??[]).flatMap(rs=>rs.floors??[]),pi=ae.filter(rs=>rs.has_plan).length,Jr=ae.reduce((rs,Xr)=>rs+Xr.camera_count,0);return r`<div class="hrow" @click=${()=>b("/explore/sites")} style="cursor:pointer"><span>${A.name}<div class="muted">${(A.buildings??[]).length} מבנים · ${ae.length} קומות · ${Jr} מצלמות מוצבות · ${pi}/${ae.length} תוכניות</div></span><span class="status"><i style=${`--c:${ae.length&&pi===ae.length?"var(--sw-live)":"var(--sw-stale)"}`}></i>${ae.length&&pi===ae.length?"תוכניות מפורסמות":"חסרות תוכניות"}</span></div>`})}
            ${this.recorder?r`<div class="hrow"><span>NVR · ${this.recorder.name}<div class="muted">${this.recorder.model??""} · ${a}/${i.length} מצלמות מחוברות</div></span><span class="status"><i style=${`--c:${a===i.length?"var(--sw-live)":"var(--sw-offline)"}`}></i>${a===i.length?"מחובר":`${i.length-a} מנותקות`}</span></div>`:c}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card heading="אירועים אחרונים" subheading=${this.summary?`${this.summary.today.total} היום · ${this.summary.today.measured} נמדדו · ${this.summary.today.inferred} נגזרו מהקלטה`:""}>
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${this.recent.length?this.recent.map(A=>r`<div class="ev" data-overview-event @click=${()=>b(`/investigate/events/${A.id}`)}>
                    ${A.thumbnail==="ready"?r`<img class="thumb" src=${Mt(A.id)} alt="" loading="lazy" />`:r`<div class="none"><sw-icon name=${A.type==="offline"||A.type==="coverage_gap"?"offline":A.type==="door"||A.type==="io"?"door":A.type==="person"?"user":A.type==="vehicle"?"route":"bell"} size=${14}></sw-icon></div>`}
                    <div class="txt"><b style=${`--tone:${js[A.type]??"#6b7280"}`}><i></i>${Y[A.type]??A.type}${A.acked_at?"":" · לבדיקה"}</b><small>${A.camera_name??A.details?.name??"ללא מצלמה"} · ${A.confidence==="inferred"?"נגזר מהקלטה":A.source==="ha"?"חיישן HA":"התראה"}</small></div>
                    <time>${this.fmtTime(A.occurred_at)}</time>
                  </div>`):r`<div class="muted">${this.loaded?"אין אירועים ב־24 השעות האחרונות":"טוען…"}</div>`}
          </sw-card>
          <sw-card heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${u.length?u.map(A=>r`<div class="spot ${A.kind}" data-overview-spot>
                    <div class="ic"><sw-icon name=${A.kind==="critical"?"offline":A.kind==="info"?"info":"warning"} size=${15}></sw-icon></div>
                    <div><div class="t">${A.title}</div><div class="muted">${A.meta}</div><div class="why">${A.why}</div></div>
                    <div class="actions"><a href=${A.link}><sw-button size="sm">פתח</sw-button></a></div>
                  </div>`):r`<div class="muted" data-overview-calm>${this.loaded?"הכול תקין — אין פריטים שדורשים תשומת לב כרגע.":"בודק…"}</div>`}
          </sw-card>
        </div>
      </sw-page>
    `}render(){if(g())return this.renderApi();const e=G.filter(l=>l.state==="live"||l.state==="stale").length,t=et.filter(l=>!l.acked),s=[{kind:"critical",title:"מצלמה מנותקת: מסדרון מזרחי",meta:"קומה 0 · מאז 07:55",why:"מוצג כי אין הקלטה ממצלמה זו כבר שעתיים",link:"#/system/devices"},{kind:"alert",title:`${t.length} אירועים שלא נבדקו`,meta:"אדם בכניסה הראשית 10:14, רכב בחצר 09:42",why:"מוצג כי אירועי אדם/רכב מחכים לסימון טיפול",link:"#/investigate/events"},{kind:"alert",title:"החיבור ל־Home Assistant לא רענן",meta:"סנכרון אחרון לפני 4 דק׳",why:"מוצג כי מצבי הישויות עלולים להיות מיושנים",link:"#/system/diagnostics"}],i=.68,a=34,n=2*Math.PI*a,o=G.filter(l=>l.state==="live").slice(0,2);return r`
      <sw-page heading="בוקר טוב, יוני" subheading="המערכת פועלת · גשר Home Assistant לא רענן · נתוני הדגמה">
        <div slot="actions" class="date">יום שני, 14 בספטמבר 2026<br />10:24</div>
        <div class="kpis">
          <sw-kpi icon="camera" tone="live" value=${String(e)} label="מצלמות" detail="מחוברות"></sw-kpi>
          <sw-kpi icon="building" value=${String(Pi.length)} label="אתרים" detail="פעילים" tone="neutral"></sw-kpi>
          <sw-kpi icon="bell" value=${String(et.length)} label="אירועים" detail="ב־24 השעות" tone="neutral" badge=${`${t.length} חדשים`}></sw-kpi>
          <sw-kpi icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר HA לא רענן"></sw-kpi>
        </div>
        <div class="fav">
          ${o.map(l=>r`<sw-camera-tile name=${l.name} state=${l.state} scene=${Ke[l.id]??"lobby"} @click=${()=>b(`/live/cameras/${l.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading="אחסון">
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label="אחסון בשימוש 68%">
                ${h`<circle cx="42" cy="42" r=${a} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                <circle cx="42" cy="42" r=${a} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${n*i} ${n}`} transform="rotate(-90 42 42)" />
                <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>`}
              </svg>
              <div class="txt">
                <div class="big">1.3 TB מתוך 1.9 TB</div>
                <div class="bar"><i></i></div>
                <div class="muted">הקלטה ישנה ביותר ≈ 11 ימים (נמדד) · overwrite פעיל</div>
              </div>
            </div>
          </sw-card>
          <sw-card heading="בריאות האתרים">
            ${Pi.map(l=>r`<div class="hrow"><span>${l.name}<div class="muted">${l.online}/${l.cameras} מצלמות · ${l.alerts} התראות</div></span><span class="status"><i style="--c:${l.health==="live"?"var(--sw-live)":l.health==="offline"?"var(--sw-danger)":"var(--sw-stale)"}"></i>${l.health==="live"?"מחובר":l.health==="offline"?"מנותק":"חלקי"}</span></div>`)}
            ${$r.slice(0,2).map(l=>r`<div class="hrow"><span>${l.name}<div class="muted">${l.detail}</div></span><span class="status"><i style="--c:${l.state==="live"?"var(--sw-live)":"var(--sw-stale)"}"></i>${l.state==="live"?"מחובר":"לא רענן"}</span></div>`)}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card heading="אירועים אחרונים">
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${et.slice(0,5).map(l=>r`<div class="ev" @click=${()=>b("/investigate/events")}>
                ${l.type==="offline"||l.type==="door"?r`<div class="none"><sw-icon name=${l.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:r`<sw-scene kind=${bd[l.camera]??"lobby"}></sw-scene>`}
                <div class="txt"><b style="--tone:${gd[l.type]}"><i></i>${Ii[l.type]}</b><small>${l.camera} · ${l.floor}</small></div>
                <time>${l.time}</time>
              </div>`)}
          </sw-card>
          <sw-card heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${s.map(l=>r`<div class="spot ${l.kind}">
                <div class="ic"><sw-icon name=${l.kind==="critical"?"offline":"warning"} size=${15}></sw-icon></div>
                <div><div class="t">${l.title}</div><div class="muted">${l.meta}</div><div class="why">${l.why}</div></div>
                <div class="actions"><a href=${l.link}><sw-button size="sm">פתח</sw-button></a></div>
              </div>`)}
          </sw-card>
        </div>
      </sw-page>
    `}};fe.styles=z`
    .date {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: end;
      line-height: 1.3;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .row2 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 12px;
      align-items: stretch;
    }
    .row3 {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .donut {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .donut svg {
      inline-size: 84px;
      block-size: 84px;
      flex-shrink: 0;
    }
    .donut .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .donut .big {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
      margin-block: 6px 4px;
    }
    .bar i {
      display: block;
      block-size: 100%;
      inline-size: 68%;
      background: var(--sw-accent);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .hrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .hrow:last-child {
      border-block-end: 0;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c);
    }
    .ev {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .ev:last-child {
      border-block-end: 0;
    }
    .ev sw-scene,
    .ev img.thumb,
    .ev .none {
      inline-size: 56px;
      block-size: 36px;
      border-radius: 6px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .ev img.thumb {
      object-fit: cover;
      display: block;
      background: var(--sw-surface-3);
    }
    .spot.info .ic {
      color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .ev .none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .ev .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .ev .txt b {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .ev .txt b i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--tone);
      flex-shrink: 0;
    }
    .ev .txt small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      display: block;
    }
    .ev time {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .spot {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      align-items: flex-start;
      font-size: var(--sw-fs-sm);
    }
    .spot:last-child {
      border-block-end: 0;
    }
    .spot .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
      flex-shrink: 0;
    }
    .spot.critical .ic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .spot .t {
      font-weight: var(--sw-fw-semibold);
    }
    .spot .why {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .spot .actions {
      margin-inline-start: auto;
      align-self: center;
    }
    .seeall {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .fav {
      display: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 1023px) {
      .row2,
      .row3 {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .fav {
        display: grid;
      }
      .date {
        display: none;
      }
    }
  `;Ae([d()],fe.prototype,"cams",2);Ae([d()],fe.prototype,"recorder",2);Ae([d()],fe.prototype,"sites",2);Ae([d()],fe.prototype,"summary",2);Ae([d()],fe.prototype,"summaryDenied",2);Ae([d()],fe.prototype,"recent",2);Ae([d()],fe.prototype,"storage",2);Ae([d()],fe.prototype,"health",2);Ae([d()],fe.prototype,"raw",2);Ae([d()],fe.prototype,"tz",2);Ae([d()],fe.prototype,"now",2);Ae([d()],fe.prototype,"loaded",2);fe=Ae([S("live-overview")],fe);var yd=Object.defineProperty,$d=Object.getOwnPropertyDescriptor,Fe=(e,t,s,i)=>{for(var a=i>1?void 0:i?$d(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&yd(t,s,a),a};const bi=[1,2,4,6,8,9,12,16,20,25,32],Ta="sw.wall.count",Oa=[{id:"all",label:"כל המצלמות"},{id:"outside",label:"חוץ"},{id:"inside",label:"פנים"},{id:"night",label:"לילה"}];let ze=class extends x{constructor(){super(...arguments),this.cameras="",this.count=4,this.stream="auto",this.view="all",this.cams=null,this.settings=null,this.error="",this.posterBust=Date.now(),this.colsOverride=(()=>{try{return Number(localStorage.getItem("sw.wall.cols")??0)||0}catch{return 0}})(),this.box={w:0,h:0},this.measure=()=>{const e=this.renderRoot.querySelector(".grid");if(!e)return;const t=Math.round(e.clientWidth),s=Math.round(window.innerHeight-e.getBoundingClientRect().top-56);(t!==this.box.w||s!==this.box.h)&&(this.box={w:t,h:s})}}setCols(e){this.colsOverride=e;try{localStorage.setItem("sw.wall.cols",String(e))}catch{}}bestFit(e){const{w:t,h:s}=this.box;if(!t||s<120||e<1)return null;const i=12;let a={cols:1,tile:0};for(let n=1;n<=e;n++){const o=Math.ceil(e/n),l=Math.min((t-i*(n-1))/n,(s-i*(o-1))/o*(16/9));l>a.tile&&(a={cols:n,tile:l})}return a.tile>80?{cols:a.cols,tile:Math.floor(a.tile)}:null}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),window.addEventListener("resize",this.measure)}updated(){this.measure()}connectedCallback(){super.connectedCallback(),this.load(),this.posterTimer=window.setInterval(()=>this.posterBust=Date.now(),6e4)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.posterTimer),this.ro?.disconnect(),window.removeEventListener("resize",this.measure)}setCount(e){this.count=e;try{localStorage.setItem(Ta,String(e))}catch{}}async load(){if(g())try{const[e,t]=await Promise.all([Te(),je()]);this.cams=e.cameras.filter(n=>n.enabled),this.settings=t;let s=0;try{s=Number(localStorage.getItem(Ta)??0)}catch{}const i=Number(t["ui.wall_count"]??0),a=bi.includes(s)?s:bi.includes(i)?i:0;a&&(this.count=a)}catch(e){this.error=w(e)}}renderApi(){const e=this.cams;if(this.error)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!e)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(!e.length)return r`<sw-state-panel state="empty" heading="אין מצלמות זמינות" hint="המצלמות מתגלות אוטומטית מה־NVR בהפעלה ובכל 10 דקות. אם הרשימה ריקה: בדוק את פרטי ה־NVR בהגדרות ה־Add-on ואת יומן ה־Add-on, או הרץ סנכרון ידני; ייתכן גם שאין לך הרשאה למצלמות."><div style="margin-block-start:10px"><sw-button @click=${()=>b("/system/devices")}>למצלמות</sw-button></div></sw-state-panel>`;const t=this.cameras?this.cameras.split(",").filter(Boolean):[],s=t.length?e.filter(v=>t.includes(v.id)):e,i=t.length?Math.max(1,s.length):this.count,a=s.slice(0,i),n=window.innerWidth>=768?this.bestFit(a.length):null,o=this.colsOverride?Math.min(this.colsOverride,Math.max(1,a.length)):n?n.cols:i===1?1:i===2||i<=4?2:i<=9?3:i<=16?4:i<=25?5:6;let l=n&&!this.colsOverride?n:null;if(this.box.w&&(this.colsOverride||!l)){const v=Math.ceil(a.length/o),$=Math.min((this.box.w-12*(o-1))/o,this.box.h>120?(this.box.h-12*(v-1))/v*(16/9):1/0);$>80&&Number.isFinite($)&&(l={cols:o,tile:Math.floor($)})}const p=this.settings?.["media.max_live_sessions"]??8,f=this.stream==="auto"?this.settings?.["media.wall_profile"]??"sub":this.stream,u=ia(this.settings);return r`
      <div class="grid ${l?"fit":""}" style="--cols:${o};--tile:${l?`${l.tile}px`:"auto"}" data-wall-cols=${o} ?data-wall-cols-manual=${!!this.colsOverride}>
        ${a.map((v,$)=>r`<sw-camera-tile
            name=${v.name}
            state=${v.status==="online"?"live":v.status==="offline"?"offline":"unknown"}
            ?live=${v.status!=="offline"&&v.can_view_live!==!1&&$<p}
            cameraId=${v.id}
            profile=${f}
            transport=${u}
            poster=${v.status==="offline"?"":qe(v.id,this.posterBust)}
            ?compact=${i>=9}
            @click=${()=>b(`/live/cameras/${v.id}`)}></sw-camera-tile>`)}
      </div>
      ${t.length?r`<div class="note" data-wall-picked>מפה: ${a.length} מצלמות שנבחרו${a.length<t.length?` (${t.length-a.length} לא זמינות)`:""} · <a href="#/live/wall">כל המצלמות</a></div>`:c}
      <div class="note" data-wall-cols-row style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">עמודות:
        ${[0,1,2,3,4,5,6].map(v=>r`<button class="colbtn ${this.colsOverride===v?"on":""}" data-wall-cols-set=${v} @click=${()=>this.setCols(v)}>${v===0?"אוטו":v}</button>`)}
      </div>
      <div class="note">${a.length} מתוך ${e.length} מצלמות · פרופיל ${f==="sub"?"משני":"ראשי"} · תעבורה ${u} · מכסת זרמים ${p}${a.length>p?" — מעבר למכסה מוצג צילום בלבד":""} · צילומים מתרעננים כל דקה</div>
    `}renderDemo(){const e=G.slice(0,this.count),t=this.count===1?1:this.count===2||this.count<=4?2:this.count<=9?3:4;return r`
      <div class="grid" style="--cols:${t}">
        ${e.map(s=>r`<sw-camera-tile name=${s.name} meta=${`${s.floor} · ${this.stream==="auto"?this.count>4?"משני":"ראשי":this.stream==="main"?"ראשי":"משני"}`} state=${s.state} scene=${Ke[s.id]??"lobby"} ?compact=${this.count>=9} @click=${()=>b(`/live/cameras/${s.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">נתוני הדגמה: קיר של ${this.count} אריחים אינו פותח ${this.count} זרמים ראשיים במקביל; במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד.</div>
    `}openKiosk(){const e=`${window.location.origin}${window.location.pathname}${window.location.search}#/kiosk/all`;window.open(e,"_blank","noopener")}render(){const e=g(),t=e?this.cams?.length??0:G.length;return r`
      <sw-page heading="כל המצלמות" subheading="${t} מצלמות${e?"":` · תצוגה: ${Oa.find(s=>s.id===this.view)?.label} · נתוני הדגמה`}" wide>
        ${e?c:r`<sw-field slot="actions"><select aria-label="תצוגה" @change=${s=>this.view=s.target.value}>${Oa.map(s=>r`<option value=${s.id} ?selected=${s.id===this.view}>${s.label}</option>`)}</select></sw-field>`}
        <sw-field slot="actions"><select aria-label="זרם" @change=${s=>this.stream=s.target.value}><option value="auto">חי · אוטומטי</option><option value="main">חי · ראשי</option><option value="sub">חי · משני</option></select></sw-field>
        <div slot="actions" class="layouts" role="group" aria-label="פריסה">
          ${bi.map(s=>r`<button class=${s===this.count&&!this.cameras?"on":""} @click=${()=>{this.setCount(s),this.cameras&&b("/live/wall")}} aria-pressed=${s===this.count&&!this.cameras}>${s}</button>`)}
        </div>
        <sw-button slot="actions" variant="ghost" icon="expand" data-open-kiosk title="פותח את הקיוסק בלשונית חדשה" @click=${()=>this.openKiosk()}>קיוסק</sw-button>
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};ze.styles=z`
    .layouts {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    .layouts button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 28px;
      block-size: 26px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--sw-text-2);
      padding: 0 6px;
    }
    .layouts button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    sw-field {
      inline-size: 140px;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    }
    /* best fit (0.1.68): the tiles fill the screen as a rectangle - as many columns as make the tiles biggest */
    .colbtn {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      border-radius: 6px;
      padding: 2px 8px;
      cursor: pointer;
    }
    .colbtn.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .grid.fit {
      grid-template-columns: repeat(var(--cols), var(--tile));
      justify-content: center;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    @media (max-width: 767px) {
      .grid {
        gap: 8px;
      }
      /* a safe default cap on phones so auto layout never crams tiny tiles - but an explicit column
         choice (owner round 4, 1.7) is a deliberate override and wins even here. */
      .grid:not([data-wall-cols-manual]) {
        grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
      }
    }
  `;Fe([m()],ze.prototype,"cameras",2);Fe([d()],ze.prototype,"count",2);Fe([d()],ze.prototype,"stream",2);Fe([d()],ze.prototype,"view",2);Fe([d()],ze.prototype,"cams",2);Fe([d()],ze.prototype,"settings",2);Fe([d()],ze.prototype,"error",2);Fe([d()],ze.prototype,"posterBust",2);Fe([d()],ze.prototype,"colsOverride",2);Fe([d()],ze.prototype,"box",2);ze=Fe([S("live-wall")],ze);const xd=()=>k("nvr/notify"),kd=e=>Me("nvr/notify",e),Da=(e=20)=>k(`nvr/changes?limit=${e}`),_d=e=>M(`nvr/changes/${e}/rollback`),zd=e=>k(`cameras/${e}/record`),Sd=(e,t)=>M(`cameras/${e}/record/start`,{minutes:t}),Md=e=>M(`cameras/${e}/record/stop`),Ad=(e,t)=>Me(`cameras/${e}/motion`,t),Ed=()=>k("nvr/system"),Pd=e=>Me("nvr/time",e),Id=e=>Me("nvr/ntp",e),Cd=e=>M(`nvr/outputs/${e}/pulse`),Td=(e,t="short")=>M(`nvr/storage/${e}/smart-test`,{kind:t}),Od=e=>M("nvr/reboot",{confirm:e}),Dd=()=>k("nvr/connection"),Rd=e=>Me("nvr/connection",e),Nd=e=>k(`cameras/${e}/osd`),yi=(e,t)=>Me(`cameras/${e}/osd`,t),Bd=e=>k(`cameras/${e}/schedules`),Ld=(e,t,s)=>Me(`cameras/${e}/schedules/${t}`,{days:s}),Hd=(e,t)=>Me(`cameras/${e}/record-schedule`,t),Vd=e=>k(`cameras/${e}/smart`),jd=(e,t)=>Me(`cameras/${e}/smart`,t),Fd=(e,t)=>M(`cameras/${e}/osd/name`,{});var Wd=Object.defineProperty,Ud=Object.getOwnPropertyDescriptor,is=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ud(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Wd(t,s,a),a};const Zd=[6,0,1,2,3,4,5],Ra=["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],Wt=e=>String(e).padStart(2,"0"),Na=e=>Number(e.slice(0,2))+Number(e.slice(3,5))/60;function qd(e){return Array.from({length:7},(t,s)=>{const i=Array.from({length:24},()=>"");for(const a of e[s]??[]){const n=Math.floor(Na(a.begin)),o=Math.min(24,Math.ceil(Na(a.end)));for(let l=n;l<o;l++)i[l]=a.mode??"on"}return i})}function Kd(e,t){return e.map(s=>{const i=[];let a=0;for(;a<24;){const n=s[a];if(!n){a++;continue}let o=a;for(;o<24&&s[o]===n;)o++;i.push(t?{begin:`${Wt(a)}:00:00`,end:`${Wt(o)}:00:00`,mode:n}:{begin:`${Wt(a)}:00:00`,end:`${Wt(o)}:00:00`}),a=o}return i})}let gt=class extends x{constructor(){super(...arguments),this.days=Array.from({length:7},()=>[]),this.modes=[{id:"on",label:"פעיל",color:"var(--sw-accent)"}],this.mode="on",this.editable=!1,this.painting=null,this.cells=[],this.lastDays=null,this.end=()=>{this.painting=null},this.onDown=e=>{if(!this.editable||e.button!==0)return;const t=this.cellAt(e);t&&(e.preventDefault(),e.currentTarget.setPointerCapture(e.pointerId),this.paint(t[0],t[1],!0))},this.onMove=e=>{if(this.painting===null||!e.buttons)return;const t=this.cellAt(e);t&&this.paint(t[0],t[1],!1)}}sync(){this.lastDays!==this.days&&(this.cells=qd(this.days),this.lastDays=this.days)}colorOf(e){return this.modes.find(t=>t.id===e)?.color??"var(--sw-accent)"}paint(e,t,s){if(!this.editable||(s&&(this.painting=this.cells[e][t]===this.mode?"":this.mode),this.painting===null)||this.cells[e][t]===this.painting)return;this.cells=this.cells.map((a,n)=>n===e?a.map((o,l)=>l===t?this.painting:o):a);const i=Kd(this.cells,this.modes.length>1||this.modes[0]?.id!=="on");this.lastDays=i,this.days=i,this.dispatchEvent(new CustomEvent("change",{detail:{days:i},bubbles:!0,composed:!0}))}cellAt(e){const t=this.renderRoot,i=(t.elementFromPoint?t.elementFromPoint(e.clientX,e.clientY):null)?.dataset?.cell;if(!i)return null;const[a,n]=i.split("-").map(Number);return Number.isFinite(a)&&Number.isFinite(n)?[a,n]:null}connectedCallback(){super.connectedCallback(),window.addEventListener("pointerup",this.end)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerup",this.end)}renderLegend(){const e=this.editable&&this.modes.length>1;return r`<div class="legend" data-week-legend>
      <span class="lbl">מקרא:</span>
      ${this.modes.map(t=>e?r`<button class=${t.id===this.mode?"on":""} data-week-mode=${t.id} @click=${()=>this.mode=t.id}><span class="sw" style="background:${t.color}"></span>${t.label}</button>`:r`<span class="chip"><span class="sw" style="background:${t.color}"></span>${t.label}</span>`)}
      <span class="chip muted"><span class="sw empty"></span>${this.modes.length>1?"ללא":"לא פעיל"}</span>
      ${e?r`<span class="hint">לחיצה על תא צבוע באותו צבע מנקה אותו</span>`:c}
    </div>`}render(){return this.sync(),r`
      <div class="grid" role="grid" aria-label="לוח שבועי" @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.end} @pointercancel=${this.end}>
        <span></span>
        ${Array.from({length:24},(e,t)=>r`<span class="h">${t%3===0?t:""}</span>`)}
        ${Zd.map((e,t)=>r`
          <span class="d">${Ra[t]}</span>
          ${this.cells[e].map((s,i)=>r`<div class="c ${s?"on":""}" data-cell=${`${e}-${i}`} data-mode=${s} style=${s?`--cell:${this.colorOf(s)}`:""} title=${`${Ra[t]} ${Wt(i)}:00–${Wt(i+1)}:00${s?` · ${this.modes.find(a=>a.id===s)?.label??s}`:""}`}></div>`)}
        `)}
      </div>
      ${this.renderLegend()}
    `}};gt.styles=z`
    :host {
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      user-select: none;
    }
    .grid {
      display: grid;
      grid-template-columns: 28px repeat(24, minmax(0, 1fr));
      gap: 2px;
    }
    .h {
      color: var(--sw-text-3);
      text-align: center;
      font-size: 10px;
    }
    .d {
      color: var(--sw-text-2);
      align-self: center;
      text-align: center;
      font-weight: var(--sw-fw-semibold);
    }
    .c {
      block-size: 18px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      border: 1px solid transparent;
    }
    .c.on {
      background: var(--cell, var(--sw-accent));
    }
    :host([editable]) .c {
      cursor: crosshair;
    }
    .legend {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 6px;
      direction: rtl;
      align-items: center;
    }
    .legend button {
      font: inherit;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: 999px;
      padding: 2px 10px;
      cursor: pointer;
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .legend button.on {
      outline: 2px solid var(--sw-accent);
    }
    .legend .lbl {
      color: var(--sw-text-3);
    }
    .legend .chip {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .legend .chip.muted {
      color: var(--sw-text-3);
    }
    .legend .hint {
      color: var(--sw-text-3);
    }
    .sw {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 3px;
      display: inline-block;
    }
    .sw.empty {
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border-strong);
    }
  `;is([m({attribute:!1})],gt.prototype,"days",2);is([m({attribute:!1})],gt.prototype,"modes",2);is([m()],gt.prototype,"mode",2);is([m({type:Boolean})],gt.prototype,"editable",2);is([d()],gt.prototype,"painting",2);gt=is([S("sw-week-grid")],gt);var Gd=Object.defineProperty,Yd=Object.getOwnPropertyDescriptor,P=(e,t,s,i)=>{for(var a=i>1?void 0:i?Yd(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Gd(t,s,a),a};let E=class extends x{constructor(){super(...arguments),this.cameraId="cam-1",this.cam=null,this.zones=null,this.zonesBusy=!1,this.zonesError="",this.motionEdit=null,this.motionConfirm=!1,this.motionBusy=!1,this.motionMsg="",this.paintValue=null,this.rec=null,this.osd=null,this.sched=null,this.schedError="",this.schedTab="motion",this.schedEdit=null,this.schedBusy=!1,this.schedMsg="",this.schedConfirm=!1,this.smart=null,this.smartEdit=null,this.smartBusy=!1,this.smartMsg="",this.osdMsg="",this.renameTo=null,this.renameBusy=!1,this.renameMsg="",this.osdBusy=!1,this.recMinutes=10,this.recBusy=!1,this.recMsg="",this.recTimer=0,this.zoneLayers={motion:!0,privacy:!0,intrusion:!0,lines:!0},this.caps=null,this.capsError="",this.cams=[],this.canConfigure=!1,this.settings=null,this.error="",this.loading=!0,this.profile="main",this.transport="auto",this.playerStatus="",this.playerTransport="",this.posterBust=Date.now(),this.ptzMode="presets"}async loadSchedules(){if(!(!this.cam||!g())){try{this.sched=await Bd(this.cam.id),this.schedError="",!this.sched.arming[this.schedTab]&&this.schedTab!=="record"&&(this.schedTab=Object.keys(this.sched.arming)[0]??"record")}catch(e){this.schedError=w(e)}try{this.smart=await Vd(this.cam.id)}catch{this.smart=null}}}startSchedEdit(){const e=this.sched;if(!e)return;const t=this.schedTab,s=(t==="record"?e.record?.days:e.arming[t])??Array.from({length:7},()=>[]);this.schedMsg="",this.schedEdit={kind:t,days:s.map(i=>i.map(a=>({...a}))),schedule_enabled:e.record?.schedule_enabled??null,enabled:e.record?.enabled}}schedDiff(){const e=this.schedEdit,t=this.sched;if(!e||!t)return 0;const s=(e.kind==="record"?t.record?.days:t.arming[e.kind])??[],i=a=>a.map(n=>n.map(o=>`${o.begin}-${o.end}-${o.mode??""}`).join(",")).join("|");return i(s)===i(e.days)?0:1}async saveSched(){const e=this.schedEdit;if(!(!e||!this.cam||this.schedBusy)){this.schedBusy=!0,this.schedConfirm=!1;try{const t=e.kind==="record"?await Hd(this.cam.id,{days:e.days,...e.schedule_enabled!==null&&e.schedule_enabled!==this.sched?.record?.schedule_enabled?{schedule_enabled:e.schedule_enabled??void 0}:{}}):await Ld(this.cam.id,e.kind,e.days);this.schedMsg=t.status==="unchanged"?"ה־NVR כבר היה במצב הזה — לא נכתב דבר.":"הלוח נכתב ל־NVR ונרשם (ניתן להחזרה מרשימת השינויים בהגדרות › חיבורים).",this.schedEdit=null,await this.loadSchedules()}catch(t){this.schedMsg=w(t)}finally{this.schedBusy=!1}}}renderSchedules(){const e=this.sched;if(this.schedError&&!e)return r`<div class="note">${this.schedError}</div>`;if(!e)return r`<div class="note">קורא לוחות מה־NVR…</div>`;const t=[{id:"motion",label:"זיהוי תנועה",ok:!!e.arming.motion},{id:"line",label:"חציית קו",ok:!!e.arming.line},{id:"field",label:"פריצה לאזור",ok:!!e.arming.field},{id:"record",label:"לוח הקלטה",ok:!!e.record}],s=this.schedTab,i=this.schedEdit?.kind===s?this.schedEdit:null,a=i?i.days:s==="record"?e.record?.days:e.arming[s],n=[{id:"CMR",label:"רציף",color:"#2f6bff"},{id:"MOTION",label:"תנועה",color:"#16a34a"},{id:"EDR",label:"אירוע",color:"#f59e0b"},{id:"ALARM",label:"אזעקה",color:"#dc2626"}],o=s==="record"?e.can.schedule:e.can.events,l=t.find(p=>p.id===s)?.label??"";return r`<div class="note">${t.length} לוחות בכרטיס הזה, כולל <strong>לוח הקלטה</strong> (מתי הערוץ מקליט בפועל) — לא רק לוחות הזיהוי.</div>
      <div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-end:8px" data-schedules-tabs>
        ${t.map(p=>r`<sw-chip ?selected=${s===p.id} ?disabled=${!p.ok} data-sched-tab=${p.id} title=${p.ok?"":e.unsupported[p.id]??"לא נתמך בערוץ זה"} @click=${()=>{p.ok&&(this.schedTab=p.id,this.schedEdit=null)}}>${p.label}${p.ok?"":" · לא זמין"}</sw-chip>`)}
        <span class="grow"></span>
        ${o&&!i?r`<sw-button size="sm" icon="edit" data-sched-edit @click=${()=>this.startSchedEdit()}>עריכה</sw-button>`:c}
      </div>
      ${a?r`<sw-week-grid data-week-grid .days=${a} .modes=${s==="record"?n:[{id:"on",label:"פעיל",color:"var(--sw-accent)"}]} ?editable=${!!i}
            @change=${p=>{this.schedEdit&&(this.schedEdit={...this.schedEdit,days:p.detail.days})}}></sw-week-grid>`:r`<div class="note">הלוח הזה לא נקרא מה־NVR${e.unsupported[s]?` (${e.unsupported[s]})`:""}.</div>`}
      ${s==="record"&&e.record?r`<div class="note" style="margin-block-start:6px">ברירת מחדל: ${e.record.default_mode??"—"} · לפני אירוע ${e.record.pre_record_s??"—"} שנ׳ · אחרי ${e.record.post_record_s??"—"} שנ׳ · הקלטה ${e.record.enabled?"פעילה":"כבויה"} · לוח ${e.record.schedule_enabled===!1?"כבוי (מקליט לפי ברירת המחדל)":"פעיל"}
            ${i?r`<label style="display:inline-flex;gap:4px;align-items:center;margin-inline-start:8px"><input type="checkbox" data-sched-enabled .checked=${i.schedule_enabled!==!1} @change=${p=>this.schedEdit={...i,schedule_enabled:p.target.checked}} /> לוח פעיל</label>`:c}</div>`:c}
      ${i?r`<div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-start:8px" data-sched-editor>
            <span class="note">${s==="record"?"צבע = מצב הקלטה לשעה זו; תא ריק = אין הקלטה בשעה זו. טעות כאן = שעות בלי הקלטה, לכן יש אישור והחזר.":"תא צבוע = הזיהוי פעיל בשעה זו; כיבוי כל היום = בלי התראות מהערוץ בזמן הזה."}</span>
            <span class="grow"></span>
            <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.schedBusy||!this.schedDiff()&&(s!=="record"||i.schedule_enabled===(e.record?.schedule_enabled??null))} data-sched-save @click=${()=>this.schedConfirm=!0}>שמור ל־NVR</sw-button>
            <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.schedBusy} data-sched-cancel @click=${()=>this.schedEdit=null}>ביטול</sw-button>
          </div>`:c}
      ${this.schedConfirm&&i?r`<sw-dialog open heading=${`כתיבה ל־NVR: ${l}`} subheading=${`${this.cam?.name??""} · ערוץ ${e.channel}`} data-sched-confirm @close=${()=>this.schedConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${i.days.map(p=>p.length).reduce((p,f)=>p+f,0)} טווחים בשבוע${s==="record"?` · ${i.days.flat().filter(p=>p.mode==="CMR").length} רציף, ${i.days.flat().filter(p=>p.mode==="MOTION").length} תנועה, ${i.days.flat().filter(p=>p.mode==="EDR").length} אירוע`:""}.</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה בלחיצה.</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.schedBusy} data-sched-confirm-run @click=${()=>this.saveSched()}>${this.schedBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.schedConfirm=!1}>ביטול</sw-button></div>
          </sw-dialog>`:c}
      ${this.schedMsg?r`<div class="note" data-sched-msg>${this.schedMsg}</div>`:c}`}startSmartEdit(){const e=this.smart;if(!e)return;this.smartMsg="";const t=e.line?{enabled:e.line.enabled,lines:e.line.lines.map(i=>({...i,points:i.points.map(a=>[...a])}))}:null,s=e.field?{enabled:e.field.enabled,regions:e.field.regions.map(i=>({...i,points:i.points.map(a=>[...a])}))}:null;this.smartEdit={line:t,field:s,tool:t?{type:"line",id:t.lines[0]?.id??1}:{type:"field",id:s?.regions[0]?.id??1}}}smartClick(e){const t=this.smartEdit;if(!t)return;const i=e.currentTarget.getBoundingClientRect(),a=Math.round(Math.max(0,Math.min(1e3,(e.clientX-i.left)/i.width*1e3))),n=Math.round(Math.max(0,Math.min(1e3,(e.clientY-i.top)/i.height*1e3)));if(t.tool.type==="line"&&t.line){const o=t.line.lines.map(l=>{if(l.id!==t.tool.id)return l;const f=[...l.points.length>=2&&!(l.points[0][0]===0&&l.points[0][1]===1e3&&l.points[1][0]===0&&l.points[1][1]===1e3)&&l.points.length!==1?[]:l.points.filter(u=>!(u[0]===0&&u[1]===1e3)),[a,n]].slice(-2);return{...l,points:f,enabled:f.length===2?!0:l.enabled}});this.smartEdit={...t,line:{...t.line,lines:o}}}else if(t.tool.type==="field"&&t.field){const o=t.field.regions.map(l=>l.id===t.tool.id&&l.points.length<10?{...l,points:[...l.points,[a,n]]}:l);this.smartEdit={...t,field:{...t.field,regions:o}}}}async saveSmart(){const e=this.smartEdit;if(!(!e||!this.cam||this.smartBusy)){this.smartBusy=!0;try{const t={};e.line&&(t.line={enabled:e.line.enabled,lines:e.line.lines.filter(n=>n.points.length===2)}),e.field&&(t.field={enabled:e.field.enabled,regions:e.field.regions.filter(n=>n.points.length===0||n.points.length>=4)});const s=await jd(this.cam.id,t),i=Object.values(s).map(n=>n.status),a=Object.values(s).some(n=>n.enable_refused);this.smartMsg=i.every(n=>n==="unchanged")?"ה־NVR כבר היה במצב הזה — לא נכתב דבר.":a?"הצורות והפרמטרים נכתבו ל־NVR ונרשמו, אבל ה־NVR סירב להפעיל את הכלל דרך ה־ISAPI (invalidOperation). בקושחה הזו ההפעלה נעשית בממשק ה־NVR / המצלמה (משאב VCA של המצלמה); אחרי ההפעלה שם התצוגה כאן תתעדכן.":'הכללים נכתבו ל־NVR ונרשמו (ניתנים להחזרה). התראות "אדם" / "רכב" מגיעות רק כשהערוץ מודיע ל־VMS (הגדרות › חיבורים › התראות מה־NVR).',this.smartEdit=null,await Promise.all([this.loadSchedules(),this.loadZones(!0)])}catch(t){this.smartMsg=w(t)}finally{this.smartBusy=!1}}}renderSmartOverlay(){const e=this.smartEdit;if(!e)return c;const t=(s,i)=>e.tool.type===s&&e.tool.id===i;return h`
      ${e.field?e.field.regions.filter(s=>s.points.length>=1).map(s=>h`<polygon points=${s.points.map(i=>i.join(",")).join(" ")} class="field" style=${t("field",s.id)?"stroke:#fff;stroke-width:6":""}></polygon>${s.points.map(i=>h`<circle cx=${i[0]} cy=${i[1]} r="9" fill="#f59e0b" stroke="#fff" stroke-width="3"></circle>`)}`):c}
      ${e.line?e.line.lines.filter(s=>s.points.length>=1&&!(s.points[0][0]===0&&s.points[0][1]===1e3)).map(s=>h`<polyline points=${s.points.map(i=>i.join(",")).join(" ")} class="line ${s.enabled?"":"off"}" style=${t("line",s.id)?"stroke:#fff":""}></polyline>${s.points.map(i=>h`<circle cx=${i[0]} cy=${i[1]} r="9" fill="#2f6bff" stroke="#fff" stroke-width="3"></circle>`)}`):c}
    `}renderSmartEditor(){const e=this.smartEdit,t=s=>({any:"שני הכיוונים","left-right":"שמאל → ימין","right-left":"ימין → שמאל"})[s]??s;return r`<div class="legend" data-smart-editor style="display:grid;gap:8px;margin-block-start:8px">
      <div class="note">בחר כלל ולחץ על התמונה כדי לצייר: קו = <strong>שתי</strong> לחיצות (התחלה וסוף — לחיצה נוספת מזיזה את הסוף); אזור פריצה = <strong>4 עד 10</strong> לחיצות (נקודה לכל פינה), ואז ישר "שמור ל־NVR" למטה — אין צורך לסגור את הצורה. "אדם" / "רכב" = סינון אזעקות שווא (רק מטרה מסוג זה מפעילה).</div>
      ${e.line?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-lines>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" data-smart-line-enabled .checked=${e.line.enabled} @change=${s=>this.smartEdit={...e,line:{...e.line,enabled:s.target.checked}}} /> חציית קו פעילה</label>
          ${e.line.lines.map(s=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:8px;padding:4px 8px" data-smart-line=${s.id}>
            <sw-chip ?selected=${e.tool.type==="line"&&e.tool.id===s.id} data-smart-pick-line=${s.id} @click=${()=>this.smartEdit={...e,tool:{type:"line",id:s.id}}}>קו ${s.id}${s.points.length===2&&!(s.points[0][0]===0&&s.points[0][1]===1e3)?"":" · לא מצויר"}</sw-chip>
            <label class="note"><input type="checkbox" .checked=${s.enabled} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(a=>a.id===s.id?{...a,enabled:i.target.checked}:a)}}} /> פעיל</label>
            <select class="note" aria-label="כיוון" .value=${s.direction} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(a=>a.id===s.id?{...a,direction:i.target.value}:a)}}}>${["any","left-right","right-left"].map(i=>r`<option value=${i} ?selected=${i===s.direction}>${t(i)}</option>`)}</select>
            <label class="note">רגישות <input type="range" min="1" max="100" .value=${String(s.sensitivity)} @input=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(a=>a.id===s.id?{...a,sensitivity:Number(i.target.value)}:a)}}} /> ${s.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${s.human} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(a=>a.id===s.id?{...a,human:i.target.checked}:a)}}} /> אדם</label>
            <label class="note"><input type="checkbox" .checked=${s.vehicle} @change=${i=>this.smartEdit={...e,line:{...e.line,lines:e.line.lines.map(a=>a.id===s.id?{...a,vehicle:i.target.checked}:a)}}} /> רכב</label>
          </span>`)}
        </div>`:c}
      ${e.field?r`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-regions>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" data-smart-field-enabled .checked=${e.field.enabled} @change=${s=>this.smartEdit={...e,field:{...e.field,enabled:s.target.checked}}} /> פריצה לאזור פעילה</label>
          ${e.field.regions.map(s=>r`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:8px;padding:4px 8px" data-smart-region=${s.id}>
            <sw-chip ?selected=${e.tool.type==="field"&&e.tool.id===s.id} data-smart-pick-region=${s.id} @click=${()=>this.smartEdit={...e,tool:{type:"field",id:s.id}}}>אזור ${s.id} · ${s.points.length} נק׳</sw-chip>
            <sw-button size="sm" variant="ghost" data-smart-region-clear=${s.id} @click=${()=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(i=>i.id===s.id?{...i,points:[]}:i)}}}>נקה</sw-button>
            <label class="note">רגישות <input type="range" min="1" max="100" .value=${String(s.sensitivity)} @input=${i=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(a=>a.id===s.id?{...a,sensitivity:Number(i.target.value)}:a)}}} /> ${s.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${s.human} @change=${i=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(a=>a.id===s.id?{...a,human:i.target.checked}:a)}}} /> אדם</label>
            <label class="note"><input type="checkbox" .checked=${s.vehicle} @change=${i=>this.smartEdit={...e,field:{...e.field,regions:e.field.regions.map(a=>a.id===s.id?{...a,vehicle:i.target.checked}:a)}}} /> רכב</label>
          </span>`)}
        </div>`:c}
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="grow"></span>
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.smartBusy} data-smart-save @click=${()=>this.saveSmart()}>${this.smartBusy?"כותב…":"שמור ל־NVR"}</sw-button>
        <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.smartBusy} data-smart-cancel @click=${()=>this.smartEdit=null}>ביטול</sw-button>
      </div>
    </div>`}async saveRename(){if(!(this.renameTo===null||!this.cam||this.renameBusy)){this.renameBusy=!0,this.renameMsg="";try{const e=await _r(this.cam.id,{alias:this.renameTo.trim()});this.cam={...this.cam,...e},this.cams=this.cams.map(t=>t.id===e.id?{...t,...e}:t),this.renameTo=null,this.loadOsd()}catch(e){this.renameMsg=w(e)}finally{this.renameBusy=!1}}}renderRename(){return this.renameTo===null?c:r`<sw-dialog open heading="שינוי שם המצלמה" subheading="השם במערכת (בקיר, במפה, באירועים). השם ב־NVR לא משתנה, אלא אם כותבים אותו מסעיף ה־OSD למטה." data-rename-dialog @close=${()=>this.renameTo=null}>
      <sw-field label="שם"><input data-rename-input maxlength="80" .value=${this.renameTo} placeholder=${this.cam?.name_source??""} @input=${e=>this.renameTo=e.target.value} @keydown=${e=>{e.key==="Enter"&&this.saveRename()}} /></sw-field>
      <div class="note">ריק = השם מה־NVR${this.cam?.name_source?` („${this.cam.name_source}“)`:""}.</div>
      ${this.renameMsg?r`<div class="note" style="color:var(--sw-danger)">${this.renameMsg}</div>`:c}
      <div slot="footer"><sw-button variant="primary" icon="check" ?disabled=${this.renameBusy} data-rename-save @click=${()=>this.saveRename()}>שמור</sw-button><sw-button variant="ghost" @click=${()=>this.renameTo=null}>ביטול</sw-button></div>
    </sw-dialog>`}async loadOsd(){if(!(!this.cam||!g()))try{this.osd=await Nd(this.cam.id)}catch{this.osd=null}}async osdAction(e,t){if(!this.osdBusy){this.osdBusy=!0,this.osdMsg="";try{await t(),this.osdMsg=`${e}: נכתב ל־NVR ונרשם.`,await this.loadOsd()}catch(s){this.osdMsg=`${e}: ${w(s)}`}finally{this.osdBusy=!1}}}renderOsd(){const e=this.osd;if(!e||!e.can_write)return c;const t=(e.nvr_name??"")===e.vms_name;return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-osd>
      <span>שם ב־NVR: <b data-osd-nvr-name>${e.nvr_name??"—"}</b>${t?" (זהה לשם ב־VMS)":` · ב־VMS: ${e.vms_name}`}</span>
      <sw-button size="sm" icon="edit" ?disabled=${this.osdBusy||t} data-osd-write-name @click=${()=>this.osdAction("שם הערוץ",()=>Fd(this.cam.id))}>כתוב את שם ה־VMS ל־NVR</sw-button>
      ${e.channel_name?r`<label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-osd-name-enabled .checked=${e.channel_name.enabled} ?disabled=${this.osdBusy} @change=${s=>this.osdAction("שם על התמונה",()=>yi(this.cam.id,{name_enabled:s.target.checked}))} /> שם על התמונה</label>`:c}
      ${e.datetime?r`<label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-osd-datetime-enabled .checked=${e.datetime.enabled} ?disabled=${this.osdBusy} @change=${s=>this.osdAction("חותמת זמן",()=>yi(this.cam.id,{datetime_enabled:s.target.checked}))} /> חותמת זמן</label>
        <sw-field><select aria-label="פורמט תאריך" data-osd-date-style ?disabled=${this.osdBusy} @change=${s=>this.osdAction("פורמט תאריך",()=>yi(this.cam.id,{date_style:s.target.value}))}>${e.date_styles.map(s=>r`<option value=${s} ?selected=${s===e.datetime.date_style}>${s}</option>`)}</select></sw-field>`:c}
      ${this.osdMsg?r`<span data-osd-msg>${this.osdMsg}</span>`:c}
    </div>`}async loadRecord(){if(!(!this.cam||!g())){try{this.rec=await zd(this.cam.id)}catch{this.rec=null}window.clearTimeout(this.recTimer),this.rec?.active&&(this.recTimer=window.setTimeout(()=>void this.loadRecord(),15e3))}}async toggleRecord(){if(!(!this.cam||this.recBusy)){this.recBusy=!0,this.recMsg="";try{if(this.rec?.active)await Md(this.cam.id),this.recMsg="ההקלטה הידנית נעצרה.";else{const e=await Sd(this.cam.id,this.recMinutes);this.recMsg=`הקלטה ידנית החלה · תיעצר אוטומטית ב־${new Date(e.stop_at).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}.`}await this.loadRecord()}catch(e){this.recMsg=w(e)}finally{this.recBusy=!1}}}renderRecord(){const e=this.rec;if(!e||!e.can_write)return c;const t=e.active,s=t?`${Math.floor(t.remaining_s/60)}:${String(t.remaining_s%60).padStart(2,"0")}`:"";return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-manual-record data-active=${t?"yes":"no"}>
      ${t?r`<sw-badge kind="live" label=${`הקלטה ידנית פעילה · נותרו ${s}`}></sw-badge>
          <sw-button size="sm" variant="danger" icon="close" ?disabled=${this.recBusy} data-record-stop @click=${()=>this.toggleRecord()}>עצור הקלטה</sw-button>`:r`<sw-field><select aria-label="משך הקלטה ידנית" data-record-minutes @change=${i=>this.recMinutes=Number(i.target.value)}>${[5,10,30,60,120].map(i=>r`<option value=${i} ?selected=${i===this.recMinutes}>${i} דק׳</option>`)}</select></sw-field>
          <sw-button size="sm" variant="primary" icon="live" ?disabled=${this.recBusy||!e.track_id} data-record-start @click=${()=>this.toggleRecord()}>הקלט עכשיו</sw-button>
          ${e.track_id?r`<span>הקלטה ידנית ב־NVR על הזרם הראשי; נעצרת אוטומטית בתום הזמן גם אם המסך נסגר. ההקלטה עצמה מצטרפת להקלטות הרגילות של הערוץ — היא נמצאת לפי הזמן במסך "הקלטות", לא בתגית נפרדת.</span>`:r`<span class="warn" data-record-unavailable>אין זרם ראשי זמין למצלמה זו כרגע, אי אפשר להקליט ידנית.</span>`}`}
      ${this.recMsg?r`<span data-record-msg>${this.recMsg}</span>`:c}
    </div>`}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load(),e.has("cam")&&this.cam&&g()&&!this.zonesBusy&&(!this.zones||this.zones.camera_id!==this.cam.id)&&(this.loadRecord(),this.loadOsd(),this.loadSchedules(),this.zonesError="",this.loadZones()),e.has("cam")&&this.cam&&g()&&(!this.caps||this.caps.camera_id!==this.cam.id)&&this.loadCaps()}async loadZones(e=!1){if(this.cam){this.zonesBusy=!0,this.zonesError="";try{this.zones=await io(this.cam.id,e)}catch(t){this.zonesError=w(t)}finally{this.zonesBusy=!1}}}async loadCaps(e=!1){if(this.cam){this.capsError="";try{this.caps=await ao(this.cam.id,e)}catch(t){this.capsError=w(t)}}}renderCaps(){const e=this.caps;if(this.capsError&&!e)return r`<div class="note" data-caps>יכולות המצלמה לא נקראו מה־NVR: ${this.capsError}</div>`;if(!e)return r`<div class="note" data-caps>קורא יכולות מה־NVR…</div>`;const t=e.ptz.state==="supported"?"live":e.ptz.state==="unsupported"?"neutral":"unknown",s=e.ptz.state==="supported"?`PTZ: נתמך${e.ptz.preset_count!==null?` · ${e.ptz.preset_count} presets`:""}`:e.ptz.state==="unsupported"?"PTZ: לא נתמך במצלמה זו":"PTZ: לא ידוע",i=e.audio.state==="available"?"live":e.audio.state==="disabled"?"stale":e.audio.state==="unsupported"?"neutral":"unknown",a=e.audio.state==="available"?`שמע דו־כיווני: ערוץ פעיל${e.audio.codec?` (${e.audio.codec})`:""}`:e.audio.state==="disabled"?"שמע דו־כיווני: ערוץ קיים אך כבוי במכשיר":e.audio.state==="unsupported"?"שמע דו־כיווני: אין ערוץ למצלמה זו":"שמע דו־כיווני: לא ידוע";return r`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center" data-caps data-ptz=${e.ptz.state} data-audio=${e.audio.state}>
      <sw-badge kind=${t} label=${s} title=${e.ptz.reason??""}></sw-badge>
      <sw-badge kind=${i} label=${a} title=${e.audio.reason??""}></sw-badge>
      <sw-badge kind="neutral" label="זום דיגיטלי: הגדלה בדפדפן בלבד, לא הנעת מצלמה"></sw-badge>
      <span>${e.ptz.reason?`PTZ לפי המכשיר: ${e.ptz.reason}. `:""}הנעת PTZ, קריאת preset ודיבור הם כתיבה למכשיר ואינם מוצעים בפיילוט ללא אישור מפורש — אין פקד מדומה. נקרא מה־NVR ${e.fetched_at.replace("T"," ").replace("Z"," UTC")}${e.cached?" (מהמטמון)":""}.</span>
    </div>`}startMotionEdit(){const e=this.zones?.motion;!e||!e.rows||!e.cols||(this.motionMsg="",this.motionEdit={cells:e.cells.map(t=>[...t]),sensitivity:e.sensitivity??50,enabled:e.enabled})}paintCell(e,t,s=!1){const i=this.motionEdit;if(!i||(s&&(this.paintValue=!i.cells[e][t]),this.paintValue===null)||i.cells[e][t]===this.paintValue)return;const a=i.cells.map(n=>[...n]);a[e][t]=this.paintValue,this.motionEdit={...i,cells:a}}fillMotion(e){const t=this.motionEdit;t&&(this.motionEdit={...t,cells:t.cells.map(s=>s.map(()=>e))})}motionDiff(){const e=this.zones?.motion,t=this.motionEdit;if(!e||!t)return{added:0,removed:0,sensitivity:!1,enabled:!1};let s=0,i=0;return t.cells.forEach((a,n)=>a.forEach((o,l)=>{const p=e.cells[n]?.[l]??!1;o&&!p&&s++,!o&&p&&i++})),{added:s,removed:i,sensitivity:t.sensitivity!==(e.sensitivity??50),enabled:t.enabled!==e.enabled}}async saveMotion(){const e=this.motionEdit,t=this.cam;if(!e||!t||this.motionBusy)return;const s=this.motionDiff();this.motionBusy=!0;try{const i=await Ad(t.id,{...s.added||s.removed?{cells:e.cells}:{},...s.sensitivity?{sensitivity:e.sensitivity}:{},...s.enabled?{enabled:e.enabled}:{}});this.motionMsg=i.status==="unchanged"?"ה־NVR כבר היה במצב הזה, לא נכתב דבר.":`נכתב ל־NVR (שינוי ${i.id.slice(0,8)}). ניתן להחזיר מהגדרות › חיבורים › שינויים אחרונים.`,this.motionEdit=null,this.motionConfirm=!1,await this.loadZones(!0)}catch(i){this.motionMsg=w(i),this.motionConfirm=!1}finally{this.motionBusy=!1}}renderMotionEditor(e){const t=this.motionEdit,s=this.motionDiff(),i=s.added||s.removed||s.sensitivity||s.enabled,a=t.cells.flat().filter(Boolean).length;return r`<div class="legend" data-motion-editor>
      <span class="note">לחץ או גרור על התמונה כדי לסמן תאים שמזהים תנועה · ${a} מתוך ${e.rows*e.cols} תאים</span>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!0)}>בחר הכל</sw-button>
      <sw-button size="sm" variant="ghost" @click=${()=>this.fillMotion(!1)}>נקה</sw-button>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px">רגישות <input type="range" min=${this.zones?.sensitivity_caps?.min??0} max=${this.zones?.sensitivity_caps?.max??100} step=${this.zones?.sensitivity_caps?.step??20} .value=${String(t.sensitivity)} data-motion-sensitivity @input=${n=>this.motionEdit={...t,sensitivity:Number(n.target.value)}} /> <b class="ltr">${t.sensitivity}</b></label>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" .checked=${t.enabled} data-motion-enabled @change=${n=>this.motionEdit={...t,enabled:n.target.checked}} /> זיהוי תנועה פעיל</label>
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="check" ?disabled=${!i||this.motionBusy} data-motion-save @click=${()=>this.motionConfirm=!0}>שמור ל־NVR</sw-button>
      <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.motionBusy} data-motion-cancel @click=${()=>this.motionEdit=null}>ביטול</sw-button>
      ${this.motionConfirm?r`<sw-dialog open heading="כתיבה ל־NVR: זיהוי תנועה" subheading=${`${this.cam?.name??""} · ערוץ ${this.zones?.channel??""}`} data-motion-confirm @close=${()=>this.motionConfirm=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${s.added?`+${s.added} תאים נוספים לזיהוי`:""}${s.added&&s.removed?" · ":""}${s.removed?`−${s.removed} תאים מוסרים`:""}${!s.added&&!s.removed?"הרשת ללא שינוי":""}</div>
              <div>רגישות: ${s.sensitivity?`${e.sensitivity??"—"} → ${t.sensitivity}`:"ללא שינוי"} · זיהוי: ${s.enabled?t.enabled?"כבוי → פעיל":"פעיל → כבוי":"ללא שינוי"}</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה. ההקלטות אינן מושפעות; אזור שלא מסומן לא יפעיל הקלטת תנועה.</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.motionBusy} data-motion-confirm-run @click=${()=>this.saveMotion()}>${this.motionBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.motionConfirm=!1}>ביטול</sw-button></div>
          </sw-dialog>`:c}
    </div>`}renderZones(e){const t=this.zones;if(this.zonesBusy&&!t)return r`<div class="note">קורא את הגדרות הזיהוי מה־NVR…</div>`;if(this.zonesError&&!t)return r`<div class="note">${this.zonesError} <sw-button size="sm" @click=${()=>this.loadZones(!0)}>נסה שוב</sw-button></div>`;if(!t)return r`<div class="note">—</div>`;const s=this.zoneLayers,i=t.motion,a=(o,l)=>o.map(([p,f])=>`${p/l.width*1e3},${f/l.height*1e3}`).join(" "),n=o=>o==="human"?"אדם":o==="vehicle"?"רכב":o;return r`
      <style>
        .zones .frame { position: relative; aspect-ratio: 16 / 9; background: #0f1729; border-radius: 8px; overflow: hidden; }
        .zones .frame img { inline-size: 100%; block-size: 100%; object-fit: fill; display: block; }
        .zones .frame svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
        .zones .cell { fill: rgba(239, 68, 68, 0.28); stroke: rgba(239, 68, 68, 0.55); stroke-width: 1; }
        .zones .mask { fill: rgba(15, 23, 42, 0.78); stroke: #0f172a; stroke-width: 3; }
        .zones .field { fill: rgba(245, 158, 11, 0.25); stroke: #f59e0b; stroke-width: 4; }
        .zones .line { fill: none; stroke: #2f6bff; stroke-width: 6; }
        .zones .line.off { stroke-dasharray: 14 10; opacity: 0.6; }
        .zones .legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-block-start: 8px; }
      </style>
      <div class="zones" data-zones-loaded>
        <div class="frame">
          <img src=${qe(e.id)} alt="" />
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="אזורי זיהוי מעל תמונת המצלמה" style=${this.smartEdit?"cursor:crosshair":""} data-zones-svg @click=${o=>this.smartClick(o)}>
            ${this.motionEdit&&i&&i.rows&&i.cols?this.motionEdit.cells.flatMap((o,l)=>o.map((p,f)=>h`<rect class=${p?"cell":"cell off"} data-motion-cell=${`${l}-${f}`} x=${f*1e3/i.cols} y=${l*1e3/i.rows} width=${1e3/i.cols} height=${1e3/i.rows} style="cursor:crosshair;${p?"":"fill:rgba(255,255,255,0.03);stroke:rgba(255,255,255,0.18)"}" @pointerdown=${u=>{u.preventDefault(),this.paintCell(l,f,!0)}} @pointerenter=${u=>{u.buttons&1&&this.paintCell(l,f)}} @pointerup=${()=>this.paintValue=null}></rect>`)):c}
            ${!this.motionEdit&&s.motion&&i&&i.rows&&i.cols?i.cells.flatMap((o,l)=>o.map((p,f)=>p?h`<rect x=${f*1e3/i.cols} y=${l*1e3/i.rows} width=${1e3/i.cols} height=${1e3/i.rows} class="cell"></rect>`:c)):c}
            ${s.privacy&&t.privacy_mask?t.privacy_mask.regions.map(o=>h`<polygon points=${a(o.points,t.privacy_mask.normalized)} class="mask"></polygon>`):c}
            ${s.intrusion&&t.intrusion&&!this.smartEdit?t.intrusion.regions.map(o=>h`<polygon points=${a(o.points,t.intrusion.normalized)} class="field"></polygon>`):c}
            ${s.lines&&t.line_crossing&&!this.smartEdit?t.line_crossing.lines.map(o=>h`<polyline points=${a(o.points,t.line_crossing.normalized)} class="line ${o.enabled?"":"off"}"></polyline>`):c}
            ${this.renderSmartOverlay()}
          </svg>
        </div>
        <div class="legend">
          <sw-chip data-zone-layer="motion" ?selected=${s.motion} @click=${()=>this.zoneLayers={...s,motion:!s.motion}}>תנועה${i?` · ${i.enabled?"פעיל":"כבוי"} · ${i.coverage_pct}% מהתמונה · רגישות ${i.sensitivity??"?"}${i.target_types.length?` · ${i.target_types.map(n).join("/")}`:""}`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="privacy" ?selected=${s.privacy} @click=${()=>this.zoneLayers={...s,privacy:!s.privacy}}>מסכת פרטיות${t.privacy_mask?` · ${t.privacy_mask.enabled?"פעילה":"כבויה"} · ${t.privacy_mask.regions.length} אזורים`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="intrusion" ?selected=${s.intrusion} @click=${()=>this.zoneLayers={...s,intrusion:!s.intrusion}}>חדירה לאזור${t.intrusion?` · ${t.intrusion.enabled?"פעיל":"כבוי"} · ${t.intrusion.regions.length} אזורים`:" · לא נקרא"}</sw-chip>
          <sw-chip data-zone-layer="lines" ?selected=${s.lines} @click=${()=>this.zoneLayers={...s,lines:!s.lines}}>חציית קו${t.line_crossing?` · ${t.line_crossing.enabled?"פעיל":"כבוי"} · ${t.line_crossing.lines.length} קווים`:" · לא נקרא"}</sw-chip>
          <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.zonesBusy} @click=${()=>this.loadZones(!0)}>רענון מה־NVR</sw-button>
          ${t.can_edit_motion&&i&&i.rows&&i.cols&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-motion-edit @click=${()=>this.startMotionEdit()}>עריכת אזורי תנועה</sw-button>`:c}
          ${this.smart?.can_write&&(this.smart.line||this.smart.field)&&!this.smartEdit&&!this.motionEdit?r`<sw-button size="sm" icon="edit" data-smart-edit @click=${()=>this.startSmartEdit()}>עריכת כללים חכמים</sw-button>`:c}
        </div>
        ${this.motionEdit&&i?this.renderMotionEditor(i):c}
        ${this.smartEdit?this.renderSmartEditor():c}
        ${this.smartMsg?r`<div class="note" data-smart-msg>${this.smartMsg}</div>`:c}
        ${this.motionMsg?r`<div class="note" data-motion-msg>${this.motionMsg}</div>`:c}
        ${Object.keys(t.unsupported).length?r`<div class="note">לא נקרא מהמכשיר: ${Object.entries(t.unsupported).map(([o,l])=>`${o} (${l})`).join(", ")}</div>`:c}
        <div class="note" data-zones-note>קריאה בלבד מה־NVR (נקרא ${t.fetched_at.replace("T"," ").replace("Z"," UTC")}${t.cached?", מהמטמון":""}). אלו פוליגונים בתמונת המצלמה — לא חדרים במפה. שכבת־על בדפדפן אינה מסכת NVR ואינה מגינה על הקלטות; עריכה או מסכה אמיתית דורשות אישור מפורש, כתיבה מאומתת ובדיקת התוצאה בזרם.</div>
      </div>`}async load(){this.loading=!0,this.error="";try{if(g()){const[e,t]=await Promise.all([Te(),je()]);this.cams=e.cameras,this.cam=e.cameras.find(s=>s.id===this.cameraId)??null,this.canConfigure=e.can_sync,this.settings=t,this.transport=ia(t)}}catch(e){this.error=w(e)}finally{this.loading=!1}}setTransport(e){so(e===(this.settings?.["media.transport_default"]??"mse")?"":e),this.transport=e}onPlayer(e){this.playerStatus=e.detail.status,this.playerTransport=e.detail.transport??""}renderApi(){const e=this.cam;if(this.loading)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(this.error)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!e)return r`<sw-state-panel state="forbidden" heading="המצלמה לא זמינה" hint="המצלמה לא נמצאה או שאין לך הרשאת צפייה בה."></sw-state-panel>`;const t=e.can_view_live!==!1&&e.status!=="offline",s=qe(e.id,this.posterBust),i=e.stream;return r`
      <div class="video ${t?"":"off"}">
        ${t?r`<sw-live-player .cameraId=${e.id} .profile=${this.profile} .mode=${this.transport} .poster=${s} @player-status=${this.onPlayer}></sw-live-player>`:r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${e.status==="offline"?"המצלמה מנותקת מה־NVR (לפי הסנכרון האחרון)":"אין הרשאת צפייה חיה במצלמה זו"}</span></div></div>`}
      </div>
      <div class="controls">
        <div class="round" role="group" aria-label="פקדי מצלמה">
          <button title="רענון תמונה" aria-label="רענון תמונה" @click=${()=>this.posterBust=Date.now()}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${this.playerStatus!=="playing"} @click=${()=>this.player?.fullscreen()}><sw-icon name="expand" size=${16}></sw-icon></button>
          <button title="התחבר מחדש" aria-label="התחבר מחדש" @click=${()=>this.player?.reconnect()}><sw-icon name="refresh" size=${16}></sw-icon></button>
          <button class="q ${this.profile==="main"?"on":""}" @click=${()=>this.profile="main"}>ראשי</button>
          <button class="q ${this.profile==="sub"?"on":""}" @click=${()=>this.profile="sub"}>משני</button>
          <div class="transport" role="group" aria-label="תעבורה">
            ${["auto","webrtc","mse"].map(a=>r`<button class=${this.transport===a?"on":""} @click=${()=>this.setTransport(a)}>${a==="auto"?"אוטומטי":a==="webrtc"?"WebRTC":"MSE"}</button>`)}
          </div>
          ${mr()?r`<span class="note">ברירת המחדל של המערכת: ${this.settings?.["media.transport_default"]??"mse"}</span>`:c}
        </div>
        <div class="note">${this.playerStatus==="playing"?`מנגן דרך ${this.playerTransport==="webrtc"?"WebRTC":"MSE"}`:this.playerStatus==="error"?"הזרם לא זמין":"מתחבר…"}</div>
      </div>
      ${this.renderSettingsAccordion(e,i)}
    `}renderSettingsAccordion(e,t){const s=this.renderCaps(),i=this.renderRecord(),a=this.renderOsd();return r`<details class="acc-root" data-camera-settings>
      <summary><sw-icon class="chev" name="chevron" size=${16}></sw-icon>הגדרות מצלמה</summary>
      <div class="acc-body">
        ${i!==c?r`<details class="acc" data-acc-record ?open=${!!this.rec?.active}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>הקלטה ידנית</span>${this.rec?.active?r`<sw-badge kind="live" label="פעילה"></sw-badge>`:c}</summary>
              <div class="acc-content">${i}</div>
            </details>`:c}
        <details class="acc" data-acc-details>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>פרטים</span></summary>
          <div class="acc-content">
            <dl>
              <dt>מצב</dt><dd><sw-badge kind=${e.status==="online"?"live":e.status==="offline"?"offline":"unknown"}></sw-badge></dd>
              <dt>ערוץ</dt><dd>${e.channel} · <span class="ltr">track ${e.main_track??"?"}</span></dd>
              <dt>שם ב־NVR</dt><dd>${e.name_source||"—"}</dd>
              <dt>זרם ראשי</dt><dd>${t?`${t.resolution??""} · ${t.fps??"?"} fps · ${t.bitrate_kbps??"?"} kbps`:"לא נבדק"}</dd>
              <dt>זמן מקור</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
              <dt>נראתה לאחרונה</dt><dd>${e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</dd>
            </dl>
            ${s}
          </div>
        </details>
        ${a!==c?r`<details class="acc" data-acc-osd>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>OSD — כיתוב על התמונה</span></summary>
              <div class="acc-content">${a}</div>
            </details>`:c}
        <details class="acc" data-acc-schedules>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>לוחות זימון והקלטה — כפי שמוגדר ב־NVR</span></summary>
          <div class="acc-content">
            <div class="note">מתי כל זיהוי פעיל ומתי הערוץ מקליט (רציף / תנועה / אירוע) · עריכה דורשת הרשאה רגישה ונרשמת עם החזר</div>
            ${this.renderSchedules()}
          </div>
        </details>
        <details class="acc" data-acc-zones>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>אזורי זיהוי ומסכות — כפי שמוגדר ב־NVR</span></summary>
          <div class="acc-content">${this.renderZones(e)}</div>
        </details>
        <details class="acc" data-acc-more>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>מצלמות נוספות</span></summary>
          <div class="acc-content tiles">
            ${this.cams.filter(n=>n.id!==e.id).slice(0,4).map(n=>r`<sw-camera-tile compact name=${n.name} state=${n.status==="online"?"live":n.status==="offline"?"offline":"unknown"} poster=${n.status==="offline"?"":qe(n.id)} @click=${()=>b(`/live/cameras/${n.id}`)}></sw-camera-tile>`)}
          </div>
        </details>
      </div>
    </details>`}renderDemo(){const e=G.find(i=>i.id===this.cameraId)??G[0],t=e.state==="live"||e.state==="stale",s=Ke[e.id]??"lobby";return r`
      <div class="video ${t?s:"off"}">
        ${t?r`<sw-scene kind=${s}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>
              <span class="stamp">2026-09-14 10:24:36</span>
              <span class="quality">${this.profile==="main"?"1440p · H.265":"360p · H.264"}</span>`:r`<div class="center"><div>
              <sw-icon name=${e.state==="offline"?"offline":"lock"} size=${32}></sw-icon>
              <span>${e.state==="offline"?"המצלמה אינה מחוברת ל־NVR":"אין הרשאת צפייה במצלמה זו"}</span>
            </div></div>`}
      </div>
      <div class="controls">
        <div class="round" role="group" aria-label="פקדי מצלמה">
          ${e.audio?r`<button title="מיקרופון" aria-label="מיקרופון" ?disabled=${!t}><sw-icon name="mic" size=${16}></sw-icon></button><button title="שמע" aria-label="שמע" ?disabled=${!t}><sw-icon name="volume" size=${16}></sw-icon></button>`:c}
          <button title="צילום מסך" aria-label="צילום מסך" ?disabled=${!t}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${!t}><sw-icon name="expand" size=${16}></sw-icon></button>
          <button class="q ${this.profile==="main"?"on":""}" @click=${()=>this.profile="main"}>1440p</button>
          <button class="q ${this.profile==="sub"?"on":""}" @click=${()=>this.profile="sub"}>360p</button>
        </div>
        ${e.ptz?r`<div class="ptz" role="group" aria-label="בקרת PTZ">
              <div class="joy">
                <button class="u" aria-label="למעלה"><sw-icon name="chevronDown" size=${14} style="transform:rotate(180deg)"></sw-icon></button>
                <button class="d" aria-label="למטה"><sw-icon name="chevronDown" size=${14}></sw-icon></button>
                <button class="l" aria-label="שמאלה"><sw-icon name="chevron" size=${14} flip></sw-icon></button>
                <button class="r" aria-label="ימינה"><sw-icon name="chevron" size=${14}></sw-icon></button>
                <span class="c" aria-hidden="true"></span>
              </div>
              <div class="zoom"><button aria-label="זום פנימה"><sw-icon name="plus" size=${14}></sw-icon></button><button aria-label="זום החוצה"><sw-icon name="minus" size=${14}></sw-icon></button></div>
            </div>`:c}
      </div>
      ${e.ptz?r`<div class="modes">
            <sw-chip icon="bookmark" ?selected=${this.ptzMode==="presets"} @click=${()=>this.ptzMode="presets"}>Presets</sw-chip>
            <sw-chip icon="target" ?selected=${this.ptzMode==="track"} @click=${()=>this.ptzMode="track"}>מעקב אוטומטי</sw-chip>
            <sw-chip icon="route" ?selected=${this.ptzMode==="patrol"} @click=${()=>this.ptzMode="patrol"}>סיור</sw-chip>
          </div>`:r`<div class="note" style="margin-block-start:8px">PTZ ושמע אינם מוצגים במצלמה זו: היכולת לא אומתה. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>`}
      <div class="grid">
        <sw-card heading="פרטים">
          <dl>
            <dt>מצב</dt><dd><sw-badge kind=${e.state}></sw-badge></dd>
            <dt>הקלטה</dt><dd>${{continuous:"רציפה",motion:"לפי תנועה",off:"כבויה",unknown:"לא ידוע"}[e.recording]}</dd>
            <dt>זרם</dt><dd>${e.fps?`${e.fps} fps · ${e.bitrateKbps} kbps`:"—"}</dd>
            <dt>קושחה</dt><dd><span class="ltr">${e.firmware}</span></dd>
            <dt>אירוע אחרון</dt><dd>${e.lastEvent}</dd>
          </dl>
        </sw-card>
        <sw-card heading="מצלמות באותה קומה">
          <div class="tiles">
            ${G.filter(i=>i.floor===e.floor&&i.id!==e.id).slice(0,4).map(i=>r`<sw-camera-tile compact name=${i.name} state=${i.state} scene=${Ke[i.id]??"lobby"} @click=${()=>b(`/live/cameras/${i.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    `}render(){const e=g(),t=e?this.cam?.name??"מצלמה":(G.find(i=>i.id===this.cameraId)??G[0]).name,s=e?this.cam?`ערוץ ${this.cam.channel} · ${this.cam.name_source||""}`:"":`${(G.find(i=>i.id===this.cameraId)??G[0]).floor} · נתוני הדגמה`;return r`
      <sw-page heading=${t} subheading=${s} crumbs="מצלמות | שידור חי" backHref="/live/wall">
        ${this.cam?r`<sw-badge slot="actions" kind=${this.cam.status==="online"?"live":this.cam.status==="offline"?"offline":"unknown"}></sw-badge>`:c}
        ${e&&this.cam&&this.canConfigure?r`<sw-button slot="actions" variant="ghost" icon="edit" data-camera-rename @click=${()=>{this.renameMsg="",this.renameTo=this.cam?.alias??this.cam?.name??""}}>שנה שם</sw-button>`:c}
        ${this.renderRename()}
        <a slot="actions" href=${e&&this.cam?`#/investigate/playback?camera=${this.cam.id}`:"#/investigate/playback"}><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label="במפה"></sw-button></a>
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};E.styles=z`
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      /* owner report: on a wide desktop (design A has no page max-width), a 16:9 box at full page width grows
         taller than the viewport - the controls and settings below need a scroll to even see they exist. Capping
         the height (the width then follows from the ratio) keeps the whole screen reachable without scrolling. */
      max-block-size: min(60dvh, 640px);
      inline-size: 100%;
      margin-inline: auto;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: #0f1729;
      color: #fff;
      box-shadow: var(--sw-shadow-2);
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 65%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
      z-index: 2;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 10px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .quality {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 10px;
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
      z-index: 2;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    .round {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .round button {
      inline-size: 38px;
      block-size: 38px;
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
    }
    .round button:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .round button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .round .q {
      inline-size: auto;
      border-radius: var(--sw-r-pill);
      padding-inline: 10px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      block-size: 30px;
    }
    .round .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .transport {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    .round .transport button {
      display: inline-block;
      inline-size: auto;
      block-size: 26px;
      border: 0;
      background: transparent;
      box-shadow: none;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      padding: 0 9px;
      border-radius: 6px;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .round .transport button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .ptz {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .joy {
      position: relative;
      inline-size: 64px;
      block-size: 64px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    .joy button {
      position: absolute;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      border-radius: 50%;
    }
    .joy .u {
      inset-block-start: 3px;
      inset-inline-start: 22px;
    }
    .joy .d {
      inset-block-end: 3px;
      inset-inline-start: 22px;
    }
    .joy .l {
      inset-inline-start: 3px;
      inset-block-start: 22px;
    }
    .joy .r {
      inset-inline-end: 3px;
      inset-block-start: 22px;
    }
    .joy .c {
      inset-inline-start: 26px;
      inset-block-start: 26px;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .zoom {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zoom button {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 8px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .modes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      margin-block-start: 12px;
      align-items: start;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    /* settings accordion (owner round 4, 2.6): the video keeps its place, everything below starts collapsed
       under one "camera settings" toggle, and each setting inside is its own collapsed row. */
    .acc-root {
      margin-block-start: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    .acc-root > summary {
      padding: 12px 14px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .acc-root[open] > summary {
      border-block-end: 1px solid var(--sw-border);
    }
    .acc-body {
      padding: 4px 14px 8px;
      display: flex;
      flex-direction: column;
    }
    summary {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary .chev {
      flex: none;
      color: var(--sw-text-3);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    details[open] > summary .chev {
      transform: rotate(90deg);
    }
    .acc {
      border-block-start: 1px solid var(--sw-border);
    }
    .acc > summary {
      padding: 10px 2px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      justify-content: space-between;
    }
    .acc > summary .lbl {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .acc-content {
      padding: 0 2px 12px;
    }
  `;P([m()],E.prototype,"cameraId",2);P([d()],E.prototype,"cam",2);P([d()],E.prototype,"zones",2);P([d()],E.prototype,"zonesBusy",2);P([d()],E.prototype,"zonesError",2);P([d()],E.prototype,"motionEdit",2);P([d()],E.prototype,"motionConfirm",2);P([d()],E.prototype,"motionBusy",2);P([d()],E.prototype,"motionMsg",2);P([d()],E.prototype,"rec",2);P([d()],E.prototype,"osd",2);P([d()],E.prototype,"sched",2);P([d()],E.prototype,"schedError",2);P([d()],E.prototype,"schedTab",2);P([d()],E.prototype,"schedEdit",2);P([d()],E.prototype,"schedBusy",2);P([d()],E.prototype,"schedMsg",2);P([d()],E.prototype,"schedConfirm",2);P([d()],E.prototype,"smart",2);P([d()],E.prototype,"smartEdit",2);P([d()],E.prototype,"smartBusy",2);P([d()],E.prototype,"smartMsg",2);P([d()],E.prototype,"osdMsg",2);P([d()],E.prototype,"renameTo",2);P([d()],E.prototype,"renameBusy",2);P([d()],E.prototype,"renameMsg",2);P([d()],E.prototype,"osdBusy",2);P([d()],E.prototype,"recMinutes",2);P([d()],E.prototype,"recBusy",2);P([d()],E.prototype,"recMsg",2);P([d()],E.prototype,"zoneLayers",2);P([d()],E.prototype,"caps",2);P([d()],E.prototype,"capsError",2);P([d()],E.prototype,"cams",2);P([d()],E.prototype,"canConfigure",2);P([d()],E.prototype,"settings",2);P([d()],E.prototype,"error",2);P([d()],E.prototype,"loading",2);P([d()],E.prototype,"profile",2);P([d()],E.prototype,"transport",2);P([d()],E.prototype,"playerStatus",2);P([d()],E.prototype,"playerTransport",2);P([d()],E.prototype,"posterBust",2);P([d()],E.prototype,"ptzMode",2);P([es("sw-live-player")],E.prototype,"player",2);E=P([S("live-camera")],E);var Jd=Object.defineProperty,Xd=Object.getOwnPropertyDescriptor,Je=(e,t,s,i)=>{for(var a=i>1?void 0:i?Xd(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Jd(t,s,a),a};const Qd={name:"",cameras:[],cols:2,rows:2,shared:!1,kiosk:!1},ec=[{name:"כל המצלמות",layout:9,scope:"משותפת",mobile:"4 · משני",owner:"יוני",kiosk:!0},{name:"חוץ",layout:4,scope:"משותפת",mobile:"2 · משני",owner:"יוני",kiosk:!1},{name:"פנים",layout:6,scope:"משותפת",mobile:"ללא",owner:"יוסי",kiosk:!1},{name:"לילה",layout:4,scope:"אישית",mobile:"4 · משני",owner:"דנה",kiosk:!1}];let Ie=class extends x{constructor(){super(...arguments),this.views=null,this.cams=[],this.canShare=!1,this.canManageAll=!1,this.editing=null,this.confirmDelete=null,this.busy=!1,this.error="",this.formError=""}connectedCallback(){super.connectedCallback(),g()&&this.load()}async load(){try{const[e,t]=await Promise.all([Ar(),Te()]);this.views=e.views,this.canShare=e.can_share,this.canManageAll=e.can_manage_all,this.cams=t.cameras.filter(s=>s.enabled&&s.can_view_live!==!1),this.error=""}catch(e){this.error=w(e),this.views=this.views??[]}}canEdit(e){return this.canManageAll||e.owner_user_id===st.me?.user.id}open(e){this.formError="",this.editing=e?{id:e.id,name:e.name,cameras:[...e.cameras],cols:e.cols,rows:e.rows,shared:e.shared,kiosk:e.kiosk}:{...Qd,cameras:[]}}toggleCamera(e){if(!this.editing)return;const t=this.editing.cameras.includes(e);!t&&this.editing.cameras.length>=16||(this.editing={...this.editing,cameras:t?this.editing.cameras.filter(s=>s!==e):[...this.editing.cameras,e]})}async save(){const e=this.editing;if(e){if(!e.name.trim()){this.formError="לתצוגה צריך שם.";return}if(!e.cameras.length){this.formError="בחר לפחות מצלמה אחת.";return}this.busy=!0;try{const t={name:e.name.trim(),cameras:e.cameras,cols:e.cols,rows:e.rows,shared:e.shared,kiosk:e.kiosk};e.id?await ll(e.id,t):await Er(t),this.editing=null,await this.load()}catch(t){this.formError=w(t)}finally{this.busy=!1}}}async removeView(){const e=this.confirmDelete;if(e){this.busy=!0;try{await dl(e.id),this.confirmDelete=null,await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}}renderEditor(){const e=this.editing;return r`<sw-dialog open heading=${e.id?"עריכת תצוגה":"תצוגה חדשה"} subheading="שם, מצלמות ופריסה · תצוגה משותפת נראית לכל המשתמשים" data-view-dialog @close=${()=>this.editing=null}>
      <div class="form">
        <sw-field label="שם"><input data-view-name .value=${e.name} maxlength="60" @input=${t=>this.editing={...e,name:t.target.value}} /></sw-field>
        <div class="lbl">מצלמות (${e.cameras.length} מתוך ${this.cams.length})</div>
        <div class="chips" data-view-cameras>
          ${this.cams.map(t=>r`<sw-chip ?selected=${e.cameras.includes(t.id)} data-view-camera=${t.id} dot=${t.status==="online"?"#22c55e":"#ef4444"} @click=${()=>this.toggleCamera(t.id)}>${t.name}</sw-chip>`)}
        </div>
        <div class="two">
          <sw-field label="עמודות"><select data-view-cols .value=${String(e.cols)} @change=${t=>this.editing={...e,cols:Number(t.target.value)}}>${[1,2,3,4].map(t=>r`<option value=${t} ?selected=${t===e.cols}>${t}</option>`)}</select></sw-field>
          <sw-field label="שורות"><select data-view-rows .value=${String(e.rows)} @change=${t=>this.editing={...e,rows:Number(t.target.value)}}>${[1,2,3,4].map(t=>r`<option value=${t} ?selected=${t===e.rows}>${t}</option>`)}</select></sw-field>
        </div>
        <div class="toggles">
          <sw-toggle ?checked=${e.shared} ?disabled=${!this.canShare} label=${this.canShare?"משותפת לכל המשתמשים":"משותפת (דורש הרשאת ניהול משתמשים)"} data-view-shared @change=${t=>this.editing={...e,shared:t.detail.checked}}></sw-toggle>
          <sw-toggle ?checked=${e.kiosk} label="מיועדת לקיוסק (מסך קיר)" data-view-kiosk @change=${t=>this.editing={...e,kiosk:t.detail.checked}}></sw-toggle>
        </div>
        <div class="note">הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג ${e.cols}×${e.rows} מצלמות בעמוד ומדפדף בין העמודים.</div>
        ${this.formError?r`<div class="err" data-view-error>${this.formError}</div>`:c}
      </div>
      <div slot="footer">
        <sw-button variant="ghost" @click=${()=>this.editing=null}>ביטול</sw-button>
        <sw-button variant="primary" icon="check" data-view-save ?disabled=${this.busy} @click=${()=>this.save()}>${e.id?"שמור":"צור תצוגה"}</sw-button>
      </div>
    </sw-dialog>`}renderApi(){const e=this.views;return r`
      <sw-page heading="תצוגות שמורות" subheading="קבוצות מצלמות עם פריסה — אישיות או משותפות — לפתיחה בקיר החי או בקיוסק">
        <sw-button slot="actions" variant="primary" icon="plus" data-view-new @click=${()=>this.open()}>תצוגה חדשה</sw-button>
        ${this.error?r`<sw-state-panel state="error" heading="התצוגות לא נטענו" hint=${this.error}></sw-state-panel>`:c}
        ${e===null?r`<sw-state-panel state="loading" heading="טוען תצוגות…"></sw-state-panel>`:e.length?r`<div class="grid" data-views>
                ${e.map(t=>r`<sw-card data-view=${t.id}>
                    <div class="thumb" style=${`grid-template-columns:repeat(${Math.min(2,Math.max(1,t.cameras.length))}, 1fr)`}>
                      ${t.cameras.slice(0,4).map(s=>r`<img src=${qe(s)} alt="" loading="lazy" @error=${i=>i.target.style.visibility="hidden"} />`)}
                      ${t.cameras.length?c:r`<div class="empty">אין מצלמות שמותר לך לראות בתצוגה זו</div>`}
                    </div>
                    <div class="head"><b>${t.name}</b><sw-badge kind=${t.shared?"live":"neutral"} label=${t.shared?"משותפת":"אישית"}></sw-badge>${t.kiosk?r`<sw-badge kind="neutral" label="קיוסק"></sw-badge>`:c}</div>
                    <dl>
                      <dt>מצלמות</dt><dd>${t.camera_names.join(" · ")||"—"}${t.hidden_cameras?r` <span class="muted">(+${t.hidden_cameras} ללא הרשאה)</span>`:c}</dd>
                      <dt>פריסה</dt><dd class="ltr">${t.cols}×${t.rows}</dd>
                      <dt>בעלים</dt><dd>${t.owner_username??"—"}</dd>
                    </dl>
                    <div class="foot">
                      <a href=${Pr(t)}><sw-button size="sm" variant="primary" icon="play" data-view-open ?disabled=${!t.cameras.length}>פתח</sw-button></a>
                      <a href=${cl(t)} target="_blank" rel="noopener"><sw-button size="sm" icon="layers" data-view-kiosk-open ?disabled=${!t.cameras.length}>קיוסק</sw-button></a>
                      <span class="grow"></span>
                      ${this.canEdit(t)?r`<sw-button size="sm" variant="ghost" icon="edit" data-view-edit @click=${()=>this.open(t)}>עריכה</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-view-delete @click=${()=>this.confirmDelete=t}>מחיקה</sw-button>`:c}
                    </div>
                  </sw-card>`)}
              </div>`:r`<sw-state-panel state="empty" heading="אין עדיין תצוגות שמורות" hint="צור תצוגה: שם, מצלמות ופריסה. תצוגה משותפת נראית לכל המשתמשים; קיוסק פותח אותה במסך קיר בלי פקדים."></sw-state-panel>`}
        ${this.editing?this.renderEditor():c}
        ${this.confirmDelete?r`<sw-dialog open heading="מחיקת תצוגה" subheading=${this.confirmDelete.name} @close=${()=>this.confirmDelete=null}>
              <p>התצוגה תוסר מהרשימה. המצלמות וההקלטות אינן מושפעות.</p>
              <div slot="footer"><sw-button variant="ghost" @click=${()=>this.confirmDelete=null}>ביטול</sw-button><sw-button variant="danger" icon="trash" data-view-delete-confirm ?disabled=${this.busy} @click=${()=>this.removeView()}>מחק</sw-button></div>
            </sw-dialog>`:c}
      </sw-page>
    `}render(){return g()?this.renderApi():r`
      <sw-page heading="תצוגות שמורות" subheading="תבניות 1 / 2 / 4 / 6 / 9 / 12 / 16 / מותאם, אישיות או משותפות, עם התאמה למובייל · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תצוגה חדשה</sw-button>
        <div class="grid">
          ${ec.map(e=>{const t=Math.ceil(Math.sqrt(e.layout));return r`<sw-card heading=${e.name}>
              <sw-badge slot="actions" kind="neutral" label=${e.scope}></sw-badge>
              <div class="thumb" style="grid-template-columns:repeat(${t},1fr)">${G.filter(s=>s.state==="live").slice(0,e.layout).map(s=>r`<sw-scene kind=${Ke[s.id]??"lobby"}></sw-scene>`)}</div>
              <dl>
                <dt>פריסה</dt><dd>${e.layout} אריחים</dd>
                <dt>מובייל</dt><dd>${e.mobile}</dd>
                <dt>בעלים</dt><dd>${e.owner}</dd>
              </dl>
              <div class="foot">
                <a href="#/live/wall"><sw-button size="sm" icon="play">פתח</sw-button></a>
                <sw-button size="sm" variant="ghost">עריכה</sw-button>
                <sw-toggle ?checked=${e.kiosk} label="קיוסק"></sw-toggle>
              </div>
            </sw-card>`})}
        </div>
      </sw-page>
    `}};Ie.styles=z`
    .thumb img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      border-radius: 3px;
      background: #1e293b;
      display: block;
    }
    .thumb .empty {
      grid-column: 1 / -1;
      color: #cbd5e1;
      font-size: var(--sw-fs-xs);
      display: grid;
      place-items: center;
      text-align: center;
      padding: 8px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-block-end: 6px;
    }
    .head b {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .grow {
      flex: 1;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: min(560px, 80vw);
    }
    .form .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .toggles {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }
    .thumb {
      display: grid;
      gap: 3px;
      background: #0f172a;
      border-radius: 8px;
      padding: 4px;
      aspect-ratio: 16 / 9;
      margin-block-end: 10px;
      overflow: hidden;
    }
    .thumb sw-scene {
      border-radius: 3px;
      inline-size: 100%;
      block-size: 100%;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 10px;
      margin: 0;
      font-size: var(--sw-fs-xs);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .foot {
      display: flex;
      gap: 6px;
      margin-block-start: 10px;
      align-items: center;
    }
  `;Je([d()],Ie.prototype,"views",2);Je([d()],Ie.prototype,"cams",2);Je([d()],Ie.prototype,"canShare",2);Je([d()],Ie.prototype,"canManageAll",2);Je([d()],Ie.prototype,"editing",2);Je([d()],Ie.prototype,"confirmDelete",2);Je([d()],Ie.prototype,"busy",2);Je([d()],Ie.prototype,"error",2);Je([d()],Ie.prototype,"formError",2);Ie=Je([S("live-views")],Ie);var tc=Object.defineProperty,sc=Object.getOwnPropertyDescriptor,dt=(e,t,s,i)=>{for(var a=i>1?void 0:i?sc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&tc(t,s,a),a};const Br="sw.kiosk.layout",ic=[[2,2],[3,2],[3,3],[4,3],[4,4],[5,4],[6,4]];function Lr(e){try{const i=localStorage.getItem(Br);if(i){const[a,n]=i.split("x").map(Number);if(a>=1&&n>=1)return{cols:a,rows:n}}}catch{}const t=Number(e?.["ui.kiosk_cols"]??0),s=Number(e?.["ui.kiosk_rows"]??0);return{cols:t>=1?t:3,rows:s>=1?s:2}}function $i(e=Lr()){const t=Xt().params,s=Math.min(6,Math.max(1,Number(t.get("cols")??e.cols)||e.cols)),i=Math.min(5,Math.max(1,Number(t.get("rows")??e.rows)||e.rows));return{cameras:(t.get("cameras")??"").split(",").map(a=>a.trim()).filter(Boolean),cols:s,rows:i,rotate:Math.max(0,Number(t.get("rotate")??0)||0)}}let Le=class extends x{constructor(){super(...arguments),this.cams=null,this.settings=null,this.clock="",this.page=0,this.health=null,this.disconnected=!1,this.view=$i(),this.failures=0,this.onHash=()=>{this.view=$i(),this.page=this.restorePage(),this.startRotation()},this.started=0,this.staggerTimer=0}setLayout(e){const[t,s]=e.split("x").map(Number);if(!(t>=1&&s>=1))return;try{localStorage.setItem(Br,`${t}x${s}`)}catch{}const i=new URLSearchParams(Xt().params);i.set("cols",String(t)),i.set("rows",String(s)),window.location.replace(`#/kiosk/all?${i.toString()}`)}get pageKey(){return`sw.kiosk.page:${this.view.cameras.join(",")}|${this.view.cols}x${this.view.rows}`}restorePage(){try{const e=Number(localStorage.getItem(this.pageKey)??"0");return Number.isFinite(e)&&e>=0?e:0}catch{return 0}}setPage(e){this.page=e;try{localStorage.setItem(this.pageKey,String(e%Math.max(1,this.pages)))}catch{}}connectedCallback(){super.connectedCallback(),this.page=this.restorePage(),this.tick(),this.timer=window.setInterval(()=>this.tick(),1e3),this.unsubscribe=xr(e=>{e.mode==="api"&&this.cams===null?this.load():e.mode!=="loading"&&this.requestUpdate()}),window.addEventListener("hashchange",this.onHash),this.startRotation(),this.pollHealth(),this.healthTimer=window.setInterval(()=>void this.pollHealth(),15e3)}disconnectedCallback(){window.clearTimeout(this.staggerTimer),super.disconnectedCallback(),window.clearInterval(this.timer),window.clearInterval(this.rotateTimer),window.clearInterval(this.healthTimer),window.removeEventListener("hashchange",this.onHash),this.unsubscribe?.()}startRotation(){window.clearInterval(this.rotateTimer),this.view.rotate>0&&(this.rotateTimer=window.setInterval(()=>{this.setPage(this.page+1),this.stagger()},this.view.rotate*1e3)),this.stagger()}async pollHealth(){if(g())try{this.health=await sa(),(this.disconnected||this.failures>=3)&&this.load(),this.failures=0,this.disconnected=!1}catch{this.failures+=1,this.failures>=3&&(this.disconnected=!0)}}get pageSize(){return this.view.cols*this.view.rows}stagger(){window.clearTimeout(this.staggerTimer),this.started=0;const e=()=>{this.started<this.pageSize&&(this.started+=1,this.staggerTimer=window.setTimeout(e,400))};e()}get selected(){const e=(this.cams??[]).filter(t=>this.view.cameras.length===0||this.view.cameras.includes(t.id));return this.view.cameras.length?this.view.cameras.map(t=>e.find(s=>s.id===t)).filter(t=>!!t):e}get pages(){return Math.max(1,Math.ceil(this.selected.length/this.pageSize))}tick(){const e=new Date;this.clock=`${e.toLocaleDateString("he-IL",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})} · ${e.toLocaleTimeString("he-IL")}`}async load(){if(g())try{const[e,t]=await Promise.all([Te(),je()]);this.cams=e.cameras.filter(s=>s.enabled),this.settings=t,this.view=$i(Lr(t))}catch{this.cams=[]}}render(){const t=g(),s=this.page%this.pages,i=t?this.selected.slice(s*this.pageSize,(s+1)*this.pageSize):[],a=G.filter(l=>l.state!=="forbidden").slice(0,9),n=t?i.filter(l=>l.status==="online").length:7,o=this.settings?.["media.max_live_sessions"]??8;return r`
      <header>
        <img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" />
        <h1>ניטור חי</h1>
        <span class="spacer"></span>
        <sw-badge kind="live" label=${`${t?this.selected.length:a.length} מצלמות · ${n} חיות`}></sw-badge>
        ${t&&this.pages>1?r`<span class="pill" data-kiosk-page>עמוד ${s+1}/${this.pages}${this.view.rotate?` · כל ${this.view.rotate} שנ׳`:""}</span>`:c}
        ${t?r`<select class="layout" data-kiosk-layout aria-label="פריסה" @change=${l=>this.setLayout(l.target.value)}>
          ${ic.map(([l,p])=>r`<option value=${`${l}x${p}`} ?selected=${l===this.view.cols&&p===this.view.rows}>${l}×${p} · ${l*p} מצלמות בעמוד</option>`)}
        </select>`:c}
        ${t&&this.health?r`<span class="pill" data-kiosk-health data-status=${this.health.status}>מערכת: ${ms[this.health.status]}${this.health.items.filter(l=>l.status!=="ok").length?` · ${this.health.items.filter(l=>l.status!=="ok").map(l=>l.label).join(", ")}`:""}</span>`:c}
        <span class="clock">${this.clock||"—"}</span>
        <a class="exit" href="#/live/wall" data-kiosk-exit title="חזרה למערכת (משתמש קיוסק בלבד נשאר כאן)">יציאה</a>
      </header>
      ${this.disconnected?r`<div class="overlay" data-kiosk-disconnected>אין קשר לשרת ה־VMS<br /><small>הזרמים אינם חיים · מנסה להתחבר מחדש</small></div>`:c}
      <div class="grid" style=${`--cols:${t?this.view.cols:3}`}>
        ${t?i.map((l,p)=>r`<sw-camera-tile dark data-kiosk-tile name=${l.name} state=${this.disconnected?"unknown":l.status==="online"?"live":l.status==="offline"?"offline":"unknown"} ?live=${!this.disconnected&&l.status!=="offline"&&p<o&&p<this.started} cameraId=${l.id} profile="sub" transport=${ia(this.settings)} poster=${l.status==="offline"?"":qe(l.id)} noDemo></sw-camera-tile>`):a.map(l=>r`<sw-camera-tile dark name=${l.name} state=${l.state} scene=${Ke[l.id]??"lobby"} noDemo></sw-camera-tile>`)}
      </div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${16}></sw-icon></div><div><b>${t?`${n}/${i.length}`:"7/9"}</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic red"><sw-icon name="warning" size=${16}></sw-icon></div><div><b>${t?i.filter(l=>l.status==="offline").length:3}</b><span>${t?"מצלמות מנותקות":"התראות פתוחות"}</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${16}></sw-icon></div><div><b>${t?Math.min(i.length,o):2}</b><span>${t?"זרמים חיים במקביל":"מבנים"}</span></div></div>
        <div class="stat"><div class="ic green"><sw-icon name="check" size=${16}></sw-icon></div><div><b style="font-size:var(--sw-fs-lg)">${t?"פעיל":"חלקי"}</b><span>${t?"go2rtc + NVR":"מצב מערכת · גשר HA לא רענן"}</span></div></div>
      </div>
      <div class="note">תצוגת קיוסק: קריאה בלבד, ללא פקדי ניהול, חיבור מחדש אוטומטי · תצוגה שמורה = הכתובת (cameras, cols, rotate)${t?"":" · נתוני הדגמה (סצנות מאוירות עד חיבור הזרמים)"}</div>
    `}};Le.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      background: #0f172a;
      color: #fff;
      padding: 14px 20px 16px;
      gap: 12px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    header img {
      block-size: 24px;
      inline-size: auto;
      filter: brightness(0) invert(1);
      opacity: 0.9;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .spacer {
      flex: 1;
    }
    .clock {
      font-size: var(--sw-fs-sm);
      color: rgba(255, 255, 255, 0.75);
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    .overlay {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.86);
      color: #fff;
      font-size: var(--sw-fs-xl);
      z-index: 50;
      text-align: center;
      line-height: 1.6;
    }
    .pill {
      font-size: var(--sw-fs-xs);
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.85);
    }
    .pill[data-status='warn'] {
      background: rgba(245, 158, 11, 0.25);
    }
    .pill[data-status='error'] {
      background: rgba(239, 68, 68, 0.3);
    }
    header select.layout {
      background: #1e293b;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      padding: 3px 8px;
      font: inherit;
      font-size: 12px;
    }
    header select.layout option {
      color: #0f1729;
      background: #fff;
    }
    header a.exit {
      color: rgba(255, 255, 255, 0.85);
      text-decoration: none;
      font-size: 12px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 8px;
      padding: 3px 10px;
    }
    header a.exit:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
      gap: 10px;
    }
    .grid sw-camera-tile {
      border-radius: 8px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .stat {
      background: #172036;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stat .ic {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 8px;
      background: rgba(47, 107, 255, 0.22);
      color: #8fb0ff;
    }
    .stat .ic.red {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    .stat .ic.green {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .stat b {
      display: block;
      font-size: var(--sw-fs-2xl);
      line-height: 1.1;
    }
    .stat span {
      color: rgba(255, 255, 255, 0.6);
      font-size: var(--sw-fs-xs);
    }
    .note {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
    }
    @media (max-width: 767px) {
      .grid,
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;dt([d()],Le.prototype,"cams",2);dt([d()],Le.prototype,"settings",2);dt([d()],Le.prototype,"clock",2);dt([d()],Le.prototype,"page",2);dt([d()],Le.prototype,"health",2);dt([d()],Le.prototype,"disconnected",2);dt([d()],Le.prototype,"view",2);dt([d()],Le.prototype,"started",2);Le=dt([S("kiosk-wall")],Le);var ac=Object.defineProperty,rc=Object.getOwnPropertyDescriptor,Oe=(e,t,s,i)=>{for(var a=i>1?void 0:i?rc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ac(t,s,a),a};const nc={preserved:"#16a34a",preserving:"#d97706",nvr:"#7c3aed"},Ls=[{label:"יום",minutes:1440},{label:"6 שע׳",minutes:360},{label:"שעה",minutes:60},{label:"10 דק׳",minutes:10},{label:"דקה",minutes:1}];function Li(e){return String(e).padStart(2,"0")}function Ee(e){const t=(e%1440+1440)%1440;return`${Li(Math.floor(t/60))}:${Li(Math.floor(t%60))}`}function Qe(e){const t=(e%1440+1440)%1440,s=Math.min(59,Math.round(t%1*60));return`${Ee(t)}:${Li(s)}`}const oc={motion:"#ef4444",person:"#2f6bff",vehicle:"#22c55e",line:"#f59e0b",offline:"#6b7280",door:"#8b5cf6"};let ye=class extends x{constructor(){super(...arguments),this.segments=[],this.events=[],this.bookmarks=[],this.cursor=615,this.windowMinutes=360,this.precision="estimated",this.follow=!0,this.limit=1440,this.hover=null,this.lastHoverBucket=-1,this.viewStart=-1,this.dragging=!1}get start(){const e=Math.max(0,1440-this.windowMinutes);return this.viewStart>=0&&!this.follow?Math.max(0,Math.min(e,this.viewStart)):Math.max(0,Math.min(e,this.cursor-this.windowMinutes/2))}get step(){return this.windowMinutes>=360?1:this.windowMinutes>=60?1/6:1/60}snap(e){const t=this.step;return Math.max(0,Math.min(this.limit,Math.round(e/t)*t))}x(e,t){return(e-this.start)/this.windowMinutes*t}minuteAt(e){const t=e.currentTarget.getBoundingClientRect();return this.start+(e.clientX-t.left)/t.width*this.windowMinutes}onMove(e){const t=this.minuteAt(e);if(this.hover=t,!this.dragging){const s=Math.floor(t*6);if(s!==this.lastHoverBucket){this.lastHoverBucket=s;const i=e.currentTarget.getBoundingClientRect();this.dispatchEvent(new CustomEvent("hover",{detail:{minute:t,x:e.clientX-i.left,width:i.width},bubbles:!0,composed:!0}))}}if(this.dragging){const s=this.snap(t);this.cursor=s,this.dispatchEvent(new CustomEvent("scrub",{detail:{minute:s},bubbles:!0,composed:!0}))}}onDown(e){e.button===0&&(e.currentTarget.setPointerCapture(e.pointerId),this.dragging=!0,this.viewStart=this.start,this.follow=!1)}onUp(e){if(!this.dragging)return;this.dragging=!1;const t=this.snap(this.minuteAt(e));this.cursor=t,this.follow=!0,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:t,alt:e.altKey},bubbles:!0,composed:!0}))}onWheel(e){e.preventDefault();const t=Ls.findIndex(i=>i.minutes===this.windowMinutes),s=Math.max(0,Math.min(Ls.length-1,t+(e.deltaY>0?-1:1)));s!==t&&this.setWindow(Ls[s].minutes,this.minuteAt(e))}setWindow(e,t=this.cursor){const s=Math.max(0,Math.min(1,(t-this.start)/this.windowMinutes));this.windowMinutes=e,this.viewStart=t-s*e,this.follow=!1,this.dispatchEvent(new CustomEvent("window-change",{detail:{minutes:e},bubbles:!0,composed:!0}))}buckets(e){const t=[],s=this.windowMinutes/e;for(let i=0;i<e;i++){const a=this.start+i*s,n=a+s;let o=0;for(const l of this.segments)l.endMin>a&&l.startMin<n&&(o=Math.max(o,l.kind==="motion"?2:1));o&&this.events.some(l=>l.minute>=a-s&&l.minute<=n+s)&&(o=3),t.push(o)}return t}tickEvery(){const e=this.windowMinutes;return e<=1?10/60:e<=10?1:e<=60?10:e<=360?60:180}label(e){return this.windowMinutes<=10?Qe(e):Ee(e)}render(){const n=this.tickEvery(),o=[];for(let _=Math.ceil(this.start/n-1e-9)*n;_<=this.start+this.windowMinutes+1e-9;_+=n)o.push(_);const l=[0,12,26,36],p={verified:"זמן מאומת",keyframe_limited:"דיוק לפי keyframe",estimated:"זמן משוער",unknown:"דיוק לא ידוע"}[this.precision],f=this.x(this.cursor,1e3),u=this.label(this.cursor),v=u.length>5?62:48,$=this.limit<this.start+this.windowMinutes?Math.max(0,this.x(this.limit,1e3)):null;return r`
      <div class="bar">
        <span class="precision">${p} · לחיצה או גרירה = seek · גלגלת = זום</span>
        <div class="windows">
          ${Ls.map(_=>r`<button class=${_.minutes===this.windowMinutes?"on":""} @click=${()=>this.setWindow(_.minutes)}>${_.label}</button>`)}
        </div>
      </div>
      <svg
        class=${this.dragging?"dragging":""}
        viewBox="0 0 ${1e3} ${84}"
        preserveAspectRatio="none"
        @pointermove=${this.onMove}
        @pointerleave=${()=>{this.hover=null,this.lastHoverBucket=-1,this.dispatchEvent(new CustomEvent("hover-end",{bubbles:!0,composed:!0}))}}
        @pointerdown=${this.onDown}
        @pointerup=${this.onUp}
        @pointercancel=${()=>this.dragging=!1}
        @wheel=${this.onWheel}
        role="img"
        aria-label="ציר זמן הקלטות">
        <line x1="0" x2=${1e3} y1=${58+.5} y2=${58+.5} stroke="var(--sw-border)" />
        ${$!==null?h`<rect x=${$} y="14" width=${Math.max(0,1e3-$)} height=${44} fill="var(--sw-surface-3)" opacity="0.7" />`:c}
        ${this.buckets(160).map((_,N)=>{if(!_)return c;const X=l[_];return h`<rect x=${N*6.25+1} y=${58-X} width=${Math.max(2,6.25-2)} height=${X} rx="1.5" fill="var(--sw-accent)" opacity=${_===1?.45:_===2?.8:1} />`})}
        ${o.map(_=>h`<line x1=${this.x(_,1e3)} x2=${this.x(_,1e3)} y1=${58} y2=${63} stroke="var(--sw-border-strong)" /><text x=${this.x(_,1e3)} y=${78} font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${this.label(_)}</text>`)}
        ${this.events.map(_=>{const N=this.x(_.minute,1e3);return N<0||N>1e3?c:h`<g><circle cx=${N} cy=${58-l[3]-8} r="3.5" fill=${oc[_.kind]} /><title>${_.label} · ${Ee(_.minute)}</title></g>`})}
        ${this.bookmarks.map(_=>{const N=this.x(_.minute,1e3),X=this.x(_.endMinute,1e3);if(X<0||N>1e3)return c;const Vt=nc[_.preservation],A=ae=>{ae.stopPropagation(),this.cursor=_.minute,this.follow=!0,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:_.minute,alt:!1},bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("bookmark-click",{detail:{id:_.id,minute:_.minute},bubbles:!0,composed:!0}))};return h`<g class="bm" data-bookmark=${_.id} role="button" tabindex="0" aria-label=${_.label} @pointerdown=${ae=>ae.stopPropagation()} @click=${A} @keydown=${ae=>(ae.key==="Enter"||ae.key===" ")&&A(ae)}>
            <rect x=${Math.max(0,N)} y="13" width=${Math.max(2,Math.min(1e3,X)-Math.max(0,N))} height="3" rx="1.5" fill=${Vt} opacity="0.55" />
            <line x1=${N} x2=${N} y1="3" y2=${58} stroke=${Vt} stroke-dasharray="2 3" opacity="0.6" />
            <polygon points=${`${N},2 ${N+9},6 ${N},10`} fill=${Vt} />
            <title>${_.label} · ${Ee(_.minute)}</title>
          </g>`})}
        ${this.hover!==null&&!this.dragging?h`<line pointer-events="none" x1=${this.x(this.hover,1e3)} x2=${this.x(this.hover,1e3)} y1="18" y2=${58} stroke="var(--sw-text-3)" stroke-dasharray="3 3" /><text pointer-events="none" x=${this.x(this.hover,1e3)} y="12" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font-mono)">${this.label(this.hover)}</text>`:c}
        ${f>=-60&&f<=1060?h`<g transform="translate(${f} 0)" pointer-events="none">
              <line x1="0" x2="0" y1="15" y2=${62} stroke="var(--sw-accent)" stroke-width="2" />
              <rect x=${-v/2} y="0" width=${v} height="16" rx="5" fill="var(--sw-accent)" />
              <text x="0" y="11.5" font-size="10.5" text-anchor="middle" fill="#fff" font-family="var(--sw-font-mono)" font-weight="600">${u}</text>
            </g>`:c}
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-accent)">הקלטה (גובה = פעילות)</span>
        <span style="--lg: #ef4444">תנועה</span>
        <span style="--lg: #2f6bff">אדם</span>
        <span style="--lg: #22c55e">רכב</span>
        <span style="--lg: #8b5cf6">דלת</span>
        <span style="--lg: var(--sw-border-strong)">ריק = אין הקלטה / לא נבדק</span>
        ${this.limit<1440?r`<span style="--lg: var(--sw-surface-3)">אפור = עתיד</span>`:c}
      </div>
    `}};ye.styles=z`
    :host {
      display: block;
      direction: ltr;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-2);
      user-select: none;
      box-shadow: var(--sw-shadow-1);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      direction: rtl;
      margin-block-end: 6px;
      flex-wrap: wrap;
    }
    .windows {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 7px;
      padding: 2px;
    }
    .windows button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 4px 10px;
      border-radius: 5px;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .windows button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .precision {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    g.bm {
      cursor: pointer;
    }
    g.bm:focus-visible polygon {
      stroke: var(--sw-text);
      stroke-width: 1.5;
    }
    svg {
      inline-size: 100%;
      block-size: 84px;
      display: block;
      cursor: crosshair;
      touch-action: none;
    }
    svg.dragging {
      cursor: grabbing;
    }
    .legend {
      display: flex;
      gap: var(--sw-s-4);
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 4px;
      flex-wrap: wrap;
    }
    .legend span::before {
      content: '';
      display: inline-block;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      margin-inline-end: 6px;
      vertical-align: middle;
      background: var(--lg);
    }
  `;Oe([m({attribute:!1})],ye.prototype,"segments",2);Oe([m({attribute:!1})],ye.prototype,"events",2);Oe([m({attribute:!1})],ye.prototype,"bookmarks",2);Oe([m({type:Number})],ye.prototype,"cursor",2);Oe([m({type:Number})],ye.prototype,"windowMinutes",2);Oe([m()],ye.prototype,"precision",2);Oe([m({type:Boolean})],ye.prototype,"follow",2);Oe([m({type:Number})],ye.prototype,"limit",2);Oe([d()],ye.prototype,"hover",2);Oe([d()],ye.prototype,"viewStart",2);Oe([d()],ye.prototype,"dragging",2);ye=Oe([S("sw-timeline")],ye);const fs={open:"פתוח",in_review:"בבדיקה",closed:"סגור"},lc={preserved:"עותק שמור",preserving:"מעתיק מה־NVR…",nvr_only:"סימנייה ל־NVR בלבד",missing:"חסר: ה־NVR כבר לא מחזיק את הקטע",unknown:"לא נבדק מול ה־NVR",none:""};function Hr(e={}){const t=new URLSearchParams;e.status&&t.set("status",e.status),e.q&&t.set("q",e.q);const s=t.toString();return k(`cases${s?`?${s}`:""}`)}const Vr=e=>M("cases",e),dc=(e,t=!0)=>k(`cases/${e}${t?"":"?check=false"}`),cc=(e,t)=>He(`cases/${e}`,t),pc=e=>me(`cases/${e}`),Hi=(e,t)=>M(`cases/${e}/items`,t),hc=(e,t)=>me(`cases/${e}/items/${t}`),uc=(e,t)=>M(`cases/${e}/items/${t}/preserve`),Ba={preserved:"עותק שמור",preserving:"מעתיק מה־NVR…",nvr:"סימנייה ל־NVR"},La=(e,t)=>k(`cases/bookmarks?camera_id=${encodeURIComponent(e)}&date=${encodeURIComponent(t)}`),Ha=e=>e.toISOString().replace(/\.\d{3}Z$/,"Z"),Vi=(e,t=15,s=45)=>({from_at:Ha(new Date(e.getTime()-t*1e3)),to_at:Ha(new Date(e.getTime()+s*1e3))}),mc=()=>k("evidence/signing"),fc=()=>M("evidence/signing/rotate"),wc=e=>M(`cases/${e}/bundle`),vc=e=>k(`cases/${e}/bundles`),gc=(e,t)=>he(`cases/${e}/bundles/${t}`),bc=(e,t)=>he(`cases/${e}/items/${t}/file`);function yc(e){const t=new FormData;return t.append("file",e,e.name),ri("cases/bundles/verify",t)}var $c=Object.defineProperty,xc=Object.getOwnPropertyDescriptor,De=(e,t,s,i)=>{for(var a=i>1?void 0:i?xc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&$c(t,s,a),a};let $e=class extends x{constructor(){super(...arguments),this.item=null,this.subheading="",this.cases=[],this.loading=!1,this.error="",this.picked="",this.newTitle="",this.note="",this.busy=!1,this.done=null,this.canManage=!0}updated(e){e.has("item")&&this.item&&this.load()}async load(){this.loading=!0,this.error="",this.done=null,this.note="";try{const e=await Hr({status:"open"});this.cases=e.cases,this.canManage=e.can_manage,this.picked=e.cases[0]?.id??"new"}catch(e){this.error=w(e)}finally{this.loading=!1}}close(){this.item=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async confirm(){const e=this.item;if(e){this.busy=!0,this.error="";try{let t=this.picked,s=this.cases.find(a=>a.id===t)?.title??"";if(t==="new"){if(!this.newTitle.trim()){this.error="תן שם לתיק החדש.";return}const a=await Vr({title:this.newTitle.trim()});t=a.id,s=a.title}const i=await Hi(t,{...e,note:this.note.trim()||e.note});this.done={id:t,title:s},this.dispatchEvent(new CustomEvent("added",{detail:{caseId:t,item:i},bubbles:!0,composed:!0}))}catch(t){this.error=w(t)}finally{this.busy=!1}}}render(){const e=this.item;if(!e)return c;const t=e.kind==="event"?"האירוע":e.kind==="clip"?"הקטע":"ההערה";return r`<sw-dialog open heading="הוסף לתיק" subheading=${this.subheading} data-case-picker @close=${()=>this.close()}>
      ${this.error?r`<div class="err" data-case-error>${this.error}</div>`:c}
      ${this.done?r`<div class="ok" data-case-added>${t} נוסף לתיק "${this.done.title}".</div>`:this.loading?r`<div class="note">טוען תיקים…</div>`:r`${this.canManage?c:r`<div class="note">אין לך הרשאה לנהל תיקים.</div>`}
              <sw-field label="תיק">
                <select aria-label="תיק" data-case-select @change=${s=>this.picked=s.target.value}>
                  ${this.cases.map(s=>r`<option value=${s.id} ?selected=${s.id===this.picked}>${s.title} · ${s.counts.items} פריטים</option>`)}
                  <option value="new" ?selected=${this.picked==="new"}>+ תיק חדש</option>
                </select>
              </sw-field>
              ${this.picked==="new"?r`<sw-field label="שם התיק החדש"><input data-case-new-title .value=${this.newTitle} placeholder="למשל: כניסה לא מורשית" @input=${s=>this.newTitle=s.target.value} /></sw-field>`:c}
              ${e.kind!=="note"?r`<sw-field label="הערה לפריט (לא חובה)"><input data-case-note .value=${this.note} @input=${s=>this.note=s.target.value} /></sw-field>`:c}
              <div class="note">
                ${e.kind==="clip"?"הקטע נשמר כסימנייה שמצביעה ל־NVR; שימור עותק מאומת נעשה מתוך התיק.":e.kind==="event"?"האירוע נוסף עם חלון של 5 שניות לפני ו־30 שניות אחרי; שימור עותק מאומת נעשה מתוך התיק.":""}
              </div>`}
      ${this.done?r`<sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>סגור</sw-button>
            <sw-button slot="footer" variant="primary" icon="case" data-case-open @click=${()=>{const s=this.done?.id??"";this.close(),b(`/investigate/cases/${s}`)}}>פתח את התיק</sw-button>`:r`<sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" icon="plus" data-case-confirm ?disabled=${this.busy||this.loading||!this.canManage} @click=${()=>this.confirm()}>הוסף</sw-button>`}
    </sw-dialog>`}};$e.styles=z`
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success, #15803d);
      font-size: var(--sw-fs-sm);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    select,
    input {
      inline-size: 100%;
      font: inherit;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
  `;De([m({attribute:!1})],$e.prototype,"item",2);De([m()],$e.prototype,"subheading",2);De([d()],$e.prototype,"cases",2);De([d()],$e.prototype,"loading",2);De([d()],$e.prototype,"error",2);De([d()],$e.prototype,"picked",2);De([d()],$e.prototype,"newTitle",2);De([d()],$e.prototype,"note",2);De([d()],$e.prototype,"busy",2);De([d()],$e.prototype,"done",2);De([d()],$e.prototype,"canManage",2);$e=De([S("sw-case-picker")],$e);const jr=(e,t)=>k(`cameras/${e}/recordings?date=${t}`),ws=new Set,vs=new Set;function kc(){if(!(!ws.size&&!vs.size)){for(const e of vs)navigator.sendBeacon?.(he(`playback/groups/${e}/close`),"");for(const e of ws)navigator.sendBeacon?.(he(`playback/sessions/${e}/close`),"");ws.clear(),vs.clear()}}typeof window<"u"&&window.addEventListener("pagehide",kc);const aa=async(e,t)=>{const s=await M("playback/sessions",{camera_id:e,start_at:t});return ws.add(s.id),s},Va=(e,t)=>M(`playback/sessions/${e}/seek`,{start_at:t}),Ss=e=>(ws.delete(e),me(`playback/sessions/${e}`));function Gs(e){const t=new URL(he(`playback/sessions/${e.id}/ws?generation=${e.generation}`));return t.protocol=t.protocol==="https:"?"wss:":"ws:",t.toString()}function Ze(e,t){const s=new Intl.DateTimeFormat("en-CA",{timeZone:t,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(e),i=a=>s.find(n=>n.type===a)?.value??"";return`${i("year")}-${i("month")}-${i("day")}`}function te(e,t){const s=new Intl.DateTimeFormat("en-GB",{timeZone:t,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(e),i=a=>Number(s.find(n=>n.type===a)?.value??0);return i("hour")*60+i("minute")+i("second")/60}function Ue(e,t,s){const[i,a,n]=e.split("-").map(Number),o=Date.UTC(i,a-1,n,Math.floor(t/60),Math.floor(t%60),Math.round(t%1*60)),l=f=>{const u=new Intl.DateTimeFormat("en-US",{timeZone:s,hour12:!1,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(f)),v=_=>Number(u.find(N=>N.type===_)?.value??0);return Date.UTC(v("year"),v("month")-1,v("day"),v("hour")%24,v("minute"),v("second"))-f};let p=o-l(o);return p=o-l(p),new Date(p)}const _c=async(e,t)=>{const s=await M("playback/groups",{camera_ids:e,start_at:t});return vs.add(s.id),s},zc=(e,t)=>M(`playback/groups/${e}/seek`,{start_at:t}),Sc=e=>(vs.delete(e),me(`playback/groups/${e}`)),Mc=(e,t)=>M(`playback/groups/${e}/sync`,{p95_s:t.p95,quality:t.quality,samples:t.samples,partial:t.partial,members:t.members}),di=(e,t)=>he(`cameras/${e}/frame?at=${encodeURIComponent(t)}`),Fr=(e,t,s)=>({camera_id:e,from_at:t,to_at:s}),ja=(e,t,s)=>M("exports/estimate",Fr(e,t,s)),Ac=(e,t,s)=>M("exports",Fr(e,t,s)),Ec=()=>k("exports"),Pc=e=>M(`exports/${e}/cancel`),Ic=e=>me(`exports/${e}`),Wr=e=>he(`exports/${e}/download`),Cc=e=>he(`exports/${e}/manifest`);function Ut(e){return e==null?"—":e<1024*1024?`${Math.round(e/1024)} KB`:e<1024*1024*1024?`${(e/1024/1024).toFixed(1)} MB`:`${(e/1024/1024/1024).toFixed(2)} GB`}var Tc=Object.defineProperty,Oc=Object.getOwnPropertyDescriptor,C=(e,t,s,i)=>{for(var a=i>1?void 0:i?Oc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Tc(t,s,a),a};const kt=["closed","expired","failed"];function os(e){return Qe(Math.max(0,Math.min(1439.983,e)))}function xi(e){const[t=0,s=0,i=0]=e.split(":").map(Number);return t*60+s+i/60}function Dc(e){const t=e.map(s=>Math.abs(s)).sort((s,i)=>s-i);return t[Math.min(t.length-1,Math.max(0,Math.ceil(.95*t.length)-1))]}let I=class extends x{constructor(){super(...arguments),this.cameraId="",this.at="",this.extraParam="",this.demoCamera="cam-10",this.cursor=615,this.generation=3,this.playing=!0,this.speed=1,this.filter="all",this.cams=null,this.tz="Asia/Jerusalem",this.date="",this.rec=null,this.dayEvents=[],this.bookmarks=[],this.activeBookmark=null,this.loadingRec=!1,this.session=null,this.group=null,this.extra=[],this.casePick=null,this.preview=null,this.previewTimer=0,this.busy=!1,this.error="",this.notice="",this.tileStatus={},this.drifts={},this.clock=null,this.barrier="none",this.syncStats=null,this.clockPausedAt=0,this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={},this.groupStartedAt=0,this.lastReport=0,this.seekSentAt={},this.firstPlayAt={},this.startLatency={},this.paused=!1,this.scrubbing=!1,this.position=null,this.exportOpen=!1,this.exportFrom="",this.exportTo="",this.estimate=null,this.exportJob=null,this.exportBusy=!1,this.exportError="",this.onTlHover=e=>{if(!this.cameraId||!g())return;window.clearTimeout(this.previewTimer);const t=e.detail;this.previewTimer=window.setTimeout(()=>{const s=Ue(this.date,t.minute,this.tz).toISOString().replace(/\.\d{3}Z$/,"Z");this.preview={minute:t.minute,x:t.x,width:t.width,url:di(this.cameraId,s),failed:!1}},250)},this.onTlHoverEnd=()=>{window.clearTimeout(this.previewTimer),this.preview=null}}connectedCallback(){super.connectedCallback(),g()&&(this.init(),this.ticker=window.setInterval(()=>this.tick(),500))}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.ticker),this.endSession()}updated(e){g()&&e.has("cameraId")&&e.get("cameraId")!==void 0&&this.cams&&this.selectCamera(this.cameraId,!0)}get members(){return[this.cameraId,...this.extra.filter(e=>e!==this.cameraId)]}get groupMode(){return this.extra.filter(e=>e!==this.cameraId).length>0}get masterSession(){return this.groupMode?this.group?.sessions.find(e=>e.camera_id===this.cameraId)??this.group?.sessions[0]??null:this.session}get live(){const e=this.masterSession;return!!e&&!kt.includes(e.state)&&(this.groupMode?!!this.group:!0)}async init(){try{const[e,t]=await Promise.all([je(),Te()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras.filter(n=>n.enabled);const s=this.cams.find(n=>n.id===this.cameraId)??this.cams[0],i=this.at?new Date(this.at):null,a=!!i&&!Number.isNaN(i.getTime());if(this.date=Ze(a?i:new Date,this.tz),s)if(this.cameraId=s.id,this.extraParam&&(this.extra=this.extraParam.split(",").filter(n=>n&&n!==s.id&&this.cams.some(o=>o.id===n)).slice(0,3)),await this.loadRecordings(),a)this.cursor=te(i,this.tz),await this.startAt(i);else{const n=this.rec?.segments.at(-1);this.cursor=n?this.insideLast(n):Math.max(0,te(new Date,this.tz)-5)}}catch(e){this.error=w(e)}}async selectCamera(e,t=!1){!e||!t&&e===this.cameraId||(await this.endSession(),this.cameraId=e,this.extra=this.extra.filter(s=>s!==e),this.error="",this.notice="",await this.loadRecordings())}async setDate(e){if(!e||e===this.date)return;await this.endSession(),this.date=e,await this.loadRecordings();const t=this.rec?.segments.at(-1);this.cursor=t?this.insideLast(t):540}insideLast(e){const t=te(new Date(e.start_at),this.tz),s=te(new Date(e.end_at),this.tz);return Math.max(0,t,s-5)}async loadRecordings(){if(!(!this.cameraId||!this.date)){this.loadingRec=!0,this.rec=null;try{const[e,t,s]=await Promise.all([jr(this.cameraId,this.date).then(i=>({ok:!0,r:i}),i=>({ok:!1,e:i})),ad(this.cameraId,this.date).catch(()=>({events:[]})),La(this.cameraId,this.date).catch(()=>({bookmarks:[]}))]);if(this.dayEvents=t.events,this.bookmarks=s.bookmarks,this.activeBookmark=null,!e.ok)throw e.e;this.rec=e.r,this.error=""}catch(e){this.error=w(e)}finally{this.loadingRec=!1}}}get markers(){return this.dayEvents.map(e=>({minute:te(new Date(e.occurred_at),this.tz),kind:od(e.type),label:`${Y[e.type]??e.type}${e.confidence==="inferred"?" (מהקלטה)":""}${e.count>1?` ×${e.count}`:""}`}))}get bookmarkMarkers(){return this.bookmarks.map(e=>({id:e.id,minute:te(new Date(e.from_at),this.tz),endMinute:te(new Date(e.to_at),this.tz),label:`תיק „${e.case_title}”${e.note?` · ${e.note}`:""} · ${Ba[e.preservation]}`,preservation:e.preservation}))}async loadBookmarks(){if(!(!this.cameraId||!this.date))try{this.bookmarks=(await La(this.cameraId,this.date)).bookmarks}catch{}}bookmarkAt(e){this.cameraId&&(this.casePick={kind:"clip",camera_id:this.cameraId,...Vi(Ue(this.date,e,this.tz),10,20),note:"סימנייה"})}get segmentsMin(){return this.rec?this.rec.segments.map(e=>{const t=te(new Date(e.start_at),this.tz);let s=te(new Date(e.end_at),this.tz);return s<t&&(s=1440),{startMin:t,endMin:s,kind:e.kind==="continuous"?"continuous":"motion"}}):[]}inRecording(e){return this.segmentsMin.some(t=>e>=t.startMin&&e<=t.endMin)}get limitMinute(){return this.date===Ze(new Date,this.tz)?te(new Date,this.tz):1440}cameraName(e){return this.cams?.find(t=>t.id===e)?.name??e}async startAt(e){if(!(!this.cameraId||this.busy)){this.busy=!0,this.error="",this.notice="",this.scrubbing=!1;try{const t=e.toISOString().replace(/\.\d{3}Z$/,"Z");if(this.groupMode){const s=performance.now(),i=this.group&&this.group.sessions.some(n=>!kt.includes(n.state))?await zc(this.group.id,t):await _c(this.members,t);this.group=i;for(const n of i.sessions)this.seekSentAt[n.camera_id]=s,delete this.firstPlayAt[n.camera_id];this.session=null,this.position=new Date(i.requested_at);const a=Object.keys(i.missing);a.length&&(this.notice=`ללא הקלטה בזמן הזה: ${a.map(n=>this.cameraName(n)).join(", ")}`)}else{const s=this.session&&!kt.includes(this.session.state)?await Va(this.session.id,t):await aa(this.cameraId,t);this.session=s,this.group=null,this.position=new Date(s.requested_at),s.moved_to_next_segment&&(this.notice=`אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא (${this.fmt(new Date(s.requested_at))}).`)}if(this.cursor=te(this.position,this.tz),this.paused=!1,this.tileStatus={},this.drifts={},this.resetClock(),!this.isConnected){await this.endSession();return}}catch(t){if(t instanceof be&&t.body.code==="no_recording")this.notice="אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live.",this.position=e;else if(t instanceof be&&(t.body.code==="session_over"||t.body.code==="not_found")){this.session=null,this.group=null,this.busy=!1,await this.startAt(e);return}else this.error=w(t)}finally{this.busy=!1}}}async endSession(){const e=this.session,t=this.group;this.session=null,this.group=null,this.tileStatus={},this.drifts={},this.resetClock();try{t?await Sc(t.id):e&&!kt.includes(e.state)&&await Ss(e.id)}catch{}}async toggleExtra(e){const t=this.extra.includes(e)?this.extra.filter(i=>i!==e):[...this.extra,e].slice(-3),s=this.currentInstant();await this.endSession(),this.extra=t,s&&await this.startAt(s)}players(){return Array.from(this.renderRoot.querySelectorAll("sw-live-player"))}masterPlayer(){return this.players().find(e=>e.dataset.camera===this.cameraId)??this.players()[0]}currentInstant(){const e=this.masterSession;if(!e)return this.position;if(this.groupMode&&this.clock)return new Date(this.clockNow());const t=new Date(e.requested_at).getTime();return new Date(t+(this.masterPlayer()?.mediaTime??0)*1e3)}tick(){if(!this.masterSession||this.paused||this.scrubbing)return;if(this.groupMode&&this.group){this.tickGroup();return}const t=this.masterPlayer();if(!t||t.status!=="playing")return;const s=this.currentInstant();s&&(this.position=s,this.cursor=te(s,this.tz),t.stale&&t.bufferAhead<.4&&!this.busy&&this.startAt(s))}resetClock(){this.clock=null,this.clockPausedAt=0,this.barrier=this.groupMode?"waiting":"none",this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={};for(const e of this.players())e.rate=1;this.groupMode&&(this.speed=1),this.syncStats=null,this.groupStartedAt=performance.now(),this.lastReport=0}clockNow(){const e=this.clock;return e.baseMs+((this.paused&&this.clockPausedAt?this.clockPausedAt:performance.now())-e.startedAt)}tickGroup(){const e=this.group,t=performance.now(),s=this.players().map(l=>{const p=l.dataset.camera??"",f=e.sessions.find(u=>u.camera_id===p);return{cid:p,p:l,sess:f,at:f?new Date(f.requested_at).getTime()+l.mediaTime*1e3:NaN}}).filter(l=>l.sess&&!kt.includes(l.sess.state)),i=s.filter(l=>l.p.status==="playing");if(!this.clock){const l=s.length>0&&i.length===s.length,p=t-this.groupStartedAt>12e3&&i.length>0;if(!l&&!p){this.barrier="waiting";return}const f=i.find(u=>u.cid===this.cameraId)??i[0];this.clock={baseMs:f.at,startedAt:t},this.barrier="passed",this.driftSamples={},this.lateSince={}}let a=this.clockNow();if(i.length>=3){const l=i.map(p=>p.at).sort((p,f)=>p-f);a=l[Math.floor(l.length/2)]}else i.length&&(a=(i.find(l=>l.cid===this.cameraId)??i[0]).at);this.clock={baseMs:a,startedAt:t};const n=new Date(a);this.position=n,this.cursor=te(n,this.tz);const o={};for(const l of s){if(l.p.status!=="playing"){o[l.cid]=NaN,this.lateSince[l.cid]||(this.lateSince[l.cid]=t);continue}delete this.lateSince[l.cid];const p=(l.at-a)/1e3;o[l.cid]=p;const f=this.driftSamples[l.cid]??=[];if(f.push(p),f.length>40&&f.shift(),f.length>=2&&Math.abs(p)>.25&&Math.abs(p)<=3){const u=p<0?Math.abs(p)>1?1.15:1.05:Math.abs(p)>1?.85:.95;l.p.rate!==u&&(this.nudges[l.cid]=(this.nudges[l.cid]??0)+1),l.p.rate=u}else(Math.abs(p)<=.25||Math.abs(p)>3)&&(l.p.rate=1);l.cid!==this.cameraId&&f.length>=4&&f.slice(-4).every(u=>Math.abs(u)>3)&&(this.resyncs[l.cid]??0)<2&&t-(this.resyncAt[l.cid]??0)>2e4&&this.resyncMember(l.cid,a)}this.drifts=o,this.syncStats=this.computeSync(s.map(l=>l.cid),t),t-this.lastReport>5e3&&this.syncStats.samples>=4&&(this.lastReport=t,Mc(e.id,this.syncStats).catch(()=>{}))}computeSync(e,t){const s={};let i=null,a=0;for(const p of e){const f=this.driftSamples[p]??[],u=f.length?Dc(f):null,v=this.lateSince[p]?t-this.lateSince[p]>8e3:!1;s[p]={p95:u,samples:f.length,last:f.length?f[f.length-1]:null,resyncs:this.resyncs[p]??0,state:v?"late":f.length?"measured":"waiting",latency_ms:this.startLatency[p]??null,nudges:this.nudges[p]??0},a+=f.length,u!==null&&(i=i===null?u:Math.max(i,u))}const n=Object.keys(this.group?.missing??{}),o=Object.values(s).some(p=>p.state==="late"),l=this.barrier!=="passed"||i===null?"waiting":i<=.5?"synced":i<=2?"slight":"out_of_sync";return{p95:i,quality:l,samples:a,partial:n.length>0||o,missing:n,members:s}}async resyncMember(e,t){const s=this.group,i=s?.sessions.find(n=>n.camera_id===e);if(!s||!i||kt.includes(i.state))return;this.resyncAt[e]=performance.now(),this.resyncs[e]=(this.resyncs[e]??0)+1,this.driftSamples[e]=[];const a=Math.min(this.startLatency[e]??4e3,15e3);try{const n=await Va(i.id,new Date(t+a).toISOString().replace(/\.\d{3}Z$/,"Z"));this.group===s&&(this.group={...s,sessions:s.sessions.map(o=>o.id===n.id?n:o)}),this.seekSentAt[e]=performance.now(),delete this.firstPlayAt[e]}catch{}}syncLabel(){const e=this.syncStats;if(this.barrier==="waiting"||!e||e.quality==="waiting")return"סנכרון: ממתין לחסם הפתיחה";const t=e.p95===null?"—":`${e.p95.toFixed(2)} ש׳`;return`סנכרון: ${{synced:"מסונכרן",slight:"סטייה קלה",out_of_sync:"לא מסונכרן",waiting:""}[e.quality]} · p95 ${t}${e.partial?" · חלקי":""}`}async onSeek(e){const t=e.detail.minute,s=Ue(this.date,t,this.tz);if(s.getTime()>Date.now()){this.notice="לא ניתן לנגן זמן עתידי.",this.scrubbing=!1;return}this.cursor=t,e.detail.alt&&this.bookmarkAt(t),await this.startAt(s)}onScrub(e){this.scrubbing=!0,this.cursor=e.detail.minute,this.position=Ue(this.date,e.detail.minute,this.tz)}async nudge(e){const t=this.currentInstant();t&&await this.startAt(new Date(t.getTime()+e*1e3))}setSpeed(e){if(this.groupMode||e>1)return;this.speed=e;const t=this.masterPlayer();t&&(t.rate=e)}stepFrame(e){const t=this.masterPlayer(),s=this.cams?.find(n=>n.id===this.cameraId),i=s?.stream?.fps&&s.stream.fps>0?s.stream.fps:25;if(!t)return;if(!t.stepFrame(e,i)){this.notice="הפריים המבוקש מחוץ למאגר שכבר הגיע מה־NVR — השתמש בקפיצה של 10 שניות או בציר הזמן.";return}this.notice="";const a=this.currentInstant();a&&(this.position=a,this.cursor=te(a,this.tz))}togglePause(){const e=this.players();if(e.length){if(this.paused){const t=this.masterPlayer();if(!this.groupMode&&t?.stale&&this.position){this.startAt(this.position);return}e.forEach(s=>s.resume()),this.clock&&this.clockPausedAt&&(this.clock={...this.clock,startedAt:this.clock.startedAt+(performance.now()-this.clockPausedAt)}),this.clockPausedAt=0}else e.forEach(t=>t.pause()),this.clockPausedAt=performance.now();this.paused=!this.paused}}onTilePlayer(e,t){if(this.tileStatus={...this.tileStatus,[e]:t.detail.status},t.detail.status==="playing"&&this.seekSentAt[e]&&!this.firstPlayAt[e]&&(this.firstPlayAt[e]=performance.now(),this.startLatency[e]=this.firstPlayAt[e]-this.seekSentAt[e]),e===this.cameraId){if(this.masterSession&&t.detail.status==="playing"&&(this.session&&(this.session={...this.session,state:"playing"}),!this.groupMode&&this.speed!==1)){const s=this.masterPlayer();s&&s.rate!==this.speed&&(s.rate=this.speed)}if(t.detail.status==="ended"){const s=this.currentInstant(),i=this.masterSession;s&&i&&new Date(i.playback_end_at).getTime()-s.getTime()<5e3&&this.startAt(new Date(new Date(i.playback_end_at).getTime()+1e3))}}}fmt(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(e)}openExport(){const e=Math.floor(this.cursor*60)/60;this.exportFrom=os(Math.max(0,e-1)),this.exportTo=os(Math.min(this.limitMinute,e+1)),this.estimate=null,this.exportJob=null,this.exportError="",this.exportOpen=!0}exportRange(){const e=Ue(this.date,xi(this.exportFrom),this.tz),t=Ue(this.date,xi(this.exportTo),this.tz);return t.getTime()<=e.getTime()?(this.exportError="זמן הסיום חייב להיות אחרי ההתחלה.",null):[e.toISOString().replace(/\.\d{3}Z$/,"Z"),t.toISOString().replace(/\.\d{3}Z$/,"Z")]}async runEstimate(){const e=this.exportRange();if(e){this.exportBusy=!0,this.exportError="";try{this.estimate=await ja(this.cameraId,e[0],e[1])}catch(t){this.exportError=w(t)}finally{this.exportBusy=!1}}}async runExport(){const e=this.exportRange();if(e){this.exportBusy=!0,this.exportError="";try{const t=this.estimate??await ja(this.cameraId,e[0],e[1]);if(this.estimate=t,!t.files){this.exportError="אין קבצים מוקלטים בטווח שנבחר.";return}this.exportJob=await Ac(this.cameraId,e[0],e[1])}catch(t){this.exportError=w(t)}finally{this.exportBusy=!1}}}renderExportDialog(){const e=this.estimate,t=this.exportJob;return r`<sw-dialog ?open=${this.exportOpen} heading="ייצוא קטע" subheading=${`${this.cameraName(this.cameraId)} · ${this.date} · ${this.tz}`} @close=${()=>this.exportOpen=!1}>
      <div class="dlg">
        ${t?r`<div class="est"><strong>עבודת הייצוא נוצרה</strong><span>${t.files.length} קבצים · משוער ${Ut(t.estimate_bytes)} · מצב: ${t.state}</span><span>ה־NVR עדיין מכין את הקובץ; "מעקב והורדה" למטה עובר למסך שבו כפתור ההורדה יופיע ברגע שהוא מוכן.</span></div>`:r`
              <div class="row">
                <sw-field label="מ־"><input type="time" step="1" data-ltr .value=${this.exportFrom} @change=${s=>{this.exportFrom=s.target.value,this.estimate=null}} /></sw-field>
                <sw-field label="עד"><input type="time" step="1" data-ltr .value=${this.exportTo} @change=${s=>{this.exportTo=s.target.value,this.estimate=null}} /></sw-field>
              </div>
              ${e?r`<div class="est">
                    <span>${e.files} קבצי NVR בטווח · נפח משוער ${Ut(e.estimate_bytes)} (מקסימום ${Ut(e.max_bytes)}) · כיסוי ${e.coverage==="complete"?"מלא":"חלקי"}</span>
                    ${e.first_file_at?r`<span class="ltr">${this.fmt(new Date(e.first_file_at))} → ${this.fmt(new Date(e.last_file_end_at??e.first_file_at))}</span>`:c}
                    <span>${e.note}</span>
                    ${e.ffmpeg?c:r`<span class="warn">ffmpeg לא זמין בשרת: הקובץ יימסר במיכל המקורי (Hikvision PS) ללא חיתוך.</span>`}
                  </div>`:r`<div class="session">הייצוא מוריד את הקבצים המקוריים מה־NVR (לפי קובץ, כך המכשיר תומך) ואז חותך לטווח ב־keyframe. חשב נפח לפני היצירה.</div>`}
            `}
        ${this.exportError?r`<div class="err">${this.exportError}</div>`:c}
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        ${t?r`<sw-button variant="primary" icon="download" @click=${()=>b("/investigate/exports")}>מעקב והורדה</sw-button><sw-button @click=${()=>this.exportOpen=!1}>סגור</sw-button>`:r`<sw-button ?disabled=${this.exportBusy} @click=${()=>this.runEstimate()}>חשב נפח</sw-button>
              <sw-button variant="primary" icon="download" ?disabled=${this.exportBusy} @click=${()=>this.runExport()}>צור ייצוא</sw-button>
              <sw-button variant="ghost" @click=${()=>this.exportOpen=!1}>ביטול</sw-button>`}
      </div>
    </sw-dialog>`}renderStage(e){const t=this.live,s=!t&&!this.inRecording(this.cursor);if(this.groupMode){const a=this.members;return r`<div class="grid ${a.length===1?"one":""}">
        ${a.map(n=>{const o=this.group?.sessions.find(u=>u.camera_id===n),l=this.group?.missing[n],p=this.drifts[n],f=this.tileStatus[n];return r`<div class="tile ${n===this.cameraId?"master":""}">
            ${o&&!kt.includes(o.state)?r`<sw-live-player data-camera=${n} .wsUrl=${Gs(o)} mode="mse" .retry=${!1} recorded compact @player-status=${u=>this.onTilePlayer(n,u)}></sw-live-player>`:r`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${l==="gap"||l==="no_recording"?"אין הקלטה בזמן הזה":l==="playback_quota"?"מכסת הניגון מלאה":this.busy?"מכין…":this.group?"לא זמין":"לחץ על ציר הזמן"}</span></div></div>`}
            <span class="name" data-tile=${n} data-tile-state=${this.syncStats?.members[n]?.state??""}>${this.cameraName(n)}${n===this.cameraId?r` · מוביל`:c}${o&&f==="playing"&&Number.isFinite(p)?r`<span class="drift ${Math.abs(p)>2?"bad":""}" title="סטייה מהשעון־אב, נמדדת מהפריים המוצג">${p>=0?"+":""}${p.toFixed(1)}s</span>`:c}${this.syncStats?.members[n]?.state==="late"?r`<span class="drift bad">מאחרת</span>`:c}${(this.syncStats?.members[n]?.resyncs??0)>0?r`<span class="drift">סונכרן מחדש ×${this.syncStats.members[n].resyncs}</span>`:c}</span>
          </div>`})}
      </div>`}const i=this.session;return r`<div class="video ${s?"gap":""}">
      ${t&&i?r`<sw-live-player data-camera=${e.id} .wsUrl=${Gs(i)} mode="mse" .retry=${!1} recorded @player-status=${a=>this.onTilePlayer(e.id,a)}></sw-live-player>`:s?r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice||"אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live"}</span></div></div>`:r`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy?"מכין ניגון…":"לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר"}</span>${this.busy?c:r`<sw-button variant="primary" size="sm" icon="play" @click=${()=>this.startAt(Ue(this.date,this.cursor,this.tz))}>נגן מ־${os(this.cursor)}</sw-button>`}</div></div>`}
      <div class="tag"><sw-badge kind=${t?"recorded":"unknown"} ?onImage=${!!t}></sw-badge><span class="nm">${e.name}</span></div>
    </div>`}renderApi(){if(this.error&&!this.cams)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.init()}></sw-state-panel>`;if(!this.cams)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.cams.length)return r`<sw-state-panel state="empty" heading="אין מצלמות" hint="סנכרן מצלמות מה־NVR או בקש הרשאת ניגון."></sw-state-panel>`;const e=this.cams.find(o=>o.id===this.cameraId)??this.cams[0],t=this.masterSession,s=this.live,i=t?.time_precision??"unknown",a=this.position??Ue(this.date,this.cursor,this.tz),n=this.tileStatus[this.cameraId]??"";return r`
      <div class="filters">
        ${this.rec?r`<sw-chip icon="history">${this.rec.segments.length} מקטעים · ${this.rec.matches} קבצים</sw-chip>`:c}
        ${this.dayEvents.length?r`<sw-chip icon="bell" @click=${()=>b("/investigate/events",{camera:this.cameraId,date:this.date})}>${this.dayEvents.length} אירועים${this.dayEvents.every(o=>o.confidence==="inferred")?" (מהקלטות)":""}</sw-chip>`:c}
        ${this.bookmarks.length?r`<sw-chip icon="case" data-bookmarks-count title="סימניות מתיקי חקירה על ציר הזמן · Alt+לחיצה על הציר מוסיפה סימנייה">${this.bookmarks.length} סימניות</sw-chip>`:r`<span class="session" data-bookmarks-hint>אין עדיין סימניות · "הוסף לתיק" מסמן את הרגע הנוכחי, או Alt+לחיצה על הציר מסמנת נקודה אחרת</span>`}
        ${this.activeBookmark?r`<sw-chip selected icon="case" data-bookmark-active @click=${()=>b(`/investigate/cases/${this.activeBookmark.case_id}`)}>תיק „${this.activeBookmark.case_title}”${this.activeBookmark.note?` · ${this.activeBookmark.note}`:""} · ${Ba[this.activeBookmark.preservation]} · פתח</sw-chip>`:c}
        ${this.rec?.coverage==="partial"?r`<span class="warn">כיסוי חלקי: ${this.rec.note}</span>`:c}
        ${this.loadingRec?r`<span class="session">מחפש הקלטות…</span>`:c}
        ${this.notice?r`<span class="warn">${this.notice}</span>`:c}
        ${this.error?r`<span class="err">${this.error}</span>`:c}
        <span class="grow"></span>
        <sw-button size="sm" icon="case" data-add-to-case title="סימנייה בנקודה הנוכחית · Alt+לחיצה על הציר מסמנת נקודה אחרת" ?disabled=${!this.cameraId} @click=${()=>this.casePick={kind:"clip",camera_id:this.cameraId,...Vi(Ue(this.date,this.cursor,this.tz))}}>הוסף לתיק</sw-button>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${()=>this.openExport()}>ייצוא</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">במפה</sw-button></a>
      </div>
      <div class="compare">
        <span>השוואה (עד 4):</span>
        ${this.cams.filter(o=>o.id!==this.cameraId).map(o=>r`<sw-chip ?selected=${this.extra.includes(o.id)} @click=${()=>this.toggleExtra(o.id)}>${o.name}</sw-chip>`)}
        ${this.groupMode?r`<span>· שעון־אב אחד לכל האריחים (חסם פתיחה, ואז חציון זמני הפריימים המוצגים; מתחת לשלושה אריחים — המוביל); הסטייה של כל אריח נמדדת מול השעון, p95 על החלון האחרון; אריח מאחר מסונכרן לבד ואינו מזיז את האחרים (best effort, ללא עוגן זמן מאומת)</span>`:c}
      </div>
      <div class="stage">
        ${this.renderStage(e)}
        <span class="stamp">${this.date} ${this.fmt(a)} · ${{verified:"מאומת",keyframe_limited:"דיוק לפי keyframe",estimated:"משוער",unknown:"—"}[i]}${!this.groupMode&&this.speed!==1?r` · <span data-speed-active=${this.speed}>${this.speed}× הילוך איטי</span>`:c}${this.paused&&!this.groupMode?r` · <span data-paused>מושהה · צעד־פריים</span>`:c}${this.groupMode?r` · <span data-sync-quality=${this.syncStats?.quality??"waiting"} data-sync-p95=${this.syncStats?.p95??""} data-sync-samples=${this.syncStats?.samples??0}>${this.syncLabel()}</span>`:""}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused?"play":"pause"} label=${this.paused?"המשך":"השהה"} data-pause ?disabled=${!s||n!=="playing"} @click=${()=>this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה" ?disabled=${!s||this.busy} @click=${()=>this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה" ?disabled=${!s||this.busy} @click=${()=>this.nudge(10)}></sw-button>
          <span class="sep"></span>
          ${[.25,.5,1,2,4].map(o=>{const l=(t?.capabilities.supported_speeds??[1]).includes(o),p=this.masterPlayer()?.transport==="mse",f=o===1||!this.groupMode&&l&&(o>1||p),u=f?o<1?"הילוך איטי: המאגר מתמלא בזמן אמת ונצרך לאט יותר — זמן המקור נשאר מדויק":"":this.groupMode?"בסנכרון רב־מצלמות נתמך רק 1×":o>1?"לא נתמך במסלול הזה: הזרם מגיע מה־NVR בזמן אמת; מהירות מוגברת דורשת מקור ששולח מהר מזמן אמת":"הילוך איטי זמין רק בנתיב MSE";return r`<button class="q ${this.speed===o?"on":""}" data-speed=${o} ?disabled=${!f} title=${u} @click=${()=>this.setSpeed(o)}>${o}×</button>`})}
          <span class="sep"></span>
          <button class="q" data-frame-step="-1" ?disabled=${!s||this.groupMode||!this.paused} title=${this.groupMode?"צעד־פריים זמין במצלמה בודדת":this.paused?"פריים אחד אחורה (בתוך המאגר)":"צעד־פריים זמין בהשהיה"} @click=${()=>this.stepFrame(-1)}>‹ פריים</button>
          <button class="q" data-frame-step="1" ?disabled=${!s||this.groupMode||!this.paused} title=${this.groupMode?"צעד־פריים זמין במצלמה בודדת":this.paused?"פריים אחד קדימה (בתוך המאגר)":"צעד־פריים זמין בהשהיה"} @click=${()=>this.stepFrame(1)}>פריים ›</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא" ?disabled=${!s} @click=${()=>this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <div class="tlwrap">
        <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .bookmarks=${this.bookmarkMarkers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${i} @seek=${this.onSeek} @bookmark-click=${o=>this.activeBookmark=this.bookmarks.find(l=>l.id===o.detail.id)??null} @scrub=${this.onScrub} @hover=${this.onTlHover} @hover-end=${this.onTlHoverEnd}></sw-timeline>
        ${this.preview?r`<div class="tlpreview" data-tl-preview style="left:${Math.max(104,Math.min(this.preview.width-104,this.preview.x))}px">
              ${this.preview.failed?r`<div class="none">אין פריים בזמן זה</div>`:r`<img src=${this.preview.url} alt="" @error=${()=>{this.preview&&(this.preview={...this.preview,failed:!0})}} />`}
              <span>${Qe(this.preview.minute)}</span>
            </div>`:c}
      </div>
      <sw-case-picker .item=${this.casePick} subheading=${`${this.cams?.find(o=>o.id===this.cameraId)?.name??""} · ${this.date} ${Qe(this.cursor)}`} @added=${()=>void this.loadBookmarks()} @close=${()=>this.casePick=null}></sw-case-picker>
      <div class="session">
        <span>Session: ${t?`${t.id} · דור ${this.groupMode?this.group?.generation??t.generation:t.generation} · ${t.state}`:"אין"}</span>
        <span>נגן: ${n||"—"}${this.paused?" (מושהה)":""}</span>
        <span>אזור זמן: <span class="ltr">${this.tz}</span></span>
        <span>כיסוי: ${this.rec?this.rec.coverage==="complete"?"מלא":this.rec.coverage==="partial"?"חלקי":"לא ידוע":"—"}</span>
        ${t?r`<span>סוף הטווח: ${this.fmt(new Date(t.playback_end_at))}</span>`:c}
      </div>
      ${this.renderExportDialog()}
    `}seekDemo(e){this.cursor=e.detail.minute,this.generation+=1}renderDemo(){const e=G.find(i=>i.id===this.demoCamera)??G[0],t=!qs.some(i=>this.cursor>=i.startMin&&this.cursor<=i.endMin),s=et.filter(i=>i.minuteOfDay<1440).filter(i=>this.filter==="all"||i.type===this.filter).map(i=>({minute:i.minuteOfDay,kind:i.type,label:i.title}));return r`
      <div class="video ${t?"gap":""}">
        ${t?r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`:r`<sw-scene kind=${Ke[e.id]??"lobby"}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>`}
        <div class="tag"><sw-badge kind=${t?"unknown":"recorded"} ?onImage=${!t}></sw-badge><span class="nm">${e.name}</span></div>
        <span class="stamp">2026-09-14 ${Ee(this.cursor)}:00 · actual: ${t?"—":Ee(this.cursor)}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה":"נגן"} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
          <span class="sep"></span>
          ${[1,2,4].map(i=>r`<button class="q ${this.speed===i?"on":""}" @click=${()=>this.speed=i}>${i}×</button>`)}
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="aperture" label="צילום מהקלטה"></sw-button>
          <button class="q on">1080p</button>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${qs} .events=${s} .cursor=${this.cursor} precision="estimated" @seek=${this.seekDemo}></sw-timeline>
      <div class="filters">
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"}>הכל</sw-chip>
        <sw-chip dot="#ef4444" ?selected=${this.filter==="motion"} @click=${()=>this.filter="motion"}>תנועה</sw-chip>
        <sw-chip dot="#2f6bff" ?selected=${this.filter==="person"} @click=${()=>this.filter="person"}>אדם</sw-chip>
        <sw-chip dot="#22c55e" ?selected=${this.filter==="vehicle"} @click=${()=>this.filter="vehicle"}>רכב</sw-chip>
        <sw-chip dot="#8b5cf6" ?selected=${this.filter==="door"} @click=${()=>this.filter="door"}>דלת</sw-chip>
        <span class="grow"></span>
        <sw-button size="sm" icon="case">הוסף לתיק</sw-button>
        <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה בזמן הזה</sw-button></a>
      </div>
      <div class="session">
        <span>Session: ${this.playing?"playing":"paused"} · ${this.speed}×</span>
        <span>דור ${this.generation}</span>
        <span>דיוק זמן: משוער</span>
        <span>כיסוי: ${t?"פער":"מלא"} · 6 מקטעים ביום</span>
        <span>WebRTC → MSE</span>
        ${t?c:r`<span>מצלמה: ${e.name}</span>`}
      </div>
    `}render(){const e=g(),t=e?this.cams?.find(o=>o.id===this.cameraId):G.find(o=>o.id===this.demoCamera)??G[0],s=t?.name??"הקלטות",i=e?`${this.date} ${os(this.cursor)} · אזור זמן ${this.tz}`:`14.09.2026 ${Ee(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה`,a=e?"הקלטות":`הקלטות | ${t?.floor??""}`,n=e?Ze(new Date,this.tz):"2026-09-14";return r`
      <sw-page heading=${s} subheading=${i} crumbs=${a} wide>
        <div slot="actions" class="pick">
          ${e?r`<sw-field><select aria-label="מצלמה" @change=${o=>this.selectCamera(o.target.value)}>${(this.cams??[]).map(o=>r`<option value=${o.id} ?selected=${o.id===this.cameraId}>${o.name}</option>`)}</select></sw-field>`:r`<sw-field><select aria-label="מצלמה" @change=${o=>this.demoCamera=o.target.value}>${G.map(o=>r`<option value=${o.id} ?selected=${o.id===this.demoCamera}>${o.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" .value=${e?this.date:"2026-09-14"} max=${n} data-ltr aria-label="תאריך" @change=${o=>e&&this.setDate(o.target.value)} /></sw-field>
          <sw-field style="inline-size:132px"><input type="time" step="1" .value=${e?os(this.cursor):Ee(this.cursor)} data-ltr aria-label="שעה" @change=${o=>{const l=o.target.value;if(e)this.onSeek(new CustomEvent("seek",{detail:{minute:xi(l)}}));else{const[p,f]=l.split(":").map(Number);this.cursor=p*60+f,this.generation+=1}}} /></sw-field>
        </div>
        ${e?c:r`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};I.styles=z`
    .pick {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pick sw-field {
      inline-size: 150px;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      color: #fff;
      background: #0f1729;
      box-shadow: var(--sw-shadow-2);
      /* 0.1.68: the whole page (controls + timeline) fits the window - no scrolling to reach the timeline (owner 3.5) */
      max-block-size: max(200px, calc(100dvh - 560px));
      margin-inline: auto;
      inline-size: 100%;
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.gap {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .grid {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      background: #0f1729;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-2);
      padding: 6px;
    }
    .grid.one {
      grid-template-columns: 1fr;
    }
    .tile {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #111a2e;
      border-radius: 6px;
      overflow: hidden;
      color: #fff;
    }
    .tile sw-live-player {
      position: absolute;
      inset: 0;
    }
    .tile.master {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .tile .name {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      z-index: 2;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .tile .drift {
      font-family: var(--sw-font-mono);
      font-weight: 400;
      direction: ltr;
      background: rgba(17, 24, 39, 0.55);
      border-radius: 4px;
      padding: 0 5px;
    }
    .tile .drift.bad {
      background: rgba(239, 68, 68, 0.7);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.5) 100%);
      pointer-events: none;
    }
    .tag {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
      z-index: 2;
    }
    .tag .nm {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    .video.gap .tag .nm {
      text-shadow: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 58px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      z-index: 2;
    }
    .video.gap .stamp {
      text-shadow: none;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
      z-index: 1;
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
      max-inline-size: 420px;
    }
    .tile .center {
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.75);
    }
    .bar {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 10px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: 3;
    }
    .bar .inner {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      border-radius: var(--sw-r-pill);
      background: rgba(17, 24, 39, 0.72);
      backdrop-filter: blur(8px);
      color: #fff;
      box-shadow: var(--sw-shadow-2);
    }
    .bar sw-button {
      --sw-text-2: #fff;
      --sw-text: #fff;
      --sw-surface-3: rgba(255, 255, 255, 0.14);
    }
    .bar .q {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: var(--sw-r-pill);
      padding: 3px 9px;
      margin-inline: 2px;
      background: transparent;
      color: #fff;
      font-family: inherit;
      cursor: pointer;
    }
    .bar .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .bar .sep {
      inline-size: 1px;
      block-size: 18px;
      background: rgba(255, 255, 255, 0.25);
      margin-inline: 4px;
    }
    .stage {
      position: relative;
    }
    .stage .bar {
      inset-block-end: 12px;
    }
    .stage .stamp {
      inset-block-end: 60px;
      inset-inline-start: 14px;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .session {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .warn {
      font-size: var(--sw-fs-xs);
      color: #b45309;
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .tlwrap {
      position: relative;
    }
    .tlpreview {
      position: absolute;
      inset-block-end: calc(100% + 6px);
      transform: translateX(-50%);
      inline-size: 200px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 4px;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-align: center;
      direction: ltr;
    }
    .tlpreview img {
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
    }
    .tlpreview .none {
      display: grid;
      place-items: center;
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      direction: rtl;
    }
    .compare {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dlg {
      display: grid;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      min-inline-size: min(420px, 80vw);
    }
    .dlg .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .est {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      font-size: var(--sw-fs-xs);
      display: grid;
      gap: 4px;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    /* full-system sweep: on a phone the floating control pill (frame step, speeds, skip) was wider than the
       screen and its end buttons were clipped; it wraps now, and speeds the relay refuses anyway (2×/4×) are
       dropped there instead of taking room as disabled buttons. */
    @media (max-width: 767px) {
      .bar .inner {
        flex-wrap: wrap;
        justify-content: center;
        row-gap: 4px;
        max-inline-size: calc(100% - 16px);
      }
      .bar .q[disabled] {
        display: none;
      }
    }
  `;C([m()],I.prototype,"cameraId",2);C([m()],I.prototype,"at",2);C([m()],I.prototype,"extraParam",2);C([d()],I.prototype,"demoCamera",2);C([d()],I.prototype,"cursor",2);C([d()],I.prototype,"generation",2);C([d()],I.prototype,"playing",2);C([d()],I.prototype,"speed",2);C([d()],I.prototype,"filter",2);C([d()],I.prototype,"cams",2);C([d()],I.prototype,"tz",2);C([d()],I.prototype,"date",2);C([d()],I.prototype,"rec",2);C([d()],I.prototype,"dayEvents",2);C([d()],I.prototype,"bookmarks",2);C([d()],I.prototype,"activeBookmark",2);C([d()],I.prototype,"loadingRec",2);C([d()],I.prototype,"session",2);C([d()],I.prototype,"group",2);C([d()],I.prototype,"extra",2);C([d()],I.prototype,"casePick",2);C([d()],I.prototype,"preview",2);C([d()],I.prototype,"busy",2);C([d()],I.prototype,"error",2);C([d()],I.prototype,"notice",2);C([d()],I.prototype,"tileStatus",2);C([d()],I.prototype,"drifts",2);C([d()],I.prototype,"clock",2);C([d()],I.prototype,"barrier",2);C([d()],I.prototype,"syncStats",2);C([d()],I.prototype,"paused",2);C([d()],I.prototype,"scrubbing",2);C([d()],I.prototype,"position",2);C([d()],I.prototype,"exportOpen",2);C([d()],I.prototype,"exportFrom",2);C([d()],I.prototype,"exportTo",2);C([d()],I.prototype,"estimate",2);C([d()],I.prototype,"exportJob",2);C([d()],I.prototype,"exportBusy",2);C([d()],I.prototype,"exportError",2);I=C([S("investigate-playback")],I);var Rc=Object.defineProperty,Nc=Object.getOwnPropertyDescriptor,$t=(e,t,s,i)=>{for(var a=i>1?void 0:i?Nc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Rc(t,s,a),a};const Fa="sw.sync.recent";function ki(e){const t=s=>String(s).padStart(2,"0");return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}T${t(e.getHours())}:${t(e.getMinutes())}:${t(e.getSeconds())}`}let Ge=class extends x{constructor(){super(...arguments),this.cursor=615,this.playing=!1,this.cams=null,this.picked=[],this.when=ki(new Date(Date.now()-10*6e4)),this.recent=[],this.error=""}connectedCallback(){if(super.connectedCallback(),!!g()){try{this.recent=JSON.parse(localStorage.getItem(Fa)??"[]")}catch{this.recent=[]}this.load()}}async load(){try{const e=await Te();this.cams=e.cameras.filter(t=>t.enabled&&t.can_view_live!==!1),this.error=""}catch(e){this.error=w(e),this.cams=[]}}toggle(e){this.picked=this.picked.includes(e)?this.picked.filter(t=>t!==e):this.picked.length>=4?this.picked:[...this.picked,e]}launch(e=this.picked,t){if(e.length<2)return;const s=t??new Date(this.when).toISOString(),i={cameras:e,at:s,opened:new Date().toISOString()},a=this.recent.filter(n=>n.cameras.join(",")!==e.join(","));this.recent=[i,...a].slice(0,6);try{localStorage.setItem(Fa,JSON.stringify(this.recent))}catch{}b("/investigate/playback",{camera:e[0],extra:e.slice(1).join(","),t:s})}name(e){return this.cams?.find(t=>t.id===e)?.name??e}renderApi(){const e=this.cams;return r`
      <sw-page heading="ניגון מסונכרן" subheading="בחר 2–4 מצלמות וזמן — ההשוואה נפתחת במסך ההקלטות עם שעון ייחוס אחד ומדידת סטייה בין המקורות" wide>
        ${this.error?r`<sw-state-panel state="error" heading="המצלמות לא נטענו" hint=${this.error}></sw-state-panel>`:c}
        ${e===null?r`<sw-state-panel state="loading" heading="טוען מצלמות…"></sw-state-panel>`:r`
            <sw-card heading="מצלמות להשוואה" subheading=${`${this.picked.length} מתוך 4 · הראשונה שנבחרת היא המובילה (שעון הייחוס)`}>
              <div class="filters" data-sync-cameras>
                ${e.map(t=>r`<sw-chip ?selected=${this.picked.includes(t.id)} ?disabled=${!this.picked.includes(t.id)&&this.picked.length>=4} data-sync-camera=${t.id} dot=${t.status==="online"?"#22c55e":"#ef4444"} @click=${()=>this.toggle(t.id)}>${t.name}</sw-chip>`)}
              </div>
              ${this.picked.length?r`<div class="picks">${this.picked.map((t,s)=>r`<div class="pick" data-sync-pick=${t}>
                    <img src=${qe(t)} alt="" loading="lazy" @error=${i=>i.target.style.visibility="hidden"} />
                    <div class="cap"><span>${this.name(t)}</span>${s===0?r`<sw-badge kind="live" label="מובילה"></sw-badge>`:c}</div>
                  </div>`)}</div>`:r`<div class="note">עדיין לא נבחרו מצלמות. אפשר גם להתחיל מהמפה: בחירה מרובה › "ניגון מסונכרן".</div>`}
            </sw-card>
            <sw-card heading="זמן התחלה" subheading="זמן מקומי של הדפדפן; ההקלטה נפתחת מהפריים הקרוב ביותר">
              <div class="transport">
                <sw-field><input type="datetime-local" step="1" data-ltr data-sync-when .value=${this.when} aria-label="זמן" @change=${t=>this.when=t.target.value} /></sw-field>
                <sw-button size="sm" @click=${()=>this.when=ki(new Date(Date.now()-10*6e4))}>לפני 10 דק׳</sw-button>
                <sw-button size="sm" @click=${()=>this.when=ki(new Date(Date.now()-60*6e4))}>לפני שעה</sw-button>
                <span class="grow"></span>
                <sw-button variant="primary" icon="play" data-sync-launch ?disabled=${this.picked.length<2} @click=${()=>this.launch()}>פתח השוואה (${this.picked.length})</sw-button>
              </div>
              <div class="note">בהשוואה מהירויות שונות מ־1× כבויות; אריח מאחר מסונכרן מחדש לבד וסטיית ה־p95 מוצגת בחותמת. מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה", לא כמסונכרן.</div>
            </sw-card>
            ${this.recent.length?r`<sw-card heading="השוואות אחרונות" subheading="נשמר בדפדפן הזה בלבד">
                  ${this.recent.map(t=>r`<div class="recent" data-sync-recent>
                    <span>${t.cameras.map(s=>this.name(s)).join(" · ")}</span>
                    <span class="ltr note">${new Date(t.at).toLocaleString("he-IL")}</span>
                    <sw-button size="sm" icon="play" @click=${()=>this.launch(t.cameras,t.at)}>פתח</sw-button>
                  </div>`)}
                </sw-card>`:c}
          `}
      </sw-page>
    `}render(){if(g())return this.renderApi();const e=[{cam:G[0],drift:"+0.2s",state:"recorded"},{cam:G[9],drift:"-0.4s",state:"recorded"},{cam:G[3],drift:"gap",state:"unknown"},{cam:G[1],drift:"buffering",state:"stale"}];return r`
      <sw-page heading="מרכז שליטה" subheading="ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה"><option>כל המסכים</option><option>כניסה + חצר</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${e.map(t=>r`<div class="tile">
              <span class="drift">${t.drift}</span>
              <sw-camera-tile name=${t.cam.name} state=${t.state} scene=${Ke[t.cam.id]??"lobby"}></sw-camera-tile>
            </div>`)}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" value=${`2026-09-14T${Ee(this.cursor)}`} data-ltr aria-label="זמן" @change=${t=>{const s=t.target.value.split("T")[1]??"10:15",[i,a]=s.split(":").map(Number);this.cursor=i*60+a}} /></sw-field>
          <sw-button iconOnly icon="mic" label="דיבור"></sw-button>
          <sw-button iconOnly icon="back10" label="אחורה"></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה הכל":"נגן הכל"} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button iconOnly icon="forward10" label="קדימה"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${qs} .events=${et.slice(0,4).map(t=>({minute:t.minuteOfDay,kind:t.type,label:t.title}))} .cursor=${this.cursor} precision="estimated" @seek=${t=>this.cursor=t.detail.minute}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">כל המצלמות</sw-chip>
          <sw-chip dot="#ef4444">תנועה</sw-chip><sw-chip dot="#2f6bff">אדם</sw-chip><sw-chip dot="#22c55e">רכב</sw-chip><sw-chip dot="#8b5cf6">אחר</sw-chip>
        </div>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `}};Ge.styles=z`
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .tile {
      position: relative;
    }
    .drift {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 8px;
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: 10px;
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
      direction: ltr;
    }
    .transport {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .transport .grow {
      flex: 1;
    }
    .transport sw-field {
      inline-size: 170px;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .picks {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px;
      margin-block-start: 10px;
    }
    .pick img {
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 8px;
      background: var(--sw-surface-3);
      display: block;
    }
    .pick .cap {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      margin-block-start: 4px;
    }
    .recent {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .recent:last-child {
      border-block-end: 0;
    }
    .recent > span:first-child {
      flex: 1;
      min-inline-size: 0;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;$t([d()],Ge.prototype,"cursor",2);$t([d()],Ge.prototype,"playing",2);$t([d()],Ge.prototype,"cams",2);$t([d()],Ge.prototype,"picked",2);$t([d()],Ge.prototype,"when",2);$t([d()],Ge.prototype,"recent",2);$t([d()],Ge.prototype,"error",2);Ge=$t([S("investigate-sync")],Ge);var Bc=Object.defineProperty,Lc=Object.getOwnPropertyDescriptor,pe=(e,t,s,i)=>{for(var a=i>1?void 0:i?Lc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Bc(t,s,a),a};const _i=10;function Hc(e){return e==="person"||e==="vehicle"||e==="motion"||e==="line"||e==="offline"||e==="door"?e:"motion"}let se=class extends x{constructor(){super(...arguments),this.floorId="f0",this.at="",this.camera="",this.minute=615,this.tz="Asia/Jerusalem",this.date="",this.tree=null,this.bundle=null,this.events=[],this.recordings=new Map,this.selectedId=null,this.loading=!1,this.error="",this.frameAt="",this.frameFailed=!1,this.casePick=null,this.frameTimer=0}connectedCallback(){super.connectedCallback(),g()&&this.init()}updated(e){g()&&(e.has("floorId")&&e.get("floorId")!==void 0||e.has("at")&&e.get("at")!==void 0)&&this.init()}async init(){this.loading=!0,this.error="";try{const[e,t]=await Promise.all([je(),this.tree?Promise.resolve(this.tree):yt()]);if(this.tz=e["time.zone"]??this.tz,this.tree=t,g()&&this.floors.length&&!this.floors.some(i=>i.id===this.floorId)){const i=new URLSearchParams(window.location.hash.split("?")[1]??"").toString();window.location.replace(`#/investigate/floors/${this.floors[0].id}/history${i?`?${i}`:""}`);return}const s=this.at?new Date(this.at):new Date;if(this.date=Ze(s,this.tz),this.minute=te(s,this.tz),this.bundle=await ks(this.floorId,!1,this.instant.toISOString().replace(/\.\d{3}Z$/,"Z")),this.scheduleFrame(),this.camera){const i=this.bundle.anchors.find(a=>a.resource_type==="camera"&&a.resource_id===this.camera);this.selectedId=i?.id??null}await this.loadDay()}catch(e){this.error=w(e)}finally{this.loading=!1}}async loadDay(){const e=this.bundle;if(!e)return;const t=e.anchors.filter(n=>n.resource_type==="camera").map(n=>n.resource_id),[s,i]=await Promise.all([li({date:this.date,limit:1e3}).then(n=>n.events.filter(o=>o.camera_id&&t.includes(o.camera_id))).catch(()=>[]),Promise.allSettled(t.map(n=>jr(n,this.date)))]);this.events=s;const a=new Map;t.forEach((n,o)=>{const l=i[o];a.set(n,l.status==="fulfilled"?l.value:null)}),this.recordings=a}get instant(){return Ue(this.date,this.minute,this.tz)}segmentsFor(e){const t=this.recordings.get(e);return t?t.segments.map(s=>{const i=te(new Date(s.start_at),this.tz);let a=te(new Date(s.end_at),this.tz);return a<i&&(a=1440),{startMin:i,endMin:a,kind:s.kind==="continuous"?"continuous":"motion"}}):null}coverageAt(e){const t=this.segmentsFor(e);if(!t)return{state:"unknown"};const s=t.find(i=>this.minute>=i.startMin&&this.minute<=i.endMin);return s?{state:"historic",segment:s}:{state:"unknown"}}eventsNear(e,t=_i){const s=this.instant.getTime();return this.events.filter(i=>(!e||i.camera_id===e)&&Math.abs(new Date(i.occurred_at).getTime()-s)<=t*60*1e3).sort((i,a)=>Math.abs(new Date(i.occurred_at).getTime()-s)-Math.abs(new Date(a.occurred_at).getTime()-s))}get apiMarkers(){const e=this.bundle;return e?e.anchors.map(t=>{if(t.resource_type==="camera"){const a=this.coverageAt(t.resource_id),n=this.eventsNear(t.resource_id,5).length,o=t.camera?.name??t.label??t.resource_id;return{id:t.id,kind:"camera",label:n?`${o} · ${n} אירועים`:o,x:t.position.x,y:t.position.y,rotation:t.rotation_degrees,fov:t.field_of_view_degrees??void 0,radius:t.coverage_radius??void 0,polygon:t.coverage_polygon?t.coverage_polygon.map(([l,p])=>({x:l,y:p})):void 0,labelPos:t.label_pos??void 0,state:a.state}}const s=t.entity?.state_at,i=hs(t);return{id:t.id,kind:oi(t.layer_id,t.entity?.domain),label:s?.known&&s.state?`${i} · ${vt({...t.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:s.state})}`:i,x:t.position.x,y:t.position.y,state:s?.known?"historic":"unknown"}}):[]}get selectedAnchor(){return this.bundle?.anchors.find(e=>e.id===this.selectedId)??null}get limitMinute(){return this.date===Ze(new Date,this.tz)?te(new Date,this.tz):1440}setMinute(e){this.minute=Math.max(0,Math.min(this.limitMinute,e)),this.scheduleFrame()}scheduleFrame(){window.clearTimeout(this.frameTimer),this.frameTimer=window.setTimeout(()=>{this.frameAt=this.instant.toISOString().replace(/\.\d{3}Z$/,"Z"),this.frameFailed=!1,this.ensureVersion()},600)}async ensureVersion(){const e=this.bundle;if(!e||e.source!=="api"||!e.at)return;const t=this.instant.toISOString().replace(/\.\d{3}Z$/,"Z");if(!(e.history==="current"?!e.historyFrom||t<e.historyFrom:(!e.planPublishedAt||e.planPublishedAt<=t)&&(!e.planArchivedAt||t<e.planArchivedAt)))try{const i=await ks(this.floorId,!1,t),a=e.anchors.map(n=>n.resource_id).sort().join(",");this.bundle=i,this.selectedId&&!i.anchors.some(n=>n.id===this.selectedId)&&(this.selectedId=null),i.anchors.map(n=>n.resource_id).sort().join(",")!==a&&await this.loadDay()}catch{}}renderEntityStates(e){const t=e.anchors.filter(a=>a.resource_type==="ha_entity");if(!t.length)return r`אין ישויות מוצבות בקומה`;const s=t.filter(a=>a.entity?.state_at?.known),i=e.haHistory;return r`${s.length} מתוך ${t.length} ידועות בזמן זה${i?.from?r` <span class="note">(היסטוריה מקומית מ־<span class="ltr">${this.fmtWhen(i.from)}</span>, ${i.retention_days} ימים)</span>`:r` <span class="note">(אין עדיין היסטוריה מקומית)</span>`}
      <div class="evl" style="margin-block-start:4px">${t.slice(0,8).map(a=>{const n=a.entity?.state_at,o=hs(a);return r`<div data-history-entity data-known=${n?.known?"true":"false"} data-source=${n?.source??"vms"}><span>${o}${n?.source==="ha_recorder"?r` <span class="note" title="המצב מגיע מה־recorder של Home Assistant (מקור משני)">· HA recorder</span>`:c}</span><span class="note">${n?.known&&n.state?r`${vt({...a.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:n.state})} · מ־<span class="ltr">${n.changed_at?this.fmt(n.changed_at):""}</span>`:r`לא ידוע${n?.reason?` · ${n.reason}`:""}${n?.state?r` <span class="ltr">(אחרון: ${n.state})</span>`:""}`}</span></div>`})}</div>`}fmtWhen(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,dateStyle:"short",timeStyle:"short"}).format(new Date(e))}setDate(e){this.date=e,this.minute=Math.min(this.minute,this.limitMinute),this.loadDay()}fmt(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date(e))}get floors(){return this.tree?.source!=="api"?[]:this.tree.sites.flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(s=>({id:s.id,name:`${t.name} · ${s.name}`}))))}renderPanel(e){const t=this.selectedAnchor,s=t?.resource_type==="camera"?t:null,i=s?this.coverageAt(s.resource_id):null,a=s?this.recordings.get(s.resource_id):void 0,n=this.eventsNear(void 0,_i),o=this.instant.toISOString().replace(/\.\d{3}Z$/,"Z");return r`<div class="panel">
      <sw-card heading="בנקודת הזמן שנבחרה" subheading="זמן ונתונים מאותו רגע" data-history-panel>
        <dl>
          <dt>זמן</dt><dd><span class="ltr" data-history-time>${this.date} ${Qe(this.minute)}</span> <span class="note">${this.tz}</span></dd>
          <dt>מצלמה נבחרת</dt><dd data-history-camera>${s?s.camera?.name??s.resource_id:"לחץ על מצלמה במפה"}</dd>
          ${s?r`<dt>הקלטה</dt><dd>${a===void 0?"טוען…":a===null?"לא ניתן לבדוק מול ה־NVR":i?.segment?r`יש הקלטה · ${Ee(i.segment.startMin)}–${Ee(i.segment.endMin)} · ${i.segment.kind==="continuous"?"רציף":"תנועה"}`:"אין הקלטה בזמן זה (פער)"}</dd>
                <dt>אירועים ±5 דק׳</dt><dd>${this.eventsNear(s.resource_id,5).length}</dd>`:c}
          <dt>ישויות HA</dt><dd data-history-entities>${this.renderEntityStates(e)}</dd>
          ${s&&this.frameAt?r`<dt>פריים</dt><dd><div class="frame" data-history-frame>${this.frameFailed?r`<span>אין פריים בהקלטה בזמן זה</span>`:r`<img src=${di(s.resource_id,this.frameAt)} alt="פריים מההקלטה בזמן שנבחר" @error=${()=>this.frameFailed=!0} />`}</div></dd>`:c}
          <dt>גרסת תוכנית</dt><dd data-history-plan-version data-history-mode=${e.history??"live"}>${e.history==="exact"&&e.planPublishedAt?r`בתוקף באותו זמן · פורסמה <span class="ltr">${this.fmtWhen(e.planPublishedAt)}</span>${e.planArchivedAt?r` · הוחלפה <span class="ltr">${this.fmtWhen(e.planArchivedAt)}</span>`:""}`:e.historyFrom?r`המפה הנוכחית · היסטוריית המפה מתחילה <span class="ltr">${this.fmtWhen(e.historyFrom)}</span>`:"המפה הנוכחית"}</dd>
        </dl>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-start:10px">
          ${s?r`<sw-button variant="primary" size="sm" icon="history" @click=${()=>b("/investigate/playback",{camera:s.resource_id,t:o})}>נגן מכאן</sw-button>`:c}
          <sw-button size="sm" icon="case" data-add-to-case ?disabled=${!s} title=${s?"קטע של המצלמה הנבחרת סביב הזמן שנבחר (15 שניות לפני, 45 אחרי)":"בחר מצלמה במפה"} @click=${()=>{s&&(this.casePick={kind:"clip",camera_id:s.resource_id,...Vi(this.instant)})}}>הוסף לתיק</sw-button>
        </div>
      </sw-card>
      <sw-case-picker .item=${this.casePick} subheading=${s?`${s.camera?.name??s.resource_id} · ${this.date} ${Qe(this.minute)}`:""} @close=${()=>this.casePick=null}></sw-case-picker>
      <sw-card heading="אירועים סביב הזמן" subheading=${`±${_i} דקות · מצלמות הקומה`}>
        ${n.length?r`<div class="evl" data-history-events>${n.slice(0,8).map(l=>r`<a class=${s&&l.camera_id===s.resource_id?"hit":""} href=${`#/investigate/events/${l.id}`}><span>${Y[l.type]??l.type} · ${l.camera_name??l.channel??""}<div class="s">${l.confidence==="inferred"?"נגזר מהקלטה":"התראה מה־NVR"}${l.acked_at?" · טופל":""}</div></span><span class="ltr">${this.fmt(l.occurred_at)}</span></a>`)}</div>`:r`<div class="note">אין אירועים בחלון הזה.</div>`}
      </sw-card>
    </div>`}renderApi(){const e=this.bundle;if(this.error&&!e)return r`<div class="head"><h1>מפה היסטורית</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;if(!e)return r`<div class="head"><h1>מפה היסטורית</h1></div><sw-state-panel state="loading"></sw-state-panel>`;const t=this.selectedAnchor,s=t?.resource_type==="camera"?this.segmentsFor(t.resource_id)??[]:Array.from(this.recordings.keys()).flatMap(a=>this.segmentsFor(a)??[]),i=(t?.resource_type==="camera"?this.events.filter(a=>a.camera_id===t.resource_id):this.events).map(a=>({minute:te(new Date(a.occurred_at),this.tz),kind:Hc(a.type),label:`${Y[a.type]??a.type}${a.count>1?` ×${a.count}`:""}`}));return r`
      <div class="head">
        <div><h1>המפה בזמן שנבחר · ${e.floorName}</h1><div class="sub">${e.buildingName} · <span class="ltr">${this.date} ${Qe(this.minute)}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        ${this.floors.length>1?r`<sw-field><select aria-label="קומה" @change=${a=>b(`/investigate/floors/${a.target.value}`,{t:this.instant.toISOString()})}>${this.floors.map(a=>r`<option value=${a.id} ?selected=${a.id===this.floorId}>${Ct(a.name)}</option>`)}</select></sw-field>`:c}
        <sw-button icon="live" data-back-live @click=${()=>b(`/explore/floors/${e.floorId}`)}>חזרה למצב חי</sw-button>
      </div>
      <div class="bar"><sw-icon name="clock" size=${14}></sw-icon><span>מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.</span>${this.loading?r`<span class="note">טוען הקלטות ואירועים…</span>`:c}</div>
      <div class="layout">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${e.floorName}</div>
          <div class="hist">מצב היסטורי · <span class="ltr">${Qe(this.minute)}</span></div>
          <sw-plan-canvas alwaysLabel .planWidth=${e.width} .planHeight=${e.height} .plan=${e.planSvg} .imageUrl=${e.imageUrl} .markers=${this.apiMarkers} .selectedId=${this.selectedId} .zones=${e.zones} dimEntities
            @marker-select=${a=>{this.selectedId=a.detail.id,this.frameFailed=!1}}></sw-plan-canvas>
          <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = אין הקלטה / לא ידוע</span><span>ישויות HA = מצב מההיסטוריה המקומית או לא ידוע</span></div>
        </div>
        ${this.renderPanel(e)}
      </div>
      <div class="tl">
        <div class="tlbar">
          <sw-badge kind="historic"></sw-badge>
          <span class="time">${this.date} ${Qe(this.minute)}</span>
          <sw-chip @click=${()=>this.setMinute(this.minute-60)}>-1 שעה</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute-5)}>-5 דק׳</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute+5)}>+5 דק׳</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute+60)}>+1 שעה</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="date" .value=${this.date} max=${Ze(new Date,this.tz)} data-ltr aria-label="תאריך" @change=${a=>this.setDate(a.target.value)} /></sw-field>
          <span class="note">${t?.resource_type==="camera"?`ציר הזמן: ${t.camera?.name??""}`:"ציר הזמן: כל מצלמות הקומה"}</span>
        </div>
        <sw-timeline .segments=${s} .events=${i} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${!1} precision="estimated" @seek=${a=>this.setMinute(a.detail.minute)} @scrub=${a=>this.setMinute(a.detail.minute)}></sw-timeline>
      </div>
    `}get demoMarkers(){const e=i=>i==="cam-3"||this.minute>=190&&this.minute<=205?"unknown":"historic",t=cs.filter(i=>i.floorId===this.floorId).map(i=>({id:i.id,kind:"camera",label:i.name,x:i.x,y:i.y,rotation:i.rotation,fov:i.fov,state:i.state==="forbidden"?"forbidden":e(i.id)})),s=Vs.filter(i=>i.floorId===this.floorId).map((i,a)=>({id:i.id,kind:i.domain,label:i.name,x:i.x,y:i.y,state:a%2?"unknown":"historic"}));return[...t,...s]}renderDemo(){const e=wt.find(t=>t.id===this.floorId)??wt[0];return r`
      <div class="head">
        <div><h1>מפה היסטורית · ${Ct(e.name)}</h1><div class="sub">מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${e.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${Ee(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${t=>this.minute=Number(t.target.value)} aria-label="זמן" />
        <sw-chip @click=${()=>this.minute=Math.max(0,this.minute-60)}>-1 שעה</sw-chip><sw-chip @click=${()=>this.minute=Math.min(1439,this.minute+60)}>+1 שעה</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">גרסת מפה 3 (תקפה מ־01.09)</span>
      </div>
      <div class="stage alone">
        <sw-plan-canvas .planWidth=${e.planWidth} .planHeight=${e.planHeight} .plan=${wr(e.id)} .markers=${this.demoMarkers}></sw-plan-canvas>
        <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = לא ידוע / פער</span><span>ישות: מצב ידוע אחרון</span></div>
      </div>
    `}render(){return g()?this.renderApi():this.renderDemo()}};se.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 14px 24px 12px;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .grow {
      flex: 1;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 24px 10px;
      padding: 8px 12px;
      background: var(--sw-recorded-soft);
      border: 1px solid #cddcff;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .time {
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-accent-text);
    }
    input[type='range'] {
      inline-size: 260px;
      direction: ltr;
      accent-color: var(--sw-accent);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      margin: 0 24px 12px;
      align-items: start;
    }
    .stage {
      position: relative;
      block-size: 540px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .stage.alone {
      block-size: auto;
      min-block-size: 480px;
      flex: 1;
      margin: 0 24px 24px;
    }
    .stage sw-plan-canvas {
      block-size: 100%;
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 12px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      padding: 5px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .hist {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: #f3e8ff;
      color: #6d28d9;
      border-radius: 10px;
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .evl {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .evl a {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .evl a.hit {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .evl .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame {
      margin-block-start: 8px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface-3);
      aspect-ratio: 16 / 9;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .tl {
      margin: 0 24px 24px;
    }
    .tl sw-field {
      inline-size: 160px;
    }
    .tlbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .head,
      .bar,
      .tl {
        margin-inline: 12px;
        padding-inline: 12px;
      }
      .head {
        padding-inline: 0;
      }
      .layout {
        margin-inline: 0;
      }
      .stage {
        border-radius: 0;
      }
      .legend {
        display: none;
      }
    }
  `;pe([m()],se.prototype,"floorId",2);pe([m()],se.prototype,"at",2);pe([m()],se.prototype,"camera",2);pe([d()],se.prototype,"minute",2);pe([d()],se.prototype,"tz",2);pe([d()],se.prototype,"date",2);pe([d()],se.prototype,"tree",2);pe([d()],se.prototype,"bundle",2);pe([d()],se.prototype,"events",2);pe([d()],se.prototype,"recordings",2);pe([d()],se.prototype,"selectedId",2);pe([d()],se.prototype,"loading",2);pe([d()],se.prototype,"error",2);pe([d()],se.prototype,"frameAt",2);pe([d()],se.prototype,"frameFailed",2);pe([d()],se.prototype,"casePick",2);se=pe([S("investigate-history-map")],se);var Vc=Object.defineProperty,jc=Object.getOwnPropertyDescriptor,V=(e,t,s,i)=>{for(var a=i>1?void 0:i?jc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Vc(t,s,a),a};const Fc={person:"#2f6bff",vehicle:"#22c55e",motion:"#ef4444",line:"#f59e0b",offline:"#6b7280",door:"#8b5cf6"},Wa={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking","מסדרון מזרחי":"corridor"},Wc={info:"מידע",alert:"התראה",critical:"קריטי"};let B=class extends x{constructor(){super(...arguments),this.cameraId="",this.date="",this.initialMode="",this.selected=null,this.filter="all",this.cams=null,this.tz="Asia/Jerusalem",this.type="",this.events=null,this.ingest=null,this.live=!1,this.error="",this.busy=!1,this.thumbVersion=new Map,this.player=null,this.mode="raw",this.windows=null,this.windowGap=180,this.windowBy="camera",this.selectedWindow=null,this.windowsBusy=!1,this.facets=null,this.placeFloor="",this.placeZone="",this.source="",this.unsupported=[],this.q="",this.rangeDays=1,this.qTimer=0,this.thumbTimers=new Map,this.thumbInFlight=0,this.rowPreview=null,this.rowPreviewTimer=0,this.windowColumns=[{key:"thumb",label:"",width:"72px",render:e=>this.renderWindowThumb(e)},{key:"title",label:"חלון אירוע",render:e=>{const t=e;return r`<span class="ty" style="--tone:${js[t.dominant_type]??"#6b7280"}"><i></i>${Y[t.dominant_type]??t.dominant_type}${t.count>1?r` <span class="sub">×${String(t.count)}</span>`:c}</span><div class="sub">${Object.entries(t.types).map(([s,i])=>`${Y[s]??s} ${i}`).join(" · ")} · ${t.confidence==="inferred"?"נגזר מהקלטה":"התראות מה־NVR"}</div>`}},{key:"camera_name",label:"מצלמה / קבוצה",render:e=>{const t=e;return r`${t.camera_name??(t.channel?`ערוץ ${t.channel}`:"מערכת")}${t.group&&t.group!=="camera"&&t.camera_names?.length?r`<div class="sub">${t.camera_names.join(" · ")}</div>`:c}`}},{key:"start",label:"זמן",render:e=>{const t=e;return r`${this.fmt(t.start)}${t.end!==t.start?r` – ${this.fmt(t.end)}`:c}<div class="sub">${this.fmtDate(t.start)}</div>`}},{key:"acked",label:"מצב",render:e=>{const t=e;return r`<sw-badge kind=${t.acked?"live":t.acked_count?"stale":"neutral"} label=${t.acked?"טופל":t.acked_count?`בטיפול ${t.acked_count}/${t.count}`:"חדש"}></sw-badge>`}}],this.apiColumns=[{key:"thumb",label:"",width:"72px",render:e=>this.renderThumb(e)},{key:"type",label:"אירוע",render:e=>r`<span class="ty" style="--tone:${js[e.type]??"#6b7280"}"><i></i>${Y[e.type]??String(e.type)}${Number(e.count)>1?r` <span class="sub">×${String(e.count)}</span>`:c}</span><div class="sub">${e.source==="ha"?"חיישן HA":e.source==="system"?"מערכת":e.confidence==="inferred"?"נגזר מהקלטה":"התראה מה־NVR"} · ${e.acked_at?`טופל · ${String(e.acked_by_username??"")}`:"ממתין לטיפול"}</div>`},{key:"camera_name",label:"מצלמה",render:e=>r`${String(e.camera_name??(e.channel?`ערוץ ${String(e.channel)}`:"מערכת"))}<div class="sub ltr">${String(e.raw_type)}</div>`},{key:"occurred_at",label:"זמן",render:e=>r`${this.fmt(String(e.occurred_at))}<div class="sub">${this.fmtDate(String(e.occurred_at))}${e.ended_at?` · עד ${this.fmt(String(e.ended_at))}`:""}</div>`},{key:"severity",label:"חומרה",render:e=>r`<sw-badge kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${Wc[e.severity]??String(e.severity)}></sw-badge>`}],this.columns=[{key:"thumb",label:"תמונה",width:"80px",render:e=>e.type==="offline"||e.type==="door"?r`<div class="thumb none"><sw-icon name=${e.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:r`<sw-scene class="thumb" kind=${Wa[String(e.camera)]??"lobby"}></sw-scene>`},{key:"title",label:"אירוע",render:e=>r`<span class="ty" style="--tone:${Fc[e.type]}"><i></i>${Ii[e.type]}</span><div class="sub">${String(e.title)} · ${e.acked?"טופל":"ממתין לטיפול"}</div>`},{key:"camera",label:"מצלמה",render:e=>r`${String(e.camera)}<div class="sub">${String(e.floor)}</div>`},{key:"time",label:"זמן",render:e=>r`${String(e.time)}<div class="sub ltr">${String(e.source)}</div>`},{key:"severity",label:"חומרה",render:e=>r`<sw-badge kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${{info:"מידע",alert:"התראה",critical:"קריטי"}[e.severity]}></sw-badge>`},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),g()&&(this.init(),this.unsubscribe=ld(e=>this.onPushed(e),(e,t)=>{this.live=t,e&&(this.ingest=e)}))}disconnectedCallback(){super.disconnectedCallback(),this.unsubscribe?.();for(const e of this.thumbTimers.values())window.clearTimeout(e);this.thumbTimers.clear(),this.stopPlayer()}hoverStart(e,t){if(!e.camera_id||t.pointerType==="touch")return;window.clearTimeout(this.rowPreviewTimer);const s=t.clientX,i=t.clientY;this.rowPreviewTimer=window.setTimeout(()=>{const a=new Date(e.occurred_at).getTime(),n=[-5,0,5].map(o=>{const l=new Date(a+o*1e3).toISOString().replace(/\.\d{3}Z$/,"Z");return{at:l,url:di(e.camera_id,l),label:o===0?this.fmt(e.occurred_at):`${o>0?"+":""}${o} ש׳`,failed:!1}});this.rowPreview={id:e.id,x:s,y:i,frames:n,camera:e.camera_name??""}},250)}hoverEnd(){window.clearTimeout(this.rowPreviewTimer),this.rowPreview=null}renderRowPreview(){const e=this.rowPreview;if(!e)return c;const t=Math.max(16,Math.min(window.innerWidth-388,e.x-186)),s=e.y+18+230>window.innerHeight?e.y-18-230:e.y+18;return r`<div class="rowpreview" data-row-preview style="left:${t}px;top:${s}px">
      <div class="strip">
        ${e.frames.map((i,a)=>r`<div class="cell ${a===1?"main":""}">
          ${i.failed?r`<span>אין פריים</span>`:r`<img src=${i.url} alt="" @error=${()=>{i.failed=!0,this.rowPreview={...e}}} />`}
          <span class="t">${i.label}</span>
        </div>`)}
      </div>
      <div class="cap"><span>${e.camera}</span><span>פריימים מההקלטה · 5 שניות לפני ואחרי</span></div>
    </div>`}renderThumb(e){const t="inline-size:64px;block-size:40px;border-radius:6px;overflow:hidden;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)";return e.thumbnail==="ready"?r`<img class="thumb" src=${Mt(e.id,this.thumbVersion.get(e.id)??0)} alt="" loading="lazy" data-thumb=${e.id} style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:6px;display:block;background:var(--sw-surface-3);cursor:zoom-in" />`:(e.thumbnail==="pending"||e.thumbnail==="none")&&e.camera_id?(this.schedulePoll(e.id,3e3,0),r`<div class="thumb pending" style=${t} title="מכין תמונה מההקלטה…"><sw-icon name="camera" size=${14} style="opacity:.45"></sw-icon></div>`):r`<div class="thumb none" style=${t}><sw-icon name=${e.type==="offline"||e.type==="coverage_gap"?"offline":e.type==="person"?"user":e.type==="vehicle"?"route":e.type==="door"||e.type==="io"?"door":"bell"} size=${14}></sw-icon></div>`}async ackAll(){const e=(this.events??[]).filter(t=>!t.acked_at).map(t=>t.id);if(!(!e.length||this.busy)){this.busy=!0;try{for(let t=0;t<e.length;t+=500)await Aa(e.slice(t,t+500));await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}}schedulePoll(e,t,s){this.thumbTimers.has(e)||this.thumbTimers.set(e,window.setTimeout(()=>void this.poll(e,s),t))}cancelPoll(e){const t=this.thumbTimers.get(e);t!==void 0&&window.clearTimeout(t),this.thumbTimers.delete(e)}async poll(e,t){if(this.thumbTimers.delete(e),!this.isConnected||!this.events?.some(i=>i.id===e))return;if(this.thumbInFlight>=2){this.schedulePoll(e,1500,t);return}this.thumbInFlight++;let s;try{s=await Dr(e)}finally{this.thumbInFlight--}if(s==="pending"){t<14&&this.schedulePoll(e,Math.min(15e3,3e3*1.35**t),t+1);return}this.setThumb(e,s)}setThumb(e,t){t==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e,Date.now())),this.events=(this.events??[]).map(s=>s.id===e?{...s,thumbnail:t}:s)}select(e){e!==this.player?.eventId&&this.stopPlayer(),this.selected=e}closeDrawer(){this.select(null)}async play(e){if(this.player?.eventId===e.id){await this.stopPlayer();return}if(await this.stopPlayer(),!!e.camera_id){this.player={eventId:e.id,session:null,error:""};try{const t=new Date(new Date(e.occurred_at).getTime()-2e3).toISOString().replace(/\.\d{3}Z$/,"Z"),s=await aa(e.camera_id,t);this.player?.eventId===e.id?this.player={eventId:e.id,session:s,error:""}:await Ss(s.id).catch(()=>{})}catch(t){this.player={eventId:e.id,session:null,error:w(t)}}}}async stopPlayer(){const e=this.player;this.player=null,e?.session&&await Ss(e.session.id).catch(()=>{})}async init(){try{try{localStorage.getItem("sw.events.mode")==="windows"&&(this.mode="windows")}catch{}(this.initialMode==="windows"||this.initialMode==="raw")&&(this.mode=this.initialMode);const[e,t]=await Promise.all([je(),Te()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras,this.loadFacets(),this.date||(this.date=Ze(new Date,this.tz)),await this.load()}catch(e){this.error=w(e)}}async loadFacets(){try{this.facets=await pd()}catch{this.facets=null}}get facetFloors(){const e=this.facets;return e?e.places.flatMap(t=>t.buildings.flatMap(s=>s.floors.map(i=>({...i,name:`${s.name} · ${i.name}`})))):[]}renderFacets(){const e=this.facets;if(!e)return c;const t=e.types.map(a=>`${Y[a.type]??a.type} (${a.count})`).join(" · "),s=e.sources.map(a=>`${Pa[a.source]??a.source} (${a.count})`).join(" · "),i=e.unavailable_types.filter(a=>["person","vehicle","line","field","door"].includes(a.type));return r`<div class="sub" data-facets style="margin:-4px 0 8px;line-height:1.6">
      <strong>שדות עם נתונים (${e.days} ימים):</strong> ${t||"אין אירועים"} · <strong>מקורות:</strong> ${s||"—"}
      ${i.length?r`<br /><strong>לא זמין:</strong> ${i.map(a=>r`<span title=${a.reason}>${Y[a.type]??a.type}</span>`).reduce((a,n,o)=>o?[...a," · ",n]:[n],[])} <span class="sub">(ריחוף מסביר למה)</span>`:c}
      ${e.notes.map(a=>r`<br />${a}`)}
    </div>`}searchWindow(){if(this.rangeDays<=1)return{date:this.date||void 0};const e=new Date(`${this.date||Ze(new Date,this.tz)}T23:59:59.999Z`),t=new Date(e.getTime()-(this.rangeDays-1)*864e5);return t.setUTCHours(0,0,0,0),{from:t.toISOString(),to:e.toISOString()}}async load(){try{const e=await li({...this.searchWindow(),cameraId:this.cameraId||void 0,type:this.type||void 0,unacked:this.filter==="unacked",acked:this.filter==="acked",limit:500,floorId:this.placeFloor||void 0,zoneId:this.placeZone||void 0,source:this.source||void 0,query:this.q.trim()||void 0});this.events=e.events,this.unsupported=e.filters?.unsupported??[],this.ingest=e.ingest,this.error="",this.mode==="windows"&&await this.loadWindows()}catch(e){this.error=w(e)}}onSearchInput(e){this.q=e,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),350)}setRange(e){this.rangeDays=e,this.load()}async loadWindows(){this.windowsBusy=!0;try{const e=await rd({date:this.date||void 0,cameraId:this.cameraId||void 0,gap:this.windowGap,by:this.windowBy,limit:300});this.windows=e.windows,this.selectedWindow&&!e.windows.some(t=>t.id===this.selectedWindow)&&(this.selectedWindow=null)}catch(e){this.error=w(e),this.windows=[]}finally{this.windowsBusy=!1}}setMode(e){this.mode=e,this.select(null),this.selectedWindow=null;try{localStorage.setItem("sw.events.mode",e)}catch{}e==="windows"&&this.windows===null&&this.loadWindows()}async ackWindow(e){this.busy=!0;try{const t=await Aa(e.event_ids),s=new Set(t.acked);this.events=(this.events??[]).map(i=>s.has(i.id)&&!i.acked_at?{...i,acked_at:new Date().toISOString(),acked_by_username:"אני"}:i),await this.loadWindows()}catch(t){this.error=w(t)}finally{this.busy=!1}}windowTitle(e){const t=e.camera_name??(e.channel?`ערוץ ${e.channel}`:"מערכת");return`${Y[e.dominant_type]??e.dominant_type} · ${t}`}renderWindowThumb(e){return e.thumbnail==="ready"?r`<img class="thumb" src=${Mt(e.thumbnail_event_id,this.thumbVersion.get(e.thumbnail_event_id)??0)} alt="" loading="lazy" style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:6px;display:block;background:var(--sw-surface-3)" />`:r`<div style="inline-size:64px;block-size:40px;border-radius:6px;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)"><sw-icon name=${e.camera_id?"image":"info"} size=${14}></sw-icon></div>`}renderWindowDrawer(e){const t=(this.events??[]).filter(s=>e.event_ids.includes(s.id));return r`<sw-drawer open heading=${this.windowTitle(e)} subheading=${`${this.fmtDate(e.start)} · ${this.fmt(e.start)} – ${this.fmt(e.end)} · ${e.count} אירועים`} @close=${()=>this.selectedWindow=null}>
      <div class="note" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3);margin-block-end:8px">מספר התראות סמוכות (עד ${Math.round(this.windowGap/60)} דק׳ ביניהן) הופכות לחלון אחד. האירועים המקוריים נשמרים ומוצגים כאן.</div>
      <div class="wlist" data-window-events>
        ${t.map(s=>r`<a class="wrow" href=${`#/investigate/events/${s.id}`}><span class="ty" style="--tone:${js[s.type]??"#6b7280"}"><i></i>${Y[s.type]??s.type}</span><span class="ltr">${this.fmt(s.occurred_at)}</span><span class="sub">${s.acked_at?"טופל":"ממתין"}</span></a>`)}
        ${t.length<e.count?r`<div class="sub">${e.count-t.length} אירועים נוספים אינם בסינון הנוכחי.</div>`:c}
      </div>
      <div slot="footer">
        <sw-button variant="primary" size="sm" icon="expand" data-review-window @click=${()=>b(`/investigate/events/${e.first_event_id}`)}>סקירה מלאה</sw-button>
        <sw-button size="sm" icon="check" ?disabled=${e.acked||this.busy} @click=${()=>this.ackWindow(e)}>${e.acked?"טופל":"סמן הכל כטופל"}</sw-button>
      </div>
    </sw-drawer>`}onPushed(e){if(!this.events)return;const t=Ze(new Date(e.occurred_at),this.tz);if(this.date&&t!==this.date||this.cameraId&&e.camera_id!==this.cameraId||this.type&&e.type!==this.type)return;const s=this.cams?.find(n=>n.id===e.camera_id)?.name??null,i={...e,camera_name:e.camera_name??s};(e.thumbnail==="ready"||e.thumbnail==="unavailable")&&(this.cancelPoll(e.id),e.thumbnail==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e.id,Date.now())));const a=this.events.findIndex(n=>n.id===e.id);this.events=a>=0?this.events.map((n,o)=>o===a?{...n,...i}:n):[i,...this.events]}fmt(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date(e))}fmtDate(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,day:"2-digit",month:"2-digit"}).format(new Date(e))}async ack(e){this.busy=!0;try{const t=await Or(e.id);this.events=(this.events??[]).map(s=>s.id===e.id?{...s,...t}:s)}catch(t){this.error=w(t)}finally{this.busy=!1}}renderApi(){if(this.error&&!this.events)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.init()}></sw-state-panel>`;if(!this.events)return r`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.events.find(i=>i.id===this.selected)??null,t=this.ingest,s=this.events.filter(i=>!i.acked_at).length;return r`
      <div class="banner ${t&&!t.connected?"warn":""}">
        <span class="dot ${t?.connected?"on":""}"></span>
        <span>קליטה מה־NVR: ${t?t.connected?"מחובר":`מנותק${t.last_error?` (${t.last_error})`:""}`:"—"}${t?.last_heartbeat_at?` · פעימה ${this.fmt(t.last_heartbeat_at)}`:""}</span>
        <span>· עדכונים חיים: ${this.live?"פעיל":"מתחבר…"}</span>
        <span>· אירועים "נגזר מהקלטה" הם עדות מקובץ ההקלטה (inferred), לא התראה שנמדדה</span>
        ${t?.connected&&this.facets&&!this.facets.sources.some(i=>i.source==="alertstream")?r`<span data-no-alerts style="color:var(--sw-warning, #b45309);font-weight:600">· ה־NVR לא שלח התראות ב־${this.facets.days} הימים האחרונים — הפעל "Notify Surveillance Center" ב־linkage של זיהוי התנועה ב־NVR</span>`:c}
      </div>
      <div class="kpis" data-kpis>
        <div class="kpi"><div><div class="n">${s}</div><div class="l">לבדיקה</div></div><div class="ic"><sw-icon name="bell" size=${18}></sw-icon></div></div>
        <div class="kpi"><div><div class="n">${this.events.length-s}</div><div class="l">טופלו היום</div></div><div class="ic"><sw-icon name="check" size=${18}></sw-icon></div></div>
      </div>
      <div class="filters">
        <sw-field><input type="search" data-events-q placeholder="חיפוש חופשי (שם מצלמה, ישות HA, פרטי אירוע)" aria-label="חיפוש חופשי" .value=${this.q} @input=${i=>this.onSearchInput(i.target.value)} /></sw-field>
        <sw-field><select aria-label="מצלמה" @change=${i=>{this.cameraId=i.target.value,this.load()}}><option value="" ?selected=${!this.cameraId}>כל המצלמות</option>${(this.cams??[]).map(i=>r`<option value=${i.id} ?selected=${i.id===this.cameraId}>${i.name}</option>`)}</select></sw-field>
        <sw-field><select aria-label="סוג" @change=${i=>{this.type=i.target.value,this.load()}}><option value="" ?selected=${!this.type}>כל סוגי האירועים</option>${Object.keys(Y).map(i=>r`<option value=${i} ?selected=${i===this.type}>${Y[i]}</option>`)}</select></sw-field>
        <sw-field><input type="date" .value=${this.date} max=${Ze(new Date,this.tz)} data-ltr aria-label="תאריך" @change=${i=>{this.date=i.target.value,this.load()}} /></sw-field>
        <span class="rangepick" role="group" aria-label="טווח ימים" data-events-range>
          ${[[1,"יום"],[7,"7 ימים"],[30,"30 יום"]].map(([i,a])=>r`<button class=${this.rangeDays===i?"on":""} data-events-range-set=${i} @click=${()=>this.setRange(i)}>${a}</button>`)}
        </span>
        <sw-field><select aria-label="מקום" data-filter-floor @change=${i=>{this.placeFloor=i.target.value,this.placeZone="",this.load()}}><option value="" ?selected=${!this.placeFloor}>כל המקומות</option>${this.facetFloors.map(i=>r`<option value=${i.id} ?selected=${i.id===this.placeFloor}>${i.name} · ${i.cameras} מצלמות${i.sensors?` · ${i.sensors} חיישנים`:""}</option>`)}</select></sw-field>
        ${this.placeFloor&&this.facetFloors.find(i=>i.id===this.placeFloor)?.zones.length?r`<sw-field><select aria-label="חדר / אזור" data-filter-zone @change=${i=>{this.placeZone=i.target.value,this.load()}}><option value="" ?selected=${!this.placeZone}>כל הקומה</option>${(this.facetFloors.find(i=>i.id===this.placeFloor)?.zones??[]).map(i=>r`<option value=${i.id} ?selected=${i.id===this.placeZone}>${i.name} · ${i.cameras} מצלמות${i.sensors?` · ${i.sensors} חיישנים`:""}</option>`)}</select></sw-field>`:c}
        <sw-field><select aria-label="מקור" data-filter-source @change=${i=>{this.source=i.target.value,this.load()}}><option value="" ?selected=${!this.source}>כל המקורות</option>${Object.entries(Pa).map(([i,a])=>r`<option value=${i} ?selected=${i===this.source}>${a}</option>`)}</select></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>{this.filter="all",this.load()}} count=${this.events.length}>הכל</sw-chip>
        <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>{this.filter="unacked",this.load()}} count=${s}>לבדיקה</sw-chip>
        <sw-chip ?selected=${this.filter==="acked"} @click=${()=>{this.filter="acked",this.load()}}>טופלו</sw-chip>
        <sw-button size="sm" icon="check" ?disabled=${!s||this.busy} data-ack-all title="מסמן כטופלו את כל האירועים ברשימה שעדיין לבדיקה (לפי הסינון הנוכחי)" @click=${()=>this.ackAll()}>סמן הכול כטופל (${s})</sw-button>
        <span class="sub" style="margin-inline-start:6px">·</span>
        <sw-chip icon="list" ?selected=${this.mode==="raw"} @click=${()=>this.setMode("raw")}>אירועים</sw-chip>
        <sw-chip icon="layers" ?selected=${this.mode==="windows"} data-mode-windows @click=${()=>this.setMode("windows")} count=${this.windows?.length}>חלונות</sw-chip>
      </div>
      ${this.renderFacets()}
      ${this.unsupported.length?r`<div class="banner warn" data-unsupported>המסנן אינו נתמך כאן, לא "אין תוצאות": ${this.unsupported.map(i=>i.reason).join(" · ")}</div>`:c}
      ${this.error?r`<div class="banner warn">${this.error}</div>`:c}
      <div class="stage">
        ${this.mode==="windows"?this.windows===null||this.windowsBusy&&!this.windows.length?r`<sw-state-panel state="loading"></sw-state-panel>`:this.windows.length?r`<div class="banner" style="margin-block-end:8px"><sw-icon name="info" size=${14}></sw-icon><span>${this.windowBy==="camera"?"התראות סמוכות באותה מצלמה":this.windowBy==="all"?"התראות סמוכות מכל המצלמות":this.windowBy==="zone"?"התראות סמוכות באותו חדר":"התראות סמוכות באותה קומה"} הופכות לחלון אירוע אחד (מרווח עד ${Math.round(this.windowGap/60)} דק׳). האירועים המקוריים נשמרים לצפייה.</span><span class="grow"></span>
                  <sw-field><select aria-label="קיבוץ" data-window-by @change=${i=>{this.windowBy=i.target.value,this.loadWindows()}}>${Object.keys(Ea).map(i=>r`<option value=${i} ?selected=${this.windowBy===i}>${Ea[i]}</option>`)}</select></sw-field>
                  <sw-field><select aria-label="מרווח קיבוץ" data-window-gap @change=${i=>{this.windowGap=Number(i.target.value),this.loadWindows()}}>${[60,180,300,600,900,1800,3600].map(i=>r`<option value=${i} ?selected=${this.windowGap===i}>${i/60} דק׳</option>`)}</select></sw-field></div>
                <sw-table .columns=${this.windowColumns} .rows=${this.windows} .selected=${this.selectedWindow} @row-select=${i=>this.selectedWindow=i.detail.id}></sw-table>`:r`<sw-state-panel state="empty" heading="אין חלונות אירוע ביום הזה" hint="חלון נוצר מאירועים סמוכים של אותה מצלמה."></sw-state-panel>`:this.events.length?r`<sw-table .columns=${this.apiColumns} .rows=${this.events} .selected=${this.selected} @row-hover=${i=>{const a=this.events?.find(n=>n.id===i.detail.id);a&&this.hoverStart(a,i.detail)}} @row-leave=${()=>this.hoverEnd()} @row-select=${i=>this.select(i.detail.id)}></sw-table>`:r`<sw-state-panel state="empty" heading="אין אירועים ביום הזה" hint="התראות מגיעות מה־NVR רק כשהטריגר מוגדר עם 'Notify Surveillance Center'; אירועי תנועה נגזרים מקובצי ההקלטה בהפעלה ובכל 10 דקות."></sw-state-panel>`}
        ${this.renderRowPreview()}
        ${this.mode==="windows"&&this.selectedWindow&&this.windows?(()=>{const i=this.windows.find(a=>a.id===this.selectedWindow);return i?this.renderWindowDrawer(i):c})():c}
        ${e?r`<sw-drawer open heading=${Y[e.type]??e.type} subheading=${`${e.camera_name??(e.channel?`ערוץ ${e.channel}`:"מערכת")} · ${this.fmt(e.occurred_at)}`} @close=${()=>this.closeDrawer()}>
              <div class="big">
                ${this.player?.eventId===e.id&&this.player.session?r`<sw-live-player .wsUrl=${Gs(this.player.session)} mode="mse" .retry=${!1}></sw-live-player>`:e.thumbnail==="ready"?r`<img src=${Mt(e.id,this.thumbVersion.get(e.id)??0)} alt="תמונת האירוע מההקלטה" />`:r`<div class="hint">${e.camera_id?e.thumbnail==="unavailable"?"אין פריים זמין בהקלטה בזמן האירוע":this.player?.eventId===e.id?"פותח את ההקלטה…":"מכין תמונה מההקלטה…":"אירוע ללא מצלמה"}</div>`}
                ${this.player?.eventId===e.id&&this.player.error?r`<div class="err">${this.player.error}</div>`:c}
              </div>
              <dl>
                <dt>מקור</dt><dd>${e.source==="alertstream"?"התראה מה־NVR (alertStream)":e.source==="recording"?"קובץ הקלטה (חיפוש)":e.source==="ha"?"חיישן HA (מעבר מצב)":"מערכת"} · raw: <span class="ltr">${e.raw_type}</span></dd>
                <dt>ודאות</dt><dd>${e.confidence==="measured"?"נמדד על ידי המכשיר":"נגזר (inferred)"}</dd>
                <dt>זמן אירוע</dt><dd><span class="ltr">${this.fmtDate(e.occurred_at)} ${this.fmt(e.occurred_at)}</span>${e.ended_at?r` → <span class="ltr">${this.fmt(e.ended_at)}</span>`:c} · נקלט <span class="ltr">${this.fmt(e.received_at)}</span>${typeof e.details.time_precision=="string"?r` · דיוק: ${String(e.details.time_precision)}`:c}</dd>
                <dt>חזרות</dt><dd>${e.count} · מצב ${e.state==="active"?"פעיל":e.state==="inactive"?"הסתיים":"—"}</dd>
                <dt>טיפול</dt><dd>${e.acked_at?`טופל בידי ${e.acked_by_username??""} · ${this.fmt(e.acked_at)}`:"ממתין"}</dd>
                ${typeof e.details.description=="string"&&e.details.description?r`<dt>תיאור</dt><dd class="ltr">${String(e.details.description)}</dd>`:c}
                ${typeof e.details.seconds=="number"?r`<dt>משך ההקלטה</dt><dd>${String(e.details.seconds)} שנ׳</dd>`:c}
              </dl>
              <div slot="footer">
                <sw-button variant="primary" size="sm" icon="expand" data-review @click=${()=>b(`/investigate/events/${e.id}`)}>סקירה מלאה</sw-button>
                ${e.camera_id?r`<sw-button size="sm" icon="play" @click=${()=>this.play(e)}>${this.player?.eventId===e.id?"עצור":"נגן כאן"}</sw-button>
                    <sw-button size="sm" icon="history" @click=${()=>b("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>להקלטה</sw-button>`:c}
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${!!e.acked_at||this.busy} @click=${()=>this.ack(e)}>סמן טופל</sw-button>
              </div>
            </sw-drawer>`:c}
      </div>
    `}renderDemo(){const e=et.filter(s=>this.filter==="all"||!s.acked),t=et.find(s=>s.id===this.selected);return r`
      <div class="filters">
        <sw-field><select aria-label="אתר"><option>כל האתרים</option><option>אתר הדגמה</option></select></sw-field>
        <sw-field><select aria-label="מצלמה"><option>כל המצלמות</option></select></sw-field>
        <sw-field><select aria-label="סוג"><option>כל סוגי האירועים</option><option>אדם</option><option>רכב</option><option>תנועה</option><option>ניתוק</option></select></sw-field>
        <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${et.length}>הכל</sw-chip>
        <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>this.filter="unacked"} count=${et.filter(s=>!s.acked).length}>ללא טיפול</sw-chip>
      </div>
      <div class="stage">
        <sw-table .columns=${this.columns} .rows=${e} .selected=${this.selected} @row-select=${s=>this.selected=s.detail.id}></sw-table>
        ${t?r`<sw-drawer open heading=${Ii[t.type]} subheading=${`${t.camera} · ${t.time}`} @close=${()=>this.selected=null}>
              <div class="preview">${t.type==="offline"||t.type==="door"?"אין תמונה לאירוע זה":r`<sw-scene kind=${Wa[t.camera]??"lobby"}></sw-scene><span class="demo">דמו · תמונת אירוע מה־NVR (T044)</span>`}</div>
              <dl>
                <dt>מקור</dt><dd><span class="ltr">${t.source}</span> · raw: <span class="ltr">${t.type}</span></dd>
                <dt>זמן אירוע</dt><dd>${t.time} · נקלט +1.2s</dd>
                <dt>קומה</dt><dd>${t.floor}</dd>
                <dt>כיסוי הקלטה</dt><dd>${t.type==="offline"?"אין":"קיים · 10 שנ׳ לפני/אחרי"}</dd>
                <dt>טיפול</dt><dd>${t.acked?"טופל בידי יוני, 09:50":"ממתין"}</dd>
              </dl>
              <div slot="footer">
                <a href="#/investigate/playback"><sw-button variant="primary" size="sm" icon="history">להקלטה</sw-button></a>
                <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה</sw-button></a>
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${t.acked}>סמן טופל</sw-button>
              </div>
            </sw-drawer>`:""}
      </div>
    `}render(){const e=g();return r`
      <sw-page heading="מרכז אירועים" subheading=${e?`חיפוש, סינון וסקירה · מקור, ודאות וזמן קליטה נשמרים · אזור זמן ${this.tz}`:"חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה"}>
        ${e?c:r`<sw-button slot="actions" icon="download">ייצוא</sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};B.styles=z`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .filters sw-field {
      inline-size: 150px;
    }
    .filters sw-field:has(input[type='search']) {
      inline-size: 210px;
    }
    .filters .grow {
      flex: 1;
    }
    .rangepick {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    .rangepick button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
    }
    .rangepick button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    sw-scene.thumb,
    .thumb.none {
      inline-size: 64px;
      block-size: 40px;
      border-radius: 6px;
      overflow: hidden;
    }
    .thumb.none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .thumb img {
      inline-size: 64px;
      block-size: 40px;
      object-fit: cover;
      border-radius: 6px;
      display: block;
      background: var(--sw-surface-3);
    }
    .thumb.pending {
      background: linear-gradient(90deg, var(--sw-surface-3) 25%, var(--sw-surface-2) 50%, var(--sw-surface-3) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s linear infinite;
    }
    @keyframes shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .thumb.pending {
        animation: none;
      }
    }
    .big {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      text-align: center;
    }
    .big img,
    .big sw-live-player {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .big .hint {
      padding: 10px;
    }
    .big .err {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 8px;
      background: rgba(17, 24, 39, 0.7);
      color: #fff;
      border-radius: 6px;
      padding: 4px 8px;
    }
    .ty {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-weight: var(--sw-fw-semibold);
    }
    .ty i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--tone);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .preview {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      text-align: center;
      padding: 10px;
    }
    .preview sw-scene {
      position: absolute;
      inset: 0;
    }
    .preview .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .banner {
      font-size: var(--sw-fs-xs);
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .banner.warn {
      background: var(--sw-stale-soft);
      color: #7c2d12;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-offline);
      display: inline-block;
    }
    .dot.on {
      background: var(--sw-live);
    }
    .kpis {
      display: none;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-block-end: 10px;
    }
    .kpi {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .kpi .n {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      line-height: 1;
    }
    .kpi .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .kpi .ic {
      inline-size: 36px;
      block-size: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    @media (max-width: 767px) {
      .kpis {
        display: grid;
      }
      .filters sw-field {
        inline-size: 100%;
      }
    }
    .wlist {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .wrow {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .wrow:hover {
      background: var(--sw-surface-3);
    }
    /* hover preview over an event row (T044): the event's frame and the frames 5 s before / after it */
    .rowpreview {
      position: fixed;
      z-index: var(--sw-z-popover, 40);
      inline-size: 372px;
      max-inline-size: calc(100vw - 32px);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3, var(--sw-shadow-2));
      padding: 8px;
      pointer-events: none;
    }
    .rowpreview .strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .rowpreview .cell {
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: 6px;
      overflow: hidden;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      position: relative;
    }
    .rowpreview .cell.main {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .rowpreview img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .rowpreview .t {
      position: absolute;
      inset-block-end: 3px;
      inset-inline-end: 5px;
      font-family: var(--sw-font-mono);
      font-size: 10px;
      color: #fff;
      background: rgba(0, 0, 0, 0.55);
      padding: 0 4px;
      border-radius: 3px;
    }
    .rowpreview .cap {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;V([m()],B.prototype,"cameraId",2);V([m()],B.prototype,"date",2);V([m()],B.prototype,"initialMode",2);V([d()],B.prototype,"selected",2);V([d()],B.prototype,"filter",2);V([d()],B.prototype,"cams",2);V([d()],B.prototype,"tz",2);V([d()],B.prototype,"type",2);V([d()],B.prototype,"events",2);V([d()],B.prototype,"ingest",2);V([d()],B.prototype,"live",2);V([d()],B.prototype,"error",2);V([d()],B.prototype,"busy",2);V([d()],B.prototype,"thumbVersion",2);V([d()],B.prototype,"player",2);V([d()],B.prototype,"mode",2);V([d()],B.prototype,"windows",2);V([d()],B.prototype,"windowGap",2);V([d()],B.prototype,"windowBy",2);V([d()],B.prototype,"selectedWindow",2);V([d()],B.prototype,"windowsBusy",2);V([d()],B.prototype,"facets",2);V([d()],B.prototype,"placeFloor",2);V([d()],B.prototype,"placeZone",2);V([d()],B.prototype,"source",2);V([d()],B.prototype,"unsupported",2);V([d()],B.prototype,"q",2);V([d()],B.prototype,"rangeDays",2);V([d()],B.prototype,"rowPreview",2);B=V([S("investigate-events")],B);var Uc=Object.defineProperty,Zc=Object.getOwnPropertyDescriptor,ge=(e,t,s,i)=>{for(var a=i>1?void 0:i?Zc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Uc(t,s,a),a};const qc={measured:"recorded",inferred:"unknown",command:"partial",availability:"stale"},Ua={alertstream:"אירוע NVR",recording:"נגזר מהקלטה",system:"מערכת",ha:"חיישן HA"},Za=600*1e3;let ce=class extends x{constructor(){super(...arguments),this.eventId="",this.ev=null,this.error="",this.tz="Asia/Jerusalem",this.session=null,this.playerError="",this.bundle=null,this.nearby=[],this.corr=null,this.corrError="",this.route=null,this.busy=!1,this.thumbVersion=0,this.casePick=null,this.pollTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer),this.stopPlayer()}updated(e){e.has("eventId")&&e.get("eventId")!==void 0&&this.load()}async load(){if(g()){this.error="",await this.stopPlayer();try{const e=await nd(this.eventId);this.ev=e,this.tz=e.timezone||this.tz,e.location?.has_plan?this.loadMap(e.location.floor_id):this.bundle=null,this.loadNearby(e),this.loadCorrelation(e.id),this.loadRoute(e.id),e.camera_id&&this.play(e),e.thumbnail==="pending"&&this.pollThumb(e.id)}catch(e){this.error=w(e),this.ev=null}}}async loadRoute(e){this.route=null;try{this.route=await hd(e)}catch{this.route=null}}renderRoute(){const e=this.route;return!e||!e.spatial?c:r`<sw-card heading="המשך מסלול מוצע" subheading="השערה לפי טופולוגיית המפה · ±${Math.round((new Date(e.window.to).getTime()-new Date(e.window.from).getTime())/1e3)} שניות" style="margin-block-start:12px" data-route>
      ${e.suggestions.length?r`<div class="corr" data-route-list>${e.suggestions.map(t=>r`<div class="link" data-route-item data-relation=${t.relation}>
              <span><sw-badge kind=${t.relation==="same_zone"?"recorded":t.relation==="adjacent_zone"?"partial":"neutral"} label=${t.relation_label}></sw-badge></span>
              <span>${t.name}${t.zone?r` · ${t.zone}`:c}<small>${t.activity_events?`${t.activity_events} אירועים בחלון`:"ללא אירועים בחלון"} · מרחק ${Math.round(t.distance*100)} יח׳ תוכנית</small></span>
              <sw-button size="sm" icon="play" @click=${()=>b("/investigate/playback",{camera:t.camera_id,t:t.playback_at})}>נגן</sw-button>
            </div>`)}</div>`:r`<div class="note" style="margin:0">אין מצלמות נוספות בסביבה על התוכנית.</div>`}
      ${e.notes.length?r`<ul class="corrnotes">${e.notes.map(t=>r`<li>${t}</li>`)}</ul>`:c}
      <div class="note">${e.policy}</div>
    </sw-card>`}async loadCorrelation(e){this.corr=null,this.corrError="";try{this.corr=await cd(e)}catch(t){this.corrError=w(t)}}async loadMap(e){try{this.bundle=await ks(e)}catch{this.bundle=null}}async loadNearby(e){try{const t=new Date(e.occurred_at).getTime(),s=a=>new Date(a).toISOString().replace(/\.\d{3}Z$/,"Z"),i=await li({from:s(t-Za),to:s(t+Za),limit:30});this.nearby=i.events.filter(a=>a.id!==e.id).slice(0,6)}catch{this.nearby=[]}}pollThumb(e){window.clearTimeout(this.pollTimer),this.pollTimer=window.setTimeout(async()=>{const t=await Dr(e).catch(()=>"unavailable");this.ev?.id===e&&(t==="pending"?this.pollThumb(e):(this.ev={...this.ev,thumbnail:t},t==="ready"&&(this.thumbVersion=Date.now())))},1500)}async play(e){if(e.camera_id){this.playerError="";try{const t=new Date(new Date(e.occurred_at).getTime()-2e3).toISOString().replace(/\.\d{3}Z$/,"Z"),s=await aa(e.camera_id,t);this.ev?.id===e.id?this.session=s:await Ss(s.id).catch(()=>{})}catch(t){this.playerError=w(t)}}}async stopPlayer(){const e=this.session;this.session=null,e&&await Ss(e.id).catch(()=>{})}async ack(){const e=this.ev;if(!(!e||e.acked_at)){this.busy=!0;try{const t=await Or(e.id);this.ev={...e,acked_at:t.acked_at,acked_by_username:t.acked_by_username}}catch(t){this.error=w(t)}finally{this.busy=!1}}}fmt(e,t=!1){const s=new Date(e),i=new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(s);return t?`${new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,day:"2-digit",month:"2-digit",year:"numeric"}).format(s)} · ${i}`:i}renderCorrelation(){const e=this.corr,t=e?`±${e.window_s} שניות · ${e.spatial?`סביבת ${e.location?.zone??"המיקום על התוכנית"} (${e.location?.floor_name??""})`:"לפי זמן בלבד"}`:this.corrError?"לא נטען":"טוען…";return r`<sw-card heading="קורלציה דלת–מצלמה–חיישן" subheading=${t} style="margin-block-start:12px" data-correlation>
      ${e?r`${e.entities.length?r`<div class="note" style="margin:0 0 6px" data-correlation-entities>בסביבה: ${e.entities.map(s=>`${s.name}${s.state_missing?" (ללא מצב)":s.state?` · ${s.state}`:""}`).join(" · ")}</div>`:r`<div class="note" style="margin:0 0 6px" data-correlation-entities>אין חיישנים או מנעולים מוצבים בסביבה.</div>`}
            ${e.links.length?r`<div class="corr" data-correlation-links>${e.links.map(s=>r`<div class="link" data-correlation-link data-certainty=${s.certainty}>
                    <span class="ltr num">${s.delta_s>0?"+":""}${s.delta_s}s</span>
                    <span>${s.kind==="camera"&&s.event_id?r`<a href=${`#/investigate/events/${s.event_id}`}>${s.label}</a>`:s.kind==="sensor"&&s.event_id?r`<a href=${`#/investigate/events/${s.event_id}`}>${s.label}</a>`:s.label}<small>${s.note}</small></span>
                    <sw-badge kind=${qc[s.certainty]} label=${dd[s.certainty]}></sw-badge>
                  </div>`)}</div>`:r`<div class="note" style="margin:0">לא נרשם דבר בחלון הזמן מהחיישנים, המנעולים והמצלמות שבסביבה.</div>`}
            ${e.notes.length?r`<ul class="corrnotes">${e.notes.map(s=>r`<li data-correlation-note=${s.code}>${s.text}</li>`)}</ul>`:c}
            <div class="note">${e.policy}</div>`:this.corrError?r`<div class="note">${this.corrError}</div>`:c}
    </sw-card>`}duration(e){if(!e.ended_at)return typeof e.details.seconds=="number"?`${e.details.seconds} שנ׳ (הקלטה)`:"—";const t=Math.max(0,Math.round((new Date(e.ended_at).getTime()-new Date(e.occurred_at).getTime())/1e3));return`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}get markers(){const e=this.bundle;return e?e.anchors.map(t=>({id:t.id,kind:t.resource_type==="camera"?"camera":oi(t.layer_id,t.entity?.domain),label:t.camera?.name??t.entity?.name??t.label??t.resource_id,x:t.position.x,y:t.position.y,rotation:t.rotation_degrees,fov:t.field_of_view_degrees??void 0,state:t.resource_type==="camera"?ps(t):"neutral"})):[]}render(){if(!g())return r`<sw-page heading="אירוע"><sw-state-panel state="empty" heading="דף האירוע זמין עם השרת" hint="במצב הדגמה אין אירועים אמיתיים."></sw-state-panel></sw-page>`;if(this.error&&!this.ev)return r`<sw-page heading="אירוע"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;const e=this.ev;if(!e)return r`<sw-page heading="אירוע"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=Y[e.type]??e.type,s=e.camera_name??(e.channel?`ערוץ ${e.channel}`:"מערכת"),i=e.location,a=i?`${i.building_name} · ${i.floor_name}${i.zone?` / ${i.zone}`:""}`:null,n=!!e.acked_at;return r`
      <sw-page heading=${`${t} · ${s}`} subheading=${`${Ua[e.source]??e.source} · ${this.fmt(e.occurred_at,!0)}`} crumbs=${`חקירה | אירועים | ${t}`} wide>
        <sw-button slot="actions" variant=${n?"ghost":"primary"} icon="check" ?disabled=${n||this.busy} @click=${()=>this.ack()}>${n?"טופל":"סמן כטופל"}</sw-button>
        <sw-button slot="actions" icon="case" data-add-to-case @click=${()=>this.casePick={kind:"event",event_id:e.id}}>הוסף לתיק</sw-button>
        <sw-button slot="actions" variant="ghost" icon="list" @click=${()=>b("/investigate/events")}>למרכז האירועים</sw-button>
        ${this.error?r`<div class="err">${this.error}</div>`:c}
        <div class="layout">
          <div>
            <div class="player" data-player>
              ${this.session?r`<sw-live-player .wsUrl=${Gs(this.session)} mode="mse" .retry=${!1}></sw-live-player>`:e.thumbnail==="ready"?r`<img src=${Mt(e.id,this.thumbVersion)} alt="תמונת האירוע מההקלטה" />`:r`<div class="hint">${e.camera_id?this.playerError?`ההקלטה לא נפתחה: ${this.playerError}`:e.thumbnail==="unavailable"?"אין הקלטה זמינה בזמן האירוע":"פותח את ההקלטה…":"אירוע ללא מצלמה — אין וידאו"}</div>`}
              <span class="chip"><sw-icon name="clock" size=${12}></sw-icon>${this.session?"הקלטה":e.thumbnail==="ready"&&!this.session?"תמונה מההקלטה":"אירוע"}</span>
              <div class="caption">${s}<small>זמן האירוע <span class="ltr">${this.fmt(e.occurred_at)}</span>${this.session?.actual_start_at?r` · הנגן מתחיל <span class="ltr">${this.fmt(this.session.actual_start_at)}</span>${this.session.time_precision!=="verified"?` (${this.session.time_precision==="keyframe_limited"?"לפי keyframe":"משוער"})`:""}`:c}</small></div>
            </div>
            <div class="bar">
              <span>${this.session?"הנגן פותח את ההקלטה שתי שניות לפני זמן האירוע; זמן האירוע וזמן הפריים המנוגן מוצגים בנפרד.":e.playerHint??""}</span>
              <span class="grow"></span>
              ${e.camera_id?r`<sw-button size="sm" icon="history" @click=${()=>b("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>הנגן המלא עם ציר הזמן</sw-button>`:c}
              ${e.camera_id?r`<sw-button size="sm" variant="ghost" icon="play" @click=${()=>this.session?this.stopPlayer():this.play(e)}>${this.session?"עצור":"נגן שוב"}</sw-button>`:c}
            </div>
          </div>
          <div>
            <sw-card heading="הקשר האירוע" data-context>
              <dl class="meta">
                <dt>מצב</dt><dd data-status>${n?r`<sw-badge kind="live" label=${`טופל · ${e.acked_by_username??""}`}></sw-badge> <span class="note" style="margin:0">${this.fmt(e.acked_at,!0)}</span>`:r`<sw-badge kind="stale" label="טרם טופל"></sw-badge>`}</dd>
                <dt>מקור</dt><dd>${Ua[e.source]??e.source}${e.camera_id?r` / ${s}`:c} <span class="note" style="margin:0">raw <span class="ltr">${e.raw_type}</span></span></dd>
                <dt>סוג</dt><dd>${t}${e.confidence==="inferred"?" · נגזר (inferred)":""}</dd>
                <dt>זמן התחלה</dt><dd><span class="ltr">${this.fmt(e.occurred_at,!0)}</span></dd>
                <dt>משך החלון</dt><dd>${this.duration(e)}${e.count>1?` · ${e.count} חזרות`:""}</dd>
                <dt>מיקום</dt><dd data-where>${a??(e.camera_id?"המצלמה עדיין לא מוצבת על תוכנית":"—")}</dd>
              </dl>
              ${i&&i.has_plan&&this.bundle?r`<div class="map">
                    <div class="floorchip"><sw-icon name="building" size=${12}></sw-icon>${i.floor_name}</div>
                    <sw-plan-canvas .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .imageUrl=${this.bundle.imageUrl} .plan=${this.bundle.planSvg} .markers=${this.markers} .selectedId=${i.anchor_id} .zones=${this.bundle.zones} alwaysLabel dimEntities></sw-plan-canvas>
                  </div>
                  <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
                    <sw-button size="sm" icon="map" data-history-map @click=${()=>b(`/investigate/floors/${i.floor_id}`,{t:e.occurred_at,camera:e.camera_id??""})}>המשך חקירה במפה</sw-button>
                    <sw-button size="sm" variant="ghost" icon="live" @click=${()=>b(`/explore/floors/${i.floor_id}`)}>מפה חיה</sw-button>
                  </div>`:i?r`<div class="note">לקומה ${i.floor_name} אין תוכנית מפורסמת עדיין.</div>`:c}
              <div class="note">מיקום סמוך הוא הקשר, לא הוכחת קשר סיבתי; סימון "טופל" נרשם באודיט בשם המשתמש.</div>
            </sw-card>
            ${this.renderCorrelation()}
            ${this.renderRoute()}
            <sw-card heading="אירועים קרובים" subheading="±10 דקות סביב האירוע" style="margin-block-start:12px">
              ${this.nearby.length?r`<div class="nearby">${this.nearby.map(o=>r`<a href=${`#/investigate/events/${o.id}`}><span>${Y[o.type]??o.type} · ${o.camera_name??(o.channel?`ערוץ ${o.channel}`:"מערכת")}</span><span class="ltr">${this.fmt(o.occurred_at)}</span></a>`)}</div>`:r`<div class="note" style="margin:0">אין אירועים נוספים בחלון הזה.</div>`}
            </sw-card>
          </div>
        </div>
        <sw-case-picker .item=${this.casePick} subheading=${`${t} · ${s} · ${this.fmt(e.occurred_at,!0)}`} @close=${()=>this.casePick=null}></sw-case-picker>
      </sw-page>
    `}};ce.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 16px;
      align-items: start;
    }
    .player {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #0f172a;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-1);
    }
    .player sw-live-player,
    .player img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }
    .player .hint {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.8);
      font-size: var(--sw-fs-sm);
      text-align: center;
      padding: 20px;
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(17, 24, 39, 0.72);
      color: #fff;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .caption {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      font-size: var(--sw-fs-sm);
    }
    .caption small {
      display: block;
      opacity: 0.85;
      font-size: var(--sw-fs-xs);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-start: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .bar .grow {
      flex: 1;
    }
    dl.meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dl.meta dt {
      color: var(--sw-text-3);
    }
    dl.meta dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .map {
      position: relative;
      block-size: 230px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-map-bg);
      margin-block-start: 10px;
    }
    .map sw-plan-canvas {
      block-size: 100%;
      min-block-size: 0;
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      z-index: var(--sw-z-map-ui);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .corr {
      display: flex;
      flex-direction: column;
    }
    .corr .link {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .corr .link:last-child {
      border-block-end: 0;
    }
    .corr small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .corr .num {
      font-variant-numeric: tabular-nums;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
    }
    .corrnotes {
      margin: 8px 0 0;
      padding-inline-start: 18px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .nearby {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-block-start: 6px;
    }
    .nearby a {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
    }
    .nearby a:hover {
      background: var(--sw-surface-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 8px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono);
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;ge([m()],ce.prototype,"eventId",2);ge([d()],ce.prototype,"ev",2);ge([d()],ce.prototype,"error",2);ge([d()],ce.prototype,"tz",2);ge([d()],ce.prototype,"session",2);ge([d()],ce.prototype,"playerError",2);ge([d()],ce.prototype,"bundle",2);ge([d()],ce.prototype,"nearby",2);ge([d()],ce.prototype,"corr",2);ge([d()],ce.prototype,"corrError",2);ge([d()],ce.prototype,"route",2);ge([d()],ce.prototype,"busy",2);ge([d()],ce.prototype,"thumbVersion",2);ge([d()],ce.prototype,"casePick",2);ce=ge([S("investigate-event-detail")],ce);var Kc=Object.getOwnPropertyDescriptor,Gc=(e,t,s,i)=>{for(var a=i>1?void 0:i?Kc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const Yc=[{id:"rv-1",title:"כניסה ראשית · 10:12–10:16",primary:"כניסה ראשית",scene:"entrance",related:["לובי"],events:3,severity:"alert",status:"חדש"},{id:"rv-2",title:"חצר אחורית · 09:40–09:44",primary:"חצר אחורית",scene:"backyard",related:[],events:2,severity:"info",status:"בבדיקה"},{id:"rv-3",title:"חניה מקורה · 06:41–06:45",primary:"חניה מקורה",scene:"parking",related:["כניסה ראשית"],events:1,severity:"alert",status:"טופל"},{id:"rv-4",title:"לובי · אתמול 23:08–23:12",primary:"לובי",scene:"lobby",related:[],events:4,severity:"info",status:"false positive"}];let ji=class extends x{render(){return r`
      <sw-page heading="תור Review" subheading="אירועים סמוכים מקובצים לחלון אחד עם מצלמה ראשית · נתוני הדגמה">
        <div class="filters">
          <sw-chip selected count=${1}>חדש</sw-chip><sw-chip count=${1}>בבדיקה</sw-chip><sw-chip count=${1}>טופל</sw-chip><sw-chip count=${1}>false positive</sw-chip>
          <sw-chip icon="filter">חומרה</sw-chip><sw-chip icon="camera">מצלמה</sw-chip>
        </div>
        <div class="list">
          ${Yc.map(e=>r`<sw-card>
              <sw-camera-tile name=${e.primary} meta=${`${e.events} אירועים`} state="recorded" scene=${e.scene}></sw-camera-tile>
              <div class="meta"><strong>${e.title}</strong><sw-badge kind=${e.status==="חדש"?"stale":e.status==="טופל"?"neutral":"recorded"} label=${e.status}></sw-badge></div>
              <div class="sub">מצלמות קשורות: ${e.related.length?e.related.join(", "):"אין"} · ${e.severity==="alert"?"התראה":"מידע"}</div>
              <div class="actions">
                <a href="#/investigate/playback"><sw-button size="sm" icon="play">נגן</sw-button></a>
                <a href="#/investigate/events"><sw-button size="sm" variant="ghost">אירועים גולמיים</sw-button></a>
                <sw-button size="sm" variant="ghost" icon="check">טופל</sw-button>
              </div>
            </sw-card>`)}
        </div>
      </sw-page>
    `}};ji.styles=z`
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-block: 8px 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      flex-wrap: wrap;
    }
    .meta strong {
      color: var(--sw-text);
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-end: 8px;
    }
    .actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
  `;ji=Gc([S("investigate-reviews")],ji);var Jc=Object.defineProperty,Xc=Object.getOwnPropertyDescriptor,j=(e,t,s,i)=>{for(var a=i>1?void 0:i?Xc(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Jc(t,s,a),a};const Qc={open:"stale",in_review:"recorded",closed:"neutral"},ep={preserved:"recorded",preserving:"partial",nvr_only:"stale",missing:"error",unknown:"unknown",none:"neutral"},tp=(e,t)=>new Intl.DateTimeFormat("he-IL",{timeZone:t,dateStyle:"short",timeStyle:"short"}).format(new Date(e)),sp=[{key:"title",label:"תיק",render:e=>r`<strong>${String(e.title)}</strong>${e.tags?r`<div style="font-size:11px;color:var(--sw-text-3)">${String(e.tags)}</div>`:c}`},{key:"status",label:"סטטוס",render:e=>r`<sw-badge kind=${Qc[e.status]} label=${fs[e.status]}></sw-badge>`},{key:"owner",label:"בעלים"},{key:"items",label:"פריטים"},{key:"preserved",label:"עותקים שמורים",render:e=>r`${String(e.preserved)} מתוך ${String(e.clips)}`},{key:"updated",label:"עודכן",ltr:!0,render:e=>tp(String(e.updated))}],ip=[{key:"title",label:"תיק",render:e=>r`<strong>${String(e.title)}</strong>`},{key:"status",label:"סטטוס",render:e=>r`<sw-badge kind=${e.status==="פתוח"?"stale":e.status==="סגור"?"neutral":"recorded"} label=${String(e.status)}></sw-badge>`},{key:"owner",label:"בעלים"},{key:"clips",label:"קטעים"},{key:"notes",label:"הערות"},{key:"preserved",label:"ראיות שמורות",render:e=>r`${e.preserved} שמורות${Number(e.missing)?r` · <span style="color:var(--sw-danger)">${e.missing} חסרות</span>`:""}`},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}];let xe=class extends x{constructor(){super(...arguments),this.cases=[],this.canManage=!1,this.loading=!1,this.error="",this.status="all",this.q="",this.creating=!1,this.newTitle="",this.newDesc="",this.newTags="",this.busy=!1,this.qTimer=0}connectedCallback(){super.connectedCallback(),g()&&this.load()}async load(){this.loading=!0,this.error="";try{const e=await Hr({status:this.status==="all"?void 0:this.status,q:this.q||void 0});this.cases=e.cases,this.canManage=e.can_manage}catch(e){this.error=w(e)}finally{this.loading=!1}}setStatus(e){this.status=e,this.load()}onQuery(e){this.q=e,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),250)}async create(){if(this.newTitle.trim()){this.busy=!0,this.error="";try{const e=await Vr({title:this.newTitle.trim(),description:this.newDesc,tags:this.newTags.split(",").map(t=>t.trim()).filter(Boolean)});this.creating=!1,this.newTitle=this.newDesc=this.newTags="",b(`/investigate/cases/${e.id}`)}catch(e){this.error=w(e)}finally{this.busy=!1}}}renderApi(){const e=this.cases.map(t=>({id:t.id,title:t.title,status:t.status,owner:t.owner_username,items:t.counts.items,clips:t.counts.events+t.counts.clips,preserved:t.counts.preserved,updated:t.updated_at,tags:t.tags.join(" · ")}));return r`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת מה־NVR">
        ${this.canManage?r`<sw-button slot="actions" variant="primary" icon="plus" data-case-new @click=${()=>this.creating=!0}>תיק חדש</sw-button>`:c}
        <div class="bar">
          ${["all","open","in_review","closed"].map(t=>r`<sw-chip ?selected=${this.status===t} @click=${()=>this.setStatus(t)}>${t==="all"?"הכל":fs[t]}</sw-chip>`)}
          <span class="grow"></span>
          <sw-field><input type="search" placeholder="חיפוש בכותרת, תיאור ותגיות" aria-label="חיפוש תיקים" .value=${this.q} @input=${t=>this.onQuery(t.target.value)} /></sw-field>
        </div>
        ${this.error?r`<div class="err">${this.error}</div>`:c}
        ${this.loading&&!this.cases.length?r`<sw-state-panel state="loading"></sw-state-panel>`:this.cases.length?r`<sw-table data-cases-table .columns=${sp} .rows=${e} @row-select=${t=>b(`/investigate/cases/${t.detail.id}`)}></sw-table>`:r`<sw-state-panel state="empty" heading="אין תיקים עדיין" hint="פתח תיק מדף אירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק), או כאן."></sw-state-panel>`}
        ${this.creating?r`<sw-dialog open heading="תיק חדש" subheading="כותרת קצרה; פריטים נוספים מדפי האירוע, הנגן והמפה" data-case-create @close=${()=>this.creating=!1}>
              <sw-field label="כותרת"><input data-case-title .value=${this.newTitle} @input=${t=>this.newTitle=t.target.value} /></sw-field>
              <sw-field label="תיאור"><textarea rows="3" .value=${this.newDesc} @input=${t=>this.newDesc=t.target.value}></textarea></sw-field>
              <sw-field label="תגיות (מופרדות בפסיק)"><input .value=${this.newTags} @input=${t=>this.newTags=t.target.value} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.creating=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" icon="plus" data-case-create-confirm ?disabled=${this.busy||!this.newTitle.trim()} @click=${()=>this.create()}>צור תיק</sw-button>
            </sw-dialog>`:c}
      </sw-page>
    `}render(){return g()?this.renderApi():r`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת ו־hash · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תיק חדש</sw-button>
        <sw-table .columns=${ip} .rows=${Ti} @row-select=${e=>b(`/investigate/cases/${e.detail.id}`)}></sw-table>
      </sw-page>
    `}};xe.styles=z`
    .bar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-end: 10px;
    }
    .grow {
      flex: 1;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
      margin-block-end: 8px;
    }
  `;j([d()],xe.prototype,"cases",2);j([d()],xe.prototype,"canManage",2);j([d()],xe.prototype,"loading",2);j([d()],xe.prototype,"error",2);j([d()],xe.prototype,"status",2);j([d()],xe.prototype,"q",2);j([d()],xe.prototype,"creating",2);j([d()],xe.prototype,"newTitle",2);j([d()],xe.prototype,"newDesc",2);j([d()],xe.prototype,"newTags",2);j([d()],xe.prototype,"busy",2);xe=j([S("investigate-cases")],xe);let ee=class extends x{constructor(){super(...arguments),this.caseId="case-1",this.tab="details",this.data=null,this.error="",this.info="",this.busy=!1,this.tz="Asia/Jerusalem",this.noteText="",this.editing=!1,this.editTitle="",this.editDesc="",this.editTags="",this.confirmDelete=!1,this.bundles=[],this.verifyResult=null,this.cams=[],this.snapCam="",this.loadedFor="",this.pollTimer=0}updated(e){e.has("caseId")&&g()&&this.loadedFor!==this.caseId&&this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer)}async load(){const e=this.caseId;this.loadedFor=e,this.error="";try{const[t,s]=await Promise.all([je(),dc(e)]);this.tz=t["time.zone"]??this.tz,this.data=s,this.bundles=(await vc(e).catch(()=>({bundles:[]}))).bundles,this.cams.length||(this.cams=(await Te().catch(()=>({cameras:[]}))).cameras.filter(i=>i.enabled),!this.snapCam&&this.cams[0]&&(this.snapCam=this.cams[0].id)),window.clearTimeout(this.pollTimer),s.items.some(i=>i.preservation==="preserving")&&(this.pollTimer=window.setTimeout(()=>void this.load(),5e3))}catch(t){this.error=w(t)}}fmt(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,dateStyle:"short",timeStyle:"medium"}).format(new Date(e))}async run(e,t=""){this.busy=!0,this.error="";try{await e(),this.info=t,await this.load(),t&&setTimeout(()=>this.info="",4e3)}catch(s){this.error=w(s),s instanceof be&&s.status===409&&await this.load()}finally{this.busy=!1}}patchCase(e){const t=this.data;t&&this.run(async()=>{await cc(t.id,{revision:t.revision,...e})})}async verify(e){if(e){this.verifyResult=null,this.busy=!0,this.error="";try{this.verifyResult=await yc(e)}catch(t){this.error=w(t)}finally{this.busy=!1}}}renderBundleCard(e){const t=this.verifyResult;return r`<sw-card heading="חבילת ראיות" subheading="ZIP עם הקטעים השמורים, התמונות, ההערות, manifest עם SHA-256 לכל קובץ ודוח קריא" data-bundle>
      ${e.can_manage?r`<sw-button size="sm" variant="primary" icon="download" data-bundle-create ?disabled=${this.busy} @click=${()=>void this.run(async()=>{await wc(e.id)},'החבילה נוצרה; פריטים שאינם עותק שמור מופיעים בה כ"לא נכללו"')}>צור חבילת ראיות</sw-button>`:c}
      ${this.bundles.length?r`<div class="items" style="margin-block-start:8px">${this.bundles.map(s=>r`<div class="item" data-bundle-row style="grid-template-columns:minmax(0,1fr) auto"><div class="body"><strong class="ltr">${s.name}</strong><span class="meta">${Ut(s.bytes)} · ${this.fmt(s.created_at)}${s.signed?` · חתום · מפתח ${s.signed}`:" · ללא חתימה"}</span></div><div class="acts"><a href=${gc(e.id,s.name)} download><sw-button size="sm" icon="download">הורדה</sw-button></a></div></div>`)}</div>`:r`<div class="hint" style="margin-block-start:6px">עדיין לא נוצרה חבילה לתיק הזה.</div>`}
      <div class="composer"><sw-field label="אימות חבילה (בחר קובץ ZIP שהורד)"><input type="file" accept=".zip,application/zip" data-bundle-verify-file @change=${s=>void this.verify(s.target.files?.[0])} /></sw-field></div>
      ${t?r`<div class="note" data-bundle-verify-result>${t.ok?`החבילה אומתה: ${t.files.length} קבצים תואמים ל־manifest${t.case?` · תיק "${t.case}"`:""}`:`האימות נכשל${t.errors.length?`: ${t.errors.join(", ")}`:""}`}
            ${t.files.some(s=>s.status!=="ok")||t.extra.length?r`<ul class="hint" style="margin:4px 0 0;padding-inline-start:18px">${t.files.filter(s=>s.status!=="ok").map(s=>r`<li class="ltr">${s.path}: ${s.status}</li>`)}${t.extra.map(s=>r`<li class="ltr">${s}: extra</li>`)}</ul>`:c}
            ${t.signature?r`<div data-bundle-signature data-signature-trust=${t.signature.trust}>${t.signature.present?t.signature.valid?`חתימה תקינה · Ed25519 · מפתח ${t.signature.kid}${t.signature.trust==="installation"?t.signature.retired?" · מפתח שהוחלף, מוכר למתקן זה":" · המפתח הפעיל של מתקן זה":" · מפתח שאינו מוכר למתקן זה — שלמות בלבד, לא אמון"}`:`חתימה לא תקינה${t.signature.reason?` (${t.signature.reason})`:""} — ה־manifest שונה אחרי הייצוא או שהחתימה זויפה.`:"ללא חתימה (חבילה מגרסה ישנה, או שהחתימה הוסרה) — נבדקו רק הגיבובים."}</div>`:c}
            ${t.authenticity?r`<div class="hint" style="margin-block-start:4px">${t.authenticity}</div>`:c}
          </div>`:c}
      <div class="hint" style="margin-block-start:6px">SHA-256 מוכיח שכל קובץ לא השתנה מאז יצירת החבילה; חתימת Ed25519 על ה־manifest מוכיחה שהחבילה לא שונתה מאז הייצוא על ידי מחזיק המפתח של המתקן (integrity-at-export). אף אחד מהם אינו מוכיח את אמיתות הצילום במקור (capture authenticity), ואין כאן הצהרה על קבילות משפטית. אימות מחוץ למערכת: scripts/verify_bundle.py.</div>
    </sw-card>`}renderItem(e,t){const s=e.kind==="event"?`אירוע · ${Y[e.event?.type??"other"]??e.event?.type??""}`:e.kind==="clip"?"קטע הקלטה":e.kind==="snapshot"?"תמונה":"הערה",i=e.preservation,a=e.kind==="event"&&e.event?e.event.occurred_at:e.from_at,n=e.kind==="note"?r`<div class="thumb"><sw-icon name="edit" size=${18}></sw-icon></div>`:e.kind==="snapshot"?r`<img class="thumb" src=${bc(t.id,e.id)} alt="תמונה מהמצלמה" />`:e.kind==="event"&&e.event?.thumbnail==="ready"&&e.event_id?r`<img class="thumb" src=${Mt(e.event_id)} alt="" />`:e.camera_id&&a?r`<img class="thumb" src=${di(e.camera_id,a)} alt="" @error=${o=>o.target.style.visibility="hidden"} />`:r`<div class="thumb"></div>`;return r`<div class="item" data-case-item data-kind=${e.kind} data-preservation=${i}>
      ${n}
      <div class="body">
        <div class="head"><strong>${s}</strong>${e.camera_name?r`<span>· ${e.camera_name}</span>`:c}${i!=="none"?r`<sw-badge kind=${ep[i]} label=${lc[i]}></sw-badge>`:c}</div>
        ${e.from_at&&e.to_at?r`<div class="range ltr">${this.fmt(e.from_at)} → ${this.fmt(e.to_at)}</div>`:c}
        ${e.note?r`<div>${e.note}</div>`:c}
        <div class="meta">${e.added_by_username} · ${this.fmt(e.created_at)}${e.export?.error?` · ייצוא: ${e.export.error}`:""}${i==="missing"?" · לא ניתן לשמר: ההקלטה כבר לא ב־NVR":""}</div>
      </div>
      <div class="acts">
        ${e.camera_id&&a&&e.kind!=="snapshot"?r`<sw-button size="sm" icon="play" @click=${()=>b("/investigate/playback",{camera:e.camera_id??"",t:a})}>נגן</sw-button>`:c}
        ${e.kind==="snapshot"&&e.file_sha256?r`<span class="meta ltr" title="SHA-256">${e.file_sha256.slice(0,12)}…</span>`:c}
        ${e.event_id?r`<sw-button size="sm" variant="ghost" icon="bell" @click=${()=>b(`/investigate/events/${e.event_id}`)}>אירוע</sw-button>`:c}
        ${t.can_manage&&e.kind!=="note"&&(i==="nvr_only"||i==="unknown")?r`<sw-button size="sm" icon="download" data-item-preserve ?disabled=${this.busy} @click=${()=>void this.run(()=>uc(t.id,e.id).then(()=>{}),"עבודת שימור נוצרה; הפריט יסומן כשמור כשההעתקה תסתיים")}>שמור עותק</sw-button>`:c}
        ${e.export?.download_ready?r`<a href=${Wr(e.export.id)} download><sw-button size="sm" variant="ghost" icon="download">הורדה</sw-button></a>`:c}
        ${t.can_manage?r`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="הסר מהתיק" data-item-remove ?disabled=${this.busy} @click=${()=>void this.run(()=>hc(t.id,e.id).then(()=>{}))}></sw-button>`:c}
      </div>
    </div>`}renderApi(){if(this.error&&!this.data)return r`<sw-page heading="תיק"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;const e=this.data;if(!e)return r`<sw-page heading="תיק"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=e.counts;return r`
      <sw-page heading=${e.title} subheading=${`${fs[e.status]} · בעלים: ${e.owner_username} · ${t.items} פריטים · ${t.preserved} עותקים שמורים · עודכן ${this.fmt(e.updated_at)}`} crumbs="חקירה | תיקים" wide>
        ${e.can_manage?r`<sw-field slot="actions"><select aria-label="סטטוס" data-case-status ?disabled=${this.busy} @change=${s=>this.patchCase({status:s.target.value})}>${Object.keys(fs).map(s=>r`<option value=${s} ?selected=${s===e.status}>${fs[s]}</option>`)}</select></sw-field>
              <sw-button slot="actions" icon="edit" data-case-edit @click=${()=>{this.editTitle=e.title,this.editDesc=e.description,this.editTags=e.tags.join(", "),this.editing=!0}}>עריכה</sw-button>
              <sw-button slot="actions" variant="ghost" icon="trash" data-case-delete @click=${()=>this.confirmDelete=!0}>מחיקה</sw-button>`:c}
        <sw-button slot="actions" variant="ghost" icon="list" @click=${()=>b("/investigate/cases")}>לרשימת התיקים</sw-button>
        <div class="wrap">
          ${this.error?r`<div class="err" data-case-error>${this.error}</div>`:c}
          ${this.info?r`<div class="ok" data-case-info>${this.info}</div>`:c}
          ${e.description||e.tags.length?r`<sw-card>${e.description?r`<div class="desc" data-case-description>${e.description}</div>`:c}${e.tags.length?r`<div class="tags">${e.tags.map(s=>r`<sw-chip>${s}</sw-chip>`)}</div>`:c}</sw-card>`:c}
          <sw-card heading="ראיות והערות" subheading=${e.checked?"מצב השימור נבדק מול ה־NVR עכשיו":"מצב השימור לא נבדק מול ה־NVR"}>
            ${e.items.length?r`<div class="items" data-case-items>${e.items.map(s=>this.renderItem(s,e))}</div>`:r`<div class="hint">עדיין אין פריטים בתיק. הוסף מאירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק).</div>`}
            ${e.hidden_items?r`<div class="hint">${e.hidden_items} פריטים ממצלמות שאינן בהרשאתך אינם מוצגים.</div>`:c}
            ${e.can_manage&&e.status!=="closed"?r`<div class="composer"><sw-field label="הערה חדשה"><textarea rows="2" data-note-text .value=${this.noteText} @input=${s=>this.noteText=s.target.value}></textarea></sw-field><sw-button size="sm" icon="plus" data-note-add ?disabled=${this.busy||!this.noteText.trim()} @click=${()=>void this.run(async()=>{await Hi(e.id,{kind:"note",note:this.noteText.trim()}),this.noteText=""})}>הוסף הערה</sw-button></div>
                  <div class="composer"><sw-field label="תמונה ממצלמה לתיק (עותק שמור מיידי)"><select aria-label="מצלמה לצילום" data-snapshot-camera @change=${s=>this.snapCam=s.target.value}>${this.cams.map(s=>r`<option value=${s.id} ?selected=${s.id===this.snapCam}>${s.name}</option>`)}</select></sw-field><sw-button size="sm" icon="camera" data-snapshot-add ?disabled=${this.busy||!this.snapCam} @click=${()=>void this.run(async()=>{await Hi(e.id,{kind:"snapshot",camera_id:this.snapCam})},"התמונה נשמרה בתיק עם ה־hash שלה")}>צלם תמונה לתיק</sw-button></div>`:c}
          </sw-card>
          ${this.renderBundleCard(e)}
          <div class="hint">סימנייה מצביעה על ההקלטה ב־NVR ואינה שימור: קטע נחשב שמור רק אחרי שעבודת ייצוא העתיקה אותו (sha256 ב־manifest). קטע שה־NVR כבר מחק מוצג כחסר ולעולם לא כשמור.</div>
        </div>
        ${this.editing?r`<sw-dialog open heading="עריכת תיק" data-case-edit-dialog @close=${()=>this.editing=!1}>
              <sw-field label="כותרת"><input data-edit-title .value=${this.editTitle} @input=${s=>this.editTitle=s.target.value} /></sw-field>
              <sw-field label="תיאור"><textarea rows="4" data-edit-description .value=${this.editDesc} @input=${s=>this.editDesc=s.target.value}></textarea></sw-field>
              <sw-field label="תגיות (מופרדות בפסיק)"><input .value=${this.editTags} @input=${s=>this.editTags=s.target.value} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.editing=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" icon="check" data-case-edit-save ?disabled=${this.busy||!this.editTitle.trim()} @click=${()=>{this.editing=!1,this.patchCase({title:this.editTitle.trim(),description:this.editDesc,tags:this.editTags.split(",").map(s=>s.trim()).filter(Boolean)})}}>שמירה</sw-button>
            </sw-dialog>`:c}
        ${this.confirmDelete?r`<sw-dialog open heading="מחיקת תיק" subheading="הפריטים בתיק יימחקו; ההקלטות ב־NVR והעותקים שיוצאו נשארים" @close=${()=>this.confirmDelete=!1}>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-case-delete-confirm ?disabled=${this.busy} @click=${()=>{this.confirmDelete=!1,this.run(async()=>{await pc(e.id),b("/investigate/cases")})}}>מחק תיק</sw-button>
            </sw-dialog>`:c}
      </sw-page>
    `}render(){if(g())return this.renderApi();const e=Ti.find(t=>t.id===this.caseId)??Ti[0];return r`
      <sw-page heading="סקירת אירוע" subheading=${`${e.title} · בעלים: ${e.owner} · נתוני הדגמה`} crumbs="אירועים | תיקים | 13.09.2026 10:12 | כניסה ראשית">
        <sw-field slot="actions"><select aria-label="סטטוס"><option>${e.status}</option><option>בבדיקה</option><option>סגור</option></select></sw-field>
        <div class="wrap">
          <div class="video">
            <sw-scene kind="entrance"></sw-scene>
            <span class="stamp">2026-09-13 10:12:04</span>
            <span class="demo">דמו · הקטע ינוגן מהתיק (T050)</span>
            <div class="bar">
              <sw-button variant="ghost" size="sm" iconOnly icon="play" label="נגן"></sw-button>
              <span class="ltr">0:00 / 0:13</span>
              <span class="track"><i></i></span>
              <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="אחורה"></sw-button>
              <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
            </div>
          </div>
          <div class="clips">
            <div class="clip on"><sw-scene kind="entrance"></sw-scene><span class="t">00:00</span></div>
            <div class="clip"><sw-scene kind="lobby"></sw-scene><span class="t">00:06</span></div>
            <div class="clip missing"><span>מסדרון 10:15<br />לא שמור: NVR מחק</span></div>
            <div class="add"><span><sw-icon name="plus" size=${14}></sw-icon> הוסף קטע</span></div>
          </div>
          <sw-tabs .items=${[{id:"details",label:"פרטים"},{id:"notes",label:"הערות",count:2},{id:"related",label:"מצלמות קשורות",count:3}]} .active=${this.tab} @change=${t=>this.tab=t.detail.id}></sw-tabs>
          ${this.tab==="details"?r`<div class="form">
                <div class="stack">
                  <sw-field label="כותרת"><input value=${e.title} /></sw-field>
                  <sw-field label="תיאור"><textarea rows="3">אדם נכנס אחרי פתיחת הדלת ב־10:12. לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).</textarea></sw-field>
                </div>
                <div class="pills">
                  <div class="pill"><sw-icon name="calendar" size=${14}></sw-icon>13.09.2026 · 10:12</div>
                  <div class="pill"><sw-icon name="camera" size=${14}></sw-icon>כניסה ראשית · לובי</div>
                  <div class="pill"><sw-icon name="shield" size=${14}></sw-icon>2/3 ראיות שמורות · sha256</div>
                </div>
              </div>`:this.tab==="notes"?r`<sw-card>
                  <div class="note">נראה אדם נכנס אחרי פתיחת הדלת ב־10:12.<small>יוני · 10:40</small></div>
                  <div class="note">לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).<small>יוסי · 10:52</small></div>
                  <sw-field style="margin-block-start:8px"><textarea rows="2" placeholder="הערה חדשה…"></textarea></sw-field>
                </sw-card>`:r`<div class="clips">
                  <sw-camera-tile compact name="כניסה ראשית" state="recorded" scene="entrance"></sw-camera-tile>
                  <sw-camera-tile compact name="לובי" state="recorded" scene="lobby"></sw-camera-tile>
                  <sw-camera-tile compact name="מסדרון מזרחי" state="unknown"></sw-camera-tile>
                </div>`}
          <div class="foot">
            <sw-button icon="link">שיתוף</sw-button>
            <sw-button variant="primary" icon="download">ייצוא ראיות</sw-button>
          </div>
          <div class="hint">Manifest: clips 2/3 · notes 2 · requested/actual ranges · timezone Asia/Jerusalem · pipeline v0.1 · sha256 לכל קובץ. Hash מוכיח התאמה לקובץ שנשמר, לא אותנטיות מאז המצלמה. "מצלמות מוצעות לחקירה" בלבד: אין קביעה שמדובר באותו אדם.</div>
        </div>
      </sw-page>
    `}};ee.styles=z`
    .wrap {
      max-inline-size: 860px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-2);
      color: #fff;
    }
    .video sw-scene {
      position: absolute;
      inset: 0;
    }
    .video .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .video .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      border-radius: 4px;
      padding: 2px 7px;
    }
    .bar {
      position: absolute;
      inset-inline: 12px;
      inset-block-end: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(17, 24, 39, 0.65);
      backdrop-filter: blur(8px);
      border-radius: var(--sw-r-pill);
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
    }
    .bar sw-button {
      --sw-text-2: #fff;
      --sw-text: #fff;
      --sw-surface-3: rgba(255, 255, 255, 0.14);
    }
    .bar .track {
      flex: 1;
      block-size: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.3);
      overflow: hidden;
    }
    .bar .track i {
      display: block;
      inline-size: 35%;
      block-size: 100%;
      background: #fff;
    }
    .clips {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .clip {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
    }
    .clip sw-scene {
      position: absolute;
      inset: 0;
    }
    .clip.on {
      box-shadow: 0 0 0 2px var(--sw-accent);
    }
    .clip .t {
      position: absolute;
      inset-inline-start: 6px;
      inset-block-end: 5px;
      color: #fff;
      font-size: 10px;
      font-family: var(--sw-font-mono);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .clip.missing {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      text-align: center;
    }
    .add {
      aspect-ratio: 16 / 9;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .form {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(200px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pills {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
    }
    .pill sw-icon {
      color: var(--sw-accent);
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px;
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      background: var(--sw-surface);
    }
    .item[data-preservation='missing'] {
      border-color: var(--sw-danger);
    }
    .item .thumb {
      inline-size: 112px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .item .body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
    }
    .item .head {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .item .range {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .item .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .item .acts {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .composer {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-block-start: 10px;
    }
    .composer sw-field {
      flex: 1;
    }
    .desc {
      white-space: pre-wrap;
      font-size: var(--sw-fs-sm);
    }
    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 6px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    @media (max-width: 767px) {
      .item {
        grid-template-columns: 1fr;
      }
      .item .thumb {
        inline-size: 100%;
      }
    }
    .note {
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .note small {
      color: var(--sw-text-3);
      display: block;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .clips {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .form {
        grid-template-columns: 1fr;
      }
    }
  `;j([m()],ee.prototype,"caseId",2);j([d()],ee.prototype,"tab",2);j([d()],ee.prototype,"data",2);j([d()],ee.prototype,"error",2);j([d()],ee.prototype,"info",2);j([d()],ee.prototype,"busy",2);j([d()],ee.prototype,"tz",2);j([d()],ee.prototype,"noteText",2);j([d()],ee.prototype,"editing",2);j([d()],ee.prototype,"editTitle",2);j([d()],ee.prototype,"editDesc",2);j([d()],ee.prototype,"editTags",2);j([d()],ee.prototype,"confirmDelete",2);j([d()],ee.prototype,"bundles",2);j([d()],ee.prototype,"verifyResult",2);j([d()],ee.prototype,"cams",2);j([d()],ee.prototype,"snapCam",2);ee=j([S("investigate-case-detail")],ee);var ap=Object.defineProperty,rp=Object.getOwnPropertyDescriptor,ci=(e,t,s,i)=>{for(var a=i>1?void 0:i?rp(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ap(t,s,a),a};const qa={queued:"ממתין",running:"מוריד",done:"הושלם",partial:"חלקי",failed:"נכשל",cancelled:"בוטל",interrupted:"הופסק"},np={queued:"neutral",running:"live",done:"recorded",partial:"partial",failed:"error",cancelled:"unknown",interrupted:"stale"};let Qt=class extends x{constructor(){super(...arguments),this.jobs=null,this.ffmpeg=!0,this.error=""}connectedCallback(){super.connectedCallback(),g()&&(this.load(),this.timer=window.setInterval(()=>this.poll(),3e3))}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async load(){try{const e=await Ec();this.jobs=e.jobs,this.ffmpeg=e.ffmpeg,this.error=""}catch(e){this.error=w(e)}}poll(){this.jobs?.some(e=>e.state==="queued"||e.state==="running")&&this.load()}fmt(e,t){return new Intl.DateTimeFormat("he-IL",{timeZone:t,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date(e))}async cancel(e){try{await Pc(e.id),await this.load()}catch(t){this.error=w(t)}}async removeJob(e){try{await Ic(e.id),await this.load()}catch(t){this.error=w(t)}}renderApi(){return this.error&&!this.jobs?r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`:this.jobs?this.jobs.length?r`
      ${this.ffmpeg?c:r`<div class="warn">ffmpeg לא זמין בשרת: קבצי הייצוא נמסרים במיכל המקורי של ה־NVR (Hikvision PS, ניתן לניגון ב־VLC) ולא נחתכים לטווח המדויק.</div>`}
      ${this.error?r`<div class="warn">${this.error}</div>`:c}
      <sw-card>
        ${this.jobs.map(e=>{const t=Math.round((e.progress??0)*100),s=e.files.filter(i=>i.state==="downloaded"||i.state==="remuxed").length;return r`<div class="job">
            <div>
              <div class="title"><strong>${e.camera_name}</strong><sw-badge kind=${np[e.state]} label=${qa[e.state]}></sw-badge></div>
              <div class="meta"><span class="ltr">${this.fmt(e.requested_from,e.timezone)} → ${this.fmt(e.requested_to,e.timezone)}</span> · ${e.files.length} קבצים (${s} ירדו) · משוער ${Ut(e.estimate_bytes)}${e.actual_from?r` · בפועל <span class="ltr">${this.fmt(e.actual_from,e.timezone)} → ${this.fmt(e.actual_to??e.actual_from,e.timezone)}</span>`:c}</div>
              ${e.error?r`<div class="warn">${e.error}</div>`:c}
              ${e.note&&(e.state==="done"||e.state==="partial")?r`<div class="meta">${e.note}</div>`:c}
              ${e.sha256?r`<div class="meta ltr">sha256 ${e.sha256.slice(0,16)}… · ${e.container}</div>`:c}
            </div>
            <div><div class="bar ${e.state==="failed"?"fail":e.state==="partial"?"partial":""}"><i style="inline-size:${t}%"></i></div><div class="meta">${qa[e.state]} · ${t}%${e.state==="running"?` · ${Ut(e.files.reduce((i,a)=>i+a.bytes,0))}`:""}</div></div>
            <div class="actions">
              ${e.download_ready?r`<a href=${Wr(e.id)} download=${e.output_name??""}><sw-button size="sm" icon="download">הורדה</sw-button></a><a href=${Cc(e.id)} target="_blank" rel="noopener"><sw-button size="sm" variant="ghost" icon="list">מניפסט</sw-button></a>`:c}
              ${e.state==="queued"||e.state==="running"?r`<sw-button size="sm" variant="ghost" icon="close" @click=${()=>this.cancel(e)}>בטל</sw-button>`:r`<sw-button size="sm" variant="ghost" icon="trash" @click=${()=>this.removeJob(e)}>מחק</sw-button>`}
            </div>
          </div>`})}
      </sw-card>
      <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר בייצוא, לא שהצילום אותנטי מאז המצלמה. הקבצים נמחקים אוטומטית אחרי תקופת השמירה שבהגדרות.</div>
    `:r`<sw-state-panel state="empty" heading="אין עבודות ייצוא" hint="פתח הקלטה, בחר טווח ולחץ ייצוא."><div style="margin-block-start:10px"><sw-button variant="primary" icon="history" @click=${()=>b("/investigate/playback")}>להקלטות</sw-button></div></sw-state-panel>`:r`<sw-state-panel state="loading"></sw-state-panel>`}renderDemo(){return r`
      <sw-card>
        ${yr.map(e=>r`<div class="job">
            <div><strong>${e.title}</strong><div class="meta">${e.size} · ${e.hash}</div></div>
            <div><div class="bar ${e.status.startsWith("נכשל")?"fail":""}"><i style="inline-size:${e.progress}%"></i></div><div class="meta">${e.status} · ${e.progress}%</div></div>
            <div class="actions">
              ${e.progress===100?r`<sw-button size="sm" icon="download">הורדה</sw-button>`:e.status.startsWith("נכשל")?r`<sw-button size="sm" icon="refresh">נסה שוב</sw-button>`:r`<sw-button size="sm" variant="ghost" icon="close">בטל</sw-button>`}
            </div>
          </div>`)}
      </sw-card>
      <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.</div>
    `}render(){const e=g();return r`
      <sw-page heading="ייצוא והורדות" subheading=${e?"עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה":"עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה · נתוני הדגמה"}>
        <sw-button slot="actions" variant="primary" icon="download" @click=${()=>b("/investigate/playback")}>ייצוא חדש</sw-button>
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};Qt.styles=z`
    .job {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 180px auto;
      gap: var(--sw-s-3);
      align-items: center;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .job:last-child {
      border-block-end: 0;
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    .bar.partial i {
      background: var(--sw-stale);
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .title {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .warn {
      font-size: var(--sw-fs-xs);
      color: #b45309;
    }
    @media (max-width: 767px) {
      .job {
        grid-template-columns: 1fr;
      }
    }
  `;ci([d()],Qt.prototype,"jobs",2);ci([d()],Qt.prototype,"ffmpeg",2);ci([d()],Qt.prototype,"error",2);Qt=ci([S("investigate-exports")],Qt);const op={zone:"חדר / אזור",camera:"מצלמה",floor:"קומה",building:"מבנה",entity:"ישות HA"},lp={zone:"map",camera:"camera",floor:"floor",building:"building",entity:"light"},dp=(e,t=8)=>k(`search?q=${encodeURIComponent(e)}&limit=${t}`),cp=(e,t=30)=>k(`search/semantic?q=${encodeURIComponent(e)}&limit=${t}`),pp=()=>k("search/providers"),hp={person:"אדם",vehicle:"רכב",motion:"תנועה",door:"דלת",line:"חציית קו",field:"חדירה"};var up=Object.defineProperty,mp=Object.getOwnPropertyDescriptor,Ht=(e,t,s,i)=>{for(var a=i>1?void 0:i?mp(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&up(t,s,a),a};const fp=[{scene:"entrance",when:"14.09.2026 10:14",cam:"כניסה ראשית",why:"NVR: זיהוי אדם (Smart)"},{scene:"lobby",when:"14.09.2026 10:13",cam:"לובי",why:"NVR: תנועה + סמיכות במפה לכניסה"},{scene:"parking",when:"14.09.2026 06:43",cam:"חניה מקורה",why:"NVR: חציית קו"},{scene:"entrance",when:"14.09.2026 08:12",cam:"כניסה ראשית",why:"HA: דלת נפתחה + תנועה"},{scene:"corridor",when:"13.09.2026 23:10",cam:"מסדרון מזרחי",why:"NVR: זיהוי אדם"},{scene:"backyard",when:"13.09.2026 18:03",cam:"חצר אחורית",why:"NVR: תנועה"}];let nt=class extends x{constructor(){super(...arguments),this.by="person",this.q="",this.answer=null,this.providers=null,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),g()&&this.loadProviders()}async loadProviders(){try{this.providers=await pp()}catch(e){this.error=w(e)}}async run(){const e=this.q.trim();if(e){this.busy=!0,this.error="";try{this.answer=await cp(e)}catch(t){this.error=w(t)}finally{this.busy=!1}}}fmt(e){try{return new Date(e).toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return e}}renderApi(){const e=this.answer,t=this.providers,s=t?.providers.find(n=>n.id==="local"),i=t?.providers.find(n=>n.id==="external"),a={person:"אדם",vehicle:"רכב",motion:"תנועה",line:"חציית קו",field:"חדירה",door:"דלת",offline:"ניתוק",coverage_gap:"פער כיסוי",other:"אחר"};return r`
      <sw-page heading="חיפוש AI" subheading="שאלה חופשית → מסננים של מרכז האירועים (סוג, מקום, זמן) · baseline מקומי ללא רשת · ספק חיצוני רק ב־opt-in">
        <sw-badge slot="actions" kind=${t?.active==="local"?"live":"unknown"} label=${t?t.active==="local"?`ספק: baseline מקומי · ${s?.model_version??""}`:t.active==="none"?"חיפוש סמנטי כבוי":`ספק: ${t.active}`:"טוען…"}></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" data-semantic-q placeholder="למשל: אדם בלובי אתמול בערב · vehicle near the gate this morning" aria-label="חיפוש" .value=${this.q} @input=${n=>this.q=n.target.value} @keydown=${n=>{n.key==="Enter"&&this.run()}} /></sw-field>
            <sw-button variant="primary" icon="search" data-semantic-run ?disabled=${this.busy||!this.q.trim()} @click=${()=>this.run()}>חפש</sw-button>
          </div>
          ${this.error?r`<div class="note" style="color:var(--sw-danger)">${this.error}</div>`:c}
          ${e?r`<sw-card heading="כך פורשה השאלה" subheading=${`${e.provider.name} · ${e.provider.model_version} · ללא רשת`} data-semantic-parsed>
                  <div class="chips">
                    ${e.parsed.objects.map(n=>r`<sw-chip selected icon="target">${hp[n]??n}</sw-chip>`)}
                    ${e.parsed.places.map(n=>r`<sw-chip selected icon=${n.kind==="camera"?"camera":n.kind==="floor"?"floor":"map"} title=${`התאמה ${n.match==="exact"?"מדויקת":"חלקית"} למונח "${n.term}"`}>${n.name}${n.match==="partial"?" (~)":""}</sw-chip>`)}
                    ${e.parsed.window?r`<sw-chip selected icon="clock">${e.parsed.window.label}</sw-chip>`:c}
                    ${!e.parsed.objects.length&&!e.parsed.places.length&&!e.parsed.window?r`<span class="note">לא זוהה סוג, מקום או זמן — מוצגים אירועי היום בהיקף שלך.</span>`:c}
                  </div>
                  ${e.unsupported.length?r`<div class="note" style="margin-block-start:6px;color:var(--sw-warning, #b45309)" data-semantic-unsupported>לא נתמך ב־baseline המקומי: ${e.unsupported.map(n=>`"${n.term}" — ${n.reason.startsWith("color")?"צבע":"מאפיין מראה"} דורש ספק ניתוח ב־opt-in`).join(" · ")}</div>`:c}
                  ${e.parsed.leftovers.length?r`<div class="note" style="margin-block-start:4px">מילים שלא שימשו: ${e.parsed.leftovers.join(", ")}</div>`:c}
                </sw-card>
                <div class="head"><span>${e.total} התאמות (לפי metadata)</span><a href="#/investigate/events">מרכז האירועים</a></div>
                ${e.results.length?r`<div class="list">${e.results.map(n=>r`<div class="row" data-semantic-result data-confidence=${n.match.confidence} @click=${()=>b(`/investigate/events/${n.id}`)}>
                        <sw-badge kind=${n.match.confidence==="exact"?"live":"stale"} label=${n.match.confidence==="exact"?"התאמה מדויקת":"התאמה חלקית"}></sw-badge>
                        <div class="body"><strong>${a[n.type]??n.type} · ${n.camera_name??"—"}</strong><span class="note">${this.fmt(n.occurred_at)} · ${n.confidence==="measured"?"נמדד במכשיר":"משוער"} · ${n.match.basis.join(" · ")}</span></div>
                      </div>`)}</div>`:r`<div class="note">אין אירועים תואמים בהיקף ובחלון הזמן.</div>`}
                <div class="note" data-semantic-note>${e.note}</div>`:r`<div class="note">כתוב שאלה חופשית בעברית או באנגלית. ה־baseline מבין סוג (אדם/רכב/תנועה/דלת/חצייה/חדירה), מקומות מהקטלוג (חדרים, קומות, מצלמות) וזמן (היום, אתמול, בערב, 08:00–09:30, השבוע).</div>`}
          <sw-card heading="ספקי ניתוח" subheading="מדיניות פרטיות, גרסת מודל, תקציב ו־opt-in הם חלק מהחוזה של כל ספק" data-semantic-provider>
            ${s?r`<div class="prov"><strong>${s.name}</strong> · גרסה ${s.model_version} · ${s.network?"רשת":"ללא רשת"} · תקציב יומי ${s.budget_daily}<div class="note">${s.privacy}</div><div class="note">יכולות: ${s.capabilities.join(", ")}</div></div>`:c}
            ${i?r`<div class="prov" style="margin-block-start:8px"><strong>${i.name}</strong> · ${i.available===!1?"לא זמין":"זמין"} · opt-in נדרש<div class="note">${i.privacy}</div><div class="note">${i.reason??""}</div><div class="note">הגדרות: ai.provider=${t?.settings["ai.provider"]} · ai.privacy_ack=${t?.settings["ai.privacy_ack"]} · ai.budget_daily=${t?.settings["ai.budget_daily"]}</div></div>`:c}
            <div class="actions" style="margin-block-start:8px"><sw-button size="sm" icon="upload" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">חיפוש לפי תמונה</sw-button><sw-button size="sm" icon="aperture" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">השתמש בפריים הנוכחי</sw-button><span class="note">חיפוש לפי תמונה, צבע ומראה אינו פעיל עד שמוגדר ספק עם הסכמה ותקציב.</span></div>
          </sw-card>
        </div>
      </sw-page>
    `}render(){return g()?this.renderApi():r`
      <sw-page heading="חיפוש AI" subheading="מצא בדיוק את מה שאתה מחפש · חיפוש סמנטי רק עם אינדקס אמיתי · נתוני הדגמה">
        <sw-badge slot="actions" kind="unknown" label="אין ספק AI מוגדר · רמה 0 (מטא־דאטה NVR)"></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" value="אדם בכניסה הראשית היום" aria-label="חיפוש" /></sw-field>
            <sw-button variant="primary" icon="search">חפש</sw-button>
          </div>
          <sw-tabs .items=${[{id:"person",label:"אדם"},{id:"vehicle",label:"רכב"},{id:"object",label:"עצם"},{id:"color",label:"צבע"},{id:"time",label:"זמן"},{id:"site",label:"אתר"}]} .active=${this.by} @change=${e=>this.by=e.detail.id}></sw-tabs>
          <sw-card>
            <div class="by">
              <div class="ref"><sw-scene kind="entrance"></sw-scene></div>
              <div class="txt">
                <b>חיפוש לפי ${this.by==="person"?"אדם":this.by==="vehicle"?"רכב":"מאפיין"}</b>
                <p>מציאת הופעות של אותו אדם בכל המצלמות. פורש כ: סוג = אדם · קומה 0 · היום. זיהוי צבע, פנים או טקסט חופשי אינם פעילים עד שמוגדר ספק ומאושר dataset.</p>
                <div class="actions"><sw-button variant="primary" size="sm" icon="upload" disabled>העלאת תמונה</sw-button><sw-button size="sm" icon="aperture" disabled>השתמש בפריים הנוכחי</sw-button><sw-chip selected icon="target">אדם</sw-chip><sw-chip selected icon="floor">קומה 0</sw-chip><sw-chip selected icon="clock">היום</sw-chip></div>
              </div>
            </div>
          </sw-card>
          <div class="head"><span>התאמות (לפי מטא־דאטה)</span><a href="#/investigate/events">הצג הכל</a></div>
          <div class="results">
            ${fp.map(e=>r`<div class="res" @click=${()=>window.location.hash="#/investigate/playback"}><div class="pic"><sw-scene kind=${e.scene}></sw-scene><span class="demo">דמו</span></div><div class="cap">${e.when}<small>${e.cam} · ${e.why}</small></div></div>`)}
          </div>
        </div>
      </sw-page>
    `}};nt.styles=z`
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-line);
      cursor: pointer;
    }
    .row .body {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .prov {
      font-size: var(--sw-fs-sm);
    }
    .wrap {
      max-inline-size: 860px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .by {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .by .ref {
      inline-size: 120px;
      block-size: 90px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    }
    .by .ref sw-scene {
      position: absolute;
      inset: 0;
    }
    .by .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .by b {
      display: block;
      font-size: var(--sw-fs-md);
    }
    .by p {
      margin: 2px 0 10px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .head a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
    }
    .results {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .res {
      cursor: pointer;
    }
    .res .pic {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--sw-shadow-1);
    }
    .res .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .res .pic .demo {
      position: absolute;
      inset-inline-end: 6px;
      inset-block-start: 6px;
      font-size: 9.5px;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .res .cap {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      line-height: 1.35;
    }
    .res .cap small {
      display: block;
      color: var(--sw-text-3);
    }
    .searchrow {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .searchrow sw-field {
      flex: 1;
    }
    @media (max-width: 767px) {
      .results {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;Ht([d()],nt.prototype,"by",2);Ht([d()],nt.prototype,"q",2);Ht([d()],nt.prototype,"answer",2);Ht([d()],nt.prototype,"providers",2);Ht([d()],nt.prototype,"busy",2);Ht([d()],nt.prototype,"error",2);nt=Ht([S("investigate-search")],nt);const wp=()=>({name:"",description:"",enabled:!0,owner:"local",ha_automation_id:null,trigger:{types:[],sources:[],severity_min:"info"},scope:{site_ids:[],building_ids:[],floor_ids:[],zone_ids:[],camera_ids:[],entity_ids:[]},window:{days:[],from:null,to:null},cooldown_s:300,actions:[{kind:"notify",message:""}]}),vp=()=>k("rules"),gp=e=>M("rules",e),Ka=(e,t)=>He(`rules/${e}`,t),bp=e=>me(`rules/${e}`),Ga=(e,t=24)=>M("rules/dry-run",{rule:e,hours:t}),yp=(e=!1)=>k(`rules/alerts${e?"?unacked=true":""}`),$p=e=>M(`rules/alerts/${e}/ack`),Ya={mon:"ב׳",tue:"ג׳",wed:"ד׳",thu:"ה׳",fri:"ו׳",sat:"ש׳",sun:"א׳"},xp={alertstream:"התראת NVR",recording:"נגזר מהקלטה",system:"מערכת",ha:"חיישן HA"};var kp=Object.defineProperty,_p=Object.getOwnPropertyDescriptor,ne=(e,t,s,i)=>{for(var a=i>1?void 0:i?_p(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&kp(t,s,a),a};const Ja={"r-1":{icon:"user",bg:"#eaf0ff",fg:"#2f6bff"},"r-2":{icon:"move",bg:"#e8f8ee",fg:"#16a34a"},"r-3":{icon:"door",bg:"#fff4e0",fg:"#d97706"},"r-4":{icon:"offline",bg:"#fdecec",fg:"#ef4444"}},zp=[{id:"person-night",label:"אדם בלילה",body:{name:"אדם בלילה",description:"זיהוי אדם בשעות הסגירה",trigger:{types:["person"],sources:[],severity_min:"info"},window:{days:[],from:"22:00",to:"06:00"},cooldown_s:300,actions:[{kind:"notify",message:"זוהה אדם בשעות הסגירה"}]}},{id:"camera-offline",label:"מצלמה מנותקת",body:{name:"מצלמה מנותקת",description:"התראה כשמצלמה יורדת מהרשת",trigger:{types:["offline"],sources:[],severity_min:"info"},window:{days:[],from:null,to:null},cooldown_s:1800,actions:[{kind:"notify",message:"מצלמה מנותקת"}]}},{id:"door-after-hours",label:"דלת נפתחה אחרי שעות",body:{name:"דלת נפתחה אחרי שעות",description:"פתיחת דלת מחוץ לשעות הפעילות",trigger:{types:["door"],sources:["ha"],severity_min:"info"},window:{days:[],from:"20:00",to:"07:00"},cooldown_s:600,actions:[{kind:"notify",message:"דלת נפתחה מחוץ לשעות הפעילות"}]}}];let re=class extends x{constructor(){super(...arguments),this.tab="rules",this.rules=[],this.alerts=[],this.unacked=0,this.meta={types:[],sources:[],days:[]},this.error="",this.busy=!1,this.loading=!1,this.editing=null,this.dry=null,this.dryBusy=!1,this.tree=null,this.cams=[],this.zones=[],this.confirmDelete=null,this.tz="Asia/Jerusalem"}connectedCallback(){super.connectedCallback(),g()&&this.load()}async load(){this.loading=!0,this.error="";try{const[e,t]=await Promise.all([vp(),yp()]);if(this.rules=e.rules,this.meta={types:e.types,sources:e.sources,days:e.days},this.alerts=t.alerts,this.unacked=t.unacked,!this.tree){const[s,i]=await Promise.all([yt(),Te()]);this.tree=s,this.cams=i.cameras.filter(a=>a.enabled)}}catch(e){this.error=w(e)}finally{this.loading=!1}}fmt(e){return e?new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,dateStyle:"short",timeStyle:"short"}).format(new Date(e)):"—"}get floors(){return(this.tree?.sites??[]).flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(s=>({id:s.id,name:`${t.name} · ${s.name}`}))))}async run(e){this.busy=!0,this.error="";try{await e(),await this.load()}catch(t){this.error=w(t),t instanceof be&&t.status===409&&await this.load()}finally{this.busy=!1}}openEditor(e){if(this.dry=null,this.zones=[],e){const{id:t,revision:s,alerts:i,created_by_username:a,updated_by_username:n,created_at:o,updated_at:l,last_fired_at:p,...f}=e;this.editing={id:t,revision:s,body:JSON.parse(JSON.stringify(f))},f.scope.floor_ids.length===1&&this.loadZones(f.scope.floor_ids[0])}else this.editing={id:null,revision:0,body:wp()}}async loadZones(e){try{this.zones=(await sl(e)).zones}catch{this.zones=[]}}edit(e){if(!this.editing)return;const t=JSON.parse(JSON.stringify(this.editing.body));e(t),this.editing={...this.editing,body:t}}toggleIn(e,t){const s=e.indexOf(t);s>=0?e.splice(s,1):e.push(t)}async dryRun(){if(this.editing){this.dryBusy=!0,this.error="";try{this.dry=this.editing.id?await Ga({...this.editing.body},24):await Ga(this.editing.body,24)}catch(e){this.error=w(e)}finally{this.dryBusy=!1}}}save(){const e=this.editing;!e||!e.body.name.trim()||this.run(async()=>{e.id?await Ka(e.id,{...e.body,revision:e.revision}):await gp(e.body),this.editing=null,this.dry=null})}summary(e){const t=e.trigger.types.length?e.trigger.types.map(a=>Y[a]??a).join(", "):"כל הסוגים",s=e.scope.floor_ids.length||e.scope.zone_ids.length||e.scope.camera_ids.length||e.scope.building_ids.length||e.scope.site_ids.length?[e.scope.floor_ids.length?`${e.scope.floor_ids.length} קומות`:"",e.scope.zone_ids.length?`${e.scope.zone_ids.length} אזורים`:"",e.scope.camera_ids.length?`${e.scope.camera_ids.length} מצלמות`:""].filter(Boolean).join(" · "):"כל המתקן",i=e.window.from||e.window.to||e.window.days.length?`${e.window.days.map(a=>Ya[a]??a).join("")||"כל יום"} ${e.window.from??"00:00"}–${e.window.to??"24:00"}`:"תמיד";return`${t} · ${s} · ${i} · השהיה ${e.cooldown_s} שנ׳ · ${e.owner==="ha"?`בבעלות HA (${e.ha_automation_id})`:"התראה במערכת"}`}renderEditor(){const e=this.editing;if(!e)return c;const t=e.body,s=this.dry;return r`<sw-dialog open heading=${e.id?"עריכת חוק":"חוק חדש"} subheading="Trigger → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני שמירה" data-rule-dialog @close=${()=>this.editing=null}>
      ${this.error?r`<div class="err">${this.error}</div>`:c}
      ${e.id?c:r`<sw-field label="תבניות (ממלאות את הטופס; אפשר לשנות אחר כך)"><div class="chips">${zp.map(i=>r`<sw-chip data-rule-template=${i.id} @click=${()=>this.edit(a=>Object.assign(a,JSON.parse(JSON.stringify(i.body))))}>${i.label}</sw-chip>`)}</div></sw-field>`}
      <sw-field label="שם"><input data-rule-name .value=${t.name} @input=${i=>this.edit(a=>a.name=i.target.value)} /></sw-field>
      <sw-field label="סוגי אירועים (ריק = הכל)"><div class="chips">${this.meta.types.map(i=>r`<sw-chip data-rule-type=${i} ?selected=${t.trigger.types.includes(i)} @click=${()=>this.edit(a=>this.toggleIn(a.trigger.types,i))}>${Y[i]??i}</sw-chip>`)}</div></sw-field>
      <sw-field label="מקורות (ריק = הכל)"><div class="chips">${this.meta.sources.map(i=>r`<sw-chip ?selected=${t.trigger.sources.includes(i)} @click=${()=>this.edit(a=>this.toggleIn(a.trigger.sources,i))}>${xp[i]??i}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label="חומרה מינימלית"><select @change=${i=>this.edit(a=>a.trigger.severity_min=i.target.value)}>${["info","alert","critical"].map(i=>r`<option value=${i} ?selected=${t.trigger.severity_min===i}>${i==="info"?"מידע":i==="alert"?"התראה":"קריטי"}</option>`)}</select></sw-field>
        <sw-field label="השהיה בין התראות (שניות)"><input type="number" min="0" max="86400" data-rule-cooldown .value=${String(t.cooldown_s)} @input=${i=>this.edit(a=>a.cooldown_s=Math.max(0,Number(i.target.value)||0))} /></sw-field>
      </div>
      <sw-field label="היקף: קומות (ריק = כל המתקן)"><div class="chips">${this.floors.map(i=>r`<sw-chip data-rule-floor=${i.id} ?selected=${t.scope.floor_ids.includes(i.id)} @click=${()=>{this.edit(n=>this.toggleIn(n.scope.floor_ids,i.id));const a=this.editing?.body.scope.floor_ids??[];a.length===1?this.loadZones(a[0]):this.zones=[]}}>${i.name}</sw-chip>`)}</div></sw-field>
      ${this.zones.length?r`<sw-field label="חדרים / אזורים בקומה שנבחרה"><div class="chips">${this.zones.map(i=>r`<sw-chip ?selected=${t.scope.zone_ids.includes(i.id)} @click=${()=>this.edit(a=>this.toggleIn(a.scope.zone_ids,i.id))}>${i.name}</sw-chip>`)}</div></sw-field>`:c}
      <sw-field label="מצלמות ספציפיות (לא חובה)"><div class="chips">${this.cams.map(i=>r`<sw-chip ?selected=${t.scope.camera_ids.includes(i.id)} @click=${()=>this.edit(a=>this.toggleIn(a.scope.camera_ids,i.id))}>${i.name}</sw-chip>`)}</div></sw-field>
      <sw-field label="ימים (ריק = כל יום)"><div class="chips">${this.meta.days.map(i=>r`<sw-chip ?selected=${t.window.days.includes(i)} @click=${()=>this.edit(a=>this.toggleIn(a.window.days,i))}>${Ya[i]??i}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label="משעה (זמן האתר)"><input type="time" data-ltr .value=${t.window.from??""} @change=${i=>this.edit(a=>a.window.from=i.target.value||null)} /></sw-field>
        <sw-field label="עד שעה"><input type="time" data-ltr .value=${t.window.to??""} @change=${i=>this.edit(a=>a.window.to=i.target.value||null)} /></sw-field>
      </div>
      <div class="two">
        <sw-field label="פעולה"><select data-rule-action-kind @change=${i=>this.edit(a=>a.actions=[{...a.actions[0]??{message:""},kind:i.target.value}])}>
          <option value="notify" ?selected=${(t.actions[0]?.kind??"notify")==="notify"}>התראה במערכת</option><option value="ha_notify" ?selected=${t.actions[0]?.kind==="ha_notify"}>התראה דרך Home Assistant (notify)</option>
        </select></sw-field>
        ${t.actions[0]?.kind==="ha_notify"?r`<sw-field label="שירות notify ב־HA (למשל mobile_app_phone)"><input data-ltr data-rule-service placeholder="mobile_app_phone" .value=${t.actions[0]?.service??""} @input=${i=>this.edit(a=>a.actions=[{...a.actions[0],service:i.target.value.trim()}])} /></sw-field>`:c}
      </div>
      <sw-field label="הודעת ההתראה"><input data-rule-message .value=${t.actions[0]?.message??""} @input=${i=>this.edit(a=>a.actions=[{...a.actions[0]??{kind:"notify"},message:i.target.value}])} /></sw-field>
      ${t.actions[0]?.kind==="ha_notify"?r`<div class="hint">התראה דרך HA דורשת את ההרשאה הרגישה "חוקים: התראה דרך Home Assistant" (תפקיד מותאם). ההודעה נשלחת ל־notify.&lt;שירות&gt; עם הכותרת SMPLWISE.</div>`:c}
      <div class="two">
        <sw-field label="בעלות"><select @change=${i=>this.edit(a=>a.owner=i.target.value)}><option value="local" ?selected=${t.owner==="local"}>מקומי (המערכת מפעילה)</option><option value="ha" ?selected=${t.owner==="ha"}>Home Assistant (הפניה בלבד)</option></select></sw-field>
        ${t.owner==="ha"?r`<sw-field label="מזהה אוטומציה ב־HA"><input .value=${t.ha_automation_id??""} @input=${i=>this.edit(a=>a.ha_automation_id=i.target.value||null)} /></sw-field>`:r`<label class="chk"><input type="checkbox" .checked=${t.enabled} @change=${i=>this.edit(a=>a.enabled=i.target.checked)} /> פעיל</label>`}
      </div>
      <div class="hint">הפעולה היחידה בפיילוט: התראה במערכת. אין פקודות למכשירים ואין webhooks; התראה אינה אירוע ולכן חוק לא יכול להזין את עצמו. חוק בבעלות HA אינו מופעל כאן (בעלים אחד לכל אוטומציה).</div>
      <div class="dryhead"><sw-button size="sm" icon="refresh" data-rule-dryrun ?disabled=${this.dryBusy} @click=${()=>this.dryRun()}>${this.dryBusy?"מריץ…":"הרצה יבשה על 24 שעות"}</sw-button>${s?r`<span class="hint" data-dryrun-result>${s.evaluated} אירועים נבדקו · <strong>${s.would_fire.length}</strong> התראות היו נוצרות · ${s.suppressed.length} נחסמו בהשהיה · ${s.not_matched} לא תאמו</span>`:c}</div>
      ${s?r`<div class="dry">${[...s.would_fire.map(i=>({...i,fire:!0})),...s.suppressed.map(i=>({...i,fire:!1}))].sort((i,a)=>i.occurred_at.localeCompare(a.occurred_at)).slice(0,40).map(i=>r`<div class="dryrow" data-dryrun-row data-fire=${i.fire?"true":"false"}><span class="ltr">${this.fmt(i.occurred_at)}</span><span>${Y[i.type]??i.type} · ${i.camera_name??"—"}</span><span class="hint">${i.fire?i.reasons.join(" · "):`נחסם: ${i.suppressed}`}</span></div>`)}${s.would_fire.length+s.suppressed.length>40?r`<div class="hint">מוצגות 40 הראשונות</div>`:c}<div class="hint">${s.note}</div></div>`:c}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.editing=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-rule-save ?disabled=${this.busy||!t.name.trim()} @click=${()=>this.save()}>${e.id?"שמירה":"צור חוק"}</sw-button>
    </sw-dialog>`}renderApi(){return this.error&&!this.rules.length&&!this.editing?r`<sw-page heading="התראות וחוקי אוטומציה"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`:r`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני הפעלה · אין פקודות למכשירים">
        <sw-button slot="actions" variant="primary" icon="plus" data-rule-new @click=${()=>this.openEditor()}>חוק חדש</sw-button>
        <sw-tabs .items=${[{id:"rules",label:"חוקים",count:this.rules.length},{id:"alerts",label:"התראות",count:this.unacked}]} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        ${this.error&&!this.editing?r`<div class="err">${this.error}</div>`:c}
        ${this.tab==="rules"?this.loading&&!this.rules.length?r`<sw-state-panel state="loading"></sw-state-panel>`:this.rules.length?r`<div class="list">${this.rules.map(e=>r`<sw-card flush class="rule" data-rule-row data-rule-id=${e.id} style="--bg:#eaf0ff;--fg:#2f6bff">
                    <div class="ic"><sw-icon name=${e.owner==="ha"?"home":"bell"} size=${16}></sw-icon></div>
                    <div class="txt"><b>${e.name}</b><small>${this.summary(e)}</small><small>התראות: ${e.alerts.open} פתוחות מתוך ${e.alerts.total} · שונה על ידי ${e.updated_by_username??e.created_by_username??"—"} ${this.fmt(e.updated_at)}</small></div>
                    <span class="last">הופעל: ${e.last_fired_at?this.fmt(e.last_fired_at):"—"}</span>
                    <sw-toggle ?checked=${e.enabled} ?disabled=${this.busy||e.owner==="ha"} labelHidden label="פעיל" data-rule-toggle @change=${t=>void this.run(async()=>{const{id:s,revision:i,alerts:a,created_by_username:n,updated_by_username:o,created_at:l,updated_at:p,last_fired_at:f,...u}=e;await Ka(s,{...u,enabled:t.detail.checked,revision:i})})}></sw-toggle>
                    <sw-button size="sm" data-rule-edit @click=${()=>this.openEditor(e)}>עריכה</sw-button>
                    <sw-button variant="ghost" size="sm" iconOnly icon="trash" label="מחיקה" data-rule-delete @click=${()=>this.confirmDelete=e}></sw-button>
                  </sw-card>`)}</div>`:r`<sw-state-panel state="empty" heading="אין חוקים עדיין" hint="חוק בודק אירועים שכבר נשמרו ומייצר התראה במערכת; הרץ הרצה יבשה לפני שמירה."></sw-state-panel>`:r`<div class="list">${this.alerts.length?this.alerts.map(e=>r`<sw-card flush class="rule" data-alert-row data-acked=${e.acked_at?"true":"false"} style="--bg:${e.acked_at?"#f1f5f9":"#fff4e0"};--fg:${e.acked_at?"#64748b":"#d97706"}">
                  <div class="ic"><sw-icon name="bell" size=${16}></sw-icon></div>
                  <div class="txt"><b>${e.message||e.rule_name}</b><small>${e.rule_name} · ${e.camera_id?`מצלמה ${e.camera_id}`:e.entity_id??""} · <span class="ltr">${this.fmt(e.fired_at)}</span></small><small>${e.reasons.join(" · ")}</small></div>
                  <a href=${`#/investigate/events/${e.event_id}`}><sw-button size="sm" variant="ghost" icon="bell">לאירוע</sw-button></a>
                  ${e.acked_at?r`<span class="last">טופל · ${e.acked_by_username??""}</span>`:r`<sw-button size="sm" icon="check" data-alert-ack ?disabled=${this.busy} @click=${()=>void this.run(async()=>{await $p(e.id)})}>סמן כטופל</sw-button>`}
                </sw-card>`):r`<sw-state-panel state="empty" heading="אין התראות" hint="התראות נוצרות כשאירוע חדש תואם חוק פעיל."></sw-state-panel>`}</div>`}
        ${this.renderEditor()}
        ${this.confirmDelete?r`<sw-dialog open heading="מחיקת חוק" subheading=${this.confirmDelete.name} @close=${()=>this.confirmDelete=null}>
              <div class="hint">ההתראות של החוק יימחקו יחד איתו; האירועים עצמם נשארים.</div>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=null}>ביטול</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-rule-delete-confirm @click=${()=>{const e=this.confirmDelete;this.confirmDelete=null,this.run(async()=>{await bp(e.id)})}}>מחק</sw-button>
            </sw-dialog>`:c}
      </sw-page>
    `}render(){return g()?this.renderApi():r`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus" @click=${()=>b("/investigate/rules/new")}>חוק חדש</sw-button>
        <sw-tabs .items=${[{id:"rules",label:"חוקים",count:Oi.length},{id:"notif",label:"התראות"},{id:"sched",label:"לוחות זמנים"},{id:"trig",label:"Triggers"}]} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        ${this.tab==="rules"?r`<div class="list">
              ${Oi.map(e=>{const t=Ja[e.id]??Ja["r-1"];return r`<sw-card flush class="rule" style="--bg:${t.bg};--fg:${t.fg}">
                  <div class="ic"><sw-icon .name=${t.icon} size=${16}></sw-icon></div>
                  <div class="txt"><b>${e.name}</b><small>${e.trigger} · ${e.scope} · ${e.action}</small></div>
                  <span class="last">הופעל: ${e.last}</span>
                  <sw-toggle ?checked=${e.enabled} label=""></sw-toggle>
                  <sw-button size="sm" @click=${()=>b(`/investigate/rules/${e.id}`)}>עריכה</sw-button>
                  <sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>
                </sw-card>`})}
            </div>`:r`<sw-card><div class="empty">${this.tab==="notif"?"ערוצי התראה: Push דרך HA, מייל (Beta). ההגדרה מגיעה עם T063.":this.tab==="sched"?"לוחות זמנים בזמן האתר (Asia/Jerusalem), שעון קיץ לפי התאריך.":"Triggers זמינים: אירועי NVR (אדם, רכב, תנועה, חציית קו, ניתוק) ושינויי מצב HA (allowlist)."}</div></sw-card>`}
      </sw-page>
    `}};re.styles=z`
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-inline-size: 860px;
    }
    .rule {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 9px;
      background: var(--bg);
      color: var(--fg);
      flex-shrink: 0;
    }
    .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .txt b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .txt small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .last {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .empty {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      padding: 24px;
      text-align: center;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      align-self: end;
      padding-block-end: 8px;
    }
    .dryhead {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .dry {
      display: flex;
      flex-direction: column;
      max-block-size: 220px;
      overflow: auto;
    }
    .dryrow {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 8px;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
    }
    .dryrow[data-fire='false'] {
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    @media (max-width: 767px) {
      .last {
        display: none;
      }
      .two {
        grid-template-columns: 1fr;
      }
    }
  `;ne([d()],re.prototype,"tab",2);ne([d()],re.prototype,"rules",2);ne([d()],re.prototype,"alerts",2);ne([d()],re.prototype,"unacked",2);ne([d()],re.prototype,"meta",2);ne([d()],re.prototype,"error",2);ne([d()],re.prototype,"busy",2);ne([d()],re.prototype,"loading",2);ne([d()],re.prototype,"editing",2);ne([d()],re.prototype,"dry",2);ne([d()],re.prototype,"dryBusy",2);ne([d()],re.prototype,"tree",2);ne([d()],re.prototype,"cams",2);ne([d()],re.prototype,"zones",2);ne([d()],re.prototype,"confirmDelete",2);re=ne([S("investigate-rules")],re);let Ys=class extends x{constructor(){super(...arguments),this.ruleId="r-1"}render(){const e=Oi.find(t=>t.id===this.ruleId)??{name:"חוק חדש",trigger:"זיהוי אדם",scope:"חוץ",action:"התראה"};return r`
      <sw-page heading=${e.name} subheading="עורך חוק · גרסה 2 · נתוני הדגמה" crumbs="אירועים | חוקים והתראות">
        <sw-button slot="actions" icon="play">בדיקה יבשה</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">שמירה</sw-button>
        <sw-steps .steps=${["Trigger","היקף","תנאים","פעולה"]} .current=${1}></sw-steps>
        <div class="layout">
          <div class="stack">
            <sw-card heading="Trigger">
              <div class="two">
                <sw-field label="מקור"><select><option>אירוע NVR</option><option>שינוי HA</option></select></sw-field>
                <sw-field label="סוג"><select><option>${e.trigger}</option><option>זיהוי רכב</option><option>תנועה</option></select></sw-field>
              </div>
            </sw-card>
            <sw-card heading="היקף">
              <div class="two">
                <sw-field label="היקף"><select><option>${e.scope}</option><option>כל האתר</option></select></sw-field>
                <sw-field label="לוח זמנים (זמן האתר)"><input value="22:00–06:00" data-ltr /></sw-field>
              </div>
            </sw-card>
            <sw-card heading="תנאים">
              <sw-field label="חלון סמיכות"><input value="90 שניות" /></sw-field>
              <div class="hint">״אירועים סמוכים בזמן ובאזור״, לא הוכחה סיבתית. החלון מתחשב באיחור שעון ובזמן קליטה.</div>
            </sw-card>
            <sw-card heading="פעולה">
              <div class="two">
                <sw-field label="פעולה"><select><option>${e.action}</option><option>Push דרך HA</option><option>פתיחת תצוגת מצלמות</option></select></sw-field>
                <sw-field label="Cooldown"><input value="5 דקות" /></sw-field>
              </div>
              <div class="hint">unlock / disarm אינם מופעלים על סמך תוצאת AI. שליטה אוטומטית היא opt-in לפי allowlist.</div>
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading="בדיקה יבשה על 24 שעות">
              <div class="dry">10:14 · כניסה ראשית · <sw-badge kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="dry">09:42 · חצר · <sw-badge kind="neutral" label="מחוץ ללוח הזמנים"></sw-badge></div>
              <div class="dry">אתמול 23:10 · לובי · <sw-badge kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="hint" style="margin-block-start:8px">2 הפעלות · 0 כפילויות · correlation id לכל אירוע · מניעת לולאה: פעולה שיצרה אירוע לא מפעילה את אותו חוק.</div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `}};Ys.styles=z`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dry {
      font-size: var(--sw-fs-sm);
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;ne([m()],Ys.prototype,"ruleId",2);Ys=ne([S("investigate-rule-editor")],Ys);const Sp=()=>k("identity/users"),Mp=()=>M("identity/sync"),ls=()=>k("access/roles"),Xa=e=>M("access/bindings",e),Ap=e=>me(`access/bindings/${e}`),Ep=()=>k("access/groups"),Pp=e=>M("access/groups",{name:e}),Ip=e=>me(`access/groups/${e}`),Cp=(e,t)=>Me(`access/groups/${e}/members`,{user_ids:t}),Tp=e=>M("access/preview",e),Qa=(e={})=>{const t=new URLSearchParams;e.prefix&&t.set("prefix",e.prefix),e.actor&&t.set("actor",e.actor),e.resourceId&&t.set("resource_id",e.resourceId),e.limit&&t.set("limit",String(e.limit));const s=t.toString();return k(`audit${s?`?${s}`:""}`)},er={verified:"מסונכרן",stale:"סנכרון מיושן",removed:"מושבת / נמחק ב־HA",unavailable:"לא בספריית HA",unknown:"טרם סונכרן",dev:"משתמש פיתוח"},Op={"rbac.bind":"שיוך תפקיד","rbac.unbind":"ביטול שיוך","rbac.group_create":"יצירת קבוצה","rbac.group_members":"שינוי חברי קבוצה","rbac.group_delete":"מחיקת קבוצה","rbac.bootstrap_admin":"מנהל ראשון (bootstrap)","identity.user_disabled":"משתמש הושבת (HA)","identity.user_enabled":"משתמש הופעל (HA)","identity.sync":"סנכרון ספרייה"};function pt(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString("he-IL",{dateStyle:"short",timeStyle:"short"})}const Dp=e=>M("access/roles",e),Rp=(e,t)=>He(`access/roles/${e}`,t),Np=e=>me(`access/roles/${e}`),Bp=e=>M("access/roles/preview",e),Lp=e=>Me("access/delegation",{delegable_roles:e});var Hp=Object.defineProperty,Vp=Object.getOwnPropertyDescriptor,q=(e,t,s,i)=>{for(var a=i>1?void 0:i?Vp(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Hp(t,s,a),a};const jp=[{id:"users",label:"משתמשים",count:Ci.length},{id:"groups",label:"קבוצות",count:vr.length},{id:"roles",label:"תפקידים",count:gr.length},{id:"effective",label:"הרשאות אפקטיביות"},{id:"audit",label:"אודיט הרשאות"}];let U=class extends x{constructor(){super(...arguments),this.tab="users",this.selected=null,this.assigning=!1,this.step=0,this.directory=null,this.roles=null,this.groups=null,this.tree=null,this.audit=null,this.selectedGroup=null,this.wizard=null,this.members=null,this.newGroup="",this.preview=null,this.previewUser="",this.previewScope="installation:*",this.busy=!1,this.error="",this.message="",this.forbidden=!1,this.roleEdit=null,this.roleImpact=null,this.roleDelete=null,this.roleImpactTimer=0,this.userColumns=[{key:"name",label:"שם",render:e=>r`<div class="who"><sw-avatar name=${String(e.name)} size=${30}></sw-avatar><div><strong>${String(e.name)}</strong>${e.haAdmin?r` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:""}<div class="ltr sub">${String(e.haUser)}@ha.local</div></div></div>`},{key:"role",label:"תפקיד",render:e=>{const t=e.bindings[0];return t?r`<span class="pillsel">${t.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:r`<span class="pillsel" style="color:var(--sw-text-3)">ללא שיוך<sw-icon name="chevronDown" size=${11}></sw-icon></span>`}},{key:"scope",label:"היקף גישה",render:e=>{const t=e.bindings[0];return t?r`<span class="pillsel">${t.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:r`<span class="sub">—</span>`}},{key:"active",label:"מצב",render:e=>r`<span class="status ${e.active?"":"off"}"><i></i>${e.active?"פעיל":"מושבת ב־HA"}</span>`},{key:"lastSync",label:"סנכרון"},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),g()&&this.load()}async load(){this.error="";try{const[e,t,s,i]=await Promise.all([Sp(),ls(),Ep(),yt()]);this.directory=e,this.roles=t,this.groups=s.groups,this.tree=i,this.forbidden=!1,this.previewUser||(this.previewUser=st.me?.user.id??"")}catch(e){const t=w(e);this.error=t,this.forbidden=/403|הרשאה|forbidden/i.test(t)&&!this.directory}}async loadAudit(){try{const[e,t]=await Promise.all([Qa({prefix:"rbac.",limit:100}),Qa({prefix:"identity.",limit:50})]);this.audit=[...e.rows,...t.rows].sort((s,i)=>s.at<i.at?1:-1).slice(0,150)}catch(e){this.error=w(e),this.audit=[]}}flash(e){this.message=e,setTimeout(()=>this.message="",3500)}get scopeOptions(){const e=[{type:"installation",id:"*",name:"כל ההתקנה"}];for(const t of this.tree?.sites??[]){e.push({type:"site",id:t.id,name:`אתר · ${t.name}`});for(const s of t.buildings??[]){e.push({type:"building",id:s.id,name:`${t.name} · ${s.name}`});for(const i of s.floors??[])e.push({type:"floor",id:i.id,name:`${t.name} · ${s.name} · ${i.name}`})}}return e}userName(e){return this.directory?.users.find(t=>t.id===e)?.name??e}label(e){return this.roles?.labels[e]??e}startWizard(e,t,s){this.wizard={subjectKind:e,subjectId:t,subjectName:s,roleId:"viewer",scopeKey:"installation:*",effect:"allow"}}async saveWizard(){const e=this.wizard;if(!e)return;const[t,s]=e.scopeKey.split(":");this.busy=!0,this.error="";try{const i=await Xa({subject_kind:e.subjectKind,subject_id:e.subjectId,role_id:e.roleId,scope_type:t,scope_id:s,effect:e.effect});this.flash(e.effect==="deny"?`נחסם: ${i.role_name} · ${i.scope_name} (רוויזיה ${i.revision})`:`שויך: ${i.role_name} · ${i.scope_name} (רוויזיה ${i.revision})`),this.wizard=null,await this.load()}catch(i){this.error=w(i)}finally{this.busy=!1}}async revoke(e){this.busy=!0,this.error="";try{await Ap(e.id),this.flash(`בוטל: ${e.role_name} · ${e.scope_name}`),await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}async sync(){this.busy=!0,this.error="";try{const e=await Mp();this.flash(e.requested?"הספרייה נדחפה מ־Home Assistant":e.note??"הספרייה מתעדכנת אוטומטית כל דקה"),await this.load()}catch(e){this.error=w(e)}finally{this.busy=!1}}async addGroup(){const e=this.newGroup.trim();if(e){this.busy=!0,this.error="";try{const t=await Pp(e);this.newGroup="",this.flash(`נוצרה קבוצה "${t.name}"`),await this.load(),this.selectedGroup=t.id}catch(t){this.error=w(t)}finally{this.busy=!1}}}async saveMembers(e){if(this.members){this.busy=!0,this.error="";try{await Cp(e.id,[...this.members]),this.members=null,this.flash("חברי הקבוצה עודכנו"),await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}}async removeGroup(e){this.busy=!0,this.error="";try{await Ip(e.id),this.selectedGroup=null,this.flash(`הקבוצה "${e.name}" נמחקה והשיוכים שלה בוטלו`),await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}async runPreview(){if(!this.previewUser)return;const[e,t]=this.previewScope.split(":");this.busy=!0,this.error="";try{this.preview=await Tp({user_id:this.previewUser,scope_type:e,scope_id:t})}catch(s){this.error=w(s)}finally{this.busy=!1}}renderBindingRow(e,t){return r`<div class="bind">
      <div><strong>${e.role_name}</strong> · ${e.scope_name}${e.effect==="deny"?r` <sw-badge kind="forbidden" label="חסימה"></sw-badge>`:c}<div class="sub">${e.via_group?`דרך קבוצה "${e.via_group}" · `:""}מאז ${pt(e.created_at)}${e.expires_at?` · עד ${pt(e.expires_at)}`:""} · רוויזיה ${e.permission_revision}</div></div>
      ${t&&!e.via_group?r`<sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.busy} @click=${()=>this.revoke(e)}>ביטול</sw-button>`:c}
    </div>`}renderWizard(){const e=this.wizard;if(!e||!this.roles)return c;const t=this.roles.roles.find(n=>n.id===e.roleId),s=this.scopeOptions.find(n=>`${n.type}:${n.id}`===e.scopeKey),i=t?.system_role??!1,a=e.effect==="deny";return r`<div class="wiz">
      <sw-steps .steps=${["תפקיד","היקף","תצוגה מקדימה","שמירה"]} .current=${2}></sw-steps>
      <div class="hint">שיוך ל${e.subjectKind==="group"?"קבוצה":"משתמש"}: <strong>${e.subjectName}</strong></div>
      <sw-field label="סוג שיוך"><select data-wizard-effect @change=${n=>this.wizard={...e,effect:n.target.value}}>
          <option value="allow" ?selected=${!a}>הרשאה — מוסיף את הרשאות התפקיד בהיקף</option>
          <option value="deny" ?selected=${a}>חסימה — מסיר את הרשאות התפקיד בהיקף, גם אם שיוך אחר מרשה</option>
        </select></sw-field>
      <sw-field label="תפקיד"><select @change=${n=>this.wizard={...e,roleId:n.target.value}}>${this.roles.roles.map(n=>r`<option value=${n.id} ?selected=${n.id===e.roleId}>${n.name}</option>`)}</select></sw-field>
      <sw-field label="היקף"><select @change=${n=>this.wizard={...e,scopeKey:n.target.value}}>${this.scopeOptions.map(n=>r`<option value=${`${n.type}:${n.id}`} ?selected=${`${n.type}:${n.id}`===e.scopeKey} ?disabled=${i&&n.type!=="installation"}>${n.name}</option>`)}</select></sw-field>
      ${t?a?r`<div class="eff">
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">ייחסמו ב־${s?.name??"ההיקף"}</div>${t.permissions.map(n=>r`<div class="row"><span>${this.label(n)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
              <div class="hint" style="align-self:start">חסימה פועלת רק על ההרשאות שהתפקיד הזה מקנה, ורק בהיקף שנבחר. היא גוברת על כל שיוך "הרשאה" אחר לאותו משתמש באותה הרשאה ובאותו היקף (או היקף שמכיל אותו) — לא על שיוכים בהיקפים לא קשורים.</div>
            </div>`:r`<div class="eff">
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר ב־${s?.name??"ההיקף"}</div>${t.permissions.map(n=>r`<div class="row"><span>${this.label(n)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">לא כלול / מחוץ להיקף</div>${t.sensitive_missing.map(n=>r`<div class="row"><span>${this.label(n)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}<div class="row"><span>כל היקף אחר</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
            </div>`:c}
      ${i?r`<div class="hint">תפקיד עם הרשאות מערכת מוקצה רק ברמת ההתקנה כולה.</div>`:c}
      <div class="hint">הרשאות בתוך SMPLWISE בלבד. שום דבר לא נכתב ל־Home Assistant. השינוי נרשם באודיט עם diff לפני/אחרי.</div>
    </div>`}renderUsersApi(){const e=this.directory,t=e.can_assign,s=[{key:"name",label:"שם",render:a=>r`<div style="display:flex;align-items:center;gap:10px"><sw-avatar name=${String(a.name)} size=${30}></sw-avatar><div><strong>${String(a.name)}</strong>${a.is_admin?r` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:c}${a.is_self?r` <sw-badge kind="recorded" label="אני"></sw-badge>`:c}<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3);direction:ltr;text-align:start">${String(a.username||a.id)}</div></div></div>`},{key:"bindings",label:"תפקיד · היקף",render:a=>{const n=a.bindings;return n.length?r`${n.slice(0,2).map(o=>r`<div style="font-size:var(--sw-fs-xs)"><strong>${o.role_name}</strong> · ${o.scope_name}${o.via_group?" (קבוצה)":""}</div>`)}${n.length>2?r`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">+${n.length-2}</div>`:c}`:r`<span style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">ללא שיוך · אין גישה לתוכן</span>`}},{key:"groups",label:"קבוצות",render:a=>r`<span style="font-size:var(--sw-fs-xs)">${a.groups.map(n=>n.name).join(", ")||"—"}</span>`},{key:"active",label:"מצב",render:a=>r`<span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-xs)"><i style="inline-size:7px;block-size:7px;border-radius:50%;background:${a.active?"var(--sw-live)":"var(--sw-offline)"}"></i>${a.active?"פעיל":"ללא גישה (HA)"}</span>`},{key:"sync_status",label:"סנכרון",render:a=>r`<span style="font-size:var(--sw-fs-xs)">${er[a.sync_status]}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${a.last_seen_at?`נראה ${pt(String(a.last_seen_at))}`:"טרם נכנס"}</div>`}],i=e.users.find(a=>a.id===this.selected)??null;return r`
      <div class="stage">
        ${e.users.length?r`<sw-table .columns=${s} .rows=${e.users} .selected=${this.selected} @row-select=${a=>{this.selected=a.detail.id,this.wizard=null}}></sw-table>`:r`<sw-state-panel state="empty" heading="אין משתמשים עדיין" hint=${e.directory.paired?"הספרייה תגיע מהגשר תוך דקה.":"צמד את גשר SMPLWISE ב־Home Assistant כדי לקבל את רשימת המשתמשים."}></sw-state-panel>`}
        ${i?r`<sw-drawer open heading=${i.name} subheading=${`Home Assistant · ${i.username||i.id} · ${i.active?"פעיל":"ללא גישה"}`} @close=${()=>{this.selected=null,this.wizard=null}}>
              ${this.wizard&&this.wizard.subjectKind==="user"?this.renderWizard():r`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${i.id}</span></dd>
                    <dt>סנכרון</dt><dd>${er[i.sync_status]}${i.synced_at?` · ${pt(i.synced_at)}`:""}</dd>
                    <dt>ב־VMS</dt><dd>${i.first_seen_at?`מאז ${pt(i.first_seen_at)} · לאחרונה ${pt(i.last_seen_at)}`:"טרם נכנס לממשק"}</dd>
                    <dt>מנהל HA</dt><dd>${i.is_admin?"כן · מידע בלבד, לא תפקיד VMS":"לא"}</dd>
                    <dt>קבוצות</dt><dd>${i.groups.map(a=>a.name).join(", ")||"—"}</dd>
                  </dl>
                  <div style="margin-block-start:10px;font-weight:600;font-size:var(--sw-fs-xs)">שיוכים</div>
                  ${i.bindings.length?i.bindings.map(a=>this.renderBindingRow(a,t)):r`<div class="hint">ללא שיוך: אין גישה לתוכן.</div>`}
                  <div class="hint" style="margin-block-start:8px">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד VMS אוטומטית.</div>`}
              <div slot="footer">
                ${this.wizard?r`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>ביטול</sw-button>`:r`${t?r`<sw-button variant="primary" size="sm" icon="plus" @click=${()=>this.startWizard("user",i.id,i.name)}>שיוך תפקיד</sw-button>`:c}
                    <sw-button variant="ghost" size="sm" icon="shield" @click=${()=>{this.previewUser=i.id,this.tab="effective",this.runPreview()}}>הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`:c}
      </div>
    `}renderGroupsApi(){const e=this.groups??[],t=this.directory,s=t.can_assign,i=[{key:"name",label:"קבוצה",render:o=>r`<strong>${String(o.name)}</strong>`},{key:"members",label:"חברים",render:o=>r`${o.members.length}`},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:o=>r`${o.bindings.map(l=>r`<div style="font-size:var(--sw-fs-xs)">${l.role_name} · ${l.scope_name}</div>`)}`}],a=e.find(o=>o.id===this.selectedGroup)??null,n=this.members??new Set(a?.members.map(o=>o.id)??[]);return r`
      ${s?r`<div class="toolbar"><sw-field label="קבוצה חדשה"><input .value=${this.newGroup} placeholder="למשל: עורכי קומה 2" @input=${o=>this.newGroup=o.target.value} @keydown=${o=>{o.key==="Enter"&&this.addGroup()}} /></sw-field><sw-button size="sm" icon="plus" ?disabled=${this.busy||!this.newGroup.trim()} @click=${()=>this.addGroup()}>יצירה</sw-button></div>`:c}
      <div class="stage">
        ${e.length?r`<sw-table .columns=${i} .rows=${e} .selected=${this.selectedGroup} @row-select=${o=>{this.selectedGroup=o.detail.id,this.members=null,this.wizard=null}}></sw-table>`:r`<sw-state-panel state="empty" heading="אין קבוצות" hint="קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו. קבוצות VMS בלבד, לא קבוצות HA."></sw-state-panel>`}
        ${a?r`<sw-drawer open heading=${a.name} subheading=${`${a.members.length} חברים · ${a.bindings.length} שיוכים`} @close=${()=>{this.selectedGroup=null,this.members=null,this.wizard=null}}>
              ${this.wizard&&this.wizard.subjectKind==="group"?this.renderWizard():r`<div style="font-weight:600;font-size:var(--sw-fs-xs);margin-block-end:4px">שיוכים של הקבוצה</div>
                  ${a.bindings.length?a.bindings.map(o=>this.renderBindingRow(o,s)):r`<div class="hint">ללא שיוך: החברים אינם מקבלים דבר דרך הקבוצה.</div>`}
                  <div style="font-weight:600;font-size:var(--sw-fs-xs);margin-block:10px 4px">חברים</div>
                  <div class="members">${t.users.map(o=>r`<label><input type="checkbox" ?disabled=${!s} .checked=${n.has(o.id)} @change=${l=>{const p=new Set(n);l.target.checked?p.add(o.id):p.delete(o.id),this.members=p}} /> ${o.name}<span class="hint">${o.active?"":" · ללא גישה"}</span></label>`)}</div>
                  <div class="hint" style="margin-block-start:8px">שינוי חברות נבדק מול כל השיוכים של הקבוצה ונרשם באודיט.</div>`}
              <div slot="footer">
                ${this.wizard?r`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>ביטול</sw-button>`:s?r`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy||!this.members} @click=${()=>this.saveMembers(a)}>שמור חברים</sw-button>
                      <sw-button size="sm" icon="plus" ?disabled=${this.busy} @click=${()=>this.startWizard("group",a.id,a.name)}>שיוך תפקיד</sw-button>
                      <sw-button variant="danger" size="sm" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeGroup(a)}>מחיקה</sw-button>`:c}
              </div>
            </sw-drawer>`:c}
      </div>
    `}openRole(e){this.roleImpact=null;const t=new Set(this.roles?.sensitive??[]);this.roleEdit=e?{id:e.id,revision:e.revision??1,name:e.name,description:e.description??"",permissions:e.permissions.filter(s=>!t.has(s)),sensitive:e.permissions.filter(s=>t.has(s)),delegable:!!e.delegable}:{id:null,revision:0,name:"",description:"",permissions:["map.read"],sensitive:[],delegable:!1},this.scheduleImpact()}toggleRolePerm(e,t){const s=this.roleEdit;if(!s)return;const i=t?"sensitive":"permissions",a=s[i].includes(e)?s[i].filter(n=>n!==e):[...s[i],e];this.roleEdit={...s,[i]:a},this.scheduleImpact()}scheduleImpact(){window.clearTimeout(this.roleImpactTimer),this.roleImpactTimer=window.setTimeout(()=>void this.loadImpact(),300)}async loadImpact(){const e=this.roleEdit;if(!e||!e.permissions.length&&!e.sensitive.length){this.roleImpact=null;return}try{this.roleImpact=await Bp({role_id:e.id,permissions:e.permissions,sensitive:e.sensitive})}catch(t){this.error=w(t)}}async saveRole(){const e=this.roleEdit;if(!(!e||!e.name.trim())){this.busy=!0,this.error="";try{const t={name:e.name.trim(),description:e.description,permissions:e.permissions,sensitive:e.sensitive,delegable:e.delegable};if(e.id){await Rp(e.id,{...t,revision:e.revision}),this.roleEdit=null,this.roleImpact=null,this.message="התפקיד עודכן; השינוי חל על כל המשויכים ברענון הבא",this.roles=await ls();return}const s=await Dp(t);this.roleEdit=null,this.roleImpact=null,this.roles=await ls();const i=st.me?.user.id;if(e.assignMe!==!1&&i)try{await Xa({subject_kind:"user",subject_id:i,role_id:s.id,scope_type:"installation",scope_id:"*"}),this.message=`התפקיד "${s.name}" נוצר ושויך אליך (כל המתקן). ההרשאות החדשות ייכנסו לתוקף ברענון הבא של הדף.`}catch(a){this.message=`התפקיד "${s.name}" נוצר, אך השיוך האוטומטי אליך נכשל (${w(a)}). שייך אותו ידנית בלשונית "שיוכים".`}else this.message=`התפקיד "${s.name}" נוצר. שייך אותו למשתמש או לקבוצה בלשונית "שיוכים".`}catch(t){this.error=w(t)}finally{this.busy=!1}}}setAllRolePerms(e,t,s){const i=this.roleEdit;i&&(this.roleEdit={...i,[e]:s?[...new Set([...i[e],...t])]:i[e].filter(a=>!t.includes(a))},this.scheduleImpact())}async removeRole(e){this.busy=!0,this.error="";try{await Np(e.id),this.roleDelete=null,this.roles=await ls()}catch(t){this.error=w(t),this.roleDelete=null}finally{this.busy=!1}}async toggleDelegable(e){const t=this.roles?.delegable_roles??[],s=t.includes(e)?t.filter(i=>i!==e):[...t,e];this.busy=!0,this.error="";try{await Lp(s),this.roles=await ls()}catch(i){this.error=w(i)}finally{this.busy=!1}}renderRoleDialog(){const e=this.roleEdit,t=this.roles;if(!e||!t)return c;const s=new Set(t.sensitive),i=new Set(t.system_permissions??[]),a=Object.keys(t.labels).filter(o=>!s.has(o)&&!i.has(o)),n=this.roleImpact;return r`<sw-dialog open heading=${e.id?"עריכת תפקיד מותאם":"תפקיד מותאם חדש"} subheading="הרשאות רגילות + הרשאות רגישות במפורש · ללא הרשאות מערכת · ההשפעה מוצגת לפני השמירה" data-role-dialog @close=${()=>this.roleEdit=null}>
      ${this.error?r`<div class="err banner" data-role-error>${this.error}</div>`:c}
      <sw-field label="שם"><input data-role-name .value=${e.name} @input=${o=>this.roleEdit={...e,name:o.target.value}} /></sw-field>
      <sw-field label="תיאור"><input .value=${e.description} @input=${o=>this.roleEdit={...e,description:o.target.value}} /></sw-field>
      <div class="hint permsrow">הרשאות רגילות
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-perm-all @click=${()=>this.setAllRolePerms("permissions",a,!0)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-perm-none @click=${()=>this.setAllRolePerms("permissions",a,!1)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${a.map(o=>r`<label class="chk"><input type="checkbox" data-role-perm=${o} .checked=${e.permissions.includes(o)} @change=${()=>this.toggleRolePerm(o,!1)} /> ${t.labels[o]}</label>`)}</div>
      <div class="hint permsrow" style="margin-block-start:6px">הרשאות רגישות — לעולם לא מרומזות, נדרשות במפורש
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-sensitive-all @click=${()=>this.setAllRolePerms("sensitive",t.sensitive,!0)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-sensitive-none @click=${()=>this.setAllRolePerms("sensitive",t.sensitive,!1)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${t.sensitive.map(o=>r`<label class="chk sens"><input type="checkbox" data-role-sensitive=${o} .checked=${e.sensitive.includes(o)} @change=${()=>this.toggleRolePerm(o,!0)} /> ${t.labels[o]??o}</label>`)}</div>
      ${e.id?c:r`<label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-assign-me .checked=${e.assignMe!==!1} @change=${o=>this.roleEdit={...e,assignMe:o.target.checked}} /> שייך את התפקיד אליי מיד (כל המתקן)</label>`}
      <label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-delegable .checked=${e.delegable} @change=${o=>this.roleEdit={...e,delegable:o.target.checked}} /> מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)</label>
      ${n?r`<div class="impact" data-role-impact>
            <strong>השפעת השינוי:</strong> ${n.bindings} שיוכים · ${n.users.length} משתמשים${n.users.length?` (${n.users.map(o=>o.name).join(", ")})`:""}${n.groups.length?` · ${n.groups.length} קבוצות`:""}${n.scopes.length?` · היקפים: ${n.scopes.join(", ")}`:""}
            <div>${n.added.length?r`יתווספו: ${n.added.map(o=>t.labels[o]??o).join(", ")}`:"ללא הרשאות חדשות"} · ${n.removed.length?r`<span class="err">יוסרו: ${n.removed.map(o=>t.labels[o]??o).join(", ")}</span>`:"ללא הסרות"}</div>
          </div>`:c}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.roleEdit=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-role-save ?disabled=${this.busy||!e.name.trim()||!e.permissions.length&&!e.sensitive.length} @click=${()=>this.saveRole()}>${e.id?"שמירה":"צור תפקיד"}</sw-button>
    </sw-dialog>`}renderRolesApi(){const e=this.roles;return r`<div class="roles">${e.roles.map(t=>r`<sw-card class="role" data-role-card=${t.id}><h4><span class="ic"><sw-icon name=${t.custom?"user":t.id==="viewer"?"eye":t.id==="operator"?"play":t.id==="editor"?"edit":t.id==="site_admin"?"building":t.id==="kiosk"?"grid":"shield"} size=${14}></sw-icon></span>${t.name}${t.custom?r` <sw-badge kind="recorded" label="מותאם"></sw-badge>`:c}${t.system_role?r` <sw-badge kind="neutral" label="הרשאות מערכת"></sw-badge>`:c}${t.delegable?r` <sw-badge kind="historic" label="ניתן להאצלה"></sw-badge>`:c}</h4>${t.description?r`<div class="d">${t.description}</div>`:c}<div class="a">מותר: ${t.permissions.map(s=>this.label(s)).join(", ")}</div><div class="d">לא כלול אוטומטית: ${t.sensitive_missing.map(s=>this.label(s)).join(", ")||"—"}</div>${t.custom&&e.can_manage_roles?r`<div style="display:flex;gap:6px;margin-block-start:8px"><sw-button size="sm" data-role-edit @click=${()=>this.openRole(t)}>עריכה</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-role-delete @click=${()=>this.roleDelete=t}>מחיקה</sw-button></div>`:c}</sw-card>`)}</div>
      ${e.can_manage_roles?r`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" data-role-new @click=${()=>this.openRole()}>תפקיד מותאם חדש</sw-button></div>
            <sw-card heading="האצלת ניהול למנהלי אתר" subheading="מנהל אתר משייך רק תפקידים מהרשימה הזו, רק הרשאות שהוא מחזיק בהיקף, למשתמשים בלבד ובתוך ההיקף שלו; תפקידי מערכת לעולם לא" style="margin-block-start:12px" data-delegation>
              <div class="chips">${e.roles.filter(t=>!t.system_role).map(t=>r`<sw-chip data-delegable=${t.id} ?selected=${(e.delegable_roles??[]).includes(t.id)} @click=${()=>void this.toggleDelegable(t.id)}>${t.name}</sw-chip>`)}</div>
            </sw-card>`:c}
      <div class="hint">תפקידים מובנים אינם נערכים; תפקיד מותאם מורכב מהרשאות רגילות ומהרשאות רגישות שניתנות במפורש, ולעולם לא מהרשאות מערכת. התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>
      ${this.renderRoleDialog()}
      ${this.roleDelete?r`<sw-dialog open heading="מחיקת תפקיד" subheading=${this.roleDelete.name} @close=${()=>this.roleDelete=null}>
            <div class="hint">תפקיד משויך אינו נמחק: בטל קודם את השיוכים. המחיקה נרשמת באודיט.</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.roleDelete=null}>ביטול</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-role-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeRole(this.roleDelete)}>מחק</sw-button>
          </sw-dialog>`:c}`}renderEffectiveApi(){const e=this.directory,t=this.preview;return r`
      <div class="toolbar">
        <sw-field label="משתמש"><select @change=${s=>this.previewUser=s.target.value}>${e.users.map(s=>r`<option value=${s.id} ?selected=${s.id===this.previewUser}>${s.name}</option>`)}</select></sw-field>
        <sw-field label="היקף"><select @change=${s=>this.previewScope=s.target.value}>${this.scopeOptions.map(s=>r`<option value=${`${s.type}:${s.id}`} ?selected=${`${s.type}:${s.id}`===this.previewScope}>${s.name}</option>`)}</select></sw-field>
        <sw-button size="sm" icon="shield" ?disabled=${this.busy||!this.previewUser} @click=${()=>this.runPreview()}>חשב</sw-button>
      </div>
      ${t?r`<sw-card heading=${`${this.userName(t.user_id)} · ${t.scope_name}`} subheading=${t.active?`רוויזיה ${t.revision}`:"המשתמש ללא גישה (מושבת או נמחק ב־HA)"}>
            <div class="eff">
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר בהיקף</div>${t.allowed.length?t.allowed.map(s=>r`<div class="row"><span>${this.label(s)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`):r`<div class="row"><span>כלום</span></div>`}</div>
              <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מחוץ להיקף / לא מוקנה</div>${t.denied.map(s=>r`<div class="row"><span>${this.label(s)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
            </div>
            ${t.bindings.length?r`<div style="margin-block-start:10px;font-weight:600;font-size:var(--sw-fs-xs)">שיוכים שנלקחו בחשבון</div>${t.bindings.map(s=>r`<div class="bind"><div>${s.role_name} · ${s.scope_name}${s.via_group?` (קבוצה "${s.via_group}")`:""}</div></div>`)}`:c}
            <div class="hint" style="margin-block-start:8px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו; החישוב נעשה בצד השרת.</div>
          </sw-card>`:r`<div class="hint">בחר משתמש והיקף כדי לראות מה מותר ומה לא.</div>`}
    `}renderAuditApi(){if(!this.audit)return this.loadAudit(),r`<sw-state-panel state="loading"></sw-state-panel>`;const e=[{key:"at",label:"זמן",render:t=>r`<span style="font-size:var(--sw-fs-xs)">${pt(String(t.at))}</span>`},{key:"actor_username",label:"מבצע",render:t=>r`${String(t.actor_username??"מערכת / HA")}`},{key:"action",label:"פעולה",render:t=>r`${Op[String(t.action)]??String(t.action)}`},{key:"resource_id",label:"משאב",render:t=>r`${t.resource_type==="user"?this.userName(String(t.resource_id)):t.resource_type==="group"?this.groups?.find(s=>s.id===t.resource_id)?.name??String(t.resource_id):String(t.resource_id??"")}`},{key:"decision",label:"החלטה",render:t=>r`<sw-badge kind=${t.decision==="denied"?"forbidden":"live"} label=${t.decision==="denied"?`נחסם${t.reason?` · ${String(t.reason)}`:""}`:"הותר"}></sw-badge>`},{key:"details",label:"פרטים",render:t=>{const s=t.details,i=[s.role_id?`${String(s.role_id)}`:"",s.scope?String(s.scope):"",Array.isArray(s.added)&&s.added.length?`+${s.added.length}`:"",Array.isArray(s.removed)&&s.removed.length?`−${s.removed.length}`:"",s.revision?`rev ${String(s.revision)}`:""].filter(Boolean);return r`<span style="font-size:var(--sw-fs-xs);direction:ltr;unicode-bidi:isolate">${i.join(" · ")}</span>`}}];return this.audit.length?r`<sw-table dense .columns=${e} .rows=${this.audit} rowKey="at"></sw-table>`:r`<sw-state-panel state="empty" heading="אין רשומות אודיט הרשאות" hint="כל שיוך, ביטול, קבוצה או שינוי מצב משתמש יופיע כאן."></sw-state-panel>`}renderApi(){if(this.forbidden)return r`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="forbidden" hint="צפייה בספריית המשתמשים דורשת תפקיד מנהל מערכת VMS."></sw-state-panel></sw-page>`;if(this.error&&!this.directory)return r`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.directory||!this.roles)return r`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.directory,t=[{id:"users",label:"משתמשים",count:e.users.length},{id:"groups",label:"קבוצות",count:this.groups?.length??0},{id:"roles",label:"תפקידים",count:this.roles.roles.length},{id:"effective",label:"הרשאות אפקטיביות"},{id:"audit",label:"אודיט הרשאות"}],s=e.directory.paired?`זהות מ־Home Assistant · ${e.directory.users} משתמשים בספרייה · עודכן ${pt(e.directory.last_directory_at)} · רוויזיית הרשאות ${e.revision}`:"זהות מ־Home Assistant · הגשר עדיין לא מצומד: מוצגים רק משתמשים שנכנסו דרך Ingress";return r`
      <sw-page heading="משתמשים והרשאות" subheading=${s}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs .items=${t} .active=${this.tab} @change=${i=>{this.tab=i.detail.id,this.tab==="audit"&&this.loadAudit()}}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.</div>
        ${this.message||this.error?r`<div class="bar">${this.message?r`<span class="ok">${this.message}</span>`:c}${this.error?r`<span class="err">${this.error}</span>`:c}</div>`:c}
        ${this.tab==="users"?this.renderUsersApi():this.tab==="groups"?this.renderGroupsApi():this.tab==="roles"?this.renderRolesApi():this.tab==="effective"?this.renderEffectiveApi():this.renderAuditApi()}
      </sw-page>
    `}renderUsers(){const e=Ci.find(t=>t.id===this.selected);return r`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${Ci} .selected=${this.selected} @row-select=${t=>{this.selected=t.detail.id,this.assigning=!1}}></sw-table>
        ${e?r`<sw-drawer open heading=${e.name} subheading=${`HA: ${e.haUser} · ${e.active?"פעיל":"מושבת"}`} @close=${()=>this.selected=null}>
              ${this.assigning?r`<div class="wiz">
                    <sw-steps .steps=${["תפקיד","היקף","תצוגה מקדימה","שמירה"]} .current=${this.step}></sw-steps>
                    <sw-field label="קבוצה או תפקיד"><select><option>עורך מפות ותצוגות</option><option>מפעיל</option><option>צופה</option><option>מנהל אתר/מבנה/קומה</option></select></sw-field>
                    <sw-field label="היקף"><select><option>מבנה א · קומה 2</option><option>מבנה א</option><option>אתר הדגמה</option></select></sw-field>
                    <div class="eff">
                      <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר בהיקף</div><div class="row"><span>עריכת תוכנית קומה 2</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div><div class="row"><span>הצבת ציוד מורשה</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div></div>
                      <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">לא ניתן</div><div class="row"><span>עריכת קומה 3</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>ניהול משתמשים / NVR</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>פתיחת מנעול</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
                    </div>
                    <div class="hint">הרשאות בתוך SMPLWISE בלבד. שום דבר לא נכתב ל־HA. השינוי ירשם באודיט עם diff לפני/אחרי.</div>
                  </div>`:r`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${e.haUser}</span></dd>
                    <dt>סנכרון אחרון</dt><dd>${e.lastSync}</dd>
                    <dt>קבוצות</dt><dd>${e.groups.join(", ")||"—"}</dd>
                    <dt>שיוכים</dt><dd>${e.bindings.length?e.bindings.map(t=>r`<div>${t.role} · ${t.scope}</div>`):"ללא: אין גישה לתוכן"}</dd>
                  </dl>
                  <div class="hint">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד VMS אוטומטית.</div>`}
              <div slot="footer">
                ${this.assigning?r`<sw-button variant="primary" size="sm" icon="check">שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.assigning=!1}>ביטול</sw-button>`:r`<sw-button variant="primary" size="sm" icon="plus" @click=${()=>{this.assigning=!0,this.step=2}}>שיוך תפקיד</sw-button><sw-button variant="ghost" size="sm" icon="shield">הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`:""}
      </div>
    `}renderGroups(){return r`<sw-table .columns=${[{key:"name",label:"קבוצה",render:t=>r`<strong>${String(t.name)}</strong>`},{key:"members",label:"חברים"},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:t=>r`${t.bindings.map(s=>r`<div>${s}</div>`)}`},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]} .rows=${vr}></sw-table><div class="hint">שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.</div>`}renderRoles(){return r`<div class="roles">${gr.map(e=>r`<sw-card class="role"><h4><span class="ic"><sw-icon name=${e.id==="viewer"?"eye":e.id==="operator"?"play":e.id==="editor"?"edit":e.id==="site_admin"?"building":"shield"} size=${14}></sw-icon></span>${e.name}</h4><div class="a">מותר: ${e.allowed}</div><div class="d">לא ניתן אוטומטית: ${e.denied}</div></sw-card>`)}</div><div class="hint">תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>`}renderEffective(){return r`
      <sw-card heading="דנה · עורכת קומה 2">
        <div class="eff">
          <div>
            <div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מבנה א · קומה 2</div>
            ${["מפה: קריאה","תוכנית: יבוא/עריכה/פרסום","מיקומים ותצוגות: עריכה","שידור חי: מצלמות מורשות"].map(e=>r`<div class="row"><span>${e}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}
          </div>
          <div>
            <div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מחוץ להיקף / לא מוקנה</div>
            ${["קומה 3: הכל","Playback וייצוא","ניהול משתמשים","הגדרות NVR / go2rtc","פתיחת מנעול"].map(e=>r`<div class="row"><span>${e}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}
          </div>
        </div>
        <div class="hint" style="margin-block-start:8px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו. permission_revision: 7.</div>
      </sw-card>
    `}renderAudit(){return r`<sw-table dense .columns=${[{key:"time",label:"זמן"},{key:"user",label:"משתמש",render:t=>r`<div class="who"><sw-avatar name=${String(t.user)} size=${24}></sw-avatar>${String(t.user)}</div>`},{key:"action",label:"פעולה"},{key:"resource",label:"משאב"},{key:"decision",label:"החלטה",render:t=>r`<sw-badge kind=${String(t.decision).startsWith("נחסם")?"forbidden":"live"} label=${String(t.decision)}></sw-badge>`},{key:"role",label:"תפקיד/היקף ששימשו"}]} .rows=${br.filter(t=>t.action.includes("תוכנית")||t.action.includes("סנכרון")||t.action.includes("Ingress"))}></sw-table>`}render(){return g()?this.renderApi():r`
      <sw-page heading="משתמשים והרשאות" subheading="זהות מ־Home Assistant · הרשאות בתוך SMPLWISE בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs .items=${jp} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.</div>
        ${this.tab==="users"?this.renderUsers():this.tab==="groups"?this.renderGroups():this.tab==="roles"?this.renderRoles():this.tab==="effective"?this.renderEffective():this.renderAudit()}
      </sw-page>
    `}};U.styles=z`
    .notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-xs);
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .who .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: start;
    }
    .pillsel {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 7px;
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface);
      color: var(--sw-text);
      white-space: nowrap;
    }
    .pillsel sw-icon {
      color: var(--sw-text-3);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .status.off i {
      background: var(--sw-offline);
    }
    .perms {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 10px;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .chk.sens {
      color: var(--sw-warning, #b45309);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .impact {
      margin-block-start: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .err.banner {
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-danger-soft);
      border: 1px solid var(--sw-danger);
    }
    .permsrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .permsel {
      display: flex;
      gap: 4px;
    }
    .roles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .role h4 {
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-md);
    }
    .role .ic {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .role .a {
      color: #15803d;
      font-size: var(--sw-fs-xs);
    }
    .role .d {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
    }
    .eff {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .eff .row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .wiz {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bind {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .bind .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .members {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
      font-size: var(--sw-fs-sm);
    }
    .members label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 2px;
    }
    .bar {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
    }
    .err {
      color: var(--sw-danger);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
  `;q([d()],U.prototype,"tab",2);q([d()],U.prototype,"selected",2);q([d()],U.prototype,"assigning",2);q([d()],U.prototype,"step",2);q([d()],U.prototype,"directory",2);q([d()],U.prototype,"roles",2);q([d()],U.prototype,"groups",2);q([d()],U.prototype,"tree",2);q([d()],U.prototype,"audit",2);q([d()],U.prototype,"selectedGroup",2);q([d()],U.prototype,"wizard",2);q([d()],U.prototype,"members",2);q([d()],U.prototype,"newGroup",2);q([d()],U.prototype,"preview",2);q([d()],U.prototype,"previewUser",2);q([d()],U.prototype,"previewScope",2);q([d()],U.prototype,"busy",2);q([d()],U.prototype,"error",2);q([d()],U.prototype,"message",2);q([d()],U.prototype,"forbidden",2);q([d()],U.prototype,"roleEdit",2);q([d()],U.prototype,"roleImpact",2);q([d()],U.prototype,"roleDelete",2);U=q([S("system-access")],U);var Fp=Object.defineProperty,Wp=Object.getOwnPropertyDescriptor,as=(e,t,s,i)=>{for(var a=i>1?void 0:i?Wp(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Fp(t,s,a),a};const Up=[{key:"time",label:"זמן",render:e=>r`14.09.2026 ${String(e.time)}`},{key:"user",label:"משתמש",render:e=>r`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(e.user)} size=${24}></sw-avatar>${String(e.user)}</span>`},{key:"action",label:"פעולה",render:e=>r`<span style=${String(e.decision).startsWith("נחסם")?"color:var(--sw-danger);font-weight:600":""}>${String(e.action)}</span>`},{key:"resource",label:"פרטים",render:e=>r`${String(e.resource)} <span style="color:var(--sw-text-3)">· ${String(e.decision)}</span>`},{key:"role",label:"תפקיד / היקף"},{key:"rev",label:"rev",ltr:!0,render:()=>r`7`}],Zp=[{id:"",label:"כל הפעולות"},{id:"rbac.",label:"הרשאות ותפקידים"},{id:"video.",label:"וידאו (לייב, הקלטות, ייצוא)"},{id:"events.",label:"אירועים"},{id:"cases.",label:"תיקים וראיות"},{id:"ha.",label:"פעולות Home Assistant"},{id:"system.",label:"מערכת והגדרות"},{id:"plan.",label:"תוכניות ומפות"}],qp={allowed:{kind:"success",label:"הותר"},granted:{kind:"success",label:"הוענק"},denied:{kind:"danger",label:"נחסם"},refused:{kind:"danger",label:"סורב"},failed:{kind:"warning",label:"נכשל"}},Kp=[{key:"at",label:"זמן",ltr:!0,render:e=>r`<span class="ltr">${new Date(String(e.at)).toLocaleString("he-IL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>`},{key:"actor",label:"משתמש",render:e=>r`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(e.actor_username??"מערכת")} size=${24}></sw-avatar>${String(e.actor_username??"מערכת")}</span>`},{key:"action",label:"פעולה",ltr:!0,render:e=>r`<span class="ltr">${String(e.action)}</span>`},{key:"decision",label:"החלטה",render:e=>{const t=qp[String(e.decision)]??{kind:"neutral",label:String(e.decision)};return r`<sw-badge kind=${t.kind} label=${t.label}></sw-badge>`}},{key:"resource",label:"משאב",render:e=>r`${e.resource_type?r`<span style="color:var(--sw-text-3)">${String(e.resource_type)}</span> `:c}<span class="ltr">${String(e.resource_id??"")}</span>`},{key:"reason",label:"סיבה / פרטים",render:e=>r`${String(e.reason??"")}${Object.keys(e.details??{}).length?r` <span style="color:var(--sw-text-3)" class="ltr">${JSON.stringify(e.details).slice(0,120)}</span>`:c}`},{key:"permission_revision",label:"rev",ltr:!0}];let bt=class extends x{constructor(){super(...arguments),this.rows=null,this.error="",this.family="",this.actor="",this.limit=100}connectedCallback(){super.connectedCallback(),g()&&this.load()}async load(){try{const e=new URLSearchParams({prefix:this.family,limit:String(this.limit)});this.actor.trim()&&e.set("actor",this.actor.trim());const t=await k(`/audit?${e.toString()}`);this.rows=t.rows,this.error=""}catch(e){this.error=w(e),this.rows=[]}}exportCsv(){const e=this.rows??[],t=n=>`"${String(n??"").replace(/"/g,'""')}"`,s=[["at","actor","action","decision","resource_type","resource_id","reason","request_id","permission_revision"].join(",")];for(const n of e)s.push([n.at,n.actor_username,n.action,n.decision,n.resource_type,n.resource_id,n.reason,n.request_id,n.permission_revision].map(t).join(","));const i=new Blob(["\uFEFF"+s.join(`
`)],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(i),a.download=`audit-${new Date().toISOString().slice(0,10)}.csv`,a.click(),setTimeout(()=>URL.revokeObjectURL(a.href),2e3)}renderApi(){const e=this.rows;return r`
      <sw-page heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, פעולה, החלטה, משאב, סיבה, request_id, permission_revision · אין סיסמאות או טוקנים ביומן">
        <sw-button slot="actions" icon="download" ?disabled=${!e?.length} @click=${()=>this.exportCsv()}>ייצוא CSV</sw-button>
        <div class="filters" data-audit-filters>
          <sw-field><select aria-label="פעולה" .value=${this.family} @change=${t=>{this.family=t.target.value,this.load()}}>${Zp.map(t=>r`<option value=${t.id} ?selected=${t.id===this.family}>${t.label}</option>`)}</select></sw-field>
          <sw-field><input type="search" placeholder="שם משתמש" aria-label="משתמש" .value=${this.actor} @change=${t=>{this.actor=t.target.value,this.load()}} /></sw-field>
          <sw-field><select aria-label="כמות" @change=${t=>{this.limit=Number(t.target.value),this.load()}}>${[100,250,500].map(t=>r`<option value=${t} ?selected=${t===this.limit}>${t} אחרונות</option>`)}</select></sw-field>
          <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>רענון</sw-button>
        </div>
        ${this.error?r`<sw-state-panel state="error" heading="יומן האודיט לא נטען" hint=${this.error}></sw-state-panel>`:c}
        ${e===null?r`<sw-state-panel state="loading" heading="טוען יומן…"></sw-state-panel>`:e.length?r`<sw-table data-audit-table .columns=${Kp} .rows=${e}></sw-table>`:this.error?c:r`<sw-state-panel state="empty" heading="אין רשומות לסינון הזה" hint="נסה משפחת פעולות אחרת או נקה את שם המשתמש"></sw-state-panel>`}
        <div class="pager"><span>${e?`מציג ${e.length} רשומות אחרונות · צפייה ממושכת נרשמת כ־start/stop`:""}</span></div>
      </sw-page>
    `}render(){return g()?this.renderApi():r`
      <sw-page heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, מקור זהות, תפקיד והיקף, החלטה, request_id, permission_revision · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
        <div class="filters">
          <sw-field><select aria-label="פעולה"><option>כל הפעולות</option><option>צפייה</option><option>שינוי</option><option>ייצוא</option><option>פעולת HA</option></select></sw-field>
          <sw-field><select aria-label="משתמש"><option>כל המשתמשים</option></select></sw-field>
          <sw-field><select aria-label="אתר"><option>כל האתרים</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <sw-chip icon="clock">שמירה: 180 יום</sw-chip>
        </div>
        <sw-table .columns=${Up} .rows=${br}></sw-table>
        <div class="pager">
          <span>מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop</span>
          <span class="pages"><button aria-label="קודם"><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label="הבא"><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `}};bt.styles=z`
    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters sw-field {
      inline-size: 150px;
    }
    .pager {
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: space-between;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .pages {
      display: inline-flex;
      gap: 4px;
    }
    .pages button {
      inline-size: 26px;
      block-size: 26px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 6px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .pages button.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
  `;as([d()],bt.prototype,"rows",2);as([d()],bt.prototype,"error",2);as([d()],bt.prototype,"family",2);as([d()],bt.prototype,"actor",2);as([d()],bt.prototype,"limit",2);bt=as([S("system-audit")],bt);var Gp=Object.defineProperty,Yp=Object.getOwnPropertyDescriptor,K=(e,t,s,i)=>{for(var a=i>1?void 0:i?Yp(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Gp(t,s,a),a};const Jp=[{key:"nvr_host",label:"כתובת ה־NVR"},{key:"nvr_http_port",label:"פורט ISAPI (HTTP)"},{key:"nvr_rtsp_port",label:"פורט RTSP"},{key:"nvr_username",label:"משתמש NVR (קריאה)"},{key:"nvr_password",label:"סיסמת NVR"},{key:"go2rtc_url",label:"כתובת go2rtc"},{key:"go2rtc_api_username",label:"משתמש go2rtc (אם מוגן)"},{key:"go2rtc_api_password",label:"סיסמת go2rtc"},{key:"bootstrap_admin_username",label:"שם משתמש HA של המנהל הראשון"},{key:"log_level",label:"רמת לוג"}];function _t(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}const zi=["גילוי","NVR","go2rtc","גשר HA","מנהל ראשון","שעון","סיום"];let Z=class extends x{constructor(){super(...arguments),this.step=0,this.raw=null,this.report=null,this.recorder=null,this.error="",this.busy=!1,this.notify=null,this.notifyError="",this.notifyPlan=null,this.notifyBusy=!1,this.notifyResult="",this.sys=null,this.sysError="",this.sysMsg="",this.sysBusy=!1,this.ntpForm=null,this.rebootWord="",this.rebootOpen=!1,this.connection=null,this.connForm=null,this.connMsg="",this.connBusy=!1,this.changes=[]}connectedCallback(){super.connectedCallback(),g()&&this.load()}async load(){this.loadNvr(),this.busy=!0;try{this.raw=await k("health"),this.error=""}catch(e){this.error=w(e)}try{this.recorder=(await Te()).recorder}catch{this.recorder=null}try{this.report=await Nr()}catch{this.report=null}this.busy=!1}check(e){return this.report?.checks.find(t=>t.id===e)??null}row(e,t,s=""){return r`<div class="check"><span>${e}</span><span class=${`val ${s}`}>${t==null||t===""?"—":String(t)}</span></div>`}sectionHead(e,t){return r`<div class="syshead"><sw-icon name=${e} size=${15}></sw-icon>${t}</div>`}async loadNvr(){if(g()){try{const[e,t]=await Promise.all([xd(),Da(10)]);this.notify=e,this.changes=t.changes,this.notifyError=""}catch(e){this.notifyError=w(e)}this.loadSystem(),Dd().then(e=>this.connection=e).catch(()=>this.connection=null)}}async loadSystem(){try{this.sys=await Ed(),this.sysError=""}catch(e){this.sysError=w(e)}}async sysAction(e,t){if(!this.sysBusy){this.sysBusy=!0,this.sysMsg="";try{await t(),await Promise.all([this.loadSystem(),Da(10).then(s=>this.changes=s.changes)]),this.sysMsg=`${e}: בוצע ונרשם באודיט.`}catch(s){this.sysMsg=`${e}: ${w(s)}`}finally{this.sysBusy=!1}}}async saveConnection(){const e=this.connForm;if(!(!e||this.connBusy)){this.connBusy=!0,this.connMsg="";try{const t=await Rd({host:e.host.trim(),http_port:e.http_port,rtsp_port:e.rtsp_port,user:e.user.trim(),...e.password?{password:e.password}:{}});this.connection=t,this.connForm=null,this.connMsg=t.restarting?`החיבור נבדק (${t.device.model} · ${t.device.firmware}) ונשמר ב־Add-on options; ה־Add-on מופעל מחדש כעת.`:`החיבור נבדק (${t.device.model} · ${t.device.firmware}) ונשמר; בתוקף מיד.`,this.loadSystem()}catch(t){this.connMsg=`לא נשמר: ${w(t)}`}finally{this.connBusy=!1}}}renderSystemCard(){const e=this.sys,t=a=>`${(a/1024).toFixed(0)} GB`,s=e?.time?.drift_s??null,i=s===null?"":Math.abs(s)<=2?"ok":Math.abs(s)<=30?"warn":"err";return r`<sw-card heading="מערכת ה־NVR" subheading="שעון ו־NTP, דיסקים ובדיקת S.M.A.R.T., יציאות אזעקה, הפעלה מחדש · כל כתיבה דורשת הרשאה רגישה ונרשמת" data-nvr-system>
      ${this.sysError?r`<div class="hint" data-nvr-system-error>${this.sysError}</div>`:c}
      ${e?r`
          ${this.sectionHead("clock","שעון")}
          ${e.time?r`${this.row("שעון ה־NVR",`${e.time.local_time??"—"} · ${e.time.mode==="NTP"?"NTP":"ידני"}`)}
                ${this.row("סטייה מול שעון השרת",s===null?"—":`${s>0?"+":""}${s} שנ׳`,i)}
                ${this.row("שרת NTP",e.time.ntp?`${e.time.ntp.host??"—"}:${e.time.ntp.port} · כל ${e.time.ntp.interval_min} דק׳`:"—")}
                ${e.can.time?r`<div class="actions">
                      <sw-button size="sm" icon="clock" ?disabled=${this.sysBusy} data-nvr-sync-clock @click=${()=>this.sysAction("סנכרון השעון",()=>Pd({sync_now:!0}))}>סנכרן לשעון השרת עכשיו</sw-button>
                      <sw-button size="sm" variant="ghost" ?disabled=${this.sysBusy} data-nvr-ntp-edit @click=${()=>this.ntpForm=this.ntpForm?null:{host:e.time?.ntp?.host??"",port:e.time?.ntp?.port??123,interval_min:e.time?.ntp?.interval_min||1440}}>שרת NTP…</sw-button>
                    </div>
                    ${this.ntpForm?r`<div class="two" data-nvr-ntp-form>
                          <sw-field label="שרת NTP"><input data-ltr .value=${this.ntpForm.host} @input=${a=>this.ntpForm={...this.ntpForm,host:a.target.value}} /></sw-field>
                          <sw-field label="מרווח (דקות)"><input type="number" min="1" max="10080" data-ltr .value=${String(this.ntpForm.interval_min)} @input=${a=>this.ntpForm={...this.ntpForm,interval_min:Number(a.target.value)}} /></sw-field>
                          <div class="actions"><sw-button size="sm" variant="primary" ?disabled=${this.sysBusy||!this.ntpForm.host} data-nvr-ntp-save @click=${()=>{const a=this.ntpForm;this.sysAction("שרת NTP",async()=>{await Id({host:a.host.trim(),port:a.port,interval_min:a.interval_min}),this.ntpForm=null})}}>כתוב ל־NVR</sw-button></div>
                        </div>`:c}`:r`<div class="hint">כתיבת שעון / NTP: הרשאה nvr.config.time (תפקיד מותאם).</div>`}`:r`<div class="hint">השעון לא נקרא${e.errors.time?` (${e.errors.time})`:""}.</div>`}
          ${this.sectionHead("storage","דיסקים ו־S.M.A.R.T.")}
          ${e.disks.length?e.disks.map(a=>r`<div data-nvr-disk=${a.id}>
                ${this.row(`${a.name} (${a.type})`,`${a.status} · ${t(a.capacity_mb)} · פנוי ${t(a.free_mb)} (${a.capacity_mb?Math.round(a.free_mb/a.capacity_mb*100):0}%)`,a.status==="ok"?"ok":"warn")}
                ${a.smart?this.row("S.M.A.R.T.",`${a.smart.all_eval??"—"} · ${a.smart.temperature_c??"—"}°C · ${a.smart.power_on_days??"—"} ימי פעילות${a.smart.test_status?` · בדיקה: ${a.smart.test_status} ${a.smart.test_percent}%`:""}`,a.smart.all_eval==="functional"?"ok":"warn"):this.row("S.M.A.R.T.","לא זמין")}
                ${e.can.storage?r`<div class="actions"><sw-button size="sm" icon="storage" ?disabled=${this.sysBusy} data-nvr-smart-test=${a.id} @click=${()=>this.sysAction("בדיקת S.M.A.R.T. קצרה",()=>Td(a.id,"short"))}>בדיקת S.M.A.R.T. קצרה</sw-button><span class="hint">מעמיסה את הדיסק בזמן ריצתה; מומלץ בשעות שקטות</span></div>`:c}
              </div>`):r`<div class="hint">לא נקראו דיסקים${e.errors.disks?` (${e.errors.disks})`:""}.</div>`}
          ${this.sectionHead("bell","יציאות אזעקה")}
          ${e.outputs.length?e.outputs.map(a=>r`<div class="check" data-nvr-output=${a.id}><span>יציאה ${a.id}${a.name?` · ${a.name}`:""} <span class="hint">${a.io_type==="local"?"ממסר ב־NVR":"במצלמה"} · ${a.use_type==="whiteLight"?"אור לבן":a.use_type==="disable"?"לא בשימוש":a.use_type}${a.pulse_ms?` · פולס ${a.pulse_ms/1e3} שנ׳`:""}</span></span>
                ${a.pulse_supported?e.can.alarm?r`<sw-button size="sm" icon="bell" ?disabled=${this.sysBusy||!a.enabled} data-nvr-pulse=${a.id} @click=${()=>this.sysAction(`הפעלת יציאה ${a.id}`,()=>Cd(a.id))}>הפעל (pulse)</sw-button>`:r`<span class="val">${a.enabled?"פעיל":"כבוי"}</span>`:r`<span class="val" data-nvr-output-unsupported>הפעלה דרך המצלמה בלבד (ה־NVR לא מעביר)</span>`}
              </div>`):r`<div class="hint">אין יציאות${e.errors.outputs?` (${e.errors.outputs})`:""}.</div>`}
          ${this.sectionHead("refresh","הפעלה מחדש")}
          ${e.can.reboot?r`<div class="actions"><sw-button size="sm" variant="danger" icon="refresh" ?disabled=${this.sysBusy} data-nvr-reboot @click=${()=>{this.rebootWord="",this.rebootOpen=!0}}>הפעל מחדש את ה־NVR…</sw-button><span class="hint">1–2 דקות בלי לייב ובלי הקלטה</span></div>`:r`<div class="hint">הפעלה מחדש: הרשאה nvr.system.reboot (תפקיד מותאם).</div>`}
          ${this.sysMsg?r`<div class="hint" data-nvr-system-msg>${this.sysMsg}</div>`:c}`:this.sysError?c:r`<div class="hint">קורא את מצב המערכת מה־NVR…</div>`}
      ${this.rebootOpen?r`<sw-dialog open heading="הפעלה מחדש של ה־NVR" subheading="במשך 1–2 דקות אין לייב ואין הקלטה" data-nvr-reboot-dialog @close=${()=>this.rebootOpen=!1}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">הקלד <b>RESTART</b> כדי לאשר. הפעולה נרשמת באודיט עם שם המשתמש.</div>
            <sw-field label="אישור"><input data-ltr data-nvr-reboot-word .value=${this.rebootWord} @input=${a=>this.rebootWord=a.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.sysBusy||this.rebootWord.trim().toUpperCase()!=="RESTART"} data-nvr-reboot-run @click=${()=>{const a=this.rebootWord;this.rebootOpen=!1,this.sysAction("הפעלה מחדש",()=>Od(a))}}>הפעל מחדש</sw-button><sw-button variant="ghost" @click=${()=>this.rebootOpen=!1}>ביטול</sw-button></div>
          </sw-dialog>`:c}
    </sw-card>`}renderConnectionCard(){const e=this.connection;if(!e)return c;const t=this.connForm;return r`<sw-card heading="חיבור ל־NVR" subheading=${e.in_addon?"נשמר ב־Add-on options דרך ה־Supervisor; שמירה מפעילה מחדש את ה־Add-on":"נשמר ליד הנתונים (nvr_connection.json); בתוקף מיד"} data-nvr-connection>
      ${this.row("כתובת · פורט HTTP · RTSP",`${e.host??"—"} · ${e.http_port} · ${e.rtsp_port}`)}
      ${this.row("משתמש",`${e.user??"—"} · ${e.has_password?"סיסמה מוגדרת":"ללא סיסמה"}`,e.has_password?"ok":"warn")}
      ${t?r`<div class="two" data-nvr-connection-form>
            <sw-field label="כתובת"><input data-ltr data-conn-host .value=${t.host} @input=${s=>this.connForm={...t,host:s.target.value}} /></sw-field>
            <sw-field label="פורט HTTP"><input type="number" data-ltr .value=${String(t.http_port)} @input=${s=>this.connForm={...t,http_port:Number(s.target.value)}} /></sw-field>
            <sw-field label="פורט RTSP"><input type="number" data-ltr .value=${String(t.rtsp_port)} @input=${s=>this.connForm={...t,rtsp_port:Number(s.target.value)}} /></sw-field>
            <sw-field label="משתמש"><input data-ltr data-conn-user .value=${t.user} @input=${s=>this.connForm={...t,user:s.target.value}} /></sw-field>
            <sw-field label="סיסמה (ריק = ללא שינוי)"><input type="password" data-ltr data-conn-password .value=${t.password} @input=${s=>this.connForm={...t,password:s.target.value}} /></sw-field>
            <div class="actions">
              <sw-button size="sm" variant="primary" icon="check" ?disabled=${this.connBusy||!t.host||!t.user} data-conn-save @click=${()=>this.saveConnection()}>${this.connBusy?"בודק…":"בדוק ושמור"}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.connBusy} @click=${()=>this.connForm=null}>ביטול</sw-button>
            </div>
            <div class="hint">הבדיקה קוראת deviceInfo עם הפרטים החדשים; בלי הצלחה לא נשמר דבר.</div>
          </div>`:r`<div class="actions"><sw-button size="sm" icon="edit" data-conn-edit @click=${()=>this.connForm={host:e.host??"",http_port:e.http_port,rtsp_port:e.rtsp_port,user:e.user??"",password:""}}>עריכת פרטי החיבור</sw-button></div>`}
      ${this.connMsg?r`<div class="hint" data-conn-msg>${this.connMsg}</div>`:c}
    </sw-card>`}planNotify(e,t,s){const i=e?e.length:this.notify?.channels.length??0;this.notifyResult="",this.notifyPlan={channels:e,smart:t,enabled:s,label:`${s?"הפעלת":"כיבוי"} Notify Surveillance Center ב־${i} ערוצים${t?" · תנועה + אירועים חכמים":" · זיהוי תנועה"}`}}async runNotify(){const e=this.notifyPlan;if(!(!e||this.notifyBusy)){this.notifyBusy=!0;try{const t=await kd({channels:e.channels,smart:e.smart,enabled:e.enabled});this.notifyResult=`בוצע: ${t.applied} שינויים · ${t.unchanged} כבר היו כך · ${t.skipped} דולגו (סוג אירוע שלא מוגדר בערוץ) · ${t.failed} נכשלו`,this.notifyPlan=null,await this.loadNvr()}catch(t){this.notifyResult=w(t)}finally{this.notifyBusy=!1}}}async rollback(e){if(!this.notifyBusy){this.notifyBusy=!0;try{await _d(e.id),this.notifyResult=`השינוי ${e.target} הוחזר למצב הקודם.`,await this.loadNvr()}catch(t){this.notifyResult=w(t)}finally{this.notifyBusy=!1}}}renderNotifyCard(){const e=this.notify,t=s=>s===null?"—":s?"✓":"✗";return r`<sw-card heading="התראות מה־NVR (Notify Surveillance Center)" subheading="אילו ערוצים מודיעים ל־VMS על תנועה ועל אירועים חכמים · כתיבה מאושרת ל־NVR, עם החזר" data-nvr-notify>
      ${this.notifyError?r`<div class="hint" data-nvr-notify-error>${this.notifyError}</div>`:c}
      ${e?r`<table class="matrix" data-nvr-matrix>
            <thead><tr><th>ערוץ</th><th>מצלמה</th><th>תנועה</th><th>אירועים חכמים</th><th></th></tr></thead>
            <tbody>${e.channels.map(s=>r`<tr data-nvr-channel=${s.channel}>
              <td class="ltr">${s.channel}</td><td>${s.name}</td>
              <td data-nvr-motion=${s.motion.supported?String(s.motion.center):"none"}>${s.motion.supported?t(s.motion.center):"לא מוגדר"}</td>
              <td>${s.smart_supported?`${s.smart_center}/${s.smart_supported}`:"אין"}</td>
              <td>${e.can_write&&s.motion.supported&&!s.motion.center?r`<sw-button size="sm" data-nvr-enable-one=${s.channel} @click=${()=>this.planNotify([s.channel],!1,!0)}>הפעל</sw-button>`:c}</td>
            </tr>`)}</tbody>
          </table>
          <div class="hint">✓ = ההתראה נשלחת ל־VMS · ✗ = הערוץ מקליט אבל לא מודיע · אירועים חכמים = חציית קו, פריצה לאזור, כניסה ויציאה מאזור (רק במצלמות שמגדירות אותם).</div>
          ${e.can_write?r`<div class="actions">
                <sw-button variant="primary" size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-all @click=${()=>this.planNotify(null,!1,!0)}>הפעל תנועה בכל הערוצים</sw-button>
                <sw-button size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-smart @click=${()=>this.planNotify(null,!0,!0)}>הפעל גם אירועים חכמים</sw-button>
              </div>`:r`<div class="hint" data-nvr-no-permission>לכתיבה ל־NVR נדרשת ההרשאה "${e.permission}" — מוקנית למנהל המערכת, ולאחרים דרך תפקיד מותאם (הגדרות › משתמשים והרשאות › תפקידים), גם למנהל מערכת.</div>`}
          ${this.notifyResult?r`<div class="hint" data-nvr-result>${this.notifyResult}</div>`:c}
          ${this.changes.length?r`<div class="hint" style="margin-block-start:8px"><b>שינויים אחרונים ב־NVR</b></div>
            <ul class="changes" data-nvr-changes>${this.changes.map(s=>r`<li><span class="ltr">${s.created_at.slice(0,16).replace("T"," ")}</span> · ${s.target} · ${s.note||s.kind} · ${s.status==="applied"?"בוצע":s.status==="unchanged"?"ללא שינוי":s.status==="rolled_back"?"הוחזר":"נכשל"}${s.actor_username?` · ${s.actor_username}`:""}
              ${s.status==="applied"&&e.can_write?r`<sw-button variant="ghost" size="sm" ?disabled=${this.notifyBusy} data-nvr-rollback=${s.id} @click=${()=>this.rollback(s)}>החזר</sw-button>`:c}</li>`)}</ul>`:c}`:this.notifyError?c:r`<div class="hint">קורא את הגדרות ה־NVR…</div>`}
      ${this.notifyPlan?r`<sw-dialog open heading="כתיבה ל־NVR" subheading=${this.notifyPlan.label} data-nvr-confirm @close=${()=>this.notifyPlan=null}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.5">השינוי נכתב להגדרות ה־NVR בזהות המשתמש המוגדר ב־Add-on, נרשם באודיט עם המסמך לפני ואחרי, וניתן להחזרה מרשימת השינויים. הקלטות אינן מושפעות.</div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.notifyBusy} data-nvr-confirm-run @click=${()=>this.runNotify()}>${this.notifyBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.notifyPlan=null}>ביטול</sw-button></div>
          </sw-dialog>`:c}
    </sw-card>`}renderApi(){const e=this.raw;return r`
      <sw-page heading="חיבורים" subheading="מצב החיבורים של ה־Add-on: NVR, go2rtc, Home Assistant ואחסון · קריאה בלבד · הערכים עצמם מוגדרים ב־Home Assistant › Add-ons › SMPLWISE VMS › Configuration">
        <sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.load()}>${this.busy?"בודק…":"רענון"}</sw-button>
        ${this.error?r`<sw-state-panel state="error" heading="מצב החיבורים לא נטען" hint=${this.error}></sw-state-panel>`:c}
        ${e?r`<div class="two" data-connections>
              <div class="grouplabel">מערכת ה־NVR</div>
              <sw-card heading="NVR (Hikvision, ISAPI + RTSP)" subheading=${e.nvr_configured?"מוגדר · קריאה בלבד":"לא מוגדר"}>
                ${this.row("מוגדר ב־Add-on options",e.nvr_configured?"כן":"לא",e.nvr_configured?"ok":"err")}
                ${this.recorder?this.row("דגם · קושחה",`${this.recorder.model??"—"} · ${this.recorder.firmware??"—"}`):c}
                ${this.row("גילוי מצלמות",`${e.discovery.cameras} ערוצים · כל ${Math.round(e.discovery.interval_s/60)} דק׳`)}
                ${this.row("גילוי אחרון תקין",_t(e.discovery.cameras_last_ok),e.discovery.cameras_last_error?"warn":"ok")}
                ${e.discovery.cameras_last_error?this.row("שגיאת גילוי",e.discovery.cameras_last_error,"err"):c}
                ${this.row("זרם התראות (alertStream)",e.events.ingest.connected?`מחובר · פעימה ${_t(e.events.ingest.last_heartbeat_at)}`:`מנותק${e.events.ingest.last_error?` · ${e.events.ingest.last_error}`:""}`,e.events.ingest.connected?"ok":"err")}
                ${this.row("התראות שנשמרו מאז ההפעלה",e.events.ingest.events_stored,e.events.ingest.connected&&!e.events.ingest.events_stored?"warn":"")}
                ${e.events.ingest.connected&&!e.events.ingest.last_event_at?r`<div class="hint" data-no-alerts-hint>ה־NVR מחובר אבל לא שלח התראה מאז ההפעלה — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה; עד אז אירועי תנועה נגזרים מההקלטות כל 10 דקות.</div>`:c}
                ${this.row("אירועים שנגזרו מהקלטות (ריצה אחרונה)",`${e.events.derive.derived} · ${_t(e.events.derive.last_ok)}`,e.events.derive.last_error?"warn":"")}
              </sw-card>
              ${this.renderNotifyCard()}
              ${this.renderSystemCard()}
              ${this.renderConnectionCard()}
              <div class="grouplabel">שירותים ותשתית נוספים</div>
              <sw-card heading="go2rtc (relay לווידאו)" subheading=${e.go2rtc_configured?"מוגדר":"לא מוגדר"}>
                ${this.row("מוגדר ב־Add-on options",e.go2rtc_configured?"כן":"לא",e.go2rtc_configured?"ok":"err")}
                ${this.row("סנכרון זרמים אחרון תקין",_t(e.discovery.streams_last_ok),e.discovery.streams_last_error?"warn":"ok")}
                ${e.discovery.streams_last_error?this.row("שגיאת סנכרון זרמים",e.discovery.streams_last_error,"err"):c}
                ${this.check("go2rtc")?this.row("בדיקת בריאות",this.check("go2rtc").detail,this.check("go2rtc").status==="ok"?"ok":this.check("go2rtc").status==="warn"?"warn":"err"):r`<div class="hint">פרטי הזרמים והגרסה מוצגים ב"הגדרות › כללי › בריאות ועבודות" (דורש הרשאת ניהול).</div>`}
              </sw-card>
              <sw-card heading="Home Assistant" subheading=${e.home_assistant.connected?`מחובר · HA ${e.home_assistant.ha_version??""}`:e.home_assistant.configured?"מוגדר, מנותק":"לא מוגדר"}>
                ${this.row("חיבור",e.home_assistant.connected?"מחובר":`מנותק${e.home_assistant.last_error?` · ${e.home_assistant.last_error}`:""}`,e.home_assistant.connected?"ok":"err")}
                ${this.row("ישויות בקטלוג",e.home_assistant.entities)}
                ${this.row("תמונת מצב אחרונה",_t(e.home_assistant.last_snapshot_at))}
                ${this.row("עדכון ישות אחרון",_t(e.home_assistant.last_event_at))}
                ${this.row("רישום (אזורים / קומות) עודכן",_t(e.home_assistant.last_registry_at))}
                ${this.row("התחברויות מחדש מאז ההפעלה",e.home_assistant.reconnects,e.home_assistant.reconnects>3?"warn":"")}
                ${this.row("מקור הזהות",e.identity_source==="ingress"?"Home Assistant Ingress":e.identity_source)}
              </sw-card>
              <sw-card heading="אחסון וכלים" subheading=${`גרסה ${e.version}`}>
                ${this.row("בסיס הנתונים",e.db.ok?`תקין · מהדורת הרשאות ${e.db.permission_revision}`:"שגיאה",e.db.ok?"ok":"err")}
                ${this.row("תיקיית הנתונים (/data)",e.data_dir_writable?"ניתנת לכתיבה":"לא ניתנת לכתיבה",e.data_dir_writable?"ok":"err")}
                ${this.row("ממיר תוכניות PDF",e.renderer??"חסר",e.renderer?"ok":"warn")}
                ${this.row("אירועים שמורים",e.events.stored)}
                ${this.check("thumbnails")?this.row("תמונות אירועים (ffmpeg)",this.check("thumbnails").detail,this.check("thumbnails").status==="ok"?"ok":"warn"):c}
                ${this.check("backups")?this.row("גיבויים",this.check("backups").detail,this.check("backups").status==="ok"?"ok":"warn"):c}
              </sw-card>
            </div>
            <sw-card heading="איפה מגדירים" subheading="הערכים אינם מוצגים כאן ואינם נשמרים ב־VMS; שינוי דורש הפעלה מחדש של ה־Add-on">
              <div class="opts" data-connection-options>
                ${Jp.map(t=>r`<div class="check"><span>${t.label}</span><span class="val ltr">${t.key}</span></div>`)}
              </div>
              <div class="hint">Home Assistant › הגדרות › Add-ons › SMPLWISE VMS › Configuration. משתמש ה־NVR צריך הרשאות צפייה והקלטות בלבד; ה־VMS לא כותב ל־NVR.</div>
            </sw-card>`:this.error?c:r`<sw-state-panel state="loading" heading="קורא את מצב החיבורים…"></sw-state-panel>`}
      </sw-page>
    `}renderStep(){switch(this.step){case 0:return r`<sw-card heading="גילוי מכשירים" subheading="חיפוש NVR ומצלמות ברשת המקומית · קריאה בלבד, ללא שינוי תצורה במכשיר">
          <div class="scan">
            <div class="ic"><sw-icon name="wifi" size=${22}></sw-icon></div>
            <b>סורק את הרשת…</b>
            <span class="hint">מחפש NVR, מצלמות ומכשירים תואמים. זה עשוי לקחת כמה רגעים.</span>
            <div class="track"><i></i></div>
            <span class="found">3 מכשירים נמצאו</span>
          </div>
          <div class="dev"><input type="checkbox" checked aria-label="בחר" /><span>NVR ראשי</span><span class="ip">192.168.x.x</span><span class="grow"></span><span class="hint">10 ערוצים</span><sw-button size="sm" variant="primary">הוסף הכל</sw-button></div>
          <div class="dev"><input type="checkbox" checked aria-label="בחר" /><span>מצלמת כניסה</span><span class="ip">192.168.x.x</span><span class="grow"></span><span class="hint">ONVIF</span><sw-button size="sm">הוסף</sw-button></div>
          <div class="dev"><input type="checkbox" aria-label="בחר" /><span>מצלמת חניה</span><span class="ip">192.168.x.x</span><span class="grow"></span><span class="hint">RTSP</span><sw-button size="sm">הוסף</sw-button></div>
        </sw-card>`;case 1:return r`<sw-card heading="חיבור ל־NVR">
          <div class="two">
            <sw-field label="כתובת"><input data-ltr placeholder="192.168.x.x" /></sw-field>
            <sw-field label="פורט HTTP"><input data-ltr value="80" /></sw-field>
            <sw-field label="משתמש"><input data-ltr placeholder="smplwise" /></sw-field>
            <sw-field label="סיסמה"><input type="password" data-ltr /></sw-field>
          </div>
          <div class="hint">מומלץ משתמש ייעודי לא־admin. בדיקת החיבור קוראת deviceInfo, time ו־capabilities בלבד.</div>
        </sw-card>`;case 2:return r`<sw-card heading="go2rtc חיצוני">
          <div class="two">
            <sw-field label="כתובת API"><input data-ltr value="http://…:1984" /></sw-field>
            <sw-field label="אימות API (מומלץ)"><input data-ltr placeholder="user:password" /></sw-field>
          </div>
          <div class="check"><span>גרסה</span><sw-badge kind="live" label="1.9.x"></sw-badge></div>
          <div class="check"><span>שמירת זרמים לקובץ ההגדרות</span><sw-badge kind="stale" label="כן: המוצר ישתמש במאגר slots קבוע"></sw-badge></div>
          <div class="check"><span>זרמים זרים (אינטרקום, מצלמות)</span><sw-badge kind="neutral" label="20 · לא ייגעו"></sw-badge></div>
        </sw-card>`;case 3:return r`<sw-card heading="גשר Home Assistant">
          <div class="check"><span>אינטגרציה מותקנת</span><sw-badge kind="live" label="smplwise_vms 0.1"></sw-badge></div>
          <div class="check"><span>Pairing</span><sw-badge kind="stale" label="ממתין לאישור מנהל HA"></sw-badge></div>
          <div class="check"><span>סנכרון משתמשים</span><sw-badge kind="unknown" label="טרם בוצע"></sw-badge></div>
          <div class="check"><span>Ingress: זהות משתמש מהכותרות</span><sw-badge kind="live" label="מאומת מול ה־proxy"></sw-badge></div>
          <div class="hint">ה־Bridge מספק קטלוג מצומצם ומבצע פעולות בשם המשתמש. אין קריאת config/auth/list מהדפדפן ואין קידום משתמשים.</div>
        </sw-card>`;case 4:return r`<sw-card heading="בחירת מנהל VMS ראשון">
          <div class="hint" style="margin-block-end:8px">מנהל HA מזוהה בוחר במפורש משתמש HA קיים. אין קידום אוטומטי לכל מנהלי HA; הבחירה נרשמת פעם אחת באודיט וה־bootstrap ננעל.</div>
          <div class="users">
            <label><input type="radio" name="admin" checked /> יוני (joni)</label>
            <label><input type="radio" name="admin" /> דנה (dana) — משתמשת רגילה ב־HA, מותר</label>
            <label><input type="radio" name="admin" /> יוסי (yossi)</label>
          </div>
        </sw-card>`;case 5:return r`<sw-card heading="פרופיל שעון">
          <div class="check"><span>אזור זמן האתר</span><span class="ltr">Asia/Jerusalem</span></div>
          <div class="check"><span>שעון NVR מול שרת</span><sw-badge kind="live" label="סטייה 2 שנ׳"></sw-badge></div>
          <div class="check"><span>פרשנות זמני חיפוש</span><sw-badge kind="stale" label="שעון מקומי (פרופיל דגם)"></sw-badge></div>
          <div class="hint">אין הזזה קבועה של שעות. שעון קיץ/חורף לפי התאריך המבוקש.</div>
        </sw-card>`;default:return r`<sw-card heading="מצלמה ומפה ראשונות">
          <div class="check"><span>ערוצים שהתגלו</span><span>10 (ללא נוסחת track)</span></div>
          <div class="check"><span>קומה ראשונה</span><span>קומה 0 · תוכנית: להעלות</span></div>
          <div class="check"><span>Add-on</span><sw-badge kind="live" label="רץ · /data מתמשך"></sw-badge></div>
          <div class="check"><span>panel_admin</span><sw-badge kind="neutral" label="false"></sw-badge></div>
          <div class="check"><span>משתמש רגיל דרך Ingress</span><sw-badge kind="stale" label="לבדיקה (T081)"></sw-badge></div>
          <div class="hint">גילוי אינו משנה תצורה במכשיר. הצבה על המפה יוצרת Binding בלבד.</div>
        </sw-card>`}}render(){return g()?this.renderApi():r`
      <sw-page heading="אשף התקנה" subheading="גילוי NVR ומצלמות, בדיקת זרמים, שמות וקומות · בדיקות קריאה בלבד · נתוני הדגמה">
        <div class="wrap">
          <sw-card><sw-steps .steps=${zi} .current=${this.step}></sw-steps></sw-card>
          ${this.renderStep()}
          <div class="foot">
            <sw-button variant="ghost" ?disabled=${this.step===0} @click=${()=>this.step=Math.max(0,this.step-1)}>הקודם</sw-button>
            <div style="display:flex;gap:8px">
              <sw-button>ביטול</sw-button>
              <sw-button variant="primary" @click=${()=>this.step=Math.min(zi.length-1,this.step+1)}>${this.step===zi.length-1?"סיום":"הבא"}</sw-button>
            </div>
          </div>
        </div>
      </sw-page>
    `}};Z.styles=z`
    .matrix {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
      margin-block: 6px;
    }
    .matrix th,
    .matrix td {
      text-align: start;
      padding: 4px 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .matrix th {
      color: var(--sw-text-3);
      font-weight: 500;
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    ul.changes {
      margin: 4px 0 0;
      padding-inline-start: 18px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    ul.changes li {
      margin-block: 2px;
    }
    .wrap {
      max-inline-size: 760px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .check {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .check:last-child {
      border-block-end: 0;
    }
    /* owner round 4 (1.1): the system card packed clock/disks/outputs/reboot behind bare bold text with no
       separation - a wall of controls. A real section head (icon, label, rule) makes it scannable. */
    .syshead {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-block: 14px 4px;
      padding-block-start: 12px;
      border-block-start: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .syshead:first-child {
      margin-block-start: 0;
      padding-block-start: 0;
      border-block-start: 0;
    }
    .syshead sw-icon {
      color: var(--sw-accent);
    }
    .grouplabel {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-block: 4px 2px;
      grid-column: 1 / -1;
    }
    .grouplabel:not(:first-child) {
      margin-block-start: 14px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .val {
      color: var(--sw-text-2);
      text-align: start;
      max-inline-size: 60%;
      overflow-wrap: anywhere;
    }
    .val.ok {
      color: var(--sw-success, #15803d);
    }
    .val.warn {
      color: var(--sw-warning, #b45309);
    }
    .val.err {
      color: var(--sw-danger);
      font-weight: 600;
    }
    .opts {
      columns: 2;
      column-gap: 24px;
    }
    .opts .check {
      break-inside: avoid;
    }
    @media (max-width: 767px) {
      .two {
        grid-template-columns: 1fr;
      }
      .opts {
        columns: 1;
      }
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .scan {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 18px 0 14px;
      text-align: center;
    }
    .scan .ic {
      display: grid;
      place-items: center;
      inline-size: 48px;
      block-size: 48px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin-block-end: 4px;
    }
    .scan b {
      font-size: var(--sw-fs-md);
    }
    .track {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
      inline-size: 100%;
      max-inline-size: 420px;
      margin-block: 8px 4px;
    }
    .track i {
      display: block;
      block-size: 100%;
      inline-size: 72%;
      background: var(--sw-accent);
      border-radius: 3px;
    }
    .found {
      font-size: var(--sw-fs-xs);
      color: var(--sw-accent-text);
    }
    .dev {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .dev:last-child {
      border-block-end: 0;
    }
    .dev .grow {
      flex: 1;
    }
    .dev .ip {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-family: var(--sw-font-mono);
      direction: ltr;
    }
    .users label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .two {
        grid-template-columns: 1fr;
      }
    }
  `;K([d()],Z.prototype,"step",2);K([d()],Z.prototype,"raw",2);K([d()],Z.prototype,"report",2);K([d()],Z.prototype,"recorder",2);K([d()],Z.prototype,"error",2);K([d()],Z.prototype,"busy",2);K([d()],Z.prototype,"notify",2);K([d()],Z.prototype,"notifyError",2);K([d()],Z.prototype,"notifyPlan",2);K([d()],Z.prototype,"notifyBusy",2);K([d()],Z.prototype,"notifyResult",2);K([d()],Z.prototype,"sys",2);K([d()],Z.prototype,"sysError",2);K([d()],Z.prototype,"sysMsg",2);K([d()],Z.prototype,"sysBusy",2);K([d()],Z.prototype,"ntpForm",2);K([d()],Z.prototype,"rebootWord",2);K([d()],Z.prototype,"rebootOpen",2);K([d()],Z.prototype,"connection",2);K([d()],Z.prototype,"connForm",2);K([d()],Z.prototype,"connMsg",2);K([d()],Z.prototype,"connBusy",2);K([d()],Z.prototype,"changes",2);Z=K([S("system-setup")],Z);var Xp=Object.defineProperty,Qp=Object.getOwnPropertyDescriptor,ke=(e,t,s,i)=>{for(var a=i>1?void 0:i?Qp(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Xp(t,s,a),a};const tr=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"];let ue=class extends x{constructor(){super(...arguments),this.selected=null,this.filter="all",this.cameras=null,this.recorder=null,this.canSync=!1,this.discovery=null,this.busy=!1,this.message="",this.error="",this.dialog=!1,this.formChannel=1,this.formAlias="",this.alias="",this.columns=[{key:"name",label:"מצלמה",render:e=>r`<div class="cam">${e.api&&e.api.status==="online"?r`<img class="snap" src=${qe(String(e.id))} alt="" loading="lazy" style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:5px;flex-shrink:0;background:var(--sw-surface-3);display:block" @error=${t=>t.target.style.visibility="hidden"} />`:e.scene?r`<sw-scene kind=${e.scene}></sw-scene>`:r`<div class="none"></div>`}<div><b>${String(e.name)}</b><small>${String(e.sub)}</small></div></div>`},{key:"state",label:"מצב",render:e=>r`<span class="status"><i style="--c:${e.state==="live"?"var(--sw-live)":e.state==="offline"?"var(--sw-danger)":e.state==="unknown"?"var(--sw-unknown)":"var(--sw-stale)"}"></i>${e.state==="live"?"מחוברת":e.state==="offline"?"מנותקת":e.state==="stale"?"לא מעודכן":e.state==="forbidden"?"ללא הרשאה":"לא נבדק"}</span>`},{key:"fps",label:"FPS",ltr:!0},{key:"bitrate",label:"קצב",ltr:!0},{key:"firmware",label:"זרם ראשי",ltr:!0},{key:"lastEvent",label:"נראתה לאחרונה"},{key:"net",label:"רשת",render:e=>this.net(e.state==="live"?4:e.state==="stale"?2:0)},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.reload()}async reload(){if(!g()){this.cameras=null;return}try{const e=await Te();this.cameras=e.cameras,this.recorder=e.recorder,this.canSync=e.can_sync,k("health").then(t=>this.discovery=t.discovery).catch(()=>{})}catch(e){this.error=w(e)}}async sync(){this.busy=!0,this.error="",this.message="";try{const e=await Lo();this.message=`סנכרון הושלם: ${e.channels} ערוצים (${e.created} חדשים, ${e.updated} עודכנו)${e.recorder.model?` · ${e.recorder.model}`:""}`,await this.reload()}catch(e){this.error=w(e)}finally{this.busy=!1}}async register(){this.busy=!0,this.error="";try{await Ho({channel:this.formChannel,alias:this.formAlias.trim()}),this.dialog=!1,await this.reload()}catch(e){this.error=w(e)}finally{this.busy=!1}}async saveAlias(e){this.busy=!0,this.error="";try{await _r(e,{alias:this.alias.trim()||void 0}),await this.reload(),this.message="הכינוי נשמר (שם ה־NVR לא השתנה)"}catch(t){this.error=w(t)}finally{this.busy=!1}}get rows(){return this.cameras?this.cameras.map(e=>({id:e.id,name:e.name,sub:`ערוץ ${e.channel}${e.name_source&&e.alias?` · NVR: ${e.name_source}`:""}`,state:e.status==="online"?"live":e.status==="offline"?"offline":"unknown",fps:e.stream?.fps?String(e.stream.fps):"—",bitrate:e.stream?.bitrate_kbps?`${(e.stream.bitrate_kbps/1024).toFixed(1)} Mbps`:"—",firmware:e.stream?.resolution?`${e.stream.resolution} ${e.stream.codec??""}`.trim():"—",lastEvent:e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z",""):"לא נבדק",scene:e.status==="online"?tr[(e.channel-1)%tr.length]:null,channel:e.channel,api:e})):G.map(e=>({id:e.id,name:e.name,sub:`${e.floor} · ערוץ ${e.id.replace("cam-","")}`,state:e.state,fps:e.fps?String(e.fps):"—",bitrate:e.bitrateKbps?`${(e.bitrateKbps/1024).toFixed(1)} Mbps`:"—",firmware:e.firmware,lastEvent:e.lastEvent,scene:e.state==="offline"||e.state==="forbidden"?null:Ke[e.id]??"lobby",channel:Number(e.id.replace("cam-",""))}))}net(e){return h`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0,1,2,3].map(t=>h`<rect x=${t*5.5} y=${11-t*3} width="4" height=${3+t*3} rx="1" fill=${t<e?e>=3?"#22c55e":"#f59e0b":"var(--sw-border-strong)"} />`)}</svg>`}render(){const e=this.rows,t=e.filter(a=>this.filter==="all"?!0:this.filter==="online"?a.state==="live":this.filter==="offline"?a.state==="offline":a.state==="stale"||a.state==="forbidden"||a.state==="unknown"),s=e.find(a=>a.id===this.selected),i=!!this.cameras;return r`
      <sw-page heading="בריאות מצלמות" subheading=${i?`${this.recorder?.name??"NVR"}${this.recorder?.model?` · ${this.recorder.model}`:""} · ${e.length} מצלמות רשומות · גילוי לקריאה בלבד`:"NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה"}>
        ${i&&this.canSync?r`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${this.busy?"מסנכרן…":"סנכרון מה־NVR (קריאה)"}</sw-button>`:r`<sw-button slot="actions" icon="refresh" ?disabled=${i}>בדיקת יכולות (קריאה)</sw-button>`}
        ${i&&this.discovery?r`<div style="font-size:var(--sw-fs-xs);color:${this.discovery.cameras_last_error?"var(--sw-danger)":"var(--sw-text-3)"};margin-block-end:8px">גילוי אוטומטי מה־NVR כל ${Math.round(this.discovery.interval_s/60)} דק׳ · ${this.discovery.cameras_last_error?`נכשל: ${this.discovery.cameras_last_error}`:this.discovery.cameras_last_ok?`הצליח ${this.discovery.cameras_last_ok.replace("T"," ").replace("Z"," UTC")}`:"טרם רץ"}${this.discovery.streams_last_error?` · זרמי go2rtc: ${this.discovery.streams_last_error}`:""}</div>`:c}
        ${i&&this.canSync?r`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>{this.dialog=!0,this.formAlias="",this.formChannel=(e.length?Math.max(...e.map(a=>a.channel)):0)+1}}>רישום ידני</sw-button>`:c}
        ${this.message?r`<div class="ok">${this.message}</div>`:c}
        ${this.error?r`<div class="err">${this.error}</div>`:c}
        <div class="filters">
          <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${e.length}>הכל</sw-chip>
          <sw-chip dot="#22c55e" ?selected=${this.filter==="online"} @click=${()=>this.filter="online"} count=${e.filter(a=>a.state==="live").length}>מחוברות</sw-chip>
          <sw-chip dot="#ef4444" ?selected=${this.filter==="offline"} @click=${()=>this.filter="offline"} count=${e.filter(a=>a.state==="offline").length}>מנותקות</sw-chip>
          <sw-chip dot="#f59e0b" ?selected=${this.filter==="issues"} @click=${()=>this.filter="issues"} count=${e.filter(a=>a.state!=="live"&&a.state!=="offline").length}>בעיות / לא נבדק</sw-chip>
          <span class="grow"></span>
          <sw-field style="inline-size:200px"><input type="search" placeholder="חיפוש מצלמה…" aria-label="חיפוש" /></sw-field>
        </div>
        <div class="stage">
          ${i&&!e.length?r`<sw-state-panel state="empty" heading="אין מצלמות רשומות" hint="הגדר את פרטי ה־NVR בהגדרות ה־Add-on ולחץ 'סנכרון מה־NVR', או רשום ערוץ ידנית."></sw-state-panel>`:r`<sw-table .columns=${this.columns} .rows=${t} .selected=${this.selected} @row-select=${a=>{this.selected=a.detail.id,this.alias=e.find(n=>n.id===a.detail.id)?.api?.alias??""}}></sw-table>`}
          ${s?r`<sw-drawer open heading=${s.name} subheading=${s.sub} @close=${()=>this.selected=null}>
                <sw-field label="כינוי מקומי" hint="שינוי כינוי אינו משנה OSD; שם ה־NVR נשמר בנפרד"><input .value=${i?this.alias:s.name} ?disabled=${!i||!this.canSync} @input=${a=>this.alias=a.target.value} /></sw-field>
                <dl>
                  <dt>שם ב־NVR</dt><dd>${i?s.api?.name_source||"—":`Camera ${s.channel}`}</dd>
                  <dt>Tracks</dt><dd><span class="ltr">${i?`${s.api?.main_track??"?"} / ${s.api?.sub_track??"?"}`:`${s.channel}01 / ${s.channel}02`}</span></dd>
                  <dt>מצב</dt><dd><sw-badge kind=${s.state}></sw-badge></dd>
                  <dt>נראתה לאחרונה</dt><dd>${s.lastEvent}</dd>
                </dl>
                <div class="hint">ניתוק מקור מוצג כניתוק, לא כאשמת הממשק. פעולות רגישות (אתחול, OSD) דורשות הרשאה ואישור ואינן בפיילוט.</div>
                <div slot="footer">
                  ${i&&this.canSync?r`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveAlias(s.id)}>שמור כינוי</sw-button>`:c}
                  <sw-button variant="danger" size="sm" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`:c}
        </div>
        ${i?this.recorder?r`<sw-card heading=${this.recorder.name}>
                <div class="nvr">
                  <div><span>דגם</span>${this.recorder.model??"לא נבדק"}</div>
                  <div><span>קושחה</span><span class="ltr">${this.recorder.firmware??"—"}</span></div>
                  <div><span>סנכרון אחרון</span>${this.recorder.last_seen_at?this.recorder.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</div>
                  <div><span>גישה</span>קריאה בלבד (ISAPI)</div>
                </div>
              </sw-card>`:c:r`<sw-card heading="NVR ראשי">
              <div class="nvr">
                <div><span>דגם</span>DS-76xx (הדגמה)</div>
                <div><span>קושחה</span><span class="ltr">V4.84.x</span></div>
                <div><span>ערוצים</span>10/16</div>
                <div><span>דיסק</span>1 · תקין · 30% פנוי</div>
                <div><span>שעון</span>NTP · סטייה 2 שנ׳</div>
                <div><span>חיפוש במקביל</span>1 (מגבלת מכשיר)</div>
              </div>
            </sw-card>`}
        ${this.dialog?r`<sw-dialog open heading="רישום מצלמה ידני" subheading="כשה־NVR לא מוגדר עדיין; הסנכרון יעדכן שם ומצב" @close=${()=>this.dialog=!1}>
              <sw-field label="מספר ערוץ ב־NVR"><input type="number" min="1" max="256" data-ltr .value=${String(this.formChannel)} @input=${a=>this.formChannel=Number(a.target.value)} /></sw-field>
              <sw-field label="כינוי"><input .value=${this.formAlias} @input=${a=>this.formAlias=a.target.value} placeholder="למשל: כניסה ראשית" /></sw-field>
              ${this.error?r`<div class="err">${this.error}</div>`:c}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formAlias.trim()||this.busy} @click=${()=>this.register()}>רישום</sw-button>
            </sw-dialog>`:c}
      </sw-page>
    `}};ue.styles=z`
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .cam {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cam img.snap {
      inline-size: 48px;
      block-size: 32px;
      object-fit: cover;
      border-radius: 5px;
      flex-shrink: 0;
      background: var(--sw-surface-3);
    }
    .cam sw-scene,
    .cam .none {
      inline-size: 48px;
      block-size: 32px;
      border-radius: 5px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .cam .none {
      background: var(--sw-surface-3);
    }
    .cam b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .cam small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c);
    }
    svg.net {
      inline-size: 22px;
      block-size: 14px;
      direction: ltr;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .ok {
      font-size: var(--sw-fs-xs);
      color: #15803d;
    }
    .nvr {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    .nvr div {
      font-size: var(--sw-fs-sm);
    }
    .nvr span {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
  `;ke([d()],ue.prototype,"selected",2);ke([d()],ue.prototype,"filter",2);ke([d()],ue.prototype,"cameras",2);ke([d()],ue.prototype,"recorder",2);ke([d()],ue.prototype,"canSync",2);ke([d()],ue.prototype,"discovery",2);ke([d()],ue.prototype,"busy",2);ke([d()],ue.prototype,"message",2);ke([d()],ue.prototype,"error",2);ke([d()],ue.prototype,"dialog",2);ke([d()],ue.prototype,"formChannel",2);ke([d()],ue.prototype,"formAlias",2);ke([d()],ue.prototype,"alias",2);ue=ke([S("system-devices")],ue);const ra="sw.design.override",na="sw.design.last",gs={a:"SW A",b:"SW B"};let Ts="b";const Fi=new Set;function Js(e){try{return localStorage.getItem(e)}catch{return null}}function Ur(e,t){try{t===null?localStorage.removeItem(e):localStorage.setItem(e,t)}catch{}}function eh(){try{const s=new URLSearchParams(window.location.search).get("design");if(s==="a"||s==="b")return s}catch{}const e=Js(ra);if(e==="a"||e==="b")return e;const t=Js(na);return t==="a"||t==="b"?t:"b"}Ts=eh();function Wi(){const e=Js(ra);return e==="a"||e==="b"?e:null}function th(e){Ur(ra,e),qr()}function Zr(){return Ts}function sh(e){return Fi.add(e),e(Ts),()=>Fi.delete(e)}function ht(e){Ts=e,document.documentElement.dataset.design=e,Ur(na,e),Fi.forEach(t=>t(e))}function ih(e){try{const t=e?JSON.parse(e):{};return{a:(t.a||gs.a).slice(0,24),b:(t.b||gs.b).slice(0,24)}}catch{return{...gs}}}async function qr(){const e=new URLSearchParams(window.location.search).get("design");if(e==="a"||e==="b")return ht(e),e;const t=Wi();if(t)return ht(t),t;if(!g())return ht("b"),"b";const s=Js(na);(s==="a"||s==="b")&&ht(s);try{const a=(await je())["ui.design"]==="b"?"b":"a";return ht(a),a}catch{return ht(s==="b"?"b":"a"),Ts}}const ah={manual:"ידני",upload:"הועלה","auto-pre-upgrade":"אוטומטי · לפני עדכון","auto-daily":"אוטומטי · יומי"},Si={sites:"אתרים",buildings:"מבנים",floors:"קומות",plan_assets:"קבצי תוכנית",plan_versions:"גרסאות תוכנית",map_anchors:"עוגנים",cameras:"מצלמות",spatial_zones:"אזורים",settings:"הגדרות",users:"משתמשים",bindings:"הרשאות",groups:"קבוצות"},rh=()=>k("backups"),nh=(e={})=>M("backups",e),oh=e=>me(`backups/${encodeURIComponent(e)}`),lh=(e,t)=>M(`backups/${encodeURIComponent(e)}/restore`,t),dh=e=>he(`backups/${encodeURIComponent(e)}/download`);function ch(e){const t=new FormData;return t.append("file",e,e.name),ri("backups/upload",t)}function sr(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(0)} KB`:`${(e/1024/1024).toFixed(1)} MB`}var ph=Object.defineProperty,hh=Object.getOwnPropertyDescriptor,F=(e,t,s,i)=>{for(var a=i>1?void 0:i?hh(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ph(t,s,a),a};const ir=[{id:"general",label:"כללי"},{id:"media",label:"וידאו ומדיה"},{id:"ha",label:"גשר Home Assistant"},{id:"health",label:"בריאות ועבודות"},{id:"backup",label:"גיבוי ושחזור"},{id:"support",label:"תמיכה"}];let L=class extends x{constructor(){super(...arguments),this.tab="general",this.settings=null,this.canEdit=!1,this.draft={},this.streams=null,this.go2rtc=null,this.foreign=0,this.sessions=[],this.busy=!1,this.message="",this.error="",this.version="",this.ha=null,this.pairing=null,this.showCode=!1,this.regenArmed=!1,this.copied=!1,this.report=null,this.reportBusy=!1,this.backups=null,this.backupPolicy={},this.backupBusy=!1,this.backupNote="",this.backupMsg="",this.restoreTarget=null,this.restoreMode="replace",this.restoreAccess=!1,this.restoreConfirm="",this.health=null}connectedCallback(){super.connectedCallback();const e=Xt().params.get("tab");e&&ir.some(t=>t.id===e)&&(this.tab=e,e==="health"&&this.loadReport(),e==="backup"&&this.loadBackups(),e==="media"&&this.loadMedia(),e==="ha"&&this.loadHa()),this.loadSettings()}async loadSettings(){if(g())try{const[e,t]=await Promise.all([ur(),k("health").catch(()=>null)]);this.settings=e.settings,this.canEdit=e.can_edit,this.draft={},this.version=t?.version??"",this.health=t??null}catch(e){this.error=w(e)}}async loadMedia(){if(!(!g()||!this.canEdit))try{const[e,t]=await Promise.all([Qn(),eo()]);this.streams=e.streams,this.go2rtc=e.go2rtc,this.foreign=e.foreign_streams,this.sessions=t.sessions,this.error=""}catch(e){this.streams=[],this.error=w(e)}}async loadHa(e=!1){if(g()){this.error="";try{this.ha=await ul(),this.canEdit&&(this.pairing=await ml(e)),e&&(this.regenArmed=!1,this.showCode=!0,this.message="נוצר קוד צימוד חדש; יש להגדיר מחדש את האינטגרציה ב־Home Assistant.",setTimeout(()=>this.message="",4e3))}catch(t){this.error=w(t)}}}async copyCode(){if(this.pairing)try{await navigator.clipboard.writeText(this.pairing.pairing_code),this.copied=!0,setTimeout(()=>this.copied=!1,2e3)}catch{this.showCode=!0}}async installBridgeNow(){this.busy=!0,this.error="";try{const e=await fl();this.message=e.state==="installed_pending"?"האינטגרציה הועתקה ל־Home Assistant; הפעל מחדש את Home Assistant ואשר את הגשר שהתגלה.":e.state==="active"?"האינטגרציה פעילה.":e.state==="not_available"?"תיקיית ההגדרות של Home Assistant אינה נגישה ל־Add-on.":`מצב: ${e.state}`,await this.loadHa(),setTimeout(()=>this.message="",6e3)}catch(e){this.error=w(e)}finally{this.busy=!1}}integrationText(e){switch(e.state){case"active":return`פעילה ב־Home Assistant (גרסה ${e.active_version??"?"})`;case"installed_pending":return`הועתקה לתיקיית ההגדרות של HA (גרסה ${e.installed_version??"?"}) ב־${Re(e.installed_at)} · הפעל מחדש את Home Assistant ואז אשר את "SMPLWISE Bridge" שהתגלה בהגדרות → מכשירים ושירותים`;case"update_pending":return`עודכנה לגרסה ${e.installed_version??"?"} אך Home Assistant עדיין מריץ ${e.active_version??"?"} · נדרש Restart ל־Home Assistant`;case"not_installed":return"טרם הועתקה";case"error":return`ההעתקה נכשלה (${e.last_error??""})`;default:return e.last_error==="ha_config_not_mapped"?"ה־Add-on לא רואה את תיקיית ההגדרות של Home Assistant (המיפוי homeassistant_config לא ניתן) · התקנה ידנית לפי השלבים למטה":e.last_error==="source_missing"?"קבצי האינטגרציה חסרים בתמונת ה־Add-on · התקנה ידנית לפי השלבים למטה":`ההתקנה האוטומטית נכשלה (${e.last_error??"סיבה לא ידועה"}) · התקנה ידנית לפי השלבים למטה`}}renderIntegration(e){const t=e.integration;if(!t)return c;const s=t.state==="active"?"live":t.state==="installed_pending"||t.state==="update_pending"?"stale":t.state==="error"?"error":"unknown",i=t.state==="active"?"פעילה":t.state==="installed_pending"?"ממתינה ל־Restart":t.state==="update_pending"?"עדכון ממתין":t.state==="error"?"שגיאה":t.state==="not_installed"?"לא הותקנה":"לא זמין";return r`<div class="row"><span class="lbl">התקנת האינטגרציה ב־Home Assistant<span class="muted">${this.integrationText(t)}${t.discovery_posted_at?` · הוכרזה ל־Supervisor ${Re(t.discovery_posted_at)}`:""}</span></span><span style="display:flex;gap:8px;align-items:center"><sw-badge kind=${s} label=${i}></sw-badge>${this.canEdit&&t.state!=="not_available"?r`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.installBridgeNow()}>התקן / עדכן</sw-button>`:c}</span></div>`}renderHa(){if(!g())return r`<div class="sections"><sw-card heading="גשר Home Assistant"><div class="muted">נתוני הדגמה — הסטטוס והצימוד זמינים מול השרת.</div></sw-card></div>`;const e=this.ha,t=e?.sync,s=this.pairing;return r`<div class="sections">
      <sw-card heading="חיבור ל־Home Assistant" subheading="קריאה בלבד: מצבים, רישום ישויות, אזורים וקומות">
        ${e?r`
            <div class="row"><span class="lbl">גישה ל־API של Home Assistant<span class="muted">${e.configured?"דרך ה־Supervisor (homeassistant_api) או HA_URL בפיתוח":"לא מוגדר — ה־Add-on לא קיבל SUPERVISOR_TOKEN"}</span></span><sw-badge kind=${e.configured?"live":"offline"}></sw-badge></div>
            <div class="row"><span class="lbl">סנכרון מצבים (WebSocket)<span class="muted">${t?.connected?`מחובר · HA ${t.ha_version??"?"} · ${t.entities} ישויות · אירוע אחרון ${Re(t.last_event_at)}`:`מנותק${t?.last_error?` · ${t.last_error}`:""} · ${t?.reconnects??0} חיבורים מחדש`}</span></span><sw-badge kind=${t?.connected?"live":"offline"}></sw-badge></div>
            <div class="row"><span class="lbl">רישום ישויות (registry)<span class="muted">עודכן ${Re(t?.last_registry_at)} · תמונת מצב ${Re(t?.last_snapshot_at)}</span></span><sw-button size="sm" @click=${()=>b("/explore/entities")}>לקטלוג</sw-button></div>`:r`<div class="muted">טוען…</div>`}
      </sw-card>
      <sw-card heading="גשר SMPLWISE (אינטגרציה ב־Home Assistant)" subheading="פעולות על ישויות רצות רק דרך הגשר, בזהות המשתמש, לפי ההרשאות של Home Assistant">
        ${e?r`${this.renderIntegration(e)}<div class="row"><span class="lbl">צימוד<span class="muted">${e.bridge.paired?`מצומד מאז ${Re(e.bridge.paired_at)}`:"לא מצומד — פעולות HA ייחסמו עד להתקנת הגשר"}</span></span><sw-badge kind=${e.bridge.paired?"live":"stale"} label=${e.bridge.paired?"מצומד":"לא מצומד"}></sw-badge></div>
            <div class="row"><span class="lbl">ספריית משתמשי HA<span class="muted">${e.bridge.directory_users} משתמשים · עודכן ${Re(e.bridge.last_directory_at)}</span></span><sw-badge kind=${e.bridge.directory_users?"recorded":"unknown"}></sw-badge></div>`:c}
        ${s?r`<div class="row"><span class="lbl">כתובת ה־Add-on ברשת של HA<span class="muted">להדביק בשדה "כתובת" של האינטגרציה</span></span><code class="ltr">${s.addon_url}</code></div>
            <div class="row"><span class="lbl">קוד צימוד<span class="muted">סוד משותף; מוצג רק למנהלי מערכת ונרשם באודיט</span></span><span style="display:flex;gap:8px;align-items:center"><code class="ltr">${this.showCode?s.pairing_code:"••••••••••••"}</code><sw-button size="sm" @click=${()=>this.showCode=!this.showCode}>${this.showCode?"הסתר":"הצג"}</sw-button><sw-button size="sm" @click=${()=>this.copyCode()}>${this.copied?"הועתק":"העתק"}</sw-button></span></div>
            <div class="row"><span class="lbl">יצירת קוד חדש<span class="muted">מבטל את הצימוד הקיים; יש להגדיר מחדש את האינטגרציה</span></span>${this.regenArmed?r`<span style="display:flex;gap:8px"><sw-button size="sm" variant="danger" @click=${()=>this.loadHa(!0)}>אשר יצירה</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.regenArmed=!1}>ביטול</sw-button></span>`:r`<sw-button size="sm" @click=${()=>this.regenArmed=!0}>צור קוד חדש</sw-button>`}</div>`:this.canEdit?c:r`<div class="muted">קוד הצימוד מוצג למנהלי מערכת בלבד.</div>`}
      </sw-card>
      <sw-card heading="התקנת הגשר (פעם אחת)">
        <ol class="steps">
          <li>ה־Add-on מעתיק בעצמו את <code class="ltr">custom_components/smplwise_bridge</code> אל תיקיית ההגדרות של Home Assistant (השורה "התקנת האינטגרציה" למעלה). אם זה לא זמין: העתק את התיקייה מהמאגר אל <code class="ltr">/config/custom_components/</code>, או הוסף את המאגר ב־HACS כ־Custom repository מסוג Integration.</li>
          <li>הפעל מחדש את Home Assistant (הגדרות → מערכת → הפעלה מחדש) כדי שהרכיב ייטען.</li>
          <li>הגדרות → מכשירים ושירותים: אשר את <strong>SMPLWISE Bridge</strong> שהתגלה (קוד הצימוד כבר מולא). אם לא הופיע: הוספת אינטגרציה → SMPLWISE Bridge והדבקת הכתובת והקוד מהמסך הזה.</li>
          <li>הסטטוס למעלה יתעדכן ל"מצומד"; ספריית המשתמשים נשלחת כל דקה ומאפשרת להקצות תפקידים למשתמשי HA.</li>
        </ol>
        <div class="muted">הגשר מריץ רק פעולות מרשימת ההיתר (תאורה, מתגים, מאווררים, תריסים, מנעולים, כפתורים, סקריפטים, סצנות) ורק עבור משתמש HA קיים ופעיל. ה־Supervisor token של ה־Add-on אינו משמש לפעולות.</div>
      </sw-card>
    </div>`}set(e,t){this.draft={...this.draft,[e]:t}}value(e){return this.draft[e]??this.settings?.[e]}async save(){if(Object.keys(this.draft).length){this.busy=!0,this.error="";try{const e=await Jn(this.draft);this.settings=e.settings,this.draft={},Ca(),this.message="ההגדרות נשמרו",setTimeout(()=>this.message="",2500)}catch(e){this.error=w(e)}finally{this.busy=!1}}}async sync(){this.busy=!0,this.error="";try{const e=await Xn();this.message=`זרמים: ${e.created} נוצרו, ${e.updated} עודכנו, ${e.unchanged} ללא שינוי · ${e.foreign_streams_untouched} זרמים זרים לא נגעו`,await this.loadMedia()}catch(e){this.error=w(e)}finally{this.busy=!1}}renderDesign(){if(!g())return c;const e=ih(this.value("ui.design_names")),t=this.value("ui.design")??"a",s=Wi(),i="ui.design"in this.draft||"ui.design_names"in this.draft,a=(n,o)=>this.set("ui.design_names",JSON.stringify({...e,[n]:o.slice(0,24)}));return r`<sw-card heading="עיצוב הממשק" subheading=${`פעיל עכשיו בדפדפן הזה: ${e[Zr()]}${s?" (עקיפה מקומית)":""}`}>
      <div class="row"><span class="lbl">ברירת המחדל של המערכת<span class="muted">חל על כל המשתמשים; כל אחד יכול לעקוף בדפדפן שלו</span></span><sw-field class="ctl"><select ?disabled=${!this.canEdit} @change=${n=>this.set("ui.design",n.target.value)}><option value="a" ?selected=${t==="a"}>${e.a}</option><option value="b" ?selected=${t==="b"}>${e.b}</option></select></sw-field></div>
      <div class="row"><span class="lbl">שם העיצוב החדש<span class="muted">ברירת מחדל: ${gs.a} · העיצוב מחבילת 50 המסכים</span></span><sw-field class="ctl"><input maxlength="24" ?disabled=${!this.canEdit} .value=${e.a} @change=${n=>a("a",n.target.value)} /></sw-field></div>
      <div class="row"><span class="lbl">שם העיצוב הקודם<span class="muted">ברירת מחדל: ${gs.b} · הלוחות המקוריים</span></span><sw-field class="ctl"><input maxlength="24" ?disabled=${!this.canEdit} .value=${e.b} @change=${n=>a("b",n.target.value)} /></sw-field></div>
      <div class="row"><span class="lbl">בדפדפן הזה בלבד<span class="muted">עקיפה אישית שנשמרת במכשיר; לא משנה את ברירת המחדל</span></span><sw-field class="ctl"><select @change=${n=>{const o=n.target.value;th(o==="a"||o==="b"?o:null),o!=="a"&&o!=="b"&&ht(t),this.requestUpdate()}}><option value="" ?selected=${!s}>לפי ברירת המחדל</option><option value="a" ?selected=${s==="a"}>${e.a}</option><option value="b" ?selected=${s==="b"}>${e.b}</option></select></sw-field></div>
      ${this.canEdit?r`<div class="foot"><sw-button variant="primary" size="sm" icon="check" ?disabled=${!i||this.busy} @click=${()=>this.saveDesign()}>שמור עיצוב</sw-button>${this.message&&this.tab==="general"?r`<span class="ok" style="align-self:center">${this.message}</span>`:c}${this.error&&this.tab==="general"?r`<span class="err" style="align-self:center">${this.error}</span>`:c}</div>`:c}
    </sw-card>`}async saveDesign(){await this.save(),!Wi()&&this.settings&&ht(this.settings["ui.design"]==="b"?"b":"a")}renderGeneral(){return r`<div class="sections">
      ${this.renderDesign()}
      <sw-card heading="זמן ומיקום">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>(UTC+02:00) Asia/Jerusalem</option></select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>
        ${g()?c:r`<div class="row"><span class="lbl">NTP במכשיר<span class="muted">pool.ntp.org · סטייה 2 שנ׳</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>`}
      </sw-card>
      <sw-card heading="מדיניות אחסון (קריאה מה־NVR)">
        <div class="row"><span class="lbl">שמירת הקלטות</span><sw-field class="ctl"><select disabled><option>לפי מקום פנוי (overwrite)</option></select></sw-field></div>
        <div class="row"><span class="lbl">כשהאחסון מתמלא</span><sw-field class="ctl"><select disabled><option>דריסת הישן ביותר</option></select></sw-field></div>
        <div class="row"><span class="lbl">התראת אחסון נמוך<span class="muted">מתחת ל־10% פנוי</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">זרמים בשם smplwise_* בלבד · זרמים זרים לא ייגעו</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm" @click=${()=>{this.tab="media",this.loadMedia()}}>הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Home Assistant<span class="muted">קטלוג ישויות, פעולות בשם המשתמש וספריית המשתמשים</span></span><sw-button size="sm" @click=${()=>{this.tab="ha",this.loadHa()}}>הגדרה</sw-button></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">
        <div class="row"><span class="health"><i class="dot"></i><span class="lbl">מצב חלקי<span class="muted">גשר HA טרם חובר · שאר הרכיבים תקינים</span></span></span><sw-button size="sm" icon="activity">הרצת דיאגנוסטיקה</sw-button></div>
      </sw-card>
    </div>`}renderMedia(){const e=g(),t=Object.keys(this.draft).length>0;return r`<div class="sections">
      <sw-card heading="תעבורת וידאו" subheading="ברירת המחדל לכל הנגנים; כל נגן יכול לעקוף אותה לדפדפן הנוכחי">
        <div class="row"><span class="lbl">תעבורה ברירת מחדל<span class="muted">MSE (ברירת המחדל) עובד דרך Ingress, Cloudflare ומאחורי CGNAT · WebRTC נותן השהיה נמוכה אך דורש UDP ישיר ל־go2rtc (רשת מקומית או ללא CGNAT) · אוטומטי מנסה WebRTC ונופל ל־MSE</span></span>
          <sw-field class="ctl"><select ?disabled=${!e||!this.canEdit} @change=${s=>this.set("media.transport_default",s.target.value)}>
            ${["mse","auto","webrtc"].map(s=>r`<option value=${s} ?selected=${(this.value("media.transport_default")??"mse")===s}>${s==="auto"?"אוטומטי (WebRTC → MSE)":s==="webrtc"?"WebRTC בלבד":"MSE (ברירת מחדל)"}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל לקיר המצלמות<span class="muted">משני חוסך CPU ורוחב פס; ראשי לתצוגה בודדת</span></span>
          <sw-field class="ctl"><select ?disabled=${!e||!this.canEdit} @change=${s=>this.set("media.wall_profile",s.target.value)}>
            <option value="sub" ?selected=${(this.value("media.wall_profile")??"sub")==="sub"}>משני</option><option value="main" ?selected=${this.value("media.wall_profile")==="main"}>ראשי</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מצלמות בקיר כברירת מחדל<span class="muted">כל דפדפן זוכר את הבחירה האחרונה שלו; זו נקודת הפתיחה. מעל מכסת הזרמים החיים האריחים מציגים צילום</span></span>
          <sw-field class="ctl"><select data-set-wall-count ?disabled=${!e||!this.canEdit} @change=${s=>this.set("ui.wall_count",Number(s.target.value))}>
            ${[1,2,4,6,8,9,12,16,20,25,32].map(s=>r`<option value=${s} ?selected=${Number(this.value("ui.wall_count")??4)===s}>${s}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פריסת קיוסק כברירת מחדל<span class="muted">עמודות × שורות בעמוד; קישור קיוסק עם cols/rows גובר</span></span>
          <sw-field class="ctl"><select data-set-kiosk-layout ?disabled=${!e||!this.canEdit} @change=${s=>{const[i,a]=s.target.value.split("x").map(Number);this.set("ui.kiosk_cols",i),this.set("ui.kiosk_rows",a)}}>
            ${[[2,2],[3,2],[3,3],[4,3],[4,4],[5,4],[6,4]].map(([s,i])=>r`<option value=${`${s}x${i}`} ?selected=${Number(this.value("ui.kiosk_cols")??3)===s&&Number(this.value("ui.kiosk_rows")??2)===i}>${s}×${i} · ${s*i} מצלמות</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">מסך פתיחה<span class="muted">המסך שהמערכת נפתחת עליו כשהכתובת לא מציינת מסך (ריענון של הכתובת הראשית)</span></span>
          <sw-field class="ctl"><select data-set-start-route ?disabled=${!e||!this.canEdit} @change=${s=>this.set("ui.start_route",s.target.value)}>
            ${[["explore","מפת קומה"],["live","סקירה (לייב)"],["wall","כל המצלמות"],["events","מרכז אירועים"],["playback","הקלטות"]].map(([s,i])=>r`<option value=${s} ?selected=${String(this.value("ui.start_route")??"explore")===s}>${i}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">הסתרת המפה<span class="muted">מסיר את אזור המפה מהניווט לכל המשתמשים; למשתמש בודד: תפקיד בלי ההרשאה map.read</span></span>
          <sw-field class="ctl"><select data-set-hide-map ?disabled=${!e||!this.canEdit} @change=${s=>this.set("ui.hide_map",s.target.value)}>
            <option value="false" ?selected=${String(this.value("ui.hide_map")??"false")!=="true"}>מוצגת</option><option value="true" ?selected=${String(this.value("ui.hide_map")??"false")==="true"}>מוסתרת</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">HA recorder כמקור משני להיסטוריה<span class="muted">במפה ההיסטורית: כשההיסטוריה המקומית לא יודעת מצב של ישות, הוא נקרא מה־recorder של Home Assistant ומסומן כמקור משני</span></span>
          <sw-field class="ctl"><select data-set-ha-secondary ?disabled=${!e||!this.canEdit} @change=${s=>this.set("history.ha_secondary",s.target.value)}>
            <option value="false" ?selected=${String(this.value("history.ha_secondary")??"false")!=="true"}>כבוי</option><option value="true" ?selected=${String(this.value("history.ha_secondary")??"false")==="true"}>פעיל</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">הסתרת חיפוש AI<span class="muted">מסיר את הלשונית מהניווט; המסך עצמו נשאר זמין בכתובת</span></span>
          <sw-field class="ctl"><select data-set-hide-search ?disabled=${!e||!this.canEdit} @change=${s=>this.set("ui.hide_search",s.target.value)}>
            <option value="false" ?selected=${String(this.value("ui.hide_search")??"false")!=="true"}>מוצג</option><option value="true" ?selected=${String(this.value("ui.hide_search")??"false")==="true"}>מוסתר</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל<span class="muted">מגן על ה־NVR; מעבר למכסה מוצג צילום בלבד</span></span><sw-field class="ctl"><input type="number" min="1" max="32" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("media.max_live_sessions")??8)} @change=${s=>this.set("media.max_live_sessions",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">רעננות צילום (שניות)<span class="muted">snapshot מה־NVR לאריחים; cache בשרת</span></span><sw-field class="ctl"><input type="number" min="5" max="3600" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("snapshots.max_age_s")??60)} @change=${s=>this.set("snapshots.max_age_s",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">סשני ניגון במקביל<span class="muted">כל ניגון = זרם playback אחד מה־NVR דרך go2rtc</span></span><sw-field class="ctl"><input type="number" min="1" max="16" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("playback.max_sessions")??4)} @change=${s=>this.set("playback.max_sessions",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">פקיעת סשן ניגון ללא פעילות (שניות)<span class="muted">אחרי הזמן הזה הזרם נמחק מ־go2rtc אוטומטית</span></span><sw-field class="ctl"><input type="number" min="60" max="3600" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("playback.lease_s")??600)} @change=${s=>this.set("playback.lease_s",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">גודל ייצוא מקסימלי (MB)<span class="muted">לפי הנפח המשוער של קבצי ה־NVR בטווח</span></span><sw-field class="ctl"><input type="number" min="50" max="20480" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("exports.max_mb")??2048)} @change=${s=>this.set("exports.max_mb",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת קבצי ייצוא (ימים)<span class="muted">אחרי התקופה הקבצים נמחקים מ־/data/exports</span></span><sw-field class="ctl"><input type="number" min="1" max="365" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("exports.retention_days")??7)} @change=${s=>this.set("exports.retention_days",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת אירועים (ימים)<span class="muted">אירועים ישנים יותר נמחקים מהמאגר המקומי</span></span><sw-field class="ctl"><input type="number" min="1" max="3650" data-ltr data-set-events-retention ?disabled=${!e||!this.canEdit} .value=${String(this.value("events.retention_days")??30)} @change=${s=>this.set("events.retention_days",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת אודיט (ימים)<span class="muted">מי עשה מה ומתי — כתיבות ל־NVR, שינויי הרשאות, ייצוא; שורות ישנות יותר נמחקות</span></span><sw-field class="ctl"><input type="number" min="30" max="3650" data-ltr data-set-audit-retention ?disabled=${!e||!this.canEdit} .value=${String(this.value("audit.retention_days")??365)} @change=${s=>this.set("audit.retention_days",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">אזור זמן של האתר וה־NVR<span class="muted">IANA · חיפוש והקלטות מתורגמים לשעון הקיר של ה־NVR לפי הכלל הזה (כולל שעון קיץ)</span></span><sw-field class="ctl"><input type="text" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("time.zone")??"Asia/Jerusalem")} @change=${s=>this.set("time.zone",s.target.value.trim())} /></sw-field></div>
        <div class="foot"><sw-button variant="primary" icon="check" ?disabled=${!t||this.busy||!e} @click=${()=>this.save()}>שמור</sw-button>${this.message?r`<span class="ok" style="align-self:center">${this.message}</span>`:c}${this.error?r`<span class="err" style="align-self:center">${this.error}</span>`:c}</div>
        ${e?c:r`<div class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</div>`}
      </sw-card>
      <sw-card heading="go2rtc" subheading="זרמים של המוצר בשרת החיצוני (קריאה); זרמים זרים אינם מוצגים ואינם משתנים">
        ${!e||!this.canEdit?r`<div class="muted">${e?"נדרשת הרשאת מנהל מערכת.":"נתוני הדגמה."}</div>`:r`<div class="row"><span class="lbl">שרת<span class="muted">${this.go2rtc?`גרסה ${String(this.go2rtc.version??"?")}`:"לא נבדק"}</span></span><span style="display:flex;gap:8px"><sw-button size="sm" icon="refresh" ?disabled=${this.busy} @click=${()=>this.loadMedia()}>בדיקה</sw-button><sw-button size="sm" variant="primary" icon="link" ?disabled=${this.busy} @click=${()=>this.sync()}>סנכרון זרמים</sw-button></span></div>
              ${this.streams===null?c:this.streams.length?this.streams.map(s=>r`<div class="stream"><span>${s.name}</span><span>${s.online?"online":"idle"}</span></div>`):r`<div class="muted">אין עדיין זרמים של המוצר — לחץ "סנכרון זרמים".</div>`}
              ${this.streams!==null?r`<div class="muted" style="margin-block-start:6px">${this.foreign} זרמים זרים (אינטרקום, מצלמות אחרות) קיימים בשרת ולא נגענו בהם.</div>`:c}`}
      </sw-card>
      ${e&&this.canEdit?r`<sw-card heading="זרמים חיים כרגע" subheading="sessions דרך ה־relay של ה־Add-on">
            ${this.sessions.length?this.sessions.map(s=>r`<div class="row"><span class="lbl">${s.stream}<span class="muted">${s.username} · ${s.seconds} שנ׳ · ${(s.bytes_down/1024/1024).toFixed(1)} MB</span></span></div>`):r`<div class="muted">אין זרמים פתוחים.</div>`}
          </sw-card>`:c}
    </div>`}async loadReport(e=!1){if(g()){this.reportBusy=!0;try{this.report=await Nr(e)}catch(t){this.error=w(t)}finally{this.reportBusy=!1}}}renderReport(){const e=this.report;if(!e)return r`<div class="sections"><sw-card heading="בריאות המערכת"><div class="muted">${this.reportBusy?"בודק…":"טוען…"}</div></sw-card></div>`;const t=new Intl.DateTimeFormat("he-IL",{hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date(e.checked_at));return r`<div class="sections">
      <sw-card heading="בריאות המערכת" subheading="מצב נפרד לכל רכיב, לא נורה אחת">
        <div class="hsum"><sw-badge kind=${Ia[e.status]} label=${e.status==="ok"?"הכל תקין":e.status==="warn"?"יש מה לבדוק":"יש תקלה"}></sw-badge><span>גרסה <span class="ltr">${e.version}</span> · פעיל ${ud(e.uptime_s)} · נבדק <span class="ltr" data-health-checked>${t}</span></span><span class="grow"></span><sw-button size="sm" icon="refresh" ?disabled=${this.reportBusy} @click=${()=>this.loadReport(!0)}>${this.reportBusy?"בודק…":"בדוק עכשיו"}</sw-button></div>
        <div class="hgrid">${e.checks.map(s=>r`<div class="hcard ${s.status}" data-health-card=${s.id}><div class="hh"><span>${s.label}</span><sw-badge kind=${Ia[s.status]} label=${ms[s.status]}></sw-badge></div><div class="hd">${s.detail}</div></div>`)}</div>
        <div class="muted" style="margin-block-start:10px">בדיקות המכשירים (NVR, go2rtc) נשמרות ${e.probe_ttl_s} שניות; "בדוק עכשיו" מריץ אותן מחדש. זרמים זרים ב־go2rtc לעולם אינם נוגעים.</div>
      </sw-card>
    </div>`}renderHealth(){return g()?this.renderReport():r`<div class="sections">
      <sw-card heading="מצבים נפרדים, לא נורה אחת">${$r.map(e=>r`<div class="row"><span class="lbl">${e.name}<span class="muted">${e.detail}</span></span><sw-badge kind=${e.state}></sw-badge></div>`)}
        <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
        <div class="row"><span class="lbl">זרמים פעילים<span class="muted">${g()?`${this.sessions.length} דרך ה־relay`:"4 חיים · 1 ניגון · 0 יתומים"}</span></span><sw-badge kind="live"></sw-badge></div>
        ${g()&&this.health?.events?r`<div class="row"><span class="lbl">קליטת אירועים מה־NVR (alertStream)<span class="muted">${this.health.events.ingest.connected?`מחובר · פעימה אחרונה ${this.health.events.ingest.last_heartbeat_at?.replace("T"," ").replace("Z"," UTC")??"—"}`:`מנותק${this.health.events.ingest.last_error?` · ${this.health.events.ingest.last_error}`:""}`} · ${this.health.events.ingest.events_stored} אירועים נקלטו · ${this.health.events.ingest.reconnects} חיבורים מחדש</span></span><sw-badge kind=${this.health.events.ingest.connected?"live":"offline"}></sw-badge></div>
        <div class="row"><span class="lbl">אירועים מהקלטות (inferred)<span class="muted">${this.health.events.derive.last_error?`שגיאה: ${this.health.events.derive.last_error}`:this.health.events.derive.last_ok?`עודכן ${this.health.events.derive.last_ok.replace("T"," ").replace("Z"," UTC")}`:"טרם רץ"} · ${this.health.events.stored} אירועים במאגר</span></span><sw-badge kind=${this.health.events.derive.last_error?"stale":"recorded"}></sw-badge></div>`:c}
      </sw-card>
      <sw-card heading="תור עבודות">${yr.map(e=>r`<div class="row"><span class="lbl">${e.title}<span class="muted">${e.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${e.status.startsWith("נכשל")?"fail":""}"><i style="--p:${e.progress}%"></i></span><span class="ltr">${e.progress}%</span></span></div>`)}</sw-card>
    </div>`}async loadBackups(){if(g())try{const e=await rh();this.backups=e.backups,this.backupPolicy=e.policy}catch(e){this.error=w(e),this.backups=[]}}async createBackup(){this.backupBusy=!0,this.backupMsg="";try{const e=await nh({note:this.backupNote.trim()});this.backupNote="",this.backupMsg=`הגיבוי ${e.name} נוצר (${sr(e.bytes)})`,await this.loadBackups()}catch(e){this.error=w(e)}finally{this.backupBusy=!1}}async onBackupFile(e){if(e){this.backupBusy=!0,this.backupMsg="";try{const t=await ch(e);this.backupMsg=`הקובץ הועלה כ־${t.name}; עכשיו אפשר לשחזר ממנו`,await this.loadBackups()}catch(t){this.error=w(t)}finally{this.backupBusy=!1}}}async removeBackup(e){if(window.confirm(`למחוק את הגיבוי ${e.name}?`)){this.backupBusy=!0;try{await oh(e.name),await this.loadBackups()}catch(t){this.error=w(t)}finally{this.backupBusy=!1}}}openRestore(e){this.restoreTarget=e,this.restoreMode="replace",this.restoreAccess=!1,this.restoreConfirm=""}async doRestore(){const e=this.restoreTarget;if(!(!e||this.restoreConfirm!=="RESTORE")){this.backupBusy=!0,this.error="";try{const t=await lh(e.name,{mode:this.restoreMode,scope:this.restoreAccess?"project+access":"project",confirm:this.restoreConfirm}),s=Object.entries(t.tables).filter(([i])=>Si[i]).map(([i,a])=>`${a} ${Si[i]}`);this.backupMsg=`שוחזר מ־${e.name} (${t.mode==="replace"?"החלפה":"מיזוג"}): ${s.join(", ")} · ${t.files} קבצים`,this.restoreTarget=null,Ca(),await this.loadBackups()}catch(t){this.error=w(t)}finally{this.backupBusy=!1}}}fmtWhen(e){return new Intl.DateTimeFormat("he-IL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(e))}renderBackupRow(e){const t=["sites","floors","plan_versions","map_anchors","spatial_zones","cameras"].filter(s=>e.tables[s]!==void 0).map(s=>`${e.tables[s]} ${Si[s]}`).join(" · ");return r`<div class="brow" data-backup-row>
      <div>
        <div class="name"><span class="ltr">${e.name}</span><sw-badge kind=${e.kind.startsWith("auto")?"neutral":e.kind==="upload"?"stale":"live"} label=${ah[e.kind]??e.kind}></sw-badge>${e.valid?c:r`<sw-badge kind="error" label="קובץ לא תקין"></sw-badge>`}</div>
        <div class="sub">${this.fmtWhen(e.created_at)} · ${sr(e.bytes)} · גרסה ${e.app_version??"?"}${e.note?` · ${e.note}`:""}</div>
        ${t?r`<div class="sub">${t} · ${e.files} קבצי תוכנית</div>`:c}
      </div>
      <div class="acts">
        <a href=${dh(e.name)} download=${e.name} data-backup-download><sw-button size="sm" icon="download">הורד</sw-button></a>
        <sw-button size="sm" icon="history" ?disabled=${!e.valid||this.backupBusy} data-backup-restore @click=${()=>this.openRestore(e)}>שחזר</sw-button>
        <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.backupBusy} @click=${()=>this.removeBackup(e)}>מחק</sw-button>
      </div>
    </div>`}renderRestoreDialog(e){return r`<sw-dialog open heading="שחזור גיבוי" subheading=${e.name} @close=${()=>this.restoreTarget=null}>
      <div class="row"><span class="lbl">אופן השחזור<span class="muted">${this.restoreMode==="replace"?"הנתונים הנוכחיים של הפרויקט מוחלפים במה שבגיבוי":"רק פריטים שחסרים היום מתווספים; הקיימים נשארים"}</span></span>
        <select data-restore-mode @change=${t=>this.restoreMode=t.target.value}><option value="replace" ?selected=${this.restoreMode==="replace"}>החלפה</option><option value="merge" ?selected=${this.restoreMode==="merge"}>מיזוג</option></select></div>
      <div class="row"><span class="lbl">כולל משתמשים והרשאות<span class="muted">ברירת המחדל: רק נתוני הפרויקט. ההרשאות שלך נשמרות בכל מקרה.</span></span><sw-toggle ?checked=${this.restoreAccess} label="כולל הרשאות" labelHidden @change=${t=>this.restoreAccess=t.detail.checked}></sw-toggle></div>
      <div class="muted" style="margin-block-start:8px">הגיבוי מגרסה ${e.app_version??"?"} מ־${this.fmtWhen(e.created_at)}. השחזור נרשם באודיט. לאישור הקלד <code>RESTORE</code>:</div>
      <input class="confirm-in" data-restore-confirm placeholder="RESTORE" .value=${this.restoreConfirm} @input=${t=>this.restoreConfirm=t.target.value} />
      <div slot="footer"><sw-button variant="danger" icon="history" ?disabled=${this.restoreConfirm!=="RESTORE"||this.backupBusy} data-restore-go @click=${()=>this.doRestore()}>${this.backupBusy?"משחזר…":"שחזר עכשיו"}</sw-button><sw-button variant="ghost" @click=${()=>this.restoreTarget=null}>ביטול</sw-button></div>
    </sw-dialog>`}renderBackup(){const e=this.backups??[];return r`<div class="sections">
      <sw-card heading="גיבויים של הפרויקט" subheading="אתרים, קומות, תוכניות, עוגנים, אזורים, מצלמות והגדרות · בלי סודות ובלי וידאו">
        <div class="row"><span class="lbl">גיבוי ידני עכשיו<span class="muted">נשמר בתוך התוסף (/data/backups) ואפשר להוריד למחשב</span></span>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="note-in" placeholder="הערה (אופציונלי)" .value=${this.backupNote} @input=${t=>this.backupNote=t.target.value} /><sw-button variant="primary" size="sm" icon="download" ?disabled=${this.backupBusy||!g()} data-backup-create @click=${()=>this.createBackup()}>${this.backupBusy?"עובד…":"צור גיבוי"}</sw-button></span></div>
        <div class="row"><span class="lbl">העלאת גיבוי<span class="muted">קובץ zip שהורד מכאן (גם מהתקנה קודמת); אחרי ההעלאה לוחצים "שחזר"</span></span>
          <span><input type="file" accept=".zip,application/zip" hidden @change=${t=>{const s=t.target;this.onBackupFile(s.files?.[0]),s.value=""}} /><sw-button size="sm" icon="upload" ?disabled=${this.backupBusy||!g()} @click=${()=>this.renderRoot.querySelector("input[type=file]")?.click()}>בחר קובץ…</sw-button></span></div>
        ${this.backupMsg?r`<div class="muted" style="color:#15803d;padding-block:6px" data-backup-msg>${this.backupMsg}</div>`:c}
        ${g()?this.backups===null?r`<div class="muted">טוען…</div>`:e.length?r`<div class="blist" data-backups>${e.map(t=>this.renderBackupRow(t))}</div>`:r`<div class="muted" style="padding-block:6px">עדיין אין גיבויים. הראשון ייווצר אוטומטית לפני העדכון הבא, או עכשיו בלחיצה.</div>`:r`<div class="muted">נתוני הדגמה: הגיבויים עובדים מול השרת.</div>`}
      </sw-card>
      <sw-card heading="אוטומטי ו־Rollback">
        <div class="row"><span class="lbl">לפני כל עדכון גרסה<span class="muted">עותק של הנתונים נכתב לפני שהגרסה החדשה נוגעת במסד; נשמרים ${this.backupPolicy["auto-pre-upgrade"]??5} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">יומי<span class="muted">עותק אחד ביום, נשמרים ${this.backupPolicy["auto-daily"]??7} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">Rollback<span class="muted">חוזרים לגרסה קודמת דרך Home Assistant ואז משחזרים את הגיבוי "לפני עדכון" (החלפה)</span></span><span class="ltr">${this.version||"…"}</span></div>
        <div class="row"><span class="lbl">גיבוי Home Assistant<span class="muted">ה־Add-on מוגדר backup: hot, ולכן /data (כולל הגיבויים האלה) נכלל גם בגיבוי המלא של HA</span></span></div>
      </sw-card>
    </div>
    ${this.restoreTarget?this.renderRestoreDialog(this.restoreTarget):c}`}renderSupport(){return r`<div class="sections"><sw-card heading="חבילת תמיכה מצונזרת">
      <div class="muted" style="padding-block-end:8px">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span class="lbl">כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span class="lbl">כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" icon="download" disabled>יצירת חבילה (בהמשך)</sw-button></div>
    </sw-card></div>`}render(){return r`
      <sw-page heading="הגדרות המערכת" subheading=${g()?"תעבורת וידאו, go2rtc, מכסות ובריאות":"אזור זמן, מדיניות אחסון, אינטגרציות ובריאות · נתוני הדגמה"}>
        <sw-tabs underline .items=${ir} .active=${this.tab} @change=${e=>{this.tab=e.detail.id,this.tab==="media"&&this.loadMedia(),this.tab==="ha"&&this.loadHa(),this.tab==="backup"&&this.loadBackups(),this.tab==="health"&&this.loadReport()}}></sw-tabs>
        ${this.message&&this.tab==="ha"?r`<div class="muted" style="color:#15803d">${this.message}</div>`:c}
        ${this.error&&this.tab==="ha"?r`<div class="muted" style="color:var(--sw-error)">${this.error}</div>`:c}
        ${this.tab==="general"?this.renderGeneral():this.tab==="media"?this.renderMedia():this.tab==="ha"?this.renderHa():this.tab==="health"?this.renderHealth():this.tab==="backup"?this.renderBackup():this.renderSupport()}
      </sw-page>
    `}};L.styles=z`
    code {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface-2, var(--sw-accent-soft));
      padding: 2px 6px;
      border-radius: 4px;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .steps {
      margin: 0;
      padding-inline-start: 20px;
      font-size: var(--sw-fs-sm);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sections {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 760px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row .ctl {
      inline-size: 220px;
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .health {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .health .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-stale);
    }
    .hgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 10px;
    }
    .hcard {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      background: var(--sw-surface);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hcard.error {
      border-color: var(--sw-danger);
    }
    .hcard.warn {
      border-color: var(--sw-stale);
    }
    .hcard .hh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .hcard .hd {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      line-height: 1.5;
    }
    .hsum {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .hsum .grow {
      flex: 1;
    }
    .blist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-block-start: 8px;
    }
    .brow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px 12px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .brow .name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .brow .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .brow .acts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .brow a {
      text-decoration: none;
    }
    .note-in {
      inline-size: 200px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 6px 8px;
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .confirm-in {
      inline-size: 100%;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 8px 10px;
      font: inherit;
      font-family: var(--sw-font-mono);
      direction: ltr;
      margin-block-start: 8px;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .foot {
      display: flex;
      gap: 8px;
      padding-block-start: 10px;
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      inline-size: 140px;
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      inline-size: var(--p);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    .stream {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      padding: 5px 0;
      border-block-end: 1px solid var(--sw-border);
      font-family: var(--sw-font-mono);
      direction: ltr;
    }
    @media (max-width: 767px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row .ctl {
        inline-size: auto;
      }
    }
  `;F([d()],L.prototype,"tab",2);F([d()],L.prototype,"settings",2);F([d()],L.prototype,"canEdit",2);F([d()],L.prototype,"draft",2);F([d()],L.prototype,"streams",2);F([d()],L.prototype,"go2rtc",2);F([d()],L.prototype,"foreign",2);F([d()],L.prototype,"sessions",2);F([d()],L.prototype,"busy",2);F([d()],L.prototype,"message",2);F([d()],L.prototype,"error",2);F([d()],L.prototype,"version",2);F([d()],L.prototype,"ha",2);F([d()],L.prototype,"pairing",2);F([d()],L.prototype,"showCode",2);F([d()],L.prototype,"regenArmed",2);F([d()],L.prototype,"copied",2);F([d()],L.prototype,"report",2);F([d()],L.prototype,"reportBusy",2);F([d()],L.prototype,"backups",2);F([d()],L.prototype,"backupPolicy",2);F([d()],L.prototype,"backupBusy",2);F([d()],L.prototype,"backupNote",2);F([d()],L.prototype,"backupMsg",2);F([d()],L.prototype,"restoreTarget",2);F([d()],L.prototype,"restoreMode",2);F([d()],L.prototype,"restoreAccess",2);F([d()],L.prototype,"restoreConfirm",2);F([d()],L.prototype,"health",2);L=F([S("system-diagnostics")],L);var uh=Object.defineProperty,mh=Object.getOwnPropertyDescriptor,Xe=(e,t,s,i)=>{for(var a=i>1?void 0:i?mh(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&uh(t,s,a),a};const fh=[{name:"כניסה ראשית",gb:320},{name:"אולם",gb:410},{name:"חצר אחורית",gb:380},{name:"לובי",gb:180},{name:"מחסן",gb:96}];let Ce=class extends x{constructor(){super(...arguments),this.range="30D",this.data=null,this.error="",this.loading=!1,this.tz="Asia/Jerusalem",this.signing=null,this.signingError="",this.signingBusy=!1,this.rotateConfirm=!1}connectedCallback(){super.connectedCallback(),g()&&(this.load(),this.loadSigning())}async load(e=!1){this.loading=!0,this.error="";try{const[t,s]=await Promise.all([je(),Rr(e)]);this.tz=t["time.zone"]??this.tz,this.data=s}catch(t){this.error=w(t)}finally{this.loading=!1}}fmt(e){return e?new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,dateStyle:"short",timeStyle:"short"}).format(new Date(e)):"—"}async loadSigning(){try{this.signing=await mc(),this.signingError=""}catch(e){this.signingError=w(e)}}async rotateKey(){this.signingBusy=!0;try{this.signing=await fc(),this.rotateConfirm=!1}catch(e){this.signingError=w(e)}finally{this.signingBusy=!1}}renderSigning(){const e=this.signing,t=s=>s?s.replace("T"," ").replace("Z"," UTC"):"—";return r`<sw-card heading="חתימת ראיות" subheading="כל חבילת ראיות חתומה ב־Ed25519 במפתח הפעיל של המתקן; החלק הפרטי נשאר ב־/data/keys ואינו נכלל בגיבוי" data-signing>
      ${this.signingError?r`<div class="note">${this.signingError}</div>`:c}
      ${e?r`<div class="kv">
              <div><span>מפתח פעיל</span><strong class="ltr" data-signing-active>${e.active??"—"}</strong></div>
              <div><span>נוצר</span><strong>${t(e.keys.find(s=>s.kid===e.active)?.created_at??null)}</strong></div>
              <div><span>מפתחות שהוחלפו</span><strong>${e.keys.filter(s=>s.retired_at).length}</strong></div>
              <div><span>מפתח ציבורי (base64)</span><strong class="ltr" style="word-break:break-all;font-size:11px">${e.keys.find(s=>s.kid===e.active)?.public_key??"—"}</strong></div>
            </div>
            ${e.keys.filter(s=>s.retired_at).length?r`<div class="note">מפתחות שהוחלפו נשמרים לאימות חבילות ישנות: ${e.keys.filter(s=>s.retired_at).map(s=>`${s.kid} (עד ${t(s.retired_at)})`).join(", ")}</div>`:c}
            <div class="note" style="margin-block-start:6px">${e.trust} אימות מחוץ למערכת: <span class="ltr">scripts/verify_bundle.py bundle.zip --keyring keyring.json</span></div>
            ${e.can_rotate?this.rotateConfirm?r`<div class="note" style="margin-block-start:6px">החלפת מפתח: חבילות חדשות ייחתמו במפתח חדש; הישן נשאר בטבעת לאימות. הפעולה נרשמת באודיט. <sw-button size="sm" variant="danger" data-signing-rotate-confirm ?disabled=${this.signingBusy} @click=${()=>this.rotateKey()}>החלף עכשיו</sw-button> <sw-button size="sm" variant="ghost" @click=${()=>this.rotateConfirm=!1}>ביטול</sw-button></div>`:r`<div style="margin-block-start:8px"><sw-button size="sm" icon="refresh" data-signing-rotate @click=${()=>this.rotateConfirm=!0}>החלפת מפתח חתימה</sw-button></div>`:c}`:r`<div class="note">טוען…</div>`}
    </sw-card>`}renderApi(){if(this.error&&!this.data)return r`<sw-page heading="אחסון ותוכנית הקלטה"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;const e=this.data;if(!e)return r`<sw-page heading="אחסון ותוכנית הקלטה"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=e.totals,s=e.retention,i=16,a=2*Math.PI*i,n=t?.used_pct??0,o=s.measured_days_min==null?"—":s.measured_days_min===s.measured_days_max?`${s.measured_days_min}`:`${s.measured_days_min}–${s.measured_days_max}`;return r`
      <sw-page heading="אחסון ותוכנית הקלטה" subheading="קריאה בלבד מה־NVR · נמדד לעומת אומדן, עם הסיבה לכל מספר · אין format, RAID או מחיקה מכאן">
        <sw-button slot="actions" icon="refresh" data-storage-refresh ?disabled=${this.loading} @click=${()=>this.load(!0)}>${this.loading?"שואל את ה־NVR…":"רענון מול ה־NVR"}</sw-button>
        ${this.error?r`<div class="err">${this.error}</div>`:c}
        ${e.nvr.configured?e.nvr.reachable?r`
                <div class="kpis" data-storage-kpis>
                  <sw-card flush class="kpi"><div><div class="v">${zt(t?.used_mb)}</div><div class="l">בשימוש (נמדד מה־NVR)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${zt(t?.capacity_mb)}</div><div class="l">קיבולת · ${t?.disks??0} דיסקים${t?.nas?` · ${t.nas} NAS`:""} · מצב ${e.work_mode??"?"}</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${t?.used_pct==null?"—":`${t.used_pct}%`}</div><div class="l">ניצולת · פנוי ${zt(t?.free_mb)}</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${h`<circle cx="20" cy="20" r=${i} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${i} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${a*n/100} ${a}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
                </div>
                <sw-card heading="שמירת הקלטות (retention)" subheading="שני מספרים שונים בכוונה: מה שנמדד מול מה שמוערך" data-storage-retention>
                  <div class="ret">
                    <div><div class="v">${o}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ימים</span></div><div class="l"><strong>נמדד</strong> · ${s.measured_reason}</div></div>
                    <div><div class="v">${s.estimated_days==null?"—":`≈ ${s.estimated_days}`}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ימים</span></div><div class="l"><strong>אומדן</strong> · ${s.estimated_reason}</div></div>
                  </div>
                </sw-card>
                <div class="grid">
                  <sw-card heading="תוכנית הקלטה לפי מצלמה" subheading=${e.schedule_error??"נקרא מ־ISAPI record/tracks · pre/post בשניות · ההקלטה המוקדמת ביותר שנמצאה"}>
                    <div class="tbl cams" data-storage-cameras>
                      <div class="r h"><span>מצלמה</span><span>מצב הקלטה</span><span>pre / post</span><span>זרם</span><span>הקלטה מוקדמת ביותר</span><span class="num">ימים</span></div>
                      ${e.cameras.map(l=>r`<div class="r" data-storage-camera><span>${l.name}<small>ערוץ ${l.channel}${l.track_id?` · track ${l.track_id}`:""}</small></span><span>${l.summary}${l.expiry&&l.expiry!=="P0DT0H"?r`<small>תפוגה ${l.expiry}</small>`:c}</span><span class="num">${l.pre_s??"—"} / ${l.post_s??"—"}</span><span class="num">${l.bitrate_kbps?`${l.bitrate_kbps} kbps`:"—"}${l.resolution?r`<small class="num">${l.resolution}${l.fps?` · ${l.fps} fps`:""}</small>`:c}</span><span>${this.fmt(l.oldest_recording_at)}<small>${l.retention_reason}</small></span><span class="num">${l.retention_days??"—"}</span></div>`)}
                    </div>
                  </sw-card>
                  <div>
                    <sw-card heading="דיסקים" subheading=${`${t?.disks_ok??0} מתוך ${(t?.disks??0)+(t?.nas??0)} תקינים`}>
                      <div class="tbl disks" data-storage-disks>
                        <div class="r h"><span>שם</span><span>סוג</span><span>מצב</span><span class="num">קיבולת</span><span class="num">פנוי</span><span>גישה</span></div>
                        ${[...e.disks,...e.nas].map(l=>r`<div class="r" data-storage-disk><span>${l.name}${l.path?r`<small>${l.path}</small>`:c}</span><span>${l.kind}</span><span><sw-badge kind=${l.status==="ok"?"recorded":"error"} label=${l.status}></sw-badge></span><span class="num">${zt(l.capacity_mb)}</span><span class="num">${zt(l.free_mb)}</span><span>${l.property}</span></div>`)}
                      </div>
                    </sw-card>
                    ${this.renderSigning()}
                    <sw-card heading="מה המערכת לא עושה ב־NVR" subheading="גבולות הפיילוט" data-storage-limits>
                      <ul class="limits">${e.limits.notes.map(l=>r`<li>${l}</li>`)}</ul>
                      <div style="margin-block-start:6px"><sw-button size="sm" disabled icon="edit">עריכת מדיניות הקלטה (לא בפיילוט)</sw-button></div>
                    </sw-card>
                  </div>
                </div>
                <div class="hint">נקרא ${this.fmt(e.generated_at)}${e.cached?" · מהמטמון (עד 10 דקות)":" · עכשיו"} · חיפוש ההקלטה המוקדמת: ${s.lookback_days} ימים אחורה, שאילתה אחת לכל מצלמה.</div>
              `:r`<sw-state-panel state="error" heading="אין תשובה מה־NVR" hint=${e.nvr.error??""} actionLabel="נסה שוב" @action=${()=>this.load(!0)}></sw-state-panel>
                ${this.renderSigning()}`:r`<sw-state-panel state="empty" heading="ה־NVR לא מוגדר" hint="הגדר את פרטי ה־NVR בהגדרות התוסף; המסך קורא ממנו בלבד."></sw-state-panel>`}
      </sw-page>
    `}render(){if(g())return this.renderApi();const e=[.3,.36,.45,.5,.58,.63,.7],t=600,s=200,i=u=>u/(e.length-1)*420,a=u=>170-u*150,n=e.map((u,v)=>`${v===0?"M":"L"}${i(v)} ${a(u)}`).join(" "),o=`M${i(e.length-1)} ${a(.7)} L520 ${a(.86)} L${t} ${a(1)}`,l=16,p=2*Math.PI*l,f=410;return r`
      <sw-page heading="אנליטיקת אחסון" subheading="Beta · ניטור שימוש, תכנון קדימה ושליטה · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה">
        <div slot="actions" style="display:flex;gap:4px">${["7D","30D","90D","1Y"].map(u=>r`<sw-chip ?selected=${this.range===u} @click=${()=>this.range=u}>${u}</sw-chip>`)}</div>
        <div class="kpis">
          <sw-card flush class="kpi"><div><div class="v">1.3 TB</div><div class="l">אחסון בשימוש (נמדד)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">1.9 TB</div><div class="l">קיבולת כוללת</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">68%</div><div class="l">ניצולת · ≈ 11 ימים נשמרים</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${h`<circle cx="20" cy="20" r=${l} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${l} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${p*.68} ${p}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
        </div>
        <sw-card heading="תחזית שימוש באחסון" subheading="עד הקו: נתון נמדד · אחרי הקו: אומדן (אינו תחזית פשוטה של דיסק מתמלא)">
          <svg class="trend" viewBox="0 0 ${t} ${s}" preserveAspectRatio="none" role="img" aria-label="תחזית אחסון">
            ${h`
              ${[.25,.5,.75,1].map(u=>h`<line x1="0" x2=${t} y1=${a(u)} y2=${a(u)} stroke="var(--sw-border)" />`)}
              <path d="${n} L${i(e.length-1)} 170 L0 170 Z" fill="var(--sw-accent-soft)" />
              <path d="${n}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" />
              <path d="${o}" fill="none" stroke="var(--sw-accent)" stroke-width="2" stroke-dasharray="5 5" opacity="0.7" />
              <line x1=${i(e.length-1)} x2=${i(e.length-1)} y1="10" y2="170" stroke="var(--sw-stale)" stroke-dasharray="4 4" />
              <rect x="470" y="18" width="110" height="34" rx="6" fill="#fff" stroke="var(--sw-border)" />
              <text x="525" y="32" font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">אומדן מילוי</text>
              <text x="525" y="46" font-size="11" font-weight="600" text-anchor="middle" fill="var(--sw-text)" font-family="var(--sw-font)">≈ 25.09.2026</text>
              ${["ינו","פבר","מרץ","אפר","מאי","יונ","יול"].map((u,v)=>h`<text x=${i(v)} y="190" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${u}</text>`)}
              ${["0.5 TB","1 TB","1.5 TB","1.9 TB"].map((u,v)=>h`<text x="4" y=${a(.25*(v+1))-3} font-size="9.5" fill="var(--sw-text-3)" font-family="var(--sw-font)">${u}</text>`)}
            `}
          </svg>
        </sw-card>
        <div class="grid">
          <sw-card heading="שימוש באחסון לפי מצלמה" subheading="נמדד · לפני retention">
            ${fh.map(u=>r`<div class="cam"><span>${u.name}</span><span class="bar"><i style="--p:${u.gb/f*100}%"></i></span><span class="gb ltr">${u.gb} GB</span></div>`)}
            <div class="hint" style="margin-block-start:6px">מחיקת הקלטות לפי retention מבטלת cache בהתאם.</div>
          </sw-card>
          <sw-card heading="מדיניות הקלטה" subheading="קריאה מה־NVR">
            <div class="policy"><span class="ic"><sw-icon name="history" size=${14}></sw-icon></span><span>רציפה<small>5 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="activity" size=${14}></sw-icon></span><span>לפי תנועה<small>4 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="calendar" size=${14}></sw-icon></span><span>מתוזמנת<small>0 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="bell" size=${14}></sw-icon></span><span>לפי אירוע<small>1 מצלמה · pre/post 5s / 10s</small></span></div>
            <div style="margin-block-start:10px"><sw-button size="sm" disabled icon="edit">עריכת מדיניות (לא בפיילוט)</sw-button></div>
          </sw-card>
        </div>
      </sw-page>
    `}};Ce.styles=z`
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .kpi {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
    }
    .kpi .v {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .kpi .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .kpi .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin-inline-start: auto;
    }
    .kpi svg {
      inline-size: 40px;
      block-size: 40px;
      margin-inline-start: auto;
    }
    .trend {
      inline-size: 100%;
      block-size: 200px;
      direction: ltr;
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .cam {
      display: grid;
      grid-template-columns: 100px minmax(0, 1fr) 60px;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
    }
    .cam .bar {
      block-size: 8px;
      border-radius: 4px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .cam .bar i {
      display: block;
      block-size: 100%;
      inline-size: var(--p);
      background: var(--sw-accent);
      border-radius: 4px;
    }
    .cam .gb {
      text-align: end;
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .policy {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .policy:last-child {
      border-block-end: 0;
    }
    .policy .ic {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .policy small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tbl {
      display: flex;
      flex-direction: column;
    }
    .tbl .r {
      display: grid;
      gap: 8px;
      align-items: center;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .tbl .r:last-child {
      border-block-end: 0;
    }
    .tbl .h {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      border-block-end: 1px solid var(--sw-border-strong);
    }
    .tbl.disks .r {
      grid-template-columns: minmax(0, 1.2fr) 70px 90px 90px 90px 50px;
    }
    .tbl.cams .r {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.6fr) 90px 130px 150px 80px;
    }
    .tbl small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .num {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
      text-align: end;
    }
    .ret {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .ret .v {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .ret .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 4px;
    }
    .limits li {
      font-size: var(--sw-fs-sm);
      margin-block-end: 4px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .tbl.disks .r,
      .tbl.cams .r {
        grid-template-columns: 1fr 1fr;
      }
      .tbl .h {
        display: none;
      }
      .ret {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: 1fr;
      }
    }
  `;Xe([d()],Ce.prototype,"range",2);Xe([d()],Ce.prototype,"data",2);Xe([d()],Ce.prototype,"error",2);Xe([d()],Ce.prototype,"loading",2);Xe([d()],Ce.prototype,"tz",2);Xe([d()],Ce.prototype,"signing",2);Xe([d()],Ce.prototype,"signingError",2);Xe([d()],Ce.prototype,"signingBusy",2);Xe([d()],Ce.prototype,"rotateConfirm",2);Ce=Xe([S("system-storage")],Ce);var wh=Object.getOwnPropertyDescriptor,vh=(e,t,s,i)=>{for(var a=i>1?void 0:i?wh(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const gh=[{mode:"סקירה ומצלמות",items:[{sc:"SC01",name:"סקירה (Dashboard)",route:"#/live",phase:"PILOT",board:"1:01 · 2:15"},{sc:"SC07",name:"כל המצלמות (Grid)",route:"#/live/wall",phase:"PILOT",board:"1:06"},{sc:"SC08",name:"מצלמה בודדת",route:"#/live/cameras/cam-4",phase:"PILOT",board:"1:05"},{sc:"SC09",name:"תצוגות שמורות",route:"#/live/views",phase:"PILOT",board:"legacy"},{sc:"SC27",name:"בריאות מצלמות",route:"#/system/devices",phase:"PILOT",board:"2:12"},{sc:"SC31",name:"קיוסק / תצוגת קיר",route:"#/kiosk/all",phase:"BETA",board:"3:24"}]},{mode:"אתרים ומפות",items:[{sc:"SC02",name:"אתרים ומבנים",route:"#/explore/sites",phase:"PILOT",board:"1:02 · 3:17"},{sc:"SC03",name:"דפדפן קומות",route:"#/explore/buildings/bld-a/floors",phase:"PILOT",board:"1:03"},{sc:"SC04",name:"מפת קומה חיה",route:"#/explore/floors/f0",phase:"PILOT",board:"1:04"},{sc:"SC05",name:"ייבוא ותיקון תוכנית",route:"#/explore/floors/f-2/import",phase:"PILOT",board:"2:13"},{sc:"SC06",name:"עורך תוכנית ועוגנים",route:"#/explore/floors/f0/edit",phase:"PILOT",board:"2:13"},{sc:"SC10",name:"קטלוג ישויות HA",route:"#/explore/entities",phase:"PILOT",board:"new"},{sc:"SC23",name:"דלתות ואינטרקום",route:"#/explore/access/d1",phase:"V1",board:"3:18"}]},{mode:"אירועים והקלטות",items:[{sc:"SC14",name:"מרכז אירועים",route:"#/investigate/events",phase:"PILOT",board:"1:08"},{sc:"SC12",name:"הקלטות / ציר זמן",route:"#/investigate/playback",phase:"PILOT",board:"1:07 · 2:16"},{sc:"SC13",name:"מרכז שליטה / ניגון מסונכרן",route:"#/investigate/playback/sync",phase:"BETA",board:"2:14"},{sc:"SC11",name:"מפה היסטורית",route:"#/investigate/floors/f0/history",phase:"PILOT",board:"new"},{sc:"SC15",name:"תור Review",route:"#/investigate/reviews",phase:"BETA",board:"legacy"},{sc:"SC16",name:"תיקים",route:"#/investigate/cases",phase:"BETA",board:"2:10"},{sc:"SC17",name:"סקירת אירוע / תיק",route:"#/investigate/cases/case-1",phase:"BETA",board:"2:10"},{sc:"SC18",name:"ייצוא והורדות",route:"#/investigate/exports",phase:"BETA",board:"2:10"},{sc:"SC19",name:"חיפוש AI",route:"#/investigate/search",phase:"BETA",board:"2:09"},{sc:"SC21",name:"התראות וחוקים",route:"#/investigate/rules",phase:"BETA",board:"3:19"},{sc:"SC22",name:"עורך חוק",route:"#/investigate/rules/r-1",phase:"BETA",board:"3:19"}]},{mode:"הגדרות",items:[{sc:"SC28",name:"הגדרות המערכת",route:"#/system/diagnostics",phase:"PILOT",board:"3:23"},{sc:"SC24",name:"משתמשים והרשאות",route:"#/system/access",phase:"PILOT",board:"3:20"},{sc:"SC25",name:"יומן אודיט",route:"#/system/audit",phase:"PILOT",board:"3:21"},{sc:"SC20",name:"אנליטיקת אחסון",route:"#/system/storage",phase:"BETA",board:"2:11"},{sc:"SC26",name:"אשף התקנה",route:"#/system/setup",phase:"PILOT",board:"3:22"}]}],bh={PILOT:"live",BETA:"recorded",V1:"neutral"};let Ui=class extends x{render(){return r`
      <sw-page heading="כל המסכים (סקירת עיצוב)" subheading="29 מסכים על נתוני הדגמה · SC29/SC30 הם אותם מסכים ברוחב טלפון · SC32 (Lovelace) הוא עטיפה של אותם רכיבים">
        <div class="note">כל מסך מסומן ״נתוני הדגמה״. שום זרם וידאו, תמונה או מצב מכשיר אינם אמיתיים כאן (הסצנות מאוירות); המטרה היא לאשר את השפה החזותית, הניווט והזרימות לפני החיבור לנתונים.</div>
        <div class="groups">
          ${gh.map(e=>r`<sw-card heading=${e.mode}>
              ${e.items.map(t=>r`<a href=${t.route}><span class="sc">${t.sc}</span><span class="name">${t.name}</span><span class="board">${t.board}</span><sw-badge kind=${bh[t.phase]} label=${t.phase}></sw-badge><sw-icon name="chevron" size=${12}></sw-icon></a>`)}
            </sw-card>`)}
        </div>
      </sw-page>
    `}};Ui.styles=z`
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 12px;
      align-items: start;
    }
    a {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      color: var(--sw-text);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
    }
    a:last-child {
      border-block-end: 0;
    }
    a:hover {
      color: var(--sw-accent-text);
    }
    .sc {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      inline-size: 40px;
    }
    .name {
      flex: 1;
    }
    .board {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      direction: ltr;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
  `;Ui=vh([S("screens-index")],Ui);var yh=Object.getOwnPropertyDescriptor,$h=(e,t,s,i)=>{for(var a=i>1?void 0:i?yh(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const xh=[["--sw-bg","רקע"],["--sw-surface","משטח"],["--sw-surface-3","משטח 3"],["--sw-border","גבול"],["--sw-text","טקסט"],["--sw-text-2","טקסט משני"],["--sw-text-3","טקסט שלישי"],["--sw-accent","כחול"],["--sw-accent-soft","כחול רך"],["--sw-live","חי"],["--sw-offline","מנותק"],["--sw-stale","מיושן"],["--sw-danger","שגיאה"],["--sw-purple","סגול (דלת)"]],kh=["live","recorded","historic","offline","stale","partial","unknown","forbidden","error"],_h=["loading","empty","error","forbidden","stale","partial"],zh=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night","building","house"],Sh=["dashboard","building","camera","bell","history","system","search","user","play","pause","back10","forward10","aperture","volume","mic","expand","close","chevron","chevronDown","warning","info","lock","unlock","offline","refresh","layers","floor","plus","minus","fit","door","light","sensor","check","clock","download","pin","more","map","upload","list","target","filter","users","shield","storage","edit","case","rule","link","grid","home","star","calendar","trash","eye","cpu","activity","image","wifi","signal","move","bookmark","route"];let Zi=class extends x{render(){return r`
      <h2>ספריית רכיבים ו־tokens (v3)</h2>
      <p class="lead">מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. ממשק קומפקטי (12px), משטחים לבנים על רקע קריר, מחיצות דקות, כחול אחד במשורה, ירוק רק ל"מחובר", צל שקט, סצנות מאוירות עד חיבור זרמים.</p>

      <h3>צבעים</h3>
      <div class="swatches">
        ${xh.map(([e,t])=>r`<div class="swatch"><div class="c" style="background:var(${e})"></div><div class="n"><span>${t}</span><span class="ltr">${e}</span></div></div>`)}
      </div>

      <h3>טיפוגרפיה (Heebo, מארח מקומית)</h3>
      <div class="type">
        <p style="font-size:var(--sw-fs-3xl);font-weight:var(--sw-fw-bold)">מספר גדול 24</p>
        <p style="font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-semibold)">כותרת מסך 18</p>
        <p style="font-size:var(--sw-fs-lg);font-weight:var(--sw-fw-semibold)">כותרת אזור 14</p>
        <p style="font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold)">כותרת כרטיס 12.5</p>
        <p>טקסט גוף 12.5 — מפה של אתר, מבנה וקומה היא משטח העבודה המרכזי.</p>
        <p style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">טקסט משני 11.5</p>
        <p style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">תווית 10.5 · <span class="ltr">2026-09-14T08:05:38Z</span> נשאר LTR</p>
      </div>

      <h3>כרטיסי KPI</h3>
      <div class="kpis">
        <sw-kpi icon="camera" tone="live" value="24" label="מצלמות" detail="מחוברות"></sw-kpi>
        <sw-kpi icon="building" value="3" label="אתרים" detail="פעילים" tone="neutral"></sw-kpi>
        <sw-kpi icon="bell" value="12" label="אירועים" detail="ב־24 השעות" tone="neutral" badge="3 חדשים"></sw-kpi>
        <sw-kpi icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר HA לא רענן"></sw-kpi>
      </div>

      <h3>סצנות מאוירות (מצייני מקום, לא פריימים)</h3>
      <div class="scenes">${zh.map(e=>r`<div><sw-scene kind=${e}></sw-scene><span>${e}</span></div>`)}</div>

      <h3>אריחי מצלמה</h3>
      <div class="grid">
        <sw-camera-tile name="כניסה ראשית" state="live" scene="entrance"></sw-camera-tile>
        <sw-camera-tile name="חדר מדרגות" state="stale" scene="corridor"></sw-camera-tile>
        <sw-camera-tile name="מסדרון מזרחי" state="offline"></sw-camera-tile>
        <sw-camera-tile name="חניה" state="forbidden"></sw-camera-tile>
      </div>

      <h3>כפתורים, צ׳יפים, טאבים</h3>
      <div class="row">
        <sw-button variant="primary" icon="play">ראשי</sw-button>
        <sw-button icon="history">משני</sw-button>
        <sw-button variant="ghost" icon="pin">שקוף</sw-button>
        <sw-button variant="danger">מסוכן</sw-button>
        <sw-button variant="primary" disabled>מושבת</sw-button>
        <sw-button size="sm">קטן</sw-button>
        <sw-button iconOnly icon="refresh" label="רענון"></sw-button>
        <sw-chip selected>הכל</sw-chip><sw-chip dot="#ef4444">תנועה</sw-chip><sw-chip dot="#2f6bff">אדם</sw-chip><sw-chip dot="#22c55e">רכב</sw-chip>
        <sw-tabs .items=${[{id:"a",label:"כל האתרים",count:3},{id:"b",label:"מבנים"},{id:"c",label:"מפה"}]} active="a"></sw-tabs>
        <sw-toggle checked label="מופעל"></sw-toggle>
        <sw-avatar name="יוני"></sw-avatar>
      </div>

      <h3>תגי מצב (צורה + טקסט, לא צבע בלבד)</h3>
      <div class="row">${kh.map(e=>r`<sw-badge kind=${e}></sw-badge>`)}</div>

      <h3>ציר זמן, שלבים, קומות איזומטריות</h3>
      <sw-timeline .segments=${qs} .events=${[{minute:614,kind:"person",label:"אדם"},{minute:582,kind:"vehicle",label:"רכב"}]} .cursor=${615}></sw-timeline>
      <div class="row" style="margin-block-start:10px">
        <sw-card style="flex:1;min-inline-size:280px"><sw-steps .steps=${["גילוי","הגדרה","בדיקה","סיום"]} .current=${1}></sw-steps></sw-card>
        <sw-floor-iso .rooms=${Ei("f0")} selected></sw-floor-iso>
        <sw-floor-iso .rooms=${Ei("f-1")}></sw-floor-iso>
        <sw-floor-iso empty></sw-floor-iso>
      </div>

      <h3>מצבי מסך</h3>
      <div class="grid">
        ${_h.map(e=>r`<div class="panel"><sw-state-panel state=${e} actionLabel=${e==="error"?"נסה שוב":""}></sw-state-panel></div>`)}
      </div>

      <h3>אייקונים</h3>
      <div class="icons">${Sh.map(e=>r`<div class="icon"><sw-icon .name=${e} size=${18}></sw-icon><span class="ltr">${e}</span></div>`)}</div>
    `}};Zi.styles=z`
    :host {
      display: block;
      padding: 14px 24px 24px;
      max-inline-size: var(--sw-content-max);
    }
    h2 {
      font-size: var(--sw-fs-2xl);
      margin: 0 0 4px;
      font-weight: var(--sw-fw-semibold);
    }
    h3 {
      font-size: var(--sw-fs-md);
      margin: 22px 0 10px;
      font-weight: var(--sw-fw-semibold);
    }
    .lead {
      color: var(--sw-text-3);
      margin: 0 0 12px;
      font-size: var(--sw-fs-sm);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .swatches {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px;
    }
    .swatch {
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--sw-surface);
      font-size: var(--sw-fs-xs);
    }
    .swatch .c {
      block-size: 36px;
    }
    .swatch .n {
      padding: 5px 8px;
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .type p {
      margin: 0 0 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .scenes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .scenes div {
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      font-size: 10px;
    }
    .scenes span {
      position: absolute;
      inset-inline-start: 6px;
      inset-block-end: 5px;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
    }
    .icons {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 6px;
    }
    .icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 4px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      font-size: 9.5px;
      color: var(--sw-text-2);
    }
    .panel {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 10px;
    }
  `;Zi=$h([S("styleguide-screen")],Zi);const ar=[{id:"overview",icon:"dashboard",label:"סקירה",href:"#/live"},{id:"sites",icon:"building",label:"אתרים",href:"#/explore/sites"},{id:"cameras",icon:"camera",label:"מצלמות",href:"#/live/wall"},{id:"events",icon:"bell",label:"אירועים",href:"#/investigate/events"},{id:"playback",icon:"history",label:"הקלטות",href:"#/investigate/playback"},{id:"settings",icon:"system",label:"הגדרות",href:"#/system/diagnostics"}],Mh={overview:[],sites:[{id:"sites",label:"אתרים ומבנים",href:"#/explore/sites"},{id:"floors",label:"מפת קומה",href:"#/explore/floors/f0"},{id:"entities",label:"ישויות HA",href:"#/explore/entities"},{id:"access",label:"דלתות ואינטרקום",href:"#/explore/access/d1"}],cameras:[{id:"wall",label:"כל המצלמות",href:"#/live/wall"},{id:"views",label:"תצוגות שמורות",href:"#/live/views"},{id:"devices",label:"בריאות מצלמות",href:"#/system/devices"}],events:[{id:"events",label:"מרכז אירועים",href:"#/investigate/events"},{id:"reviews",label:"Review",href:"#/investigate/reviews"},{id:"search",label:"חיפוש",href:"#/investigate/search"},{id:"cases",label:"תיקים",href:"#/investigate/cases"},{id:"rules",label:"חוקים והתראות",href:"#/investigate/rules"},{id:"exports",label:"ייצוא",href:"#/investigate/exports"}],playback:[{id:"playback",label:"הקלטות",href:"#/investigate/playback"},{id:"sync",label:"ניגון מסונכרן",href:"#/investigate/playback/sync"},{id:"history",label:"מפה היסטורית",href:"#/investigate/floors/f0/history"}],settings:[{id:"general",label:"כללי",href:"#/system/diagnostics"},{id:"access",label:"משתמשים והרשאות",href:"#/system/access"},{id:"audit",label:"אודיט",href:"#/system/audit"},{id:"storage",label:"אחסון",href:"#/system/storage"},{id:"setup",label:"אשף התקנה",href:"#/system/setup"}]};function Kr(e){if(!e?.mode)return null;const t=e.segments;switch(e.mode){case"live":return t.length===1?"overview":"cameras";case"explore":return"sites";case"investigate":return!t[1]||t[1]==="playback"||t[1]==="floors"?"playback":"events";case"system":return t[1]==="devices"?"cameras":"settings";default:return null}}function Ah(e){const t=Kr(e);if(!t||!e)return"";const s=e.segments;switch(t){case"sites":return s[1]==="buildings"||s[1]==="floors"?"floors":s[1]==="entities"?"entities":s[1]==="access"?"access":"sites";case"cameras":return e.mode==="system"?"devices":s[1]==="views"?"views":"wall";case"events":return s[1]??"events";case"playback":return s[1]==="floors"?"history":s[2]==="sync"?"sync":"playback";case"settings":return!s[1]||s[1]==="diagnostics"?"general":s[1];default:return""}}const qi=[{id:"live",icon:"camera",label:"לייב",href:"#/live"},{id:"explore",icon:"map",label:"מפה",href:"#/explore/sites"},{id:"investigate",icon:"search",label:"חקירה",href:"#/investigate/events"},{id:"system",icon:"system",label:"מערכת",href:"#/system/diagnostics"}],Gr={live:[{id:"overview",label:"תמונת מצב",href:"#/live"},{id:"wall",label:"כל המצלמות",href:"#/live/wall"},{id:"views",label:"תצוגות שמורות",href:"#/live/views"},{id:"devices",label:"בריאות מצלמות",href:"#/system/devices"}],explore:[{id:"sites",label:"אתרים ומבנים",href:"#/explore/sites"},{id:"floors",label:"מפת קומה",href:"#/explore/floors/f0"},{id:"entities",label:"ישויות HA",href:"#/explore/entities"},{id:"access",label:"דלתות ואינטרקום",href:"#/explore/access/d1"}],investigate:[{id:"events",label:"מרכז אירועים",href:"#/investigate/events"},{id:"playback",label:"הקלטות",href:"#/investigate/playback"},{id:"sync",label:"ניגון מסונכרן",href:"#/investigate/playback/sync"},{id:"history",label:"מפה היסטורית",href:"#/investigate/floors/f0/history"},{id:"reviews",label:"Review",href:"#/investigate/reviews"},{id:"search",label:"חיפוש",href:"#/investigate/search"},{id:"cases",label:"תיקים",href:"#/investigate/cases"},{id:"rules",label:"חוקים והתראות",href:"#/investigate/rules"},{id:"exports",label:"ייצוא",href:"#/investigate/exports"}],system:[{id:"general",label:"כללי",href:"#/system/diagnostics"},{id:"access",label:"משתמשים והרשאות",href:"#/system/access"},{id:"audit",label:"אודיט",href:"#/system/audit"},{id:"storage",label:"אחסון",href:"#/system/storage"},{id:"setup",label:"אשף התקנה",href:"#/system/setup"}]};function oa(e){return e?.mode?e.mode==="system"&&e.segments[1]==="devices"?"live":e.mode:null}function Yr(e){const t=oa(e);if(!t||!e)return"";const s=e.segments;switch(t){case"live":return e.mode==="system"?"devices":s[1]==="views"?"views":s[1]==="wall"||s[1]==="cameras"?"wall":"overview";case"explore":return s[1]==="buildings"||s[1]==="floors"?"floors":s[1]==="entities"?"entities":s[1]==="access"?"access":"sites";case"investigate":return s[1]==="floors"?"history":s[1]==="playback"?s[2]==="sync"?"sync":"playback":s[1]??"events";case"system":return!s[1]||s[1]==="diagnostics"?"general":s[1];default:return""}}function Eh(e,t=!1){const s=oa(e);if(!s)return[];const i=qi.find(o=>o.id===s),a=Gr[s].find(o=>o.id===Yr(e)),n=a?t&&Xs[a.href??""]?Xs[a.href??""]:a.label:"";return[i?.label??"",n].filter(Boolean)}const Ph=new Set(["#/explore/access/d1"]),Xs={"#/investigate/reviews":"Review · חלונות","#/investigate/playback/sync":"ניגון מסונכרן","#/system/setup":"חיבורים"},Ft=new Set,Mi={explore:"/explore/floors/f0",live:"/live",wall:"/live/wall",events:"/investigate/events",playback:"/investigate/playback"},Ih=["#/explore/sites","#/explore/floors/f0","#/explore/entities"];function rr(e,t){return t?e.filter(s=>!Ph.has(s.href??"")&&!Ft.has(s.href??"")).map(s=>Xs[s.href??""]?{...s,label:Xs[s.href??""]}:s):e}function Ch(e,t){return t&&/^\/investigate\/rules\/[^/]+$/.test(e)?"/investigate/rules":null}var Th=Object.defineProperty,Oh=Object.getOwnPropertyDescriptor,We=(e,t,s,i)=>{for(var a=i>1?void 0:i?Oh(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Th(t,s,a),a};let Se=class extends x{constructor(){super(...arguments),this.route=null,this.session={mode:"loading",me:null,error:null},this.design=Zr(),this.sys=null,this.sysTimer=0,this.searchQ="",this.searchResults=[],this.searchOpen=!1,this.searchIndex=-1,this.searchBusy=!1,this.searchTimer=0,this.searchSeq=0,this.landedDefault=["","#","#/","#/explore/floors/f0"].includes(window.location.hash),this.startResolved=!1,this.onGlobalKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();const t=this.renderRoot.querySelector(".search input");t?.focus(),t?.select(),this.searchQ.trim()&&this.searchResults.length&&(this.searchOpen=!0)}}}connectedCallback(){super.connectedCallback(),this.stopSession=xr(e=>{this.session=e,e.mode!=="loading"&&qr(),e.mode==="api"&&this.route&&this.redirectDemo(this.route),e.mode==="api"&&!this.sysTimer&&(je().then(t=>{Ft.clear(),String(t["ui.hide_search"]??"false")==="true"&&Ft.add("#/investigate/search");const s=String(t["ui.hide_map"]??"false")==="true";if(s)for(const n of Ih)Ft.add(n);const i=Mi[String(t["ui.start_route"]??"explore")]??Mi.explore,a=s&&i.startsWith("/explore")?"/live/wall":i;this.landedDefault&&a!==Mi.explore&&(this.landedDefault=!1,window.location.replace(`#${a}`),this.route=Xt(`#${a}`)),this.requestUpdate()}).catch(()=>{}).finally(()=>this.startResolved=!0),this.pollSummary(),this.sysTimer=window.setInterval(()=>void this.pollSummary(),6e4))}),this.stopDesign=sh(e=>{this.design=e,this.setAttribute("data-design",e)}),Eo(),window.addEventListener("keydown",this.onGlobalKey),this.stopRouter=Ao(e=>{if(this.route=e,!this.redirectDemo(e)){if(this.toggleAttribute("data-kiosk",e.segments[0]==="kiosk"),e.params.get("embed")==="1")try{sessionStorage.setItem("sw-embed","1")}catch{}this.toggleAttribute("data-embed",this.embedded(e))}})}disconnectedCallback(){super.disconnectedCallback(),this.stopRouter?.(),this.stopSession?.(),this.stopDesign?.(),window.removeEventListener("keydown",this.onGlobalKey),window.clearInterval(this.sysTimer),this.sysTimer=0}async pollSummary(){try{this.sys=await sa()}catch{}}renderSysPill(e){const t=this.sys;if(!t)return e?r`<span class="status-a" data-sys-pill data-status="unknown"><i></i>מערכת מקומית</span>`:c;const s=t.items.find(n=>n.status==="error")??t.items[0],i=t.status==="ok"?"מערכת תקינה":t.status==="warn"?"יש מה לבדוק":`תקלה: ${s?.label.split(" — ")[0]??""}`,a=t.items.length?t.items.map(n=>`• ${n.label}`).join(`
`):"כל הרכיבים שהתוסף רואה עובדים";return r`<button class="status-a sys ${t.status} ${e?"":"b"}" data-sys-pill data-status=${t.status} title=${a} aria-label=${`מצב המערכת: ${i}`} @click=${()=>window.location.hash="#/system/diagnostics?tab=health"}><i></i>${i}</button>`}renderSysBanner(){const e=this.sys;if(!e||e.status!=="error")return c;const t=e.items.filter(s=>s.status==="error");return r`<div class="sysbanner" role="alert" data-sys-banner><sw-icon name="warning" size=${16}></sw-icon><span>${t.map(s=>s.label).join(" · ")}</span><a href="#/system/diagnostics?tab=health">לבריאות המערכת</a></div>`}onSearchInput(e){const t=e.target.value;if(this.searchQ=t,window.clearTimeout(this.searchTimer),!t.trim()){this.searchResults=[],this.searchOpen=!1;return}this.searchTimer=window.setTimeout(()=>void this.runSearch(t),180)}async runSearch(e){if(!g()){this.searchResults=[],this.searchOpen=!0;return}const t=++this.searchSeq;this.searchBusy=!0;try{const s=await dp(e,6);if(t!==this.searchSeq)return;this.searchResults=s.results,this.searchIndex=s.results.length?0:-1,this.searchOpen=!0}catch{t===this.searchSeq&&(this.searchResults=[],this.searchOpen=!0)}finally{t===this.searchSeq&&(this.searchBusy=!1)}}onSearchKey(e){if(e.key==="Escape"){this.closeSearch(),e.target.blur();return}if(!this.searchOpen||!this.searchResults.length){e.key==="Enter"&&this.searchQ.trim()&&this.runSearch(this.searchQ);return}if(e.key==="ArrowDown")e.preventDefault(),this.searchIndex=(this.searchIndex+1)%this.searchResults.length;else if(e.key==="ArrowUp")e.preventDefault(),this.searchIndex=(this.searchIndex-1+this.searchResults.length)%this.searchResults.length;else if(e.key==="Enter"){e.preventDefault();const t=this.searchResults[this.searchIndex]??this.searchResults[0];t&&this.openResult(t)}}openResult(e){this.closeSearch();const t=this.renderRoot.querySelector(".search input");t&&(t.value="",t.blur()),this.searchQ="",this.searchResults=[],window.location.hash=`#${e.route}`}closeSearch(){this.searchOpen=!1,this.searchIndex=-1}redirectDemo(e){if(this.enforceKiosk(e))return!0;const t=Ch(e.path,this.session.mode==="api");return t?(window.location.replace(`#${t}`),!0):!1}get kioskOnly(){const e=(this.session.me?.bindings??[]).filter(t=>t.effect!=="deny");return this.session.mode==="api"&&e.length>0&&e.every(t=>t.role_id==="kiosk")}enforceKiosk(e){return!this.kioskOnly||e.segments[0]==="kiosk"?!1:(window.location.replace("#/kiosk/all"),!0)}get gated(){return this.session.mode==="no_access"||this.session.mode==="unauthenticated"}renderSearch(e){if(this.gated)return c;const t=this.searchOpen&&!!this.searchQ.trim();return r`<span class="searchwrap ${e?"a":""}">
      <label class="search ${e?"a":""}"><sw-icon name="search" size=${e?16:14}></sw-icon><input type="search" placeholder=${e?"חיפוש חדרים, מצלמות, קומות וישויות…":y("app.search")} aria-label=${y("app.search")} autocomplete="off" role="combobox" aria-expanded=${t} aria-controls="search-results" .value=${this.searchQ} @input=${this.onSearchInput} @keydown=${this.onSearchKey} @focus=${()=>{this.searchResults.length&&(this.searchOpen=!0)}} @blur=${()=>setTimeout(()=>this.closeSearch(),150)} />${e?r`<kbd>⌘ K</kbd>`:c}</label>
      ${t?r`<div class="results" id="search-results" role="listbox" aria-label="תוצאות חיפוש">
            ${g()?this.searchBusy&&!this.searchResults.length?r`<div class="empty">מחפש…</div>`:this.searchResults.length?this.searchResults.map((s,i)=>r`<div class="row ${i===this.searchIndex?"on":""}" role="option" aria-selected=${i===this.searchIndex} @mousedown=${a=>a.preventDefault()} @click=${()=>this.openResult(s)}><sw-icon .name=${lp[s.kind]} size=${16}></sw-icon><span class="txt"><span class="t">${s.title}</span><span class="s">${s.subtitle}</span></span><span class="kind">${op[s.kind]}</span></div>`):r`<div class="empty">לא נמצא דבר עבור "${this.searchQ}". חדרים מופיעים רק אם סומנו "הכללה בחיפוש מרחבי"; אירועים מסוננים במרכז האירועים.</div>`:r`<div class="empty">החיפוש עובד מול השרת (במצב הדגמה אין נתונים).</div>`}
          </div>`:c}
    </span>`}renderGate(){const e=this.session;return e.mode==="unauthenticated"?r`<div class="gate"><sw-state-panel state="forbidden" heading="הזדהות דרך Home Assistant נדרשת" hint=${e.error??""}></sw-state-panel></div>`:e.mode==="no_access"?r`<div class="gate"><sw-state-panel state="forbidden" heading="אין לך עדיין תפקיד במערכת" hint="המשתמש ${e.me?.user.display_name||e.me?.user.username||""} מזוהה מ־Home Assistant, אך מנהל ה־VMS טרם שייך לו תפקיד והיקף. פנה למנהל המערכת."></sw-state-panel></div>`:null}renderScreen(){const e=this.route;if(!e)return c;if(this.landedDefault&&this.session.mode==="api"&&!this.startResolved)return r`<sw-state-panel state="loading"></sw-state-panel>`;const t=e.segments;if(t[0]==="styleguide")return r`<styleguide-screen></styleguide-screen>`;if(t[0]==="screens")return r`<screens-index></screens-index>`;if(t[0]==="kiosk")return r`<kiosk-wall></kiosk-wall>`;switch(e.mode){case"live":return t[1]==="wall"?r`<live-wall .cameras=${e.params.get("cameras")??""}></live-wall>`:t[1]==="views"?r`<live-views></live-views>`:t[1]==="cameras"?r`<live-camera .cameraId=${t[2]??"cam-1"}></live-camera>`:r`<live-overview></live-overview>`;case"investigate":return t[1]==="playback"&&t[2]==="sync"?r`<investigate-sync></investigate-sync>`:t[1]==="playback"?r`<investigate-playback .cameraId=${e.params.get("camera")??""} .at=${e.params.get("t")??""} .extraParam=${e.params.get("extra")??""}></investigate-playback>`:t[1]==="floors"?r`<investigate-history-map .floorId=${t[2]??"f0"} .at=${e.params.get("t")??""} .camera=${e.params.get("camera")??""}></investigate-history-map>`:t[1]==="events"&&t[2]?r`<investigate-event-detail .eventId=${t[2]}></investigate-event-detail>`:t[1]==="events"?r`<investigate-events .cameraId=${e.params.get("camera")??""} .date=${e.params.get("date")??""}></investigate-events>`:t[1]==="reviews"?this.session.mode==="api"?r`<investigate-events .initialMode=${"windows"} .cameraId=${e.params.get("camera")??""} .date=${e.params.get("date")??""}></investigate-events>`:r`<investigate-reviews></investigate-reviews>`:t[1]==="cases"&&t[2]?r`<investigate-case-detail .caseId=${t[2]}></investigate-case-detail>`:t[1]==="cases"?r`<investigate-cases></investigate-cases>`:t[1]==="exports"?r`<investigate-exports></investigate-exports>`:t[1]==="search"?r`<investigate-search></investigate-search>`:t[1]==="rules"&&t[2]?r`<investigate-rule-editor .ruleId=${t[2]}></investigate-rule-editor>`:t[1]==="rules"?r`<investigate-rules></investigate-rules>`:r`<investigate-playback></investigate-playback>`;case"system":return t[1]==="audit"?r`<system-audit></system-audit>`:t[1]==="setup"?r`<system-setup></system-setup>`:t[1]==="devices"?r`<system-devices></system-devices>`:t[1]==="storage"?r`<system-storage></system-storage>`:t[1]==="access"?r`<system-access></system-access>`:r`<system-diagnostics></system-diagnostics>`;case"explore":default:{if(t[1]==="sites")return r`<explore-sites></explore-sites>`;if(t[1]==="buildings")return r`<explore-floors .buildingId=${t[2]??"bld-a"}></explore-floors>`;if(t[1]==="entities")return r`<explore-entities></explore-entities>`;if(t[1]==="access")return r`<explore-access></explore-access>`;if(t[1]==="floors"&&t[3]==="import")return r`<explore-plan-import .floorId=${t[2]}></explore-plan-import>`;if(t[1]==="floors"&&t[3]==="edit")return r`<explore-plan-editor .floorId=${t[2]} .presetEntity=${e.params.get("entity")??""}></explore-plan-editor>`;const s=t[1]==="floors"&&t[2]?t[2]:"f0",i=e.params.get("state")??"ready";return r`<explore-floor-map .floorId=${s} .screenState=${i} .focusZone=${e.params.get("zone")??""} .focusCamera=${e.params.get("camera")??""} .focusEntity=${e.params.get("entity")??""}></explore-floor-map>`}}}renderA(){const e=oa(this.route),t=e?rr(Gr[e],this.session.mode==="api"):[],s=this.route?.segments[3]==="edit"||this.route?.segments[3]==="import",i=Eh(this.route,this.session.mode==="api"),a=this.session.me,n=a?.user.display_name||a?.user.username||"יוני";return r`
      <nav class="rail" aria-label="ניווט ראשי">
        <a class="brand-tile" href="#/live" title="SmplWise"><span>S</span></a>
        ${qi.filter(o=>!Ft.has(o.href)).map(o=>r`<a class=${ct({item:!0,a:!0,active:e===o.id})} href=${o.href} title=${o.label} aria-current=${e===o.id?"page":"false"}>
            <sw-icon .name=${o.icon} size=${23}></sw-icon><span>${o.label}</span>
          </a>`)}
        <div class="grow"></div>
        ${this.gated?c:r`<a class=${ct({item:!0,a:!0,small:!0,active:this.route?.segments[0]==="screens"})} href="#/screens" title="כל המסכים"><sw-icon name="list" size=${16}></sw-icon><span>מסכים</span></a>`}
        <div class="secure"><sw-icon name="shield" size=${18}></sw-icon><span>מקומי ומאובטח</span></div>
      </nav>
      <header class="topbar">
        <div class="crumbs-a">${i.map((o,l)=>r`${l?r`<sw-icon name="chevron" size=${12}></sw-icon>`:c}<span class=${l===0?"strong":""}>${Ct(o)}</span>`)}</div>
        ${this.renderSearch(!0)}
        <span class="spacer"></span>
        ${this.session.mode==="api"||this.session.mode==="no_access"?this.renderSysPill(!0):this.session.mode==="demo"?r`<sw-badge kind="neutral" label="נתוני הדגמה"></sw-badge>`:c}
        <sw-button class="bell" variant="ghost" size="sm" iconOnly icon="bell" label=${y("app.notifications")}></sw-button>
        <span class="user-a"><sw-avatar name=${n} size=${34} title=${y("app.account")} aria-label=${y("app.account")}></sw-avatar><span class="who-a"><b>${n}</b><span>${a?.bindings[0]?.role_name??(this.session.mode==="demo"?"מנהל VMS":"ללא שיוך")}</span></span></span>
        <span class="logo-a"><b>smplwise</b><small>VMS</small></span>
      </header>
      ${this.renderSysBanner()}
      <main>
        ${this.renderGate()||r`
          <div class="subnav">${t.length>1&&!s?r`<sw-tabs .items=${t} .active=${Yr(this.route)}></sw-tabs>`:c}</div>
          <div class="screen">${this.session.mode==="loading"?c:this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${qi.filter(o=>!Ft.has(o.href)).map(o=>r`<a class=${ct({active:e===o.id})} href=${o.href}><sw-icon .name=${o.icon} size=${20}></sw-icon>${o.label}</a>`)}
      </nav>
    `}embedded(e=this.route){if(e?.params.get("embed")==="1")return!0;try{return sessionStorage.getItem("sw-embed")==="1"}catch{return!1}}render(){if(this.route?.segments[0]==="kiosk")return r`<main style="block-size:100dvh">${this.renderScreen()}</main>`;if(this.embedded())return r`<main class="embed" style="block-size:100dvh;overflow:auto">${this.renderScreen()}</main>`;if(this.design==="a")return this.renderA();const t=Kr(this.route),s=t?rr(Mh[t],this.session.mode==="api"):[],i=this.route?.segments[3]==="edit"||this.route?.segments[3]==="import";return r`
      <nav class="rail" aria-label="ניווט ראשי">
        <div class="brand">
          <img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" />
          <span class="name">SmplWise</span>
        </div>
        ${ar.map(a=>r`<a class=${ct({item:!0,active:t===a.id})} href=${a.href} title=${a.label} aria-current=${t===a.id?"page":"false"}>
            <sw-icon .name=${a.icon} size=${16}></sw-icon><span>${a.label}</span>
          </a>`)}
        <div class="grow"></div>
        ${this.gated?c:r`<a class=${ct({item:!0,small:!0,active:this.route?.segments[0]==="screens"})} href="#/screens" title="כל המסכים">
          <sw-icon name="list" size=${14}></sw-icon><span>כל המסכים</span>
        </a>
        <a class=${ct({item:!0,small:!0,active:this.route?.segments[0]==="styleguide"})} href="#/styleguide" title=${y("nav.styleguide")}>
          <sw-icon name="layers" size=${14}></sw-icon><span>${y("nav.styleguide")}</span>
        </a>`}
      </nav>
      <header class="topbar">
        <span class="brand-mobile"><img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" /></span>
        ${this.renderSearch(!1)}
        <span class="spacer"></span>
        ${this.session.mode==="api"||this.session.mode==="no_access"?r`${this.renderSysPill(!1)}<span class="who"><b>${this.session.me?.user.display_name||this.session.me?.user.username}</b>${this.session.me?.bindings[0]?r`<span>· ${this.session.me.bindings[0].role_name}</span>`:c}</span>`:this.session.mode==="demo"?r`<sw-badge kind="neutral" label="נתוני הדגמה"></sw-badge>`:c}
        <sw-button class="bell" variant="ghost" size="sm" iconOnly icon="bell" label=${y("app.notifications")}></sw-button>
        <sw-avatar name=${this.session.me?.user.display_name||this.session.me?.user.username||"יוני"} size=${28} title=${y("app.account")} aria-label=${y("app.account")}></sw-avatar>
      </header>
      <main>
        ${this.renderGate()||r`
          <div class="subnav">${s.length>1&&!i?r`<sw-tabs .items=${s} .active=${Ah(this.route)}></sw-tabs>`:c}</div>
          <div class="screen">${this.session.mode==="loading"?c:this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${ar.slice(0,4).map(a=>r`<a class=${ct({active:t===a.id})} href=${a.href}><sw-icon .name=${a.icon} size=${20}></sw-icon>${a.label}</a>`)}
        <a class=${ct({active:t==="settings"||t==="playback"})} href="#/system/diagnostics"><sw-icon name="more" size=${20}></sw-icon>עוד</a>
      </nav>
    `}};Se.styles=z`
    :host {
      display: grid;
      grid-template-columns: var(--sw-rail-w-wide) minmax(0, 1fr);
      grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr);
      grid-template-areas:
        'rail topbar'
        'rail main';
      block-size: 100dvh;
      background: var(--sw-bg);
    }
    :host([data-kiosk]) {
      display: block;
    }
    nav.rail {
      grid-area: rail;
      display: flex;
      flex-direction: column;
      background: var(--sw-surface);
      border-inline-end: 1px solid var(--sw-border);
      padding: 10px 10px 8px;
      gap: 2px;
      overflow: auto;
      scrollbar-width: none;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px 14px;
      min-block-size: 44px;
    }
    .brand img {
      block-size: 26px;
      inline-size: auto;
    }
    .brand .name {
      font-weight: var(--sw-fw-bold);
      font-size: 13px;
      color: var(--sw-text);
      white-space: nowrap;
      letter-spacing: -0.01em;
    }
    a.item {
      display: flex;
      align-items: center;
      gap: 9px;
      min-block-size: 32px;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--sw-text-2);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a.item sw-icon {
      color: var(--sw-text-3);
    }
    a.item:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    a.item.active {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    a.item.active sw-icon {
      color: var(--sw-accent);
    }
    .rail .grow {
      flex: 1;
    }
    a.item.small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-block-size: 26px;
      font-weight: var(--sw-fw-regular);
    }
    header.topbar {
      grid-area: topbar;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px;
      background: var(--sw-surface);
      border-block-end: 1px solid var(--sw-border);
      z-index: var(--sw-z-topbar);
    }
    .search {
      inline-size: 280px;
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 30px;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .search:focus-within {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
      background: var(--sw-surface);
    }
    .search input {
      flex: 1;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      outline: none;
      min-inline-size: 0;
    }
    .topbar .spacer {
      flex: 1;
    }
    .brand-mobile {
      display: none;
      align-items: center;
    }
    .brand-mobile img {
      block-size: 24px;
      inline-size: auto;
    }
    .bell {
      position: relative;
    }
    .bell::after {
      content: '';
      position: absolute;
      inset-inline-end: 6px;
      inset-block-start: 5px;
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-danger);
      border: 1.5px solid var(--sw-surface);
    }
    main {
      grid-area: main;
      min-block-size: 0;
      min-inline-size: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }
    .subnav {
      padding: 12px 24px 0;
      display: flex;
    }
    .subnav:empty {
      display: none;
    }
    main > .screen {
      flex: 1;
      min-block-size: 0;
      display: flex;
      flex-direction: column;
    }
    main > .screen > * {
      flex: 1;
      min-block-size: 0;
    }
    nav.bottom {
      display: none;
    }
    .gate {
      flex: 1;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .who b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    @media (max-width: 1023px) {
      :host {
        grid-template-columns: var(--sw-rail-w) minmax(0, 1fr);
      }
      .brand .name,
      a.item span {
        display: none;
      }
      a.item {
        justify-content: center;
        padding: 0;
      }
      .brand {
        justify-content: center;
        padding-inline: 0;
      }
      .subnav {
        padding: 10px 16px 0;
        overflow-x: auto;
        scrollbar-width: none;
      }
    }
    @media (max-width: 767px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'main'
          'bottom';
      }
      nav.rail {
        display: none;
      }
      header.topbar {
        padding: 0 12px;
      }
      .subnav {
        padding: 8px 12px 0;
      }
      nav.bottom {
        grid-area: bottom;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        background: var(--sw-surface);
        border-block-start: 1px solid var(--sw-border);
        padding-block-end: env(safe-area-inset-bottom);
      }
      nav.bottom a {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-size: 10px;
        color: var(--sw-text-3);
        text-decoration: none;
        min-block-size: var(--sw-bottomnav-h);
        font-weight: var(--sw-fw-medium);
      }
      nav.bottom a.active {
        color: var(--sw-accent-text);
      }
      .brand-mobile {
        display: inline-flex;
      }
      .search {
        display: none;
      }
    }

    /* ---- design SW A: four-area icon rail on the right, 72px top bar with crumbs, wide search, user chip ---- */
    :host([data-design='a']) nav.rail {
      padding: 14px 8px 12px;
      gap: 6px;
      align-items: center;
    }
    .brand-tile {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 12px;
      background: var(--sw-accent);
      color: #fff;
      font-weight: 800;
      font-size: 22px;
      text-decoration: none;
      margin-block-end: 12px;
      box-shadow: 0 6px 14px rgba(39, 103, 237, 0.25);
    }
    a.item.a {
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      inline-size: 70px;
      min-block-size: 64px;
      padding: 8px 0;
      border-radius: 12px;
      font-size: 11.5px;
      position: relative;
    }
    a.item.a span {
      display: inline;
    }
    a.item.a.active::after {
      content: '';
      position: absolute;
      inset-inline-end: -8px;
      inset-block: 16px;
      inline-size: 3px;
      border-radius: 3px;
      background: var(--sw-accent);
    }
    a.item.a.small {
      min-block-size: 44px;
      font-size: 10.5px;
    }
    .secure {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 10.5px;
      color: var(--sw-text-3);
      padding: 8px 0 4px;
      text-align: center;
      line-height: 1.25;
    }
    :host([data-design='a']) header.topbar {
      padding: 0 26px;
      gap: 14px;
    }
    .crumbs-a {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .crumbs-a .strong {
      color: var(--sw-heading, var(--sw-text));
      font-weight: 700;
    }
    .crumbs-a sw-icon {
      color: var(--sw-text-3);
    }
    .searchwrap {
      position: relative;
      display: inline-flex;
    }
    .results {
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: calc(100% + 6px);
      inline-size: min(560px, 90vw);
      max-block-size: 60vh;
      overflow: auto;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-3);
      padding: 6px;
      z-index: var(--sw-z-drawer);
    }
    .searchwrap.a .results {
      inset-inline-start: 24px;
    }
    .results .row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--sw-text);
    }
    .results .row.on,
    .results .row:hover {
      background: var(--sw-accent-soft);
    }
    .results .row sw-icon {
      color: var(--sw-text-3);
      flex: none;
    }
    .results .txt {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      flex: 1;
    }
    .results .t {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .results .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .results .kind {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      flex: none;
    }
    .results .empty {
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .search.a {
      inline-size: min(520px, 38vw);
      block-size: 46px;
      border-radius: 12px;
      margin-inline-start: 24px;
      padding: 0 14px;
    }
    .search.a input {
      font-size: 14px;
    }
    .search.a kbd {
      font: inherit;
      font-size: 11px;
      color: var(--sw-text-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: 6px;
      padding: 1px 6px;
      background: var(--sw-surface);
      direction: ltr;
    }
    .status-a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: #15803d;
      white-space: nowrap;
    }
    .status-a i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    button.status-a.sys {
      border: 0;
      background: transparent;
      font: inherit;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--sw-r-pill);
    }
    button.status-a.sys:hover {
      background: var(--sw-surface-3);
    }
    .status-a.sys.warn {
      color: #b45309;
    }
    .status-a.sys.warn i {
      background: var(--sw-stale);
    }
    .status-a.sys.error {
      color: var(--sw-danger);
    }
    .status-a.sys.error i {
      background: var(--sw-danger);
    }
    .status-a.sys.b {
      font-size: var(--sw-fs-xs);
    }
    .sysbanner {
      position: fixed;
      inset-inline: 0;
      inset-block-start: var(--sw-topbar-h);
      /* one level under the topbar: at the topbar's own level the banner (later in the DOM) painted over the
         search results that drop out of the topbar, and their first rows could not be clicked (0.1.79 sweep) */
      z-index: calc(var(--sw-z-topbar) - 1);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 20px;
      background: #fef2f2;
      color: #991b1b;
      border-block-end: 1px solid #fecaca;
      font-size: var(--sw-fs-sm);
    }
    .sysbanner a {
      color: inherit;
      font-weight: var(--sw-fw-semibold);
      margin-inline-start: auto;
    }
    .user-a {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .who-a {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      font-size: 12px;
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .who-a b {
      color: var(--sw-heading, var(--sw-text));
      font-size: 13px;
    }
    .logo-a {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      direction: ltr;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--sw-heading, var(--sw-text));
      margin-inline-start: 10px;
    }
    .logo-a b {
      font-size: 24px;
      letter-spacing: -0.5px;
      font-weight: 700;
    }
    .logo-a small {
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--sw-text-3);
    }
    :host([data-design='a']) .subnav {
      padding: 14px 30px 0;
    }
    :host([data-design='a']) nav.bottom {
      grid-template-columns: repeat(4, 1fr);
    }
    @media (max-width: 1279px) {
      .crumbs-a {
        display: none;
      }
      .search.a {
        inline-size: 260px;
        margin-inline-start: 0;
      }
      .logo-a {
        display: none;
      }
    }
    @media (max-width: 1023px) {
      :host([data-design='a']) {
        grid-template-columns: var(--sw-rail-w) minmax(0, 1fr);
      }
      :host([data-design='a']) a.item.a span {
        display: inline;
      }
      :host([data-design='a']) .subnav {
        padding: 10px 16px 0;
      }
    }
    @media (max-width: 767px) {
      /* the tablet rule above (rail + content) is more specific than the base phone rule: repeat the
         single-column phone grid for SW A, otherwise the hidden rail keeps an empty column */
      :host([data-design='a']) {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'main'
          'bottom';
      }
      .who-a {
        display: none;
      }
      .status-a {
        display: none;
      }
    }
  `;We([d()],Se.prototype,"route",2);We([d()],Se.prototype,"session",2);We([d()],Se.prototype,"design",2);We([d()],Se.prototype,"sys",2);We([d()],Se.prototype,"searchQ",2);We([d()],Se.prototype,"searchResults",2);We([d()],Se.prototype,"searchOpen",2);We([d()],Se.prototype,"searchIndex",2);We([d()],Se.prototype,"searchBusy",2);We([d()],Se.prototype,"startResolved",2);Se=We([S("sw-app")],Se);
//# sourceMappingURL=index-IJv-t3rv.js.map
