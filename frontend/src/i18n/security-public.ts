/**
 * SECFIX2-295 (owner decisions 2026-10-21): the words of the "public interface" security settings page (#/system/security/public) and of
 * the undecided-technicians panel of the external-access screen. Hebrew first; English, Arabic and Russian follow the document language
 * (a missing key falls back to the Hebrew; a unit test holds the parity). The Arabic and Russian columns are an INITIAL translation and
 * need a native review (dev-marked). The home platform is never named.
 */
const he = {
  // the settings page
  tab: 'ממשק ציבורי',
  title: 'ממשק ציבורי',
  secPending: 'טכנאים שספקים הזינו',
  retention: 'מחיקה אוטומטית אחרי (ימים)',
  cap: 'מקסימום ממתינים לספק',
  zeroOff: '0 = כבוי',
  secPortal: 'פורטל ספקים',
  startWorker: 'עיבוד בקשות כניסה בתור נפרד',
  secAccess: 'בקרת כניסה',
  uniform404: 'תשובה אחידה לרשומת אדם פגומה',
  save: 'שמירה',
  saved: 'נשמר',
  saveFailed: 'השמירה נכשלה',
  invalidRetention: 'ערך בין 7 ל־365, או 0',
  invalidCap: 'ערך בין 0 ל־100',
  loadFailed: 'הטעינה נכשלה',
  retry: 'נסו שוב',
  // the pending panel
  pendTitle: 'טכנאים ממתינים לאישור',
  pendTicket: 'קריאה {n}',
  pendDays: 'ממתין {n} ימים',
  pendToday: 'ממתין מהיום',
  pendLeft: 'יימחק בעוד {n} ימים',
  pendLeftToday: 'יימחק היום',
  pendNoAuto: 'ללא מחיקה אוטומטית',
  approve: 'אישור',
  reject: 'דחייה ומחיקה',
  approveQ: 'לאשר את {name}?',
  approveText: 'הטכנאי יאושר. קוד כניסה יישלח רק אחרי אימות המספר שלו ואישור גישה.',
  rejectQ: 'לדחות ולמחוק את {name}?',
  rejectText: 'השם ומספר הטלפון יימחקו והבקשה שלו תסתיים.',
  approveDone: 'הטכנאי אושר',
  rejectDone: 'הטכנאי נדחה ונמחק',
  failed: 'הפעולה נכשלה',
  cancel: 'ביטול',
};
type Key = keyof typeof he;

const en: Record<Key, string> = {
  tab: 'Public interface',
  title: 'Public interface',
  secPending: 'Technicians added by vendors',
  retention: 'Delete automatically after (days)',
  cap: 'Most pending per vendor',
  zeroOff: '0 = off',
  secPortal: 'Vendor portal',
  startWorker: 'Process sign-in requests in a separate queue',
  secAccess: 'Access control',
  uniform404: 'Uniform answer for a malformed person record',
  save: 'Save',
  saved: 'Saved',
  saveFailed: 'Saving failed',
  invalidRetention: 'A value from 7 to 365, or 0',
  invalidCap: 'A value from 0 to 100',
  loadFailed: 'Loading failed',
  retry: 'Try again',
  pendTitle: 'Technicians waiting for approval',
  pendTicket: 'Request {n}',
  pendDays: 'Waiting {n} days',
  pendToday: 'Waiting since today',
  pendLeft: 'Deleted in {n} days',
  pendLeftToday: 'Deleted today',
  pendNoAuto: 'No automatic deletion',
  approve: 'Approve',
  reject: 'Reject and delete',
  approveQ: 'Approve {name}?',
  approveText: 'The technician is approved. An entry code is sent only after his number is confirmed and access is approved.',
  rejectQ: 'Reject and delete {name}?',
  rejectText: 'The name and phone number are deleted and his request ends.',
  approveDone: 'Technician approved',
  rejectDone: 'Technician rejected and deleted',
  failed: 'The action failed',
  cancel: 'Cancel',
};

// initial translation - needs a native review (dev-marked)
const ar: Record<Key, string> = {
  tab: 'الواجهة العامة',
  title: 'الواجهة العامة',
  secPending: 'فنيون أضافهم الموردون',
  retention: 'الحذف التلقائي بعد (أيام)',
  cap: 'الحد الأقصى للمنتظرين لكل مورد',
  zeroOff: '0 = متوقف',
  secPortal: 'بوابة الموردين',
  startWorker: 'معالجة طلبات الدخول في طابور منفصل',
  secAccess: 'التحكم في الدخول',
  uniform404: 'رد موحد لسجل شخص تالف',
  save: 'حفظ',
  saved: 'تم الحفظ',
  saveFailed: 'فشل الحفظ',
  invalidRetention: 'قيمة من 7 إلى 365، أو 0',
  invalidCap: 'قيمة من 0 إلى 100',
  loadFailed: 'فشل التحميل',
  retry: 'حاول مرة أخرى',
  pendTitle: 'فنيون بانتظار الموافقة',
  pendTicket: 'طلب {n}',
  pendDays: 'بالانتظار منذ {n} أيام',
  pendToday: 'بالانتظار منذ اليوم',
  pendLeft: 'سيُحذف بعد {n} أيام',
  pendLeftToday: 'سيُحذف اليوم',
  pendNoAuto: 'بدون حذف تلقائي',
  approve: 'موافقة',
  reject: 'رفض وحذف',
  approveQ: 'الموافقة على {name}؟',
  approveText: 'تتم الموافقة على الفني. يُرسل رمز الدخول فقط بعد تأكيد رقمه والموافقة على الدخول.',
  rejectQ: 'رفض وحذف {name}؟',
  rejectText: 'يُحذف الاسم ورقم الهاتف وينتهي طلبه.',
  approveDone: 'تمت الموافقة على الفني',
  rejectDone: 'تم رفض الفني وحذفه',
  failed: 'فشل الإجراء',
  cancel: 'إلغاء',
};

// initial translation - needs a native review (dev-marked)
const ru: Record<Key, string> = {
  tab: 'Публичный интерфейс',
  title: 'Публичный интерфейс',
  secPending: 'Техники, добавленные поставщиками',
  retention: 'Автоудаление через (дней)',
  cap: 'Максимум ожидающих на поставщика',
  zeroOff: '0 = выкл.',
  secPortal: 'Портал поставщиков',
  startWorker: 'Обрабатывать запросы входа в отдельной очереди',
  secAccess: 'Контроль доступа',
  uniform404: 'Единый ответ для повреждённой записи человека',
  save: 'Сохранить',
  saved: 'Сохранено',
  saveFailed: 'Не удалось сохранить',
  invalidRetention: 'Значение от 7 до 365 или 0',
  invalidCap: 'Значение от 0 до 100',
  loadFailed: 'Не удалось загрузить',
  retry: 'Повторить',
  pendTitle: 'Техники ждут подтверждения',
  pendTicket: 'Заявка {n}',
  pendDays: 'Ожидает {n} дн.',
  pendToday: 'Ожидает с сегодняшнего дня',
  pendLeft: 'Удаление через {n} дн.',
  pendLeftToday: 'Удаление сегодня',
  pendNoAuto: 'Без автоудаления',
  approve: 'Подтвердить',
  reject: 'Отклонить и удалить',
  approveQ: 'Подтвердить {name}?',
  approveText: 'Техник подтверждён. Код входа отправляется только после подтверждения его номера и одобрения доступа.',
  rejectQ: 'Отклонить и удалить {name}?',
  rejectText: 'Имя и номер телефона удаляются, его заявка закрывается.',
  approveDone: 'Техник подтверждён',
  rejectDone: 'Техник отклонён и удалён',
  failed: 'Действие не выполнено',
  cancel: 'Отмена',
};

export type SpKey = Key;
export type SpLang = 'he' | 'en' | 'ar' | 'ru';

export function spLang(): SpLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<SpLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const SP_DEV_MARKED: readonly SpLang[] = ['ar', 'ru'];

export function spt(key: Key, vars?: Record<string, string | number>, lang: SpLang = spLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const SP_KEYS = Object.keys(he) as Key[];
export const SP_TABLES = TABLES;
