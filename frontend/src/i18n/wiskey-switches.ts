/**
 * SWITCHUI-295: the words of Settings > Security > "קריאות בקרת כניסה" (#/system/security/wiskey) - the four switches that let Arx ask
 * the access-control system for a read. Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back
 * to the Hebrew; a unit test holds the parity). The Arabic and Russian columns are an INITIAL translation and need a native review
 * (dev-marked). No internal key name and no home-platform name on the face; the key is shown only in the small details line.
 * WISKEY-RC7-ADOPT-2331 S1: the `install*` words - the owner's automatic-installation switch, a separate group on the same screen.
 */
const he = {
  tab: 'קריאות בקרת כניסה',
  title: 'קריאות בקרת כניסה',
  lead: 'מתגים שמאפשרים למערכת לבקש מידע ממערכת בקרת הכניסה. כל מתג כבוי כברירת מחדל.',
  on: 'פועל',
  off: 'כבוי',
  detailsKey: 'שם פנימי',
  accessTitle: 'מצב הגישה של אדם',
  accessText: 'בדיקה מול בקרת הכניסה אם הרשאה שבוטלה אכן הוסרה.',
  scheduleTitle: 'השוואת לוח זמנים',
  scheduleText: 'בדיקה אם לוח הזמנים אצל בקרת הכניסה זהה למה שאושר.',
  presenceTitle: 'נוכחות',
  presenceText: 'מידע לבירור בלבד; אינו משמש להוכחת הסרה.',
  plansTitle: 'תוכניות יכולות',
  plansText: 'קריאה של תוכניות בלבד; שום תוכנית אינה מבוצעת.',
  permitMissing: 'אי אפשר להפעיל עדיין: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו.',
  permitRefused: 'ההפעלה נדחתה: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו. המתג נשאר כבוי.',
  forbidden: 'רק מנהל מערכת יכול לשנות הגדרה זו.',
  invalid: 'הבקשה אינה תקינה.',
  failed: 'השמירה נכשלה',
  loadFailed: 'הטעינה נכשלה',
  retry: 'נסו שוב',
  turnOn: 'הפעלה',
  turnOff: 'כיבוי',
  cancel: 'ביטול',
  confirmOnQ: 'להפעיל את "{name}"?',
  confirmOnText: 'המערכת תתחיל לבקש מידע זה ממערכת בקרת הכניסה. אפשר לכבות שוב בכל רגע.',
  confirmOffQ: 'לכבות את "{name}"?',
  confirmOffText: 'המערכת תפסיק לבקש מידע זה. מה שאי אפשר לוודא ייחשב כלא ידוע.',
  doneOn: 'המתג הופעל',
  doneOff: 'המתג כובה',
  installGroup: 'התקנה אוטומטית',
  installTitle: 'התקנה אוטומטית של רכיב בקרת הכניסה',
  installText: 'כשמופעל, המערכת מתקינה ומעדכנת את רכיב בקרת הכניסה בעצמה, רק אחרי שכל הבדיקות עוברות. התקנה ידנית או זרה לעולם אינה נדרסת.',
  installPermitMissing: 'אי אפשר להפעיל עדיין: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה.',
  installPermitRefused: 'ההפעלה נדחתה: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה. המתג נשאר כבוי.',
  installConfirmOnText: 'המערכת תתקין ותעדכן את רכיב בקרת הכניסה בעצמה, רק כשכל הבדיקות עוברות. התקנה ידנית או זרה לא תידרס. אפשר לכבות בכל רגע.',
  installConfirmOffText: 'המערכת תפסיק להתקין ולעדכן את רכיב בקרת הכניסה. מה שכבר מותקן נשאר כפי שהוא.',
};
type Key = keyof typeof he;

const en: Record<Key, string> = {
  tab: 'Access-control reads',
  title: 'Access-control reads',
  lead: 'Switches that let the system ask the access-control system for information. Every switch is off by default.',
  on: 'On',
  off: 'Off',
  detailsKey: 'Internal name',
  accessTitle: "A person's access state",
  accessText: 'Checks with access control that a revoked permission was really removed.',
  scheduleTitle: 'Schedule comparison',
  scheduleText: 'Checks that the schedule held by access control matches what was approved.',
  presenceTitle: 'Presence',
  presenceText: 'Information for inquiry only; never used as proof of removal.',
  plansTitle: 'Capability plans',
  plansText: 'Reads plans only; no plan is ever carried out.',
  permitMissing: 'It cannot be turned on yet: this version has no go-live permit for this read.',
  permitRefused: 'Turning it on was refused: this version has no go-live permit for this read. The switch stays off.',
  forbidden: 'Only a system administrator can change this setting.',
  invalid: 'The request is not valid.',
  failed: 'Saving failed',
  loadFailed: 'Loading failed',
  retry: 'Try again',
  turnOn: 'Turn on',
  turnOff: 'Turn off',
  cancel: 'Cancel',
  confirmOnQ: 'Turn on "{name}"?',
  confirmOnText: 'The system will start asking access control for this information. You can turn it off again at any time.',
  confirmOffQ: 'Turn off "{name}"?',
  confirmOffText: 'The system will stop asking for this information. Anything that cannot be verified counts as unknown.',
  doneOn: 'The switch is on',
  doneOff: 'The switch is off',
  installGroup: 'Automatic installation',
  installTitle: 'Automatic installation of the access-control component',
  installText: 'When on, the system installs and updates the access-control component by itself, only after every check passes. A manual or foreign installation is never overwritten.',
  installPermitMissing: 'It cannot be turned on yet: the compatibility check of the installation environment cannot pass yet, and the isolated lab test is not done.',
  installPermitRefused: 'Turning it on was refused: the compatibility check of the installation environment cannot pass yet, and the isolated lab test is not done. The switch stays off.',
  installConfirmOnText: 'The system will install and update the access-control component by itself, only when every check passes. A manual or foreign installation is never overwritten. You can turn it off at any time.',
  installConfirmOffText: 'The system will stop installing and updating the access-control component. What is already installed stays as it is.',
};

// initial translation - needs a native review (dev-marked)
const ar: Record<Key, string> = {
  tab: 'قراءات التحكم في الدخول',
  title: 'قراءات التحكم في الدخول',
  lead: 'مفاتيح تتيح للنظام طلب معلومات من نظام التحكم في الدخول. كل مفتاح متوقف افتراضيا.',
  on: 'يعمل',
  off: 'متوقف',
  detailsKey: 'الاسم الداخلي',
  accessTitle: 'حالة وصول شخص',
  accessText: 'تحقق لدى التحكم في الدخول من أن صلاحية ملغاة أُزيلت فعلا.',
  scheduleTitle: 'مقارنة الجدول الزمني',
  scheduleText: 'تحقق من أن الجدول لدى التحكم في الدخول مطابق لما تمت الموافقة عليه.',
  presenceTitle: 'التواجد',
  presenceText: 'معلومات للاستعلام فقط؛ لا تُستخدم كدليل على الإزالة.',
  plansTitle: 'خطط القدرات',
  plansText: 'قراءة الخطط فقط؛ لا تُنفذ أي خطة.',
  permitMissing: 'لا يمكن التشغيل بعد: هذا الإصدار لا يتضمن إذن تشغيل لهذه القراءة.',
  permitRefused: 'رُفض التشغيل: هذا الإصدار لا يتضمن إذن تشغيل لهذه القراءة. يبقى المفتاح متوقفا.',
  forbidden: 'مدير النظام فقط يمكنه تغيير هذا الإعداد.',
  invalid: 'الطلب غير صالح.',
  failed: 'فشل الحفظ',
  loadFailed: 'فشل التحميل',
  retry: 'حاول مرة أخرى',
  turnOn: 'تشغيل',
  turnOff: 'إيقاف',
  cancel: 'إلغاء',
  confirmOnQ: 'تشغيل "{name}"؟',
  confirmOnText: 'سيبدأ النظام بطلب هذه المعلومات من التحكم في الدخول. يمكن إيقافه مجددا في أي وقت.',
  confirmOffQ: 'إيقاف "{name}"؟',
  confirmOffText: 'سيتوقف النظام عن طلب هذه المعلومات. ما لا يمكن التحقق منه يُعد غير معروف.',
  doneOn: 'تم تشغيل المفتاح',
  doneOff: 'تم إيقاف المفتاح',
  installGroup: 'التثبيت التلقائي',
  installTitle: 'التثبيت التلقائي لمكوّن التحكم في الدخول',
  installText: 'عند التشغيل، يثبّت النظام مكوّن التحكم في الدخول ويحدّثه بنفسه، فقط بعد نجاح كل الفحوص. لا يُستبدل أبدا تثبيت يدوي أو غريب.',
  installPermitMissing: 'لا يمكن التشغيل بعد: فحص توافق بيئة التثبيت لا يمكنه النجاح بعد، واختبار المختبر المعزول لم يكتمل.',
  installPermitRefused: 'رُفض التشغيل: فحص توافق بيئة التثبيت لا يمكنه النجاح بعد، واختبار المختبر المعزول لم يكتمل. يبقى المفتاح متوقفا.',
  installConfirmOnText: 'سيثبّت النظام مكوّن التحكم في الدخول ويحدّثه بنفسه، فقط عند نجاح كل الفحوص. لن يُستبدل تثبيت يدوي أو غريب. يمكن الإيقاف في أي وقت.',
  installConfirmOffText: 'سيتوقف النظام عن تثبيت مكوّن التحكم في الدخول وتحديثه. ما هو مثبت يبقى كما هو.',
};

// initial translation - needs a native review (dev-marked)
const ru: Record<Key, string> = {
  tab: 'Запросы к контролю доступа',
  title: 'Запросы к контролю доступа',
  lead: 'Переключатели, позволяющие системе запрашивать данные у системы контроля доступа. По умолчанию все выключены.',
  on: 'Включён',
  off: 'Выключен',
  detailsKey: 'Внутреннее имя',
  accessTitle: 'Состояние доступа человека',
  accessText: 'Проверка у контроля доступа, что отозванное разрешение действительно снято.',
  scheduleTitle: 'Сравнение расписания',
  scheduleText: 'Проверка, что расписание в контроле доступа совпадает с утверждённым.',
  presenceTitle: 'Присутствие',
  presenceText: 'Только справочные данные; не служат доказательством снятия.',
  plansTitle: 'Планы возможностей',
  plansText: 'Только чтение планов; ни один план не выполняется.',
  permitMissing: 'Пока включить нельзя: в этой версии нет разрешения на запуск этого запроса.',
  permitRefused: 'Включение отклонено: в этой версии нет разрешения на запуск этого запроса. Переключатель остаётся выключенным.',
  forbidden: 'Изменить эту настройку может только администратор системы.',
  invalid: 'Некорректный запрос.',
  failed: 'Не удалось сохранить',
  loadFailed: 'Не удалось загрузить',
  retry: 'Повторить',
  turnOn: 'Включить',
  turnOff: 'Выключить',
  cancel: 'Отмена',
  confirmOnQ: 'Включить «{name}»?',
  confirmOnText: 'Система начнёт запрашивать эти данные у контроля доступа. Выключить можно в любой момент.',
  confirmOffQ: 'Выключить «{name}»?',
  confirmOffText: 'Система перестанет запрашивать эти данные. То, что нельзя проверить, считается неизвестным.',
  doneOn: 'Переключатель включён',
  doneOff: 'Переключатель выключен',
  installGroup: 'Автоматическая установка',
  installTitle: 'Автоматическая установка компонента контроля доступа',
  installText: 'Если включено, система сама устанавливает и обновляет компонент контроля доступа, только после прохождения всех проверок. Ручная или чужая установка никогда не перезаписывается.',
  installPermitMissing: 'Пока включить нельзя: проверка совместимости среды установки пока не может пройти, а тест в изолированной лаборатории не завершён.',
  installPermitRefused: 'Включение отклонено: проверка совместимости среды установки пока не может пройти, а тест в изолированной лаборатории не завершён. Переключатель остаётся выключенным.',
  installConfirmOnText: 'Система будет сама устанавливать и обновлять компонент контроля доступа, только когда все проверки пройдены. Ручная или чужая установка не перезаписывается. Выключить можно в любой момент.',
  installConfirmOffText: 'Система перестанет устанавливать и обновлять компонент контроля доступа. Уже установленное остаётся как есть.',
};

export type WsKey = Key;
export type WsLang = 'he' | 'en' | 'ar' | 'ru';

export function wsLang(): WsLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<WsLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const WS_DEV_MARKED: readonly WsLang[] = ['ar', 'ru'];

export function wst(key: Key, vars?: Record<string, string | number>, lang: WsLang = wsLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const WS_KEYS = Object.keys(he) as Key[];
export const WS_TABLES = TABLES;
