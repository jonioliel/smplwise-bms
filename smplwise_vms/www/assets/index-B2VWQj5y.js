(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function s(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=s(a);fetch(a.href,n)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Tt=globalThis,Cs=Tt.ShadowRoot&&(Tt.ShadyCSS===void 0||Tt.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Es=Symbol(),Ws=new WeakMap;let bi=class{constructor(t,s,i){if(this._$cssResult$=!0,i!==Es)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=s}get styleSheet(){let t=this.o;const s=this.t;if(Cs&&t===void 0){const i=s!==void 0&&s.length===1;i&&(t=Ws.get(s)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Ws.set(s,t))}return t}toString(){return this.cssText}};const Yi=e=>new bi(typeof e=="string"?e:e+"",void 0,Es),v=(e,...t)=>{const s=e.length===1?e[0]:t.reduce((i,a,n)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(a)+e[n+1],e[0]);return new bi(s,e,Es)},Zi=(e,t)=>{if(Cs)e.adoptedStyleSheets=t.map(s=>s instanceof CSSStyleSheet?s:s.styleSheet);else for(const s of t){const i=document.createElement("style"),a=Tt.litNonce;a!==void 0&&i.setAttribute("nonce",a),i.textContent=s.cssText,e.appendChild(i)}},Fs=Cs?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let s="";for(const i of t.cssRules)s+=i.cssText;return Yi(s)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Xi,defineProperty:Qi,getOwnPropertyDescriptor:ea,getOwnPropertyNames:ta,getOwnPropertySymbols:sa,getPrototypeOf:ia}=Object,Yt=globalThis,qs=Yt.trustedTypes,aa=qs?qs.emptyScript:"",ra=Yt.reactiveElementPolyfillSupport,at=(e,t)=>e,Ht={toAttribute(e,t){switch(t){case Boolean:e=e?aa:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let s=e;switch(t){case Boolean:s=e!==null;break;case Number:s=e===null?null:Number(e);break;case Object:case Array:try{s=JSON.parse(e)}catch{s=null}}return s}},Is=(e,t)=>!Xi(e,t),Ks={attribute:!0,type:String,converter:Ht,reflect:!1,useDefault:!1,hasChanged:Is};Symbol.metadata??=Symbol("metadata"),Yt.litPropertyMetadata??=new WeakMap;let He=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,s=Ks){if(s.state&&(s.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((s=Object.create(s)).wrapped=!0),this.elementProperties.set(t,s),!s.noAccessor){const i=Symbol(),a=this.getPropertyDescriptor(t,i,s);a!==void 0&&Qi(this.prototype,t,a)}}static getPropertyDescriptor(t,s,i){const{get:a,set:n}=ea(this.prototype,t)??{get(){return this[s]},set(o){this[s]=o}};return{get:a,set(o){const l=a?.call(this);n?.call(this,o),this.requestUpdate(t,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Ks}static _$Ei(){if(this.hasOwnProperty(at("elementProperties")))return;const t=ia(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(at("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(at("properties"))){const s=this.properties,i=[...ta(s),...sa(s)];for(const a of i)this.createProperty(a,s[a])}const t=this[Symbol.metadata];if(t!==null){const s=litPropertyMetadata.get(t);if(s!==void 0)for(const[i,a]of s)this.elementProperties.set(i,a)}this._$Eh=new Map;for(const[s,i]of this.elementProperties){const a=this._$Eu(s,i);a!==void 0&&this._$Eh.set(a,s)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const s=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const a of i)s.unshift(Fs(a))}else t!==void 0&&s.push(Fs(t));return s}static _$Eu(t,s){const i=s.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,s=this.constructor.elementProperties;for(const i of s.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Zi(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,s,i){this._$AK(t,i)}_$ET(t,s){const i=this.constructor.elementProperties.get(t),a=this.constructor._$Eu(t,i);if(a!==void 0&&i.reflect===!0){const n=(i.converter?.toAttribute!==void 0?i.converter:Ht).toAttribute(s,i.type);this._$Em=t,n==null?this.removeAttribute(a):this.setAttribute(a,n),this._$Em=null}}_$AK(t,s){const i=this.constructor,a=i._$Eh.get(t);if(a!==void 0&&this._$Em!==a){const n=i.getPropertyOptions(a),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:Ht;this._$Em=a;const l=o.fromAttribute(s,n.type);this[a]=l??this._$Ej?.get(a)??l,this._$Em=null}}requestUpdate(t,s,i,a=!1,n){if(t!==void 0){const o=this.constructor;if(a===!1&&(n=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??Is)(n,s)||i.useDefault&&i.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,s,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,s,{useDefault:i,reflect:a,wrapped:n},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??s??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(s=void 0),this._$AL.set(t,s)),a===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(s){Promise.reject(s)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[a,n]of this._$Ep)this[a]=n;this._$Ep=void 0}const i=this.constructor.elementProperties;if(i.size>0)for(const[a,n]of i){const{wrapped:o}=n,l=this[a];o!==!0||this._$AL.has(a)||l===void 0||this.C(a,void 0,n,l)}}let t=!1;const s=this._$AL;try{t=this.shouldUpdate(s),t?(this.willUpdate(s),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(s)):this._$EM()}catch(i){throw t=!1,this._$EM(),i}t&&this._$AE(s)}willUpdate(t){}_$AE(t){this._$EO?.forEach(s=>s.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(s=>this._$ET(s,this[s])),this._$EM()}updated(t){}firstUpdated(t){}};He.elementStyles=[],He.shadowRootOptions={mode:"open"},He[at("elementProperties")]=new Map,He[at("finalized")]=new Map,ra?.({ReactiveElement:He}),(Yt.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ts=globalThis,Js=e=>e,Lt=Ts.trustedTypes,Gs=Lt?Lt.createPolicy("lit-html",{createHTML:e=>e}):void 0,gi="$lit$",be=`lit$${Math.random().toFixed(9).slice(2)}$`,yi="?"+be,na=`<${yi}>`,Pe=document,nt=()=>Pe.createComment(""),ot=e=>e===null||typeof e!="object"&&typeof e!="function",Ds=Array.isArray,oa=e=>Ds(e)||typeof e?.[Symbol.iterator]=="function",ds=`[ 	
\f\r]`,Qe=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Ys=/-->/g,Zs=/>/g,Se=RegExp(`>|${ds}(?:([^\\s"'>=/]+)(${ds}*=${ds}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Xs=/'/g,Qs=/"/g,xi=/^(?:script|style|textarea|title)$/i,$i=e=>(t,...s)=>({_$litType$:e,strings:t,values:s}),r=$i(1),c=$i(2),Ae=Symbol.for("lit-noChange"),p=Symbol.for("lit-nothing"),ei=new WeakMap,Me=Pe.createTreeWalker(Pe,129);function ki(e,t){if(!Ds(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return Gs!==void 0?Gs.createHTML(t):t}const la=(e,t)=>{const s=e.length-1,i=[];let a,n=t===2?"<svg>":t===3?"<math>":"",o=Qe;for(let l=0;l<s;l++){const u=e[l];let $,b,y=-1,M=0;for(;M<u.length&&(o.lastIndex=M,b=o.exec(u),b!==null);)M=o.lastIndex,o===Qe?b[1]==="!--"?o=Ys:b[1]!==void 0?o=Zs:b[2]!==void 0?(xi.test(b[2])&&(a=RegExp("</"+b[2],"g")),o=Se):b[3]!==void 0&&(o=Se):o===Se?b[0]===">"?(o=a??Qe,y=-1):b[1]===void 0?y=-2:(y=o.lastIndex-b[2].length,$=b[1],o=b[3]===void 0?Se:b[3]==='"'?Qs:Xs):o===Qs||o===Xs?o=Se:o===Ys||o===Zs?o=Qe:(o=Se,a=void 0);const _=o===Se&&e[l+1].startsWith("/>")?" ":"";n+=o===Qe?u+na:y>=0?(i.push($),u.slice(0,y)+gi+u.slice(y)+be+_):u+be+(y===-2?l:_)}return[ki(e,n+(e[s]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]};class lt{constructor({strings:t,_$litType$:s},i){let a;this.parts=[];let n=0,o=0;const l=t.length-1,u=this.parts,[$,b]=la(t,s);if(this.el=lt.createElement($,i),Me.currentNode=this.el.content,s===2||s===3){const y=this.el.content.firstChild;y.replaceWith(...y.childNodes)}for(;(a=Me.nextNode())!==null&&u.length<l;){if(a.nodeType===1){if(a.hasAttributes())for(const y of a.getAttributeNames())if(y.endsWith(gi)){const M=b[o++],_=a.getAttribute(y).split(be),te=/([.?@])?(.*)/.exec(M);u.push({type:1,index:n,name:te[2],strings:_,ctor:te[1]==="."?ca:te[1]==="?"?pa:te[1]==="@"?ha:Zt}),a.removeAttribute(y)}else y.startsWith(be)&&(u.push({type:6,index:n}),a.removeAttribute(y));if(xi.test(a.tagName)){const y=a.textContent.split(be),M=y.length-1;if(M>0){a.textContent=Lt?Lt.emptyScript:"";for(let _=0;_<M;_++)a.append(y[_],nt()),Me.nextNode(),u.push({type:2,index:++n});a.append(y[M],nt())}}}else if(a.nodeType===8)if(a.data===yi)u.push({type:2,index:n});else{let y=-1;for(;(y=a.data.indexOf(be,y+1))!==-1;)u.push({type:7,index:n}),y+=be.length-1}n++}}static createElement(t,s){const i=Pe.createElement("template");return i.innerHTML=t,i}}function je(e,t,s=e,i){if(t===Ae)return t;let a=i!==void 0?s._$Co?.[i]:s._$Cl;const n=ot(t)?void 0:t._$litDirective$;return a?.constructor!==n&&(a?._$AO?.(!1),n===void 0?a=void 0:(a=new n(e),a._$AT(e,s,i)),i!==void 0?(s._$Co??=[])[i]=a:s._$Cl=a),a!==void 0&&(t=je(e,a._$AS(e,t.values),a,i)),t}class da{constructor(t,s){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=s}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:s},parts:i}=this._$AD,a=(t?.creationScope??Pe).importNode(s,!0);Me.currentNode=a;let n=Me.nextNode(),o=0,l=0,u=i[0];for(;u!==void 0;){if(o===u.index){let $;u.type===2?$=new bt(n,n.nextSibling,this,t):u.type===1?$=new u.ctor(n,u.name,u.strings,this,t):u.type===6&&($=new ua(n,this,t)),this._$AV.push($),u=i[++l]}o!==u?.index&&(n=Me.nextNode(),o++)}return Me.currentNode=Pe,a}p(t){let s=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,s),s+=i.strings.length-2):i._$AI(t[s])),s++}}class bt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,s,i,a){this.type=2,this._$AH=p,this._$AN=void 0,this._$AA=t,this._$AB=s,this._$AM=i,this.options=a,this._$Cv=a?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const s=this._$AM;return s!==void 0&&t?.nodeType===11&&(t=s.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,s=this){t=je(this,t,s),ot(t)?t===p||t==null||t===""?(this._$AH!==p&&this._$AR(),this._$AH=p):t!==this._$AH&&t!==Ae&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):oa(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==p&&ot(this._$AH)?this._$AA.nextSibling.data=t:this.T(Pe.createTextNode(t)),this._$AH=t}$(t){const{values:s,_$litType$:i}=t,a=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=lt.createElement(ki(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===a)this._$AH.p(s);else{const n=new da(a,this),o=n.u(this.options);n.p(s),this.T(o),this._$AH=n}}_$AC(t){let s=ei.get(t.strings);return s===void 0&&ei.set(t.strings,s=new lt(t)),s}k(t){Ds(this._$AH)||(this._$AH=[],this._$AR());const s=this._$AH;let i,a=0;for(const n of t)a===s.length?s.push(i=new bt(this.O(nt()),this.O(nt()),this,this.options)):i=s[a],i._$AI(n),a++;a<s.length&&(this._$AR(i&&i._$AB.nextSibling,a),s.length=a)}_$AR(t=this._$AA.nextSibling,s){for(this._$AP?.(!1,!0,s);t!==this._$AB;){const i=Js(t).nextSibling;Js(t).remove(),t=i}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class Zt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,s,i,a,n){this.type=1,this._$AH=p,this._$AN=void 0,this.element=t,this.name=s,this._$AM=a,this.options=n,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=p}_$AI(t,s=this,i,a){const n=this.strings;let o=!1;if(n===void 0)t=je(this,t,s,0),o=!ot(t)||t!==this._$AH&&t!==Ae,o&&(this._$AH=t);else{const l=t;let u,$;for(t=n[0],u=0;u<n.length-1;u++)$=je(this,l[i+u],s,u),$===Ae&&($=this._$AH[u]),o||=!ot($)||$!==this._$AH[u],$===p?t=p:t!==p&&(t+=($??"")+n[u+1]),this._$AH[u]=$}o&&!a&&this.j(t)}j(t){t===p?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class ca extends Zt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===p?void 0:t}}class pa extends Zt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==p)}}class ha extends Zt{constructor(t,s,i,a,n){super(t,s,i,a,n),this.type=5}_$AI(t,s=this){if((t=je(this,t,s,0)??p)===Ae)return;const i=this._$AH,a=t===p&&i!==p||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==p&&(i===p||a);a&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class ua{constructor(t,s,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=s,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){je(this,t)}}const fa=Ts.litHtmlPolyfillSupport;fa?.(lt,bt),(Ts.litHtmlVersions??=[]).push("3.3.3");const wa=(e,t,s)=>{const i=s?.renderBefore??t;let a=i._$litPart$;if(a===void 0){const n=s?.renderBefore??null;i._$litPart$=a=new bt(t.insertBefore(nt(),n),n,void 0,s??{})}return a._$AI(e),a};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ns=globalThis;let w=class extends He{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const s=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=wa(s,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Ae}};w._$litElement$=!0,w.finalized=!0,Ns.litElementHydrateSupport?.({LitElement:w});const ma=Ns.litElementPolyfillSupport;ma?.({LitElement:w});(Ns.litElementVersions??=[]).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const m=e=>(t,s)=>{s!==void 0?s.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const va={attribute:!0,type:String,converter:Ht,reflect:!1,hasChanged:Is},ba=(e=va,t,s)=>{const{kind:i,metadata:a}=s;let n=globalThis.litPropertyMetadata.get(a);if(n===void 0&&globalThis.litPropertyMetadata.set(a,n=new Map),i==="setter"&&((e=Object.create(e)).wrapped=!0),n.set(s.name,e),i==="accessor"){const{name:o}=s;return{set(l){const u=t.get.call(this);t.set.call(this,l),this.requestUpdate(o,u,e,!0,l)},init(l){return l!==void 0&&this.C(o,void 0,e,l),l}}}if(i==="setter"){const{name:o}=s;return function(l){const u=this[o];t.call(this,l),this.requestUpdate(o,u,e,!0,l)}}throw Error("Unsupported decorator location: "+i)};function h(e){return(t,s)=>typeof s=="object"?ba(e,t,s):((i,a,n)=>{const o=a.hasOwnProperty(n);return a.constructor.createProperty(n,i),o?Object.getOwnPropertyDescriptor(a,n):void 0})(e,t,s)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function d(e){return h({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ga=(e,t,s)=>(s.configurable=!0,s.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,s),s);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function gt(e,t){return(s,i,a)=>{const n=o=>o.renderRoot?.querySelector(e)??null;return ga(s,i,{get(){return n(this)}})}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ya={ATTRIBUTE:1},xa=e=>(...t)=>({_$litDirective$:e,values:t});class $a{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,s,i){this._$Ct=t,this._$AM=s,this._$Ci=i}_$AS(t,s){return this.update(t,s)}update(t,s){return this.render(...s)}}/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const et=xa(class extends $a{constructor(e){if(super(e),e.type!==ya.ATTRIBUTE||e.name!=="class"||e.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(const i in t)t[i]&&!this.nt?.has(i)&&this.st.add(i);return this.render(t)}const s=e.element.classList;for(const i of this.st)i in t||(s.remove(i),this.st.delete(i));for(const i in t){const a=!!t[i];a===this.st.has(i)||this.nt?.has(i)||(a?(s.add(i),this.st.add(i)):(s.remove(i),this.st.delete(i)))}return Ae}});var ka=Object.defineProperty,_a=Object.getOwnPropertyDescriptor,Xt=(e,t,s,i)=>{for(var a=i>1?void 0:i?_a(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ka(t,s,a),a};const ti={live:c`<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/>`,explore:c`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>`,investigate:c`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M11 8v3l2 1.5"/>`,system:c`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,camera:c`<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H8l1.5-2h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.5"/>`,search:c`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>`,bell:c`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>`,user:c`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,play:c`<path d="M7 5v14l11-7z"/>`,expand:c`<path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/>`,close:c`<path d="M6 6l12 12M18 6 6 18"/>`,chevron:c`<path d="m9 6 6 6-6 6"/>`,warning:c`<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>`,info:c`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`,lock:c`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,unlock:c`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>`,offline:c`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/><path d="M3 3l18 18"/>`,refresh:c`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>`,layers:c`<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/>`,floor:c`<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v18"/>`,plus:c`<path d="M12 5v14M5 12h14"/>`,minus:c`<path d="M5 12h14"/>`,fit:c`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,door:c`<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>`,light:c`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`,sensor:c`<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>`,check:c`<path d="m5 12 5 5 9-10"/>`,clock:c`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,download:c`<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>`,pin:c`<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v6"/>`,more:c`<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>`,building:c`<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>`,map:c`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/>`,upload:c`<path d="M12 16V5M7 10l5-5 5 5M4 20h16"/>`,list:c`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`,history:c`<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v4l3 2"/>`,target:c`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`,filter:c`<path d="M4 5h16l-6 8v6l-4-2v-4z"/>`,users:c`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21.5 20"/>`,shield:c`<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>`,storage:c`<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>`,edit:c`<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>`,pause:c`<path d="M8 5v14M16 5v14"/>`,skip:c`<path d="M5 5v14l8-7zM15 5h2v14h-2z"/>`,case:c`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>`,rule:c`<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>`,link:c`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,grid:c`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,dashboard:c`<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>`,home:c`<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>`,star:c`<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9L6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,aperture:c`<circle cx="12" cy="12" r="9"/><path d="m14.3 4.5-5 8.6M20.7 9.5H10.8M18.4 17.5l-5-8.6M9.7 19.5l5-8.6M3.3 14.5h9.9M5.6 6.5l5 8.6"/>`,volume:c`<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>`,mic:c`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>`,back10:c`<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,forward10:c`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,chevronDown:c`<path d="m6 9 6 6 6-6"/>`,stairs:c`<path d="M3 20h4v-4h4v-4h4V8h5"/>`,elevator:c`<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>`,menu:c`<path d="M4 7h16M4 12h16M4 17h16"/>`,calendar:c`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,trash:c`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,eye:c`<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,cpu:c`<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>`,activity:c`<path d="M3 12h4l3-8 4 16 3-8h4"/>`,image:c`<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/>`,wifi:c`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/>`,signal:c`<path d="M4 18v-3M9 18v-7M14 18V7M19 18V4"/>`,move:c`<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>`,bookmark:c`<path d="M6 3h12v18l-6-4-6 4z"/>`,route:c`<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 17c5-1 3-9 8-10"/>`,logout:c`<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>`};let Be=class extends w{constructor(){super(...arguments),this.name="info",this.size=20,this.flip=!1}render(){this.style.setProperty("--sw-icon-size",`${this.size}px`);const e=this.name==="chevron";return r`<svg viewBox="0 0 24 24" aria-hidden="true" ?data-dir=${e}>${ti[this.name]??ti.info}</svg>`}};Be.styles=v`
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
  `;Xt([h()],Be.prototype,"name",2);Xt([h({type:Number})],Be.prototype,"size",2);Xt([h({type:Boolean,reflect:!0})],Be.prototype,"flip",2);Be=Xt([m("sw-icon")],Be);var za=Object.defineProperty,Sa=Object.getOwnPropertyDescriptor,ve=(e,t,s,i)=>{for(var a=i>1?void 0:i?Sa(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&za(t,s,a),a};let ie=class extends w{constructor(){super(...arguments),this.variant="secondary",this.size="md",this.disabled=!1,this.iconOnly=!1,this.round=!1,this.label="",this.type="button"}render(){return r`
      <button type=${this.type} ?disabled=${this.disabled} aria-label=${this.iconOnly?this.label:""} title=${this.iconOnly?this.label:""}>
        ${this.icon?r`<sw-icon .name=${this.icon} size=${this.size==="sm"?13:this.size==="lg"?18:15}></sw-icon>`:""}
        ${this.iconOnly?"":r`<slot>${this.label}</slot>`}
      </button>
    `}};ie.styles=v`
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
  `;ve([h()],ie.prototype,"variant",2);ve([h()],ie.prototype,"size",2);ve([h()],ie.prototype,"icon",2);ve([h({type:Boolean,reflect:!0})],ie.prototype,"disabled",2);ve([h({type:Boolean,reflect:!0})],ie.prototype,"iconOnly",2);ve([h({type:Boolean,reflect:!0})],ie.prototype,"round",2);ve([h()],ie.prototype,"label",2);ve([h()],ie.prototype,"type",2);ie=ve([m("sw-button")],ie);const Ma={app:{name:"SMPLWISE VMS",search:"חיפוש מצלמה, קומה, ישות או אירוע…",notifications:"התראות",account:"חשבון"},modes:{live:"שידור חי",explore:"מפות",investigate:"חקירה",system:"מערכת"},nav:{styleguide:"ספריית רכיבים"},breadcrumb:{site:"אתר",building:"מבנה",floor:"קומה"},floor:{switcher:"בחירת קומה",layers:"שכבות",cameras:"מצלמות",doors:"דלתות",lights:"תאורה",sensors:"חיישנים",zoomIn:"הגדלה",zoomOut:"הקטנה",fit:"התאמה למסך",noPlan:"לקומה הזו עדיין אין תוכנית",noPlanHint:"אפשר להעלות PDF או תמונה של התוכנית, או לעבוד עם רשימת המצלמות בינתיים.",uploadPlan:"העלאת תוכנית",listView:"תצוגת רשימה",stalePlan:"התוכנית מוצגת כרקע בלבד"},states:{loading:"טוען…",empty:"אין נתונים להצגה",error:"משהו השתבש",errorHint:"לא הצלחנו לטעון את הנתונים. אפשר לנסות שוב.",retry:"נסה שוב",forbidden:"אין הרשאה",forbiddenHint:"למשתמש שלך אין הרשאה לצפות בתוכן הזה. פנה למנהל ה־VMS כדי לקבל שיוך.",stale:"הנתונים אינם עדכניים",staleHint:"החיבור ל־Home Assistant נותק. מוצג המצב האחרון שנקלט.",partial:"חלק מהנתונים חסר",offline:"לא מחובר",unknown:"לא ידוע",live:"חי",recorded:"מוקלט",historic:"צפייה היסטורית"},camera:{preview:"תצוגה מקדימה",enlarge:"הגדל",recordings:"הקלטות",pin:"הצמד",unpin:"בטל הצמדה",snapshot:"צילום",offlineReason:"המצלמה אינה מחוברת ל־NVR",forbiddenReason:"אין לך הרשאת צפייה במצלמה הזו",staleReason:"מצב המצלמה אינו מעודכן",source:"מקור",timeSource:"זמן מקור",quality:"איכות",main:"ראשי",sub:"משני"},entity:{state:"מצב",lastChanged:"עודכן לאחרונה",control:"הפעלה",noControl:"אין הרשאה לשליטה",openInHa:"פתח ב־Home Assistant",door:"דלת",light:"תאורה",sensor:"חיישן",locked:"נעול",unlocked:"פתוח",on:"דולק",off:"כבוי",confirm:"אישור פעולה"},actions:{close:"סגור",cancel:"ביטול",save:"שמירה",apply:"החל",refresh:"רענון",more:"עוד",back:"חזרה"}};function f(e){const t=e.split(".").reduce((s,i)=>s?.[i],Ma);return typeof t=="string"?t:e}var Pa=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,Qt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Aa(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Pa(t,s,a),a};const Oa={live:()=>f("states.live"),recorded:()=>f("states.recorded"),historic:()=>f("states.historic"),offline:()=>f("states.offline"),stale:()=>f("states.stale"),unknown:()=>f("states.unknown"),forbidden:()=>f("states.forbidden"),error:()=>f("states.error"),partial:()=>f("states.partial"),neutral:()=>""};let Ve=class extends w{constructor(){super(...arguments),this.kind="neutral",this.label="",this.onImage=!1}render(){const e=this.label||Oa[this.kind]();return r`<span class="dot" aria-hidden="true"></span><span>${e}</span>`}};Ve.styles=v`
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
  `;Qt([h({reflect:!0})],Ve.prototype,"kind",2);Qt([h()],Ve.prototype,"label",2);Qt([h({type:Boolean,reflect:!0})],Ve.prototype,"onImage",2);Ve=Qt([m("sw-badge")],Ve);var Ca=Object.defineProperty,Ea=Object.getOwnPropertyDescriptor,yt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ea(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ca(t,s,a),a};let Oe=class extends w{constructor(){super(...arguments),this.items=[],this.active="",this.segmented=!1,this.underline=!1}choose(e){this.active=e.id,this.dispatchEvent(new CustomEvent("change",{detail:{id:e.id},bubbles:!0,composed:!0}))}render(){return r`${this.items.map(e=>e.href?r`<a href=${e.href} class=${e.id===this.active?"on":""} aria-current=${e.id===this.active?"page":"false"}>${e.label}${e.count!==void 0?r`<span class="count">(${e.count})</span>`:""}</a>`:r`<button type="button" class=${e.id===this.active?"on":""} aria-pressed=${e.id===this.active} @click=${()=>this.choose(e)}>${e.label}${e.count!==void 0?r`<span class="count">(${e.count})</span>`:""}</button>`)}`}};Oe.styles=v`
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
  `;yt([h({attribute:!1})],Oe.prototype,"items",2);yt([h()],Oe.prototype,"active",2);yt([h({type:Boolean,reflect:!0})],Oe.prototype,"segmented",2);yt([h({type:Boolean,reflect:!0})],Oe.prototype,"underline",2);Oe=yt([m("sw-tabs")],Oe);var Ia=Object.defineProperty,Ta=Object.getOwnPropertyDescriptor,Rs=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ta(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ia(t,s,a),a};let dt=class extends w{constructor(){super(...arguments),this.name="",this.size=32}render(){this.style.setProperty("--sz",`${this.size}px`);const e=this.name.trim().split(/\s+/),t=e.length>1?e[0][0]+e[1][0]:this.name.slice(0,2);return r`${t}`}};dt.styles=v`
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
  `;Rs([h()],dt.prototype,"name",2);Rs([h({type:Number})],dt.prototype,"size",2);dt=Rs([m("sw-avatar")],dt);var Da=Object.defineProperty,Na=Object.getOwnPropertyDescriptor,xt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Na(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Da(t,s,a),a};let Ce=class extends w{constructor(){super(...arguments),this.selected=!1,this.dot=""}render(){return r`
      <button type="button" aria-pressed=${this.selected}>
        ${this.dot?r`<span class="d" style="--dot:${this.dot}"></span>`:""}
        ${this.icon?r`<sw-icon .name=${this.icon} size=${13}></sw-icon>`:""}
        <slot></slot>
        ${this.count!==void 0?r`<span class="count">(${this.count})</span>`:""}
      </button>
    `}};Ce.styles=v`
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
  `;xt([h({type:Boolean,reflect:!0})],Ce.prototype,"selected",2);xt([h()],Ce.prototype,"icon",2);xt([h({type:Number})],Ce.prototype,"count",2);xt([h()],Ce.prototype,"dot",2);Ce=xt([m("sw-chip")],Ce);var Ra=Object.defineProperty,Ha=Object.getOwnPropertyDescriptor,es=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ha(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ra(t,s,a),a};let Ue=class extends w{constructor(){super(...arguments),this.open=!1,this.heading="",this.subheading=""}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){return r`
      <aside class="panel" role="dialog" aria-modal="false" aria-label=${this.heading} ?hidden=${!this.open}>
        <div class="grip" aria-hidden="true"></div>
        <header>
          <div class="titles">
            <h3>${this.heading}</h3>
            ${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}
          </div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${f("actions.close")} @click=${this.close}></sw-button>
        </header>
        <div class="body"><slot></slot></div>
        <footer><slot name="footer"></slot></footer>
      </aside>
    `}};Ue.styles=v`
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
  `;es([h({type:Boolean,reflect:!0})],Ue.prototype,"open",2);es([h()],Ue.prototype,"heading",2);es([h()],Ue.prototype,"subheading",2);Ue=es([m("sw-drawer")],Ue);var La=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,Ge=(e,t,s,i)=>{for(var a=i>1?void 0:i?ja(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&La(t,s,a),a};let ge=class extends w{constructor(){super(...arguments),this.heading="",this.x=0,this.y=0,this.stageWidth=0,this.stageHeight=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","dialog"),this.setAttribute("aria-modal","false")}willUpdate(){this.heading&&this.setAttribute("aria-label",this.heading)}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}updated(){const t=this.offsetHeight||260,s=16;let i=this.x+s;this.stageWidth&&i+268>this.stageWidth-8&&(i=Math.max(8,this.x-268-s));let a=this.y-t/2;this.stageHeight&&(a=Math.max(8,Math.min(this.stageHeight-t-8,a))),this.style.left=`${i}px`,this.style.top=`${Math.max(8,a)}px`}render(){return r`
      <header><h4>${this.heading}</h4><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
      <slot></slot>
      <footer><slot name="footer"></slot></footer>
    `}};ge.styles=v`
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
  `;Ge([h()],ge.prototype,"heading",2);Ge([h({type:Number})],ge.prototype,"x",2);Ge([h({type:Number})],ge.prototype,"y",2);Ge([h({type:Number})],ge.prototype,"stageWidth",2);Ge([h({type:Number})],ge.prototype,"stageHeight",2);ge=Ge([m("sw-popover")],ge);var Ba=Object.defineProperty,Va=Object.getOwnPropertyDescriptor,ts=(e,t,s,i)=>{for(var a=i>1?void 0:i?Va(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ba(t,s,a),a};let We=class extends w{constructor(){super(...arguments),this.label="",this.hint="",this.inline=!1}render(){return r`
      ${this.label?r`<label>${this.label}</label>`:""}
      <slot></slot>
      ${this.hint?r`<div class="hint">${this.hint}</div>`:""}
    `}};We.styles=v`
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
  `;ts([h()],We.prototype,"label",2);ts([h()],We.prototype,"hint",2);ts([h({type:Boolean,reflect:!0})],We.prototype,"inline",2);We=ts([m("sw-field")],We);var Ua=Object.defineProperty,Wa=Object.getOwnPropertyDescriptor,_i=(e,t,s,i)=>{for(var a=i>1?void 0:i?Wa(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ua(t,s,a),a};let Fa=0,jt=class extends w{constructor(){super(...arguments),this.kind="lobby",this.uid=`sc${Fa+=1}`}grad(e,t,s=!0){const i=`${e}-${this.uid}`;return c`<linearGradient id=${i} x1="0" y1="0" x2=${s?0:1} y2=${s?1:0}>${t.map(([a,n])=>c`<stop offset=${a} stop-color=${n} />`)}</linearGradient>`}url(e){return`url(#${e}-${this.uid})`}vignette(){const e=`vig-${this.uid}`;return c`<defs><radialGradient id=${e} cx="50%" cy="45%" r="72%"><stop offset="0.55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity="0.38" /></radialGradient></defs><rect width="320" height="180" fill=${`url(#${e})`} />`}entrance(){return c`
      <defs>${this.grad("wall",[[0,"#f3f1ec"],[1,"#d8d4cc"]])}${this.grad("floor",[[0,"#d2cdc2"],[1,"#a19a8c"]])}${this.grad("glass",[[0,"#e3edf6"],[.55,"#bfd2e6"],[1,"#8fa9c4"]],!1)}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <polygon points="0,0 320,0 250,30 70,30" fill="#e9e6df" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url("floor")} />
      ${[0,1,2,3,4,5].map(e=>c`<line x1=${-40+e*80} y1="180" x2=${100+e*24} y2="118" stroke="#fff" stroke-opacity="0.18" />`)}
      <rect x="0" y="30" width="70" height="88" fill="#8b6e4e" />
      ${[0,1,2,3,4,5].map(e=>c`<rect x=${4+e*11} y="30" width="4" height="88" fill="#6f563d" />`)}
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
    `}lobby(){return c`
      <defs>${this.grad("wall",[[0,"#f5f0e7"],[1,"#e2d9ca"]])}${this.grad("floor",[[0,"#dccdb2"],[1,"#b19973"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="196" y="26" width="96" height="66" rx="2" fill="#d9e7f4" />
      <path d="M244 26v66M196 59h96" stroke="#fff" stroke-width="3" />
      <rect x="196" y="26" width="96" height="66" fill="none" stroke="#c8bfae" stroke-width="3" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url("floor")} />
      ${[0,1,2,3].map(e=>c`<line x1="0" y1=${132+e*14} x2="320" y2=${132+e*14} stroke="#fff" stroke-opacity="0.14" />`)}
      <rect x="26" y="86" width="132" height="8" rx="2" fill="#7c6248" />
      <rect x="30" y="94" width="124" height="36" rx="3" fill="#5a4636" />
      <rect x="188" y="102" width="96" height="28" rx="7" fill="#4a5568" />
      <rect x="194" y="92" width="40" height="16" rx="5" fill="#5b6a82" /><rect x="238" y="92" width="40" height="16" rx="5" fill="#5b6a82" />
      <ellipse cx="172" cy="86" rx="14" ry="11" fill="#3f7d4b" /><ellipse cx="164" cy="78" rx="9" ry="8" fill="#4f9159" />
      <rect x="166" y="96" width="12" height="16" rx="2" fill="#7a6c5d" />
      ${[60,120,180,240].map(e=>c`<ellipse cx=${e} cy="9" rx="7" ry="2.5" fill="#fff" fill-opacity="0.9" />`)}
    `}corridor(){return c`
      <defs>${this.grad("floor",[[0,"#cfc9bd"],[1,"#9c9587"]])}${this.grad("ceil",[[0,"#f3f1ec"],[1,"#e2ded6"]])}</defs>
      <rect width="320" height="180" fill="#d6d0c5" />
      <polygon points="0,0 320,0 200,42 120,42" fill=${this.url("ceil")} />
      <polygon points="0,0 120,42 120,138 0,180" fill="#e6e1d8" />
      <polygon points="320,0 200,42 200,138 320,180" fill="#d2ccc0" />
      <rect x="120" y="42" width="80" height="96" fill="#cbc4b8" />
      <rect x="150" y="70" width="22" height="68" fill="#8b7a67" />
      <rect x="153" y="73" width="16" height="30" fill="#c5d5e3" />
      <polygon points="0,180 320,180 200,138 120,138" fill=${this.url("floor")} />
      ${[0,1,2].map(e=>c`<line x1=${40+e*80} y1="180" x2=${140+e*20} y2="138" stroke="#fff" stroke-opacity="0.16" />`)}
      ${[0,1,2,3].map(e=>c`<rect x=${152-e*12} y=${24-e*6} width=${16+e*24} height="4" rx="2" fill="#fff" fill-opacity=${.9-e*.15} />`)}
      ${[0,1,2].map(e=>c`<rect x=${22+e*30} y=${58+e*10} width="10" height=${60-e*10} fill="#c9d5e3" fill-opacity="0.9" />`)}
    `}hall(){return c`
      <defs>${this.grad("wall",[[0,"#f2eee6"],[1,"#ddd6c9"]])}${this.grad("floor",[[0,"#c9c0b0"],[1,"#9a9081"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="112" width="320" height="68" fill=${this.url("floor")} />
      ${[0,1,2,3,4].map(e=>[0,1,2,3,4,5,6].map(t=>c`<rect x=${28+t*40+e*4} y=${96+e*14} width="22" height="9" rx="2" fill="#3b4557" />`))}
      <rect x="40" y="40" width="240" height="50" rx="2" fill="#dfe8f2" />
      <rect x="40" y="40" width="240" height="50" fill="none" stroke="#c9c1b3" stroke-width="3" />
      ${[80,140,200,240].map(e=>c`<line x1=${e} y1="40" x2=${e} y2="90" stroke="#fff" stroke-width="2" />`)}
      ${[60,130,200,260].map(e=>c`<ellipse cx=${e} cy="12" rx="9" ry="3" fill="#fff" fill-opacity="0.9" />`)}
    `}parking(){return c`
      <defs>${this.grad("wall",[[0,"#d3d7de"],[1,"#a1a7b1"]])}${this.grad("floor",[[0,"#8f959f"],[1,"#666c76"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="0" width="320" height="26" fill="#b9bec7" />
      ${[0,1,2].map(e=>c`<rect x="0" y=${8+e*6} width="320" height="2" fill="#98a0ab" />`)}
      <rect x="0" y="116" width="320" height="64" fill=${this.url("floor")} />
      ${[0,1,2,3,4,5].map(e=>c`<line x1=${-20+e*72} y1="180" x2=${90+e*28} y2="116" stroke="#e5e8ee" stroke-opacity="0.6" stroke-width="2" />`)}
      <rect x="34" y="26" width="20" height="100" fill="#7d8591" /><rect x="266" y="26" width="20" height="100" fill="#7d8591" />
      <rect x="110" y="102" width="72" height="24" rx="6" fill="#e8ebf0" /><polygon points="124,102 138,86 168,86 178,102" fill="#c6cfda" /><circle cx="126" cy="127" r="7" fill="#2c2f36" /><circle cx="170" cy="127" r="7" fill="#2c2f36" />
      <rect x="196" y="104" width="62" height="22" rx="6" fill="#3f4a5c" /><polygon points="208,104 220,90 244,90 252,104" fill="#5c6a80" /><circle cx="210" cy="127" r="6" fill="#1f232b" /><circle cx="246" cy="127" r="6" fill="#1f232b" />
      <rect x="130" y="30" width="60" height="5" rx="2" fill="#fff" fill-opacity="0.85" />
    `}warehouse(){return c`
      <defs>${this.grad("wall",[[0,"#e6e9ef"],[1,"#c6cbd3"]])}${this.grad("floor",[[0,"#b7bcc4"],[1,"#7f8592"]])}</defs>
      <rect width="320" height="180" fill=${this.url("wall")} />
      <rect x="0" y="104" width="320" height="76" fill=${this.url("floor")} />
      <line x1="118" y1="180" x2="150" y2="104" stroke="#e2b43a" stroke-width="3" /><line x1="202" y1="180" x2="170" y2="104" stroke="#e2b43a" stroke-width="3" />
      ${[[10,96],[230,316]].map(([e,t])=>c`
        <rect x=${e} y="18" width="6" height="150" fill="#c9772f" /><rect x=${t-6} y="40" width="6" height="128" fill="#c9772f" />
        ${[0,1,2].map(s=>c`<polygon points="${e},${52+s*36} ${t},${64+s*30} ${t},${68+s*30} ${e},${56+s*36}" fill="#b96a22" />`)}
        ${[0,1,2].map(s=>[0,1,2].map(i=>c`<rect x=${e+10+i*26} y=${32+s*36+i*3} width="20" height="16" rx="1" fill=${i%2?"#a8825d":"#c7a17a"} />`))}
      `)}
      <rect x="130" y="8" width="60" height="6" rx="3" fill="#fff" fill-opacity="0.9" /><rect x="120" y="40" width="80" height="5" rx="2" fill="#fff" fill-opacity="0.6" />
    `}backyard(){return c`
      <defs>${this.grad("sky",[[0,"#c4d9ee"],[1,"#e9f1f8"]])}${this.grad("lawn",[[0,"#86bb6f"],[1,"#4d8240"]])}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="62" width="320" height="50" fill="#b8905f" />
      ${Array.from({length:27},(e,t)=>c`<rect x=${t*12} y="62" width="2" height="50" fill="#9c7749" />`)}
      <rect x="0" y="66" width="320" height="4" fill="#a37e51" /><rect x="0" y="100" width="320" height="4" fill="#a37e51" />
      <circle cx="42" cy="52" r="27" fill="#3f7f45" /><circle cx="72" cy="46" r="20" fill="#4f9552" /><circle cx="282" cy="48" r="32" fill="#36763f" /><circle cx="250" cy="58" r="18" fill="#4a8a4c" />
      <rect x="0" y="112" width="320" height="68" fill=${this.url("lawn")} />
      ${[0,1,2].map(e=>c`<rect x="0" y=${118+e*20} width="320" height="10" fill="#fff" fill-opacity="0.07" />`)}
      <polygon points="150,180 320,180 300,128 172,128" fill="#c9c3b5" />
      <ellipse cx="238" cy="146" rx="28" ry="9" fill="#4a4f57" /><rect x="236" y="146" width="4" height="18" fill="#3a3f47" />
      <rect x="196" y="140" width="16" height="11" rx="3" fill="#565b64" /><rect x="262" y="140" width="16" height="11" rx="3" fill="#565b64" />
    `}driveway(){return c`
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
    `}night(){const e=`glow-${this.uid}`;return c`
      <defs>${this.grad("sky",[[0,"#0d1730"],[1,"#050912"]])}<radialGradient id=${e} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f5d78a" stop-opacity="0.55" /><stop offset="1" stop-color="#f5d78a" stop-opacity="0" /></radialGradient></defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="120" width="320" height="60" fill="#0a1020" />
      <circle cx="251" cy="34" r="110" fill=${`url(#${e})`} />
      <rect x="250" y="30" width="3" height="92" fill="#2a3350" /><rect x="238" y="24" width="27" height="8" rx="3" fill="#3b4666" />
      <ellipse cx="251" cy="124" rx="70" ry="12" fill="#f5d78a" fill-opacity="0.16" />
      <rect x="60" y="100" width="92" height="24" rx="7" fill="#131b33" /><polygon points="78,100 94,84 124,84 138,100" fill="#1a2440" />
      <circle cx="80" cy="125" r="8" fill="#0a0f1f" /><circle cx="134" cy="125" r="8" fill="#0a0f1f" />
      ${[0,1,2,3,4,5,6].map(t=>c`<rect x=${t*48} y="88" width="2" height="34" fill="#1b2440" />`)}
      <rect x="0" y="88" width="320" height="2" fill="#1b2440" />
    `}building(){return c`
      <defs>${this.grad("sky",[[0,"#c2d7ec"],[1,"#e9f0f7"]])}${this.grad("face",[[0,"#e6eaf0"],[1,"#c8cfd9"]],!1)}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="156" width="320" height="24" fill="#aab2be" />
      <rect x="92" y="28" width="136" height="130" fill=${this.url("face")} />
      <rect x="228" y="52" width="46" height="106" fill="#b9c1cd" />
      ${[0,1,2,3,4,5].map(e=>[0,1,2,3,4].map(t=>c`<rect x=${102+t*24} y=${38+e*19} width="16" height="12" rx="1" fill=${(e+t)%3?"#8fa8c6":"#c9dbee"} />`))}
      ${[0,1,2,3,4].map(e=>[0,1].map(t=>c`<rect x=${236+t*18} y=${62+e*19} width="12" height="10" rx="1" fill="#8ea3bd" />`))}
      <rect x="118" y="138" width="84" height="8" rx="2" fill="#4b5565" /><rect x="140" y="146" width="40" height="12" fill="#6d7f9a" />
      <circle cx="40" cy="132" r="26" fill="#4a8a4c" /><circle cx="292" cy="140" r="20" fill="#3f7d45" />
    `}house(){return c`
      <defs>${this.grad("sky",[[0,"#c2d7ec"],[1,"#ebf1f7"]])}${this.grad("lawn",[[0,"#8dbd70"],[1,"#5a8d46"]])}</defs>
      <rect width="320" height="180" fill=${this.url("sky")} />
      <rect x="0" y="128" width="320" height="52" fill=${this.url("lawn")} />
      <polygon points="58,76 160,22 262,76" fill="#6e5f55" />
      <rect x="78" y="74" width="164" height="60" fill="#f2ede4" />
      <rect x="96" y="88" width="26" height="22" fill="#9fb8d3" /><rect x="148" y="90" width="20" height="44" fill="#5b4a3b" /><rect x="182" y="94" width="50" height="40" fill="#cfd4dc" />
      <path d="M182 104h50M182 114h50M182 124h50" stroke="#b9c0ca" stroke-width="2" />
      <polygon points="140,180 180,180 176,134 152,134" fill="#c7c1b4" />
      <circle cx="30" cy="112" r="24" fill="#4a8a4c" /><circle cx="296" cy="118" r="20" fill="#3f7d45" />
    `}scene(){switch(this.kind){case"entrance":return this.entrance();case"lobby":return this.lobby();case"corridor":return this.corridor();case"hall":return this.hall();case"parking":return this.parking();case"warehouse":return this.warehouse();case"backyard":return this.backyard();case"driveway":return this.driveway();case"night":return this.night();case"building":return this.building();case"house":return this.house();default:return p}}render(){return this.kind==="none"?r``:r`<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${this.scene()}${this.vignette()}</svg>`}};jt.styles=v`
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
  `;_i([h({reflect:!0})],jt.prototype,"kind",2);jt=_i([m("sw-scene")],jt);class fe extends Error{constructor(t,s){super(s.user_message||s.code),this.status=t,this.body=s}get code(){return this.body.code}}function qa(){return new URL("api/v1/",document.baseURI)}function ke(e){return new URL(e.replace(/^\/+/,""),qa()).toString()}function Dt(e){return new URL(e.replace(/^\/+/,""),document.baseURI).toString()}async function $t(e,t={}){const s=new Headers(t.headers);t.body&&!(t.body instanceof FormData)&&!s.has("Content-Type")&&s.set("Content-Type","application/json");const i=await fetch(ke(e),{...t,headers:s,credentials:"same-origin"});if(i.status===204)return;const a=await i.text();let n=null;try{n=a?JSON.parse(a):null}catch{n=null}if(!i.ok){const o=n??{code:`http_${i.status}`,user_message:i.statusText,retryable:!1,correlation_id:"",details:{}};throw new fe(i.status,o)}return n}const D=e=>$t(e),N=(e,t)=>$t(e,{method:"POST",body:t===void 0?void 0:JSON.stringify(t)}),ss=(e,t)=>$t(e,{method:"PATCH",body:JSON.stringify(t)}),kt=e=>$t(e,{method:"DELETE"}),Ka=(e,t)=>$t(e,{method:"POST",body:t});function x(e){return e instanceof fe?e.body.user_message||e.body.code:e instanceof TypeError?"אין חיבור לשרת.":e instanceof Error?e.message:String(e)}const zi=()=>D("settings"),Ja=e=>ss("settings",e),Ga=()=>N("media/streams/sync"),Ya=()=>D("media/streams"),Za=()=>D("media/sessions");function ct(e,t){return ke(`cameras/${e}/snapshot.jpg${t?`?t=${t}`:""}`)}function Xa(e,t){const s=new URL(ke(`media/live/${e}/ws?profile=${t}`));return s.protocol=s.protocol==="https:"?"wss:":"ws:",s.toString()}const fs="sw.transport";function Si(){try{const e=localStorage.getItem(fs);return e==="webrtc"||e==="mse"||e==="auto"?e:""}catch{return""}}function Qa(e){try{e?localStorage.setItem(fs,e):localStorage.removeItem(fs)}catch{}}var er=Object.defineProperty,tr=Object.getOwnPropertyDescriptor,J=(e,t,s,i)=>{for(var a=i>1?void 0:i?tr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&er(t,s,a),a};const sr=["avc1.640029","avc1.64002A","avc1.640033","hvc1.1.6.L153.B0","mp4a.40.2","mp4a.40.5","flac","opus"],ir=12e3,ar=2e4,rr=3e3,nr=3e4;let j=class extends w{constructor(){super(...arguments),this.cameraId="",this.profile="sub",this.mode="auto",this.poster="",this.active=!0,this.compact=!1,this.wsUrl="",this.retry=!0,this.status="idle",this.transport="",this.error="",this.muted=!0,this.ws=null,this.pc=null,this.ms=null,this.sb=null,this.queue=[],this.generation=0,this.triedWebrtc=!1,this.pendingMime="",this.attempts=0,this.lastPreferMse=!1}disconnectedCallback(){super.disconnectedCallback(),this.disconnect()}updated(e){(e.has("active")||e.has("cameraId")||e.has("profile")||e.has("mode")||e.has("wsUrl"))&&(!this.active||!this.cameraId&&!this.wsUrl?this.disconnect():this.reconnect())}get mediaTime(){return this.video?.currentTime??0}get paused(){return this.video?.paused??!0}pause(){this.video?.pause()}resume(){this.video?.play().catch(()=>{})}reconnect(){this.disconnect(),this.connect()}connect(e=!1){if(!this.cameraId&&!this.wsUrl||!this.active)return;this.teardown();const t=this.generation+=1;this.status="connecting",this.error="",this.transport="",this.triedWebrtc=e,this.lastPreferMse=e;let s;try{s=new WebSocket(this.wsUrl||Xa(this.cameraId,this.profile))}catch{this.fail("לא ניתן לפתוח חיבור");return}s.binaryType="arraybuffer",this.ws=s,s.onopen=()=>{t===this.generation&&(this.wsUrl||this.mode==="mse"||this.mode==="auto"&&e?this.startMse():this.startWebrtc())},s.onmessage=i=>{t===this.generation&&(typeof i.data=="string"?this.onSignal(i.data):this.onFragment(i.data))},s.onerror=()=>{},s.onclose=i=>{if(t!==this.generation||this.status==="error")return;if(this.mode==="auto"&&this.transport==="webrtc"&&this.status!=="playing"&&i.code<4e3){this.webrtcFailed("WebRTC נכשל");return}if(!this.retry&&this.status==="playing"&&i.code<4e3){this.teardown(),this.status="ended",this.dispatchEvent(new CustomEvent("player-status",{detail:{status:"ended"},bubbles:!0,composed:!0}));return}const a=i.code===4403?"אין הרשאת צפייה":i.code===4429?"הגיע למכסת הזרמים":i.code===4503?"go2rtc לא זמין":i.code===4401?"נדרשת הזדהות":i.code===4404?"סשן הניגון פג":i.code===4410?"הסשן הוחלף":this.status==="playing"?"החיבור נותק":"החיבור נסגר";this.fail(a,this.retry&&i.code!==4401&&i.code!==4403&&i.code!==4404&&i.code!==4410)}}disconnect(){this.teardown(),window.clearTimeout(this.retryTimer),this.attempts=0,this.status="idle",this.transport=""}teardown(){this.generation+=1,window.clearTimeout(this.timer),window.clearTimeout(this.retryTimer),this.pendingMime="",this.pc&&(this.pc.close(),this.pc=null),this.ws&&(this.ws.onclose=null,this.ws.onerror=null,this.ws.onmessage=null,this.ws.onopen=null,this.ws.close(),this.ws=null),this.sb=null,this.queue=[],this.ms=null,this.video&&(this.video.pause(),this.video.srcObject=null,this.video.src.startsWith("blob:")&&URL.revokeObjectURL(this.video.src),this.video.removeAttribute("src"),this.video.load())}send(e){this.ws&&this.ws.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify(e))}fail(e,t=!0){if(this.teardown(),this.status="error",this.error=e,this.dispatchEvent(new CustomEvent("player-status",{detail:{status:"error",error:e},bubbles:!0,composed:!0})),t&&this.retry&&this.active&&(this.cameraId||this.wsUrl)){const s=Math.min(nr,rr*2**Math.min(this.attempts,6));this.attempts+=1,this.retryTimer=window.setTimeout(()=>this.connect(this.lastPreferMse),s)}}async startWebrtc(){this.triedWebrtc=!0,this.transport="webrtc";const e=this.generation,t=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});this.pc=t,t.ontrack=s=>{if(e!==this.generation)return;const i=s.streams[0]??new MediaStream([s.track]);this.video.srcObject!==i&&(this.video.srcObject=i,this.video.play().catch(()=>{}))},t.onicecandidate=s=>{e===this.generation&&s.candidate&&this.send({type:"webrtc/candidate",value:s.candidate.candidate})},t.onconnectionstatechange=()=>{e===this.generation&&(t.connectionState==="failed"||t.connectionState==="disconnected"||t.connectionState==="closed")&&this.webrtcFailed("WebRTC נכשל")},t.addTransceiver("video",{direction:"recvonly"}),t.addTransceiver("audio",{direction:"recvonly"});try{const s=await t.createOffer();await t.setLocalDescription(s),this.send({type:"webrtc/offer",value:s.sdp})}catch{this.webrtcFailed("WebRTC לא נתמך בדפדפן");return}window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>{if(this.status==="playing")return;const s=this.pc?.connectionState==="connected";this.webrtcFailed(s?"WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה — בחר MSE או אוטומטי":"WebRTC לא התחבר (UDP חסום?)")},ir)}webrtcFailed(e){if(this.status==="playing"&&this.transport==="webrtc"){this.fail("החיבור נותק");return}if(this.mode==="auto"&&!this.triedWebrtc){this.fail(e);return}this.mode==="auto"?(this.disconnect(),this.connect(!0)):this.fail(e)}startMse(){if(!("MediaSource"in window)){this.fail("MSE לא נתמך בדפדפן");return}window.clearTimeout(this.timer),this.transport="mse",this.queue=[],this.sb=null;const e=new MediaSource;this.ms=e,this.video.srcObject=null,this.video.src=URL.createObjectURL(e);const t=this.generation;e.addEventListener("sourceopen",()=>{if(t!==this.generation)return;const s=sr.filter(i=>MediaSource.isTypeSupported(`video/mp4; codecs="${i}"`)).join(",");this.send({type:"mse",value:s}),this.pendingMime&&this.openSourceBuffer(this.pendingMime)},{once:!0}),this.timer=window.setTimeout(()=>{this.status!=="playing"&&this.fail(`לא התקבל וידאו (${this.mseTrace()})`)},ar)}mseTrace(){const e=this.video;return`ms=${this.ms?.readyState??"-"} sb=${this.sb?"y":"n"} q=${this.queue.length} rs=${e?.readyState??"-"} buf=${e?.buffered.length?e.buffered.end(e.buffered.length-1).toFixed(1):"-"}`}openSourceBuffer(e){if(!this.ms||this.ms.readyState!=="open"){this.pendingMime=e;return}this.pendingMime="";try{const t=this.ms.addSourceBuffer(e);t.mode="segments",t.addEventListener("updateend",()=>this.flush()),this.sb=t,this.video.play().catch(()=>{}),this.flush()}catch{this.fail("הדפדפן לא תומך ב־codec של המצלמה")}}onSignal(e){let t;try{t=JSON.parse(e)}catch{return}switch(t.type){case"webrtc/answer":this.pc?.setRemoteDescription({type:"answer",sdp:t.value??""}).catch(()=>this.webrtcFailed("WebRTC: תשובה לא תקינה"));break;case"webrtc/candidate":this.pc?.addIceCandidate({candidate:t.value??"",sdpMid:"0"}).catch(()=>{});break;case"mse":this.openSourceBuffer(t.value??'video/mp4; codecs="avc1.640029"');break;case"error":this.transport==="webrtc"&&this.mode==="auto"?this.webrtcFailed(t.value??"WebRTC"):this.fail(t.value==="upstream_unavailable"?"go2rtc לא זמין":`שגיאת זרם: ${t.value??""}`);break}}onFragment(e){this.queue.push(e),this.flush()}evict(e){const t=this.sb,s=this.video;if(!t||t.updating||!s.buffered.length)return!1;const i=s.buffered.start(0),a=Math.max(i,s.currentTime-e);if(a-i<1)return!1;try{return t.remove(i,a),!0}catch{return!1}}flush(){const e=this.sb;if(!e||e.updating||!this.ms||this.ms.readyState!=="open")return;const t=this.video;if(t.buffered.length&&t.readyState<3&&t.currentTime<t.buffered.start(0)&&(t.currentTime=t.buffered.start(0)),t.buffered.length&&t.currentTime-t.buffered.start(0)>12&&this.evict(6))return;const s=this.queue.shift();if(s)try{e.appendBuffer(s)}catch(i){const a=i?.name??"Error";if(a==="QuotaExceededError"){this.queue.unshift(s),this.evict(2)||this.queue.shift();return}console.warn("sw-live-player: appendBuffer failed",a,i?.message),this.fail(`שגיאת buffer (${a})`)}}onTimeUpdate(){const e=this.video;if(this.transport!=="mse"||!e.buffered.length)return;const t=e.buffered.end(e.buffered.length-1);t-e.currentTime>2.5&&(e.currentTime=t-.5)}onPlaying(){window.clearTimeout(this.timer),this.attempts=0,this.status="playing",this.dispatchEvent(new CustomEvent("player-status",{detail:{status:"playing",transport:this.transport},bubbles:!0,composed:!0}))}toggleMute(){this.muted=!this.muted,this.video.muted=this.muted}fullscreen(){this.video.requestFullscreen?.()??Promise.resolve()}render(){const e=this.status!=="playing";return r`
      ${this.poster&&e?r`<img class="poster" src=${this.poster} alt="" />`:p}
      <video class=${e?"hidden":""} autoplay playsinline muted @playing=${this.onPlaying} @timeupdate=${this.onTimeUpdate}></video>
      ${this.status==="connecting"?r`<div class="center"><div><span class="spin"></span><span>מתחבר${this.transport?` · ${this.transport==="webrtc"?"WebRTC":"MSE"}`:""}…</span></div></div>`:p}
      ${this.status==="error"?r`<div class="center"><div><sw-icon name="offline" size=${22}></sw-icon><span>${this.error}</span></div></div>`:p}
      ${this.status==="ended"?r`<div class="center"><div><sw-icon name="history" size=${22}></sw-icon><span>הקטע הסתיים</span></div></div>`:p}
      ${this.status==="idle"&&!this.poster?r`<div class="center"><div><sw-icon name="camera" size=${22}></sw-icon><span>לא מחובר</span></div></div>`:p}
      <span class="status ${this.status}"><i></i><span class="t">${this.status==="playing"?`${this.wsUrl?"הקלטה":"חי"} · ${this.transport==="webrtc"?"WebRTC":"MSE"}`:this.status==="connecting"?"מתחבר":this.status==="error"?"לא זמין":this.status==="ended"?"הסתיים":"תמונה"}</span></span>
      ${this.status==="playing"?r`<button class="mute" title=${this.muted?"הפעל שמע":"השתק"} aria-label=${this.muted?"הפעל שמע":"השתק"} @click=${this.toggleMute}><sw-icon name=${this.muted?"volume":"mic"} size=${13}></sw-icon></button>`:p}
    `}};j.styles=v`
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
  `;J([h()],j.prototype,"cameraId",2);J([h()],j.prototype,"profile",2);J([h()],j.prototype,"mode",2);J([h()],j.prototype,"poster",2);J([h({type:Boolean})],j.prototype,"active",2);J([h({type:Boolean,reflect:!0})],j.prototype,"compact",2);J([h()],j.prototype,"wsUrl",2);J([h({type:Boolean})],j.prototype,"retry",2);J([d()],j.prototype,"status",2);J([d()],j.prototype,"transport",2);J([d()],j.prototype,"error",2);J([d()],j.prototype,"muted",2);J([gt("video")],j.prototype,"video",2);j=J([m("sw-live-player")],j);var or=Object.defineProperty,lr=Object.getOwnPropertyDescriptor,K=(e,t,s,i)=>{for(var a=i>1?void 0:i?lr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&or(t,s,a),a};let H=class extends w{constructor(){super(...arguments),this.name="",this.meta="",this.state="unknown",this.scene="lobby",this.selected=!1,this.compact=!1,this.dark=!1,this.noDemo=!1,this.stamp="",this.poster="",this.cameraId="",this.live=!1,this.profile="sub",this.transport="auto"}offMessage(){return this.state==="forbidden"?"אין הרשאת צפייה":this.state==="offline"?"המצלמה מנותקת":"מצב לא ידוע"}render(){if(this.state==="offline"||this.state==="forbidden"||this.state==="unknown")return r`<div class="off">
        <sw-icon name=${this.state==="forbidden"?"lock":"offline"} size=${this.compact?18:24}></sw-icon>
        <span>${this.offMessage()}</span>
        ${this.name?r`<span class="label"><span class="dot"></span>${this.name}</span>`:p}
      </div>`;const t=this.live&&this.cameraId?"live":this.poster?"poster":"scene";return r`
      ${t==="live"?r`<sw-live-player .cameraId=${this.cameraId} .profile=${this.profile} .mode=${this.transport} .poster=${this.poster} compact></sw-live-player>`:t==="poster"?r`<img class="poster" src=${this.poster} alt="" />`:r`<sw-scene kind=${this.scene}></sw-scene>`}
      <div class="shade"></div>
      ${t==="scene"&&!this.noDemo?r`<span class="demo">דמו</span>`:t==="poster"?r`<span class="demo">צילום</span>`:p}
      ${this.state==="stale"||this.state==="recorded"||this.state==="historic"?r`<sw-badge class="pill" onImage kind=${this.state}></sw-badge>`:p}
      ${this.name?r`<span class="label"><span class="dot"></span>${this.name}</span>`:p}
      ${this.stamp?r`<span class="stamp">${this.stamp}</span>`:this.meta&&!this.compact?r`<span class="meta">${this.meta}</span>`:p}
    `}};H.styles=v`
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
  `;K([h()],H.prototype,"name",2);K([h()],H.prototype,"meta",2);K([h({reflect:!0})],H.prototype,"state",2);K([h({reflect:!0})],H.prototype,"scene",2);K([h({type:Boolean,reflect:!0})],H.prototype,"selected",2);K([h({type:Boolean,reflect:!0})],H.prototype,"compact",2);K([h({type:Boolean,reflect:!0})],H.prototype,"dark",2);K([h({type:Boolean,reflect:!0})],H.prototype,"noDemo",2);K([h()],H.prototype,"stamp",2);K([h()],H.prototype,"poster",2);K([h()],H.prototype,"cameraId",2);K([h({type:Boolean})],H.prototype,"live",2);K([h()],H.prototype,"profile",2);K([h()],H.prototype,"transport",2);H=K([m("sw-camera-tile")],H);var dr=Object.defineProperty,cr=Object.getOwnPropertyDescriptor,Ye=(e,t,s,i)=>{for(var a=i>1?void 0:i?cr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&dr(t,s,a),a};const pr={loading:{icon:"clock",title:()=>f("states.loading"),hint:()=>"",tone:"neutral"},empty:{icon:"map",title:()=>f("states.empty"),hint:()=>"",tone:"neutral"},error:{icon:"warning",title:()=>f("states.error"),hint:()=>f("states.errorHint"),tone:"danger"},forbidden:{icon:"lock",title:()=>f("states.forbidden"),hint:()=>f("states.forbiddenHint"),tone:"forbidden"},stale:{icon:"offline",title:()=>f("states.stale"),hint:()=>f("states.staleHint"),tone:"stale"},partial:{icon:"info",title:()=>f("states.partial"),hint:()=>"",tone:"stale"}};let ye=class extends w{constructor(){super(...arguments),this.state="empty",this.heading="",this.hint="",this.actionLabel="",this.compact=!1}render(){const e=pr[this.state],t=this.hint||e.hint();return r`
      <div class="icon" aria-hidden="true"><sw-icon .name=${e.icon} size=${this.compact?20:26}></sw-icon></div>
      <div class="text" role="status">
        <h4>${this.heading||e.title()}</h4>
        ${t?r`<p>${t}</p>`:""}
        <slot></slot>
      </div>
      ${this.actionLabel?r`<sw-button variant=${this.state==="error"?"primary":"secondary"} size="sm" @click=${()=>this.dispatchEvent(new CustomEvent("action",{bubbles:!0,composed:!0}))}>${this.actionLabel}</sw-button>`:""}
    `}};ye.styles=v`
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
  `;Ye([h({reflect:!0})],ye.prototype,"state",2);Ye([h()],ye.prototype,"heading",2);Ye([h()],ye.prototype,"hint",2);Ye([h()],ye.prototype,"actionLabel",2);Ye([h({type:Boolean,reflect:!0})],ye.prototype,"compact",2);ye=Ye([m("sw-state-panel")],ye);var hr=Object.defineProperty,ur=Object.getOwnPropertyDescriptor,is=(e,t,s,i)=>{for(var a=i>1?void 0:i?ur(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&hr(t,s,a),a};let Fe=class extends w{constructor(){super(...arguments),this.open=!1,this.heading="",this.subheading="",this.onKey=e=>{e.key==="Escape"&&this.open&&this.close()}}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey)}render(){return r`<div class="backdrop" @click=${e=>e.target===e.currentTarget&&this.close()}>
      <div class="box" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <header><div><h3>${this.heading}</h3>${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}</div><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
        <div class="body"><slot></slot></div>
        <footer><slot name="footer"></slot></footer>
      </div>
    </div>`}};Fe.styles=v`
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
  `;is([h({type:Boolean,reflect:!0})],Fe.prototype,"open",2);is([h()],Fe.prototype,"heading",2);is([h()],Fe.prototype,"subheading",2);Fe=is([m("sw-dialog")],Fe);var fr=Object.defineProperty,wr=Object.getOwnPropertyDescriptor,W=(e,t,s,i)=>{for(var a=i>1?void 0:i?wr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&fr(t,s,a),a};const si=.2,ii=6,ai={live:"var(--sw-accent)",recorded:"var(--sw-accent)",historic:"var(--sw-accent)",offline:"var(--sw-offline)",stale:"var(--sw-stale)",unknown:"var(--sw-unknown)",forbidden:"var(--sw-forbidden)",error:"var(--sw-danger)",neutral:"var(--sw-surface)",partial:"var(--sw-stale)"},mr={camera:c`<path d="M-7 -4.5A1.5 1.5 0 0 1 -5.5 -6H-2l1.5-2h5L6 -6h1.5A1.5 1.5 0 0 1 9 -4.5v9A1.5 1.5 0 0 1 7.5 6h-13A1.5 1.5 0 0 1 -7 4.5z" transform="translate(-1 0) scale(0.9)"/><circle cx="-1" cy="0" r="3"/>`,lock:c`<rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/>`,light:c`<path d="M-3 6h6M-2 8.5h4"/><path d="M0 -8a5 5 0 0 0-3 9c.7.5 1.2 1.3 1.2 2.2h3.6c0-.9.5-1.7 1.2-2.2A5 5 0 0 0 0 -8z"/>`,binary_sensor:c`<circle cx="0" cy="0" r="2"/><path d="M-4.5 -4.5a6.4 6.4 0 0 0 0 9M4.5 -4.5a6.4 6.4 0 0 1 0 9"/>`};let I=class extends w{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.plan=null,this.markers=[],this.selectedId=null,this.dimEntities=!1,this.alwaysLabel=!1,this.imageUrl=null,this.editable=!1,this.scale=1,this.tx=0,this.ty=0,this.hoverId=null,this.dragging=null,this.pointers=new Map,this.lastPan=null,this.lastPinchDist=0,this.dragMoved=!1,this.fitted=!1,this.onWheel=e=>{e.preventDefault();const t=this.getBoundingClientRect();this.zoomBy(e.deltaY<0?1.15:1/1.15,e.clientX-t.left,e.clientY-t.top)},this.onMarkerPointerDown=(e,t)=>{if(!this.editable||t.button!==0)return;t.stopPropagation(),t.preventDefault(),this.dragging={id:e.id,x:e.x,y:e.y},this.viewport.setPointerCapture(t.pointerId);const s=a=>{const n=this.getBoundingClientRect(),o=this.toPlan(a.clientX-n.left,a.clientY-n.top);this.dragging={id:e.id,x:o.x,y:o.y}},i=a=>{this.viewport.removeEventListener("pointermove",s),this.viewport.removeEventListener("pointerup",i),this.viewport.removeEventListener("pointercancel",i);const n=this.getBoundingClientRect(),o=this.toPlan(a.clientX-n.left,a.clientY-n.top),l=Math.abs(o.x-e.x)>5e-4||Math.abs(o.y-e.y)>5e-4;this.dragging=null,l?this.dispatchEvent(new CustomEvent("marker-move",{detail:{id:e.id,x:o.x,y:o.y},bubbles:!0,composed:!0})):this.select(e,a)};this.viewport.addEventListener("pointermove",s),this.viewport.addEventListener("pointerup",i),this.viewport.addEventListener("pointercancel",i)},this.onPointerDown=e=>{this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.dragMoved=!1,this.pointers.size===1?(this.lastPan={x:e.clientX,y:e.clientY},this.viewport.classList.add("dragging")):this.pointers.size===2&&(this.lastPinchDist=this.pinchDistance(),this.lastPan=null)},this.onPointerMove=e=>{if(this.pointers.has(e.pointerId)){if(this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.pointers.size===2){const t=this.pinchDistance();if(this.lastPinchDist>0){const[s,i]=[...this.pointers.values()],a=this.getBoundingClientRect();this.zoomBy(t/this.lastPinchDist,(s.x+i.x)/2-a.left,(s.y+i.y)/2-a.top)}this.lastPinchDist=t,this.dragMoved=!0;return}if(this.lastPan){const t=e.clientX-this.lastPan.x,s=e.clientY-this.lastPan.y;!this.dragMoved&&Math.abs(t)+Math.abs(s)>2&&(this.dragMoved=!0,this.viewport.hasPointerCapture(e.pointerId)||this.viewport.setPointerCapture(e.pointerId)),this.tx+=t,this.ty+=s,this.lastPan={x:e.clientX,y:e.clientY}}}},this.onPointerUp=e=>{if(this.pointers.delete(e.pointerId),this.pointers.size===0)this.lastPan=null,this.viewport.classList.remove("dragging");else if(this.pointers.size===1){const[t]=[...this.pointers.values()];this.lastPan={x:t.x,y:t.y}}},this.onBackgroundClick=()=>{this.dragMoved||this.dispatchEvent(new CustomEvent("marker-select",{detail:{id:null},bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.fitted||this.fit()}),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect()}updated(e){(e.has("planWidth")||e.has("planHeight"))&&(this.fitted=!1,this.fit()),(e.has("scale")||e.has("tx")||e.has("ty"))&&this.dispatchEvent(new CustomEvent("view-change",{bubbles:!0,composed:!0}))}toScreen(e,t){return{x:this.tx+e*this.planWidth*this.scale,y:this.ty+t*this.planHeight*this.scale}}fit(){const e=this.clientWidth,t=this.clientHeight;if(!e||!t||!this.planWidth||!this.planHeight)return;const s=24,i=Math.min((e-s*2)/this.planWidth,(t-s*2)/this.planHeight);this.scale=Math.max(si,Math.min(ii,i)),this.tx=(e-this.planWidth*this.scale)/2,this.ty=(t-this.planHeight*this.scale)/2,this.fitted=!0}zoomBy(e,t,s){const i=this.clientWidth,a=this.clientHeight,n=t??i/2,o=s??a/2,l=Math.max(si,Math.min(ii,this.scale*e)),u=l/this.scale;this.tx=n-(n-this.tx)*u,this.ty=o-(o-this.ty)*u,this.scale=l,this.fitted=!0}toPlan(e,t){return{x:Math.min(1,Math.max(0,(e-this.tx)/this.scale/this.planWidth)),y:Math.min(1,Math.max(0,(t-this.ty)/this.scale/this.planHeight))}}pinchDistance(){const[e,t]=[...this.pointers.values()];return Math.hypot(e.x-t.x,e.y-t.y)}select(e,t){if(this.dragMoved)return;t.stopPropagation();const s=this.toScreen(e.x,e.y),i={id:e.id,sx:s.x,sy:s.y};this.dispatchEvent(new CustomEvent("marker-select",{detail:i,bubbles:!0,composed:!0}))}fovPath(e,t,s){const i=(e-t/2)*Math.PI/180,a=(e+t/2)*Math.PI/180,n=Math.cos(i)*s,o=Math.sin(i)*s,l=Math.cos(a)*s,u=Math.sin(a)*s;return`M0 0 L${n.toFixed(1)} ${o.toFixed(1)} A${s} ${s} 0 ${t>180?1:0} 1 ${l.toFixed(1)} ${u.toFixed(1)} Z`}renderMarker(e){const t=this.dragging?.id===e.id?this.dragging:e,s=t.x*this.planWidth,i=t.y*this.planHeight,a=1/this.scale,n=e.kind==="camera",o=ai[e.state]??ai.neutral,l=this.selectedId===e.id,u=this.alwaysLabel||l||this.hoverId===e.id,$=Math.max(44,e.label.length*6.5+16),b=this.dimEntities&&!n,y=n?13:11;return c`
      <g class="marker ${e.state} ${l?"selected":""} ${b?"dimmed":""} ${this.editable?"editable":""}"
         transform="translate(${s} ${i})"
         tabindex="0" role="button" aria-label=${e.label} aria-pressed=${l}
         @mouseenter=${()=>this.hoverId=e.id} @mouseleave=${()=>this.hoverId=null}
         @pointerdown=${M=>this.onMarkerPointerDown(e,M)}
         @click=${M=>this.editable?M.stopPropagation():this.select(e,M)}
         @keydown=${M=>(M.key==="Enter"||M.key===" ")&&this.select(e,M)}>
        ${n&&e.fov&&e.state!=="forbidden"?c`<path class="fov ${e.state==="offline"?"off":""}" d=${this.fovPath(e.rotation??0,e.fov,140)} />`:p}
        <g transform="scale(${a})">
          <circle class="halo" r=${y+9} />
          <circle class="pin" r=${y} fill=${o} />
          <g class="icon" transform="scale(${n?.85:.75})">${mr[e.kind]}</g>
          ${e.state==="offline"?c`<line x1="-9" y1="-9" x2="9" y2="9" stroke="#fff" stroke-width="2.5" />`:p}
          ${e.state==="forbidden"?c`<g transform="translate(8 -8)"><circle r="6.5" fill="#fff" /><g fill="none" stroke="var(--sw-forbidden)" stroke-width="1.5" transform="scale(0.45)"><rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/></g></g>`:p}
          ${u?c`<g transform="translate(0 ${y+14})">
                <rect class="lbl-bg" x=${-$/2} y="-10" width=${$} height="20" rx="6" />
                <text class="lbl" y="3.5">${e.label}</text>
              </g>`:p}
        </g>
      </g>
    `}render(){return r`
      <div class="viewport" @wheel=${this.onWheel} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
           @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp} @click=${this.onBackgroundClick}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl?c`<image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />`:p}
            ${this.plan??p}
            ${this.markers.map(e=>this.renderMarker(e))}
          </g>
        </svg>
      </div>
      <div class="controls" role="group" aria-label="זום">
        <sw-button variant="ghost" size="sm" iconOnly icon="plus" label=${f("floor.zoomIn")} @click=${()=>this.zoomBy(1.25)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="minus" label=${f("floor.zoomOut")} @click=${()=>this.zoomBy(.8)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="fit" label=${f("floor.fit")} @click=${()=>{this.fitted=!1,this.fit()}}></sw-button>
      </div>
      <div class="scale" aria-live="polite">${Math.round(this.scale*100)}%</div>
    `}};I.styles=v`
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
  `;W([h({type:Number})],I.prototype,"planWidth",2);W([h({type:Number})],I.prototype,"planHeight",2);W([h({attribute:!1})],I.prototype,"plan",2);W([h({attribute:!1})],I.prototype,"markers",2);W([h()],I.prototype,"selectedId",2);W([h({type:Boolean})],I.prototype,"dimEntities",2);W([h({type:Boolean})],I.prototype,"alwaysLabel",2);W([h()],I.prototype,"imageUrl",2);W([h({type:Boolean})],I.prototype,"editable",2);W([d()],I.prototype,"scale",2);W([d()],I.prototype,"tx",2);W([d()],I.prototype,"ty",2);W([d()],I.prototype,"hoverId",2);W([d()],I.prototype,"dragging",2);W([gt(".viewport")],I.prototype,"viewport",2);I=W([m("sw-plan-canvas")],I);const ri={name:"אתר הדגמה",building:"מבנה א"},xe=[{id:"f0",name:"קומה 0",hasPlan:!0,planWidth:1200,planHeight:800,cameraCount:6,entityCount:4},{id:"f-1",name:"קומה 1-",hasPlan:!0,planWidth:900,planHeight:1100,cameraCount:3,entityCount:1},{id:"f-2",name:"קומה 2-",hasPlan:!1,planWidth:0,planHeight:0,cameraCount:2,entityCount:0}],Bt=[{id:"cam-1",name:"כניסה ראשית",floorId:"f0",x:.09,y:.52,rotation:20,fov:70,state:"live",source:"NVR ערוץ 1"},{id:"cam-2",name:"לובי",floorId:"f0",x:.34,y:.3,rotation:120,fov:80,state:"live",source:"NVR ערוץ 2"},{id:"cam-3",name:"מסדרון מזרחי",floorId:"f0",x:.62,y:.55,rotation:180,fov:60,state:"offline",source:"NVR ערוץ 3"},{id:"cam-4",name:"אולם",floorId:"f0",x:.82,y:.22,rotation:210,fov:90,state:"live",source:"NVR ערוץ 4"},{id:"cam-5",name:"חדר מדרגות",floorId:"f0",x:.9,y:.8,rotation:250,fov:60,state:"stale",source:"NVR ערוץ 5"},{id:"cam-6",name:"חניה",floorId:"f0",x:.4,y:.86,rotation:300,fov:75,state:"forbidden",source:"NVR ערוץ 6"},{id:"cam-7",name:"מחסן",floorId:"f-1",x:.3,y:.3,rotation:45,fov:70,state:"live",source:"NVR ערוץ 7"},{id:"cam-8",name:"חדר מכונות",floorId:"f-1",x:.7,y:.6,rotation:200,fov:70,state:"live",source:"NVR ערוץ 8"},{id:"cam-9",name:"מקלט",floorId:"f-1",x:.5,y:.85,rotation:270,fov:70,state:"offline",source:"NVR ערוץ 9"}],ws=[{id:"lock.main_door",name:"דלת כניסה",floorId:"f0",x:.05,y:.4,domain:"lock",state:"locked",stateLabelKey:"entity.locked",controllable:!1,lastChanged:"לפני 12 דק׳"},{id:"light.lobby",name:"תאורת לובי",floorId:"f0",x:.3,y:.42,domain:"light",state:"on",stateLabelKey:"entity.on",controllable:!0,lastChanged:"לפני שעה"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",floorId:"f0",x:.7,y:.3,domain:"binary_sensor",state:"off",stateLabelKey:"entity.off",controllable:!1,lastChanged:"לפני 3 דק׳"},{id:"light.corridor",name:"תאורת מסדרון",floorId:"f0",x:.55,y:.66,domain:"light",state:"off",stateLabelKey:"entity.off",controllable:!0,lastChanged:"אתמול 22:10"},{id:"lock.shelter",name:"דלת מקלט",floorId:"f-1",x:.46,y:.9,domain:"lock",state:"locked",stateLabelKey:"entity.locked",controllable:!1,lastChanged:"לפני 2 שעות"}],Mi={f0:[{x:40,y:40,w:300,h:260,label:"לובי",kind:"lobby"},{x:40,y:340,w:300,h:220,label:"משרדים",kind:"office"},{x:40,y:600,w:460,h:160,label:"חניה מקורה",kind:"parking"},{x:380,y:40,w:420,h:300,label:"אולם",kind:"hall"},{x:840,y:40,w:320,h:300,label:"אולם ב",kind:"meeting"},{x:380,y:380,w:300,h:180,label:"חדר ישיבות",kind:"meeting"},{x:720,y:380,w:440,h:180,label:"מסדרון מזרחי",kind:"corridor"},{x:540,y:600,w:620,h:160,label:"שירותים ומדרגות",kind:"stairs"}],"f-1":[{x:40,y:40,w:400,h:400,label:"מחסן",kind:"storage"},{x:480,y:40,w:380,h:400,label:"חדר מכונות",kind:"machines"},{x:40,y:480,w:820,h:200,label:"מסדרון",kind:"corridor"},{x:40,y:720,w:820,h:340,label:"מקלט",kind:"shelter"}]};function ms(e){const t=Mi[e],s=xe.find(i=>i.id===e);return!t||!s?.hasPlan?[]:t.map(i=>({x:i.x/s.planWidth,y:i.y/s.planHeight,w:i.w/s.planWidth,h:i.h/s.planHeight}))}const R="var(--sw-map-furniture)",O="var(--sw-map-furniture-line)";function vr(e){const t=e.x+e.w/2,s=e.y+e.h/2;switch(e.kind){case"lobby":return c`<rect x=${e.x+30} y=${e.y+e.h-70} width="130" height="30" rx="4" fill=${R} stroke=${O} /><rect x=${e.x+170} y=${e.y+30} width="110" height="36" rx="10" fill=${R} stroke=${O} /><circle cx=${e.x+22} cy=${e.y+22} r="10" fill="#dfe9d9" stroke="#b9cfae" /><circle cx=${e.x+e.w-22} cy=${e.y+22} r="10" fill="#dfe9d9" stroke="#b9cfae" />`;case"office":return c`${[0,1].map(i=>[0,1,2].map(a=>c`<rect x=${e.x+30+a*92} y=${e.y+36+i*92} width="56" height="28" rx="2" fill=${R} stroke=${O} /><circle cx=${e.x+58+a*92} cy=${e.y+78+i*92} r="8" fill=${R} stroke=${O} />`))}`;case"parking":return c`${[0,1,2,3,4,5,6,7].map(i=>c`<line x1=${e.x+30+i*56} y1=${e.y+20} x2=${e.x+30+i*56} y2=${e.y+e.h-20} stroke=${O} stroke-dasharray="6 6" />`)}${[1,3,4].map(i=>c`<rect x=${e.x+42+i*56} y=${e.y+36} width="30" height="70" rx="8" fill="#d5dce8" stroke=${O} />`)}`;case"hall":return c`${[0,1,2,3].map(i=>[0,1,2,3,4,5].map(a=>c`<rect x=${e.x+50+a*56} y=${e.y+60+i*52} width="26" height="16" rx="3" fill=${R} stroke=${O} />`))}<rect x=${e.x+40} y=${e.y+20} width=${e.w-80} height="14" rx="2" fill=${R} stroke=${O} />`;case"meeting":return c`<rect x=${t-80} y=${s-26} width="160" height="52" rx="12" fill=${R} stroke=${O} />${[0,1,2].map(i=>c`<circle cx=${t-50+i*50} cy=${s-44} r="9" fill=${R} stroke=${O} /><circle cx=${t-50+i*50} cy=${s+44} r="9" fill=${R} stroke=${O} />`)}`;case"corridor":return c`<rect x=${e.x+30} y=${s-8} width="90" height="16" rx="3" fill=${R} stroke=${O} />`;case"stairs":return c`<rect x=${e.x+e.w-130} y=${e.y+30} width="100" height="100" fill=${R} stroke=${O} />${[1,2,3,4,5,6,7].map(i=>c`<line x1=${e.x+e.w-130} y1=${e.y+30+i*12.5} x2=${e.x+e.w-30} y2=${e.y+30+i*12.5} stroke=${O} />`)}${[0,1,2,3].map(i=>c`<rect x=${e.x+30+i*46} y=${e.y+30} width="36" height="46" fill=${R} stroke=${O} />`)}`;case"storage":return c`${[0,1,2,3].map(i=>c`<rect x=${e.x+40+i*92} y=${e.y+40} width="30" height=${e.h-80} fill=${R} stroke=${O} />`)}`;case"machines":return c`${[0,1,2].map(i=>c`<rect x=${e.x+40} y=${e.y+40+i*120} width="110" height="72" rx="4" fill=${R} stroke=${O} /><circle cx=${e.x+240} cy=${e.y+76+i*120} r="26" fill=${R} stroke=${O} />`)}`;case"shelter":return c`${[0,1,2,3].map(i=>c`<rect x=${e.x+60} y=${e.y+50+i*70} width="220" height="22" rx="3" fill=${R} stroke=${O} /><rect x=${e.x+e.w-280} y=${e.y+50+i*70} width="220" height="22" rx="3" fill=${R} stroke=${O} />`)}`;default:return""}}function Pi(e){const t=Mi[e],s=xe.find(i=>i.id===e);return!t||!s?null:c`
    <rect x="0" y="0" width=${s.planWidth} height=${s.planHeight} fill="var(--sw-map-bg)" />
    <rect x="20" y="20" width=${s.planWidth-40} height=${s.planHeight-40} fill="none" stroke="var(--sw-map-wall)" stroke-width="3" />
    ${t.map(i=>c`
        <rect x=${i.x} y=${i.y} width=${i.w} height=${i.h} fill="var(--sw-map-room-fill)" stroke="var(--sw-map-wall)" stroke-width="1.6" />
        ${vr(i)}
        <text x=${i.x+14} y=${i.y+26} text-anchor="start" font-size="15" font-weight="500" fill="var(--sw-map-label)" font-family="var(--sw-font)" direction="rtl" style="unicode-bidi: plaintext">${i.label}</text>
      `)}
  `}const vs=[{id:"site-a",name:"אתר הדגמה",address:"רחוב הדוגמה 1",buildings:2,cameras:10,online:9,alerts:2,health:"stale"},{id:"site-b",name:"סניף צפון",address:"שדרות הדגמה 20",buildings:1,cameras:6,online:6,alerts:0,health:"live"},{id:"site-c",name:"מחסן לוגיסטי",address:"אזור תעשייה",buildings:1,cameras:4,online:3,alerts:1,health:"offline"}],br=[{id:"bld-a",siteId:"site-a",name:"מבנה א",floors:[{id:"f0",name:"קומה 0",cameras:6,entities:4,hasPlan:!0},{id:"f-1",name:"קומה 1-",cameras:3,entities:1,hasPlan:!0},{id:"f-2",name:"קומה 2-",cameras:2,entities:0,hasPlan:!1}]},{id:"bld-b",siteId:"site-a",name:"מבנה ב",floors:[{id:"b-f0",name:"קרקע",cameras:1,entities:2,hasPlan:!1}]}],P=[{id:"cam-1",name:"כניסה ראשית",floor:"קומה 0",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 2 דק׳",recording:"continuous",ptz:!1,audio:!1},{id:"cam-2",name:"לובי",floor:"קומה 0",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 5 דק׳",recording:"motion",ptz:!1,audio:!0},{id:"cam-3",name:"מסדרון מזרחי",floor:"קומה 0",state:"offline",stream:"sub",fps:null,bitrateKbps:null,firmware:"V5.8.10",lastEvent:"לפני שעה",recording:"unknown",ptz:!1,audio:!1},{id:"cam-4",name:"אולם",floor:"קומה 0",state:"live",stream:"main",fps:25,bitrateKbps:5120,firmware:"V5.8.10",lastEvent:"לפני 12 דק׳",recording:"continuous",ptz:!0,audio:!1},{id:"cam-5",name:"חדר מדרגות",floor:"קומה 0",state:"stale",stream:"sub",fps:20,bitrateKbps:2048,firmware:"V5.8.9",lastEvent:"לפני 40 דק׳",recording:"continuous",ptz:!1,audio:!1},{id:"cam-6",name:"חניה מקורה",floor:"קומה 0",state:"forbidden",stream:"sub",fps:null,bitrateKbps:null,firmware:"—",lastEvent:"—",recording:"unknown",ptz:!1,audio:!1},{id:"cam-7",name:"מחסן",floor:"קומה 1-",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"לפני 3 שעות",recording:"motion",ptz:!1,audio:!1},{id:"cam-8",name:"חדר מכונות",floor:"קומה 1-",state:"live",stream:"sub",fps:25,bitrateKbps:3072,firmware:"V5.8.10",lastEvent:"אתמול",recording:"continuous",ptz:!1,audio:!1},{id:"cam-9",name:"מקלט",floor:"קומה 1-",state:"offline",stream:"sub",fps:null,bitrateKbps:null,firmware:"V5.8.10",lastEvent:"לפני יומיים",recording:"unknown",ptz:!1,audio:!1},{id:"cam-10",name:"חצר אחורית",floor:"חוץ",state:"live",stream:"sub",fps:25,bitrateKbps:4096,firmware:"V5.8.10",lastEvent:"לפני 8 דק׳",recording:"continuous",ptz:!0,audio:!0}],oe={"cam-1":"entrance","cam-2":"lobby","cam-3":"corridor","cam-4":"hall","cam-5":"corridor","cam-6":"parking","cam-7":"warehouse","cam-8":"warehouse","cam-9":"night","cam-10":"backyard"},bs={person:"זיהוי אדם",vehicle:"זיהוי רכב",motion:"תנועה",line:"חציית קו",offline:"מצלמה מנותקת",door:"דלת נפתחה"},he=[{id:"ev-1",time:"היום 10:14",minuteOfDay:614,type:"person",title:"אדם זוהה",camera:"כניסה ראשית",floor:"קומה 0",source:"NVR",acked:!1,severity:"alert"},{id:"ev-2",time:"היום 09:42",minuteOfDay:582,type:"vehicle",title:"רכב זוהה",camera:"חצר אחורית",floor:"חוץ",source:"NVR",acked:!1,severity:"info"},{id:"ev-3",time:"היום 08:31",minuteOfDay:511,type:"motion",title:"תנועה",camera:"מחסן",floor:"קומה 1-",source:"NVR",acked:!0,severity:"info"},{id:"ev-4",time:"היום 08:12",minuteOfDay:492,type:"door",title:"דלת כניסה נפתחה",camera:"כניסה ראשית",floor:"קומה 0",source:"HA",acked:!0,severity:"info"},{id:"ev-5",time:"היום 07:55",minuteOfDay:475,type:"offline",title:"מסדרון מזרחי מנותק",camera:"מסדרון מזרחי",floor:"קומה 0",source:"NVR",acked:!1,severity:"critical"},{id:"ev-6",time:"היום 06:43",minuteOfDay:403,type:"line",title:"חציית קו",camera:"חניה מקורה",floor:"קומה 0",source:"NVR",acked:!0,severity:"alert"},{id:"ev-7",time:"אתמול 23:10",minuteOfDay:1390,type:"person",title:"אדם זוהה",camera:"לובי",floor:"קומה 0",source:"NVR",acked:!0,severity:"info"}],Vt=[{startMin:0,endMin:190,kind:"continuous"},{startMin:205,endMin:460,kind:"continuous"},{startMin:470,endMin:474,kind:"motion"},{startMin:480,endMin:486,kind:"motion"},{startMin:492,endMin:640,kind:"continuous"},{startMin:660,endMin:1439,kind:"continuous"}],gs=[{id:"u-1",name:"יוני",haUser:"joni",active:!0,lastSync:"לפני 20 שנ׳",groups:["מנהלי מערכת"],bindings:[{role:"מנהל מערכת VMS",scope:"כל ההתקנה"}],haAdmin:!0},{id:"u-2",name:"דנה",haUser:"dana",active:!0,lastSync:"לפני 20 שנ׳",groups:["עורכי קומה 2"],bindings:[{role:"עורך מפות",scope:"מבנה א · קומה 2"}],haAdmin:!1},{id:"u-3",name:"יוסי",haUser:"yossi",active:!0,lastSync:"לפני 20 שנ׳",groups:["מנהלי מבנה א"],bindings:[{role:"מנהל אתר/מבנה",scope:"מבנה א"}],haAdmin:!1},{id:"u-4",name:"codex",haUser:"codex",active:!0,lastSync:"לפני 20 שנ׳",groups:[],bindings:[],haAdmin:!1},{id:"u-5",name:"רון",haUser:"ron",active:!1,lastSync:"לפני 3 ימים",groups:["צופים"],bindings:[{role:"צופה",scope:"אתר הדגמה"}],haAdmin:!1}],Ai=[{id:"g-1",name:"מנהלי מערכת",members:1,bindings:["מנהל מערכת VMS · כל ההתקנה"]},{id:"g-2",name:"עורכי קומה 2",members:1,bindings:["עורך מפות · מבנה א · קומה 2"]},{id:"g-3",name:"מנהלי מבנה א",members:1,bindings:["מנהל אתר/מבנה · מבנה א"]},{id:"g-4",name:"צופים",members:1,bindings:["צופה · אתר הדגמה"]}],Oi=[{id:"viewer",name:"צופה",allowed:"מפה, מצב ישויות מורשה, שידור חי",denied:"היסטוריה, עריכה, ייצוא, שליטה"},{id:"operator",name:"מפעיל",allowed:"צפייה, Playback, סקירת אירועים וסימון טיפול",denied:"עריכת מפות, תפקידים, ייצוא, פעולות פיזיות"},{id:"editor",name:"עורך מפות ותצוגות",allowed:"צפייה, יבוא/עריכה/פרסום מפות, מיקומים ותצוגות",denied:"Playback, ייצוא, משתמשים, סודות, שליטה"},{id:"site_admin",name:"מנהל אתר / מבנה / קומה",allowed:"מפעיל + עורך, הגדרות תוכן מקומיות",denied:"הגדרות מערכת, תפקידים, סודות, כתיבה ל־NVR"},{id:"system_admin",name:"מנהל מערכת VMS",allowed:"הגדרות מוצר, מקורות, מדיניות, קבוצות ושיוכים",denied:"ניהול HA, שליטה פיזית, ייצוא ראיות ללא grant"}],Ci=[{time:"10:24",user:"יוני",action:"צפייה חיה",resource:"כניסה ראשית",decision:"הותר",role:"מנהל מערכת · כל ההתקנה"},{time:"10:18",user:"דנה",action:"פרסום תוכנית",resource:"מבנה א · קומה 2",decision:"הותר",role:"עורך מפות · קומה 2"},{time:"10:11",user:"דנה",action:"עריכת תוכנית",resource:"מבנה א · קומה 3",decision:"נחסם: מחוץ להיקף",role:"עורך מפות · קומה 2"},{time:"09:55",user:"יוסי",action:"ייצוא קטע",resource:"לובי 09:10–09:20",decision:"נחסם: אין הרשאת ייצוא",role:"מנהל מבנה · מבנה א"},{time:"09:43",user:"codex",action:"כניסה דרך Ingress",resource:"—",decision:"הותר, ללא שיוך",role:"—"},{time:"09:30",user:"יוני",action:"הפעלת תאורה",resource:"light.lobby",decision:"הותר (HA אישר)",role:"מנהל מערכת"},{time:"08:12",user:"מערכת",action:"סנכרון משתמשים",resource:"HA bridge",decision:"5 משתמשים, 0 שינויים",role:"—"}],Ei=[{id:"job-1",title:"ייצוא: כניסה ראשית 09:10–09:25",status:"הושלם",progress:100,size:"182 MB",hash:"sha256 ✓"},{id:"job-2",title:"ייצוא: לובי 23:00–23:40",status:"בתהליך",progress:62,size:"—",hash:"—"},{id:"job-3",title:"תמונות מקדימות: קומה 0",status:"ממתין",progress:0,size:"—",hash:"—"},{id:"job-4",title:"ייצוא: חצר אחורית 02:00–04:00",status:"נכשל: פער בהקלטה",progress:35,size:"—",hash:"—"}],ys=[{id:"case-1",title:"כניסה לא מורשית — 13.09",status:"פתוח",owner:"יוני",clips:3,notes:2,preserved:2,missing:1},{id:"case-2",title:"נזק לרכב בחניה",status:"בבדיקה",owner:"יוסי",clips:2,notes:1,preserved:2,missing:0},{id:"case-3",title:"דלת מקלט פתוחה בלילה",status:"סגור",owner:"יוני",clips:1,notes:3,preserved:1,missing:0}],xs=[{id:"r-1",name:"אדם בלילה",trigger:"זיהוי אדם",scope:"חוץ · 22:00–06:00",action:"התראה + פתיחת מצלמות",enabled:!0,last:"אתמול 23:10"},{id:"r-2",name:"רכב באזור מוגבל",trigger:"זיהוי רכב",scope:"חניה מקורה",action:"התראה",enabled:!0,last:"היום 09:42"},{id:"r-3",name:"דלת נשארה פתוחה",trigger:"דלת > 60 שנ׳",scope:"כל הדלתות",action:"התראה + הקלטה",enabled:!0,last:"—"},{id:"r-4",name:"מצלמה מנותקת",trigger:"ניתוק",scope:"כל האתר",action:"התראה מיידית",enabled:!1,last:"היום 07:55"}],Ii=[{name:"NVR (הקלטה)",state:"live",detail:"10/10 ערוצים, דיסק תקין"},{name:"go2rtc (מדיה)",state:"live",detail:"גרסה ‎1.9.x‎ · 4 זרמים פעילים"},{name:"גשר Home Assistant",state:"stale",detail:"סנכרון אחרון לפני 4 דק׳"},{name:"מסד נתונים",state:"live",detail:"WAL · גיבוי אחרון אתמול 02:00"},{name:"תור עבודות",state:"partial",detail:"1 בתהליך · 1 נכשל"}],gr=["live","explore","investigate","system"];function ni(e=window.location.hash){const t=e.replace(/^#/,"")||"/explore/floors/f0",[s,i=""]=t.split("?"),a=s.startsWith("/")?s:`/${s}`,n=a.split("/").filter(Boolean),o=n[0];return{path:a,segments:n,params:new URLSearchParams(i),mode:o&&gr.includes(o)?o:null}}function g(e,t){const s=t?`?${new URLSearchParams(t).toString()}`:"";window.location.hash=`#${e}${s}`}function yr(e){const t=()=>e(ni());return window.addEventListener("hashchange",t),e(ni()),()=>window.removeEventListener("hashchange",t)}const $s=new Set;let pt={mode:"loading",me:null,error:null};function At(e){pt=e,$s.forEach(t=>t(pt))}function Ti(e){return $s.add(e),e(pt),()=>$s.delete(e)}async function xr(){try{const e=await D("me");At({mode:e.has_access?"api":"no_access",me:e,error:null})}catch(e){e instanceof fe&&e.status===401?At({mode:"unauthenticated",me:null,error:e.body.user_message}):e instanceof fe?At({mode:"demo",me:null,error:e.body.user_message}):At({mode:"demo",me:null,error:null})}return pt}const S=()=>pt.mode==="api";function $r(e){const t=xe.find(i=>i.id===e)??xe[0],s=Bt.filter(i=>i.floorId===t.id);return{source:"demo",floorId:t.id,floorName:t.name,buildingName:ri.building,siteName:ri.name,width:t.planWidth||1200,height:t.planHeight||800,imageUrl:null,planSvg:t.hasPlan?Pi(t.id):null,planStatus:t.hasPlan?"published":"none",planVersionId:t.hasPlan?`demo-${t.id}`:null,needsAlignment:!1,anchors:s.map((i,a)=>({id:`demo-anchor-${i.id}`,floor_id:t.id,plan_version_id:`demo-${t.id}`,resource_type:"camera",resource_id:i.id,position:{x:i.x,y:i.y},rotation_degrees:i.rotation,field_of_view_degrees:i.fov,layer_id:"cameras",label:i.name,revision:1,effective_from:"",effective_to:null,updated_at:"",camera:{id:i.id,recorder_id:"demo",channel:a+1,name:i.name,name_source:i.name,alias:null,enabled:!0,sort_order:a,main_track:null,sub_track:null,status:i.state==="offline"?"offline":"online",last_seen_at:null}})),cameras:[],permissions:{edit:!0,publish:!0,import:!0}}}async function Di(e,t=!1){if(!S())return $r(e);const s=await D(`floors/${e}/map${t?"?draft=true":""}`);return{source:"api",floorId:s.floor.id,floorName:s.floor.name,buildingName:s.building.name,siteName:s.site.name,width:s.plan?.width_px??1200,height:s.plan?.height_px??800,imageUrl:s.plan?Dt(s.plan.image_url):null,planSvg:null,planStatus:s.plan?s.plan.status==="published"?"published":"draft":"none",planVersionId:s.plan?.id??null,needsAlignment:s.needs_alignment,anchors:s.anchors,cameras:s.cameras,permissions:s.permissions}}function Nt(e,t){const s=e.camera;return s?s.status==="online"?"live":s.status==="offline"?"offline":t??"unknown":t??"unknown"}const kr=e=>D(`floors/${e}/plan-assets`),_r=(e,t)=>{const s=new FormData;return s.append("file",t,t.name),Ka(`floors/${e}/plan-assets`,s)},zr=(e,t)=>N(`floors/${e}/plan-versions`,t),Ni=e=>N(`plan-versions/${e}/publish`),oi=(e,t)=>N(`floors/${e}/anchors`,t),Sr=(e,t)=>ss(`map-anchors/${e}`,t),Mr=e=>kt(`map-anchors/${e}`),Ze=()=>D("cameras"),Pr=()=>N("cameras/sync"),Ar=e=>N("cameras",e),Or=(e,t)=>ss(`cameras/${e}`,t);function Cr(){return{source:"demo",sites:vs.map((t,s)=>({id:t.id,name:t.name,address:t.address,timezone:"Asia/Jerusalem",sort_order:s,updated_at:"",buildings:br.filter(i=>i.siteId===t.id).map((i,a)=>({id:i.id,site_id:t.id,name:i.name,sort_order:a,updated_at:"",floors:i.floors.map((n,o)=>{const l=xe.find(u=>u.id===n.id);return{id:n.id,building_id:i.id,name:n.name,level:-o,sort_order:o,ha_area_id:null,has_plan:n.hasPlan,published_version_id:n.hasPlan?`demo-${n.id}`:null,plan_width_px:l?.planWidth??null,plan_height_px:l?.planHeight??null,draft_version_id:null,anchor_count:n.cameras+n.entities,camera_count:n.cameras,updated_at:""}})}))})),canCreateSite:!0}}async function _t(){if(!S())return Cr();const e=await D("sites?tree=true");return{source:"api",sites:e.sites,canCreateSite:e.can_create_site}}const Er=e=>N("sites",e),Ri=(e,t)=>N(`sites/${e}/buildings`,t),Ir=(e,t)=>N(`buildings/${e}/floors`,t),Tr=(e,t)=>ss(`floors/${e}`,t),Dr=(e,t=!1)=>kt(`floors/${e}${t?"?force=true":""}`);function Hi(e,t){for(const s of e.sites)for(const i of s.buildings??[]){const a=(i.floors??[]).find(n=>n.id===t);if(a)return{site:s,building:i,floor:a}}return null}function Li(e){for(const t of e.sites)for(const s of t.buildings??[])for(const i of s.floors??[])return i;return null}function ji(e={}){const t=new URLSearchParams;e.domain&&t.set("domain",e.domain),e.q&&t.set("q",e.q),e.area&&t.set("area",e.area),e.placed!==void 0&&t.set("placed",String(e.placed)),e.includeDisabled&&t.set("include_disabled","true"),e.limit&&t.set("limit",String(e.limit));const s=t.toString();return D(`ha/entities${s?`?${s}`:""}`)}const Nr=()=>D("ha/status"),Rr=(e=!1)=>D(`ha/bridge/pairing${e?"?regenerate=true":""}`),li=e=>D(`ha/actions/${e}`);function Hr(e,t,s={},i=!1){const a={allowed_action_id:t,arguments:s,expected_state_version:null,confirmation_grant:i?"confirmed":null,client_request_id:crypto.randomUUID(),expires_at:new Date(Date.now()+6e4).toISOString().replace(/\.\d{3}Z$/,"Z")};return N(`ha/entities/${encodeURIComponent(e)}/actions`,a)}async function Lr(e,t,s){let i=await li(e);t(i);for(let a=0;a<16&&i.status==="pending";a++)await new Promise(n=>setTimeout(n,1500)),i=await li(e),t(i);return i}const jr={pending:"נשלח · ממתין לעדכון מ־Home Assistant",confirmed:"אושר · המצב התעדכן",unknown:"לא ידוע · לא התקבל עדכון מצב",failed:"נכשל",denied:"נדחה · אין הרשאה ב־Home Assistant"},Br=new Set(["on","open","opening","unlocked","unlocking","playing","home","heat","cool","heat_cool","dry","fan_only","cleaning","active","detected","problem","running"]),Ot={on:"דולק",off:"כבוי",locked:"נעול",unlocked:"פתוח",locking:"נועל…",unlocking:"פותח…",jammed:"תקוע",open:"פתוח",closed:"סגור",opening:"נפתח…",closing:"נסגר…",unavailable:"לא זמין",unknown:"לא ידוע",idle:"לא פעיל",home:"בבית",not_home:"מחוץ לבית",playing:"מנגן",paused:"מושהה",standby:"המתנה",heat:"חימום",cool:"קירור",auto:"אוטומטי",dry:"ייבוש",fan_only:"מאוורר",docked:"בתחנה",cleaning:"מנקה",returning:"חוזר"},Vr={motion:["תנועה","ללא תנועה"],occupancy:["נוכחות","ללא נוכחות"],presence:["נוכח","לא נוכח"],door:["פתוחה","סגורה"],window:["פתוח","סגור"],opening:["פתוח","סגור"],garage_door:["פתוח","סגור"],lock:["פתוח","נעול"],connectivity:["מחובר","מנותק"],power:["פועל","כבוי"],problem:["תקלה","תקין"],safety:["לא בטוח","בטוח"],smoke:["עשן","ללא עשן"],moisture:["רטוב","יבש"],battery:["סוללה חלשה","סוללה תקינה"],running:["פועל","לא פועל"],sound:["רעש","שקט"],vibration:["רטט","ללא רטט"],update:["עדכון זמין","מעודכן"]};function ht(e){const t=e.state;if(t==null)return"לא ידוע";if(t==="unavailable"||t==="unknown")return Ot[t];if(e.domain==="binary_sensor"){const s=Vr[e.device_class??""];return s?t==="on"?s[0]:s[1]:t==="on"?"פעיל":"לא פעיל"}if(e.domain==="sensor"||e.domain==="number"||e.domain==="input_number"){const s=Number(t);return!Number.isNaN(s)&&t.trim()!==""?`${Number.isInteger(s)?s:s.toFixed(Math.min(2,(t.split(".")[1]??"").length))}${e.unit?` ${e.unit}`:""}`:t}return e.domain==="light"&&t==="on"&&typeof e.attributes.brightness=="number"?`דולק · ${Math.round(e.attributes.brightness/255*100)}%`:e.domain==="cover"&&typeof e.attributes.current_position=="number"&&(t==="open"||t==="closed")?`${Ot[t]} · ${e.attributes.current_position}%`:e.domain==="climate"&&typeof e.attributes.current_temperature=="number"?`${Ot[t]??t} · ${e.attributes.current_temperature}°`:Ot[t]??t}function ks(e){return!e||e.removed_at?"unknown":e.state==="unavailable"||!e.available?"offline":e.fresh?e.state===null||e.state==="unknown"?"unknown":Br.has(e.state)?"live":"neutral":"stale"}function Bi(e,t){return e==="doors"||t==="lock"||t==="cover"?"lock":e==="lights"||t==="light"||t==="switch"||t==="fan"?"light":"binary_sensor"}function Ut(e){return{light:"תאורה",switch:"מתג",lock:"מנעול",cover:"תריס / שער",binary_sensor:"חיישן בינארי",sensor:"חיישן",fan:"מאוורר",climate:"אקלים",camera:"מצלמת HA",button:"כפתור",script:"סקריפט",scene:"סצנה",automation:"אוטומציה",media_player:"נגן",event:"אירוע",number:"מספר",select:"בחירה",input_boolean:"דגל",alarm_control_panel:"אזעקה",siren:"צופר",vacuum:"שואב",weather:"מזג אוויר",sun:"שמש"}[e]??e}function pe(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString("he-IL",{dateStyle:"short",timeStyle:"medium"})}function Vi(e,t){let s=null,i=!1,a=2e3;const n=(()=>{const l=new URL(ke("ha/ws"));return l.protocol=l.protocol==="https:"?"wss:":"ws:",l.toString()})(),o=()=>{if(!i){try{s=new WebSocket(n)}catch{return}s.onopen=()=>{a=2e3},s.onmessage=l=>{try{const u=JSON.parse(l.data);u.type==="entity_state_changed"?e({type:"entity_state_changed",entity:u.payload.entity}):u.type==="ha_sync_state"?e({type:"ha_sync_state",connected:!!u.payload.connected}):u.type==="heartbeat"&&e({type:"heartbeat",sync:u.payload.sync})}catch{}},s.onclose=l=>{!i&&l.code!==4403&&l.code!==4401&&(window.setTimeout(o,a),a=Math.min(3e4,a*2))}}};return o(),()=>{i=!0,s?.close()}}var Ur=Object.defineProperty,Wr=Object.getOwnPropertyDescriptor,L=(e,t,s,i)=>{for(var a=i>1?void 0:i?Wr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ur(t,s,a),a};const Fr=[{id:"cameras",icon:"camera",label:()=>f("floor.cameras")},{id:"doors",icon:"door",label:()=>f("floor.doors")},{id:"lights",icon:"light",label:()=>f("floor.lights")},{id:"sensors",icon:"sensor",label:()=>f("floor.sensors")}],di=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"];let C=class extends w{constructor(){super(...arguments),this.floorId="f0",this.screenState="ready",this.bundle=null,this.tree=null,this.loadError="",this.noFloors=!1,this.selectedId=null,this.anchor=null,this.layers=new Set(["cameras","doors","lights","sensors"]),this.pinned=!1,this.narrow=!1,this.syncConnected=!0,this.action=null,this.confirmSpec=null,this.stopWs=null,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.narrow=this.mq.matches}connectedCallback(){super.connectedCallback(),this.narrow=this.mq.matches,this.mq.addEventListener("change",this.onMq),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq),this.stopWs?.(),this.stopWs=null}startWs(){this.stopWs||!S()||(this.stopWs=Vi(e=>{const t=this.bundle;if(e.type==="entity_state_changed"&&t){if(!t.anchors.some(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entity.entity_id))return;this.bundle={...t,anchors:t.anchors.map(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entity.entity_id?{...s,entity:{...s.entity??{},...e.entity,actions:s.entity?.actions}}:s)}}else e.type==="ha_sync_state"?this.syncConnected=e.connected:e.type==="heartbeat"&&(this.syncConnected=e.sync.connected)}))}updated(e){e.has("floorId")&&e.get("floorId")!==void 0&&(this.selectedId=null,this.anchor=null,this.load())}async load(){this.loadError="";try{const e=this.tree??await _t();if(this.tree=e,S()&&!Hi(e,this.floorId)){const t=Li(e);if(t&&t.id!==this.floorId){g(`/explore/floors/${t.id}`);return}if(!t){this.noFloors=!0,this.bundle=null;return}}this.noFloors=!1,this.bundle=await Di(this.floorId),this.bundle.source==="api"&&this.startWs()}catch(e){this.loadError=x(e),this.bundle=null}}get floors(){return this.tree?.source==="api"?this.tree.sites.flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(s=>({id:s.id,name:`${t.name} · ${s.name}`,cameraCount:s.camera_count,hasPlan:s.has_plan})))):xe.map(e=>({id:e.id,name:e.name,cameraCount:e.cameraCount,hasPlan:e.hasPlan}))}get markers(){const e=this.bundle;if(!e)return[];const t=this.screenState==="stale";if(e.source==="demo"){const s=this.layers.has("cameras")?Bt.filter(a=>a.floorId===e.floorId).map(a=>({id:a.id,kind:"camera",label:a.name,x:a.x,y:a.y,rotation:a.rotation,fov:a.fov,state:a.state})):[],i=ws.filter(a=>a.floorId===e.floorId).filter(a=>a.domain==="lock"&&this.layers.has("doors")||a.domain==="light"&&this.layers.has("lights")||a.domain==="binary_sensor"&&this.layers.has("sensors")).map(a=>({id:a.id,kind:a.domain,label:a.name,x:a.x,y:a.y,state:t?"stale":"neutral"}));return[...s,...i]}return e.anchors.filter(s=>s.resource_type==="camera"?this.layers.has("cameras"):this.layers.has(s.layer_id==="doors"?"doors":s.layer_id==="lights"?"lights":"sensors")).map(s=>({id:s.id,kind:s.resource_type==="camera"?"camera":Bi(s.layer_id,s.entity?.domain),label:s.camera?.name??s.entity?.name??s.label??s.resource_id,x:s.position.x,y:s.position.y,rotation:s.rotation_degrees,fov:s.field_of_view_degrees??void 0,state:s.resource_type==="camera"?Nt(s):t?"stale":this.entityTone(s.entity)}))}toggleLayer(e){const t=new Set(this.layers);t.has(e)?t.delete(e):t.add(e),this.layers=t}onSelect(e){this.selectedId=e.detail.id,this.anchor=e.detail.id&&e.detail.sx!==void 0&&e.detail.sy!==void 0?{x:e.detail.sx,y:e.detail.sy}:null}onViewChange(){if(!this.selectedId||!this.canvas)return;const e=this.markers.find(s=>s.id===this.selectedId);if(!e)return;const t=this.canvas.toScreen(e.x,e.y);this.anchor={x:t.x,y:t.y}}close(){this.selectedId=null,this.anchor=null}entityTone(e){return e?ks({...e,fresh:e.fresh&&this.syncConnected}):"unknown"}trigger(e,t){if(t.sensitive){this.confirmSpec={entityId:e,spec:t};return}this.send(e,t,!1)}async send(e,t,s){this.confirmSpec=null,this.action={entityId:e,spec:t,record:null,error:"",busy:!0};try{const i=await Hr(e,t.id,{},s);if(this.action={entityId:e,spec:t,record:i,error:"",busy:i.status==="pending"},i.status==="pending"){const a=this.action;await Lr(i.id,n=>{(this.action===a||this.action?.record?.id===n.id)&&(this.action={entityId:e,spec:t,record:n,error:"",busy:n.status==="pending"})})}}catch(i){const a=i instanceof fe&&i.code==="bridge_not_paired"?"גשר SMPLWISE אינו מצומד ב־Home Assistant. התקנה וצימוד: הגדרות → גשר Home Assistant.":x(i);this.action={entityId:e,spec:t,record:null,error:a,busy:!1}}}apiEntityBody(e,t){const s=e.entity;if(!s)return r`<div class="note">ישות HA · <span class="ltr">${e.resource_id}</span> — לא נמצאה בקטלוג המסונכרן (ייתכן שהוסרה מ־Home Assistant).</div>`;const i=this.entityTone(s),a=this.action?.entityId===s.entity_id?this.action:null,n=s.fresh&&this.syncConnected;return r`
      <div class="statusrow"><sw-badge kind=${i} label=${ht(s)}></sw-badge><span>${t} · ${Ut(s.domain)}${s.area_name?` · ${s.area_name}`:""}</span></div>
      <dl class="meta">
        <dt>${f("entity.lastChanged")}</dt><dd>${pe(s.last_changed)}</dd>
        <dt>נראה לאחרונה</dt><dd>${pe(s.state_seen_at)}</dd>
        <dt>ID</dt><dd><span class="ltr">${s.entity_id}</span></dd>
      </dl>
      ${n?p:r`<div class="warn">${s.state==="unavailable"?"Home Assistant מדווח שהישות אינה זמינה.":"הסנכרון מול Home Assistant מנותק — המצב עלול להיות מיושן."}</div>`}
      ${s.actions===void 0?r`<div class="note">${f("entity.noControl")}</div>`:s.actions.length===0?r`<div class="note">קריאה בלבד — אין פעולות מותרות ל־${Ut(s.domain)}.</div>`:p}
      ${a?r`<div class=${a.error||a.record?.status==="failed"||a.record?.status==="denied"?"warn":"note"}>${a.spec.label}: ${a.error?a.error:a.record?`${jr[a.record.status]}${a.record.error&&a.record.status!=="denied"?` (${a.record.error})`:""}`:"שולח…"}</div>`:p}
    `}entityFooter(e){const t=e.entity,s=!!(this.action&&t&&this.action.entityId===t.entity_id&&this.action.busy),i=t?.actions??[];return r`${i.map(a=>r`<sw-button size="sm" variant=${a.sensitive?"danger":"primary"} ?disabled=${s||this.screenState==="stale"||t?.state==="unavailable"} @click=${()=>t&&this.trigger(t.entity_id,a)}>${a.label}</sw-button>`)}`}renderConfirm(){const e=this.confirmSpec;if(!e)return p;const t=this.bundle?.anchors.find(s=>s.resource_type==="ha_entity"&&s.resource_id===e.entityId)?.entity;return r`<sw-dialog open heading=${f("entity.confirm")} subheading=${t?.name??e.entityId} @close=${()=>this.confirmSpec=null}>
      <div style="font-size:var(--sw-fs-sm);line-height:1.5">הפעולה <strong>${e.spec.label}</strong> על <span class="ltr">${e.entityId}</span> מסומנת כרגישה. היא תבוצע ב־Home Assistant בזהות שלך ותירשם באודיט.</div>
      <div slot="footer"><sw-button variant="danger" @click=${()=>this.send(e.entityId,e.spec,!0)}>${e.spec.label}</sw-button><sw-button variant="ghost" @click=${()=>this.confirmSpec=null}>${f("actions.cancel")}</sw-button></div>
    </sw-dialog>`}demoCameraBody(e,t){const s=e.state==="offline"?f("camera.offlineReason"):e.state==="forbidden"?f("camera.forbiddenReason"):e.state==="stale"?f("camera.staleReason"):"",i=e.state==="live"||e.state==="stale";return r`
      ${i?r`<sw-camera-tile name="" state=${e.state} scene=${oe[e.id]??"lobby"} @click=${()=>g(`/live/cameras/${e.id}`)}></sw-camera-tile>`:r`<div class="off"><div><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${22}></sw-icon><div>${s}</div></div></div>`}
      <div class="statusrow"><sw-badge kind=${e.state}></sw-badge><span>${t} · ${e.source}</span></div>
      ${s&&i?r`<div class="warn">${s}</div>`:p}
    `}demoEntityBody(e){const t=this.screenState==="stale",s=t?"stale":e.state==="on"||e.state==="unlocked"?"live":"neutral";return r`
      <dl class="meta">
        <dt>${f("entity.state")}</dt><dd><sw-badge kind=${s} label=${f(e.stateLabelKey)}></sw-badge></dd>
        <dt>${f("entity.lastChanged")}</dt><dd>${e.lastChanged}</dd>
        <dt>ID</dt><dd><span class="ltr">${e.id}</span></dd>
      </dl>
      ${t?r`<div class="warn">${f("states.staleHint")}</div>`:p}
      ${e.controllable?p:r`<div class="note">${f("entity.noControl")}</div>`}
    `}apiCameraBody(e,t){const s=e.camera,i=Nt(e),a=di[((s?.channel??1)-1)%di.length];return r`
      ${i==="offline"?r`<div class="off"><div><sw-icon name="offline" size=${22}></sw-icon><div>${f("camera.offlineReason")}</div></div></div>`:r`<sw-camera-tile name="" state=${i==="live"?"live":"unknown"} scene=${a} poster=${s?ct(s.id,Date.now()):""} @click=${()=>s&&g(`/live/cameras/${s.id}`)}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${i}></sw-badge><span>${t} · ערוץ ${s?.channel??"?"}</span></div>
      <dl class="meta">
        <dt>שם ב־NVR</dt><dd>${s?.name_source||"—"}</dd>
        <dt>Track</dt><dd><span class="ltr">${s?.main_track??"?"} / ${s?.sub_track??"?"}</span></dd>
        <dt>נראתה לאחרונה</dt><dd>${s?.last_seen_at?s.last_seen_at.replace("T"," ").replace("Z"," UTC"):"לא נבדק"}</dd>
      </dl>
      <div class="note">התמונה היא צילום מה־NVR (מתרענן); "צפייה חיה" פותחת את הזרם.</div>
    `}renderCard(){const e=this.bundle;if(!this.selectedId||!e)return p;let t="",s="",i=p,a=p;if(e.source==="demo"){const l=Bt.find(b=>b.id===this.selectedId),u=l?void 0:ws.find(b=>b.id===this.selectedId);if(!l&&!u)return p;t=l?l.name:u.name,s=l?`${e.floorName} · ${l.source}`:`${e.floorName} · ${f(u.domain==="lock"?"entity.door":u.domain==="light"?"entity.light":"entity.sensor")}`,i=l?this.demoCameraBody(l,e.floorName):this.demoEntityBody(u);const $=l?l.state==="live"||l.state==="stale":!1;a=l?r`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${!$} @click=${()=>g(`/live/cameras/${l.id}`)}>צפייה חיה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${l.state==="forbidden"} @click=${()=>g("/investigate/playback")}>${f("camera.recordings")}</sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="pin" label=${this.pinned?f("camera.unpin"):f("camera.pin")} @click=${()=>this.pinned=!this.pinned}></sw-button>`:r`<sw-button variant="primary" size="sm" ?disabled=${!u.controllable||this.screenState==="stale"}>${f("entity.control")}</sw-button><sw-button variant="ghost" size="sm">${f("entity.openInHa")}</sw-button>`}else{const l=e.anchors.find(u=>u.id===this.selectedId);if(!l)return p;t=l.camera?.name??l.entity?.name??l.label??l.resource_id,s=`${e.buildingName} · ${e.floorName}`,i=l.resource_type==="camera"?this.apiCameraBody(l,e.floorName):this.apiEntityBody(l,e.floorName),a=r`${l.resource_type==="camera"?r`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${Nt(l)==="offline"} @click=${()=>l.camera&&g(`/live/cameras/${l.camera.id}`)}>צפייה חיה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${!l.camera} @click=${()=>l.camera&&g("/investigate/playback",{camera:l.camera.id})}>${f("camera.recordings")}</sw-button>`:this.entityFooter(l)}
        ${e.permissions.edit?r`<sw-button variant="ghost" size="sm" icon="edit" @click=${()=>g(`/explore/floors/${e.floorId}/edit`)}>עריכה</sw-button>`:p}`}if(this.narrow||!this.anchor)return r`<sw-drawer open heading=${t} subheading=${s} @close=${this.close}>${i}<div slot="footer">${a}</div></sw-drawer>`;const n=this.stage?.clientWidth??0,o=this.stage?.clientHeight??0;return r`<sw-popover heading=${t} .x=${this.anchor.x} .y=${this.anchor.y} .stageWidth=${n} .stageHeight=${o} @close=${this.close}>${i}<div slot="footer">${a}</div></sw-popover>`}renderStage(){const e=this.bundle;if(this.loadError)return r`<div class="cover"><sw-state-panel state="error" hint=${this.loadError} actionLabel=${f("states.retry")} @action=${()=>this.load()}></sw-state-panel></div>`;if(this.noFloors)return r`<div class="cover"><sw-state-panel state="empty" heading="עדיין אין קומות" hint="צור אתר, מבנה וקומה ואז ייבא תוכנית קומה."><div style="margin-block-start:10px"><sw-button variant="primary" icon="building" @click=${()=>g("/explore/sites")}>לאתרים ומבנים</sw-button></div></sw-state-panel></div>`;if(!e)return r`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;switch(this.screenState){case"loading":return r`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;case"error":return r`<div class="cover"><sw-state-panel state="error" actionLabel=${f("states.retry")}></sw-state-panel></div>`;case"forbidden":return r`<div class="cover"><sw-state-panel state="forbidden"></sw-state-panel></div>`}return this.screenState==="empty"||e.planStatus==="none"?r`<div class="cover">
        <sw-state-panel state="empty" heading=${f("floor.noPlan")} hint=${e.permissions.import?f("floor.noPlanHint"):"עורך המפות של הקומה יכול להעלות תוכנית."}>
          <div style="display:flex;gap:8px;margin-block-start:10px;justify-content:center;flex-wrap:wrap">
            ${e.permissions.import?r`<sw-button variant="primary" icon="upload" @click=${()=>g(`/explore/floors/${e.floorId}/import`)}>${f("floor.uploadPlan")}</sw-button>`:p}
            <sw-button icon="list" @click=${()=>g("/live/wall")}>${f("floor.listView")}</sw-button>
          </div>
        </sw-state-panel>
      </div>`:r`
      ${this.screenState==="stale"||this.screenState==="partial"?r`<div class="banner"><sw-state-panel compact state=${this.screenState}></sw-state-panel></div>`:e.needsAlignment?r`<div class="banner"><sw-state-panel compact state="partial" heading="פריטים הוצבו על גרסת תוכנית קודמת" hint="בדוק שהמיקומים עדיין נכונים על הרקע החדש (עורך התוכנית)."></sw-state-panel></div>`:p}
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
            <span>${i} מצלמות${e?.source==="demo"?" · נתוני הדגמה":e?.planStatus==="published"?" · תוכנית מפורסמת":""}</span>
            ${a?.draft_version_id?r`<sw-badge kind="stale" label="טיוטת תוכנית ממתינה לפרסום"></sw-badge>`:p}
          </div>
        </div>
        <div class="spacer"></div>
        <div class="tools">
          <div class="layers" role="group" aria-label=${f("floor.layers")}>
            ${Fr.map(n=>r`<button class=${this.layers.has(n.id)?"on":""} title=${n.label()} aria-label=${n.label()} aria-pressed=${this.layers.has(n.id)} @click=${()=>this.toggleLayer(n.id)}><sw-icon name=${n.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-field><select aria-label=${f("floor.switcher")} @change=${n=>g(`/explore/floors/${n.target.value}`)}>${t.map(n=>r`<option value=${n.id} ?selected=${n.id===this.floorId}>${n.name} · ${n.cameraCount} מצלמות${n.hasPlan?"":" · אין תוכנית"}</option>`)}</select></sw-field>
          ${!e||e.permissions.edit?r`<sw-button icon="edit" @click=${()=>g(`/explore/floors/${this.floorId}/edit`)}>עריכת תוכנית</sw-button>`:p}
        </div>
      </div>
      <div class="stage">${this.renderStage()}</div>
    `}};C.styles=v`
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
  `;L([h()],C.prototype,"floorId",2);L([h()],C.prototype,"screenState",2);L([d()],C.prototype,"bundle",2);L([d()],C.prototype,"tree",2);L([d()],C.prototype,"loadError",2);L([d()],C.prototype,"noFloors",2);L([d()],C.prototype,"selectedId",2);L([d()],C.prototype,"anchor",2);L([d()],C.prototype,"layers",2);L([d()],C.prototype,"pinned",2);L([d()],C.prototype,"narrow",2);L([d()],C.prototype,"syncConnected",2);L([d()],C.prototype,"action",2);L([d()],C.prototype,"confirmSpec",2);L([gt("sw-plan-canvas")],C.prototype,"canvas",2);L([gt(".stage")],C.prototype,"stage",2);C=L([m("explore-floor-map")],C);var qr=Object.defineProperty,Kr=Object.getOwnPropertyDescriptor,Xe=(e,t,s,i)=>{for(var a=i>1?void 0:i?Kr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&qr(t,s,a),a};let $e=class extends w{constructor(){super(...arguments),this.heading="",this.subheading="",this.crumbs="",this.wide=!1,this.flush=!1}render(){const e=this.crumbs?this.crumbs.split("|").map(t=>t.trim()):[];return r`
      <header>
        <div>
          ${e.length?r`<div class="crumbs">${e.map((t,s)=>r`${s?r`<sw-icon name="chevron" size=${11}></sw-icon>`:""}<span>${t}</span>`)}</div>`:""}
          <h1>${this.heading}</h1>
          ${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}
        </div>
        <div class="actions"><slot name="actions"></slot></div>
      </header>
      <div class="body"><slot></slot></div>
    `}};$e.styles=v`
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
  `;Xe([h()],$e.prototype,"heading",2);Xe([h()],$e.prototype,"subheading",2);Xe([h()],$e.prototype,"crumbs",2);Xe([h({type:Boolean,reflect:!0})],$e.prototype,"wide",2);Xe([h({type:Boolean,reflect:!0})],$e.prototype,"flush",2);$e=Xe([m("sw-page")],$e);var Jr=Object.defineProperty,Gr=Object.getOwnPropertyDescriptor,zt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Gr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Jr(t,s,a),a};let Ee=class extends w{constructor(){super(...arguments),this.heading="",this.subheading="",this.flush=!1,this.interactive=!1}render(){return r`
      ${this.heading||this.querySelector('[slot="actions"]')?r`<header><div><h3>${this.heading}</h3>${this.subheading?r`<div class="sub">${this.subheading}</div>`:""}</div><slot name="actions"></slot></header>`:""}
      <slot></slot>
    `}};Ee.styles=v`
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
  `;zt([h()],Ee.prototype,"heading",2);zt([h()],Ee.prototype,"subheading",2);zt([h({type:Boolean,reflect:!0})],Ee.prototype,"flush",2);zt([h({type:Boolean,reflect:!0})],Ee.prototype,"interactive",2);Ee=zt([m("sw-card")],Ee);var Yr=Object.defineProperty,Zr=Object.getOwnPropertyDescriptor,_e=(e,t,s,i)=>{for(var a=i>1?void 0:i?Zr(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Yr(t,s,a),a};const Xr=["house","building","warehouse"];let le=class extends w{constructor(){super(...arguments),this.tab="all",this.tree=null,this.dialog=null,this.formName="",this.formAddress="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.reload()}async reload(){try{this.tree=await _t()}catch(e){this.error=x(e)}}open(e){this.formName="",this.formAddress="",this.error="",this.dialog=e}async submit(){const e=this.dialog;if(e){this.busy=!0,this.error="";try{if(e.kind==="site"){const t=await Er({name:this.formName.trim(),address:this.formAddress.trim()});this.dialog=null,await this.reload(),this.open({kind:"building",site:t})}else{const t=await Ri(e.site.id,{name:this.formName.trim()});this.dialog=null,g(`/explore/buildings/${t.id}/floors`)}}catch(t){this.error=x(t)}finally{this.busy=!1}}}openSite(e){const t=e.buildings?.[0];t?g(`/explore/buildings/${t.id}/floors`):this.open({kind:"building",site:e})}renderSites(e){return r`<div class="grid">
      ${e.sites.map((t,s)=>{const i=t.buildings??[],a=i.reduce((n,o)=>n+(o.floors??[]).reduce((l,u)=>l+u.camera_count,0),0);return r`<sw-card flush interactive @click=${()=>this.openSite(t)}>
          <div class="pic"><sw-scene kind=${Xr[s%3]}></sw-scene>${e.source==="demo"?r`<span class="demo">דמו</span>`:r`<span class="demo">איור</span>`}</div>
          <div class="info">
            <div><b>${t.name}</b><small>${i.length} ${i.length===1?"מבנה":"מבנים"} · ${a} מצלמות${t.address?` · ${t.address}`:""}</small></div>
            <sw-button variant="ghost" size="sm" iconOnly icon="plus" label="מבנה חדש" @click=${n=>{n.stopPropagation(),this.open({kind:"building",site:t})}}></sw-button>
          </div>
        </sw-card>`})}
      ${e.canCreateSite?r`<button class="add" @click=${()=>this.open({kind:"site"})}><div><div class="ic"><sw-icon name="plus" size=${18}></sw-icon></div><strong>הוספת אתר חדש</strong><small>יצירת מיקום חדש כדי להתחיל</small></div></button>`:p}
    </div>`}renderBuildings(e){const t=e.sites.flatMap(s=>(s.buildings??[]).map(i=>({s,b:i})));return r`<div class="blist">
      ${t.map(({s,b:i},a)=>r`<sw-card class="brow" @click=${()=>g(`/explore/buildings/${i.id}/floors`)}>
          <sw-scene kind=${a%2?"house":"building"}></sw-scene>
          <div><b>${i.name}</b><small>${s.name} · ${(i.floors??[]).length} קומות · ${(i.floors??[]).reduce((n,o)=>n+o.camera_count,0)} מצלמות</small></div>
          <sw-icon name="chevron" size=${14}></sw-icon>
        </sw-card>`)}
      ${t.length?p:r`<div class="map" style="min-block-size:120px">אין מבנים עדיין.</div>`}
    </div>`}render(){const e=this.tree;if(!e)return r`<sw-page heading="אתרים ומבנים"><sw-state-panel state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const t=this.dialog;return r`
      <sw-page heading="אתרים ומבנים" subheading=${`ניהול המיקומים והמבנים שלך${e.source==="demo"?" · נתוני הדגמה":""}`}>
        ${e.canCreateSite?r`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button>`:p}
        <sw-tabs .items=${[{id:"all",label:"כל האתרים",count:e.sites.length},{id:"buildings",label:"מבנים",count:e.sites.reduce((s,i)=>s+(i.buildings?.length??0),0)},{id:"map",label:"מפה"}]} .active=${this.tab} @change=${s=>this.tab=s.detail.id}></sw-tabs>
        ${e.sites.length===0&&this.tab==="all"?r`<sw-state-panel state="empty" heading="עוד אין אתרים" hint="התחל ביצירת האתר הראשון; אחר כך מבנה, קומות ותוכניות.">${e.canCreateSite?r`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button></div>`:p}</sw-state-panel>`:this.tab==="all"?this.renderSites(e):this.tab==="buildings"?this.renderBuildings(e):r`<div class="map">מפת אתרים (לוח 3 · מסך 17) תצטרף עם שכבת מיקום גאוגרפי · Beta</div>`}
        ${t?r`<sw-dialog open heading=${t.kind==="site"?"אתר חדש":"מבנה חדש"} subheading=${t.kind==="building"?t.site.name:"שם, כתובת ואזור זמן ברירת מחדל Asia/Jerusalem"} @close=${()=>this.dialog=null}>
              <sw-field label="שם"><input .value=${this.formName} @input=${s=>this.formName=s.target.value} placeholder=${t.kind==="site"?"למשל: משרדי החברה":"למשל: מבנה א"} /></sw-field>
              ${t.kind==="site"?r`<sw-field label="כתובת (אופציונלי)"><input .value=${this.formAddress} @input=${s=>this.formAddress=s.target.value} /></sw-field>`:p}
              ${this.error?r`<div class="err">${this.error}</div>`:p}
              ${e.source==="demo"?r`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:p}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||e.source==="demo"} @click=${()=>this.submit()}>${t.kind==="site"?"צור אתר":"צור מבנה"}</sw-button>
            </sw-dialog>`:p}
      </sw-page>
    `}};le.styles=v`
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
  `;_e([d()],le.prototype,"tab",2);_e([d()],le.prototype,"tree",2);_e([d()],le.prototype,"dialog",2);_e([d()],le.prototype,"formName",2);_e([d()],le.prototype,"formAddress",2);_e([d()],le.prototype,"busy",2);_e([d()],le.prototype,"error",2);le=_e([m("explore-sites")],le);var Qr=Object.defineProperty,en=Object.getOwnPropertyDescriptor,St=(e,t,s,i)=>{for(var a=i>1?void 0:i?en(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Qr(t,s,a),a};let Ie=class extends w{constructor(){super(...arguments),this.rooms=[],this.selected=!1,this.empty=!1,this.width=132}iso(e,t){return{x:60+(e-t)*58,y:6+(e+t)*26}}poly(e){return e.map(t=>`${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(" ")}render(){this.style.setProperty("--w",`${this.width}px`);const e=[this.iso(0,0),this.iso(1,0),this.iso(1,1),this.iso(0,1)],t=7,s=[this.iso(1,0),this.iso(1,1),{x:this.iso(1,1).x,y:this.iso(1,1).y+t},{x:this.iso(1,0).x,y:this.iso(1,0).y+t}],i=[this.iso(0,1),this.iso(1,1),{x:this.iso(1,1).x,y:this.iso(1,1).y+t},{x:this.iso(0,1).x,y:this.iso(0,1).y+t}];return r`<svg viewBox="0 0 120 72" aria-hidden="true">
      ${c`<polygon class="side" points=${this.poly(s)} /><polygon class="side" points=${this.poly(i)} />`}
      ${c`<polygon class="top" points=${this.poly(e)} />`}
      ${this.empty?"":this.rooms.map(a=>c`<polygon class="room" points=${this.poly([this.iso(a.x,a.y),this.iso(a.x+a.w,a.y),this.iso(a.x+a.w,a.y+a.h),this.iso(a.x,a.y+a.h)])} />`)}
    </svg>`}};Ie.styles=v`
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
  `;St([h({attribute:!1})],Ie.prototype,"rooms",2);St([h({type:Boolean,reflect:!0})],Ie.prototype,"selected",2);St([h({type:Boolean,reflect:!0})],Ie.prototype,"empty",2);St([h({type:Number})],Ie.prototype,"width",2);Ie=St([m("sw-floor-iso")],Ie);var tn=Object.defineProperty,sn=Object.getOwnPropertyDescriptor,ce=(e,t,s,i)=>{for(var a=i>1?void 0:i?sn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&tn(t,s,a),a};let se=class extends w{constructor(){super(...arguments),this.buildingId="bld-a",this.tree=null,this.selected=null,this.tab="floors",this.dialog=null,this.busy=!1,this.error="",this.formName="",this.formLevel=0}connectedCallback(){super.connectedCallback(),this.reload()}updated(e){e.has("buildingId")&&e.get("buildingId")!==void 0&&(this.selected=null)}async reload(){try{this.tree=await _t(),this.error=""}catch(e){this.error=x(e)}}get context(){if(!this.tree)return null;for(const s of this.tree.sites)for(const i of s.buildings??[])if(i.id===this.buildingId)return{site:s,building:i};const e=this.tree.sites[0],t=e?.buildings?.[0];return e&&t?{site:e,building:t}:null}async run(e){this.busy=!0,this.error="";try{await e(),this.dialog=null,await this.reload()}catch(t){t instanceof fe&&t.code==="has_anchors"&&this.dialog?.kind==="delete"?(this.dialog={...this.dialog,force:!0},this.error=`${t.body.user_message} (${t.body.details.anchors??""} פריטים)`):this.error=x(t)}finally{this.busy=!1}}openDialog(e){this.error="",this.formName=e?.kind==="rename"?e.floor.name:"",this.formLevel=e?.kind==="rename"?e.floor.level:0,this.dialog=e}renderDialog(e){const t=this.dialog;if(!t)return p;const s=this.tree?.source==="demo",i=r`<sw-field label="שם"><input .value=${this.formName} @input=${l=>this.formName=l.target.value} placeholder="למשל: קומה 1" autofocus /></sw-field>`,a=r`<sw-field label="מפלס (0 = קרקע, שלילי = מרתף)" hint="קובע את סדר התצוגה בין הקומות"><input type="number" data-ltr .value=${String(this.formLevel)} @input=${l=>this.formLevel=Number(l.target.value)} /></sw-field>`,n=this.error?r`<div class="err">${this.error}</div>`:p,o=s?r`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:p;switch(t.kind){case"floor":return r`<sw-dialog open heading="קומה חדשה" subheading=${`${e.name}`} @close=${()=>this.dialog=null}>
          ${i}${a}${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||s} @click=${()=>this.run(async()=>{const l=await Ir(e.id,{name:this.formName.trim(),level:this.formLevel});this.selected=l.id})}>הוסף קומה</sw-button>
        </sw-dialog>`;case"rename":return r`<sw-dialog open heading="עריכת קומה" subheading=${t.floor.name} @close=${()=>this.dialog=null}>
          ${i}${a}${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||s} @click=${()=>this.run(()=>Tr(t.floor.id,{name:this.formName.trim(),level:this.formLevel}))}>שמירה</sw-button>
        </sw-dialog>`;case"delete":return r`<sw-dialog open heading="מחיקת קומה" subheading=${t.floor.name} @close=${()=>this.dialog=null}>
          <div style="font-size:var(--sw-fs-sm)">${t.force?"על הקומה מוצבים פריטים. מחיקה תסיר אותם מהמפה (ההיסטוריה נשמרת באודיט). להמשיך?":"הקומה תוסר מהמערכת. תוכניות שפורסמו נשמרות בארכיון; מצלמות והקלטות ב־NVR אינן נמחקות."}</div>
          ${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="danger" ?disabled=${this.busy||s} @click=${()=>this.run(async()=>{await Dr(t.floor.id,t.force),this.selected===t.floor.id&&(this.selected=null)})}>${t.force?"מחק כולל הפריטים":"מחק קומה"}</sw-button>
        </sw-dialog>`;case"building":return r`<sw-dialog open heading="מבנה חדש" subheading=${this.context?.site.name??""} @close=${()=>this.dialog=null}>
          ${i}${n}${o}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||s} @click=${()=>this.run(async()=>{const l=await Ri(this.context.site.id,{name:this.formName.trim()});g(`/explore/buildings/${l.id}/floors`)})}>הוסף מבנה</sw-button>
        </sw-dialog>`}}render(){if(!this.tree)return r`<sw-page heading="קומות"><sw-state-panel state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const e=this.context;if(!e)return r`<sw-page heading="קומות" subheading="אין עדיין אתרים ומבנים">
        <sw-state-panel state="empty" heading="עוד אין מבנים" hint="צור אתר ומבנה כדי להוסיף קומות ותוכניות.">
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>g("/explore/sites")}>לאתרים</sw-button></div>
        </sw-state-panel>
      </sw-page>`;const{site:t,building:s}=e,i=s.floors??[],a=i.find(l=>l.id===this.selected)??i[0]??null,n=i.reduce((l,u)=>l+u.camera_count,0),o=this.tree;return r`
      <sw-page heading=${s.name} subheading=${`${t.address||t.name} · ${i.length} קומות${o.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${t.name} | ${s.name}`}>
        <div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>
        <sw-tabs .items=${[{id:"floors",label:"קומות",count:i.length},{id:"cameras",label:"מצלמות",count:n},{id:"details",label:"פרטים"}]} .active=${this.tab} @change=${l=>this.tab=l.detail.id}></sw-tabs>
        ${this.tab==="floors"?r`<div class="list">
              ${i.length?p:r`<div class="empty">למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה).</div>`}
              ${i.map(l=>r`<button class="floor ${a?.id===l.id?"on":""}" @click=${()=>a?.id===l.id?g(`/explore/floors/${l.id}`):this.selected=l.id} aria-pressed=${a?.id===l.id}>
                  <div class="txt">
                    <div class="title">${l.name}</div>
                    <div class="counts">${l.camera_count} מצלמות · ${l.anchor_count} פריטים במפה · מפלס ${l.level}${l.has_plan?"":" · אין תוכנית עדיין"}${l.draft_version_id?" · טיוטה ממתינה לפרסום":""}</div>
                  </div>
                  <sw-floor-iso .rooms=${o.source==="demo"?ms(l.id):[]} ?selected=${a?.id===l.id} ?empty=${!l.has_plan} width=${128}></sw-floor-iso>
                  <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
                </button>`)}
              ${this.error&&!this.dialog?r`<div class="err">${this.error}</div>`:p}
              <div class="actions">
                <div>
                  <sw-button icon="plus" @click=${()=>this.openDialog({kind:"floor"})}>קומה חדשה</sw-button>
                  <sw-button variant="ghost" icon="building" @click=${()=>this.openDialog({kind:"building"})}>מבנה חדש</sw-button>
                </div>
                ${a?r`<div>
                      <sw-button variant="ghost" icon="edit" @click=${()=>this.openDialog({kind:"rename",floor:a})}>עריכה</sw-button>
                      <sw-button variant="ghost" icon="trash" @click=${()=>this.openDialog({kind:"delete",floor:a,force:!1})}>מחיקה</sw-button>
                      <sw-button icon="upload" @click=${()=>g(`/explore/floors/${a.id}/import`)}>${a.has_plan?"תוכנית חדשה":"העלאת תוכנית"}</sw-button>
                      <sw-button variant="primary" icon="map" @click=${()=>g(`/explore/floors/${a.id}`)}>פתח את ${a.name}</sw-button>
                    </div>`:p}
              </div>
            </div>`:this.tab==="cameras"?r`<div class="cams">${i.map(l=>r`<sw-card heading=${l.name} subheading="${l.camera_count} מצלמות" interactive @click=${()=>g(`/explore/floors/${l.id}`)}></sw-card>`)}</div>`:r`<sw-card heading="פרטי המבנה">
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
    `}};se.styles=v`
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
  `;ce([h()],se.prototype,"buildingId",2);ce([d()],se.prototype,"tree",2);ce([d()],se.prototype,"selected",2);ce([d()],se.prototype,"tab",2);ce([d()],se.prototype,"dialog",2);ce([d()],se.prototype,"busy",2);ce([d()],se.prototype,"error",2);ce([d()],se.prototype,"formName",2);ce([d()],se.prototype,"formLevel",2);se=ce([m("explore-floors")],se);var an=Object.defineProperty,rn=Object.getOwnPropertyDescriptor,Hs=(e,t,s,i)=>{for(var a=i>1?void 0:i?rn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&an(t,s,a),a};let ut=class extends w{constructor(){super(...arguments),this.steps=[],this.current=0}render(){return r`${this.steps.map((e,t)=>r`
        <div class="step ${t<this.current?"done":t===this.current?"current":""}">
          <span class="n">${t<this.current?r`<sw-icon name="check" size=${13}></sw-icon>`:t+1}</span><span>${e}</span>
        </div>
        ${t<this.steps.length-1?r`<div class="line ${t<this.current?"done":""}"></div>`:""}
      `)}`}};ut.styles=v`
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
  `;Hs([h({attribute:!1})],ut.prototype,"steps",2);Hs([h({type:Number})],ut.prototype,"current",2);ut=Hs([m("sw-steps")],ut);var nn=Object.defineProperty,on=Object.getOwnPropertyDescriptor,G=(e,t,s,i)=>{for(var a=i>1?void 0:i?on(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&nn(t,s,a),a};const cs=["קובץ","עמוד","חיתוך וסיבוב","שם והערות","שמירה ופרסום"];let B=class extends w{constructor(){super(...arguments),this.floorId="",this.step=0,this.tree=null,this.assets=[],this.asset=null,this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.notes="",this.version=null,this.busy=!1,this.error="",this.dragOver=!1}connectedCallback(){super.connectedCallback(),this.init()}async init(){try{this.tree=await _t(),S()&&this.floorId&&(this.assets=(await kr(this.floorId)).assets)}catch(e){this.error=x(e)}}get floor(){return this.tree&&this.floorId?Hi(this.tree,this.floorId):null}async onFile(e){if(!(!e||!this.floorId)){this.busy=!0,this.error="";try{this.asset=await _r(this.floorId,e),this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.version=null,this.step=this.asset.page_count>1?1:2,this.assets=[this.asset,...this.assets.filter(t=>t.id!==this.asset.id)]}catch(t){this.error=x(t)}finally{this.busy=!1}}}async save(){if(!(!this.asset||!this.floorId)){this.busy=!0,this.error="";try{const e=this.crop.x===0&&this.crop.y===0&&this.crop.w===1&&this.crop.h===1;this.version=await zr(this.floorId,{asset_id:this.asset.id,page:this.page,rotation:this.rotation,crop:e?null:this.crop,notes:this.notes})}catch(e){this.error=x(e)}finally{this.busy=!1}}}async publish(){if(this.version){this.busy=!0,this.error="";try{this.version=await Ni(this.version.id)}catch(e){this.error=x(e)}finally{this.busy=!1}}}setCrop(e,t){const s=Math.max(0,Math.min(100,t))/100,i={...this.crop,[e]:s};i.x+i.w>1&&(i.w=1-i.x),i.y+i.h>1&&(i.h=1-i.y),i.w<=.02&&(i.w=.02),i.h<=.02&&(i.h=.02),this.crop=i}previewUrl(){const e=this.asset?.pages.find(t=>t.page===this.page)??this.asset?.pages[0];return e?Dt(e.preview_url):""}renderStep(){const e=this.asset;switch(this.step){case 0:return r`
          <label class="drop ${this.dragOver?"over":""}" @dragover=${t=>{t.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1} @drop=${t=>{t.preventDefault(),this.dragOver=!1,this.onFile(t.dataTransfer?.files[0])}}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" @change=${t=>void this.onFile(t.target.files?.[0])} />
            <div>
              <div class="ic"><sw-icon name="upload" size=${20}></sw-icon></div>
              <strong>${this.busy?"מעלה…":"גרור לכאן PDF או תמונה של התוכנית, או לחץ לבחירה"}</strong>
              <small>PDF עד 20 עמודים, PNG / JPG · עד 40 MB · הזיהוי לפי תוכן הקובץ · המקור נשמר ללא שינוי</small>
            </div>
          </label>
          ${this.assets.length?r`<div class="assets"><div class="note" style="margin-block-end:4px">קבצים שכבר הועלו לקומה זו:</div>${this.assets.map(t=>r`<button @click=${()=>{this.asset=t,this.page=1,this.step=t.page_count>1?1:2}}><span>${t.original_name}</span><span class="ltr">${t.page_count} עמ׳ · ${(t.bytes/1024/1024).toFixed(1)} MB</span></button>`)}</div>`:p}`;case 1:return r`<div class="note">בחר את העמוד שמכיל את התוכנית של הקומה.</div>
          <div class="pages">${e?.pages.map(t=>r`<button class="pg ${t.page===this.page?"on":""}" @click=${()=>this.page=t.page}><img src=${Dt(t.preview_url)} alt=${`עמוד ${t.page}`} loading="lazy" />עמוד ${t.page}</button>`)}</div>`;case 2:{const t=this.rotation,s=this.crop,i=t%180===0?s:{x:s.x,y:s.y,w:s.w,h:s.h};return r`
          <div class="preview">
            <img src=${this.previewUrl()} alt="תצוגה מקדימה" style="transform: rotate(${t}deg)" />
            <div class="cropbox" style="left:${i.x*100}%;top:${i.y*100}%;width:${i.w*100}%;height:${i.h*100}%"></div>
          </div>
          <div class="row">
            <sw-button size="sm" icon="refresh" @click=${()=>this.rotation=(this.rotation+90)%360}>סובב 90°</sw-button>
            <sw-badge kind="neutral" label=${`סיבוב ${this.rotation}°`}></sw-badge>
            <sw-button size="sm" variant="ghost" icon="fit" @click=${()=>this.crop={x:0,y:0,w:1,h:1}}>אפס חיתוך</sw-button>
            <span class="note">החיתוך באחוזים מהתמונה (אחרי סיבוב): שמאל, עליון, רוחב, גובה.</span>
          </div>
          <div class="two">
            <sw-field label="שמאל %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(s.x*100))} @change=${a=>this.setCrop("x",Number(a.target.value))} /></sw-field>
            <sw-field label="עליון %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(s.y*100))} @change=${a=>this.setCrop("y",Number(a.target.value))} /></sw-field>
            <sw-field label="רוחב %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(s.w*100))} @change=${a=>this.setCrop("w",Number(a.target.value))} /></sw-field>
            <sw-field label="גובה %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(s.h*100))} @change=${a=>this.setCrop("h",Number(a.target.value))} /></sw-field>
          </div>`}case 3:return r`
          <sw-field label="קומה"><input .value=${this.floor?.floor.name??""} disabled /></sw-field>
          <sw-field label="הערות לגרסה (אופציונלי)" hint="למשל: תוכנית מעודכנת אחרי שיפוץ 2026"><input .value=${this.notes} @input=${t=>this.notes=t.target.value} /></sw-field>
          <div class="note">קנה מידה (מטרים לפיקסל) יכויל בעורך בשתי נקודות ומרחק ידוע; עד אז מרחקים מוצגים כמשוערים.</div>`;default:return r`
          ${this.version?r`<div class="ok">✓ הגרסה נשמרה (${this.version.width_px}×${this.version.height_px} px) · ${this.version.status==="published"?"פורסמה — היא הרקע של הקומה":"טיוטה — עורכי הקומה רואים אותה, צופים עדיין לא"}</div>
                <div class="preview" style="min-block-size:220px"><img src=${Dt(this.version.image_url)} alt="רקע התוכנית" /></div>`:r`<div class="note">סיכום: ${e?.original_name} · עמוד ${this.page} · סיבוב ${this.rotation}° · חיתוך ${Math.round(this.crop.w*100)}%×${Math.round(this.crop.h*100)}%. השמירה מייצרת רקע נגזר; המקור לא משתנה.</div>`}
          <div class="row">
            ${this.version?p:r`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.save()}>שמור כטיוטה</sw-button>`}
            ${this.version&&this.version.status==="draft"?r`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.publish()}>פרסום</sw-button>`:p}
            ${this.version?r`<sw-button icon="map" @click=${()=>g(`/explore/floors/${this.floorId}`)}>פתח במפה</sw-button><sw-button variant="ghost" icon="edit" @click=${()=>g(`/explore/floors/${this.floorId}/edit`)}>הצב מצלמות</sw-button>`:p}
          </div>`}}renderDemo(){return r`<sw-card><sw-state-panel state="empty" heading="ייבוא תוכנית עובד מול השרת" hint="בתצוגת ההדגמה אין שרת מחובר. בהתקנה ב־Home Assistant המסך מעלה PDF/PNG, בוחר עמוד, מסובב וחותך, ומפרסם גרסה."></sw-state-panel></sw-card>`}render(){const e=this.floor,t=this.step===0?!!this.asset:this.step===1?!!this.asset:!0;return r`
      <sw-page heading=${e?`ייבוא תוכנית ל${e.floor.name}`:"ייבוא תוכנית"} subheading="המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת" crumbs=${e?`אתרים | ${e.site.name} | ${e.building.name} | ${e.floor.name}`:"אתרים"}>
        ${S()?!this.floorId||this.tree&&!e?r`<sw-state-panel state="empty" heading="בחר קומה" hint="ייבוא תוכנית מתחיל מדף הקומות."><div style="margin-block-start:10px"><sw-button variant="primary" @click=${()=>g("/explore/sites")}>לאתרים</sw-button></div></sw-state-panel>`:r`
                <sw-card><sw-steps .steps=${cs} .current=${this.step}></sw-steps></sw-card>
                <div class="layout">
                  <div class="stage">${this.renderStep()}${this.error?r`<div class="err">${this.error}</div>`:p}</div>
                  <div class="side">
                    <sw-card heading="קובץ">
                      ${this.asset?r`<div class="note">${this.asset.original_name}</div><div class="row" style="margin-block-start:6px"><sw-badge kind="neutral" label=${`${this.asset.mime.split("/")[1].toUpperCase()} · ${(this.asset.bytes/1024/1024).toFixed(1)} MB · ${this.asset.page_count} עמ׳`}></sw-badge></div><div class="note ltr" style="margin-block-start:6px">sha256 ${this.asset.sha256.slice(0,16)}…</div>`:r`<div class="note">עדיין לא נבחר קובץ.</div>`}
                    </sw-card>
                    <sw-card heading="בטיחות">
                      <div class="note">הקובץ מזוהה לפי תוכנו; PDF מרונדר בתהליך נפרד עם מגבלת זמן; SVG נדחה עד sanitization. תוכן טקסטואלי בתוך הקובץ הוא נתון בלבד.</div>
                    </sw-card>
                    <div class="foot">
                      <sw-button variant="ghost" icon="chevron" ?disabled=${this.step===0||this.busy} @click=${()=>this.step=Math.max(0,this.step-1)}>הקודם</sw-button>
                      ${this.step<cs.length-1?r`<sw-button variant="primary" ?disabled=${!t||this.busy} @click=${()=>this.step=Math.min(cs.length-1,this.step+1)}>הבא</sw-button>`:p}
                    </div>
                  </div>
                </div>`:this.renderDemo()}
      </sw-page>
    `}};B.styles=v`
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
  `;G([h()],B.prototype,"floorId",2);G([d()],B.prototype,"step",2);G([d()],B.prototype,"tree",2);G([d()],B.prototype,"assets",2);G([d()],B.prototype,"asset",2);G([d()],B.prototype,"page",2);G([d()],B.prototype,"rotation",2);G([d()],B.prototype,"crop",2);G([d()],B.prototype,"notes",2);G([d()],B.prototype,"version",2);G([d()],B.prototype,"busy",2);G([d()],B.prototype,"error",2);G([d()],B.prototype,"dragOver",2);B=G([m("explore-plan-import")],B);var ln=Object.defineProperty,dn=Object.getOwnPropertyDescriptor,F=(e,t,s,i)=>{for(var a=i>1?void 0:i?dn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ln(t,s,a),a};const cn=[{id:"select",icon:"target",label:"בחירה",ready:!0},{id:"camera",icon:"camera",label:"הוספת מצלמה",ready:!0},{id:"entity",icon:"light",label:"הוספת ישות",ready:!0},{id:"area",icon:"map",label:"ציור אזור",ready:!1},{id:"label",icon:"list",label:"תווית",ready:!1},{id:"scale",icon:"fit",label:"קנה מידה",ready:!1}];let T=class extends w{constructor(){super(...arguments),this.floorId="",this.presetEntity="",this.bundle=null,this.entQ="",this.entResults=null,this.entBusy=!1,this.entTimer=0,this.anchors=[],this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId=null,this.tool="select",this.busy=!1,this.error="",this.info=""}connectedCallback(){super.connectedCallback(),this.load(),this.presetEntity&&(this.tool="entity",this.entQ=this.presetEntity,this.searchEntities())}async searchEntities(){if(this.bundle?.source!=="demo"){this.entBusy=!0;try{const e=await ji({q:this.entQ||void 0,limit:40});this.entResults=e.entities}catch(e){this.error=x(e),this.entResults=[]}finally{this.entBusy=!1}}}onEntQuery(e){this.entQ=e,window.clearTimeout(this.entTimer),this.entTimer=window.setTimeout(()=>void this.searchEntities(),250)}async addEntity(e){if(this.bundle){if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הוספה עובדת מול השרת.";return}if(!(this.dirty.size&&!await this.save())){this.busy=!0,this.error="";try{const t=await oi(this.bundle.floorId,{resource_type:"ha_entity",resource_id:e.entity_id,x:.5,y:.5,rotation_degrees:0,field_of_view_degrees:null});await this.load(),this.selectedId=t.id,this.tool="select"}catch(t){this.error=x(t)}finally{this.busy=!1}}}}async load(){this.error="";try{const e=await Di(this.floorId||"f0",!0);this.bundle=e,this.anchors=e.anchors.map(t=>({...t,position:{...t.position}})),this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId&&!this.anchors.some(t=>t.id===this.selectedId)&&(this.selectedId=null)}catch(e){this.error=x(e)}}get markers(){return this.anchors.map(e=>({id:e.id,kind:e.resource_type==="camera"?"camera":Bi(e.layer_id,e.entity?.domain),label:e.camera?.name??e.entity?.name??e.label??e.resource_id,x:e.position.x,y:e.position.y,rotation:e.rotation_degrees,fov:e.field_of_view_degrees??void 0,state:e.resource_type==="camera"?this.bundle?.source==="demo"?"live":Nt(e):"neutral"}))}snapshot(){this.undo=[...this.undo.slice(-30),this.anchors.map(e=>({...e,position:{...e.position}}))],this.redo=[]}apply(e,t){this.snapshot(),this.anchors=this.anchors.map(s=>s.id===e?{...s,...t,position:t.position??s.position}:s),this.dirty=new Set(this.dirty).add(e)}doUndo(){const e=this.undo[this.undo.length-1];e&&(this.redo=[...this.redo,this.anchors],this.undo=this.undo.slice(0,-1),this.anchors=e,this.dirty=new Set(this.anchors.map(t=>t.id)))}doRedo(){const e=this.redo[this.redo.length-1];e&&(this.undo=[...this.undo,this.anchors],this.redo=this.redo.slice(0,-1),this.anchors=e,this.dirty=new Set(this.anchors.map(t=>t.id)))}async save(){if(!this.bundle||this.bundle.source==="demo")return this.info="נתוני הדגמה: השינויים נשמרים רק במסך זה.",this.dirty=new Set,!0;this.busy=!0,this.error="";let e=!1;try{for(const t of this.dirty){const s=this.anchors.find(i=>i.id===t);if(s)try{const i=await Sr(t,{revision:s.revision,x:s.position.x,y:s.position.y,rotation_degrees:s.rotation_degrees,field_of_view_degrees:s.field_of_view_degrees,label:s.label});this.anchors=this.anchors.map(a=>a.id===t?{...a,revision:i.revision}:a)}catch(i){if(i instanceof fe&&i.code==="stale_revision")e=!0;else throw i}}return e?(this.error="חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.",await this.load(),!1):(this.dirty=new Set,this.info="נשמר",setTimeout(()=>this.info="",2e3),!0)}catch(t){return this.error=x(t),!1}finally{this.busy=!1}}async addCamera(e){if(this.bundle){if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הוספה עובדת מול השרת.";return}if(!(this.dirty.size&&!await this.save())){this.busy=!0,this.error="";try{const t=await oi(this.bundle.floorId,{resource_type:"camera",resource_id:e.id,x:.5,y:.5,rotation_degrees:0,field_of_view_degrees:70});await this.load(),this.selectedId=t.id,this.tool="select"}catch(t){this.error=x(t)}finally{this.busy=!1}}}}async removeSelected(){const e=this.anchors.find(t=>t.id===this.selectedId);if(!(!e||!this.bundle)){if(this.bundle.source==="demo"){this.snapshot(),this.anchors=this.anchors.filter(t=>t.id!==e.id),this.selectedId=null;return}if(window.confirm(`להסיר את "${e.camera?.name??e.resource_id}" מהמפה? (המצלמה עצמה נשארת רשומה)`)){this.busy=!0;try{await Mr(e.id),this.selectedId=null,await this.load()}catch(t){this.error=x(t)}finally{this.busy=!1}}}}async publish(){if(!(!this.bundle?.planVersionId||this.bundle.source==="demo")&&!(this.dirty.size&&!await this.save())){this.busy=!0;try{await Ni(this.bundle.planVersionId),await this.load(),this.info="התוכנית פורסמה"}catch(e){this.error=x(e)}finally{this.busy=!1}}}render(){const e=this.bundle;if(this.error&&!e)return r`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!e)return r`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=this.anchors.find(n=>n.id===this.selectedId),s=new Set(this.anchors.map(n=>n.resource_id)),i=e.cameras.filter(n=>!s.has(n.id)),a=this.dirty.size;return r`
      <sw-page heading="עורך תוכנית קומה" subheading=${`${e.buildingName} · ${e.floorName} · ${e.planStatus==="draft"?"טיוטה":e.planStatus==="published"?"תוכנית מפורסמת":"אין תוכנית"}${e.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${e.siteName} | ${e.buildingName} | ${e.floorName}`} wide>
        <sw-button slot="actions" variant="ghost" iconOnly icon="history" label="בטל" ?disabled=${!this.undo.length} @click=${()=>this.doUndo()}></sw-button>
        <sw-button slot="actions" variant="ghost" iconOnly icon="refresh" label="בצע שוב" ?disabled=${!this.redo.length} @click=${()=>this.doRedo()}></sw-button>
        <sw-button slot="actions" ?disabled=${!a||this.busy} @click=${()=>this.save()}>${a?`שמירה (${a})`:"שמור"}</sw-button>
        ${e.planStatus==="draft"&&e.permissions.publish?r`<sw-button slot="actions" variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.publish()}>פרסום</sw-button>`:r`<sw-button slot="actions" variant="primary" icon="map" @click=${()=>g(`/explore/floors/${e.floorId}`)}>למפה</sw-button>`}
        ${e.planStatus==="none"?r`<sw-state-panel state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${()=>g(`/explore/floors/${e.floorId}/import`)}>העלאת תוכנית</sw-button></div></sw-state-panel>`:r`<div class="layout">
              <div class="tools">${cn.map(n=>r`<button class=${n.id===this.tool?"on":""} ?disabled=${!n.ready} title=${n.ready?n.label:`${n.label} · בקרוב`} @click=${()=>{this.tool=n.id,n.id==="entity"&&this.entResults===null&&this.searchEntities()}}><sw-icon .name=${n.icon} size=${18}></sw-icon>${n.label}</button>`)}</div>
              <div class="canvaswrap">
                <div class="bar">
                  <span class="autosave ${a?"dirty":""}"><i></i>${a?`${a} שינויים לא שמורים`:"הכל שמור"}</span>
                  ${this.info?r`<span style="color:#15803d">${this.info}</span>`:p}
                  ${this.error?r`<span class="err">${this.error}</span>`:p}
                  <span class="grow"></span>
                  ${e.needsAlignment?r`<sw-badge kind="partial" label="פריטים מגרסת תוכנית קודמת — בדוק מיקומים"></sw-badge>`:p}
                  <sw-badge kind="unknown" label="קנה מידה: לא מכויל"></sw-badge>
                  <span>גרור סיכה כדי להזיז · לחיצה בוחרת</span>
                </div>
                <div class="canvas">
                  <sw-plan-canvas editable alwaysLabel .planWidth=${e.width} .planHeight=${e.height} .plan=${e.planSvg} .imageUrl=${e.imageUrl} .markers=${this.markers} .selectedId=${this.selectedId}
                    @marker-select=${n=>this.selectedId=n.detail.id}
                    @marker-move=${n=>{this.apply(n.detail.id,{position:{x:+n.detail.x.toFixed(4),y:+n.detail.y.toFixed(4)}}),this.selectedId=n.detail.id}}></sw-plan-canvas>
                </div>
              </div>
              <div class="props">
                ${this.tool==="camera"?r`<sw-card heading="הוספת מצלמה" subheading="מצלמות רשומות שעדיין לא הוצבו על הקומה">
                      ${i.length?r`<div class="camlist">${i.map(n=>r`<button @click=${()=>this.addCamera(n)}><span>${n.name}</span><span class="ltr">ch ${n.channel} · ${n.status}</span></button>`)}</div>`:r`<div class="note">${e.cameras.length?"כל המצלמות הרשומות כבר מוצבות על הקומה.":'אין מצלמות רשומות. סנכרן מה־NVR במסך "בריאות מצלמות" או רשום ידנית.'}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${()=>g("/system/devices")}>למצלמות</sw-button></div>`}
                    </sw-card>`:p}
                ${this.tool==="entity"?r`<sw-card heading="הוספת ישות Home Assistant" subheading="מהקטלוג המסונכרן · הצבה אינה מעניקה שליטה">
                      <sw-field><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" data-ltr .value=${this.entQ} @input=${n=>this.onEntQuery(n.target.value)} /></sw-field>
                      ${e.source==="demo"?r`<div class="note">נתוני הדגמה: החיפוש עובד מול השרת.</div>`:this.entBusy&&!this.entResults?r`<div class="note">מחפש…</div>`:(this.entResults??[]).filter(n=>!s.has(n.entity_id)).length?r`<div class="camlist">${(this.entResults??[]).filter(n=>!s.has(n.entity_id)).map(n=>r`<button ?disabled=${this.busy} @click=${()=>this.addEntity(n)}><span>${n.name||n.original_name||n.entity_id}<div class="note" style="margin:0">${Ut(n.domain)}${n.area_name?` · ${n.area_name}`:""} · ${ht(n)}</div></span><span class="ltr">${n.entity_id}</span></button>`)}</div>`:r`<div class="note">${this.entResults?"לא נמצאו ישויות (או שכולן כבר מוצבות). הקטלוג מתמלא מהסנכרון מול Home Assistant.":""}</div>`}
                    </sw-card>`:p}
                <sw-card heading=${t?t.camera?.name??t.entity?.name??t.label??t.resource_id:"מאפיינים"}>
                  ${t?r`
                        <div class="two">
                          <sw-field label="X (0–1)"><input type="number" step="0.001" min="0" max="1" data-ltr .value=${t.position.x.toFixed(3)} @change=${n=>this.apply(t.id,{position:{x:Math.min(1,Math.max(0,Number(n.target.value))),y:t.position.y}})} /></sw-field>
                          <sw-field label="Y (0–1)"><input type="number" step="0.001" min="0" max="1" data-ltr .value=${t.position.y.toFixed(3)} @change=${n=>this.apply(t.id,{position:{x:t.position.x,y:Math.min(1,Math.max(0,Number(n.target.value)))}})} /></sw-field>
                          ${t.resource_type==="camera"?r`<sw-field label="כיוון (°)"><input type="number" step="5" min="0" max="359" data-ltr .value=${String(Math.round(t.rotation_degrees))} @change=${n=>this.apply(t.id,{rotation_degrees:(Number(n.target.value)%360+360)%360})} /></sw-field>
                                <sw-field label="זווית ראייה (°)"><input type="number" step="5" min="10" max="180" data-ltr .value=${String(Math.round(t.field_of_view_degrees??70))} @change=${n=>this.apply(t.id,{field_of_view_degrees:Math.min(360,Math.max(1,Number(n.target.value)))})} /></sw-field>`:p}
                        </div>
                        <sw-field label="תווית (אופציונלי)"><input .value=${t.label??""} @change=${n=>this.apply(t.id,{label:n.target.value||null})} /></sw-field>
                        <div class="note">revision ${t.revision} · ${t.resource_type==="camera"?`ערוץ ${t.camera?.channel??"?"}`:r`<span class="ltr">${t.resource_id}</span> · שכבה ${t.layer_id}${t.entity?` · ${ht(t.entity)}`:""}`}</div>
                        <div style="display:flex;gap:8px;margin-block-start:6px"><sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>הסר מהמפה</sw-button></div>`:r`<div class="note">בחר סיכה במפה, או הוסף מצלמה / ישות HA מסרגל הכלים. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.</div>`}
                </sw-card>
                <sw-card heading="גרסת תוכנית">
                  <div class="note">${e.planStatus==="draft"?"טיוטה: צופים עדיין רואים את הגרסה הקודמת (אם קיימת). פרסום יוצר PlanVersion מאושרת ונרשם באודיט.":'גרסה מפורסמת. תוכנית חדשה מועלית דרך "ייבוא תוכנית"; העוגנים נשמרים ומסומנים לבדיקה אם הגאומטריה השתנתה.'}</div>
                  <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${()=>g(`/explore/floors/${e.floorId}/import`)}>ייבוא תוכנית</sw-button></div>
                </sw-card>
              </div>
            </div>`}
      </sw-page>
    `}};T.styles=v`
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
  `;F([h()],T.prototype,"floorId",2);F([h()],T.prototype,"presetEntity",2);F([d()],T.prototype,"bundle",2);F([d()],T.prototype,"entQ",2);F([d()],T.prototype,"entResults",2);F([d()],T.prototype,"entBusy",2);F([d()],T.prototype,"anchors",2);F([d()],T.prototype,"dirty",2);F([d()],T.prototype,"undo",2);F([d()],T.prototype,"redo",2);F([d()],T.prototype,"selectedId",2);F([d()],T.prototype,"tool",2);F([d()],T.prototype,"busy",2);F([d()],T.prototype,"error",2);F([d()],T.prototype,"info",2);T=F([m("explore-plan-editor")],T);var pn=Object.defineProperty,hn=Object.getOwnPropertyDescriptor,De=(e,t,s,i)=>{for(var a=i>1?void 0:i?hn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&pn(t,s,a),a};let we=class extends w{constructor(){super(...arguments),this.columns=[],this.rows=[],this.rowKey="id",this.selected=null,this.emptyText="אין שורות להצגה",this.dense=!1}pick(e){const t=String(e[this.rowKey]??"");this.dispatchEvent(new CustomEvent("row-select",{detail:{id:t,row:e},bubbles:!0,composed:!0}))}render(){return this.rows.length?r`
      <table>
        <thead>
          <tr>${this.columns.map(e=>r`<th style=${e.width?`width:${e.width}`:""}>${e.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(e=>r`<tr class="clickable ${this.selected===String(e[this.rowKey])?"selected":""}" @click=${()=>this.pick(e)}>
              ${this.columns.map(t=>r`<td class=${t.ltr?"ltr":""}>${t.render?t.render(e):String(e[t.key]??"")}</td>`)}
            </tr>`)}
        </tbody>
      </table>
    `:r`<div class="empty">${this.emptyText}</div>`}};we.styles=v`
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
  `;De([h({attribute:!1})],we.prototype,"columns",2);De([h({attribute:!1})],we.prototype,"rows",2);De([h()],we.prototype,"rowKey",2);De([h()],we.prototype,"selected",2);De([h()],we.prototype,"emptyText",2);De([h({type:Boolean,reflect:!0})],we.prototype,"dense",2);we=De([m("sw-table")],we);var un=Object.defineProperty,fn=Object.getOwnPropertyDescriptor,ae=(e,t,s,i)=>{for(var a=i>1?void 0:i?fn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&un(t,s,a),a};const Ct=[{id:"lock.main_door",name:"דלת כניסה",domain:"lock",area:"לובי",state:"נעול",fresh:"live",placed:!0,actions:"נעילה / פתיחה (grant נפרד)"},{id:"light.lobby",name:"תאורת לובי",domain:"light",area:"לובי",state:"דולק · 80%",fresh:"live",placed:!0,actions:"הדלקה / כיבוי / עמעום"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",domain:"binary_sensor",area:"אולם",state:"ללא תנועה",fresh:"live",placed:!0,actions:"קריאה בלבד"},{id:"climate.hall",name:"מזגן אולם",domain:"climate",area:"אולם",state:"קירור · 23°",fresh:"stale",placed:!1,actions:"יעד טמפרטורה (allowlist)"},{id:"cover.parking_gate",name:"שער חניה",domain:"cover",area:"חניה",state:"סגור",fresh:"live",placed:!1,actions:"פתיחה / סגירה (רגיש)"},{id:"script.night_mode",name:"מצב לילה",domain:"script",area:"—",state:"—",fresh:"unknown",placed:!1,actions:"חסום עד allowlist"},{id:"sensor.power_main",name:"צריכת חשמל",domain:"sensor",area:"חדר מכונות",state:"4.2 kW",fresh:"live",placed:!1,actions:"קריאה בלבד"},{id:"camera.intercom_m2",name:"אינטרקום M2",domain:"camera",area:"כניסה",state:"זמין",fresh:"live",placed:!1,actions:"צפייה (provider נפרד)"}];function wn(e){return e==="lock"||e==="cover"?"lock":e==="light"||e==="switch"||e==="fan"?"light":e==="camera"?"camera":e==="climate"||e==="script"||e==="scene"||e==="button"||e==="automation"?"activity":"sensor"}let X=class extends w{constructor(){super(...arguments),this.selected=null,this.domain="all",this.q="",this.area="",this.onlyPlaced=!1,this.cat=null,this.error="",this.loading=!1,this.sync=null,this.firstFloorId=null,this.stopWs=null,this.searchTimer=0,this.columns=[{key:"name",label:"ישות",render:e=>r`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:7px;background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${wn(String(e.domain))} size=${13}></sw-icon></span><span><strong>${String(e.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(e.id)}</div></span></span>`},{key:"domain",label:"Domain",ltr:!0},{key:"area",label:"אזור HA"},{key:"state",label:"מצב"},{key:"fresh",label:"רעננות",render:e=>r`<sw-badge kind=${e.fresh} label=${e.fresh==="live"||e.fresh==="neutral"?"עדכני":e.fresh==="stale"?"מיושן":e.fresh==="offline"?"לא זמין":"לא ידוע"}></sw-badge>`},{key:"placed",label:"במפה",render:e=>e.placed?r`<sw-badge kind="recorded" label="מוצב"></sw-badge>`:r`<span style="color:var(--sw-text-3)">לא</span>`}]}connectedCallback(){super.connectedCallback(),S()&&(this.load(),_t().then(e=>this.firstFloorId=Li(e)?.id??null).catch(()=>{}),this.stopWs=Vi(e=>{if(e.type==="entity_state_changed"&&this.cat){const t=this.cat.entities.findIndex(s=>s.entity_id===e.entity.entity_id);if(t>=0){const s=[...this.cat.entities];s[t]={...s[t],...e.entity,placements:s[t].placements,actions:s[t].actions},this.cat={...this.cat,entities:s}}}else e.type==="heartbeat"?this.sync=e.sync:e.type==="ha_sync_state"&&this.sync&&(this.sync={...this.sync,connected:e.connected})}))}disconnectedCallback(){super.disconnectedCallback(),this.stopWs?.(),this.stopWs=null}async load(){this.loading=!0,this.error="";try{this.cat=await ji({domain:this.domain==="all"?void 0:this.domain,q:this.q||void 0,area:this.area||void 0,placed:this.onlyPlaced?!0:void 0,limit:800}),this.sync=this.cat.sync}catch(e){this.error=x(e)}finally{this.loading=!1}}onSearch(e){this.q=e,window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(()=>void this.load(),250)}toRow(e){return{id:e.entity_id,name:e.name||e.original_name||e.entity_id,domain:e.domain,area:e.area_name??"—",state:ht(e),fresh:ks(e),placed:!!e.placements?.length,actions:e.actions?.length?e.actions.map(t=>`${t.label}${t.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}}renderApiDrawer(e){const t=ks(e),s=Object.entries(e.attributes).filter(([i])=>i!=="friendly_name"&&i!=="icon").slice(0,14);return r`<sw-drawer open heading=${e.name||e.original_name||e.entity_id} subheading=${e.entity_id} @close=${()=>this.selected=null}>
      <dl>
        <dt>מצב</dt><dd><sw-badge kind=${t} label=${ht(e)}></sw-badge></dd>
        <dt>Domain</dt><dd><span class="ltr">${e.domain}</span> · ${Ut(e.domain)}${e.device_class?r` · <span class="ltr">${e.device_class}</span>`:p}</dd>
        <dt>אזור HA</dt><dd>${e.area_name??"—"}${e.ha_floor_name?` · ${e.ha_floor_name}`:""}</dd>
        <dt>שינוי אחרון</dt><dd>${pe(e.last_changed)}</dd>
        <dt>נראה לאחרונה</dt><dd>${pe(e.state_seen_at)}${e.fresh?"":" · הסנכרון מנותק"}</dd>
        <dt>אינטגרציה</dt><dd><span class="ltr">${e.platform??"—"}</span></dd>
        <dt>פעולות נתמכות</dt><dd>${e.actions?.length?e.actions.map(i=>`${i.label}${i.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}</dd>
        <dt>במפה</dt><dd>${e.placements?.length?r`<span class="chips">${e.placements.map(i=>r`<sw-chip @click=${()=>g(`/explore/floors/${i.floor_id}`)}>${i.floor_name}</sw-chip>`)}</span>`:"לא מוצב"}</dd>
      </dl>
      ${s.length?r`<div class="attrs">${s.map(([i,a])=>r`<span>${i}</span><span>${typeof a=="object"?JSON.stringify(a):String(a)}</span>`)}</div>`:p}
      <div class="note">הקטלוג הוא שיקוף לקריאה בלבד של Home Assistant. הפעולות רצות דרך גשר SMPLWISE בזהות המשתמש; שליטה מהמפה דורשת הרשאת ha.entity.control.</div>
      <div slot="footer">
        ${e.placements?.length?r`<sw-button variant="primary" icon="map" @click=${()=>g(`/explore/floors/${e.placements[0].floor_id}`)}>הצג במפה</sw-button>`:r`<sw-button variant="primary" icon="map" ?disabled=${!this.firstFloorId} title=${this.firstFloorId?"פותח את עורך התוכנית עם הישות מוכנה להצבה":"אין קומות עדיין"} @click=${()=>this.firstFloorId&&g(`/explore/floors/${this.firstFloorId}/edit`,{entity:e.entity_id})}>הצב במפה</sw-button>`}
      </div>
    </sw-drawer>`}renderApi(){const e=this.cat,t=this.sync,s=e?e.entities.map(l=>this.toRow(l)):[],i=e?Object.entries(e.domains).sort((l,u)=>u[1]-l[1]):[],a=e?.entities.find(l=>l.entity_id===this.selected),n=i.reduce((l,[,u])=>l+u,0),o=t?`${n} ישויות בקטלוג · ${t.connected?`סנכרון פעיל · HA ${t.ha_version??""}`:`הסנכרון מנותק${t.last_error?` · ${t.last_error}`:""}`}`:"טוען את הקטלוג…";return r`
      <sw-page heading="קטלוג ישויות Home Assistant" subheading=${o}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.loading} @click=${()=>this.load()}>רענון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" .value=${this.q} @input=${l=>this.onSearch(l.target.value)} /></sw-field>
          <sw-field><select aria-label="אזור" @change=${l=>{this.area=l.target.value,this.load()}}><option value="">כל האזורים</option>${(e?.areas??[]).map(l=>r`<option value=${l.area_id} ?selected=${l.area_id===this.area}>${l.area_name??l.area_id}</option>`)}</select></sw-field>
          <sw-chip ?selected=${this.onlyPlaced} icon="map" @click=${()=>{this.onlyPlaced=!this.onlyPlaced,this.load()}}>מוצבות בלבד</sw-chip>
        </div>
        <div class="filters">
          <sw-chip ?selected=${this.domain==="all"} count=${n} @click=${()=>{this.domain="all",this.load()}}>הכל</sw-chip>
          ${i.map(([l,u])=>r`<sw-chip ?selected=${l===this.domain} count=${u} @click=${()=>{this.domain=l,this.load()}}><span class="ltr">${l}</span></sw-chip>`)}
        </div>
        <div class="stage">
          ${this.error?r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`:e?s.length?r`<sw-table .columns=${this.columns} .rows=${s} .selected=${this.selected} @row-select=${l=>this.selected=l.detail.id}></sw-table>`:r`<sw-state-panel state="empty" heading=${n?"אין ישויות שתואמות את הסינון":"הקטלוג ריק"} hint=${n?"נקה את החיפוש או בחר domain אחר.":t?.connected?"ההסנכרון פעיל אך טרם התקבלו מצבים.":"ה־Add-on לא מחובר ל־Home Assistant. בדוק בהגדרות → גשר Home Assistant."}></sw-state-panel>`:r`<sw-state-panel state="loading"></sw-state-panel>`}
          ${a?this.renderApiDrawer(a):p}
        </div>
      </sw-page>
    `}render(){if(S())return this.renderApi();const e=["all",...new Set(Ct.map(i=>i.domain))],t=Ct.filter(i=>this.domain==="all"||i.domain===this.domain),s=Ct.find(i=>i.id===this.selected);return r`
      <sw-page heading="קטלוג ישויות Home Assistant" subheading="${Ct.length} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה">
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
    `}};X.styles=v`
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
  `;ae([d()],X.prototype,"selected",2);ae([d()],X.prototype,"domain",2);ae([d()],X.prototype,"q",2);ae([d()],X.prototype,"area",2);ae([d()],X.prototype,"onlyPlaced",2);ae([d()],X.prototype,"cat",2);ae([d()],X.prototype,"error",2);ae([d()],X.prototype,"loading",2);ae([d()],X.prototype,"sync",2);ae([d()],X.prototype,"firstFloorId",2);X=ae([m("explore-entities")],X);var mn=Object.defineProperty,vn=Object.getOwnPropertyDescriptor,Ui=(e,t,s,i)=>{for(var a=i>1?void 0:i?vn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&mn(t,s,a),a};const ps=[{id:"d1",name:"כניסה ראשית",kind:"דלת זכוכית",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!1,scene:"entrance"},{id:"d2",name:"לובי",kind:"דלת פנימית",lock:"פתוח",contact:"פתוח",relay:"לא פעיל",ringing:!1,scene:"lobby"},{id:"d3",name:"אינטרקום M2",kind:"עמדת דלת",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!0,scene:"entrance"},{id:"d4",name:"מחסן",kind:"דלת שירות",lock:"נעול",contact:"סגור",relay:"לא פעיל",ringing:!1,scene:"warehouse"}];let Wt=class extends w{constructor(){super(...arguments),this.selected="d1"}render(){const e=ps.find(t=>t.id===this.selected)??ps[0];return r`
      <sw-page heading="דלתות ואינטרקום" subheading="V1 · מצלמה, צלצול, מגע דלת וממסר הם ארבעה נתונים שונים · נתוני הדגמה">
        <sw-tabs .items=${[{id:"doors",label:"דלתות",count:4},{id:"intercom",label:"אינטרקום",count:1},{id:"linked",label:"מצלמות מקושרות",count:4}]} active="doors"></sw-tabs>
        <div class="layout">
          <div class="list">
            ${ps.map(t=>r`<button class="door ${t.id===this.selected?"on":""}" @click=${()=>this.selected=t.id} aria-pressed=${t.id===this.selected}>
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
    `}};Wt.styles=v`
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
  `;Ui([d()],Wt.prototype,"selected",2);Wt=Ui([m("explore-access")],Wt);var bn=Object.defineProperty,gn=Object.getOwnPropertyDescriptor,Ne=(e,t,s,i)=>{for(var a=i>1?void 0:i?gn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&bn(t,s,a),a};let me=class extends w{constructor(){super(...arguments),this.label="",this.value="",this.detail="",this.icon="info",this.tone="neutral",this.badge=""}render(){return r`
      <div class="icon"><sw-icon .name=${this.icon} size=${16}></sw-icon></div>
      ${this.badge?r`<span class="badge">${this.badge}</span>`:""}
      <div>
        <div class="value">${this.value}</div>
        <div class="label">${this.label}</div>
        ${this.detail?r`<div class="detail">${this.detail}</div>`:""}
      </div>
    `}};me.styles=v`
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
  `;Ne([h()],me.prototype,"label",2);Ne([h()],me.prototype,"value",2);Ne([h()],me.prototype,"detail",2);Ne([h()],me.prototype,"icon",2);Ne([h({reflect:!0})],me.prototype,"tone",2);Ne([h()],me.prototype,"badge",2);me=Ne([m("sw-kpi")],me);var yn=Object.getOwnPropertyDescriptor,xn=(e,t,s,i)=>{for(var a=i>1?void 0:i?yn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const $n={person:"var(--sw-accent)",vehicle:"var(--sw-live)",motion:"var(--sw-danger)",line:"var(--sw-stale)",offline:"var(--sw-offline)",door:"var(--sw-purple)"},kn={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking"};let _s=class extends w{render(){const e=P.filter(l=>l.state==="live"||l.state==="stale").length,t=he.filter(l=>!l.acked),s=[{kind:"critical",title:"מצלמה מנותקת: מסדרון מזרחי",meta:"קומה 0 · מאז 07:55",why:"מוצג כי אין הקלטה ממצלמה זו כבר שעתיים",link:"#/system/devices"},{kind:"alert",title:`${t.length} אירועים שלא נבדקו`,meta:"אדם בכניסה הראשית 10:14, רכב בחצר 09:42",why:"מוצג כי אירועי אדם/רכב מחכים לסימון טיפול",link:"#/investigate/events"},{kind:"alert",title:"החיבור ל־Home Assistant לא רענן",meta:"סנכרון אחרון לפני 4 דק׳",why:"מוצג כי מצבי הישויות עלולים להיות מיושנים",link:"#/system/diagnostics"}],i=.68,a=34,n=2*Math.PI*a,o=P.filter(l=>l.state==="live").slice(0,2);return r`
      <sw-page heading="בוקר טוב, יוני" subheading="המערכת פועלת · גשר Home Assistant לא רענן · נתוני הדגמה">
        <div slot="actions" class="date">יום שני, 14 בספטמבר 2026<br />10:24</div>
        <div class="kpis">
          <sw-kpi icon="camera" tone="live" value=${String(e)} label="מצלמות" detail="מחוברות"></sw-kpi>
          <sw-kpi icon="building" value=${String(vs.length)} label="אתרים" detail="פעילים" tone="neutral"></sw-kpi>
          <sw-kpi icon="bell" value=${String(he.length)} label="אירועים" detail="ב־24 השעות" tone="neutral" badge=${`${t.length} חדשים`}></sw-kpi>
          <sw-kpi icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר HA לא רענן"></sw-kpi>
        </div>
        <div class="fav">
          ${o.map(l=>r`<sw-camera-tile name=${l.name} state=${l.state} scene=${oe[l.id]??"lobby"} @click=${()=>g(`/live/cameras/${l.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading="אחסון">
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label="אחסון בשימוש 68%">
                ${c`<circle cx="42" cy="42" r=${a} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
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
            ${vs.map(l=>r`<div class="hrow"><span>${l.name}<div class="muted">${l.online}/${l.cameras} מצלמות · ${l.alerts} התראות</div></span><span class="status"><i style="--c:${l.health==="live"?"var(--sw-live)":l.health==="offline"?"var(--sw-danger)":"var(--sw-stale)"}"></i>${l.health==="live"?"מחובר":l.health==="offline"?"מנותק":"חלקי"}</span></div>`)}
            ${Ii.slice(0,2).map(l=>r`<div class="hrow"><span>${l.name}<div class="muted">${l.detail}</div></span><span class="status"><i style="--c:${l.state==="live"?"var(--sw-live)":"var(--sw-stale)"}"></i>${l.state==="live"?"מחובר":"לא רענן"}</span></div>`)}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card heading="אירועים אחרונים">
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${he.slice(0,5).map(l=>r`<div class="ev" @click=${()=>g("/investigate/events")}>
                ${l.type==="offline"||l.type==="door"?r`<div class="none"><sw-icon name=${l.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:r`<sw-scene kind=${kn[l.camera]??"lobby"}></sw-scene>`}
                <div class="txt"><b style="--tone:${$n[l.type]}"><i></i>${bs[l.type]}</b><small>${l.camera} · ${l.floor}</small></div>
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
    `}};_s.styles=v`
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
  `;_s=xn([m("live-overview")],_s);let Rt=null,Et=null;const _n={"media.transport_default":"mse","media.max_live_sessions":8,"media.wall_profile":"sub","snapshots.max_age_s":60};async function Mt(e=!1){return S()?Rt&&!e?Rt:(Et||(Et=zi().then(t=>Rt=t.settings).finally(()=>Et=null)),Et):_n}function zn(){Rt=null}function Ls(e){return Si()||e?.["media.transport_default"]||"mse"}var Sn=Object.defineProperty,Mn=Object.getOwnPropertyDescriptor,ze=(e,t,s,i)=>{for(var a=i>1?void 0:i?Mn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Sn(t,s,a),a};const Pn=[1,2,4,6,8,9,12,16],ci=[{id:"all",label:"כל המצלמות"},{id:"outside",label:"חוץ"},{id:"inside",label:"פנים"},{id:"night",label:"לילה"}];let de=class extends w{constructor(){super(...arguments),this.count=4,this.stream="auto",this.view="all",this.cams=null,this.settings=null,this.error="",this.posterBust=Date.now()}connectedCallback(){super.connectedCallback(),this.load(),this.posterTimer=window.setInterval(()=>this.posterBust=Date.now(),6e4)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.posterTimer)}async load(){if(S())try{const[e,t]=await Promise.all([Ze(),Mt()]);this.cams=e.cameras.filter(s=>s.enabled),this.settings=t}catch(e){this.error=x(e)}}renderApi(){const e=this.cams;if(this.error)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!e)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(!e.length)return r`<sw-state-panel state="empty" heading="אין מצלמות זמינות" hint="המצלמות מתגלות אוטומטית מה־NVR בהפעלה ובכל 10 דקות. אם הרשימה ריקה: בדוק את פרטי ה־NVR בהגדרות ה־Add-on ואת יומן ה־Add-on, או הרץ סנכרון ידני; ייתכן גם שאין לך הרשאה למצלמות."><div style="margin-block-start:10px"><sw-button @click=${()=>g("/system/devices")}>למצלמות</sw-button></div></sw-state-panel>`;const t=e.slice(0,this.count),s=this.count===1?1:this.count===2||this.count<=4?2:this.count<=9?3:4,i=this.settings?.["media.max_live_sessions"]??8,a=this.stream==="auto"?this.settings?.["media.wall_profile"]??"sub":this.stream,n=Ls(this.settings);return r`
      <div class="grid" style="--cols:${s}">
        ${t.map((o,l)=>r`<sw-camera-tile
            name=${o.name}
            state=${o.status==="online"?"live":o.status==="offline"?"offline":"unknown"}
            ?live=${o.status!=="offline"&&o.can_view_live!==!1&&l<i}
            cameraId=${o.id}
            profile=${a}
            transport=${n}
            poster=${o.status==="offline"?"":ct(o.id,this.posterBust)}
            ?compact=${this.count>=9}
            @click=${()=>g(`/live/cameras/${o.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">${t.length} מתוך ${e.length} מצלמות · פרופיל ${a==="sub"?"משני":"ראשי"} · תעבורה ${n} · מכסת זרמים ${i}${t.length>i?" — מעבר למכסה מוצג צילום בלבד":""} · צילומים מתרעננים כל דקה</div>
    `}renderDemo(){const e=P.slice(0,this.count),t=this.count===1?1:this.count===2||this.count<=4?2:this.count<=9?3:4;return r`
      <div class="grid" style="--cols:${t}">
        ${e.map(s=>r`<sw-camera-tile name=${s.name} meta=${`${s.floor} · ${this.stream==="auto"?this.count>4?"משני":"ראשי":this.stream==="main"?"ראשי":"משני"}`} state=${s.state} scene=${oe[s.id]??"lobby"} ?compact=${this.count>=9} @click=${()=>g(`/live/cameras/${s.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">נתוני הדגמה: קיר של ${this.count} אריחים אינו פותח ${this.count} זרמים ראשיים במקביל; במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד.</div>
    `}render(){const e=S(),t=e?this.cams?.length??0:P.length;return r`
      <sw-page heading="כל המצלמות" subheading="${t} מצלמות${e?"":` · תצוגה: ${ci.find(s=>s.id===this.view)?.label} · נתוני הדגמה`}" wide>
        ${e?p:r`<sw-field slot="actions"><select aria-label="תצוגה" @change=${s=>this.view=s.target.value}>${ci.map(s=>r`<option value=${s.id} ?selected=${s.id===this.view}>${s.label}</option>`)}</select></sw-field>`}
        <sw-field slot="actions"><select aria-label="זרם" @change=${s=>this.stream=s.target.value}><option value="auto">חי · אוטומטי</option><option value="main">חי · ראשי</option><option value="sub">חי · משני</option></select></sw-field>
        <div slot="actions" class="layouts" role="group" aria-label="פריסה">
          ${Pn.map(s=>r`<button class=${s===this.count?"on":""} @click=${()=>this.count=s} aria-pressed=${s===this.count}>${s}</button>`)}
        </div>
        <a slot="actions" href="#/kiosk/all"><sw-button variant="ghost" iconOnly icon="expand" label="מצב קיוסק"></sw-button></a>
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};de.styles=v`
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
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
        gap: 8px;
      }
    }
  `;ze([d()],de.prototype,"count",2);ze([d()],de.prototype,"stream",2);ze([d()],de.prototype,"view",2);ze([d()],de.prototype,"cams",2);ze([d()],de.prototype,"settings",2);ze([d()],de.prototype,"error",2);ze([d()],de.prototype,"posterBust",2);de=ze([m("live-wall")],de);var An=Object.defineProperty,On=Object.getOwnPropertyDescriptor,Y=(e,t,s,i)=>{for(var a=i>1?void 0:i?On(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&An(t,s,a),a};let V=class extends w{constructor(){super(...arguments),this.cameraId="cam-1",this.cam=null,this.cams=[],this.settings=null,this.error="",this.loading=!0,this.profile="main",this.transport="auto",this.playerStatus="",this.playerTransport="",this.posterBust=Date.now(),this.ptzMode="presets"}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("cameraId")&&e.get("cameraId")!==void 0&&this.load()}async load(){this.loading=!0,this.error="";try{if(S()){const[e,t]=await Promise.all([Ze(),Mt()]);this.cams=e.cameras,this.cam=e.cameras.find(s=>s.id===this.cameraId)??null,this.settings=t,this.transport=Ls(t)}}catch(e){this.error=x(e)}finally{this.loading=!1}}setTransport(e){Qa(e===(this.settings?.["media.transport_default"]??"mse")?"":e),this.transport=e}onPlayer(e){this.playerStatus=e.detail.status,this.playerTransport=e.detail.transport??""}renderApi(){const e=this.cam;if(this.loading)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(this.error)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!e)return r`<sw-state-panel state="forbidden" heading="המצלמה לא זמינה" hint="המצלמה לא נמצאה או שאין לך הרשאת צפייה בה."></sw-state-panel>`;const t=e.can_view_live!==!1&&e.status!=="offline",s=ct(e.id,this.posterBust),i=e.stream;return r`
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
          ${Si()?r`<span class="note">ברירת המחדל של המערכת: ${this.settings?.["media.transport_default"]??"mse"}</span>`:p}
        </div>
        <div class="note">${this.playerStatus==="playing"?`מנגן דרך ${this.playerTransport==="webrtc"?"WebRTC":"MSE"}`:this.playerStatus==="error"?"הזרם לא זמין":"מתחבר…"}</div>
      </div>
      <div class="note" style="margin-block-start:8px">PTZ ושמע יוצגו אחרי אימות היכולת מול המכשיר (T012/T031); פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>
      <div class="grid">
        <sw-card heading="פרטים">
          <dl>
            <dt>מצב</dt><dd><sw-badge kind=${e.status==="online"?"live":e.status==="offline"?"offline":"unknown"}></sw-badge></dd>
            <dt>ערוץ</dt><dd>${e.channel} · <span class="ltr">track ${e.main_track??"?"}</span></dd>
            <dt>שם ב־NVR</dt><dd>${e.name_source||"—"}</dd>
            <dt>זרם ראשי</dt><dd>${i?`${i.resolution??""} · ${i.fps??"?"} fps · ${i.bitrate_kbps??"?"} kbps`:"לא נבדק"}</dd>
            <dt>זמן מקור</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
            <dt>נראתה לאחרונה</dt><dd>${e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</dd>
          </dl>
        </sw-card>
        <sw-card heading="מצלמות נוספות">
          <div class="tiles">
            ${this.cams.filter(a=>a.id!==e.id).slice(0,4).map(a=>r`<sw-camera-tile compact name=${a.name} state=${a.status==="online"?"live":a.status==="offline"?"offline":"unknown"} poster=${a.status==="offline"?"":ct(a.id)} @click=${()=>g(`/live/cameras/${a.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    `}renderDemo(){const e=P.find(i=>i.id===this.cameraId)??P[0],t=e.state==="live"||e.state==="stale",s=oe[e.id]??"lobby";return r`
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
          ${e.audio?r`<button title="מיקרופון" aria-label="מיקרופון" ?disabled=${!t}><sw-icon name="mic" size=${16}></sw-icon></button><button title="שמע" aria-label="שמע" ?disabled=${!t}><sw-icon name="volume" size=${16}></sw-icon></button>`:p}
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
            </div>`:p}
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
            ${P.filter(i=>i.floor===e.floor&&i.id!==e.id).slice(0,4).map(i=>r`<sw-camera-tile compact name=${i.name} state=${i.state} scene=${oe[i.id]??"lobby"} @click=${()=>g(`/live/cameras/${i.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    `}render(){const e=S(),t=e?this.cam?.name??"מצלמה":(P.find(i=>i.id===this.cameraId)??P[0]).name,s=e?this.cam?`ערוץ ${this.cam.channel} · ${this.cam.name_source||""}`:"":`${(P.find(i=>i.id===this.cameraId)??P[0]).floor} · נתוני הדגמה`;return r`
      <sw-page heading=${t} subheading=${s} crumbs="מצלמות | שידור חי">
        ${this.cam?r`<sw-badge slot="actions" kind=${this.cam.status==="online"?"live":this.cam.status==="offline"?"offline":"unknown"}></sw-badge>`:p}
        <a slot="actions" href=${e&&this.cam?`#/investigate/playback?camera=${this.cam.id}`:"#/investigate/playback"}><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label="במפה"></sw-button></a>
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};V.styles=v`
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
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
  `;Y([h()],V.prototype,"cameraId",2);Y([d()],V.prototype,"cam",2);Y([d()],V.prototype,"cams",2);Y([d()],V.prototype,"settings",2);Y([d()],V.prototype,"error",2);Y([d()],V.prototype,"loading",2);Y([d()],V.prototype,"profile",2);Y([d()],V.prototype,"transport",2);Y([d()],V.prototype,"playerStatus",2);Y([d()],V.prototype,"playerTransport",2);Y([d()],V.prototype,"posterBust",2);Y([d()],V.prototype,"ptzMode",2);Y([gt("sw-live-player")],V.prototype,"player",2);V=Y([m("live-camera")],V);var Cn=Object.defineProperty,En=Object.getOwnPropertyDescriptor,as=(e,t,s,i)=>{for(var a=i>1?void 0:i?En(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Cn(t,s,a),a};let qe=class extends w{constructor(){super(...arguments),this.checked=!1,this.disabled=!1,this.label=""}flip(){this.disabled||(this.checked=!this.checked,this.dispatchEvent(new CustomEvent("change",{detail:{checked:this.checked},bubbles:!0,composed:!0})))}render(){return r`<button type="button" role="switch" aria-checked=${this.checked} aria-label=${this.label} ?disabled=${this.disabled} @click=${this.flip}></button>${this.label?r`<span>${this.label}</span>`:""}`}};qe.styles=v`
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
  `;as([h({type:Boolean,reflect:!0})],qe.prototype,"checked",2);as([h({type:Boolean,reflect:!0})],qe.prototype,"disabled",2);as([h()],qe.prototype,"label",2);qe=as([m("sw-toggle")],qe);var In=Object.getOwnPropertyDescriptor,Tn=(e,t,s,i)=>{for(var a=i>1?void 0:i?In(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const Dn=[{name:"כל המצלמות",layout:9,scope:"משותפת",mobile:"4 · משני",owner:"יוני",kiosk:!0},{name:"חוץ",layout:4,scope:"משותפת",mobile:"2 · משני",owner:"יוני",kiosk:!1},{name:"פנים",layout:6,scope:"משותפת",mobile:"ללא",owner:"יוסי",kiosk:!1},{name:"לילה",layout:4,scope:"אישית",mobile:"4 · משני",owner:"דנה",kiosk:!1}];let zs=class extends w{render(){return r`
      <sw-page heading="תצוגות שמורות" subheading="תבניות 1 / 2 / 4 / 6 / 9 / 12 / 16 / מותאם, אישיות או משותפות, עם התאמה למובייל · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תצוגה חדשה</sw-button>
        <div class="grid">
          ${Dn.map(e=>{const t=Math.ceil(Math.sqrt(e.layout));return r`<sw-card heading=${e.name}>
              <sw-badge slot="actions" kind="neutral" label=${e.scope}></sw-badge>
              <div class="thumb" style="grid-template-columns:repeat(${t},1fr)">${P.filter(s=>s.state==="live").slice(0,e.layout).map(s=>r`<sw-scene kind=${oe[s.id]??"lobby"}></sw-scene>`)}</div>
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
    `}};zs.styles=v`
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
  `;zs=Tn([m("live-views")],zs);var Nn=Object.defineProperty,Rn=Object.getOwnPropertyDescriptor,rs=(e,t,s,i)=>{for(var a=i>1?void 0:i?Rn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Nn(t,s,a),a};let Ke=class extends w{constructor(){super(...arguments),this.cams=null,this.settings=null,this.clock=""}connectedCallback(){super.connectedCallback(),this.tick(),this.timer=window.setInterval(()=>this.tick(),1e3),this.unsubscribe=Ti(e=>{e.mode==="api"&&this.cams===null?this.load():e.mode!=="loading"&&this.requestUpdate()})}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer),this.unsubscribe?.()}tick(){const e=new Date;this.clock=`${e.toLocaleDateString("he-IL",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})} · ${e.toLocaleTimeString("he-IL")}`}async load(){if(S())try{const[e,t]=await Promise.all([Ze(),Mt()]);this.cams=e.cameras.filter(s=>s.enabled),this.settings=t}catch{this.cams=[]}}render(){const t=S(),s=t?(this.cams??[]).slice(0,9):[],i=P.filter(o=>o.state!=="forbidden").slice(0,9),a=t?s.filter(o=>o.status==="online").length:7,n=this.settings?.["media.max_live_sessions"]??8;return r`
      <header>
        <img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" />
        <h1>ניטור חי</h1>
        <span class="spacer"></span>
        <sw-badge kind="live" label=${`${t?s.length:i.length} מצלמות · ${a} חיות`}></sw-badge>
        <span class="clock">${this.clock||"—"}</span>
      </header>
      <div class="grid">
        ${t?s.map((o,l)=>r`<sw-camera-tile dark name=${o.name} state=${o.status==="online"?"live":o.status==="offline"?"offline":"unknown"} ?live=${o.status!=="offline"&&l<n} cameraId=${o.id} profile="sub" transport=${Ls(this.settings)} poster=${o.status==="offline"?"":ct(o.id)} noDemo></sw-camera-tile>`):i.map(o=>r`<sw-camera-tile dark name=${o.name} state=${o.state} scene=${oe[o.id]??"lobby"} noDemo></sw-camera-tile>`)}
      </div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${16}></sw-icon></div><div><b>${t?`${a}/${s.length}`:"7/9"}</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic red"><sw-icon name="warning" size=${16}></sw-icon></div><div><b>${t?s.filter(o=>o.status==="offline").length:3}</b><span>${t?"מצלמות מנותקות":"התראות פתוחות"}</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${16}></sw-icon></div><div><b>${t?Math.min(s.length,n):2}</b><span>${t?"זרמים חיים במקביל":"מבנים"}</span></div></div>
        <div class="stat"><div class="ic green"><sw-icon name="check" size=${16}></sw-icon></div><div><b style="font-size:var(--sw-fs-lg)">${t?"פעיל":"חלקי"}</b><span>${t?"go2rtc + NVR":"מצב מערכת · גשר HA לא רענן"}</span></div></div>
      </div>
      <div class="note">תצוגת קיוסק: קריאה בלבד, ללא פקדי ניהול, חיבור מחדש אוטומטי${t?"":" · נתוני הדגמה (סצנות מאוירות עד חיבור הזרמים)"}</div>
    `}};Ke.styles=v`
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
  `;rs([d()],Ke.prototype,"cams",2);rs([d()],Ke.prototype,"settings",2);rs([d()],Ke.prototype,"clock",2);Ke=rs([m("kiosk-wall")],Ke);var Hn=Object.defineProperty,Ln=Object.getOwnPropertyDescriptor,re=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ln(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Hn(t,s,a),a};const It=[{label:"יום",minutes:1440},{label:"6 שע׳",minutes:360},{label:"שעה",minutes:60},{label:"10 דק׳",minutes:10},{label:"דקה",minutes:1}];function Ss(e){return String(e).padStart(2,"0")}function ue(e){const t=(e%1440+1440)%1440;return`${Ss(Math.floor(t/60))}:${Ss(Math.floor(t%60))}`}function Wi(e){const t=(e%1440+1440)%1440,s=Math.min(59,Math.round(t%1*60));return`${ue(t)}:${Ss(s)}`}const jn={motion:"#ef4444",person:"#2f6bff",vehicle:"#22c55e",line:"#f59e0b",offline:"#6b7280",door:"#8b5cf6"};let Q=class extends w{constructor(){super(...arguments),this.segments=[],this.events=[],this.cursor=615,this.windowMinutes=360,this.precision="estimated",this.follow=!0,this.limit=1440,this.hover=null,this.viewStart=-1,this.dragging=!1}get start(){const e=Math.max(0,1440-this.windowMinutes);return this.viewStart>=0&&!this.follow?Math.max(0,Math.min(e,this.viewStart)):Math.max(0,Math.min(e,this.cursor-this.windowMinutes/2))}get step(){return this.windowMinutes>=360?1:this.windowMinutes>=60?1/6:1/60}snap(e){const t=this.step;return Math.max(0,Math.min(this.limit,Math.round(e/t)*t))}x(e,t){return(e-this.start)/this.windowMinutes*t}minuteAt(e){const t=e.currentTarget.getBoundingClientRect();return this.start+(e.clientX-t.left)/t.width*this.windowMinutes}onMove(e){const t=this.minuteAt(e);if(this.hover=t,this.dragging){const s=this.snap(t);this.cursor=s,this.dispatchEvent(new CustomEvent("scrub",{detail:{minute:s},bubbles:!0,composed:!0}))}}onDown(e){e.button===0&&(e.currentTarget.setPointerCapture(e.pointerId),this.dragging=!0,this.viewStart=this.start,this.follow=!1)}onUp(e){if(!this.dragging)return;this.dragging=!1;const t=this.snap(this.minuteAt(e));this.cursor=t,this.follow=!0,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:t},bubbles:!0,composed:!0}))}onWheel(e){e.preventDefault();const t=It.findIndex(i=>i.minutes===this.windowMinutes),s=Math.max(0,Math.min(It.length-1,t+(e.deltaY>0?-1:1)));s!==t&&this.setWindow(It[s].minutes,this.minuteAt(e))}setWindow(e,t=this.cursor){const s=Math.max(0,Math.min(1,(t-this.start)/this.windowMinutes));this.windowMinutes=e,this.viewStart=t-s*e,this.follow=!1,this.dispatchEvent(new CustomEvent("window-change",{detail:{minutes:e},bubbles:!0,composed:!0}))}buckets(e){const t=[],s=this.windowMinutes/e;for(let i=0;i<e;i++){const a=this.start+i*s,n=a+s;let o=0;for(const l of this.segments)l.endMin>a&&l.startMin<n&&(o=Math.max(o,l.kind==="motion"?2:1));o&&this.events.some(l=>l.minute>=a-s&&l.minute<=n+s)&&(o=3),t.push(o)}return t}tickEvery(){const e=this.windowMinutes;return e<=1?10/60:e<=10?1:e<=60?10:e<=360?60:180}label(e){return this.windowMinutes<=10?Wi(e):ue(e)}render(){const n=this.tickEvery(),o=[];for(let _=Math.ceil(this.start/n-1e-9)*n;_<=this.start+this.windowMinutes+1e-9;_+=n)o.push(_);const l=[0,12,26,36],u={verified:"זמן מאומת",keyframe_limited:"דיוק לפי keyframe",estimated:"זמן משוער",unknown:"דיוק לא ידוע"}[this.precision],$=this.x(this.cursor,1e3),b=this.label(this.cursor),y=b.length>5?62:48,M=this.limit<this.start+this.windowMinutes?Math.max(0,this.x(this.limit,1e3)):null;return r`
      <div class="bar">
        <span class="precision">${u} · לחיצה או גרירה = seek · גלגלת = זום</span>
        <div class="windows">
          ${It.map(_=>r`<button class=${_.minutes===this.windowMinutes?"on":""} @click=${()=>this.setWindow(_.minutes)}>${_.label}</button>`)}
        </div>
      </div>
      <svg
        class=${this.dragging?"dragging":""}
        viewBox="0 0 ${1e3} ${84}"
        preserveAspectRatio="none"
        @pointermove=${this.onMove}
        @pointerleave=${()=>this.hover=null}
        @pointerdown=${this.onDown}
        @pointerup=${this.onUp}
        @pointercancel=${()=>this.dragging=!1}
        @wheel=${this.onWheel}
        role="img"
        aria-label="ציר זמן הקלטות">
        <line x1="0" x2=${1e3} y1=${58+.5} y2=${58+.5} stroke="var(--sw-border)" />
        ${M!==null?c`<rect x=${M} y="14" width=${Math.max(0,1e3-M)} height=${44} fill="var(--sw-surface-3)" opacity="0.7" />`:p}
        ${this.buckets(160).map((_,te)=>{if(!_)return p;const Us=l[_];return c`<rect x=${te*6.25+1} y=${58-Us} width=${Math.max(2,6.25-2)} height=${Us} rx="1.5" fill="var(--sw-accent)" opacity=${_===1?.45:_===2?.8:1} />`})}
        ${o.map(_=>c`<line x1=${this.x(_,1e3)} x2=${this.x(_,1e3)} y1=${58} y2=${63} stroke="var(--sw-border-strong)" /><text x=${this.x(_,1e3)} y=${78} font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${this.label(_)}</text>`)}
        ${this.events.map(_=>{const te=this.x(_.minute,1e3);return te<0||te>1e3?p:c`<g><circle cx=${te} cy=${58-l[3]-8} r="3.5" fill=${jn[_.kind]} /><title>${_.label} · ${ue(_.minute)}</title></g>`})}
        ${this.hover!==null&&!this.dragging?c`<line x1=${this.x(this.hover,1e3)} x2=${this.x(this.hover,1e3)} y1="18" y2=${58} stroke="var(--sw-text-3)" stroke-dasharray="3 3" /><text x=${this.x(this.hover,1e3)} y="12" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font-mono)">${this.label(this.hover)}</text>`:p}
        ${$>=-60&&$<=1060?c`<g transform="translate(${$} 0)">
              <line x1="0" x2="0" y1="15" y2=${62} stroke="var(--sw-accent)" stroke-width="2" />
              <rect x=${-y/2} y="0" width=${y} height="16" rx="5" fill="var(--sw-accent)" />
              <text x="0" y="11.5" font-size="10.5" text-anchor="middle" fill="#fff" font-family="var(--sw-font-mono)" font-weight="600">${b}</text>
            </g>`:p}
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-accent)">הקלטה (גובה = פעילות)</span>
        <span style="--lg: #ef4444">תנועה</span>
        <span style="--lg: #2f6bff">אדם</span>
        <span style="--lg: #22c55e">רכב</span>
        <span style="--lg: #8b5cf6">דלת</span>
        <span style="--lg: var(--sw-border-strong)">ריק = אין הקלטה / לא נבדק</span>
        ${this.limit<1440?r`<span style="--lg: var(--sw-surface-3)">אפור = עתיד</span>`:p}
      </div>
    `}};Q.styles=v`
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
  `;re([h({attribute:!1})],Q.prototype,"segments",2);re([h({attribute:!1})],Q.prototype,"events",2);re([h({type:Number})],Q.prototype,"cursor",2);re([h({type:Number})],Q.prototype,"windowMinutes",2);re([h()],Q.prototype,"precision",2);re([h({type:Boolean})],Q.prototype,"follow",2);re([h({type:Number})],Q.prototype,"limit",2);re([d()],Q.prototype,"hover",2);re([d()],Q.prototype,"viewStart",2);re([d()],Q.prototype,"dragging",2);Q=re([m("sw-timeline")],Q);const Bn=(e,t)=>D(`cameras/${e}/recordings?date=${t}`),Vn=(e,t)=>N("playback/sessions",{camera_id:e,start_at:t}),Un=(e,t)=>N(`playback/sessions/${e}/seek`,{start_at:t}),Wn=e=>kt(`playback/sessions/${e}`);function pi(e){const t=new URL(ke(`playback/sessions/${e.id}/ws?generation=${e.generation}`));return t.protocol=t.protocol==="https:"?"wss:":"ws:",t.toString()}function Le(e,t){const s=new Intl.DateTimeFormat("en-CA",{timeZone:t,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(e),i=a=>s.find(n=>n.type===a)?.value??"";return`${i("year")}-${i("month")}-${i("day")}`}function ne(e,t){const s=new Intl.DateTimeFormat("en-GB",{timeZone:t,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(e),i=a=>Number(s.find(n=>n.type===a)?.value??0);return i("hour")*60+i("minute")+i("second")/60}function Re(e,t,s){const[i,a,n]=e.split("-").map(Number),o=Date.UTC(i,a-1,n,Math.floor(t/60),Math.floor(t%60),Math.round(t%1*60)),l=$=>{const b=new Intl.DateTimeFormat("en-US",{timeZone:s,hour12:!1,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date($)),y=_=>Number(b.find(te=>te.type===_)?.value??0);return Date.UTC(y("year"),y("month")-1,y("day"),y("hour")%24,y("minute"),y("second"))-$};let u=o-l(o);return u=o-l(u),new Date(u)}const Fn=(e,t)=>N("playback/groups",{camera_ids:e,start_at:t}),qn=(e,t)=>N(`playback/groups/${e}/seek`,{start_at:t}),Kn=e=>kt(`playback/groups/${e}`),Fi=(e,t,s)=>({camera_id:e,from_at:t,to_at:s}),Jn=(e,t,s)=>N("exports/estimate",Fi(e,t,s)),Gn=(e,t,s)=>N("exports",Fi(e,t,s)),Yn=()=>D("exports"),Zn=e=>N(`exports/${e}/cancel`),Xn=e=>kt(`exports/${e}`),Qn=e=>ke(`exports/${e}/download`),eo=e=>ke(`exports/${e}/manifest`);function rt(e){return e==null?"—":e<1024*1024?`${Math.round(e/1024)} KB`:e<1024*1024*1024?`${(e/1024/1024).toFixed(1)} MB`:`${(e/1024/1024/1024).toFixed(2)} GB`}function to(e={}){const t=new URLSearchParams;e.date&&t.set("date",e.date),e.cameraId&&t.set("camera_id",e.cameraId),e.type&&t.set("type",e.type),e.unacked&&t.set("unacked","true"),e.limit&&t.set("limit",String(e.limit));const s=t.toString();return D(`events${s?`?${s}`:""}`)}const so=(e,t)=>D(`cameras/${e}/events?date=${t}`),io=e=>N(`events/${e}/ack`),it={motion:"תנועה",person:"אדם",vehicle:"רכב",line:"חציית קו",field:"חדירה לאזור",offline:"אובדן וידאו",tamper:"חבלה במצלמה",door:"דלת",io:"כניסת חיווי",storage:"אחסון",system:"מערכת",coverage_gap:"פער בקליטת אירועים",manual:"הקלטה ידנית",other:"אחר"},ao={motion:"#ef4444",person:"#2f6bff",vehicle:"#22c55e",line:"#f59e0b",field:"#f59e0b",offline:"#6b7280",tamper:"#b45309",door:"#8b5cf6",io:"#8b5cf6",storage:"#6b7280",system:"#6b7280",coverage_gap:"#6b7280",manual:"#2f6bff",other:"#6b7280"};function ro(e){return e==="person"||e==="vehicle"||e==="motion"||e==="line"||e==="offline"||e==="door"?e:e==="field"?"line":e==="io"?"door":e==="tamper"||e==="coverage_gap"||e==="storage"||e==="system"?"offline":"motion"}function no(e,t){let s=null,i=!1,a=2e3;const n=(()=>{const l=new URL(ke("events/ws"));return l.protocol=l.protocol==="https:"?"wss:":"ws:",l.toString()})(),o=()=>{if(!i){try{s=new WebSocket(n)}catch{return}s.onopen=()=>{a=2e3,t?.(null,!0)},s.onmessage=l=>{try{const u=JSON.parse(l.data);u.type==="event_added"?e(u.payload):u.type==="heartbeat"&&t?.(u.payload.ingest,!0)}catch{}},s.onclose=()=>{t?.(null,!1),i||(window.setTimeout(o,a),a=Math.min(3e4,a*2))}}};return o(),()=>{i=!0,s?.close()}}var oo=Object.defineProperty,lo=Object.getOwnPropertyDescriptor,z=(e,t,s,i)=>{for(var a=i>1?void 0:i?lo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&oo(t,s,a),a};const tt=["closed","expired","failed"];function st(e){return Wi(Math.max(0,Math.min(1439.983,e)))}function hs(e){const[t=0,s=0,i=0]=e.split(":").map(Number);return t*60+s+i/60}let k=class extends w{constructor(){super(...arguments),this.cameraId="",this.at="",this.demoCamera="cam-10",this.cursor=615,this.generation=3,this.playing=!0,this.speed=1,this.filter="all",this.cams=null,this.tz="Asia/Jerusalem",this.date="",this.rec=null,this.dayEvents=[],this.loadingRec=!1,this.session=null,this.group=null,this.extra=[],this.busy=!1,this.error="",this.notice="",this.tileStatus={},this.drifts={},this.paused=!1,this.scrubbing=!1,this.position=null,this.exportOpen=!1,this.exportFrom="",this.exportTo="",this.estimate=null,this.exportJob=null,this.exportBusy=!1,this.exportError=""}connectedCallback(){super.connectedCallback(),S()&&(this.init(),this.ticker=window.setInterval(()=>this.tick(),500))}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.ticker),this.endSession()}updated(e){S()&&e.has("cameraId")&&e.get("cameraId")!==void 0&&this.cams&&this.selectCamera(this.cameraId,!0)}get members(){return[this.cameraId,...this.extra.filter(e=>e!==this.cameraId)]}get groupMode(){return this.extra.filter(e=>e!==this.cameraId).length>0}get masterSession(){return this.groupMode?this.group?.sessions.find(e=>e.camera_id===this.cameraId)??this.group?.sessions[0]??null:this.session}get live(){const e=this.masterSession;return!!e&&!tt.includes(e.state)&&(this.groupMode?!!this.group:!0)}async init(){try{const[e,t]=await Promise.all([Mt(),Ze()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras.filter(n=>n.enabled);const s=this.cams.find(n=>n.id===this.cameraId)??this.cams[0],i=this.at?new Date(this.at):null,a=!!i&&!Number.isNaN(i.getTime());if(this.date=Le(a?i:new Date,this.tz),s)if(this.cameraId=s.id,await this.loadRecordings(),a)this.cursor=ne(i,this.tz),await this.startAt(i);else{const n=this.rec?.segments.at(-1);this.cursor=n?Math.max(0,ne(new Date(n.end_at),this.tz)-5):Math.max(0,ne(new Date,this.tz)-5)}}catch(e){this.error=x(e)}}async selectCamera(e,t=!1){!e||!t&&e===this.cameraId||(await this.endSession(),this.cameraId=e,this.extra=this.extra.filter(s=>s!==e),this.error="",this.notice="",await this.loadRecordings())}async setDate(e){if(!e||e===this.date)return;await this.endSession(),this.date=e,await this.loadRecordings();const t=this.rec?.segments.at(-1);this.cursor=t?Math.max(0,ne(new Date(t.end_at),this.tz)-5):540}async loadRecordings(){if(!(!this.cameraId||!this.date)){this.loadingRec=!0,this.rec=null;try{const[e,t]=await Promise.all([Bn(this.cameraId,this.date),so(this.cameraId,this.date).catch(()=>({events:[]}))]);this.rec=e,this.dayEvents=t.events,this.error=""}catch(e){this.error=x(e)}finally{this.loadingRec=!1}}}get markers(){return this.dayEvents.map(e=>({minute:ne(new Date(e.occurred_at),this.tz),kind:ro(e.type),label:`${it[e.type]??e.type}${e.confidence==="inferred"?" (מהקלטה)":""}${e.count>1?` ×${e.count}`:""}`}))}get segmentsMin(){return this.rec?this.rec.segments.map(e=>{const t=ne(new Date(e.start_at),this.tz);let s=ne(new Date(e.end_at),this.tz);return s<t&&(s=1440),{startMin:t,endMin:s,kind:e.kind==="continuous"?"continuous":"motion"}}):[]}inRecording(e){return this.segmentsMin.some(t=>e>=t.startMin&&e<=t.endMin)}get limitMinute(){return this.date===Le(new Date,this.tz)?ne(new Date,this.tz):1440}cameraName(e){return this.cams?.find(t=>t.id===e)?.name??e}async startAt(e){if(!(!this.cameraId||this.busy)){this.busy=!0,this.error="",this.notice="",this.scrubbing=!1;try{const t=e.toISOString().replace(/\.\d{3}Z$/,"Z");if(this.groupMode){const s=this.group&&this.group.sessions.some(a=>!tt.includes(a.state))?await qn(this.group.id,t):await Fn(this.members,t);this.group=s,this.session=null,this.position=new Date(s.requested_at);const i=Object.keys(s.missing);i.length&&(this.notice=`ללא הקלטה בזמן הזה: ${i.map(a=>this.cameraName(a)).join(", ")}`)}else{const s=this.session&&!tt.includes(this.session.state)?await Un(this.session.id,t):await Vn(this.cameraId,t);this.session=s,this.group=null,this.position=new Date(s.requested_at),s.moved_to_next_segment&&(this.notice=`אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא (${this.fmt(new Date(s.requested_at))}).`)}this.cursor=ne(this.position,this.tz),this.paused=!1,this.tileStatus={},this.drifts={}}catch(t){if(t instanceof fe&&t.body.code==="no_recording")this.notice="אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live.",this.position=e;else if(t instanceof fe&&(t.body.code==="session_over"||t.body.code==="not_found")){this.session=null,this.group=null,this.busy=!1,await this.startAt(e);return}else this.error=x(t)}finally{this.busy=!1}}}async endSession(){const e=this.session,t=this.group;this.session=null,this.group=null,this.tileStatus={},this.drifts={};try{t?await Kn(t.id):e&&!tt.includes(e.state)&&await Wn(e.id)}catch{}}async toggleExtra(e){const t=this.extra.includes(e)?this.extra.filter(i=>i!==e):[...this.extra,e].slice(-3),s=this.currentInstant();await this.endSession(),this.extra=t,s&&await this.startAt(s)}players(){return Array.from(this.renderRoot.querySelectorAll("sw-live-player"))}masterPlayer(){return this.players().find(e=>e.dataset.camera===this.cameraId)??this.players()[0]}currentInstant(){const e=this.masterSession;if(!e)return this.position;const t=new Date(e.requested_at).getTime();return new Date(t+(this.masterPlayer()?.mediaTime??0)*1e3)}tick(){if(!this.masterSession||this.paused||this.scrubbing)return;const t=this.masterPlayer();if(!t||t.status!=="playing")return;const s=this.currentInstant();if(s&&(this.position=s,this.cursor=ne(s,this.tz)),this.groupMode&&this.group){const i={};for(const a of this.players()){const n=a.dataset.camera??"",o=this.group.sessions.find(u=>u.camera_id===n);if(!o||n===this.cameraId)continue;const l=new Date(o.requested_at).getTime()+a.mediaTime*1e3;i[n]=a.status==="playing"&&s?(l-s.getTime())/1e3:NaN}this.drifts=i}}async onSeek(e){const t=e.detail.minute,s=Re(this.date,t,this.tz);if(s.getTime()>Date.now()){this.notice="לא ניתן לנגן זמן עתידי.",this.scrubbing=!1;return}this.cursor=t,await this.startAt(s)}onScrub(e){this.scrubbing=!0,this.cursor=e.detail.minute,this.position=Re(this.date,e.detail.minute,this.tz)}async nudge(e){const t=this.currentInstant();t&&await this.startAt(new Date(t.getTime()+e*1e3))}togglePause(){const e=this.players();e.length&&(this.paused?e.forEach(t=>t.resume()):e.forEach(t=>t.pause()),this.paused=!this.paused)}onTilePlayer(e,t){if(this.tileStatus={...this.tileStatus,[e]:t.detail.status},e===this.cameraId&&(this.masterSession&&t.detail.status==="playing"&&this.session&&(this.session={...this.session,state:"playing"}),t.detail.status==="ended")){const s=this.currentInstant(),i=this.masterSession;s&&i&&new Date(i.playback_end_at).getTime()-s.getTime()<5e3&&this.startAt(new Date(new Date(i.playback_end_at).getTime()+1e3))}}fmt(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(e)}openExport(){const e=Math.floor(this.cursor*60)/60;this.exportFrom=st(Math.max(0,e-1)),this.exportTo=st(Math.min(this.limitMinute,e+1)),this.estimate=null,this.exportJob=null,this.exportError="",this.exportOpen=!0}exportRange(){const e=Re(this.date,hs(this.exportFrom),this.tz),t=Re(this.date,hs(this.exportTo),this.tz);return t.getTime()<=e.getTime()?(this.exportError="זמן הסיום חייב להיות אחרי ההתחלה.",null):[e.toISOString().replace(/\.\d{3}Z$/,"Z"),t.toISOString().replace(/\.\d{3}Z$/,"Z")]}async runEstimate(){const e=this.exportRange();if(e){this.exportBusy=!0,this.exportError="";try{this.estimate=await Jn(this.cameraId,e[0],e[1])}catch(t){this.exportError=x(t)}finally{this.exportBusy=!1}}}async runExport(){const e=this.exportRange();if(e){this.exportBusy=!0,this.exportError="";try{this.exportJob=await Gn(this.cameraId,e[0],e[1])}catch(t){this.exportError=x(t)}finally{this.exportBusy=!1}}}renderExportDialog(){const e=this.estimate,t=this.exportJob;return r`<sw-dialog ?open=${this.exportOpen} heading="ייצוא קטע" subheading=${`${this.cameraName(this.cameraId)} · ${this.date} · ${this.tz}`} @close=${()=>this.exportOpen=!1}>
      <div class="dlg">
        ${t?r`<div class="est"><strong>עבודת הייצוא נוצרה</strong><span>${t.files.length} קבצים · משוער ${rt(t.estimate_bytes)} · מצב: ${t.state}</span><span>ההתקדמות וההורדה במסך "ייצוא".</span></div>`:r`
              <div class="row">
                <sw-field label="מ־"><input type="time" step="1" data-ltr .value=${this.exportFrom} @change=${s=>{this.exportFrom=s.target.value,this.estimate=null}} /></sw-field>
                <sw-field label="עד"><input type="time" step="1" data-ltr .value=${this.exportTo} @change=${s=>{this.exportTo=s.target.value,this.estimate=null}} /></sw-field>
              </div>
              ${e?r`<div class="est">
                    <span>${e.files} קבצי NVR בטווח · נפח משוער ${rt(e.estimate_bytes)} (מקסימום ${rt(e.max_bytes)}) · כיסוי ${e.coverage==="complete"?"מלא":"חלקי"}</span>
                    ${e.first_file_at?r`<span class="ltr">${this.fmt(new Date(e.first_file_at))} → ${this.fmt(new Date(e.last_file_end_at??e.first_file_at))}</span>`:p}
                    <span>${e.note}</span>
                    ${e.ffmpeg?p:r`<span class="warn">ffmpeg לא זמין בשרת: הקובץ יימסר במיכל המקורי (Hikvision PS) ללא חיתוך.</span>`}
                  </div>`:r`<div class="session">הייצוא מוריד את הקבצים המקוריים מה־NVR (לפי קובץ, כך המכשיר תומך) ואז חותך לטווח ב־keyframe. חשב נפח לפני היצירה.</div>`}
            `}
        ${this.exportError?r`<div class="err">${this.exportError}</div>`:p}
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        ${t?r`<sw-button variant="primary" icon="download" @click=${()=>g("/investigate/exports")}>למסך הייצוא</sw-button><sw-button @click=${()=>this.exportOpen=!1}>סגור</sw-button>`:r`<sw-button ?disabled=${this.exportBusy} @click=${()=>this.runEstimate()}>חשב נפח</sw-button>
              <sw-button variant="primary" icon="download" ?disabled=${this.exportBusy||!e||!e.files} @click=${()=>this.runExport()}>צור ייצוא</sw-button>
              <sw-button variant="ghost" @click=${()=>this.exportOpen=!1}>ביטול</sw-button>`}
      </div>
    </sw-dialog>`}renderStage(e){const t=this.live,s=!t&&!this.inRecording(this.cursor);if(this.groupMode){const a=this.members;return r`<div class="grid ${a.length===1?"one":""}">
        ${a.map(n=>{const o=this.group?.sessions.find(b=>b.camera_id===n),l=this.group?.missing[n],u=this.drifts[n],$=this.tileStatus[n];return r`<div class="tile ${n===this.cameraId?"master":""}">
            ${o&&!tt.includes(o.state)?r`<sw-live-player data-camera=${n} .wsUrl=${pi(o)} mode="mse" .retry=${!1} compact @player-status=${b=>this.onTilePlayer(n,b)}></sw-live-player>`:r`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${l==="gap"||l==="no_recording"?"אין הקלטה בזמן הזה":l==="playback_quota"?"מכסת הניגון מלאה":this.busy?"מכין…":this.group?"לא זמין":"לחץ על ציר הזמן"}</span></div></div>`}
            <span class="name">${this.cameraName(n)}${n===this.cameraId?r` · מוביל`:p}${n!==this.cameraId&&o&&$==="playing"&&Number.isFinite(u)?r`<span class="drift ${Math.abs(u)>2?"bad":""}">${u>=0?"+":""}${u.toFixed(1)}s</span>`:p}</span>
          </div>`})}
      </div>`}const i=this.session;return r`<div class="video ${s?"gap":""}">
      ${t&&i?r`<sw-live-player data-camera=${e.id} .wsUrl=${pi(i)} mode="mse" .retry=${!1} @player-status=${a=>this.onTilePlayer(e.id,a)}></sw-live-player>`:s?r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice||"אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live"}</span></div></div>`:r`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy?"מכין ניגון…":"לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר"}</span>${this.busy?p:r`<sw-button variant="primary" size="sm" icon="play" @click=${()=>this.startAt(Re(this.date,this.cursor,this.tz))}>נגן מ־${st(this.cursor)}</sw-button>`}</div></div>`}
      <div class="tag"><sw-badge kind=${t?"recorded":"unknown"} ?onImage=${!!t}></sw-badge><span class="nm">${e.name}</span></div>
    </div>`}renderApi(){if(this.error&&!this.cams)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.init()}></sw-state-panel>`;if(!this.cams)return r`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.cams.length)return r`<sw-state-panel state="empty" heading="אין מצלמות" hint="סנכרן מצלמות מה־NVR או בקש הרשאת ניגון."></sw-state-panel>`;const e=this.cams.find(o=>o.id===this.cameraId)??this.cams[0],t=this.masterSession,s=this.live,i=t?.time_precision??"unknown",a=this.position??Re(this.date,this.cursor,this.tz),n=this.tileStatus[this.cameraId]??"";return r`
      <div class="stage">
        ${this.renderStage(e)}
        <span class="stamp">${this.date} ${this.fmt(a)} · ${{verified:"מאומת",keyframe_limited:"דיוק לפי keyframe",estimated:"משוער",unknown:"—"}[i]}${this.groupMode?" · סנכרון best effort":""}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused?"play":"pause"} label=${this.paused?"המשך":"השהה"} ?disabled=${!s||n!=="playing"} @click=${()=>this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה" ?disabled=${!s||this.busy} @click=${()=>this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה" ?disabled=${!s||this.busy} @click=${()=>this.nudge(10)}></sw-button>
          <span class="sep"></span>
          <button class="q on" title="מהירויות נוספות יוצגו רק אם המסלול תומך">1×</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא" ?disabled=${!s} @click=${()=>this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${i} @seek=${this.onSeek} @scrub=${this.onScrub}></sw-timeline>
      <div class="compare">
        <span>השוואה (עד 4):</span>
        ${this.cams.filter(o=>o.id!==this.cameraId).map(o=>r`<sw-chip ?selected=${this.extra.includes(o.id)} @click=${()=>this.toggleExtra(o.id)}>${o.name}</sw-chip>`)}
        ${this.groupMode?r`<span>· ציר הזמן עוקב אחרי המצלמה המובילה; הסטייה של כל אריח מוצגת עליו (best effort, ללא עוגן זמן מאומת)</span>`:p}
      </div>
      <div class="filters">
        ${this.rec?r`<sw-chip icon="history">${this.rec.segments.length} מקטעים · ${this.rec.matches} קבצים</sw-chip>`:p}
        ${this.dayEvents.length?r`<sw-chip icon="bell" @click=${()=>g("/investigate/events",{camera:this.cameraId,date:this.date})}>${this.dayEvents.length} אירועים${this.dayEvents.every(o=>o.confidence==="inferred")?" (מהקלטות)":""}</sw-chip>`:p}
        ${this.rec?.coverage==="partial"?r`<span class="warn">כיסוי חלקי: ${this.rec.note}</span>`:p}
        ${this.loadingRec?r`<span class="session">מחפש הקלטות…</span>`:p}
        ${this.notice?r`<span class="warn">${this.notice}</span>`:p}
        ${this.error?r`<span class="err">${this.error}</span>`:p}
        <span class="grow"></span>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${()=>this.openExport()}>ייצוא</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">במפה</sw-button></a>
      </div>
      <div class="session">
        <span>Session: ${t?`${t.id} · דור ${this.groupMode?this.group?.generation??t.generation:t.generation} · ${t.state}`:"אין"}</span>
        <span>נגן: ${n||"—"}${this.paused?" (מושהה)":""}</span>
        <span>אזור זמן: <span class="ltr">${this.tz}</span></span>
        <span>כיסוי: ${this.rec?this.rec.coverage==="complete"?"מלא":this.rec.coverage==="partial"?"חלקי":"לא ידוע":"—"}</span>
        ${t?r`<span>סוף הטווח: ${this.fmt(new Date(t.playback_end_at))}</span>`:p}
      </div>
      ${this.renderExportDialog()}
    `}seekDemo(e){this.cursor=e.detail.minute,this.generation+=1}renderDemo(){const e=P.find(i=>i.id===this.demoCamera)??P[0],t=!Vt.some(i=>this.cursor>=i.startMin&&this.cursor<=i.endMin),s=he.filter(i=>i.minuteOfDay<1440).filter(i=>this.filter==="all"||i.type===this.filter).map(i=>({minute:i.minuteOfDay,kind:i.type,label:i.title}));return r`
      <div class="video ${t?"gap":""}">
        ${t?r`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`:r`<sw-scene kind=${oe[e.id]??"lobby"}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>`}
        <div class="tag"><sw-badge kind=${t?"unknown":"recorded"} ?onImage=${!t}></sw-badge><span class="nm">${e.name}</span></div>
        <span class="stamp">2026-09-14 ${ue(this.cursor)}:00 · actual: ${t?"—":ue(this.cursor)}</span>
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
      <sw-timeline .segments=${Vt} .events=${s} .cursor=${this.cursor} precision="estimated" @seek=${this.seekDemo}></sw-timeline>
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
        ${t?p:r`<span>מצלמה: ${e.name}</span>`}
      </div>
    `}render(){const e=S(),t=e?this.cams?.find(o=>o.id===this.cameraId):P.find(o=>o.id===this.demoCamera)??P[0],s=t?.name??"הקלטות",i=e?`${this.date} ${st(this.cursor)} · אזור זמן ${this.tz}`:`14.09.2026 ${ue(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה`,a=e?"הקלטות":`הקלטות | ${t?.floor??""}`,n=e?Le(new Date,this.tz):"2026-09-14";return r`
      <sw-page heading=${s} subheading=${i} crumbs=${a} wide>
        <div slot="actions" class="pick">
          ${e?r`<sw-field><select aria-label="מצלמה" @change=${o=>this.selectCamera(o.target.value)}>${(this.cams??[]).map(o=>r`<option value=${o.id} ?selected=${o.id===this.cameraId}>${o.name}</option>`)}</select></sw-field>`:r`<sw-field><select aria-label="מצלמה" @change=${o=>this.demoCamera=o.target.value}>${P.map(o=>r`<option value=${o.id} ?selected=${o.id===this.demoCamera}>${o.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" .value=${e?this.date:"2026-09-14"} max=${n} data-ltr aria-label="תאריך" @change=${o=>e&&this.setDate(o.target.value)} /></sw-field>
          <sw-field style="inline-size:110px"><input type="time" step="1" .value=${e?st(this.cursor):ue(this.cursor)} data-ltr aria-label="שעה" @change=${o=>{const l=o.target.value;if(e)this.onSeek(new CustomEvent("seek",{detail:{minute:hs(l)}}));else{const[u,$]=l.split(":").map(Number);this.cursor=u*60+$,this.generation+=1}}} /></sw-field>
        </div>
        ${e?p:r`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};k.styles=v`
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
  `;z([h()],k.prototype,"cameraId",2);z([h()],k.prototype,"at",2);z([d()],k.prototype,"demoCamera",2);z([d()],k.prototype,"cursor",2);z([d()],k.prototype,"generation",2);z([d()],k.prototype,"playing",2);z([d()],k.prototype,"speed",2);z([d()],k.prototype,"filter",2);z([d()],k.prototype,"cams",2);z([d()],k.prototype,"tz",2);z([d()],k.prototype,"date",2);z([d()],k.prototype,"rec",2);z([d()],k.prototype,"dayEvents",2);z([d()],k.prototype,"loadingRec",2);z([d()],k.prototype,"session",2);z([d()],k.prototype,"group",2);z([d()],k.prototype,"extra",2);z([d()],k.prototype,"busy",2);z([d()],k.prototype,"error",2);z([d()],k.prototype,"notice",2);z([d()],k.prototype,"tileStatus",2);z([d()],k.prototype,"drifts",2);z([d()],k.prototype,"paused",2);z([d()],k.prototype,"scrubbing",2);z([d()],k.prototype,"position",2);z([d()],k.prototype,"exportOpen",2);z([d()],k.prototype,"exportFrom",2);z([d()],k.prototype,"exportTo",2);z([d()],k.prototype,"estimate",2);z([d()],k.prototype,"exportJob",2);z([d()],k.prototype,"exportBusy",2);z([d()],k.prototype,"exportError",2);k=z([m("investigate-playback")],k);var co=Object.defineProperty,po=Object.getOwnPropertyDescriptor,js=(e,t,s,i)=>{for(var a=i>1?void 0:i?po(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&co(t,s,a),a};let ft=class extends w{constructor(){super(...arguments),this.cursor=615,this.playing=!1}render(){const e=[{cam:P[0],drift:"+0.2s",state:"recorded"},{cam:P[9],drift:"-0.4s",state:"recorded"},{cam:P[3],drift:"gap",state:"unknown"},{cam:P[1],drift:"buffering",state:"stale"}];return r`
      <sw-page heading="מרכז שליטה" subheading="ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה"><option>כל המסכים</option><option>כניסה + חצר</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${e.map(t=>r`<div class="tile">
              <span class="drift">${t.drift}</span>
              <sw-camera-tile name=${t.cam.name} state=${t.state} scene=${oe[t.cam.id]??"lobby"}></sw-camera-tile>
            </div>`)}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" value=${`2026-09-14T${ue(this.cursor)}`} data-ltr aria-label="זמן" @change=${t=>{const s=t.target.value.split("T")[1]??"10:15",[i,a]=s.split(":").map(Number);this.cursor=i*60+a}} /></sw-field>
          <sw-button iconOnly icon="mic" label="דיבור"></sw-button>
          <sw-button iconOnly icon="back10" label="אחורה"></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה הכל":"נגן הכל"} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button iconOnly icon="forward10" label="קדימה"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${Vt} .events=${he.slice(0,4).map(t=>({minute:t.minuteOfDay,kind:t.type,label:t.title}))} .cursor=${this.cursor} precision="estimated" @seek=${t=>this.cursor=t.detail.minute}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">כל המצלמות</sw-chip>
          <sw-chip dot="#ef4444">תנועה</sw-chip><sw-chip dot="#2f6bff">אדם</sw-chip><sw-chip dot="#22c55e">רכב</sw-chip><sw-chip dot="#8b5cf6">אחר</sw-chip>
        </div>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `}};ft.styles=v`
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
  `;js([d()],ft.prototype,"cursor",2);js([d()],ft.prototype,"playing",2);ft=js([m("investigate-sync")],ft);var ho=Object.defineProperty,uo=Object.getOwnPropertyDescriptor,Bs=(e,t,s,i)=>{for(var a=i>1?void 0:i?uo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ho(t,s,a),a};let wt=class extends w{constructor(){super(...arguments),this.floorId="f0",this.minute=615}get markers(){const e=i=>i==="cam-3"||this.minute>=190&&this.minute<=205?"unknown":"historic",t=Bt.filter(i=>i.floorId===this.floorId).map(i=>({id:i.id,kind:"camera",label:i.name,x:i.x,y:i.y,rotation:i.rotation,fov:i.fov,state:i.state==="forbidden"?"forbidden":e(i.id)})),s=ws.filter(i=>i.floorId===this.floorId).map((i,a)=>({id:i.id,kind:i.domain,label:i.name,x:i.x,y:i.y,state:a%2?"unknown":"historic"}));return[...t,...s]}render(){const e=xe.find(t=>t.id===this.floorId)??xe[0];return r`
      <div class="head">
        <div><h1>מפה היסטורית · ${e.name}</h1><div class="sub">מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${e.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${ue(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${t=>this.minute=Number(t.target.value)} aria-label="זמן" />
        <sw-chip @click=${()=>this.minute=Math.max(0,this.minute-60)}>-1 שעה</sw-chip><sw-chip @click=${()=>this.minute=Math.min(1439,this.minute+60)}>+1 שעה</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">גרסת מפה 3 (תקפה מ־01.09)</span>
      </div>
      <div class="stage">
        <sw-plan-canvas .planWidth=${e.planWidth} .planHeight=${e.planHeight} .plan=${Pi(e.id)} .markers=${this.markers}></sw-plan-canvas>
        <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = לא ידוע / פער</span><span>ישות: מצב ידוע אחרון</span></div>
      </div>
    `}};wt.styles=v`
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
  `;Bs([h()],wt.prototype,"floorId",2);Bs([d()],wt.prototype,"minute",2);wt=Bs([m("investigate-history-map")],wt);var fo=Object.defineProperty,wo=Object.getOwnPropertyDescriptor,ee=(e,t,s,i)=>{for(var a=i>1?void 0:i?wo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&fo(t,s,a),a};const mo={person:"#2f6bff",vehicle:"#22c55e",motion:"#ef4444",line:"#f59e0b",offline:"#6b7280",door:"#8b5cf6"},hi={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking","מסדרון מזרחי":"corridor"},vo={info:"מידע",alert:"התראה",critical:"קריטי"};let q=class extends w{constructor(){super(...arguments),this.cameraId="",this.date="",this.selected=null,this.filter="all",this.cams=null,this.tz="Asia/Jerusalem",this.type="",this.events=null,this.ingest=null,this.live=!1,this.error="",this.busy=!1,this.apiColumns=[{key:"thumb",label:"",width:"48px",render:e=>r`<div class="thumb none" style="inline-size:40px"><sw-icon name=${e.type==="offline"||e.type==="coverage_gap"?"offline":e.type==="person"?"user":e.type==="vehicle"?"route":e.type==="door"||e.type==="io"?"door":"bell"} size=${14}></sw-icon></div>`},{key:"type",label:"אירוע",render:e=>r`<span class="ty" style="--tone:${ao[e.type]??"#6b7280"}"><i></i>${it[e.type]??String(e.type)}${Number(e.count)>1?r` <span class="sub">×${String(e.count)}</span>`:p}</span><div class="sub">${e.confidence==="inferred"?"נגזר מהקלטה":"התראה מה־NVR"} · ${e.acked_at?`טופל · ${String(e.acked_by_username??"")}`:"ממתין לטיפול"}</div>`},{key:"camera_name",label:"מצלמה",render:e=>r`${String(e.camera_name??(e.channel?`ערוץ ${String(e.channel)}`:"מערכת"))}<div class="sub ltr">${String(e.raw_type)}</div>`},{key:"occurred_at",label:"זמן",render:e=>r`${this.fmt(String(e.occurred_at))}<div class="sub">${this.fmtDate(String(e.occurred_at))}${e.ended_at?` · עד ${this.fmt(String(e.ended_at))}`:""}</div>`},{key:"severity",label:"חומרה",render:e=>r`<sw-badge kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${vo[e.severity]??String(e.severity)}></sw-badge>`}],this.columns=[{key:"thumb",label:"תמונה",width:"80px",render:e=>e.type==="offline"||e.type==="door"?r`<div class="thumb none"><sw-icon name=${e.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:r`<sw-scene class="thumb" kind=${hi[String(e.camera)]??"lobby"}></sw-scene>`},{key:"title",label:"אירוע",render:e=>r`<span class="ty" style="--tone:${mo[e.type]}"><i></i>${bs[e.type]}</span><div class="sub">${String(e.title)} · ${e.acked?"טופל":"ממתין לטיפול"}</div>`},{key:"camera",label:"מצלמה",render:e=>r`${String(e.camera)}<div class="sub">${String(e.floor)}</div>`},{key:"time",label:"זמן",render:e=>r`${String(e.time)}<div class="sub ltr">${String(e.source)}</div>`},{key:"severity",label:"חומרה",render:e=>r`<sw-badge kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${{info:"מידע",alert:"התראה",critical:"קריטי"}[e.severity]}></sw-badge>`},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),S()&&(this.init(),this.unsubscribe=no(e=>this.onPushed(e),(e,t)=>{this.live=t,e&&(this.ingest=e)}))}disconnectedCallback(){super.disconnectedCallback(),this.unsubscribe?.()}async init(){try{const[e,t]=await Promise.all([Mt(),Ze()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras,this.date||(this.date=Le(new Date,this.tz)),await this.load()}catch(e){this.error=x(e)}}async load(){try{const e=await to({date:this.date||void 0,cameraId:this.cameraId||void 0,type:this.type||void 0,unacked:this.filter==="unacked",limit:500});this.events=e.events,this.ingest=e.ingest,this.error=""}catch(e){this.error=x(e)}}onPushed(e){if(!this.events)return;const t=Le(new Date(e.occurred_at),this.tz);if(this.date&&t!==this.date||this.cameraId&&e.camera_id!==this.cameraId||this.type&&e.type!==this.type)return;const s=this.cams?.find(n=>n.id===e.camera_id)?.name??null,i={...e,camera_name:e.camera_name??s},a=this.events.findIndex(n=>n.id===e.id);this.events=a>=0?this.events.map((n,o)=>o===a?i:n):[i,...this.events]}fmt(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date(e))}fmtDate(e){return new Intl.DateTimeFormat("he-IL",{timeZone:this.tz,day:"2-digit",month:"2-digit"}).format(new Date(e))}async ack(e){this.busy=!0;try{const t=await io(e.id);this.events=(this.events??[]).map(s=>s.id===e.id?{...s,...t}:s)}catch(t){this.error=x(t)}finally{this.busy=!1}}renderApi(){if(this.error&&!this.events)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.init()}></sw-state-panel>`;if(!this.events)return r`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.events.find(i=>i.id===this.selected)??null,t=this.ingest,s=this.events.filter(i=>!i.acked_at).length;return r`
      <div class="banner ${t&&!t.connected?"warn":""}">
        <span class="dot ${t?.connected?"on":""}"></span>
        <span>קליטה מה־NVR: ${t?t.connected?"מחובר":`מנותק${t.last_error?` (${t.last_error})`:""}`:"—"}${t?.last_heartbeat_at?` · פעימה ${this.fmt(t.last_heartbeat_at)}`:""}</span>
        <span>· עדכונים חיים: ${this.live?"פעיל":"מתחבר…"}</span>
        <span>· אירועים "נגזר מהקלטה" הם עדות מקובץ ההקלטה (inferred), לא התראה שנמדדה</span>
      </div>
      <div class="filters">
        <sw-field><select aria-label="מצלמה" @change=${i=>{this.cameraId=i.target.value,this.load()}}><option value="" ?selected=${!this.cameraId}>כל המצלמות</option>${(this.cams??[]).map(i=>r`<option value=${i.id} ?selected=${i.id===this.cameraId}>${i.name}</option>`)}</select></sw-field>
        <sw-field><select aria-label="סוג" @change=${i=>{this.type=i.target.value,this.load()}}><option value="" ?selected=${!this.type}>כל סוגי האירועים</option>${Object.keys(it).map(i=>r`<option value=${i} ?selected=${i===this.type}>${it[i]}</option>`)}</select></sw-field>
        <sw-field><input type="date" .value=${this.date} max=${Le(new Date,this.tz)} data-ltr aria-label="תאריך" @change=${i=>{this.date=i.target.value,this.load()}} /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>{this.filter="all",this.load()}} count=${this.events.length}>הכל</sw-chip>
        <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>{this.filter="unacked",this.load()}} count=${s}>ללא טיפול</sw-chip>
      </div>
      ${this.error?r`<div class="banner warn">${this.error}</div>`:p}
      <div class="stage">
        ${this.events.length?r`<sw-table .columns=${this.apiColumns} .rows=${this.events} .selected=${this.selected} @row-select=${i=>this.selected=i.detail.id}></sw-table>`:r`<sw-state-panel state="empty" heading="אין אירועים ביום הזה" hint="התראות מגיעות מה־NVR רק כשהטריגר מוגדר עם 'Notify Surveillance Center'; אירועי תנועה נגזרים מקובצי ההקלטה בהפעלה ובכל 10 דקות."></sw-state-panel>`}
        ${e?r`<sw-drawer open heading=${it[e.type]??e.type} subheading=${`${e.camera_name??(e.channel?`ערוץ ${e.channel}`:"מערכת")} · ${this.fmt(e.occurred_at)}`} @close=${()=>this.selected=null}>
              <div class="preview">${e.camera_id?"תמונת אירוע מהעבר אינה זמינה מה־NVR; תמונה חיה אינה ראיה לאירוע. פתח את ההקלטה בזמן האירוע.":"אירוע ללא מצלמה"}</div>
              <dl>
                <dt>מקור</dt><dd>${e.source==="alertstream"?"התראה מה־NVR (alertStream)":e.source==="recording"?"קובץ הקלטה (חיפוש)":"מערכת"} · raw: <span class="ltr">${e.raw_type}</span></dd>
                <dt>ודאות</dt><dd>${e.confidence==="measured"?"נמדד על ידי המכשיר":"נגזר (inferred)"}</dd>
                <dt>זמן אירוע</dt><dd><span class="ltr">${this.fmtDate(e.occurred_at)} ${this.fmt(e.occurred_at)}</span>${e.ended_at?r` → <span class="ltr">${this.fmt(e.ended_at)}</span>`:p} · נקלט <span class="ltr">${this.fmt(e.received_at)}</span>${typeof e.details.time_precision=="string"?r` · דיוק: ${String(e.details.time_precision)}`:p}</dd>
                <dt>חזרות</dt><dd>${e.count} · מצב ${e.state==="active"?"פעיל":e.state==="inactive"?"הסתיים":"—"}</dd>
                <dt>טיפול</dt><dd>${e.acked_at?`טופל בידי ${e.acked_by_username??""} · ${this.fmt(e.acked_at)}`:"ממתין"}</dd>
                ${typeof e.details.description=="string"&&e.details.description?r`<dt>תיאור</dt><dd class="ltr">${String(e.details.description)}</dd>`:p}
                ${typeof e.details.seconds=="number"?r`<dt>משך ההקלטה</dt><dd>${String(e.details.seconds)} שנ׳</dd>`:p}
              </dl>
              <div slot="footer">
                ${e.camera_id?r`<sw-button variant="primary" size="sm" icon="history" @click=${()=>g("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>להקלטה</sw-button>`:p}
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${!!e.acked_at||this.busy} @click=${()=>this.ack(e)}>סמן טופל</sw-button>
              </div>
            </sw-drawer>`:p}
      </div>
    `}renderDemo(){const e=he.filter(s=>this.filter==="all"||!s.acked),t=he.find(s=>s.id===this.selected);return r`
      <div class="filters">
        <sw-field><select aria-label="אתר"><option>כל האתרים</option><option>אתר הדגמה</option></select></sw-field>
        <sw-field><select aria-label="מצלמה"><option>כל המצלמות</option></select></sw-field>
        <sw-field><select aria-label="סוג"><option>כל סוגי האירועים</option><option>אדם</option><option>רכב</option><option>תנועה</option><option>ניתוק</option></select></sw-field>
        <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${he.length}>הכל</sw-chip>
        <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>this.filter="unacked"} count=${he.filter(s=>!s.acked).length}>ללא טיפול</sw-chip>
      </div>
      <div class="stage">
        <sw-table .columns=${this.columns} .rows=${e} .selected=${this.selected} @row-select=${s=>this.selected=s.detail.id}></sw-table>
        ${t?r`<sw-drawer open heading=${bs[t.type]} subheading=${`${t.camera} · ${t.time}`} @close=${()=>this.selected=null}>
              <div class="preview">${t.type==="offline"||t.type==="door"?"אין תמונה לאירוע זה":r`<sw-scene kind=${hi[t.camera]??"lobby"}></sw-scene><span class="demo">דמו · תמונת אירוע מה־NVR (T044)</span>`}</div>
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
    `}render(){const e=S();return r`
      <sw-page heading="מרכז אירועים" subheading=${e?`חיפוש, סינון וסקירה · מקור, ודאות וזמן קליטה נשמרים · אזור זמן ${this.tz}`:"חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה"}>
        ${e?p:r`<sw-button slot="actions" icon="download">ייצוא</sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};q.styles=v`
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
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;ee([h()],q.prototype,"cameraId",2);ee([h()],q.prototype,"date",2);ee([d()],q.prototype,"selected",2);ee([d()],q.prototype,"filter",2);ee([d()],q.prototype,"cams",2);ee([d()],q.prototype,"tz",2);ee([d()],q.prototype,"type",2);ee([d()],q.prototype,"events",2);ee([d()],q.prototype,"ingest",2);ee([d()],q.prototype,"live",2);ee([d()],q.prototype,"error",2);ee([d()],q.prototype,"busy",2);q=ee([m("investigate-events")],q);var bo=Object.getOwnPropertyDescriptor,go=(e,t,s,i)=>{for(var a=i>1?void 0:i?bo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const yo=[{id:"rv-1",title:"כניסה ראשית · 10:12–10:16",primary:"כניסה ראשית",scene:"entrance",related:["לובי"],events:3,severity:"alert",status:"חדש"},{id:"rv-2",title:"חצר אחורית · 09:40–09:44",primary:"חצר אחורית",scene:"backyard",related:[],events:2,severity:"info",status:"בבדיקה"},{id:"rv-3",title:"חניה מקורה · 06:41–06:45",primary:"חניה מקורה",scene:"parking",related:["כניסה ראשית"],events:1,severity:"alert",status:"טופל"},{id:"rv-4",title:"לובי · אתמול 23:08–23:12",primary:"לובי",scene:"lobby",related:[],events:4,severity:"info",status:"false positive"}];let Ms=class extends w{render(){return r`
      <sw-page heading="תור Review" subheading="אירועים סמוכים מקובצים לחלון אחד עם מצלמה ראשית · נתוני הדגמה">
        <div class="filters">
          <sw-chip selected count=${1}>חדש</sw-chip><sw-chip count=${1}>בבדיקה</sw-chip><sw-chip count=${1}>טופל</sw-chip><sw-chip count=${1}>false positive</sw-chip>
          <sw-chip icon="filter">חומרה</sw-chip><sw-chip icon="camera">מצלמה</sw-chip>
        </div>
        <div class="list">
          ${yo.map(e=>r`<sw-card>
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
    `}};Ms.styles=v`
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
  `;Ms=go([m("investigate-reviews")],Ms);var xo=Object.defineProperty,$o=Object.getOwnPropertyDescriptor,ns=(e,t,s,i)=>{for(var a=i>1?void 0:i?$o(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&xo(t,s,a),a};const ko=[{key:"title",label:"תיק",render:e=>r`<strong>${String(e.title)}</strong>`},{key:"status",label:"סטטוס",render:e=>r`<sw-badge kind=${e.status==="פתוח"?"stale":e.status==="סגור"?"neutral":"recorded"} label=${String(e.status)}></sw-badge>`},{key:"owner",label:"בעלים"},{key:"clips",label:"קטעים"},{key:"notes",label:"הערות"},{key:"preserved",label:"ראיות שמורות",render:e=>r`${e.preserved} שמורות${Number(e.missing)?r` · <span style="color:var(--sw-danger)">${e.missing} חסרות</span>`:""}`},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}];let ui=class extends w{render(){return r`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת ו־hash · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תיק חדש</sw-button>
        <sw-table .columns=${ko} .rows=${ys} @row-select=${e=>g(`/investigate/cases/${e.detail.id}`)}></sw-table>
      </sw-page>
    `}};ui=ns([m("investigate-cases")],ui);let mt=class extends w{constructor(){super(...arguments),this.caseId="case-1",this.tab="details"}render(){const e=ys.find(t=>t.id===this.caseId)??ys[0];return r`
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
    `}};mt.styles=v`
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
  `;ns([h()],mt.prototype,"caseId",2);ns([d()],mt.prototype,"tab",2);mt=ns([m("investigate-case-detail")],mt);var _o=Object.defineProperty,zo=Object.getOwnPropertyDescriptor,os=(e,t,s,i)=>{for(var a=i>1?void 0:i?zo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&_o(t,s,a),a};const fi={queued:"ממתין",running:"מוריד",done:"הושלם",partial:"חלקי",failed:"נכשל",cancelled:"בוטל",interrupted:"הופסק"},So={queued:"neutral",running:"live",done:"recorded",partial:"partial",failed:"error",cancelled:"unknown",interrupted:"stale"};let Je=class extends w{constructor(){super(...arguments),this.jobs=null,this.ffmpeg=!0,this.error=""}connectedCallback(){super.connectedCallback(),S()&&(this.load(),this.timer=window.setInterval(()=>this.poll(),3e3))}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async load(){try{const e=await Yn();this.jobs=e.jobs,this.ffmpeg=e.ffmpeg,this.error=""}catch(e){this.error=x(e)}}poll(){this.jobs?.some(e=>e.state==="queued"||e.state==="running")&&this.load()}fmt(e,t){return new Intl.DateTimeFormat("he-IL",{timeZone:t,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date(e))}async cancel(e){try{await Zn(e.id),await this.load()}catch(t){this.error=x(t)}}async removeJob(e){try{await Xn(e.id),await this.load()}catch(t){this.error=x(t)}}renderApi(){return this.error&&!this.jobs?r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`:this.jobs?this.jobs.length?r`
      ${this.ffmpeg?p:r`<div class="warn">ffmpeg לא זמין בשרת: קבצי הייצוא נמסרים במיכל המקורי של ה־NVR (Hikvision PS, ניתן לניגון ב־VLC) ולא נחתכים לטווח המדויק.</div>`}
      ${this.error?r`<div class="warn">${this.error}</div>`:p}
      <sw-card>
        ${this.jobs.map(e=>{const t=Math.round((e.progress??0)*100),s=e.files.filter(i=>i.state==="downloaded"||i.state==="remuxed").length;return r`<div class="job">
            <div>
              <div class="title"><strong>${e.camera_name}</strong><sw-badge kind=${So[e.state]} label=${fi[e.state]}></sw-badge></div>
              <div class="meta"><span class="ltr">${this.fmt(e.requested_from,e.timezone)} → ${this.fmt(e.requested_to,e.timezone)}</span> · ${e.files.length} קבצים (${s} ירדו) · משוער ${rt(e.estimate_bytes)}${e.actual_from?r` · בפועל <span class="ltr">${this.fmt(e.actual_from,e.timezone)} → ${this.fmt(e.actual_to??e.actual_from,e.timezone)}</span>`:p}</div>
              ${e.error?r`<div class="warn">${e.error}</div>`:p}
              ${e.note&&(e.state==="done"||e.state==="partial")?r`<div class="meta">${e.note}</div>`:p}
              ${e.sha256?r`<div class="meta ltr">sha256 ${e.sha256.slice(0,16)}… · ${e.container}</div>`:p}
            </div>
            <div><div class="bar ${e.state==="failed"?"fail":e.state==="partial"?"partial":""}"><i style="inline-size:${t}%"></i></div><div class="meta">${fi[e.state]} · ${t}%${e.state==="running"?` · ${rt(e.files.reduce((i,a)=>i+a.bytes,0))}`:""}</div></div>
            <div class="actions">
              ${e.download_ready?r`<a href=${Qn(e.id)} download=${e.output_name??""}><sw-button size="sm" icon="download">הורדה</sw-button></a><a href=${eo(e.id)} target="_blank" rel="noopener"><sw-button size="sm" variant="ghost" icon="list">מניפסט</sw-button></a>`:p}
              ${e.state==="queued"||e.state==="running"?r`<sw-button size="sm" variant="ghost" icon="close" @click=${()=>this.cancel(e)}>בטל</sw-button>`:r`<sw-button size="sm" variant="ghost" icon="trash" @click=${()=>this.removeJob(e)}>מחק</sw-button>`}
            </div>
          </div>`})}
      </sw-card>
      <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר בייצוא, לא שהצילום אותנטי מאז המצלמה. הקבצים נמחקים אוטומטית אחרי תקופת השמירה שבהגדרות.</div>
    `:r`<sw-state-panel state="empty" heading="אין עבודות ייצוא" hint="פתח הקלטה, בחר טווח ולחץ ייצוא."><div style="margin-block-start:10px"><sw-button variant="primary" icon="history" @click=${()=>g("/investigate/playback")}>להקלטות</sw-button></div></sw-state-panel>`:r`<sw-state-panel state="loading"></sw-state-panel>`}renderDemo(){return r`
      <sw-card>
        ${Ei.map(e=>r`<div class="job">
            <div><strong>${e.title}</strong><div class="meta">${e.size} · ${e.hash}</div></div>
            <div><div class="bar ${e.status.startsWith("נכשל")?"fail":""}"><i style="inline-size:${e.progress}%"></i></div><div class="meta">${e.status} · ${e.progress}%</div></div>
            <div class="actions">
              ${e.progress===100?r`<sw-button size="sm" icon="download">הורדה</sw-button>`:e.status.startsWith("נכשל")?r`<sw-button size="sm" icon="refresh">נסה שוב</sw-button>`:r`<sw-button size="sm" variant="ghost" icon="close">בטל</sw-button>`}
            </div>
          </div>`)}
      </sw-card>
      <div class="meta">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.</div>
    `}render(){const e=S();return r`
      <sw-page heading="ייצוא והורדות" subheading=${e?"עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה":"עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה · נתוני הדגמה"}>
        <sw-button slot="actions" variant="primary" icon="download" @click=${()=>g("/investigate/playback")}>ייצוא חדש</sw-button>
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};Je.styles=v`
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
  `;os([d()],Je.prototype,"jobs",2);os([d()],Je.prototype,"ffmpeg",2);os([d()],Je.prototype,"error",2);Je=os([m("investigate-exports")],Je);var Mo=Object.defineProperty,Po=Object.getOwnPropertyDescriptor,qi=(e,t,s,i)=>{for(var a=i>1?void 0:i?Po(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Mo(t,s,a),a};const Ao=[{scene:"entrance",when:"14.09.2026 10:14",cam:"כניסה ראשית",why:"NVR: זיהוי אדם (Smart)"},{scene:"lobby",when:"14.09.2026 10:13",cam:"לובי",why:"NVR: תנועה + סמיכות במפה לכניסה"},{scene:"parking",when:"14.09.2026 06:43",cam:"חניה מקורה",why:"NVR: חציית קו"},{scene:"entrance",when:"14.09.2026 08:12",cam:"כניסה ראשית",why:"HA: דלת נפתחה + תנועה"},{scene:"corridor",when:"13.09.2026 23:10",cam:"מסדרון מזרחי",why:"NVR: זיהוי אדם"},{scene:"backyard",when:"13.09.2026 18:03",cam:"חצר אחורית",why:"NVR: תנועה"}];let Ft=class extends w{constructor(){super(...arguments),this.by="person"}render(){return r`
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
            ${Ao.map(e=>r`<div class="res" @click=${()=>window.location.hash="#/investigate/playback"}><div class="pic"><sw-scene kind=${e.scene}></sw-scene><span class="demo">דמו</span></div><div class="cap">${e.when}<small>${e.cam} · ${e.why}</small></div></div>`)}
          </div>
        </div>
      </sw-page>
    `}};Ft.styles=v`
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
  `;qi([d()],Ft.prototype,"by",2);Ft=qi([m("investigate-search")],Ft);var Oo=Object.defineProperty,Co=Object.getOwnPropertyDescriptor,ls=(e,t,s,i)=>{for(var a=i>1?void 0:i?Co(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Oo(t,s,a),a};const wi={"r-1":{icon:"user",bg:"#eaf0ff",fg:"#2f6bff"},"r-2":{icon:"move",bg:"#e8f8ee",fg:"#16a34a"},"r-3":{icon:"door",bg:"#fff4e0",fg:"#d97706"},"r-4":{icon:"offline",bg:"#fdecec",fg:"#ef4444"}};let qt=class extends w{constructor(){super(...arguments),this.tab="rules"}render(){return r`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus" @click=${()=>g("/investigate/rules/new")}>חוק חדש</sw-button>
        <sw-tabs .items=${[{id:"rules",label:"חוקים",count:xs.length},{id:"notif",label:"התראות"},{id:"sched",label:"לוחות זמנים"},{id:"trig",label:"Triggers"}]} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        ${this.tab==="rules"?r`<div class="list">
              ${xs.map(e=>{const t=wi[e.id]??wi["r-1"];return r`<sw-card flush class="rule" style="--bg:${t.bg};--fg:${t.fg}">
                  <div class="ic"><sw-icon .name=${t.icon} size=${16}></sw-icon></div>
                  <div class="txt"><b>${e.name}</b><small>${e.trigger} · ${e.scope} · ${e.action}</small></div>
                  <span class="last">הופעל: ${e.last}</span>
                  <sw-toggle ?checked=${e.enabled} label=""></sw-toggle>
                  <sw-button size="sm" @click=${()=>g(`/investigate/rules/${e.id}`)}>עריכה</sw-button>
                  <sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>
                </sw-card>`})}
            </div>`:r`<sw-card><div class="empty">${this.tab==="notif"?"ערוצי התראה: Push דרך HA, מייל (Beta). ההגדרה מגיעה עם T063.":this.tab==="sched"?"לוחות זמנים בזמן האתר (Asia/Jerusalem), שעון קיץ לפי התאריך.":"Triggers זמינים: אירועי NVR (אדם, רכב, תנועה, חציית קו, ניתוק) ושינויי מצב HA (allowlist)."}</div></sw-card>`}
      </sw-page>
    `}};qt.styles=v`
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
  `;ls([d()],qt.prototype,"tab",2);qt=ls([m("investigate-rules")],qt);let Kt=class extends w{constructor(){super(...arguments),this.ruleId="r-1"}render(){const e=xs.find(t=>t.id===this.ruleId)??{name:"חוק חדש",trigger:"זיהוי אדם",scope:"חוץ",action:"התראה"};return r`
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
    `}};Kt.styles=v`
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
  `;ls([h()],Kt.prototype,"ruleId",2);Kt=ls([m("investigate-rule-editor")],Kt);var Eo=Object.defineProperty,Io=Object.getOwnPropertyDescriptor,Pt=(e,t,s,i)=>{for(var a=i>1?void 0:i?Io(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Eo(t,s,a),a};const To=[{id:"users",label:"משתמשים",count:gs.length},{id:"groups",label:"קבוצות",count:Ai.length},{id:"roles",label:"תפקידים",count:Oi.length},{id:"effective",label:"הרשאות אפקטיביות"},{id:"audit",label:"אודיט הרשאות"}];let Te=class extends w{constructor(){super(...arguments),this.tab="users",this.selected=null,this.assigning=!1,this.step=0,this.userColumns=[{key:"name",label:"שם",render:e=>r`<div class="who"><sw-avatar name=${String(e.name)} size=${30}></sw-avatar><div><strong>${String(e.name)}</strong>${e.haAdmin?r` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:""}<div class="ltr sub">${String(e.haUser)}@ha.local</div></div></div>`},{key:"role",label:"תפקיד",render:e=>{const t=e.bindings[0];return t?r`<span class="pillsel">${t.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:r`<span class="pillsel" style="color:var(--sw-text-3)">ללא שיוך<sw-icon name="chevronDown" size=${11}></sw-icon></span>`}},{key:"scope",label:"היקף גישה",render:e=>{const t=e.bindings[0];return t?r`<span class="pillsel">${t.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:r`<span class="sub">—</span>`}},{key:"active",label:"מצב",render:e=>r`<span class="status ${e.active?"":"off"}"><i></i>${e.active?"פעיל":"מושבת ב־HA"}</span>`},{key:"lastSync",label:"סנכרון"},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}renderUsers(){const e=gs.find(t=>t.id===this.selected);return r`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${gs} .selected=${this.selected} @row-select=${t=>{this.selected=t.detail.id,this.assigning=!1}}></sw-table>
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
    `}renderGroups(){return r`<sw-table .columns=${[{key:"name",label:"קבוצה",render:t=>r`<strong>${String(t.name)}</strong>`},{key:"members",label:"חברים"},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:t=>r`${t.bindings.map(s=>r`<div>${s}</div>`)}`},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]} .rows=${Ai}></sw-table><div class="hint">שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.</div>`}renderRoles(){return r`<div class="roles">${Oi.map(e=>r`<sw-card class="role"><h4><span class="ic"><sw-icon name=${e.id==="viewer"?"eye":e.id==="operator"?"play":e.id==="editor"?"edit":e.id==="site_admin"?"building":"shield"} size=${14}></sw-icon></span>${e.name}</h4><div class="a">מותר: ${e.allowed}</div><div class="d">לא ניתן אוטומטית: ${e.denied}</div></sw-card>`)}</div><div class="hint">תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>`}renderEffective(){return r`
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
    `}renderAudit(){return r`<sw-table dense .columns=${[{key:"time",label:"זמן"},{key:"user",label:"משתמש",render:t=>r`<div class="who"><sw-avatar name=${String(t.user)} size=${24}></sw-avatar>${String(t.user)}</div>`},{key:"action",label:"פעולה"},{key:"resource",label:"משאב"},{key:"decision",label:"החלטה",render:t=>r`<sw-badge kind=${String(t.decision).startsWith("נחסם")?"forbidden":"live"} label=${String(t.decision)}></sw-badge>`},{key:"role",label:"תפקיד/היקף ששימשו"}]} .rows=${Ci.filter(t=>t.action.includes("תוכנית")||t.action.includes("סנכרון")||t.action.includes("Ingress"))}></sw-table>`}render(){return r`
      <sw-page heading="משתמשים והרשאות" subheading="זהות מ־Home Assistant · הרשאות בתוך SMPLWISE בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs .items=${To} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.</div>
        ${this.tab==="users"?this.renderUsers():this.tab==="groups"?this.renderGroups():this.tab==="roles"?this.renderRoles():this.tab==="effective"?this.renderEffective():this.renderAudit()}
      </sw-page>
    `}};Te.styles=v`
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
  `;Pt([d()],Te.prototype,"tab",2);Pt([d()],Te.prototype,"selected",2);Pt([d()],Te.prototype,"assigning",2);Pt([d()],Te.prototype,"step",2);Te=Pt([m("system-access")],Te);var Do=Object.getOwnPropertyDescriptor,No=(e,t,s,i)=>{for(var a=i>1?void 0:i?Do(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const Ro=[{key:"time",label:"זמן",render:e=>r`14.09.2026 ${String(e.time)}`},{key:"user",label:"משתמש",render:e=>r`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(e.user)} size=${24}></sw-avatar>${String(e.user)}</span>`},{key:"action",label:"פעולה",render:e=>r`<span style=${String(e.decision).startsWith("נחסם")?"color:var(--sw-danger);font-weight:600":""}>${String(e.action)}</span>`},{key:"resource",label:"פרטים",render:e=>r`${String(e.resource)} <span style="color:var(--sw-text-3)">· ${String(e.decision)}</span>`},{key:"role",label:"תפקיד / היקף"},{key:"rev",label:"rev",ltr:!0,render:()=>r`7`}];let Ps=class extends w{render(){return r`
      <sw-page heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, מקור זהות, תפקיד והיקף, החלטה, request_id, permission_revision · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
        <div class="filters">
          <sw-field><select aria-label="פעולה"><option>כל הפעולות</option><option>צפייה</option><option>שינוי</option><option>ייצוא</option><option>פעולת HA</option></select></sw-field>
          <sw-field><select aria-label="משתמש"><option>כל המשתמשים</option></select></sw-field>
          <sw-field><select aria-label="אתר"><option>כל האתרים</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <sw-chip icon="clock">שמירה: 180 יום</sw-chip>
        </div>
        <sw-table .columns=${Ro} .rows=${Ci}></sw-table>
        <div class="pager">
          <span>מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop</span>
          <span class="pages"><button aria-label="קודם"><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label="הבא"><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `}};Ps.styles=v`
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
  `;Ps=No([m("system-audit")],Ps);var Ho=Object.defineProperty,Lo=Object.getOwnPropertyDescriptor,Ki=(e,t,s,i)=>{for(var a=i>1?void 0:i?Lo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ho(t,s,a),a};const us=["גילוי","NVR","go2rtc","גשר HA","מנהל ראשון","שעון","סיום"];let Jt=class extends w{constructor(){super(...arguments),this.step=0}renderStep(){switch(this.step){case 0:return r`<sw-card heading="גילוי מכשירים" subheading="חיפוש NVR ומצלמות ברשת המקומית · קריאה בלבד, ללא שינוי תצורה במכשיר">
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
        </sw-card>`}}render(){return r`
      <sw-page heading="אשף התקנה" subheading="גילוי NVR ומצלמות, בדיקת זרמים, שמות וקומות · בדיקות קריאה בלבד · נתוני הדגמה">
        <div class="wrap">
          <sw-card><sw-steps .steps=${us} .current=${this.step}></sw-steps></sw-card>
          ${this.renderStep()}
          <div class="foot">
            <sw-button variant="ghost" ?disabled=${this.step===0} @click=${()=>this.step=Math.max(0,this.step-1)}>הקודם</sw-button>
            <div style="display:flex;gap:8px">
              <sw-button>ביטול</sw-button>
              <sw-button variant="primary" @click=${()=>this.step=Math.min(us.length-1,this.step+1)}>${this.step===us.length-1?"סיום":"הבא"}</sw-button>
            </div>
          </div>
        </div>
      </sw-page>
    `}};Jt.styles=v`
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
  `;Ki([d()],Jt.prototype,"step",2);Jt=Ki([m("system-setup")],Jt);var jo=Object.defineProperty,Bo=Object.getOwnPropertyDescriptor,Z=(e,t,s,i)=>{for(var a=i>1?void 0:i?Bo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&jo(t,s,a),a};const mi=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"];let U=class extends w{constructor(){super(...arguments),this.selected=null,this.filter="all",this.cameras=null,this.recorder=null,this.canSync=!1,this.discovery=null,this.busy=!1,this.message="",this.error="",this.dialog=!1,this.formChannel=1,this.formAlias="",this.alias="",this.columns=[{key:"name",label:"מצלמה",render:e=>r`<div class="cam">${e.scene?r`<sw-scene kind=${e.scene}></sw-scene>`:r`<div class="none"></div>`}<div><b>${String(e.name)}</b><small>${String(e.sub)}</small></div></div>`},{key:"state",label:"מצב",render:e=>r`<span class="status"><i style="--c:${e.state==="live"?"var(--sw-live)":e.state==="offline"?"var(--sw-danger)":e.state==="unknown"?"var(--sw-unknown)":"var(--sw-stale)"}"></i>${e.state==="live"?"מחוברת":e.state==="offline"?"מנותקת":e.state==="stale"?"לא מעודכן":e.state==="forbidden"?"ללא הרשאה":"לא נבדק"}</span>`},{key:"fps",label:"FPS",ltr:!0},{key:"bitrate",label:"קצב",ltr:!0},{key:"firmware",label:"זרם ראשי",ltr:!0},{key:"lastEvent",label:"נראתה לאחרונה"},{key:"net",label:"רשת",render:e=>this.net(e.state==="live"?4:e.state==="stale"?2:0)},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.reload()}async reload(){if(!S()){this.cameras=null;return}try{const e=await Ze();this.cameras=e.cameras,this.recorder=e.recorder,this.canSync=e.can_sync,D("health").then(t=>this.discovery=t.discovery).catch(()=>{})}catch(e){this.error=x(e)}}async sync(){this.busy=!0,this.error="",this.message="";try{const e=await Pr();this.message=`סנכרון הושלם: ${e.channels} ערוצים (${e.created} חדשים, ${e.updated} עודכנו)${e.recorder.model?` · ${e.recorder.model}`:""}`,await this.reload()}catch(e){this.error=x(e)}finally{this.busy=!1}}async register(){this.busy=!0,this.error="";try{await Ar({channel:this.formChannel,alias:this.formAlias.trim()}),this.dialog=!1,await this.reload()}catch(e){this.error=x(e)}finally{this.busy=!1}}async saveAlias(e){this.busy=!0,this.error="";try{await Or(e,{alias:this.alias.trim()||void 0}),await this.reload(),this.message="הכינוי נשמר (שם ה־NVR לא השתנה)"}catch(t){this.error=x(t)}finally{this.busy=!1}}get rows(){return this.cameras?this.cameras.map(e=>({id:e.id,name:e.name,sub:`ערוץ ${e.channel}${e.name_source&&e.alias?` · NVR: ${e.name_source}`:""}`,state:e.status==="online"?"live":e.status==="offline"?"offline":"unknown",fps:e.stream?.fps?String(e.stream.fps):"—",bitrate:e.stream?.bitrate_kbps?`${(e.stream.bitrate_kbps/1024).toFixed(1)} Mbps`:"—",firmware:e.stream?.resolution?`${e.stream.resolution} ${e.stream.codec??""}`.trim():"—",lastEvent:e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z",""):"לא נבדק",scene:e.status==="online"?mi[(e.channel-1)%mi.length]:null,channel:e.channel,api:e})):P.map(e=>({id:e.id,name:e.name,sub:`${e.floor} · ערוץ ${e.id.replace("cam-","")}`,state:e.state,fps:e.fps?String(e.fps):"—",bitrate:e.bitrateKbps?`${(e.bitrateKbps/1024).toFixed(1)} Mbps`:"—",firmware:e.firmware,lastEvent:e.lastEvent,scene:e.state==="offline"||e.state==="forbidden"?null:oe[e.id]??"lobby",channel:Number(e.id.replace("cam-",""))}))}net(e){return c`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0,1,2,3].map(t=>c`<rect x=${t*5.5} y=${11-t*3} width="4" height=${3+t*3} rx="1" fill=${t<e?e>=3?"#22c55e":"#f59e0b":"var(--sw-border-strong)"} />`)}</svg>`}render(){const e=this.rows,t=e.filter(a=>this.filter==="all"?!0:this.filter==="online"?a.state==="live":this.filter==="offline"?a.state==="offline":a.state==="stale"||a.state==="forbidden"||a.state==="unknown"),s=e.find(a=>a.id===this.selected),i=!!this.cameras;return r`
      <sw-page heading="בריאות מצלמות" subheading=${i?`${this.recorder?.name??"NVR"}${this.recorder?.model?` · ${this.recorder.model}`:""} · ${e.length} מצלמות רשומות · גילוי לקריאה בלבד`:"NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה"}>
        ${i&&this.canSync?r`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${this.busy?"מסנכרן…":"סנכרון מה־NVR (קריאה)"}</sw-button>`:r`<sw-button slot="actions" icon="refresh" ?disabled=${i}>בדיקת יכולות (קריאה)</sw-button>`}
        ${i&&this.discovery?r`<div style="font-size:var(--sw-fs-xs);color:${this.discovery.cameras_last_error?"var(--sw-danger)":"var(--sw-text-3)"};margin-block-end:8px">גילוי אוטומטי מה־NVR כל ${Math.round(this.discovery.interval_s/60)} דק׳ · ${this.discovery.cameras_last_error?`נכשל: ${this.discovery.cameras_last_error}`:this.discovery.cameras_last_ok?`הצליח ${this.discovery.cameras_last_ok.replace("T"," ").replace("Z"," UTC")}`:"טרם רץ"}${this.discovery.streams_last_error?` · זרמי go2rtc: ${this.discovery.streams_last_error}`:""}</div>`:p}
        ${i&&this.canSync?r`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>{this.dialog=!0,this.formAlias="",this.formChannel=(e.length?Math.max(...e.map(a=>a.channel)):0)+1}}>רישום ידני</sw-button>`:p}
        ${this.message?r`<div class="ok">${this.message}</div>`:p}
        ${this.error?r`<div class="err">${this.error}</div>`:p}
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
                  ${i&&this.canSync?r`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveAlias(s.id)}>שמור כינוי</sw-button>`:p}
                  <sw-button variant="danger" size="sm" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`:p}
        </div>
        ${i?this.recorder?r`<sw-card heading=${this.recorder.name}>
                <div class="nvr">
                  <div><span>דגם</span>${this.recorder.model??"לא נבדק"}</div>
                  <div><span>קושחה</span><span class="ltr">${this.recorder.firmware??"—"}</span></div>
                  <div><span>סנכרון אחרון</span>${this.recorder.last_seen_at?this.recorder.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</div>
                  <div><span>גישה</span>קריאה בלבד (ISAPI)</div>
                </div>
              </sw-card>`:p:r`<sw-card heading="NVR ראשי">
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
              ${this.error?r`<div class="err">${this.error}</div>`:p}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formAlias.trim()||this.busy} @click=${()=>this.register()}>רישום</sw-button>
            </sw-dialog>`:p}
      </sw-page>
    `}};U.styles=v`
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
  `;Z([d()],U.prototype,"selected",2);Z([d()],U.prototype,"filter",2);Z([d()],U.prototype,"cameras",2);Z([d()],U.prototype,"recorder",2);Z([d()],U.prototype,"canSync",2);Z([d()],U.prototype,"discovery",2);Z([d()],U.prototype,"busy",2);Z([d()],U.prototype,"message",2);Z([d()],U.prototype,"error",2);Z([d()],U.prototype,"dialog",2);Z([d()],U.prototype,"formChannel",2);Z([d()],U.prototype,"formAlias",2);Z([d()],U.prototype,"alias",2);U=Z([m("system-devices")],U);var Vo=Object.defineProperty,Uo=Object.getOwnPropertyDescriptor,E=(e,t,s,i)=>{for(var a=i>1?void 0:i?Uo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Vo(t,s,a),a};const Wo=[{id:"general",label:"כללי"},{id:"media",label:"וידאו ומדיה"},{id:"ha",label:"גשר Home Assistant"},{id:"health",label:"בריאות ועבודות"},{id:"backup",label:"גיבוי ושחזור"},{id:"support",label:"תמיכה"}];let A=class extends w{constructor(){super(...arguments),this.tab="general",this.settings=null,this.canEdit=!1,this.draft={},this.streams=null,this.go2rtc=null,this.foreign=0,this.sessions=[],this.busy=!1,this.message="",this.error="",this.version="",this.ha=null,this.pairing=null,this.showCode=!1,this.regenArmed=!1,this.copied=!1,this.health=null}connectedCallback(){super.connectedCallback(),this.loadSettings()}async loadSettings(){if(S())try{const[e,t]=await Promise.all([zi(),D("health").catch(()=>null)]);this.settings=e.settings,this.canEdit=e.can_edit,this.draft={},this.version=t?.version??"",this.health=t??null}catch(e){this.error=x(e)}}async loadMedia(){if(!(!S()||!this.canEdit))try{const[e,t]=await Promise.all([Ya(),Za()]);this.streams=e.streams,this.go2rtc=e.go2rtc,this.foreign=e.foreign_streams,this.sessions=t.sessions,this.error=""}catch(e){this.streams=[],this.error=x(e)}}async loadHa(e=!1){if(S()){this.error="";try{this.ha=await Nr(),this.canEdit&&(this.pairing=await Rr(e)),e&&(this.regenArmed=!1,this.showCode=!0,this.message="נוצר קוד צימוד חדש; יש להגדיר מחדש את האינטגרציה ב־Home Assistant.",setTimeout(()=>this.message="",4e3))}catch(t){this.error=x(t)}}}async copyCode(){if(this.pairing)try{await navigator.clipboard.writeText(this.pairing.pairing_code),this.copied=!0,setTimeout(()=>this.copied=!1,2e3)}catch{this.showCode=!0}}renderHa(){if(!S())return r`<div class="sections"><sw-card heading="גשר Home Assistant"><div class="muted">נתוני הדגמה — הסטטוס והצימוד זמינים מול השרת.</div></sw-card></div>`;const e=this.ha,t=e?.sync,s=this.pairing;return r`<div class="sections">
      <sw-card heading="חיבור ל־Home Assistant" subheading="קריאה בלבד: מצבים, רישום ישויות, אזורים וקומות">
        ${e?r`
            <div class="row"><span class="lbl">גישה ל־API של Home Assistant<span class="muted">${e.configured?"דרך ה־Supervisor (homeassistant_api) או HA_URL בפיתוח":"לא מוגדר — ה־Add-on לא קיבל SUPERVISOR_TOKEN"}</span></span><sw-badge kind=${e.configured?"live":"offline"}></sw-badge></div>
            <div class="row"><span class="lbl">סנכרון מצבים (WebSocket)<span class="muted">${t?.connected?`מחובר · HA ${t.ha_version??"?"} · ${t.entities} ישויות · אירוע אחרון ${pe(t.last_event_at)}`:`מנותק${t?.last_error?` · ${t.last_error}`:""} · ${t?.reconnects??0} חיבורים מחדש`}</span></span><sw-badge kind=${t?.connected?"live":"offline"}></sw-badge></div>
            <div class="row"><span class="lbl">רישום ישויות (registry)<span class="muted">עודכן ${pe(t?.last_registry_at)} · תמונת מצב ${pe(t?.last_snapshot_at)}</span></span><sw-button size="sm" @click=${()=>g("/explore/entities")}>לקטלוג</sw-button></div>`:r`<div class="muted">טוען…</div>`}
      </sw-card>
      <sw-card heading="גשר SMPLWISE (אינטגרציה ב־Home Assistant)" subheading="פעולות על ישויות רצות רק דרך הגשר, בזהות המשתמש, לפי ההרשאות של Home Assistant">
        ${e?r`<div class="row"><span class="lbl">צימוד<span class="muted">${e.bridge.paired?`מצומד מאז ${pe(e.bridge.paired_at)}`:"לא מצומד — פעולות HA ייחסמו עד להתקנת הגשר"}</span></span><sw-badge kind=${e.bridge.paired?"live":"stale"} label=${e.bridge.paired?"מצומד":"לא מצומד"}></sw-badge></div>
            <div class="row"><span class="lbl">ספריית משתמשי HA<span class="muted">${e.bridge.directory_users} משתמשים · עודכן ${pe(e.bridge.last_directory_at)}</span></span><sw-badge kind=${e.bridge.directory_users?"recorded":"unknown"}></sw-badge></div>`:p}
        ${s?r`<div class="row"><span class="lbl">כתובת ה־Add-on ברשת של HA<span class="muted">להדביק בשדה "כתובת" של האינטגרציה</span></span><code class="ltr">${s.addon_url}</code></div>
            <div class="row"><span class="lbl">קוד צימוד<span class="muted">סוד משותף; מוצג רק למנהלי מערכת ונרשם באודיט</span></span><span style="display:flex;gap:8px;align-items:center"><code class="ltr">${this.showCode?s.pairing_code:"••••••••••••"}</code><sw-button size="sm" @click=${()=>this.showCode=!this.showCode}>${this.showCode?"הסתר":"הצג"}</sw-button><sw-button size="sm" @click=${()=>this.copyCode()}>${this.copied?"הועתק":"העתק"}</sw-button></span></div>
            <div class="row"><span class="lbl">יצירת קוד חדש<span class="muted">מבטל את הצימוד הקיים; יש להגדיר מחדש את האינטגרציה</span></span>${this.regenArmed?r`<span style="display:flex;gap:8px"><sw-button size="sm" variant="danger" @click=${()=>this.loadHa(!0)}>אשר יצירה</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.regenArmed=!1}>ביטול</sw-button></span>`:r`<sw-button size="sm" @click=${()=>this.regenArmed=!0}>צור קוד חדש</sw-button>`}</div>`:this.canEdit?p:r`<div class="muted">קוד הצימוד מוצג למנהלי מערכת בלבד.</div>`}
      </sw-card>
      <sw-card heading="התקנת הגשר (פעם אחת)">
        <ol class="steps">
          <li>העתק את התיקייה <code class="ltr">custom_components/smplwise_bridge</code> מהמאגר אל <code class="ltr">/config/custom_components/</code> ב־Home Assistant (או הוסף את המאגר ב־HACS כ־Custom repository מסוג Integration), והפעל מחדש את Home Assistant.</li>
          <li>הגדרות → מכשירים ושירותים → הוספת אינטגרציה → <strong>SMPLWISE Bridge</strong>.</li>
          <li>הדבק את כתובת ה־Add-on ואת קוד הצימוד מהמסך הזה. הצימוד מאומת מיד (HMAC, חלון של 60 שניות).</li>
          <li>הסטטוס למעלה יתעדכן ל"מצומד"; ספריית המשתמשים נשלחת כל דקה ומאפשרת להקצות תפקידים למשתמשי HA.</li>
        </ol>
        <div class="muted">הגשר מריץ רק פעולות מרשימת ההיתר (תאורה, מתגים, מאווררים, תריסים, מנעולים, כפתורים, סקריפטים, סצנות) ורק עבור משתמש HA קיים ופעיל. ה־Supervisor token של ה־Add-on אינו משמש לפעולות.</div>
      </sw-card>
    </div>`}set(e,t){this.draft={...this.draft,[e]:t}}value(e){return this.draft[e]??this.settings?.[e]}async save(){if(Object.keys(this.draft).length){this.busy=!0,this.error="";try{const e=await Ja(this.draft);this.settings=e.settings,this.draft={},zn(),this.message="ההגדרות נשמרו",setTimeout(()=>this.message="",2500)}catch(e){this.error=x(e)}finally{this.busy=!1}}}async sync(){this.busy=!0,this.error="";try{const e=await Ga();this.message=`זרמים: ${e.created} נוצרו, ${e.updated} עודכנו, ${e.unchanged} ללא שינוי · ${e.foreign_streams_untouched} זרמים זרים לא נגעו`,await this.loadMedia()}catch(e){this.error=x(e)}finally{this.busy=!1}}renderGeneral(){return r`<div class="sections">
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
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">זרמים בשם smplwise_* בלבד · זרמים זרים לא ייגעו</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm" @click=${()=>{this.tab="media",this.loadMedia()}}>הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Home Assistant<span class="muted">קטלוג ישויות ופעולות בשם המשתמש (T025)</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle label="טרם"></sw-toggle><sw-button size="sm" disabled>הגדרה</sw-button></span></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">
        <div class="row"><span class="health"><i class="dot"></i><span class="lbl">מצב חלקי<span class="muted">גשר HA טרם חובר · שאר הרכיבים תקינים</span></span></span><sw-button size="sm" icon="activity">הרצת דיאגנוסטיקה</sw-button></div>
      </sw-card>
    </div>`}renderMedia(){const e=S(),t=Object.keys(this.draft).length>0;return r`<div class="sections">
      <sw-card heading="תעבורת וידאו" subheading="ברירת המחדל לכל הנגנים; כל נגן יכול לעקוף אותה לדפדפן הנוכחי">
        <div class="row"><span class="lbl">תעבורה ברירת מחדל<span class="muted">MSE (ברירת המחדל) עובד דרך Ingress, Cloudflare ומאחורי CGNAT · WebRTC נותן השהיה נמוכה אך דורש UDP ישיר ל־go2rtc (רשת מקומית או ללא CGNAT) · אוטומטי מנסה WebRTC ונופל ל־MSE</span></span>
          <sw-field class="ctl"><select ?disabled=${!e||!this.canEdit} @change=${s=>this.set("media.transport_default",s.target.value)}>
            ${["mse","auto","webrtc"].map(s=>r`<option value=${s} ?selected=${(this.value("media.transport_default")??"mse")===s}>${s==="auto"?"אוטומטי (WebRTC → MSE)":s==="webrtc"?"WebRTC בלבד":"MSE (ברירת מחדל)"}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל לקיר המצלמות<span class="muted">משני חוסך CPU ורוחב פס; ראשי לתצוגה בודדת</span></span>
          <sw-field class="ctl"><select ?disabled=${!e||!this.canEdit} @change=${s=>this.set("media.wall_profile",s.target.value)}>
            <option value="sub" ?selected=${(this.value("media.wall_profile")??"sub")==="sub"}>משני</option><option value="main" ?selected=${this.value("media.wall_profile")==="main"}>ראשי</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל<span class="muted">מגן על ה־NVR; מעבר למכסה מוצג צילום בלבד</span></span><sw-field class="ctl"><input type="number" min="1" max="32" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("media.max_live_sessions")??8)} @change=${s=>this.set("media.max_live_sessions",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">רעננות צילום (שניות)<span class="muted">snapshot מה־NVR לאריחים; cache בשרת</span></span><sw-field class="ctl"><input type="number" min="5" max="3600" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("snapshots.max_age_s")??60)} @change=${s=>this.set("snapshots.max_age_s",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">סשני ניגון במקביל<span class="muted">כל ניגון = זרם playback אחד מה־NVR דרך go2rtc</span></span><sw-field class="ctl"><input type="number" min="1" max="16" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("playback.max_sessions")??4)} @change=${s=>this.set("playback.max_sessions",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">פקיעת סשן ניגון ללא פעילות (שניות)<span class="muted">אחרי הזמן הזה הזרם נמחק מ־go2rtc אוטומטית</span></span><sw-field class="ctl"><input type="number" min="60" max="3600" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("playback.lease_s")??600)} @change=${s=>this.set("playback.lease_s",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">גודל ייצוא מקסימלי (MB)<span class="muted">לפי הנפח המשוער של קבצי ה־NVR בטווח</span></span><sw-field class="ctl"><input type="number" min="50" max="20480" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("exports.max_mb")??2048)} @change=${s=>this.set("exports.max_mb",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת קבצי ייצוא (ימים)<span class="muted">אחרי התקופה הקבצים נמחקים מ־/data/exports</span></span><sw-field class="ctl"><input type="number" min="1" max="365" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("exports.retention_days")??7)} @change=${s=>this.set("exports.retention_days",Number(s.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">אזור זמן של האתר וה־NVR<span class="muted">IANA · חיפוש והקלטות מתורגמים לשעון הקיר של ה־NVR לפי הכלל הזה (כולל שעון קיץ)</span></span><sw-field class="ctl"><input type="text" data-ltr ?disabled=${!e||!this.canEdit} .value=${String(this.value("time.zone")??"Asia/Jerusalem")} @change=${s=>this.set("time.zone",s.target.value.trim())} /></sw-field></div>
        <div class="foot"><sw-button variant="primary" icon="check" ?disabled=${!t||this.busy||!e} @click=${()=>this.save()}>שמור</sw-button>${this.message?r`<span class="ok" style="align-self:center">${this.message}</span>`:p}${this.error?r`<span class="err" style="align-self:center">${this.error}</span>`:p}</div>
        ${e?p:r`<div class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</div>`}
      </sw-card>
      <sw-card heading="go2rtc" subheading="זרמים של המוצר בשרת החיצוני (קריאה); זרמים זרים אינם מוצגים ואינם משתנים">
        ${!e||!this.canEdit?r`<div class="muted">${e?"נדרשת הרשאת מנהל מערכת.":"נתוני הדגמה."}</div>`:r`<div class="row"><span class="lbl">שרת<span class="muted">${this.go2rtc?`גרסה ${String(this.go2rtc.version??"?")}`:"לא נבדק"}</span></span><span style="display:flex;gap:8px"><sw-button size="sm" icon="refresh" ?disabled=${this.busy} @click=${()=>this.loadMedia()}>בדיקה</sw-button><sw-button size="sm" variant="primary" icon="link" ?disabled=${this.busy} @click=${()=>this.sync()}>סנכרון זרמים</sw-button></span></div>
              ${this.streams===null?p:this.streams.length?this.streams.map(s=>r`<div class="stream"><span>${s.name}</span><span>${s.online?"online":"idle"}</span></div>`):r`<div class="muted">אין עדיין זרמים של המוצר — לחץ "סנכרון זרמים".</div>`}
              ${this.streams!==null?r`<div class="muted" style="margin-block-start:6px">${this.foreign} זרמים זרים (אינטרקום, מצלמות אחרות) קיימים בשרת ולא נגענו בהם.</div>`:p}`}
      </sw-card>
      ${e&&this.canEdit?r`<sw-card heading="זרמים חיים כרגע" subheading="sessions דרך ה־relay של ה־Add-on">
            ${this.sessions.length?this.sessions.map(s=>r`<div class="row"><span class="lbl">${s.stream}<span class="muted">${s.username} · ${s.seconds} שנ׳ · ${(s.bytes_down/1024/1024).toFixed(1)} MB</span></span></div>`):r`<div class="muted">אין זרמים פתוחים.</div>`}
          </sw-card>`:p}
    </div>`}renderHealth(){return r`<div class="sections">
      <sw-card heading="מצבים נפרדים, לא נורה אחת">${Ii.map(e=>r`<div class="row"><span class="lbl">${e.name}<span class="muted">${e.detail}</span></span><sw-badge kind=${e.state}></sw-badge></div>`)}
        <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
        <div class="row"><span class="lbl">זרמים פעילים<span class="muted">${S()?`${this.sessions.length} דרך ה־relay`:"4 חיים · 1 ניגון · 0 יתומים"}</span></span><sw-badge kind="live"></sw-badge></div>
        ${S()&&this.health?.events?r`<div class="row"><span class="lbl">קליטת אירועים מה־NVR (alertStream)<span class="muted">${this.health.events.ingest.connected?`מחובר · פעימה אחרונה ${this.health.events.ingest.last_heartbeat_at?.replace("T"," ").replace("Z"," UTC")??"—"}`:`מנותק${this.health.events.ingest.last_error?` · ${this.health.events.ingest.last_error}`:""}`} · ${this.health.events.ingest.events_stored} אירועים נקלטו · ${this.health.events.ingest.reconnects} חיבורים מחדש</span></span><sw-badge kind=${this.health.events.ingest.connected?"live":"offline"}></sw-badge></div>
        <div class="row"><span class="lbl">אירועים מהקלטות (inferred)<span class="muted">${this.health.events.derive.last_error?`שגיאה: ${this.health.events.derive.last_error}`:this.health.events.derive.last_ok?`עודכן ${this.health.events.derive.last_ok.replace("T"," ").replace("Z"," UTC")}`:"טרם רץ"} · ${this.health.events.stored} אירועים במאגר</span></span><sw-badge kind=${this.health.events.derive.last_error?"stale":"recorded"}></sw-badge></div>`:p}
      </sw-card>
      <sw-card heading="תור עבודות">${Ei.map(e=>r`<div class="row"><span class="lbl">${e.title}<span class="muted">${e.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${e.status.startsWith("נכשל")?"fail":""}"><i style="--p:${e.progress}%"></i></span><span class="ltr">${e.progress}%</span></span></div>`)}</sw-card>
    </div>`}renderBackup(){return r`<div class="sections">
      <sw-card heading="גיבוי">
        <div class="row"><span class="lbl">גיבוי</span><span class="muted">ה־Add-on מוגדר backup: hot — הנתונים ב־/data נכללים בגיבוי של Home Assistant</span></div>
        <div class="row"><span class="lbl">תוכן</span><span class="muted">DB, מקורות תוכניות, גרסאות, עוגנים, צילומים, הגדרות</span></div>
        <div class="row"><span class="lbl">סודות</span><span class="muted">בהגדרות ה־Add-on בלבד (options), לא במסד הנתונים</span></div>
      </sw-card>
      <sw-card heading="שדרוג ו־Rollback">
        <div class="row"><span class="lbl">גרסת Add-on</span><span class="ltr">${this.version||(S()?"…":"נתוני הדגמה")}</span></div>
        <div class="row"><span class="lbl">סכימת DB</span><span class="ltr">1</span></div>
        <div class="row"><span class="lbl">Rollback</span><span class="muted">דרך HA (גרסה קודמת) + שחזור גיבוי</span></div>
      </sw-card>
    </div>`}renderSupport(){return r`<div class="sections"><sw-card heading="חבילת תמיכה מצונזרת">
      <div class="muted" style="padding-block-end:8px">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span class="lbl">כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span class="lbl">כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" icon="download" disabled>יצירת חבילה (בהמשך)</sw-button></div>
    </sw-card></div>`}render(){return r`
      <sw-page heading="הגדרות המערכת" subheading=${S()?"תעבורת וידאו, go2rtc, מכסות ובריאות":"אזור זמן, מדיניות אחסון, אינטגרציות ובריאות · נתוני הדגמה"}>
        <sw-tabs underline .items=${Wo} .active=${this.tab} @change=${e=>{this.tab=e.detail.id,this.tab==="media"&&this.loadMedia(),this.tab==="ha"&&this.loadHa()}}></sw-tabs>
        ${this.message&&this.tab==="ha"?r`<div class="muted" style="color:#15803d">${this.message}</div>`:p}
        ${this.error&&this.tab==="ha"?r`<div class="muted" style="color:var(--sw-error)">${this.error}</div>`:p}
        ${this.tab==="general"?this.renderGeneral():this.tab==="media"?this.renderMedia():this.tab==="ha"?this.renderHa():this.tab==="health"?this.renderHealth():this.tab==="backup"?this.renderBackup():this.renderSupport()}
      </sw-page>
    `}};A.styles=v`
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
  `;E([d()],A.prototype,"tab",2);E([d()],A.prototype,"settings",2);E([d()],A.prototype,"canEdit",2);E([d()],A.prototype,"draft",2);E([d()],A.prototype,"streams",2);E([d()],A.prototype,"go2rtc",2);E([d()],A.prototype,"foreign",2);E([d()],A.prototype,"sessions",2);E([d()],A.prototype,"busy",2);E([d()],A.prototype,"message",2);E([d()],A.prototype,"error",2);E([d()],A.prototype,"version",2);E([d()],A.prototype,"ha",2);E([d()],A.prototype,"pairing",2);E([d()],A.prototype,"showCode",2);E([d()],A.prototype,"regenArmed",2);E([d()],A.prototype,"copied",2);E([d()],A.prototype,"health",2);A=E([m("system-diagnostics")],A);var Fo=Object.defineProperty,qo=Object.getOwnPropertyDescriptor,Ji=(e,t,s,i)=>{for(var a=i>1?void 0:i?qo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Fo(t,s,a),a};const Ko=[{name:"כניסה ראשית",gb:320},{name:"אולם",gb:410},{name:"חצר אחורית",gb:380},{name:"לובי",gb:180},{name:"מחסן",gb:96}];let Gt=class extends w{constructor(){super(...arguments),this.range="30D"}render(){const e=[.3,.36,.45,.5,.58,.63,.7],t=600,s=200,i=b=>b/(e.length-1)*420,a=b=>170-b*150,n=e.map((b,y)=>`${y===0?"M":"L"}${i(y)} ${a(b)}`).join(" "),o=`M${i(e.length-1)} ${a(.7)} L520 ${a(.86)} L${t} ${a(1)}`,l=16,u=2*Math.PI*l,$=410;return r`
      <sw-page heading="אנליטיקת אחסון" subheading="Beta · ניטור שימוש, תכנון קדימה ושליטה · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה">
        <div slot="actions" style="display:flex;gap:4px">${["7D","30D","90D","1Y"].map(b=>r`<sw-chip ?selected=${this.range===b} @click=${()=>this.range=b}>${b}</sw-chip>`)}</div>
        <div class="kpis">
          <sw-card flush class="kpi"><div><div class="v">1.3 TB</div><div class="l">אחסון בשימוש (נמדד)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">1.9 TB</div><div class="l">קיבולת כוללת</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">68%</div><div class="l">ניצולת · ≈ 11 ימים נשמרים</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${c`<circle cx="20" cy="20" r=${l} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${l} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${u*.68} ${u}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
        </div>
        <sw-card heading="תחזית שימוש באחסון" subheading="עד הקו: נתון נמדד · אחרי הקו: אומדן (אינו תחזית פשוטה של דיסק מתמלא)">
          <svg class="trend" viewBox="0 0 ${t} ${s}" preserveAspectRatio="none" role="img" aria-label="תחזית אחסון">
            ${c`
              ${[.25,.5,.75,1].map(b=>c`<line x1="0" x2=${t} y1=${a(b)} y2=${a(b)} stroke="var(--sw-border)" />`)}
              <path d="${n} L${i(e.length-1)} 170 L0 170 Z" fill="var(--sw-accent-soft)" />
              <path d="${n}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" />
              <path d="${o}" fill="none" stroke="var(--sw-accent)" stroke-width="2" stroke-dasharray="5 5" opacity="0.7" />
              <line x1=${i(e.length-1)} x2=${i(e.length-1)} y1="10" y2="170" stroke="var(--sw-stale)" stroke-dasharray="4 4" />
              <rect x="470" y="18" width="110" height="34" rx="6" fill="#fff" stroke="var(--sw-border)" />
              <text x="525" y="32" font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">אומדן מילוי</text>
              <text x="525" y="46" font-size="11" font-weight="600" text-anchor="middle" fill="var(--sw-text)" font-family="var(--sw-font)">≈ 25.09.2026</text>
              ${["ינו","פבר","מרץ","אפר","מאי","יונ","יול"].map((b,y)=>c`<text x=${i(y)} y="190" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${b}</text>`)}
              ${["0.5 TB","1 TB","1.5 TB","1.9 TB"].map((b,y)=>c`<text x="4" y=${a(.25*(y+1))-3} font-size="9.5" fill="var(--sw-text-3)" font-family="var(--sw-font)">${b}</text>`)}
            `}
          </svg>
        </sw-card>
        <div class="grid">
          <sw-card heading="שימוש באחסון לפי מצלמה" subheading="נמדד · לפני retention">
            ${Ko.map(b=>r`<div class="cam"><span>${b.name}</span><span class="bar"><i style="--p:${b.gb/$*100}%"></i></span><span class="gb ltr">${b.gb} GB</span></div>`)}
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
    `}};Gt.styles=v`
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
  `;Ji([d()],Gt.prototype,"range",2);Gt=Ji([m("system-storage")],Gt);var Jo=Object.getOwnPropertyDescriptor,Go=(e,t,s,i)=>{for(var a=i>1?void 0:i?Jo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const Yo=[{mode:"סקירה ומצלמות",items:[{sc:"SC01",name:"סקירה (Dashboard)",route:"#/live",phase:"PILOT",board:"1:01 · 2:15"},{sc:"SC07",name:"כל המצלמות (Grid)",route:"#/live/wall",phase:"PILOT",board:"1:06"},{sc:"SC08",name:"מצלמה בודדת",route:"#/live/cameras/cam-4",phase:"PILOT",board:"1:05"},{sc:"SC09",name:"תצוגות שמורות",route:"#/live/views",phase:"PILOT",board:"legacy"},{sc:"SC27",name:"בריאות מצלמות",route:"#/system/devices",phase:"PILOT",board:"2:12"},{sc:"SC31",name:"קיוסק / תצוגת קיר",route:"#/kiosk/all",phase:"BETA",board:"3:24"}]},{mode:"אתרים ומפות",items:[{sc:"SC02",name:"אתרים ומבנים",route:"#/explore/sites",phase:"PILOT",board:"1:02 · 3:17"},{sc:"SC03",name:"דפדפן קומות",route:"#/explore/buildings/bld-a/floors",phase:"PILOT",board:"1:03"},{sc:"SC04",name:"מפת קומה חיה",route:"#/explore/floors/f0",phase:"PILOT",board:"1:04"},{sc:"SC05",name:"ייבוא ותיקון תוכנית",route:"#/explore/floors/f-2/import",phase:"PILOT",board:"2:13"},{sc:"SC06",name:"עורך תוכנית ועוגנים",route:"#/explore/floors/f0/edit",phase:"PILOT",board:"2:13"},{sc:"SC10",name:"קטלוג ישויות HA",route:"#/explore/entities",phase:"PILOT",board:"new"},{sc:"SC23",name:"דלתות ואינטרקום",route:"#/explore/access/d1",phase:"V1",board:"3:18"}]},{mode:"אירועים והקלטות",items:[{sc:"SC14",name:"מרכז אירועים",route:"#/investigate/events",phase:"PILOT",board:"1:08"},{sc:"SC12",name:"הקלטות / ציר זמן",route:"#/investigate/playback",phase:"PILOT",board:"1:07 · 2:16"},{sc:"SC13",name:"מרכז שליטה / ניגון מסונכרן",route:"#/investigate/playback/sync",phase:"BETA",board:"2:14"},{sc:"SC11",name:"מפה היסטורית",route:"#/investigate/floors/f0/history",phase:"PILOT",board:"new"},{sc:"SC15",name:"תור Review",route:"#/investigate/reviews",phase:"BETA",board:"legacy"},{sc:"SC16",name:"תיקים",route:"#/investigate/cases",phase:"BETA",board:"2:10"},{sc:"SC17",name:"סקירת אירוע / תיק",route:"#/investigate/cases/case-1",phase:"BETA",board:"2:10"},{sc:"SC18",name:"ייצוא והורדות",route:"#/investigate/exports",phase:"BETA",board:"2:10"},{sc:"SC19",name:"חיפוש AI",route:"#/investigate/search",phase:"BETA",board:"2:09"},{sc:"SC21",name:"התראות וחוקים",route:"#/investigate/rules",phase:"BETA",board:"3:19"},{sc:"SC22",name:"עורך חוק",route:"#/investigate/rules/r-1",phase:"BETA",board:"3:19"}]},{mode:"הגדרות",items:[{sc:"SC28",name:"הגדרות המערכת",route:"#/system/diagnostics",phase:"PILOT",board:"3:23"},{sc:"SC24",name:"משתמשים והרשאות",route:"#/system/access",phase:"PILOT",board:"3:20"},{sc:"SC25",name:"יומן אודיט",route:"#/system/audit",phase:"PILOT",board:"3:21"},{sc:"SC20",name:"אנליטיקת אחסון",route:"#/system/storage",phase:"BETA",board:"2:11"},{sc:"SC26",name:"אשף התקנה",route:"#/system/setup",phase:"PILOT",board:"3:22"}]}],Zo={PILOT:"live",BETA:"recorded",V1:"neutral"};let As=class extends w{render(){return r`
      <sw-page heading="כל המסכים (סקירת עיצוב)" subheading="29 מסכים על נתוני הדגמה · SC29/SC30 הם אותם מסכים ברוחב טלפון · SC32 (Lovelace) הוא עטיפה של אותם רכיבים">
        <div class="note">כל מסך מסומן ״נתוני הדגמה״. שום זרם וידאו, תמונה או מצב מכשיר אינם אמיתיים כאן (הסצנות מאוירות); המטרה היא לאשר את השפה החזותית, הניווט והזרימות לפני החיבור לנתונים.</div>
        <div class="groups">
          ${Yo.map(e=>r`<sw-card heading=${e.mode}>
              ${e.items.map(t=>r`<a href=${t.route}><span class="sc">${t.sc}</span><span class="name">${t.name}</span><span class="board">${t.board}</span><sw-badge kind=${Zo[t.phase]} label=${t.phase}></sw-badge><sw-icon name="chevron" size=${12}></sw-icon></a>`)}
            </sw-card>`)}
        </div>
      </sw-page>
    `}};As.styles=v`
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
  `;As=Go([m("screens-index")],As);var Xo=Object.getOwnPropertyDescriptor,Qo=(e,t,s,i)=>{for(var a=i>1?void 0:i?Xo(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=o(a)||a);return a};const el=[["--sw-bg","רקע"],["--sw-surface","משטח"],["--sw-surface-3","משטח 3"],["--sw-border","גבול"],["--sw-text","טקסט"],["--sw-text-2","טקסט משני"],["--sw-text-3","טקסט שלישי"],["--sw-accent","כחול"],["--sw-accent-soft","כחול רך"],["--sw-live","חי"],["--sw-offline","מנותק"],["--sw-stale","מיושן"],["--sw-danger","שגיאה"],["--sw-purple","סגול (דלת)"]],tl=["live","recorded","historic","offline","stale","partial","unknown","forbidden","error"],sl=["loading","empty","error","forbidden","stale","partial"],il=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night","building","house"],al=["dashboard","building","camera","bell","history","system","search","user","play","pause","back10","forward10","aperture","volume","mic","expand","close","chevron","chevronDown","warning","info","lock","unlock","offline","refresh","layers","floor","plus","minus","fit","door","light","sensor","check","clock","download","pin","more","map","upload","list","target","filter","users","shield","storage","edit","case","rule","link","grid","home","star","calendar","trash","eye","cpu","activity","image","wifi","signal","move","bookmark","route"];let Os=class extends w{render(){return r`
      <h2>ספריית רכיבים ו־tokens (v3)</h2>
      <p class="lead">מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. ממשק קומפקטי (12px), משטחים לבנים על רקע קריר, מחיצות דקות, כחול אחד במשורה, ירוק רק ל"מחובר", צל שקט, סצנות מאוירות עד חיבור זרמים.</p>

      <h3>צבעים</h3>
      <div class="swatches">
        ${el.map(([e,t])=>r`<div class="swatch"><div class="c" style="background:var(${e})"></div><div class="n"><span>${t}</span><span class="ltr">${e}</span></div></div>`)}
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
      <div class="scenes">${il.map(e=>r`<div><sw-scene kind=${e}></sw-scene><span>${e}</span></div>`)}</div>

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
      <div class="row">${tl.map(e=>r`<sw-badge kind=${e}></sw-badge>`)}</div>

      <h3>ציר זמן, שלבים, קומות איזומטריות</h3>
      <sw-timeline .segments=${Vt} .events=${[{minute:614,kind:"person",label:"אדם"},{minute:582,kind:"vehicle",label:"רכב"}]} .cursor=${615}></sw-timeline>
      <div class="row" style="margin-block-start:10px">
        <sw-card style="flex:1;min-inline-size:280px"><sw-steps .steps=${["גילוי","הגדרה","בדיקה","סיום"]} .current=${1}></sw-steps></sw-card>
        <sw-floor-iso .rooms=${ms("f0")} selected></sw-floor-iso>
        <sw-floor-iso .rooms=${ms("f-1")}></sw-floor-iso>
        <sw-floor-iso empty></sw-floor-iso>
      </div>

      <h3>מצבי מסך</h3>
      <div class="grid">
        ${sl.map(e=>r`<div class="panel"><sw-state-panel state=${e} actionLabel=${e==="error"?"נסה שוב":""}></sw-state-panel></div>`)}
      </div>

      <h3>אייקונים</h3>
      <div class="icons">${al.map(e=>r`<div class="icon"><sw-icon .name=${e} size=${18}></sw-icon><span class="ltr">${e}</span></div>`)}</div>
    `}};Os.styles=v`
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
  `;Os=Qo([m("styleguide-screen")],Os);const vi=[{id:"overview",icon:"dashboard",label:"סקירה",href:"#/live"},{id:"sites",icon:"building",label:"אתרים",href:"#/explore/sites"},{id:"cameras",icon:"camera",label:"מצלמות",href:"#/live/wall"},{id:"events",icon:"bell",label:"אירועים",href:"#/investigate/events"},{id:"playback",icon:"history",label:"הקלטות",href:"#/investigate/playback"},{id:"settings",icon:"system",label:"הגדרות",href:"#/system/diagnostics"}],rl={overview:[],sites:[{id:"sites",label:"אתרים ומבנים",href:"#/explore/sites"},{id:"floors",label:"מפת קומה",href:"#/explore/floors/f0"},{id:"entities",label:"ישויות HA",href:"#/explore/entities"},{id:"access",label:"דלתות ואינטרקום",href:"#/explore/access/d1"}],cameras:[{id:"wall",label:"כל המצלמות",href:"#/live/wall"},{id:"views",label:"תצוגות שמורות",href:"#/live/views"},{id:"devices",label:"בריאות מצלמות",href:"#/system/devices"}],events:[{id:"events",label:"מרכז אירועים",href:"#/investigate/events"},{id:"reviews",label:"Review",href:"#/investigate/reviews"},{id:"search",label:"חיפוש",href:"#/investigate/search"},{id:"cases",label:"תיקים",href:"#/investigate/cases"},{id:"rules",label:"חוקים והתראות",href:"#/investigate/rules"},{id:"exports",label:"ייצוא",href:"#/investigate/exports"}],playback:[{id:"playback",label:"הקלטות",href:"#/investigate/playback"},{id:"sync",label:"ניגון מסונכרן",href:"#/investigate/playback/sync"},{id:"history",label:"מפה היסטורית",href:"#/investigate/floors/f0/history"}],settings:[{id:"general",label:"כללי",href:"#/system/diagnostics"},{id:"access",label:"משתמשים והרשאות",href:"#/system/access"},{id:"audit",label:"אודיט",href:"#/system/audit"},{id:"storage",label:"אחסון",href:"#/system/storage"},{id:"setup",label:"אשף התקנה",href:"#/system/setup"}]};function Gi(e){if(!e?.mode)return null;const t=e.segments;switch(e.mode){case"live":return t.length===1?"overview":"cameras";case"explore":return"sites";case"investigate":return!t[1]||t[1]==="playback"||t[1]==="floors"?"playback":"events";case"system":return t[1]==="devices"?"cameras":"settings";default:return null}}function nl(e){const t=Gi(e);if(!t||!e)return"";const s=e.segments;switch(t){case"sites":return s[1]==="buildings"||s[1]==="floors"?"floors":s[1]==="entities"?"entities":s[1]==="access"?"access":"sites";case"cameras":return e.mode==="system"?"devices":s[1]==="views"?"views":"wall";case"events":return s[1]??"events";case"playback":return s[1]==="floors"?"history":s[2]==="sync"?"sync":"playback";case"settings":return!s[1]||s[1]==="diagnostics"?"general":s[1];default:return""}}var ol=Object.defineProperty,ll=Object.getOwnPropertyDescriptor,Vs=(e,t,s,i)=>{for(var a=i>1?void 0:i?ll(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&ol(t,s,a),a};let vt=class extends w{constructor(){super(...arguments),this.route=null,this.session={mode:"loading",me:null,error:null}}connectedCallback(){super.connectedCallback(),this.stopSession=Ti(e=>this.session=e),xr(),this.stopRouter=yr(e=>{this.route=e,this.toggleAttribute("data-kiosk",e.segments[0]==="kiosk")})}disconnectedCallback(){super.disconnectedCallback(),this.stopRouter?.(),this.stopSession?.()}renderGate(){const e=this.session;return e.mode==="unauthenticated"?r`<div class="gate"><sw-state-panel state="forbidden" heading="הזדהות דרך Home Assistant נדרשת" hint=${e.error??""}></sw-state-panel></div>`:e.mode==="no_access"?r`<div class="gate"><sw-state-panel state="forbidden" heading="אין לך עדיין תפקיד במערכת" hint="המשתמש ${e.me?.user.display_name||e.me?.user.username||""} מזוהה מ־Home Assistant, אך מנהל ה־VMS טרם שייך לו תפקיד והיקף. פנה למנהל המערכת."></sw-state-panel></div>`:null}renderScreen(){const e=this.route;if(!e)return p;const t=e.segments;if(t[0]==="styleguide")return r`<styleguide-screen></styleguide-screen>`;if(t[0]==="screens")return r`<screens-index></screens-index>`;if(t[0]==="kiosk")return r`<kiosk-wall></kiosk-wall>`;switch(e.mode){case"live":return t[1]==="wall"?r`<live-wall></live-wall>`:t[1]==="views"?r`<live-views></live-views>`:t[1]==="cameras"?r`<live-camera .cameraId=${t[2]??"cam-1"}></live-camera>`:r`<live-overview></live-overview>`;case"investigate":return t[1]==="playback"&&t[2]==="sync"?r`<investigate-sync></investigate-sync>`:t[1]==="playback"?r`<investigate-playback .cameraId=${e.params.get("camera")??""} .at=${e.params.get("t")??""}></investigate-playback>`:t[1]==="floors"?r`<investigate-history-map .floorId=${t[2]??"f0"}></investigate-history-map>`:t[1]==="events"?r`<investigate-events .cameraId=${e.params.get("camera")??""} .date=${e.params.get("date")??""}></investigate-events>`:t[1]==="reviews"?r`<investigate-reviews></investigate-reviews>`:t[1]==="cases"&&t[2]?r`<investigate-case-detail .caseId=${t[2]}></investigate-case-detail>`:t[1]==="cases"?r`<investigate-cases></investigate-cases>`:t[1]==="exports"?r`<investigate-exports></investigate-exports>`:t[1]==="search"?r`<investigate-search></investigate-search>`:t[1]==="rules"&&t[2]?r`<investigate-rule-editor .ruleId=${t[2]}></investigate-rule-editor>`:t[1]==="rules"?r`<investigate-rules></investigate-rules>`:r`<investigate-playback></investigate-playback>`;case"system":return t[1]==="audit"?r`<system-audit></system-audit>`:t[1]==="setup"?r`<system-setup></system-setup>`:t[1]==="devices"?r`<system-devices></system-devices>`:t[1]==="storage"?r`<system-storage></system-storage>`:t[1]==="access"?r`<system-access></system-access>`:r`<system-diagnostics></system-diagnostics>`;case"explore":default:{if(t[1]==="sites")return r`<explore-sites></explore-sites>`;if(t[1]==="buildings")return r`<explore-floors .buildingId=${t[2]??"bld-a"}></explore-floors>`;if(t[1]==="entities")return r`<explore-entities></explore-entities>`;if(t[1]==="access")return r`<explore-access></explore-access>`;if(t[1]==="floors"&&t[3]==="import")return r`<explore-plan-import .floorId=${t[2]}></explore-plan-import>`;if(t[1]==="floors"&&t[3]==="edit")return r`<explore-plan-editor .floorId=${t[2]} .presetEntity=${e.params.get("entity")??""}></explore-plan-editor>`;const s=t[1]==="floors"&&t[2]?t[2]:"f0",i=e.params.get("state")??"ready";return r`<explore-floor-map .floorId=${s} .screenState=${i}></explore-floor-map>`}}}render(){if(this.route?.segments[0]==="kiosk")return r`<main style="block-size:100dvh">${this.renderScreen()}</main>`;const t=Gi(this.route),s=t?rl[t]:[],i=this.route?.segments[3]==="edit"||this.route?.segments[3]==="import";return r`
      <nav class="rail" aria-label="ניווט ראשי">
        <div class="brand">
          <img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" />
          <span class="name">SmplWise</span>
        </div>
        ${vi.map(a=>r`<a class=${et({item:!0,active:t===a.id})} href=${a.href} title=${a.label} aria-current=${t===a.id?"page":"false"}>
            <sw-icon .name=${a.icon} size=${16}></sw-icon><span>${a.label}</span>
          </a>`)}
        <div class="grow"></div>
        <a class=${et({item:!0,small:!0,active:this.route?.segments[0]==="screens"})} href="#/screens" title="כל המסכים">
          <sw-icon name="list" size=${14}></sw-icon><span>כל המסכים</span>
        </a>
        <a class=${et({item:!0,small:!0,active:this.route?.segments[0]==="styleguide"})} href="#/styleguide" title=${f("nav.styleguide")}>
          <sw-icon name="layers" size=${14}></sw-icon><span>${f("nav.styleguide")}</span>
        </a>
      </nav>
      <header class="topbar">
        <span class="brand-mobile"><img src="${"./"}brand/smplwise-mark.png" alt="SmplWise" /></span>
        <label class="search"><sw-icon name="search" size=${14}></sw-icon><input type="search" placeholder=${f("app.search")} aria-label=${f("app.search")} /></label>
        <span class="spacer"></span>
        ${this.session.mode==="api"||this.session.mode==="no_access"?r`<span class="who"><b>${this.session.me?.user.display_name||this.session.me?.user.username}</b>${this.session.me?.bindings[0]?r`<span>· ${this.session.me.bindings[0].role_name}</span>`:p}</span>`:this.session.mode==="demo"?r`<sw-badge kind="neutral" label="נתוני הדגמה"></sw-badge>`:p}
        <sw-button class="bell" variant="ghost" size="sm" iconOnly icon="bell" label=${f("app.notifications")}></sw-button>
        <sw-avatar name=${this.session.me?.user.display_name||this.session.me?.user.username||"יוני"} size=${28} title=${f("app.account")} aria-label=${f("app.account")}></sw-avatar>
      </header>
      <main>
        ${this.renderGate()||r`
          <div class="subnav">${s.length>1&&!i?r`<sw-tabs .items=${s} .active=${nl(this.route)}></sw-tabs>`:p}</div>
          <div class="screen">${this.session.mode==="loading"?p:this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${vi.slice(0,4).map(a=>r`<a class=${et({active:t===a.id})} href=${a.href}><sw-icon .name=${a.icon} size=${20}></sw-icon>${a.label}</a>`)}
        <a class=${et({active:t==="settings"||t==="playback"})} href="#/system/diagnostics"><sw-icon name="more" size=${20}></sw-icon>עוד</a>
      </nav>
    `}};vt.styles=v`
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
  `;Vs([d()],vt.prototype,"route",2);Vs([d()],vt.prototype,"session",2);vt=Vs([m("sw-app")],vt);
//# sourceMappingURL=index-B2VWQj5y.js.map
