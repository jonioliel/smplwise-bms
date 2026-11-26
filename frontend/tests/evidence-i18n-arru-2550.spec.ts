import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installGeneratorMock, PERMS, url } from './generator-mocks';
import { installTemperature, LOG, units } from './temperature-mocks';

// I18N-ARRU-2550: on an Arabic and a Russian page the temperatures screen, the elevators screen and the generator run log show their own
// words in Arabic / Russian - no word of those modules is left in Hebrew. What may stay Hebrew: the fake data (unit, area, sensor and
// person names of the mocks) and the words of the Hebrew / English-only catalogues listed in KEEP (the product's main catalogue; the
// language switch offers Hebrew and English only, Arabic / Russian are reached by `<html lang>`, switched in place here as in
// evidence-gen-units-arru-2530.spec.ts).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-i18n-arru-2550.spec.ts --project=desktop --project=mobile
// SW_ARRU_SHOTS=<dir> also writes a picture of each case (taken before the word check, so a run on the base leaves its before-pictures);
// SW_ARRU_PRINT=1 prints the Hebrew text nodes that are left.
const SHOTS = process.env.SW_ARRU_SHOTS ?? '';
const HEB = /[֐-׿]/;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Every Hebrew string inside a fake payload (names, areas, sensors, people): data, not interface words. */
function dataWords(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === 'string') {
    if (HEB.test(v)) out.add(v);
  } else if (Array.isArray(v)) v.forEach((x) => dataWords(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => dataWords(x, out));
  return out;
}

// the elevators of evidence-elevators.spec.ts (the owner's sensor set), trimmed
const NOW = '2026-10-18T09:00:00Z';
const ROLES = ['fault', 'fire_service', 'out_of_service', 'waiting'];
const live = (state: string) => ({
  state, reason: state, partial: false, stale: false, since: NOW, roles: ROLES, extras: [],
  flags: { fault: state === 'fault', fire_service: state === 'fire_service', out_of_service: state === 'out_of_service', waiting: state === 'waiting' },
  history: [{ state: 'waiting', from: '2026-10-17T09:00:00Z', to: '2026-10-18T06:00:00Z' }, { state, from: '2026-10-18T06:00:00Z', to: NOW }],
});
const ELEVATORS = [
  { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', ...live('waiting') },
  { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'לובי', ...live('fault') },
  { id: 'e4', name: 'מעלית משא', area_id: null, area_name: 'בניין B', ...live('out_of_service') },
  { id: 'e5', name: 'מעלית דרום', area_id: null, area_name: 'בניין A', ...live('fire_service') },
];
async function installElevators(page: Page) {
  await installGeneratorMock(page, { perms: ['devices.read', 'infra.elevators.manage'], count: 0 });
  await page.route('**/api/v1/infra/elevators**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'infra/elevators') return json(route, { elevators: ELEVATORS, summary: {}, stale: false, at: NOW });
    return json(route, { code: 'elevator_not_found', user_message: 'x', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

// Hebrew text a screen may keep on an Arabic / Russian page, with the reason: words of Hebrew / English-only catalogues the module embeds
const KEEP: Record<string, string> = {};

interface Screen { id: string; hash: string; el: string; install: (page: Page) => Promise<void>; data: Set<string> }
const SCREENS: Screen[] = [
  { id: 'temperature', hash: '/infra/temperature', el: 'infra-temperature', install: (p) => installTemperature(p, units()), data: dataWords([units(), LOG]) },
  { id: 'elevators', hash: '/infra/elevators', el: 'infra-elevators', install: installElevators, data: dataWords(ELEVATORS) },
  { id: 'genlog', hash: '/infra/generator/log', el: 'gen-log-page', install: async (p) => void (await installGeneratorMock(p, { perms: PERMS.view, log: true })), data: new Set<string>() },
];

/** The text nodes under `sel`, through every shadow root, that carry Hebrew once the fake data words are taken out. */
async function hebrewLeft(page: Page, sel: string, data: string[]): Promise<string[]> {
  return page.evaluate(
    ({ sel, data }) => {
      const heb = /[֐-׿]/;
      const out: string[] = [];
      const walk = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) {
          let t = (n.textContent ?? '').trim();
          for (const d of data) t = t.split(d).join(' ');
          if (heb.test(t)) out.push((n.textContent ?? '').trim());
          return;
        }
        if (n instanceof Element) {
          if (n.tagName === 'STYLE' || n.tagName === 'SCRIPT') return;
          if (n.shadowRoot) walk(n.shadowRoot);
        }
        n.childNodes.forEach(walk);
      };
      document.querySelectorAll(sel).forEach(walk);
      return [...new Set(out)];
    },
    { sel, data },
  );
}

for (const screen of SCREENS) {
  for (const lang of ['ar', 'ru'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${screen.id}: ${lang} ${scheme} - the module's own words are ${lang === 'ar' ? 'Arabic' : 'Russian'}`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await screen.install(page);
        await page.goto('about:blank');
        await page.goto(url(screen.hash, 'classic', scheme));
        const root = page.locator(`sw-app ${screen.el}`);
        await expect(root).toBeVisible({ timeout: 20_000 });
        await page.evaluate((l) => {
          document.documentElement.setAttribute('lang', l);
          document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
        }, lang);
        await page.locator(`html[data-lang-words="${lang}"]`).waitFor({ state: 'attached', timeout: 0 });
        await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
        await page.waitForTimeout(300);
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: path.join(SHOTS, `${screen.id}-${lang}-${scheme}-${test.info().project.name}.png`) });
        }
        const left = (await hebrewLeft(page, `sw-app ${screen.el}`, [...screen.data].sort((a, b) => b.length - a.length))).filter((t) => !KEEP[t]);
        if (process.env.SW_ARRU_PRINT) console.log(`ARRU ${screen.id} ${lang} ${scheme} ${test.info().project.name}: ${JSON.stringify(left)}`);
        expect(left, `Hebrew words left on the ${lang} ${screen.id} screen`).toEqual([]);
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('sw-app')!).direction)).toBe(lang === 'ar' ? 'rtl' : 'ltr');
      });
    }
  }
}
