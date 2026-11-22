import{bA as fe,tC as T,ax as g,j as p,i as N,tD as me,n as m,a as B,tE as we,tF as s,tG as ve,tH as $e,A as l,aI as ge,b as o,ej as D,k as A,cE as be,tI as ye,bH as _e,tJ as q,tK as C,c$ as te,g as ae,tL as se,tM as xe,tN as ke,tO as S,tP as _,tQ as re,tR as oe,tS as ie,tT as Ee,tU as W,tV as P,tW as ne,tX as Oe,eC as De,eQ as Ce,a2 as K,tY as Se,tZ as Te,t_ as Ne,t$ as Ae,u0 as Re,u1 as ze,u2 as Me,u3 as Pe,u4 as U,u5 as He,u6 as Q,u7 as Le,u8 as We,u9 as Y,e1 as Ie,ua as je,ub as V,uc as Be,ud as Ge,ue as Fe,uf as qe,ug as Ke,bh as Ue}from"./index-CPuzFb4-.js";import"./sw-logo-art-PLtEZJxU.js";function Qe(e){return!!e&&e.can.grant===!0}const z=e=>String(e).padStart(2,"0");function Ye(e){return`${e.getFullYear()}-${z(e.getMonth()+1)}-${z(e.getDate())}T${z(e.getHours())}:${z(e.getMinutes())}`}function Ve(e,t){return t>0?Ye(new Date(e.getTime()+t*36e5)):""}function de(e){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e))return null;const t=new Date(e);return Number.isNaN(t.getTime())?null:fe(t)}function Je(e,t,a,i,r){if(!t)return"person";if(i)return e.can_no_expiry?null:"expiry_required";const n=de(a);if(!n)return"expiry_required";const c=new Date(n).getTime();return c<=r.getTime()?"expiry_past":!e.can_no_expiry&&c>r.getTime()+e.max_hours*36e5?"expiry_too_long":null}var Ze=Object.defineProperty,Xe=Object.getOwnPropertyDescriptor,k=(e,t,a,i)=>{for(var r=i>1?void 0:i?Xe(t,a):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(r=(i?c(t,a,r):c(r))||r);return i&&r&&Ze(t,a,r),r};let $=class extends N{constructor(){super(...arguments),this.open=!1,this.view=null,this.person="",this.place="installation:*",this.expiry="",this.noExpiry=!1,this.revoking="",this.busy=!1,this.error=""}willUpdate(e){e.has("open")&&this.open&&this.load()}async load(){this.error="";try{this.view=await me(),this.expiry=Ve(new Date,this.view.default_hours),this.noExpiry=this.view.default_hours===0&&this.view.can_no_expiry;const e=this.view.scopes[0];this.place=e?`${e.scope_type}:${e.scope_id}`:""}catch(e){this.error=m(e)}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}fail(e){const t=e instanceof B?`grErr_${e.code}`:"";this.error=we.includes(t)?s(t):m(e)}async give(){if(!this.view)return;const e=this.place.indexOf(":");this.busy=!0,this.error="";try{await ve(this.person,{scope_type:this.place.slice(0,e),scope_id:this.place.slice(e+1)},de(this.expiry),this.noExpiry),this.person="",this.dispatchEvent(new CustomEvent("notice",{detail:s("grGranted"),bubbles:!0,composed:!0})),await this.load()}catch(t){this.fail(t)}finally{this.busy=!1}}async take(e){this.busy=!0,this.error="";try{await $e(e),this.revoking="",this.dispatchEvent(new CustomEvent("notice",{detail:s("grRevoked"),bubbles:!0,composed:!0})),await this.load()}catch(t){this.fail(t)}finally{this.busy=!1}}render(){if(!this.open)return l;const e=this.view,t=e?Je(e,this.person,this.expiry,this.noExpiry,new Date):"person";return o`<sw-drawer open modal heading=${s("grTitle")} @close=${()=>this.close()} data-dw-grants>
      ${e?o`<div class="form">
        <section>
          <ul class="lines" data-dw-grants-list>
            ${e.holders.length?e.holders.map(a=>o`<li data-dw-grant=${a.id}>
              <span><b>${a.name}</b> · ${a.scope_name}</span>
              <span>${a.expires_at?s("grUntil",{when:ge(a.expires_at)}):s("grNoExpiry")}</span>
              ${this.revoking===a.id?o`<sw-button size="sm" variant="danger" data-dw-grant-revoke-confirm ?disabled=${this.busy} @click=${()=>void this.take(a.id)}>${s("grRevokeConfirm")}</sw-button>`:o`<sw-button size="sm" variant="ghost" data-dw-grant-revoke @click=${()=>this.revoking=a.id}>${s("grRevoke")}</sw-button>`}
            </li>`):o`<li data-dw-grants-none><span>${s("grNone")}</span></li>`}
          </ul>
        </section>
        <section>
          <div class="field"><label for="dwg-person">${s("grPerson")}</label>
            <select id="dwg-person" data-dw-grant-person @change=${a=>this.person=a.target.value}>
              <option value="" ?selected=${this.person===""}>${s("grChoose")}</option>
              ${e.candidates.map(a=>o`<option value=${a.id} ?selected=${a.id===this.person}>${a.name}</option>`)}</select></div>
          ${e.scopes.length>1?o`<div class="field"><label for="dwg-place">${s("grPlace")}</label>
            <select id="dwg-place" data-dw-grant-place @change=${a=>this.place=a.target.value}>
              ${e.scopes.map(a=>o`<option value=${`${a.scope_type}:${a.scope_id}`} ?selected=${`${a.scope_type}:${a.scope_id}`===this.place}>${a.name}</option>`)}</select></div>`:l}
          <div class="field"><label for="dwg-expiry">${s("grExpiry")}</label>
            <input id="dwg-expiry" type="datetime-local" lang=${D()} data-dw-grant-expiry .value=${this.expiry} ?disabled=${this.noExpiry}
              @input=${a=>this.expiry=a.target.value}></div>
          ${e.can_no_expiry?o`<label class="occ"><input type="checkbox" data-dw-grant-noexpiry .checked=${this.noExpiry}
            @change=${a=>this.noExpiry=a.target.checked}> ${s("grNoExpiry")}</label>`:l}
        </section>
      </div>`:l}
      ${this.error?o`<div class="err" role="alert" data-dw-grants-error>${this.error}</div>`:l}
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.close()}>${s("cancel")}</sw-button>
        <sw-button variant="primary" data-dw-grant-add ?disabled=${this.busy||!e||t!==null} @click=${()=>void this.give()}>${s("grAdd")}</sw-button>
      </div>
    </sw-drawer>`}};$.styles=[T];k([g({type:Boolean})],$.prototype,"open",2);k([p()],$.prototype,"view",2);k([p()],$.prototype,"person",2);k([p()],$.prototype,"place",2);k([p()],$.prototype,"expiry",2);k([p()],$.prototype,"noExpiry",2);k([p()],$.prototype,"revoking",2);k([p()],$.prototype,"busy",2);k([p()],$.prototype,"error",2);$=k([A("door-emergency-grants")],$);const G={kind_event:["לפי אירוע","By event","حسب حدث","По событию"],evSection:["חלונות לפי אירוע","Event windows","نوافذ حسب الحدث","Окна по событию"],evNew:["כלל אירוע חדש","New event rule","قاعدة حدث جديدة","Новое правило по событию"],evEditorNew:["כלל אירוע חדש","New event rule","قاعدة حدث جديدة","Новое правило по событию"],evEditorEdit:["עריכת כלל אירוע","Edit event rule","تعديل قاعدة الحدث","Правка правила по событию"],evEmpty:["עוד לא הוגדרו כללי אירוע.","No event rules yet.","لم تُحدَّد قواعد حدث بعد.","Правил по событию пока нет."],src_label:["מקור האירוע","Event source","مصدر الحدث","Источник события"],src_ha_event:["אירוע חיצוני","External event","حدث خارجي","Внешнее событие"],src_arx_automation:["אוטומציה","Automation","أتمتة","Автоматизация"],src_arx_button:["כפתור במסך","Button on screen","زر على الشاشة","Кнопка на экране"],fAutomation:["מזהה האוטומציה","Automation id","معرّف الأتمتة","Идентификатор автоматизации"],fAutomationPh:["automation.entrance_button","automation.entrance_button","automation.entrance_button","automation.entrance_button"],fDurationMin:["משך החלון (דקות)","Window length (minutes)","مدة النافذة (دقائق)","Длительность окна (мин)"],fAllowedFrom:["מותר משעה","Allowed from","مسموح من","Разрешено с"],fAllowedTo:["עד שעה","Until","حتى","До"],fAllowedAll:["בכל שעה","Any hour","في أي ساعة","В любое время"],fAllowedLimit:["הגבלת שעות","Limit the hours","تحديد الساعات","Ограничить часы"],fMaxPerDay:["הפעלות ביום לדלת","Starts per door per day","مرات التشغيل لكل باب يوميًا","Запусков на дверь в день"],fCooldownMin:["המתנה בין הפעלות (דקות)","Wait between starts (minutes)","الانتظار بين مرات التشغيل (دقائق)","Пауза между запусками (мин)"],fRegenerate:["קוד חדש בשמירה","New code on save","رمز جديد عند الحفظ","Новый код при сохранении"],capDay:["תקרה ליום: {n}","Day cap: {n}","الحد اليومي: {n}","Лимит в день: {n}"],capStorm:["תקרת סערה: {n} בשעה","Storm cap: {n} per hour","حد العاصفة: {n} في الساعة","Лимит всплеска: {n} в час"],capQuiet:["שעות שקטות {from}–{to}","Quiet hours {from}–{to}","ساعات الهدوء {from}–{to}","Тихие часы {from}–{to}"],capCooldown:["המתנה {n} דק׳","Wait {n} min","انتظار {n} د","Пауза {n} мин"],capLength:["משך {n} דק׳","Length {n} min","المدة {n} د","Длина {n} мин"],capHours:["{from}–{to}","{from}–{to}","{from}–{to}","{from}–{to}"],errSource:["בחרו מקור לאירוע.","Choose an event source.","اختر مصدر الحدث.","Выберите источник события."],errAutomation:["הזינו מזהה אוטומציה בצורה automation.name","Enter an automation id like automation.name","أدخل معرّف أتمتة بالشكل automation.name","Введите идентификатор вида automation.name"],errDuration:["משך החלון חייב להיות בין דקה ל־{h} שעות.","The length must be between one minute and {h} h.","يجب أن تكون المدة بين دقيقة و{h} ساعات.","Длительность — от минуты до {h} ч."],errAllowed:["שעת הסיום חייבת להיות אחרי שעת ההתחלה.","The end must be after the start.","يجب أن تكون النهاية بعد البداية.","Конец должен быть позже начала."],errQuiet:["הטווח נוגע בשעות השקטות.","The range touches the quiet hours.","النطاق يلامس ساعات الهدوء.","Диапазон задевает тихие часы."],errCap:["מספר ההפעלות ליום: 1 עד {n}.","Starts per day: 1 to {n}.","مرات التشغيل يوميًا: من 1 إلى {n}.","Запусков в день: от 1 до {n}."],errCooldown:["ההמתנה: 0 עד 1440 דקות.","The wait: 0 to 1440 minutes.","الانتظار: من 0 إلى 1440 دقيقة.","Пауза: от 0 до 1440 мин."],arm_simulate:["מדומה","Simulated","محاكاة","Имитация"],arm_armed:["פעיל","Armed","مفعّل","Включено"],arm_unavailable:["הפעלה אמיתית אינה זמינה","Arming is not available","التفعيل الفعلي غير متاح","Боевой режим недоступен"],armBtn:["הפעלה אמיתית","Arm","تفعيل فعلي","Включить"],disarmBtn:["חזרה לסימולציה","Back to simulation","العودة إلى المحاكاة","Назад к имитации"],confirmArm:["הכלל יפתח דלתות באמת כשהאירוע יגיע. הפעולה נרשמת על שמך.","The rule will really open doors when the event arrives. This is recorded in your name.","ستفتح القاعدة الأبواب فعلًا عند وصول الحدث. يُسجَّل ذلك باسمك.","Правило будет реально открывать двери при событии. Запись — на ваше имя."],confirmDisarm:["הכלל יחזור לסימולציה: אירוע יירשם אבל דלת לא תיפתח.","The rule returns to simulation: events are logged, no door opens.","تعود القاعدة إلى المحاكاة: يُسجَّل الحدث ولا يُفتح باب.","Правило вернётся к имитации: события пишутся, двери не открываются."],armRefused:["ההפעלה האמיתית נדחתה: אין עדיין זהות אוטומציה מאומתת.","Arming was refused: there is no verified automation identity yet.","رُفض التفعيل: لا توجد هوية أتمتة موثّقة بعد.","Включение отклонено: проверенной учётной записи автоматизации пока нет."],tokenTitle:["קוד האירוע מוצג פעם אחת","The event code is shown once","يُعرض رمز الحدث مرة واحدة","Код события показывается один раз"],tokenCopy:["העתקה","Copy","نسخ","Копировать"],tokenCopied:["הועתק","Copied","تم النسخ","Скопировано"],tokenNew:["קוד חדש","New code","رمز جديد","Новый код"],tokenHas:["קיים קוד","Code set","الرمز موجود","Код задан"],confirmToken:["הקוד הקודם יפסיק לעבוד מיד והכלל יחזור לסימולציה.","The old code stops working at once and the rule returns to simulation.","يتوقف الرمز القديم فورًا وتعود القاعدة إلى المحاكاة.","Старый код перестанет работать сразу, правило вернётся к имитации."],logTitle:["הפעלות אחרונות","Recent starts","آخر مرات التشغيل","Последние запуски"],logEmpty:["עוד לא היו הפעלות.","No starts yet.","لا توجد تشغيلات بعد.","Запусков пока не было."],dec_started:["נפתח","Started","بدأ","Запущено"],dec_extended:["הוארך","Extended","مُدِّد","Продлено"],dec_simulated:["סימולציה","Simulated","محاكاة","Имитация"],dec_refused:["נדחה","Refused","مرفوض","Отклонено"],reason_storm:["יותר מדי הפעלות בשעה","Too many starts in an hour","تشغيلات كثيرة في الساعة","Слишком много запусков в час"],reason_exterior_not_allowed:["דלת חיצונית","Exterior door","باب خارجي","Наружная дверь"],reason_closed_day:["יום סגור","Closed day","يوم مغلق","Закрытый день"],reason_outside_hours:["מחוץ לשעות המותרות","Outside the allowed hours","خارج الساعات المسموحة","Вне разрешённых часов"],reason_too_long:["ארוך מהמותר","Longer than allowed","أطول من المسموح","Дольше разрешённого"],reason_crosses_midnight:["חוצה חצות","Crosses midnight","يتجاوز منتصف الليل","Пересекает полночь"],reason_ambiguous_time:["שעה לא חד־משמעית","Ambiguous time","وقت غير واضح","Неоднозначное время"],reason_quiet_hours:["שעות שקטות","Quiet hours","ساعات الهدوء","Тихие часы"],reason_relock_unconfirmed:["חזרה לרגיל טרם אושרה","Return to normal not confirmed","العودة إلى الوضع العادي لم تُؤكَّد","Возврат в обычный режим не подтверждён"],reason_emergency:["מצב חירום","Emergency","حالة طوارئ","Аварийный режим"],reason_paused:["הופסק ידנית","Paused by a person","أُوقف يدويًا","Остановлено вручную"],reason_inside_window:["כבר בחלון","Already in a window","داخل نافذة بالفعل","Уже в окне"],reason_overlaps_window:["חופף חלון","Overlaps a window","يتداخل مع نافذة","Пересекается с окном"],reason_already_covered:["כבר פתוח עד אז","Already open until then","مفتوح بالفعل حتى ذلك الحين","Уже открыто до этого времени"],reason_would_extend_running:["הארכת חלון שרץ כבויה","Extending a running window is off","تمديد نافذة جارية متوقف","Продление идущего окна выключено"],reason_extended_already:["כבר הוארך פעם","Already extended once","مُدِّد مرة بالفعل","Уже продлено один раз"],reason_would_extend:["היה מאריך","Would extend","كان سيمدّد","Продлило бы"],reason_daily_cap:["תקרה יומית","Day cap","الحد اليومي","Дневной лимит"],reason_rule_daily_cap:["תקרה יומית של הכלל","Rule day cap","الحد اليومي للقاعدة","Дневной лимит правила"],reason_cooldown:["בהמתנה","Cooling down","قيد الانتظار","Пауза"],reason_unknown_rule:["כלל לא מוכר","Unknown rule","قاعدة غير معروفة","Неизвестное правило"],reason_bad_token:["קוד שגוי","Wrong code","رمز خاطئ","Неверный код"],reason_item_changed:["האוטומציה השתנתה","The automation changed","تغيّرت الأتمتة","Автоматизация изменилась"],reason_authorising_actor_lost:["המאשר איבד הרשאה","The approver lost access","فقد المُعتمِد صلاحيته","У утвердившего пропал доступ"],reason_already_handled:["כבר טופל","Already handled","تمت معالجته","Уже обработано"],reason_other:["נדחה","Refused","مرفوض","Отклонено"],hlBtn:["חגים","Holidays","العطل","Праздники"],hlTitle:["חגים וימים מיוחדים","Holidays and special days","العطل والأيام الخاصة","Праздники и особые дни"],hlEmpty:["אין ימים מיוחדים ברשימה.","No special days in the list.","لا أيام خاصة في القائمة.","В списке нет особых дней."],hlGenerator:["רשימת החגים","Holiday list","قائمة العطل","Список праздников"],gen_israel:["חגי ישראל","Israeli holidays","الأعياد الإسرائيلية","Праздники Израиля"],gen_none:["ללא רשימה","No list","بلا قائمة","Без списка"],hlColDate:["תאריך","Date","التاريخ","Дата"],hlColName:["שם","Name","الاسم","Название"],hlColKind:["סוג היום","Day type","نوع اليوم","Тип дня"],hlColSource:["מקור","Source","المصدر","Источник"],dk_holiday:["חג","Holiday","عيد","Праздник"],dk_holiday_eve:["ערב חג","Holiday eve","ليلة العيد","Канун праздника"],dk_regular:["יום רגיל","Regular day","يوم عادي","Обычный день"],dk_closed:["סגור","Closed","مغلق","Закрыто"],hlSrcGenerated:["מהרשימה","From the list","من القائمة","Из списка"],hlSrcManual:["שונה ידנית","Changed by hand","عُدِّل يدويًا","Изменено вручную"],hlWas:["ברירת מחדל: {kind}","Default: {kind}","الافتراضي: {kind}","По умолчанию: {kind}"],hlReset:["שחזור ברירת מחדל","Restore default","استعادة الافتراضي","Вернуть по умолчанию"],hlRemove:["הסרה","Remove","إزالة","Убрать"],hlAdd:["הוספת יום","Add a day","إضافة يوم","Добавить день"],hlLabel:["שם היום","Day name","اسم اليوم","Название дня"],hlSave:["שמירה","Save","حفظ","Сохранить"],hlLoading:["טוען את רשימת החגים…","Loading the holiday list…","جارٍ تحميل قائمة العطل…","Загрузка списка праздников…"],hlLoadError:["לא ניתן לטעון את רשימת החגים","The holiday list could not be loaded","تعذّر تحميل قائمة العطل","Не удалось загрузить список праздников"],hlConfirm:["{date}: {kind}. השינוי משפיע על פתיחת דלתות בתאריך הזה.","{date}: {kind}. This changes when doors open on that date.","{date}: {kind}. هذا يغيّر موعد فتح الأبواب في هذا التاريخ.","{date}: {kind}. Это меняет открытие дверей в эту дату."],hlConfirmReset:["{date} יחזור לברירת המחדל של הרשימה.","{date} returns to the list default.","يعود {date} إلى الافتراضي في القائمة.","{date} вернётся к значению списка."],hlConfirmGenerator:["רשימת החגים תשתנה: {name}. זה משפיע על כל החלונות.","The holiday list changes: {name}. This affects every window.","ستتغير قائمة العطل: {name}. هذا يؤثر على كل النوافذ.","Список праздников изменится: {name}. Это влияет на все окна."],errHlDate:["בחרו תאריך.","Choose a date.","اختر تاريخًا.","Выберите дату."],ofBtn:["פתיחה לזמן קצוב","Open for hours","فتح لعدة ساعات","Открыть на часы"],ofTitle:["פתיחת דלת לזמן קצוב","Open a door for a set time","فتح باب لمدة محددة","Открыть дверь на заданное время"],ofDoor:["דלת","Door","الباب","Дверь"],ofHours:["שעות","Hours","ساعات","Часы"],ofHoursN:["{n} ש׳","{n} h","{n} س","{n} ч"],ofConfirm:["פתיחה ל־{n} שעות","Open for {n} h","فتح لمدة {n} ساعات","Открыть на {n} ч"],ofConfirmText:["{door} תוחזק פתוחה עד {end}, ואז תחזור למצב רגיל. הפעולה נרשמת על שמך.","{door} stays open until {end}, then returns to normal. This is recorded in your name.","يبقى {door} مفتوحًا حتى {end} ثم يعود إلى الوضع العادي. يُسجَّل ذلك باسمك.","{door} останется открытой до {end}, затем вернётся в обычный режим. Запись — на ваше имя."],ofStarted:["החלון נפתח עד {end}","Window open until {end}","النافذة مفتوحة حتى {end}","Окно открыто до {end}"],ofExtended:["החלון הוארך עד {end}","Window extended to {end}","مُدِّدت النافذة حتى {end}","Окно продлено до {end}"],ofNoDoors:["אין דלתות שמותר לך לנהל.","No doors you may manage.","لا أبواب يمكنك إدارتها.","Нет дверей, которыми вы можете управлять."]},et=Object.keys(G),tt={he:0,en:1,ar:2,ru:3},I=["he","en","ar","ru"].reduce((e,t)=>(e[t]=Object.fromEntries(et.map(a=>[a,G[a][tt[t]]])),e),{});function d(e,t,a=ye()){const i=I[a][e]??I.he[e]??e;return be(i,t)}function le(e,t,a){return e in G?d(e,a):d(t,a)}_e("i18n/door-windows-events",I,["ar","ru"]);const at=20,st=1,ce=["ha_event","arx_automation"],rt=/^automation\.[a-z0-9_]{1,80}$/;function j(e){const t=(a,i)=>/^\d+$/.test(e[a]??"")?Number(e[a]):i;return{maxHours:t("max_hours",4),maxPerDay:t("max_per_day_per_door",3),quiet:[e.quiet_from??"22:00",e.quiet_to??"06:00"]}}function pe(){return{id:null,revision:null,name:"",source:"ha_event",doors:new Set,durationMin:"60",limitHours:!1,from:"08:00",to:"18:00",maxPerDay:"1",cooldownMin:"15",automationId:"",regenerate:!1,calendar:"skip_holidays"}}function ot(e){const t=pe(),a=e.trigger;return t.id=e.id,t.revision=e.revision,t.name=e.name,t.doors=new Set(e.doors.map(i=>i.key)),t.calendar=e.calendar_policy,a&&(t.source=a.source,t.durationMin=String(Math.round(a.duration_s/60)),t.limitHours=!!(a.allowed_from&&a.allowed_to),t.from=a.allowed_from??t.from,t.to=a.allowed_to??t.to,t.maxPerDay=String(a.max_per_day),t.cooldownMin=String(Math.round(a.cooldown_s/60)),t.automationId=a.automation_id??""),t}const it=(e,t,a)=>{const i=C(a[0]),r=C(a[1]);return i===r?!1:(i<r?[[i,r]]:[[i,1440],[0,r]]).some(([c,h])=>C(e)<h&&c<C(t))},H=e=>/^\d+$/.test(e.trim())?Number(e.trim()):null;function nt(e,t){if(!e.name.trim())return{scope:"dwt",key:"errName"};if(!e.doors.size)return{scope:"dwt",key:"errDoors"};if(!ce.includes(e.source))return{scope:"dwe",key:"errSource"};if(e.source==="arx_automation"&&!rt.test(e.automationId.trim()))return{scope:"dwe",key:"errAutomation"};const a=H(e.durationMin);if(a===null||a<st||a>t.maxHours*60)return{scope:"dwe",key:"errDuration",vars:{h:t.maxHours}};if(e.limitHours){if(!q.test(e.from)||!(q.test(e.to)||e.to==="24:00")||C(e.to)<=C(e.from))return{scope:"dwe",key:"errAllowed"};if(it(e.from,e.to,t.quiet))return{scope:"dwe",key:"errQuiet"}}const i=H(e.maxPerDay);if(i===null||i<1||i>t.maxPerDay)return{scope:"dwe",key:"errCap",vars:{n:t.maxPerDay}};const r=H(e.cooldownMin);return r===null||r>1440?{scope:"dwe",key:"errCooldown"}:null}function dt(e,t){const a=[...e.doors].map(i=>{const r=i.lastIndexOf(":");return{station_id:i.slice(0,r),relay:Number(i.slice(r+1))}});return{name:e.name.trim(),kind:"event",calendar_policy:e.calendar,notes:"",doors:a,periods:[],trigger:{source:e.source,duration_s:Number(e.durationMin.trim())*60,allowed_from:e.limitHours?e.from:null,allowed_to:e.limitHours?e.to:null,max_per_day:Number(e.maxPerDay.trim()),cooldown_s:Number(e.cooldownMin.trim())*60,automation_id:e.source==="arx_automation"?e.automationId.trim():null,...e.id&&e.source==="ha_event"&&e.regenerate?{regenerate_token:!0}:{}},...e.revision!==null?{revision:e.revision}:{},enable:t}}function lt(e,t,a){const i=e.arm_state==="armed",r=e.can_arm&&a!==!1;return{state:i?"arm_armed":"arm_simulate",tone:i?"ok":"warn",unavailable:!i&&!r,action:t?i?"disarm":r?"arm":null:null}}function J(e){return e.filter(t=>t.kind==="event"&&!!t.trigger)}function ct(e){return[{key:"capLength",vars:{n:Math.round(e.duration_s/60)}},...e.allowed_from&&e.allowed_to?[{key:"capHours",vars:{from:e.allowed_from,to:e.allowed_to}}]:[],{key:"capDay",vars:{n:e.max_per_day}},{key:"capCooldown",vars:{n:Math.round(e.cooldown_s/60)}}]}const pt={started:"ok",extended:"ok",simulated:"warn",refused:"err"},he=e=>`reason_${e??"other"}`,Z=["holiday","holiday_eve","regular","closed"],ht={holiday:"acc",holiday_eve:"acc",regular:"off",closed:"warn"};function ut(e,t){const a=new Map;for(const i of[...e].filter(r=>r.date>=t).sort((r,n)=>r.date<n.date?-1:1))a.set(i.date.slice(0,7),[...a.get(i.date.slice(0,7))??[],i]);return[...a.entries()].map(([i,r])=>({month:i,rows:r}))}const ft=e=>e.source==="manual";function X(e){return e?.generated_kind||e?.source==="generated"?[...Z]:Z.filter(t=>t!=="regular")}const mt=e=>/^\d{4}-\d{2}-\d{2}$/.test(e)&&new Date(`${e}T00:00:00Z`).toISOString().slice(0,10)===e;function wt(e){return Array.from({length:Math.max(1,Math.min(12,e))},(t,a)=>a+1)}function L(e){const t=e.settings.exterior_allowed==="true";return e.enabled?e.doors.filter(a=>a.manage&&(t||!a.exterior)):[]}function ee(e,t){return new Date(Math.ceil(Date.parse(e)/6e4)*6e4+t*36e5).toISOString()}function vt(e){const a=e?.body?.details?.reason;return typeof a=="string"?a:null}const F=ae`
  :host { display: block; }
  section { display: grid; gap: 10px; }
  p { overflow-wrap: anywhere; }
  h2 { margin: 0; font-size: var(--sw-fs-lg); font-weight: 700; color: var(--sw-text); }
  .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
  .card { display: grid; gap: 10px; padding: 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); min-inline-size: 0; }
  .card .top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
  .card .top b { font-size: var(--sw-fs-md); overflow-wrap: anywhere; }
  .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .form { display: grid; gap: 14px; }
  .field { display: grid; gap: 6px; }
  .field > label, .field > .lbl { font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); }
  .row2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(9em, 1fr)); gap: 10px; }
  input[type='text'], input[type='date'], input[type='time'], select {
    font: inherit; padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text);
    min-inline-size: 0; inline-size: 100%; box-sizing: border-box;
  }
  input[inputmode='numeric'], input.code, input[type='time'], input[type='date'] { direction: ltr; text-align: start; }
  /* CR-CMP2-SEGMENTED-C-2450: the single choices (rule source, generator, hours) are sw-chip-choice - the chip look lives there */
  .doors { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; max-block-size: 260px; overflow: auto; padding: 4px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); }
  .doors label, label.chk { display: flex; gap: 8px; align-items: center; padding: 4px 6px; border-radius: var(--sw-r-sm); }
  .doors label, .doors .st, label.chk { min-inline-size: 0; overflow-wrap: anywhere; }
  .doors .st { font-size: var(--sw-fs-xs); color: var(--sw-text-3); padding: 6px 6px 0; }
  ${te}
  .footer { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  pre.snippet {
    margin: 0; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-text); direction: ltr; text-align: start;
    font-family: var(--sw-font-mono, ui-monospace, monospace); font-size: var(--sw-fs-sm); white-space: pre-wrap; overflow-wrap: anywhere; user-select: all;
  }
  .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  @media (max-width: 767px) and (pointer: coarse) {
    input[type='text'], input[type='date'], input[type='time'], select { min-block-size: 44px; }
    .doors label, label.chk { min-block-size: 44px; }
    input[type='checkbox'], input[type='radio'] { inline-size: 22px; block-size: 22px; }
  }
`;var $t=Object.defineProperty,gt=Object.getOwnPropertyDescriptor,E=(e,t,a,i)=>{for(var r=i>1?void 0:i?gt(t,a):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(r=(i?c(t,a,r):c(r))||r);return i&&r&&$t(t,a,r),r};let x=class extends N{constructor(){super(...arguments),this.data=null,this.draft=null,this.draftError="",this.busy=!1,this.confirm=null,this.secret=null,this.copied=!1}tell(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}changed(){this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}async run(e){this.busy=!0;try{await e.run(),this.confirm=null,this.tell(s("done")),this.changed()}catch(t){this.confirm=null,this.tell(t instanceof B&&t.code==="automation_actor_unavailable"?d("armRefused"):`${s("failed")}: ${m(t)}`)}finally{this.busy=!1}}ask(e){this.confirm={title:s("confirmTitle"),...e}}askRule(e,t){const a={enable:"confirmEnable",pause:"confirmPause",retire:"confirmRetire"};this.ask({text:s(a[t]),btn:s(t),danger:t==="retire",run:()=>se(e.id,t)})}askArm(e,t){this.ask({text:d(t?"confirmArm":"confirmDisarm"),btn:d(t?"armBtn":"disarmBtn"),danger:t,run:()=>xe(e.id,t)})}askToken(e){this.ask({text:d("confirmToken"),btn:d("tokenNew"),run:async()=>{const t=await ke(e.id);this.secret={name:e.name,token:t.token,snippet:t.snippet}}})}openEditor(e){this.draft=e?ot(e):pe(),this.draftError=""}patch(e){if(!this.draft)return;const t={...this.draft,doors:new Set(this.draft.doors)};e(t),this.draft=t,this.draftError=""}problem(){if(!this.draft||!this.data)return"";const e=nt(this.draft,j(this.data.settings));return e?e.scope==="dwe"?d(e.key,e.vars):s(e.key,e.vars):""}save(e){const t=this.problem();if(t||!this.draft){this.draftError=t;return}const a=this.draft,i=async()=>{const r=dt(a,e),n=a.id?await oe(a.id,r):await ie(r);this.draft=null,n.token&&(this.secret={name:a.name.trim(),token:n.token,snippet:n.snippet??""})};e?this.ask({text:s("confirmEnable"),btn:s("saveEnable"),run:i}):this.run({title:"",text:"",btn:"",run:i})}async copy(e){try{await navigator.clipboard.writeText(e),this.copied=!0,window.setTimeout(()=>this.copied=!1,2e3)}catch{this.copied=!1}}logWhen(e){const t=this.data?.doors.find(i=>i.key===e.door)?.zone??"Asia/Jerusalem",a=S(e.at,t);return`${a.slice(8,10)}.${a.slice(5,7)} ${_(e.at,t)}`}render(){const e=this.data;if(!e)return l;const t=J(e.rules);return!t.length&&!e.can.manage&&!(e.triggers??[]).length?l:o`<section data-dw-events>
      <div class="head"><h2>${d("evSection")}</h2>
        <div class="acts">
          <span class="chip num" data-dw-storm>${d("capStorm",{n:at})}</span>
          ${e.settings.max_per_day_per_door?o`<span class="chip num">${d("capDay",{n:e.settings.max_per_day_per_door})}</span>`:l}
          ${e.settings.quiet_from?o`<span class="chip num">${d("capQuiet",{from:e.settings.quiet_from,to:e.settings.quiet_to})}</span>`:l}
          ${e.can.manage?o`<sw-button size="sm" variant="secondary" icon="plus" data-dw-new-event @click=${()=>this.openEditor()}>${d("evNew")}</sw-button>`:l}
        </div></div>
      ${t.length?t.map(a=>this.renderCard(a)):o`<div class="muted" data-dw-events-empty>${d("evEmpty")}</div>`}
      ${this.renderLog()}
      ${this.renderEditor()}
      ${this.draft?l:this.renderConfirm()}
      ${this.renderSecret()}
    </section>`}renderCard(e){const t=e.trigger,a=lt(t,!!e.manageable,this.data.automation_actor);return o`<div class="card" data-dw-event-rule=${e.id} data-dw-rule-state=${e.state} data-dw-arm=${t.arm_state} data-dw-source=${t.source}>
      <div class="top"><b>${e.name}</b>
        <div class="chips">
          <span class="chip" data-tone=${re[e.state]}>${s(`rs_${e.state}`)}</span>
          <span class="chip" data-tone=${a.tone} data-dw-arm-chip>${d(a.state)}</span>
          ${a.unavailable?o`<span class="chip" data-tone="off" data-dw-arm-unavailable>${d("arm_unavailable")}</span>`:l}
        </div></div>
      <div class="chips"><span class="chip" data-tone="acc">${d(`src_${t.source}`)}</span>
        ${t.source==="arx_automation"&&t.automation_id?o`<span class="chip num">${t.automation_id}</span>`:l}
        ${t.source==="ha_event"&&t.has_token?o`<span class="chip">${d("tokenHas")}</span>`:l}
        ${e.doors.filter(i=>i.visible).map(i=>o`<span class="chip">${i.label}</span>`)}</div>
      <div class="chips">${ct(t).map(i=>o`<span class="chip num">${d(i.key,i.vars)}</span>`)}</div>
      ${e.manageable?o`<div class="acts">
        <sw-button size="sm" variant="ghost" icon="edit" data-dw-edit @click=${()=>this.openEditor(e)}>${s("edit")}</sw-button>
        ${e.state==="enabled"?o`<sw-button size="sm" variant="ghost" icon="pause" data-dw-pause @click=${()=>this.askRule(e,"pause")}>${s("pause")}</sw-button>`:o`<sw-button size="sm" variant="secondary" icon="play" data-dw-enable @click=${()=>this.askRule(e,"enable")}>${s("enable")}</sw-button>`}
        ${a.action==="arm"?o`<sw-button size="sm" variant="secondary" icon="bolt" data-dw-arm @click=${()=>this.askArm(e,!0)}>${d("armBtn")}</sw-button>`:l}
        ${a.action==="disarm"?o`<sw-button size="sm" variant="secondary" data-dw-disarm @click=${()=>this.askArm(e,!1)}>${d("disarmBtn")}</sw-button>`:l}
        ${t.source==="ha_event"?o`<sw-button size="sm" variant="ghost" icon="link" data-dw-token @click=${()=>this.askToken(e)}>${d("tokenNew")}</sw-button>`:l}
        <sw-button size="sm" variant="ghost" icon="trash" data-dw-retire @click=${()=>this.askRule(e,"retire")}>${s("retire")}</sw-button>
      </div>`:l}
    </div>`}renderLog(){const e=this.data.triggers??[];if(!e.length&&!J(this.data.rules).length)return l;const t=a=>this.data.doors.find(i=>i.key===a)?.label??a;return o`<div class="card" data-dw-trigger-log><b>${d("logTitle")}</b>
      ${e.length?o`<ul class="lines">${e.map(a=>o`<li data-dw-log=${a.decision}>
        <span>${t(a.door)} <span class="muted num">${this.logWhen(a)}</span></span>
        <span class="chips"><span class="chip">${d(`src_${a.source}`)}</span>
          <span class="chip" data-tone=${pt[a.decision]}>${d(`dec_${a.decision}`)}</span>
          ${a.reason?o`<span class="chip" data-tone="off">${le(he(a.reason),"reason_other")}</span>`:l}</span>
      </li>`)}</ul>`:o`<div class="muted">${d("logEmpty")}</div>`}
    </div>`}renderEditor(){const e=this.draft;if(!e||!this.data)return l;const t=j(this.data.settings),a=this.data.settings.exterior_allowed==="true",i=this.data.doors.filter(c=>c.manage&&(a||!c.exterior)),r=[...new Set(i.map(c=>c.station_name))],n=(c,h,M)=>o`<input id=${c} type="text" inputmode="numeric"
      data-dw-field=${c} .value=${h} @input=${R=>this.patch(ue=>M(ue,R.target.value))}>`;return o`<sw-drawer open modal heading=${e.id?d("evEditorEdit"):d("evEditorNew")} @close=${()=>this.draft=null}>
      <div class="form" data-dw-event-editor>
        <div class="field"><label for="dwe-name">${s("fName")}</label>
          <input id="dwe-name" type="text" maxlength="60" .value=${e.name} @input=${c=>this.patch(h=>h.name=c.target.value)}></div>
        <div class="field"><span class="lbl">${d("src_label")}</span><sw-chip-choice label=${d("src_label")} value=${e.source} @change=${c=>this.patch(h=>h.source=c.detail.value)}
          .options=${ce.map(c=>({value:c,label:d(`src_${c}`),attrs:{"data-dw-source-pick":c}}))}></sw-chip-choice></div>
        ${e.source==="arx_automation"?o`<div class="field"><label for="dwe-auto">${d("fAutomation")}</label>
          <input id="dwe-auto" class="code" type="text" maxlength="90" placeholder=${d("fAutomationPh")} .value=${e.automationId}
            @input=${c=>this.patch(h=>h.automationId=c.target.value)}></div>`:l}
        <div class="field"><span class="lbl">${s("fDoors")}</span>
          <div class="doors" data-dw-doors>${r.map(c=>o`${c?o`<div class="st">${c}</div>`:l}
            ${i.filter(h=>h.station_name===c).map(h=>o`<label><input type="checkbox" data-dw-door=${h.key} .checked=${e.doors.has(h.key)}
              @change=${M=>this.patch(R=>M.target.checked?R.doors.add(h.key):R.doors.delete(h.key))}>${h.name}</label>`)}`)}</div></div>
        <div class="row2">
          <div class="field"><label for="dwe-dur">${d("fDurationMin")}</label>${n("dwe-dur",e.durationMin,(c,h)=>c.durationMin=h)}</div>
          <div class="field"><label for="dwe-cap">${d("fMaxPerDay")}</label>${n("dwe-cap",e.maxPerDay,(c,h)=>c.maxPerDay=h)}</div>
          <div class="field"><label for="dwe-cool">${d("fCooldownMin")}</label>${n("dwe-cool",e.cooldownMin,(c,h)=>c.cooldownMin=h)}</div>
        </div>
        <div class="field"><label class="chk"><input type="checkbox" data-dw-limit .checked=${e.limitHours}
            @change=${c=>this.patch(h=>h.limitHours=c.target.checked)}>${d("fAllowedLimit")}</label>
          ${e.limitHours?o`<div class="row2">
            <label class="muted">${d("fAllowedFrom")} <input type="time" lang=${D()} step="900" .value=${e.from} @change=${c=>this.patch(h=>h.from=c.target.value)}></label>
            <label class="muted">${d("fAllowedTo")} <input type="time" lang=${D()} step="900" .value=${e.to==="24:00"?"23:59":e.to} @change=${c=>this.patch(h=>h.to=c.target.value)}></label>
          </div>`:o`<span class="muted">${d("fAllowedAll")}</span>`}
          <span class="chip num">${d("capQuiet",{from:t.quiet[0],to:t.quiet[1]})}</span></div>
        ${e.id&&e.source==="ha_event"?o`<label class="chk"><input type="checkbox" data-dw-regenerate .checked=${e.regenerate}
            @change=${c=>this.patch(h=>h.regenerate=c.target.checked)}>${d("fRegenerate")}</label>`:l}
        ${this.draftError?o`<div class="err" role="alert" data-dw-error>${this.draftError}</div>`:l}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.draft=null}>${s("cancel")}</sw-button>
        <sw-button variant="secondary" data-dw-save-draft ?disabled=${this.busy} @click=${()=>this.save(!1)}>${s("saveDraft")}</sw-button>
        <sw-button variant="primary" data-dw-save-enable ?disabled=${this.busy} @click=${()=>this.save(!0)}>${s("saveEnable")}</sw-button>
      </div>
      ${this.renderConfirm()}
    </sw-drawer>`}renderConfirm(){const e=this.confirm;return e?o`<sw-dialog open heading=${e.title} @close=${()=>this.confirm=null} data-dw-confirm>
      <p>${e.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.confirm=null}>${s("cancel")}</sw-button>
        <sw-button variant=${e.danger?"danger":"primary"} data-dw-confirm-btn ?disabled=${this.busy} @click=${()=>void this.run(e)}>${e.btn}</sw-button>
      </div>
    </sw-dialog>`:l}renderSecret(){const e=this.secret;return e?o`<sw-dialog open heading=${d("tokenTitle")} subheading=${e.name} @close=${()=>this.secret=null} data-dw-secret>
      <pre class="snippet" data-dw-snippet>${e.snippet||e.token}</pre>
      <div slot="footer" class="footer">
        <sw-button variant="secondary" icon="copy" data-dw-copy @click=${()=>void this.copy(e.snippet||e.token)}>${this.copied?d("tokenCopied"):d("tokenCopy")}</sw-button>
        <sw-button variant="primary" @click=${()=>this.secret=null}>${s("close")}</sw-button>
      </div>
    </sw-dialog>`:l}};x.styles=[T,F];E([g({attribute:!1})],x.prototype,"data",2);E([p()],x.prototype,"draft",2);E([p()],x.prototype,"draftError",2);E([p()],x.prototype,"busy",2);E([p()],x.prototype,"confirm",2);E([p()],x.prototype,"secret",2);E([p()],x.prototype,"copied",2);x=E([A("door-event-rules")],x);var bt=Object.defineProperty,yt=Object.getOwnPropertyDescriptor,b=(e,t,a,i)=>{for(var r=i>1?void 0:i?yt(t,a):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(r=(i?c(t,a,r):c(r))||r);return i&&r&&bt(t,a,r),r};const _t=["israel","none"];let w=class extends N{constructor(){super(...arguments),this.open=!1,this.canManage=!1,this.canConfigure=!1,this.today="",this.cal=null,this.error="",this.busy=!1,this.pending=null,this.formError="",this.add={date:"",kind:"holiday",label:""},this.kindWord=e=>d(`dk_${e}`)}willUpdate(e){e.has("open")&&this.open&&this.load()}async load(){this.error="";try{this.cal=await Ee()}catch(e){this.error=m(e)}finally{}}tell(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}close(){this.pending=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}dateWord(e){return`${s(`wd${W(e)}`)} ${e.slice(8,10)}.${e.slice(5,7)}.${e.slice(0,4)}`}askKind(e,t){this.pending={text:d("hlConfirm",{date:this.dateWord(e.date),kind:this.kindWord(t)}),run:()=>P(e.date,t,e.name_he)}}askReset(e){this.pending={text:d("hlConfirmReset",{date:this.dateWord(e.date)}),run:()=>P(e.date,"none")}}askGenerator(e){this.pending={text:d("hlConfirmGenerator",{name:d(`gen_${e}`)}),run:()=>ne({"doors.windows.calendar_generator":e})}}askAdd(){if(!mt(this.add.date)){this.formError=d("errHlDate");return}this.formError="";const{date:e,kind:t,label:a}=this.add;this.pending={text:d("hlConfirm",{date:this.dateWord(e),kind:this.kindWord(t)}),run:async()=>{await P(e,t,a.trim()),this.add={date:"",kind:"holiday",label:""}}}}async confirm(){const e=this.pending;if(e){this.busy=!0;try{await e.run(),this.pending=null,this.tell(s("done")),await this.load(),this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}catch(t){this.pending=null,this.tell(`${s("failed")}: ${m(t)}`)}finally{this.busy=!1}}}render(){return this.open?o`<sw-drawer open heading=${d("hlTitle")} @close=${()=>this.close()}>
      <div class="form" data-dw-holidays>
        ${this.error?o`<sw-state-panel quiet state="error" heading=${d("hlLoadError")} actionLabel=${s("retry")} data-dw-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:this.cal?this.renderBody():o`<sw-state-panel quiet state="loading" heading=${d("hlLoading")} data-dw-panel="loading"></sw-state-panel>`}
      </div>
      ${this.renderPending()}
    </sw-drawer>`:l}renderBody(){const e=this.cal,t=ut(e.holidays,this.today||e.holidays[0]?.date||"");return o`
      <div class="field"><span class="lbl">${d("hlGenerator")}</span>
        ${this.canConfigure?o`<sw-chip-choice label=${d("hlGenerator")} data-dw-generator value=${e.generator} @change=${a=>e.generator!==a.detail.value&&this.askGenerator(a.detail.value)}
              .options=${_t.map(a=>({value:a,label:d(`gen_${a}`),attrs:{"data-dw-gen":a}}))}></sw-chip-choice>`:o`<div class="chips"><span class="chip" data-dw-generator-chip>${d(`gen_${e.generator}`)}</span></div>`}</div>
      ${t.length?t.map(a=>o`<div class="card" data-dw-month=${a.month}>
        <b class="num">${a.month.slice(5,7)}.${a.month.slice(0,4)}</b>
        <ul class="lines">${a.rows.map(i=>this.renderRow(i))}</ul></div>`):o`<div class="muted" data-dw-holidays-empty>${d("hlEmpty")}</div>`}
      ${this.canManage?o`<div class="card" data-dw-add>
        <b>${d("hlAdd")}</b>
        <div class="row2">
          <div class="field"><label for="dwh-date">${d("hlColDate")}</label><input id="dwh-date" type="date" lang=${D()} min=${this.today} .value=${this.add.date}
            @change=${a=>this.add={...this.add,date:a.target.value}}></div>
          <div class="field"><label for="dwh-kind">${d("hlColKind")}</label><select id="dwh-kind" @change=${a=>this.add={...this.add,kind:a.target.value}}>
            ${X(null).map(a=>o`<option value=${a} ?selected=${this.add.kind===a}>${this.kindWord(a)}</option>`)}</select></div>
          <div class="field"><label for="dwh-label">${d("hlLabel")}</label><input id="dwh-label" type="text" maxlength="60" .value=${this.add.label}
            @input=${a=>this.add={...this.add,label:a.target.value}}></div>
        </div>
        ${this.formError?o`<div class="err" role="alert">${this.formError}</div>`:l}
        <div class="footer"><sw-button variant="primary" size="sm" data-dw-add-save @click=${()=>this.askAdd()}>${d("hlSave")}</sw-button></div>
      </div>`:l}`}renderRow(e){return o`<li data-dw-holiday=${e.date} data-dw-kind=${e.kind} data-dw-source=${e.source}>
      <span><b class="num">${this.dateWord(e.date)}</b> ${e.name_he?o`<span class="muted">${e.name_he}</span>`:l}</span>
      <span class="chips">
        <span class="chip" data-tone=${ht[e.kind]}>${this.kindWord(e.kind)}</span>
        <span class="chip" data-tone=${e.source==="manual"?"warn":"off"}>${d(e.source==="manual"?"hlSrcManual":"hlSrcGenerated")}</span>
        ${e.source==="manual"&&e.generated_kind?o`<span class="chip" data-tone="off">${d("hlWas",{kind:this.kindWord(e.generated_kind)})}</span>`:l}
      </span>
      ${this.canManage?o`<span class="acts">
        <select aria-label=${d("hlColKind")} data-dw-kind-pick @change=${t=>{const a=t.target.value;t.target.value=e.kind,a!==e.kind&&this.askKind(e,a)}}>${X(e).map(t=>o`<option value=${t} ?selected=${e.kind===t}>${this.kindWord(t)}</option>`)}</select>
        ${ft(e)?o`<sw-button size="sm" variant="ghost" icon="refresh" data-dw-reset @click=${()=>this.askReset(e)}>${d(e.generated_kind?"hlReset":"hlRemove")}</sw-button>`:l}
      </span>`:l}
    </li>`}renderPending(){const e=this.pending;return e?o`<sw-dialog open heading=${s("confirmTitle")} @close=${()=>this.pending=null} data-dw-confirm>
      <p>${e.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.pending=null}>${s("cancel")}</sw-button>
        <sw-button variant="primary" data-dw-confirm-btn ?disabled=${this.busy} @click=${()=>void this.confirm()}>${s("confirmBtn")}</sw-button>
      </div>
    </sw-dialog>`:l}};w.styles=[T,F];b([g({type:Boolean})],w.prototype,"open",2);b([g({type:Boolean})],w.prototype,"canManage",2);b([g({type:Boolean})],w.prototype,"canConfigure",2);b([g()],w.prototype,"today",2);b([p()],w.prototype,"cal",2);b([p()],w.prototype,"error",2);b([p()],w.prototype,"busy",2);b([p()],w.prototype,"pending",2);b([p()],w.prototype,"formError",2);b([p()],w.prototype,"add",2);w=b([A("door-holidays")],w);var xt=Object.defineProperty,kt=Object.getOwnPropertyDescriptor,y=(e,t,a,i)=>{for(var r=i>1?void 0:i?kt(t,a):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(r=(i?c(t,a,r):c(r))||r);return i&&r&&xt(t,a,r),r};let v=class extends N{constructor(){super(...arguments),this.open=!1,this.doors=[],this.preset="",this.maxHours=4,this.nowIso="",this.door="",this.hours=1,this.step="choose",this.busy=!1,this.error=""}willUpdate(e){e.has("open")&&this.open&&(this.door=this.doors.find(t=>t.key===this.preset)?.key??this.doors[0]?.key??"",this.hours=1,this.step="choose",this.error="")}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}current(){return this.doors.find(e=>e.key===this.door)}async start(){const e=this.current();if(e){this.busy=!0,this.error="";try{const t=await Oe(e.station_id,e.relay,this.hours*3600),a=t.decision.end_at?_(t.decision.end_at,e.zone):_(ee(this.nowIso||new Date().toISOString(),this.hours),e.zone);this.dispatchEvent(new CustomEvent("notice",{detail:d(t.decision.decision==="extended"?"ofExtended":"ofStarted",{end:a}),bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0})),this.close()}catch(t){const a=vt(t);this.error=a?le(he(a),"reason_other"):m(t),this.step="choose"}finally{this.busy=!1}}}render(){if(!this.open)return l;const e=this.current(),t=e?_(ee(this.nowIso||new Date().toISOString(),this.hours),e.zone):"";return o`<sw-dialog open heading=${d("ofTitle")} @close=${()=>this.close()} data-dw-openfor>
      ${this.doors.length?this.step==="choose"?o`<div class="form">
        <div class="field"><label for="dwo-door">${d("ofDoor")}</label>
          <select id="dwo-door" data-dw-openfor-door @change=${a=>this.door=a.target.value}>
            ${this.doors.map(a=>o`<option value=${a.key} ?selected=${a.key===this.door}>${a.label}</option>`)}</select></div>
        <div class="field"><span class="lbl">${d("ofHours")}</span><sw-chip-choice label=${d("ofHours")} data-dw-openfor-hours value=${String(this.hours)} @change=${a=>this.hours=Number(a.detail.value)}
          .options=${wt(this.maxHours).map(a=>({value:String(a),label:d("ofHoursN",{n:a}),attrs:{"data-dw-hours":String(a)}}))}></sw-chip-choice></div>
        ${this.error?o`<div class="err" role="alert" data-dw-error>${this.error}</div>`:l}
      </div>`:o`<p data-dw-openfor-confirm>${d("ofConfirmText",{door:e?.label??"",end:t})}</p>`:o`<div class="muted" data-dw-openfor-none>${d("ofNoDoors")}</div>`}
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.step==="confirm"?this.step="choose":this.close()}>${s("cancel")}</sw-button>
        ${this.doors.length?this.step==="choose"?o`<sw-button variant="primary" icon="clock" data-dw-openfor-next ?disabled=${!e} @click=${()=>this.step="confirm"}>${d("ofConfirm",{n:this.hours})}</sw-button>`:o`<sw-button variant="primary" data-dw-openfor-go ?disabled=${this.busy} @click=${()=>void this.start()}>${s("confirmBtn")}</sw-button>`:l}
      </div>
    </sw-dialog>`}};v.styles=[T,F];y([g({type:Boolean})],v.prototype,"open",2);y([g({attribute:!1})],v.prototype,"doors",2);y([g()],v.prototype,"preset",2);y([g({type:Number})],v.prototype,"maxHours",2);y([g()],v.prototype,"nowIso",2);y([p()],v.prototype,"door",2);y([p()],v.prototype,"hours",2);y([p()],v.prototype,"step",2);y([p()],v.prototype,"busy",2);y([p()],v.prototype,"error",2);v=y([A("door-open-for")],v);var Et=Object.defineProperty,Ot=Object.getOwnPropertyDescriptor,f=(e,t,a,i)=>{for(var r=i>1?void 0:i?Ot(t,a):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(r=(i?c(t,a,r):c(r))||r);return i&&r&&Et(t,a,r),r};const Dt=15e3,Ct=5e3,St=[0,1,2,3,4,5,6],O="doors.emergency.engine_switch",Tt=["doors.emergency.grant.default_hours","doors.emergency.grant.max_hours","doors.emergency.grant.by_security_manager","doors.emergency.retry_open.by_holders"],Nt=["skip_holidays","holidays_like_friday","ignore_calendar"];let u=class extends N{constructor(){super(...arguments),this.route=null,this.data=null,this.em=null,this.error="",this.forbidden=!1,this.draft=null,this.draftError="",this.preview=null,this.busy=!1,this.confirm=null,this.manual=null,this.sheet=!1,this.grantsOpen=!1,this.holidaysOpen=!1,this.openForOpen=!1,this.openForDoor="",this.toaster=new De(this,{ms:2500}),this.settingsOpen=!1,this.ws=null,this.wsEdit={},this.wLive=!1,this.engineOffAsk=!1,this.es=null,this.esEdit={},this.sError="",this.poll=new Ce(this)}get toast(){return this.toaster.text}connectedCallback(){super.connectedCallback(),K()&&(this.load(),this.poll.every("state",Dt,()=>this.load()),this.poll.every("emergency",Ct,()=>this.loadEmergency()))}async load(){try{this.data=await Se(),this.error=""}catch(e){e instanceof B&&e.status===403?this.forbidden=!0:this.error=m(e)}await this.loadEmergency()}async loadEmergency(){try{this.em=await Te()}catch{this.em=null}}flash(e){this.toaster.show(e)}doorOf(e){return this.data?.doors.find(t=>t.key===e)}today(){return S(this.data?.now??new Date().toISOString(),"Asia/Jerusalem")}async run(e){this.busy=!0;try{await e.run(),this.confirm=null,this.flash(s("done")),await this.load()}catch(t){this.flash(`${s("failed")}: ${m(t)}`)}finally{this.busy=!1}}askRule(e,t){const a={enable:"confirmEnable",pause:"confirmPause",retire:"confirmRetire"};this.confirm={title:s("confirmTitle"),text:s(a[t]),btn:s(t),danger:t==="retire",run:()=>se(e.id,t)}}askOpenFor(e){this.openForDoor=e,this.openForOpen=!0}askEndNow(e){this.confirm={title:s("confirmTitle"),text:s("confirmEndNow",{door:e.label}),btn:s("endNow"),run:()=>Ne(e.id)}}async saveManual(){const e=this.manual;if(!(!e||!e.checked)){this.busy=!0;try{await Ae(e.occ.id,e.checked),this.manual=null,this.flash(s("done")),await this.load()}catch(t){this.flash(`${s("failed")}: ${m(t)}`)}finally{this.busy=!1}}}openEditor(e){this.draft=e?Re(e,this.today()):ze(this.today()),this.draftError="",this.preview=null}patch(e){if(!this.draft)return;const t={...this.draft,doors:new Set(this.draft.doors),days:new Set(this.draft.days),ranges:this.draft.ranges.map(a=>({...a})),perDay:this.draft.perDay?new Map([...this.draft.perDay].map(([a,i])=>[a,i.map(r=>({...r}))])):null};e(t),this.draft=t,this.preview=null,this.draftError=""}problem(){if(!this.draft)return"";const e=Me(this.draft,Number(this.data?.settings.max_hours??4));return e?s(e.key,e.vars):""}async doPreview(){const e=this.problem();if(e||!this.draft){this.draftError=e;return}try{this.preview=await Pe(U(this.draft,!1))}catch(t){this.draftError=m(t)}}save(e){const t=this.problem();if(t||!this.draft){this.draftError=t;return}const a=this.draft,i=async()=>{const r=U(a,e);a.id?await oe(a.id,r):await ie(r),this.draft=null};e?this.confirm={title:s("confirmTitle"),text:s("confirmEnable"),btn:s("saveEnable"),run:i}:this.run({title:"",text:"",btn:"",run:i})}async openSettings(){this.settingsOpen=!0,this.sError="";try{const[e,t]=await Promise.all([He(),Q()]);this.ws=e.settings,this.wsEdit={...e.settings},this.wLive=e.go_live_permitted===!0,this.es=t.settings,this.esEdit=Object.fromEntries(Object.entries(t.settings).filter(([a,i])=>typeof i=="string"&&["doors.emergency.enabled","doors.emergency.open_enabled",O,...Tt].includes(a)))}catch(e){this.sError=m(e)}}async saveSettings(e=!1){if(!this.ws||!this.es)return;const t=this.es;if(!e&&this.esEdit[O]==="off"&&(t[O]??"on")!=="off"){this.engineOffAsk=!0;return}this.busy=!0,this.sError="";try{const a=Object.fromEntries(Object.entries(this.wsEdit).filter(([n,c])=>this.ws[n]!==c));Object.keys(a).length&&(this.ws=(await ne(a)).settings);const i=this.es,r=Object.fromEntries(Object.entries(this.esEdit).filter(([n,c])=>i[n]!==c));Object.keys(r).length&&(this.es=(await Le(r,r[O]==="off")).settings),this.settingsOpen=!1,this.flash(s("saved")),await this.load()}catch(a){this.sError=m(a)}finally{this.busy=!1}}async doAttest(){if(this.es)try{await We(this.es.attestation.version),this.es=(await Q()).settings}catch(e){this.sError=m(e)}}num(e,t,a,i){return o`<div class="field"><label for=${e}>${s(t)}</label><input id=${e} type="text" inputmode="numeric" data-dw-setting=${e}
      .value=${this.wsEdit[e]??""} @input=${r=>{const n=r.target.value.trim();this.wsEdit={...this.wsEdit,[e]:/^\d+$/.test(n)&&Number(n)>=a&&Number(n)<=i?String(Number(n)):n}}}></div>`}hours(e,t,a,i){return o`<div class="field"><label for=${e}>${s(t)}</label><input id=${e} type="text" inputmode="numeric" data-dw-setting=${e}
      .value=${this.esEdit[e]??""} @input=${r=>{const n=r.target.value.trim();this.esEdit={...this.esEdit,[e]:/^\d+$/.test(n)&&Number(n)>=a&&Number(n)<=i?String(Number(n)):n}}}></div>`}check(e,t,a,i=!1,r=""){return o`<label class="occ" data-dw-switch=${r}><input type="checkbox" .checked=${e} ?disabled=${i} @change=${n=>a(n.target.checked)}> ${s(t)}</label>`}renderSettings(){if(!this.settingsOpen)return l;const e=this.wsEdit,t=this.es,a=!!t?.go_live_permitted,i=this.esEdit[O]!=="off",r=t?.build_ready??a;return o`<sw-drawer open modal heading=${s("sTitle")} @close=${()=>this.settingsOpen=!1}>
      <div class="form" data-dw-settings>
        <section><h2>${s("sWindows")}</h2>
          ${this.wLive?l:o`<div class="callout" data-tone="warn" data-dw-programs-golive><sw-icon name="info"></sw-icon><span>${s("sProgramsGoLiveNo")}</span></div>`}
          ${this.check(e["doors.windows.enabled"]==="on","sWindowsOn",n=>this.wsEdit={...e,"doors.windows.enabled":n?"on":"off"},!1,"doors.windows.enabled")}
          ${this.num("doors.windows.max_hours","sMaxHours",1,12)}
          ${this.num("doors.windows.relock_grace_s","sGrace",60,600)}
          ${this.num("doors.windows.relock_retries","sRetries",0,5)}
          ${this.num("doors.windows.reraise_min","sReraise",5,60)}
          ${this.check(e["doors.windows.exterior_allowed"]==="true","sExterior",n=>this.wsEdit={...e,"doors.windows.exterior_allowed":n?"true":"false"},!1,"doors.windows.exterior_allowed")}
        </section>
        ${t?o`<section><h2>${s("sEmergency")}</h2>
          ${r?l:o`<div class="callout" data-tone="warn" data-dw-golive><sw-icon name="info"></sw-icon><span>${s("sGoLiveNo")}</span></div>`}
          ${this.check(i,"sEngineOn",n=>this.esEdit={...this.esEdit,[O]:n?"on":"off"},!1,O)}
          ${i?l:o`<div class="callout" data-tone="warn" data-dw-engine-off><sw-icon name="info"></sw-icon><span>${s("sEngineOffNote")}</span></div>`}
          ${this.check(this.esEdit["doors.emergency.enabled"]==="on","sEmergencyOn",n=>this.esEdit={...this.esEdit,"doors.emergency.enabled":n?"on":"off"},!a,"doors.emergency.enabled")}
          ${this.check(this.esEdit["doors.emergency.open_enabled"]==="on","sOpenOn",n=>this.esEdit={...this.esEdit,"doors.emergency.open_enabled":n?"on":"off"},!a||!t.open_available||!t.attested,"doors.emergency.open_enabled")}
          <div class="card" data-dw-attestation><b>${s("sAttestTitle")}</b><p class="muted">${t.attestation.text}</p>
            ${t.attested?o`<span class="chip" data-tone="ok">${s("sAttested")}</span>`:o`<div><sw-button size="sm" variant="secondary" data-dw-attest @click=${()=>void this.doAttest()}>${s("sAttest")}</sw-button></div>`}</div>
          <h2>${s("sGrants")}</h2>
          ${this.hours("doors.emergency.grant.default_hours","sGrantDefault",0,8760)}
          ${this.hours("doors.emergency.grant.max_hours","sGrantMax",1,8760)}
          ${this.check(this.esEdit["doors.emergency.grant.by_security_manager"]==="on","sGrantManager",n=>this.esEdit={...this.esEdit,"doors.emergency.grant.by_security_manager":n?"on":"off"},!1,"doors.emergency.grant.by_security_manager")}
          ${this.check(this.esEdit["doors.emergency.retry_open.by_holders"]==="on","sRetryHolders",n=>this.esEdit={...this.esEdit,"doors.emergency.retry_open.by_holders":n?"on":"off"},!1,"doors.emergency.retry_open.by_holders")}
        </section>`:l}
        ${this.sError?o`<div class="err" role="alert">${this.sError}</div>`:l}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.settingsOpen=!1}>${s("cancel")}</sw-button>
        <sw-button variant="primary" data-dw-settings-save ?disabled=${this.busy||!this.ws} @click=${()=>void this.saveSettings()}>${s("sSave")}</sw-button>
      </div>
      ${this.renderEngineOffAsk()}
    </sw-drawer>`}renderEngineOffAsk(){return o`${this.engineOffAsk?o`<sw-dialog open heading=${s("sEngineOffTitle")} @close=${()=>this.engineOffAsk=!1} data-dw-engine-off-confirm>
      <p>${s("sEngineOffText")}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.engineOffAsk=!1}>${s("cancel")}</sw-button>
        <sw-button variant="danger" data-dw-engine-off-btn ?disabled=${this.busy} @click=${()=>{this.engineOffAsk=!1,this.saveSettings(!0)}}>${s("sEngineOffBtn")}</sw-button>
      </div>
    </sw-dialog>`:l}`}render(){const e=s("title");if(K()&&this.forbidden)return o`<sw-page heading=${e}><sw-state-panel quiet state="forbidden" heading=${s("noPermission")} data-dw-panel="forbidden"></sw-state-panel></sw-page>`;if(!this.data)return o`<sw-page heading=${e}>${this.error?o`<sw-state-panel quiet state="error" heading=${s("loadError")} actionLabel=${s("retry")} data-dw-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:o`<sw-state-panel quiet state="loading" heading=${s("loading")} data-dw-panel="loading"></sw-state-panel>`}</sw-page>`;const t=this.data,a=this.em,i=!!a&&(a.can.lock||a.can.open);return o`<sw-page wide heading=${e} subheading=${s("sub")} data-dw data-dw-tier=${t.tier} data-dw-enabled=${String(t.enabled)}>
      ${i?o`<sw-button slot="actions" variant="danger" icon="warning" data-dw-emergency @click=${()=>this.sheet=!0}>${s("emergency")}</sw-button>`:l}
      ${t.can.manage?o`<sw-button slot="actions" variant="primary" icon="plus" data-dw-new @click=${()=>this.openEditor()}>${s("newRule")}</sw-button>`:l}
      ${L(t).length?o`<sw-button slot="actions" variant="secondary" icon="clock" data-dw-openfor-btn @click=${()=>this.askOpenFor("")}>${d("ofBtn")}</sw-button>`:l}
      <sw-button slot="actions" variant="ghost" icon="calendar" data-dw-holidays-btn @click=${()=>this.holidaysOpen=!0}>${d("hlBtn")}</sw-button>
      ${Qe(a)?o`<sw-button slot="actions" variant="ghost" icon="user" data-dw-grants-btn @click=${()=>this.grantsOpen=!0}>${s("grBtn")}</sw-button>`:l}
      ${t.can.configure?o`<sw-button slot="actions" variant="ghost" icon="system" data-dw-settings-btn @click=${()=>void this.openSettings()}>${s("settings")}</sw-button>`:l}
      <sw-button slot="actions" variant="ghost" icon="refresh" iconOnly label=${s("refresh")} @click=${()=>void this.load()}></sw-button>
      <div class="stack">
        ${Y(a?.active)?o`<door-emergency-strip .incident=${a.active} .holdMs=${a.hold_ms} @changed=${()=>void this.load()}></door-emergency-strip>`:l}
        ${Y(a?.drill)?o`<door-emergency-strip .incident=${a.drill} .holdMs=${a.hold_ms} @changed=${()=>void this.load()}></door-emergency-strip>`:l}
        ${t.enabled?t.tier==="prepared"?o`<div class="callout" data-tone="warn" data-dw-banner="prepared"><sw-icon name="info"></sw-icon><span><b>${s("preparedTitle")}</b>${s("preparedText")}</span></div>`:l:o`<div class="callout" data-tone="off" data-dw-banner="off"><sw-icon name="info"></sw-icon><span><b>${s("offTitle")}</b>${s("offText")}</span></div>`}
        ${this.renderAlarms()}
        ${this.renderWeek()}
        ${this.renderRules()}
        <door-event-rules .data=${t} @changed=${()=>void this.load()} @notice=${r=>this.flash(r.detail)}></door-event-rules>
      </div>
      ${this.renderEditor()}
      ${this.draft?l:this.renderConfirm()}
      ${this.renderManual()}
      ${this.renderSettings()}
      <door-holidays .open=${this.holidaysOpen} .canManage=${t.can.manage} .canConfigure=${t.can.configure} .today=${this.today()}
        @close=${()=>this.holidaysOpen=!1} @changed=${()=>void this.load()} @notice=${r=>this.flash(r.detail)}></door-holidays>
      <door-open-for .open=${this.openForOpen} .doors=${L(t)} .preset=${this.openForDoor} .maxHours=${j(t.settings).maxHours} .nowIso=${t.now}
        @close=${()=>this.openForOpen=!1} @changed=${()=>void this.load()} @notice=${r=>this.flash(r.detail)}></door-open-for>
      <door-emergency-grants .open=${this.grantsOpen} @close=${()=>this.grantsOpen=!1} @notice=${r=>this.flash(r.detail)}></door-emergency-grants>
      <door-emergency-sheet .open=${this.sheet} .data=${a} @close=${()=>this.sheet=!1} @changed=${()=>void this.loadEmergency()}></door-emergency-sheet>
      ${this.toast?o`<div class="toast" role="status" ${Ie()}>${this.toast}</div>`:l}
    </sw-page>`}renderAlarms(){const e=je(this.data.occurrences);return e.length?o`<section data-dw-alarms><h2>${s("alarmsTitle")}</h2>
      ${e.map(t=>{const a=this.doorOf(t.door);return o`<div class="card alarm" data-dw-alarm=${t.door}>
          <div class="top"><b>${s("alarmTitle")}</b><span class="chip" data-tone="err">${s("occ_relock_unconfirmed")}</span></div>
          <div>${s("alarmText",{door:t.label,end:_(t.end_at,t.zone)})}</div>
          <div class="muted">${t.last_reason==="feed_unavailable"?s("alarmFeed"):s("alarmRetries",{n:t.retries})}</div>
          ${a?.cancel?o`<div><sw-button variant="danger" size="sm" data-dw-manual @click=${()=>this.manual={occ:t,checked:""}}>${s("confirmManual")}</sw-button></div>`:l}
        </div>`})}</section>`:l}occWord(e){return e.state==="closed_confirmed"&&e.resolution&&e.resolution!=="engine_idle"?V(`res_${e.resolution}`,"occ_closed_confirmed"):V(`occ_${e.state}`,"occ_armed",{end:_(e.end_at,e.zone)})}renderWeek(){const e=Be(this.data.occurrences.filter(t=>t.state!=="relock_unconfirmed"),this.data.doors,this.data.now);return o`<section data-dw-week><h2>${s("weekTitle")}</h2>
      ${e.length?e.map(t=>o`<div class="card doorrow" data-dw-door=${t.door.key}>
        <div class="top"><b>${t.door.label}</b><span class="acts">${"exterior"in t.door&&t.door.exterior?o`<span class="chip" data-tone="warn">${s("exterior")}</span>`:l}
          ${L(this.data).some(a=>a.key===t.door.key)?o`<sw-button size="sm" variant="ghost" icon="clock" data-dw-openfor-door-btn @click=${()=>this.askOpenFor(t.door.key)}>${d("ofBtn")}</sw-button>`:l}</span></div>
        ${t.items.slice(0,8).map(a=>o`<div class="occ" data-dw-occ=${a.state}>
          <span class="when">${s(`wd${W(S(a.start_at,a.zone))}`)} ${_(a.start_at,a.zone)}–${_(a.end_at,a.zone)}</span>
          <span class="chip" data-tone=${Ge[a.state]}>${this.occWord(a)}</span>
          ${Fe(a,this.doorOf(a.door))?o`<sw-button size="sm" variant="secondary" data-dw-endnow @click=${()=>this.askEndNow(a)}>${s("endNow")}</sw-button>`:l}
        </div>`)}
      </div>`):o`<div class="muted" data-dw-week-empty>${s("weekEmpty")}</div>`}
    </section>`}hoursOf(e){return o`<div class="hours">${qe(e).map(t=>o`<span>${t.date?t.date:Ke(t.days).map(([a,i])=>a===i?s(`wd${a}`):`${s(`wd${a}`)}–${s(`wd${i}`)}`).join(", ")} · ${t.hours}</span>`)}</div>`}renderRules(){const e=this.data.rules.filter(t=>t.kind!=="event");return o`<section data-dw-rules><h2>${s("rulesTitle")}</h2>
      ${e.length?o`<div class="rules">
        <div class="head"><span>${s("colName")}</span><span>${s("colDoors")}</span><span>${s("colHours")}</span><span>${s("colState")}</span></div>
        ${e.map(t=>o`<div class="card rule" data-dw-rule=${t.id} data-dw-rule-state=${t.state}>
          <div><b>${t.name}</b><div class="muted">${s(`kind_${t.kind}`)}</div></div>
          <div class="chips">${t.doors.filter(a=>a.visible).map(a=>o`<span class="chip">${a.label}</span>`)}</div>
          ${this.hoursOf(t)}
          <div class="acts"><span class="chip" data-tone=${re[t.state]}>${s(`rs_${t.state}`)}</span>
            ${t.manageable?o`
              <sw-button size="sm" variant="ghost" icon="edit" data-dw-edit @click=${()=>this.openEditor(t)}>${s("edit")}</sw-button>
              ${t.state==="enabled"?o`<sw-button size="sm" variant="ghost" icon="pause" data-dw-pause @click=${()=>this.askRule(t,"pause")}>${s("pause")}</sw-button>`:o`<sw-button size="sm" variant="secondary" icon="play" data-dw-enable @click=${()=>this.askRule(t,"enable")}>${s("enable")}</sw-button>`}
              <sw-button size="sm" variant="ghost" icon="trash" data-dw-retire @click=${()=>this.askRule(t,"retire")}>${s("retire")}</sw-button>`:l}
          </div>
        </div>`)}
      </div>`:o`<div class="muted" data-dw-rules-empty>${s("rulesEmpty")} ${this.data.can.manage?s("rulesEmptyManage"):""}</div>`}
    </section>`}renderRanges(e,t){return o`${e.map((a,i)=>o`<div class="range" data-dw-range=${i}>
      <label class="muted">${s("fFrom")} <input type="time" lang=${D()} step="900" .value=${a.start} @change=${r=>t(n=>n[i].start=r.target.value)}></label>
      <label class="muted">${s("fTo")} <input type="time" lang=${D()} step="900" .value=${a.end==="24:00"?"23:59":a.end} @change=${r=>t(n=>n[i].end=r.target.value)}></label>
      ${e.length>1?o`<sw-button size="sm" variant="ghost" icon="trash" iconOnly label=${s("fRemove")} @click=${()=>t(r=>r.splice(i,1))}></sw-button>`:l}
    </div>`)}
    <div><sw-button size="sm" variant="ghost" icon="plus" data-dw-addrange @click=${()=>t(a=>a.push({start:"12:00",end:"13:00"}))}>${s("fAddRange")}</sw-button></div>`}renderEditor(){const e=this.draft;if(!e)return l;const t=this.data.settings.exterior_allowed==="true",a=this.data.doors.filter(r=>r.manage&&(t||!r.exterior)),i=[...new Set(a.map(r=>r.station_name))];return o`<sw-drawer open modal heading=${e.id?s("editorEdit"):s("editorNew")} @close=${()=>this.draft=null}>
      <div class="form" data-dw-editor>
        <div class="field"><label for="dw-name">${s("fName")}</label>
          <input id="dw-name" type="text" maxlength="60" placeholder=${s("fNamePh")} .value=${e.name} @input=${r=>this.patch(n=>n.name=r.target.value)}></div>
        <div class="field"><span class="lbl">${s("fKind")}</span><sw-chip-choice label=${s("fKind")} value=${e.kind} ?disabled=${!!e.id} @change=${r=>this.patch(n=>n.kind=r.detail.value)}
          .options=${["weekly","once"].map(r=>({value:r,label:s(`kind_${r}`),attrs:{"data-dw-kind":r}}))}></sw-chip-choice></div>
        <div class="field"><span class="lbl">${s("fDoors")}</span>
          <div class="doors" data-dw-doors>${i.map(r=>o`${r?o`<div class="st">${r}</div>`:l}
            ${a.filter(n=>n.station_name===r).map(n=>o`<label><input type="checkbox" data-dw-door=${n.key} .checked=${e.doors.has(n.key)}
              @change=${c=>this.patch(h=>c.target.checked?h.doors.add(n.key):h.doors.delete(n.key))}>${n.name}</label>`)}`)}</div>
          <span class="muted">${s("fDoorsHint")}</span></div>
        ${e.kind==="weekly"&&!e.perDay?o`
          <div class="field"><span class="lbl">${s("fDays")}</span><div class="days" role="group">
            ${St.map(r=>o`<button type="button" aria-pressed=${String(e.days.has(r))} data-dw-day=${r}
              @click=${()=>this.patch(n=>n.days.has(r)?n.days.delete(r):n.days.add(r))}>${s(`wd${r}`)}</button>`)}</div></div>
          <div class="field">${this.renderRanges(e.ranges,r=>this.patch(n=>r(n.ranges)))}</div>`:l}
        ${e.kind==="weekly"&&e.perDay?o`${[...e.perDay.entries()].sort((r,n)=>r[0]-n[0]).map(([r,n])=>o`
          <div class="field"><span class="lbl">${s(`wd${r}`)}</span>${this.renderRanges(n,c=>this.patch(h=>c(h.perDay.get(r))))}</div>`)}`:l}
        ${e.kind==="once"?o`
          <div class="field"><label for="dw-date">${s("fDate")}</label><input id="dw-date" type="date" lang=${D()} .value=${e.date} min=${this.today()}
            @change=${r=>this.patch(n=>n.date=r.target.value)}></div>
          <div class="field">${this.renderRanges(e.ranges,r=>this.patch(n=>r(n.ranges)))}</div>`:l}
        ${e.kind==="weekly"?o`<div class="field"><label for="dw-cal">${s("fCalendar")}</label>
          <select id="dw-cal" @change=${r=>this.patch(n=>n.calendar=r.target.value)}>
            ${Nt.map(r=>o`<option value=${r} ?selected=${e.calendar===r}>${s(`cal_${r}`)}</option>`)}</select></div>`:l}
        ${this.preview?o`<div class="preview card" data-dw-preview><b>${s("previewTitle")}</b>
          <span class="muted">${this.preview.tier==="prepared"?s("previewPrepared"):s("previewEngine")}</span>
          ${this.preview.doors.map(r=>o`<div><b>${r.label}</b>
            ${r.occurrences.length?o`<ul class="lines">${r.occurrences.map(n=>o`<li><span>${s(`wd${W(S(n.start_at,r.zone))}`)} ${S(n.start_at,r.zone)}</span>
              <span>${_(n.start_at,r.zone)}–${_(n.end_at,r.zone)}</span></li>`)}</ul>`:o`<div class="muted">${s("previewNone")}</div>`}</div>`)}
        </div>`:l}
        ${this.draftError?o`<div class="err" role="alert" data-dw-error>${this.draftError}</div>`:l}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" data-dw-preview-btn @click=${()=>void this.doPreview()}>${s("preview")}</sw-button>
        <sw-button variant="secondary" data-dw-save-draft ?disabled=${this.busy} @click=${()=>this.save(!1)}>${s("saveDraft")}</sw-button>
        <sw-button variant="primary" data-dw-save-enable ?disabled=${this.busy} @click=${()=>this.save(!0)}>${s("saveEnable")}</sw-button>
      </div>
      ${this.renderConfirm()}
    </sw-drawer>`}renderConfirm(){const e=this.confirm;return e?o`<sw-dialog open heading=${e.title} @close=${()=>this.confirm=null} data-dw-confirm>
      <p>${e.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.confirm=null}>${s("cancel")}</sw-button>
        <sw-button variant=${e.danger?"danger":"primary"} data-dw-confirm-btn ?disabled=${this.busy} @click=${()=>void this.run(e)}>${e.btn}</sw-button>
      </div>
    </sw-dialog>`:l}renderManual(){const e=this.manual;return e?o`<sw-dialog open heading=${s("manualTitle")} @close=${()=>this.manual=null} data-dw-manual-dialog>
      <p>${s("manualText")}</p>
      <div class="radio" role="radiogroup">
        ${["camera","door"].map(t=>o`<label><input type="radio" name="checked" data-dw-checked=${t} .checked=${e.checked===t}
          @change=${()=>this.manual={...e,checked:t}}> ${s(t==="camera"?"manualCamera":"manualDoor")}</label>`)}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.manual=null}>${s("cancel")}</sw-button>
        <sw-button variant="danger" data-dw-manual-confirm ?disabled=${!e.checked||this.busy} @click=${()=>void this.saveManual()}>${s("manualBtn")}</sw-button>
      </div>
    </sw-dialog>`:l}};u.styles=[T,Ue,ae`
    :host { display: block; }
    .stack { display: grid; gap: 16px; } /* round 2 loop 2: the larger titles cost 26 px of inner scroll at 1440x900 - the stack gap and the card padding give it back */
    section { display: grid; gap: 10px; }
    /* round 2: section titles one step larger and tight; the cards carry the lit top edge of the elevation ladder; a card title is a real heading */
    h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); letter-spacing: -0.01em; color: var(--sw-text); }
    .card { display: grid; gap: 8px; padding: 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0; }
    .card.alarm { border-color: var(--sw-danger); background: var(--sw-danger-soft); }
    .card .top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
    .card .top b { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); letter-spacing: -0.01em; overflow-wrap: anywhere; }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .doorrow { display: grid; gap: 8px; }
    .occ { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .occ .when { font-variant-numeric: tabular-nums; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 7.5em; }
    .rules { display: grid; gap: 10px; }
    .rule { display: grid; gap: 8px; }
    .rule .hours { display: grid; gap: 2px; font-size: var(--sw-fs-sm); font-variant-numeric: tabular-nums; }
    .rule .acts, .card .top .acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    @media (min-width: 900px) {
      .rule { grid-template-columns: minmax(10em, 1.2fr) minmax(10em, 1.4fr) minmax(9em, 1fr) auto; align-items: center; }
      .rules .head { display: grid; grid-template-columns: minmax(10em, 1.2fr) minmax(10em, 1.4fr) minmax(9em, 1fr) auto; padding-inline: 14px;
        font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); text-transform: none; }
    }
    @media (max-width: 899px) { .rules .head { display: none; } }
    .form { display: grid; gap: 14px; }
    .field { display: grid; gap: 6px; }
    .field > label, .field > .lbl { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); }
    input[type='text'], input[type='date'], input[type='time'], select, textarea {
      font: inherit; padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text);
      min-inline-size: 0;
    }
    /* POLISH-CONTROL-297: a field shows where the keyboard is (there was no focus style); a choice button answers the press and the
       keyboard, hover is for fine pointers only (transform and colour, token durations - zero under reduced motion) */
    input[type='text']:focus-visible, input[type='date']:focus-visible, input[type='time']:focus-visible, select:focus-visible, textarea:focus-visible {
      outline: none; border-color: var(--sw-accent); box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .days button {
      font: inherit; padding: 6px 12px; min-block-size: 32px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); cursor: pointer;
      transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .days button:active { transform: scale(0.97); }
    .days button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    @media (hover: hover) and (pointer: fine) {
      .days button:hover:not([aria-pressed='true']) { border-color: var(--sw-border-strong); background: var(--sw-surface-2); }
    }
    @media (pointer: coarse) { .days button { min-block-size: 44px; } }
    /* CR-CMP2-SEGMENTED-C-2450: the kind choice is sw-chip-choice (the same chip look); the days stay a multi-choice row here */
    .days button[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .days { display: flex; flex-wrap: wrap; gap: 6px; }
    .range { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .doors { display: grid; gap: 4px; max-block-size: 260px; overflow: auto; padding: 4px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); }
    .doors label { display: flex; gap: 8px; align-items: center; padding: 4px 6px; border-radius: var(--sw-r-sm); }
    .doors .st { font-size: var(--sw-fs-xs); color: var(--sw-text-3); padding: 6px 6px 0; }
    ${te}
    .footer { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .preview { display: grid; gap: 8px; }
    .radio { display: grid; gap: 6px; }
    /* the toast is the product's toast (its own tokens, above the phone's bottom bar) and rises in instead of popping (zero under reduced motion) */
    .toast { position: fixed; inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 18px); inset-inline: 0; margin-inline: auto; inline-size: fit-content; max-inline-size: calc(100% - 32px); padding: 8px 16px; border-radius: var(--sw-r-pill);
      background: var(--sw-toast-bg, var(--sw-text)); color: var(--sw-toast-text, var(--sw-surface)); font-size: var(--sw-fs-sm); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2);
      opacity: 1; transform: translateY(0); transition: opacity var(--sw-t-med) var(--sw-ease), transform var(--sw-t-med) var(--sw-ease); }
    @starting-style { .toast { opacity: 0; transform: translateY(8px); } }
  `];f([g({attribute:!1})],u.prototype,"route",2);f([p()],u.prototype,"data",2);f([p()],u.prototype,"em",2);f([p()],u.prototype,"error",2);f([p()],u.prototype,"forbidden",2);f([p()],u.prototype,"draft",2);f([p()],u.prototype,"draftError",2);f([p()],u.prototype,"preview",2);f([p()],u.prototype,"busy",2);f([p()],u.prototype,"confirm",2);f([p()],u.prototype,"manual",2);f([p()],u.prototype,"sheet",2);f([p()],u.prototype,"grantsOpen",2);f([p()],u.prototype,"holidaysOpen",2);f([p()],u.prototype,"openForOpen",2);f([p()],u.prototype,"openForDoor",2);f([p()],u.prototype,"settingsOpen",2);f([p()],u.prototype,"ws",2);f([p()],u.prototype,"wsEdit",2);f([p()],u.prototype,"wLive",2);f([p()],u.prototype,"engineOffAsk",2);f([p()],u.prototype,"es",2);f([p()],u.prototype,"esEdit",2);f([p()],u.prototype,"sError",2);u=f([A("door-windows-screen")],u);export{u as DoorWindowsScreen};
