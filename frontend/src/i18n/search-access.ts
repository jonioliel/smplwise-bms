/**
 * TOPPILL-295: the words of הגדרות › כללי › "חיפוש בפינה העליונה" (who may use the search in the top-left pill). Hebrew first; English
 * follows the document language (a missing key falls back to the Hebrew).
 */
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
const en: Record<Key, string> = {
  label: 'Search in the top corner',
  hint: 'Off by default: a search can take a person to places you may not want them to reach. A system administrator can always use it while it is on.',
  off: 'Off (default)',
  admins: 'System administrators only',
  roles: 'System administrators and the chosen roles',
  all: 'All users',
  rolesTitle: 'Roles that see the search',
};

export function sa(key: Key): string {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return (l.startsWith('en') ? en[key] : he[key]) ?? he[key];
}
