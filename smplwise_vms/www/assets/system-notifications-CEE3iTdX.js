const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as ts}from"./sw-logo-art-PLtEZJxU.js";import{g as D,j as h,i as M,cQ as Hs,a1 as $,a2 as Ds,uL as Ms,uM as Bs,hl as j,m as Q,A as u,b as l,k as B,t as d,aJ as Us,dj as js,aT as Fs,aw as Z,uN as Ws,uO as Os,uP as Qs,uQ as Ks,uR as Vs,uS as Ys,uT as Gs,uU as Js,uV as Xs,uW as Zs,uX as se,s as ee,aH as te,uY as ae,e6 as G,uZ as ie,bl as Y,b3 as os,bn as ne,sz as C,a as J,bE as ss,bF as Cs,cW as Ts,cU as qs,be as ps,u_ as hs,u$ as us,v0 as c,f7 as ds,az as As,aK as re,dz as n,v1 as le,ih as oe,v2 as ms,v3 as de,lT as I,v4 as ce,v5 as pe,v6 as F,p as he,G as ue,v7 as fs,v8 as ve,v9 as be,va as me,vb as as,vc as gs,vd as V,ve as fe,F as ge,x as we,vf as $e,oW as ws,vg as W,vh as T,bc as ye,vi as xe,vj as ke,vk as _e,I as ze,vl as Se,vm as Ee,vn as Oe,vo as Ce,vp as Te,vq as qe,vr as $s,vs as Ae,vt as ys,cH as xs,vu as Pe,vv as Le,vw as ks,vx as Re,vy as is,vz as Ne,H as Ie,vA as He,vB as De,vC as Me,vD as Be,vE as Ue,vF as je,dS as Fe,vG as We,vH as _s,vI as Qe,vJ as Ke,vK as Ve,vL as Ye,vM as Ge}from"./index-DD6xpkEV.js";import{l as cs}from"./live-DwhQkxYL.js";import"./sw-table-JCPs9pBi.js";import{T as Je}from"./toast-controller-BPX0Tkjm.js";import{m as Xe}from"./media-page-BxZTlvQH.js";import{b as Ze}from"./bubble-chrome-DLfqISjA.js";import{s as st}from"./settings-Cl1syeZQ.js";import"./lead-reserve-D7pTysGy.js";var et=Object.defineProperty,tt=Object.getOwnPropertyDescriptor,U=(s,e,t,a)=>{for(var i=a>1?void 0:a?tt(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(i=(a?o(e,t,i):o(i))||i);return a&&i&&et(e,t,i),i};let q=class extends M{constructor(){super(...arguments),this.shown=!1,this.optedOut=!1,this.busy=!1,this.message="",this.error="",this.asked=!1}connectedCallback(){super.connectedCallback(),this.stop=Hs(()=>this.check())}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}check(){this.asked||!$()||!Ds("presence.report")||(this.asked=!0,Ms().then(s=>{this.optedOut=s.opted_out,this.shown=s.enabled||s.opted_out}).catch(()=>{this.shown=!1}))}async set(s){this.busy=!0,this.error="";try{this.optedOut=(await Bs(s)).opted_out,this.message=j("optOutSaved"),window.setTimeout(()=>this.message="",2500)}catch(e){this.error=Q(e)}finally{this.busy=!1}}render(){return this.shown?l`<sw-card heading=${j("title")} data-presence-optout-card>
      <div class="row"><span class="lbl">${j("optOut")}<span class="muted">${j("optOutHint")}</span></span>
        <sw-toggle ?checked=${this.optedOut} ?disabled=${this.busy} label=${j("optOut")} labelHidden data-presence-optout
          @change=${s=>void this.set(s.detail.checked)}></sw-toggle></div>
      ${this.message?l`<span class="ok" role="status">${this.message}</span>`:u}
      ${this.error?l`<span class="err" role="alert">${this.error}</span>`:u}
    </sw-card>`:u}};q.styles=D`
    :host { display: block; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
    .lbl { display: flex; flex-direction: column; gap: 2px; font-weight: var(--sw-fw-medium); }
    .muted { color: var(--sw-text-muted, var(--sw-text-2)); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-regular); }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
  `;U([h()],q.prototype,"shown",2);U([h()],q.prototype,"optedOut",2);U([h()],q.prototype,"busy",2);U([h()],q.prototype,"message",2);U([h()],q.prototype,"error",2);q=U([B("presence-opt-out")],q);var at=Object.defineProperty,it=Object.getOwnPropertyDescriptor,y=(s,e,t,a)=>{for(var i=a>1?void 0:a?it(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(i=(a?o(e,t,i):o(i))||i);return a&&i&&at(e,t,i),i};const nt=[{id:"alerts",label:d("התראות מחוקים"),detail:d('כל התראה שחוק ב"חוקים והתראות" מעלה: תנועה, חציית קו, אדם, רכב')},{id:"doors",label:d("דלתות וכניסה"),detail:d("פתיחה, נעילה ושחרור של דלתות ומנעולים במבנה")},{id:"device_faults",label:d("תקלות בהתקנים"),detail:d("מצלמה שאיבדה וידאו, חבלה, דיסק, חיישן שנעלם")},{id:"system",label:d("בריאות המערכת"),detail:d("אירועי מערכת של ה־NVR (רשת, התנגשות כתובות, גישה לא חוקית)")}],rt={insecure:d("התראות Push דורשות חיבור מאובטח (https). פתחו את Arx בכתובת שמתחילה ב־https."),unsupported:d("הדפדפן הזה אינו תומך בהתראות Push."),ios_install:d('באייפון ובאייפד ההתראות מגיעות רק לאפליקציה שהותקנה: ב־Safari הקישו שיתוף ← "הוספה למסך הבית", פתחו את Arx מהמסך הבית וחזרו לכאן.'),denied:d("ההתראות חסומות בדפדפן לאתר הזה. שחררו אותן בהגדרות האתר (סמל המנעול ליד הכתובת) ורעננו."),android_shell:d("אפליקציית Android עדיין לא מקבלת התראות Push. כדי לקבל התראות בטלפון, פתחו את Arx בדפדפן Chrome (או התקינו אותו משם למסך הבית) והפעילו כאן את ההתראות.")};let w=class extends M{constructor(){super(...arguments),this.devicesOnly=!1,this.embedded=!1,this.support="ok",this.rows=[],this.thisHash=null,this.prefs=null,this.draft=null,this.busy=!1,this.toaster=new Je(this,{ms:4e3}),this.error="",this.loaded=!1,this.loadFailed=!1,this.rotateArmed=!1}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(this.support=Ws(),!$()){this.prefs=this.draft={categories:{alerts:!0,doors:!0,device_faults:!0,system:!0},quiet:{enabled:!1,from:"22:00",to:"07:00",allow_critical:!0},updated_at:null},this.loaded=!0;return}try{const[s,e]=await Promise.all([Os(),this.devicesOnly?Promise.resolve(null):Qs()]);this.rows=s.subscriptions,e&&(this.prefs=e,this.draft=structuredClone(e));const t=this.support==="ok"?await Ks().catch(()=>null):null;this.thisHash=t?await Vs(t.endpoint):null,this.error="",this.loadFailed=!1}catch(s){this.error=Q(s),this.loadFailed=!this.loaded||this.loadFailed}this.loaded=!0}get subscribedHere(){return!!this.thisHash&&this.rows.some(s=>s.endpoint_hash===this.thisHash)}flash(s){this.toaster.show(s),this.error=""}async run(s){this.busy=!0,this.error="";try{await s()}catch(e){this.error=Q(e)}finally{this.busy=!1}}enable(){return this.run(async()=>{await Ys(),await this.load(),this.flash(d("ההתראות הופעלו במכשיר הזה."))})}disable(){return this.run(async()=>{await Gs(this.rows),await this.load(),this.flash(d("ההתראות כובו במכשיר הזה."))})}removeRow(s){return this.run(async()=>{await Js(s.id),await this.load(),this.flash(d("המכשיר הוסר."))})}test(){return this.run(async()=>{const s=await Xs();this.flash(s.sent?s.sent===1?d("נשלחה התראת בדיקה ל־{n} מכשיר.",{n:s.sent}):d("נשלחה התראת בדיקה ל־{n} מכשירים.",{n:s.sent}):d("שירות ה־Push לא אישר את המשלוח; ראו את מצב המכשירים למטה.")),await this.load()})}save(){const s=this.draft;if(s)return this.run(async()=>{this.prefs=await Zs({categories:s.categories,quiet:s.quiet}),this.draft=structuredClone(this.prefs),this.flash(d("ההעדפות נשמרו."))})}rotate(){if(!this.rotateArmed){this.rotateArmed=!0;return}return this.rotateArmed=!1,this.run(async()=>{const s=await se();await this.load(),this.flash(d("נוצר מפתח חדש; {n} הרשמות הוסרו. מכשירים שמאשרים התראות יירשמו מחדש בפתיחה הבאה של Arx.",{n:s.subscriptions_removed}))})}renderKey(){return!$()||!(ee.me?.permissions_installation??[]).includes("system.configure")?u:l`<sw-card heading=${d("מפתח ההתראות של ההתקנה")}>
      <div class="note">${d("מפתח ה־VAPID חותם על כל ההתראות של ההתקנה. החלפה מוחקת את כל ההרשמות של כל המשתמשים; כל מכשיר שמאשר התראות נרשם מחדש בפתיחה הבאה של Arx. רק אם המפתח נחשף (למשל גיבוי של המערכת שיצא מהשליטה).")}</div>
      <div class="foot"><sw-button variant=${this.rotateArmed?"danger":"secondary"} icon="refresh" data-push-rotate ?disabled=${this.busy} @click=${()=>this.rotate()}>${this.rotateArmed?d("לחצו שוב לאישור ההחלפה"):d("החלפת המפתח")}</sw-button></div>
    </sw-card>`}setCat(s,e){this.draft&&(this.draft={...this.draft,categories:{...this.draft.categories,[s]:e}})}setQuiet(s){this.draft&&(this.draft={...this.draft,quiet:{...this.draft.quiet,...s}})}fmt(s){if(!s)return"—";try{return te(new Date(s))}catch{return s}}renderDevice(){const s=$(),e=this.subscribedHere,t=this.support==="ok";return l`<sw-card heading=${d("המכשיר הזה")}>
      ${t?u:l`<div class="note" data-push-support=${this.support}>${rt[this.support]}</div>`}
      ${ae()?l`<div class="note">${d("Arx פתוח כאן בתוך אפליקציית הבית. ההרשמה נרשמת על אותו משתמש גם בגישה מרחוק; לחיצה על התראה פותחת את Arx באותה אפליקציה.")}</div>`:u}
      <div class="row">
        <span class="lbl">${d("התראות Push במכשיר הזה")}<span class="muted">${e?d("פעיל: התראות יגיעו גם כשהאפליקציה סגורה"):d("כבוי")}</span></span>
        <span data-push-state=${e?"on":"off"}><sw-badge kind=${e?"live":"neutral"} label=${e?d("פעיל"):d("כבוי")}></sw-badge></span>
      </div>
      <div class="foot">
        ${e?l`<sw-button data-push-disable ?disabled=${this.busy||!s} @click=${()=>this.disable()}>${d("כיבוי במכשיר הזה")}</sw-button>`:l`<sw-button variant="primary" icon="bell" data-push-enable ?disabled=${this.busy||!s||!t} @click=${()=>this.enable()}>${d("הפעלת התראות במכשיר הזה")}</sw-button>`}
        <sw-button icon="bell" data-push-test ?disabled=${this.busy||!s||!this.rows.length} @click=${()=>this.test()}>${d("שליחת התראת בדיקה")}</sw-button>
        ${this.message?l`<span class="ok" data-push-message>${this.message}</span>`:u}
        ${this.error?l`<span class="err" data-push-error>${this.error}</span>`:u}
      </div>
    </sw-card>`}renderCategories(){const s=this.draft;return l`<sw-card heading=${d("אילו התראות לשלוח")}>
      <div class="note">${d("רק מה שמותר לך לראות: התראה על מצלמה מגיעה רק למי שיש לו גישה למצלמה או לקומה שלה.")}</div>
      ${nt.map(e=>l`<div class="row">
          <span class="lbl">${e.label}<span class="muted">${e.detail}</span></span>
          <sw-toggle data-push-cat=${e.id} label=${e.label} labelHidden ?checked=${s?.categories[e.id]??!0} @change=${t=>this.setCat(e.id,t.detail.checked)}></sw-toggle>
        </div>`)}
    </sw-card>`}renderQuiet(){const s=this.draft?.quiet;return l`<sw-card heading=${d("שעות שקט")}>
      <div class="row">
        <span class="lbl">${d("שעות שקט")}<span class="muted">${d("בטווח הזה לא יישלחו התראות (לפי אזור הזמן של המערכת)")}</span></span>
        <sw-toggle data-push-quiet label=${d("שעות שקט")} labelHidden ?checked=${s?.enabled??!1} @change=${e=>this.setQuiet({enabled:e.detail.checked})}></sw-toggle>
      </div>
      <div class="row">
        <span class="lbl">${d("מ־ עד")}<span class="muted">${d("טווח לילה (למשל 22:00–07:00) עובר את חצות")}</span></span>
        <span class="times">
          <sw-field><input type="time" lang=${G()} data-push-from aria-label=${d("תחילת שעות השקט")} .value=${s?.from??"22:00"} ?disabled=${!s?.enabled} @change=${e=>this.setQuiet({from:e.target.value})} /></sw-field>
          <span>–</span>
          <sw-field><input type="time" lang=${G()} data-push-to aria-label=${d("סוף שעות השקט")} .value=${s?.to??"07:00"} ?disabled=${!s?.enabled} @change=${e=>this.setQuiet({to:e.target.value})} /></sw-field>
        </span>
      </div>
      <div class="row">
        <span class="lbl">${d("התראות קריטיות גם בשעות השקט")}<span class="muted">${d("למשל מצלמה שאיבדה וידאו או דיסק שנכשל")}</span></span>
        <sw-toggle data-push-critical label=${d("קריטיות גם בשקט")} labelHidden ?checked=${s?.allow_critical??!0} ?disabled=${!s?.enabled} @change=${e=>this.setQuiet({allow_critical:e.detail.checked})}></sw-toggle>
      </div>
    </sw-card>`}renderDevices(){return this.rows.length?l`<sw-card heading=${d("המכשירים שלי")} data-push-devices>
      ${this.rows.map(s=>l`<div class="row" data-push-row=${s.id}>
          <span class="dev"><sw-icon name=${s.endpoint_hash===this.thisHash?"check":"bell"} size=${18}></sw-icon><span class="lbl">${ie(s.endpoint_host)}${s.endpoint_hash===this.thisHash?` · ${d("המכשיר הזה")}`:""}<span class="muted">${d("נרשם {when}",{when:this.fmt(s.created_at)})} · ${d("נשלח אחרון {when}",{when:this.fmt(s.last_ok_at)})}${s.failures?` · ${d("{n} כשלים",{n:s.failures})}`:""}${s.channel?l` · <span class="ltr">${s.channel}</span>`:""}</span></span></span>
          <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeRow(s)}>${d("הסרה")}</sw-button>
        </div>`)}
    </sw-card>`:u}render(){const s=JSON.stringify(this.draft?.categories)!==JSON.stringify(this.prefs?.categories)||JSON.stringify(this.draft?.quiet)!==JSON.stringify(this.prefs?.quiet),e=this.loaded?this.loadFailed?l`<sw-state-panel compact state="error" heading=${d("לא הצלחנו לקרוא את ההרשמות")} hint=${this.error} actionLabel=${d("נסו שוב")} data-push-load-error @action=${()=>void this.load()}></sw-state-panel>`:null:l`<sw-state-panel compact state="loading" data-push-loading></sw-state-panel>`,t=l`<div class="sections" data-push-settings data-loaded=${this.loaded?"1":"0"}>
        ${e??this.renderDevice()}
        ${this.devicesOnly||e?u:l`${this.renderCategories()} ${this.renderQuiet()}
            <div class="foot sticky"><sw-button variant="primary" icon="check" data-push-save ?disabled=${!s||this.busy||!$()} @click=${()=>this.save()}>${d("שמירת ההעדפות")}</sw-button></div>`}
        ${this.renderDevices()} <presence-opt-out></presence-opt-out> ${this.renderKey()}
      </div>`;return this.embedded?t:l`<sw-page heading=${d("התראות")} subheading=${$()?this.devicesOnly?d("המכשירים שלך"):d("התראות Push לטלפון ולמחשב שלך · לכל משתמש בנפרד"):d("התראות Push · נתוני הדגמה")}>${t}</sw-page>`}};w.styles=D`
    .sections {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 760px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-inline-size: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      line-height: 1.55;
      padding-block: 4px 8px;
    }
    .times {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .times input {
      inline-size: 110px;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      padding-block-start: 10px;
    }
    /* POLISH4-WP8 (owner Q7): the preferences save row stays in view on a phone while the long page scrolls under it - the same look as
       the settings kit's .foot.sticky (styles/settings.ts), kept local because this element does not load the kit */
    @media (max-width: 767px) {
      .foot.sticky {
        position: sticky;
        inset-block-end: var(--sw-s-2);
        z-index: 3;
        padding: 10px var(--sw-s-2);
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-lg);
        background: var(--sw-surface-solid);
        box-shadow: var(--sw-shadow-3);
      }
    }
    ${Us}
    ${js}
    .dev {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    ${Fs}
    @media (max-width: 767px) {
      .row {
        flex-wrap: wrap;
      }
    }
  `;y([Z({type:Boolean,attribute:"devices-only"})],w.prototype,"devicesOnly",2);y([Z({type:Boolean})],w.prototype,"embedded",2);y([h()],w.prototype,"support",2);y([h()],w.prototype,"rows",2);y([h()],w.prototype,"thisHash",2);y([h()],w.prototype,"prefs",2);y([h()],w.prototype,"draft",2);y([h()],w.prototype,"busy",2);y([h()],w.prototype,"error",2);y([h()],w.prototype,"loaded",2);y([h()],w.prototype,"loadFailed",2);y([h()],w.prototype,"rotateArmed",2);w=y([B("arx-notifications-settings")],w);const lt={view:()=>os("notify/whatsapp"),save:s=>Y("notify/whatsapp",s),test:()=>ne("notify/whatsapp/test"),mine:()=>os("me/notify-whatsapp"),setOptIn:(s,e)=>Y("me/notify-whatsapp",s?{opted_in:!0,confirm:e}:{opted_in:!1}),setOptOut:(s,e)=>Y("me/notify-whatsapp",s?{opted_in:!1}:{opted_in:!0,confirm:e})};function ot(){let s={enabled:!1,per_user_hour:4,dedupe_min:30,budget_pct:50,budget_critical_pct:80,detail:"type_place",detail_levels:["generic","type_place"],normalized:[],warnings:[],revision:0,ranges:{per_user_hour:[1,30],dedupe_min:[5,1440],budget_pct:[10,90],budget_critical_pct:[10,90]},account:{mapped:!0,label:"וואטסאפ ····0191",state:"connected"},reachable_users:3,accounts_href:"#/system/messaging-accounts",test:{own_number:!0,masked:"····0191"}},e={channel_enabled:!1,has_number:!0,masked:"····0191",source:"directory",opted_in:!1,number_changed:!1,directory_declined:!1,consent:"declined",confirm:"demo0123456789ab",stored_opt_in:!1},t=0;const a=(i,r,o)=>new J(i,{code:r,user_message:o,retryable:i===429,correlation_id:"demo",details:{}});return{view:async()=>structuredClone(s),save:async i=>{if(i.revision!==s.revision)throw a(412,"settings_conflict",C("ההגדרות השתנו בינתיים; טען מחדש."));const[r,o]=s.ranges.per_user_hour,[m,g]=s.ranges.dedupe_min;if(i.per_user_hour!==void 0&&(i.per_user_hour<r||i.per_user_hour>o))throw a(422,"validation",C("ערך מספרי מחוץ לטווח."));if(i.dedupe_min!==void 0&&(i.dedupe_min<m||i.dedupe_min>g))throw a(422,"validation",C("ערך מספרי מחוץ לטווח."));const x=i.budget_pct??s.budget_pct,k=i.budget_critical_pct??s.budget_critical_pct;if(x<10||x>90||k<10||k>90||k<x)throw a(422,"validation",C("ערך מספרי מחוץ לטווח."));return s={...s,..."enabled"in i?{enabled:!!i.enabled}:{},...i.per_user_hour!==void 0?{per_user_hour:i.per_user_hour}:{},...i.dedupe_min!==void 0?{dedupe_min:i.dedupe_min}:{},budget_pct:x,budget_critical_pct:k,...i.detail?{detail:i.detail}:{},revision:s.revision+1},e={...e,channel_enabled:s.enabled},structuredClone(s)},test:async()=>{if(!s.account.mapped)throw a(409,"channel_unavailable",C("לא נבחר חשבון וואטסאפ להתראות."));if(++t>3)throw a(429,"rate_limited",C("יותר מדי הודעות בדיקה. נסו שוב מאוחר יותר."));return{ok:!0,outcome:"sent",code:null}},mine:async()=>({...e}),setOptIn:async(i,r)=>{if(i&&r!==e.confirm)throw a(409,"number_changed",C("המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר."));return e={...e,opted_in:i,stored_opt_in:i,number_changed:!1,consent:i&&!e.directory_declined?"granted":"declined"}},setOptOut:async(i,r)=>{if(!i&&r!==e.confirm)throw a(409,"number_changed",C("המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר."));return e={...e,opted_in:!i,stored_opt_in:!i,number_changed:!1,consent:!i&&!e.directory_declined?"granted":"declined"}}}}let dt=null;const R=()=>$()?lt:dt??=ot(),vs={keyUnreadable:"מפתח ההודעות של המערכת לא נקרא - אי אפשר לאמת הסכמות, ולכן לא נשלחות התראות בוואטסאפ",normalized:"ערך שמור לא היה בטווח ותוקן - שמרו כדי לאשר",budget:"חלק מתקציב החשבון",budgetHint:"השאר נשמר להודעות ניהול השירות ולקודי אימות",budgetCritical:"חלק לקריטי",budgetCriticalHint:"קריטי והסלמה רשאים להשתמש עד כאן",detail:"פירוט בהודעה",detailHint:"תוכן ההתראה עצמו לא נשלח לוואטסאפ",detail_generic:"כללי",detail_type_place:"סוג ומקום",mine_title:"וואטסאפ שלי",mine_sub:"התראות לוואטסאפ האישי שלך, רק אם אישרת את המספר בעצמך",mine_number:"המספר",mine_src_directory:"מרשימת אנשי הקשר",mine_src_profile:"מהפרופיל",mine_status:"מצב",mine_on:"מקבל התראות",mine_off:"לא מקבל התראות",mine_changed:"המספר השתנה - אשר מחדש כדי לקבל התראות",mine_declined:"ברשימת אנשי הקשר וואטסאפ אינו הערוץ המועדף",mine_none:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",mine_confirm:"אישור המספר וקבלת התראות",mine_stop:"הפסקת התראות בוואטסאפ",on:"פעיל",off:"כבוי",attention:"דורש טיפול",title:"וואטסאפ",sub:"התראות לטלפון האישי של המשתמש, מהחשבון שנבחר בערוץ ההודעות",enabled:"שליחת התראות בוואטסאפ",enabledHint:"כבוי = שום התראה לא נשלחת בוואטסאפ, גם אם סומנה במדיניות",account:"חשבון שולח",accountNone:"לא נבחר חשבון",accountPick:"בחירת חשבון",st_connected:"מחובר",st_disconnected:"מנותק",st_unknown:"לא ידוע",st_missing:"לא נמצא",reach:"משתמשים עם מספר",reachHint:"מספר מרשימת אנשי הקשר, כשוואטסאפ הוא הערוץ המועדף",cap:"לכל משתמש בשעה",capHint:"התראה קריטית והסלמה אינן נספרות",dedupe:"בלי כפילות במשך",minutes:"דק׳",test:"שליחת בדיקה",testing:"שולח…",testHint:"נשלחת רק למספר שלך ({masked})",testNoNumber:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",testOk:"הודעת הבדיקה נשלחה",testFail:"הבדיקה נכשלה",warnOffAccount:"אין חשבון שולח - ההתראות לא יישלחו",saved:"נשמר",loading:"טוען…",error:"לא ניתן לטעון את הגדרות הוואטסאפ",retry:"נסה שוב",less:"פחות",more:"יותר"},Ps=ss("en","i18n/notify-whatsapp","en"),Ls=ss("ar","i18n/notify-whatsapp","ar"),Rs=ss("ru","i18n/notify-whatsapp","ru");function K(){return qs(["en","ar","ru"])}const ct={he:vs,en:Ps,ar:Ls,ru:Rs};function p(s,e,t=K()){const a=ct[t][s]??vs[s]??s;return Ts(a,e)}Cs("i18n/notify-whatsapp",{he:vs,en:Ps,ar:Ls,ru:Rs});const E={stepCap(s,e){const[t,a]=s.ranges.per_user_hour;return Math.min(a,Math.max(t,s.per_user_hour+e))},warning(s){return s.enabled&&!s.account.mapped?"no_account":null},tone(s){return s.enabled?s.account.mapped&&s.account.state==="connected"?"ok":"bad":"off"},canTest(s){return s.test.own_number&&s.account.mapped},stepPct(s,e,t){const[a,i]=s.ranges[e],r=Math.min(i,Math.max(a,s[e]+t));return e==="budget_pct"?{budget_pct:r,budget_critical_pct:Math.max(r,s.budget_critical_pct)}:{budget_pct:Math.min(s.budget_pct,r),budget_critical_pct:r}},canStop(s){return!!s&&s.channel_enabled&&(s.opted_in||!!s.stored_opt_in)},mineState(s){return!s||!s.channel_enabled?"hidden":s.has_number?s.directory_declined?"declined":s.number_changed?"changed":s.opted_in?"on":"off":"none"}};var pt=Object.defineProperty,ht=Object.getOwnPropertyDescriptor,N=(s,e,t,a)=>{for(var i=a>1?void 0:a?ht(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(i=(a?o(e,t,i):o(i))||i);return a&&i&&pt(e,t,i),i};const ut=[5,15,30,60];let O=class extends M{constructor(){super(...arguments),this.sectionId="wa",this.view=null,this.phase="loading",this.busy=!1,this.result=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.phase="loading";try{this.view=await R().view(),this.phase="ready"}catch{this.phase="error"}}errText(s){return s instanceof J?s.body.user_message||s.code:p("error")}async save(s){const e=this.view;if(!(!e||this.busy)){this.view={...e,...s},this.busy=!0,this.error="";try{this.view=await R().save({...s,revision:e.revision}),this.dispatchEvent(new CustomEvent("notify-saved",{bubbles:!0,composed:!0,detail:{text:p("saved")}}))}catch(t){this.error=this.errText(t),await this.load()}finally{this.busy=!1}}}async test(){this.busy=!0,this.result=null;try{const s=await R().test();this.result={ok:s.ok,text:s.ok?p("testOk"):`${p("testFail")} · ${s.code??s.outcome}`}}catch(s){this.result={ok:!1,text:this.errText(s)}}finally{this.busy=!1}}stateTag(s){const e=s.account;if(!e.mapped)return l`<span class="tag bad" data-wa-account-state="none">${p("accountNone")}</span>`;const t=e.state??"unknown";return l`<span class="tag ${t==="connected"?"ok":t==="unknown"?"":"bad"}" data-wa-account-state=${t}>${p(`st_${t}`)}</span>`}render(){const s=K()==="he"||K()==="ar"?"rtl":"ltr";if(this.phase==="loading")return l`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="loading" aria-busy="true" dir=${s}><span class="skl"></span><span class="skl"></span></section>`;if(this.phase==="error"||!this.view)return l`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="error" dir=${s}><div class="warn" role="alert">${c("warning")}${p("error")}</div><div><button type="button" class="btn sm" data-wa-retry @click=${()=>void this.load()}>${c("refresh")}${p("retry")}</button></div></section>`;const e=this.view,t=E.tone(e),a=!e.enabled,i=E.warning(e);return l`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="ready" data-wa-enabled=${String(e.enabled)} dir=${s}>
      <header><h2>${c("chat")}${p("title")}</h2><div class="sp"><sw-toggle .checked=${cs(e.enabled)} label=${p("enabled")} labelHidden data-wa-switch ?disabled=${this.busy} @change=${ds(e.enabled,()=>void this.save({enabled:!e.enabled}))}></sw-toggle></div></header>
      <p class="sub">${p("sub")}</p>
      <div class="frow"><div class="l"><b>${p("enabled")}</b><small>${p("enabledHint")}</small></div><div class="r"><span class="tag ${t==="ok"?"ok":t==="bad"?"bad":""}" data-wa-tone=${t}>${c(t==="ok"?"check":t==="bad"?"warning":"moon")}${p(t==="ok"?"on":t==="bad"?"attention":"off")}</span></div></div>
      ${i?l`<div class="warn" role="alert" data-wa-warning=${i}>${c("warning")}${p("warnOffAccount")}</div>`:u}
      ${e.warnings?.includes("messaging_key_unreadable")?l`<div class="warn" role="alert" data-wa-key-warning>${c("warning")}${p("keyUnreadable")}</div>`:u}
      ${e.normalized?.length?l`<div class="warn" role="status" data-wa-normalized=${e.normalized.join(",")}>${c("warning")}${p("normalized")}</div>`:u}
      <div class="frow"><div class="l"><b>${p("account")}</b>${e.account.mapped&&e.account.label?l`<small data-wa-account-label>${e.account.label}</small>`:u}</div><div class="r">${this.stateTag(e)}<a class="lnk" href=${e.accounts_href} data-wa-accounts-link>${p("accountPick")}</a></div></div>
      <div class="frow"><div class="l"><b>${p("reach")}</b><small>${p("reachHint")}</small></div><div class="r"><span class="tag" data-wa-reach><span class="n">${e.reachable_users}</span></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${p("cap")}</b><small>${p("capHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-cap-step="-1" aria-label=${p("less")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:E.stepCap(e,-1)})}>${c("minus")}</button><span class="vv" data-wa-cap><span class="n">${e.per_user_hour}</span></span><button type="button" data-wa-cap-step="1" aria-label=${p("more")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:E.stepCap(e,1)})}>${c("plus")}</button></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${p("dedupe")}</b></div><div class="r"><sw-segmented size="sm" label=${p("dedupe")} value=${String(e.dedupe_min)} ?disabled=${this.busy} @change=${r=>void this.save({dedupe_min:Number(r.detail.value)})}
        .options=${ut.map(r=>({value:String(r),label:`${r} ${p("minutes")}`,attrs:{"data-wa-dedupe":String(r)}}))}></sw-segmented></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${p("detail")}</b><small>${p("detailHint")}</small></div><div class="r"><sw-segmented size="sm" label=${p("detail")} value=${e.detail} ?disabled=${this.busy} @change=${r=>void this.save({detail:r.detail.value})}
        .options=${e.detail_levels.map(r=>({value:r,label:p(`detail_${r}`),attrs:{"data-wa-detail":r}}))}></sw-segmented></div></div>
      ${["budget_pct","budget_critical_pct"].map(r=>l`<div class="frow ${a?"dis":""}"><div class="l"><b>${p(r==="budget_pct"?"budget":"budgetCritical")}</b><small>${p(r==="budget_pct"?"budgetHint":"budgetCriticalHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-budget-step=${`${r}:-10`} aria-label=${p("less")} ?disabled=${this.busy} @click=${()=>void this.save(E.stepPct(e,r,-10))}>${c("minus")}</button><span class="vv" data-wa-budget=${r}><span class="n">${e[r]}</span><small>%</small></span><button type="button" data-wa-budget-step=${`${r}:10`} aria-label=${p("more")} ?disabled=${this.busy} @click=${()=>void this.save(E.stepPct(e,r,10))}>${c("plus")}</button></span></div></div>`)}
      <div class="frow"><div class="l"><b>${p("test")}</b><small data-wa-test-hint>${e.test.own_number?p("testHint",{masked:`⁦${e.test.masked??""}⁩`}):p("testNoNumber")}</small></div><div class="r">${this.result?l`<span class="tag ${this.result.ok?"ok":"bad"}" data-wa-test-result=${this.result.ok?"ok":"bad"}>${c(this.result.ok?"check":"warning")}${this.result.text}</span>`:u}<button type="button" class="btn quiet" data-wa-test ?disabled=${this.busy||!E.canTest(e)} @click=${()=>void this.test()}>${c(this.busy?"refresh":"send")}${this.busy?p("testing"):p("test")}</button></div></div>
      ${this.error?l`<div class="warn" role="alert" data-wa-error>${this.error}</div>`:u}
    </section>`}};O.styles=[ps,hs,us,D`
      :host {
        display: block;
      }
      .sec {
        padding: var(--sw-s-4, 16px) var(--sw-s-5, 20px);
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-inline-size: 0;
      }
      header {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-xl);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      h2 .ic {
        font-size: var(--sw-fs-2xl);
        color: var(--sw-text-2);
      }
      header .sp {
        margin-inline-start: auto;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .sub {
        margin: 0;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .frow {
        display: flex;
        align-items: center;
        gap: 14px;
        min-block-size: 52px;
        padding: 4px 0;
        border-block-start: 1px solid var(--sw-border);
        flex-wrap: wrap;
      }
      .frow .l {
        flex: 1 1 180px;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }
      .frow .l b {
        font-size: var(--sw-fs-md);
        font-weight: 600;
      }
      .frow .l small {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .frow .r {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .frow.dis {
        opacity: 0.55;
      }
      .n {
        font-variant-numeric: tabular-nums;
      }
      .warn {
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-base);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      a.lnk {
        color: var(--sw-accent-text);
        font-weight: 600;
        text-decoration: none;
      }
      a.lnk:focus-visible {
        outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
        outline-offset: 2px;
      }
      .skl {
        display: block;
        block-size: 44px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
      }
    `];N([Z({attribute:"section-id"})],O.prototype,"sectionId",2);N([h()],O.prototype,"view",2);N([h()],O.prototype,"phase",2);N([h()],O.prototype,"busy",2);N([h()],O.prototype,"result",2);N([h()],O.prototype,"error",2);O=N([B("notify-whatsapp-section")],O);var vt=Object.defineProperty,bt=Object.getOwnPropertyDescriptor,es=(s,e,t,a)=>{for(var i=a>1?void 0:a?bt(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(i=(a?o(e,t,i):o(i))||i);return a&&i&&vt(e,t,i),i};let H=class extends M{constructor(){super(...arguments),this.mine=null,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}reload(){this.load()}async load(){try{this.mine=await R().mine()}catch{this.mine=null}}async set(s){this.busy=!0,this.error="";try{this.mine=await R().setOptIn(s,s?this.mine?.confirm??null:null)}catch(e){this.error=e instanceof J?e.body.user_message||e.code:p("error"),e instanceof J&&e.code==="number_changed"&&this.load()}finally{this.busy=!1}}render(){const s=E.mineState(this.mine);if(s==="hidden")return u;const e=this.mine,t=K()==="he"||K()==="ar"?"rtl":"ltr",a=s==="on"?l`<span class="tag ok" data-wa-mine-status="on">${c("check")}${p("mine_on")}</span>`:s==="changed"?l`<span class="tag bad" data-wa-mine-status="changed">${c("warning")}${p("mine_changed")}</span>`:s==="declined"?l`<span class="tag" data-wa-mine-status="declined">${p("mine_declined")}</span>`:s==="none"?l`<span class="tag" data-wa-mine-status="none">${p("mine_none")}</span>`:l`<span class="tag" data-wa-mine-status="off">${p("mine_off")}</span>`;return l`<div class="box" data-wa-mine data-wa-mine-state=${s} dir=${t}>
      <h3>${c("chat")}${p("mine_title")}</h3>
      <p class="sub">${p("mine_sub")}</p>
      ${e.has_number?l`<div class="row"><b>${p("mine_number")}</b><span class="n" data-wa-mine-number>${e.masked}</span><small>${p(e.source==="profile"?"mine_src_profile":"mine_src_directory")}</small></div>`:u}
      <div class="row"><b>${p("mine_status")}</b>${a}</div>
      ${s==="off"||s==="changed"?l`<div class="acts"><button type="button" class="btn primary sm" data-wa-mine-confirm ?disabled=${this.busy} @click=${()=>void this.set(!0)}>${c("check")}${p("mine_confirm")}</button></div>`:u}
      ${E.canStop(e)?l`<div class="acts"><button type="button" class="btn quiet sm" data-wa-mine-stop ?disabled=${this.busy} @click=${()=>void this.set(!1)}>${p("mine_stop")}</button></div>`:u}
      ${this.error?l`<div class="warn" role="alert" data-wa-mine-error>${this.error}</div>`:u}
    </div>`}};H.styles=[ps,hs,us,D`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      .box {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-block: 8px;
        border-block-start: 1px solid var(--sw-border);
      }
      h3 {
        margin: 0;
        font-size: var(--sw-fs-md);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sub {
        margin: 0;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        min-block-size: 44px;
      }
      .row b {
        font-size: var(--sw-fs-base);
        font-weight: 600;
        min-inline-size: 90px;
      }
      .n {
        font-variant-numeric: tabular-nums;
        direction: ltr;
        unicode-bidi: isolate;
      }
      .warn {
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-sm);
        font-weight: 600;
      }
      .acts {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `];es([h()],H.prototype,"mine",2);es([h()],H.prototype,"busy",2);es([h()],H.prototype,"error",2);H=es([B("notify-whatsapp-mine")],H);const mt=["push","all"],L={enabled:"quiet.windows.enabled",default_minutes:"quiet.windows.default_minutes",max_minutes:"quiet.windows.max_minutes",mute_alerts:"quiet.windows.mute_alerts",channels:"quiet.windows.channels"},_=[5,720],X={enabled:!1,default_minutes:120,max_minutes:240,mute_alerts:!1,channels:"push"},zs=(s,e)=>{const t=typeof s=="string"&&/^\d+$/.test(s)?Number(s):NaN;return Number.isInteger(t)&&t>=_[0]&&t<=_[1]?t:e};function Ss(s){const e=s??{};return{enabled:e[L.enabled]==="on",default_minutes:zs(e[L.default_minutes],X.default_minutes),max_minutes:zs(e[L.max_minutes],X.max_minutes),mute_alerts:e[L.mute_alerts]==="on",channels:e[L.channels]==="all"?"all":"push"}}const ns=(s,e)=>{const t=e[s];return typeof t=="boolean"?t?"on":"off":String(t)};function Es(s,e){const t={};for(const a of Object.keys(L))ns(a,s)!==ns(a,e)&&(t[L[a]]=ns(a,e));return t}function rs(s){const e=t=>Number.isInteger(t)&&t>=_[0]&&t<=_[1];return!e(s.default_minutes)||!e(s.max_minutes)?"range":s.default_minutes>s.max_minutes?"default_over_max":null}const ft=(s,e)=>s.enabled&&!e.enabled,gt=()=>os("quiet/settings"),wt=s=>Y("quiet/settings",{changes:s,confirmed:!0}),bs={title:"חלון שקט לקומה או לאזור",sub:"כפתור אחד בכותרת הקומה או האזור משהה התראות מידע לזמן קצוב. התראות קריטיות ובטיחות לא מושהות לעולם.",enabled:"חלון שקט",enabledHint:"כבוי כברירת מחדל. כיבוי מסיים מיד כל חלון פתוח.",off:"כבוי",on:"פעיל",defaultMinutes:"משך ברירת מחדל (דקות)",maxMinutes:"משך מרבי (דקות)",minutesHint:"בין {lo} ל־{hi} דקות",muteAlerts:"להשהות גם התראות חשובות",muteAlertsHint:"כבוי: רק התראות מידע מושהות",channels:"ערוצים שהחלון משהה",channelsHint:'פוש בלבד: הדחיפה לטלפון ולדפדפן מושהית; דוא"ל, WhatsApp והכרזות נשלחים כרגיל. מרכז ההתראות שומר הכל בכל מקרה.',ch_push:"פוש בלבד",ch_all:"כל הערוצים",save:"שמור",saved:"ההגדרות נשמרו",readOnly:"שינוי ההגדרות דורש הרשאת מנהל מערכת.",demo:"נתוני הדגמה: ההגדרות נשמרות רק מול השרת.",errRange:"משך בין {lo} ל־{hi} דקות",errOverMax:"משך ברירת המחדל גדול מהמשך המרבי",confirmTitle:"לשמור את הגדרות חלון השקט?",confirmBody:"השינוי חל מיד על כל הקומות והאזורים.",confirmEnds:"כיבוי החלון מסיים עכשיו כל חלון שקט פתוח.",confirmGo:"שמור",cancel:"ביטול",loadError:"הגדרות חלון השקט לא נטענו"},Ns=ss("en","i18n/quiet-windows","en"),$t={he:bs,en:Ns};function yt(){return qs(["en"])}function v(s,e,t=yt()){const a=$t[t][s]??bs[s]??s;return Ts(a,e)}Cs("i18n/quiet-windows",{he:bs,en:Ns});var xt=Object.defineProperty,kt=Object.getOwnPropertyDescriptor,A=(s,e,t,a)=>{for(var i=a>1?void 0:a?kt(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(i=(a?o(e,t,i):o(i))||i);return a&&i&&xt(e,t,i),i};let z=class extends M{constructor(){super(...arguments),this.saved=X,this.draft=X,this.loaded=!1,this.busy=!1,this.asking=!1,this.message="",this.error=""}connectedCallback(){if(super.connectedCallback(),!$()){this.loaded=!0;return}gt().then(s=>this.adopt(Ss(s.settings))).catch(s=>{this.loaded=!0,this.error=`${v("loadError")}: ${Q(s)}`})}adopt(s){this.saved=s,this.draft={...s},this.loaded=!0}get editable(){return $()&&As("system.configure")&&this.loaded}set(s){this.draft={...this.draft,...s},this.message="",this.error=""}problemText(){const s=rs(this.draft);return s==="range"?v("errRange",{lo:_[0],hi:_[1]}):s==="default_over_max"?v("errOverMax"):""}async save(){this.asking=!1;const s=Es(this.saved,this.draft);if(!(!Object.keys(s).length||rs(this.draft))){this.busy=!0,this.error="";try{const e=await wt(s);this.adopt(Ss(e.settings)),this.message=v("saved")}catch(e){this.error=Q(e)}finally{this.busy=!1}}}seg(s,e,t,a,i){const r=this.draft[s];return l`<sw-segmented label=${a} data-qw-seg=${s} value=${String(r)} ?disabled=${i}
      @change=${o=>{const m=e.find(g=>String(g)===o.detail.value);m!==void 0&&this.set({[s]:m})}}
      .options=${e.map(o=>({value:String(o),label:t(o),attrs:{"data-v":String(o)}}))}></sw-segmented>`}minutes(s,e){return l`<sw-field class="ctl"><input type="number" inputmode="numeric" min=${_[0]} max=${_[1]} step="5" data-ltr data-qw-minutes=${s}
      aria-invalid=${String(!!rs(this.draft))} .value=${String(this.draft[s])} ?disabled=${e}
      @change=${t=>this.set({[s]:Number(t.target.value)})} /></sw-field>`}render(){const s=!this.editable||this.busy,e=this.draft,t=o=>v(o?"on":"off"),a=Object.keys(Es(this.saved,e)).length>0,i=this.problemText(),r=v("minutesHint",{lo:_[0],hi:_[1]});return l`<div class="card" data-quiet-windows-card>
      <p class="sub">${v("sub")}</p>
      <div class="set-col">
        <div class="row" data-qw-row="enabled"><span class="lbl">${v("enabled")}<span class="muted">${v("enabledHint")}</span></span>${this.seg("enabled",[!1,!0],t,v("enabled"),s)}</div>
        <div class="row" data-qw-row="default"><span class="lbl">${v("defaultMinutes")}<span class="muted">${r}</span></span>${this.minutes("default_minutes",s)}</div>
        <div class="row" data-qw-row="max"><span class="lbl">${v("maxMinutes")}<span class="muted">${r}</span></span>${this.minutes("max_minutes",s)}</div>
        <div class="row" data-qw-row="mute-alerts"><span class="lbl">${v("muteAlerts")}<span class="muted">${v("muteAlertsHint")}</span></span>${this.seg("mute_alerts",[!1,!0],t,v("muteAlerts"),s)}</div>
        <div class="row" data-qw-row="channels"><span class="lbl">${v("channels")}<span class="muted">${v("channelsHint")}</span></span>${this.seg("channels",mt,o=>v(o==="all"?"ch_all":"ch_push"),v("channels"),s)}</div>
      </div>
      ${i?l`<div class="err" role="alert" data-qw-problem>${i}</div>`:u}
      ${this.editable?l`<div class="foot sticky" data-qw-foot>
            <sw-button variant="primary" size="sm" icon="check" data-qw-save ?disabled=${!a||!!i||this.busy} @click=${()=>this.asking=!0}>${v("save")}</sw-button>
            ${this.message?l`<span class="ok" role="status" data-qw-message>${this.message}</span>`:u}
            ${this.error?l`<span class="err" role="alert" data-qw-error>${this.error}</span>`:u}
          </div>`:l`<div class="muted" data-qw-readonly>${this.error||v($()?"readOnly":"demo")}</div>`}
      <sw-dialog ?open=${this.asking} heading=${v("confirmTitle")} @close=${()=>this.asking=!1} data-qw-confirm>
        <p>${v("confirmBody")}</p>
        ${ft(this.saved,e)?l`<p class="err" data-qw-confirm-ends>${v("confirmEnds")}</p>`:u}
        <sw-button slot="footer" @click=${()=>this.asking=!1}>${v("cancel")}</sw-button>
        <sw-button slot="footer" variant="primary" data-qw-confirm-go @click=${()=>void this.save()}>${v("confirmGo")}</sw-button>
      </sw-dialog>
    </div>`}};z.styles=[st,D`
    :host { display: block; }
    .card { display: grid; gap: 0; }
    .sub { margin: 0 0 10px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .ctl input { inline-size: 100%; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
  `];A([h()],z.prototype,"saved",2);A([h()],z.prototype,"draft",2);A([h()],z.prototype,"loaded",2);A([h()],z.prototype,"busy",2);A([h()],z.prototype,"asking",2);A([h()],z.prototype,"message",2);A([h()],z.prototype,"error",2);z=A([B("system-quiet-windows")],z);var _t=Object.defineProperty,zt=Object.getOwnPropertyDescriptor,f=(s,e,t,a)=>{for(var i=a>1?void 0:a?zt(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(i=(a?o(e,t,i):o(i))||i);return a&&i&&_t(e,t,i),i};const S=[{id:"sources",label:n("מקורות והרשאות – מה נשלח"),icon:"list"},{id:"quiet",label:n("שעות שקט ומה עובר"),icon:"moon"},{id:"esc",label:n("הסלמה"),icon:"escal"},{id:"lock",label:n("פרטיות מסך נעול"),icon:"lock"},{id:"keep",label:n("שמירה"),icon:"calendar"},{id:"mail",label:n("דואר יוצא"),icon:"mail"},{id:"wa",label:n("וואטסאפ"),icon:"chat"},{id:"chan",label:n("ערוצים"),icon:"phone"},{id:"log",label:n("יומן מסירה וכשלים"),icon:"inbox"}],St=[{id:"u-yoni",name:"יוני"},{id:"u-dana",name:"דנה"},{id:"u-uri",name:"אורי"},{id:"u-roni",name:"רוני"}],ls=["scope","managers","initiator","users"],Et={sent:"ok",failed:"bad",gone:"bad",skipped:void 0,queued:void 0,retry:void 0},Ot=()=>n("{n} יום",{n:14});let b=class extends M{constructor(){super(...arguments),this.bubbleSkin=new re(this),this.section="",this.phase="loading",this.error="",this.settings=null,this.policies=[],this.stats=null,this.log=[],this.titles={},this.users=null,this.devices=0,this.wa=null,this.onlyFailed=!1,this.sec="sources",this.phone=window.matchMedia("(max-width: 1099px)").matches,this.toast=null,this.invalid=null,this.mail={linkBase:"",host:"",port:"587",security:"starttls",user:"",password:"",pwEdit:!0,from:"",recipients:""},this.mailBusy=null,this.mailResult=null,this.mailError="",this.picker=null,this.now=Date.now(),this.clockOffset=0,this.offClock=null,this.tz=void 0,this.rev=1,this.chain=Promise.resolve(),this.toastTimer=0,this.phoneMq=window.matchMedia("(max-width: 1099px)"),this.onMq=()=>this.phone=this.phoneMq.matches,this.nameOf=s=>{if(s==="managers")return n("מנהלי התראות");const e=s.map(t=>this.users?.find(a=>a.id===t)?.name??t);return e.length?e.join(", "):n("משתמשים נבחרים")}}connectedCallback(){super.connectedCallback(),le(this),this.phoneMq.addEventListener("change",this.onMq),this.load(),this.offClock=oe(()=>this.now=Date.now()+this.clockOffset)}disconnectedCallback(){this.offClock?.(),this.offClock=null,this.phoneMq.removeEventListener("change",this.onMq),window.clearTimeout(this.toastTimer),super.disconnectedCallback()}willUpdate(s){const e=s.has("section")?ms(this.section):null;e&&(this.sec=e)}async load(){this.phase="loading",this.error="";try{if(await de.prepare(),$()&&!As("notify.manage")){this.phase="user";return}const s=I();let e;try{e=await s.settings()}catch(P){if(ce(P)==="forbidden"){this.phase="user";return}throw P}const[t,a,i,r,o,m,g,x]=await Promise.all([s.policies(),s.stats().catch(()=>null),s.adminDeliveries({limit:200}).catch(()=>[]),s.list({limit:100}).catch(()=>null),this.loadUsers(),this.countDevices(),this.clockAndZone(),R().view().catch(()=>null)]);this.wa=x;const k=this.settings;this.settings=e,this.rev=e.revision,this.policies=t,this.stats=a,this.log=i,this.titles=Object.fromEntries((r?.notifications??[]).map(P=>[P.id,P.title])),this.users=o,this.devices=m,this.now=g.now,this.clockOffset=g.now-Date.now(),this.tz=g.tz,this.mail=pe(this.mail,k,e),this.mailResult=null,this.phase="ready"}catch(s){this.error=F(s),this.phase="error"}}async clockAndZone(){if($()){const e=await he().catch(()=>({}));return{now:Date.now(),tz:typeof e["time.zone"]=="string"?e["time.zone"]:void 0}}const s=await ts(()=>import("./notifications-mock-DIcqbf-H.js"),__vite__mapDeps([0]),import.meta.url);return{now:s.notifyMock().clock,tz:s.MOCK_TZ}}async loadUsers(){if(!$())return St;try{const{listUsers:s}=await ts(async()=>{const{listUsers:e}=await import("./access-C2dLLZiU.js");return{listUsers:e}},__vite__mapDeps([0]),import.meta.url);return(await s()).users.filter(e=>e.active).map(e=>({id:e.id,name:e.name||e.username}))}catch{return null}}async countDevices(){if(!$())return(await ts(async()=>{const{notifyMock:s}=await import("./notifications-mock-DIcqbf-H.js");return{notifyMock:s}},__vite__mapDeps([0]),import.meta.url)).notifyMock().registered;try{return(await Os()).subscriptions.length}catch{return 0}}say(s,e=!1){this.toast={text:s,bad:e},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,3e3)}enqueue(s){this.chain=this.chain.then(s).catch(()=>{})}async conflict(s){this.say(F(s),!0),await this.load()}patchSettings(s){if(!this.settings)return;this.settings={...this.settings,...s};const e=ue(fs(this.settings));this.invalid=e,!e&&this.enqueue(async()=>{if(this.settings)try{const t=await I().saveSettings(fs(this.settings),this.rev);this.rev=t.revision,this.say(n("נשמר"))}catch(t){await this.conflict(t)}})}patchPolicy(s,e){const t=this.policies.find(i=>i.source===s);if(!t)return;let a;try{a=e(t)}catch(i){this.say(F(i),!0);return}this.policies=this.policies.map(i=>i.source===s?a:i),this.enqueue(async()=>{const i=this.policies.find(r=>r.source===s);if(i)try{const r=await I().savePolicy(s,ve(i),i.revision);this.policies=this.policies.map(o=>o.source===s?{...o,revision:r.revision}:o),this.say(n("נשמר"))}catch(r){await this.conflict(r)}})}setSec(s){const e=ms(s);e&&(this.sec=e)}mailBody(){const s=this.mail,e={host:s.host.trim(),port:Number(s.port),security:s.security,user:s.user.trim(),from:s.from.trim(),recipients:be(s.recipients),link_base:s.linkBase.trim()};return s.pwEdit&&s.password&&(e.password=s.password),me(e)?null:e}async saveMail(){const s=this.mailBody();if(!s){this.mailError=as.email_invalid;return}this.mailError="",this.mailBusy="save";try{const e=await I().saveEmail(s);this.settings&&(this.settings={...this.settings,email:e}),this.mailResult=null,this.mail={...this.mail,password:"",pwEdit:!e.password_set},this.say(n("הגדרות הדואר נשמרו"))}catch(e){this.mailError=F(e)}finally{this.mailBusy=null}}async testMail(){this.mailBusy="test",this.mailError="";try{this.mailResult=await I().testEmail();const s=await I().settings().catch(()=>null);s&&this.settings&&(this.settings={...this.settings,email:s.email})}catch(s){this.mailResult=null,this.mailError=F(s)}finally{this.mailBusy=null}}openPicker(s){const e=s==="esc"?Array.isArray(this.settings?.escalation.to)?this.settings?.escalation.to:[]:this.policies.find(t=>t.source===s)?.recipients.user_ids??[];this.picker={target:s,selected:[...e]}}savePicker(){const s=this.picker;if(!(!s||!s.selected.length)){if(s.target==="esc")this.patchSettings({escalation:{...this.settings.escalation,to:s.selected}});else{const e=s.selected;this.patchPolicy(s.target,t=>({...t,recipients:{rule:"users",user_ids:e}}))}this.picker=null}}sevSeg(s,e){return l`<span class="sevseg" role="radiogroup" aria-label=${n("חומרה")}>${gs.slice().reverse().map(t=>l`<button type="button" role="radio" aria-checked=${String(e===t)} data-pol-sev=${`${s}:${t}`} style=${`--sev:var(--nt-sev-${t})`} title=${V[t]} @click=${()=>this.patchPolicy(s,a=>fe(a,t))}><i aria-hidden="true"></i>${V[t]}</button>`)}</span>`}whoSel(s){const e=ge.includes(s.source),t=this.settings?we(s,this.settings):s.recipients.rule,a=e?t:s.recipients.rule;return l`<sw-field><select class="inp sm" data-pol-who=${s.source} aria-label=${n("מי מקבל")} ?disabled=${e} @change=${i=>{const r=i.target.value;r==="users"?(this.openPicker(s.source),i.target.value=a):this.patchPolicy(s.source,o=>$e(o,r))}}>${(ls.includes(a)?ls:[...ls,a]).map(i=>l`<option value=${i} .selected=${a===i}>${i==="users"&&s.recipients.rule==="users"?`${ws.users} (${s.recipients.user_ids?.length??0})`:ws[i]}</option>`)}</select></sw-field>`}chans(s){const e=this.settings,t=W(s,"webpush",e),a=W(s,"email",e),i=W(s,"app",e),r=W(s,"whatsapp",e,this.wa),o=W(s,"announce",e),m={email:n('הדוא"ל לא מוגדר'),whatsapp:n("וואטסאפ כבוי")},g=(x,k,P)=>l`<button type="button" class=${xs({chip:!0,unconf:k.note==="unconfigured"})} aria-pressed=${String(k.on)} data-pol-ch=${`${s.source}:${x}`} title=${k.note==="unconfigured"?m[x]??"":""} @click=${()=>this.patchPolicy(s.source,Is=>We(Is,x,!k.on))}>${c(P)}${T[x]}</button>`;return l`<span class="chs"><span class="chip lock" title=${n("תמיד")}>${c("inbox")}${T.inbox}</span>${g("webpush",t,"phone")}${g("email",a,"mail")}${g("app",i,"phone")}${g("whatsapp",r,"chat")}${g("announce",o,"horn")}<span class="chip soon" role="img" title=${n("Companion – בקרוב")} aria-label=${n("Companion – בקרוב")}>${c("phone")}</span></span>`}tog(s,e,t,a,i=!1){return l`<sw-toggle .checked=${cs(s)} label=${t} labelHidden ?disabled=${i} data-tog=${e} @change=${ds(s,a)}></sw-toggle>`}polToggle(s){return l`<sw-toggle .checked=${cs(s.enabled)} label=${n("פעיל")} labelHidden data-pol-on=${s.source} @change=${ds(s.enabled,()=>this.patchPolicy(s.source,e=>({...e,enabled:!e.enabled})))}></sw-toggle>`}renderSources(){const s=ye("nvr")?this.policies:this.policies.filter(o=>!xe(o.source)),e=ke(s,[..._s,...Ke,...Ve,...Ye,...Ge]),t=s.length,a=o=>o==="rule.alert"||_s.find(m=>m.key===o)?.rulesOnly===!0,i=this.settings;let r;return this.phone?r=l`<div class="scards">${e.flatMap(o=>o.rows).map(({info:o,policy:m})=>l`<section class="glass scard ${m.enabled?"":"off"}" data-pol-row=${m.source}>
        <div class="top"><span class="nm"><span class="ring">${c(o.icon)}</span></span><b>${o.label}</b>${this.polToggle(m)}</div>
        <div class="ln"><small>${n("חומרה")}</small>${a(m.source)?l`<span class="tag">${n("לפי החוק")}</span>`:this.sevSeg(m.source,m.severity)}</div>
        <div class="ln"><small>${n("מי מקבל")}</small>${this.whoSel(m)}</div>
        <div class="ln"><small>${n("ערוצים")}</small>${this.chans(m)}</div></section>`)}</div>`:r=l`<div class="mxw"><table class="mx"><colgroup><col style="width:18%"><col style="width:6%"><col style="width:22%"><col style="width:16%"><col></colgroup>
        <thead><tr><th>${n("מקור")}</th><th class="c">${n("פעיל")}</th><th>${n("חומרה")}</th><th>${n("מי מקבל")}</th><th>${n("ערוצים")}</th></tr></thead>
        <tbody>${e.map(o=>l`<tr class="cat"><td colspan="5">${c(o.icon)}${o.label}</td></tr>${o.rows.map(({info:m,policy:g})=>l`<tr class=${g.enabled?"":"off"} data-pol-row=${g.source}>
          <td class="keep"><span class="nm"><span class="ring">${c(m.icon)}</span><b>${m.label}</b></span></td>
          <td class="c keep">${this.polToggle(g)}</td>
          <td>${a(g.source)?l`<span class="tag">${n("לפי החוק")}</span>`:this.sevSeg(g.source,g.severity)}</td>
          <td>${this.whoSel(g)}</td><td>${this.chans(g)}</td></tr>`)}`)}</tbody></table></div>`,l`<section class="glass sec" data-set-section="sources" id="sec-sources"><header><h2>${c("list")}${S[0].label}</h2><div class="sp"><span class="tag soon">${c("phone")}${n("Companion – בקרוב")}</span><span class="tag" data-pol-count>${n("{n} מתוך {total} פעילים",{n:_e(this.policies),total:t})}</span></div></header>
      <div class="frow"><div class="l"><b>${n("כשל בתזמון או באוטומציה מגיע אל")}</b></div><div class="r"><sw-segmented size="sm" label=${n("כשל בתזמון או באוטומציה")} value=${i.failures_audience} @change=${o=>this.patchSettings({failures_audience:o.detail.value})}
        .options=${ze.map(o=>({value:o,label:o==="admins"?n("מנהלים"):n("כל מי שרואה"),attrs:{"data-failures-audience":o}}))}></sw-segmented></div></div>
      ${r}</section>`}renderQuiet(){const s=this.settings,e=s.quiet,t=!e.enabled;return l`<section class="glass sec" data-set-section="quiet" id="sec-quiet"><header><h2>${c("moon")}${S[1].label}</h2><div class="sp">${this.tog(e.enabled,"quiet-on",n("שעות שקט"),()=>this.patchSettings({quiet:{...e,enabled:!e.enabled}}))}</div></header>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${n("שעות")}</b></div><div class="r"><input class="inp sm ltr" type="time" lang=${G()} data-quiet-from aria-label=${n("מהשעה")} style="inline-size:112px" .value=${e.from} ?disabled=${t} @change=${a=>this.setTime("from",a.target.value)} /><span>${n("עד")}</span><input class="inp sm ltr" type="time" lang=${G()} data-quiet-to aria-label=${n("עד השעה")} style="inline-size:112px" .value=${e.to} ?disabled=${t} @change=${a=>this.setTime("to",a.target.value)} /></div></div>
      ${this.invalid==="quiet_invalid"?l`<div class="errline" data-set-error>${as.quiet_invalid}</div>`:u}
      <div class="frow ${t?"dis":""}"><div class="l"><b>${n("ימים")}</b></div><div class="r"><div class="days" role="group" aria-label=${n("ימים")}>${Se.map(a=>l`<button type="button" aria-pressed=${String(e.days.includes(a))} data-quiet-day=${a} ?disabled=${t} @click=${()=>this.patchSettings({quiet:{...e,days:Oe(e.days,a)}})}>${Ee[a]}</button>`)}</div></div></div>
      <div class="frow ${t?"dis":""}" style="align-items:flex-start"><div class="l"><b>${n("מה עובר בשעות שקט")}</b></div></div>
      <table class="qmx ${t?"dis":""}"><thead><tr><th>${n("חומרה")}</th><th>${T.webpush}</th><th>${T.email}</th><th>${T.whatsapp}</th><th>Companion</th></tr></thead><tbody>${gs.slice().reverse().map(a=>l`<tr><td><span class="sv" style=${`--sev:var(--nt-sev-${a})`}><i></i>${V[a]}</span></td>
        ${["webpush","email","whatsapp"].map(i=>l`<td><button type="button" class="chk" role="checkbox" aria-checked=${String(s.pass_through[a][i]??!1)} aria-label=${`${V[a]} · ${T[i]}`} data-pass=${`${a}:${i}`} ?disabled=${t} @click=${()=>this.patchSettings({pass_through:Ce(s.pass_through,a,i)})}>${c("check")}</button></td>`)}
        <td><button type="button" class="chk" role="checkbox" aria-checked=${String(s.pass_through[a].ha_mobile)} aria-label=${n("Companion – בקרוב")} disabled>${c("check")}</button></td></tr>`)}</tbody></table></section>
      <section class="glass sec" data-set-section="quiet-windows" id="sec-quiet-windows"><header><h2>${c("moon")}${v("title")}</h2></header><system-quiet-windows></system-quiet-windows></section>`}setTime(s,e){!this.settings||!Number.isFinite(Te(e))||this.patchSettings({quiet:{...this.settings.quiet,[s]:e}})}renderEsc(){const e=this.settings.escalation,t=!e.enabled,a=e.to!=="managers",i=o=>this.patchSettings({escalation:{...e,...o}}),r=qe(e,842,this.nameOf);return l`<section class="glass sec" data-set-section="esc" id="sec-esc"><header><h2>${c("escal")}${S[2].label}</h2><div class="sp">${this.tog(e.enabled,"esc-on",n("הסלמה"),()=>i({enabled:!e.enabled}))}</div></header>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${n("אחרי")}</b><small>${n("קריטי בלי אישור")}</small></div><div class="r"><span class="stp"><button type="button" data-esc-step="-1" aria-label=${n("פחות")} @click=${()=>this.patchSettings({escalation:$s(e,-1)})}>${c("minus")}</button><span class="vv" data-esc-min><span class="n">${e.after_min}</span><small>${n("דק׳")}</small></span><button type="button" data-esc-step="1" aria-label=${n("יותר")} @click=${()=>this.patchSettings({escalation:$s(e,1)})}>${c("plus")}</button></span></div></div>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${n("שלבים")}</b></div><div class="r"><sw-segmented size="sm" label=${n("שלבים")} value=${String(e.steps)} @change=${o=>i({steps:Number(o.detail.value)})}
        .options=${[1,2,3].map(o=>({value:String(o),label:String(o),attrs:{"data-esc-steps":String(o)}}))}></sw-segmented></div></div>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${n("אל")}</b></div><div class="r"><sw-segmented size="sm" label=${n("אל")} value=${a?"users":"managers"} @change=${o=>o.detail.value==="users"?this.openPicker("esc"):i({to:"managers"})}
        .options=${[{value:"managers",label:n("מנהלי התראות"),attrs:{"data-esc-to":"managers"}},{value:"users",label:n("משתמשים נבחרים"),attrs:{"data-esc-to":"users"}}]}></sw-segmented>${a?l`<span class="tag" data-esc-names>${this.nameOf(e.to)}</span>`:u}</div></div>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${n("נעצרת באישור")}</b></div><div class="r"><span class="tag ok">${c("lock")}${n("תמיד")}</span></div></div>
      ${this.invalid==="escalation_invalid"?l`<div class="errline" data-set-error>${as.escalation_invalid}</div>`:u}
      <div class="escprev ${t?"dis":""}" data-esc-preview><div class="tl">${r.map(o=>l`<div class="ev ${o.kind}"><span class="t">${o.clock}</span><span class="d"><i></i></span><span class="b"><b>${o.title}</b><small>${o.sub}</small></span></div>`)}</div></div></section>`}lockPhone(s,e){const t=Ae(s,this.tz);return l`<div class=${xs({lphone:!0,sel:e})} data-lock-phone=${s} data-lock-selected=${String(e)}><span class="notch"></span><span class="llabel">${c("lock")}${ys[s]}</span>
      <div class="ltime n">14:10</div><div class="ldate">${n("יום רביעי, 1 באוקטובר")}</div>
      <div class="lcards">${(s==="generic"?t.slice(0,1):t).map(a=>l`<div class="pushcard" data-push-card><div class="ph"><span class="app">S</span>Arx<span class="ago">${a.ago}</span></div><b>${a.title}</b><p>${a.body}</p>
        <div class="acts">${a.actions.map(i=>l`<span class=${i.id==="open_door"?"door":""}>${c(i.id==="open"?"open":i.id==="ack"?"checkAll":i.id==="snooze"?"snooze":"doorOpen")}${i.label}</span>`)}</div></div>`)}</div></div>`}renderLock(){const s=this.settings;return l`<section class="glass sec" data-set-section="lock" id="sec-lock"><header><h2>${c("lock")}${S[3].label}</h2></header>
      <div class="frow"><div class="l"><b>${n("רמת פירוט")}</b></div><div class="r"><sw-segmented label=${n("רמת פירוט")} value=${s.lockscreen} @change=${e=>this.patchSettings({lockscreen:e.detail.value})}
        .options=${Pe.map(e=>({value:e,label:ys[e],attrs:{"data-lock-level":e}}))}></sw-segmented></div></div>
      <div class="lockrow" data-lock-preview>${["generic","type_place","full"].map(e=>this.lockPhone(e,s.lockscreen===e))}</div>
      <div class="frow dis"><div class="l"><b>${n("תמונה מהמצלמה בהתראה")}</b><small>${n("התמונה נפתחת רק בתוך Arx")}</small></div><div class="r"><span class="tag soon">${n("בקרוב")}</span>${this.tog(!1,"image-in-push",n("תמונה בהתראה"),()=>{},!0)}</div></div>
      <div class="frow dis"><div class="l"><b>${n('צליל קריטי שעוקף "נא לא להפריע"')}</b><small>${n("בטיחות בלבד · טלפוני Companion")}</small></div><div class="r"><span class="tag soon">${n("בקרוב")}</span>${this.tog(s.companion.critical_sound_safety,"critical-sound",n("צליל קריטי"),()=>{},!0)}</div></div></section>`}renderKeep(){const s=this.settings;return l`<section class="glass sec" data-set-section="keep" id="sec-keep"><header><h2>${c("calendar")}${S[4].label}</h2></header>
      <div class="frow"><div class="l"><b>${n("התראות")}</b></div><div class="r"><sw-segmented size="sm" label=${n("שמירת התראות")} value=${String(s.retention_days)} @change=${e=>this.patchSettings({retention_days:Number(e.detail.value)})}
        .options=${Le.map(e=>({value:String(e),label:String(e),attrs:{"data-keep":String(e)}}))}></sw-segmented><span>${n("ימים")}</span></div></div>
      <div class="frow"><div class="l"><b>${n("יומן מסירה")}</b></div><div class="r"><span class="tag"><span class="n">${s.deliveries_retention_days}</span> ${n("ימים")}</span></div></div></section>`}renderMail(){const s=this.settings,e=this.mail,t=s.email,a=r=>this.mail={...this.mail,...r},i=this.mailResult?this.mailResult.ok?l`<span class="tag ok" data-mail-result="ok">${c("check")}${ks(this.mailResult)}</span>`:l`<span class="tag bad" data-mail-result="bad">${c("warning")}${ks(this.mailResult)}</span>`:t.last_test?l`<span class="tag ${t.last_test.ok?"ok":"bad"}" data-mail-last>${c(t.last_test.ok?"check":"warning")}${t.last_test.ok?`${n("נבדק {time}",{time:Re(t.last_test.at,this.tz)})} · ${n("תקין")}`:`${n("הבדיקה נכשלה")} · ${t.last_test.detail}`}</span>`:l`<span class="tag" data-mail-last>${t.configured?n("לא נבדק"):n("לא מוגדר")}</span>`;return l`<section class="glass sec" data-set-section="mail" id="sec-mail"><header><h2>${c("mail")}${S[5].label}</h2><div class="sp">${i}</div></header>
      <div class="fgrid">
        <label>${n("שרת")}<input class="inp ltr" data-mail-host .value=${e.host} @input=${r=>a({host:r.target.value})} /></label>
        <label>${n("פורט")}<input class="inp ltr" inputmode="numeric" data-mail-port .value=${e.port} @input=${r=>a({port:r.target.value})} /></label>
        <label>${n("אבטחה")}<sw-field><select class="inp" data-mail-security @change=${r=>a({security:r.target.value})}>${["starttls","tls","none"].map(r=>l`<option value=${r} .selected=${e.security===r}>${r==="none"?n("ללא"):r==="tls"?"TLS":"STARTTLS"}</option>`)}</select></sw-field></label>
        <label>${n("משתמש")}<input class="inp ltr" data-mail-user .value=${e.user} @input=${r=>a({user:r.target.value})} /></label>
        <label>${n("סיסמה")}<span style="display:flex;gap:8px"><input class="inp ltr" type="password" autocomplete="new-password" data-mail-password style="flex:1" .value=${e.pwEdit?e.password:"••••••••••"} ?readonly=${!e.pwEdit} @input=${r=>a({password:r.target.value})} />${t.password_set&&!e.pwEdit?l`<button type="button" class="btn quiet sm" data-mail-pw-change @click=${()=>a({pwEdit:!0,password:""})}>${n("החלפה")}</button>`:u}</span></label>
        <label>${n("מאת")}<input class="inp ltr" data-mail-from .value=${e.from} @input=${r=>a({from:r.target.value})} /></label>
        <label class="w2">${n("נמענים")}<input class="inp ltr" data-mail-recipients .value=${e.recipients} @input=${r=>a({recipients:r.target.value})} /></label>
        <label class="w2">${n("כתובת Arx לקישור")}<input class="inp ltr" data-mail-linkbase placeholder="https://" .value=${e.linkBase} @input=${r=>a({linkBase:r.target.value})} /></label>
      </div>
      ${this.mailError?l`<div class="errline" data-mail-error role="alert">${this.mailError}</div>`:u}
      <div class="frow mailfoot"><button type="button" class="btn quiet" data-mail-test ?disabled=${this.mailBusy!==null||!t.configured} @click=${()=>void this.testMail()}>${c(this.mailBusy==="test"?"refresh":"send")}${this.mailBusy==="test"?n("שולח…"):n("שליחת בדיקה")}</button><button type="button" class="btn primary" data-mail-save ?disabled=${this.mailBusy!==null} @click=${()=>void this.saveMail()}>${n("שמירה")}</button></div></section>`}renderWa(){return l`<div data-set-section="wa" id="sec-wa"><notify-whatsapp-section section-id="wa-inner" @notify-saved=${s=>{this.say(s.detail.text),R().view().then(e=>this.wa=e).catch(()=>{}),this.renderRoot.querySelectorAll("notify-whatsapp-mine").forEach(e=>e.reload())}}></notify-whatsapp-section></div>`}renderChannels(){const s=this.settings,e=is("webpush",s,this.devices),t=is("email",s,this.devices),a=is("whatsapp",s,this.devices,this.wa?{enabled:this.wa.enabled,mapped:this.wa.account.mapped}:null),i=Ne(this.policies),r=(o,m)=>l`<span class="tag ${o==="on"||o==="always"?"ok":o==="soon"?"soon":""}">${o==="on"||o==="always"?n("פעיל"):m}</span>`;return l`<section class="glass sec" data-set-section="chan" id="sec-chan"><header><h2>${c("phone")}${S[7].label}</h2></header>
      <div class="frow"><div class="l"><b>${n("מרכז ההתראות במחשב")}</b></div><div class="r"><sw-segmented size="sm" label=${n("מרכז ההתראות במחשב")} value=${s.center_layout} @change=${o=>this.patchSettings({center_layout:o.detail.value})}
        .options=${Ie.map(o=>({value:o,label:He[o],attrs:{"data-layout":o}}))}></sw-segmented></div></div>
      <div class="chgrid">
        <div class="chc" data-channel="inbox"><span class="ring">${c("inbox")}</span><b>${n("מרכז ההתראות")}</b><small>${n("פעיל תמיד · לכל המשתמשים")}</small>${r("always","")}</div>
        <div class="chc" data-channel="webpush"><span class="ring">${c("phone")}</span><b>${n("דחיפה (Arx)")}</b><small>${e.state==="on"?n("{n} מכשירים רשומים אצלך",{n:this.devices}):e.text}</small>${r(e.state,e.text)}</div>
        <div class="chc" data-channel="email"><span class="ring">${c("mail")}</span><b>${n('דוא"ל')}</b><small>${t.state==="on"?n("תקלות מערכת וגיבויים"):n("לא מוגדר")}</small>${r(t.state,t.text)}</div>
        <div class="chc" data-channel="app"><span class="ring">${c("phone")}</span><b>${n("אפליקציה לנייד")}</b><small>${n("לפי המכשירים שנרשמו באפליקציה · שעות השקט כמו דחיפה")}</small>${r("on","")}</div>
        <div class="chc soon" data-channel="ha_mobile"><span class="ring">${c("phone")}</span><b>Companion</b><small>${n("טלפונים לפי משתמש")}</small><span class="tag soon">${n("בקרוב")}</span></div>
        <div class="chc" data-channel="whatsapp"><span class="ring">${c("chat")}</span><b>WhatsApp</b><small>${a.text}</small>${r(a.state,a.text)}</div>
        <div class="chc" data-channel="announce"><span class="ring">${c("horn")}</span><b>${T.announce}</b><small>${i.state==="on"?i.text:n("נשמעת ברמקול שנבחר בהגדרות ההכרזות")}</small>${r(i.state,i.text)}</div>
      </div>
      <div class="devbox"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></div></section>`}renderLog(){const s=De(this.stats),e=Me(this.log,this.onlyFailed),t=Be(this.log);return l`<section class="glass sec" data-set-section="log" id="sec-log"><header><h2>${c("inbox")}${S[8].label}</h2><div class="sp"><span class="tag" data-log-window>${Ot()}</span><sw-segmented size="sm" label=${n("סינון היומן")} value=${this.onlyFailed?"failed":"all"} @change=${a=>this.onlyFailed=a.detail.value==="failed"}
        .options=${[{value:"all",label:n("הכל"),attrs:{"data-log-filter":"all"}},{value:"failed",label:n("רק כשלים"),count:t||void 0,attrs:{"data-log-filter":"failed"}}]}></sw-segmented></div></header>
      <div class="fails" data-fail-panel>${s.map(a=>l`<div class="fstat ${a.tone}" data-fail-card=${a.channel}><span class="ch">${a.label} · ${n("24 שעות")}</span><b class="n">${a.failed>0?a.failed:a.sent}</b><small>${a.failed>0?n("נכשלו"):n("נשלחו")}${a.skipped?` · ${n("{n} לא נשלחו",{n:a.skipped})}`:""}</small></div>`)}</div>
      <sw-table static-rows data-log-table .columns=${this.logColumns()} .rows=${e}
        .rowAttrs=${a=>({"data-log-row":String(a.id),"data-log-status":String(a.status)})}><div slot="empty" class="lg-empty" data-log-empty>${n("אין רשומות")}</div></sw-table></section>`}logColumns(){const s=t=>Qe(t.reason)||"—",e=t=>this.titles[t.notification_id]??"—";return[{key:"at",label:n("שעה"),kind:"muted",render:t=>Ue(t.at,this.now,this.tz)},{key:"title",label:n("התראה"),kind:"truncate",cellTitle:e,render:e},{key:"user",label:n("משתמש"),render:t=>t.user_display},{key:"channel",label:n("ערוץ"),render:t=>T[t.channel]},{key:"status",label:n("מצב"),kind:"status",render:t=>l`<span class="chip" data-tone=${Et[t.status]??u}>${je[t.status]}</span>`},{key:"reason",label:n("סיבה"),kind:"truncate",cellTitle:s,render:s}]}renderPicker(){const s=this.picker;if(!s)return u;const e=this.users;return l`<sw-dialog open heading=${n("משתמשים נבחרים")} data-user-picker @close=${()=>this.picker=null}>
      ${e&&e.length?l`<div class="pick" role="group">${e.map(t=>l`<button type="button" role="checkbox" aria-checked=${String(s.selected.includes(t.id))} data-pick=${t.id} @click=${()=>this.picker={...s,selected:s.selected.includes(t.id)?s.selected.filter(a=>a!==t.id):[...s.selected,t.id]}}><span class="chk" aria-hidden="true" data-on=${String(s.selected.includes(t.id))} style=${s.selected.includes(t.id)?"background:var(--dv-accent);border-color:transparent":""}>${c("check")}</span>${t.name}</button>`)}</div>`:l`<div class="errline">${n("רשימת המשתמשים לא זמינה")}</div>`}
      <button slot="footer" type="button" class="btn quiet" @click=${()=>this.picker=null}>${n("ביטול")}</button>
      <button slot="footer" type="button" class="btn primary" data-pick-save ?disabled=${!s.selected.length} @click=${()=>this.savePicker()}>${n("שמירה")}</button>
    </sw-dialog>`}renderBody(){if(this.phase==="loading")return l`<div class="skbox" data-set-state="loading" aria-busy="true"><span class="skl"></span><span class="skl"></span><span class="skl"></span></div>`;if(this.phase==="error")return l`<div class="errbar" role="alert" data-set-state="error">${c("warning")}<span>${this.error||n("לא ניתן לטעון את ההגדרות")}</span><button type="button" class="btn sm" data-set-retry @click=${()=>void this.load()}>${c("refresh")}${n("נסה שוב")}</button></div>`;if(this.phase==="user")return l`<div class="secs" data-set-state="user"><section class="glass sec"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></section></div>`;const s={sources:()=>this.renderSources(),quiet:()=>this.renderQuiet(),esc:()=>this.renderEsc(),lock:()=>this.renderLock(),keep:()=>this.renderKeep(),mail:()=>this.renderMail(),wa:()=>this.renderWa(),chan:()=>this.renderChannels(),log:()=>this.renderLog()};return l`<div class="set" data-set-state="ready"><sw-tabs variant="underline" class="settabs" data-set-tabs group-label=${n("מדורים")} panel="set-panel" .items=${S.map(e=>({id:e.id,label:e.label}))} .active=${this.sec} @change=${e=>this.setSec(e.detail.id)}></sw-tabs>
      <div class="secs" id="set-panel" data-set-panel=${this.sec}>${s[this.sec]()}</div></div>`}render(){return l`<sw-page class="page" heading=${n("התראות")} crumbs=${n("מערכת")} data-notify-settings data-phase=${this.phase}>
      ${this.renderBody()}
    </sw-page>
    ${this.renderPicker()}
    ${this.toast?l`<div class="toast ${this.toast.bad?"bad":""}" role="status" data-set-toast ${Fe()}>${c(this.toast.bad?"warning":"check")}${this.toast.text}</div>`:u}`}};b.styles=[Ze,ps,Xe,hs,us,D`
      :host {
        --nt-sheet-w: 480px;
        /* COLOR-LITERAL-A-2480: the lock-screen preview's inner bezel ring, written once (the same literal) */
        --nt-bezel-ring: rgba(255, 255, 255, 0.08);
      }
      /* AUDIT30-I4 / I6: the page frame is sw-page (its title, its crumb); the media page keeps its inline padding */
      sw-page.page {
        padding-block-start: var(--sw-s-4);
      }
      .set {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-4);
        min-inline-size: 0;
      }
      .settabs {
        align-self: stretch;
      }
      /* POLISH4-WP8: hover washes only on a fine pointer (they stuck after a tap on a tablet); a key gives on pointer-down */
      @media (hover: hover) and (pointer: fine) {
        .pick button:hover {
          background: var(--dv-surface-3);
        }
      }
      .pick button,
      .sevseg button,
      button.chip {
        transition: background-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      }
      .pick button:active {
        background: var(--dv-surface-3);
      }
      .sevseg button:active:not(:disabled),
      button.chip:active:not(:disabled) {
        transform: scale(var(--sw-press-scale));
      }
      @media (prefers-reduced-motion: reduce) {
        .pick button,
        .sevseg button,
        button.chip {
          transition-duration: 0ms;
        }
        .sevseg button:active:not(:disabled),
        button.chip:active:not(:disabled) {
          transform: none;
        }
      }
      /* owner Q7: the outgoing-mail form saves on its own row; on a phone that row stays in view while the form scrolls under it */
      .frow.mailfoot {
        border-block-start: 0;
        justify-content: flex-end;
        gap: 8px;
      }
      @media (max-width: 767px) {
        .frow.mailfoot {
          position: sticky;
          inset-block-end: var(--sw-s-2);
          z-index: 3;
          padding: 10px var(--sw-s-2);
          border: 1px solid var(--sw-border-strong);
          border-radius: var(--sw-r-lg);
          background: var(--sw-surface-solid);
          box-shadow: var(--sw-shadow-3);
        }
      }
      .secs {
        display: flex;
        flex-direction: column;
        gap: 18px;
        min-inline-size: 0;
      }
      .sec {
        padding: var(--dv-card-pad-block) var(--dv-card-pad-inline);
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-inline-size: 0;
        scroll-margin-block-start: 20px;
      }
      .sec header {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      /* R5-SYSTEM-297: a section title at the card-title step of the ladder (20/700), its rows with a 15/600 label */
      .sec header h2 {
        margin: 0;
        font-size: var(--sw-fs-2xl);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .sec header h2 .ic {
        font-size: var(--sw-fs-2xl);
        color: var(--dv-text-2);
      }
      .sec header .sp {
        margin-inline-start: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .frow {
        display: flex;
        align-items: center;
        gap: 14px;
        min-block-size: 52px;
        padding: 4px 0;
        border-block-start: 1px solid var(--dv-border);
        flex-wrap: wrap;
      }
      .sec header + .frow {
        border-block-start: 0;
      }
      .frow .l {
        flex: 1 1 180px;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }
      .frow .l b {
        font-size: var(--sw-fs-lg);
        font-weight: var(--sw-fw-semibold);
        letter-spacing: -0.005em;
      }
      .frow .l small {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
      }
      .frow .r {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .frow.dis .l {
        opacity: 0.55;
      }
      .frow.dis .r {
        opacity: 0.55;
        pointer-events: none;
      }
      .fgrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px 14px;
      }
      .fgrid label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--dv-text-2);
        min-inline-size: 0;
      }
      .fgrid label.w2 {
        grid-column: span 2;
      }
      .errline {
        color: var(--dv-danger);
        font-size: var(--sw-fs-base);
        font-weight: var(--sw-fw-semibold);
      }
      /* the sources matrix */
      .mxw {
        overflow-x: auto;
      }
      .mx {
        inline-size: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: var(--sw-fs-base);
        table-layout: fixed;
        min-inline-size: 860px;
      }
      .mx th {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--dv-text-3);
        text-align: start;
        padding: 8px;
        background: var(--nt-matrix-head);
        border-block-end: 1px solid var(--dv-border);
        white-space: nowrap;
      }
      .mx th:first-child {
        border-start-start-radius: var(--sw-r-sm);
      }
      .mx th:last-child {
        border-start-end-radius: var(--sw-r-sm);
      }
      .mx th.c,
      .mx td.c {
        text-align: center;
      }
      .mx td {
        padding: 6px 8px;
        border-block-end: 1px solid var(--dv-border);
        vertical-align: middle;
        block-size: 56px;
      }
      /* NATIVE-SELECT-A-2480: the select sits in sw-field; its block padding stays the browser's 0 (the field's 5 px would make it taller) */
      select.inp {
        padding-block: 0;
      }
      /* NATIVE-SELECT-A-2480: the recipient select sits in the shared field; the field keeps the select's own width in the cell */
      .mx td > sw-field {
        display: inline-flex;
        max-inline-size: 100%;
      }
      .mx tr:last-child td {
        border-block-end: 0;
      }
      .mx tr.cat td {
        background: transparent;
        border-block-end: 0;
        padding: 16px 8px 6px;
        font-weight: var(--sw-fw-bold);
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        letter-spacing: 0.02em;
        block-size: auto;
      }
      .mx tr.cat td .ic {
        font-size: var(--sw-fs-md);
        vertical-align: -2px;
        margin-inline-end: 6px;
      }
      .mx tr.off td:not(.keep) {
        opacity: 0.45;
      }
      .nm {
        display: flex;
        align-items: center;
        gap: 10px;
        min-inline-size: 0;
      }
      .nm .ring {
        inline-size: 32px;
        block-size: 32px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        display: grid;
        place-items: center;
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      .nm b {
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-base);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sevseg {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        border-radius: var(--sw-r-pill);
        background: var(--dv-surface-3);
      }
      .sevseg button {
        border: 0;
        background: transparent;
        border-radius: var(--sw-r-pill);
        block-size: 40px;
        min-inline-size: 36px;
        padding: 0 10px;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--dv-text-2);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      /* AUDIT30-I1 (#3): left as the segmented thumb on purpose - measured readable in dark (label 15.6:1, key 11.3:1 from its track,
         tests/evidence-sys-audit-quickfix-2437.spec.ts); the Blue Wash pair would fall under the owner-approved DARK-SEG-ALL-2380 rule
         (the chosen key at least 3:1 from its track). Recorded in docs/changes/AUDIT30-I-DEVICES.md. */
      .sevseg button[aria-checked='true'] {
        background: var(--mm-seg-thumb);
        color: var(--mm-seg-fg-on, var(--dv-text));
        box-shadow: var(--dv-shadow-control);
      }
      .sevseg button i {
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        background: var(--sev);
      }
      .chs {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        flex-wrap: nowrap;
      }
      /* RESPONSE-HINTS-2480 (owner decision, option ב): in the sources matrix the channel chips wrap inside their cell (two lines),
         so no channel (WhatsApp, Companion, הכרזה) hides behind a sideways scroll of the table at 1280-1920 px */
      .mx td .chs {
        flex-wrap: wrap;
        max-inline-size: 100%;
        padding-block: 4px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        block-size: 40px;
        padding: 0 11px;
        border-radius: var(--sw-r-pill);
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-2);
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--dv-text-2);
        white-space: nowrap;
      }
      .chip .ic {
        font-size: var(--sw-fs-md);
      }
      .chip[aria-pressed='true'] {
        background: var(--dv-accent-soft);
        border-color: transparent;
        color: var(--dv-accent-text);
      }
      .chip.lock {
        background: var(--dv-neutral-soft);
        color: var(--dv-text-2);
        border-color: transparent;
      }
      .chip.soon {
        border-style: dashed;
        inline-size: 40px;
        padding: 0;
        justify-content: center;
        opacity: 0.55;
      }
      .chip.unconf {
        border-style: dashed;
      }
      .scards {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .scard {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-radius: var(--sw-r-2xl);
      }
      .scard .top {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .scard .top b {
        flex: 1;
        min-inline-size: 0;
        font-weight: var(--sw-fw-semibold);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .scard .ln {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .scard .ln > small {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-3);
        font-weight: var(--sw-fw-semibold);
        min-inline-size: 52px;
      }
      .scard.off .ln {
        opacity: 0.45;
      }
      /* UXFIX-A11Y-295 (UX audit 2026-10-20, finding 13): on a phone the channel chips ran off both edges of the card (one nowrap row)
         and the severity picker showed two of its three levels as a colour dot only. Every level now carries its name (above, in
         sevSeg), the rows wrap inside the card, and the keys are 44 px. */
      .scard .ln > .chs,
      .scard .ln > .sevseg {
        flex-wrap: wrap;
        min-inline-size: 0;
        max-inline-size: 100%;
      }
      .scard .ln > .sevseg {
        border-radius: var(--sw-r-xl);
      }
      @media (pointer: coarse), (max-width: 767px) {
        .sevseg button,
        .chip {
          block-size: 44px;
        }
      }
      /* release 2.10.0: since every severity level carries its name (finding 13) the three keys did not fit the 15 % column of the
         desktop table and ran under the recipient select. The column is wider, the keys are compact there, and as a last
         resort the picker wraps inside its cell instead of overlapping the next one. */
      .mx .sevseg {
        flex-wrap: wrap;
        max-inline-size: 100%;
      }
      .mx .sevseg button {
        padding: 0 6px;
        gap: 4px;
      }
      /* quiet hours matrix */
      .qmx {
        inline-size: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: var(--sw-fs-base);
      }
      .qmx th,
      .qmx td {
        padding: 6px 8px;
        border-block-end: 1px solid var(--dv-border);
        text-align: center;
      }
      .qmx td {
        block-size: 52px;
      }
      .qmx th {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--dv-text-3);
        background: var(--nt-matrix-head);
      }
      .qmx td:first-child,
      .qmx th:first-child {
        text-align: start;
      }
      .qmx tr:last-child td {
        border-block-end: 0;
      }
      .qmx .sv {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: var(--sw-fw-semibold);
      }
      .qmx .sv i {
        inline-size: 10px;
        block-size: 10px;
        border-radius: 50%;
        background: var(--sev);
      }
      .qmx td .chk {
        margin-inline: auto;
      }
      .escprev {
        padding: 12px 14px;
        border-radius: var(--sw-r-lg);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
      }
      .escprev.dis {
        opacity: 0.5;
      }
      .escprev .tl .ev {
        min-block-size: 40px;
      }
      /* the lock screens */
      .lockrow {
        display: flex;
        gap: 18px;
        justify-content: center;
        flex-wrap: wrap;
        padding: 6px 0;
      }
      .lphone {
        position: relative;
        inline-size: 250px;
        block-size: 500px;
        border-radius: 34px;
        overflow: hidden;
        background: radial-gradient(500px 340px at 20% -10%, #8fb4ff 0%, transparent 60%), radial-gradient(420px 300px at 100% 100%, #ffb36b 0%, transparent 55%), linear-gradient(180deg, #1b2a4a, #0b1020);
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35), inset 0 0 0 7px var(--sw-video-bg), inset 0 0 0 8px var(--nt-bezel-ring);
        color: var(--sw-on-video);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 14px;
        opacity: 0.72;
        transition: opacity var(--mm-motion), transform var(--mm-motion) var(--mm-ease);
      }
      .lphone.sel {
        opacity: 1;
        transform: translateY(-4px);
        box-shadow: 0 22px 54px rgba(0, 0, 0, 0.42), inset 0 0 0 7px var(--sw-video-bg), inset 0 0 0 8px var(--nt-bezel-ring), 0 0 0 3px var(--dv-accent);
      }
      :host([data-devices-scheme='dark']) .lphone {
        background: radial-gradient(500px 340px at 20% -10%, #2a3f6e 0%, transparent 60%), radial-gradient(420px 300px at 100% 100%, #5a3a16 0%, transparent 55%), linear-gradient(180deg, #0a0d16, #000);
      }
      .lphone .notch {
        inline-size: 82px;
        block-size: 24px;
        background: var(--sw-video-bg);
        border-radius: 0 0 var(--sw-r-lg) var(--sw-r-lg);
        margin-block-start: 7px;
        flex: none;
      }
      .lphone .llabel {
        margin-block-start: 12px;
        block-size: 24px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.45);
        color: var(--sw-on-video);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-semibold);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid rgba(255, 255, 255, 0.14);
      }
      .lphone.sel .llabel {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
      }
      .lphone .ltime {
        margin-block-start: 8px;
        font-size: 54px;
        font-weight: var(--sw-fw-semibold);
        letter-spacing: -0.04em;
        line-height: 1;
        direction: ltr;
        font-variant-numeric: tabular-nums;
      }
      .lphone .ldate {
        font-size: var(--sw-fs-base);
        font-weight: var(--sw-fw-medium);
        opacity: 0.9;
        margin-block-start: 4px;
      }
      .lphone .lcards {
        inline-size: 100%;
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-block-start: 18px;
      }
      .pushcard {
        inline-size: 100%;
        background: rgba(255, 255, 255, 0.78);
        color: var(--sw-text);
        border-radius: var(--sw-r-lg);
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-family: var(--dv-font);
        -webkit-backdrop-filter: var(--sw-perf-blur, blur(30px));
        backdrop-filter: var(--sw-perf-blur, blur(30px));
        border: 1px solid rgba(255, 255, 255, 0.6);
      }
      :host([data-devices-scheme='dark']) .pushcard {
        background: rgba(44, 44, 46, 0.72);
        color: #f5f5f7;
        border-color: rgba(255, 255, 255, 0.12);
      }
      .pushcard .ph {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--sw-fs-2xs);
        color: var(--sw-text-3);
      }
      :host([data-devices-scheme='dark']) .pushcard .ph {
        color: rgba(235, 235, 245, 0.64);
      }
      .pushcard .ph .app {
        inline-size: 16px;
        block-size: 16px;
        border-radius: var(--sw-r-2xs);
        background: var(--sw-accent);
        color: var(--sw-text-inverse);
        font-weight: 800;
        font-size: var(--sw-fs-2xs);
        display: grid;
        place-items: center;
      }
      .pushcard .ph .ago {
        margin-inline-start: auto;
        font-variant-numeric: tabular-nums;
      }
      .pushcard b {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-bold);
        line-height: 1.25;
      }
      .pushcard p {
        margin: 0;
        font-size: var(--sw-fs-xs);
        color: #3a3a3c;
        line-height: 1.3;
      }
      :host([data-devices-scheme='dark']) .pushcard p {
        color: rgba(235, 235, 245, 0.76);
      }
      .pushcard .acts {
        display: flex;
        gap: 4px;
        margin-block-start: 2px;
        flex-wrap: wrap;
      }
      .pushcard .acts span {
        block-size: 24px;
        padding: 0 8px;
        border-radius: 999px;
        background: rgba(120, 120, 128, 0.14);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--sw-fs-2xs);
        font-weight: var(--sw-fw-semibold);
      }
      :host([data-devices-scheme='dark']) .pushcard .acts span {
        background: rgba(235, 235, 245, 0.14);
      }
      .pushcard .acts span .ic {
        font-size: var(--sw-fs-xs);
      }
      .pushcard .acts span.door .ic {
        color: var(--nt-sev-alert);
      }
      /* the log: CR-CMP2-TABLES-REST-2470 (owner N10) the shared table in its own frame (the module's border and header band); the
         notification and reason columns are cut with an ellipsis (their full text is the cell's title), never wider than the section */
      sw-table[data-log-table] {
        --sw-table-min: 0;
        --sw-table-head-bg: var(--nt-matrix-head);
        --sw-table-cell-pad: 9px 8px;
        border-color: var(--dv-border);
        border-radius: var(--sw-r-lg);
        box-shadow: none;
      }
      .lg-empty {
        text-align: center;
        padding: 18px;
        color: var(--dv-text-3);
      }
      .fails {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
      }
      .fstat {
        padding: 12px 14px;
        border-radius: var(--sw-r-lg);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .fstat b {
        font-size: var(--sw-fs-3xl);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }
      .fstat.bad b {
        color: var(--dv-danger);
      }
      .fstat small {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
      }
      .fstat .ch {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-3);
        font-weight: var(--sw-fw-semibold);
      }
      .chgrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      .chc {
        padding: 14px;
        border-radius: var(--sw-r-2xl);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-block-size: 120px;
      }
      .chc .ring {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        display: grid;
        place-items: center;
        font-size: var(--sw-fs-2xl);
      }
      .chc b {
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-bold);
      }
      .chc small {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
      }
      .chc.soon {
        border-style: dashed;
        opacity: 0.8;
      }
      .chc .tag {
        align-self: flex-start;
      }
      .devbox {
        border-block-start: 1px solid var(--dv-border);
        padding-block-start: 12px;
      }
      .skbox {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .skbox .skl {
        block-size: 160px;
        border-radius: var(--dv-radius-md);
      }
      .pick {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pick button {
        display: flex;
        align-items: center;
        gap: 12px;
        min-block-size: 44px;
        padding: 0 10px;
        border: 0;
        background: transparent;
        border-radius: var(--sw-r-md);
        text-align: start;
        font-size: var(--sw-fs-md);
      }
      @media (max-width: 1099px) {
        .fgrid label.w2 {
          grid-column: span 1;
        }
        .lphone:not(.sel) {
          display: none;
        }
        .lphone {
          opacity: 1;
        }
      }
    `];f([Z()],b.prototype,"section",2);f([h()],b.prototype,"phase",2);f([h()],b.prototype,"error",2);f([h()],b.prototype,"settings",2);f([h()],b.prototype,"policies",2);f([h()],b.prototype,"stats",2);f([h()],b.prototype,"log",2);f([h()],b.prototype,"titles",2);f([h()],b.prototype,"users",2);f([h()],b.prototype,"devices",2);f([h()],b.prototype,"wa",2);f([h()],b.prototype,"onlyFailed",2);f([h()],b.prototype,"sec",2);f([h()],b.prototype,"phone",2);f([h()],b.prototype,"toast",2);f([h()],b.prototype,"invalid",2);f([h()],b.prototype,"mail",2);f([h()],b.prototype,"mailBusy",2);f([h()],b.prototype,"mailResult",2);f([h()],b.prototype,"mailError",2);f([h()],b.prototype,"picker",2);f([h()],b.prototype,"now",2);f([h()],b.prototype,"tz",2);b=f([B("system-notifications")],b);export{b as SystemNotifications};
