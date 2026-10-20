/**
 * usr2-passkeys-only-mode: the words of the optional per-user "passkeys only" sign-in mode (החשבון שלי › מפתחות גישה, and Settings ›
 * משתמשים והרשאות › משתמשי Arx). Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back to
 * the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review (dev-marked, like the elevators).
 * Short labels only: operator screens carry no hint paragraphs; the server's refusal text (user_message) explains a refusal.
 */
const he = {
  onlyLabel: 'כניסה עם מפתח גישה בלבד',
  onlyOn: 'כניסה עם מפתח גישה בלבד: פעילה',
  onlyEnable: 'הפעלה',
  onlyDisable: 'כיבוי',
  onlyConfirmOn: 'הכניסה בסיסמה תיחסם. להמשיך?',
  onlyConfirmOff: 'להחזיר כניסה בסיסמה?',
} as const;

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  onlyLabel: 'Sign in with a passkey only',
  onlyOn: 'Passkey-only sign-in: on',
  onlyEnable: 'Turn on',
  onlyDisable: 'Turn off',
  onlyConfirmOn: 'Password sign-in will be blocked. Continue?',
  onlyConfirmOff: 'Allow password sign-in again?',
};

const ar: Partial<Record<Key, string>> = {
  onlyLabel: 'الدخول بمفتاح المرور فقط',
  onlyOn: 'الدخول بمفتاح المرور فقط: مفعّل',
  onlyEnable: 'تفعيل',
  onlyDisable: 'إيقاف',
  onlyConfirmOn: 'سيتم حظر الدخول بكلمة المرور. هل تريد المتابعة؟',
  onlyConfirmOff: 'السماح بالدخول بكلمة المرور من جديد؟',
};

const ru: Partial<Record<Key, string>> = {
  onlyLabel: 'Вход только по ключу доступа',
  onlyOn: 'Вход только по ключу доступа: включён',
  onlyEnable: 'Включить',
  onlyDisable: 'Выключить',
  onlyConfirmOn: 'Вход по паролю будет заблокирован. Продолжить?',
  onlyConfirmOff: 'Снова разрешить вход по паролю?',
};

export type PoKey = Key;
export type PoLang = 'he' | 'en' | 'ar' | 'ru';

export function poLang(): PoLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<PoLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const PO_DEV_MARKED: readonly PoLang[] = ['ar', 'ru'];

export function po(key: Key, lang: PoLang = poLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const PO_KEYS = Object.keys(he) as Key[];
export const PO_TABLES = TABLES;
