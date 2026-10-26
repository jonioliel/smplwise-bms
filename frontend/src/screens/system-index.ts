import { AREA_TABS, SECURITY_SETTINGS_TABS, visibleTabs } from '../shell/nav';
import { tt } from '../tickets/text';
import type { IconName } from '../components/sw-icon';
import type { RouteState } from '../router';

/**
 * SET-polish (2026-10-10): the index of the settings - every destination an administrator can reach under הגדרות, grouped the
 * way people look for things (what it looks like / who may do what / what it is connected to), each with a deep link and the
 * words one would type to find it. The side navigation (`<system-nav>`) and its search are drawn from this table; the tab row
 * of the shell keeps reading `AREA_TABS.system` (the order and visibility an installation configures), and this index follows
 * that visibility: a top-level entry is offered only while its tab is, and its sub-entries with it. Nothing here grants anything:
 * the links lead to screens that check their own permissions.
 */
export interface SettingsEntry {
  /** The top-level tab this entry belongs to (an id of AREA_TABS.system) - decides visibility. */
  tab: string;
  label: string;
  /** The hash address, with the deep link (`?tab=` / `?section=` / a sub-segment) when the screen has one. */
  href: string;
  /** Words a person types to find it (Hebrew and the technical names a settings screen keeps). */
  keywords?: string;
  /** A sub-entry (a tab of the screen): drawn indented under its parent. */
  sub?: boolean;
}

export interface SettingsGroup {
  id: string;
  label: string;
  icon: IconName;
  entries: SettingsEntry[];
}

const GEN = '#/system/diagnostics';

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'look',
    label: 'מראה ותצוגה',
    icon: 'dashboard',
    entries: [
      { tab: 'general', label: 'מראה ותצוגה', href: GEN, keywords: 'מראה סגנון skin בהיר כהה dark light אזור זמן אחסון בריאות צפיפות ניווט נייד אפשרויות צבעי המותג צבע הדגשה מתג accent brand לוגו logo יזם חברת ניהול מיתוג מתקין white label לקוח חבילת לקוח ייצוא ייבוא שם הפרויקט כותרת הדפדפן לשונית גודל הלוגו לוחיתקריסטל crystal רקע תמונת background מצב תצוגה התצוגה סכמטי מלא אוטומטי 3D' },
      { tab: 'general', label: 'לשוניות', href: `${GEN}?tab=tabs`, sub: true, keywords: 'סדר הסתרה סרגל פס תחתון כמוסה dropdown' },
      { tab: 'general', label: 'וידאו ומדיה', href: `${GEN}?tab=media`, sub: true, keywords: 'webrtc mse תעבורה קיר מצלמות קיוסק מסך פתיחה זרמים go2rtc ייצוא שמירה ימים ציר זמן צבעים סקינים AI תלת־ממד 3D מצב תצוגה ריאליסטי realistic תמונות מוכנות stills מסך קיר תצוגת התוכנית מפת תאורה מיקום האתר שמש מיקום הבית ידני קו רוחב קו אורך מעבר לתמונה מוכנה חוסר פעילות idle' },
      { tab: 'general', label: 'מפה', href: `${GEN}?tab=map`, sub: true, keywords: 'קומת ברירת מחדל 2D 3D מפלסים תוכנית תצוגה ריאליסטית realistic סגנון אדריכלי בהיר תאום דיגיטלי כהה שמש שעה מיקום האתר קו רוחב קו אורך רהיטים טקסטורות חתך סיור גובה עין ההעדפה שלי' },
      { tab: 'general', label: 'חשמל והתקנים', href: `${GEN}?tab=devices`, sub: true, keywords: 'זכוכית glass אריחים כרטיסים חיישנים מיזוג מתגים מוגנים מסך ראשי צבעוניות זכוכית' },
      { tab: 'general', label: 'סוגי התקנים', href: `${GEN}?tab=devices&section=device-types`, sub: true, keywords: 'דוד ברז מתג סוג סמל כרטיס פעילות device types' },
      { tab: 'general', label: 'אפליקציה לנייד', href: `${GEN}?tab=mobile`, sub: true, keywords: 'נוכחות presence טלפון שיתוף נתונים חיישנים' },
      { tab: 'wall', label: 'מסכי קיר', href: '#/system/wall', keywords: 'wall טאבלט קיוסק תצוגה' },
      { tab: 'notices', label: 'לוח הודעות', href: '#/system/notices', keywords: 'הודעות לבניין לוח תצוגה טלוויזיה מסך לובי TV board notices קישור QR' },
      { tab: 'transit', label: 'תחבורה ציבורית', href: '#/system/transit', keywords: 'אוטובוס אוטובוסים תחנה תחנות קו זמני הגעה לוח הודעות מסך bus transit stop timetable' },
    ],
  },
  {
    id: 'people',
    label: 'משתמשים ואבטחה',
    icon: 'users',
    entries: [
      { tab: 'access', label: 'משתמשים והרשאות', href: '#/system/access', keywords: 'תפקידים roles קבוצות בינדינג היקף הרשאות אפקטיביות' },
      { tab: 'access', label: 'קבוצות', href: '#/system/access?tab=groups', sub: true, keywords: 'קבוצה חברים' },
      { tab: 'access', label: 'תפקידים', href: '#/system/access?tab=roles', sub: true, keywords: 'תפקיד מותאם הרשאה' },
      { tab: 'access', label: 'הרשאות אפקטיביות', href: '#/system/access?tab=effective', sub: true, keywords: 'מה מותר למשתמש' },
      { tab: 'access', label: 'אודיט הרשאות', href: '#/system/access?tab=audit', sub: true },
      { tab: 'access', label: 'משתמשי מערכת הבית', href: '#/system/access?tab=ha-users', sub: true, keywords: 'משתמש חדש יצירה מחיקה השבתה סיסמה' },
      { tab: 'general', label: 'גישה מרחוק', href: `${GEN}?tab=remote`, keywords: 'arx remote כניסה מרחוק אימות דו שלבי MFA סשן CSP אפליקציית android הורדה' },
      { tab: 'security', label: 'אבטחה', href: '#/system/security', keywords: 'אזעקה alarm לוח קוד NVR מצלמות' },
      { tab: 'security', label: 'ניהול אזעקה', href: '#/system/security/manage', sub: true, keywords: 'לוחות קוד חיישנים עקיפה' },
      { tab: 'security', label: 'מצלמות', href: '#/system/security/cameras', sub: true, keywords: 'קידוד codec רזולוציה bitrate' },
      { tab: 'security', label: 'ממשק ציבורי', href: '#/system/security/public', sub: true, keywords: 'טכנאים ספקים מחיקה אוטומטית פורטל 404' },
      { tab: 'security', label: 'קריאות בקרת כניסה', href: '#/system/security/wiskey', sub: true, keywords: 'מתגים wiskey מצב גישה השוואת לוח זמנים נוכחות תוכניות הפעלה כיבוי' },
      { tab: 'security', label: 'מסכות פרטיות', href: '#/system/security/privacy-masks', sub: true, keywords: 'מסכה פרטיות privacy mask כיסוי אזור' },
      { tab: 'security', label: 'מצב אירוע חי', href: '#/system/security/incidents', sub: true, keywords: 'אירוע חי אירוע פעיל איחוד מצלמות חיות נקודה אדומה שעון שמירה incident' },
      { tab: 'audit', label: 'אודיט', href: '#/system/audit', keywords: 'יומן מי עשה מה request_id' },
    ],
  },
  {
    id: 'alerts',
    label: 'התראות ואוטומציה',
    icon: 'bell',
    entries: [
      { tab: 'notifications', label: 'התראות', href: '#/system/notifications', keywords: 'push דחיפה טלפון ערוצים מקורות' },
      { tab: 'notifications', label: 'שעות שקט', href: '#/system/notifications?section=quiet', sub: true },
      { tab: 'notifications', label: 'הסלמה', href: '#/system/notifications?section=esc', sub: true },
      { tab: 'notifications', label: 'דואר יוצא', href: '#/system/notifications?section=mail', sub: true, keywords: 'smtp mail אימייל' },
      { tab: 'notifications', label: 'יומן מסירה', href: '#/system/notifications?section=log', sub: true, keywords: 'כשלים' },
      { tab: 'schedules', label: 'תזמונים', href: '#/system/schedules', keywords: 'scheduler שבת חג חיישן סוגי התקנים נטרול' },
      { tab: 'automations', label: 'אוטומציות', href: '#/system/automations', keywords: 'סצנות סקריפטים האצלה תבניות מגבלות סל מחזור' },
    ],
  },
  {
    id: 'media',
    label: 'מדיה',
    icon: 'media',
    entries: [
      { tab: 'multimedia', label: 'מולטימדיה', href: '#/system/multimedia', keywords: 'מסכים נגנים music assistant שלט' },
      { tab: 'multimedia', label: 'שידור למסכים', href: '#/system/multimedia?tab=cast', sub: true, keywords: 'cast' },
      { tab: 'multimedia', label: 'כריזה', href: '#/system/multimedia?tab=announce', sub: true, keywords: 'הודעות קוליות announce' },
    ],
  },
  {
    id: 'system',
    label: 'מערכת ותשתית',
    icon: 'cpu',
    entries: [
      { tab: 'setup', label: 'חיבורים', href: '#/system/setup', keywords: 'nvr go2rtc wiskey חשבון סיסמה ntp דיסקים הפעלה מחדש חסימות פתיחת דלתות שחרור התקן וירטואלי תבנית template universal פריטים שפותחים דלתות שיוך דלתות' },
      // CR-036 S10: the access-control status page and its segments (docs/changes/CR-036-S8-S10-NOTES.md, "Merging ... with main")
      { tab: 'access-control', label: 'בקרת כניסה', href: '#/system/access-control', keywords: 'wiskey אינטרקום תחנות בריאות סנכרון התרעות התנגשויות' },
      { tab: 'access-control', label: 'יומן האינטרקום', href: '#/system/access-control/audit', sub: true, keywords: 'פעולות audit מי עשה מה' },
      { tab: 'access-control', label: 'קבוצות ושדות', href: '#/system/access-control/groups', sub: true, keywords: 'קבוצה שדות פרופיל גרסאות מדיניות' },
      { tab: 'access-control', label: 'מדיניות', href: '#/system/access-control/policy', sub: true, keywords: 'תמונת אירוע מספר עובד שגיאות סנכרון רגיש תיעוד צפייה' },
      { tab: 'access-control', label: 'הודעות', href: '#/system/access-control/messaging', sub: true, keywords: 'וואטסאפ whatsapp תבניות שליחת הודעה הודעה חופשית מכסה נמענים' },
      { tab: 'general', label: 'גשר Home Assistant', href: `${GEN}?tab=ha`, keywords: 'אינטגרציה צימוד pairing bridge supervisor' },
      { tab: 'general', label: 'מתגי מסכי כניסה', href: `${GEN}?tab=access-control`, keywords: 'wiskey מוטמע אינטרקום תצוגה מסך תחנות שיחה דיבור הכרזה משפטים בדיקת התאמה השוואה צד לצד' },
      { tab: 'entities', label: 'קטלוג התקנים', href: '#/system/entities', keywords: 'ישויות entities תחומים' },
      { tab: 'infra', label: 'תשתיות', href: '#/system/infra', keywords: 'חשמל מונים מחירים מע"מ תעריף גנרטור' },
      // CR-038: the optional tickets module - its labels and search words carry the configured name (D33: getters, read at render time)
      { tab: 'tickets', get label() { return tt('settingsTab'); }, href: '#/system/tickets', get keywords() { return tt('settingsKeywords'); } },
      { tab: 'tickets', get label() { return tt('setTabDepartments'); }, href: '#/system/tickets?tab=departments', sub: true },
      { tab: 'tickets', get label() { return tt('setTabPermissions'); }, href: '#/system/tickets?tab=permissions', sub: true },
      { tab: 'messaging-accounts', label: 'ערוץ ההודעות', href: '#/system/messaging-accounts', keywords: 'וואטסאפ whatsapp חשבון חשבונות מספר שולח קוד אימות שימושים קצב שליחה sms' }, // CR-038 S5a
      { tab: 'fleet-report', label: 'דיווח בריאות', href: '#/system/fleet-report', keywords: 'דוח יומי smplwise fleet צי קוד רישום חתימה שקט לא מדווחת מה נשלח' }, // CR-FLEET215 (readiness and demo mode: the readiness tab, READYFLEET-295)
      { tab: 'general', label: 'בריאות ועבודות', href: `${GEN}?tab=health`, keywords: 'דיאגנוסטיקה מצב רכיבים תור' },
      { tab: 'general', label: 'גיבוי ושחזור', href: `${GEN}?tab=backup`, keywords: 'backup restore שחזור קובץ zip' },
      { tab: 'storage', label: 'אחסון', href: '#/system/storage', keywords: 'דיסק הקלטות נפח' },
      { tab: 'update', label: 'עדכונים', href: '#/system/update', keywords: 'גרסה update שדרוג' },
      { tab: 'wizard', label: 'אשף התקנה', href: '#/system/wizard', keywords: 'התקנה שלבים' },
      { tab: 'readiness', label: 'מוכנות ההתקנה', href: '#/system/readiness', keywords: 'ציון מסירה הדגמה demo בדיקות גיבוי מוכן' },
      { tab: 'general', label: 'תמיכה', href: `${GEN}?tab=support`, keywords: 'לוגים חבילה' },
      { tab: 'screens', label: 'כל המסכים', href: '#/screens', keywords: 'קטלוג מסכים' },
    ],
  },
];

/** The groups with only the entries whose top-level tab this user is offered (the shell's own rule). */
export function visibleGroups(api: boolean, can?: (permission: string, installationOnly?: boolean) => boolean): SettingsGroup[] {
  const tabs = new Set(visibleTabs(AREA_TABS.system, api, can).map((t) => t.id));
  const security = tabs.has('security') ? new Set(visibleTabs(SECURITY_SETTINGS_TABS, api, can).map((t) => t.id)) : new Set<string>();
  return SETTINGS_GROUPS.map((g) => ({
    ...g,
    entries: g.entries.filter((e) => tabs.has(e.tab) && (e.tab !== 'security' || !e.sub || security.has(e.href.split('/').pop() ?? ''))),
  })).filter((g) => g.entries.length);
}

const norm = (s: string) => s.toLowerCase().replace(/[֑-ׇ"'״׳\-–·]/g, ' ').replace(/\s+/g, ' ').trim();

/** The entries matching a query (every word must appear in the label, the keywords or the parent's label), parents first. */
export function searchSettings(groups: SettingsGroup[], query: string): { group: SettingsGroup; entry: SettingsEntry }[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const out: { group: SettingsGroup; entry: SettingsEntry; score: number }[] = [];
  for (const group of groups) {
    let parent = '';
    for (const entry of group.entries) {
      if (!entry.sub) parent = entry.label;
      const label = norm(entry.label);
      const hay = `${label} ${norm(entry.keywords ?? '')} ${entry.sub ? norm(parent) : ''} ${norm(group.label)}`;
      if (!words.every((w) => hay.includes(w))) continue;
      const score = words.every((w) => label.includes(w)) ? 0 : words.every((w) => label.includes(w) || norm(entry.keywords ?? '').includes(w)) ? 1 : 2;
      out.push({ group, entry, score });
    }
  }
  return out.sort((a, b) => a.score - b.score).map(({ group, entry }) => ({ group, entry }));
}

/** The address the current route stands for in the index: the screen's path plus the one deep-link key the screen reads. */
export function routeHref(r: RouteState | null): string {
  if (!r || r.mode !== 'system') return r?.segments[0] === 'screens' ? '#/screens' : '';
  const s = r.segments;
  const p = r.params;
  if (!s[1] || s[1] === 'diagnostics') {
    const tab = p.get('tab');
    const section = p.get('section');
    return tab && tab !== 'general' ? `${GEN}?tab=${tab}${section ? `&section=${section}` : ''}` : GEN;
  }
  if (s[1] === 'access') {
    const tab = p.get('tab');
    return tab && tab !== 'users' ? `#/system/access?tab=${tab}` : '#/system/access';
  }
  if (s[1] === 'notifications') {
    const sec = p.get('section');
    return sec ? `#/system/notifications?section=${sec}` : '#/system/notifications';
  }
  if (s[1] === 'multimedia') {
    const tab = p.get('tab');
    return tab && tab !== 'main' ? `#/system/multimedia?tab=${tab}` : '#/system/multimedia';
  }
  if (s[1] === 'tickets') {
    const tab = p.get('tab');
    return tab && tab !== 'general' ? `#/system/tickets?tab=${tab}` : '#/system/tickets';
  }
  if (s[1] === 'security') return s[2] ? `#/system/security/${s[2]}` : '#/system/security';
  if (s[1] === 'access-control') return s[2] ? `#/system/access-control/${s[2]}` : '#/system/access-control'; // CR-036 S10 segments
  return `#/system/${s[1]}`;
}

/** The entry the route is on: the exact deep link, else its top-level entry (a sub-page the index does not list). */
export function activeEntry(groups: SettingsGroup[], r: RouteState | null): SettingsEntry | null {
  const href = routeHref(r);
  if (!href) return null;
  const all = groups.flatMap((g) => g.entries);
  const exact = all.find((e) => e.href === href);
  if (exact) return exact;
  // a deeper link than the index lists (a card section) lands on its tab's entry, then on the screen's
  const tab = href.split('&')[0];
  const byTab = all.find((e) => e.href === tab);
  if (byTab) return byTab;
  const base = href.split('?')[0].split('/').slice(0, 3).join('/');
  return all.find((e) => !e.sub && e.href.split('?')[0] === base) ?? null;
}

