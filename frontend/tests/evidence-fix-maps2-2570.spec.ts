import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';

// FIX-MAPS2-2570: pictures for the before / after compare page (private/planning/fix_maps2_2570_compare_2026-11-28.html) and the checks
// of the visible findings: MH2-08 (the home pager and its chevrons in English), MH2-09 (the energy tile's label at 360 px) and the
// MH2-02 dialog (a later building's request failed). Runs only when SHOTS_DIR is set (the runner job); the same file runs on the base
// build ("before", SHOTS_SIDE=before) and on the branch ("after"). The checks are expected to fail on the base build.
const OUT = process.env.SHOTS_DIR;
const SIDE = process.env.SHOTS_SIDE === 'before' ? 'before' : 'after';
test.skip(!OUT, 'evidence pictures: only with SHOTS_DIR');
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const NOW = new Date('2026-11-03T10:00:00+02:00');
const phone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 700;
const shot = async (page: Page, name: string, project: string) => {
  fs.mkdirSync(OUT!, { recursive: true });
  await page.evaluate(async () => { await document.fonts.ready; });
  await settle(page);
  await page.screenshot({ path: path.join(OUT!, `${name}_${project}.jpg`), type: 'jpeg', quality: 72, animations: 'disabled' });
};

async function openHome(page: Page, lang: 'he' | 'en', scheme: 'light' | 'dark', hash = '/#/home') {
  if (phone(page)) await page.setViewportSize({ width: 360, height: 780 }); // the width where MH2-09 showed
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
  await mockHome(page, { now: NOW.getTime() });
  const layout = { welcomed: true, theme: scheme === 'dark' ? 'midnight' : 'classic', scheme };
  await page.route('**/api/v1/home/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout, seed: {} }) }));
  await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': lang }, stored: ['ui.lang'], updated_at: null }) }));
  await page.addInitScript((l) => { try { localStorage.setItem('sw.ui.lang', l); } catch { /* about:blank */ } }, lang);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(hash);
  await page.locator('sw-home').waitFor();
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'));
  await page.waitForTimeout(800);
}

/** The pager's two numbers, left to right on the screen, and the mirror of its chevrons. */
const pagerFacts = (page: Page) => page.evaluate(() => {
  const root = document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot;
  const pg = root?.querySelector('.pager .pg');
  if (!pg) return null;
  const xs: Record<string, number> = {};
  const walker = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent ?? '';
    for (let i = 0; i < t.length; i++) {
      if (!/\d/.test(t[i]) || t[i] in xs) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 1);
      xs[t[i]] = r.getBoundingClientRect().left;
    }
  }
  const prev = root?.querySelector('.pager [data-d="-1"] svg');
  return { text: (pg.textContent ?? '').trim(), x1: xs['1'], x2: xs['2'], prevScale: prev ? getComputedStyle(prev).scale : null };
});

for (const scheme of ['light', 'dark'] as const) {
  for (const lang of ['he', 'en'] as const) {
    test(`home main ${lang} ${scheme}`, async ({ page }, info) => {
      await openHome(page, lang, scheme);
      await shot(page, `home-${lang}-${scheme}`, info.project.name);
    });
  }

  test(`site turn-off: building 2 failed ${scheme}`, async ({ page }, info) => {
    for (const lang of ['he', 'en'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.addInitScript((l) => { try { localStorage.setItem('sw.ui.lang', l); } catch { /* about:blank */ } }, lang);
      await page.route('**/api/v1/**', (route) => route.abort());
      await page.goto('about:blank');
      await page.goto(`/?design=a&mb=1${scheme === 'dark' ? '&scheme=dark' : ''}#/devices/building`);
      await page.waitForSelector('sw-app devices-building');
      await page.waitForFunction(() => !!customElements.get('home-site-off'), undefined, { timeout: 60000 });
      const he = lang === 'he';
      // the state the dialog is in after "turn off all" in buildings A, B and C when building B's request answered 409 target_changed
      // (the flow itself is driven by tests/unit-fix-maps2-2570.spec.ts): before = an error only; after = building A's run followed,
      // and what was / was not sent
      await page.evaluate(({ side, he }) => {
        const el = document.createElement('home-site-off') as unknown as HTMLElement & Record<string, unknown>;
        document.body.appendChild(el);
        el.kind = 'all_off';
        el.single = false;
        el.buildings = [
          { id: 'bA', name: he ? 'בניין א' : 'Building A', shared: false, targets: [], lightsOn: 5, activeOn: 8 },
          { id: 'bB', name: he ? 'בניין ב' : 'Building B', shared: false, targets: [], lightsOn: 3, activeOn: 4 },
          { id: 'bC', name: he ? 'בניין ג' : 'Building C', shared: false, targets: [], lightsOn: 2, activeOn: 2 },
        ];
        el.checked = { bA: true, bB: true, bC: true };
        if (side === 'before') {
          el.error = he ? 'רשימת ההתקנים השתנתה מאז שנפתח החלון, ולכן חלק מהפקודות לא נשלחו. פתחו את הפעולה מחדש.' : 'The device list changed after this window opened, so some commands were not sent. Open the action again.';
          el.phase = 'error';
          return;
        }
        const counts = { queued: 0, accepted: 6, confirmed: 2, sent: 0, not_confirmed: 0, refused: 0, unknown: 0, total: 8 };
        el.records = [{ id: 'run-a', scope: 'area', scope_id: 'a', scope_name: null, kind: 'all_off', kind_label: '', status: 'waiting', done: false, all_confirmed: false, counts, items: [], note: '' }];
        el.failNote = he
          ? 'נשלח אל: בניין א. הבקשה של בניין ב נכשלה, וממנה והלאה לא נשלח דבר: רשימת ההתקנים השתנתה מאז שנפתח החלון, ולכן חלק מהפקודות לא נשלחו. פתחו את הפעולה מחדש. לא נשלח דבר אל: בניין ג.'
          : 'Sent to: Building A. The request for Building B failed, and nothing was sent from there on: The device list changed after this window opened, so some commands were not sent. Open the action again. Nothing was sent to: Building C.';
        el.phase = 'running';
      }, { side: SIDE, he });
      await page.locator('home-site-off sw-dialog[open]').waitFor({ state: 'attached' });
      await page.waitForTimeout(500);
      await shot(page, `siteoff-${lang}-${scheme}`, info.project.name);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
}

// ------------------------------------------------------------------------------------------------ the checks (fail on the base build)

test('MH2-08: the English pager reads "1 out of 2" left to right and its chevrons are mirrored; Hebrew unchanged', async ({ page }) => {
  await openHome(page, 'en', 'light');
  const en = await pagerFacts(page);
  test.skip(!en, 'no pager on this screen size');
  expect(en!.text.replace(/\s+/g, ' ')).toBe('1 out of 2');
  expect(en!.x1).toBeLessThan(en!.x2);
  expect(en!.prevScale).toBe('-1 1');
  await openHome(page, 'he', 'light');
  const he = await pagerFacts(page);
  expect(he!.x1).toBeGreaterThan(he!.x2); // Hebrew: "1 מתוך 2" from the right
  expect(he!.prevScale === 'none' || he!.prevScale === '1').toBe(true);
});

test('MH2-09: the English energy tile label stays on one line at 360 px', async ({ page }) => {
  test.skip(!phone(page), 'the phone project only');
  await openHome(page, 'en', 'light');
  const box = await page.evaluate(() => {
    const k = document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.wg-c.en1 .wg-k');
    if (!k) return null;
    const label = [...k.childNodes].map((n) => n.textContent ?? '').join('').trim();
    const fs = parseFloat(getComputedStyle(k).fontSize);
    const r = k.getBoundingClientRect();
    const tile = (k.closest('[data-ft]') ?? k.parentElement!).getBoundingClientRect();
    return { label, h: r.height, fs, inside: r.left >= tile.left - 1 && r.right <= tile.right + 1 };
  });
  test.skip(!box, 'no energy tile on the main screen');
  expect(box!.h).toBeLessThan(box!.fs * 2.2); // one line (the 20 px icon sets the row height), not two
  expect(box!.inside).toBe(true); // and not wider than its tile (no clipped word)
});
