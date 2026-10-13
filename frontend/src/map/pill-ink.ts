/**
 * The ink of a pill over the 3D canvas (owner 2026-10-13: the HUD panels are opaque). A room-name or entity pill carries the colour of what it
 * names - the scene builder hands over a token name (`live`, `stale`, `text-3`, `map-label`) - and that bare colour is a dot / bar colour: on the
 * opaque pill it is a text colour and has to read at 4.5:1 in every skin and scheme (`--sw-live` on a white surface is 2.3:1, `--sw-text-3` and the
 * map label 3:1). Each name maps to its readable twin (the `-text` companion the token table keeps for exactly this, or the secondary ink); a name
 * with no entry is used as it is (tests/unit-hud-opaque.spec.ts proves the twins against the menu surface of every skin x scheme).
 */
export const PILL_INK: Readonly<Record<string, string>> = {
  live: 'live-text',
  recorded: 'recorded-text',
  offline: 'offline-text',
  stale: 'stale-text',
  unknown: 'unknown-text',
  danger: 'danger-text',
  warning: 'warning-text',
  success: 'live-text', // (--sw-success-text is the soft-fill ink of a badge: 3.3:1 on a white surface)
  forbidden: 'forbidden-text',
  accent: 'accent-text',
  'text-3': 'text-2',
  'map-label': 'text-2',
};

/** The `var(--sw-...)` the pill's `--lbl` is set to for a scene colour token. */
export const pillInk = (color: string): string => `var(--sw-${PILL_INK[color] ?? color})`;
