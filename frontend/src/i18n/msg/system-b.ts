// I18N-EN-SWITCH-2438: the English of the settings screens' own texts (src/screens/system-index.ts … system-xs-options.ts, in name
// order): the Hebrew text as written -> its English. Settings screens, so "Home Assistant" stays where the Hebrew says it (Q-DES-10).
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/system-b', packTable<typeof import('../lang/en/i18n/msg/system-b').en>('en', 'i18n/msg/system-b', 'en'));
