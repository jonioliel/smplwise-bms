/**
 * NOTIFWA: the strings of the WhatsApp section of Settings › התראות (`<notify-whatsapp-section>`). A Settings page may name WhatsApp; the home
 * platform is never named (UI_COPY_RULES). Hebrew first; English, Arabic and Russian columns are used by the document language (a missing key
 * falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review. `{name}` placeholders are
 * filled by `nwt(key, { name })`.
 */
const he = {
  on: 'פעיל',
  off: 'כבוי',
  attention: 'דורש טיפול',
  title: 'וואטסאפ',
  sub: 'התראות לטלפון האישי של המשתמש, מהחשבון שנבחר בערוץ ההודעות',
  enabled: 'שליחת התראות בוואטסאפ',
  enabledHint: 'כבוי = שום התראה לא נשלחת בוואטסאפ, גם אם סומנה במדיניות',
  account: 'חשבון שולח',
  accountNone: 'לא נבחר חשבון',
  accountPick: 'בחירת חשבון',
  st_connected: 'מחובר',
  st_disconnected: 'מנותק',
  st_unknown: 'לא ידוע',
  st_missing: 'לא נמצא',
  reach: 'משתמשים עם מספר',
  reachHint: 'מספר מרשימת אנשי הקשר, כשוואטסאפ הוא הערוץ המועדף',
  cap: 'לכל משתמש בשעה',
  capHint: 'התראה קריטית והסלמה אינן נספרות',
  dedupe: 'בלי כפילות במשך',
  minutes: 'דק׳',
  test: 'שליחת בדיקה',
  testing: 'שולח…',
  testHint: 'נשלחת רק למספר שלך ({masked})',
  testNoNumber: 'אין לך מספר וואטסאפ ברשימת אנשי הקשר',
  testOk: 'הודעת הבדיקה נשלחה',
  testFail: 'הבדיקה נכשלה',
  warnOffAccount: 'אין חשבון שולח - ההתראות לא יישלחו',
  saved: 'נשמר',
  loading: 'טוען…',
  error: 'לא ניתן לטעון את הגדרות הוואטסאפ',
  retry: 'נסה שוב',
  less: 'פחות',
  more: 'יותר',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  on: 'On',
  off: 'Off',
  attention: 'Needs attention',
  title: 'WhatsApp',
  sub: "Notifications to the user's own phone, from the account chosen in the message channel",
  enabled: 'Send notifications on WhatsApp',
  enabledHint: 'Off = no notification is sent on WhatsApp, even when a policy selects it',
  account: 'Sending account',
  accountNone: 'No account chosen',
  accountPick: 'Choose an account',
  st_connected: 'Connected',
  st_disconnected: 'Disconnected',
  st_unknown: 'Unknown',
  st_missing: 'Not found',
  reach: 'Users with a number',
  reachHint: 'A number from the contact list, when WhatsApp is the preferred channel',
  cap: 'Per user per hour',
  capHint: 'Critical notifications and escalations are not counted',
  dedupe: 'No repeats within',
  minutes: 'min',
  test: 'Send a test',
  testing: 'Sending…',
  testHint: 'Sent only to your own number ({masked})',
  testNoNumber: 'You have no WhatsApp number in the contact list',
  testOk: 'The test message was sent',
  testFail: 'The test failed',
  warnOffAccount: 'No sending account - notifications will not be sent',
  saved: 'Saved',
  loading: 'Loading…',
  error: 'The WhatsApp settings could not be loaded',
  retry: 'Try again',
  less: 'Less',
  more: 'More',
};

// initial translation - needs a native review
const ar: Partial<Record<Key, string>> = {
  on: 'مفعّل',
  off: 'مطفأ',
  attention: 'يحتاج إلى معالجة',
  title: 'واتساب',
  sub: 'إشعارات إلى الهاتف الشخصي للمستخدم، من الحساب المختار في قناة الرسائل',
  enabled: 'إرسال الإشعارات عبر واتساب',
  enabledHint: 'مطفأ = لا يُرسل أي إشعار عبر واتساب حتى لو تم اختياره في السياسة',
  account: 'الحساب المرسِل',
  accountNone: 'لم يتم اختيار حساب',
  accountPick: 'اختيار حساب',
  st_connected: 'متصل',
  st_disconnected: 'غير متصل',
  st_unknown: 'غير معروف',
  st_missing: 'غير موجود',
  reach: 'مستخدمون لديهم رقم',
  reachHint: 'رقم من قائمة جهات الاتصال، عندما يكون واتساب هو القناة المفضلة',
  cap: 'لكل مستخدم في الساعة',
  capHint: 'الإشعارات الحرجة والتصعيد لا تُحتسب',
  dedupe: 'بدون تكرار خلال',
  minutes: 'دقيقة',
  test: 'إرسال اختبار',
  testing: 'جارٍ الإرسال…',
  testHint: 'يُرسل إلى رقمك فقط ({masked})',
  testNoNumber: 'لا يوجد لديك رقم واتساب في قائمة جهات الاتصال',
  testOk: 'تم إرسال رسالة الاختبار',
  testFail: 'فشل الاختبار',
  warnOffAccount: 'لا يوجد حساب مرسِل - لن تُرسل الإشعارات',
  saved: 'تم الحفظ',
  loading: 'جارٍ التحميل…',
  error: 'تعذّر تحميل إعدادات واتساب',
  retry: 'إعادة المحاولة',
  less: 'أقل',
  more: 'أكثر',
};

// initial translation - needs a native review
const ru: Partial<Record<Key, string>> = {
  on: 'Включено',
  off: 'Выключено',
  attention: 'Требует внимания',
  title: 'WhatsApp',
  sub: 'Уведомления на личный телефон пользователя с аккаунта, выбранного в канале сообщений',
  enabled: 'Отправлять уведомления в WhatsApp',
  enabledHint: 'Выключено = ни одно уведомление не отправляется в WhatsApp, даже если оно выбрано в политике',
  account: 'Аккаунт отправителя',
  accountNone: 'Аккаунт не выбран',
  accountPick: 'Выбрать аккаунт',
  st_connected: 'Подключён',
  st_disconnected: 'Отключён',
  st_unknown: 'Неизвестно',
  st_missing: 'Не найден',
  reach: 'Пользователи с номером',
  reachHint: 'Номер из списка контактов, если WhatsApp — предпочтительный канал',
  cap: 'На пользователя в час',
  capHint: 'Критические уведомления и эскалации не учитываются',
  dedupe: 'Без повторов в течение',
  minutes: 'мин',
  test: 'Отправить тест',
  testing: 'Отправка…',
  testHint: 'Отправляется только на ваш номер ({masked})',
  testNoNumber: 'У вас нет номера WhatsApp в списке контактов',
  testOk: 'Тестовое сообщение отправлено',
  testFail: 'Тест не удался',
  warnOffAccount: 'Нет аккаунта отправителя — уведомления не будут отправлены',
  saved: 'Сохранено',
  loading: 'Загрузка…',
  error: 'Не удалось загрузить настройки WhatsApp',
  retry: 'Повторить',
  less: 'Меньше',
  more: 'Больше',
};

export type NwtKey = Key;
export type NwtLang = 'he' | 'en' | 'ar' | 'ru';

export function nwtLang(): NwtLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<NwtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };

export function nwt(key: Key, vars?: Record<string, string | number>, lang: NwtLang = nwtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const NWT_KEYS = Object.keys(he) as Key[];
export const NWT_TABLES = TABLES;
