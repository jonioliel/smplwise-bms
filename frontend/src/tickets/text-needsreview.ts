/**
 * NEEDSREVIEW (2.8.0): the words of the "needs review" privacy report (דוח דורש בחינה) on "מטפלים וספקים" › דורש בחינה, its "reject and
 * delete" / "delete now" confirmations and its two threshold settings. Merged into tickets/text.ts (`...NR_HE`, `...NR_EN`) and read
 * through `tt()`. Short (clean operator screens), no internal codes, the infrastructure never named, the door system called "מערכת הכניסה".
 */
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

export const NR_HE = {
  hdSeg_review: 'דורש בחינה',
  nrPendingTitle: 'ממתינים לאישור מעל {n} ימים',
  nrIdleTitle: 'ללא גישה מעל {n} חודשים',
  nrEmpty: 'אין מה לבחון',
  nrLoadFailed: 'לא ניתן לטעון את הדוח',
  nrDays: '{n} ימים',
  nrMonths: '{n} חודשים',
  nrSince: 'ממתין מ־{date}',
  nrLast: 'פעילות אחרונה {date}',
  nrDoorTag: 'גם במערכת הכניסה',
  nrReject: 'דחייה ומחיקה',
  nrDelete: 'מחיקה עכשיו',
  nrRejectTitle: 'לדחות ולמחוק את {name}?',
  nrDeleteTitle: 'למחוק את {name}?',
  nrRejectBody: 'השם והטלפון יימחקו והבקשה של הספק תיסגר. אי אפשר לבטל.',
  nrDeleteBody: 'השם והטלפון יימחקו, גם בהיסטוריה. אי אפשר לבטל.',
  nrDoorNote: 'האדם קיים גם במערכת הכניסה. ההסרה משם נפרדת, ידנית ובאישור.',
  nrConfirmReject: 'דחייה ומחיקה',
  nrConfirmDelete: 'מחיקה',
  nrCancel: 'ביטול',
  nrRejected: 'נדחה ונמחק',
  nrDeleted: 'נמחק',
  nrDeletedDoor: 'נמחק. ההסרה ממערכת הכניסה נשארה ידנית.',
  nrThresholds: 'ספי הדוח',
  nrPendingDays: 'ממתין לאישור (ימים)',
  nrIdleMonths: 'ללא גישה (חודשים)',
  nrSave: 'שמירה',
  nrSaved: 'נשמר',
} as const;

export const NR_EN: Record<keyof typeof NR_HE, string> = packTable<typeof import('../i18n/lang/en/tickets/text-needsreview').NR_EN>('en', 'tickets/text-needsreview', 'NR_EN');

/**
 * DEV-MARKED (NEEDSREVIEW, 2026-10-18): an INITIAL Arabic and Russian translation (the text-deptmgr.ts precedent). The tickets screens
 * read Hebrew / English only today (tickets/text.ts `ticketsLang`), so nothing reads these yet; they wait for a native review before an
 * Arabic / Russian column is wired.
 */
export const NR_AR_DEV: Record<keyof typeof NR_HE, string> = {
  hdSeg_review: 'يتطلب مراجعة',
  nrPendingTitle: 'بانتظار الموافقة أكثر من {n} يومًا',
  nrIdleTitle: 'بلا دخول منذ أكثر من {n} شهرًا',
  nrEmpty: 'لا شيء للمراجعة',
  nrLoadFailed: 'تعذّر تحميل التقرير',
  nrDays: '{n} يومًا',
  nrMonths: '{n} شهرًا',
  nrSince: 'بانتظار منذ {date}',
  nrLast: 'آخر نشاط {date}',
  nrDoorTag: 'موجود أيضًا في نظام الدخول',
  nrReject: 'رفض وحذف',
  nrDelete: 'حذف الآن',
  nrRejectTitle: 'رفض وحذف {name}؟',
  nrDeleteTitle: 'حذف {name}؟',
  nrRejectBody: 'سيُحذف الاسم والهاتف ويُغلق طلب المورّد. لا يمكن التراجع.',
  nrDeleteBody: 'سيُحذف الاسم والهاتف، في السجل أيضًا. لا يمكن التراجع.',
  nrDoorNote: 'هذا الشخص موجود أيضًا في نظام الدخول. إزالته من هناك خطوة يدوية منفصلة تتطلب موافقة.',
  nrConfirmReject: 'رفض وحذف',
  nrConfirmDelete: 'حذف',
  nrCancel: 'إلغاء',
  nrRejected: 'تم الرفض والحذف',
  nrDeleted: 'تم الحذف',
  nrDeletedDoor: 'تم الحذف. الإزالة من نظام الدخول تبقى يدوية.',
  nrThresholds: 'حدود التقرير',
  nrPendingDays: 'بانتظار الموافقة (أيام)',
  nrIdleMonths: 'بلا دخول (أشهر)',
  nrSave: 'حفظ',
  nrSaved: 'تم الحفظ',
};

export const NR_RU_DEV: Record<keyof typeof NR_HE, string> = {
  hdSeg_review: 'Требует проверки',
  nrPendingTitle: 'Ожидают одобрения дольше {n} дней',
  nrIdleTitle: 'Без доступа дольше {n} месяцев',
  nrEmpty: 'Проверять нечего',
  nrLoadFailed: 'Не удалось загрузить отчёт',
  nrDays: '{n} дн.',
  nrMonths: '{n} мес.',
  nrSince: 'Ожидает с {date}',
  nrLast: 'Последняя активность {date}',
  nrDoorTag: 'Есть и в системе доступа',
  nrReject: 'Отклонить и удалить',
  nrDelete: 'Удалить сейчас',
  nrRejectTitle: 'Отклонить и удалить {name}?',
  nrDeleteTitle: 'Удалить {name}?',
  nrRejectBody: 'Имя и телефон будут стёрты, запрос поставщика закрыт. Отменить нельзя.',
  nrDeleteBody: 'Имя и телефон будут стёрты, в истории тоже. Отменить нельзя.',
  nrDoorNote: 'Этот человек есть и в системе доступа. Удаление оттуда — отдельный ручной шаг с подтверждением.',
  nrConfirmReject: 'Отклонить и удалить',
  nrConfirmDelete: 'Удалить',
  nrCancel: 'Отмена',
  nrRejected: 'Отклонён и удалён',
  nrDeleted: 'Удалён',
  nrDeletedDoor: 'Удалён. Удаление из системы доступа остаётся ручным.',
  nrThresholds: 'Пороги отчёта',
  nrPendingDays: 'Ожидание одобрения (дни)',
  nrIdleMonths: 'Без доступа (месяцы)',
  nrSave: 'Сохранить',
  nrSaved: 'Сохранено',
};

registerCatalogue('tickets/text-needsreview', { he: NR_HE, en: NR_EN });
