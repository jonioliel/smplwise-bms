/**
 * WAPACE-295: the words of the WhatsApp policy card (recipient allow-list and self-messages test window) in Settings > messaging channel.
 * Hebrew first; English, Arabic and Russian follow the document language. Every key exists in all four tables (unit-messaging-policy.spec.ts
 * holds the parity); the Arabic and Russian columns are an INITIAL translation that needs a native review (dev-marked).
 * `{name}` placeholders are filled by `mw(key, { name })`.
 */
type Lang = 'he' | 'en' | 'ar' | 'ru';

const he = {
  title: 'מדיניות שליחה בוואטסאפ',
  allowTitle: 'רשימת מותרים: מטפלים וספקים',
  enforce: 'לשלוח רק לרשימה',
  enforceOff: 'כבוי: כל נמען יקבל הודעה',
  blocksAll: 'האכיפה פעילה והרשימה ריקה: שום הודעה לא תישלח',
  phone: 'מספר (עם קידומת מדינה)',
  label: 'שם',
  role: 'תפקיד',
  role_handler: 'מטפל',
  role_provider: 'ספק',
  role_other: 'אחר',
  add: 'הוספה',
  remove: 'הסרה',
  empty: 'הרשימה ריקה',
  page: 'עמוד {n} מתוך {m}',
  prev: 'הקודם',
  next: 'הבא',
  selfTitle: 'הודעות לעצמי לבדיקה',
  selfMinutes: 'דקות',
  selfStart: 'הפעלה',
  selfStop: 'כיבוי',
  selfActive: 'פעיל עד {time}',
  selfOff: 'כבוי',
  saved: 'נשמר',
  loadError: 'טעינת המדיניות נכשלה',
  retry: 'נסו שוב',
  err_phone: 'מספר לא תקין',
  err_label: 'יש להזין שם',
  err_minutes: 'ערך בין {lo} ל-{hi}',
  err_listed: 'המספר כבר ברשימה',
  readOnly: 'צפייה בלבד',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  title: 'WhatsApp sending policy',
  allowTitle: 'Allow-list: handlers and providers',
  enforce: 'Send only to the list',
  enforceOff: 'Off: every recipient may be messaged',
  blocksAll: 'Enforcement is on and the list is empty: no message will be sent',
  phone: 'Number (with country code)',
  label: 'Name',
  role: 'Role',
  role_handler: 'Handler',
  role_provider: 'Provider',
  role_other: 'Other',
  add: 'Add',
  remove: 'Remove',
  empty: 'The list is empty',
  page: 'Page {n} of {m}',
  prev: 'Previous',
  next: 'Next',
  selfTitle: 'Self-messages for testing',
  selfMinutes: 'Minutes',
  selfStart: 'Turn on',
  selfStop: 'Turn off',
  selfActive: 'On until {time}',
  selfOff: 'Off',
  saved: 'Saved',
  loadError: 'Could not load the policy',
  retry: 'Try again',
  err_phone: 'Invalid number',
  err_label: 'Enter a name',
  err_minutes: 'A value from {lo} to {hi}',
  err_listed: 'The number is already listed',
  readOnly: 'View only',
};

const ar: Record<Key, string> = {
  title: 'سياسة الإرسال عبر واتساب',
  allowTitle: 'قائمة المسموح لهم: المعالجون والمزوّدون',
  enforce: 'الإرسال إلى القائمة فقط',
  enforceOff: 'متوقف: يمكن مراسلة أي مستلم',
  blocksAll: 'التطبيق مفعّل والقائمة فارغة: لن تُرسل أي رسالة',
  phone: 'الرقم (مع رمز الدولة)',
  label: 'الاسم',
  role: 'الدور',
  role_handler: 'معالج',
  role_provider: 'مزوّد',
  role_other: 'آخر',
  add: 'إضافة',
  remove: 'إزالة',
  empty: 'القائمة فارغة',
  page: 'الصفحة {n} من {m}',
  prev: 'السابق',
  next: 'التالي',
  selfTitle: 'رسائل إلى النفس للاختبار',
  selfMinutes: 'دقائق',
  selfStart: 'تشغيل',
  selfStop: 'إيقاف',
  selfActive: 'يعمل حتى {time}',
  selfOff: 'متوقف',
  saved: 'تم الحفظ',
  loadError: 'تعذّر تحميل السياسة',
  retry: 'حاول مرة أخرى',
  err_phone: 'رقم غير صالح',
  err_label: 'أدخل اسماً',
  err_minutes: 'قيمة من {lo} إلى {hi}',
  err_listed: 'الرقم موجود في القائمة',
  readOnly: 'للعرض فقط',
};

const ru: Record<Key, string> = {
  title: 'Политика отправки в WhatsApp',
  allowTitle: 'Список разрешённых: исполнители и поставщики',
  enforce: 'Отправлять только по списку',
  enforceOff: 'Выключено: сообщения можно слать любому получателю',
  blocksAll: 'Проверка включена, список пуст: ни одно сообщение не будет отправлено',
  phone: 'Номер (с кодом страны)',
  label: 'Имя',
  role: 'Роль',
  role_handler: 'Исполнитель',
  role_provider: 'Поставщик',
  role_other: 'Другое',
  add: 'Добавить',
  remove: 'Убрать',
  empty: 'Список пуст',
  page: 'Страница {n} из {m}',
  prev: 'Назад',
  next: 'Далее',
  selfTitle: 'Сообщения самому себе для проверки',
  selfMinutes: 'Минуты',
  selfStart: 'Включить',
  selfStop: 'Выключить',
  selfActive: 'Включено до {time}',
  selfOff: 'Выключено',
  saved: 'Сохранено',
  loadError: 'Не удалось загрузить политику',
  retry: 'Повторить',
  err_phone: 'Неверный номер',
  err_label: 'Введите имя',
  err_minutes: 'Значение от {lo} до {hi}',
  err_listed: 'Номер уже в списке',
  readOnly: 'Только просмотр',
};

export type MwKey = Key;
export const MW_TABLES: Record<Lang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const MW_DEV_MARKED: readonly Lang[] = ['ar', 'ru'];
export const MW_KEYS = Object.keys(he) as Key[];

export function mwLang(): Lang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

export function mw(key: Key, vars?: Record<string, string | number>, lang: Lang = mwLang()): string {
  const raw = MW_TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}
