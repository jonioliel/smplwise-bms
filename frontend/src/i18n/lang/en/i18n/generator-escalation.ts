// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/generator-escalation.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  title: 'How a critical alert escalates',
  sub: 'As it works today',
  who: 'When an alert opens it is sent to the recipients of its alert type. A type with no recipients of its own uses the default of its severity. If no one is chosen, no one receives it at this stage.',
  critical: 'A critical alert that is not acknowledged within {n} min is sent to the escalation recipients: the holders of the notification-management permission (or the users chosen in the notification settings) who may see it. This happens even when escalation is off in the notification settings.',
  steps: 'Further escalation steps repeat at the interval, and up to the number of steps, set in the notification settings (1 to 3).',
  other: 'Any other severity escalates only when escalation is on for that alert type, after the minutes set there. With no value of its own it uses the same {n} min.',
  stops: 'Acknowledging the alert, or the condition returning to normal, stops the escalation at once. A critical alert is never held back by quiet hours, and an escalation ignores them.',
  where: 'Where to edit: recipients and channels per alert type or per severity are in the tables below. The {n}-minute delay is in the default of "Critical". Escalation of a single type is in its edit panel. The escalation recipients, the number of steps and the interval are in the notification settings.',
  perm: 'Changing the routing needs the generator-management permission. Adding WhatsApp also needs the notification-management permission.',
};
