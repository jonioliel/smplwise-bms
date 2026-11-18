// I18N-EN-SWITCH-2438: the English of the shell's own texts (src/shell/*): the Hebrew text as written in the template -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/shell', packTable<typeof import('../lang/en/i18n/msg/shell').en>('en', 'i18n/msg/shell', 'en'));
