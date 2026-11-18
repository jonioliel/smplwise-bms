// I18N-EN-SWITCH-2438: the English of the automation texts (src/screens/automation-*.ts, automations-*.ts, schedule-*.ts, schedules-*.ts,
// scene-*.ts, scenes-*.ts, script-*.ts, scripts-*.ts, scenario-*.ts, scenarios-*.ts: the automation editor and drawer, schedules, scenes,
// scripts and scenarios): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
// One Hebrew text has one English across the module, so a few words serve several screens (מצב = State, עוצמה = Level, הפעל = Activate);
// "ו" and "יהיו תזמון נפרד, ו" end with a space on purpose: the Hebrew joins the next word to the prefix "ו", the English needs a space.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/automation', packTable<typeof import('../lang/en/i18n/msg/automation').en>('en', 'i18n/msg/automation', 'en'));
