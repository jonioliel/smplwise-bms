import{j as g,k as c,a as w,c as k,q as v,P as x,n as z,B as C,A as l,b as r,x as y,C as P,m as _}from"./index-C0HbI5eb.js";import{o as h,r as U,a as O,b as R,c as W,s as F,p as f,d as N}from"./passkey-only-Bw1zOWNY.js";import{s as D,p as H}from"./step-up-passkey-BPBHQBez.js";import{l as e}from"./local-identity-BnkC12Vm.js";import{c as L}from"./confirm-dialog-CEi4gaw7.js";import{v as A}from"./second-factor-CA0QZqPj.js";var S=Object.defineProperty,V=Object.getOwnPropertyDescriptor,p=(s,t,i,n)=>{for(var o=n>1?void 0:n?V(t,i):t,m=s.length-1,u;m>=0;m--)(u=s[m])&&(o=(n?u(t,i,o):u(o))||o);return n&&o&&S(t,i,o),o};function $(s){if(!s)return"";const t=new Date(s);return P(t)}let d=class extends w{constructor(){super(...arguments),this.data=null,this.refused=!1,this.busy=!1,this.label="",this.armed="",this.error="",this.message="",this.renaming="",this.renameValue="",this.need=null,this.code=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await h()}catch(s){s instanceof k&&(s.status===403||s.status===404||s.status===409)?this.refused=!0:this.error=v(s)}}explain(s){return s instanceof x?e("passkeyWrongHost",{origin:s.rpId}):s instanceof z?e("passkeyCancelled"):s instanceof k&&s.body.code==="reauth_required"?e("passkeyReauth"):v(s)}async run(s,t=!0){this.busy=!0,this.error="",this.message="";try{await s()}catch(i){const n=t?D(i):null;n?(this.need={action:n.action??"",methods:Array.isArray(n.methods)?n.methods:[],retry:s},this.code=""):this.error=this.explain(i)}finally{this.busy=!1}}confirmWith(s){const t=this.need;t&&this.run(async()=>{await s(t.action),this.need=null,this.code="",await t.retry()},!1)}confirmCode(s){s.preventDefault();const t=this.code.replace(/\s+/g,"");/^\d{6}$/.test(t)&&this.confirmWith(i=>A(t,i||void 0))}rename(s){const t=this.renameValue.trim();this.run(async()=>{await U(s,t),this.renaming="",this.message=e("passkeyRenamed"),this.data=await h()})}add(s){s.preventDefault(),this.run(async()=>{const t=await O(),i=await C(t.publicKey);await R(i,this.label.trim()||void 0),this.label="",this.message=e("passkeyAdded"),this.data=await h()})}removeOne(s){this.run(async()=>{await W(s),this.armed="",this.message=e("passkeyRemoved"),this.data=await h()})}renderNeed(s){const t=this.need;if(!t)return l;const i=s&&t.methods.includes("passkey"),n=t.methods.includes("totp");return r`<div class="confirm" role="group" aria-label=${e("passkeyConfirmTitle")} data-pk-step-up>
      <span>${e("passkeyConfirmTitle")}</span>
      ${i?r`<span><sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-step-up-passkey @click=${()=>this.confirmWith(o=>H(o||void 0))}>${this.busy?e("passkeyWaiting"):e("passkeyConfirmWithPasskey")}</sw-button></span>`:l}
      ${n?r`<form @submit=${o=>this.confirmCode(o)}>
            <input class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" aria-label=${e("passkeyConfirmCode")}
              .value=${this.code} ?disabled=${this.busy} data-pk-step-up-code @input=${o=>this.code=o.target.value} />
            <sw-button size="sm" variant=${i?"secondary":"primary"} ?disabled=${this.busy||!/^\d{6}$/.test(this.code.replace(/\s+/g,""))} data-pk-step-up-code-go
              @click=${o=>this.confirmCode(o)}>${e("passkeyConfirmCodeGo")}</sw-button>
          </form>`:l}
      ${!i&&!n?r`<span class="lbl" data-pk-step-up-none>${e("passkeyConfirmNone")}</span>`:l}
      <span><sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-pk-step-up-cancel @click=${()=>{this.need=null,this.code="",this.armed=""}}>${e("cancel")}</sw-button></span>
    </div>`}first(s){const t=s.target,i=t.checked;this.run(async()=>{try{this.data=await F(i)}catch(n){throw t.checked=!i,n}})}async only(s){const t=s.target,i=t.checked;if(i&&!await L({body:f("onlyConfirmOn"),danger:!0})){t.checked=!1;return}this.run(async()=>{try{this.data=await N(i)}catch(n){throw t.checked=!i,n}})}render(){if(this.refused)return l;const s=this.data;if(!s)return this.error?r`<div class="err" role="alert">${this.error}</div>`:l;const t=typeof window<"u"?window.location.origin:"",i=!!s.origin&&t!==s.origin,n=s.user_kind==="user",o=s.credentials.filter(a=>a.usable),m=s.credentials.find(a=>a.id===this.armed),u=!!m&&m.usable&&o.length===1&&!s.totp;return r`
      <h3 data-pk-title>${e("passkeys")}</h3>
      <div class="lbl" data-pk-note>${n?e("passkeyFactorNoteUser"):e("passkeyFactorNote")}</div>
      ${s.available?i?r`<div class="lbl" data-pk-wrong-host>${e("passkeyWrongHost",{origin:s.origin??""})}</div>`:y()?l:r`<div class="lbl" data-pk-unsupported>${e("passkeyUnsupported")}</div>`:r`<div class="lbl" data-pk-unavailable>${e("passkeyUnavailable")}</div>`}
      ${s.credentials.length?r`<ul data-pk-list>
            ${s.credentials.map(a=>r`<li data-pk-item=${a.id}>
              <span>${a.label||e("passkeys")}
                <small>${$(a.created_at)}${a.synced?r` · ${e("passkeySynced")}`:l}${a.last_used_at?r` · ${e("passkeyLastUsed")} ${$(a.last_used_at)}`:l}${a.usable?l:r` · ${e("passkeyNotUsable")}`}</small></span>
              ${this.renaming===a.id?r`<form class="actions" @submit=${b=>{b.preventDefault(),this.rename(a.id)}} data-pk-rename-form>
                    <input type="text" maxlength="40" aria-label=${e("passkeyLabel")} .value=${this.renameValue} ?disabled=${this.busy} data-pk-rename-input
                      @input=${b=>this.renameValue=b.target.value} />
                    <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-rename-save @click=${()=>this.rename(a.id)}>${e("passkeyRenameSave")}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.renaming=""}>${e("cancel")}</sw-button></form>`:this.armed===a.id?r`<span class="actions"><sw-button size="sm" variant="danger" ?disabled=${this.busy} data-pk-remove-confirm @click=${()=>this.removeOne(a.id)}>${e("passkeyRemove")}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.armed=""}>${e("cancel")}</sw-button></span>`:r`<span class="actions"><sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-pk-rename
                      @click=${()=>{this.renaming=a.id,this.renameValue=a.label??"",this.armed=""}}>${e("passkeyRename")}</sw-button>
                    <sw-button size="sm" variant="secondary" ?disabled=${this.busy} data-pk-remove @click=${()=>{this.armed=a.id,this.renaming=""}}>${e("passkeyRemove")}</sw-button></span>`}
            </li>`)}
          </ul>
          ${m?r`<div class="lbl" data-pk-remove-text>${n?e("passkeyRemoveConfirmUser",{name:m.label??""}):e("passkeyRemoveConfirm",{name:m.label??""})}${u?r`<br /><span data-pk-last-factor>${e("passkeyLastFactor")}</span>`:l}</div>`:l}`:r`<div class="lbl" data-pk-empty>${e("passkeyNone")}</div>`}
      ${s.available&&!i&&y()?r`<form @submit=${a=>this.add(a)} data-pk-add-form>
            <input type="text" maxlength="40" aria-label=${e("passkeyLabel")} placeholder=${e("passkeyLabel")} .value=${this.label}
              @input=${a=>this.label=a.target.value} ?disabled=${this.busy} />
            <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-add @click=${a=>this.add(a)}>${this.busy?e("passkeyWaiting"):e("passkeyAdd")}</sw-button>
          </form>`:l}
      ${s.first_allowed&&s.credentials.some(a=>a.usable)?r`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${e("passkeyFirst")} data-pk-first .checked=${s.first_on} ?disabled=${this.busy} @change=${a=>this.first(a)}></sw-toggle>
            <span>${e("passkeyFirst")}<br /><small>${e("passkeyFirstHelp")}</small></span></label>`:l}
      ${s.first_allowed&&s.credentials.some(a=>a.usable)?r`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${f("onlyLabel")} data-pk-only .checked=${!!s.only_on} ?disabled=${this.busy} @change=${a=>this.only(a)}></sw-toggle>
            <span>${f("onlyLabel")}</span></label>`:l}
      ${this.renderNeed(s.available&&!i&&y())}
      ${this.error?r`<div class="err" role="alert" data-pk-error>${this.error}</div>`:l}
      ${this.message?r`<div class="ok" role="status" data-pk-message>${this.message}</div>`:l}
    `}};d.styles=g`
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
    .actions {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .confirm {
      margin-block-start: 8px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2, var(--sw-surface));
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .confirm form {
      margin: 0;
    }
    input.code {
      flex: 0 1 9em;
      letter-spacing: 0.2em;
      text-align: center;
      direction: ltr;
    }
  `;p([c()],d.prototype,"data",2);p([c()],d.prototype,"refused",2);p([c()],d.prototype,"busy",2);p([c()],d.prototype,"label",2);p([c()],d.prototype,"armed",2);p([c()],d.prototype,"error",2);p([c()],d.prototype,"message",2);p([c()],d.prototype,"renaming",2);p([c()],d.prototype,"renameValue",2);p([c()],d.prototype,"need",2);p([c()],d.prototype,"code",2);d=p([_("sw-passkeys")],d);
