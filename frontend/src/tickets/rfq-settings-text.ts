/**
 * RFQQSET: the words of two request-for-quotation settings (vendor questions). Kept out of rfq-text.ts so the RFQ page bundle does not
 * grow: only the settings screen imports this file. Hebrew first, English second; ar / ru are developer translations pending a native
 * review (the settings screens are he / en only today, so they fall back to English).
 */
import { ticketsLang } from './text';

const he = {
  qReminder: 'תזכורת על שאלת ספק שלא נענתה',
  qReminderSub: 'כמה שעות אחרי השאלה (0 = בלי תזכורת; פעם אחת לכל שאלה)',
  qBadgeAll: 'מספר השאלות הממתינות גם לצופה בכל המחלקות',
  qBadgeAllSub: 'כבוי - רק מי שמנהל את הבקשה רואה את המספר בניווט. הטקסט של השאלות אינו מוצג.',
  // CR-AWARD-NOTICE: the award notice to the vendor ("approved and binding; give notice in advance if you postpone")
  anSetting: 'הודעת אישור לספק שזכה',
  anSettingSub: 'נוסח קבוע: ההצעה אושרה ומחייבת, ועל הספק להודיע מראש דרך הקישור אם הוא דוחה את העבודה',
  anMode_confirm: 'באישור המנהל (ברירת מחדל)',
  anMode_auto: 'אוטומטית עם כל אישור',
  anMode_off: 'לא לשלוח',
  ppLateHours: 'הודעת דחייה "באיחור"',
  ppLateHoursSub: 'הודעה שנמסרה פחות משעות אלה לפני המועד המתוכנן (או אחריו) מסומנת "באיחור" למנהלים. 0 = רק אחרי תחילת המועד. סימון בלבד, לא חסימה',
} as const;

const en: Record<keyof typeof he, string> = {
  qReminder: 'Reminder for an unanswered vendor question',
  qReminderSub: 'Hours after the question (0 = no reminder; once per question)',
  qBadgeAll: 'Pending-questions count for viewers of all departments',
  qBadgeAllSub: 'Off - only a manager of the request sees the count in the navigation. The questions text is never shown.',
  anSetting: 'Approval notice to the selected vendor',
  anSettingSub: 'A fixed text: the quote is approved and binding, and the vendor must notify in advance through the link if he postpones the work',
  anMode_confirm: 'When the manager confirms (default)',
  anMode_auto: 'Automatically with every approval',
  anMode_off: 'Do not send',
  ppLateHours: '"Late" postponement notice',
  ppLateHoursSub: 'A notice given less than this many hours before the scheduled date (or after it) is tagged "late" for the managers. 0 = only after the start. A tag only, never a block',
};

export function qst(key: keyof typeof he): string {
  return ticketsLang() === 'en' ? en[key] : he[key];
}
