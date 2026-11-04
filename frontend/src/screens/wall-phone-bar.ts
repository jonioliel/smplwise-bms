/**
 * WALL-PHONE-TOOLBAR-2401 (owner decision 04.11 evening): the camera wall's toolbar on a phone (under 768 px, live-wall.ts).
 *
 *   icons  (default)  ONE row of icon keys (quality, camera count, columns, the recorder filter when there are two or more recorders, the
 *                      kiosk). Each key is touch-sized (44 px); its full name is its accessible name and tooltip, and shows on a long press.
 *                      The row is at most 56 px tall at 390 px and never scrolls sideways.
 *   labels            the earlier toolbar: every control with its full label, a 150 px flex basis each, so they fall into two rows on a
 *                      390 px phone and a label is never cut.
 *
 * Neither mode ends a label in an ellipsis. Installation-wide setting `ui.wall_phone_bar` (הגדרות › כללי › וידאו ומדיה). Pure module: no DOM.
 */

export const WALL_PHONE_BAR_KEY = 'ui.wall_phone_bar';
export const WALL_PHONE_BAR_MODES = ['icons', 'labels'] as const;
export type WallPhoneBarMode = (typeof WALL_PHONE_BAR_MODES)[number];
export const WALL_PHONE_BAR_DEFAULT: WallPhoneBarMode = 'icons';

/** The settings row: its label, its short explanation and the two choices (the default first). */
export const WALL_PHONE_BAR_LABEL = 'סרגל קיר המצלמות בטלפון';
export const WALL_PHONE_BAR_HINT = 'הכפתורים מעל הקיר בטלפון. בשורה אחת: אייקונים, והשם המלא בלחיצה ארוכה';
export const WALL_PHONE_BAR_OPTIONS: readonly (readonly [WallPhoneBarMode, string])[] = [
  ['icons', 'שורה אחת עם אייקונים (ברירת מחדל)'],
  ['labels', 'שתי שורות עם שמות מלאים'],
];

/** Any stored / received value in its canonical form: an unknown value reads as the default. */
export function wallPhoneBarMode(raw: unknown): WallPhoneBarMode {
  return raw === 'labels' ? 'labels' : WALL_PHONE_BAR_DEFAULT;
}

/** How long a finger rests on a key before its full name shows, and how long the name stays. */
export const KEY_HINT_PRESS_MS = 450;
export const KEY_HINT_SHOW_MS = 2500;
/** A finger that moves this far is scrolling, not pressing. */
export const KEY_HINT_MOVE_PX = 10;

/** The full name a key shows on a long press / as its tooltip: "<what it is>: <what is chosen>" (the name alone without a choice). */
export function keyHint(label: string, value?: string | null): string {
  const v = (value ?? '').trim();
  return v ? `${label}: ${v}` : label;
}

/** The small number on the camera-count key: the count chosen, the total for "all", nothing while a map selection is shown. */
export function countBadge(count: number, total: number, fromMap: boolean): string {
  if (fromMap) return '';
  if (!Number.isFinite(count) || count <= 0 || count >= total) return total > 0 ? String(total) : '';
  return String(count);
}

/** The small number on the columns key: the columns chosen by hand, nothing for the automatic best fit. */
export function colsBadge(cols: number): string {
  return Number.isFinite(cols) && cols > 0 ? String(cols) : '';
}
