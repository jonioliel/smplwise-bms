import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCESS_CARDS,
  ACCESS_LAYOUT_DEFAULT,
  ACCESS_LAYOUT_KEY,
  ACCESS_LAYOUTS,
  FOLD_SUMMARY_EVENT,
  OPEN_CARD_STORE,
  VOICE_CARDS,
  VOICE_TAB,
  announceSummary,
  areaSummary,
  callsSummary,
  checklistSummary,
  displaySummary,
  emitFoldSummary,
  loadOpenCard,
  openCardKey,
  parseAccessLayout,
  parseCard,
  pickOpenCard,
  saveOpenCard,
  screensSummary,
  tabOfCard,
  toggleCard,
  withUnsaved,
  type FoldSummaryDetail,
} from '../src/access-control/settings-cards-logic';
import { enSettingsCardsText, heSettingsCardsText } from '../src/i18n/settings-cards';
import { SETTINGS_GROUPS, activeEntry } from '../src/screens/system-index';
import { parseRoute } from '../src/router';

// SETTINGS-INTERCOM-CARDS-2401 (owner 04.11, round 19 Q6 = a): the layout setting of Settings › "מתגי מסכי כניסה" (cards / two tabs / one
// list), which card is open, the per-user memory of the last open card, the one-line summaries, and the wiring that keeps every existing
// control and data attribute. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-settings-intercom-cards-2401.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** A Storage stand-in (Map backed); `broken` throws like a browser with blocked site data. */
function memoryStorage(broken = false) {
  const m = new Map<string, string>();
  return {
    m,
    getItem(k: string) {
      if (broken) throw new Error('SecurityError');
      return m.has(k) ? m.get(k)! : null;
    },
    setItem(k: string, v: string) {
      if (broken) throw new Error('SecurityError');
      m.set(k, v);
    },
  };
}

test.describe('the layout setting', () => {
  test('cards is the default; only cards / tabs / list are read, anything else is the default', () => {
    expect(ACCESS_LAYOUT_KEY).toBe('access.settings_layout');
    expect(ACCESS_LAYOUT_DEFAULT).toBe('cards');
    expect([...ACCESS_LAYOUTS]).toEqual(['cards', 'accordion', 'tabs', 'list']); // + accordion: SETTINGS-CARDS-ACCORDION-2402
    for (const l of ACCESS_LAYOUTS) expect(parseAccessLayout(l)).toBe(l);
    for (const bad of [undefined, null, '', 'a', 'b', 'c', 'Cards', 'grid', 1, {}]) expect(parseAccessLayout(bad)).toBe('cards');
  });

  test('the server validates the same three values and defaults to cards', () => {
    const py = fs.readFileSync(path.join(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'routers', 'settings.py'), 'utf8');
    expect(py).toContain('"access.settings_layout": "cards",');
    expect(py).toContain('pattern="^(cards|accordion|tabs|list)$", alias="access.settings_layout"');
    expect(py).toContain('if out.get("access.settings_layout") not in ("cards", "accordion", "tabs", "list"):');
  });

  test('the layout row: short plain Hebrew labels, one per layout, in both languages', () => {
    expect(heSettingsCardsText.layout.label).toBe('סידור הלשונית');
    expect([heSettingsCardsText.layout.cards, heSettingsCardsText.layout.accordion, heSettingsCardsText.layout.tabs, heSettingsCardsText.layout.list]).toEqual(['כרטיסים: כותרות בצד', 'כרטיסים: נפתחים במקום', 'שתי לשוניות', 'רשימה אחת']);
    for (const l of ACCESS_LAYOUTS) {
      expect(heSettingsCardsText.layout[l].length).toBeLessThanOrEqual(24); // "כרטיסים: נפתחים במקום" (2402) is 21
      expect(enSettingsCardsText.layout[l].length).toBeGreaterThan(0);
    }
    expect(heSettingsCardsText.voiceTab).toBe('הכרזות וקול');
  });
});

test.describe('the cards', () => {
  test('ten cards in the tab order; layout b puts the announcements and the call banner on "הכרזות וקול"', () => {
    expect([...ACCESS_CARDS]).toEqual(['screens', 'area', 'display', 'announce', 'calls', 'parity', 'checklist', 'pairing', 'diagnostics', 'validation']);
    expect([...VOICE_CARDS]).toEqual(['announce', 'calls']);
    expect(VOICE_TAB).toBe('access-voice');
    for (const c of ACCESS_CARDS) expect(tabOfCard(c)).toBe(VOICE_CARDS.includes(c) ? 'access-voice' : 'access-control');
    for (const c of ACCESS_CARDS) {
      expect(heSettingsCardsText.title[c].length).toBeGreaterThan(0);
      expect(enSettingsCardsText.title[c].length).toBeGreaterThan(0);
    }
  });

  test('a card id from the address or the memory: only a known id', () => {
    for (const c of ACCESS_CARDS) expect(parseCard(c)).toBe(c);
    for (const bad of [null, undefined, '', 'SCREENS', 'voice', 'access-voice', 3]) expect(parseCard(bad)).toBeNull();
  });

  test('which card is open: the choice when drawn, else the first; all closed only on a narrow list', () => {
    const present = ['screens', 'area', 'display', 'announce'] as const;
    expect(pickOpenCard('display', present, true)).toBe('display');
    expect(pickOpenCard('display', present, false)).toBe('display');
    expect(pickOpenCard('pairing', present, true)).toBe('screens'); // a card this viewer does not get
    expect(pickOpenCard(null, present, true)).toBe('screens');
    expect(pickOpenCard(undefined, present, false)).toBe('screens');
    expect(pickOpenCard('nonsense', present, false)).toBe('screens');
    expect(pickOpenCard('', present, false)).toBe('');
    expect(pickOpenCard('', present, true)).toBe('screens'); // beside the headers there is always one card
    expect(pickOpenCard('screens', [], true)).toBe('');
  });

  test('a press: opens the card (closing the other); the open one folds on a narrow list and stays on a wide one', () => {
    expect(toggleCard('screens', 'display', true)).toBe('display');
    expect(toggleCard('screens', 'display', false)).toBe('display');
    expect(toggleCard('', 'area', false)).toBe('area');
    expect(toggleCard('display', 'display', false)).toBe('');
    expect(toggleCard('display', 'display', true)).toBe('display');
  });

  test('the last open card is remembered per user, and a browser without storage simply does not remember', () => {
    const s = memoryStorage();
    expect(openCardKey('u1')).toBe(`${OPEN_CARD_STORE}.u1`);
    expect(openCardKey(null)).toBe(`${OPEN_CARD_STORE}.local`);
    expect(loadOpenCard(s, 'u1')).toBeNull();
    saveOpenCard(s, 'u1', 'announce');
    saveOpenCard(s, 'u2', 'pairing');
    expect(loadOpenCard(s, 'u1')).toBe('announce');
    expect(loadOpenCard(s, 'u2')).toBe('pairing');
    saveOpenCard(s, 'u1', '');
    expect(loadOpenCard(s, 'u1')).toBe('');
    s.m.set(openCardKey('u3'), 'garbage');
    expect(loadOpenCard(s, 'u3')).toBeNull();
    const broken = memoryStorage(true);
    expect(() => saveOpenCard(broken, 'u1', 'display')).not.toThrow();
    expect(loadOpenCard(broken, 'u1')).toBeNull();
    expect(loadOpenCard(null, 'u1')).toBeNull();
  });
});

test.describe('the summary lines', () => {
  test('the screens: all embedded, all Arx, or which are Arx', () => {
    const s = (o: boolean, e: boolean) => [
      { label: 'מרכז הכניסה', choice: o ? ('smplwise' as const) : ('wiskey' as const) },
      { label: 'פעילות', choice: e ? ('smplwise' as const) : ('wiskey' as const) },
    ];
    expect(screensSummary(s(false, false))).toBe('כל המסכים: WisKey מוטמע');
    expect(screensSummary(s(true, true))).toBe('כל המסכים: Arx');
    expect(screensSummary(s(false, true))).toBe('Arx: פעילות · השאר WisKey מוטמע');
  });

  test('the area, the display, the announcements, the call banner and the checklist', () => {
    expect(areaSummary(false, false, 'cards')).toBe('האזור מוצג · הטמעה בטלפון: כבויה · כרטיסים: כותרות בצד');
    expect(areaSummary(true, true, 'list')).toBe('האזור מוסתר לכולם · הטמעה בטלפון: מופעלת · רשימה אחת');
    expect(displaySummary('כל מי שרואה את התחנה', 'מוצג', 'כבוי')).toBe('רמז שיחה: כל מי שרואה את התחנה · דיבור: מוצג · וידאו: כבוי');
    expect(announceSummary('תחנה אחת בכל פעם', '', 0)).toBe('תחנה אחת בכל פעם · מנוע: ברירת המחדל · משפטים מובנים');
    expect(announceSummary('תחנה, מקום או כל התחנות', 'Piper', 3)).toBe('תחנה, מקום או כל התחנות · מנוע: Piper · 3 משפטים');
    expect(callsSummary('off', 0, 0, true)).toBe('כבוי');
    expect(callsSummary('everyone', 0, 0, true)).toBe('לכל מי שרשאי לענות · כל העמדות · עם צלצול');
    expect(callsSummary('roles', 2, 1, false)).toBe('לתפקידים נבחרים (2) · 1 עמדות · בלי צלצול');
    expect(checklistSummary(3, 10)).toBe('3 מתוך 10 נבדקו');
    expect(withUnsaved('כבוי', false)).toBe('כבוי');
    expect(withUnsaved('כבוי', true)).toBe('יש שינויים שלא נשמרו · כבוי');
  });

  test('a card component reports its summary once per change (bubbling, composed)', () => {
    const host = new EventTarget();
    const got: FoldSummaryDetail[] = [];
    host.addEventListener(FOLD_SUMMARY_EVENT, (e) => got.push((e as CustomEvent<FoldSummaryDetail>).detail));
    emitFoldSummary(host, { card: 'display', summary: 'a', present: true });
    emitFoldSummary(host, { card: 'display', summary: 'a', present: true });
    emitFoldSummary(host, { card: 'display', summary: 'b', present: true });
    emitFoldSummary(host, { card: 'display', summary: 'b', present: false });
    expect(got.map((d) => `${d.summary}/${d.present}`)).toEqual(['a/true', 'b/true', 'b/false']);
  });
});

test.describe('wiring (source)', () => {
  const diag = read('screens/system-diagnostics.ts');

  test('every existing control and data attribute of the tab is still drawn, in every layout', () => {
    for (const hook of ['data-set-hide-wiskey', 'data-set-access-ui=', 'data-set-phone-embed', 'data-access-ui-fixed', 'data-access-ui-embed-api', 'data-access-ui-warning', "'data-save-access-ui'"]) {
      expect(diag, hook).toContain(hook);
    }
    // layout c keeps the one card with every row and the 2.40.0 components; layout b splits the display card; layout a draws them as cards
    expect(diag).toContain('<system-access-display></system-access-display><system-call-banner></system-call-banner>');
    expect(diag).toContain('<system-access-display show="display"></system-access-display>');
    expect(diag).toContain('<system-access-display show="announce"></system-access-display>');
    for (const tag of ['system-access-display show="display" bare', 'system-access-display show="announce" bare', 'system-call-banner bare', 'system-access-parity show="report" bare', 'system-access-parity show="checklist" bare', 'system-wiskey-pairing bare', 'system-wiskey-diagnostics bare', 'system-wiskey-validation-card bare']) {
      expect(diag, tag).toContain(`<${tag}>`);
    }
    expect(diag).toContain('data-set-access-layout');
    expect(diag).toContain("saveOpenCard(browserStorage(), session.me?.user.id, next)");
  });

  test('the cards: the components draw no heading of their own inside a card and report their summary', () => {
    for (const f of ['system-access-display.ts', 'system-call-banner.ts', 'system-access-parity.ts', 'system-wiskey-pairing.ts', 'system-wiskey-diagnostics.ts', 'system-wiskey-validation-card.ts']) {
      const src = read(`screens/${f}`);
      expect(src, f).toContain('@property({ type: Boolean, reflect: true }) bare = false;');
      expect(src, f).toContain('emitFoldSummary(this,');
    }
    // the TTS rows (TTS-DEFAULT-ENGINE-2400) keep their hooks in the announcements half
    const display = read('screens/system-access-display.ts');
    for (const hook of ['data-access-display-tts-engine', 'data-access-display-tts-language', 'data-save-access-display', 'data-access-display="ready"', 'data-access-display-media', 'data-access-display-source']) {
      expect(display, hook).toContain(hook);
    }
  });

  test('the list component: headers are 44 px targets, one open card, the wide arrangement by the list width', () => {
    const fold = read('components/sw-fold-cards.ts');
    expect(fold).toContain('min-block-size: 44px;');
    expect(fold).toContain('aria-expanded=${String(c.id === this.open)}');
    expect(fold).toContain('export const FOLD_WIDE_MIN = 820;');
    expect(fold).toContain('container-type: inline-size;');
    expect(fold).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('the settings column keeps its rows (owner decision 402): no entry for "הכרזות וקול", the search words lead to the tab', () => {
    const idx = read('screens/system-index.ts');
    expect(SETTINGS_GROUPS.flatMap((g) => g.entries).some((e) => e.href.includes('tab=access-voice'))).toBe(false);
    expect(idx).toContain('כרטיסים סידור הכרזות וקול מנוע הקראה');
    // layout b's second tab and a card link mark the row of the tab they belong to
    expect(activeEntry(SETTINGS_GROUPS, parseRoute('#/system/diagnostics?tab=access-voice'))?.label).toBe('מתגי מסכי כניסה');
    expect(activeEntry(SETTINGS_GROUPS, parseRoute('#/system/diagnostics?tab=access-control&card=calls'))?.label).toBe('מתגי מסכי כניסה');
  });
});
