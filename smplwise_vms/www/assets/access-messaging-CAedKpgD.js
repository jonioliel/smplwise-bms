import{j as w,b as m,z,k as A,a as O,af as I,A as E,m as R,bw as S,bg as g,dk as $,F as x,c as k,hZ as T}from"./index-CVsAtsN7.js";import{b as v,g as j}from"./wiskey-profiles-DFR__xyK.js";const q=w`
  .sw:disabled {
    cursor: default;
    opacity: var(--sw-disabled-opacity);
  }
  .sw .txt {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sw .x {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .track {
    flex: none;
    position: relative;
    inline-size: 42px;
    block-size: 24px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-toggle-off);
    transition: background var(--sw-t-fast) var(--sw-ease);
  }
  .track::after {
    content: '';
    position: absolute;
    inset-block-start: 3px;
    inset-inline-start: 3px;
    inline-size: 18px;
    block-size: 18px;
    border-radius: 50%;
    background: var(--sw-toggle-thumb);
    box-shadow: var(--sw-shadow-1);
    transition: transform var(--sw-t-fast) var(--sw-ease);
  }
  .sw[aria-checked='true'] .track {
    background: var(--sw-toggle-on);
  }
  .sw[aria-checked='true'] .track::after {
    transform: translateX(-18px);
  }
  :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after {
    transform: translateX(18px);
  }
  @media (prefers-reduced-motion: reduce) {
    .track,
    .track::after {
      transition: none;
    }
  }
`,re=[w`
    .sw {
      display: flex;
      align-items: center;
      gap: 14px;
      inline-size: 100%;
      min-block-size: max(64px, var(--_t));
      padding: 10px 14px;
      box-sizing: border-box;
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .sw:not(:disabled):hover {
      background: var(--sw-hover-wash);
    }
    .sw:focus-visible {
      outline-offset: -2px;
    }
    .sw .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
  `,q];function ie(e,t){return m`<span class="txt"><span class="t">${e}</span>${typeof t=="string"?m`<span class="x">${t}</span>`:t}</span>
    <span class="track" aria-hidden="true"></span>`}const N=/\{\s*(?:pin|code|passcode|card|password|token|credential|secret)\w*\s*\}/i,F=/(?:(?<![a-z])pin|code|pass(?![a-z])|password|passwort|kennwort|mot de passe|קוד|סיסמ|ססמ|פין|код|пин|пароль|رمز|كود|كلمة السر|كلمة المرور|رقم سري)[^0-9]{0,30}[0-9]{4,8}/u,G={0:["zero","אפס","ноль","нуль","صفر"],1:["one","אחת","אחד","один","одна","واحد"],2:["two","שתיים","שתים","שניים","два","две","اثنان","اثنين"],3:["three","שלוש","שלושה","שלש","три","ثلاثة","ثلاث"],4:["four","ארבע","ארבעה","четыре","اربعة","اربع"],5:["five","חמש","חמישה","חמשה","пять","خمسة","خمس"],6:["six","שש","שישה","ששה","шесть","ستة","ست"],7:["seven","שבע","שבעה","семь","سبعة","سبع"],8:["eight","שמונה","восемь","ثمانية","ثمان"],9:["nine","תשע","תשעה","девять","تسعة","تسع"]},D=new Map(Object.entries(G).flatMap(([e,t])=>t.map(n=>[n,e]))),H=new RegExp(`(?<![\\p{L}\\p{N}_])ו?(${[...D.keys()].sort((e,t)=>t.length-e.length).join("|")})(?![\\p{L}\\p{N}_])`,"gu"),B=/(?<=[0-9])[\s\-.,_/\\|·•*]{1,3}(?=[0-9])/gu,U=/(?<!\p{L})((?:\p{L}[.\s]){2,}\p{L})\.?(?!\p{L})/gu,W=new Map(Object.entries({а:"a",е:"e",о:"o",р:"p",с:"c",і:"i","ӏ":"l",ѕ:"s","ԁ":"d",к:"k",м:"m",н:"h",т:"t",у:"y",х:"x",α:"a",ε:"e",ι:"i",κ:"k",ν:"v",ο:"o",ρ:"p",τ:"t",υ:"u"})),V=/[أإآ]/gu;function X(e){const t=e.codePointAt(0);let n=t;for(;n>t-9&&/\p{Nd}/u.test(String.fromCodePoint(n-1));)n--;return String((t-n)%10)}function K(e){let t=e.normalize("NFKC").replace(/[\p{Cf}\p{Mn}]/gu,"").toLowerCase();t=t.replace(/\p{Nd}/gu,n=>/[0-9]/.test(n)?n:X(n)).replace(V,"ا"),t=t.replace(H,(n,s)=>D.get(s)??s),t=t.replace(U,(n,s)=>s.replace(/[.\s]/gu,""));for(let n=0;n<4;n++){const s=t.replace(B,"");if(s===t)break;t=s}return[t,[...t].map(n=>W.get(n)??n).join("")]}const b=e=>N.test(e),Q=e=>b(e)||K(e).some(t=>F.test(t)||b(t));function le(e){return e.filter(t=>t.id&&t.body.trim()&&!b(t.body))}function ce(e,t){return e.replace(/\{(\w+)\}/g,(n,s)=>s in t?t[s]:n)}const P=e=>e?Math.max(0,e.limit-e.used):null;function C(e){const t=[e.quota,e.sender_quota??null].filter(n=>n!==null);return t.length===0?null:t.reduce((n,s)=>s.limit-s.used<n.limit-n.used?s:n)}const Y=e=>Math.max(1,Math.ceil((e??60)/60));function L(e,t){return e.enabled?e.send_hours&&e.send_hours.open_now===!1?"outside_hours":!t||t.has_phone===!1?"no_phone":t.allowed===!1?"forbidden":t.consent==="declined"?"no_consent":null:"no_service"}function h(e,t){const n=t.text.trim();return n?t.template_id===null&&!e.free_text?"free_text_off":n.length>e.text_max?"too_long":Q(n)?"credential":null:"empty"}function ue(e){const t=L(e.config,e.recipient),n=C(e.config),s=n!==null&&P(n)===0;if(e.phase==="sending")return{blocked:t,canSend:!1,textDisabled:!0,line:{tone:"wait",kind:"sending"}};if(e.phase==="sent")return{blocked:t,canSend:!t&&!s&&h(e.config,e.draft)===null,textDisabled:!1,line:{tone:"ok",kind:"sent"}};if(t)return{blocked:t,canSend:!1,textDisabled:!0,line:{tone:"warn",kind:"cant",reason:t}};if(s||e.phase==="failed"&&e.failure==="rate")return{blocked:"rate",canSend:!1,textDisabled:!1,line:{tone:"warn",kind:"rate",minutes:Y(e.retryAfterS??n?.resets_in_s)}};const a=h(e.config,e.draft);return e.phase==="failed"&&e.failure?{blocked:null,canSend:a===null,textDisabled:!1,line:{tone:"err",kind:"failed",reason:e.failure}}:a==="credential"||a==="too_long"||a==="free_text_off"?{blocked:null,canSend:!1,textDisabled:!1,line:{tone:"err",kind:"cant",reason:a}}:{blocked:null,canSend:a===null,textDisabled:!1,line:null}}function de(e,t,n){const s=[],a=[];for(const u of e){const l=L(t,u);l?a.push({recipient:u,reason:l}):s.push(u)}const o=e.length>t.bulk_max,r=P(C(t)),d=r!==null&&s.length>r?r:null;return{send:s,skip:a,tooMany:o,overQuota:d,canSend:s.length>0&&!o&&d===null&&h(t,n)===null}}const Z=e=>new Promise(t=>setTimeout(t,e)),J=new Set(["rate","no_service","disabled","template_changed","outside_hours","consent_unavailable"]);async function pe(e,t,n,s={}){const a=typeof s=="function"?{onProgress:s,paceMs:0}:s,o=a.sleep??Z,r={sent:[],failed:[],rows:e.skip.map(l=>({id:l.recipient.person_id,status:"failed",reason:l.reason}))},d=e.send.length;let u=null;for(let l=0;l<d;l++){const c=e.send[l].person_id,M=a.shouldStop?.()===!0;if(u||M){const p=u??"stopped";r.failed.push({id:c,reason:p}),r.rows.push({id:c,status:"failed",reason:p}),a.onProgress?.(l+1,d);continue}l>0&&(a.paceMs??0)>0&&await o(a.paceMs);let i={ok:!1,reason:"uncertain"};for(let p=0;;p++){try{i=await n(c,t)}catch{i={ok:!1,reason:"uncertain"}}if(!i.ok&&i.reason==="rate"&&i.transient&&p<(a.burstRetries??3)){await o(Math.min(Math.max(i.retry_after_s??5,1),10)*1e3);continue}break}i.ok?(r.sent.push(c),r.rows.push(i.held?{id:c,status:"held"}:{id:c,status:"sent",at:i.sent_at})):(r.failed.push({id:c,reason:i.reason}),r.rows.push({id:c,status:i.reason==="uncertain"?"unknown":"failed",reason:i.reason}),J.has(i.reason)&&(u=i.reason)),a.onProgress?.(l+1,d)}return r}function _e(e,t){const n=new Map(t.map(s=>[s.id,s]));return e.map(s=>n.get(s)).filter(s=>!!s)}function fe(e){const t=n=>e.rows.filter(s=>s.status===n).length;return{sent:t("sent"),held:t("held"),failed:t("failed"),unknown:t("unknown")}}function me(){const e=crypto.getRandomValues(new Uint8Array(12));return`bulk-${Array.from(e,t=>t.toString(16).padStart(2,"0")).join("")}`}var ee=Object.defineProperty,te=Object.getOwnPropertyDescriptor,y=(e,t,n,s)=>{for(var a=s>1?void 0:s?te(t,n):t,o=e.length-1,r;o>=0;o--)(r=e[o])&&(a=(s?r(t,n,a):r(a))||a);return s&&a&&ee(t,n,a),a};let f=null;function ne(){return f??=j().then(e=>e.can_edit===!0,()=>(f=null,!1)),f}let _=class extends O{constructor(){super(...arguments),this.variant="secondary",this.shown=!1}connectedCallback(){super.connectedCallback(),I()&&ne().then(e=>this.shown=e)}render(){return this.shown?m`<sw-button variant=${this.variant} icon="users" data-pf-entry title=${v("entryHint")} @click=${()=>window.location.hash="#/wiskey/profiles"}>${v("entry")}</sw-button>`:E}};_.styles=w`
    :host { display: contents; }
  `;y([z()],_.prototype,"variant",2);y([A()],_.prototype,"shown",2);_=y([R("wk-profiles-link")],_);function se(e){if(!(e instanceof k))return{ok:!1,reason:"uncertain"};const t=e.body?.details??{},n=typeof t.retry_after_s=="number"?t.retry_after_s:void 0;let a={message_no_phone:"no_phone",message_no_consent:"no_consent",message_service_unavailable:"no_service",message_not_registered:"not_registered",message_uncertain:"uncertain",message_expired:"expired",message_free_text_disabled:"free_text_off",message_rate_limited:"rate",intercom_rate_limited:"rate",intercom_busy:"rate",message_forbidden_content:"credential",message_too_long:"too_long",message_empty:"empty",message_forbidden:"forbidden",intercom_person_not_found:"gone",message_template_changed:"template_changed",message_disabled:"disabled",message_duplicate:"duplicate",message_refused:"refused",message_consent_pending:"consent_pending",message_consent_recently_requested:"consent_recent",message_consent_unavailable:"consent_unavailable"}[e.code]??(e.status>=500&&e.status!==503?"uncertain":"unknown");e.code==="message_rate_limited"&&t.scope==="person"?a="person_limit":e.code==="message_rate_limited"&&t.scope==="station"?a="station_limit":e.code==="message_outside_hours"?a="outside_hours":e.code==="message_bulk_too_many"&&(a="rate");const o={ok:!1,reason:a};return n!==void 0&&(o.retry_after_s=n),a==="rate"&&(o.transient=t.scope==="burst"||e.code==="intercom_rate_limited"||e.code==="intercom_busy"),typeof t.templates_revision=="number"&&(o.templates_revision=t.templates_revision),o}function ge(){return{async config(){const e=await g("access-control/messaging");if(!e.messaging)throw new Error("messaging_unavailable");return e.messaging},async recipients(e){return(await x("access-control/messaging/recipients",{person_ids:e})).recipients},async send(e,t,n){const s={client_request_id:$(),confirmed:!0};t.template_id!==null?(s.template_id=t.template_id,s.templates_revision=n.templates_revision):s.text=t.text,n.bulk&&(s.bulk_id=n.bulk.id,s.bulk_total=n.bulk.total);try{const a=await x(`access-control/people/${encodeURIComponent(e)}/messages`,s),o=a.message.outcome==="held"||a.message.outcome==="consent_requested"?a.message.outcome:void 0;return{ok:!0,sent_at:a.message.sent_at??"",quota:a.quota??null,...o?{held:o}:{}}}catch(a){return se(a)}},async history(e){const t=await g(`access-control/people/${encodeURIComponent(e)}/messages`);return{messages:t.messages,opt_out:t.opt_out,consent:t.consent,can_clear_opt_out:t.can_clear_opt_out}},async setOptOut(e,t){return S(`access-control/people/${encodeURIComponent(e)}/messages/optout`,{opted_out:t})}}}const be=()=>g("access-control/messaging/settings"),he=e=>S("access-control/messaging/settings",{base_revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:e.bulk_max,rate_per_hour:e.rate_per_hour,per_sender_per_hour:e.per_sender_per_hour,per_person_per_day:e.per_person_per_day,per_station_per_hour:e.per_station_per_hour,send_hours:e.send_hours,organization:e.organization,account:e.account,templates:e.templates.map(t=>({...t.id?{id:t.id}:{},label:t.label,body:t.body})),...e.consent_by_link===void 0?{}:{consent_by_link:e.consent_by_link,consent_wait_days:e.consent_wait_days,consent_language:e.consent_language,consent_wa_template:e.consent_wa_template,consent_wa_language:e.consent_wa_language}});function we(e){return!(e instanceof k)||e.code!=="message_settings_invalid"?null:T(e).map(t=>({path:t.field,code:t.code}))}const ke=e=>e instanceof k&&e.code==="message_settings_conflict";export{he as a,we as b,q as c,de as d,ue as e,pe as f,be as g,b as h,ke as i,fe as j,ge as k,Q as l,me as n,_e as o,re as p,ce as r,ie as s,le as u};
