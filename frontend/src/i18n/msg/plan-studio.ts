// I18N-REST-2520: the English of the texts written into the plan studio panel (src/screens/plan-studio-panel.ts): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/plan-studio', packTable<typeof import('../lang/en/i18n/msg/plan-studio').en>('en', 'i18n/msg/plan-studio', 'en'));
