/**
 * DOORWIN3-295: the words of the event-rule editor, the holiday list and the "open for N hours" dialog of the door-windows screen.
 * One row per key: [he, en, ar, ru]. Hebrew first; the Arabic and Russian columns are an INITIAL translation, approved without a native
 * review (dev-marked, like the rest of the door-windows module). No row names a platform or a vendor, none is a hint paragraph, and none claims
 * a physical door state Arx did not measure. `{name}` placeholders are filled by `dwe(key, { name })`. Times and numbers stay text (never mirrored).
 */
import type { DwtLang } from './door-windows';
import { dwtLang } from './door-windows';

const ROWS = {
  // ---- event rules
  kind_event: ['לפי אירוע', 'By event', 'حسب حدث', 'По событию'],
  evSection: ['חלונות לפי אירוע', 'Event windows', 'نوافذ حسب الحدث', 'Окна по событию'],
  evNew: ['כלל אירוע חדש', 'New event rule', 'قاعدة حدث جديدة', 'Новое правило по событию'],
  evEditorNew: ['כלל אירוע חדש', 'New event rule', 'قاعدة حدث جديدة', 'Новое правило по событию'],
  evEditorEdit: ['עריכת כלל אירוע', 'Edit event rule', 'تعديل قاعدة الحدث', 'Правка правила по событию'],
  evEmpty: ['עוד לא הוגדרו כללי אירוע.', 'No event rules yet.', 'لم تُحدَّد قواعد حدث بعد.', 'Правил по событию пока нет.'],
  src_label: ['מקור האירוע', 'Event source', 'مصدر الحدث', 'Источник события'],
  src_ha_event: ['אירוע חיצוני', 'External event', 'حدث خارجي', 'Внешнее событие'],
  src_arx_automation: ['אוטומציה', 'Automation', 'أتمتة', 'Автоматизация'],
  src_arx_button: ['כפתור במסך', 'Button on screen', 'زر على الشاشة', 'Кнопка на экране'],
  fAutomation: ['מזהה האוטומציה', 'Automation id', 'معرّف الأتمتة', 'Идентификатор автоматизации'],
  fAutomationPh: ['automation.entrance_button', 'automation.entrance_button', 'automation.entrance_button', 'automation.entrance_button'],
  fDurationMin: ['משך החלון (דקות)', 'Window length (minutes)', 'مدة النافذة (دقائق)', 'Длительность окна (мин)'],
  fAllowedFrom: ['מותר משעה', 'Allowed from', 'مسموح من', 'Разрешено с'],
  fAllowedTo: ['עד שעה', 'Until', 'حتى', 'До'],
  fAllowedAll: ['בכל שעה', 'Any hour', 'في أي ساعة', 'В любое время'],
  fAllowedLimit: ['הגבלת שעות', 'Limit the hours', 'تحديد الساعات', 'Ограничить часы'],
  fMaxPerDay: ['הפעלות ביום לדלת', 'Starts per door per day', 'مرات التشغيل لكل باب يوميًا', 'Запусков на дверь в день'],
  fCooldownMin: ['המתנה בין הפעלות (דקות)', 'Wait between starts (minutes)', 'الانتظار بين مرات التشغيل (دقائق)', 'Пауза между запусками (мин)'],
  fRegenerate: ['קוד חדש בשמירה', 'New code on save', 'رمز جديد عند الحفظ', 'Новый код при сохранении'],
  capDay: ['תקרה ליום: {n}', 'Day cap: {n}', 'الحد اليومي: {n}', 'Лимит в день: {n}'],
  capStorm: ['תקרת סערה: {n} בשעה', 'Storm cap: {n} per hour', 'حد العاصفة: {n} في الساعة', 'Лимит всплеска: {n} в час'],
  capQuiet: ['שעות שקטות {from}–{to}', 'Quiet hours {from}–{to}', 'ساعات الهدوء {from}–{to}', 'Тихие часы {from}–{to}'],
  capCooldown: ['המתנה {n} דק׳', 'Wait {n} min', 'انتظار {n} د', 'Пауза {n} мин'],
  capLength: ['משך {n} דק׳', 'Length {n} min', 'المدة {n} د', 'Длина {n} мин'],
  capHours: ['{from}–{to}', '{from}–{to}', '{from}–{to}', '{from}–{to}'],
  errSource: ['בחרו מקור לאירוע.', 'Choose an event source.', 'اختر مصدر الحدث.', 'Выберите источник события.'],
  errAutomation: ['הזינו מזהה אוטומציה בצורה automation.name', 'Enter an automation id like automation.name', 'أدخل معرّف أتمتة بالشكل automation.name', 'Введите идентификатор вида automation.name'],
  errDuration: ['משך החלון חייב להיות בין דקה ל־{h} שעות.', 'The length must be between one minute and {h} h.', 'يجب أن تكون المدة بين دقيقة و{h} ساعات.', 'Длительность — от минуты до {h} ч.'],
  errAllowed: ['שעת הסיום חייבת להיות אחרי שעת ההתחלה.', 'The end must be after the start.', 'يجب أن تكون النهاية بعد البداية.', 'Конец должен быть позже начала.'],
  errQuiet: ['הטווח נוגע בשעות השקטות.', 'The range touches the quiet hours.', 'النطاق يلامس ساعات الهدوء.', 'Диапазон задевает тихие часы.'],
  errCap: ['מספר ההפעלות ליום: 1 עד {n}.', 'Starts per day: 1 to {n}.', 'مرات التشغيل يوميًا: من 1 إلى {n}.', 'Запусков в день: от 1 до {n}.'],
  errCooldown: ['ההמתנה: 0 עד 1440 דקות.', 'The wait: 0 to 1440 minutes.', 'الانتظار: من 0 إلى 1440 دقيقة.', 'Пауза: от 0 до 1440 мин.'],
  // ---- simulate / arm
  arm_simulate: ['מדומה', 'Simulated', 'محاكاة', 'Имитация'],
  arm_armed: ['פעיל', 'Armed', 'مفعّل', 'Включено'],
  arm_unavailable: ['הפעלה אמיתית אינה זמינה', 'Arming is not available', 'التفعيل الفعلي غير متاح', 'Боевой режим недоступен'],
  armBtn: ['הפעלה אמיתית', 'Arm', 'تفعيل فعلي', 'Включить'],
  disarmBtn: ['חזרה לסימולציה', 'Back to simulation', 'العودة إلى المحاكاة', 'Назад к имитации'],
  confirmArm: ['הכלל יפתח דלתות באמת כשהאירוע יגיע. הפעולה נרשמת על שמך.', 'The rule will really open doors when the event arrives. This is recorded in your name.', 'ستفتح القاعدة الأبواب فعلًا عند وصول الحدث. يُسجَّل ذلك باسمك.', 'Правило будет реально открывать двери при событии. Запись — на ваше имя.'],
  confirmDisarm: ['הכלל יחזור לסימולציה: אירוע יירשם אבל דלת לא תיפתח.', 'The rule returns to simulation: events are logged, no door opens.', 'تعود القاعدة إلى المحاكاة: يُسجَّل الحدث ولا يُفتح باب.', 'Правило вернётся к имитации: события пишутся, двери не открываются.'],
  armRefused: ['ההפעלה האמיתית נדחתה: אין עדיין זהות אוטומציה מאומתת.', 'Arming was refused: there is no verified automation identity yet.', 'رُفض التفعيل: لا توجد هوية أتمتة موثّقة بعد.', 'Включение отклонено: проверенной учётной записи автоматизации пока нет.'],
  // ---- token
  tokenTitle: ['קוד האירוע מוצג פעם אחת', 'The event code is shown once', 'يُعرض رمز الحدث مرة واحدة', 'Код события показывается один раз'],
  tokenCopy: ['העתקה', 'Copy', 'نسخ', 'Копировать'],
  tokenCopied: ['הועתק', 'Copied', 'تم النسخ', 'Скопировано'],
  tokenNew: ['קוד חדש', 'New code', 'رمز جديد', 'Новый код'],
  tokenHas: ['קיים קוד', 'Code set', 'الرمز موجود', 'Код задан'],
  confirmToken: ['הקוד הקודם יפסיק לעבוד מיד והכלל יחזור לסימולציה.', 'The old code stops working at once and the rule returns to simulation.', 'يتوقف الرمز القديم فورًا وتعود القاعدة إلى المحاكاة.', 'Старый код перестанет работать сразу, правило вернётся к имитации.'],
  // ---- trigger log
  logTitle: ['הפעלות אחרונות', 'Recent starts', 'آخر مرات التشغيل', 'Последние запуски'],
  logEmpty: ['עוד לא היו הפעלות.', 'No starts yet.', 'لا توجد تشغيلات بعد.', 'Запусков пока не было.'],
  dec_started: ['נפתח', 'Started', 'بدأ', 'Запущено'],
  dec_extended: ['הוארך', 'Extended', 'مُدِّد', 'Продлено'],
  dec_simulated: ['סימולציה', 'Simulated', 'محاكاة', 'Имитация'],
  dec_refused: ['נדחה', 'Refused', 'مرفوض', 'Отклонено'],
  reason_storm: ['יותר מדי הפעלות בשעה', 'Too many starts in an hour', 'تشغيلات كثيرة في الساعة', 'Слишком много запусков в час'],
  reason_exterior_not_allowed: ['דלת חיצונית', 'Exterior door', 'باب خارجي', 'Наружная дверь'],
  reason_closed_day: ['יום סגור', 'Closed day', 'يوم مغلق', 'Закрытый день'],
  reason_outside_hours: ['מחוץ לשעות המותרות', 'Outside the allowed hours', 'خارج الساعات المسموحة', 'Вне разрешённых часов'],
  reason_too_long: ['ארוך מהמותר', 'Longer than allowed', 'أطول من المسموح', 'Дольше разрешённого'],
  reason_crosses_midnight: ['חוצה חצות', 'Crosses midnight', 'يتجاوز منتصف الليل', 'Пересекает полночь'],
  reason_ambiguous_time: ['שעה לא חד־משמעית', 'Ambiguous time', 'وقت غير واضح', 'Неоднозначное время'],
  reason_quiet_hours: ['שעות שקטות', 'Quiet hours', 'ساعات الهدوء', 'Тихие часы'],
  reason_relock_unconfirmed: ['חזרה לרגיל טרם אושרה', 'Return to normal not confirmed', 'العودة إلى الوضع العادي لم تُؤكَّد', 'Возврат в обычный режим не подтверждён'],
  reason_emergency: ['מצב חירום', 'Emergency', 'حالة طوارئ', 'Аварийный режим'],
  reason_paused: ['הופסק ידנית', 'Paused by a person', 'أُوقف يدويًا', 'Остановлено вручную'],
  reason_inside_window: ['כבר בחלון', 'Already in a window', 'داخل نافذة بالفعل', 'Уже в окне'],
  reason_overlaps_window: ['חופף חלון', 'Overlaps a window', 'يتداخل مع نافذة', 'Пересекается с окном'],
  reason_already_covered: ['כבר פתוח עד אז', 'Already open until then', 'مفتوح بالفعل حتى ذلك الحين', 'Уже открыто до этого времени'],
  reason_would_extend_running: ['הארכת חלון שרץ כבויה', 'Extending a running window is off', 'تمديد نافذة جارية متوقف', 'Продление идущего окна выключено'],
  reason_extended_already: ['כבר הוארך פעם', 'Already extended once', 'مُدِّد مرة بالفعل', 'Уже продлено один раз'],
  reason_would_extend: ['היה מאריך', 'Would extend', 'كان سيمدّد', 'Продлило бы'],
  reason_daily_cap: ['תקרה יומית', 'Day cap', 'الحد اليومي', 'Дневной лимит'],
  reason_rule_daily_cap: ['תקרה יומית של הכלל', 'Rule day cap', 'الحد اليومي للقاعدة', 'Дневной лимит правила'],
  reason_cooldown: ['בהמתנה', 'Cooling down', 'قيد الانتظار', 'Пауза'],
  reason_unknown_rule: ['כלל לא מוכר', 'Unknown rule', 'قاعدة غير معروفة', 'Неизвестное правило'],
  reason_bad_token: ['קוד שגוי', 'Wrong code', 'رمز خاطئ', 'Неверный код'],
  reason_item_changed: ['האוטומציה השתנתה', 'The automation changed', 'تغيّرت الأتمتة', 'Автоматизация изменилась'],
  reason_authorising_actor_lost: ['המאשר איבד הרשאה', 'The approver lost access', 'فقد المُعتمِد صلاحيته', 'У утвердившего пропал доступ'],
  reason_already_handled: ['כבר טופל', 'Already handled', 'تمت معالجته', 'Уже обработано'],
  reason_other: ['נדחה', 'Refused', 'مرفوض', 'Отклонено'],
  // ---- holidays
  hlBtn: ['חגים', 'Holidays', 'العطل', 'Праздники'],
  hlTitle: ['חגים וימים מיוחדים', 'Holidays and special days', 'العطل والأيام الخاصة', 'Праздники и особые дни'],
  hlEmpty: ['אין ימים מיוחדים ברשימה.', 'No special days in the list.', 'لا أيام خاصة في القائمة.', 'В списке нет особых дней.'],
  hlGenerator: ['רשימת החגים', 'Holiday list', 'قائمة العطل', 'Список праздников'],
  gen_israel: ['חגי ישראל', 'Israeli holidays', 'الأعياد الإسرائيلية', 'Праздники Израиля'],
  gen_none: ['ללא רשימה', 'No list', 'بلا قائمة', 'Без списка'],
  hlColDate: ['תאריך', 'Date', 'التاريخ', 'Дата'],
  hlColName: ['שם', 'Name', 'الاسم', 'Название'],
  hlColKind: ['סוג היום', 'Day type', 'نوع اليوم', 'Тип дня'],
  hlColSource: ['מקור', 'Source', 'المصدر', 'Источник'],
  dk_holiday: ['חג', 'Holiday', 'عيد', 'Праздник'],
  dk_holiday_eve: ['ערב חג', 'Holiday eve', 'ليلة العيد', 'Канун праздника'],
  dk_regular: ['יום רגיל', 'Regular day', 'يوم عادي', 'Обычный день'],
  dk_closed: ['סגור', 'Closed', 'مغلق', 'Закрыто'],
  hlSrcGenerated: ['מהרשימה', 'From the list', 'من القائمة', 'Из списка'],
  hlSrcManual: ['שונה ידנית', 'Changed by hand', 'عُدِّل يدويًا', 'Изменено вручную'],
  hlWas: ['ברירת מחדל: {kind}', 'Default: {kind}', 'الافتراضي: {kind}', 'По умолчанию: {kind}'],
  hlReset: ['שחזור ברירת מחדל', 'Restore default', 'استعادة الافتراضي', 'Вернуть по умолчанию'],
  hlRemove: ['הסרה', 'Remove', 'إزالة', 'Убрать'],
  hlAdd: ['הוספת יום', 'Add a day', 'إضافة يوم', 'Добавить день'],
  hlLabel: ['שם היום', 'Day name', 'اسم اليوم', 'Название дня'],
  hlSave: ['שמירה', 'Save', 'حفظ', 'Сохранить'],
  hlLoading: ['טוען את רשימת החגים…', 'Loading the holiday list…', 'جارٍ تحميل قائمة العطل…', 'Загрузка списка праздников…'],
  hlLoadError: ['לא ניתן לטעון את רשימת החגים', 'The holiday list could not be loaded', 'تعذّر تحميل قائمة العطل', 'Не удалось загрузить список праздников'],
  hlConfirm: ['{date}: {kind}. השינוי משפיע על פתיחת דלתות בתאריך הזה.', '{date}: {kind}. This changes when doors open on that date.', '{date}: {kind}. هذا يغيّر موعد فتح الأبواب في هذا التاريخ.', '{date}: {kind}. Это меняет открытие дверей в эту дату.'],
  hlConfirmReset: ['{date} יחזור לברירת המחדל של הרשימה.', '{date} returns to the list default.', 'يعود {date} إلى الافتراضي في القائمة.', '{date} вернётся к значению списка.'],
  hlConfirmGenerator: ['רשימת החגים תשתנה: {name}. זה משפיע על כל החלונות.', 'The holiday list changes: {name}. This affects every window.', 'ستتغير قائمة العطل: {name}. هذا يؤثر على كل النوافذ.', 'Список праздников изменится: {name}. Это влияет на все окна.'],
  errHlDate: ['בחרו תאריך.', 'Choose a date.', 'اختر تاريخًا.', 'Выберите дату.'],
  // ---- open for N hours
  ofBtn: ['פתיחה לזמן קצוב', 'Open for hours', 'فتح لعدة ساعات', 'Открыть на часы'],
  ofTitle: ['פתיחת דלת לזמן קצוב', 'Open a door for a set time', 'فتح باب لمدة محددة', 'Открыть дверь на заданное время'],
  ofDoor: ['דלת', 'Door', 'الباب', 'Дверь'],
  ofHours: ['שעות', 'Hours', 'ساعات', 'Часы'],
  ofHoursN: ['{n} ש׳', '{n} h', '{n} س', '{n} ч'],
  ofConfirm: ['פתיחה ל־{n} שעות', 'Open for {n} h', 'فتح لمدة {n} ساعات', 'Открыть на {n} ч'],
  ofConfirmText: ['{door} תוחזק פתוחה עד {end}, ואז תחזור למצב רגיל. הפעולה נרשמת על שמך.', '{door} stays open until {end}, then returns to normal. This is recorded in your name.', 'يبقى {door} مفتوحًا حتى {end} ثم يعود إلى الوضع العادي. يُسجَّل ذلك باسمك.', '{door} останется открытой до {end}, затем вернётся в обычный режим. Запись — на ваше имя.'],
  ofStarted: ['החלון נפתח עד {end}', 'Window open until {end}', 'النافذة مفتوحة حتى {end}', 'Окно открыто до {end}'],
  ofExtended: ['החלון הוארך עד {end}', 'Window extended to {end}', 'مُدِّدت النافذة حتى {end}', 'Окно продлено до {end}'],
  ofNoDoors: ['אין דלתות שמותר לך לנהל.', 'No doors you may manage.', 'لا أبواب يمكنك إدارتها.', 'Нет дверей, которыми вы можете управлять.'],
} as const;

export type DweKey = keyof typeof ROWS;
export const DWE_KEYS = Object.keys(ROWS) as DweKey[];
const COL: Record<DwtLang, 0 | 1 | 2 | 3> = { he: 0, en: 1, ar: 2, ru: 3 };

export const DWE_TABLES: Record<DwtLang, Record<DweKey, string>> = (['he', 'en', 'ar', 'ru'] as const).reduce((acc, lang) => {
  acc[lang] = Object.fromEntries(DWE_KEYS.map((k) => [k, ROWS[k][COL[lang]]])) as Record<DweKey, string>;
  return acc;
}, {} as Record<DwtLang, Record<DweKey, string>>);

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function dwe(key: DweKey, vars?: Record<string, string | number>, lang: DwtLang = dwtLang()): string {
  const raw = DWE_TABLES[lang][key] ?? DWE_TABLES.he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** A run-time key (`reason_<code>`, `dec_<decision>`, `dk_<kind>`...), or the fallback when there is none. */
export function dweDynamic(key: string, fallback: DweKey, vars?: Record<string, string | number>): string {
  return key in ROWS ? dwe(key as DweKey, vars) : dwe(fallback, vars);
}
