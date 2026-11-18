/**
 * GENELEV-295: the words of the "how a critical alert escalates" explainer in Settings > Infrastructure > Generator > alert routing.
 * Every sentence describes what the code does today (services/generator_alerts.py `escalation_after_min` / `critical_escalate_after_min`,
 * services/notify.py `_escalate_at` / `escalation_tick` / `escalation_targets`); nothing here promises behaviour the code does not have.
 * Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian
 * columns are an INITIAL translation and need a native review (dev-marked). `{n}` is filled with the critical delay in minutes.
 * Operator words only: the home platform is never named.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'איך התראה קריטית מסלימה',
  sub: 'כך זה עובד היום',
  who: 'כשהתראה נפתחת היא נשלחת לנמענים של סוג ההתראה. סוג ללא נמענים משלו מקבל את ברירת המחדל של החומרה שלו. אם לא נבחר אף אחד, אף אחד לא מקבל אותה בשלב הזה.',
  critical: 'התראה קריטית שלא אושרה תוך {n} דקות נשלחת לנמעני ההסלמה: בעלי הרשאת ניהול התראות (או המשתמשים שנבחרו בהגדרות ההתראות) שמורשים לראות אותה. זה קורה גם כשההסלמה כבויה בהגדרות ההתראות.',
  steps: 'שלבי הסלמה נוספים חוזרים במרווח ובמספר השלבים שנקבעו בהגדרות ההתראות (1 עד 3).',
  other: 'חומרה אחרת מסלימה רק כשההסלמה פעילה בסוג ההתראה, אחרי הדקות שנקבעו שם. בלי ערך משלו היא משתמשת באותן {n} דקות.',
  stops: 'אישור ההתראה, או חזרת המצב לתקין, עוצרים את ההסלמה מיד. התראה קריטית אינה נעצרת בשעות שקט, וגם הסלמה עוקפת אותן.',
  where: 'איפה עורכים: נמענים וערוצים לפי סוג התראה או לפי חומרה בטבלאות למטה. השהיית {n} הדקות בברירת המחדל של "קריטית". הסלמה של סוג בודד בחלונית העריכה שלו. נמעני ההסלמה, מספר השלבים והמרווח בהגדרות ההתראות.',
  perm: 'שינוי הניתוב דורש הרשאת ניהול גנרטור. הוספת WhatsApp דורשת גם הרשאת ניהול התראות.',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/generator-escalation').en>('en', 'i18n/generator-escalation', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/generator-escalation').ar>('ar', 'i18n/generator-escalation', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/generator-escalation').ru>('ru', 'i18n/generator-escalation', 'ru');

type GescLang = 'he' | 'en' | 'ar' | 'ru';

function gescLang(): GescLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<GescLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const GESC_DEV_MARKED: readonly GescLang[] = ['ar', 'ru'];

export function gesc(key: Key, vars?: Record<string, string | number>, lang: GescLang = gescLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** The body sentences in reading order (the title and subtitle are separate). */
export const GESC_BODY: readonly Key[] = ['who', 'critical', 'steps', 'other', 'stops', 'where', 'perm'];
export const GESC_KEYS = Object.keys(he) as Key[];
export const GESC_TABLES = TABLES;

registerCatalogue('i18n/generator-escalation', { he, en, ar, ru }, GESC_DEV_MARKED);
