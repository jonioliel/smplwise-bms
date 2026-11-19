import{a2 as Z,br as L,b5 as N,bG as T,bH as X,cE as Y,cC as Q,cx as be,aV as we,g as ee,ax as Ae,j as h,i as se,n as S,d as ve,A as o,a6 as R,b as r,bd as j,k as te,bW as Me,bm as V,eR as Re,a as D,aL as We,aI as Ie,dF as F,aU as Pe}from"./index-rXjlW4bK.js";import{s as ae}from"./settings-x5Mc4jJH.js";import"./sw-logo-art-PLtEZJxU.js";const Le=["conservative","standard","off"],J=["alert","code","ticket","reminder"],re="messaging/whatsapp/pacing",Ne={view:()=>N(re),save:e=>L(re,e)};function le(){return{mode:"conservative",wiskey_shared:!0,max_wait_min:{alert:60,code:5,ticket:360,reminder:720},budget:{per_minute:10,burst:5,burst_window_s:10},per_minute:null,burst:null,shared_budget_guaranteed:!1,share_pct:{alert:100,code:95,ticket:80,reminder:60},can_manage:!0,applies:!0,accounts:[{account_key:"entry:01JDEMOOFFICE",wiskey:{mapped:!0,verified:!1,unknown:!0,charged:null,throttled_until:null,leases_active:0},sends_1h:7,sends_24h:41,wiskey_1h:2,wiskey_24h:9,waiting:3,waiting_by_class:{ticket:1,reminder:2},oldest_wait_s:540,counters_24h:{sent:41,deferred:12,backoff:1,pair_backoff:0,expired:0},backoff:null,pairs_in_backoff:0}]}}let v=null;const je={async view(){return v??=le(),structuredClone(v)},async save(e){v??=le(),e.mode&&(v.mode=e.mode),e.wiskey_shared!==void 0&&(v.wiskey_shared=e.wiskey_shared),e.max_wait_min&&(v.max_wait_min={...v.max_wait_min,...e.max_wait_min}),e.per_minute!==void 0&&(v.per_minute=e.per_minute),e.burst!==void 0&&(v.burst=e.burst),v.applies=v.mode!=="off";const s=v.mode==="standard"?{per_minute:20,burst:8}:{per_minute:10,burst:5};return v.budget=v.mode==="off"?null:{per_minute:v.per_minute??s.per_minute,burst:v.burst??s.burst,burst_window_s:10},structuredClone(v)}};function oe(){return Z()?Ne:je}const ne={title:"קצב שליחה משותף",mode:"מצב",mode_conservative:"שמרני",mode_standard:"רגיל",mode_off:"כבוי",wiskey:"WisKey שולח מאותו מספר",inactive:"לא פעיל",limits:"המתנה מרבית בדקות",perMinute:"הודעות בדקה",burstLbl:"פרץ ב-10 שניות",wiskeyUnknown:"מוני WisKey לא ידועים",reason_unread:"לא נקרא עדיין מ-WisKey",reason_stale:"הקריאה האחרונה מ-WisKey ישנה",reason_unsupported:"גרסת WisKey הזו אינה מדווחת את מוני השליחה",reason_error:"הקריאה מ-WisKey נכשלה",reason_invalid:"התשובה מ-WisKey לא שמישה",reason_truncated:"WisKey שלח רק חלק מהשולחים שלו",reason_absent:"WisKey לא כלל את השולח הזה",reason_unverified:"השולח לא הותאם בוודאות לשולח של WisKey",reason_incomplete:"מוני WisKey לשולח הזה חלקיים",reason_unreserved:"הודעות ש-WisKey שלח בלי להזמין מקום אינן ידועות",reason_other:"מוני WisKey אינם ידועים",err_minute:"ערך בין 1 ל-120",err_burst:"ערך בין 1 ל-60",cls_alert:"התראות",cls_code:"קודי אימות",cls_ticket:"הודעות",cls_reminder:"תזכורות",budget:"{n} בדקה · פרץ {b}",sentHour:"נשלחו בשעה האחרונה",wiskeyHour:"מהן WisKey",waiting:"ממתינות",oldest:"ההמתנה הארוכה ביותר",deferred:"נדחו ב-24 שעות",slowed:"האטות מהפלטפורמה",expired:"הסתיימו בלי שליחה",backoffUntil:"מואט עד {time}",pairs:"נמענים מואטים: {n}",noAccounts:"אין חשבונות",unit_s:"{n} שנ׳",unit_m:"{n} דק׳",unit_h:"{n} שע׳",saved:"נשמר",retry:"נסו שוב",err_range:"ערך בין 1 ל-2880",loadError:"לא ניתן לטעון את הקצב"},_e=T("en","i18n/messaging-pacing","en"),$e=T("ar","i18n/messaging-pacing","ar"),ye=T("ru","i18n/messaging-pacing","ru"),Fe={he:ne,en:_e,ar:$e,ru:ye},Ke=["ar","ru"];function Ue(){return Q(["en","ar","ru"])}function u(e,s,t=Ue()){const a=Fe[t][e]??ne[e]??e;return Y(a,s)}X("i18n/messaging-pacing",{he:ne,en:_e,ar:$e,ru:ye},Ke);const de=[1,2880];function qe(e){const s=Math.max(0,Math.round(e));return s<90?{n:s,u:"s"}:s<5400?{n:Math.round(s/60),u:"m"}:{n:Math.round(s/3600),u:"h"}}function Ve(e,s,t){if(!/^\d{1,4}$/.test(e.trim()))return null;const a=Number(e);return a>=s&&a<=t?a:null}const Je=[1,120],Ge=[1,60];function He(e){if(!/^\d{1,4}$/.test(e.trim()))return null;const s=Number(e);return s>=de[0]&&s<=de[1]?s:null}function Be(e,s){const t={};for(const a of J)s[a]!==void 0&&s[a]!==e.max_wait_min[a]&&(t[a]=s[a]);return t}function Ze(e){return e.backoff!==null||e.pairs_in_backoff>0||e.counters_24h.backoff+e.counters_24h.pair_backoff>0}function Xe(e){return e.counters_24h.expired>0?"bad":Ze(e)?"warn":"ok"}const Ye={not_read:"reason_unread",discovery_unknown:"reason_unread",stale:"reason_stale",api_incompatible:"reason_unsupported",pacing_route_not_listed:"reason_unsupported",schema_version_missing:"reason_unsupported",schema_version_misplaced:"reason_unsupported",schema_version_unsupported:"reason_unsupported",route_error:"reason_error",envelope_invalid:"reason_invalid",coverage_inconsistent:"reason_invalid",truncated:"reason_truncated",sender_absent:"reason_absent",unverified:"reason_unverified",counters_incomplete:"reason_incomplete",unreserved_unknown:"reason_unreserved"};function ce(e){const s=e.wiskey;return!s.unknown&&s.coverage!=="not_covered"?null:s.reason&&Ye[s.reason]||"reason_other"}var Qe=Object.defineProperty,es=Object.getOwnPropertyDescriptor,E=(e,s,t,a)=>{for(var i=a>1?void 0:a?es(s,t):s,l=e.length-1,d;l>=0;l--)(d=e[l])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&Qe(s,t,i),i};let x=class extends se{constructor(){super(...arguments),this.labels={},this.view=null,this.state="loading",this.error="",this.ok="",this.busy=!1,this.edited={},this.okTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.okTimer),super.disconnectedCallback()}async load(){try{this.view=await oe().view(),this.state="ready",this.edited={}}catch(e){this.error=S(e),this.state="error"}}get editable(){return!!this.view?.can_manage}async save(e){if(!(this.busy||!this.editable)){this.busy=!0,this.error="";try{this.view=await oe().save(e),this.edited={},this.ok=u("saved"),window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",2500)}catch(s){this.error=S(s)}finally{this.busy=!1}}}commitWaits(){if(!this.view)return;const e={};for(const t of J){const a=this.edited[t];if(a===void 0)continue;const i=He(a);if(i===null){this.error=u("err_range");return}e[t]=i}const s=Be(this.view,e);Object.keys(s).length?this.save({max_wait_min:s}):this.edited={}}commitRate(e,s){const t=e==="per_minute"?Je:Ge,a=Ve(s,t[0],t[1]);if(a===null){this.error=u(e==="per_minute"?"err_minute":"err_burst");return}this.save({[e]:a})}duration(e){const s=qe(e);return u(`unit_${s.u}`,{n:s.n})}accountRow(e){const s=e.counters_24h,t=Xe(e),a=e.backoff?ve(new Date(e.backoff.until)):"";return r`<div class="acct" data-pacing-account=${e.account_key} data-tone=${t}>
      <div class="head"><strong>${R(this.labels[e.account_key]??e.account_key)}</strong>
        ${e.backoff?r`<span class="tag warn" data-backoff><sw-icon name="warning" size="14"></sw-icon>${u("backoffUntil",{time:a})}</span>`:o}
        ${e.wiskey.unknown?r`<span class="tag" data-wiskey-unknown>${u("wiskeyUnknown")}</span>`:o}
        ${ce(e)?r`<span class="tag" data-wiskey-reason=${e.wiskey.reason??""}>${u(ce(e))}</span>`:o}
        ${e.pairs_in_backoff?r`<span class="tag warn" data-pairs>${u("pairs",{n:e.pairs_in_backoff})}</span>`:o}
        ${s.expired?r`<span class="tag bad" data-expired>${u("expired")}: ${s.expired}</span>`:o}</div>
      <div class="kv">
        <div data-k="sent"><span>${u("sentHour")}</span><b>${e.sends_1h}</b></div>
        <div data-k="wiskey"><span>${u("wiskeyHour")}</span><b>${e.wiskey_1h}</b></div>
        <div data-k="waiting"><span>${u("waiting")}</span><b>${e.waiting}</b></div>
        <div data-k="oldest"><span>${u("oldest")}</span><b>${e.oldest_wait_s===null?"–":this.duration(e.oldest_wait_s)}</b></div>
        <div data-k="deferred"><span>${u("deferred")}</span><b>${s.deferred}</b></div>
        <div data-k="slowed"><span>${u("slowed")}</span><b>${s.backoff+s.pair_backoff}</b></div>
      </div>
    </div>`}render(){if(this.state==="loading")return o;if(this.state==="error"||!this.view)return r`<sw-card data-card="pacing" data-state="error"><div class="msg err" role="alert">${u("loadError")}: ${this.error}
        <sw-button size="sm" variant="ghost" @click=${()=>void this.load()}>${u("retry")}</sw-button></div></sw-card>`;const e=this.view;return r`<sw-card data-card="pacing" data-state="ready" data-mode=${e.mode}>
      <div class="head"><strong>${u("title")}</strong>
        ${e.budget?r`<span class="tag ltr" data-budget>${u("budget",{n:e.budget.per_minute,b:e.budget.burst})}</span>`:o}
        ${e.applies?o:r`<span class="tag" data-inactive>${u("inactive")}</span>`}
        <span class="grow"></span></div>
      ${this.error?r`<div class="msg err" role="alert" data-error>${this.error}</div>`:o}
      ${this.ok?r`<div class="msg ok" role="status" data-ok>${this.ok}</div>`:o}
      <div class="row"><span class="lbl">${u("mode")}</span>
        <span class="ctl"><select class="in" data-pacing-mode aria-label=${u("mode")} ?disabled=${!this.editable||this.busy}
          @change=${s=>void this.save({mode:s.target.value})}>
          ${Le.map(s=>r`<option value=${s} ?selected=${s===e.mode}>${u(`mode_${s}`)}</option>`)}
        </select></span></div>
      <div class="row"><span class="lbl">${u("wiskey")}</span>
        <sw-toggle label=${u("wiskey")} labelHidden data-pacing-wiskey .checked=${e.wiskey_shared} ?disabled=${!this.editable||this.busy}
          @change=${s=>void this.save({wiskey_shared:s.detail.checked})}></sw-toggle></div>
      <div class="row stack"><span class="lbl">${u("perMinute")} / ${u("burstLbl")}</span>
        <div class="waits" data-pacing-rate>
          <label>${u("perMinute")}<input class="in" inputmode="numeric" data-rate="per_minute" .value=${String(e.budget?.per_minute??"")} ?disabled=${!this.editable||this.busy||!e.budget}
            @change=${s=>this.commitRate("per_minute",s.target.value)}></label>
          <label>${u("burstLbl")}<input class="in" inputmode="numeric" data-rate="burst" .value=${String(e.budget?.burst??"")} ?disabled=${!this.editable||this.busy||!e.budget}
            @change=${s=>this.commitRate("burst",s.target.value)}></label></div></div>
      <div class="row stack"><span class="lbl">${u("limits")}</span>
        <div class="waits" data-pacing-limits>${J.map(s=>r`<label>${u(`cls_${s}`)}
          <input class="in" inputmode="numeric" data-wait=${s} .value=${this.edited[s]??String(e.max_wait_min[s])} ?disabled=${!this.editable||this.busy}
            @input=${t=>this.edited={...this.edited,[s]:t.target.value}} @change=${()=>this.commitWaits()}></label>`)}</div></div>
      <div data-pacing-accounts>${e.accounts.length?j(e.accounts,s=>s.account_key,s=>this.accountRow(s)):r`<p class="muted" data-no-accounts>${u("noAccounts")}</p>`}</div>
    </sw-card>`}};x.styles=[ae,ee`
    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .tag.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .tag.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .tag.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block-end: var(--sw-s-2); }
    .grow { flex: 1; }
    .waits { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sw-s-2); inline-size: 100%; }
    .waits label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .waits input { inline-size: 100%; min-inline-size: 0; box-sizing: border-box; }
    .waits label { min-inline-size: 0; }
    ${be}
    .head strong { min-inline-size: 0; overflow-wrap: anywhere; }
    .acct { min-inline-size: 0; border-block-start: 1px solid var(--sw-border); padding-block: var(--sw-s-2); }
    .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px var(--sw-s-3); margin-block-start: 6px; }
    .kv div { display: flex; justify-content: space-between; gap: 8px; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    .kv span, .kv b { min-inline-size: 0; overflow-wrap: anywhere; }
    .kv b { font-variant-numeric: tabular-nums; }
    ${we}
  `];E([Ae({attribute:!1})],x.prototype,"labels",2);E([h()],x.prototype,"view",2);E([h()],x.prototype,"state",2);E([h()],x.prototype,"error",2);E([h()],x.prototype,"ok",2);E([h()],x.prototype,"busy",2);E([h()],x.prototype,"edited",2);x=E([te("messaging-pacing-card")],x);const ss=["handler","provider","other"],z="messaging/whatsapp/policy",ts={view:()=>N(z),setEnforce:e=>L(z,{enforce:e}),add:e=>V(`${z}/allow`,e),remove:async e=>(await Me(`${z}/allow/${encodeURIComponent(e)}`),N(z)),selfWindow:e=>L(`${z}/self-messages`,{minutes:e})};function A(){return{enforce:!1,can_manage:!0,max_entries:500,allow:[{id:"demo00000001",label:"דנה כהן",role:"handler",last4:"0191"},{id:"demo00000002",label:'מעליות בע"מ',role:"provider",last4:"0192"}],self_messages:{active:!1,until:null,minutes_default:30,minutes_range:[1,240]}}}let g=null,as=3;const ns={async view(){return g??=A(),g.self_messages.until&&Date.parse(g.self_messages.until)<=Date.now()&&(g.self_messages={...g.self_messages,active:!1,until:null}),structuredClone(g)},async setEnforce(e){return g??=A(),g.enforce=e,structuredClone(g)},async add(e){g??=A();const s=e.phone.replace(/[\s\-().+]/g,"");if(!/^\d{8,15}$/.test(s)||!e.label.trim())throw new Error("validation");return g.allow=[...g.allow,{id:`demo${String(as++).padStart(8,"0")}`,label:e.label.trim(),role:e.role,last4:s.slice(-4)}],structuredClone(g)},async remove(e){return g??=A(),g.allow=g.allow.filter(s=>s.id!==e),structuredClone(g)},async selfWindow(e){return g??=A(),g.self_messages={...g.self_messages,active:e!==null,until:e===null?null:new Date(Date.now()+e*6e4).toISOString()},structuredClone(g)}};function C(){return Z()?ts:ns}const ie={title:"מדיניות שליחה בוואטסאפ",allowTitle:"רשימת מותרים: מטפלים וספקים",enforce:"לשלוח רק לרשימה",enforceOff:"כבוי: כל נמען יקבל הודעה",blocksAll:"האכיפה פעילה והרשימה ריקה: שום הודעה לא תישלח",phone:"מספר (עם קידומת מדינה)",label:"שם",role:"תפקיד",role_handler:"מטפל",role_provider:"ספק",role_other:"אחר",add:"הוספה",remove:"הסרה",empty:"הרשימה ריקה",page:"עמוד {n} מתוך {m}",prev:"הקודם",next:"הבא",selfTitle:"הודעות לעצמי לבדיקה",selfMinutes:"דקות",selfStart:"הפעלה",selfStop:"כיבוי",selfActive:"פעיל עד {time}",selfOff:"כבוי",saved:"נשמר",loadError:"טעינת המדיניות נכשלה",retry:"נסו שוב",err_phone:"מספר לא תקין",err_label:"יש להזין שם",err_minutes:"ערך בין {lo} ל-{hi}",err_listed:"המספר כבר ברשימה",readOnly:"צפייה בלבד"},ke=T("en","i18n/messaging-policy","en"),xe=T("ar","i18n/messaging-policy","ar"),Oe=T("ru","i18n/messaging-policy","ru"),is={he:ie,en:ke,ar:xe,ru:Oe},rs=["ar","ru"];function ls(){return Q(["en","ar","ru"])}function p(e,s,t=ls()){const a=is[t][e]??ie[e]??e;return Y(a,s)}X("i18n/messaging-policy",{he:ie,en:ke,ar:xe,ru:Oe},rs);const G=5;function os(e){const s=e.trim().replace(/^\+/,"").replace(/[\s\-().]/g,"");return/^\d{8,15}$/.test(s)?s:null}function ds(e,s){if(!/^\d{1,3}$/.test(e.trim()))return null;const t=Number(e);return t>=s[0]&&t<=s[1]?t:null}function cs(e){return Math.max(1,Math.ceil(e/G))}function us(e,s){const t=cs(e.length),a=Math.min(Math.max(0,s),t-1);return{items:e.slice(a*G,(a+1)*G),page:a,pages:t}}function ps(e,s){return e&&s===0}var hs=Object.defineProperty,ms=Object.getOwnPropertyDescriptor,k=(e,s,t,a)=>{for(var i=a>1?void 0:a?ms(s,t):s,l=e.length-1,d;l>=0;l--)(d=e[l])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&hs(s,t,i),i};let y=class extends se{constructor(){super(...arguments),this.view=null,this.state="loading",this.error="",this.ok="",this.busy=!1,this.page=0,this.phone="",this.label="",this.newRole="handler",this.minutes="30",this.okTimer=0,this.poll=new Re(this)}connectedCallback(){super.connectedCallback(),this.load(),this.poll.every("window",3e4,()=>this.refreshWindow(),{when:()=>!!this.view?.self_messages.active})}disconnectedCallback(){window.clearTimeout(this.okTimer),super.disconnectedCallback()}async load(){try{this.view=await C().view(),this.state="ready"}catch(e){this.error=S(e),this.state="error"}}async refreshWindow(){try{this.view=await C().view()}catch{}}get editable(){return!!this.view?.can_manage}async run(e,s){if(!(this.busy||!this.editable)){this.busy=!0,this.error="";try{this.view=await e(),s?.(),this.ok=p("saved"),window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",2500)}catch(t){this.error=t instanceof D&&t.status===422&&JSON.stringify(t.body.details??{}).includes("already_listed")?p("err_listed"):S(t)}finally{this.busy=!1}}}add(){if(os(this.phone)===null){this.error=p("err_phone");return}if(!this.label.trim()){this.error=p("err_label");return}const e={phone:this.phone.trim(),label:this.label.trim(),role:this.newRole};this.run(()=>C().add(e),()=>{this.phone="",this.label="",this.page=Number.MAX_SAFE_INTEGER})}startWindow(){const e=this.view?.self_messages.minutes_range??[1,240],s=ds(this.minutes,e);if(s===null){this.error=p("err_minutes",{lo:e[0],hi:e[1]});return}this.run(()=>C().selfWindow(s))}render(){if(this.state==="loading")return o;if(this.state==="error"||!this.view)return r`<sw-card data-card="policy" data-state="error"><div class="msg err" role="alert">${p("loadError")}: ${this.error}
        <sw-button size="sm" variant="ghost" @click=${()=>void this.load()}>${p("retry")}</sw-button></div></sw-card>`;const e=this.view,s=us(e.allow,this.page),t=!this.editable||this.busy;return r`<sw-card data-card="policy" data-state="ready">
      <div class="head"><strong>${p("title")}</strong>
        ${this.editable?o:r`<span class="tag" data-read-only>${p("readOnly")}</span>`}</div>
      ${this.error?r`<div class="msg err" role="alert" data-error>${this.error}</div>`:o}
      ${this.ok?r`<div class="msg ok" role="status" data-ok>${this.ok}</div>`:o}
      <div class="row"><span class="lbl">${p("allowTitle")}</span></div>
      <div class="row"><span class="lbl">${p("enforce")}</span>
        <sw-toggle label=${p("enforce")} labelHidden data-policy-enforce .checked=${e.enforce} ?disabled=${t}
          @change=${a=>void this.run(()=>C().setEnforce(a.detail.checked))}></sw-toggle>
        ${e.enforce?o:r`<span class="tag" data-enforce-off>${p("enforceOff")}</span>`}</div>
      ${ps(e.enforce,e.allow.length)?r`<div class="msg err" role="status" data-blocks-all>${p("blocksAll")}</div>`:o}
      <div data-policy-list>
        ${e.allow.length?j(s.items,a=>a.id,a=>r`<div class="entry" data-entry=${a.id}>
          <span class="name">${R(a.label)}</span>
          <span class="tag" data-role=${a.role}>${p(`role_${a.role}`)}</span>
          <span class="tag ltr">${a.last4?`…${a.last4}`:"–"}</span>
          ${this.editable?r`<sw-button size="sm" variant="ghost" data-remove ?disabled=${this.busy}
            @click=${()=>void this.run(()=>C().remove(a.id))}>${p("remove")}</sw-button>`:o}</div>`):r`<p class="muted" data-empty>${p("empty")}</p>`}
        ${s.pages>1?r`<div class="pager" data-pager>
          <sw-button size="sm" variant="ghost" data-prev ?disabled=${s.page===0} @click=${()=>this.page=s.page-1}>${p("prev")}</sw-button>
          <span>${p("page",{n:s.page+1,m:s.pages})}</span>
          <sw-button size="sm" variant="ghost" data-next ?disabled=${s.page>=s.pages-1} @click=${()=>this.page=s.page+1}>${p("next")}</sw-button></div>`:o}
      </div>
      ${this.editable?r`<div class="grid" data-policy-add>
        <label>${p("phone")}<input class="in ltr" inputmode="tel" data-add="phone" .value=${this.phone} ?disabled=${this.busy}
          @input=${a=>this.phone=a.target.value}></label>
        <label>${p("label")}<input class="in" maxlength="80" data-add="label" .value=${this.label} ?disabled=${this.busy}
          @input=${a=>this.label=a.target.value}></label>
        <label>${p("role")}<select class="in" data-add="role" ?disabled=${this.busy} @change=${a=>this.newRole=a.target.value}>
          ${ss.map(a=>r`<option value=${a} ?selected=${a===this.newRole}>${p(`role_${a}`)}</option>`)}</select></label>
        <sw-button size="sm" variant="primary" data-add-button ?disabled=${this.busy} @click=${()=>this.add()}>${p("add")}</sw-button></div>`:o}
      <div class="sect" data-policy-self>
        <div class="head"><strong>${p("selfTitle")}</strong>
          ${e.self_messages.active?r`<span class="tag warn" data-self-on>${p("selfActive",{time:e.self_messages.until?ve(new Date(e.self_messages.until)):""})}</span>`:r`<span class="tag" data-self-off>${p("selfOff")}</span>`}</div>
        ${this.editable?r`<div class="grid">
          <label>${p("selfMinutes")}<input class="in" inputmode="numeric" data-self-minutes .value=${this.minutes} ?disabled=${this.busy}
            @input=${a=>this.minutes=a.target.value}></label>
          <sw-button size="sm" variant="primary" data-self-start ?disabled=${this.busy} @click=${()=>this.startWindow()}>${p("selfStart")}</sw-button>
          <sw-button size="sm" variant="ghost" data-self-stop ?disabled=${this.busy||!e.self_messages.active}
            @click=${()=>void this.run(()=>C().selfWindow(null))}>${p("selfStop")}</sw-button></div>`:o}
      </div>
    </sw-card>`}};y.styles=[ae,ee`
    ${be}
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block-end: var(--sw-s-2); }
    .head strong { min-inline-size: 0; overflow-wrap: anywhere; }
    .tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .tag.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .tag.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--sw-s-2); align-items: end; inline-size: 100%; }
    .grid label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); min-inline-size: 0; }
    .grid .in { inline-size: 100%; min-inline-size: 0; box-sizing: border-box; }
    .entry { display: flex; align-items: center; gap: var(--sw-s-2); min-inline-size: 0; padding-block: 6px; border-block-start: 1px solid var(--sw-border); }
    .entry .name { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
    ${we}
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-block-start: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .sect { border-block-start: 1px solid var(--sw-border); margin-block-start: var(--sw-s-2); padding-block-start: var(--sw-s-2); }
  `];k([h()],y.prototype,"view",2);k([h()],y.prototype,"state",2);k([h()],y.prototype,"error",2);k([h()],y.prototype,"ok",2);k([h()],y.prototype,"busy",2);k([h()],y.prototype,"page",2);k([h()],y.prototype,"phone",2);k([h()],y.prototype,"label",2);k([h()],y.prototype,"newRole",2);k([h()],y.prototype,"minutes",2);y=k([te("messaging-policy-card")],y);const I="messaging/whatsapp",fs={view:()=>N(I),save:e=>L(I,e),refresh:()=>V(`${I}/refresh`),test:(e,s)=>V(`${I}/test`,{account_key:e,target:s})},M={min_gap_s:5,jitter_s:1,per_hour:100,per_day:600,per_recipient_hour:4,hold_when_down_min:15},gs={min_gap_s:[5,600],jitter_s:[0,300],per_hour:[1,2e3],per_day:[1,1e4],per_recipient_hour:[1,30],hold_when_down_min:[1,240]};function K(){return{revision:3,can_manage:!0,ws_connected:!0,accounts:[{key:"entry:01JDEMOOFFICE",kind:"discovered",label:"משרד הניהול",label_set:!0,last4:"0099",state:"connected",state_source:"entity",in_mirror:!0,stored:!0,shared_outside:!1,removed:!1,pacing:{...M},uses:["tickets.codes","tickets.messages"],sends_24h:12,last_send_at:"2026-10-13T09:58:00Z",has_status_entity:!0},{key:"entry:01JDEMOINTERC",kind:"discovered",label:"אינטרקום",label_set:!0,last4:"0098",state:"connected",state_source:"entity",in_mirror:!0,stored:!0,shared_outside:!0,removed:!1,pacing:{...M},uses:["tickets.messages@dept:dept-cleaning"],sends_24h:41,last_send_at:"2026-10-13T10:31:00Z",has_status_entity:!0},{key:"manual:demo01",kind:"manual",label:"מספר ישן",label_set:!0,last4:"0097",state:"disconnected",state_source:"status_entity",in_mirror:!1,stored:!0,shared_outside:!1,removed:!1,pacing:{...M},uses:[],sends_24h:0,last_send_at:null,has_status_entity:!0,account:"15555550097",status_entity_id:"binary_sensor.old_phone_online",connected_states:["on"]}],uses:[{key:"tickets.messages",module:"tickets",label:"הודעות בקשות שירות",inherits:null,inherits_label:null,per_department:!0,required:!0,value:"entry:01JDEMOOFFICE",resolved:"entry:01JDEMOOFFICE",queued:2,departments:[{id:"dept-maintenance",name:"אחזקה",value:null,resolved:"entry:01JDEMOOFFICE"},{id:"dept-cleaning",name:"ניקיון",value:"entry:01JDEMOINTERC",resolved:"entry:01JDEMOINTERC"}]},{key:"tickets.codes",module:"tickets",label:"קודי אימות לבקשות שירות",inherits:"tickets.messages",inherits_label:"הודעות בקשות שירות",per_department:!1,required:!1,value:null,resolved:"entry:01JDEMOOFFICE",queued:0}],mapping:{"tickets.messages":"entry:01JDEMOOFFICE","tickets.codes":null,"tickets.messages@dept:dept-cleaning":"entry:01JDEMOINTERC"},warnings:[{code:"shared_outside",use:"tickets.messages",department_id:"dept-cleaning",account_key:"entry:01JDEMOINTERC",severity:"amber"}],channels:[{key:"whatsapp",state:"active"},{key:"email",state:"active"},{key:"inapp",state:"active"},{key:"sms",state:"soon"}],modules:{tickets:"ניהול השירות"},pacing_ranges:gs,pacing_default:{...M},test_send:{enabled:!0}}}let $=null;const bs={async view(){return $??=K(),structuredClone($)},async save(e){if($??=K(),e.revision!==$.revision)throw new D(409,{code:"settings_stale",user_message:"ההגדרות השתנו בינתיים. טענו מחדש.",retryable:!1,correlation_id:"demo",details:{}});const s=new Map($.accounts.map(t=>[t.key,t]));$.accounts=e.accounts.map(t=>{const a=s.get(t.key);return{...a??{state:"unknown",state_source:"sends",in_mirror:!1,uses:[],sends_24h:0,last_send_at:null,has_status_entity:!!t.status_entity_id,last4:null,removed:!1},key:t.key,kind:t.kind,label:t.label||a?.label||"וואטסאפ (ידני)",label_set:!!t.label,stored:!0,shared_outside:t.shared_outside,pacing:{...M,...t.pacing??{}},...t.kind==="manual"?{account:t.account??null,status_entity_id:t.status_entity_id??null,last4:(t.account??"").replace(/\D/g,"").slice(-4)||null}:{}}}),$.mapping={...e.uses};for(const t of $.uses){t.value=e.uses[t.key]??null,t.resolved=t.value??(t.inherits?e.uses[t.inherits]??null:null);for(const a of t.departments??[])a.value=e.uses[`${t.key}@dept:${a.id}`]??null,a.resolved=a.value??t.resolved}for(const t of $.accounts)t.uses=Object.entries(e.uses).filter(([,a])=>a===t.key).map(([a])=>a);return $.revision+=1,structuredClone($)},async refresh(){return $??=K(),structuredClone($)},async test(){return{id:"demo-test",state:"queued"}}};function P(){return Z()?fs:bs}const Se={tab:"ערוץ ההודעות",title:"ערוץ ההודעות",sub:"מאיזה חשבון וואטסאפ נשלחות ההודעות של כל שימוש",keywords:"וואטסאפ חשבון חשבונות מספר שולח ערוץ הודעות קוד אימות שימושים SMS",loading:"טוען…",forbidden:"אין הרשאה לצפות בחשבונות",retry:"נסו שוב",accounts:"חשבונות וואטסאפ",source:"מרכיב הוואטסאפ של תשתית המערכת",refresh:"רענון",refreshed:"נקרא מחדש",noAccounts:"לא נמצאו חשבונות. אפשר להוסיף חשבון ידני.",wsDown:"אין חיבור לתשתית המערכת - המצבים אינם עדכניים",manualTag:"ידני",notInMirror:"לא נמצא בתשתית",usedBy:"בשימוש: {uses}",unused:"לא בשימוש",sends:"{n} מתוך {cap} ב-24 שעות",lastSend:"שליחה אחרונה {time}",neverSent:"לא נשלחו הודעות",st_connected:"מחובר",st_disconnected:"מנותק",st_unknown:"לא ידוע",st_missing:"לא נמצא",usesTitle:"שימושים",noUses:"אין שימושים פעילים",none:"ללא",same:"כמו {use}",deptDefault:"ברירת המחדל",deptOwn:"חשבון משלה",installDefault:"ברירת המחדל להתקנה",inheritDefault:"ברירת המחדל: אותו חשבון",deptOf:"{dept}",deptsToggle:"מחלקות ({n})",queued:"{n} ממתינות",w_shared_module:"המספר משותף גם ל{module} - קצב שליחה משותף",w_shared_outside:"המספר משמש גם מחוץ למערכת",w_required_unmapped:"לא נבחר חשבון - הודעות לא יישלחו בוואטסאפ",w_maybe_same_number:"ייתכן שזה אותו מספר",w_down_disconnected:"החשבון מנותק",w_down_missing:"החשבון לא נמצא",w_down_unknown:"מצב החשבון לא ידוע",sharedChip:"משותף",manualRow:"הזנה ידנית",manualSub:"כשהחשבון לא נמצא בתשתית",manualAdd:"חשבון ידני",manualTitle:"חשבון ידני",manualValue:"מזהה החשבון",manualValueSub:"מזהה הרשומה או ספרות המספר, כפי שהם בתשתית",manualStatus:"ישות מצב (לא חובה)",labelField:"שם",add:"הוספה",cancel:"ביטול",selected:"החשבון הנבחר",selectHint:"בחרו חשבון מהרשימה",sharedOutside:"משמש גם מחוץ למערכת",sharedOutsideSub:"למשל אינטרקום או טלפון של אדם",pacing:"קצב שליחה",pacingSub:"משותף לכל השימושים של החשבון",pacingSummary:"{hour} בשעה · {day} ביממה · מרווח {gap} שניות",p_min_gap_s:"מרווח מזערי (שניות)",p_jitter_s:"תוספת אקראית (שניות)",p_per_hour:"בשעה",p_per_day:"ביממה",p_per_recipient_hour:"לנמען בשעה",p_hold_when_down_min:"המתנה כשמנותק (דקות)",remove:"הסרה",removeInUse:"החשבון בשימוש - בחרו חשבון אחר לשימושים לפני ההסרה",testTitle:"שליחת בדיקה",testTarget:"מספר לבדיקה",testSend:"שליחה",testOff:"שליחת בדיקה אינה זמינה עד שערוץ ההודעות פועל",testConfirmLine:"תישלח הודעת בדיקה אחת אמיתית בוואטסאפ מהחשבון הזה אל {target}. עד 5 בדיקות בשעה לכל חשבון.",testQueued:"הבדיקה נשלחה לתור",channels:"ערוצים",ch_whatsapp:"וואטסאפ",ch_whatsapp_sub:"הערוץ הראשי לספקים ולאנשי קשר",ch_email:'דוא"ל',ch_email_sub:"גיבוי כשהערוץ מנותק",ch_inapp:"באפליקציה",ch_inapp_sub:"משתמשי המערכת",ch_sms:"SMS",ch_sms_sub:"בקרוב",cs_active:"פעיל",cs_down:"מנותק",cs_not_configured:"לא מוגדר",cs_idle:"לא בשימוש",cs_soon:"בקרוב",save:"שמירה",discard:"ביטול שינויים",dirty:"לא נשמר",saved:"נשמר",readOnly:"צפייה בלבד",confirmTitle:"הודעות ממתינות",confirmLine:"{n} הודעות ממתינות יישלחו מהחשבון החדש",confirmSave:"שמירה",err_manual_equals_discovered:"המזהה הזה הוא של חשבון שכבר נמצא - בחרו אותו מהרשימה",err_manual_value_invalid:"מזהה לא תקין",err_pacing_out_of_range:"ערך מחוץ לטווח",err_pacing_day_below_hour:"המכסה ביממה קטנה מהמכסה בשעה"},Ee=T("en","i18n/messaging-accounts","en");function ws(){return Q(["en"])}function n(e,s){const t=(ws()==="en"?Ee[e]:void 0)??Se[e]??e;return Y(t,s)}X("i18n/messaging-accounts",{he:Se,en:Ee});const H="@dept:",Ce=["min_gap_s","jitter_s","per_hour","per_day","per_recipient_hour","hold_when_down_min"],vs=/^[A-Za-z0-9_\-.:@+]{1,64}$/,U=40;function Te(e){return{accounts:e.accounts.filter(s=>!s.removed).map(s=>({key:s.key,kind:s.kind,label:s.label_set?s.label:"",shared_outside:s.shared_outside,pacing:{...s.pacing},...s.kind==="manual"?{account:s.account??"",status_entity_id:s.status_entity_id??null}:{}})),uses:{...e.mapping}}}const ue=e=>JSON.stringify(Object.entries(e).filter(([,s])=>s).sort(([s],[t])=>s.localeCompare(t)));function pe(e,s){return JSON.stringify(Te(e).accounts)!==JSON.stringify(s.accounts)||ue(e.mapping)!==ue(s.uses)}function _s(e,s,t=!1){const a=s.accounts.map(l=>{const d={key:l.key,kind:l.kind,label:l.label.trim(),shared_outside:l.shared_outside,pacing:{...l.pacing}};return l.kind==="manual"&&(d.account=(l.account??"").trim(),d.status_entity_id=l.status_entity_id?.trim()||null),d}),i={};for(const[l,d]of Object.entries(s.uses))i[l]=d||null;return{revision:e.revision,accounts:a,uses:i,...t?{confirm_queued:!0}:{}}}function $s(e,s=Math.random){const t="abcdefghijklmnopqrstuvwxyz0123456789";for(;;){let a="";for(let l=0;l<8;l++)a+=t[Math.floor(s()*t.length)%t.length];const i=`manual:${a}`;if(!e.accounts.some(l=>l.key===i))return i}}function ys(e,s){const t=e.trim();return vs.test(t)?s.accounts.some(a=>a.kind==="discovered"&&a.key===`entry:${t}`)?"manual_equals_discovered":null:"manual_value_invalid"}function ks(e,s){for(const t of Ce){const[a,i]=e.pacing_ranges[t];if(!Number.isInteger(s[t])||s[t]<a||s[t]>i)return{field:t,code:"pacing_out_of_range"}}return s.per_day<s.per_hour?{field:"per_day",code:"pacing_day_below_hour"}:null}function q(e,s){return Object.entries(e.uses).filter(([,t])=>t===s).map(([t])=>t)}function W(e,s){return s?e.accounts.find(t=>t.key===s):void 0}function B(e,s,t){const a=s.accounts.find(l=>l.key===t);if(a?.label.trim())return a.label.trim();const i=W(e,t);return i&&!i.label_set||i?.kind==="discovered"?i.label:n("manualTag")}function ze(e){return n(`st_${e}`)}function he(e,s,t,a=!1){const i=a?{value:"",label:n("deptDefault")}:t.inherits?{value:"",label:n("same",{use:t.inherits_label??t.inherits})}:{value:"",label:n("none")},l=new Set(s.accounts.map(c=>c.key)),d=[...s.accounts.map(c=>c.key),...e.accounts.filter(c=>!l.has(c.key)&&!c.removed).map(c=>c.key)],f=c=>c.startsWith("entry:")?0:1,O=d.sort((c,b)=>f(c)-f(b)).map(c=>{const b=W(e,c),m=[B(e,s,c)];return b?.last4&&!m[0].includes(b.last4)&&m.push(`····${b.last4}`),b&&b.state!=="connected"&&m.push(ze(b.state)),{value:c,label:m.join(" · ")}});return[i,...O]}function me(e,s,t){return e.warnings.filter(a=>a.use===s&&(a.department_id??null)===t)}function fe(e,s){const t=new Set;return e.warnings.filter(a=>{if(a.account_key!==s||!(a.code==="shared_module"||a.code==="shared_outside"||a.code==="maybe_same_number"))return!1;const i=`${a.code}:${a.module??""}`;return t.has(i)?!1:(t.add(i),!0)})}function ge(e,s){return e.code==="account_down"?n(e.state==="missing"?"w_down_missing":e.state==="unknown"?"w_down_unknown":"w_down_disconnected"):e.code==="shared_module"?n("w_shared_module",{module:s[e.module??""]??e.module??""}):n(`w_${e.code}`)}function xs(e,s){return s.map(t=>{const[a,i]=t.split(H),l=e.uses.find(f=>f.key===a);if(!l)return"";const d=i?l.departments?.find(f=>f.id===i)?.name:"";return d?`${l.label} · ${d}`:l.label}).filter(Boolean).join(", ")}function Os(e){return e==="connected"?"ok":e==="unknown"?"mute":"bad"}var Ss=Object.defineProperty,Es=Object.getOwnPropertyDescriptor,_=(e,s,t,a)=>{for(var i=a>1?void 0:a?Es(s,t):s,l=e.length-1,d;l>=0;l--)(d=e[l])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&Ss(s,t,i),i};let w=class extends se{constructor(){super(...arguments),this.bubbleSkin=new We(this),this.view=null,this.draft=null,this.selected="",this.busy=!1,this.error="",this.ok="",this.loadState="loading",this.manualOpen=!1,this.manual={label:"",value:"",entity:""},this.confirm=null,this.openDepts={},this.pacingOpen=!1,this.testTarget="",this.testConfirm=!1,this.fieldErrors={},this.okTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.okTimer)}say(e){this.ok=e,this.error="",window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",3e3)}take(e){this.view=e,this.draft=Te(e),this.fieldErrors={},(!this.selected||!e.accounts.some(s=>s.key===this.selected))&&(this.selected=e.accounts[0]?.key??""),this.loadState="ready"}async load(){try{this.take(await P().view())}catch(e){this.loadState=e instanceof D&&e.status===403?"forbidden":"error",this.error=this.loadState==="error"?S(e):""}}get editable(){return!!this.view?.can_manage}setAccount(e,s){this.draft&&(this.draft={...this.draft,accounts:this.draft.accounts.map(t=>t.key===e?{...t,...s}:t)})}setUse(e,s){this.draft&&(this.draft={...this.draft,uses:{...this.draft.uses,[e]:s||null}})}ensureDraftAccount(e){if(!this.draft||!this.view||this.draft.accounts.some(t=>t.key===e))return;const s=W(this.view,e);s&&(this.draft={...this.draft,accounts:[...this.draft.accounts,{key:e,kind:s.kind,label:"",shared_outside:!1,pacing:{...s.pacing}}]})}async save(e=!1){if(!(!this.view||!this.draft||this.busy)){for(const s of this.draft.accounts){const t=ks(this.view,s.pacing);if(t){this.selected=s.key,this.pacingOpen=!0,this.fieldErrors={[`pacing.${t.field}`]:n(`err_${t.code}`)};return}}this.busy=!0;try{this.take(await P().save(_s(this.view,this.draft,e))),this.confirm=null,this.say(n("saved"))}catch(s){if(s instanceof D&&s.code==="queued_messages")this.confirm=s.body.details?.moves??[];else if(s instanceof D&&s.code==="validation"){const t=s.body.details?.fields??[];this.fieldErrors=Object.fromEntries(t.map(a=>[a.field,n(`err_${a.code}`)])),this.error=S(s)}else this.error=S(s),s instanceof D&&s.status===409&&this.load()}finally{this.busy=!1}}}async refresh(){if(!this.busy){this.busy=!0;try{const e=this.view&&this.draft&&pe(this.view,this.draft),s=await P().refresh();e?this.view=s:this.take(s),this.say(n("refreshed"))}catch(e){this.error=S(e)}finally{this.busy=!1}}}addManual(){if(!this.view||!this.draft)return;const e=ys(this.manual.value,this.view);if(e){this.fieldErrors={manual:n(`err_${e}`)};return}const s=$s(this.draft),t=this.manual.entity.trim();this.draft={...this.draft,accounts:[...this.draft.accounts,{key:s,kind:"manual",label:this.manual.label.trim().slice(0,U),shared_outside:!1,pacing:{...this.view.pacing_default},account:this.manual.value.trim(),status_entity_id:t||null}]},this.selected=s,this.manualOpen=!1,this.manual={label:"",value:"",entity:""},this.fieldErrors={}}select(e){this.selected=e,this.pacingOpen=!1,typeof window<"u"&&window.innerWidth<1024&&this.updateComplete.then(()=>this.renderRoot.querySelector('[data-card="selected"]')?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}))}removeAccount(e){!this.draft||q(this.draft,e).length||(this.draft={...this.draft,accounts:this.draft.accounts.filter(s=>s.key!==e)},this.selected=this.draft.accounts[0]?.key??"")}async test(){if(!(!this.selected||this.busy)){this.busy=!0;try{await P().test(this.selected,this.testTarget),this.testTarget="",this.say(n("testQueued"))}catch(e){this.error=S(e)}finally{this.busy=!1}}}chip(e){return r`<span class=${`tag ${Os(e)}`} data-state=${e}>${ze(e)}</span>`}warnChips(e){if(!this.view||!e.length)return o;const s=this.view.modules;return r`<div class="warnline">${e.map(t=>r`<span class=${`tag ${t.severity==="red"?"bad":t.severity==="amber"?"warn":"mute"}`} data-warning=${t.code}><sw-icon name="warning" size="14"></sw-icon>${ge(t,s)}</span>`)}</div>`}accountRow(e){const s=this.view,t=this.draft,a=W(s,e),i=a?.state??"unknown",l=q(t,e),d=t.accounts.find(c=>c.key===e)?.pacing.per_day??a?.pacing.per_day??0,f=fe(s,e).some(c=>c.code!=="maybe_same_number")||t.accounts.find(c=>c.key===e)?.shared_outside,O=[l.length?n("usedBy",{uses:xs(s,l)}):n("unused"),n("sends",{n:a?.sends_24h??0,cap:d})].join(" · ");return r`<button type="button" class="acc" aria-pressed=${String(this.selected===e)} data-account=${e} @click=${()=>this.select(e)}>
      <sw-icon name="signal" size="18"></sw-icon>
      <span class="nm"><b>${R(B(s,t,e))}${a?.last4?r` <span class="ltr muted">····${a.last4}</span>`:o}${a?.kind==="manual"||!a?r` <span class="tag mute">${n("manualTag")}</span>`:o}</b>
        <small>${O}</small></span>
      <span class="chips">${f?r`<span class="tag warn" data-shared><sw-icon name="warning" size="14"></sw-icon>${n("sharedChip")}</span>`:o}${this.chip(i)}</span>
    </button>`}useRow(e){const s=this.view,t=this.draft,a=t.uses[e.key]??"",i=e.inherits?n("inheritDefault"):n("installDefault"),l=e.departments??[],d=this.openDepts[e.key]??l.some(f=>!!t.uses[`${e.key}${H}${f.id}`]);return r`<div class="usegroup" data-use=${e.key}>
      <div class="row"><span class="lbl">${e.label}<span class="muted">${i}${e.queued?` · ${n("queued",{n:e.queued})}`:""}</span>${this.warnChips(me(s,e.key,null))}</span>
        <span class="ctl"><select class="in" data-use-pick=${e.key} aria-label=${e.label} ?disabled=${!this.editable||this.busy} @change=${f=>this.setUse(e.key,f.target.value)}>
          ${he(s,t,e).map(f=>r`<option value=${f.value} ?selected=${f.value===a}>${f.label}</option>`)}
        </select></span></div>
      ${e.per_department&&l.length?r`
        <button type="button" class="linkbtn depts" aria-expanded=${String(d)} data-depts-toggle=${e.key} @click=${()=>this.openDepts={...this.openDepts,[e.key]:!d}}><sw-icon name="chevronDown" size="14"></sw-icon>${n("deptsToggle",{n:l.length})}</button>
        ${d?l.map(f=>{const O=`${e.key}${H}${f.id}`,c=t.uses[O]??"";return r`<div class="row dept" data-dept-row=${f.id}><span class="lbl">${R(f.name)}<span class="muted">${n(c?"deptOwn":"deptDefault")}</span>${this.warnChips(me(s,e.key,f.id))}</span>
            <span class="ctl"><select class="in" data-dept-pick=${O} aria-label=${f.name} ?disabled=${!this.editable||this.busy} @change=${b=>this.setUse(O,b.target.value)}>
              ${he(s,t,e,!0).map(b=>r`<option value=${b.value} ?selected=${b.value===c}>${b.label}</option>`)}
            </select></span></div>`}):o}`:o}
    </div>`}accountsCard(){const e=this.view,s=this.draft,t=[...s.accounts.map(i=>i.key),...e.accounts.filter(i=>!i.removed&&!s.accounts.some(l=>l.key===i.key)).map(i=>i.key)],a=e.warnings.filter(i=>i.code==="required_unmapped");return r`<sw-card data-card="accounts">
      <div class="head"><h3 class="sr">${n("accounts")}</h3><strong>${n("accounts")}</strong><span class="tag">${n("source")}</span><span class="grow"></span>
        ${this.editable?r`<sw-button size="sm" icon="refresh" data-refresh ?disabled=${this.busy} @click=${()=>void this.refresh()}>${n("refresh")}</sw-button>`:o}</div>
      ${e.ws_connected?o:r`<div class="msg warn" data-ws-down><sw-icon name="offline" size="16"></sw-icon>${n("wsDown")}</div>`}
      ${a.length?r`<div class="msg err" data-required-unmapped><sw-icon name="warning" size="16"></sw-icon>${ge(a[0],e.modules)}</div>`:o}
      <div data-accounts>${t.length?j(t,i=>i,i=>this.accountRow(i)):r`<p class="muted" data-no-accounts>${n("noAccounts")}</p>`}</div>
      ${e.uses.length?j(e.uses,i=>i.key,i=>this.useRow(i)):r`<div class="usegroup"><span class="muted" data-no-uses>${n("noUses")}</span></div>`}
      <div class="usegroup"><div class="row"><span class="lbl">${n("manualRow")}<span class="muted">${n("manualSub")}</span></span>
        <sw-button size="sm" icon="plus" data-manual-add ?disabled=${!this.editable||this.busy} @click=${()=>{this.manualOpen=!0,this.fieldErrors={}}}>${n("manualAdd")}</sw-button></div></div>
    </sw-card>`}channelsCard(){const e=this.view,s=t=>t==="active"?"ok":t==="down"?"bad":"mute";return r`<sw-card heading=${n("channels")} data-card="channels">
      ${e.channels.map(t=>r`<div class=${`row ${t.state==="soon"?"disabled":""}`} data-channel=${t.key} aria-disabled=${t.state==="soon"?"true":"false"}>
        <span class="lbl">${n(`ch_${t.key}`)}<span class="muted">${n(`ch_${t.key}_sub`)}</span></span>
        <span class=${`tag ${s(t.state)}`} data-channel-state=${t.state}>${n(`cs_${t.state}`)}</span></div>`)}
    </sw-card>`}selectedCard(){const e=this.view,s=this.draft,t=this.selected,a=W(e,t),i=s.accounts.find(m=>m.key===t);if(!t||!a&&!i)return r`<sw-card heading=${n("selected")} data-card="selected"><p class="muted">${n("selectHint")}</p></sw-card>`;const l=i?.kind??a?.kind??"discovered",d=i?.pacing??a?.pacing??e.pacing_default,f=q(s,t).length>0,O=this.editable&&(l==="manual"||(a?!a.in_mirror:!0)),c=this.editable&&!this.busy,b=this.fieldErrors;return r`<sw-card heading=${n("selected")} data-card="selected" data-selected=${t}>
      <div class="row"><span class="lbl">${R(B(e,s,t))}<span class="muted">${a?.last_send_at?n("lastSend",{time:Ie(a.last_send_at)}):n("neverSent")}</span></span>${this.chip(a?.state??"unknown")}</div>
      ${this.warnChips(fe(e,t))}
      <div class="row stack"><label class="lbl" for="lbl">${n("labelField")}</label>
        <input id="lbl" class="in" maxlength=${U} data-label .value=${i?.label??""} placeholder=${a?.label??""} ?disabled=${!c}
          @input=${m=>{this.ensureDraftAccount(t),this.setAccount(t,{label:m.target.value})}} /></div>
      ${l==="manual"?r`
        <div class="row stack"><label class="lbl" for="mv">${n("manualValue")}<span class="muted">${n("manualValueSub")}</span></label>
          <input id="mv" class="in ltr" dir="ltr" maxlength="64" data-manual-value .value=${e.can_manage?i?.account??"":a?.last4?`····${a.last4}`:""} ?disabled=${!c}
            aria-invalid=${String(!!b["accounts.account"])} @input=${m=>this.setAccount(t,{account:m.target.value})} /></div>
        <div class="row stack"><label class="lbl" for="se">${n("manualStatus")}</label>
          <input id="se" class="in ltr" dir="ltr" maxlength="120" data-manual-status .value=${i?.status_entity_id??""} ?disabled=${!c}
            @input=${m=>this.setAccount(t,{status_entity_id:m.target.value||null})} /></div>`:o}
      <div class="row"><span class="lbl">${n("sharedOutside")}<span class="muted">${n("sharedOutsideSub")}</span></span>
        <sw-toggle label=${n("sharedOutside")} labelHidden data-shared-outside .checked=${i?.shared_outside??a?.shared_outside??!1} ?disabled=${!c}
          @change=${m=>{this.ensureDraftAccount(t),this.setAccount(t,{shared_outside:m.detail.checked})}}></sw-toggle></div>
      <div class="row stack"><span class="lbl">${n("pacing")}<span class="muted">${n("pacingSub")}</span></span>
        <button type="button" class="linkbtn" aria-expanded=${String(this.pacingOpen)} data-pacing-toggle @click=${()=>this.pacingOpen=!this.pacingOpen}>${n("pacingSummary",{hour:d.per_hour,day:d.per_day,gap:d.min_gap_s})}</button>
        ${this.pacingOpen?r`<div class="pace" data-pacing>${Ce.map(m=>r`<label>${n(`p_${m}`)}
          <input class="in num" type="number" inputmode="numeric" min=${e.pacing_ranges[m][0]} max=${e.pacing_ranges[m][1]} data-pace=${m} .value=${String(d[m])} ?disabled=${!c}
            aria-invalid=${String(!!b[`pacing.${m}`])} @input=${De=>{this.ensureDraftAccount(t),this.setAccount(t,{pacing:{...d,[m]:Number(De.target.value)}})}} />
          ${b[`pacing.${m}`]?r`<span class="field-error">${b[`pacing.${m}`]}</span>`:o}</label>`)}</div>`:o}</div>
      <div class="row stack"><span class="lbl">${n("testTitle")}${e.test_send.enabled?o:r`<span class="muted" data-test-off>${n("testOff")}</span>`}</span>
        <div class="actions"><input class="in ltr" dir="ltr" inputmode="tel" maxlength="20" data-test-target aria-label=${n("testTarget")} placeholder=${n("testTarget")} .value=${this.testTarget}
          ?disabled=${!e.test_send.enabled||!c} @input=${m=>this.testTarget=m.target.value} />
          <sw-button size="sm" data-test-send ?disabled=${!e.test_send.enabled||!c||!this.testTarget.trim()} @click=${()=>this.testConfirm=!0}>${n("testSend")}</sw-button></div></div>
      ${O?r`<div class="row"><span class="lbl">${f?r`<span class="muted">${n("removeInUse")}</span>`:o}</span>
        <sw-button size="sm" variant="danger" data-remove ?disabled=${f||this.busy} @click=${()=>this.removeAccount(t)}>${n("remove")}</sw-button></div>`:o}
    </sw-card>`}manualDialog(){const e=this.fieldErrors.manual??"";return r`<sw-dialog heading=${n("manualTitle")} .open=${this.manualOpen} data-manual-dialog @close=${()=>this.manualOpen=!1}>
      <div class="form">
        <label>${n("labelField")}<input class="in" maxlength=${U} data-manual-label .value=${this.manual.label} @input=${s=>this.manual={...this.manual,label:s.target.value}} /></label>
        <label>${n("manualValue")}<span class="muted">${n("manualValueSub")}</span><input class="in ltr" dir="ltr" maxlength="64" data-manual-new-value aria-invalid=${String(!!e)} .value=${this.manual.value} @input=${s=>{this.manual={...this.manual,value:s.target.value},this.fieldErrors={}}} />
          ${e?r`<span class="field-error" data-manual-error>${e}</span>`:o}</label>
        <label>${n("manualStatus")}<input class="in ltr" dir="ltr" maxlength="120" data-manual-new-status .value=${this.manual.entity} @input=${s=>this.manual={...this.manual,entity:s.target.value}} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.manualOpen=!1}>${n("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-manual-ok ?disabled=${!this.manual.value.trim()} @click=${()=>this.addManual()}>${n("add")}</sw-button>
    </sw-dialog>`}testDialog(){return r`<sw-dialog heading=${n("testTitle")} .open=${this.testConfirm} data-test-dialog @close=${()=>this.testConfirm=!1}>
      <p>${n("testConfirmLine",{target:this.testTarget.trim()})}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.testConfirm=!1}>${n("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-test-confirm ?disabled=${this.busy} @click=${()=>{this.testConfirm=!1,this.test()}}>${n("testSend")}</sw-button>
    </sw-dialog>`}confirmDialog(){const e=(this.confirm??[]).reduce((s,t)=>s+t.count,0);return r`<sw-dialog heading=${n("confirmTitle")} .open=${!!this.confirm} data-confirm-dialog @close=${()=>this.confirm=null}>
      <p data-confirm-count=${e}>${n("confirmLine",{n:e})}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirm=null}>${n("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-save ?disabled=${this.busy} @click=${()=>void this.save(!0)}>${n("confirmSave")}</sw-button>
    </sw-dialog>`}render(){const e=n("title");if(this.loadState==="loading")return r`<sw-page crumbs=${F("הגדרות")} heading=${e}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.loadState!=="ready"||!this.view||!this.draft)return r`<sw-page crumbs=${F("הגדרות")} heading=${e} data-messaging-accounts data-state=${this.loadState}>
        <sw-state-panel icon="mail" state=${this.loadState==="forbidden"?"forbidden":"error"} heading=${this.loadState==="forbidden"?n("forbidden"):this.error} actionLabel=${n("retry")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const s=pe(this.view,this.draft);return r`<sw-page crumbs=${F("הגדרות")} heading=${e} subheading=${n("sub")} data-messaging-accounts data-state="ready">
      ${this.error?r`<div class="msg err" role="alert" data-error>${this.error}</div>`:o}
      ${this.ok?r`<div class="msg ok" role="status" data-ok>${this.ok}</div>`:o}
      <div class="cols">
        <div class="col">${this.accountsCard()}${this.channelsCard()}</div>
        <div class="col">${this.selectedCard()}<messaging-pacing-card .labels=${Object.fromEntries(this.view.accounts.map(t=>[t.key,t.label]))}></messaging-pacing-card><messaging-policy-card></messaging-policy-card></div>
      </div>
      ${this.editable?r`<div class="savebar" data-savebar>
        <span class=${s?"dirty":"muted"}>${s?n("dirty"):""}</span><span class="grow"></span>
        <sw-button size="sm" variant="ghost" data-discard ?disabled=${!s||this.busy} @click=${()=>this.view&&this.take(this.view)}>${n("discard")}</sw-button>
        <sw-button size="sm" variant="primary" data-save ?disabled=${!s||this.busy} @click=${()=>void this.save()}>${n("save")}</sw-button>
      </div>`:r`<p class="muted" data-read-only>${n("readOnly")}</p>`}
      ${this.manualDialog()}${this.confirmDialog()}${this.testDialog()}
    </sw-page>`}};w.styles=[ae,ee`
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
      max-inline-size: 1180px;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-block-end: var(--sw-s-2);
    }
    .head .grow {
      flex: 1;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tag.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .tag.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .tag.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .tag.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .acc {
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      padding: 10px 6px;
      border: 0;
      border-block-end: 1px solid var(--sw-border);
      border-radius: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      min-inline-size: 0;
    }
    .acc[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-radius: var(--sw-r-sm);
    }
    .acc:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .acc .nm {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .acc .nm b {
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .acc .nm small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .in {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-solid);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      inline-size: 100%;
      min-inline-size: 0;
    }
    .in.num {
      inline-size: 96px;
    }
    /* a stacked row: the label is a line, not a 220 px flex basis (which is a HEIGHT in a column) */
    .row.stack .lbl {
      flex: none;
    }
    .warnline {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 4px;
      min-inline-size: 0;
    }
    /* a warning is a sentence: it wraps inside its row on a narrow phone instead of leaving the card */
    .warnline .tag {
      white-space: normal;
      max-inline-size: 100%;
      box-sizing: border-box;
      /* GATE-FIX-2270: a wrapped warning is a short block, not a pill - a 999 px radius put the last word of a two-line warning
         into the rounded corner (domus 1024 px); one line still reads as a rounded tag */
      border-radius: var(--sw-r-md);
    }
    .usegroup {
      border-block-start: 1px solid var(--sw-border);
      margin-block-start: var(--sw-s-2);
      padding-block-start: var(--sw-s-2);
    }
    .usegroup h4 {
      margin: 0 0 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .linkbtn {
      border: 0;
      background: transparent;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      padding: 4px 0;
    }
    .pace {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 12px;
      inline-size: 100%;
    }
    .pace label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-inline-size: 0;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .form label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .disabled {
      opacity: var(--sw-disabled-opacity);
    }
    /* CALMSG-POLISH-2331: focus, hover and press on the controls this screen draws itself */
    .in:focus-visible,
    .linkbtn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .in[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    .acc {
      transition: background var(--sw-t-hover) var(--sw-ease-color);
    }
    @media (hover: hover) {
      .acc:not([aria-pressed='true']):hover {
        background: var(--sw-hover-wash);
        border-radius: var(--sw-r-sm);
      }
      .linkbtn:hover {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
    /* a department row belongs to its use: indented, one step lighter, so the use - departments nesting reads at a glance
       (the three department rows looked exactly like the use above them) */
    .linkbtn.depts {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-start: 6px;
    }
    .linkbtn.depts sw-icon {
      transition: transform var(--sw-t-hover) var(--sw-ease);
    }
    .linkbtn.depts[aria-expanded='true'] sw-icon {
      transform: rotate(180deg);
    }
    .row.dept {
      margin-inline-start: var(--sw-s-4);
      padding-block: 10px;
      background: color-mix(in srgb, var(--sw-well, var(--sw-surface-2)) 55%, transparent);
    }
    .row.dept .lbl {
      font-size: var(--sw-fs-md);
    }
    @media (prefers-reduced-motion: reduce) {
      .acc,
      .linkbtn.depts sw-icon {
        transition: none;
      }
    }
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 480px) {
      .pace {
        grid-template-columns: minmax(0, 1fr);
      }
      .in.num {
        inline-size: 100%;
      }
    }
  `,Pe];_([h()],w.prototype,"view",2);_([h()],w.prototype,"draft",2);_([h()],w.prototype,"selected",2);_([h()],w.prototype,"busy",2);_([h()],w.prototype,"error",2);_([h()],w.prototype,"ok",2);_([h()],w.prototype,"loadState",2);_([h()],w.prototype,"manualOpen",2);_([h()],w.prototype,"manual",2);_([h()],w.prototype,"confirm",2);_([h()],w.prototype,"openDepts",2);_([h()],w.prototype,"pacingOpen",2);_([h()],w.prototype,"testTarget",2);_([h()],w.prototype,"testConfirm",2);_([h()],w.prototype,"fieldErrors",2);w=_([te("system-messaging-accounts")],w);export{w as SystemMessagingAccounts};
