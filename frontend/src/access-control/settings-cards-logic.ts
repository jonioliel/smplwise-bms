/**
 * SETTINGS-INTERCOM-CARDS-2401 (owner 04.11, round 19 Q6 = a, "with the ability to change to b or c in Settings"): the Settings tab
 * "מתגי מסכי כניסה" grew taller than one screen (the 2.40.0 fixed announcement engine added 165 px) and scrolled, against the owner rule
 * "no scrolling in control screens". Its layout is now an installation setting (`access.settings_layout`, routers/settings.py):
 *   cards (a, default) - the tab's sections are collapsible cards; each header shows the title and a one-line summary of the current
 *                        values; ONE card is open at a time; the last open card is remembered per user in this browser;
 *   tabs  (b)          - two tabs: "מתגי מסכי כניסה" (the switches, the stations screen display and the WisKey checks) and "הכרזות וקול"
 *                        (the announcements with the fixed engine and the quick phrases, and the incoming-call banner);
 *   list  (c)          - the single long list of 2.40.0.
 * Pure functions only (no DOM), so the unit spec runs them in Node: the layout and card ids, which card is open, the remembered card and
 * the summary lines. The screen is screens/system-diagnostics.ts; the cards' own components fill in their summary through
 * `emitFoldSummary`.
 */
import { fill, sct } from '../i18n/settings-cards';

export const ACCESS_LAYOUT_KEY = 'access.settings_layout';
/** SETTINGS-CARDS-ACCORDION-2402 (owner 04.11 night, round 20 Q2 = a): `accordion` - the same cards, opened in place one at a time on a
 * desktop too (a short screen then scrolls the settings content, never sideways). One more value of the same setting, not a second
 * setting: the four layouts are one choice, so they are one select (docs/changes/SETTINGS-CARDS-ACCORDION-2402.md). */
export type AccessLayout = 'cards' | 'accordion' | 'tabs' | 'list';
export const ACCESS_LAYOUTS: readonly AccessLayout[] = ['cards', 'accordion', 'tabs', 'list'];
export const ACCESS_LAYOUT_DEFAULT: AccessLayout = 'cards';

/** The two layouts drawn as cards (`sw-fold-cards`): beside their headers (cards) or in place (accordion). */
export function isCardsLayout(layout: AccessLayout): boolean {
  return layout === 'cards' || layout === 'accordion';
}

/** The stored layout as the tab draws it: anything unknown is the default (the server does the same). */
export function parseAccessLayout(raw: unknown): AccessLayout {
  return (ACCESS_LAYOUTS as readonly unknown[]).includes(raw) ? (raw as AccessLayout) : ACCESS_LAYOUT_DEFAULT;
}

/** The cards of layout a, in the order they are drawn. */
export type AccessCardId = 'screens' | 'area' | 'display' | 'announce' | 'calls' | 'parity' | 'checklist' | 'pairing' | 'diagnostics' | 'validation';
export const ACCESS_CARDS: readonly AccessCardId[] = ['screens', 'area', 'display', 'announce', 'calls', 'parity', 'checklist', 'pairing', 'diagnostics', 'validation'];

/** Layout b: the second tab of system-diagnostics and the cards it holds; every other card stays on "מתגי מסכי כניסה". */
export const VOICE_TAB = 'access-voice';
export const ACCESS_TAB = 'access-control';
export const VOICE_CARDS: readonly AccessCardId[] = ['announce', 'calls'];

export function tabOfCard(id: AccessCardId): typeof ACCESS_TAB | typeof VOICE_TAB {
  return VOICE_CARDS.includes(id) ? VOICE_TAB : ACCESS_TAB;
}

/** A card id from an address (`?tab=access-control&card=announce`) or the browser's memory; anything else is null. */
export function parseCard(raw: unknown): AccessCardId | null {
  return typeof raw === 'string' && (ACCESS_CARDS as readonly string[]).includes(raw) ? (raw as AccessCardId) : null;
}

/**
 * The card that is open. `wanted` is the user's last choice ('' = they closed every card), `present` the cards drawn for this viewer
 * (in order). A choice that is not drawn (a card this viewer does not get) falls back to the first card. On a wide screen one card is
 * always open (the open card's content stands beside the list, an empty side would be a hole); on a narrow one the cards stack and
 * all may be closed.
 */
export function pickOpenCard(wanted: string | null | undefined, present: readonly AccessCardId[], wide: boolean): AccessCardId | '' {
  const w = parseCard(wanted);
  if (w && present.includes(w)) return w;
  if (wanted === '' && !wide) return '';
  return present[0] ?? '';
}

/** What a press on a card header does: open it; the open one closes on a narrow screen and stays open on a wide one. */
export function toggleCard(current: AccessCardId | '', pressed: AccessCardId, wide: boolean): AccessCardId | '' {
  if (current !== pressed) return pressed;
  return wide ? pressed : '';
}

/** The last open card, per user, in this browser (owner: "remember the last open card per user"). */
export const OPEN_CARD_STORE = 'sw.settings.access-cards.open';

export function openCardKey(userId: string | null | undefined): string {
  return `${OPEN_CARD_STORE}.${userId || 'local'}`;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The remembered card: null when there is none or the browser refuses (a private window, blocked site data). */
export function loadOpenCard(storage: StorageLike | null, userId: string | null | undefined): AccessCardId | '' | null {
  try {
    const raw = storage?.getItem(openCardKey(userId));
    if (raw === '') return '';
    return parseCard(raw);
  } catch {
    return null;
  }
}

export function saveOpenCard(storage: StorageLike | null, userId: string | null | undefined, id: AccessCardId | ''): void {
  try {
    storage?.setItem(openCardKey(userId), id);
  } catch {
    /* a browser that refuses storage simply does not remember */
  }
}

/** The browser's storage, or null when touching it throws. */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- the one-line summaries

export type ScreenChoice = 'wiskey' | 'smplwise';

/** "מתגי מסכי כניסה": which screens are Arx's own. `screens` in the tab's order, with their labels. */
export function screensSummary(screens: ReadonlyArray<{ label: string; choice: ScreenChoice }>): string {
  const t = sct().sum;
  const arx = screens.filter((s) => s.choice === 'smplwise').map((s) => s.label);
  if (!arx.length) return t.allWiskey;
  if (arx.length === screens.length) return t.allArx;
  return fill(t.someArx, { list: arx.join(', ') });
}

/** "אזור WisKey והטמעה": the area shown / hidden, the phone embedding and the tab's own layout. */
export function areaSummary(hidden: boolean, phoneEmbed: boolean, layout: AccessLayout): string {
  const t = sct();
  return [hidden ? t.sum.areaHidden : t.sum.areaShown, phoneEmbed ? t.sum.phoneOn : t.sum.phoneOff, t.layout[layout]].join(' · ');
}

/** "תצוגת מסך התחנות": the call hint, the talk button and the video (each as the label its select shows). */
export function displaySummary(hint: string, talk: string, media: string): string {
  const t = sct().sum;
  return [fill(t.hint, { v: hint }), fill(t.talk, { v: talk }), fill(t.media, { v: media })].join(' · ');
}

/** "הכרזות": the targets, the fixed engine ('' = the system default) and the quick phrases (0 = the built-in ones). */
export function announceSummary(scope: string, engineName: string, phrases: number): string {
  const t = sct().sum;
  return [scope, engineName ? fill(t.engine, { v: engineName }) : t.engineDefault, phrases ? fill(t.phrases, { n: phrases }) : t.phrasesBuiltIn].join(' · ');
}

/** "שיחות נכנסות מעמדות": who gets the banner, on which stations, and whether it rings. */
export function callsSummary(mode: 'off' | 'everyone' | 'roles', roles: number, stations: number, sound: boolean): string {
  const t = sct().sum;
  if (mode === 'off') return t.callsOff;
  return [mode === 'roles' ? fill(t.callsRoles, { n: roles }) : t.callsEveryone, stations ? fill(t.callsStations, { n: stations }) : t.callsStationsAll, sound ? t.callsRing : t.callsQuiet].join(' · ');
}

/** "בדיקה ידנית צד לצד": the ticked items. */
export function checklistSummary(done: number, all: number): string {
  return fill(sct().sum.checklist, { done, all });
}

/** A card with unsaved changes says so first: the summary shows the saved values, the form may differ. */
export function withUnsaved(summary: string, dirty: boolean): string {
  return dirty ? `${sct().sum.unsaved} · ${summary}` : summary;
}

// ---------------------------------------------------------------- the event a card's own component sends

/** Sent (bubbling, composed) by a card's component while it is drawn as a card of layout a: its summary line, and whether it draws
 * anything at all for this viewer (`present: false` hides the card's header too - e.g. an older server without the call banner). */
export const FOLD_SUMMARY_EVENT = 'access-fold-summary';
export interface FoldSummaryDetail {
  card: AccessCardId;
  summary: string;
  present: boolean;
}

const lastSent = new WeakMap<EventTarget, string>();

/** Dispatches the summary only when it changed (a component calls this from `updated()`). */
export function emitFoldSummary(host: EventTarget, detail: FoldSummaryDetail): void {
  const key = `${detail.card}\n${detail.present}\n${detail.summary}`;
  if (lastSent.get(host) === key) return;
  lastSent.set(host, key);
  host.dispatchEvent(new CustomEvent<FoldSummaryDetail>(FOLD_SUMMARY_EVENT, { detail, bubbles: true, composed: true }));
}
