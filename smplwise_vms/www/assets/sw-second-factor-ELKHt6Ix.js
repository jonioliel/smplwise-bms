import{b5 as w,bm as y,br as U,c0 as q,i as g,n as $,ez as t,b as a,A as d,a5 as I,e$ as D,g as S,j as o,ax as x,k as F}from"./index-koYOOmpL.js";import{q as j}from"./qrcode-CWKHzRGU.js";import"./sw-logo-art-PLtEZJxU.js";const z=()=>w("auth/second-factor"),_=()=>y("auth/second-factor/enroll"),E=s=>y("auth/second-factor/confirm",{code:s}),R=s=>y("auth/second-factor/disable",{code:s}),O=()=>w("auth/second-factor/users"),P=(s,e)=>q(`auth/second-factor/users/${encodeURIComponent(s)}`,{method:"DELETE",...e?{headers:{"X-Arx-Second-Factor":e}}:{}}),L=()=>w("auth/second-factor/overrides"),A=(s,e,i)=>U(`auth/second-factor/overrides/${s}/${encodeURIComponent(e)}`,{policy:i});var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,r=(s,e,i,c)=>{for(var n=c>1?void 0:c?T(e,i):e,f=s.length-1,u;f>=0;f--)(u=s[f])&&(n=(c?u(e,i,n):u(n))||n);return c&&n&&M(e,i,n),n};function B(s,e=168){const i=j(0,"M");i.addData(s),i.make();const c=i.getModuleCount(),n=3;let f="";for(let m=0;m<c;m++)for(let v=0;v<c;v++)i.isDark(m,v)&&(f+=`M${v+n} ${m+n}h1v1h-1z`);const u=c+n*2;return I`<svg viewBox="0 0 ${u} ${u}" width=${e} height=${e} role="img" aria-label=${t("secondFactor.qrLabel")} shape-rendering="crispEdges" data-sf-qr>
    <rect width=${u} height=${u} fill="#fff"></rect><path d=${f} fill="#000"></path></svg>`}function C(s){if(!s)return"";const e=new Date(s);return D(e)}const k=S`
  :host {
    display: block;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-block-size: 44px;
  }
  .state {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
  }
  .state small {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 8px 0 4px;
  }
  .qr {
    background: #fff;
    border-radius: var(--sw-r-md);
    padding: 4px;
    line-height: 0;
  }
  .key {
    direction: ltr;
    font-family: var(--sw-font-mono, ui-monospace, monospace);
    font-size: var(--sw-fs-sm);
    letter-spacing: 0.08em;
    word-break: break-all;
    text-align: center;
    user-select: all;
    color: var(--sw-text);
  }
  .lbl {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    text-align: center;
  }
  form {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }
  input {
    inline-size: 9.5em;
    min-block-size: 36px;
    padding: 4px 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-lg);
    letter-spacing: 0.25em;
    text-align: center;
    direction: ltr;
  }
  select {
    min-block-size: 36px;
    padding: 4px 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  input:focus-visible,
  select:focus-visible {
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
`;let h=class extends g{constructor(){super(...arguments),this.status=null,this.enrolment=null,this.disabling=!1,this.code="",this.busy=!1,this.error="",this.message=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.status=await z()}catch(s){this.error=$(s)}}async run(s){this.busy=!0,this.error="";try{await s()}catch(e){this.error=$(e)}finally{this.busy=!1}}start(){this.message="",this.run(async()=>{this.enrolment=await _(),this.code=""})}cancel(){this.enrolment=null,this.disabling=!1,this.code="",this.error=""}submit(s){s.preventDefault();const e=this.code.replace(/\s+/g,"");/^\d{6}$/.test(e)&&this.run(async()=>{this.disabling?(this.status=await R(e),this.message=t("secondFactor.disabledDone")):(this.status=await E(e),this.message=t("secondFactor.enabledDone")),this.enrolment=null,this.disabling=!1,this.code=""})}codeForm(){return a`<form @submit=${this.submit} data-sf-form>
      <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" aria-label=${t("secondFactor.codeLabel")} data-sf-code .value=${this.code}
        @input=${s=>this.code=s.target.value} ?disabled=${this.busy} />
      <sw-button size="sm" variant="primary" data-sf-confirm @click=${s=>this.submit(s)} ?disabled=${this.busy||!/^\d{6}$/.test(this.code.replace(/\s+/g,""))}>${t("secondFactor.confirm")}</sw-button>
      <sw-button size="sm" variant="ghost" data-sf-cancel ?disabled=${this.busy} @click=${()=>this.cancel()}>${t("secondFactor.cancel")}</sw-button>
    </form>`}render(){const s=this.status;return s?a`
      <div class="row">
        <span class="state" data-sf-state>${s.enabled?t("secondFactor.on"):t("secondFactor.off")}${s.enabled&&s.enabled_at?a` <small>${t("secondFactor.since")} ${C(s.enabled_at)}</small>`:d}</span>
        ${this.enrolment||this.disabling?d:s.enabled?a`<sw-button size="sm" variant="secondary" data-sf-disable @click=${()=>{this.disabling=!0,this.message=""}}>${t("secondFactor.disable")}</sw-button>`:a`<sw-button size="sm" variant="primary" data-sf-enable ?disabled=${this.busy} @click=${()=>this.start()}>${t("secondFactor.enable")}</sw-button>`}
      </div>
      ${this.enrolment?a`<div class="box" data-sf-enrolment>
            <div class="lbl">${t("secondFactor.scan")}</div>
            <div class="qr">${B(this.enrolment.otpauth_uri)}</div>
            <div class="lbl">${t("secondFactor.keyLabel")}</div>
            <div class="key" data-sf-key>${this.enrolment.secret.replace(/(.{4})/g,"$1 ").trim()}</div>
            ${this.codeForm()}
          </div>`:this.disabling?a`<div class="box" data-sf-disabling>${this.codeForm()}</div>`:d}
      ${this.error?a`<div class="err" role="alert" data-sf-error>${this.error}</div>`:d}
      ${this.message?a`<div class="ok" role="status" data-sf-message>${this.message}</div>`:d}
    `:this.error?a`<div class="err" role="alert">${this.error}</div>`:d}};h.styles=k;r([o()],h.prototype,"status",2);r([o()],h.prototype,"enrolment",2);r([o()],h.prototype,"disabling",2);r([o()],h.prototype,"code",2);r([o()],h.prototype,"busy",2);r([o()],h.prototype,"error",2);r([o()],h.prototype,"message",2);h=r([F("sw-second-factor")],h);let l=class extends g{constructor(){super(...arguments),this.userId="",this.since=void 0,this.busy=!1,this.armed=!1,this.error="",this.message="",this.stepUp=!1,this.ownCode="",this.seq=0}willUpdate(s){s.has("userId")&&(this.since=void 0,this.armed=!1,this.ownCode="",this.message="",this.load())}async load(){const s=++this.seq;try{const e=await O();if(s!==this.seq)return;const i=e.users.find(c=>c.user_id===this.userId);this.since=i?i.enabled_at??"":null}catch{s===this.seq&&(this.since=null)}}async arm(){this.armed=!0,this.error="",this.ownCode="";try{this.stepUp=(await z()).enabled}catch{this.stepUp=!1}}async reset(){if(!(this.stepUp&&!/^\d{6}$/.test(this.ownCode))){this.busy=!0,this.error="";try{await P(this.userId,this.stepUp?this.ownCode:void 0),this.since=null,this.armed=!1,this.ownCode="",this.message=t("secondFactor.adminResetDone")}catch(s){this.error=$(s)}finally{this.busy=!1}}}render(){return this.since===void 0?d:this.since===null?this.message?a`<div class="ok" role="status" data-sf-message>${this.message}</div>`:a`<span class="state" data-sf-admin-state>${t("secondFactor.off")}</span>`:a`<div class="row" data-sf-admin>
        <span class="state" data-sf-admin-state>${t("secondFactor.on")}${this.since?a` <small>${t("secondFactor.since")} ${C(this.since)}</small>`:d}</span>
        ${this.armed?a`<span><sw-button size="sm" variant="danger" data-sf-admin-confirm ?disabled=${this.busy||this.stepUp&&!/^\d{6}$/.test(this.ownCode)} @click=${()=>void this.reset()}>${t("secondFactor.adminReset")}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.armed=!1}>${t("secondFactor.cancel")}</sw-button></span>`:a`<sw-button size="sm" variant="secondary" data-sf-admin-reset @click=${()=>void this.arm()}>${t("secondFactor.adminReset")}</sw-button>`}
      </div>
      ${this.armed?a`<div class="lbl">${t("secondFactor.adminResetConfirm")}</div>`:d}
      ${this.armed&&this.stepUp?a`<form @submit=${s=>{s.preventDefault(),this.reset()}}>
            <input data-sf-admin-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label=${t("secondFactor.adminStepUp")}
              placeholder="000000" .value=${this.ownCode} @input=${s=>this.ownCode=s.target.value.replace(/\D/g,"").slice(0,6)} />
          </form>
          <div class="lbl">${t("secondFactor.adminStepUp")}</div>`:d}
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:d}`}};l.styles=k;r([x()],l.prototype,"userId",2);r([o()],l.prototype,"since",2);r([o()],l.prototype,"busy",2);r([o()],l.prototype,"armed",2);r([o()],l.prototype,"error",2);r([o()],l.prototype,"message",2);r([o()],l.prototype,"stepUp",2);r([o()],l.prototype,"ownCode",2);l=r([F("sw-second-factor-user")],l);let b=null,p=class extends g{constructor(){super(...arguments),this.kind="user",this.subjectId="",this.value=void 0,this.busy=!1,this.error=""}willUpdate(s){(s.has("subjectId")||s.has("kind"))&&(this.value=void 0,this.load())}async load(){const s=this.kind,e=this.subjectId;try{b??=L();const i=await b;s===this.kind&&e===this.subjectId&&(this.value=i[s][e]??"inherit")}catch{b=null,this.value=void 0}}async change(s){const e=s.target,i=e.value,c=this.value;this.busy=!0,this.error="";try{const n=await A(this.kind,this.subjectId,i);b=Promise.resolve(n),this.value=i}catch(n){this.error=$(n),this.value=c,e.value=c??"inherit"}finally{this.busy=!1}}render(){return this.value===void 0?d:a`<div class="row" data-sf-policy-row>
        <select data-sf-policy-select aria-label=${t("secondFactor.overrideLabel")} ?disabled=${this.busy} @change=${s=>void this.change(s)}>
          ${["inherit","optional","required"].map(s=>a`<option value=${s} ?selected=${this.value===s}>${t(s==="inherit"?"secondFactor.overrideInherit":s==="optional"?"secondFactor.overrideOptional":"secondFactor.overrideRequired")}</option>`)}
        </select>
      </div>
      ${this.error?a`<div class="err" role="alert" data-sf-policy-error>${this.error}</div>`:d}`}};p.styles=k;r([x()],p.prototype,"kind",2);r([x()],p.prototype,"subjectId",2);r([o()],p.prototype,"value",2);r([o()],p.prototype,"busy",2);r([o()],p.prototype,"error",2);p=r([F("sw-second-factor-policy")],p);export{h as SwSecondFactor,p as SwSecondFactorPolicy,l as SwSecondFactorUser,B as qrSvg};
