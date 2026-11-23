import{i as _,a as m,m as w,A as o,b as i,eO as O,g as P,j as p,k as C}from"./index-eHtAZ44A.js";import{o as g,l as r,r as z,a as S,b as j,s as D,p as h,c as A}from"./passkey-only-CRhf_gTd.js";import{c as H}from"./confirm-dialog-CYGk_R7l.js";function y(e){const s=e.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-e.length%4)%4),a=atob(s),t=new Uint8Array(a.length);for(let n=0;n<a.length;n++)t[n]=a.charCodeAt(n);return t}function u(e){const s=e instanceof Uint8Array?e:new Uint8Array(e);let a="";for(let t=0;t<s.length;t++)a+=String.fromCharCode(s[t]);return btoa(a).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}function $(e){return{type:"public-key",id:y(e.id),...e.transports?{transports:e.transports}:{}}}function N(e){return{rp:e.rp,user:{id:y(e.user.id),name:e.user.name,displayName:e.user.displayName},challenge:y(e.challenge),pubKeyCredParams:e.pubKeyCredParams,timeout:e.timeout,attestation:e.attestation??"none",authenticatorSelection:e.authenticatorSelection,excludeCredentials:(e.excludeCredentials??[]).map($)}}function T(e){return{challenge:y(e.challenge),rpId:e.rpId,timeout:e.timeout,userVerification:e.userVerification??"preferred",allowCredentials:(e.allowCredentials??[]).map($)}}function x(e){const s=e.response,a={clientDataJSON:u(s.clientDataJSON)};if("attestationObject"in s&&s.attestationObject){a.attestationObject=u(s.attestationObject);const t=typeof s.getTransports=="function"?s.getTransports():[];t.length&&(a.transports=t)}else a.authenticatorData=u(s.authenticatorData),a.signature=u(s.signature),s.userHandle&&(a.userHandle=u(s.userHandle));return{id:e.id,rawId:u(e.rawId),type:"public-key",response:a}}function k(){return typeof window<"u"&&typeof window.PublicKeyCredential=="function"&&!!navigator.credentials?.create}class c extends Error{}async function U(e){try{const s=await navigator.credentials.create({publicKey:N(e)});if(!s)throw new c("no credential");return x(s)}catch(s){throw s instanceof c?s:new c(s instanceof Error?s.name:"error")}}async function I(e){try{const s=await navigator.credentials.get({publicKey:T(e)});if(!s)throw new c("no credential");return x(s)}catch(s){throw s instanceof c?s:new c(s instanceof Error?s.name:"error")}}var K=Object.defineProperty,R=Object.getOwnPropertyDescriptor,d=(e,s,a,t)=>{for(var n=t>1?void 0:t?R(s,a):s,b=e.length-1,f;b>=0;b--)(f=e[b])&&(n=(t?f(s,a,n):f(n))||n);return t&&n&&K(s,a,n),n};function v(e){if(!e)return"";const s=new Date(e);return O(s)}let l=class extends _{constructor(){super(...arguments),this.data=null,this.refused=!1,this.busy=!1,this.label="",this.armed="",this.error="",this.message=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await g()}catch(e){e instanceof m&&(e.status===403||e.status===404||e.status===409)?this.refused=!0:this.error=w(e)}}explain(e){return e instanceof c?r("passkeyCancelled"):e instanceof m&&e.body.code==="reauth_required"?r("passkeyReauth"):w(e)}async run(e){this.busy=!0,this.error="",this.message="";try{await e()}catch(s){this.error=this.explain(s)}finally{this.busy=!1}}add(e){e.preventDefault(),this.run(async()=>{const s=await z(),a=await U(s.publicKey);await S(a,this.label.trim()||void 0),this.label="",this.message=r("passkeyAdded"),this.data=await g()})}removeOne(e){this.run(async()=>{this.data=await j(e),this.armed="",this.message=r("passkeyRemoved")})}first(e){const s=e.target,a=s.checked;this.run(async()=>{try{this.data=await D(a)}catch(t){throw s.checked=!a,t}})}async only(e){const s=e.target,a=s.checked;if(a&&!await H({body:h("onlyConfirmOn"),danger:!0})){s.checked=!1;return}this.run(async()=>{try{this.data=await A(a)}catch(t){throw s.checked=!a,t}})}render(){if(this.refused)return o;const e=this.data;if(!e)return this.error?i`<div class="err" role="alert">${this.error}</div>`:o;const s=typeof window<"u"?window.location.origin:"",a=!!e.origin&&s!==e.origin;return i`
      <h3 data-pk-title>${r("passkeys")}</h3>
      <div class="lbl">${r("passkeyFactorNote")}</div>
      ${e.available?a?i`<div class="lbl" data-pk-wrong-host>${r("passkeyWrongHost",{origin:e.origin??""})}</div>`:k()?o:i`<div class="lbl" data-pk-unsupported>${r("passkeyUnsupported")}</div>`:i`<div class="lbl" data-pk-unavailable>${r("passkeyUnavailable")}</div>`}
      ${e.credentials.length?i`<ul data-pk-list>
            ${e.credentials.map(t=>i`<li data-pk-item=${t.id}>
              <span>${t.label||r("passkeys")}
                <small>${v(t.created_at)}${t.synced?i` · ${r("passkeySynced")}`:o}${t.last_used_at?i` · ${r("passkeyLastUsed")} ${v(t.last_used_at)}`:o}${t.usable?o:i` · ${r("passkeyNotUsable")}`}</small></span>
              ${this.armed===t.id?i`<span><sw-button size="sm" variant="danger" ?disabled=${this.busy} data-pk-remove-confirm @click=${()=>this.removeOne(t.id)}>${r("passkeyRemove")}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.armed=""}>${r("cancel")}</sw-button></span>`:i`<sw-button size="sm" variant="secondary" ?disabled=${this.busy} data-pk-remove @click=${()=>this.armed=t.id}>${r("passkeyRemove")}</sw-button>`}
            </li>`)}
          </ul>
          ${this.armed?i`<div class="lbl">${r("passkeyRemoveConfirm",{name:e.credentials.find(t=>t.id===this.armed)?.label??""})}</div>`:o}`:i`<div class="lbl" data-pk-empty>${r("passkeyNone")}</div>`}
      ${e.available&&!a&&k()?i`<form @submit=${t=>this.add(t)} data-pk-add-form>
            <input type="text" maxlength="40" aria-label=${r("passkeyLabel")} placeholder=${r("passkeyLabel")} .value=${this.label}
              @input=${t=>this.label=t.target.value} ?disabled=${this.busy} />
            <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-add @click=${t=>this.add(t)}>${this.busy?r("passkeyWaiting"):r("passkeyAdd")}</sw-button>
          </form>`:o}
      ${e.first_allowed&&e.credentials.some(t=>t.usable)?i`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${r("passkeyFirst")} data-pk-first .checked=${e.first_on} ?disabled=${this.busy} @change=${t=>this.first(t)}></sw-toggle>
            <span>${r("passkeyFirst")}<br /><small>${r("passkeyFirstHelp")}</small></span></label>`:o}
      ${e.first_allowed&&e.credentials.some(t=>t.usable)?i`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${h("onlyLabel")} data-pk-only .checked=${!!e.only_on} ?disabled=${this.busy} @change=${t=>this.only(t)}></sw-toggle>
            <span>${h("onlyLabel")}</span></label>`:o}
      ${this.error?i`<div class="err" role="alert" data-pk-error>${this.error}</div>`:o}
      ${this.message?i`<div class="ok" role="status" data-pk-message>${this.message}</div>`:o}
    `}};l.styles=P`
    :host {
      display: block;
      margin-block-start: 12px;
      padding-block-start: 12px;
      border-block-start: 1px solid var(--sw-border);
    }
    h3 {
      margin: 0 0 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-block-size: 40px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    small,
    .lbl {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    form {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    input[type='text'] {
      flex: 1 1 10em;
      min-inline-size: 0;
      min-block-size: 36px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    label.first {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .err {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .ok {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;d([p()],l.prototype,"data",2);d([p()],l.prototype,"refused",2);d([p()],l.prototype,"busy",2);d([p()],l.prototype,"label",2);d([p()],l.prototype,"armed",2);d([p()],l.prototype,"error",2);d([p()],l.prototype,"message",2);l=d([C("sw-passkeys")],l);const J=Object.freeze(Object.defineProperty({__proto__:null,get SwPasskeys(){return l}},Symbol.toStringTag,{value:"Module"}));export{c as P,I as g,k as p,J as s};
