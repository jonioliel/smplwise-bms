/**
 * RFQQSET: the words of two request-for-quotation settings (vendor questions). Kept out of rfq-text.ts so the RFQ page bundle does not
 * grow: only the settings screen imports this file. Hebrew first, English second; ar / ru are developer translations pending a native
 * review (the settings screens are he / en only today, so they fall back to English).
 */
import { ticketsLang } from './text';
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

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

const en: Record<keyof typeof he, string> = packTable<typeof import('../i18n/lang/en/tickets/rfq-settings-text').en>('en', 'tickets/rfq-settings-text', 'en');

export function qst(key: keyof typeof he): string {
  return ticketsLang() === 'en' ? en[key] : he[key];
}

registerCatalogue('tickets/rfq-settings-text', { he, en });
