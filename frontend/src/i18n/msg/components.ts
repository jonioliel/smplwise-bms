// I18N-EN-SWITCH-2438: the English of the shared component texts (src/components/*: media player and remote, notifications,
// recorder panels, WisKey wk-*, pickers, tables, badges ...): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/components', packTable<typeof import('../lang/en/i18n/msg/components').en>('en', 'i18n/msg/components', 'en'));
