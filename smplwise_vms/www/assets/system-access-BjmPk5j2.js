import{r as We,a as oe,t as Ke,b as Ve,c as Ye}from"./sw-second-factor-DKpAM03X.js";import{j as B,z as te,k as h,a as q,o as E,b as a,A as p,v as u,m as W,S as Ee,y as os,e as ls,bg as G,q as b,bE as ee,s as X,iX as ds,c$ as V,af as I,F as J,br as cs,bt as ps,bs as hs,bu as us,b4 as Je,aX as Ae,c as le,aj as ws,bo as ms,bw as H,ae as ue,cd as vs,dL as Y,bF as Ze,yh as fs,u$ as D,yi as Xe,bv as $s,ei as gs,el as bs,an as ys,yj as xe,yk as Qe,yl as es,aM as A,d7 as _s,a3 as ks,ym as xs,jL as zs,dv as Ss}from"./index-HK12zoPD.js";import{s as As,e as Cs,g as Es,k as Ps}from"./second-factor-Dji2IcOk.js";import{userFactors as Rs,factorPolicy as Pe,POLICY_VALUES as Os}from"./factor-screens-DiEXIucf.js";import{s as Ce}from"./settings-DYAYUgHz.js";import"./system-alarm-DCTUzgp4.js";import{l as ze}from"./live-C8F_CHHR.js";import"./sw-table-CLRMzfVb.js";import"./sw-steps-CS8CoBj_.js";import"./sw-chip-ChHRJG6K.js";import"./system-doors-CShQCvkB.js";import{fmtWhen as C,listUsers as Ls,listRoles as ae,listGroups as Us,listAudit as Re,groupImpact as Ms,bindGroup as Is,createBinding as Oe,unbindGroup as js,revokeBinding as Ds,syncDirectory as Hs,createGroup as Ns,setGroupMembers as Ts,renameGroup as Gs,deleteGroup as Fs,previewAccess as Bs,setRemoteAccess as qs,SYNC_LABEL as Le,previewRole as Ws,updateRole as Ks,createRole as Vs,deleteRole as Ys,setDelegation as Js,ACTION_LABEL as Zs}from"./access-BJ9gidxi.js";import{b as ss}from"./bubble-chrome-5ObbvscE.js";import{T as ts}from"./toast-controller-BPX0Tkjm.js";import{l as c,a as Xs}from"./local-identity-CHlzGbcp.js";import{u as Qs,e as et,f as st,p as ie,g as tt}from"./passkey-only-ChM342oN.js";import{c as he}from"./confirm-dialog-WT1oiZQ3.js";import{a as at,c as it}from"./confirm-words-B3Rj8-Uo.js";import{b as rt}from"./lock-reason-CoDzPsv7.js";import{e as nt}from"./styles-DCYma-yS.js";import{b as ot}from"./access-BqYCO69U.js";import{t as l,g as lt,a as dt,G as ct,b as pt,P as ht}from"./home-api-KrIYJtJ4.js";import"./sw-view-switch-BCw_KJhD.js";import{t as i}from"./system-a-BxEiYMdG.js";import"./qrcode-CWKHzRGU.js";import"./sw-logo-art-PLtEZJxU.js";import"./door-path-logic-C9fH0tDb.js";import"./automations-Cv12ZBRV.js";var ut=Object.defineProperty,wt=Object.getOwnPropertyDescriptor,N=(e,s,t,r)=>{for(var n=r>1?void 0:r?wt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&ut(s,t,n),n};const mt={required:()=>u("חובה"),optional:()=>u("רשות"),exempt:()=>u("פטור")},vt={user:()=>u("הגדרה אישית"),role:()=>u("לפי תפקיד"),global:()=>u("לפי המדיניות"),wall:()=>u("עמדת קיר"),service:()=>u("משתמש שירות")};let L=class extends q{constructor(){super(...arguments),this.userId="",this.data=void 0,this.armed=!1,this.busy=!1,this.stepUp=!1,this.ownCode="",this.check=void 0,this.typed="",this.error="",this.message="",this.onChanged=()=>void this.load(),this.seq=0}connectedCallback(){super.connectedCallback(),this.addEventListener("factors-changed",this.onChanged)}disconnectedCallback(){this.removeEventListener("factors-changed",this.onChanged),super.disconnectedCallback()}willUpdate(e){e.has("userId")&&(this.data=void 0,this.armed=!1,this.ownCode="",this.typed="",this.check=void 0,this.error="",this.message="",this.load())}async load(){const e=++this.seq;try{const s=await Rs(this.userId);e===this.seq&&(this.data=s)}catch{e===this.seq&&(this.data=null)}}async arm(){this.armed=!0,this.error="",this.ownCode="",this.typed="",this.check=void 0;const e=this.userId,[s,t]=await Promise.allSettled([As(),Cs(e)]);e===this.userId&&(this.stepUp=s.status==="fulfilled"&&s.value.enabled,this.check=t.status==="fulfilled"?t.value:null)}ready(){return!oe(this.check)&&Ke(this.check,this.typed)&&(!this.stepUp||/^\d{6}$/.test(this.ownCode))}async reset(){if(!this.ready()||this.busy)return;this.busy=!0,this.error="";const e=this.userId;try{if(await Es(e,this.typed,this.stepUp?this.ownCode:void 0),e!==this.userId)return;this.armed=!1,this.ownCode="",this.typed="",this.message=E("secondFactor.adminResetDone"),await this.load()}catch(s){e===this.userId&&(this.error=Ve(s))}finally{this.busy=!1}}line(e,s,t,r){return a`<li data-uf=${e} data-on=${r?"yes":"no"}><span class="l">${s}</span><span class="v">${t}</span></li>`}renderReset(e){const s=e.passkeys>0||e.device_keys>0||e.recovery.total>0;return e.totp.enabled||!s?p:a`<div class="reset" data-uf-reset-box>
      ${this.armed?a`<div class="lbl">${E("secondFactor.adminResetConfirm")}</div>
            ${Ye(this.check,this.typed,t=>this.typed=t,()=>void this.reset())}
            ${this.stepUp&&!oe(this.check)?a`<form @submit=${t=>{t.preventDefault(),this.reset()}}>
                  <input data-uf-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label=${E("secondFactor.adminStepUp")}
                    placeholder="000000" .value=${this.ownCode} @input=${t=>this.ownCode=t.target.value.replace(/\D/g,"").slice(0,6)} />
                </form>
                <div class="lbl">${E("secondFactor.adminStepUp")}</div>`:p}
            <span class="acts">${oe(this.check)?p:a`<sw-button size="sm" variant="danger" data-uf-reset-confirm ?disabled=${this.busy||!this.ready()} @click=${()=>void this.reset()}>${E("secondFactor.adminReset")}</sw-button>`}
              <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.armed=!1}>${E("secondFactor.cancel")}</sw-button></span>`:a`<sw-button size="sm" variant="secondary" data-uf-reset @click=${()=>void this.arm()}>${E("secondFactor.adminReset")}</sw-button>`}
    </div>`}render(){const e=this.data;if(e===void 0)return p;if(e===null)return a`<sw-second-factor-user .userId=${this.userId}></sw-second-factor-user>`;const s=r=>r===0?u("אין"):String(r),t=e.policy;return a`<div data-second-factor-user-row><sw-second-factor-user .userId=${this.userId}></sw-second-factor-user></div>
      <ul class="list" aria-label=${u("אמצעי האימות של המשתמש")} data-user-factors>
        ${this.line("passkeys",u("מפתחות גישה"),e.passkeys&&e.passkeys_usable!==e.passkeys?u("{n} ({usable} פעילים)",{n:e.passkeys,usable:e.passkeys_usable}):s(e.passkeys),e.passkeys_usable>0)}
        ${this.line("device-keys",u("מפתחות טלפון"),e.device_keys&&e.device_keys_counting!==e.device_keys?u("{n} ({usable} פעילים)",{n:e.device_keys,usable:e.device_keys_counting}):s(e.device_keys),e.device_keys_counting>0)}
        ${e.recovery.total?this.line("recovery",E("secondFactor.recoveryTitle"),u("{n} מתוך {total}",{n:e.recovery.remaining,total:e.recovery.total}),e.recovery.remaining>0):p}
        ${e.ha_mfa_seen?this.line("ha-mfa",u("אימות של מערכת הבית"),u("נראה בכניסה"),!0):p}
        ${this.line("policy",u("מדיניות"),`${mt[t.sign_in]()} · ${(vt[t.source]??(()=>t.source))()}${t.enforced?"":` · ${u("דיווח בלבד")}`}`,t.sign_in!=="required"||e.totp.enabled||e.passkeys_usable>0||e.device_keys_counting>0||e.ha_mfa_seen)}
      </ul>
      ${this.renderReset(e)}
      ${this.message?a`<div class="ok" role="status" data-uf-message>${this.message}</div>`:p}
      ${this.error?a`<div class="err" role="alert" data-uf-error>${this.error}</div>`:p}`}};L.styles=[We,B`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .list li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sw-s-2);
      padding: var(--sw-s-1) 0;
      border-block-end: thin solid var(--sw-border);
    }
    .list li:last-child {
      border-block-end: 0;
    }
    .l {
      color: var(--sw-text-2);
    }
    .v {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
      text-align: end;
      unicode-bidi: isolate;
    }
    li[data-on='no'][data-uf='policy'] .v {
      color: var(--sw-warning-text);
    }
    .reset {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      align-items: flex-start;
    }
    .acts {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    input {
      inline-size: 9.5em;
      min-block-size: var(--sw-ctl-h-lg);
      padding: var(--sw-s-1) var(--sw-s-2);
      border: thin solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-lg);
      letter-spacing: 0.25em;
      text-align: center;
      direction: ltr;
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .ok {
      font-size: var(--sw-fs-xs);
      color: var(--sw-success-text);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
  `];N([te()],L.prototype,"userId",2);N([h()],L.prototype,"data",2);N([h()],L.prototype,"armed",2);N([h()],L.prototype,"busy",2);N([h()],L.prototype,"stepUp",2);N([h()],L.prototype,"ownCode",2);N([h()],L.prototype,"check",2);N([h()],L.prototype,"typed",2);N([h()],L.prototype,"error",2);N([h()],L.prototype,"message",2);L=N([W("sw-user-factors")],L);var ft=Object.defineProperty,$t=Object.getOwnPropertyDescriptor,as=(e,s,t,r)=>{for(var n=r>1?void 0:r?$t(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&ft(s,t,n),n};let we=class extends q{constructor(){super(...arguments),this.status=null,this.onVerified=()=>void this.load()}connectedCallback(){super.connectedCallback(),window.addEventListener(Ee,this.onVerified),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener(Ee,this.onVerified)}async load(){try{this.status=await Ps()}catch{this.status=null}}text(e){return e.applies?e.valid_until?os("stepUp.mineValid",{time:ls(e.valid_until)}):E("stepUp.mineNone"):e.reason==="off"?E("stepUp.mineOff"):e.reason==="local_channel"?E("stepUp.mineLocal"):e.reason==="bearer_token"?E("stepUp.mineBearer"):E("stepUp.mineNoMethod")}render(){const e=this.status;return e?a`<span data-step-up-mine=${e.applies?e.valid_until?"valid":"none":e.reason??""}>${this.text(e)}</span>`:p}};we.styles=B`
    :host {
      display: inline;
    }
  `;as([h()],we.prototype,"status",2);we=as([W("sw-step-up-status")],we);var gt=Object.defineProperty,bt=Object.getOwnPropertyDescriptor,T=(e,s,t,r)=>{for(var n=r>1?void 0:r?bt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&gt(s,t,n),n};const yt=["security.factor_policy","security.factor_policy_mode","security.factor_wall_exempt","security.remote_long_lived_tokens","security.passkey_remote_factor","security.factor_reset_channel","security.step_up","security.step_up_minutes","security.step_up_local","security.push_approval","security.step_up_alarm_pin"],fe={"security.factor_policy":"optional","security.factor_policy_mode":"report","security.factor_wall_exempt":"on","security.remote_long_lived_tokens":"allow","security.passkey_remote_factor":"off","security.factor_reset_channel":"any","security.step_up":"off","security.step_up_minutes":5,"security.step_up_local":"off","security.push_approval":"off","security.step_up_alarm_pin":"off"},$e={optional:()=>u("רשות לכולם"),admins:()=>u("חובה למנהלים"),sensitive:()=>u("חובה למי שמחזיק הרשאות רגישות"),all:()=>u("חובה לכולם")},Ue={allow:()=>u("מותרים"),refuse_under_policy:()=>u("נחסמים למי שחייב אימות"),refuse:()=>u("נחסמים לכולם")},_t={user:()=>u("הגדרה אישית"),role:()=>u("לפי תפקיד"),global:()=>u("לפי המדיניות"),wall:()=>u("עמדת קיר"),service:()=>u("משתמש שירות")},kt={totp:()=>u("אפליקציית אימות"),passkey:()=>u("מפתח גישה"),ha_mfa:()=>u("אימות של מערכת הבית")},Me=8,xt={any:()=>u("מכל מקום"),local:()=>u("רק מהרשת המקומית")};function zt(e){if(!e)return!0;if(e.user.id.startsWith("l_"))return!1;let s=!1;for(const t of e.bindings??[])if(!(t.role_id!=="system_admin"||t.scope_type!=="installation"||t.scope_id!=="*")){if(t.effect==="deny")return!1;s=!0}return s}let U=class extends q{constructor(){super(...arguments),this.canEdit=!1,this.stored={},this.draft={},this.policy=null,this.preview=null,this.loadError="",this.error="",this.message="",this.busy=!1,this.showAll="",this.previewSeq=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const[e,s]=await Promise.all([G("settings"),Pe()]),t={};for(const r of yt)e.settings[r]!==void 0&&e.settings[r]!==null&&(t[r]=e.settings[r]);this.stored=t,this.policy=s,this.loadError=""}catch(e){this.loadError=b(e)}}value(e){return this.draft[e]??this.stored[e]??fe[e]}set(e,s){const t={...this.draft};String(this.stored[e]??fe[e])===String(s)?delete t[e]:t[e]=s,this.draft=t,this.message="",this.error="",e==="security.factor_policy"&&this.loadPreview()}async loadPreview(){const e=++this.previewSeq,s=this.draft["security.factor_policy"];if(!s){this.preview=null;return}try{const t=await Pe(s);e===this.previewSeq&&(this.preview=t.compliance)}catch(t){e===this.previewSeq&&(this.preview=null,this.error=b(t))}}async save(){if(Object.keys(this.draft).length){this.busy=!0,this.error="",this.message="";try{await ee("settings",this.draft),this.draft={},this.preview=null,await this.load(),this.message=u("נשמר")}catch(e){this.error=b(e)}finally{this.busy=!1}}}renderPeople(e,s,t){if(!t)return p;const r=this.showAll===e,n=r?s:s.slice(0,Me);return a`<div class="sub" id=${`fp-${e}`}>${e==="missing"?u("יצטרכו להפעיל אימות דו־שלבי"):u("פטורים")}</div>
      <ul class="people" aria-labelledby=${`fp-${e}`} data-fp-people=${e}>
        ${n.map(o=>a`<li data-fp-person=${o.user_id}>
            <span class="who">${o.name||o.user_id}</span>
            <sw-badge kind="neutral" label=${o.kind==="local"?"Arx":u("מערכת הבית")}></sw-badge>
            <span class="why">${(_t[o.reason]??(()=>o.reason))()}${o.factor?` · ${(kt[o.factor]??(()=>o.factor??""))()}`:""}</span>
          </li>`)}
      </ul>
      ${s.length>Me?a`<sw-button size="sm" variant="ghost" data-fp-more=${e} @click=${()=>this.showAll=r?"":e}>${r?u("פחות"):u("הצג את כולם ({n})",{n:t})}</sw-button>`:p}`}renderCompliance(){const e=this.policy;if(!e)return p;const s=this.preview??e.compliance,t=!!this.preview,r=(n,o,d,v=!1)=>a`<div class="stat ${v&&o?"warn":""}" data-fp-stat=${n}><b>${o}</b><span>${d}</span></div>`;return a`<sw-card heading=${u("עמידה במדיניות")} subheading=${u("מי חייב אימות דו־שלבי בכניסה מרחוק, ולמי הוא חסר")} data-fp-compliance data-fp-preview=${t?s.policy:""}>
      ${t?a`<div class="pv" role="status" data-fp-preview-note><sw-icon name="eye" size=${16}></sw-icon>${u("תצוגה מקדימה: {policy} · עוד לא נשמר",{policy:$e[s.policy]()})}</div>`:p}
      <div class="stats">
        ${r("total",s.users_total,u("משתמשים"))}
        ${r("covered",s.covered,u("חייבים אימות"))}
        ${r("enrolled",s.enrolled,u("מהם עם אימות"))}
        ${r("missing",s.missing_count,u("חסר להם אימות"),!0)}
        ${r("exempt",s.exempt_count,u("פטורים"))}
      </div>
      ${this.renderPeople("missing",s.missing,s.missing_count)}
      ${this.renderPeople("exempt",s.exempt,s.exempt_count)}
      ${e.mode==="report"&&!this.draft["security.factor_policy_mode"]&&s.missing_count?a`<div class="hint" data-fp-report-note style="margin-block-start:var(--sw-s-3)">${u("במצב דיווח אף אחד לא נחסם. באכיפה, מי שחסר לו אימות יתבקש להפעיל אותו בכניסה הבאה מרחוק.")}</div>`:p}
    </sw-card>`}renderPolicy(e){const s=String(this.value("security.factor_policy")),t=String(this.value("security.factor_policy_mode")),r=String(this.value("security.factor_wall_exempt"))!=="off",n=String(this.value("security.remote_long_lived_tokens")),o=String(this.value("security.passkey_remote_factor"))==="on";return a`<sw-card heading=${u("מדיניות אימות בכניסה מרחוק")} subheading=${u("נבדקת בכל כניסה חדשה מרחוק. ברשת המקומית לא נשאלים.")} data-fp-policy-card>
      <div class="row" data-fp-row="policy"><span class="lbl">${u("מי חייב אימות דו־שלבי")}</span>
        ${e?a`<span class="val" data-fp-policy-ro>${$e[s]?.()??s}</span>`:a`<sw-dropdown tall label=${u("מי חייב אימות דו־שלבי")} data-fp-policy .value=${s}
              .items=${Os.map(d=>({id:d,label:$e[d]()}))}
              @change=${d=>this.set("security.factor_policy",d.detail.id)}></sw-dropdown>`}</div>
      <div class="row" data-fp-row="mode"><span class="lbl">${u("מצב")}<span class="muted">${u("דיווח: רק מציג למי חסר · אכיפה: נדרש בכניסה הבאה מרחוק")}</span></span>
        <sw-segmented label=${u("מצב")} data-fp-mode value=${t} ?disabled=${e}
          .options=${[{value:"report",label:u("דיווח"),attrs:{"data-fp-mode-option":"report"}},{value:"enforce",label:u("אכיפה"),attrs:{"data-fp-mode-option":"enforce"}}]}
          @change=${d=>this.set("security.factor_policy_mode",d.detail.value)}></sw-segmented></div>
      <div class="row" data-fp-row="wall"><span class="lbl">${u("פטור לעמדות קיר")}<span class="muted">${u("משתמש של עמדת קיר נכנס בלי אימות דו־שלבי")}</span></span>
        <sw-toggle data-fp-wall .checked=${r} ?disabled=${e} label=${u("פטור לעמדות קיר")} labelHidden
          @change=${d=>this.set("security.factor_wall_exempt",d.detail.checked?"on":"off")}></sw-toggle></div>
      <div class="row" data-fp-row="long-lived"><span class="lbl">${u("אסימונים ארוכי טווח מבחוץ")}<span class="muted">${u("אסימון ארוך טווח אינו עובר אימות דו־שלבי")}</span></span>
        ${e?a`<span class="val" data-fp-llat-ro>${Ue[n]?.()??n}</span>`:a`<sw-dropdown tall label=${u("אסימונים ארוכי טווח מבחוץ")} data-fp-llat .value=${n}
              .items=${["allow","refuse_under_policy","refuse"].map(d=>({id:d,label:Ue[d]()}))}
              @change=${d=>this.set("security.remote_long_lived_tokens",d.detail.id)}></sw-dropdown>`}</div>
      <div class="row" data-fp-row="passkey"><span class="lbl">${u("מפתח גישה כאימות בכניסה")}<span class="muted">${u("מי שיש לו מפתח גישה יאמת בו או בקוד בכל כניסה חדשה מרחוק בדפדפן")}</span></span>
        <sw-toggle data-fp-passkey .checked=${o} ?disabled=${e} label=${u("מפתח גישה כאימות בכניסה")} labelHidden
          @change=${d=>this.set("security.passkey_remote_factor",d.detail.checked?"on":"off")}></sw-toggle></div>
      ${this.renderResetChannel(e)}
    </sw-card>`}renderResetChannel(e){const s=String(this.stored["security.factor_reset_channel"]??fe["security.factor_reset_channel"])==="local"?"local":"any",t=String(this.value("security.factor_reset_channel"))==="local"?"local":"any",r=zt(X.me),n=e||!r,o=s==="local"&&ds(),d=!r&&!e?u("רק מנהל מערכת משנה את ההגדרה הזו."):o?u("החזרה ל״מכל מקום״ אפשרית רק מהרשת המקומית."):"";return a`<div class="row" data-fp-row="reset-channel"><span class="lbl">${u("איפוס דרכי אימות של משתמשים")}<span class="muted">${u("מאיפה מנהל יכול לאפס את דרכי האימות של משתמש אחר · החזרה ל״מכל מקום״ רק מהרשת המקומית")}</span>${d?a`<span class="muted" data-fp-reset-channel-why>${d}</span>`:p}</span>
      <sw-segmented label=${u("איפוס דרכי אימות של משתמשים")} data-fp-reset-channel value=${t} ?disabled=${n}
        .options=${["any","local"].map(v=>({value:v,label:xt[v](),attrs:{"data-fp-reset-channel-option":v},...v==="any"&&o?{disabled:!0,title:u("החזרה ל״מכל מקום״ אפשרית רק מהרשת המקומית.")}:{}}))}
        @change=${v=>this.set("security.factor_reset_channel",v.detail.value)}></sw-segmented></div>`}renderStepUp(e){const s=String(this.value("security.step_up"))==="on",t=String(this.value("security.step_up_local"))==="on",r=Number(this.value("security.step_up_minutes")),n=String(this.value("security.push_approval"))==="on",o=String(this.value("security.step_up_alarm_pin"))==="on";return a`<sw-card heading=${u("אישור לפני שינויים רגישים")} subheading=${u("כבוי כברירת מחדל: האימות הדו־שלבי נשאל רק בכניסה")} data-fp-step-up-card>
      <div class="row" data-fp-row="step-up"><span class="lbl">${u("לבקש אישור לפני שינויים")}<span class="muted">${u("לפני שינוי הגדרות, משתמשים או הרשאות, נטרול אזעקה ופתיחת דלת")}</span></span>
        <sw-toggle data-fp-step-up .checked=${s} ?disabled=${e} label=${u("לבקש אישור לפני שינויים")} labelHidden
          @change=${d=>this.set("security.step_up",d.detail.checked?"on":"off")}></sw-toggle></div>
      <div class="row" data-fp-row="minutes"><span class="lbl">${u("משך האישור (דקות)")}<span class="muted">${u("0 עד 30 · 0 = בכל שינוי")}</span></span>
        <sw-field class="num"><input type="number" min="0" max="30" step="1" inputmode="numeric" data-ltr data-fp-minutes aria-label=${u("משך האישור (דקות)")} .value=${String(r)} ?disabled=${e||!s}
          @change=${d=>this.set("security.step_up_minutes",Math.min(30,Math.max(0,Math.round(Number(d.target.value)||0))))} /></sw-field></div>
      <div class="row" data-fp-row="local"><span class="lbl">${u("גם ברשת המקומית")}<span class="muted">${u("כבוי: ברשת המקומית לא נשאלים, כדרך חזרה למערכת")}</span></span>
        <sw-toggle data-fp-step-up-local .checked=${t} ?disabled=${e||!s} label=${u("גם ברשת המקומית")} labelHidden
          @change=${d=>this.set("security.step_up_local",d.detail.checked?"on":"off")}></sw-toggle></div>
      <div class="row" data-fp-row="push"><span class="lbl">${u("אישור בטלפון")}<span class="muted">${u("ממסך אחר: הקלדת המספר שעל המסך באפליקציה, באישור מפתח הטלפון")}</span></span>
        <sw-toggle data-fp-push .checked=${n} ?disabled=${e||!s} label=${u("אישור בטלפון")} labelHidden
          @change=${d=>this.set("security.push_approval",d.detail.checked?"on":"off")}></sw-toggle></div>
      <div class="row" data-fp-row="alarm-pin"><span class="lbl">${u("קוד האזעקה האישי כאישור")}<span class="muted">${u("לנטרול אזעקה ולעקיפת חיישן בלבד, לפעולה אחת")}</span></span>
        <sw-toggle data-fp-alarm-pin .checked=${o} ?disabled=${e||!s} label=${u("קוד האזעקה האישי כאישור")} labelHidden
          @change=${d=>this.set("security.step_up_alarm_pin",d.detail.checked?"on":"off")}></sw-toggle></div>
      <div class="row" data-fp-row="mine"><span class="lbl">${u("האישור שלך")}<span class="muted"><sw-step-up-status></sw-step-up-status></span></span></div>
    </sw-card>`}render(){if(this.loadError&&!this.policy)return a`<div class="sections"><div class="msg err" role="alert" data-fp-load-error>${this.loadError}</div></div>`;if(!this.policy)return a`<div class="sections"><div class="muted">${u("טוען…")}</div></div>`;const e=!this.canEdit,s=Object.keys(this.draft).length>0;return a`<div class="sections" data-fp-admin>
      ${this.renderPolicy(e)}
      ${this.renderCompliance()}
      ${this.renderStepUp(e)}
      ${this.canEdit?a`<div class="foot sticky"><sw-button variant="primary" icon="check" data-fp-save ?disabled=${!s||this.busy} @click=${()=>void this.save()}>${u("שמור")}</sw-button>
            ${this.message?a`<span class="msg ok" role="status" data-fp-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:p}
            ${this.error?a`<span class="msg err" role="alert" data-fp-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:p}</div>`:a`<div class="muted" data-fp-readonly>${u("שינוי ההגדרות דורש הרשאת מנהל מערכת.")}</div>`}
    </div>`}};U.styles=[Ce,B`
      :host {
        display: block;
      }
      .sections {
        max-inline-size: none;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: var(--sw-s-2);
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-1);
        padding: var(--sw-s-3);
        border-radius: var(--sw-r-md);
        background: var(--sw-well, var(--sw-surface-2));
      }
      .stat b {
        font-size: var(--sw-fs-xl);
        font-weight: var(--sw-fw-bold);
        color: var(--sw-heading, var(--sw-text));
        font-variant-numeric: tabular-nums;
      }
      .stat span {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .stat.warn b {
        color: var(--sw-warning-text);
      }
      .people {
        list-style: none;
        margin: var(--sw-s-3) 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .people li {
        display: flex;
        align-items: center;
        gap: var(--sw-s-2);
        flex-wrap: wrap;
        padding: var(--sw-s-2) 0;
        border-block-end: thin solid var(--sw-border);
        font-size: var(--sw-fs-sm);
      }
      .people li:last-child {
        border-block-end: 0;
      }
      .people .who {
        flex: 1 1 10rem;
        min-inline-size: 0;
        overflow-wrap: anywhere;
        color: var(--sw-text);
        font-weight: var(--sw-fw-medium);
      }
      .people .why {
        color: var(--sw-text-2);
        font-size: var(--sw-fs-xs);
      }
      .sub {
        margin: var(--sw-s-4) 0 0;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading, var(--sw-text));
      }
      .pv {
        display: flex;
        align-items: center;
        gap: var(--sw-s-1h);
        margin-block-end: var(--sw-s-3);
        font-size: var(--sw-fs-sm);
        color: var(--sw-accent-text);
      }
      .row sw-dropdown,
      .row sw-segmented {
        flex: none;
      }
      .num {
        inline-size: 6rem;
      }
    `];T([te({type:Boolean})],U.prototype,"canEdit",2);T([h()],U.prototype,"stored",2);T([h()],U.prototype,"draft",2);T([h()],U.prototype,"policy",2);T([h()],U.prototype,"preview",2);T([h()],U.prototype,"loadError",2);T([h()],U.prototype,"error",2);T([h()],U.prototype,"message",2);T([h()],U.prototype,"busy",2);T([h()],U.prototype,"showAll",2);U=T([W("sw-factor-policy-admin")],U);const Z={users:[{ha_user_id:"demo-1",username:"dana",display_name:"דנה לוי",role_id:"viewer",role_name:V("צופה"),scope_type:"installation",scope_id:"*",scope_name:V("כל ההתקנה"),state:"active",repair:null,person:!0,created_at:"2026-10-16T08:00:00Z",created_by_name:"מנהל",is_self:!1},{ha_user_id:"demo-2",username:"yossi",display_name:"יוסי כהן",role_id:"operator",role_name:V("מפעיל"),scope_type:"installation",scope_id:"*",scope_name:V("כל ההתקנה"),state:"inactive",repair:null,person:!0,created_at:"2026-10-15T08:00:00Z",created_by_name:"מנהל",is_self:!1}],can_manage:!0,actor_ha_admin:!0,transport:"supervisor",access:{state:"ok",checked_at:"2026-10-16T08:00:00Z"},roles:[{id:"viewer",name:V("צופה")},{id:"operator",name:V("מפעיל")},{id:"editor",name:V("עורך מפות ותצוגות")}],scopes:[{type:"installation",id:"*",name:V("כל ההתקנה")}],password:{min_length:10,max_length:128},limit:50},de=e=>JSON.parse(JSON.stringify(e)),re={async view(){return I()?G("/ha-users"):de(Z)},async check(){return I()?J("/ha-users/check",{}):{access:de(Z.access),transport:Z.transport}},async create(e){if(I())return J("/ha-users",e);const s=Z.roles.find(r=>r.id===e.role_id),t={ha_user_id:`demo-${Date.now()}`,username:e.username,display_name:e.display_name,role_id:e.role_id,role_name:s?.name??e.role_id,scope_type:e.scope_type,scope_id:e.scope_id,scope_name:V("כל ההתקנה"),state:"active",repair:null,person:e.create_person,created_at:new Date().toISOString(),created_by_name:"מנהל",is_self:!1};return Z.users.push(t),{user:de(t),replayed:!1}},async setActive(e,s){if(I())return J(`/ha-users/${encodeURIComponent(e)}/${s?"activate":"deactivate"}`,{confirm:!0});const t=Z.users.find(r=>r.ha_user_id===e);return t&&(t.state=s?"active":"inactive"),{user:de(t)}},async remove(e,s){return I()?J(`/ha-users/${encodeURIComponent(e)}/delete`,{confirm_username:s}):(Z.users=Z.users.filter(t=>t.ha_user_id!==e),{deleted:e,already_gone:!1})}},is={tab:"משתמשי מערכת הבית",title:"משתמשי מערכת הבית",sub:"יצירת משתמש רגיל במערכת הבית עם תפקיד ב־Arx. מכאן אפשר להשבית או למחוק רק משתמשים שנוצרו כאן.",keywords:"משתמש חדש יצירה מחיקה השבתה סיסמה מערכת הבית",loading:"טוען…",forbidden:"ניהול משתמשי מערכת הבית שמור למנהלי המערכת.",retry:"נסו שוב",accessTitle:"הרשאה במערכת הבית",check:"בדיקת הרשאה",checking:"בודק…",checkedAt:"נבדק {time}",acc_ok:"למערכת יש הרשאה לנהל משתמשים במערכת הבית.",acc_unknown:'עוד לא נבדק. לחצו "בדיקת הרשאה" לפני יצירת המשתמש הראשון.',acc_not_authorised:"למערכת אין הרשאת מנהל במערכת הבית, ולכן אי אפשר ליצור או למחוק משתמשים מכאן.",acc_not_authorised_fix:'מה עושים: במערכת הבית, בפרופיל של חשבון מנהל, יוצרים אסימון גישה לטווח ארוך (Long-Lived Access Token), ושומרים אותו בהגדרות ‹ חיבורים ‹ סודות בשורה "אסימון מנהל לניהול משתמשי מערכת הבית". אין צורך בהפעלה מחדש; אחר כך לוחצים שוב "בדיקת הרשאה". אפשר גם להמשיך לנהל משתמשים במסך המשתמשים של מערכת הבית.',acc_unavailable:"מערכת הבית אינה זמינה כרגע. נסו שוב בעוד רגע.",acc_not_configured:"החיבור למערכת הבית אינו מוגדר בהתקנה הזו.",acc_failed:"הבדיקה נכשלה. נסו שוב.",via_supervisor:"בזהות התוסף",via_token:"באסימון המנהל שהוגדר",notHaAdmin:"רק מנהל של מערכת הבית יכול ליצור, להשבית או למחוק משתמשים. אפשר לצפות ברשימה.",listTitle:"משתמשים שנוצרו דרך Arx",empty:"עוד לא נוצרו משתמשים מכאן.",emptyHint:'משתמשים קיימים של מערכת הבית מופיעים בלשונית "משתמשים", ושם משייכים להם תפקידים.',add:"משתמש חדש",count:"{n} מתוך {max}",colName:"שם",colUser:"שם משתמש",colRole:"תפקיד ב־Arx",colState:"מצב",st_active:"פעיל",st_inactive:"מושבת",st_needs_repair:"דורש תיקון",repair_person_missing:"נוצר בלי כרטיס אדם",repair_compensation_failed:"היצירה נכשלה באמצע; יש למחוק",repair_binding_failed:"שיוך התפקיד נכשל; יש למחוק",repair_cleanup_failed:"הניקוי לא הושלם; יש למחוק שוב",repair_missing_in_ha:"לא נמצא במערכת הבית; יש למחוק",you:"אתם",deactivate:"השבתה",activate:"הפעלה",remove:"מחיקה",createTitle:"משתמש חדש במערכת הבית",createSub:"המשתמש נוצר כמשתמש רגיל (לא מנהל) ומקבל את התפקיד שנבחר ב־Arx בלבד.",fName:"שם מוצג",fUsername:"שם משתמש לכניסה",fUsernameHint:"אותיות לטיניות קטנות, ספרות, נקודה, מקף או קו תחתון; 3 עד 32 תווים.",fPassword:"סיסמה",fPassword2:"סיסמה שוב",fPasswordHint:"לפחות {min} תווים, לא סיסמה נפוצה ולא רצף. הסיסמה לא נשמרת ב־Arx ולא תוצג שוב.",fRole:"תפקיד ב־Arx",fScope:"היקף",fPerson:"ליצור גם כרטיס אדם במערכת הבית",create:"יצירה",cancel:"ביטול",created:"המשתמש {name} נוצר.",createdNoPerson:"המשתמש {name} נוצר, אך כרטיס האדם לא נוצר.",e_name:"נדרש שם מוצג.",e_username:"שם המשתמש אינו בפורמט הנדרש.",e_mismatch:"הסיסמאות אינן זהות.",e_role:"יש לבחור תפקיד.",pw_too_short:"הסיסמה קצרה מדי.",pw_too_long:"הסיסמה ארוכה מדי.",pw_repetitive:"הסיסמה חוזרת על אותם תווים.",pw_common:"הסיסמה נפוצה מדי.",pw_sequence:"הסיסמה היא רצף מקלדת או ספרות.",pw_contains_username:"הסיסמה מכילה את שם המשתמש.",pw_contains_name:"הסיסמה מכילה את השם המוצג.",deactivateTitle:"השבתת {name}",deactivateBody:"המשתמש לא יוכל להיכנס למערכת הבית ול־Arx עד שיופעל שוב. אפשר להפעיל אותו מחדש בכל עת.",activateTitle:"הפעלת {name}",activateBody:"המשתמש יוכל להיכנס שוב, עם התפקיד שלו ב־Arx.",confirm:"אישור",deactivated:"המשתמש הושבת.",activated:"המשתמש הופעל.",removeTitle:"מחיקת {name}",removeBody:"המשתמש יימחק ממערכת הבית, כל התפקידים שלו ב־Arx יבוטלו והכניסות הפתוחות שלו ייסגרו. אי אפשר לבטל את המחיקה. השבתה היא האפשרות הבטוחה יותר.",removeType:"להקליד את שם המשתמש {username} כדי לאשר",removeConfirm:"מחיקה לצמיתות",removed:"המשתמש נמחק."},rs=hs("en","i18n/ha-users","en");function St(){return ps(["en"])}function f(e,s){const t=(St()==="en"?rs[e]:void 0)??is[e]??e;return cs(t,s)}us("i18n/ha-users",{he:is,en:rs});const At=/^[a-z0-9][a-z0-9._-]{2,31}$/;function Ie(e,s){return e.toLowerCase()===s.toLowerCase()}const Ct=["0123456789","9876543210","abcdefghijklmnopqrstuvwxyz","zyxwvutsrqponmlkjihgfedcba","qwertyuiopasdfghjklzxcvbnm"];function Et(e,s,t,r=10,n=128){if(e.length<r)return"too_short";if(e.length>n)return"too_long";const o=e.toLowerCase();return new Set(o).size<=2?"repetitive":Ct.some(d=>d.includes(o)||(d+d).includes(o))?"sequence":s.length>=3&&o.includes(s.toLowerCase())?"contains_username":t.toLowerCase().split(/\s+/).some(d=>d.length>=3&&o.includes(d))?"contains_name":null}const ge=(e="viewer")=>({display_name:"",username:"",password:"",password2:"",role_id:e,scope:"installation:*",create_person:!0});function je(e,s=10,t=128){const r={};e.display_name.trim()||(r.display_name="e_name"),At.test(e.username)||(r.username="e_username");const n=Et(e.password,e.username,e.display_name,s,t);return n?r.password=`pw_${n}`:e.password!==e.password2&&(r.password2="e_mismatch"),e.role_id||(r.role_id="e_role"),r}function Pt(e,s,t){const r=s.actor_ha_admin&&!e.is_self&&t!=="not_authorised"&&t!=="not_configured";return{deactivate:r&&e.state==="active",activate:r&&e.state==="inactive",remove:r}}function Rt(e){return`st_${e.state}`}function Ot(e){return e.repair?`repair_${e.repair}`:null}function Lt(e){return`acc_${e}`}function Ut(e){return e.actor_ha_admin&&e.users.length<e.limit&&e.access.state!=="not_authorised"&&e.access.state!=="not_configured"&&e.transport!=="none"}function De(){const e=new Uint8Array(12);return globalThis.crypto.getRandomValues(e),Array.from(e,s=>s.toString(16).padStart(2,"0")).join("")}var Mt=Object.defineProperty,It=Object.getOwnPropertyDescriptor,M=(e,s,t,r)=>{for(var n=r>1?void 0:r?It(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&Mt(s,t,n),n};let R=class extends q{constructor(){super(...arguments),this.bubbleSkin=new Ae(this),this.view=null,this.loadState="loading",this.error="",this.okLine=new ts(this,{ms:0}),this.busy=!1,this.checking=!1,this.createOpen=!1,this.draft=ge(),this.touched=!1,this.formError="",this.confirm=null,this.removing=null,this.typed="",this.requestKey=""}get ok(){return this.okLine.text}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{this.view=await re.view(),this.loadState="ready"}catch(e){this.loadState=e instanceof le&&e.status===403?"forbidden":"error",this.error=b(e)}}flash(e){this.okLine.show(e),this.error=""}async runCheck(){if(this.view){this.checking=!0;try{const e=await re.check();this.view={...this.view,access:e.access,transport:e.transport}}catch(e){this.error=b(e)}finally{this.checking=!1}}}openCreate(){this.draft=ge(this.view?.roles.some(e=>e.id==="viewer")?"viewer":this.view?.roles[0]?.id??""),this.touched=!1,this.formError="",this.requestKey=De(),this.createOpen=!0}closeCreate(){this.createOpen=!1,this.draft=ge()}async submitCreate(){if(!this.view)return;this.touched=!0;const e=je(this.draft,this.view.password.min_length,this.view.password.max_length);if(Object.keys(e).length)return;const[s,...t]=this.draft.scope.split(":");this.busy=!0,this.formError="";try{const r=await re.create({display_name:this.draft.display_name.trim(),username:this.draft.username,password:this.draft.password,role_id:this.draft.role_id,scope_type:s,scope_id:t.join(":")||"*",create_person:this.draft.create_person,request_key:this.requestKey});this.closeCreate(),this.flash(f(r.user.repair==="person_missing"?"createdNoPerson":"created",{name:r.user.display_name})),await this.load()}catch(r){this.draft={...this.draft,password:"",password2:""},this.formError=b(r),r instanceof le&&r.code!=="password_weak"&&r.code!=="username_taken"&&r.code!=="validation"&&(this.requestKey=De(),await this.load())}finally{this.busy=!1}}async submitConfirm(){const e=this.confirm;if(e){this.busy=!0;try{await re.setActive(e.user.ha_user_id,e.kind==="activate"),this.confirm=null,this.flash(f(e.kind==="activate"?"activated":"deactivated")),await this.load()}catch(s){this.confirm=null,this.error=b(s),await this.load()}finally{this.busy=!1}}}async submitRemove(){const e=this.removing;if(!(!e||!Ie(this.typed,e.username))){this.busy=!0;try{await re.remove(e.ha_user_id,this.typed),this.removing=null,this.typed="",this.flash(f("removed")),await this.load()}catch(s){this.removing=null,this.typed="",this.error=b(s),await this.load()}finally{this.busy=!1}}}renderAccess(e){const s=e.access.state,t=s==="ok"?"tone-ok":s==="unknown"?"":s==="unavailable"?"tone-warn":"tone-err",r=s==="ok"?"check":s==="unknown"?"info":"warning";return a`<sw-card data-ha-access=${s}>
      <div class="head"><h3>${f("accessTitle")}</h3></div>
      <div class="access">
        <sw-icon class=${t} name=${r} size=${18}></sw-icon>
        <div class="text">
          <span class=${t} data-access-text>${f(Lt(s))}</span>
          ${s==="not_authorised"?a`<span class="fix" data-access-fix>${f("acc_not_authorised_fix")}</span>`:p}
          ${e.access.checked_at?a`<span class="meta">${f("checkedAt",{time:C(e.access.checked_at)})} · ${f(e.transport==="token"?"via_token":"via_supervisor")}</span>`:p}
        </div>
        <sw-button size="sm" icon="refresh" data-ha-check ?disabled=${this.checking||e.transport==="none"} @click=${()=>void this.runCheck()}>${this.checking?f("checking"):f("check")}</sw-button>
      </div>
      ${e.actor_ha_admin?p:a`<div class="msg warn" style="margin-block-start:var(--sw-s-2)" data-not-ha-admin><sw-icon name="lock" size=${13}></sw-icon>${f("notHaAdmin")}</div>`}
    </sw-card>`}renderRow(e,s){const t=Pt(e,s,s.access.state),r=Ot(e);return a`<div class="item" data-ha-user=${e.username}>
      <span class="name"><span>${ws(e.display_name)}${e.is_self?a` <span class="chip">${f("you")}</span>`:p}</span>
        ${r?a`<span class="sub">${f(r)}</span>`:p}</span>
      <span class="user ltr">${e.username}</span>
      <span class="role">${e.role_name} · ${e.scope_name}</span>
      <span class=${`chip ${e.state}`} data-state=${e.state}>${f(Rt(e))}</span>
      <span class="row-actions">
        ${t.deactivate?a`<sw-button size="sm" variant="secondary" data-deactivate @click=${()=>this.confirm={user:e,kind:"deactivate"}}>${f("deactivate")}</sw-button>`:p}
        ${t.activate?a`<sw-button size="sm" variant="secondary" data-activate @click=${()=>this.confirm={user:e,kind:"activate"}}>${f("activate")}</sw-button>`:p}
        ${t.remove?a`<sw-button size="sm" variant="ghost" icon="trash" data-remove @click=${()=>{this.removing=e,this.typed=""}}>${f("remove")}</sw-button>`:p}
      </span>
    </div>`}renderList(e){return a`<sw-card data-ha-list>
      <div class="head">
        <h3>${f("listTitle")}</h3><span class="count">${f("count",{n:e.users.length,max:e.limit})}</span><span class="grow"></span>
        ${Ut(e)?a`<sw-button variant="primary" size="sm" icon="plus" data-ha-add @click=${()=>this.openCreate()}>${f("add")}</sw-button>`:p}
      </div>
      ${e.users.length===0?a`<sw-state-panel icon="users" compact state="empty" heading=${f("empty")} hint=${f("emptyHint")}></sw-state-panel>`:a`<div class="list" role="list">
            <div class="item hdr" aria-hidden="true"><span>${f("colName")}</span><span>${f("colUser")}</span><span>${f("colRole")}</span><span>${f("colState")}</span><span></span></div>
            ${ms(e.users,s=>s.ha_user_id,s=>this.renderRow(s,e))}
          </div>`}
    </sw-card>`}field(e,s){this.draft={...this.draft,[e]:s}}renderCreate(e){const s=this.touched?je(this.draft,e.password.min_length,e.password.max_length):{},t=r=>s[r]?a`<span class="ferr" role="alert">${f(s[r])}</span>`:p;return a`<sw-dialog heading=${f("createTitle")} subheading=${f("createSub")} .open=${this.createOpen} data-ha-create @close=${()=>this.closeCreate()}>
      <form class="form" autocomplete="off" @submit=${r=>{r.preventDefault(),this.submitCreate()}}>
        <label>${f("fName")}<input class="in" maxlength="60" data-f-name aria-invalid=${String(!!s.display_name)} .value=${this.draft.display_name}
          @input=${r=>this.field("display_name",r.target.value)} />${t("display_name")}</label>
        <label>${f("fUsername")}<input class="in ltr" dir="ltr" maxlength="32" autocapitalize="off" spellcheck="false" data-f-username aria-invalid=${String(!!s.username)}
          .value=${this.draft.username} @input=${r=>this.field("username",r.target.value.trim().toLowerCase())} />
          <span class="hint">${f("fUsernameHint")}</span>${t("username")}</label>
        <label>${f("fPassword")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password
          aria-invalid=${String(!!s.password)} .value=${this.draft.password} @input=${r=>this.field("password",r.target.value)} />
          <span class="hint">${f("fPasswordHint",{min:e.password.min_length})}</span>${t("password")}</label>
        <label>${f("fPassword2")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password2
          aria-invalid=${String(!!s.password2)} .value=${this.draft.password2} @input=${r=>this.field("password2",r.target.value)} />${t("password2")}</label>
        <label>${f("fRole")}<sw-field><select class="in" data-f-role .value=${this.draft.role_id} @change=${r=>this.field("role_id",r.target.value)}>
          ${e.roles.map(r=>a`<option value=${r.id} ?selected=${r.id===this.draft.role_id}>${r.name}</option>`)}</select></sw-field>${t("role_id")}</label>
        ${e.scopes.length>1?a`<label>${f("fScope")}<sw-field><select class="in" data-f-scope .value=${this.draft.scope} @change=${r=>this.field("scope",r.target.value)}>
          ${e.scopes.map(r=>a`<option value=${`${r.type}:${r.id}`} ?selected=${`${r.type}:${r.id}`===this.draft.scope}>${r.name}</option>`)}</select></sw-field></label>`:p}
        <label class="check"><sw-toggle data-f-person .checked=${this.draft.create_person} @change=${r=>this.draft={...this.draft,create_person:r.target.checked}}></sw-toggle>${f("fPerson")}</label>
        ${this.formError?a`<span class="msg err" role="alert" data-form-error><sw-icon name="warning" size=${13}></sw-icon>${this.formError}</span>`:p}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.closeCreate()}>${f("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-f-submit ?disabled=${this.busy} @click=${()=>void this.submitCreate()}>${f("create")}</sw-button>
    </sw-dialog>`}renderConfirm(){const e=this.confirm,s=e?.user.display_name??"";return a`<sw-dialog heading=${e?f(e.kind==="activate"?"activateTitle":"deactivateTitle",{name:s}):""} .open=${!!e} data-ha-confirm @close=${()=>this.confirm=null}>
      <p class="body">${e?f(e.kind==="activate"?"activateBody":"deactivateBody"):""}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirm=null}>${f("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-go ?disabled=${this.busy} @click=${()=>void this.submitConfirm()}>${f("confirm")}</sw-button>
    </sw-dialog>`}renderRemove(){const e=this.removing;return a`<sw-dialog heading=${e?f("removeTitle",{name:e.display_name}):""} .open=${!!e} data-ha-remove @close=${()=>{this.removing=null,this.typed=""}}>
      <div class="form">
        <p class="body">${f("removeBody")}</p>
        <label>${e?f("removeType",{username:e.username}):""}<input class="in ltr" dir="ltr" autocomplete="off" spellcheck="false" data-remove-typed .value=${this.typed}
          @input=${s=>this.typed=s.target.value} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.removing=null,this.typed=""}}>${f("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-remove-go ?disabled=${this.busy||!e||!Ie(this.typed,e.username)} @click=${()=>void this.submitRemove()}>${f("removeConfirm")}</sw-button>
    </sw-dialog>`}render(){if(this.loadState==="loading")return a`<sw-state-panel state="loading"></sw-state-panel>`;if(this.loadState==="forbidden")return a`<sw-state-panel state="forbidden" heading=${f("forbidden")}></sw-state-panel>`;if(this.loadState==="error"||!this.view)return a`<sw-state-panel state="error" heading=${this.error} actionLabel=${f("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.view;return a`<div class="stack" data-ha-users>
      <p class="body">${f("sub")}</p>
      ${this.ok||this.error?a`<div>${this.ok?a`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.ok}</span>`:p}${this.error?a`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:p}</div>`:p}
      ${this.renderAccess(e)}
      ${this.renderList(e)}
      ${this.renderCreate(e)}${this.renderConfirm()}${this.renderRemove()}
    </div>`}};R.styles=[Ce,ss,B`
    .stack { display: flex; flex-direction: column; gap: var(--sw-s-3); max-inline-size: 960px; }
    .access { display: flex; align-items: flex-start; gap: var(--sw-s-3); flex-wrap: wrap; }
    .access .text { flex: 1; min-inline-size: 220px; display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .access .fix { color: var(--sw-text-2); font-size: var(--sw-fs-xs); line-height: 1.6; }
    .access .meta { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .tone-ok { color: var(--sw-success-text); }
    .tone-warn { color: var(--sw-warning-text); }
    .tone-err { color: var(--sw-danger-text); }
    .head { display: flex; align-items: center; gap: var(--sw-s-2); flex-wrap: wrap; margin-block-end: var(--sw-s-2); }
    .head h3 { margin: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-text); }
    .head .grow { flex: 1; }
    .head .count { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .list { display: flex; flex-direction: column; }
    .item { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.2fr) 6.5rem 13rem; gap: var(--sw-s-2) var(--sw-s-3); align-items: center;
      padding-block: 10px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .item:last-child { border-block-end: 0; }
    .item.hdr { color: var(--sw-text-3); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); padding-block: 4px; }
    .name { display: flex; flex-direction: column; min-inline-size: 0; }
    .name .sub { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    ${Je}
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .chip.active { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .chip.inactive { background: var(--sw-surface-3); color: var(--sw-text-2); }
    .chip.needs_repair { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .row-actions { display: flex; gap: var(--sw-s-1); flex-wrap: wrap; justify-content: flex-end; }
    .form { display: flex; flex-direction: column; gap: var(--sw-s-3); min-inline-size: min(440px, 100%); }
    .form label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .form .hint { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .in { box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
      background: var(--sw-surface-solid); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); inline-size: 100%; min-inline-size: 0; }
    .in[aria-invalid='true'] { border-color: var(--sw-danger); }
    /* NATIVE-SELECT-A-2480: the select sits in sw-field; its block padding stays the browser's 0 (the field's 5 px would make it taller) */
    select.in { padding-block: 0; }
    .in:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
    .ferr { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .form label.check { flex-direction: row; align-items: center; gap: var(--sw-s-2); }
    .body { font-size: var(--sw-fs-sm); color: var(--sw-text-2); line-height: 1.6; margin: 0; }
    @media (max-width: 720px) {
      .item { grid-template-columns: minmax(0, 1fr) auto; }
      .item.hdr { display: none; }
      .item .role, .item .user { grid-column: 1 / -1; }
      .row-actions { grid-column: 1 / -1; justify-content: flex-start; }
    }
  `];M([h()],R.prototype,"view",2);M([h()],R.prototype,"loadState",2);M([h()],R.prototype,"error",2);M([h()],R.prototype,"busy",2);M([h()],R.prototype,"checking",2);M([h()],R.prototype,"createOpen",2);M([h()],R.prototype,"draft",2);M([h()],R.prototype,"touched",2);M([h()],R.prototype,"formError",2);M([h()],R.prototype,"confirm",2);M([h()],R.prototype,"removing",2);M([h()],R.prototype,"typed",2);R=M([W("sw-ha-users")],R);const jt=(e,s)=>e.trim().toLocaleLowerCase()===s.trim().toLocaleLowerCase();function me(e,s,t){const r=(e??"").trim(),n=(s??"").trim()||(t??"").trim();return n?r&&jt(r,n)?"":n:""}var Dt=Object.defineProperty,Ht=Object.getOwnPropertyDescriptor,K=(e,s,t,r)=>{for(var n=r>1?void 0:r?Ht(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&Dt(s,t,n),n};function be(e,s=Xs()){return s==="en"&&e.en||e.he}let j=class extends q{constructor(){super(...arguments),this.remote=!1,this.data=null,this.notShown=!1,this.error="",this.saved=!1,this.busy=!1,this.value="",this.runText="",this.runSaved=!1}connectedCallback(){super.connectedCallback(),this.remote||this.load()}async load(){try{const e=await G("/identity/service-identity");this.data=e,this.value=e.configured_user_id??"",this.runText=(e.runnable?.ids??[]).join(", "),this.error=""}catch(e){e instanceof le&&(e.status===403||e.status===404)?this.notShown=!0:this.error=b(e)}}async save(e=!1){this.busy=!0,this.error="",this.saved=!1;try{const s=await H("/identity/service-identity",{user_id:e?null:this.value.trim()||null});this.data=s,this.value=s.configured_user_id??"",this.saved=!0}catch(s){this.error=b(s)}finally{this.busy=!1}}async saveRunnable(){this.busy=!0,this.error="",this.runSaved=!1;try{const e=this.runText.split(/[\s,]+/).map(t=>t.trim()).filter(Boolean),s=await H("/identity/service-identity/runnable",{entity_ids:e});this.data=s,this.runText=(s.runnable?.ids??[]).join(", "),this.runSaved=!0}catch(e){this.error=b(e)}finally{this.busy=!1}}render(){if(this.remote)return a`<div class="note" data-si-remote>${c("siRemote")}</div>`;if(this.notShown)return p;const e=this.data;return a`<sw-card data-service-identity>
      <div class="body">
        <div class="head">
          <h3>${c("siTitle")}</h3>
          ${e?a`<sw-badge kind=${e.ready?"live":"partial"} label=${e.ready?c("siReady"):c("siNotReady")} data-si-state=${e.ready?"ready":"not-ready"}></sw-badge>`:p}
        </div>
        <p class="sub">${c("siSub")}</p>
        ${this.error?a`<div class="note err" role="alert" data-si-error>${this.error}</div>`:p}
        ${this.saved?a`<div class="note" role="status">${c("siSaved")}</div>`:p}
        ${e?a`
              ${e.user?a`<div class="facts" data-si-user>
                    <span>${c("siUser")}: <bdi>${e.user.name??""}</bdi> · <bdi class="id">${e.user.id}</bdi>${e.user.is_admin?a` · <strong>${c("siAdmin")}</strong>`:p}</span>
                    <span>${c("siBridge")}: <bdi>${e.bridge.version??"?"}</bdi> · ${e.bridge.agrees?c("siAgrees"):c("siDiffers")}</span>
                  </div>`:p}
              ${e.extended?a`<div class="note ${e.extended.requested?"warn":""}" data-si-extended=${e.extended.on?"on":e.extended.requested?"requested":"off"}>
                    ${e.extended.requested?c("siExtendedOn"):c("siExtendedOff")}
                    ${e.extended.doors_addon_only?a`<div data-si-doors-addon-only>${c("siDoorsAddonOnly")}</div>`:p}
                    <div data-si-policy-risk>${c("siPolicyRisk")}</div>
                  </div>`:p}
              ${e.steps.length?a`<div class="note warn" data-si-steps>
                    <div class="label">${c("siNeeded")}</div>
                    <ol>${e.steps.map(s=>a`<li data-si-step=${s.code}>${be(s)}</li>`)}</ol>
                  </div>`:p}
              <div class="row">
                <label
                  >${c("siUserId")}
                  <input
                    .value=${this.value}
                    maxlength="64"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder=${c("siPlaceholder")}
                    @input=${s=>this.value=s.target.value}
                    data-si-input
                /></label>
                <sw-button variant="primary" ?disabled=${this.busy} @click=${()=>this.save()} data-si-save>${c("siSave")}</sw-button>
                ${e.configured_user_id?a`<sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.save(!0)} data-si-clear>${c("siClear")}</sw-button>`:p}
              </div>
              ${e.runnable?a`<div class="runnable" data-si-runnable=${e.runnable.agrees?"agrees":"differs"}>
                    <div class="label">${c("siRunTitle")}</div>
                    <p class="sub">${c("siRunSub")}</p>
                    <div class="row">
                      <label
                        >${c("siRunLabel")}
                        <input
                          .value=${this.runText}
                          spellcheck="false"
                          autocomplete="off"
                          placeholder="script.evening_lights, scene.movie"
                          @input=${s=>this.runText=s.target.value}
                          data-si-run-input
                      /></label>
                      <sw-button variant="secondary" ?disabled=${this.busy} @click=${()=>this.saveRunnable()} data-si-run-save>${c("siRunSave")}</sw-button>
                    </div>
                    ${this.runSaved?a`<div class="note" role="status" data-si-run-saved>${c("siRunSaved")}</div>`:p}
                    <div class="facts">
                      <span data-si-run-bridge
                        >${c("siRunBridge")}:
                        ${e.runnable.bridge_ids.length?a`<bdi class="id">${e.runnable.bridge_ids.join(", ")}</bdi>`:c("siRunEmpty")}</span
                      >
                      <span>${e.runnable.agrees?c("siRunAgrees"):c("siRunDiffers")}</span>
                    </div>
                  </div>`:p}
              <div class="cols">
                <div>
                  <div class="label">${c("siAllowed")}</div>
                  <ul data-si-allowed>${e.allowed.map(s=>a`<li>${be(s)}</li>`)}</ul>
                </div>
                <div>
                  <div class="label">${c("siRefused")}</div>
                  <ul data-si-refused>${e.refused.map(s=>a`<li>${be(s)}</li>`)}</ul>
                </div>
              </div>
            `:a`<div class="sub">…</div>`}
      </div>
    </sw-card>`}};j.styles=B`
    :host {
      display: block;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md, 1rem);
      font-weight: var(--sw-fw-semibold, 600);
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      max-inline-size: 75ch;
      margin: 0;
    }
    .note {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .note.warn {
      background: var(--sw-warning-soft, var(--sw-accent-soft));
    }
    ol,
    ul {
      margin: 0;
      padding-inline-start: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      margin-block-end: 4px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-end;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      flex: 1 1 260px;
      min-inline-size: 0;
    }
    input {
      font: inherit;
      min-block-size: 40px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      inline-size: 100%;
      box-sizing: border-box;
      direction: ltr;
      text-align: start;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    [data-si-doors-addon-only],
    [data-si-policy-risk] {
      margin-block-start: 6px;
    }
    .runnable {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-block-start: 1px solid var(--sw-border, transparent);
      padding-block-start: 10px;
    }
    bdi.id {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      word-break: break-all;
    }
  `;K([te({type:Boolean})],j.prototype,"remote",2);K([h()],j.prototype,"data",2);K([h()],j.prototype,"notShown",2);K([h()],j.prototype,"error",2);K([h()],j.prototype,"saved",2);K([h()],j.prototype,"busy",2);K([h()],j.prototype,"value",2);K([h()],j.prototype,"runText",2);K([h()],j.prototype,"runSaved",2);j=K([W("system-service-identity")],j);var Nt=Object.defineProperty,Tt=Object.getOwnPropertyDescriptor,k=(e,s,t,r)=>{for(var n=r>1?void 0:r?Tt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&Nt(s,t,n),n};const He=e=>!!e.id&&X.me?.user.id===e.id,ne={password:"",again:"",must:!0},ye="display:flex;flex-direction:column;gap:2px;align-items:flex-start",_e="color:var(--sw-text-3);font-size:var(--sw-fs-xs)",Ne="display:flex;flex-wrap:wrap;gap:4px",Gt=new Set(["rbac.assign","identity.directory.read","system.configure","identity.local.manage","rbac.roles.manage","sources.configure","audit.read","backup.manage","nvr.configure","system.update"]);function ce(e){return!!e&&e.permissions.some(s=>Gt.has(s))}function Se(e){return e.filter(s=>s.id!=="system_admin"&&!s.system_role)}function Te(e){return e.url??Y("https://<כתובת הגישה מרחוק>{path}",{path:e.path})}function Ge(e){return e?`⁦${e}⁩`:""}let y=class extends q{constructor(){super(...arguments),this.roles=[],this.scopes=[],this.data=null,this.error="",this.busy=!1,this.creating=!1,this.selected=null,this.link=null,this.copied=!1,this.suggest="",this.form={username:"",display_name:"",role_id:"viewer",scope:"installation:*",email:"",notes:"",reset_mode:"manager_only"},this.roleEdit=null,this.pwMode="set",this.pw={...ne},this.formError="",this.done="",this.pwEdit=null,this.pwError="",this.sent=null,this.publicUrl="",this.publicUrlNote="",this.pk=null,this.pkStepUp=!1,this.pkCode="",this.pkArm=null,this.switching=null,this.switched="",this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.pkRequested=null}connectedCallback(){super.connectedCallback(),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),this.load()}disconnectedCallback(){this.narrowMq?.removeEventListener("change",this.onNarrow),super.disconnectedCallback()}async load(){try{this.data=await G("/identity/local-users"),this.publicUrl||(this.publicUrl=this.data.public_url??""),this.error=""}catch(e){this.error=b(e)}}async run(e){this.busy=!0,this.error="";try{await e()}catch(s){this.error=b(s)}finally{this.busy=!1}}get remote(){return this.data?.channel==="remote"}roleOf(e){return this.roles.find(s=>s.id===e)}scopeParts(e){const s=e.indexOf(":");return{scope_type:e.slice(0,s),scope_id:e.slice(s+1)}}closeCreate(){this.creating=!1,this.formError="",this.pw={...ne,must:this.pw.must}}get pwMin(){return this.data?.password_min??12}pwProblem(e){return!e.password||!e.again?c("pwMissing"):e.password!==e.again?c("mismatch"):[...e.password].length<this.pwMin?c("pwTooShort",{min:this.pwMin}):""}async create(e){if(e.preventDefault(),this.busy)return;const s=this.form;if(this.remote&&ce(this.roleOf(s.role_id)))return;const t=this.pwMode==="set",r=this.pw;if(this.formError=!s.username.trim()||!s.display_name.trim()?c("fillUsernameName"):t?this.pwProblem(r):"",!this.formError){this.busy=!0,this.error="";try{const n=await J("/identity/local-users",{username:s.username.trim(),display_name:s.display_name.trim(),role_id:s.role_id,...this.scopeParts(s.scope),email:s.email.trim()||null,notes:s.notes.trim()||null,reset_mode:s.reset_mode,...t?{password:r.password,must_change:r.must}:{}});this.link=n.link?{...n.link,user:n.user.display_name}:null,this.done=n.link?"":c(n.user.must_change_password?"createdWithPwChange":"createdWithPw",{name:n.user.display_name,username:n.user.username}),this.copied=!1,this.creating=!1,this.form={...this.form,username:"",display_name:"",email:"",notes:""},this.pw={...ne,must:r.must},await this.load()}catch(n){this.formError=b(n)}finally{this.busy=!1}}}async savePassword(e,s){s?.preventDefault();const t=this.pwEdit;if(!(!t||this.busy)&&(this.pwError=this.pwProblem(t),!this.pwError)){this.busy=!0,this.error="";try{await H(`/identity/local-users/${encodeURIComponent(e.id)}/password`,{password:t.password,must_change:t.must}),this.pwEdit=null,this.link=null,this.done=c(t.must?"pwSetDoneChange":"pwSetDone",{name:e.display_name}),await this.load()}catch(r){this.pwError=b(r)}finally{this.busy=!1}}}renderPwFields(e,s,t){const r=n=>o=>s({...e,[n]:o.target.value});return a`<label>${c("pwField")}<sw-field><input class="ltr" type="password" autocomplete="new-password" maxlength="128" .value=${e.password} @input=${r("password")} data-local-pw=${t} /></sw-field>
        <span class="muted">${c("pwHint",{min:this.pwMin})}</span></label>
      <label>${c("pwAgain")}<sw-field><input class="ltr" type="password" autocomplete="new-password" maxlength="128" .value=${e.again} @input=${r("again")} data-local-pw-again=${t} /></sw-field></label>
      <label class="full check"><sw-toggle size="sm" labelHidden in-label label=${c(t==="user"?"pwMustChangeNext":"pwMustChange")} .checked=${e.must} @change=${n=>s({...e,must:ue(n)})} data-local-pw-must=${t}></sw-toggle>
        ${c(t==="user"?"pwMustChangeNext":"pwMustChange")}</label>
      <div class="muted full">${c("pwMustChangeHelp")}</div>`}issue(e,s,t=!1){this.run(async()=>{const r=await J(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"shown",temporary:t});this.link={...r.link,user:e.display_name},this.sent=null,this.copied=!1,await this.load()})}issueWhatsapp(e,s){this.run(async()=>{const t=await J(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"whatsapp"});this.link=null,this.sent={user:e.display_name,to:e.whatsapp?.masked??"",expires_at:t.link.expires_at},await this.load()})}savePublicUrl(){this.run(async()=>{await ee("/settings",{"security.local_public_url":this.publicUrl.trim()}),this.publicUrlNote=c("publicUrlSaved"),this.publicUrl="",await this.load()})}applySwitch(){const e=this.switching;e&&(this.switched="",this.run(async()=>{try{await ee("/settings",{"security.local_identity":e})}finally{this.switching=null}this.creating=!1,this.selected=null,this.roleEdit=null,this.pwEdit=null,this.pw={...ne},this.done="",this.link=null,this.sent=null,this.switched=c(e==="on"?"switchedOn":"switchedOff"),await this.load()}))}renderSwitchDialog(){const e=this.switching;return e?a`<sw-dialog open heading=${c(e==="on"?"switchOn":"switchOff")} ?locked=${this.busy} data-local-switch-dialog=${e} @close=${()=>this.switching=null}>
      <div class="sub" data-local-switch-body>${c(e==="on"?"switchOnBody":"switchOffBody")}</div>
      <sw-button slot="footer" variant="ghost" ?disabled=${this.busy} @click=${()=>this.switching=null}>${c("cancel")}</sw-button>
      <sw-button slot="footer" variant=${e==="on"?"primary":"danger"} ?disabled=${this.busy} @click=${()=>this.applySwitch()} data-local-switch-confirm>${c(e==="on"?"switchOn":"switchOff")}</sw-button>
    </sw-dialog>`:p}async copy(){if(this.link)try{await navigator.clipboard.writeText(Te(this.link)),this.copied=!0}catch{this.copied=!1}}async setActive(e,s){!s&&!await he({body:c("disableConfirm",{name:e.display_name}),danger:!0,confirmLabel:c("disable")})||this.run(async()=>{const t=await ee(`/identity/local-users/${encodeURIComponent(e.id)}`,{active:s});this.suggest=t.suggest_also?c("suggestAlso"):"",await this.load()})}setResetMode(e,s){this.run(async()=>{await ee(`/identity/local-users/${encodeURIComponent(e.id)}`,{reset_mode:s}),await this.load()})}async removeUser(e){await he({body:c("removeConfirm",{name:e.display_name}),danger:!0})&&this.run(async()=>{await vs(`/identity/local-users/${encodeURIComponent(e.id)}`),this.selected=null,await this.load()})}simple(e,s){this.run(async()=>{await J(`/identity/local-users/${encodeURIComponent(e.id)}/${s}`),await this.load()})}async loadPasskeys(e){try{const s=await Qs(e);this.selected===e&&(this.pk={userId:e,items:s.credentials})}catch{this.pk=null}}async armPasskeyRemove(e,s){this.pkArm={pk:s,check:void 0,typed:"",error:""},this.pkCode="";let t=null;try{t=await et(e.id,s)}catch{t=null}this.pkArm?.pk!==s||this.selected!==e.id||(this.pkArm={...this.pkArm,check:t},t?.step_up.methods.includes("totp")&&(this.pkStepUp=!0))}pkReady(){const e=this.pkArm;return!!e&&e.check!==void 0&&!oe(e.check)&&Ke(e.check,e.typed)&&(!this.pkStepUp||/^\d{6}$/.test(this.pkCode))}async removePasskey(e){const s=this.pkArm;if(!(!s||!this.pkReady()||this.busy)){this.busy=!0;try{await st(e.id,s.pk,s.typed,this.pkStepUp?this.pkCode.trim():void 0),this.pkArm=null,this.pkCode="",await this.load(),await this.loadPasskeys(e.id)}catch(t){t instanceof le&&t.body.code==="second_factor_step_up_required"&&(this.pkStepUp=!0);const r=t instanceof le&&t.body.code==="reauth_required"?c("passkeyReauth"):Ve(t);this.pkArm?.pk===s.pk&&(this.pkArm={...this.pkArm,error:r})}finally{this.busy=!1}}}renderPasskeyRemove(e,s){const t=oe(s.check);return a`<div class="pk-reset" data-local-passkey-remove-box>
      <div class="lbl">${c("passkeyAdminRemoveConfirm")}</div>
      ${Ye(s.check,s.typed,r=>{this.pkArm&&(this.pkArm={...this.pkArm,typed:r,error:""})},()=>void this.removePasskey(e))}
      ${this.pkStepUp&&!t&&s.check!==void 0?a`<label>${c("code")}<sw-field><input class="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6" .value=${this.pkCode}
            @input=${r=>this.pkCode=r.target.value.replace(/\D/g,"").slice(0,6)} data-local-passkey-code /></sw-field></label>`:p}
      <div class="actions">
        ${t?p:a`<sw-button size="sm" variant="danger" ?disabled=${this.busy||!this.pkReady()} @click=${()=>void this.removePasskey(e)} data-local-passkey-remove-confirm>${c("passkeyAdminRemove")}</sw-button>`}
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>{this.pkArm=null,this.pkCode=""}} data-local-passkey-remove-cancel>${c("cancel")}</sw-button>
      </div>
      ${s.error?a`<div class="err" role="alert" data-local-passkey-remove-error>${s.error}</div>`:p}
    </div>`}passkeyFirstOff(e){this.run(async()=>{await ee(`/identity/local-users/${encodeURIComponent(e.id)}`,{passkey_first:!1}),await this.load()})}async passkeyOnly(e,s){await he({body:ie(s?"onlyConfirmOn":"onlyConfirmOff"),danger:s})&&this.run(async()=>{await tt(e.id,s),await this.load()})}setPasskeyFirstAllowed(e){this.run(async()=>{await ee("/settings",{"security.local_passkey_first":e?"on":"off"}),await this.load()})}renderPasskeys(e,s){this.pkRequested!==e.id&&(this.pkRequested=e.id,Promise.resolve().then(()=>(this.pkStepUp=!1,this.pkArm=null,this.loadPasskeys(e.id))));const t=this.pk?.userId===e.id?this.pk.items:[];return a`<div class="full cell" data-local-passkeys>
      <span class="muted">${c("passkeysCount",{n:e.passkeys??t.length})}${e.passkey_first?a` · ${c("passkeyFirstOn")}`:p}${e.passkey_only?a` · ${ie("onlyOn")}`:p}</span>
      ${t.map(r=>a`<span class="muted" data-local-passkey=${r.id}>${r.label||c("passkeys")} · ${C(r.created_at)}${r.synced?a` · ${c("passkeySynced")}`:p}${r.usable?p:a` · ${c("passkeyNotUsable")}`}
        ${s&&this.pkArm?.pk!==r.id?a`<sw-button size="sm" variant="ghost" @click=${()=>void this.armPasskeyRemove(e,r.id)} ?disabled=${this.busy} data-local-passkey-remove>${c("passkeyAdminRemove")}</sw-button>`:p}</span>
        ${s&&this.pkArm&&this.pkArm.pk===r.id?this.renderPasskeyRemove(e,this.pkArm):p}`)}
      ${s&&(e.passkey_only||this.data?.passkey_first_allowed&&(e.passkeys??t.length)>0)?a`<div class="actions"><sw-button @click=${()=>this.passkeyOnly(e,!e.passkey_only)} ?disabled=${this.busy} data-local-passkey-only>${e.passkey_only?ie("onlyDisable"):ie("onlyEnable")} · ${ie("onlyLabel")}</sw-button></div>`:p}
      ${s&&e.passkey_first&&!e.passkey_only?a`<div class="actions"><sw-button @click=${()=>this.passkeyFirstOff(e)} ?disabled=${this.busy} data-local-passkey-first-off>${c("passkeyFirstAdminOff")}</sw-button></div>`:p}
    </div>`}saveRole(e){const s=this.roleEdit;s&&this.run(async()=>{await H(`/identity/local-users/${encodeURIComponent(e.id)}/role`,{role_id:s.role_id,...this.scopeParts(s.scope)}),this.roleEdit=null,await this.load()})}statusBadge(e){const s=e.status==="active"?"live":e.status==="delayed"?"stale":e.status==="pending_first_login"?"neutral":"offline";return a`<sw-badge kind=${s} label=${c(`status_${e.status}`)}></sw-badge>`}renderCreate(){const e=this.form,s=Se(this.roles),t=ce(this.roleOf(e.role_id)),r=n=>o=>this.form={...this.form,[n]:o.target.value};return a`<sw-card flush data-local-create>
      <form @submit=${this.create} novalidate>
        <div class="head"><div class="cell"><strong>${c("add")}</strong></div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${c("cancel")} @click=${()=>this.closeCreate()}></sw-button></div>
        <label>${c("colUsername")}<sw-field><input class="ltr" .value=${e.username} @input=${r("username")} autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" required data-local-username /></sw-field>
          <span class="muted">${c("usernameHint")}</span></label>
        <label>${c("displayName")}<sw-field><input .value=${e.display_name} @input=${r("display_name")} maxlength="60" required data-local-display /></sw-field></label>
        <label>${c("role")}<sw-field><select .value=${e.role_id} @change=${r("role_id")} data-local-role>
          ${s.map(n=>a`<option value=${n.id} ?selected=${n.id===e.role_id} ?disabled=${this.remote&&ce(n)}>${n.name}</option>`)}
        </select></sw-field></label>
        <label>${c("scope")}<sw-field><select .value=${e.scope} @change=${r("scope")}>
          ${this.scopes.map(n=>a`<option value=${`${n.type}:${n.id}`} ?selected=${`${n.type}:${n.id}`===e.scope}>${n.name}</option>`)}
        </select></sw-field></label>
        <label>${c("email")}<sw-field><input class="ltr" type="email" .value=${e.email} @input=${r("email")} maxlength="254" /></sw-field></label>
        <label>${c("notes")}<sw-field><input .value=${e.notes} @input=${r("notes")} maxlength="200" /></sw-field></label>
        <label>${c("resetMode")}<sw-field><select .value=${t?"manager_only":e.reset_mode} @change=${r("reset_mode")} ?disabled=${t} data-local-reset-mode>
          <option value="manager_only">${c("reset_manager_only")}</option>
          <option value="self_service">${c("reset_self_service")}</option>
        </select></sw-field></label>
        ${t?a`<div class="note warn full" data-local-admin-note>${c("adminNote")} ${c("resetAdminNote")}</div>`:p}
        <div class="sep" role="presentation"></div>
        <label class="full">${c("pwHow")}<sw-field><select .value=${this.pwMode} @change=${n=>{this.pwMode=n.target.value==="link"?"link":"set",this.formError=""}} data-local-pw-mode>
          <option value="set" ?selected=${this.pwMode==="set"}>${c("pwHowSet")}</option>
          <option value="link" ?selected=${this.pwMode==="link"}>${c("pwHowLink")}</option>
        </select></sw-field></label>
        ${this.pwMode==="set"?this.renderPwFields(this.pw,n=>this.pw=n,"create"):a`<div class="muted full" data-local-pw-link-help>${c("pwLinkHelp")}</div>`}
        ${this.formError?a`<div class="note err full" role="alert" data-local-create-error>${this.formError}</div>`:p}
        <div class="actions">
          <sw-button variant="primary" type="submit" ?disabled=${this.busy||t&&this.remote} data-local-create-save>${c("create")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.closeCreate()}>${c("cancel")}</sw-button>
        </div>
        <!-- Enter in a field submits: the visible button sits in sw-button's shadow root, so the form needs a submit button of its own -->
        <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
      </form>
    </sw-card>`}renderLink(){const e=this.link;return e?a`<sw-card flush data-local-link>
      <div class="panel">
        <div class="full"><strong>${e.purpose==="reset"?c("linkResetTitle"):c("linkTitle")} · ${e.user}</strong></div>
        <div class="note full">${c("linkOnce",{until:C(e.expires_at)})}</div>
        <div class="link full" data-local-link-text>${Te(e)}</div>
        <div class="actions">
          <sw-button variant="primary" icon="link" @click=${()=>void this.copy()}>${this.copied?c("copied"):c("copy")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.link=null}>${c("close")}</sw-button>
        </div>
      </div>
    </sw-card>`:p}renderSent(){const e=this.sent;return e?a`<div class="note" role="status" data-local-link-sent>${e.user} · ${c("waSent",{to:Ge(e.to),until:C(e.expires_at)})}
      <sw-button variant="ghost" @click=${()=>this.sent=null}>${c("close")}</sw-button></div>`:p}renderWhatsapp(e){const s=this.data?.whatsapp_ready??!1,t=!!e.whatsapp?.verified,r=e.status==="pending_first_login"?"first_login":"reset";return e.admin?a`<div class="muted full" data-local-wa-admin>${c("waAdminNote")}</div>`:a`<div class="full cell" data-local-wa>
      <span class="muted" data-local-wa-state>${t?c("waVerified",{masked:Ge(e.whatsapp?.masked??"")}):c("waNone")}</span>
      ${s?p:a`<span class="muted" data-local-wa-off>${c("waChannelOff")}</span>`}
      ${s&&t?a`<div class="actions"><sw-button @click=${()=>this.issueWhatsapp(e,r)} ?disabled=${this.busy||!e.active} data-local-issue-wa=${r}>
            ${r==="first_login"?c("issueFirstWa"):c("issueResetWa")}</sw-button></div>`:p}
    </div>`}renderSelected(e){const s=this.data?.can_manage??!1,t=e.admin&&this.remote,r=He(e),n=Se(this.roles),o=this.roleEdit;return a`<sw-card flush data-local-user=${e.id}>
      <div class="panel">
        <div class="head">
          <div class="cell">
            <strong>${e.display_name}</strong>
            <span class="muted">${me(e.display_name,e.username)?a`<bdi>${e.username}</bdi> · `:p}${e.role_name??"—"} · ${e.scope_name??"—"} · ${c("sessions")}: ${e.sessions}</span>
            <span class="muted" data-local-user-meta>${c("colLast")}: ${e.last_sign_in_at?C(e.last_sign_in_at):c("never")} · ${c("colFactor")}: ${e.second_factor?c("factorOn"):c("factorOff")}</span>
            ${e.admin?a`<span class="muted">${c("adminNote")}</span>`:p}
          </div>
          ${this.statusBadge(e)}
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${c("close")} data-local-user-close @click=${()=>{this.selected=null,this.roleEdit=null,this.pwEdit=null}}></sw-button>
        </div>
        ${s?a`<div class="actions">
              ${t?a`<span class="muted" data-local-only>${c("localOnly")}</span>`:e.status==="pending_first_login"?a`<sw-button @click=${()=>this.issue(e,"first_login")} ?disabled=${this.busy||!e.active} data-local-issue="first_login">${c("issueFirst")}</sw-button>`:a`<sw-button @click=${()=>this.issue(e,"reset")} ?disabled=${this.busy||!e.active} data-local-issue="reset">${c("issueReset")}</sw-button>
                    <sw-button variant="ghost" @click=${()=>this.issue(e,"reset",!0)} ?disabled=${this.busy||!e.active}>${c("temporary")}</sw-button>`}
              ${e.status==="delayed"?a`<sw-button @click=${()=>this.simple(e,"unlock")} ?disabled=${this.busy}>${c("unlock")}</sw-button>`:p}
              ${t?p:a`<sw-button @click=${()=>{this.pwEdit=this.pwEdit?null:{...ne},this.pwError=""}} ?disabled=${this.busy||!e.active} data-local-pw-set>${c("pwSet")}</sw-button>`}
              <sw-button @click=${()=>this.simple(e,"sessions/revoke")} ?disabled=${this.busy||!e.sessions}>${c("endSessions")}</sw-button>
              ${r?p:a`<sw-button @click=${()=>void this.setActive(e,!e.active)} ?disabled=${this.busy} data-local-active=${e.active?"disable":"enable"}>${e.active?c("disable"):c("enable")}</sw-button>`}
              <sw-button @click=${()=>this.roleEdit={role_id:e.role_id??"viewer",scope:`${e.scope_type??"installation"}:${e.scope_id??"*"}`}} ?disabled=${this.busy}>${c("changeRole")}</sw-button>
              ${r?a`<span class="muted end" data-local-self-note>${c("selfNote")}</span>`:a`<sw-button class="end" variant="danger" @click=${()=>this.removeUser(e)} ?disabled=${this.busy} data-local-remove>${c("remove")}</sw-button>`}
            </div>
            ${this.pwEdit&&!t?a`<form class="full pwform" @submit=${d=>void this.savePassword(e,d)} novalidate data-local-pw-form>
                  <div class="full"><strong>${c("pwSetTitle",{name:e.display_name})}</strong></div>
                  <div class="muted full">${c("pwSetHelp")}</div>
                  ${this.renderPwFields(this.pwEdit,d=>this.pwEdit=d,"user")}
                  ${this.pwError?a`<div class="note err full" role="alert" data-local-pw-error>${this.pwError}</div>`:p}
                  <div class="actions">
                    <sw-button variant="primary" type="submit" ?disabled=${this.busy} data-local-pw-save>${c("pwSet")}</sw-button>
                    <sw-button variant="ghost" @click=${()=>this.pwEdit=null}>${c("cancel")}</sw-button>
                  </div>
                  <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
                </form>`:p}
            <div class="sep" role="presentation"></div>
            <label>${c("resetMode")}<sw-field><select .value=${e.reset_mode} ?disabled=${this.busy||e.admin} @change=${d=>this.setResetMode(e,d.target.value)}>
              <option value="manager_only">${c("reset_manager_only")}</option>
              <option value="self_service">${c("reset_self_service")}</option>
            </select></sw-field></label>
            ${e.admin?a`<div class="muted full" data-local-reset-admin>${c("resetAdminNote")}</div>`:e.self_service_blocked?a`<div class="note warn full" data-local-reset-blocked=${e.self_service_blocked}>${c(`blocked_${e.self_service_blocked}`)}</div>`:a`<div class="muted full">${c("resetModeHelp")}</div>`}
            ${this.renderWhatsapp(e)}
            ${this.renderPasskeys(e,s)}
            ${o?a`<label>${c("role")}<sw-field><select .value=${o.role_id} @change=${d=>this.roleEdit={...o,role_id:d.target.value}}>
                    ${n.map(d=>a`<option value=${d.id} ?selected=${d.id===o.role_id} ?disabled=${this.remote&&ce(d)}>${d.name}</option>`)}
                  </select></sw-field></label>
                  <label>${c("scope")}<sw-field><select .value=${o.scope} @change=${d=>this.roleEdit={...o,scope:d.target.value}}>
                    ${this.scopes.map(d=>a`<option value=${`${d.type}:${d.id}`} ?selected=${`${d.type}:${d.id}`===o.scope}>${d.name}</option>`)}
                  </select></sw-field></label>
                  <div class="actions"><sw-button variant="primary" @click=${()=>this.saveRole(e)} ?disabled=${this.busy}>${c("save")}</sw-button><sw-button variant="ghost" @click=${()=>this.roleEdit=null}>${c("cancel")}</sw-button></div>`:p}`:p}
      </div>
    </sw-card>`}renderPublicUrl(e){return a`<sw-card flush data-local-public-url>
      <div class="panel">
        <label class="full">${c("publicUrl")}
          <sw-field><input class="ltr" type="url" inputmode="url" placeholder=${e.public_url??"https://"} .value=${this.publicUrl}
            @input=${s=>this.publicUrl=s.target.value} maxlength="300" data-local-public-url-input /></sw-field></label>
        <div class="muted full">${c("publicUrlHint")}</div>
        ${this.publicUrlNote?a`<div class="note full" role="status">${this.publicUrlNote}</div>`:p}
        <div class="actions"><sw-button @click=${()=>this.savePublicUrl()} ?disabled=${this.busy} data-local-public-url-save>${c("publicUrlSave")}</sw-button></div>
        <label class="full check"><sw-toggle controlled size="sm" labelHidden in-label label=${c("passkeySettingFirst")} .checked=${!!e.passkey_first_allowed} ?disabled=${this.busy}
            @change=${s=>this.setPasskeyFirstAllowed(ue(s))} data-local-passkey-first-allowed></sw-toggle>
          ${c("passkeySettingFirst")}</label>
        <div class="muted full">${c("passkeySettingHelp")}</div>
      </div>
    </sw-card>`}render(){const e=this.data;if(!e)return a`<div class="stack">${this.error?a`<sw-state-panel state="error" compact hint=${this.error} actionLabel=${Y("נסה שוב")} data-local-load-error @action=${()=>void this.load()}></sw-state-panel>`:a`<sw-state-panel state="loading" compact data-local-loading></sw-state-panel>`}</div>`;const s=o=>o,t=[{key:"name",label:c("colName"),render:o=>a`<span style=${ye}><span>${s(o).display_name}</span>${He(s(o))?a`<span style=${Ne}><sw-badge kind="neutral" label=${c("youBadge")} data-local-self></sw-badge></span>`:p}${me(s(o).display_name,s(o).username)?a`<span style=${_e}><bdi>${s(o).username}</bdi></span>`:p}</span>`},{key:"role",label:c("colRole"),render:o=>a`<span style=${ye}><span>${s(o).role_name??"—"}</span><span style=${_e}>${s(o).scope_name??""}</span>
          <span style=${Ne}>${s(o).admin?a`<sw-badge kind="partial" label=${c("adminBadge")}></sw-badge>`:p}${s(o).ha_user_id?a`<sw-badge kind="neutral" label=${c("haBadge")}></sw-badge>`:p}</span></span>`},{key:"status",label:c("colStatus"),render:o=>this.statusBadge(s(o))},{key:"last",label:c("colLast"),render:o=>s(o).last_sign_in_at?C(s(o).last_sign_in_at):c("never")},{key:"factor",label:c("colFactor"),render:o=>a`<span style=${ye}><span>${s(o).second_factor?c("factorOn"):c("factorOff")}</span>${s(o).passkeys?a`<span style=${_e}>${c("passkeysCount",{n:s(o).passkeys??0})}</span>`:p}</span>`}],r=this.narrow?t.filter(o=>o.key!=="last"&&o.key!=="factor"):t,n=e.users.find(o=>o.id===this.selected)??null;return a`<div class="stack" data-local-users>
      <div class="bar">
        <div class="sub">${c("tabSub")}</div>
        ${e.can_manage&&e.enabled?a`<div class="actions">
              <sw-button variant="primary" icon="plus" @click=${()=>{this.creating=!this.creating,this.formError="",this.done=""}} data-local-add>${c("add")}</sw-button>
              <sw-button variant="ghost" @click=${()=>window.open(Ze("/identity/local-users/export"),"_blank","noopener")}>${c("export")}</sw-button>
            </div>`:p}
      </div>
      ${e.enabled?p:a`<div class="note warn" data-local-off>${c("off")}${e.can_switch?a`<div class="actions"><sw-button variant="primary" @click=${()=>this.switching="on"} ?disabled=${this.busy} data-local-switch="on">${c("switchOn")}</sw-button></div>`:a` <span data-local-switch-readonly>${c("offNotAdmin")}</span>`}</div>`}
      ${this.switched?a`<div class="note" role="status" data-local-switched>${this.switched}</div>`:p}
      ${this.done?a`<div class="note" role="status" data-local-done>${this.done}
          <sw-button variant="ghost" size="sm" @click=${()=>this.done=""}>${c("close")}</sw-button></div>`:p}
      ${e.can_manage?a`<system-service-identity ?remote=${this.remote}></system-service-identity>`:p}
      ${this.error?a`<div class="note err" role="alert" data-local-error>${this.error}</div>`:p}
      ${this.suggest?a`<div class="note warn" role="status">${this.suggest}</div>`:p}
      ${this.renderLink()}
      ${this.renderSent()}
      ${this.creating&&e.enabled?this.renderCreate():p}
      ${e.users.length?a`<sw-table .columns=${r} .rows=${e.users} rowKey="id" .selected=${this.selected}
            @row-select=${o=>{this.selected=o.detail.id,this.roleEdit=null,this.pwEdit=null,this.pwError=""}}></sw-table>`:a`<sw-state-panel icon="users" state="empty" compact hint=${c("empty")} data-local-empty></sw-state-panel>`}
      ${n?this.renderSelected(n):p}
      ${e.can_manage&&e.enabled?this.renderPublicUrl(e):p}
      ${e.enabled&&e.can_switch?a`<div class="bar" data-local-on>
            <div class="sub">${c("onState")}</div>
            <sw-button variant="danger" @click=${()=>this.switching="off"} ?disabled=${this.busy} data-local-switch="off">${c("switchOff")}</sw-button>
          </div>`:p}
      ${this.renderSwitchDialog()}
    </div>`}};y.styles=[We,B`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      max-inline-size: 70ch;
    }
    .note {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .note.warn {
      background: var(--sw-warning-soft, var(--sw-accent-soft));
    }
    form,
    .panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      padding: 14px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    /* CR-CMP2-SEGMENTED-B-2450 (owner N10): every text field and select of the page sits in sw-field (the shared field look, one look
       for the whole form); the LTR fields keep their direction */
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    .actions {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .link {
      direction: ltr;
      text-align: start;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      word-break: break-all;
      user-select: all;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-bg));
      border: 1px solid var(--sw-border);
    }
    .cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .full {
      grid-column: 1 / -1;
    }
    /* ACCESS-POLISH-2331: a checkbox row (the passkey-first switch) - a checkbox is never a 100 % wide, 40 px tall field */
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    label.check input {
      inline-size: 20px;
      min-block-size: 20px;
      block-size: 20px;
      flex: none;
      margin: 0;
    }
    label.check input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the selected user's and the create form's header: the title, and a close action at the far end */
    .head {
      grid-column: 1 / -1;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .head .cell {
      flex: 1;
      min-inline-size: 0;
    }
    .head strong {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
    }
    /* a destructive action stands apart from the everyday ones */
    .actions .end {
      margin-inline-start: auto;
    }
    .sep {
      grid-column: 1 / -1;
      border-block-start: 1px solid var(--sw-border);
    }
    /* CR-LOCAL-USER-CREATE-2438: the set-password panel inside the selected user's card (the card's own grid, no second padding) */
    form.pwform {
      padding: 0;
    }
    label .muted {
      font-weight: var(--sw-fw-regular, 400);
    }
    /* CR-LOCAL-ID-SWITCH-2442: the switch button under the off-state text */
    .note .actions {
      margin-block-start: 10px;
    }
    /* MFA-PASSKEY-ADMIN-REMOVE-2520: the removal's confirmation under the passkey (the factor reset's pattern, this page's tokens) */
    .pk-reset {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      align-items: flex-start;
      padding-block: var(--sw-s-2);
    }
    .pk-reset .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .pk-reset .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger-text);
    }
    .pk-reset form.typed-form {
      padding: 0;
    }
    .pk-reset input.typed {
      min-block-size: var(--sw-ctl-h-md);
      padding: var(--sw-s-1) var(--sw-s-2);
      border: thin solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-family: inherit;
    }
    .pk-reset input.typed:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
  `];k([te({attribute:!1})],y.prototype,"roles",2);k([te({attribute:!1})],y.prototype,"scopes",2);k([h()],y.prototype,"data",2);k([h()],y.prototype,"error",2);k([h()],y.prototype,"busy",2);k([h()],y.prototype,"creating",2);k([h()],y.prototype,"selected",2);k([h()],y.prototype,"link",2);k([h()],y.prototype,"copied",2);k([h()],y.prototype,"suggest",2);k([h()],y.prototype,"form",2);k([h()],y.prototype,"roleEdit",2);k([h()],y.prototype,"pwMode",2);k([h()],y.prototype,"pw",2);k([h()],y.prototype,"formError",2);k([h()],y.prototype,"done",2);k([h()],y.prototype,"pwEdit",2);k([h()],y.prototype,"pwError",2);k([h()],y.prototype,"sent",2);k([h()],y.prototype,"publicUrl",2);k([h()],y.prototype,"publicUrlNote",2);k([h()],y.prototype,"pk",2);k([h()],y.prototype,"pkStepUp",2);k([h()],y.prototype,"pkCode",2);k([h()],y.prototype,"pkArm",2);k([h()],y.prototype,"switching",2);k([h()],y.prototype,"switched",2);k([h()],y.prototype,"narrow",2);y=k([W("system-local-users")],y);const Ft=()=>G("access/capture-lease/settings"),Bt=(e,s)=>H("access/capture-lease/settings",{lookup_scope:e,...s?{lookup_scope_confirm:s}:{}});var qt=Object.defineProperty,Wt=Object.getOwnPropertyDescriptor,Q=(e,s,t,r)=>{for(var n=r>1?void 0:r?Wt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&qt(s,t,n),n};const Fe={holder:Y("מי שמחזיק כעת בהרשאה לפעולה המקורית (ברירת מחדל)"),holder_or_audit_readers:Y("גם מחזיקי הרשאת צפייה באודיט")};let F=class extends q{constructor(){super(...arguments),this.value=null,this.pending=null,this.word="",this.notAllowed=!1,this.busy=!1,this.error="",this.saved=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=await Ft();this.value=e.lookup_scope,this.pending=e.lookup_scope}catch(e){const s=e.status;s===403||s===404?this.notAllowed=!0:this.error=b(e)}}async save(){if(!(!this.pending||this.pending===this.value)){this.busy=!0,this.error="",this.saved=!1;try{const e=await Bt(this.pending,this.pending==="holder_or_audit_readers"?this.word.trim():void 0);this.value=e.lookup_scope,this.pending=e.lookup_scope,this.word="",this.saved=!0}catch(e){this.error=b(e)}finally{this.busy=!1}}}render(){if(this.notAllowed)return p;if(this.value===null)return this.error?a`<p class="err" role="alert">${this.error}</p>`:p;const e=this.pending==="holder_or_audit_readers"&&this.value!=="holder_or_audit_readers";return a`<sw-card heading=${Y("בירור מצב פעולה ישנה")} data-lookup-scope>
      <div class="row">
        <sw-field label=${Y("מי רשאי לברר מצב של פעולת אינטרקום ישנה")}>
          <select data-lookup-scope-select .value=${ze(this.pending??"holder")} ?disabled=${this.busy}
            @change=${s=>{this.pending=s.target.value,this.saved=!1}}>
            ${Object.keys(Fe).map(s=>a`<option value=${s} ?selected=${s===this.pending}>${Fe[s]}</option>`)}
          </select>
        </sw-field>
        ${e?a`<sw-field label=${Y('לאישור ההרחבה הקלידו "{word}"',{word:at("capture_lookup_wide")})}>
              <input data-lookup-scope-word .value=${ze(this.word)} ?disabled=${this.busy} @input=${s=>this.word=s.target.value} />
            </sw-field>`:p}
        <sw-button variant="primary" data-lookup-scope-save ?disabled=${this.busy||this.pending===this.value||e&&!it("capture_lookup_wide",this.word)}
          @click=${()=>void this.save()}>${Y("שמירה")}</sw-button>
      </div>
      ${this.error?a`<p class="err" role="alert">${this.error}</p>`:p}
      ${this.saved?a`<p class="ok" role="status">${Y("נשמר")}</p>`:p}
    </sw-card>`}};F.styles=B`
    :host { display: block; margin-block-end: var(--sw-space-4, 16px); }
    .row { display: flex; flex-wrap: wrap; gap: var(--sw-space-3, 12px); align-items: end; }
    select, input { min-width: 16rem; max-width: 100%; }
    .err { color: var(--sw-danger); }
    .ok { color: var(--sw-success); }
  `;Q([h()],F.prototype,"value",2);Q([h()],F.prototype,"pending",2);Q([h()],F.prototype,"word",2);Q([h()],F.prototype,"notAllowed",2);Q([h()],F.prototype,"busy",2);Q([h()],F.prototype,"error",2);Q([h()],F.prototype,"saved",2);F=Q([W("sw-lookup-scope")],F);var Kt=Object.defineProperty,Vt=Object.getOwnPropertyDescriptor,ns=(e,s,t,r)=>{for(var n=r>1?void 0:r?Vt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&Kt(s,t,n),n};let ve=class extends q{constructor(){super(...arguments),this.bubbleSkin=new Ae(this),this.roles=null}rows(){const e=new Set(this.roles?.sensitive??[]),s=t=>this.roles?.labels[t]??Xe(t)??t;return[...fs.map(t=>({id:t,label:s(t),tag:t==="energy.bills"&&(e.has(t)||!this.roles?.sensitive)?"sensitive":""})),{id:"system.configure",label:D("הגדרות שמירת נתונים"),tag:"existing"}]}holds(e,s){return e.permissions.includes(s)||e.sensitive_included.includes(s)}chip(e){return e==="sensitive"?a`<span class="chip c-warn nodot">${D("רגישה")}</span>`:e==="existing"?a`<span class="chip nodot">${D("קיימת")}</span>`:p}columns(e){return[{key:"label",label:D("הרשאה"),render:s=>a`<b>${s.label}</b> ${this.cellChip(s.tag)}<span class="t2" part="code">${s.id}</span>`},...e.roles.map(s=>({key:`role-${s.id}`,label:s.name,align:"center",cellAttrs:()=>({"data-role":s.id}),render:t=>this.holds(s,t.id)?a`<span class="tick on" part="tick tick-on" aria-label=${D("יש")}>✓</span>`:a`<span class="tick" part="tick" aria-label=${D("אין")}></span>`}))]}cellChip(e){return e==="sensitive"?a`<span class="chip" data-tone="warn" data-nodot>${D("רגישה")}</span>`:e==="existing"?a`<span class="chip" data-nodot>${D("קיימת")}</span>`:p}render(){const e=this.roles;if(!e?.roles.length)return p;const s=this.rows();return a`<section data-energy-permissions aria-label=${D("הרשאות חשמל")}>
      <h3>${D("חשמל")}</h3>
      <sw-table class="t card flush wide" static-rows data-energy-matrix .columns=${this.columns(e)} .rows=${s}
        .rowAttrs=${t=>({"data-energy-row":String(t.id)})}></sw-table>
      <div class="list phone" style="flex-direction:column">${s.map(t=>a`<div class="li" style="flex-direction:column;align-items:stretch" data-energy-row-phone=${t.id}>
        <div class="row"><b>${t.label}</b>${this.chip(t.tag)}</div>
        <div class="t2 wrap">${e.roles.filter(r=>this.holds(r,t.id)).map(r=>r.name).join(", ")||D("אין תפקיד")}</div></div>`)}</div>
    </section>`}};ve.styles=[nt,B`
      :host {
        display: block;
        margin-block-start: 14px;
      }
      h3 {
        margin: 0 0 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      sw-table::part(code) {
        font-family: var(--sw-font-mono, monospace);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        direction: ltr;
        text-align: start;
        unicode-bidi: isolate;
      }
      sw-table::part(tick) {
        display: inline-grid;
        place-items: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--sw-r-xs);
        border: 2px solid var(--sw-border-strong);
        color: var(--sw-text-inverse);
      }
      sw-table::part(tick-on) {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
      }
      .phone {
        display: none;
      }
      @media (max-width: 760px) {
        .wide {
          display: none;
        }
        .phone {
          display: flex;
        }
      }
    `];ns([te({attribute:!1})],ve.prototype,"roles",2);ve=ns([W("elec-permission-rows")],ve);function Yt(e,s){const t=new Set(s??[]);return e.filter(r=>!t.has(r))}function Jt(e,s,t){return s?e.filter(r=>!(r in s)||t.has(r)):[...e]}var Zt=Object.defineProperty,Xt=Object.getOwnPropertyDescriptor,S=(e,s,t,r)=>{for(var n=r>1?void 0:r?Xt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&Zt(s,t,n),n};const ke={light:l("תאורה"),not_light:l("לא תאורה"),protected:l("מוגן")},Qt={alarm_managed:l("נשלט ממסך האזעקה"),media_managed:l("נשלט ממסך המולטימדיה"),doors_layer:l("בשכבת הדלתות")},pe=20,ea={lights:l("תאורה"),climate:l("אקלים"),shades:l("תריסים"),doors:l("דלתות"),cameras:l("מצלמות"),energy:l("חשמל"),alerts:l("התראות"),scenes:l("סצנות"),security:l("אבטחה"),presence:l("מי בבית"),calendar:l("יומן וחדרים משותפים"),notices:l("לוח הודעות"),tickets:l("פניות שירות"),schedules:l("תזמונים"),...ht,recordings:l("הקלטות"),log:l("יומן הבית"),intercom:l("אינטרקום")};let z=class extends q{constructor(){super(...arguments),this.data=null,this.rooms=[],this.sel="",this.error="",this.message="",this.busy=!1,this.code="",this.sub="users",this.inst=null,this.vis=null,this.sw=null,this.swError="",this.swSel=new Set,this.swFilter="all",this.swArea="",this.swPage=0,this.walls=null,this.wallRoom="",this.wallStamp=0,this.wallsLoading=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const[e,s,t]=await Promise.all([G("home/policies"),lt().catch(()=>null),G("home/settings").catch(()=>null)]);this.data=e,this.inst=t?.settings??null,this.rooms=s?.rooms??[],!this.sel&&e.users[0]&&(this.sel=e.users[0].user_id),this.error=""}catch(e){this.error=b(e)}this.loadVisitors()}async loadVisitors(){if(!this.data?.users.find(s=>s.user_id===X.me?.user.id)?.system_admin){this.vis=this.data?"denied":null;return}try{this.vis=await G("access/visitors/settings")}catch{this.vis="denied"}}async saveVisitors(e){this.message="",this.busy=!0;try{this.vis=await H("access/visitors/settings",{visitors:e?"on":"off"}),this.message=e?this.vis.effective?l("הזמנת אורחים הופעלה."):l("נשמר. הזמנת אורחים תפעל רק כשגם הגישה החיצונית מופעלת."):l("הזמנת אורחים כובתה.")}catch(s){this.error=b(s)}finally{this.busy=!1}}visitorsCard(){const e=this.vis;if(e===null)return p;const s=e!=="denied"&&e.visitors==="on",t=e==="denied"?l("רק מנהל מערכת יכול להפעיל או לכבות."):s?e.effective?l('מופעל. רק מי שסומן "רשאי להזמין אורחים" ויש לו הרשאה יכול להזמין. קוד האורח לא מוצג למזמין.'):l("מופעל, אבל לא פועל עדיין: צריך להפעיל גם את הגישה החיצונית בהגדרות הגישה."):l('כבוי (ברירת המחדל בהתקנה). כשמופעל, רק מי שסומן "רשאי להזמין אורחים" ויש לו הרשאה יכול להזמין.');return a`<section class="card" aria-label="${l("הזמנת אורחים")}" data-home-visitors><h3>${l("הזמנת אורחים")}</h3>
      <div class="srow"><div><b>${l("הזמנת אורחים מהממשק הביתי")}</b><div class="note">${t}</div></div><sw-toggle label="${l("הזמנת אורחים מהממשק הביתי")}" labelHidden data-home-visitors-switch ?checked=${s} ?disabled=${e==="denied"||this.busy} @change=${r=>this.saveVisitors(r.detail.checked)}></sw-toggle></div></section>`}async save(e,s){this.busy=!0,this.message="";try{await H(`home/policies/${encodeURIComponent(e.user_id)}`,s),await this.load(),this.message=l("נשמר.")}catch(t){this.error=b(t)}finally{this.busy=!1}}async saveCode(){try{const e=await H("home/kiosk-code",{code:this.code||null});this.code="",this.message=e.kiosk_code_set?l("קוד היציאה של מסכי הקיר נשמר."):l("קוד היציאה נמחק."),await this.load()}catch(e){this.error=b(e)}}async seedFromMine(){try{const e=await dt();await H("home/seed",{seed:e.favourites}),this.message=l("המועדפים שלך נשמרו כמועדפי ההתחלה של כולם.")}catch(e){this.error=b(e)}}async loadSwitches(){try{this.sw=(await G("home/switches")).switches,this.swError=""}catch(e){this.swError=b(e)}}async saveInstall(e,s=l("נשמר. משתמשים קיימים לא הושפעו.")){this.message="",this.error="";try{this.inst=(await H("home/settings",e)).settings,this.message=s}catch(t){this.error=b(t)}}swVisible(){return(this.sw??[]).filter(e=>(this.swFilter==="all"?!0:this.swFilter==="suggested"?!!e.suggest:e.class===this.swFilter)&&(!this.swArea||(e.area_id??"")===this.swArea))}async mark(e,s){if(s.length){this.busy=!0,this.message="";try{const t=await J("home/switches",{entity_ids:s,mark:e});this.message=l('סומנו {changed} כ"{v1}".{v2}',{changed:t.changed,v1:ke[e],v2:t.refused?l(" {refused} לא שונו (נשלטים ממסך אחר).",{refused:t.refused}):""}),this.swSel=new Set,await this.loadSwitches()}catch(t){this.error=b(t)}finally{this.busy=!1}}}async approveSelected(){const e=(this.sw??[]).filter(s=>this.swSel.has(s.entity_id)&&s.suggest);for(const s of["light","protected","not_light"]){const t=e.filter(r=>r.suggest===s).map(r=>r.entity_id);t.length&&await this.mark(s,t)}}installPane(){const e=this.inst;if(!e)return a`<sw-state-panel state="loading"></sw-state-panel>`;const s=(t,r,n,o)=>a`<label class="opt"><input type="radio" name=${t} .checked=${e[t]===r} data-install=${`${t}:${r}`} @change=${()=>this.saveInstall({[t]:r})}><span><b>${n}</b><span class="note">${o}</span></span></label>`;return a`<div class="grid">
      <section class="card" aria-label="${l("ממשק למשתמשים חדשים")}"><h3>${l("ממשק למשתמשים חדשים")}</h3><p class="note">${l("חל רק על מי שעוד לא הוגדר. משתמשים קיימים נשארים עם מה שיש להם.")}</p><div class="opts">
        ${s("default_mode","full_all",l("ממשק מלא לכולם"),l("ברירת המחדל. כל אחד יכול לעבור לממשק הביתי מהתפריט האישי."))}
        ${s("default_mode","home_regular",l("ביתי למשתמשים רגילים, מלא למנהלים"),l("מנהל = מנהל מערכת או מי שרשאי להגדיר את המערכת."))}
        ${s("default_mode","choose",l("בחירה בכניסה הראשונה"),l("בכניסה הראשונה מוצג מסך בחירה בין שני הממשקים, והבחירה נשמרת."))}
      </div></section>
      <section class="card" aria-label="${l("מסכי קיר ורקע")}"><h3>${l("מסכי קיר")}</h3><div class="opts">
        ${s("kiosk_exit","code",l("נעול, יציאה בקוד מנהל"),l("ברירת המחדל. לחיצה ארוכה על השעון מבקשת את הקוד."))}
        ${s("kiosk_exit","none",l("נעול לממשק הביתי ולחדר שלו, בלי יציאה"),l("אין תפריט אישי ואין דרך לצאת מהמסך עצמו. משנים רק מכאן."))}
      </div>
      <h3 style="margin-block-start:var(--sw-s-4)">${l("רקע לחדרים")}</h3><div class="opts">
        ${s("wallpaper","none",l("בלי רקע"),l("ברירת המחדל: מסך נקי."))}
        ${s("wallpaper","gallery",l("גלריה מוכנה"),l("כל משתמש בוחר רקע מעומעם לכל חדר מתוך גלריה מובנית."))}
        ${s("wallpaper","gallery_image",l("גלריה ותמונה אישית"),l("בנוסף אפשר להעלות תמונה לחדר (JPEG או PNG, עד 2 MB). התמונה נשמרת בשרת ונראית רק למי שהעלה אותה."))}
      </div></section>${this.buildingsCard(s)}${this.roomWallPane()}${this.visitorsCard()}</div>`}buildingsCard(e){return this.data?.buildings?.length?a`<section class="card" aria-label="${l("ריבוי בניינים")}" data-home-buildings><h3>${l("ריבוי בניינים")}</h3><p class="note">${l("בכל אתר עם כמה בניינים, הממשק הביתי מציג בניין אחד בכל פעם.")}</p><div class="opts">
        ${e("building_all","hide",l("בניין אחד בכל פעם"),l("ברירת המחדל. מחליפים בניין בכפתור הבניין שליד שם החדר."))}
        ${e("building_all","allow",l('גם "כל הבניינים"'),l('מוסיף לבחירה את כל הבניינים יחד. "כבה הכל" לא מוצע במצב הזה: הוא תמיד של בניין אחד.'))}
      </div></section>`:p}wallPane(){const e=this.inst;if(!e)return a`<sw-state-panel state="loading"></sw-state-panel>`;const s=l("נשמר. מסכי הקיר יקבלו את השינוי בטעינה הבאה של הנתונים."),t=w=>this.saveInstall(w,s),r=(w,P,g,$)=>a`<label class="opt"><input type="radio" name=${w} .checked=${e[w]===P} data-install=${`${w}:${P}`} ?disabled=${w==="wall_night_dim"&&e.wall_night==="off"} @change=${()=>t({[w]:P})}><span><b>${g}</b><span class="note">${$}</span></span></label>`,n=["1","2","5","10","15"].map(w=>({value:w,label:w==="1"?l("דקה"):l("{m} דק׳",{m:w}),attrs:{"data-rest-after":w}})),o=(w,P)=>a`<label>${P}<input type="time" lang=${gs()} step="60" dir="ltr" data-install-time=${w} .value=${e[w]} ?disabled=${e.wall_night==="off"} @change=${g=>{const $=g.target.value;/^\d{2}:\d{2}$/.test($)&&$!==e[w]&&t({[w]:$})}}></label>`,d=e.wall_night==="on"&&e.wall_night_start===e.wall_night_end,m=[["24",l("יממה")],["48",l("יומיים")],["72",l("3 ימים")],["168",l("שבוע")],["read",l("לפי «קראתי»")]].map(([w,P])=>({value:w,label:P,attrs:{"data-notice-new":w}}));return a`<p class="note">${l("חל על כל המשתמשים שמוגדרים כמסך קיר (בלשונית «משתמשים», «מצב מסך קיר»).")}</p><div class="grid3" data-home-wall-settings>
      <section class="card" aria-label="${l("מסך מנוחה")}"><h3>${l("מסך מנוחה")}</h3>
        <div class="srow"><div><b>${l("מסך מנוחה")}</b><div class="note">${l("שעה, מזג אוויר, מה יש היום, דלתות ואזעקה. הנגיעה הראשונה רק מעירה את המסך.")}</div></div><sw-toggle label="${l("מסך מנוחה")}" labelHidden data-wall-rest-toggle ?checked=${e.wall_rest==="on"} @change=${w=>t({wall_rest:w.detail.checked?"on":"off"})}></sw-toggle></div>
        <div class="srow stack"><div><b>${l("אחרי כמה זמן בלי נגיעה")}</b><div class="note">${l("ברירת המחדל: 2 דקות. כשמסך המנוחה כבוי, זה הזמן שאחריו המסך מוחשך בלילה.")}</div></div><sw-segmented size="sm" label="${l("אחרי כמה זמן בלי נגיעה")}" data-wall-rest-after .options=${n} value=${e.wall_rest_after} @change=${w=>{w.detail.value!==e.wall_rest_after&&t({wall_rest_after:w.detail.value})}}></sw-segmented></div>
      </section>
      <section class="card" aria-label="${l("מצב לילה")}"><h3>${l("מצב לילה")}</h3>
        <div class="srow"><div><b>${l("מצב לילה")}</b><div class="note">${l("בשעות הלילה רק מחשיכים את המסך. זה עובד בכל טאבלט, בלי לגעת בתאורה האחורית של המכשיר.")}</div></div><sw-toggle label="${l("מצב לילה")}" labelHidden data-wall-night-toggle ?checked=${e.wall_night==="on"} @change=${w=>t({wall_night:w.detail.checked?"on":"off"})}></sw-toggle></div>
        <div class="srow stack"><div><b>${l("שעות הלילה")}</b><div class="note">${d?l("שעת ההתחלה ושעת הסיום זהות, ולכן אין לילה."):l("ברירת המחדל: 23:00 עד 06:00, לפי השעון של הבניין.")}</div></div><div class="times">${o("wall_night_start",l("מ-"))}${o("wall_night_end",l("עד"))}</div></div>
        <div class="opts" style="margin-block-start:var(--sw-s-2)">
          ${r("wall_night_dim","soft",l("החשכה קלה"),l("המסך עדיין קריא מרחוק."))}
          ${r("wall_night_dim","medium",l("החשכה בינונית"),l("ברירת המחדל."))}
          ${r("wall_night_dim","strong",l("החשכה חזקה"),l("לחדר שינה או למסדרון חשוך."))}
        </div>
      </section>
      <section class="card" aria-label="${l("השתלטות על המסך")}"><h3>${l("השתלטות על המסך")}</h3><p class="note">${l("מה מעיר את המסך ומופיע על כולו, גם בלילה. שיחת דלת תמיד קודמת.")}</p><div class="opts">
        ${r("wall_takeover","alarm_urgent",l("אזעקה והודעה דחופה"),l("ברירת המחדל. הודעה דחופה מלוח ההודעות מופיעה פעם אחת בכל מסך, כל עוד היא חדשה."))}
        ${r("wall_takeover","alarm",l("רק אזעקה"),l("הודעות דחופות מופיעות רק בלוח ההודעות."))}
        ${r("wall_takeover","call_only",l("רק שיחת דלת, כמו קודם"),l("אזעקה והודעות לא משתלטות על המסך."))}
      </div>
        <div class="srow stack" data-wall-notice-new style="margin-block-start:var(--sw-s-3)"><div><b>${l("כמה זמן הודעה מסומנת «חדש»")}</b><div class="note">${e.wall_notice_new==="read"?l("כמו קודם: כל מסך קיר מסמן «קראתי» לעצמו, וההודעה כבר לא חדשה אחרי שמישהו קרא אותה בו."):l("מסך קיר משותף לכל הבית, ולכן אין בו «קראתי». הודעה מסומנת «חדש» מרגע הפרסום. ברירת המחדל: יומיים.")}</div></div><sw-segmented size="sm" label="${l("כמה זמן הודעה מסומנת «חדש»")}" .options=${m} value=${e.wall_notice_new} @change=${w=>{w.detail.value!==e.wall_notice_new&&t({wall_notice_new:w.detail.value})}}></sw-segmented></div>
      </section></div>`}async loadWalls(){if(!this.wallsLoading){this.wallsLoading=!0;try{this.walls=(await G("home/room-wallpapers")).walls}catch{this.walls={}}this.wallsLoading=!1}}async setWall(e,s){this.busy=!0;try{this.walls=(await H(`home/room-wallpapers/${encodeURIComponent(e)}`,{value:s})).walls,this.message=l("הרקע נשמר")}catch(t){this.message=b(t)}finally{this.busy=!1}}async uploadWall(e,s){const t=s.target,r=t.files?.[0];if(t.value="",!r)return;if(!/^image\/(jpeg|png)$/.test(r.type)||r.size>2e6){this.message=l("אפשר להעלות JPEG או PNG עד 2 MB.");return}const n=new FormData;n.append("file",r);try{this.walls=(await $s(`home/room-wallpapers/${encodeURIComponent(e)}/image`,{method:"PUT",body:n})).walls,this.wallStamp=Date.now(),this.message=l("התמונה נשמרה כרקע לכולם")}catch(o){this.message=b(o)}}roomWallPane(){const e=this.inst?.wallpaper??"none";if(e==="none")return p;if(this.walls==null)return this.loadWalls(),a`<section class="card"><sw-state-panel state="loading"></sw-state-panel></section>`;const s=this.wallRoom||this.rooms[0]?.id||"",t=this.walls[s]??"",r=[["",l("בלי רקע"),""],...ct.map(n=>["g:"+n.id,n.name,pt(n.id)])];return a`<section class="card" aria-label="${l("רקע לחדר לכולם")}" data-home-room-walls><h3>${l("רקע לחדר לכולם")}</h3><p class="note">${l("למשל למסכי קיר. רקע שאדם בחר לעצמו גובר על זה, חוץ ממסך קיר: שם הרקע שנבחר כאן תמיד מוצג.")}</p>
      <div class="inline"><select aria-label="${l("חדר")}" @change=${n=>{this.wallRoom=n.target.value}}>${this.rooms.map(n=>a`<option value=${n.id} ?selected=${n.id===s}>${n.name}${this.walls[n.id]?" ·":""}</option>`)}</select>
      ${e==="gallery_image"&&s?a`<label class="up"><input type="file" accept="image/jpeg,image/png" hidden data-home-room-wall-upload @change=${n=>this.uploadWall(s,n)}><span>${t==="img"?l("החלפת התמונה"):l("תמונה לחדר")}</span></label>`:p}</div>
      <div class="walls">${r.map(([n,o,d])=>a`<button class="wopt" aria-pressed=${String(n===t)} data-home-room-wall=${n||"none"} ?disabled=${this.busy||!s} @click=${()=>this.setWall(s,n)}><span class="wpv" style=${d?`background:${d}`:p}></span>${o}</button>`)}${t==="img"?a`<button class="wopt" aria-pressed="true"><span class="wpv" style=${`background:url("${Ze("home/room-wallpapers/"+encodeURIComponent(s)+"/image")}?v=${this.wallStamp}") center / cover`}></span>${l("תמונה")}</button>`:p}</div></section>`}switchesPane(){if(this.swError)return a`<sw-state-panel state="error" hint=${this.swError} actionLabel="${l("נסה שוב")}" @action=${()=>this.loadSwitches()}></sw-state-panel>`;if(!this.sw)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.swVisible(),s=Math.max(1,Math.ceil(e.length/pe)),t=Math.min(this.swPage,s-1),r=e.slice(t*pe,t*pe+pe),n=[...new Map(this.sw.filter(g=>g.area_id).map(g=>[g.area_id,g.area_name??g.area_id])).entries()],o=this.swSel,d=e.length>0&&e.every(g=>o.has(g.entity_id)),v=this.sw.filter(g=>g.suggest).length,m=g=>{this.swSel=g},w=(g,$)=>{const O=new Set(o);$?O.add(g):O.delete(g),m(O)},P=[...o].filter(g=>this.sw.find($=>$.entity_id===g)?.suggest).length;return a`<section class="card" aria-label="${l("סיווג מפסקים")}" data-home-switches>
      <h3>${l("סיווג מפסקים")}</h3>
      <p class="note">${l('תאורה נכבית ב"כיבוי החדר" וב"כיבוי הכל". "לא תאורה" (דוד, מקרר, משאבה...) לא נכבה בכיבוי כללי. "מוגן" גם מבקש אישור לפני כיבוי ידני ולא נכלל בשום פעולה קבוצתית. המערכת מציעה לפי השם, ואתם מאשרים.')}</p>
      <div class="filters">
        <sw-tabs segmented group-label="${l("סינון")}" data-sw-filter .items=${[{id:"all",label:l("הכל"),count:this.sw.length},{id:"suggested",label:l("הצעות"),count:v},{id:"light",label:l("תאורה")},{id:"not_light",label:l("לא תאורה")},{id:"protected",label:l("מוגן")}]} .active=${this.swFilter} @change=${g=>{this.swFilter=g.detail.id,this.swPage=0}}></sw-tabs>
        <select aria-label="${l("חדר")}" data-sw-area @change=${g=>{this.swArea=g.target.value,this.swPage=0}}><option value="">${l("כל החדרים")}</option>${n.map(([g,$])=>a`<option value=${g} ?selected=${this.swArea===g}>${$}</option>`)}</select>
      </div>
      <div class="bulk" ?hidden=${!o.size} role="toolbar" aria-label="${l("פעולה על המסומנים")}" data-sw-bulk>
        <span class="count">${o.size} ${l("מסומנים")}</span>
        ${P?a`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-sw-approve @click=${()=>this.approveSelected()}>${l("אישור ההצעות (")}${P})</sw-button>`:p}
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="light" @click=${()=>this.mark("light",[...o])}>${l("תאורה")}</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="not_light" @click=${()=>this.mark("not_light",[...o])}>${l("לא תאורה")}</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="protected" @click=${()=>this.mark("protected",[...o])}>${l("מוגן")}</sw-button>
        <sw-button size="sm" variant="ghost" @click=${()=>m(new Set)}>${l("ניקוי")}</sw-button>
      </div>
      ${e.length?a`<table>
        <thead><tr><th class="c"><input type="checkbox" aria-label="${l("סמן את כל המוצגים")}" data-sw-all .checked=${d} @change=${g=>{const $=g.target.checked,O=new Set(o);for(const se of e)$?O.add(se.entity_id):O.delete(se.entity_id);m(O)}}></th><th>${l("שם")}</th><th>${l("חדר")}</th><th>${l("עכשיו")}</th><th>${l("הצעה")}</th></tr></thead>
        <tbody>${r.map(g=>a`<tr data-sw-row=${g.entity_id} aria-selected=${String(o.has(g.entity_id))}>
          <td class="c"><input type="checkbox" aria-label=${l("סמן ")+g.name} .checked=${o.has(g.entity_id)} @change=${$=>w(g.entity_id,$.target.checked)}></td>
          <td><b>${g.name}</b>${g.locked?a`<div class="note">${Qt[g.locked]??""}</div>`:p}</td>
          <td>${g.area_name??a`<span class="note">${l("בלי חדר")}</span>`}</td>
          <td><span class="cls ${g.class}">${ke[g.class]}</span></td>
          <td>${g.suggest?a`<span class="sug"><sw-button size="sm" ?disabled=${this.busy} data-sw-accept=${g.entity_id} @click=${()=>this.mark(g.suggest,[g.entity_id])}>${ke[g.suggest]}</sw-button><span class="why">${g.suggest_reason??""}</span></span>`:a`<span class="note">—</span>`}</td>
        </tr>`)}</tbody></table>
        ${s>1?a`<div class="pager"><sw-button size="sm" variant="ghost" ?disabled=${t===0} @click=${()=>{this.swPage=t-1}}>${l("הקודם")}</sw-button><span>${t+1} ${l("מתוך")} ${s}</span><sw-button size="sm" variant="ghost" ?disabled=${t>=s-1} @click=${()=>{this.swPage=t+1}}>${l("הבא")}</sw-button></div>`:p}`:a`<p class="note">${l("אין מפסקים שמתאימים לסינון.")}</p>`}
    </section>`}render(){if(this.error&&!this.data)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="${l("נסה שוב")}" @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.data.users.find(r=>r.user_id===this.sel)??this.data.users[0],s=a`<div class="subtabs"><sw-tabs variant="underline-compact" group-label="${l("ממשק ביתי")}" data-home-subtabs .items=${[{id:"users",label:l("משתמשים")},{id:"install",label:l("הגדרות התקנה")},{id:"wall",label:l("מסכי קיר")},{id:"switches",label:l("סיווג מפסקים")}]} .active=${this.sub}
      @change=${r=>{this.sub=r.detail.id,this.message="",this.error="",this.sub==="switches"&&!this.sw&&this.loadSwitches()}}></sw-tabs></div>`,t=a`${this.message?a`<p class="msg ok" role="status">${this.message}</p>`:p}${this.error?a`<p class="msg err" role="alert">${this.error}</p>`:p}`;return this.sub==="install"?a`${s}${t}${this.installPane()}`:this.sub==="wall"?a`${s}${t}${this.wallPane()}`:this.sub==="switches"?a`${s}${t}${this.switchesPane()}`:a`${s}
      ${t}
      <div class="grid">
        <section class="card" aria-label="${l("משתמשים")}"><div class="users">${this.data.users.map(r=>a`<button class="u" data-home-user=${r.user_id} aria-current=${String(r.user_id===e?.user_id)} @click=${()=>{this.sel=r.user_id,this.message=""}}><b>${r.display_name}</b><span class="chip ${r.default_interface==="home"?"home":""}">${r.kiosk?l("מסך קיר"):r.home_only?l("ביתי בלבד"):r.default_interface==="home"?l("ביתי"):l("מלא")}</span><span class="note">${r.home_only||!r.may_switch?l("נעול"):l("מחליף")}</span></button>`)}</div></section>
        ${e?this.detail(e):p}
      </div>
      <section class="card extra">
        <h3>${l("מסכי קיר ומועדפי התחלה")}</h3>
        <div class="srow"><div><b>${l("קוד יציאה ממסך קיר")}</b><div class="note">${this.data.kiosk_code_set?l("מוגדר. לחיצה ארוכה על השעון במסך הקיר מבקשת אותו."):l("לא מוגדר: מסך קיר לא ייפתח בלי קוד.")}</div></div>
          <div class="inline"><input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="${l("4 עד 8 ספרות")}" aria-label="${l("קוד יציאה")}" .value=${this.code} @input=${r=>{this.code=r.target.value.replace(/\D/g,"")}}><sw-button size="sm" @click=${()=>this.saveCode()}>${this.code?l("שמירה"):l("מחיקת הקוד")}</sw-button></div></div>
        <div class="srow"><div><b>${l("מועדפי התחלה")}</b><div class="note">${l("מי שעוד לא סידר מועדפים בחדר רואה את אלה. משתמשים יכולים לשנות לעצמם.")}</div></div><sw-button size="sm" data-home-seed @click=${()=>this.seedFromMine()}>${l("העתק את המועדפים שלי")}</sw-button></div>
      </section>`}detail(e){const s=this.rooms,t=o=>e.rooms==null||e.rooms.includes(o),r=o=>e.modules==null||e.modules.includes(o),n=(o,d,v,m)=>{const w=o??d,P=m?[...new Set([...w,v])]:w.filter(g=>g!==v);return P.length===d.length?null:P};return a`<section class="card" aria-label=${e.display_name} data-home-detail>
      <h3>${e.display_name}</h3>
      <div class="srow"><div><b>${l("ממשק ברירת מחדל")}</b><div class="note">${l("הממשק שנפתח בכניסה")}</div></div>
        <sw-view-switch label="${l("ממשק ברירת מחדל")}" .options=${[{id:"home",label:l("ביתי")},{id:"full",label:l("מלא")}]} value=${e.home_only?"home":e.default_interface} ?disabled=${e.home_only} @change=${o=>this.save(e,{default_interface:o.detail})}></sw-view-switch></div>
      <div class="srow"><div><b>${l("רשאי להחליף ממשק")}</b><div class="note">${l("מציג את הבחירה בתפריט האישי")}</div></div><sw-toggle label="${l("רשאי להחליף ממשק")}" labelHidden ?checked=${e.may_switch} ?disabled=${e.home_only||this.busy} @change=${o=>this.save(e,{may_switch:o.detail.checked})}></sw-toggle></div>
      <div class="srow"><div><b>${l("ממשק ביתי בלבד")}</b><div class="note">${e.system_admin?l("מנהל מערכת תמיד רשאי לממשק המלא."):l("לא יכול לפתוח את הממשק המלא. השרת מסרב גם לבקשות שלו לאזורים של הממשק המלא.")}</div></div><sw-toggle label="${l("ממשק ביתי בלבד")}" labelHidden ?checked=${e.home_only} ?disabled=${e.system_admin||this.busy} @change=${o=>this.save(e,{home_only:o.detail.checked,...o.detail.checked?{}:{kiosk:!1}})}></sw-toggle></div>
      <div class="srow"><div><b>${l("מצב מסך קיר")}</b><div class="note">${l("נשאר תמיד בממשק הביתי ובחדר שלו, בלי תפריט אישי. יוצאים עם קוד המנהל.")}</div></div>
        <div class="inline">${e.kiosk||s.length?a`<select aria-label="${l("החדר של מסך הקיר")}" ?disabled=${e.system_admin} @change=${o=>{const d=o.target.value;d&&this.save(e,{kiosk:!0,kiosk_area_id:d})}}><option value="">${e.kiosk?l("חדר"):l("בחרו חדר")}</option>${s.map(o=>a`<option value=${o.id} ?selected=${e.kiosk_area_id===o.id}>${o.name}</option>`)}</select>`:p}<sw-toggle label="${l("מצב מסך קיר")}" labelHidden ?checked=${e.kiosk} ?disabled=${e.system_admin||this.busy||!e.kiosk&&!e.kiosk_area_id} @change=${o=>this.save(e,{kiosk:o.detail.checked,kiosk_area_id:e.kiosk_area_id})}></sw-toggle></div></div>
      ${this.data?.buildings?.length?a`<div class="srow" data-home-building><div><b>${l("הבניין שנפתח")}</b><div class="note">${l("הבניין שהממשק הביתי מציג בכניסה. בלי בחירה: הבניין שנבחר לאחרונה במכשיר. לא משנה הרשאות.")}</div></div>
        <sw-dropdown label="${l("הבניין שנפתח")}" .items=${[{id:"",label:l("האחרון שנבחר במכשיר")},...this.data.buildings.map(o=>({id:o.id,label:o.name}))]} .value=${e.building_id??""} ?disabled=${this.busy} @change=${o=>this.save(e,{building_id:o.detail.id})}></sw-dropdown></div>`:p}
      <div class="srow"><div><b>${l("רשאי להזמין אורחים")}</b><div class="note">${e.can_invite?l("מופיע בממשק הביתי תחת אינטרקום: אורח מקבל קוד זמני לדלת. דורש שהזמנת מבקרים מופעלת בהתקנה."):l("הסימון לבדו לא מספיק: צריך גם הרשאה להזמנת מבקרים (משתמשים והרשאות), והזמנת מבקרים מופעלת בהתקנה.")}</div></div><sw-toggle label="${l("רשאי להזמין אורחים")}" labelHidden data-home-guests ?checked=${!!e.guests} ?disabled=${this.busy} @change=${o=>this.save(e,{guests:o.detail.checked})}></sw-toggle></div>
      <div class="cols">
        <div><b>${l("מה מופיע בממשק הביתי")}</b>${this.data.modules.map(o=>a`<label class="chk"><input type="checkbox" .checked=${r(o)} @change=${d=>{const v=n(e.modules,this.data.modules,o,d.target.checked);this.save(e,v==null?{all_modules:!0}:{modules:v})}}><span>${ea[o]}</span></label>`)}</div>
        <div><b>${l("חדרים שהמשתמש רואה")}</b><div class="note" data-home-rooms-note>${l("הרשימה רק מסתירה חדרים במסך הראשי של הממשק הביתי. היא לא מגבילה מצלמות, הקלטות או פעולות על מכשירים: אותן קובעות ההרשאות.")}</div>${s.length?s.map(o=>a`<label class="chk"><input type="checkbox" .checked=${t(o.id)} @change=${d=>{const v=n(e.rooms,s.map(m=>m.id),o.id,d.target.checked);this.save(e,v==null?{all_rooms:!0}:{rooms:v})}}><span>${o.name}</span></label>`):a`<p class="note">${l("עוד אין חדרים.")}</p>`}</div>
      </div>
      ${this.siteWideWarning(e,r)}
    </section>`}siteWideWarning(e,s){const t=this.data?.shared_scope,r=new Set(e.site_wide??[]);if(e.system_admin||!r.size||t?.customers!=null&&t.customers<=1)return p;const n=(...d)=>d.every(v=>v!=null),o=[];return r.has("bills")&&s("bills")&&o.push(n(t?.customers,t?.bill_accounts)?l("חשבון חשמל: החשבונות והסכומים של כל הלקוחות באתר (לקוחות: {c}, חשבונות פעילים: {a}), לא רק של הבית שלו.",{c:t.customers,a:t.bill_accounts}):l("חשבון חשמל: החשבונות והסכומים של כל הלקוחות באתר, לא רק של הבית שלו.")),r.has("energy")&&s("energy")&&o.push(n(t?.energy_meters)?l("חשמל: הצריכה של כל מוני החשמל באתר (מונים: {n}).",{n:t.energy_meters}):l("חשמל: הצריכה של כל מוני החשמל באתר.")),r.has("water")&&s("water")&&o.push(n(t?.water_meters)?l("מים: הצריכה של כל מוני המים באתר (מונים: {n}). הרשאת מים לפי קומה מגבילה אותו לקומות שלו.",{n:t.water_meters}):l("מים: הצריכה של כל מוני המים באתר. הרשאת מים לפי קומה מגבילה אותו לקומות שלו.")),o.length?a`<div class="warn" role="note" data-home-site-wide><sw-icon name="warning" size="18"></sw-icon><div>
      <b>${l("{name} יראה בממשק הביתי נתונים של כל האתר",{name:e.display_name})}</b>
      <ul>${o.map(d=>a`<li>${d}</li>`)}</ul>
      <div class="note">${l("עדיין אין קישור בין אדם ללקוח החשבון או למונה שלו. ההרשאות עצמן נקבעות במשתמשים והרשאות; כאן אפשר רק להסתיר את המסך מהממשק הביתי.")}</div>
    </div></div>`:p}};z.styles=B`
    /* HOME-V3-P1-2430: a room's wallpaper for everyone */
    .walls { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); margin-block-start: 10px; }
    .wopt { display: grid; gap: var(--sw-s-1); justify-items: center; inline-size: 88px; padding: var(--sw-s-1h); border: 1px solid var(--sw-border); border-radius: 10px; background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: 13px; cursor: pointer; min-block-size: 44px; }
    .wopt[aria-pressed="true"] { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
    .wpv { inline-size: 72px; block-size: 44px; border-radius: 6px; background: var(--sw-surface-2); }
    .up { display: inline-flex; align-items: center; min-block-size: 40px; padding: 0 var(--sw-s-3h); border-radius: 8px; border: 1px solid var(--sw-border); cursor: pointer; }

    :host { display: block; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: var(--sw-gap-lg); align-items: start; }
    @media (max-width: 900px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .card { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); padding: var(--sw-s-3); min-inline-size: 0; }
    .users { display: grid; gap: 2px; padding: var(--sw-s-1h); }
    .u { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-block-size: 44px; padding: 0 10px; border: 0; border-radius: var(--sw-r-md); background: none; color: var(--sw-text); font: inherit; text-align: start; cursor: pointer; }
    .u[aria-current='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .u b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .chip { font-size: var(--sw-fs-xs); padding: 2px var(--sw-s-2); border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .chip.home { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    h3 { margin: 0 0 var(--sw-s-1); font-size: var(--sw-fs-lg); color: var(--sw-heading); }
    .srow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--sw-s-3); align-items: center; padding-block: 10px; border-block-start: 1px solid var(--sw-border); }
    .note { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sw-s-4); border-block-start: 1px solid var(--sw-border); padding-block-start: 10px; }
    @media (max-width: 600px) { .cols { grid-template-columns: 1fr; } }
    .chk { display: flex; align-items: center; gap: var(--sw-s-2); min-block-size: 32px; font-size: var(--sw-fs-sm); }
    .chk input { inline-size: var(--sw-check-size); block-size: var(--sw-check-size); accent-color: var(--sw-accent); }
    .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: var(--sw-gap-lg); align-items: start; }
    .srow.stack { grid-template-columns: minmax(0, 1fr); gap: var(--sw-s-2); }
    .times { display: flex; gap: var(--sw-s-3); flex-wrap: wrap; align-items: center; }
    .times label { display: inline-flex; gap: var(--sw-s-2); align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    select, input[type='password'], input[type='time'] { font: inherit; min-block-size: 36px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; }
    .msg { margin-block: var(--sw-s-2); font-size: var(--sw-fs-sm); } .msg.err { color: var(--sw-danger); } .msg.ok { color: var(--sw-success); }
    .extra { display: grid; gap: 10px; margin-block-start: var(--sw-s-4); }
    .inline { display: flex; gap: var(--sw-s-2); align-items: center; flex-wrap: wrap; }
    .subtabs { margin-block-end: var(--sw-s-4); }
    .opts { display: grid; gap: var(--sw-s-1h); }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: var(--sw-s-2) 10px; border-radius: var(--sw-r-md); cursor: pointer; }
    .opt:hover { background: var(--sw-surface-2); }
    .opt input { margin-block-start: 3px; accent-color: var(--sw-accent); inline-size: 16px; block-size: 16px; }
    .opt b { display: block; font-weight: 600; }
    .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-block-end: 10px; }
    .bulk { position: sticky; inset-block-start: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: var(--sw-s-2); align-items: center; padding: var(--sw-s-2) 10px; margin-block-end: var(--sw-s-2);
      border-radius: var(--sw-r-md); background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .bulk[hidden] { display: none; }
    .bulk .count { font-weight: 600; margin-inline-end: auto; }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    th, td { text-align: start; padding: var(--sw-s-2) var(--sw-s-1h); border-block-end: 1px solid var(--sw-border); vertical-align: middle; }
    th { color: var(--sw-text-3); font-weight: 600; font-size: var(--sw-fs-xs); }
    td.c { inline-size: 32px; }
    td input, th input { inline-size: 16px; block-size: 16px; accent-color: var(--sw-accent); }
    tr[aria-selected='true'] td { background: var(--sw-surface-2); }
    .cls { font-size: var(--sw-fs-xs); padding: 2px var(--sw-s-2); border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .cls.light { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .cls.protected { background: var(--sw-surface-3, var(--sw-surface-2)); color: var(--sw-heading); font-weight: 600; }
    .sug { display: inline-flex; gap: var(--sw-s-1h); align-items: center; flex-wrap: wrap; }
    .sug .why { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    /* HOME-PERMS-WARN-2550: the site-wide data warning (the access screens' callout, warning tone) */
    .warn { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--sw-s-2); align-items: start; margin-block-start: var(--sw-s-3); padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md); background: var(--sw-warning-soft); color: var(--sw-text); font-size: var(--sw-fs-sm); }
    .warn > sw-icon { color: var(--sw-warning-text); }
    .warn b { display: block; color: var(--sw-warning-text); }
    .warn ul { margin: var(--sw-s-1) 0; padding-inline-start: var(--sw-s-4); display: grid; gap: var(--sw-s-1); }
    .warn .note { color: var(--sw-text-2); }
    .pager { display: flex; gap: var(--sw-s-2); align-items: center; justify-content: flex-end; margin-block-start: var(--sw-s-2); color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
  `;S([h()],z.prototype,"data",2);S([h()],z.prototype,"rooms",2);S([h()],z.prototype,"sel",2);S([h()],z.prototype,"error",2);S([h()],z.prototype,"message",2);S([h()],z.prototype,"busy",2);S([h()],z.prototype,"code",2);S([h()],z.prototype,"sub",2);S([h()],z.prototype,"inst",2);S([h()],z.prototype,"vis",2);S([h()],z.prototype,"sw",2);S([h()],z.prototype,"swError",2);S([h()],z.prototype,"swSel",2);S([h()],z.prototype,"swFilter",2);S([h()],z.prototype,"swArea",2);S([h()],z.prototype,"swPage",2);S([h()],z.prototype,"walls",2);S([h()],z.prototype,"wallRoom",2);S([h()],z.prototype,"wallStamp",2);z=S([W("sw-home-admin")],z);var sa=Object.defineProperty,ta=Object.getOwnPropertyDescriptor,x=(e,s,t,r)=>{for(var n=r>1?void 0:r?ta(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(r?d(s,t,n):d(n))||n);return r&&n&&sa(s,t,n),n};const Be=[{id:"users",label:i("משתמשים"),count:xe.length},{id:"groups",label:i("קבוצות"),count:Qe.length},{id:"roles",label:i("תפקידים"),count:es.length},{id:"effective",label:i("הרשאות אפקטיביות")},{id:"audit",label:i("אודיט הרשאות")}],qe=new Set(["map.read","video.live","video.playback","video.export","events.read","events.ack","cases.manage"]);let _=class extends q{constructor(){super(...arguments),this.bubbleSkin=new Ae(this),this.tabsMode=new bs(this,"settings"),this.tab="users",this.selected=null,this.assigning=!1,this.step=0,this.directory=null,this.roles=null,this.groups=null,this.tree=null,this.audit=null,this.selectedGroup=null,this.wizard=null,this.members=null,this.newGroup="",this.preview=null,this.previewUser="",this.previewScope="installation:*",this.busy=!1,this.error="",this.toaster=new ts(this,{ms:3500}),this.forbidden=!1,this.roleEdit=null,this.roleImpact=null,this.roleDelete=null,this.groupsMeta={can_manage:!1,delegated:!1},this.renameDraft=null,this.groupChange=null,this.remoteOff=null,this.roleImpactTimer=0,this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.onHash=()=>{window.location.hash.startsWith("#/system/access")&&this.readTab()},this.userColumns=[{key:"name",label:i("שם"),render:e=>a`<div class="who"><sw-avatar name=${String(e.name)} size=${30}></sw-avatar><div><strong>${String(e.name)}</strong>${e.haAdmin?a` <sw-badge kind="neutral" label=${i("מנהל HA · מידע בלבד")}></sw-badge>`:""}<div class="ltr sub">${String(e.haUser)}@ha.local</div></div></div>`},{key:"role",label:i("תפקיד"),render:e=>{const s=e.bindings[0];return s?a`<span class="pillsel">${s.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:a`<span class="pillsel" style="color:var(--sw-text-3)">${i("ללא שיוך")}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`}},{key:"scope",label:i("היקף גישה"),render:e=>{const s=e.bindings[0];return s?a`<span class="pillsel">${s.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:a`<span class="sub">—</span>`}},{key:"active",label:i("מצב"),render:e=>a`<span class="status ${e.active?"":"off"}"><i></i>${e.active?i("פעיל"):i("מושבת ב־HA")}</span>`},{key:"lastSync",label:i("סנכרון")},{key:"more",label:"",width:"40px",render:()=>a`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${i("עוד")}></sw-button>`}]}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.readTab(),window.addEventListener("hashchange",this.onHash),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),I()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),this.narrowMq?.removeEventListener("change",this.onNarrow)}readTab(){const e=ys().params.get("tab")??"";(Be.some(t=>t.id===e)||e==="ha-users"&&(!I()||A("users.ha_manage"))||e==="local"&&I()&&A("identity.directory.read")||e==="home"&&I()&&A("rbac.assign")||e==="factor"&&I()&&(A("system.configure")||A("rbac.assign")))&&e!==this.tab&&this.setTab(e)}setTab(e){this.tab=e,this.tab==="audit"&&I()&&this.loadAudit(),_s("/system/access",e==="users"?void 0:new URLSearchParams({tab:e}))}async load(){this.error="";try{const[e,s,t,r]=await Promise.all([Ls(),ae(),Us(),ks().catch(()=>null)]);this.directory=e,this.roles=s,this.groups=t.groups,this.groupsMeta={can_manage:!!t.can_manage,delegated:!!t.delegated},this.tree=r,this.forbidden=!1,this.previewUser||(this.previewUser=X.me?.user.id??"");const n=this.scopeOptions;n.length&&!n.some(o=>`${o.type}:${o.id}`===this.previewScope)&&(this.previewScope=`${n[0].type}:${n[0].id}`)}catch(e){const s=b(e);this.error=s,this.forbidden=/403|הרשאה|forbidden/i.test(s)&&!this.directory}}async loadAudit(){try{const[e,s]=await Promise.all([Re({prefix:"rbac.",limit:100}),Re({prefix:"identity.",limit:50})]);this.audit=[...e.rows,...s.rows].sort((t,r)=>t.at<r.at?1:-1).slice(0,150)}catch(e){this.error=b(e),this.audit=[]}}flash(e){this.toaster.show(e)}get scopeOptions(){const e=this.directory?.assign_scopes;if(e&&e.length)return e;const s=[{type:"installation",id:"*",name:i("כל ההתקנה")}];for(const t of this.tree?.sites??[]){s.push({type:"site",id:t.id,name:`${i("אתר")} · ${t.name}`});for(const r of t.buildings??[]){s.push({type:"building",id:r.id,name:`${t.name} · ${r.name}`});for(const n of r.floors??[])s.push({type:"floor",id:n.id,name:`${t.name} · ${r.name} · ${n.name}`})}}return s}userName(e){return this.directory?.users.find(s=>s.id===e)?.name??e}label(e){return this.roles?.labels[e]??Xe(e)??xs(e)??ot(e)??e}startWizard(e,s,t){const r=this.roles?.roles??[],n=r.some(d=>d.id==="viewer")?"viewer":r[0]?.id??"viewer",o=this.scopeOptions[0];this.wizard={subjectKind:e,subjectId:s,subjectName:t,roleId:n,scopeKey:o?`${o.type}:${o.id}`:"installation:*",effect:"allow"}}pickScopeKind(e,s){const r=this.scopeOptions.filter(n=>n.type==="camera"===s)[0];r&&(this.wizard={...e,scopeKey:`${r.type}:${r.id}`})}async previewGroupChange(e,s,t,r,n){this.busy=!0,this.error="";try{const o=await Ms(e.id,r);this.groupChange={heading:s,impact:o,confirmLabel:t,run:async()=>{await n(o.revision)}}}catch(o){this.error=b(o)}finally{this.busy=!1}}async confirmGroupChange(){const e=this.groupChange;if(e){this.busy=!0,this.error="";try{await e.run(),this.groupChange=null,await this.load()}catch(s){this.error=b(s),this.groupChange=null,await this.load()}finally{this.busy=!1}}}async saveWizard(){const e=this.wizard;if(!e)return;const[s,t]=e.scopeKey.split(":");if(e.subjectKind==="group"){const r=this.groups?.find(d=>d.id===e.subjectId);if(!r)return;const n=this.roles?.roles.find(d=>d.id===e.roleId),o=this.scopeOptions.find(d=>`${d.type}:${d.id}`===e.scopeKey);await this.previewGroupChange(r,`${i('{kind} לקבוצה "{name}"',{kind:e.effect==="deny"?i("חסימה"):i("שיוך"),name:r.name})}: ${n?.name??e.roleId} · ${o?.name??t}`,i("שמור שיוך"),{op:"bind",role_id:e.roleId,scope_type:s,scope_id:t,effect:e.effect},async d=>{await Is(r.id,{role_id:e.roleId,scope_type:s,scope_id:t,effect:e.effect,revision:d}),this.wizard=null,this.flash(i('שויך לקבוצה "{name}"',{name:r.name}))});return}this.busy=!0,this.error="";try{const r=await Oe({subject_kind:e.subjectKind,subject_id:e.subjectId,role_id:e.roleId,scope_type:s,scope_id:t,effect:e.effect});this.flash(e.effect==="deny"?`${i("נחסם:")} ${r.role_name} · ${r.scope_name} (${i("רוויזיה {n}",{n:r.revision})})`:`${i("שויך:")} ${r.role_name} · ${r.scope_name} (${i("רוויזיה {n}",{n:r.revision})})`),this.wizard=null,await this.load()}catch(r){this.error=b(r)}finally{this.busy=!1}}async revoke(e){if(e.subject_kind==="group"&&!e.via_group){const r=this.groups?.find(n=>n.id===e.subject_id);if(r){await this.previewGroupChange(r,`${i('ביטול שיוך של הקבוצה "{name}"',{name:r.name})}: ${e.role_name} · ${e.scope_name}`,i("בטל שיוך"),{op:"unbind",binding_id:e.id},async n=>{await js(r.id,e.id,n),this.flash(`${i("בוטל:")} ${e.role_name} · ${e.scope_name}`)});return}}const s=e.subject_kind==="user"&&e.subject_id===X.me?.user.id,t=s?i('לבטל את השיוך שלך "{role} · {scope}"? ייתכן שתאבד הרשאות, כולל הגישה למסך הזה.',{role:e.role_name,scope:e.scope_name}):i('לבטל את השיוך "{role} · {scope}" של {name}?',{role:e.role_name,scope:e.scope_name,name:this.userName(e.subject_id)});if(await he({body:t,danger:!0,confirmLabel:i("בטל שיוך"),focusCancel:s})){this.busy=!0,this.error="";try{await Ds(e.id),this.flash(`${i("בוטל:")} ${e.role_name} · ${e.scope_name}`),await this.load()}catch(r){this.error=b(r)}finally{this.busy=!1}}}async sync(){this.busy=!0,this.error="";try{const e=await Hs();this.flash(e.requested?i("הספרייה נדחפה מ־Home Assistant"):e.note??i("הספרייה מתעדכנת אוטומטית כל דקה")),await this.load()}catch(e){this.error=b(e)}finally{this.busy=!1}}async addGroup(){const e=this.newGroup.trim();if(e){this.busy=!0,this.error="";try{const s=await Ns(e);this.newGroup="",this.flash(i('נוצרה קבוצה "{name}"',{name:s.name})),await this.load(),this.selectedGroup=s.id}catch(s){this.error=b(s)}finally{this.busy=!1}}}async saveMembers(e){if(!this.members)return;const s=[...this.members];await this.previewGroupChange(e,i('חברי הקבוצה "{name}"',{name:e.name}),i("שמור חברים"),{op:"members",user_ids:s},async t=>{await Ts(e.id,s,t),this.members=null,this.flash(i("חברי הקבוצה עודכנו"))})}async saveRename(e){const s=(this.renameDraft??"").trim();if(!s||s===e.name){this.renameDraft=null;return}this.busy=!0,this.error="";try{await Gs(e.id,s,e.revision),this.renameDraft=null,this.flash(i('שם הקבוצה עודכן ל"{name}"',{name:s})),await this.load()}catch(t){this.error=b(t)}finally{this.busy=!1}}async removeGroup(e){this.busy=!0,this.error="";try{await Fs(e.id,e.revision),this.selectedGroup=null,this.flash(i('הקבוצה "{name}" נמחקה',{name:e.name})),await this.load()}catch(s){this.error=b(s)}finally{this.busy=!1}}async runPreview(){if(!this.previewUser)return;const[e,s]=this.previewScope.split(":");this.busy=!0,this.error="";try{this.preview=await Bs({user_id:this.previewUser,scope_type:e,scope_id:s})}catch(t){this.error=b(t)}finally{this.busy=!1}}canRevoke(e,s){if(!s||e.via_group)return!1;const t=this.directory;return!(t?.delegated&&(!(t.assignable_roles??[]).includes(e.role_id)||e.subject_kind==="user"&&e.subject_id===X.me?.user.id))}renderBindingRow(e,s){return a`<div class="bind" data-binding=${e.id}>
      <div><strong>${e.role_name}</strong> · ${e.scope_name}${e.effect==="deny"?a` <sw-badge kind="forbidden" label=${i("חסימה")}></sw-badge>`:p}<div class="sub">${e.via_group?`${i('דרך קבוצה "{name}"',{name:e.via_group})} · `:""}${i("מאז {time}",{time:C(e.created_at)})}${e.expires_at?` · ${i("עד {time}",{time:C(e.expires_at)})}`:""} · ${i("רוויזיה {n}",{n:e.permission_revision})}</div></div>
      ${this.canRevoke(e,s)?a`<sw-button size="sm" variant="ghost" icon="trash" data-revoke ?disabled=${this.busy} @click=${()=>this.revoke(e)}>${i("ביטול")}</sw-button>`:p}
    </div>`}renderWizard(){const e=this.wizard;if(!e||!this.roles)return p;const s=this.roles.roles.find(w=>w.id===e.roleId),t=this.scopeOptions.find(w=>`${w.type}:${w.id}`===e.scopeKey),r=s?.system_role??!1,n=e.effect==="deny",o=s?.permissions.includes("rbac.assign")??!1,d=this.scopeOptions.filter(w=>w.type!=="camera"),v=this.scopeOptions.filter(w=>w.type==="camera"),m=e.scopeKey.startsWith("camera:");return a`<div class="wiz">
      <sw-steps .steps=${[i("תפקיד"),i("היקף"),i("תצוגה מקדימה"),i("שמירה")]} .current=${2}></sw-steps>
      <div class="hint">${e.subjectKind==="group"?i("שיוך לקבוצה:"):i("שיוך למשתמש:")} <strong>${e.subjectName}</strong></div>
      ${this.directory?.delegated?p:a`<sw-field label=${i("סוג שיוך")}><select data-wizard-effect @change=${w=>this.wizard={...e,effect:w.target.value}}>
            <option value="allow" ?selected=${!n}>${i("הרשאה — מוסיף את הרשאות התפקיד בהיקף")}</option>
            <option value="deny" ?selected=${n}>${i("חסימה — מסיר את הרשאות התפקיד בהיקף, גם אם שיוך אחר מרשה")}</option>
          </select></sw-field>`}
      <sw-field label=${i("תפקיד")}><select data-wizard-role @change=${w=>this.wizard={...e,roleId:w.target.value}}>${this.roles.roles.map(w=>a`<option value=${w.id} ?selected=${w.id===e.roleId}>${w.name}</option>`)}</select></sw-field>
      <sw-field label=${i("סוג היקף")}><select data-wizard-scope-kind @change=${w=>this.pickScopeKind(e,w.target.value==="camera")}>
        <option value="place" ?selected=${!m}>${i("התקנה / אתר / מבנה / קומה")}</option>
        <option value="camera" ?selected=${m} ?disabled=${!v.length||r||o}>${i("מצלמה")}</option>
      </select></sw-field>
      ${m?a`<sw-field label=${i("מצלמה")}><select data-wizard-camera @change=${w=>this.wizard={...e,scopeKey:w.target.value}}>${v.map(w=>a`<option value=${`${w.type}:${w.id}`} ?selected=${`${w.type}:${w.id}`===e.scopeKey}>${w.name.replace(/^מצלמה · /,"")}</option>`)}</select></sw-field>`:a`<sw-field label=${i("היקף")}><select data-wizard-scope @change=${w=>this.wizard={...e,scopeKey:w.target.value}}>${d.map(w=>a`<option value=${`${w.type}:${w.id}`} ?selected=${`${w.type}:${w.id}`===e.scopeKey} ?disabled=${r&&w.type!=="installation"}>${w.name}</option>`)}</select></sw-field>`}
      ${m?a`<div class="hint" data-camera-scope-hint>${i("היקף מצלמה: ההרשאות חלות על המצלמה הזו בלבד — שידור חי, הקלטות, אירועים וייצוא שלה. במפה תוצג תוכנית הקומה שלה עם המצלמה הזו בלבד, בלי ישויות Home Assistant ובלי מצלמות אחרות. חסימה ברמה רחבה יותר (קומה, אתר, התקנה) גוברת גם עליה.")}</div>`:p}
      ${this.directory?.delegated?a`<div class="hint" data-delegated-hint>${i("כמנהל אתר מוצגים רק התפקידים שמותר לך להאציל וההיקפים שבאחריותך. אינך משנה את השיוכים של עצמך ואינך יוצר חסימות.")}</div>`:p}
      ${e.subjectKind==="group"?a`<div class="hint">${i("לפני השמירה תוצג ההשפעה על כל אחד מחברי הקבוצה.")}</div>`:p}
      ${s?n?a`<div class="eff">
              <div><div class="sec">${i("ייחסמו ב־{scope}",{scope:t?.name??i("ההיקף")})}</div>${s.permissions.map(w=>a`<div class="row"><span>${this.label(w)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
              <div class="hint" style="align-self:start">${i('חסימה פועלת רק על ההרשאות שהתפקיד הזה מקנה, ורק בהיקף שנבחר. היא גוברת על כל שיוך "הרשאה" אחר לאותו משתמש באותה הרשאה ובאותו היקף (או היקף שמכיל אותו) — לא על שיוכים בהיקפים לא קשורים.')}</div>
            </div>`:m?a`<div class="eff" data-camera-effect>
                <div><div class="sec">${i("מותר ב־{scope}",{scope:t?.name??i("המצלמה")})}</div>${s.permissions.filter(w=>qe.has(w)).map(w=>a`<div class="row"><span>${this.label(w)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
                <div><div class="sec">${i("ללא השפעה בהיקף מצלמה")}</div>${s.permissions.filter(w=>!qe.has(w)).map(w=>a`<div class="row"><span>${this.label(w)}</span><sw-icon name="close" size=${14} style="color:var(--sw-text-3)"></sw-icon></div>`)}<div class="row"><span>${i("כל מצלמה אחרת")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
              </div>`:a`<div class="eff">
              <div><div class="sec">${i("מותר ב־{scope}",{scope:t?.name??i("ההיקף")})}</div>${s.permissions.map(w=>a`<div class="row"><span>${this.label(w)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
              <div><div class="sec">${i("לא כלול / מחוץ להיקף")}</div>${s.sensitive_missing.map(w=>a`<div class="row"><span>${this.label(w)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}<div class="row"><span>${i("כל היקף אחר")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
            </div>`:p}
      ${r?a`<div class="hint">${i("תפקיד עם הרשאות מערכת מוקצה רק ברמת ההתקנה כולה.")}</div>`:p}
      <div class="hint">${i("הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־Home Assistant. השינוי נרשם באודיט עם diff לפני/אחרי.")}</div>
    </div>`}requestRemote(e,s){const t=e.remote_sessions??0;if(!s&&t>0&&(this.directory?.remote_policy??"flag")==="flag"&&!e.remote_admin_default){this.remoteOff={userId:e.id,count:t};return}this.toggleRemote(e.id,s)}async toggleRemote(e,s){this.busy=!0,this.error="",this.remoteOff=null;try{const t=await qs(e,s);this.flash(s?i("הגישה מרחוק הופעלה"):t.sessions_ended?`${i("הגישה מרחוק כובתה")} · ${i("{n} כניסות נסגרו",{n:t.sessions_ended})}`:i("הגישה מרחוק כובתה")),await this.load()}catch(t){this.error=b(t),await this.load()}finally{this.busy=!1}}remoteStats(e){const s=e.remote_sessions??0;return`${s===0?i("אין כניסות פעילות מרחוק"):s===1?i("כניסה פעילה אחת"):i("{n} כניסות פעילות",{n:s})} · ${e.remote_last_sign_in?i("כניסה אחרונה מרחוק {time}",{time:C(e.remote_last_sign_in)}):i("טרם נכנס מרחוק")}`}renderUsersApi(){const e=this.directory,s=e.can_assign,t=e.delegated?[]:[{key:"remote_access",label:i("מרחוק"),render:d=>{const v=d,m=v.remote_sessions??0;return a`<span data-remote-col style="font-size:var(--sw-fs-xs)">${v.remote_access_basis==="admin_default"?i("ברירת מחדל (מנהל)"):v.remote_access?i("מופעלת"):i("כבויה")}${m?a` · <sw-badge kind="live" label=${m===1?i("מחובר"):i("{n} חיבורים",{n:m})}></sw-badge>`:p}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${v.remote_last_sign_in?i("אחרונה {time}",{time:C(v.remote_last_sign_in)}):i("טרם נכנס")}</div>`}}],n=[{key:"name",label:i("שם"),render:d=>a`<div style="display:flex;align-items:center;gap:10px"><sw-avatar name=${String(d.name)} size=${30}></sw-avatar><div style="min-inline-size:0;white-space:normal;overflow-wrap:anywhere"><strong>${String(d.name)}</strong>${d.is_admin?a` <sw-badge kind="neutral" label=${i("מנהל HA · מידע בלבד")}></sw-badge>`:p}${d.is_self?a` <sw-badge kind="recorded" label=${i("אני")}></sw-badge>`:p}${me(String(d.name),String(d.username??""),String(d.id??""))?a`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3);direction:ltr;text-align:start">${me(String(d.name),String(d.username??""),String(d.id??""))}</div>`:p}</div></div>`},{key:"bindings",label:i("תפקיד · היקף"),render:d=>{const v=d.bindings;return v.length?a`${v.slice(0,2).map(m=>a`<div style="font-size:var(--sw-fs-xs);white-space:normal;overflow-wrap:anywhere;min-inline-size:16ch"><strong>${m.role_name}</strong> · ${m.scope_name}${m.via_group?` (${i("קבוצה")})`:""}${m.effect==="deny"?a` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· ${i("חסימה")}</span>`:p}</div>`)}${v.length>2?a`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">+${v.length-2}</div>`:p}`:a`<span style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${i("ללא שיוך · אין גישה לתוכן")}</span>`}},{key:"groups",label:i("קבוצות"),render:d=>{const v=d.groups.map(m=>m.name).join(", ");return a`<span title=${v} style="font-size:var(--sw-fs-xs);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;min-inline-size:12ch;max-inline-size:32ch">${v||"—"}</span>`}},{key:"active",label:i("מצב"),render:d=>a`<span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-xs)"><i style="inline-size:7px;block-size:7px;border-radius:50%;background:${d.active?"var(--sw-live)":"var(--sw-offline)"}"></i>${d.active?i("פעיל"):i("ללא גישה (HA)")}</span>`},{key:"sync_status",label:i("סנכרון"),render:d=>a`<span style="font-size:var(--sw-fs-xs)">${Le[d.sync_status]}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${d.last_seen_at?i("נראה {time}",{time:C(String(d.last_seen_at))}):i("טרם נכנס")}</div>`},...t].filter(d=>!this.narrow||!["groups","sync_status","remote_access"].includes(d.key)),o=e.users.find(d=>d.id===this.selected)??null;return a`
      <div class="stage">
        ${e.users.length?a`<sw-table .columns=${n} .rows=${e.users} .selected=${this.selected} @row-select=${d=>{this.selected=d.detail.id,this.wizard=null}}></sw-table>`:a`<sw-state-panel icon="users" state="empty" heading=${i("אין משתמשים עדיין")} hint=${e.directory.paired?i("הספרייה תגיע מהגשר תוך דקה."):i("צמד את גשר Arx ב־Home Assistant כדי לקבל את רשימת המשתמשים.")}></sw-state-panel>`}
        ${o?a`<sw-drawer open modal heading=${o.name} subheading=${`Home Assistant · ${o.username||o.id} · ${o.active?i("פעיל"):i("ללא גישה")}`} data-user-drawer @close=${()=>{this.selected=null,this.wizard=null}}>
              ${this.wizard&&this.wizard.subjectKind==="user"?this.renderWizard():a`<dl>
                    <dt>${i("מקור זהות")}</dt><dd>Home Assistant · <span class="ltr">${o.id}</span></dd>
                    <dt>${i("סנכרון")}</dt><dd>${Le[o.sync_status]}${o.synced_at?` · ${C(o.synced_at)}`:""}</dd>
                    <dt>${i("ב־Arx")}</dt><dd>${o.first_seen_at?`${i("מאז {time}",{time:C(o.first_seen_at)})} · ${i("לאחרונה {time}",{time:C(o.last_seen_at)})}`:i("טרם נכנס לממשק")}</dd>
                    <dt>${i("מנהל HA")}</dt><dd>${o.is_admin?i("כן · מידע בלבד, לא תפקיד במערכת"):i("לא")}</dd>
                    <dt>${i("קבוצות")}</dt><dd>${o.groups.map(d=>d.name).join(", ")||"—"}</dd>
                    ${e.delegated?p:a`<dt>${i("גישה מרחוק")}</dt><dd data-remote-access>${A("system.configure")?a`<sw-toggle label="SmplWise Arx" .checked=${ze(!!o.remote_access&&this.remoteOff?.userId!==o.id)} ?disabled=${this.busy||o.remote_access_basis==="admin_default"} data-remote-access-toggle @change=${d=>this.requestRemote(o,d.detail.checked)}></sw-toggle>`:o.remote_access_basis==="admin_default"?i("ברירת מחדל (מנהל)"):o.remote_access?i("מופעלת"):i("כבויה")}
                      ${o.remote_access_basis==="admin_default"?a`<div class="sub" data-remote-admin-default>${i("ברירת מחדל (מנהל) · משתנה בהגדרות ‹ גישה מרחוק")}</div>`:p}
                      <div class="sub" data-remote-stats>${this.remoteStats(o)}</div>
                      ${this.remoteOff?.userId===o.id?a`<div class="remote-off" role="alert" data-remote-off-impact>
                            <span>${this.remoteOff.count===1?i("כניסה פעילה אחת תיסגר עכשיו"):i("{n} כניסות פעילות ייסגרו עכשיו",{n:this.remoteOff.count})} (${i("כולל חיבורי וידאו פתוחים")}).</span>
                            <sw-button size="sm" variant="danger" data-remote-off-confirm ?disabled=${this.busy} @click=${()=>void this.toggleRemote(o.id,!1)}>${i("כבה וסגור")}</sw-button>
                            <sw-button size="sm" variant="ghost" @click=${()=>this.remoteOff=null}>${i("ביטול")}</sw-button>
                          </div>`:p}</dd>`}
                    ${!e.delegated&&A("system.configure")?a`<dt>${E("secondFactor.adminLabel")}</dt><dd data-second-factor-user><sw-user-factors .userId=${o.id}></sw-user-factors></dd>`:p}
                    ${!e.delegated&&A("system.configure")?a`<dt>${E("secondFactor.overrideLabel")}</dt><dd data-second-factor-policy-user><sw-second-factor-policy kind="user" .subjectId=${o.id}></sw-second-factor-policy></dd>`:p}
                    ${!e.delegated&&A("system.configure")?a`<dt>${i("אזעקה")}</dt><dd data-alarm-user-policy><system-alarm-user .userId=${o.id} ?canEdit=${!this.busy}></system-alarm-user></dd>`:p}
                  </dl>
                  <div class="sec">${i("שיוכים")}</div>
                  ${o.bindings.length?o.bindings.map(d=>this.renderBindingRow(d,s)):a`<div class="hint">${i("ללא שיוך: אין גישה לתוכן.")}</div>`}
                  <div class="hint">${i("אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.")}</div>`}
              <div slot="footer" class="dfoot">
                ${this.wizard?a`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>${i("שמור שיוך")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>${i("ביטול")}</sw-button>`:a`${s&&!(e.delegated&&o.is_self)?a`<sw-button variant="primary" size="sm" icon="plus" data-assign @click=${()=>this.startWizard("user",o.id,o.name)}>${i("שיוך תפקיד")}</sw-button>`:p}
                    <sw-button variant="ghost" size="sm" icon="shield" data-user-effective @click=${()=>{this.previewUser=o.id,this.selected=null,this.setTab("effective"),this.runPreview()}}>${i("הרשאות אפקטיביות")}</sw-button>`}
              </div>
            </sw-drawer>`:p}
      </div>
    `}renderGroupsApi(){const e=this.groups??[],s=this.directory,t=s.can_assign,r=[{key:"name",label:i("קבוצה"),render:$=>a`<strong>${String($.name)}</strong>`},{key:"members",label:i("חברים"),render:$=>a`${$.members.length}`},{key:"bindings",label:i("שיוכים (תפקיד · היקף)"),render:$=>a`${$.bindings.map(O=>a`<div style="font-size:var(--sw-fs-xs)">${O.role_name} · ${O.scope_name}${O.effect==="deny"?a` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· ${i("חסימה")}</span>`:p}</div>`)}`}],n=e.find($=>$.id===this.selectedGroup)??null,o=this.members??new Set(n?.members.map($=>$.id)??[]),d=this.groupsMeta.can_manage,v=!!s.delegated,m=X.me?.user.id,w=n?n.members.length>0||n.bindings.length>0:!1,P=new Set(s.users.map($=>$.id)),g=n?n.members.filter($=>!P.has($.id)):[];return a`
      <sw-card heading=${i("קבוצות")} subheading=${v?i("הקבוצות שכל השיוכים שלהן בתוך ההיקף שלך · חברות ושיוך תפקידים מרשימת ההאצלה"):i("קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו · ההרשאות האפקטיביות = השיוכים האישיים + שיוכי הקבוצות, בכל היקף בנפרד")} data-groups-card>
        ${d?a`<div class="toolbar"><sw-field label=${i("קבוצה חדשה")}><input data-group-new .value=${this.newGroup} placeholder=${i("למשל: עורכי קומה 2")} @input=${$=>this.newGroup=$.target.value} @keydown=${$=>{$.key==="Enter"&&this.addGroup()}} /></sw-field><sw-button size="sm" icon="plus" data-group-create ?disabled=${this.busy||!this.newGroup.trim()} @click=${()=>this.addGroup()}>${i("יצירה")}</sw-button></div>`:a`<div class="hint">${v?i("יצירה, שינוי שם ומחיקה של קבוצות — מנהל המערכת בלבד. קבוצה שיש לה שיוך מחוץ להיקף שלך, או שאתה חבר בה, אינה מוצגת כאן."):i("יצירה, שינוי שם ומחיקה של קבוצות דורשים ניהול תפקידים (מנהל מערכת).")}</div>`}
      </sw-card>
        <div class="stage groups-stage">
          ${e.length?a`<sw-table .columns=${r} .rows=${e} .selected=${this.selectedGroup} @row-select=${$=>{this.selectedGroup=$.detail.id,this.members=null,this.wizard=null,this.renameDraft=null}}></sw-table>`:a`<sw-state-panel icon="users" state="empty" heading=${i("אין קבוצות")} hint=${v?i("אין קבוצה שכל השיוכים שלה בתוך ההיקף שלך."):i("קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו. קבוצות Arx בלבד, לא קבוצות HA.")}></sw-state-panel>`}
          ${n?a`<sw-drawer open modal heading=${n.name} subheading=${`${i("{n} חברים",{n:n.members.length})} · ${i("{n} שיוכים",{n:n.bindings.length})} · ${i("רוויזיה {n}",{n:n.revision})}`} data-group-drawer @close=${()=>{this.selectedGroup=null,this.members=null,this.wizard=null,this.renameDraft=null}}>
                ${this.wizard&&this.wizard.subjectKind==="group"?this.renderWizard():a`${d?a`<div class="toolbar" style="margin-block-end:8px"><sw-field label=${i("שם הקבוצה")}><input data-group-rename .value=${this.renameDraft??n.name} @input=${$=>this.renameDraft=$.target.value} @keydown=${$=>{$.key==="Enter"&&this.saveRename(n)}} /></sw-field><sw-button size="sm" data-group-rename-save ?disabled=${this.busy||this.renameDraft===null||!this.renameDraft.trim()||this.renameDraft.trim()===n.name} @click=${()=>this.saveRename(n)}>${i("שינוי שם")}</sw-button></div>`:p}
                    <div class="sec">${i("שיוכים של הקבוצה")}</div>
                    ${n.bindings.length?n.bindings.map($=>this.renderBindingRow($,t)):a`<div class="hint">${i("ללא שיוך: החברים אינם מקבלים דבר דרך הקבוצה.")}</div>`}
                    <div class="sec">${i("חברים")} · ${o.size}</div>
                    <div class="members in-drawer">${s.users.map($=>a`<label><input type="checkbox" data-member=${$.id} ?disabled=${!t||v&&$.id===m} .checked=${o.has($.id)} @change=${O=>{const se=new Set(o);O.target.checked?se.add($.id):se.delete($.id),this.members=se}} /> ${$.name}<span class="hint">${$.active?"":" · "+i("ללא גישה")}${v&&$.id===m?" · "+i("לא ניתן לצרף את עצמך"):""}</span></label>`)}${g.map($=>a`<label><input type="checkbox" checked disabled /> ${$.name}<span class="hint"> · ${i("מחוץ לרשימה שלך")}</span></label>`)}</div>
                    <div class="hint">${i("שינוי חברות ושיוך נבדקים מול כל השיוכים של הקבוצה, מוצגים לפני השמירה עם ההשפעה על כל משתמש, ונרשמים באודיט.")}</div>
                    ${d&&w?a`<div class="hint" data-group-in-use>${i("מחיקה אפשרית רק לקבוצה ללא חברים וללא שיוכים — הסר אותם קודם.")}</div>`:p}`}
                <div slot="footer" class="dfoot">
                  ${this.wizard?a`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>${i("שמור שיוך")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>${i("ביטול")}</sw-button>`:a`${t?a`<sw-button variant="primary" size="sm" icon="check" data-group-save-members ?disabled=${this.busy||!this.members} @click=${()=>this.saveMembers(n)}>${i("שמור חברים")}</sw-button>
                          <sw-button size="sm" icon="plus" data-group-bind ?disabled=${this.busy} @click=${()=>this.startWizard("group",n.id,n.name)}>${i("שיוך תפקיד")}</sw-button>`:p}
                      ${d?a`<sw-button variant="danger" size="sm" icon="trash" class="end" data-group-delete ?disabled=${this.busy||w} @click=${()=>this.removeGroup(n)}>${i("מחיקה")}</sw-button>`:p}`}
                </div>
                ${this.renderGroupChange()}
              </sw-drawer>`:p}
        </div>
      ${n?p:this.renderGroupChange()}
    `}renderGroupChange(){const e=this.groupChange;if(!e)return p;const s=e.impact,t=n=>s.labels[n]??this.label(n),r={member:i("חבר"),added:i("מצטרף"),removed:i("יוצא")};return a`<sw-dialog open heading=${i("השפעת השינוי")} subheading=${e.heading} data-group-impact @close=${()=>this.groupChange=null}>
      <div class="impact">
        <strong>${i("{n} משתמשים מושפעים",{n:s.users.length})}</strong>${s.scopes.length?a` · ${i("היקפים:")} ${s.scopes.map(n=>n.scope_name).join(", ")}`:a` · ${i("לקבוצה אין שיוך, ולכן השינוי אינו משנה הרשאות")}`}
      </div>
      ${s.users.length?a`<div class="members" style="margin-block-start:8px">${s.users.map(n=>a`<div class="bind" data-impact-user=${n.id}>
            <div><strong>${n.name}</strong> <sw-badge kind=${n.change==="removed"?"forbidden":"recorded"} label=${r[n.change]}></sw-badge>
              <div class="sub">${n.added.length?a`<span class="ok">${i("יתווספו:")} ${n.added.map(t).join(", ")}</span>`:i("ללא הרשאות חדשות")} · ${n.removed.length?a`<span class="err">${i("יוסרו:")} ${n.removed.map(t).join(", ")}</span>`:i("ללא הסרות")}</div></div>
          </div>`)}</div>`:a`<div class="hint" style="margin-block-start:8px">${i("אין חברים בקבוצה: אף משתמש אינו מושפע כרגע. מי שיצורף בהמשך יירש את השיוך.")}</div>`}
      <div class="hint" style="margin-block-start:8px">${i("הרשאות בתוך Arx בלבד. השינוי נרשם באודיט (מזהים בלבד) וחל מהבקשה הבאה של כל משתמש.")}</div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.groupChange=null}>${i("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-group-impact-confirm ?disabled=${this.busy} @click=${()=>this.confirmGroupChange()}>${e.confirmLabel}</sw-button>
    </sw-dialog>`}openRole(e){this.roleImpact=null;const s=new Set(this.roles?.sensitive??[]);this.roleEdit=e?{id:e.id,revision:e.revision??1,name:e.name,description:e.description??"",permissions:e.permissions.filter(t=>!s.has(t)),sensitive:e.permissions.filter(t=>s.has(t)),delegable:!!e.delegable}:{id:null,revision:0,name:"",description:"",permissions:["map.read"],sensitive:[],delegable:!1},this.scheduleImpact()}toggleRolePerm(e,s){const t=this.roleEdit;if(!t)return;const r=s?"sensitive":"permissions",n=t[r].includes(e)?t[r].filter(o=>o!==e):[...t[r],e];this.roleEdit={...t,[r]:n},this.scheduleImpact()}scheduleImpact(){window.clearTimeout(this.roleImpactTimer),this.roleImpactTimer=window.setTimeout(()=>void this.loadImpact(),300)}async loadImpact(){const e=this.roleEdit;if(!e||!e.permissions.length&&!e.sensitive.length){this.roleImpact=null;return}try{this.roleImpact=await Ws({role_id:e.id,permissions:e.permissions,sensitive:e.sensitive})}catch(s){this.error=b(s)}}async saveRole(){const e=this.roleEdit;if(!(!e||!e.name.trim())){this.busy=!0,this.error="";try{const s={name:e.name.trim(),description:e.description,permissions:e.permissions,sensitive:e.sensitive,delegable:e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")};if(e.id){await Ks(e.id,{...s,revision:e.revision}),this.roleEdit=null,this.roleImpact=null,this.toaster.show(i("התפקיד עודכן; השינוי חל על כל המשויכים ברענון הבא"),{ms:0}),this.roles=await ae();return}const t=await Vs(s);this.roleEdit=null,this.roleImpact=null,this.roles=await ae();const r=X.me?.user.id;if(e.assignMe!==!1&&r)try{await Oe({subject_kind:"user",subject_id:r,role_id:t.id,scope_type:"installation",scope_id:"*"}),this.toaster.show(i('התפקיד "{name}" נוצר ושויך אליך (כל המתקן). ההרשאות החדשות ייכנסו לתוקף ברענון הבא של הדף.',{name:t.name}),{ms:0})}catch(n){this.toaster.show(i('התפקיד "{name}" נוצר, אך השיוך האוטומטי אליך נכשל ({error}). שייך אותו ידנית בלשונית "שיוכים".',{name:t.name,error:b(n)}),{ms:0})}else this.toaster.show(i('התפקיד "{name}" נוצר. שייך אותו למשתמש או לקבוצה בלשונית "שיוכים".',{name:t.name}),{ms:0})}catch(s){this.error=b(s)}finally{this.busy=!1}}}setAllRolePerms(e,s,t){const r=this.roleEdit;r&&(this.roleEdit={...r,[e]:t?[...new Set([...r[e],...s])]:r[e].filter(n=>!s.includes(n))},this.scheduleImpact())}async removeRole(e){this.busy=!0,this.error="";try{await Ys(e.id),this.roleDelete=null,this.roles=await ae()}catch(s){this.error=b(s),this.roleDelete=null}finally{this.busy=!1}}async toggleDelegable(e){const s=this.roles?.delegable_roles??[],t=s.includes(e)?s.filter(r=>r!==e):[...s,e];this.busy=!0,this.error="";try{await Js(t),this.roles=await ae()}catch(r){this.error=b(r)}finally{this.busy=!1}}renderRoleDialog(){const e=this.roleEdit,s=this.roles;if(!e||!s)return p;const t=new Set(s.sensitive),r=new Set(s.system_permissions??[]),n=Object.keys(s.labels).filter(m=>!t.has(m)&&!r.has(m)),o=new Set(e.id?s.roles.find(m=>m.id===e.id)?.permissions??[]:[]),d=Yt(Jt(s.sensitive,s.legacy_permissions,o),s.system_permissions),v=this.roleImpact;return a`<sw-dialog open heading=${e.id?i("עריכת תפקיד מותאם"):i("תפקיד מותאם חדש")} subheading=${i("הרשאות רגילות + הרשאות רגישות במפורש · ללא הרשאות מערכת · ההשפעה מוצגת לפני השמירה")} data-role-dialog @close=${()=>this.roleEdit=null}>
      ${this.error?a`<div class="err banner" data-role-error>${this.error}</div>`:p}
      <sw-field label=${i("שם")}><input data-role-name .value=${e.name} @input=${m=>this.roleEdit={...e,name:m.target.value}} /></sw-field>
      <sw-field label=${i("תיאור")}><input .value=${e.description} @input=${m=>this.roleEdit={...e,description:m.target.value}} /></sw-field>
      <div class="hint permsrow">${i("הרשאות רגילות")}
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-perm-all @click=${()=>this.setAllRolePerms("permissions",n,!0)}>${i("בחר הכל")}</sw-button>
          <sw-button size="sm" variant="ghost" data-role-perm-none @click=${()=>this.setAllRolePerms("permissions",n,!1)}>${i("נקה הכל")}</sw-button>
        </span>
      </div>
      <div class="perms">${n.map(m=>a`<label class="chk"><input type="checkbox" data-role-perm=${m} .checked=${e.permissions.includes(m)} @change=${()=>this.toggleRolePerm(m,!1)} /> ${s.labels[m]}</label>`)}</div>
      <div class="hint permsrow" style="margin-block-start:6px">${i("הרשאות רגישות — לעולם לא מרומזות, נדרשות במפורש")}
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-sensitive-all @click=${()=>this.setAllRolePerms("sensitive",d,!0)}>${i("בחר הכל")}</sw-button>
          <sw-button size="sm" variant="ghost" data-role-sensitive-none @click=${()=>this.setAllRolePerms("sensitive",d,!1)}>${i("נקה הכל")}</sw-button>
        </span>
      </div>
      <div class="perms">${d.map(m=>a`<label class="chk sens"><input type="checkbox" data-role-sensitive=${m} .checked=${e.sensitive.includes(m)} @change=${()=>this.toggleRolePerm(m,!0)} /> ${s.labels[m]??m}</label>`)}</div>
      ${e.id?p:a`<label class="chk" style="margin-block-start:6px"><sw-toggle size="sm" labelHidden in-label label=${i("שייך את התפקיד אליי מיד (כל המתקן)")} data-role-assign-me .checked=${e.assignMe!==!1} @change=${m=>this.roleEdit={...e,assignMe:ue(m)}}></sw-toggle> ${i("שייך את התפקיד אליי מיד (כל המתקן)")}</label>`}
      <label class="chk" style="margin-block-start:6px"><sw-toggle size="sm" labelHidden in-label label=${i("מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)")} data-role-delegable ?disabled=${e.sensitive.length>0||e.permissions.includes("rbac.assign")} .checked=${e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")} @change=${m=>this.roleEdit={...e,delegable:ue(m)}}></sw-toggle> ${i("מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)")}${e.sensitive.length||e.permissions.includes("rbac.assign")?a`<span class="hint"> · ${i("לא זמין: תפקיד עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה")}</span>`:p}</label>
      ${v?a`<div class="impact" data-role-impact>
            <strong>${i("השפעת השינוי:")}</strong> ${i("{n} שיוכים",{n:v.bindings})} · ${i("{n} משתמשים",{n:v.users.length})}${v.users.length?` (${v.users.map(m=>m.name).join(", ")})`:""}${v.groups.length?` · ${i("{n} קבוצות",{n:v.groups.length})}`:""}${v.scopes.length?` · ${i("היקפים:")} ${v.scopes.join(", ")}`:""}
            <div>${v.added.length?a`${i("יתווספו:")} ${v.added.map(m=>s.labels[m]??m).join(", ")}`:i("ללא הרשאות חדשות")} · ${v.removed.length?a`<span class="err">${i("יוסרו:")} ${v.removed.map(m=>s.labels[m]??m).join(", ")}</span>`:i("ללא הסרות")}</div>
          </div>`:p}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.roleEdit=null}>${i("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-role-save ?disabled=${this.busy||!e.name.trim()||!e.permissions.length&&!e.sensitive.length} @click=${()=>this.saveRole()}>${e.id?i("שמירה"):i("צור תפקיד")}</sw-button>
    </sw-dialog>`}renderRolesApi(){const e=this.roles;return a`<div class="roles">${e.roles.map(s=>a`<sw-card class="role" data-role-card=${s.id}><h4><span class="ic"><sw-icon name=${s.custom?"user":s.id==="viewer"?"eye":s.id==="operator"?"play":s.id==="editor"?"edit":s.id==="site_admin"?"building":s.id==="kiosk"?"grid":"shield"} size=${14}></sw-icon></span>${s.name}${s.custom?a` <sw-badge kind="recorded" label=${i("מותאם")}></sw-badge>`:p}${s.system_role?a` <sw-badge kind="neutral" label=${i("הרשאות מערכת")}></sw-badge>`:p}${s.delegable?a` <sw-badge kind="historic" label=${i("ניתן להאצלה")}></sw-badge>`:p}</h4>${s.description?a`<div class="desc">${s.description}</div>`:p}<div class="a">${i("מותר:")} ${s.permissions.map(t=>this.label(t)).join(", ")}</div><div class="d">${i("לא כלול אוטומטית:")} ${s.sensitive_missing.map(t=>this.label(t)).join(", ")||"—"}</div>${A("system.configure")?a`<div class="pol" data-second-factor-policy-role>${E("secondFactor.overrideLabel")}<sw-second-factor-policy kind="role" .subjectId=${s.id}></sw-second-factor-policy></div>`:p}${s.custom&&e.can_manage_roles?a`<div class="acts"><sw-button size="sm" data-role-edit @click=${()=>this.openRole(s)}>${i("עריכה")}</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-role-delete @click=${()=>this.roleDelete=s}>${i("מחיקה")}</sw-button></div>`:p}</sw-card>`)}</div>
      ${e.can_manage_roles?a`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" data-role-new @click=${()=>this.openRole()}>${i("תפקיד מותאם חדש")}</sw-button></div>
            <sw-card heading=${i("האצלת שיוך תפקידים למנהלי אתר")} subheading=${i("מנהל אתר משייך רק תפקידים מהרשימה הזו, רק הרשאות שהוא מחזיק בעצמו, רק בתוך ההיקף שלו, ולעולם לא לעצמו; קבוצה — רק כשכל השיוכים שלה בהיקף שלו")} style="margin-block-start:12px" data-delegation>
              <div class="chips">${e.roles.filter(s=>!s.delegation_block).map(s=>a`<sw-chip data-delegable=${s.id} ?selected=${(e.delegable_roles??[]).includes(s.id)} @click=${()=>void this.toggleDelegable(s.id)}>${s.name}</sw-chip>`)}</div>
              <div class="hint" style="margin-block-start:6px" data-delegation-blocked>${i("לעולם לא ניתנים להאצלה:")} ${e.roles.filter(s=>s.delegation_block).map(s=>`${s.name} (${s.delegation_block==="system_role"?i("תפקיד ניהול / הרשאות מערכת"):s.delegation_block==="assign_role"?i("כולל שיוך תפקידים"):i("הרשאה רגישה")})`).join(" · ")||"—"}. ${i("ברירת המחדל: צופה ומפעיל.")}</div>
            </sw-card>`:e.delegated?a`<div class="hint" style="margin-block-start:10px" data-delegation>${i("מוצגים רק התפקידים שמותר לך לשייך בהיקף שלך (רשימת ההאצלה של ההתקנה). עריכת תפקידים והרשימה — מנהל המערכת בלבד.")}</div>`:p}
      <div class="hint">${i("תפקידים מובנים אינם נערכים; תפקיד מותאם מורכב מהרשאות רגילות ומהרשאות רגישות שניתנות במפורש, ולעולם לא מהרשאות מערכת. התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.")}</div>
      <elec-permission-rows .roles=${e}></elec-permission-rows>
      ${this.renderRoleDialog()}
      ${this.roleDelete?a`<sw-dialog open heading=${i("מחיקת תפקיד")} subheading=${this.roleDelete.name} @close=${()=>this.roleDelete=null}>
            <div class="hint">${i("תפקיד משויך אינו נמחק: בטל קודם את השיוכים. המחיקה נרשמת באודיט.")}</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.roleDelete=null}>${i("ביטול")}</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-role-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeRole(this.roleDelete)}>${i("מחק")}</sw-button>
          </sw-dialog>`:p}`}doorPermissionNote(e){const s=rt(e,A("system.configure"));return s?a`<div class="hint" style="margin-block-start:12px" data-effective-door-note>${s.text}${s.link?a` <a data-effective-door-link href=${s.link.href}>${s.link.label}</a>`:p}</div>`:p}renderEffectiveApi(){const e=this.directory,s=this.preview;return a`
      <div class="toolbar">
        <sw-field label=${i("משתמש")}><select @change=${t=>this.previewUser=t.target.value}>${e.users.map(t=>a`<option value=${t.id} ?selected=${t.id===this.previewUser}>${t.name}</option>`)}</select></sw-field>
        <sw-field label=${i("היקף")}><select @change=${t=>this.previewScope=t.target.value}>${this.scopeOptions.map(t=>a`<option value=${`${t.type}:${t.id}`} ?selected=${`${t.type}:${t.id}`===this.previewScope}>${t.name}</option>`)}</select></sw-field>
        <sw-button variant="primary" icon="shield" data-effective-run ?disabled=${this.busy||!this.previewUser} @click=${()=>this.runPreview()}>${i("חשב")}</sw-button>
      </div>
      ${s?a`<sw-card heading=${`${this.userName(s.user_id)} · ${s.scope_name}`} subheading=${s.active?i("רוויזיה {n}",{n:s.revision}):i("המשתמש ללא גישה (מושבת או נמחק ב־HA)")}>
            <div class="eff">
              <div><div class="sec">${i("מותר בהיקף")}</div>${s.allowed.length?s.allowed.map(t=>a`<div class="row"><span>${this.label(t)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`):a`<div class="row"><span>${i("כלום")}</span></div>`}</div>
              <div><div class="sec">${i("מחוץ להיקף / לא מוקנה")}</div>${s.denied.map(t=>a`<div class="row"><span>${this.label(t)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
            </div>
            ${this.doorPermissionNote(s.allowed)}
            ${s.bindings.length?a`<div class="sec">${i("שיוכים שנלקחו בחשבון")}</div>${s.bindings.map(t=>a`<div class="bind"><div>${t.role_name} · ${t.scope_name}${t.via_group?` (${i('קבוצה "{name}"',{name:t.via_group})})`:""}</div></div>`)}`:p}
            <div class="hint" style="margin-block-start:12px">${i("תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו; החישוב נעשה בצד השרת.")}</div>
          </sw-card>`:a`<sw-state-panel icon="shield" state="empty" heading=${i("בחר משתמש והיקף")} hint=${i("החישוב מראה מה מותר ומה לא למשתמש בהיקף שנבחר, לפי השיוכים האישיים ושיוכי הקבוצות.")} data-effective-idle></sw-state-panel>`}
    `}renderAuditApi(){if(!this.audit)return this.loadAudit(),a`<sw-state-panel state="loading"></sw-state-panel>`;const e=[{key:"at",label:i("זמן"),render:s=>a`<span style="font-size:var(--sw-fs-xs)">${C(String(s.at))}</span>`},{key:"actor_username",label:i("מבצע"),render:s=>a`${String(s.actor_username??i("מערכת / HA"))}`},{key:"action",label:i("פעולה"),render:s=>a`${Zs[String(s.action)]??String(s.action)}`},{key:"resource_id",label:i("משאב"),render:s=>a`${s.resource_type==="user"?this.userName(String(s.resource_id)):s.resource_type==="group"?this.groups?.find(t=>t.id===s.resource_id)?.name??String(s.resource_id):String(s.resource_id??"")}`},{key:"decision",label:i("החלטה"),render:s=>a`<sw-badge kind=${s.decision==="denied"?"forbidden":"live"} label=${s.decision==="denied"?`${i("נחסם")}${s.reason?` · ${String(s.reason)}`:""}`:i("הותר")}></sw-badge>`},{key:"details",label:i("פרטים"),render:s=>{const t=s.details,r=[t.role_id?`${String(t.role_id)}`:"",t.scope?String(t.scope):"",Array.isArray(t.added)&&t.added.length?`+${t.added.length}`:"",Array.isArray(t.removed)&&t.removed.length?`−${t.removed.length}`:"",t.revision?`rev ${String(t.revision)}`:""].filter(Boolean);return a`<span style="font-size:var(--sw-fs-xs);direction:ltr;unicode-bidi:isolate">${r.join(" · ")}</span>`}}];return a`<sw-lookup-scope></sw-lookup-scope>${this.audit.length?a`<sw-table dense .columns=${e} .rows=${this.audit} rowKey="at"></sw-table>`:a`<sw-state-panel icon="users" state="empty" heading=${i("אין רשומות אודיט הרשאות")} hint=${i("כל שיוך, ביטול, קבוצה או שינוי מצב משתמש יופיע כאן.")}></sw-state-panel>`}`}renderApi(){if(this.forbidden)return a`<sw-page heading=${i("משתמשים והרשאות")}><sw-state-panel state="forbidden" hint=${i("צפייה בספריית המשתמשים דורשת תפקיד מנהל מערכת.")}></sw-state-panel></sw-page>`;if(this.error&&!this.directory)return a`<sw-page heading=${i("משתמשים והרשאות")}><sw-state-panel state="error" hint=${this.error} actionLabel=${i("נסה שוב")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.directory||!this.roles)return a`<sw-page heading=${i("משתמשים והרשאות")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.directory,s=[{id:"users",label:i("משתמשים"),count:e.users.length},{id:"groups",label:i("קבוצות"),count:this.groups?.length??0},{id:"roles",label:i("תפקידים"),count:this.roles.roles.length},{id:"effective",label:i("הרשאות אפקטיביות")},...!e.delegated||e.assignable_roles?.includes("door_opener")?[{id:"doors",label:i("פתיחת דלתות")}]:[],...e.delegated&&!this.groupsMeta.can_manage?[]:[{id:"audit",label:i("אודיט הרשאות")}],...A("users.ha_manage")?[{id:"ha-users",label:f("tab")}]:[],...A("identity.directory.read")?[{id:"local",label:c("tab")}]:[],...A("rbac.assign")?[{id:"home",label:i("ממשק ביתי")}]:[],...!e.delegated&&(A("system.configure")||A("rbac.assign"))?[{id:"factor",label:u("אימות דו־שלבי")}]:[]],t=e.delegated&&!this.groupsMeta.can_manage?`${i("מנהל אתר · שיוך תפקידים מרשימת ההאצלה בתוך ההיקף שלך בלבד")} · ${i("{n} משתמשים פעילים",{n:e.users.length})} · ${i("רוויזיית הרשאות {n}",{n:e.revision})}`:e.directory.paired?`${i("זהות מ־Home Assistant")} · ${i("{n} משתמשים בספרייה",{n:e.directory.users})} · ${i("עודכן {time}",{time:C(e.directory.last_directory_at)})} · ${i("רוויזיית הרשאות {n}",{n:e.revision})}`:i("זהות מ־Home Assistant · הגשר עדיין לא מצומד: מוצגים רק משתמשים שנכנסו דרך Ingress");return a`
      <sw-page heading=${i("משתמשים והרשאות")} subheading=${t}>
        ${e.delegated?p:a`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${i("סנכרון משתמשים מ־HA")}</sw-button>`}
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label=${i("הרשאות")} .items=${s} .active=${this.tab} @change=${r=>this.setTab(r.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>${i("שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות.")} ${A("users.ha_manage")?i('משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.'):i('אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.')}</div>
        ${this.message||this.error?a`<div class="bar">${this.message?a`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:p}${this.error?a`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:p}</div>`:p}
        ${this.tab==="users"?this.renderUsersApi():this.tab==="groups"?this.renderGroupsApi():this.tab==="roles"?this.renderRolesApi():this.tab==="effective"?this.renderEffectiveApi():this.tab==="doors"?a`<sw-door-grants data-door-grants></sw-door-grants>`:this.tab==="ha-users"?a`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.tab==="home"?a`<sw-home-admin data-home-admin-tab></sw-home-admin>`:this.tab==="factor"?a`<sw-factor-policy-admin data-factor-policy-tab ?canEdit=${A("system.configure")}></sw-factor-policy-admin>`:this.tab==="local"?a`<system-local-users data-local-users-tab .roles=${Se(this.roles.roles)} .scopes=${this.scopeOptions}></system-local-users>`:this.renderAuditApi()}
      </sw-page>
    `}renderUsers(){const e=xe.find(s=>s.id===this.selected);return a`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${xe} .selected=${this.selected} @row-select=${s=>{this.selected=s.detail.id,this.assigning=!1}}></sw-table>
        ${e?a`<sw-drawer open heading=${e.name} subheading=${`HA: ${e.haUser} · ${e.active?i("פעיל"):i("מושבת")}`} @close=${()=>this.selected=null}>
              ${this.assigning?a`<div class="wiz">
                    <sw-steps .steps=${[i("תפקיד"),i("היקף"),i("תצוגה מקדימה"),i("שמירה")]} .current=${this.step}></sw-steps>
                    <sw-field label=${i("קבוצה או תפקיד")}><select><option>${i("עורך מפות ותצוגות")}</option><option>${i("מפעיל")}</option><option>${i("צופה")}</option><option>${i("מנהל אתר/מבנה/קומה")}</option></select></sw-field>
                    <sw-field label=${i("היקף")}><select><option>${i("מבנה א · קומה 2")}</option><option>${i("מבנה א")}</option><option>${i("אתר הדגמה")}</option></select></sw-field>
                    <div class="eff">
                      <div><div class="sec">${i("מותר בהיקף")}</div><div class="row"><span>${i("עריכת תוכנית קומה 2")}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div><div class="row"><span>${i("הצבת ציוד מורשה")}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div></div>
                      <div><div class="sec">${i("לא ניתן")}</div><div class="row"><span>${i("עריכת קומה 3")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>${i("ניהול משתמשים / NVR")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>${i("פתיחת מנעול")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
                    </div>
                    <div class="hint">${i("הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־HA. השינוי ירשם באודיט עם diff לפני/אחרי.")}</div>
                  </div>`:a`<dl>
                    <dt>${i("מקור זהות")}</dt><dd>Home Assistant · <span class="ltr">${e.haUser}</span></dd>
                    <dt>${i("סנכרון אחרון")}</dt><dd>${e.lastSync}</dd>
                    <dt>${i("קבוצות")}</dt><dd>${e.groups.join(", ")||"—"}</dd>
                    <dt>${i("שיוכים")}</dt><dd>${e.bindings.length?e.bindings.map(s=>a`<div>${s.role} · ${s.scope}</div>`):i("ללא: אין גישה לתוכן")}</dd>
                  </dl>
                  <div class="hint">${i("אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.")}</div>`}
              <div slot="footer" class="dfoot">
                ${this.assigning?a`<sw-button variant="primary" size="sm" icon="check">${i("שמור שיוך")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.assigning=!1}>${i("ביטול")}</sw-button>`:a`<sw-button variant="primary" size="sm" icon="plus" @click=${()=>{this.assigning=!0,this.step=2}}>${i("שיוך תפקיד")}</sw-button><sw-button variant="ghost" size="sm" icon="shield">${i("הרשאות אפקטיביות")}</sw-button>`}
              </div>
            </sw-drawer>`:""}
      </div>
    `}renderGroups(){const e=[{key:"name",label:i("קבוצה"),render:s=>a`<strong>${String(s.name)}</strong>`},{key:"members",label:i("חברים")},{key:"bindings",label:i("שיוכים (תפקיד · היקף)"),render:s=>a`${s.bindings.map(t=>a`<div>${t}</div>`)}`},{key:"more",label:"",width:"40px",render:()=>a`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${i("עוד")}></sw-button>`}];return a`<sw-table .columns=${e} .rows=${Qe}></sw-table><div class="hint">${i("שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.")}</div>`}renderRoles(){return a`<div class="roles">${es.map(e=>a`<sw-card class="role"><h4><span class="ic"><sw-icon name=${e.id==="viewer"?"eye":e.id==="operator"?"play":e.id==="editor"?"edit":e.id==="site_admin"?"building":"shield"} size=${14}></sw-icon></span>${e.name}</h4><div class="a">${i("מותר:")} ${e.allowed}</div><div class="d">${i("לא ניתן אוטומטית:")} ${e.denied}</div></sw-card>`)}</div><div class="hint">${i("תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.")}</div>`}renderEffective(){return a`
      <sw-card heading=${i("דנה · עורכת קומה 2")}>
        <div class="eff">
          <div>
            <div class="sec">${i("מבנה א · קומה 2")}</div>
            ${[i("מפה: קריאה"),i("תוכנית: יבוא/עריכה/פרסום"),i("מיקומים ותצוגות: עריכה"),i("שידור חי: מצלמות מורשות")].map(e=>a`<div class="row"><span>${e}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}
          </div>
          <div>
            <div class="sec">${i("מחוץ להיקף / לא מוקנה")}</div>
            ${[i("קומה 3: הכל"),i("Playback וייצוא"),i("ניהול משתמשים"),i("הגדרות NVR / go2rtc"),i("פתיחת מנעול")].map(e=>a`<div class="row"><span>${e}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}
          </div>
        </div>
        <div class="hint" style="margin-block-start:8px">${i("תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו. permission_revision: 7.")}</div>
      </sw-card>
    `}renderAudit(){const e=[{key:"time",label:i("זמן")},{key:"user",label:i("משתמש"),render:s=>a`<div class="who"><sw-avatar name=${String(s.user)} size=${24}></sw-avatar>${String(s.user)}</div>`},{key:"action",label:i("פעולה")},{key:"resource",label:i("משאב")},{key:"decision",label:i("החלטה"),render:s=>a`<sw-badge kind=${String(s.decision).startsWith("נחסם")?"forbidden":"live"} label=${String(s.decision)}></sw-badge>`},{key:"role",label:i("תפקיד/היקף ששימשו")}];return a`<sw-table dense .columns=${e} .rows=${zs.filter(s=>s.action.includes("תוכנית")||s.action.includes("סנכרון")||s.action.includes("Ingress"))}></sw-table>`}render(){return I()?this.renderApi():a`
      <sw-page heading=${i("משתמשים והרשאות")} subheading=${i("זהות מ־Home Assistant · הרשאות בתוך Arx בלבד · נתוני הדגמה")}>
        <sw-button slot="actions" icon="refresh">${i("סנכרון משתמשים מ־HA")}</sw-button>
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label=${i("הרשאות")} .items=${[...Be,{id:"ha-users",label:f("tab")}]} .active=${this.tab} @change=${e=>this.setTab(e.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>${i("שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות.")} ${A("users.ha_manage")?i('משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.'):i('אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.')}</div>
        ${this.tab==="users"?this.renderUsers():this.tab==="groups"?this.renderGroups():this.tab==="roles"?this.renderRoles():this.tab==="effective"?this.renderEffective():this.tab==="ha-users"?a`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.renderAudit()}
      </sw-page>
    `}};_.styles=[Ce,B`
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
    /* ACCESS-POLISH-2331: the user and group drawers are modal (fixed to the viewport, actions always in view), so the stage no longer
       reserves a fixed 420 / 620 px height for an absolutely placed panel - a short list ends where its rows end */
    .stage {
      position: relative;
    }
    .groups-stage {
      margin-block-start: 12px;
    }
    /* a section label inside a drawer, a dialog or a result card (was an inline style repeated a dozen times) */
    .sec {
      margin-block: 12px 4px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .sec:first-child {
      margin-block-start: 0;
    }
    .msg {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .msg.ok {
      background: var(--sw-success-soft);
    }
    .msg.err {
      background: var(--sw-danger-soft);
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
      border-radius: var(--sw-r-xs);
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
      color: var(--sw-warning-text);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .impact {
      margin-block-start: 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    ${Ss}
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
      border-radius: var(--sw-r-sm);
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .role .a {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .role .d {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    /* a custom role's own description is plain text, not a warning (it used the red "not included" style) */
    .role .desc {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      margin-block-end: 4px;
    }
    .role .pol {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .role .acts {
      display: flex;
      gap: 6px;
      margin-block-start: 10px;
    }
    .role .a,
    .role .d {
      line-height: 1.5;
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
    dd .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .remote-off {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-block-start: 6px;
      padding: 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-danger-soft);
      font-size: var(--sw-fs-xs);
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
    /* inside a drawer the panel body is the one scroll container: no second, nested scroll for the member list */
    .members.in-drawer {
      max-block-size: none;
      overflow: visible;
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
      color: var(--sw-success-text);
    }
    .err {
      color: var(--sw-danger-text);
    }
    /* the drawer footer's actions: one row with a gap; a destructive action sits apart at the far end */
    .dfoot {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      inline-size: 100%;
    }
    .dfoot .end {
      margin-inline-start: auto;
    }
    ${Je}
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
  `,ss];x([h()],_.prototype,"tab",2);x([h()],_.prototype,"selected",2);x([h()],_.prototype,"assigning",2);x([h()],_.prototype,"step",2);x([h()],_.prototype,"directory",2);x([h()],_.prototype,"roles",2);x([h()],_.prototype,"groups",2);x([h()],_.prototype,"tree",2);x([h()],_.prototype,"audit",2);x([h()],_.prototype,"selectedGroup",2);x([h()],_.prototype,"wizard",2);x([h()],_.prototype,"members",2);x([h()],_.prototype,"newGroup",2);x([h()],_.prototype,"preview",2);x([h()],_.prototype,"previewUser",2);x([h()],_.prototype,"previewScope",2);x([h()],_.prototype,"busy",2);x([h()],_.prototype,"error",2);x([h()],_.prototype,"forbidden",2);x([h()],_.prototype,"roleEdit",2);x([h()],_.prototype,"roleImpact",2);x([h()],_.prototype,"roleDelete",2);x([h()],_.prototype,"groupsMeta",2);x([h()],_.prototype,"renameDraft",2);x([h()],_.prototype,"groupChange",2);x([h()],_.prototype,"remoteOff",2);x([h()],_.prototype,"narrow",2);_=x([W("system-access")],_);export{_ as SystemAccess};
