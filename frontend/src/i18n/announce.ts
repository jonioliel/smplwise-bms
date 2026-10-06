// MU2 voice announcements: the Settings screen's strings in Hebrew (the product language) and English. The English column is used when the
// document language is English; keys are the same in both. No product names of the infrastructure appear here (UI_COPY_RULES).
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
  src: { manual: 'ידנית', test: 'בדיקה', rule: 'חוק' } as Record<string, string>,
  status: { sent: 'נשמע', failed: 'נכשל', limited: 'נחסם (קצב)', refused: 'נדחה', pending: 'בביצוע' } as Record<string, string>,
};
const en: typeof he = {
  tab: 'Voice announcements',
  sub: 'Speak through speakers by room or by speaker',
  general: 'Voice announcements',
  enabled: 'Voice announcements',
  enabledHint: 'Off = nothing can be announced and no rule speaks',
  engine: 'Speech engine',
  engineHint: 'A tts entity of the system, e.g. tts.google_translate_en_com',
  language: 'Language',
  limit: 'Maximum announcements per minute',
  speakers: 'Speakers allowed to announce',
  speakersHint: 'Only ticked speakers can speak. A room means its allowed speakers.',
  none: 'No approved speakers. Approve players in the "Screens and players" tab.',
  noRoom: 'No area',
  test: 'Test',
  testHint: 'Plays a fixed test sentence on the chosen speaker or room',
  testAction: 'Play test',
  room: 'Room',
  speaker: 'Speaker',
  say: 'Announce now',
  text: 'Text',
  send: 'Announce',
  history: 'Recent announcements',
  empty: 'Nothing announced yet.',
  saved: 'Saved',
  sent: 'Announcement sent',
  forbidden: 'System administrator permission is required.',
  local: 'This setting is available on the local network only.',
  src: { manual: 'Manual', test: 'Test', rule: 'Rule' },
  status: { sent: 'Spoken', failed: 'Failed', limited: 'Blocked (rate)', refused: 'Refused', pending: 'In progress' },
};

export type AnnounceText = typeof he;
export function announceLang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}
export function announceText(): AnnounceText {
  return announceLang() === 'en' ? en : he;
}
