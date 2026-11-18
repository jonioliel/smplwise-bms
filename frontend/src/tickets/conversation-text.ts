/**
 * TKUI2 (release 2.6.0): the words of the request's Conversation and History tabs (IA §4.2, §5 copy examples; mock-up v5). A catalogue
 * of its own beside tickets/drawer-text.ts (the board-text.ts pattern), so the sibling tasks never edit the same lines.
 *
 * The tickets/text.ts contract (D33): Hebrew first, the English column falls back to the Hebrew, a text that names the module uses the
 * tokens of tickets/naming.ts (`{ticket}`, `{the_ticket}`, `{f:..|m:..}`), then the `{var}`s are filled. The default name is never
 * written here (tests/unit-tickets-naming.spec.ts). The delivery words reuse slice 5b's (messages-text.ts): the product never says
 * "delivered" or "read" (D14) - the only receipt is "the link was opened after the message".
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

const he = {
  // ---- the two sub-tabs (IA §4.2): the toggle group, its captions, the badges
  subs: 'שיחה עם',
  sub_vendor: 'עם הספק',
  sub_team: 'הצוות',
  sub_notes: 'הערות',
  sub_unread_one: 'הודעה אחת חדשה',
  sub_unread_many: '{n} הודעות חדשות',
  cap_vendor_whatsapp: 'הספק רואה את ההודעות כאן · WhatsApp ודף הקישור',
  cap_vendor_email: 'הספק רואה את ההודעות כאן · מייל ודף הקישור',
  cap_vendor_page: 'הספק רואה את ההודעות כאן · בדף הקישור',
  cap_vendor_none: 'אין כרגע ספק משויך · ההודעות הקודמות נשמרות כאן',
  cap_team: 'הצוות בלבד · הספק לא רואה',
  cap_notes: 'רק הצוות רואה כאן',
  log_vendor: 'הודעות עם הספק',
  log_team: 'הערות הצוות',
  empty_vendor: 'עוד לא נשלחה הודעה ל{name}',
  empty_vendor_none: 'אין הודעות',
  empty_team: 'אין הערות · רק הצוות רואה כאן',
  older: 'הודעות קודמות ({n})',
  today: 'היום',
  yesterday: 'אתמול',
  // ---- the composers: different colour, icon and verb (lock + "שמירה" vs send + "שליחה ל{name}")
  ph_vendor_whatsapp: 'הודעה ל{name} ב-WhatsApp ובדף הקישור',
  ph_vendor_email: 'הודעה ל{name} במייל ובדף הקישור',
  ph_vendor_page: 'הודעה ל{name} בדף הקישור',
  ph_team: 'הערה לצוות',
  send_vendor: 'שליחה ל{name}',
  save_team: 'שמירה',
  hint_vendor: 'Ctrl+Enter שולח',
  hint_team: 'Enter שומר · הצוות בלבד',
  photo_team: 'תמונה פנימית',
  photo_vendor: 'תמונה לספק',
  from_note_draft: 'מהערה פנימית · עוד לא נשלח',
  clear_draft: 'ניקוי',
  prefilled: 'הועתק להודעה לספק · עוד לא נשלח',
  sent_vendor: 'ההודעה נשלחה ל{name}',
  sent_vendor_page: 'ההודעה מוצגת ל{name} בדף הקישור',
  saved_team: 'ההערה נשמרה · הצוות בלבד',
  send_failed: 'ההודעה לא נשלחה',
  save_failed: 'ההערה לא נשמרה',
  // ---- the feed rows
  note_head: 'הערה פנימית',
  note_not_sent: 'לא נשלחה לספק',
  note_forwarded: 'נשלחה לספק · {when}',
  forward: 'שלח לספק',
  from_note: 'מהערה פנימית',
  auto: 'אוטומטי',
  ch_page: 'דף הקישור',
  ch_whatsapp: 'WhatsApp',
  ch_email: 'מייל',
  me: 'אני',
  d_page: 'מוצג בדף הקישור',
  d_page_opened: 'הקישור נפתח אחרי ההודעה',
  to_costs: 'לעלויות',
  more_text: 'עוד',
  less_text: 'פחות',
  e_quote_submitted: 'הוגשה הצעת מחיר',
  e_quote_decided: 'התקבלה החלטה על הצעת המחיר',
  e_owner_changed: 'אחראי בארגון: {name}',
  e_owner_cleared: 'האחראי בארגון הוסר',
  // ---- History (IA §4.1): the timeline with its filter chips, the files, the link audit
  h_timeline: 'ציר זמן',
  h_filters: 'סינון ציר הזמן',
  f_all: 'הכול',
  f_messages: 'הודעות',
  f_notes: 'הערות',
  f_status: 'מצב',
  f_costs: 'עלויות',
  h_empty_filter: 'אין פריטים בסינון הזה',
  h_more: 'אירועים קודמים ({n})',
  h_files: 'קבצים',
  h_files_none: 'אין קבצים',
  file_photo: 'תמונה {n}',
  file_internal: 'פנימי',
  file_vendor: 'גלוי לספק',
  file_mine: 'צירפת',
  h_audit: 'ביקורת',
  h_audit_link: 'הקישור של הספק',
  h_audit_none: 'אין עדיין פעולות על הקישור',
};

export type ConvTextKey = keyof typeof he;

const en: Partial<Record<ConvTextKey, string>> = packTable<typeof import('../i18n/lang/en/tickets/conversation-text').en>('en', 'tickets/conversation-text', 'en');

/** The raw template of a key (the unit tests read it). */
const catalogue = makeCatalogue<ConvTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const convTemplate = catalogue.template;

/** A text of the Conversation / History tabs: the module's name rendered (D33), then the `{var}`s. */
export const cvt = catalogue.t;

export const CONV_TEXT_KEYS = catalogue.KEYS;
export const CONV_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/conversation-text', { he, en });
