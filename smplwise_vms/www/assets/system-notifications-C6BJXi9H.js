const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as K}from"./sw-logo-art-PLtEZJxU.js";import{a2 as z,br as M,b5 as Z,bm as Cs,a as D,bG as B,bH as $s,cE as xs,cC as ys,bg as es,v8 as ts,v9 as as,g as H,ax as ks,j as p,i as j,b as l,va as d,A as b,dI as J,fo as ss,k as F,n as rs,aA as _s,aL as Ts,dF as i,vb as Os,iO as As,vc as ls,vd as Ps,mD as A,ve as Ls,vf as Rs,vg as L,p as Is,vh as Ns,H as Ms,vi as os,vj as Ds,vk as Us,vl as Bs,vm as Q,vn as ds,vo as I,vp as Hs,F as js,y as Fs,vq as Ws,pz as cs,vr as N,vs as q,be as Ks,vt as Qs,vu as Ys,vv as Gs,J as Vs,ek as ps,vw as Xs,vx as Zs,vy as Js,vz as se,vA as ee,vB as te,vC as hs,vD as ae,vE as us,cp as vs,vF as ie,vG as ne,vH as ms,vI as re,vJ as Y,I as le,vK as oe,vL as de,vM as ce,vN as pe,vO as he,vP as ue,vQ as ve,e2 as me,vR as be,vS as bs,vT as ge,vU as fe,vV as we,vW as $e,aU as xe}from"./index-koYOOmpL.js";import{m as ye}from"./media-page-DI1OpmkE.js";import{s as ke}from"./settings-DQrUiMx4.js";import"./lead-reserve-BUUwTwdr.js";const _e={view:()=>Z("notify/whatsapp"),save:s=>M("notify/whatsapp",s),test:()=>Cs("notify/whatsapp/test"),mine:()=>Z("me/notify-whatsapp"),setOptIn:(s,e)=>M("me/notify-whatsapp",s?{opted_in:!0,confirm:e}:{opted_in:!1}),setOptOut:(s,e)=>M("me/notify-whatsapp",s?{opted_in:!1}:{opted_in:!0,confirm:e})};function ze(){let s={enabled:!1,per_user_hour:4,dedupe_min:30,budget_pct:50,budget_critical_pct:80,detail:"type_place",detail_levels:["generic","type_place"],normalized:[],warnings:[],revision:0,ranges:{per_user_hour:[1,30],dedupe_min:[5,1440],budget_pct:[10,90],budget_critical_pct:[10,90]},account:{mapped:!0,label:"וואטסאפ ····0191",state:"connected"},reachable_users:3,accounts_href:"#/system/messaging-accounts",test:{own_number:!0,masked:"····0191"}},e={channel_enabled:!1,has_number:!0,masked:"····0191",source:"directory",opted_in:!1,number_changed:!1,directory_declined:!1,consent:"declined",confirm:"demo0123456789ab",stored_opt_in:!1},t=0;const a=(n,r,o)=>new D(n,{code:r,user_message:o,retryable:n===429,correlation_id:"demo",details:{}});return{view:async()=>structuredClone(s),save:async n=>{if(n.revision!==s.revision)throw a(412,"settings_conflict","ההגדרות השתנו בינתיים; טען מחדש.");const[r,o]=s.ranges.per_user_hour,[v,g]=s.ranges.dedupe_min;if(n.per_user_hour!==void 0&&(n.per_user_hour<r||n.per_user_hour>o)||n.dedupe_min!==void 0&&(n.dedupe_min<v||n.dedupe_min>g))throw a(422,"validation","ערך מספרי מחוץ לטווח.");const f=n.budget_pct??s.budget_pct,_=n.budget_critical_pct??s.budget_critical_pct;if(f<10||f>90||_<10||_>90||_<f)throw a(422,"validation","ערך מספרי מחוץ לטווח.");return s={...s,..."enabled"in n?{enabled:!!n.enabled}:{},...n.per_user_hour!==void 0?{per_user_hour:n.per_user_hour}:{},...n.dedupe_min!==void 0?{dedupe_min:n.dedupe_min}:{},budget_pct:f,budget_critical_pct:_,...n.detail?{detail:n.detail}:{},revision:s.revision+1},e={...e,channel_enabled:s.enabled},structuredClone(s)},test:async()=>{if(!s.account.mapped)throw a(409,"channel_unavailable","לא נבחר חשבון וואטסאפ להתראות.");if(++t>3)throw a(429,"rate_limited","יותר מדי הודעות בדיקה. נסו שוב מאוחר יותר.");return{ok:!0,outcome:"sent",code:null}},mine:async()=>({...e}),setOptIn:async(n,r)=>{if(n&&r!==e.confirm)throw a(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return e={...e,opted_in:n,stored_opt_in:n,number_changed:!1,consent:n&&!e.directory_declined?"granted":"declined"}},setOptOut:async(n,r)=>{if(!n&&r!==e.confirm)throw a(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return e={...e,opted_in:!n,stored_opt_in:!n,number_changed:!1,consent:!n&&!e.directory_declined?"granted":"declined"}}}}let Se=null;const T=()=>z()?_e:Se??=ze(),is={keyUnreadable:"מפתח ההודעות של המערכת לא נקרא - אי אפשר לאמת הסכמות, ולכן לא נשלחות התראות בוואטסאפ",normalized:"ערך שמור לא היה בטווח ותוקן - שמרו כדי לאשר",budget:"חלק מתקציב החשבון",budgetHint:"השאר נשמר להודעות ניהול השירות ולקודי אימות",budgetCritical:"חלק לקריטי",budgetCriticalHint:"קריטי והסלמה רשאים להשתמש עד כאן",detail:"פירוט בהודעה",detailHint:"תוכן ההתראה עצמו לא נשלח לוואטסאפ",detail_generic:"כללי",detail_type_place:"סוג ומקום",mine_title:"וואטסאפ שלי",mine_sub:"התראות לוואטסאפ האישי שלך, רק אם אישרת את המספר בעצמך",mine_number:"המספר",mine_src_directory:"מרשימת אנשי הקשר",mine_src_profile:"מהפרופיל",mine_status:"מצב",mine_on:"מקבל התראות",mine_off:"לא מקבל התראות",mine_changed:"המספר השתנה - אשר מחדש כדי לקבל התראות",mine_declined:"ברשימת אנשי הקשר וואטסאפ אינו הערוץ המועדף",mine_none:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",mine_confirm:"אישור המספר וקבלת התראות",mine_stop:"הפסקת התראות בוואטסאפ",on:"פעיל",off:"כבוי",attention:"דורש טיפול",title:"וואטסאפ",sub:"התראות לטלפון האישי של המשתמש, מהחשבון שנבחר בערוץ ההודעות",enabled:"שליחת התראות בוואטסאפ",enabledHint:"כבוי = שום התראה לא נשלחת בוואטסאפ, גם אם סומנה במדיניות",account:"חשבון שולח",accountNone:"לא נבחר חשבון",accountPick:"בחירת חשבון",st_connected:"מחובר",st_disconnected:"מנותק",st_unknown:"לא ידוע",st_missing:"לא נמצא",reach:"משתמשים עם מספר",reachHint:"מספר מרשימת אנשי הקשר, כשוואטסאפ הוא הערוץ המועדף",cap:"לכל משתמש בשעה",capHint:"התראה קריטית והסלמה אינן נספרות",dedupe:"בלי כפילות במשך",minutes:"דק׳",test:"שליחת בדיקה",testing:"שולח…",testHint:"נשלחת רק למספר שלך ({masked})",testNoNumber:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",testOk:"הודעת הבדיקה נשלחה",testFail:"הבדיקה נכשלה",warnOffAccount:"אין חשבון שולח - ההתראות לא יישלחו",saved:"נשמר",loading:"טוען…",error:"לא ניתן לטעון את הגדרות הוואטסאפ",retry:"נסה שוב",less:"פחות",more:"יותר"},zs=B("en","i18n/notify-whatsapp","en"),Ss=B("ar","i18n/notify-whatsapp","ar"),Es=B("ru","i18n/notify-whatsapp","ru");function R(){return ys(["en","ar","ru"])}const Ee={he:is,en:zs,ar:Ss,ru:Es};function c(s,e,t=R()){const a=Ee[t][s]??is[s]??s;return xs(a,e)}$s("i18n/notify-whatsapp",{he:is,en:zs,ar:Ss,ru:Es});const y={stepCap(s,e){const[t,a]=s.ranges.per_user_hour;return Math.min(a,Math.max(t,s.per_user_hour+e))},warning(s){return s.enabled&&!s.account.mapped?"no_account":null},tone(s){return s.enabled?s.account.mapped&&s.account.state==="connected"?"ok":"bad":"off"},canTest(s){return s.test.own_number&&s.account.mapped},stepPct(s,e,t){const[a,n]=s.ranges[e],r=Math.min(n,Math.max(a,s[e]+t));return e==="budget_pct"?{budget_pct:r,budget_critical_pct:Math.max(r,s.budget_critical_pct)}:{budget_pct:Math.min(s.budget_pct,r),budget_critical_pct:r}},canStop(s){return!!s&&s.channel_enabled&&(s.opted_in||!!s.stored_opt_in)},mineState(s){return!s||!s.channel_enabled?"hidden":s.has_number?s.directory_declined?"declined":s.number_changed?"changed":s.opted_in?"on":"off":"none"}};var qe=Object.defineProperty,Ce=Object.getOwnPropertyDescriptor,O=(s,e,t,a)=>{for(var n=a>1?void 0:a?Ce(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(n=(a?o(e,t,n):o(n))||n);return a&&n&&qe(e,t,n),n};const Te=[5,15,30,60];let k=class extends j{constructor(){super(...arguments),this.sectionId="wa",this.view=null,this.phase="loading",this.busy=!1,this.result=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.phase="loading";try{this.view=await T().view(),this.phase="ready"}catch{this.phase="error"}}errText(s){return s instanceof D?s.body.user_message||s.code:c("error")}async save(s){const e=this.view;if(!(!e||this.busy)){this.view={...e,...s},this.busy=!0,this.error="";try{this.view=await T().save({...s,revision:e.revision}),this.dispatchEvent(new CustomEvent("notify-saved",{bubbles:!0,composed:!0,detail:{text:c("saved")}}))}catch(t){this.error=this.errText(t),await this.load()}finally{this.busy=!1}}}async test(){this.busy=!0,this.result=null;try{const s=await T().test();this.result={ok:s.ok,text:s.ok?c("testOk"):`${c("testFail")} · ${s.code??s.outcome}`}}catch(s){this.result={ok:!1,text:this.errText(s)}}finally{this.busy=!1}}stateTag(s){const e=s.account;if(!e.mapped)return l`<span class="tag bad" data-wa-account-state="none">${c("accountNone")}</span>`;const t=e.state??"unknown";return l`<span class="tag ${t==="connected"?"ok":t==="unknown"?"":"bad"}" data-wa-account-state=${t}>${c(`st_${t}`)}</span>`}render(){const s=R()==="he"||R()==="ar"?"rtl":"ltr";if(this.phase==="loading")return l`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="loading" aria-busy="true" dir=${s}><span class="skl"></span><span class="skl"></span></section>`;if(this.phase==="error"||!this.view)return l`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="error" dir=${s}><div class="warn" role="alert">${d("warning")}${c("error")}</div><div><button type="button" class="btn sm" data-wa-retry @click=${()=>void this.load()}>${d("refresh")}${c("retry")}</button></div></section>`;const e=this.view,t=y.tone(e),a=!e.enabled,n=y.warning(e);return l`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="ready" data-wa-enabled=${String(e.enabled)} dir=${s}>
      <header><h2>${d("chat")}${c("title")}</h2><div class="sp"><sw-toggle .checked=${J(e.enabled)} label=${c("enabled")} labelHidden data-wa-switch ?disabled=${this.busy} @change=${ss(e.enabled,()=>void this.save({enabled:!e.enabled}))}></sw-toggle></div></header>
      <p class="sub">${c("sub")}</p>
      <div class="frow"><div class="l"><b>${c("enabled")}</b><small>${c("enabledHint")}</small></div><div class="r"><span class="tag ${t==="ok"?"ok":t==="bad"?"bad":""}" data-wa-tone=${t}>${d(t==="ok"?"check":t==="bad"?"warning":"moon")}${c(t==="ok"?"on":t==="bad"?"attention":"off")}</span></div></div>
      ${n?l`<div class="warn" role="alert" data-wa-warning=${n}>${d("warning")}${c("warnOffAccount")}</div>`:b}
      ${e.warnings?.includes("messaging_key_unreadable")?l`<div class="warn" role="alert" data-wa-key-warning>${d("warning")}${c("keyUnreadable")}</div>`:b}
      ${e.normalized?.length?l`<div class="warn" role="status" data-wa-normalized=${e.normalized.join(",")}>${d("warning")}${c("normalized")}</div>`:b}
      <div class="frow"><div class="l"><b>${c("account")}</b>${e.account.mapped&&e.account.label?l`<small data-wa-account-label>${e.account.label}</small>`:b}</div><div class="r">${this.stateTag(e)}<a class="lnk" href=${e.accounts_href} data-wa-accounts-link>${c("accountPick")}</a></div></div>
      <div class="frow"><div class="l"><b>${c("reach")}</b><small>${c("reachHint")}</small></div><div class="r"><span class="tag" data-wa-reach><span class="n">${e.reachable_users}</span></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${c("cap")}</b><small>${c("capHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-cap-step="-1" aria-label=${c("less")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:y.stepCap(e,-1)})}>${d("minus")}</button><span class="vv" data-wa-cap><span class="n">${e.per_user_hour}</span></span><button type="button" data-wa-cap-step="1" aria-label=${c("more")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:y.stepCap(e,1)})}>${d("plus")}</button></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${c("dedupe")}</b></div><div class="r"><sw-segmented size="sm" label=${c("dedupe")} value=${String(e.dedupe_min)} ?disabled=${this.busy} @change=${r=>void this.save({dedupe_min:Number(r.detail.value)})}
        .options=${Te.map(r=>({value:String(r),label:`${r} ${c("minutes")}`,attrs:{"data-wa-dedupe":String(r)}}))}></sw-segmented></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${c("detail")}</b><small>${c("detailHint")}</small></div><div class="r"><sw-segmented size="sm" label=${c("detail")} value=${e.detail} ?disabled=${this.busy} @change=${r=>void this.save({detail:r.detail.value})}
        .options=${e.detail_levels.map(r=>({value:r,label:c(`detail_${r}`),attrs:{"data-wa-detail":r}}))}></sw-segmented></div></div>
      ${["budget_pct","budget_critical_pct"].map(r=>l`<div class="frow ${a?"dis":""}"><div class="l"><b>${c(r==="budget_pct"?"budget":"budgetCritical")}</b><small>${c(r==="budget_pct"?"budgetHint":"budgetCriticalHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-budget-step=${`${r}:-10`} aria-label=${c("less")} ?disabled=${this.busy} @click=${()=>void this.save(y.stepPct(e,r,-10))}>${d("minus")}</button><span class="vv" data-wa-budget=${r}><span class="n">${e[r]}</span><small>%</small></span><button type="button" data-wa-budget-step=${`${r}:10`} aria-label=${c("more")} ?disabled=${this.busy} @click=${()=>void this.save(y.stepPct(e,r,10))}>${d("plus")}</button></span></div></div>`)}
      <div class="frow"><div class="l"><b>${c("test")}</b><small data-wa-test-hint>${e.test.own_number?c("testHint",{masked:`⁦${e.test.masked??""}⁩`}):c("testNoNumber")}</small></div><div class="r">${this.result?l`<span class="tag ${this.result.ok?"ok":"bad"}" data-wa-test-result=${this.result.ok?"ok":"bad"}>${d(this.result.ok?"check":"warning")}${this.result.text}</span>`:b}<button type="button" class="btn quiet" data-wa-test ?disabled=${this.busy||!y.canTest(e)} @click=${()=>void this.test()}>${d(this.busy?"refresh":"send")}${this.busy?c("testing"):c("test")}</button></div></div>
      ${this.error?l`<div class="warn" role="alert" data-wa-error>${this.error}</div>`:b}
    </section>`}};k.styles=[es,ts,as,H`
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
    `];O([ks({attribute:"section-id"})],k.prototype,"sectionId",2);O([p()],k.prototype,"view",2);O([p()],k.prototype,"phase",2);O([p()],k.prototype,"busy",2);O([p()],k.prototype,"result",2);O([p()],k.prototype,"error",2);k=O([F("notify-whatsapp-section")],k);var Oe=Object.defineProperty,Ae=Object.getOwnPropertyDescriptor,W=(s,e,t,a)=>{for(var n=a>1?void 0:a?Ae(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(n=(a?o(e,t,n):o(n))||n);return a&&n&&Oe(e,t,n),n};let P=class extends j{constructor(){super(...arguments),this.mine=null,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}reload(){this.load()}async load(){try{this.mine=await T().mine()}catch{this.mine=null}}async set(s){this.busy=!0,this.error="";try{this.mine=await T().setOptIn(s,s?this.mine?.confirm??null:null)}catch(e){this.error=e instanceof D?e.body.user_message||e.code:c("error"),e instanceof D&&e.code==="number_changed"&&this.load()}finally{this.busy=!1}}render(){const s=y.mineState(this.mine);if(s==="hidden")return b;const e=this.mine,t=R()==="he"||R()==="ar"?"rtl":"ltr",a=s==="on"?l`<span class="tag ok" data-wa-mine-status="on">${d("check")}${c("mine_on")}</span>`:s==="changed"?l`<span class="tag bad" data-wa-mine-status="changed">${d("warning")}${c("mine_changed")}</span>`:s==="declined"?l`<span class="tag" data-wa-mine-status="declined">${c("mine_declined")}</span>`:s==="none"?l`<span class="tag" data-wa-mine-status="none">${c("mine_none")}</span>`:l`<span class="tag" data-wa-mine-status="off">${c("mine_off")}</span>`;return l`<div class="box" data-wa-mine data-wa-mine-state=${s} dir=${t}>
      <h3>${d("chat")}${c("mine_title")}</h3>
      <p class="sub">${c("mine_sub")}</p>
      ${e.has_number?l`<div class="row"><b>${c("mine_number")}</b><span class="n" data-wa-mine-number>${e.masked}</span><small>${c(e.source==="profile"?"mine_src_profile":"mine_src_directory")}</small></div>`:b}
      <div class="row"><b>${c("mine_status")}</b>${a}</div>
      ${s==="off"||s==="changed"?l`<div class="acts"><button type="button" class="btn primary sm" data-wa-mine-confirm ?disabled=${this.busy} @click=${()=>void this.set(!0)}>${d("check")}${c("mine_confirm")}</button></div>`:b}
      ${y.canStop(e)?l`<div class="acts"><button type="button" class="btn quiet sm" data-wa-mine-stop ?disabled=${this.busy} @click=${()=>void this.set(!1)}>${c("mine_stop")}</button></div>`:b}
      ${this.error?l`<div class="warn" role="alert" data-wa-mine-error>${this.error}</div>`:b}
    </div>`}};P.styles=[es,ts,as,H`
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
    `];W([p()],P.prototype,"mine",2);W([p()],P.prototype,"busy",2);W([p()],P.prototype,"error",2);P=W([F("notify-whatsapp-mine")],P);const Pe=["push","all"],C={enabled:"quiet.windows.enabled",default_minutes:"quiet.windows.default_minutes",max_minutes:"quiet.windows.max_minutes",mute_alerts:"quiet.windows.mute_alerts",channels:"quiet.windows.channels"},w=[5,720],U={enabled:!1,default_minutes:120,max_minutes:240,mute_alerts:!1,channels:"push"},gs=(s,e)=>{const t=typeof s=="string"&&/^\d+$/.test(s)?Number(s):NaN;return Number.isInteger(t)&&t>=w[0]&&t<=w[1]?t:e};function fs(s){const e=s??{};return{enabled:e[C.enabled]==="on",default_minutes:gs(e[C.default_minutes],U.default_minutes),max_minutes:gs(e[C.max_minutes],U.max_minutes),mute_alerts:e[C.mute_alerts]==="on",channels:e[C.channels]==="all"?"all":"push"}}const G=(s,e)=>{const t=e[s];return typeof t=="boolean"?t?"on":"off":String(t)};function ws(s,e){const t={};for(const a of Object.keys(C))G(a,s)!==G(a,e)&&(t[C[a]]=G(a,e));return t}function V(s){const e=t=>Number.isInteger(t)&&t>=w[0]&&t<=w[1];return!e(s.default_minutes)||!e(s.max_minutes)?"range":s.default_minutes>s.max_minutes?"default_over_max":null}const Le=(s,e)=>s.enabled&&!e.enabled,Re=()=>Z("quiet/settings"),Ie=s=>M("quiet/settings",{changes:s,confirmed:!0}),ns={title:"חלון שקט לקומה או לאזור",sub:"כפתור אחד בכותרת הקומה או האזור משהה התראות מידע לזמן קצוב. התראות קריטיות ובטיחות לא מושהות לעולם.",enabled:"חלון שקט",enabledHint:"כבוי כברירת מחדל. כיבוי מסיים מיד כל חלון פתוח.",off:"כבוי",on:"פעיל",defaultMinutes:"משך ברירת מחדל (דקות)",maxMinutes:"משך מרבי (דקות)",minutesHint:"בין {lo} ל־{hi} דקות",muteAlerts:"להשהות גם התראות חשובות",muteAlertsHint:"כבוי: רק התראות מידע מושהות",channels:"ערוצים שהחלון משהה",channelsHint:'פוש בלבד: הדחיפה לטלפון ולדפדפן מושהית; דוא"ל, WhatsApp והכרזות נשלחים כרגיל. מרכז ההתראות שומר הכל בכל מקרה.',ch_push:"פוש בלבד",ch_all:"כל הערוצים",save:"שמור",saved:"ההגדרות נשמרו",readOnly:"שינוי ההגדרות דורש הרשאת מנהל מערכת.",demo:"נתוני הדגמה: ההגדרות נשמרות רק מול השרת.",errRange:"משך בין {lo} ל־{hi} דקות",errOverMax:"משך ברירת המחדל גדול מהמשך המרבי",confirmTitle:"לשמור את הגדרות חלון השקט?",confirmBody:"השינוי חל מיד על כל הקומות והאזורים.",confirmEnds:"כיבוי החלון מסיים עכשיו כל חלון שקט פתוח.",confirmGo:"שמור",cancel:"ביטול",loadError:"הגדרות חלון השקט לא נטענו"},qs=B("en","i18n/quiet-windows","en"),Ne={he:ns,en:qs};function Me(){return ys(["en"])}function h(s,e,t=Me()){const a=Ne[t][s]??ns[s]??s;return xs(a,e)}$s("i18n/quiet-windows",{he:ns,en:qs});var De=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,S=(s,e,t,a)=>{for(var n=a>1?void 0:a?Ue(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(n=(a?o(e,t,n):o(n))||n);return a&&n&&De(e,t,n),n};let $=class extends j{constructor(){super(...arguments),this.saved=U,this.draft=U,this.loaded=!1,this.busy=!1,this.asking=!1,this.message="",this.error=""}connectedCallback(){if(super.connectedCallback(),!z()){this.loaded=!0;return}Re().then(s=>this.adopt(fs(s.settings))).catch(s=>{this.loaded=!0,this.error=`${h("loadError")}: ${rs(s)}`})}adopt(s){this.saved=s,this.draft={...s},this.loaded=!0}get editable(){return z()&&_s("system.configure")&&this.loaded}set(s){this.draft={...this.draft,...s},this.message="",this.error=""}problemText(){const s=V(this.draft);return s==="range"?h("errRange",{lo:w[0],hi:w[1]}):s==="default_over_max"?h("errOverMax"):""}async save(){this.asking=!1;const s=ws(this.saved,this.draft);if(!(!Object.keys(s).length||V(this.draft))){this.busy=!0,this.error="";try{const e=await Ie(s);this.adopt(fs(e.settings)),this.message=h("saved")}catch(e){this.error=rs(e)}finally{this.busy=!1}}}seg(s,e,t,a,n){const r=this.draft[s];return l`<sw-segmented label=${a} data-qw-seg=${s} value=${String(r)} ?disabled=${n}
      @change=${o=>{const v=e.find(g=>String(g)===o.detail.value);v!==void 0&&this.set({[s]:v})}}
      .options=${e.map(o=>({value:String(o),label:t(o),attrs:{"data-v":String(o)}}))}></sw-segmented>`}minutes(s,e){return l`<sw-field class="ctl"><input type="number" inputmode="numeric" min=${w[0]} max=${w[1]} step="5" data-ltr data-qw-minutes=${s}
      aria-invalid=${String(!!V(this.draft))} .value=${String(this.draft[s])} ?disabled=${e}
      @change=${t=>this.set({[s]:Number(t.target.value)})} /></sw-field>`}render(){const s=!this.editable||this.busy,e=this.draft,t=o=>h(o?"on":"off"),a=Object.keys(ws(this.saved,e)).length>0,n=this.problemText(),r=h("minutesHint",{lo:w[0],hi:w[1]});return l`<div class="card" data-quiet-windows-card>
      <p class="sub">${h("sub")}</p>
      <div class="set-col">
        <div class="row" data-qw-row="enabled"><span class="lbl">${h("enabled")}<span class="muted">${h("enabledHint")}</span></span>${this.seg("enabled",[!1,!0],t,h("enabled"),s)}</div>
        <div class="row" data-qw-row="default"><span class="lbl">${h("defaultMinutes")}<span class="muted">${r}</span></span>${this.minutes("default_minutes",s)}</div>
        <div class="row" data-qw-row="max"><span class="lbl">${h("maxMinutes")}<span class="muted">${r}</span></span>${this.minutes("max_minutes",s)}</div>
        <div class="row" data-qw-row="mute-alerts"><span class="lbl">${h("muteAlerts")}<span class="muted">${h("muteAlertsHint")}</span></span>${this.seg("mute_alerts",[!1,!0],t,h("muteAlerts"),s)}</div>
        <div class="row" data-qw-row="channels"><span class="lbl">${h("channels")}<span class="muted">${h("channelsHint")}</span></span>${this.seg("channels",Pe,o=>h(o==="all"?"ch_all":"ch_push"),h("channels"),s)}</div>
      </div>
      ${n?l`<div class="err" role="alert" data-qw-problem>${n}</div>`:b}
      ${this.editable?l`<div class="foot sticky" data-qw-foot>
            <sw-button variant="primary" size="sm" icon="check" data-qw-save ?disabled=${!a||!!n||this.busy} @click=${()=>this.asking=!0}>${h("save")}</sw-button>
            ${this.message?l`<span class="ok" role="status" data-qw-message>${this.message}</span>`:b}
            ${this.error?l`<span class="err" role="alert" data-qw-error>${this.error}</span>`:b}
          </div>`:l`<div class="muted" data-qw-readonly>${this.error||h(z()?"readOnly":"demo")}</div>`}
      <sw-dialog ?open=${this.asking} heading=${h("confirmTitle")} @close=${()=>this.asking=!1} data-qw-confirm>
        <p>${h("confirmBody")}</p>
        ${Le(this.saved,e)?l`<p class="err" data-qw-confirm-ends>${h("confirmEnds")}</p>`:b}
        <sw-button slot="footer" @click=${()=>this.asking=!1}>${h("cancel")}</sw-button>
        <sw-button slot="footer" variant="primary" data-qw-confirm-go @click=${()=>void this.save()}>${h("confirmGo")}</sw-button>
      </sw-dialog>
    </div>`}};$.styles=[ke,H`
    :host { display: block; }
    .card { display: grid; gap: 0; }
    .sub { margin: 0 0 10px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .ctl input { inline-size: 100%; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
  `];S([p()],$.prototype,"saved",2);S([p()],$.prototype,"draft",2);S([p()],$.prototype,"loaded",2);S([p()],$.prototype,"busy",2);S([p()],$.prototype,"asking",2);S([p()],$.prototype,"message",2);S([p()],$.prototype,"error",2);$=S([F("system-quiet-windows")],$);var Be=Object.defineProperty,He=Object.getOwnPropertyDescriptor,m=(s,e,t,a)=>{for(var n=a>1?void 0:a?He(e,t):e,r=s.length-1,o;r>=0;r--)(o=s[r])&&(n=(a?o(e,t,n):o(n))||n);return a&&n&&Be(e,t,n),n};const x=[{id:"sources",label:i("מקורות והרשאות – מה נשלח"),icon:"list"},{id:"quiet",label:i("שעות שקט ומה עובר"),icon:"moon"},{id:"esc",label:i("הסלמה"),icon:"escal"},{id:"lock",label:i("פרטיות מסך נעול"),icon:"lock"},{id:"keep",label:"שמירה",icon:"calendar"},{id:"mail",label:i("דואר יוצא"),icon:"mail"},{id:"wa",label:i("וואטסאפ"),icon:"chat"},{id:"chan",label:i("ערוצים"),icon:"phone"},{id:"log",label:i("יומן מסירה וכשלים"),icon:"inbox"}],je=[{id:"u-yoni",name:"יוני"},{id:"u-dana",name:"דנה"},{id:"u-uri",name:"אורי"},{id:"u-roni",name:"רוני"}],X=["scope","managers","initiator","users"],Fe={sent:"check",failed:"warning",gone:"warning",skipped:"moon",queued:"clock",retry:"refresh"},We={sent:"ok",failed:"bad",gone:"bad",skipped:"skp",queued:"skp",retry:"skp"},Ke=()=>i("{n} יום",{n:14});let u=class extends j{constructor(){super(...arguments),this.bubbleSkin=new Ts(this),this.section="",this.phase="loading",this.error="",this.settings=null,this.policies=[],this.stats=null,this.log=[],this.titles={},this.users=null,this.devices=0,this.wa=null,this.onlyFailed=!1,this.sec="sources",this.phone=window.matchMedia("(max-width: 1099px)").matches,this.toast=null,this.invalid=null,this.mail={linkBase:"",host:"",port:"587",security:"starttls",user:"",password:"",pwEdit:!0,from:"",recipients:""},this.mailBusy=null,this.mailResult=null,this.mailError="",this.picker=null,this.now=Date.now(),this.clockOffset=0,this.offClock=null,this.tz=void 0,this.rev=1,this.chain=Promise.resolve(),this.toastTimer=0,this.phoneMq=window.matchMedia("(max-width: 1099px)"),this.onMq=()=>this.phone=this.phoneMq.matches,this.nameOf=s=>{if(s==="managers")return i("מנהלי התראות");const e=s.map(t=>this.users?.find(a=>a.id===t)?.name??t);return e.length?e.join(", "):i("משתמשים נבחרים")}}connectedCallback(){super.connectedCallback(),Os(this),this.phoneMq.addEventListener("change",this.onMq),this.load(),this.offClock=As(()=>this.now=Date.now()+this.clockOffset)}disconnectedCallback(){this.offClock?.(),this.offClock=null,this.phoneMq.removeEventListener("change",this.onMq),window.clearTimeout(this.toastTimer),super.disconnectedCallback()}willUpdate(s){const e=s.has("section")?ls(this.section):null;e&&(this.sec=e)}async load(){this.phase="loading",this.error="";try{if(await Ps.prepare(),z()&&!_s("notify.manage")){this.phase="user";return}const s=A();let e;try{e=await s.settings()}catch(E){if(Ls(E)==="forbidden"){this.phase="user";return}throw E}const[t,a,n,r,o,v,g,f]=await Promise.all([s.policies(),s.stats().catch(()=>null),s.adminDeliveries({limit:200}).catch(()=>[]),s.list({limit:100}).catch(()=>null),this.loadUsers(),this.countDevices(),this.clockAndZone(),T().view().catch(()=>null)]);this.wa=f;const _=this.settings;this.settings=e,this.rev=e.revision,this.policies=t,this.stats=a,this.log=n,this.titles=Object.fromEntries((r?.notifications??[]).map(E=>[E.id,E.title])),this.users=o,this.devices=v,this.now=g.now,this.clockOffset=g.now-Date.now(),this.tz=g.tz,this.mail=Rs(this.mail,_,e),this.mailResult=null,this.phase="ready"}catch(s){this.error=L(s),this.phase="error"}}async clockAndZone(){if(z()){const e=await Is().catch(()=>({}));return{now:Date.now(),tz:typeof e["time.zone"]=="string"?e["time.zone"]:void 0}}const s=await K(()=>import("./notifications-mock-BdeN4xND.js"),__vite__mapDeps([0]),import.meta.url);return{now:s.notifyMock().clock,tz:s.MOCK_TZ}}async loadUsers(){if(!z())return je;try{const{listUsers:s}=await K(async()=>{const{listUsers:e}=await import("./access-Baylf3zP.js");return{listUsers:e}},__vite__mapDeps([0]),import.meta.url);return(await s()).users.filter(e=>e.active).map(e=>({id:e.id,name:e.name||e.username}))}catch{return null}}async countDevices(){if(!z())return(await K(async()=>{const{notifyMock:s}=await import("./notifications-mock-BdeN4xND.js");return{notifyMock:s}},__vite__mapDeps([0]),import.meta.url)).notifyMock().registered;try{return(await Ns()).subscriptions.length}catch{return 0}}say(s,e=!1){this.toast={text:s,bad:e},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,3e3)}enqueue(s){this.chain=this.chain.then(s).catch(()=>{})}async conflict(s){this.say(L(s),!0),await this.load()}patchSettings(s){if(!this.settings)return;this.settings={...this.settings,...s};const e=Ms(os(this.settings));this.invalid=e,!e&&this.enqueue(async()=>{if(this.settings)try{const t=await A().saveSettings(os(this.settings),this.rev);this.rev=t.revision,this.say(i("נשמר"))}catch(t){await this.conflict(t)}})}patchPolicy(s,e){const t=this.policies.find(n=>n.source===s);if(!t)return;let a;try{a=e(t)}catch(n){this.say(L(n),!0);return}this.policies=this.policies.map(n=>n.source===s?a:n),this.enqueue(async()=>{const n=this.policies.find(r=>r.source===s);if(n)try{const r=await A().savePolicy(s,Ds(n),n.revision);this.policies=this.policies.map(o=>o.source===s?{...o,revision:r.revision}:o),this.say(i("נשמר"))}catch(r){await this.conflict(r)}})}setSec(s){const e=ls(s);e&&(this.sec=e)}mailBody(){const s=this.mail,e={host:s.host.trim(),port:Number(s.port),security:s.security,user:s.user.trim(),from:s.from.trim(),recipients:Us(s.recipients),link_base:s.linkBase.trim()};return s.pwEdit&&s.password&&(e.password=s.password),Bs(e)?null:e}async saveMail(){const s=this.mailBody();if(!s){this.mailError=Q.email_invalid;return}this.mailError="",this.mailBusy="save";try{const e=await A().saveEmail(s);this.settings&&(this.settings={...this.settings,email:e}),this.mailResult=null,this.mail={...this.mail,password:"",pwEdit:!e.password_set},this.say(i("הגדרות הדואר נשמרו"))}catch(e){this.mailError=L(e)}finally{this.mailBusy=null}}async testMail(){this.mailBusy="test",this.mailError="";try{this.mailResult=await A().testEmail();const s=await A().settings().catch(()=>null);s&&this.settings&&(this.settings={...this.settings,email:s.email})}catch(s){this.mailResult=null,this.mailError=L(s)}finally{this.mailBusy=null}}openPicker(s){const e=s==="esc"?Array.isArray(this.settings?.escalation.to)?this.settings?.escalation.to:[]:this.policies.find(t=>t.source===s)?.recipients.user_ids??[];this.picker={target:s,selected:[...e]}}savePicker(){const s=this.picker;if(!(!s||!s.selected.length)){if(s.target==="esc")this.patchSettings({escalation:{...this.settings.escalation,to:s.selected}});else{const e=s.selected;this.patchPolicy(s.target,t=>({...t,recipients:{rule:"users",user_ids:e}}))}this.picker=null}}sevSeg(s,e){return l`<span class="sevseg" role="radiogroup" aria-label=${i("חומרה")}>${ds.slice().reverse().map(t=>l`<button type="button" role="radio" aria-checked=${String(e===t)} aria-pressed=${String(e===t)} data-pol-sev=${`${s}:${t}`} style=${`--sev:var(--nt-sev-${t})`} title=${I[t]} @click=${()=>this.patchPolicy(s,a=>Hs(a,t))}><i aria-hidden="true"></i>${I[t]}</button>`)}</span>`}whoSel(s){const e=js.includes(s.source),t=this.settings?Fs(s,this.settings):s.recipients.rule,a=e?t:s.recipients.rule;return l`<select class="inp sm" data-pol-who=${s.source} aria-label=${i("מי מקבל")} ?disabled=${e} @change=${n=>{const r=n.target.value;r==="users"?(this.openPicker(s.source),n.target.value=a):this.patchPolicy(s.source,o=>Ws(o,r))}}>${(X.includes(a)?X:[...X,a]).map(n=>l`<option value=${n} .selected=${a===n}>${n==="users"&&s.recipients.rule==="users"?`${cs.users} (${s.recipients.user_ids?.length??0})`:cs[n]}</option>`)}</select>`}chans(s){const e=this.settings,t=N(s,"webpush",e),a=N(s,"email",e),n=N(s,"app",e),r=N(s,"whatsapp",e,this.wa),o={email:i('הדוא"ל לא מוגדר'),whatsapp:i("וואטסאפ כבוי")},v=(g,f,_)=>l`<button type="button" class=${vs({chip:!0,unconf:f.note==="unconfigured"})} aria-pressed=${String(f.on)} data-pol-ch=${`${s.source}:${g}`} title=${f.note==="unconfigured"?o[g]??"":""} @click=${()=>this.patchPolicy(s.source,E=>be(E,g,!f.on))}>${d(_)}${q[g]}</button>`;return l`<span class="chs"><span class="chip lock" title=${i("תמיד")}>${d("inbox")}${q.inbox}</span>${v("webpush",t,"phone")}${v("email",a,"mail")}${v("app",n,"phone")}${v("whatsapp",r,"chat")}<span class="chip soon" aria-disabled="true" title=${i("Companion – בקרוב")} aria-label=${i("Companion – בקרוב")}>${d("phone")}</span></span>`}tog(s,e,t,a,n=!1){return l`<sw-toggle .checked=${J(s)} label=${t} labelHidden ?disabled=${n} data-tog=${e} @change=${ss(s,a)}></sw-toggle>`}polToggle(s){return l`<sw-toggle .checked=${J(s.enabled)} label=${i("פעיל")} labelHidden data-pol-on=${s.source} @change=${ss(s.enabled,()=>this.patchPolicy(s.source,e=>({...e,enabled:!e.enabled})))}></sw-toggle>`}renderSources(){const s=Ks("nvr")?this.policies:this.policies.filter(o=>!Qs(o.source)),e=Ys(s,[...bs,...ge,...fe,...we,...$e]),t=s.length,a=o=>o==="rule.alert"||bs.find(v=>v.key===o)?.rulesOnly===!0,n=this.settings;let r;return this.phone?r=l`<div class="scards">${e.flatMap(o=>o.rows).map(({info:o,policy:v})=>l`<section class="glass scard ${v.enabled?"":"off"}" data-pol-row=${v.source}>
        <div class="top"><span class="nm"><span class="ring">${d(o.icon)}</span></span><b>${o.label}</b>${this.polToggle(v)}</div>
        <div class="ln"><small>${i("חומרה")}</small>${a(v.source)?l`<span class="tag">${i("לפי החוק")}</span>`:this.sevSeg(v.source,v.severity)}</div>
        <div class="ln"><small>${i("מי מקבל")}</small>${this.whoSel(v)}</div>
        <div class="ln"><small>${i("ערוצים")}</small>${this.chans(v)}</div></section>`)}</div>`:r=l`<div class="mxw"><table class="mx"><colgroup><col style="width:20%"><col style="width:7%"><col style="width:24%"><col style="width:18%"><col></colgroup>
        <thead><tr><th>${i("מקור")}</th><th class="c">${i("פעיל")}</th><th>${i("חומרה")}</th><th>${i("מי מקבל")}</th><th>${i("ערוצים")}</th></tr></thead>
        <tbody>${e.map(o=>l`<tr class="cat"><td colspan="5">${d(o.icon)}${o.label}</td></tr>${o.rows.map(({info:v,policy:g})=>l`<tr class=${g.enabled?"":"off"} data-pol-row=${g.source}>
          <td class="keep"><span class="nm"><span class="ring">${d(v.icon)}</span><b>${v.label}</b></span></td>
          <td class="c keep">${this.polToggle(g)}</td>
          <td>${a(g.source)?l`<span class="tag">${i("לפי החוק")}</span>`:this.sevSeg(g.source,g.severity)}</td>
          <td>${this.whoSel(g)}</td><td>${this.chans(g)}</td></tr>`)}`)}</tbody></table></div>`,l`<section class="glass sec" data-set-section="sources" id="sec-sources"><header><h2>${d("list")}${x[0].label}</h2><div class="sp"><span class="tag soon">${d("phone")}${i("Companion – בקרוב")}</span><span class="tag" data-pol-count>${i("{n} מתוך {total} פעילים",{n:Gs(this.policies),total:t})}</span></div></header>
      <div class="frow"><div class="l"><b>${i("כשל בתזמון או באוטומציה מגיע אל")}</b></div><div class="r"><sw-segmented size="sm" label=${i("כשל בתזמון או באוטומציה")} value=${n.failures_audience} @change=${o=>this.patchSettings({failures_audience:o.detail.value})}
        .options=${Vs.map(o=>({value:o,label:o==="admins"?i("מנהלים"):i("כל מי שרואה"),attrs:{"data-failures-audience":o}}))}></sw-segmented></div></div>
      ${r}</section>`}renderQuiet(){const s=this.settings,e=s.quiet,t=!e.enabled;return l`<section class="glass sec" data-set-section="quiet" id="sec-quiet"><header><h2>${d("moon")}${x[1].label}</h2><div class="sp">${this.tog(e.enabled,"quiet-on",i("שעות שקט"),()=>this.patchSettings({quiet:{...e,enabled:!e.enabled}}))}</div></header>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${i("שעות")}</b></div><div class="r"><input class="inp sm ltr" type="time" lang=${ps()} data-quiet-from aria-label=${i("מהשעה")} style="inline-size:112px" .value=${e.from} ?disabled=${t} @change=${a=>this.setTime("from",a.target.value)} /><span>${i("עד")}</span><input class="inp sm ltr" type="time" lang=${ps()} data-quiet-to aria-label=${i("עד השעה")} style="inline-size:112px" .value=${e.to} ?disabled=${t} @change=${a=>this.setTime("to",a.target.value)} /></div></div>
      ${this.invalid==="quiet_invalid"?l`<div class="errline" data-set-error>${Q.quiet_invalid}</div>`:b}
      <div class="frow ${t?"dis":""}"><div class="l"><b>${i("ימים")}</b></div><div class="r"><div class="days" role="group" aria-label=${i("ימים")}>${Xs.map(a=>l`<button type="button" aria-pressed=${String(e.days.includes(a))} data-quiet-day=${a} ?disabled=${t} @click=${()=>this.patchSettings({quiet:{...e,days:Js(e.days,a)}})}>${Zs[a]}</button>`)}</div></div></div>
      <div class="frow ${t?"dis":""}" style="align-items:flex-start"><div class="l"><b>${i("מה עובר בשעות שקט")}</b></div></div>
      <table class="qmx ${t?"dis":""}"><thead><tr><th>${i("חומרה")}</th><th>${q.webpush}</th><th>${q.email}</th><th>${q.whatsapp}</th><th>Companion</th></tr></thead><tbody>${ds.slice().reverse().map(a=>l`<tr><td><span class="sv" style=${`--sev:var(--nt-sev-${a})`}><i></i>${I[a]}</span></td>
        ${["webpush","email","whatsapp"].map(n=>l`<td><button type="button" class="chk" role="checkbox" aria-checked=${String(s.pass_through[a][n]??!1)} aria-label=${`${I[a]} · ${q[n]}`} data-pass=${`${a}:${n}`} ?disabled=${t} @click=${()=>this.patchSettings({pass_through:se(s.pass_through,a,n)})}>${d("check")}</button></td>`)}
        <td><button type="button" class="chk" role="checkbox" aria-checked=${String(s.pass_through[a].ha_mobile)} aria-label=${i("Companion – בקרוב")} disabled>${d("check")}</button></td></tr>`)}</tbody></table></section>
      <section class="glass sec" data-set-section="quiet-windows" id="sec-quiet-windows"><header><h2>${d("moon")}${h("title")}</h2></header><system-quiet-windows></system-quiet-windows></section>`}setTime(s,e){!this.settings||!Number.isFinite(ee(e))||this.patchSettings({quiet:{...this.settings.quiet,[s]:e}})}renderEsc(){const e=this.settings.escalation,t=!e.enabled,a=e.to!=="managers",n=o=>this.patchSettings({escalation:{...e,...o}}),r=te(e,842,this.nameOf);return l`<section class="glass sec" data-set-section="esc" id="sec-esc"><header><h2>${d("escal")}${x[2].label}</h2><div class="sp">${this.tog(e.enabled,"esc-on",i("הסלמה"),()=>n({enabled:!e.enabled}))}</div></header>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${i("אחרי")}</b><small>${i("קריטי בלי אישור")}</small></div><div class="r"><span class="stp"><button type="button" data-esc-step="-1" aria-label=${i("פחות")} @click=${()=>this.patchSettings({escalation:hs(e,-1)})}>${d("minus")}</button><span class="vv" data-esc-min><span class="n">${e.after_min}</span><small>${i("דק׳")}</small></span><button type="button" data-esc-step="1" aria-label=${i("יותר")} @click=${()=>this.patchSettings({escalation:hs(e,1)})}>${d("plus")}</button></span></div></div>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${i("שלבים")}</b></div><div class="r"><sw-segmented size="sm" label=${i("שלבים")} value=${String(e.steps)} @change=${o=>n({steps:Number(o.detail.value)})}
        .options=${[1,2,3].map(o=>({value:String(o),label:String(o),attrs:{"data-esc-steps":String(o)}}))}></sw-segmented></div></div>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${i("אל")}</b></div><div class="r"><sw-segmented size="sm" label=${i("אל")} value=${a?"users":"managers"} @change=${o=>o.detail.value==="users"?this.openPicker("esc"):n({to:"managers"})}
        .options=${[{value:"managers",label:i("מנהלי התראות"),attrs:{"data-esc-to":"managers"}},{value:"users",label:i("משתמשים נבחרים"),attrs:{"data-esc-to":"users"}}]}></sw-segmented>${a?l`<span class="tag" data-esc-names>${this.nameOf(e.to)}</span>`:b}</div></div>
      <div class="frow ${t?"dis":""}"><div class="l"><b>${i("נעצרת באישור")}</b></div><div class="r"><span class="tag ok">${d("lock")}${i("תמיד")}</span></div></div>
      ${this.invalid==="escalation_invalid"?l`<div class="errline" data-set-error>${Q.escalation_invalid}</div>`:b}
      <div class="escprev ${t?"dis":""}" data-esc-preview><div class="tl">${r.map(o=>l`<div class="ev ${o.kind}"><span class="t">${o.clock}</span><span class="d"><i></i></span><span class="b"><b>${o.title}</b><small>${o.sub}</small></span></div>`)}</div></div></section>`}lockPhone(s,e){const t=ae(s,this.tz);return l`<div class=${vs({lphone:!0,sel:e})} data-lock-phone=${s} data-lock-selected=${String(e)}><span class="notch"></span><span class="llabel">${d("lock")}${us[s]}</span>
      <div class="ltime n">14:10</div><div class="ldate">${i("יום רביעי, 1 באוקטובר")}</div>
      <div class="lcards">${(s==="generic"?t.slice(0,1):t).map(a=>l`<div class="pushcard" data-push-card><div class="ph"><span class="app">S</span>Arx<span class="ago">${a.ago}</span></div><b>${a.title}</b><p>${a.body}</p>
        <div class="acts">${a.actions.map(n=>l`<span class=${n.id==="open_door"?"door":""}>${d(n.id==="open"?"open":n.id==="ack"?"checkAll":n.id==="snooze"?"snooze":"doorOpen")}${n.label}</span>`)}</div></div>`)}</div></div>`}renderLock(){const s=this.settings;return l`<section class="glass sec" data-set-section="lock" id="sec-lock"><header><h2>${d("lock")}${x[3].label}</h2></header>
      <div class="frow"><div class="l"><b>${i("רמת פירוט")}</b></div><div class="r"><sw-segmented label=${i("רמת פירוט")} value=${s.lockscreen} @change=${e=>this.patchSettings({lockscreen:e.detail.value})}
        .options=${ie.map(e=>({value:e,label:us[e],attrs:{"data-lock-level":e}}))}></sw-segmented></div></div>
      <div class="lockrow" data-lock-preview>${["generic","type_place","full"].map(e=>this.lockPhone(e,s.lockscreen===e))}</div>
      <div class="frow dis"><div class="l"><b>${i("תמונה מהמצלמה בהתראה")}</b><small>${i("התמונה נפתחת רק בתוך Arx")}</small></div><div class="r"><span class="tag soon">${i("בקרוב")}</span>${this.tog(!1,"image-in-push",i("תמונה בהתראה"),()=>{},!0)}</div></div>
      <div class="frow dis"><div class="l"><b>${i('צליל קריטי שעוקף "נא לא להפריע"')}</b><small>${i("בטיחות בלבד · טלפוני Companion")}</small></div><div class="r"><span class="tag soon">${i("בקרוב")}</span>${this.tog(s.companion.critical_sound_safety,"critical-sound",i("צליל קריטי"),()=>{},!0)}</div></div></section>`}renderKeep(){const s=this.settings;return l`<section class="glass sec" data-set-section="keep" id="sec-keep"><header><h2>${d("calendar")}${x[4].label}</h2></header>
      <div class="frow"><div class="l"><b>${i("התראות")}</b></div><div class="r"><sw-segmented size="sm" label=${i("שמירת התראות")} value=${String(s.retention_days)} @change=${e=>this.patchSettings({retention_days:Number(e.detail.value)})}
        .options=${ne.map(e=>({value:String(e),label:String(e),attrs:{"data-keep":String(e)}}))}></sw-segmented><span>${i("ימים")}</span></div></div>
      <div class="frow"><div class="l"><b>${i("יומן מסירה")}</b></div><div class="r"><span class="tag"><span class="n">${s.deliveries_retention_days}</span> ${i("ימים")}</span></div></div></section>`}renderMail(){const s=this.settings,e=this.mail,t=s.email,a=r=>this.mail={...this.mail,...r},n=this.mailResult?this.mailResult.ok?l`<span class="tag ok" data-mail-result="ok">${d("check")}${ms(this.mailResult)}</span>`:l`<span class="tag bad" data-mail-result="bad">${d("warning")}${ms(this.mailResult)}</span>`:t.last_test?l`<span class="tag ${t.last_test.ok?"ok":"bad"}" data-mail-last>${d(t.last_test.ok?"check":"warning")}${t.last_test.ok?`${i("נבדק {time}",{time:re(t.last_test.at,this.tz)})} · ${i("תקין")}`:`${i("הבדיקה נכשלה")} · ${t.last_test.detail}`}</span>`:l`<span class="tag" data-mail-last>${t.configured?i("לא נבדק"):i("לא מוגדר")}</span>`;return l`<section class="glass sec" data-set-section="mail" id="sec-mail"><header><h2>${d("mail")}${x[5].label}</h2><div class="sp">${n}</div></header>
      <div class="fgrid">
        <label>${i("שרת")}<input class="inp ltr" data-mail-host .value=${e.host} @input=${r=>a({host:r.target.value})} /></label>
        <label>${i("פורט")}<input class="inp ltr" inputmode="numeric" data-mail-port .value=${e.port} @input=${r=>a({port:r.target.value})} /></label>
        <label>${i("אבטחה")}<select class="inp" data-mail-security @change=${r=>a({security:r.target.value})}>${["starttls","tls","none"].map(r=>l`<option value=${r} .selected=${e.security===r}>${r==="none"?i("ללא"):r==="tls"?"TLS":"STARTTLS"}</option>`)}</select></label>
        <label>${i("משתמש")}<input class="inp ltr" data-mail-user .value=${e.user} @input=${r=>a({user:r.target.value})} /></label>
        <label>${i("סיסמה")}<span style="display:flex;gap:8px"><input class="inp ltr" type="password" autocomplete="new-password" data-mail-password style="flex:1" .value=${e.pwEdit?e.password:"••••••••••"} ?readonly=${!e.pwEdit} @input=${r=>a({password:r.target.value})} />${t.password_set&&!e.pwEdit?l`<button type="button" class="btn quiet sm" data-mail-pw-change @click=${()=>a({pwEdit:!0,password:""})}>${i("החלפה")}</button>`:b}</span></label>
        <label>${i("מאת")}<input class="inp ltr" data-mail-from .value=${e.from} @input=${r=>a({from:r.target.value})} /></label>
        <label class="w2">${i("נמענים")}<input class="inp ltr" data-mail-recipients .value=${e.recipients} @input=${r=>a({recipients:r.target.value})} /></label>
        <label class="w2">${i("כתובת Arx לקישור")}<input class="inp ltr" data-mail-linkbase placeholder="https://" .value=${e.linkBase} @input=${r=>a({linkBase:r.target.value})} /></label>
      </div>
      ${this.mailError?l`<div class="errline" data-mail-error role="alert">${this.mailError}</div>`:b}
      <div class="frow mailfoot"><button type="button" class="btn quiet" data-mail-test ?disabled=${this.mailBusy!==null||!t.configured} @click=${()=>void this.testMail()}>${d(this.mailBusy==="test"?"refresh":"send")}${this.mailBusy==="test"?i("שולח…"):i("שליחת בדיקה")}</button><button type="button" class="btn primary" data-mail-save ?disabled=${this.mailBusy!==null} @click=${()=>void this.saveMail()}>${i("שמירה")}</button></div></section>`}renderWa(){return l`<div data-set-section="wa" id="sec-wa"><notify-whatsapp-section section-id="wa-inner" @notify-saved=${s=>{this.say(s.detail.text),T().view().then(e=>this.wa=e).catch(()=>{}),this.renderRoot.querySelectorAll("notify-whatsapp-mine").forEach(e=>e.reload())}}></notify-whatsapp-section></div>`}renderChannels(){const s=this.settings,e=Y("webpush",s,this.devices),t=Y("email",s,this.devices),a=Y("whatsapp",s,this.devices,this.wa?{enabled:this.wa.enabled,mapped:this.wa.account.mapped}:null),n=(r,o)=>l`<span class="tag ${r==="on"||r==="always"?"ok":r==="soon"?"soon":""}">${r==="on"||r==="always"?i("פעיל"):o}</span>`;return l`<section class="glass sec" data-set-section="chan" id="sec-chan"><header><h2>${d("phone")}${x[7].label}</h2></header>
      <div class="frow"><div class="l"><b>${i("מרכז ההתראות במחשב")}</b></div><div class="r"><sw-segmented size="sm" label=${i("מרכז ההתראות במחשב")} value=${s.center_layout} @change=${r=>this.patchSettings({center_layout:r.detail.value})}
        .options=${le.map(r=>({value:r,label:oe[r],attrs:{"data-layout":r}}))}></sw-segmented></div></div>
      <div class="chgrid">
        <div class="chc" data-channel="inbox"><span class="ring">${d("inbox")}</span><b>${i("מרכז ההתראות")}</b><small>${i("פעיל תמיד · לכל המשתמשים")}</small>${n("always","")}</div>
        <div class="chc" data-channel="webpush"><span class="ring">${d("phone")}</span><b>${i("דחיפה (Arx)")}</b><small>${e.state==="on"?i("{n} מכשירים רשומים אצלך",{n:this.devices}):e.text}</small>${n(e.state,e.text)}</div>
        <div class="chc" data-channel="email"><span class="ring">${d("mail")}</span><b>${i('דוא"ל')}</b><small>${t.state==="on"?i("תקלות מערכת וגיבויים"):i("לא מוגדר")}</small>${n(t.state,t.text)}</div>
        <div class="chc" data-channel="app"><span class="ring">${d("phone")}</span><b>${i("אפליקציה לנייד")}</b><small>${i("לפי המכשירים שנרשמו באפליקציה · שעות השקט כמו דחיפה")}</small>${n("on","")}</div>
        <div class="chc soon" data-channel="ha_mobile"><span class="ring">${d("phone")}</span><b>Companion</b><small>${i("טלפונים לפי משתמש")}</small><span class="tag soon">${i("בקרוב")}</span></div>
        <div class="chc" data-channel="whatsapp"><span class="ring">${d("chat")}</span><b>WhatsApp</b><small>${a.text}</small>${n(a.state,a.text)}</div>
      </div>
      <div class="devbox"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></div></section>`}renderLog(){const s=de(this.stats),e=ce(this.log,this.onlyFailed),t=pe(this.log);return l`<section class="glass sec" data-set-section="log" id="sec-log"><header><h2>${d("inbox")}${x[8].label}</h2><div class="sp"><span class="tag" data-log-window>${Ke()}</span><sw-segmented size="sm" label=${i("סינון היומן")} value=${this.onlyFailed?"failed":"all"} @change=${a=>this.onlyFailed=a.detail.value==="failed"}
        .options=${[{value:"all",label:i("הכל"),attrs:{"data-log-filter":"all"}},{value:"failed",label:i("רק כשלים"),count:t||void 0,attrs:{"data-log-filter":"failed"}}]}></sw-segmented></div></header>
      <div class="fails" data-fail-panel>${s.map(a=>l`<div class="fstat ${a.tone}" data-fail-card=${a.channel}><span class="ch">${a.label} · ${i("24 שעות")}</span><b class="n">${a.failed>0?a.failed:a.sent}</b><small>${a.failed>0?i("נכשלו"):i("נשלחו")}${a.skipped?` · ${i("{n} לא נשלחו",{n:a.skipped})}`:""}</small></div>`)}</div>
      <div class="lgw"><table class="lg"><thead><tr><th>${i("שעה")}</th><th>${i("התראה")}</th><th>${i("משתמש")}</th><th>${i("ערוץ")}</th><th>${i("מצב")}</th><th>${i("סיבה")}</th></tr></thead><tbody>${e.length?e.map(a=>l`<tr data-log-row=${a.id} data-log-status=${a.status}><td class="n" style="direction:rtl">${ue(a.at,this.now,this.tz)}</td><td>${this.titles[a.notification_id]??"—"}</td><td>${a.user_display}</td><td>${d(a.channel==="email"?"mail":a.channel==="whatsapp"?"chat":"phone")}${q[a.channel]}</td><td class=${We[a.status]}>${d(Fe[a.status])}${he[a.status]}</td><td>${ve(a.reason)||"—"}</td></tr>`):l`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--dv-text-3)">${i("אין רשומות")}</td></tr>`}</tbody></table></div></section>`}renderPicker(){const s=this.picker;if(!s)return b;const e=this.users;return l`<sw-dialog open heading=${i("משתמשים נבחרים")} data-user-picker @close=${()=>this.picker=null}>
      ${e&&e.length?l`<div class="pick" role="group">${e.map(t=>l`<button type="button" role="checkbox" aria-checked=${String(s.selected.includes(t.id))} data-pick=${t.id} @click=${()=>this.picker={...s,selected:s.selected.includes(t.id)?s.selected.filter(a=>a!==t.id):[...s.selected,t.id]}}><span class="chk" aria-hidden="true" data-on=${String(s.selected.includes(t.id))} style=${s.selected.includes(t.id)?"background:var(--dv-accent);border-color:transparent":""}>${d("check")}</span>${t.name}</button>`)}</div>`:l`<div class="errline">${i("רשימת המשתמשים לא זמינה")}</div>`}
      <button slot="footer" type="button" class="btn quiet" @click=${()=>this.picker=null}>${i("ביטול")}</button>
      <button slot="footer" type="button" class="btn primary" data-pick-save ?disabled=${!s.selected.length} @click=${()=>this.savePicker()}>${i("שמירה")}</button>
    </sw-dialog>`}renderBody(){if(this.phase==="loading")return l`<div class="skbox" data-set-state="loading" aria-busy="true"><span class="skl"></span><span class="skl"></span><span class="skl"></span></div>`;if(this.phase==="error")return l`<div class="errbar" role="alert" data-set-state="error">${d("warning")}<span>${this.error||i("לא ניתן לטעון את ההגדרות")}</span><button type="button" class="btn sm" data-set-retry @click=${()=>void this.load()}>${d("refresh")}${i("נסה שוב")}</button></div>`;if(this.phase==="user")return l`<div class="secs" data-set-state="user"><section class="glass sec"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></section></div>`;const s={sources:()=>this.renderSources(),quiet:()=>this.renderQuiet(),esc:()=>this.renderEsc(),lock:()=>this.renderLock(),keep:()=>this.renderKeep(),mail:()=>this.renderMail(),wa:()=>this.renderWa(),chan:()=>this.renderChannels(),log:()=>this.renderLog()};return l`<div class="set" data-set-state="ready"><sw-tabs variant="underline" class="settabs" data-set-tabs group-label=${i("מדורים")} panel="set-panel" .items=${x.map(e=>({id:e.id,label:e.label}))} .active=${this.sec} @change=${e=>this.setSec(e.detail.id)}></sw-tabs>
      <div class="secs" id="set-panel" data-set-panel=${this.sec}>${s[this.sec]()}</div></div>`}render(){return l`<sw-page class="page" heading=${i("התראות")} crumbs=${i("מערכת")} data-notify-settings data-phase=${this.phase}>
      ${this.renderBody()}
    </sw-page>
    ${this.renderPicker()}
    ${this.toast?l`<div class="toast ${this.toast.bad?"bad":""}" role="status" data-set-toast ${me()}>${d(this.toast.bad?"warning":"check")}${this.toast.text}</div>`:b}`}};u.styles=[xe,es,ye,ts,as,H`
      :host {
        --nt-sheet-w: 480px;
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
      .sevseg button[aria-pressed='true'] {
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
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35), inset 0 0 0 7px var(--sw-video-bg), inset 0 0 0 8px rgba(255, 255, 255, 0.08);
        color: #fff;
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
        box-shadow: 0 22px 54px rgba(0, 0, 0, 0.42), inset 0 0 0 7px var(--sw-video-bg), inset 0 0 0 8px rgba(255, 255, 255, 0.08), 0 0 0 3px var(--dv-accent);
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
        color: #fff;
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
      /* the log */
      .lgw {
        overflow-x: auto;
        border-radius: var(--sw-r-lg);
        border: 1px solid var(--dv-border);
      }
      .lg {
        inline-size: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: var(--sw-fs-sm);
      }
      .lg th {
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-semibold);
        color: var(--dv-text-3);
        text-align: start;
        padding: 8px;
        background: var(--nt-matrix-head);
        border-block-end: 1px solid var(--dv-border);
        white-space: nowrap;
      }
      .lg td {
        padding: 9px 8px;
        border-block-end: 1px solid var(--dv-border);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-inline-size: 260px;
      }
      .lg tr:last-child td {
        border-block-end: 0;
      }
      .lg td .ic {
        font-size: var(--sw-fs-md);
        vertical-align: -2px;
        margin-inline-end: 4px;
      }
      .lg .ok {
        color: var(--dv-success);
        font-weight: var(--sw-fw-semibold);
      }
      .lg .bad {
        color: var(--dv-danger);
        font-weight: var(--sw-fw-semibold);
      }
      .lg .skp {
        color: var(--dv-text-3);
        font-weight: var(--sw-fw-semibold);
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
    `];m([ks()],u.prototype,"section",2);m([p()],u.prototype,"phase",2);m([p()],u.prototype,"error",2);m([p()],u.prototype,"settings",2);m([p()],u.prototype,"policies",2);m([p()],u.prototype,"stats",2);m([p()],u.prototype,"log",2);m([p()],u.prototype,"titles",2);m([p()],u.prototype,"users",2);m([p()],u.prototype,"devices",2);m([p()],u.prototype,"wa",2);m([p()],u.prototype,"onlyFailed",2);m([p()],u.prototype,"sec",2);m([p()],u.prototype,"phone",2);m([p()],u.prototype,"toast",2);m([p()],u.prototype,"invalid",2);m([p()],u.prototype,"mail",2);m([p()],u.prototype,"mailBusy",2);m([p()],u.prototype,"mailResult",2);m([p()],u.prototype,"mailError",2);m([p()],u.prototype,"picker",2);m([p()],u.prototype,"now",2);m([p()],u.prototype,"tz",2);u=m([F("system-notifications")],u);export{u as SystemNotifications};
