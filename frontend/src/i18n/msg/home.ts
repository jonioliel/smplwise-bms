// CR-I18N-HOME-2441 (code review 08:F11): the English of the home interface's texts (src/home/*: the home screens, the v3 screens,
// the doorbell call and the administrator's home-interface tab): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
// Some keys are parts of a sentence the screen puts together around a name or a number (a leading or a trailing space is then part
// of the key and of its English). tests/unit-i18n-home.spec.ts keeps the table complete.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/home', packTable<typeof import('../lang/en/i18n/msg/home').en>('en', 'i18n/msg/home', 'en'));
