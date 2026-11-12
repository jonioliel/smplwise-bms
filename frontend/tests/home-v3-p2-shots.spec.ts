import { test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP2 } from './home-v3-p2-mocks';

// HOME-V3-P2-2431: evidence screenshots (not a gate). Runs only with SW_SHOTS=1; writes evidence/HOME-V3-P2-2431/shots/*.png.
// Every family screen at 1280x800 / 1024x768 / 390x844 in classic light + midnight dark, the sheets, the worst and empty cases,
// and the calendar in all seven themes.

const OUT = '../evidence/HOME-V3-P2-2431/shots';
const SCREENS: [string, string, string?][] = [
  ['more', 'more'], ['presence', 'presence'], ['calendar', 'calendar'], ['calendar-new', 'calendar', 'p2CalNew'], ['booking', 'calendar/book'],
  ['booking-new', 'calendar/book', 'p2BookNew'], ['notices', 'notices'], ['notice-open', 'notices', 'p2Notice'], ['tickets', 'tickets'],
  ['ticket-new', 'tickets', 'p2TkNew'], ['ticket-open', 'tickets', 'p2Ticket'], ['weather', 'weather'], ['notif', 'notif'], ['schedules', 'schedules'],
  ['schedule-new', 'schedules', 'p2SchNew'], ['scene-new', 'scenes', 'p2CapNew'],
];
const SIZES: [string, number, number][] = [['desktop', 1280, 800], ['tablet', 1024, 768], ['phone', 390, 844]];

async function theme(page: Page, t: string, scheme: string) {
  await page.evaluate(([t, s]) => {
    const h = document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home') as HTMLElement | null;
    h?.setAttribute('data-hs-theme', t);
    h?.setAttribute('data-hs-scheme', s);
  }, [t, scheme]);
}

async function shoot(page: Page, route: string, act: string | undefined, file: string, t: string, scheme: string) {
  await page.goto('/#/home/r/home'); // a route change closes a sheet left open by the previous shot
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await settle(page);
  await theme(page, t, scheme);
  if (act) await page.locator('sw-home').locator(`[data-act="${act}"]`).first().click();
  await settle(page);
  await page.screenshot({ path: `${OUT}/${file}.png` });
}

test.describe('HOME-V3-P2-2431 evidence shots', () => {
  test.skip(!process.env.SW_SHOTS, 'evidence only');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop'); });
  test.setTimeout(600_000);

  for (const [size, w, h] of SIZES) {
    test(`screens ${size}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mockP2(page);
      for (const [name, route, act] of SCREENS) {
        for (const [t, s] of [['classic', 'light'], ['midnight', 'dark']]) await shoot(page, route, act, `${name}-${size}-${t}-${s}`, t, s);
      }
    });
    test(`worst and empty ${size}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mockP2(page, { worst: true });
      for (const [name, route, act] of SCREENS.filter((x) => !x[2] || x[0] === 'notice-open')) await shoot(page, route, act, `worst-${name}-${size}`, 'classic', 'light');
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mockP2(page, { empty: true });
      for (const [name, route] of SCREENS.filter((x) => !x[2])) await shoot(page, route, undefined, `empty-${name}-${size}`, 'classic', 'light');
    });
  }
  test('seven themes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockP2(page);
    for (const t of ['classic', 'ocean', 'sand', 'plum', 'midnight', 'nordic', 'pastel']) {
      for (const r of ['calendar', 'notices', 'tickets']) await shoot(page, r, undefined, `th-${t}-${r}`, t, t === 'midnight' ? 'dark' : 'light');
    }
  });
  test('wall panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockP2(page, { kiosk: true });
    await shoot(page, 'r/living', undefined, 'kiosk-room', 'classic', 'light');
    await shoot(page, 'calendar', undefined, 'kiosk-calendar', 'classic', 'light');
  });
});
