// CR-CONFIRM-DIALOG-2438: the words of the shared confirmation dialog (components/confirm-dialog.ts), which replaced the browser's
// native confirm() box. The question itself comes from the caller, in the caller's own table.

const he = {
  heading: 'נדרש אישור',
  ok: 'אישור',
  cancel: 'ביטול',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  heading: 'Please confirm',
  ok: 'OK',
  cancel: 'Cancel',
};

const ar: Record<Key, string> = {
  heading: 'يرجى التأكيد',
  ok: 'موافق',
  cancel: 'إلغاء',
};

const ru: Record<Key, string> = {
  heading: 'Требуется подтверждение',
  ok: 'ОК',
  cancel: 'Отмена',
};

export type CdKey = Key;
export type CdLang = 'he' | 'en' | 'ar' | 'ru';

export function cdLang(): CdLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<CdLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const CD_DEV_MARKED: readonly CdLang[] = ['ar', 'ru'];

export function cdt(key: Key, lang: CdLang = cdLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const CD_KEYS = Object.keys(he) as Key[];
export const CD_TABLES = TABLES;
