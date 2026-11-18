// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/quiet-windows.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  title: 'Quiet window for a floor or an area',
  sub: 'One button on the floor or area header holds informational notifications for a while. Critical and safety notifications are never held.',
  enabled: 'Quiet window', enabledHint: 'Off by default. Switching it off ends every open window at once.', off: 'Off', on: 'On',
  defaultMinutes: 'Default length (minutes)', maxMinutes: 'Longest length (minutes)', minutesHint: '{lo} to {hi} minutes',
  muteAlerts: 'Also hold important notifications', muteAlertsHint: 'Off: only informational notifications are held',
  channels: 'Channels the window holds',
  channelsHint: 'Push only: the push to the phone and the browser is held; email, WhatsApp and announcements are sent as usual. The notification centre keeps everything either way.',
  ch_push: 'Push only', ch_all: 'All channels', save: 'Save', saved: 'Settings saved', readOnly: 'Changing these settings needs a system administrator.',
  demo: 'Demo data: the settings are saved against a server only.', errRange: 'A length from {lo} to {hi} minutes',
  errOverMax: 'The default length is longer than the longest length', confirmTitle: 'Save the quiet window settings?',
  confirmBody: 'The change applies at once to every floor and area.', confirmEnds: 'Switching it off ends every open quiet window now.',
  confirmGo: 'Save', cancel: 'Cancel', loadError: 'The quiet window settings could not be loaded',
};
