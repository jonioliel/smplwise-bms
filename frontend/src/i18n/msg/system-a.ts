// I18N-EN-SWITCH-2438: the English of the first half of the Settings screens (src/screens/system-access*.ts through
// system-home-screen.ts): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/system-a', packTable<typeof import('../lang/en/i18n/msg/system-a').en>('en', 'i18n/msg/system-a', 'en'));
