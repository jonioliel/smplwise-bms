import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, url } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';

// WISKEY-STATUS-I18N-2520: "מצב WisKey: תכונות בנויות" (Settings › מתגי מסכי כניסה › חיבור Arx ל-WisKey) on an ENGLISH page says its rows,
// groups, reasons (R5's listen reasons among them) and links in English, from the stable reason code and the values the server sends
// (`params`); the same answer on a Hebrew page shows the server's Hebrew unchanged. MOCKED backend, synthetic data; nothing reaches
// WisKey, Home Assistant or a station. Evidence: docs/design/evidence/wiskey-status-i18n-2520 (SW_SHOTS=1).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-status-i18n-2520.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-status-i18n-2520');
const SETTINGS = '/system/diagnostics?tab=access-control';
const CARD = 'sw-app system-diagnostics system-wiskey-pairing [data-wkp-card]';
const FEATS = `${CARD} [data-wkp-features]`;
const HEB = /[֐-׿]/;
const ACCESS_TAB = { href: '#/system/diagnostics?tab=access-control', label: 'הגדרות › מתגי מסכי כניסה' };
const SETUP = { href: '#/system/setup', label: 'הגדרות › הקמה' };

type Body = Record<string, unknown>;
// the server's own sentences (services/wiskey_feature_status.py R), filled as it fills them
const reason = (code: string, kind: string, text: string, fix: string | null, params: Body = {}) => ({ code, kind, text, fix, params });
const LISTEN_UNKNOWN = reason('listen_unknown', 'PAIR', 'עוד לא ידוע אם WisKey מציע האזנה לעמדה: אין גילוי חתום (לא מהחיבור הישיר ולא מבדיקה).',
  '"בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.');
const LISTEN_OFF = reason('listen_off', 'SET', 'המתג "האזנה לעמדה" כבוי.', 'בהגדרות › מתגי מסכי כניסה: האזנה לעמדה.');
const LISTEN_REJECTED = reason('listen_offer_rejected', 'WK',
  'WisKey מציע את station_talk_audio בצורה אחרת מזו ש־Arx קורא (arx.station_talk_audio.v1, בחירה, ברירת מחדל כבויה), ולכן Arx לא משתמש בה.',
  'פריט פתוח מול WisKey; לא פעולה של בעל המערכת.');
const LISTEN_NO_DOWNLINK = reason('listen_no_downlink', 'WK',
  'הגילוי החתום האחרון של WisKey לא מציע האזנה לעמדה (station_talk_audio עם הבחירה media/talk_open.parameters.listen).',
  'עדכון WisKey לגרסה שמציעה אותה (בהתקנה ידנית - בעל המערכת), ואז "בדוק חיבור חתום".');
const JOIN_STARTING = reason('join_starting', 'RUN', 'החיבור הישיר מתחבר כעת.', 'אין צורך בהפעלה מחדש: רעננו את הדף בעוד רגע.', { what: 'מתחבר', state: 'connecting' });
const DOORS = reason('doors_unmapped', 'OWN', '3 דלתות של WisKey לא משויכות לממסר בעמדה, ופתיחה שלהן נדחית.',
  'הגדרות › הקמה › שיוך דלתות: אשרו את ההצעות או שייכו ידנית.', { count: 3 });
const MISSING = reason('direct_no_media', 'WK', 'בגילוי החתום (direct/capabilities) חסרות פקודות מדיה: media/talk_open, media/talk_close.',
  'עדכון WisKey לגרסה שמפרסמת אותן (בהתקנה ידנית - בעל המערכת).', { missing: 'media/talk_open, media/talk_close' });
const CHECK_FAILED = { code: 'check_failed', kind: 'RUN', text: 'לא ניתן לבדוק כרגע (KeyError).', fix: null, params: { error: 'KeyError' } };

const feature = (row: number, key: string, group: string, label: string, state: string, reasons: Body[] = [], link: Body | null = null) =>
  ({ row, key, group, label, state, reasons, link });
const FEATURES = [
  feature(92, 'direct_api', 'חיבור', 'החיבור הישיר ל־WisKey (גילוי, זהות שירות)', 'off', [JOIN_STARTING]),
  feature(55, 'w10_talk', 'מדיה ודיבור', 'דיבור דו־כיווני עם עמדה', 'blocked', [MISSING], ACCESS_TAB),
  feature(57, 'listen', 'מדיה ודיבור', 'האזנה לעמדה בלי שיחה', 'unknown', [LISTEN_OFF, LISTEN_UNKNOWN], ACCESS_TAB),
  feature(71, 'live_media_feature', 'מדיה ודיבור', 'מדיה חיה לתכונות (media ingress)', 'blocked', [LISTEN_REJECTED, LISTEN_NO_DOWNLINK]),
  feature(39, 'door_release', 'דלתות', 'פתיחת דלת מ־Arx', 'off', [DOORS], SETUP),
  feature(68, 'emergency_lock', 'דלתות', 'נעילת חירום', 'unknown', [CHECK_FAILED]),
];
const ALL_REASONS = FEATURES.flatMap((f) => f.reasons as Array<{ code: string; text: string }>);

const line = (key: string, label: string, text: string) => ({ key, label, state: 'ok', reason: `${key}_ok`, text, fix: null, facts: {} });
const STATUS = {
  generated_at: '2026-11-25T08:00:05+00:00', verdict: 'paired', paired: true, talk_ready: false, probe: null, owner_steps: [],
  repair: { available: false, reason: null, announce: false, addon_url: 'http://arx-addon.test:8099' },
  lines: [line('bridge', 'גשר Arx בתשתית המערכת', 'הגשר מותקן ומצומד.'), line('key', 'מפתח הצימוד', 'יש מפתח צימוד והוא יכול לחתום.')],
  features: FEATURES,
};

async function boot(page: Page, lang: 'he' | 'en') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = await installAccessMock(page, { persona: 'admin' });
  await installParityMock(page, mock, 'ready');
  if (lang === 'en') {
    await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* about:blank has no storage */ } });
    // registered after the mock layer so it wins
    await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
  }
  await page.route('**/api/v1/system/wiskey-pairing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATUS) }));
  await page.goto('about:blank');
  await page.goto(url(SETTINGS));
  await page.waitForSelector('sw-app');
  await expect(page.locator(FEATS)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`${FEATS} [data-wkp-feature]`)).toHaveCount(FEATURES.length);
}

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.locator(FEATS).screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`) });
}

test.describe('WISKEY-STATUS-I18N-2520: "מצב WisKey" in the page language', () => {
  test.beforeEach(({}, info) => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
  });

  test('English page: rows, groups, reasons and links in English, from the code and the server values', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, 'en');
    await page.locator('html[data-lang-words="en"]').waitFor({ state: 'attached', timeout: 30_000 });
    const feats = page.locator(FEATS);
    // every row: its label, the reason sentences, the "how to turn it on" and the link - no Hebrew letter left
    for (const f of await feats.locator('[data-wkp-feature]').all()) {
      const text = (await f.innerText()).trim();
      expect(text, `row ${await f.getAttribute('data-wkp-feature')}`).not.toMatch(HEB);
    }
    for (const h of await feats.locator('.group h5').allInnerTexts()) expect(h).not.toMatch(HEB);
    await expect(feats.locator('.group h5')).toHaveText(['Connection', 'Media and talk', 'Doors']);
    // R5's listen reasons
    const listen = feats.locator('[data-wkp-feature="listen"]');
    await expect(listen).toContainText('Listen to a station without a call');
    await expect(listen.locator('[data-wkp-reason="listen_off"]')).toContainText('The "Listen to station" switch is off.');
    await expect(listen.locator('[data-wkp-reason="listen_unknown"]')).toContainText('It is not known yet whether WisKey offers listening to a station');
    const media = feats.locator('[data-wkp-feature="live_media_feature"]');
    await expect(media.locator('[data-wkp-reason="listen_offer_rejected"]')).toContainText('in a different shape from the one Arx reads (arx.station_talk_audio.v1');
    await expect(media.locator('[data-wkp-reason="listen_no_downlink"]')).toContainText("WisKey's last signed discovery does not offer listening to a station");
    // the server's values inside the English sentence
    await expect(feats.locator('[data-wkp-reason="join_starting"]')).toContainText('The direct connection is connecting right now.');
    await expect(feats.locator('[data-wkp-reason="doors_unmapped"]')).toContainText('3 WisKey doors are not mapped to a relay on a station');
    await expect(feats.locator('[data-wkp-reason="direct_no_media"]')).toContainText('media commands: media/talk_open, media/talk_close.');
    await expect(feats.locator('[data-wkp-reason="check_failed"]')).toHaveText(/It cannot be checked right now \(KeyError\)\./);
    await expect(feats.locator('[data-wkp-reason="check_failed"] .how')).toHaveCount(0);
    await expect(listen.locator('a[data-wkp-link]')).toHaveText('Settings › Entrance screen switches');
    await expect(listen.locator('a[data-wkp-link]')).toHaveAttribute('href', ACCESS_TAB.href);
    expect(await page.locator(CARD).evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, info, 'features-en');
    expect(errors).toEqual([]);
  });

  test('Hebrew page: the same answer shows the server words unchanged', async ({ page }, info) => {
    await boot(page, 'he');
    const feats = page.locator(FEATS);
    for (const r of ALL_REASONS) await expect(feats.locator(`[data-wkp-reason="${r.code}"]`).first()).toContainText(r.text);
    await expect(feats.locator('.group h5')).toHaveText(['חיבור', 'מדיה ודיבור', 'דלתות']);
    await expect(feats.locator('[data-wkp-feature="listen"] a[data-wkp-link]')).toHaveText(ACCESS_TAB.label);
    await expect(feats.locator('[data-wkp-feature="listen"]')).toContainText('האזנה לעמדה בלי שיחה');
    expect(await page.locator(CARD).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
    await shot(page, info, 'features-he');
  });
});
