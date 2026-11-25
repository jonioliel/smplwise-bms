import { AREA_TABS, SECURITY_SETTINGS_TABS, visibleTabs } from '../shell/nav';
import { tt } from '../tickets/text';
import { tr } from '../i18n/msg/system-b';
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
  /** I18N-EN-2490 (owner answer N52 = a): the same words in English. The search reads both lists in either interface language, so an
   * English user finds an entry by its English keywords and a Hebrew one by either. */
  keywordsEn?: string;
  /** A sub-entry (a tab of the screen): drawn indented under its parent - unless the parent has `ownTabs`. */
  sub?: boolean;
  /** SMALL-UI-BUGS-2343: the screen draws its own tab strip, so its sub-entries are search results only - the column never unfolds them
   * under it (a second, parallel tab strip); while the user is on one of them the column marks this entry. */
  ownTabs?: boolean;
}

export interface SettingsGroup {
  id: string;
  label: string;
  icon: IconName;
  entries: SettingsEntry[];
}

const GEN = '#/system/diagnostics';

// i18n-keep-start: search keywords, matched against the query
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'look',
    label: tr('מראה ותצוגה'),
    icon: 'dashboard',
    entries: [
      { ownTabs: true, tab: 'general', label: tr('מראה ותצוגה'), href: GEN, keywords: 'מראה סגנון skin בהיר כהה dark light אזור זמן אחסון בריאות צפיפות ניווט נייד אפשרויות צבעי המותג צבע הדגשה מתג accent brand לוגו logo יזם חברת ניהול מיתוג מתקין white label לקוח חבילת לקוח ייצוא ייבוא שם הפרויקט כותרת הדפדפן לשונית גודל הלוגו לוחיתקריסטל crystal רקע תמונת background מצב תצוגה התצוגה סכמטי מלא אוטומטי 3D', keywordsEn: 'look appearance skin theme light dark mode time zone accessibility density navigation mobile options colours accent brand logo white label branding installer company customer export import project name page title glass logo size crystal background image display mode schematic realistic 3D' },
      { tab: 'general', label: tr('לשוניות'), href: `${GEN}?tab=tabs`, sub: true, keywords: 'סדר הסתרה סרגל פס תחתון כמוסה dropdown', keywordsEn: 'tabs order hide bar strip bottom menu more dropdown navigation' },
      { tab: 'general', label: tr('וידאו ומדיה'), href: `${GEN}?tab=media`, sub: true, keywords: 'webrtc mse תעבורה קיר מצלמות קיוסק מסך פתיחה זרמים go2rtc ייצוא שמירה ימים ציר זמן צבעים סקינים AI תלת־ממד 3D מצב תצוגה ריאליסטי realistic תמונות מוכנות stills מסך קיר תצוגת התוכנית מפת תאורה מיקום האתר שמש מיקום הבית ידני קו רוחב קו אורך מעבר לתמונה מוכנה חוסר פעילות idle', keywordsEn: 'video media webrtc mse traffic wall cameras kiosk screen opening streams go2rtc export retention days timeline colours ai detections 3D realistic display mode images stills plan view sun position location bandwidth idle' },
      { tab: 'general', label: tr('מפה'), href: `${GEN}?tab=map`, sub: true, keywords: 'קומת ברירת מחדל 2D 3D מפלסים תוכנית תצוגה ריאליסטית realistic סגנון אדריכלי בהיר תאום דיגיטלי כהה שמש שעה מיקום האתר קו רוחב קו אורך רהיטים טקסטורות חתך סיור גובה עין ההעדפה שלי', keywordsEn: 'map default layer 2D 3D plans floor plan display realistic style architectural light digital twin dark sun hour location bandwidth furniture textures overlay height eye level preference' },
      { tab: 'general', label: tr('בניינים ומיפוי'), href: `${GEN}?tab=buildings`, sub: true, keywords: 'ריבוי בניינים אתר בניין משותף מיפוי סימון קידומת שמות מערכת הבית אשף גרסאות buildings mapping multi-building', keywordsEn: 'buildings mapping multi-building multiple buildings site shared building marking prefixes home system names versions' }, // MAPPING-ASSIST-2330
      { tab: 'general', label: tr('חשמל והתקנים'), href: `${GEN}?tab=devices`, sub: true, keywords: 'זכוכית glass אריחים כרטיסים חיישנים מיזוג מתגים מוגנים מסך ראשי צבעוניות זכוכית', keywordsEn: 'devices electricity glass tiles cards sensors pairing switches toggles logos main screen colourfulness colorfulness' },
      { tab: 'general', label: tr('סוגי התקנים'), href: `${GEN}?tab=devices&section=device-types`, sub: true, keywords: 'דוד ברז מתג סוג סמל כרטיס פעילות device types', keywordsEn: 'device types boiler water heater tap switch type icon card action' },
      { tab: 'general', label: tr('אפליקציה לנייד'), href: `${GEN}?tab=mobile`, sub: true, keywords: 'נוכחות presence טלפון שיתוף נתונים חיישנים', keywordsEn: 'mobile app phone presence data sharing sensors companion' },
      { tab: 'wall', label: tr('מסכי קיר'), href: '#/system/wall', keywords: 'wall טאבלט קיוסק תצוגה', keywordsEn: 'wall screens tablet kiosk display' },
      { tab: 'notices', label: tr('לוח הודעות'), href: '#/system/notices', keywords: 'הודעות לבניין לוח תצוגה טלוויזיה מסך לובי TV board notices קישור QR', keywordsEn: 'notices notice board building display television tv lobby screen qr link' },
      { tab: 'transit', label: tr('תחבורה ציבורית'), href: '#/system/transit', keywords: 'אוטובוס אוטובוסים תחנה תחנות קו זמני הגעה לוח הודעות מסך bus transit stop timetable', keywordsEn: 'public transport transit bus buses stop stops line arrival times timetable notice board screen' },
    ],
  },
  {
    id: 'people',
    label: tr('משתמשים ואבטחה'),
    icon: 'users',
    entries: [
      { ownTabs: true, tab: 'access', label: tr('משתמשים והרשאות'), href: '#/system/access', keywords: 'תפקידים roles קבוצות בינדינג היקף הרשאות אפקטיביות', keywordsEn: 'users permissions roles groups binding scope effective' },
      { tab: 'access', label: tr('קבוצות'), href: '#/system/access?tab=groups', sub: true, keywords: 'קבוצה חברים', keywordsEn: 'groups group members' },
      { tab: 'access', label: tr('תפקידים'), href: '#/system/access?tab=roles', sub: true, keywords: 'תפקיד מותאם הרשאה', keywordsEn: 'roles role custom permission' },
      { tab: 'access', label: tr('הרשאות אפקטיביות'), href: '#/system/access?tab=effective', sub: true, keywords: 'מה מותר למשתמש', keywordsEn: 'effective permissions what is allowed user' },
      { tab: 'access', label: tr('אודיט הרשאות'), href: '#/system/access?tab=audit', keywordsEn: 'permissions audit history changes log', sub: true },
      { tab: 'access', label: tr('משתמשי מערכת הבית'), href: '#/system/access?tab=ha-users', sub: true, keywords: 'משתמש חדש יצירה מחיקה השבתה סיסמה', keywordsEn: 'home system users accounts new user create delete disable password' },
      { tab: 'general', label: tr('גישה מרחוק'), href: `${GEN}?tab=remote`, keywords: 'arx remote כניסה מרחוק אימות דו שלבי MFA סשן CSP אפליקציית android הורדה', keywordsEn: 'remote access arx remote sign in login two-step 2fa mfa session csp app android download' },
      { ownTabs: true, tab: 'security', label: tr('אבטחה'), href: '#/system/security', keywords: 'אזעקה alarm לוח קוד NVR מצלמות', keywordsEn: 'security alarm panel code nvr cameras' },
      { tab: 'security', label: tr('ניהול אזעקה'), href: '#/system/security/manage', sub: true, keywords: 'לוחות קוד חיישנים עקיפה', keywordsEn: 'alarm management panels code sensors bypass' },
      { tab: 'security', label: tr('מצלמות'), href: '#/system/security/cameras', sub: true, keywords: 'קידוד codec רזולוציה bitrate', keywordsEn: 'cameras encoding codec resolution bitrate' },
      { tab: 'security', label: tr('ממשק ציבורי'), href: '#/system/security/public', sub: true, keywords: 'טכנאים ספקים מחיקה אוטומטית פורטל 404', keywordsEn: 'public interface technicians vendors automatic deletion portal 404' },
      { tab: 'security', label: tr('קריאות בקרת כניסה'), href: '#/system/security/wiskey', sub: true, keywords: 'מתגים wiskey מצב גישה השוואת לוח זמנים נוכחות תוכניות הפעלה כיבוי', keywordsEn: 'access control readings switches wiskey access mode comparison board times presence programmes programs activation turn off' },
      { tab: 'security', label: tr('מסכות פרטיות'), href: '#/system/security/privacy-masks', sub: true, keywords: 'מסכה פרטיות privacy mask כיסוי אזור', keywordsEn: 'privacy masks mask cover area' },
      { tab: 'security', label: tr('מצב אירוע חי'), href: '#/system/security/incidents', sub: true, keywords: 'אירוע חי אירוע פעיל איחוד מצלמות חיות נקודה אדומה שעון שמירה incident', keywordsEn: 'live incident mode active incident one tap cameras doors red dot clock retention' },
      { tab: 'audit', label: tr('אודיט'), href: '#/system/audit', keywords: 'יומן מי עשה מה request_id', keywordsEn: 'audit log who did what request_id trail' },
    ],
  },
  {
    id: 'alerts',
    label: tr('התראות ואוטומציה'),
    icon: 'bell',
    entries: [
      { tab: 'notifications', label: tr('התראות'), href: '#/system/notifications', keywords: 'push דחיפה טלפון ערוצים מקורות', keywordsEn: 'notifications alerts push phone channels sources' },
      { tab: 'notifications', label: tr('שעות שקט'), href: '#/system/notifications?section=quiet', keywordsEn: 'quiet hours do not disturb night', sub: true },
      { tab: 'notifications', label: tr('הסלמה'), href: '#/system/notifications?section=esc', keywordsEn: 'escalation repeat on-call', sub: true },
      { tab: 'notifications', label: tr('דואר יוצא'), href: '#/system/notifications?section=mail', sub: true, keywords: 'smtp mail אימייל', keywordsEn: 'outgoing mail smtp email e-mail' },
      { tab: 'notifications', label: tr('יומן מסירה'), href: '#/system/notifications?section=log', sub: true, keywords: 'כשלים', keywordsEn: 'delivery log failures sent' },
      { tab: 'schedules', label: tr('תזמונים'), href: '#/system/schedules', keywords: 'scheduler שבת חג חיישן סוגי התקנים נטרול', keywordsEn: 'schedules scheduler timer shabbat sabbath holiday sensor device types neutral' },
      { tab: 'automations', label: tr('אוטומציות'), href: '#/system/automations', keywords: 'סצנות סקריפטים האצלה תבניות מגבלות סל מחזור', keywordsEn: 'automations scenes scripts recommendation templates blueprints limits rules recycle bin trash' },
    ],
  },
  {
    id: 'media',
    label: tr('מדיה'),
    icon: 'media',
    entries: [
      { ownTabs: true, tab: 'multimedia', label: tr('מולטימדיה'), href: '#/system/multimedia', keywords: 'מסכים נגנים music assistant שלט', keywordsEn: 'multimedia media screens speakers music assistant players' },
      { tab: 'multimedia', label: tr('שידור למסכים'), href: '#/system/multimedia?tab=cast', sub: true, keywords: 'cast', keywordsEn: 'cast to screens chromecast' },
      { tab: 'multimedia', label: tr('כריזה'), href: '#/system/multimedia?tab=announce', sub: true, keywords: 'הודעות קוליות announce', keywordsEn: 'announcements announce voice messages tts public address' },
    ],
  },
  {
    // WISKEY-INSTALL-ANSWERS-2400 (owner answer 04.11, round 18 Q2 = ג): the intercom's settings are their own group "בקרת כניסה" and the
    // installer tools are a row of it - not search-only, not a row of "מערכת ותשתית". The group took the access-control screen and the
    // entrance-screen switches out of "מערכת ותשתית" (two rows less there, one group header more), so the column still fits 1440x900 and
    // 1366x768 without a scroll (owner decision 402; layout-settings-nav-fit-402).
    id: 'access-control',
    label: tr('בקרת כניסה'),
    icon: 'door',
    entries: [
      // CR-036 S10: the access-control status page and its segments (docs/changes/CR-036-S8-S10-NOTES.md, "Merging ... with main")
      { ownTabs: true, tab: 'access-control', label: tr('בקרת כניסה'), href: '#/system/access-control', keywords: 'wiskey אינטרקום תחנות בריאות סנכרון התרעות התנגשויות', keywordsEn: 'access control wiskey intercom stations health sync events conflicts' },
      { tab: 'access-control', label: tr('יומן האינטרקום'), href: '#/system/access-control/audit', sub: true, keywords: 'פעולות audit מי עשה מה', keywordsEn: 'intercom log actions audit who did what' },
      { tab: 'access-control', label: tr('קבוצות ושדות'), href: '#/system/access-control/groups', sub: true, keywords: 'קבוצה שדות פרופיל גרסאות מדיניות', keywordsEn: 'groups and fields group fields profiles versions policy' },
      { tab: 'access-control', label: tr('מדיניות'), href: '#/system/access-control/policy', sub: true, keywords: 'תמונת אירוע מספר עובד שגיאות סנכרון רגיש תיעוד צפייה', keywordsEn: 'policy event image number employee errors sync sensitive documentation view' },
      { tab: 'access-control', label: tr('הודעות'), href: '#/system/access-control/messaging', sub: true, keywords: 'וואטסאפ whatsapp תבניות שליחת הודעה הודעה חופשית מכסה נמענים', keywordsEn: 'messages whatsapp templates send message free text quota recipients' },
      // WISKEY-OPS-VIEWS-2400 (integration plan T11): the intercom system's operations and fleet views (access.read at the installation).
      // Sub-entries of בקרת כניסה (a screen with its own tabs), so they are search results only; the shell's tab row and the deep links
      // lead to the screen as well.
      { sub: true, tab: 'intercom-operations', label: tr('תפעול האינטרקום'), href: '#/system/intercom-operations', keywords: 'wiskey אינטרקום תפעול פעולות סנכרון חקירות ציר זמן משימות ביטול קיבולת מגמה מלאי צי ייצוא יומן שינויים דוח אירועים מדדים', keywordsEn: 'intercom operations wiskey actions sync investigations timeline jobs cancel capacity trend inventory fleet export change log event report metrics' },
      { tab: 'intercom-operations', label: tr('פעולות ומשימות'), href: '#/system/intercom-operations/operations', sub: true, keywords: 'סנכרון עריכה מרוכזת ייבוא משימות שגיאות ביטול', keywordsEn: 'actions and jobs sync bulk edit import jobs errors cancel' },
      { tab: 'intercom-operations', label: tr('חקירות'), href: '#/system/intercom-operations/investigations', sub: true, keywords: 'ציר זמן כניסות שינויים סנכרון', keywordsEn: 'investigations timeline entries changes sync' },
      { tab: 'intercom-operations', label: tr('קיבולת ומגמות'), href: '#/system/intercom-operations/capacity', sub: true, keywords: 'משתמשים כרטיסים מגבלה צמיחה תחזית', keywordsEn: 'capacity and trends users cards limit growth forecast' },
      { tab: 'intercom-operations', label: tr('דוח אירועים'), href: '#/system/intercom-operations/events', sub: true, keywords: 'כניסות נדחו אושרו חריגות לפי יום לפי עמדה', keywordsEn: 'event report entries denied granted exceptions per day per station' },
      { tab: 'intercom-operations', label: tr('ייצוא'), href: '#/system/intercom-operations/exports', sub: true, keywords: 'csv מלאי צי יומן שינויים קובץ', keywordsEn: 'export csv inventory fleet change log file' },
      // WISKEY-INSTALLER-NATIVE-2400: WisKey's installer tools, natively (owner decision 03.11, Q7) - a row of this group (owner 04.11, Q2 = ג).
      // The screen draws its own tab strip (ownTabs), so its four tools are search results under it.
      { ownTabs: true, tab: 'intercom-installer', label: tr('התקנה ותחזוקה'), href: '#/system/intercom-installer', keywords: 'wiskey אינטרקום מתקין התקנה ותחזוקת מערכת האינטרקום תחזוקה שעון ntp שרת זמן עמדה הגדרות טכניות זמן פתיחה שם דלת ממסר הוספת עמדה הסרת עמדה החלפה פלטפורמה ייבוא ייצוא webhook שמירת נתונים שלמות קיבולת', keywordsEn: 'installation and maintenance wiskey intercom installer clock ntp time server station technical settings opening time door name relay add station remove station replace platform import export webhook data retention integrity capacity' },
      { tab: 'intercom-installer', label: tr('שעון האינטרקום'), href: '#/system/intercom-installer/clock', sub: true, keywords: 'ntp שעון סטייה שרת זמן', keywordsEn: 'intercom clock ntp drift time server' },
      { tab: 'intercom-installer', label: tr('הוספה והסרה של עמדות אינטרקום'), href: '#/system/intercom-installer/lifecycle', sub: true, keywords: 'הוספת עמדה אשף התחברות מחדש סיסמה כתובת הסרת עמדה החלפת עמדה מכשיר חדש', keywordsEn: 'add station remove station replace station wizard reconnect password address new device' },
      { tab: 'intercom-installer', label: tr('תצורת מערכת האינטרקום'), href: '#/system/intercom-installer/platform', sub: true, keywords: 'קיבולת שלמות חלון תחזוקה תור תחזוקה שמירת אירועים webhook מפתח ייצוא ייבוא שינוי בכמה עמדות', keywordsEn: 'intercom system configuration capacity integrity maintenance window maintenance queue event retention webhook key export import change across stations' },
      { tab: 'intercom-installer', label: tr('הגדרות טכניות של עמדה'), href: '#/system/intercom-installer/technical', sub: true, keywords: 'שם דלת זמן פתיחה היפוך ממסר סיסמאות יכולות', keywordsEn: 'station technical settings door name opening time relay invert passwords capabilities' },
      { tab: 'general', label: tr('מתגי מסכי כניסה'), href: `${GEN}?tab=access-control`, keywords: 'wiskey מוטמע אינטרקום תצוגה מסך תחנות שיחה דיבור הכרזה משפטים בדיקת התאמה השוואה צד לצד כרטיסים סידור הכרזות וקול מנוע הקראה', keywordsEn: 'entrance screen switches wiskey embedded intercom display screen stations call talk announcement phrases match check side by side comparison cards layout announcements voice reading engine tts' },
    ],
  },
  {
    id: 'system',
    label: tr('מערכת ותשתית'),
    icon: 'cpu',
    entries: [
      { tab: 'setup', label: tr('חיבורים'), href: '#/system/setup', keywords: 'nvr go2rtc wiskey חשבון סיסמה ntp דיסקים הפעלה מחדש חסימות פתיחת דלתות שחרור התקן וירטואלי תבנית template universal פריטים שפותחים דלתות שיוך דלתות', keywordsEn: 'connections nvr go2rtc wiskey account password ntp disks restart blocks door opening release virtual device template universal items that open doors door assignment' },
      { tab: 'general', label: tr('גשר Arx'), href: `${GEN}?tab=ha`, keywords: 'אינטגרציה צימוד pairing bridge supervisor home assistant', keywordsEn: 'arx bridge integration pairing bridge supervisor home assistant' },
      { tab: 'entities', label: tr('קטלוג התקנים'), href: '#/system/entities', keywords: 'ישויות entities תחומים', keywordsEn: 'device catalogue entities domains devices' },
      // CALENDARS-UI-2310: the calendars module (contract section 16: settings live under "מערכת ותשתית" › "יומנים") and its external connections
      { ownTabs: true, tab: 'calendars', label: tr('יומנים'), href: '#/system/calendars', keywords: 'יומן חדרים הזמנות אישורים תחזוקה חפיפה אורחים מחיקה מיקום בתפריט calendar booking', keywordsEn: 'calendars calendar rooms bookings booking approvals maintenance overlap guests deletion menu position' },
      { tab: 'calendars', label: tr('התנהגות'), href: '#/system/calendars?tab=behavior', sub: true, keywords: 'ערב חג ביטול דייר בקשות מתחרות דחיקה טלפון טאבלט טעינה', keywordsEn: 'behaviour behavior holiday eve cancellation resident competing requests bumping phone tablet loading' },
      { tab: 'calendars', label: tr('אישור לכל יומן'), href: '#/system/calendars?tab=approval', keywordsEn: 'approval per calendar approver', sub: true },
      { tab: 'calendars', label: tr('הרשאות'), href: '#/system/calendars?tab=perm', keywordsEn: 'permissions who can book calendar', sub: true },
      { tab: 'calendars', label: tr('פרטי אורחים'), href: '#/system/calendars?tab=retention', sub: true, keywords: 'שם טלפון שמירה מחיקה פרטיות', keywordsEn: 'guest details name phone retention deletion privacy guests' },
      { tab: 'calendar-sync', label: tr('חיבורי יומן'), href: '#/system/calendar-sync', keywords: 'google microsoft ical סנכרון חיבור הרשאה מחדש פיד', keywordsEn: 'calendar connections google microsoft outlook ical sync connection reauthorise reauthorize feed' },
      { tab: 'infra', label: tr('תשתיות'), href: '#/system/infra', keywords: 'חשמל מונים מחירים מע"מ תעריף גנרטור', keywordsEn: 'infrastructure electricity energy meters prices vat tariff generator' },
      // CR-038: the optional tickets module - its labels and search words carry the configured name (D33: getters, read at render time)
      { ownTabs: true, tab: 'tickets', get label() { return tt('settingsTab'); }, href: '#/system/tickets', get keywords() { return tt('settingsKeywords'); }, keywordsEn: 'tickets ticket module faults service maintenance requests departments categories priorities handlers members permissions' },
      { tab: 'tickets', get label() { return tt('setTabDepartments'); }, href: '#/system/tickets?tab=departments', keywordsEn: 'tickets departments categories handlers members', sub: true },
      { tab: 'tickets', get label() { return tt('setTabPermissions'); }, href: '#/system/tickets?tab=permissions', keywordsEn: 'tickets permissions who can open handle', sub: true },
      { tab: 'messaging-accounts', label: tr('ערוץ ההודעות'), href: '#/system/messaging-accounts', keywords: 'וואטסאפ whatsapp חשבון חשבונות מספר שולח קוד אימות שימושים קצב שליחה sms', keywordsEn: 'message channel whatsapp account accounts sender number verification code uses sending rate sms' }, // CR-038 S5a
      { tab: 'fleet-report', label: tr('דיווח בריאות'), href: '#/system/fleet-report', keywords: 'דוח יומי smplwise fleet צי קוד רישום חתימה שקט לא מדווחת מה נשלח', keywordsEn: 'health reporting daily report smplwise fleet code registration signature quiet not reporting what was sent' }, // CR-FLEET215 (readiness and demo mode: the readiness tab, READYFLEET-295)
      { tab: 'general', label: tr('בריאות ועבודות'), href: `${GEN}?tab=health`, keywords: 'דיאגנוסטיקה מצב רכיבים תור', keywordsEn: 'health and jobs diagnostics component status queue' },
      { tab: 'general', label: tr('גיבוי ושחזור'), href: `${GEN}?tab=backup`, keywords: 'backup restore שחזור קובץ zip ייבוא מערכת ישנה legacy', keywordsEn: 'backup restore file zip legacy import migration' },
      { tab: 'storage', label: tr('אחסון'), href: '#/system/storage', keywords: 'דיסק הקלטות נפח', keywordsEn: 'storage disk recordings capacity space' },
      { tab: 'update', label: tr('עדכונים'), href: '#/system/update', keywords: 'גרסה update שדרוג', keywordsEn: 'updates version update upgrade' },
      { tab: 'wizard', label: tr('אשף התקנה'), href: '#/system/wizard', keywords: 'התקנה שלבים', keywordsEn: 'setup wizard installation steps' },
      { tab: 'readiness', label: tr('מוכנות ההתקנה'), href: '#/system/readiness', keywords: 'ציון מסירה הדגמה demo בדיקות גיבוי מוכן', keywordsEn: 'installation readiness score handover demo checks backup ready' },
      { tab: 'general', label: tr('תמיכה'), href: `${GEN}?tab=support`, keywords: 'לוגים חבילה', keywordsEn: 'support logs bundle diagnostics' },
      { tab: 'screens', label: tr('כל המסכים'), href: '#/screens', keywords: 'קטלוג מסכים', keywordsEn: 'all screens catalogue' },
    ],
  },
];
// i18n-keep-end

/** The groups with only the entries whose top-level tab this user is offered (the shell's own rule). */
export function visibleGroups(api: boolean, can?: (permission: string, installationOnly?: boolean) => boolean): SettingsGroup[] {
  const tabs = new Set(visibleTabs(AREA_TABS.system, api, can).map((t) => t.id));
  const security = tabs.has('security') ? new Set(visibleTabs(SECURITY_SETTINGS_TABS, api, can).map((t) => t.id)) : new Set<string>();
  return SETTINGS_GROUPS.map((g) => ({
    ...g,
    entries: g.entries.filter((e) => tabs.has(e.tab) && (e.tab !== 'security' || !e.sub || security.has(e.href.split('/').pop() ?? ''))),
  })).filter((g) => g.entries.length);
}

const norm = (s: string) => s.toLowerCase().replace(/[֑-ׇ"'״׳\-–·]/g, ' ').replace(/\s+/g, ' ').trim(); // i18n-keep: a regex of Hebrew marks and punctuation stripped before matching, not text

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
      const keywords = norm(`${entry.keywords ?? ''} ${entry.keywordsEn ?? ''}`); // I18N-EN-2490: Hebrew and English keywords alike
      const hay = `${label} ${keywords} ${entry.sub ? norm(parent) : ''} ${norm(group.label)}`;
      if (!words.every((w) => hay.includes(w))) continue;
      const score = words.every((w) => label.includes(w)) ? 0 : words.every((w) => label.includes(w) || keywords.includes(w)) ? 1 : 2;
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
  if (s[1] === 'calendars') {
    const tab = p.get('tab');
    return tab && tab !== 'overlap' ? `#/system/calendars?tab=${tab}` : '#/system/calendars';
  }
  if (s[1] === 'security') return s[2] ? `#/system/security/${s[2]}` : '#/system/security';
  if (s[1] === 'access-control') return s[2] ? `#/system/access-control/${s[2]}` : '#/system/access-control'; // CR-036 S10 segments
  return `#/system/${s[1]}`;
}

/** The entry the route is on: the exact deep link, else its top-level entry (a sub-page the index does not list). */
export function activeEntry(groups: SettingsGroup[], r: RouteState | null): SettingsEntry | null {
  // SETTINGS-INTERCOM-CARDS-2401: "הכרזות וקול" (layout b's second tab) has no row of its own (owner decision 402): the column marks
  // "מתגי מסכי כניסה", the tab it was split from
  const href = routeHref(r).replace('tab=access-voice', 'tab=access-control');
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

/** The top-level entry a sub-entry belongs to (the nearest one above it in its group), or null. */
export function parentEntry(group: SettingsGroup, entry: SettingsEntry): SettingsEntry | null {
  const i = group.entries.indexOf(entry);
  return i < 0 ? null : group.entries.slice(0, i).reverse().find((e) => !e.sub) ?? null;
}

/** SMALL-UI-BUGS-2343: the entry the column marks - the active one, or its parent when the active one is a tab of a screen that
 * draws its own tabs (`ownTabs`: that sub-entry is not in the column). */
export function navActive(groups: SettingsGroup[], active: SettingsEntry | null): SettingsEntry | null {
  if (!active?.sub) return active;
  const group = groups.find((g) => g.entries.includes(active));
  const parent = group ? parentEntry(group, active) : null;
  return parent?.ownTabs ? parent : active;
}

/** A group's entries as the column draws them: the screens, and the sub-pages of the screen the user is on folded open under it -
 * never those of a screen with its own tab strip (`ownTabs`; they stay in the search). */
export function navTree(group: SettingsGroup, active: SettingsEntry | null): SettingsEntry[] {
  const out: SettingsEntry[] = [];
  let open = false;
  for (const e of group.entries) {
    if (!e.sub) {
      open = !e.ownTabs && !!active && (active === e || (!!active.sub && parentEntry(group, active) === e));
      out.push(e);
    } else if (open) out.push(e);
  }
  return out;
}
