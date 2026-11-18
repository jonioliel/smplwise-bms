// I18N-EN-SWITCH-2438: the English of the remaining screens' texts (src/screens/: home-*, infra-*, placeholder-screen, screens-index,
// styleguide-screen, bubble-demo, electricity/*): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/screens', packTable<typeof import('../lang/en/i18n/msg/screens').en>('en', 'i18n/msg/screens', 'en'));
