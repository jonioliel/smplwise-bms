// MU2 voice announcements: the Settings screen's strings in Hebrew (the product language), English, Russian and Arabic. The document language picks
// the column; keys are the same in all of them. No product names of the infrastructure appear here (UI_COPY_RULES). ANNOUNCE-295 (stage A): the announce
// screen, the templates editor, the engine selector and the quiet-hours modes. The Russian and Arabic columns are an initial, unreviewed translation
// (ANNOUNCE_DEV_MARKED), like the other tables that carry them. Arabic is screen text only: announcements are SPOKEN in Hebrew, English or Russian.
import { docLang, registerCatalogue } from './core';
import { NAV_ANNOUNCE } from './nav-labels'; // CR-NAV-LABELS-2436: the shell's label lives there
import { packTable, withEntries } from './lang-packs';

const he = {
  tab: 'הכרזות קוליות',
  sub: 'דיבור ברמקולים לפי חדר או רמקול',
  general: 'הכרזות קוליות',
  enabled: 'הכרזות קוליות',
  enabledHint: 'כבוי = אי אפשר להכריז ולא חוק ידבר',
  engine: 'מנוע דיבור',
  engineHint: 'ישות tts של המערכת, למשל tts.google_translate_en_com',
  language: 'שפה',
  limit: 'מקסימום הכרזות בדקה',
  volume: 'עוצמה (אחוזים)',
  volumeHint: 'ריק = לא משנים את עוצמת הרמקול',
  pause: 'השהיית מוזיקה בזמן ההכרזה',
  pauseHint: 'מוזיקה שמתנגנת מושהית ומחודשת אחרי ההכרזה',
  quiet: 'שעות שקט להכרזות',
  quietEnabled: 'שעות שקט',
  quietHint: 'הכרזה קריטית והכרזת חירום תמיד נשמעות',
  from: 'מתחיל',
  to: 'מסתיים',
  mode: 'בשעות שקט',
  modeSuppress: 'לא להכריז',
  modeLower: 'להנמיך',
  modeQueue: 'להמתין עד סוף שעות השקט',
  modeAllow: 'להכריז כרגיל',
  nightVolume: 'עוצמה בלילה (אחוזים)',
  routing: 'הכרזה מהתראות',
  routingEnabled: 'הכרזת התראות',
  routingHint: 'התראות שבמדיניות שלהן סומן ערוץ ההכרזה יושמעו בחדר שנבחר',
  routingRoom: 'חדר',
  routingNone: 'בחרו חדר',
  minSeverity: 'חומרה מינימלית',
  severity: { info: 'מידע', alert: 'התראה', critical: 'קריטי' } as Record<string, string>,
  categories: 'קטגוריות (ריק = הכול)',
  category: { safety: 'בטיחות', alerts: 'התראות', doors: 'דלתות', device_faults: 'תקלות התקנים', automations: 'אוטומציות', system: 'מערכת', security: 'אבטחה' } as Record<string, string>,
  speakers: 'רמקולים מורשים להכרזה',
  speakersHint: 'רק רמקולים מסומנים יכולים לדבר. חדר = הרמקולים המורשים שבו.',
  none: 'אין רמקולים מאושרים. אשרו נגנים בלשונית "מסכים ונגנים".',
  noRoom: 'ללא אזור',
  test: 'בדיקה',
  testHint: 'משמיע משפט בדיקה קבוע ברמקול או בחדר שנבחר',
  testAction: 'השמע בדיקה',
  room: 'חדר',
  speaker: 'רמקול',
  say: 'הכרזה עכשיו',
  text: 'טקסט',
  send: 'הכרז',
  history: 'הכרזות אחרונות',
  empty: 'עדיין לא הוכרז דבר.',
  saved: 'נשמר',
  sent: 'ההכרזה נשלחה',
  forbidden: 'נדרשת הרשאת מנהל מערכת.',
  local: 'ההגדרה זמינה ברשת המקומית בלבד.',
  src: { manual: 'ידנית', test: 'בדיקה', rule: 'חוק', notification: 'התראה', emergency: 'חירום' } as Record<string, string>,
  status: { sent: 'נשמע', failed: 'נכשל', limited: 'נחסם (קצב)', refused: 'נדחה', pending: 'בביצוע', queued: 'ממתין', cancelled: 'בוטל' } as Record<string, string>,
  // ANNOUNCE-295: the engine selector
  engineKind: 'סוג מנוע הדיבור',
  engineLocal: 'מקומי (הטקסט נשאר בבניין)',
  engineCloud: 'ענן',
  cloudSwitch: 'אפשר מנוע ענן',
  cloudWarn: 'כשמנוע הענן פעיל, טקסט ההכרזה יוצא מהבניין אל שירות חיצוני. כבוי כברירת מחדל.',
  cloudKey: 'מפתח שירות הענן',
  cloudKeySet: 'המפתח שמור',
  cloudKeyMissing: 'המפתח לא הוגדר. מזינים אותו בהגדרות ‹ חיבורים ‹ סודות.',
  emergencyLangs: 'שפות הכרזת חירום',
  langName: { he: 'עברית', en: 'English', ru: 'Русский', ar: 'العربية' } as Record<string, string>,
  // the templates editor
  templates: 'תבניות הודעה',
  templatesHint: 'הודעות מוכנות להכרזה. תבנית חירום מופיעה ככפתור בלחיצה אחת במסך ההכרזות.',
  addTemplate: 'תבנית חדשה',
  removeTemplate: 'מחיקה',
  saveTemplates: 'שמירת תבניות',
  kind: 'סוג',
  kindRoutine: 'רגילה',
  kindEmergency: 'חירום',
  tplName: 'שם',
  tplText: 'טקסט',
  tplProblem: { count: 'יותר מדי תבניות.', id: 'מזהה התבנית אינו תקין או כפול.', he: 'שם וטקסט בעברית נדרשים בכל תבנית.', length: 'שם או טקסט ארוכים מדי.' } as Record<string, string>,
  // the announce screen
  title: NAV_ANNOUNCE.he.title,
  where: 'יעד',
  wholeBuilding: 'כל הבניין',
  languages: 'שפות',
  template: 'תבנית',
  noTemplate: 'טקסט חופשי',
  emergency: 'חירום',
  sentQueued: 'ההכרזה תושמע בסיום שעות השקט',
  emergencySent: 'הכרזת החירום נשלחה',
  off: 'ההכרזות כבויות',
  noTargets: 'אין רמקול מורשה להכרזה',
  emergencyFree: 'הכרזת חירום בטקסט חופשי',
  engineCloudWarn: 'המנוע שנבחר שולח את הטקסט לשירות בענן, מחוץ לבניין.',
  screens: 'הצגה על מסכים',
  screensHint: 'הטקסט של ההכרזה מוצג גם על לוחות התצוגה ומסכי הקיר שסומנו. אותם כללי שעות שקט, הגבלה וחירום כמו ברמקולים.',
  screensEnabled: 'הצגת הכרזות על מסכים',
  screensEnabledHint: 'כבוי = ההכרזות נשמעות בלבד',
  screensDefault: 'להציג על מסכים כברירת מחדל',
  screensSeconds: 'זמן הצגה (שניות)',
  screensCriticalSeconds: 'זמן הצגה בחירום (שניות)',
  screensPoll: 'תדירות בדיקה של המסך (שניות)',
  screensList: 'מסכים מורשים',
  screensNone: 'אין לוחות תצוגה או מסכי קיר זמינים',
  screensArea: 'חדר',
  screensDevice: 'מסך מדיה מקושר',
  screensNoArea: 'ללא חדר',
  screensNoDevice: 'ללא',
  screensKindBoard: 'לוח תצוגה',
  screensKindWall: 'מסך קיר',
  channels: 'איפה',
  channelSpeakers: 'רמקולים',
  channelScreens: 'מסכים',
  screenOnly: 'מסכים בלבד',
  stopScreens: 'הסרה מהמסכים',
  // ANNOUNCE-297: the automatic translation and the screens' close rule
  translate: 'תרגום',
  translating: 'מתרגם…',
  machineBadge: 'תרגום אוטומטי',
  translateCard: 'תרגום אוטומטי',
  translateHint: 'מתרגם הכרזה בעברית לערבית, אנגלית ורוסית. הטקסט נשלח לשירות חיצוני, ולכן כבוי כברירת מחדל ודורש אישור הבעלים. התרגום ממלא את השפות כטיוטה שאפשר לערוך, ואינו מעכב את השליחה.',
  translateEnabled: 'הפעלת תרגום אוטומטי',
  translateProvider: 'ספק התרגום',
  translateProviderOff: 'כבוי',
  translateProviderGoogle: 'Google (חינם, ללא מפתח)',
  translateProviderCloud: 'OpenAI',
  translateApprove: 'אישור הבעלים לשליחת טקסט ההכרזה לספק',
  translateApproveAction: 'רישום אישור',
  translateApprovedBy: 'אושר על ידי',
  translateNotApproved: 'לא אושר',
  translateTargets: 'שפות יעד',
  screensCriticalClose: 'סגירת הודעת חירום במסך קיר אחרי (שניות)',
};
const en: typeof he = withEntries(packTable<typeof import('./lang/en/i18n/announce').en>('en', 'i18n/announce', 'en'), {
  title: NAV_ANNOUNCE.en.title,
});
const ru: typeof he = withEntries(packTable<typeof import('./lang/ru/i18n/announce').ru>('ru', 'i18n/announce', 'ru'), {
  title: NAV_ANNOUNCE.ru.title,
});
const ar: typeof he = withEntries(packTable<typeof import('./lang/ar/i18n/announce').ar>('ar', 'i18n/announce', 'ar'), {
  title: NAV_ANNOUNCE.ar.title,
});

export type AnnounceText = typeof he;
export type AnnounceUiLang = 'he' | 'en' | 'ar' | 'ru';
/** The columns that are an initial, unreviewed translation. */
export const ANNOUNCE_DEV_MARKED: readonly AnnounceUiLang[] = ['ar', 'ru'];
export const ANNOUNCE_TABLES: Record<AnnounceUiLang, AnnounceText> = { he, en, ar, ru };

export function announceUiLang(): AnnounceUiLang {
  return docLang(['en', 'ar', 'ru']);
}
/** The SPOKEN language that goes with the screen (the test button, the default of the announce form): Arabic is screen text only, so it speaks Hebrew. */
export function announceLang(): 'he' | 'en' | 'ru' {
  const l = announceUiLang();
  return l === 'en' ? 'en' : l === 'ru' ? 'ru' : 'he';
}
export function announceText(lang: AnnounceUiLang = announceUiLang()): AnnounceText {
  return ANNOUNCE_TABLES[lang];
}

registerCatalogue('i18n/announce', { he, en, ar, ru }, ANNOUNCE_DEV_MARKED);
