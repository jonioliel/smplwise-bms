import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installGeneratorMock, PERMS, url } from './generator-mocks';

// GEN-UNITS-ARRU-2530 (acceptance of GEN-UNITS-FIELD-2490: the text changes exist in all 4 languages): an Arabic and a Russian page show the
// generator settings unit words inside the field frame in their own words, and the unit sits at the END of the reading direction - left of
// the figure on the right-to-left Arabic page, right of it on the left-to-right Russian page; the digits stay left-to-right.
// The product's language switch offers Hebrew and English; Arabic / Russian are reached by `<html lang>` (an embedding page), switched in
// place here as in evidence-gen-units-en-2490.spec.ts.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-gen-units-arru-2530.spec.ts
const SHOTS = process.env.SW_GEN_ARRU_SHOTS ?? '';

const WORDS = {
  ar: { oil: 'الحد الأدنى لضغط الزيت', fuelLow: 'وقود منخفض', interval: 'الفترة المتوقعة بين الاختبارات (0 = بدون متابعة)', shortRun: 'التشغيل الأقصر من هذا لا يُسجَّل', bar: 'bar', days: 'يوم', s: 'ثانية', retStale: 'الوقت حتى عرض "لا يوجد اتصال"' },
  ru: { oil: 'Минимальное давление масла', fuelLow: 'Низкий уровень топлива', interval: 'Ожидаемый интервал тестов (0 = не отслеживать)', shortRun: 'Запуск короче этого не записывается', bar: 'бар', days: 'дн.', s: 'с', retStale: 'Время до показа «Нет связи»' },
} as const;

type Scheme = 'light' | 'dark';
async function open(page: Page, lang: 'ar' | 'ru', scheme: Scheme, hash: string, section: string): Promise<Locator> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installGeneratorMock(page, { perms: PERMS.manage, log: true });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  const s = page.locator(`sw-app gen-settings [data-section="${section}"]`);
  await expect(s).toBeVisible({ timeout: 20_000 });
  await page.evaluate((l) => {
    document.documentElement.setAttribute('lang', l);
    document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
  }, lang);
  // the words are a lazy pack: wait until it is in and the page was asked to render again (i18n/lang-packs.ts)
  await page.locator(`html[data-lang-words="${lang}"]`).waitFor({ state: 'attached', timeout: 0 });
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  return s;
}
type F = { label: string; unit: string; drawn: string; unitX: number; inputX: number; inputDir: string };
const fields = (s: Locator): Promise<F[]> =>
  s.locator('sw-field').evaluateAll((els) =>
    els.map((e) => {
      const u = e.shadowRoot?.querySelector('.unit') as HTMLElement | null;
      const i = e.querySelector('input');
      const ub = u?.getBoundingClientRect();
      const ib = i?.getBoundingClientRect();
      return {
        label: e.getAttribute('label') ?? '',
        unit: e.getAttribute('unit') ?? '',
        drawn: (u?.textContent ?? '').trim(),
        unitX: ub ? ub.left + ub.width / 2 : NaN,
        inputX: ib ? ib.left + ib.width / 2 : NaN,
        inputDir: i ? getComputedStyle(i).direction : '',
      };
    }),
  );
/** Taken before the word checks, so the same spec on the base commit (where they fail) still leaves its before-pictures. */
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${test.info().project.name}.png`) });
}

test.describe('generator settings: Arabic and Russian unit words in the field frame', () => {
  for (const lang of ['ar', 'ru'] as const) for (const scheme of ['light', 'dark'] as const) {
    const w = WORDS[lang];
    test(`${lang} ${scheme}: unit words and labels in ${lang}, the unit at the end of the reading direction, digits left-to-right`, async ({ page }) => {
      const s = await open(page, lang, scheme, '/system/infra/generator/thresholds', 'thresholds');
      await shot(page, `gen-units-${lang}-${scheme}-thresholds`);
      await expect.poll(async () => (await fields(s)).find((x) => x.label === w.oil)?.unit ?? null).toBe(w.bar);
      const f = await fields(s);
      expect(f.length).toBeGreaterThan(0);
      for (const x of f) {
        expect(x.label, `${x.label}: no Hebrew letters in the label`).not.toMatch(/[֐-׿]/);
        expect(x.label, 'no "(unit)" in the label').not.toMatch(/\(/);
        if (!x.unit) continue;
        expect(x.unit, 'no Hebrew letters in the unit').not.toMatch(/[֐-׿]/);
        expect(x.drawn, 'the unit is drawn inside the frame').toBe(x.unit);
        expect(x.inputDir, 'digits stay left-to-right').toBe('ltr');
        if (lang === 'ar') expect(x.unitX, `${x.label}: unit left of the figure (RTL end)`).toBeLessThan(x.inputX);
        else expect(x.unitX, `${x.label}: unit right of the figure (LTR end)`).toBeGreaterThan(x.inputX);
      }
      expect(f.find((x) => x.label === w.fuelLow)?.unit).toBe('%');
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('sw-app')!).direction)).toBe(lang === 'ar' ? 'rtl' : 'ltr');

      const rt = await open(page, lang, scheme, '/system/infra/generator/retention', 'retention');
      await shot(page, `gen-units-${lang}-${scheme}-retention`);
      await expect.poll(async () => (await fields(rt)).find((x) => x.label === w.retStale)?.unit ?? null).toBe(w.s);
      expect((await fields(rt)).filter((x) => x.unit === w.days).length).toBe(2);

      const log = await open(page, lang, scheme, '/system/infra/generator/log', 'log');
      await shot(page, `gen-units-${lang}-${scheme}-log`);
      await expect.poll(async () => (await fields(log)).find((x) => x.label === w.interval)?.unit ?? null).toBe(w.days);
      const lf = await fields(log);
      expect(lf.find((x) => x.label === w.shortRun)?.unit).toBe(w.s);
      for (const x of lf) expect(x.label, `${x.label}: no Hebrew letters`).not.toMatch(/[֐-׿]/);
    });
  }
});
