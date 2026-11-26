import{j as b,k as v,a as $,q as m,v as n,A as i,b as a,mm as y,m as x,bg as D,bv as E,cL as l,fn as L,S as _,o as g}from"./index-C0HbI5eb.js";import"./sw-second-factor-C_8EFW8w.js";import"./sw-passkeys-RctsndWp.js";import{listDeviceKeys as C,revokeDeviceKey as O}from"./factor-screens-DaY_HplV.js";import{o as T}from"./passkey-only-Bw1zOWNY.js";import{s as K,r as S}from"./second-factor-CA0QZqPj.js";import"./sw-logo-art-PLtEZJxU.js";import"./qrcode-CWKHzRGU.js";import"./step-up-passkey-BPBHQBez.js";import"./local-identity-BnkC12Vm.js";import"./confirm-dialog-CEi4gaw7.js";var j=Object.defineProperty,R=Object.getOwnPropertyDescriptor,w=(e,s,t,d)=>{for(var r=d>1?void 0:d?R(s,t):s,o=e.length-1,c;o>=0;o--)(c=e[o])&&(r=(d?c(s,t,r):c(r))||r);return d&&r&&j(s,t,r),r};const I={hardware:{label:()=>n("מאומת בחומרה"),kind:"live"},software:{label:()=>n("מפתח תוכנה"),kind:"partial"},none:{label:()=>n("ללא אימות מכשיר"),kind:"neutral"},failed:{label:()=>n("אימות המכשיר נכשל"),kind:"partial"},not_checked:null};let h=class extends ${constructor(){super(...arguments),this.data=null,this.error="",this.message="",this.busy=!1,this.armed=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await C(),this.error=""}catch(e){this.error=m(e),this.data={keys:[],auth_kind:"biometric_or_screen_lock",attestation:"off",max:0}}}async revoke(e){if(this.armed!==e.id){this.armed=e.id;return}this.armed="",this.busy=!0,this.message="",this.error="";let s="";try{await O(e.id),this.message=n("מפתח הטלפון בוטל."),this.dispatchEvent(new CustomEvent("factors-changed",{bubbles:!0,composed:!0}))}catch(t){s=m(t),this.error=s}finally{this.busy=!1,await this.load(),s&&!this.error&&(this.error=s)}}renderRow(e){const s=I[e.attested],t=this.armed===e.id;return a`<li data-device-key=${e.id} data-attested=${e.attested}>
      <sw-icon name="sensor" size=${16}></sw-icon>
      <div class="what">
        <div class="top">
          <span class="name">${e.label||n("טלפון")}</span>
          ${s?a`<sw-badge kind=${s.kind} label=${s.label()} data-device-key-attested></sw-badge>`:i}
          ${e.counts===!1?a`<sw-badge kind="partial" label=${n("לא נספר")} data-device-key-off></sw-badge>`:i}
        </div>
        <div class="sub">
          <span>${e.auth_kind==="biometric"?n("טביעת אצבע או פנים"):n("טביעת אצבע, פנים או נעילת מסך")}</span>
          <span>· ${n("נוסף {when}",{when:y(e.created_at)})}</span>
          ${e.last_used_at?a`<span>· ${n("בשימוש {when}",{when:y(e.last_used_at)})}</span>`:i}
        </div>
      </div>
      <span class="acts">
        <sw-button size="sm" variant=${t?"danger":"ghost"} icon="trash" data-revoke-device-key ?disabled=${this.busy} @click=${()=>void this.revoke(e)}>${t?n("לבטל?"):n("בטל")}</sw-button>
        ${t?a`<sw-button size="sm" variant="ghost" data-revoke-device-key-cancel @click=${()=>this.armed=""}>${n("ביטול")}</sw-button>`:i}
      </span>
    </li>`}render(){const e=this.data;return e===null?a`<div class="muted">${n("טוען…")}</div>`:a`
      ${e.keys.length?a`<ul data-device-keys-list>${e.keys.map(s=>this.renderRow(s))}</ul>`:this.error?i:a`<div class="muted" data-device-keys-empty>${n("אין מפתחות טלפון. מוסיפים מפתח באפליקציית Android.")}</div>`}
      ${e.keys.some(s=>s.counts===!1)?a`<div class="warn" role="note" data-device-keys-required><sw-icon name="warning" size=${14}></sw-icon><span>${n("מפתח שאינו מאומת בחומרה אינו נספר. רשום אותו מחדש באפליקציה.")}</span></div>`:i}
      ${this.message?a`<div class="ok" role="status" data-device-keys-message>${this.message}</div>`:i}
      ${this.error?a`<div class="err" role="alert" data-device-keys-error>${this.error}</div>`:i}
    `}};h.styles=b`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-1h) 0;
      border-block-end: thin solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    li > sw-icon {
      color: var(--sw-text-3);
      flex-shrink: 0;
    }
    .what {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .top {
      display: flex;
      align-items: center;
      gap: var(--sw-s-1h);
      flex-wrap: wrap;
    }
    .name {
      overflow-wrap: anywhere;
      unicode-bidi: isolate;
    }
    .sub {
      display: flex;
      gap: var(--sw-s-1);
      flex-wrap: wrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .acts {
      display: flex;
      gap: var(--sw-s-1);
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .warn {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-1h);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
    .warn sw-icon {
      flex-shrink: 0;
      margin-block-start: var(--sw-s-1);
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;w([v()],h.prototype,"data",2);w([v()],h.prototype,"error",2);w([v()],h.prototype,"message",2);w([v()],h.prototype,"busy",2);w([v()],h.prototype,"armed",2);h=w([x("sw-device-keys")],h);const A=()=>D("auth/tokens"),q=e=>E(`auth/tokens/${encodeURIComponent(e)}`,{method:"DELETE"}),F=()=>E("auth/tokens",{method:"DELETE"});var N=Object.defineProperty,M=Object.getOwnPropertyDescriptor,u=(e,s,t,d)=>{for(var r=d>1?void 0:d?M(s,t):s,o=e.length-1,c;o>=0;o--)(c=e[o])&&(r=(d?c(s,t,r):c(r))||r);return d&&r&&N(s,t,r),r};const z={long_lived:()=>l("אסימון ארוך טווח"),short_lived:()=>l("כניסה"),unknown:()=>l("אסימון"),app:()=>l("כניסה שמורה באפליקציה")},U={long_lived:"lock",short_lived:"link",unknown:"link",app:"sensor"};let p=class extends ${constructor(){super(...arguments),this.data=null,this.error="",this.message="",this.busy=!1,this.armed=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await A(),this.error=""}catch(e){this.error=m(e),this.data={ha_listed:!1,ha_reason:null,tokens:[],app_enabled:!1}}}async revoke(e){this.busy=!0,this.message="",this.error="";let s="";try{await q(e.id),this.message=l("הכניסה השמורה בוטלה.")}catch(t){s=m(t),this.error=s}finally{this.busy=!1,await this.load(),s&&!this.error&&(this.error=s)}}async revokeAll(){if(!this.armed){this.armed=!0;return}this.armed=!1,this.busy=!0,this.message="",this.error="";let e="";try{const s=await F();this.message=l("בוטלו {n} כניסות שמורות.",{n:s.revoked})}catch(s){e=m(s),this.error=e}finally{this.busy=!1,await this.load(),e&&!this.error&&(this.error=e)}}renderRow(e){const s=e.name||(e.kind==="short_lived"&&e.client?e.client:z[e.kind]()),t=e.last_used_at??null;return a`<li class=${e.current?"cur":""} data-access-token=${e.id} data-kind=${e.kind} data-source=${e.source}>
      <sw-icon name=${U[e.kind]} size=${16}></sw-icon>
      <div class="what">
        <div class="top">
          <span class="ltr-iso name">${s}</span>
          ${e.name||e.kind==="short_lived"&&e.client?a`<span class="kind">${z[e.kind]()}</span>`:i}
          ${e.current?a`<sw-badge kind="recorded" label=${l("המכשיר הזה")} data-current></sw-badge>`:i}
          ${e.kind==="long_lived"?a`<sw-badge kind="partial" label=${l("ללא אימות חוזר")} data-exempt></sw-badge>`:i}
        </div>
        <div class="sub">
          ${e.created_at?a`<span>${l("נוצר {when}",{when:y(e.created_at)})}</span>`:i}
          ${t?a`<span>· ${l("בשימוש {when}",{when:y(t)})}</span>`:i}
          ${e.used_in_arx&&e.arx_last_seen_at?a`<span data-used-in-arx>· ${l("ב־Arx מבחוץ {when}",{when:y(e.arx_last_seen_at)})}</span>${e.arx_address?a`<span class="ltr-iso">· ${e.arx_address}</span>`:i}`:e.source==="ha"?a`<span>· ${l("לא שימש מבחוץ ב־Arx")}</span>`:i}
          ${e.expires_at?a`<span>· ${l("בתוקף עד {when}",{when:L(new Date(e.expires_at))})}</span>`:i}
        </div>
      </div>
      ${e.revocable?a`<sw-button size="sm" variant="ghost" icon="logout" data-revoke-token ?disabled=${this.busy} @click=${()=>void this.revoke(e)}>${l("בטל")}</sw-button>`:i}
    </li>`}renderNote(e){if(e.ha_listed||e.ha_reason==="local_user")return i;const s=e.ha_reason==="local_channel"?l("רשימת האסימונים של תשתית המערכת מוצגת בכניסה מרחוק. כאן מוצג רק מה ש־Arx ראה."):e.ha_reason==="ha_unavailable"?l("תשתית המערכת לא זמינה כרגע. מוצג מה ש־Arx ראה."):l("הכניסה הזו אינה מחזיקה אסימון של תשתית המערכת. מוצג מה ש־Arx ראה.");return a`<div class="muted" data-tokens-note=${e.ha_reason??""}>${s}</div>`}render(){const e=this.data;if(e===null)return a`<div class="muted">${l("טוען אסימונים…")}</div>`;const s=e.tokens,t=s.filter(o=>o.kind!=="app"),d=s.filter(o=>o.kind==="app"),r=t.some(o=>o.kind==="long_lived");return a`
      ${this.renderNote(e)}
      ${s.length?a`<ul data-access-tokens-list>${t.map(o=>this.renderRow(o))}${d.map(o=>this.renderRow(o))}</ul>`:this.error?i:a`<div class="muted" data-access-tokens-empty>${l("אין אסימוני גישה.")}</div>`}
      ${r?a`<div class="warn" role="note" data-long-lived-note>
            <sw-icon name="warning" size=${14}></sw-icon>
            <span>${l("אסימון ארוך טווח נכנס בלי אימות חוזר לפני שינויים. אם אינך מזהה אותו, בטל אותו בתשתית המערכת.")}</span>
          </div>`:i}
      ${e.ha_reason!=="local_user"&&(t.length||!e.ha_listed)?a`<div class="muted" data-ha-hint>${l("את אסימוני תשתית המערכת מבטלים בתשתית המערכת: פרופיל ‹ אבטחה. Arx לא משנה אותם.")}</div>`:i}
      ${d.length>1?a`<div class="foot">
            <sw-button size="sm" variant=${this.armed?"danger":"secondary"} icon="logout" data-revoke-all-tokens ?disabled=${this.busy} @click=${()=>void this.revokeAll()}>
              ${this.armed?l("לאשר? כל הכניסות השמורות יבוטלו"):l("בטל את כל הכניסות השמורות")}
            </sw-button>
            ${this.armed?a`<sw-button size="sm" variant="ghost" @click=${()=>this.armed=!1}>${l("ביטול")}</sw-button>`:i}
          </div>`:i}
      ${this.message?a`<div class="ok" role="status" data-access-tokens-message>${this.message}</div>`:i}
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:i}
    `}};p.styles=b`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    li > sw-icon {
      color: var(--sw-text-3);
      flex-shrink: 0;
    }
    li.cur > sw-icon {
      color: var(--sw-accent);
    }
    .what {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .name {
      overflow-wrap: anywhere;
    }
    .kind {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sub {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ltr-iso {
      unicode-bidi: isolate;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .warn {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
    .warn sw-icon {
      flex-shrink: 0;
      margin-block-start: 1px;
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;u([v()],p.prototype,"data",2);u([v()],p.prototype,"error",2);u([v()],p.prototype,"message",2);u([v()],p.prototype,"busy",2);u([v()],p.prototype,"armed",2);p=u([x("sw-access-tokens")],p);var B=Object.defineProperty,V=Object.getOwnPropertyDescriptor,P=(e,s,t,d)=>{for(var r=d>1?void 0:d?V(s,t):s,o=e.length-1,c;o>=0;o--)(c=e[o])&&(r=(d?c(s,t,r):c(r))||r);return d&&r&&B(s,t,r),r};const Y={totp:null,passkeys:null,deviceKeys:null,recovery:null,longLived:null},f=async e=>{try{return await e}catch{return null}};let k=class extends ${constructor(){super(...arguments),this.ov=null,this.onChanged=()=>void this.load(),this.seq=0}connectedCallback(){super.connectedCallback(),this.load(),window.addEventListener(_,this.onChanged),this.addEventListener("factors-changed",this.onChanged)}disconnectedCallback(){window.removeEventListener(_,this.onChanged),this.removeEventListener("factors-changed",this.onChanged),super.disconnectedCallback()}async load(){const e=++this.seq,[s,t,d,r]=await Promise.all([f(K()),f(T()),f(C()),f(A())]),o=s?.enabled?await f(S()):null;e===this.seq&&(this.ov={...Y,totp:s?s.enabled:null,passkeys:t&&t.available?t.credentials.length:null,deviceKeys:d?d.keys.length:null,recovery:o&&o.total>0?{remaining:o.remaining,total:o.total,low:o.low}:s?.enabled?{remaining:0,total:0,low:!0}:null,longLived:r?r.tokens.filter(c=>c.kind==="long_lived").length:null})}line(e,s,t,d,r="on"){return a`<li data-sec-line=${e} data-state=${r}><sw-icon name=${s} size=${16}></sw-icon><span class="l">${t}</span><span class="v">${d}</span></li>`}renderOverview(){const e=this.ov;if(!e)return a`<div class="muted" data-sec-loading>${n("טוען…")}</div>`;const s=t=>t===0?n("אין"):String(t);return a`<ul class="ov" aria-label=${n("סיכום האבטחה")} data-sec-overview>
      ${e.totp!==null?this.line("totp","shield",n("אפליקציית אימות"),e.totp?g("secondFactor.on"):g("secondFactor.off"),e.totp?"on":"off"):i}
      ${e.passkeys!==null?this.line("passkeys","lock",n("מפתחות גישה"),s(e.passkeys),e.passkeys?"on":"off"):i}
      ${e.deviceKeys!==null?this.line("device-keys","sensor",n("מפתחות טלפון"),s(e.deviceKeys),e.deviceKeys?"on":"off"):i}
      ${e.recovery!==null?this.line("recovery","list",g("secondFactor.recoveryTitle"),e.recovery.total?n("{n} מתוך {total}",{n:e.recovery.remaining,total:e.recovery.total}):n("אין"),e.recovery.low?"warn":"on"):i}
      ${e.longLived!==null?this.line("long-lived","link",n("אסימונים ארוכי טווח"),s(e.longLived),e.longLived?"warn":"off"):i}
    </ul>`}render(){return a`
      ${this.renderOverview()}
      <section data-sec-block="totp" aria-labelledby="h-totp"><h3 id="h-totp">${n("אפליקציית אימות וקודי שחזור")}</h3><sw-second-factor></sw-second-factor></section>
      <section data-sec-block="passkeys"><sw-passkeys></sw-passkeys></section>
      <section data-sec-block="device-keys" aria-labelledby="h-dk"><h3 id="h-dk">${n("מפתחות טלפון")}</h3><sw-device-keys></sw-device-keys></section>
      <section data-sec-block="tokens" aria-labelledby="h-tk"><h3 id="h-tk">${n("אסימוני גישה")}</h3><sw-access-tokens></sw-access-tokens></section>
    `}};k.styles=b`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .ov {
      list-style: none;
      margin: 0;
      padding: var(--sw-s-1) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      display: flex;
      flex-direction: column;
    }
    .ov li {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-s-8);
    }
    .ov li + li {
      border-block-start: thin solid var(--sw-border);
    }
    .ov sw-icon {
      color: var(--sw-text-3);
      flex-shrink: 0;
    }
    .ov li[data-state='on'] sw-icon {
      color: var(--sw-accent);
    }
    .ov li[data-state='warn'] sw-icon,
    .ov li[data-state='warn'] .v {
      color: var(--sw-warning-text);
    }
    .l {
      flex: 1;
      min-inline-size: 0;
      color: var(--sw-text);
    }
    .v {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      unicode-bidi: isolate;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    section + section {
      padding-block-start: var(--sw-s-3);
      border-block-start: thin solid var(--sw-border);
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
  `;P([v()],k.prototype,"ov",2);k=P([x("sw-account-security")],k);export{k as SwAccountSecurity};
