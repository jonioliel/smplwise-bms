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
} as const;

const en: Record<keyof typeof he, string> = {
  qReminder: 'Reminder for an unanswered vendor question',
  qReminderSub: 'Hours after the question (0 = no reminder; once per question)',
  qBadgeAll: 'Pending-questions count for viewers of all departments',
  qBadgeAllSub: 'Off - only a manager of the request sees the count in the navigation. The questions text is never shown.',
};

export function qst(key: keyof typeof he): string {
  return ticketsLang() === 'en' ? en[key] : he[key];
}
