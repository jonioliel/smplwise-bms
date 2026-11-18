// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/notice-chips.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  orderHint: 'The order of this list is the order of the chips on the board and their priority: when the row has no room, a healthy chip lower in the list is hidden first. A fault stays to the end.',
  moveUp: 'Move up: {k}',
  moveDown: 'Move down: {k}',
  noSource: 'No source, the chip is not shown. Pick a source in the notice-board settings.',
  sourcesTitle: 'Sources of the parking and gym chips',
  sourcesHint: 'The chip shows the state only (a word and a colour), never the entity name. With no entity picked the chip is not shown.',
  parkingLabel: 'Parking',
  parkingHint: 'A number = free spaces (summed over the entities). An occupied / free sensor = one space (on = taken). A list = its option as written.',
  gymLabel: 'Gym',
  gymHint: 'A switch or a schedule: on = open, off = closed. An occupancy sensor: in use / free, never a number of people. A list = its option as written.',
  pick: 'Pick an entity',
  add: 'Add',
  remove: 'Remove',
  removeOne: 'Remove: {n}',
  none: 'No entity picked',
  noCandidates: 'No suitable entities',
  max: 'Up to {n} entities',
  gone: 'Not found',
  invert: 'Invert',
  invertOne: 'Invert: {n}',
  invertParking: 'Invert: for a sensor or switch where on = free (instead of on = taken).',
  invertGym: 'Invert: for a switch or sensor where on = closed, or an occupancy sensor where on = free.',
};
