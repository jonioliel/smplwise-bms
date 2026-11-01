/**
 * CR-NOTICE106: the feed of the lobby board exactly as the approved mock-up draws it (docs/design/mockups/notice-106/tv.html, board
 * `lobby`): the urgent notice, the six notices with their window wording, the weather, the building chips and the news line. The
 * pixel check renders the product page with this feed and the mock-up with the same switches, and compares the two.
 */
import type { Page, Route } from '@playwright/test';
import type { Display, Feed, FeedNotice } from '../src/notice-tv/tv-logic';

export const TOKEN = 'k9Qw2Lr7Vt3pXa8MbN4cHd6FeJ1sYz0uRiGo5wTqBv';

const n = (id: string, severity: FeedNotice['severity'], title: string, body: string, when: string, extra: Partial<FeedNotice> = {}): FeedNotice => ({
  id, severity, title, body, when, starts_at: '2026-10-20T06:00:00Z', ends_at: '2026-11-20T06:00:00Z', pinned: severity === 'critical', published_at: null, ...extra,
});

export const LOBBY_NOTICES: FeedNotice[] = [
  n('u1', 'critical', 'הפסקת מים מחר 10:00–12:00', 'עקב עבודות תאגיד המים ברחוב.\nמומלץ למלא מים מראש.', 'עד מחר 12:00'),
  n('n1', 'alert', 'טיפול במעלית הצפונית ביום שלישי', 'המעלית הצפונית תושבת בין 08:00 ל-14:00.\nהמעלית הדרומית פועלת כרגיל.', 'יום שלישי 27.10 · 08:00–14:00'),
  n('n2', 'info', 'ניקוי חלונות חיצוני', 'צוות סנפלינג יעבוד על חזית הבניין בין 2 ל-5 בנובמבר. נא לסגור תריסים בשעות העבודה.', '02.11 – 05.11', { dwell_s: 24 }),
  n('n3', 'info', 'שעות קבלת קהל במשרד הניהול', 'ימים א-ה 08:30–16:00.\nבימי שישי בתיאום מראש בלבד.', 'קבוע'),
  n('n4', 'info', 'אסיפת דיירים שנתית', 'יום רביעי 11.11 בשעה 19:30 בחדר הדיירים. על סדר היום: תקציב 2027 ושיפוץ הלובי.', '11.11 · 19:30'),
  n('n5', 'info', 'חניית אורחים', 'חניית האורחים ברמה 1- מוגבלת ל-3 שעות. רישום בעמדת השומר.', 'קבוע'),
  n('n6', 'info', 'איסוף גזם וגרוטאות', 'העירייה אוספת גזם ביום שני. נא להניח ליד הכניסה הדרומית עד 07:00.', 'יום שני 26.10'),
];

export function display(p: Partial<Display> = {}): Display {
  const base: Display = {
    template: 1, lang: 'he', theme: 'day', day_hours: '', layout: 'auto', urgent: 'stage', mode: 'rotation', rotate_s: 12, hold: '', font_size: 's', font_scale: 1, place: 'הכניסה הראשית',
    blocks: { clock: true, hebdate: false, welcome: true, weather: true, info: ['elevators', 'generator', 'parking'], promo: false, news: true, company_logo: true },
    weather: { hours: 5 }, news: { feeds: [{ name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml' }], speed: 'normal' },
    night: { enabled: true, from: '23:00', to: '06:00', dim: 0.5 }, burn_in: { shift: true },
  };
  return { ...base, ...p, blocks: { ...base.blocks, ...(p.blocks ?? {}) } };
}

export function lobbyFeed(p: Partial<Display> = {}, notices: FeedNotice[] = LOBBY_NOTICES, extra: Partial<Feed> = {}): Feed {
  return {
    board: { name: 'לוח הלובי', slug: 'lobby', version: 17, display: display(p), building: 'מגדל הים', tz: 'Asia/Jerusalem', logos: {} },
    now: '2026-10-23T06:12:00Z',
    // a copy: a spec that replaces an entry (evidence-brand-tv's take-over) must not change LOBBY_NOTICES for the next spec of the worker
    notices: notices.slice(),
    weather: { now: { t: 24, condition: 'sun', text: 'בהיר · רוח קלה מערבית' }, hours: [{ at: '12:00', t: 26, condition: 'sun' }, { at: '14:00', t: 27, condition: 'cloudsun' }, { at: '16:00', t: 25, condition: 'cloudsun' }, { at: '18:00', t: 22, condition: 'cloud' }, { at: '20:00', t: 20, condition: 'moon' }] },
    info: [{ kind: 'elevator', label: 'מעלית צפונית', text: 'פועלת', state: 'ok' }, { kind: 'elevator', label: 'מעלית דרומית', text: 'בטיפול', state: 'warn' }, { kind: 'generator', label: 'גנרטור', text: 'מוכן', state: 'ok' }, { kind: 'parking', label: 'חניה', text: '42 פנויות', state: 'ok' }],
    news: [{ source: 'ynet', title: 'התחממות קלה צפויה לקראת סוף השבוע' }, { source: 'גלובס', title: 'שינויים בקווי האוטובוס במרכז העיר החל מיום ראשון' }, { source: 'ynet', title: 'מדד המחירים לחודש ספטמבר פורסם הבוקר' }, { source: 'גלובס', title: 'רשות החשמל מעדכנת את תעריפי הלילה' }],
    sun: { rise: '06:15', set: '17:12', candles: '17:24' },
    ...extra,
  };
}

/** Serve one feed (or a status) for the board; returns the list of token headers the page sent. */
export async function serveFeed(page: Page, feed: Feed | number, slug = 'lobby'): Promise<string[]> {
  const tokens: string[] = [];
  await page.route(`**/api/v1/notices/display/${slug}`, async (route: Route) => {
    tokens.push(route.request().headers()['x-board-token'] ?? '');
    if (typeof feed === 'number') await route.fulfill({ status: feed, contentType: 'application/json', body: '{"code":"not_found"}' });
    else await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"${feed.board.version}"` }, body: JSON.stringify(feed) });
  });
  return tokens;
}

export function tvUrl(q = '', slug = 'lobby', token = TOKEN): string {
  return `notice-tv.html?board=${slug}&clock=fixed${q ? '&' + q : ''}#t=${token}`;
}

/** Wait until the page drew its canvas with Heebo loaded and the shrink-to-fit pass ran. */
export async function settled(page: Page): Promise<void> {
  await page.waitForSelector('#cv[data-tpl] .pg .hd');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(1200); // the 1 s item fade of the stage
}

/**
 * The lobby styles (hi-tech / luxury, LOBBY-STYLES-2300): wait until a turn of the rotation has really settled instead of sleeping a
 * fixed time (a busy gate machine runs the transitions late): the shown title is not `prev`, only one notice is left on the stage (the
 * old one has left and been removed), and no finite animation is still running on the stage or the urgent layer (the ambient loops are
 * endless and do not count). Returns the shown title (the urgent layer's while it holds the screen).
 */
export async function lobbyTurn(page: Page, prev: string, timeout = 15_000): Promise<string> {
  const h = await page.waitForFunction((p) => {
    const nb = document.getElementById('nbk');
    if (!nb) return null;
    const tk = nb.dataset.take === '1' ? nb.querySelector('.nb-take .nb-ttl') : null;
    const msgs = nb.querySelectorAll('.nb-st > .nb-msg:not(.nb-prep):not(.nb-ghost)');
    const t = ((tk ?? msgs[msgs.length - 1]?.querySelector('.nb-ttl')) as HTMLElement | null | undefined)?.textContent?.trim() ?? '';
    if (!t || t === p) return null;
    if (msgs.length > 1 || nb.querySelector('.nb-st > .nb-msg[data-leaving]')) return null;
    const busy = document.getAnimations().some((a) => {
      const tg = (a.effect as KeyframeEffect | null)?.target as Element | null | undefined;
      return !!tg && !!tg.closest('#nbk .nb-st, #nbk .nb-take') && a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity;
    });
    return busy ? null : t;
  }, prev, { timeout, polling: 100 });
  return (await h.jsonValue()) as string;
}
