// I18N-EN-SWITCH-2438: the English of the shell's own texts (src/shell/*): the Hebrew text as written in the template -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';

export const tr = msgCatalogue('msg/shell', {
  'שפה': 'Language',
  'שפת הממשק': 'Interface language',
  'חל על כל המסכים ועל כל מכשיר שבו נכנסים בחשבון הזה.': 'Applies to every screen and every device you sign in to with this account.',
  'הדף ייטען מחדש בשפה שנבחרה.': 'The page reloads in the chosen language.',
  'השמירה נכשלה': 'Saving failed',
});
