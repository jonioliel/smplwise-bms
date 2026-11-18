/**
 * TOPPILL-295: the words of הגדרות › כללי › "חיפוש בפינה העליונה" (who may use the search in the top-left pill). Hebrew first; English
 * follows the document language (a missing key falls back to the Hebrew).
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  label: 'חיפוש בפינה העליונה',
  hint: 'כבוי כברירת מחדל: חיפוש מאפשר להגיע למקומות שלא בטוח שרוצים שמשתמש יגיע אליהם. מנהל מערכת תמיד יכול כשהוא פעיל.',
  off: 'כבוי (ברירת מחדל)',
  admins: 'למנהלי מערכת בלבד',
  roles: 'למנהלי מערכת ולתפקידים שנבחרו',
  all: 'לכל המשתמשים',
  rolesTitle: 'התפקידים שרואים את החיפוש',
};
type Key = keyof typeof he;
const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/search-access').en>('en', 'i18n/search-access', 'en');

export function sa(key: Key): string {
  return (docLang(['en']) === 'en' ? en[key] : he[key]) ?? he[key];
}

registerCatalogue('i18n/search-access', { he, en });
