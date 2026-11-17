/**
 * Owner 14.10: the words of the deletion dialog (one ticket from its drawer / page, several from the table's bulk bar). The
 * tickets/text.ts contract: Hebrew first, English falls back to Hebrew, every text naming the module is a template with the tokens of
 * tickets/naming.ts (`{ticket}`, `{tickets}`, `{the_ticket}`, `{f:..|m:..}`) rendered with the configured name; `{var}`s after.
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';

const he = {
  action: 'מחיקת {ticket}',
  bulkAction: 'מחיקה',
  title: 'מחיקת {ticket} #{n}',
  bulkTitle: 'מחיקת {n} {tickets}',
  warn: 'המחיקה סופית ואי אפשר לבטל אותה.',
  goes: 'יימחקו: הערות, תמונות, קישורים לגורם חיצוני ועלויות.',
  bulkGoes: 'כל {the_tickets} שנבחרו יימחקו עם ההערות, התמונות, הקישורים והעלויות {f:שלהן|m:שלהם}.',
  typeNumber: 'כדי לאשר, הקלידו את מספר {the_ticket}: {n}',
  typeCount: 'כדי לאשר, הקלידו את מספר {the_tickets} שנבחרו: {n}',
  reason: 'סיבת המחיקה',
  reasonHint: 'עד {max} תווים. נשמרת ביומן הביקורת.',
  required: 'שדה חובה',
  mismatch: 'המספר אינו תואם',
  tooMany: 'אפשר למחוק עד {max} בבת אחת',
  go: 'מחיקה סופית',
  cancel: 'ביטול',
  done: '{the_ticket} #{n} {f:נמחקה|m:נמחק}',
  deletedOne: '{the_ticket} {f:נמחקה|m:נמחק}',
  p_delete: 'מחיקה מלאה', // the permission's words on the "הרשאות" tab (perm-label.ts)
};

export type DeleteTextKey = keyof typeof he;

const en: Partial<Record<DeleteTextKey, string>> = {
  action: 'Delete {ticket}',
  bulkAction: 'Delete',
  title: 'Delete {ticket} #{n}',
  bulkTitle: 'Delete {n} {tickets}',
  warn: 'Deleting is final and cannot be undone.',
  deletedOne: 'Deleted',
  goes: 'Removed with it: notes, photos, outside links and costs.',
  bulkGoes: 'Every selected item is removed with its notes, photos, links and costs.',
  typeNumber: 'To confirm, type the number: {n}',
  typeCount: 'To confirm, type how many are selected: {n}',
  reason: 'Reason for deleting',
  reasonHint: 'Up to {max} characters. Kept in the audit log.',
  required: 'Required',
  mismatch: 'The number does not match',
  tooMany: 'Up to {max} at a time',
  go: 'Delete for good',
  cancel: 'Cancel',
  done: '#{n} deleted',
  p_delete: 'Full deletion',
};

const catalogue = makeCatalogue<DeleteTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const deleteTemplate = catalogue.template;

export const dlt = catalogue.t;

export const DELETE_TEXT_KEYS = catalogue.KEYS;
export const DELETE_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/delete-text', { he, en });
