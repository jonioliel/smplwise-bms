const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{i as k,bb as H,g as V,b7 as fe,j as L,g$ as G,yS as X,yT as Z,E as M,F as ue,G as d,a as I,e as r,yU as l,A as b,H as U,fo as ge,R as J,av as he,S as we,yV as $e,b$ as xe,yW as ye,yX as O,yY as _e,yZ as T,J as ke,_ as D,y_ as ze,a4 as Se,y$ as ee,z0 as Ee,z1 as Ce,z2 as Ae,z3 as F,z4 as te,z5 as P,z6 as Oe,X as qe,Y as Te,z7 as Ne,uq as se,z8 as R,z9 as S,be as Pe,za as Re,zb as He,zc as Le,a6 as We,bV as ae,zd as Me,ze as Ie,zf as Ue,zg as Be,zh as De,zi as Fe,zj as ie,zk as je,zl as ne,cW as re,zm as Ye,zn as Qe,zo as oe,zp as Ke,zq as j,a5 as Ve,zr as Ge,zs as Xe,zt as Ze,zu as Je,zv as et,zw as tt,zx as st,zy as at,zz as le,zA as it,zB as nt,zC as rt,zD as ot,C as lt}from"./index-Bd8RPmTw.js";import{a as ct}from"./media-page-wfUh64aO.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-C-QEU5xo.js";const dt={view:()=>V("notify/whatsapp"),save:e=>H("notify/whatsapp",e),test:()=>fe("notify/whatsapp/test"),mine:()=>V("me/notify-whatsapp"),setOptIn:(e,t)=>H("me/notify-whatsapp",e?{opted_in:!0,confirm:t}:{opted_in:!1}),setOptOut:(e,t)=>H("me/notify-whatsapp",e?{opted_in:!1}:{opted_in:!0,confirm:t})};function pt(){let e={enabled:!1,per_user_hour:4,dedupe_min:30,budget_pct:50,budget_critical_pct:80,detail:"type_place",detail_levels:["generic","type_place"],normalized:[],warnings:[],revision:0,ranges:{per_user_hour:[1,30],dedupe_min:[5,1440],budget_pct:[10,90],budget_critical_pct:[10,90]},account:{mapped:!0,label:"וואטסאפ ····0191",state:"connected"},reachable_users:3,accounts_href:"#/system/messaging-accounts",test:{own_number:!0,masked:"····0191"}},t={channel_enabled:!1,has_number:!0,masked:"····0191",source:"directory",opted_in:!1,number_changed:!1,directory_declined:!1,consent:"declined",confirm:"demo0123456789ab",stored_opt_in:!1},s=0;const a=(i,n,o)=>new L(i,{code:n,user_message:o,retryable:i===429,correlation_id:"demo",details:{}});return{view:async()=>structuredClone(e),save:async i=>{if(i.revision!==e.revision)throw a(412,"settings_conflict","ההגדרות השתנו בינתיים; טען מחדש.");const[n,o]=e.ranges.per_user_hour,[m,v]=e.ranges.dedupe_min;if(i.per_user_hour!==void 0&&(i.per_user_hour<n||i.per_user_hour>o)||i.dedupe_min!==void 0&&(i.dedupe_min<m||i.dedupe_min>v))throw a(422,"validation","ערך מספרי מחוץ לטווח.");const g=i.budget_pct??e.budget_pct,f=i.budget_critical_pct??e.budget_critical_pct;if(g<10||g>90||f<10||f>90||f<g)throw a(422,"validation","ערך מספרי מחוץ לטווח.");return e={...e,..."enabled"in i?{enabled:!!i.enabled}:{},...i.per_user_hour!==void 0?{per_user_hour:i.per_user_hour}:{},...i.dedupe_min!==void 0?{dedupe_min:i.dedupe_min}:{},budget_pct:g,budget_critical_pct:f,...i.detail?{detail:i.detail}:{},revision:e.revision+1},t={...t,channel_enabled:e.enabled},structuredClone(e)},test:async()=>{if(!e.account.mapped)throw a(409,"channel_unavailable","לא נבחר חשבון וואטסאפ להתראות.");if(++s>3)throw a(429,"rate_limited","יותר מדי הודעות בדיקה. נסו שוב מאוחר יותר.");return{ok:!0,outcome:"sent",code:null}},mine:async()=>({...t}),setOptIn:async(i,n)=>{if(i&&n!==t.confirm)throw a(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return t={...t,opted_in:i,stored_opt_in:i,number_changed:!1,consent:i&&!t.directory_declined?"granted":"declined"}},setOptOut:async(i,n)=>{if(!i&&n!==t.confirm)throw a(409,"number_changed","המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר.");return t={...t,opted_in:!i,stored_opt_in:!i,number_changed:!1,consent:!i&&!t.directory_declined?"granted":"declined"}}}}let ut=null;const C=()=>k()?dt:ut??=pt(),be={keyUnreadable:"מפתח ההודעות של המערכת לא נקרא - אי אפשר לאמת הסכמות, ולכן לא נשלחות התראות בוואטסאפ",normalized:"ערך שמור לא היה בטווח ותוקן - שמרו כדי לאשר",budget:"חלק מתקציב החשבון",budgetHint:"השאר נשמר להודעות ניהול השירות ולקודי אימות",budgetCritical:"חלק לקריטי",budgetCriticalHint:"קריטי והסלמה רשאים להשתמש עד כאן",detail:"פירוט בהודעה",detailHint:"תוכן ההתראה עצמו לא נשלח לוואטסאפ",detail_generic:"כללי",detail_type_place:"סוג ומקום",mine_title:"וואטסאפ שלי",mine_sub:"התראות לוואטסאפ האישי שלך, רק אם אישרת את המספר בעצמך",mine_number:"המספר",mine_src_directory:"מרשימת אנשי הקשר",mine_src_profile:"מהפרופיל",mine_status:"מצב",mine_on:"מקבל התראות",mine_off:"לא מקבל התראות",mine_changed:"המספר השתנה - אשר מחדש כדי לקבל התראות",mine_declined:"ברשימת אנשי הקשר וואטסאפ אינו הערוץ המועדף",mine_none:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",mine_confirm:"אישור המספר וקבלת התראות",mine_stop:"הפסקת התראות בוואטסאפ",on:"פעיל",off:"כבוי",attention:"דורש טיפול",title:"וואטסאפ",sub:"התראות לטלפון האישי של המשתמש, מהחשבון שנבחר בערוץ ההודעות",enabled:"שליחת התראות בוואטסאפ",enabledHint:"כבוי = שום התראה לא נשלחת בוואטסאפ, גם אם סומנה במדיניות",account:"חשבון שולח",accountNone:"לא נבחר חשבון",accountPick:"בחירת חשבון",st_connected:"מחובר",st_disconnected:"מנותק",st_unknown:"לא ידוע",st_missing:"לא נמצא",reach:"משתמשים עם מספר",reachHint:"מספר מרשימת אנשי הקשר, כשוואטסאפ הוא הערוץ המועדף",cap:"לכל משתמש בשעה",capHint:"התראה קריטית והסלמה אינן נספרות",dedupe:"בלי כפילות במשך",minutes:"דק׳",test:"שליחת בדיקה",testing:"שולח…",testHint:"נשלחת רק למספר שלך ({masked})",testNoNumber:"אין לך מספר וואטסאפ ברשימת אנשי הקשר",testOk:"הודעת הבדיקה נשלחה",testFail:"הבדיקה נכשלה",warnOffAccount:"אין חשבון שולח - ההתראות לא יישלחו",saved:"נשמר",loading:"טוען…",error:"לא ניתן לטעון את הגדרות הוואטסאפ",retry:"נסה שוב",less:"פחות",more:"יותר"},ht={keyUnreadable:"The system messaging key could not be read - consents cannot be verified, so no WhatsApp notifications are sent",normalized:"A stored value was out of range and was corrected - save to confirm",budget:"Share of the account budget",budgetHint:"The rest stays for service-management messages and verification codes",budgetCritical:"Share for critical",budgetCriticalHint:"Critical notifications and escalations may use up to this",detail:"Detail in the message",detailHint:"The text of the alert itself is never sent to WhatsApp",detail_generic:"Generic",detail_type_place:"Type and place",mine_title:"My WhatsApp",mine_sub:"Notifications to your own WhatsApp, only after you confirmed the number yourself",mine_number:"Number",mine_src_directory:"From the contact list",mine_src_profile:"From the profile",mine_status:"Status",mine_on:"Receiving notifications",mine_off:"Not receiving notifications",mine_changed:"The number changed - confirm again to receive notifications",mine_declined:"The contact list says WhatsApp is not the preferred channel",mine_none:"You have no WhatsApp number in the contact list",mine_confirm:"Confirm the number and receive notifications",mine_stop:"Stop WhatsApp notifications",on:"On",off:"Off",attention:"Needs attention",title:"WhatsApp",sub:"Notifications to the user's own phone, from the account chosen in the message channel",enabled:"Send notifications on WhatsApp",enabledHint:"Off = no notification is sent on WhatsApp, even when a policy selects it",account:"Sending account",accountNone:"No account chosen",accountPick:"Choose an account",st_connected:"Connected",st_disconnected:"Disconnected",st_unknown:"Unknown",st_missing:"Not found",reach:"Users with a number",reachHint:"A number from the contact list, when WhatsApp is the preferred channel",cap:"Per user per hour",capHint:"Critical notifications and escalations are not counted",dedupe:"No repeats within",minutes:"min",test:"Send a test",testing:"Sending…",testHint:"Sent only to your own number ({masked})",testNoNumber:"You have no WhatsApp number in the contact list",testOk:"The test message was sent",testFail:"The test failed",warnOffAccount:"No sending account - notifications will not be sent",saved:"Saved",loading:"Loading…",error:"The WhatsApp settings could not be loaded",retry:"Try again",less:"Less",more:"More"},bt={keyUnreadable:"تعذّرت قراءة مفتاح الرسائل في النظام - لا يمكن التحقق من الموافقات، لذلك لا تُرسل إشعارات واتساب",normalized:"كانت قيمة محفوظة خارج النطاق وتم تصحيحها - احفظ للتأكيد",budget:"حصة من ميزانية الحساب",budgetHint:"الباقي محفوظ لرسائل إدارة الخدمة ورموز التحقق",budgetCritical:"حصة الحرج",budgetCriticalHint:"يمكن للإشعارات الحرجة والتصعيد استخدام حتى هذا الحد",detail:"التفاصيل في الرسالة",detailHint:"نص الإشعار نفسه لا يُرسل إلى واتساب",detail_generic:"عام",detail_type_place:"النوع والمكان",mine_title:"واتساب الخاص بي",mine_sub:"إشعارات إلى واتساب الشخصي، فقط بعد أن تؤكد الرقم بنفسك",mine_number:"الرقم",mine_src_directory:"من قائمة جهات الاتصال",mine_src_profile:"من الملف الشخصي",mine_status:"الحالة",mine_on:"تصلك الإشعارات",mine_off:"لا تصلك الإشعارات",mine_changed:"تغيّر الرقم - أكّد مجددًا لتلقي الإشعارات",mine_declined:"قائمة جهات الاتصال تقول إن واتساب ليس القناة المفضلة",mine_none:"لا يوجد لديك رقم واتساب في قائمة جهات الاتصال",mine_confirm:"تأكيد الرقم وتلقي الإشعارات",mine_stop:"إيقاف إشعارات واتساب",on:"مفعّل",off:"مطفأ",attention:"يحتاج إلى معالجة",title:"واتساب",sub:"إشعارات إلى الهاتف الشخصي للمستخدم، من الحساب المختار في قناة الرسائل",enabled:"إرسال الإشعارات عبر واتساب",enabledHint:"مطفأ = لا يُرسل أي إشعار عبر واتساب حتى لو تم اختياره في السياسة",account:"الحساب المرسِل",accountNone:"لم يتم اختيار حساب",accountPick:"اختيار حساب",st_connected:"متصل",st_disconnected:"غير متصل",st_unknown:"غير معروف",st_missing:"غير موجود",reach:"مستخدمون لديهم رقم",reachHint:"رقم من قائمة جهات الاتصال، عندما يكون واتساب هو القناة المفضلة",cap:"لكل مستخدم في الساعة",capHint:"الإشعارات الحرجة والتصعيد لا تُحتسب",dedupe:"بدون تكرار خلال",minutes:"دقيقة",test:"إرسال اختبار",testing:"جارٍ الإرسال…",testHint:"يُرسل إلى رقمك فقط ({masked})",testNoNumber:"لا يوجد لديك رقم واتساب في قائمة جهات الاتصال",testOk:"تم إرسال رسالة الاختبار",testFail:"فشل الاختبار",warnOffAccount:"لا يوجد حساب مرسِل - لن تُرسل الإشعارات",saved:"تم الحفظ",loading:"جارٍ التحميل…",error:"تعذّر تحميل إعدادات واتساب",retry:"إعادة المحاولة",less:"أقل",more:"أكثر"},mt={keyUnreadable:"Не удалось прочитать ключ сообщений системы — согласия нельзя проверить, поэтому уведомления WhatsApp не отправляются",normalized:"Сохранённое значение было вне диапазона и исправлено — сохраните для подтверждения",budget:"Доля бюджета аккаунта",budgetHint:"Остальное остаётся для сообщений управления сервисом и кодов подтверждения",budgetCritical:"Доля для критических",budgetCriticalHint:"Критические уведомления и эскалации могут использовать до этого предела",detail:"Подробность сообщения",detailHint:"Сам текст уведомления в WhatsApp не отправляется",detail_generic:"Общее",detail_type_place:"Тип и место",mine_title:"Мой WhatsApp",mine_sub:"Уведомления на ваш WhatsApp, только после того как вы сами подтвердили номер",mine_number:"Номер",mine_src_directory:"Из списка контактов",mine_src_profile:"Из профиля",mine_status:"Статус",mine_on:"Уведомления приходят",mine_off:"Уведомления не приходят",mine_changed:"Номер изменился — подтвердите снова, чтобы получать уведомления",mine_declined:"В списке контактов WhatsApp не указан как предпочтительный канал",mine_none:"У вас нет номера WhatsApp в списке контактов",mine_confirm:"Подтвердить номер и получать уведомления",mine_stop:"Остановить уведомления WhatsApp",on:"Включено",off:"Выключено",attention:"Требует внимания",title:"WhatsApp",sub:"Уведомления на личный телефон пользователя с аккаунта, выбранного в канале сообщений",enabled:"Отправлять уведомления в WhatsApp",enabledHint:"Выключено = ни одно уведомление не отправляется в WhatsApp, даже если оно выбрано в политике",account:"Аккаунт отправителя",accountNone:"Аккаунт не выбран",accountPick:"Выбрать аккаунт",st_connected:"Подключён",st_disconnected:"Отключён",st_unknown:"Неизвестно",st_missing:"Не найден",reach:"Пользователи с номером",reachHint:"Номер из списка контактов, если WhatsApp — предпочтительный канал",cap:"На пользователя в час",capHint:"Критические уведомления и эскалации не учитываются",dedupe:"Без повторов в течение",minutes:"мин",test:"Отправить тест",testing:"Отправка…",testHint:"Отправляется только на ваш номер ({masked})",testNoNumber:"У вас нет номера WhatsApp в списке контактов",testOk:"Тестовое сообщение отправлено",testFail:"Тест не удался",warnOffAccount:"Нет аккаунта отправителя — уведомления не будут отправлены",saved:"Сохранено",loading:"Загрузка…",error:"Не удалось загрузить настройки WhatsApp",retry:"Повторить",less:"Меньше",more:"Больше"};function N(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const vt={he:be,en:ht,ar:bt,ru:mt};function c(e,t,s=N()){const a=vt[s][e]??be[e]??e;return t?a.replace(/\{(\w+)\}/g,(i,n)=>n in t?String(t[n]):i):a}const y={stepCap(e,t){const[s,a]=e.ranges.per_user_hour;return Math.min(a,Math.max(s,e.per_user_hour+t))},warning(e){return e.enabled&&!e.account.mapped?"no_account":null},tone(e){return e.enabled?e.account.mapped&&e.account.state==="connected"?"ok":"bad":"off"},canTest(e){return e.test.own_number&&e.account.mapped},stepPct(e,t,s){const[a,i]=e.ranges[t],n=Math.min(i,Math.max(a,e[t]+s));return t==="budget_pct"?{budget_pct:n,budget_critical_pct:Math.max(n,e.budget_critical_pct)}:{budget_pct:Math.min(e.budget_pct,n),budget_critical_pct:n}},canStop(e){return!!e&&e.channel_enabled&&(e.opted_in||!!e.stored_opt_in)},mineState(e){return!e||!e.channel_enabled?"hidden":e.has_number?e.directory_declined?"declined":e.number_changed?"changed":e.opted_in?"on":"off":"none"}};var ft=Object.defineProperty,gt=Object.getOwnPropertyDescriptor,A=(e,t,s,a)=>{for(var i=a>1?void 0:a?gt(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&ft(t,s,i),i};const wt=[5,15,30,60];let _=class extends I{constructor(){super(...arguments),this.sectionId="wa",this.view=null,this.phase="loading",this.busy=!1,this.result=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.phase="loading";try{this.view=await C().view(),this.phase="ready"}catch{this.phase="error"}}errText(e){return e instanceof L?e.body.user_message||e.code:c("error")}async save(e){const t=this.view;if(!(!t||this.busy)){this.view={...t,...e},this.busy=!0,this.error="";try{this.view=await C().save({...e,revision:t.revision}),this.dispatchEvent(new CustomEvent("notify-saved",{bubbles:!0,composed:!0,detail:{text:c("saved")}}))}catch(s){this.error=this.errText(s),await this.load()}finally{this.busy=!1}}}async test(){this.busy=!0,this.result=null;try{const e=await C().test();this.result={ok:e.ok,text:e.ok?c("testOk"):`${c("testFail")} · ${e.code??e.outcome}`}}catch(e){this.result={ok:!1,text:this.errText(e)}}finally{this.busy=!1}}stateTag(e){const t=e.account;if(!t.mapped)return r`<span class="tag bad" data-wa-account-state="none">${c("accountNone")}</span>`;const s=t.state??"unknown";return r`<span class="tag ${s==="connected"?"ok":s==="unknown"?"":"bad"}" data-wa-account-state=${s}>${c(`st_${s}`)}</span>`}render(){const e=N()==="he"||N()==="ar"?"rtl":"ltr";if(this.phase==="loading")return r`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="loading" aria-busy="true" dir=${e}><span class="skl"></span><span class="skl"></span></section>`;if(this.phase==="error"||!this.view)return r`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="error" dir=${e}><div class="warn" role="alert">${l("warning")}${c("error")}</div><div><button type="button" class="btn sm" data-wa-retry @click=${()=>void this.load()}>${l("refresh")}${c("retry")}</button></div></section>`;const t=this.view,s=y.tone(t),a=!t.enabled,i=y.warning(t);return r`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="ready" data-wa-enabled=${String(t.enabled)} dir=${e}>
      <header><h2>${l("chat")}${c("title")}</h2><div class="sp"><button type="button" class="tog" role="switch" aria-checked=${String(t.enabled)} aria-label=${c("enabled")} data-wa-switch ?disabled=${this.busy} @click=${()=>void this.save({enabled:!t.enabled})}></button></div></header>
      <p class="sub">${c("sub")}</p>
      <div class="frow"><div class="l"><b>${c("enabled")}</b><small>${c("enabledHint")}</small></div><div class="r"><span class="tag ${s==="ok"?"ok":s==="bad"?"bad":""}" data-wa-tone=${s}>${l(s==="ok"?"check":s==="bad"?"warning":"moon")}${c(s==="ok"?"on":s==="bad"?"attention":"off")}</span></div></div>
      ${i?r`<div class="warn" role="alert" data-wa-warning=${i}>${l("warning")}${c("warnOffAccount")}</div>`:b}
      ${t.warnings?.includes("messaging_key_unreadable")?r`<div class="warn" role="alert" data-wa-key-warning>${l("warning")}${c("keyUnreadable")}</div>`:b}
      ${t.normalized?.length?r`<div class="warn" role="status" data-wa-normalized=${t.normalized.join(",")}>${l("warning")}${c("normalized")}</div>`:b}
      <div class="frow"><div class="l"><b>${c("account")}</b>${t.account.mapped&&t.account.label?r`<small data-wa-account-label>${t.account.label}</small>`:b}</div><div class="r">${this.stateTag(t)}<a class="lnk" href=${t.accounts_href} data-wa-accounts-link>${c("accountPick")}</a></div></div>
      <div class="frow"><div class="l"><b>${c("reach")}</b><small>${c("reachHint")}</small></div><div class="r"><span class="tag" data-wa-reach><span class="n">${t.reachable_users}</span></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${c("cap")}</b><small>${c("capHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-cap-step="-1" aria-label=${c("less")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:y.stepCap(t,-1)})}>${l("minus")}</button><span class="vv" data-wa-cap><span class="n">${t.per_user_hour}</span></span><button type="button" data-wa-cap-step="1" aria-label=${c("more")} ?disabled=${this.busy} @click=${()=>void this.save({per_user_hour:y.stepCap(t,1)})}>${l("plus")}</button></span></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${c("dedupe")}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${c("dedupe")}>${wt.map(n=>r`<button type="button" aria-pressed=${String(t.dedupe_min===n)} data-wa-dedupe=${n} ?disabled=${this.busy} @click=${()=>void this.save({dedupe_min:n})}><span class="n">${n}</span> ${c("minutes")}</button>`)}</div></div></div>
      <div class="frow ${a?"dis":""}"><div class="l"><b>${c("detail")}</b><small>${c("detailHint")}</small></div><div class="r"><div class="seg sm" role="group" aria-label=${c("detail")}>${t.detail_levels.map(n=>r`<button type="button" aria-pressed=${String(t.detail===n)} data-wa-detail=${n} ?disabled=${this.busy} @click=${()=>void this.save({detail:n})}>${c(`detail_${n}`)}</button>`)}</div></div></div>
      ${["budget_pct","budget_critical_pct"].map(n=>r`<div class="frow ${a?"dis":""}"><div class="l"><b>${c(n==="budget_pct"?"budget":"budgetCritical")}</b><small>${c(n==="budget_pct"?"budgetHint":"budgetCriticalHint")}</small></div><div class="r"><span class="stp"><button type="button" data-wa-budget-step=${`${n}:-10`} aria-label=${c("less")} ?disabled=${this.busy} @click=${()=>void this.save(y.stepPct(t,n,-10))}>${l("minus")}</button><span class="vv" data-wa-budget=${n}><span class="n">${t[n]}</span><small>%</small></span><button type="button" data-wa-budget-step=${`${n}:10`} aria-label=${c("more")} ?disabled=${this.busy} @click=${()=>void this.save(y.stepPct(t,n,10))}>${l("plus")}</button></span></div></div>`)}
      <div class="frow"><div class="l"><b>${c("test")}</b><small data-wa-test-hint>${t.test.own_number?c("testHint",{masked:`⁦${t.test.masked??""}⁩`}):c("testNoNumber")}</small></div><div class="r">${this.result?r`<span class="tag ${this.result.ok?"ok":"bad"}" data-wa-test-result=${this.result.ok?"ok":"bad"}>${l(this.result.ok?"check":"warning")}${this.result.text}</span>`:b}<button type="button" class="btn quiet" data-wa-test ?disabled=${this.busy||!y.canTest(t)} @click=${()=>void this.test()}>${l(this.busy?"refresh":"send")}${this.busy?c("testing"):c("test")}</button></div></div>
      ${this.error?r`<div class="warn" role="alert" data-wa-error>${this.error}</div>`:b}
    </section>`}};_.styles=[G,X,Z,M`
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
    `];A([ue({attribute:"section-id"})],_.prototype,"sectionId",2);A([d()],_.prototype,"view",2);A([d()],_.prototype,"phase",2);A([d()],_.prototype,"busy",2);A([d()],_.prototype,"result",2);A([d()],_.prototype,"error",2);_=A([U("notify-whatsapp-section")],_);var $t=Object.defineProperty,xt=Object.getOwnPropertyDescriptor,B=(e,t,s,a)=>{for(var i=a>1?void 0:a?xt(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&$t(t,s,i),i};let q=class extends I{constructor(){super(...arguments),this.mine=null,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}reload(){this.load()}async load(){try{this.mine=await C().mine()}catch{this.mine=null}}async set(e){this.busy=!0,this.error="";try{this.mine=await C().setOptIn(e,e?this.mine?.confirm??null:null)}catch(t){this.error=t instanceof L?t.body.user_message||t.code:c("error"),t instanceof L&&t.code==="number_changed"&&this.load()}finally{this.busy=!1}}render(){const e=y.mineState(this.mine);if(e==="hidden")return b;const t=this.mine,s=N()==="he"||N()==="ar"?"rtl":"ltr",a=e==="on"?r`<span class="tag ok" data-wa-mine-status="on">${l("check")}${c("mine_on")}</span>`:e==="changed"?r`<span class="tag bad" data-wa-mine-status="changed">${l("warning")}${c("mine_changed")}</span>`:e==="declined"?r`<span class="tag" data-wa-mine-status="declined">${c("mine_declined")}</span>`:e==="none"?r`<span class="tag" data-wa-mine-status="none">${c("mine_none")}</span>`:r`<span class="tag" data-wa-mine-status="off">${c("mine_off")}</span>`;return r`<div class="box" data-wa-mine data-wa-mine-state=${e} dir=${s}>
      <h3>${l("chat")}${c("mine_title")}</h3>
      <p class="sub">${c("mine_sub")}</p>
      ${t.has_number?r`<div class="row"><b>${c("mine_number")}</b><span class="n" data-wa-mine-number>${t.masked}</span><small>${c(t.source==="profile"?"mine_src_profile":"mine_src_directory")}</small></div>`:b}
      <div class="row"><b>${c("mine_status")}</b>${a}</div>
      ${e==="off"||e==="changed"?r`<div class="acts"><button type="button" class="btn primary sm" data-wa-mine-confirm ?disabled=${this.busy} @click=${()=>void this.set(!0)}>${l("check")}${c("mine_confirm")}</button></div>`:b}
      ${y.canStop(t)?r`<div class="acts"><button type="button" class="btn quiet sm" data-wa-mine-stop ?disabled=${this.busy} @click=${()=>void this.set(!1)}>${c("mine_stop")}</button></div>`:b}
      ${this.error?r`<div class="warn" role="alert" data-wa-mine-error>${this.error}</div>`:b}
    </div>`}};q.styles=[G,X,Z,M`
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
    `];B([d()],q.prototype,"mine",2);B([d()],q.prototype,"busy",2);B([d()],q.prototype,"error",2);q=B([U("notify-whatsapp-mine")],q);const yt=["push","all"],E={enabled:"quiet.windows.enabled",default_minutes:"quiet.windows.default_minutes",max_minutes:"quiet.windows.max_minutes",mute_alerts:"quiet.windows.mute_alerts",channels:"quiet.windows.channels"},$=[5,720],W={enabled:!1,default_minutes:120,max_minutes:240,mute_alerts:!1,channels:"push"},ce=(e,t)=>{const s=typeof e=="string"&&/^\d+$/.test(e)?Number(e):NaN;return Number.isInteger(s)&&s>=$[0]&&s<=$[1]?s:t};function de(e){const t=e??{};return{enabled:t[E.enabled]==="on",default_minutes:ce(t[E.default_minutes],W.default_minutes),max_minutes:ce(t[E.max_minutes],W.max_minutes),mute_alerts:t[E.mute_alerts]==="on",channels:t[E.channels]==="all"?"all":"push"}}const Y=(e,t)=>{const s=t[e];return typeof s=="boolean"?s?"on":"off":String(s)};function pe(e,t){const s={};for(const a of Object.keys(E))Y(a,e)!==Y(a,t)&&(s[E[a]]=Y(a,t));return s}function Q(e){const t=s=>Number.isInteger(s)&&s>=$[0]&&s<=$[1];return!t(e.default_minutes)||!t(e.max_minutes)?"range":e.default_minutes>e.max_minutes?"default_over_max":null}const _t=(e,t)=>e.enabled&&!t.enabled,kt=()=>V("quiet/settings"),zt=e=>H("quiet/settings",{changes:e,confirmed:!0}),me={title:"חלון שקט לקומה או לאזור",sub:"כפתור אחד בכותרת הקומה או האזור משהה התראות מידע לזמן קצוב. התראות קריטיות ובטיחות לא מושהות לעולם.",enabled:"חלון שקט",enabledHint:"כבוי כברירת מחדל. כיבוי מסיים מיד כל חלון פתוח.",off:"כבוי",on:"פעיל",defaultMinutes:"משך ברירת מחדל (דקות)",maxMinutes:"משך מרבי (דקות)",minutesHint:"בין {lo} ל־{hi} דקות",muteAlerts:"להשהות גם התראות חשובות",muteAlertsHint:"כבוי: רק התראות מידע מושהות",channels:"ערוצים שהחלון משהה",channelsHint:'פוש בלבד: הדחיפה לטלפון ולדפדפן מושהית; דוא"ל, WhatsApp והכרזות נשלחים כרגיל. מרכז ההתראות שומר הכל בכל מקרה.',ch_push:"פוש בלבד",ch_all:"כל הערוצים",save:"שמור",saved:"ההגדרות נשמרו",readOnly:"שינוי ההגדרות דורש הרשאת מנהל מערכת.",demo:"נתוני הדגמה: ההגדרות נשמרות רק מול השרת.",errRange:"משך בין {lo} ל־{hi} דקות",errOverMax:"משך ברירת המחדל גדול מהמשך המרבי",confirmTitle:"לשמור את הגדרות חלון השקט?",confirmBody:"השינוי חל מיד על כל הקומות והאזורים.",confirmEnds:"כיבוי החלון מסיים עכשיו כל חלון שקט פתוח.",confirmGo:"שמור",cancel:"ביטול",loadError:"הגדרות חלון השקט לא נטענו"},St={title:"Quiet window for a floor or an area",sub:"One button on the floor or area header holds informational notifications for a while. Critical and safety notifications are never held.",enabled:"Quiet window",enabledHint:"Off by default. Switching it off ends every open window at once.",off:"Off",on:"On",defaultMinutes:"Default length (minutes)",maxMinutes:"Longest length (minutes)",minutesHint:"{lo} to {hi} minutes",muteAlerts:"Also hold important notifications",muteAlertsHint:"Off: only informational notifications are held",channels:"Channels the window holds",channelsHint:"Push only: the push to the phone and the browser is held; email, WhatsApp and announcements are sent as usual. The notification centre keeps everything either way.",ch_push:"Push only",ch_all:"All channels",save:"Save",saved:"Settings saved",readOnly:"Changing these settings needs a system administrator.",demo:"Demo data: the settings are saved against a server only.",errRange:"A length from {lo} to {hi} minutes",errOverMax:"The default length is longer than the longest length",confirmTitle:"Save the quiet window settings?",confirmBody:"The change applies at once to every floor and area.",confirmEnds:"Switching it off ends every open quiet window now.",confirmGo:"Save",cancel:"Cancel",loadError:"The quiet window settings could not be loaded"},Et={he:me,en:St};function Ct(){return(typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}function p(e,t,s=Ct()){const a=Et[s][e]??me[e]??e;return t?a.replace(/\{(\w+)\}/g,(i,n)=>n in t?String(t[n]):i):a}var At=Object.defineProperty,Ot=Object.getOwnPropertyDescriptor,z=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ot(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&At(t,s,i),i};let x=class extends I{constructor(){super(...arguments),this.saved=W,this.draft=W,this.loaded=!1,this.busy=!1,this.asking=!1,this.message="",this.error=""}connectedCallback(){if(super.connectedCallback(),!k()){this.loaded=!0;return}kt().then(e=>this.adopt(de(e.settings))).catch(e=>{this.loaded=!0,this.error=`${p("loadError")}: ${J(e)}`})}adopt(e){this.saved=e,this.draft={...e},this.loaded=!0}get editable(){return k()&&he("system.configure")&&this.loaded}set(e){this.draft={...this.draft,...e},this.message="",this.error=""}problemText(){const e=Q(this.draft);return e==="range"?p("errRange",{lo:$[0],hi:$[1]}):e==="default_over_max"?p("errOverMax"):""}async save(){this.asking=!1;const e=pe(this.saved,this.draft);if(!(!Object.keys(e).length||Q(this.draft))){this.busy=!0,this.error="";try{const t=await zt(e);this.adopt(de(t.settings)),this.message=p("saved")}catch(t){this.error=J(t)}finally{this.busy=!1}}}seg(e,t,s,a,i){const n=this.draft[e];return r`<div class="seg" role="group" aria-label=${a} data-qw-seg=${e}>${t.map(o=>r`<button type="button" data-v=${String(o)} aria-pressed=${String(n===o)} ?disabled=${i}
      @click=${()=>this.set({[e]:o})}>${s(o)}</button>`)}</div>`}minutes(e,t){return r`<sw-field class="ctl"><input type="number" inputmode="numeric" min=${$[0]} max=${$[1]} step="5" data-ltr data-qw-minutes=${e}
      aria-invalid=${String(!!Q(this.draft))} .value=${String(this.draft[e])} ?disabled=${t}
      @change=${s=>this.set({[e]:Number(s.target.value)})} /></sw-field>`}render(){const e=!this.editable||this.busy,t=this.draft,s=o=>p(o?"on":"off"),a=Object.keys(pe(this.saved,t)).length>0,i=this.problemText(),n=p("minutesHint",{lo:$[0],hi:$[1]});return r`<div class="card" data-quiet-windows-card>
      <p class="sub">${p("sub")}</p>
      <div class="set-col">
        <div class="row" data-qw-row="enabled"><span class="lbl">${p("enabled")}<span class="muted">${p("enabledHint")}</span></span>${this.seg("enabled",[!1,!0],s,p("enabled"),e)}</div>
        <div class="row" data-qw-row="default"><span class="lbl">${p("defaultMinutes")}<span class="muted">${n}</span></span>${this.minutes("default_minutes",e)}</div>
        <div class="row" data-qw-row="max"><span class="lbl">${p("maxMinutes")}<span class="muted">${n}</span></span>${this.minutes("max_minutes",e)}</div>
        <div class="row" data-qw-row="mute-alerts"><span class="lbl">${p("muteAlerts")}<span class="muted">${p("muteAlertsHint")}</span></span>${this.seg("mute_alerts",[!1,!0],s,p("muteAlerts"),e)}</div>
        <div class="row" data-qw-row="channels"><span class="lbl">${p("channels")}<span class="muted">${p("channelsHint")}</span></span>${this.seg("channels",yt,o=>p(o==="all"?"ch_all":"ch_push"),p("channels"),e)}</div>
      </div>
      ${i?r`<div class="err" role="alert" data-qw-problem>${i}</div>`:b}
      ${this.editable?r`<div class="foot sticky" data-qw-foot>
            <sw-button variant="primary" size="sm" icon="check" data-qw-save ?disabled=${!a||!!i||this.busy} @click=${()=>this.asking=!0}>${p("save")}</sw-button>
            ${this.message?r`<span class="ok" role="status" data-qw-message>${this.message}</span>`:b}
            ${this.error?r`<span class="err" role="alert" data-qw-error>${this.error}</span>`:b}
          </div>`:r`<div class="muted" data-qw-readonly>${this.error||p(k()?"readOnly":"demo")}</div>`}
      <sw-dialog ?open=${this.asking} heading=${p("confirmTitle")} @close=${()=>this.asking=!1} data-qw-confirm>
        <p>${p("confirmBody")}</p>
        ${_t(this.saved,t)?r`<p class="err" data-qw-confirm-ends>${p("confirmEnds")}</p>`:b}
        <sw-button slot="footer" @click=${()=>this.asking=!1}>${p("cancel")}</sw-button>
        <sw-button slot="footer" variant="primary" data-qw-confirm-go @click=${()=>void this.save()}>${p("confirmGo")}</sw-button>
      </sw-dialog>
    </div>`}};x.styles=[ge,M`
    :host { display: block; }
    .card { display: grid; gap: 0; }
    .sub { margin: 0 0 10px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .ctl input { inline-size: 100%; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
  `];z([d()],x.prototype,"saved",2);z([d()],x.prototype,"draft",2);z([d()],x.prototype,"loaded",2);z([d()],x.prototype,"busy",2);z([d()],x.prototype,"asking",2);z([d()],x.prototype,"message",2);z([d()],x.prototype,"error",2);x=z([U("system-quiet-windows")],x);var qt=Object.defineProperty,Tt=Object.getOwnPropertyDescriptor,h=(e,t,s,a)=>{for(var i=a>1?void 0:a?Tt(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&qt(t,s,i),i};const w=[{id:"sources",label:"מקורות והרשאות – מה נשלח",icon:"list"},{id:"quiet",label:"שעות שקט ומה עובר",icon:"moon"},{id:"esc",label:"הסלמה",icon:"escal"},{id:"lock",label:"פרטיות מסך נעול",icon:"lock"},{id:"keep",label:"שמירה",icon:"calendar"},{id:"mail",label:"דואר יוצא",icon:"mail"},{id:"wa",label:"וואטסאפ",icon:"chat"},{id:"chan",label:"ערוצים",icon:"phone"},{id:"log",label:"יומן מסירה וכשלים",icon:"inbox"}],Nt=[{id:"u-yoni",name:"יוני"},{id:"u-dana",name:"דנה"},{id:"u-uri",name:"אורי"},{id:"u-roni",name:"רוני"}],K=["scope","managers","initiator","users"],Pt={sent:"check",failed:"warning",gone:"warning",skipped:"moon",queued:"clock",retry:"refresh"},Rt={sent:"ok",failed:"bad",gone:"bad",skipped:"skp",queued:"skp",retry:"skp"},Ht=()=>"14 יום",Lt=e=>({linkBase:e.email.link_base??"",host:e.email.host,port:String(e.email.port),security:e.email.security,user:e.email.user,password:"",pwEdit:!e.email.password_set,from:e.email.from,recipients:e.email.recipients.join(", ")});let u=class extends I{constructor(){super(...arguments),this.bubbleSkin=new we(this),this.section="",this.phase="loading",this.error="",this.settings=null,this.policies=[],this.stats=null,this.log=[],this.titles={},this.users=null,this.devices=0,this.wa=null,this.onlyFailed=!1,this.sec="sources",this.phone=window.matchMedia("(max-width: 1099px)").matches,this.toast=null,this.invalid=null,this.mail={linkBase:"",host:"",port:"587",security:"starttls",user:"",password:"",pwEdit:!0,from:"",recipients:""},this.mailBusy=null,this.mailResult=null,this.mailError="",this.picker=null,this.now=Date.now(),this.clockOffset=0,this.offClock=null,this.tz=void 0,this.rev=1,this.chain=Promise.resolve(),this.toastTimer=0,this.phoneMq=window.matchMedia("(max-width: 1099px)"),this.obs=null,this.onMq=()=>this.phone=this.phoneMq.matches,this.nameOf=e=>{if(e==="managers")return"מנהלי התראות";const t=e.map(s=>this.users?.find(a=>a.id===s)?.name??s);return t.length?t.join(", "):"משתמשים נבחרים"}}connectedCallback(){super.connectedCallback(),$e(this),this.phoneMq.addEventListener("change",this.onMq),this.load(),this.offClock=xe(()=>this.now=Date.now()+this.clockOffset)}disconnectedCallback(){this.offClock?.(),this.offClock=null,this.phoneMq.removeEventListener("change",this.onMq),this.obs?.disconnect(),window.clearTimeout(this.toastTimer),super.disconnectedCallback()}willUpdate(e){e.has("section")&&w.some(t=>t.id===this.section)&&(this.sec=this.section)}updated(e){e.has("phase")&&this.phase==="ready"&&!this.phone&&this.watchSections()}async load(){this.phase="loading",this.error="";try{if(await ye.prepare(),k()&&!he("notify.manage")){this.phase="user";return}const e=O();let t;try{t=await e.settings()}catch(f){if(_e(f)==="forbidden"){this.phase="user";return}throw f}const[s,a,i,n,o,m,v,g]=await Promise.all([e.policies(),e.stats().catch(()=>null),e.adminDeliveries({limit:200}).catch(()=>[]),e.list({limit:100}).catch(()=>null),this.loadUsers(),this.countDevices(),this.clockAndZone(),C().view().catch(()=>null)]);this.wa=g,this.settings=t,this.rev=t.revision,this.policies=s,this.stats=a,this.log=i,this.titles=Object.fromEntries((n?.notifications??[]).map(f=>[f.id,f.title])),this.users=o,this.devices=m,this.now=v.now,this.clockOffset=v.now-Date.now(),this.tz=v.tz,this.mail=Lt(t),this.mailResult=null,this.phase="ready"}catch(e){this.error=T(e),this.phase="error"}}async clockAndZone(){if(k()){const t=await ke().catch(()=>({}));return{now:Date.now(),tz:typeof t["time.zone"]=="string"?t["time.zone"]:void 0}}const e=await D(()=>import("./notifications-mock-an4W6BTJ.js"),__vite__mapDeps([0]),import.meta.url);return{now:e.notifyMock().clock,tz:e.MOCK_TZ}}async loadUsers(){if(!k())return Nt;try{const{listUsers:e}=await D(async()=>{const{listUsers:t}=await import("./access-CHph_VoE.js");return{listUsers:t}},__vite__mapDeps([0]),import.meta.url);return(await e()).users.filter(t=>t.active).map(t=>({id:t.id,name:t.name||t.username}))}catch{return null}}async countDevices(){if(!k())return(await D(async()=>{const{notifyMock:e}=await import("./notifications-mock-an4W6BTJ.js");return{notifyMock:e}},__vite__mapDeps([0]),import.meta.url)).notifyMock().registered;try{return(await ze()).subscriptions.length}catch{return 0}}watchSections(){this.obs?.disconnect(),"IntersectionObserver"in window&&(this.obs=new IntersectionObserver(e=>{const s=e.filter(a=>a.isIntersecting).sort((a,i)=>a.boundingClientRect.top-i.boundingClientRect.top)[0]?.target?.dataset.setSection;s&&(this.sec=s)},{root:this,rootMargin:"-80px 0px -65% 0px"}),this.renderRoot.querySelectorAll("[data-set-section]").forEach(e=>this.obs?.observe(e)))}say(e,t=!1){this.toast={text:e,bad:t},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,3e3)}enqueue(e){this.chain=this.chain.then(e).catch(()=>{})}async conflict(e){this.say(T(e),!0),await this.load()}patchSettings(e){if(!this.settings)return;this.settings={...this.settings,...e};const t=Se(ee(this.settings));this.invalid=t,!t&&this.enqueue(async()=>{if(this.settings)try{const s=await O().saveSettings(ee(this.settings),this.rev);this.rev=s.revision,this.say("נשמר")}catch(s){await this.conflict(s)}})}patchPolicy(e,t){const s=this.policies.find(i=>i.source===e);if(!s)return;let a;try{a=t(s)}catch(i){this.say(T(i),!0);return}this.policies=this.policies.map(i=>i.source===e?a:i),this.enqueue(async()=>{const i=this.policies.find(n=>n.source===e);if(i)try{const n=await O().savePolicy(e,Ee(i),i.revision);this.policies=this.policies.map(o=>o.source===e?{...o,revision:n.revision}:o),this.say("נשמר")}catch(n){await this.conflict(n)}})}setSec(e){this.sec=e,this.phone||this.renderRoot.querySelector(`[data-set-section="${e}"]`)?.scrollIntoView({behavior:"smooth",block:"start"})}mailBody(){const e=this.mail,t={host:e.host.trim(),port:Number(e.port),security:e.security,user:e.user.trim(),from:e.from.trim(),recipients:Ce(e.recipients),link_base:e.linkBase.trim()};return e.pwEdit&&e.password&&(t.password=e.password),Ae(t)?null:t}async saveMail(){const e=this.mailBody();if(!e){this.mailError=F.email_invalid;return}this.mailError="",this.mailBusy="save";try{const t=await O().saveEmail(e);this.settings&&(this.settings={...this.settings,email:t}),this.mailResult=null,this.mail={...this.mail,password:"",pwEdit:!t.password_set},this.say("הגדרות הדואר נשמרו")}catch(t){this.mailError=T(t)}finally{this.mailBusy=null}}async testMail(){this.mailBusy="test",this.mailError="";try{this.mailResult=await O().testEmail();const e=await O().settings().catch(()=>null);e&&this.settings&&(this.settings={...this.settings,email:e.email})}catch(e){this.mailResult=null,this.mailError=T(e)}finally{this.mailBusy=null}}openPicker(e){const t=e==="esc"?Array.isArray(this.settings?.escalation.to)?this.settings?.escalation.to:[]:this.policies.find(s=>s.source===e)?.recipients.user_ids??[];this.picker={target:e,selected:[...t]}}savePicker(){const e=this.picker;if(!(!e||!e.selected.length)){if(e.target==="esc")this.patchSettings({escalation:{...this.settings.escalation,to:e.selected}});else{const t=e.selected;this.patchPolicy(e.target,s=>({...s,recipients:{rule:"users",user_ids:t}}))}this.picker=null}}sevSeg(e,t){return r`<span class="sevseg" role="radiogroup" aria-label="חומרה">${te.slice().reverse().map(s=>r`<button type="button" role="radio" aria-checked=${String(t===s)} aria-pressed=${String(t===s)} data-pol-sev=${`${e}:${s}`} style=${`--sev:var(--nt-sev-${s})`} title=${P[s]} @click=${()=>this.patchPolicy(e,a=>Oe(a,s))}><i aria-hidden="true"></i>${P[s]}</button>`)}</span>`}whoSel(e){const t=qe.includes(e.source),s=this.settings?Te(e,this.settings):e.recipients.rule,a=t?s:e.recipients.rule;return r`<select class="inp sm" data-pol-who=${e.source} aria-label="מי מקבל" ?disabled=${t} @change=${i=>{const n=i.target.value;n==="users"?(this.openPicker(e.source),i.target.value=a):this.patchPolicy(e.source,o=>Ne(o,n))}}>${(K.includes(a)?K:[...K,a]).map(i=>r`<option value=${i} .selected=${a===i}>${i==="users"&&e.recipients.rule==="users"?`${se.users} (${e.recipients.user_ids?.length??0})`:se[i]}</option>`)}</select>`}chans(e){const t=this.settings,s=R(e,"webpush",t),a=R(e,"email",t),i=R(e,"app",t),n=R(e,"whatsapp",t,this.wa),o={email:'הדוא"ל לא מוגדר',whatsapp:"וואטסאפ כבוי"},m=(v,g,f)=>r`<button type="button" class=${re({chip:!0,unconf:g.note==="unconfigured"})} aria-pressed=${String(g.on)} data-pol-ch=${`${e.source}:${v}`} title=${g.note==="unconfigured"?o[v]??"":""} @click=${()=>this.patchPolicy(e.source,ve=>at(ve,v,!g.on))}>${l(f)}${S[v]}</button>`;return r`<span class="chs"><span class="chip lock" title="תמיד">${l("inbox")}${S.inbox}</span>${m("webpush",s,"phone")}${m("email",a,"mail")}${m("app",i,"phone")}${m("whatsapp",n,"chat")}<span class="chip soon" aria-disabled="true" title="Companion – בקרוב" aria-label="Companion – בקרוב">${l("phone")}</span></span>`}tog(e,t,s,a,i=!1){return r`<button type="button" class="tog" role="switch" aria-checked=${String(e)} aria-label=${s} ?disabled=${i} data-tog=${t} @click=${a}></button>`}polToggle(e){return r`<button type="button" class="tog" role="switch" aria-checked=${String(e.enabled)} aria-label="פעיל" data-pol-on=${e.source} @click=${()=>this.patchPolicy(e.source,t=>({...t,enabled:!t.enabled}))}></button>`}renderSources(){const e=Pe("nvr")?this.policies:this.policies.filter(o=>!Re(o.source)),t=He(e,[...le,...it,...nt,...rt,...ot]),s=e.length,a=o=>o==="rule.alert"||le.find(m=>m.key===o)?.rulesOnly===!0,i=this.settings;let n;return this.phone?n=r`<div class="scards">${t.flatMap(o=>o.rows).map(({info:o,policy:m})=>r`<section class="glass scard ${m.enabled?"":"off"}" data-pol-row=${m.source}>
        <div class="top"><span class="nm"><span class="ring">${l(o.icon)}</span></span><b>${o.label}</b>${this.polToggle(m)}</div>
        <div class="ln"><small>חומרה</small>${a(m.source)?r`<span class="tag">לפי החוק</span>`:this.sevSeg(m.source,m.severity)}</div>
        <div class="ln"><small>מי מקבל</small>${this.whoSel(m)}</div>
        <div class="ln"><small>ערוצים</small>${this.chans(m)}</div></section>`)}</div>`:n=r`<div class="mxw"><table class="mx"><colgroup><col style="width:20%"><col style="width:7%"><col style="width:24%"><col style="width:18%"><col></colgroup>
        <thead><tr><th>מקור</th><th class="c">פעיל</th><th>חומרה</th><th>מי מקבל</th><th>ערוצים</th></tr></thead>
        <tbody>${t.map(o=>r`<tr class="cat"><td colspan="5">${l(o.icon)}${o.label}</td></tr>${o.rows.map(({info:m,policy:v})=>r`<tr class=${v.enabled?"":"off"} data-pol-row=${v.source}>
          <td class="keep"><span class="nm"><span class="ring">${l(m.icon)}</span><b>${m.label}</b></span></td>
          <td class="c keep">${this.polToggle(v)}</td>
          <td>${a(v.source)?r`<span class="tag">לפי החוק</span>`:this.sevSeg(v.source,v.severity)}</td>
          <td>${this.whoSel(v)}</td><td>${this.chans(v)}</td></tr>`)}`)}</tbody></table></div>`,r`<section class="glass sec" data-set-section="sources" id="sec-sources"><header><h2>${l("list")}${w[0].label}</h2><div class="sp"><span class="tag soon">${l("phone")}Companion – בקרוב</span><span class="tag" data-pol-count>${Le(this.policies)} מתוך ${s} פעילים</span></div></header>
      <div class="frow"><div class="l"><b>כשל בתזמון או באוטומציה מגיע אל</b></div><div class="r"><div class="seg sm" role="group" aria-label="כשל בתזמון או באוטומציה">${We.map(o=>r`<button type="button" aria-pressed=${String(i.failures_audience===o)} data-failures-audience=${o} @click=${()=>this.patchSettings({failures_audience:o})}>${o==="admins"?"מנהלים":"כל מי שרואה"}</button>`)}</div></div></div>
      ${n}</section>`}renderQuiet(){const e=this.settings,t=e.quiet,s=!t.enabled;return r`<section class="glass sec" data-set-section="quiet" id="sec-quiet"><header><h2>${l("moon")}${w[1].label}</h2><div class="sp">${this.tog(t.enabled,"quiet-on","שעות שקט",()=>this.patchSettings({quiet:{...t,enabled:!t.enabled}}))}</div></header>
      <div class="frow ${s?"dis":""}"><div class="l"><b>שעות</b></div><div class="r"><input class="inp sm ltr" type="time" lang=${ae()} data-quiet-from aria-label="מהשעה" style="inline-size:112px" .value=${t.from} ?disabled=${s} @change=${a=>this.setTime("from",a.target.value)} /><span>עד</span><input class="inp sm ltr" type="time" lang=${ae()} data-quiet-to aria-label="עד השעה" style="inline-size:112px" .value=${t.to} ?disabled=${s} @change=${a=>this.setTime("to",a.target.value)} /></div></div>
      ${this.invalid==="quiet_invalid"?r`<div class="errline" data-set-error>${F.quiet_invalid}</div>`:b}
      <div class="frow ${s?"dis":""}"><div class="l"><b>ימים</b></div><div class="r"><div class="days" role="group" aria-label="ימים">${Me.map(a=>r`<button type="button" aria-pressed=${String(t.days.includes(a))} data-quiet-day=${a} ?disabled=${s} @click=${()=>this.patchSettings({quiet:{...t,days:Ue(t.days,a)}})}>${Ie[a]}</button>`)}</div></div></div>
      <div class="frow ${s?"dis":""}" style="align-items:flex-start"><div class="l"><b>מה עובר בשעות שקט</b></div></div>
      <table class="qmx ${s?"dis":""}"><thead><tr><th>חומרה</th><th>${S.webpush}</th><th>${S.email}</th><th>${S.whatsapp}</th><th>Companion</th></tr></thead><tbody>${te.slice().reverse().map(a=>r`<tr><td><span class="sv" style=${`--sev:var(--nt-sev-${a})`}><i></i>${P[a]}</span></td>
        ${["webpush","email","whatsapp"].map(i=>r`<td><button type="button" class="chk" role="checkbox" aria-checked=${String(e.pass_through[a][i]??!1)} aria-label=${`${P[a]} · ${S[i]}`} data-pass=${`${a}:${i}`} ?disabled=${s} @click=${()=>this.patchSettings({pass_through:Be(e.pass_through,a,i)})}>${l("check")}</button></td>`)}
        <td><button type="button" class="chk" role="checkbox" aria-checked=${String(e.pass_through[a].ha_mobile)} aria-label="Companion – בקרוב" disabled>${l("check")}</button></td></tr>`)}</tbody></table></section>
      <section class="glass sec" data-set-section="quiet-windows" id="sec-quiet-windows"><header><h2>${l("moon")}${p("title")}</h2></header><system-quiet-windows></system-quiet-windows></section>`}setTime(e,t){!this.settings||!Number.isFinite(De(t))||this.patchSettings({quiet:{...this.settings.quiet,[e]:t}})}renderEsc(){const t=this.settings.escalation,s=!t.enabled,a=t.to!=="managers",i=o=>this.patchSettings({escalation:{...t,...o}}),n=Fe(t,842,this.nameOf);return r`<section class="glass sec" data-set-section="esc" id="sec-esc"><header><h2>${l("escal")}${w[2].label}</h2><div class="sp">${this.tog(t.enabled,"esc-on","הסלמה",()=>i({enabled:!t.enabled}))}</div></header>
      <div class="frow ${s?"dis":""}"><div class="l"><b>אחרי</b><small>קריטי בלי אישור</small></div><div class="r"><span class="stp"><button type="button" data-esc-step="-1" aria-label="פחות" @click=${()=>this.patchSettings({escalation:ie(t,-1)})}>${l("minus")}</button><span class="vv" data-esc-min><span class="n">${t.after_min}</span><small>דק׳</small></span><button type="button" data-esc-step="1" aria-label="יותר" @click=${()=>this.patchSettings({escalation:ie(t,1)})}>${l("plus")}</button></span></div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>שלבים</b></div><div class="r"><div class="seg sm" role="group" aria-label="שלבים">${[1,2,3].map(o=>r`<button type="button" aria-pressed=${String(t.steps===o)} data-esc-steps=${o} @click=${()=>i({steps:o})}>${o}</button>`)}</div></div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>אל</b></div><div class="r"><div class="seg sm" role="group" aria-label="אל"><button type="button" aria-pressed=${String(!a)} data-esc-to="managers" @click=${()=>i({to:"managers"})}>מנהלי התראות</button><button type="button" aria-pressed=${String(a)} data-esc-to="users" @click=${()=>this.openPicker("esc")}>משתמשים נבחרים</button></div>${a?r`<span class="tag" data-esc-names>${this.nameOf(t.to)}</span>`:b}</div></div>
      <div class="frow ${s?"dis":""}"><div class="l"><b>נעצרת באישור</b></div><div class="r"><span class="tag ok">${l("lock")}תמיד</span></div></div>
      ${this.invalid==="escalation_invalid"?r`<div class="errline" data-set-error>${F.escalation_invalid}</div>`:b}
      <div class="escprev ${s?"dis":""}" data-esc-preview><div class="tl">${n.map(o=>r`<div class="ev ${o.kind}"><span class="t">${o.clock}</span><span class="d"><i></i></span><span class="b"><b>${o.title}</b><small>${o.sub}</small></span></div>`)}</div></div></section>`}lockPhone(e,t){const s=je(e,this.tz);return r`<div class=${re({lphone:!0,sel:t})} data-lock-phone=${e} data-lock-selected=${String(t)}><span class="notch"></span><span class="llabel">${l("lock")}${ne[e]}</span>
      <div class="ltime n">14:10</div><div class="ldate">יום רביעי, 1 באוקטובר</div>
      <div class="lcards">${(e==="generic"?s.slice(0,1):s).map(a=>r`<div class="pushcard" data-push-card><div class="ph"><span class="app">S</span>Arx<span class="ago">${a.ago}</span></div><b>${a.title}</b><p>${a.body}</p>
        <div class="acts">${a.actions.map(i=>r`<span class=${i.id==="open_door"?"door":""}>${l(i.id==="open"?"open":i.id==="ack"?"checkAll":i.id==="snooze"?"snooze":"doorOpen")}${i.label}</span>`)}</div></div>`)}</div></div>`}renderLock(){const e=this.settings;return r`<section class="glass sec" data-set-section="lock" id="sec-lock"><header><h2>${l("lock")}${w[3].label}</h2></header>
      <div class="frow"><div class="l"><b>רמת פירוט</b></div><div class="r"><div class="seg" role="group" aria-label="רמת פירוט">${Ye.map(t=>r`<button type="button" aria-pressed=${String(e.lockscreen===t)} data-lock-level=${t} @click=${()=>this.patchSettings({lockscreen:t})}>${ne[t]}</button>`)}</div></div></div>
      <div class="lockrow" data-lock-preview>${["generic","type_place","full"].map(t=>this.lockPhone(t,e.lockscreen===t))}</div>
      <div class="frow dis"><div class="l"><b>תמונה מהמצלמה בהתראה</b><small>התמונה נפתחת רק בתוך Arx</small></div><div class="r"><span class="tag soon">בקרוב</span>${this.tog(!1,"image-in-push","תמונה בהתראה",()=>{},!0)}</div></div>
      <div class="frow dis"><div class="l"><b>צליל קריטי שעוקף "נא לא להפריע"</b><small>בטיחות בלבד · טלפוני Companion</small></div><div class="r"><span class="tag soon">בקרוב</span>${this.tog(e.companion.critical_sound_safety,"critical-sound","צליל קריטי",()=>{},!0)}</div></div></section>`}renderKeep(){const e=this.settings;return r`<section class="glass sec" data-set-section="keep" id="sec-keep"><header><h2>${l("calendar")}${w[4].label}</h2></header>
      <div class="frow"><div class="l"><b>התראות</b></div><div class="r"><div class="seg sm" role="group" aria-label="שמירת התראות">${Qe.map(t=>r`<button type="button" aria-pressed=${String(e.retention_days===t)} data-keep=${t} @click=${()=>this.patchSettings({retention_days:t})}>${t}</button>`)}</div><span>ימים</span></div></div>
      <div class="frow"><div class="l"><b>יומן מסירה</b></div><div class="r"><span class="tag"><span class="n">${e.deliveries_retention_days}</span> ימים</span></div></div></section>`}renderMail(){const e=this.settings,t=this.mail,s=e.email,a=n=>this.mail={...this.mail,...n},i=this.mailResult?this.mailResult.ok?r`<span class="tag ok" data-mail-result="ok">${l("check")}${oe(this.mailResult)}</span>`:r`<span class="tag bad" data-mail-result="bad">${l("warning")}${oe(this.mailResult)}</span>`:s.last_test?r`<span class="tag ${s.last_test.ok?"ok":"bad"}" data-mail-last>${l(s.last_test.ok?"check":"warning")}${s.last_test.ok?`נבדק ${Ke(s.last_test.at,this.tz)} · תקין`:`הבדיקה נכשלה · ${s.last_test.detail}`}</span>`:r`<span class="tag" data-mail-last>${s.configured?"לא נבדק":"לא מוגדר"}</span>`;return r`<section class="glass sec" data-set-section="mail" id="sec-mail"><header><h2>${l("mail")}${w[5].label}</h2><div class="sp">${i}</div></header>
      <div class="fgrid">
        <label>שרת<input class="inp ltr" data-mail-host .value=${t.host} @input=${n=>a({host:n.target.value})} /></label>
        <label>פורט<input class="inp ltr" inputmode="numeric" data-mail-port .value=${t.port} @input=${n=>a({port:n.target.value})} /></label>
        <label>אבטחה<select class="inp" data-mail-security @change=${n=>a({security:n.target.value})}>${["starttls","tls","none"].map(n=>r`<option value=${n} .selected=${t.security===n}>${n==="none"?"ללא":n==="tls"?"TLS":"STARTTLS"}</option>`)}</select></label>
        <label>משתמש<input class="inp ltr" data-mail-user .value=${t.user} @input=${n=>a({user:n.target.value})} /></label>
        <label>סיסמה<span style="display:flex;gap:8px"><input class="inp ltr" type="password" autocomplete="new-password" data-mail-password style="flex:1" .value=${t.pwEdit?t.password:"••••••••••"} ?readonly=${!t.pwEdit} @input=${n=>a({password:n.target.value})} />${s.password_set&&!t.pwEdit?r`<button type="button" class="btn quiet sm" data-mail-pw-change @click=${()=>a({pwEdit:!0,password:""})}>החלפה</button>`:b}</span></label>
        <label>מאת<input class="inp ltr" data-mail-from .value=${t.from} @input=${n=>a({from:n.target.value})} /></label>
        <label class="w2">נמענים<input class="inp ltr" data-mail-recipients .value=${t.recipients} @input=${n=>a({recipients:n.target.value})} /></label>
        <label class="w2">כתובת Arx לקישור<input class="inp ltr" data-mail-linkbase placeholder="https://" .value=${t.linkBase} @input=${n=>a({linkBase:n.target.value})} /></label>
      </div>
      ${this.mailError?r`<div class="errline" data-mail-error role="alert">${this.mailError}</div>`:b}
      <div class="frow mailfoot"><button type="button" class="btn quiet" data-mail-test ?disabled=${this.mailBusy!==null||!s.configured} @click=${()=>void this.testMail()}>${l(this.mailBusy==="test"?"refresh":"send")}${this.mailBusy==="test"?"שולח…":"שליחת בדיקה"}</button><button type="button" class="btn primary" data-mail-save ?disabled=${this.mailBusy!==null} @click=${()=>void this.saveMail()}>שמירה</button></div></section>`}renderWa(){return r`<div data-set-section="wa" id="sec-wa"><notify-whatsapp-section section-id="wa-inner" @notify-saved=${e=>{this.say(e.detail.text),C().view().then(t=>this.wa=t).catch(()=>{}),this.renderRoot.querySelectorAll("notify-whatsapp-mine").forEach(t=>t.reload())}}></notify-whatsapp-section></div>`}renderChannels(){const e=this.settings,t=j("webpush",e,this.devices),s=j("email",e,this.devices),a=j("whatsapp",e,this.devices,this.wa?{enabled:this.wa.enabled,mapped:this.wa.account.mapped}:null),i=(n,o)=>r`<span class="tag ${n==="on"||n==="always"?"ok":n==="soon"?"soon":""}">${n==="on"||n==="always"?"פעיל":o}</span>`;return r`<section class="glass sec" data-set-section="chan" id="sec-chan"><header><h2>${l("phone")}${w[7].label}</h2></header>
      <div class="frow"><div class="l"><b>מרכז ההתראות במחשב</b></div><div class="r"><div class="seg sm" role="group" aria-label="מרכז ההתראות במחשב">${Ve.map(n=>r`<button type="button" aria-pressed=${String(e.center_layout===n)} data-layout=${n} @click=${()=>this.patchSettings({center_layout:n})}>${Ge[n]}</button>`)}</div></div></div>
      <div class="chgrid">
        <div class="chc" data-channel="inbox"><span class="ring">${l("inbox")}</span><b>מרכז ההתראות</b><small>פעיל תמיד · לכל המשתמשים</small>${i("always","")}</div>
        <div class="chc" data-channel="webpush"><span class="ring">${l("phone")}</span><b>דחיפה (Arx)</b><small>${t.state==="on"?`${this.devices} מכשירים רשומים אצלך`:t.text}</small>${i(t.state,t.text)}</div>
        <div class="chc" data-channel="email"><span class="ring">${l("mail")}</span><b>דוא"ל</b><small>${s.state==="on"?"תקלות מערכת וגיבויים":"לא מוגדר"}</small>${i(s.state,s.text)}</div>
        <div class="chc" data-channel="app"><span class="ring">${l("phone")}</span><b>אפליקציה לנייד</b><small>לפי המכשירים שנרשמו באפליקציה · שעות השקט כמו דחיפה</small>${i("on","")}</div>
        <div class="chc soon" data-channel="ha_mobile"><span class="ring">${l("phone")}</span><b>Companion</b><small>טלפונים לפי משתמש</small><span class="tag soon">בקרוב</span></div>
        <div class="chc" data-channel="whatsapp"><span class="ring">${l("chat")}</span><b>WhatsApp</b><small>${a.text}</small>${i(a.state,a.text)}</div>
      </div>
      <div class="devbox"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></div></section>`}renderLog(){const e=Xe(this.stats),t=Ze(this.log,this.onlyFailed),s=Je(this.log);return r`<section class="glass sec" data-set-section="log" id="sec-log"><header><h2>${l("inbox")}${w[8].label}</h2><div class="sp"><span class="tag" data-log-window>${Ht()}</span><div class="seg sm" role="group" aria-label="סינון היומן"><button type="button" aria-pressed=${String(!this.onlyFailed)} data-log-filter="all" @click=${()=>this.onlyFailed=!1}>הכל</button><button type="button" aria-pressed=${String(this.onlyFailed)} data-log-filter="failed" @click=${()=>this.onlyFailed=!0}>רק כשלים${s?r`<small class="n">${s}</small>`:b}</button></div></div></header>
      <div class="fails" data-fail-panel>${e.map(a=>r`<div class="fstat ${a.tone}" data-fail-card=${a.channel}><span class="ch">${a.label} · 24 שעות</span><b class="n">${a.failed>0?a.failed:a.sent}</b><small>${a.failed>0?"נכשלו":"נשלחו"}${a.skipped?` · ${a.skipped} לא נשלחו`:""}</small></div>`)}</div>
      <div class="lgw"><table class="lg"><thead><tr><th>שעה</th><th>התראה</th><th>משתמש</th><th>ערוץ</th><th>מצב</th><th>סיבה</th></tr></thead><tbody>${t.length?t.map(a=>r`<tr data-log-row=${a.id} data-log-status=${a.status}><td class="n" style="direction:rtl">${tt(a.at,this.now,this.tz)}</td><td>${this.titles[a.notification_id]??"—"}</td><td>${a.user_display}</td><td>${l(a.channel==="email"?"mail":a.channel==="whatsapp"?"chat":"phone")}${S[a.channel]}</td><td class=${Rt[a.status]}>${l(Pt[a.status])}${et[a.status]}</td><td>${st(a.reason)||"—"}</td></tr>`):r`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--dv-text-3)">אין רשומות</td></tr>`}</tbody></table></div></section>`}renderPicker(){const e=this.picker;if(!e)return b;const t=this.users;return r`<sw-dialog open heading="משתמשים נבחרים" data-user-picker @close=${()=>this.picker=null}>
      ${t&&t.length?r`<div class="pick" role="group">${t.map(s=>r`<button type="button" role="checkbox" aria-checked=${String(e.selected.includes(s.id))} data-pick=${s.id} @click=${()=>this.picker={...e,selected:e.selected.includes(s.id)?e.selected.filter(a=>a!==s.id):[...e.selected,s.id]}}><span class="chk" aria-hidden="true" data-on=${String(e.selected.includes(s.id))} style=${e.selected.includes(s.id)?"background:var(--dv-accent);border-color:transparent":""}>${l("check")}</span>${s.name}</button>`)}</div>`:r`<div class="errline">רשימת המשתמשים לא זמינה</div>`}
      <button slot="footer" type="button" class="btn quiet" @click=${()=>this.picker=null}>ביטול</button>
      <button slot="footer" type="button" class="btn primary" data-pick-save ?disabled=${!e.selected.length} @click=${()=>this.savePicker()}>שמירה</button>
    </sw-dialog>`}renderBody(){if(this.phase==="loading")return r`<div class="skbox" data-set-state="loading" aria-busy="true"><span class="skl"></span><span class="skl"></span><span class="skl"></span></div>`;if(this.phase==="error")return r`<div class="errbar" role="alert" data-set-state="error">${l("warning")}<span>${this.error||"לא ניתן לטעון את ההגדרות"}</span><button type="button" class="btn sm" data-set-retry @click=${()=>void this.load()}>${l("refresh")}נסה שוב</button></div>`;if(this.phase==="user")return r`<div class="secs" data-set-state="user"><section class="glass sec"><arx-notifications-settings devices-only embedded></arx-notifications-settings><notify-whatsapp-mine></notify-whatsapp-mine></section></div>`;const e={sources:()=>this.renderSources(),quiet:()=>this.renderQuiet(),esc:()=>this.renderEsc(),lock:()=>this.renderLock(),keep:()=>this.renderKeep(),mail:()=>this.renderMail(),wa:()=>this.renderWa(),chan:()=>this.renderChannels(),log:()=>this.renderLog()};return r`<div class="set" data-set-state="ready"><nav class="glass setnav" aria-label="מדורים">${w.map(t=>r`<button type="button" aria-current=${String(this.sec===t.id)} data-set-nav=${t.id} @click=${()=>this.setSec(t.id)}>${l(t.icon)}${t.label}</button>`)}</nav>
      <div class="secs">${this.phone?e[this.sec]():w.map(t=>e[t.id]())}</div></div>`}render(){return r`<div class="page" data-notify-settings data-phase=${this.phase}>
      <header class="dh flat"><div class="dh-row"><h1>התראות</h1><span class="crumb">${l("settings")}מערכת</span></div></header>
      ${this.renderBody()}
    </div>
    ${this.renderPicker()}
    ${this.toast?r`<div class="toast ${this.toast.bad?"bad":""}" role="status" data-set-toast>${l(this.toast.bad?"warning":"check")}${this.toast.text}</div>`:b}`}};u.styles=[lt,G,ct,X,Z,M`
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
    `];h([ue()],u.prototype,"section",2);h([d()],u.prototype,"phase",2);h([d()],u.prototype,"error",2);h([d()],u.prototype,"settings",2);h([d()],u.prototype,"policies",2);h([d()],u.prototype,"stats",2);h([d()],u.prototype,"log",2);h([d()],u.prototype,"titles",2);h([d()],u.prototype,"users",2);h([d()],u.prototype,"devices",2);h([d()],u.prototype,"wa",2);h([d()],u.prototype,"onlyFailed",2);h([d()],u.prototype,"sec",2);h([d()],u.prototype,"phone",2);h([d()],u.prototype,"toast",2);h([d()],u.prototype,"invalid",2);h([d()],u.prototype,"mail",2);h([d()],u.prototype,"mailBusy",2);h([d()],u.prototype,"mailResult",2);h([d()],u.prototype,"mailError",2);h([d()],u.prototype,"picker",2);h([d()],u.prototype,"now",2);h([d()],u.prototype,"tz",2);u=h([U("system-notifications")],u);export{u as SystemNotifications};
//# sourceMappingURL=system-notifications-cwfVi2L3.js.map
