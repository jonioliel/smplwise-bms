// CR-I18N-LAZY-LANG-2443: language pack table of src/tickets/rfq-settings-text.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
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
