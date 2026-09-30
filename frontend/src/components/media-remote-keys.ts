/**
 * CR-015 S3: the remote's vocabulary as data - the Hebrew label and the glyph of every KeyId, the glyph set itself and the
 * neutral tint of a source / app glyph. Pure (no DOM, no Lit): the unit specs load it in node, `media-remote.ts` renders it.
 *
 * Rules carried here: there is NO power key - `KeyId` has none and nothing below invents one (power is the turn_on /
 * turn_off buttons of the remote, never a key). App and source glyphs are neutral pictograms tinted with OUR hues, never
 * a brand logo or a brand colour (CR-015 §7.4).
 */
import type { Glyph, KeyId, RemoteSection } from '../api/media-screens';

/** The label a key has for a screen reader and, where it is drawn with text, for the eye. */
export const KEY_LABEL: Record<KeyId, string> = {
  up: 'למעלה', down: 'למטה', left: 'שמאלה', right: 'ימינה', ok: 'אישור', back: 'חזרה', home: 'בית', menu: 'תפריט', exit: 'יציאה', info: 'מידע',
  guide: 'מדריך', source: 'מקור', tools: 'כלים', settings: 'הגדרות', chlist: 'רשימת ערוצים', prech: 'ערוץ קודם',
  volup: 'הגבר', voldown: 'הנמך', mute: 'השתק', chup: 'ערוץ הבא', chdown: 'ערוץ קודם',
  n0: '0', n1: '1', n2: '2', n3: '3', n4: '4', n5: '5', n6: '6', n7: '7', n8: '8', n9: '9',
  red: 'אדום', green: 'ירוק', yellow: 'צהוב', blue: 'כחול', play: 'נגן', pause: 'השהה', stop: 'עצור', rew: 'אחורה', ff: 'קדימה',
};

/** Which glyph draws a key (a name of ICON below); digits and colours are drawn by their own controls. */
export const KEY_GLYPH: Partial<Record<KeyId, string>> = {
  up: 'up', down: 'down', left: 'left', right: 'right', back: 'back', home: 'home', menu: 'menu', exit: 'exit', info: 'info', guide: 'guide',
  source: 'input', tools: 'tools', settings: 'settings', chlist: 'list', prech: 'history', volup: 'plus', voldown: 'minus', mute: 'volOff',
  chup: 'up', chdown: 'down', play: 'play', pause: 'pause', stop: 'stop', rew: 'rew', ff: 'ff',
};

/** The keys the "מקשים נוספים" section may draw as quiet buttons (the rest have a place of their own). */
export const XTRA_KEYS: KeyId[] = ['exit', 'tools', 'settings', 'info', 'guide', 'source', 'chlist', 'prech'];
/** Drawn in the top cluster / channel rocker / number pad instead of the extra list. */
export const XTRA_SPOKEN_ELSEWHERE: KeyId[] = ['guide', 'source', 'chlist'];

export const NUM_KEYS: KeyId[] = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'prech', 'n0', 'info'];
export const COLOR_KEYS: KeyId[] = ['red', 'green', 'yellow', 'blue'];

/** The remote's sections, in the words of the editor (SECTION_LABEL of the client has the same; these are the short forms). */
export const SECTION_SHORT: Record<RemoteSection, string> = {
  recent: 'אחרונים', nav: 'חזרה · בית · תפריט', dpad: 'חצים ואישור', touch: 'משטח מגע', vol: 'עוצמה', ch: 'ערוצים', pbk: 'ניגון',
  nums: 'מספרים', colors: 'מקשי צבע', text: 'הקלדה', xtra: 'מקשים נוספים',
};

/**
 * The glyph set: 24x24 strokes, round caps, the same hand as sw-icon. The values are the inside of an <svg> and are
 * constants of this file only (rendered through unsafeSVG) - never built from data.
 */
export const ICON: Record<string, string> = {
  power: '<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>',
  vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  guide: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>',
  tools: '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  input: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/>',
  exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  hdmi: '<path d="M3 8h18v5l-3 3H6l-3-3z"/><path d="M7 11h10"/>',
  antenna: '<path d="M8 3l4 5 4-5"/><rect x="3" y="8" width="18" height="12" rx="2"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  rew: '<path d="M11 6 3 12l8 6zM21 6l-8 6 8 6z"/>',
  ff: '<path d="m13 6 8 6-8 6zM3 6l8 6-8 6z"/>',
  prev: '<path d="M6 5v14M18 5 9 12l9 7z"/>',
  next: '<path d="M18 5v14M6 5l9 7-9 7z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 0 1 6.2-.6M5 12.5a10 10 0 0 1 4-2.3M16.5 10.5a10 10 0 0 1 2.5 2M2 9a15 15 0 0 1 5-3M11 5.1A15 15 0 0 1 22 9"/><path d="M12 19.5h.01"/>',
  touch: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.9-2.6L4 14.5a1.5 1.5 0 0 1 2.4-1.8L9 15"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  playRect: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M21 10.5 16 10M17.5 19.5l-3-5M6.5 19.5l3-5M3 10.5l5-.5"/>',
  news: '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 11.5h.01M17.5 13.5h.01"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
  frame: '<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="6.5" y="6.5" width="11" height="11"/><path d="m6.5 15 3.5-3.5 3 3 2-2 2.5 2.5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  send: '<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m21 3-11 10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.9M6.5 7.6A16.8 16.8 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.5-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.2"/>',
  warning: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>',
  tv: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  speaker: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="14" r="3"/><path d="M12 7h.01"/>',
  remote: '<rect x="7.5" y="2.5" width="9" height="19" rx="4.5"/><circle cx="12" cy="7.5" r="1.7"/><path d="M10.3 12.5h3.4M10.3 15.5h3.4M10.3 18.5h3.4"/>',
  app: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6"/>',
};

/** The glyph of a source / app / now-playing item (the client's `Glyph`); an unknown name falls back to the neutral app tile. */
export function glyphPath(g: Glyph | string | null | undefined): string {
  return ICON[g ?? 'app'] ?? ICON.app;
}

/** The two tint stops of a glyph tile for our hue (0-359), or the neutral tile colours for none. Our hues, never a brand's. */
export function tint(hue: number | null | undefined): { a1: string; a2: string; rgb: string } {
  if (hue === null || hue === undefined || !Number.isFinite(hue)) return { a1: '#3f4a5c', a2: '#6b7788', rgb: '107 119 136' };
  const h = ((Math.round(hue) % 360) + 360) % 360;
  return { a1: `hsl(${h} 58% 26%)`, a2: `hsl(${h} 70% 56%)`, rgb: hslTriplet(h, 70, 56) };
}

/** "r g b" of an HSL colour (for the `rgb(var(--art) / a)` glow the remote and the cards use). */
export function hslTriplet(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)).join(' ');
}
