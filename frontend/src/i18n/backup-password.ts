/**
 * BACKUP-HASH-ENC: the words of the backup password in Settings › אבחון › גיבוי ושחזור (create and restore). The local accounts'
 * passwords travel in a backup only encrypted with this password; without it they are left out. Hebrew first; English, Arabic and
 * Russian columns follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an
 * INITIAL translation and need a native review (dev-marked). `{n}` placeholders are filled by `bpt(key, { n })`.
 */
const he = {
  createLabel: 'סיסמת גיבוי',
  createHint: 'מצפינה את סיסמאות החשבונות המקומיים בתוך הגיבוי. בלי סיסמה הן לא נכללות בגיבוי. שמרו אותה במקום בטוח: בלעדיה אי אפשר לשחזר אותן.',
  createPlaceholder: 'לפחות {n} תווים (אופציונלי)',
  minLabel: 'אורך מינימלי לסיסמת גיבוי',
  minHint: 'בין 8 ל־64 תווים. חל על גיבויים חדשים; גיבוי קיים נפתח בסיסמה שלו',
  minSaved: 'האורך המינימלי נשמר',
  minRange: 'ערך בין 8 ל־64',
  createdEncrypted: 'סיסמאות החשבונות המקומיים מוצפנות בגיבוי',
  createdOmitted: 'הגיבוי נוצר בלי סיסמאות החשבונות המקומיים',
  badgeEncrypted: 'מוצפן',
  badgeOmitted: 'בלי סיסמאות',
  badgeLegacy: 'גיבוי ישן',
  restoreLabel: 'סיסמת הגיבוי',
  restoreHint: 'הגיבוי מכיל {n} סיסמאות מוצפנות של חשבונות מקומיים',
  restoreSkip: 'שחזור בלי סיסמאות החשבונות המקומיים',
  restoreSkipHint: 'חשבון מקומי שאין לו סיסמה בהתקנה הזו יצטרך קישור איפוס ממנהל',
  restoreOmitted: 'הגיבוי נוצר בלי סיסמת גיבוי: סיסמאות החשבונות המקומיים לא נכללו בו',
  restoreLegacy: 'גיבוי מגרסה ישנה: סיסמאות החשבונות המקומיים שמורות בו בלי הצפנה. שמרו את הקובץ במקום מוגן או מחקו אותו אחרי השחזור.',
  resultNeedReset: '{n} חשבונות מקומיים צריכים קישור איפוס סיסמה',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  createLabel: 'Backup password',
  createHint: 'Encrypts the local accounts’ passwords inside the backup. Without a password they are left out. Keep it safe: without it they cannot be restored.',
  createPlaceholder: 'At least {n} characters (optional)',
  minLabel: 'Minimum backup password length',
  minHint: '8 to 64 characters. Applies to new backups; an existing backup opens with its own password',
  minSaved: 'Minimum length saved',
  minRange: 'A value from 8 to 64',
  createdEncrypted: 'Local account passwords are encrypted in the backup',
  createdOmitted: 'The backup was created without the local account passwords',
  badgeEncrypted: 'Encrypted',
  badgeOmitted: 'No passwords',
  badgeLegacy: 'Old backup',
  restoreLabel: 'Backup password',
  restoreHint: 'The backup holds {n} encrypted local account passwords',
  restoreSkip: 'Restore without the local account passwords',
  restoreSkipHint: 'A local account with no password on this installation will need a reset link from an administrator',
  restoreOmitted: 'This backup was created without a backup password: the local account passwords are not in it',
  restoreLegacy: 'Backup from an older version: the local account passwords are stored in it unencrypted. Keep the file protected or delete it after the restore.',
  resultNeedReset: '{n} local accounts need a password reset link',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  createLabel: 'كلمة مرور النسخة الاحتياطية',
  createHint: 'تشفّر كلمات مرور الحسابات المحلية داخل النسخة الاحتياطية. بدون كلمة مرور لا تُضمَّن. احفظها في مكان آمن: بدونها لا يمكن استعادتها.',
  createPlaceholder: '{n} حرفًا على الأقل (اختياري)',
  minLabel: 'الحد الأدنى لطول كلمة مرور النسخة الاحتياطية',
  minHint: 'من 8 إلى 64 حرفًا. يسري على النسخ الجديدة؛ النسخة الموجودة تُفتح بكلمة مرورها',
  minSaved: 'تم حفظ الحد الأدنى للطول',
  minRange: 'قيمة من 8 إلى 64',
  createdEncrypted: 'كلمات مرور الحسابات المحلية مشفّرة في النسخة الاحتياطية',
  createdOmitted: 'أُنشئت النسخة الاحتياطية بدون كلمات مرور الحسابات المحلية',
  badgeEncrypted: 'مشفّرة',
  badgeOmitted: 'بدون كلمات مرور',
  badgeLegacy: 'نسخة قديمة',
  restoreLabel: 'كلمة مرور النسخة الاحتياطية',
  restoreHint: 'تحتوي النسخة على {n} كلمات مرور مشفّرة لحسابات محلية',
  restoreSkip: 'الاستعادة بدون كلمات مرور الحسابات المحلية',
  restoreSkipHint: 'الحساب المحلي الذي لا يملك كلمة مرور في هذا التثبيت سيحتاج رابط إعادة تعيين من المسؤول',
  restoreOmitted: 'أُنشئت هذه النسخة بدون كلمة مرور: كلمات مرور الحسابات المحلية غير موجودة فيها',
  restoreLegacy: 'نسخة من إصدار قديم: كلمات مرور الحسابات المحلية محفوظة فيها بدون تشفير. احفظ الملف في مكان محمي أو احذفه بعد الاستعادة.',
  resultNeedReset: '{n} حسابات محلية تحتاج رابط إعادة تعيين كلمة المرور',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  createLabel: 'Пароль резервной копии',
  createHint: 'Шифрует пароли локальных учётных записей внутри резервной копии. Без пароля они не включаются. Храните его надёжно: без него их нельзя восстановить.',
  createPlaceholder: 'Не менее {n} символов (необязательно)',
  minLabel: 'Минимальная длина пароля резервной копии',
  minHint: 'От 8 до 64 символов. Применяется к новым копиям; существующая копия открывается своим паролем',
  minSaved: 'Минимальная длина сохранена',
  minRange: 'Значение от 8 до 64',
  createdEncrypted: 'Пароли локальных учётных записей зашифрованы в резервной копии',
  createdOmitted: 'Резервная копия создана без паролей локальных учётных записей',
  badgeEncrypted: 'Зашифровано',
  badgeOmitted: 'Без паролей',
  badgeLegacy: 'Старая копия',
  restoreLabel: 'Пароль резервной копии',
  restoreHint: 'В копии {n} зашифрованных паролей локальных учётных записей',
  restoreSkip: 'Восстановить без паролей локальных учётных записей',
  restoreSkipHint: 'Локальной учётной записи без пароля в этой установке понадобится ссылка для сброса от администратора',
  restoreOmitted: 'Эта копия создана без пароля: пароли локальных учётных записей в неё не включены',
  restoreLegacy: 'Копия старой версии: пароли локальных учётных записей хранятся в ней без шифрования. Храните файл защищённым или удалите его после восстановления.',
  resultNeedReset: '{n} локальным учётным записям нужна ссылка для сброса пароля',
};

export type BptKey = Key;
export type BptLang = 'he' | 'en' | 'ar' | 'ru';

export function bptLang(): BptLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<BptLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const BPT_DEV_MARKED: readonly BptLang[] = ['ar', 'ru'];

export function bpt(key: Key, vars?: Record<string, string | number>, lang: BptLang = bptLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const BPT_KEYS = Object.keys(he) as Key[];
export const BPT_TABLES = TABLES;
