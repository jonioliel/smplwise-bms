/**
 * CR-WA-PACING-295: the words of the shared send-budget card in Settings > messaging channel. Hebrew first; English, Arabic and Russian
 * follow the document language. Every key exists in all four tables (unit-messaging-pacing.spec.ts holds the parity); the Arabic and
 * Russian columns are an INITIAL translation that needs a native review (dev-marked). A Settings page may name WhatsApp and WisKey.
 * `{name}` placeholders are filled by `mp(key, { name })`.
 */
type Lang = 'he' | 'en' | 'ar' | 'ru';

const he = {
  title: 'קצב שליחה משותף',
  mode: 'מצב',
  mode_conservative: 'שמרני',
  mode_standard: 'רגיל',
  mode_off: 'כבוי',
  wiskey: 'WisKey שולח מאותו מספר',
  inactive: 'לא פעיל',
  limits: 'המתנה מרבית בדקות',
  cls_alert: 'התראות',
  cls_code: 'קודי אימות',
  cls_ticket: 'הודעות',
  cls_reminder: 'תזכורות',
  budget: '{n} בדקה · פרץ {b}',
  sentHour: 'נשלחו בשעה האחרונה',
  wiskeyHour: 'מהן WisKey',
  waiting: 'ממתינות',
  oldest: 'ההמתנה הארוכה ביותר',
  deferred: 'נדחו ב-24 שעות',
  slowed: 'האטות מהפלטפורמה',
  expired: 'הסתיימו בלי שליחה',
  backoffUntil: 'מואט עד {time}',
  pairs: 'נמענים מואטים: {n}',
  noAccounts: 'אין חשבונות',
  unit_s: '{n} שנ׳',
  unit_m: '{n} דק׳',
  unit_h: '{n} שע׳',
  saved: 'נשמר',
  retry: 'נסו שוב',
  err_range: 'ערך בין 1 ל-2880',
  loadError: 'לא ניתן לטעון את הקצב',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  title: 'Shared send pace',
  mode: 'Mode',
  mode_conservative: 'Conservative',
  mode_standard: 'Standard',
  mode_off: 'Off',
  wiskey: 'WisKey sends from the same number',
  inactive: 'Inactive',
  limits: 'Longest wait, minutes',
  cls_alert: 'Alerts',
  cls_code: 'Verification codes',
  cls_ticket: 'Messages',
  cls_reminder: 'Reminders',
  budget: '{n} a minute · burst {b}',
  sentHour: 'Sent in the last hour',
  wiskeyHour: 'of them WisKey',
  waiting: 'Waiting',
  oldest: 'Longest wait',
  deferred: 'Deferred in 24 hours',
  slowed: 'Platform slow-downs',
  expired: 'Ended without sending',
  backoffUntil: 'Slowed until {time}',
  pairs: 'Slowed recipients: {n}',
  noAccounts: 'No accounts',
  unit_s: '{n} s',
  unit_m: '{n} min',
  unit_h: '{n} h',
  saved: 'Saved',
  retry: 'Try again',
  err_range: 'A value from 1 to 2880',
  loadError: 'The pace could not be loaded',
};

const ar: Record<Key, string> = {
  title: 'وتيرة الإرسال المشتركة',
  mode: 'الوضع',
  mode_conservative: 'متحفظ',
  mode_standard: 'عادي',
  mode_off: 'متوقف',
  wiskey: 'WisKey يرسل من الرقم نفسه',
  inactive: 'غير فعّال',
  limits: 'أقصى انتظار بالدقائق',
  cls_alert: 'التنبيهات',
  cls_code: 'رموز التحقق',
  cls_ticket: 'الرسائل',
  cls_reminder: 'التذكيرات',
  budget: '{n} في الدقيقة · دفعة {b}',
  sentHour: 'أُرسلت في الساعة الأخيرة',
  wiskeyHour: 'منها من WisKey',
  waiting: 'قيد الانتظار',
  oldest: 'أطول انتظار',
  deferred: 'مؤجلة خلال 24 ساعة',
  slowed: 'إبطاء من المنصة',
  expired: 'انتهت دون إرسال',
  backoffUntil: 'مُبطأ حتى {time}',
  pairs: 'مستلمون مُبطؤون: {n}',
  noAccounts: 'لا توجد حسابات',
  unit_s: '{n} ث',
  unit_m: '{n} د',
  unit_h: '{n} س',
  saved: 'تم الحفظ',
  retry: 'حاولوا مرة أخرى',
  err_range: 'قيمة من 1 إلى 2880',
  loadError: 'تعذّر تحميل الوتيرة',
};

const ru: Record<Key, string> = {
  title: 'Общий темп отправки',
  mode: 'Режим',
  mode_conservative: 'Осторожный',
  mode_standard: 'Обычный',
  mode_off: 'Выключен',
  wiskey: 'WisKey отправляет с того же номера',
  inactive: 'Не действует',
  limits: 'Максимальное ожидание, минут',
  cls_alert: 'Оповещения',
  cls_code: 'Коды подтверждения',
  cls_ticket: 'Сообщения',
  cls_reminder: 'Напоминания',
  budget: '{n} в минуту · пакет {b}',
  sentHour: 'Отправлено за последний час',
  wiskeyHour: 'из них WisKey',
  waiting: 'Ожидают',
  oldest: 'Самое долгое ожидание',
  deferred: 'Отложено за 24 часа',
  slowed: 'Замедления платформы',
  expired: 'Завершены без отправки',
  backoffUntil: 'Замедлено до {time}',
  pairs: 'Замедленных получателей: {n}',
  noAccounts: 'Нет аккаунтов',
  unit_s: '{n} с',
  unit_m: '{n} мин',
  unit_h: '{n} ч',
  saved: 'Сохранено',
  retry: 'Повторить',
  err_range: 'Значение от 1 до 2880',
  loadError: 'Не удалось загрузить темп',
};

export type MpKey = Key;
export const MP_TABLES: Record<Lang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const MP_DEV_MARKED: readonly Lang[] = ['ar', 'ru'];
export const MP_KEYS = Object.keys(he) as Key[];

export function mpLang(): Lang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

export function mp(key: Key, vars?: Record<string, string | number>, lang: Lang = mpLang()): string {
  const raw = MP_TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}
