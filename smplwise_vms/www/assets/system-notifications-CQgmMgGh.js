const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{a3 as S,bs as H,b4 as V,bn as Se,a as W,bE as be,cG as ve,cE as fe,bg as X,uL as Z,uM as J,g as M,ay as ge,j as p,i as U,b as o,uN as c,A as b,k as D,n as se,aB as we,aL as ze,dE as i,uO as Ee,jU as Ae,uP as Ce,mq as T,uQ as Oe,uR as N,p as Te,_ as F,uS as qe,H as Ne,uT as ae,uU as Pe,uV as Le,uW as Re,uX as j,uY as ie,uZ as L,u_ as He,F as We,y as Ie,u$ as Me,mn as ne,v0 as R,v1 as E,bd as Ue,v2 as De,v3 as Be,v4 as Fe,J as je,ei as re,v5 as Qe,v6 as Ye,v7 as Ke,v8 as Ge,v9 as Ve,va as Xe,vb as oe,vc as Ze,vd as le,cs as ce,ve as Je,vf as et,vg as de,vh as tt,vi as Q,I as st,vj as at,vk as it,vl as nt,vm as rt,vn as ot,vo as lt,vp as ct,e0 as dt,vq as pt,vr as pe,vs as ut,vt as ht,vu as mt,vv as bt,aU as vt}from"./index-DJHEuoub.js";import{m as ft}from"./media-page-DjRYoJqH.js";import{s as gt}from"./settings-B2Aqk_ne.js";import"./sw-logo-art-MaHPMZFI.js";import"./lead-reserve-BI3si4Ta.js";const wt={view:()=>V("notify/whatsapp"),save:e=>H("notify/whatsapp",e),test:()=>Se("notify/whatsapp/test"),mine:()=>V("me/notify-whatsapp"),setOptIn:(e,t)=>H("me/notify-whatsapp",e?{opted_in:!0,confirm:t}:{opted_in:!1}),setOptOut:(e,t)=>H("me/notify-whatsapp",e?{opted_in:!1}:{opted_in:!0,confirm:t})};function $t(){let e={enabled:!1,per_user_hour:4,dedupe_min:30,budget_pct:50,budget_critical_pct:80,detail:"type_place",detail_levels:["generic","type_place"],normalized:[],warnings:[],revision:0,ranges:{per_user_hour:[1,30],dedupe_min:[5,1440],budget_pct:[10,90],budget_critical_pct:[10,90]},account:{mapped:!0,label:"וואטסאפ ····0191",state:"connected"},reachable_users:3,accounts_href:"#/system/messaging-accounts",test:{own_number:!0,masked:"····0191"}},t={channel_enabled:!1,has_number:!0,masked:"····0191",source:"directory",opted_in:!1,number_changed:!1,directory_declined:!1,consent:"declined",confirm:"demo0123456789ab",stored_opt_in:!1},s=0;const a=(n,r,l)=>new W(n,{code:r,user_message:l,retryable:n===429,correlation_id:"demo",details:{}});return{view:async()=>structuredClone(e),save:async n=>{if(n.revision!==e.revision)throw a(412,"settings_conflict","ההגדרות השתנו בינתיים; טען מחדש.");const[r,l]=e.ranges.per_user_hour,[v,f]=e.ranges.dedupe_min;if(n.per_user_hour!==void 0&&(n.per_user_hour<r||n.per_user_hour>l)||n.dedupe_min!==void 0&&(n.dedupe_min<v||n.dedupe_min>f))throw a(422,"validation","ערך מספרי מחוץ לטווח.");const w=n.budget_pct??e.budget_pct,g=n.budget_critical_pct??e.budget_critical_pct;if(w<10||w>90||g<10||g>90||g<w)throw a(422,"validation","ערך מספרי מחוץ לטווח.");return e={...e,..."enabled"in n?{enabled:!!n.enabled}:{},...n.per_user_hour!==void 0?{per_user_hour:n.per_user_hour}:{},...n.dedupe_min!==void 0?{dedupe_min:n.dedupe_min}:{},budget_pct:w,budget_critical_pct:g,...n.detail?{detail:n.detail}:{},revision:e.revision+1},t={...t,channel_enabled:e.enabled},structuredClone(e)},test:async()=>{if(!e.account.mapped)throw a(409,"channel_unavailable","לא נבחר חשבון וואטסאפ להתראות.");if(++s>3)throw a(429,"rate_limited","יותר מדי הודעות בדיקה. נסו שוב מאוחר יותר.");return{ok:!0,outcome:"sent",code:null}},mine:async()=>({...t}),setOptIn:async(n,r)=>{if(n&&r!==t.confirm)throw a(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return t={...t,opted_in:n,stored_opt_in:n,number_changed:!1,consent:n&&!t.directory_declined?"granted":"declined"}},setOptOut:async(n,r)=>{if(!n&&r!==t.confirm)throw a(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return t={...t,opted_in:!n,stored_opt_in:!n,number_changed:!1,consent:!n&&!t.directory_declined?"granted":"declined"}}}}let yt=null;const C=()=>S()?wt:yt??=$t(),ee={keyUnreadable:"מפתח ההודעות של המערכת לא נקרא - אי אפשר לאמת הסכמות, ולכן לא נשלחות התראות בוואטסאפ",normalized:"ערך שמור לא היה בטווח ותוקן - שמרו כדי לאשר",budget:"חלק מתקציב החשבון",budgetHint:"השאר נשמר להודעות ניהול השירות ולקודי אימות",budgetCritical:"חלק לקריטי",budgetCriticalHint:"קריטי והסלמה רשאים להשתמש עד כאן",detail:"פירוט בהודעה",detailHint:"תוכן ההתראה עצמו לא נשלח לוואטסאפ",detail_generic:"כללי",detail_type_place:"סוג ומקום",mine_title:"וואטסאפ שלי",mine_sub:"התראות לוואטסאפ האישי שלך, רק אם אישרת את המספר בעצמך",mine_number:"המספר",mine_src_directory:"מרשימת אנשי הקשר",mine_src_profile:"מהפרופיל",mine_status:"מצב",mine_on:"מקבל התראות",mine_off:"לא מקבל התראות",mine_changed:"המספר השתנה - אשר מחדש כדי לקבל התראות",mine_declined:"ברשימת אנשי הקשר וואטסאפ אינו הערוץ המועדף",mine_none:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",mine_confirm:"אישור המספר וקבלת התראות",mine_stop:"הפסקת התראות בוואטסאפ",on:"פעיל",off:"כבוי",attention:"דורש טיפול",title:"וואטסאפ",sub:"התראות לטלפון האישי של המשתמש, מהחשבון שנבחר בערוץ ההודעות",enabled:"שליחת התראות בוואטסאפ",enabledHint:"כבוי = שום התראה לא נשלחת בוואטסאפ, גם אם סומנה במדיניות",account:"חשבון שולח",accountNone:"לא נבחר חשבון",accountPick:"בחירת חשבון",st_connected:"מחובר",st_disconnected:"מנותק",st_unknown:"לא ידוע",st_missing:"לא נמצא",reach:"משתמשים עם מספר",reachHint:"מספר מרשימת אנשי הקשר, כשוואטסאפ הוא הערוץ המועדף",cap:"לכל משתמש בשעה",capHint:"התראה קריטית והסלמה אינן נספרות",dedupe:"בלי כפילות במשך",minutes:"דק׳",test:"שליחת בדיקה",testing:"שולח…",testHint:"נשלחת רק למספר שלך ({masked})",testNoNumber:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",testOk:"הודעת הבדיקה נשלחה",testFail:"הבדיקה נכשלה",warnOffAccount:"אין חשבון שולח - ההתראות לא יישלחו",saved:"נשמר",loading:"טוען…",error:"לא ניתן לטעון את הגדרות הוואטסאפ",retry:"נסה שוב",less:"פחות",more:"יותר"},$e={keyUnreadable:"The system messaging key could not be read - consents cannot be verified, so no WhatsApp notifications are sent",normalized:"A stored value was out of range and was corrected - save to confirm",budget:"Share of the account budget",budgetHint:"The rest stays for service-management messages and verification codes",budgetCritical:"Share for critical",budgetCriticalHint:"Critical notifications and escalations may use up to this",detail:"Detail in the message",detailHint:"The text of the alert itself is never sent to WhatsApp",detail_generic:"Generic",detail_type_place:"Type and place",mine_title:"My WhatsApp",mine_sub:"Notifications to your own WhatsApp, only after you confirmed the number yourself",mine_number:"Number",mine_src_directory:"From the contact list",mine_src_profile:"From the profile",mine_status:"Status",mine_on:"Receiving notifications",mine_off:"Not receiving notifications",mine_changed:"The number changed - confirm again to receive notifications",mine_declined:"The contact list says WhatsApp is not the preferred channel",mine_none:"You have no WhatsApp number in the contact list",mine_confirm:"Confirm the number and receive notifications",mine_stop:"Stop WhatsApp notifications",on:"On",off:"Off",attention:"Needs attention",title:"WhatsApp",sub:"Notifications to the user's own phone, from the account chosen in the message channel",enabled:"Send notifications on WhatsApp",enabledHint:"Off = no notification is sent on WhatsApp, even when a policy selects it",account:"Sending account",accountNone:"No account chosen",accountPick:"Choose an account",st_connected:"Connected",st_disconnected:"Disconnected",st_unknown:"Unknown",st_missing:"Not found",reach:"Users with a number",reachHint:"A number from the contact list, when WhatsApp is the preferred channel",cap:"Per user per hour",capHint:"Critical notifications and escalations are not counted",dedupe:"No repeats within",minutes:"min",test:"Send a test",testing:"Sending…",testHint:"Sent only to your own number ({masked})",testNoNumber:"You have no WhatsApp number in the contact list",testOk:"The test message was sent",testFail:"The test failed",warnOffAccount:"No sending account - notifications will not be sent",saved:"Saved",loading:"Loading…",error:"The WhatsApp settings could not be loaded",retry:"Try again",less:"Less",more:"More"},ye={keyUnreadable:"تعذّرت قراءة مفتاح الرسائل في النظام - لا يمكن التحقق من الموافقات، لذلك لا تُرسل إشعارات واتساب",normalized:"كانت قيمة محفوظة خارج النطاق وتم تصحيحها - احفظ للتأكيد",budget:"حصة من ميزانية الحساب",budgetHint:"الباقي محفوظ لرسائل إدارة الخدمة ورموز التحقق",budgetCritical:"حصة الحرج",budgetCriticalHint:"يمكن للإشعارات الحرجة والتصعيد استخدام حتى هذا الحد",detail:"التفاصيل في الرسالة",detailHint:"نص الإشعار نفسه لا يُرسل إلى واتساب",detail_generic:"عام",detail_type_place:"النوع والمكان",mine_title:"واتساب الخاص بي",mine_sub:"إشعارات إلى واتساب الشخصي، فقط بعد أن تؤكد الرقم بنفسك",mine_number:"الرقم",mine_src_directory:"من قائمة جهات الاتصال",mine_src_profile:"من الملف الشخصي",mine_status:"الحالة",mine_on:"تصلك الإشعارات",mine_off:"لا تصلك الإشعارات",mine_changed:"تغيّر الرقم - أكّد مجددًا لتلقي الإشعارات",mine_declined:"قائمة جهات الاتصال تقول إن واتساب ليس القناة المفضلة",mine_none:"لا يوجد لديك رقم واتساب في قائمة جهات الاتصال",mine_confirm:"تأكيد الرقم وتلقي الإشعارات",mine_stop:"إيقاف إشعارات واتساب",on:"مفعّل",off:"مطفأ",attention:"يحتاج إلى معالجة",title:"واتساب",sub:"إشعارات إلى الهاتف الشخصي للمستخدم، من الحساب المختار في قناة الرسائل",enabled:"إرسال الإشعارات عبر واتساب",enabledHint:"مطفأ = لا يُرسل أي إشعار عبر واتساب حتى لو تم اختياره في السياسة",account:"الحساب المرسِل",accountNone:"لم يتم اختيار حساب",accountPick:"اختيار حساب",st_connected:"متصل",st_disconnected:"غير متصل",st_unknown:"غير معروف",st_missing:"غير موجود",reach:"مستخدمون لديهم رقم",reachHint:"رقم من قائمة جهات الاتصال، عندما يكون واتساب هو القناة المفضلة",cap:"لكل مستخدم في الساعة",capHint:"الإشعارات الحرجة والتصعيد لا تُحتسب",dedupe:"بدون تكرار خلال",minutes:"دقيقة",test:"إرسال اختبار",testing:"جارٍ الإرسال…",testHint:"يُرسل إلى رقمك فقط ({masked})",testNoNumber:"لا يوجد لديك رقم واتساب في قائمة جهات الاتصال",testOk:"تم إرسال رسالة الاختبار",testFail:"فشل الاختبار",warnOffAccount:"لا يوجد حساب مرسِل - لن تُرسل الإشعارات",saved:"تم الحفظ",loading:"جارٍ التحميل…",error:"تعذّر تحميل إعدادات واتساب",retry:"إعادة المحاولة",less:"أقل",more:"أكثر"},xe={keyUnreadable:"Не удалось прочитать ключ сообщений системы — согласия нельзя проверить, поэтому уведомления WhatsApp не отправляются",normalized:"Сохранённое значение было вне диапазона и исправлено — сохраните для подтверждения",budget:"Доля бюджета аккаунта",budgetHint:"Остальное остаётся для сообщений управления сервисом и кодов подтверждения",budgetCritical:"Доля для критических",budgetCriticalHint:"Критические уведомления и эскалации могут использовать до этого предела",detail:"Подробность сообщения",detailHint:"Сам текст уведомления в WhatsApp не отправляется",detail_generic:"Общее",detail_type_place:"Тип и место",mine_title:"Мой WhatsApp",mine_sub:"Уведомления на ваш WhatsApp, только после того как вы сами подтвердили номер",mine_number:"Номер",mine_src_directory:"Из списка контактов",mine_src_profile:"Из профиля",mine_status:"Статус",mine_on:"Уведомления приходят",mine_off:"Уведомления не приходят",mine_changed:"Номер изменился — подтвердите снова, чтобы получать уведомления",mine_declined:"В списке контактов WhatsApp не указан как предпочтительный канал",mine_none:"У вас нет номера WhatsApp в списке контактов",mine_confirm:"Подтвердить номер и получать уведомления",mine_stop:"Остановить уведомления WhatsApp",on:"Включено",off:"Выключено",attention:"Требует внимания",title:"WhatsApp",sub:"Уведомления на личный телефон пользователя с аккаунта, выбранного в канале сообщений",enabled:"Отправлять уведомления в WhatsApp",enabledHint:"Выключено = ни одно уведомление не отправляется в WhatsApp, даже если оно выбрано в политике",account:"Аккаунт отправителя",accountNone:"Аккаунт не выбран",accountPick:"Выбрать аккаунт",st_connected:"Подключён",st_disconnected:"Отключён",st_unknown:"Неизвестно",st_missing:"Не найден",reach:"Пользователи с номером",reachHint:"Номер из списка контактов, если WhatsApp — предпочтительный канал",cap:"На пользователя в час",capHint:"Критические уведомления и эскалации не учитываются",dedupe:"Без повторов в течение",minutes:"мин",test:"Отправить тест",testing:"Отправка…",testHint:"Отправляется только на ваш номер ({masked})",testNoNumber:"У вас нет номера WhatsApp в списке контактов",testOk:"Тестовое сообщение отправлено",testFail:"Тест не удался",warnOffAccount:"Нет аккаунта отправителя — уведомления не будут отправлены",saved:"Сохранено",loading:"Загрузка…",error:"Не удалось загрузить настройки WhatsApp",retry:"Повторить",less:"Меньше",more:"Больше"};function P(){return fe(["en","ar","ru"])}const xt={he:ee,en:$e,ar:ye,ru:xe};function d(e,t,s=P()){const a=xt[s][e]??ee[e]??e;return ve(a,t)}be("i18n/notify-whatsapp",{he:ee,en:$e,ar:ye,ru:xe});const _={stepCap(e,t){const[s,a]=e.ranges.per_user_hour;return Math.min(a,Math.max(s,e.per_user_hour+t))},warning(e){return e.enabled&&!e.account.mapped?"no_account":null},tone(e){return e.enabled?e.account.mapped&&e.account.state==="connected"?"ok":"bad":"off"},canTest(e){return e.test.own_number&&e.account.mapped},stepPct(e,t,s){const[a,n]=e.ranges[t],r=Math.min(n,Math.max(a,e[t]+s));return t==="budget_pct"?{budget_pct:r,budget_critical_pct:Math.max(r,e.budget_critical_pct)}:{budget_pct:Math.min(e.budget_pct,r),budget_critical_pct:r}},canStop(e){return!!e&&e.channel_enabled&&(e.opted_in||!!e.stored_opt_in)},mineState(e){return!e||!e.channel_enabled?"hidden":e.has_number?e.directory_declined?"declined":e.number_changed?"changed":e.opted_in?"on":"off":"none"}};var _t=Object.defineProperty,kt=Object.getOwnPropertyDescriptor,O=(e,t,s,a)=>{for(var n=a>1?void 0:a?kt(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(n=(a?l(t,s,n):l(n))||n);return a&&n&&_t(t,s,n),n};const St=[5,15,30,60];let k=class extends U{constructor(){super(...arguments),this.sectionId="wa",this.view=null,this.phase="loading",this.busy=!1,this.result=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.phase="loading";try{this.view=await C().view(),this.phase="ready"}catch{this.phase="error"}}errText(e){return e instanceof W?e.body.user_message||e.code:d("error")}async save(e){const t=this.view;if(!(!t||this.busy)){this.view={...t,...e},this.busy=!0,this.error="";try{this.view=await C().save({...e,revision:t.revision}),this.dispatchEvent(new CustomEvent("notify-saved",{bubbles:!0,composed:!0,detail:{text:d("saved")}}))}catch(s){this.error=this.errText(s),await this.load()}finally{this.busy=!1}}}async test(){this.busy=!0,this.result=null;try{const e=await C().test();this.result={ok:e.ok,text:e.ok?d("testOk"):`${d("testFail")} · ${e.code??e.outcome}`}}catch(e){this.result={ok:!1,text:this.errText(e)}}finally{this.busy=!1}}stateTag(e){const t=e.account;if(!t.mapped)return o`<span class="tag bad" data-wa-account-state="none">${d("accountNone")}</span>`;const s=t.state??"unknown";return o`<span class="tag ${s==="connected"?"ok":s==="unknown"?"":"bad"}" data-wa-account-state=${s}>${d(`st_${s}`)}</span>`}render(){const e=P()==="he"||P()==="ar"?"rtl":"ltr";if(this.phase==="loading")return o`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="loading" aria-busy="true" dir=${e}><span class="skl"></span><span class="skl"></span></section>`;if(this.phase==="error"||!this.view)return o`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="error" dir=${e}><div class="warn" role="alert">${c("warning")}${d("error")}</div><div><button type="button" class="btn sm" data-wa-retry @click=${()=>void this.load()}>${c("refresh")}${d("retry")}</button></div></section>`;const t=this.view,s=_.tone(t),a=!t.enabled,n=_.warning(t);return o`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="ready" data-wa-enabled=${String(t.enabled)} dir=${e}>
      <header><h2>${c("chat")}${d("title")}</h2><div class="sp"><button type="button" class="tog" role="switch" aria-checked=${String(t.enabled)} aria-label=${d("enabled")} data-wa-switch ?disabled=${this.busy} @click=${()=>void this.save({enabled:!t.enabled})}></button></div></header>
      <p class="sub">${d("sub")}</p>
      <div class="frow"><div class="l"><b>${d("enabled")}</b><small>${d("enabledHint")}</small></div><div class="r"><span class="tag ${s==="ok"?"ok":s==="bad"?"bad":""}" data-wa-tone=${s}>${c(s==="ok"?"check":s==="bad"?"warning":"moon")}${d(s==="ok"?"on":s==="bad"?"attention":"off")}</span></div></div>
      ${n?o`<div class="warn" role="alert" data-wa-warning=${n}>${c("warning")}${d("warnOffAccount")}</div>`:b}
      ${t.warnings?.includes("messaging_key_unreadable")?o`<div class="warn" role="alert" data-wa-key-warning>${c("warning")}${d("keyUnreadable")}</div>`:b}
      ${t.normalized?.length?o`<div class="warn" role="status" data-wa-normalized=${t.normalized.join(",")}>${c("warning")}${d("normalized")}</div>`:b}
      <div class="frow"><div class="l"><b>${d("account")}</b>${t.account.mapped&&t.account.label?o`<small data-wa-account-label>${t.account.label}</small>`:b}</div><div class="r">${this.stateTag(t)}<a class="lnk" href=${t.accounts_href} data-wa-accounts-link>${d("accountPick")}</a></div></div>
      <div class="frow"><div class="l"><b>${d("reach")}</b><small>${d("reachHint")}</small></div><div class="r"><span class="tag" data-wa-reach><span class="n">${t.reachable_users}</span></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${d("cap")}</b><small>${d("capHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-cap-step="-1" aria-label=${d("less")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:_.stepCap(t,-1)})}>${c("minus")}</button><span class="vv" data-wa-cap><span class="n">${t.per_user_hour}</span></span><button type="button" data-wa-cap-step="1" aria-label=${d("more")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:_.stepCap(t,1)})}>${c("plus")}</button></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${d("dedupe")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${d("dedupe")}>${St.map(r=>o`<button type="button" aria-pressed=${String(t.dedupe_min===r)} data-wa-dedupe=${r} ?disabled=${this.busy} @click=${()=>void this.save({dedupe_min:r})}><span class="n">${r}</span> ${d("minutes")}</button>`)}</div></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${d("detail")}</b><small>${d("detailHint")}</small></div><div class="r"><div class="seg sm" role="group" aria-label=${d("detail")}>${t.detail_levels.map(r=>o`<button type="button" aria-pressed=${String(t.detail===r)} data-wa-detail=${r} ?disabled=${this.busy} @click=${()=>void this.save({detail:r})}>${d(`detail_${r}`)}</button>`)}</div></div></div>
      ${["budget_pct","budget_critical_pct"].map(r=>o`<div class="frow ${a?"dis":""}"><div class="l"><b>${d(r==="budget_pct"?"budget":"budgetCritical")}</b><small>${d(r==="budget_pct"?"budgetHint":"budgetCriticalHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-budget-step=${`${r}:-10`} aria-label=${d("less")} ?disabled=${this.busy} @click=${()=>void this.save(_.stepPct(t,r,-10))}>${c("minus")}</button><span class="vv" data-wa-budget=${r}><span class="n">${t[r]}</span><small>%</small></span><button type="button" data-wa-budget-step=${`${r}:10`} aria-label=${d("more")} ?disabled=${this.busy} @click=${()=>void this.save(_.stepPct(t,r,10))}>${c("plus")}</button></span></div></div>`)}
      <div class="frow"><div class="l"><b>${d("test")}</b><small data-wa-test-hint>${t.test.own_number?d("testHint",{masked:`⁦${t.test.masked??""}⁩`}):d("testNoNumber")}</small></div><div class="r">${this.result?o`<span class="tag ${this.result.ok?"ok":"bad"}" data-wa-test-result=${this.result.ok?"ok":"bad"}>${c(this.result.ok?"check":"warning")}${this.result.text}</span>`:b}<button type="button" class="btn quiet" data-wa-test ?disabled=${this.busy||!_.canTest(t)} @click=${()=>void this.test()}>${c(this.busy?"refresh":"send")}${this.busy?d("testing"):d("test")}</button></div></div>
      ${this.error?o`<div class="warn" role="alert" data-wa-error>${this.error}</div>`:b}
    </section>`}};k.styles=[X,Z,J,M`
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
    `];O([ge({attribute:"section-id"})],k.prototype,"sectionId",2);O([p()],k.prototype,"view",2);O([p()],k.prototype,"phase",2);O([p()],k.prototype,"busy",2);O([p()],k.prototype,"result",2);O([p()],k.prototype,"error",2);k=O([D("notify-whatsapp-section")],k);var zt=Object.defineProperty,Et=Object.getOwnPropertyDescriptor,B=(e,t,s,a)=>{for(var n=a>1?void 0:a?Et(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(n=(a?l(t,s,n):l(n))||n);return a&&n&&zt(t,s,n),n};let q=class extends U{constructor(){super(...arguments),this.mine=null,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}reload(){this.load()}async load(){try{this.mine=await C().mine()}catch{this.mine=null}}async set(e){this.busy=!0,this.error="";try{this.mine=await C().setOptIn(e,e?this.mine?.confirm??null:null)}catch(t){this.error=t instanceof W?t.body.user_message||t.code:d("error"),t instanceof W&&t.code==="number_changed"&&this.load()}finally{this.busy=!1}}render(){const e=_.mineState(this.mine);if(e==="hidden")return b;const t=this.mine,s=P()==="he"||P()==="ar"?"rtl":"ltr",a=e==="on"?o`<span class="tag ok" data-wa-mine-status="on">${c("check")}${d("mine_on")}</span>`:e==="changed"?o`<span class="tag bad" data-wa-mine-status="changed">${c("warning")}${d("mine_changed")}</span>`:e==="declined"?o`<span class="tag" data-wa-mine-status="declined">${d("mine_declined")}</span>`:e==="none"?o`<span class="tag" data-wa-mine-status="none">${d("mine_none")}</span>`:o`<span class="tag" data-wa-mine-status="off">${d("mine_off")}</span>`;return o`<div class="box" data-wa-mine data-wa-mine-state=${e} dir=${s}>
      <h3>${c("chat")}${d("mine_title")}</h3>
      <p class="sub">${d("mine_sub")}</p>
      ${t.has_number?o`<div class="row"><b>${d("mine_number")}</b><span class="n" data-wa-mine-number>${t.masked}</span><small>${d(t.source==="profile"?"mine_src_profile":"mine_src_directory")}</small></div>`:b}
      <div class="row"><b>${d("mine_status")}</b>${a}</div>
      ${e==="off"||e==="changed"?o`<div class="acts"><button type="button" class="btn primary sm" data-wa-mine-confirm ?disabled=${this.busy} @click=${()=>void this.set(!0)}>${c("check")}${d("mine_confirm")}</button></div>`:b}
      ${_.canStop(t)?o`<div class="acts"><button type="button" class="btn quiet sm" data-wa-mine-stop ?disabled=${this.busy} @click=${()=>void this.set(!1)}>${d("mine_stop")}</button></div>`:b}
      ${this.error?o`<div class="warn" role="alert" data-wa-mine-error>${this.error}</div>`:b}
    </div>`}};q.styles=[X,Z,J,M`
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
    `];B([p()],q.prototype,"mine",2);B([p()],q.prototype,"busy",2);B([p()],q.prototype,"error",2);q=B([D("notify-whatsapp-mine")],q);const At=["push","all"],A={enabled:"quiet.windows.enabled",default_minutes:"quiet.windows.default_minutes",max_minutes:"quiet.windows.max_minutes",mute_alerts:"quiet.windows.mute_alerts",channels:"quiet.windows.channels"},y=[5,720],I={enabled:!1,default_minutes:120,max_minutes:240,mute_alerts:!1,channels:"push"},ue=(e,t)=>{const s=typeof e=="string"&&/^\d+$/.test(e)?Number(e):NaN;return Number.isInteger(s)&&s>=y[0]&&s<=y[1]?s:t};function he(e){const t=e??{};return{enabled:t[A.enabled]==="on",default_minutes:ue(t[A.default_minutes],I.default_minutes),max_minutes:ue(t[A.max_minutes],I.max_minutes),mute_alerts:t[A.mute_alerts]==="on",channels:t[A.channels]==="all"?"all":"push"}}const Y=(e,t)=>{const s=t[e];return typeof s=="boolean"?s?"on":"off":String(s)};function me(e,t){const s={};for(const a of Object.keys(A))Y(a,e)!==Y(a,t)&&(s[A[a]]=Y(a,t));return s}function K(e){const t=s=>Number.isInteger(s)&&s>=y[0]&&s<=y[1];return!t(e.default_minutes)||!t(e.max_minutes)?"range":e.default_minutes>e.max_minutes?"default_over_max":null}const Ct=(e,t)=>e.enabled&&!t.enabled,Ot=()=>V("quiet/settings"),Tt=e=>H("quiet/settings",{changes:e,confirmed:!0}),te={title:"חלון שקט לקומה או לאזור",sub:"כפתור אחד בכותרת הקומה או האזור משהה התראות מידע לזמן קצוב. התראות קריטיות ובטיחות לא מושהות לעולם.",enabled:"חלון שקט",enabledHint:"כבוי כברירת מחדל. כיבוי מסיים מיד כל חלון פתוח.",off:"כבוי",on:"פעיל",defaultMinutes:"משך ברירת מחדל (דקות)",maxMinutes:"משך מרבי (דקות)",minutesHint:"בין {lo} ל־{hi} דקות",muteAlerts:"להשהות גם התראות חשובות",muteAlertsHint:"כבוי: רק התראות מידע מושהות",channels:"ערוצים שהחלון משהה",channelsHint:'פוש בלבד: הדחיפה לטלפון ולדפדפן מושהית; דוא"ל, WhatsApp והכרזות נשלחים כרגיל. מרכז ההתראות שומר הכל בכל מקרה.',ch_push:"פוש בלבד",ch_all:"כל הערוצים",save:"שמור",saved:"ההגדרות נשמרו",readOnly:"שינוי ההגדרות דורש הרשאת מנהל מערכת.",demo:"נתוני הדגמה: ההגדרות נשמרות רק מול השרת.",errRange:"משך בין {lo} ל־{hi} דקות",errOverMax:"משך ברירת המחדל גדול מהמשך המרבי",confirmTitle:"לשמור את הגדרות חלון השקט?",confirmBody:"השינוי חל מיד על כל הקומות והאזורים.",confirmEnds:"כיבוי החלון מסיים עכשיו כל חלון שקט פתוח.",confirmGo:"שמור",cancel:"ביטול",loadError:"הגדרות חלון השקט לא נטענו"},_e={title:"Quiet window for a floor or an area",sub:"One button on the floor or area header holds informational notifications for a while. Critical and safety notifications are never held.",enabled:"Quiet window",enabledHint:"Off by default. Switching it off ends every open window at once.",off:"Off",on:"On",defaultMinutes:"Default length (minutes)",maxMinutes:"Longest length (minutes)",minutesHint:"{lo} to {hi} minutes",muteAlerts:"Also hold important notifications",muteAlertsHint:"Off: only informational notifications are held",channels:"Channels the window holds",channelsHint:"Push only: the push to the phone and the browser is held; email, WhatsApp and announcements are sent as usual. The notification centre keeps everything either way.",ch_push:"Push only",ch_all:"All channels",save:"Save",saved:"Settings saved",readOnly:"Changing these settings needs a system administrator.",demo:"Demo data: the settings are saved against a server only.",errRange:"A length from {lo} to {hi} minutes",errOverMax:"The default length is longer than the longest length",confirmTitle:"Save the quiet window settings?",confirmBody:"The change applies at once to every floor and area.",confirmEnds:"Switching it off ends every open quiet window now.",confirmGo:"Save",cancel:"Cancel",loadError:"The quiet window settings could not be loaded"},qt={he:te,en:_e};function Nt(){return fe(["en"])}function u(e,t,s=Nt()){const a=qt[s][e]??te[e]??e;return ve(a,t)}be("i18n/quiet-windows",{he:te,en:_e});var Pt=Object.defineProperty,Lt=Object.getOwnPropertyDescriptor,z=(e,t,s,a)=>{for(var n=a>1?void 0:a?Lt(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(n=(a?l(t,s,n):l(n))||n);return a&&n&&Pt(t,s,n),n};let x=class extends U{constructor(){super(...arguments),this.saved=I,this.draft=I,this.loaded=!1,this.busy=!1,this.asking=!1,this.message="",this.error=""}connectedCallback(){if(super.connectedCallback(),!S()){this.loaded=!0;return}Ot().then(e=>this.adopt(he(e.settings))).catch(e=>{this.loaded=!0,this.error=`${u("loadError")}: ${se(e)}`})}adopt(e){this.saved=e,this.draft={...e},this.loaded=!0}get editable(){return S()&&we("system.configure")&&this.loaded}set(e){this.draft={...this.draft,...e},this.message="",this.error=""}problemText(){const e=K(this.draft);return e==="range"?u("errRange",{lo:y[0],hi:y[1]}):e==="default_over_max"?u("errOverMax"):""}async save(){this.asking=!1;const e=me(this.saved,this.draft);if(!(!Object.keys(e).length||K(this.draft))){this.busy=!0,this.error="";try{const t=await Tt(e);this.adopt(he(t.settings)),this.message=u("saved")}catch(t){this.error=se(t)}finally{this.busy=!1}}}seg(e,t,s,a,n){const r=this.draft[e];return o`<div class="seg" role="group" aria-label=${a} data-qw-seg=${e}>${t.map(l=>o`<button type="button" data-v=${String(l)} aria-pressed=${String(r===l)} ?disabled=${n}
      @click=${()=>this.set({[e]:l})}>${s(l)}</button>`)}</div>`}minutes(e,t){return o`<sw-field class="ctl"><input type="number" inputmode="numeric" min=${y[0]} max=${y[1]} step="5" data-ltr data-qw-minutes=${e}
      aria-invalid=${String(!!K(this.draft))} .value=${String(this.draft[e])} ?disabled=${t}
      @change=${s=>this.set({[e]:Number(s.target.value)})} /></sw-field>`}render(){const e=!this.editable||this.busy,t=this.draft,s=l=>u(l?"on":"off"),a=Object.keys(me(this.saved,t)).length>0,n=this.problemText(),r=u("minutesHint",{lo:y[0],hi:y[1]});return o`<div class="card" data-quiet-windows-card>
      <p class="sub">${u("sub")}</p>
      <div class="set-col">
        <div class="row" data-qw-row="enabled"><span class="lbl">${u("enabled")}<span class="muted">${u("enabledHint")}</span></span>${this.seg("enabled",[!1,!0],s,u("enabled"),e)}</div>
        <div class="row" data-qw-row="default"><span class="lbl">${u("defaultMinutes")}<span class="muted">${r}</span></span>${this.minutes("default_minutes",e)}</div>
        <div class="row" data-qw-row="max"><span class="lbl">${u("maxMinutes")}<span class="muted">${r}</span></span>${this.minutes("max_minutes",e)}</div>
        <div class="row" data-qw-row="mute-alerts"><span class="lbl">${u("muteAlerts")}<span class="muted">${u("muteAlertsHint")}</span></span>${this.seg("mute_alerts",[!1,!0],s,u("muteAlerts"),e)}</div>
        <div class="row" data-qw-row="channels"><span class="lbl">${u("channels")}<span class="muted">${u("channelsHint")}</span></span>${this.seg("channels",At,l=>u(l==="all"?"ch_all":"ch_push"),u("channels"),e)}</div>
      </div>
      ${n?o`<div class="err" role="alert" data-qw-problem>${n}</div>`:b}
      ${this.editable?o`<div class="foot sticky" data-qw-foot>
            <sw-button variant="primary" size="sm" icon="check" data-qw-save ?disabled=${!a||!!n||this.busy} @click=${()=>this.asking=!0}>${u("save")}</sw-button>
            ${this.message?o`<span class="ok" role="status" data-qw-message>${this.message}</span>`:b}
            ${this.error?o`<span class="err" role="alert" data-qw-error>${this.error}</span>`:b}
          </div>`:o`<div class="muted" data-qw-readonly>${this.error||u(S()?"readOnly":"demo")}</div>`}
      <sw-dialog ?open=${this.asking} heading=${u("confirmTitle")} @close=${()=>this.asking=!1} data-qw-confirm>
        <p>${u("confirmBody")}</p>
        ${Ct(this.saved,t)?o`<p class="err" data-qw-confirm-ends>${u("confirmEnds")}</p>`:b}
        <sw-button slot="footer" @click=${()=>this.asking=!1}>${u("cancel")}</sw-button>
        <sw-button slot="footer" variant="primary" data-qw-confirm-go @click=${()=>void this.save()}>${u("confirmGo")}</sw-button>
      </sw-dialog>
    </div>`}};x.styles=[gt,M`
    :host { display: block; }
    .card { display: grid; gap: 0; }
    .sub { margin: 0 0 10px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .ctl input { inline-size: 100%; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
  `];z([p()],x.prototype,"saved",2);z([p()],x.prototype,"draft",2);z([p()],x.prototype,"loaded",2);z([p()],x.prototype,"busy",2);z([p()],x.prototype,"asking",2);z([p()],x.prototype,"message",2);z([p()],x.prototype,"error",2);x=z([D("system-quiet-windows")],x);var Rt=Object.defineProperty,Ht=Object.getOwnPropertyDescriptor,m=(e,t,s,a)=>{for(var n=a>1?void 0:a?Ht(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(n=(a?l(t,s,n):l(n))||n);return a&&n&&Rt(t,s,n),n};const $=[{id:"sources",label:i("מקורות והרשאות – מה נשלח"),icon:"list"},{id:"quiet",label:i("שעות שקט ומה עובר"),icon:"moon"},{id:"esc",label:i("הסלמה"),icon:"escal"},{id:"lock",label:i("פרטיות מסך נעול"),icon:"lock"},{id:"keep",label:"שמירה",icon:"calendar"},{id:"mail",label:i("דואר יוצא"),icon:"mail"},{id:"wa",label:i("וואטסאפ"),icon:"chat"},{id:"chan",label:i("ערוצים"),icon:"phone"},{id:"log",label:i("יומן מסירה וכשלים"),icon:"inbox"}],Wt=[{id:"u-yoni",name:"יוני"},{id:"u-dana",name:"דנה"},{id:"u-uri",name:"אורי"},{id:"u-roni",name:"רוני"}],G=["scope","managers","initiator","users"],It={sent:"check",failed:"warning",gone:"warning",skipped:"moon",queued:"clock",retry:"refresh"},Mt={sent:"ok",failed:"bad",gone:"bad",skipped:"skp",queued:"skp",retry:"skp"},Ut=()=>i("{n} יום",{n:14}),Dt=e=>({linkBase:e.email.link_base??"",host:e.email.host,port:String(e.email.port),security:e.email.security,user:e.email.user,password:"",pwEdit:!e.email.password_set,from:e.email.from,recipients:e.email.recipients.join(", ")});let h=class extends U{constructor(){super(...arguments),this.bubbleSkin=new ze(this),this.section="",this.phase="loading",this.error="",this.settings=null,this.policies=[],this.stats=null,this.log=[],this.titles={},this.users=null,this.devices=0,this.wa=null,this.onlyFailed=!1,this.sec="sources",this.phone=window.matchMedia("(max-width: 1099px)").matches,this.toast=null,this.invalid=null,this.mail={linkBase:"",host:"",port:"587",security:"starttls",user:"",password:"",pwEdit:!0,from:"",recipients:""},this.mailBusy=null,this.mailResult=null,this.mailError="",this.picker=null,this.now=Date.now(),this.clockOffset=0,this.offClock=null,this.tz=void 0,this.rev=1,this.chain=Promise.resolve(),this.toastTimer=0,this.phoneMq=window.matchMedia("(max-width: 1099px)"),this.onMq=()=>this.phone=this.phoneMq.matches,this.nameOf=e=>{if(e==="managers")return i("מנהלי התראות");const t=e.map(s=>this.users?.find(a=>a.id===s)?.name??s);return t.length?t.join(", "):i("משתמשים נבחרים")}}connectedCallback(){super.connectedCallback(),Ee(this),this.phoneMq.addEventListener("change",this.onMq),this.load(),this.offClock=Ae(()=>this.now=Date.now()+this.clockOffset)}disconnectedCallback(){this.offClock?.(),this.offClock=null,this.phoneMq.removeEventListener("change",this.onMq),window.clearTimeout(this.toastTimer),super.disconnectedCallback()}willUpdate(e){e.has("section")&&$.some(t=>t.id===this.section)&&(this.sec=this.section)}async load(){this.phase="loading",this.error="";try{if(await Ce.prepare(),S()&&!we("notify.manage")){this.phase="user";return}const e=T();let t;try{t=await e.settings()}catch(g){if(Oe(g)==="forbidden"){this.phase="user";return}throw g}const[s,a,n,r,l,v,f,w]=await Promise.all([e.policies(),e.stats().catch(()=>null),e.adminDeliveries({limit:200}).catch(()=>[]),e.list({limit:100}).catch(()=>null),this.loadUsers(),this.countDevices(),this.clockAndZone(),C().view().catch(()=>null)]);this.wa=w,this.settings=t,this.rev=t.revision,this.policies=s,this.stats=a,this.log=n,this.titles=Object.fromEntries((r?.notifications??[]).map(g=>[g.id,g.title])),this.users=l,this.devices=v,this.now=f.now,this.clockOffset=f.now-Date.now(),this.tz=f.tz,this.mail=Dt(t),this.mailResult=null,this.phase="ready"}catch(e){this.error=N(e),this.phase="error"}}async clockAndZone(){if(S()){const t=await Te().catch(()=>({}));return{now:Date.now(),tz:typeof t["time.zone"]=="string"?t["time.zone"]:void 0}}const e=await F(()=>import("./notifications-mock-BZgAh40Y.js"),__vite__mapDeps([0]),import.meta.url);return{now:e.notifyMock().clock,tz:e.MOCK_TZ}}async loadUsers(){if(!S())return Wt;try{const{listUsers:e}=await F(async()=>{const{listUsers:t}=await import("./access-2tqE8RCf.js");return{listUsers:t}},__vite__mapDeps([0]),import.meta.url);return(await e()).users.filter(t=>t.active).map(t=>({id:t.id,name:t.name||t.username}))}catch{return null}}async countDevices(){if(!S())return(await F(async()=>{const{notifyMock:e}=await import("./notifications-mock-BZgAh40Y.js");return{notifyMock:e}},__vite__mapDeps([0]),import.meta.url)).notifyMock().registered;try{return(await qe()).subscriptions.length}catch{return 0}}say(e,t=!1){this.toast={text:e,bad:t},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,3e3)}enqueue(e){this.chain=this.chain.then(e).catch(()=>{})}async conflict(e){this.say(N(e),!0),await this.load()}patchSettings(e){if(!this.settings)return;this.settings={...this.settings,...e};const t=Ne(ae(this.settings));this.invalid=t,!t&&this.enqueue(async()=>{if(this.settings)try{const s=await T().saveSettings(ae(this.settings),this.rev);this.rev=s.revision,this.say(i("נשמר"))}catch(s){await this.conflict(s)}})}patchPolicy(e,t){const s=this.policies.find(n=>n.source===e);if(!s)return;let a;try{a=t(s)}catch(n){this.say(N(n),!0);return}this.policies=this.policies.map(n=>n.source===e?a:n),this.enqueue(async()=>{const n=this.policies.find(r=>r.source===e);if(n)try{const r=await T().savePolicy(e,Pe(n),n.revision);this.policies=this.policies.map(l=>l.source===e?{...l,revision:r.revision}:l),this.say(i("נשמר"))}catch(r){await this.conflict(r)}})}setSec(e){this.sec=e}mailBody(){const e=this.mail,t={host:e.host.trim(),port:Number(e.port),security:e.security,user:e.user.trim(),from:e.from.trim(),recipients:Le(e.recipients),link_base:e.linkBase.trim()};return e.pwEdit&&e.password&&(t.password=e.password),Re(t)?null:t}async saveMail(){const e=this.mailBody();if(!e){this.mailError=j.email_invalid;return}this.mailError="",this.mailBusy="save";try{const t=await T().saveEmail(e);this.settings&&(this.settings={...this.settings,email:t}),this.mailResult=null,this.mail={...this.mail,password:"",pwEdit:!t.password_set},this.say(i("הגדרות הדואר נשמרו"))}catch(t){this.mailError=N(t)}finally{this.mailBusy=null}}async testMail(){this.mailBusy="test",this.mailError="";try{this.mailResult=await T().testEmail();const e=await T().settings().catch(()=>null);e&&this.settings&&(this.settings={...this.settings,email:e.email})}catch(e){this.mailResult=null,this.mailError=N(e)}finally{this.mailBusy=null}}openPicker(e){const t=e==="esc"?Array.isArray(this.settings?.escalation.to)?this.settings?.escalation.to:[]:this.policies.find(s=>s.source===e)?.recipients.user_ids??[];this.picker={target:e,selected:[...t]}}savePicker(){const e=this.picker;if(!(!e||!e.selected.length)){if(e.target==="esc")this.patchSettings({escalation:{...this.settings.escalation,to:e.selected}});else{const t=e.selected;this.patchPolicy(e.target,s=>({...s,recipients:{rule:"users",user_ids:t}}))}this.picker=null}}sevSeg(e,t){return o`<span class="sevseg" role="radiogroup" aria-label=${i("חומרה")}>${ie.slice().reverse().map(s=>o`<button type="button" role="radio" aria-checked=${String(t===s)} aria-pressed=${String(t===s)} data-pol-sev=${`${e}:${s}`} style=${`--sev:var(--nt-sev-${s})`} title=${L[s]} @click=${()=>this.patchPolicy(e,a=>He(a,s))}><i aria-hidden="true"></i>${L[s]}</button>`)}</span>`}whoSel(e){const t=We.includes(e.source),s=this.settings?Ie(e,this.settings):e.recipients.rule,a=t?s:e.recipients.rule;return o`<select class="inp sm" data-pol-who=${e.source} aria-label=${i("מי מקבל")} ?disabled=${t} @change=${n=>{const r=n.target.value;r==="users"?(this.openPicker(e.source),n.target.value=a):this.patchPolicy(e.source,l=>Me(l,r))}}>${(G.includes(a)?G:[...G,a]).map(n=>o`<option value=${n} .selected=${a===n}>${n==="users"&&e.recipients.rule==="users"?`${ne.users} (${e.recipients.user_ids?.length??0})`:ne[n]}</option>`)}</select>`}chans(e){const t=this.settings,s=R(e,"webpush",t),a=R(e,"email",t),n=R(e,"app",t),r=R(e,"whatsapp",t,this.wa),l={email:i('הדוא"ל לא מוגדר'),whatsapp:i("וואטסאפ כבוי")},v=(f,w,g)=>o`<button type="button" class=${ce({chip:!0,unconf:w.note==="unconfigured"})} aria-pressed=${String(w.on)} data-pol-ch=${`${e.source}:${f}`} title=${w.note==="unconfigured"?l[f]??"":""} @click=${()=>this.patchPolicy(e.source,ke=>pt(ke,f,!w.on))}>${c(g)}${E[f]}</button>`;return o`<span class="chs"><span class="chip lock" title=${i("תמיד")}>${c("inbox")}${E.inbox}</span>${v("webpush",s,"phone")}${v("email",a,"mail")}${v("app",n,"phone")}${v("whatsapp",r,"chat")}<span class="chip soon" aria-disabled="true" title=${i("Companion – בקרוב")} aria-label=${i("Companion – בקרוב")}>${c("phone")}</span></span>`}tog(e,t,s,a,n=!1){return o`<button type="button" class="tog" role="switch" aria-checked=${String(e)} aria-label=${s} ?disabled=${n} data-tog=${t} @click=${a}></button>`}polToggle(e){return o`<button type="button" class="tog" role="switch" aria-checked=${String(e.enabled)} aria-label=${i("פעיל")} data-pol-on=${e.source} @click=${()=>this.patchPolicy(e.source,t=>({...t,enabled:!t.enabled}))}></button>`}renderSources(){const e=Ue("nvr")?this.policies:this.policies.filter(l=>!De(l.source)),t=Be(e,[...pe,...ut,...ht,...mt,...bt]),s=e.length,a=l=>l==="rule.alert"||pe.find(v=>v.key===l)?.rulesOnly===!0,n=this.settings;let r;return this.phone?r=o`<div class="scards">${t.flatMap(l=>l.rows).map(({info:l,policy:v})=>o`<section class="glass scard ${v.enabled?"":"off"}" data-pol-row=${v.source}>
        <div class="top"><span class="nm"><span class="ring">${c(l.icon)}</span></span><b>${l.label}</b>${this.polToggle(v)}</div>
        <div class="ln"><small>${i("חומרה")}</small>${a(v.source)?o`<span class="tag">${i("לפי החוק")}</span>`:this.sevSeg(v.source,v.severity)}</div>
        <div class="ln"><small>${i("מי מקבל")}</small>${this.whoSel(v)}</div>
        <div class="ln"><small>${i("ערוצים")}</small>${this.chans(v)}</div></section>`)}</div>`:r=o`<div class="mxw"><table class="mx"><colgroup><col style="width:20%"><col style="width:7%"><col style="width:24%"><col style="width:18%"><col></colgroup>
        <thead><tr><th>${i("מקור")}</th><th class="c">${i("פעיל")}</th><th>${i("חומרה")}</th><th>${i("מי מקבל")}</th><th>${i("ערוצים")}</th></tr></thead>
        <tbody>${t.map(l=>o`<tr class="cat"><td colspan="5">${c(l.icon)}${l.label}</td></tr>${l.rows.map(({info:v,policy:f})=>o`<tr class=${f.enabled?"":"off"} data-pol-row=${f.source}>
          <td class="keep"><span class="nm"><span class="ring">${c(v.icon)}</span><b>${v.label}</b></span></td>
          <td class="c keep">${this.polToggle(f)}</td>
          <td>${a(f.source)?o`<span class="tag">${i("לפי החוק")}</span>`:this.sevSeg(f.source,f.severity)}</td>
          <td>${this.whoSel(f)}</td><td>${this.chans(f)}</td></tr>`)}`)}</tbody></table></div>`,o`<section class="glass sec" data-set-section="sources" id="sec-sources"><header><h2>${c("list")}${$[0].label}</h2><div class="sp"><span class="tag soon">${c("phone")}${i("Companion – בקרוב")}</span><span class="tag" data-pol-count>${i("{n} מתוך {total} פעילים",{n:Fe(this.policies),total:s})}</span></div></header>
      <div class="frow"><div class="l"><b>${i("כשל בתזמון או באוטומציה מגיע אל")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${i("כשל בתזמון או באוטומציה")}>${je.map(l=>o`<button type="button" aria-pressed=${String(n.failures_audience===l)} data-failures-audience=${l} @click=${()=>this.patchSettings({failures_audience:l})}>${l==="admins"?i("מנהלים"):i("כל מי שרואה")}</button>`)}</div></div></div>
      ${r}</section>`}renderQuiet(){const e=this.settings,t=e.quiet,s=!t.enabled;return o`<section class="glass sec" data-set-section="quiet" id="sec-quiet"><header><h2>${c("moon")}${$[1].label}</h2><div class="sp">${this.tog(t.enabled,"quiet-on",i("שעות שקט"),()=>this.patchSettings({quiet:{...t,enabled:!t.enabled}}))}</div></header>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${i("שעות")}</b></div><div class="r"><input class="inp sm ltr" type="time" lang=${re()} data-quiet-from aria-label=${i("מהשעה")} style="inline-size:112px" .value=${t.from} ?disabled=${s} @change=${a=>this.setTime("from",a.target.value)} /><span>${i("עד")}</span><input class="inp sm ltr" type="time" lang=${re()} data-quiet-to aria-label=${i("עד השעה")} style="inline-size:112px" .value=${t.to} ?disabled=${s} @change=${a=>this.setTime("to",a.target.value)} /></div></div>
      ${this.invalid==="quiet_invalid"?o`<div class="errline" data-set-error>${j.quiet_invalid}</div>`:b}
      <div class="frow ${s?"dis":""}"><div class="l"><b>${i("ימים")}</b></div><div class="r"><div class="days" role="group" aria-label=${i("ימים")}>${Qe.map(a=>o`<button type="button" aria-pressed=${String(t.days.includes(a))} data-quiet-day=${a} ?disabled=${s} @click=${()=>this.patchSettings({quiet:{...t,days:Ke(t.days,a)}})}>${Ye[a]}</button>`)}</div></div></div>
      <div class="frow ${s?"dis":""}" style="align-items:flex-start"><div class="l"><b>${i("מה עובר בשעות שקט")}</b></div></div>
      <table class="qmx ${s?"dis":""}"><thead><tr><th>${i("חומרה")}</th><th>${E.webpush}</th><th>${E.email}</th><th>${E.whatsapp}</th><th>Companion</th></tr></thead><tbody>${ie.slice().reverse().map(a=>o`<tr><td><span class="sv" style=${`--sev:var(--nt-sev-${a})`}><i></i>${L[a]}</span></td>
        ${["webpush","email","whatsapp"].map(n=>o`<td><button type="button" class="chk" role="checkbox" aria-checked=${String(e.pass_through[a][n]??!1)} aria-label=${`${L[a]} · ${E[n]}`} data-pass=${`${a}:${n}`} ?disabled=${s} @click=${()=>this.patchSettings({pass_through:Ge(e.pass_through,a,n)})}>${c("check")}</button></td>`)}
        <td><button type="button" class="chk" role="checkbox" aria-checked=${String(e.pass_through[a].ha_mobile)} aria-label=${i("Companion – בקרוב")} disabled>${c("check")}</button></td></tr>`)}</tbody></table></section>
      <section class="glass sec" data-set-section="quiet-windows" id="sec-quiet-windows"><header><h2>${c("moon")}${u("title")}</h2></header><system-quiet-windows></system-quiet-windows></section>`}setTime(e,t){!this.settings||!Number.isFinite(Ve(t))||this.patchSettings({quiet:{...this.settings.quiet,[e]:t}})}renderEsc(){const t=this.settings.escalation,s=!t.enabled,a=t.to!=="managers",n=l=>this.patchSettings({escalation:{...t,...l}}),r=Xe(t,842,this.nameOf);return o`<section class="glass sec" data-set-section="esc" id="sec-esc"><header><h2>${c("escal")}${$[2].label}</h2><div class="sp">${this.tog(t.enabled,"esc-on",i("הסלמה"),()=>n({enabled:!t.enabled}))}</div></header>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${i("אחרי")}</b><small>${i("קריטי בלי אישור")}</small></div><div class="r"><span class="stp"><button type="button" data-esc-step="-1" aria-label=${i("פחות")} @click=${()=>this.patchSettings({escalation:oe(t,-1)})}>${c("minus")}</button><span class="vv" data-esc-min><span class="n">${t.after_min}</span><small>${i("דק׳")}</small></span><button type="button" data-esc-step="1" aria-label=${i("יותר")} @click=${()=>this.patchSettings({escalation:oe(t,1)})}>${c("plus")}</button></span></div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${i("שלבים")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${i("שלבים")}>${[1,2,3].map(l=>o`<button type="button" aria-pressed=${String(t.steps===l)} data-esc-steps=${l} @click=${()=>n({steps:l})}>${l}</button>`)}</div></div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${i("אל")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${i("אל")}><button type="button" aria-pressed=${String(!a)} data-esc-to="managers" @click=${()=>n({to:"managers"})}>${i("מנהלי התראות")}</button><button type="button" aria-pressed=${String(a)} data-esc-to="users" @click=${()=>this.openPicker("esc")}>${i("משתמשים נבחרים")}</button></div>${a?o`<span class="tag" data-esc-names>${this.nameOf(t.to)}</span>`:b}</div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>${i("נעצרת באישור")}</b></div><div class="r"><span class="tag ok">${c("lock")}${i("תמיד")}</span></div></div>
      ${this.invalid==="escalation_invalid"?o`<div class="errline" data-set-error>${j.escalation_invalid}</div>`:b}
      <div class="escprev ${s?"dis":""}" data-esc-preview><div class="tl">${r.map(l=>o`<div class="ev ${l.kind}"><span class="t">${l.clock}</span><span class="d"><i></i></span><span class="b"><b>${l.title}</b><small>${l.sub}</small></span></div>`)}</div></div></section>`}lockPhone(e,t){const s=Ze(e,this.tz);return o`<div class=${ce({lphone:!0,sel:t})} data-lock-phone=${e} data-lock-selected=${String(t)}><span class="notch"></span><span class="llabel">${c("lock")}${le[e]}</span>
      <div class="ltime n">14:10</div><div class="ldate">${i("יום רביעי, 1 באוקטובר")}</div>
      <div class="lcards">${(e==="generic"?s.slice(0,1):s).map(a=>o`<div class="pushcard" data-push-card><div class="ph"><span class="app">S</span>Arx<span class="ago">${a.ago}</span></div><b>${a.title}</b><p>${a.body}</p>
        <div class="acts">${a.actions.map(n=>o`<span class=${n.id==="open_door"?"door":""}>${c(n.id==="open"?"open":n.id==="ack"?"checkAll":n.id==="snooze"?"snooze":"doorOpen")}${n.label}</span>`)}</div></div>`)}</div></div>`}renderLock(){const e=this.settings;return o`<section class="glass sec" data-set-section="lock" id="sec-lock"><header><h2>${c("lock")}${$[3].label}</h2></header>
      <div class="frow"><div class="l"><b>${i("רמת פירוט")}</b></div><div class="r"><div class="seg" role="group" aria-label=${i("רמת פירוט")}>${Je.map(t=>o`<button type="button" aria-pressed=${String(e.lockscreen===t)} data-lock-level=${t} @click=${()=>this.patchSettings({lockscreen:t})}>${le[t]}</button>`)}</div></div></div>
      <div class="lockrow" data-lock-preview>${["generic","type_place","full"].map(t=>this.lockPhone(t,e.lockscreen===t))}</div>
      <div class="frow dis"><div class="l"><b>${i("תמונה מהמצלמה בהתראה")}</b><small>${i("התמונה נפתחת רק בתוך Arx")}</small></div><div class="r"><span class="tag soon">${i("בקרוב")}</span>${this.tog(!1,"image-in-push",i("תמונה בהתראה"),()=>{},!0)}</div></div>
      <div class="frow dis"><div class="l"><b>${i('צליל קריטי שעוקף "נא לא להפריע"')}</b><small>${i("בטיחות בלבד · טלפוני Companion")}</small></div><div class="r"><span class="tag soon">${i("בקרוב")}</span>${this.tog(e.companion.critical_sound_safety,"critical-sound",i("צליל קריטי"),()=>{},!0)}</div></div></section>`}renderKeep(){const e=this.settings;return o`<section class="glass sec" data-set-section="keep" id="sec-keep"><header><h2>${c("calendar")}${$[4].label}</h2></header>
      <div class="frow"><div class="l"><b>${i("התראות")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${i("שמירת התראות")}>${et.map(t=>o`<button type="button" aria-pressed=${String(e.retention_days===t)} data-keep=${t} @click=${()=>this.patchSettings({retention_days:t})}>${t}</button>`)}</div><span>${i("ימים")}</span></div></div>
      <div class="frow"><div class="l"><b>${i("יומן מסירה")}</b></div><div class="r"><span class="tag"><span class="n">${e.deliveries_retention_days}</span> ${i("ימים")}</span></div></div></section>`}renderMail(){const e=this.settings,t=this.mail,s=e.email,a=r=>this.mail={...this.mail,...r},n=this.mailResult?this.mailResult.ok?o`<span class="tag ok" data-mail-result="ok">${c("check")}${de(this.mailResult)}</span>`:o`<span class="tag bad" data-mail-result="bad">${c("warning")}${de(this.mailResult)}</span>`:s.last_test?o`<span class="tag ${s.last_test.ok?"ok":"bad"}" data-mail-last>${c(s.last_test.ok?"check":"warning")}${s.last_test.ok?`${i("נבדק {time}",{time:tt(s.last_test.at,this.tz)})} · ${i("תקין")}`:`${i("הבדיקה נכשלה")} · ${s.last_test.detail}`}</span>`:o`<span class="tag" data-mail-last>${s.configured?i("לא נבדק"):i("לא מוגדר")}</span>`;return o`<section class="glass sec" data-set-section="mail" id="sec-mail"><header><h2>${c("mail")}${$[5].label}</h2><div class="sp">${n}</div></header>
      <div class="fgrid">
        <label>${i("שרת")}<input class="inp ltr" data-mail-host .value=${t.host} @input=${r=>a({host:r.target.value})} /></label>
        <label>${i("פורט")}<input class="inp ltr" inputmode="numeric" data-mail-port .value=${t.port} @input=${r=>a({port:r.target.value})} /></label>
        <label>${i("אבטחה")}<select class="inp" data-mail-security @change=${r=>a({security:r.target.value})}>${["starttls","tls","none"].map(r=>o`<option value=${r} .selected=${t.security===r}>${r==="none"?i("ללא"):r==="tls"?"TLS":"STARTTLS"}</option>`)}</select></label>
        <label>${i("משתמש")}<input class="inp ltr" data-mail-user .value=${t.user} @input=${r=>a({user:r.target.value})} /></label>
        <label>${i("סיסמה")}<span style="display:flex;gap:8px"><input class="inp ltr" type="password" autocomplete="new-password" data-mail-password style="flex:1" .value=${t.pwEdit?t.password:"••••••••••"} ?readonly=${!t.pwEdit} @input=${r=>a({password:r.target.value})} />${s.password_set&&!t.pwEdit?o`<button type="button" class="btn quiet sm" data-mail-pw-change @click=${()=>a({pwEdit:!0,password:""})}>${i("החלפה")}</button>`:b}</span></label>
        <label>${i("מאת")}<input class="inp ltr" data-mail-from .value=${t.from} @input=${r=>a({from:r.target.value})} /></label>
        <label class="w2">${i("נמענים")}<input class="inp ltr" data-mail-recipients .value=${t.recipients} @input=${r=>a({recipients:r.target.value})} /></label>
        <label class="w2">${i("כתובת Arx לקישור")}<input class="inp ltr" data-mail-linkbase placeholder="https://" .value=${t.linkBase} @input=${r=>a({linkBase:r.target.value})} /></label>
      </div>
      ${this.mailError?o`<div class="errline" data-mail-error role="alert">${this.mailError}</div>`:b}
      <div class="frow mailfoot"><button type="button" class="btn quiet" data-mail-test ?disabled=${this.mailBusy!==null||!s.configured} @click=${()=>void this.testMail()}>${c(this.mailBusy==="test"?"refresh":"send")}${this.mailBusy==="test"?i("שולח…"):i("שליחת בדיקה")}</button><button type="button" class="btn primary" data-mail-save ?disabled=${this.mailBusy!==null} @click=${()=>void this.saveMail()}>${i("שמירה")}</button></div></section>`}renderWa(){return o`<div data-set-section="wa" id="sec-wa"><notify-whatsapp-section section-id="wa-inner" @notify-saved=${e=>{this.say(e.detail.text),C().view().then(t=>this.wa=t).catch(()=>{}),this.renderRoot.querySelectorAll("notify-whatsapp-mine").forEach(t=>t.reload())}}></notify-whatsapp-section></div>`}renderChannels(){const e=this.settings,t=Q("webpush",e,this.devices),s=Q("email",e,this.devices),a=Q("whatsapp",e,this.devices,this.wa?{enabled:this.wa.enabled,mapped:this.wa.account.mapped}:null),n=(r,l)=>o`<span class="tag ${r==="on"||r==="always"?"ok":r==="soon"?"soon":""}">${r==="on"||r==="always"?i("פעיל"):l}</span>`;return o`<section class="glass sec" data-set-section="chan" id="sec-chan"><header><h2>${c("phone")}${$[7].label}</h2></header>
      <div class="frow"><div class="l"><b>${i("מרכז ההתראות במחשב")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${i("מרכז ההתראות במחשב")}>${st.map(r=>o`<button type="button" aria-pressed=${String(e.center_layout===r)} data-layout=${r} @click=${()=>this.patchSettings({center_layout:r})}>${at[r]}</button>`)}</div></div></div>
      <div class="chgrid">
        <div class="chc" data-channel="inbox"><span class="ring">${c("inbox")}</span><b>${i("מרכז ההתראות")}</b><small>${i("פעיל תמיד · לכל המשתמשים")}</small>${n("always","")}</div>
        <div class="chc" data-channel="webpush"><span class="ring">${c("phone")}</span><b>${i("דחיפה (Arx)")}</b><small>${t.state==="on"?i("{n} מכשירים רשומים אצלך",{n:this.devices}):t.text}</small>${n(t.state,t.text)}</div>
        <div class="chc" data-channel="email"><span class="ring">${c("mail")}</span><b>${i('דוא"ל')}</b><small>${s.state==="on"?i("תקלות מערכת וגיבויים"):i("לא מוגדר")}</small>${n(s.state,s.text)}</div>
        <div class="chc" data-channel="app"><span class="ring">${c("phone")}</span><b>${i("אפליקציה לנייד")}</b><small>${i("לפי המכשירים שנרשמו באפליקציה · שעות השקט כמו דחיפה")}</small>${n("on","")}</div>
        <div class="chc soon" data-channel="ha_mobile"><span class="ring">${c("phone")}</span><b>Companion</b><small>${i("טלפונים לפי משתמש")}</small><span class="tag soon">${i("בקרוב")}</span></div>
        <div class="chc" data-channel="whatsapp"><span class="ring">${c("chat")}</span><b>WhatsApp</b><small>${a.text}</small>${n(a.state,a.text)}</div>
      </div>
      <div class="devbox"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></div></section>`}renderLog(){const e=it(this.stats),t=nt(this.log,this.onlyFailed),s=rt(this.log);return o`<section class="glass sec" data-set-section="log" id="sec-log"><header><h2>${c("inbox")}${$[8].label}</h2><div class="sp"><span class="tag" data-log-window>${Ut()}</span><div class="seg sm" role="group" aria-label=${i("סינון היומן")}><button type="button" aria-pressed=${String(!this.onlyFailed)} data-log-filter="all" @click=${()=>this.onlyFailed=!1}>${i("הכל")}</button><button type="button" aria-pressed=${String(this.onlyFailed)} data-log-filter="failed" @click=${()=>this.onlyFailed=!0}>${i("רק כשלים")}${s?o`<small class="n">${s}</small>`:b}</button></div></div></header>
      <div class="fails" data-fail-panel>${e.map(a=>o`<div class="fstat ${a.tone}" data-fail-card=${a.channel}><span class="ch">${a.label} · ${i("24 שעות")}</span><b class="n">${a.failed>0?a.failed:a.sent}</b><small>${a.failed>0?i("נכשלו"):i("נשלחו")}${a.skipped?` · ${i("{n} לא נשלחו",{n:a.skipped})}`:""}</small></div>`)}</div>
      <div class="lgw"><table class="lg"><thead><tr><th>${i("שעה")}</th><th>${i("התראה")}</th><th>${i("משתמש")}</th><th>${i("ערוץ")}</th><th>${i("מצב")}</th><th>${i("סיבה")}</th></tr></thead><tbody>${t.length?t.map(a=>o`<tr data-log-row=${a.id} data-log-status=${a.status}><td class="n" style="direction:rtl">${lt(a.at,this.now,this.tz)}</td><td>${this.titles[a.notification_id]??"—"}</td><td>${a.user_display}</td><td>${c(a.channel==="email"?"mail":a.channel==="whatsapp"?"chat":"phone")}${E[a.channel]}</td><td class=${Mt[a.status]}>${c(It[a.status])}${ot[a.status]}</td><td>${ct(a.reason)||"—"}</td></tr>`):o`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--dv-text-3)">${i("אין רשומות")}</td></tr>`}</tbody></table></div></section>`}renderPicker(){const e=this.picker;if(!e)return b;const t=this.users;return o`<sw-dialog open heading=${i("משתמשים נבחרים")} data-user-picker @close=${()=>this.picker=null}>
      ${t&&t.length?o`<div class="pick" role="group">${t.map(s=>o`<button type="button" role="checkbox" aria-checked=${String(e.selected.includes(s.id))} data-pick=${s.id} @click=${()=>this.picker={...e,selected:e.selected.includes(s.id)?e.selected.filter(a=>a!==s.id):[...e.selected,s.id]}}><span class="chk" aria-hidden="true" data-on=${String(e.selected.includes(s.id))} style=${e.selected.includes(s.id)?"background:var(--dv-accent);border-color:transparent":""}>${c("check")}</span>${s.name}</button>`)}</div>`:o`<div class="errline">${i("רשימת המשתמשים לא זמינה")}</div>`}
      <button slot="footer" type="button" class="btn quiet" @click=${()=>this.picker=null}>${i("ביטול")}</button>
      <button slot="footer" type="button" class="btn primary" data-pick-save ?disabled=${!e.selected.length} @click=${()=>this.savePicker()}>${i("שמירה")}</button>
    </sw-dialog>`}renderBody(){if(this.phase==="loading")return o`<div class="skbox" data-set-state="loading" aria-busy="true"><span class="skl"></span><span class="skl"></span><span class="skl"></span></div>`;if(this.phase==="error")return o`<div class="errbar" role="alert" data-set-state="error">${c("warning")}<span>${this.error||i("לא ניתן לטעון את ההגדרות")}</span><button type="button" class="btn sm" data-set-retry @click=${()=>void this.load()}>${c("refresh")}${i("נסה שוב")}</button></div>`;if(this.phase==="user")return o`<div class="secs" data-set-state="user"><section class="glass sec"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></section></div>`;const e={sources:()=>this.renderSources(),quiet:()=>this.renderQuiet(),esc:()=>this.renderEsc(),lock:()=>this.renderLock(),keep:()=>this.renderKeep(),mail:()=>this.renderMail(),wa:()=>this.renderWa(),chan:()=>this.renderChannels(),log:()=>this.renderLog()};return o`<div class="set" data-set-state="ready"><sw-tabs variant="underline" class="settabs" data-set-tabs group-label=${i("מדורים")} panel="set-panel" .items=${$.map(t=>({id:t.id,label:t.label}))} .active=${this.sec} @change=${t=>this.setSec(t.detail.id)}></sw-tabs>
      <div class="secs" id="set-panel" data-set-panel=${this.sec}>${e[this.sec]()}</div></div>`}render(){return o`<sw-page class="page" heading=${i("התראות")} crumbs=${i("מערכת")} data-notify-settings data-phase=${this.phase}>
      ${this.renderBody()}
    </sw-page>
    ${this.renderPicker()}
    ${this.toast?o`<div class="toast ${this.toast.bad?"bad":""}" role="status" data-set-toast ${dt()}>${c(this.toast.bad?"warning":"check")}${this.toast.text}</div>`:b}`}};h.styles=[vt,X,ft,Z,J,M`
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
    `];m([ge()],h.prototype,"section",2);m([p()],h.prototype,"phase",2);m([p()],h.prototype,"error",2);m([p()],h.prototype,"settings",2);m([p()],h.prototype,"policies",2);m([p()],h.prototype,"stats",2);m([p()],h.prototype,"log",2);m([p()],h.prototype,"titles",2);m([p()],h.prototype,"users",2);m([p()],h.prototype,"devices",2);m([p()],h.prototype,"wa",2);m([p()],h.prototype,"onlyFailed",2);m([p()],h.prototype,"sec",2);m([p()],h.prototype,"phone",2);m([p()],h.prototype,"toast",2);m([p()],h.prototype,"invalid",2);m([p()],h.prototype,"mail",2);m([p()],h.prototype,"mailBusy",2);m([p()],h.prototype,"mailResult",2);m([p()],h.prototype,"mailError",2);m([p()],h.prototype,"picker",2);m([p()],h.prototype,"now",2);m([p()],h.prototype,"tz",2);h=m([D("system-notifications")],h);export{h as SystemNotifications};
