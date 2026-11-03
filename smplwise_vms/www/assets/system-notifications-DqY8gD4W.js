const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{i as E,bb as q,g as F,b7 as at,j as O,g$ as H,yQ as I,yR as M,E as U,F as tt,G as d,a as B,e as r,yS as l,A as v,H as D,S as it,yT as nt,b$ as rt,yU as ot,av as lt,yV as _,yW as ct,yX as S,J as dt,_ as N,yY as pt,a4 as ht,yZ as j,y_ as ut,y$ as bt,z0 as vt,z1 as P,z2 as Y,z3 as A,z4 as mt,X as gt,Y as ft,z5 as wt,uq as V,z6 as T,z7 as $,be as xt,z8 as $t,z9 as yt,za as kt,a6 as _t,bV as K,zb as zt,zc as St,zd as Et,ze as Ct,zf as At,zg as Tt,zh as G,zi as Ot,zj as Q,cW as X,zk as Rt,zl as qt,zm as Z,zn as Nt,zo as L,a5 as Pt,zp as Lt,zq as Wt,zr as Ht,zs as It,zt as Mt,zu as Ut,zv as Bt,zw as Dt,zx as J,zy as Ft,zz as jt,zA as Yt,zB as Vt,C as Kt}from"./index-Do3zNa2z.js";import{a as Gt}from"./media-page-CPjqeq9C.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-D5ZUPSdO.js";const Qt={view:()=>F("notify/whatsapp"),save:t=>q("notify/whatsapp",t),test:()=>at("notify/whatsapp/test"),mine:()=>F("me/notify-whatsapp"),setOptIn:(t,e)=>q("me/notify-whatsapp",t?{opted_in:!0,confirm:e}:{opted_in:!1}),setOptOut:(t,e)=>q("me/notify-whatsapp",t?{opted_in:!1}:{opted_in:!0,confirm:e})};function Xt(){let t={enabled:!1,per_user_hour:4,dedupe_min:30,budget_pct:50,budget_critical_pct:80,detail:"type_place",detail_levels:["generic","type_place"],normalized:[],warnings:[],revision:0,ranges:{per_user_hour:[1,30],dedupe_min:[5,1440],budget_pct:[10,90],budget_critical_pct:[10,90]},account:{mapped:!0,label:"וואטסאפ ····0191",state:"connected"},reachable_users:3,accounts_href:"#/system/messaging-accounts",test:{own_number:!0,masked:"····0191"}},e={channel_enabled:!1,has_number:!0,masked:"····0191",source:"directory",opted_in:!1,number_changed:!1,directory_declined:!1,consent:"declined",confirm:"demo0123456789ab",stored_opt_in:!1},a=0;const s=(i,n,o)=>new O(i,{code:n,user_message:o,retryable:i===429,correlation_id:"demo",details:{}});return{view:async()=>structuredClone(t),save:async i=>{if(i.revision!==t.revision)throw s(412,"settings_conflict","ההגדרות השתנו בינתיים; טען מחדש.");const[n,o]=t.ranges.per_user_hour,[u,b]=t.ranges.dedupe_min;if(i.per_user_hour!==void 0&&(i.per_user_hour<n||i.per_user_hour>o)||i.dedupe_min!==void 0&&(i.dedupe_min<u||i.dedupe_min>b))throw s(422,"validation","ערך מספרי מחוץ לטווח.");const g=i.budget_pct??t.budget_pct,m=i.budget_critical_pct??t.budget_critical_pct;if(g<10||g>90||m<10||m>90||m<g)throw s(422,"validation","ערך מספרי מחוץ לטווח.");return t={...t,..."enabled"in i?{enabled:!!i.enabled}:{},...i.per_user_hour!==void 0?{per_user_hour:i.per_user_hour}:{},...i.dedupe_min!==void 0?{dedupe_min:i.dedupe_min}:{},budget_pct:g,budget_critical_pct:m,...i.detail?{detail:i.detail}:{},revision:t.revision+1},e={...e,channel_enabled:t.enabled},structuredClone(t)},test:async()=>{if(!t.account.mapped)throw s(409,"channel_unavailable","לא נבחר חשבון וואטסאפ להתראות.");if(++a>3)throw s(429,"rate_limited","יותר מדי הודעות בדיקה. נסו שוב מאוחר יותר.");return{ok:!0,outcome:"sent",code:null}},mine:async()=>({...e}),setOptIn:async(i,n)=>{if(i&&n!==e.confirm)throw s(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return e={...e,opted_in:i,stored_opt_in:i,number_changed:!1,consent:i&&!e.directory_declined?"granted":"declined"}},setOptOut:async(i,n)=>{if(!i&&n!==e.confirm)throw s(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return e={...e,opted_in:!i,stored_opt_in:!i,number_changed:!1,consent:!i&&!e.directory_declined?"granted":"declined"}}}}let Zt=null;const y=()=>E()?Qt:Zt??=Xt(),et={keyUnreadable:"מפתח ההודעות של המערכת לא נקרא - אי אפשר לאמת הסכמות, ולכן לא נשלחות התראות בוואטסאפ",normalized:"ערך שמור לא היה בטווח ותוקן - שמרו כדי לאשר",budget:"חלק מתקציב החשבון",budgetHint:"השאר נשמר להודעות ניהול השירות ולקודי אימות",budgetCritical:"חלק לקריטי",budgetCriticalHint:"קריטי והסלמה רשאים להשתמש עד כאן",detail:"פירוט בהודעה",detailHint:"תוכן ההתראה עצמו לא נשלח לוואטסאפ",detail_generic:"כללי",detail_type_place:"סוג ומקום",mine_title:"וואטסאפ שלי",mine_sub:"התראות לוואטסאפ האישי שלך, רק אם אישרת את המספר בעצמך",mine_number:"המספר",mine_src_directory:"מרשימת אנשי הקשר",mine_src_profile:"מהפרופיל",mine_status:"מצב",mine_on:"מקבל התראות",mine_off:"לא מקבל התראות",mine_changed:"המספר השתנה - אשר מחדש כדי לקבל התראות",mine_declined:"ברשימת אנשי הקשר וואטסאפ אינו הערוץ המועדף",mine_none:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",mine_confirm:"אישור המספר וקבלת התראות",mine_stop:"הפסקת התראות בוואטסאפ",on:"פעיל",off:"כבוי",attention:"דורש טיפול",title:"וואטסאפ",sub:"התראות לטלפון האישי של המשתמש, מהחשבון שנבחר בערוץ ההודעות",enabled:"שליחת התראות בוואטסאפ",enabledHint:"כבוי = שום התראה לא נשלחת בוואטסאפ, גם אם סומנה במדיניות",account:"חשבון שולח",accountNone:"לא נבחר חשבון",accountPick:"בחירת חשבון",st_connected:"מחובר",st_disconnected:"מנותק",st_unknown:"לא ידוע",st_missing:"לא נמצא",reach:"משתמשים עם מספר",reachHint:"מספר מרשימת אנשי הקשר, כשוואטסאפ הוא הערוץ המועדף",cap:"לכל משתמש בשעה",capHint:"התראה קריטית והסלמה אינן נספרות",dedupe:"בלי כפילות במשך",minutes:"דק׳",test:"שליחת בדיקה",testing:"שולח…",testHint:"נשלחת רק למספר שלך ({masked})",testNoNumber:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",testOk:"הודעת הבדיקה נשלחה",testFail:"הבדיקה נכשלה",warnOffAccount:"אין חשבון שולח - ההתראות לא יישלחו",saved:"נשמר",loading:"טוען…",error:"לא ניתן לטעון את הגדרות הוואטסאפ",retry:"נסה שוב",less:"פחות",more:"יותר"},Jt={keyUnreadable:"The system messaging key could not be read - consents cannot be verified, so no WhatsApp notifications are sent",normalized:"A stored value was out of range and was corrected - save to confirm",budget:"Share of the account budget",budgetHint:"The rest stays for service-management messages and verification codes",budgetCritical:"Share for critical",budgetCriticalHint:"Critical notifications and escalations may use up to this",detail:"Detail in the message",detailHint:"The text of the alert itself is never sent to WhatsApp",detail_generic:"Generic",detail_type_place:"Type and place",mine_title:"My WhatsApp",mine_sub:"Notifications to your own WhatsApp, only after you confirmed the number yourself",mine_number:"Number",mine_src_directory:"From the contact list",mine_src_profile:"From the profile",mine_status:"Status",mine_on:"Receiving notifications",mine_off:"Not receiving notifications",mine_changed:"The number changed - confirm again to receive notifications",mine_declined:"The contact list says WhatsApp is not the preferred channel",mine_none:"You have no WhatsApp number in the contact list",mine_confirm:"Confirm the number and receive notifications",mine_stop:"Stop WhatsApp notifications",on:"On",off:"Off",attention:"Needs attention",title:"WhatsApp",sub:"Notifications to the user's own phone, from the account chosen in the message channel",enabled:"Send notifications on WhatsApp",enabledHint:"Off = no notification is sent on WhatsApp, even when a policy selects it",account:"Sending account",accountNone:"No account chosen",accountPick:"Choose an account",st_connected:"Connected",st_disconnected:"Disconnected",st_unknown:"Unknown",st_missing:"Not found",reach:"Users with a number",reachHint:"A number from the contact list, when WhatsApp is the preferred channel",cap:"Per user per hour",capHint:"Critical notifications and escalations are not counted",dedupe:"No repeats within",minutes:"min",test:"Send a test",testing:"Sending…",testHint:"Sent only to your own number ({masked})",testNoNumber:"You have no WhatsApp number in the contact list",testOk:"The test message was sent",testFail:"The test failed",warnOffAccount:"No sending account - notifications will not be sent",saved:"Saved",loading:"Loading…",error:"The WhatsApp settings could not be loaded",retry:"Try again",less:"Less",more:"More"},te={keyUnreadable:"تعذّرت قراءة مفتاح الرسائل في النظام - لا يمكن التحقق من الموافقات، لذلك لا تُرسل إشعارات واتساب",normalized:"كانت قيمة محفوظة خارج النطاق وتم تصحيحها - احفظ للتأكيد",budget:"حصة من ميزانية الحساب",budgetHint:"الباقي محفوظ لرسائل إدارة الخدمة ورموز التحقق",budgetCritical:"حصة الحرج",budgetCriticalHint:"يمكن للإشعارات الحرجة والتصعيد استخدام حتى هذا الحد",detail:"التفاصيل في الرسالة",detailHint:"نص الإشعار نفسه لا يُرسل إلى واتساب",detail_generic:"عام",detail_type_place:"النوع والمكان",mine_title:"واتساب الخاص بي",mine_sub:"إشعارات إلى واتساب الشخصي، فقط بعد أن تؤكد الرقم بنفسك",mine_number:"الرقم",mine_src_directory:"من قائمة جهات الاتصال",mine_src_profile:"من الملف الشخصي",mine_status:"الحالة",mine_on:"تصلك الإشعارات",mine_off:"لا تصلك الإشعارات",mine_changed:"تغيّر الرقم - أكّد مجددًا لتلقي الإشعارات",mine_declined:"قائمة جهات الاتصال تقول إن واتساب ليس القناة المفضلة",mine_none:"لا يوجد لديك رقم واتساب في قائمة جهات الاتصال",mine_confirm:"تأكيد الرقم وتلقي الإشعارات",mine_stop:"إيقاف إشعارات واتساب",on:"مفعّل",off:"مطفأ",attention:"يحتاج إلى معالجة",title:"واتساب",sub:"إشعارات إلى الهاتف الشخصي للمستخدم، من الحساب المختار في قناة الرسائل",enabled:"إرسال الإشعارات عبر واتساب",enabledHint:"مطفأ = لا يُرسل أي إشعار عبر واتساب حتى لو تم اختياره في السياسة",account:"الحساب المرسِل",accountNone:"لم يتم اختيار حساب",accountPick:"اختيار حساب",st_connected:"متصل",st_disconnected:"غير متصل",st_unknown:"غير معروف",st_missing:"غير موجود",reach:"مستخدمون لديهم رقم",reachHint:"رقم من قائمة جهات الاتصال، عندما يكون واتساب هو القناة المفضلة",cap:"لكل مستخدم في الساعة",capHint:"الإشعارات الحرجة والتصعيد لا تُحتسب",dedupe:"بدون تكرار خلال",minutes:"دقيقة",test:"إرسال اختبار",testing:"جارٍ الإرسال…",testHint:"يُرسل إلى رقمك فقط ({masked})",testNoNumber:"لا يوجد لديك رقم واتساب في قائمة جهات الاتصال",testOk:"تم إرسال رسالة الاختبار",testFail:"فشل الاختبار",warnOffAccount:"لا يوجد حساب مرسِل - لن تُرسل الإشعارات",saved:"تم الحفظ",loading:"جارٍ التحميل…",error:"تعذّر تحميل إعدادات واتساب",retry:"إعادة المحاولة",less:"أقل",more:"أكثر"},ee={keyUnreadable:"Не удалось прочитать ключ сообщений системы — согласия нельзя проверить, поэтому уведомления WhatsApp не отправляются",normalized:"Сохранённое значение было вне диапазона и исправлено — сохраните для подтверждения",budget:"Доля бюджета аккаунта",budgetHint:"Остальное остаётся для сообщений управления сервисом и кодов подтверждения",budgetCritical:"Доля для критических",budgetCriticalHint:"Критические уведомления и эскалации могут использовать до этого предела",detail:"Подробность сообщения",detailHint:"Сам текст уведомления в WhatsApp не отправляется",detail_generic:"Общее",detail_type_place:"Тип и место",mine_title:"Мой WhatsApp",mine_sub:"Уведомления на ваш WhatsApp, только после того как вы сами подтвердили номер",mine_number:"Номер",mine_src_directory:"Из списка контактов",mine_src_profile:"Из профиля",mine_status:"Статус",mine_on:"Уведомления приходят",mine_off:"Уведомления не приходят",mine_changed:"Номер изменился — подтвердите снова, чтобы получать уведомления",mine_declined:"В списке контактов WhatsApp не указан как предпочтительный канал",mine_none:"У вас нет номера WhatsApp в списке контактов",mine_confirm:"Подтвердить номер и получать уведомления",mine_stop:"Остановить уведомления WhatsApp",on:"Включено",off:"Выключено",attention:"Требует внимания",title:"WhatsApp",sub:"Уведомления на личный телефон пользователя с аккаунта, выбранного в канале сообщений",enabled:"Отправлять уведомления в WhatsApp",enabledHint:"Выключено = ни одно уведомление не отправляется в WhatsApp, даже если оно выбрано в политике",account:"Аккаунт отправителя",accountNone:"Аккаунт не выбран",accountPick:"Выбрать аккаунт",st_connected:"Подключён",st_disconnected:"Отключён",st_unknown:"Неизвестно",st_missing:"Не найден",reach:"Пользователи с номером",reachHint:"Номер из списка контактов, если WhatsApp — предпочтительный канал",cap:"На пользователя в час",capHint:"Критические уведомления и эскалации не учитываются",dedupe:"Без повторов в течение",minutes:"мин",test:"Отправить тест",testing:"Отправка…",testHint:"Отправляется только на ваш номер ({masked})",testNoNumber:"У вас нет номера WhatsApp в списке контактов",testOk:"Тестовое сообщение отправлено",testFail:"Тест не удался",warnOffAccount:"Нет аккаунта отправителя — уведомления не будут отправлены",saved:"Сохранено",loading:"Загрузка…",error:"Не удалось загрузить настройки WhatsApp",retry:"Повторить",less:"Меньше",more:"Больше"};function C(){const t=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return t.startsWith("en")?"en":t.startsWith("ar")?"ar":t.startsWith("ru")?"ru":"he"}const se={he:et,en:Jt,ar:te,ru:ee};function c(t,e,a=C()){const s=se[a][t]??et[t]??t;return e?s.replace(/\{(\w+)\}/g,(i,n)=>n in e?String(e[n]):i):s}const w={stepCap(t,e){const[a,s]=t.ranges.per_user_hour;return Math.min(s,Math.max(a,t.per_user_hour+e))},warning(t){return t.enabled&&!t.account.mapped?"no_account":null},tone(t){return t.enabled?t.account.mapped&&t.account.state==="connected"?"ok":"bad":"off"},canTest(t){return t.test.own_number&&t.account.mapped},stepPct(t,e,a){const[s,i]=t.ranges[e],n=Math.min(i,Math.max(s,t[e]+a));return e==="budget_pct"?{budget_pct:n,budget_critical_pct:Math.max(n,t.budget_critical_pct)}:{budget_pct:Math.min(t.budget_pct,n),budget_critical_pct:n}},canStop(t){return!!t&&t.channel_enabled&&(t.opted_in||!!t.stored_opt_in)},mineState(t){return!t||!t.channel_enabled?"hidden":t.has_number?t.directory_declined?"declined":t.number_changed?"changed":t.opted_in?"on":"off":"none"}};var ae=Object.defineProperty,ie=Object.getOwnPropertyDescriptor,k=(t,e,a,s)=>{for(var i=s>1?void 0:s?ie(e,a):e,n=t.length-1,o;n>=0;n--)(o=t[n])&&(i=(s?o(e,a,i):o(i))||i);return s&&i&&ae(e,a,i),i};const ne=[5,15,30,60];let x=class extends B{constructor(){super(...arguments),this.sectionId="wa",this.view=null,this.phase="loading",this.busy=!1,this.result=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.phase="loading";try{this.view=await y().view(),this.phase="ready"}catch{this.phase="error"}}errText(t){return t instanceof O?t.body.user_message||t.code:c("error")}async save(t){const e=this.view;if(!(!e||this.busy)){this.view={...e,...t},this.busy=!0,this.error="";try{this.view=await y().save({...t,revision:e.revision}),this.dispatchEvent(new CustomEvent("notify-saved",{bubbles:!0,composed:!0,detail:{text:c("saved")}}))}catch(a){this.error=this.errText(a),await this.load()}finally{this.busy=!1}}}async test(){this.busy=!0,this.result=null;try{const t=await y().test();this.result={ok:t.ok,text:t.ok?c("testOk"):`${c("testFail")} · ${t.code??t.outcome}`}}catch(t){this.result={ok:!1,text:this.errText(t)}}finally{this.busy=!1}}stateTag(t){const e=t.account;if(!e.mapped)return r`<span class="tag bad" data-wa-account-state="none">${c("accountNone")}</span>`;const a=e.state??"unknown";return r`<span class="tag ${a==="connected"?"ok":a==="unknown"?"":"bad"}" data-wa-account-state=${a}>${c(`st_${a}`)}</span>`}render(){const t=C()==="he"||C()==="ar"?"rtl":"ltr";if(this.phase==="loading")return r`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="loading" aria-busy="true" dir=${t}><span class="skl"></span><span class="skl"></span></section>`;if(this.phase==="error"||!this.view)return r`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="error" dir=${t}><div class="warn" role="alert">${l("warning")}${c("error")}</div><div><button type="button" class="btn sm" data-wa-retry @click=${()=>void this.load()}>${l("refresh")}${c("retry")}</button></div></section>`;const e=this.view,a=w.tone(e),s=!e.enabled,i=w.warning(e);return r`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="ready" data-wa-enabled=${String(e.enabled)} dir=${t}>
      <header><h2>${l("chat")}${c("title")}</h2><div class="sp"><button type="button" class="tog" role="switch" aria-checked=${String(e.enabled)} aria-label=${c("enabled")} data-wa-switch ?disabled=${this.busy} @click=${()=>void this.save({enabled:!e.enabled})}></button></div></header>
      <p class="sub">${c("sub")}</p>
      <div class="frow"><div class="l"><b>${c("enabled")}</b><small>${c("enabledHint")}</small></div><div class="r"><span class="tag ${a==="ok"?"ok":a==="bad"?"bad":""}" data-wa-tone=${a}>${l(a==="ok"?"check":a==="bad"?"warning":"moon")}${c(a==="ok"?"on":a==="bad"?"attention":"off")}</span></div></div>
      ${i?r`<div class="warn" role="alert" data-wa-warning=${i}>${l("warning")}${c("warnOffAccount")}</div>`:v}
      ${e.warnings?.includes("messaging_key_unreadable")?r`<div class="warn" role="alert" data-wa-key-warning>${l("warning")}${c("keyUnreadable")}</div>`:v}
      ${e.normalized?.length?r`<div class="warn" role="status" data-wa-normalized=${e.normalized.join(",")}>${l("warning")}${c("normalized")}</div>`:v}
      <div class="frow"><div class="l"><b>${c("account")}</b>${e.account.mapped&&e.account.label?r`<small data-wa-account-label>${e.account.label}</small>`:v}</div><div class="r">${this.stateTag(e)}<a class="lnk" href=${e.accounts_href} data-wa-accounts-link>${c("accountPick")}</a></div></div>
      <div class="frow"><div class="l"><b>${c("reach")}</b><small>${c("reachHint")}</small></div><div class="r"><span class="tag" data-wa-reach><span class="n">${e.reachable_users}</span></span></div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${c("cap")}</b><small>${c("capHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-cap-step="-1" aria-label=${c("less")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:w.stepCap(e,-1)})}>${l("minus")}</button><span class="vv" data-wa-cap><span class="n">${e.per_user_hour}</span></span><button type="button" data-wa-cap-step="1" aria-label=${c("more")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:w.stepCap(e,1)})}>${l("plus")}</button></span></div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${c("dedupe")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${c("dedupe")}>${ne.map(n=>r`<button type="button" aria-pressed=${String(e.dedupe_min===n)} data-wa-dedupe=${n} ?disabled=${this.busy} @click=${()=>void this.save({dedupe_min:n})}><span class="n">${n}</span> ${c("minutes")}</button>`)}</div></div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${c("detail")}</b><small>${c("detailHint")}</small></div><div class="r"><div class="seg sm" role="group" aria-label=${c("detail")}>${e.detail_levels.map(n=>r`<button type="button" aria-pressed=${String(e.detail===n)} data-wa-detail=${n} ?disabled=${this.busy} @click=${()=>void this.save({detail:n})}>${c(`detail_${n}`)}</button>`)}</div></div></div>
      ${["budget_pct","budget_critical_pct"].map(n=>r`<div class="frow ${s?"dis":""}"><div class="l"><b>${c(n==="budget_pct"?"budget":"budgetCritical")}</b><small>${c(n==="budget_pct"?"budgetHint":"budgetCriticalHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-budget-step=${`${n}:-10`} aria-label=${c("less")} ?disabled=${this.busy} @click=${()=>void this.save(w.stepPct(e,n,-10))}>${l("minus")}</button><span class="vv" data-wa-budget=${n}><span class="n">${e[n]}</span><small>%</small></span><button type="button" data-wa-budget-step=${`${n}:10`} aria-label=${c("more")} ?disabled=${this.busy} @click=${()=>void this.save(w.stepPct(e,n,10))}>${l("plus")}</button></span></div></div>`)}
      <div class="frow"><div class="l"><b>${c("test")}</b><small data-wa-test-hint>${e.test.own_number?c("testHint",{masked:`⁦${e.test.masked??""}⁩`}):c("testNoNumber")}</small></div><div class="r">${this.result?r`<span class="tag ${this.result.ok?"ok":"bad"}" data-wa-test-result=${this.result.ok?"ok":"bad"}>${l(this.result.ok?"check":"warning")}${this.result.text}</span>`:v}<button type="button" class="btn quiet" data-wa-test ?disabled=${this.busy||!w.canTest(e)} @click=${()=>void this.test()}>${l(this.busy?"refresh":"send")}${this.busy?c("testing"):c("test")}</button></div></div>
      ${this.error?r`<div class="warn" role="alert" data-wa-error>${this.error}</div>`:v}
    </section>`}};x.styles=[H,I,M,U`
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
    `];k([tt({attribute:"section-id"})],x.prototype,"sectionId",2);k([d()],x.prototype,"view",2);k([d()],x.prototype,"phase",2);k([d()],x.prototype,"busy",2);k([d()],x.prototype,"result",2);k([d()],x.prototype,"error",2);x=k([D("notify-whatsapp-section")],x);var re=Object.defineProperty,oe=Object.getOwnPropertyDescriptor,R=(t,e,a,s)=>{for(var i=s>1?void 0:s?oe(e,a):e,n=t.length-1,o;n>=0;n--)(o=t[n])&&(i=(s?o(e,a,i):o(i))||i);return s&&i&&re(e,a,i),i};let z=class extends B{constructor(){super(...arguments),this.mine=null,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}reload(){this.load()}async load(){try{this.mine=await y().mine()}catch{this.mine=null}}async set(t){this.busy=!0,this.error="";try{this.mine=await y().setOptIn(t,t?this.mine?.confirm??null:null)}catch(e){this.error=e instanceof O?e.body.user_message||e.code:c("error"),e instanceof O&&e.code==="number_changed"&&this.load()}finally{this.busy=!1}}render(){const t=w.mineState(this.mine);if(t==="hidden")return v;const e=this.mine,a=C()==="he"||C()==="ar"?"rtl":"ltr",s=t==="on"?r`<span class="tag ok" data-wa-mine-status="on">${l("check")}${c("mine_on")}</span>`:t==="changed"?r`<span class="tag bad" data-wa-mine-status="changed">${l("warning")}${c("mine_changed")}</span>`:t==="declined"?r`<span class="tag" data-wa-mine-status="declined">${c("mine_declined")}</span>`:t==="none"?r`<span class="tag" data-wa-mine-status="none">${c("mine_none")}</span>`:r`<span class="tag" data-wa-mine-status="off">${c("mine_off")}</span>`;return r`<div class="box" data-wa-mine data-wa-mine-state=${t} dir=${a}>
      <h3>${l("chat")}${c("mine_title")}</h3>
      <p class="sub">${c("mine_sub")}</p>
      ${e.has_number?r`<div class="row"><b>${c("mine_number")}</b><span class="n" data-wa-mine-number>${e.masked}</span><small>${c(e.source==="profile"?"mine_src_profile":"mine_src_directory")}</small></div>`:v}
      <div class="row"><b>${c("mine_status")}</b>${s}</div>
      ${t==="off"||t==="changed"?r`<div class="acts"><button type="button" class="btn primary sm" data-wa-mine-confirm ?disabled=${this.busy} @click=${()=>void this.set(!0)}>${l("check")}${c("mine_confirm")}</button></div>`:v}
      ${w.canStop(e)?r`<div class="acts"><button type="button" class="btn quiet sm" data-wa-mine-stop ?disabled=${this.busy} @click=${()=>void this.set(!1)}>${c("mine_stop")}</button></div>`:v}
      ${this.error?r`<div class="warn" role="alert" data-wa-mine-error>${this.error}</div>`:v}
    </div>`}};z.styles=[H,I,M,U`
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
    `];R([d()],z.prototype,"mine",2);R([d()],z.prototype,"busy",2);R([d()],z.prototype,"error",2);z=R([D("notify-whatsapp-mine")],z);var le=Object.defineProperty,ce=Object.getOwnPropertyDescriptor,h=(t,e,a,s)=>{for(var i=s>1?void 0:s?ce(e,a):e,n=t.length-1,o;n>=0;n--)(o=t[n])&&(i=(s?o(e,a,i):o(i))||i);return s&&i&&le(e,a,i),i};const f=[{id:"sources",label:"מקורות והרשאות – מה נשלח",icon:"list"},{id:"quiet",label:"שעות שקט ומה עובר",icon:"moon"},{id:"esc",label:"הסלמה",icon:"escal"},{id:"lock",label:"פרטיות מסך נעול",icon:"lock"},{id:"keep",label:"שמירה",icon:"calendar"},{id:"mail",label:"דואר יוצא",icon:"mail"},{id:"wa",label:"וואטסאפ",icon:"chat"},{id:"chan",label:"ערוצים",icon:"phone"},{id:"log",label:"יומן מסירה וכשלים",icon:"inbox"}],de=[{id:"u-yoni",name:"יוני"},{id:"u-dana",name:"דנה"},{id:"u-uri",name:"אורי"},{id:"u-roni",name:"רוני"}],W=["scope","managers","initiator","users"],pe={sent:"check",failed:"warning",gone:"warning",skipped:"moon",queued:"clock",retry:"refresh"},he={sent:"ok",failed:"bad",gone:"bad",skipped:"skp",queued:"skp",retry:"skp"},ue=()=>"14 יום",be=t=>({linkBase:t.email.link_base??"",host:t.email.host,port:String(t.email.port),security:t.email.security,user:t.email.user,password:"",pwEdit:!t.email.password_set,from:t.email.from,recipients:t.email.recipients.join(", ")});let p=class extends B{constructor(){super(...arguments),this.bubbleSkin=new it(this),this.section="",this.phase="loading",this.error="",this.settings=null,this.policies=[],this.stats=null,this.log=[],this.titles={},this.users=null,this.devices=0,this.wa=null,this.onlyFailed=!1,this.sec="sources",this.phone=window.matchMedia("(max-width: 1099px)").matches,this.toast=null,this.invalid=null,this.mail={linkBase:"",host:"",port:"587",security:"starttls",user:"",password:"",pwEdit:!0,from:"",recipients:""},this.mailBusy=null,this.mailResult=null,this.mailError="",this.picker=null,this.now=Date.now(),this.clockOffset=0,this.offClock=null,this.tz=void 0,this.rev=1,this.chain=Promise.resolve(),this.toastTimer=0,this.phoneMq=window.matchMedia("(max-width: 1099px)"),this.obs=null,this.onMq=()=>this.phone=this.phoneMq.matches,this.nameOf=t=>{if(t==="managers")return"מנהלי התראות";const e=t.map(a=>this.users?.find(s=>s.id===a)?.name??a);return e.length?e.join(", "):"משתמשים נבחרים"}}connectedCallback(){super.connectedCallback(),nt(this),this.phoneMq.addEventListener("change",this.onMq),this.load(),this.offClock=rt(()=>this.now=Date.now()+this.clockOffset)}disconnectedCallback(){this.offClock?.(),this.offClock=null,this.phoneMq.removeEventListener("change",this.onMq),this.obs?.disconnect(),window.clearTimeout(this.toastTimer),super.disconnectedCallback()}willUpdate(t){t.has("section")&&f.some(e=>e.id===this.section)&&(this.sec=this.section)}updated(t){t.has("phase")&&this.phase==="ready"&&!this.phone&&this.watchSections()}async load(){this.phase="loading",this.error="";try{if(await ot.prepare(),E()&&!lt("notify.manage")){this.phase="user";return}const t=_();let e;try{e=await t.settings()}catch(m){if(ct(m)==="forbidden"){this.phase="user";return}throw m}const[a,s,i,n,o,u,b,g]=await Promise.all([t.policies(),t.stats().catch(()=>null),t.adminDeliveries({limit:200}).catch(()=>[]),t.list({limit:100}).catch(()=>null),this.loadUsers(),this.countDevices(),this.clockAndZone(),y().view().catch(()=>null)]);this.wa=g,this.settings=e,this.rev=e.revision,this.policies=a,this.stats=s,this.log=i,this.titles=Object.fromEntries((n?.notifications??[]).map(m=>[m.id,m.title])),this.users=o,this.devices=u,this.now=b.now,this.clockOffset=b.now-Date.now(),this.tz=b.tz,this.mail=be(e),this.mailResult=null,this.phase="ready"}catch(t){this.error=S(t),this.phase="error"}}async clockAndZone(){if(E()){const e=await dt().catch(()=>({}));return{now:Date.now(),tz:typeof e["time.zone"]=="string"?e["time.zone"]:void 0}}const t=await N(()=>import("./notifications-mock-2lRNSaJ-.js"),__vite__mapDeps([0]),import.meta.url);return{now:t.notifyMock().clock,tz:t.MOCK_TZ}}async loadUsers(){if(!E())return de;try{const{listUsers:t}=await N(async()=>{const{listUsers:e}=await import("./access-DhQN4Ez1.js");return{listUsers:e}},__vite__mapDeps([0]),import.meta.url);return(await t()).users.filter(e=>e.active).map(e=>({id:e.id,name:e.name||e.username}))}catch{return null}}async countDevices(){if(!E())return(await N(async()=>{const{notifyMock:t}=await import("./notifications-mock-2lRNSaJ-.js");return{notifyMock:t}},__vite__mapDeps([0]),import.meta.url)).notifyMock().registered;try{return(await pt()).subscriptions.length}catch{return 0}}watchSections(){this.obs?.disconnect(),"IntersectionObserver"in window&&(this.obs=new IntersectionObserver(t=>{const a=t.filter(s=>s.isIntersecting).sort((s,i)=>s.boundingClientRect.top-i.boundingClientRect.top)[0]?.target?.dataset.setSection;a&&(this.sec=a)},{root:this,rootMargin:"-80px 0px -65% 0px"}),this.renderRoot.querySelectorAll("[data-set-section]").forEach(t=>this.obs?.observe(t)))}say(t,e=!1){this.toast={text:t,bad:e},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,3e3)}enqueue(t){this.chain=this.chain.then(t).catch(()=>{})}async conflict(t){this.say(S(t),!0),await this.load()}patchSettings(t){if(!this.settings)return;this.settings={...this.settings,...t};const e=ht(j(this.settings));this.invalid=e,!e&&this.enqueue(async()=>{if(this.settings)try{const a=await _().saveSettings(j(this.settings),this.rev);this.rev=a.revision,this.say("נשמר")}catch(a){await this.conflict(a)}})}patchPolicy(t,e){const a=this.policies.find(i=>i.source===t);if(!a)return;let s;try{s=e(a)}catch(i){this.say(S(i),!0);return}this.policies=this.policies.map(i=>i.source===t?s:i),this.enqueue(async()=>{const i=this.policies.find(n=>n.source===t);if(i)try{const n=await _().savePolicy(t,ut(i),i.revision);this.policies=this.policies.map(o=>o.source===t?{...o,revision:n.revision}:o),this.say("נשמר")}catch(n){await this.conflict(n)}})}setSec(t){this.sec=t,this.phone||this.renderRoot.querySelector(`[data-set-section="${t}"]`)?.scrollIntoView({behavior:"smooth",block:"start"})}mailBody(){const t=this.mail,e={host:t.host.trim(),port:Number(t.port),security:t.security,user:t.user.trim(),from:t.from.trim(),recipients:bt(t.recipients),link_base:t.linkBase.trim()};return t.pwEdit&&t.password&&(e.password=t.password),vt(e)?null:e}async saveMail(){const t=this.mailBody();if(!t){this.mailError=P.email_invalid;return}this.mailError="",this.mailBusy="save";try{const e=await _().saveEmail(t);this.settings&&(this.settings={...this.settings,email:e}),this.mailResult=null,this.mail={...this.mail,password:"",pwEdit:!e.password_set},this.say("הגדרות הדואר נשמרו")}catch(e){this.mailError=S(e)}finally{this.mailBusy=null}}async testMail(){this.mailBusy="test",this.mailError="";try{this.mailResult=await _().testEmail();const t=await _().settings().catch(()=>null);t&&this.settings&&(this.settings={...this.settings,email:t.email})}catch(t){this.mailResult=null,this.mailError=S(t)}finally{this.mailBusy=null}}openPicker(t){const e=t==="esc"?Array.isArray(this.settings?.escalation.to)?this.settings?.escalation.to:[]:this.policies.find(a=>a.source===t)?.recipients.user_ids??[];this.picker={target:t,selected:[...e]}}savePicker(){const t=this.picker;if(!(!t||!t.selected.length)){if(t.target==="esc")this.patchSettings({escalation:{...this.settings.escalation,to:t.selected}});else{const e=t.selected;this.patchPolicy(t.target,a=>({...a,recipients:{rule:"users",user_ids:e}}))}this.picker=null}}sevSeg(t,e){return r`<span class="sevseg" role="radiogroup" aria-label="חומרה">${Y.slice().reverse().map(a=>r`<button type="button" role="radio" aria-checked=${String(e===a)} aria-pressed=${String(e===a)} data-pol-sev=${`${t}:${a}`} style=${`--sev:var(--nt-sev-${a})`} title=${A[a]} @click=${()=>this.patchPolicy(t,s=>mt(s,a))}><i aria-hidden="true"></i>${A[a]}</button>`)}</span>`}whoSel(t){const e=gt.includes(t.source),a=this.settings?ft(t,this.settings):t.recipients.rule,s=e?a:t.recipients.rule;return r`<select class="inp sm" data-pol-who=${t.source} aria-label="מי מקבל" ?disabled=${e} @change=${i=>{const n=i.target.value;n==="users"?(this.openPicker(t.source),i.target.value=s):this.patchPolicy(t.source,o=>wt(o,n))}}>${(W.includes(s)?W:[...W,s]).map(i=>r`<option value=${i} .selected=${s===i}>${i==="users"&&t.recipients.rule==="users"?`${V.users} (${t.recipients.user_ids?.length??0})`:V[i]}</option>`)}</select>`}chans(t){const e=this.settings,a=T(t,"webpush",e),s=T(t,"email",e),i=T(t,"app",e),n=T(t,"whatsapp",e,this.wa),o={email:'הדוא"ל לא מוגדר',whatsapp:"וואטסאפ כבוי"},u=(b,g,m)=>r`<button type="button" class=${X({chip:!0,unconf:g.note==="unconfigured"})} aria-pressed=${String(g.on)} data-pol-ch=${`${t.source}:${b}`} title=${g.note==="unconfigured"?o[b]??"":""} @click=${()=>this.patchPolicy(t.source,st=>Dt(st,b,!g.on))}>${l(m)}${$[b]}</button>`;return r`<span class="chs"><span class="chip lock" title="תמיד">${l("inbox")}${$.inbox}</span>${u("webpush",a,"phone")}${u("email",s,"mail")}${u("app",i,"phone")}${u("whatsapp",n,"chat")}<span class="chip soon" aria-disabled="true" title="Companion – בקרוב" aria-label="Companion – בקרוב">${l("phone")}</span></span>`}tog(t,e,a,s,i=!1){return r`<button type="button" class="tog" role="switch" aria-checked=${String(t)} aria-label=${a} ?disabled=${i} data-tog=${e} @click=${s}></button>`}polToggle(t){return r`<button type="button" class="tog" role="switch" aria-checked=${String(t.enabled)} aria-label="פעיל" data-pol-on=${t.source} @click=${()=>this.patchPolicy(t.source,e=>({...e,enabled:!e.enabled}))}></button>`}renderSources(){const t=xt("nvr")?this.policies:this.policies.filter(o=>!$t(o.source)),e=yt(t,[...J,...Ft,...jt,...Yt,...Vt]),a=t.length,s=o=>o==="rule.alert"||J.find(u=>u.key===o)?.rulesOnly===!0,i=this.settings;let n;return this.phone?n=r`<div class="scards">${e.flatMap(o=>o.rows).map(({info:o,policy:u})=>r`<section class="glass scard ${u.enabled?"":"off"}" data-pol-row=${u.source}>
        <div class="top"><span class="nm"><span class="ring">${l(o.icon)}</span></span><b>${o.label}</b>${this.polToggle(u)}</div>
        <div class="ln"><small>חומרה</small>${s(u.source)?r`<span class="tag">לפי החוק</span>`:this.sevSeg(u.source,u.severity)}</div>
        <div class="ln"><small>מי מקבל</small>${this.whoSel(u)}</div>
        <div class="ln"><small>ערוצים</small>${this.chans(u)}</div></section>`)}</div>`:n=r`<div class="mxw"><table class="mx"><colgroup><col style="width:20%"><col style="width:7%"><col style="width:24%"><col style="width:18%"><col></colgroup>
        <thead><tr><th>מקור</th><th class="c">פעיל</th><th>חומרה</th><th>מי מקבל</th><th>ערוצים</th></tr></thead>
        <tbody>${e.map(o=>r`<tr class="cat"><td colspan="5">${l(o.icon)}${o.label}</td></tr>${o.rows.map(({info:u,policy:b})=>r`<tr class=${b.enabled?"":"off"} data-pol-row=${b.source}>
          <td class="keep"><span class="nm"><span class="ring">${l(u.icon)}</span><b>${u.label}</b></span></td>
          <td class="c keep">${this.polToggle(b)}</td>
          <td>${s(b.source)?r`<span class="tag">לפי החוק</span>`:this.sevSeg(b.source,b.severity)}</td>
          <td>${this.whoSel(b)}</td><td>${this.chans(b)}</td></tr>`)}`)}</tbody></table></div>`,r`<section class="glass sec" data-set-section="sources" id="sec-sources"><header><h2>${l("list")}${f[0].label}</h2><div class="sp"><span class="tag soon">${l("phone")}Companion – בקרוב</span><span class="tag" data-pol-count>${kt(this.policies)} מתוך ${a} פעילים</span></div></header>
      <div class="frow"><div class="l"><b>כשל בתזמון או באוטומציה מגיע אל</b></div><div class="r"><div class="seg sm" role="group" aria-label="כשל בתזמון או באוטומציה">${_t.map(o=>r`<button type="button" aria-pressed=${String(i.failures_audience===o)} data-failures-audience=${o} @click=${()=>this.patchSettings({failures_audience:o})}>${o==="admins"?"מנהלים":"כל מי שרואה"}</button>`)}</div></div></div>
      ${n}</section>`}renderQuiet(){const t=this.settings,e=t.quiet,a=!e.enabled;return r`<section class="glass sec" data-set-section="quiet" id="sec-quiet"><header><h2>${l("moon")}${f[1].label}</h2><div class="sp">${this.tog(e.enabled,"quiet-on","שעות שקט",()=>this.patchSettings({quiet:{...e,enabled:!e.enabled}}))}</div></header>
      <div class="frow ${a?"dis":""}"><div class="l"><b>שעות</b></div><div class="r"><input class="inp sm ltr" type="time" lang=${K()} data-quiet-from aria-label="מהשעה" style="inline-size:112px" .value=${e.from} ?disabled=${a} @change=${s=>this.setTime("from",s.target.value)} /><span>עד</span><input class="inp sm ltr" type="time" lang=${K()} data-quiet-to aria-label="עד השעה" style="inline-size:112px" .value=${e.to} ?disabled=${a} @change=${s=>this.setTime("to",s.target.value)} /></div></div>
      ${this.invalid==="quiet_invalid"?r`<div class="errline" data-set-error>${P.quiet_invalid}</div>`:v}
      <div class="frow ${a?"dis":""}"><div class="l"><b>ימים</b></div><div class="r"><div class="days" role="group" aria-label="ימים">${zt.map(s=>r`<button type="button" aria-pressed=${String(e.days.includes(s))} data-quiet-day=${s} ?disabled=${a} @click=${()=>this.patchSettings({quiet:{...e,days:Et(e.days,s)}})}>${St[s]}</button>`)}</div></div></div>
      <div class="frow ${a?"dis":""}" style="align-items:flex-start"><div class="l"><b>מה עובר בשעות שקט</b></div></div>
      <table class="qmx ${a?"dis":""}"><thead><tr><th>חומרה</th><th>${$.webpush}</th><th>${$.email}</th><th>${$.whatsapp}</th><th>Companion</th></tr></thead><tbody>${Y.slice().reverse().map(s=>r`<tr><td><span class="sv" style=${`--sev:var(--nt-sev-${s})`}><i></i>${A[s]}</span></td>
        ${["webpush","email","whatsapp"].map(i=>r`<td><button type="button" class="chk" role="checkbox" aria-checked=${String(t.pass_through[s][i]??!1)} aria-label=${`${A[s]} · ${$[i]}`} data-pass=${`${s}:${i}`} ?disabled=${a} @click=${()=>this.patchSettings({pass_through:Ct(t.pass_through,s,i)})}>${l("check")}</button></td>`)}
        <td><button type="button" class="chk" role="checkbox" aria-checked=${String(t.pass_through[s].ha_mobile)} aria-label="Companion – בקרוב" disabled>${l("check")}</button></td></tr>`)}</tbody></table></section>`}setTime(t,e){!this.settings||!Number.isFinite(At(e))||this.patchSettings({quiet:{...this.settings.quiet,[t]:e}})}renderEsc(){const e=this.settings.escalation,a=!e.enabled,s=e.to!=="managers",i=o=>this.patchSettings({escalation:{...e,...o}}),n=Tt(e,842,this.nameOf);return r`<section class="glass sec" data-set-section="esc" id="sec-esc"><header><h2>${l("escal")}${f[2].label}</h2><div class="sp">${this.tog(e.enabled,"esc-on","הסלמה",()=>i({enabled:!e.enabled}))}</div></header>
      <div class="frow ${a?"dis":""}"><div class="l"><b>אחרי</b><small>קריטי בלי אישור</small></div><div class="r"><span class="stp"><button type="button" data-esc-step="-1" aria-label="פחות" @click=${()=>this.patchSettings({escalation:G(e,-1)})}>${l("minus")}</button><span class="vv" data-esc-min><span class="n">${e.after_min}</span><small>דק׳</small></span><button type="button" data-esc-step="1" aria-label="יותר" @click=${()=>this.patchSettings({escalation:G(e,1)})}>${l("plus")}</button></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>שלבים</b></div><div class="r"><div class="seg sm" role="group" aria-label="שלבים">${[1,2,3].map(o=>r`<button type="button" aria-pressed=${String(e.steps===o)} data-esc-steps=${o} @click=${()=>i({steps:o})}>${o}</button>`)}</div></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>אל</b></div><div class="r"><div class="seg sm" role="group" aria-label="אל"><button type="button" aria-pressed=${String(!s)} data-esc-to="managers" @click=${()=>i({to:"managers"})}>מנהלי התראות</button><button type="button" aria-pressed=${String(s)} data-esc-to="users" @click=${()=>this.openPicker("esc")}>משתמשים נבחרים</button></div>${s?r`<span class="tag" data-esc-names>${this.nameOf(e.to)}</span>`:v}</div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>נעצרת באישור</b></div><div class="r"><span class="tag ok">${l("lock")}תמיד</span></div></div>
      ${this.invalid==="escalation_invalid"?r`<div class="errline" data-set-error>${P.escalation_invalid}</div>`:v}
      <div class="escprev ${a?"dis":""}" data-esc-preview><div class="tl">${n.map(o=>r`<div class="ev ${o.kind}"><span class="t">${o.clock}</span><span class="d"><i></i></span><span class="b"><b>${o.title}</b><small>${o.sub}</small></span></div>`)}</div></div></section>`}lockPhone(t,e){const a=Ot(t,this.tz);return r`<div class=${X({lphone:!0,sel:e})} data-lock-phone=${t} data-lock-selected=${String(e)}><span class="notch"></span><span class="llabel">${l("lock")}${Q[t]}</span>
      <div class="ltime n">14:10</div><div class="ldate">יום רביעי, 1 באוקטובר</div>
      <div class="lcards">${(t==="generic"?a.slice(0,1):a).map(s=>r`<div class="pushcard" data-push-card><div class="ph"><span class="app">S</span>Arx<span class="ago">${s.ago}</span></div><b>${s.title}</b><p>${s.body}</p>
        <div class="acts">${s.actions.map(i=>r`<span class=${i.id==="open_door"?"door":""}>${l(i.id==="open"?"open":i.id==="ack"?"checkAll":i.id==="snooze"?"snooze":"doorOpen")}${i.label}</span>`)}</div></div>`)}</div></div>`}renderLock(){const t=this.settings;return r`<section class="glass sec" data-set-section="lock" id="sec-lock"><header><h2>${l("lock")}${f[3].label}</h2></header>
      <div class="frow"><div class="l"><b>רמת פירוט</b></div><div class="r"><div class="seg" role="group" aria-label="רמת פירוט">${Rt.map(e=>r`<button type="button" aria-pressed=${String(t.lockscreen===e)} data-lock-level=${e} @click=${()=>this.patchSettings({lockscreen:e})}>${Q[e]}</button>`)}</div></div></div>
      <div class="lockrow" data-lock-preview>${["generic","type_place","full"].map(e=>this.lockPhone(e,t.lockscreen===e))}</div>
      <div class="frow dis"><div class="l"><b>תמונה מהמצלמה בהתראה</b><small>התמונה נפתחת רק בתוך Arx</small></div><div class="r"><span class="tag soon">בקרוב</span>${this.tog(!1,"image-in-push","תמונה בהתראה",()=>{},!0)}</div></div>
      <div class="frow dis"><div class="l"><b>צליל קריטי שעוקף "נא לא להפריע"</b><small>בטיחות בלבד · טלפוני Companion</small></div><div class="r"><span class="tag soon">בקרוב</span>${this.tog(t.companion.critical_sound_safety,"critical-sound","צליל קריטי",()=>{},!0)}</div></div></section>`}renderKeep(){const t=this.settings;return r`<section class="glass sec" data-set-section="keep" id="sec-keep"><header><h2>${l("calendar")}${f[4].label}</h2></header>
      <div class="frow"><div class="l"><b>התראות</b></div><div class="r"><div class="seg sm" role="group" aria-label="שמירת התראות">${qt.map(e=>r`<button type="button" aria-pressed=${String(t.retention_days===e)} data-keep=${e} @click=${()=>this.patchSettings({retention_days:e})}>${e}</button>`)}</div><span>ימים</span></div></div>
      <div class="frow"><div class="l"><b>יומן מסירה</b></div><div class="r"><span class="tag"><span class="n">${t.deliveries_retention_days}</span> ימים</span></div></div></section>`}renderMail(){const t=this.settings,e=this.mail,a=t.email,s=n=>this.mail={...this.mail,...n},i=this.mailResult?this.mailResult.ok?r`<span class="tag ok" data-mail-result="ok">${l("check")}${Z(this.mailResult)}</span>`:r`<span class="tag bad" data-mail-result="bad">${l("warning")}${Z(this.mailResult)}</span>`:a.last_test?r`<span class="tag ${a.last_test.ok?"ok":"bad"}" data-mail-last>${l(a.last_test.ok?"check":"warning")}${a.last_test.ok?`נבדק ${Nt(a.last_test.at,this.tz)} · תקין`:`הבדיקה נכשלה · ${a.last_test.detail}`}</span>`:r`<span class="tag" data-mail-last>${a.configured?"לא נבדק":"לא מוגדר"}</span>`;return r`<section class="glass sec" data-set-section="mail" id="sec-mail"><header><h2>${l("mail")}${f[5].label}</h2><div class="sp">${i}</div></header>
      <div class="fgrid">
        <label>שרת<input class="inp ltr" data-mail-host .value=${e.host} @input=${n=>s({host:n.target.value})} /></label>
        <label>פורט<input class="inp ltr" inputmode="numeric" data-mail-port .value=${e.port} @input=${n=>s({port:n.target.value})} /></label>
        <label>אבטחה<select class="inp" data-mail-security @change=${n=>s({security:n.target.value})}>${["starttls","tls","none"].map(n=>r`<option value=${n} .selected=${e.security===n}>${n==="none"?"ללא":n==="tls"?"TLS":"STARTTLS"}</option>`)}</select></label>
        <label>משתמש<input class="inp ltr" data-mail-user .value=${e.user} @input=${n=>s({user:n.target.value})} /></label>
        <label>סיסמה<span style="display:flex;gap:8px"><input class="inp ltr" type="password" autocomplete="new-password" data-mail-password style="flex:1" .value=${e.pwEdit?e.password:"••••••••••"} ?readonly=${!e.pwEdit} @input=${n=>s({password:n.target.value})} />${a.password_set&&!e.pwEdit?r`<button type="button" class="btn quiet sm" data-mail-pw-change @click=${()=>s({pwEdit:!0,password:""})}>החלפה</button>`:v}</span></label>
        <label>מאת<input class="inp ltr" data-mail-from .value=${e.from} @input=${n=>s({from:n.target.value})} /></label>
        <label class="w2">נמענים<input class="inp ltr" data-mail-recipients .value=${e.recipients} @input=${n=>s({recipients:n.target.value})} /></label>
        <label class="w2">כתובת Arx לקישור<input class="inp ltr" data-mail-linkbase placeholder="https://" .value=${e.linkBase} @input=${n=>s({linkBase:n.target.value})} /></label>
      </div>
      ${this.mailError?r`<div class="errline" data-mail-error role="alert">${this.mailError}</div>`:v}
      <div class="frow mailfoot"><button type="button" class="btn quiet" data-mail-test ?disabled=${this.mailBusy!==null||!a.configured} @click=${()=>void this.testMail()}>${l(this.mailBusy==="test"?"refresh":"send")}${this.mailBusy==="test"?"שולח…":"שליחת בדיקה"}</button><button type="button" class="btn primary" data-mail-save ?disabled=${this.mailBusy!==null} @click=${()=>void this.saveMail()}>שמירה</button></div></section>`}renderWa(){return r`<div data-set-section="wa" id="sec-wa"><notify-whatsapp-section section-id="wa-inner" @notify-saved=${t=>{this.say(t.detail.text),y().view().then(e=>this.wa=e).catch(()=>{}),this.renderRoot.querySelectorAll("notify-whatsapp-mine").forEach(e=>e.reload())}}></notify-whatsapp-section></div>`}renderChannels(){const t=this.settings,e=L("webpush",t,this.devices),a=L("email",t,this.devices),s=L("whatsapp",t,this.devices,this.wa?{enabled:this.wa.enabled,mapped:this.wa.account.mapped}:null),i=(n,o)=>r`<span class="tag ${n==="on"||n==="always"?"ok":n==="soon"?"soon":""}">${n==="on"||n==="always"?"פעיל":o}</span>`;return r`<section class="glass sec" data-set-section="chan" id="sec-chan"><header><h2>${l("phone")}${f[7].label}</h2></header>
      <div class="frow"><div class="l"><b>מרכז ההתראות במחשב</b></div><div class="r"><div class="seg sm" role="group" aria-label="מרכז ההתראות במחשב">${Pt.map(n=>r`<button type="button" aria-pressed=${String(t.center_layout===n)} data-layout=${n} @click=${()=>this.patchSettings({center_layout:n})}>${Lt[n]}</button>`)}</div></div></div>
      <div class="chgrid">
        <div class="chc" data-channel="inbox"><span class="ring">${l("inbox")}</span><b>מרכז ההתראות</b><small>פעיל תמיד · לכל המשתמשים</small>${i("always","")}</div>
        <div class="chc" data-channel="webpush"><span class="ring">${l("phone")}</span><b>דחיפה (Arx)</b><small>${e.state==="on"?`${this.devices} מכשירים רשומים אצלך`:e.text}</small>${i(e.state,e.text)}</div>
        <div class="chc" data-channel="email"><span class="ring">${l("mail")}</span><b>דוא"ל</b><small>${a.state==="on"?"תקלות מערכת וגיבויים":"לא מוגדר"}</small>${i(a.state,a.text)}</div>
        <div class="chc" data-channel="app"><span class="ring">${l("phone")}</span><b>אפליקציה לנייד</b><small>לפי המכשירים שנרשמו באפליקציה · שעות השקט כמו דחיפה</small>${i("on","")}</div>
        <div class="chc soon" data-channel="ha_mobile"><span class="ring">${l("phone")}</span><b>Companion</b><small>טלפונים לפי משתמש</small><span class="tag soon">בקרוב</span></div>
        <div class="chc" data-channel="whatsapp"><span class="ring">${l("chat")}</span><b>WhatsApp</b><small>${s.text}</small>${i(s.state,s.text)}</div>
      </div>
      <div class="devbox"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></div></section>`}renderLog(){const t=Wt(this.stats),e=Ht(this.log,this.onlyFailed),a=It(this.log);return r`<section class="glass sec" data-set-section="log" id="sec-log"><header><h2>${l("inbox")}${f[8].label}</h2><div class="sp"><span class="tag" data-log-window>${ue()}</span><div class="seg sm" role="group" aria-label="סינון היומן"><button type="button" aria-pressed=${String(!this.onlyFailed)} data-log-filter="all" @click=${()=>this.onlyFailed=!1}>הכל</button><button type="button" aria-pressed=${String(this.onlyFailed)} data-log-filter="failed" @click=${()=>this.onlyFailed=!0}>רק כשלים${a?r`<small class="n">${a}</small>`:v}</button></div></div></header>
      <div class="fails" data-fail-panel>${t.map(s=>r`<div class="fstat ${s.tone}" data-fail-card=${s.channel}><span class="ch">${s.label} · 24 שעות</span><b class="n">${s.failed>0?s.failed:s.sent}</b><small>${s.failed>0?"נכשלו":"נשלחו"}${s.skipped?` · ${s.skipped} לא נשלחו`:""}</small></div>`)}</div>
      <div class="lgw"><table class="lg"><thead><tr><th>שעה</th><th>התראה</th><th>משתמש</th><th>ערוץ</th><th>מצב</th><th>סיבה</th></tr></thead><tbody>${e.length?e.map(s=>r`<tr data-log-row=${s.id} data-log-status=${s.status}><td class="n" style="direction:rtl">${Ut(s.at,this.now,this.tz)}</td><td>${this.titles[s.notification_id]??"—"}</td><td>${s.user_display}</td><td>${l(s.channel==="email"?"mail":s.channel==="whatsapp"?"chat":"phone")}${$[s.channel]}</td><td class=${he[s.status]}>${l(pe[s.status])}${Mt[s.status]}</td><td>${Bt(s.reason)||"—"}</td></tr>`):r`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--dv-text-3)">אין רשומות</td></tr>`}</tbody></table></div></section>`}renderPicker(){const t=this.picker;if(!t)return v;const e=this.users;return r`<sw-dialog open heading="משתמשים נבחרים" data-user-picker @close=${()=>this.picker=null}>
      ${e&&e.length?r`<div class="pick" role="group">${e.map(a=>r`<button type="button" role="checkbox" aria-checked=${String(t.selected.includes(a.id))} data-pick=${a.id} @click=${()=>this.picker={...t,selected:t.selected.includes(a.id)?t.selected.filter(s=>s!==a.id):[...t.selected,a.id]}}><span class="chk" aria-hidden="true" data-on=${String(t.selected.includes(a.id))} style=${t.selected.includes(a.id)?"background:var(--dv-accent);border-color:transparent":""}>${l("check")}</span>${a.name}</button>`)}</div>`:r`<div class="errline">רשימת המשתמשים לא זמינה</div>`}
      <button slot="footer" type="button" class="btn quiet" @click=${()=>this.picker=null}>ביטול</button>
      <button slot="footer" type="button" class="btn primary" data-pick-save ?disabled=${!t.selected.length} @click=${()=>this.savePicker()}>שמירה</button>
    </sw-dialog>`}renderBody(){if(this.phase==="loading")return r`<div class="skbox" data-set-state="loading" aria-busy="true"><span class="skl"></span><span class="skl"></span><span class="skl"></span></div>`;if(this.phase==="error")return r`<div class="errbar" role="alert" data-set-state="error">${l("warning")}<span>${this.error||"לא ניתן לטעון את ההגדרות"}</span><button type="button" class="btn sm" data-set-retry @click=${()=>void this.load()}>${l("refresh")}נסה שוב</button></div>`;if(this.phase==="user")return r`<div class="secs" data-set-state="user"><section class="glass sec"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></section></div>`;const t={sources:()=>this.renderSources(),quiet:()=>this.renderQuiet(),esc:()=>this.renderEsc(),lock:()=>this.renderLock(),keep:()=>this.renderKeep(),mail:()=>this.renderMail(),wa:()=>this.renderWa(),chan:()=>this.renderChannels(),log:()=>this.renderLog()};return r`<div class="set" data-set-state="ready"><nav class="glass setnav" aria-label="מדורים">${f.map(e=>r`<button type="button" aria-current=${String(this.sec===e.id)} data-set-nav=${e.id} @click=${()=>this.setSec(e.id)}>${l(e.icon)}${e.label}</button>`)}</nav>
      <div class="secs">${this.phone?t[this.sec]():f.map(e=>t[e.id]())}</div></div>`}render(){return r`<div class="page" data-notify-settings data-phase=${this.phase}>
      <header class="dh flat"><div class="dh-row"><h1>התראות</h1><span class="crumb">${l("settings")}מערכת</span></div></header>
      ${this.renderBody()}
    </div>
    ${this.renderPicker()}
    ${this.toast?r`<div class="toast ${this.toast.bad?"bad":""}" role="status" data-set-toast>${l(this.toast.bad?"warning":"check")}${this.toast.text}</div>`:v}`}};p.styles=[Kt,H,Gt,I,M,U`
      :host {
        --nt-sheet-w: 480px;
      }
      .page {
        padding-block-start: 0;
      }
      .dh {
        position: static;
      }
      .dh .crumb {
        font-size: var(--sw-fs-md);
        color: var(--dv-text-2);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dh .crumb .ic {
        font-size: var(--sw-fs-md);
      }
      .set {
        display: grid;
        grid-template-columns: 230px minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .setnav {
        position: sticky;
        inset-block-start: 20px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px;
      }
      .setnav button {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: 44px;
        padding: 0 12px;
        border-radius: var(--sw-r-lg);
        border: 0;
        background: transparent;
        text-align: start;
        font-size: var(--sw-fs-base);
        font-weight: 500;
        color: var(--dv-text-2);
      }
      .setnav button .ic {
        font-size: var(--sw-fs-xl);
        color: var(--dv-text-3);
      }
      /* POLISH4-WP8: hover washes only on a fine pointer (they stuck after a tap on a tablet); a key gives on pointer-down */
      @media (hover: hover) and (pointer: fine) {
        .setnav button:hover:not([aria-current='true']) {
          background: var(--dv-surface-3);
          color: var(--dv-text);
        }
        .pick button:hover {
          background: var(--dv-surface-3);
        }
      }
      .setnav button,
      .pick button,
      .sevseg button,
      button.chip {
        transition: background-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      }
      .setnav button:active,
      .pick button:active {
        background: var(--dv-surface-3);
      }
      .sevseg button:active:not(:disabled),
      button.chip:active:not(:disabled) {
        transform: scale(var(--sw-press-scale));
      }
      @media (prefers-reduced-motion: reduce) {
        .setnav button,
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
      .setnav button[aria-current='true'] {
        background: var(--dv-accent-soft);
        color: var(--dv-accent-text);
        font-weight: 600;
      }
      .setnav button[aria-current='true'] .ic {
        color: var(--dv-accent-text);
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
        font-weight: 700;
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
        font-weight: 600;
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
        font-weight: 600;
        color: var(--dv-text-2);
        min-inline-size: 0;
      }
      .fgrid label.w2 {
        grid-column: span 2;
      }
      .errline {
        color: var(--dv-danger);
        font-size: var(--sw-fs-base);
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 700;
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
        font-weight: 600;
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
        font-weight: 600;
        color: var(--dv-text-2);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
        letter-spacing: -0.04em;
        line-height: 1;
        direction: ltr;
        font-variant-numeric: tabular-nums;
      }
      .lphone .ldate {
        font-size: var(--sw-fs-base);
        font-weight: 500;
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
        font-weight: 700;
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
        font-weight: 600;
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
        font-weight: 600;
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
        font-weight: 600;
      }
      .lg .bad {
        color: var(--dv-danger);
        font-weight: 600;
      }
      .lg .skp {
        color: var(--dv-text-3);
        font-weight: 600;
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
        font-weight: 700;
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
        font-weight: 600;
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
        font-weight: 700;
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
      .tagrow {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      @media (max-width: 1099px) {
        .set {
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .setnav {
          position: static;
          flex-direction: row;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 4px 0;
          background: transparent;
          border: 0;
          box-shadow: none;
          -webkit-backdrop-filter: none;
          backdrop-filter: none;
        }
        .setnav::-webkit-scrollbar {
          display: none;
        }
        .setnav button {
          flex: none;
          block-size: 44px;
          border: 1px solid var(--dv-border);
          background: var(--dv-surface-2);
          border-radius: var(--sw-r-pill);
          padding: 0 14px;
        }
        .setnav button[aria-current='true'] {
          background: var(--dv-text);
          color: var(--mm-text-inverse);
          border-color: transparent;
        }
        .setnav button[aria-current='true'] .ic {
          color: inherit;
        }
        .setnav button .ic {
          display: none;
        }
        .fgrid label.w2 {
          grid-column: span 1;
        }
        .lphone:not(.sel) {
          display: none;
        }
        .lphone {
          opacity: 1;
        }
        .dh {
          padding-block-end: 4px;
        }
      }
    `];h([tt()],p.prototype,"section",2);h([d()],p.prototype,"phase",2);h([d()],p.prototype,"error",2);h([d()],p.prototype,"settings",2);h([d()],p.prototype,"policies",2);h([d()],p.prototype,"stats",2);h([d()],p.prototype,"log",2);h([d()],p.prototype,"titles",2);h([d()],p.prototype,"users",2);h([d()],p.prototype,"devices",2);h([d()],p.prototype,"wa",2);h([d()],p.prototype,"onlyFailed",2);h([d()],p.prototype,"sec",2);h([d()],p.prototype,"phone",2);h([d()],p.prototype,"toast",2);h([d()],p.prototype,"invalid",2);h([d()],p.prototype,"mail",2);h([d()],p.prototype,"mailBusy",2);h([d()],p.prototype,"mailResult",2);h([d()],p.prototype,"mailError",2);h([d()],p.prototype,"picker",2);h([d()],p.prototype,"now",2);h([d()],p.prototype,"tz",2);p=h([D("system-notifications")],p);export{p as SystemNotifications};
//# sourceMappingURL=system-notifications-DqY8gD4W.js.map
