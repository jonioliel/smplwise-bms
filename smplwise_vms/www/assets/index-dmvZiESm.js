(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))i(t);new MutationObserver(t=>{for(const r of t)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function a(t){const r={};return t.integrity&&(r.integrity=t.integrity),t.referrerPolicy&&(r.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?r.credentials="include":t.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(t){if(t.ep)return;t.ep=!0;const r=a(t);fetch(t.href,r)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ns=globalThis,Qs=ns.ShadowRoot&&(ns.ShadyCSS===void 0||ns.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,et=Symbol(),ut=new WeakMap;let Rt=class{constructor(s,a,i){if(this._$cssResult$=!0,i!==et)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=s,this.t=a}get styleSheet(){let s=this.o;const a=this.t;if(Qs&&s===void 0){const i=a!==void 0&&a.length===1;i&&(s=ut.get(a)),s===void 0&&((this.o=s=new CSSStyleSheet).replaceSync(this.cssText),i&&ut.set(a,s))}return s}toString(){return this.cssText}};const di=e=>new Rt(typeof e=="string"?e:e+"",void 0,et),g=(e,...s)=>{const a=e.length===1?e[0]:s.reduce((i,t,r)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(t)+e[r+1],e[0]);return new Rt(a,e,et)},ci=(e,s)=>{if(Qs)e.adoptedStyleSheets=s.map(a=>a instanceof CSSStyleSheet?a:a.styleSheet);else for(const a of s){const i=document.createElement("style"),t=ns.litNonce;t!==void 0&&i.setAttribute("nonce",t),i.textContent=a.cssText,e.appendChild(i)}},wt=Qs?e=>e:e=>e instanceof CSSStyleSheet?(s=>{let a="";for(const i of s.cssRules)a+=i.cssText;return di(a)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:pi,defineProperty:hi,getOwnPropertyDescriptor:fi,getOwnPropertyNames:ui,getOwnPropertySymbols:wi,getPrototypeOf:vi}=Object,xs=globalThis,vt=xs.trustedTypes,bi=vt?vt.emptyScript:"",gi=xs.reactiveElementPolyfillSupport,De=(e,s)=>e,ls={toAttribute(e,s){switch(s){case Boolean:e=e?bi:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,s){let a=e;switch(s){case Boolean:a=e!==null;break;case Number:a=e===null?null:Number(e);break;case Object:case Array:try{a=JSON.parse(e)}catch{a=null}}return a}},st=(e,s)=>!pi(e,s),bt={attribute:!0,type:String,converter:ls,reflect:!1,useDefault:!1,hasChanged:st};Symbol.metadata??=Symbol("metadata"),xs.litPropertyMetadata??=new WeakMap;let me=class extends HTMLElement{static addInitializer(s){this._$Ei(),(this.l??=[]).push(s)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(s,a=bt){if(a.state&&(a.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(s)&&((a=Object.create(a)).wrapped=!0),this.elementProperties.set(s,a),!a.noAccessor){const i=Symbol(),t=this.getPropertyDescriptor(s,i,a);t!==void 0&&hi(this.prototype,s,t)}}static getPropertyDescriptor(s,a,i){const{get:t,set:r}=fi(this.prototype,s)??{get(){return this[a]},set(o){this[a]=o}};return{get:t,set(o){const l=t?.call(this);r?.call(this,o),this.requestUpdate(s,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(s){return this.elementProperties.get(s)??bt}static _$Ei(){if(this.hasOwnProperty(De("elementProperties")))return;const s=vi(this);s.finalize(),s.l!==void 0&&(this.l=[...s.l]),this.elementProperties=new Map(s.elementProperties)}static finalize(){if(this.hasOwnProperty(De("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(De("properties"))){const a=this.properties,i=[...ui(a),...wi(a)];for(const t of i)this.createProperty(t,a[t])}const s=this[Symbol.metadata];if(s!==null){const a=litPropertyMetadata.get(s);if(a!==void 0)for(const[i,t]of a)this.elementProperties.set(i,t)}this._$Eh=new Map;for(const[a,i]of this.elementProperties){const t=this._$Eu(a,i);t!==void 0&&this._$Eh.set(t,a)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(s){const a=[];if(Array.isArray(s)){const i=new Set(s.flat(1/0).reverse());for(const t of i)a.unshift(wt(t))}else s!==void 0&&a.push(wt(s));return a}static _$Eu(s,a){const i=a.attribute;return i===!1?void 0:typeof i=="string"?i:typeof s=="string"?s.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(s=>this.enableUpdating=s),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(s=>s(this))}addController(s){(this._$EO??=new Set).add(s),this.renderRoot!==void 0&&this.isConnected&&s.hostConnected?.()}removeController(s){this._$EO?.delete(s)}_$E_(){const s=new Map,a=this.constructor.elementProperties;for(const i of a.keys())this.hasOwnProperty(i)&&(s.set(i,this[i]),delete this[i]);s.size>0&&(this._$Ep=s)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return ci(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(s=>s.hostConnected?.())}enableUpdating(s){}disconnectedCallback(){this._$EO?.forEach(s=>s.hostDisconnected?.())}attributeChangedCallback(s,a,i){this._$AK(s,i)}_$ET(s,a){const i=this.constructor.elementProperties.get(s),t=this.constructor._$Eu(s,i);if(t!==void 0&&i.reflect===!0){const r=(i.converter?.toAttribute!==void 0?i.converter:ls).toAttribute(a,i.type);this._$Em=s,r==null?this.removeAttribute(t):this.setAttribute(t,r),this._$Em=null}}_$AK(s,a){const i=this.constructor,t=i._$Eh.get(s);if(t!==void 0&&this._$Em!==t){const r=i.getPropertyOptions(t),o=typeof r.converter=="function"?{fromAttribute:r.converter}:r.converter?.fromAttribute!==void 0?r.converter:ls;this._$Em=t;const l=o.fromAttribute(a,r.type);this[t]=l??this._$Ej?.get(t)??l,this._$Em=null}}requestUpdate(s,a,i,t=!1,r){if(s!==void 0){const o=this.constructor;if(t===!1&&(r=this[s]),i??=o.getPropertyOptions(s),!((i.hasChanged??st)(r,a)||i.useDefault&&i.reflect&&r===this._$Ej?.get(s)&&!this.hasAttribute(o._$Eu(s,i))))return;this.C(s,a,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(s,a,{useDefault:i,reflect:t,wrapped:r},o){i&&!(this._$Ej??=new Map).has(s)&&(this._$Ej.set(s,o??a??this[s]),r!==!0||o!==void 0)||(this._$AL.has(s)||(this.hasUpdated||i||(a=void 0),this._$AL.set(s,a)),t===!0&&this._$Em!==s&&(this._$Eq??=new Set).add(s))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(a){Promise.reject(a)}const s=this.scheduleUpdate();return s!=null&&await s,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,r]of this._$Ep)this[t]=r;this._$Ep=void 0}const i=this.constructor.elementProperties;if(i.size>0)for(const[t,r]of i){const{wrapped:o}=r,l=this[t];o!==!0||this._$AL.has(t)||l===void 0||this.C(t,void 0,r,l)}}let s=!1;const a=this._$AL;try{s=this.shouldUpdate(a),s?(this.willUpdate(a),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(a)):this._$EM()}catch(i){throw s=!1,this._$EM(),i}s&&this._$AE(a)}willUpdate(s){}_$AE(s){this._$EO?.forEach(a=>a.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(s)),this.updated(s)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(s){return!0}update(s){this._$Eq&&=this._$Eq.forEach(a=>this._$ET(a,this[a])),this._$EM()}updated(s){}firstUpdated(s){}};me.elementStyles=[],me.shadowRootOptions={mode:"open"},me[De("elementProperties")]=new Map,me[De("finalized")]=new Map,gi?.({ReactiveElement:me}),(xs.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const tt=globalThis,gt=e=>e,ds=tt.trustedTypes,mt=ds?ds.createPolicy("lit-html",{createHTML:e=>e}):void 0,Lt="$lit$",Z=`lit$${Math.random().toFixed(9).slice(2)}$`,Vt="?"+Z,mi=`<${Vt}>`,oe=document,Ne=()=>oe.createComment(""),je=e=>e===null||typeof e!="object"&&typeof e!="function",it=Array.isArray,xi=e=>it(e)||typeof e?.[Symbol.iterator]=="function",Es=`[ 	
\f\r]`,Ee=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,xt=/-->/g,yt=/>/g,re=RegExp(`>|${Es}(?:([^\\s"'>=/]+)(${Es}*=${Es}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),$t=/'/g,kt=/"/g,Bt=/^(?:script|style|textarea|title)$/i,Ut=e=>(s,...a)=>({_$litType$:e,strings:s,values:a}),n=Ut(1),d=Ut(2),le=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),zt=new WeakMap,ne=oe.createTreeWalker(oe,129);function Wt(e,s){if(!it(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return mt!==void 0?mt.createHTML(s):s}const yi=(e,s)=>{const a=e.length-1,i=[];let t,r=s===2?"<svg>":s===3?"<math>":"",o=Ee;for(let l=0;l<a;l++){const f=e[l];let y,m,u=-1,$=0;for(;$<f.length&&(o.lastIndex=$,m=o.exec(f),m!==null);)$=o.lastIndex,o===Ee?m[1]==="!--"?o=xt:m[1]!==void 0?o=yt:m[2]!==void 0?(Bt.test(m[2])&&(t=RegExp("</"+m[2],"g")),o=re):m[3]!==void 0&&(o=re):o===re?m[0]===">"?(o=t??Ee,u=-1):m[1]===void 0?u=-2:(u=o.lastIndex-m[2].length,y=m[1],o=m[3]===void 0?re:m[3]==='"'?kt:$t):o===kt||o===$t?o=re:o===xt||o===yt?o=Ee:(o=re,t=void 0);const R=o===re&&e[l+1].startsWith("/>")?" ":"";r+=o===Ee?f+mi:u>=0?(i.push(y),f.slice(0,u)+Lt+f.slice(u)+Z+R):f+Z+(u===-2?l:R)}return[Wt(e,r+(e[a]||"<?>")+(s===2?"</svg>":s===3?"</math>":"")),i]};class Te{constructor({strings:s,_$litType$:a},i){let t;this.parts=[];let r=0,o=0;const l=s.length-1,f=this.parts,[y,m]=yi(s,a);if(this.el=Te.createElement(y,i),ne.currentNode=this.el.content,a===2||a===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(t=ne.nextNode())!==null&&f.length<l;){if(t.nodeType===1){if(t.hasAttributes())for(const u of t.getAttributeNames())if(u.endsWith(Lt)){const $=m[o++],R=t.getAttribute(u).split(Z),is=/([.?@])?(.*)/.exec($);f.push({type:1,index:r,name:is[2],strings:R,ctor:is[1]==="."?ki:is[1]==="?"?zi:is[1]==="@"?_i:ys}),t.removeAttribute(u)}else u.startsWith(Z)&&(f.push({type:6,index:r}),t.removeAttribute(u));if(Bt.test(t.tagName)){const u=t.textContent.split(Z),$=u.length-1;if($>0){t.textContent=ds?ds.emptyScript:"";for(let R=0;R<$;R++)t.append(u[R],Ne()),ne.nextNode(),f.push({type:2,index:++r});t.append(u[$],Ne())}}}else if(t.nodeType===8)if(t.data===Vt)f.push({type:2,index:r});else{let u=-1;for(;(u=t.data.indexOf(Z,u+1))!==-1;)f.push({type:7,index:r}),u+=Z.length-1}r++}}static createElement(s,a){const i=oe.createElement("template");return i.innerHTML=s,i}}function xe(e,s,a=e,i){if(s===le)return s;let t=i!==void 0?a._$Co?.[i]:a._$Cl;const r=je(s)?void 0:s._$litDirective$;return t?.constructor!==r&&(t?._$AO?.(!1),r===void 0?t=void 0:(t=new r(e),t._$AT(e,a,i)),i!==void 0?(a._$Co??=[])[i]=t:a._$Cl=t),t!==void 0&&(s=xe(e,t._$AS(e,s.values),t,i)),s}class $i{constructor(s,a){this._$AV=[],this._$AN=void 0,this._$AD=s,this._$AM=a}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(s){const{el:{content:a},parts:i}=this._$AD,t=(s?.creationScope??oe).importNode(a,!0);ne.currentNode=t;let r=ne.nextNode(),o=0,l=0,f=i[0];for(;f!==void 0;){if(o===f.index){let y;f.type===2?y=new Ge(r,r.nextSibling,this,s):f.type===1?y=new f.ctor(r,f.name,f.strings,this,s):f.type===6&&(y=new Pi(r,this,s)),this._$AV.push(y),f=i[++l]}o!==f?.index&&(r=ne.nextNode(),o++)}return ne.currentNode=oe,t}p(s){let a=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(s,i,a),a+=i.strings.length-2):i._$AI(s[a])),a++}}class Ge{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(s,a,i,t){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=s,this._$AB=a,this._$AM=i,this.options=t,this._$Cv=t?.isConnected??!0}get parentNode(){let s=this._$AA.parentNode;const a=this._$AM;return a!==void 0&&s?.nodeType===11&&(s=a.parentNode),s}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(s,a=this){s=xe(this,s,a),je(s)?s===h||s==null||s===""?(this._$AH!==h&&this._$AR(),this._$AH=h):s!==this._$AH&&s!==le&&this._(s):s._$litType$!==void 0?this.$(s):s.nodeType!==void 0?this.T(s):xi(s)?this.k(s):this._(s)}O(s){return this._$AA.parentNode.insertBefore(s,this._$AB)}T(s){this._$AH!==s&&(this._$AR(),this._$AH=this.O(s))}_(s){this._$AH!==h&&je(this._$AH)?this._$AA.nextSibling.data=s:this.T(oe.createTextNode(s)),this._$AH=s}$(s){const{values:a,_$litType$:i}=s,t=typeof i=="number"?this._$AC(s):(i.el===void 0&&(i.el=Te.createElement(Wt(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===t)this._$AH.p(a);else{const r=new $i(t,this),o=r.u(this.options);r.p(a),this.T(o),this._$AH=r}}_$AC(s){let a=zt.get(s.strings);return a===void 0&&zt.set(s.strings,a=new Te(s)),a}k(s){it(this._$AH)||(this._$AH=[],this._$AR());const a=this._$AH;let i,t=0;for(const r of s)t===a.length?a.push(i=new Ge(this.O(Ne()),this.O(Ne()),this,this.options)):i=a[t],i._$AI(r),t++;t<a.length&&(this._$AR(i&&i._$AB.nextSibling,t),a.length=t)}_$AR(s=this._$AA.nextSibling,a){for(this._$AP?.(!1,!0,a);s!==this._$AB;){const i=gt(s).nextSibling;gt(s).remove(),s=i}}setConnected(s){this._$AM===void 0&&(this._$Cv=s,this._$AP?.(s))}}class ys{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(s,a,i,t,r){this.type=1,this._$AH=h,this._$AN=void 0,this.element=s,this.name=a,this._$AM=t,this.options=r,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=h}_$AI(s,a=this,i,t){const r=this.strings;let o=!1;if(r===void 0)s=xe(this,s,a,0),o=!je(s)||s!==this._$AH&&s!==le,o&&(this._$AH=s);else{const l=s;let f,y;for(s=r[0],f=0;f<r.length-1;f++)y=xe(this,l[i+f],a,f),y===le&&(y=this._$AH[f]),o||=!je(y)||y!==this._$AH[f],y===h?s=h:s!==h&&(s+=(y??"")+r[f+1]),this._$AH[f]=y}o&&!t&&this.j(s)}j(s){s===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,s??"")}}class ki extends ys{constructor(){super(...arguments),this.type=3}j(s){this.element[this.name]=s===h?void 0:s}}class zi extends ys{constructor(){super(...arguments),this.type=4}j(s){this.element.toggleAttribute(this.name,!!s&&s!==h)}}class _i extends ys{constructor(s,a,i,t,r){super(s,a,i,t,r),this.type=5}_$AI(s,a=this){if((s=xe(this,s,a,0)??h)===le)return;const i=this._$AH,t=s===h&&i!==h||s.capture!==i.capture||s.once!==i.once||s.passive!==i.passive,r=s!==h&&(i===h||t);t&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,s),this._$AH=s}handleEvent(s){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,s):this._$AH.handleEvent(s)}}class Pi{constructor(s,a,i){this.element=s,this.type=6,this._$AN=void 0,this._$AM=a,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(s){xe(this,s)}}const Mi=tt.litHtmlPolyfillSupport;Mi?.(Te,Ge),(tt.litHtmlVersions??=[]).push("3.3.3");const Si=(e,s,a)=>{const i=a?.renderBefore??s;let t=i._$litPart$;if(t===void 0){const r=a?.renderBefore??null;i._$litPart$=t=new Ge(s.insertBefore(Ne(),r),r,void 0,a??{})}return t._$AI(e),t};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const at=globalThis;let w=class extends me{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const s=super.createRenderRoot();return this.renderOptions.renderBefore??=s.firstChild,s}update(s){const a=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(s),this._$Do=Si(a,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return le}};w._$litElement$=!0,w.finalized=!0,at.litElementHydrateSupport?.({LitElement:w});const Oi=at.litElementPolyfillSupport;Oi?.({LitElement:w});(at.litElementVersions??=[]).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const b=e=>(s,a)=>{a!==void 0?a.addInitializer(()=>{customElements.define(e,s)}):customElements.define(e,s)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ai={attribute:!0,type:String,converter:ls,reflect:!1,hasChanged:st},Ci=(e=Ai,s,a)=>{const{kind:i,metadata:t}=a;let r=globalThis.litPropertyMetadata.get(t);if(r===void 0&&globalThis.litPropertyMetadata.set(t,r=new Map),i==="setter"&&((e=Object.create(e)).wrapped=!0),r.set(a.name,e),i==="accessor"){const{name:o}=a;return{set(l){const f=s.get.call(this);s.set.call(this,l),this.requestUpdate(o,f,e,!0,l)},init(l){return l!==void 0&&this.C(o,void 0,e,l),l}}}if(i==="setter"){const{name:o}=a;return function(l){const f=this[o];s.call(this,l),this.requestUpdate(o,f,e,!0,l)}}throw Error("Unsupported decorator location: "+i)};function c(e){return(s,a)=>typeof a=="object"?Ci(e,s,a):((i,t,r)=>{const o=t.hasOwnProperty(r);return t.constructor.createProperty(r,i),o?Object.getOwnPropertyDescriptor(t,r):void 0})(e,s,a)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function p(e){return c({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ei=(e,s,a)=>(a.configurable=!0,a.enumerable=!0,Reflect.decorate&&typeof s!="object"&&Object.defineProperty(e,s,a),a);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function rt(e,s){return(a,i,t)=>{const r=o=>o.renderRoot?.querySelector(e)??null;return Ei(a,i,{get(){return r(this)}})}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ii={ATTRIBUTE:1},Di=e=>(...s)=>({_$litDirective$:e,values:s});class Ni{constructor(s){}get _$AU(){return this._$AM._$AU}_$AT(s,a,i){this._$Ct=s,this._$AM=a,this._$Ci=i}_$AS(s,a){return this.update(s,a)}update(s,a){return this.render(...a)}}/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ie=Di(class extends Ni{constructor(e){if(super(e),e.type!==Ii.ATTRIBUTE||e.name!=="class"||e.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(s=>e[s]).join(" ")+" "}update(e,[s]){if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(const i in s)s[i]&&!this.nt?.has(i)&&this.st.add(i);return this.render(s)}const a=e.element.classList;for(const i of this.st)i in s||(a.remove(i),this.st.delete(i));for(const i in s){const t=!!s[i];t===this.st.has(i)||this.nt?.has(i)||(t?(a.add(i),this.st.add(i)):(a.remove(i),this.st.delete(i)))}return le}});var ji=Object.defineProperty,Ti=Object.getOwnPropertyDescriptor,$s=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ti(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&ji(s,a,t),t};const _t={live:d`<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/>`,explore:d`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>`,investigate:d`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M11 8v3l2 1.5"/>`,system:d`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,camera:d`<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H8l1.5-2h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.5"/>`,search:d`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>`,bell:d`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>`,user:d`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,play:d`<path d="M7 5v14l11-7z"/>`,expand:d`<path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/>`,close:d`<path d="M6 6l12 12M18 6 6 18"/>`,chevron:d`<path d="m9 6 6 6-6 6"/>`,warning:d`<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>`,info:d`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`,lock:d`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,unlock:d`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>`,offline:d`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/><path d="M3 3l18 18"/>`,refresh:d`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>`,layers:d`<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/>`,floor:d`<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v18"/>`,plus:d`<path d="M12 5v14M5 12h14"/>`,minus:d`<path d="M5 12h14"/>`,fit:d`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,door:d`<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>`,light:d`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`,sensor:d`<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>`,check:d`<path d="m5 12 5 5 9-10"/>`,clock:d`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,download:d`<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>`,pin:d`<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v6"/>`,more:d`<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>`,building:d`<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>`,map:d`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/>`,upload:d`<path d="M12 16V5M7 10l5-5 5 5M4 20h16"/>`,list:d`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`,history:d`<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v4l3 2"/>`,target:d`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`,filter:d`<path d="M4 5h16l-6 8v6l-4-2v-4z"/>`,users:d`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21.5 20"/>`,shield:d`<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>`,storage:d`<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>`,edit:d`<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>`,pause:d`<path d="M8 5v14M16 5v14"/>`,skip:d`<path d="M5 5v14l8-7zM15 5h2v14h-2z"/>`,case:d`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>`,rule:d`<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>`,link:d`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,grid:d`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,dashboard:d`<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>`,home:d`<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>`,star:d`<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9L6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,aperture:d`<circle cx="12" cy="12" r="9"/><path d="m14.3 4.5-5 8.6M20.7 9.5H10.8M18.4 17.5l-5-8.6M9.7 19.5l5-8.6M3.3 14.5h9.9M5.6 6.5l5 8.6"/>`,volume:d`<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>`,mic:d`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>`,back10:d`<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,forward10:d`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,chevronDown:d`<path d="m6 9 6 6 6-6"/>`,stairs:d`<path d="M3 20h4v-4h4v-4h4V8h5"/>`,elevator:d`<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>`,menu:d`<path d="M4 7h16M4 12h16M4 17h16"/>`,calendar:d`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,trash:d`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,eye:d`<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,cpu:d`<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>`,activity:d`<path d="M3 12h4l3-8 4 16 3-8h4"/>`,image:d`<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/>`,wifi:d`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/>`,signal:d`<path d="M4 18v-3M9 18v-7M14 18V7M19 18V4"/>`,move:d`<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>`,bookmark:d`<path d="M6 3h12v18l-6-4-6 4z"/>`,route:d`<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 17c5-1 3-9 8-10"/>`,logout:d`<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>`};let ye=class extends w{constructor(){super(...arguments),this.name="info",this.size=20,this.flip=!1}render(){this.style.setProperty("--sw-icon-size",`${this.size}px`);const e=this.name==="chevron";return n`<svg viewBox="0 0 24 24" aria-hidden="true" ?data-dir=${e}>${_t[this.name]??_t.info}</svg>`}};ye.styles=g`
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
  `;$s([c()],ye.prototype,"name",2);$s([c({type:Number})],ye.prototype,"size",2);$s([c({type:Boolean,reflect:!0})],ye.prototype,"flip",2);ye=$s([b("sw-icon")],ye);var Hi=Object.defineProperty,Ri=Object.getOwnPropertyDescriptor,J=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ri(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Hi(s,a,t),t};let L=class extends w{constructor(){super(...arguments),this.variant="secondary",this.size="md",this.disabled=!1,this.iconOnly=!1,this.round=!1,this.label="",this.type="button"}render(){return n`
      <button type=${this.type} ?disabled=${this.disabled} aria-label=${this.iconOnly?this.label:""} title=${this.iconOnly?this.label:""}>
        ${this.icon?n`<sw-icon .name=${this.icon} size=${this.size==="sm"?13:this.size==="lg"?18:15}></sw-icon>`:""}
        ${this.iconOnly?"":n`<slot>${this.label}</slot>`}
      </button>
    `}};L.styles=g`
    :host {
      display: inline-flex;
    }
    :host([hidden]) {
      display: none;
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
  `;J([c()],L.prototype,"variant",2);J([c()],L.prototype,"size",2);J([c()],L.prototype,"icon",2);J([c({type:Boolean,reflect:!0})],L.prototype,"disabled",2);J([c({type:Boolean,reflect:!0})],L.prototype,"iconOnly",2);J([c({type:Boolean,reflect:!0})],L.prototype,"round",2);J([c()],L.prototype,"label",2);J([c()],L.prototype,"type",2);L=J([b("sw-button")],L);const Li={app:{name:"SMPLWISE VMS",search:"חיפוש מצלמה, קומה, ישות או אירוע…",notifications:"התראות",account:"חשבון"},modes:{live:"שידור חי",explore:"מפות",investigate:"חקירה",system:"מערכת"},nav:{styleguide:"ספריית רכיבים"},breadcrumb:{site:"אתר",building:"מבנה",floor:"קומה"},floor:{switcher:"בחירת קומה",layers:"שכבות",cameras:"מצלמות",doors:"דלתות",lights:"תאורה",sensors:"חיישנים",zoomIn:"הגדלה",zoomOut:"הקטנה",fit:"התאמה למסך",noPlan:"לקומה הזו עדיין אין תוכנית",noPlanHint:"אפשר להעלות PDF או תמונה של התוכנית, או לעבוד עם רשימת המצלמות בינתיים.",uploadPlan:"העלאת תוכנית",listView:"תצוגת רשימה",stalePlan:"התוכנית מוצגת כרקע בלבד"},states:{loading:"טוען…",empty:"אין נתונים להצגה",error:"משהו השתבש",errorHint:"לא הצלחנו לטעון את הנתונים. אפשר לנסות שוב.",retry:"נסה שוב",forbidden:"אין הרשאה",forbiddenHint:"למשתמש שלך אין הרשאה לצפות בתוכן הזה. פנה למנהל ה־VMS כדי לקבל שיוך.",stale:"הנתונים אינם עדכניים",staleHint:"החיבור ל־Home Assistant נותק. מוצג המצב האחרון שנקלט.",partial:"חלק מהנתונים חסר",offline:"לא מחובר",unknown:"לא ידוע",live:"חי",recorded:"מוקלט",historic:"צפייה היסטורית"},camera:{preview:"תצוגה מקדימה",enlarge:"הגדל",recordings:"הקלטות",pin:"הצמד",unpin:"בטל הצמדה",snapshot:"צילום",offlineReason:"המצלמה אינה מחוברת ל־NVR",forbiddenReason:"אין לך הרשאת צפייה במצלמה הזו",staleReason:"מצב המצלמה אינו מעודכן",source:"מקור",timeSource:"זמן מקור",quality:"איכות",main:"ראשי",sub:"משני"},entity:{state:"מצב",lastChanged:"עודכן לאחרונה",control:"הפעלה",noControl:"אין הרשאה לשליטה",openInHa:"פתח ב־Home Assistant",door:"דלת",light:"תאורה",sensor:"חיישן",locked:"נעול",unlocked:"פתוח",on:"דולק",off:"כבוי",confirm:"אישור פעולה"},actions:{close:"סגור",cancel:"ביטול",save:"שמירה",apply:"החל",refresh:"רענון",more:"עוד",back:"חזרה"}};function v(e){const s=e.split(".").reduce((a,i)=>a?.[i],Li);return typeof s=="string"?s:e}var Vi=Object.defineProperty,Bi=Object.getOwnPropertyDescriptor,ks=(e,s,a,i)=>{for(var t=i>1?void 0:i?Bi(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Vi(s,a,t),t};const Ui={live:()=>v("states.live"),recorded:()=>v("states.recorded"),historic:()=>v("states.historic"),offline:()=>v("states.offline"),stale:()=>v("states.stale"),unknown:()=>v("states.unknown"),forbidden:()=>v("states.forbidden"),error:()=>v("states.error"),partial:()=>v("states.partial"),neutral:()=>""};let $e=class extends w{constructor(){super(...arguments),this.kind="neutral",this.label="",this.onImage=!1}render(){const e=this.label||Ui[this.kind]();return n`<span class="dot" aria-hidden="true"></span><span>${e}</span>`}};$e.styles=g`
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
  `;ks([c({reflect:!0})],$e.prototype,"kind",2);ks([c()],$e.prototype,"label",2);ks([c({type:Boolean,reflect:!0})],$e.prototype,"onImage",2);$e=ks([b("sw-badge")],$e);var Wi=Object.defineProperty,Fi=Object.getOwnPropertyDescriptor,Ye=(e,s,a,i)=>{for(var t=i>1?void 0:i?Fi(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Wi(s,a,t),t};let de=class extends w{constructor(){super(...arguments),this.items=[],this.active="",this.segmented=!1,this.underline=!1}choose(e){this.active=e.id,this.dispatchEvent(new CustomEvent("change",{detail:{id:e.id},bubbles:!0,composed:!0}))}render(){return n`${this.items.map(e=>e.href?n`<a href=${e.href} class=${e.id===this.active?"on":""} aria-current=${e.id===this.active?"page":"false"}>${e.label}${e.count!==void 0?n`<span class="count">(${e.count})</span>`:""}</a>`:n`<button type="button" class=${e.id===this.active?"on":""} aria-pressed=${e.id===this.active} @click=${()=>this.choose(e)}>${e.label}${e.count!==void 0?n`<span class="count">(${e.count})</span>`:""}</button>`)}`}};de.styles=g`
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
  `;Ye([c({attribute:!1})],de.prototype,"items",2);Ye([c()],de.prototype,"active",2);Ye([c({type:Boolean,reflect:!0})],de.prototype,"segmented",2);Ye([c({type:Boolean,reflect:!0})],de.prototype,"underline",2);de=Ye([b("sw-tabs")],de);var qi=Object.defineProperty,Ki=Object.getOwnPropertyDescriptor,nt=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ki(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&qi(s,a,t),t};let He=class extends w{constructor(){super(...arguments),this.name="",this.size=32}render(){this.style.setProperty("--sz",`${this.size}px`);const e=this.name.trim().split(/\s+/),s=e.length>1?e[0][0]+e[1][0]:this.name.slice(0,2);return n`${s}`}};He.styles=g`
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
  `;nt([c()],He.prototype,"name",2);nt([c({type:Number})],He.prototype,"size",2);He=nt([b("sw-avatar")],He);var Gi=Object.defineProperty,Yi=Object.getOwnPropertyDescriptor,Xe=(e,s,a,i)=>{for(var t=i>1?void 0:i?Yi(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Gi(s,a,t),t};let ce=class extends w{constructor(){super(...arguments),this.selected=!1,this.dot=""}render(){return n`
      <button type="button" aria-pressed=${this.selected}>
        ${this.dot?n`<span class="d" style="--dot:${this.dot}"></span>`:""}
        ${this.icon?n`<sw-icon .name=${this.icon} size=${13}></sw-icon>`:""}
        <slot></slot>
        ${this.count!==void 0?n`<span class="count">(${this.count})</span>`:""}
      </button>
    `}};ce.styles=g`
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
  `;Xe([c({type:Boolean,reflect:!0})],ce.prototype,"selected",2);Xe([c()],ce.prototype,"icon",2);Xe([c({type:Number})],ce.prototype,"count",2);Xe([c()],ce.prototype,"dot",2);ce=Xe([b("sw-chip")],ce);var Xi=Object.defineProperty,Ji=Object.getOwnPropertyDescriptor,zs=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ji(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Xi(s,a,t),t};let ke=class extends w{constructor(){super(...arguments),this.open=!1,this.heading="",this.subheading=""}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){return n`
      <aside class="panel" role="dialog" aria-modal="false" aria-label=${this.heading} ?hidden=${!this.open}>
        <div class="grip" aria-hidden="true"></div>
        <header>
          <div class="titles">
            <h3>${this.heading}</h3>
            ${this.subheading?n`<div class="sub">${this.subheading}</div>`:""}
          </div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${v("actions.close")} @click=${this.close}></sw-button>
        </header>
        <div class="body"><slot></slot></div>
        <footer><slot name="footer"></slot></footer>
      </aside>
    `}};ke.styles=g`
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
  `;zs([c({type:Boolean,reflect:!0})],ke.prototype,"open",2);zs([c()],ke.prototype,"heading",2);zs([c()],ke.prototype,"subheading",2);ke=zs([b("sw-drawer")],ke);var Zi=Object.defineProperty,Qi=Object.getOwnPropertyDescriptor,Oe=(e,s,a,i)=>{for(var t=i>1?void 0:i?Qi(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Zi(s,a,t),t};let Q=class extends w{constructor(){super(...arguments),this.heading="",this.x=0,this.y=0,this.stageWidth=0,this.stageHeight=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","dialog"),this.setAttribute("aria-modal","false")}willUpdate(){this.heading&&this.setAttribute("aria-label",this.heading)}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}updated(){const s=this.offsetHeight||260,a=16;let i=this.x+a;this.stageWidth&&i+268>this.stageWidth-8&&(i=Math.max(8,this.x-268-a));let t=this.y-s/2;this.stageHeight&&(t=Math.max(8,Math.min(this.stageHeight-s-8,t))),this.style.left=`${i}px`,this.style.top=`${Math.max(8,t)}px`}render(){return n`
      <header><h4>${this.heading}</h4><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
      <slot></slot>
      <footer><slot name="footer"></slot></footer>
    `}};Q.styles=g`
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
  `;Oe([c()],Q.prototype,"heading",2);Oe([c({type:Number})],Q.prototype,"x",2);Oe([c({type:Number})],Q.prototype,"y",2);Oe([c({type:Number})],Q.prototype,"stageWidth",2);Oe([c({type:Number})],Q.prototype,"stageHeight",2);Q=Oe([b("sw-popover")],Q);var ea=Object.defineProperty,sa=Object.getOwnPropertyDescriptor,_s=(e,s,a,i)=>{for(var t=i>1?void 0:i?sa(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&ea(s,a,t),t};let ze=class extends w{constructor(){super(...arguments),this.label="",this.hint="",this.inline=!1}render(){return n`
      ${this.label?n`<label>${this.label}</label>`:""}
      <slot></slot>
      ${this.hint?n`<div class="hint">${this.hint}</div>`:""}
    `}};ze.styles=g`
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
  `;_s([c()],ze.prototype,"label",2);_s([c()],ze.prototype,"hint",2);_s([c({type:Boolean,reflect:!0})],ze.prototype,"inline",2);ze=_s([b("sw-field")],ze);var ta=Object.defineProperty,ia=Object.getOwnPropertyDescriptor,Ft=(e,s,a,i)=>{for(var t=i>1?void 0:i?ia(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&ta(s,a,t),t};let aa=0,cs=class extends w{constructor(){super(...arguments),this.kind="lobby",this.uid=`sc${aa+=1}`}grad(e,s,a=!0){const i=`${e}-${this.uid}`;return d`<linearGradient id=${i} x1="0" y1="0" x2=${a?0:1} y2=${a?1:0}>${s.map(([t,r])=>d`<stop offset=${t} stop-color=${r} />`)}</linearGradient>`}url(e){return`url(#${e}-${this.uid})`}vignette(){const e=`vig-${this.uid}`;return d`<defs><radialGradient id=${e} cx="50%" cy="45%" r="72%"><stop offset="0.55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity="0.38" /></radialGradient></defs><rect width="320" height="180" fill=${`url(#${e})`} />`}entrance(){return d`
      <defs>${this.grad("wall",[[0,"#f3f1ec"],[1,"#d8d4cc"]])}${this.grad("floor",[[0,"#d2cdc2"],[1,"#a19a8c"]])}${this.grad("glass",[[0,"#e3edf6"],[.55,"#bfd2e6"],[1,"#8fa9c4"]],!1)}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <polygon points="0,0 320,0 250,30 70,30" fill="#e9e6df" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url("floor")} />
      ${[0,1,2,3,4,5].map(e=>d`<line x1=${-40+e*80} y1="180" x2=${100+e*24} y2="118" stroke="#fff" stroke-opacity="0.18" />`)}
      <rect x="0" y="30" width="70" height="88" fill="#8b6e4e" />
      ${[0,1,2,3,4,5].map(e=>d`<rect x=${4+e*11} y="30" width="4" height="88" fill="#6f563d" />`)}
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
    `}lobby(){return d`
      <defs>${this.grad("wall",[[0,"#f5f0e7"],[1,"#e2d9ca"]])}${this.grad("floor",[[0,"#dccdb2"],[1,"#b19973"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="196" y="26" width="96" height="66" rx="2" fill="#d9e7f4" />
      <path d="M244 26v66M196 59h96" stroke="#fff" stroke-width="3" />
      <rect x="196" y="26" width="96" height="66" fill="none" stroke="#c8bfae" stroke-width="3" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url("floor")} />
      ${[0,1,2,3].map(e=>d`<line x1="0" y1=${132+e*14} x2="320" y2=${132+e*14} stroke="#fff" stroke-opacity="0.14" />`)}
      <rect x="26" y="86" width="132" height="8" rx="2" fill="#7c6248" />
      <rect x="30" y="94" width="124" height="36" rx="3" fill="#5a4636" />
      <rect x="188" y="102" width="96" height="28" rx="7" fill="#4a5568" />
      <rect x="194" y="92" width="40" height="16" rx="5" fill="#5b6a82" /><rect x="238" y="92" width="40" height="16" rx="5" fill="#5b6a82" />
      <ellipse cx="172" cy="86" rx="14" ry="11" fill="#3f7d4b" /><ellipse cx="164" cy="78" rx="9" ry="8" fill="#4f9159" />
      <rect x="166" y="96" width="12" height="16" rx="2" fill="#7a6c5d" />
      ${[60,120,180,240].map(e=>d`<ellipse cx=${e} cy="9" rx="7" ry="2.5" fill="#fff" fill-opacity="0.9" />`)}
    `}corridor(){return d`
      <defs>${this.grad("floor",[[0,"#cfc9bd"],[1,"#9c9587"]])}${this.grad("ceil",[[0,"#f3f1ec"],[1,"#e2ded6"]])}</defs>
      <rect width="320" height="180" fill="#d6d0c5" />
      <polygon points="0,0 320,0 200,42 120,42" fill=${this.url("ceil")} />
      <polygon points="0,0 120,42 120,138 0,180" fill="#e6e1d8" />
      <polygon points="320,0 200,42 200,138 320,180" fill="#d2ccc0" />
      <rect x="120" y="42" width="80" height="96" fill="#cbc4b8" />
      <rect x="150" y="70" width="22" height="68" fill="#8b7a67" />
      <rect x="153" y="73" width="16" height="30" fill="#c5d5e3" />
      <polygon points="0,180 320,180 200,138 120,138" fill=${this.url("floor")} />
      ${[0,1,2].map(e=>d`<line x1=${40+e*80} y1="180" x2=${140+e*20} y2="138" stroke="#fff" stroke-opacity="0.16" />`)}
      ${[0,1,2,3].map(e=>d`<rect x=${152-e*12} y=${24-e*6} width=${16+e*24} height="4" rx="2" fill="#fff" fill-opacity=${.9-e*.15} />`)}
      ${[0,1,2].map(e=>d`<rect x=${22+e*30} y=${58+e*10} width="10" height=${60-e*10} fill="#c9d5e3" fill-opacity="0.9" />`)}
    `}hall(){return d`
      <defs>${this.grad("wall",[[0,"#f2eee6"],[1,"#ddd6c9"]])}${this.grad("floor",[[0,"#c9c0b0"],[1,"#9a9081"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="112" width="320" height="68" fill=${this.url("floor")} />
      ${[0,1,2,3,4].map(e=>[0,1,2,3,4,5,6].map(s=>d`<rect x=${28+s*40+e*4} y=${96+e*14} width="22" height="9" rx="2" fill="#3b4557" />`))}
      <rect x="40" y="40" width="240" height="50" rx="2" fill="#dfe8f2" />
      <rect x="40" y="40" width="240" height="50" fill="none" stroke="#c9c1b3" stroke-width="3" />
      ${[80,140,200,240].map(e=>d`<line x1=${e} y1="40" x2=${e} y2="90" stroke="#fff" stroke-width="2" />`)}
      ${[60,130,200,260].map(e=>d`<ellipse cx=${e} cy="12" rx="9" ry="3" fill="#fff" fill-opacity="0.9" />`)}
    `}parking(){return d`
      <defs>${this.grad("wall",[[0,"#d3d7de"],[1,"#a1a7b1"]])}${this.grad("floor",[[0,"#8f959f"],[1,"#666c76"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="0" width="320" height="26" fill="#b9bec7" />
      ${[0,1,2].map(e=>d`<rect x="0" y=${8+e*6} width="320" height="2" fill="#98a0ab" />`)}
      <rect x="0" y="116" width="320" height="64" fill=${this.url("floor")} />
      ${[0,1,2,3,4,5].map(e=>d`<line x1=${-20+e*72} y1="180" x2=${90+e*28} y2="116" stroke="#e5e8ee" stroke-opacity="0.6" stroke-width="2" />`)}
      <rect x="34" y="26" width="20" height="100" fill="#7d8591" /><rect x="266" y="26" width="20" height="100" fill="#7d8591" />
      <rect x="110" y="102" width="72" height="24" rx="6" fill="#e8ebf0" /><polygon points="124,102 138,86 168,86 178,102" fill="#c6cfda" /><circle cx="126" cy="127" r="7" fill="#2c2f36" /><circle cx="170" cy="127" r="7" fill="#2c2f36" />
      <rect x="196" y="104" width="62" height="22" rx="6" fill="#3f4a5c" /><polygon points="208,104 220,90 244,90 252,104" fill="#5c6a80" /><circle cx="210" cy="127" r="6" fill="#1f232b" /><circle cx="246" cy="127" r="6" fill="#1f232b" />
      <rect x="130" y="30" width="60" height="5" rx="2" fill="#fff" fill-opacity="0.85" />
    `}warehouse(){return d`
      <defs>${this.grad("wall",[[0,"#e6e9ef"],[1,"#c6cbd3"]])}${this.grad("floor",[[0,"#b7bcc4"],[1,"#7f8592"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="104" width="320" height="76" fill=${this.url("floor")} />
      <line x1="118" y1="180" x2="150" y2="104" stroke="#e2b43a" stroke-width="3" /><line x1="202" y1="180" x2="170" y2="104" stroke="#e2b43a" stroke-width="3" />
      ${[[10,96],[230,316]].map(([e,s])=>d`
        <rect x=${e} y="18" width="6" height="150" fill="#c9772f" /><rect x=${s-6} y="40" width="6" height="128" fill="#c9772f" />
        ${[0,1,2].map(a=>d`<polygon points="${e},${52+a*36} ${s},${64+a*30} ${s},${68+a*30} ${e},${56+a*36}" fill="#b96a22" />`)}
        ${[0,1,2].map(a=>[0,1,2].map(i=>d`<rect x=${e+10+i*26} y=${32+a*36+i*3} width="20" height="16" rx="1" fill=${i%2?"#a8825d":"#c7a17a"} />`))}
      `)}
      <rect x="130" y="8" width="60" height="6" rx="3" fill="#fff" fill-opacity="0.9" /><rect x="120" y="40" width="80" height="5" rx="2" fill="#fff" fill-opacity="0.6" />
    `}backyard(){return d`
      <defs>${this.grad("sky",[[0,"#c4d9ee"],[1,"#e9f1f8"]])}${this.grad("lawn",[[0,"#86bb6f"],[1,"#4d8240"]])}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="62" width="320" height="50" fill="#b8905f" />
      ${Array.from({length:27},(e,s)=>d`<rect x=${s*12} y="62" width="2" height="50" fill="#9c7749" />`)}
      <rect x="0" y="66" width="320" height="4" fill="#a37e51" /><rect x="0" y="100" width="320" height="4" fill="#a37e51" />
      <circle cx="42" cy="52" r="27" fill="#3f7f45" /><circle cx="72" cy="46" r="20" fill="#4f9552" /><circle cx="282" cy="48" r="32" fill="#36763f" /><circle cx="250" cy="58" r="18" fill="#4a8a4c" />
      <rect x="0" y="112" width="320" height="68" fill=${this.url("lawn")} />
      ${[0,1,2].map(e=>d`<rect x="0" y=${118+e*20} width="320" height="10" fill="#fff" fill-opacity="0.07" />`)}
      <polygon points="150,180 320,180 300,128 172,128" fill="#c9c3b5" />
      <ellipse cx="238" cy="146" rx="28" ry="9" fill="#4a4f57" /><rect x="236" y="146" width="4" height="18" fill="#3a3f47" />
      <rect x="196" y="140" width="16" height="11" rx="3" fill="#565b64" /><rect x="262" y="140" width="16" height="11" rx="3" fill="#565b64" />
    `}driveway(){return d`
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
    `}night(){const e=`glow-${this.uid}`;return d`
      <defs>${this.grad("sky",[[0,"#0d1730"],[1,"#050912"]])}<radialGradient id=${e} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f5d78a" stop-opacity="0.55" /><stop offset="1" stop-color="#f5d78a" stop-opacity="0" /></radialGradient></defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="120" width="320" height="60" fill="#0a1020" />
      <circle cx="251" cy="34" r="110" fill=${`url(#${e})`} />
      <rect x="250" y="30" width="3" height="92" fill="#2a3350" /><rect x="238" y="24" width="27" height="8" rx="3" fill="#3b4666" />
      <ellipse cx="251" cy="124" rx="70" ry="12" fill="#f5d78a" fill-opacity="0.16" />
      <rect x="60" y="100" width="92" height="24" rx="7" fill="#131b33" /><polygon points="78,100 94,84 124,84 138,100" fill="#1a2440" />
      <circle cx="80" cy="125" r="8" fill="#0a0f1f" /><circle cx="134" cy="125" r="8" fill="#0a0f1f" />
      ${[0,1,2,3,4,5,6].map(s=>d`<rect x=${s*48} y="88" width="2" height="34" fill="#1b2440" />`)}
      <rect x="0" y="88" width="320" height="2" fill="#1b2440" />
    `}building(){return d`
      <defs>${this.grad("sky",[[0,"#c2d7ec"],[1,"#e9f0f7"]])}${this.grad("face",[[0,"#e6eaf0"],[1,"#c8cfd9"]],!1)}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="156" width="320" height="24" fill="#aab2be" />
      <rect x="92" y="28" width="136" height="130" fill=${this.url("face")} />
      <rect x="228" y="52" width="46" height="106" fill="#b9c1cd" />
      ${[0,1,2,3,4,5].map(e=>[0,1,2,3,4].map(s=>d`<rect x=${102+s*24} y=${38+e*19} width="16" height="12" rx="1" fill=${(e+s)%3?"#8fa8c6":"#c9dbee"} />`))}
      ${[0,1,2,3,4].map(e=>[0,1].map(s=>d`<rect x=${236+s*18} y=${62+e*19} width="12" height="10" rx="1" fill="#8ea3bd" />`))}
      <rect x="118" y="138" width="84" height="8" rx="2" fill="#4b5565" /><rect x="140" y="146" width="40" height="12" fill="#6d7f9a" />
      <circle cx="40" cy="132" r="26" fill="#4a8a4c" /><circle cx="292" cy="140" r="20" fill="#3f7d45" />
    `}house(){return d`
      <defs>${this.grad("sky",[[0,"#c2d7ec"],[1,"#ebf1f7"]])}${this.grad("lawn",[[0,"#8dbd70"],[1,"#5a8d46"]])}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="128" width="320" height="52" fill=${this.url("lawn")} />
      <polygon points="58,76 160,22 262,76" fill="#6e5f55" />
      <rect x="78" y="74" width="164" height="60" fill="#f2ede4" />
      <rect x="96" y="88" width="26" height="22" fill="#9fb8d3" /><rect x="148" y="90" width="20" height="44" fill="#5b4a3b" /><rect x="182" y="94" width="50" height="40" fill="#cfd4dc" />
      <path d="M182 104h50M182 114h50M182 124h50" stroke="#b9c0ca" stroke-width="2" />
      <polygon points="140,180 180,180 176,134 152,134" fill="#c7c1b4" />
      <circle cx="30" cy="112" r="24" fill="#4a8a4c" /><circle cx="296" cy="118" r="20" fill="#3f7d45" />
    `}scene(){switch(this.kind){case"entrance":return this.entrance();case"lobby":return this.lobby();case"corridor":return this.corridor();case"hall":return this.hall();case"parking":return this.parking();case"warehouse":return this.warehouse();case"backyard":return this.backyard();case"driveway":return this.driveway();case"night":return this.night();case"building":return this.building();case"house":return this.house();default:return h}}render(){return this.kind==="none"?n``:n`<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${this.scene()}${this.vignette()}</svg>`}};cs.styles=g`
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
  `;Ft([c({reflect:!0})],cs.prototype,"kind",2);cs=Ft([b("sw-scene")],cs);var ra=Object.defineProperty,na=Object.getOwnPropertyDescriptor,U=(e,s,a,i)=>{for(var t=i>1?void 0:i?na(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&ra(s,a,t),t};let j=class extends w{constructor(){super(...arguments),this.name="",this.meta="",this.state="unknown",this.scene="lobby",this.selected=!1,this.compact=!1,this.dark=!1,this.noDemo=!1,this.stamp=""}offMessage(){return this.state==="forbidden"?"אין הרשאת צפייה":this.state==="offline"?"המצלמה מנותקת":"מצב לא ידוע"}render(){return this.state==="offline"||this.state==="forbidden"||this.state==="unknown"?n`<div class="off">
        <sw-icon name=${this.state==="forbidden"?"lock":"offline"} size=${this.compact?18:24}></sw-icon>
        <span>${this.offMessage()}</span>
        ${this.name?n`<span class="label"><span class="dot"></span>${this.name}</span>`:h}
      </div>`:n`
      <sw-scene kind=${this.scene}></sw-scene>
      <div class="shade"></div>
      ${this.noDemo?h:n`<span class="demo">דמו</span>`}
      ${this.state==="stale"||this.state==="recorded"||this.state==="historic"?n`<sw-badge class="pill" onImage kind=${this.state}></sw-badge>`:h}
      ${this.name?n`<span class="label"><span class="dot"></span>${this.name}</span>`:h}
      ${this.stamp?n`<span class="stamp">${this.stamp}</span>`:this.meta&&!this.compact?n`<span class="meta">${this.meta}</span>`:h}
    `}};j.styles=g`
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
    sw-scene {
      position: absolute;
      inset: 0;
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
  `;U([c()],j.prototype,"name",2);U([c()],j.prototype,"meta",2);U([c({reflect:!0})],j.prototype,"state",2);U([c({reflect:!0})],j.prototype,"scene",2);U([c({type:Boolean,reflect:!0})],j.prototype,"selected",2);U([c({type:Boolean,reflect:!0})],j.prototype,"compact",2);U([c({type:Boolean,reflect:!0})],j.prototype,"dark",2);U([c({type:Boolean,reflect:!0})],j.prototype,"noDemo",2);U([c()],j.prototype,"stamp",2);j=U([b("sw-camera-tile")],j);var oa=Object.defineProperty,la=Object.getOwnPropertyDescriptor,Ae=(e,s,a,i)=>{for(var t=i>1?void 0:i?la(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&oa(s,a,t),t};const da={loading:{icon:"clock",title:()=>v("states.loading"),hint:()=>"",tone:"neutral"},empty:{icon:"map",title:()=>v("states.empty"),hint:()=>"",tone:"neutral"},error:{icon:"warning",title:()=>v("states.error"),hint:()=>v("states.errorHint"),tone:"danger"},forbidden:{icon:"lock",title:()=>v("states.forbidden"),hint:()=>v("states.forbiddenHint"),tone:"forbidden"},stale:{icon:"offline",title:()=>v("states.stale"),hint:()=>v("states.staleHint"),tone:"stale"},partial:{icon:"info",title:()=>v("states.partial"),hint:()=>"",tone:"stale"}};let ee=class extends w{constructor(){super(...arguments),this.state="empty",this.heading="",this.hint="",this.actionLabel="",this.compact=!1}render(){const e=da[this.state],s=this.hint||e.hint();return n`
      <div class="icon" aria-hidden="true"><sw-icon .name=${e.icon} size=${this.compact?20:26}></sw-icon></div>
      <div class="text" role="status">
        <h4>${this.heading||e.title()}</h4>
        ${s?n`<p>${s}</p>`:""}
        <slot></slot>
      </div>
      ${this.actionLabel?n`<sw-button variant=${this.state==="error"?"primary":"secondary"} size="sm" @click=${()=>this.dispatchEvent(new CustomEvent("action",{bubbles:!0,composed:!0}))}>${this.actionLabel}</sw-button>`:""}
    `}};ee.styles=g`
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
    :host([state='forbidden']) .icon {
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
  `;Ae([c({reflect:!0})],ee.prototype,"state",2);Ae([c()],ee.prototype,"heading",2);Ae([c()],ee.prototype,"hint",2);Ae([c()],ee.prototype,"actionLabel",2);Ae([c({type:Boolean,reflect:!0})],ee.prototype,"compact",2);ee=Ae([b("sw-state-panel")],ee);var ca=Object.defineProperty,pa=Object.getOwnPropertyDescriptor,O=(e,s,a,i)=>{for(var t=i>1?void 0:i?pa(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&ca(s,a,t),t};const Pt=.2,Mt=6,St={live:"var(--sw-accent)",recorded:"var(--sw-accent)",historic:"var(--sw-accent)",offline:"var(--sw-offline)",stale:"var(--sw-stale)",unknown:"var(--sw-unknown)",forbidden:"var(--sw-forbidden)",error:"var(--sw-danger)",neutral:"var(--sw-surface)",partial:"var(--sw-stale)"},ha={camera:d`<path d="M-7 -4.5A1.5 1.5 0 0 1 -5.5 -6H-2l1.5-2h5L6 -6h1.5A1.5 1.5 0 0 1 9 -4.5v9A1.5 1.5 0 0 1 7.5 6h-13A1.5 1.5 0 0 1 -7 4.5z" transform="translate(-1 0) scale(0.9)"/><circle cx="-1" cy="0" r="3"/>`,lock:d`<rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/>`,light:d`<path d="M-3 6h6M-2 8.5h4"/><path d="M0 -8a5 5 0 0 0-3 9c.7.5 1.2 1.3 1.2 2.2h3.6c0-.9.5-1.7 1.2-2.2A5 5 0 0 0 0 -8z"/>`,binary_sensor:d`<circle cx="0" cy="0" r="2"/><path d="M-4.5 -4.5a6.4 6.4 0 0 0 0 9M4.5 -4.5a6.4 6.4 0 0 1 0 9"/>`};let _=class extends w{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.plan=null,this.markers=[],this.selectedId=null,this.dimEntities=!1,this.alwaysLabel=!1,this.imageUrl=null,this.editable=!1,this.scale=1,this.tx=0,this.ty=0,this.hoverId=null,this.dragging=null,this.pointers=new Map,this.lastPan=null,this.lastPinchDist=0,this.dragMoved=!1,this.fitted=!1,this.onWheel=e=>{e.preventDefault();const s=this.getBoundingClientRect();this.zoomBy(e.deltaY<0?1.15:1/1.15,e.clientX-s.left,e.clientY-s.top)},this.onMarkerPointerDown=(e,s)=>{if(!this.editable||s.button!==0)return;s.stopPropagation(),s.preventDefault(),this.dragging={id:e.id,x:e.x,y:e.y},this.viewport.setPointerCapture(s.pointerId);const a=t=>{const r=this.getBoundingClientRect(),o=this.toPlan(t.clientX-r.left,t.clientY-r.top);this.dragging={id:e.id,x:o.x,y:o.y}},i=t=>{this.viewport.removeEventListener("pointermove",a),this.viewport.removeEventListener("pointerup",i),this.viewport.removeEventListener("pointercancel",i);const r=this.getBoundingClientRect(),o=this.toPlan(t.clientX-r.left,t.clientY-r.top),l=Math.abs(o.x-e.x)>5e-4||Math.abs(o.y-e.y)>5e-4;this.dragging=null,l?this.dispatchEvent(new CustomEvent("marker-move",{detail:{id:e.id,x:o.x,y:o.y},bubbles:!0,composed:!0})):this.select(e,t)};this.viewport.addEventListener("pointermove",a),this.viewport.addEventListener("pointerup",i),this.viewport.addEventListener("pointercancel",i)},this.onPointerDown=e=>{this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.dragMoved=!1,this.pointers.size===1?(this.lastPan={x:e.clientX,y:e.clientY},this.viewport.classList.add("dragging")):this.pointers.size===2&&(this.lastPinchDist=this.pinchDistance(),this.lastPan=null)},this.onPointerMove=e=>{if(this.pointers.has(e.pointerId)){if(this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.pointers.size===2){const s=this.pinchDistance();if(this.lastPinchDist>0){const[a,i]=[...this.pointers.values()],t=this.getBoundingClientRect();this.zoomBy(s/this.lastPinchDist,(a.x+i.x)/2-t.left,(a.y+i.y)/2-t.top)}this.lastPinchDist=s,this.dragMoved=!0;return}if(this.lastPan){const s=e.clientX-this.lastPan.x,a=e.clientY-this.lastPan.y;!this.dragMoved&&Math.abs(s)+Math.abs(a)>2&&(this.dragMoved=!0,this.viewport.hasPointerCapture(e.pointerId)||this.viewport.setPointerCapture(e.pointerId)),this.tx+=s,this.ty+=a,this.lastPan={x:e.clientX,y:e.clientY}}}},this.onPointerUp=e=>{if(this.pointers.delete(e.pointerId),this.pointers.size===0)this.lastPan=null,this.viewport.classList.remove("dragging");else if(this.pointers.size===1){const[s]=[...this.pointers.values()];this.lastPan={x:s.x,y:s.y}}},this.onBackgroundClick=()=>{this.dragMoved||this.dispatchEvent(new CustomEvent("marker-select",{detail:{id:null},bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.fitted||this.fit()}),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect()}updated(e){(e.has("planWidth")||e.has("planHeight"))&&(this.fitted=!1,this.fit()),(e.has("scale")||e.has("tx")||e.has("ty"))&&this.dispatchEvent(new CustomEvent("view-change",{bubbles:!0,composed:!0}))}toScreen(e,s){return{x:this.tx+e*this.planWidth*this.scale,y:this.ty+s*this.planHeight*this.scale}}fit(){const e=this.clientWidth,s=this.clientHeight;if(!e||!s||!this.planWidth||!this.planHeight)return;const a=24,i=Math.min((e-a*2)/this.planWidth,(s-a*2)/this.planHeight);this.scale=Math.max(Pt,Math.min(Mt,i)),this.tx=(e-this.planWidth*this.scale)/2,this.ty=(s-this.planHeight*this.scale)/2,this.fitted=!0}zoomBy(e,s,a){const i=this.clientWidth,t=this.clientHeight,r=s??i/2,o=a??t/2,l=Math.max(Pt,Math.min(Mt,this.scale*e)),f=l/this.scale;this.tx=r-(r-this.tx)*f,this.ty=o-(o-this.ty)*f,this.scale=l,this.fitted=!0}toPlan(e,s){return{x:Math.min(1,Math.max(0,(e-this.tx)/this.scale/this.planWidth)),y:Math.min(1,Math.max(0,(s-this.ty)/this.scale/this.planHeight))}}pinchDistance(){const[e,s]=[...this.pointers.values()];return Math.hypot(e.x-s.x,e.y-s.y)}select(e,s){if(this.dragMoved)return;s.stopPropagation();const a=this.toScreen(e.x,e.y),i={id:e.id,sx:a.x,sy:a.y};this.dispatchEvent(new CustomEvent("marker-select",{detail:i,bubbles:!0,composed:!0}))}fovPath(e,s,a){const i=(e-s/2)*Math.PI/180,t=(e+s/2)*Math.PI/180,r=Math.cos(i)*a,o=Math.sin(i)*a,l=Math.cos(t)*a,f=Math.sin(t)*a;return`M0 0 L${r.toFixed(1)} ${o.toFixed(1)} A${a} ${a} 0 ${s>180?1:0} 1 ${l.toFixed(1)} ${f.toFixed(1)} Z`}renderMarker(e){const s=this.dragging?.id===e.id?this.dragging:e,a=s.x*this.planWidth,i=s.y*this.planHeight,t=1/this.scale,r=e.kind==="camera",o=St[e.state]??St.neutral,l=this.selectedId===e.id,f=this.alwaysLabel||l||this.hoverId===e.id,y=Math.max(44,e.label.length*6.5+16),m=this.dimEntities&&!r,u=r?13:11;return d`
      <g class="marker ${e.state} ${l?"selected":""} ${m?"dimmed":""} ${this.editable?"editable":""}"
         transform="translate(${a} ${i})"
         tabindex="0" role="button" aria-label=${e.label} aria-pressed=${l}
         @mouseenter=${()=>this.hoverId=e.id} @mouseleave=${()=>this.hoverId=null}
         @pointerdown=${$=>this.onMarkerPointerDown(e,$)}
         @click=${$=>this.editable?$.stopPropagation():this.select(e,$)}
         @keydown=${$=>($.key==="Enter"||$.key===" ")&&this.select(e,$)}>
        ${r&&e.fov&&e.state!=="forbidden"?d`<path class="fov ${e.state==="offline"?"off":""}" d=${this.fovPath(e.rotation??0,e.fov,140)} />`:h}
        <g transform="scale(${t})">
          <circle class="halo" r=${u+9} />
          <circle class="pin" r=${u} fill=${o} />
          <g class="icon" transform="scale(${r?.85:.75})">${ha[e.kind]}</g>
          ${e.state==="offline"?d`<line x1="-9" y1="-9" x2="9" y2="9" stroke="#fff" stroke-width="2.5" />`:h}
          ${e.state==="forbidden"?d`<g transform="translate(8 -8)"><circle r="6.5" fill="#fff" /><g fill="none" stroke="var(--sw-forbidden)" stroke-width="1.5" transform="scale(0.45)"><rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/></g></g>`:h}
          ${f?d`<g transform="translate(0 ${u+14})">
                <rect class="lbl-bg" x=${-y/2} y="-10" width=${y} height="20" rx="6" />
                <text class="lbl" y="3.5">${e.label}</text>
              </g>`:h}
        </g>
      </g>
    `}render(){return n`
      <div class="viewport" @wheel=${this.onWheel} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
           @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp} @click=${this.onBackgroundClick}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl?d`<image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />`:h}
            ${this.plan??h}
            ${this.markers.map(e=>this.renderMarker(e))}
          </g>
        </svg>
      </div>
      <div class="controls" role="group" aria-label="זום">
        <sw-button variant="ghost" size="sm" iconOnly icon="plus" label=${v("floor.zoomIn")} @click=${()=>this.zoomBy(1.25)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="minus" label=${v("floor.zoomOut")} @click=${()=>this.zoomBy(.8)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="fit" label=${v("floor.fit")} @click=${()=>{this.fitted=!1,this.fit()}}></sw-button>
      </div>
      <div class="scale" aria-live="polite">${Math.round(this.scale*100)}%</div>
    `}};_.styles=g`
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
      right: var(--sw-s-3);
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
      left: var(--sw-s-3);
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
  `;O([c({type:Number})],_.prototype,"planWidth",2);O([c({type:Number})],_.prototype,"planHeight",2);O([c({attribute:!1})],_.prototype,"plan",2);O([c({attribute:!1})],_.prototype,"markers",2);O([c()],_.prototype,"selectedId",2);O([c({type:Boolean})],_.prototype,"dimEntities",2);O([c({type:Boolean})],_.prototype,"alwaysLabel",2);O([c()],_.prototype,"imageUrl",2);O([c({type:Boolean})],_.prototype,"editable",2);O([p()],_.prototype,"scale",2);O([p()],_.prototype,"tx",2);O([p()],_.prototype,"ty",2);O([p()],_.prototype,"hoverId",2);O([p()],_.prototype,"dragging",2);O([rt(".viewport")],_.prototype,"viewport",2);_=O([b("sw-plan-canvas")],_);const Ot={name:"אתר הדגמה",building:"מבנה א"},se=[{id:"f0",name:"קומה 0",hasPlan:!0,planWidth:1200,planHeight:800,cameraCount:6,entityCount:4},{id:"f-1",name:"קומה 1-",hasPlan:!0,planWidth:900,planHeight:1100,cameraCount:3,entityCount:1},{id:"f-2",name:"קומה 2-",hasPlan:!1,planWidth:0,planHeight:0,cameraCount:2,entityCount:0}],ps=[{id:"cam-1",name:"כניסה ראשית",floorId:"f0",x:.09,y:.52,rotation:20,fov:70,state:"live",source:"NVR ערוץ 1"},{id:"cam-2",name:"לובי",floorId:"f0",x:.34,y:.3,rotation:120,fov:80,state:"live",source:"NVR ערוץ 2"},{id:"cam-3",name:"מסדרון מזרחי",floorId:"f0",x:.62,y:.55,rotation:180,fov:60,state:"offline",source:"NVR ערוץ 3"},{id:"cam-4",name:"אולם",floorId:"f0",x:.82,y:.22,rotation:210,fov:90,state:"live",source:"NVR ערוץ 4"},{id:"cam-5",name:"חדר מדרגות",floorId:"f0",x:.9,y:.8,rotation:250,fov:60,state:"stale",source:"NVR ערוץ 5"},{id:"cam-6",name:"חניה",floorId:"f0",x:.4,y:.86,rotation:300,fov:75,state:"forbidden",source:"NVR ערוץ 6"},{id:"cam-7",name:"מחסן",floorId:"f-1",x:.3,y:.3,rotation:45,fov:70,state:"live",source:"NVR ערוץ 7"},{id:"cam-8",name:"חדר מכונות",floorId:"f-1",x:.7,y:.6,rotation:200,fov:70,state:"live",source:"NVR ערוץ 8"},{id:"cam-9",name:"מקלט",floorId:"f-1",x:.5,y:.85,rotation:270,fov:70,state:"offline",source:"NVR ערוץ 9"}],js=[{id:"lock.main_door",name:"דלת כניסה",floorId:"f0",x:.05,y:.4,domain:"lock",state:"locked",stateLabelKey:"entity.locked",controllable:!1,lastChanged:"לפני 12 דק׳"},{id:"light.lobby",name:"תאורת לובי",floorId:"f0",x:.3,y:.42,domain:"light",state:"on",stateLabelKey:"entity.on",controllable:!0,lastChanged:"לפני שעה"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",floorId:"f0",x:.7,y:.3,domain:"binary_sensor",state:"off",stateLabelKey:"entity.off",controllable:!1,lastChanged:"לפני 3 דק׳"},{id:"light.corridor",name:"תאורת מסדרון",floorId:"f0",x:.55,y:.66,domain:"light",state:"off",stateLabelKey:"entity.off",controllable:!0,lastChanged:"אתמול 22:10"},{id:"lock.shelter",name:"דלת מקלט",floorId:"f-1",x:.46,y:.9,domain:"lock",state:"locked",stateLabelKey:"entity.locked",controllable:!1,lastChanged:"לפני 2 שעות"}],qt={f0:[{x:40,y:40,w:300,h:260,label:"לובי",kind:"lobby"},{x:40,y:340,w:300,h:220,label:"משרדים",kind:"office"},{x:40,y:600,w:460,h:160,label:"חניה מקורה",kind:"parking"},{x:380,y:40,w:420,h:300,label:"אולם",kind:"hall"},{x:840,y:40,w:320,h:300,label:"אולם ב",kind:"meeting"},{x:380,y:380,w:300,h:180,label:"חדר ישיבות",kind:"meeting"},{x:720,y:380,w:440,h:180,label:"מסדרון מזרחי",kind:"corridor"},{x:540,y:600,w:620,h:160,label:"שירותים ומדרגות",kind:"stairs"}],"f-1":[{x:40,y:40,w:400,h:400,label:"מחסן",kind:"storage"},{x:480,y:40,w:380,h:400,label:"חדר מכונות",kind:"machines"},{x:40,y:480,w:820,h:200,label:"מסדרון",kind:"corridor"},{x:40,y:720,w:820,h:340,label:"מקלט",kind:"shelter"}]};function Ts(e){const s=qt[e],a=se.find(i=>i.id===e);return!s||!a?.hasPlan?[]:s.map(i=>({x:i.x/a.planWidth,y:i.y/a.planHeight,w:i.w/a.planWidth,h:i.h/a.planHeight}))}const P="var(--sw-map-furniture)",k="var(--sw-map-furniture-line)";function fa(e){const s=e.x+e.w/2,a=e.y+e.h/2;switch(e.kind){case"lobby":return d`<rect x=${e.x+30} y=${e.y+e.h-70} width="130" height="30" rx="4" fill=${P} stroke=${k} /><rect x=${e.x+170} y=${e.y+30} width="110" height="36" rx="10" fill=${P} stroke=${k} /><circle cx=${e.x+22} cy=${e.y+22} r="10" fill="#dfe9d9" stroke="#b9cfae" /><circle cx=${e.x+e.w-22} cy=${e.y+22} r="10" fill="#dfe9d9" stroke="#b9cfae" />`;case"office":return d`${[0,1].map(i=>[0,1,2].map(t=>d`<rect x=${e.x+30+t*92} y=${e.y+36+i*92} width="56" height="28" rx="2" fill=${P} stroke=${k} /><circle cx=${e.x+58+t*92} cy=${e.y+78+i*92} r="8" fill=${P} stroke=${k} />`))}`;case"parking":return d`${[0,1,2,3,4,5,6,7].map(i=>d`<line x1=${e.x+30+i*56} y1=${e.y+20} x2=${e.x+30+i*56} y2=${e.y+e.h-20} stroke=${k} stroke-dasharray="6 6" />`)}${[1,3,4].map(i=>d`<rect x=${e.x+42+i*56} y=${e.y+36} width="30" height="70" rx="8" fill="#d5dce8" stroke=${k} />`)}`;case"hall":return d`${[0,1,2,3].map(i=>[0,1,2,3,4,5].map(t=>d`<rect x=${e.x+50+t*56} y=${e.y+60+i*52} width="26" height="16" rx="3" fill=${P} stroke=${k} />`))}<rect x=${e.x+40} y=${e.y+20} width=${e.w-80} height="14" rx="2" fill=${P} stroke=${k} />`;case"meeting":return d`<rect x=${s-80} y=${a-26} width="160" height="52" rx="12" fill=${P} stroke=${k} />${[0,1,2].map(i=>d`<circle cx=${s-50+i*50} cy=${a-44} r="9" fill=${P} stroke=${k} /><circle cx=${s-50+i*50} cy=${a+44} r="9" fill=${P} stroke=${k} />`)}`;case"corridor":return d`<rect x=${e.x+30} y=${a-8} width="90" height="16" rx="3" fill=${P} stroke=${k} />`;case"stairs":return d`<rect x=${e.x+e.w-130} y=${e.y+30} width="100" height="100" fill=${P} stroke=${k} />${[1,2,3,4,5,6,7].map(i=>d`<line x1=${e.x+e.w-130} y1=${e.y+30+i*12.5} x2=${e.x+e.w-30} y2=${e.y+30+i*12.5} stroke=${k} />`)}${[0,1,2,3].map(i=>d`<rect x=${e.x+30+i*46} y=${e.y+30} width="36" height="46" fill=${P} stroke=${k} />`)}`;case"storage":return d`${[0,1,2,3].map(i=>d`<rect x=${e.x+40+i*92} y=${e.y+40} width="30" height=${e.h-80} fill=${P} stroke=${k} />`)}`;case"machines":return d`${[0,1,2].map(i=>d`<rect x=${e.x+40} y=${e.y+40+i*120} width="110" height="72" rx="4" fill=${P} stroke=${k} /><circle cx=${e.x+240} cy=${e.y+76+i*120} r="26" fill=${P} stroke=${k} />`)}`;case"shelter":return d`${[0,1,2,3].map(i=>d`<rect x=${e.x+60} y=${e.y+50+i*70} width="220" height="22" rx="3" fill=${P} stroke=${k} /><rect x=${e.x+e.w-280} y=${e.y+50+i*70} width="220" height="22" rx="3" fill=${P} stroke=${k} />`)}`;default:return""}}function Kt(e){const s=qt[e],a=se.find(i=>i.id===e);return!s||!a?null:d`
    <rect x="0" y="0" width=${a.planWidth} height=${a.planHeight} fill="var(--sw-map-bg)" />
    <rect x="20" y="20" width=${a.planWidth-40} height=${a.planHeight-40} fill="none" stroke="var(--sw-map-wall)" stroke-width="3" />
    ${s.map(i=>d`
        <rect x=${i.x} y=${i.y} width=${i.w} height=${i.h} fill="var(--sw-map-room-fill)" stroke="var(--sw-map-wall)" stroke-width="1.6" />
        ${fa(i)}
        <text x=${i.x+14} y=${i.y+26} text-anchor="start" font-size="15" font-weight="500" fill="var(--sw-map-label)" font-family="var(--sw-font)" direction="rtl" style="unicode-bidi: plaintext">${i.label}</text>
      `)}
  `}const Hs=[{id:"site-a",name:"אתר הדגמה",address:"רחוב הדוגמה 1",buildings:2,cameras:10,online:9,alerts:2,health:"stale"},{id:"site-b",name:"סניף צפון",address:"שדרות הדגמה 20",buildings:1,cameras:6,online:6,alerts:0,health:"live"},{id:"site-c",name:"מחסן לוגיסטי",address:"אזור תעשייה",buildings:1,cameras:4,online:3,alerts:1,health:"offline"}],ua=[{id:"bld-a",siteId:"site-a",name:"מבנה א",floors:[{id:"f0",name:"קומה 0",cameras:6,entities:4,hasPlan:!0},{id:"f-1",name:"קומה 1-",cameras:3,entities:1,hasPlan:!0},{id:"f-2",name:"קומה 2-",cameras:2,entities:0,hasPlan:!1}]},{id:"bld-b",siteId:"site-a",name:"מבנה ב",floors:[{id:"b-f0",name:"קרקע",cameras:1,entities:2,hasPlan:!1}]}],M=[{id:"cam-1",name:"כניסה ראשית",floor:"קומה 0",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 2 דק׳",recording:"continuous",ptz:!1,audio:!1},{id:"cam-2",name:"לובי",floor:"קומה 0",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 5 דק׳",recording:"motion",ptz:!1,audio:!0},{id:"cam-3",name:"מסדרון מזרחי",floor:"קומה 0",state:"offline",stream:"sub",fps:null,bitrateKbps:null,firmware:"V5.8.10",lastEvent:"לפני שעה",recording:"unknown",ptz:!1,audio:!1},{id:"cam-4",name:"אולם",floor:"קומה 0",state:"live",stream:"main",fps:25,bitrateKbps:5120,firmware:"V5.8.10",lastEvent:"לפני 12 דק׳",recording:"continuous",ptz:!0,audio:!1},{id:"cam-5",name:"חדר מדרגות",floor:"קומה 0",state:"stale",stream:"sub",fps:20,bitrateKbps:2048,firmware:"V5.8.9",lastEvent:"לפני 40 דק׳",recording:"continuous",ptz:!1,audio:!1},{id:"cam-6",name:"חניה מקורה",floor:"קומה 0",state:"forbidden",stream:"sub",fps:null,bitrateKbps:null,firmware:"—",lastEvent:"—",recording:"unknown",ptz:!1,audio:!1},{id:"cam-7",name:"מחסן",floor:"קומה 1-",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 3 שעות",recording:"motion",ptz:!1,audio:!1},{id:"cam-8",name:"חדר מכונות",floor:"קומה 1-",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"אתמול",recording:"continuous",ptz:!1,audio:!1},{id:"cam-9",name:"מקלט",floor:"קומה 1-",state:"offline",stream:"sub",fps:null,bitrateKbps:null,firmware:"V5.8.10",lastEvent:"לפני יומיים",recording:"unknown",ptz:!1,audio:!1},{id:"cam-10",name:"חצר אחורית",floor:"חוץ",state:"live",stream:"sub",fps:25,bitrateKbps:4096,firmware:"V5.8.10",lastEvent:"לפני 8 דק׳",recording:"continuous",ptz:!0,audio:!0}],V={"cam-1":"entrance","cam-2":"lobby","cam-3":"corridor","cam-4":"hall","cam-5":"corridor","cam-6":"parking","cam-7":"warehouse","cam-8":"warehouse","cam-9":"night","cam-10":"backyard"},Rs={person:"זיהוי אדם",vehicle:"זיהוי רכב",motion:"תנועה",line:"חציית קו",offline:"מצלמה מנותקת",door:"דלת נפתחה"},F=[{id:"ev-1",time:"היום 10:14",minuteOfDay:614,type:"person",title:"אדם זוהה",camera:"כניסה ראשית",floor:"קומה 0",source:"NVR",acked:!1,severity:"alert"},{id:"ev-2",time:"היום 09:42",minuteOfDay:582,type:"vehicle",title:"רכב זוהה",camera:"חצר אחורית",floor:"חוץ",source:"NVR",acked:!1,severity:"info"},{id:"ev-3",time:"היום 08:31",minuteOfDay:511,type:"motion",title:"תנועה",camera:"מחסן",floor:"קומה 1-",source:"NVR",acked:!0,severity:"info"},{id:"ev-4",time:"היום 08:12",minuteOfDay:492,type:"door",title:"דלת כניסה נפתחה",camera:"כניסה ראשית",floor:"קומה 0",source:"HA",acked:!0,severity:"info"},{id:"ev-5",time:"היום 07:55",minuteOfDay:475,type:"offline",title:"מסדרון מזרחי מנותק",camera:"מסדרון מזרחי",floor:"קומה 0",source:"NVR",acked:!1,severity:"critical"},{id:"ev-6",time:"היום 06:43",minuteOfDay:403,type:"line",title:"חציית קו",camera:"חניה מקורה",floor:"קומה 0",source:"NVR",acked:!0,severity:"alert"},{id:"ev-7",time:"אתמול 23:10",minuteOfDay:1390,type:"person",title:"אדם זוהה",camera:"לובי",floor:"קומה 0",source:"NVR",acked:!0,severity:"info"}],hs=[{startMin:0,endMin:190,kind:"continuous"},{startMin:205,endMin:460,kind:"continuous"},{startMin:470,endMin:474,kind:"motion"},{startMin:480,endMin:486,kind:"motion"},{startMin:492,endMin:640,kind:"continuous"},{startMin:660,endMin:1439,kind:"continuous"}],Ls=[{id:"u-1",name:"יוני",haUser:"joni",active:!0,lastSync:"לפני 20 שנ׳",groups:["מנהלי מערכת"],bindings:[{role:"מנהל מערכת VMS",scope:"כל ההתקנה"}],haAdmin:!0},{id:"u-2",name:"דנה",haUser:"dana",active:!0,lastSync:"לפני 20 שנ׳",groups:["עורכי קומה 2"],bindings:[{role:"עורך מפות",scope:"מבנה א · קומה 2"}],haAdmin:!1},{id:"u-3",name:"יוסי",haUser:"yossi",active:!0,lastSync:"לפני 20 שנ׳",groups:["מנהלי מבנה א"],bindings:[{role:"מנהל אתר/מבנה",scope:"מבנה א"}],haAdmin:!1},{id:"u-4",name:"codex",haUser:"codex",active:!0,lastSync:"לפני 20 שנ׳",groups:[],bindings:[],haAdmin:!1},{id:"u-5",name:"רון",haUser:"ron",active:!1,lastSync:"לפני 3 ימים",groups:["צופים"],bindings:[{role:"צופה",scope:"אתר הדגמה"}],haAdmin:!1}],Gt=[{id:"g-1",name:"מנהלי מערכת",members:1,bindings:["מנהל מערכת VMS · כל ההתקנה"]},{id:"g-2",name:"עורכי קומה 2",members:1,bindings:["עורך מפות · מבנה א · קומה 2"]},{id:"g-3",name:"מנהלי מבנה א",members:1,bindings:["מנהל אתר/מבנה · מבנה א"]},{id:"g-4",name:"צופים",members:1,bindings:["צופה · אתר הדגמה"]}],Yt=[{id:"viewer",name:"צופה",allowed:"מפה, מצב ישויות מורשה, שידור חי",denied:"היסטוריה, עריכה, ייצוא, שליטה"},{id:"operator",name:"מפעיל",allowed:"צפייה, Playback, סקירת אירועים וסימון טיפול",denied:"עריכת מפות, תפקידים, ייצוא, פעולות פיזיות"},{id:"editor",name:"עורך מפות ותצוגות",allowed:"צפייה, יבוא/עריכה/פרסום מפות, מיקומים ותצוגות",denied:"Playback, ייצוא, משתמשים, סודות, שליטה"},{id:"site_admin",name:"מנהל אתר / מבנה / קומה",allowed:"מפעיל + עורך, הגדרות תוכן מקומיות",denied:"הגדרות מערכת, תפקידים, סודות, כתיבה ל־NVR"},{id:"system_admin",name:"מנהל מערכת VMS",allowed:"הגדרות מוצר, מקורות, מדיניות, קבוצות ושיוכים",denied:"ניהול HA, שליטה פיזית, ייצוא ראיות ללא grant"}],Xt=[{time:"10:24",user:"יוני",action:"צפייה חיה",resource:"כניסה ראשית",decision:"הותר",role:"מנהל מערכת · כל ההתקנה"},{time:"10:18",user:"דנה",action:"פרסום תוכנית",resource:"מבנה א · קומה 2",decision:"הותר",role:"עורך מפות · קומה 2"},{time:"10:11",user:"דנה",action:"עריכת תוכנית",resource:"מבנה א · קומה 3",decision:"נחסם: מחוץ להיקף",role:"עורך מפות · קומה 2"},{time:"09:55",user:"יוסי",action:"ייצוא קטע",resource:"לובי 09:10–09:20",decision:"נחסם: אין הרשאת ייצוא",role:"מנהל מבנה · מבנה א"},{time:"09:43",user:"codex",action:"כניסה דרך Ingress",resource:"—",decision:"הותר, ללא שיוך",role:"—"},{time:"09:30",user:"יוני",action:"הפעלת תאורה",resource:"light.lobby",decision:"הותר (HA אישר)",role:"מנהל מערכת"},{time:"08:12",user:"מערכת",action:"סנכרון משתמשים",resource:"HA bridge",decision:"5 משתמשים, 0 שינויים",role:"—"}],Jt=[{id:"job-1",title:"ייצוא: כניסה ראשית 09:10–09:25",status:"הושלם",progress:100,size:"182 MB",hash:"sha256 ✓"},{id:"job-2",title:"ייצוא: לובי 23:00–23:40",status:"בתהליך",progress:62,size:"—",hash:"—"},{id:"job-3",title:"תמונות מקדימות: קומה 0",status:"ממתין",progress:0,size:"—",hash:"—"},{id:"job-4",title:"ייצוא: חצר אחורית 02:00–04:00",status:"נכשל: פער בהקלטה",progress:35,size:"—",hash:"—"}],Vs=[{id:"case-1",title:"כניסה לא מורשית — 13.09",status:"פתוח",owner:"יוני",clips:3,notes:2,preserved:2,missing:1},{id:"case-2",title:"נזק לרכב בחניה",status:"בבדיקה",owner:"יוסי",clips:2,notes:1,preserved:2,missing:0},{id:"case-3",title:"דלת מקלט פתוחה בלילה",status:"סגור",owner:"יוני",clips:1,notes:3,preserved:1,missing:0}],Bs=[{id:"r-1",name:"אדם בלילה",trigger:"זיהוי אדם",scope:"חוץ · 22:00–06:00",action:"התראה + פתיחת מצלמות",enabled:!0,last:"אתמול 23:10"},{id:"r-2",name:"רכב באזור מוגבל",trigger:"זיהוי רכב",scope:"חניה מקורה",action:"התראה",enabled:!0,last:"היום 09:42"},{id:"r-3",name:"דלת נשארה פתוחה",trigger:"דלת > 60 שנ׳",scope:"כל הדלתות",action:"התראה + הקלטה",enabled:!0,last:"—"},{id:"r-4",name:"מצלמה מנותקת",trigger:"ניתוק",scope:"כל האתר",action:"התראה מיידית",enabled:!1,last:"היום 07:55"}],Zt=[{name:"NVR (הקלטה)",state:"live",detail:"10/10 ערוצים, דיסק תקין"},{name:"go2rtc (מדיה)",state:"live",detail:"גרסה ‎1.9.x‎ · 4 זרמים פעילים"},{name:"גשר Home Assistant",state:"stale",detail:"סנכרון אחרון לפני 4 דק׳"},{name:"מסד נתונים",state:"live",detail:"WAL · גיבוי אחרון אתמול 02:00"},{name:"תור עבודות",state:"partial",detail:"1 בתהליך · 1 נכשל"}],wa=["live","explore","investigate","system"];function At(e=window.location.hash){const s=e.replace(/^#/,"")||"/explore/floors/f0",[a,i=""]=s.split("?"),t=a.startsWith("/")?a:`/${a}`,r=t.split("/").filter(Boolean),o=r[0];return{path:t,segments:r,params:new URLSearchParams(i),mode:o&&wa.includes(o)?o:null}}function x(e,s){window.location.hash=`#${e}`}function va(e){const s=()=>e(At());return window.addEventListener("hashchange",s),e(At()),()=>window.removeEventListener("hashchange",s)}class _e extends Error{constructor(s,a){super(a.user_message||a.code),this.status=s,this.body=a}get code(){return this.body.code}}function ba(){return new URL("api/v1/",document.baseURI)}function ga(e){return new URL(e.replace(/^\/+/,""),ba()).toString()}function os(e){return new URL(e.replace(/^\/+/,""),document.baseURI).toString()}async function Je(e,s={}){const a=new Headers(s.headers);s.body&&!(s.body instanceof FormData)&&!a.has("Content-Type")&&a.set("Content-Type","application/json");const i=await fetch(ga(e),{...s,headers:a,credentials:"same-origin"});if(i.status===204)return;const t=await i.text();let r=null;try{r=t?JSON.parse(t):null}catch{r=null}if(!i.ok){const o=r??{code:`http_${i.status}`,user_message:i.statusText,retryable:!1,correlation_id:"",details:{}};throw new _e(i.status,o)}return r}const Ze=e=>Je(e),ie=(e,s)=>Je(e,{method:"POST",body:s===void 0?void 0:JSON.stringify(s)}),ot=(e,s)=>Je(e,{method:"PATCH",body:JSON.stringify(s)}),Qt=e=>Je(e,{method:"DELETE"}),ma=(e,s)=>Je(e,{method:"POST",body:s});function z(e){return e instanceof _e?e.body.user_message||e.body.code:e instanceof TypeError?"אין חיבור לשרת.":e instanceof Error?e.message:String(e)}const Us=new Set;let Re={mode:"loading",me:null,error:null};function as(e){Re=e,Us.forEach(s=>s(Re))}function xa(e){return Us.add(e),e(Re),()=>Us.delete(e)}async function ya(){try{const e=await Ze("me");as({mode:e.has_access?"api":"no_access",me:e,error:null})}catch(e){e instanceof _e&&e.status===401?as({mode:"unauthenticated",me:null,error:e.body.user_message}):e instanceof _e?as({mode:"demo",me:null,error:e.body.user_message}):as({mode:"demo",me:null,error:null})}return Re}const Le=()=>Re.mode==="api";function $a(e){const s=se.find(i=>i.id===e)??se[0],a=ps.filter(i=>i.floorId===s.id);return{source:"demo",floorId:s.id,floorName:s.name,buildingName:Ot.building,siteName:Ot.name,width:s.planWidth||1200,height:s.planHeight||800,imageUrl:null,planSvg:s.hasPlan?Kt(s.id):null,planStatus:s.hasPlan?"published":"none",planVersionId:s.hasPlan?`demo-${s.id}`:null,needsAlignment:!1,anchors:a.map((i,t)=>({id:`demo-anchor-${i.id}`,floor_id:s.id,plan_version_id:`demo-${s.id}`,resource_type:"camera",resource_id:i.id,position:{x:i.x,y:i.y},rotation_degrees:i.rotation,field_of_view_degrees:i.fov,layer_id:"cameras",label:i.name,revision:1,effective_from:"",effective_to:null,updated_at:"",camera:{id:i.id,recorder_id:"demo",channel:t+1,name:i.name,name_source:i.name,alias:null,enabled:!0,sort_order:t,main_track:null,sub_track:null,status:i.state==="offline"?"offline":"online",last_seen_at:null}})),cameras:[],permissions:{edit:!0,publish:!0,import:!0}}}async function ei(e,s=!1){if(!Le())return $a(e);const a=await Ze(`floors/${e}/map${s?"?draft=true":""}`);return{source:"api",floorId:a.floor.id,floorName:a.floor.name,buildingName:a.building.name,siteName:a.site.name,width:a.plan?.width_px??1200,height:a.plan?.height_px??800,imageUrl:a.plan?os(a.plan.image_url):null,planSvg:null,planStatus:a.plan?a.plan.status==="published"?"published":"draft":"none",planVersionId:a.plan?.id??null,needsAlignment:a.needs_alignment,anchors:a.anchors,cameras:a.cameras,permissions:a.permissions}}function Ws(e,s){const a=e.camera;return a?a.status==="online"?"live":a.status==="offline"?"offline":s??"unknown":s??"unknown"}const ka=e=>Ze(`floors/${e}/plan-assets`),za=(e,s)=>{const a=new FormData;return a.append("file",s,s.name),ma(`floors/${e}/plan-assets`,a)},_a=(e,s)=>ie(`floors/${e}/plan-versions`,s),si=e=>ie(`plan-versions/${e}/publish`),Pa=(e,s)=>ie(`floors/${e}/anchors`,s),Ma=(e,s)=>ot(`map-anchors/${e}`,s),Sa=e=>Qt(`map-anchors/${e}`),Oa=()=>Ze("cameras"),Aa=()=>ie("cameras/sync"),Ca=e=>ie("cameras",e),Ea=(e,s)=>ot(`cameras/${e}`,s);function Ia(){return{source:"demo",sites:Hs.map((s,a)=>({id:s.id,name:s.name,address:s.address,timezone:"Asia/Jerusalem",sort_order:a,updated_at:"",buildings:ua.filter(i=>i.siteId===s.id).map((i,t)=>({id:i.id,site_id:s.id,name:i.name,sort_order:t,updated_at:"",floors:i.floors.map((r,o)=>{const l=se.find(f=>f.id===r.id);return{id:r.id,building_id:i.id,name:r.name,level:-o,sort_order:o,ha_area_id:null,has_plan:r.hasPlan,published_version_id:r.hasPlan?`demo-${r.id}`:null,plan_width_px:l?.planWidth??null,plan_height_px:l?.planHeight??null,draft_version_id:null,anchor_count:r.cameras+r.entities,camera_count:r.cameras,updated_at:""}})}))})),canCreateSite:!0}}async function Ps(){if(!Le())return Ia();const e=await Ze("sites?tree=true");return{source:"api",sites:e.sites,canCreateSite:e.can_create_site}}const Da=e=>ie("sites",e),ti=(e,s)=>ie(`sites/${e}/buildings`,s),Na=(e,s)=>ie(`buildings/${e}/floors`,s),ja=(e,s)=>ot(`floors/${e}`,s),Ta=(e,s=!1)=>Qt(`floors/${e}${s?"?force=true":""}`);function Ha(e,s){for(const a of e.sites)for(const i of a.buildings??[]){const t=(i.floors??[]).find(r=>r.id===s);if(t)return{site:a,building:i,floor:t}}return null}var Ra=Object.defineProperty,La=Object.getOwnPropertyDescriptor,D=(e,s,a,i)=>{for(var t=i>1?void 0:i?La(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Ra(s,a,t),t};const Va=[{id:"cameras",icon:"camera",label:()=>v("floor.cameras")},{id:"doors",icon:"door",label:()=>v("floor.doors")},{id:"lights",icon:"light",label:()=>v("floor.lights")},{id:"sensors",icon:"sensor",label:()=>v("floor.sensors")}],Ct=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"];let A=class extends w{constructor(){super(...arguments),this.floorId="f0",this.screenState="ready",this.bundle=null,this.tree=null,this.loadError="",this.selectedId=null,this.anchor=null,this.layers=new Set(["cameras","doors","lights","sensors"]),this.pinned=!1,this.narrow=!1,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.narrow=this.mq.matches}connectedCallback(){super.connectedCallback(),this.narrow=this.mq.matches,this.mq.addEventListener("change",this.onMq),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}updated(e){e.has("floorId")&&e.get("floorId")!==void 0&&(this.selectedId=null,this.anchor=null,this.load())}async load(){this.loadError="";try{const[e,s]=await Promise.all([this.tree?Promise.resolve(this.tree):Ps(),ei(this.floorId)]);this.tree=e,this.bundle=s}catch(e){this.loadError=z(e),this.bundle=null}}get floors(){return this.tree?.source==="api"?this.tree.sites.flatMap(e=>(e.buildings??[]).flatMap(s=>(s.floors??[]).map(a=>({id:a.id,name:`${s.name} · ${a.name}`,cameraCount:a.camera_count,hasPlan:a.has_plan})))):se.map(e=>({id:e.id,name:e.name,cameraCount:e.cameraCount,hasPlan:e.hasPlan}))}get markers(){const e=this.bundle;if(!e)return[];const s=this.screenState==="stale";if(e.source==="demo"){const a=this.layers.has("cameras")?ps.filter(t=>t.floorId===e.floorId).map(t=>({id:t.id,kind:"camera",label:t.name,x:t.x,y:t.y,rotation:t.rotation,fov:t.fov,state:t.state})):[],i=js.filter(t=>t.floorId===e.floorId).filter(t=>t.domain==="lock"&&this.layers.has("doors")||t.domain==="light"&&this.layers.has("lights")||t.domain==="binary_sensor"&&this.layers.has("sensors")).map(t=>({id:t.id,kind:t.domain,label:t.name,x:t.x,y:t.y,state:s?"stale":"neutral"}));return[...a,...i]}return e.anchors.filter(a=>a.resource_type==="camera"?this.layers.has("cameras"):!0).map(a=>({id:a.id,kind:a.resource_type==="camera"?"camera":a.layer_id==="doors"?"lock":a.layer_id==="lights"?"light":"binary_sensor",label:a.camera?.name??a.label??a.resource_id,x:a.position.x,y:a.position.y,rotation:a.rotation_degrees,fov:a.field_of_view_degrees??void 0,state:a.resource_type==="camera"?Ws(a):"neutral"}))}toggleLayer(e){const s=new Set(this.layers);s.has(e)?s.delete(e):s.add(e),this.layers=s}onSelect(e){this.selectedId=e.detail.id,this.anchor=e.detail.id&&e.detail.sx!==void 0&&e.detail.sy!==void 0?{x:e.detail.sx,y:e.detail.sy}:null}onViewChange(){if(!this.selectedId||!this.canvas)return;const e=this.markers.find(a=>a.id===this.selectedId);if(!e)return;const s=this.canvas.toScreen(e.x,e.y);this.anchor={x:s.x,y:s.y}}close(){this.selectedId=null,this.anchor=null}demoCameraBody(e,s){const a=e.state==="offline"?v("camera.offlineReason"):e.state==="forbidden"?v("camera.forbiddenReason"):e.state==="stale"?v("camera.staleReason"):"",i=e.state==="live"||e.state==="stale";return n`
      ${i?n`<sw-camera-tile name="" state=${e.state} scene=${V[e.id]??"lobby"} @click=${()=>x(`/live/cameras/${e.id}`)}></sw-camera-tile>`:n`<div class="off"><div><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${22}></sw-icon><div>${a}</div></div></div>`}
      <div class="statusrow"><sw-badge kind=${e.state}></sw-badge><span>${s} · ${e.source}</span></div>
      ${a&&i?n`<div class="warn">${a}</div>`:h}
    `}demoEntityBody(e){const s=this.screenState==="stale",a=s?"stale":e.state==="on"||e.state==="unlocked"?"live":"neutral";return n`
      <dl class="meta">
        <dt>${v("entity.state")}</dt><dd><sw-badge kind=${a} label=${v(e.stateLabelKey)}></sw-badge></dd>
        <dt>${v("entity.lastChanged")}</dt><dd>${e.lastChanged}</dd>
        <dt>ID</dt><dd><span class="ltr">${e.id}</span></dd>
      </dl>
      ${s?n`<div class="warn">${v("states.staleHint")}</div>`:h}
      ${e.controllable?h:n`<div class="note">${v("entity.noControl")}</div>`}
    `}apiCameraBody(e,s){const a=e.camera,i=Ws(e),t=Ct[((a?.channel??1)-1)%Ct.length];return n`
      ${i==="offline"?n`<div class="off"><div><sw-icon name="offline" size=${22}></sw-icon><div>${v("camera.offlineReason")}</div></div></div>`:n`<sw-camera-tile name="" state=${i==="live"?"live":"unknown"} scene=${t}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${i}></sw-badge><span>${s} · ערוץ ${a?.channel??"?"}</span></div>
      <dl class="meta">
        <dt>שם ב־NVR</dt><dd>${a?.name_source||"—"}</dd>
        <dt>Track</dt><dd><span class="ltr">${a?.main_track??"?"} / ${a?.sub_track??"?"}</span></dd>
        <dt>נראתה לאחרונה</dt><dd>${a?.last_seen_at?a.last_seen_at.replace("T"," ").replace("Z"," UTC"):"לא נבדק"}</dd>
      </dl>
      <div class="note">וידאו חי יתחבר דרך go2rtc במקטע הבא (T017); התמונה כאן היא איור.</div>
    `}renderCard(){const e=this.bundle;if(!this.selectedId||!e)return h;let s="",a="",i=h,t=h;if(e.source==="demo"){const l=ps.find(m=>m.id===this.selectedId),f=l?void 0:js.find(m=>m.id===this.selectedId);if(!l&&!f)return h;s=l?l.name:f.name,a=l?`${e.floorName} · ${l.source}`:`${e.floorName} · ${v(f.domain==="lock"?"entity.door":f.domain==="light"?"entity.light":"entity.sensor")}`,i=l?this.demoCameraBody(l,e.floorName):this.demoEntityBody(f);const y=l?l.state==="live"||l.state==="stale":!1;t=l?n`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${!y} @click=${()=>x(`/live/cameras/${l.id}`)}>צפייה חיה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${l.state==="forbidden"} @click=${()=>x("/investigate/playback")}>${v("camera.recordings")}</sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="pin" label=${this.pinned?v("camera.unpin"):v("camera.pin")} @click=${()=>this.pinned=!this.pinned}></sw-button>`:n`<sw-button variant="primary" size="sm" ?disabled=${!f.controllable||this.screenState==="stale"}>${v("entity.control")}</sw-button><sw-button variant="ghost" size="sm">${v("entity.openInHa")}</sw-button>`}else{const l=e.anchors.find(f=>f.id===this.selectedId);if(!l)return h;s=l.camera?.name??l.label??l.resource_id,a=`${e.buildingName} · ${e.floorName}`,i=l.resource_type==="camera"?this.apiCameraBody(l,e.floorName):n`<div class="note">ישות HA · ${l.resource_id} — מצב יגיע עם גשר HA (T025).</div>`,t=n`<sw-button variant="primary" size="sm" icon="expand" disabled title="וידאו חי מגיע במקטע הבא">צפייה חיה</sw-button>
        <sw-button size="sm" icon="history" disabled>${v("camera.recordings")}</sw-button>
        ${e.permissions.edit?n`<sw-button variant="ghost" size="sm" icon="edit" @click=${()=>x(`/explore/floors/${e.floorId}/edit`)}>עריכה</sw-button>`:h}`}if(this.narrow||!this.anchor)return n`<sw-drawer open heading=${s} subheading=${a} @close=${this.close}>${i}<div slot="footer">${t}</div></sw-drawer>`;const r=this.stage?.clientWidth??0,o=this.stage?.clientHeight??0;return n`<sw-popover heading=${s} .x=${this.anchor.x} .y=${this.anchor.y} .stageWidth=${r} .stageHeight=${o} @close=${this.close}>${i}<div slot="footer">${t}</div></sw-popover>`}renderStage(){const e=this.bundle;if(this.loadError)return n`<div class="cover"><sw-state-panel state="error" hint=${this.loadError} actionLabel=${v("states.retry")} @action=${()=>this.load()}></sw-state-panel></div>`;if(!e)return n`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;switch(this.screenState){case"loading":return n`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;case"error":return n`<div class="cover"><sw-state-panel state="error" actionLabel=${v("states.retry")}></sw-state-panel></div>`;case"forbidden":return n`<div class="cover"><sw-state-panel state="forbidden"></sw-state-panel></div>`}return this.screenState==="empty"||e.planStatus==="none"?n`<div class="cover">
        <sw-state-panel state="empty" heading=${v("floor.noPlan")} hint=${e.permissions.import?v("floor.noPlanHint"):"עורך המפות של הקומה יכול להעלות תוכנית."}>
          <div style="display:flex;gap:8px;margin-block-start:10px;justify-content:center;flex-wrap:wrap">
            ${e.permissions.import?n`<sw-button variant="primary" icon="upload" @click=${()=>x(`/explore/floors/${e.floorId}/import`)}>${v("floor.uploadPlan")}</sw-button>`:h}
            <sw-button icon="list" @click=${()=>x("/live/wall")}>${v("floor.listView")}</sw-button>
          </div>
        </sw-state-panel>
      </div>`:n`
      ${this.screenState==="stale"||this.screenState==="partial"?n`<div class="banner"><sw-state-panel compact state=${this.screenState}></sw-state-panel></div>`:e.needsAlignment?n`<div class="banner"><sw-state-panel compact state="partial" heading="פריטים הוצבו על גרסת תוכנית קודמת" hint="בדוק שהמיקומים עדיין נכונים על הרקע החדש (עורך התוכנית)."></sw-state-panel></div>`:h}
      <sw-plan-canvas
        .planWidth=${e.width}
        .planHeight=${e.height}
        .plan=${e.planSvg}
        .imageUrl=${e.imageUrl}
        .markers=${this.markers}
        .selectedId=${this.selectedId}
        .dimEntities=${this.screenState==="stale"}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
      <div class="legend" aria-label="מקרא">
        <span><i style="--lg: var(--sw-accent)"></i>חי</span>
        <span><i style="--lg: var(--sw-stale)"></i>לא מעודכן</span>
        <span><i style="--lg: var(--sw-offline)"></i>מנותק</span>
        <span><i style="--lg: var(--sw-forbidden)"></i>ללא הרשאה</span>
        <span><i style="--lg: #fff; box-shadow: 0 0 0 1px var(--sw-border-strong)"></i>ישות HA</span>
      </div>
      ${this.renderCard()}
    `}render(){const e=this.bundle,s=this.floors,a=s.find(r=>r.id===this.floorId),i=e?e.source==="demo"?a?.cameraCount??0:e.anchors.filter(r=>r.resource_type==="camera").length:0,t=this.tree?.source==="api"?this.tree.sites.flatMap(r=>(r.buildings??[]).flatMap(o=>o.floors??[])).find(r=>r.id===this.floorId):null;return n`
      <div class="head">
        <div>
          <div class="crumbs">
            <a href="#/explore/sites">${e?.siteName??"אתרים"}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <a href="#/explore/buildings/${e?.source==="api"?t?.building_id??"bld-a":"bld-a"}/floors">${e?.buildingName??""}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <span>${e?.floorName??""}</span>
          </div>
          <h1>${e?`${e.buildingName} – ${e.floorName}`:"מפת קומה"}</h1>
          <div class="sub">
            <span>${i} מצלמות${e?.source==="demo"?" · נתוני הדגמה":e?.planStatus==="published"?" · תוכנית מפורסמת":""}</span>
            ${t?.draft_version_id?n`<sw-badge kind="stale" label="טיוטת תוכנית ממתינה לפרסום"></sw-badge>`:h}
          </div>
        </div>
        <div class="spacer"></div>
        <div class="tools">
          <div class="layers" role="group" aria-label=${v("floor.layers")}>
            ${Va.map(r=>n`<button class=${this.layers.has(r.id)?"on":""} title=${r.label()} aria-label=${r.label()} aria-pressed=${this.layers.has(r.id)} @click=${()=>this.toggleLayer(r.id)}><sw-icon name=${r.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-field><select aria-label=${v("floor.switcher")} @change=${r=>x(`/explore/floors/${r.target.value}`)}>${s.map(r=>n`<option value=${r.id} ?selected=${r.id===this.floorId}>${r.name} · ${r.cameraCount} מצלמות${r.hasPlan?"":" · אין תוכנית"}</option>`)}</select></sw-field>
          ${!e||e.permissions.edit?n`<sw-button icon="edit" @click=${()=>x(`/explore/floors/${this.floorId}/edit`)}>עריכת תוכנית</sw-button>`:h}
        </div>
      </div>
      <div class="stage">${this.renderStage()}</div>
    `}};A.styles=g`
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
    .statusrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
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
  `;D([c()],A.prototype,"floorId",2);D([c()],A.prototype,"screenState",2);D([p()],A.prototype,"bundle",2);D([p()],A.prototype,"tree",2);D([p()],A.prototype,"loadError",2);D([p()],A.prototype,"selectedId",2);D([p()],A.prototype,"anchor",2);D([p()],A.prototype,"layers",2);D([p()],A.prototype,"pinned",2);D([p()],A.prototype,"narrow",2);D([rt("sw-plan-canvas")],A.prototype,"canvas",2);D([rt(".stage")],A.prototype,"stage",2);A=D([b("explore-floor-map")],A);var Ba=Object.defineProperty,Ua=Object.getOwnPropertyDescriptor,Ce=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ua(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Ba(s,a,t),t};let te=class extends w{constructor(){super(...arguments),this.heading="",this.subheading="",this.crumbs="",this.wide=!1,this.flush=!1}render(){const e=this.crumbs?this.crumbs.split("|").map(s=>s.trim()):[];return n`
      <header>
        <div>
          ${e.length?n`<div class="crumbs">${e.map((s,a)=>n`${a?n`<sw-icon name="chevron" size=${11}></sw-icon>`:""}<span>${s}</span>`)}</div>`:""}
          <h1>${this.heading}</h1>
          ${this.subheading?n`<div class="sub">${this.subheading}</div>`:""}
        </div>
        <div class="actions"><slot name="actions"></slot></div>
      </header>
      <div class="body"><slot></slot></div>
    `}};te.styles=g`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      padding: 14px 24px 24px;
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
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
      letter-spacing: -0.01em;
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
  `;Ce([c()],te.prototype,"heading",2);Ce([c()],te.prototype,"subheading",2);Ce([c()],te.prototype,"crumbs",2);Ce([c({type:Boolean,reflect:!0})],te.prototype,"wide",2);Ce([c({type:Boolean,reflect:!0})],te.prototype,"flush",2);te=Ce([b("sw-page")],te);var Wa=Object.defineProperty,Fa=Object.getOwnPropertyDescriptor,Qe=(e,s,a,i)=>{for(var t=i>1?void 0:i?Fa(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Wa(s,a,t),t};let pe=class extends w{constructor(){super(...arguments),this.heading="",this.subheading="",this.flush=!1,this.interactive=!1}render(){return n`
      ${this.heading||this.querySelector('[slot="actions"]')?n`<header><div><h3>${this.heading}</h3>${this.subheading?n`<div class="sub">${this.subheading}</div>`:""}</div><slot name="actions"></slot></header>`:""}
      <slot></slot>
    `}};pe.styles=g`
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
  `;Qe([c()],pe.prototype,"heading",2);Qe([c()],pe.prototype,"subheading",2);Qe([c({type:Boolean,reflect:!0})],pe.prototype,"flush",2);Qe([c({type:Boolean,reflect:!0})],pe.prototype,"interactive",2);pe=Qe([b("sw-card")],pe);var qa=Object.defineProperty,Ka=Object.getOwnPropertyDescriptor,Ms=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ka(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&qa(s,a,t),t};let Pe=class extends w{constructor(){super(...arguments),this.open=!1,this.heading="",this.subheading="",this.onKey=e=>{e.key==="Escape"&&this.open&&this.close()}}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey)}render(){return n`<div class="backdrop" @click=${e=>e.target===e.currentTarget&&this.close()}>
      <div class="box" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <header><div><h3>${this.heading}</h3>${this.subheading?n`<div class="sub">${this.subheading}</div>`:""}</div><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
        <div class="body"><slot></slot></div>
        <footer><slot name="footer"></slot></footer>
      </div>
    </div>`}};Pe.styles=g`
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
  `;Ms([c({type:Boolean,reflect:!0})],Pe.prototype,"open",2);Ms([c()],Pe.prototype,"heading",2);Ms([c()],Pe.prototype,"subheading",2);Pe=Ms([b("sw-dialog")],Pe);var Ga=Object.defineProperty,Ya=Object.getOwnPropertyDescriptor,ae=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ya(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Ga(s,a,t),t};const Xa=["house","building","warehouse"];let B=class extends w{constructor(){super(...arguments),this.tab="all",this.tree=null,this.dialog=null,this.formName="",this.formAddress="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.reload()}async reload(){try{this.tree=await Ps()}catch(e){this.error=z(e)}}open(e){this.formName="",this.formAddress="",this.error="",this.dialog=e}async submit(){const e=this.dialog;if(e){this.busy=!0,this.error="";try{if(e.kind==="site"){const s=await Da({name:this.formName.trim(),address:this.formAddress.trim()});this.dialog=null,await this.reload(),this.open({kind:"building",site:s})}else{const s=await ti(e.site.id,{name:this.formName.trim()});this.dialog=null,x(`/explore/buildings/${s.id}/floors`)}}catch(s){this.error=z(s)}finally{this.busy=!1}}}openSite(e){const s=e.buildings?.[0];s?x(`/explore/buildings/${s.id}/floors`):this.open({kind:"building",site:e})}renderSites(e){return n`<div class="grid">
      ${e.sites.map((s,a)=>{const i=s.buildings??[],t=i.reduce((r,o)=>r+(o.floors??[]).reduce((l,f)=>l+f.camera_count,0),0);return n`<sw-card flush interactive @click=${()=>this.openSite(s)}>
          <div class="pic"><sw-scene kind=${Xa[a%3]}></sw-scene>${e.source==="demo"?n`<span class="demo">דמו</span>`:n`<span class="demo">איור</span>`}</div>
          <div class="info">
            <div><b>${s.name}</b><small>${i.length} ${i.length===1?"מבנה":"מבנים"} · ${t} מצלמות${s.address?` · ${s.address}`:""}</small></div>
            <sw-button variant="ghost" size="sm" iconOnly icon="plus" label="מבנה חדש" @click=${r=>{r.stopPropagation(),this.open({kind:"building",site:s})}}></sw-button>
          </div>
        </sw-card>`})}
      ${e.canCreateSite?n`<button class="add" @click=${()=>this.open({kind:"site"})}><div><div class="ic"><sw-icon name="plus" size=${18}></sw-icon></div><strong>הוספת אתר חדש</strong><small>יצירת מיקום חדש כדי להתחיל</small></div></button>`:h}
    </div>`}renderBuildings(e){const s=e.sites.flatMap(a=>(a.buildings??[]).map(i=>({s:a,b:i})));return n`<div class="blist">
      ${s.map(({s:a,b:i},t)=>n`<sw-card class="brow" @click=${()=>x(`/explore/buildings/${i.id}/floors`)}>
          <sw-scene kind=${t%2?"house":"building"}></sw-scene>
          <div><b>${i.name}</b><small>${a.name} · ${(i.floors??[]).length} קומות · ${(i.floors??[]).reduce((r,o)=>r+o.camera_count,0)} מצלמות</small></div>
          <sw-icon name="chevron" size=${14}></sw-icon>
        </sw-card>`)}
      ${s.length?h:n`<div class="map" style="min-block-size:120px">אין מבנים עדיין.</div>`}
    </div>`}render(){const e=this.tree;if(!e)return n`<sw-page heading="אתרים ומבנים"><sw-state-panel state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const s=this.dialog;return n`
      <sw-page heading="אתרים ומבנים" subheading=${`ניהול המיקומים והמבנים שלך${e.source==="demo"?" · נתוני הדגמה":""}`}>
        ${e.canCreateSite?n`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button>`:h}
        <sw-tabs .items=${[{id:"all",label:"כל האתרים",count:e.sites.length},{id:"buildings",label:"מבנים",count:e.sites.reduce((a,i)=>a+(i.buildings?.length??0),0)},{id:"map",label:"מפה"}]} .active=${this.tab} @change=${a=>this.tab=a.detail.id}></sw-tabs>
        ${e.sites.length===0&&this.tab==="all"?n`<sw-state-panel state="empty" heading="עוד אין אתרים" hint="התחל ביצירת האתר הראשון; אחר כך מבנה, קומות ותוכניות.">${e.canCreateSite?n`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button></div>`:h}</sw-state-panel>`:this.tab==="all"?this.renderSites(e):this.tab==="buildings"?this.renderBuildings(e):n`<div class="map">מפת אתרים (לוח 3 · מסך 17) תצטרף עם שכבת מיקום גאוגרפי · Beta</div>`}
        ${s?n`<sw-dialog open heading=${s.kind==="site"?"אתר חדש":"מבנה חדש"} subheading=${s.kind==="building"?s.site.name:"שם, כתובת ואזור זמן ברירת מחדל Asia/Jerusalem"} @close=${()=>this.dialog=null}>
              <sw-field label="שם"><input .value=${this.formName} @input=${a=>this.formName=a.target.value} placeholder=${s.kind==="site"?"למשל: משרדי החברה":"למשל: מבנה א"} /></sw-field>
              ${s.kind==="site"?n`<sw-field label="כתובת (אופציונלי)"><input .value=${this.formAddress} @input=${a=>this.formAddress=a.target.value} /></sw-field>`:h}
              ${this.error?n`<div class="err">${this.error}</div>`:h}
              ${e.source==="demo"?n`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:h}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||e.source==="demo"} @click=${()=>this.submit()}>${s.kind==="site"?"צור אתר":"צור מבנה"}</sw-button>
            </sw-dialog>`:h}
      </sw-page>
    `}};B.styles=g`
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
  `;ae([p()],B.prototype,"tab",2);ae([p()],B.prototype,"tree",2);ae([p()],B.prototype,"dialog",2);ae([p()],B.prototype,"formName",2);ae([p()],B.prototype,"formAddress",2);ae([p()],B.prototype,"busy",2);ae([p()],B.prototype,"error",2);B=ae([b("explore-sites")],B);var Ja=Object.defineProperty,Za=Object.getOwnPropertyDescriptor,es=(e,s,a,i)=>{for(var t=i>1?void 0:i?Za(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Ja(s,a,t),t};let he=class extends w{constructor(){super(...arguments),this.rooms=[],this.selected=!1,this.empty=!1,this.width=132}iso(e,s){return{x:60+(e-s)*58,y:6+(e+s)*26}}poly(e){return e.map(s=>`${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(" ")}render(){this.style.setProperty("--w",`${this.width}px`);const e=[this.iso(0,0),this.iso(1,0),this.iso(1,1),this.iso(0,1)],s=7,a=[this.iso(1,0),this.iso(1,1),{x:this.iso(1,1).x,y:this.iso(1,1).y+s},{x:this.iso(1,0).x,y:this.iso(1,0).y+s}],i=[this.iso(0,1),this.iso(1,1),{x:this.iso(1,1).x,y:this.iso(1,1).y+s},{x:this.iso(0,1).x,y:this.iso(0,1).y+s}];return n`<svg viewBox="0 0 120 72" aria-hidden="true">
      ${d`<polygon class="side" points=${this.poly(a)} /><polygon class="side" points=${this.poly(i)} />`}
      ${d`<polygon class="top" points=${this.poly(e)} />`}
      ${this.empty?"":this.rooms.map(t=>d`<polygon class="room" points=${this.poly([this.iso(t.x,t.y),this.iso(t.x+t.w,t.y),this.iso(t.x+t.w,t.y+t.h),this.iso(t.x,t.y+t.h)])} />`)}
    </svg>`}};he.styles=g`
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
  `;es([c({attribute:!1})],he.prototype,"rooms",2);es([c({type:Boolean,reflect:!0})],he.prototype,"selected",2);es([c({type:Boolean,reflect:!0})],he.prototype,"empty",2);es([c({type:Number})],he.prototype,"width",2);he=es([b("sw-floor-iso")],he);var Qa=Object.defineProperty,er=Object.getOwnPropertyDescriptor,W=(e,s,a,i)=>{for(var t=i>1?void 0:i?er(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Qa(s,a,t),t};let T=class extends w{constructor(){super(...arguments),this.buildingId="bld-a",this.tree=null,this.selected=null,this.tab="floors",this.dialog=null,this.busy=!1,this.error="",this.formName="",this.formLevel=0}connectedCallback(){super.connectedCallback(),this.reload()}updated(e){e.has("buildingId")&&e.get("buildingId")!==void 0&&(this.selected=null)}async reload(){try{this.tree=await Ps(),this.error=""}catch(e){this.error=z(e)}}get context(){if(!this.tree)return null;for(const a of this.tree.sites)for(const i of a.buildings??[])if(i.id===this.buildingId)return{site:a,building:i};const e=this.tree.sites[0],s=e?.buildings?.[0];return e&&s?{site:e,building:s}:null}async run(e){this.busy=!0,this.error="";try{await e(),this.dialog=null,await this.reload()}catch(s){s instanceof _e&&s.code==="has_anchors"&&this.dialog?.kind==="delete"?(this.dialog={...this.dialog,force:!0},this.error=`${s.body.user_message} (${s.body.details.anchors??""} פריטים)`):this.error=z(s)}finally{this.busy=!1}}openDialog(e){this.error="",this.formName=e?.kind==="rename"?e.floor.name:"",this.formLevel=e?.kind==="rename"?e.floor.level:0,this.dialog=e}renderDialog(e){const s=this.dialog;if(!s)return h;const a=this.tree?.source==="demo",i=n`<sw-field label="שם"><input .value=${this.formName} @input=${l=>this.formName=l.target.value} placeholder="למשל: קומה 1" autofocus /></sw-field>`,t=n`<sw-field label="מפלס (0 = קרקע, שלילי = מרתף)" hint="קובע את סדר התצוגה בין הקומות"><input type="number" data-ltr .value=${String(this.formLevel)} @input=${l=>this.formLevel=Number(l.target.value)} /></sw-field>`,r=this.error?n`<div class="err">${this.error}</div>`:h,o=a?n`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:h;switch(s.kind){case"floor":return n`<sw-dialog open heading="קומה חדשה" subheading=${`${e.name}`} @close=${()=>this.dialog=null}>
          ${i}${t}${r}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||a} @click=${()=>this.run(async()=>{const l=await Na(e.id,{name:this.formName.trim(),level:this.formLevel});this.selected=l.id})}>הוסף קומה</sw-button>
        </sw-dialog>`;case"rename":return n`<sw-dialog open heading="עריכת קומה" subheading=${s.floor.name} @close=${()=>this.dialog=null}>
          ${i}${t}${r}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||a} @click=${()=>this.run(()=>ja(s.floor.id,{name:this.formName.trim(),level:this.formLevel}))}>שמירה</sw-button>
        </sw-dialog>`;case"delete":return n`<sw-dialog open heading="מחיקת קומה" subheading=${s.floor.name} @close=${()=>this.dialog=null}>
          <div style="font-size:var(--sw-fs-sm)">${s.force?"על הקומה מוצבים פריטים. מחיקה תסיר אותם מהמפה (ההיסטוריה נשמרת באודיט). להמשיך?":"הקומה תוסר מהמערכת. תוכניות שפורסמו נשמרות בארכיון; מצלמות והקלטות ב־NVR אינן נמחקות."}</div>
          ${r}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="danger" ?disabled=${this.busy||a} @click=${()=>this.run(async()=>{await Ta(s.floor.id,s.force),this.selected===s.floor.id&&(this.selected=null)})}>${s.force?"מחק כולל הפריטים":"מחק קומה"}</sw-button>
        </sw-dialog>`;case"building":return n`<sw-dialog open heading="מבנה חדש" subheading=${this.context?.site.name??""} @close=${()=>this.dialog=null}>
          ${i}${r}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||a} @click=${()=>this.run(async()=>{const l=await ti(this.context.site.id,{name:this.formName.trim()});x(`/explore/buildings/${l.id}/floors`)})}>הוסף מבנה</sw-button>
        </sw-dialog>`}}render(){if(!this.tree)return n`<sw-page heading="קומות"><sw-state-panel state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const e=this.context;if(!e)return n`<sw-page heading="קומות" subheading="אין עדיין אתרים ומבנים">
        <sw-state-panel state="empty" heading="עוד אין מבנים" hint="צור אתר ומבנה כדי להוסיף קומות ותוכניות.">
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>x("/explore/sites")}>לאתרים</sw-button></div>
        </sw-state-panel>
      </sw-page>`;const{site:s,building:a}=e,i=a.floors??[],t=i.find(l=>l.id===this.selected)??i[0]??null,r=i.reduce((l,f)=>l+f.camera_count,0),o=this.tree;return n`
      <sw-page heading=${a.name} subheading=${`${s.address||s.name} · ${i.length} קומות${o.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${s.name} | ${a.name}`}>
        <div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>
        <sw-tabs .items=${[{id:"floors",label:"קומות",count:i.length},{id:"cameras",label:"מצלמות",count:r},{id:"details",label:"פרטים"}]} .active=${this.tab} @change=${l=>this.tab=l.detail.id}></sw-tabs>
        ${this.tab==="floors"?n`<div class="list">
              ${i.length?h:n`<div class="empty">למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה).</div>`}
              ${i.map(l=>n`<button class="floor ${t?.id===l.id?"on":""}" @click=${()=>t?.id===l.id?x(`/explore/floors/${l.id}`):this.selected=l.id} aria-pressed=${t?.id===l.id}>
                  <div class="txt">
                    <div class="title">${l.name}</div>
                    <div class="counts">${l.camera_count} מצלמות · ${l.anchor_count} פריטים במפה · מפלס ${l.level}${l.has_plan?"":" · אין תוכנית עדיין"}${l.draft_version_id?" · טיוטה ממתינה לפרסום":""}</div>
                  </div>
                  <sw-floor-iso .rooms=${o.source==="demo"?Ts(l.id):[]} ?selected=${t?.id===l.id} ?empty=${!l.has_plan} width=${128}></sw-floor-iso>
                  <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
                </button>`)}
              ${this.error&&!this.dialog?n`<div class="err">${this.error}</div>`:h}
              <div class="actions">
                <div>
                  <sw-button icon="plus" @click=${()=>this.openDialog({kind:"floor"})}>קומה חדשה</sw-button>
                  <sw-button variant="ghost" icon="building" @click=${()=>this.openDialog({kind:"building"})}>מבנה חדש</sw-button>
                </div>
                ${t?n`<div>
                      <sw-button variant="ghost" icon="edit" @click=${()=>this.openDialog({kind:"rename",floor:t})}>עריכה</sw-button>
                      <sw-button variant="ghost" icon="trash" @click=${()=>this.openDialog({kind:"delete",floor:t,force:!1})}>מחיקה</sw-button>
                      <sw-button icon="upload" @click=${()=>x(`/explore/floors/${t.id}/import`)}>${t.has_plan?"תוכנית חדשה":"העלאת תוכנית"}</sw-button>
                      <sw-button variant="primary" icon="map" @click=${()=>x(`/explore/floors/${t.id}`)}>פתח את ${t.name}</sw-button>
                    </div>`:h}
              </div>
            </div>`:this.tab==="cameras"?n`<div class="cams">${i.map(l=>n`<sw-card heading=${l.name} subheading="${l.camera_count} מצלמות" interactive @click=${()=>x(`/explore/floors/${l.id}`)}></sw-card>`)}</div>`:n`<sw-card heading="פרטי המבנה">
                <dl>
                  <dt>אתר</dt><dd>${s.name}</dd>
                  <dt>כתובת</dt><dd>${s.address||"—"}</dd>
                  <dt>אזור זמן</dt><dd><span class="ltr">${s.timezone}</span></dd>
                  <dt>קומות</dt><dd>${i.length} · ${i.filter(l=>l.has_plan).length} עם תוכנית מפורסמת</dd>
                  <dt>קשרים בין קומות</dt><dd>מדרגות ומעלית יוגדרו בעורך (Beta)</dd>
                </dl>
              </sw-card>`}
        ${this.renderDialog(a)}
      </sw-page>
    `}};T.styles=g`
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
  `;W([c()],T.prototype,"buildingId",2);W([p()],T.prototype,"tree",2);W([p()],T.prototype,"selected",2);W([p()],T.prototype,"tab",2);W([p()],T.prototype,"dialog",2);W([p()],T.prototype,"busy",2);W([p()],T.prototype,"error",2);W([p()],T.prototype,"formName",2);W([p()],T.prototype,"formLevel",2);T=W([b("explore-floors")],T);var sr=Object.defineProperty,tr=Object.getOwnPropertyDescriptor,lt=(e,s,a,i)=>{for(var t=i>1?void 0:i?tr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&sr(s,a,t),t};let Ve=class extends w{constructor(){super(...arguments),this.steps=[],this.current=0}render(){return n`${this.steps.map((e,s)=>n`
        <div class="step ${s<this.current?"done":s===this.current?"current":""}">
          <span class="n">${s<this.current?n`<sw-icon name="check" size=${13}></sw-icon>`:s+1}</span><span>${e}</span>
        </div>
        ${s<this.steps.length-1?n`<div class="line ${s<this.current?"done":""}"></div>`:""}
      `)}`}};Ve.styles=g`
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
  `;lt([c({attribute:!1})],Ve.prototype,"steps",2);lt([c({type:Number})],Ve.prototype,"current",2);Ve=lt([b("sw-steps")],Ve);var ir=Object.defineProperty,ar=Object.getOwnPropertyDescriptor,I=(e,s,a,i)=>{for(var t=i>1?void 0:i?ar(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&ir(s,a,t),t};const Is=["קובץ","עמוד","חיתוך וסיבוב","שם והערות","שמירה ופרסום"];let S=class extends w{constructor(){super(...arguments),this.floorId="",this.step=0,this.tree=null,this.assets=[],this.asset=null,this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.notes="",this.version=null,this.busy=!1,this.error="",this.dragOver=!1}connectedCallback(){super.connectedCallback(),this.init()}async init(){try{this.tree=await Ps(),Le()&&this.floorId&&(this.assets=(await ka(this.floorId)).assets)}catch(e){this.error=z(e)}}get floor(){return this.tree&&this.floorId?Ha(this.tree,this.floorId):null}async onFile(e){if(!(!e||!this.floorId)){this.busy=!0,this.error="";try{this.asset=await za(this.floorId,e),this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.version=null,this.step=this.asset.page_count>1?1:2,this.assets=[this.asset,...this.assets.filter(s=>s.id!==this.asset.id)]}catch(s){this.error=z(s)}finally{this.busy=!1}}}async save(){if(!(!this.asset||!this.floorId)){this.busy=!0,this.error="";try{const e=this.crop.x===0&&this.crop.y===0&&this.crop.w===1&&this.crop.h===1;this.version=await _a(this.floorId,{asset_id:this.asset.id,page:this.page,rotation:this.rotation,crop:e?null:this.crop,notes:this.notes})}catch(e){this.error=z(e)}finally{this.busy=!1}}}async publish(){if(this.version){this.busy=!0,this.error="";try{this.version=await si(this.version.id)}catch(e){this.error=z(e)}finally{this.busy=!1}}}setCrop(e,s){const a=Math.max(0,Math.min(100,s))/100,i={...this.crop,[e]:a};i.x+i.w>1&&(i.w=1-i.x),i.y+i.h>1&&(i.h=1-i.y),i.w<=.02&&(i.w=.02),i.h<=.02&&(i.h=.02),this.crop=i}previewUrl(){const e=this.asset?.pages.find(s=>s.page===this.page)??this.asset?.pages[0];return e?os(e.preview_url):""}renderStep(){const e=this.asset;switch(this.step){case 0:return n`
          <label class="drop ${this.dragOver?"over":""}" @dragover=${s=>{s.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1} @drop=${s=>{s.preventDefault(),this.dragOver=!1,this.onFile(s.dataTransfer?.files[0])}}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" @change=${s=>void this.onFile(s.target.files?.[0])} />
            <div>
              <div class="ic"><sw-icon name="upload" size=${20}></sw-icon></div>
              <strong>${this.busy?"מעלה…":"גרור לכאן PDF או תמונה של התוכנית, או לחץ לבחירה"}</strong>
              <small>PDF עד 20 עמודים, PNG / JPG · עד 40 MB · הזיהוי לפי תוכן הקובץ · המקור נשמר ללא שינוי</small>
            </div>
          </label>
          ${this.assets.length?n`<div class="assets"><div class="note" style="margin-block-end:4px">קבצים שכבר הועלו לקומה זו:</div>${this.assets.map(s=>n`<button @click=${()=>{this.asset=s,this.page=1,this.step=s.page_count>1?1:2}}><span>${s.original_name}</span><span class="ltr">${s.page_count} עמ׳ · ${(s.bytes/1024/1024).toFixed(1)} MB</span></button>`)}</div>`:h}`;case 1:return n`<div class="note">בחר את העמוד שמכיל את התוכנית של הקומה.</div>
          <div class="pages">${e?.pages.map(s=>n`<button class="pg ${s.page===this.page?"on":""}" @click=${()=>this.page=s.page}><img src=${os(s.preview_url)} alt=${`עמוד ${s.page}`} loading="lazy" />עמוד ${s.page}</button>`)}</div>`;case 2:{const s=this.rotation,a=this.crop,i=s%180===0?a:{x:a.x,y:a.y,w:a.w,h:a.h};return n`
          <div class="preview">
            <img src=${this.previewUrl()} alt="תצוגה מקדימה" style="transform: rotate(${s}deg)" />
            <div class="cropbox" style="left:${i.x*100}%;top:${i.y*100}%;width:${i.w*100}%;height:${i.h*100}%"></div>
          </div>
          <div class="row">
            <sw-button size="sm" icon="refresh" @click=${()=>this.rotation=(this.rotation+90)%360}>סובב 90°</sw-button>
            <sw-badge kind="neutral" label=${`סיבוב ${this.rotation}°`}></sw-badge>
            <sw-button size="sm" variant="ghost" icon="fit" @click=${()=>this.crop={x:0,y:0,w:1,h:1}}>אפס חיתוך</sw-button>
            <span class="note">החיתוך באחוזים מהתמונה (אחרי סיבוב): שמאל, עליון, רוחב, גובה.</span>
          </div>
          <div class="two">
            <sw-field label="שמאל %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(a.x*100))} @change=${t=>this.setCrop("x",Number(t.target.value))} /></sw-field>
            <sw-field label="עליון %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(a.y*100))} @change=${t=>this.setCrop("y",Number(t.target.value))} /></sw-field>
            <sw-field label="רוחב %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(a.w*100))} @change=${t=>this.setCrop("w",Number(t.target.value))} /></sw-field>
            <sw-field label="גובה %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(a.h*100))} @change=${t=>this.setCrop("h",Number(t.target.value))} /></sw-field>
          </div>`}case 3:return n`
          <sw-field label="קומה"><input .value=${this.floor?.floor.name??""} disabled /></sw-field>
          <sw-field label="הערות לגרסה (אופציונלי)" hint="למשל: תוכנית מעודכנת אחרי שיפוץ 2026"><input .value=${this.notes} @input=${s=>this.notes=s.target.value} /></sw-field>
          <div class="note">קנה מידה (מטרים לפיקסל) יכויל בעורך בשתי נקודות ומרחק ידוע; עד אז מרחקים מוצגים כמשוערים.</div>`;default:return n`
          ${this.version?n`<div class="ok">✓ הגרסה נשמרה (${this.version.width_px}×${this.version.height_px} px) · ${this.version.status==="published"?"פורסמה — היא הרקע של הקומה":"טיוטה — עורכי הקומה רואים אותה, צופים עדיין לא"}</div>
                <div class="preview" style="min-block-size:220px"><img src=${os(this.version.image_url)} alt="רקע התוכנית" /></div>`:n`<div class="note">סיכום: ${e?.original_name} · עמוד ${this.page} · סיבוב ${this.rotation}° · חיתוך ${Math.round(this.crop.w*100)}%×${Math.round(this.crop.h*100)}%. השמירה מייצרת רקע נגזר; המקור לא משתנה.</div>`}
          <div class="row">
            ${this.version?h:n`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.save()}>שמור כטיוטה</sw-button>`}
            ${this.version&&this.version.status==="draft"?n`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.publish()}>פרסום</sw-button>`:h}
            ${this.version?n`<sw-button icon="map" @click=${()=>x(`/explore/floors/${this.floorId}`)}>פתח במפה</sw-button><sw-button variant="ghost" icon="edit" @click=${()=>x(`/explore/floors/${this.floorId}/edit`)}>הצב מצלמות</sw-button>`:h}
          </div>`}}renderDemo(){return n`<sw-card><sw-state-panel state="empty" heading="ייבוא תוכנית עובד מול השרת" hint="בתצוגת ההדגמה אין שרת מחובר. בהתקנה ב־Home Assistant המסך מעלה PDF/PNG, בוחר עמוד, מסובב וחותך, ומפרסם גרסה."></sw-state-panel></sw-card>`}render(){const e=this.floor,s=this.step===0?!!this.asset:this.step===1?!!this.asset:!0;return n`
      <sw-page heading=${e?`ייבוא תוכנית ל${e.floor.name}`:"ייבוא תוכנית"} subheading="המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת" crumbs=${e?`אתרים | ${e.site.name} | ${e.building.name} | ${e.floor.name}`:"אתרים"}>
        ${Le()?!this.floorId||this.tree&&!e?n`<sw-state-panel state="empty" heading="בחר קומה" hint="ייבוא תוכנית מתחיל מדף הקומות."><div style="margin-block-start:10px"><sw-button variant="primary" @click=${()=>x("/explore/sites")}>לאתרים</sw-button></div></sw-state-panel>`:n`
                <sw-card><sw-steps .steps=${Is} .current=${this.step}></sw-steps></sw-card>
                <div class="layout">
                  <div class="stage">${this.renderStep()}${this.error?n`<div class="err">${this.error}</div>`:h}</div>
                  <div class="side">
                    <sw-card heading="קובץ">
                      ${this.asset?n`<div class="note">${this.asset.original_name}</div><div class="row" style="margin-block-start:6px"><sw-badge kind="neutral" label=${`${this.asset.mime.split("/")[1].toUpperCase()} · ${(this.asset.bytes/1024/1024).toFixed(1)} MB · ${this.asset.page_count} עמ׳`}></sw-badge></div><div class="note ltr" style="margin-block-start:6px">sha256 ${this.asset.sha256.slice(0,16)}…</div>`:n`<div class="note">עדיין לא נבחר קובץ.</div>`}
                    </sw-card>
                    <sw-card heading="בטיחות">
                      <div class="note">הקובץ מזוהה לפי תוכנו; PDF מרונדר בתהליך נפרד עם מגבלת זמן; SVG נדחה עד sanitization. תוכן טקסטואלי בתוך הקובץ הוא נתון בלבד.</div>
                    </sw-card>
                    <div class="foot">
                      <sw-button variant="ghost" icon="chevron" ?disabled=${this.step===0||this.busy} @click=${()=>this.step=Math.max(0,this.step-1)}>הקודם</sw-button>
                      ${this.step<Is.length-1?n`<sw-button variant="primary" ?disabled=${!s||this.busy} @click=${()=>this.step=Math.min(Is.length-1,this.step+1)}>הבא</sw-button>`:h}
                    </div>
                  </div>
                </div>`:this.renderDemo()}
      </sw-page>
    `}};S.styles=g`
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
    .preview img {
      max-inline-size: 100%;
      max-block-size: 420px;
      transition: transform var(--sw-t-med) var(--sw-ease);
    }
    .preview .cropbox {
      position: absolute;
      border: 2px dashed var(--sw-accent);
      box-shadow: 0 0 0 9999px rgba(17, 24, 39, 0.28);
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
  `;I([c()],S.prototype,"floorId",2);I([p()],S.prototype,"step",2);I([p()],S.prototype,"tree",2);I([p()],S.prototype,"assets",2);I([p()],S.prototype,"asset",2);I([p()],S.prototype,"page",2);I([p()],S.prototype,"rotation",2);I([p()],S.prototype,"crop",2);I([p()],S.prototype,"notes",2);I([p()],S.prototype,"version",2);I([p()],S.prototype,"busy",2);I([p()],S.prototype,"error",2);I([p()],S.prototype,"dragOver",2);S=I([b("explore-plan-import")],S);var rr=Object.defineProperty,nr=Object.getOwnPropertyDescriptor,H=(e,s,a,i)=>{for(var t=i>1?void 0:i?nr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&rr(s,a,t),t};const or=[{id:"select",icon:"target",label:"בחירה",ready:!0},{id:"camera",icon:"camera",label:"הוספת מצלמה",ready:!0},{id:"entity",icon:"light",label:"הוספת ישות",ready:!1},{id:"area",icon:"map",label:"ציור אזור",ready:!1},{id:"label",icon:"list",label:"תווית",ready:!1},{id:"scale",icon:"fit",label:"קנה מידה",ready:!1}];let E=class extends w{constructor(){super(...arguments),this.floorId="",this.bundle=null,this.anchors=[],this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId=null,this.tool="select",this.busy=!1,this.error="",this.info=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{const e=await ei(this.floorId||"f0",!0);this.bundle=e,this.anchors=e.anchors.map(s=>({...s,position:{...s.position}})),this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId&&!this.anchors.some(s=>s.id===this.selectedId)&&(this.selectedId=null)}catch(e){this.error=z(e)}}get markers(){return this.anchors.map(e=>({id:e.id,kind:e.resource_type==="camera"?"camera":e.layer_id==="doors"?"lock":e.layer_id==="lights"?"light":"binary_sensor",label:e.camera?.name??e.label??e.resource_id,x:e.position.x,y:e.position.y,rotation:e.rotation_degrees,fov:e.field_of_view_degrees??void 0,state:e.resource_type==="camera"?this.bundle?.source==="demo"?"live":Ws(e):"neutral"}))}snapshot(){this.undo=[...this.undo.slice(-30),this.anchors.map(e=>({...e,position:{...e.position}}))],this.redo=[]}apply(e,s){this.snapshot(),this.anchors=this.anchors.map(a=>a.id===e?{...a,...s,position:s.position??a.position}:a),this.dirty=new Set(this.dirty).add(e)}doUndo(){const e=this.undo[this.undo.length-1];e&&(this.redo=[...this.redo,this.anchors],this.undo=this.undo.slice(0,-1),this.anchors=e,this.dirty=new Set(this.anchors.map(s=>s.id)))}doRedo(){const e=this.redo[this.redo.length-1];e&&(this.undo=[...this.undo,this.anchors],this.redo=this.redo.slice(0,-1),this.anchors=e,this.dirty=new Set(this.anchors.map(s=>s.id)))}async save(){if(!this.bundle||this.bundle.source==="demo")return this.info="נתוני הדגמה: השינויים נשמרים רק במסך זה.",this.dirty=new Set,!0;this.busy=!0,this.error="";let e=!1;try{for(const s of this.dirty){const a=this.anchors.find(i=>i.id===s);if(a)try{const i=await Ma(s,{revision:a.revision,x:a.position.x,y:a.position.y,rotation_degrees:a.rotation_degrees,field_of_view_degrees:a.field_of_view_degrees,label:a.label});this.anchors=this.anchors.map(t=>t.id===s?{...t,revision:i.revision}:t)}catch(i){if(i instanceof _e&&i.code==="stale_revision")e=!0;else throw i}}return e?(this.error="חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.",await this.load(),!1):(this.dirty=new Set,this.info="נשמר",setTimeout(()=>this.info="",2e3),!0)}catch(s){return this.error=z(s),!1}finally{this.busy=!1}}async addCamera(e){if(this.bundle){if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הוספה עובדת מול השרת.";return}if(!(this.dirty.size&&!await this.save())){this.busy=!0,this.error="";try{const s=await Pa(this.bundle.floorId,{resource_type:"camera",resource_id:e.id,x:.5,y:.5,rotation_degrees:0,field_of_view_degrees:70});await this.load(),this.selectedId=s.id,this.tool="select"}catch(s){this.error=z(s)}finally{this.busy=!1}}}}async removeSelected(){const e=this.anchors.find(s=>s.id===this.selectedId);if(!(!e||!this.bundle)){if(this.bundle.source==="demo"){this.snapshot(),this.anchors=this.anchors.filter(s=>s.id!==e.id),this.selectedId=null;return}if(window.confirm(`להסיר את "${e.camera?.name??e.resource_id}" מהמפה? (המצלמה עצמה נשארת רשומה)`)){this.busy=!0;try{await Sa(e.id),this.selectedId=null,await this.load()}catch(s){this.error=z(s)}finally{this.busy=!1}}}}async publish(){if(!(!this.bundle?.planVersionId||this.bundle.source==="demo")&&!(this.dirty.size&&!await this.save())){this.busy=!0;try{await si(this.bundle.planVersionId),await this.load(),this.info="התוכנית פורסמה"}catch(e){this.error=z(e)}finally{this.busy=!1}}}render(){const e=this.bundle;if(this.error&&!e)return n`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!e)return n`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const s=this.anchors.find(r=>r.id===this.selectedId),a=new Set(this.anchors.map(r=>r.resource_id)),i=e.cameras.filter(r=>!a.has(r.id)),t=this.dirty.size;return n`
      <sw-page heading="עורך תוכנית קומה" subheading=${`${e.buildingName} · ${e.floorName} · ${e.planStatus==="draft"?"טיוטה":e.planStatus==="published"?"תוכנית מפורסמת":"אין תוכנית"}${e.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${e.siteName} | ${e.buildingName} | ${e.floorName}`} wide>
        <sw-button slot="actions" variant="ghost" iconOnly icon="history" label="בטל" ?disabled=${!this.undo.length} @click=${()=>this.doUndo()}></sw-button>
        <sw-button slot="actions" variant="ghost" iconOnly icon="refresh" label="בצע שוב" ?disabled=${!this.redo.length} @click=${()=>this.doRedo()}></sw-button>
        <sw-button slot="actions" ?disabled=${!t||this.busy} @click=${()=>this.save()}>${t?`שמירה (${t})`:"שמור"}</sw-button>
        ${e.planStatus==="draft"&&e.permissions.publish?n`<sw-button slot="actions" variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.publish()}>פרסום</sw-button>`:n`<sw-button slot="actions" variant="primary" icon="map" @click=${()=>x(`/explore/floors/${e.floorId}`)}>למפה</sw-button>`}
        ${e.planStatus==="none"?n`<sw-state-panel state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${()=>x(`/explore/floors/${e.floorId}/import`)}>העלאת תוכנית</sw-button></div></sw-state-panel>`:n`<div class="layout">
              <div class="tools">${or.map(r=>n`<button class=${r.id===this.tool?"on":""} ?disabled=${!r.ready} title=${r.ready?r.label:`${r.label} · בקרוב`} @click=${()=>this.tool=r.id}><sw-icon .name=${r.icon} size=${18}></sw-icon>${r.label}</button>`)}</div>
              <div class="canvaswrap">
                <div class="bar">
                  <span class="autosave ${t?"dirty":""}"><i></i>${t?`${t} שינויים לא שמורים`:"הכל שמור"}</span>
                  ${this.info?n`<span style="color:#15803d">${this.info}</span>`:h}
                  ${this.error?n`<span class="err">${this.error}</span>`:h}
                  <span class="grow"></span>
                  ${e.needsAlignment?n`<sw-badge kind="partial" label="פריטים מגרסת תוכנית קודמת — בדוק מיקומים"></sw-badge>`:h}
                  <sw-badge kind="unknown" label="קנה מידה: לא מכויל"></sw-badge>
                  <span>גרור סיכה כדי להזיז · לחיצה בוחרת</span>
                </div>
                <div class="canvas">
                  <sw-plan-canvas editable alwaysLabel .planWidth=${e.width} .planHeight=${e.height} .plan=${e.planSvg} .imageUrl=${e.imageUrl} .markers=${this.markers} .selectedId=${this.selectedId}
                    @marker-select=${r=>this.selectedId=r.detail.id}
                    @marker-move=${r=>{this.apply(r.detail.id,{position:{x:+r.detail.x.toFixed(4),y:+r.detail.y.toFixed(4)}}),this.selectedId=r.detail.id}}></sw-plan-canvas>
                </div>
              </div>
              <div class="props">
                ${this.tool==="camera"?n`<sw-card heading="הוספת מצלמה" subheading="מצלמות רשומות שעדיין לא הוצבו על הקומה">
                      ${i.length?n`<div class="camlist">${i.map(r=>n`<button @click=${()=>this.addCamera(r)}><span>${r.name}</span><span class="ltr">ch ${r.channel} · ${r.status}</span></button>`)}</div>`:n`<div class="note">${e.cameras.length?"כל המצלמות הרשומות כבר מוצבות על הקומה.":'אין מצלמות רשומות. סנכרן מה־NVR במסך "בריאות מצלמות" או רשום ידנית.'}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${()=>x("/system/devices")}>למצלמות</sw-button></div>`}
                    </sw-card>`:h}
                <sw-card heading=${s?s.camera?.name??s.label??s.resource_id:"מאפיינים"}>
                  ${s?n`
                        <div class="two">
                          <sw-field label="X (0–1)"><input type="number" step="0.001" min="0" max="1" data-ltr .value=${s.position.x.toFixed(3)} @change=${r=>this.apply(s.id,{position:{x:Math.min(1,Math.max(0,Number(r.target.value))),y:s.position.y}})} /></sw-field>
                          <sw-field label="Y (0–1)"><input type="number" step="0.001" min="0" max="1" data-ltr .value=${s.position.y.toFixed(3)} @change=${r=>this.apply(s.id,{position:{x:s.position.x,y:Math.min(1,Math.max(0,Number(r.target.value)))}})} /></sw-field>
                          <sw-field label="כיוון (°)"><input type="number" step="5" min="0" max="359" data-ltr .value=${String(Math.round(s.rotation_degrees))} @change=${r=>this.apply(s.id,{rotation_degrees:(Number(r.target.value)%360+360)%360})} /></sw-field>
                          <sw-field label="זווית ראייה (°)"><input type="number" step="5" min="10" max="180" data-ltr .value=${String(Math.round(s.field_of_view_degrees??70))} @change=${r=>this.apply(s.id,{field_of_view_degrees:Math.min(360,Math.max(1,Number(r.target.value)))})} /></sw-field>
                        </div>
                        <sw-field label="תווית (אופציונלי)"><input .value=${s.label??""} @change=${r=>this.apply(s.id,{label:r.target.value||null})} /></sw-field>
                        <div class="note">revision ${s.revision} · ${s.resource_type==="camera"?`ערוץ ${s.camera?.channel??"?"}`:s.resource_id}</div>
                        <div style="display:flex;gap:8px;margin-block-start:6px"><sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>הסר מהמפה</sw-button></div>`:n`<div class="note">בחר סיכה במפה, או הוסף מצלמה מסרגל הכלים. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.</div>`}
                </sw-card>
                <sw-card heading="גרסת תוכנית">
                  <div class="note">${e.planStatus==="draft"?"טיוטה: צופים עדיין רואים את הגרסה הקודמת (אם קיימת). פרסום יוצר PlanVersion מאושרת ונרשם באודיט.":'גרסה מפורסמת. תוכנית חדשה מועלית דרך "ייבוא תוכנית"; העוגנים נשמרים ומסומנים לבדיקה אם הגאומטריה השתנתה.'}</div>
                  <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${()=>x(`/explore/floors/${e.floorId}/import`)}>ייבוא תוכנית</sw-button></div>
                </sw-card>
              </div>
            </div>`}
      </sw-page>
    `}};E.styles=g`
    .layout {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 290px;
      gap: 12px;
      min-block-size: 560px;
      flex: 1;
    }
    .tools {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 6px;
      box-shadow: var(--sw-shadow-1);
      align-self: start;
    }
    .tools button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 2px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: 9.5px;
      cursor: pointer;
    }
    .tools button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .tools button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .canvaswrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
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
    .canvas {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      position: relative;
      min-block-size: 480px;
      flex: 1;
      box-shadow: var(--sw-shadow-1);
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 10px;
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
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .camlist {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 220px;
      overflow: auto;
    }
    .camlist button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
    }
    .camlist button:hover {
      background: var(--sw-accent-soft);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 56px minmax(0, 1fr);
      }
      .props {
        grid-column: 1 / -1;
      }
    }
  `;H([c()],E.prototype,"floorId",2);H([p()],E.prototype,"bundle",2);H([p()],E.prototype,"anchors",2);H([p()],E.prototype,"dirty",2);H([p()],E.prototype,"undo",2);H([p()],E.prototype,"redo",2);H([p()],E.prototype,"selectedId",2);H([p()],E.prototype,"tool",2);H([p()],E.prototype,"busy",2);H([p()],E.prototype,"error",2);H([p()],E.prototype,"info",2);E=H([b("explore-plan-editor")],E);var lr=Object.defineProperty,dr=Object.getOwnPropertyDescriptor,we=(e,s,a,i)=>{for(var t=i>1?void 0:i?dr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&lr(s,a,t),t};let K=class extends w{constructor(){super(...arguments),this.columns=[],this.rows=[],this.rowKey="id",this.selected=null,this.emptyText="אין שורות להצגה",this.dense=!1}pick(e){const s=String(e[this.rowKey]??"");this.dispatchEvent(new CustomEvent("row-select",{detail:{id:s,row:e},bubbles:!0,composed:!0}))}render(){return this.rows.length?n`
      <table>
        <thead>
          <tr>${this.columns.map(e=>n`<th style=${e.width?`width:${e.width}`:""}>${e.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(e=>n`<tr class="clickable ${this.selected===String(e[this.rowKey])?"selected":""}" @click=${()=>this.pick(e)}>
              ${this.columns.map(s=>n`<td class=${s.ltr?"ltr":""}>${s.render?s.render(e):String(e[s.key]??"")}</td>`)}
            </tr>`)}
        </tbody>
      </table>
    `:n`<div class="empty">${this.emptyText}</div>`}};K.styles=g`
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
  `;we([c({attribute:!1})],K.prototype,"columns",2);we([c({attribute:!1})],K.prototype,"rows",2);we([c()],K.prototype,"rowKey",2);we([c()],K.prototype,"selected",2);we([c()],K.prototype,"emptyText",2);we([c({type:Boolean,reflect:!0})],K.prototype,"dense",2);K=we([b("sw-table")],K);var cr=Object.defineProperty,pr=Object.getOwnPropertyDescriptor,dt=(e,s,a,i)=>{for(var t=i>1?void 0:i?pr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&cr(s,a,t),t};const rs=[{id:"lock.main_door",name:"דלת כניסה",domain:"lock",area:"לובי",state:"נעול",fresh:"live",placed:!0,actions:"נעילה / פתיחה (grant נפרד)"},{id:"light.lobby",name:"תאורת לובי",domain:"light",area:"לובי",state:"דולק · 80%",fresh:"live",placed:!0,actions:"הדלקה / כיבוי / עמעום"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",domain:"binary_sensor",area:"אולם",state:"ללא תנועה",fresh:"live",placed:!0,actions:"קריאה בלבד"},{id:"climate.hall",name:"מזגן אולם",domain:"climate",area:"אולם",state:"קירור · 23°",fresh:"stale",placed:!1,actions:"יעד טמפרטורה (allowlist)"},{id:"cover.parking_gate",name:"שער חניה",domain:"cover",area:"חניה",state:"סגור",fresh:"live",placed:!1,actions:"פתיחה / סגירה (רגיש)"},{id:"script.night_mode",name:"מצב לילה",domain:"script",area:"—",state:"—",fresh:"unknown",placed:!1,actions:"חסום עד allowlist"},{id:"sensor.power_main",name:"צריכת חשמל",domain:"sensor",area:"חדר מכונות",state:"4.2 kW",fresh:"live",placed:!1,actions:"קריאה בלבד"},{id:"camera.intercom_m2",name:"אינטרקום M2",domain:"camera",area:"כניסה",state:"זמין",fresh:"live",placed:!1,actions:"צפייה (provider נפרד)"}];let Be=class extends w{constructor(){super(...arguments),this.selected=null,this.domain="all",this.columns=[{key:"name",label:"ישות",render:e=>n`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:7px;background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${e.domain==="lock"||e.domain==="cover"?"lock":e.domain==="light"?"light":e.domain==="camera"?"camera":e.domain==="climate"?"activity":"sensor"} size=${13}></sw-icon></span><span><strong>${String(e.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(e.id)}</div></span></span>`},{key:"domain",label:"Domain",ltr:!0},{key:"area",label:"אזור HA"},{key:"state",label:"מצב"},{key:"fresh",label:"רעננות",render:e=>n`<sw-badge kind=${e.fresh} label=${e.fresh==="live"?"עדכני":e.fresh==="stale"?"מיושן":"לא ידוע"}></sw-badge>`},{key:"placed",label:"במפה",render:e=>e.placed?n`<sw-badge kind="recorded" label="מוצב"></sw-badge>`:n`<span style="color:var(--sw-text-3)">לא</span>`}]}render(){const e=["all",...new Set(rs.map(i=>i.domain))],s=rs.filter(i=>this.domain==="all"||i.domain===this.domain),a=rs.find(i=>i.id===this.selected);return n`
      <sw-page heading="קטלוג ישויות Home Assistant" subheading="${rs.length} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" /></sw-field>
          ${e.map(i=>n`<sw-chip ?selected=${i===this.domain} @click=${()=>this.domain=i}>${i==="all"?"הכל":i}</sw-chip>`)}
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${s} .selected=${this.selected} @row-select=${i=>this.selected=i.detail.id}></sw-table>
          ${a?n`<sw-drawer open heading=${a.name} subheading=${a.id} @close=${()=>this.selected=null}>
                <dl>
                  <dt>מצב</dt><dd><sw-badge kind=${a.fresh} label=${a.state}></sw-badge></dd>
                  <dt>Domain</dt><dd><span class="ltr">${a.domain}</span></dd>
                  <dt>אזור HA</dt><dd>${a.area}</dd>
                  <dt>פעולות נתמכות</dt><dd>${a.actions}</dd>
                  <dt>במפה</dt><dd>${a.placed?"קומה 0":"לא מוצב"}</dd>
                </dl>
                <div class="note">ישות מ־domain לא מוכר מקבלת כרטיס כללי לקריאה בלבד. scripts ו־scenes חסומים עד allowlist.</div>
                <div slot="footer">
                  <sw-button variant="primary" icon="map">${a.placed?"הצג במפה":"הצב במפה"}</sw-button>
                  <sw-button variant="ghost">פתח ב־HA</sw-button>
                </div>
              </sw-drawer>`:""}
        </div>
      </sw-page>
    `}};Be.styles=g`
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
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;dt([p()],Be.prototype,"selected",2);dt([p()],Be.prototype,"domain",2);Be=dt([b("explore-entities")],Be);var hr=Object.defineProperty,fr=Object.getOwnPropertyDescriptor,ii=(e,s,a,i)=>{for(var t=i>1?void 0:i?fr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&hr(s,a,t),t};const Ds=[{id:"d1",name:"כניסה ראשית",kind:"דלת זכוכית",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!1,scene:"entrance"},{id:"d2",name:"לובי",kind:"דלת פנימית",lock:"פתוח",contact:"פתוח",relay:"לא פעיל",ringing:!1,scene:"lobby"},{id:"d3",name:"אינטרקום M2",kind:"עמדת דלת",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!0,scene:"entrance"},{id:"d4",name:"מחסן",kind:"דלת שירות",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!1,scene:"warehouse"}];let fs=class extends w{constructor(){super(...arguments),this.selected="d1"}render(){const e=Ds.find(s=>s.id===this.selected)??Ds[0];return n`
      <sw-page heading="דלתות ואינטרקום" subheading="V1 · מצלמה, צלצול, מגע דלת וממסר הם ארבעה נתונים שונים · נתוני הדגמה">
        <sw-tabs .items=${[{id:"doors",label:"דלתות",count:4},{id:"intercom",label:"אינטרקום",count:1},{id:"linked",label:"מצלמות מקושרות",count:4}]} active="doors"></sw-tabs>
        <div class="layout">
          <div class="list">
            ${Ds.map(s=>n`<button class="door ${s.id===this.selected?"on":""}" @click=${()=>this.selected=s.id} aria-pressed=${s.id===this.selected}>
                <div class="ic"><sw-icon name=${s.lock==="נעול"?"lock":"unlock"} size=${15}></sw-icon></div>
                <div style="flex:1"><b>${s.name}</b><small>${s.kind}</small></div>
                <span class="st ${s.ringing?"ring":s.lock==="נעול"?"":"open"}"><i></i>${s.ringing?"מצלצל":s.lock}</span>
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
    `}};fs.styles=g`
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
  `;ii([p()],fs.prototype,"selected",2);fs=ii([b("explore-access")],fs);var ur=Object.defineProperty,wr=Object.getOwnPropertyDescriptor,ve=(e,s,a,i)=>{for(var t=i>1?void 0:i?wr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&ur(s,a,t),t};let G=class extends w{constructor(){super(...arguments),this.label="",this.value="",this.detail="",this.icon="info",this.tone="neutral",this.badge=""}render(){return n`
      <div class="icon"><sw-icon .name=${this.icon} size=${16}></sw-icon></div>
      ${this.badge?n`<span class="badge">${this.badge}</span>`:""}
      <div>
        <div class="value">${this.value}</div>
        <div class="label">${this.label}</div>
        ${this.detail?n`<div class="detail">${this.detail}</div>`:""}
      </div>
    `}};G.styles=g`
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
  `;ve([c()],G.prototype,"label",2);ve([c()],G.prototype,"value",2);ve([c()],G.prototype,"detail",2);ve([c()],G.prototype,"icon",2);ve([c({reflect:!0})],G.prototype,"tone",2);ve([c()],G.prototype,"badge",2);G=ve([b("sw-kpi")],G);var vr=Object.getOwnPropertyDescriptor,br=(e,s,a,i)=>{for(var t=i>1?void 0:i?vr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};const gr={person:"var(--sw-accent)",vehicle:"var(--sw-live)",motion:"var(--sw-danger)",line:"var(--sw-stale)",offline:"var(--sw-offline)",door:"var(--sw-purple)"},mr={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking"};let Fs=class extends w{render(){const e=M.filter(l=>l.state==="live"||l.state==="stale").length,s=F.filter(l=>!l.acked),a=[{kind:"critical",title:"מצלמה מנותקת: מסדרון מזרחי",meta:"קומה 0 · מאז 07:55",why:"מוצג כי אין הקלטה ממצלמה זו כבר שעתיים",link:"#/system/devices"},{kind:"alert",title:`${s.length} אירועים שלא נבדקו`,meta:"אדם בכניסה הראשית 10:14, רכב בחצר 09:42",why:"מוצג כי אירועי אדם/רכב מחכים לסימון טיפול",link:"#/investigate/events"},{kind:"alert",title:"החיבור ל־Home Assistant לא רענן",meta:"סנכרון אחרון לפני 4 דק׳",why:"מוצג כי מצבי הישויות עלולים להיות מיושנים",link:"#/system/diagnostics"}],i=.68,t=34,r=2*Math.PI*t,o=M.filter(l=>l.state==="live").slice(0,2);return n`
      <sw-page heading="בוקר טוב, יוני" subheading="המערכת פועלת · גשר Home Assistant לא רענן · נתוני הדגמה">
        <div slot="actions" class="date">יום שני, 14 בספטמבר 2026<br />10:24</div>
        <div class="kpis">
          <sw-kpi icon="camera" tone="live" value=${String(e)} label="מצלמות" detail="מחוברות"></sw-kpi>
          <sw-kpi icon="building" value=${String(Hs.length)} label="אתרים" detail="פעילים" tone="neutral"></sw-kpi>
          <sw-kpi icon="bell" value=${String(F.length)} label="אירועים" detail="ב־24 השעות" tone="neutral" badge=${`${s.length} חדשים`}></sw-kpi>
          <sw-kpi icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר HA לא רענן"></sw-kpi>
        </div>
        <div class="fav">
          ${o.map(l=>n`<sw-camera-tile name=${l.name} state=${l.state} scene=${V[l.id]??"lobby"} @click=${()=>x(`/live/cameras/${l.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading="אחסון">
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label="אחסון בשימוש 68%">
                ${d`<circle cx="42" cy="42" r=${t} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                <circle cx="42" cy="42" r=${t} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${r*i} ${r}`} transform="rotate(-90 42 42)" />
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
            ${Hs.map(l=>n`<div class="hrow"><span>${l.name}<div class="muted">${l.online}/${l.cameras} מצלמות · ${l.alerts} התראות</div></span><span class="status"><i style="--c:${l.health==="live"?"var(--sw-live)":l.health==="offline"?"var(--sw-danger)":"var(--sw-stale)"}"></i>${l.health==="live"?"מחובר":l.health==="offline"?"מנותק":"חלקי"}</span></div>`)}
            ${Zt.slice(0,2).map(l=>n`<div class="hrow"><span>${l.name}<div class="muted">${l.detail}</div></span><span class="status"><i style="--c:${l.state==="live"?"var(--sw-live)":"var(--sw-stale)"}"></i>${l.state==="live"?"מחובר":"לא רענן"}</span></div>`)}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card heading="אירועים אחרונים">
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${F.slice(0,5).map(l=>n`<div class="ev" @click=${()=>x("/investigate/events")}>
                ${l.type==="offline"||l.type==="door"?n`<div class="none"><sw-icon name=${l.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:n`<sw-scene kind=${mr[l.camera]??"lobby"}></sw-scene>`}
                <div class="txt"><b style="--tone:${gr[l.type]}"><i></i>${Rs[l.type]}</b><small>${l.camera} · ${l.floor}</small></div>
                <time>${l.time}</time>
              </div>`)}
          </sw-card>
          <sw-card heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${a.map(l=>n`<div class="spot ${l.kind}">
                <div class="ic"><sw-icon name=${l.kind==="critical"?"offline":"warning"} size=${15}></sw-icon></div>
                <div><div class="t">${l.title}</div><div class="muted">${l.meta}</div><div class="why">${l.why}</div></div>
                <div class="actions"><a href=${l.link}><sw-button size="sm">פתח</sw-button></a></div>
              </div>`)}
          </sw-card>
        </div>
      </sw-page>
    `}};Fs.styles=g`
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
    .ev .none {
      inline-size: 56px;
      block-size: 36px;
      border-radius: 6px;
      flex-shrink: 0;
      overflow: hidden;
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
  `;Fs=br([b("live-overview")],Fs);var xr=Object.defineProperty,yr=Object.getOwnPropertyDescriptor,Ss=(e,s,a,i)=>{for(var t=i>1?void 0:i?yr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&xr(s,a,t),t};const $r=[1,2,4,6,8,9,12,16],Et=[{id:"all",label:"כל המצלמות"},{id:"outside",label:"חוץ"},{id:"inside",label:"פנים"},{id:"night",label:"לילה"}];let Me=class extends w{constructor(){super(...arguments),this.count=4,this.stream="auto",this.view="all"}render(){const e=M.slice(0,this.count),s=this.count===1?1:this.count===2||this.count<=4?2:this.count<=9?3:4;return n`
      <sw-page heading="כל המצלמות" subheading="${M.length} מצלמות · תצוגה: ${Et.find(a=>a.id===this.view)?.label} · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה" @change=${a=>this.view=a.target.value}>${Et.map(a=>n`<option value=${a.id} ?selected=${a.id===this.view}>${a.label}</option>`)}</select></sw-field>
        <sw-field slot="actions"><select aria-label="זרם" @change=${a=>this.stream=a.target.value}><option value="auto">חי · אוטומטי</option><option value="main">חי · ראשי</option><option value="sub">חי · משני</option></select></sw-field>
        <div slot="actions" class="layouts" role="group" aria-label="פריסה">
          ${$r.map(a=>n`<button class=${a===this.count?"on":""} @click=${()=>this.count=a} aria-pressed=${a===this.count}>${a}</button>`)}
        </div>
        <a slot="actions" href="#/kiosk/all"><sw-button variant="ghost" iconOnly icon="expand" label="מצב קיוסק"></sw-button></a>
        <div class="grid" style="--cols:${s}">
          ${e.map(a=>n`<sw-camera-tile name=${a.name} meta=${`${a.floor} · ${this.stream==="auto"?this.count>4?"משני":"ראשי":this.stream==="main"?"ראשי":"משני"}`} state=${a.state} scene=${V[a.id]??"lobby"} ?compact=${this.count>=9} @click=${()=>x(`/live/cameras/${a.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="note">קיר של ${this.count} אריחים אינו פותח ${this.count} זרמים ראשיים במקביל: במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד. סדר ובחירת מצלמות נשמרים בתצוגה.</div>
      </sw-page>
    `}};Me.styles=g`
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
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
        gap: 8px;
      }
    }
  `;Ss([p()],Me.prototype,"count",2);Ss([p()],Me.prototype,"stream",2);Ss([p()],Me.prototype,"view",2);Me=Ss([b("live-wall")],Me);var kr=Object.defineProperty,zr=Object.getOwnPropertyDescriptor,ss=(e,s,a,i)=>{for(var t=i>1?void 0:i?zr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&kr(s,a,t),t};let fe=class extends w{constructor(){super(...arguments),this.cameraId="cam-1",this.stream="main",this.recording=!1,this.ptzMode="presets"}render(){const e=M.find(i=>i.id===this.cameraId)??M[0],s=e.state==="live"||e.state==="stale",a=V[e.id]??"lobby";return n`
      <sw-page heading=${e.name} subheading=${`${e.floor} · NVR ערוץ ${e.id.replace("cam-","")} · נתוני הדגמה`} crumbs=${`מצלמות | ${e.floor}`}>
        <sw-badge slot="actions" kind=${e.state}></sw-badge>
        <a slot="actions" href="#/investigate/playback"><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label="במפה"></sw-button></a>
        <sw-button slot="actions" variant="ghost" iconOnly icon="system" label="הגדרות מצלמה"></sw-button>
        <div>
          <div class="video ${s?"":"off"}">
            ${s?n`<sw-scene kind=${a}></sw-scene><div class="shade"></div><span class="demo">דמו · הזרם יתחבר ב־T017</span>
                  <span class="stamp">2026-09-14 10:24:36</span>
                  <span class="quality">${this.stream==="main"?"1440p · H.265":"360p · H.264"}</span>`:n`<div class="center"><div>
                  <sw-icon name=${e.state==="offline"?"offline":"lock"} size=${32}></sw-icon>
                  <span>${e.state==="offline"?"המצלמה אינה מחוברת ל־NVR":"אין הרשאת צפייה במצלמה זו"}</span>
                </div></div>`}
          </div>
          <div class="controls">
            <div class="round" role="group" aria-label="פקדי מצלמה">
              ${e.audio?n`<button title="מיקרופון" aria-label="מיקרופון" ?disabled=${!s}><sw-icon name="mic" size=${16}></sw-icon></button><button title="שמע" aria-label="שמע" ?disabled=${!s}><sw-icon name="volume" size=${16}></sw-icon></button>`:h}
              <button title="צילום מסך" aria-label="צילום מסך" ?disabled=${!s}><sw-icon name="aperture" size=${16}></sw-icon></button>
              <button class="rec ${this.recording?"on":""}" title=${this.recording?"עצור הקלטה":"הקלט עכשיו"} aria-label=${this.recording?"עצור הקלטה":"הקלט עכשיו"} ?disabled=${!s} @click=${()=>this.recording=!this.recording}><sw-icon name="image" size=${16}></sw-icon></button>
              <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${!s}><sw-icon name="expand" size=${16}></sw-icon></button>
              <button class="q ${this.stream==="main"?"on":""}" @click=${()=>this.stream="main"}>1440p</button>
              <button class="q ${this.stream==="sub"?"on":""}" @click=${()=>this.stream="sub"}>360p</button>
              ${this.recording?n`<sw-badge kind="error" label="הקלטה ידנית · 04:12"></sw-badge>`:h}
            </div>
            ${e.ptz?n`<div class="ptz" role="group" aria-label="בקרת PTZ">
                  <div class="joy">
                    <button class="u" aria-label="למעלה"><sw-icon name="chevronDown" size=${14} style="transform:rotate(180deg)"></sw-icon></button>
                    <button class="d" aria-label="למטה"><sw-icon name="chevronDown" size=${14}></sw-icon></button>
                    <button class="l" aria-label="שמאלה"><sw-icon name="chevron" size=${14} flip></sw-icon></button>
                    <button class="r" aria-label="ימינה"><sw-icon name="chevron" size=${14}></sw-icon></button>
                    <span class="c" aria-hidden="true"></span>
                  </div>
                  <div class="zoom"><button aria-label="זום פנימה"><sw-icon name="plus" size=${14}></sw-icon></button><button aria-label="זום החוצה"><sw-icon name="minus" size=${14}></sw-icon></button></div>
                </div>`:h}
          </div>
          ${e.ptz?n`<div class="modes">
                <sw-chip icon="bookmark" ?selected=${this.ptzMode==="presets"} @click=${()=>this.ptzMode="presets"}>Presets</sw-chip>
                <sw-chip icon="target" ?selected=${this.ptzMode==="track"} @click=${()=>this.ptzMode="track"}>מעקב אוטומטי</sw-chip>
                <sw-chip icon="route" ?selected=${this.ptzMode==="patrol"} @click=${()=>this.ptzMode="patrol"}>סיור</sw-chip>
                ${this.ptzMode==="presets"?n`<sw-chip>1 · כניסה</sw-chip><sw-chip>2 · חניה</sw-chip><sw-chip>3 · שער</sw-chip>`:n`<span class="note" style="align-self:center">${this.ptzMode==="track"?"מעקב אוטומטי דרך ה־NVR; מוצג רק אחרי אימות היכולת (T031)":"סיור לפי רשימת presets; הרצה דורשת הרשאת מפעיל"}</span>`}
              </div>`:n`<div class="note" style="margin-block-start:8px">PTZ ושמע אינם מוצגים במצלמה זו: היכולת לא אומתה. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>`}
          <div class="grid">
            <sw-card heading="פרטים">
              <dl>
                <dt>מצב</dt><dd><sw-badge kind=${e.state}></sw-badge></dd>
                <dt>הקלטה</dt><dd>${{continuous:"רציפה",motion:"לפי תנועה",off:"כבויה",unknown:"לא ידוע"}[e.recording]}</dd>
                <dt>זרם</dt><dd>${e.fps?`${e.fps} fps · ${e.bitrateKbps} kbps`:"—"}</dd>
                <dt>קושחה</dt><dd><span class="ltr">${e.firmware}</span></dd>
                <dt>זמן מקור</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
                <dt>אירוע אחרון</dt><dd>${e.lastEvent}</dd>
              </dl>
            </sw-card>
            <sw-card heading="מצלמות באותה קומה">
              <div class="tiles">
                ${M.filter(i=>i.floor===e.floor&&i.id!==e.id).slice(0,4).map(i=>n`<sw-camera-tile compact name=${i.name} state=${i.state} scene=${V[i.id]??"lobby"} @click=${()=>x(`/live/cameras/${i.id}`)}></sw-camera-tile>`)}
              </div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `}};fe.styles=g`
    .titlerow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: #0f1729;
      color: #fff;
      box-shadow: var(--sw-shadow-2);
    }
    .video sw-scene {
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
    .round button.rec {
      color: var(--sw-danger);
    }
    .round button.rec.on {
      background: var(--sw-danger);
      border-color: var(--sw-danger);
      color: #fff;
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
    .joy button:hover {
      color: var(--sw-accent-text);
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
  `;ss([c()],fe.prototype,"cameraId",2);ss([p()],fe.prototype,"stream",2);ss([p()],fe.prototype,"recording",2);ss([p()],fe.prototype,"ptzMode",2);fe=ss([b("live-camera")],fe);var _r=Object.defineProperty,Pr=Object.getOwnPropertyDescriptor,Os=(e,s,a,i)=>{for(var t=i>1?void 0:i?Pr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&_r(s,a,t),t};let Se=class extends w{constructor(){super(...arguments),this.checked=!1,this.disabled=!1,this.label=""}flip(){this.disabled||(this.checked=!this.checked,this.dispatchEvent(new CustomEvent("change",{detail:{checked:this.checked},bubbles:!0,composed:!0})))}render(){return n`<button type="button" role="switch" aria-checked=${this.checked} aria-label=${this.label} ?disabled=${this.disabled} @click=${this.flip}></button>${this.label?n`<span>${this.label}</span>`:""}`}};Se.styles=g`
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
  `;Os([c({type:Boolean,reflect:!0})],Se.prototype,"checked",2);Os([c({type:Boolean,reflect:!0})],Se.prototype,"disabled",2);Os([c()],Se.prototype,"label",2);Se=Os([b("sw-toggle")],Se);var Mr=Object.getOwnPropertyDescriptor,Sr=(e,s,a,i)=>{for(var t=i>1?void 0:i?Mr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};const Or=[{name:"כל המצלמות",layout:9,scope:"משותפת",mobile:"4 · משני",owner:"יוני",kiosk:!0},{name:"חוץ",layout:4,scope:"משותפת",mobile:"2 · משני",owner:"יוני",kiosk:!1},{name:"פנים",layout:6,scope:"משותפת",mobile:"ללא",owner:"יוסי",kiosk:!1},{name:"לילה",layout:4,scope:"אישית",mobile:"4 · משני",owner:"דנה",kiosk:!1}];let qs=class extends w{render(){return n`
      <sw-page heading="תצוגות שמורות" subheading="תבניות 1 / 2 / 4 / 6 / 9 / 12 / 16 / מותאם, אישיות או משותפות, עם התאמה למובייל · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תצוגה חדשה</sw-button>
        <div class="grid">
          ${Or.map(e=>{const s=Math.ceil(Math.sqrt(e.layout));return n`<sw-card heading=${e.name}>
              <sw-badge slot="actions" kind="neutral" label=${e.scope}></sw-badge>
              <div class="thumb" style="grid-template-columns:repeat(${s},1fr)">${M.filter(a=>a.state==="live").slice(0,e.layout).map(a=>n`<sw-scene kind=${V[a.id]??"lobby"}></sw-scene>`)}</div>
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
    `}};qs.styles=g`
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
  `;qs=Sr([b("live-views")],qs);var Ar=Object.getOwnPropertyDescriptor,Cr=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ar(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};let Ks=class extends w{render(){const s=M.filter(a=>a.state!=="forbidden").slice(0,9);return n`
      <header>
        <img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" />
        <h1>ניטור חי</h1>
        <span class="spacer"></span>
        <span class="clock">יום שני, 14.09.2026 · 10:24:36</span>
      </header>
      <div class="grid">${s.map(a=>n`<sw-camera-tile dark name=${a.name} state=${a.state} scene=${V[a.id]??"lobby"} noDemo></sw-camera-tile>`)}</div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${16}></sw-icon></div><div><b>7</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic red"><sw-icon name="warning" size=${16}></sw-icon></div><div><b>3</b><span>התראות פתוחות</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${16}></sw-icon></div><div><b>2</b><span>מבנים</span></div></div>
        <div class="stat"><div class="ic green"><sw-icon name="check" size=${16}></sw-icon></div><div><b style="font-size:var(--sw-fs-lg)">חלקי</b><span>מצב מערכת · גשר HA לא רענן</span></div></div>
      </div>
      <div class="note">תצוגת קיוסק: קריאה בלבד, ללא פקדי ניהול, חיבור מחדש אוטומטי · נתוני הדגמה (סצנות מאוירות עד חיבור הזרמים)</div>
    `}};Ks.styles=g`
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
    .grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
  `;Ks=Cr([b("kiosk-wall")],Ks);var Er=Object.defineProperty,Ir=Object.getOwnPropertyDescriptor,be=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ir(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Er(s,a,t),t};const Dr=[{label:"שעה",minutes:60},{label:"6 שע׳",minutes:360},{label:"יום",minutes:1440}];function It(e){return String(e).padStart(2,"0")}function q(e){const s=(e%1440+1440)%1440;return`${It(Math.floor(s/60))}:${It(Math.floor(s%60))}`}const Nr={motion:"#ef4444",person:"#2f6bff",vehicle:"#22c55e",line:"#f59e0b",offline:"#6b7280",door:"#8b5cf6"};let Y=class extends w{constructor(){super(...arguments),this.segments=[],this.events=[],this.cursor=615,this.windowMinutes=360,this.precision="estimated",this.hover=null}get start(){return Math.max(0,Math.min(1440-this.windowMinutes,this.cursor-this.windowMinutes/2))}x(e,s){return(e-this.start)/this.windowMinutes*s}onMove(e){const s=e.currentTarget.getBoundingClientRect();this.hover=Math.round(this.start+(e.clientX-s.left)/s.width*this.windowMinutes)}onClick(e){const s=e.currentTarget.getBoundingClientRect(),a=Math.round(this.start+(e.clientX-s.left)/s.width*this.windowMinutes);this.cursor=a,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:a},bubbles:!0,composed:!0}))}buckets(e){const s=[],a=this.windowMinutes/e;for(let i=0;i<e;i++){const t=this.start+i*a,r=t+a;let o=0;for(const l of this.segments)l.endMin>t&&l.startMin<r&&(o=Math.max(o,l.kind==="motion"?2:1));o&&this.events.some(l=>l.minute>=t-a&&l.minute<=r+a)&&(o=3),s.push(o)}return s}render(){const r=this.windowMinutes<=60?10:this.windowMinutes<=360?60:180,o=[];for(let u=Math.ceil(this.start/r)*r;u<=this.start+this.windowMinutes;u+=r)o.push(u);const l=[0,12,26,36],f={verified:"זמן מאומת",keyframe_limited:"דיוק לפי keyframe",estimated:"זמן משוער",unknown:"דיוק לא ידוע"}[this.precision],y=this.x(this.cursor,1e3),m=q(this.cursor);return n`
      <div class="bar">
        <span class="precision">${f} · לחיצה על הציר מבצעת seek</span>
        <div class="windows">
          ${Dr.map(u=>n`<button class=${u.minutes===this.windowMinutes?"on":""} @click=${()=>this.windowMinutes=u.minutes}>${u.label}</button>`)}
        </div>
      </div>
      <svg viewBox="0 0 ${1e3} ${84}" preserveAspectRatio="none" @mousemove=${this.onMove} @mouseleave=${()=>this.hover=null} @click=${this.onClick} role="img" aria-label="ציר זמן הקלטות">
        <line x1="0" x2=${1e3} y1=${58+.5} y2=${58+.5} stroke="var(--sw-border)" />
        ${this.buckets(160).map((u,$)=>{if(!u)return h;const R=l[u];return d`<rect x=${$*6.25+1} y=${58-R} width=${Math.max(2,6.25-2)} height=${R} rx="1.5" fill=${"var(--sw-accent)"} opacity=${u===1?.45:u===2?.8:1} />`})}
        ${o.map(u=>d`<line x1=${this.x(u,1e3)} x2=${this.x(u,1e3)} y1=${58} y2=${63} stroke="var(--sw-border-strong)" /><text x=${this.x(u,1e3)} y=${78} font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${q(u)}</text>`)}
        ${this.events.map(u=>{const $=this.x(u.minute,1e3);return $<0||$>1e3?h:d`<g><circle cx=${$} cy=${58-l[3]-8} r="3.5" fill=${Nr[u.kind]} /><title>${u.label} · ${q(u.minute)}</title></g>`})}
        ${this.hover!==null?d`<line x1=${this.x(this.hover,1e3)} x2=${this.x(this.hover,1e3)} y1="18" y2=${58} stroke="var(--sw-text-3)" stroke-dasharray="3 3" />`:h}
        <g transform="translate(${y} 0)">
          <line x1="0" x2="0" y1="15" y2=${62} stroke="var(--sw-accent)" stroke-width="2" />
          <rect x="-24" y="0" width="48" height="16" rx="5" fill="var(--sw-accent)" />
          <text x="0" y="11.5" font-size="10.5" text-anchor="middle" fill="#fff" font-family="var(--sw-font-mono)" font-weight="600">${m}</text>
        </g>
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-accent)">הקלטה (גובה = פעילות)</span>
        <span style="--lg: #ef4444">תנועה</span>
        <span style="--lg: #2f6bff">אדם</span>
        <span style="--lg: #22c55e">רכב</span>
        <span style="--lg: #8b5cf6">דלת</span>
        <span style="--lg: var(--sw-border-strong)">ריק = אין הקלטה / לא נבדק</span>
      </div>
    `}};Y.styles=g`
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
    svg {
      inline-size: 100%;
      block-size: 84px;
      display: block;
      cursor: crosshair;
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
  `;be([c({attribute:!1})],Y.prototype,"segments",2);be([c({attribute:!1})],Y.prototype,"events",2);be([c({type:Number})],Y.prototype,"cursor",2);be([c({type:Number})],Y.prototype,"windowMinutes",2);be([c()],Y.prototype,"precision",2);be([p()],Y.prototype,"hover",2);Y=be([b("sw-timeline")],Y);var jr=Object.defineProperty,Tr=Object.getOwnPropertyDescriptor,ge=(e,s,a,i)=>{for(var t=i>1?void 0:i?Tr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&jr(s,a,t),t};let X=class extends w{constructor(){super(...arguments),this.cameraId="cam-10",this.cursor=615,this.generation=3,this.playing=!0,this.speed=1,this.filter="all"}seek(e){this.cursor=e.detail.minute,this.generation+=1}render(){const e=M.find(i=>i.id===this.cameraId)??M[0],s=!hs.some(i=>this.cursor>=i.startMin&&this.cursor<=i.endMin),a=F.filter(i=>i.minuteOfDay<1440).filter(i=>this.filter==="all"||i.type===this.filter).map(i=>({minute:i.minuteOfDay,kind:i.type,label:i.title}));return n`
      <sw-page heading=${e.name} subheading="14.09.2026 ${q(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה" crumbs="הקלטות | ${e.floor}" wide>
        <div slot="actions" class="pick">
          <sw-field><select aria-label="מצלמה" @change=${i=>this.cameraId=i.target.value}>${M.map(i=>n`<option value=${i.id} ?selected=${i.id===this.cameraId}>${i.name}</option>`)}</select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <sw-field style="inline-size:96px"><input type="time" value=${q(this.cursor)} data-ltr aria-label="שעה" @change=${i=>{const[t,r]=i.target.value.split(":").map(Number);this.cursor=t*60+r,this.generation+=1}} /></sw-field>
        </div>
        <sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button>
        <sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button>
        <sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>
        <div class="video ${s?"gap":""}">
          ${s?n`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`:n`<sw-scene kind=${V[e.id]??"lobby"}></sw-scene><div class="shade"></div><span class="demo">דמו · הניגון יתחבר ב־T028</span>`}
          <div class="tag"><sw-badge kind=${s?"unknown":"recorded"} ?onImage=${!s}></sw-badge><span class="nm">${e.name}</span></div>
          <span class="stamp">2026-09-14 ${q(this.cursor)}:00 · actual: ${s?"—":q(this.cursor)}</span>
          <div class="bar"><div class="inner">
            <sw-button variant="ghost" size="sm" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה":"נגן"} @click=${()=>this.playing=!this.playing}></sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
            <span class="sep"></span>
            ${[1,2,4].map(i=>n`<button class="q ${this.speed===i?"on":""}" @click=${()=>this.speed=i}>${i}×</button>`)}
            <span class="sep"></span>
            <sw-button variant="ghost" size="sm" iconOnly icon="aperture" label="צילום מהקלטה"></sw-button>
            <button class="q on">1080p</button>
            <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
          </div></div>
        </div>
        <sw-timeline .segments=${hs} .events=${a} .cursor=${this.cursor} precision="estimated" @seek=${this.seek}></sw-timeline>
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
          <span>כיסוי: ${s?"פער":"מלא"} · 6 מקטעים ביום</span>
          <span>WebRTC → MSE</span>
          ${s?h:n`<span>מצלמה: ${e.name}</span>`}
        </div>
      </sw-page>
    `}};X.styles=g`
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
      max-block-size: 62vh;
      margin-inline: auto;
      inline-size: 100%;
    }
    .video sw-scene {
      position: absolute;
      inset: 0;
    }
    .video.gap {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
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
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    .bar {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 10px;
      display: flex;
      justify-content: center;
      pointer-events: none;
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
  `;ge([p()],X.prototype,"cameraId",2);ge([p()],X.prototype,"cursor",2);ge([p()],X.prototype,"generation",2);ge([p()],X.prototype,"playing",2);ge([p()],X.prototype,"speed",2);ge([p()],X.prototype,"filter",2);X=ge([b("investigate-playback")],X);var Hr=Object.defineProperty,Rr=Object.getOwnPropertyDescriptor,ct=(e,s,a,i)=>{for(var t=i>1?void 0:i?Rr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Hr(s,a,t),t};let Ue=class extends w{constructor(){super(...arguments),this.cursor=615,this.playing=!1}render(){const e=[{cam:M[0],drift:"+0.2s",state:"recorded"},{cam:M[9],drift:"-0.4s",state:"recorded"},{cam:M[3],drift:"gap",state:"unknown"},{cam:M[1],drift:"buffering",state:"stale"}];return n`
      <sw-page heading="מרכז שליטה" subheading="ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה"><option>כל המסכים</option><option>כניסה + חצר</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${e.map(s=>n`<div class="tile">
              <span class="drift">${s.drift}</span>
              <sw-camera-tile name=${s.cam.name} state=${s.state} scene=${V[s.cam.id]??"lobby"}></sw-camera-tile>
            </div>`)}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" value=${`2026-09-14T${q(this.cursor)}`} data-ltr aria-label="זמן" @change=${s=>{const a=s.target.value.split("T")[1]??"10:15",[i,t]=a.split(":").map(Number);this.cursor=i*60+t}} /></sw-field>
          <sw-button iconOnly icon="mic" label="דיבור"></sw-button>
          <sw-button iconOnly icon="back10" label="אחורה"></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה הכל":"נגן הכל"} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button iconOnly icon="forward10" label="קדימה"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${hs} .events=${F.slice(0,4).map(s=>({minute:s.minuteOfDay,kind:s.type,label:s.title}))} .cursor=${this.cursor} precision="estimated" @seek=${s=>this.cursor=s.detail.minute}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">כל המצלמות</sw-chip>
          <sw-chip dot="#ef4444">תנועה</sw-chip><sw-chip dot="#2f6bff">אדם</sw-chip><sw-chip dot="#22c55e">רכב</sw-chip><sw-chip dot="#8b5cf6">אחר</sw-chip>
        </div>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `}};Ue.styles=g`
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
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;ct([p()],Ue.prototype,"cursor",2);ct([p()],Ue.prototype,"playing",2);Ue=ct([b("investigate-sync")],Ue);var Lr=Object.defineProperty,Vr=Object.getOwnPropertyDescriptor,pt=(e,s,a,i)=>{for(var t=i>1?void 0:i?Vr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Lr(s,a,t),t};let We=class extends w{constructor(){super(...arguments),this.floorId="f0",this.minute=615}get markers(){const e=i=>i==="cam-3"||this.minute>=190&&this.minute<=205?"unknown":"historic",s=ps.filter(i=>i.floorId===this.floorId).map(i=>({id:i.id,kind:"camera",label:i.name,x:i.x,y:i.y,rotation:i.rotation,fov:i.fov,state:i.state==="forbidden"?"forbidden":e(i.id)})),a=js.filter(i=>i.floorId===this.floorId).map((i,t)=>({id:i.id,kind:i.domain,label:i.name,x:i.x,y:i.y,state:t%2?"unknown":"historic"}));return[...s,...a]}render(){const e=se.find(s=>s.id===this.floorId)??se[0];return n`
      <div class="head">
        <div><h1>מפה היסטורית · ${e.name}</h1><div class="sub">מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${e.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${q(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${s=>this.minute=Number(s.target.value)} aria-label="זמן" />
        <sw-chip @click=${()=>this.minute=Math.max(0,this.minute-60)}>-1 שעה</sw-chip><sw-chip @click=${()=>this.minute=Math.min(1439,this.minute+60)}>+1 שעה</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">גרסת מפה 3 (תקפה מ־01.09)</span>
      </div>
      <div class="stage">
        <sw-plan-canvas .planWidth=${e.planWidth} .planHeight=${e.planHeight} .plan=${Kt(e.id)} .markers=${this.markers}></sw-plan-canvas>
        <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = לא ידוע / פער</span><span>ישות: מצב ידוע אחרון</span></div>
      </div>
    `}};We.styles=g`
    :host {
      display: flex;
      flex-direction: column;
      block-size: 100%;
      min-block-size: 0;
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
    @media (max-width: 767px) {
      .head,
      .bar {
        margin-inline: 12px;
        padding-inline: 12px;
      }
      .head {
        padding-inline: 0;
      }
      .stage {
        margin: 0;
        border-radius: 0;
      }
      .legend {
        display: none;
      }
    }
  `;pt([c()],We.prototype,"floorId",2);pt([p()],We.prototype,"minute",2);We=pt([b("investigate-history-map")],We);var Br=Object.defineProperty,Ur=Object.getOwnPropertyDescriptor,ht=(e,s,a,i)=>{for(var t=i>1?void 0:i?Ur(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Br(s,a,t),t};const Wr={person:"#2f6bff",vehicle:"#22c55e",motion:"#ef4444",line:"#f59e0b",offline:"#6b7280",door:"#8b5cf6"},Dt={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking","מסדרון מזרחי":"corridor"};let Fe=class extends w{constructor(){super(...arguments),this.selected=null,this.filter="all",this.columns=[{key:"thumb",label:"תמונה",width:"80px",render:e=>e.type==="offline"||e.type==="door"?n`<div class="thumb none"><sw-icon name=${e.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:n`<sw-scene class="thumb" kind=${Dt[String(e.camera)]??"lobby"}></sw-scene>`},{key:"title",label:"אירוע",render:e=>n`<span class="ty" style="--tone:${Wr[e.type]}"><i></i>${Rs[e.type]}</span><div class="sub">${String(e.title)} · ${e.acked?"טופל":"ממתין לטיפול"}</div>`},{key:"camera",label:"מצלמה",render:e=>n`${String(e.camera)}<div class="sub">${String(e.floor)}</div>`},{key:"time",label:"זמן",render:e=>n`${String(e.time)}<div class="sub ltr">${String(e.source)}</div>`},{key:"severity",label:"חומרה",render:e=>n`<sw-badge kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${{info:"מידע",alert:"התראה",critical:"קריטי"}[e.severity]}></sw-badge>`},{key:"more",label:"",width:"40px",render:()=>n`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}render(){const e=F.filter(a=>this.filter==="all"||!a.acked),s=F.find(a=>a.id===this.selected);return n`
      <sw-page heading="מרכז אירועים" subheading="חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
        <div class="filters">
          <sw-field><select aria-label="אתר"><option>כל האתרים</option><option>אתר הדגמה</option></select></sw-field>
          <sw-field><select aria-label="מצלמה"><option>כל המצלמות</option></select></sw-field>
          <sw-field><select aria-label="סוג"><option>כל סוגי האירועים</option><option>אדם</option><option>רכב</option><option>תנועה</option><option>ניתוק</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <span class="grow"></span>
          <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${F.length}>הכל</sw-chip>
          <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>this.filter="unacked"} count=${F.filter(a=>!a.acked).length}>ללא טיפול</sw-chip>
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${e} .selected=${this.selected} @row-select=${a=>this.selected=a.detail.id}></sw-table>
          ${s?n`<sw-drawer open heading=${Rs[s.type]} subheading=${`${s.camera} · ${s.time}`} @close=${()=>this.selected=null}>
                <div class="preview">${s.type==="offline"||s.type==="door"?"אין תמונה לאירוע זה":n`<sw-scene kind=${Dt[s.camera]??"lobby"}></sw-scene><span class="demo">דמו · תמונת אירוע מה־NVR (T044)</span>`}</div>
                <dl>
                  <dt>מקור</dt><dd><span class="ltr">${s.source}</span> · raw: <span class="ltr">${s.type}</span></dd>
                  <dt>זמן אירוע</dt><dd>${s.time} · נקלט +1.2s</dd>
                  <dt>קומה</dt><dd>${s.floor}</dd>
                  <dt>כיסוי הקלטה</dt><dd>${s.type==="offline"?"אין":"קיים · 10 שנ׳ לפני/אחרי"}</dd>
                  <dt>טיפול</dt><dd>${s.acked?"טופל בידי יוני, 09:50":"ממתין"}</dd>
                </dl>
                <div slot="footer">
                  <a href="#/investigate/playback"><sw-button variant="primary" size="sm" icon="history">להקלטה</sw-button></a>
                  <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה</sw-button></a>
                  <sw-button variant="ghost" size="sm" icon="check" ?disabled=${s.acked}>סמן טופל</sw-button>
                </div>
              </sw-drawer>`:""}
        </div>
      </sw-page>
    `}};Fe.styles=g`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .filters sw-field {
      inline-size: 150px;
    }
    .filters .grow {
      flex: 1;
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
  `;ht([p()],Fe.prototype,"selected",2);ht([p()],Fe.prototype,"filter",2);Fe=ht([b("investigate-events")],Fe);var Fr=Object.getOwnPropertyDescriptor,qr=(e,s,a,i)=>{for(var t=i>1?void 0:i?Fr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};const Kr=[{id:"rv-1",title:"כניסה ראשית · 10:12–10:16",primary:"כניסה ראשית",scene:"entrance",related:["לובי"],events:3,severity:"alert",status:"חדש"},{id:"rv-2",title:"חצר אחורית · 09:40–09:44",primary:"חצר אחורית",scene:"backyard",related:[],events:2,severity:"info",status:"בבדיקה"},{id:"rv-3",title:"חניה מקורה · 06:41–06:45",primary:"חניה מקורה",scene:"parking",related:["כניסה ראשית"],events:1,severity:"alert",status:"טופל"},{id:"rv-4",title:"לובי · אתמול 23:08–23:12",primary:"לובי",scene:"lobby",related:[],events:4,severity:"info",status:"false positive"}];let Gs=class extends w{render(){return n`
      <sw-page heading="תור Review" subheading="אירועים סמוכים מקובצים לחלון אחד עם מצלמה ראשית · נתוני הדגמה">
        <div class="filters">
          <sw-chip selected count=${1}>חדש</sw-chip><sw-chip count=${1}>בבדיקה</sw-chip><sw-chip count=${1}>טופל</sw-chip><sw-chip count=${1}>false positive</sw-chip>
          <sw-chip icon="filter">חומרה</sw-chip><sw-chip icon="camera">מצלמה</sw-chip>
        </div>
        <div class="list">
          ${Kr.map(e=>n`<sw-card>
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
    `}};Gs.styles=g`
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
  `;Gs=qr([b("investigate-reviews")],Gs);var Gr=Object.defineProperty,Yr=Object.getOwnPropertyDescriptor,As=(e,s,a,i)=>{for(var t=i>1?void 0:i?Yr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Gr(s,a,t),t};const Xr=[{key:"title",label:"תיק",render:e=>n`<strong>${String(e.title)}</strong>`},{key:"status",label:"סטטוס",render:e=>n`<sw-badge kind=${e.status==="פתוח"?"stale":e.status==="סגור"?"neutral":"recorded"} label=${String(e.status)}></sw-badge>`},{key:"owner",label:"בעלים"},{key:"clips",label:"קטעים"},{key:"notes",label:"הערות"},{key:"preserved",label:"ראיות שמורות",render:e=>n`${e.preserved} שמורות${Number(e.missing)?n` · <span style="color:var(--sw-danger)">${e.missing} חסרות</span>`:""}`},{key:"more",label:"",width:"40px",render:()=>n`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}];let Nt=class extends w{render(){return n`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת ו־hash · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תיק חדש</sw-button>
        <sw-table .columns=${Xr} .rows=${Vs} @row-select=${e=>x(`/investigate/cases/${e.detail.id}`)}></sw-table>
      </sw-page>
    `}};Nt=As([b("investigate-cases")],Nt);let qe=class extends w{constructor(){super(...arguments),this.caseId="case-1",this.tab="details"}render(){const e=Vs.find(s=>s.id===this.caseId)??Vs[0];return n`
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
          <sw-tabs .items=${[{id:"details",label:"פרטים"},{id:"notes",label:"הערות",count:2},{id:"related",label:"מצלמות קשורות",count:3}]} .active=${this.tab} @change=${s=>this.tab=s.detail.id}></sw-tabs>
          ${this.tab==="details"?n`<div class="form">
                <div class="stack">
                  <sw-field label="כותרת"><input value=${e.title} /></sw-field>
                  <sw-field label="תיאור"><textarea rows="3">אדם נכנס אחרי פתיחת הדלת ב־10:12. לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).</textarea></sw-field>
                </div>
                <div class="pills">
                  <div class="pill"><sw-icon name="calendar" size=${14}></sw-icon>13.09.2026 · 10:12</div>
                  <div class="pill"><sw-icon name="camera" size=${14}></sw-icon>כניסה ראשית · לובי</div>
                  <div class="pill"><sw-icon name="shield" size=${14}></sw-icon>2/3 ראיות שמורות · sha256</div>
                </div>
              </div>`:this.tab==="notes"?n`<sw-card>
                  <div class="note">נראה אדם נכנס אחרי פתיחת הדלת ב־10:12.<small>יוני · 10:40</small></div>
                  <div class="note">לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).<small>יוסי · 10:52</small></div>
                  <sw-field style="margin-block-start:8px"><textarea rows="2" placeholder="הערה חדשה…"></textarea></sw-field>
                </sw-card>`:n`<div class="clips">
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
    `}};qe.styles=g`
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
  `;As([c()],qe.prototype,"caseId",2);As([p()],qe.prototype,"tab",2);qe=As([b("investigate-case-detail")],qe);var Jr=Object.getOwnPropertyDescriptor,Zr=(e,s,a,i)=>{for(var t=i>1?void 0:i?Jr(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};let Ys=class extends w{render(){return n`
      <sw-page heading="ייצוא והורדות" subheading="עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="download">ייצוא חדש</sw-button>
        <sw-card>
          ${Jt.map(e=>n`<div class="job">
              <div><strong>${e.title}</strong><div class="meta">${e.size} · ${e.hash}</div></div>
              <div><div class="bar ${e.status.startsWith("נכשל")?"fail":""}"><i style="inline-size:${e.progress}%"></i></div><div class="meta">${e.status} · ${e.progress}%</div></div>
              <div class="actions">
                ${e.progress===100?n`<sw-button size="sm" icon="download">הורדה</sw-button>`:e.status.startsWith("נכשל")?n`<sw-button size="sm" icon="refresh">נסה שוב</sw-button>`:n`<sw-button size="sm" variant="ghost" icon="close">בטל</sw-button>`}
              </div>
            </div>`)}
        </sw-card>
        <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.</div>
      </sw-page>
    `}};Ys.styles=g`
    .job {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 160px auto;
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
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .actions {
      display: flex;
      gap: 4px;
    }
    @media (max-width: 767px) {
      .job {
        grid-template-columns: 1fr;
      }
    }
  `;Ys=Zr([b("investigate-exports")],Ys);var Qr=Object.defineProperty,en=Object.getOwnPropertyDescriptor,ai=(e,s,a,i)=>{for(var t=i>1?void 0:i?en(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Qr(s,a,t),t};const sn=[{scene:"entrance",when:"14.09.2026 10:14",cam:"כניסה ראשית",why:"NVR: זיהוי אדם (Smart)"},{scene:"lobby",when:"14.09.2026 10:13",cam:"לובי",why:"NVR: תנועה + סמיכות במפה לכניסה"},{scene:"parking",when:"14.09.2026 06:43",cam:"חניה מקורה",why:"NVR: חציית קו"},{scene:"entrance",when:"14.09.2026 08:12",cam:"כניסה ראשית",why:"HA: דלת נפתחה + תנועה"},{scene:"corridor",when:"13.09.2026 23:10",cam:"מסדרון מזרחי",why:"NVR: זיהוי אדם"},{scene:"backyard",when:"13.09.2026 18:03",cam:"חצר אחורית",why:"NVR: תנועה"}];let us=class extends w{constructor(){super(...arguments),this.by="person"}render(){return n`
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
            ${sn.map(e=>n`<div class="res" @click=${()=>window.location.hash="#/investigate/playback"}><div class="pic"><sw-scene kind=${e.scene}></sw-scene><span class="demo">דמו</span></div><div class="cap">${e.when}<small>${e.cam} · ${e.why}</small></div></div>`)}
          </div>
        </div>
      </sw-page>
    `}};us.styles=g`
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
  `;ai([p()],us.prototype,"by",2);us=ai([b("investigate-search")],us);var tn=Object.defineProperty,an=Object.getOwnPropertyDescriptor,Cs=(e,s,a,i)=>{for(var t=i>1?void 0:i?an(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&tn(s,a,t),t};const jt={"r-1":{icon:"user",bg:"#eaf0ff",fg:"#2f6bff"},"r-2":{icon:"move",bg:"#e8f8ee",fg:"#16a34a"},"r-3":{icon:"door",bg:"#fff4e0",fg:"#d97706"},"r-4":{icon:"offline",bg:"#fdecec",fg:"#ef4444"}};let ws=class extends w{constructor(){super(...arguments),this.tab="rules"}render(){return n`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus" @click=${()=>x("/investigate/rules/new")}>חוק חדש</sw-button>
        <sw-tabs .items=${[{id:"rules",label:"חוקים",count:Bs.length},{id:"notif",label:"התראות"},{id:"sched",label:"לוחות זמנים"},{id:"trig",label:"Triggers"}]} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        ${this.tab==="rules"?n`<div class="list">
              ${Bs.map(e=>{const s=jt[e.id]??jt["r-1"];return n`<sw-card flush class="rule" style="--bg:${s.bg};--fg:${s.fg}">
                  <div class="ic"><sw-icon .name=${s.icon} size=${16}></sw-icon></div>
                  <div class="txt"><b>${e.name}</b><small>${e.trigger} · ${e.scope} · ${e.action}</small></div>
                  <span class="last">הופעל: ${e.last}</span>
                  <sw-toggle ?checked=${e.enabled} label=""></sw-toggle>
                  <sw-button size="sm" @click=${()=>x(`/investigate/rules/${e.id}`)}>עריכה</sw-button>
                  <sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>
                </sw-card>`})}
            </div>`:n`<sw-card><div class="empty">${this.tab==="notif"?"ערוצי התראה: Push דרך HA, מייל (Beta). ההגדרה מגיעה עם T063.":this.tab==="sched"?"לוחות זמנים בזמן האתר (Asia/Jerusalem), שעון קיץ לפי התאריך.":"Triggers זמינים: אירועי NVR (אדם, רכב, תנועה, חציית קו, ניתוק) ושינויי מצב HA (allowlist)."}</div></sw-card>`}
      </sw-page>
    `}};ws.styles=g`
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
    @media (max-width: 767px) {
      .last {
        display: none;
      }
    }
  `;Cs([p()],ws.prototype,"tab",2);ws=Cs([b("investigate-rules")],ws);let vs=class extends w{constructor(){super(...arguments),this.ruleId="r-1"}render(){const e=Bs.find(s=>s.id===this.ruleId)??{name:"חוק חדש",trigger:"זיהוי אדם",scope:"חוץ",action:"התראה"};return n`
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
    `}};vs.styles=g`
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
  `;Cs([c()],vs.prototype,"ruleId",2);vs=Cs([b("investigate-rule-editor")],vs);var rn=Object.defineProperty,nn=Object.getOwnPropertyDescriptor,ts=(e,s,a,i)=>{for(var t=i>1?void 0:i?nn(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&rn(s,a,t),t};const on=[{id:"users",label:"משתמשים",count:Ls.length},{id:"groups",label:"קבוצות",count:Gt.length},{id:"roles",label:"תפקידים",count:Yt.length},{id:"effective",label:"הרשאות אפקטיביות"},{id:"audit",label:"אודיט הרשאות"}];let ue=class extends w{constructor(){super(...arguments),this.tab="users",this.selected=null,this.assigning=!1,this.step=0,this.userColumns=[{key:"name",label:"שם",render:e=>n`<div class="who"><sw-avatar name=${String(e.name)} size=${30}></sw-avatar><div><strong>${String(e.name)}</strong>${e.haAdmin?n` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:""}<div class="ltr sub">${String(e.haUser)}@ha.local</div></div></div>`},{key:"role",label:"תפקיד",render:e=>{const s=e.bindings[0];return s?n`<span class="pillsel">${s.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:n`<span class="pillsel" style="color:var(--sw-text-3)">ללא שיוך<sw-icon name="chevronDown" size=${11}></sw-icon></span>`}},{key:"scope",label:"היקף גישה",render:e=>{const s=e.bindings[0];return s?n`<span class="pillsel">${s.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:n`<span class="sub">—</span>`}},{key:"active",label:"מצב",render:e=>n`<span class="status ${e.active?"":"off"}"><i></i>${e.active?"פעיל":"מושבת ב־HA"}</span>`},{key:"lastSync",label:"סנכרון"},{key:"more",label:"",width:"40px",render:()=>n`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}renderUsers(){const e=Ls.find(s=>s.id===this.selected);return n`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${Ls} .selected=${this.selected} @row-select=${s=>{this.selected=s.detail.id,this.assigning=!1}}></sw-table>
        ${e?n`<sw-drawer open heading=${e.name} subheading=${`HA: ${e.haUser} · ${e.active?"פעיל":"מושבת"}`} @close=${()=>this.selected=null}>
              ${this.assigning?n`<div class="wiz">
                    <sw-steps .steps=${["תפקיד","היקף","תצוגה מקדימה","שמירה"]} .current=${this.step}></sw-steps>
                    <sw-field label="קבוצה או תפקיד"><select><option>עורך מפות ותצוגות</option><option>מפעיל</option><option>צופה</option><option>מנהל אתר/מבנה/קומה</option></select></sw-field>
                    <sw-field label="היקף"><select><option>מבנה א · קומה 2</option><option>מבנה א</option><option>אתר הדגמה</option></select></sw-field>
                    <div class="eff">
                      <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מותר בהיקף</div><div class="row"><span>עריכת תוכנית קומה 2</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div><div class="row"><span>הצבת ציוד מורשה</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div></div>
                      <div><div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">לא ניתן</div><div class="row"><span>עריכת קומה 3</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>ניהול משתמשים / NVR</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>פתיחת מנעול</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
                    </div>
                    <div class="hint">הרשאות בתוך SMPLWISE בלבד. שום דבר לא נכתב ל־HA. השינוי ירשם באודיט עם diff לפני/אחרי.</div>
                  </div>`:n`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${e.haUser}</span></dd>
                    <dt>סנכרון אחרון</dt><dd>${e.lastSync}</dd>
                    <dt>קבוצות</dt><dd>${e.groups.join(", ")||"—"}</dd>
                    <dt>שיוכים</dt><dd>${e.bindings.length?e.bindings.map(s=>n`<div>${s.role} · ${s.scope}</div>`):"ללא: אין גישה לתוכן"}</dd>
                  </dl>
                  <div class="hint">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד VMS אוטומטית.</div>`}
              <div slot="footer">
                ${this.assigning?n`<sw-button variant="primary" size="sm" icon="check">שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.assigning=!1}>ביטול</sw-button>`:n`<sw-button variant="primary" size="sm" icon="plus" @click=${()=>{this.assigning=!0,this.step=2}}>שיוך תפקיד</sw-button><sw-button variant="ghost" size="sm" icon="shield">הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`:""}
      </div>
    `}renderGroups(){return n`<sw-table .columns=${[{key:"name",label:"קבוצה",render:s=>n`<strong>${String(s.name)}</strong>`},{key:"members",label:"חברים"},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:s=>n`${s.bindings.map(a=>n`<div>${a}</div>`)}`},{key:"more",label:"",width:"40px",render:()=>n`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]} .rows=${Gt}></sw-table><div class="hint">שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.</div>`}renderRoles(){return n`<div class="roles">${Yt.map(e=>n`<sw-card class="role"><h4><span class="ic"><sw-icon name=${e.id==="viewer"?"eye":e.id==="operator"?"play":e.id==="editor"?"edit":e.id==="site_admin"?"building":"shield"} size=${14}></sw-icon></span>${e.name}</h4><div class="a">מותר: ${e.allowed}</div><div class="d">לא ניתן אוטומטית: ${e.denied}</div></sw-card>`)}</div><div class="hint">תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>`}renderEffective(){return n`
      <sw-card heading="דנה · עורכת קומה 2">
        <div class="eff">
          <div>
            <div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מבנה א · קומה 2</div>
            ${["מפה: קריאה","תוכנית: יבוא/עריכה/פרסום","מיקומים ותצוגות: עריכה","שידור חי: מצלמות מורשות"].map(e=>n`<div class="row"><span>${e}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}
          </div>
          <div>
            <div style="font-weight:600;margin-block-end:4px;font-size:var(--sw-fs-xs)">מחוץ להיקף / לא מוקנה</div>
            ${["קומה 3: הכל","Playback וייצוא","ניהול משתמשים","הגדרות NVR / go2rtc","פתיחת מנעול"].map(e=>n`<div class="row"><span>${e}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}
          </div>
        </div>
        <div class="hint" style="margin-block-start:8px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו. permission_revision: 7.</div>
      </sw-card>
    `}renderAudit(){return n`<sw-table dense .columns=${[{key:"time",label:"זמן"},{key:"user",label:"משתמש",render:s=>n`<div class="who"><sw-avatar name=${String(s.user)} size=${24}></sw-avatar>${String(s.user)}</div>`},{key:"action",label:"פעולה"},{key:"resource",label:"משאב"},{key:"decision",label:"החלטה",render:s=>n`<sw-badge kind=${String(s.decision).startsWith("נחסם")?"forbidden":"live"} label=${String(s.decision)}></sw-badge>`},{key:"role",label:"תפקיד/היקף ששימשו"}]} .rows=${Xt.filter(s=>s.action.includes("תוכנית")||s.action.includes("סנכרון")||s.action.includes("Ingress"))}></sw-table>`}render(){return n`
      <sw-page heading="משתמשים והרשאות" subheading="זהות מ־Home Assistant · הרשאות בתוך SMPLWISE בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs .items=${on} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.</div>
        ${this.tab==="users"?this.renderUsers():this.tab==="groups"?this.renderGroups():this.tab==="roles"?this.renderRoles():this.tab==="effective"?this.renderEffective():this.renderAudit()}
      </sw-page>
    `}};ue.styles=g`
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
  `;ts([p()],ue.prototype,"tab",2);ts([p()],ue.prototype,"selected",2);ts([p()],ue.prototype,"assigning",2);ts([p()],ue.prototype,"step",2);ue=ts([b("system-access")],ue);var ln=Object.getOwnPropertyDescriptor,dn=(e,s,a,i)=>{for(var t=i>1?void 0:i?ln(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};const cn=[{key:"time",label:"זמן",render:e=>n`14.09.2026 ${String(e.time)}`},{key:"user",label:"משתמש",render:e=>n`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(e.user)} size=${24}></sw-avatar>${String(e.user)}</span>`},{key:"action",label:"פעולה",render:e=>n`<span style=${String(e.decision).startsWith("נחסם")?"color:var(--sw-danger);font-weight:600":""}>${String(e.action)}</span>`},{key:"resource",label:"פרטים",render:e=>n`${String(e.resource)} <span style="color:var(--sw-text-3)">· ${String(e.decision)}</span>`},{key:"role",label:"תפקיד / היקף"},{key:"rev",label:"rev",ltr:!0,render:()=>n`7`}];let Xs=class extends w{render(){return n`
      <sw-page heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, מקור זהות, תפקיד והיקף, החלטה, request_id, permission_revision · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
        <div class="filters">
          <sw-field><select aria-label="פעולה"><option>כל הפעולות</option><option>צפייה</option><option>שינוי</option><option>ייצוא</option><option>פעולת HA</option></select></sw-field>
          <sw-field><select aria-label="משתמש"><option>כל המשתמשים</option></select></sw-field>
          <sw-field><select aria-label="אתר"><option>כל האתרים</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <sw-chip icon="clock">שמירה: 180 יום</sw-chip>
        </div>
        <sw-table .columns=${cn} .rows=${Xt}></sw-table>
        <div class="pager">
          <span>מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop</span>
          <span class="pages"><button aria-label="קודם"><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label="הבא"><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `}};Xs.styles=g`
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
  `;Xs=dn([b("system-audit")],Xs);var pn=Object.defineProperty,hn=Object.getOwnPropertyDescriptor,ri=(e,s,a,i)=>{for(var t=i>1?void 0:i?hn(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&pn(s,a,t),t};const Ns=["גילוי","NVR","go2rtc","גשר HA","מנהל ראשון","שעון","סיום"];let bs=class extends w{constructor(){super(...arguments),this.step=0}renderStep(){switch(this.step){case 0:return n`<sw-card heading="גילוי מכשירים" subheading="חיפוש NVR ומצלמות ברשת המקומית · קריאה בלבד, ללא שינוי תצורה במכשיר">
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
        </sw-card>`;case 1:return n`<sw-card heading="חיבור ל־NVR">
          <div class="two">
            <sw-field label="כתובת"><input data-ltr placeholder="192.168.x.x" /></sw-field>
            <sw-field label="פורט HTTP"><input data-ltr value="80" /></sw-field>
            <sw-field label="משתמש"><input data-ltr placeholder="smplwise" /></sw-field>
            <sw-field label="סיסמה"><input type="password" data-ltr /></sw-field>
          </div>
          <div class="hint">מומלץ משתמש ייעודי לא־admin. בדיקת החיבור קוראת deviceInfo, time ו־capabilities בלבד.</div>
        </sw-card>`;case 2:return n`<sw-card heading="go2rtc חיצוני">
          <div class="two">
            <sw-field label="כתובת API"><input data-ltr value="http://…:1984" /></sw-field>
            <sw-field label="אימות API (מומלץ)"><input data-ltr placeholder="user:password" /></sw-field>
          </div>
          <div class="check"><span>גרסה</span><sw-badge kind="live" label="1.9.x"></sw-badge></div>
          <div class="check"><span>שמירת זרמים לקובץ ההגדרות</span><sw-badge kind="stale" label="כן: המוצר ישתמש במאגר slots קבוע"></sw-badge></div>
          <div class="check"><span>זרמים זרים (אינטרקום, מצלמות)</span><sw-badge kind="neutral" label="20 · לא ייגעו"></sw-badge></div>
        </sw-card>`;case 3:return n`<sw-card heading="גשר Home Assistant">
          <div class="check"><span>אינטגרציה מותקנת</span><sw-badge kind="live" label="smplwise_vms 0.1"></sw-badge></div>
          <div class="check"><span>Pairing</span><sw-badge kind="stale" label="ממתין לאישור מנהל HA"></sw-badge></div>
          <div class="check"><span>סנכרון משתמשים</span><sw-badge kind="unknown" label="טרם בוצע"></sw-badge></div>
          <div class="check"><span>Ingress: זהות משתמש מהכותרות</span><sw-badge kind="live" label="מאומת מול ה־proxy"></sw-badge></div>
          <div class="hint">ה־Bridge מספק קטלוג מצומצם ומבצע פעולות בשם המשתמש. אין קריאת config/auth/list מהדפדפן ואין קידום משתמשים.</div>
        </sw-card>`;case 4:return n`<sw-card heading="בחירת מנהל VMS ראשון">
          <div class="hint" style="margin-block-end:8px">מנהל HA מזוהה בוחר במפורש משתמש HA קיים. אין קידום אוטומטי לכל מנהלי HA; הבחירה נרשמת פעם אחת באודיט וה־bootstrap ננעל.</div>
          <div class="users">
            <label><input type="radio" name="admin" checked /> יוני (joni)</label>
            <label><input type="radio" name="admin" /> דנה (dana) — משתמשת רגילה ב־HA, מותר</label>
            <label><input type="radio" name="admin" /> יוסי (yossi)</label>
          </div>
        </sw-card>`;case 5:return n`<sw-card heading="פרופיל שעון">
          <div class="check"><span>אזור זמן האתר</span><span class="ltr">Asia/Jerusalem</span></div>
          <div class="check"><span>שעון NVR מול שרת</span><sw-badge kind="live" label="סטייה 2 שנ׳"></sw-badge></div>
          <div class="check"><span>פרשנות זמני חיפוש</span><sw-badge kind="stale" label="שעון מקומי (פרופיל דגם)"></sw-badge></div>
          <div class="hint">אין הזזה קבועה של שעות. שעון קיץ/חורף לפי התאריך המבוקש.</div>
        </sw-card>`;default:return n`<sw-card heading="מצלמה ומפה ראשונות">
          <div class="check"><span>ערוצים שהתגלו</span><span>10 (ללא נוסחת track)</span></div>
          <div class="check"><span>קומה ראשונה</span><span>קומה 0 · תוכנית: להעלות</span></div>
          <div class="check"><span>Add-on</span><sw-badge kind="live" label="רץ · /data מתמשך"></sw-badge></div>
          <div class="check"><span>panel_admin</span><sw-badge kind="neutral" label="false"></sw-badge></div>
          <div class="check"><span>משתמש רגיל דרך Ingress</span><sw-badge kind="stale" label="לבדיקה (T081)"></sw-badge></div>
          <div class="hint">גילוי אינו משנה תצורה במכשיר. הצבה על המפה יוצרת Binding בלבד.</div>
        </sw-card>`}}render(){return n`
      <sw-page heading="אשף התקנה" subheading="גילוי NVR ומצלמות, בדיקת זרמים, שמות וקומות · בדיקות קריאה בלבד · נתוני הדגמה">
        <div class="wrap">
          <sw-card><sw-steps .steps=${Ns} .current=${this.step}></sw-steps></sw-card>
          ${this.renderStep()}
          <div class="foot">
            <sw-button variant="ghost" ?disabled=${this.step===0} @click=${()=>this.step=Math.max(0,this.step-1)}>הקודם</sw-button>
            <div style="display:flex;gap:8px">
              <sw-button>ביטול</sw-button>
              <sw-button variant="primary" @click=${()=>this.step=Math.min(Ns.length-1,this.step+1)}>${this.step===Ns.length-1?"סיום":"הבא"}</sw-button>
            </div>
          </div>
        </div>
      </sw-page>
    `}};bs.styles=g`
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
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
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
  `;ri([p()],bs.prototype,"step",2);bs=ri([b("system-setup")],bs);var fn=Object.defineProperty,un=Object.getOwnPropertyDescriptor,N=(e,s,a,i)=>{for(var t=i>1?void 0:i?un(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&fn(s,a,t),t};const Tt=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"];let C=class extends w{constructor(){super(...arguments),this.selected=null,this.filter="all",this.cameras=null,this.recorder=null,this.canSync=!1,this.busy=!1,this.message="",this.error="",this.dialog=!1,this.formChannel=1,this.formAlias="",this.alias="",this.columns=[{key:"name",label:"מצלמה",render:e=>n`<div class="cam">${e.scene?n`<sw-scene kind=${e.scene}></sw-scene>`:n`<div class="none"></div>`}<div><b>${String(e.name)}</b><small>${String(e.sub)}</small></div></div>`},{key:"state",label:"מצב",render:e=>n`<span class="status"><i style="--c:${e.state==="live"?"var(--sw-live)":e.state==="offline"?"var(--sw-danger)":e.state==="unknown"?"var(--sw-unknown)":"var(--sw-stale)"}"></i>${e.state==="live"?"מחוברת":e.state==="offline"?"מנותקת":e.state==="stale"?"לא מעודכן":e.state==="forbidden"?"ללא הרשאה":"לא נבדק"}</span>`},{key:"fps",label:"FPS",ltr:!0},{key:"bitrate",label:"קצב",ltr:!0},{key:"firmware",label:"זרם ראשי",ltr:!0},{key:"lastEvent",label:"נראתה לאחרונה"},{key:"net",label:"רשת",render:e=>this.net(e.state==="live"?4:e.state==="stale"?2:0)},{key:"more",label:"",width:"40px",render:()=>n`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.reload()}async reload(){if(!Le()){this.cameras=null;return}try{const e=await Oa();this.cameras=e.cameras,this.recorder=e.recorder,this.canSync=e.can_sync}catch(e){this.error=z(e)}}async sync(){this.busy=!0,this.error="",this.message="";try{const e=await Aa();this.message=`סנכרון הושלם: ${e.channels} ערוצים (${e.created} חדשים, ${e.updated} עודכנו)${e.recorder.model?` · ${e.recorder.model}`:""}`,await this.reload()}catch(e){this.error=z(e)}finally{this.busy=!1}}async register(){this.busy=!0,this.error="";try{await Ca({channel:this.formChannel,alias:this.formAlias.trim()}),this.dialog=!1,await this.reload()}catch(e){this.error=z(e)}finally{this.busy=!1}}async saveAlias(e){this.busy=!0,this.error="";try{await Ea(e,{alias:this.alias.trim()||void 0}),await this.reload(),this.message="הכינוי נשמר (שם ה־NVR לא השתנה)"}catch(s){this.error=z(s)}finally{this.busy=!1}}get rows(){return this.cameras?this.cameras.map(e=>({id:e.id,name:e.name,sub:`ערוץ ${e.channel}${e.name_source&&e.alias?` · NVR: ${e.name_source}`:""}`,state:e.status==="online"?"live":e.status==="offline"?"offline":"unknown",fps:e.stream?.fps?String(e.stream.fps):"—",bitrate:e.stream?.bitrate_kbps?`${(e.stream.bitrate_kbps/1024).toFixed(1)} Mbps`:"—",firmware:e.stream?.resolution?`${e.stream.resolution} ${e.stream.codec??""}`.trim():"—",lastEvent:e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z",""):"לא נבדק",scene:e.status==="online"?Tt[(e.channel-1)%Tt.length]:null,channel:e.channel,api:e})):M.map(e=>({id:e.id,name:e.name,sub:`${e.floor} · ערוץ ${e.id.replace("cam-","")}`,state:e.state,fps:e.fps?String(e.fps):"—",bitrate:e.bitrateKbps?`${(e.bitrateKbps/1024).toFixed(1)} Mbps`:"—",firmware:e.firmware,lastEvent:e.lastEvent,scene:e.state==="offline"||e.state==="forbidden"?null:V[e.id]??"lobby",channel:Number(e.id.replace("cam-",""))}))}net(e){return d`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0,1,2,3].map(s=>d`<rect x=${s*5.5} y=${11-s*3} width="4" height=${3+s*3} rx="1" fill=${s<e?e>=3?"#22c55e":"#f59e0b":"var(--sw-border-strong)"} />`)}</svg>`}render(){const e=this.rows,s=e.filter(t=>this.filter==="all"?!0:this.filter==="online"?t.state==="live":this.filter==="offline"?t.state==="offline":t.state==="stale"||t.state==="forbidden"||t.state==="unknown"),a=e.find(t=>t.id===this.selected),i=!!this.cameras;return n`
      <sw-page heading="בריאות מצלמות" subheading=${i?`${this.recorder?.name??"NVR"}${this.recorder?.model?` · ${this.recorder.model}`:""} · ${e.length} מצלמות רשומות · גילוי לקריאה בלבד`:"NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה"}>
        ${i&&this.canSync?n`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${this.busy?"מסנכרן…":"סנכרון מה־NVR (קריאה)"}</sw-button>`:n`<sw-button slot="actions" icon="refresh" ?disabled=${i}>בדיקת יכולות (קריאה)</sw-button>`}
        ${i&&this.canSync?n`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>{this.dialog=!0,this.formAlias="",this.formChannel=(e.length?Math.max(...e.map(t=>t.channel)):0)+1}}>רישום ידני</sw-button>`:h}
        ${this.message?n`<div class="ok">${this.message}</div>`:h}
        ${this.error?n`<div class="err">${this.error}</div>`:h}
        <div class="filters">
          <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${e.length}>הכל</sw-chip>
          <sw-chip dot="#22c55e" ?selected=${this.filter==="online"} @click=${()=>this.filter="online"} count=${e.filter(t=>t.state==="live").length}>מחוברות</sw-chip>
          <sw-chip dot="#ef4444" ?selected=${this.filter==="offline"} @click=${()=>this.filter="offline"} count=${e.filter(t=>t.state==="offline").length}>מנותקות</sw-chip>
          <sw-chip dot="#f59e0b" ?selected=${this.filter==="issues"} @click=${()=>this.filter="issues"} count=${e.filter(t=>t.state!=="live"&&t.state!=="offline").length}>בעיות / לא נבדק</sw-chip>
          <span class="grow"></span>
          <sw-field style="inline-size:200px"><input type="search" placeholder="חיפוש מצלמה…" aria-label="חיפוש" /></sw-field>
        </div>
        <div class="stage">
          ${i&&!e.length?n`<sw-state-panel state="empty" heading="אין מצלמות רשומות" hint="הגדר את פרטי ה־NVR בהגדרות ה־Add-on ולחץ 'סנכרון מה־NVR', או רשום ערוץ ידנית."></sw-state-panel>`:n`<sw-table .columns=${this.columns} .rows=${s} .selected=${this.selected} @row-select=${t=>{this.selected=t.detail.id,this.alias=e.find(r=>r.id===t.detail.id)?.api?.alias??""}}></sw-table>`}
          ${a?n`<sw-drawer open heading=${a.name} subheading=${a.sub} @close=${()=>this.selected=null}>
                <sw-field label="כינוי מקומי" hint="שינוי כינוי אינו משנה OSD; שם ה־NVR נשמר בנפרד"><input .value=${i?this.alias:a.name} ?disabled=${!i||!this.canSync} @input=${t=>this.alias=t.target.value} /></sw-field>
                <dl>
                  <dt>שם ב־NVR</dt><dd>${i?a.api?.name_source||"—":`Camera ${a.channel}`}</dd>
                  <dt>Tracks</dt><dd><span class="ltr">${i?`${a.api?.main_track??"?"} / ${a.api?.sub_track??"?"}`:`${a.channel}01 / ${a.channel}02`}</span></dd>
                  <dt>מצב</dt><dd><sw-badge kind=${a.state}></sw-badge></dd>
                  <dt>נראתה לאחרונה</dt><dd>${a.lastEvent}</dd>
                </dl>
                <div class="hint">ניתוק מקור מוצג כניתוק, לא כאשמת הממשק. פעולות רגישות (אתחול, OSD) דורשות הרשאה ואישור ואינן בפיילוט.</div>
                <div slot="footer">
                  ${i&&this.canSync?n`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveAlias(a.id)}>שמור כינוי</sw-button>`:h}
                  <sw-button variant="danger" size="sm" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`:h}
        </div>
        ${i?this.recorder?n`<sw-card heading=${this.recorder.name}>
                <div class="nvr">
                  <div><span>דגם</span>${this.recorder.model??"לא נבדק"}</div>
                  <div><span>קושחה</span><span class="ltr">${this.recorder.firmware??"—"}</span></div>
                  <div><span>סנכרון אחרון</span>${this.recorder.last_seen_at?this.recorder.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</div>
                  <div><span>גישה</span>קריאה בלבד (ISAPI)</div>
                </div>
              </sw-card>`:h:n`<sw-card heading="NVR ראשי">
              <div class="nvr">
                <div><span>דגם</span>DS-76xx (הדגמה)</div>
                <div><span>קושחה</span><span class="ltr">V4.84.x</span></div>
                <div><span>ערוצים</span>10/16</div>
                <div><span>דיסק</span>1 · תקין · 30% פנוי</div>
                <div><span>שעון</span>NTP · סטייה 2 שנ׳</div>
                <div><span>חיפוש במקביל</span>1 (מגבלת מכשיר)</div>
              </div>
            </sw-card>`}
        ${this.dialog?n`<sw-dialog open heading="רישום מצלמה ידני" subheading="כשה־NVR לא מוגדר עדיין; הסנכרון יעדכן שם ומצב" @close=${()=>this.dialog=!1}>
              <sw-field label="מספר ערוץ ב־NVR"><input type="number" min="1" max="256" data-ltr .value=${String(this.formChannel)} @input=${t=>this.formChannel=Number(t.target.value)} /></sw-field>
              <sw-field label="כינוי"><input .value=${this.formAlias} @input=${t=>this.formAlias=t.target.value} placeholder="למשל: כניסה ראשית" /></sw-field>
              ${this.error?n`<div class="err">${this.error}</div>`:h}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formAlias.trim()||this.busy} @click=${()=>this.register()}>רישום</sw-button>
            </sw-dialog>`:h}
      </sw-page>
    `}};C.styles=g`
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
  `;N([p()],C.prototype,"selected",2);N([p()],C.prototype,"filter",2);N([p()],C.prototype,"cameras",2);N([p()],C.prototype,"recorder",2);N([p()],C.prototype,"canSync",2);N([p()],C.prototype,"busy",2);N([p()],C.prototype,"message",2);N([p()],C.prototype,"error",2);N([p()],C.prototype,"dialog",2);N([p()],C.prototype,"formChannel",2);N([p()],C.prototype,"formAlias",2);N([p()],C.prototype,"alias",2);C=N([b("system-devices")],C);var wn=Object.defineProperty,vn=Object.getOwnPropertyDescriptor,ni=(e,s,a,i)=>{for(var t=i>1?void 0:i?vn(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&wn(s,a,t),t};const bn=[{id:"general",label:"כללי"},{id:"media",label:"וידאו ומדיה"},{id:"health",label:"בריאות ועבודות"},{id:"backup",label:"גיבוי ושחזור"},{id:"support",label:"תמיכה"}];let gs=class extends w{constructor(){super(...arguments),this.tab="general"}renderGeneral(){return n`<div class="sections">
      <sw-card heading="זמן ומיקום">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>(UTC+02:00) Asia/Jerusalem</option></select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>
        <div class="row"><span class="lbl">NTP במכשיר<span class="muted">pool.ntp.org · סטייה 2 שנ׳</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="מדיניות אחסון (קריאה מה־NVR)">
        <div class="row"><span class="lbl">שמירת הקלטות</span><sw-field class="ctl"><select disabled><option>לפי מקום פנוי (overwrite)</option></select></sw-field></div>
        <div class="row"><span class="lbl">כשהאחסון מתמלא</span><sw-field class="ctl"><select disabled><option>דריסת הישן ביותר</option></select></sw-field></div>
        <div class="row"><span class="lbl">התראת אחסון נמוך<span class="muted">מתחת ל־10% פנוי</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">מאגר slots בשם smplwise_* · זרמים זרים לא ייגעו</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm">הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Home Assistant<span class="muted">קטלוג ישויות ופעולות בשם המשתמש</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm">הגדרה</sw-button></span></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">
        <div class="row"><span class="health"><i class="dot"></i><span class="lbl">מצב חלקי<span class="muted">גשר HA לא רענן · 1 מצלמה מנותקת · שאר הרכיבים תקינים</span></span></span><sw-button size="sm" icon="activity">הרצת דיאגנוסטיקה</sw-button></div>
      </sw-card>
    </div>`}renderMedia(){return n`<div class="sections">
      <sw-card heading="מדיה">
        <div class="row"><span class="lbl">כתובת go2rtc</span><sw-field class="ctl"><input data-ltr value="http://…:1984" /></sw-field></div>
        <div class="row"><span class="lbl">מאגר slots לניגון</span><sw-field class="ctl"><input data-ltr value="4" /></sw-field></div>
        <div class="row"><span class="lbl">WebRTC ברשת מקומית</span><sw-toggle checked label="מופעל"></sw-toggle></div>
        <div class="row"><span class="lbl">נפילה ל־MSE דרך Cloudflare</span><sw-toggle checked label="מופעל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="תקציבים ומגבלות">
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל</span><sw-field class="ctl"><input data-ltr value="8" /></sw-field></div>
        <div class="row"><span class="lbl">חיפושי NVR במקביל<span class="muted">מגבלת המכשיר: 1</span></span><sw-field class="ctl"><input data-ltr value="1" /></sw-field></div>
        <div class="row"><span class="lbl">תקרת ייצוא</span><sw-field class="ctl"><input data-ltr value="2 GB" /></sw-field></div>
      </sw-card>
    </div>`}renderHealth(){return n`<div class="sections">
      <sw-card heading="מצבים נפרדים, לא נורה אחת">${Zt.map(e=>n`<div class="row"><span class="lbl">${e.name}<span class="muted">${e.detail}</span></span><sw-badge kind=${e.state}></sw-badge></div>`)}
        <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
        <div class="row"><span class="lbl">זרמים פעילים<span class="muted">4 חיים · 1 ניגון · 0 יתומים</span></span><sw-badge kind="live"></sw-badge></div>
      </sw-card>
      <sw-card heading="תור עבודות">${Jt.map(e=>n`<div class="row"><span class="lbl">${e.title}<span class="muted">${e.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${e.status.startsWith("נכשל")?"fail":""}"><i style="--p:${e.progress}%"></i></span><span class="ltr">${e.progress}%</span></span></div>`)}</sw-card>
    </div>`}renderBackup(){return n`<div class="sections">
      <sw-card heading="גיבוי">
        <div class="row"><span class="lbl">גיבוי אחרון</span><span>אתמול 02:00 · 48 MB</span></div>
        <div class="row"><span class="lbl">תוכן</span><span class="muted">DB, מקורות תוכניות, גרסאות, עוגנים, חוקים, הגדרות</span></div>
        <div class="row"><span class="lbl">סודות וראיות</span><span class="muted">מדיניות נפרדת</span></div>
        <div class="foot"><sw-button variant="primary" icon="download">גיבוי עכשיו</sw-button><sw-button icon="upload">שחזור</sw-button></div>
      </sw-card>
      <sw-card heading="שדרוג ו־Rollback">
        <div class="row"><span class="lbl">גרסת Add-on</span><span class="ltr">0.1.0</span></div>
        <div class="row"><span class="lbl">סכימת DB</span><span class="ltr">3</span></div>
        <div class="row"><span class="lbl">Rollback</span><span class="muted">דרך HA + שחזור גיבוי</span></div>
      </sw-card>
    </div>`}renderSupport(){return n`<div class="sections"><sw-card heading="חבילת תמיכה מצונזרת">
      <div class="muted" style="padding-block-end:8px">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span class="lbl">כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span class="lbl">כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" icon="download">יצירת חבילה</sw-button></div>
    </sw-card></div>`}render(){return n`
      <sw-page heading="הגדרות המערכת" subheading="אזור זמן, מדיניות אחסון, אינטגרציות ובריאות · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="check">שמור שינויים</sw-button>
        <sw-tabs underline .items=${bn} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        ${this.tab==="general"?this.renderGeneral():this.tab==="media"?this.renderMedia():this.tab==="health"?this.renderHealth():this.tab==="backup"?this.renderBackup():this.renderSupport()}
      </sw-page>
    `}};gs.styles=g`
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
    @media (max-width: 767px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row .ctl {
        inline-size: auto;
      }
    }
  `;ni([p()],gs.prototype,"tab",2);gs=ni([b("system-diagnostics")],gs);var gn=Object.defineProperty,mn=Object.getOwnPropertyDescriptor,oi=(e,s,a,i)=>{for(var t=i>1?void 0:i?mn(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&gn(s,a,t),t};const xn=[{name:"כניסה ראשית",gb:320},{name:"אולם",gb:410},{name:"חצר אחורית",gb:380},{name:"לובי",gb:180},{name:"מחסן",gb:96}];let ms=class extends w{constructor(){super(...arguments),this.range="30D"}render(){const e=[.3,.36,.45,.5,.58,.63,.7],s=600,a=200,i=m=>m/(e.length-1)*420,t=m=>170-m*150,r=e.map((m,u)=>`${u===0?"M":"L"}${i(u)} ${t(m)}`).join(" "),o=`M${i(e.length-1)} ${t(.7)} L520 ${t(.86)} L${s} ${t(1)}`,l=16,f=2*Math.PI*l,y=410;return n`
      <sw-page heading="אנליטיקת אחסון" subheading="Beta · ניטור שימוש, תכנון קדימה ושליטה · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה">
        <div slot="actions" style="display:flex;gap:4px">${["7D","30D","90D","1Y"].map(m=>n`<sw-chip ?selected=${this.range===m} @click=${()=>this.range=m}>${m}</sw-chip>`)}</div>
        <div class="kpis">
          <sw-card flush class="kpi"><div><div class="v">1.3 TB</div><div class="l">אחסון בשימוש (נמדד)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">1.9 TB</div><div class="l">קיבולת כוללת</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">68%</div><div class="l">ניצולת · ≈ 11 ימים נשמרים</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${d`<circle cx="20" cy="20" r=${l} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${l} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${f*.68} ${f}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
        </div>
        <sw-card heading="תחזית שימוש באחסון" subheading="עד הקו: נתון נמדד · אחרי הקו: אומדן (אינו תחזית פשוטה של דיסק מתמלא)">
          <svg class="trend" viewBox="0 0 ${s} ${a}" preserveAspectRatio="none" role="img" aria-label="תחזית אחסון">
            ${d`
              ${[.25,.5,.75,1].map(m=>d`<line x1="0" x2=${s} y1=${t(m)} y2=${t(m)} stroke="var(--sw-border)" />`)}
              <path d="${r} L${i(e.length-1)} 170 L0 170 Z" fill="var(--sw-accent-soft)" />
              <path d="${r}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" />
              <path d="${o}" fill="none" stroke="var(--sw-accent)" stroke-width="2" stroke-dasharray="5 5" opacity="0.7" />
              <line x1=${i(e.length-1)} x2=${i(e.length-1)} y1="10" y2="170" stroke="var(--sw-stale)" stroke-dasharray="4 4" />
              <rect x="470" y="18" width="110" height="34" rx="6" fill="#fff" stroke="var(--sw-border)" />
              <text x="525" y="32" font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">אומדן מילוי</text>
              <text x="525" y="46" font-size="11" font-weight="600" text-anchor="middle" fill="var(--sw-text)" font-family="var(--sw-font)">≈ 25.09.2026</text>
              ${["ינו","פבר","מרץ","אפר","מאי","יונ","יול"].map((m,u)=>d`<text x=${i(u)} y="190" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${m}</text>`)}
              ${["0.5 TB","1 TB","1.5 TB","1.9 TB"].map((m,u)=>d`<text x="4" y=${t(.25*(u+1))-3} font-size="9.5" fill="var(--sw-text-3)" font-family="var(--sw-font)">${m}</text>`)}
            `}
          </svg>
        </sw-card>
        <div class="grid">
          <sw-card heading="שימוש באחסון לפי מצלמה" subheading="נמדד · לפני retention">
            ${xn.map(m=>n`<div class="cam"><span>${m.name}</span><span class="bar"><i style="--p:${m.gb/y*100}%"></i></span><span class="gb ltr">${m.gb} GB</span></div>`)}
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
    `}};ms.styles=g`
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
  `;oi([p()],ms.prototype,"range",2);ms=oi([b("system-storage")],ms);var yn=Object.getOwnPropertyDescriptor,$n=(e,s,a,i)=>{for(var t=i>1?void 0:i?yn(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};const kn=[{mode:"סקירה ומצלמות",items:[{sc:"SC01",name:"סקירה (Dashboard)",route:"#/live",phase:"PILOT",board:"1:01 · 2:15"},{sc:"SC07",name:"כל המצלמות (Grid)",route:"#/live/wall",phase:"PILOT",board:"1:06"},{sc:"SC08",name:"מצלמה בודדת",route:"#/live/cameras/cam-4",phase:"PILOT",board:"1:05"},{sc:"SC09",name:"תצוגות שמורות",route:"#/live/views",phase:"PILOT",board:"legacy"},{sc:"SC27",name:"בריאות מצלמות",route:"#/system/devices",phase:"PILOT",board:"2:12"},{sc:"SC31",name:"קיוסק / תצוגת קיר",route:"#/kiosk/all",phase:"BETA",board:"3:24"}]},{mode:"אתרים ומפות",items:[{sc:"SC02",name:"אתרים ומבנים",route:"#/explore/sites",phase:"PILOT",board:"1:02 · 3:17"},{sc:"SC03",name:"דפדפן קומות",route:"#/explore/buildings/bld-a/floors",phase:"PILOT",board:"1:03"},{sc:"SC04",name:"מפת קומה חיה",route:"#/explore/floors/f0",phase:"PILOT",board:"1:04"},{sc:"SC05",name:"ייבוא ותיקון תוכנית",route:"#/explore/floors/f-2/import",phase:"PILOT",board:"2:13"},{sc:"SC06",name:"עורך תוכנית ועוגנים",route:"#/explore/floors/f0/edit",phase:"PILOT",board:"2:13"},{sc:"SC10",name:"קטלוג ישויות HA",route:"#/explore/entities",phase:"PILOT",board:"new"},{sc:"SC23",name:"דלתות ואינטרקום",route:"#/explore/access/d1",phase:"V1",board:"3:18"}]},{mode:"אירועים והקלטות",items:[{sc:"SC14",name:"מרכז אירועים",route:"#/investigate/events",phase:"PILOT",board:"1:08"},{sc:"SC12",name:"הקלטות / ציר זמן",route:"#/investigate/playback",phase:"PILOT",board:"1:07 · 2:16"},{sc:"SC13",name:"מרכז שליטה / ניגון מסונכרן",route:"#/investigate/playback/sync",phase:"BETA",board:"2:14"},{sc:"SC11",name:"מפה היסטורית",route:"#/investigate/floors/f0/history",phase:"PILOT",board:"new"},{sc:"SC15",name:"תור Review",route:"#/investigate/reviews",phase:"BETA",board:"legacy"},{sc:"SC16",name:"תיקים",route:"#/investigate/cases",phase:"BETA",board:"2:10"},{sc:"SC17",name:"סקירת אירוע / תיק",route:"#/investigate/cases/case-1",phase:"BETA",board:"2:10"},{sc:"SC18",name:"ייצוא והורדות",route:"#/investigate/exports",phase:"BETA",board:"2:10"},{sc:"SC19",name:"חיפוש AI",route:"#/investigate/search",phase:"BETA",board:"2:09"},{sc:"SC21",name:"התראות וחוקים",route:"#/investigate/rules",phase:"BETA",board:"3:19"},{sc:"SC22",name:"עורך חוק",route:"#/investigate/rules/r-1",phase:"BETA",board:"3:19"}]},{mode:"הגדרות",items:[{sc:"SC28",name:"הגדרות המערכת",route:"#/system/diagnostics",phase:"PILOT",board:"3:23"},{sc:"SC24",name:"משתמשים והרשאות",route:"#/system/access",phase:"PILOT",board:"3:20"},{sc:"SC25",name:"יומן אודיט",route:"#/system/audit",phase:"PILOT",board:"3:21"},{sc:"SC20",name:"אנליטיקת אחסון",route:"#/system/storage",phase:"BETA",board:"2:11"},{sc:"SC26",name:"אשף התקנה",route:"#/system/setup",phase:"PILOT",board:"3:22"}]}],zn={PILOT:"live",BETA:"recorded",V1:"neutral"};let Js=class extends w{render(){return n`
      <sw-page heading="כל המסכים (סקירת עיצוב)" subheading="29 מסכים על נתוני הדגמה · SC29/SC30 הם אותם מסכים ברוחב טלפון · SC32 (Lovelace) הוא עטיפה של אותם רכיבים">
        <div class="note">כל מסך מסומן ״נתוני הדגמה״. שום זרם וידאו, תמונה או מצב מכשיר אינם אמיתיים כאן (הסצנות מאוירות); המטרה היא לאשר את השפה החזותית, הניווט והזרימות לפני החיבור לנתונים.</div>
        <div class="groups">
          ${kn.map(e=>n`<sw-card heading=${e.mode}>
              ${e.items.map(s=>n`<a href=${s.route}><span class="sc">${s.sc}</span><span class="name">${s.name}</span><span class="board">${s.board}</span><sw-badge kind=${zn[s.phase]} label=${s.phase}></sw-badge><sw-icon name="chevron" size=${12}></sw-icon></a>`)}
            </sw-card>`)}
        </div>
      </sw-page>
    `}};Js.styles=g`
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
  `;Js=$n([b("screens-index")],Js);var _n=Object.getOwnPropertyDescriptor,Pn=(e,s,a,i)=>{for(var t=i>1?void 0:i?_n(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=o(t)||t);return t};const Mn=[["--sw-bg","רקע"],["--sw-surface","משטח"],["--sw-surface-3","משטח 3"],["--sw-border","גבול"],["--sw-text","טקסט"],["--sw-text-2","טקסט משני"],["--sw-text-3","טקסט שלישי"],["--sw-accent","כחול"],["--sw-accent-soft","כחול רך"],["--sw-live","חי"],["--sw-offline","מנותק"],["--sw-stale","מיושן"],["--sw-danger","שגיאה"],["--sw-purple","סגול (דלת)"]],Sn=["live","recorded","historic","offline","stale","partial","unknown","forbidden","error"],On=["loading","empty","error","forbidden","stale","partial"],An=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night","building","house"],Cn=["dashboard","building","camera","bell","history","system","search","user","play","pause","back10","forward10","aperture","volume","mic","expand","close","chevron","chevronDown","warning","info","lock","unlock","offline","refresh","layers","floor","plus","minus","fit","door","light","sensor","check","clock","download","pin","more","map","upload","list","target","filter","users","shield","storage","edit","case","rule","link","grid","home","star","calendar","trash","eye","cpu","activity","image","wifi","signal","move","bookmark","route"];let Zs=class extends w{render(){return n`
      <h2>ספריית רכיבים ו־tokens (v3)</h2>
      <p class="lead">מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. ממשק קומפקטי (12px), משטחים לבנים על רקע קריר, מחיצות דקות, כחול אחד במשורה, ירוק רק ל"מחובר", צל שקט, סצנות מאוירות עד חיבור זרמים.</p>

      <h3>צבעים</h3>
      <div class="swatches">
        ${Mn.map(([e,s])=>n`<div class="swatch"><div class="c" style="background:var(${e})"></div><div class="n"><span>${s}</span><span class="ltr">${e}</span></div></div>`)}
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
      <div class="scenes">${An.map(e=>n`<div><sw-scene kind=${e}></sw-scene><span>${e}</span></div>`)}</div>

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
      <div class="row">${Sn.map(e=>n`<sw-badge kind=${e}></sw-badge>`)}</div>

      <h3>ציר זמן, שלבים, קומות איזומטריות</h3>
      <sw-timeline .segments=${hs} .events=${[{minute:614,kind:"person",label:"אדם"},{minute:582,kind:"vehicle",label:"רכב"}]} .cursor=${615}></sw-timeline>
      <div class="row" style="margin-block-start:10px">
        <sw-card style="flex:1;min-inline-size:280px"><sw-steps .steps=${["גילוי","הגדרה","בדיקה","סיום"]} .current=${1}></sw-steps></sw-card>
        <sw-floor-iso .rooms=${Ts("f0")} selected></sw-floor-iso>
        <sw-floor-iso .rooms=${Ts("f-1")}></sw-floor-iso>
        <sw-floor-iso empty></sw-floor-iso>
      </div>

      <h3>מצבי מסך</h3>
      <div class="grid">
        ${On.map(e=>n`<div class="panel"><sw-state-panel state=${e} actionLabel=${e==="error"?"נסה שוב":""}></sw-state-panel></div>`)}
      </div>

      <h3>אייקונים</h3>
      <div class="icons">${Cn.map(e=>n`<div class="icon"><sw-icon .name=${e} size=${18}></sw-icon><span class="ltr">${e}</span></div>`)}</div>
    `}};Zs.styles=g`
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
  `;Zs=Pn([b("styleguide-screen")],Zs);const Ht=[{id:"overview",icon:"dashboard",label:"סקירה",href:"#/live"},{id:"sites",icon:"building",label:"אתרים",href:"#/explore/sites"},{id:"cameras",icon:"camera",label:"מצלמות",href:"#/live/wall"},{id:"events",icon:"bell",label:"אירועים",href:"#/investigate/events"},{id:"playback",icon:"history",label:"הקלטות",href:"#/investigate/playback"},{id:"settings",icon:"system",label:"הגדרות",href:"#/system/diagnostics"}],En={overview:[],sites:[{id:"sites",label:"אתרים ומבנים",href:"#/explore/sites"},{id:"floors",label:"מפת קומה",href:"#/explore/floors/f0"},{id:"entities",label:"ישויות HA",href:"#/explore/entities"},{id:"access",label:"דלתות ואינטרקום",href:"#/explore/access/d1"}],cameras:[{id:"wall",label:"כל המצלמות",href:"#/live/wall"},{id:"views",label:"תצוגות שמורות",href:"#/live/views"},{id:"devices",label:"בריאות מצלמות",href:"#/system/devices"}],events:[{id:"events",label:"מרכז אירועים",href:"#/investigate/events"},{id:"reviews",label:"Review",href:"#/investigate/reviews"},{id:"search",label:"חיפוש",href:"#/investigate/search"},{id:"cases",label:"תיקים",href:"#/investigate/cases"},{id:"rules",label:"חוקים והתראות",href:"#/investigate/rules"},{id:"exports",label:"ייצוא",href:"#/investigate/exports"}],playback:[{id:"playback",label:"הקלטות",href:"#/investigate/playback"},{id:"sync",label:"ניגון מסונכרן",href:"#/investigate/playback/sync"},{id:"history",label:"מפה היסטורית",href:"#/investigate/floors/f0/history"}],settings:[{id:"general",label:"כללי",href:"#/system/diagnostics"},{id:"access",label:"משתמשים והרשאות",href:"#/system/access"},{id:"audit",label:"אודיט",href:"#/system/audit"},{id:"storage",label:"אחסון",href:"#/system/storage"},{id:"setup",label:"אשף התקנה",href:"#/system/setup"}]};function li(e){if(!e?.mode)return null;const s=e.segments;switch(e.mode){case"live":return s.length===1?"overview":"cameras";case"explore":return"sites";case"investigate":return!s[1]||s[1]==="playback"||s[1]==="floors"?"playback":"events";case"system":return s[1]==="devices"?"cameras":"settings";default:return null}}function In(e){const s=li(e);if(!s||!e)return"";const a=e.segments;switch(s){case"sites":return a[1]==="buildings"||a[1]==="floors"?"floors":a[1]==="entities"?"entities":a[1]==="access"?"access":"sites";case"cameras":return e.mode==="system"?"devices":a[1]==="views"?"views":"wall";case"events":return a[1]??"events";case"playback":return a[1]==="floors"?"history":a[2]==="sync"?"sync":"playback";case"settings":return!a[1]||a[1]==="diagnostics"?"general":a[1];default:return""}}var Dn=Object.defineProperty,Nn=Object.getOwnPropertyDescriptor,ft=(e,s,a,i)=>{for(var t=i>1?void 0:i?Nn(s,a):s,r=e.length-1,o;r>=0;r--)(o=e[r])&&(t=(i?o(s,a,t):o(t))||t);return i&&t&&Dn(s,a,t),t};let Ke=class extends w{constructor(){super(...arguments),this.route=null,this.session={mode:"loading",me:null,error:null}}connectedCallback(){super.connectedCallback(),this.stopSession=xa(e=>this.session=e),ya(),this.stopRouter=va(e=>{this.route=e,this.toggleAttribute("data-kiosk",e.segments[0]==="kiosk")})}disconnectedCallback(){super.disconnectedCallback(),this.stopRouter?.(),this.stopSession?.()}renderGate(){const e=this.session;return e.mode==="unauthenticated"?n`<div class="gate"><sw-state-panel state="forbidden" heading="הזדהות דרך Home Assistant נדרשת" hint=${e.error??""}></sw-state-panel></div>`:e.mode==="no_access"?n`<div class="gate"><sw-state-panel state="forbidden" heading="אין לך עדיין תפקיד במערכת" hint="המשתמש ${e.me?.user.display_name||e.me?.user.username||""} מזוהה מ־Home Assistant, אך מנהל ה־VMS טרם שייך לו תפקיד והיקף. פנה למנהל המערכת."></sw-state-panel></div>`:null}renderScreen(){const e=this.route;if(!e)return h;const s=e.segments;if(s[0]==="styleguide")return n`<styleguide-screen></styleguide-screen>`;if(s[0]==="screens")return n`<screens-index></screens-index>`;if(s[0]==="kiosk")return n`<kiosk-wall></kiosk-wall>`;switch(e.mode){case"live":return s[1]==="wall"?n`<live-wall></live-wall>`:s[1]==="views"?n`<live-views></live-views>`:s[1]==="cameras"?n`<live-camera .cameraId=${s[2]??"cam-1"}></live-camera>`:n`<live-overview></live-overview>`;case"investigate":return s[1]==="playback"&&s[2]==="sync"?n`<investigate-sync></investigate-sync>`:s[1]==="playback"?n`<investigate-playback></investigate-playback>`:s[1]==="floors"?n`<investigate-history-map .floorId=${s[2]??"f0"}></investigate-history-map>`:s[1]==="events"?n`<investigate-events></investigate-events>`:s[1]==="reviews"?n`<investigate-reviews></investigate-reviews>`:s[1]==="cases"&&s[2]?n`<investigate-case-detail .caseId=${s[2]}></investigate-case-detail>`:s[1]==="cases"?n`<investigate-cases></investigate-cases>`:s[1]==="exports"?n`<investigate-exports></investigate-exports>`:s[1]==="search"?n`<investigate-search></investigate-search>`:s[1]==="rules"&&s[2]?n`<investigate-rule-editor .ruleId=${s[2]}></investigate-rule-editor>`:s[1]==="rules"?n`<investigate-rules></investigate-rules>`:n`<investigate-playback></investigate-playback>`;case"system":return s[1]==="audit"?n`<system-audit></system-audit>`:s[1]==="setup"?n`<system-setup></system-setup>`:s[1]==="devices"?n`<system-devices></system-devices>`:s[1]==="storage"?n`<system-storage></system-storage>`:s[1]==="access"?n`<system-access></system-access>`:n`<system-diagnostics></system-diagnostics>`;case"explore":default:{if(s[1]==="sites")return n`<explore-sites></explore-sites>`;if(s[1]==="buildings")return n`<explore-floors .buildingId=${s[2]??"bld-a"}></explore-floors>`;if(s[1]==="entities")return n`<explore-entities></explore-entities>`;if(s[1]==="access")return n`<explore-access></explore-access>`;if(s[1]==="floors"&&s[3]==="import")return n`<explore-plan-import .floorId=${s[2]}></explore-plan-import>`;if(s[1]==="floors"&&s[3]==="edit")return n`<explore-plan-editor .floorId=${s[2]}></explore-plan-editor>`;const a=s[1]==="floors"&&s[2]?s[2]:"f0",i=e.params.get("state")??"ready";return n`<explore-floor-map .floorId=${a} .screenState=${i}></explore-floor-map>`}}}render(){if(this.route?.segments[0]==="kiosk")return n`<main style="block-size:100dvh">${this.renderScreen()}</main>`;const s=li(this.route),a=s?En[s]:[],i=this.route?.segments[3]==="edit"||this.route?.segments[3]==="import";return n`
      <nav class="rail" aria-label="ניווט ראשי">
        <div class="brand">
          <img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" />
          <span class="name">SmplWise</span>
        </div>
        ${Ht.map(t=>n`<a class=${Ie({item:!0,active:s===t.id})} href=${t.href} title=${t.label} aria-current=${s===t.id?"page":"false"}>
            <sw-icon .name=${t.icon} size=${16}></sw-icon><span>${t.label}</span>
          </a>`)}
        <div class="grow"></div>
        <a class=${Ie({item:!0,small:!0,active:this.route?.segments[0]==="screens"})} href="#/screens" title="כל המסכים">
          <sw-icon name="list" size=${14}></sw-icon><span>כל המסכים</span>
        </a>
        <a class=${Ie({item:!0,small:!0,active:this.route?.segments[0]==="styleguide"})} href="#/styleguide" title=${v("nav.styleguide")}>
          <sw-icon name="layers" size=${14}></sw-icon><span>${v("nav.styleguide")}</span>
        </a>
      </nav>
      <header class="topbar">
        <span class="brand-mobile"><img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" /></span>
        <label class="search"><sw-icon name="search" size=${14}></sw-icon><input type="search" placeholder=${v("app.search")} aria-label=${v("app.search")} /></label>
        <span class="spacer"></span>
        ${this.session.mode==="api"||this.session.mode==="no_access"?n`<span class="who"><b>${this.session.me?.user.display_name||this.session.me?.user.username}</b>${this.session.me?.bindings[0]?n`<span>· ${this.session.me.bindings[0].role_name}</span>`:h}</span>`:this.session.mode==="demo"?n`<sw-badge kind="neutral" label="נתוני הדגמה"></sw-badge>`:h}
        <sw-button class="bell" variant="ghost" size="sm" iconOnly icon="bell" label=${v("app.notifications")}></sw-button>
        <sw-avatar name=${this.session.me?.user.display_name||this.session.me?.user.username||"יוני"} size=${28} title=${v("app.account")} aria-label=${v("app.account")}></sw-avatar>
      </header>
      <main>
        ${this.renderGate()||n`
          <div class="subnav">${a.length>1&&!i?n`<sw-tabs .items=${a} .active=${In(this.route)}></sw-tabs>`:h}</div>
          <div class="screen">${this.session.mode==="loading"?h:this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${Ht.slice(0,4).map(t=>n`<a class=${Ie({active:s===t.id})} href=${t.href}><sw-icon .name=${t.icon} size=${20}></sw-icon>${t.label}</a>`)}
        <a class=${Ie({active:s==="settings"||s==="playback"})} href="#/system/diagnostics"><sw-icon name="more" size=${20}></sw-icon>עוד</a>
      </nav>
    `}};Ke.styles=g`
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
  `;ft([p()],Ke.prototype,"route",2);ft([p()],Ke.prototype,"session",2);Ke=ft([b("sw-app")],Ke);
//# sourceMappingURL=index-dmvZiESm.js.map
