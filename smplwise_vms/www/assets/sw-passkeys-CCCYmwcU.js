import{j as w,k as c,a as g,c as k,q as v,P as x,n as z,B as C,A as l,b as r,x as y,C as P,m as _}from"./index-HK12zoPD.js";import{o as h,r as R,a as N,b as U,c as O,s as W,p as f,d as F}from"./passkey-only-ChM342oN.js";import{s as D,p as H}from"./step-up-passkey-CS2MeJqL.js";import{l as e}from"./local-identity-CHlzGbcp.js";import{c as L}from"./confirm-dialog-WT1oiZQ3.js";import{v as A}from"./second-factor-Dji2IcOk.js";var S=Object.defineProperty,V=Object.getOwnPropertyDescriptor,p=(s,a,i,n)=>{for(var o=n>1?void 0:n?V(a,i):a,m=s.length-1,u;m>=0;m--)(u=s[m])&&(o=(n?u(a,i,o):u(o))||o);return n&&o&&S(a,i,o),o};function $(s){if(!s)return"";const a=new Date(s);return P(a)}let d=class extends g{constructor(){super(...arguments),this.data=null,this.refused=!1,this.busy=!1,this.label="",this.armed="",this.error="",this.message="",this.renaming="",this.renameValue="",this.need=null,this.code=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await h()}catch(s){s instanceof k&&(s.status===403||s.status===404||s.status===409)?this.refused=!0:this.error=v(s)}}explain(s){return s instanceof x?e("passkeyWrongHost",{origin:s.rpId}):s instanceof z?e("passkeyCancelled"):s instanceof k&&s.body.code==="reauth_required"?e("passkeyReauth"):v(s)}clearNeed(){this.need=null,this.code=""}cancelRow(){this.armed="",this.renaming="",this.clearNeed()}async run(s,a=!0){this.busy=!0,this.error="",this.message="",a&&this.clearNeed();try{await s()}catch(i){const n=a?D(i):null;n?(this.need={action:n.action??"",methods:Array.isArray(n.methods)?n.methods:[],retry:s},this.code=""):this.error=this.explain(i)}finally{this.busy=!1}}confirmWith(s){const a=this.need;a&&this.run(async()=>{await s(a.action),this.need=null,this.code="",await a.retry()},!1)}confirmCode(s){s.preventDefault();const a=this.code.replace(/\s+/g,"");/^\d{6}$/.test(a)&&this.confirmWith(i=>A(a,i||void 0))}rename(s){const a=this.renameValue.trim();this.run(async()=>{await R(s,a),this.renaming="",this.message=e("passkeyRenamed"),this.data=await h()})}add(s){s.preventDefault(),this.run(async()=>{const a=await N(),i=await C(a.publicKey);await U(i,this.label.trim()||void 0),this.label="",this.message=e("passkeyAdded"),this.data=await h()})}removeOne(s){this.run(async()=>{await O(s),this.armed="",this.message=e("passkeyRemoved"),this.data=await h()})}renderNeed(s){const a=this.need;if(!a)return l;const i=s&&a.methods.includes("passkey"),n=a.methods.includes("totp");return r`<div class="confirm" role="group" aria-label=${e("passkeyConfirmTitle")} data-pk-step-up>
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
    </div>`}first(s){const a=s.target,i=a.checked;this.run(async()=>{try{this.data=await W(i)}catch(n){throw a.checked=!i,n}})}async only(s){const a=s.target,i=a.checked;if(i&&!await L({body:f("onlyConfirmOn"),danger:!0})){a.checked=!1;return}this.run(async()=>{try{this.data=await F(i)}catch(n){throw a.checked=!i,n}})}render(){if(this.refused)return l;const s=this.data;if(!s)return this.error?r`<div class="err" role="alert">${this.error}</div>`:l;const a=typeof window<"u"?window.location.origin:"",i=!!s.origin&&a!==s.origin,n=s.user_kind==="user",o=s.credentials.filter(t=>t.usable),m=s.credentials.find(t=>t.id===this.armed),u=!!m&&m.usable&&o.length===1&&!s.totp;return r`
      <h3 data-pk-title>${e("passkeys")}</h3>
      <div class="lbl" data-pk-note>${n?e("passkeyFactorNoteUser"):e("passkeyFactorNote")}</div>
      ${s.available?i?r`<div class="lbl" data-pk-wrong-host>${e("passkeyWrongHost",{origin:s.origin??""})}</div>`:y()?l:r`<div class="lbl" data-pk-unsupported>${e("passkeyUnsupported")}</div>`:r`<div class="lbl" data-pk-unavailable>${e("passkeyUnavailable")}</div>`}
      ${s.credentials.length?r`<ul data-pk-list>
            ${s.credentials.map(t=>r`<li data-pk-item=${t.id}>
              <span>${t.label||e("passkeys")}
                <small>${$(t.created_at)}${t.synced?r` · ${e("passkeySynced")}`:l}${t.last_used_at?r` · ${e("passkeyLastUsed")} ${$(t.last_used_at)}`:l}${t.usable?l:r` · ${e("passkeyNotUsable")}`}</small></span>
              ${this.renaming===t.id?r`<form class="actions" @submit=${b=>{b.preventDefault(),this.rename(t.id)}} data-pk-rename-form>
                    <input type="text" maxlength="40" aria-label=${e("passkeyLabel")} .value=${this.renameValue} ?disabled=${this.busy} data-pk-rename-input
                      @input=${b=>this.renameValue=b.target.value} />
                    <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-rename-save @click=${()=>this.rename(t.id)}>${e("passkeyRenameSave")}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-pk-rename-cancel @click=${()=>this.cancelRow()}>${e("cancel")}</sw-button></form>`:this.armed===t.id?r`<span class="actions"><sw-button size="sm" variant="danger" ?disabled=${this.busy} data-pk-remove-confirm @click=${()=>this.removeOne(t.id)}>${e("passkeyRemove")}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-pk-remove-cancel @click=${()=>this.cancelRow()}>${e("cancel")}</sw-button></span>`:r`<span class="actions"><sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-pk-rename
                      @click=${()=>{this.renaming=t.id,this.renameValue=t.label??"",this.armed=""}}>${e("passkeyRename")}</sw-button>
                    <sw-button size="sm" variant="secondary" ?disabled=${this.busy} data-pk-remove @click=${()=>{this.armed=t.id,this.renaming=""}}>${e("passkeyRemove")}</sw-button></span>`}
            </li>`)}
          </ul>
          ${m?r`<div class="lbl" data-pk-remove-text>${n?e("passkeyRemoveConfirmUser",{name:m.label??""}):e("passkeyRemoveConfirm",{name:m.label??""})}${u?r`<br /><span data-pk-last-factor>${e("passkeyLastFactor")}</span>`:l}</div>`:l}`:r`<div class="lbl" data-pk-empty>${e("passkeyNone")}</div>`}
      ${s.available&&!i&&y()?r`<form @submit=${t=>this.add(t)} data-pk-add-form>
            <input type="text" maxlength="40" aria-label=${e("passkeyLabel")} placeholder=${e("passkeyLabel")} .value=${this.label}
              @input=${t=>this.label=t.target.value} ?disabled=${this.busy} />
            <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-add @click=${t=>this.add(t)}>${this.busy?e("passkeyWaiting"):e("passkeyAdd")}</sw-button>
          </form>`:l}
      ${s.first_allowed&&s.credentials.some(t=>t.usable)?r`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${e("passkeyFirst")} data-pk-first .checked=${s.first_on} ?disabled=${this.busy} @change=${t=>this.first(t)}></sw-toggle>
            <span>${e("passkeyFirst")}<br /><small>${e("passkeyFirstHelp")}</small></span></label>`:l}
      ${s.first_allowed&&s.credentials.some(t=>t.usable)?r`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${f("onlyLabel")} data-pk-only .checked=${!!s.only_on} ?disabled=${this.busy} @change=${t=>this.only(t)}></sw-toggle>
            <span>${f("onlyLabel")}</span></label>`:l}
      ${this.renderNeed(s.available&&!i&&y())}
      ${this.error?r`<div class="err" role="alert" data-pk-error>${this.error}</div>`:l}
      ${this.message?r`<div class="ok" role="status" data-pk-message>${this.message}</div>`:l}
    `}};d.styles=w`
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
