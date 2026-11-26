import{E as R,nq as u,t as l,j as q,z as g,k as h,e3 as w,a as W,nr as z,ns as O,nt as M,nu as A,nv as j,nw as X,nx as J,ny as K,D as V,nz as P,nA as Y,nB as S,nC as Z,nD as G,nE as C,nF as Q,n as T,nG as ee,x as v,A as d,o as E,v as k,b as r,nH as p,nI as te,m as H,nJ as se,nK as ae,nL as L,nM as oe,nN as $,nO as re,nP as ie,nQ as ne,nR as le,nS as de,nT as ce}from"./index-C0HbI5eb.js";import{l as a}from"./local-identity-BnkC12Vm.js";import"./sw-second-factor-C_8EFW8w.js";import"./sw-passkeys-RctsndWp.js";import"./sw-logo-art-PLtEZJxU.js";import"./qrcode-CWKHzRGU.js";import"./second-factor-CA0QZqPj.js";import"./passkey-only-Bw1zOWNY.js";import"./step-up-passkey-BPBHQBez.js";import"./confirm-dialog-CEi4gaw7.js";async function f(e,t){let s;try{s=await fetch(e,{...t,credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",...t.headers??{}}})}catch{throw new u("network",a("network"))}const o=await s.json().catch(()=>null);if(!s.ok&&s.status!==202)throw new u(o?.code??`http_${s.status}`,o?.user_message||a("unexpected"),s.status);return{status:s.status,data:o}}async function he(e,t){const s=await f("api/v1/auth/local/sign-in",{method:"POST",body:JSON.stringify({username:e,password:t})});return s.status===202?{second_factor:"required",...s.data?.methods?{methods:s.data.methods}:{}}:s.data}async function pe(){const e=await f("api/v1/auth/local/sign-in/passkey/options",{method:"POST",body:"{}"}),t=await R(e.data.publicKey);return(await f("api/v1/auth/local/sign-in/passkey",{method:"POST",body:JSON.stringify({credential:t})})).data}async function ue(){const e=await f("api/v1/auth/local/passkey/options",{method:"POST",body:"{}"}),t=await R(e.data.publicKey);return(await f("api/v1/auth/local/passkey",{method:"POST",body:JSON.stringify({credential:t})})).data}async function fe(e){return(await f("api/v1/auth/local/sign-in/second-factor",{method:"POST",body:JSON.stringify({code:e.replace(/\s+/g,"")})})).data}async function be(e,t){return(await f("api/v1/auth/local/set-password",{method:"POST",body:JSON.stringify({token:e,password:t})})).data}async function we(e){await f("api/v1/auth/local/reset/request",{method:"POST",body:JSON.stringify({username:e})})}async function me(e,t,s){return(await f("api/v1/auth/local/reset/confirm",{method:"POST",body:JSON.stringify({username:e,code:t.replace(/[\s-]+/g,""),password:s})})).data}async function ye(e,t,s){await f("api/v1/auth/local/password",{method:"PUT",body:JSON.stringify({current_password:e,new_password:t})})}async function I(){try{const e=await fetch("api/v1/me",{credentials:"same-origin",cache:"no-store"});if(!e.ok)return null;const t=await e.json();return t?.user?.source==="local"?t:null}catch{return null}}function ve(e=window.location.hash){const t=/^#\/welcome\?(?:.*&)?t=([A-Za-z0-9_-]{20,128})(?:&|$)/.exec(e);return t?t[1]:null}function ge(){try{window.history.replaceState(null,"",window.location.pathname+window.location.search)}catch{}}const F="api/v1/auth/app-download/file";function xe(e){return!(typeof e!="string"||!e||!/\bAndroid\b/i.test(e)||/iPhone|iPad|iPod|Macintosh|Mac OS X|Windows|CrOS|Windows Phone/i.test(e))}const ke=/^[0-9a-f]{64}$/,$e=/^[A-Za-z0-9][A-Za-z0-9._+\- ]{0,31}$/;function Ee(e){const t=e?.android;if(!t||typeof t!="object"||typeof t.url!="string")return null;const s=t.bundled===!0&&t.url===F;let o;try{o=new URL(t.url,s?typeof document>"u"?"https://arx.invalid/":document.baseURI:void 0)}catch{return null}if(!o.hostname||o.username||o.password||!s&&o.protocol!=="https:"||s&&!o.pathname.endsWith("/"+F))return null;const c=typeof t.version=="string"&&$e.test(t.version)?t.version:"",m=typeof t.sha256=="string"&&ke.test(t.sha256)?t.sha256:"",y=s&&typeof t.size=="number"&&Number.isInteger(t.size)&&t.size>0&&t.size<=2**31?t.size:0;return{url:o.href,version:c,sha256:m,size:y,bundled:s}}const U={he:{link:"הורדת אפליקציית Android",version:"גרסה",sha:"SHA-256 לאימות"},en:{link:"Download the Android app",version:"Version",sha:"SHA-256 to verify"}};function Se(e){return e>0?`${(e/(1024*1024)).toFixed(1)} MB`:""}function Ce(e){return/^en\b/i.test(e??"")?U.en:U.he}async function Pe(e=typeof navigator>"u"?"":navigator.userAgent,t=!1,s=(...o)=>fetch(...o)){if(t||!xe(e))return null;try{const o=await s("api/v1/auth/app-download",{credentials:"same-origin"});return o.ok?Ee(await o.json()):null}catch{return null}}var _e=Object.defineProperty,ze=Object.getOwnPropertyDescriptor,n=(e,t,s,o)=>{for(var c=o>1?void 0:o?ze(t,s):t,m=e.length-1,y;m>=0;m--)(y=e[m])&&(c=(o?y(t,s,c):y(c))||c);return o&&c&&_e(t,s,c),c};const D="arx.login.mode";function Oe(){try{return window.localStorage.getItem(D)==="local"?"local":"infra"}catch{return"infra"}}const Me={idle:l("ננעלת לאחר חוסר פעילות. יש להיכנס שוב."),expired:l("הכניסה פגה. יש להיכנס שוב."),logout:l("יצאת מ־SmplWise Arx."),everywhere:l("יצאת מ־SmplWise Arx בכל המכשירים."),revoked:l("הכניסה במכשיר הזה נותקה מרשימת הכניסות מרחוק. יש להיכנס שוב.")};let i=class extends W{constructor(){super(...arguments),this.notice="",this.noticeKind="info",this.localEnabled=!1,this.initialMode="",this.passkeyFirst=!1,this.recoveryReenrol=!1,this.factorMethods=["totp"],this.mode="infra",this.step=C()?"henrol":z()?"factor":"credentials",this.resetUser="",this.busy=!1,this.error="",this.mfaName="",this.recoveryCode=!1,this.passkeyChosen=!1,this.haMethods=O(),this.haPasskeyOrigin=M(),this.enrolOrigin=A(),this.offer=null,this.flow=null}connectedCallback(){super.connectedCallback(),this.stopBrand=j(()=>this.requestUpdate()),X(),this.localEnabled&&(this.mode=this.initialMode||Oe())}disconnectedCallback(){this.stopBrand?.(),super.disconnectedCallback()}setMode(e){if(!this.busy){this.mode=e,this.error="";try{window.localStorage.setItem(D,e)}catch{}this.updateComplete.then(()=>this.usernameEl?.focus())}}signedIn(){this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}))}async afterLocal(e){const s=(await I())?.local_identity?.gate??null;if(e||s==="change"){this.step="change";return}if(s==="enrol"){this.step="enrol";return}this.signedIn()}async onLocalCredentials(e,t){await this.run(async()=>{const s=await he(e,t);if(s.second_factor==="required"){this.factorMethods=s.methods?.length?s.methods:["totp"],this.step="lfactor",await this.updateComplete,this.codeEl?.focus();return}await this.afterLocal(!!s.must_change_password)},!1),this.error&&this.passwordEl&&(this.passwordEl.value="",this.passwordEl.focus())}async onPasskeyFactor(){this.busy||await this.run(async()=>{const e=await pe();await this.afterLocal(!!e.must_change_password)},!1)}async onHaPasskeyFactor(){this.busy||await this.run(async()=>{await J(),this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}))})}async onEnrolPasskey(){this.busy||await this.run(async()=>{await K(),this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}))})}enrolHere(){if(!this.enrolOrigin)return!1;try{const e=new URL(this.enrolOrigin);return e.origin===window.location.origin&&V(e.hostname,window.location.hostname)}catch{return!1}}async onPasskeySignIn(){this.busy||await this.run(async()=>{const e=await ue();await this.afterLocal(!!e.must_change_password)},!1)}async onChange(e){e.preventDefault();const t=this.currentEl?.value??"",s=this.nextEl?.value??"";if(s!==(this.againEl?.value??"")){this.error=a("mismatch");return}await this.run(async()=>{await ye(t,s),await this.afterLocal(!1)},!1)}openForgot(){this.busy||(this.resetUser=this.usernameEl?.value.trim()??"",this.error="",this.notice="",this.step="forgot",this.updateComplete.then(()=>this.runameEl?.focus()))}async onForgot(e){e.preventDefault();const t=this.runameEl?.value.trim()??this.resetUser;if(!t){this.error=a("fillUsername");return}await this.run(async()=>{await we(t),this.resetUser=t,this.step="reset",await this.updateComplete,this.rcodeEl?.focus()},!1)}async onReset(e){e.preventDefault();const t=this.rcodeEl?.value.replace(/[\s-]+/g,"")??"",s=this.nextEl?.value??"";if(!t||!s||!(this.againEl?.value??"")){this.error=a("fillCode");return}if(s!==(this.againEl?.value??"")){this.error=a("mismatch");return}await this.run(async()=>{const o=await me(this.resetUser,t,s);this.step="credentials",this.mode="local",this.noticeKind="info";const c=o.must_enrol?a("resetEnrol"):a("resetDone");await this.updateComplete,this.notice=c,this.usernameEl&&(this.usernameEl.value=this.resetUser),this.passwordEl?.focus()},!1),this.error&&this.rcodeEl&&this.step==="reset"&&this.rcodeEl.select()}firstUpdated(){this.usernameEl?.focus(),Pe(navigator.userAgent,P()).then(e=>this.offer=e)}async onCredentials(e){e.preventDefault();const t=this.usernameEl?.value.trim()??"",s=this.passwordEl?.value??"";if(!t||!s){this.error=this.mode==="local"?a("fillBoth"):l("יש למלא שם משתמש וסיסמה.");return}if(this.localEnabled&&this.mode==="local"){await this.onLocalCredentials(t,s);return}await this.run(async()=>{this.flow||(this.flow=(await Y()).flow),await this.handle(await S(this.flow,{username:t,password:s}))})}async onCode(e){e.preventDefault();const t=this.codeEl?.value.replace(/\s+/g,"")??"";if(!t){this.error=l("יש להזין את קוד האימות.");return}if(this.step==="lfactor"){const s=this.recoveryCode;await this.run(async()=>{const o=await fe(t);if(s&&this.recoveryReenrol&&!o.must_change_password){this.step="enrol";return}await this.afterLocal(!!o.must_change_password)},!1),this.error&&this.codeEl&&(this.codeEl.value="");return}if(this.step==="factor"){const s=this.recoveryCode;await this.run(async()=>{if(await Z(t),s&&this.recoveryReenrol){this.step="enrol";return}this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}))});return}await this.run(async()=>this.handle(await S(this.flow,{code:t})))}async handle(e){if(e.kind==="done"){try{await G(this.flow,e.code)}catch(t){if(t instanceof u&&t.code==="second_factor_required"){this.haMethods=O(),this.haPasskeyOrigin=M(),this.step="factor",this.error="",await this.updateComplete,this.codeEl?.focus();return}if(t instanceof u&&t.code==="second_factor_enrollment_required"&&C()){this.enrolOrigin=A(),this.step="henrol",this.error="",await this.updateComplete,this.renderRoot.querySelector("[data-arx-enrol-passkey-create]")?.focus();return}throw t}this.dispatchEvent(new CustomEvent("arx-signed-in",{bubbles:!0,composed:!0}));return}if(e.step==="mfa"||e.step==="select_mfa_module"){if(e.step==="select_mfa_module"){await this.handle(await S(this.flow,{}));return}const t=this.step!=="mfa";this.step="mfa",this.mfaName=e.mfaName??"",this.error=t?"":e.error??"",!t&&this.codeEl&&(this.codeEl.value=""),await this.updateComplete,this.codeEl?.focus();return}this.error=e.error??Q("invalid_auth"),this.passwordEl&&(this.passwordEl.value="",this.passwordEl.focus())}async run(e,t=!0){this.busy=!0,this.error="",this.notice="";try{await e()}catch(s){if(this.error=s instanceof u?s.message:s instanceof T?a("passkeyCancelled"):l("שגיאה לא צפויה. נסה שוב."),s instanceof u&&s.code==="code_invalid"&&(this.error=a("resetCodeInvalid")),!t){this.step==="lfactor"&&s instanceof u&&["second_factor_expired","second_factor_locked"].includes(s.code)&&(this.step="credentials");return}if(s instanceof T||this.step==="henrol"&&s instanceof u&&s.code==="second_factor_enrollment_required"&&C())return;(!(s instanceof u)||!["network","ha_unavailable","second_factor_invalid","passkey_not_offered"].includes(s.code))&&this.restart(!1)}finally{this.busy=!1}}restart(e=!0){this.mode!=="local"&&(this.step==="factor"||this.step==="henrol"||z())&&ee(),this.flow=null,this.step="credentials",this.recoveryCode=!1,this.passkeyChosen=!1,this.haMethods=["totp"],this.haPasskeyOrigin=null,this.enrolOrigin=null,e&&(this.error="")}haPasskeyHere(){return this.haMethods.includes("passkey")&&!!this.haPasskeyOrigin&&this.haPasskeyOrigin===window.location.origin}haPasskeyOnly(){return this.step==="factor"&&this.haMethods.includes("passkey")&&!this.haMethods.includes("totp")}methods(){if(this.step==="factor")return this.haMethods.includes("passkey")?this.haMethods.includes("totp")?["totp",...v()&&this.haPasskeyHere()?["passkey"]:[],"recovery"]:[]:["totp","recovery"];if(this.step!=="lfactor")return[];const e=this.factorMethods.includes("totp");return[...e?["totp"]:[],...this.factorMethods.includes("passkey")&&v()?["passkey"]:[],...e?["recovery"]:[]]}async chooseMethod(e){this.passkeyChosen=e==="passkey",this.recoveryCode=e==="recovery",this.error="",this.codeEl&&(this.codeEl.value=""),await this.updateComplete,e==="passkey"?this.renderRoot.querySelector("[data-arx-passkey-factor]")?.focus():this.codeEl?.focus()}renderMethods(){const e=this.methods();if(e.length<2)return d;const t=this.passkeyChosen?"passkey":this.recoveryCode?"recovery":"totp",s={totp:e.length>2?k("אפליקציה"):k("קוד מהאפליקציה"),passkey:k("מפתח גישה"),recovery:E("secondFactor.recoveryCodeLabel")};return r`<div class="modes methods n${e.length}" role="group" aria-label=${k("דרך האימות")} data-arx-methods>
      ${e.map(o=>r`<button type="button" class="mode ${o===t?"on":""}" aria-pressed=${o===t?"true":"false"} ?disabled=${this.busy}
        data-arx-method=${o} @click=${()=>void this.chooseMethod(o)}>${s[o]}</button>`)}
    </div>`}renderOffer(){const e=this.offer;if(!e)return d;const t=Ce(navigator.language);return r`<div class="app-download" data-arx-android-download-box>
      <a href=${e.url} rel="noopener noreferrer" download data-arx-android-download>${t.link}</a>
      ${e.version?r`<span data-arx-android-version>${t.version} <bdi>${e.version}</bdi>${e.size?r` <bdi data-arx-android-size>(${Se(e.size)})</bdi>`:d}</span>`:d}
      ${e.sha256?r`<details data-arx-android-sha><summary>${t.sha}</summary><code>${e.sha256}</code></details>`:d}
    </div>`}render(){const e=this.notice?Me[this.notice]??this.notice:"";return r`<main class="card" aria-labelledby="arx-title">
      ${(()=>{const t=!!(p().files.light||p().files.dark);return r`<div class="lhead" data-arx-brand>
          <sw-brand kind="company" .h=${46} .maxw=${220} data-arx-company-logo></sw-brand>
          ${t?r`<span class="lsep" aria-hidden="true"></span>`:d}
          <sw-brand kind="product" stacked decorative .h=${t?60:84} data-arx-product-logo></sw-brand>
          <span class="sr">SmplWise Arx</span>
          ${p().wl.enabled&&(p().wl.name||p().wl.contact||p().wl.files.light||p().wl.files.dark)?r`<div class="linst" data-arx-installer>
                <sw-brand kind="installer" .h=${30} .maxw=${180} data-arx-installer-logo></sw-brand>
                ${p().wl.name?r`<b data-arx-installer-name>${p().wl.name}</b>`:d}
                ${p().wl.contact?r`<span data-arx-installer-contact>${p().wl.contact}</span>`:d}
              </div>`:d}
          <small>${l("גישה מרחוק מאובטחת")}</small>
        </div>`})()}
      <div>
        <h1 id="arx-title">${this.step==="credentials"?this.localEnabled?a("signInTitle"):l("כניסה"):this.step==="enrol"?a("enrolTitle"):this.step==="change"?a("changeTitle"):this.step==="forgot"||this.step==="reset"?a("forgotTitle"):l("אימות דו־שלבי")}</h1>
        <p class="sub">${this.step==="forgot"?a("forgotSub"):this.step==="reset"?a("resetSub"):(this.step==="factor"||this.step==="lfactor")&&this.recoveryCode?E("secondFactor.recoveryLoginPrompt"):this.step==="factor"?this.passkeyChosen||this.haPasskeyOnly()?a("passkeyUse"):E("secondFactor.loginPrompt"):this.step==="lfactor"?this.factorMethods.includes("totp")&&!this.passkeyChosen?a("codePrompt"):a("passkeyUse"):this.step==="enrol"?a("enrolSub"):this.step==="henrol"?k("מנהל המערכת דורש אימות דו־שלבי לחשבון הזה. אפשר להוסיף עכשיו מפתח גישה במכשיר הזה, והוא ישמש לאימות בכניסות הבאות."):this.step==="change"?a("changeSub"):this.localEnabled&&this.mode==="local"&&this.step==="credentials"?a("signInSubLocal"):this.step==="mfa"?r`${l("הזן את הקוד מ")}${this.mfaName?r`<bdi>${this.mfaName}</bdi>`:l("אפליקציית האימות")} ${l("שמוגדרת בחשבון שלך.")}`:l("היכנס עם שם המשתמש והסיסמה שלך.")}</p>
      </div>
      ${this.localEnabled&&this.step==="credentials"?r`<div class="modes" role="tablist" data-arx-login-modes>
            <button type="button" role="tab" class="mode ${this.mode==="local"?"on":""}" aria-selected=${this.mode==="local"?"true":"false"} data-arx-mode="local" @click=${()=>this.setMode("local")}>${a("modeLocal")}</button>
            <button type="button" role="tab" class="mode ${this.mode==="infra"?"on":""}" aria-selected=${this.mode==="infra"?"true":"false"} data-arx-mode="infra" @click=${()=>this.setMode("infra")}>${a("modeInfra")}</button>
          </div>`:d}
      ${e&&!this.error?r`<div class="msg ${this.noticeKind==="error"?"error":""}" role="status" data-arx-notice>${e}</div>`:d}
      ${this.error?r`<div class="msg error" role="alert" data-arx-error>${this.error}</div>`:d}
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
            <label>${l("שם משתמש")}<input id="username" class="ltr" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required ?disabled=${this.busy} /></label>
            <label>${l("סיסמה")}<input id="password" class="ltr" name="password" type="password" autocomplete="current-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-submit>${this.busy?l("מתחבר…"):l("כניסה")}</button>
            ${this.localEnabled&&this.mode==="local"?r`<button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.openForgot()} data-arx-forgot>${a("forgot")}</button>`:d}
            ${this.localEnabled&&this.mode==="local"&&this.passkeyFirst&&v()?r`<span class="hint" aria-hidden="true">${a("passkeyOr")}</span>
                  <button type="button" class="secondary" ?disabled=${this.busy} @click=${()=>void this.onPasskeySignIn()} data-arx-passkey-signin>${this.busy?a("passkeyWaiting"):a("passkeySignIn")}</button>`:d}
          </form>`:this.step==="lfactor"&&!this.factorMethods.includes("totp")||this.step==="lfactor"&&this.passkeyChosen?r`${this.renderMethods()}<div class="passkey-only" data-arx-passkey-only>
            <button type="button" ?disabled=${this.busy||!v()} @click=${()=>void this.onPasskeyFactor()} data-arx-passkey-factor>${this.busy?a("passkeyWaiting"):a("passkeyUse")}</button>
            ${v()?d:r`<span class="hint">${a("passkeyUnsupported")}</span>`}
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${a("back")}</button>
          </div>`:this.step==="henrol"?r`<div class="passkey-only" data-arx-passkey-only data-arx-ha-enrol>
            <button type="button" ?disabled=${this.busy||!v()||!this.enrolHere()} @click=${()=>void this.onEnrolPasskey()} data-arx-enrol-passkey-create>${this.busy?a("passkeyWaiting"):k("הוספת מפתח גישה וכניסה")}</button>
            ${v()?this.enrolHere()?d:r`<span class="hint" data-arx-passkey-wrong-host>${a("passkeyWrongHost",{origin:this.enrolOrigin??""})}</span>`:r`<span class="hint">${a("passkeyUnsupported")}</span>`}
            <span class="hint" data-arx-enrol-other>${k("אפשר גם להפעיל אפליקציית אימות ב״החשבון שלי״ בכניסה מהרשת המקומית.")}</span>
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${a("back")}</button>
          </div>`:this.haPasskeyOnly()||this.step==="factor"&&this.passkeyChosen?r`${this.renderMethods()}<div class="passkey-only" data-arx-passkey-only data-arx-ha-passkey>
            <button type="button" ?disabled=${this.busy||!v()||!this.haPasskeyHere()} @click=${()=>void this.onHaPasskeyFactor()} data-arx-passkey-factor>${this.busy?a("passkeyWaiting"):a("passkeyUse")}</button>
            ${v()?this.haPasskeyHere()?d:r`<span class="hint" data-arx-passkey-wrong-host>${a("passkeyWrongHost",{origin:this.haPasskeyOrigin??""})}</span>`:r`<span class="hint">${a("passkeyUnsupported")}</span>`}
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${a("back")}</button>
          </div>`:r`${this.renderMethods()}<form @submit=${this.onCode} novalidate>
            <label>${this.recoveryCode?E("secondFactor.recoveryCodeLabel"):l("קוד אימות")}<input id="code" class="code" name="code" inputmode=${this.recoveryCode?"text":"numeric"}
              autocomplete="one-time-code" autocapitalize=${this.recoveryCode?"characters":"off"} spellcheck="false" placeholder=${this.recoveryCode?"XXXX-XXXX":""}
              maxlength="12" required ?disabled=${this.busy} data-arx-code /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-verify>${this.busy?l("בודק…"):l("אימות")}</button>
            <button type="button" class="link" ?disabled=${this.busy} @click=${()=>this.restart()}>${l("חזרה לכניסה")}</button>
          </form>`}
      <div class="foot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
        <span>${this.localEnabled&&this.mode==="local"?a("footLocal"):l("הסיסמה נבדקת מול תשתית המערכת ואינה נשמרת ב־Arx; ההרשאות שלך זהות להרשאותיך במערכת.")}</span>
      </div>
      ${this.renderOffer()}
      ${P()?r`<div class="app-servers"><button type="button" class="link" data-arx-switch-server @click=${()=>te()}>${l("החלף שרת")}</button></div>`:d}
    </main>`}};i.styles=q`
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
    /* MFA-SCREENS-2510: the second step's methods chooser - the modes' look (the local / infrastructure switch), up to three keys */
    .modes.methods.n3 {
      grid-template-columns: 1fr 1fr 1fr;
    }
    .modes.methods button.mode {
      font-size: var(--sw-fs-sm);
      padding-inline: var(--sw-s-1);
    }
    .passkey-only {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    form > .hint[aria-hidden] {
      text-align: center;
    }
  `;n([g()],i.prototype,"notice",2);n([g()],i.prototype,"noticeKind",2);n([g({type:Boolean})],i.prototype,"localEnabled",2);n([g()],i.prototype,"initialMode",2);n([g({type:Boolean})],i.prototype,"passkeyFirst",2);n([g({type:Boolean})],i.prototype,"recoveryReenrol",2);n([h()],i.prototype,"factorMethods",2);n([h()],i.prototype,"mode",2);n([h()],i.prototype,"step",2);n([h()],i.prototype,"resetUser",2);n([h()],i.prototype,"busy",2);n([h()],i.prototype,"error",2);n([h()],i.prototype,"mfaName",2);n([h()],i.prototype,"recoveryCode",2);n([h()],i.prototype,"passkeyChosen",2);n([h()],i.prototype,"haMethods",2);n([h()],i.prototype,"haPasskeyOrigin",2);n([h()],i.prototype,"enrolOrigin",2);n([h()],i.prototype,"offer",2);n([w("#username")],i.prototype,"usernameEl",2);n([w("#password")],i.prototype,"passwordEl",2);n([w("#code")],i.prototype,"codeEl",2);n([w("#current")],i.prototype,"currentEl",2);n([w("#next")],i.prototype,"nextEl",2);n([w("#again")],i.prototype,"againEl",2);n([w("#rcode")],i.prototype,"rcodeEl",2);n([w("#runame")],i.prototype,"runameEl",2);i=n([H("arx-login")],i);var Ae=Object.defineProperty,Te=Object.getOwnPropertyDescriptor,x=(e,t,s,o)=>{for(var c=o>1?void 0:o?Te(t,s):t,m=e.length-1,y;m>=0;m--)(y=e[m])&&(c=(o?y(t,s,c):y(c))||c);return o&&c&&Ae(t,s,c),c};let b=class extends W{constructor(){super(...arguments),this.token="",this.enabled=!0,this.minLength=12,this.busy=!1,this.error=""}firstUpdated(){ge(),this.pwEl?.focus()}async onSubmit(e){e.preventDefault();const t=this.pwEl?.value??"";if(t!==(this.againEl?.value??"")){this.error=a("mismatch");return}this.busy=!0,this.error="";try{const s=await be(this.token,t);this.dispatchEvent(new CustomEvent("arx-password-set",{detail:{mustEnrol:s.must_enrol},bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof u?s.message:a("unexpected")}finally{this.busy=!1}}render(){const e=this.enabled&&!!this.token;return r`<main class="card" aria-labelledby="w-title" data-arx-welcome>
      <h1 id="w-title">${a("welcomeTitle")}</h1>
      <p>${this.enabled?this.token?a("welcomeSub",{min:this.minLength}):a("welcomeNoToken"):a("welcomeOff")}</p>
      ${this.error?r`<div class="msg" role="alert" data-arx-welcome-error>${this.error}</div>`:d}
      ${e?r`<form @submit=${this.onSubmit} novalidate>
            <label>${a("newPassword")}<input id="pw" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <label>${a("repeatPassword")}<input id="again" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-welcome-save>${this.busy?a("saving"):a("setPassword")}</button>
          </form>`:d}
    </main>`}};b.styles=q`
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
  `;x([g()],b.prototype,"token",2);x([g({type:Boolean})],b.prototype,"enabled",2);x([g({type:Number})],b.prototype,"minLength",2);x([h()],b.prototype,"busy",2);x([h()],b.prototype,"error",2);x([w("#pw")],b.prototype,"pwEl",2);x([w("#again")],b.prototype,"againEl",2);b=x([H("arx-welcome")],b);function Le(){"serviceWorker"in navigator&&navigator.serviceWorker.register("arx-sw.js",{scope:"./"}).catch(()=>{})}let N=!1;async function _(){N||(N=!0,document.documentElement.setAttribute("data-channel","remote"),re(async()=>{const e=await le();return e||window.location.reload(),e}),ie(e=>{de(ce(e)),window.location.reload()}),ne())}function B(e,t,s=""){const o=document.createElement("arx-login");o.notice=e,o.noticeKind=t,o.localEnabled=!!$().local_identity,o.initialMode=s,o.passkeyFirst=!!$().local_passkey_first,o.recoveryReenrol=$().recovery_reenrol===!0,o.addEventListener("arx-signed-in",()=>{o.remove(),_()}),document.body.appendChild(o)}function Fe(e){const t=$(),s=document.createElement("arx-welcome");s.token=e,s.enabled=!!t.local_identity,s.minLength=t.local_password_min??12,s.addEventListener("arx-password-set",o=>{s.remove(),B(a(o.detail.mustEnrol?"welcomeEnrol":"welcomeDone"),"info","local")}),document.body.appendChild(s)}async function Xe(){P(),Le(),await se();const e=ve();if(e!==null||window.location.hash.startsWith("#/welcome")){Fe(e??"");return}ae();let t=L()??"",s="info";try{if(await oe()){await _();return}if($().local_identity){const o=await I();if(o&&!o.local_identity?.gate){await _();return}}t=L()??t}catch(o){t=o instanceof u?o.message:"",s="error"}B(t,s)}export{Xe as bootRemote};
