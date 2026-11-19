import{nv as A,nw as v,nx as a,t as i,g as T,ax as g,j as f,e3 as w,i as L,ny as z,nz as q,nA as I,nB as E,nC as W,nD as $,nE as D,nF as R,nG as B,nH as j,nI as J,A as c,b as r,nJ as u,ez as K,nK as x,nL as H,k as U,nM as V,nN as X,nO as _,nP as Y,nQ as k,nR as Z,nS as G,nT as Q,nU as ee,nV as te,nW as se}from"./index-BdSK43oz.js";import"./sw-second-factor-k-Oi8qqn.js";import"./sw-logo-art-PLtEZJxU.js";import"./qrcode-CWKHzRGU.js";async function p(e,t){let s;try{s=await fetch(e,{...t,credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",...t.headers??{}}})}catch{throw new v("network",a("network"))}const o=await s.json().catch(()=>null);if(!s.ok&&s.status!==202)throw new v(o?.code??`http_${s.status}`,o?.user_message||a("unexpected"),s.status);return{status:s.status,data:o}}async function ae(e,t){const s=await p("api/v1/auth/local/sign-in",{method:"POST",body:JSON.stringify({username:e,password:t})});return s.status===202?{second_factor:"required",...s.data?.methods?{methods:s.data.methods}:{}}:s.data}async function oe(){const e=await p("api/v1/auth/local/sign-in/passkey/options",{method:"POST",body:"{}"}),t=await A(e.data.publicKey);return(await p("api/v1/auth/local/sign-in/passkey",{method:"POST",body:JSON.stringify({credential:t})})).data}async function re(){const e=await p("api/v1/auth/local/passkey/options",{method:"POST",body:"{}"}),t=await A(e.data.publicKey);return(await p("api/v1/auth/local/passkey",{method:"POST",body:JSON.stringify({credential:t})})).data}async function ie(e){return(await p("api/v1/auth/local/sign-in/second-factor",{method:"POST",body:JSON.stringify({code:e.replace(/\s+/g,"")})})).data}async function ne(e,t){return(await p("api/v1/auth/local/set-password",{method:"POST",body:JSON.stringify({token:e,password:t})})).data}async function le(e){await p("api/v1/auth/local/reset/request",{method:"POST",body:JSON.stringify({username:e})})}async function de(e,t,s){return(await p("api/v1/auth/local/reset/confirm",{method:"POST",body:JSON.stringify({username:e,code:t.replace(/[\s-]+/g,""),password:s})})).data}async function ce(e,t,s){await p("api/v1/auth/local/password",{method:"PUT",body:JSON.stringify({current_password:e,new_password:t})})}async function N(){try{const e=await fetch("api/v1/me",{credentials:"same-origin",cache:"no-store"});if(!e.ok)return null;const t=await e.json();return t?.user?.source==="local"?t:null}catch{return null}}function ue(e=window.location.hash){const t=/^#\/welcome\?(?:.*&)?t=([A-Za-z0-9_-]{20,128})(?:&|$)/.exec(e);return t?t[1]:null}function pe(){try{window.history.replaceState(null,"",window.location.pathname+window.location.search)}catch{}}const P="api/v1/auth/app-download/file";function he(e){return!(typeof e!="string"||!e||!/\bAndroid\b/i.test(e)||/iPhone|iPad|iPod|Macintosh|Mac OS X|Windows|CrOS|Windows Phone/i.test(e))}const fe=/^[0-9a-f]{64}$/,we=/^[A-Za-z0-9][A-Za-z0-9._+\- ]{0,31}$/;function be(e){const t=e?.android;if(!t||typeof t!="object"||typeof t.url!="string")return null;const s=t.bundled===!0&&t.url===P;let o;try{o=new URL(t.url,s?typeof document>"u"?"https://arx.invalid/":document.baseURI:void 0)}catch{return null}if(!o.hostname||o.username||o.password||!s&&o.protocol!=="https:"||s&&!o.pathname.endsWith("/"+P))return null;const d=typeof t.version=="string"&&we.test(t.version)?t.version:"",b=typeof t.sha256=="string"&&fe.test(t.sha256)?t.sha256:"",m=s&&typeof t.size=="number"&&Number.isInteger(t.size)&&t.size>0&&t.size<=2**31?t.size:0;return{url:o.href,version:d,sha256:b,size:m,bundled:s}}const O={he:{link:"הורדת אפליקציית Android",version:"גרסה",sha:"SHA-256 לאימות"},en:{link:"Download the Android app",version:"Version",sha:"SHA-256 to verify"}};function me(e){return e>0?`${(e/(1024*1024)).toFixed(1)} MB`:""}function ve(e){return/^en\b/i.test(e??"")?O.en:O.he}async function ge(e=typeof navigator>"u"?"":navigator.userAgent,t=!1,s=(...o)=>fetch(...o)){if(t||!he(e))return null;try{const o=await s("api/v1/auth/app-download",{credentials:"same-origin"});return o.ok?be(await o.json()):null}catch{return null}}var ye=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,l=(e,t,s,o)=>{for(var d=o>1?void 0:o?xe(t,s):t,b=e.length-1,m;b>=0;b--)(m=e[b])&&(d=(o?m(t,s,d):m(d))||d);return o&&d&&ye(t,s,d),d};const M="arx.login.mode";function ke(){try{return window.localStorage.getItem(M)==="local"?"local":"infra"}catch{return"infra"}}const $e={idle:i("ננעלת לאחר חוסר פעילות. יש להיכנס שוב."),expired:i("הכניסה פגה. יש להיכנס שוב."),logout:i("יצאת מ־SmplWise Arx."),everywhere:i("יצאת מ־SmplWise Arx בכל המכשירים."),revoked:i("הכניסה במכשיר הזה נותקה מרשימת הכניסות מרחוק. יש להיכנס שוב.")};let n=class extends L{constructor(){super(...arguments),this.notice="",this.noticeKind="info",this.localEnabled=!1,this.initialMode="",this.passkeyFirst=!1,this.factorMethods=["totp"],this.mode="infra",this.step=z()?"factor":"credentials",this.resetUser="",this.busy=!1,this.error="",this.mfaName="",this.offer=null,this.flow=null}connectedCallback(){super.connectedCallback(),this.stopBrand=q(()=>this.requestUpdate()),I(),this.localEnabled&&(this.mode=this.initialMode||ke())}disconnectedCallback(){this.stopBrand?.(),super.disconnectedCallback()}setMode(e){if(!this.busy){this.mode=e,this.error="";try{window.localStorage.setItem(M,e)}catch{}this.updateComplete.then(()=>this.usernameEl?.focus())}}signedIn(){this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}))}async afterLocal(e){const s=(await N())?.local_identity?.gate??null;if(e||s==="change"){this.step="change";return}if(s==="enrol"){this.step="enrol";return}this.signedIn()}async onLocalCredentials(e,t){await this.run(async()=>{const s=await ae(e,t);if(s.second_factor==="required"){this.factorMethods=s.methods?.length?s.methods:["totp"],this.step="lfactor",await this.updateComplete,this.codeEl?.focus();return}await this.afterLocal(!!s.must_change_password)},!1),this.error&&this.passwordEl&&(this.passwordEl.value="",this.passwordEl.focus())}async onPasskeyFactor(){this.busy||await this.run(async()=>{const e=await oe();await this.afterLocal(!!e.must_change_password)},!1)}async onPasskeySignIn(){this.busy||await this.run(async()=>{const e=await re();await this.afterLocal(!!e.must_change_password)},!1)}async onChange(e){e.preventDefault();const t=this.currentEl?.value??"",s=this.nextEl?.value??"";if(s!==(this.againEl?.value??"")){this.error=a("mismatch");return}await this.run(async()=>{await ce(t,s),await this.afterLocal(!1)},!1)}openForgot(){this.busy||(this.resetUser=this.usernameEl?.value.trim()??"",this.error="",this.notice="",this.step="forgot",this.updateComplete.then(()=>this.runameEl?.focus()))}async onForgot(e){e.preventDefault();const t=this.runameEl?.value.trim()??this.resetUser;if(!t){this.error=a("fillUsername");return}await this.run(async()=>{await le(t),this.resetUser=t,this.step="reset",await this.updateComplete,this.rcodeEl?.focus()},!1)}async onReset(e){e.preventDefault();const t=this.rcodeEl?.value.replace(/[\s-]+/g,"")??"",s=this.nextEl?.value??"";if(!t||!s||!(this.againEl?.value??"")){this.error=a("fillCode");return}if(s!==(this.againEl?.value??"")){this.error=a("mismatch");return}await this.run(async()=>{const o=await de(this.resetUser,t,s);this.step="credentials",this.mode="local",this.noticeKind="info";const d=o.must_enrol?a("resetEnrol"):a("resetDone");await this.updateComplete,this.notice=d,this.usernameEl&&(this.usernameEl.value=this.resetUser),this.passwordEl?.focus()},!1),this.error&&this.rcodeEl&&this.step==="reset"&&this.rcodeEl.select()}firstUpdated(){this.usernameEl?.focus(),ge(navigator.userAgent,E()).then(e=>this.offer=e)}async onCredentials(e){e.preventDefault();const t=this.usernameEl?.value.trim()??"",s=this.passwordEl?.value??"";if(!t||!s){this.error=this.mode==="local"?a("fillBoth"):i("יש למלא שם משתמש וסיסמה.");return}if(this.localEnabled&&this.mode==="local"){await this.onLocalCredentials(t,s);return}await this.run(async()=>{this.flow||(this.flow=(await W()).flow),await this.handle(await $(this.flow,{username:t,password:s}))})}async onCode(e){e.preventDefault();const t=this.codeEl?.value.replace(/\s+/g,"")??"";if(!t){this.error=i("יש להזין את קוד האימות.");return}if(this.step==="lfactor"){await this.run(async()=>{const s=await ie(t);await this.afterLocal(!!s.must_change_password)},!1),this.error&&this.codeEl&&(this.codeEl.value="");return}if(this.step==="factor"){await this.run(async()=>{await D(t),this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}))});return}await this.run(async()=>this.handle(await $(this.flow,{code:t})))}async handle(e){if(e.kind==="done"){try{await R(this.flow,e.code)}catch(t){if(t instanceof v&&t.code==="second_factor_required"){this.step="factor",this.error="",await this.updateComplete,this.codeEl?.focus();return}throw t}this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}));return}if(e.step==="mfa"||e.step==="select_mfa_module"){if(e.step==="select_mfa_module"){await this.handle(await $(this.flow,{}));return}const t=this.step!=="mfa";this.step="mfa",this.mfaName=e.mfaName??"",this.error=t?"":e.error??"",!t&&this.codeEl&&(this.codeEl.value=""),await this.updateComplete,this.codeEl?.focus();return}this.error=e.error??B("invalid_auth"),this.passwordEl&&(this.passwordEl.value="",this.passwordEl.focus())}async run(e,t=!0){this.busy=!0,this.error="",this.notice="";try{await e()}catch(s){if(this.error=s instanceof v?s.message:s instanceof j?a("passkeyCancelled"):i("שגיאה לא צפויה. נסה שוב."),s instanceof v&&s.code==="code_invalid"&&(this.error=a("resetCodeInvalid")),!t){this.step==="lfactor"&&s instanceof v&&["second_factor_expired","second_factor_locked"].includes(s.code)&&(this.step="credentials");return}(!(s instanceof v)||!["network","ha_unavailable","second_factor_invalid"].includes(s.code))&&this.restart(!1)}finally{this.busy=!1}}restart(e=!0){this.mode!=="local"&&(this.step==="factor"||z())&&J(),this.flow=null,this.step="credentials",e&&(this.error="")}renderOffer(){const e=this.offer;if(!e)return c;const t=ve(navigator.language);return r`<div class="app-download" data-arx-android-download-box>
      <a href=${e.url} rel="noopener noreferrer" download data-arx-android-download>${t.link}</a>
      ${e.version?r`<span data-arx-android-version>${t.version} <bdi>${e.version}</bdi>${e.size?r` <bdi data-arx-android-size>(${me(e.size)})</bdi>`:c}</span>`:c}
      ${e.sha256?r`<details data-arx-android-sha><summary>${t.sha}</summary><code>${e.sha256}</code></details>`:c}
    </div>`}render(){const e=this.notice?$e[this.notice]??this.notice:"";return r`<main class="card" aria-labelledby="arx-title">
      ${(()=>{const t=!!(u().files.light||u().files.dark);return r`<div class="lhead" data-arx-brand>
          <sw-brand kind="company" .h=${46} .maxw=${220} data-arx-company-logo></sw-brand>
          ${t?r`<span class="lsep" aria-hidden="true"></span>`:c}
          <sw-brand kind="product" stacked decorative .h=${t?60:84} data-arx-product-logo></sw-brand>
          <span class="sr">SmplWise Arx</span>
          ${u().wl.enabled&&(u().wl.name||u().wl.contact||u().wl.files.light||u().wl.files.dark)?r`<div class="linst" data-arx-installer>
                <sw-brand kind="installer" .h=${30} .maxw=${180} data-arx-installer-logo></sw-brand>
                ${u().wl.name?r`<b data-arx-installer-name>${u().wl.name}</b>`:c}
                ${u().wl.contact?r`<span data-arx-installer-contact>${u().wl.contact}</span>`:c}
              </div>`:c}
          <small>${i("גישה מרחוק מאובטחת")}</small>
        </div>`})()}
      <div>
        <h1 id="arx-title">${this.step==="credentials"?this.localEnabled?a("signInTitle"):i("כניסה"):this.step==="enrol"?a("enrolTitle"):this.step==="change"?a("changeTitle"):this.step==="forgot"||this.step==="reset"?a("forgotTitle"):i("אימות דו־שלבי")}</h1>
        <p class="sub">${this.step==="forgot"?a("forgotSub"):this.step==="reset"?a("resetSub"):this.step==="factor"?K("secondFactor.loginPrompt"):this.step==="lfactor"?this.factorMethods.includes("totp")?a("codePrompt"):a("passkeyUse"):this.step==="enrol"?a("enrolSub"):this.step==="change"?a("changeSub"):this.localEnabled&&this.mode==="local"&&this.step==="credentials"?a("signInSubLocal"):this.step==="mfa"?r`${i("הזן את הקוד מ")}${this.mfaName?r`<bdi>${this.mfaName}</bdi>`:i("אפליקציית האימות")} ${i("שמוגדרת בחשבון שלך.")}`:i("היכנס עם שם המשתמש והסיסמה שלך.")}</p>
      </div>
      ${this.localEnabled&&this.step==="credentials"?r`<div class="modes" role="tablist" data-arx-login-modes>
            <button type="button" role="tab" class="mode ${this.mode==="local"?"on":""}" aria-selected=${this.mode==="local"?"true":"false"} data-arx-mode="local" @click=${()=>this.setMode("local")}>${a("modeLocal")}</button>
            <button type="button" role="tab" class="mode ${this.mode==="infra"?"on":""}" aria-selected=${this.mode==="infra"?"true":"false"} data-arx-mode="infra" @click=${()=>this.setMode("infra")}>${a("modeInfra")}</button>
          </div>`:c}
      ${e&&!this.error?r`<div class="msg ${this.noticeKind==="error"?"error":""}" role="status" data-arx-notice>${e}</div>`:c}
      ${this.error?r`<div class="msg error" role="alert" data-arx-error>${this.error}</div>`:c}
      ${this.step==="enrol"?r`<sw-second-factor data-arx-enrol></sw-second-factor>
            <sw-passkeys data-arx-enrol-passkey></sw-passkeys>
            <button type="button" data-arx-enrol-continue ?disabled=${this.busy} @click=${()=>window.location.reload()}>${a("continue")}</button>`:this.step==="change"?r`<form @submit=${this.onChange} novalidate data-arx-change>
            <label>${a("currentPassword")}<input id="current" class="ltr" type="password" autocomplete="current-password" required ?disabled=${this.busy} /></label>
            <label>${a("newPassword")}<input id="next" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <label>${a("repeatPassword")}<input id="again" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-change-save>${this.busy?a("saving"):a("save")}</button>
          </form>`:this.step==="forgot"?r`<form @submit=${this.onForgot} novalidate data-arx-forgot-form>
            <label>${a("username")}<input id="runame" class="ltr" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" .value=${this.resetUser} required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-send-code>${this.busy?a("sending"):a("sendCode")}</button>
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${a("back")}</button>
          </form>`:this.step==="reset"?r`<form @submit=${this.onReset} novalidate data-arx-reset-form>
            <label>${a("resetCode")}<input id="rcode" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required ?disabled=${this.busy} /></label>
            <label>${a("newPassword")}<input id="next" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <label>${a("repeatPassword")}<input id="again" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-reset-save>${this.busy?a("saving"):a("resetSave")}</button>
            <span class="hint" data-arx-no-code>${a("noCodeHint")}</span>
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.step="forgot"} data-arx-resend>${a("resendCode")}</button>
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${a("back")}</button>
          </form>`:this.step==="credentials"?r`<form @submit=${this.onCredentials} novalidate>
            <label>${i("שם משתמש")}<input id="username" class="ltr" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required ?disabled=${this.busy} /></label>
            <label>${i("סיסמה")}<input id="password" class="ltr" name="password" type="password" autocomplete="current-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-submit>${this.busy?i("מתחבר…"):i("כניסה")}</button>
            ${this.localEnabled&&this.mode==="local"?r`<button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.openForgot()} data-arx-forgot>${a("forgot")}</button>`:c}
            ${this.localEnabled&&this.mode==="local"&&this.passkeyFirst&&x()?r`<span class="hint" aria-hidden="true">${a("passkeyOr")}</span>
                  <button type="button" class="secondary" ?disabled=${this.busy} @click=${()=>void this.onPasskeySignIn()} data-arx-passkey-signin>${this.busy?a("passkeyWaiting"):a("passkeySignIn")}</button>`:c}
          </form>`:this.step==="lfactor"&&!this.factorMethods.includes("totp")?r`<div class="passkey-only" data-arx-passkey-only>
            <button type="button" ?disabled=${this.busy||!x()} @click=${()=>void this.onPasskeyFactor()} data-arx-passkey-factor>${this.busy?a("passkeyWaiting"):a("passkeyUse")}</button>
            ${x()?c:r`<span class="hint">${a("passkeyUnsupported")}</span>`}
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${a("back")}</button>
          </div>`:r`<form @submit=${this.onCode} novalidate>
            <label>${i("קוד אימות")}<input id="code" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-verify>${this.busy?i("בודק…"):i("אימות")}</button>
            ${this.step==="lfactor"&&this.factorMethods.includes("passkey")&&x()?r`<button type="button" class="secondary" ?disabled=${this.busy} @click=${()=>void this.onPasskeyFactor()} data-arx-passkey-factor>${a("passkeyUse")}</button>`:c}
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${i("חזרה לכניסה")}</button>
          </form>`}
      <div class="foot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
        <span>${this.localEnabled&&this.mode==="local"?a("footLocal"):i("הסיסמה נבדקת מול תשתית המערכת ואינה נשמרת ב־Arx; ההרשאות שלך זהות להרשאותיך במערכת.")}</span>
      </div>
      ${this.renderOffer()}
      ${E()?r`<div class="app-servers"><button type="button" class="link" data-arx-switch-server @click=${()=>H()}>${i("החלף שרת")}</button></div>`:c}
    </main>`}};n.styles=T`
    :host {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      /* standalone (installed) iOS/Android: keep the card clear of the notch, status bar and home indicator */
      padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
      overflow: auto;
      box-sizing: border-box;
      font-family: var(--sw-font);
      color: var(--sw-text);
      background:
        radial-gradient(1200px 600px at 85% -10%, color-mix(in srgb, var(--sw-accent) 16%, transparent), transparent 60%),
        radial-gradient(900px 500px at 0% 110%, color-mix(in srgb, var(--sw-accent) 10%, transparent), transparent 60%),
        var(--sw-bg);
    }
    /* R5-SYSTEM-297: the card is the hero of the page - wider, deeper (shadow 3 + the light line), a 26/800 title, 48 px wells for the
       fields and a 48 px primary key; it materialises once (240 ms ease-out, fade + 10 px rise; a cross-fade under reduced motion) */
    .card {
      inline-size: min(420px, 100%);
      box-sizing: border-box;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-2xl, 22px);
      box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight);
      padding: 32px 28px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      animation: login-in 240ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1)) both;
    }
    @keyframes login-in {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.985);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .card {
        animation: login-fade 160ms ease both;
      }
      @keyframes login-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    }
    /* LOGOS-295 (mockup v3.1): BOTH logos in the card head, centred - the company's on top (when one is set), the SmplWise logo below;
       with no company logo the SmplWise logo alone, larger. The sizes follow the administrator's scale (sw-brand). */
    .lhead {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding-block-end: 4px;
    }
    .lhead .lsep {
      inline-size: 56px;
      block-size: 1px;
      background: var(--sw-border-strong);
    }
    .linst {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      max-inline-size: 100%;
      text-align: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .linst b {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
      unicode-bidi: plaintext;
    }
    .linst span {
      overflow-wrap: anywhere;
      unicode-bidi: plaintext;
    }
    .lhead small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .sub {
      margin: 6px 0 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    /* a field is a well (surface-2, no resting outline); the accent ring appears on focus */
    input {
      font: inherit;
      font-size: max(16px, var(--sw-fs-lg)); /* no zoom-on-focus on iOS */
      min-block-size: 48px;
      padding: 8px 14px;
      border-radius: var(--sw-r-md);
      border: 1px solid transparent;
      /* loop 2: the well is a real step down from the card (surface-2 pulled toward the border tone), so an empty field reads as a field */
      background: color-mix(in srgb, var(--sw-surface-2, var(--sw-surface)) 76%, var(--sw-border));
      color: var(--sw-text);
      box-sizing: border-box;
      inline-size: 100%;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-border-strong) 60%, transparent);
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color);
    }
    input:focus-visible {
      outline: none;
      border-color: var(--sw-accent);
      background: var(--sw-surface);
      /* the same focus as every field of the product (sw-field): the accent outline and a soft halo */
      box-shadow: 0 0 0 3px var(--sw-accent-soft), 0 0 0 1px var(--sw-accent);
    }
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    input.code {
      letter-spacing: 0.4em;
      text-align: center;
      font-size: var(--sw-fs-3xl);
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    button {
      font: inherit;
      min-block-size: 48px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      letter-spacing: -0.005em;
      cursor: pointer;
      box-shadow: var(--sw-shadow-primary);
      transition: background var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    button:not(.link):active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
      background: var(--sw-accent-hover, var(--sw-accent));
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--sw-accent-hover, var(--sw-accent));
      }
    }
    button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    button.link {
      background: none;
      border: 0;
      color: var(--sw-accent-text, var(--sw-accent));
      min-block-size: 32px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      align-self: center;
      box-shadow: none;
    }
    .msg {
      border-radius: var(--sw-r-md);
      padding: 12px 14px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      line-height: 1.5;
      background: var(--sw-accent-soft);
      color: var(--sw-text);
    }
    .msg.error {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 30%, transparent);
    }
    .foot {
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 12px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      line-height: 1.5;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .foot svg {
      flex: none;
      margin-block-start: 1px;
    }
    /* a link-style button never takes the primary buttons' hover fill (a touch leaves :hover behind on phones,
       which turned "החלף שרת" into a blue block with invisible text - seen in the Android app) */
    button.link:hover:not(:disabled) {
      background: none;
      text-decoration: underline;
    }
    .app-download {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      margin-block-start: -8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .app-download a {
      color: var(--sw-accent-text, var(--sw-accent));
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      min-block-size: 32px;
      display: inline-flex;
      align-items: center;
    }
    .app-download details summary {
      cursor: pointer;
    }
    .app-download code {
      direction: ltr;
      display: block;
      word-break: break-all;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      user-select: all;
    }
    .modes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-bg));
      border: 1px solid transparent;
    }
    button.mode {
      background: none;
      border: 0;
      color: var(--sw-text-2);
      min-block-size: 40px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      box-shadow: none;
    }
    button.mode.on {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-heading, var(--sw-text)));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-2, none));
    }
    button.mode:hover:not(:disabled):not(.on) {
      background: none;
      color: var(--sw-text);
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      line-height: 1.5;
    }
    .app-servers {
      display: flex;
      justify-content: center;
      margin-block-start: -8px;
    }
    /* USR2 phase 4: the passkey buttons sit under the primary action */
    button.secondary {
      background: var(--sw-surface);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    button.secondary:hover:not(:disabled) {
      /* loop 2: the well is a real step down from the card (surface-2 pulled toward the border tone), so an empty field reads as a field */
      background: color-mix(in srgb, var(--sw-surface-2, var(--sw-surface)) 76%, var(--sw-border));
    }
    .passkey-only {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    form > .hint[aria-hidden] {
      text-align: center;
    }
  `;l([g()],n.prototype,"notice",2);l([g()],n.prototype,"noticeKind",2);l([g({type:Boolean})],n.prototype,"localEnabled",2);l([g()],n.prototype,"initialMode",2);l([g({type:Boolean})],n.prototype,"passkeyFirst",2);l([f()],n.prototype,"factorMethods",2);l([f()],n.prototype,"mode",2);l([f()],n.prototype,"step",2);l([f()],n.prototype,"resetUser",2);l([f()],n.prototype,"busy",2);l([f()],n.prototype,"error",2);l([f()],n.prototype,"mfaName",2);l([f()],n.prototype,"offer",2);l([w("#username")],n.prototype,"usernameEl",2);l([w("#password")],n.prototype,"passwordEl",2);l([w("#code")],n.prototype,"codeEl",2);l([w("#current")],n.prototype,"currentEl",2);l([w("#next")],n.prototype,"nextEl",2);l([w("#again")],n.prototype,"againEl",2);l([w("#rcode")],n.prototype,"rcodeEl",2);l([w("#runame")],n.prototype,"runameEl",2);n=l([U("arx-login")],n);var Ee=Object.defineProperty,Se=Object.getOwnPropertyDescriptor,y=(e,t,s,o)=>{for(var d=o>1?void 0:o?Se(t,s):t,b=e.length-1,m;b>=0;b--)(m=e[b])&&(d=(o?m(t,s,d):m(d))||d);return o&&d&&Ee(t,s,d),d};let h=class extends L{constructor(){super(...arguments),this.token="",this.enabled=!0,this.minLength=12,this.busy=!1,this.error=""}firstUpdated(){pe(),this.pwEl?.focus()}async onSubmit(e){e.preventDefault();const t=this.pwEl?.value??"";if(t!==(this.againEl?.value??"")){this.error=a("mismatch");return}this.busy=!0,this.error="";try{const s=await ne(this.token,t);this.dispatchEvent(new CustomEvent("arx-password-set",{detail:{mustEnrol:s.must_enrol},bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof v?s.message:a("unexpected")}finally{this.busy=!1}}render(){const e=this.enabled&&!!this.token;return r`<main class="card" aria-labelledby="w-title" data-arx-welcome>
      <h1 id="w-title">${a("welcomeTitle")}</h1>
      <p>${this.enabled?this.token?a("welcomeSub",{min:this.minLength}):a("welcomeNoToken"):a("welcomeOff")}</p>
      ${this.error?r`<div class="msg" role="alert" data-arx-welcome-error>${this.error}</div>`:c}
      ${e?r`<form @submit=${this.onSubmit} novalidate>
            <label>${a("newPassword")}<input id="pw" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <label>${a("repeatPassword")}<input id="again" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-welcome-save>${this.busy?a("saving"):a("setPassword")}</button>
          </form>`:c}
    </main>`}};h.styles=T`
    :host {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));
      overflow: auto;
      box-sizing: border-box;
      font-family: var(--sw-font);
      color: var(--sw-text);
      background:
        radial-gradient(1200px 600px at 85% -10%, color-mix(in srgb, var(--sw-accent) 16%, transparent), transparent 60%),
        var(--sw-bg);
    }
    .card {
      inline-size: min(400px, 100%);
      box-sizing: border-box;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      padding: 28px 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    p {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    input {
      font: inherit;
      font-size: var(--sw-fs-lg);
      min-block-size: 44px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      box-sizing: border-box;
      inline-size: 100%;
      direction: ltr;
      text-align: start;
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    button {
      font: inherit;
      min-block-size: 44px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    .msg {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
  `;y([g()],h.prototype,"token",2);y([g({type:Boolean})],h.prototype,"enabled",2);y([g({type:Number})],h.prototype,"minLength",2);y([f()],h.prototype,"busy",2);y([f()],h.prototype,"error",2);y([w("#pw")],h.prototype,"pwEl",2);y([w("#again")],h.prototype,"againEl",2);h=y([U("arx-welcome")],h);function ze(){"serviceWorker"in navigator&&navigator.serviceWorker.register("arx-sw.js",{scope:"./"}).catch(()=>{})}let C=!1;async function S(){C||(C=!0,document.documentElement.setAttribute("data-channel","remote"),Z(async()=>{const e=await ee();return e||window.location.reload(),e}),G(e=>{te(se(e)),window.location.reload()}),Q())}function F(e,t,s=""){const o=document.createElement("arx-login");o.notice=e,o.noticeKind=t,o.localEnabled=!!k().local_identity,o.initialMode=s,o.passkeyFirst=!!k().local_passkey_first,o.addEventListener("arx-signed-in",()=>{o.remove(),S()}),document.body.appendChild(o)}function _e(e){const t=k(),s=document.createElement("arx-welcome");s.token=e,s.enabled=!!t.local_identity,s.minLength=t.local_password_min??12,s.addEventListener("arx-password-set",o=>{s.remove(),F(a(o.detail.mustEnrol?"welcomeEnrol":"welcomeDone"),"info","local")}),document.body.appendChild(s)}async function Te(){E(),ze(),await V();const e=ue();if(e!==null||window.location.hash.startsWith("#/welcome")){_e(e??"");return}X();let t=_()??"",s="info";try{if(await Y()){await S();return}if(k().local_identity){const o=await N();if(o&&!o.local_identity?.gate){await S();return}}t=_()??t}catch(o){t=o instanceof v?o.message:"",s="error"}F(t,s)}export{Te as bootRemote};
