// I18N-EN-SWITCH-2438: the English of the WisKey access-control / intercom screen texts (src/screens/wiskey-*.ts, intercom-*.ts,
// installer-*.ts, access-*.ts; the WisKey word table of wiskey-format.ts): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
// The host platform is "the server" here (the Hebrew "תשתית המערכת"), never its name.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/wiskey', packTable<typeof import('../lang/en/i18n/msg/wiskey').en>('en', 'i18n/msg/wiskey', 'en'));
