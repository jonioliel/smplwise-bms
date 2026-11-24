// MFA-SCREENS-2510: the English of the second-factor screens (My Account › Security, Users & permissions › Second factor, the user
// drawer's factors section, the sign-in methods chooser): the Hebrew text as written in the template -> its English. Read through
// `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/mfa', packTable<typeof import('../lang/en/i18n/msg/mfa').en>('en', 'i18n/msg/mfa', 'en'));
