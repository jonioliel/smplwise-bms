import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, url } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';

// WISKEY-PAIRING-2382: Settings › מתגי מסכי כניסה › "חיבור Arx ל-WisKey" against a MOCKED backend (synthetic data, no key material; nothing
// reaches WisKey, Home Assistant or a station). Every state of the block - paired, unknown (not checked yet), refused, key rotated (with the
// guided re-pair), the lab of 03.11 (accepted, but the service feed lists no W10 command) - plus the signed check, the re-pair dialog and its
// result, the local-only and permission edges, and the "מצב WisKey" rows. RTL. Evidence: docs/design/evidence/wiskey-pairing-2382 (SW_SHOTS=1).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-pairing-2382.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-pairing-2382');
const SETTINGS = '/system/diagnostics?tab=access-control';
const CARD = 'sw-app system-diagnostics system-wiskey-pairing [data-wkp-card]';
const W10 = ['media/station_descriptor', 'media/stream_lease', 'media/talk_open', 'media/talk_frame', 'media/talk_floor', 'media/talk_close'];

type Body = Record<string, unknown>;
const line = (key: string, state: string, reason: string, text: string, fix: string | null = null, facts: Body = {}) => ({
  key, label: { bridge: 'גשר Arx בתשתית המערכת', component: 'רכיב WisKey', key: 'מפתח הצימוד', acceptance: 'WisKey מקבל את המפתח', discovery: 'חוזה הגילוי (פקודות מדיה ודיבור)',
    provider: 'מקור הווידאו והדיבור', rotation: 'החלפת מפתח הגשר', last_error: 'שגיאה אחרונה' }[key], state, reason, text, fix, facts,
});
const feature = (key: string, group: string, label: string, state: string, reasons: Body[] = [], link: Body | null = null) => ({ row: 1, key, group, label, state, reasons, link });
const reason = (code: string, kind: string, text: string, fix: string) => ({ code, kind, text, fix });
const PROBE = { at: '2026-11-03T18:00:00+00:00', accepted: true, code: null, outcome: null, service_subject: true, repository: true, discovery_error: null,
  capabilities: { schema_version: 1, protocol: 'wiskey-direct-ws.v1', commands: ['direct/capabilities', 'direct/time', ...W10], families: ['direct', 'media'], talk_audio: true, stations: 10, clock: null, skew_s: 0.1 } };
const FEATURES = [
  feature('direct_api', 'חיבור', 'החיבור הישיר ל־WisKey (גילוי, זהות שירות)', 'on'),
  feature('w10_talk', 'מדיה ודיבור', 'דיבור דו־כיווני עם עמדה', 'blocked', [reason('feed_not_listed', 'WK', 'Arx בוחר ב־WisKey לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות (not_listed).', 'פריט פתוח בפיתוח.')],
    { href: '#/system/diagnostics?tab=access-control', label: 'הגדרות › מתגי מסכי כניסה' }),
  feature('door_windows', 'דלתות', 'חלונות דלת', 'off', [reason('windows_off', 'SET', 'חלונות הדלת כבויים (doors.windows.enabled).', 'חלונות דלת › הגדרות.')], { href: '#/wiskey/door-windows', label: 'חלונות דלת' }),
  feature('managed_install', 'התקנה', 'התקנה ועדכון מנוהלים של WisKey', 'blocked', [reason('policy_b', 'POL', 'מדיניות B: Arx לא מתקין ולא מנהל את WisKey, והתכונה זמינה רק בהתקנה מנוהלת.', 'ממתין להתקנה מנוהלת.')]),
];

function status(kind: 'paired' | 'unknown' | 'refused' | 'rotated' | 'lab'): Body {
  const bridge = line('bridge', 'ok', 'bridge_ok', 'הגשר מותקן (0.10.2) ומצומד; הוא שולח עדכון חתום כל דקה.');
  const component = line('component', 'ok', 'component_manual', 'WisKey 2.0.1-rc.10 · התקנה ידנית (בעל המערכת מעדכן את WisKey בעצמו).', null, { version: '2.0.1-rc.10', mode: 'manual' });
  const keyOk = line('key', 'ok', 'key_ok', 'יש מפתח צימוד והוא יכול לחתום. טביעה: 3fa1-09bc.', null, { fingerprint: '3fa1-09bc', can_sign: true });
  const accepted = line('acceptance', 'ok', 'accepted', 'WisKey קיבל את החתימה של Arx וזיהה אותו כזהות שירות.');
  const discOk = line('discovery', 'ok', 'discovery_ok', 'חוזה גילוי wiskey-direct-ws.v1 גרסה 1: 6 מתוך 6 פקודות המדיה והדיבור מפורסמות.', null,
    { listed: Object.fromEntries(W10.map((c) => [c, true])) });
  const provOk = line('provider', 'ok', 'provider_auto', 'Arx בוחר לבד: החיבור הישיר של WisKey, ואם הוא לא זמין - הנתיב החתום דרך תשתית המערכת.', null, { choice: 'auto', feed_reason: null });
  const rotOff = line('rotation', 'ok', 'rotation_off', 'החלפת מפתח הגשר כבויה; קוד הצימוד המקורי נשאר בתוקף.');
  const noErr = line('last_error', 'ok', 'no_error', 'אין שגיאה.');
  const base = { generated_at: '2026-11-03T18:00:05+00:00', owner_steps: [] as string[], features: FEATURES, repair: { available: false, reason: null, announce: false, addon_url: 'http://arx-addon.test:8099' } };
  if (kind === 'paired') return { ...base, verdict: 'paired', paired: true, talk_ready: true, probe: PROBE, lines: [bridge, component, keyOk, accepted, discOk, provOk, rotOff, noErr] };
  if (kind === 'unknown') {
    return { ...base, verdict: 'unknown', paired: null, talk_ready: false, probe: null, lines: [bridge, component, keyOk,
      line('acceptance', 'unknown', 'probe_not_run', 'עוד לא נבדק מול WisKey.', 'לחצו "בדוק חיבור חתום".'),
      line('discovery', 'unknown', 'discovery_unknown', 'חוזה הגילוי לא נקרא עדיין.', 'לחצו "בדוק חיבור חתום".'), provOk,
      line('rotation', 'warn', 'rotation_risk', 'החלפת מפתח הגשר מופעלת. החלפה תמחק את קוד הצימוד המקורי מהגשר, ו־WisKey יפסיק לקבל את Arx.', 'אל תלחצו "החלפת מפתח" בכרטיס מפתח הגשר כל עוד WisKey בשימוש.'), noErr] };
  }
  if (kind === 'refused') {
    return { ...base, verdict: 'not_paired', paired: false, talk_ready: false, probe: { ...PROBE, accepted: false, code: 'direct_connect_refused', capabilities: null },
      repair: { ...base.repair, available: true, reason: 'refused' },
      owner_steps: ['בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שיש רשומה אחת בלבד ושהיא טעונה.', 'הפעילו מחדש את תשתית המערכת.', 'חזרו לכאן ולחצו "בדיקה מול WisKey".'],
      lines: [bridge, component, keyOk, line('acceptance', 'blocked', 'refused', 'WisKey דחה את החתימה של Arx (direct_connect_refused).', 'אם הגשר שולח עדכונים: הפעילו מחדש את תשתית המערכת.'),
        line('discovery', 'unknown', 'discovery_unknown', 'חוזה הגילוי לא נקרא עדיין.', 'לחצו "בדוק חיבור חתום".'), provOk, rotOff,
        line('last_error', 'warn', 'error', 'WisKey סגר את החיבור בלי תשובה - החתימה לא אומתה אצלו.', 'ראו את השורה שמסומנת באדום למעלה.')] };
  }
  if (kind === 'rotated') {
    return { ...base, verdict: 'not_paired', paired: false, talk_ready: false, probe: null, repair: { ...base.repair, available: true, reason: 'key_rotated' },
      lines: [bridge, component, line('key', 'blocked', 'key_rotated', 'מפתח הגשר הוחלף (החלפת מפתח). WisKey מקבל רק את קוד הצימוד המקורי, ולכן Arx לא חותם אליו יותר.',
        'לחצו "צימוד מחדש" למטה (מנהל מערכת).', { kid: 'g1-aaaaaaaa', can_sign: false }),
      line('acceptance', 'unknown', 'probe_not_run', 'עוד לא נבדק מול WisKey.', 'לחצו "בדוק חיבור חתום".'), line('discovery', 'unknown', 'discovery_unknown', 'חוזה הגילוי לא נקרא עדיין.', 'לחצו "בדוק חיבור חתום".'),
      provOk, line('rotation', 'warn', 'rotation_done', 'מפתח הגשר כבר הוחלף; זה מה שמנתק את WisKey.', 'צימוד מחדש (למטה) מחזיר קוד צימוד מקורי.'), noErr] };
  }
  // the lab of 03.11: the signed path is fine, the service feed lists no W10 command - talk stays on Arx's own source
  return { ...base, verdict: 'paired', paired: true, talk_ready: false, probe: PROBE, lines: [bridge, component, keyOk, accepted, discOk,
    line('provider', 'blocked', 'provider_feed_gate', 'מקור הווידאו והדיבור מוגדר "WisKey (וידאו ודיבור)", אבל Arx בוחר ב־WisKey רק לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות (not_listed).',
      'זה לא תלוי בצימוד: נדרש עדכון. פריט פתוח בפיתוח, לא פעולה של בעל המערכת.', { choice: 'auto', feed_reason: 'not_listed', readiness: ['talk_not_listed', 'video_not_listed'], row: { href: '#/system/diagnostics?tab=access-control', label: 'מקור הווידאו והדיבור' } }), rotOff, noErr] };
}

type Call = { method: string; path: string; body: unknown };

async function boot(page: Page, body: Body | ((call: Call) => [number, Body]), opts: { persona?: 'admin' | 'siteAdmin' } = {}): Promise<Call[]> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = await installAccessMock(page, { persona: opts.persona ?? 'admin' });
  await installParityMock(page, mock, 'ready');
  const calls: Call[] = [];
  await page.route('**/api/v1/system/wiskey-pairing**', async (route: Route) => {
    const req = route.request();
    const call = { method: req.method(), path: new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, ''), body: req.method() === 'GET' ? null : req.postDataJSON() };
    calls.push(call);
    const [status, reply] = typeof body === 'function' ? body(call) : [200, body];
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  await page.goto('about:blank');
  await page.goto(url(SETTINGS));
  await page.waitForSelector('sw-app');
  return calls;
}

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.locator(CARD).screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`) });
}

const card = (page: Page) => page.locator(CARD);
const lineOf = (page: Page, key: string) => page.locator(`${CARD} [data-wkp-line="${key}"]`);

test.describe('WISKEY-PAIRING-2382: the Arx <-> WisKey pairing block', () => {
  test.beforeEach(({}, info) => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
  });

  for (const kind of ['paired', 'unknown', 'refused', 'rotated', 'lab'] as const) {
    test(`state: ${kind}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await boot(page, status(kind));
      await expect(card(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${CARD} [data-wkp-line]`)).toHaveCount(8);
      await expect(card(page)).not.toContainText('undefined');
      await expect(card(page)).not.toContainText('Home Assistant');
      const verdict = page.locator(`${CARD} [data-wkp-verdict]`);
      await expect(verdict).toHaveAttribute('data-wkp-verdict', kind === 'paired' || kind === 'lab' ? 'paired' : kind === 'unknown' ? 'unknown' : 'not_paired');
      // every line that is not ok carries its "how to fix"; an ok line none
      for (const l of await page.locator(`${CARD} [data-wkp-line]`).all()) {
        const st = await l.getAttribute('data-state');
        await expect(l.locator('[data-wkp-fix]')).toHaveCount(st === 'ok' ? 0 : 1);
      }
      expect(await page.locator(CARD).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      if (kind === 'rotated' || kind === 'refused') await expect(page.locator(`${CARD} [data-wkp-repair-open]`)).toBeVisible();
      else await expect(page.locator(`${CARD} [data-wkp-repair]`)).toHaveCount(0);
      if (kind === 'refused') await expect(page.locator(`${CARD} [data-wkp-steps] li`)).toHaveCount(3);
      if (kind === 'lab') {
        await expect(lineOf(page, 'provider')).toHaveAttribute('data-state', 'blocked');
        await expect(lineOf(page, 'provider').locator('[data-wkp-provider]')).toContainText('not_listed');
        await expect(lineOf(page, 'provider').locator('[data-wkp-provider-choice="auto"]')).toHaveText('WisKey (וידאו ודיבור)');
        await expect(lineOf(page, 'provider').locator('[data-wkp-readiness]')).toHaveCount(2);
        await expect(lineOf(page, 'provider').locator('a[data-wkp-provider-link]')).toHaveText('לשורה "מקור הווידאו והדיבור"');
        await expect(page.locator(`${CARD} [data-wkp-talk]`)).toContainText('לא מוכן');
      }
      if (kind === 'paired') await expect(lineOf(page, 'discovery').locator('[data-wkp-listed] .chip.on')).toHaveCount(6);
      await shot(page, info, kind);
      expect(errors).toEqual([]);
    });
  }

  test('the signed check posts once and shows the new answer', async ({ page }) => {
    const calls = await boot(page, (c) => [200, c.method === 'POST' ? status('paired') : status('unknown')]);
    await expect(lineOf(page, 'acceptance')).toHaveAttribute('data-state', 'unknown', { timeout: 30_000 });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0); // opening the block sends nothing to WisKey
    await page.locator(`${CARD} sw-button[data-wkp-probe]`).click();
    await expect(lineOf(page, 'acceptance')).toHaveAttribute('data-state', 'ok');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual(['system/wiskey-pairing/probe']);
  });

  test('the re-pair asks first, sends confirm + the rotation choice, and shows the code and the steps', async ({ page }, info) => {
    const done = { announced: false, rotation_paused: true, pairing_code: 'synthetic-new-pairing-code-0001', addon_url: 'http://arx-addon.test:8099', paired_at: null,
      steps: ['בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › שלוש הנקודות › מחיקה.', 'הוספת אינטגרציה › SMPLWISE Bridge.', 'כתובת: http://arx-addon.test:8099 · קוד הצימוד: הקוד שמוצג כאן.', 'חזרו לכאן ולחצו "בדיקה מול WisKey".'],
      status: status('unknown') };
    const calls = await boot(page, (c) => [200, c.path.endsWith('/repair') ? done : status('rotated')]);
    await page.locator(`${CARD} sw-button[data-wkp-repair-open]`).click({ timeout: 30_000 });
    const dlg = page.locator(`${CARD} sw-dialog[data-wkp-confirm]`);
    await expect(dlg).toHaveAttribute('open', '');
    await expect(dlg.locator('sw-button[data-wkp-confirm-ok]')).toBeVisible();
    await expect(dlg.locator('input[data-wkp-pause]')).toBeChecked();
    await shot(page, info, 'repair-confirm');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    await dlg.locator('sw-button[data-wkp-confirm-ok]').click();
    await expect(page.locator(`${CARD} [data-wkp-code]`)).toHaveText('synthetic-new-pairing-code-0001');
    await expect(page.locator(`${CARD} [data-wkp-repair-steps] li`)).toHaveCount(4);
    expect(calls.filter((c) => c.method === 'POST')).toEqual([{ method: 'POST', path: 'system/wiskey-pairing/repair', body: { confirm: true, pause_rotation: true } }]);
    await shot(page, info, 'repair-done');
  });

  test('a refusal from the server is shown, not swallowed', async ({ page }) => {
    await boot(page, (c) => (c.method === 'POST' ? [403, { code: 'not_system_admin', user_message: 'רק מנהל מערכת יכול לבדוק את החיבור החתום ל־WisKey.', retryable: false, correlation_id: 'mock', details: {} }] : [200, status('unknown')]));
    await page.locator(`${CARD} sw-button[data-wkp-probe]`).click({ timeout: 30_000 });
    await expect(page.locator(`${CARD} [role="alert"]`)).toContainText('רק מנהל מערכת');
  });

  test('"מצב WisKey" lists each built feature with its reasons, kind and link', async ({ page }, info) => {
    await boot(page, status('lab'));
    const feats = page.locator(`${CARD} [data-wkp-features]`);
    await expect(feats).toBeVisible({ timeout: 30_000 });
    await expect(feats.locator('[data-wkp-feature]')).toHaveCount(FEATURES.length);
    await expect(feats).toContainText('1 פעילות · 1 כבויות · 2 חסומות');
    const talk = feats.locator('[data-wkp-feature="w10_talk"]');
    await expect(talk).toHaveAttribute('data-state', 'blocked');
    await expect(talk.locator('[data-wkp-reason="feed_not_listed"]')).toContainText('צד WisKey');
    await expect(talk.locator('a[data-wkp-link]')).toHaveAttribute('href', '#/system/diagnostics?tab=access-control');
    await expect(feats.locator('[data-wkp-feature="direct_api"] [data-wkp-reason]')).toHaveCount(0);
    await shot(page, info, 'features');
    await feats.locator('sw-button[data-wkp-features-toggle]').click();
    await expect(feats.locator('[data-wkp-feature]')).toHaveCount(0);
  });

  test('without system.configure the block is not shown and nothing is asked', async ({ page }) => {
    const calls = await boot(page, status('paired'), { persona: 'siteAdmin' });
    await page.waitForTimeout(1500);
    await expect(page.locator('sw-app system-diagnostics system-wiskey-pairing [data-wkp-card]')).toHaveCount(0);
    expect(calls).toHaveLength(0);
  });
});
