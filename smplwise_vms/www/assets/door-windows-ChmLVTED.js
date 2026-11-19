import{bA as fe,ui as T,ax as $,j as p,i as A,uj as me,n as m,a as j,uk as we,ul as a,um as ve,un as ge,A as l,aI as $e,b as o,ek as D,k as N,cE as be,uo as ye,bH as _e,up as q,uq as C,c$ as te,g as se,ur as ae,us as xe,ut as ke,uu as S,uv as _,uw as re,ux as oe,uy as ne,uz as Ee,uA as W,uB as P,uC as ie,uD as Oe,eD as De,eR as Ce,a2 as U,uE as Se,uF as Te,uG as Ae,uH as Ne,uI as ze,uJ as Re,uK as Me,uL as Pe,uM as K,uN as He,uO as Q,uP as Le,uQ as We,uR as Y,e2 as Ie,uS as Be,uT as V,uU as je,uV as Ge,uW as Fe,uX as qe,uY as Ue,bh as Ke}from"./index-DkcUEx2W.js";import"./sw-logo-art-PLtEZJxU.js";function Qe(e){return!!e&&e.can.grant===!0}const R=e=>String(e).padStart(2,"0");function Ye(e){return`${e.getFullYear()}-${R(e.getMonth()+1)}-${R(e.getDate())}T${R(e.getHours())}:${R(e.getMinutes())}`}function Ve(e,t){return t>0?Ye(new Date(e.getTime()+t*36e5)):""}function de(e){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e))return null;const t=new Date(e);return Number.isNaN(t.getTime())?null:fe(t)}function Je(e,t,s,n,r){if(!t)return"person";if(n)return e.can_no_expiry?null:"expiry_required";const i=de(s);if(!i)return"expiry_required";const c=new Date(i).getTime();return c<=r.getTime()?"expiry_past":!e.can_no_expiry&&c>r.getTime()+e.max_hours*36e5?"expiry_too_long":null}var Ze=Object.defineProperty,Xe=Object.getOwnPropertyDescriptor,k=(e,t,s,n)=>{for(var r=n>1?void 0:n?Xe(t,s):t,i=e.length-1,c;i>=0;i--)(c=e[i])&&(r=(n?c(t,s,r):c(r))||r);return n&&r&&Ze(t,s,r),r};let g=class extends A{constructor(){super(...arguments),this.open=!1,this.view=null,this.person="",this.place="installation:*",this.expiry="",this.noExpiry=!1,this.revoking="",this.busy=!1,this.error=""}willUpdate(e){e.has("open")&&this.open&&this.load()}async load(){this.error="";try{this.view=await me(),this.expiry=Ve(new Date,this.view.default_hours),this.noExpiry=this.view.default_hours===0&&this.view.can_no_expiry;const e=this.view.scopes[0];this.place=e?`${e.scope_type}:${e.scope_id}`:""}catch(e){this.error=m(e)}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}fail(e){const t=e instanceof j?`grErr_${e.code}`:"";this.error=we.includes(t)?a(t):m(e)}async give(){if(!this.view)return;const e=this.place.indexOf(":");this.busy=!0,this.error="";try{await ve(this.person,{scope_type:this.place.slice(0,e),scope_id:this.place.slice(e+1)},de(this.expiry),this.noExpiry),this.person="",this.dispatchEvent(new CustomEvent("notice",{detail:a("grGranted"),bubbles:!0,composed:!0})),await this.load()}catch(t){this.fail(t)}finally{this.busy=!1}}async take(e){this.busy=!0,this.error="";try{await ge(e),this.revoking="",this.dispatchEvent(new CustomEvent("notice",{detail:a("grRevoked"),bubbles:!0,composed:!0})),await this.load()}catch(t){this.fail(t)}finally{this.busy=!1}}render(){if(!this.open)return l;const e=this.view,t=e?Je(e,this.person,this.expiry,this.noExpiry,new Date):"person";return o`<sw-drawer open modal heading=${a("grTitle")} @close=${()=>this.close()} data-dw-grants>
      ${e?o`<div class="form">
        <section>
          <ul class="lines" data-dw-grants-list>
            ${e.holders.length?e.holders.map(s=>o`<li data-dw-grant=${s.id}>
              <span><b>${s.name}</b> · ${s.scope_name}</span>
              <span>${s.expires_at?a("grUntil",{when:$e(s.expires_at)}):a("grNoExpiry")}</span>
              ${this.revoking===s.id?o`<sw-button size="sm" variant="danger" data-dw-grant-revoke-confirm ?disabled=${this.busy} @click=${()=>void this.take(s.id)}>${a("grRevokeConfirm")}</sw-button>`:o`<sw-button size="sm" variant="ghost" data-dw-grant-revoke @click=${()=>this.revoking=s.id}>${a("grRevoke")}</sw-button>`}
            </li>`):o`<li data-dw-grants-none><span>${a("grNone")}</span></li>`}
          </ul>
        </section>
        <section>
          <div class="field"><label for="dwg-person">${a("grPerson")}</label>
            <select id="dwg-person" data-dw-grant-person @change=${s=>this.person=s.target.value}>
              <option value="" ?selected=${this.person===""}>${a("grChoose")}</option>
              ${e.candidates.map(s=>o`<option value=${s.id} ?selected=${s.id===this.person}>${s.name}</option>`)}</select></div>
          ${e.scopes.length>1?o`<div class="field"><label for="dwg-place">${a("grPlace")}</label>
            <select id="dwg-place" data-dw-grant-place @change=${s=>this.place=s.target.value}>
              ${e.scopes.map(s=>o`<option value=${`${s.scope_type}:${s.scope_id}`} ?selected=${`${s.scope_type}:${s.scope_id}`===this.place}>${s.name}</option>`)}</select></div>`:l}
          <div class="field"><label for="dwg-expiry">${a("grExpiry")}</label>
            <input id="dwg-expiry" type="datetime-local" lang=${D()} data-dw-grant-expiry .value=${this.expiry} ?disabled=${this.noExpiry}
              @input=${s=>this.expiry=s.target.value}></div>
          ${e.can_no_expiry?o`<label class="occ"><input type="checkbox" data-dw-grant-noexpiry .checked=${this.noExpiry}
            @change=${s=>this.noExpiry=s.target.checked}> ${a("grNoExpiry")}</label>`:l}
        </section>
      </div>`:l}
      ${this.error?o`<div class="err" role="alert" data-dw-grants-error>${this.error}</div>`:l}
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.close()}>${a("cancel")}</sw-button>
        <sw-button variant="primary" data-dw-grant-add ?disabled=${this.busy||!e||t!==null} @click=${()=>void this.give()}>${a("grAdd")}</sw-button>
      </div>
    </sw-drawer>`}};g.styles=[T];k([$({type:Boolean})],g.prototype,"open",2);k([p()],g.prototype,"view",2);k([p()],g.prototype,"person",2);k([p()],g.prototype,"place",2);k([p()],g.prototype,"expiry",2);k([p()],g.prototype,"noExpiry",2);k([p()],g.prototype,"revoking",2);k([p()],g.prototype,"busy",2);k([p()],g.prototype,"error",2);g=k([N("door-emergency-grants")],g);const G={kind_event:["לפי אירוע","By event","حسب حدث","По событию"],evSection:["חלונות לפי אירוע","Event windows","نوافذ حسب الحدث","Окна по событию"],evNew:["כלל אירוע חדש","New event rule","قاعدة حدث جديدة","Новое правило по событию"],evEditorNew:["כלל אירוע חדש","New event rule","قاعدة حدث جديدة","Новое правило по событию"],evEditorEdit:["עריכת כלל אירוע","Edit event rule","تعديل قاعدة الحدث","Правка правила по событию"],evEmpty:["עוד לא הוגדרו כללי אירוע.","No event rules yet.","لم تُحدَّد قواعد حدث بعد.","Правил по событию пока нет."],src_label:["מקור האירוע","Event source","مصدر الحدث","Источник события"],src_ha_event:["אירוע חיצוני","External event","حدث خارجي","Внешнее событие"],src_arx_automation:["אוטומציה","Automation","أتمتة","Автоматизация"],src_arx_button:["כפתור במסך","Button on screen","زر على الشاشة","Кнопка на экране"],fAutomation:["מזהה האוטומציה","Automation id","معرّف الأتمتة","Идентификатор автоматизации"],fAutomationPh:["automation.entrance_button","automation.entrance_button","automation.entrance_button","automation.entrance_button"],fDurationMin:["משך החלון (דקות)","Window length (minutes)","مدة النافذة (دقائق)","Длительность окна (мин)"],fAllowedFrom:["מותר משעה","Allowed from","مسموح من","Разрешено с"],fAllowedTo:["עד שעה","Until","حتى","До"],fAllowedAll:["בכל שעה","Any hour","في أي ساعة","В любое время"],fAllowedLimit:["הגבלת שעות","Limit the hours","تحديد الساعات","Ограничить часы"],fMaxPerDay:["הפעלות ביום לדלת","Starts per door per day","مرات التشغيل لكل باب يوميًا","Запусков на дверь в день"],fCooldownMin:["המתנה בין הפעלות (דקות)","Wait between starts (minutes)","الانتظار بين مرات التشغيل (دقائق)","Пауза между запусками (мин)"],fRegenerate:["קוד חדש בשמירה","New code on save","رمز جديد عند الحفظ","Новый код при сохранении"],capDay:["תקרה ליום: {n}","Day cap: {n}","الحد اليومي: {n}","Лимит в день: {n}"],capStorm:["תקרת סערה: {n} בשעה","Storm cap: {n} per hour","حد العاصفة: {n} في الساعة","Лимит всплеска: {n} в час"],capQuiet:["שעות שקטות {from}–{to}","Quiet hours {from}–{to}","ساعات الهدوء {from}–{to}","Тихие часы {from}–{to}"],capCooldown:["המתנה {n} דק׳","Wait {n} min","انتظار {n} د","Пауза {n} мин"],capLength:["משך {n} דק׳","Length {n} min","المدة {n} د","Длина {n} мин"],capHours:["{from}–{to}","{from}–{to}","{from}–{to}","{from}–{to}"],errSource:["בחרו מקור לאירוע.","Choose an event source.","اختر مصدر الحدث.","Выберите источник события."],errAutomation:["הזינו מזהה אוטומציה בצורה automation.name","Enter an automation id like automation.name","أدخل معرّف أتمتة بالشكل automation.name","Введите идентификатор вида automation.name"],errDuration:["משך החלון חייב להיות בין דקה ל־{h} שעות.","The length must be between one minute and {h} h.","يجب أن تكون المدة بين دقيقة و{h} ساعات.","Длительность — от минуты до {h} ч."],errAllowed:["שעת הסיום חייבת להיות אחרי שעת ההתחלה.","The end must be after the start.","يجب أن تكون النهاية بعد البداية.","Конец должен быть позже начала."],errQuiet:["הטווח נוגע בשעות השקטות.","The range touches the quiet hours.","النطاق يلامس ساعات الهدوء.","Диапазон задевает тихие часы."],errCap:["מספר ההפעלות ליום: 1 עד {n}.","Starts per day: 1 to {n}.","مرات التشغيل يوميًا: من 1 إلى {n}.","Запусков в день: от 1 до {n}."],errCooldown:["ההמתנה: 0 עד 1440 דקות.","The wait: 0 to 1440 minutes.","الانتظار: من 0 إلى 1440 دقيقة.","Пауза: от 0 до 1440 мин."],arm_simulate:["מדומה","Simulated","محاكاة","Имитация"],arm_armed:["פעיל","Armed","مفعّل","Включено"],arm_unavailable:["הפעלה אמיתית אינה זמינה","Arming is not available","التفعيل الفعلي غير متاح","Боевой режим недоступен"],armBtn:["הפעלה אמיתית","Arm","تفعيل فعلي","Включить"],disarmBtn:["חזרה לסימולציה","Back to simulation","العودة إلى المحاكاة","Назад к имитации"],confirmArm:["הכלל יפתח דלתות באמת כשהאירוע יגיע. הפעולה נרשמת על שמך.","The rule will really open doors when the event arrives. This is recorded in your name.","ستفتح القاعدة الأبواب فعلًا عند وصول الحدث. يُسجَّل ذلك باسمك.","Правило будет реально открывать двери при событии. Запись — на ваше имя."],confirmDisarm:["הכלל יחזור לסימולציה: אירוע יירשם אבל דלת לא תיפתח.","The rule returns to simulation: events are logged, no door opens.","تعود القاعدة إلى المحاكاة: يُسجَّل الحدث ولا يُفتح باب.","Правило вернётся к имитации: события пишутся, двери не открываются."],armRefused:["ההפעלה האמיתית נדחתה: אין עדיין זהות אוטומציה מאומתת.","Arming was refused: there is no verified automation identity yet.","رُفض التفعيل: لا توجد هوية أتمتة موثّقة بعد.","Включение отклонено: проверенной учётной записи автоматизации пока нет."],tokenTitle:["קוד האירוע מוצג פעם אחת","The event code is shown once","يُعرض رمز الحدث مرة واحدة","Код события показывается один раз"],tokenCopy:["העתקה","Copy","نسخ","Копировать"],tokenCopied:["הועתק","Copied","تم النسخ","Скопировано"],tokenNew:["קוד חדש","New code","رمز جديد","Новый код"],tokenHas:["קיים קוד","Code set","الرمز موجود","Код задан"],confirmToken:["הקוד הקודם יפסיק לעבוד מיד והכלל יחזור לסימולציה.","The old code stops working at once and the rule returns to simulation.","يتوقف الرمز القديم فورًا وتعود القاعدة إلى المحاكاة.","Старый код перестанет работать сразу, правило вернётся к имитации."],logTitle:["הפעלות אחרונות","Recent starts","آخر مرات التشغيل","Последние запуски"],logEmpty:["עוד לא היו הפעלות.","No starts yet.","لا توجد تشغيلات بعد.","Запусков пока не было."],dec_started:["נפתח","Started","بدأ","Запущено"],dec_extended:["הוארך","Extended","مُدِّد","Продлено"],dec_simulated:["סימולציה","Simulated","محاكاة","Имитация"],dec_refused:["נדחה","Refused","مرفوض","Отклонено"],reason_storm:["יותר מדי הפעלות בשעה","Too many starts in an hour","تشغيلات كثيرة في الساعة","Слишком много запусков в час"],reason_exterior_not_allowed:["דלת חיצונית","Exterior door","باب خارجي","Наружная дверь"],reason_closed_day:["יום סגור","Closed day","يوم مغلق","Закрытый день"],reason_outside_hours:["מחוץ לשעות המותרות","Outside the allowed hours","خارج الساعات المسموحة","Вне разрешённых часов"],reason_too_long:["ארוך מהמותר","Longer than allowed","أطول من المسموح","Дольше разрешённого"],reason_crosses_midnight:["חוצה חצות","Crosses midnight","يتجاوز منتصف الليل","Пересекает полночь"],reason_ambiguous_time:["שעה לא חד־משמעית","Ambiguous time","وقت غير واضح","Неоднозначное время"],reason_quiet_hours:["שעות שקטות","Quiet hours","ساعات الهدوء","Тихие часы"],reason_relock_unconfirmed:["חזרה לרגיל טרם אושרה","Return to normal not confirmed","العودة إلى الوضع العادي لم تُؤكَّد","Возврат в обычный режим не подтверждён"],reason_emergency:["מצב חירום","Emergency","حالة طوارئ","Аварийный режим"],reason_paused:["הופסק ידנית","Paused by a person","أُوقف يدويًا","Остановлено вручную"],reason_inside_window:["כבר בחלון","Already in a window","داخل نافذة بالفعل","Уже в окне"],reason_overlaps_window:["חופף חלון","Overlaps a window","يتداخل مع نافذة","Пересекается с окном"],reason_already_covered:["כבר פתוח עד אז","Already open until then","مفتوح بالفعل حتى ذلك الحين","Уже открыто до этого времени"],reason_would_extend_running:["הארכת חלון שרץ כבויה","Extending a running window is off","تمديد نافذة جارية متوقف","Продление идущего окна выключено"],reason_extended_already:["כבר הוארך פעם","Already extended once","مُدِّد مرة بالفعل","Уже продлено один раз"],reason_would_extend:["היה מאריך","Would extend","كان سيمدّد","Продлило бы"],reason_daily_cap:["תקרה יומית","Day cap","الحد اليومي","Дневной лимит"],reason_rule_daily_cap:["תקרה יומית של הכלל","Rule day cap","الحد اليومي للقاعدة","Дневной лимит правила"],reason_cooldown:["בהמתנה","Cooling down","قيد الانتظار","Пауза"],reason_unknown_rule:["כלל לא מוכר","Unknown rule","قاعدة غير معروفة","Неизвестное правило"],reason_bad_token:["קוד שגוי","Wrong code","رمز خاطئ","Неверный код"],reason_item_changed:["האוטומציה השתנתה","The automation changed","تغيّرت الأتمتة","Автоматизация изменилась"],reason_authorising_actor_lost:["המאשר איבד הרשאה","The approver lost access","فقد المُعتمِد صلاحيته","У утвердившего пропал доступ"],reason_already_handled:["כבר טופל","Already handled","تمت معالجته","Уже обработано"],reason_other:["נדחה","Refused","مرفوض","Отклонено"],hlBtn:["חגים","Holidays","العطل","Праздники"],hlTitle:["חגים וימים מיוחדים","Holidays and special days","العطل والأيام الخاصة","Праздники и особые дни"],hlEmpty:["אין ימים מיוחדים ברשימה.","No special days in the list.","لا أيام خاصة في القائمة.","В списке нет особых дней."],hlGenerator:["רשימת החגים","Holiday list","قائمة العطل","Список праздников"],gen_israel:["חגי ישראל","Israeli holidays","الأعياد الإسرائيلية","Праздники Израиля"],gen_none:["ללא רשימה","No list","بلا قائمة","Без списка"],hlColDate:["תאריך","Date","التاريخ","Дата"],hlColName:["שם","Name","الاسم","Название"],hlColKind:["סוג היום","Day type","نوع اليوم","Тип дня"],hlColSource:["מקור","Source","المصدر","Источник"],dk_holiday:["חג","Holiday","عيد","Праздник"],dk_holiday_eve:["ערב חג","Holiday eve","ليلة العيد","Канун праздника"],dk_regular:["יום רגיל","Regular day","يوم عادي","Обычный день"],dk_closed:["סגור","Closed","مغلق","Закрыто"],hlSrcGenerated:["מהרשימה","From the list","من القائمة","Из списка"],hlSrcManual:["שונה ידנית","Changed by hand","عُدِّل يدويًا","Изменено вручную"],hlWas:["ברירת מחדל: {kind}","Default: {kind}","الافتراضي: {kind}","По умолчанию: {kind}"],hlReset:["שחזור ברירת מחדל","Restore default","استعادة الافتراضي","Вернуть по умолчанию"],hlRemove:["הסרה","Remove","إزالة","Убрать"],hlAdd:["הוספת יום","Add a day","إضافة يوم","Добавить день"],hlLabel:["שם היום","Day name","اسم اليوم","Название дня"],hlSave:["שמירה","Save","حفظ","Сохранить"],hlLoading:["טוען את רשימת החגים…","Loading the holiday list…","جارٍ تحميل قائمة العطل…","Загрузка списка праздников…"],hlLoadError:["לא ניתן לטעון את רשימת החגים","The holiday list could not be loaded","تعذّر تحميل قائمة العطل","Не удалось загрузить список праздников"],hlConfirm:["{date}: {kind}. השינוי משפיע על פתיחת דלתות בתאריך הזה.","{date}: {kind}. This changes when doors open on that date.","{date}: {kind}. هذا يغيّر موعد فتح الأبواب في هذا التاريخ.","{date}: {kind}. Это меняет открытие дверей в эту дату."],hlConfirmReset:["{date} יחזור לברירת המחדל של הרשימה.","{date} returns to the list default.","يعود {date} إلى الافتراضي في القائمة.","{date} вернётся к значению списка."],hlConfirmGenerator:["רשימת החגים תשתנה: {name}. זה משפיע על כל החלונות.","The holiday list changes: {name}. This affects every window.","ستتغير قائمة العطل: {name}. هذا يؤثر على كل النوافذ.","Список праздников изменится: {name}. Это влияет на все окна."],errHlDate:["בחרו תאריך.","Choose a date.","اختر تاريخًا.","Выберите дату."],ofBtn:["פתיחה לזמן קצוב","Open for hours","فتح لعدة ساعات","Открыть на часы"],ofTitle:["פתיחת דלת לזמן קצוב","Open a door for a set time","فتح باب لمدة محددة","Открыть дверь на заданное время"],ofDoor:["דלת","Door","الباب","Дверь"],ofHours:["שעות","Hours","ساعات","Часы"],ofHoursN:["{n} ש׳","{n} h","{n} س","{n} ч"],ofConfirm:["פתיחה ל־{n} שעות","Open for {n} h","فتح لمدة {n} ساعات","Открыть на {n} ч"],ofConfirmText:["{door} תוחזק פתוחה עד {end}, ואז תחזור למצב רגיל. הפעולה נרשמת על שמך.","{door} stays open until {end}, then returns to normal. This is recorded in your name.","يبقى {door} مفتوحًا حتى {end} ثم يعود إلى الوضع العادي. يُسجَّل ذلك باسمك.","{door} останется открытой до {end}, затем вернётся в обычный режим. Запись — на ваше имя."],ofStarted:["החלון נפתח עד {end}","Window open until {end}","النافذة مفتوحة حتى {end}","Окно открыто до {end}"],ofExtended:["החלון הוארך עד {end}","Window extended to {end}","مُدِّدت النافذة حتى {end}","Окно продлено до {end}"],ofNoDoors:["אין דלתות שמותר לך לנהל.","No doors you may manage.","لا أبواب يمكنك إدارتها.","Нет дверей, которыми вы можете управлять."]},et=Object.keys(G),tt={he:0,en:1,ar:2,ru:3},I=["he","en","ar","ru"].reduce((e,t)=>(e[t]=Object.fromEntries(et.map(s=>[s,G[s][tt[t]]])),e),{});function d(e,t,s=ye()){const n=I[s][e]??I.he[e]??e;return be(n,t)}function le(e,t,s){return e in G?d(e,s):d(t,s)}_e("i18n/door-windows-events",I,["ar","ru"]);const st=20,at=1,ce=["ha_event","arx_automation"],rt=/^automation\.[a-z0-9_]{1,80}$/;function B(e){const t=(s,n)=>/^\d+$/.test(e[s]??"")?Number(e[s]):n;return{maxHours:t("max_hours",4),maxPerDay:t("max_per_day_per_door",3),quiet:[e.quiet_from??"22:00",e.quiet_to??"06:00"]}}function pe(){return{id:null,revision:null,name:"",source:"ha_event",doors:new Set,durationMin:"60",limitHours:!1,from:"08:00",to:"18:00",maxPerDay:"1",cooldownMin:"15",automationId:"",regenerate:!1,calendar:"skip_holidays"}}function ot(e){const t=pe(),s=e.trigger;return t.id=e.id,t.revision=e.revision,t.name=e.name,t.doors=new Set(e.doors.map(n=>n.key)),t.calendar=e.calendar_policy,s&&(t.source=s.source,t.durationMin=String(Math.round(s.duration_s/60)),t.limitHours=!!(s.allowed_from&&s.allowed_to),t.from=s.allowed_from??t.from,t.to=s.allowed_to??t.to,t.maxPerDay=String(s.max_per_day),t.cooldownMin=String(Math.round(s.cooldown_s/60)),t.automationId=s.automation_id??""),t}const nt=(e,t,s)=>{const n=C(s[0]),r=C(s[1]);return n===r?!1:(n<r?[[n,r]]:[[n,1440],[0,r]]).some(([c,u])=>C(e)<u&&c<C(t))},H=e=>/^\d+$/.test(e.trim())?Number(e.trim()):null;function it(e,t){if(!e.name.trim())return{scope:"dwt",key:"errName"};if(!e.doors.size)return{scope:"dwt",key:"errDoors"};if(!ce.includes(e.source))return{scope:"dwe",key:"errSource"};if(e.source==="arx_automation"&&!rt.test(e.automationId.trim()))return{scope:"dwe",key:"errAutomation"};const s=H(e.durationMin);if(s===null||s<at||s>t.maxHours*60)return{scope:"dwe",key:"errDuration",vars:{h:t.maxHours}};if(e.limitHours){if(!q.test(e.from)||!(q.test(e.to)||e.to==="24:00")||C(e.to)<=C(e.from))return{scope:"dwe",key:"errAllowed"};if(nt(e.from,e.to,t.quiet))return{scope:"dwe",key:"errQuiet"}}const n=H(e.maxPerDay);if(n===null||n<1||n>t.maxPerDay)return{scope:"dwe",key:"errCap",vars:{n:t.maxPerDay}};const r=H(e.cooldownMin);return r===null||r>1440?{scope:"dwe",key:"errCooldown"}:null}function dt(e,t){const s=[...e.doors].map(n=>{const r=n.lastIndexOf(":");return{station_id:n.slice(0,r),relay:Number(n.slice(r+1))}});return{name:e.name.trim(),kind:"event",calendar_policy:e.calendar,notes:"",doors:s,periods:[],trigger:{source:e.source,duration_s:Number(e.durationMin.trim())*60,allowed_from:e.limitHours?e.from:null,allowed_to:e.limitHours?e.to:null,max_per_day:Number(e.maxPerDay.trim()),cooldown_s:Number(e.cooldownMin.trim())*60,automation_id:e.source==="arx_automation"?e.automationId.trim():null,...e.id&&e.source==="ha_event"&&e.regenerate?{regenerate_token:!0}:{}},...e.revision!==null?{revision:e.revision}:{},enable:t}}function lt(e,t,s){const n=e.arm_state==="armed",r=e.can_arm&&s!==!1;return{state:n?"arm_armed":"arm_simulate",tone:n?"ok":"warn",unavailable:!n&&!r,action:t?n?"disarm":r?"arm":null:null}}function J(e){return e.filter(t=>t.kind==="event"&&!!t.trigger)}function ct(e){return[{key:"capLength",vars:{n:Math.round(e.duration_s/60)}},...e.allowed_from&&e.allowed_to?[{key:"capHours",vars:{from:e.allowed_from,to:e.allowed_to}}]:[],{key:"capDay",vars:{n:e.max_per_day}},{key:"capCooldown",vars:{n:Math.round(e.cooldown_s/60)}}]}const pt={started:"ok",extended:"ok",simulated:"warn",refused:"err"},ue=e=>`reason_${e??"other"}`,Z=["holiday","holiday_eve","regular","closed"],ut={holiday:"acc",holiday_eve:"acc",regular:"off",closed:"warn"};function ht(e,t){const s=new Map;for(const n of[...e].filter(r=>r.date>=t).sort((r,i)=>r.date<i.date?-1:1))s.set(n.date.slice(0,7),[...s.get(n.date.slice(0,7))??[],n]);return[...s.entries()].map(([n,r])=>({month:n,rows:r}))}const ft=e=>e.source==="manual";function X(e){return e?.generated_kind||e?.source==="generated"?[...Z]:Z.filter(t=>t!=="regular")}const mt=e=>/^\d{4}-\d{2}-\d{2}$/.test(e)&&new Date(`${e}T00:00:00Z`).toISOString().slice(0,10)===e;function wt(e){return Array.from({length:Math.max(1,Math.min(12,e))},(t,s)=>s+1)}function L(e){const t=e.settings.exterior_allowed==="true";return e.enabled?e.doors.filter(s=>s.manage&&(t||!s.exterior)):[]}function ee(e,t){return new Date(Math.ceil(Date.parse(e)/6e4)*6e4+t*36e5).toISOString()}function vt(e){const s=e?.body?.details?.reason;return typeof s=="string"?s:null}const F=se`
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
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button {
    font: inherit; padding: 6px 12px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); cursor: pointer;
  }
  .seg button[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
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
    .seg button, input[type='text'], input[type='date'], input[type='time'], select { min-block-size: 44px; }
    .doors label, label.chk { min-block-size: 44px; }
    input[type='checkbox'], input[type='radio'] { inline-size: 22px; block-size: 22px; }
  }
`;var gt=Object.defineProperty,$t=Object.getOwnPropertyDescriptor,E=(e,t,s,n)=>{for(var r=n>1?void 0:n?$t(t,s):t,i=e.length-1,c;i>=0;i--)(c=e[i])&&(r=(n?c(t,s,r):c(r))||r);return n&&r&&gt(t,s,r),r};let x=class extends A{constructor(){super(...arguments),this.data=null,this.draft=null,this.draftError="",this.busy=!1,this.confirm=null,this.secret=null,this.copied=!1}tell(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}changed(){this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}async run(e){this.busy=!0;try{await e.run(),this.confirm=null,this.tell(a("done")),this.changed()}catch(t){this.confirm=null,this.tell(t instanceof j&&t.code==="automation_actor_unavailable"?d("armRefused"):`${a("failed")}: ${m(t)}`)}finally{this.busy=!1}}ask(e){this.confirm={title:a("confirmTitle"),...e}}askRule(e,t){const s={enable:"confirmEnable",pause:"confirmPause",retire:"confirmRetire"};this.ask({text:a(s[t]),btn:a(t),danger:t==="retire",run:()=>ae(e.id,t)})}askArm(e,t){this.ask({text:d(t?"confirmArm":"confirmDisarm"),btn:d(t?"armBtn":"disarmBtn"),danger:t,run:()=>xe(e.id,t)})}askToken(e){this.ask({text:d("confirmToken"),btn:d("tokenNew"),run:async()=>{const t=await ke(e.id);this.secret={name:e.name,token:t.token,snippet:t.snippet}}})}openEditor(e){this.draft=e?ot(e):pe(),this.draftError=""}patch(e){if(!this.draft)return;const t={...this.draft,doors:new Set(this.draft.doors)};e(t),this.draft=t,this.draftError=""}problem(){if(!this.draft||!this.data)return"";const e=it(this.draft,B(this.data.settings));return e?e.scope==="dwe"?d(e.key,e.vars):a(e.key,e.vars):""}save(e){const t=this.problem();if(t||!this.draft){this.draftError=t;return}const s=this.draft,n=async()=>{const r=dt(s,e),i=s.id?await oe(s.id,r):await ne(r);this.draft=null,i.token&&(this.secret={name:s.name.trim(),token:i.token,snippet:i.snippet??""})};e?this.ask({text:a("confirmEnable"),btn:a("saveEnable"),run:n}):this.run({title:"",text:"",btn:"",run:n})}async copy(e){try{await navigator.clipboard.writeText(e),this.copied=!0,window.setTimeout(()=>this.copied=!1,2e3)}catch{this.copied=!1}}logWhen(e){const t=this.data?.doors.find(n=>n.key===e.door)?.zone??"Asia/Jerusalem",s=S(e.at,t);return`${s.slice(8,10)}.${s.slice(5,7)} ${_(e.at,t)}`}render(){const e=this.data;if(!e)return l;const t=J(e.rules);return!t.length&&!e.can.manage&&!(e.triggers??[]).length?l:o`<section data-dw-events>
      <div class="head"><h2>${d("evSection")}</h2>
        <div class="acts">
          <span class="chip num" data-dw-storm>${d("capStorm",{n:st})}</span>
          ${e.settings.max_per_day_per_door?o`<span class="chip num">${d("capDay",{n:e.settings.max_per_day_per_door})}</span>`:l}
          ${e.settings.quiet_from?o`<span class="chip num">${d("capQuiet",{from:e.settings.quiet_from,to:e.settings.quiet_to})}</span>`:l}
          ${e.can.manage?o`<sw-button size="sm" variant="secondary" icon="plus" data-dw-new-event @click=${()=>this.openEditor()}>${d("evNew")}</sw-button>`:l}
        </div></div>
      ${t.length?t.map(s=>this.renderCard(s)):o`<div class="muted" data-dw-events-empty>${d("evEmpty")}</div>`}
      ${this.renderLog()}
      ${this.renderEditor()}
      ${this.draft?l:this.renderConfirm()}
      ${this.renderSecret()}
    </section>`}renderCard(e){const t=e.trigger,s=lt(t,!!e.manageable,this.data.automation_actor);return o`<div class="card" data-dw-event-rule=${e.id} data-dw-rule-state=${e.state} data-dw-arm=${t.arm_state} data-dw-source=${t.source}>
      <div class="top"><b>${e.name}</b>
        <div class="chips">
          <span class="chip" data-tone=${re[e.state]}>${a(`rs_${e.state}`)}</span>
          <span class="chip" data-tone=${s.tone} data-dw-arm-chip>${d(s.state)}</span>
          ${s.unavailable?o`<span class="chip" data-tone="off" data-dw-arm-unavailable>${d("arm_unavailable")}</span>`:l}
        </div></div>
      <div class="chips"><span class="chip" data-tone="acc">${d(`src_${t.source}`)}</span>
        ${t.source==="arx_automation"&&t.automation_id?o`<span class="chip num">${t.automation_id}</span>`:l}
        ${t.source==="ha_event"&&t.has_token?o`<span class="chip">${d("tokenHas")}</span>`:l}
        ${e.doors.filter(n=>n.visible).map(n=>o`<span class="chip">${n.label}</span>`)}</div>
      <div class="chips">${ct(t).map(n=>o`<span class="chip num">${d(n.key,n.vars)}</span>`)}</div>
      ${e.manageable?o`<div class="acts">
        <sw-button size="sm" variant="ghost" icon="edit" data-dw-edit @click=${()=>this.openEditor(e)}>${a("edit")}</sw-button>
        ${e.state==="enabled"?o`<sw-button size="sm" variant="ghost" icon="pause" data-dw-pause @click=${()=>this.askRule(e,"pause")}>${a("pause")}</sw-button>`:o`<sw-button size="sm" variant="secondary" icon="play" data-dw-enable @click=${()=>this.askRule(e,"enable")}>${a("enable")}</sw-button>`}
        ${s.action==="arm"?o`<sw-button size="sm" variant="secondary" icon="bolt" data-dw-arm @click=${()=>this.askArm(e,!0)}>${d("armBtn")}</sw-button>`:l}
        ${s.action==="disarm"?o`<sw-button size="sm" variant="secondary" data-dw-disarm @click=${()=>this.askArm(e,!1)}>${d("disarmBtn")}</sw-button>`:l}
        ${t.source==="ha_event"?o`<sw-button size="sm" variant="ghost" icon="link" data-dw-token @click=${()=>this.askToken(e)}>${d("tokenNew")}</sw-button>`:l}
        <sw-button size="sm" variant="ghost" icon="trash" data-dw-retire @click=${()=>this.askRule(e,"retire")}>${a("retire")}</sw-button>
      </div>`:l}
    </div>`}renderLog(){const e=this.data.triggers??[];if(!e.length&&!J(this.data.rules).length)return l;const t=s=>this.data.doors.find(n=>n.key===s)?.label??s;return o`<div class="card" data-dw-trigger-log><b>${d("logTitle")}</b>
      ${e.length?o`<ul class="lines">${e.map(s=>o`<li data-dw-log=${s.decision}>
        <span>${t(s.door)} <span class="muted num">${this.logWhen(s)}</span></span>
        <span class="chips"><span class="chip">${d(`src_${s.source}`)}</span>
          <span class="chip" data-tone=${pt[s.decision]}>${d(`dec_${s.decision}`)}</span>
          ${s.reason?o`<span class="chip" data-tone="off">${le(ue(s.reason),"reason_other")}</span>`:l}</span>
      </li>`)}</ul>`:o`<div class="muted">${d("logEmpty")}</div>`}
    </div>`}renderEditor(){const e=this.draft;if(!e||!this.data)return l;const t=B(this.data.settings),s=this.data.settings.exterior_allowed==="true",n=this.data.doors.filter(c=>c.manage&&(s||!c.exterior)),r=[...new Set(n.map(c=>c.station_name))],i=(c,u,M)=>o`<input id=${c} type="text" inputmode="numeric"
      data-dw-field=${c} .value=${u} @input=${z=>this.patch(he=>M(he,z.target.value))}>`;return o`<sw-drawer open modal heading=${e.id?d("evEditorEdit"):d("evEditorNew")} @close=${()=>this.draft=null}>
      <div class="form" data-dw-event-editor>
        <div class="field"><label for="dwe-name">${a("fName")}</label>
          <input id="dwe-name" type="text" maxlength="60" .value=${e.name} @input=${c=>this.patch(u=>u.name=c.target.value)}></div>
        <div class="field"><span class="lbl">${d("src_label")}</span><div class="seg" role="group">
          ${ce.map(c=>o`<button type="button" aria-pressed=${String(e.source===c)} data-dw-source-pick=${c}
            @click=${()=>this.patch(u=>u.source=c)}>${d(`src_${c}`)}</button>`)}</div></div>
        ${e.source==="arx_automation"?o`<div class="field"><label for="dwe-auto">${d("fAutomation")}</label>
          <input id="dwe-auto" class="code" type="text" maxlength="90" placeholder=${d("fAutomationPh")} .value=${e.automationId}
            @input=${c=>this.patch(u=>u.automationId=c.target.value)}></div>`:l}
        <div class="field"><span class="lbl">${a("fDoors")}</span>
          <div class="doors" data-dw-doors>${r.map(c=>o`${c?o`<div class="st">${c}</div>`:l}
            ${n.filter(u=>u.station_name===c).map(u=>o`<label><input type="checkbox" data-dw-door=${u.key} .checked=${e.doors.has(u.key)}
              @change=${M=>this.patch(z=>M.target.checked?z.doors.add(u.key):z.doors.delete(u.key))}>${u.name}</label>`)}`)}</div></div>
        <div class="row2">
          <div class="field"><label for="dwe-dur">${d("fDurationMin")}</label>${i("dwe-dur",e.durationMin,(c,u)=>c.durationMin=u)}</div>
          <div class="field"><label for="dwe-cap">${d("fMaxPerDay")}</label>${i("dwe-cap",e.maxPerDay,(c,u)=>c.maxPerDay=u)}</div>
          <div class="field"><label for="dwe-cool">${d("fCooldownMin")}</label>${i("dwe-cool",e.cooldownMin,(c,u)=>c.cooldownMin=u)}</div>
        </div>
        <div class="field"><label class="chk"><input type="checkbox" data-dw-limit .checked=${e.limitHours}
            @change=${c=>this.patch(u=>u.limitHours=c.target.checked)}>${d("fAllowedLimit")}</label>
          ${e.limitHours?o`<div class="row2">
            <label class="muted">${d("fAllowedFrom")} <input type="time" lang=${D()} step="900" .value=${e.from} @change=${c=>this.patch(u=>u.from=c.target.value)}></label>
            <label class="muted">${d("fAllowedTo")} <input type="time" lang=${D()} step="900" .value=${e.to==="24:00"?"23:59":e.to} @change=${c=>this.patch(u=>u.to=c.target.value)}></label>
          </div>`:o`<span class="muted">${d("fAllowedAll")}</span>`}
          <span class="chip num">${d("capQuiet",{from:t.quiet[0],to:t.quiet[1]})}</span></div>
        ${e.id&&e.source==="ha_event"?o`<label class="chk"><input type="checkbox" data-dw-regenerate .checked=${e.regenerate}
            @change=${c=>this.patch(u=>u.regenerate=c.target.checked)}>${d("fRegenerate")}</label>`:l}
        ${this.draftError?o`<div class="err" role="alert" data-dw-error>${this.draftError}</div>`:l}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.draft=null}>${a("cancel")}</sw-button>
        <sw-button variant="secondary" data-dw-save-draft ?disabled=${this.busy} @click=${()=>this.save(!1)}>${a("saveDraft")}</sw-button>
        <sw-button variant="primary" data-dw-save-enable ?disabled=${this.busy} @click=${()=>this.save(!0)}>${a("saveEnable")}</sw-button>
      </div>
      ${this.renderConfirm()}
    </sw-drawer>`}renderConfirm(){const e=this.confirm;return e?o`<sw-dialog open heading=${e.title} @close=${()=>this.confirm=null} data-dw-confirm>
      <p>${e.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.confirm=null}>${a("cancel")}</sw-button>
        <sw-button variant=${e.danger?"danger":"primary"} data-dw-confirm-btn ?disabled=${this.busy} @click=${()=>void this.run(e)}>${e.btn}</sw-button>
      </div>
    </sw-dialog>`:l}renderSecret(){const e=this.secret;return e?o`<sw-dialog open heading=${d("tokenTitle")} subheading=${e.name} @close=${()=>this.secret=null} data-dw-secret>
      <pre class="snippet" data-dw-snippet>${e.snippet||e.token}</pre>
      <div slot="footer" class="footer">
        <sw-button variant="secondary" icon="copy" data-dw-copy @click=${()=>void this.copy(e.snippet||e.token)}>${this.copied?d("tokenCopied"):d("tokenCopy")}</sw-button>
        <sw-button variant="primary" @click=${()=>this.secret=null}>${a("close")}</sw-button>
      </div>
    </sw-dialog>`:l}};x.styles=[T,F];E([$({attribute:!1})],x.prototype,"data",2);E([p()],x.prototype,"draft",2);E([p()],x.prototype,"draftError",2);E([p()],x.prototype,"busy",2);E([p()],x.prototype,"confirm",2);E([p()],x.prototype,"secret",2);E([p()],x.prototype,"copied",2);x=E([N("door-event-rules")],x);var bt=Object.defineProperty,yt=Object.getOwnPropertyDescriptor,b=(e,t,s,n)=>{for(var r=n>1?void 0:n?yt(t,s):t,i=e.length-1,c;i>=0;i--)(c=e[i])&&(r=(n?c(t,s,r):c(r))||r);return n&&r&&bt(t,s,r),r};const _t=["israel","none"];let w=class extends A{constructor(){super(...arguments),this.open=!1,this.canManage=!1,this.canConfigure=!1,this.today="",this.cal=null,this.error="",this.busy=!1,this.pending=null,this.formError="",this.add={date:"",kind:"holiday",label:""},this.kindWord=e=>d(`dk_${e}`)}willUpdate(e){e.has("open")&&this.open&&this.load()}async load(){this.error="";try{this.cal=await Ee()}catch(e){this.error=m(e)}finally{}}tell(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}close(){this.pending=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}dateWord(e){return`${a(`wd${W(e)}`)} ${e.slice(8,10)}.${e.slice(5,7)}.${e.slice(0,4)}`}askKind(e,t){this.pending={text:d("hlConfirm",{date:this.dateWord(e.date),kind:this.kindWord(t)}),run:()=>P(e.date,t,e.name_he)}}askReset(e){this.pending={text:d("hlConfirmReset",{date:this.dateWord(e.date)}),run:()=>P(e.date,"none")}}askGenerator(e){this.pending={text:d("hlConfirmGenerator",{name:d(`gen_${e}`)}),run:()=>ie({"doors.windows.calendar_generator":e})}}askAdd(){if(!mt(this.add.date)){this.formError=d("errHlDate");return}this.formError="";const{date:e,kind:t,label:s}=this.add;this.pending={text:d("hlConfirm",{date:this.dateWord(e),kind:this.kindWord(t)}),run:async()=>{await P(e,t,s.trim()),this.add={date:"",kind:"holiday",label:""}}}}async confirm(){const e=this.pending;if(e){this.busy=!0;try{await e.run(),this.pending=null,this.tell(a("done")),await this.load(),this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}catch(t){this.pending=null,this.tell(`${a("failed")}: ${m(t)}`)}finally{this.busy=!1}}}render(){return this.open?o`<sw-drawer open heading=${d("hlTitle")} @close=${()=>this.close()}>
      <div class="form" data-dw-holidays>
        ${this.error?o`<sw-state-panel quiet state="error" heading=${d("hlLoadError")} actionLabel=${a("retry")} data-dw-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:this.cal?this.renderBody():o`<sw-state-panel quiet state="loading" heading=${d("hlLoading")} data-dw-panel="loading"></sw-state-panel>`}
      </div>
      ${this.renderPending()}
    </sw-drawer>`:l}renderBody(){const e=this.cal,t=ht(e.holidays,this.today||e.holidays[0]?.date||"");return o`
      <div class="field"><span class="lbl">${d("hlGenerator")}</span>
        ${this.canConfigure?o`<div class="seg" role="group" data-dw-generator>${_t.map(s=>o`<button type="button" aria-pressed=${String(e.generator===s)} data-dw-gen=${s}
              @click=${()=>e.generator!==s&&this.askGenerator(s)}>${d(`gen_${s}`)}</button>`)}</div>`:o`<div class="chips"><span class="chip" data-dw-generator-chip>${d(`gen_${e.generator}`)}</span></div>`}</div>
      ${t.length?t.map(s=>o`<div class="card" data-dw-month=${s.month}>
        <b class="num">${s.month.slice(5,7)}.${s.month.slice(0,4)}</b>
        <ul class="lines">${s.rows.map(n=>this.renderRow(n))}</ul></div>`):o`<div class="muted" data-dw-holidays-empty>${d("hlEmpty")}</div>`}
      ${this.canManage?o`<div class="card" data-dw-add>
        <b>${d("hlAdd")}</b>
        <div class="row2">
          <div class="field"><label for="dwh-date">${d("hlColDate")}</label><input id="dwh-date" type="date" lang=${D()} min=${this.today} .value=${this.add.date}
            @change=${s=>this.add={...this.add,date:s.target.value}}></div>
          <div class="field"><label for="dwh-kind">${d("hlColKind")}</label><select id="dwh-kind" @change=${s=>this.add={...this.add,kind:s.target.value}}>
            ${X(null).map(s=>o`<option value=${s} ?selected=${this.add.kind===s}>${this.kindWord(s)}</option>`)}</select></div>
          <div class="field"><label for="dwh-label">${d("hlLabel")}</label><input id="dwh-label" type="text" maxlength="60" .value=${this.add.label}
            @input=${s=>this.add={...this.add,label:s.target.value}}></div>
        </div>
        ${this.formError?o`<div class="err" role="alert">${this.formError}</div>`:l}
        <div class="footer"><sw-button variant="primary" size="sm" data-dw-add-save @click=${()=>this.askAdd()}>${d("hlSave")}</sw-button></div>
      </div>`:l}`}renderRow(e){return o`<li data-dw-holiday=${e.date} data-dw-kind=${e.kind} data-dw-source=${e.source}>
      <span><b class="num">${this.dateWord(e.date)}</b> ${e.name_he?o`<span class="muted">${e.name_he}</span>`:l}</span>
      <span class="chips">
        <span class="chip" data-tone=${ut[e.kind]}>${this.kindWord(e.kind)}</span>
        <span class="chip" data-tone=${e.source==="manual"?"warn":"off"}>${d(e.source==="manual"?"hlSrcManual":"hlSrcGenerated")}</span>
        ${e.source==="manual"&&e.generated_kind?o`<span class="chip" data-tone="off">${d("hlWas",{kind:this.kindWord(e.generated_kind)})}</span>`:l}
      </span>
      ${this.canManage?o`<span class="acts">
        <select aria-label=${d("hlColKind")} data-dw-kind-pick @change=${t=>{const s=t.target.value;t.target.value=e.kind,s!==e.kind&&this.askKind(e,s)}}>${X(e).map(t=>o`<option value=${t} ?selected=${e.kind===t}>${this.kindWord(t)}</option>`)}</select>
        ${ft(e)?o`<sw-button size="sm" variant="ghost" icon="refresh" data-dw-reset @click=${()=>this.askReset(e)}>${d(e.generated_kind?"hlReset":"hlRemove")}</sw-button>`:l}
      </span>`:l}
    </li>`}renderPending(){const e=this.pending;return e?o`<sw-dialog open heading=${a("confirmTitle")} @close=${()=>this.pending=null} data-dw-confirm>
      <p>${e.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.pending=null}>${a("cancel")}</sw-button>
        <sw-button variant="primary" data-dw-confirm-btn ?disabled=${this.busy} @click=${()=>void this.confirm()}>${a("confirmBtn")}</sw-button>
      </div>
    </sw-dialog>`:l}};w.styles=[T,F];b([$({type:Boolean})],w.prototype,"open",2);b([$({type:Boolean})],w.prototype,"canManage",2);b([$({type:Boolean})],w.prototype,"canConfigure",2);b([$()],w.prototype,"today",2);b([p()],w.prototype,"cal",2);b([p()],w.prototype,"error",2);b([p()],w.prototype,"busy",2);b([p()],w.prototype,"pending",2);b([p()],w.prototype,"formError",2);b([p()],w.prototype,"add",2);w=b([N("door-holidays")],w);var xt=Object.defineProperty,kt=Object.getOwnPropertyDescriptor,y=(e,t,s,n)=>{for(var r=n>1?void 0:n?kt(t,s):t,i=e.length-1,c;i>=0;i--)(c=e[i])&&(r=(n?c(t,s,r):c(r))||r);return n&&r&&xt(t,s,r),r};let v=class extends A{constructor(){super(...arguments),this.open=!1,this.doors=[],this.preset="",this.maxHours=4,this.nowIso="",this.door="",this.hours=1,this.step="choose",this.busy=!1,this.error=""}willUpdate(e){e.has("open")&&this.open&&(this.door=this.doors.find(t=>t.key===this.preset)?.key??this.doors[0]?.key??"",this.hours=1,this.step="choose",this.error="")}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}current(){return this.doors.find(e=>e.key===this.door)}async start(){const e=this.current();if(e){this.busy=!0,this.error="";try{const t=await Oe(e.station_id,e.relay,this.hours*3600),s=t.decision.end_at?_(t.decision.end_at,e.zone):_(ee(this.nowIso||new Date().toISOString(),this.hours),e.zone);this.dispatchEvent(new CustomEvent("notice",{detail:d(t.decision.decision==="extended"?"ofExtended":"ofStarted",{end:s}),bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0})),this.close()}catch(t){const s=vt(t);this.error=s?le(ue(s),"reason_other"):m(t),this.step="choose"}finally{this.busy=!1}}}render(){if(!this.open)return l;const e=this.current(),t=e?_(ee(this.nowIso||new Date().toISOString(),this.hours),e.zone):"";return o`<sw-dialog open heading=${d("ofTitle")} @close=${()=>this.close()} data-dw-openfor>
      ${this.doors.length?this.step==="choose"?o`<div class="form">
        <div class="field"><label for="dwo-door">${d("ofDoor")}</label>
          <select id="dwo-door" data-dw-openfor-door @change=${s=>this.door=s.target.value}>
            ${this.doors.map(s=>o`<option value=${s.key} ?selected=${s.key===this.door}>${s.label}</option>`)}</select></div>
        <div class="field"><span class="lbl">${d("ofHours")}</span><div class="seg" role="group" data-dw-openfor-hours>
          ${wt(this.maxHours).map(s=>o`<button type="button" class="num" aria-pressed=${String(this.hours===s)} data-dw-hours=${s}
            @click=${()=>this.hours=s}>${d("ofHoursN",{n:s})}</button>`)}</div></div>
        ${this.error?o`<div class="err" role="alert" data-dw-error>${this.error}</div>`:l}
      </div>`:o`<p data-dw-openfor-confirm>${d("ofConfirmText",{door:e?.label??"",end:t})}</p>`:o`<div class="muted" data-dw-openfor-none>${d("ofNoDoors")}</div>`}
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.step==="confirm"?this.step="choose":this.close()}>${a("cancel")}</sw-button>
        ${this.doors.length?this.step==="choose"?o`<sw-button variant="primary" icon="clock" data-dw-openfor-next ?disabled=${!e} @click=${()=>this.step="confirm"}>${d("ofConfirm",{n:this.hours})}</sw-button>`:o`<sw-button variant="primary" data-dw-openfor-go ?disabled=${this.busy} @click=${()=>void this.start()}>${a("confirmBtn")}</sw-button>`:l}
      </div>
    </sw-dialog>`}};v.styles=[T,F];y([$({type:Boolean})],v.prototype,"open",2);y([$({attribute:!1})],v.prototype,"doors",2);y([$()],v.prototype,"preset",2);y([$({type:Number})],v.prototype,"maxHours",2);y([$()],v.prototype,"nowIso",2);y([p()],v.prototype,"door",2);y([p()],v.prototype,"hours",2);y([p()],v.prototype,"step",2);y([p()],v.prototype,"busy",2);y([p()],v.prototype,"error",2);v=y([N("door-open-for")],v);var Et=Object.defineProperty,Ot=Object.getOwnPropertyDescriptor,f=(e,t,s,n)=>{for(var r=n>1?void 0:n?Ot(t,s):t,i=e.length-1,c;i>=0;i--)(c=e[i])&&(r=(n?c(t,s,r):c(r))||r);return n&&r&&Et(t,s,r),r};const Dt=15e3,Ct=5e3,St=[0,1,2,3,4,5,6],O="doors.emergency.engine_switch",Tt=["doors.emergency.grant.default_hours","doors.emergency.grant.max_hours","doors.emergency.grant.by_security_manager","doors.emergency.retry_open.by_holders"],At=["skip_holidays","holidays_like_friday","ignore_calendar"];let h=class extends A{constructor(){super(...arguments),this.route=null,this.data=null,this.em=null,this.error="",this.forbidden=!1,this.draft=null,this.draftError="",this.preview=null,this.busy=!1,this.confirm=null,this.manual=null,this.sheet=!1,this.grantsOpen=!1,this.holidaysOpen=!1,this.openForOpen=!1,this.openForDoor="",this.toaster=new De(this,{ms:2500}),this.settingsOpen=!1,this.ws=null,this.wsEdit={},this.wLive=!1,this.engineOffAsk=!1,this.es=null,this.esEdit={},this.sError="",this.poll=new Ce(this)}get toast(){return this.toaster.text}connectedCallback(){super.connectedCallback(),U()&&(this.load(),this.poll.every("state",Dt,()=>this.load()),this.poll.every("emergency",Ct,()=>this.loadEmergency()))}async load(){try{this.data=await Se(),this.error=""}catch(e){e instanceof j&&e.status===403?this.forbidden=!0:this.error=m(e)}await this.loadEmergency()}async loadEmergency(){try{this.em=await Te()}catch{this.em=null}}flash(e){this.toaster.show(e)}doorOf(e){return this.data?.doors.find(t=>t.key===e)}today(){return S(this.data?.now??new Date().toISOString(),"Asia/Jerusalem")}async run(e){this.busy=!0;try{await e.run(),this.confirm=null,this.flash(a("done")),await this.load()}catch(t){this.flash(`${a("failed")}: ${m(t)}`)}finally{this.busy=!1}}askRule(e,t){const s={enable:"confirmEnable",pause:"confirmPause",retire:"confirmRetire"};this.confirm={title:a("confirmTitle"),text:a(s[t]),btn:a(t),danger:t==="retire",run:()=>ae(e.id,t)}}askOpenFor(e){this.openForDoor=e,this.openForOpen=!0}askEndNow(e){this.confirm={title:a("confirmTitle"),text:a("confirmEndNow",{door:e.label}),btn:a("endNow"),run:()=>Ae(e.id)}}async saveManual(){const e=this.manual;if(!(!e||!e.checked)){this.busy=!0;try{await Ne(e.occ.id,e.checked),this.manual=null,this.flash(a("done")),await this.load()}catch(t){this.flash(`${a("failed")}: ${m(t)}`)}finally{this.busy=!1}}}openEditor(e){this.draft=e?ze(e,this.today()):Re(this.today()),this.draftError="",this.preview=null}patch(e){if(!this.draft)return;const t={...this.draft,doors:new Set(this.draft.doors),days:new Set(this.draft.days),ranges:this.draft.ranges.map(s=>({...s})),perDay:this.draft.perDay?new Map([...this.draft.perDay].map(([s,n])=>[s,n.map(r=>({...r}))])):null};e(t),this.draft=t,this.preview=null,this.draftError=""}problem(){if(!this.draft)return"";const e=Me(this.draft,Number(this.data?.settings.max_hours??4));return e?a(e.key,e.vars):""}async doPreview(){const e=this.problem();if(e||!this.draft){this.draftError=e;return}try{this.preview=await Pe(K(this.draft,!1))}catch(t){this.draftError=m(t)}}save(e){const t=this.problem();if(t||!this.draft){this.draftError=t;return}const s=this.draft,n=async()=>{const r=K(s,e);s.id?await oe(s.id,r):await ne(r),this.draft=null};e?this.confirm={title:a("confirmTitle"),text:a("confirmEnable"),btn:a("saveEnable"),run:n}:this.run({title:"",text:"",btn:"",run:n})}async openSettings(){this.settingsOpen=!0,this.sError="";try{const[e,t]=await Promise.all([He(),Q()]);this.ws=e.settings,this.wsEdit={...e.settings},this.wLive=e.go_live_permitted===!0,this.es=t.settings,this.esEdit=Object.fromEntries(Object.entries(t.settings).filter(([s,n])=>typeof n=="string"&&["doors.emergency.enabled","doors.emergency.open_enabled",O,...Tt].includes(s)))}catch(e){this.sError=m(e)}}async saveSettings(e=!1){if(!this.ws||!this.es)return;const t=this.es;if(!e&&this.esEdit[O]==="off"&&(t[O]??"on")!=="off"){this.engineOffAsk=!0;return}this.busy=!0,this.sError="";try{const s=Object.fromEntries(Object.entries(this.wsEdit).filter(([i,c])=>this.ws[i]!==c));Object.keys(s).length&&(this.ws=(await ie(s)).settings);const n=this.es,r=Object.fromEntries(Object.entries(this.esEdit).filter(([i,c])=>n[i]!==c));Object.keys(r).length&&(this.es=(await Le(r,r[O]==="off")).settings),this.settingsOpen=!1,this.flash(a("saved")),await this.load()}catch(s){this.sError=m(s)}finally{this.busy=!1}}async doAttest(){if(this.es)try{await We(this.es.attestation.version),this.es=(await Q()).settings}catch(e){this.sError=m(e)}}num(e,t,s,n){return o`<div class="field"><label for=${e}>${a(t)}</label><input id=${e} type="text" inputmode="numeric" data-dw-setting=${e}
      .value=${this.wsEdit[e]??""} @input=${r=>{const i=r.target.value.trim();this.wsEdit={...this.wsEdit,[e]:/^\d+$/.test(i)&&Number(i)>=s&&Number(i)<=n?String(Number(i)):i}}}></div>`}hours(e,t,s,n){return o`<div class="field"><label for=${e}>${a(t)}</label><input id=${e} type="text" inputmode="numeric" data-dw-setting=${e}
      .value=${this.esEdit[e]??""} @input=${r=>{const i=r.target.value.trim();this.esEdit={...this.esEdit,[e]:/^\d+$/.test(i)&&Number(i)>=s&&Number(i)<=n?String(Number(i)):i}}}></div>`}check(e,t,s,n=!1,r=""){return o`<label class="occ" data-dw-switch=${r}><input type="checkbox" .checked=${e} ?disabled=${n} @change=${i=>s(i.target.checked)}> ${a(t)}</label>`}renderSettings(){if(!this.settingsOpen)return l;const e=this.wsEdit,t=this.es,s=!!t?.go_live_permitted,n=this.esEdit[O]!=="off",r=t?.build_ready??s;return o`<sw-drawer open modal heading=${a("sTitle")} @close=${()=>this.settingsOpen=!1}>
      <div class="form" data-dw-settings>
        <section><h2>${a("sWindows")}</h2>
          ${this.wLive?l:o`<div class="callout" data-tone="warn" data-dw-programs-golive><sw-icon name="info"></sw-icon><span>${a("sProgramsGoLiveNo")}</span></div>`}
          ${this.check(e["doors.windows.enabled"]==="on","sWindowsOn",i=>this.wsEdit={...e,"doors.windows.enabled":i?"on":"off"},!1,"doors.windows.enabled")}
          ${this.num("doors.windows.max_hours","sMaxHours",1,12)}
          ${this.num("doors.windows.relock_grace_s","sGrace",60,600)}
          ${this.num("doors.windows.relock_retries","sRetries",0,5)}
          ${this.num("doors.windows.reraise_min","sReraise",5,60)}
          ${this.check(e["doors.windows.exterior_allowed"]==="true","sExterior",i=>this.wsEdit={...e,"doors.windows.exterior_allowed":i?"true":"false"},!1,"doors.windows.exterior_allowed")}
        </section>
        ${t?o`<section><h2>${a("sEmergency")}</h2>
          ${r?l:o`<div class="callout" data-tone="warn" data-dw-golive><sw-icon name="info"></sw-icon><span>${a("sGoLiveNo")}</span></div>`}
          ${this.check(n,"sEngineOn",i=>this.esEdit={...this.esEdit,[O]:i?"on":"off"},!1,O)}
          ${n?l:o`<div class="callout" data-tone="warn" data-dw-engine-off><sw-icon name="info"></sw-icon><span>${a("sEngineOffNote")}</span></div>`}
          ${this.check(this.esEdit["doors.emergency.enabled"]==="on","sEmergencyOn",i=>this.esEdit={...this.esEdit,"doors.emergency.enabled":i?"on":"off"},!s,"doors.emergency.enabled")}
          ${this.check(this.esEdit["doors.emergency.open_enabled"]==="on","sOpenOn",i=>this.esEdit={...this.esEdit,"doors.emergency.open_enabled":i?"on":"off"},!s||!t.open_available||!t.attested,"doors.emergency.open_enabled")}
          <div class="card" data-dw-attestation><b>${a("sAttestTitle")}</b><p class="muted">${t.attestation.text}</p>
            ${t.attested?o`<span class="chip" data-tone="ok">${a("sAttested")}</span>`:o`<div><sw-button size="sm" variant="secondary" data-dw-attest @click=${()=>void this.doAttest()}>${a("sAttest")}</sw-button></div>`}</div>
          <h2>${a("sGrants")}</h2>
          ${this.hours("doors.emergency.grant.default_hours","sGrantDefault",0,8760)}
          ${this.hours("doors.emergency.grant.max_hours","sGrantMax",1,8760)}
          ${this.check(this.esEdit["doors.emergency.grant.by_security_manager"]==="on","sGrantManager",i=>this.esEdit={...this.esEdit,"doors.emergency.grant.by_security_manager":i?"on":"off"},!1,"doors.emergency.grant.by_security_manager")}
          ${this.check(this.esEdit["doors.emergency.retry_open.by_holders"]==="on","sRetryHolders",i=>this.esEdit={...this.esEdit,"doors.emergency.retry_open.by_holders":i?"on":"off"},!1,"doors.emergency.retry_open.by_holders")}
        </section>`:l}
        ${this.sError?o`<div class="err" role="alert">${this.sError}</div>`:l}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.settingsOpen=!1}>${a("cancel")}</sw-button>
        <sw-button variant="primary" data-dw-settings-save ?disabled=${this.busy||!this.ws} @click=${()=>void this.saveSettings()}>${a("sSave")}</sw-button>
      </div>
      ${this.renderEngineOffAsk()}
    </sw-drawer>`}renderEngineOffAsk(){return o`${this.engineOffAsk?o`<sw-dialog open heading=${a("sEngineOffTitle")} @close=${()=>this.engineOffAsk=!1} data-dw-engine-off-confirm>
      <p>${a("sEngineOffText")}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.engineOffAsk=!1}>${a("cancel")}</sw-button>
        <sw-button variant="danger" data-dw-engine-off-btn ?disabled=${this.busy} @click=${()=>{this.engineOffAsk=!1,this.saveSettings(!0)}}>${a("sEngineOffBtn")}</sw-button>
      </div>
    </sw-dialog>`:l}`}render(){const e=a("title");if(U()&&this.forbidden)return o`<sw-page heading=${e}><sw-state-panel quiet state="forbidden" heading=${a("noPermission")} data-dw-panel="forbidden"></sw-state-panel></sw-page>`;if(!this.data)return o`<sw-page heading=${e}>${this.error?o`<sw-state-panel quiet state="error" heading=${a("loadError")} actionLabel=${a("retry")} data-dw-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:o`<sw-state-panel quiet state="loading" heading=${a("loading")} data-dw-panel="loading"></sw-state-panel>`}</sw-page>`;const t=this.data,s=this.em,n=!!s&&(s.can.lock||s.can.open);return o`<sw-page wide heading=${e} subheading=${a("sub")} data-dw data-dw-tier=${t.tier} data-dw-enabled=${String(t.enabled)}>
      ${n?o`<sw-button slot="actions" variant="danger" icon="warning" data-dw-emergency @click=${()=>this.sheet=!0}>${a("emergency")}</sw-button>`:l}
      ${t.can.manage?o`<sw-button slot="actions" variant="primary" icon="plus" data-dw-new @click=${()=>this.openEditor()}>${a("newRule")}</sw-button>`:l}
      ${L(t).length?o`<sw-button slot="actions" variant="secondary" icon="clock" data-dw-openfor-btn @click=${()=>this.askOpenFor("")}>${d("ofBtn")}</sw-button>`:l}
      <sw-button slot="actions" variant="ghost" icon="calendar" data-dw-holidays-btn @click=${()=>this.holidaysOpen=!0}>${d("hlBtn")}</sw-button>
      ${Qe(s)?o`<sw-button slot="actions" variant="ghost" icon="user" data-dw-grants-btn @click=${()=>this.grantsOpen=!0}>${a("grBtn")}</sw-button>`:l}
      ${t.can.configure?o`<sw-button slot="actions" variant="ghost" icon="system" data-dw-settings-btn @click=${()=>void this.openSettings()}>${a("settings")}</sw-button>`:l}
      <sw-button slot="actions" variant="ghost" icon="refresh" iconOnly label=${a("refresh")} @click=${()=>void this.load()}></sw-button>
      <div class="stack">
        ${Y(s?.active)?o`<door-emergency-strip .incident=${s.active} .holdMs=${s.hold_ms} @changed=${()=>void this.load()}></door-emergency-strip>`:l}
        ${Y(s?.drill)?o`<door-emergency-strip .incident=${s.drill} .holdMs=${s.hold_ms} @changed=${()=>void this.load()}></door-emergency-strip>`:l}
        ${t.enabled?t.tier==="prepared"?o`<div class="callout" data-tone="warn" data-dw-banner="prepared"><sw-icon name="info"></sw-icon><span><b>${a("preparedTitle")}</b>${a("preparedText")}</span></div>`:l:o`<div class="callout" data-tone="off" data-dw-banner="off"><sw-icon name="info"></sw-icon><span><b>${a("offTitle")}</b>${a("offText")}</span></div>`}
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
      <door-open-for .open=${this.openForOpen} .doors=${L(t)} .preset=${this.openForDoor} .maxHours=${B(t.settings).maxHours} .nowIso=${t.now}
        @close=${()=>this.openForOpen=!1} @changed=${()=>void this.load()} @notice=${r=>this.flash(r.detail)}></door-open-for>
      <door-emergency-grants .open=${this.grantsOpen} @close=${()=>this.grantsOpen=!1} @notice=${r=>this.flash(r.detail)}></door-emergency-grants>
      <door-emergency-sheet .open=${this.sheet} .data=${s} @close=${()=>this.sheet=!1} @changed=${()=>void this.loadEmergency()}></door-emergency-sheet>
      ${this.toast?o`<div class="toast" role="status" ${Ie()}>${this.toast}</div>`:l}
    </sw-page>`}renderAlarms(){const e=Be(this.data.occurrences);return e.length?o`<section data-dw-alarms><h2>${a("alarmsTitle")}</h2>
      ${e.map(t=>{const s=this.doorOf(t.door);return o`<div class="card alarm" data-dw-alarm=${t.door}>
          <div class="top"><b>${a("alarmTitle")}</b><span class="chip" data-tone="err">${a("occ_relock_unconfirmed")}</span></div>
          <div>${a("alarmText",{door:t.label,end:_(t.end_at,t.zone)})}</div>
          <div class="muted">${t.last_reason==="feed_unavailable"?a("alarmFeed"):a("alarmRetries",{n:t.retries})}</div>
          ${s?.cancel?o`<div><sw-button variant="danger" size="sm" data-dw-manual @click=${()=>this.manual={occ:t,checked:""}}>${a("confirmManual")}</sw-button></div>`:l}
        </div>`})}</section>`:l}occWord(e){return e.state==="closed_confirmed"&&e.resolution&&e.resolution!=="engine_idle"?V(`res_${e.resolution}`,"occ_closed_confirmed"):V(`occ_${e.state}`,"occ_armed",{end:_(e.end_at,e.zone)})}renderWeek(){const e=je(this.data.occurrences.filter(t=>t.state!=="relock_unconfirmed"),this.data.doors,this.data.now);return o`<section data-dw-week><h2>${a("weekTitle")}</h2>
      ${e.length?e.map(t=>o`<div class="card doorrow" data-dw-door=${t.door.key}>
        <div class="top"><b>${t.door.label}</b><span class="acts">${"exterior"in t.door&&t.door.exterior?o`<span class="chip" data-tone="warn">${a("exterior")}</span>`:l}
          ${L(this.data).some(s=>s.key===t.door.key)?o`<sw-button size="sm" variant="ghost" icon="clock" data-dw-openfor-door-btn @click=${()=>this.askOpenFor(t.door.key)}>${d("ofBtn")}</sw-button>`:l}</span></div>
        ${t.items.slice(0,8).map(s=>o`<div class="occ" data-dw-occ=${s.state}>
          <span class="when">${a(`wd${W(S(s.start_at,s.zone))}`)} ${_(s.start_at,s.zone)}–${_(s.end_at,s.zone)}</span>
          <span class="chip" data-tone=${Ge[s.state]}>${this.occWord(s)}</span>
          ${Fe(s,this.doorOf(s.door))?o`<sw-button size="sm" variant="secondary" data-dw-endnow @click=${()=>this.askEndNow(s)}>${a("endNow")}</sw-button>`:l}
        </div>`)}
      </div>`):o`<div class="muted" data-dw-week-empty>${a("weekEmpty")}</div>`}
    </section>`}hoursOf(e){return o`<div class="hours">${qe(e).map(t=>o`<span>${t.date?t.date:Ue(t.days).map(([s,n])=>s===n?a(`wd${s}`):`${a(`wd${s}`)}–${a(`wd${n}`)}`).join(", ")} · ${t.hours}</span>`)}</div>`}renderRules(){const e=this.data.rules.filter(t=>t.kind!=="event");return o`<section data-dw-rules><h2>${a("rulesTitle")}</h2>
      ${e.length?o`<div class="rules">
        <div class="head"><span>${a("colName")}</span><span>${a("colDoors")}</span><span>${a("colHours")}</span><span>${a("colState")}</span></div>
        ${e.map(t=>o`<div class="card rule" data-dw-rule=${t.id} data-dw-rule-state=${t.state}>
          <div><b>${t.name}</b><div class="muted">${a(`kind_${t.kind}`)}</div></div>
          <div class="chips">${t.doors.filter(s=>s.visible).map(s=>o`<span class="chip">${s.label}</span>`)}</div>
          ${this.hoursOf(t)}
          <div class="acts"><span class="chip" data-tone=${re[t.state]}>${a(`rs_${t.state}`)}</span>
            ${t.manageable?o`
              <sw-button size="sm" variant="ghost" icon="edit" data-dw-edit @click=${()=>this.openEditor(t)}>${a("edit")}</sw-button>
              ${t.state==="enabled"?o`<sw-button size="sm" variant="ghost" icon="pause" data-dw-pause @click=${()=>this.askRule(t,"pause")}>${a("pause")}</sw-button>`:o`<sw-button size="sm" variant="secondary" icon="play" data-dw-enable @click=${()=>this.askRule(t,"enable")}>${a("enable")}</sw-button>`}
              <sw-button size="sm" variant="ghost" icon="trash" data-dw-retire @click=${()=>this.askRule(t,"retire")}>${a("retire")}</sw-button>`:l}
          </div>
        </div>`)}
      </div>`:o`<div class="muted" data-dw-rules-empty>${a("rulesEmpty")} ${this.data.can.manage?a("rulesEmptyManage"):""}</div>`}
    </section>`}renderRanges(e,t){return o`${e.map((s,n)=>o`<div class="range" data-dw-range=${n}>
      <label class="muted">${a("fFrom")} <input type="time" lang=${D()} step="900" .value=${s.start} @change=${r=>t(i=>i[n].start=r.target.value)}></label>
      <label class="muted">${a("fTo")} <input type="time" lang=${D()} step="900" .value=${s.end==="24:00"?"23:59":s.end} @change=${r=>t(i=>i[n].end=r.target.value)}></label>
      ${e.length>1?o`<sw-button size="sm" variant="ghost" icon="trash" iconOnly label=${a("fRemove")} @click=${()=>t(r=>r.splice(n,1))}></sw-button>`:l}
    </div>`)}
    <div><sw-button size="sm" variant="ghost" icon="plus" data-dw-addrange @click=${()=>t(s=>s.push({start:"12:00",end:"13:00"}))}>${a("fAddRange")}</sw-button></div>`}renderEditor(){const e=this.draft;if(!e)return l;const t=this.data.settings.exterior_allowed==="true",s=this.data.doors.filter(r=>r.manage&&(t||!r.exterior)),n=[...new Set(s.map(r=>r.station_name))];return o`<sw-drawer open modal heading=${e.id?a("editorEdit"):a("editorNew")} @close=${()=>this.draft=null}>
      <div class="form" data-dw-editor>
        <div class="field"><label for="dw-name">${a("fName")}</label>
          <input id="dw-name" type="text" maxlength="60" placeholder=${a("fNamePh")} .value=${e.name} @input=${r=>this.patch(i=>i.name=r.target.value)}></div>
        <div class="field"><span class="lbl">${a("fKind")}</span><div class="seg" role="group">
          ${["weekly","once"].map(r=>o`<button type="button" aria-pressed=${String(e.kind===r)} ?disabled=${!!e.id} data-dw-kind=${r}
              @click=${()=>this.patch(i=>i.kind=r)}>${a(`kind_${r}`)}</button>`)}</div></div>
        <div class="field"><span class="lbl">${a("fDoors")}</span>
          <div class="doors" data-dw-doors>${n.map(r=>o`${r?o`<div class="st">${r}</div>`:l}
            ${s.filter(i=>i.station_name===r).map(i=>o`<label><input type="checkbox" data-dw-door=${i.key} .checked=${e.doors.has(i.key)}
              @change=${c=>this.patch(u=>c.target.checked?u.doors.add(i.key):u.doors.delete(i.key))}>${i.name}</label>`)}`)}</div>
          <span class="muted">${a("fDoorsHint")}</span></div>
        ${e.kind==="weekly"&&!e.perDay?o`
          <div class="field"><span class="lbl">${a("fDays")}</span><div class="days" role="group">
            ${St.map(r=>o`<button type="button" aria-pressed=${String(e.days.has(r))} data-dw-day=${r}
              @click=${()=>this.patch(i=>i.days.has(r)?i.days.delete(r):i.days.add(r))}>${a(`wd${r}`)}</button>`)}</div></div>
          <div class="field">${this.renderRanges(e.ranges,r=>this.patch(i=>r(i.ranges)))}</div>`:l}
        ${e.kind==="weekly"&&e.perDay?o`${[...e.perDay.entries()].sort((r,i)=>r[0]-i[0]).map(([r,i])=>o`
          <div class="field"><span class="lbl">${a(`wd${r}`)}</span>${this.renderRanges(i,c=>this.patch(u=>c(u.perDay.get(r))))}</div>`)}`:l}
        ${e.kind==="once"?o`
          <div class="field"><label for="dw-date">${a("fDate")}</label><input id="dw-date" type="date" lang=${D()} .value=${e.date} min=${this.today()}
            @change=${r=>this.patch(i=>i.date=r.target.value)}></div>
          <div class="field">${this.renderRanges(e.ranges,r=>this.patch(i=>r(i.ranges)))}</div>`:l}
        ${e.kind==="weekly"?o`<div class="field"><label for="dw-cal">${a("fCalendar")}</label>
          <select id="dw-cal" @change=${r=>this.patch(i=>i.calendar=r.target.value)}>
            ${At.map(r=>o`<option value=${r} ?selected=${e.calendar===r}>${a(`cal_${r}`)}</option>`)}</select></div>`:l}
        ${this.preview?o`<div class="preview card" data-dw-preview><b>${a("previewTitle")}</b>
          <span class="muted">${this.preview.tier==="prepared"?a("previewPrepared"):a("previewEngine")}</span>
          ${this.preview.doors.map(r=>o`<div><b>${r.label}</b>
            ${r.occurrences.length?o`<ul class="lines">${r.occurrences.map(i=>o`<li><span>${a(`wd${W(S(i.start_at,r.zone))}`)} ${S(i.start_at,r.zone)}</span>
              <span>${_(i.start_at,r.zone)}–${_(i.end_at,r.zone)}</span></li>`)}</ul>`:o`<div class="muted">${a("previewNone")}</div>`}</div>`)}
        </div>`:l}
        ${this.draftError?o`<div class="err" role="alert" data-dw-error>${this.draftError}</div>`:l}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" data-dw-preview-btn @click=${()=>void this.doPreview()}>${a("preview")}</sw-button>
        <sw-button variant="secondary" data-dw-save-draft ?disabled=${this.busy} @click=${()=>this.save(!1)}>${a("saveDraft")}</sw-button>
        <sw-button variant="primary" data-dw-save-enable ?disabled=${this.busy} @click=${()=>this.save(!0)}>${a("saveEnable")}</sw-button>
      </div>
      ${this.renderConfirm()}
    </sw-drawer>`}renderConfirm(){const e=this.confirm;return e?o`<sw-dialog open heading=${e.title} @close=${()=>this.confirm=null} data-dw-confirm>
      <p>${e.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.confirm=null}>${a("cancel")}</sw-button>
        <sw-button variant=${e.danger?"danger":"primary"} data-dw-confirm-btn ?disabled=${this.busy} @click=${()=>void this.run(e)}>${e.btn}</sw-button>
      </div>
    </sw-dialog>`:l}renderManual(){const e=this.manual;return e?o`<sw-dialog open heading=${a("manualTitle")} @close=${()=>this.manual=null} data-dw-manual-dialog>
      <p>${a("manualText")}</p>
      <div class="radio" role="radiogroup">
        ${["camera","door"].map(t=>o`<label><input type="radio" name="checked" data-dw-checked=${t} .checked=${e.checked===t}
          @change=${()=>this.manual={...e,checked:t}}> ${a(t==="camera"?"manualCamera":"manualDoor")}</label>`)}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${()=>this.manual=null}>${a("cancel")}</sw-button>
        <sw-button variant="danger" data-dw-manual-confirm ?disabled=${!e.checked||this.busy} @click=${()=>void this.saveManual()}>${a("manualBtn")}</sw-button>
      </div>
    </sw-dialog>`:l}};h.styles=[T,Ke,se`
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
    .seg { display: flex; flex-wrap: wrap; gap: 6px; }
    .seg button, .days button {
      font: inherit; padding: 6px 12px; min-block-size: 32px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); cursor: pointer;
      transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .seg button:active, .days button:active { transform: scale(0.97); }
    .seg button:focus-visible, .days button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    @media (hover: hover) and (pointer: fine) {
      .seg button:hover:not([aria-pressed='true']), .days button:hover:not([aria-pressed='true']) { border-color: var(--sw-border-strong); background: var(--sw-surface-2); }
    }
    @media (pointer: coarse) { .seg button, .days button { min-block-size: 44px; } }
    .seg button[aria-pressed='true'], .days button[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
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
  `];f([$({attribute:!1})],h.prototype,"route",2);f([p()],h.prototype,"data",2);f([p()],h.prototype,"em",2);f([p()],h.prototype,"error",2);f([p()],h.prototype,"forbidden",2);f([p()],h.prototype,"draft",2);f([p()],h.prototype,"draftError",2);f([p()],h.prototype,"preview",2);f([p()],h.prototype,"busy",2);f([p()],h.prototype,"confirm",2);f([p()],h.prototype,"manual",2);f([p()],h.prototype,"sheet",2);f([p()],h.prototype,"grantsOpen",2);f([p()],h.prototype,"holidaysOpen",2);f([p()],h.prototype,"openForOpen",2);f([p()],h.prototype,"openForDoor",2);f([p()],h.prototype,"settingsOpen",2);f([p()],h.prototype,"ws",2);f([p()],h.prototype,"wsEdit",2);f([p()],h.prototype,"wLive",2);f([p()],h.prototype,"engineOffAsk",2);f([p()],h.prototype,"es",2);f([p()],h.prototype,"esEdit",2);f([p()],h.prototype,"sError",2);h=f([N("door-windows-screen")],h);export{h as DoorWindowsScreen};
