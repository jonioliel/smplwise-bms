// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/building-presence.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  chipLabel: 'Building presence', occupied: 'Active', occupiedRooms: (n: number) => (n === 1 ? '1 room' : `${n} rooms`), empty: 'Empty',
  emptySince: (hhmm: string) => `Empty since ${hhmm}`, unknown: 'No data', heading: 'Building presence', subheading: 'Tagged presence sensors',
  noSensors: 'No presence sensors found', tagged: 'tagged', noRoom: 'No room', holdLabel: 'Hold after the sensor calms down', holdUnit: 'seconds',
  emptyLabel: 'Building counts as empty after', emptyUnit: 'minutes', save: 'Save', saved: 'Saved',
  statusWord: { occupied: 'Active', clear: 'Empty', unknown: 'No data' }, stateWord: (s: string | null) => (s === 'on' ? 'Presence detected' : s === 'off' ? 'No presence' : 'Unavailable'),
  tooManyHint: 'Up to 200 sensors', masterLabel: 'Building presence tracking',
  masterHint: 'Off by default. While off, no sensor is read, no history is kept and nothing is shown.', masterOffNote: 'Tracking is off',
  tagNote: 'The tag is stored in Arx only; the sensor itself is not changed', roomPick: 'Choose a room', ownRoom: 'Room from the system', homeLabel: 'On the home screen',
  homeCard: 'Card', homeChip: 'Thin line', homeOff: 'Off', tintLabel: 'Presence on the map', tintHint: 'An Active / Empty since tag on every room with a sensor',
  historyHeading: 'Presence history', retentionLabel: 'Keep days (0 = keep none)', retentionUnit: 'days',
  privacy: 'Only when each room started and stopped being active is kept. No names, no phones, no pictures. Even so, work habits can be learned from it, so keep it only as long as needed.',
  rowsKept: 'Records kept', oldest: 'Oldest', purge: 'Delete all history', purgeTitle: 'Delete all presence history?',
  purgeBody: (n: number) => `${n} records will be deleted. This cannot be undone. The current state on the map and home screen is not affected.`,
  purgeConfirm: 'Delete', cancel: 'Cancel', purged: 'History deleted', tab: 'Building sensors', timesHeading: 'Times and display',
  cardNoInfo: 'The sensors are not reporting', cardNote: 'Rooms, not people · no names', updated: (hhmm: string) => `Updated ${hhmm}`,
  found: 'found', filterLabel: 'Filter sensors', filterAll: 'All', filterTagged: 'Tagged', filterUntagged: 'Not tagged',
  kindWord: (k: string | null) => (k === 'motion' ? 'Motion sensor' : 'Presence sensor'), editTitle: 'Edit tag', stateNow: 'State now', removeTag: 'Remove tag', close: 'Close', onMap: 'On the map',
  loading: 'Loading the presence settings', loadFailed: 'The presence settings could not be read', retry: 'Try again',
  lastEmpty: (name: string, hhmm: string) => `${name} · empty since ${hhmm}`, emptyNames: 'Empty', unknownNames: 'No data', activeRooms: 'active rooms',
  noFloor: 'No floor', wholeBuilding: 'Whole building',
  cardHeading: 'The home screen card', styleLabel: 'Style', styleCount: 'Count and names', styleStrip: 'Strip', styleFloors: 'Count and floors', styleQuiet: 'Quiet line', styleOff: 'No card, the map only',
  emptyRoomsLabel: 'Empty rooms', emptyHide: 'Only active rooms in the card', emptyShow: 'Empty rooms too, in grey', detailsLabel: 'Update time and empty rooms',
  detailsHover: 'Only on mouse hover', detailsInline: 'Inside the card', allEmptyLabel: 'When every room is empty', allEmptyLast: 'The room that emptied last',
  allEmptyCount: 'Only "all rooms are empty"', cardOnlyHint: 'Applies when the home display is "Card"',
  countWord: (n: number) => (n === 1 ? 'active room' : 'active rooms'), countEmpty: 'The building is empty', countUnknown: 'No data from the sensors',
  countUnknownSub: 'Rooms appear once the sensors report',
  areaLineLabel: 'Presence', areaLineAria: 'Presence in the area', nobody: 'Nobody here', areaSwitchLabel: 'Presence line on the area screen',
  areaSwitchHint: 'Off by default. Shown on the area screen and in the area quick window. Whoever may see names sees names; everyone else sees a number only',
};
